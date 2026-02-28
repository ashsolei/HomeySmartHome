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

const SmartGarageManagementSystem = require('../lib/SmartGarageManagementSystem');

describe('SmartGarageManagementSystem — constructor', () => {
  it('instantiates without errors', () => {
    const sys = new SmartGarageManagementSystem(createMockHomey());
    assert(sys, 'should create instance');
    assertEqual(sys.garage, null);
    assertEqual(sys.vehicles.size, 0);
    assertEqual(sys.tools.size, 0);
    cleanup(sys);
  });
});

describe('SmartGarageManagementSystem — initialize', () => {
  it('sets up garage, vehicles, and tools', async () => {
    const sys = new SmartGarageManagementSystem(createMockHomey());
    await sys.initialize();
    assert(sys.garage, 'should have garage');
    assertEqual(sys.garage.capacity, 2);
    assert(sys.vehicles.size > 0, 'should have vehicles');
    assert(sys.tools.size > 0, 'should have tools');
    assert(sys.garage.doors.length > 0, 'should have doors');
    cleanup(sys);
  });
});

describe('SmartGarageManagementSystem — door control', () => {
  it('opens a door', async () => {
    const sys = new SmartGarageManagementSystem(createMockHomey());
    await sys.initialize();
    const result = await sys.openDoor('door-001');
    assert(result, 'should return result');
    assertEqual(result.status, 'opening');
    cleanup(sys);
  });

  it('reports already open', async () => {
    const sys = new SmartGarageManagementSystem(createMockHomey());
    await sys.initialize();
    sys.garage.doors[0].status = 'open';
    const result = await sys.openDoor('door-001');
    assertEqual(result.message, 'Door is already open');
    cleanup(sys);
  });

  it('closes a door', async () => {
    const sys = new SmartGarageManagementSystem(createMockHomey());
    await sys.initialize();
    sys.garage.doors[0].status = 'open';
    const result = await sys.closeDoor('door-001');
    assertEqual(result.status, 'closing');
    cleanup(sys);
  });

  it('reports already closed', async () => {
    const sys = new SmartGarageManagementSystem(createMockHomey());
    await sys.initialize();
    const result = await sys.closeDoor('door-001');
    assertEqual(result.message, 'Door is already closed');
    cleanup(sys);
  });

  it('throws for unknown door', async () => {
    const sys = new SmartGarageManagementSystem(createMockHomey());
    await sys.initialize();
    let threw = false;
    try { await sys.openDoor('nonexistent'); } catch (_) { threw = true; }
    assertEqual(threw, true);
    cleanup(sys);
  });
});

describe('SmartGarageManagementSystem — vehicle management', () => {
  it('parkVehicle parks in empty spot', async () => {
    const sys = new SmartGarageManagementSystem(createMockHomey());
    await sys.initialize();
    // Free up spot 1 first
    sys.garage.parking.spots[0].occupied = false;
    sys.garage.parking.spots[0].vehicle = null;
    const result = await sys.parkVehicle('vehicle-001', 1);
    assertEqual(result.vehicle.status, 'parked');
    assertEqual(result.spot.occupied, true);
    cleanup(sys);
  });

  it('parkVehicle throws for occupied spot', async () => {
    const sys = new SmartGarageManagementSystem(createMockHomey());
    await sys.initialize();
    sys.garage.parking.spots[0].occupied = true;
    let threw = false;
    try { await sys.parkVehicle('vehicle-001', 1); } catch (_) { threw = true; }
    assertEqual(threw, true);
    cleanup(sys);
  });

  it('removeVehicle removes from spot', async () => {
    const sys = new SmartGarageManagementSystem(createMockHomey());
    await sys.initialize();
    const result = await sys.removeVehicle('vehicle-001');
    assertEqual(result.status, 'away');
    assertEqual(result.parkingSpot, null);
    cleanup(sys);
  });

  it('throws for unknown vehicle', async () => {
    const sys = new SmartGarageManagementSystem(createMockHomey());
    await sys.initialize();
    let threw = false;
    try { await sys.parkVehicle('nonexistent', 1); } catch (_) { threw = true; }
    assertEqual(threw, true);
    cleanup(sys);
  });
});

describe('SmartGarageManagementSystem — projects', () => {
  it('addProject creates a project', async () => {
    const sys = new SmartGarageManagementSystem(createMockHomey());
    await sys.initialize();
    const project = await sys.addProject({ name: 'Build Shelf', category: 'woodworking' });
    assert(project.id, 'should have id');
    assertEqual(project.name, 'Build Shelf');
    assertEqual(project.status, 'planning');
    assertEqual(sys.projects.length, 1);
    cleanup(sys);
  });

  it('getProjects returns all projects', async () => {
    const sys = new SmartGarageManagementSystem(createMockHomey());
    await sys.initialize();
    await sys.addProject({ name: 'Project A' });
    await sys.addProject({ name: 'Project B' });
    const all = sys.getProjects();
    assertEqual(all.length, 2);
    cleanup(sys);
  });

  it('getProjects filters by status', async () => {
    const sys = new SmartGarageManagementSystem(createMockHomey());
    await sys.initialize();
    await sys.addProject({ name: 'Project A' });
    const planning = sys.getProjects('planning');
    assertEqual(planning.length, 1);
    const inProgress = sys.getProjects('in-progress');
    assertEqual(inProgress.length, 0);
    cleanup(sys);
  });
});

describe('SmartGarageManagementSystem — getters', () => {
  it('getGarage returns garage object', async () => {
    const sys = new SmartGarageManagementSystem(createMockHomey());
    await sys.initialize();
    const garage = sys.getGarage();
    assert(garage, 'should return garage');
    assertEqual(garage.id, 'garage-main');
    cleanup(sys);
  });

  it('getVehicles returns all vehicles', async () => {
    const sys = new SmartGarageManagementSystem(createMockHomey());
    await sys.initialize();
    const vehicles = sys.getVehicles();
    assertEqual(vehicles.length, 2);
    cleanup(sys);
  });

  it('getTools returns all tools', async () => {
    const sys = new SmartGarageManagementSystem(createMockHomey());
    await sys.initialize();
    const tools = sys.getTools();
    assertEqual(tools.length, 8);
    cleanup(sys);
  });

  it('getTools filters by category', async () => {
    const sys = new SmartGarageManagementSystem(createMockHomey());
    await sys.initialize();
    const powerTools = sys.getTools({ category: 'power-tools' });
    assert(powerTools.length > 0, 'should have power tools');
    assert(powerTools.every(t => t.category === 'power-tools'), 'all should be power tools');
    cleanup(sys);
  });

  it('getTools filters by low battery', async () => {
    const sys = new SmartGarageManagementSystem(createMockHomey());
    await sys.initialize();
    const lowBattery = sys.getTools({ batteryLow: true });
    assert(lowBattery.every(t => t.batteryLevel < 20), 'all should have low battery');
    cleanup(sys);
  });

  it('getDoorEvents returns events', async () => {
    const sys = new SmartGarageManagementSystem(createMockHomey());
    await sys.initialize();
    const events = sys.getDoorEvents();
    assert(Array.isArray(events), 'should be array');
    cleanup(sys);
  });

  it('getMaintenanceReminders returns reminders', async () => {
    const sys = new SmartGarageManagementSystem(createMockHomey());
    await sys.initialize();
    const reminders = sys.getMaintenanceReminders();
    assert(Array.isArray(reminders), 'should be array');
    cleanup(sys);
  });
});

describe('SmartGarageManagementSystem — getStats', () => {
  it('returns comprehensive statistics', async () => {
    const sys = new SmartGarageManagementSystem(createMockHomey());
    await sys.initialize();
    const stats = sys.getStats();
    assertEqual(stats.totalVehicles, 2);
    assertEqual(stats.totalTools, 8);
    assertType(stats.parkedVehicles, 'number');
    assertType(stats.lowBatteryTools, 'number');
    assertType(stats.totalProjects, 'number');
    assert(stats.storageUtilization, 'should have storage utilization');
    cleanup(sys);
  });
});

describe('SmartGarageManagementSystem — destroy', () => {
  it('cleans up intervals', async () => {
    const sys = new SmartGarageManagementSystem(createMockHomey());
    await sys.initialize();
    await sys.destroy();
    cleanup(sys);
  });
});

run();
