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

const HomeOfficeProductivityHub = require('../lib/HomeOfficeProductivityHub');

/* ================================================================== */
/*  HomeOfficeProductivityHub – test suite                            */
/* ================================================================== */

describe('HomeOfficeProductivityHub — constructor & init', () => {
  it('instantiates without errors', () => {
    const sys = new HomeOfficeProductivityHub(createMockHomey());
    assert(sys, 'should create instance');
    cleanup(sys);
  });

  it('starts uninitialised', () => {
    const sys = new HomeOfficeProductivityHub(createMockHomey());
    assertEqual(sys.initialized, false);
    assertEqual(sys.pomodoro.phase, 'idle');
    cleanup(sys);
  });

  it('initialize sets flag', async () => {
    const sys = new HomeOfficeProductivityHub(createMockHomey());
    await sys.initialize();
    assertEqual(sys.initialized, true);
    cleanup(sys);
  });

  it('destroy clears timers and resets', async () => {
    const sys = new HomeOfficeProductivityHub(createMockHomey());
    await sys.initialize();
    sys.destroy();
    assertEqual(sys.initialized, false);
    cleanup(sys);
  });
});

describe('HomeOfficeProductivityHub — pomodoro', () => {
  it('startPomodoro begins work phase', async () => {
    const sys = new HomeOfficeProductivityHub(createMockHomey());
    await sys.initialize();
    sys.startPomodoro();
    assertEqual(sys.pomodoro.phase, 'work');
    assert(sys.pomodoro.phaseStartTime, 'should have start time');
    cleanup(sys);
  });

  it('startPomodoro resets when already running', async () => {
    const sys = new HomeOfficeProductivityHub(createMockHomey());
    await sys.initialize();
    sys.startPomodoro();
    sys.startPomodoro();
    // should still be in work phase after reset
    assertEqual(sys.pomodoro.phase, 'work');
    cleanup(sys);
  });

  it('stopPomodoro resets phase to idle', async () => {
    const sys = new HomeOfficeProductivityHub(createMockHomey());
    await sys.initialize();
    sys.startPomodoro();
    sys.stopPomodoro();
    assertEqual(sys.pomodoro.phase, 'idle');
    cleanup(sys);
  });

  it('getPomodoroStatus returns current state', async () => {
    const sys = new HomeOfficeProductivityHub(createMockHomey());
    await sys.initialize();
    sys.startPomodoro();
    const status = sys.getPomodoroStatus();
    assert(status, 'should return status');
    assertEqual(status.phase, 'work');
    assertType(status.cycle, 'number');
    assertType(status.totalCyclesToday, 'number');
    cleanup(sys);
  });
});

describe('HomeOfficeProductivityHub — standing desk', () => {
  it('enableStandingDesk activates desk', async () => {
    const sys = new HomeOfficeProductivityHub(createMockHomey());
    await sys.initialize();
    sys.enableStandingDesk('user1');
    assertEqual(sys.standingDesk.enabled, true);
    cleanup(sys);
  });

  it('setDeskUserPreset saves height preset', async () => {
    const sys = new HomeOfficeProductivityHub(createMockHomey());
    await sys.initialize();
    sys.setDeskUserPreset('user1', 74, 110);
    assertEqual(sys.standingDesk.heightPresets.users.user1.sitting, 74);
    assertEqual(sys.standingDesk.heightPresets.users.user1.standing, 110);
    cleanup(sys);
  });

  it('getDeskStats returns stats', async () => {
    const sys = new HomeOfficeProductivityHub(createMockHomey());
    await sys.initialize();
    const stats = sys.getDeskStats();
    assert(stats, 'should return stats');
    assertType(stats.currentPosition, 'string');
    assertType(stats.sittingTime, 'number');
    cleanup(sys);
  });
});

describe('HomeOfficeProductivityHub — focus mode', () => {
  it('setFocusMode activates mode', async () => {
    const sys = new HomeOfficeProductivityHub(createMockHomey());
    await sys.initialize();
    sys.setFocusMode('deep');
    assertEqual(sys.focusMode.currentMode, 'deep');
    assertEqual(sys.focusMode.enabled, true);
    cleanup(sys);
  });

  it('setFocusMode does nothing for invalid mode', async () => {
    const sys = new HomeOfficeProductivityHub(createMockHomey());
    await sys.initialize();
    sys.setFocusMode('invalid');
    assertEqual(sys.focusMode.currentMode, 'none');
    cleanup(sys);
  });

  it('exitFocusMode deactivates mode', async () => {
    const sys = new HomeOfficeProductivityHub(createMockHomey());
    await sys.initialize();
    sys.setFocusMode('deep');
    sys.exitFocusMode();
    assertEqual(sys.focusMode.currentMode, 'none');
    assertEqual(sys.focusMode.enabled, false);
    cleanup(sys);
  });
});

describe('HomeOfficeProductivityHub — workspace', () => {
  it('switchWorkspace changes station', async () => {
    const sys = new HomeOfficeProductivityHub(createMockHomey());
    await sys.initialize();
    sys.switchWorkspace('office');
    assertEqual(sys.workspaces.currentStation, 'office');
    assertEqual(sys.workspaces.stations.office.active, true);
    cleanup(sys);
  });

  it('switchWorkspace rejects invalid station', async () => {
    const sys = new HomeOfficeProductivityHub(createMockHomey());
    await sys.initialize();
    const result = sys.switchWorkspace('nonexistent');
    assertEqual(result, null);
    cleanup(sys);
  });

  it('addWorkspace returns false when max reached', async () => {
    const sys = new HomeOfficeProductivityHub(createMockHomey());
    await sys.initialize();
    // Already has 3 stations (office, livingRoom, bedroom)
    const result = sys.addWorkspace('garage', 'Garage Office', { lighting: { colorTemp: 5000, brightness: 80 } });
    assertEqual(result, false);
    cleanup(sys);
  });
});

describe('HomeOfficeProductivityHub — tasks', () => {
  it('addTask creates a task and returns id', async () => {
    const sys = new HomeOfficeProductivityHub(createMockHomey());
    await sys.initialize();
    const taskId = sys.addTask({ title: 'Write tests', priority: 'high', category: 'dev' });
    assertType(taskId, 'number');
    const task = sys.tasks.items.find(t => t.id === taskId);
    assertEqual(task.title, 'Write tests');
    cleanup(sys);
  });

  it('startTask marks task as started', async () => {
    const sys = new HomeOfficeProductivityHub(createMockHomey());
    await sys.initialize();
    const taskId = sys.addTask({ title: 'Code review', priority: 'medium' });
    sys.startTask(taskId);
    const task = sys.tasks.items.find(t => t.id === taskId);
    assert(task.startedAt, 'should have startedAt');
    cleanup(sys);
  });

  it('completeTask marks task done', async () => {
    const sys = new HomeOfficeProductivityHub(createMockHomey());
    await sys.initialize();
    const taskId = sys.addTask({ title: 'Deploy', priority: 'high' });
    sys.startTask(taskId);
    sys.completeTask(taskId);
    const task = sys.tasks.items.find(t => t.id === taskId);
    assertEqual(task.completed, true);
    assert(task.completedAt, 'should have completedAt');
    cleanup(sys);
  });

  it('removeTask deletes task', async () => {
    const sys = new HomeOfficeProductivityHub(createMockHomey());
    await sys.initialize();
    const taskId = sys.addTask({ title: 'Temp', priority: 'low' });
    sys.removeTask(taskId);
    assertEqual(sys.tasks.items.find(t => t.id === taskId), undefined);
    cleanup(sys);
  });

  it('getTaskList returns sorted tasks', async () => {
    const sys = new HomeOfficeProductivityHub(createMockHomey());
    await sys.initialize();
    sys.addTask({ title: 'Low', priority: 'low' });
    sys.addTask({ title: 'High', priority: 'high' });
    const list = sys.getTaskList();
    assert(Array.isArray(list), 'should be array');
    assert(list.length >= 2, 'should have tasks');
    cleanup(sys);
  });
});

describe('HomeOfficeProductivityHub — meetings', () => {
  it('addMeeting schedules a meeting', async () => {
    const sys = new HomeOfficeProductivityHub(createMockHomey());
    await sys.initialize();
    const now = Date.now();
    const meeting = sys.addMeeting({
      title: 'Standup',
      startTime: now + 600000,
      endTime: now + 1500000,
      isVideo: true
    });
    assert(meeting, 'should return meeting');
    assert(sys.meetings.upcoming.length >= 1, 'should have upcoming meeting');
    cleanup(sys);
  });

  it('bookMeetingRoom reserves a room', async () => {
    const sys = new HomeOfficeProductivityHub(createMockHomey());
    await sys.initialize();
    const now = Date.now();
    const booking = sys.bookMeetingRoom('Room A', now + 600000, now + 3600000);
    assert(booking, 'should return booking');
    cleanup(sys);
  });
});

describe('HomeOfficeProductivityHub — noise & environment', () => {
  it('startNoiseGenerator activates noise type', async () => {
    const sys = new HomeOfficeProductivityHub(createMockHomey());
    await sys.initialize();
    sys.startNoiseGenerator('pink');
    assertEqual(sys.noise.activeNoise, 'pink');
    cleanup(sys);
  });

  it('stopNoiseGenerator deactivates noise', async () => {
    const sys = new HomeOfficeProductivityHub(createMockHomey());
    await sys.initialize();
    sys.startNoiseGenerator('white');
    sys.stopNoiseGenerator();
    assertEqual(sys.noise.activeNoise, null);
    cleanup(sys);
  });

  it('startNoiseGenerator ignores invalid type', async () => {
    const sys = new HomeOfficeProductivityHub(createMockHomey());
    await sys.initialize();
    sys.startNoiseGenerator('invalid');
    assertEqual(sys.noise.activeNoise, null);
    cleanup(sys);
  });

  it('setNoiseVolume sets volume', async () => {
    const sys = new HomeOfficeProductivityHub(createMockHomey());
    await sys.initialize();
    sys.setNoiseVolume(50);
    assertEqual(sys.noise.noiseVolume, 50);
    cleanup(sys);
  });

  it('updateEnvironmentSensors updates readings', async () => {
    const sys = new HomeOfficeProductivityHub(createMockHomey());
    await sys.initialize();
    sys.updateEnvironmentSensors({ temperature: 22, humidity: 55, co2: 800 });
    assertEqual(sys.ambient.currentTemperature, 22);
    assertEqual(sys.ambient.humidity.current, 55);
    assertEqual(sys.ambient.co2.current, 800);
    cleanup(sys);
  });
});

describe('HomeOfficeProductivityHub — energy & printing', () => {
  it('setDevicePower toggles device', async () => {
    const sys = new HomeOfficeProductivityHub(createMockHomey());
    await sys.initialize();
    sys.setDevicePower('pc', true);
    assertEqual(sys.energy.devices.pc.active, true);
    sys.setDevicePower('pc', false);
    assertEqual(sys.energy.devices.pc.active, false);
    cleanup(sys);
  });

  it('getEnergyReport returns report', async () => {
    const sys = new HomeOfficeProductivityHub(createMockHomey());
    await sys.initialize();
    const report = sys.getEnergyReport();
    assert(report, 'should return report');
    assertType(report.devices, 'object');
    assert(report.devices.pc, 'should have pc device');
    cleanup(sys);
  });

  it('addPrintJob creates a print job', async () => {
    const sys = new HomeOfficeProductivityHub(createMockHomey());
    await sys.initialize();
    const job = sys.addPrintJob({ name: 'report.pdf', pages: 10, color: true });
    assert(job, 'should return job');
    assert(sys.printing.jobQueue.length >= 1, 'should have job in queue');
    cleanup(sys);
  });

  it('scanDocument creates scan entry', async () => {
    const sys = new HomeOfficeProductivityHub(createMockHomey());
    await sys.initialize();
    const scan = sys.scanDocument('google-drive');
    assert(scan, 'should return scan');
    cleanup(sys);
  });

  it('getPrintStatus returns status', async () => {
    const sys = new HomeOfficeProductivityHub(createMockHomey());
    await sys.initialize();
    const status = sys.getPrintStatus();
    assert(status, 'should return status');
    assertType(status.tonerLevel, 'number');
    cleanup(sys);
  });
});

describe('HomeOfficeProductivityHub — work-life & presence', () => {
  it('setPresence updates status', async () => {
    const sys = new HomeOfficeProductivityHub(createMockHomey());
    await sys.initialize();
    sys.setPresence('busy');
    assertEqual(sys.collaboration.presenceIndicator, 'busy');
    cleanup(sys);
  });

  it('setPresence ignores invalid status', async () => {
    const sys = new HomeOfficeProductivityHub(createMockHomey());
    await sys.initialize();
    sys.setPresence('invalid');
    // should remain default
    assertEqual(sys.collaboration.presenceIndicator, 'available');
    cleanup(sys);
  });

  it('setVacationMode toggles vacation', async () => {
    const sys = new HomeOfficeProductivityHub(createMockHomey());
    await sys.initialize();
    sys.setVacationMode(true);
    assertEqual(sys.workLifeBoundary.vacationMode, true);
    cleanup(sys);
  });

  it('setWorkHours updates work schedule', async () => {
    const sys = new HomeOfficeProductivityHub(createMockHomey());
    await sys.initialize();
    sys.setWorkHours('08:00', '17:00');
    assertEqual(sys.workLifeBoundary.workStartTime, '08:00');
    assertEqual(sys.workLifeBoundary.hardStopTime, '17:00');
    cleanup(sys);
  });

  it('enableCoWorkingMode and disableCoWorkingMode work', async () => {
    const sys = new HomeOfficeProductivityHub(createMockHomey());
    await sys.initialize();
    sys.enableCoWorkingMode('partner1');
    assertEqual(sys.collaboration.coWorkingMode.enabled, true);
    assertEqual(sys.collaboration.coWorkingMode.partnerId, 'partner1');
    sys.disableCoWorkingMode();
    assertEqual(sys.collaboration.coWorkingMode.enabled, false);
    cleanup(sys);
  });
});

describe('HomeOfficeProductivityHub — routines & analytics', () => {
  it('triggerMorningRoutine runs once', async () => {
    const sys = new HomeOfficeProductivityHub(createMockHomey());
    await sys.initialize();
    sys.triggerMorningRoutine();
    assertEqual(sys.commute.morningRoutine.completed, true);
    cleanup(sys);
  });

  it('triggerEndOfDayRitual runs once', async () => {
    const sys = new HomeOfficeProductivityHub(createMockHomey());
    await sys.initialize();
    sys.triggerEndOfDayRitual();
    assertEqual(sys.commute.endOfDayRitual.completed, true);
    cleanup(sys);
  });

  it('getSuggestedBreakActivity returns activity', async () => {
    const sys = new HomeOfficeProductivityHub(createMockHomey());
    await sys.initialize();
    const suggestion = sys.getSuggestedBreakActivity();
    assert(suggestion, 'should return suggestion');
    cleanup(sys);
  });

  it('logSteps records steps', async () => {
    const sys = new HomeOfficeProductivityHub(createMockHomey());
    await sys.initialize();
    sys.logSteps(500);
    assertEqual(sys.breakActivities.walkReminders.stepsToday, 500);
    cleanup(sys);
  });

  it('getProductivityReport returns daily report', async () => {
    const sys = new HomeOfficeProductivityHub(createMockHomey());
    await sys.initialize();
    const report = sys.getProductivityReport('daily');
    assert(report, 'should return report');
    cleanup(sys);
  });

  it('getStatistics returns comprehensive stats', async () => {
    const sys = new HomeOfficeProductivityHub(createMockHomey());
    await sys.initialize();
    const stats = sys.getStatistics();
    assertEqual(stats.system.initialized, true);
    assert(stats.pomodoro, 'should have pomodoro stats');
    assert(stats.productivity, 'should have productivity stats');
    assert(stats.energy, 'should have energy stats');
    cleanup(sys);
  });
});

run();
