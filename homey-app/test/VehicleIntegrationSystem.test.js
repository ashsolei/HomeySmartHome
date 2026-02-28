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

const VehicleIntegrationSystem = require('../lib/VehicleIntegrationSystem');

function mockHomeyWithDrivers() {
  return createMockHomey({ drivers: { getDevices() { return []; } } });
}

describe('Vehicle — constructor & lifecycle', () => {
  it('instantiates without errors', () => {
    const sys = new VehicleIntegrationSystem(mockHomeyWithDrivers());
    assert(sys, 'should create instance');
    assertEqual(sys.vehicles.size, 0);
    assertEqual(sys.smartChargingEnabled, true);
    cleanup(sys);
  });

  it('initialize discovers devices and loads defaults', async () => {
    const sys = new VehicleIntegrationSystem(mockHomeyWithDrivers());
    await sys.initialize();
    assert(sys.vehicles.size > 0, 'should have default vehicles');
    cleanup(sys);
  });

  it('destroy clears monitoring interval', async () => {
    const sys = new VehicleIntegrationSystem(mockHomeyWithDrivers());
    await sys.initialize();
    sys.destroy();
    assertEqual(sys.monitoringInterval, null);
    cleanup(sys);
  });
});

describe('Vehicle — add & remove vehicles', () => {
  it('addVehicle adds a new vehicle', async () => {
    const sys = new VehicleIntegrationSystem(mockHomeyWithDrivers());
    await sys.initialize();
    const vehicle = await sys.addVehicle({
      name: 'Volvo XC40',
      type: 'electric',
      batteryCapacity: 78,
      currentCharge: 80,
      range: 400,
      currentRangeKm: 320
    });
    assert(vehicle, 'should return vehicle');
    assertEqual(vehicle.name, 'Volvo XC40');
    assertEqual(vehicle.type, 'electric');
    assert(sys.vehicles.has(vehicle.id), 'should be in vehicles map');
    cleanup(sys);
  });

  it('removeVehicle removes existing vehicle', async () => {
    const sys = new VehicleIntegrationSystem(mockHomeyWithDrivers());
    await sys.initialize();
    const vehicle = await sys.addVehicle({ name: 'RemoveMe' });
    assertEqual(await sys.removeVehicle(vehicle.id), true);
    assertEqual(sys.vehicles.has(vehicle.id), false);
    cleanup(sys);
  });

  it('removeVehicle returns false for unknown vehicle', async () => {
    const sys = new VehicleIntegrationSystem(mockHomeyWithDrivers());
    await sys.initialize();
    assertEqual(await sys.removeVehicle('nope'), false);
    cleanup(sys);
  });
});

describe('Vehicle — status queries', () => {
  it('getVehicleStatus returns status for known vehicle', async () => {
    const sys = new VehicleIntegrationSystem(mockHomeyWithDrivers());
    await sys.initialize();
    const status = sys.getVehicleStatus('vehicle_1');
    assert(status, 'should return status');
    assertEqual(status.name, 'Tesla Model 3');
    assertEqual(status.type, 'electric');
    assertType(status.odometer, 'number');
    cleanup(sys);
  });

  it('getVehicleStatus returns null for unknown vehicle', async () => {
    const sys = new VehicleIntegrationSystem(mockHomeyWithDrivers());
    await sys.initialize();
    assertEqual(sys.getVehicleStatus('nope'), null);
    cleanup(sys);
  });
});

describe('Vehicle — trip recording & analysis', () => {
  it('recordTrip records a trip', async () => {
    const sys = new VehicleIntegrationSystem(mockHomeyWithDrivers());
    await sys.initialize();
    const trip = await sys.recordTrip('vehicle_1', {
      distanceKm: 25,
      avgSpeedKmh: 50,
      durationMin: 30
    });
    assert(trip, 'should return trip');
    assertEqual(trip.distanceKm, 25);
    assertType(trip.cost, 'number');
    assert(trip.cost > 0, 'should have calculated cost');
    cleanup(sys);
  });

  it('recordTrip returns null for unknown vehicle', async () => {
    const sys = new VehicleIntegrationSystem(mockHomeyWithDrivers());
    await sys.initialize();
    assertEqual(await sys.recordTrip('nope', { distanceKm: 10 }), null);
    cleanup(sys);
  });

  it('getTripHistory returns recorded trips', async () => {
    const sys = new VehicleIntegrationSystem(mockHomeyWithDrivers());
    await sys.initialize();
    await sys.recordTrip('vehicle_1', { distanceKm: 15 });
    const history = sys.getTripHistory('vehicle_1');
    assert(history.length > 0, 'should have trips');
    cleanup(sys);
  });

  it('getDrivingAnalysis returns analysis data', async () => {
    const sys = new VehicleIntegrationSystem(mockHomeyWithDrivers());
    await sys.initialize();
    await sys.recordTrip('vehicle_1', { distanceKm: 30, avgSpeedKmh: 60 });
    const analysis = sys.getDrivingAnalysis('vehicle_1');
    assertType(analysis.totalTrips, 'number');
    assertType(analysis.totalDistanceKm, 'number');
    assertType(analysis.totalCostSEK, 'number');
    cleanup(sys);
  });

  it('getDrivingAnalysis returns no_data when empty', async () => {
    const sys = new VehicleIntegrationSystem(mockHomeyWithDrivers());
    await sys.initialize();
    const v = await sys.addVehicle({ name: 'Empty' });
    const analysis = sys.getDrivingAnalysis(v.id);
    assertEqual(analysis.status, 'no_data');
    cleanup(sys);
  });
});

describe('Vehicle — fuel cost & maintenance', () => {
  it('getFuelCostSummary returns cost summary', async () => {
    const sys = new VehicleIntegrationSystem(mockHomeyWithDrivers());
    await sys.initialize();
    const summary = sys.getFuelCostSummary(null, 'monthly');
    assertEqual(summary.period, 'monthly');
    assertType(summary.tripCostSEK, 'number');
    assertType(summary.totalCostSEK, 'number');
    cleanup(sys);
  });

  it('setMaintenanceReminder creates a reminder', async () => {
    const sys = new VehicleIntegrationSystem(mockHomeyWithDrivers());
    await sys.initialize();
    const reminder = await sys.setMaintenanceReminder('vehicle_1', {
      type: 'oil_change',
      description: 'Oljebyte',
      intervalKm: 15000
    });
    assert(reminder, 'should return reminder');
    assertEqual(reminder.type, 'oil_change');
    assertEqual(reminder.active, true);
    cleanup(sys);
  });

  it('setMaintenanceReminder returns null for unknown vehicle', async () => {
    const sys = new VehicleIntegrationSystem(mockHomeyWithDrivers());
    await sys.initialize();
    assertEqual(await sys.setMaintenanceReminder('nope', { type: 'test' }), null);
    cleanup(sys);
  });

  it('recordMaintenancePerformed updates reminder', async () => {
    const sys = new VehicleIntegrationSystem(mockHomeyWithDrivers());
    await sys.initialize();
    await sys.setMaintenanceReminder('vehicle_1', { type: 'tire_rotation', intervalKm: 10000 });
    const result = await sys.recordMaintenancePerformed('vehicle_1', 'tire_rotation');
    assert(result, 'should return updated reminder');
    assert(result.lastPerformed, 'should have lastPerformed');
    cleanup(sys);
  });

  it('getMaintenanceStatus returns array of reminders', async () => {
    const sys = new VehicleIntegrationSystem(mockHomeyWithDrivers());
    await sys.initialize();
    await sys.setMaintenanceReminder('vehicle_1', { type: 'brake_check' });
    const status = sys.getMaintenanceStatus('vehicle_1');
    assert(Array.isArray(status), 'should be array');
    assert(status.length > 0, 'should have reminders');
    cleanup(sys);
  });
});

describe('Vehicle — preconditioning & departure learning', () => {
  it('schedulePrecondition creates a schedule', async () => {
    const sys = new VehicleIntegrationSystem(mockHomeyWithDrivers());
    await sys.initialize();
    const schedule = await sys.schedulePrecondition('vehicle_1', {
      targetTemp: 22,
      departureTime: '07:30',
      recurringDays: [1, 5]
    });
    assert(schedule, 'should return schedule');
    assertEqual(schedule.targetTemp, 22);
    cleanup(sys);
  });

  it('schedulePrecondition returns null for unknown vehicle', async () => {
    const sys = new VehicleIntegrationSystem(mockHomeyWithDrivers());
    await sys.initialize();
    assertEqual(await sys.schedulePrecondition('nope', {}), null);
    cleanup(sys);
  });

  it('learnDeparturePattern returns pattern data', async () => {
    const sys = new VehicleIntegrationSystem(mockHomeyWithDrivers());
    await sys.initialize();
    await sys.recordTrip('vehicle_1', { distanceKm: 20 });
    const pattern = sys.learnDeparturePattern('vehicle_1');
    assert(pattern, 'should return pattern');
    cleanup(sys);
  });
});

describe('Vehicle — statistics', () => {
  it('getStatistics returns comprehensive stats', async () => {
    const sys = new VehicleIntegrationSystem(mockHomeyWithDrivers());
    await sys.initialize();
    const stats = sys.getStatistics();
    assertType(stats.vehicles, 'number');
    assert(stats.vehicles > 0, 'should have vehicles');
    assertEqual(stats.smartChargingEnabled, true);
    assertEqual(stats.garageAutomationEnabled, true);
    assertType(stats.totalTrips, 'number');
    cleanup(sys);
  });
});

run();
