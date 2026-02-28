'use strict';

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertType, assertRejects } = require('./helpers/assert');

/* ── timer-leak prevention ─────────────────────────────────────────── */
const _origSetTimeout = global.setTimeout;
const _origSetInterval = global.setInterval;
const activeHandles = [];
global.setTimeout = (...a) => { const id = _origSetTimeout(...a); activeHandles.push({ type: 'timeout', id }); return id; };
global.setInterval = (...a) => { const id = _origSetInterval(...a); activeHandles.push({ type: 'interval', id }); return id; };
function cleanup(sys) {
  try {
    if (sys && sys.monitoring && sys.monitoring.interval) {
      clearInterval(sys.monitoring.interval);
      sys.monitoring.interval = null;
    }
  } catch (_) {}
  while (activeHandles.length > 0) {
    const h = activeHandles.pop();
    if (h.type === 'timeout') clearTimeout(h.id); else clearInterval(h.id);
  }
}

const AdvancedAirQualityVentilationControlSystem = require('../lib/AdvancedAirQualityVentilationControlSystem');

/* ================================================================== */
/*  AdvancedAirQualityVentilationControlSystem – test suite            */
/* ================================================================== */

describe('AirQualityVentilation — constructor & init', () => {
  it('instantiates without errors', () => {
    const sys = new AdvancedAirQualityVentilationControlSystem();
    assert(sys, 'should create instance');
    cleanup(sys);
  });

  it('constructor populates default sensors', () => {
    const sys = new AdvancedAirQualityVentilationControlSystem();
    assert(sys.airQualitySensors.size > 0, 'should have sensors');
    assert(sys.ventilationUnits.size > 0, 'should have ventilation units');
    assert(sys.airPurifiers.size > 0, 'should have air purifiers');
    cleanup(sys);
  });

  it('constructor sets default settings', () => {
    const sys = new AdvancedAirQualityVentilationControlSystem();
    assertEqual(sys.settings.autoVentilationEnabled, true);
    assertEqual(sys.settings.co2Threshold, 1000);
    assertEqual(sys.settings.pm25Threshold, 35);
    assertEqual(sys.settings.vocThreshold, 500);
    cleanup(sys);
  });

  it('constructor sets default air quality values', () => {
    const sys = new AdvancedAirQualityVentilationControlSystem();
    assertEqual(sys.currentAirQuality.overallRating, 'good');
    assertType(sys.currentAirQuality.co2, 'number');
    assertType(sys.currentAirQuality.pm25, 'number');
    cleanup(sys);
  });

  it('initialize returns success with sensor count', async () => {
    const sys = new AdvancedAirQualityVentilationControlSystem();
    const result = await sys.initialize();
    assertEqual(result.success, true);
    assert(result.sensors > 0, 'should report sensor count');
    cleanup(sys);
  });
});

describe('AirQualityVentilation — ventilation control', () => {
  it('optimizeVentilation returns success with speed', async () => {
    const sys = new AdvancedAirQualityVentilationControlSystem();
    const result = await sys.optimizeVentilation();
    assertEqual(result.success, true);
    assertType(result.speed, 'number');
    assertType(result.airflow, 'number');
    cleanup(sys);
  });

  it('optimizeVentilation throws when auto-ventilation disabled', async () => {
    const sys = new AdvancedAirQualityVentilationControlSystem();
    sys.settings.autoVentilationEnabled = false;
    await assertRejects(() => sys.optimizeVentilation(), 'disabled');
    cleanup(sys);
  });

  it('setVentilationSpeed sets speed on unit', async () => {
    const sys = new AdvancedAirQualityVentilationControlSystem();
    const result = await sys.setVentilationSpeed('unit-001', 75);
    assertEqual(result.success, true);
    assertEqual(result.speed, 75);
    cleanup(sys);
  });

  it('setVentilationSpeed clamps to 0-100', async () => {
    const sys = new AdvancedAirQualityVentilationControlSystem();
    const result = await sys.setVentilationSpeed('unit-001', 150);
    assertEqual(result.speed, 100);
    cleanup(sys);
  });

  it('setVentilationSpeed throws for unknown unit', async () => {
    const sys = new AdvancedAirQualityVentilationControlSystem();
    await assertRejects(() => sys.setVentilationSpeed('nonexistent', 50), 'not found');
    cleanup(sys);
  });
});

describe('AirQualityVentilation — air purifier', () => {
  it('setAirPurifierMode sets valid mode', async () => {
    const sys = new AdvancedAirQualityVentilationControlSystem();
    const result = await sys.setAirPurifierMode('purifier-001', 'turbo');
    assertEqual(result.success, true);
    assertEqual(result.mode, 'turbo');
    cleanup(sys);
  });

  it('setAirPurifierMode rejects invalid mode', async () => {
    const sys = new AdvancedAirQualityVentilationControlSystem();
    await assertRejects(() => sys.setAirPurifierMode('purifier-001', 'invalid'), 'Invalid mode');
    cleanup(sys);
  });

  it('setAirPurifierMode throws for unknown purifier', async () => {
    const sys = new AdvancedAirQualityVentilationControlSystem();
    await assertRejects(() => sys.setAirPurifierMode('nonexistent', 'auto'), 'not found');
    cleanup(sys);
  });

  it('setAirPurifierMode sleep sets low power', async () => {
    const sys = new AdvancedAirQualityVentilationControlSystem();
    await sys.setAirPurifierMode('purifier-001', 'sleep');
    const purifier = sys.airPurifiers.get('purifier-001');
    assertEqual(purifier.speed, 1);
    assertEqual(purifier.powerConsumption, 10);
    cleanup(sys);
  });
});

describe('AirQualityVentilation — AQI calculation', () => {
  it('calculateAirQualityIndex returns index and rating', () => {
    const sys = new AdvancedAirQualityVentilationControlSystem();
    const result = sys.calculateAirQualityIndex();
    assertType(result.index, 'number');
    assertType(result.rating, 'string');
    assertType(result.recommendation, 'string');
    assert(result.index >= 0 && result.index <= 100, 'index should be 0-100');
    cleanup(sys);
  });

  it('calculateAirQualityIndex returns unknown when no sensors', () => {
    const sys = new AdvancedAirQualityVentilationControlSystem();
    sys.airQualitySensors.clear();
    const result = sys.calculateAirQualityIndex();
    assertEqual(result.index, 0);
    assertEqual(result.rating, 'unknown');
    cleanup(sys);
  });

  it('calculateAirQualityIndex updates currentAirQuality', () => {
    const sys = new AdvancedAirQualityVentilationControlSystem();
    sys.calculateAirQualityIndex();
    assertType(sys.currentAirQuality.index, 'number');
    assertType(sys.currentAirQuality.overallRating, 'string');
    cleanup(sys);
  });
});

describe('AirQualityVentilation — statistics & getters', () => {
  it('getAirQualityStatistics returns comprehensive stats', () => {
    const sys = new AdvancedAirQualityVentilationControlSystem();
    const stats = sys.getAirQualityStatistics();
    assert(stats.current, 'should have current data');
    assert(stats.sensors, 'should have sensor stats');
    assert(stats.ventilation, 'should have ventilation stats');
    assert(stats.purifiers, 'should have purifier stats');
    assert(stats.thresholds, 'should have thresholds');
    assertType(stats.current.airQualityIndex, 'number');
    cleanup(sys);
  });

  it('getAirQualitySensors returns sensor array', () => {
    const sys = new AdvancedAirQualityVentilationControlSystem();
    const sensors = sys.getAirQualitySensors();
    assert(Array.isArray(sensors), 'should be array');
    assert(sensors.length > 0, 'should have sensors');
    cleanup(sys);
  });

  it('getVentilationUnits returns unit array', () => {
    const sys = new AdvancedAirQualityVentilationControlSystem();
    const units = sys.getVentilationUnits();
    assert(Array.isArray(units), 'should be array');
    assert(units.length > 0, 'should have units');
    cleanup(sys);
  });

  it('getAirPurifiers returns purifier array', () => {
    const sys = new AdvancedAirQualityVentilationControlSystem();
    const purifiers = sys.getAirPurifiers();
    assert(Array.isArray(purifiers), 'should be array');
    assert(purifiers.length > 0, 'should have purifiers');
    cleanup(sys);
  });

  it('getAirQualityHistory returns history', () => {
    const sys = new AdvancedAirQualityVentilationControlSystem();
    const history = sys.getAirQualityHistory();
    assert(Array.isArray(history), 'should be array');
    cleanup(sys);
  });

  it('getCurrentAirQuality returns current readings', () => {
    const sys = new AdvancedAirQualityVentilationControlSystem();
    const current = sys.getCurrentAirQuality();
    assertType(current.co2, 'number');
    assertType(current.pm25, 'number');
    assertType(current.temperature, 'number');
    cleanup(sys);
  });
});

describe('AirQualityVentilation — cache & monitoring', () => {
  it('setCached and getCached work correctly', () => {
    const sys = new AdvancedAirQualityVentilationControlSystem();
    sys.setCached('test-key', { value: 42 });
    const cached = sys.getCached('test-key');
    assertEqual(cached.value, 42);
    cleanup(sys);
  });

  it('getCached returns null for missing key', () => {
    const sys = new AdvancedAirQualityVentilationControlSystem();
    assertEqual(sys.getCached('nonexistent'), null);
    cleanup(sys);
  });

  it('clearCache empties all cached data', () => {
    const sys = new AdvancedAirQualityVentilationControlSystem();
    sys.setCached('k1', 'v1');
    sys.clearCache();
    assertEqual(sys.getCached('k1'), null);
    cleanup(sys);
  });

  it('monitorAirQuality updates sensor readings and history', () => {
    const sys = new AdvancedAirQualityVentilationControlSystem();
    const historyBefore = sys.airQualityHistory.length;
    sys.monitorAirQuality();
    assert(sys.airQualityHistory.length > historyBefore, 'should add history entry');
    assert(sys.monitoring.lastCheck !== null, 'should set lastCheck');
    cleanup(sys);
  });

  it('startMonitoring creates interval', () => {
    const sys = new AdvancedAirQualityVentilationControlSystem();
    sys.startMonitoring();
    assert(sys.monitoring.interval !== null, 'should have interval');
    cleanup(sys);
  });
});

run();
