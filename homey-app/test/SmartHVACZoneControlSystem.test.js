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
  try { if (sys && typeof sys.destroy === 'function') sys.destroy(); } catch (_) {}
  while (activeHandles.length > 0) {
    const h = activeHandles.pop();
    if (h.type === 'timeout') clearTimeout(h.id); else clearInterval(h.id);
  }
}

const SmartHVACZoneControlSystem = require('../lib/SmartHVACZoneControlSystem');

describe('SmartHVACZoneControlSystem — constructor', () => {
  it('instantiates without errors', () => {
    const sys = new SmartHVACZoneControlSystem(createMockHomey());
    assert(sys, 'should create instance');
    assertEqual(sys.initialized, false);
    assertEqual(sys.zones.size, 0);
    assertEqual(sys.holidayMode, false);
    assertEqual(sys.vacationMode, false);
    cleanup(sys);
  });
});

describe('SmartHVACZoneControlSystem — initialize', () => {
  it('sets up zones, equipment, and ventilation', async () => {
    const sys = new SmartHVACZoneControlSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.initialized, true);
    assert(sys.zones.size >= 10, 'should have zones');
    assert(sys.equipment.size > 0, 'should have equipment');
    assert(sys.trvValves.size > 0, 'should have TRV valves');
    assert(sys.ventilation, 'should have ventilation');
    assert(sys.schedules.size > 0, 'should have schedules');
    assert(sys.intervals.length > 0, 'should have monitoring intervals');
    cleanup(sys);
  });
});

describe('SmartHVACZoneControlSystem — setZoneTarget', () => {
  it('sets target temperature for a zone', async () => {
    const sys = new SmartHVACZoneControlSystem(createMockHomey());
    await sys.initialize();
    const result = sys.setZoneTarget('living-room', 22.0);
    assertEqual(result, true);
    assertEqual(sys.zones.get('living-room').targetTemp, 22.0);
    cleanup(sys);
  });

  it('rejects out-of-range temperature', async () => {
    const sys = new SmartHVACZoneControlSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.setZoneTarget('living-room', 35), false);
    assertEqual(sys.setZoneTarget('living-room', 3), false);
    cleanup(sys);
  });

  it('returns false for unknown zone', async () => {
    const sys = new SmartHVACZoneControlSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.setZoneTarget('nonexistent', 21), false);
    cleanup(sys);
  });
});

describe('SmartHVACZoneControlSystem — setZoneMode', () => {
  it('sets valid mode', async () => {
    const sys = new SmartHVACZoneControlSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.setZoneMode('living-room', 'eco'), true);
    assertEqual(sys.zones.get('living-room').mode, 'eco');
    cleanup(sys);
  });

  it('rejects invalid mode', async () => {
    const sys = new SmartHVACZoneControlSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.setZoneMode('living-room', 'turbo'), false);
    cleanup(sys);
  });

  it('returns false for unknown zone', async () => {
    const sys = new SmartHVACZoneControlSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.setZoneMode('nonexistent', 'heat'), false);
    cleanup(sys);
  });
});

describe('SmartHVACZoneControlSystem — setZoneFanSpeed', () => {
  it('sets valid fan speed', async () => {
    const sys = new SmartHVACZoneControlSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.setZoneFanSpeed('office', 'high'), true);
    assertEqual(sys.zones.get('office').fanSpeed, 'high');
    cleanup(sys);
  });

  it('rejects invalid speed', async () => {
    const sys = new SmartHVACZoneControlSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.setZoneFanSpeed('office', 'turbo'), false);
    cleanup(sys);
  });
});

describe('SmartHVACZoneControlSystem — boostZone', () => {
  it('activates boost mode', async () => {
    const sys = new SmartHVACZoneControlSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.boostZone('living-room', 30), true);
    const zone = sys.zones.get('living-room');
    assertEqual(zone.boostMode, true);
    assert(zone.boostUntil > Date.now(), 'should be in the future');
    cleanup(sys);
  });

  it('returns false for unknown zone', async () => {
    const sys = new SmartHVACZoneControlSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.boostZone('nonexistent', 30), false);
    cleanup(sys);
  });
});

describe('SmartHVACZoneControlSystem — vacation & holiday mode', () => {
  it('setVacationMode enables vacation mode', async () => {
    const sys = new SmartHVACZoneControlSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.setVacationMode(true, 8), true);
    assertEqual(sys.vacationMode, true);
    cleanup(sys);
  });

  it('setHolidayMode enables holiday mode', async () => {
    const sys = new SmartHVACZoneControlSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.setHolidayMode(true), true);
    assertEqual(sys.holidayMode, true);
    cleanup(sys);
  });
});

describe('SmartHVACZoneControlSystem — sensor updates', () => {
  it('updateOccupancy updates zone', async () => {
    const sys = new SmartHVACZoneControlSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.updateOccupancy('kitchen', true, 2), true);
    const zone = sys.zones.get('kitchen');
    assertEqual(zone.occupancy.detected, true);
    assertEqual(zone.occupancy.count, 2);
    cleanup(sys);
  });

  it('updateWindowStatus updates zone', async () => {
    const sys = new SmartHVACZoneControlSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.updateWindowStatus('office', true), true);
    assertEqual(sys.zones.get('office').windowOpen, true);
    cleanup(sys);
  });

  it('updateDoorStatus updates zone', async () => {
    const sys = new SmartHVACZoneControlSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.updateDoorStatus('hallway', true), true);
    assertEqual(sys.zones.get('hallway').doorOpen, true);
    cleanup(sys);
  });

  it('updateOutdoorConditions updates conditions', async () => {
    const sys = new SmartHVACZoneControlSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.updateOutdoorConditions({ temperature: -5, humidity: 80 }), true);
    assertEqual(sys.outdoorConditions.temperature, -5);
    assertEqual(sys.outdoorConditions.humidity, 80);
    cleanup(sys);
  });
});

describe('SmartHVACZoneControlSystem — ventilation', () => {
  it('setVentilationBoost activates boost', async () => {
    const sys = new SmartHVACZoneControlSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.setVentilationBoost(true, 15), true);
    assertEqual(sys.ventilation.boostMode, true);
    cleanup(sys);
  });

  it('setVentilationBoost deactivates boost', async () => {
    const sys = new SmartHVACZoneControlSystem(createMockHomey());
    await sys.initialize();
    sys.setVentilationBoost(true, 15);
    sys.setVentilationBoost(false);
    assertEqual(sys.ventilation.boostMode, false);
    cleanup(sys);
  });
});

describe('SmartHVACZoneControlSystem — electricity price', () => {
  it('updateElectricityPrice updates price', async () => {
    const sys = new SmartHVACZoneControlSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.updateElectricityPrice(2.50), true);
    assertEqual(sys.costTracking.electricityPriceSEK, 2.50);
    cleanup(sys);
  });
});

describe('SmartHVACZoneControlSystem — status getters', () => {
  it('getZoneStatus returns zone details', async () => {
    const sys = new SmartHVACZoneControlSystem(createMockHomey());
    await sys.initialize();
    const status = sys.getZoneStatus('living-room');
    assert(status, 'should return status');
    assertType(status.currentTemp, 'number');
    assertType(status.targetTemp, 'number');
    cleanup(sys);
  });

  it('getZoneStatus returns null for unknown zone', async () => {
    const sys = new SmartHVACZoneControlSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.getZoneStatus('nonexistent'), null);
    cleanup(sys);
  });

  it('getAllZonesStatus returns all zones', async () => {
    const sys = new SmartHVACZoneControlSystem(createMockHomey());
    await sys.initialize();
    const statuses = sys.getAllZonesStatus();
    assert(Object.keys(statuses).length >= 10, 'should have all zones');
    cleanup(sys);
  });

  it('getEquipmentStatus returns equipment', async () => {
    const sys = new SmartHVACZoneControlSystem(createMockHomey());
    await sys.initialize();
    const status = sys.getEquipmentStatus();
    assert(Object.keys(status).length > 0, 'should have equipment');
    cleanup(sys);
  });

  it('getVentilationStatus returns ventilation info', async () => {
    const sys = new SmartHVACZoneControlSystem(createMockHomey());
    await sys.initialize();
    const status = sys.getVentilationStatus();
    assert(status, 'should return status');
    assert(status.filters, 'should have filters');
    cleanup(sys);
  });
});

describe('SmartHVACZoneControlSystem — reports', () => {
  it('getCostReport returns cost data', async () => {
    const sys = new SmartHVACZoneControlSystem(createMockHomey());
    await sys.initialize();
    const report = sys.getCostReport();
    assert(report, 'should return report');
    assertType(report.currentElectricityPrice, 'number');
    cleanup(sys);
  });

  it('getComfortReport returns comfort data', async () => {
    const sys = new SmartHVACZoneControlSystem(createMockHomey());
    await sys.initialize();
    const report = sys.getComfortReport();
    assert(report, 'should return report');
    cleanup(sys);
  });

  it('getMaintenanceReport returns maintenance data', async () => {
    const sys = new SmartHVACZoneControlSystem(createMockHomey());
    await sys.initialize();
    const report = sys.getMaintenanceReport();
    assert(report, 'should return report');
    cleanup(sys);
  });

  it('getDashboard returns dashboard data', async () => {
    const sys = new SmartHVACZoneControlSystem(createMockHomey());
    await sys.initialize();
    const dashboard = sys.getDashboard();
    assert(dashboard, 'should return dashboard');
    assert(dashboard.zones, 'should have zones');
    assert(dashboard.outdoor, 'should have outdoor');
    cleanup(sys);
  });
});

describe('SmartHVACZoneControlSystem — getStatistics', () => {
  it('returns comprehensive stats', async () => {
    const sys = new SmartHVACZoneControlSystem(createMockHomey());
    await sys.initialize();
    const stats = sys.getStatistics();
    assertType(stats.totalZones, 'number');
    assert(stats.totalZones >= 10, 'should have zones');
    assert(stats.currentSeason, 'should have season');
    assertType(stats.vacationMode, 'boolean');
    cleanup(sys);
  });
});

describe('SmartHVACZoneControlSystem — destroy', () => {
  it('clears all intervals', async () => {
    const sys = new SmartHVACZoneControlSystem(createMockHomey());
    await sys.initialize();
    sys.destroy();
    assertEqual(sys.intervals.length, 0);
    cleanup(sys);
  });
});

run();
