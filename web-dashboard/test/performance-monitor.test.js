'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const PerformanceMonitor = require('../performance-monitor');

describe('PerformanceMonitor', () => {
  let monitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor({
      metricsInterval: 60000, // slow interval to avoid test noise
      enableDetailedMetrics: true
    });
  });

  afterEach(() => {
    monitor.destroy();
  });

  describe('constructor', () => {
    it('initializes with default options', () => {
      const m = new PerformanceMonitor();
      assert.strictEqual(m.options.metricsInterval, 10000);
      assert.strictEqual(m.options.enableDetailedMetrics, true);
      m.destroy();
    });

    it('initializes request counters to zero', () => {
      assert.strictEqual(monitor.metrics.requests.total, 0);
      assert.strictEqual(monitor.metrics.requests.success, 0);
      assert.strictEqual(monitor.metrics.requests.errors, 0);
    });
  });

  describe('recordRequest', () => {
    it('increments total and success on 200', () => {
      monitor.recordRequest('GET /health', 'GET', 200, 5.0);
      assert.strictEqual(monitor.metrics.requests.total, 1);
      assert.strictEqual(monitor.metrics.requests.success, 1);
      assert.strictEqual(monitor.metrics.requests.errors, 0);
    });

    it('increments errors on 500', () => {
      monitor.recordRequest('GET /fail', 'GET', 500, 10.0);
      assert.strictEqual(monitor.metrics.requests.total, 1);
      assert.strictEqual(monitor.metrics.requests.success, 0);
      assert.strictEqual(monitor.metrics.requests.errors, 1);
    });

    it('tracks by endpoint', () => {
      monitor.recordRequest('GET /health', 'GET', 200, 5.0);
      monitor.recordRequest('GET /health', 'GET', 200, 15.0);
      const stats = monitor.metrics.requests.byEndpoint.get('GET /health');
      assert.strictEqual(stats.count, 2);
      assert.strictEqual(stats.avgTime, 10.0);
    });

    it('tracks by method', () => {
      monitor.recordRequest('GET /a', 'GET', 200, 1);
      monitor.recordRequest('POST /b', 'POST', 201, 1);
      monitor.recordRequest('GET /c', 'GET', 200, 1);
      assert.strictEqual(monitor.metrics.requests.byMethod.get('GET'), 2);
      assert.strictEqual(monitor.metrics.requests.byMethod.get('POST'), 1);
    });

    it('caps response times at 1000 entries', () => {
      for (let i = 0; i < 1050; i++) {
        monitor.recordRequest('GET /x', 'GET', 200, i);
      }
      assert.strictEqual(monitor.metrics.performance.responseTimes.length, 1000);
    });
  });

  describe('updatePerformanceStats', () => {
    it('computes avg, p95, p99', () => {
      for (let i = 1; i <= 100; i++) {
        monitor.recordRequest('GET /x', 'GET', 200, i);
      }
      const perf = monitor.metrics.performance;
      assert.ok(perf.avgResponseTime > 49 && perf.avgResponseTime < 52);
      assert.ok(perf.p95ResponseTime >= 95);
      assert.ok(perf.p99ResponseTime >= 99);
    });
  });

  describe('trackRequest middleware', () => {
    it('returns a function', () => {
      const middleware = monitor.trackRequest();
      assert.strictEqual(typeof middleware, 'function');
    });
  });

  describe('getMetrics', () => {
    it('returns structured metrics object', () => {
      monitor.recordRequest('GET /test', 'GET', 200, 5);
      const metrics = monitor.getMetrics();
      assert.ok(metrics.timestamp);
      assert.strictEqual(metrics.requests.total, 1);
      assert.ok(metrics.system.memory);
      assert.ok(metrics.system.cpu);
    });
  });

  describe('getPrometheusMetrics', () => {
    it('returns valid Prometheus text format', () => {
      monitor.recordRequest('GET /test', 'GET', 200, 5);
      const prom = monitor.getPrometheusMetrics();
      assert.ok(prom.includes('smarthome_requests_total 1'));
      assert.ok(prom.includes('# TYPE smarthome_requests_total counter'));
      assert.ok(prom.includes('smarthome_memory_heap_used'));
      assert.ok(prom.includes('smarthome_cpu_usage_percent'));
    });
  });

  describe('reset', () => {
    it('resets request counters', () => {
      monitor.recordRequest('GET /x', 'GET', 200, 5);
      monitor.reset();
      assert.strictEqual(monitor.metrics.requests.total, 0);
      assert.strictEqual(monitor.metrics.performance.responseTimes.length, 0);
    });
  });

  describe('destroy', () => {
    it('clears metrics interval', () => {
      monitor.destroy();
      assert.strictEqual(monitor.metricsInterval, null);
    });

    it('is safe to call twice', () => {
      monitor.destroy();
      monitor.destroy();
      assert.strictEqual(monitor.metricsInterval, null);
    });
  });

  describe('collectSystemMetrics', () => {
    it('populates system memory info', () => {
      monitor.collectSystemMetrics();
      assert.ok(monitor.metrics.system.memory.heapUsed > 0);
      assert.ok(monitor.metrics.system.memory.rss > 0);
      assert.ok(monitor.metrics.system.memory.systemTotal > 0);
    });

    it('populates CPU info', () => {
      monitor.collectSystemMetrics();
      assert.ok(monitor.metrics.system.cpu.count > 0);
      assert.ok(monitor.metrics.system.cpu.model);
      assert.ok(Array.isArray(monitor.metrics.system.cpu.loadAverage));
    });
  });
});
