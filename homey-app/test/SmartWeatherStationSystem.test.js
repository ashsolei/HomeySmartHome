'use strict';

/**
 * Unit tests for SmartWeatherStationSystem.
 *
 * Covers season detection, condition classification, status reporting,
 * sensor health checks, weather data aggregation, and clean destroy.
 *
 * SmartWeatherStationSystem extends EventEmitter (NOT BaseSystem), so
 * constructor creates all state — test methods directly on fresh instances
 * without calling initialize().
 */

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertType } = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');
const SmartWeatherStationSystem = require('../lib/SmartWeatherStationSystem');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWeather() {
  const homey = createMockHomey();
  const system = new SmartWeatherStationSystem(homey);

  // Prevent initialize() timer creation
  // Do NOT call initialize() — we test methods on the raw instance.

  return { system, homey };
}

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

describe('SmartWeatherStationSystem — constructor', () => {
  it('stores the homey reference', () => {
    const { system, homey } = makeWeather();
    assertEqual(system.homey, homey);
  });

  it('is not initialized by default', () => {
    const { system } = makeWeather();
    assertEqual(system.initialized, false);
  });

  it('has interval and timeout arrays', () => {
    const { system } = makeWeather();
    assert(Array.isArray(system.intervals));
    assert(Array.isArray(system.timeouts));
  });

  it('creates station objects', () => {
    const { system } = makeWeather();
    assertType(system.stations, 'object');
  });
});

// ---------------------------------------------------------------------------
// _getSeason
// ---------------------------------------------------------------------------

describe('SmartWeatherStationSystem — _getSeason', () => {
  it('returns "spring" for March (2)', () => {
    const { system } = makeWeather();
    assertEqual(system._getSeason(2), 'spring');
  });

  it('returns "spring" for April (3)', () => {
    const { system } = makeWeather();
    assertEqual(system._getSeason(3), 'spring');
  });

  it('returns "spring" for May (4)', () => {
    const { system } = makeWeather();
    assertEqual(system._getSeason(4), 'spring');
  });

  it('returns "summer" for June (5)', () => {
    const { system } = makeWeather();
    assertEqual(system._getSeason(5), 'summer');
  });

  it('returns "summer" for July (6)', () => {
    const { system } = makeWeather();
    assertEqual(system._getSeason(6), 'summer');
  });

  it('returns "summer" for August (7)', () => {
    const { system } = makeWeather();
    assertEqual(system._getSeason(7), 'summer');
  });

  it('returns "autumn" for September (8)', () => {
    const { system } = makeWeather();
    assertEqual(system._getSeason(8), 'autumn');
  });

  it('returns "autumn" for October (9)', () => {
    const { system } = makeWeather();
    assertEqual(system._getSeason(9), 'autumn');
  });

  it('returns "autumn" for November (10)', () => {
    const { system } = makeWeather();
    assertEqual(system._getSeason(10), 'autumn');
  });

  it('returns "winter" for December (11)', () => {
    const { system } = makeWeather();
    assertEqual(system._getSeason(11), 'winter');
  });

  it('returns "winter" for January (0)', () => {
    const { system } = makeWeather();
    assertEqual(system._getSeason(0), 'winter');
  });

  it('returns "winter" for February (1)', () => {
    const { system } = makeWeather();
    assertEqual(system._getSeason(1), 'winter');
  });
});

// ---------------------------------------------------------------------------
// _determineCondition
// ---------------------------------------------------------------------------

describe('SmartWeatherStationSystem — _determineCondition', () => {
  it('returns "storm" for very high wind', () => {
    const { system } = makeWeather();
    const cond = system._determineCondition(0, 20, 15);
    assertEqual(cond, 'storm');
  });

  it('returns "heavy-rain" for high precipitation and warm temp', () => {
    const { system } = makeWeather();
    const cond = system._determineCondition(15, 5, 10);
    assertEqual(cond, 'heavy-rain');
  });

  it('returns "heavy-snow" for high precipitation and freezing temp', () => {
    const { system } = makeWeather();
    const cond = system._determineCondition(15, 5, -5);
    assertEqual(cond, 'heavy-snow');
  });

  it('returns "rain" for moderate precipitation and warm temp', () => {
    const { system } = makeWeather();
    const cond = system._determineCondition(5, 5, 10);
    assertEqual(cond, 'rain');
  });

  it('returns "snow" for moderate precipitation and cold temp', () => {
    const { system } = makeWeather();
    const cond = system._determineCondition(5, 5, -2);
    assertEqual(cond, 'snow');
  });

  it('returns "drizzle" for light precipitation and warm temp', () => {
    const { system } = makeWeather();
    const cond = system._determineCondition(0.5, 3, 15);
    assertEqual(cond, 'drizzle');
  });

  it('returns "light-snow" for light precipitation and cold temp', () => {
    const { system } = makeWeather();
    const cond = system._determineCondition(0.5, 3, -3);
    assertEqual(cond, 'light-snow');
  });

  it('returns "windy" for moderate wind and no precipitation', () => {
    const { system } = makeWeather();
    const cond = system._determineCondition(0, 10, 20);
    assertEqual(cond, 'windy');
  });

  it('returns "clear" for calm weather', () => {
    const { system } = makeWeather();
    const cond = system._determineCondition(0, 2, 22);
    assertEqual(cond, 'clear');
  });
});

// ---------------------------------------------------------------------------
// getStatus
// ---------------------------------------------------------------------------

describe('SmartWeatherStationSystem — getStatus', () => {
  it('returns an object with initialized field', () => {
    const { system } = makeWeather();
    const status = system.getStatus();
    assertType(status, 'object');
    assertEqual(status.initialized, false);
  });

  it('contains station count info', () => {
    const { system } = makeWeather();
    const status = system.getStatus();
    assertType(status.stationsTotal, 'number');
    assert(status.stationsTotal >= 0);
  });

  it('reports active alerts count', () => {
    const { system } = makeWeather();
    const status = system.getStatus();
    assertType(status.activeAlerts, 'number');
    assertEqual(status.activeAlerts, 0);
  });
});

// ---------------------------------------------------------------------------
// getWeatherData
// ---------------------------------------------------------------------------

describe('SmartWeatherStationSystem — getWeatherData', () => {
  it('returns an object with expected sections', () => {
    const { system } = makeWeather();
    const data = system.getWeatherData();
    assertType(data, 'object');
    // Should contain at minimum some weather-related fields
    assert(
      data.stations !== undefined ||
      data.readings !== undefined ||
      data.current !== undefined ||
      data.temperature !== undefined,
      'getWeatherData should return weather-related fields'
    );
  });
});

// ---------------------------------------------------------------------------
// getSensorHealth
// ---------------------------------------------------------------------------

describe('SmartWeatherStationSystem — getSensorHealth', () => {
  it('returns an object', () => {
    const { system } = makeWeather();
    const health = system.getSensorHealth();
    assertType(health, 'object');
  });

  it('reports overall status', () => {
    const { system } = makeWeather();
    const health = system.getSensorHealth();
    // Source uses property name 'overallHealth'
    assertType(health.overallHealth, 'string');
  });

  it('contains per-station information', () => {
    const { system } = makeWeather();
    const health = system.getSensorHealth();
    assert(
      health.stations !== undefined || health.sensors !== undefined,
      'getSensorHealth should have station/sensor data'
    );
  });
});

// ---------------------------------------------------------------------------
// destroy
// ---------------------------------------------------------------------------

describe('SmartWeatherStationSystem — destroy', () => {
  it('clears all intervals', () => {
    const { system } = makeWeather();
    // Simulate some intervals
    system.intervals.push(setInterval(() => {}, 999999));
    system.intervals.push(setInterval(() => {}, 999999));
    assertEqual(system.intervals.length, 2);

    system.destroy();

    // After destroy, intervals should be cleared
    assertEqual(system.intervals.length, 0);
  });

  it('clears all timeouts', () => {
    const { system } = makeWeather();
    system.timeouts.push(setTimeout(() => {}, 999999));
    system.destroy();
    assertEqual(system.timeouts.length, 0);
  });

  it('sets initialized to false', () => {
    const { system } = makeWeather();
    system.initialized = true;
    system.destroy();
    assertEqual(system.initialized, false);
  });

  it('can be called multiple times without error', () => {
    const { system } = makeWeather();
    system.destroy();
    system.destroy();
    assertEqual(system.initialized, false);
  });

  it('clears active alerts', () => {
    const { system } = makeWeather();
    system.activeAlerts = [{ id: 'test', type: 'wind' }];
    system.destroy();
    assertEqual(system.activeAlerts.length, 0);
  });
});

// ---------------------------------------------------------------------------
// Source safety
// ---------------------------------------------------------------------------

describe('SmartWeatherStationSystem — source code safety', () => {
  it('does not contain eval(', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.resolve(__dirname, '../lib/SmartWeatherStationSystem.js'),
      'utf8'
    );
    assert(!src.includes('eval('), 'Must not use eval()');
  });
});

// Run
run();
