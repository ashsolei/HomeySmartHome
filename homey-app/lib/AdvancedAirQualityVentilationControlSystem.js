'use strict';

const EventEmitter = require('events');
const Homey = require('homey');

/**
 * Advanced Air Quality & Ventilation Control System
 * 
 * Comprehensive air quality monitoring, intelligent ventilation control, and air purification automation.
 * 
 * @extends EventEmitter
 */
class AdvancedAirQualityVentilationControlSystem extends EventEmitter {
  constructor() {
    super();
    
    this.airQualitySensors = new Map();
    this.ventilationUnits = new Map();
    this.airPurifiers = new Map();
    this.airQualityHistory = [];
    this.ventilationSchedules = [];
    
    this.settings = {
      autoVentilationEnabled: true,
      co2Threshold: 1000, // ppm
      pm25Threshold: 35, // µg/m³
      vocThreshold: 500, // ppb
      temperatureControl: true,
      energySavingMode: false,
      nightModeEnabled: true,
      outdoorAirQualityMonitoring: true
    };
    
    this.currentAirQuality = {
      overallRating: 'good', // excellent, good, moderate, poor, hazardous
      co2: 450,
      pm25: 12,
      pm10: 20,
      voc: 150,
      temperature: 22,
      humidity: 45,
      recommendation: 'No action needed'
    };
    
    this.cache = { data: new Map(), timestamps: new Map(), ttl: 3 * 60 * 1000 };
    this.monitoring = { interval: null, checkInterval: 2 * 60 * 1000, lastCheck: null };
    
    this.initializeDefaultData();
  }
  
  initializeDefaultData() {
    // Air quality sensors
    this.airQualitySensors.set('sensor-001', {
      id: 'sensor-001',
      name: 'Living Room Air Monitor',
      location: 'living-room',
      type: 'multi-sensor',
      measurements: {
        co2: 650, // ppm
        pm25: 15, // µg/m³
        pm10: 25,
        voc: 200, // ppb
        temperature: 22,
        humidity: 48,
        pressure: 1013 // hPa
      },
      status: 'active',
      batteryLevel: 85,
      lastReading: Date.now() - 2 * 60 * 1000,
      calibrationDate: Date.now() - 90 * 24 * 60 * 60 * 1000
    });
    
    this.airQualitySensors.set('sensor-002', {
      id: 'sensor-002',
      name: 'Bedroom Air Monitor',
      location: 'bedroom',
      type: 'multi-sensor',
      measurements: {
        co2: 850,
        pm25: 18,
        pm10: 28,
        voc: 250,
        temperature: 20,
        humidity: 52,
        pressure: 1013
      },
      status: 'active',
      batteryLevel: 78,
      lastReading: Date.now() - 2 * 60 * 1000,
      calibrationDate: Date.now() - 60 * 24 * 60 * 60 * 1000
    });
    
    this.airQualitySensors.set('sensor-003', {
      id: 'sensor-003',
      name: 'Kitchen Air Monitor',
      location: 'kitchen',
      type: 'multi-sensor',
      measurements: {
        co2: 720,
        pm25: 32, // Higher due to cooking
        pm10: 45,
        voc: 350,
        temperature: 24,
        humidity: 60,
        pressure: 1013
      },
      status: 'active',
      batteryLevel: 92,
      lastReading: Date.now() - 2 * 60 * 1000,
      calibrationDate: Date.now() - 30 * 24 * 60 * 60 * 1000
    });
    
    // Ventilation units
    this.ventilationUnits.set('unit-001', {
      id: 'unit-001',
      name: 'Main HRV System',
      type: 'heat-recovery-ventilator',
      location: 'basement',
      status: 'running',
      mode: 'auto', // auto, manual, off
      speed: 60, // %
      airflow: 250, // m³/h
      heatRecoveryEfficiency: 85, // %
      filterStatus: 'good',
      filterAge: 45, // days
      filterLifespan: 180,
      powerConsumption: 45, // W
      zones: ['living-room', 'bedroom', 'kitchen', 'bathroom']
    });
    
    this.ventilationUnits.set('unit-002', {
      id: 'unit-002',
      name: 'Kitchen Exhaust Fan',
      type: 'exhaust-fan',
      location: 'kitchen',
      status: 'off',
      mode: 'manual',
      speed: 0,
      airflow: 0,
      maxAirflow: 400,
      powerConsumption: 0
    });
    
    // Air purifiers
    this.airPurifiers.set('purifier-001', {
      id: 'purifier-001',
      name: 'Living Room Air Purifier',
      location: 'living-room',
      model: 'Dyson Pure Cool',
      status: 'running',
      mode: 'auto',
      speed: 4,
      maxSpeed: 10,
      coverage: 40, // m²
      filterType: 'HEPA+Carbon',
      filterLife: 65, // %
      powerConsumption: 40, // W
      measurements: {
        pm25: 12,
        pm10: 20,
        voc: 180
      }
    });
    
    this.airPurifiers.set('purifier-002', {
      id: 'purifier-002',
      name: 'Bedroom Air Purifier',
      location: 'bedroom',
      model: 'Philips Series 3000i',
      status: 'running',
      mode: 'sleep',
      speed: 1,
      maxSpeed: 3,
      coverage: 20,
      filterType: 'HEPA',
      filterLife: 82,
      powerConsumption: 10
    });
    
    // Ventilation schedules
    this.ventilationSchedules.push({
      id: 'schedule-001',
      name: 'Morning Boost',
      unitId: 'unit-001',
      days: ['mon', 'tue', 'wed', 'thu', 'fri'],
      startTime: '07:00',
      duration: 30,
      speed: 80,
      enabled: true
    });
    
    this.ventilationSchedules.push({
      id: 'schedule-002',
      name: 'Night Mode',
      unitId: 'unit-001',
      days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      startTime: '22:00',
      duration: 480, // 8 hours
      speed: 40,
      enabled: true
    });
    
    // Air quality history (last 24 hours)
    const now = Date.now();
    for (let i = 23; i >= 0; i--) {
      this.airQualityHistory.push({
        timestamp: now - i * 60 * 60 * 1000,
        co2: 400 + Math.random() * 400,
        pm25: 10 + Math.random() * 20,
        voc: 100 + Math.random() * 300,
        temperature: 20 + Math.random() * 4,
        humidity: 40 + Math.random() * 20
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
        title: 'Air Quality System',
        message: `Air quality system initialized with ${this.airQualitySensors.size} sensors`
      });
      
      return { success: true, sensors: this.airQualitySensors.size };
    } catch (error) {
      this.emit('notification', {
        type: 'error',
        priority: 'high',
        title: 'Air Quality Error',
        message: `Failed to initialize: ${error.message}`
      });
      throw error;
    }
  }
  
  async optimizeVentilation() {
    if (!this.settings.autoVentilationEnabled) {
      throw new Error('Auto-ventilation is disabled');
    }
    
    const sensors = Array.from(this.airQualitySensors.values());
    const avgCO2 = sensors.reduce((sum, s) => sum + s.measurements.co2, 0) / sensors.length;
    const avgPM25 = sensors.reduce((sum, s) => sum + s.measurements.pm25, 0) / sensors.length;
    const avgVOC = sensors.reduce((sum, s) => sum + s.measurements.voc, 0) / sensors.length;
    
    const hrv = this.ventilationUnits.get('unit-001');
    if (!hrv) return { success: false, reason: 'No ventilation unit found' };
    
    let recommendedSpeed = 50; // Default
    
    // Adjust speed based on air quality
    if (avgCO2 > this.settings.co2Threshold) {
      recommendedSpeed = 80;
    } else if (avgCO2 > 800) {
      recommendedSpeed = 70;
    } else if (avgCO2 < 600) {
      recommendedSpeed = 40;
    }
    
    if (avgPM25 > this.settings.pm25Threshold) {
      recommendedSpeed = Math.max(recommendedSpeed, 75);
    }
    
    if (avgVOC > this.settings.vocThreshold) {
      recommendedSpeed = Math.max(recommendedSpeed, 70);
    }
    
    // Apply energy saving mode
    if (this.settings.energySavingMode && recommendedSpeed < 60) {
      recommendedSpeed = Math.max(30, recommendedSpeed - 10);
    }
    
    // Apply night mode
    const hour = new Date().getHours();
    if (this.settings.nightModeEnabled && hour >= 22 || hour < 7) {
      recommendedSpeed = Math.min(recommendedSpeed, 50);
    }
    
    hrv.speed = recommendedSpeed;
    hrv.airflow = Math.round((recommendedSpeed / 100) * 350); // Max 350 m³/h
    hrv.powerConsumption = Math.round(20 + (recommendedSpeed / 100) * 60); // 20-80W
    
    await this.saveSettings();
    this.clearCache();
    
    return {
      success: true,
      speed: recommendedSpeed,
      airflow: hrv.airflow,
      reason: `CO2: ${Math.round(avgCO2)}ppm, PM2.5: ${Math.round(avgPM25)}µg/m³`
    };
  }
  
  async setVentilationSpeed(unitId, speed) {
    const unit = this.ventilationUnits.get(unitId);
    if (!unit) throw new Error(`Unit ${unitId} not found`);
    
    speed = Math.max(0, Math.min(100, speed));
    unit.speed = speed;
    unit.mode = 'manual';
    
    if (unit.type === 'heat-recovery-ventilator') {
      unit.airflow = Math.round((speed / 100) * 350);
      unit.powerConsumption = Math.round(20 + (speed / 100) * 60);
    } else if (unit.type === 'exhaust-fan') {
      unit.airflow = Math.round((speed / 100) * unit.maxAirflow);
    }
    
    unit.status = speed > 0 ? 'running' : 'off';
    
    this.emit('notification', {
      type: 'info',
      priority: 'low',
      title: 'Ventilation Adjusted',
      message: `${unit.name} set to ${speed}%`
    });
    
    await this.saveSettings();
    return { success: true, unit: unit.name, speed };
  }
  
  async setAirPurifierMode(purifierId, mode) {
    const purifier = this.airPurifiers.get(purifierId);
    if (!purifier) throw new Error(`Purifier ${purifierId} not found`);
    
    const validModes = ['auto', 'manual', 'sleep', 'turbo'];
    if (!validModes.includes(mode)) {
      throw new Error(`Invalid mode. Must be one of: ${validModes.join(', ')}`);
    }
    
    purifier.mode = mode;
    
    // Adjust speed based on mode
    switch (mode) {
      case 'auto':
        purifier.speed = 4;
        purifier.powerConsumption = 40;
        break;
      case 'sleep':
        purifier.speed = 1;
        purifier.powerConsumption = 10;
        break;
      case 'turbo':
        purifier.speed = purifier.maxSpeed;
        purifier.powerConsumption = 65;
        break;
    }
    
    await this.saveSettings();
    return { success: true, purifier: purifier.name, mode };
  }
  
  calculateAirQualityIndex() {
    const sensors = Array.from(this.airQualitySensors.values());
    if (sensors.length === 0) return { index: 0, rating: 'unknown' };
    
    const avgCO2 = sensors.reduce((sum, s) => sum + s.measurements.co2, 0) / sensors.length;
    const avgPM25 = sensors.reduce((sum, s) => sum + s.measurements.pm25, 0) / sensors.length;
    const avgVOC = sensors.reduce((sum, s) => sum + s.measurements.voc, 0) / sensors.length;
    
    // Calculate sub-indices (0-100 scale, higher is worse)
    const co2Index = Math.min(100, (avgCO2 / 2000) * 100);
    const pm25Index = Math.min(100, (avgPM25 / 100) * 100);
    const vocIndex = Math.min(100, (avgVOC / 1000) * 100);
    
    // Overall index (weighted average)
    const overallIndex = (co2Index * 0.4 + pm25Index * 0.4 + vocIndex * 0.2);
    
    // Invert scale (100 is best)
    const aqi = Math.round(100 - overallIndex);
    
    let rating, recommendation;
    if (aqi >= 90) {
      rating = 'excellent';
      recommendation = 'Air quality is excellent';
    } else if (aqi >= 70) {
      rating = 'good';
      recommendation = 'Air quality is good';
    } else if (aqi >= 50) {
      rating = 'moderate';
      recommendation = 'Consider increasing ventilation';
    } else if (aqi >= 30) {
      rating = 'poor';
      recommendation = 'Increase ventilation and use air purifiers';
    } else {
      rating = 'hazardous';
      recommendation = 'URGENT: Open windows and maximize ventilation';
    }
    
    this.currentAirQuality = {
      overallRating: rating,
      co2: Math.round(avgCO2),
      pm25: Math.round(avgPM25),
      pm10: Math.round(sensors.reduce((sum, s) => sum + s.measurements.pm10, 0) / sensors.length),
      voc: Math.round(avgVOC),
      temperature: Math.round(sensors.reduce((sum, s) => sum + s.measurements.temperature, 0) / sensors.length),
      humidity: Math.round(sensors.reduce((sum, s) => sum + s.measurements.humidity, 0) / sensors.length),
      index: aqi,
      recommendation
    };
    
    return { index: aqi, rating, recommendation };
  }
  
  getAirQualityStatistics() {
    const cached = this.getCached('air-quality-stats');
    if (cached) return cached;
    
    const sensors = Array.from(this.airQualitySensors.values());
    const ventUnits = Array.from(this.ventilationUnits.values());
    const purifiers = Array.from(this.airPurifiers.values());
    
    const aqi = this.calculateAirQualityIndex();
    
    // Calculate 24h averages from history
    const last24h = this.airQualityHistory.slice(-24);
    const avgCO2_24h = last24h.reduce((sum, h) => sum + h.co2, 0) / last24h.length;
    const avgPM25_24h = last24h.reduce((sum, h) => sum + h.pm25, 0) / last24h.length;
    
    const stats = {
      current: {
        airQualityIndex: aqi.index,
        rating: aqi.rating,
        co2: this.currentAirQuality.co2,
        pm25: this.currentAirQuality.pm25,
        voc: this.currentAirQuality.voc,
        temperature: this.currentAirQuality.temperature,
        humidity: this.currentAirQuality.humidity,
        recommendation: aqi.recommendation
      },
      averages24h: {
        co2: Math.round(avgCO2_24h),
        pm25: Math.round(avgPM25_24h * 10) / 10
      },
      sensors: {
        total: sensors.length,
        active: sensors.filter(s => s.status === 'active').length,
        needsCalibration: sensors.filter(s => {
          const daysSinceCalibration = (Date.now() - s.calibrationDate) / (24 * 60 * 60 * 1000);
          return daysSinceCalibration > 180;
        }).length
      },
      ventilation: {
        units: ventUnits.length,
        running: ventUnits.filter(u => u.status === 'running').length,
        totalAirflow: ventUnits.reduce((sum, u) => sum + (u.airflow || 0), 0),
        powerConsumption: ventUnits.reduce((sum, u) => sum + (u.powerConsumption || 0), 0)
      },
      purifiers: {
        total: purifiers.length,
        running: purifiers.filter(p => p.status === 'running').length,
        averageFilterLife: purifiers.reduce((sum, p) => sum + p.filterLife, 0) / purifiers.length
      },
      thresholds: {
        co2: this.settings.co2Threshold,
        pm25: this.settings.pm25Threshold,
        voc: this.settings.vocThreshold
      }
    };
    
    this.setCached('air-quality-stats', stats);
    return stats;
  }
  
  startMonitoring() {
    if (this.monitoring.interval) clearInterval(this.monitoring.interval);
    this.monitoring.interval = setInterval(() => this.monitorAirQuality(), this.monitoring.checkInterval);
  }
  
  monitorAirQuality() {
    this.monitoring.lastCheck = Date.now();
    
    // Update sensor readings (simulate small changes)
    for (const [id, sensor] of this.airQualitySensors) {
      sensor.measurements.co2 += (Math.random() - 0.5) * 50;
      sensor.measurements.pm25 += (Math.random() - 0.5) * 5;
      sensor.measurements.voc += (Math.random() - 0.5) * 30;
      sensor.lastReading = Date.now();
      
      // Keep values in realistic ranges
      sensor.measurements.co2 = Math.max(400, Math.min(2000, sensor.measurements.co2));
      sensor.measurements.pm25 = Math.max(5, Math.min(100, sensor.measurements.pm25));
      sensor.measurements.voc = Math.max(50, Math.min(1000, sensor.measurements.voc));
    }
    
    // Calculate AQI and check thresholds
    const aqi = this.calculateAirQualityIndex();
    
    if (this.currentAirQuality.co2 > this.settings.co2Threshold) {
      this.emit('notification', {
        type: 'warning',
        priority: 'high',
        title: 'High CO2 Level',
        message: `CO2 at ${this.currentAirQuality.co2}ppm (threshold: ${this.settings.co2Threshold}ppm)`
      });
    }
    
    if (this.currentAirQuality.pm25 > this.settings.pm25Threshold) {
      this.emit('notification', {
        type: 'warning',
        priority: 'high',
        title: 'High Particle Level',
        message: `PM2.5 at ${this.currentAirQuality.pm25}µg/m³ (threshold: ${this.settings.pm25Threshold}µg/m³)`
      });
    }
    
    // Auto-optimize if enabled
    if (this.settings.autoVentilationEnabled) {
      this.optimizeVentilation();
    }
    
    // Log to history
    this.airQualityHistory.push({
      timestamp: Date.now(),
      co2: this.currentAirQuality.co2,
      pm25: this.currentAirQuality.pm25,
      voc: this.currentAirQuality.voc,
      temperature: this.currentAirQuality.temperature,
      humidity: this.currentAirQuality.humidity
    });
    
    // Keep only last 24 hours
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    this.airQualityHistory = this.airQualityHistory.filter(h => h.timestamp > dayAgo);
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
      const settings = Homey.ManagerSettings.get('advancedAirQualityVentilationControlSystem');
      if (settings) {
        this.airQualitySensors = new Map(settings.airQualitySensors || []);
        this.ventilationUnits = new Map(settings.ventilationUnits || []);
        this.airPurifiers = new Map(settings.airPurifiers || []);
        this.airQualityHistory = settings.airQualityHistory || [];
        this.ventilationSchedules = settings.ventilationSchedules || [];
        Object.assign(this.settings, settings.settings || {});
        Object.assign(this.currentAirQuality, settings.currentAirQuality || {});
      }
    } catch (error) {
      console.error('Failed to load air quality settings:', error);
    }
  }
  
  async saveSettings() {
    try {
      const settings = {
        airQualitySensors: Array.from(this.airQualitySensors.entries()),
        ventilationUnits: Array.from(this.ventilationUnits.entries()),
        airPurifiers: Array.from(this.airPurifiers.entries()),
        airQualityHistory: this.airQualityHistory.slice(-100),
        ventilationSchedules: this.ventilationSchedules,
        settings: this.settings,
        currentAirQuality: this.currentAirQuality
      };
      Homey.ManagerSettings.set('advancedAirQualityVentilationControlSystem', settings);
    } catch (error) {
      console.error('Failed to save air quality settings:', error);
      throw error;
    }
  }
  
  getAirQualitySensors() { return Array.from(this.airQualitySensors.values()); }
  getVentilationUnits() { return Array.from(this.ventilationUnits.values()); }
  getAirPurifiers() { return Array.from(this.airPurifiers.values()); }
  getAirQualityHistory(limit = 24) { return this.airQualityHistory.slice(-limit); }
  getCurrentAirQuality() { return this.currentAirQuality; }
}

module.exports = AdvancedAirQualityVentilationControlSystem;
