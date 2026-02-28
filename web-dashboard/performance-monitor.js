/**
 * Performance Monitor for Smart Home Pro
 * Tracks API performance, memory usage, and system health
 */

'use strict';

const os = require('os');
const v8 = require('v8');

class PerformanceMonitor {
  constructor(options = {}) {
    this.options = {
      metricsInterval: options.metricsInterval || 10000, // 10 seconds
      enableDetailedMetrics: options.enableDetailedMetrics !== false,
      ...options
    };

    this.metrics = {
      requests: {
        total: 0,
        success: 0,
        errors: 0,
        byEndpoint: new Map(),
        byMethod: new Map()
      },
      performance: {
        avgResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        responseTimes: []
      },
      system: {
        memory: {},
        cpu: {},
        uptime: 0
      }
    };

    // Start collecting system metrics
    this.startMetricsCollection();
  }

  /**
   * Express middleware for request tracking
   */
  trackRequest() {
    return (req, res, next) => {
      const startTime = process.hrtime.bigint();
      const endpoint = `${req.method} ${req.path}`;

      // Track request completion
      res.on('finish', () => {
        const duration = Number(process.hrtime.bigint() - startTime) / 1e6; // Convert to milliseconds
        this.recordRequest(endpoint, req.method, res.statusCode, duration);
      });

      next();
    };
  }

  /**
   * Record request metrics
   */
  recordRequest(endpoint, method, statusCode, duration) {
    // Update totals
    this.metrics.requests.total++;
    if (statusCode >= 200 && statusCode < 400) {
      this.metrics.requests.success++;
    } else {
      this.metrics.requests.errors++;
    }

    // Track by endpoint
    if (!this.metrics.requests.byEndpoint.has(endpoint)) {
      this.metrics.requests.byEndpoint.set(endpoint, {
        count: 0,
        avgTime: 0,
        errors: 0
      });
    }
    const endpointStats = this.metrics.requests.byEndpoint.get(endpoint);
    endpointStats.count++;
    endpointStats.avgTime = (endpointStats.avgTime * (endpointStats.count - 1) + duration) / endpointStats.count;
    if (statusCode >= 400) {
      endpointStats.errors++;
    }

    // Track by method
    if (!this.metrics.requests.byMethod.has(method)) {
      this.metrics.requests.byMethod.set(method, 0);
    }
    this.metrics.requests.byMethod.set(method, this.metrics.requests.byMethod.get(method) + 1);

    // Track response times
    this.metrics.performance.responseTimes.push(duration);

    // Keep only last 1000 response times
    if (this.metrics.performance.responseTimes.length > 1000) {
      this.metrics.performance.responseTimes.shift();
    }

    // Update running average incrementally (O(1) per request)
    const n = this.metrics.performance.responseTimes.length;
    this.metrics.performance.avgResponseTime =
      this.metrics.performance.avgResponseTime * ((n - 1) / n) + duration / n;

    // Mark percentiles as stale so they are recomputed on next read
    this._percentilesDirty = true;
  }

  /**
   * Recompute p95/p99 from the current response times buffer.
   * Called lazily on metric reads, not on every request write.
   */
  updatePerformanceStats() {
    const times = [...this.metrics.performance.responseTimes].sort((a, b) => a - b);

    if (times.length === 0) return;

    // Average (authoritative recalculation)
    this.metrics.performance.avgResponseTime =
      times.reduce((sum, t) => sum + t, 0) / times.length;

    // P95
    const p95Index = Math.floor(times.length * 0.95);
    this.metrics.performance.p95ResponseTime = times[p95Index] || 0;

    // P99
    const p99Index = Math.floor(times.length * 0.99);
    this.metrics.performance.p99ResponseTime = times[p99Index] || 0;

    this._percentilesDirty = false;
  }

  /**
   * Start collecting system metrics
   */
  startMetricsCollection() {
    this.metricsInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, this.options.metricsInterval);

    // Collect immediately
    this.collectSystemMetrics();
  }

  /**
   * Collect system metrics
   */
  collectSystemMetrics() {
    // Memory metrics
    const memUsage = process.memoryUsage();
    this.metrics.system.memory = {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsagePercent: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
    };

    // V8 heap statistics (detailed)
    if (this.options.enableDetailedMetrics) {
      const heapStats = v8.getHeapStatistics();
      this.metrics.system.memory.v8 = {
        totalHeapSize: heapStats.total_heap_size,
        usedHeapSize: heapStats.used_heap_size,
        heapSizeLimit: heapStats.heap_size_limit,
        mallocedMemory: heapStats.malloced_memory
      };
    }

    // CPU metrics
    const cpus = os.cpus();
    this.metrics.system.cpu = {
      count: cpus.length,
      model: cpus[0].model,
      loadAverage: os.loadavg(),
      usage: this.calculateCPUUsage(cpus)
    };

    // System uptime
    this.metrics.system.uptime = {
      process: process.uptime(),
      system: os.uptime()
    };

    // Free memory
    this.metrics.system.memory.systemFree = os.freemem();
    this.metrics.system.memory.systemTotal = os.totalmem();
    this.metrics.system.memory.systemUsagePercent = 
      Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100);
  }

  /**
   * Calculate CPU usage percentage
   */
  calculateCPUUsage(cpus) {
    const usage = cpus.map(cpu => {
      const total = Object.values(cpu.times).reduce((acc, time) => acc + time, 0);
      const idle = cpu.times.idle;
      return Math.round(((total - idle) / total) * 100);
    });

    return {
      perCore: usage,
      average: Math.round(usage.reduce((a, b) => a + b, 0) / usage.length)
    };
  }

  /**
   * Get all metrics
   */
  getMetrics() {
    if (this._percentilesDirty) {
      this.updatePerformanceStats();
    }
    return {
      timestamp: new Date().toISOString(),
      requests: {
        total: this.metrics.requests.total,
        success: this.metrics.requests.success,
        errors: this.metrics.requests.errors,
        errorRate: this.metrics.requests.total > 0 
          ? Math.round((this.metrics.requests.errors / this.metrics.requests.total) * 100) 
          : 0,
        byEndpoint: Object.fromEntries(this.metrics.requests.byEndpoint),
        byMethod: Object.fromEntries(this.metrics.requests.byMethod)
      },
      performance: {
        avgResponseTime: Math.round(this.metrics.performance.avgResponseTime * 100) / 100,
        p95ResponseTime: Math.round(this.metrics.performance.p95ResponseTime * 100) / 100,
        p99ResponseTime: Math.round(this.metrics.performance.p99ResponseTime * 100) / 100,
        sampleSize: this.metrics.performance.responseTimes.length
      },
      system: this.metrics.system
    };
  }

  /**
   * Get Prometheus-formatted metrics
   */
  getPrometheusMetrics() {
    const metrics = this.getMetrics();
    
    let output = '';
    
    // Request metrics
    output += `# HELP smarthome_requests_total Total number of requests\n`;
    output += `# TYPE smarthome_requests_total counter\n`;
    output += `smarthome_requests_total ${metrics.requests.total}\n\n`;
    
    output += `# HELP smarthome_requests_success Total number of successful requests\n`;
    output += `# TYPE smarthome_requests_success counter\n`;
    output += `smarthome_requests_success ${metrics.requests.success}\n\n`;
    
    output += `# HELP smarthome_requests_errors Total number of failed requests\n`;
    output += `# TYPE smarthome_requests_errors counter\n`;
    output += `smarthome_requests_errors ${metrics.requests.errors}\n\n`;
    
    // Performance metrics
    output += `# HELP smarthome_response_time_avg Average response time in milliseconds\n`;
    output += `# TYPE smarthome_response_time_avg gauge\n`;
    output += `smarthome_response_time_avg ${metrics.performance.avgResponseTime}\n\n`;
    
    output += `# HELP smarthome_response_time_p95 95th percentile response time in milliseconds\n`;
    output += `# TYPE smarthome_response_time_p95 gauge\n`;
    output += `smarthome_response_time_p95 ${metrics.performance.p95ResponseTime}\n\n`;
    
    // Memory metrics
    output += `# HELP smarthome_memory_heap_used Heap memory used in bytes\n`;
    output += `# TYPE smarthome_memory_heap_used gauge\n`;
    output += `smarthome_memory_heap_used ${metrics.system.memory.heapUsed}\n\n`;
    
    output += `# HELP smarthome_memory_heap_percent Heap memory usage percentage\n`;
    output += `# TYPE smarthome_memory_heap_percent gauge\n`;
    output += `smarthome_memory_heap_percent ${metrics.system.memory.heapUsagePercent}\n\n`;
    
    // CPU metrics
    output += `# HELP smarthome_cpu_usage_percent Average CPU usage percentage\n`;
    output += `# TYPE smarthome_cpu_usage_percent gauge\n`;
    output += `smarthome_cpu_usage_percent ${metrics.system.cpu.usage.average}\n\n`;
    
    // Uptime
    output += `# HELP smarthome_uptime_seconds Process uptime in seconds\n`;
    output += `# TYPE smarthome_uptime_seconds counter\n`;
    output += `smarthome_uptime_seconds ${Math.round(metrics.system.uptime.process)}\n\n`;
    
    return output;
  }

  /**
   * Reset metrics
   */
  reset() {
    this.metrics.requests = {
      total: 0,
      success: 0,
      errors: 0,
      byEndpoint: new Map(),
      byMethod: new Map()
    };
    this.metrics.performance.responseTimes = [];
  }

  destroy() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }
}

module.exports = PerformanceMonitor;
