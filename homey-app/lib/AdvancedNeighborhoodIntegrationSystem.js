'use strict';

const EventEmitter = require('events');

/**
 * Advanced Neighborhood Integration System
 *
 * Provides community-level smart home integration enabling shared security,
 * energy grid cooperation, event coordination, and emergency communication
 * across a neighborhood network.
 *
 * Features:
 * - Shared security alerts with verified neighbors
 * - Neighborhood energy grid sharing and load balancing
 * - Community event coordination and calendar
 * - Shared tool and equipment lending registry
 * - Local weather station network aggregation
 * - Emergency neighborhood communication channel
 * - Neighborhood-wide energy usage analytics
 * - Anonymous community wellness metrics
 */
class AdvancedNeighborhoodIntegrationSystem extends EventEmitter {
  constructor(homey) {
    super();
    this.homey = homey;
    this.initialized = false;
    this.neighbors = new Map();
    this.securityAlerts = [];
    this.communityEvents = [];
    this.lendingRegistry = new Map();
    this.weatherStations = new Map();
    this.energyGrid = new Map();
    this.emergencyChannel = { active: false, messages: [] };
    this.neighborhoodId = null;
    this.trustedPeers = new Set();
    this.syncInterval = null;
    this.weatherAggregationInterval = null;
    this.energyBalancingInterval = null;
    this.alertCleanupInterval = null;
  }

  /**
   * Initialize the neighborhood integration system
   * @returns {Promise<boolean>}
   */
  async initialize() {
    try {
      if (this.initialized) return true;

      this.homey.log('[AdvancedNeighborhoodIntegrationSystem] Initializing...');

      await this.loadSettings();
      this.initializeSecurityDefaults();
      this.startPeriodicSync();
      this.startWeatherAggregation();
      this.startEnergyBalancing();

      this.initialized = true;
      this.homey.log('[AdvancedNeighborhoodIntegrationSystem] Initialized');
      this.homey.emit('neighborhood:initialized');
      return true;
    } catch (error) {
      this.homey.error(`[AdvancedNeighborhoodIntegrationSystem] Failed to initialize:`, error.message);
    }
  }

  /**
   * Load persisted settings from storage
   */
  async loadSettings() {
    const settings = await this.homey.settings.get('neighborhoodIntegration') || {};

    this.neighborhoodId = settings.neighborhoodId || `nbhd-${Date.now()}`;

    if (settings.neighbors) {
      for (const [id, neighbor] of Object.entries(settings.neighbors)) {
        this.neighbors.set(id, neighbor);
      }
    }
    if (settings.trustedPeers) {
      settings.trustedPeers.forEach(p => this.trustedPeers.add(p));
    }
    if (settings.lendingRegistry) {
      for (const [id, item] of Object.entries(settings.lendingRegistry)) {
        this.lendingRegistry.set(id, item);
      }
    }
    if (settings.weatherStations) {
      for (const [id, station] of Object.entries(settings.weatherStations)) {
        this.weatherStations.set(id, station);
      }
    }
    if (settings.communityEvents) {
      this.communityEvents = settings.communityEvents;
    }
  }

  /**
   * Initialize default security alert preferences
   */
  initializeSecurityDefaults() {
    if (!this.homey.settings._cache) {
      this.securityPreferences = {
        shareAlerts: true,
        receiveAlerts: true,
        alertTypes: ['intrusion', 'fire', 'flood', 'medical', 'suspicious-activity'],
        autoNotify: true,
        shareLocationPrecision: 'block', // exact, block, neighborhood
      };
    }
  }

  /**
   * Register a neighbor in the network
   * @param {object} neighborConfig - Neighbor configuration
   * @returns {object} Neighbor registration
   */
  async registerNeighbor(neighborConfig) {
    const neighbor = {
      id: neighborConfig.id || `neighbor-${Date.now()}`,
      name: neighborConfig.name,
      address: neighborConfig.address || '',
      distance: neighborConfig.distance || null, // meters
      trusted: neighborConfig.trusted || false,
      capabilities: neighborConfig.capabilities || [],
      registeredAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      status: 'active',
    };

    this.neighbors.set(neighbor.id, neighbor);
    if (neighbor.trusted) {
      this.trustedPeers.add(neighbor.id);
    }

    await this._saveSettings();

    this.homey.log(`[AdvancedNeighborhoodIntegrationSystem] Neighbor registered: ${neighbor.name}`);
    this.homey.emit('neighborhood:neighbor-registered', { neighborId: neighbor.id, name: neighbor.name });

    return neighbor;
  }

  /**
   * Broadcast a security alert to the neighborhood
   * @param {object} alert - Security alert details
   * @returns {object} Alert broadcast result
   */
  async broadcastSecurityAlert(alert) {
    const securityAlert = {
      id: `alert-${Date.now()}`,
      type: alert.type || 'suspicious-activity',
      severity: alert.severity || 'medium', // low, medium, high, critical
      message: alert.message,
      location: alert.location || null,
      reportedBy: alert.reportedBy || 'self',
      timestamp: new Date().toISOString(),
      expiresAt: new Date(Date.now() + (alert.expiryHours || 24) * 3600000).toISOString(),
      acknowledged: [],
      status: 'active',
    };

    this.securityAlerts.push(securityAlert);

    // only share with trusted peers
    const recipients = [...this.trustedPeers];

    this.homey.log(`[AdvancedNeighborhoodIntegrationSystem] Security alert broadcast: ${securityAlert.type} (${securityAlert.severity})`);
    this.homey.emit('neighborhood:security-alert', {
      alert: securityAlert,
      recipientCount: recipients.length,
    });

    return { success: true, alert: securityAlert, sentTo: recipients.length };
  }

  /**
   * Share energy data with the neighborhood grid
   * @param {object} energyData - Current energy production/consumption data
   */
  async shareEnergyData(energyData) {
    const entry = {
      id: `energy-${Date.now()}`,
      timestamp: new Date().toISOString(),
      production: energyData.production || 0, // kWh
      consumption: energyData.consumption || 0,
      surplus: (energyData.production || 0) - (energyData.consumption || 0),
      batteryLevel: energyData.batteryLevel || null,
      availableForSharing: energyData.availableForSharing || 0,
      pricePerKwh: energyData.pricePerKwh || null,
    };

    this.energyGrid.set('self', entry);
    await this._saveSettings();

    this.homey.emit('neighborhood:energy-update', entry);

    // check if any neighbor needs energy
    if (entry.surplus > 1) {
      this.homey.emit('neighborhood:energy-surplus', {
        surplus: entry.surplus,
        availableForSharing: entry.availableForSharing,
      });
    }

    return entry;
  }

  /**
   * Create a community event
   * @param {object} eventConfig - Event details
   * @returns {object} Created event
   */
  async createCommunityEvent(eventConfig) {
    const event = {
      id: `event-${Date.now()}`,
      title: eventConfig.title,
      description: eventConfig.description || '',
      type: eventConfig.type || 'social', // social, maintenance, safety, cleanup, meeting
      date: eventConfig.date,
      time: eventConfig.time || '10:00',
      location: eventConfig.location || 'TBD',
      organizer: eventConfig.organizer || 'self',
      attendees: [],
      maxAttendees: eventConfig.maxAttendees || null,
      status: 'upcoming',
      createdAt: new Date().toISOString(),
    };

    this.communityEvents.push(event);
    await this._saveSettings();

    this.homey.log(`[AdvancedNeighborhoodIntegrationSystem] Community event created: ${event.title}`);
    this.homey.emit('neighborhood:event-created', event);

    return event;
  }

  /**
   * Register an item in the shared lending registry
   * @param {object} item - Item to share
   * @returns {object} Registry item
   */
  async registerLendingItem(item) {
    const entry = {
      id: `item-${Date.now()}`,
      name: item.name,
      category: item.category || 'tools', // tools, garden, kitchen, sports, electronics
      description: item.description || '',
      owner: item.owner || 'self',
      available: true,
      borrower: null,
      maxLendDays: item.maxLendDays || 7,
      deposit: item.deposit || 0,
      condition: item.condition || 'good',
      lendHistory: [],
      registeredAt: new Date().toISOString(),
    };

    this.lendingRegistry.set(entry.id, entry);
    await this._saveSettings();

    this.homey.log(`[AdvancedNeighborhoodIntegrationSystem] Lending item registered: ${entry.name}`);
    this.homey.emit('neighborhood:item-registered', entry);

    return entry;
  }

  /**
   * Borrow an item from the lending registry
   * @param {string} itemId - Item identifier
   * @param {string} borrowerId - Borrower identifier
   * @returns {object} Borrowing result
   */
  async borrowItem(itemId, borrowerId) {
    const item = this.lendingRegistry.get(itemId);
    if (!item) return { success: false, error: 'Item not found' };
    if (!item.available) return { success: false, error: 'Item not available' };

    item.available = false;
    item.borrower = borrowerId;
    item.lendHistory.push({
      borrower: borrowerId,
      borrowedAt: new Date().toISOString(),
      dueDate: new Date(Date.now() + item.maxLendDays * 86400000).toISOString(),
      returnedAt: null,
    });

    await this._saveSettings();

    this.homey.emit('neighborhood:item-borrowed', {
      itemId,
      itemName: item.name,
      borrower: borrowerId,
    });

    return { success: true, item, dueDate: item.lendHistory[item.lendHistory.length - 1].dueDate };
  }

  /**
   * Report local weather station data
   * @param {object} weatherData - Weather station reading
   */
  async reportWeatherData(weatherData) {
    const stationId = weatherData.stationId || 'self';

    const reading = {
      stationId,
      timestamp: new Date().toISOString(),
      temperature: weatherData.temperature,
      humidity: weatherData.humidity,
      pressure: weatherData.pressure || null,
      windSpeed: weatherData.windSpeed || null,
      windDirection: weatherData.windDirection || null,
      rainfall: weatherData.rainfall || 0,
      uvIndex: weatherData.uvIndex || null,
    };

    const station = this.weatherStations.get(stationId) || { id: stationId, readings: [] };
    station.lastReading = reading;
    station.readings.push(reading);

    // keep last 288 readings per station (24h at 5min intervals)
    if (station.readings.length > 288) {
      station.readings = station.readings.slice(-288);
    }

    this.weatherStations.set(stationId, station);
    this.homey.emit('neighborhood:weather-update', reading);

    return reading;
  }

  /**
   * Activate emergency communication channel
   * @param {object} emergency - Emergency details
   * @returns {object} Emergency channel status
   */
  async activateEmergencyChannel(emergency) {
    this.emergencyChannel = {
      active: true,
      activatedAt: new Date().toISOString(),
      type: emergency.type || 'general', // general, natural-disaster, security, medical
      description: emergency.description || '',
      activatedBy: emergency.activatedBy || 'self',
      messages: [{
        id: `emsg-${Date.now()}`,
        sender: emergency.activatedBy || 'self',
        text: `EMERGENCY ACTIVATED: ${emergency.description || emergency.type}`,
        timestamp: new Date().toISOString(),
        priority: 'critical',
      }],
    };

    this.homey.log(`[AdvancedNeighborhoodIntegrationSystem] Emergency channel activated: ${emergency.type}`);
    this.homey.emit('neighborhood:emergency-activated', {
      type: emergency.type,
      description: emergency.description,
      neighborCount: this.neighbors.size,
    });

    return { success: true, channel: this.emergencyChannel };
  }

  /**
   * Get aggregated weather data from all neighborhood stations
   * @returns {object} Aggregated weather data
   */
  async getAggregatedWeather() {
    const stations = [...this.weatherStations.values()].filter(s => s.lastReading);
    if (stations.length === 0) return { success: false, error: 'No weather data available' };

    const temps = stations.map(s => s.lastReading.temperature).filter(Boolean);
    const humidities = stations.map(s => s.lastReading.humidity).filter(Boolean);

    return {
      stationCount: stations.length,
      temperature: {
        avg: temps.reduce((a, b) => a + b, 0) / temps.length,
        min: Math.min(...temps),
        max: Math.max(...temps),
      },
      humidity: {
        avg: humidities.reduce((a, b) => a + b, 0) / humidities.length,
        min: Math.min(...humidities),
        max: Math.max(...humidities),
      },
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Start periodic data sync with neighbors
   */
  startPeriodicSync() {
    if (this.syncInterval) clearInterval(this.syncInterval);

    this.syncInterval = setInterval(() => {
      // expire old security alerts
      const now = new Date();
      this.securityAlerts = this.securityAlerts.filter(a => new Date(a.expiresAt) > now);

      // expire old community events
      this.communityEvents = this.communityEvents.filter(e => {
        if (e.status === 'completed' || e.status === 'cancelled') return false;
        const eventDate = new Date(e.date);
        if (eventDate < new Date(now.getTime() - 86400000)) {
          e.status = 'completed';
          return false;
        }
        return true;
      });
    }, 15 * 60 * 1000); // every 15 minutes
  }

  /**
   * Start weather data aggregation
   */
  startWeatherAggregation() {
    if (this.weatherAggregationInterval) clearInterval(this.weatherAggregationInterval);

    this.weatherAggregationInterval = setInterval(async () => {
      if (this.weatherStations.size > 1) {
        const aggregated = await this.getAggregatedWeather();
        this.homey.emit('neighborhood:weather-aggregated', aggregated);
      }
    }, 10 * 60 * 1000); // every 10 minutes
  }

  /**
   * Start energy grid balancing checks
   */
  startEnergyBalancing() {
    if (this.energyBalancingInterval) clearInterval(this.energyBalancingInterval);

    this.energyBalancingInterval = setInterval(() => {
      const selfData = this.energyGrid.get('self');
      if (!selfData) return;

      if (selfData.surplus < -2) {
        this.homey.emit('neighborhood:energy-deficit', {
          deficit: Math.abs(selfData.surplus),
          message: 'Your home is consuming more than producing. Checking neighborhood surplus.',
        });
      }
    }, 5 * 60 * 1000); // every 5 minutes
  }

  /**
   * Get current system status
   * @returns {object} System status
   */
  async getStatus() {
    return {
      initialized: this.initialized,
      neighborhoodId: this.neighborhoodId,
      neighborCount: this.neighbors.size,
      trustedPeerCount: this.trustedPeers.size,
      activeAlerts: this.securityAlerts.filter(a => a.status === 'active').length,
      upcomingEvents: this.communityEvents.filter(e => e.status === 'upcoming').length,
      lendingItemCount: this.lendingRegistry.size,
      weatherStationCount: this.weatherStations.size,
      emergencyChannelActive: this.emergencyChannel.active,
      energyGridParticipants: this.energyGrid.size,
    };
  }

  /**
   * Destroy the system and clean up resources
   */
  destroy() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    if (this.weatherAggregationInterval) {
      clearInterval(this.weatherAggregationInterval);
      this.weatherAggregationInterval = null;
    }
    if (this.energyBalancingInterval) {
      clearInterval(this.energyBalancingInterval);
      this.energyBalancingInterval = null;
    }
    if (this.alertCleanupInterval) {
      clearInterval(this.alertCleanupInterval);
      this.alertCleanupInterval = null;
    }

    this.neighbors.clear();
    this.lendingRegistry.clear();
    this.weatherStations.clear();
    this.energyGrid.clear();
    this.trustedPeers.clear();
    this.securityAlerts = [];
    this.communityEvents = [];
    this.emergencyChannel = { active: false, messages: [] };
    this.initialized = false;

    this.homey.log('[AdvancedNeighborhoodIntegrationSystem] Destroyed');
  }

  // ── Private helpers ──

  async _saveSettings() {
    const data = {
      neighborhoodId: this.neighborhoodId,
      neighbors: Object.fromEntries(this.neighbors),
      trustedPeers: [...this.trustedPeers],
      lendingRegistry: Object.fromEntries(this.lendingRegistry),
      weatherStations: Object.fromEntries(this.weatherStations),
      communityEvents: this.communityEvents,
    };
    await this.homey.settings.set('neighborhoodIntegration', data);
  }
}

module.exports = AdvancedNeighborhoodIntegrationSystem;
