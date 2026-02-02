'use strict';

const EventEmitter = require('events');
const Homey = require('homey');

/**
 * Smart Irrigation & Water Conservation System
 * 
 * Intelligent irrigation scheduling, weather-based optimization, and comprehensive water conservation.
 * 
 * @extends EventEmitter
 */
class SmartIrrigationWaterConservationSystem extends EventEmitter {
  constructor() {
    super();
    
    this.irrigationZones = new Map();
    this.irrigationSchedules = [];
    this.waterUsageHistory = [];
    this.rainSensors = new Map();
    this.soilMoistureSensors = new Map();
    
    this.settings = {
      autoSchedulingEnabled: true,
      weatherIntegrationEnabled: true,
      rainDelayEnabled: true,
      rainDelayHours: 48,
      conservationMode: 'balanced', // aggressive, balanced, comfort
      maxDailyWater: 500, // liters
      cycleSoakEnabled: true
    };
    
    this.weatherData = {
      temperature: 22,
      humidity: 55,
      rainfall: 0, // mm last 24h
      forecast: 'sunny',
      evapotranspiration: 5 // mm/day
    };
    
    this.cache = { data: new Map(), timestamps: new Map(), ttl: 5 * 60 * 1000 };
    this.monitoring = { interval: null, checkInterval: 5 * 60 * 1000, lastCheck: null };
    
    this.initializeDefaultData();
  }
  
  initializeDefaultData() {
    // Irrigation zones
    this.irrigationZones.set('zone-001', {
      id: 'zone-001',
      name: 'Front Lawn',
      type: 'grass',
      area: 50, // m²
      flowRate: 15, // liters/min
      sprinklerType: 'rotary',
      soilType: 'loam',
      sunExposure: 'full',
      plantType: 'cool-season-grass',
      waterRequirement: 25, // mm/week
      status: 'idle',
      lastWatered: Date.now() - 2 * 24 * 60 * 60 * 1000,
      nextScheduled: null,
      efficiency: 0.75
    });
    
    this.irrigationZones.set('zone-002', {
      id: 'zone-002',
      name: 'Back Garden Beds',
      type: 'flower-beds',
      area: 20,
      flowRate: 8,
      sprinklerType: 'drip',
      soilType: 'sandy-loam',
      sunExposure: 'partial',
      plantType: 'perennials',
      waterRequirement: 20,
      status: 'idle',
      lastWatered: Date.now() - 1 * 24 * 60 * 60 * 1000,
      nextScheduled: null,
      efficiency: 0.90
    });
    
    this.irrigationZones.set('zone-003', {
      id: 'zone-003',
      name: 'Vegetable Garden',
      type: 'vegetables',
      area: 15,
      flowRate: 10,
      sprinklerType: 'drip',
      soilType: 'loam',
      sunExposure: 'full',
      plantType: 'vegetables',
      waterRequirement: 30,
      status: 'idle',
      lastWatered: Date.now() - 1 * 24 * 60 * 60 * 1000,
      nextScheduled: null,
      efficiency: 0.95
    });
    
    this.irrigationZones.set('zone-004', {
      id: 'zone-004',
      name: 'Shrubs & Trees',
      type: 'shrubs',
      area: 30,
      flowRate: 12,
      sprinklerType: 'bubbler',
      soilType: 'clay-loam',
      sunExposure: 'mixed',
      plantType: 'shrubs',
      waterRequirement: 15,
      status: 'idle',
      lastWatered: Date.now() - 3 * 24 * 60 * 60 * 1000,
      nextScheduled: null,
      efficiency: 0.85
    });
    
    // Irrigation schedules
    this.irrigationSchedules.push({
      id: 'schedule-001',
      zoneId: 'zone-001',
      name: 'Front Lawn Morning',
      days: ['mon', 'wed', 'fri'],
      startTime: '06:00',
      duration: 20, // minutes
      enabled: true,
      lastRun: Date.now() - 2 * 24 * 60 * 60 * 1000
    });
    
    this.irrigationSchedules.push({
      id: 'schedule-002',
      zoneId: 'zone-002',
      name: 'Garden Beds Evening',
      days: ['tue', 'thu', 'sat'],
      startTime: '20:00',
      duration: 15,
      enabled: true,
      lastRun: Date.now() - 1 * 24 * 60 * 60 * 1000
    });
    
    // Soil moisture sensors
    this.soilMoistureSensors.set('sensor-001', {
      id: 'sensor-001',
      name: 'Front Lawn Sensor',
      zoneId: 'zone-001',
      location: 'front-lawn-center',
      moistureLevel: 45, // %
      temperature: 18, // °C
      batteryLevel: 85,
      status: 'active',
      lastReading: Date.now() - 5 * 60 * 1000
    });
    
    this.soilMoistureSensors.set('sensor-002', {
      id: 'sensor-002',
      name: 'Vegetable Garden Sensor',
      zoneId: 'zone-003',
      location: 'veg-garden',
      moistureLevel: 55,
      temperature: 20,
      batteryLevel: 92,
      status: 'active',
      lastReading: Date.now() - 5 * 60 * 1000
    });
    
    // Rain sensor
    this.rainSensors.set('sensor-rain-001', {
      id: 'sensor-rain-001',
      name: 'Rain Gauge',
      location: 'roof-edge',
      rainfall: 0, // mm today
      isRaining: false,
      status: 'active',
      lastReading: Date.now() - 5 * 60 * 1000
    });
    
    // Water usage history (last 7 days)
    for (let i = 6; i >= 0; i--) {
      this.waterUsageHistory.push({
        date: Date.now() - i * 24 * 60 * 60 * 1000,
        waterUsed: 150 + Math.random() * 200, // liters
        zonesWatered: Math.floor(Math.random() * 3) + 1,
        rainSkipped: Math.random() > 0.7,
        cost: (150 + Math.random() * 200) * 0.015 // SEK @ 0.015 SEK/liter
      });
    }
  }
  
  async initialize() {
    try {
      await this.loadSettings();
      this.startMonitoring();
      
      this.emit('notification', {
        type: 'info',
        priority: 'low',
        title: 'Irrigation System',
        message: `Irrigation system initialized with ${this.irrigationZones.size} zones`
      });
      
      return { success: true, zones: this.irrigationZones.size };
    } catch (error) {
      this.emit('notification', {
        type: 'error',
        priority: 'high',
        title: 'Irrigation System Error',
        message: `Failed to initialize: ${error.message}`
      });
      throw error;
    }
  }
  
  async startIrrigation(zoneId, duration = null) {
    const zone = this.irrigationZones.get(zoneId);
    if (!zone) throw new Error(`Zone ${zoneId} not found`);
    
    if (zone.status === 'watering') {
      throw new Error(`Zone ${zone.name} is already watering`);
    }
    
    // Check rain delay
    if (this.settings.rainDelayEnabled && this.weatherData.rainfall > 5) {
      throw new Error('Rain delay active - skipping irrigation');
    }
    
    // Use calculated duration if not provided
    if (!duration) {
      duration = this.calculateOptimalDuration(zoneId);
    }
    
    zone.status = 'watering';
    zone.lastWatered = Date.now();
    
    const waterUsed = zone.flowRate * duration; // liters
    
    // Simulate irrigation cycle
    setTimeout(async () => {
      await this.stopIrrigation(zoneId, waterUsed);
    }, duration * 60 * 1000);
    
    this.emit('notification', {
      type: 'info',
      priority: 'low',
      title: 'Irrigation Started',
      message: `${zone.name} watering for ${duration} minutes`
    });
    
    await this.saveSettings();
    
    return { success: true, zone: zone.name, duration, waterUsed };
  }
  
  async stopIrrigation(zoneId, waterUsed) {
    const zone = this.irrigationZones.get(zoneId);
    if (!zone) return;
    
    zone.status = 'idle';
    
    // Log water usage
    this.waterUsageHistory.unshift({
      date: Date.now(),
      zoneId,
      zoneName: zone.name,
      waterUsed,
      cost: waterUsed * 0.015
    });
    
    if (this.waterUsageHistory.length > 100) {
      this.waterUsageHistory = this.waterUsageHistory.slice(0, 100);
    }
    
    this.emit('notification', {
      type: 'success',
      priority: 'low',
      title: 'Irrigation Complete',
      message: `${zone.name} watering complete. Used ${Math.round(waterUsed)} liters`
    });
    
    await this.saveSettings();
    this.clearCache();
  }
  
  calculateOptimalDuration(zoneId) {
    const zone = this.irrigationZones.get(zoneId);
    if (!zone) return 15;
    
    // Base duration on water requirement and efficiency
    let baseDuration = (zone.waterRequirement * zone.area) / (zone.flowRate * zone.efficiency) / 7; // Daily requirement
    
    // Adjust for soil moisture if sensor available
    const sensor = Array.from(this.soilMoistureSensors.values()).find(s => s.zoneId === zoneId);
    if (sensor) {
      if (sensor.moistureLevel > 60) {
        baseDuration *= 0.5; // Reduce if soil is moist
      } else if (sensor.moistureLevel < 30) {
        baseDuration *= 1.5; // Increase if soil is dry
      }
    }
    
    // Adjust for weather
    if (this.weatherData.temperature > 30) {
      baseDuration *= 1.2; // Increase for hot weather
    }
    
    // Apply conservation mode
    if (this.settings.conservationMode === 'aggressive') {
      baseDuration *= 0.8;
    } else if (this.settings.conservationMode === 'comfort') {
      baseDuration *= 1.2;
    }
    
    return Math.round(baseDuration);
  }
  
  async optimizeSchedules() {
    if (!this.settings.autoSchedulingEnabled) {
      throw new Error('Auto-scheduling is disabled');
    }
    
    const optimized = [];
    
    for (const schedule of this.irrigationSchedules) {
      const zone = this.irrigationZones.get(schedule.zoneId);
      if (!zone) continue;
      
      // Calculate optimal duration
      const optimalDuration = this.calculateOptimalDuration(schedule.zoneId);
      
      if (Math.abs(schedule.duration - optimalDuration) > 5) {
        schedule.duration = optimalDuration;
        optimized.push({
          zone: zone.name,
          oldDuration: schedule.duration,
          newDuration: optimalDuration
        });
      }
    }
    
    if (optimized.length > 0) {
      this.emit('notification', {
        type: 'info',
        priority: 'low',
        title: 'Schedules Optimized',
        message: `Updated ${optimized.length} irrigation schedules`
      });
    }
    
    await this.saveSettings();
    return { success: true, optimized };
  }
  
  getIrrigationStatistics() {
    const cached = this.getCached('irrigation-stats');
    if (cached) return cached;
    
    const zones = Array.from(this.irrigationZones.values());
    
    // Calculate today's usage
    const today = new Date().toDateString();
    const todayUsage = this.waterUsageHistory.filter(h => {
      return new Date(h.date).toDateString() === today;
    });
    
    const todayWaterUsed = todayUsage.reduce((sum, h) => sum + h.waterUsed, 0);
    const todayCost = todayUsage.reduce((sum, h) => sum + h.cost, 0);
    
    // Calculate weekly usage
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const weekUsage = this.waterUsageHistory.filter(h => h.date > weekAgo);
    const weekWaterUsed = weekUsage.reduce((sum, h) => sum + h.waterUsed, 0);
    
    const stats = {
      zones: {
        total: this.irrigationZones.size,
        active: zones.filter(z => z.status === 'watering').length,
        byType: {
          grass: zones.filter(z => z.type === 'grass').length,
          flowerBeds: zones.filter(z => z.type === 'flower-beds').length,
          vegetables: zones.filter(z => z.type === 'vegetables').length,
          shrubs: zones.filter(z => z.type === 'shrubs').length
        }
      },
      waterUsage: {
        today: Math.round(todayWaterUsed),
        week: Math.round(weekWaterUsed),
        averageDaily: Math.round(weekWaterUsed / 7),
        todayCost: Math.round(todayCost * 100) / 100,
        weekCost: Math.round(weekUsage.reduce((sum, h) => sum + h.cost, 0) * 100) / 100
      },
      schedules: {
        total: this.irrigationSchedules.length,
        enabled: this.irrigationSchedules.filter(s => s.enabled).length,
        rainSkipped: this.waterUsageHistory.filter(h => h.rainSkipped).length
      },
      sensors: {
        soilMoisture: this.soilMoistureSensors.size,
        rain: this.rainSensors.size,
        averageMoisture: this.soilMoistureSensors.size > 0
          ? Math.round(Array.from(this.soilMoistureSensors.values())
              .reduce((sum, s) => sum + s.moistureLevel, 0) / this.soilMoistureSensors.size)
          : 0
      },
      weather: {
        temperature: this.weatherData.temperature,
        rainfall: this.weatherData.rainfall,
        forecast: this.weatherData.forecast
      },
      conservation: {
        mode: this.settings.conservationMode,
        efficiency: Math.round(zones.reduce((sum, z) => sum + z.efficiency, 0) / zones.length * 100),
        rainDelay: this.settings.rainDelayEnabled
      }
    };
    
    this.setCached('irrigation-stats', stats);
    return stats;
  }
  
  startMonitoring() {
    if (this.monitoring.interval) clearInterval(this.monitoring.interval);
    this.monitoring.interval = setInterval(() => this.monitorIrrigation(), this.monitoring.checkInterval);
  }
  
  monitorIrrigation() {
    this.monitoring.lastCheck = Date.now();
    
    // Update soil moisture sensors (simulate slow decrease)
    for (const [id, sensor] of this.soilMoistureSensors) {
      sensor.moistureLevel = Math.max(20, sensor.moistureLevel - 0.5);
      sensor.lastReading = Date.now();
      
      if (sensor.moistureLevel < 30) {
        const zone = this.irrigationZones.get(sensor.zoneId);
        this.emit('notification', {
          type: 'warning',
          priority: 'medium',
          title: 'Low Soil Moisture',
          message: `${zone?.name} moisture at ${Math.round(sensor.moistureLevel)}%`
        });
      }
    }
    
    // Check schedules
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const currentDay = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][now.getDay()];
    
    for (const schedule of this.irrigationSchedules) {
      if (schedule.enabled && schedule.days.includes(currentDay) && schedule.startTime === currentTime) {
        // Skip if rain delay active
        if (this.settings.rainDelayEnabled && this.weatherData.rainfall > 5) {
          this.emit('notification', {
            type: 'info',
            priority: 'low',
            title: 'Irrigation Skipped',
            message: `${schedule.name} skipped due to rain`
          });
          continue;
        }
        
        this.startIrrigation(schedule.zoneId, schedule.duration);
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
      const settings = Homey.ManagerSettings.get('smartIrrigationWaterConservationSystem');
      if (settings) {
        this.irrigationZones = new Map(settings.irrigationZones || []);
        this.irrigationSchedules = settings.irrigationSchedules || [];
        this.waterUsageHistory = settings.waterUsageHistory || [];
        this.rainSensors = new Map(settings.rainSensors || []);
        this.soilMoistureSensors = new Map(settings.soilMoistureSensors || []);
        Object.assign(this.settings, settings.settings || {});
        Object.assign(this.weatherData, settings.weatherData || {});
      }
    } catch (error) {
      console.error('Failed to load irrigation settings:', error);
    }
  }
  
  async saveSettings() {
    try {
      const settings = {
        irrigationZones: Array.from(this.irrigationZones.entries()),
        irrigationSchedules: this.irrigationSchedules,
        waterUsageHistory: this.waterUsageHistory.slice(0, 100),
        rainSensors: Array.from(this.rainSensors.entries()),
        soilMoistureSensors: Array.from(this.soilMoistureSensors.entries()),
        settings: this.settings,
        weatherData: this.weatherData
      };
      Homey.ManagerSettings.set('smartIrrigationWaterConservationSystem', settings);
    } catch (error) {
      console.error('Failed to save irrigation settings:', error);
      throw error;
    }
  }
  
  getIrrigationZones() { return Array.from(this.irrigationZones.values()); }
  getIrrigationSchedules() { return this.irrigationSchedules; }
  getWaterUsageHistory(limit = 30) { return this.waterUsageHistory.slice(0, limit); }
  getSoilMoistureSensors() { return Array.from(this.soilMoistureSensors.values()); }
  getRainSensors() { return Array.from(this.rainSensors.values()); }
}

module.exports = SmartIrrigationWaterConservationSystem;
