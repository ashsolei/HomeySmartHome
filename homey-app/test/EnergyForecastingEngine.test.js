'use strict';

/**
 * Unit tests for EnergyForecastingEngine.
 *
 * Tests the statistical helpers (pure math — no mocking) and the data
 * access methods (statistics, price lookup) with seeded historical data.
 */

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertType } = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');
const EnergyForecastingEngine = require('../lib/EnergyForecastingEngine');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEngine(opts = {}) {
  const homey = createMockHomey();
  const engine = new EnergyForecastingEngine(homey);

  // Suppress timers by stubbing wrapInterval
  engine.wrapInterval = () => {};
  engine.wrapTimeout = () => {};

  if (opts.historicalData) {
    engine.historicalData = opts.historicalData;
  }
  if (opts.energyPrices) {
    engine.energyPrices = opts.energyPrices;
  }

  return { engine, homey };
}

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

describe('EnergyForecastingEngine — constructor', () => {
  it('stores the homey reference', () => {
    const { engine, homey } = makeEngine();
    assertEqual(engine.homey, homey);
  });

  it('initialises historicalData as an empty array', () => {
    const { engine } = makeEngine();
    assert(Array.isArray(engine.historicalData));
    assertEqual(engine.historicalData.length, 0);
  });

  it('initialises forecastModels as a Map', () => {
    const { engine } = makeEngine();
    assert(engine.forecastModels instanceof Map);
    assertEqual(engine.forecastModels.size, 0);
  });

  it('initialises energyPrices as an empty array', () => {
    const { engine } = makeEngine();
    assert(Array.isArray(engine.energyPrices));
    assertEqual(engine.energyPrices.length, 0);
  });

  it('initialises predictions as a Map', () => {
    const { engine } = makeEngine();
    assert(engine.predictions instanceof Map);
    assertEqual(engine.predictions.size, 0);
  });
});

// ---------------------------------------------------------------------------
// calculateMean
// ---------------------------------------------------------------------------

describe('EnergyForecastingEngine — calculateMean', () => {
  it('returns 0 for empty array', () => {
    const { engine } = makeEngine();
    assertEqual(engine.calculateMean([]), 0);
  });

  it('returns the value for single element', () => {
    const { engine } = makeEngine();
    assertEqual(engine.calculateMean([42]), 42);
  });

  it('computes arithmetic mean', () => {
    const { engine } = makeEngine();
    assertEqual(engine.calculateMean([10, 20, 30]), 20);
  });

  it('handles negative values', () => {
    const { engine } = makeEngine();
    assertEqual(engine.calculateMean([-10, 10]), 0);
  });

  it('handles decimal values', () => {
    const { engine } = makeEngine();
    const mean = engine.calculateMean([1.5, 2.5]);
    assertEqual(mean, 2);
  });
});

// ---------------------------------------------------------------------------
// calculateMedian
// ---------------------------------------------------------------------------

describe('EnergyForecastingEngine — calculateMedian', () => {
  it('returns 0 for empty array', () => {
    const { engine } = makeEngine();
    assertEqual(engine.calculateMedian([]), 0);
  });

  it('returns the middle value for odd-length array', () => {
    const { engine } = makeEngine();
    assertEqual(engine.calculateMedian([3, 1, 2]), 2);
  });

  it('returns average of two middle values for even-length array', () => {
    const { engine } = makeEngine();
    assertEqual(engine.calculateMedian([1, 2, 3, 4]), 2.5);
  });

  it('does not mutate the original array', () => {
    const { engine } = makeEngine();
    const arr = [5, 3, 1, 4, 2];
    engine.calculateMedian(arr);
    assertEqual(arr[0], 5);
    assertEqual(arr[1], 3);
  });

  it('handles single element', () => {
    const { engine } = makeEngine();
    assertEqual(engine.calculateMedian([99]), 99);
  });
});

// ---------------------------------------------------------------------------
// calculateStdDev
// ---------------------------------------------------------------------------

describe('EnergyForecastingEngine — calculateStdDev', () => {
  it('returns 0 for empty array', () => {
    const { engine } = makeEngine();
    assertEqual(engine.calculateStdDev([]), 0);
  });

  it('returns 0 for identical values', () => {
    const { engine } = makeEngine();
    assertEqual(engine.calculateStdDev([5, 5, 5, 5]), 0);
  });

  it('computes population standard deviation', () => {
    const { engine } = makeEngine();
    // [2, 4, 4, 4, 5, 5, 7, 9] → mean=5, variance=4 → stdDev=2
    const sd = engine.calculateStdDev([2, 4, 4, 4, 5, 5, 7, 9]);
    assertEqual(sd, 2);
  });

  it('returns non-negative value', () => {
    const { engine } = makeEngine();
    const sd = engine.calculateStdDev([-100, 100, -50, 50]);
    assert(sd >= 0, `Standard deviation should be >= 0, got ${sd}`);
  });
});

// ---------------------------------------------------------------------------
// calculateTrend
// ---------------------------------------------------------------------------

describe('EnergyForecastingEngine — calculateTrend', () => {
  it('returns 0 for less than 2 values', () => {
    const { engine } = makeEngine();
    assertEqual(engine.calculateTrend([]), 0);
    assertEqual(engine.calculateTrend([10]), 0);
  });

  it('returns positive slope for increasing series', () => {
    const { engine } = makeEngine();
    const slope = engine.calculateTrend([10, 20, 30, 40, 50]);
    assert(slope > 0, `Expected positive slope, got ${slope}`);
  });

  it('returns negative slope for decreasing series', () => {
    const { engine } = makeEngine();
    const slope = engine.calculateTrend([50, 40, 30, 20, 10]);
    assert(slope < 0, `Expected negative slope, got ${slope}`);
  });

  it('returns 0 for flat series', () => {
    const { engine } = makeEngine();
    const slope = engine.calculateTrend([5, 5, 5, 5, 5]);
    assertEqual(slope, 0);
  });

  it('computes correct slope for [0, 2, 4, 6]', () => {
    const { engine } = makeEngine();
    const slope = engine.calculateTrend([0, 2, 4, 6]);
    assertEqual(slope, 2);
  });
});

// ---------------------------------------------------------------------------
// calculateConfidence
// ---------------------------------------------------------------------------

describe('EnergyForecastingEngine — calculateConfidence', () => {
  it('returns 0.3 for very small sample', () => {
    const { engine } = makeEngine();
    assertEqual(engine.calculateConfidence(5), 0.3);
  });

  it('returns 0.6 for moderate sample', () => {
    const { engine } = makeEngine();
    assertEqual(engine.calculateConfidence(25), 0.6);
  });

  it('returns 0.8 for large sample', () => {
    const { engine } = makeEngine();
    assertEqual(engine.calculateConfidence(75), 0.8);
  });

  it('returns 0.95 for very large sample', () => {
    const { engine } = makeEngine();
    assertEqual(engine.calculateConfidence(500), 0.95);
  });

  it('returns 0.3 for boundary value 9', () => {
    const { engine } = makeEngine();
    assertEqual(engine.calculateConfidence(9), 0.3);
  });

  it('returns 0.6 for boundary value 10', () => {
    const { engine } = makeEngine();
    assertEqual(engine.calculateConfidence(10), 0.6);
  });
});

// ---------------------------------------------------------------------------
// identifyUsagePattern
// ---------------------------------------------------------------------------

describe('EnergyForecastingEngine — identifyUsagePattern', () => {
  it('returns "constant" for low variance', () => {
    const { engine } = makeEngine();
    // Values very close to each other → CV < 0.1
    assertEqual(engine.identifyUsagePattern([100, 101, 99, 100, 102]), 'constant');
  });

  it('returns "periodic" for moderate variance', () => {
    const { engine } = makeEngine();
    // Moderate variation → 0.1 < CV < 0.5
    assertEqual(engine.identifyUsagePattern([50, 100, 50, 100, 50]), 'periodic');
  });

  it('returns "variable" for high variance', () => {
    const { engine } = makeEngine();
    // Wild variation → CV > 0.5
    assertEqual(engine.identifyUsagePattern([10, 500, 20, 800, 5]), 'variable');
  });
});

// ---------------------------------------------------------------------------
// getCurrentEnergyPrice
// ---------------------------------------------------------------------------

describe('EnergyForecastingEngine — getCurrentEnergyPrice', () => {
  it('returns default if no prices loaded', () => {
    const { engine } = makeEngine();
    const price = engine.getCurrentEnergyPrice();
    assertEqual(price.price, 1.5);
    assertEqual(price.level, 'normal');
  });

  it('finds matching price for current hour', () => {
    const now = new Date();
    const currentHour = now.getHours();
    const today = now.toISOString().split('T')[0];

    const { engine } = makeEngine({
      energyPrices: [
        { hour: currentHour, date: today, price: 2.5, level: 'high' },
        { hour: (currentHour + 1) % 24, date: today, price: 1.0, level: 'low' },
      ]
    });

    const price = engine.getCurrentEnergyPrice();
    assertEqual(price.price, 2.5);
    assertEqual(price.level, 'high');
  });
});

// ---------------------------------------------------------------------------
// getEnergyStatistics
// ---------------------------------------------------------------------------

describe('EnergyForecastingEngine — getEnergyStatistics', () => {
  it('returns error when no data', async () => {
    const { engine } = makeEngine();
    const stats = await engine.getEnergyStatistics('24h');
    assertEqual(stats.error, 'No data available');
  });

  it('computes statistics from historical data', async () => {
    const now = Date.now();
    const { engine } = makeEngine({
      historicalData: [
        { timestamp: now - 1000, totalConsumption: 100, cost: 10 },
        { timestamp: now - 2000, totalConsumption: 200, cost: 20 },
        { timestamp: now - 3000, totalConsumption: 300, cost: 30 },
      ]
    });

    const stats = await engine.getEnergyStatistics('24h');
    assertEqual(stats.period, '24h');
    assertEqual(stats.dataPoints, 3);
    assertEqual(stats.totalConsumption, 600);
    assertEqual(stats.avgConsumption, 200);
    assertEqual(stats.peakConsumption, 300);
    assertEqual(stats.minConsumption, 100);
    assertEqual(stats.totalCost, 60);
    assertType(stats.trend, 'number');
  });

  it('filters data by 24h window', async () => {
    const now = Date.now();
    const { engine } = makeEngine({
      historicalData: [
        { timestamp: now - 1000, totalConsumption: 100, cost: 10 },
        { timestamp: now - (25 * 3600000), totalConsumption: 999, cost: 99 }, // > 24h ago
      ]
    });

    const stats = await engine.getEnergyStatistics('24h');
    assertEqual(stats.dataPoints, 1);
    assertEqual(stats.totalConsumption, 100);
  });

  it('supports 7d and 30d periods', async () => {
    const now = Date.now();
    const { engine } = makeEngine({
      historicalData: [
        { timestamp: now - (2 * 86400000), totalConsumption: 100, cost: 5 }, // 2 days ago
        { timestamp: now - (10 * 86400000), totalConsumption: 200, cost: 10 }, // 10 days ago
      ]
    });

    const stats7d = await engine.getEnergyStatistics('7d');
    assertEqual(stats7d.dataPoints, 1);

    const stats30d = await engine.getEnergyStatistics('30d');
    assertEqual(stats30d.dataPoints, 2);
  });
});

// ---------------------------------------------------------------------------
// destroy (BaseSystem lifecycle)
// ---------------------------------------------------------------------------

describe('EnergyForecastingEngine — lifecycle', () => {
  it('can be destroyed without initialize', async () => {
    const { engine } = makeEngine();
    // BaseSystem.destroy() should not throw even if never initialized
    await engine.destroy();
    assertEqual(engine.isInitialized, false);
  });

  it('emits "destroyed" event on destroy', async () => {
    const { engine } = makeEngine();
    let emitted = false;
    engine.on('destroyed', () => { emitted = true; });
    await engine.destroy();
    assert(emitted, 'Expected "destroyed" event to be emitted');
  });
});

// ---------------------------------------------------------------------------
// Source code safety
// ---------------------------------------------------------------------------

describe('EnergyForecastingEngine — source code safety', () => {
  it('does not contain new Function(', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.resolve(__dirname, '../lib/EnergyForecastingEngine.js'),
      'utf8'
    );
    assert(!src.includes('new Function('), 'Must not use new Function()');
  });

  it('does not contain eval(', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.resolve(__dirname, '../lib/EnergyForecastingEngine.js'),
      'utf8'
    );
    assert(!src.includes('eval('), 'Must not use eval()');
  });
});

// Run
run();
