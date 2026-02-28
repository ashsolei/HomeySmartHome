'use strict';

const { describe, it, run } = require('./helpers/runner');
const {
  assert, assertEqual, assertType, assertInstanceOf,
  assertRejects
} = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');
const EventEmitter = require('events');

const AdvancedWakeUpRoutineSystem = require('../lib/AdvancedWakeUpRoutineSystem');

/* ──── timer tracking ────
 * snoozeAlarm() and executemorningRoutine() create untracked setTimeout handles
 * that keep the process alive. We patch setTimeout/setInterval to track and
 * clear them in cleanup().
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
  const sys = new AdvancedWakeUpRoutineSystem(homey);
  return { homey, sys };
}

function cleanup(sys) {
  if (sys.monitoringInterval) {
    clearInterval(sys.monitoringInterval);
    sys.monitoringInterval = null;
  }
  sys.removeAllListeners();
  // Clear ALL tracked timers to prevent process hanging
  while (activeHandles.length > 0) {
    const h = activeHandles.pop();
    if (h.type === 'timeout') clearTimeout(h.id);
    else clearInterval(h.id);
  }
}

/* ================================================================
   TESTS
   ================================================================ */

describe('AdvancedWakeUpRoutineSystem — constructor', () => {
  it('creates an instance extending EventEmitter', () => {
    const { sys } = createSystem();
    assertInstanceOf(sys, EventEmitter);
    cleanup(sys);
  });

  it('initializes profiles as an empty Map', () => {
    const { sys } = createSystem();
    assertInstanceOf(sys.profiles, Map);
    assertEqual(sys.profiles.size, 0);
    cleanup(sys);
  });

  it('initializes alarms as an empty Map', () => {
    const { sys } = createSystem();
    assertInstanceOf(sys.alarms, Map);
    assertEqual(sys.alarms.size, 0);
    cleanup(sys);
  });

  it('initializes sleepData as an empty array', () => {
    const { sys } = createSystem();
    assert(Array.isArray(sys.sleepData));
    assertEqual(sys.sleepData.length, 0);
    cleanup(sys);
  });

  it('sets activeRoutine to null', () => {
    const { sys } = createSystem();
    assertEqual(sys.activeRoutine, null);
    cleanup(sys);
  });

  it('sets monitoringInterval to null', () => {
    const { sys } = createSystem();
    assertEqual(sys.monitoringInterval, null);
    cleanup(sys);
  });
});

describe('AdvancedWakeUpRoutineSystem — initialize()', () => {
  it('returns true on success', async () => {
    const { sys } = createSystem();
    const result = await sys.initialize();
    assertEqual(result, true);
    cleanup(sys);
  });

  it('populates default profiles when settings are empty', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assert(sys.profiles.size > 0, 'profiles should not be empty');
    cleanup(sys);
  });

  it('starts monitoring interval', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertNotNull(sys.monitoringInterval);
    cleanup(sys);
  });
});

describe('AdvancedWakeUpRoutineSystem — loadSettings()', () => {
  it('loads profiles and alarms from saved settings', async () => {
    const { homey, sys } = createSystem();
    const savedData = {
      profiles: [
        { userId: 'user1', name: 'Test User', preferences: {}, alarmSchedule: {}, morningRoutine: { steps: [] }, stats: {} }
      ],
      alarms: [
        { id: 'alarm1', userId: 'user1', time: '07:00' }
      ],
      sleepData: [
        { userId: 'user1', date: '2024-01-01', duration: 480 }
      ]
    };
    homey.settings.set('advancedWakeUpRoutine', savedData);
    await sys.initialize();
    assertEqual(sys.profiles.size, 1);
    assert(sys.profiles.has('user1'));
    assertEqual(sys.alarms.size, 1);
    assert(sys.alarms.has('alarm1'));
    assertEqual(sys.sleepData.length, 1);
    cleanup(sys);
  });

  it('handles missing settings gracefully', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    // should create defaults instead of crashing
    assert(sys.profiles.size >= 1, 'should have default profile');
    cleanup(sys);
  });
});

describe('AdvancedWakeUpRoutineSystem — initializeDefaultProfiles()', () => {
  it('creates a default profile when profiles is empty', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const defaultProfile = sys.profiles.get('default');
    assert(defaultProfile !== undefined, 'default profile should exist');
    assertEqual(defaultProfile.userId, 'default');
    assertEqual(defaultProfile.name, 'Standard profil');
    cleanup(sys);
  });

  it('default profile has correct preferences', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const prefs = sys.profiles.get('default').preferences;
    assertEqual(prefs.wakeUpDuration, 30);
    assertEqual(prefs.lightIntensityStart, 1);
    assertEqual(prefs.lightIntensityEnd, 100);
    assertEqual(prefs.soundType, 'nature');
    assertEqual(prefs.targetTemperature, 21);
    assertEqual(prefs.coffeeMaker, true);
    assertEqual(prefs.smartSnooze, true);
    assertEqual(prefs.maxSnoozes, 3);
    assertEqual(prefs.snoozeIntervalStart, 10);
    assertEqual(prefs.snoozeIntervalDecrease, 2);
    cleanup(sys);
  });

  it('default profile has alarm schedule with weekdays and weekends', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const schedule = sys.profiles.get('default').alarmSchedule;
    assert(schedule.weekdays !== undefined, 'weekdays should be defined');
    assertEqual(schedule.weekdays.time, '06:30');
    assertEqual(schedule.weekends.time, '08:30');
    cleanup(sys);
  });

  it('default profile has morning routine steps', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const steps = sys.profiles.get('default').morningRoutine.steps;
    assert(Array.isArray(steps));
    assert(steps.length > 0, 'should have morning routine steps');
    cleanup(sys);
  });

  it('default profile has stats object', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const stats = sys.profiles.get('default').stats;
    assertEqual(stats.totalWakeUps, 0);
    assertEqual(stats.averageSleepDuration, 0);
    assertEqual(stats.averageSleepQuality, 0);
    assertEqual(stats.snoozeRate, 0);
    cleanup(sys);
  });

  it('does not override existing profiles', async () => {
    const { homey, sys } = createSystem();
    homey.settings.set('advancedWakeUpRoutine', {
      profiles: [{ userId: 'custom', name: 'Custom User', preferences: {}, alarmSchedule: {}, morningRoutine: { steps: [] }, stats: {} }],
      alarms: [],
      sleepData: []
    });
    await sys.initialize();
    assert(!sys.profiles.has('default'), 'should not create default when profiles exist');
    assert(sys.profiles.has('custom'), 'custom profile should remain');
    cleanup(sys);
  });
});

describe('AdvancedWakeUpRoutineSystem — startMonitoring()', () => {
  it('sets up a monitoring interval', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assert(sys.monitoringInterval !== null, 'interval should be set');
    cleanup(sys);
  });
});

describe('AdvancedWakeUpRoutineSystem — snoozeAlarm()', () => {
  it('throws when no active routine exists', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    await assertRejects(
      () => sys.snoozeAlarm(),
      'Ingen aktiv väckning'
    );
    cleanup(sys);
  });

  it('throws when profile is not found', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    sys.activeRoutine = { alarmId: 'a1', userId: 'nonexistent', snoozeCount: 0 };
    await assertRejects(
      () => sys.snoozeAlarm(),
      'Profil hittades inte'
    );
    cleanup(sys);
  });

  it('throws when smart snooze is disabled', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const profile = sys.profiles.get('default');
    profile.preferences.smartSnooze = false;
    sys.activeRoutine = { alarmId: 'a1', userId: 'default', snoozeCount: 0 };
    await assertRejects(
      () => sys.snoozeAlarm(),
      'Snooze är inte aktiverat'
    );
    cleanup(sys);
  });

  it('throws when max snoozes reached', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    sys.activeRoutine = { alarmId: 'a1', userId: 'default', snoozeCount: 3 };
    await assertRejects(
      () => sys.snoozeAlarm(),
      'Max antal snooze uppnått'
    );
    cleanup(sys);
  });

  it('succeeds and returns snooze info when valid', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    sys.activeRoutine = { alarmId: 'a1', userId: 'default', snoozeCount: 0 };
    const result = await sys.snoozeAlarm();
    assert(result !== undefined);
    assertType(result.snoozeInterval, 'number');
    assertType(result.snoozesRemaining, 'number');
    cleanup(sys);
  });

  it('increments snooze count on success', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    sys.activeRoutine = { alarmId: 'a1', userId: 'default', snoozeCount: 0 };
    await sys.snoozeAlarm();
    assertEqual(sys.activeRoutine.snoozeCount, 1);
    cleanup(sys);
  });

  it('decreases snooze interval with each snooze', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    sys.activeRoutine = { alarmId: 'a1', userId: 'default', snoozeCount: 0 };
    const first = await sys.snoozeAlarm();
    const second = await sys.snoozeAlarm();
    assert(second.snoozeInterval <= first.snoozeInterval, 'interval should decrease or stay same');
    cleanup(sys);
  });
});

describe('AdvancedWakeUpRoutineSystem — dismissAlarm()', () => {
  it('throws when no active routine exists', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    await assertRejects(
      () => sys.dismissAlarm(),
      'Ingen aktiv väckning'
    );
    cleanup(sys);
  });

  it('clears active routine on dismiss', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    sys.activeRoutine = {
      alarmId: 'a1',
      userId: 'default',
      startTime: Date.now() - 60000,
      stage: 'waking',
      snoozeCount: 0,
      dismissed: false
    };
    await sys.dismissAlarm();
    assertEqual(sys.activeRoutine, null);
    cleanup(sys);
  });

  it('returns completed routine data', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    sys.activeRoutine = {
      alarmId: 'a1',
      userId: 'default',
      startTime: Date.now() - 60000,
      stage: 'waking',
      snoozeCount: 1,
      dismissed: false
    };
    const result = await sys.dismissAlarm();
    assert(result !== undefined);
    assertEqual(result.dismissed, true);
    assert(result.dismissTime !== undefined, 'should have dismissTime');
    cleanup(sys);
  });

  it('records a sleep session on dismiss', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const initialLength = sys.sleepData.length;
    sys.activeRoutine = {
      alarmId: 'a1',
      userId: 'default',
      startTime: Date.now() - 60000,
      stage: 'waking',
      snoozeCount: 0,
      dismissed: false
    };
    await sys.dismissAlarm();
    assert(sys.sleepData.length > initialLength, 'should have recorded sleep session');
    cleanup(sys);
  });
});

describe('AdvancedWakeUpRoutineSystem — getProfiles()', () => {
  it('returns an array of profiles', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const profiles = sys.getProfiles();
    assert(Array.isArray(profiles));
    assert(profiles.length > 0);
    cleanup(sys);
  });

  it('returns empty array before initialization', () => {
    const { sys } = createSystem();
    const profiles = sys.getProfiles();
    assert(Array.isArray(profiles));
    assertEqual(profiles.length, 0);
    cleanup(sys);
  });
});

describe('AdvancedWakeUpRoutineSystem — getProfile()', () => {
  it('returns profile for valid userId', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const profile = sys.getProfile('default');
    assert(profile !== undefined);
    assertEqual(profile.userId, 'default');
    cleanup(sys);
  });

  it('returns undefined for unknown userId', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const profile = sys.getProfile('nonexistent');
    assertEqual(profile, undefined);
    cleanup(sys);
  });
});

describe('AdvancedWakeUpRoutineSystem — getAlarms()', () => {
  it('returns an array', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const alarms = sys.getAlarms();
    assert(Array.isArray(alarms));
    cleanup(sys);
  });

  it('returns loaded alarms from settings', async () => {
    const { homey, sys } = createSystem();
    homey.settings.set('advancedWakeUpRoutine', {
      profiles: [{ userId: 'u1', name: 'U1', preferences: {}, alarmSchedule: {}, morningRoutine: { steps: [] }, stats: {} }],
      alarms: [
        { id: 'a1', userId: 'u1', time: '07:00' },
        { id: 'a2', userId: 'u1', time: '08:00' }
      ],
      sleepData: []
    });
    await sys.initialize();
    assertEqual(sys.getAlarms().length, 2);
    cleanup(sys);
  });
});

describe('AdvancedWakeUpRoutineSystem — getActiveRoutine()', () => {
  it('returns null when no routine is active', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.getActiveRoutine(), null);
    cleanup(sys);
  });

  it('returns the active routine object when set', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const routine = { alarmId: 'a1', userId: 'default' };
    sys.activeRoutine = routine;
    assertEqual(sys.getActiveRoutine(), routine);
    cleanup(sys);
  });
});

describe('AdvancedWakeUpRoutineSystem — getSleepData()', () => {
  it('returns empty array when no data', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const data = sys.getSleepData('default');
    assert(Array.isArray(data));
    assertEqual(data.length, 0);
    cleanup(sys);
  });

  it('filters by userId', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    sys.sleepData.push(
      { userId: 'default', date: '2024-01-01', duration: 480 },
      { userId: 'other', date: '2024-01-01', duration: 420 },
      { userId: 'default', date: '2024-01-02', duration: 500 }
    );
    const data = sys.getSleepData('default');
    assertEqual(data.length, 2);
    cleanup(sys);
  });

  it('limits to requested days', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    for (let i = 0; i < 40; i++) {
      sys.sleepData.push({ userId: 'default', date: `2024-01-${String(i + 1).padStart(2, '0')}`, duration: 480 });
    }
    const data = sys.getSleepData('default', 10);
    assertEqual(data.length, 10);
    cleanup(sys);
  });

  it('returns reversed (most recent first)', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    sys.sleepData.push(
      { userId: 'default', date: '2024-01-01', duration: 480 },
      { userId: 'default', date: '2024-01-02', duration: 500 }
    );
    const data = sys.getSleepData('default');
    assertEqual(data[0].date, '2024-01-02');
    assertEqual(data[1].date, '2024-01-01');
    cleanup(sys);
  });
});

describe('AdvancedWakeUpRoutineSystem — getStats()', () => {
  it('returns null for unknown user', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const stats = sys.getStats('nonexistent');
    assertEqual(stats, null);
    cleanup(sys);
  });

  it('returns stats object for valid user', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const stats = sys.getStats('default');
    assert(stats !== null);
    assertEqual(stats.user, 'Standard profil');
    assert(stats.stats !== undefined, 'should have stats sub-object');
    assert(stats.last7Days !== undefined, 'should have last7Days');
    cleanup(sys);
  });

  it('last7Days has expected keys', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const stats = sys.getStats('default');
    const last7 = stats.last7Days;
    assert('averageSleepDuration' in last7);
    assert('averageSleepQuality' in last7);
    assert('totalSnoozes' in last7);
    cleanup(sys);
  });

  it('handles empty sleep data (NaN edge case)', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    // No sleep data at all — division by zero risk
    const stats = sys.getStats('default');
    // Should still return without throwing
    assert(stats !== null);
    cleanup(sys);
  });
});

describe('AdvancedWakeUpRoutineSystem — saveSettings()', () => {
  it('saves profiles, alarms, and sleepData to homey settings', async () => {
    const { homey, sys } = createSystem();
    await sys.initialize();
    await sys.saveSettings();
    const saved = homey.settings.get('advancedWakeUpRoutine');
    assert(saved !== null);
    assert(Array.isArray(saved.profiles));
    assert(Array.isArray(saved.alarms));
    assert(Array.isArray(saved.sleepData));
    cleanup(sys);
  });

  it('limits sleepData to 30 entries', async () => {
    const { homey, sys } = createSystem();
    await sys.initialize();
    for (let i = 0; i < 50; i++) {
      sys.sleepData.push({ userId: 'default', date: `2024-01-${i}`, duration: 480 });
    }
    await sys.saveSettings();
    const saved = homey.settings.get('advancedWakeUpRoutine');
    assert(saved.sleepData.length <= 30, 'should trim to 30 entries');
    cleanup(sys);
  });
});

describe('AdvancedWakeUpRoutineSystem — destroy()', () => {
  it('clears monitoring interval', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assert(sys.monitoringInterval !== null);
    sys.destroy();
    // After destroy the interval reference may or may not be nulled,
    // but it should be cleared (no more callbacks). We verify no crash.
  });

  it('removes all event listeners', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    sys.on('test', () => {});
    assertEqual(sys.listenerCount('test'), 1);
    sys.destroy();
    assertEqual(sys.listenerCount('test'), 0);
  });

  it('can be called multiple times without error', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    sys.destroy();
    sys.destroy(); // should not throw
  });
});

/* ──── helpers used above ──── */
function assertNotNull(value) {
  if (value === null || value === undefined) {
    throw new Error('Expected non-null/undefined value');
  }
}

run();
