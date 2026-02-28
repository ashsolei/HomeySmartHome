'use strict';

const { describe, it, run } = require('./helpers/runner');
const {
  assert, assertEqual, assertType, assertInstanceOf, assertRejects
} = require('./helpers/assert');
const EventEmitter = require('events');

/*
 * AdvancedAIPredictionEngine uses `require('homey')` globally and accesses
 * `Homey.ManagerSettings.get/set`.  We inject a mock into the require cache
 * BEFORE requiring the module under test.
 */
const mockSettings = new Map();
const homeyMock = {
  ManagerSettings: {
    get(key) { return mockSettings.get(key) ?? null; },
    set(key, value) { mockSettings.set(key, value); }
  }
};

// Inject the mock as `homey` in require.cache
const homeyModulePath = require.resolve('homey');
require.cache[homeyModulePath] = {
  id: homeyModulePath,
  filename: homeyModulePath,
  loaded: true,
  exports: homeyMock
};

const AdvancedAIPredictionEngine = require('../lib/AdvancedAIPredictionEngine');

/* ──── helpers ──── */
function createEngine() {
  mockSettings.clear();
  const engine = new AdvancedAIPredictionEngine();
  return engine;
}

function clearIntervals(engine) {
  if (engine.monitoring && engine.monitoring.interval) {
    clearInterval(engine.monitoring.interval);
    engine.monitoring.interval = null;
  }
}

/* ================================================================
   TESTS
   ================================================================ */

// ── Constructor & Default Data ──
describe('AdvancedAIPredictionEngine — constructor', () => {
  it('creates instance extending EventEmitter', () => {
    const engine = createEngine();
    assertInstanceOf(engine, EventEmitter);
    clearIntervals(engine);
  });

  it('initialises 4 prediction models', () => {
    const engine = createEngine();
    assertEqual(engine.predictionModels.size, 4);
    assert(engine.predictionModels.has('energy-usage'));
    assert(engine.predictionModels.has('presence-pattern'));
    assert(engine.predictionModels.has('device-failure'));
    assert(engine.predictionModels.has('comfort-preferences'));
    clearIntervals(engine);
  });

  it('sets correct algorithms on models', () => {
    const engine = createEngine();
    assertEqual(engine.predictionModels.get('energy-usage').algorithm, 'lstm');
    assertEqual(engine.predictionModels.get('presence-pattern').algorithm, 'random-forest');
    assertEqual(engine.predictionModels.get('device-failure').algorithm, 'isolation-forest');
    assertEqual(engine.predictionModels.get('comfort-preferences').algorithm, 'gradient-boosting');
    clearIntervals(engine);
  });

  it('marks all models as trained by default', () => {
    const engine = createEngine();
    for (const model of engine.predictionModels.values()) {
      assertEqual(model.trained, true);
    }
    clearIntervals(engine);
  });

  it('creates 3 default predictions', () => {
    const engine = createEngine();
    assertEqual(engine.predictions.size, 3);
    assert(engine.predictions.has('energy-next-hour'));
    assert(engine.predictions.has('arrival-time-today'));
    assert(engine.predictions.has('hvac-maintenance'));
    clearIntervals(engine);
  });

  it('creates 2 accuracy metrics', () => {
    const engine = createEngine();
    assertEqual(engine.accuracyMetrics.size, 2);
    assert(engine.accuracyMetrics.has('energy-usage'));
    assert(engine.accuracyMetrics.has('presence-pattern'));
    clearIntervals(engine);
  });

  it('initialises settings with defaults', () => {
    const engine = createEngine();
    assertEqual(engine.settings.minDataPoints, 50);
    assertEqual(engine.settings.confidenceThreshold, 0.7);
    assertEqual(engine.settings.autoActOnPredictions, false);
    assert(Array.isArray(engine.settings.enabledPredictions));
    assertEqual(engine.settings.enabledPredictions.length, 4);
    clearIntervals(engine);
  });

  it('initialises empty cache containers', () => {
    const engine = createEngine();
    assertInstanceOf(engine.cache.data, Map);
    assertInstanceOf(engine.cache.timestamps, Map);
    assertEqual(engine.cache.data.size, 0);
    assertEqual(engine.cache.ttl, 10 * 60 * 1000);
    clearIntervals(engine);
  });

  it('has currentPredictions defaults', () => {
    const engine = createEngine();
    assertEqual(engine.currentPredictions.nextHourEnergyUsage, 0);
    assertEqual(engine.currentPredictions.tomorrowPeakTime, '18:00');
    assertEqual(engine.currentPredictions.likelyHomeTime, '17:30');
    clearIntervals(engine);
  });
});

// ── initialize() ──
describe('AdvancedAIPredictionEngine — initialize', () => {
  it('returns success with model count', async () => {
    const engine = createEngine();
    const result = await engine.initialize();
    assertEqual(result.success, true);
    assertEqual(result.models, 4);
    clearIntervals(engine);
  });

  it('starts monitoring interval', async () => {
    const engine = createEngine();
    await engine.initialize();
    assert(engine.monitoring.interval !== null, 'monitoring interval should be set');
    clearIntervals(engine);
  });

  it('emits initialisation notification', async () => {
    const engine = createEngine();
    let notif = null;
    engine.on('notification', n => { notif = n; });
    await engine.initialize();
    assert(notif !== null, 'should emit notification');
    assertEqual(notif.type, 'info');
    assert(notif.message.includes('4'));
    clearIntervals(engine);
  });

  it('loads settings from Homey.ManagerSettings', async () => {
    mockSettings.clear();
    const saved = {
      predictionModels: [['test-model', { id: 'test-model', trained: false, algorithm: 'test' }]],
      predictions: [],
      accuracyMetrics: [],
      settings: { minDataPoints: 100 }
    };
    mockSettings.set('advancedAIPredictionEngine', saved);

    const engine = new AdvancedAIPredictionEngine();
    await engine.initialize();
    // After loadSettings, the saved model should replace defaults
    assert(engine.predictionModels.has('test-model'));
    assertEqual(engine.settings.minDataPoints, 100);
    clearIntervals(engine);
    mockSettings.clear();
  });
});

// ── predictEnergyUsage() ──
describe('AdvancedAIPredictionEngine — predictEnergyUsage', () => {
  it('returns success with predictions array', async () => {
    const engine = createEngine();
    const result = await engine.predictEnergyUsage(3);
    assertEqual(result.success, true);
    assertEqual(result.predictions.length, 3);
    assertEqual(result.model, 'Energy Usage Prediction');
    clearIntervals(engine);
  });

  it('each prediction has required fields', async () => {
    const engine = createEngine();
    const result = await engine.predictEnergyUsage(2);
    for (const pred of result.predictions) {
      assertType(pred.timestamp, 'string');
      assertType(pred.hour, 'number');
      assertType(pred.predicted, 'number');
      assertType(pred.confidence, 'number');
      assert(pred.confidence >= 0.85 && pred.confidence <= 0.95);
      assertType(pred.range.min, 'number');
      assertType(pred.range.max, 'number');
      assert(pred.range.min <= pred.predicted);
      assert(pred.range.max >= pred.predicted);
    }
    clearIntervals(engine);
  });

  it('defaults to 1 hour ahead', async () => {
    const engine = createEngine();
    const result = await engine.predictEnergyUsage();
    assertEqual(result.predictions.length, 1);
    clearIntervals(engine);
  });

  it('stores latest prediction in predictions map', async () => {
    const engine = createEngine();
    await engine.predictEnergyUsage(1);
    const stored = engine.predictions.get('energy-next-hour');
    assert(stored !== undefined);
    assertEqual(stored.modelId, 'energy-usage');
    assertType(stored.prediction, 'number');
    clearIntervals(engine);
  });

  it('clears cache after prediction', async () => {
    const engine = createEngine();
    engine.setCached('test-key', 'test-value');
    await engine.predictEnergyUsage(1);
    assertEqual(engine.getCached('test-key'), null);
    clearIntervals(engine);
  });

  it('throws if model is not trained', async () => {
    const engine = createEngine();
    engine.predictionModels.get('energy-usage').trained = false;
    await assertRejects(
      () => engine.predictEnergyUsage(1),
      'not trained'
    );
    clearIntervals(engine);
  });
});

// ── getEnergyFactors() ──
describe('AdvancedAIPredictionEngine — getEnergyFactors', () => {
  it('returns morning peak for morning hours', () => {
    const engine = createEngine();
    const factors = engine.getEnergyFactors(7);
    assert(factors.includes('Morning peak usage'));
    clearIntervals(engine);
  });

  it('returns evening peak for evening hours', () => {
    const engine = createEngine();
    const factors = engine.getEnergyFactors(19);
    assert(factors.includes('Evening peak usage'));
    clearIntervals(engine);
  });

  it('returns lunch factor for noon', () => {
    const engine = createEngine();
    const factors = engine.getEnergyFactors(13);
    assert(factors.includes('Lunch time cooking'));
    clearIntervals(engine);
  });

  it('always includes HVAC and Lighting', () => {
    const engine = createEngine();
    const factors = engine.getEnergyFactors(3);
    assert(factors.includes('HVAC active'));
    assert(factors.includes('Normal lighting'));
    clearIntervals(engine);
  });
});

// ── predictPresence() ──
describe('AdvancedAIPredictionEngine — predictPresence', () => {
  it('returns success with prediction object', async () => {
    const engine = createEngine();
    const result = await engine.predictPresence();
    assertEqual(result.success, true);
    assertType(result.prediction.likelyHome, 'boolean');
    assertType(result.prediction.confidence, 'number');
    assertEqual(result.model, 'Presence Pattern Recognition');
    clearIntervals(engine);
  });

  it('weekday evening predicts home with arrival time', async () => {
    const engine = createEngine();
    // Wednesday at 18:00
    const date = new Date('2025-01-15T18:00:00');
    const result = await engine.predictPresence(date);
    assertEqual(result.prediction.likelyHome, true);
    assertEqual(result.prediction.arrivalTime, '17:30');
    clearIntervals(engine);
  });

  it('weekday midday predicts away', async () => {
    const engine = createEngine();
    // Wednesday at 12:00
    const date = new Date('2025-01-15T12:00:00');
    const result = await engine.predictPresence(date);
    assertEqual(result.prediction.likelyHome, false);
    clearIntervals(engine);
  });

  it('weekend morning predicts home', async () => {
    const engine = createEngine();
    // Saturday at 9:00
    const date = new Date('2025-01-18T09:00:00');
    const result = await engine.predictPresence(date);
    assertEqual(result.prediction.likelyHome, true);
    clearIntervals(engine);
  });

  it('weekday early morning predicts home with departure time', async () => {
    const engine = createEngine();
    const date = new Date('2025-01-15T07:00:00');
    const result = await engine.predictPresence(date);
    assertEqual(result.prediction.likelyHome, true);
    assertEqual(result.prediction.departureTime, '08:15');
    clearIntervals(engine);
  });

  it('late night predicts home with high confidence', async () => {
    const engine = createEngine();
    const date = new Date('2025-01-15T23:30:00');
    const result = await engine.predictPresence(date);
    assertEqual(result.prediction.likelyHome, true);
    assertEqual(result.prediction.confidence, 0.95);
    clearIntervals(engine);
  });

  it('stores prediction in predictions map', async () => {
    const engine = createEngine();
    await engine.predictPresence();
    const stored = engine.predictions.get('presence-now');
    assert(stored !== undefined);
    assertEqual(stored.modelId, 'presence-pattern');
    clearIntervals(engine);
  });

  it('throws if model is untrained', async () => {
    const engine = createEngine();
    engine.predictionModels.get('presence-pattern').trained = false;
    await assertRejects(
      () => engine.predictPresence(),
      'not trained'
    );
    clearIntervals(engine);
  });
});

// ── predictDeviceFailure() ──
describe('AdvancedAIPredictionEngine — predictDeviceFailure', () => {
  it('returns success with prediction for hvac', async () => {
    const engine = createEngine();
    const result = await engine.predictDeviceFailure('dev-1', 'hvac');
    assertEqual(result.success, true);
    assertType(result.prediction.failureProbability, 'number');
    assertType(result.prediction.estimatedDaysUntilFailure, 'number');
    assertType(result.prediction.urgency, 'string');
    assertEqual(result.model, 'Device Failure Prediction');
    clearIntervals(engine);
  });

  it('returns valid urgency levels', async () => {
    const engine = createEngine();
    const result = await engine.predictDeviceFailure('dev-2', 'water-heater');
    assert(['high', 'medium', 'low'].includes(result.prediction.urgency));
    clearIntervals(engine);
  });

  it('includes device id and type in prediction', async () => {
    const engine = createEngine();
    const result = await engine.predictDeviceFailure('fridge-1', 'refrigerator');
    assertEqual(result.prediction.deviceId, 'fridge-1');
    assertEqual(result.prediction.deviceType, 'refrigerator');
    clearIntervals(engine);
  });

  it('provides recommended action based on urgency', async () => {
    const engine = createEngine();
    const result = await engine.predictDeviceFailure('dev-3', 'washing-machine');
    assertType(result.prediction.recommendedAction, 'string');
    assert(result.prediction.recommendedAction.length > 0);
    clearIntervals(engine);
  });

  it('handles unknown device type with defaults', async () => {
    const engine = createEngine();
    const result = await engine.predictDeviceFailure('dev-4', 'unknown-thing');
    assertEqual(result.success, true);
    assertType(result.prediction.failureProbability, 'number');
    clearIntervals(engine);
  });

  it('stores prediction with device-specific key', async () => {
    const engine = createEngine();
    await engine.predictDeviceFailure('my-dev', 'hvac');
    const stored = engine.predictions.get('device-failure-my-dev');
    assert(stored !== undefined);
    assertEqual(stored.modelId, 'device-failure');
    clearIntervals(engine);
  });

  it('includes factors array', async () => {
    const engine = createEngine();
    const result = await engine.predictDeviceFailure('dev-5', 'hvac');
    assert(Array.isArray(result.prediction.factors));
    assert(result.prediction.factors.length >= 3);
    clearIntervals(engine);
  });

  it('failure probability capped at 0.95', async () => {
    const engine = createEngine();
    const result = await engine.predictDeviceFailure('old-dev', 'hvac');
    assert(result.prediction.failureProbability <= 0.95);
    clearIntervals(engine);
  });

  it('throws if model untrained', async () => {
    const engine = createEngine();
    engine.predictionModels.get('device-failure').trained = false;
    await assertRejects(
      () => engine.predictDeviceFailure('x', 'hvac'),
      'not trained'
    );
    clearIntervals(engine);
  });
});

// ── predictComfortPreferences() ──
describe('AdvancedAIPredictionEngine — predictComfortPreferences', () => {
  it('returns success with comfort prediction', async () => {
    const engine = createEngine();
    const result = await engine.predictComfortPreferences();
    assertEqual(result.success, true);
    assertType(result.prediction.idealTemperature, 'number');
    assertType(result.prediction.idealLighting, 'number');
    assertEqual(result.prediction.idealHumidity, 45);
    assertEqual(result.model, 'Comfort Preference Learning');
    clearIntervals(engine);
  });

  it('accepts activity context', async () => {
    const engine = createEngine();
    const result = await engine.predictComfortPreferences({ activity: 'working' });
    assertEqual(result.prediction.activity, 'working');
    clearIntervals(engine);
  });

  it('sleeping activity reduces temperature and zeros lighting', async () => {
    const engine = createEngine();
    const result = await engine.predictComfortPreferences({ activity: 'sleeping' });
    assertEqual(result.prediction.idealLighting, 0);
    clearIntervals(engine);
  });

  it('stores prediction in map', async () => {
    const engine = createEngine();
    await engine.predictComfortPreferences({ mood: 'happy' });
    const stored = engine.predictions.get('comfort-now');
    assert(stored !== undefined);
    assertEqual(stored.modelId, 'comfort-preferences');
    clearIntervals(engine);
  });

  it('includes factors array', async () => {
    const engine = createEngine();
    const result = await engine.predictComfortPreferences();
    assert(Array.isArray(result.prediction.factors));
    assert(result.prediction.factors.length >= 3);
    clearIntervals(engine);
  });

  it('throws if model untrained', async () => {
    const engine = createEngine();
    engine.predictionModels.get('comfort-preferences').trained = false;
    await assertRejects(
      () => engine.predictComfortPreferences(),
      'not trained'
    );
    clearIntervals(engine);
  });
});

// ── trainModel() ──
describe('AdvancedAIPredictionEngine — trainModel', () => {
  it('successfully trains with sufficient data', async () => {
    const engine = createEngine();
    const data = Array.from({ length: 60 }, (_, i) => ({ value: i }));
    const result = await engine.trainModel('energy-usage', data);
    assertEqual(result.success, true);
    assertEqual(result.model, 'Energy Usage Prediction');
    assertEqual(result.dataPoints, 60);
    assertType(result.accuracy, 'number');
    assert(result.accuracy >= 0.75 && result.accuracy <= 0.95);
    clearIntervals(engine);
  });

  it('updates model metadata after training', async () => {
    const engine = createEngine();
    const before = engine.predictionModels.get('energy-usage').lastTraining;
    const data = Array.from({ length: 100 }, (_, i) => ({ v: i }));
    await engine.trainModel('energy-usage', data);
    const model = engine.predictionModels.get('energy-usage');
    assertEqual(model.dataPoints, 100);
    assert(model.lastTraining >= before);
    assertEqual(model.trained, true);
    clearIntervals(engine);
  });

  it('rejects insufficient data points', async () => {
    const engine = createEngine();
    const data = Array.from({ length: 10 }, (_, i) => ({ v: i }));
    await assertRejects(
      () => engine.trainModel('energy-usage', data),
      'Insufficient data'
    );
    clearIntervals(engine);
  });

  it('rejects unknown model id', async () => {
    const engine = createEngine();
    const data = Array.from({ length: 100 }, (_, i) => ({ v: i }));
    await assertRejects(
      () => engine.trainModel('non-existent', data),
      'not found'
    );
    clearIntervals(engine);
  });

  it('emits success notification', async () => {
    const engine = createEngine();
    let notif = null;
    engine.on('notification', n => { notif = n; });
    const data = Array.from({ length: 50 }, (_, i) => ({ v: i }));
    await engine.trainModel('presence-pattern', data);
    assert(notif !== null);
    assertEqual(notif.type, 'success');
    assert(notif.message.includes('50'));
    clearIntervals(engine);
  });

  it('saves settings after training', async () => {
    mockSettings.clear();
    const engine = createEngine();
    const data = Array.from({ length: 55 }, (_, i) => ({ v: i }));
    await engine.trainModel('energy-usage', data);
    const saved = mockSettings.get('advancedAIPredictionEngine');
    assert(saved !== null && saved !== undefined, 'settings should be saved');
    clearIntervals(engine);
  });

  it('clears cache after training', async () => {
    const engine = createEngine();
    engine.setCached('foo', 'bar');
    const data = Array.from({ length: 50 }, (_, i) => ({ v: i }));
    await engine.trainModel('energy-usage', data);
    assertEqual(engine.getCached('foo'), null);
    clearIntervals(engine);
  });
});

// ── getPredictionStatistics() ──
describe('AdvancedAIPredictionEngine — getPredictionStatistics', () => {
  it('returns statistics object', () => {
    const engine = createEngine();
    const stats = engine.getPredictionStatistics();
    assertType(stats.models, 'object');
    assertEqual(stats.models.total, 4);
    assertEqual(stats.models.trained, 4);
    assertType(stats.models.averageAccuracy, 'number');
    clearIntervals(engine);
  });

  it('counts predictions in last 24h', () => {
    const engine = createEngine();
    const stats = engine.getPredictionStatistics();
    assertType(stats.predictions.last24h, 'number');
    // Default data has 3 predictions, all with current timestamps
    assert(stats.predictions.last24h >= 3);
    clearIntervals(engine);
  });

  it('reports accuracy from metrics', () => {
    const engine = createEngine();
    const stats = engine.getPredictionStatistics();
    assertType(stats.accuracy.overall, 'number');
    assert(stats.accuracy.overall > 0);
    clearIntervals(engine);
  });

  it('identifies models needing retraining', () => {
    const engine = createEngine();
    const stats = engine.getPredictionStatistics();
    assertType(stats.training.needsRetraining, 'number');
    clearIntervals(engine);
  });

  it('uses cache on second call', () => {
    const engine = createEngine();
    const stats1 = engine.getPredictionStatistics();
    const stats2 = engine.getPredictionStatistics();
    // Same reference from cache
    assert(stats1 === stats2, 'second call should return cached result');
    clearIntervals(engine);
  });

  it('breaks down predictions by type', () => {
    const engine = createEngine();
    const stats = engine.getPredictionStatistics();
    assertType(stats.predictions.byType.energy, 'number');
    assertType(stats.predictions.byType.presence, 'number');
    assertType(stats.predictions.byType.maintenance, 'number');
    assertType(stats.predictions.byType.comfort, 'number');
    clearIntervals(engine);
  });
});

// ── Cache operations ──
describe('AdvancedAIPredictionEngine — cache', () => {
  it('setCached / getCached round-trip', () => {
    const engine = createEngine();
    engine.setCached('key1', { data: 123 });
    const v = engine.getCached('key1');
    assertEqual(v.data, 123);
    clearIntervals(engine);
  });

  it('returns null for missing key', () => {
    const engine = createEngine();
    assertEqual(engine.getCached('nope'), null);
    clearIntervals(engine);
  });

  it('returns null for expired cache', () => {
    const engine = createEngine();
    engine.cache.data.set('old', 42);
    engine.cache.timestamps.set('old', Date.now() - 20 * 60 * 1000); // 20 min ago
    assertEqual(engine.getCached('old'), null);
    clearIntervals(engine);
  });

  it('clearCache removes all entries', () => {
    const engine = createEngine();
    engine.setCached('a', 1);
    engine.setCached('b', 2);
    engine.clearCache();
    assertEqual(engine.getCached('a'), null);
    assertEqual(engine.getCached('b'), null);
    assertEqual(engine.cache.data.size, 0);
    clearIntervals(engine);
  });
});

// ── Getters ──
describe('AdvancedAIPredictionEngine — getters', () => {
  it('getPredictionModels returns array of models', () => {
    const engine = createEngine();
    const models = engine.getPredictionModels();
    assert(Array.isArray(models));
    assertEqual(models.length, 4);
    clearIntervals(engine);
  });

  it('getRecentPredictions returns array', () => {
    const engine = createEngine();
    const preds = engine.getRecentPredictions();
    assert(Array.isArray(preds));
    assertEqual(preds.length, 3);
    clearIntervals(engine);
  });

  it('getRecentPredictions respects limit', () => {
    const engine = createEngine();
    const preds = engine.getRecentPredictions(1);
    assertEqual(preds.length, 1);
    clearIntervals(engine);
  });

  it('getAccuracyMetrics returns array', () => {
    const engine = createEngine();
    const metrics = engine.getAccuracyMetrics();
    assert(Array.isArray(metrics));
    assertEqual(metrics.length, 2);
    clearIntervals(engine);
  });
});

// ── saveSettings ──
describe('AdvancedAIPredictionEngine — saveSettings', () => {
  it('persists data to Homey.ManagerSettings', async () => {
    mockSettings.clear();
    const engine = createEngine();
    await engine.saveSettings();
    const saved = mockSettings.get('advancedAIPredictionEngine');
    assert(saved !== null && saved !== undefined);
    assert(Array.isArray(saved.predictionModels));
    assert(Array.isArray(saved.predictions));
    assert(Array.isArray(saved.accuracyMetrics));
    clearIntervals(engine);
  });

  it('limits saved predictions to 100', async () => {
    mockSettings.clear();
    const engine = createEngine();
    // Add many predictions
    for (let i = 0; i < 150; i++) {
      engine.predictions.set(`pred-${i}`, { id: `pred-${i}`, timestamp: Date.now() });
    }
    await engine.saveSettings();
    const saved = mockSettings.get('advancedAIPredictionEngine');
    assert(saved.predictions.length <= 100);
    clearIntervals(engine);
  });
});

// ── startMonitoring / monitorPredictions ──
describe('AdvancedAIPredictionEngine — monitoring', () => {
  it('startMonitoring sets interval', () => {
    const engine = createEngine();
    engine.startMonitoring();
    assert(engine.monitoring.interval !== null);
    clearIntervals(engine);
  });

  it('startMonitoring clears previous interval', () => {
    const engine = createEngine();
    engine.startMonitoring();
    const first = engine.monitoring.interval;
    engine.startMonitoring();
    assert(engine.monitoring.interval !== first, 'should be a new interval');
    clearIntervals(engine);
  });

  it('monitorPredictions updates lastCheck', async () => {
    const engine = createEngine();
    assertEqual(engine.monitoring.lastCheck, null);
    await engine.monitorPredictions();
    assert(engine.monitoring.lastCheck !== null);
    assertType(engine.monitoring.lastCheck, 'number');
    clearIntervals(engine);
  });

  it('monitorPredictions generates new predictions', async () => {
    const engine = createEngine();
    engine.predictions.clear();
    await engine.monitorPredictions();
    assert(engine.predictions.size > 0, 'should have generated predictions');
    clearIntervals(engine);
  });
});

run();
