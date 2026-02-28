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

const HomeRoboticsOrchestrationSystem = require('../lib/HomeRoboticsOrchestrationSystem');

describe('HomeRoboticsOrchestrationSystem — constructor & init', () => {
  it('instantiates with default robots and zones', () => {
    const sys = new HomeRoboticsOrchestrationSystem(createMockHomey());
    assert(sys, 'should create instance');
    assert(sys.robots.size > 0, 'should have default robots');
    assert(sys.cleaningZones.size > 0, 'should have default zones');
    cleanup(sys);
  });

  it('initialize sets flag', async () => {
    const sys = new HomeRoboticsOrchestrationSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.initialized, true);
    cleanup(sys);
  });

  it('destroy clears state', async () => {
    const sys = new HomeRoboticsOrchestrationSystem(createMockHomey());
    await sys.initialize();
    sys.destroy();
    assertEqual(sys.initialized, false);
    assertEqual(sys.robots.size, 0);
    cleanup(sys);
  });
});

describe('HomeRoboticsOrchestrationSystem — scheduling', () => {
  it('scheduleRobot creates a schedule', async () => {
    const sys = new HomeRoboticsOrchestrationSystem(createMockHomey());
    await sys.initialize();
    const robotId = sys.robots.keys().next().value;
    const zone = sys.cleaningZones.keys().next().value;
    const result = sys.scheduleRobot(robotId, {
      startTime: '09:00', endTime: '10:00',
      days: ['monday', 'wednesday'], zone, enabled: true
    });
    assert(result.success, 'should succeed');
    cleanup(sys);
  });

  it('scheduleRobot rejects invalid time format', async () => {
    const sys = new HomeRoboticsOrchestrationSystem(createMockHomey());
    await sys.initialize();
    const robotId = sys.robots.keys().next().value;
    const result = sys.scheduleRobot(robotId, { startTime: 'bad', endTime: '10:00', days: ['monday'] });
    assertEqual(result.success, false);
    cleanup(sys);
  });

  it('scheduleRobot rejects unknown robot', async () => {
    const sys = new HomeRoboticsOrchestrationSystem(createMockHomey());
    await sys.initialize();
    const result = sys.scheduleRobot('nonexistent', { startTime: '09:00', endTime: '10:00', days: ['monday'] });
    assertEqual(result.success, false);
    cleanup(sys);
  });

  it('removeSchedule works', async () => {
    const sys = new HomeRoboticsOrchestrationSystem(createMockHomey());
    await sys.initialize();
    const robotId = sys.robots.keys().next().value;
    const zone = sys.cleaningZones.keys().next().value;
    const res = sys.scheduleRobot(robotId, { startTime: '11:00', endTime: '12:00', days: ['tuesday'], zone, enabled: true });
    if (res.scheduleId) {
      const removed = sys.removeSchedule(robotId, res.scheduleId);
      assertEqual(removed, true);
    }
    cleanup(sys);
  });
});

describe('HomeRoboticsOrchestrationSystem — cleaning sessions', () => {
  it('startOccupancyAwareCleaning starts cleaning', async () => {
    const sys = new HomeRoboticsOrchestrationSystem(createMockHomey());
    await sys.initialize();
    const robotId = sys.robots.keys().next().value;
    const robot = sys.robots.get(robotId);
    const zone = [...sys.cleaningZones.entries()].find(([_k, z]) => z.allowedRobots.includes(robot.type));
    if (zone) {
      const result = await sys.startOccupancyAwareCleaning(robotId, zone[0]);
      assertEqual(result.success, true);
    }
    cleanup(sys);
  });

  it('startOccupancyAwareCleaning respects occupancy', async () => {
    const sys = new HomeRoboticsOrchestrationSystem(createMockHomey());
    await sys.initialize();
    const robotId = sys.robots.keys().next().value;
    const robot = sys.robots.get(robotId);
    const zone = [...sys.cleaningZones.entries()].find(([_k, z]) => z.allowedRobots.includes(robot.type));
    if (zone) {
      sys.setZoneOccupancy(zone[0], true, ['person']);
      const result = await sys.startOccupancyAwareCleaning(robotId, zone[0]);
      assertEqual(result.success, false);
    }
    cleanup(sys);
  });

  it('completeCleaningSession finishes session', async () => {
    const sys = new HomeRoboticsOrchestrationSystem(createMockHomey());
    await sys.initialize();
    const robotId = sys.robots.keys().next().value;
    const robot = sys.robots.get(robotId);
    const zone = [...sys.cleaningZones.entries()].find(([_k, z]) => z.allowedRobots.includes(robot.type));
    if (zone) {
      await sys.startOccupancyAwareCleaning(robotId, zone[0]);
      const result = sys.completeCleaningSession(robotId);
      assertEqual(result, true);
    }
    cleanup(sys);
  });
});

describe('HomeRoboticsOrchestrationSystem — charging', () => {
  it('registerChargingStation adds a station', async () => {
    const sys = new HomeRoboticsOrchestrationSystem(createMockHomey());
    await sys.initialize();
    sys.registerChargingStation('dock1', {
      location: 'hallway', maxRobots: 2, chargeRatePerMinute: 1,
      compatibleTypes: ['vacuum_robot']
    });
    assert(sys.chargingStations.has('dock1'), 'should have station');
    cleanup(sys);
  });

  it('queueForCharging queues a robot', async () => {
    const sys = new HomeRoboticsOrchestrationSystem(createMockHomey());
    await sys.initialize();
    sys.registerChargingStation('dock1', {
      location: 'hallway', maxRobots: 1, chargeRatePerMinute: 1,
      compatibleTypes: ['vacuum_robot']
    });
    const robotId = [...sys.robots.entries()].find(([_k, r]) => r.type === 'vacuum_robot');
    if (robotId) {
      const result = sys.queueForCharging(robotId[0]);
      assertEqual(result, true);
    }
    cleanup(sys);
  });
});

describe('HomeRoboticsOrchestrationSystem — zones & pets', () => {
  it('setZoneOccupancy updates zone', async () => {
    const sys = new HomeRoboticsOrchestrationSystem(createMockHomey());
    await sys.initialize();
    const zoneId = sys.cleaningZones.keys().next().value;
    const result = sys.setZoneOccupancy(zoneId, true, ['person1']);
    assertEqual(result, true);
    assertEqual(sys.isZoneOccupied(zoneId), true);
    cleanup(sys);
  });

  it('setPetZone tracks pet location', async () => {
    const sys = new HomeRoboticsOrchestrationSystem(createMockHomey());
    await sys.initialize();
    const zoneId = sys.cleaningZones.keys().next().value;
    const result = sys.setPetZone(zoneId, true, { name: 'Luna', type: 'cat' });
    assertEqual(result, true);
    const zones = sys.getZonesWithPets();
    assert(zones.length >= 1, 'should have pet zone');
    cleanup(sys);
  });
});

describe('HomeRoboticsOrchestrationSystem — maintenance & health', () => {
  it('getMaintenanceStatus returns components', async () => {
    const sys = new HomeRoboticsOrchestrationSystem(createMockHomey());
    await sys.initialize();
    const robotId = sys.robots.keys().next().value;
    const status = sys.getMaintenanceStatus(robotId);
    assert(status, 'should return status');
    assert(status.components, 'should have components');
    cleanup(sys);
  });

  it('getRobotHealth returns health score', async () => {
    const sys = new HomeRoboticsOrchestrationSystem(createMockHomey());
    await sys.initialize();
    const robotId = sys.robots.keys().next().value;
    const health = sys.getRobotHealth(robotId);
    assert(health, 'should return health');
    assertType(health.overallHealth, 'number');
    cleanup(sys);
  });

  it('logRobotError records error', async () => {
    const sys = new HomeRoboticsOrchestrationSystem(createMockHomey());
    await sys.initialize();
    const robotId = sys.robots.keys().next().value;
    const result = sys.logRobotError(robotId, 'Brush stuck');
    assertEqual(result, true);
    cleanup(sys);
  });

  it('resetRobotErrors clears error log', async () => {
    const sys = new HomeRoboticsOrchestrationSystem(createMockHomey());
    await sys.initialize();
    const robotId = sys.robots.keys().next().value;
    sys.logRobotError(robotId, 'Test error');
    sys.resetRobotErrors(robotId);
    const robot = sys.robots.get(robotId);
    assertEqual(robot.errorLog.length, 0);
    cleanup(sys);
  });
});

describe('HomeRoboticsOrchestrationSystem — commands & reports', () => {
  it('routeCommand parses natural language', async () => {
    const sys = new HomeRoboticsOrchestrationSystem(createMockHomey());
    await sys.initialize();
    const result = sys.routeCommand('start vacuum in kitchen');
    assert(result, 'should return result');
    cleanup(sys);
  });

  it('routeCommand rejects invalid input', async () => {
    const sys = new HomeRoboticsOrchestrationSystem(createMockHomey());
    await sys.initialize();
    const result = sys.routeCommand('');
    assertEqual(result.success, false);
    cleanup(sys);
  });

  it('getCoverageReport returns report', async () => {
    const sys = new HomeRoboticsOrchestrationSystem(createMockHomey());
    await sys.initialize();
    const report = sys.getCoverageReport({});
    assert(report, 'should return report');
    assert(report.zones, 'should have zones');
    cleanup(sys);
  });

  it('getRobotList returns all robots', async () => {
    const sys = new HomeRoboticsOrchestrationSystem(createMockHomey());
    await sys.initialize();
    const list = sys.getRobotList();
    assert(Array.isArray(list), 'should be array');
    assert(list.length > 0, 'should have robots');
    cleanup(sys);
  });

  it('getFleetBatteryOverview returns overview', async () => {
    const sys = new HomeRoboticsOrchestrationSystem(createMockHomey());
    await sys.initialize();
    const overview = sys.getFleetBatteryOverview();
    assert(overview, 'should return overview');
    assertType(overview.averageBattery, 'number');
    cleanup(sys);
  });

  it('getStatistics returns stats', async () => {
    const sys = new HomeRoboticsOrchestrationSystem(createMockHomey());
    await sys.initialize();
    const stats = sys.getStatistics();
    assertType(stats.totalRobots, 'number');
    assert(stats.totalRobots > 0, 'should have robots');
    assertType(stats.totalZones, 'number');
    cleanup(sys);
  });

  it('getSystemHealth returns health info', async () => {
    const sys = new HomeRoboticsOrchestrationSystem(createMockHomey());
    await sys.initialize();
    const health = sys.getSystemHealth();
    assert(health, 'should return health');
    assertEqual(health.initialized, true);
    assertType(health.fleetHealth, 'number');
    cleanup(sys);
  });

  it('setRobotSpeed changes speed', async () => {
    const sys = new HomeRoboticsOrchestrationSystem(createMockHomey());
    await sys.initialize();
    const robotId = sys.robots.keys().next().value;
    const result = sys.setRobotSpeed(robotId, 'slow');
    assertEqual(result, true);
    assertEqual(sys.robots.get(robotId).speed, 'slow');
    cleanup(sys);
  });
});

run();
