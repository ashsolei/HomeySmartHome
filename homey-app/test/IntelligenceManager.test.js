'use strict';

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertType } = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');

const _origSetTimeout = global.setTimeout;
const _origSetInterval = global.setInterval;
const activeHandles = [];
global.setTimeout = (...a) => { const id = _origSetTimeout(...a); activeHandles.push({ type: 'timeout', id }); return id; };
global.setInterval = (...a) => { const id = _origSetInterval(...a); activeHandles.push({ type: 'interval', id }); return id; };
function cleanup(sys) {
  try { if (sys && sys.analysisInterval) clearInterval(sys.analysisInterval); } catch (_) {}
  try { if (sys && sys.recommendationInterval) clearInterval(sys.recommendationInterval); } catch (_) {}
  try { if (sys && typeof sys.destroy === 'function') sys.destroy(); } catch (_) {}
  while (activeHandles.length > 0) {
    const h = activeHandles.pop();
    if (h.type === 'timeout') clearTimeout(h.id); else clearInterval(h.id);
  }
}

const IntelligenceManager = require('../lib/IntelligenceManager');

describe('IntelligenceManager — constructor & init', () => {
  it('instantiates without errors', () => {
    const sys = new IntelligenceManager(createMockHomey());
    assert(sys, 'should create instance');
    assertEqual(sys.patterns.size, 0);
    assertEqual(sys.predictions.size, 0);
    assert(Array.isArray(sys.recommendations), 'recommendations should be array');
    assert(Array.isArray(sys.learningData.userBehavior), 'userBehavior should be array');
    cleanup(sys);
  });

  it('initialize sets up engine', async () => {
    const sys = new IntelligenceManager(createMockHomey());
    await sys.initialize();
    assert(sys.analysisInterval, 'should have analysis interval');
    assert(sys.recommendationInterval, 'should have recommendation interval');
    cleanup(sys);
  });
});

describe('IntelligenceManager — pattern recognition', () => {
  it('analyzeUserBehavior returns patterns', async () => {
    const sys = new IntelligenceManager(createMockHomey());
    await sys.initialize();
    const patterns = await sys.analyzeUserBehavior();
    assert(patterns, 'should return patterns');
    assert(patterns.timePatterns, 'should have timePatterns');
    assert(patterns.routinePatterns, 'should have routinePatterns');
    assert(patterns.preferencePatterns, 'should have preferencePatterns');
    assert(patterns.anomalies, 'should have anomalies');
    cleanup(sys);
  });

  it('analyzeUserBehavior with data produces time patterns', async () => {
    const sys = new IntelligenceManager(createMockHomey());
    await sys.initialize();
    for (let i = 0; i < 10; i++) {
      await sys.recordUserAction({ type: 'light', action: 'on', brightness: 80 });
    }
    const patterns = await sys.analyzeUserBehavior();
    assert(patterns.timePatterns.hourly, 'should have hourly');
    assertEqual(patterns.timePatterns.hourly.length, 24);
    assert(patterns.timePatterns.weekly, 'should have weekly');
    assertEqual(patterns.timePatterns.weekly.length, 7);
    cleanup(sys);
  });
});

describe('IntelligenceManager — predictions', () => {
  it('predictNextAction returns null with no data', async () => {
    const sys = new IntelligenceManager(createMockHomey());
    await sys.initialize();
    const prediction = await sys.predictNextAction({ hour: 10, day: 1 });
    assertEqual(prediction, null);
    cleanup(sys);
  });

  it('predictEnergy returns null with insufficient data', async () => {
    const sys = new IntelligenceManager(createMockHomey());
    await sys.initialize();
    const prediction = await sys.predictEnergy('today');
    assertEqual(prediction, null);
    cleanup(sys);
  });

  it('predictOptimalTemperature returns default with no data', async () => {
    const sys = new IntelligenceManager(createMockHomey());
    await sys.initialize();
    const result = await sys.predictOptimalTemperature('living_room');
    assert(result, 'should return result');
    assertType(result.temperature, 'number');
    assertType(result.confidence, 'number');
    cleanup(sys);
  });
});

describe('IntelligenceManager — learning', () => {
  it('recordUserAction adds to learningData', async () => {
    const sys = new IntelligenceManager(createMockHomey());
    await sys.initialize();
    const before = sys.learningData.userBehavior.length;
    await sys.recordUserAction({ type: 'light', action: 'on' });
    assertEqual(sys.learningData.userBehavior.length, before + 1);
    cleanup(sys);
  });

  it('recordDeviceUsage adds to learningData', async () => {
    const sys = new IntelligenceManager(createMockHomey());
    await sys.initialize();
    const before = sys.learningData.deviceUsage.length;
    await sys.recordDeviceUsage('dev1', 'onoff', true);
    assertEqual(sys.learningData.deviceUsage.length, before + 1);
    cleanup(sys);
  });

  it('recordEnergyPattern adds to learningData', async () => {
    const sys = new IntelligenceManager(createMockHomey());
    await sys.initialize();
    const before = sys.learningData.energyPatterns.length;
    await sys.recordEnergyPattern(2.5);
    assertEqual(sys.learningData.energyPatterns.length, before + 1);
    cleanup(sys);
  });

  it('recordClimatePreference adds to learningData', async () => {
    const sys = new IntelligenceManager(createMockHomey());
    await sys.initialize();
    const before = sys.learningData.climatePreferences.length;
    await sys.recordClimatePreference('living_room', 22);
    assertEqual(sys.learningData.climatePreferences.length, before + 1);
    cleanup(sys);
  });
});

describe('IntelligenceManager — helpers', () => {
  it('getTimeWindow returns correct window', () => {
    const sys = new IntelligenceManager(createMockHomey());
    assertEqual(sys.getTimeWindow(8), 'morning');
    assertEqual(sys.getTimeWindow(14), 'afternoon');
    assertEqual(sys.getTimeWindow(19), 'evening');
    assertEqual(sys.getTimeWindow(2), 'night');
    cleanup(sys);
  });

  it('calculateAverage computes correct average', () => {
    const sys = new IntelligenceManager(createMockHomey());
    assertEqual(sys.calculateAverage([10, 20, 30]), 20);
    assertEqual(sys.calculateAverage([]), 0);
    cleanup(sys);
  });

  it('calculateStdDev computes standard deviation', () => {
    const sys = new IntelligenceManager(createMockHomey());
    const stdDev = sys.calculateStdDev([10, 10, 10]);
    assertEqual(stdDev, 0);
    cleanup(sys);
  });

  it('calculateTrend returns 0 for single value', () => {
    const sys = new IntelligenceManager(createMockHomey());
    assertEqual(sys.calculateTrend([5]), 0);
    cleanup(sys);
  });

  it('calculateTrend returns slope', () => {
    const sys = new IntelligenceManager(createMockHomey());
    const trend = sys.calculateTrend([1, 2, 3, 4, 5]);
    assert(trend > 0, 'trend should be positive');
    cleanup(sys);
  });

  it('generateStatistics returns stats', async () => {
    const sys = new IntelligenceManager(createMockHomey());
    await sys.initialize();
    const stats = await sys.generateStatistics();
    assertType(stats.learningDataPoints, 'number');
    assertType(stats.patternsDiscovered, 'number');
    assertType(stats.recommendationsGenerated, 'number');
    assertType(stats.predictionAccuracy, 'number');
    cleanup(sys);
  });
});

run();
