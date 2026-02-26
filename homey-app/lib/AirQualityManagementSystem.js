'use strict';

/**
 * Air Quality Management System
 * Monitor and optimize indoor air quality for health and comfort
 */
class AirQualityManagementSystem {
  constructor(homey) {
    this.homey = homey;
    this.airQualitySensors = new Map();
    this.purifiers = new Map();
    this.ventilationSystems = new Map();
    this.qualityHistory = [];
    this.alerts = [];
    this.automationRules = new Map();
  }

  async initialize() {
    try {
      this.log('Initializing Air Quality Management System...');

      // Load saved data
      const savedRules = await this.homey.settings.get('airQualityRules') || {};
      Object.entries(savedRules).forEach(([id, rule]) => {
        this.automationRules.set(id, rule);
      });

      // Discover air quality devices
      await this.discoverAirQualityDevices();

      // Setup default automation rules
      await this.setupDefaultAutomationRules();

      // Start monitoring
      await this.startMonitoring();

      this.log('Air Quality Management System initialized');
    } catch (error) {
      console.error(`[AirQualityManagementSystem] Failed to initialize:`, error.message);
    }
  }

  /**
   * Discover air quality devices
   */
  async discoverAirQualityDevices() {
    const devices = this.homey.drivers.getDevices();
    
    for (const device of devices) {
      const name = device.name.toLowerCase();
      
      // Air quality sensors
      if (device.hasCapability('measure_co2') || 
          device.hasCapability('measure_pm25') ||
          name.includes('air quality') || 
          name.includes('co2')) {
        this.airQualitySensors.set(device.id, {
          id: device.id,
          name: device.name,
          device,
          type: 'sensor',
          zone: device.zone?.name || 'unknown',
          readings: {
            co2: null,
            pm25: null,
            pm10: null,
            voc: null,
            temperature: null,
            humidity: null
          },
          score: null,
          lastUpdate: null
        });
      }

      // Air purifiers
      if (name.includes('purifier') || name.includes('air cleaner')) {
        this.purifiers.set(device.id, {
          id: device.id,
          name: device.name,
          device,
          type: 'purifier',
          zone: device.zone?.name || 'unknown',
          active: false,
          mode: 'auto',
          filterStatus: null,
          lastMaintenance: null
        });
      }

      // Ventilation systems
      if (name.includes('ventilation') || name.includes('fan') || name.includes('exhaust')) {
        this.ventilationSystems.set(device.id, {
          id: device.id,
          name: device.name,
          device,
          type: 'ventilation',
          zone: device.zone?.name || 'unknown',
          active: false,
          speed: 0
        });
      }
    }

    this.log(`Discovered ${this.airQualitySensors.size} sensors, ${this.purifiers.size} purifiers, ${this.ventilationSystems.size} ventilation systems`);
  }

  /**
   * Setup default automation rules
   */
  async setupDefaultAutomationRules() {
    const defaultRules = [
      {
        id: 'high_co2',
        name: 'High CO2 Response',
        description: 'Activate ventilation when CO2 is too high',
        triggers: [{ type: 'co2', threshold: 1000, operator: '>' }],
        actions: [
          { type: 'ventilation', action: 'on', speed: 'high' },
          { type: 'notification', message: 'High CO2 detected' }
        ],
        enabled: true,
        priority: 'high'
      },
      {
        id: 'poor_air_quality',
        name: 'Poor Air Quality',
        description: 'Activate purifier when PM2.5 is too high',
        triggers: [{ type: 'pm25', threshold: 35, operator: '>' }],
        actions: [
          { type: 'purifier', action: 'on', mode: 'turbo' },
          { type: 'notification', message: 'Poor air quality detected' }
        ],
        enabled: true,
        priority: 'high'
      },
      {
        id: 'high_voc',
        name: 'High VOC Levels',
        description: 'Respond to elevated VOC levels',
        triggers: [{ type: 'voc', threshold: 500, operator: '>' }],
        actions: [
          { type: 'ventilation', action: 'on', speed: 'medium' },
          { type: 'purifier', action: 'on', mode: 'auto' }
        ],
        enabled: true,
        priority: 'medium'
      },
      {
        id: 'night_mode',
        name: 'Night Air Quality Mode',
        description: 'Quiet air quality management during sleep',
        triggers: [{ type: 'time', start: '22:00', end: '07:00' }],
        actions: [
          { type: 'purifier', mode: 'sleep' },
          { type: 'ventilation', speed: 'low' }
        ],
        enabled: true,
        priority: 'low'
      },
      {
        id: 'good_outdoor_air',
        name: 'Good Outdoor Air Quality',
        description: 'Use outdoor air when quality is good',
        triggers: [
          { type: 'outdoor_aqi', threshold: 50, operator: '<' },
          { type: 'temperature', range: [15, 25] }
        ],
        actions: [
          { type: 'windows', action: 'suggest_open' },
          { type: 'purifier', action: 'off' }
        ],
        enabled: true,
        priority: 'low'
      }
    ];

    for (const rule of defaultRules) {
      if (!this.automationRules.has(rule.id)) {
        this.automationRules.set(rule.id, rule);
      }
    }

    await this.saveAutomationRules();
  }

  /**
   * Start monitoring
   */
  async startMonitoring() {
    // Air quality monitoring (every 2 minutes)
    this.monitoringInterval = setInterval(async () => {
      await this.monitorAirQuality();
    }, 120000);

    // Automation rules evaluation (every 5 minutes)
    this.automationInterval = setInterval(async () => {
      await this.evaluateAutomationRules();
    }, 300000);

    // Maintenance check (daily)
    this.maintenanceInterval = setInterval(async () => {
      await this.checkMaintenanceNeeds();
    }, 86400000);

    // Initial monitoring
    await this.monitorAirQuality();
  }

  /**
   * Monitor air quality
   */
  async monitorAirQuality() {
    const overallQuality = {
      timestamp: Date.now(),
      zones: [],
      overall: {
        score: 100,
        level: 'excellent',
        concerns: []
      }
    };

    for (const [_id, sensor] of this.airQualitySensors) {
      try {
        const readings = await this.readSensor(sensor.device);
        sensor.readings = readings;
        sensor.lastUpdate = Date.now();

        // Calculate air quality score for this sensor
        const score = this.calculateAirQualityScore(readings);
        sensor.score = score;

        overallQuality.zones.push({
          zone: sensor.zone,
          sensor: sensor.name,
          readings,
          score
        });

        // Check for concerning levels
        const concerns = this.identifyConcerns(readings);
        if (concerns.length > 0) {
          overallQuality.overall.concerns.push(...concerns);
        }
      } catch (error) {
        this.error(`Failed to read sensor ${sensor.name}:`, error);
      }
    }

    // Calculate overall score
    if (overallQuality.zones.length > 0) {
      const avgScore = overallQuality.zones.reduce((sum, z) => sum + z.score, 0) / overallQuality.zones.length;
      overallQuality.overall.score = Math.round(avgScore);
      overallQuality.overall.level = this.getAirQualityLevel(avgScore);
    }

    // Store history
    this.qualityHistory.push(overallQuality);
    
    // Keep only last 1000 records
    if (this.qualityHistory.length > 1000) {
      this.qualityHistory.shift();
    }

    // Trigger automation if needed
    await this.evaluateAutomationRules();

    return overallQuality;
  }

  /**
   * Read sensor
   */
  async readSensor(device) {
    const readings = {
      co2: null,
      pm25: null,
      pm10: null,
      voc: null,
      temperature: null,
      humidity: null
    };

    try {
      if (device.hasCapability('measure_co2')) {
        readings.co2 = await device.getCapabilityValue('measure_co2');
      }
      if (device.hasCapability('measure_pm25')) {
        readings.pm25 = await device.getCapabilityValue('measure_pm25');
      }
      if (device.hasCapability('measure_pm10')) {
        readings.pm10 = await device.getCapabilityValue('measure_pm10');
      }
      if (device.hasCapability('measure_voc')) {
        readings.voc = await device.getCapabilityValue('measure_voc');
      }
      if (device.hasCapability('measure_temperature')) {
        readings.temperature = await device.getCapabilityValue('measure_temperature');
      }
      if (device.hasCapability('measure_humidity')) {
        readings.humidity = await device.getCapabilityValue('measure_humidity');
      }
    } catch (error) {
      this.error('Error reading sensor:', error);
    }

    return readings;
  }

  /**
   * Calculate air quality score
   */
  calculateAirQualityScore(readings) {
    let score = 100;
    const penalties = [];

    // CO2 levels (ppm)
    if (readings.co2 !== null) {
      if (readings.co2 > 2000) {
        penalties.push(40); // Very high
      } else if (readings.co2 > 1500) {
        penalties.push(30);
      } else if (readings.co2 > 1000) {
        penalties.push(20);
      } else if (readings.co2 > 800) {
        penalties.push(10);
      }
    }

    // PM2.5 levels (μg/m³)
    if (readings.pm25 !== null) {
      if (readings.pm25 > 150) {
        penalties.push(50); // Hazardous
      } else if (readings.pm25 > 75) {
        penalties.push(35); // Unhealthy
      } else if (readings.pm25 > 35) {
        penalties.push(20); // Moderate
      } else if (readings.pm25 > 12) {
        penalties.push(10);
      }
    }

    // PM10 levels (μg/m³)
    if (readings.pm10 !== null) {
      if (readings.pm10 > 250) {
        penalties.push(40);
      } else if (readings.pm10 > 150) {
        penalties.push(25);
      } else if (readings.pm10 > 50) {
        penalties.push(15);
      }
    }

    // VOC levels (ppb)
    if (readings.voc !== null) {
      if (readings.voc > 1000) {
        penalties.push(35);
      } else if (readings.voc > 500) {
        penalties.push(20);
      } else if (readings.voc > 250) {
        penalties.push(10);
      }
    }

    // Humidity (too high or too low)
    if (readings.humidity !== null) {
      if (readings.humidity > 70 || readings.humidity < 30) {
        penalties.push(10);
      } else if (readings.humidity > 60 || readings.humidity < 40) {
        penalties.push(5);
      }
    }

    // Apply penalties
    const totalPenalty = Math.min(100, penalties.reduce((sum, p) => sum + p, 0));
    score -= totalPenalty;

    return Math.max(0, score);
  }

  /**
   * Get air quality level
   */
  getAirQualityLevel(score) {
    if (score >= 90) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 50) return 'moderate';
    if (score >= 30) return 'poor';
    return 'very_poor';
  }

  /**
   * Identify concerns
   */
  identifyConcerns(readings) {
    const concerns = [];

    if (readings.co2 > 1000) {
      concerns.push({
        type: 'co2',
        level: readings.co2,
        severity: readings.co2 > 2000 ? 'critical' : readings.co2 > 1500 ? 'high' : 'medium',
        message: 'CO2-nivå för hög - ventilation rekommenderas'
      });
    }

    if (readings.pm25 > 35) {
      concerns.push({
        type: 'pm25',
        level: readings.pm25,
        severity: readings.pm25 > 150 ? 'critical' : readings.pm25 > 75 ? 'high' : 'medium',
        message: 'PM2.5-nivå för hög - luftrening rekommenderas'
      });
    }

    if (readings.voc > 500) {
      concerns.push({
        type: 'voc',
        level: readings.voc,
        severity: readings.voc > 1000 ? 'high' : 'medium',
        message: 'Höga VOC-nivåer - ventilation rekommenderas'
      });
    }

    if (readings.humidity < 30 || readings.humidity > 70) {
      concerns.push({
        type: 'humidity',
        level: readings.humidity,
        severity: 'low',
        message: `Luftfuktighet ${readings.humidity < 30 ? 'för låg' : 'för hög'}`
      });
    }

    return concerns;
  }

  /**
   * Evaluate automation rules
   */
  async evaluateAutomationRules() {
    const latestQuality = this.qualityHistory[this.qualityHistory.length - 1];
    if (!latestQuality) return;

    for (const [_id, rule] of this.automationRules) {
      if (!rule.enabled) continue;

      // Check if rule triggers are met
      const triggered = this.checkRuleTriggers(rule, latestQuality);
      
      if (triggered) {
        await this.executeRuleActions(rule);
      }
    }
  }

  /**
   * Check rule triggers
   */
  checkRuleTriggers(rule, quality) {
    for (const trigger of rule.triggers) {
      switch (trigger.type) {
        case 'co2':
          const co2Values = quality.zones.map(z => z.readings.co2).filter(v => v !== null);
          if (co2Values.length === 0) continue;
          const maxCo2 = Math.max(...co2Values);
          if (!this.compareTrigger(maxCo2, trigger.operator, trigger.threshold)) {
            return false;
          }
          break;

        case 'pm25':
          const pm25Values = quality.zones.map(z => z.readings.pm25).filter(v => v !== null);
          if (pm25Values.length === 0) continue;
          const maxPm25 = Math.max(...pm25Values);
          if (!this.compareTrigger(maxPm25, trigger.operator, trigger.threshold)) {
            return false;
          }
          break;

        case 'voc':
          const vocValues = quality.zones.map(z => z.readings.voc).filter(v => v !== null);
          if (vocValues.length === 0) continue;
          const maxVoc = Math.max(...vocValues);
          if (!this.compareTrigger(maxVoc, trigger.operator, trigger.threshold)) {
            return false;
          }
          break;

        case 'time':
          const hour = new Date().getHours();
          const startHour = parseInt(trigger.start.split(':')[0]);
          const endHour = parseInt(trigger.end.split(':')[0]);
          
          if (startHour < endHour) {
            if (hour < startHour || hour >= endHour) return false;
          } else {
            // Crosses midnight
            if (hour < startHour && hour >= endHour) return false;
          }
          break;
      }
    }

    return true;
  }

  /**
   * Compare trigger
   */
  compareTrigger(value, operator, threshold) {
    switch (operator) {
      case '>': return value > threshold;
      case '<': return value < threshold;
      case '>=': return value >= threshold;
      case '<=': return value <= threshold;
      case '==': return value === threshold;
      default: return false;
    }
  }

  /**
   * Execute rule actions
   */
  async executeRuleActions(rule) {
    this.log(`Executing rule: ${rule.name}`);

    for (const action of rule.actions) {
      try {
        await this.executeAction(action);
      } catch (error) {
        this.error(`Failed to execute action for rule ${rule.name}:`, error);
      }
    }

    // Record execution
    rule.lastExecuted = Date.now();
    rule.executionCount = (rule.executionCount || 0) + 1;

    await this.saveAutomationRules();
  }

  /**
   * Execute action
   */
  async executeAction(action) {
    switch (action.type) {
      case 'purifier':
        await this.controlPurifiers(action);
        break;

      case 'ventilation':
        await this.controlVentilation(action);
        break;

      case 'notification':
        await this.sendNotification(action);
        break;

      case 'windows':
        this.log(`Window action: ${action.action}`);
        break;
    }
  }

  /**
   * Control purifiers
   */
  async controlPurifiers(action) {
    for (const [_id, purifier] of this.purifiers) {
      try {
        if (action.action === 'on' && purifier.device.hasCapability('onoff')) {
          await purifier.device.setCapabilityValue('onoff', true);
          purifier.active = true;
          
          if (action.mode && purifier.device.hasCapability('mode')) {
            await purifier.device.setCapabilityValue('mode', action.mode);
            purifier.mode = action.mode;
          }
        } else if (action.action === 'off' && purifier.device.hasCapability('onoff')) {
          await purifier.device.setCapabilityValue('onoff', false);
          purifier.active = false;
        }
      } catch (error) {
        this.error(`Failed to control purifier ${purifier.name}:`, error);
      }
    }
  }

  /**
   * Control ventilation
   */
  async controlVentilation(action) {
    for (const [_id, ventilation] of this.ventilationSystems) {
      try {
        if (action.action === 'on' && ventilation.device.hasCapability('onoff')) {
          await ventilation.device.setCapabilityValue('onoff', true);
          ventilation.active = true;
          
          // Set speed if supported
          if (action.speed && ventilation.device.hasCapability('dim')) {
            const speedMap = { low: 0.33, medium: 0.66, high: 1.0 };
            await ventilation.device.setCapabilityValue('dim', speedMap[action.speed] || 0.5);
            ventilation.speed = speedMap[action.speed];
          }
        } else if (action.action === 'off' && ventilation.device.hasCapability('onoff')) {
          await ventilation.device.setCapabilityValue('onoff', false);
          ventilation.active = false;
        }
      } catch (error) {
        this.error(`Failed to control ventilation ${ventilation.name}:`, error);
      }
    }
  }

  /**
   * Send notification
   */
  async sendNotification(action) {
    try {
      const notificationManager = this.homey.app.advancedNotificationManager;
      if (notificationManager) {
        await notificationManager.sendNotification({
          title: 'Luftkvalitet',
          message: action.message,
          priority: 'medium',
          category: 'air_quality'
        });
      }
    } catch (error) {
      this.error('Failed to send notification:', error);
    }
  }

  /**
   * Check maintenance needs
   */
  async checkMaintenanceNeeds() {
    for (const [_id, purifier] of this.purifiers) {
      // Check filter status
      if (purifier.filterStatus === 'replace') {
        this.log(`Filter replacement needed for ${purifier.name}`);
        
        try {
          const notificationManager = this.homey.app.advancedNotificationManager;
          if (notificationManager) {
            await notificationManager.sendNotification({
              title: 'Filterbyte behövs',
              message: `${purifier.name}: Dags att byta filter`,
              priority: 'low',
              category: 'maintenance'
            });
          }
        } catch {}
      }
    }
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const latestQuality = this.qualityHistory[this.qualityHistory.length - 1];
    
    return {
      sensors: this.airQualitySensors.size,
      purifiers: this.purifiers.size,
      ventilationSystems: this.ventilationSystems.size,
      automationRules: this.automationRules.size,
      currentQuality: latestQuality,
      recentHistory: this.qualityHistory.slice(-100),
      alerts: this.alerts.slice(-20)
    };
  }

  async saveAutomationRules() {
    const data = {};
    this.automationRules.forEach((rule, id) => {
      data[id] = rule;
    });
    await this.homey.settings.set('airQualityRules', data);
  }

  destroy() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    if (this.automationInterval) {
      clearInterval(this.automationInterval);
      this.automationInterval = null;
    }
    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
      this.maintenanceInterval = null;
    }
  }

  log(...args) {
    console.log('[AirQualityManagementSystem]', ...args);
  }

  error(...args) {
    console.error('[AirQualityManagementSystem]', ...args);
  }
}

module.exports = AirQualityManagementSystem;
