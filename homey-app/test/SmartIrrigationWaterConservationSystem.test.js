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

const SmartIrrigationWaterConservationSystem = require('../lib/SmartIrrigationWaterConservationSystem');

/* ================================================================== */
/*  SmartIrrigationWaterConservationSystem – test suite                */
/* ================================================================== */

describe('Irrigation — constructor & lifecycle', () => {
  it('instantiates without errors', () => {
    const sys = new SmartIrrigationWaterConservationSystem(createMockHomey());
    assert(sys, 'should create instance');
    cleanup(sys);
  });

  it('starts uninitialized with 8 zones', () => {
    const sys = new SmartIrrigationWaterConservationSystem(createMockHomey());
    assertEqual(sys.initialized, false);
    assertEqual(sys.zones.length, 8);
    cleanup(sys);
  });

  it('initialize sets initialized flag and starts intervals', async () => {
    const sys = new SmartIrrigationWaterConservationSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.initialized, true);
    assert(sys.intervals.length > 0, 'should have intervals');
    cleanup(sys);
  });

  it('destroy clears all intervals', async () => {
    const sys = new SmartIrrigationWaterConservationSystem(createMockHomey());
    await sys.initialize();
    sys.destroy();
    assertEqual(sys.intervals.length, 0);
    cleanup(sys);
  });
});

describe('Irrigation — zone management', () => {
  it('getZoneStatus returns zone details', async () => {
    const sys = new SmartIrrigationWaterConservationSystem(createMockHomey());
    await sys.initialize();
    const zone = sys.getZoneStatus('lawn');
    assert(zone, 'should return zone');
    assertEqual(zone.id, 'lawn');
    assertEqual(zone.type, 'lawn');
    assertType(zone.moistureLevel, 'number');
    assertType(zone.moistureThreshold, 'number');
    cleanup(sys);
  });

  it('getZoneStatus returns null for unknown zone', async () => {
    const sys = new SmartIrrigationWaterConservationSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.getZoneStatus('nonexistent'), null);
    cleanup(sys);
  });

  it('getAllZoneStatuses returns all 8 zones', async () => {
    const sys = new SmartIrrigationWaterConservationSystem(createMockHomey());
    await sys.initialize();
    const statuses = sys.getAllZoneStatuses();
    assertEqual(Object.keys(statuses).length, 8);
    cleanup(sys);
  });

  it('setZoneEnabled toggles zone', async () => {
    const sys = new SmartIrrigationWaterConservationSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.setZoneEnabled('lawn', false), true);
    const zone = sys.getZoneStatus('lawn');
    assertEqual(zone.enabled, false);
    assertEqual(sys.setZoneEnabled('lawn', true), true);
    cleanup(sys);
  });

  it('setZoneEnabled returns false for unknown zone', async () => {
    const sys = new SmartIrrigationWaterConservationSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.setZoneEnabled('nope', true), false);
    cleanup(sys);
  });
});

describe('Irrigation — manual watering', () => {
  it('manualWaterZone starts watering on valid zone', async () => {
    const sys = new SmartIrrigationWaterConservationSystem(createMockHomey());
    await sys.initialize();
    const result = sys.manualWaterZone('lawn', 10);
    assertEqual(result.success, true);
    assertEqual(result.zoneId, 'lawn');
    assertEqual(result.duration, 10);
    assertType(result.estimatedLiters, 'number');
    assert(result.estimatedLiters > 0, 'should have estimated liters');
    cleanup(sys);
  });

  it('manualWaterZone fails for unknown zone', async () => {
    const sys = new SmartIrrigationWaterConservationSystem(createMockHomey());
    await sys.initialize();
    const result = sys.manualWaterZone('nope', 5);
    assertEqual(result.success, false);
    cleanup(sys);
  });

  it('manualWaterZone fails for disabled zone', async () => {
    const sys = new SmartIrrigationWaterConservationSystem(createMockHomey());
    await sys.initialize();
    sys.setZoneEnabled('lawn', false);
    const result = sys.manualWaterZone('lawn', 5);
    assertEqual(result.success, false);
    cleanup(sys);
  });
});

describe('Irrigation — moisture & optimization', () => {
  it('getMoistureReadings returns all zone readings', async () => {
    const sys = new SmartIrrigationWaterConservationSystem(createMockHomey());
    await sys.initialize();
    const readings = sys.getMoistureReadings();
    assert(readings, 'should return readings');
    assertEqual(Object.keys(readings).length, 8);
    assert(readings.lawn, 'should have lawn zone');
    assertType(readings.lawn.level, 'number');
    cleanup(sys);
  });

  it('optimizeZoneWatering returns recommendation', async () => {
    const sys = new SmartIrrigationWaterConservationSystem(createMockHomey());
    await sys.initialize();
    const rec = sys.optimizeZoneWatering('lawn');
    assert(rec, 'should return recommendation');
    assertEqual(rec.zoneId, 'lawn');
    assertType(rec.currentMoisture, 'number');
    assertType(rec.optimalDurationMinutes, 'number');
    assert(rec.recommendation, 'should have text recommendation');
    cleanup(sys);
  });

  it('optimizeZoneWatering returns null for unknown zone', async () => {
    const sys = new SmartIrrigationWaterConservationSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.optimizeZoneWatering('nope'), null);
    cleanup(sys);
  });

  it('optimizeAllZones returns recommendations for all enabled zones', async () => {
    const sys = new SmartIrrigationWaterConservationSystem(createMockHomey());
    await sys.initialize();
    const recs = sys.optimizeAllZones();
    assert(Object.keys(recs).length > 0, 'should have recommendations');
    cleanup(sys);
  });
});

describe('Irrigation — water sources & restrictions', () => {
  it('getWaterSourceLevels returns source levels', async () => {
    const sys = new SmartIrrigationWaterConservationSystem(createMockHomey());
    await sys.initialize();
    const levels = sys.getWaterSourceLevels();
    assert(levels, 'should return levels');
    assert(levels.rainBarrel || levels.cistern, 'should have at least one source');
    cleanup(sys);
  });

  it('setWaterRestrictionLevel sets valid levels', async () => {
    const sys = new SmartIrrigationWaterConservationSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.setWaterRestrictionLevel('advisory'), true);
    const status = sys.getWaterRestrictionStatus();
    assertEqual(status.currentLevel, 'advisory');
    assertEqual(sys.setWaterRestrictionLevel('invalid'), false);
    cleanup(sys);
  });

  it('getGreyWaterStatus returns status', async () => {
    const sys = new SmartIrrigationWaterConservationSystem(createMockHomey());
    await sys.initialize();
    const status = sys.getGreyWaterStatus();
    assert(status, 'should return status');
    assertType(status.filterLifePercent, 'number');
    cleanup(sys);
  });
});

describe('Irrigation — plant database & weather', () => {
  it('getPlantsByCategory returns plants', async () => {
    const sys = new SmartIrrigationWaterConservationSystem(createMockHomey());
    await sys.initialize();
    const plants = sys.getPlantsByCategory('ornamental');
    assert(Array.isArray(plants), 'should be array');
    cleanup(sys);
  });

  it('getPlantWateringGuide returns guide object keyed by zone', async () => {
    const sys = new SmartIrrigationWaterConservationSystem(createMockHomey());
    await sys.initialize();
    const guide = sys.getPlantWateringGuide();
    assertType(guide, 'object');
    assert(Object.keys(guide).length > 0, 'should have zone entries');
    cleanup(sys);
  });

  it('getWeatherConditions returns current conditions', async () => {
    const sys = new SmartIrrigationWaterConservationSystem(createMockHomey());
    await sys.initialize();
    const weather = sys.getWeatherConditions();
    assert(weather, 'should return weather');
    assert(weather.modifiers, 'should have weather modifiers');
    cleanup(sys);
  });

  it('getCurrentSeasonalProfile returns current profile', async () => {
    const sys = new SmartIrrigationWaterConservationSystem(createMockHomey());
    await sys.initialize();
    const profile = sys.getCurrentSeasonalProfile();
    assert(profile, 'should return profile');
    assert(profile.season, 'should have season');
    cleanup(sys);
  });
});

describe('Irrigation — health & monitoring', () => {
  it('getSprinklerHealthReport returns health data', async () => {
    const sys = new SmartIrrigationWaterConservationSystem(createMockHomey());
    await sys.initialize();
    const report = sys.getSprinklerHealthReport();
    assert(report, 'should return report');
    assertType(report.total, 'number');
    assertType(report.active, 'number');
    assert(Array.isArray(report.heads), 'should have heads array');
    cleanup(sys);
  });

  it('getLeakDetectionStatus returns status', async () => {
    const sys = new SmartIrrigationWaterConservationSystem(createMockHomey());
    await sys.initialize();
    const status = sys.getLeakDetectionStatus();
    assert(status, 'should return status');
    assertType(status.totalLeaksDetected, 'number');
    cleanup(sys);
  });

  it('getWaterPressureStatus returns pressure data', async () => {
    const sys = new SmartIrrigationWaterConservationSystem(createMockHomey());
    await sys.initialize();
    const status = sys.getWaterPressureStatus();
    assert(status, 'should return status');
    assertType(status.current, 'number');
    cleanup(sys);
  });

  it('getFrostProtectionStatus returns frost status', async () => {
    const sys = new SmartIrrigationWaterConservationSystem(createMockHomey());
    await sys.initialize();
    const status = sys.getFrostProtectionStatus();
    assert(status, 'should return status');
    assertType(status.pipesDrained, 'boolean');
    cleanup(sys);
  });

  it('getDripEfficiencyReport returns efficiency data', async () => {
    const sys = new SmartIrrigationWaterConservationSystem(createMockHomey());
    await sys.initialize();
    const report = sys.getDripEfficiencyReport();
    assert(report, 'should return report');
    assert(report.zones, 'should have zones');
    cleanup(sys);
  });
});

describe('Irrigation — reports & statistics', () => {
  it('getWaterConsumptionReport returns consumption data', async () => {
    const sys = new SmartIrrigationWaterConservationSystem(createMockHomey());
    await sys.initialize();
    const report = sys.getWaterConsumptionReport();
    assert(report, 'should return report');
    assert(report.today, 'should have today section');
    assertType(report.today.liters, 'number');
    assertEqual(report.currency, 'SEK');
    cleanup(sys);
  });

  it('getSystemDashboard returns dashboard data', async () => {
    const sys = new SmartIrrigationWaterConservationSystem(createMockHomey());
    await sys.initialize();
    const dash = sys.getSystemDashboard();
    assert(dash, 'should return dashboard');
    assert(dash.system, 'should have system section');
    assert(dash.water, 'should have water section');
    assert(dash.sources, 'should have sources section');
    assert(dash.weather, 'should have weather section');
    assert(dash.alerts, 'should have alerts section');
    cleanup(sys);
  });

  it('getStatistics returns comprehensive stats', async () => {
    const sys = new SmartIrrigationWaterConservationSystem(createMockHomey());
    await sys.initialize();
    const stats = sys.getStatistics();
    assertEqual(stats.initialized, true);
    assertEqual(stats.totalZones, 8);
    assertType(stats.currentSeason, 'string');
    assertType(stats.waterPressure, 'number');
    assertType(stats.restrictionLevel, 'string');
    cleanup(sys);
  });

  it('getWateringLog returns log entries', async () => {
    const sys = new SmartIrrigationWaterConservationSystem(createMockHomey());
    await sys.initialize();
    const log = sys.getWateringLog();
    assert(Array.isArray(log), 'should return array');
    cleanup(sys);
  });
});

run();
