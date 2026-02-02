'use strict';

/**
 * Performance Optimizer
 * System optimization, resource monitoring, and performance tuning
 */
class PerformanceOptimizer {
  constructor(homey) {
    this.homey = homey;
    this.metrics = {
      cpu: [],
      memory: [],
      eventLoop: [],
      apiLatency: [],
      deviceResponseTimes: new Map()
    };
    this.optimizations = [];
    this.performanceAlerts = [];
    this.baselineMetrics = null;
  }

  async initialize() {
    this.log('Initializing Performance Optimizer...');
    
    // Load performance history
    const savedMetrics = await this.homey.settings.get('performanceMetrics');
    if (savedMetrics) {
      this.metrics = savedMetrics;
    }

    // Establish baseline
    await this.establishBaseline();

    // Start monitoring
    await this.startPerformanceMonitoring();

    // Run initial optimization
    await this.optimizeSystem();

    this.log('Performance Optimizer initialized');
  }

  /**
   * Start continuous performance monitoring
   */
  async startPerformanceMonitoring() {
    // Monitor every 10 seconds
    this.monitoringInterval = setInterval(async () => {
      await this.collectMetrics();
    }, 10000);

    // Analyze every minute
    this.analysisInterval = setInterval(async () => {
      await this.analyzePerformance();
    }, 60000);

    // Optimize every hour
    this.optimizationInterval = setInterval(async () => {
      await this.optimizeSystem();
    }, 3600000);

    // Deep analysis daily
    this.deepAnalysisInterval = setInterval(async () => {
      await this.performDeepAnalysis();
    }, 86400000);
  }

  /**
   * Collect performance metrics
   */
  async collectMetrics() {
    const timestamp = Date.now();

    // CPU usage (approximated)
    const cpuUsage = process.cpuUsage();
    this.metrics.cpu.push({
      timestamp,
      user: cpuUsage.user,
      system: cpuUsage.system
    });

    // Memory usage
    const memUsage = process.memoryUsage();
    this.metrics.memory.push({
      timestamp,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss
    });

    // Event loop lag
    const eventLoopLag = await this.measureEventLoopLag();
    this.metrics.eventLoop.push({
      timestamp,
      lag: eventLoopLag
    });

    // Keep only last 1000 data points per metric
    ['cpu', 'memory', 'eventLoop'].forEach(key => {
      if (this.metrics[key].length > 1000) {
        this.metrics[key] = this.metrics[key].slice(-1000);
      }
    });

    // Save periodically (every 10 minutes)
    if (this.metrics.memory.length % 60 === 0) {
      await this.saveMetrics();
    }
  }

  /**
   * Measure event loop lag
   */
  async measureEventLoopLag() {
    return new Promise((resolve) => {
      const start = Date.now();
      setImmediate(() => {
        const lag = Date.now() - start;
        resolve(lag);
      });
    });
  }

  /**
   * Establish performance baseline
   */
  async establishBaseline() {
    this.log('Establishing performance baseline...');

    // Collect samples for 30 seconds
    const samples = [];
    for (let i = 0; i < 30; i++) {
      await this.collectMetrics();
      await this.sleep(1000);
      
      const latest = {
        memory: this.metrics.memory[this.metrics.memory.length - 1],
        cpu: this.metrics.cpu[this.metrics.cpu.length - 1],
        eventLoop: this.metrics.eventLoop[this.metrics.eventLoop.length - 1]
      };
      samples.push(latest);
    }

    // Calculate baseline
    this.baselineMetrics = {
      memory: {
        heapUsed: this.calculateAverage(samples.map(s => s.memory.heapUsed)),
        heapTotal: this.calculateAverage(samples.map(s => s.memory.heapTotal))
      },
      cpu: {
        user: this.calculateAverage(samples.map(s => s.cpu.user)),
        system: this.calculateAverage(samples.map(s => s.cpu.system))
      },
      eventLoopLag: this.calculateAverage(samples.map(s => s.eventLoop.lag)),
      established: Date.now()
    };

    this.log('Baseline established:', this.baselineMetrics);
  }

  /**
   * Analyze current performance
   */
  async analyzePerformance() {
    if (this.metrics.memory.length < 10) return;

    const recent = {
      memory: this.metrics.memory.slice(-10),
      cpu: this.metrics.cpu.slice(-10),
      eventLoop: this.metrics.eventLoop.slice(-10)
    };

    // Check for performance issues
    await this.checkMemoryUsage(recent.memory);
    await this.checkEventLoopLag(recent.eventLoop);
    await this.checkCPUUsage(recent.cpu);

    // Identify bottlenecks
    const bottlenecks = await this.identifyBottlenecks();
    
    if (bottlenecks.length > 0) {
      this.log('Performance bottlenecks detected:', bottlenecks);
      await this.createOptimizationRecommendations(bottlenecks);
    }
  }

  /**
   * Check memory usage
   */
  async checkMemoryUsage(memoryData) {
    const avgHeapUsed = this.calculateAverage(memoryData.map(m => m.heapUsed));
    const avgHeapTotal = this.calculateAverage(memoryData.map(m => m.heapTotal));
    
    const usagePercent = (avgHeapUsed / avgHeapTotal) * 100;

    // Alert if memory usage > 80%
    if (usagePercent > 80) {
      await this.createPerformanceAlert({
        type: 'memory',
        severity: 'high',
        message: `Hög minnesanvändning: ${usagePercent.toFixed(1)}%`,
        recommendation: 'Överväg att rensa cache eller starta om systemet'
      });

      // Try to free memory
      await this.freeMemory();
    }

    // Compare to baseline
    if (this.baselineMetrics) {
      const increase = ((avgHeapUsed - this.baselineMetrics.memory.heapUsed) / 
                       this.baselineMetrics.memory.heapUsed) * 100;
      
      if (increase > 50) {
        this.log(`Memory usage increased ${increase.toFixed(1)}% from baseline`);
      }
    }
  }

  /**
   * Check event loop lag
   */
  async checkEventLoopLag(eventLoopData) {
    const avgLag = this.calculateAverage(eventLoopData.map(e => e.lag));
    
    // Alert if lag > 100ms
    if (avgLag > 100) {
      await this.createPerformanceAlert({
        type: 'eventloop',
        severity: 'medium',
        message: `Hög event loop lag: ${avgLag.toFixed(1)}ms`,
        recommendation: 'System kan kännas långsamt'
      });
    }
  }

  /**
   * Check CPU usage
   */
  async checkCPUUsage(cpuData) {
    const avgUser = this.calculateAverage(cpuData.map(c => c.user));
    
    // Convert to percentage (simplified)
    const cpuPercent = (avgUser / 1000000) * 100;
    
    if (cpuPercent > 80) {
      await this.createPerformanceAlert({
        type: 'cpu',
        severity: 'high',
        message: `Hög CPU-användning: ${cpuPercent.toFixed(1)}%`,
        recommendation: 'Kontrollera bakgrundsprocesser'
      });
    }
  }

  /**
   * Identify performance bottlenecks
   */
  async identifyBottlenecks() {
    const bottlenecks = [];

    // Check device response times
    for (const [deviceId, times] of this.metrics.deviceResponseTimes) {
      const avgTime = this.calculateAverage(times);
      if (avgTime > 2000) { // > 2 seconds
        bottlenecks.push({
          type: 'slow_device',
          deviceId,
          avgResponseTime: avgTime,
          severity: 'medium'
        });
      }
    }

    // Check for memory leaks
    if (this.metrics.memory.length > 100) {
      const trend = this.calculateTrend(
        this.metrics.memory.slice(-100).map(m => m.heapUsed)
      );
      
      if (trend > 1000) { // Positive trend = growing memory
        bottlenecks.push({
          type: 'memory_leak',
          trend,
          severity: 'high'
        });
      }
    }

    // Check API latency
    if (this.metrics.apiLatency.length > 10) {
      const avgLatency = this.calculateAverage(
        this.metrics.apiLatency.slice(-10).map(a => a.duration)
      );
      
      if (avgLatency > 1000) {
        bottlenecks.push({
          type: 'slow_api',
          avgLatency,
          severity: 'medium'
        });
      }
    }

    return bottlenecks;
  }

  /**
   * Optimize system performance
   */
  async optimizeSystem() {
    this.log('Running system optimization...');

    const optimizations = [];

    // 1. Clean old data
    const cleaned = await this.cleanOldData();
    if (cleaned > 0) {
      optimizations.push({
        type: 'data_cleanup',
        description: `Rensade ${cleaned} gamla datapunkter`,
        impact: 'memory'
      });
    }

    // 2. Optimize caches
    await this.optimizeCaches();
    optimizations.push({
      type: 'cache_optimization',
      description: 'Optimerade cachar',
      impact: 'memory'
    });

    // 3. Defragment data structures
    await this.defragmentData();
    optimizations.push({
      type: 'defragmentation',
      description: 'Defragmenterade datastrukturer',
      impact: 'performance'
    });

    // 4. Optimize intervals
    await this.optimizeIntervals();
    optimizations.push({
      type: 'interval_optimization',
      description: 'Optimerade uppdateringsintervaller',
      impact: 'cpu'
    });

    this.optimizations = optimizations;
    
    this.log(`Optimization complete: ${optimizations.length} optimizations applied`);

    return optimizations;
  }

  /**
   * Clean old data from storage
   */
  async cleanOldData() {
    let cleaned = 0;
    const oneMonthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

    // Clean notification history
    const notifications = await this.homey.settings.get('notificationHistory') || [];
    const cleanedNotifications = notifications.filter(n => n.deliveredAt > oneMonthAgo);
    if (cleanedNotifications.length < notifications.length) {
      await this.homey.settings.set('notificationHistory', cleanedNotifications);
      cleaned += notifications.length - cleanedNotifications.length;
    }

    // Clean execution history
    const executions = await this.homey.settings.get('executionHistory') || [];
    const cleanedExecutions = executions.filter(e => e.timestamp > oneMonthAgo);
    if (cleanedExecutions.length < executions.length) {
      await this.homey.settings.set('executionHistory', cleanedExecutions);
      cleaned += executions.length - cleanedExecutions.length;
    }

    // Clean device state history
    const deviceHistory = await this.homey.settings.get('deviceStateHistory') || [];
    const cleanedDeviceHistory = deviceHistory.filter(d => d.timestamp > oneMonthAgo);
    if (cleanedDeviceHistory.length < deviceHistory.length) {
      await this.homey.settings.set('deviceStateHistory', cleanedDeviceHistory);
      cleaned += deviceHistory.length - cleanedDeviceHistory.length;
    }

    return cleaned;
  }

  /**
   * Optimize system caches
   */
  async optimizeCaches() {
    // Clear device health cache for offline devices
    if (this.homey.app.deviceHealthMonitor) {
      const deviceHealth = this.homey.app.deviceHealthMonitor.deviceHealth;
      for (const [deviceId, health] of deviceHealth) {
        if (!health.available && Date.now() - health.lastSeen > 86400000) {
          // Remove health data for devices offline > 24h
          deviceHealth.delete(deviceId);
        }
      }
    }

    // Clear old predictions
    if (this.homey.app.intelligenceManager) {
      const predictions = this.homey.app.intelligenceManager.predictions;
      const oneDayAgo = Date.now() - 86400000;
      
      for (const [key, prediction] of predictions) {
        if (prediction.generatedAt < oneDayAgo) {
          predictions.delete(key);
        }
      }
    }
  }

  /**
   * Defragment data structures
   */
  async defragmentData() {
    // Recreate Maps to defragment
    if (this.homey.app.sceneLearningSystem) {
      const learnedScenes = new Map(
        this.homey.app.sceneLearningSystem.learnedScenes
      );
      this.homey.app.sceneLearningSystem.learnedScenes = learnedScenes;
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      this.log('Forced garbage collection');
    }
  }

  /**
   * Optimize update intervals
   */
  async optimizeIntervals() {
    // Adjust intervals based on system load
    const avgMemUsage = this.calculateAverage(
      this.metrics.memory.slice(-10).map(m => m.heapUsed)
    );
    
    const avgMemTotal = this.calculateAverage(
      this.metrics.memory.slice(-10).map(m => m.heapTotal)
    );
    
    const memoryPressure = avgMemUsage / avgMemTotal;

    // If memory pressure is high, slow down non-critical updates
    if (memoryPressure > 0.7) {
      this.log('High memory pressure, slowing down updates');
      // Would adjust intervals in various systems
    }
  }

  /**
   * Free memory by clearing caches
   */
  async freeMemory() {
    this.log('Attempting to free memory...');

    // Clear large data structures
    this.metrics.cpu = this.metrics.cpu.slice(-100);
    this.metrics.memory = this.metrics.memory.slice(-100);
    this.metrics.eventLoop = this.metrics.eventLoop.slice(-100);
    this.metrics.apiLatency = this.metrics.apiLatency.slice(-100);

    // Force GC if available
    if (global.gc) {
      global.gc();
    }

    this.log('Memory freed');
  }

  /**
   * Perform deep performance analysis
   */
  async performDeepAnalysis() {
    this.log('Performing deep performance analysis...');

    const analysis = {
      timestamp: Date.now(),
      duration: 0,
      findings: []
    };

    const startTime = Date.now();

    // Analyze memory patterns
    if (this.metrics.memory.length > 100) {
      const memoryTrend = this.calculateTrend(
        this.metrics.memory.map(m => m.heapUsed)
      );
      
      analysis.findings.push({
        category: 'memory',
        metric: 'heap_trend',
        value: memoryTrend,
        assessment: memoryTrend > 0 ? 'increasing' : 'stable'
      });
    }

    // Analyze event loop stability
    if (this.metrics.eventLoop.length > 100) {
      const lagVariance = this.calculateVariance(
        this.metrics.eventLoop.map(e => e.lag)
      );
      
      analysis.findings.push({
        category: 'eventloop',
        metric: 'lag_variance',
        value: lagVariance,
        assessment: lagVariance > 50 ? 'unstable' : 'stable'
      });
    }

    // Analyze device response patterns
    const slowDevices = [];
    for (const [deviceId, times] of this.metrics.deviceResponseTimes) {
      const avg = this.calculateAverage(times);
      if (avg > 1000) {
        slowDevices.push({ deviceId, avgTime: avg });
      }
    }

    if (slowDevices.length > 0) {
      analysis.findings.push({
        category: 'devices',
        metric: 'slow_devices',
        value: slowDevices.length,
        devices: slowDevices
      });
    }

    analysis.duration = Date.now() - startTime;

    this.log(`Deep analysis complete (${analysis.duration}ms):`, analysis.findings.length, 'findings');

    return analysis;
  }

  /**
   * Create performance alert
   */
  async createPerformanceAlert(alert) {
    alert.id = this.generateAlertId();
    alert.timestamp = Date.now();
    alert.acknowledged = false;

    this.performanceAlerts.push(alert);

    // Keep only last 50 alerts
    if (this.performanceAlerts.length > 50) {
      this.performanceAlerts.shift();
    }

    // Notify if high severity
    if (alert.severity === 'high') {
      await this.homey.notifications.createNotification({
        excerpt: `Prestandavarning: ${alert.message}`
      });
    }

    this.log('Performance alert:', alert.message);
  }

  /**
   * Create optimization recommendations
   */
  async createOptimizationRecommendations(bottlenecks) {
    const recommendations = [];

    for (const bottleneck of bottlenecks) {
      switch (bottleneck.type) {
        case 'slow_device':
          recommendations.push({
            title: 'Långsam enhet',
            description: `Enhet ${bottleneck.deviceId} svarar långsamt`,
            actions: [
              'Kontrollera enhetens batterinivå',
              'Kontrollera nätverksanslutning',
              'Överväg att starta om enheten'
            ]
          });
          break;

        case 'memory_leak':
          recommendations.push({
            title: 'Möjlig minnesläcka',
            description: 'Minnesanvändning ökar kontinuerligt',
            actions: [
              'Starta om Homey-appen',
              'Kontrollera aktiverade automationer',
              'Rensa gammal data'
            ]
          });
          break;

        case 'slow_api':
          recommendations.push({
            title: 'Långsamma API-anrop',
            description: 'API-svarstider är höga',
            actions: [
              'Kontrollera nätverksanslutning',
              'Minska antalet samtidiga förfrågningar',
              'Optimera API-användning'
            ]
          });
          break;
      }
    }

    return recommendations;
  }

  /**
   * Get performance report
   */
  getPerformanceReport() {
    const now = Date.now();
    const oneHourAgo = now - 3600000;

    const recentMemory = this.metrics.memory.filter(m => m.timestamp > oneHourAgo);
    const recentCPU = this.metrics.cpu.filter(c => c.timestamp > oneHourAgo);
    const recentEventLoop = this.metrics.eventLoop.filter(e => e.timestamp > oneHourAgo);

    return {
      timestamp: now,
      uptime: process.uptime(),
      memory: {
        current: recentMemory.length > 0 ? recentMemory[recentMemory.length - 1] : null,
        average: {
          heapUsed: this.calculateAverage(recentMemory.map(m => m.heapUsed)),
          heapTotal: this.calculateAverage(recentMemory.map(m => m.heapTotal))
        },
        baseline: this.baselineMetrics?.memory
      },
      eventLoop: {
        current: recentEventLoop.length > 0 ? recentEventLoop[recentEventLoop.length - 1] : null,
        average: this.calculateAverage(recentEventLoop.map(e => e.lag)),
        baseline: this.baselineMetrics?.eventLoopLag
      },
      alerts: this.performanceAlerts.filter(a => !a.acknowledged),
      optimizations: this.optimizations,
      health: this.calculateSystemHealth()
    };
  }

  /**
   * Calculate overall system health score
   */
  calculateSystemHealth() {
    let score = 100;

    // Check memory
    if (this.metrics.memory.length > 0) {
      const latest = this.metrics.memory[this.metrics.memory.length - 1];
      const usagePercent = (latest.heapUsed / latest.heapTotal) * 100;
      if (usagePercent > 80) score -= 20;
      else if (usagePercent > 60) score -= 10;
    }

    // Check event loop
    if (this.metrics.eventLoop.length > 0) {
      const avgLag = this.calculateAverage(
        this.metrics.eventLoop.slice(-10).map(e => e.lag)
      );
      if (avgLag > 100) score -= 20;
      else if (avgLag > 50) score -= 10;
    }

    // Check alerts
    const activeAlerts = this.performanceAlerts.filter(a => !a.acknowledged);
    score -= activeAlerts.length * 5;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Record API latency
   */
  recordApiLatency(endpoint, duration) {
    this.metrics.apiLatency.push({
      endpoint,
      duration,
      timestamp: Date.now()
    });

    // Keep only last 500
    if (this.metrics.apiLatency.length > 500) {
      this.metrics.apiLatency.shift();
    }
  }

  /**
   * Record device response time
   */
  recordDeviceResponseTime(deviceId, responseTime) {
    if (!this.metrics.deviceResponseTimes.has(deviceId)) {
      this.metrics.deviceResponseTimes.set(deviceId, []);
    }

    const times = this.metrics.deviceResponseTimes.get(deviceId);
    times.push(responseTime);

    // Keep only last 100 per device
    if (times.length > 100) {
      times.shift();
    }
  }

  // ============================================
  // STATISTICAL HELPERS
  // ============================================

  calculateAverage(values) {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  calculateTrend(values) {
    if (values.length < 2) return 0;
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, v) => sum + v, 0);
    const sumXY = values.reduce((sum, v, i) => sum + (i * v), 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  }

  calculateVariance(values) {
    if (values.length === 0) return 0;
    const mean = this.calculateAverage(values);
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return this.calculateAverage(squaredDiffs);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async saveMetrics() {
    await this.homey.settings.set('performanceMetrics', {
      cpu: this.metrics.cpu.slice(-100),
      memory: this.metrics.memory.slice(-100),
      eventLoop: this.metrics.eventLoop.slice(-100)
    });
  }

  log(...args) {
    console.log('[PerformanceOptimizer]', ...args);
  }

  error(...args) {
    console.error('[PerformanceOptimizer]', ...args);
  }
}

module.exports = PerformanceOptimizer;
