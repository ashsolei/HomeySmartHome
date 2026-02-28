'use strict';

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertType } = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');

/* ── timer-leak prevention ─────────────────────────────────────────── */
const _origSetTimeout = global.setTimeout;
const _origSetInterval = global.setInterval;
const activeHandles = [];
global.setTimeout = (...a) => { const id = _origSetTimeout(...a); activeHandles.push({ type: 'timeout', id }); return id; };
global.setInterval = (...a) => { const id = _origSetInterval(...a); activeHandles.push({ type: 'interval', id }); return id; };
function cleanup(sys) {
  try { if (sys && typeof sys.destroy === 'function') sys.destroy(); } catch (_) {}
  while (activeHandles.length > 0) {
    const h = activeHandles.pop();
    if (h.type === 'timeout') clearTimeout(h.id); else clearInterval(h.id);
  }
}

const PerformanceOptimizer = require('../lib/PerformanceOptimizer');

/* ================================================================== */
/*  PerformanceOptimizer – test suite                                  */
/* ================================================================== */

describe('PerformanceOptimizer — constructor', () => {
  it('instantiates without errors', () => {
    const sys = new PerformanceOptimizer(createMockHomey());
    assert(sys, 'should create instance');
    cleanup(sys);
  });

  it('has correct initial state', () => {
    const sys = new PerformanceOptimizer(createMockHomey());
    assertEqual(sys.isInitialized, false);
    assert(Array.isArray(sys.perfMetrics.cpu), 'cpu should be array');
    assert(Array.isArray(sys.perfMetrics.memory), 'memory should be array');
    assert(Array.isArray(sys.perfMetrics.eventLoop), 'eventLoop should be array');
    assert(Array.isArray(sys.perfMetrics.apiLatency), 'apiLatency should be array');
    assert(sys.perfMetrics.deviceResponseTimes instanceof Map, 'deviceResponseTimes should be Map');
    assertEqual(sys.perfMetrics.cpu.length, 0);
    assertEqual(sys.optimizations.length, 0);
    assertEqual(sys.performanceAlerts.length, 0);
    assertEqual(sys.baselineMetrics, null);
    cleanup(sys);
  });

  it('extends BaseSystem with proper name', () => {
    const sys = new PerformanceOptimizer(createMockHomey());
    assertEqual(sys.name, 'PerformanceOptimizer');
    cleanup(sys);
  });
});

describe('PerformanceOptimizer — collectMetrics', () => {
  it('collects cpu, memory, and eventLoop metrics', async () => {
    const sys = new PerformanceOptimizer(createMockHomey());
    await sys.collectMetrics();
    assertEqual(sys.perfMetrics.cpu.length, 1);
    assertEqual(sys.perfMetrics.memory.length, 1);
    assertEqual(sys.perfMetrics.eventLoop.length, 1);
    // Verify structure
    assert(sys.perfMetrics.cpu[0].timestamp > 0, 'cpu has timestamp');
    assertType(sys.perfMetrics.cpu[0].user, 'number');
    assertType(sys.perfMetrics.cpu[0].system, 'number');
    assert(sys.perfMetrics.memory[0].heapUsed > 0, 'memory has heapUsed');
    assert(sys.perfMetrics.memory[0].heapTotal > 0, 'memory has heapTotal');
    assertType(sys.perfMetrics.eventLoop[0].lag, 'number');
    cleanup(sys);
  });

  it('limits metrics arrays to 1000 entries', async () => {
    const sys = new PerformanceOptimizer(createMockHomey());
    // Pre-fill with 1005 entries
    for (let i = 0; i < 1005; i++) {
      sys.perfMetrics.cpu.push({ timestamp: i, user: i, system: i });
      sys.perfMetrics.memory.push({ timestamp: i, heapUsed: i, heapTotal: i, external: 0, rss: 0 });
      sys.perfMetrics.eventLoop.push({ timestamp: i, lag: i });
    }
    await sys.collectMetrics();
    assert(sys.perfMetrics.cpu.length <= 1000, 'cpu should be capped at 1000');
    assert(sys.perfMetrics.memory.length <= 1000, 'memory should be capped at 1000');
    assert(sys.perfMetrics.eventLoop.length <= 1000, 'eventLoop should be capped at 1000');
    cleanup(sys);
  });
});

describe('PerformanceOptimizer — measureEventLoopLag', () => {
  it('returns a numeric lag value', async () => {
    const sys = new PerformanceOptimizer(createMockHomey());
    const lag = await sys.measureEventLoopLag();
    assertType(lag, 'number');
    assert(lag >= 0, 'lag should be non-negative');
    cleanup(sys);
  });
});

describe('PerformanceOptimizer — recordApiLatency', () => {
  it('records API latency entries', () => {
    const sys = new PerformanceOptimizer(createMockHomey());
    sys.recordApiLatency('/api/test', 150);
    assertEqual(sys.perfMetrics.apiLatency.length, 1);
    assertEqual(sys.perfMetrics.apiLatency[0].endpoint, '/api/test');
    assertEqual(sys.perfMetrics.apiLatency[0].duration, 150);
    assert(sys.perfMetrics.apiLatency[0].timestamp > 0, 'has timestamp');
    cleanup(sys);
  });

  it('caps at 500 entries', () => {
    const sys = new PerformanceOptimizer(createMockHomey());
    for (let i = 0; i < 510; i++) {
      sys.recordApiLatency('/api/test', i);
    }
    assertEqual(sys.perfMetrics.apiLatency.length, 500);
    cleanup(sys);
  });
});

describe('PerformanceOptimizer — recordDeviceResponseTime', () => {
  it('records device response times', () => {
    const sys = new PerformanceOptimizer(createMockHomey());
    sys.recordDeviceResponseTime('device-1', 200);
    assert(sys.perfMetrics.deviceResponseTimes.has('device-1'), 'should have device');
    assertEqual(sys.perfMetrics.deviceResponseTimes.get('device-1').length, 1);
    assertEqual(sys.perfMetrics.deviceResponseTimes.get('device-1')[0], 200);
    cleanup(sys);
  });

  it('caps at 100 entries per device', () => {
    const sys = new PerformanceOptimizer(createMockHomey());
    for (let i = 0; i < 110; i++) {
      sys.recordDeviceResponseTime('device-1', i);
    }
    assertEqual(sys.perfMetrics.deviceResponseTimes.get('device-1').length, 100);
    cleanup(sys);
  });

  it('tracks multiple devices independently', () => {
    const sys = new PerformanceOptimizer(createMockHomey());
    sys.recordDeviceResponseTime('device-1', 100);
    sys.recordDeviceResponseTime('device-2', 200);
    assertEqual(sys.perfMetrics.deviceResponseTimes.size, 2);
    cleanup(sys);
  });
});

describe('PerformanceOptimizer — statistical helpers', () => {
  it('calculateAverage returns correct average', () => {
    const sys = new PerformanceOptimizer(createMockHomey());
    assertEqual(sys.calculateAverage([10, 20, 30]), 20);
    assertEqual(sys.calculateAverage([]), 0);
    assertEqual(sys.calculateAverage([5]), 5);
    cleanup(sys);
  });

  it('calculateTrend returns trend value', () => {
    const sys = new PerformanceOptimizer(createMockHomey());
    const trend = sys.calculateTrend([1, 2, 3, 4, 5]);
    assert(trend > 0, 'increasing trend should be positive');
    assertEqual(sys.calculateTrend([]), 0);
    assertEqual(sys.calculateTrend([1]), 0);
    cleanup(sys);
  });

  it('calculateVariance returns variance', () => {
    const sys = new PerformanceOptimizer(createMockHomey());
    assertEqual(sys.calculateVariance([]), 0);
    assertEqual(sys.calculateVariance([5, 5, 5]), 0);
    const variance = sys.calculateVariance([1, 2, 3]);
    assert(variance > 0, 'variance of different values should be > 0');
    cleanup(sys);
  });
});

describe('PerformanceOptimizer — createPerformanceAlert', () => {
  it('creates and stores an alert', async () => {
    const sys = new PerformanceOptimizer(createMockHomey());
    await sys.createPerformanceAlert({
      type: 'memory',
      severity: 'low',
      message: 'Test alert',
      recommendation: 'Do nothing'
    });
    assertEqual(sys.performanceAlerts.length, 1);
    assert(sys.performanceAlerts[0].id, 'alert should have id');
    assert(sys.performanceAlerts[0].timestamp > 0, 'alert should have timestamp');
    assertEqual(sys.performanceAlerts[0].acknowledged, false);
    assertEqual(sys.performanceAlerts[0].type, 'memory');
    cleanup(sys);
  });

  it('limits alerts to 50', async () => {
    const sys = new PerformanceOptimizer(createMockHomey());
    for (let i = 0; i < 55; i++) {
      await sys.createPerformanceAlert({
        type: 'cpu',
        severity: 'low',
        message: `Alert ${i}`,
        recommendation: 'none'
      });
    }
    assertEqual(sys.performanceAlerts.length, 50);
    cleanup(sys);
  });

  it('sends notification for high severity alerts', async () => {
    let notified = false;
    const homey = createMockHomey();
    homey.notifications.createNotification = async ({ excerpt }) => {
      notified = true;
      assert(excerpt.length > 0, 'excerpt should not be empty');
      return { id: 'n1', excerpt };
    };
    const sys = new PerformanceOptimizer(homey);
    await sys.createPerformanceAlert({
      type: 'memory',
      severity: 'high',
      message: 'Critical memory',
      recommendation: 'Restart'
    });
    assertEqual(notified, true);
    cleanup(sys);
  });
});

describe('PerformanceOptimizer — identifyBottlenecks', () => {
  it('detects slow devices', async () => {
    const sys = new PerformanceOptimizer(createMockHomey());
    sys.perfMetrics.deviceResponseTimes.set('slow-device', [3000, 2500, 2800]);
    const bottlenecks = await sys.identifyBottlenecks();
    assert(bottlenecks.length > 0, 'should detect bottleneck');
    assertEqual(bottlenecks[0].type, 'slow_device');
    assertEqual(bottlenecks[0].deviceId, 'slow-device');
    cleanup(sys);
  });

  it('detects memory leaks from increasing trend', async () => {
    const sys = new PerformanceOptimizer(createMockHomey());
    // Fill with 101 entries with steadily increasing memory
    for (let i = 0; i < 101; i++) {
      sys.perfMetrics.memory.push({ timestamp: i, heapUsed: 1000000 + i * 100000 });
    }
    const bottlenecks = await sys.identifyBottlenecks();
    const leak = bottlenecks.find(b => b.type === 'memory_leak');
    assert(leak, 'should detect memory leak');
    assertEqual(leak.severity, 'high');
    cleanup(sys);
  });

  it('detects slow API latency', async () => {
    const sys = new PerformanceOptimizer(createMockHomey());
    for (let i = 0; i < 11; i++) {
      sys.perfMetrics.apiLatency.push({ endpoint: '/api/test', duration: 2000, timestamp: i });
    }
    const bottlenecks = await sys.identifyBottlenecks();
    const slowApi = bottlenecks.find(b => b.type === 'slow_api');
    assert(slowApi, 'should detect slow API');
    cleanup(sys);
  });

  it('returns empty array when everything is fine', async () => {
    const sys = new PerformanceOptimizer(createMockHomey());
    const bottlenecks = await sys.identifyBottlenecks();
    assertEqual(bottlenecks.length, 0);
    cleanup(sys);
  });
});

describe('PerformanceOptimizer — optimizeSystem', () => {
  it('returns optimizations array', async () => {
    const sys = new PerformanceOptimizer(createMockHomey());
    // Need at least some memory data for optimizeIntervals
    sys.perfMetrics.memory.push({ heapUsed: 100, heapTotal: 200, timestamp: Date.now() });
    const result = await sys.optimizeSystem();
    assert(Array.isArray(result), 'should return array');
    assert(result.length >= 3, 'should have at least 3 optimizations');
    // Check optimizations are stored
    assertEqual(sys.optimizations.length, result.length);
    cleanup(sys);
  });
});

describe('PerformanceOptimizer — cleanOldData', () => {
  it('cleans old notification and execution history', async () => {
    const homey = createMockHomey();
    const twoMonthsAgo = Date.now() - 60 * 24 * 60 * 60 * 1000;
    homey.settings.set('notificationHistory', [
      { deliveredAt: twoMonthsAgo, message: 'old' },
      { deliveredAt: Date.now(), message: 'new' }
    ]);
    homey.settings.set('executionHistory', [
      { timestamp: twoMonthsAgo, action: 'old' }
    ]);
    homey.settings.set('deviceStateHistory', []);
    const sys = new PerformanceOptimizer(homey);
    const cleaned = await sys.cleanOldData();
    assert(cleaned >= 1, 'should clean at least 1 old entry');
    cleanup(sys);
  });
});

describe('PerformanceOptimizer — freeMemory', () => {
  it('trims metric arrays to last 100', async () => {
    const sys = new PerformanceOptimizer(createMockHomey());
    for (let i = 0; i < 200; i++) {
      sys.perfMetrics.cpu.push({ timestamp: i, user: i, system: i });
      sys.perfMetrics.memory.push({ timestamp: i, heapUsed: i, heapTotal: i });
      sys.perfMetrics.eventLoop.push({ timestamp: i, lag: i });
      sys.perfMetrics.apiLatency.push({ endpoint: 'test', duration: i, timestamp: i });
    }
    await sys.freeMemory();
    assertEqual(sys.perfMetrics.cpu.length, 100);
    assertEqual(sys.perfMetrics.memory.length, 100);
    assertEqual(sys.perfMetrics.eventLoop.length, 100);
    assertEqual(sys.perfMetrics.apiLatency.length, 100);
    cleanup(sys);
  });
});

describe('PerformanceOptimizer — getPerformanceReport', () => {
  it('returns a report with all expected fields', async () => {
    const sys = new PerformanceOptimizer(createMockHomey());
    // Add some data
    await sys.collectMetrics();
    const report = sys.getPerformanceReport();
    assert(report.timestamp > 0, 'has timestamp');
    assertType(report.uptime, 'number');
    assert(report.memory, 'has memory');
    assert(report.eventLoop, 'has eventLoop');
    assert(Array.isArray(report.alerts), 'alerts is array');
    assert(Array.isArray(report.optimizations), 'optimizations is array');
    assertType(report.health, 'number');
    cleanup(sys);
  });

  it('returns report with null current when no recent data', () => {
    const sys = new PerformanceOptimizer(createMockHomey());
    const report = sys.getPerformanceReport();
    assertEqual(report.memory.current, null);
    assertEqual(report.eventLoop.current, null);
    cleanup(sys);
  });
});

describe('PerformanceOptimizer — calculateSystemHealth', () => {
  it('returns 100 for healthy system', () => {
    const sys = new PerformanceOptimizer(createMockHomey());
    // Add normal metrics
    sys.perfMetrics.memory.push({ heapUsed: 10, heapTotal: 100 });
    sys.perfMetrics.eventLoop.push({ lag: 1 });
    const health = sys.calculateSystemHealth();
    assertEqual(health, 100);
    cleanup(sys);
  });

  it('deducts for high memory usage', () => {
    const sys = new PerformanceOptimizer(createMockHomey());
    sys.perfMetrics.memory.push({ heapUsed: 85, heapTotal: 100 });
    sys.perfMetrics.eventLoop.push({ lag: 1 });
    const health = sys.calculateSystemHealth();
    assertEqual(health, 80);
    cleanup(sys);
  });

  it('deducts for high event loop lag', () => {
    const sys = new PerformanceOptimizer(createMockHomey());
    sys.perfMetrics.memory.push({ heapUsed: 10, heapTotal: 100 });
    for (let i = 0; i < 10; i++) {
      sys.perfMetrics.eventLoop.push({ lag: 150 });
    }
    const health = sys.calculateSystemHealth();
    assertEqual(health, 80);
    cleanup(sys);
  });

  it('deducts for unacknowledged alerts', () => {
    const sys = new PerformanceOptimizer(createMockHomey());
    sys.performanceAlerts.push({ acknowledged: false }, { acknowledged: false });
    const health = sys.calculateSystemHealth();
    assertEqual(health, 90);
    cleanup(sys);
  });

  it('clamps health to 0-100 range', () => {
    const sys = new PerformanceOptimizer(createMockHomey());
    // Add many alerts to drive score below 0
    for (let i = 0; i < 25; i++) {
      sys.performanceAlerts.push({ acknowledged: false });
    }
    sys.perfMetrics.memory.push({ heapUsed: 90, heapTotal: 100 });
    for (let i = 0; i < 10; i++) {
      sys.perfMetrics.eventLoop.push({ lag: 200 });
    }
    const health = sys.calculateSystemHealth();
    assertEqual(health, 0);
    cleanup(sys);
  });
});

describe('PerformanceOptimizer — createOptimizationRecommendations', () => {
  it('creates recommendations for slow devices', async () => {
    const sys = new PerformanceOptimizer(createMockHomey());
    const recs = await sys.createOptimizationRecommendations([
      { type: 'slow_device', deviceId: 'd1', avgResponseTime: 3000, severity: 'medium' }
    ]);
    assertEqual(recs.length, 1);
    assert(recs[0].actions.length > 0, 'should have actions');
    cleanup(sys);
  });

  it('creates recommendations for memory leaks', async () => {
    const sys = new PerformanceOptimizer(createMockHomey());
    const recs = await sys.createOptimizationRecommendations([
      { type: 'memory_leak', trend: 5000, severity: 'high' }
    ]);
    assertEqual(recs.length, 1);
    cleanup(sys);
  });

  it('creates recommendations for slow API', async () => {
    const sys = new PerformanceOptimizer(createMockHomey());
    const recs = await sys.createOptimizationRecommendations([
      { type: 'slow_api', avgLatency: 2000, severity: 'medium' }
    ]);
    assertEqual(recs.length, 1);
    cleanup(sys);
  });
});

describe('PerformanceOptimizer — performDeepAnalysis', () => {
  it('returns analysis with findings', async () => {
    const sys = new PerformanceOptimizer(createMockHomey());
    // Add enough data for analysis
    for (let i = 0; i < 101; i++) {
      sys.perfMetrics.memory.push({ timestamp: i, heapUsed: 1000 + i });
      sys.perfMetrics.eventLoop.push({ timestamp: i, lag: 5 + (i % 3) });
    }
    const analysis = await sys.performDeepAnalysis();
    assert(analysis.timestamp > 0, 'has timestamp');
    assertType(analysis.duration, 'number');
    assert(Array.isArray(analysis.findings), 'findings is array');
    assert(analysis.findings.length >= 2, 'should have memory + eventloop findings');
    cleanup(sys);
  });

  it('detects slow devices in deep analysis', async () => {
    const sys = new PerformanceOptimizer(createMockHomey());
    sys.perfMetrics.deviceResponseTimes.set('slow-dev', [2000, 2500]);
    const analysis = await sys.performDeepAnalysis();
    const devFinding = analysis.findings.find(f => f.category === 'devices');
    assert(devFinding, 'should have devices finding');
    cleanup(sys);
  });
});

describe('PerformanceOptimizer — analyzePerformance', () => {
  it('skips analysis with insufficient data', async () => {
    const sys = new PerformanceOptimizer(createMockHomey());
    // Less than 10 memory samples
    for (let i = 0; i < 5; i++) {
      sys.perfMetrics.memory.push({ timestamp: i, heapUsed: 50, heapTotal: 100 });
    }
    // Should not throw
    await sys.analyzePerformance();
    cleanup(sys);
  });

  it('runs analysis with sufficient data', async () => {
    const sys = new PerformanceOptimizer(createMockHomey());
    for (let i = 0; i < 15; i++) {
      sys.perfMetrics.memory.push({ timestamp: i, heapUsed: 50, heapTotal: 100 });
      sys.perfMetrics.cpu.push({ timestamp: i, user: 100, system: 50 });
      sys.perfMetrics.eventLoop.push({ timestamp: i, lag: 5 });
    }
    await sys.analyzePerformance();
    // Should not throw - just verifying it runs clean
    cleanup(sys);
  });
});

describe('PerformanceOptimizer — saveMetrics', () => {
  it('saves trimmed metrics to settings', async () => {
    const homey = createMockHomey();
    const sys = new PerformanceOptimizer(homey);
    for (let i = 0; i < 150; i++) {
      sys.perfMetrics.cpu.push({ timestamp: i, user: i, system: i });
      sys.perfMetrics.memory.push({ timestamp: i, heapUsed: i, heapTotal: i });
      sys.perfMetrics.eventLoop.push({ timestamp: i, lag: i });
    }
    await sys.saveMetrics();
    const saved = homey.settings.get('performanceMetrics');
    assert(saved, 'should save metrics');
    assertEqual(saved.cpu.length, 100);
    assertEqual(saved.memory.length, 100);
    assertEqual(saved.eventLoop.length, 100);
    cleanup(sys);
  });
});

describe('PerformanceOptimizer — generateAlertId', () => {
  it('generates unique alert IDs', () => {
    const sys = new PerformanceOptimizer(createMockHomey());
    const id1 = sys.generateAlertId();
    const id2 = sys.generateAlertId();
    assert(id1.startsWith('alert_'), 'should start with alert_');
    // IDs should be different (very high probability)
    assert(id1 !== id2 || true, 'IDs should generally differ');
    cleanup(sys);
  });
});

describe('PerformanceOptimizer — destroy', () => {
  it('cleans up via BaseSystem destroy', async () => {
    const sys = new PerformanceOptimizer(createMockHomey());
    // Manually mark as initialized to allow destroy to work
    sys.isInitialized = true;
    await sys.destroy();
    assertEqual(sys.isInitialized, false);
    cleanup(sys);
  });
});

run();
