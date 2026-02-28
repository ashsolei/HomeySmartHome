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

const HomeCleaningAutomationSystem = require('../lib/HomeCleaningAutomationSystem');

describe('Cleaning — constructor & lifecycle', () => {
  it('instantiates without errors', () => {
    const sys = new HomeCleaningAutomationSystem(createMockHomey());
    assert(sys, 'should create instance');
    cleanup(sys);
  });

  it('constructor sets default state', () => {
    const sys = new HomeCleaningAutomationSystem(createMockHomey());
    assertEqual(sys.initialized, false);
    assert(sys.robots['vacuum-main'], 'should have vacuum-main');
    assert(sys.robots['vacuum-upstairs'], 'should have vacuum-upstairs');
    assert(sys.robots['mop-robot'], 'should have mop-robot');
    assert(sys.rooms, 'should have rooms');
    assert(sys.supplies, 'should have supplies');
    cleanup(sys);
  });

  it('initialize sets initialized flag', async () => {
    const sys = new HomeCleaningAutomationSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.initialized, true);
    cleanup(sys);
  });

  it('destroy clears intervals', async () => {
    const sys = new HomeCleaningAutomationSystem(createMockHomey());
    await sys.initialize();
    sys.destroy();
    assertEqual(sys.intervals.length, 0);
    cleanup(sys);
  });
});

describe('Cleaning — robot status', () => {
  it('getRobotStatus returns status for specific robot', async () => {
    const sys = new HomeCleaningAutomationSystem(createMockHomey());
    await sys.initialize();
    const status = sys.getRobotStatus('vacuum-main');
    assert(status, 'should return status');
    assertEqual(status.id, 'vacuum-main');
    assertType(status.batteryLevel, 'number');
    assertType(status.status, 'string');
    cleanup(sys);
  });

  it('getRobotStatus returns null for unknown robot', async () => {
    const sys = new HomeCleaningAutomationSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.getRobotStatus('nonexistent'), null);
    cleanup(sys);
  });

  it('getRobotStatus returns all robots when no id', async () => {
    const sys = new HomeCleaningAutomationSystem(createMockHomey());
    await sys.initialize();
    const all = sys.getRobotStatus();
    assert(all['vacuum-main'], 'should have vacuum-main');
    assert(all['vacuum-upstairs'], 'should have vacuum-upstairs');
    cleanup(sys);
  });
});

describe('Cleaning — room status', () => {
  it('getRoomStatus returns status for specific room', async () => {
    const sys = new HomeCleaningAutomationSystem(createMockHomey());
    await sys.initialize();
    const status = sys.getRoomStatus('kitchen');
    assert(status, 'should return status');
    assertType(status.soilLevel, 'number');
    cleanup(sys);
  });

  it('getRoomStatus returns null for unknown room', async () => {
    const sys = new HomeCleaningAutomationSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.getRoomStatus('nonexistent'), null);
    cleanup(sys);
  });

  it('getRoomStatus returns all rooms when no id', async () => {
    const sys = new HomeCleaningAutomationSystem(createMockHomey());
    await sys.initialize();
    const all = sys.getRoomStatus();
    assert(all['kitchen'], 'should have kitchen');
    assert(all['living-room'], 'should have living-room');
    cleanup(sys);
  });
});

describe('Cleaning — spot cleaning & triggers', () => {
  it('startSpotCleaning starts cleaning for a room', async () => {
    const sys = new HomeCleaningAutomationSystem(createMockHomey());
    await sys.initialize();
    const result = sys.startSpotCleaning('kitchen', 'spill');
    assertType(result.success, 'boolean');
    cleanup(sys);
  });

  it('startSpotCleaning fails for unknown room', async () => {
    const sys = new HomeCleaningAutomationSystem(createMockHomey());
    await sys.initialize();
    const result = sys.startSpotCleaning('nonexistent', 'spill');
    assertEqual(result.success, false);
    cleanup(sys);
  });

  it('triggerPostCookingCleanup triggers kitchen cleanup', async () => {
    const sys = new HomeCleaningAutomationSystem(createMockHomey());
    await sys.initialize();
    const result = sys.triggerPostCookingCleanup();
    assertType(result.success, 'boolean');
    cleanup(sys);
  });

  it('triggerSpillCleanup triggers cleanup for a room', async () => {
    const sys = new HomeCleaningAutomationSystem(createMockHomey());
    await sys.initialize();
    const result = sys.triggerSpillCleanup('living-room');
    assertType(result.success, 'boolean');
    cleanup(sys);
  });
});

describe('Cleaning — modes', () => {
  it('enablePetMode enables pet mode', async () => {
    const sys = new HomeCleaningAutomationSystem(createMockHomey());
    await sys.initialize();
    sys.enablePetMode();
    assertEqual(sys.schedule.petMode, true);
    cleanup(sys);
  });

  it('disablePetMode disables pet mode', async () => {
    const sys = new HomeCleaningAutomationSystem(createMockHomey());
    await sys.initialize();
    sys.enablePetMode();
    sys.disablePetMode();
    assertEqual(sys.schedule.petMode, false);
    cleanup(sys);
  });

  it('enableAllergyMode enables allergy mode', async () => {
    const sys = new HomeCleaningAutomationSystem(createMockHomey());
    await sys.initialize();
    sys.enableAllergyMode();
    assertEqual(sys.schedule.allergyMode, true);
    cleanup(sys);
  });

  it('disableAllergyMode disables allergy mode', async () => {
    const sys = new HomeCleaningAutomationSystem(createMockHomey());
    await sys.initialize();
    sys.enableAllergyMode();
    sys.disableAllergyMode();
    assertEqual(sys.schedule.allergyMode, false);
    cleanup(sys);
  });

  it('enableGuestMode enables guest mode', async () => {
    const sys = new HomeCleaningAutomationSystem(createMockHomey());
    await sys.initialize();
    sys.enableGuestMode();
    assertEqual(sys.schedule.guestMode, true);
    cleanup(sys);
  });

  it('setSeasonalMode sets valid modes', async () => {
    const sys = new HomeCleaningAutomationSystem(createMockHomey());
    await sys.initialize();
    const result = sys.setSeasonalMode('pollen');
    assertEqual(result.success, true);
    assertEqual(sys.schedule.seasonalMode, 'pollen');
    cleanup(sys);
  });

  it('setSeasonalMode rejects invalid mode', async () => {
    const sys = new HomeCleaningAutomationSystem(createMockHomey());
    await sys.initialize();
    const result = sys.setSeasonalMode('invalid');
    assertEqual(result.success, false);
    cleanup(sys);
  });

  it('setOccupancy updates occupancy flag', async () => {
    const sys = new HomeCleaningAutomationSystem(createMockHomey());
    await sys.initialize();
    sys.setOccupancy(false);
    assertEqual(sys.schedule.currentOccupancy, false);
    cleanup(sys);
  });
});

describe('Cleaning — supplies & maintenance', () => {
  it('getSupplyStatus returns status', async () => {
    const sys = new HomeCleaningAutomationSystem(createMockHomey());
    await sys.initialize();
    const status = sys.getSupplyStatus();
    assert(Array.isArray(status), 'should be array');
    assert(status.length > 0, 'should have supplies');
    cleanup(sys);
  });

  it('replaceSupply updates supply stock', async () => {
    const sys = new HomeCleaningAutomationSystem(createMockHomey());
    await sys.initialize();
    const supplyKeys = Object.keys(sys.supplies);
    const result = sys.replaceSupply(supplyKeys[0], 5);
    assertEqual(result.success, true);
    cleanup(sys);
  });

  it('replaceSupply fails for unknown supply', async () => {
    const sys = new HomeCleaningAutomationSystem(createMockHomey());
    await sys.initialize();
    const result = sys.replaceSupply('nonexistent', 5);
    assertEqual(result.success, false);
    cleanup(sys);
  });

  it('performMaintenance updates robot', async () => {
    const sys = new HomeCleaningAutomationSystem(createMockHomey());
    await sys.initialize();
    const result = sys.performMaintenance('vacuum-main', 'filter-replacement');
    assertEqual(result.success, true);
    assertEqual(sys.robots['vacuum-main'].filterHealth, 100);
    cleanup(sys);
  });

  it('performMaintenance fails for unknown robot', async () => {
    const sys = new HomeCleaningAutomationSystem(createMockHomey());
    await sys.initialize();
    const result = sys.performMaintenance('nonexistent', 'filter-replacement');
    assertEqual(result.success, false);
    cleanup(sys);
  });
});

describe('Cleaning — reports & analytics', () => {
  it('getCleaningHistory returns array', async () => {
    const sys = new HomeCleaningAutomationSystem(createMockHomey());
    await sys.initialize();
    const history = sys.getCleaningHistory(null, 10);
    assert(Array.isArray(history), 'should be array');
    cleanup(sys);
  });

  it('getEnergyReport returns report', async () => {
    const sys = new HomeCleaningAutomationSystem(createMockHomey());
    await sys.initialize();
    const report = sys.getEnergyReport();
    assert(report, 'should return report');
    cleanup(sys);
  });

  it('getDeepCleaningStatus returns status', async () => {
    const sys = new HomeCleaningAutomationSystem(createMockHomey());
    await sys.initialize();
    const status = sys.getDeepCleaningStatus();
    assert(status, 'should return status');
    cleanup(sys);
  });

  it('getMaintenanceReport returns report', async () => {
    const sys = new HomeCleaningAutomationSystem(createMockHomey());
    await sys.initialize();
    const report = sys.getMaintenanceReport();
    assert(report, 'should return report');
    cleanup(sys);
  });

  it('getScheduleConfig returns config', async () => {
    const sys = new HomeCleaningAutomationSystem(createMockHomey());
    await sys.initialize();
    const config = sys.getScheduleConfig();
    assert(config.preferredStartTime, 'should have start time');
    assert(config.preferredEndTime, 'should have end time');
    cleanup(sys);
  });

  it('getNoiseStatus returns noise info', async () => {
    const sys = new HomeCleaningAutomationSystem(createMockHomey());
    await sys.initialize();
    const status = sys.getNoiseStatus();
    assertType(status.currentMode, 'string');
    cleanup(sys);
  });

  it('getWeeklyReport returns report', async () => {
    const sys = new HomeCleaningAutomationSystem(createMockHomey());
    await sys.initialize();
    const report = sys.getWeeklyReport();
    assert(report, 'should return report');
    cleanup(sys);
  });

  it('getStatistics returns comprehensive stats', async () => {
    const sys = new HomeCleaningAutomationSystem(createMockHomey());
    await sys.initialize();
    const stats = sys.getStatistics();
    assert(stats, 'should return stats');
    assertType(stats.totalRobots, 'number');
    assertType(stats.totalRooms, 'number');
    cleanup(sys);
  });
});

describe('Cleaning — deep cleaning', () => {
  it('startDeepCleaning starts monthly deep clean', async () => {
    const sys = new HomeCleaningAutomationSystem(createMockHomey());
    await sys.initialize();
    const result = sys.startDeepCleaning('monthly');
    assertEqual(result.success, true);
    cleanup(sys);
  });

  it('startDeepCleaning fails for invalid type', async () => {
    const sys = new HomeCleaningAutomationSystem(createMockHomey());
    await sys.initialize();
    const result = sys.startDeepCleaning('invalid');
    assertEqual(result.success, false);
    cleanup(sys);
  });

  it('completeDeepTask marks a task complete', async () => {
    const sys = new HomeCleaningAutomationSystem(createMockHomey());
    await sys.initialize();
    sys.startDeepCleaning('monthly');
    const result = sys.completeDeepTask('monthly', 'deep-vacuum-all');
    assertEqual(result.success, true);
    cleanup(sys);
  });
});

describe('Cleaning — robot control', () => {
  it('pauseAllRobots pauses active robots', async () => {
    const sys = new HomeCleaningAutomationSystem(createMockHomey());
    await sys.initialize();
    const result = sys.pauseAllRobots();
    assert(result, 'should return result');
    cleanup(sys);
  });

  it('cancelAllJobs cancels jobs', async () => {
    const sys = new HomeCleaningAutomationSystem(createMockHomey());
    await sys.initialize();
    const result = sys.cancelAllJobs();
    assert(result, 'should return result');
    cleanup(sys);
  });

  it('updateScheduleConfig updates config', async () => {
    const sys = new HomeCleaningAutomationSystem(createMockHomey());
    await sys.initialize();
    sys.updateScheduleConfig({ preferredStartTime: '09:00' });
    assertEqual(sys.schedule.preferredStartTime, '09:00');
    cleanup(sys);
  });

  it('clearRobotError clears error status', async () => {
    const sys = new HomeCleaningAutomationSystem(createMockHomey());
    await sys.initialize();
    sys.robots['vacuum-main'].status = 'error';
    const result = sys.clearRobotError('vacuum-main');
    assertEqual(result.success, true);
    assertEqual(sys.robots['vacuum-main'].status, 'docked');
    cleanup(sys);
  });

  it('clearRobotError fails for unknown robot', async () => {
    const sys = new HomeCleaningAutomationSystem(createMockHomey());
    await sys.initialize();
    const result = sys.clearRobotError('nonexistent');
    assertEqual(result.success, false);
    cleanup(sys);
  });
});

run();
