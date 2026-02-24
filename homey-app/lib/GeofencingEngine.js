'use strict';

const { BaseSystem } = require('./utils/BaseSystem');

/**
 * Geofencing Engine
 * Advanced location-based automation with multi-zone support,
 * predictive arrival/departure, and smart radius adjustment
 */
class GeofencingEngine extends BaseSystem {
  constructor(homey) {
    super(homey, 'GeofencingEngine');
    this.geofences = new Map();
    this.userLocations = new Map();
    this.locationHistory = [];
    this.travelPatterns = new Map();
    this.activeGeofences = new Set();
  }

  async onInitialize() {
    this.log('Initializing Geofencing Engine...');

    // Load saved geofences
    const saved = await this.homey.settings.get('geofences') || {};
    Object.entries(saved).forEach(([id, fence]) => {
      this.geofences.set(id, fence);
    });

    // Load location history
    this.locationHistory = await this.homey.settings.get('locationHistory') || [];
    this.travelPatterns = new Map(await this.homey.settings.get('travelPatterns') || []);

    // Create default home geofence
    if (this.geofences.size === 0) {
      await this.createDefaultHomeGeofence();
    }

    // Start location monitoring
    await this.startLocationMonitoring();

    this.log('Geofencing Engine initialized');
  }

  /**
   * Create default home geofence
   */
  async createDefaultHomeGeofence() {
    try {
      const homeLocation = await this.homey.geolocation.getLocation();

      await this.createGeofence({
        id: 'home',
        name: { en: 'Home', sv: 'Hemma' },
        location: {
          latitude: homeLocation.latitude,
          longitude: homeLocation.longitude
        },
        radius: 100, // meters
        adaptive: true,
        actions: {
          onEnter: [
            { type: 'scene', sceneId: 'arrive_home' },
            { type: 'notification', message: 'Välkommen hem!' }
          ],
          onExit: [
            { type: 'scene', sceneId: 'leave_home' },
            { type: 'notification', message: 'Hejdå! Säkerhetsläge aktiveras.' }
          ]
        }
      });
    } catch (error) {
      this.error('Could not get home location:', error);
    }
  }

  /**
   * Create a new geofence
   */
  async createGeofence(config) {
    const geofence = {
      id: config.id || this.generateId(),
      name: config.name,
      location: {
        latitude: config.location.latitude,
        longitude: config.location.longitude
      },
      radius: config.radius || 100,
      adaptive: config.adaptive !== false,

      actions: {
        onEnter: config.actions?.onEnter || [],
        onExit: config.actions?.onExit || [],
        onDwell: config.actions?.onDwell || [], // After being inside for X minutes
        onApproach: config.actions?.onApproach || [] // When approaching (predictive)
      },

      settings: {
        dwellTime: config.dwellTime || 300000, // 5 minutes
        approachDistance: config.approachDistance || 500, // 500 meters
        cooldown: config.cooldown || 300000, // 5 minutes between triggers
        requireConfirm: config.requireConfirm || false
      },

      schedule: config.schedule || null, // Only active during certain times
      conditions: config.conditions || [], // Additional conditions to check

      users: config.users || ['all'], // Which users this applies to

      statistics: {
        entries: 0,
        exits: 0,
        lastEntered: null,
        lastExited: null,
        averageDwellTime: 0
      },

      created: Date.now(),
      enabled: config.enabled !== false
    };

    this.geofences.set(geofence.id, geofence);
    await this.saveGeofences();

    return geofence;
  }

  /**
   * Start monitoring user locations
   */
  async startLocationMonitoring() {
    // Check all geofences every 30 seconds
    this.monitoringInterval = this.wrapInterval(async () => {
      await this.checkGeofences();
    }, 30000);

    // Try to get initial location
    await this.updateUserLocation('default');
  }

  /**
   * Update user location
   */
  async updateUserLocation(userId, location = null) {
    try {
      // Get location from Homey or use provided
      const userLocation = location || await this.homey.geolocation.getLocation();

      const previousLocation = this.userLocations.get(userId);

      this.userLocations.set(userId, {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        accuracy: userLocation.accuracy || 50,
        timestamp: Date.now(),
        speed: this.calculateSpeed(previousLocation, userLocation)
      });

      // Record in history
      this.locationHistory.push({
        userId,
        location: userLocation,
        timestamp: Date.now()
      });

      // Keep only last 1000 records
      if (this.locationHistory.length > 1000) {
        this.locationHistory.shift();
      }

      // Analyze travel patterns
      await this.analyzeTravelPattern(userId, userLocation);

      await this.saveLocationHistory();
    } catch (error) {
      this.error('Error updating location:', error);
    }
  }

  /**
   * Check all geofences for all users
   */
  async checkGeofences() {
    for (const [userId, location] of this.userLocations) {
      for (const [id, geofence] of this.geofences) {
        if (!geofence.enabled) continue;

        // Check if user applies
        if (!this.userApplies(userId, geofence)) continue;

        // Check schedule
        if (!this.checkSchedule(geofence)) continue;

        // Calculate distance
        const distance = this.calculateDistance(
          location.latitude,
          location.longitude,
          geofence.location.latitude,
          geofence.location.longitude
        );

        const fenceKey = `${userId}_${id}`;
        const wasInside = this.activeGeofences.has(fenceKey);
        const isInside = distance <= geofence.radius;

        // Handle state changes
        if (isInside && !wasInside) {
          await this.handleEnter(userId, geofence);
          this.activeGeofences.add(fenceKey);
        } else if (!isInside && wasInside) {
          await this.handleExit(userId, geofence);
          this.activeGeofences.delete(fenceKey);
        } else if (isInside) {
          await this.handleDwell(userId, geofence);
        }

        // Check approach (predictive)
        if (!isInside && distance <= geofence.settings.approachDistance) {
          const isApproaching = await this.isApproachingGeofence(userId, geofence, location);
          if (isApproaching) {
            await this.handleApproach(userId, geofence, distance);
          }
        }

        // Adaptive radius adjustment
        if (geofence.adaptive) {
          await this.adjustGeofenceRadius(geofence, userId);
        }
      }
    }
  }

  /**
   * Handle geofence entry
   */
  async handleEnter(userId, geofence) {
    this.log(`User ${userId} entered geofence ${geofence.id}`);

    // Check cooldown
    if (!this.checkCooldown(geofence, 'enter')) {
      return;
    }

    // Update statistics
    geofence.statistics.entries++;
    geofence.statistics.lastEntered = Date.now();

    // Check additional conditions
    if (!await this.checkConditions(geofence.conditions)) {
      return;
    }

    // Execute actions
    for (const action of geofence.actions.onEnter) {
      try {
        await this.executeGeofenceAction(action, { userId, geofence, event: 'enter' });
      } catch (error) {
        this.error('Error executing enter action:', error);
      }
    }

    // Trigger flow card
    await this.triggerGeofenceFlow('entered', geofence, userId);

    await this.saveGeofences();
  }

  /**
   * Handle geofence exit
   */
  async handleExit(userId, geofence) {
    this.log(`User ${userId} exited geofence ${geofence.id}`);

    // Check cooldown
    if (!this.checkCooldown(geofence, 'exit')) {
      return;
    }

    // Update statistics
    geofence.statistics.exits++;
    const dwellTime = Date.now() - geofence.statistics.lastEntered;
    geofence.statistics.lastExited = Date.now();

    // Update average dwell time
    if (geofence.statistics.entries > 0) {
      geofence.statistics.averageDwellTime =
        (geofence.statistics.averageDwellTime * (geofence.statistics.entries - 1) + dwellTime) /
        geofence.statistics.entries;
    }

    // Check additional conditions
    if (!await this.checkConditions(geofence.conditions)) {
      return;
    }

    // Execute actions
    for (const action of geofence.actions.onExit) {
      try {
        await this.executeGeofenceAction(action, { userId, geofence, event: 'exit', dwellTime });
      } catch (error) {
        this.error('Error executing exit action:', error);
      }
    }

    // Trigger flow card
    await this.triggerGeofenceFlow('exited', geofence, userId);

    await this.saveGeofences();
  }

  /**
   * Handle dwelling in geofence
   */
  async handleDwell(userId, geofence) {
    const dwellTime = Date.now() - geofence.statistics.lastEntered;

    // Check if dwell threshold is met and actions haven't been executed yet
    if (dwellTime >= geofence.settings.dwellTime && geofence.actions.onDwell.length > 0) {
      const dwellKey = `dwell_${userId}_${geofence.id}_${geofence.statistics.lastEntered}`;

      if (!this.activeGeofences.has(dwellKey)) {
        for (const action of geofence.actions.onDwell) {
          try {
            await this.executeGeofenceAction(action, { userId, geofence, event: 'dwell', dwellTime });
          } catch (error) {
            this.error('Error executing dwell action:', error);
          }
        }

        this.activeGeofences.add(dwellKey);
      }
    }
  }

  /**
   * Handle approaching geofence (predictive)
   */
  async handleApproach(userId, geofence, distance) {
    const approachKey = `approach_${userId}_${geofence.id}`;

    // Only trigger once per approach
    if (this.activeGeofences.has(approachKey)) {
      return;
    }

    this.log(`User ${userId} approaching geofence ${geofence.id} (${distance}m away)`);

    // Predict arrival time
    const location = this.userLocations.get(userId);
    const eta = this.predictArrivalTime(userId, geofence, distance, location.speed);

    // Execute approach actions
    for (const action of geofence.actions.onApproach) {
      try {
        await this.executeGeofenceAction(action, {
          userId,
          geofence,
          event: 'approach',
          distance,
          eta
        });
      } catch (error) {
        this.error('Error executing approach action:', error);
      }
    }

    // Trigger flow card
    await this.triggerGeofenceFlow('approaching', geofence, userId, { distance, eta });

    this.activeGeofences.add(approachKey);

    // Clear approach flag after 5 minutes
    this.wrapTimeout(() => {
      this.activeGeofences.delete(approachKey);
    }, 300000);
  }

  /**
   * Determine if user is approaching geofence
   */
  async isApproachingGeofence(userId, geofence, currentLocation) {
    // Get recent location history for this user
    const recentHistory = this.locationHistory
      .filter(h => h.userId === userId)
      .slice(-5);

    if (recentHistory.length < 2) return false;

    // Calculate if distance is decreasing
    const distances = recentHistory.map(h =>
      this.calculateDistance(
        h.location.latitude,
        h.location.longitude,
        geofence.location.latitude,
        geofence.location.longitude
      )
    );

    // Check if generally moving closer
    const trend = distances.slice(-3).reduce((acc, d, i, arr) => {
      if (i === 0) return 0;
      return acc + (arr[i - 1] > d ? 1 : -1);
    }, 0);

    return trend > 0; // Positive trend means approaching
  }

  /**
   * Predict arrival time based on speed and distance
   */
  predictArrivalTime(userId, geofence, distance, speed) {
    if (!speed || speed === 0) {
      // Use average speed from travel patterns
      const pattern = this.travelPatterns.get(userId);
      speed = pattern?.averageSpeed || 10; // 10 m/s default (36 km/h)
    }

    const timeSeconds = distance / speed;
    return {
      seconds: Math.round(timeSeconds),
      minutes: Math.round(timeSeconds / 60),
      formatted: this.formatDuration(timeSeconds)
    };
  }

  /**
   * Analyze travel patterns for better predictions
   */
  async analyzeTravelPattern(userId, location) {
    const recentLocations = this.locationHistory
      .filter(h => h.userId === userId)
      .slice(-10);

    if (recentLocations.length < 2) return;

    // Calculate average speed
    let totalSpeed = 0;
    let speedCount = 0;

    for (let i = 1; i < recentLocations.length; i++) {
      const prev = recentLocations[i - 1];
      const curr = recentLocations[i];

      const distance = this.calculateDistance(
        prev.location.latitude,
        prev.location.longitude,
        curr.location.latitude,
        curr.location.longitude
      );

      const timeDiff = (curr.timestamp - prev.timestamp) / 1000; // seconds

      if (timeDiff > 0) {
        totalSpeed += distance / timeDiff;
        speedCount++;
      }
    }

    const averageSpeed = speedCount > 0 ? totalSpeed / speedCount : 0;

    // Identify common routes
    const routes = this.identifyRoutes(recentLocations);

    // Update travel pattern
    const pattern = this.travelPatterns.get(userId) || {
      averageSpeed: 0,
      routes: [],
      commonDestinations: []
    };

    pattern.averageSpeed = (pattern.averageSpeed + averageSpeed) / 2;
    pattern.routes = routes;

    this.travelPatterns.set(userId, pattern);
    await this.saveTravelPatterns();
  }

  /**
   * Identify common routes
   */
  identifyRoutes(locations) {
    // Simple route detection based on location clusters
    // In a production system, this would use more sophisticated algorithms
    return [];
  }

  /**
   * Adjust geofence radius based on accuracy and patterns
   */
  async adjustGeofenceRadius(geofence, userId) {
    const location = this.userLocations.get(userId);
    if (!location) return;

    // Adjust based on location accuracy
    const minRadius = 50;
    const maxRadius = 500;
    const accuracyFactor = Math.max(location.accuracy || 50, minRadius);

    // Calculate optimal radius
    let optimalRadius = accuracyFactor * 1.5;

    // Consider historical false triggers
    const recentHistory = this.locationHistory
      .filter(h => h.userId === userId)
      .slice(-50);

    // If many boundary crossings, increase radius
    const boundaryCrossings = this.countBoundaryCrossings(recentHistory, geofence);
    if (boundaryCrossings > 10) {
      optimalRadius *= 1.2;
    }

    // Apply limits
    optimalRadius = Math.max(minRadius, Math.min(maxRadius, optimalRadius));

    // Gradually adjust
    geofence.radius = (geofence.radius * 0.9) + (optimalRadius * 0.1);
  }

  /**
   * Count boundary crossings (potential false triggers)
   */
  countBoundaryCrossings(history, geofence) {
    let crossings = 0;
    let wasInside = null;

    for (const record of history) {
      const distance = this.calculateDistance(
        record.location.latitude,
        record.location.longitude,
        geofence.location.latitude,
        geofence.location.longitude
      );

      const isInside = distance <= geofence.radius;

      if (wasInside !== null && wasInside !== isInside) {
        crossings++;
      }

      wasInside = isInside;
    }

    return crossings;
  }

  /**
   * Execute geofence action
   */
  async executeGeofenceAction(action, context) {
    switch (action.type) {
      case 'scene':
        await this.homey.app.sceneManager.activateScene(action.sceneId);
        break;

      case 'automation':
        await this.homey.app.automationEngine.executeAutomation(action.automationId, context);
        break;

      case 'notification':
        await this.homey.notifications.createNotification({
          excerpt: action.message
        });
        break;

      case 'device': {
        const device = await this.homey.devices.getDevice({ id: action.deviceId });
        await device.setCapabilityValue(action.capability, action.value);
        break;
      }

      case 'delay':
        await this.delay(action.milliseconds);
        break;
    }
  }

  /**
   * Trigger Homey flow card for geofence events
   */
  async triggerGeofenceFlow(event, geofence, userId, data = {}) {
    const trigger = this.homey.flow.getTriggerCard(`geofence_${event}`);
    if (trigger) {
      await trigger.trigger({
        geofence: geofence.name.en || geofence.name.sv,
        user: userId,
        ...data
      });
    }
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  calculateSpeed(previousLocation, currentLocation) {
    if (!previousLocation) return 0;

    const distance = this.calculateDistance(
      previousLocation.latitude,
      previousLocation.longitude,
      currentLocation.latitude,
      currentLocation.longitude
    );

    const timeDiff = (Date.now() - previousLocation.timestamp) / 1000; // seconds

    return timeDiff > 0 ? distance / timeDiff : 0;
  }

  userApplies(userId, geofence) {
    return geofence.users.includes('all') || geofence.users.includes(userId);
  }

  checkSchedule(geofence) {
    if (!geofence.schedule) return true;

    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();

    if (geofence.schedule.days && !geofence.schedule.days.includes(day)) {
      return false;
    }

    if (geofence.schedule.hours) {
      const { start, end } = geofence.schedule.hours;
      if (hour < start || hour > end) {
        return false;
      }
    }

    return true;
  }

  checkCooldown(geofence, event) {
    const lastEvent = event === 'enter' ? geofence.statistics.lastEntered : geofence.statistics.lastExited;

    if (!lastEvent) return true;

    const timeSince = Date.now() - lastEvent;
    return timeSince >= geofence.settings.cooldown;
  }

  async checkConditions(conditions) {
    for (const condition of conditions) {
      const result = await this.evaluateCondition(condition);
      if (!result) return false;
    }
    return true;
  }

  async evaluateCondition(condition) {
    // Use automation engine's condition evaluation
    if (this.homey.app.automationEngine) {
      return await this.homey.app.automationEngine.evaluateCondition(condition);
    }
    return true;
  }

  formatDuration(seconds) {
    if (seconds < 60) return `${Math.round(seconds)} sekunder`;
    if (seconds < 3600) return `${Math.round(seconds / 60)} minuter`;
    return `${Math.round(seconds / 3600)} timmar`;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  generateId() {
    return `geo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async saveGeofences() {
    const data = {};
    this.geofences.forEach((fence, id) => {
      data[id] = fence;
    });
    await this.homey.settings.set('geofences', data);
  }

  async saveLocationHistory() {
    await this.homey.settings.set('locationHistory', this.locationHistory.slice(-1000));
  }

  async saveTravelPatterns() {
    await this.homey.settings.set('travelPatterns', Array.from(this.travelPatterns.entries()));
  }
}

module.exports = GeofencingEngine;
