'use strict';

const EventEmitter = require('events');
const Homey = require('homey');

/**
 * Advanced Indoor Plant Care System
 * 
 * Intelligent plant care with automated watering, light optimization, and growth tracking.
 * 
 * @extends EventEmitter
 */
class AdvancedIndoorPlantCareSystem extends EventEmitter {
  constructor() {
    super();
    
    this.plants = new Map();
    this.wateringSchedules = [];
    this.growthLog = [];
    this.careReminders = [];
    
    this.settings = {
      autoWateringEnabled: true,
      lowMoistureThreshold: 30,
      highMoistureThreshold: 70,
      lightAdjustmentEnabled: true,
      fertilizeInterval: 14 // days
    };
    
    this.cache = { data: new Map(), timestamps: new Map(), ttl: 5 * 60 * 1000 };
    this.monitoring = { interval: null, checkInterval: 2 * 60 * 1000, lastCheck: null };
    
    this.initializeDefaultData();
  }
  
  initializeDefaultData() {
    this.plants.set('plant-001', {
      id: 'plant-001',
      name: 'Monstera Deliciosa',
      species: 'Monstera deliciosa',
      location: 'living-room-corner',
      potSize: 30, // cm
      soilMoisture: 45, // %
      lightLevel: 600, // lux
      optimalLight: { min: 400, max: 800 },
      temperature: 22, // °C
      humidity: 60, // %
      lastWatered: Date.now() - 4 * 24 * 60 * 60 * 1000,
      lastFertilized: Date.now() - 20 * 24 * 60 * 60 * 1000,
      wateringFrequency: 7, // days
      health: 'excellent',
      growthStage: 'mature',
      notes: []
    });
    
    this.plants.set('plant-002', {
      id: 'plant-002',
      name: 'Snake Plant',
      species: 'Sansevieria trifasciata',
      location: 'bedroom-windowsill',
      potSize: 20,
      soilMoisture: 25,
      lightLevel: 300,
      optimalLight: { min: 200, max: 600 },
      temperature: 21,
      humidity: 40,
      lastWatered: Date.now() - 10 * 24 * 60 * 60 * 1000,
      lastFertilized: Date.now() - 30 * 24 * 60 * 60 * 1000,
      wateringFrequency: 14,
      health: 'good',
      growthStage: 'mature',
      notes: []
    });
    
    this.plants.set('plant-003', {
      id: 'plant-003',
      name: 'Fiddle Leaf Fig',
      species: 'Ficus lyrata',
      location: 'living-room-window',
      potSize: 40,
      soilMoisture: 50,
      lightLevel: 800,
      optimalLight: { min: 600, max: 1000 },
      temperature: 23,
      humidity: 55,
      lastWatered: Date.now() - 3 * 24 * 60 * 60 * 1000,
      lastFertilized: Date.now() - 10 * 24 * 60 * 60 * 1000,
      wateringFrequency: 7,
      health: 'good',
      growthStage: 'growing',
      notes: ['New leaf sprouting']
    });
    
    this.wateringSchedules.push({
      id: 'schedule-001',
      plantId: 'plant-001',
      dayOfWeek: 'sun',
      time: '09:00',
      amount: 500, // ml
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
        title: 'Plant Care System',
        message: `Plant care system initialized with ${this.plants.size} plants`
      });
      
      return { success: true, plants: this.plants.size };
    } catch (error) {
      this.emit('notification', {
        type: 'error',
        priority: 'high',
        title: 'Plant Care Error',
        message: `Failed to initialize: ${error.message}`
      });
      throw error;
    }
  }
  
  async waterPlant(plantId, amount = 500) {
    const plant = this.plants.get(plantId);
    if (!plant) throw new Error(`Plant ${plantId} not found`);
    
    plant.lastWatered = Date.now();
    plant.soilMoisture = Math.min(100, plant.soilMoisture + 30);
    
    this.growthLog.unshift({
      id: `log-${Date.now()}`,
      plantId,
      type: 'watering',
      amount,
      timestamp: Date.now(),
      moistureBefore: plant.soilMoisture - 30,
      moistureAfter: plant.soilMoisture
    });
    
    if (this.growthLog.length > 200) {
      this.growthLog = this.growthLog.slice(0, 200);
    }
    
    this.emit('notification', {
      type: 'success',
      priority: 'low',
      title: 'Plant Watered',
      message: `${plant.name} watered with ${amount}ml`
    });
    
    await this.saveSettings();
    this.clearCache();
    
    return { success: true, plant: plant.name, moisture: plant.soilMoisture };
  }
  
  async fertilizePlant(plantId) {
    const plant = this.plants.get(plantId);
    if (!plant) throw new Error(`Plant ${plantId} not found`);
    
    plant.lastFertilized = Date.now();
    
    this.growthLog.unshift({
      id: `log-${Date.now()}`,
      plantId,
      type: 'fertilizing',
      timestamp: Date.now()
    });
    
    this.emit('notification', {
      type: 'success',
      priority: 'low',
      title: 'Plant Fertilized',
      message: `${plant.name} has been fertilized`
    });
    
    await this.saveSettings();
    return { success: true, plant: plant.name };
  }
  
  getPlantStatus(plantId) {
    const cached = this.getCached(`plant-${plantId}`);
    if (cached) return cached;
    
    const plant = this.plants.get(plantId);
    if (!plant) throw new Error(`Plant ${plantId} not found`);
    
    const daysSinceWatered = (Date.now() - plant.lastWatered) / (24 * 60 * 60 * 1000);
    const daysSinceFertilized = (Date.now() - plant.lastFertilized) / (24 * 60 * 60 * 1000);
    
    const needsWater = daysSinceWatered >= plant.wateringFrequency || plant.soilMoisture < this.settings.lowMoistureThreshold;
    const needsFertilizer = daysSinceFertilized >= this.settings.fertilizeInterval;
    
    const status = {
      name: plant.name,
      species: plant.species,
      health: plant.health,
      soilMoisture: plant.soilMoisture,
      lightLevel: plant.lightLevel,
      temperature: plant.temperature,
      humidity: plant.humidity,
      needsWater,
      needsFertilizer,
      daysSinceWatered: Math.floor(daysSinceWatered),
      daysSinceFertilized: Math.floor(daysSinceFertilized),
      notes: plant.notes
    };
    
    this.setCached(`plant-${plantId}`, status);
    return status;
  }
  
  getPlantCareStatistics() {
    const cached = this.getCached('plant-stats');
    if (cached) return cached;
    
    const plants = Array.from(this.plants.values());
    const wateringEvents = this.growthLog.filter(l => l.type === 'watering');
    const fertilizingEvents = this.growthLog.filter(l => l.type === 'fertilizing');
    
    const needsWater = plants.filter(p => {
      const daysSince = (Date.now() - p.lastWatered) / (24 * 60 * 60 * 1000);
      return daysSince >= p.wateringFrequency || p.soilMoisture < this.settings.lowMoistureThreshold;
    }).length;
    
    const stats = {
      plants: {
        total: this.plants.size,
        healthy: plants.filter(p => p.health === 'excellent' || p.health === 'good').length,
        needsWater,
        needsFertilizer: plants.filter(p => {
          const daysSince = (Date.now() - p.lastFertilized) / (24 * 60 * 60 * 1000);
          return daysSince >= this.settings.fertilizeInterval;
        }).length
      },
      care: {
        wateringEvents: wateringEvents.length,
        fertilizingEvents: fertilizingEvents.length,
        averageMoisture: plants.length > 0 
          ? Math.round(plants.reduce((sum, p) => sum + p.soilMoisture, 0) / plants.length)
          : 0
      },
      environment: {
        averageLight: plants.length > 0 
          ? Math.round(plants.reduce((sum, p) => sum + p.lightLevel, 0) / plants.length)
          : 0,
        averageTemp: plants.length > 0 
          ? Math.round(plants.reduce((sum, p) => sum + p.temperature, 0) / plants.length)
          : 0
      }
    };
    
    this.setCached('plant-stats', stats);
    return stats;
  }
  
  startMonitoring() {
    if (this.monitoring.interval) clearInterval(this.monitoring.interval);
    this.monitoring.interval = setInterval(() => this.monitorPlants(), this.monitoring.checkInterval);
  }
  
  monitorPlants() {
    this.monitoring.lastCheck = Date.now();
    
    for (const [id, plant] of this.plants) {
      // Simulate moisture decrease over time
      plant.soilMoisture = Math.max(0, plant.soilMoisture - 1);
      
      // Check if watering needed
      const daysSinceWatered = (Date.now() - plant.lastWatered) / (24 * 60 * 60 * 1000);
      if (daysSinceWatered >= plant.wateringFrequency) {
        this.emit('notification', {
          type: 'warning',
          priority: 'medium',
          title: 'Plant Needs Water',
          message: `${plant.name} should be watered (${Math.floor(daysSinceWatered)} days since last watering)`
        });
      }
      
      // Check moisture levels
      if (plant.soilMoisture < this.settings.lowMoistureThreshold) {
        this.emit('notification', {
          type: 'error',
          priority: 'high',
          title: 'Low Soil Moisture',
          message: `${plant.name} - Soil moisture: ${plant.soilMoisture}%`
        });
        
        // Auto-water if enabled
        if (this.settings.autoWateringEnabled) {
          this.waterPlant(id, 500);
        }
      }
      
      // Check fertilizer schedule
      const daysSinceFertilized = (Date.now() - plant.lastFertilized) / (24 * 60 * 60 * 1000);
      if (daysSinceFertilized >= this.settings.fertilizeInterval) {
        this.emit('notification', {
          type: 'info',
          priority: 'low',
          title: 'Fertilizer Reminder',
          message: `${plant.name} should be fertilized`
        });
      }
      
      // Check light levels
      if (plant.lightLevel < plant.optimalLight.min) {
        this.emit('notification', {
          type: 'warning',
          priority: 'medium',
          title: 'Insufficient Light',
          message: `${plant.name} - Light level: ${plant.lightLevel} lux (needs ${plant.optimalLight.min}+)`
        });
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
      const settings = Homey.ManagerSettings.get('advancedIndoorPlantCareSystem');
      if (settings) {
        this.plants = new Map(settings.plants || []);
        this.wateringSchedules = settings.wateringSchedules || [];
        this.growthLog = settings.growthLog || [];
        this.careReminders = settings.careReminders || [];
        Object.assign(this.settings, settings.settings || {});
      }
    } catch (error) {
      console.error('Failed to load plant care settings:', error);
    }
  }
  
  async saveSettings() {
    try {
      const settings = {
        plants: Array.from(this.plants.entries()),
        wateringSchedules: this.wateringSchedules,
        growthLog: this.growthLog,
        careReminders: this.careReminders,
        settings: this.settings
      };
      Homey.ManagerSettings.set('advancedIndoorPlantCareSystem', settings);
    } catch (error) {
      console.error('Failed to save plant care settings:', error);
      throw error;
    }
  }
  
  getPlants() { return Array.from(this.plants.values()); }
  getWateringSchedules() { return this.wateringSchedules; }
  getGrowthLog(limit = 50) { return this.growthLog.slice(0, limit); }
}

module.exports = AdvancedIndoorPlantCareSystem;
