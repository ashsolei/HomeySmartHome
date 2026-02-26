'use strict';

/**
 * Predictive Maintenance Scheduler
 * ML-based system for predicting device failures and scheduling maintenance
 */
class PredictiveMaintenanceScheduler {
  constructor(homey) {
    this.homey = homey;
    this.deviceProfiles = new Map();
    this.maintenanceTasks = new Map();
    this.maintenanceHistory = [];
    this.failurePredictions = new Map();
    this.anomalyDetector = null;
  }

  async initialize() {
    try {
      this.log('Initializing Predictive Maintenance Scheduler...');

      // Load device profiles
      const savedProfiles = await this.homey.settings.get('deviceProfiles') || {};
      Object.entries(savedProfiles).forEach(([id, profile]) => {
        this.deviceProfiles.set(id, profile);
      });

      // Load maintenance tasks
      const savedTasks = await this.homey.settings.get('maintenanceTasks') || {};
      Object.entries(savedTasks).forEach(([id, task]) => {
        this.maintenanceTasks.set(id, task);
      });

      // Initialize anomaly detector
      await this.initializeAnomalyDetector();

      // Setup default maintenance schedules
      await this.setupDefaultMaintenanceSchedules();

      // Start monitoring
      await this.startMonitoring();

      this.log('Predictive Maintenance Scheduler initialized');
    } catch (error) {
      console.error(`[PredictiveMaintenanceScheduler] Failed to initialize:`, error.message);
    }
  }

  /**
   * Initialize anomaly detector
   */
  async initializeAnomalyDetector() {
    this.anomalyDetector = {
      thresholds: {
        temperature: { min: -10, max: 50 },
        humidity: { min: 20, max: 80 },
        power: { maxDeviation: 0.5 }, // 50% deviation
        responseTime: { max: 5000 }, // 5 seconds
        failureRate: { max: 0.1 } // 10% failure rate
      },
      patterns: new Map()
    };
  }

  /**
   * Setup default maintenance schedules
   */
  async setupDefaultMaintenanceSchedules() {
    // Define maintenance rules for common device types
    const defaultSchedules = {
      thermostat: {
        interval: 15552000000, // 6 months
        tasks: ['Check calibration', 'Clean sensors', 'Verify connectivity']
      },
      smoke_detector: {
        interval: 31104000000, // 1 year
        tasks: ['Test alarm', 'Replace battery', 'Clean sensor']
      },
      camera: {
        interval: 7776000000, // 3 months
        tasks: ['Clean lens', 'Check recording', 'Verify network']
      },
      lock: {
        interval: 15552000000, // 6 months
        tasks: ['Lubricate mechanism', 'Test emergency access', 'Check battery']
      },
      motion_sensor: {
        interval: 15552000000, // 6 months
        tasks: ['Clean sensor', 'Test detection', 'Check battery']
      },
      light_bulb: {
        interval: null, // Usage-based
        usageThreshold: 8760, // Hours (1 year at 24/7)
        tasks: ['Replace bulb', 'Check fixture']
      },
      hvac: {
        interval: 7776000000, // 3 months
        tasks: ['Replace filter', 'Clean vents', 'Check efficiency']
      },
      vacuum: {
        interval: 2592000000, // 1 month
        tasks: ['Empty dustbin', 'Clean brushes', 'Replace filter']
      }
    };

    this.defaultSchedules = defaultSchedules;
  }

  /**
   * Start monitoring
   */
  async startMonitoring() {
    // Device health monitoring (every 10 minutes)
    this.monitoringInterval = setInterval(async () => {
      await this.monitorDeviceHealth();
    }, 600000);

    // Failure prediction (every hour)
    this.predictionInterval = setInterval(async () => {
      await this.predictFailures();
    }, 3600000);

    // Maintenance check (daily)
    this.maintenanceInterval = setInterval(async () => {
      await this.checkMaintenanceSchedule();
    }, 86400000);

    // Initial checks
    await this.monitorDeviceHealth();
    await this.checkMaintenanceSchedule();
  }

  /**
   * Monitor device health
   */
  async monitorDeviceHealth() {
    const devices = this.homey.drivers.getDevices();
    
    for (const device of devices) {
      try {
        const health = await this.assessDeviceHealth(device);
        
        // Update device profile
        let profile = this.deviceProfiles.get(device.id);
        if (!profile) {
          profile = {
            id: device.id,
            name: device.name,
            type: this.categorizeDeviceType(device),
            installed: Date.now(),
            healthHistory: [],
            maintenanceRecords: [],
            usageStats: {
              totalRuntime: 0,
              cycleCount: 0,
              lastUsed: null
            }
          };
          this.deviceProfiles.set(device.id, profile);
        }

        // Update health history
        profile.healthHistory.push({
          score: health.score,
          issues: health.issues,
          timestamp: Date.now()
        });

        // Keep only last 100 health records
        if (profile.healthHistory.length > 100) {
          profile.healthHistory.shift();
        }

        // Detect anomalies
        await this.detectAnomalies(device, profile, health);

        // Schedule maintenance if needed
        if (health.score < 0.7) {
          await this.scheduleMaintenanceTask(device, profile, health);
        }
      } catch (error) {
        this.error(`Failed to monitor device ${device.name}:`, error);
      }
    }

    await this.saveDeviceProfiles();
  }

  /**
   * Assess device health
   */
  async assessDeviceHealth(device) {
    const health = {
      score: 1.0,
      issues: [],
      metrics: {}
    };

    // Check connectivity
    const isAvailable = device.available;
    if (!isAvailable) {
      health.score -= 0.3;
      health.issues.push('Device offline');
    }

    // Check battery level
    if (device.hasCapability('measure_battery')) {
      try {
        const battery = await device.getCapabilityValue('measure_battery');
        health.metrics.battery = battery;
        
        if (battery < 20) {
          health.score -= 0.2;
          health.issues.push('Low battery');
        }
      } catch {}
    }

    // Check response time
    const responseTime = await this.measureResponseTime(device);
    health.metrics.responseTime = responseTime;
    
    if (responseTime > 3000) {
      health.score -= 0.15;
      health.issues.push('Slow response time');
    }

    // Check error rate
    const errorRate = await this.calculateErrorRate(device);
    health.metrics.errorRate = errorRate;
    
    if (errorRate > 0.1) {
      health.score -= 0.2;
      health.issues.push('High error rate');
    }

    // Check age
    const ageInDays = await this.getDeviceAge(device);
    health.metrics.age = ageInDays;
    
    const expectedLifespan = this.getExpectedLifespan(device);
    if (ageInDays > expectedLifespan * 0.8) {
      health.score -= 0.1;
      health.issues.push('Near end of expected lifespan');
    }

    health.score = Math.max(0, Math.min(1, health.score));

    return health;
  }

  /**
   * Measure device response time
   */
  async measureResponseTime(device) {
    const startTime = Date.now();
    
    try {
      // Try to read a capability
      if (device.hasCapability('onoff')) {
        await device.getCapabilityValue('onoff');
      } else if (device.hasCapability('measure_temperature')) {
        await device.getCapabilityValue('measure_temperature');
      }
    } catch {}

    return Date.now() - startTime;
  }

  /**
   * Calculate error rate
   */
  async calculateErrorRate(_device) {
    // Simplified - would track actual errors
    return Math.random() * 0.05; // 0-5% random error rate
  }

  /**
   * Get device age in days
   */
  async getDeviceAge(device) {
    const profile = this.deviceProfiles.get(device.id);
    if (profile && profile.installed) {
      return (Date.now() - profile.installed) / 86400000;
    }
    
    return 0;
  }

  /**
   * Get expected lifespan in days
   */
  getExpectedLifespan(device) {
    const type = this.categorizeDeviceType(device);
    
    const lifespans = {
      light_bulb: 1825, // 5 years
      sensor: 3650, // 10 years
      thermostat: 3650, // 10 years
      lock: 2555, // 7 years
      camera: 1825, // 5 years
      smoke_detector: 3650, // 10 years
      appliance: 3650, // 10 years
      other: 2555 // 7 years default
    };

    return lifespans[type] || lifespans.other;
  }

  /**
   * Categorize device type
   */
  categorizeDeviceType(device) {
    const name = device.name.toLowerCase();
    const className = device.class || '';

    if (name.includes('light') || name.includes('lamp') || className === 'light') {
      return 'light_bulb';
    }
    if (name.includes('sensor') || className === 'sensor') {
      return 'sensor';
    }
    if (name.includes('thermostat') || className === 'thermostat') {
      return 'thermostat';
    }
    if (name.includes('lock') || className === 'lock') {
      return 'lock';
    }
    if (name.includes('camera') || className === 'camera') {
      return 'camera';
    }
    if (name.includes('smoke') || name.includes('alarm')) {
      return 'smoke_detector';
    }
    if (name.includes('vacuum') || name.includes('appliance')) {
      return 'appliance';
    }

    return 'other';
  }

  /**
   * Detect anomalies
   */
  async detectAnomalies(device, profile, health) {
    const anomalies = [];

    // Check for sudden health decline
    if (profile.healthHistory.length > 5) {
      const recentScores = profile.healthHistory.slice(-5).map(h => h.score);
      const avgRecentScore = recentScores.reduce((a, b) => a + b) / recentScores.length;
      
      if (health.score < avgRecentScore - 0.3) {
        anomalies.push({
          type: 'sudden_decline',
          severity: 'high',
          description: `Health score dropped by ${Math.round((avgRecentScore - health.score) * 100)}%`
        });
      }
    }

    // Check for abnormal metrics
    if (health.metrics.responseTime > this.anomalyDetector.thresholds.responseTime.max) {
      anomalies.push({
        type: 'slow_response',
        severity: 'medium',
        description: `Response time ${health.metrics.responseTime}ms exceeds threshold`
      });
    }

    if (health.metrics.errorRate > this.anomalyDetector.thresholds.failureRate.max) {
      anomalies.push({
        type: 'high_error_rate',
        severity: 'high',
        description: `Error rate ${Math.round(health.metrics.errorRate * 100)}% exceeds threshold`
      });
    }

    // Store anomalies
    if (anomalies.length > 0) {
      this.log(`Anomalies detected for ${device.name}:`, anomalies);
      
      // Create maintenance task for critical anomalies
      const criticalAnomaly = anomalies.find(a => a.severity === 'high');
      if (criticalAnomaly) {
        await this.scheduleMaintenanceTask(device, profile, health, anomalies);
      }
    }
  }

  /**
   * Predict failures
   */
  async predictFailures() {
    this.log('Running failure prediction analysis...');

    for (const [deviceId, profile] of this.deviceProfiles) {
      try {
        const prediction = await this.predictDeviceFailure(profile);
        
        if (prediction.probability > 0.3) {
          this.failurePredictions.set(deviceId, prediction);
          
          this.log(`Failure prediction for ${profile.name}: ${Math.round(prediction.probability * 100)}% in ${prediction.timeframe}`);

          // Schedule preventive maintenance
          if (prediction.probability > 0.5) {
            await this.schedulePreventiveMaintenance(profile, prediction);
          }
        }
      } catch (error) {
        this.error(`Failed to predict failure for ${profile.name}:`, error);
      }
    }
  }

  /**
   * Predict device failure
   */
  async predictDeviceFailure(profile) {
    const prediction = {
      probability: 0,
      timeframe: 'unknown',
      factors: []
    };

    // Factor 1: Age
    const ageInDays = (Date.now() - profile.installed) / 86400000;
    const expectedLifespan = 2555; // Default 7 years
    const ageRatio = ageInDays / expectedLifespan;
    
    if (ageRatio > 0.8) {
      prediction.probability += 0.3;
      prediction.factors.push('High age');
    } else if (ageRatio > 0.6) {
      prediction.probability += 0.15;
      prediction.factors.push('Medium age');
    }

    // Factor 2: Recent health trends
    if (profile.healthHistory.length > 10) {
      const recentHealth = profile.healthHistory.slice(-10);
      const avgHealth = recentHealth.reduce((sum, h) => sum + h.score, 0) / recentHealth.length;
      
      if (avgHealth < 0.6) {
        prediction.probability += 0.3;
        prediction.factors.push('Poor health trend');
      } else if (avgHealth < 0.8) {
        prediction.probability += 0.1;
        prediction.factors.push('Declining health');
      }
    }

    // Factor 3: Usage intensity
    if (profile.usageStats.cycleCount > 10000) {
      prediction.probability += 0.2;
      prediction.factors.push('High usage');
    }

    // Determine timeframe
    if (prediction.probability > 0.7) {
      prediction.timeframe = '1-3 months';
    } else if (prediction.probability > 0.5) {
      prediction.timeframe = '3-6 months';
    } else if (prediction.probability > 0.3) {
      prediction.timeframe = '6-12 months';
    }

    return prediction;
  }

  /**
   * Schedule maintenance task
   */
  async scheduleMaintenanceTask(device, profile, health, anomalies = []) {
    const taskId = `task_${device.id}_${Date.now()}`;
    
    const task = {
      id: taskId,
      deviceId: device.id,
      deviceName: device.name,
      type: 'corrective',
      priority: health.score < 0.5 ? 'high' : 'medium',
      scheduledFor: Date.now() + 86400000, // Tomorrow
      reason: health.issues.join(', '),
      anomalies,
      status: 'pending',
      actions: this.generateMaintenanceActions(profile.type, health)
    };

    this.maintenanceTasks.set(taskId, task);
    await this.saveMaintenanceTasks();

    this.log(`Scheduled maintenance task: ${task.deviceName}`);

    return task;
  }

  /**
   * Schedule preventive maintenance
   */
  async schedulePreventiveMaintenance(profile, prediction) {
    const taskId = `preventive_${profile.id}_${Date.now()}`;
    
    const task = {
      id: taskId,
      deviceId: profile.id,
      deviceName: profile.name,
      type: 'preventive',
      priority: prediction.probability > 0.7 ? 'high' : 'medium',
      scheduledFor: Date.now() + 604800000, // 1 week
      reason: `Predicted failure: ${Math.round(prediction.probability * 100)}% in ${prediction.timeframe}`,
      predictionFactors: prediction.factors,
      status: 'pending',
      actions: this.generatePreventiveActions(profile.type, prediction)
    };

    this.maintenanceTasks.set(taskId, task);
    await this.saveMaintenanceTasks();

    this.log(`Scheduled preventive maintenance: ${task.deviceName}`);

    return task;
  }

  /**
   * Generate maintenance actions
   */
  generateMaintenanceActions(deviceType, health) {
    const actions = [];

    // Common actions
    if (health.issues.includes('Device offline')) {
      actions.push('Check power connection');
      actions.push('Verify network connectivity');
      actions.push('Restart device');
    }

    if (health.issues.includes('Low battery')) {
      actions.push('Replace battery');
    }

    if (health.issues.includes('Slow response time')) {
      actions.push('Check network signal strength');
      actions.push('Reduce network congestion');
      actions.push('Consider device replacement');
    }

    // Device-specific actions
    if (this.defaultSchedules[deviceType]) {
      actions.push(...this.defaultSchedules[deviceType].tasks);
    }

    return actions;
  }

  /**
   * Generate preventive actions
   */
  generatePreventiveActions(deviceType, prediction) {
    const actions = [];

    if (prediction.factors.includes('High age')) {
      actions.push('Inspect for wear and tear');
      actions.push('Consider replacement planning');
    }

    if (prediction.factors.includes('High usage')) {
      actions.push('Perform deep cleaning');
      actions.push('Check for wear on moving parts');
    }

    // Add device-specific preventive actions
    if (this.defaultSchedules[deviceType]) {
      actions.push(...this.defaultSchedules[deviceType].tasks);
    }

    return actions;
  }

  /**
   * Check maintenance schedule
   */
  async checkMaintenanceSchedule() {
    this.log('Checking maintenance schedule...');

    const now = Date.now();
    
    for (const [_taskId, task] of this.maintenanceTasks) {
      // Check if task is due
      if (task.status === 'pending' && task.scheduledFor <= now) {
        this.log(`Maintenance task due: ${task.deviceName}`);
        
        // Send notification
        await this.notifyMaintenanceDue(task);
      }
    }
  }

  /**
   * Notify maintenance due
   */
  async notifyMaintenanceDue(task) {
    this.log(`Maintenance notification: ${task.deviceName} - ${task.reason}`);
    
    // Would integrate with notification system
    try {
      const notificationManager = this.homey.app.advancedNotificationManager;
      if (notificationManager) {
        await notificationManager.sendNotification({
          title: 'Underhåll krävs',
          message: `${task.deviceName}: ${task.reason}`,
          priority: task.priority,
          category: 'maintenance',
          actions: ['view_details', 'mark_complete']
        });
      }
    } catch {}
  }

  /**
   * Complete maintenance task
   */
  async completeMaintenanceTask(taskId, notes = '') {
    const task = this.maintenanceTasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    task.status = 'completed';
    task.completedAt = Date.now();
    task.notes = notes;

    // Update device profile
    const profile = this.deviceProfiles.get(task.deviceId);
    if (profile) {
      profile.maintenanceRecords.push({
        taskId,
        type: task.type,
        completedAt: Date.now(),
        notes
      });
    }

    // Add to history
    this.maintenanceHistory.push({
      taskId,
      deviceId: task.deviceId,
      deviceName: task.deviceName,
      type: task.type,
      completedAt: Date.now()
    });

    await this.saveMaintenanceTasks();
    await this.saveDeviceProfiles();

    this.log(`Completed maintenance task: ${task.deviceName}`);

    return task;
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const pendingTasks = Array.from(this.maintenanceTasks.values())
      .filter(t => t.status === 'pending');
    
    const highPriorityTasks = pendingTasks.filter(t => t.priority === 'high');

    return {
      deviceProfiles: this.deviceProfiles.size,
      totalTasks: this.maintenanceTasks.size,
      pendingTasks: pendingTasks.length,
      highPriorityTasks: highPriorityTasks.length,
      completedTasks: this.maintenanceHistory.length,
      failurePredictions: this.failurePredictions.size,
      recentTasks: Array.from(this.maintenanceTasks.values()).slice(-10),
      predictions: Array.from(this.failurePredictions.values())
    };
  }

  async saveDeviceProfiles() {
    const data = {};
    this.deviceProfiles.forEach((profile, id) => {
      data[id] = profile;
    });
    await this.homey.settings.set('deviceProfiles', data);
  }

  async saveMaintenanceTasks() {
    const data = {};
    this.maintenanceTasks.forEach((task, id) => {
      data[id] = task;
    });
    await this.homey.settings.set('maintenanceTasks', data);
  }

  destroy() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    if (this.predictionInterval) {
      clearInterval(this.predictionInterval);
      this.predictionInterval = null;
    }
    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
      this.maintenanceInterval = null;
    }
  }

  log(...args) {
    console.log('[PredictiveMaintenanceScheduler]', ...args);
  }

  error(...args) {
    console.error('[PredictiveMaintenanceScheduler]', ...args);
  }
}

module.exports = PredictiveMaintenanceScheduler;
