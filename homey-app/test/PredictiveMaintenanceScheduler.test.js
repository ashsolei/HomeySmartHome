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

const PredictiveMaintenanceScheduler = require('../lib/PredictiveMaintenanceScheduler');

describe('PredictiveMaintenanceScheduler — constructor', () => {
  it('instantiates without errors', () => {
    const sys = new PredictiveMaintenanceScheduler(createMockHomey());
    assert(sys, 'should create instance');
    cleanup(sys);
  });

  it('starts with empty maps', () => {
    const sys = new PredictiveMaintenanceScheduler(createMockHomey());
    assertEqual(sys.deviceProfiles.size, 0);
    assertEqual(sys.maintenanceTasks.size, 0);
    assertEqual(sys.maintenanceHistory.length, 0);
    assertEqual(sys.failurePredictions.size, 0);
    assertEqual(sys.anomalyDetector, null);
    cleanup(sys);
  });
});

describe('PredictiveMaintenanceScheduler — initialize', () => {
  it('initializes anomaly detector and default schedules', async () => {
    const sys = new PredictiveMaintenanceScheduler(createMockHomey());
    await sys.initialize();
    assert(sys.anomalyDetector, 'should create anomaly detector');
    assert(sys.anomalyDetector.thresholds.temperature, 'should have temp thresholds');
    assert(sys.defaultSchedules, 'should have default schedules');
    assert(sys.defaultSchedules.thermostat, 'should have thermostat schedule');
    cleanup(sys);
  });
});

describe('PredictiveMaintenanceScheduler — categorizeDeviceType', () => {
  it('categorizes light devices', () => {
    const sys = new PredictiveMaintenanceScheduler(createMockHomey());
    assertEqual(sys.categorizeDeviceType({ name: 'Living Room Light', class: '' }), 'light_bulb');
    assertEqual(sys.categorizeDeviceType({ name: 'Lamp', class: 'light' }), 'light_bulb');
    cleanup(sys);
  });

  it('categorizes sensors', () => {
    const sys = new PredictiveMaintenanceScheduler(createMockHomey());
    assertEqual(sys.categorizeDeviceType({ name: 'Motion Sensor', class: '' }), 'sensor');
    cleanup(sys);
  });

  it('categorizes thermostat', () => {
    const sys = new PredictiveMaintenanceScheduler(createMockHomey());
    assertEqual(sys.categorizeDeviceType({ name: 'Thermostat', class: '' }), 'thermostat');
    cleanup(sys);
  });

  it('categorizes lock', () => {
    const sys = new PredictiveMaintenanceScheduler(createMockHomey());
    assertEqual(sys.categorizeDeviceType({ name: 'Front Door Lock', class: '' }), 'lock');
    cleanup(sys);
  });

  it('categorizes camera', () => {
    const sys = new PredictiveMaintenanceScheduler(createMockHomey());
    assertEqual(sys.categorizeDeviceType({ name: 'Garden Camera', class: '' }), 'camera');
    cleanup(sys);
  });

  it('categorizes smoke detector', () => {
    const sys = new PredictiveMaintenanceScheduler(createMockHomey());
    assertEqual(sys.categorizeDeviceType({ name: 'Smoke Detector', class: '' }), 'smoke_detector');
    cleanup(sys);
  });

  it('returns other for unknown type', () => {
    const sys = new PredictiveMaintenanceScheduler(createMockHomey());
    assertEqual(sys.categorizeDeviceType({ name: 'Unknown Device', class: '' }), 'other');
    cleanup(sys);
  });
});

describe('PredictiveMaintenanceScheduler — getExpectedLifespan', () => {
  it('returns correct lifespan for known types', () => {
    const sys = new PredictiveMaintenanceScheduler(createMockHomey());
    assertEqual(sys.getExpectedLifespan({ name: 'Light', class: 'light' }), 1825);
    assertEqual(sys.getExpectedLifespan({ name: 'Motion Sensor', class: '' }), 3650);
    cleanup(sys);
  });

  it('returns default for unknown types', () => {
    const sys = new PredictiveMaintenanceScheduler(createMockHomey());
    assertEqual(sys.getExpectedLifespan({ name: 'Unknown', class: '' }), 2555);
    cleanup(sys);
  });
});

describe('PredictiveMaintenanceScheduler — predictDeviceFailure', () => {
  it('predicts low probability for new healthy device', async () => {
    const sys = new PredictiveMaintenanceScheduler(createMockHomey());
    const profile = {
      installed: Date.now(),
      healthHistory: [],
      usageStats: { cycleCount: 0 }
    };
    const prediction = await sys.predictDeviceFailure(profile);
    assertEqual(prediction.probability, 0);
    assertEqual(prediction.timeframe, 'unknown');
    cleanup(sys);
  });

  it('predicts higher probability for old device', async () => {
    const sys = new PredictiveMaintenanceScheduler(createMockHomey());
    const profile = {
      installed: Date.now() - (2555 * 0.9 * 86400000), // 90% of expected lifespan
      healthHistory: [],
      usageStats: { cycleCount: 0 }
    };
    const prediction = await sys.predictDeviceFailure(profile);
    assert(prediction.probability > 0, 'should have elevated probability');
    assert(prediction.factors.includes('High age'), 'should include High age factor');
    cleanup(sys);
  });

  it('predicts higher probability for poor health history', async () => {
    const sys = new PredictiveMaintenanceScheduler(createMockHomey());
    const profile = {
      installed: Date.now(),
      healthHistory: Array.from({ length: 11 }, () => ({ score: 0.5 })),
      usageStats: { cycleCount: 0 }
    };
    const prediction = await sys.predictDeviceFailure(profile);
    assert(prediction.probability > 0, 'should have probability');
    assert(prediction.factors.includes('Poor health trend'), 'should include health factor');
    cleanup(sys);
  });

  it('predicts higher probability for high usage', async () => {
    const sys = new PredictiveMaintenanceScheduler(createMockHomey());
    const profile = {
      installed: Date.now(),
      healthHistory: [],
      usageStats: { cycleCount: 15000 }
    };
    const prediction = await sys.predictDeviceFailure(profile);
    assert(prediction.probability > 0, 'should have probability');
    assert(prediction.factors.includes('High usage'), 'should include usage factor');
    cleanup(sys);
  });
});

describe('PredictiveMaintenanceScheduler — generateMaintenanceActions', () => {
  it('generates actions for offline device', async () => {
    const sys = new PredictiveMaintenanceScheduler(createMockHomey());
    await sys.initializeAnomalyDetector();
    await sys.setupDefaultMaintenanceSchedules();
    const actions = sys.generateMaintenanceActions('thermostat', {
      score: 0.5,
      issues: ['Device offline'],
      metrics: {}
    });
    assert(actions.includes('Check power connection'), 'should include power check');
    assert(actions.includes('Restart device'), 'should include restart');
    cleanup(sys);
  });

  it('generates actions for low battery', async () => {
    const sys = new PredictiveMaintenanceScheduler(createMockHomey());
    await sys.setupDefaultMaintenanceSchedules();
    const actions = sys.generateMaintenanceActions('sensor', {
      score: 0.8,
      issues: ['Low battery'],
      metrics: {}
    });
    assert(actions.includes('Replace battery'), 'should include battery replacement');
    cleanup(sys);
  });
});

describe('PredictiveMaintenanceScheduler — generatePreventiveActions', () => {
  it('generates actions for high age', async () => {
    const sys = new PredictiveMaintenanceScheduler(createMockHomey());
    await sys.setupDefaultMaintenanceSchedules();
    const actions = sys.generatePreventiveActions('thermostat', {
      factors: ['High age']
    });
    assert(actions.includes('Inspect for wear and tear'), 'should include wear check');
    cleanup(sys);
  });
});

describe('PredictiveMaintenanceScheduler — scheduleMaintenanceTask', () => {
  it('creates and stores a task', async () => {
    const sys = new PredictiveMaintenanceScheduler(createMockHomey());
    await sys.setupDefaultMaintenanceSchedules();
    const device = { id: 'dev1', name: 'Test Device', class: '' };
    const profile = { type: 'other' };
    const health = { score: 0.5, issues: ['Slow response time'], metrics: {} };
    const task = await sys.scheduleMaintenanceTask(device, profile, health);
    assert(task, 'should return task');
    assertEqual(task.status, 'pending');
    assertEqual(task.type, 'corrective');
    assertEqual(task.priority, 'medium');
    assert(sys.maintenanceTasks.size > 0, 'should store task');
    cleanup(sys);
  });
});

describe('PredictiveMaintenanceScheduler — completeMaintenanceTask', () => {
  it('completes an existing task', async () => {
    const sys = new PredictiveMaintenanceScheduler(createMockHomey());
    await sys.setupDefaultMaintenanceSchedules();
    const device = { id: 'dev1', name: 'Test' };
    const profile = { type: 'other' };
    const health = { score: 0.6, issues: [], metrics: {} };
    sys.deviceProfiles.set('dev1', { id: 'dev1', maintenanceRecords: [] });
    const task = await sys.scheduleMaintenanceTask(device, profile, health);
    const completed = await sys.completeMaintenanceTask(task.id, 'Fixed');
    assertEqual(completed.status, 'completed');
    assert(completed.completedAt > 0, 'should have completion time');
    assertEqual(completed.notes, 'Fixed');
    assertEqual(sys.maintenanceHistory.length, 1);
    cleanup(sys);
  });

  it('throws for unknown task', async () => {
    const sys = new PredictiveMaintenanceScheduler(createMockHomey());
    let threw = false;
    try {
      await sys.completeMaintenanceTask('nonexistent');
    } catch (_e) {
      threw = true;
    }
    assertEqual(threw, true);
    cleanup(sys);
  });
});

describe('PredictiveMaintenanceScheduler — getStatistics', () => {
  it('returns comprehensive stats', () => {
    const sys = new PredictiveMaintenanceScheduler(createMockHomey());
    const stats = sys.getStatistics();
    assertEqual(stats.deviceProfiles, 0);
    assertEqual(stats.totalTasks, 0);
    assertEqual(stats.pendingTasks, 0);
    assertEqual(stats.completedTasks, 0);
    assertType(stats.failurePredictions, 'number');
    cleanup(sys);
  });
});

describe('PredictiveMaintenanceScheduler — detectAnomalies', () => {
  it('detects sudden health decline', async () => {
    const sys = new PredictiveMaintenanceScheduler(createMockHomey());
    await sys.initializeAnomalyDetector();
    await sys.setupDefaultMaintenanceSchedules();
    const device = { id: 'dev1', name: 'Test', class: '' };
    const profile = {
      type: 'other',
      healthHistory: Array.from({ length: 10 }, () => ({ score: 0.9 }))
    };
    const health = { score: 0.3, issues: [], metrics: { responseTime: 100, errorRate: 0.01 } };
    // Should not throw
    await sys.detectAnomalies(device, profile, health);
    cleanup(sys);
  });
});

describe('PredictiveMaintenanceScheduler — destroy', () => {
  it('clears intervals', async () => {
    const sys = new PredictiveMaintenanceScheduler(createMockHomey());
    await sys.initialize();
    sys.destroy();
    assertEqual(sys.monitoringInterval, null);
    assertEqual(sys.predictionInterval, null);
    assertEqual(sys.maintenanceInterval, null);
    cleanup(sys);
  });
});

run();
