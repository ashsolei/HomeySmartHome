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

const SmartHomeVentilationHeatRecoverySystem = require('../lib/SmartHomeVentilationHeatRecoverySystem');

/* ================================================================== */
/*  SmartHomeVentilationHeatRecoverySystem – test suite                */
/* ================================================================== */

describe('VentilationHR — constructor & lifecycle', () => {
  it('instantiates without errors', () => {
    const sys = new SmartHomeVentilationHeatRecoverySystem(createMockHomey());
    assert(sys, 'should create instance');
    cleanup(sys);
  });

  it('starts uninitialized with empty maps', () => {
    const sys = new SmartHomeVentilationHeatRecoverySystem(createMockHomey());
    assertEqual(sys._initialized, false);
    assertEqual(sys.units.size, 0);
    assertEqual(sys.zones.size, 0);
    cleanup(sys);
  });

  it('initialize sets _initialized flag and starts intervals', async () => {
    const sys = new SmartHomeVentilationHeatRecoverySystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys._initialized, true);
    cleanup(sys);
  });

  it('initialize is idempotent', async () => {
    const sys = new SmartHomeVentilationHeatRecoverySystem(createMockHomey());
    await sys.initialize();
    await sys.initialize();
    assertEqual(sys._initialized, true);
    cleanup(sys);
  });

  it('destroy clears intervals and resets state', async () => {
    const sys = new SmartHomeVentilationHeatRecoverySystem(createMockHomey());
    await sys.initialize();
    sys.destroy();
    assertEqual(sys._initialized, false);
    assertEqual(sys._monitorInterval, null);
    assertEqual(sys._filterCheckInterval, null);
    assertEqual(sys._energyCalcInterval, null);
    cleanup(sys);
  });
});

describe('VentilationHR — unit management', () => {
  it('registerUnit creates a new unit', async () => {
    const sys = new SmartHomeVentilationHeatRecoverySystem(createMockHomey());
    await sys.initialize();
    const unit = sys.registerUnit('hrv1', 'Main HRV', ['zone1']);
    assert(unit, 'should return unit');
    assertEqual(unit.id, 'hrv1');
    assertEqual(unit.name, 'Main HRV');
    assertEqual(unit.state, 'idle');
    assertEqual(sys.units.size, 1);
    cleanup(sys);
  });

  it('registerUnit returns existing unit for duplicate id', async () => {
    const sys = new SmartHomeVentilationHeatRecoverySystem(createMockHomey());
    await sys.initialize();
    sys.registerUnit('hrv1', 'Main HRV');
    const dup = sys.registerUnit('hrv1', 'Duplicate');
    assertEqual(dup.name, 'Main HRV');
    assertEqual(sys.units.size, 1);
    cleanup(sys);
  });

  it('removeUnit removes a unit and its filters', async () => {
    const sys = new SmartHomeVentilationHeatRecoverySystem(createMockHomey());
    await sys.initialize();
    sys.registerUnit('hrv1', 'Main HRV');
    assertEqual(sys.removeUnit('hrv1'), true);
    assertEqual(sys.units.size, 0);
    assertEqual(sys.filters.has('hrv1'), false);
    cleanup(sys);
  });

  it('removeUnit returns false for unknown unit', async () => {
    const sys = new SmartHomeVentilationHeatRecoverySystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.removeUnit('nope'), false);
    cleanup(sys);
  });

  it('listUnits returns all registered units', async () => {
    const sys = new SmartHomeVentilationHeatRecoverySystem(createMockHomey());
    await sys.initialize();
    sys.registerUnit('h1', 'Unit 1');
    sys.registerUnit('h2', 'Unit 2');
    const list = sys.listUnits();
    assertEqual(list.length, 2);
    cleanup(sys);
  });

  it('getUnitStatus returns unit or null', async () => {
    const sys = new SmartHomeVentilationHeatRecoverySystem(createMockHomey());
    await sys.initialize();
    sys.registerUnit('hrv1', 'Test');
    assert(sys.getUnitStatus('hrv1'), 'should return unit');
    assertEqual(sys.getUnitStatus('nope'), null);
    cleanup(sys);
  });
});

describe('VentilationHR — fan speed & bypass', () => {
  it('setFanSpeed changes speed and state', async () => {
    const sys = new SmartHomeVentilationHeatRecoverySystem(createMockHomey());
    await sys.initialize();
    sys.registerUnit('hrv1', 'Test');
    assertEqual(sys.setFanSpeed('hrv1', 'high'), true);
    const unit = sys.getUnitStatus('hrv1');
    assertEqual(unit.fanSpeed, 'high');
    assertEqual(unit.fanSpeedPercent, 75);
    assertEqual(unit.state, 'active');
    cleanup(sys);
  });

  it('setFanSpeed off sets state to idle', async () => {
    const sys = new SmartHomeVentilationHeatRecoverySystem(createMockHomey());
    await sys.initialize();
    sys.registerUnit('hrv1', 'Test');
    sys.setFanSpeed('hrv1', 'high');
    sys.setFanSpeed('hrv1', 'off');
    assertEqual(sys.getUnitStatus('hrv1').state, 'idle');
    cleanup(sys);
  });

  it('setFanSpeed boost sets state to boost', async () => {
    const sys = new SmartHomeVentilationHeatRecoverySystem(createMockHomey());
    await sys.initialize();
    sys.registerUnit('hrv1', 'Test');
    sys.setFanSpeed('hrv1', 'boost');
    assertEqual(sys.getUnitStatus('hrv1').state, 'boost');
    cleanup(sys);
  });

  it('setFanSpeed returns false for invalid speed', async () => {
    const sys = new SmartHomeVentilationHeatRecoverySystem(createMockHomey());
    await sys.initialize();
    sys.registerUnit('hrv1', 'Test');
    assertEqual(sys.setFanSpeed('hrv1', 'turbo'), false);
    cleanup(sys);
  });

  it('setBypass opens and closes bypass valve', async () => {
    const sys = new SmartHomeVentilationHeatRecoverySystem(createMockHomey());
    await sys.initialize();
    sys.registerUnit('hrv1', 'Test');
    sys.setFanSpeed('hrv1', 'medium');
    assertEqual(sys.setBypass('hrv1', true), true);
    assertEqual(sys.getUnitStatus('hrv1').bypassOpen, true);
    assertEqual(sys.getUnitStatus('hrv1').state, 'bypass');
    sys.setBypass('hrv1', false);
    assertEqual(sys.getUnitStatus('hrv1').state, 'active');
    cleanup(sys);
  });

  it('triggerDefrost starts defrost cycle', async () => {
    const sys = new SmartHomeVentilationHeatRecoverySystem(createMockHomey());
    await sys.initialize();
    sys.registerUnit('hrv1', 'Test');
    sys.setFanSpeed('hrv1', 'medium');
    assertEqual(sys.triggerDefrost('hrv1'), true);
    assertEqual(sys.getUnitStatus('hrv1').defrostActive, true);
    assertEqual(sys.getUnitStatus('hrv1').state, 'defrosting');
    cleanup(sys);
  });
});

describe('VentilationHR — temperature & efficiency', () => {
  it('updateTemperatures recalculates efficiency', async () => {
    const sys = new SmartHomeVentilationHeatRecoverySystem(createMockHomey());
    await sys.initialize();
    sys.registerUnit('hrv1', 'Test');
    const eff = sys.updateTemperatures('hrv1', {
      supplyTemp: 18, extractTemp: 22, outdoorTemp: 0, exhaustTemp: 4
    });
    assertType(eff, 'number');
    assert(eff > 0, 'efficiency should be positive');
    assert(eff <= 100, 'efficiency should be <= 100');
    cleanup(sys);
  });

  it('updateTemperatures returns -1 for unknown unit', async () => {
    const sys = new SmartHomeVentilationHeatRecoverySystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.updateTemperatures('nope', { supplyTemp: 0, extractTemp: 0, outdoorTemp: 0, exhaustTemp: 0 }), -1);
    cleanup(sys);
  });

  it('getEfficiencyReport returns array with ratings', async () => {
    const sys = new SmartHomeVentilationHeatRecoverySystem(createMockHomey());
    await sys.initialize();
    sys.registerUnit('hrv1', 'Test');
    sys.updateTemperatures('hrv1', { supplyTemp: 19, extractTemp: 22, outdoorTemp: 0, exhaustTemp: 3 });
    const report = sys.getEfficiencyReport();
    assert(Array.isArray(report), 'should be array');
    assertEqual(report.length, 1);
    assert(report[0].rating, 'should have rating');
    cleanup(sys);
  });
});

describe('VentilationHR — zones & occupancy', () => {
  it('registerZone creates zone with defaults', async () => {
    const sys = new SmartHomeVentilationHeatRecoverySystem(createMockHomey());
    await sys.initialize();
    const zone = sys.registerZone('z1', 'Living Room', 80);
    assert(zone, 'should return zone');
    assertEqual(zone.id, 'z1');
    assertEqual(zone.targetFlowRate, 80);
    assertEqual(zone.damperPosition, 50);
    cleanup(sys);
  });

  it('registerZone returns existing zone for duplicate', async () => {
    const sys = new SmartHomeVentilationHeatRecoverySystem(createMockHomey());
    await sys.initialize();
    sys.registerZone('z1', 'Living Room');
    const dup = sys.registerZone('z1', 'Duplicate');
    assertEqual(dup.name, 'Living Room');
    cleanup(sys);
  });

  it('removeZone removes zone', async () => {
    const sys = new SmartHomeVentilationHeatRecoverySystem(createMockHomey());
    await sys.initialize();
    sys.registerZone('z1', 'Room');
    assertEqual(sys.removeZone('z1'), true);
    assertEqual(sys.zones.size, 0);
    cleanup(sys);
  });

  it('getZoneStatus and listZones work correctly', async () => {
    const sys = new SmartHomeVentilationHeatRecoverySystem(createMockHomey());
    await sys.initialize();
    sys.registerZone('z1', 'Room 1');
    sys.registerZone('z2', 'Room 2');
    assert(sys.getZoneStatus('z1'), 'should return zone');
    assertEqual(sys.getZoneStatus('z99'), null);
    assertEqual(sys.listZones().length, 2);
    cleanup(sys);
  });

  it('updateOccupancy adjusts target flow rate', async () => {
    const sys = new SmartHomeVentilationHeatRecoverySystem(createMockHomey());
    await sys.initialize();
    sys.registerZone('z1', 'Room');
    sys.updateOccupancy('z1', true, 3);
    const zone = sys.getZoneStatus('z1');
    assertEqual(zone.occupied, true);
    assertEqual(zone.occupantCount, 3);
    assert(zone.targetFlowRate >= 90, 'flow rate should be >= 90 for 3 people');
    cleanup(sys);
  });

  it('updateOccupancy unoccupied sets minimum flow', async () => {
    const sys = new SmartHomeVentilationHeatRecoverySystem(createMockHomey());
    await sys.initialize();
    sys.registerZone('z1', 'Room');
    sys.updateOccupancy('z1', false);
    const zone = sys.getZoneStatus('z1');
    assertEqual(zone.occupantCount, 0);
    assertEqual(zone.targetFlowRate, 15);
    cleanup(sys);
  });
});

describe('VentilationHR — filters', () => {
  it('registerUnit creates supply and extract filters', async () => {
    const sys = new SmartHomeVentilationHeatRecoverySystem(createMockHomey());
    await sys.initialize();
    sys.registerUnit('hrv1', 'Test');
    const filters = sys.getFilterStatus('hrv1');
    assert(filters, 'should have filters');
    assertEqual(filters.length, 2);
    cleanup(sys);
  });

  it('updateFilterPressure flags replacement when needed', async () => {
    const sys = new SmartHomeVentilationHeatRecoverySystem(createMockHomey());
    await sys.initialize();
    sys.registerUnit('hrv1', 'Test');
    const filter = sys.updateFilterPressure('hrv1', 'supply', 100);
    assert(filter, 'should return filter');
    assertEqual(filter.replacementDue, true);
    cleanup(sys);
  });

  it('replaceFilter resets filter state', async () => {
    const sys = new SmartHomeVentilationHeatRecoverySystem(createMockHomey());
    await sys.initialize();
    sys.registerUnit('hrv1', 'Test');
    sys.updateFilterPressure('hrv1', 'supply', 100);
    assertEqual(sys.replaceFilter('hrv1', 'supply'), true);
    const filters = sys.getFilterStatus('hrv1');
    const supply = filters.find(f => f.type === 'supply');
    assertEqual(supply.replacementDue, false);
    assertEqual(supply.efficiencyPercent, 100);
    cleanup(sys);
  });

  it('getFiltersNeedingReplacement returns flagged filters', async () => {
    const sys = new SmartHomeVentilationHeatRecoverySystem(createMockHomey());
    await sys.initialize();
    sys.registerUnit('hrv1', 'Test');
    sys.updateFilterPressure('hrv1', 'supply', 100);
    const needReplacement = sys.getFiltersNeedingReplacement();
    assert(needReplacement.length >= 1, 'should have at least one filter needing replacement');
    cleanup(sys);
  });
});

describe('VentilationHR — seasonal mode & CO2', () => {
  it('setSeasonalMode accepts valid modes', async () => {
    const sys = new SmartHomeVentilationHeatRecoverySystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.setSeasonalMode('winter'), true);
    assertEqual(sys.getSeasonalMode(), 'winter');
    assertEqual(sys.setSeasonalMode('summer'), true);
    assertEqual(sys.setSeasonalMode('auto'), true);
    cleanup(sys);
  });

  it('setSeasonalMode rejects invalid modes', async () => {
    const sys = new SmartHomeVentilationHeatRecoverySystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.setSeasonalMode('tropical'), false);
    cleanup(sys);
  });

  it('setCO2Setpoint accepts valid range', async () => {
    const sys = new SmartHomeVentilationHeatRecoverySystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.setCO2Setpoint(600), true);
    assertEqual(sys.co2Setpoint, 600);
    cleanup(sys);
  });

  it('setCO2Setpoint rejects out-of-range values', async () => {
    const sys = new SmartHomeVentilationHeatRecoverySystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.setCO2Setpoint(300), false);
    assertEqual(sys.setCO2Setpoint(2000), false);
    cleanup(sys);
  });

  it('setHumiditySetpoint accepts valid range', async () => {
    const sys = new SmartHomeVentilationHeatRecoverySystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.setHumiditySetpoint(45), true);
    assertEqual(sys.humiditySetpoint, 45);
    assertEqual(sys.setHumiditySetpoint(10), false);
    assertEqual(sys.setHumiditySetpoint(80), false);
    cleanup(sys);
  });
});

describe('VentilationHR — energy & integration', () => {
  it('getEnergySavings returns savings object', async () => {
    const sys = new SmartHomeVentilationHeatRecoverySystem(createMockHomey());
    await sys.initialize();
    const savings = sys.getEnergySavings();
    assertType(savings.recoveredHeatKwh, 'number');
    assertType(savings.costSavings, 'number');
    assertType(savings.co2Avoided, 'number');
    cleanup(sys);
  });

  it('resetEnergySavings returns previous and resets', async () => {
    const sys = new SmartHomeVentilationHeatRecoverySystem(createMockHomey());
    await sys.initialize();
    const prev = sys.resetEnergySavings();
    assertType(prev.recoveredHeatKwh, 'number');
    assertEqual(sys.energySavings.recoveredHeatKwh, 0);
    cleanup(sys);
  });

  it('getSystemSummary returns comprehensive summary', async () => {
    const sys = new SmartHomeVentilationHeatRecoverySystem(createMockHomey());
    await sys.initialize();
    sys.registerUnit('hrv1', 'Test');
    sys.registerZone('z1', 'Room');
    const summary = sys.getSystemSummary();
    assertEqual(summary.unitCount, 1);
    assertEqual(summary.zoneCount, 1);
    assertType(summary.averageEfficiency, 'number');
    assert(summary.energySavings, 'should have energy savings');
    cleanup(sys);
  });

  it('getHVACIntegrationData returns typed payload', async () => {
    const sys = new SmartHomeVentilationHeatRecoverySystem(createMockHomey());
    await sys.initialize();
    sys.registerUnit('hrv1', 'Test');
    const data = sys.getHVACIntegrationData();
    assertEqual(data.type, 'ventilation_heat_recovery');
    assert(Array.isArray(data.units), 'should have units array');
    cleanup(sys);
  });

  it('handleExternalEvent processes temperature_update', async () => {
    const sys = new SmartHomeVentilationHeatRecoverySystem(createMockHomey());
    await sys.initialize();
    sys.registerUnit('hrv1', 'Test');
    sys.handleExternalEvent('hvac', 'temperature_update', {
      unitId: 'hrv1', supplyTemp: 18, extractTemp: 22, outdoorTemp: 5, exhaustTemp: 7
    });
    const unit = sys.getUnitStatus('hrv1');
    assertEqual(unit.supplyTemp, 18);
    assertEqual(unit.outdoorTemp, 5);
    cleanup(sys);
  });

  it('evaluateCondensationRisk returns risk assessment', async () => {
    const sys = new SmartHomeVentilationHeatRecoverySystem(createMockHomey());
    await sys.initialize();
    sys.registerZone('z1', 'Room');
    const zone = sys.getZoneStatus('z1');
    zone.humidity = 75;
    const result = sys.evaluateCondensationRisk('z1');
    assertEqual(result.risk, 'high');
    assertEqual(result.action, 'increase_ventilation');
    cleanup(sys);
  });
});

run();
