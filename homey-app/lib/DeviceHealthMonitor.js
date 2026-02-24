'use strict';

const { BaseSystem } = require('./utils/BaseSystem');

/**
 * @typedef {'healthy'|'good'|'fair'|'poor'|'critical'} HealthStatus
 */

/**
 * @typedef {object} DeviceIssue
 * @property {string} id - Unique issue identifier
 * @property {'unavailable'|'slow_response'|'stale_data'|'capability_error'|'went_offline'} type - Issue category
 * @property {'low'|'medium'|'high'} severity - Issue severity
 * @property {string} message - Human-readable description
 * @property {number} detected - Unix timestamp (ms) when first detected
 * @property {number} count - Number of occurrences
 * @property {number} [lastOccurrence] - Unix timestamp of most recent occurrence
 * @property {string} [capability] - Affected capability name (where applicable)
 */

/**
 * @typedef {object} DeviceHealth
 * @property {string} deviceId - Homey device ID
 * @property {string} deviceName - Device display name
 * @property {string} driverClass - Driver ID
 * @property {HealthStatus} status - Current health status
 * @property {number} score - Health score (0–100)
 * @property {boolean} available - Whether the device is currently available
 * @property {number} lastSeen - Unix timestamp of the last successful contact
 * @property {DeviceIssue[]} issues - Active issues list
 * @property {object} capabilities - Per-capability value and update metadata
 * @property {object} performance - Response time history and reliability metrics
 */

/**
 * @typedef {object} SystemHealthSnapshot
 * @property {number} overallScore - Average health score across all devices
 * @property {number} totalDevices - Total number of monitored devices
 * @property {number} availableDevices - Number of online devices
 * @property {{healthy: number, good: number, fair: number, poor: number, critical: number}} byStatus - Device count per status
 * @property {number} criticalIssues - Number of devices in critical state
 * @property {number} pendingMaintenance - Pending maintenance task count
 */

/**
 * Device Health Monitor
 *
 * Real-time health tracking, predictive maintenance, and anomaly detection
 * for all Homey devices. Extends {@link BaseSystem} for lifecycle and interval
 * management.
 *
 * @extends BaseSystem
 */
class DeviceHealthMonitor extends BaseSystem {
  /**
   * @param {import('homey').Homey} homey - Homey application instance
   */
  constructor(homey) {
    super(homey);
    this.deviceHealth = new Map();
    this.healthHistory = new Map();
    this.anomalies = [];
    this.maintenanceSchedule = new Map();
    this.diagnosticResults = new Map();
  }

  async onInitialize() {
    this.log('Initializing Device Health Monitor...');

    // Load health data
    const savedHealth = await this.homey.settings.get('deviceHealth') || {};
    Object.entries(savedHealth).forEach(([id, health]) => {
      this.deviceHealth.set(id, health);
    });

    // Load history
    const savedHistory = await this.homey.settings.get('deviceHealthHistory') || {};
    Object.entries(savedHistory).forEach(([id, history]) => {
      this.healthHistory.set(id, history);
    });

    // Load maintenance schedule
    const savedMaintenance = await this.homey.settings.get('maintenanceSchedule') || {};
    Object.entries(savedMaintenance).forEach(([id, schedule]) => {
      this.maintenanceSchedule.set(id, schedule);
    });

    // Start monitoring
    await this.startMonitoring();

    this.log('Device Health Monitor initialized');
  }

  /**
   * Initialise health records for all existing devices, register device-creation
   * listener, and start the health-check, diagnostics, and anomaly-detection intervals.
   *
   * @returns {Promise<void>}
   */
  async startMonitoring() {
    // Monitor all devices
    const devices = this.homey.drivers.getDevices();
    
    for (const device of devices) {
      await this.initializeDeviceMonitoring(device);
    }

    // Listen for new devices
    this.homey.devices.on('device.create', async (device) => {
      await this.initializeDeviceMonitoring(device);
    });

    // Periodic health checks
    this.healthCheckInterval = this.wrapInterval(async () => {
      await this.performHealthChecks();
    }, 300000); // Every 5 minutes

    // Daily diagnostics
    this.diagnosticsInterval = this.wrapInterval(async () => {
      await this.runDiagnostics();
    }, 86400000); // Every 24 hours

    // Hourly anomaly detection
    this.anomalyInterval = this.wrapInterval(async () => {
      await this.detectAnomalies();
    }, 3600000); // Every hour
  }

  /**
   * Create a health record for the device (if one doesn't exist) and attach
   * capability-value and availability event listeners.
   *
   * @param {object} device - Homey device object
   * @returns {Promise<void>}
   */
  async initializeDeviceMonitoring(device) {
    const deviceId = device.id;

    // Create health record
    if (!this.deviceHealth.has(deviceId)) {
      this.deviceHealth.set(deviceId, {
        deviceId,
        deviceName: device.name,
        driverClass: device.driver?.id,
        status: 'healthy',
        score: 100,
        lastSeen: Date.now(),
        uptime: 0,
        issues: [],
        capabilities: {},
        performance: {
          responseTime: [],
          reliability: 100,
          availability: 100
        },
        metadata: {
          created: Date.now(),
          lastCheck: Date.now()
        }
      });
    }

    // Monitor capability changes
    device.on('capability.value', async (capability, value) => {
      await this.recordCapabilityChange(deviceId, capability, value);
    });

    // Monitor availability
    device.on('available', () => {
      this.recordAvailabilityChange(deviceId, true);
    });

    device.on('unavailable', () => {
      this.recordAvailabilityChange(deviceId, false);
    });
  }

  /**
   * Run a health check on every known device and persist the results.
   *
   * @returns {Promise<void>}
   */
  async performHealthChecks() {
    this.log('Performing health checks...');
    
    const devices = this.homey.drivers.getDevices();
    
    for (const device of devices) {
      await this.checkDeviceHealth(device);
    }

    await this.saveHealthData();
  }

  /**
   * Update health data for a single device: availability, response time,
   * all capability values, health score, and status. Records a history snapshot.
   *
   * @param {object} device - Homey device object
   * @returns {Promise<DeviceHealth|undefined>} Updated health record, or undefined if device is unknown
   */
  async checkDeviceHealth(device) {
    const deviceId = device.id;
    const health = this.deviceHealth.get(deviceId);
    
    if (!health) {
      await this.initializeDeviceMonitoring(device);
      return;
    }

    // Update last seen
    health.lastSeen = Date.now();

    // Check availability
    const isAvailable = device.available;
    health.available = isAvailable;

    if (!isAvailable) {
      this.addIssue(deviceId, {
        type: 'unavailable',
        severity: 'high',
        message: 'Enheten är inte tillgänglig',
        detected: Date.now()
      });
    }

    // Check response time
    const responseTime = await this.measureResponseTime(device);
    if (responseTime > 0) {
      health.performance.responseTime.push({
        timestamp: Date.now(),
        value: responseTime
      });

      // Keep only last 100 measurements
      if (health.performance.responseTime.length > 100) {
        health.performance.responseTime.shift();
      }

      // Check if response time is degrading
      if (responseTime > 5000) {
        this.addIssue(deviceId, {
          type: 'slow_response',
          severity: 'medium',
          message: `Långsam responstid: ${responseTime}ms`,
          detected: Date.now(),
          value: responseTime
        });
      }
    }

    // Check capabilities
    for (const capability of device.capabilities) {
      try {
        const value = await device.getCapabilityValue(capability);
        
        if (!health.capabilities[capability]) {
          health.capabilities[capability] = {
            value,
            lastUpdate: Date.now(),
            updateCount: 0,
            errors: 0
          };
        } else {
          health.capabilities[capability].value = value;
          health.capabilities[capability].lastUpdate = Date.now();
        }

        // Check for stale data
        const timeSinceUpdate = Date.now() - health.capabilities[capability].lastUpdate;
        if (timeSinceUpdate > 3600000) { // 1 hour
          this.addIssue(deviceId, {
            type: 'stale_data',
            severity: 'low',
            message: `Ingen uppdatering på ${capability} på över 1 timme`,
            detected: Date.now(),
            capability
          });
        }

      } catch (error) {
        health.capabilities[capability] = health.capabilities[capability] || {};
        health.capabilities[capability].errors = (health.capabilities[capability].errors || 0) + 1;
        
        this.addIssue(deviceId, {
          type: 'capability_error',
          severity: 'medium',
          message: `Fel vid läsning av ${capability}: ${error.message}`,
          detected: Date.now(),
          capability,
          error: error.message
        });
      }
    }

    // Calculate health score
    health.score = this.calculateHealthScore(health);

    // Update status
    health.status = this.determineHealthStatus(health.score, health.issues);

    // Record in history
    this.recordHealthSnapshot(deviceId, health);

    return health;
  }

  /**
   * Measure the time to read the first capability value from a device.
   *
   * Returns 0 for devices with no capabilities and -1 on error.
   *
   * @param {object} device - Homey device object
   * @returns {Promise<number>} Response time in milliseconds (0 = no caps, -1 = error)
   */
  async measureResponseTime(device) {
    if (device.capabilities.length === 0) return 0;

    try {
      const start = Date.now();
      await device.getCapabilityValue(device.capabilities[0]);
      return Date.now() - start;
    } catch (error) {
      return -1; // Error
    }
  }

  /**
   * Append a new issue to a device's health record, or increment the count of
   * an existing matching issue. Sends a Homey notification for high-severity issues.
   *
   * Issues are capped at 20 per device; older entries are evicted first.
   *
   * @param {string} deviceId - Device identifier
   * @param {Omit<DeviceIssue, 'id'|'count'>} issue - Issue definition (id and count are assigned automatically)
   * @returns {void}
   */
  addIssue(deviceId, issue) {
    const health = this.deviceHealth.get(deviceId);
    if (!health) return;

    // Check if similar issue already exists
    const existing = health.issues.find(i => 
      i.type === issue.type && 
      i.capability === issue.capability
    );

    if (existing) {
      existing.count = (existing.count || 1) + 1;
      existing.lastOccurrence = Date.now();
    } else {
      issue.count = 1;
      issue.id = this.generateIssueId();
      health.issues.push(issue);

      // Notify if high severity
      if (issue.severity === 'high') {
        this.notifyIssue(deviceId, issue);
      }
    }

    // Keep only last 20 issues
    if (health.issues.length > 20) {
      health.issues.shift();
    }
  }

  /**
   * Calculate a composite health score (0–100) by deducting points for
   * unavailability, recent issues by severity, poor response times, and
   * capability read errors.
   *
   * @param {DeviceHealth} health - Current health record
   * @returns {number} Health score clamped to [0, 100]
   */
  calculateHealthScore(health) {
    let score = 100;

    // Deduct for unavailability
    if (!health.available) {
      score -= 50;
    }

    // Deduct for issues
    for (const issue of health.issues) {
      const age = Date.now() - issue.detected;
      const isRecent = age < 3600000; // Last hour

      if (isRecent) {
        if (issue.severity === 'high') score -= 15;
        else if (issue.severity === 'medium') score -= 7;
        else score -= 3;
      }
    }

    // Deduct for poor performance
    if (health.performance.responseTime.length > 0) {
      const avgResponseTime = health.performance.responseTime
        .slice(-10)
        .reduce((sum, r) => sum + r.value, 0) / Math.min(10, health.performance.responseTime.length);
      
      if (avgResponseTime > 3000) score -= 10;
      else if (avgResponseTime > 1000) score -= 5;
    }

    // Deduct for capability errors
    for (const [capability, data] of Object.entries(health.capabilities)) {
      if (data.errors > 0) {
        score -= data.errors * 2;
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Map a numeric health score and issue list to a categorical health status.
   *
   * Devices with any high-severity issue are immediately classified as 'critical'
   * regardless of score.
   *
   * @param {number} score - Health score (0–100)
   * @param {DeviceIssue[]} issues - Current issue list
   * @returns {HealthStatus}
   */
  determineHealthStatus(score, issues) {
    const criticalIssues = issues.filter(i => i.severity === 'high');
    
    if (criticalIssues.length > 0) return 'critical';
    if (score < 40) return 'poor';
    if (score < 70) return 'fair';
    if (score < 90) return 'good';
    return 'healthy';
  }

  /**
   * Update the stored value and update-count for a capability when its value
   * changes (called via device event listener).
   *
   * @param {string} deviceId - Device identifier
   * @param {string} capability - Capability name
   * @param {*} value - New capability value
   * @returns {Promise<void>}
   */
  async recordCapabilityChange(deviceId, capability, value) {
    const health = this.deviceHealth.get(deviceId);
    if (!health) return;

    if (!health.capabilities[capability]) {
      health.capabilities[capability] = {
        value,
        lastUpdate: Date.now(),
        updateCount: 1,
        errors: 0
      };
    } else {
      health.capabilities[capability].value = value;
      health.capabilities[capability].lastUpdate = Date.now();
      health.capabilities[capability].updateCount++;
    }
  }

  /**
   * Record a device coming online or going offline, adding or clearing
   * the 'unavailable' issue accordingly.
   *
   * @param {string} deviceId - Device identifier
   * @param {boolean} isAvailable - Whether the device is now available
   * @returns {void}
   */
  recordAvailabilityChange(deviceId, isAvailable) {
    const health = this.deviceHealth.get(deviceId);
    if (!health) return;

    const previousAvailability = health.available;
    health.available = isAvailable;

    if (previousAvailability && !isAvailable) {
      // Device went offline
      this.addIssue(deviceId, {
        type: 'went_offline',
        severity: 'high',
        message: 'Enheten kopplades från',
        detected: Date.now()
      });
    } else if (!previousAvailability && isAvailable) {
      // Device came back online
      this.log(`Device ${deviceId} is back online`);
      
      // Remove offline issues
      health.issues = health.issues.filter(i => i.type !== 'unavailable' && i.type !== 'went_offline');
    }
  }

  /**
   * Append a snapshot of the device's current health to its history ring-buffer
   * (capped at 1000 entries per device).
   *
   * @param {string} deviceId - Device identifier
   * @param {DeviceHealth} health - Current health state to snapshot
   * @returns {void}
   */
  recordHealthSnapshot(deviceId, health) {
    if (!this.healthHistory.has(deviceId)) {
      this.healthHistory.set(deviceId, []);
    }

    const history = this.healthHistory.get(deviceId);
    
    history.push({
      timestamp: Date.now(),
      score: health.score,
      status: health.status,
      available: health.available,
      issueCount: health.issues.length
    });

    // Keep only last 1000 snapshots
    if (history.length > 1000) {
      history.shift();
    }
  }

  /**
   * Run comprehensive diagnostics across all known devices and store the
   * results in `this.diagnosticResults`.
   *
   * @returns {Promise<void>}
   */
  async runDiagnostics() {
    this.log('Running device diagnostics...');
    
    const devices = this.homey.drivers.getDevices();
    
    for (const device of devices) {
      const diagnostics = await this.diagnosticDevice(device);
      this.diagnosticResults.set(device.id, diagnostics);
    }
  }

  /**
   * Run a suite of diagnostic tests on a single device (connectivity, response
   * time, per-capability reads, signal strength, battery) and return a report.
   *
   * @param {object} device - Homey device object
   * @returns {Promise<{deviceId: string, timestamp: number, tests: Array<{name: string, result: 'pass'|'fail'|'warning', message: string, value?: *}>, score: number}>}
   */
  async diagnosticDevice(device) {
    const deviceId = device.id;
    const health = this.deviceHealth.get(deviceId);
    
    const diagnostics = {
      deviceId,
      timestamp: Date.now(),
      tests: []
    };

    // Test 1: Connectivity
    diagnostics.tests.push({
      name: 'Connectivity',
      result: device.available ? 'pass' : 'fail',
      message: device.available ? 'Enheten är ansluten' : 'Enheten är frånkopplad'
    });

    // Test 2: Response time
    const responseTime = await this.measureResponseTime(device);
    diagnostics.tests.push({
      name: 'Response Time',
      result: responseTime > 0 && responseTime < 2000 ? 'pass' : 'fail',
      value: responseTime,
      message: `Responstid: ${responseTime}ms`
    });

    // Test 3: Capability read/write
    for (const capability of device.capabilities) {
      try {
        await device.getCapabilityValue(capability);
        diagnostics.tests.push({
          name: `Capability: ${capability}`,
          result: 'pass',
          message: `Kan läsa ${capability}`
        });
      } catch (error) {
        diagnostics.tests.push({
          name: `Capability: ${capability}`,
          result: 'fail',
          message: `Fel vid läsning av ${capability}: ${error.message}`
        });
      }
    }

    // Test 4: Signal strength (if available)
    if (device.hasCapability('measure_rssi')) {
      try {
        const rssi = await device.getCapabilityValue('measure_rssi');
        diagnostics.tests.push({
          name: 'Signal Strength',
          result: rssi > -70 ? 'pass' : 'warning',
          value: rssi,
          message: `Signal: ${rssi} dBm`
        });
      } catch (error) {
        // RSSI not available
      }
    }

    // Test 5: Battery (if applicable)
    if (device.hasCapability('measure_battery')) {
      try {
        const battery = await device.getCapabilityValue('measure_battery');
        diagnostics.tests.push({
          name: 'Battery',
          result: battery > 20 ? 'pass' : 'warning',
          value: battery,
          message: `Batteri: ${battery}%`
        });

        // Schedule maintenance if low
        if (battery < 15) {
          await this.scheduleMaintenance(deviceId, {
            type: 'battery_replacement',
            priority: 'high',
            message: 'Byt batteri snart'
          });
        }
      } catch (error) {
        // Battery not available
      }
    }

    // Calculate diagnostic score
    const passed = diagnostics.tests.filter(t => t.result === 'pass').length;
    const total = diagnostics.tests.length;
    diagnostics.score = (passed / total) * 100;

    return diagnostics;
  }

  /**
   * Scan all monitored devices for behavioral anomalies, append newly detected
   * anomalies to `this.anomalies`, and prune entries older than 7 days.
   *
   * @returns {Promise<void>}
   */
  async detectAnomalies() {
    this.log('Detecting anomalies...');

    for (const [deviceId, health] of this.deviceHealth) {
      const anomalies = await this.detectDeviceAnomalies(deviceId, health);
      
      if (anomalies.length > 0) {
        this.anomalies.push(...anomalies);
        
        // Notify user
        for (const anomaly of anomalies) {
          await this.notifyAnomaly(deviceId, anomaly);
        }
      }
    }

    // Keep only recent anomalies
    const weekAgo = Date.now() - (7 * 86400000);
    this.anomalies = this.anomalies.filter(a => a.detected > weekAgo);
  }

  /**
   * Detect anomalies for a specific device by comparing recent health history
   * against earlier baselines and looking for repeated disconnections or
   * out-of-range capability values.
   *
   * @param {string} deviceId - Device identifier
   * @param {DeviceHealth} health - Current health state
   * @returns {Promise<object[]>} Array of anomaly objects (may be empty)
   */
  async detectDeviceAnomalies(deviceId, health) {
    const anomalies = [];
    const history = this.healthHistory.get(deviceId) || [];

    // Anomaly 1: Sudden health score drop
    if (history.length >= 10) {
      const recent = history.slice(-5);
      const previous = history.slice(-10, -5);
      
      const recentAvg = recent.reduce((sum, h) => sum + h.score, 0) / recent.length;
      const previousAvg = previous.reduce((sum, h) => sum + h.score, 0) / previous.length;
      
      if (previousAvg - recentAvg > 30) {
        anomalies.push({
          type: 'health_degradation',
          severity: 'high',
          message: 'Plötslig försämring av enhetens hälsa',
          detected: Date.now(),
          details: {
            previousScore: previousAvg,
            currentScore: recentAvg
          }
        });
      }
    }

    // Anomaly 2: Repeated disconnections
    const recentIssues = health.issues.filter(i => 
      Date.now() - i.detected < 3600000 && 
      (i.type === 'went_offline' || i.type === 'unavailable')
    );
    
    if (recentIssues.length >= 3) {
      anomalies.push({
        type: 'repeated_disconnections',
        severity: 'high',
        message: 'Enheten kopplas från upprepade gånger',
        detected: Date.now(),
        details: {
          count: recentIssues.length
        }
      });
    }

    // Anomaly 3: Unusual capability values
    for (const [capability, data] of Object.entries(health.capabilities)) {
      const anomaly = this.detectCapabilityAnomaly(capability, data, history);
      if (anomaly) {
        anomalies.push(anomaly);
      }
    }

    return anomalies;
  }

  /**
   * Check whether a single capability's current value is anomalous.
   *
   * @param {string} capability - Capability name (e.g. 'measure_temperature')
   * @param {{value: *, lastUpdate: number, updateCount: number, errors: number}} data - Current capability data
   * @param {object[]} history - Health history snapshots for the device
   * @returns {{type: string, severity: string, message: string, detected: number, capability: string, value: *}|null} Anomaly object or null
   */
  detectCapabilityAnomaly(capability, data, history) {
    // For numeric capabilities, check for outliers
    if (typeof data.value === 'number') {
      // Would implement statistical outlier detection
      // For now, just check extreme values
      
      if (capability === 'measure_temperature' && (data.value < -20 || data.value > 50)) {
        return {
          type: 'unusual_value',
          severity: 'medium',
          message: `Ovanligt värde för ${capability}: ${data.value}`,
          detected: Date.now(),
          capability,
          value: data.value
        };
      }
    }

    return null;
  }

  /**
   * Schedule a maintenance task for a device, persisting the updated schedule.
   *
   * @param {string} deviceId - Device identifier
   * @param {{type: string, priority: 'high'|'medium'|'low', message: string}} maintenance - Maintenance task descriptor
   * @returns {Promise<void>}
   */
  async scheduleMaintenance(deviceId, maintenance) {
    if (!this.maintenanceSchedule.has(deviceId)) {
      this.maintenanceSchedule.set(deviceId, []);
    }

    const schedule = this.maintenanceSchedule.get(deviceId);
    
    schedule.push({
      ...maintenance,
      id: this.generateMaintenanceId(),
      deviceId,
      scheduled: Date.now(),
      status: 'pending'
    });

    await this.saveMaintenance();
  }

  /**
   * Get a combined health report for a specific device including current state,
   * recent history, latest diagnostics, pending maintenance tasks, and
   * actionable recommendations.
   *
   * @param {string} deviceId - Device identifier
   * @returns {{current: DeviceHealth|undefined, history: object[], diagnostics: object|undefined, maintenance: object[], recommendations: object[]}}
   */
  getDeviceReport(deviceId) {
    const health = this.deviceHealth.get(deviceId);
    const history = this.healthHistory.get(deviceId) || [];
    const diagnostics = this.diagnosticResults.get(deviceId);
    const maintenance = this.maintenanceSchedule.get(deviceId) || [];

    return {
      current: health,
      history: history.slice(-100),
      diagnostics,
      maintenance: maintenance.filter(m => m.status === 'pending'),
      recommendations: this.generateRecommendations(health)
    };
  }

  /**
   * Derive a list of actionable maintenance recommendations from the given
   * device health state.
   *
   * @param {DeviceHealth} health - Current device health state
   * @returns {Array<{priority: 'high'|'medium'|'low', action: string, reason: string}>}
   */
  generateRecommendations(health) {
    const recommendations = [];

    if (!health.available) {
      recommendations.push({
        priority: 'high',
        action: 'Kontrollera anslutningen',
        reason: 'Enheten är inte tillgänglig'
      });
    }

    if (health.score < 70) {
      recommendations.push({
        priority: 'medium',
        action: 'Diagnostisera enheten',
        reason: 'Låg hälsopoäng'
      });
    }

    const highSeverityIssues = health.issues.filter(i => i.severity === 'high');
    if (highSeverityIssues.length > 0) {
      recommendations.push({
        priority: 'high',
        action: 'Åtgärda kritiska problem',
        reason: `${highSeverityIssues.length} allvarliga problem upptäckta`
      });
    }

    return recommendations;
  }

  /**
   * Get an aggregate health summary across all monitored devices.
   *
   * @returns {{overallScore: number, totalDevices: number, availableDevices: number, byStatus: {healthy: number, good: number, fair: number, poor: number, critical: number}, criticalIssues: number, pendingMaintenance: number}}
   */
  getSystemHealth() {
    const devices = Array.from(this.deviceHealth.values());
    
    const totalScore = devices.reduce((sum, d) => sum + d.score, 0);
    const avgScore = devices.length > 0 ? totalScore / devices.length : 100;

    const byStatus = {
      healthy: devices.filter(d => d.status === 'healthy').length,
      good: devices.filter(d => d.status === 'good').length,
      fair: devices.filter(d => d.status === 'fair').length,
      poor: devices.filter(d => d.status === 'poor').length,
      critical: devices.filter(d => d.status === 'critical').length
    };

    return {
      overallScore: Math.round(avgScore),
      totalDevices: devices.length,
      availableDevices: devices.filter(d => d.available).length,
      byStatus,
      criticalIssues: devices.filter(d => d.status === 'critical').length,
      pendingMaintenance: Array.from(this.maintenanceSchedule.values())
        .flat()
        .filter(m => m.status === 'pending').length
    };
  }

  /**
   * Notify about device issue
   */
  async notifyIssue(deviceId, issue) {
    const health = this.deviceHealth.get(deviceId);
    if (!health) return;

    await this.homey.notifications.createNotification({
      excerpt: `${health.deviceName}: ${issue.message}`
    });
  }

  /**
   * Notify about anomaly
   */
  async notifyAnomaly(deviceId, anomaly) {
    const health = this.deviceHealth.get(deviceId);
    if (!health) return;

    await this.homey.notifications.createNotification({
      excerpt: `Avvikelse upptäckt på ${health.deviceName}: ${anomaly.message}`
    });
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  generateIssueId() {
    return `issue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateMaintenanceId() {
    return `maint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async saveHealthData() {
    const data = {};
    this.deviceHealth.forEach((health, id) => {
      data[id] = health;
    });
    await this.homey.settings.set('deviceHealth', data);

    const historyData = {};
    this.healthHistory.forEach((history, id) => {
      historyData[id] = history;
    });
    await this.homey.settings.set('deviceHealthHistory', historyData);
  }

  async saveMaintenance() {
    const data = {};
    this.maintenanceSchedule.forEach((schedule, id) => {
      data[id] = schedule;
    });
    await this.homey.settings.set('maintenanceSchedule', data);
  }

}

module.exports = DeviceHealthMonitor;
