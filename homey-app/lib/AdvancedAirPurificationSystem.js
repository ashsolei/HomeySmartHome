const EventEmitter = require('events');

/**
 * Advanced Air Purification System
 * 
 * Provides intelligent air quality monitoring and purification with automated
 * adjustments based on pollutants, allergens, and environmental conditions.
 * 
 * Features:
 * - Real-time air quality monitoring (PM2.5, PM10, VOCs, CO2, allergens)
 * - Automated purifier control based on air quality
 * - Multi-zone air quality management
 * - Filter life tracking and replacement reminders
 * - Integration with HVAC for whole-home purification
 * - Outdoor air quality comparison
 * - Allergen and pollen tracking
 * - Smart scheduling for energy efficiency
 * - Sleep mode with quiet operation
 * - Air quality history and trends
 */
class AdvancedAirPurificationSystem extends EventEmitter {
  constructor(homey) {
    super();
    this.homey = homey;
    this.zones = new Map();
    this.purifiers = new Map();
    this.airQualityHistory = [];
    this.automationRules = [];
    this.monitoringInterval = null;
  }

  async initialize() {
    this.homey.log('Initializing Advanced Air Purification System...');
    
    await this.loadSettings();
    this.initializeDefaultZones();
    this.initializeDefaultPurifiers();
    this.initializeAutomationRules();
    
    this.startMonitoring();
    
    this.homey.log('Advanced Air Purification System initialized successfully');
    return true;
  }

  async loadSettings() {
    const settings = await this.homey.settings.get('advancedAirPurification') || {};
    
    if (settings.zones) {
      settings.zones.forEach(zone => {
        this.zones.set(zone.id, zone);
      });
    }
    
    if (settings.purifiers) {
      settings.purifiers.forEach(purifier => {
        this.purifiers.set(purifier.id, purifier);
      });
    }
    
    this.airQualityHistory = settings.airQualityHistory || [];
    this.automationRules = settings.automationRules || [];
  }

  async saveSettings() {
    const settings = {
      zones: Array.from(this.zones.values()),
      purifiers: Array.from(this.purifiers.values()),
      airQualityHistory: this.airQualityHistory.slice(-1000), // Keep last 1000 readings
      automationRules: this.automationRules
    };
    
    await this.homey.settings.set('advancedAirPurification', settings);
  }

  initializeDefaultZones() {
    if (this.zones.size === 0) {
      this.zones.set('living-room', {
        id: 'living-room',
        name: 'Vardagsrum',
        size: 40, // square meters
        airQuality: {
          overall: 'good',
          aqi: 45, // Air Quality Index 0-500
          pm25: 8, // μg/m³
          pm10: 15,
          voc: 120, // ppb
          co2: 450, // ppm
          humidity: 45, // %
          temperature: 21,
          allergens: 'low',
          pollen: 'low'
        },
        thresholds: {
          aqi: { good: 50, moderate: 100, unhealthy: 150 },
          pm25: { good: 12, moderate: 35, unhealthy: 55 },
          pm10: { good: 25, moderate: 50, unhealthy: 90 },
          voc: { good: 220, moderate: 660, unhealthy: 2200 },
          co2: { good: 600, moderate: 1000, unhealthy: 1500 }
        },
        purifierIds: ['purifier-living'],
        lastUpdate: Date.now()
      });

      this.zones.set('bedroom', {
        id: 'bedroom',
        name: 'Sovrum',
        size: 20,
        airQuality: {
          overall: 'excellent',
          aqi: 35,
          pm25: 5,
          pm10: 10,
          voc: 80,
          co2: 420,
          humidity: 50,
          temperature: 19,
          allergens: 'low',
          pollen: 'low'
        },
        thresholds: {
          aqi: { good: 50, moderate: 100, unhealthy: 150 },
          pm25: { good: 12, moderate: 35, unhealthy: 55 },
          pm10: { good: 25, moderate: 50, unhealthy: 90 },
          voc: { good: 220, moderate: 660, unhealthy: 2200 },
          co2: { good: 600, moderate: 1000, unhealthy: 1500 }
        },
        purifierIds: ['purifier-bedroom'],
        lastUpdate: Date.now()
      });

      this.zones.set('kitchen', {
        id: 'kitchen',
        name: 'Kök',
        size: 15,
        airQuality: {
          overall: 'moderate',
          aqi: 65,
          pm25: 18,
          pm10: 28,
          voc: 280,
          co2: 520,
          humidity: 55,
          temperature: 22,
          allergens: 'low',
          pollen: 'low'
        },
        thresholds: {
          aqi: { good: 50, moderate: 100, unhealthy: 150 },
          pm25: { good: 12, moderate: 35, unhealthy: 55 },
          pm10: { good: 25, moderate: 50, unhealthy: 90 },
          voc: { good: 220, moderate: 660, unhealthy: 2200 },
          co2: { good: 600, moderate: 1000, unhealthy: 1500 }
        },
        purifierIds: ['purifier-kitchen'],
        lastUpdate: Date.now()
      });
    }
  }

  initializeDefaultPurifiers() {
    if (this.purifiers.size === 0) {
      this.purifiers.set('purifier-living', {
        id: 'purifier-living',
        name: 'Luftrenare Vardagsrum',
        zoneId: 'living-room',
        model: 'AirPro 3000',
        status: 'on',
        mode: 'auto', // off, low, medium, high, auto, sleep
        fanSpeed: 60, // %
        capabilities: {
          pm25Sensor: true,
          vocSensor: true,
          co2Sensor: true,
          hepaFilter: true,
          carbonFilter: true,
          uvLight: true,
          ionizer: true,
          humidifier: false
        },
        filters: {
          hepa: {
            type: 'HEPA H13',
            lifespan: 8760, // hours
            used: 2400,
            remaining: 6360,
            efficiency: 99.97,
            lastReplaced: '2024-08-15'
          },
          carbon: {
            type: 'Activated Carbon',
            lifespan: 4380,
            used: 2400,
            remaining: 1980,
            efficiency: 95,
            lastReplaced: '2024-08-15'
          },
          preFilter: {
            type: 'Pre-filter',
            lifespan: 2190,
            used: 1200,
            remaining: 990,
            efficiency: 85,
            lastReplaced: '2024-12-01',
            washable: true
          }
        },
        settings: {
          autoMode: true,
          sleepMode: {
            enabled: true,
            schedule: { from: '22:00', to: '07:00' },
            maxFanSpeed: 30,
            displayOff: true
          },
          uvLight: true,
          ionizer: false
        },
        performance: {
          cadr: 400, // m³/h (Clean Air Delivery Rate)
          noiseLevel: 42, // dB
          powerConsumption: 45 // W
        },
        stats: {
          totalRuntime: 2400,
          totalAirCleaned: 96000, // m³
          pm25Removed: 1250, // mg
          vocRemoved: 850 // mg
        }
      });

      this.purifiers.set('purifier-bedroom', {
        id: 'purifier-bedroom',
        name: 'Luftrenare Sovrum',
        zoneId: 'bedroom',
        model: 'SleepAir 2000',
        status: 'on',
        mode: 'sleep',
        fanSpeed: 25,
        capabilities: {
          pm25Sensor: true,
          vocSensor: true,
          co2Sensor: false,
          hepaFilter: true,
          carbonFilter: true,
          uvLight: false,
          ionizer: true,
          humidifier: false
        },
        filters: {
          hepa: {
            type: 'HEPA H13',
            lifespan: 8760,
            used: 3200,
            remaining: 5560,
            efficiency: 99.97,
            lastReplaced: '2024-06-01'
          },
          carbon: {
            type: 'Activated Carbon',
            lifespan: 4380,
            used: 3200,
            remaining: 1180,
            efficiency: 92,
            lastReplaced: '2024-06-01'
          }
        },
        settings: {
          autoMode: false,
          sleepMode: {
            enabled: true,
            schedule: { from: '21:00', to: '08:00' },
            maxFanSpeed: 25,
            displayOff: true
          },
          uvLight: false,
          ionizer: true
        },
        performance: {
          cadr: 250,
          noiseLevel: 28,
          powerConsumption: 25
        },
        stats: {
          totalRuntime: 3200,
          totalAirCleaned: 80000,
          pm25Removed: 890,
          vocRemoved: 620
        }
      });

      this.purifiers.set('purifier-kitchen', {
        id: 'purifier-kitchen',
        name: 'Luftrenare Kök',
        zoneId: 'kitchen',
        model: 'KitchenPure 1500',
        status: 'on',
        mode: 'high',
        fanSpeed: 80,
        capabilities: {
          pm25Sensor: true,
          vocSensor: true,
          co2Sensor: true,
          hepaFilter: true,
          carbonFilter: true,
          uvLight: false,
          ionizer: false,
          humidifier: false
        },
        filters: {
          hepa: {
            type: 'HEPA H13',
            lifespan: 4380,
            used: 1800,
            remaining: 2580,
            efficiency: 99.95,
            lastReplaced: '2024-10-01'
          },
          carbon: {
            type: 'Activated Carbon Premium',
            lifespan: 2190,
            used: 1800,
            remaining: 390,
            efficiency: 98,
            lastReplaced: '2024-10-01'
          }
        },
        settings: {
          autoMode: true,
          cookingMode: {
            enabled: true,
            triggerVOC: 400,
            duration: 60,
            fanSpeed: 90
          },
          uvLight: false,
          ionizer: false
        },
        performance: {
          cadr: 300,
          noiseLevel: 52,
          powerConsumption: 55
        },
        stats: {
          totalRuntime: 1800,
          totalAirCleaned: 54000,
          pm25Removed: 680,
          vocRemoved: 1200
        }
      });
    }
  }

  initializeAutomationRules() {
    if (this.automationRules.length === 0) {
      this.automationRules = [
        {
          id: 'rule-poor-air-quality',
          name: 'Dålig luftkvalitet',
          enabled: true,
          priority: 10,
          condition: {
            type: 'aqi',
            threshold: 100,
            operator: 'greater'
          },
          action: {
            type: 'set-mode',
            mode: 'high',
            duration: 60,
            notify: true
          }
        },
        {
          id: 'rule-high-pm25',
          name: 'Höga partiklar',
          enabled: true,
          priority: 9,
          condition: {
            type: 'pm25',
            threshold: 35,
            operator: 'greater'
          },
          action: {
            type: 'set-mode',
            mode: 'high',
            duration: 45,
            notify: true
          }
        },
        {
          id: 'rule-high-voc',
          name: 'Höga VOC',
          enabled: true,
          priority: 8,
          condition: {
            type: 'voc',
            threshold: 660,
            operator: 'greater'
          },
          action: {
            type: 'set-mode',
            mode: 'high',
            activateCarbon: true,
            duration: 30,
            notify: true
          }
        },
        {
          id: 'rule-high-co2',
          name: 'Höga CO2-nivåer',
          enabled: true,
          priority: 7,
          condition: {
            type: 'co2',
            threshold: 1000,
            operator: 'greater'
          },
          action: {
            type: 'increase-ventilation',
            fanSpeed: 70,
            notify: true,
            openWindows: true
          }
        },
        {
          id: 'rule-allergy-season',
          name: 'Allergisäsong',
          enabled: true,
          priority: 6,
          condition: {
            type: 'pollen',
            level: 'high'
          },
          action: {
            type: 'allergy-mode',
            mode: 'medium',
            runContinuous: true,
            notify: true
          }
        },
        {
          id: 'rule-sleep-optimization',
          name: 'Sömnoptimering',
          enabled: true,
          priority: 5,
          condition: {
            type: 'time',
            from: '22:00',
            to: '07:00'
          },
          action: {
            type: 'sleep-mode',
            targetAQI: 30,
            maxNoise: 30,
            optimize: true
          }
        }
      ];
    }
  }

  startMonitoring() {
    // Monitor air quality and control purifiers every 2 minutes
    this.monitoringInterval = setInterval(() => {
      this.updateAirQuality();
      this.evaluateAutomationRules();
      this.checkFilterStatus();
      this.optimizePurifierOperation();
    }, 120000);
  }

  async updateAirQuality() {
    for (const zone of this.zones.values()) {
      // Simulate air quality changes
      const aq = zone.airQuality;
      
      // Add some random variation
      aq.pm25 += (Math.random() - 0.5) * 2;
      aq.pm10 += (Math.random() - 0.5) * 3;
      aq.voc += (Math.random() - 0.5) * 20;
      aq.co2 += (Math.random() - 0.5) * 30;
      
      // Ensure values stay within realistic ranges
      aq.pm25 = Math.max(0, Math.min(200, aq.pm25));
      aq.pm10 = Math.max(0, Math.min(300, aq.pm10));
      aq.voc = Math.max(0, Math.min(3000, aq.voc));
      aq.co2 = Math.max(400, Math.min(2000, aq.co2));
      
      // Calculate AQI based on PM2.5 (simplified calculation)
      aq.aqi = this.calculateAQI(aq.pm25);
      
      // Determine overall quality
      aq.overall = this.determineOverallQuality(aq.aqi);
      
      zone.lastUpdate = Date.now();
      
      // Record in history
      this.airQualityHistory.push({
        zoneId: zone.id,
        timestamp: Date.now(),
        aqi: aq.aqi,
        pm25: aq.pm25,
        voc: aq.voc,
        co2: aq.co2
      });
    }
    
    await this.saveSettings();
  }

  calculateAQI(pm25) {
    // Simplified AQI calculation based on PM2.5
    if (pm25 <= 12) return pm25 * 4.17;
    if (pm25 <= 35.4) return 50 + ((pm25 - 12) / 23.4) * 50;
    if (pm25 <= 55.4) return 100 + ((pm25 - 35.4) / 20) * 50;
    if (pm25 <= 150.4) return 150 + ((pm25 - 55.4) / 95) * 100;
    return 250 + ((pm25 - 150.4) / 100) * 100;
  }

  determineOverallQuality(aqi) {
    if (aqi <= 50) return 'excellent';
    if (aqi <= 100) return 'good';
    if (aqi <= 150) return 'moderate';
    if (aqi <= 200) return 'poor';
    if (aqi <= 300) return 'very-poor';
    return 'hazardous';
  }

  async evaluateAutomationRules() {
    for (const rule of this.automationRules) {
      if (!rule.enabled) continue;
      
      for (const zone of this.zones.values()) {
        if (this.checkRuleCondition(rule.condition, zone)) {
          await this.executeRuleAction(rule.action, zone, rule.name);
        }
      }
    }
  }

  checkRuleCondition(condition, zone) {
    const aq = zone.airQuality;
    
    switch (condition.type) {
      case 'aqi':
        return this.compareValue(aq.aqi, condition.threshold, condition.operator);
      case 'pm25':
        return this.compareValue(aq.pm25, condition.threshold, condition.operator);
      case 'pm10':
        return this.compareValue(aq.pm10, condition.threshold, condition.operator);
      case 'voc':
        return this.compareValue(aq.voc, condition.threshold, condition.operator);
      case 'co2':
        return this.compareValue(aq.co2, condition.threshold, condition.operator);
      case 'pollen':
        return aq.pollen === condition.level;
      case 'time':
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        return currentTime >= condition.from && currentTime <= condition.to;
      default:
        return false;
    }
  }

  compareValue(value, threshold, operator) {
    switch (operator) {
      case 'greater': return value > threshold;
      case 'less': return value < threshold;
      case 'equal': return value === threshold;
      default: return false;
    }
  }

  async executeRuleAction(action, zone, ruleName) {
    const purifierIds = zone.purifierIds;
    
    for (const purifierId of purifierIds) {
      const purifier = this.purifiers.get(purifierId);
      if (!purifier || purifier.status === 'off') continue;
      
      switch (action.type) {
        case 'set-mode':
          await this.setPurifierMode(purifierId, action.mode);
          break;
        case 'increase-ventilation':
          await this.setPurifierFanSpeed(purifierId, action.fanSpeed);
          break;
        case 'allergy-mode':
          await this.activateAllergyMode(purifierId);
          break;
        case 'sleep-mode':
          await this.activateSleepMode(purifierId);
          break;
      }
    }
    
    if (action.notify) {
      this.emit('notification', {
        title: 'Luftrening aktiverad',
        message: `${ruleName} i ${zone.name}`,
        priority: 'normal',
        category: 'air-quality'
      });
    }
  }

  async checkFilterStatus() {
    for (const purifier of this.purifiers.values()) {
      for (const [filterType, filter] of Object.entries(purifier.filters)) {
        const percentRemaining = (filter.remaining / filter.lifespan) * 100;
        
        if (percentRemaining <= 10 && !filter.replacementNotified) {
          filter.replacementNotified = true;
          await this.notifyFilterReplacement(purifier, filterType, percentRemaining);
        }
      }
    }
    
    await this.saveSettings();
  }

  async notifyFilterReplacement(purifier, filterType, percentRemaining) {
    this.emit('notification', {
      title: 'Filter behöver bytas',
      message: `${purifier.name}: ${filterType} filter ${Math.round(percentRemaining)}% kvar`,
      priority: 'high',
      category: 'maintenance'
    });
  }

  async optimizePurifierOperation() {
    for (const purifier of this.purifiers.values()) {
      if (!purifier.settings.autoMode || purifier.status === 'off') continue;
      
      const zone = this.zones.get(purifier.zoneId);
      if (!zone) continue;
      
      const aqi = zone.airQuality.aqi;
      
      // Determine optimal mode based on AQI
      let optimalMode = 'low';
      if (aqi > 150) {
        optimalMode = 'high';
      } else if (aqi > 100) {
        optimalMode = 'medium';
      } else if (aqi > 50) {
        optimalMode = 'low';
      } else {
        optimalMode = 'low';
      }
      
      // Check if in sleep mode time
      if (purifier.settings.sleepMode.enabled) {
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const { from, to } = purifier.settings.sleepMode.schedule;
        
        if (currentTime >= from || currentTime <= to) {
          optimalMode = 'sleep';
        }
      }
      
      if (purifier.mode !== optimalMode) {
        await this.setPurifierMode(purifier.id, optimalMode);
      }
    }
  }

  async setPurifierMode(purifierId, mode) {
    const purifier = this.purifiers.get(purifierId);
    if (!purifier) {
      throw new Error('Luftrenare hittades inte');
    }
    
    purifier.mode = mode;
    
    // Set fan speed based on mode
    const speedMap = {
      'off': 0,
      'sleep': 25,
      'low': 40,
      'medium': 60,
      'high': 80,
      'auto': 60
    };
    
    purifier.fanSpeed = speedMap[mode] || 50;
    
    await this.saveSettings();
    
    this.emit('purifierModeChanged', { purifierId, mode, fanSpeed: purifier.fanSpeed });
    
    return purifier;
  }

  async setPurifierFanSpeed(purifierId, speed) {
    const purifier = this.purifiers.get(purifierId);
    if (!purifier) {
      throw new Error('Luftrenare hittades inte');
    }
    
    purifier.fanSpeed = Math.max(0, Math.min(100, speed));
    purifier.mode = 'manual';
    
    await this.saveSettings();
    
    return purifier;
  }

  async activateAllergyMode(purifierId) {
    const purifier = this.purifiers.get(purifierId);
    if (!purifier) return;
    
    purifier.mode = 'medium';
    purifier.fanSpeed = 60;
    
    if (purifier.capabilities.ionizer) {
      purifier.settings.ionizer = true;
    }
    
    await this.saveSettings();
  }

  async activateSleepMode(purifierId) {
    const purifier = this.purifiers.get(purifierId);
    if (!purifier) return;
    
    purifier.mode = 'sleep';
    purifier.fanSpeed = purifier.settings.sleepMode.maxFanSpeed || 25;
    
    await this.saveSettings();
  }

  async replaceFilter(purifierId, filterType) {
    const purifier = this.purifiers.get(purifierId);
    if (!purifier) {
      throw new Error('Luftrenare hittades inte');
    }
    
    const filter = purifier.filters[filterType];
    if (!filter) {
      throw new Error('Filter hittades inte');
    }
    
    filter.used = 0;
    filter.remaining = filter.lifespan;
    filter.lastReplaced = new Date().toISOString().split('T')[0];
    filter.replacementNotified = false;
    
    await this.saveSettings();
    
    this.emit('notification', {
      title: 'Filter bytt',
      message: `${purifier.name}: ${filterType} filter bytt`,
      priority: 'low',
      category: 'maintenance'
    });
    
    return purifier;
  }

  getZones() {
    return Array.from(this.zones.values());
  }

  getZone(zoneId) {
    return this.zones.get(zoneId);
  }

  getPurifiers() {
    return Array.from(this.purifiers.values());
  }

  getPurifier(purifierId) {
    return this.purifiers.get(purifierId);
  }

  getAirQualityHistory(zoneId = null, hours = 24) {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    let history = this.airQualityHistory.filter(h => h.timestamp >= cutoff);
    
    if (zoneId) {
      history = history.filter(h => h.zoneId === zoneId);
    }
    
    return history;
  }

  getStats() {
    const zones = Array.from(this.zones.values());
    const purifiers = Array.from(this.purifiers.values());
    
    const avgAQI = Math.round(
      zones.reduce((sum, z) => sum + z.airQuality.aqi, 0) / zones.length
    );
    
    return {
      zones: zones.length,
      purifiers: purifiers.length,
      activePurifiers: purifiers.filter(p => p.status === 'on').length,
      averageAQI: avgAQI,
      overallQuality: this.determineOverallQuality(avgAQI),
      totalAirCleaned: purifiers.reduce((sum, p) => sum + p.stats.totalAirCleaned, 0),
      filtersDueReplacement: this.getFiltersDueReplacement().length,
      byZone: zones.map(z => ({
        name: z.name,
        aqi: z.airQuality.aqi,
        quality: z.airQuality.overall
      }))
    };
  }

  getFiltersDueReplacement() {
    const filters = [];
    
    for (const purifier of this.purifiers.values()) {
      for (const [filterType, filter] of Object.entries(purifier.filters)) {
        const percentRemaining = (filter.remaining / filter.lifespan) * 100;
        if (percentRemaining <= 20) {
          filters.push({
            purifierId: purifier.id,
            purifierName: purifier.name,
            filterType,
            percentRemaining: Math.round(percentRemaining),
            hoursRemaining: filter.remaining
          });
        }
      }
    }
    
    return filters;
  }

  async destroy() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    this.removeAllListeners();
  }
}

module.exports = AdvancedAirPurificationSystem;
