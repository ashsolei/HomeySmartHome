'use strict';

const { describe, it, run } = require('./helpers/runner');
const {
  assert, assertEqual, assertType, assertInstanceOf
} = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');

const AdvancedAnalytics = require('../lib/AdvancedAnalytics');

/* ──── timer tracking ────
 * startMetricsCollection() creates a 5-min setInterval.
 * Track and clean ALL handles to prevent process leaks.
 */
const _origSetTimeout = global.setTimeout;
const _origSetInterval = global.setInterval;
const activeHandles = [];

global.setTimeout = (...args) => {
  const id = _origSetTimeout(...args);
  activeHandles.push({ type: 'timeout', id });
  return id;
};
global.setInterval = (...args) => {
  const id = _origSetInterval(...args);
  activeHandles.push({ type: 'interval', id });
  return id;
};

/* ──── helpers ──── */
function createSystem(appOverrides = {}) {
  const homey = createMockHomey();
  homey.app.energyManager = {
    async getHistoricalData(_date) {
      return { consumption: 25, cost: 37.5 };
    },
    async getCurrentConsumption(_type) { return 2.5; }
  };
  homey.app.deviceManager = {
    async getAllDevices() { return []; },
    async getDevices() { return {}; }
  };
  homey.app.automationEngine = {
    automations: new Map(),
    executionHistory: []
  };
  Object.assign(homey.app, appOverrides);
  const sys = new AdvancedAnalytics(homey);
  return { homey, sys };
}

function cleanup(sys) {
  if (sys.collectionInterval) {
    clearInterval(sys.collectionInterval);
    sys.collectionInterval = null;
  }
  while (activeHandles.length > 0) {
    const h = activeHandles.pop();
    if (h.type === 'timeout') clearTimeout(h.id);
    else clearInterval(h.id);
  }
}

/* ================================================================
   TESTS
   ================================================================ */

describe('AdvancedAnalytics — constructor', () => {
  it('creates instance with Map-based stores', () => {
    const { sys } = createSystem();
    assertInstanceOf(sys.metrics, Map);
    assertInstanceOf(sys.trends, Map);
    assertInstanceOf(sys.benchmarks, Map);
    assertEqual(sys.metrics.size, 0);
    cleanup(sys);
  });

  it('stores the homey reference', () => {
    const { sys, homey } = createSystem();
    assertEqual(sys.homey, homey);
    cleanup(sys);
  });
});

describe('AdvancedAnalytics — initialize()', () => {
  it('starts metrics collection interval', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assert(sys.collectionInterval !== undefined, 'collectionInterval should be set');
    cleanup(sys);
  });

  it('loads persisted metrics from settings', async () => {
    const { sys, homey } = createSystem();
    const ts = Date.now();
    homey.settings.set('analyticsMetrics', [[ts, { energy: 10 }]]);
    await sys.initialize();
    assertEqual(sys.metrics.size, 1);
    assertEqual(sys.metrics.get(ts).energy, 10);
    cleanup(sys);
  });

  it('loads persisted trends from settings', async () => {
    const { sys, homey } = createSystem();
    homey.settings.set('analyticsTrends', [['energy', { slope: 0.5 }]]);
    await sys.initialize();
    assertEqual(sys.trends.size, 1);
    assertEqual(sys.trends.get('energy').slope, 0.5);
    cleanup(sys);
  });
});

describe('AdvancedAnalytics — parsePeriodToDays()', () => {
  it('parses day units', () => {
    const { sys } = createSystem();
    assertEqual(sys.parsePeriodToDays('7d'), 7);
    assertEqual(sys.parsePeriodToDays('30d'), 30);
    cleanup(sys);
  });

  it('parses week units', () => {
    const { sys } = createSystem();
    assertEqual(sys.parsePeriodToDays('2w'), 14);
    assertEqual(sys.parsePeriodToDays('1w'), 7);
    cleanup(sys);
  });

  it('parses month units', () => {
    const { sys } = createSystem();
    assertEqual(sys.parsePeriodToDays('1m'), 30);
    assertEqual(sys.parsePeriodToDays('3m'), 90);
    cleanup(sys);
  });

  it('returns 30 for invalid periods', () => {
    const { sys } = createSystem();
    assertEqual(sys.parsePeriodToDays('banana'), 30);
    assertEqual(sys.parsePeriodToDays(''), 30);
    cleanup(sys);
  });
});

describe('AdvancedAnalytics — calculateTrend()', () => {
  it('detects increasing trend', () => {
    const { sys } = createSystem();
    const trend = sys.calculateTrend([10, 20, 30, 40, 50]);
    assert(trend > 0, 'trend should be positive');
    cleanup(sys);
  });

  it('detects decreasing trend', () => {
    const { sys } = createSystem();
    const trend = sys.calculateTrend([50, 40, 30, 20, 10]);
    assert(trend < 0, 'trend should be negative');
    cleanup(sys);
  });

  it('returns 0 for constant values', () => {
    const { sys } = createSystem();
    const trend = sys.calculateTrend([10, 10, 10, 10]);
    assertEqual(trend, 0);
    cleanup(sys);
  });

  it('returns 0 for single value', () => {
    const { sys } = createSystem();
    const trend = sys.calculateTrend([42]);
    assertEqual(trend, 0);
    cleanup(sys);
  });
});

describe('AdvancedAnalytics — calculateAverage()', () => {
  it('computes correct average', () => {
    const { sys } = createSystem();
    assertEqual(sys.calculateAverage([10, 20, 30]), 20);
    cleanup(sys);
  });

  it('handles single value', () => {
    const { sys } = createSystem();
    assertEqual(sys.calculateAverage([7]), 7);
    cleanup(sys);
  });
});

describe('AdvancedAnalytics — calculateVariance()', () => {
  it('returns 0 for identical values', () => {
    const { sys } = createSystem();
    assertEqual(sys.calculateVariance([5, 5, 5, 5]), 0);
    cleanup(sys);
  });

  it('computes std deviation for known dataset', () => {
    const { sys } = createSystem();
    // [10, 20, 30] → avg=20, diffs=[-10,0,10], sq=[100,0,100], avgSq=200/3, sqrt≈8.16
    const result = sys.calculateVariance([10, 20, 30]);
    assert(result > 8 && result < 9, 'std deviation should be ~8.16');
    cleanup(sys);
  });
});

describe('AdvancedAnalytics — calculateSeasonalFactor()', () => {
  it('returns a number between 0.9 and 1.3', () => {
    const { sys } = createSystem();
    const factor = sys.calculateSeasonalFactor();
    assertType(factor, 'number');
    assert(factor >= 0.9 && factor <= 1.3, 'factor should be 0.9..1.3');
    cleanup(sys);
  });
});

describe('AdvancedAnalytics — getEfficiencyRating()', () => {
  it('returns excellent for scores >= 90', () => {
    const { sys } = createSystem();
    assertEqual(sys.getEfficiencyRating(95), 'excellent');
    assertEqual(sys.getEfficiencyRating(90), 'excellent');
    cleanup(sys);
  });

  it('returns good for scores 75-89', () => {
    const { sys } = createSystem();
    assertEqual(sys.getEfficiencyRating(80), 'good');
    cleanup(sys);
  });

  it('returns average for scores 60-74', () => {
    const { sys } = createSystem();
    assertEqual(sys.getEfficiencyRating(65), 'average');
    cleanup(sys);
  });

  it('returns poor for scores 45-59', () => {
    const { sys } = createSystem();
    assertEqual(sys.getEfficiencyRating(50), 'poor');
    cleanup(sys);
  });

  it('returns very_poor for scores < 45', () => {
    const { sys } = createSystem();
    assertEqual(sys.getEfficiencyRating(30), 'very_poor');
    cleanup(sys);
  });
});

describe('AdvancedAnalytics — groupByClass()', () => {
  it('groups devices by class property', () => {
    const { sys } = createSystem();
    const devices = [
      { class: 'light' }, { class: 'light' }, { class: 'sensor' }
    ];
    const grouped = sys.groupByClass(devices);
    assertEqual(grouped.light, 2);
    assertEqual(grouped.sensor, 1);
    cleanup(sys);
  });

  it('uses "other" for devices without class', () => {
    const { sys } = createSystem();
    const grouped = sys.groupByClass([{ name: 'x' }]);
    assertEqual(grouped.other, 1);
    cleanup(sys);
  });
});

describe('AdvancedAnalytics — groupByZone()', () => {
  it('groups devices by zone name', () => {
    const { sys } = createSystem();
    const devices = [
      { zone: { name: 'Living Room' } },
      { zone: { name: 'Living Room' } },
      { zone: { name: 'Kitchen' } }
    ];
    const grouped = sys.groupByZone(devices);
    assertEqual(grouped['Living Room'], 2);
    assertEqual(grouped['Kitchen'], 1);
    cleanup(sys);
  });

  it('uses "Unknown" for devices without zone', () => {
    const { sys } = createSystem();
    const grouped = sys.groupByZone([{ name: 'orphan' }]);
    assertEqual(grouped['Unknown'], 1);
    cleanup(sys);
  });
});

describe('AdvancedAnalytics — getEnergyBenchmark()', () => {
  it('returns benchmark with average, optimal, poor', async () => {
    const { sys } = createSystem();
    const b = await sys.getEnergyBenchmark();
    assertEqual(b.average, 25);
    assertEqual(b.optimal, 18);
    assertEqual(b.poor, 35);
    cleanup(sys);
  });
});

describe('AdvancedAnalytics — collectEnergyData()', () => {
  it('collects data for 3 days with correct aggregates', async () => {
    const { sys } = createSystem({
      energyManager: {
        async getHistoricalData(_d) { return { consumption: 20, cost: 30 }; }
      }
    });
    const data = await sys.collectEnergyData('3d');
    assertEqual(data.total, 60);
    assertEqual(data.average, 20);
    assertEqual(data.peak, 20);
    assertEqual(data.daily.length, 3);
    assertEqual(data.totalCost, 90);
    assertEqual(data.averageCost, 30);
    cleanup(sys);
  });

  it('falls back to consumption * 1.5 when cost is absent', async () => {
    const { sys } = createSystem({
      energyManager: {
        async getHistoricalData(_d) { return { consumption: 10 }; }
      }
    });
    const data = await sys.collectEnergyData('2d');
    assertEqual(data.totalCost, 30); // 10 * 1.5 * 2
    cleanup(sys);
  });
});

describe('AdvancedAnalytics — forecastEnergy()', () => {
  it('produces forecast with nextDay, nextWeek, nextMonth, confidence', async () => {
    const { sys } = createSystem();
    const data = { average: 20, daily: [18, 20, 22], totalCost: 60 };
    const forecast = await sys.forecastEnergy(data);
    assertType(forecast.nextDay, 'number');
    assertType(forecast.nextWeek, 'number');
    assertType(forecast.nextMonth, 'number');
    assertType(forecast.confidence, 'number');
    assert(forecast.confidence >= 0.5 && forecast.confidence <= 1, 'confidence 0.5..1');
    cleanup(sys);
  });
});

describe('AdvancedAnalytics — calculateEfficiencyScore()', () => {
  it('returns score, rating, and comparison', async () => {
    const { sys } = createSystem();
    const data = { average: 25 }; // same as benchmark → score 100
    const result = await sys.calculateEfficiencyScore(data);
    assertEqual(result.score, 100);
    assertEqual(result.rating, 'excellent');
    assertType(result.comparison.vsAverage, 'number');
    assertType(result.comparison.vsOptimal, 'number');
    cleanup(sys);
  });
});

describe('AdvancedAnalytics — analyzeExecutionsByTime()', () => {
  it('returns 24-hour distribution', () => {
    const { sys } = createSystem();
    const executions = [
      { timestamp: new Date('2024-06-15T10:30:00').getTime(), outcome: { success: true } },
      { timestamp: new Date('2024-06-15T10:45:00').getTime(), outcome: { success: false } },
      { timestamp: new Date('2024-06-15T22:00:00').getTime(), outcome: { success: true } }
    ];
    const result = sys.analyzeExecutionsByTime(executions);
    assertEqual(result.length, 24);
    assertEqual(result[10].executions, 2);
    assertEqual(result[10].successRate, 50);
    assertEqual(result[22].executions, 1);
    assertEqual(result[22].successRate, 100);
    cleanup(sys);
  });

  it('returns zeros for empty executions', () => {
    const { sys } = createSystem();
    const result = sys.analyzeExecutionsByTime([]);
    assertEqual(result.length, 24);
    assertEqual(result[0].executions, 0);
    assertEqual(result[0].successRate, 0);
    cleanup(sys);
  });
});

describe('AdvancedAnalytics — analyzeExecutionsByTrigger()', () => {
  it('groups by trigger reason', () => {
    const { sys } = createSystem();
    const executions = [
      { reason: 'schedule', outcome: { success: true } },
      { reason: 'schedule', outcome: { success: false } },
      { reason: 'sensor', outcome: { success: true } }
    ];
    const result = sys.analyzeExecutionsByTrigger(executions);
    assertEqual(result.length, 2);
    const schedTrigger = result.find(t => t.trigger === 'schedule');
    assertEqual(schedTrigger.executions, 2);
    assertEqual(schedTrigger.successRate, 50);
    cleanup(sys);
  });

  it('uses "unknown" for executions without reason', () => {
    const { sys } = createSystem();
    const result = sys.analyzeExecutionsByTrigger([{ outcome: { success: true } }]);
    assertEqual(result[0].trigger, 'unknown');
    cleanup(sys);
  });
});

describe('AdvancedAnalytics — analyzePresencePatterns()', () => {
  it('separates weekday/weekend patterns', () => {
    const { sys } = createSystem();
    const data = [
      { dayOfWeek: 1, hoursHome: 14, hoursAway: 10 },  // weekday
      { dayOfWeek: 6, hoursHome: 20, hoursAway: 4 }     // weekend
    ];
    const patterns = sys.analyzePresencePatterns(data);
    assertEqual(patterns.weekday.home, 14);
    assertEqual(patterns.weekend.home, 20);
    assertEqual(patterns.hourlyPresence.length, 24);
    cleanup(sys);
  });
});

describe('AdvancedAnalytics — analyzeAutomationPerformance()', () => {
  it('computes per-automation and overall metrics', async () => {
    const { sys } = createSystem();
    const automations = new Map();
    automations.set('a1', {
      name: 'Lights Off',
      enabled: true,
      statistics: { averageExecutionTime: 120, lastExecuted: Date.now() }
    });
    const executions = [
      { automationId: 'a1', outcome: { success: true } },
      { automationId: 'a1', outcome: { success: false } }
    ];
    const perf = await sys.analyzeAutomationPerformance(automations, executions);
    assertEqual(perf.byAutomation.length, 1);
    assertEqual(perf.byAutomation[0].executions, 2);
    assertEqual(perf.byAutomation[0].successRate, 50);
    assertEqual(perf.overall.totalExecutions, 2);
    assertEqual(perf.overall.successRate, 50);
    assertEqual(perf.overall.failureRate, 50);
    cleanup(sys);
  });
});

describe('AdvancedAnalytics — generateEnergyInsights()', () => {
  it('generates trend warning for increasing consumption', async () => {
    const { sys } = createSystem();
    // trend > 0.5 triggers insight
    const data = { daily: [10, 12, 14, 16, 18], average: 14, peak: 18 };
    const insights = await sys.generateEnergyInsights(data);
    const trendInsight = insights.find(i => i.type === 'trend');
    assert(trendInsight !== undefined, 'should have trend insight');
    assertEqual(trendInsight.severity, 'warning');
    cleanup(sys);
  });

  it('generates peak insight when peak > 1.5x average', async () => {
    const { sys } = createSystem();
    const data = { daily: [10, 10, 10], average: 10, peak: 20 };
    const insights = await sys.generateEnergyInsights(data);
    const peakInsight = insights.find(i => i.type === 'peak');
    assert(peakInsight !== undefined, 'should have peak insight');
    assertEqual(peakInsight.severity, 'info');
    cleanup(sys);
  });

  it('returns empty array for stable consumption', async () => {
    const { sys } = createSystem();
    const data = { daily: [10, 10, 10, 10], average: 10, peak: 10 };
    const insights = await sys.generateEnergyInsights(data);
    assertEqual(insights.length, 0);
    cleanup(sys);
  });
});

describe('AdvancedAnalytics — saveMetrics()', () => {
  it('persists metrics Map to settings', async () => {
    const { sys, homey } = createSystem();
    sys.metrics.set(1000, { energy: 5 });
    sys.metrics.set(2000, { energy: 10 });
    await sys.saveMetrics();
    const stored = homey.settings.get('analyticsMetrics');
    assertEqual(stored.length, 2);
    assertEqual(stored[0][0], 1000);
    cleanup(sys);
  });
});

describe('AdvancedAnalytics — calculateForecastConfidence()', () => {
  it('returns high confidence for low variance data', () => {
    const { sys } = createSystem();
    const conf = sys.calculateForecastConfidence({ daily: [10, 10, 10], average: 10 });
    assert(conf >= 0.7, 'confidence should be high');
    cleanup(sys);
  });

  it('returns lower confidence for noisy data', () => {
    const { sys } = createSystem();
    const conf = sys.calculateForecastConfidence({ daily: [5, 50, 5, 50], average: 27.5 });
    assert(conf < 0.8, 'confidence should be reduced');
    assert(conf >= 0.5, 'confidence should not be below 0.5');
    cleanup(sys);
  });
});

run();
