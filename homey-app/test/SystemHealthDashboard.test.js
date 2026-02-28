'use strict';

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertType, assertThrows } = require('./helpers/assert');

const SystemHealthDashboard = require('../lib/SystemHealthDashboard');

/* ---- Timer-leak prevention ---- */
const _origSetTimeout = global.setTimeout;
const _origSetInterval = global.setInterval;
const activeHandles = [];
global.setTimeout = (...args) => { const id = _origSetTimeout(...args); activeHandles.push({ type: 'timeout', id }); return id; };
global.setInterval = (...args) => { const id = _origSetInterval(...args); activeHandles.push({ type: 'interval', id }); return id; };
function cleanup(sys) {
  try { sys.destroy(); } catch (_) {}
  while (activeHandles.length > 0) {
    const h = activeHandles.pop();
    if (h.type === 'timeout') clearTimeout(h.id); else clearInterval(h.id);
  }
}

function createMockApp(systems) {
  return { ...(systems || {}) };
}

describe('SystemHealthDashboard', () => {

  describe('constructor', () => {
    it('initializes with default options', () => {
      const app = createMockApp();
      const sys = new SystemHealthDashboard(app);
      assertEqual(sys.overallScore, 100);
      assertEqual(sys.initialized, false);
      assert(sys.systems instanceof Map, 'systems is a Map');
      assertEqual(sys.systems.size, 0);
      assertEqual(sys.alertThreshold, 80);
      cleanup(sys);
    });

    it('accepts custom options', () => {
      const app = createMockApp();
      const sys = new SystemHealthDashboard(app, {
        pollInterval: 10000,
        alertThreshold: 90,
        autoDiscover: false
      });
      assertEqual(sys.pollIntervalMs, 10000);
      assertEqual(sys.alertThreshold, 90);
      assertEqual(sys.autoDiscover, false);
      cleanup(sys);
    });
  });

  describe('registerSystem', () => {
    it('adds a system to the registry', () => {
      const app = createMockApp();
      const sys = new SystemHealthDashboard(app, { autoDiscover: false });
      const ref = { getHealth: async () => ({ status: 'HEALTHY' }) };
      sys.registerSystem('testSystem', ref);
      assertEqual(sys.systems.size, 1);
      assert(sys.systems.has('testSystem'), 'system registered');
      cleanup(sys);
    });

    it('throws on duplicate registration', () => {
      const app = createMockApp();
      const sys = new SystemHealthDashboard(app, { autoDiscover: false });
      const ref = { getHealth: async () => ({ status: 'HEALTHY' }) };
      sys.registerSystem('testSystem', ref);
      assertThrows(() => sys.registerSystem('testSystem', ref));
      cleanup(sys);
    });
  });

  describe('unregisterSystem', () => {
    it('removes an existing system and returns true', () => {
      const app = createMockApp();
      const sys = new SystemHealthDashboard(app, { autoDiscover: false });
      sys.registerSystem('test', { getHealth: async () => ({ status: 'OK' }) });
      assertEqual(sys.unregisterSystem('test'), true);
      assertEqual(sys.systems.size, 0);
      cleanup(sys);
    });

    it('returns false for unknown system', () => {
      const app = createMockApp();
      const sys = new SystemHealthDashboard(app, { autoDiscover: false });
      assertEqual(sys.unregisterSystem('nonexistent'), false);
      cleanup(sys);
    });
  });

  describe('_resolveStatus', () => {
    it('maps various status strings to canonical values', () => {
      const app = createMockApp();
      const sys = new SystemHealthDashboard(app, { autoDiscover: false });
      assertEqual(sys._resolveStatus({ status: 'OK' }), 'HEALTHY');
      assertEqual(sys._resolveStatus({ status: 'HEALTHY' }), 'HEALTHY');
      assertEqual(sys._resolveStatus({ status: 'WARNING' }), 'DEGRADED');
      assertEqual(sys._resolveStatus({ status: 'ERROR' }), 'UNHEALTHY');
      assertEqual(sys._resolveStatus({ status: 'TIMEOUT' }), 'UNRESPONSIVE');
      assertEqual(sys._resolveStatus(null), 'UNHEALTHY');
      assertEqual(sys._resolveStatus({ status: 'something_unknown' }), 'HEALTHY');
      cleanup(sys);
    });
  });

  describe('_adjustScoreByMetrics', () => {
    it('returns base score with no penalty data', () => {
      const app = createMockApp();
      const sys = new SystemHealthDashboard(app, { autoDiscover: false });
      assertEqual(sys._adjustScoreByMetrics(100, {}), 100);
      cleanup(sys);
    });

    it('applies error rate penalty', () => {
      const app = createMockApp();
      const sys = new SystemHealthDashboard(app, { autoDiscover: false });
      const score = sys._adjustScoreByMetrics(100, { errorRate: 0.1 });
      assert(score < 100, 'score reduced by error rate');
      cleanup(sys);
    });

    it('applies memory usage penalty when above 80%', () => {
      const app = createMockApp();
      const sys = new SystemHealthDashboard(app, { autoDiscover: false });
      const score = sys._adjustScoreByMetrics(100, { memoryUsagePercent: 95 });
      assert(score < 100, 'score reduced by memory usage');
      cleanup(sys);
    });

    it('returns 0 when base score is 0', () => {
      const app = createMockApp();
      const sys = new SystemHealthDashboard(app, { autoDiscover: false });
      assertEqual(sys._adjustScoreByMetrics(0, { errorRate: 0.5 }), 0);
      cleanup(sys);
    });
  });

  describe('_calculateOverallScore', () => {
    it('returns 100 with no registered systems', () => {
      const app = createMockApp();
      const sys = new SystemHealthDashboard(app, { autoDiscover: false });
      assertEqual(sys._calculateOverallScore(), 100);
      cleanup(sys);
    });

    it('averages scores of registered systems', () => {
      const app = createMockApp();
      const sys = new SystemHealthDashboard(app, { autoDiscover: false });
      sys.registerSystem('a', { getHealth: async () => ({}) });
      sys.registerSystem('b', { getHealth: async () => ({}) });
      sys.systems.get('a').score = 100;
      sys.systems.get('b').score = 50;
      assertEqual(sys._calculateOverallScore(), 75);
      cleanup(sys);
    });
  });

  describe('pollAllSystems', () => {
    it('polls registered systems and returns overall score', async () => {
      const app = createMockApp();
      const sys = new SystemHealthDashboard(app, { autoDiscover: false, healthCheckTimeout: 200 });
      sys.registerSystem('healthy', { getHealth: async () => ({ status: 'OK' }) });
      sys.registerSystem('degraded', { getStatus: async () => ({ status: 'WARNING' }) });
      const score = await sys.pollAllSystems();
      assertType(score, 'number');
      assert(score >= 0 && score <= 100, 'score in range');
      assertEqual(sys.systems.get('healthy').status, 'HEALTHY');
      assertEqual(sys.systems.get('degraded').status, 'DEGRADED');
      cleanup(sys);
    });
  });

  describe('resolveAlert', () => {
    it('resolves an existing alert', () => {
      const app = createMockApp();
      const sys = new SystemHealthDashboard(app, { autoDiscover: false });
      sys._addAlert('WARNING', 'test alert', 'testSystem');
      const alert = sys.alerts[0];
      assertEqual(sys.resolveAlert(alert.id), true);
      assertEqual(alert.resolved, true);
      assert(alert.resolvedAt !== null, 'resolvedAt set');
      cleanup(sys);
    });

    it('returns false for unknown alert id', () => {
      const app = createMockApp();
      const sys = new SystemHealthDashboard(app, { autoDiscover: false });
      assertEqual(sys.resolveAlert('nonexistent'), false);
      cleanup(sys);
    });
  });

  describe('getDashboard', () => {
    it('returns complete dashboard payload', async () => {
      const app = createMockApp();
      const sys = new SystemHealthDashboard(app, { autoDiscover: false, healthCheckTimeout: 200 });
      sys.registerSystem('test', { getHealth: async () => ({ status: 'HEALTHY' }) });
      await sys.pollAllSystems();
      const dashboard = sys.getDashboard();
      assertType(dashboard.overallScore, 'number');
      assertEqual(dashboard.systemCount, 1);
      assert(dashboard.systems.test !== undefined, 'has test system');
      assert(dashboard.metrics !== undefined, 'has metrics');
      assertType(dashboard.generatedAt, 'number');
      cleanup(sys);
    });
  });

  describe('getSystemHealth', () => {
    it('returns health for registered system', () => {
      const app = createMockApp();
      const sys = new SystemHealthDashboard(app, { autoDiscover: false });
      sys.registerSystem('test', { getHealth: async () => ({}) });
      const health = sys.getSystemHealth('test');
      assert(health !== null, 'health returned');
      assertEqual(health.name, 'test');
      cleanup(sys);
    });

    it('returns null for unknown system', () => {
      const app = createMockApp();
      const sys = new SystemHealthDashboard(app, { autoDiscover: false });
      assertEqual(sys.getSystemHealth('unknown'), null);
      cleanup(sys);
    });
  });

  describe('getAlerts', () => {
    it('returns all alerts when no severity specified', () => {
      const app = createMockApp();
      const sys = new SystemHealthDashboard(app, { autoDiscover: false });
      sys._addAlert('WARNING', 'warn msg', 'sys1');
      sys._addAlert('CRITICAL', 'crit msg', 'sys2');
      assertEqual(sys.getAlerts().length, 2);
      cleanup(sys);
    });

    it('filters alerts by severity', () => {
      const app = createMockApp();
      const sys = new SystemHealthDashboard(app, { autoDiscover: false });
      sys._addAlert('WARNING', 'warn msg', 'sys1');
      sys._addAlert('CRITICAL', 'crit msg', 'sys2');
      assertEqual(sys.getAlerts('WARNING').length, 1);
      assertEqual(sys.getAlerts('WARNING')[0].level, 'WARNING');
      cleanup(sys);
    });
  });

  describe('getPerformanceReport', () => {
    it('returns performance report with alert summary', async () => {
      const app = createMockApp();
      const sys = new SystemHealthDashboard(app, { autoDiscover: false, healthCheckTimeout: 200 });
      sys.registerSystem('test', { getHealth: async () => ({ status: 'OK' }) });
      await sys.pollAllSystems();
      const report = sys.getPerformanceReport();
      assertType(report.overallScore, 'number');
      assertEqual(report.systemCount, 1);
      assert(report.alertsSummary !== undefined, 'has alert summary');
      assertType(report.uptimePercent, 'number');
      cleanup(sys);
    });
  });

  describe('getTopIssues', () => {
    it('returns systems sorted by lowest score first', async () => {
      const app = createMockApp();
      const sys = new SystemHealthDashboard(app, { autoDiscover: false, healthCheckTimeout: 200 });
      sys.registerSystem('good', { getHealth: async () => ({ status: 'HEALTHY' }) });
      sys.registerSystem('bad', { getHealth: async () => ({ status: 'ERROR' }) });
      await sys.pollAllSystems();
      const issues = sys.getTopIssues(5);
      assertEqual(issues.length, 2);
      assertEqual(issues[0].name, 'bad');
      assertEqual(issues[0].status, 'UNHEALTHY');
      cleanup(sys);
    });
  });

  describe('runDiagnostics', () => {
    it('returns diagnostic report with pass/fail counts', async () => {
      const app = createMockApp();
      const sys = new SystemHealthDashboard(app, { autoDiscover: false, healthCheckTimeout: 200 });
      sys.registerSystem('healthy', { getHealth: async () => ({ status: 'HEALTHY' }) });
      sys.registerSystem('failing', { getHealth: async () => ({ status: 'ERROR' }) });
      const report = await sys.runDiagnostics();
      assertEqual(report.systemCount, 2);
      assertEqual(report.passed, 1);
      assert(report.results.healthy !== undefined, 'has healthy result');
      assert(report.results.failing !== undefined, 'has failing result');
      assertType(report.totalDurationMs, 'number');
      cleanup(sys);
    });
  });

  describe('_countByStatus', () => {
    it('counts systems by their current status', async () => {
      const app = createMockApp();
      const sys = new SystemHealthDashboard(app, { autoDiscover: false, healthCheckTimeout: 200 });
      sys.registerSystem('h1', { getHealth: async () => ({ status: 'OK' }) });
      sys.registerSystem('d1', { getStatus: async () => ({ status: 'WARNING' }) });
      await sys.pollAllSystems();
      const counts = sys._countByStatus();
      assertEqual(counts.healthy, 1);
      assertEqual(counts.degraded, 1);
      cleanup(sys);
    });
  });

  describe('_calculateUptimePercent', () => {
    it('returns 100 with empty history', () => {
      const app = createMockApp();
      const sys = new SystemHealthDashboard(app, { autoDiscover: false });
      assertEqual(sys._calculateUptimePercent(), 100);
      cleanup(sys);
    });
  });

  describe('initialize with auto-discovery', () => {
    it('discovers systems from app and starts polling', async () => {
      const app = createMockApp({
        energySys: { getHealth: async () => ({ status: 'OK' }) }
      });
      const sys = new SystemHealthDashboard(app, { healthCheckTimeout: 200 });
      await sys.initialize();
      assertEqual(sys.initialized, true);
      assert(sys.systems.size > 0, 'systems discovered');
      assert(sys._pollTimer !== null, 'poll timer started');
      assert(sys._snapshotTimer !== null, 'snapshot timer started');
      cleanup(sys);
    });
  });

  describe('destroy', () => {
    it('clears timers and resets state', async () => {
      const app = createMockApp({
        testSys: { getHealth: async () => ({ status: 'OK' }) }
      });
      const sys = new SystemHealthDashboard(app, { healthCheckTimeout: 200 });
      await sys.initialize();
      sys.destroy();
      assertEqual(sys._pollTimer, null);
      assertEqual(sys._snapshotTimer, null);
      assertEqual(sys.initialized, false);
      assertEqual(sys.systems.size, 0);
      cleanup(sys);
    });
  });

});

run();
