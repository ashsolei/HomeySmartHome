'use strict';

/**
 * Geofencing Manager
 * GPS-based automation triggered when users arrive/leave home
 */
class GeofencingManager {
  constructor(app) {
    this.app = app;
    this.zones = new Map();
    this.devices = new Map();
    this.triggers = new Map();
    this.locationHistory = [];
    this.events = [];
  }

  async initialize() {
    // Load geofence zones
    await this.loadZones();
    
    // Load tracked devices
    await this.loadDevices();
    
    // Load triggers
    await this.loadTriggers();
    
    // Start tracking
    this.startTracking();
  }

  // ============================================
  // ZONE MANAGEMENT
  // ============================================

  async loadZones() {
    // Home zone (primary)
    this.zones.set('home', {
      id: 'home',
      name: 'Hemma',
      type: 'home',
      center: {
        lat: 59.3293,
        lng: 18.0686
      },
      radius: 100, // meters
      enabled: true,
      occupants: [],
      lastEnter: null,
      lastExit: null
    });

    // Work zone
    this.zones.set('work', {
      id: 'work',
      name: 'Arbete',
      type: 'work',
      center: {
        lat: 59.3326,
        lng: 18.0649
      },
      radius: 50,
      enabled: true,
      occupants: [],
      lastEnter: null,
      lastExit: null
    });

    // Gym zone
    this.zones.set('gym', {
      id: 'gym',
      name: 'Gym',
      type: 'leisure',
      center: {
        lat: 59.3310,
        lng: 18.0720
      },
      radius: 30,
      enabled: true,
      occupants: [],
      lastEnter: null,
      lastExit: null
    });

    // School zone (for children)
    this.zones.set('school', {
      id: 'school',
      name: 'Skola',
      type: 'school',
      center: {
        lat: 59.3350,
        lng: 18.0700
      },
      radius: 50,
      enabled: true,
      occupants: [],
      lastEnter: null,
      lastExit: null
    });

    // Grocery store zone
    this.zones.set('grocery', {
      id: 'grocery',
      name: 'Mataffär',
      type: 'shopping',
      center: {
        lat: 59.3280,
        lng: 18.0650
      },
      radius: 50,
      enabled: true,
      occupants: [],
      lastEnter: null,
      lastExit: null
    });
  }

  async createZone(config) {
    const zone = {
      id: config.id || `zone_${Date.now()}`,
      name: config.name,
      type: config.type || 'custom',
      center: config.center,
      radius: config.radius || 100,
      enabled: config.enabled !== false,
      occupants: [],
      lastEnter: null,
      lastExit: null,
      created: Date.now()
    };

    this.zones.set(zone.id, zone);

    return { success: true, zone };
  }

  async updateZone(zoneId, updates) {
    const zone = this.zones.get(zoneId);
    
    if (!zone) {
      return { success: false, error: 'Zone not found' };
    }

    Object.assign(zone, updates);

    return { success: true, zone };
  }

  async deleteZone(zoneId) {
    if (zoneId === 'home') {
      return { success: false, error: 'Cannot delete home zone' };
    }

    this.zones.delete(zoneId);

    return { success: true };
  }

  // ============================================
  // DEVICE TRACKING
  // ============================================

  async loadDevices() {
    // Tracked devices (phones)
    const deviceConfigs = [
      {
        id: 'phone_magnus',
        name: 'Magnus Telefon',
        owner: 'user_1',
        ownerName: 'Magnus',
        type: 'phone',
        trackingEnabled: true
      },
      {
        id: 'phone_anna',
        name: 'Anna Telefon',
        owner: 'user_2',
        ownerName: 'Anna',
        type: 'phone',
        trackingEnabled: true
      },
      {
        id: 'phone_emma',
        name: 'Emma Telefon',
        owner: 'user_3',
        ownerName: 'Emma',
        type: 'phone',
        trackingEnabled: true
      }
    ];

    for (const config of deviceConfigs) {
      this.devices.set(config.id, {
        ...config,
        currentLocation: null,
        currentZone: null,
        previousZone: null,
        lastUpdate: null,
        battery: 100,
        accuracy: 10 // meters
      });
    }
  }

  // ============================================
  // TRACKING
  // ============================================

  startTracking() {
    // Update locations every 2 minutes
    setInterval(() => {
      this.updateAllLocations();
    }, 2 * 60 * 1000);

    // Check zone transitions every 30 seconds
    setInterval(() => {
      this.checkZoneTransitions();
    }, 30 * 1000);

    // Initial update
    this.updateAllLocations();
  }

  async updateAllLocations() {
    for (const [deviceId, device] of this.devices) {
      if (!device.trackingEnabled) continue;

      // Simulate location (in production: integrate with actual GPS)
      const location = this.simulateLocation(device);
      
      device.currentLocation = location;
      device.lastUpdate = Date.now();

      // Log location
      this.logLocation({
        deviceId,
        location,
        timestamp: Date.now()
      });
    }
  }

  simulateLocation(device) {
    const hour = new Date().getHours();
    const dayOfWeek = new Date().getDay();
    
    // Determine likely location based on time and day
    let targetZone = null;

    if (device.owner === 'user_3') { // Emma (child)
      if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Weekdays
        if (hour >= 8 && hour <= 15) {
          targetZone = this.zones.get('school');
        } else {
          targetZone = this.zones.get('home');
        }
      } else {
        targetZone = this.zones.get('home');
      }
    } else { // Adults
      if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Weekdays
        if (hour >= 9 && hour <= 17) {
          targetZone = this.zones.get('work');
        } else if (hour >= 17 && hour <= 18) {
          // Sometimes at grocery store
          targetZone = Math.random() < 0.3 ? this.zones.get('grocery') : this.zones.get('home');
        } else {
          targetZone = this.zones.get('home');
        }
      } else { // Weekend
        if (hour >= 10 && hour <= 11 && Math.random() < 0.2) {
          targetZone = this.zones.get('gym');
        } else {
          targetZone = this.zones.get('home');
        }
      }
    }

    if (!targetZone) {
      targetZone = this.zones.get('home');
    }

    // Add some randomness to simulate movement within zone
    const randomOffset = () => (Math.random() - 0.5) * 0.001; // ~100m

    return {
      lat: targetZone.center.lat + randomOffset(),
      lng: targetZone.center.lng + randomOffset(),
      accuracy: 10 + Math.random() * 20, // 10-30 meters
      speed: Math.random() * 2, // 0-2 m/s when in zone
      heading: Math.random() * 360
    };
  }

  async checkZoneTransitions() {
    for (const [_deviceId, device] of this.devices) {
      if (!device.trackingEnabled || !device.currentLocation) continue;

      // Check which zone device is in
      const currentZone = this.findZoneForLocation(device.currentLocation);
      
      if (currentZone !== device.currentZone) {
        // Zone transition detected
        await this.handleZoneTransition(device, device.currentZone, currentZone);
        
        device.previousZone = device.currentZone;
        device.currentZone = currentZone;
      }
    }
  }

  findZoneForLocation(location) {
    for (const [zoneId, zone] of this.zones) {
      if (!zone.enabled) continue;

      const distance = this.calculateDistance(
        location.lat,
        location.lng,
        zone.center.lat,
        zone.center.lng
      );

      if (distance <= zone.radius) {
        return zoneId;
      }
    }

    return null; // Not in any zone
  }

  calculateDistance(lat1, lng1, lat2, lng2) {
    // Haversine formula
    const R = 6371000; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  // ============================================
  // ZONE TRANSITIONS
  // ============================================

  async handleZoneTransition(device, fromZone, toZone) {
    console.log(`📍 ${device.ownerName}: ${fromZone || 'away'} → ${toZone || 'away'}`);

    // Update zone occupancy
    if (fromZone) {
      const zone = this.zones.get(fromZone);
      zone.occupants = zone.occupants.filter(o => o !== device.id);
      zone.lastExit = Date.now();
    }

    if (toZone) {
      const zone = this.zones.get(toZone);
      zone.occupants.push(device.id);
      zone.lastEnter = Date.now();
    }

    // Log event
    this.logEvent({
      type: toZone ? 'enter' : 'exit',
      deviceId: device.id,
      deviceName: device.name,
      ownerName: device.ownerName,
      fromZone,
      toZone,
      timestamp: Date.now()
    });

    // Execute triggers
    await this.executeTriggers(device, fromZone, toZone);
  }

  async executeTriggers(device, fromZone, toZone) {
    for (const [_triggerId, trigger] of this.triggers) {
      if (!trigger.enabled) continue;

      // Check if trigger matches
      const matches = this.triggerMatches(trigger, device, fromZone, toZone);
      
      if (matches) {
        await this.executeTrigger(trigger, device);
      }
    }
  }

  triggerMatches(trigger, device, fromZone, toZone) {
    // Check device filter
    if (trigger.devices && !trigger.devices.includes(device.id)) {
      return false;
    }

    // Check event type
    if (trigger.event === 'enter' && !toZone) {
      return false;
    }
    
    if (trigger.event === 'exit' && toZone) {
      return false;
    }

    // Check zone
    if (trigger.zone && trigger.zone !== (trigger.event === 'enter' ? toZone : fromZone)) {
      return false;
    }

    // Check conditions
    if (trigger.conditions) {
      for (const condition of trigger.conditions) {
        if (!this.evaluateCondition(condition)) {
          return false;
        }
      }
    }

    return true;
  }

  evaluateCondition(condition) {
    switch (condition.type) {
      case 'time':
        const hour = new Date().getHours();
        return hour >= condition.after && hour <= condition.before;
      
      case 'day':
        const day = new Date().getDay();
        return condition.days.includes(day);
      
      case 'nobody_home':
        const homeZone = this.zones.get('home');
        return homeZone.occupants.length === 0;
      
      case 'everyone_home':
        const home = this.zones.get('home');
        const totalDevices = Array.from(this.devices.values())
          .filter(d => d.trackingEnabled).length;
        return home.occupants.length === totalDevices;
      
      default:
        return true;
    }
  }

  async executeTrigger(trigger, device) {
    console.log(`  → Executing trigger: ${trigger.name}`);

    for (const action of trigger.actions) {
      try {
        await this.executeAction(action, device);
      } catch (error) {
        console.error(`Action failed:`, error);
      }
    }
  }

  async executeAction(action, _device) {
    switch (action.type) {
      case 'device_on':
        console.log(`    Turn on: ${action.deviceId}`);
        // await this.app.devices.get(action.deviceId).setCapability('onoff', true);
        break;
      
      case 'device_off':
        console.log(`    Turn off: ${action.deviceId}`);
        // await this.app.devices.get(action.deviceId).setCapability('onoff', false);
        break;
      
      case 'scene':
        console.log(`    Activate scene: ${action.sceneId}`);
        // await this.app.flow.triggerScene(action.sceneId);
        break;
      
      case 'notification':
        console.log(`    Send notification: ${action.message}`);
        // await this.app.notifications.send(action);
        break;
      
      case 'alarm':
        console.log(`    Control alarm: ${action.state}`);
        // await this.app.alarm.setState(action.state);
        break;
      
      case 'climate':
        console.log(`    Set climate mode: ${action.mode}`);
        // await this.app.climate.setMode(action.mode);
        break;
    }
  }

  // ============================================
  // TRIGGER MANAGEMENT
  // ============================================

  async loadTriggers() {
    // Coming home trigger
    await this.createTrigger({
      id: 'arrive_home',
      name: 'Kommer hem',
      event: 'enter',
      zone: 'home',
      enabled: true,
      actions: [
        { type: 'scene', sceneId: 'welcome_home' },
        { type: 'notification', message: 'Välkommen hem!', channel: 'dashboard' },
        { type: 'device_on', deviceId: 'living_room_lights' },
        { type: 'climate', mode: 'comfort' }
      ]
    });

    // Leaving home trigger (last person)
    await this.createTrigger({
      id: 'leave_home',
      name: 'Lämnar hemmet (sista personen)',
      event: 'exit',
      zone: 'home',
      enabled: true,
      conditions: [
        { type: 'nobody_home' }
      ],
      actions: [
        { type: 'scene', sceneId: 'away_mode' },
        { type: 'device_off', deviceId: 'all_lights' },
        { type: 'alarm', state: 'armed' },
        { type: 'climate', mode: 'eco' }
      ]
    });

    // Arriving at work
    await this.createTrigger({
      id: 'arrive_work',
      name: 'Anländer till jobbet',
      event: 'enter',
      zone: 'work',
      enabled: true,
      conditions: [
        { type: 'day', days: [1, 2, 3, 4, 5] }, // Weekdays
        { type: 'time', after: 7, before: 10 }
      ],
      actions: [
        { type: 'notification', message: 'God arbetsdag!', channel: 'mobile' }
      ]
    });

    // Leaving work (heading home)
    await this.createTrigger({
      id: 'leave_work',
      name: 'Lämnar jobbet',
      event: 'exit',
      zone: 'work',
      enabled: true,
      conditions: [
        { type: 'time', after: 15, before: 19 }
      ],
      actions: [
        { type: 'notification', message: 'Förbereder hemmet...', channel: 'mobile' },
        { type: 'climate', mode: 'comfort' },
        { type: 'device_on', deviceId: 'outdoor_lights' }
      ]
    });

    // At grocery store
    await this.createTrigger({
      id: 'arrive_grocery',
      name: 'Anländer till mataffär',
      event: 'enter',
      zone: 'grocery',
      enabled: true,
      actions: [
        { type: 'notification', message: 'Visa inköpslista', channel: 'mobile', action: 'open_shopping_list' }
      ]
    });
  }

  async createTrigger(config) {
    const trigger = {
      id: config.id || `trigger_${Date.now()}`,
      name: config.name,
      event: config.event, // 'enter' or 'exit'
      zone: config.zone,
      devices: config.devices, // Filter by specific devices
      conditions: config.conditions || [],
      actions: config.actions || [],
      enabled: config.enabled !== false,
      created: Date.now(),
      lastTriggered: null,
      triggerCount: 0
    };

    this.triggers.set(trigger.id, trigger);

    return { success: true, trigger };
  }

  async updateTrigger(triggerId, updates) {
    const trigger = this.triggers.get(triggerId);
    
    if (!trigger) {
      return { success: false, error: 'Trigger not found' };
    }

    Object.assign(trigger, updates);

    return { success: true, trigger };
  }

  async deleteTrigger(triggerId) {
    this.triggers.delete(triggerId);
    return { success: true };
  }

  // ============================================
  // ANALYTICS & REPORTING
  // ============================================

  getCurrentStatus() {
    const devices = Array.from(this.devices.values());
    const homeZone = this.zones.get('home');

    return {
      devicesTracked: devices.filter(d => d.trackingEnabled).length,
      devicesHome: homeZone.occupants.length,
      devicesAway: devices.filter(d => d.trackingEnabled && !homeZone.occupants.includes(d.id)).length,
      homeOccupied: homeZone.occupants.length > 0,
      allHome: homeZone.occupants.length === devices.filter(d => d.trackingEnabled).length
    };
  }

  getDeviceLocation(deviceId) {
    const device = this.devices.get(deviceId);
    
    if (!device) return null;

    const zoneName = device.currentZone 
      ? this.zones.get(device.currentZone)?.name 
      : 'Borta';

    return {
      device: {
        id: device.id,
        name: device.name,
        owner: device.ownerName
      },
      location: device.currentLocation,
      zone: zoneName,
      zoneId: device.currentZone,
      lastUpdate: device.lastUpdate,
      accuracy: device.accuracy
    };
  }

  getAllDeviceLocations() {
    return Array.from(this.devices.values())
      .filter(d => d.trackingEnabled)
      .map(d => ({
        id: d.id,
        name: d.name,
        owner: d.ownerName,
        zone: d.currentZone ? this.zones.get(d.currentZone)?.name : 'Borta',
        zoneId: d.currentZone,
        lastUpdate: d.lastUpdate
      }));
  }

  getZoneStatus(zoneId) {
    const zone = this.zones.get(zoneId);
    
    if (!zone) return null;

    return {
      id: zone.id,
      name: zone.name,
      type: zone.type,
      occupants: zone.occupants.map(deviceId => {
        const device = this.devices.get(deviceId);
        return {
          deviceId,
          name: device.name,
          owner: device.ownerName
        };
      }),
      occupantCount: zone.occupants.length,
      lastEnter: zone.lastEnter,
      lastExit: zone.lastExit
    };
  }

  getAllZones() {
    return Array.from(this.zones.values()).map(z => ({
      id: z.id,
      name: z.name,
      type: z.type,
      occupantCount: z.occupants.length,
      enabled: z.enabled
    }));
  }

  getRecentEvents(limit = 20) {
    return this.events.slice(-limit).reverse();
  }

  getTriggerStats() {
    const triggers = Array.from(this.triggers.values());
    
    return {
      total: triggers.length,
      enabled: triggers.filter(t => t.enabled).length,
      disabled: triggers.filter(t => !t.enabled).length,
      totalTriggered: triggers.reduce((sum, t) => sum + t.triggerCount, 0),
      mostTriggered: triggers
        .sort((a, b) => b.triggerCount - a.triggerCount)
        .slice(0, 5)
        .map(t => ({
          name: t.name,
          count: t.triggerCount,
          lastTriggered: t.lastTriggered
        }))
    };
  }

  getLocationHistory(deviceId, hours = 24) {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    
    return this.locationHistory
      .filter(l => l.deviceId === deviceId && l.timestamp >= cutoff)
      .map(l => ({
        timestamp: l.timestamp,
        location: l.location,
        zone: this.findZoneForLocation(l.location)
      }));
  }

  // ============================================
  // LOGGING
  // ============================================

  logLocation(data) {
    this.locationHistory.push(data);

    // Keep last 24 hours (at 2-minute intervals = 720 records per device)
    if (this.locationHistory.length > 2160) { // 720 * 3 devices
      this.locationHistory = this.locationHistory.slice(-2160);
    }
  }

  logEvent(event) {
    this.events.push(event);

    // Keep last 500 events
    if (this.events.length > 500) {
      this.events = this.events.slice(-500);
    }
  }
}

module.exports = GeofencingManager;
