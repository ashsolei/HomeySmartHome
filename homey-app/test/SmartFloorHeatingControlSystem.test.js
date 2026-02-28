'use strict';

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertThrows, assertType } = require('./helpers/assert');
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

const SmartFloorHeatingControlSystem = require('../lib/SmartFloorHeatingControlSystem');

/* ================================================================== */
/*  SmartFloorHeatingControlSystem – test suite                       */
/* ================================================================== */

describe('SmartFloorHeatingControlSystem — constructor & defaults', () => {
  it('instantiates without errors', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    assert(sys, 'should create instance');
    cleanup(sys);
  });

  it('has 8 default Swedish zones', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    const zones = Object.keys(sys.zones);
    assertEqual(zones.length, 8);
    assert(zones.includes('vardagsrum'), 'vardagsrum zone');
    assert(zones.includes('sovrum-master'), 'sovrum-master zone');
    assert(zones.includes('badrum'), 'badrum zone');
    assert(zones.includes('kok'), 'kok zone');
    assert(zones.includes('hall'), 'hall zone');
    assert(zones.includes('tvattrum'), 'tvattrum zone');
    cleanup(sys);
  });

  it('each zone has required properties', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    const zone = sys.zones['vardagsrum'];
    assertType(zone.name, 'string');
    assertType(zone.type, 'string');
    assertType(zone.floorMaterial, 'string');
    assertType(zone.targetTemp, 'number');
    assertType(zone.currentTemp, 'number');
    assertType(zone.heatingActive, 'boolean');
    cleanup(sys);
  });

  it('sets default PID params', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    assert(sys.config.pidParams.kp > 0, 'kp should be positive');
    assert(sys.config.pidParams.ki > 0, 'ki should be positive');
    assert(sys.config.pidParams.kd >= 0, 'kd should be non-negative');
    cleanup(sys);
  });

  it('initialises PID state for each zone', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    for (const zoneId of Object.keys(sys.zones)) {
      assert(sys.pidState[zoneId], `PID state for ${zoneId}`);
      assertEqual(sys.pidState[zoneId].integral, 0);
    }
    cleanup(sys);
  });

  it('has floor material limits', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    assert(sys.floorLimits.wood, 'wood limits');
    assert(sys.floorLimits.tile, 'tile limits');
    assert(sys.floorLimits.stone, 'stone limits');
    assert(sys.floorLimits.vinyl, 'vinyl limits');
    cleanup(sys);
  });
});

describe('SmartFloorHeatingControlSystem — initialize & destroy', () => {
  it('initialize sets initialized flag and starts intervals', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    sys.initialize();
    assert(sys.initialized === true, 'should be initialized');
    cleanup(sys);
  });

  it('destroy clears intervals', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    sys.initialize();
    sys.destroy();
    // Should not throw on double destroy
    sys.destroy();
    cleanup(sys);
  });
});

describe('SmartFloorHeatingControlSystem — zone management', () => {
  it('addZone creates a new zone with correct properties', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    const result = sys.addZone('garage', 'Garage', 'electric', 'tile', { targetTemp: 15, area: 20 });
    assert(sys.zones['garage'], 'zone should exist');
    assertEqual(sys.zones['garage'].name, 'Garage');
    assertEqual(sys.zones['garage'].type, 'electric');
    assertEqual(sys.zones['garage'].floorMaterial, 'tile');
    assert(result, 'should return zone status');
    cleanup(sys);
  });

  it('addZone rejects invalid floor material', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    assertThrows(() => sys.addZone('x', 'X', 'electric', 'marble'), 'floor material');
    cleanup(sys);
  });

  it('addZone rejects invalid type', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    assertThrows(() => sys.addZone('x', 'X', 'gas', 'tile'), 'type');
    cleanup(sys);
  });

  it('addZone emits zone-added event', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    let emitted = false;
    sys.on('zone-added', () => { emitted = true; });
    sys.addZone('new-zone', 'New Zone', 'water', 'stone');
    assert(emitted, 'should emit zone-added');
    cleanup(sys);
  });

  it('removeZone deletes zone and emits event', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    let emitted = false;
    sys.on('zone-removed', () => { emitted = true; });
    sys.removeZone('hall');
    assert(!sys.zones['hall'], 'hall should be removed');
    assert(emitted, 'should emit zone-removed');
    cleanup(sys);
  });

  it('removeZone throws for unknown zone', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    assertThrows(() => sys.removeZone('nonexistent'), 'not found');
    cleanup(sys);
  });

  it('setZoneEnabled disables and re-enables a zone', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    sys.setZoneEnabled('vardagsrum', false);
    assertEqual(sys.zones['vardagsrum'].enabled, false);
    sys.setZoneEnabled('vardagsrum', true);
    assertEqual(sys.zones['vardagsrum'].enabled, true);
    cleanup(sys);
  });

  it('setZoneEnabled throws for unknown zone', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    assertThrows(() => sys.setZoneEnabled('nope', true), 'not found');
    cleanup(sys);
  });
});

describe('SmartFloorHeatingControlSystem — temperature control', () => {
  it('setZoneTemp updates target temperature', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    sys.setZoneTemp('vardagsrum', 23);
    assertEqual(sys.zones['vardagsrum'].targetTemp, 23);
    cleanup(sys);
  });

  it('setZoneTemp validates range', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    assertThrows(() => sys.setZoneTemp('vardagsrum', 50), 'temperature');
    cleanup(sys);
  });

  it('setZoneTemp throws for unknown zone', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    assertThrows(() => sys.setZoneTemp('nope', 20), 'not found');
    cleanup(sys);
  });

  it('setMode sets comfort/eco/frost', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    sys.setMode('vardagsrum', 'eco');
    assertEqual(sys.zones['vardagsrum'].mode, 'eco');
    sys.setMode('vardagsrum', 'frost');
    assertEqual(sys.zones['vardagsrum'].mode, 'frost');
    sys.setMode('vardagsrum', 'comfort');
    assertEqual(sys.zones['vardagsrum'].mode, 'comfort');
    cleanup(sys);
  });

  it('setAllZonesMode applies to every zone', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    sys.setAllZonesMode('eco');
    for (const z of Object.values(sys.zones)) {
      assertEqual(z.mode, 'eco');
    }
    cleanup(sys);
  });
});

describe('SmartFloorHeatingControlSystem — holiday mode', () => {
  it('setHolidayMode enables/disables holiday', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    sys.setHolidayMode(true);
    assertEqual(sys.config.holidayMode, true);
    sys.setHolidayMode(false);
    assertEqual(sys.config.holidayMode, false);
    cleanup(sys);
  });
});

describe('SmartFloorHeatingControlSystem — sensor readings', () => {
  it('updateSensorReadings updates zone temps', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    sys.updateSensorReadings('vardagsrum', { floorTemp: 25, airTemp: 22, humidity: 45 });
    assertEqual(sys.zones['vardagsrum'].floorTemp, 25);
    assertEqual(sys.zones['vardagsrum'].airTemp, 22);
    assertEqual(sys.zones['vardagsrum'].currentTemp, 22);
    assertEqual(sys.zones['vardagsrum'].humidity, 45);
    cleanup(sys);
  });

  it('updateSensorReadings emits sensor-updated event', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    let emitted = false;
    sys.on('sensor-updated', () => { emitted = true; });
    sys.updateSensorReadings('vardagsrum', { airTemp: 20 });
    assert(emitted, 'should emit sensor-updated');
    cleanup(sys);
  });

  it('updateSensorReadings ignores unknown zone', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    // Should not throw
    sys.updateSensorReadings('nonexistent', { airTemp: 20 });
    cleanup(sys);
  });

  it('calibrateSensor adjusts temperatures', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    const before = sys.zones['vardagsrum'].currentTemp;
    sys.calibrateSensor('vardagsrum', 1.5);
    assertEqual(sys.zones['vardagsrum'].currentTemp, before + 1.5);
    cleanup(sys);
  });

  it('calibrateSensor throws for unknown zone', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    assertThrows(() => sys.calibrateSensor('nope', 1), 'not found');
    cleanup(sys);
  });
});

describe('SmartFloorHeatingControlSystem — scheduling', () => {
  it('getSchedule returns zone schedule', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    const sched = sys.getSchedule('vardagsrum');
    assert(sched, 'should return schedule');
    assert(sched.periods, 'should have periods');
    assert(sched.periods.monday, 'should have monday');
    cleanup(sys);
  });

  it('setSchedule overrides periods for a day', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    const newPeriods = [
      { start: '08:00', end: '20:00', mode: 'comfort' },
      { start: '20:00', end: '08:00', mode: 'eco' }
    ];
    sys.setSchedule('vardagsrum', 'monday', newPeriods);
    const sched = sys.getSchedule('vardagsrum');
    assertEqual(sched.periods.monday.length, 2);
    assertEqual(sched.periods.monday[0].start, '08:00');
    cleanup(sys);
  });
});

describe('SmartFloorHeatingControlSystem — weather & season', () => {
  it('setOutdoorConditions updates weather state', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    sys.setOutdoorConditions({ temperature: -5, humidity: 80, windSpeed: 10 });
    assertEqual(sys.weather.outdoorTemp, -5);
    assertEqual(sys.weather.outdoorHumidity, 80);
    cleanup(sys);
  });

  it('summer shutdown activates above 18°C outdoor avg', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    // Force summer scenario
    sys.weather.outdoorTemp = 22;
    sys.weather.season = 'summer';
    sys._checkSummerShutdown();
    assertEqual(sys.config.summerShutdown, true);
    cleanup(sys);
  });
});

describe('SmartFloorHeatingControlSystem — energy', () => {
  it('getEnergyReport returns report for day', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    const report = sys.getEnergyReport('day');
    assert(report, 'should return report');
    assertType(report.totalKwh, 'number');
    cleanup(sys);
  });

  it('getEnergyReport returns report for week/month/total', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    for (const period of ['week', 'month', 'total']) {
      const r = sys.getEnergyReport(period);
      assert(r, `report for ${period}`);
    }
    cleanup(sys);
  });

  it('updateEnergyPrice sets current price', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    sys.updateEnergyPrice(1.25);
    assertEqual(sys.energy.currentPriceSEKperKwh, 1.25);
    cleanup(sys);
  });

  it('getAnnualComparison returns comparison data', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    const comp = sys.getAnnualComparison();
    assert(comp, 'should return comparison');
    cleanup(sys);
  });

  it('resetDailyEnergy resets zone counters', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    sys.zones['vardagsrum'].energyTodayKwh = 5;
    sys.resetDailyEnergy();
    assertEqual(sys.zones['vardagsrum'].energyTodayKwh, 0);
    cleanup(sys);
  });
});

describe('SmartFloorHeatingControlSystem — occupancy & geofencing', () => {
  it('setOccupancy updates zone occupancy state', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    sys.setOccupancy('vardagsrum', false);
    assertEqual(sys.occupancy['vardagsrum'].occupied, false);
    sys.setOccupancy('vardagsrum', true);
    assertEqual(sys.occupancy['vardagsrum'].occupied, true);
    cleanup(sys);
  });

  it('updateGeofencing sets geofence data', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    sys.updateGeofencing({ arriving: true, eta: 30 });
    assert(sys.geofencing, 'geofencing should be set');
    cleanup(sys);
  });
});

describe('SmartFloorHeatingControlSystem — door/window sensors', () => {
  it('registerDoorWindowSensor and updateDoorWindowSensor', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    sys.registerDoorWindowSensor('vardagsrum', 'sensor-1');
    sys.updateDoorWindowSensor('sensor-1', true);
    // Window open should be reflected
    assert(sys._isWindowOpen('vardagsrum'), 'should detect open window');
    sys.updateDoorWindowSensor('sensor-1', false);
    assertEqual(sys._isWindowOpen('vardagsrum'), false);
    cleanup(sys);
  });
});

describe('SmartFloorHeatingControlSystem — comfort analysis', () => {
  it('getComfortScore returns PMV/PPD data', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    const score = sys.getComfortScore('vardagsrum');
    assert(score, 'should return score');
    assertType(score.pmv, 'number');
    assertType(score.ppd, 'number');
    assertType(score.score, 'number');
    assertType(score.rating, 'string');
    cleanup(sys);
  });

  it('getComfortComparison returns all zones', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    const comp = sys.getComfortComparison();
    assert(Array.isArray(comp), 'should be array');
    assertEqual(comp.length, 8);
    cleanup(sys);
  });

  it('getFloorUniformity returns simulated data', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    const uni = sys.getFloorUniformity('vardagsrum');
    assert(uni, 'should return uniformity');
    cleanup(sys);
  });
});

describe('SmartFloorHeatingControlSystem — maintenance', () => {
  it('getMaintenanceReport returns system health', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    const report = sys.getMaintenanceReport();
    assert(report, 'should return report');
    assertType(report.systemHealth, 'number');
    assert(Array.isArray(report.stuckValves), 'stuckValves array');
    assert(Array.isArray(report.flowAnomalies), 'flowAnomalies array');
    cleanup(sys);
  });
});

describe('SmartFloorHeatingControlSystem — system summary & statistics', () => {
  it('getSystemSummary returns comprehensive data', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    const summary = sys.getSystemSummary();
    assert(summary.timestamp, 'has timestamp');
    assertType(summary.zoneCount, 'number');
    assertEqual(summary.zoneCount, 8);
    assert(Array.isArray(summary.zones), 'zones is array');
    assertType(summary.totalCurrentPowerW, 'number');
    cleanup(sys);
  });

  it('getStatistics returns runtime & efficiency', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    const stats = sys.getStatistics();
    assert(Array.isArray(stats.runtimeHoursPerZone), 'has runtime');
    assert(Array.isArray(stats.heatingCyclesPerZone), 'has cycles');
    assertType(stats.totalEnergyKwh, 'number');
    cleanup(sys);
  });

  it('getZoneStatus returns single zone', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    const status = sys.getZoneStatus('vardagsrum');
    assert(status, 'should return status');
    cleanup(sys);
  });

  it('getAllZoneStatus returns all zones', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    const all = sys.getAllZoneStatus();
    assert(Array.isArray(all), 'should be array');
    assertEqual(all.length, 8);
    cleanup(sys);
  });
});

describe('SmartFloorHeatingControlSystem — PID configuration', () => {
  it('setPIDParams updates PID parameters', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    const result = sys.setPIDParams({ kp: 5, ki: 0.5, kd: 0.2 });
    assertEqual(result.kp, 5);
    assertEqual(result.ki, 0.5);
    assertEqual(result.kd, 0.2);
    cleanup(sys);
  });

  it('setPIDParams partial update', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    const origKi = sys.config.pidParams.ki;
    sys.setPIDParams({ kp: 10 });
    assertEqual(sys.config.pidParams.kp, 10);
    assertEqual(sys.config.pidParams.ki, origKi);
    cleanup(sys);
  });
});

describe('SmartFloorHeatingControlSystem — fault & night setback', () => {
  it('clearFault resets fault code', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    sys.zones['vardagsrum'].faultCode = 'OVER_TEMP';
    sys.clearFault('vardagsrum');
    assertEqual(sys.zones['vardagsrum'].faultCode, null);
    cleanup(sys);
  });

  it('clearFault throws for unknown zone', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    assertThrows(() => sys.clearFault('nope'), 'not found');
    cleanup(sys);
  });

  it('setNightSetback configures times', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    sys.setNightSetback('23:00', '06:00');
    assertEqual(sys.config.nightSetbackStart, '23:00');
    assertEqual(sys.config.nightSetbackEnd, '06:00');
    cleanup(sys);
  });

  it('setBathroomPreHeat configures pre-heat', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    sys.setBathroomPreHeat('06:30', 30);
    assertEqual(sys.config.bathroomPreHeatTime, '06:30');
    assertEqual(sys.config.bathroomPreHeatMinutes, 30);
    cleanup(sys);
  });
});

describe('SmartFloorHeatingControlSystem — control loop & PID', () => {
  it('_controlLoop runs without errors', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    sys._controlLoop();
    cleanup(sys);
  });

  it('_pidCompute returns value between 0 and 100', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    const output = sys._pidCompute('vardagsrum', 22, 18, Date.now());
    assertType(output, 'number');
    assert(output >= 0, 'should be >= 0');
    assert(output <= 100, 'should be <= 100');
    cleanup(sys);
  });

  it('_pidCompute returns 0 when at target', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    const output = sys._pidCompute('vardagsrum', 22, 22, Date.now());
    assertEqual(output, 0);
    cleanup(sys);
  });

  it('_floorProtection caps output at floor limit', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    // Set floor temp near limit for wood (27°C max)
    sys.zones['vardagsrum'].floorTemp = 26.5;
    const capped = sys._floorProtection('vardagsrum', 100);
    assert(capped < 100, 'output should be reduced near limit');
    cleanup(sys);
  });
});

describe('SmartFloorHeatingControlSystem — EventEmitter', () => {
  it('emits events for temperature changes', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    let eventData = null;
    sys.on('sensor-calibrated', (data) => { eventData = data; });
    sys.calibrateSensor('vardagsrum', 2);
    assert(eventData, 'should receive event');
    assertEqual(eventData.zoneId, 'vardagsrum');
    assertEqual(eventData.offset, 2);
    cleanup(sys);
  });

  it('emits pid-params-updated', () => {
    const sys = new SmartFloorHeatingControlSystem(createMockHomey());
    let emitted = false;
    sys.on('pid-params-updated', () => { emitted = true; });
    sys.setPIDParams({ kp: 3 });
    assert(emitted, 'should emit pid-params-updated');
    cleanup(sys);
  });
});

run();
