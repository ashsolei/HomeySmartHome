'use strict';

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertType, assertThrows } = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');

/* ── timer-leak prevention ─────────────────────────────────────────── */
const _origSetTimeout = global.setTimeout;
const _origSetInterval = global.setInterval;
const activeHandles = [];
global.setTimeout = (...args) => { const id = _origSetTimeout(...args); activeHandles.push({ type: 'timeout', id }); return id; };
global.setInterval = (...args) => { const id = _origSetInterval(...args); activeHandles.push({ type: 'interval', id }); return id; };
function cleanup(sys) {
  try { sys.destroy(); } catch (_) { /* ignore */ }
  while (activeHandles.length > 0) {
    const h = activeHandles.pop();
    if (h.type === 'timeout') clearTimeout(h.id);
    else clearInterval(h.id);
  }
}

const SmartHomeAutomatedTestingSystem = require('../lib/SmartHomeAutomatedTestingSystem');

/** Helper: creates a mock system instance with getStatus/destroy */
function createMockSystem(overrides = {}) {
  return {
    initialized: true,
    getStatus() { return { initialized: true, healthy: true }; },
    destroy() {},
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────
//  Tests
// ─────────────────────────────────────────────────────────────────────

describe('SmartHomeAutomatedTestingSystem – constructor', () => {
  it('sets default field values', () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    assertEqual(sys.initialized, false);
    assertEqual(sys._running, false);
    assertEqual(sys.registeredSystems.size, 0);
    assertEqual(sys.testHistory.length, 0);
    assertEqual(sys.maxHistorySize, 5000);
    assertEqual(sys.activeAlerts.length, 0);
    cleanup(sys);
  });

  it('stats object has expected defaults', () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    assertEqual(sys.stats.totalTestsRun, 0);
    assertEqual(sys.stats.totalPassed, 0);
    assertEqual(sys.stats.totalFailed, 0);
    assertEqual(sys.stats.totalErrors, 0);
    assertEqual(sys.stats.totalSkipped, 0);
    assertEqual(sys.stats.lastFullSuiteRun, null);
    assertEqual(sys.stats.lastHealthCheck, null);
    assertEqual(sys.stats.lastStressTest, null);
    assertType(sys.stats.uptimeStart, 'number');
    cleanup(sys);
  });

  it('config contains expected keys', () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    assertType(sys.config.healthCheckIntervalMs, 'number');
    assertType(sys.config.circuitBreakerThreshold, 'number');
    assertType(sys.config.regressionThreshold, 'number');
    assertEqual(sys.config.loadTestConcurrency, 10);
    cleanup(sys);
  });
});

describe('SmartHomeAutomatedTestingSystem – initialize', () => {
  it('sets initialized to true and emits event', async () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    let emitted = false;
    sys.once('initialized', () => { emitted = true; });
    await sys.initialize();
    assertEqual(sys.initialized, true);
    assert(emitted, 'initialized event should have been emitted');
    cleanup(sys);
  });

  it('skips second initialize call', async () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    let count = 0;
    sys.on('initialized', () => { count++; });
    await sys.initialize();
    await sys.initialize();
    assertEqual(count, 1);
    cleanup(sys);
  });

  it('sets up schedules during initialization', async () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    await sys.initialize();
    assert(sys.schedules.size > 0, 'schedules should be created');
    cleanup(sys);
  });
});

describe('SmartHomeAutomatedTestingSystem – destroy', () => {
  it('sets initialized to false and clears maps', async () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    await sys.initialize();
    sys.registerSystem('testSys', createMockSystem());
    sys.destroy();
    assertEqual(sys.initialized, false);
    assertEqual(sys.registeredSystems.size, 0);
    assertEqual(sys.circuitBreakers.size, 0);
    assertEqual(sys.schedules.size, 0);
    assertEqual(sys._running, false);
    // cleanup remaining timers
    while (activeHandles.length > 0) {
      const h = activeHandles.pop();
      if (h.type === 'timeout') clearTimeout(h.id);
      else clearInterval(h.id);
    }
  });

  it('emits destroyed event', () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    let emitted = false;
    sys.on('destroyed', () => { emitted = true; });
    sys.destroy();
    assert(emitted, 'destroyed event should have been emitted');
    while (activeHandles.length > 0) {
      const h = activeHandles.pop();
      if (h.type === 'timeout') clearTimeout(h.id);
      else clearInterval(h.id);
    }
  });
});

describe('SmartHomeAutomatedTestingSystem – registerSystem', () => {
  it('throws for empty name', () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    assertThrows(() => sys.registerSystem('', createMockSystem()));
    cleanup(sys);
  });

  it('throws for non-string name', () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    assertThrows(() => sys.registerSystem(123, createMockSystem()));
    cleanup(sys);
  });

  it('adds system to registeredSystems map', () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    const mock = createMockSystem();
    sys.registerSystem('mySystem', mock, { critical: true });
    assertEqual(sys.registeredSystems.size, 1);
    const reg = sys.registeredSystems.get('mySystem');
    assertEqual(reg.name, 'mySystem');
    assertEqual(reg.critical, true);
    assertEqual(reg.instance, mock);
    cleanup(sys);
  });

  it('emits systemRegistered event', () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    let eventData = null;
    sys.on('systemRegistered', (data) => { eventData = data; });
    sys.registerSystem('alpha', createMockSystem());
    assert(eventData !== null, 'systemRegistered should fire');
    assertEqual(eventData.name, 'alpha');
    cleanup(sys);
  });

  it('initializes circuit breaker for the system', () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    sys.registerSystem('beta', createMockSystem());
    const cb = sys.circuitBreakers.get('beta');
    assert(cb !== undefined, 'circuit breaker should exist');
    assertEqual(cb.state, 'closed');
    assertEqual(cb.failures, 0);
    cleanup(sys);
  });
});

describe('SmartHomeAutomatedTestingSystem – unregisterSystem', () => {
  it('returns true for existing system', () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    sys.registerSystem('temp', createMockSystem());
    const result = sys.unregisterSystem('temp');
    assertEqual(result, true);
    assertEqual(sys.registeredSystems.size, 0);
    cleanup(sys);
  });

  it('returns false for non-existent system', () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    const result = sys.unregisterSystem('nope');
    assertEqual(result, false);
    cleanup(sys);
  });

  it('emits systemUnregistered for existing', () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    sys.registerSystem('rem', createMockSystem());
    let eventFired = false;
    sys.on('systemUnregistered', () => { eventFired = true; });
    sys.unregisterSystem('rem');
    assert(eventFired, 'systemUnregistered should fire');
    cleanup(sys);
  });

  it('removes from coverageMap, circuitBreakers, baselines', () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    sys.registerSystem('toRemove', createMockSystem());
    sys.baselines.set('toRemove', { avgResponseTime: 1 });
    sys.unregisterSystem('toRemove');
    assertEqual(sys.coverageMap.has('toRemove'), false);
    assertEqual(sys.circuitBreakers.has('toRemove'), false);
    assertEqual(sys.baselines.has('toRemove'), false);
    cleanup(sys);
  });
});

describe('SmartHomeAutomatedTestingSystem – getStatus', () => {
  it('returns expected shape', () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    const status = sys.getStatus();
    assertEqual(status.initialized, false);
    assertEqual(status.isRunning, false);
    assertEqual(status.registeredSystems, 0);
    assertType(status.uptime, 'number');
    assertType(status.stats, 'object');
    assertType(status.activeAlerts, 'number');
    cleanup(sys);
  });

  it('reflects registered system count', () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    sys.registerSystem('s1', createMockSystem());
    sys.registerSystem('s2', createMockSystem());
    const status = sys.getStatus();
    assertEqual(status.registeredSystems, 2);
    cleanup(sys);
  });
});

describe('SmartHomeAutomatedTestingSystem – runHealthChecks', () => {
  it('returns results for each registered system', async () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    sys.registerSystem('health1', createMockSystem());
    sys.registerSystem('health2', createMockSystem());
    const results = await sys.runHealthChecks();
    assertEqual(results.length, 2);
    cleanup(sys);
  });

  it('marks healthy system as alive', async () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    sys.registerSystem('goodSys', createMockSystem());
    const results = await sys.runHealthChecks();
    assertEqual(results[0].alive, true);
    assertEqual(results[0].systemName, 'goodSys');
    assertEqual(results[0].error, null);
    cleanup(sys);
  });

  it('updates stats.lastHealthCheck', async () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    sys.registerSystem('hc', createMockSystem());
    assertEqual(sys.stats.lastHealthCheck, null);
    await sys.runHealthChecks();
    assertType(sys.stats.lastHealthCheck, 'number');
    cleanup(sys);
  });
});

describe('SmartHomeAutomatedTestingSystem – runSmokeTests', () => {
  it('generates smoke tests for registered systems', async () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    sys.registerSystem('smokeTarget', createMockSystem());
    const results = await sys.runSmokeTests();
    assert(results.length >= 7, 'should generate at least 7 smoke tests per system');
    cleanup(sys);
  });

  it('emits smokeTestsComplete', async () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    sys.registerSystem('st', createMockSystem());
    let emitted = false;
    sys.on('smokeTestsComplete', () => { emitted = true; });
    await sys.runSmokeTests();
    assert(emitted, 'smokeTestsComplete should be emitted');
    cleanup(sys);
  });

  it('returns empty array when no systems registered', async () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    const results = await sys.runSmokeTests();
    assertEqual(results.length, 0);
    cleanup(sys);
  });
});

describe('SmartHomeAutomatedTestingSystem – runIntegrationTests', () => {
  it('returns empty array if already running', async () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    sys._running = true;
    const results = await sys.runIntegrationTests();
    assertEqual(results.length, 0);
    sys._running = false;
    cleanup(sys);
  });

  it('returns results when systems are registered', async () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    sys.registerSystem('integ1', createMockSystem());
    const results = await sys.runIntegrationTests();
    assert(results.length > 0, 'should return test results');
    cleanup(sys);
  });

  it('resets _running after completion', async () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    sys.registerSystem('integ2', createMockSystem());
    await sys.runIntegrationTests();
    assertEqual(sys._running, false);
    cleanup(sys);
  });
});

describe('SmartHomeAutomatedTestingSystem – circuit breakers', () => {
  it('initializes circuit breaker in closed state', () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    sys.registerSystem('cbSys', createMockSystem());
    const cb = sys.circuitBreakers.get('cbSys');
    assertEqual(cb.state, 'closed');
    assertEqual(cb.failures, 0);
    cleanup(sys);
  });

  it('increments failures on _recordCircuitBreakerFailure', () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    sys.registerSystem('cbFail', createMockSystem());
    sys._recordCircuitBreakerFailure('cbFail');
    const cb = sys.circuitBreakers.get('cbFail');
    assertEqual(cb.failures, 1);
    cleanup(sys);
  });

  it('opens circuit after reaching threshold', () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    sys.registerSystem('cbThresh', createMockSystem());
    for (let i = 0; i < sys.config.circuitBreakerThreshold; i++) {
      sys._recordCircuitBreakerFailure('cbThresh');
    }
    const cb = sys.circuitBreakers.get('cbThresh');
    assertEqual(cb.state, 'open');
    assert(sys._isCircuitOpen('cbThresh'), 'circuit should report as open');
    cleanup(sys);
  });

  it('resets circuit breaker to closed', () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    sys.registerSystem('cbReset', createMockSystem());
    for (let i = 0; i < sys.config.circuitBreakerThreshold; i++) {
      sys._recordCircuitBreakerFailure('cbReset');
    }
    sys._resetCircuitBreaker('cbReset');
    const cb = sys.circuitBreakers.get('cbReset');
    assertEqual(cb.state, 'closed');
    assertEqual(cb.failures, 0);
    cleanup(sys);
  });
});

describe('SmartHomeAutomatedTestingSystem – runLoadTest', () => {
  it('returns error for unknown system', async () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    const result = await sys.runLoadTest('nonexistent', { durationMs: 50 });
    assertEqual(result.error, 'System not found');
    assertEqual(result.systemName, 'nonexistent');
    cleanup(sys);
  });

  it('returns results for known system', async () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    sys.registerSystem('loadSys', createMockSystem());
    const result = await sys.runLoadTest('loadSys', {
      durationMs: 150,
      concurrency: 2,
      requestIntervalMs: 20,
    });
    assert(result.totalRequests > 0, 'should have made requests');
    assertType(result.successRate, 'number');
    assertType(result.requestsPerSecond, 'number');
    cleanup(sys);
  });
});

describe('SmartHomeAutomatedTestingSystem – alerts', () => {
  it('acknowledgeAlert returns false for unknown id', () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    assertEqual(sys.acknowledgeAlert('fake_id'), false);
    cleanup(sys);
  });

  it('acknowledgeAlert returns true for existing alert', () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    sys._generateAlert('test_type', 'src', 'msg');
    assert(sys.activeAlerts.length > 0, 'alert should exist');
    const alertId = sys.activeAlerts[0].id;
    assertEqual(sys.acknowledgeAlert(alertId), true);
    assertEqual(sys.activeAlerts[0].acknowledged, true);
    cleanup(sys);
  });

  it('clearAcknowledgedAlerts removes acknowledged', () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    sys._generateAlert('t1', 's1', 'm1');
    sys._generateAlert('t2', 's2', 'm2');
    const id = sys.activeAlerts[0].id;
    sys.acknowledgeAlert(id);
    const cleared = sys.clearAcknowledgedAlerts();
    assertEqual(cleared, 1);
    assertEqual(sys.activeAlerts.length, 1);
    cleanup(sys);
  });

  it('getActiveAlerts returns only unacknowledged', () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    sys._generateAlert('a', 'b', 'c');
    sys._generateAlert('d', 'e', 'f');
    sys.acknowledgeAlert(sys.activeAlerts[0].id);
    const active = sys.getActiveAlerts();
    assertEqual(active.length, 1);
    cleanup(sys);
  });
});

describe('SmartHomeAutomatedTestingSystem – analyzeTrends', () => {
  it('returns noData when history is empty', () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    const trends = sys.analyzeTrends();
    assertEqual(trends.noData, true);
    cleanup(sys);
  });

  it('returns trend data when results exist', () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    // Add some fake history
    for (let i = 0; i < 5; i++) {
      sys.testHistory.push({
        name: `test${i}`,
        suite: 'health',
        status: 'passed',
        duration: 5,
        error: null,
        timestamp: Date.now() - 1000 * i,
      });
    }
    const trends = sys.analyzeTrends();
    assertEqual(trends.noData, undefined);
    assertEqual(trends.total, 5);
    assertEqual(trends.passed, 5);
    assertType(trends.successRate, 'number');
    assertType(trends.suiteBreakdown, 'object');
    cleanup(sys);
  });
});

describe('SmartHomeAutomatedTestingSystem – history queries', () => {
  it('getRecentResults returns empty for no history', () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    const results = sys.getRecentResults();
    assertEqual(results.length, 0);
    cleanup(sys);
  });

  it('getRecentResults returns last N entries', () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    for (let i = 0; i < 30; i++) {
      sys.testHistory.push({ name: `t${i}`, suite: 'smoke', status: 'passed', duration: 1, timestamp: Date.now() });
    }
    const results = sys.getRecentResults(10);
    assertEqual(results.length, 10);
    cleanup(sys);
  });

  it('getResultsBySuite filters by suite name', () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    sys.testHistory.push({ name: 'a', suite: 'health', status: 'passed', duration: 1, timestamp: Date.now() });
    sys.testHistory.push({ name: 'b', suite: 'smoke', status: 'passed', duration: 1, timestamp: Date.now() });
    sys.testHistory.push({ name: 'c', suite: 'health', status: 'failed', duration: 1, timestamp: Date.now() });
    const healthResults = sys.getResultsBySuite('health');
    assertEqual(healthResults.length, 2);
    cleanup(sys);
  });
});

describe('SmartHomeAutomatedTestingSystem – coverage report', () => {
  it('returns correct shape with zero systems', () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    const report = sys.getCoverageReport();
    assertEqual(report.totalSystems, 0);
    assertEqual(report.coveredSystems, 0);
    assertEqual(report.coveragePercent, 0);
    cleanup(sys);
  });

  it('shows uncovered systems when no tests have run', () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    sys.registerSystem('uncov1', createMockSystem());
    sys.registerSystem('uncov2', createMockSystem());
    const report = sys.getCoverageReport();
    assertEqual(report.totalSystems, 2);
    assertEqual(report.uncoveredSystems.length, 2);
    cleanup(sys);
  });
});

describe('SmartHomeAutomatedTestingSystem – updateConfig', () => {
  it('throws for null config', () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    assertThrows(() => sys.updateConfig(null));
    cleanup(sys);
  });

  it('throws for non-object config', () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    assertThrows(() => sys.updateConfig('bad'));
    cleanup(sys);
  });

  it('updates valid keys and ignores invalid', () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    const result = sys.updateConfig({
      loadTestConcurrency: 20,
      invalidKey: 'ignored',
    });
    assertEqual(result.loadTestConcurrency, 20);
    assertEqual(result.invalidKey, undefined);
    cleanup(sys);
  });

  it('emits configUpdated event', () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    let emitted = false;
    sys.on('configUpdated', () => { emitted = true; });
    sys.updateConfig({ loadTestConcurrency: 5 });
    assert(emitted, 'configUpdated should fire');
    cleanup(sys);
  });
});

describe('SmartHomeAutomatedTestingSystem – resetHistory', () => {
  it('clears all history, stats and alerts', () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    sys.testHistory.push({ name: 'x', suite: 'y', status: 'passed', duration: 1, timestamp: Date.now() });
    sys.stats.totalTestsRun = 10;
    sys.stats.totalPassed = 8;
    sys._generateAlert('t', 's', 'm');
    sys.baselines.set('key', { avg: 1 });
    sys.resetHistory();
    assertEqual(sys.testHistory.length, 0);
    assertEqual(sys.stats.totalTestsRun, 0);
    assertEqual(sys.stats.totalPassed, 0);
    assertEqual(sys.activeAlerts.length, 0);
    assertEqual(sys.baselines.size, 0);
    cleanup(sys);
  });
});

describe('SmartHomeAutomatedTestingSystem – reports', () => {
  it('generateJSONReport returns expected shape', () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    const report = sys.generateJSONReport();
    assertType(report.reportId, 'string');
    assertType(report.generatedAt, 'string');
    assertEqual(report.system, 'SmartHomeAutomatedTestingSystem');
    assertType(report.status, 'object');
    assertType(report.coverage, 'object');
    assertType(report.trends, 'object');
    assert(Array.isArray(report.recentResults), 'recentResults should be array');
    cleanup(sys);
  });

  it('generateSummaryReport returns string', () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    const report = sys.generateSummaryReport();
    assertType(report, 'string');
    assert(report.includes('Smart Home Automated Testing'), 'should contain system name');
    cleanup(sys);
  });
});

describe('SmartHomeAutomatedTestingSystem – exportHistory', () => {
  it('returns serializable history object', () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    sys.testHistory.push({ name: 'e1', suite: 's', status: 'passed', duration: 1, timestamp: Date.now() });
    const exported = sys.exportHistory();
    assertType(exported.exportedAt, 'string');
    assertEqual(exported.historyCount, 1);
    assert(Array.isArray(exported.history), 'history should be array');
    assertType(exported.stats, 'object');
    cleanup(sys);
  });
});

describe('SmartHomeAutomatedTestingSystem – runPerformanceBenchmarks', () => {
  it('returns benchmark results keyed by system name', async () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    sys.registerSystem('benchSys', createMockSystem());
    const results = await sys.runPerformanceBenchmarks(2);
    assert(results.benchSys !== undefined, 'should have benchSys key');
    assertType(results.benchSys.avgResponseTime, 'number');
    assertType(results.benchSys.successRate, 'number');
    assertEqual(results.benchSys.iterations, 2);
    cleanup(sys);
  });

  it('skips systems with open circuit breaker', async () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    sys.registerSystem('openCB', createMockSystem());
    for (let i = 0; i < sys.config.circuitBreakerThreshold; i++) {
      sys._recordCircuitBreakerFailure('openCB');
    }
    const results = await sys.runPerformanceBenchmarks(2);
    assertEqual(results.openCB.skipped, true);
    cleanup(sys);
  });
});

describe('SmartHomeAutomatedTestingSystem – detectRegressions', () => {
  it('returns empty array when no baselines meet minimum samples', async () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    sys.registerSystem('regSys', createMockSystem());
    sys.baselines.set('regSys', { avgResponseTime: 5, avgMemoryUsage: 100, sampleCount: 2, successRate: 1 });
    const regressions = await sys.detectRegressions();
    assertEqual(regressions.length, 0);
    cleanup(sys);
  });
});

describe('SmartHomeAutomatedTestingSystem – runFullTestSuite', () => {
  it('returns error when already running', async () => {
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    sys._running = true;
    const report = await sys.runFullTestSuite();
    assertEqual(report.error, 'Already running');
    sys._running = false;
    cleanup(sys);
  });
});

describe('SmartHomeAutomatedTestingSystem – EventEmitter', () => {
  it('is an instance of EventEmitter', () => {
    const EventEmitter = require('events');
    const sys = new SmartHomeAutomatedTestingSystem(createMockHomey());
    assert(sys instanceof EventEmitter, 'should extend EventEmitter');
    cleanup(sys);
  });
});

run();
