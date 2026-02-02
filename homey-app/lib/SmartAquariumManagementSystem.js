'use strict';

const EventEmitter = require('events');
const Homey = require('homey');

/**
 * Smart Aquarium Management System
 * 
 * Comprehensive aquarium automation with water quality monitoring, feeding schedules,
 * lighting cycles, and fish health tracking.
 * 
 * @extends EventEmitter
 */
class SmartAquariumManagementSystem extends EventEmitter {
  constructor() {
    super();
    
    this.aquariums = new Map();
    this.feedingSchedules = [];
    this.waterTestResults = [];
    this.maintenanceLog = [];
    
    this.settings = {
      autoFeedingEnabled: true,
      autoLightCycle: true,
      alertsEnabled: true,
      waterChangeInterval: 14 // days
    };
    
    this.cache = { data: new Map(), timestamps: new Map(), ttl: 3 * 60 * 1000 };
    this.monitoring = { interval: null, checkInterval: 2 * 60 * 1000, lastCheck: null };
    
    this.initializeDefaultData();
  }
  
  initializeDefaultData() {
    this.aquariums.set('tank-001', {
      id: 'tank-001',
      name: 'Living Room Reef Tank',
      type: 'saltwater',
      volume: 200, // liters
      waterParameters: {
        temperature: 25.5, // °C
        targetTemp: 25.5,
        pH: 8.2,
        targetpH: 8.2,
        salinity: 1.025, // specific gravity
        ammonia: 0, // ppm
        nitrite: 0,
        nitrate: 5,
        phosphate: 0.03
      },
      equipment: {
        heater: { status: 'on', powerRating: 300, temp: 25.5 },
        filter: { status: 'running', type: 'canister', flowRate: 1200 },
        lights: { status: 'on', intensity: 80, spectrum: 'daylight', schedule: 'reef-cycle' },
        wavemaker: { status: 'on', speed: 60 },
        skimmer: { status: 'running', cupLevel: 30 },
        autoFeeder: { status: 'ready', lastFeed: Date.now() - 8 * 60 * 60 * 1000 }
      },
      inhabitants: [
        { id: 'fish-001', species: 'Clownfish', name: 'Nemo', count: 2, health: 'excellent', lastFed: Date.now() - 8 * 60 * 60 * 1000 },
        { id: 'fish-002', species: 'Blue Tang', name: 'Dory', count: 1, health: 'good', lastFed: Date.now() - 8 * 60 * 60 * 1000 },
        { id: 'coral-001', species: 'Hammer Coral', count: 3, health: 'good', placement: 'mid-tank' },
        { id: 'invert-001', species: 'Hermit Crab', count: 5, health: 'good' }
      ],
      lastWaterChange: Date.now() - 7 * 24 * 60 * 60 * 1000,
      lastCleaning: Date.now() - 14 * 24 * 60 * 60 * 1000,
      alerts: []
    });
    
    this.feedingSchedules.push({
      id: 'feed-001',
      tankId: 'tank-001',
      time: '08:00',
      foodType: 'pellets',
      amount: 5, // grams
      days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      enabled: true
    });
    
    this.feedingSchedules.push({
      id: 'feed-002',
      tankId: 'tank-001',
      time: '18:00',
      foodType: 'frozen-food',
      amount: 3,
      days: ['tue', 'thu', 'sat'],
      enabled: true
    });
  }
  
  async initialize() {
    try {
      await this.loadSettings();
      this.startMonitoring();
      
      this.emit('notification', {
        type: 'info',
        priority: 'low',
        title: 'Aquarium System',
        message: `Aquarium system initialized with ${this.aquariums.size} tanks`
      });
      
      return { success: true, tanks: this.aquariums.size };
    } catch (error) {
      this.emit('notification', {
        type: 'error',
        priority: 'high',
        title: 'Aquarium System Error',
        message: `Failed to initialize: ${error.message}`
      });
      throw error;
    }
  }
  
  async feedFish(tankId, options = {}) {
    const tank = this.aquariums.get(tankId);
    if (!tank) throw new Error(`Tank ${tankId} not found`);
    
    const { foodType = 'pellets', amount = 5 } = options;
    
    tank.equipment.autoFeeder.lastFeed = Date.now();
    tank.inhabitants.forEach(inhabitant => {
      if (inhabitant.species.includes('fish')) {
        inhabitant.lastFed = Date.now();
      }
    });
    
    this.emit('notification', {
      type: 'info',
      priority: 'low',
      title: 'Fish Fed',
      message: `${tank.name} - ${amount}g ${foodType} dispensed`
    });
    
    await this.saveSettings();
    return { success: true, tank: tank.name, foodType, amount };
  }
  
  async performWaterTest(tankId, testResults) {
    const tank = this.aquariums.get(tankId);
    if (!tank) throw new Error(`Tank ${tankId} not found`);
    
    Object.assign(tank.waterParameters, testResults);
    
    this.waterTestResults.unshift({
      id: `test-${Date.now()}`,
      tankId,
      timestamp: Date.now(),
      results: testResults
    });
    
    if (this.waterTestResults.length > 100) {
      this.waterTestResults = this.waterTestResults.slice(0, 100);
    }
    
    // Check for alerts
    if (testResults.ammonia > 0.25) {
      this.emit('notification', {
        type: 'error',
        priority: 'critical',
        title: 'High Ammonia',
        message: `${tank.name} - Ammonia: ${testResults.ammonia} ppm (Dangerous!)`
      });
    }
    
    if (testResults.nitrite > 0.5) {
      this.emit('notification', {
        type: 'warning',
        priority: 'high',
        title: 'High Nitrite',
        message: `${tank.name} - Nitrite: ${testResults.nitrite} ppm`
      });
    }
    
    await this.saveSettings();
    this.clearCache();
    
    return { success: true, tank: tank.name, alerts: tank.alerts.length };
  }
  
  getAquariumStatus(tankId) {
    const cached = this.getCached(`tank-${tankId}`);
    if (cached) return cached;
    
    const tank = this.aquariums.get(tankId);
    if (!tank) throw new Error(`Tank ${tankId} not found`);
    
    const status = {
      name: tank.name,
      type: tank.type,
      volume: tank.volume,
      waterParameters: tank.waterParameters,
      equipment: tank.equipment,
      inhabitants: tank.inhabitants.length,
      healthStatus: this.calculateHealthStatus(tank),
      nextWaterChange: tank.lastWaterChange + (this.settings.waterChangeInterval * 24 * 60 * 60 * 1000),
      alerts: tank.alerts
    };
    
    this.setCached(`tank-${tankId}`, status);
    return status;
  }
  
  calculateHealthStatus(tank) {
    const params = tank.waterParameters;
    let issues = 0;
    
    if (params.ammonia > 0.25) issues++;
    if (params.nitrite > 0.5) issues++;
    if (params.nitrate > 40) issues++;
    if (Math.abs(params.temperature - params.targetTemp) > 1) issues++;
    
    if (issues === 0) return 'excellent';
    if (issues === 1) return 'good';
    if (issues === 2) return 'fair';
    return 'poor';
  }
  
  getAquariumStatistics() {
    const tanks = Array.from(this.aquariums.values());
    const totalInhabitants = tanks.reduce((sum, t) => sum + t.inhabitants.length, 0);
    
    return {
      tanks: this.aquariums.size,
      totalInhabitants,
      averageHealth: this.calculateAverageHealth(),
      waterTests: this.waterTestResults.length,
      scheduledFeedings: this.feedingSchedules.filter(f => f.enabled).length
    };
  }
  
  calculateAverageHealth() {
    const tanks = Array.from(this.aquariums.values());
    const healthScores = { excellent: 100, good: 75, fair: 50, poor: 25 };
    const avgScore = tanks.reduce((sum, t) => sum + healthScores[this.calculateHealthStatus(t)], 0) / tanks.length;
    
    if (avgScore >= 90) return 'excellent';
    if (avgScore >= 70) return 'good';
    if (avgScore >= 50) return 'fair';
    return 'poor';
  }
  
  startMonitoring() {
    if (this.monitoring.interval) clearInterval(this.monitoring.interval);
    this.monitoring.interval = setInterval(() => this.monitorTanks(), this.monitoring.checkInterval);
  }
  
  monitorTanks() {
    this.monitoring.lastCheck = Date.now();
    
    for (const [id, tank] of this.aquariums) {
      // Check water change due
      const daysSinceChange = (Date.now() - tank.lastWaterChange) / (24 * 60 * 60 * 1000);
      if (daysSinceChange >= this.settings.waterChangeInterval) {
        this.emit('notification', {
          type: 'warning',
          priority: 'medium',
          title: 'Water Change Due',
          message: `${tank.name} - Water change overdue by ${Math.floor(daysSinceChange - this.settings.waterChangeInterval)} days`
        });
      }
      
      // Check feeding
      for (const inhabitant of tank.inhabitants) {
        if (inhabitant.species.includes('fish') && inhabitant.lastFed) {
          const hoursSinceFed = (Date.now() - inhabitant.lastFed) / (60 * 60 * 1000);
          if (hoursSinceFed > 24) {
            this.emit('notification', {
              type: 'warning',
              priority: 'high',
              title: 'Fish Not Fed',
              message: `${tank.name} - ${inhabitant.name} not fed in 24 hours`
            });
          }
        }
      }
    }
  }
  
  getCached(key) {
    const cached = this.cache.data.get(key);
    const timestamp = this.cache.timestamps.get(key);
    if (cached && timestamp && (Date.now() - timestamp < this.cache.ttl)) return cached;
    return null;
  }
  
  setCached(key, value) {
    this.cache.data.set(key, value);
    this.cache.timestamps.set(key, Date.now());
  }
  
  clearCache() {
    this.cache.data.clear();
    this.cache.timestamps.clear();
  }
  
  async loadSettings() {
    try {
      const settings = Homey.ManagerSettings.get('smartAquariumManagementSystem');
      if (settings) {
        this.aquariums = new Map(settings.aquariums || []);
        this.feedingSchedules = settings.feedingSchedules || [];
        this.waterTestResults = settings.waterTestResults || [];
        this.maintenanceLog = settings.maintenanceLog || [];
        Object.assign(this.settings, settings.settings || {});
      }
    } catch (error) {
      console.error('Failed to load aquarium settings:', error);
    }
  }
  
  async saveSettings() {
    try {
      const settings = {
        aquariums: Array.from(this.aquariums.entries()),
        feedingSchedules: this.feedingSchedules,
        waterTestResults: this.waterTestResults,
        maintenanceLog: this.maintenanceLog,
        settings: this.settings
      };
      Homey.ManagerSettings.set('smartAquariumManagementSystem', settings);
    } catch (error) {
      console.error('Failed to save aquarium settings:', error);
      throw error;
    }
  }
  
  getAquariums() { return Array.from(this.aquariums.values()); }
  getFeedingSchedules() { return this.feedingSchedules; }
  getWaterTestHistory(limit = 20) { return this.waterTestResults.slice(0, limit); }
}

module.exports = SmartAquariumManagementSystem;
