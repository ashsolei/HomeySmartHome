'use strict';

/**
 * Smart Water Management System
 *
 * Advanced water consumption monitoring, automated leak detection, and
 * smart irrigation scheduling with weather-based skipping. Manages water
 * meters, leak detectors, and irrigation zones discovered from Homey devices.
 */
class SmartWaterManagementSystem {
  /**
   * @param {import('homey').Homey} homey - Homey application instance
   */
  constructor(homey) {
    this.homey = homey;
    this.waterMeters = new Map();
    this.irrigationZones = new Map();
    this.leakDetectors = new Map();
    this.consumptionHistory = [];
    this.leakAlerts = [];
    this.irrigationSchedule = [];
    this.waterSavingMode = false;
  }

  /**
   * Load persisted meter and zone data, discover water devices, set up default
   * irrigation zones, and start all monitoring intervals.
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    this.log('Initializing Smart Water Management System...');
    
    // Load saved data
    const savedMeters = await this.homey.settings.get('waterMeters') || {};
    Object.entries(savedMeters).forEach(([id, meter]) => {
      this.waterMeters.set(id, meter);
    });

    const savedZones = await this.homey.settings.get('irrigationZones') || {};
    Object.entries(savedZones).forEach(([id, zone]) => {
      this.irrigationZones.set(id, zone);
    });

    // Discover water devices
    await this.discoverWaterDevices();

    // Setup default irrigation zones
    await this.setupDefaultIrrigationZones();

    // Start monitoring
    await this.startMonitoring();

    this.log('Smart Water Management System initialized');
  }

  /**
   * Scan all Homey devices and classify them as water meters, leak detectors,
   * or irrigation zones based on device name keywords and capabilities.
   *
   * @returns {Promise<void>}
   */
  async discoverWaterDevices() {
    const devices = this.homey.drivers.getDevices();
    
    for (const device of devices) {
      const name = device.name.toLowerCase();
      
      // Water meters
      if (name.includes('water') && name.includes('meter')) {
        this.waterMeters.set(device.id, {
          id: device.id,
          name: device.name,
          device,
          type: 'meter',
          totalConsumption: 0,
          currentFlow: 0,
          lastReading: null
        });
      }

      // Leak detectors
      if (name.includes('leak') || name.includes('water') && name.includes('sensor')) {
        this.leakDetectors.set(device.id, {
          id: device.id,
          name: device.name,
          device,
          type: 'leak_detector',
          status: 'ok',
          lastCheck: Date.now()
        });
      }

      // Irrigation/sprinkler systems
      if (name.includes('sprinkler') || name.includes('irrigation') || name.includes('water valve')) {
        const zone = this.getZoneFromDeviceName(name);
        this.irrigationZones.set(device.id, {
          id: device.id,
          name: device.name,
          device,
          zone,
          active: false,
          schedule: [],
          soilMoisture: null
        });
      }
    }

    this.log(`Discovered ${this.waterMeters.size} meters, ${this.leakDetectors.size} leak detectors, ${this.irrigationZones.size} irrigation zones`);
  }

  /**
   * Get zone from device name
   */
  getZoneFromDeviceName(name) {
    const lowerName = name.toLowerCase();
    
    if (lowerName.includes('front')) return 'front_yard';
    if (lowerName.includes('back')) return 'back_yard';
    if (lowerName.includes('side')) return 'side_yard';
    if (lowerName.includes('garden')) return 'garden';
    if (lowerName.includes('lawn')) return 'lawn';
    
    return 'general';
  }

  /**
   * Setup default irrigation zones
   */
  async setupDefaultIrrigationZones() {
    const defaultZones = [
      {
        id: 'zone_front_lawn',
        name: 'Front Lawn',
        zone: 'front_yard',
        area: 50, // square meters
        plantType: 'grass',
        schedule: [
          { day: 1, time: '06:00', duration: 20 },
          { day: 3, time: '06:00', duration: 20 },
          { day: 5, time: '06:00', duration: 20 }
        ]
      },
      {
        id: 'zone_back_garden',
        name: 'Back Garden',
        zone: 'back_yard',
        area: 30,
        plantType: 'mixed',
        schedule: [
          { day: 2, time: '07:00', duration: 15 },
          { day: 4, time: '07:00', duration: 15 },
          { day: 6, time: '07:00', duration: 15 }
        ]
      },
      {
        id: 'zone_vegetables',
        name: 'Vegetable Garden',
        zone: 'garden',
        area: 10,
        plantType: 'vegetables',
        schedule: [
          { day: 0, time: '18:00', duration: 10 },
          { day: 2, time: '18:00', duration: 10 },
          { day: 4, time: '18:00', duration: 10 },
          { day: 6, time: '18:00', duration: 10 }
        ]
      }
    ];

    for (const zone of defaultZones) {
      if (!this.irrigationZones.has(zone.id)) {
        this.irrigationZones.set(zone.id, {
          ...zone,
          active: false,
          device: null,
          soilMoisture: null
        });
      }
    }
  }

  /**
   * Start all monitoring intervals: consumption (5 min), leak detection (1 min),
   * irrigation schedule (10 min), and daily report (24 h). Also runs initial checks.
   *
   * @returns {Promise<void>}
   */
  async startMonitoring() {
    // Water consumption monitoring (every 5 minutes)
    this.consumptionInterval = setInterval(async () => {
      await this.monitorWaterConsumption();
    }, 300000);

    // Leak detection (every minute)
    this.leakDetectionInterval = setInterval(async () => {
      await this.detectLeaks();
    }, 60000);

    // Irrigation schedule check (every 10 minutes)
    this.irrigationInterval = setInterval(async () => {
      await this.checkIrrigationSchedule();
    }, 600000);

    // Daily water report
    this.dailyReportInterval = setInterval(async () => {
      await this.generateDailyReport();
    }, 86400000);

    // Initial checks
    await this.monitorWaterConsumption();
    await this.detectLeaks();
  }

  /**
   * Read all water meters, compute flow rates, store a consumption snapshot,
   * flag anomalies, and analyse usage trends.
   *
   * @returns {Promise<{timestamp: number, total: number, meters: object[], flowRate: number, anomaly: boolean}>}
   */
  async monitorWaterConsumption() {
    const consumption = {
      timestamp: Date.now(),
      total: 0,
      meters: [],
      flowRate: 0,
      anomaly: false
    };

    for (const [id, meter] of this.waterMeters) {
      try {
        let currentReading = 0;
        let flowRate = 0;

        // Try to read from device
        if (meter.device && meter.device.hasCapability('measure_water')) {
          currentReading = await meter.device.getCapabilityValue('measure_water');
        } else if (meter.device && meter.device.hasCapability('meter_water')) {
          currentReading = await meter.device.getCapabilityValue('meter_water');
        }

        // Calculate flow rate
        if (meter.lastReading) {
          const timeDiff = (Date.now() - meter.lastReading.timestamp) / 60000; // minutes
          const consumptionDiff = currentReading - meter.lastReading.value;
          flowRate = consumptionDiff / timeDiff; // liters per minute
        }

        meter.currentFlow = flowRate;
        meter.totalConsumption = currentReading;
        meter.lastReading = { value: currentReading, timestamp: Date.now() };

        consumption.total += currentReading;
        consumption.flowRate += flowRate;
        consumption.meters.push({
          id,
          name: meter.name,
          reading: currentReading,
          flowRate
        });

        // Check for anomalies (unusual high flow rate)
        if (flowRate > 50) { // More than 50 L/min is suspicious
          consumption.anomaly = true;
          await this.handleWaterAnomaly(meter, flowRate);
        }
      } catch (error) {
        this.error(`Failed to read water meter ${meter.name}:`, error);
      }
    }

    // Store consumption history
    this.consumptionHistory.push(consumption);

    // Keep only last 1000 records
    if (this.consumptionHistory.length > 1000) {
      this.consumptionHistory.shift();
    }

    // Check for water saving opportunities
    await this.analyzeWaterUsage(consumption);

    return consumption;
  }

  /**
   * Handle water anomaly
   */
  async handleWaterAnomaly(meter, flowRate) {
    this.log(`Water anomaly detected: ${meter.name} - ${flowRate.toFixed(1)} L/min`);

    // Send alert
    try {
      const notificationManager = this.homey.app.advancedNotificationManager;
      if (notificationManager) {
        await notificationManager.sendNotification({
          title: 'Vattenanomali upptäckt',
          message: `${meter.name}: Ovanligt hög vattenförbrukning (${flowRate.toFixed(1)} L/min)`,
          priority: 'high',
          category: 'water_alert'
        });
      }
    } catch {}
  }

  /**
   * Poll all leak detectors for the `alarm_water` capability and handle new or
   * resolved leak events. Also checks for hidden leaks during night hours.
   *
   * @returns {Promise<void>}
   */
  async detectLeaks() {
    for (const [id, detector] of this.leakDetectors) {
      try {
        let leakDetected = false;

        // Check leak sensor
        if (detector.device && detector.device.hasCapability('alarm_water')) {
          leakDetected = await detector.device.getCapabilityValue('alarm_water');
        }

        if (leakDetected && detector.status === 'ok') {
          // New leak detected
          detector.status = 'leak';
          detector.lastCheck = Date.now();

          await this.handleLeakDetection(detector);
        } else if (!leakDetected && detector.status === 'leak') {
          // Leak resolved
          detector.status = 'ok';
          detector.lastCheck = Date.now();

          this.log(`Leak resolved: ${detector.name}`);
        }
      } catch (error) {
        this.error(`Failed to check leak detector ${detector.name}:`, error);
      }
    }

    // Check for hidden leaks (continuous low flow when no usage expected)
    await this.detectHiddenLeaks();
  }

  /**
   * Handle leak detection
   */
  async handleLeakDetection(detector) {
    this.log(`LEAK DETECTED: ${detector.name}`);

    // Record alert
    this.leakAlerts.push({
      detectorId: detector.id,
      detectorName: detector.name,
      timestamp: Date.now(),
      resolved: false
    });

    // Send urgent notification
    try {
      const notificationManager = this.homey.app.advancedNotificationManager;
      if (notificationManager) {
        await notificationManager.sendNotification({
          title: '🚨 VATTENLÄCKA UPPTÄCKT!',
          message: `${detector.name}: Vattenläcka detekterad. Vidta åtgärder omedelbart!`,
          priority: 'critical',
          category: 'water_leak',
          actions: ['view_location', 'shut_off_water']
        });
      }
    } catch {}

    // If water saving mode is active, try to shut off water
    if (this.waterSavingMode) {
      await this.emergencyWaterShutoff();
    }
  }

  /**
   * Detect hidden leaks
   */
  async detectHiddenLeaks() {
    // Check if there's continuous flow during night hours (00:00 - 05:00)
    const hour = new Date().getHours();
    
    if (hour >= 0 && hour < 5) {
      const currentConsumption = await this.getCurrentFlowRate();
      
      // If there's more than 2 L/min flow during night, might be a hidden leak
      if (currentConsumption > 2) {
        this.log(`Possible hidden leak detected: ${currentConsumption.toFixed(1)} L/min at night`);
        
        try {
          const notificationManager = this.homey.app.advancedNotificationManager;
          if (notificationManager) {
            await notificationManager.sendNotification({
              title: 'Möjlig dold vattenläcka',
              message: `Kontinuerlig vattenförbrukning upptäckt under natten (${currentConsumption.toFixed(1)} L/min)`,
              priority: 'medium',
              category: 'water_alert'
            });
          }
        } catch {}
      }
    }
  }

  /**
   * Return the sum of current flow rates across all registered water meters.
   *
   * @returns {Promise<number>} Total flow rate in litres per minute
   */
  async getCurrentFlowRate() {
    let totalFlow = 0;
    
    for (const [id, meter] of this.waterMeters) {
      totalFlow += meter.currentFlow || 0;
    }
    
    return totalFlow;
  }

  /**
   * Emergency water shutoff
   */
  async emergencyWaterShutoff() {
    this.log('EMERGENCY WATER SHUTOFF INITIATED');

    const devices = this.homey.drivers.getDevices();
    
    for (const device of devices) {
      const name = device.name.toLowerCase();
      
      // Try to close main water valve
      if (name.includes('main') && name.includes('valve')) {
        try {
          if (device.hasCapability('onoff')) {
            await device.setCapabilityValue('onoff', false);
            this.log(`Closed main water valve: ${device.name}`);
          }
        } catch (error) {
          this.error(`Failed to close valve ${device.name}:`, error);
        }
      }
    }
  }

  /**
   * Analyze water usage
   */
  async analyzeWaterUsage(consumption) {
    if (this.consumptionHistory.length < 50) return;

    // Calculate average consumption
    const recentHistory = this.consumptionHistory.slice(-50);
    const avgConsumption = recentHistory.reduce((sum, c) => sum + c.total, 0) / recentHistory.length;

    // Check if current consumption is significantly higher
    if (consumption.total > avgConsumption * 1.5) {
      this.log(`High water consumption detected: ${consumption.total.toFixed(1)}L vs avg ${avgConsumption.toFixed(1)}L`);
    }

    // Suggest water saving opportunities
    if (consumption.flowRate > 30) {
      this.log('Water saving opportunity: High flow rate detected');
    }
  }

  /**
   * Check irrigation schedule
   */
  async checkIrrigationSchedule() {
    const now = new Date();
    const currentDay = now.getDay();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;

    for (const [id, zone] of this.irrigationZones) {
      if (!zone.schedule || zone.schedule.length === 0) continue;

      for (const scheduleItem of zone.schedule) {
        // Check if it's time to water
        if (scheduleItem.day === currentDay) {
          const scheduledTime = scheduleItem.time;
          
          // Check if current time matches scheduled time (within 10 minutes)
          if (this.isTimeToWater(currentTime, scheduledTime)) {
            // Check weather conditions before watering
            const shouldWater = await this.shouldWaterBasedOnWeather(zone);
            
            if (shouldWater) {
              await this.startIrrigation(id, scheduleItem.duration);
            } else {
              this.log(`Skipping irrigation for ${zone.name}: weather conditions not suitable`);
            }
          }
        }
      }
    }
  }

  /**
   * Check if it's time to water
   */
  isTimeToWater(currentTime, scheduledTime) {
    const [currentH, currentM] = currentTime.split(':').map(Number);
    const [scheduledH, scheduledM] = scheduledTime.split(':').map(Number);

    const currentMinutes = currentH * 60 + currentM;
    const scheduledMinutes = scheduledH * 60 + scheduledM;

    // Within 10 minutes of scheduled time
    return Math.abs(currentMinutes - scheduledMinutes) <= 10;
  }

  /**
   * Check if should water based on weather
   */
  async shouldWaterBasedOnWeather(zone) {
    // Check recent rain
    try {
      const weatherData = await this.getWeatherData();
      
      // Don't water if it rained recently
      if (weatherData.recentRain) {
        return false;
      }

      // Don't water if rain is expected soon
      if (weatherData.rainExpected) {
        return false;
      }

      // Check soil moisture if available
      if (zone.soilMoisture !== null && zone.soilMoisture > 60) {
        return false; // Soil is already moist
      }

      return true;
    } catch {
      // If weather data unavailable, water anyway
      return true;
    }
  }

  /**
   * Get weather data
   */
  async getWeatherData() {
    // Mock weather data (would integrate with weather API)
    return {
      recentRain: false,
      rainExpected: false,
      temperature: 22,
      humidity: 50
    };
  }

  /**
   * Start irrigation for the specified zone and schedule automatic shutoff.
   *
   * @param {string} zoneId - Irrigation zone identifier
   * @param {number} duration - Irrigation duration in minutes
   * @returns {Promise<void>}
   */
  async startIrrigation(zoneId, duration) {
    const zone = this.irrigationZones.get(zoneId);
    if (!zone) return;

    this.log(`Starting irrigation: ${zone.name} for ${duration} minutes`);

    zone.active = true;

    // Turn on irrigation device
    if (zone.device) {
      try {
        if (zone.device.hasCapability('onoff')) {
          await zone.device.setCapabilityValue('onoff', true);
        }
      } catch (error) {
        this.error(`Failed to start irrigation for ${zone.name}:`, error);
      }
    }

    // Schedule stop
    setTimeout(async () => {
      await this.stopIrrigation(zoneId);
    }, duration * 60000); // Convert minutes to milliseconds
  }

  /**
   * Stop irrigation for the specified zone.
   *
   * @param {string} zoneId - Irrigation zone identifier
   * @returns {Promise<void>}
   */
  async stopIrrigation(zoneId) {
    const zone = this.irrigationZones.get(zoneId);
    if (!zone) return;

    this.log(`Stopping irrigation: ${zone.name}`);

    zone.active = false;

    // Turn off irrigation device
    if (zone.device) {
      try {
        if (zone.device.hasCapability('onoff')) {
          await zone.device.setCapabilityValue('onoff', false);
        }
      } catch (error) {
        this.error(`Failed to stop irrigation for ${zone.name}:`, error);
      }
    }
  }

  /**
   * Generate daily water report
   */
  async generateDailyReport() {
    const last24Hours = this.consumptionHistory.filter(
      c => c.timestamp > Date.now() - 86400000
    );

    if (last24Hours.length === 0) return;

    const totalConsumption = last24Hours.reduce((sum, c) => sum + c.flowRate, 0);
    const avgFlowRate = totalConsumption / last24Hours.length;
    const peakFlowRate = Math.max(...last24Hours.map(c => c.flowRate));

    const report = {
      date: new Date().toISOString().split('T')[0],
      totalConsumption: totalConsumption.toFixed(1),
      avgFlowRate: avgFlowRate.toFixed(2),
      peakFlowRate: peakFlowRate.toFixed(1),
      leakAlerts: this.leakAlerts.filter(a => a.timestamp > Date.now() - 86400000).length,
      irrigationRuns: 0 // Count irrigation runs
    };

    this.log('Daily water report:', report);

    // Send report notification
    try {
      const notificationManager = this.homey.app.advancedNotificationManager;
      if (notificationManager) {
        await notificationManager.sendNotification({
          title: 'Daglig vattenrapport',
          message: `Total: ${report.totalConsumption}L | Peak: ${report.peakFlowRate} L/min | Läckor: ${report.leakAlerts}`,
          priority: 'low',
          category: 'report'
        });
      }
    } catch {}
  }

  /**
   * Enable or disable water saving mode. When enabled, all irrigation schedule
   * durations are reduced by 25%.
   *
   * @param {boolean} enabled - `true` to enable, `false` to disable
   * @returns {Promise<void>}
   */
  async setWaterSavingMode(enabled) {
    this.waterSavingMode = enabled;
    await this.homey.settings.set('waterSavingMode', enabled);
    
    this.log(`Water saving mode: ${enabled ? 'ON' : 'OFF'}`);

    if (enabled) {
      // Reduce irrigation durations by 25%
      for (const [id, zone] of this.irrigationZones) {
        if (zone.schedule) {
          zone.schedule.forEach(s => {
            s.duration = Math.floor(s.duration * 0.75);
          });
        }
      }
    }
  }

  /**
   * Return a snapshot of the water management system state and recent metrics.
   *
   * @returns {{waterMeters: number, leakDetectors: number, irrigationZones: number, activeLeaks: number, totalConsumptionToday: string, recentAlerts: object[], consumptionHistory: object[], waterSavingMode: boolean}}
   */
  getStatistics() {
    const last24Hours = this.consumptionHistory.filter(
      c => c.timestamp > Date.now() - 86400000
    );

    const totalToday = last24Hours.reduce((sum, c) => sum + c.flowRate, 0);

    return {
      waterMeters: this.waterMeters.size,
      leakDetectors: this.leakDetectors.size,
      irrigationZones: this.irrigationZones.size,
      activeLeaks: Array.from(this.leakDetectors.values()).filter(d => d.status === 'leak').length,
      totalConsumptionToday: totalToday.toFixed(1),
      recentAlerts: this.leakAlerts.slice(-10),
      consumptionHistory: this.consumptionHistory.slice(-100),
      waterSavingMode: this.waterSavingMode
    };
  }

  log(...args) {
    console.log('[SmartWaterManagementSystem]', ...args);
  }

  error(...args) {
    console.error('[SmartWaterManagementSystem]', ...args);
  }
}

module.exports = SmartWaterManagementSystem;
