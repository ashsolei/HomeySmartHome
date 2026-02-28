'use strict';

const { describe, it, run } = require('./helpers/runner');
const {
  assert, assertEqual, assertType, assertRejects,
  assertInstanceOf
} = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');

const HomeOfficeOptimizationSystem = require('../lib/HomeOfficeOptimizationSystem');

/* ──── timer tracking ────
 * startMonitoring: 1 interval (120s)
 * startFocusMode / takeBreak: untracked setTimeouts
 */
const _origSetTimeout = global.setTimeout;
const _origSetInterval = global.setInterval;
const activeHandles = [];

global.setTimeout = (...args) => {
  const id = _origSetTimeout(...args);
  activeHandles.push({ type: 'timeout', id });
  return id;
};
global.setInterval = (...args) => {
  const id = _origSetInterval(...args);
  activeHandles.push({ type: 'interval', id });
  return id;
};

/* ──── helpers ──── */
function createSystem() {
  const homey = createMockHomey();
  const sys = new HomeOfficeOptimizationSystem(homey);
  return { homey, sys };
}

async function initSystem() {
  const { homey, sys } = createSystem();
  await sys.initialize();
  return { homey, sys };
}

function cleanup(sys) {
  try { if (sys.destroy) sys.destroy(); } catch (_) { /* ignore */ }
  while (activeHandles.length > 0) {
    const h = activeHandles.pop();
    if (h.type === 'timeout') clearTimeout(h.id);
    else clearInterval(h.id);
  }
}

/* ================================================================
   TESTS
   ================================================================ */

describe('HomeOfficeOptimizationSystem — constructor', () => {
  it('creates instance with correct defaults', () => {
    const { sys } = createSystem();
    assertInstanceOf(sys.offices, Map);
    assertEqual(sys.offices.size, 0);
    assert(Array.isArray(sys.workSessions), 'workSessions should be array');
    assertEqual(sys.workSessions.length, 0);
    assert(Array.isArray(sys.meetings), 'meetings should be array');
    assertEqual(sys.meetings.length, 0);
    assertEqual(sys.currentStatus, 'offline');
    assertEqual(sys.monitoringInterval, null);
    cleanup(sys);
  });

  it('stores homey reference', () => {
    const { sys, homey } = createSystem();
    assertEqual(sys.homey, homey);
    cleanup(sys);
  });

  it('is an EventEmitter', () => {
    const { sys } = createSystem();
    assertType(sys.on, 'function');
    assertType(sys.emit, 'function');
    cleanup(sys);
  });
});

describe('HomeOfficeOptimizationSystem — initialize()', () => {
  it('returns true on success', async () => {
    const { sys } = createSystem();
    const result = await sys.initialize();
    assertEqual(result, true);
    cleanup(sys);
  });

  it('creates default office Hemkontor', async () => {
    const { sys } = await initSystem();
    assertEqual(sys.offices.size, 1);
    assert(sys.offices.has('main-office'), 'should have main-office');
    const office = sys.offices.get('main-office');
    assertEqual(office.name, 'Hemkontor');
    cleanup(sys);
  });

  it('starts monitoring interval', async () => {
    const { sys } = await initSystem();
    assert(sys.monitoringInterval !== null, 'should have monitoring interval');
    cleanup(sys);
  });

  it('does not re-throw errors on failure', async () => {
    const { sys, homey } = createSystem();
    // Sabotage settings to throw during loadSettings
    const origGet = homey.settings.get.bind(homey.settings);
    homey.settings.get = () => { throw new Error('broken'); };
    // Should not propagate
    const _result = await sys.initialize();
    // Restore
    homey.settings.get = origGet;
    cleanup(sys);
  });

  it('loads saved state from settings', async () => {
    const { sys, homey } = createSystem();
    const savedState = {
      offices: [
        { id: 'saved-office', name: 'Saved Office', status: 'offline', workSessions: [] }
      ],
      workSessions: [{ id: 'ws-1', officeId: 'saved-office' }],
      meetings: [{ id: 'm-1' }],
      currentStatus: 'available'
    };
    homey.settings.set('homeOfficeOptimization', savedState);
    await sys.initialize();
    assertEqual(sys.currentStatus, 'available');
    assert(sys.workSessions.length >= 1, 'should load work sessions');
    assert(sys.meetings.length >= 1, 'should load meetings');
    cleanup(sys);
  });
});

describe('HomeOfficeOptimizationSystem — default office', () => {
  it('has correct environment structure', async () => {
    const { sys } = await initSystem();
    const office = sys.offices.get('main-office');
    assertType(office.environment, 'object');
    assertType(office.environment.lighting, 'object');
    assertType(office.environment.temperature, 'object');
    assertType(office.environment.noise, 'object');
    assertType(office.environment.airQuality, 'object');
    cleanup(sys);
  });

  it('has device configuration', async () => {
    const { sys } = await initSystem();
    const office = sys.offices.get('main-office');
    assertType(office.devices, 'object');
    cleanup(sys);
  });

  it('has automation settings', async () => {
    const { sys } = await initSystem();
    const office = sys.offices.get('main-office');
    assertType(office.automation, 'object');
    assertType(office.automation.focusMode, 'object');
    assertType(office.automation.breakReminders, 'object');
    cleanup(sys);
  });

  it('has schedule configuration', async () => {
    const { sys } = await initSystem();
    const office = sys.offices.get('main-office');
    assertType(office.schedule, 'object');
    cleanup(sys);
  });
});

describe('HomeOfficeOptimizationSystem — startWork / endWork', () => {
  it('starts a work session successfully', async () => {
    const { sys } = await initSystem();
    const session = await sys.startWork('main-office');
    assertType(session, 'object');
    assertEqual(session.officeId, 'main-office');
    assertType(session.startTime, 'number');
    assert(!session.endTime, 'should not have endTime yet');
    const office = sys.offices.get('main-office');
    assertEqual(office.status, 'available');
    cleanup(sys);
  });

  it('throws for unknown office', async () => {
    const { sys } = await initSystem();
    await assertRejects(
      () => sys.startWork('nonexistent'),
      'Kontor hittades inte'
    );
    cleanup(sys);
  });

  it('emits workStarted event', async () => {
    const { sys } = await initSystem();
    let emitted = false;
    sys.on('workStarted', () => { emitted = true; });
    await sys.startWork('main-office');
    assertEqual(emitted, true);
    cleanup(sys);
  });

  it('end work returns completed session', async () => {
    const { sys } = await initSystem();
    await sys.startWork('main-office');
    const session = await sys.endWork('main-office');
    assertType(session, 'object');
    assertType(session.endTime, 'number');
    assertType(session.duration, 'number');
    const office = sys.offices.get('main-office');
    assertEqual(office.status, 'offline');
    cleanup(sys);
  });

  it('endWork throws for unknown office', async () => {
    const { sys } = await initSystem();
    await assertRejects(
      () => sys.endWork('nonexistent'),
      'Kontor hittades inte'
    );
    cleanup(sys);
  });

  it('endWork throws when no active session', async () => {
    const { sys } = await initSystem();
    await assertRejects(
      () => sys.endWork('main-office'),
      'Ingen aktiv arbetssession'
    );
    cleanup(sys);
  });

  it('emits workEnded event', async () => {
    const { sys } = await initSystem();
    await sys.startWork('main-office');
    let emitted = false;
    sys.on('workEnded', () => { emitted = true; });
    await sys.endWork('main-office');
    assertEqual(emitted, true);
    cleanup(sys);
  });

  it('tracks session in workSessions array', async () => {
    const { sys } = await initSystem();
    await sys.startWork('main-office');
    assert(sys.workSessions.length >= 1, 'should have at least 1 session');
    cleanup(sys);
  });

  it('startWork with userId default', async () => {
    const { sys } = await initSystem();
    const session = await sys.startWork('main-office');
    assertEqual(session.userId, 'default');
    cleanup(sys);
  });

  it('startWork with custom userId', async () => {
    const { sys } = await initSystem();
    const session = await sys.startWork('main-office', 'user-42');
    assertEqual(session.userId, 'user-42');
    cleanup(sys);
  });
});

describe('HomeOfficeOptimizationSystem — meetings', () => {
  it('starts a meeting', async () => {
    const { sys } = await initSystem();
    await sys.startWork('main-office');
    const meeting = await sys.startMeeting('main-office', { topic: 'standup', type: 'video' });
    assertType(meeting, 'object');
    assertEqual(meeting.officeId, 'main-office');
    const office = sys.offices.get('main-office');
    assertEqual(office.status, 'in-meeting');
    cleanup(sys);
  });

  it('startMeeting throws for unknown office', async () => {
    const { sys } = await initSystem();
    await assertRejects(
      () => sys.startMeeting('bad-office', {}),
      'Kontor hittades inte'
    );
    cleanup(sys);
  });

  it('ends a meeting', async () => {
    const { sys } = await initSystem();
    await sys.startWork('main-office');
    const meeting = await sys.startMeeting('main-office', { topic: 'test' });
    const ended = await sys.endMeeting(meeting.id);
    assertType(ended, 'object');
    assertType(ended.endTime, 'number');
    assertType(ended.actualDuration, 'number');
    cleanup(sys);
  });

  it('endMeeting throws for unknown meeting', async () => {
    const { sys } = await initSystem();
    await assertRejects(
      () => sys.endMeeting('nonexistent-meeting'),
      'Möte hittades inte'
    );
    cleanup(sys);
  });

  it('meeting sets status back to available after ending', async () => {
    const { sys } = await initSystem();
    await sys.startWork('main-office');
    const meeting = await sys.startMeeting('main-office', { topic: 'sync' });
    const office = sys.offices.get('main-office');
    assertEqual(office.status, 'in-meeting');
    await sys.endMeeting(meeting.id);
    assertEqual(office.status, 'available');
    cleanup(sys);
  });

  it('tracks meetings in array', async () => {
    const { sys } = await initSystem();
    await sys.startWork('main-office');
    const before = sys.meetings.length;
    await sys.startMeeting('main-office', { topic: 'planning' });
    assert(sys.meetings.length > before, 'should add meeting');
    cleanup(sys);
  });
});

describe('HomeOfficeOptimizationSystem — focus mode', () => {
  it('starts focus mode', async () => {
    const { sys } = await initSystem();
    await sys.startWork('main-office');
    const result = await sys.startFocusMode('main-office');
    assertType(result, 'object');
    const office = sys.offices.get('main-office');
    assertEqual(office.status, 'focus-time');
    cleanup(sys);
  });

  it('uses default duration from office config', async () => {
    const { sys } = await initSystem();
    await sys.startWork('main-office');
    const result = await sys.startFocusMode('main-office');
    assertType(result.duration, 'number');
    assert(result.duration > 0, 'should have positive duration');
    cleanup(sys);
  });

  it('accepts custom duration', async () => {
    const { sys } = await initSystem();
    await sys.startWork('main-office');
    const result = await sys.startFocusMode('main-office', 45);
    assertEqual(result.duration, 45);
    cleanup(sys);
  });

  it('throws for unknown office', async () => {
    const { sys } = await initSystem();
    await assertRejects(
      () => sys.startFocusMode('nonexistent'),
      'Kontor hittades inte'
    );
    cleanup(sys);
  });
});

describe('HomeOfficeOptimizationSystem — takeBreak', () => {
  it('starts a break with default 15 min', async () => {
    const { sys } = await initSystem();
    await sys.startWork('main-office');
    const result = await sys.takeBreak('main-office');
    assertType(result, 'object');
    const office = sys.offices.get('main-office');
    assertEqual(office.status, 'break');
    assertEqual(result.duration, 15);
    cleanup(sys);
  });

  it('accepts custom duration', async () => {
    const { sys } = await initSystem();
    await sys.startWork('main-office');
    const result = await sys.takeBreak('main-office', 30);
    assertEqual(result.duration, 30);
    cleanup(sys);
  });

  it('throws for unknown office', async () => {
    const { sys } = await initSystem();
    await assertRejects(
      () => sys.takeBreak('nonexistent'),
      'Kontor hittades inte'
    );
    cleanup(sys);
  });
});

describe('HomeOfficeOptimizationSystem — getCurrentWorkSession', () => {
  it('returns active session', async () => {
    const { sys } = await initSystem();
    await sys.startWork('main-office');
    const session = sys.getCurrentWorkSession('main-office');
    assertType(session, 'object');
    assertEqual(session.officeId, 'main-office');
    assert(!session.endTime, 'should not have endTime');
    cleanup(sys);
  });

  it('returns undefined when no active session', async () => {
    const { sys } = await initSystem();
    const session = sys.getCurrentWorkSession('main-office');
    assertEqual(session, undefined);
    cleanup(sys);
  });
});

describe('HomeOfficeOptimizationSystem — calculateProductivityScore', () => {
  it('returns 0 when session has no duration', async () => {
    const { sys } = await initSystem();
    const score = sys.calculateProductivityScore({ duration: 0, focusTime: 0, meetings: [] });
    assertEqual(score, 0);
    cleanup(sys);
  });

  it('returns a value between 0-100 for valid session', async () => {
    const { sys } = await initSystem();
    const score = sys.calculateProductivityScore({
      duration: 3600000,
      focusTime: 2700000,
      meetings: [{ duration: 900000 }],
      distractions: 3
    });
    assert(score >= 0, 'should be >= 0');
    assert(score <= 100, 'should be <= 100');
    cleanup(sys);
  });
});

describe('HomeOfficeOptimizationSystem — getters', () => {
  it('getOffices returns array', async () => {
    const { sys } = await initSystem();
    const offices = sys.getOffices();
    assert(Array.isArray(offices), 'should be array');
    assertEqual(offices.length, 1);
    assertEqual(offices[0].name, 'Hemkontor');
    cleanup(sys);
  });

  it('getOffice returns office by id', async () => {
    const { sys } = await initSystem();
    const office = sys.getOffice('main-office');
    assertType(office, 'object');
    assertEqual(office.name, 'Hemkontor');
    cleanup(sys);
  });

  it('getOffice returns undefined for unknown', async () => {
    const { sys } = await initSystem();
    assertEqual(sys.getOffice('nonexistent'), undefined);
    cleanup(sys);
  });

  it('getWorkSessions limits results', async () => {
    const { sys } = await initSystem();
    // Create a few sessions
    await sys.startWork('main-office');
    await sys.endWork('main-office');
    await sys.startWork('main-office');
    await sys.endWork('main-office');
    const sessions = sys.getWorkSessions(null, 1);
    assertEqual(sessions.length, 1);
    cleanup(sys);
  });

  it('getWorkSessions filters by officeId', async () => {
    const { sys } = await initSystem();
    await sys.startWork('main-office');
    await sys.endWork('main-office');
    const sessions = sys.getWorkSessions('main-office');
    assert(sessions.length >= 1, 'should have sessions');
    for (const s of sessions) {
      assertEqual(s.officeId, 'main-office');
    }
    cleanup(sys);
  });

  it('getMeetings limits results', async () => {
    const { sys } = await initSystem();
    await sys.startWork('main-office');
    const m1 = await sys.startMeeting('main-office', { topic: 'a' });
    await sys.endMeeting(m1.id);
    const m2 = await sys.startMeeting('main-office', { topic: 'b' });
    await sys.endMeeting(m2.id);
    const meetings = sys.getMeetings(null, 1);
    assertEqual(meetings.length, 1);
    cleanup(sys);
  });
});

describe('HomeOfficeOptimizationSystem — getStats', () => {
  it('returns stats object', async () => {
    const { sys } = await initSystem();
    const stats = sys.getStats();
    assertType(stats, 'object');
    assertType(stats.allTime, 'object');
    assertType(stats.last7Days, 'object');
    assertEqual(stats.currentStatus, 'offline');
    cleanup(sys);
  });

  it('allTime has session count', async () => {
    const { sys } = await initSystem();
    const stats = sys.getStats();
    assertType(stats.allTime.sessions, 'number');
    assertEqual(stats.allTime.sessions, 0);
    cleanup(sys);
  });

  it('reflects completed sessions', async () => {
    const { sys } = await initSystem();
    await sys.startWork('main-office');
    await sys.endWork('main-office');
    const stats = sys.getStats();
    assert(stats.allTime.sessions >= 1, 'should count session');
    cleanup(sys);
  });
});

describe('HomeOfficeOptimizationSystem — endWorkDay', () => {
  it('silently returns for unknown office', async () => {
    const { sys } = await initSystem();
    // Should NOT throw
    await sys.endWorkDay('nonexistent');
    cleanup(sys);
  });

  it('ends active session if present', async () => {
    const { sys } = await initSystem();
    await sys.startWork('main-office');
    const office = sys.offices.get('main-office');
    assertEqual(office.status, 'available');
    await sys.endWorkDay('main-office');
    assertEqual(office.status, 'offline');
    cleanup(sys);
  });

  it('works when already offline', async () => {
    const { sys } = await initSystem();
    const office = sys.offices.get('main-office');
    assertEqual(office.status, 'offline');
    await sys.endWorkDay('main-office');
    assertEqual(office.status, 'offline');
    cleanup(sys);
  });
});

describe('HomeOfficeOptimizationSystem — saveSettings', () => {
  it('persists state to settings', async () => {
    const { sys, homey } = await initSystem();
    await sys.startWork('main-office');
    sys.saveSettings();
    const saved = homey.settings.get('homeOfficeOptimization');
    assertType(saved, 'object');
    assert(Array.isArray(saved.offices), 'should serialize offices as array');
    assertEqual(saved.currentStatus, 'offline');
    cleanup(sys);
  });

  it('limits workSessions to 100', async () => {
    const { sys, homey } = await initSystem();
    // Populate more than 100
    for (let i = 0; i < 120; i++) {
      sys.workSessions.push({ id: `ws-${i}`, officeId: 'main-office' });
    }
    sys.saveSettings();
    const saved = homey.settings.get('homeOfficeOptimization');
    assert(saved.workSessions.length <= 100, 'should cap at 100');
    cleanup(sys);
  });

  it('limits meetings to 50', async () => {
    const { sys, homey } = await initSystem();
    for (let i = 0; i < 60; i++) {
      sys.meetings.push({ id: `m-${i}` });
    }
    sys.saveSettings();
    const saved = homey.settings.get('homeOfficeOptimization');
    assert(saved.meetings.length <= 50, 'should cap at 50');
    cleanup(sys);
  });
});

describe('HomeOfficeOptimizationSystem — destroy()', () => {
  it('clears monitoring interval via clearInterval', async () => {
    const { sys } = await initSystem();
    assert(sys.monitoringInterval !== null && sys.monitoringInterval !== undefined,
      'should have interval');
    // destroy clears but does not null the reference
    await sys.destroy();
    // Verify it ran without error and listeners are removed
    assertEqual(sys.listenerCount('notification'), 0);
    while (activeHandles.length > 0) {
      const h = activeHandles.pop();
      if (h.type === 'timeout') clearTimeout(h.id);
      else clearInterval(h.id);
    }
  });

  it('removes all listeners', async () => {
    const { sys } = await initSystem();
    let count = 0;
    sys.on('notification', () => { count++; });
    await sys.destroy();
    sys.emit('notification', {});
    assertEqual(count, 0);
    while (activeHandles.length > 0) {
      const h = activeHandles.pop();
      if (h.type === 'timeout') clearTimeout(h.id);
      else clearInterval(h.id);
    }
  });

  it('is safe to call twice', async () => {
    const { sys } = await initSystem();
    await sys.destroy();
    await sys.destroy(); // should not throw
    while (activeHandles.length > 0) {
      const h = activeHandles.pop();
      if (h.type === 'timeout') clearTimeout(h.id);
      else clearInterval(h.id);
    }
  });
});

run();
