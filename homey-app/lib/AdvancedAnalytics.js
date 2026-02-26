'use strict';

/**
 * @typedef {'30d'|'60d'|'7d'|'24h'|string} AnalyticsPeriod
 * Period string: number + unit (d=days, w=weeks, m=months, e.g. '7d', '2w', '1m')
 */

/**
 * @typedef {object} EnergyData
 * @property {number} total - Total kWh consumed in period
 * @property {number} average - Average daily kWh
 * @property {number} peak - Peak daily kWh
 * @property {number[]} daily - Per-day consumption array
 * @property {number} totalCost - Total cost in local currency
 * @property {number} averageCost - Average daily cost
 */

/**
 * @typedef {object} EnergyInsight
 * @property {'trend'|'peak'|'optimization'} type - Insight category
 * @property {'info'|'warning'|'positive'} severity - Severity level
 * @property {{en: string, sv: string}} message - Localised message
 */

/**
 * Advanced Analytics Engine
 *
 * Provides deep insights, trends analysis, and performance metrics across
 * energy, devices, automations, presence, climate, and comparative dimensions.
 */
class AdvancedAnalytics {
  /**
   * @param {import('homey').Homey} homey - Homey application instance
   */
  constructor(homey) {
    this.homey = homey;
    this.metrics = new Map();
    this.trends = new Map();
    this.benchmarks = new Map();
  }

  /**
   * Load persisted metrics and trends, then start the background collection interval.
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      this.log('Initializing Advanced Analytics...');

      // Load historical metrics
      this.metrics = new Map(await this.homey.settings.get('analyticsMetrics') || []);
      this.trends = new Map(await this.homey.settings.get('analyticsTrends') || []);

      // Start collecting metrics
      this.startMetricsCollection();

      this.log('Advanced Analytics initialized');
    } catch (error) {
      console.error(`[AdvancedAnalytics] Failed to initialize:`, error.message);
    }
  }

  // ============================================
  // ENERGY ANALYTICS
  // ============================================

  /**
   * Return a comprehensive energy analytics report for the given period.
   *
   * @param {AnalyticsPeriod} [period='30d'] - Analysis period
   * @returns {Promise<{consumption: object, cost: object, efficiency: object, breakdown: object, insights: EnergyInsight[]}>}
   */
  async getEnergyAnalytics(period = '30d') {
    const data = await this.collectEnergyData(period);
    
    return {
      consumption: {
        total: data.total,
        average: data.average,
        peak: data.peak,
        trend: this.calculateTrend(data.daily),
        forecast: await this.forecastEnergy(data)
      },
      cost: {
        total: data.totalCost,
        average: data.averageCost,
        savings: await this.calculatePotentialSavings(data),
        comparison: await this.compareWithBenchmark(data)
      },
      efficiency: {
        score: await this.calculateEfficiencyScore(data),
        improvements: await this.identifyImprovements(data),
        goals: await this.evaluateEnergyGoals(data)
      },
      breakdown: {
        byDevice: await this.getConsumptionByDevice(period),
        byZone: await this.getConsumptionByZone(period),
        byTime: await this.getConsumptionByTime(period)
      },
      insights: await this.generateEnergyInsights(data)
    };
  }

  async collectEnergyData(period) {
    const days = this.parsePeriodToDays(period);
    const daily = [];
    let total = 0;
    let totalCost = 0;
    
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayData = await this.homey.app.energyManager.getHistoricalData(date);
      
      daily.push(dayData.consumption);
      total += dayData.consumption;
      totalCost += dayData.cost || dayData.consumption * 1.5;
    }

    return {
      total,
      average: total / days,
      peak: Math.max(...daily),
      daily,
      totalCost,
      averageCost: totalCost / days
    };
  }

  async forecastEnergy(data) {
    const trend = this.calculateTrend(data.daily);
    const seasonal = this.calculateSeasonalFactor();
    
    return {
      nextDay: data.average + trend * seasonal,
      nextWeek: (data.average + trend * 3) * 7,
      nextMonth: (data.average + trend * 15) * 30,
      confidence: this.calculateForecastConfidence(data)
    };
  }

  async calculateEfficiencyScore(data) {
    const benchmark = await this.getEnergyBenchmark();
    const efficiency = (benchmark.average / data.average) * 100;
    
    return {
      score: Math.min(Math.round(efficiency), 100),
      rating: this.getEfficiencyRating(efficiency),
      comparison: {
        vsAverage: ((data.average - benchmark.average) / benchmark.average) * 100,
        vsOptimal: ((data.average - benchmark.optimal) / benchmark.optimal) * 100
      }
    };
  }

  // ============================================
  // DEVICE ANALYTICS
  // ============================================

  /**
   * Return health, usage, performance, and maintenance analytics for all devices.
   *
   * @returns {Promise<{overview: object, health: object, usage: object, performance: object, maintenance: object[]}>}
   */
  async getDeviceAnalytics() {
    const devices = await this.homey.app.deviceManager.getAllDevices();
    
    return {
      overview: {
        total: devices.length,
        active: devices.filter(d => d.available).length,
        inactive: devices.filter(d => !d.available).length,
        byClass: this.groupByClass(devices),
        byZone: this.groupByZone(devices)
      },
      health: await this.analyzeDeviceHealth(devices),
      usage: await this.analyzeDeviceUsage(devices),
      performance: await this.analyzeDevicePerformance(devices),
      maintenance: await this.generateMaintenanceRecommendations(devices)
    };
  }

  /**
   * Analyse health scores for all devices by checking availability, battery, and
   * last-communication age.
   *
   * @param {object[]} devices - Array of Homey device objects
   * @returns {Promise<{overall: number, byDevice: object[], issues: object[], recommendations: object[]}>}
   */
  async analyzeDeviceHealth(devices) {
    const health = {
      overall: 0,
      byDevice: [],
      issues: [],
      recommendations: []
    };

    for (const device of devices) {
      const deviceHealth = {
        id: device.id,
        name: device.name,
        score: 100,
        factors: []
      };

      // Check availability
      if (!device.available) {
        deviceHealth.score -= 50;
        deviceHealth.factors.push('offline');
        health.issues.push({
          deviceId: device.id,
          severity: 'high',
          issue: 'Device offline'
        });
      }

      // Check battery
      if (device.capabilities?.includes('measure_battery')) {
        const battery = await device.getCapabilityValue('measure_battery');
        if (battery < 20) {
          deviceHealth.score -= 30;
          deviceHealth.factors.push('low_battery');
          health.issues.push({
            deviceId: device.id,
            severity: 'medium',
            issue: `Low battery: ${battery}%`
          });
        }
      }

      // Check last communication
      if (device.lastSeen) {
        const hoursSinceLastSeen = (Date.now() - device.lastSeen) / (1000 * 60 * 60);
        if (hoursSinceLastSeen > 24) {
          deviceHealth.score -= 20;
          deviceHealth.factors.push('poor_communication');
        }
      }

      health.byDevice.push(deviceHealth);
    }

    health.overall = health.byDevice.reduce((sum, d) => sum + d.score, 0) / devices.length;
    
    return health;
  }

  /**
   * Rank devices by usage frequency and compute aggregate usage statistics.
   *
   * @param {object[]} devices - Array of Homey device objects
   * @returns {Promise<{mostUsed: object[], leastUsed: object[], patterns: object[], statistics: object}>}
   */
  async analyzeDeviceUsage(devices) {
    const usage = {
      mostUsed: [],
      leastUsed: [],
      patterns: [],
      statistics: {}
    };

    const usageData = [];

    for (const device of devices) {
      const metrics = await this.getDeviceUsageMetrics(device.id);
      usageData.push({
        device: device.name,
        deviceId: device.id,
        activations: metrics.activations,
        totalTime: metrics.totalTime,
        avgPerDay: metrics.avgPerDay
      });
    }

    usageData.sort((a, b) => b.activations - a.activations);
    
    usage.mostUsed = usageData.slice(0, 10);
    usage.leastUsed = usageData.slice(-10).reverse();
    usage.statistics = {
      totalActivations: usageData.reduce((sum, d) => sum + d.activations, 0),
      avgActivationsPerDevice: usageData.reduce((sum, d) => sum + d.activations, 0) / devices.length
    };

    return usage;
  }

  /**
   * Analyse response time, reliability, and energy efficiency for all devices.
   *
   * @param {object[]} devices - Array of Homey device objects
   * @returns {Promise<{responseTime: object, reliability: object, efficiency: object}>}
   */
  async analyzeDevicePerformance(devices) {
    return {
      responseTime: await this.analyzeResponseTimes(devices),
      reliability: await this.analyzeReliability(devices),
      efficiency: await this.analyzeDeviceEfficiency(devices)
    };
  }

  // ============================================
  // AUTOMATION ANALYTICS
  // ============================================

  /**
   * Return performance, effectiveness, optimization, and insight analytics for all automations.
   *
   * @returns {Promise<{overview: object, performance: object, effectiveness: object, optimization: object, insights: object[]}>}
   */
  async getAutomationAnalytics() {
    const automations = this.homey.app.automationEngine?.automations || new Map();
    const executions = this.homey.app.automationEngine?.executionHistory || [];

    return {
      overview: {
        total: automations.size,
        enabled: Array.from(automations.values()).filter(a => a.enabled).length,
        disabled: Array.from(automations.values()).filter(a => !a.enabled).length
      },
      performance: await this.analyzeAutomationPerformance(automations, executions),
      effectiveness: await this.analyzeAutomationEffectiveness(executions),
      optimization: await this.generateAutomationOptimizations(automations, executions),
      insights: await this.generateAutomationInsights(automations, executions)
    };
  }

  /**
   * Compute per-automation and aggregate success/failure metrics.
   *
   * @param {Map<string, object>} automations - Map of automation ID → automation object
   * @param {object[]} executions - Flat execution history array
   * @returns {Promise<{byAutomation: object[], overall: object}>}
   */
  async analyzeAutomationPerformance(automations, executions) {
    const performance = {
      byAutomation: [],
      overall: {
        totalExecutions: executions.length,
        successRate: 0,
        avgExecutionTime: 0,
        failureRate: 0
      }
    };

    automations.forEach((automation, id) => {
      const autoExecutions = executions.filter(e => e.automationId === id);
      const successful = autoExecutions.filter(e => e.outcome.success);

      performance.byAutomation.push({
        id,
        name: automation.name,
        executions: autoExecutions.length,
        successRate: autoExecutions.length > 0 ? (successful.length / autoExecutions.length) * 100 : 0,
        avgExecutionTime: automation.statistics.averageExecutionTime || 0,
        lastExecuted: automation.statistics.lastExecuted
      });
    });

    const totalSuccess = executions.filter(e => e.outcome.success).length;
    performance.overall.successRate = executions.length > 0 ? (totalSuccess / executions.length) * 100 : 0;
    performance.overall.failureRate = 100 - performance.overall.successRate;

    return performance;
  }

  /**
   * Analyse automation effectiveness by time-of-day, trigger type, and user satisfaction.
   *
   * @param {object[]} executions - Flat execution history array
   * @returns {Promise<{timeBasedEffectiveness: object[], triggerEffectiveness: object[], userSatisfaction: number}>}
   */
  async analyzeAutomationEffectiveness(executions) {
    const timeBasedAnalysis = this.analyzeExecutionsByTime(executions);
    const triggerAnalysis = this.analyzeExecutionsByTrigger(executions);
    
    return {
      timeBasedEffectiveness: timeBasedAnalysis,
      triggerEffectiveness: triggerAnalysis,
      userSatisfaction: await this.estimateUserSatisfaction(executions)
    };
  }

  analyzeExecutionsByTime(executions) {
    const hourly = Array(24).fill(0);
    const successful = Array(24).fill(0);

    executions.forEach(exec => {
      const hour = new Date(exec.timestamp).getHours();
      hourly[hour]++;
      if (exec.outcome.success) {
        successful[hour]++;
      }
    });

    return hourly.map((total, hour) => ({
      hour,
      executions: total,
      successRate: total > 0 ? (successful[hour] / total) * 100 : 0
    }));
  }

  analyzeExecutionsByTrigger(executions) {
    const triggers = new Map();

    executions.forEach(exec => {
      const trigger = exec.reason || 'unknown';
      if (!triggers.has(trigger)) {
        triggers.set(trigger, { total: 0, successful: 0 });
      }
      const data = triggers.get(trigger);
      data.total++;
      if (exec.outcome.success) {
        data.successful++;
      }
    });

    return Array.from(triggers.entries()).map(([trigger, data]) => ({
      trigger,
      executions: data.total,
      successRate: (data.successful / data.total) * 100
    }));
  }

  // ============================================
  // PRESENCE & BEHAVIOR ANALYTICS
  // ============================================

  /**
   * Return occupancy patterns, zone usage, and presence predictions for the period.
   *
   * @param {AnalyticsPeriod} [period='30d'] - Analysis period
   * @returns {Promise<{patterns: object, occupancy: object, zones: object, predictions: object}>}
   */
  async getPresenceAnalytics(period = '30d') {
    const days = this.parsePeriodToDays(period);
    const presenceData = [];

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayData = await this.getPresenceDataForDay(date);
      presenceData.push(dayData);
    }

    return {
      patterns: this.analyzePresencePatterns(presenceData),
      occupancy: this.calculateOccupancyRates(presenceData),
      zones: this.analyzeZoneUsage(presenceData),
      predictions: await this.predictPresence(presenceData)
    };
  }

  analyzePresencePatterns(data) {
    const patterns = {
      weekday: { home: 0, away: 0 },
      weekend: { home: 0, away: 0 },
      hourlyPresence: Array(24).fill(0)
    };

    data.forEach(day => {
      const isWeekend = day.dayOfWeek === 0 || day.dayOfWeek === 6;
      const target = isWeekend ? patterns.weekend : patterns.weekday;
      
      target.home += day.hoursHome;
      target.away += day.hoursAway;

      day.hourlyData?.forEach((present, hour) => {
        if (present) patterns.hourlyPresence[hour]++;
      });
    });

    return patterns;
  }

  // ============================================
  // CLIMATE ANALYTICS
  // ============================================

  /**
   * Return temperature, humidity, efficiency, comfort, and climate recommendations.
   *
   * @param {AnalyticsPeriod} [period='30d'] - Analysis period
   * @returns {Promise<{temperature: object, humidity: object, efficiency: object, comfort: object, recommendations: object[]}>}
   */
  async getClimateAnalytics(period = '30d') {
    return {
      temperature: await this.analyzeTemperatureTrends(period),
      humidity: await this.analyzeHumidityTrends(period),
      efficiency: await this.analyzeClimateEfficiency(period),
      comfort: await this.analyzeComfortLevels(period),
      recommendations: await this.generateClimateRecommendations()
    };
  }

  async analyzeTemperatureTrends(period) {
    const days = this.parsePeriodToDays(period);
    const data = [];

    for (let i = 0; i < days; i++) {
      const temp = await this.getAverageTemperatureForDay(i);
      data.push(temp);
    }

    return {
      data,
      average: this.calculateAverage(data),
      trend: this.calculateTrend(data),
      variance: this.calculateVariance(data),
      optimal: 21.5
    };
  }

  // ============================================
  // COMPARATIVE ANALYTICS
  // ============================================

  /**
   * Compare current performance across energy, efficiency, cost, and device metrics
   * against previous periods and benchmarks.
   *
   * @returns {Promise<{energyComparison: object, efficiencyComparison: object, costComparison: object, performanceComparison: object}>}
   */
  async getComparativeAnalytics() {
    return {
      energyComparison: await this.compareEnergyUsage(),
      efficiencyComparison: await this.compareEfficiency(),
      costComparison: await this.compareCosts(),
      performanceComparison: await this.comparePerformance()
    };
  }

  async compareEnergyUsage() {
    const current = await this.collectEnergyData('30d');
    const previous = await this.collectEnergyData('60d');
    const benchmark = await this.getEnergyBenchmark();

    return {
      vsPreviousPeriod: {
        change: ((current.average - previous.average) / previous.average) * 100,
        trend: current.average > previous.average ? 'increasing' : 'decreasing'
      },
      vsBenchmark: {
        change: ((current.average - benchmark.average) / benchmark.average) * 100,
        performance: current.average < benchmark.average ? 'above_average' : 'below_average'
      }
    };
  }

  // ============================================
  // INSIGHTS GENERATION
  // ============================================

  /**
   * Generate actionable insights across all major system domains.
   *
   * @returns {Promise<{energy: EnergyInsight[], devices: object[], automation: object[], comfort: object[], security: object[], optimization: object[]}>}
   */
  async generateComprehensiveInsights() {
    return {
      energy: await this.generateEnergyInsights(),
      devices: await this.generateDeviceInsights(),
      automation: await this.generateAutomationInsights(),
      comfort: await this.generateComfortInsights(),
      security: await this.generateSecurityInsights(),
      optimization: await this.generateOptimizationInsights()
    };
  }

  /**
   * Generate energy-specific insights from collected data.
   *
   * When `data` is not provided the last 30 days are fetched automatically.
   * Produces trend warnings and peak-consumption observations.
   *
   * @param {EnergyData|null} [data=null] - Pre-collected energy data, or null to auto-fetch
   * @returns {Promise<EnergyInsight[]>} Array of insight objects
   */
  async generateEnergyInsights(data = null) {
    if (!data) {
      data = await this.collectEnergyData('30d');
    }

    const insights = [];

    // Trend insight
    const trend = this.calculateTrend(data.daily);
    if (Math.abs(trend) > 0.5) {
      insights.push({
        type: 'trend',
        severity: trend > 0 ? 'warning' : 'positive',
        message: {
          en: trend > 0 
            ? `Energy consumption is increasing by ${trend.toFixed(1)}kWh per day`
            : `Energy consumption is decreasing by ${Math.abs(trend).toFixed(1)}kWh per day`,
          sv: trend > 0
            ? `Energiförbrukningen ökar med ${trend.toFixed(1)}kWh per dag`
            : `Energiförbrukningen minskar med ${Math.abs(trend).toFixed(1)}kWh per dag`
        }
      });
    }

    // Peak usage insight
    if (data.peak > data.average * 1.5) {
      insights.push({
        type: 'peak',
        severity: 'info',
        message: {
          en: `Peak consumption (${data.peak.toFixed(1)}kWh) is ${((data.peak / data.average - 1) * 100).toFixed(0)}% above average`,
          sv: `Toppförbrukning (${data.peak.toFixed(1)}kWh) är ${((data.peak / data.average - 1) * 100).toFixed(0)}% över genomsnittet`
        }
      });
    }

    return insights;
  }

  /**
   * Identify inefficient devices and produce prioritised optimisation recommendations.
   *
   * @returns {Promise<object[]>} Optimisation insight objects with action payloads
   */
  async generateOptimizationInsights() {
    const insights = [];
    
    // Check for optimization opportunities
    const inefficientDevices = await this.findInefficientDevices();
    if (inefficientDevices.length > 0) {
      insights.push({
        type: 'optimization',
        priority: 'high',
        message: {
          en: `${inefficientDevices.length} devices could be optimized for better efficiency`,
          sv: `${inefficientDevices.length} enheter kan optimeras för bättre effektivitet`
        },
        action: {
          type: 'optimize_devices',
          devices: inefficientDevices
        }
      });
    }

    return insights;
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  startMetricsCollection() {
    this.collectionInterval = setInterval(async () => {
      await this.collectMetrics();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  async collectMetrics() {
    const timestamp = Date.now();
    
    this.metrics.set(timestamp, {
      energy: await this.getCurrentEnergyUsage(),
      temperature: await this.getAverageTemperature(),
      devices: await this.getActiveDeviceCount(),
      automations: await this.getActiveAutomationCount()
    });

    // Keep only last 7 days
    const cutoff = timestamp - (7 * 24 * 60 * 60 * 1000);
    for (const [time] of this.metrics) {
      if (time < cutoff) {
        this.metrics.delete(time);
      }
    }

    await this.saveMetrics();
  }

  parsePeriodToDays(period) {
    const match = period.match(/(\d+)([d|w|m])/);
    if (!match) return 30;
    
    const [, num, unit] = match;
    const value = parseInt(num);
    
    switch (unit) {
      case 'd': return value;
      case 'w': return value * 7;
      case 'm': return value * 30;
      default: return 30;
    }
  }

  calculateTrend(values) {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const indices = Array.from({ length: n }, (_, i) => i);
    
    const sumX = indices.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = indices.reduce((sum, x, i) => sum + x * values[i], 0);
    const sumX2 = indices.reduce((sum, x) => sum + x * x, 0);
    
    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  }

  calculateAverage(values) {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  calculateVariance(values) {
    const avg = this.calculateAverage(values);
    const squareDiffs = values.map(v => Math.pow(v - avg, 2));
    return Math.sqrt(this.calculateAverage(squareDiffs));
  }

  calculateSeasonalFactor() {
    const month = new Date().getMonth();
    // Winter months need more energy
    if (month >= 11 || month <= 2) return 1.3;
    if (month >= 5 && month <= 8) return 0.9;
    return 1.0;
  }

  calculateForecastConfidence(data) {
    const variance = this.calculateVariance(data.daily);
    const baseConfidence = 0.8;
    const variancePenalty = Math.min(variance / data.average, 0.3);
    return Math.max(baseConfidence - variancePenalty, 0.5);
  }

  getEfficiencyRating(score) {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'average';
    if (score >= 45) return 'poor';
    return 'very_poor';
  }

  groupByClass(devices) {
    const grouped = {};
    devices.forEach(device => {
      const cls = device.class || 'other';
      grouped[cls] = (grouped[cls] || 0) + 1;
    });
    return grouped;
  }

  groupByZone(devices) {
    const grouped = {};
    devices.forEach(device => {
      const zone = device.zone?.name || 'Unknown';
      grouped[zone] = (grouped[zone] || 0) + 1;
    });
    return grouped;
  }

  async getEnergyBenchmark() {
    return {
      average: 25, // kWh per day
      optimal: 18,
      poor: 35
    };
  }

  async getCurrentEnergyUsage() {
    return await this.homey.app.energyManager?.getCurrentConsumption('total') || 0;
  }

  async getAverageTemperature() {
    return 21; // Placeholder
  }

  async getActiveDeviceCount() {
    const devicesObj = await this.homey.app.deviceManager?.getDevices?.() || {};
    const devices = Object.values(devicesObj);
    return devices.filter(d => d.available).length;
  }

  async getActiveAutomationCount() {
    const automations = this.homey.app.automationEngine?.automations || new Map();
    return Array.from(automations.values()).filter(a => a.enabled).length;
  }

  async saveMetrics() {
    await this.homey.settings.set('analyticsMetrics', Array.from(this.metrics.entries()));
  }

  log(...args) {
    console.log('[AdvancedAnalytics]', ...args);
  }

  error(...args) {
    console.error('[AdvancedAnalytics]', ...args);
  }
}

module.exports = AdvancedAnalytics;
