'use strict';

/**
 * Device Health Monitor
 * Predictive maintenance and device health tracking
 */
class DeviceHealthMonitor {
  constructor(app) {
    this._intervals = [];
    this.app = app;
    this.devices = new Map();
    this.healthHistory = [];
    this.alerts = [];
    this.maintenanceSchedule = new Map();
    this.maxHistorySize = 5000;
  }

  async initialize() {
    // Load device registry
    await this.loadDevices();
    
    // Start health monitoring
    this.startHealthChecks();
    
    // Initialize maintenance schedules
    this.initializeMaintenanceSchedules();
  }

  // ============================================
  // DEVICE REGISTRATION
  // ============================================

  async loadDevices() {
    // Simulate device loading (integrate with Homey API)
    const deviceList = [
      {
        id: 'dev_1',
        name: 'Vardagsrumslampa',
        type: 'light',
        zone: 'Vardagsrum',
        manufacturer: 'Philips',
        model: 'Hue White',
        installDate: Date.now() - 365 * 24 * 60 * 60 * 1000, // 1 year ago
        expectedLifetime: 5 * 365 * 24 * 60 * 60 * 1000, // 5 years
        batteryPowered: false
      },
      {
        id: 'dev_2',
        name: 'Termostat Hall',
        type: 'thermostat',
        zone: 'Hall',
        manufacturer: 'Netatmo',
        model: 'Smart Thermostat',
        installDate: Date.now() - 180 * 24 * 60 * 60 * 1000, // 6 months ago
        expectedLifetime: 10 * 365 * 24 * 60 * 60 * 1000,
        batteryPowered: false
      },
      {
        id: 'dev_3',
        name: 'Dörrsensor Ytterdörr',
        type: 'sensor',
        zone: 'Hall',
        manufacturer: 'Aqara',
        model: 'Door Sensor',
        installDate: Date.now() - 90 * 24 * 60 * 60 * 1000, // 3 months ago
        expectedLifetime: 2 * 365 * 24 * 60 * 60 * 1000,
        batteryPowered: true,
        batteryType: 'CR2032'
      },
      {
        id: 'dev_4',
        name: 'Rörelsesensor Hall',
        type: 'sensor',
        zone: 'Hall',
        manufacturer: 'Philips',
        model: 'Hue Motion',
        installDate: Date.now() - 200 * 24 * 60 * 60 * 1000,
        expectedLifetime: 3 * 365 * 24 * 60 * 60 * 1000,
        batteryPowered: true,
        batteryType: 'AAA'
      },
      {
        id: 'dev_5',
        name: 'Smart Plug Kök',
        type: 'plug',
        zone: 'Kök',
        manufacturer: 'TP-Link',
        model: 'HS100',
        installDate: Date.now() - 400 * 24 * 60 * 60 * 1000,
        expectedLifetime: 5 * 365 * 24 * 60 * 60 * 1000,
        batteryPowered: false
      }
    ];

    for (const device of deviceList) {
      this.devices.set(device.id, {
        ...device,
        health: {
          status: 'healthy', // healthy, warning, critical, offline
          score: 100,
          lastCheck: Date.now(),
          issues: [],
          predictions: {}
        },
        metrics: {
          uptime: 0.98,
          responseTime: 150, // ms
          failureRate: 0.02,
          batteryLevel: device.batteryPowered ? 85 : null,
          signalStrength: -45, // dBm
          lastCommunication: Date.now()
        },
        usage: {
          activations: 0,
          totalOnTime: 0,
          averageUsagePerDay: 0
        }
      });
    }
  }

  // ============================================
  // HEALTH MONITORING
  // ============================================

  startHealthChecks() {
    // Run health checks every 5 minutes
    this._intervals.push(setInterval(() => {
      this.performHealthChecks();
    }, 5 * 60 * 1000));

    // Run predictive analysis every hour
    this._intervals.push(setInterval(() => {
      this.runPredictiveAnalysis();
    }, 60 * 60 * 1000));

    // Initial check
    this.performHealthChecks();
  }

  async performHealthChecks() {
    for (const [deviceId, device] of this.devices) {
      const healthData = await this.checkDeviceHealth(deviceId);
      
      device.health = healthData;
      device.health.lastCheck = Date.now();

      // Log health status
      this.logHealthStatus(deviceId, healthData);

      // Generate alerts if needed
      if (healthData.status === 'warning' || healthData.status === 'critical') {
        this.generateAlert(deviceId, healthData);
      }
    }
  }

  async checkDeviceHealth(deviceId) {
    const device = this.devices.get(deviceId);
    const issues = [];
    let score = 100;

    // Check 1: Communication status
    const timeSinceLastCom = Date.now() - device.metrics.lastCommunication;
    if (timeSinceLastCom > 60 * 60 * 1000) { // 1 hour
      issues.push({
        type: 'communication',
        severity: 'critical',
        message: 'Ingen kommunikation på över 1 timme',
        impact: 40
      });
      score -= 40;
    } else if (timeSinceLastCom > 30 * 60 * 1000) { // 30 min
      issues.push({
        type: 'communication',
        severity: 'warning',
        message: 'Långsam kommunikation',
        impact: 15
      });
      score -= 15;
    }

    // Check 2: Battery level
    if (device.batteryPowered && device.metrics.batteryLevel !== null) {
      if (device.metrics.batteryLevel < 10) {
        issues.push({
          type: 'battery',
          severity: 'critical',
          message: `Kritiskt låg batterinivå: ${device.metrics.batteryLevel}%`,
          impact: 30
        });
        score -= 30;
      } else if (device.metrics.batteryLevel < 20) {
        issues.push({
          type: 'battery',
          severity: 'warning',
          message: `Låg batterinivå: ${device.metrics.batteryLevel}%`,
          impact: 15
        });
        score -= 15;
      }
    }

    // Check 3: Signal strength
    if (device.metrics.signalStrength < -80) {
      issues.push({
        type: 'signal',
        severity: 'warning',
        message: `Svag signal: ${device.metrics.signalStrength} dBm`,
        impact: 10
      });
      score -= 10;
    }

    // Check 4: Response time
    if (device.metrics.responseTime > 500) {
      issues.push({
        type: 'performance',
        severity: 'warning',
        message: `Långsam responstid: ${device.metrics.responseTime} ms`,
        impact: 10
      });
      score -= 10;
    }

    // Check 5: Failure rate
    if (device.metrics.failureRate > 0.1) {
      issues.push({
        type: 'reliability',
        severity: 'warning',
        message: `Hög felfrekvens: ${Math.round(device.metrics.failureRate * 100)}%`,
        impact: 15
      });
      score -= 15;
    }

    // Check 6: Age and lifetime
    const age = Date.now() - device.installDate;
    const lifePercentage = age / device.expectedLifetime;
    
    if (lifePercentage > 0.9) {
      issues.push({
        type: 'age',
        severity: 'warning',
        message: 'Enheten närmar sig förväntad livslängd',
        impact: 10
      });
      score -= 10;
    }

    // Determine overall status
    let status = 'healthy';
    if (score < 50) status = 'critical';
    else if (score < 75) status = 'warning';
    else if (issues.some(i => i.severity === 'critical')) status = 'critical';
    
    // Simulate random offline status (2% chance)
    if (Math.random() < 0.02) {
      status = 'offline';
      score = 0;
      issues.push({
        type: 'offline',
        severity: 'critical',
        message: 'Enhet offline',
        impact: 100
      });
    }

    return {
      status,
      score: Math.max(0, score),
      issues,
      predictions: this.generatePredictions(device, issues)
    };
  }

  generatePredictions(device, currentIssues) {
    const predictions = {};

    // Battery replacement prediction
    if (device.batteryPowered && device.metrics.batteryLevel !== null) {
      const daysRemaining = Math.round((device.metrics.batteryLevel / 100) * 180); // Estimate
      predictions.batteryReplacement = {
        daysRemaining,
        confidence: 0.75,
        action: 'Byt batteri',
        parts: [device.batteryType]
      };
    }

    // Failure prediction based on age
    const age = Date.now() - device.installDate;
    const lifePercentage = age / device.expectedLifetime;
    
    if (lifePercentage > 0.7) {
      const daysToFailure = Math.round((device.expectedLifetime - age) / (24 * 60 * 60 * 1000));
      predictions.deviceReplacement = {
        daysRemaining: daysToFailure,
        confidence: Math.min(0.95, lifePercentage),
        action: 'Överväg utbyte',
        reason: 'Närmar sig livslängdens slut'
      };
    }

    // Maintenance prediction
    if (currentIssues.some(i => i.type === 'signal')) {
      predictions.maintenance = {
        type: 'reposition',
        action: 'Flytta enheten närmare hub',
        confidence: 0.68,
        expectedImprovement: 'Bättre signalstyrka'
      };
    }

    return predictions;
  }

  // ============================================
  // PREDICTIVE ANALYSIS
  // ============================================

  async runPredictiveAnalysis() {
    const analysis = {
      nearTermFailures: [],
      maintenanceNeeded: [],
      replacementRecommendations: [],
      optimizationOpportunities: []
    };

    for (const [deviceId, device] of this.devices) {
      // Predict near-term failures
      if (device.health.score < 60) {
        const failureProbability = (100 - device.health.score) / 100;
        
        analysis.nearTermFailures.push({
          deviceId,
          deviceName: device.name,
          probability: failureProbability,
          timeframe: '7-14 dagar',
          issues: device.health.issues
        });
      }

      // Check maintenance needs
      if (device.health.predictions.batteryReplacement?.daysRemaining < 30) {
        analysis.maintenanceNeeded.push({
          deviceId,
          deviceName: device.name,
          type: 'battery',
          urgency: device.health.predictions.batteryReplacement.daysRemaining < 7 ? 'high' : 'medium',
          action: device.health.predictions.batteryReplacement.action,
          parts: device.health.predictions.batteryReplacement.parts
        });
      }

      // Replacement recommendations
      if (device.health.predictions.deviceReplacement?.daysRemaining < 90) {
        analysis.replacementRecommendations.push({
          deviceId,
          deviceName: device.name,
          reason: device.health.predictions.deviceReplacement.reason,
          timeframe: `${device.health.predictions.deviceReplacement.daysRemaining} dagar`,
          confidence: device.health.predictions.deviceReplacement.confidence
        });
      }

      // Optimization opportunities
      if (device.metrics.signalStrength < -70) {
        analysis.optimizationOpportunities.push({
          deviceId,
          deviceName: device.name,
          type: 'positioning',
          description: 'Svag signal - överväg ompositionering',
          expectedBenefit: 'Förbättrad tillförlitlighet'
        });
      }
    }

    return analysis;
  }

  // ============================================
  // MAINTENANCE SCHEDULING
  // ============================================

  initializeMaintenanceSchedules() {
    // Set up recurring maintenance tasks
    for (const [deviceId, device] of this.devices) {
      const schedule = this.createMaintenanceSchedule(device);
      this.maintenanceSchedule.set(deviceId, schedule);
    }
  }

  createMaintenanceSchedule(device) {
    const tasks = [];

    // Battery replacement schedule
    if (device.batteryPowered) {
      tasks.push({
        type: 'battery_check',
        frequency: 'monthly',
        nextDue: Date.now() + 30 * 24 * 60 * 60 * 1000,
        description: 'Kontrollera batterinivå'
      });
    }

    // General health check
    tasks.push({
      type: 'health_check',
      frequency: 'quarterly',
      nextDue: Date.now() + 90 * 24 * 60 * 60 * 1000,
      description: 'Allmän hälsokontroll'
    });

    // Firmware update check
    tasks.push({
      type: 'firmware_check',
      frequency: 'monthly',
      nextDue: Date.now() + 30 * 24 * 60 * 60 * 1000,
      description: 'Sök efter firmware-uppdateringar'
    });

    return tasks;
  }

  async getUpcomingMaintenance(days = 30) {
    const upcoming = [];
    const cutoff = Date.now() + days * 24 * 60 * 60 * 1000;

    for (const [deviceId, schedule] of this.maintenanceSchedule) {
      const device = this.devices.get(deviceId);
      
      for (const task of schedule) {
        if (task.nextDue <= cutoff) {
          upcoming.push({
            deviceId,
            deviceName: device.name,
            task: task.description,
            type: task.type,
            dueDate: new Date(task.nextDue).toISOString(),
            daysUntilDue: Math.round((task.nextDue - Date.now()) / (24 * 60 * 60 * 1000)),
            overdue: task.nextDue < Date.now()
          });
        }
      }
    }

    return upcoming.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  }

  async completeMaintenance(deviceId, taskType) {
    const schedule = this.maintenanceSchedule.get(deviceId);
    
    if (!schedule) {
      return { success: false, error: 'Device not found' };
    }

    const task = schedule.find(t => t.type === taskType);
    
    if (!task) {
      return { success: false, error: 'Task not found' };
    }

    // Reschedule based on frequency
    const intervals = {
      daily: 1,
      weekly: 7,
      monthly: 30,
      quarterly: 90,
      yearly: 365
    };

    task.nextDue = Date.now() + intervals[task.frequency] * 24 * 60 * 60 * 1000;

    return {
      success: true,
      nextDue: new Date(task.nextDue).toISOString()
    };
  }

  // ============================================
  // ALERT MANAGEMENT
  // ============================================

  generateAlert(deviceId, healthData) {
    const device = this.devices.get(deviceId);
    
    // Check if similar alert already exists
    const existingAlert = this.alerts.find(a => 
      a.deviceId === deviceId && 
      a.status === 'active' &&
      Date.now() - a.timestamp < 24 * 60 * 60 * 1000 // Within 24h
    );

    if (existingAlert) return;

    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      deviceId,
      deviceName: device.name,
      severity: healthData.status,
      issues: healthData.issues,
      status: 'active', // active, acknowledged, resolved
      recommendations: this.generateRecommendations(device, healthData)
    };

    this.alerts.push(alert);

    // Trim old alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }

    return alert;
  }

  generateRecommendations(device, healthData) {
    const recommendations = [];

    for (const issue of healthData.issues) {
      switch (issue.type) {
        case 'battery':
          recommendations.push({
            action: 'replace_battery',
            description: `Byt batteri (${device.batteryType})`,
            urgency: issue.severity,
            estimatedCost: '50 kr'
          });
          break;

        case 'signal':
          recommendations.push({
            action: 'reposition',
            description: 'Flytta enheten närmare nätverks-hub',
            urgency: 'medium',
            estimatedTime: '5 min'
          });
          break;

        case 'offline':
          recommendations.push({
            action: 'reconnect',
            description: 'Försök återansluta enheten',
            urgency: 'high',
            steps: [
              '1. Kontrollera strömförsörjning',
              '2. Starta om enheten',
              '3. Kontrollera nätverksanslutning'
            ]
          });
          break;

        case 'age':
          recommendations.push({
            action: 'plan_replacement',
            description: 'Planera för enhetsutbyte',
            urgency: 'low',
            timeframe: '1-3 månader'
          });
          break;
      }
    }

    return recommendations;
  }

  // ============================================
  // REPORTING & ANALYTICS
  // ============================================

  async getHealthReport() {
    const devices = Array.from(this.devices.values());
    
    return {
      summary: {
        total: devices.length,
        healthy: devices.filter(d => d.health.status === 'healthy').length,
        warning: devices.filter(d => d.health.status === 'warning').length,
        critical: devices.filter(d => d.health.status === 'critical').length,
        offline: devices.filter(d => d.health.status === 'offline').length,
        averageHealth: Math.round(
          devices.reduce((sum, d) => sum + d.health.score, 0) / devices.length
        )
      },
      devicesByStatus: {
        healthy: devices.filter(d => d.health.status === 'healthy').map(d => d.name),
        warning: devices.filter(d => d.health.status === 'warning').map(d => d.name),
        critical: devices.filter(d => d.health.status === 'critical').map(d => d.name),
        offline: devices.filter(d => d.health.status === 'offline').map(d => d.name)
      },
      activeAlerts: this.alerts.filter(a => a.status === 'active').length,
      upcomingMaintenance: await this.getUpcomingMaintenance(30),
      predictions: await this.runPredictiveAnalysis()
    };
  }

  async getDeviceDetails(deviceId) {
    const device = this.devices.get(deviceId);
    
    if (!device) {
      return { error: 'Device not found' };
    }

    return {
      device: {
        id: device.id,
        name: device.name,
        type: device.type,
        zone: device.zone,
        manufacturer: device.manufacturer,
        model: device.model
      },
      health: device.health,
      metrics: device.metrics,
      usage: device.usage,
      maintenance: this.maintenanceSchedule.get(deviceId),
      history: this.healthHistory
        .filter(h => h.deviceId === deviceId)
        .slice(-30) // Last 30 records
    };
  }

  // ============================================
  // LOGGING
  // ============================================

  logHealthStatus(deviceId, healthData) {
    this.healthHistory.push({
      deviceId,
      timestamp: Date.now(),
      status: healthData.status,
      score: healthData.score,
      issueCount: healthData.issues.length
    });

    // Trim history
    if (this.healthHistory.length > this.maxHistorySize) {
      this.healthHistory = this.healthHistory.slice(-this.maxHistorySize);
    }
  }

  // ============================================
  // PUBLIC API
  // ============================================

  getAllDevicesHealth() {
    return Array.from(this.devices.entries()).map(([id, device]) => ({
      id,
      name: device.name,
      type: device.type,
      zone: device.zone,
      status: device.health.status,
      score: device.health.score,
      batteryLevel: device.metrics.batteryLevel,
      lastCheck: device.health.lastCheck
    }));
  }

  getActiveAlerts() {
    return this.alerts.filter(a => a.status === 'active');
  }

  async acknowledgeAlert(alertId) {
    const alert = this.alerts.find(a => a.id === alertId);
    
    if (alert) {
      alert.status = 'acknowledged';
      alert.acknowledgedAt = Date.now();
      return { success: true };
    }

    return { success: false, error: 'Alert not found' };
  }

  async resolveAlert(alertId) {
    const alert = this.alerts.find(a => a.id === alertId);
    
    if (alert) {
      alert.status = 'resolved';
      alert.resolvedAt = Date.now();
      return { success: true };
    }

    return { success: false, error: 'Alert not found' };
  }

  destroy() {
    if (this._intervals) {
      this._intervals.forEach(id => clearInterval(id));
      this._intervals = [];
    }
  }
}

module.exports = DeviceHealthMonitor;
