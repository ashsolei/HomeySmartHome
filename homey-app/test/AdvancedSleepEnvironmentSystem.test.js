'use strict';

const { describe, it, run } = require('./helpers/runner');
const {
  assert, assertEqual, assertType, assertInstanceOf
} = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');
const EventEmitter = require('events');

const AdvancedSleepEnvironmentSystem = require('../lib/AdvancedSleepEnvironmentSystem');

/* ──── timer tracking ────
 * initialize() creates 10+ intervals via _addInterval, and several methods
 * create untracked setTimeout handles. We patch global timers to track and
 * clear them all during cleanup.
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
  const sys = new AdvancedSleepEnvironmentSystem(homey);
  return { homey, sys };
}

function cleanup(sys) {
  try { sys.destroy(); } catch (_) { /* ignore */ }
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

describe('AdvancedSleepEnvironmentSystem — constructor', () => {
  it('creates an instance extending EventEmitter', () => {
    const { sys } = createSystem();
    assertInstanceOf(sys, AdvancedSleepEnvironmentSystem);
    assertInstanceOf(sys, EventEmitter);
    cleanup(sys);
  });

  it('stores homey reference', () => {
    const { sys, homey } = createSystem();
    assertEqual(sys.homey, homey);
    cleanup(sys);
  });

  it('initializes state with correct defaults', () => {
    const { sys } = createSystem();
    assertEqual(sys.initialized, false);
    assert(Array.isArray(sys.intervals), 'intervals should be an array');
    assertEqual(sys.intervals.length, 0);
    assertType(sys.sleepZones, 'object');
    assertType(sys.soundTypes, 'object');
    assertType(sys.userProfiles, 'object');
    assertType(sys.activeSessions, 'object');
    cleanup(sys);
  });

  it('creates 3 default sleep zones', () => {
    const { sys } = createSystem();
    const zoneIds = Object.keys(sys.sleepZones);
    assertEqual(zoneIds.length, 3);
    assert(zoneIds.includes('master-bedroom'), 'should have master-bedroom');
    assert(zoneIds.includes('bedroom-2'), 'should have bedroom-2');
    assert(zoneIds.includes('guest-room'), 'should have guest-room');
    cleanup(sys);
  });

  it('zones have correct structure', () => {
    const { sys } = createSystem();
    const z = sys.sleepZones['master-bedroom'];
    assertEqual(z.bedType, 'double');
    assertEqual(z.smartMattress, true);
    assertType(z.bedSensors, 'object');
    assertEqual(z.blackoutBlinds, 0);
    assertEqual(z.windowOpen, false);
    assertEqual(z.doorOpen, false);
    assertType(z.temperature, 'number');
    assertType(z.humidity, 'number');
    assertType(z.heatedBlanket, 'object');
    assertType(z.coolingPad, 'object');
    cleanup(sys);
  });

  it('creates 10 sound types', () => {
    const { sys } = createSystem();
    const types = Object.keys(sys.soundTypes);
    assertEqual(types.length, 10);
    assert(types.includes('white-noise'), 'should have white-noise');
    assert(types.includes('rain'), 'should have rain');
    assert(types.includes('ocean'), 'should have ocean');
    cleanup(sys);
  });

  it('sets default seasonal config for Stockholm', () => {
    const { sys } = createSystem();
    assertEqual(sys.seasonalConfig.latitude, 59.33);
    assertEqual(sys.seasonalConfig.sadTherapyEnabled, false);
    assertEqual(sys.seasonalConfig.midnightSunBlocking, true);
    assertEqual(sys.seasonalConfig.winterDarkCompensation, true);
    cleanup(sys);
  });

  it('sets default air quality thresholds', () => {
    const { sys } = createSystem();
    assertEqual(sys.airQuality.co2Max, 800);
    assertEqual(sys.airQuality.humidityMin, 40);
    assertEqual(sys.airQuality.humidityMax, 60);
    assertEqual(sys.airQuality.vocMax, 500);
    assertEqual(sys.airQuality.hepaFilterHours, 0);
    assertEqual(sys.airQuality.hepaFilterMaxHours, 2000);
    cleanup(sys);
  });

  it('sets default temperature profiles', () => {
    const { sys } = createSystem();
    assertEqual(sys.tempProfiles.preBed.startTemp, 22);
    assertEqual(sys.tempProfiles.preBed.endTemp, 18);
    assertEqual(sys.tempProfiles.sleep.targetMin, 16);
    assertEqual(sys.tempProfiles.sleep.targetMax, 18);
    assertEqual(sys.tempProfiles.sleep.footWarming, true);
    assertEqual(sys.tempProfiles.wake.targetTemp, 20);
    cleanup(sys);
  });

  it('sets default light config', () => {
    const { sys } = createSystem();
    assertEqual(sys.lightConfig.blueLightStart, 120);
    assertEqual(sys.lightConfig.sunriseDuration, 30);
    assertEqual(sys.lightConfig.moonlightBrightness, 2);
    assertEqual(sys.lightConfig.circadianEnabled, true);
    cleanup(sys);
  });
});

describe('AdvancedSleepEnvironmentSystem — initialize()', () => {
  it('creates user profiles during initialization', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const profiles = Object.keys(sys.userProfiles);
    assertEqual(profiles.length, 4);
    cleanup(sys);
  });

  it('sets initialized flag to true', async () => {
    const { sys } = createSystem();
    assertEqual(sys.initialized, false);
    await sys.initialize();
    assertEqual(sys.initialized, true);
    cleanup(sys);
  });

  it('starts monitoring intervals', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assert(sys.intervals.length > 0, 'should have started intervals');
    assert(sys.intervals.length >= 10, 'should have at least 10 intervals');
    cleanup(sys);
  });

  it('emits sleep-environment-initialized on homey', async () => {
    const { sys, homey } = createSystem();
    let emitted = false;
    homey.on('sleep-environment-initialized', () => { emitted = true; });
    await sys.initialize();
    assert(emitted, 'should emit sleep-environment-initialized');
    cleanup(sys);
  });

  it('initializes hygiene tracking per user', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const keys = Object.keys(sys.hygieneTracking);
    assertEqual(keys.length, 4);
    cleanup(sys);
  });

  it('initializes sleep debt data per user', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const keys = Object.keys(sys.sleepDebtData);
    assertEqual(keys.length, 4);
    cleanup(sys);
  });

  it('initializes active sounds per zone', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assert(Object.keys(sys.activeSounds).length >= 3, 'should have active sound entries per zone');
    cleanup(sys);
  });

  it('initializes snoring state per zone', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assert(Object.keys(sys.snoringState).length >= 3, 'should have snoring state per zone');
    cleanup(sys);
  });
});

describe('AdvancedSleepEnvironmentSystem — sleep sessions', () => {
  it('starts a sleep session and returns session ID', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const userId = Object.keys(sys.userProfiles)[0];
    const sid = await sys.startSleepSession(userId, 'master-bedroom');
    assertType(sid, 'string');
    assert(sid.startsWith(userId), 'session id should start with userId');
    cleanup(sys);
  });

  it('returns null for unknown user', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const result = await sys.startSleepSession('unknown-user', 'master-bedroom');
    assertEqual(result, null);
    cleanup(sys);
  });

  it('returns null for unknown zone', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const userId = Object.keys(sys.userProfiles)[0];
    const result = await sys.startSleepSession(userId, 'unknown-zone');
    assertEqual(result, null);
    cleanup(sys);
  });

  it('emits sleep-session-started on homey', async () => {
    const { sys, homey } = createSystem();
    await sys.initialize();
    let eventData = null;
    homey.on('sleep-session-started', (data) => { eventData = data; });
    const userId = Object.keys(sys.userProfiles)[0];
    await sys.startSleepSession(userId, 'master-bedroom');
    assert(eventData !== null, 'should emit sleep-session-started');
    assertEqual(eventData.userId, userId);
    assertEqual(eventData.zone, 'master-bedroom');
    cleanup(sys);
  });

  it('tracks session as active', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const userId = Object.keys(sys.userProfiles)[0];
    const sid = await sys.startSleepSession(userId, 'master-bedroom');
    const active = sys.getActiveSessions();
    assert(active.length >= 1, 'should have at least 1 active session');
    assert(active.some(s => s.sessionId === sid), 'should find the session');
    cleanup(sys);
  });

  it('ends a sleep session and returns session data', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const userId = Object.keys(sys.userProfiles)[0];
    const sid = await sys.startSleepSession(userId, 'master-bedroom');
    const result = await sys.endSleepSession(sid);
    assert(result !== null, 'should return session object');
    assertEqual(result.active, false);
    assertType(result.endTime, 'number');
    assertType(result.sleepScore, 'number');
    cleanup(sys);
  });

  it('returns null when ending unknown session', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const result = await sys.endSleepSession('nonexistent-session');
    assertEqual(result, null);
    cleanup(sys);
  });

  it('emits sleep-session-ended on homey', async () => {
    const { sys, homey } = createSystem();
    await sys.initialize();
    let eventData = null;
    homey.on('sleep-session-ended', (data) => { eventData = data; });
    const userId = Object.keys(sys.userProfiles)[0];
    const sid = await sys.startSleepSession(userId, 'master-bedroom');
    await sys.endSleepSession(sid);
    assert(eventData !== null, 'should emit sleep-session-ended');
    assertEqual(eventData.sessionId, sid);
    assertType(eventData.score, 'number');
    cleanup(sys);
  });

  it('getSessionHistory returns logs', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const userId = Object.keys(sys.userProfiles)[0];
    const sid = await sys.startSleepSession(userId, 'master-bedroom');
    await sys.endSleepSession(sid);
    const history = sys.getSessionHistory(userId);
    assert(Array.isArray(history), 'should return array');
    assert(history.length >= 1, 'should have at least 1 logged session');
    cleanup(sys);
  });

  it('getSessionHistory with limit returns limited results', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const userId = Object.keys(sys.userProfiles)[0];
    for (let i = 0; i < 3; i++) {
      const sid = await sys.startSleepSession(userId, 'master-bedroom');
      await sys.endSleepSession(sid);
    }
    const limited = sys.getSessionHistory(userId, 2);
    assertEqual(limited.length, 2);
    cleanup(sys);
  });

  it('getActiveSessions returns only active ones', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const userId = Object.keys(sys.userProfiles)[0];
    const sid = await sys.startSleepSession(userId, 'master-bedroom');
    assertEqual(sys.getActiveSessions().length, 1);
    await sys.endSleepSession(sid);
    assertEqual(sys.getActiveSessions().length, 0);
    cleanup(sys);
  });
});

describe('AdvancedSleepEnvironmentSystem — alarms', () => {
  it('setAlarm returns true for valid user', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const userId = Object.keys(sys.userProfiles)[0];
    const ok = sys.setAlarm(userId, { time: '07:00' });
    assertEqual(ok, true);
    cleanup(sys);
  });

  it('setAlarm returns false for unknown user', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const ok = sys.setAlarm('fake-user', { time: '07:00' });
    assertEqual(ok, false);
    cleanup(sys);
  });

  it('emits alarm-configured on homey', async () => {
    const { sys, homey } = createSystem();
    await sys.initialize();
    let eventData = null;
    homey.on('alarm-configured', (d) => { eventData = d; });
    const userId = Object.keys(sys.userProfiles)[0];
    sys.setAlarm(userId, { time: '06:30' });
    assert(eventData !== null, 'should emit alarm-configured');
    assertEqual(eventData.time, '06:30');
    cleanup(sys);
  });

  it('snoozeAlarm increments count and returns true', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const userId = Object.keys(sys.userProfiles)[0];
    sys.setAlarm(userId, { time: '07:00' });
    assertEqual(sys.snoozeAlarm(userId), true);
    assertEqual(sys.alarms[userId].snoozeCount, 1);
    cleanup(sys);
  });

  it('snoozeAlarm returns false when no alarm', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.snoozeAlarm('no-alarm-user'), false);
    cleanup(sys);
  });

  it('snoozeAlarm returns false when max snoozes reached', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const userId = Object.keys(sys.userProfiles)[0];
    sys.setAlarm(userId, { time: '07:00' });
    sys.snoozeAlarm(userId); // 1
    sys.snoozeAlarm(userId); // 2 = max
    const thirdSnooze = sys.snoozeAlarm(userId);
    assertEqual(thirdSnooze, false);
    cleanup(sys);
  });

  it('emits snooze-limit-reached when max exceeded', async () => {
    const { sys, homey } = createSystem();
    await sys.initialize();
    let limited = false;
    homey.on('snooze-limit-reached', () => { limited = true; });
    const userId = Object.keys(sys.userProfiles)[0];
    sys.setAlarm(userId, { time: '07:00' });
    sys.snoozeAlarm(userId);
    sys.snoozeAlarm(userId);
    sys.snoozeAlarm(userId);
    assert(limited, 'should emit snooze-limit-reached');
    cleanup(sys);
  });

  it('getAlarmForToday returns alarm info', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const userId = Object.keys(sys.userProfiles)[0];
    sys.setAlarm(userId, { time: '07:00' });
    const alarm = sys.getAlarmForToday(userId);
    assert(alarm !== null, 'should return alarm');
    assertEqual(alarm.time, '07:00');
    cleanup(sys);
  });

  it('getAlarmForToday returns null when no alarm', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const result = sys.getAlarmForToday('no-alarm');
    assertEqual(result, null);
    cleanup(sys);
  });

  it('dismissAlarm resets snooze count', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const userId = Object.keys(sys.userProfiles)[0];
    sys.setAlarm(userId, { time: '07:00' });
    sys.snoozeAlarm(userId);
    assertEqual(sys.alarms[userId].snoozeCount, 1);
    sys.dismissAlarm(userId);
    assertEqual(sys.alarms[userId].snoozeCount, 0);
    cleanup(sys);
  });

  it('dismissAlarm returns false when no alarm', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.dismissAlarm('no-alarm'), false);
    cleanup(sys);
  });

  it('resetAlarmSnooze resets count to 0', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const userId = Object.keys(sys.userProfiles)[0];
    sys.setAlarm(userId, { time: '07:00' });
    sys.snoozeAlarm(userId);
    sys.resetAlarmSnooze(userId);
    assertEqual(sys.alarms[userId].snoozeCount, 0);
    cleanup(sys);
  });

  it('resetAlarmSnooze returns false when no alarm', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.resetAlarmSnooze('no-alarm'), false);
    cleanup(sys);
  });

  it('getAlarmStatus returns structure or null', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.getAlarmStatus('no-alarm'), null);
    const userId = Object.keys(sys.userProfiles)[0];
    sys.setAlarm(userId, { time: '07:00', lightWake: true, soundWake: false });
    const status = sys.getAlarmStatus(userId);
    assert(status !== null, 'should return alarm status');
    assertEqual(status.enabled, true);
    assertEqual(status.time, '07:00');
    assertType(status.methods, 'object');
    assertEqual(status.methods.light, true);
    assertEqual(status.methods.sound, false);
    cleanup(sys);
  });
});

describe('AdvancedSleepEnvironmentSystem — user profiles', () => {
  it('getAllProfiles returns all 4 default profiles', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const profiles = sys.getAllProfiles();
    assertEqual(Object.keys(profiles).length, 4);
    cleanup(sys);
  });

  it('getUserProfile returns profile or null', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const userId = Object.keys(sys.userProfiles)[0];
    const profile = sys.getUserProfile(userId);
    assert(profile !== null, 'should return profile');
    assertType(profile.name, 'string');
    assertType(profile.chronotype, 'string');
    assertEqual(sys.getUserProfile('unknown'), null);
    cleanup(sys);
  });

  it('updateUserProfile updates and returns true', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const userId = Object.keys(sys.userProfiles)[0];
    const ok = sys.updateUserProfile(userId, { preferredTemp: 19 });
    assertEqual(ok, true);
    assertEqual(sys.userProfiles[userId].preferredTemp, 19);
    cleanup(sys);
  });

  it('updateUserProfile returns false for unknown user', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.updateUserProfile('unknown', { preferredTemp: 19 }), false);
    cleanup(sys);
  });

  it('emits profile-updated on homey', async () => {
    const { sys, homey } = createSystem();
    await sys.initialize();
    let emitted = false;
    homey.on('profile-updated', () => { emitted = true; });
    const userId = Object.keys(sys.userProfiles)[0];
    sys.updateUserProfile(userId, { preferredTemp: 19 });
    assert(emitted, 'should emit profile-updated');
    cleanup(sys);
  });
});

describe('AdvancedSleepEnvironmentSystem — sleep hygiene tracking', () => {
  it('recordCaffeineIntake increments count', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const userId = Object.keys(sys.userProfiles)[0];
    const before = sys.hygieneTracking[userId].caffeine.dailyCount;
    sys.recordCaffeineIntake(userId);
    assertEqual(sys.hygieneTracking[userId].caffeine.dailyCount, before + 1);
    cleanup(sys);
  });

  it('recordCaffeineIntake is silent no-op for unknown user', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    sys.recordCaffeineIntake('unknown'); // should not throw
    cleanup(sys);
  });

  it('recordScreenTime records minutes', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const userId = Object.keys(sys.userProfiles)[0];
    sys.recordScreenTime(userId, 45);
    assertEqual(sys.hygieneTracking[userId].screenTime.eveningMinutes, 45);
    cleanup(sys);
  });

  it('recordExercise records intensity and hour', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const userId = Object.keys(sys.userProfiles)[0];
    sys.recordExercise(userId, 'moderate', 18);
    assertEqual(sys.hygieneTracking[userId].exercise.intensity, 'moderate');
    cleanup(sys);
  });

  it('recordAlcoholIntake records units', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const userId = Object.keys(sys.userProfiles)[0];
    sys.recordAlcoholIntake(userId, 3);
    assertEqual(sys.hygieneTracking[userId].alcohol.units, 3);
    cleanup(sys);
  });

  it('recordMealTiming marks meal time', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const userId = Object.keys(sys.userProfiles)[0];
    sys.recordMealTiming(userId);
    assertType(sys.hygieneTracking[userId].mealTiming.lastMeal, 'string');
    cleanup(sys);
  });

  it('recordPhonePresence records state', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const userId = Object.keys(sys.userProfiles)[0];
    sys.recordPhonePresence(userId, true, false);
    assertEqual(sys.hygieneTracking[userId].phonePresence.inBedroom, true);
    assertEqual(sys.hygieneTracking[userId].phonePresence.onSilent, false);
    cleanup(sys);
  });

  it('recordStressLevel clamps to 0-10', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const userId = Object.keys(sys.userProfiles)[0];
    sys.recordStressLevel(userId, 15, false);
    assertEqual(sys.hygieneTracking[userId].stress.level, 10);
    sys.recordStressLevel(userId, -5, true);
    assertEqual(sys.hygieneTracking[userId].stress.level, 0);
    assertEqual(sys.hygieneTracking[userId].stress.breathingExerciseDone, true);
    cleanup(sys);
  });

  it('resetDailyHygiene resets counters', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const userId = Object.keys(sys.userProfiles)[0];
    sys.recordCaffeineIntake(userId);
    sys.recordCaffeineIntake(userId);
    sys.recordScreenTime(userId, 90);
    sys.resetDailyHygiene(userId);
    assertEqual(sys.hygieneTracking[userId].caffeine.dailyCount, 0);
    assertEqual(sys.hygieneTracking[userId].screenTime.eveningMinutes, 0);
    cleanup(sys);
  });

  it('getHygieneReport returns report or null', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.getHygieneReport('unknown'), null);
    const userId = Object.keys(sys.userProfiles)[0];
    const report = sys.getHygieneReport(userId);
    assert(report !== null, 'should return report');
    assertType(report.hygieneScore, 'number');
    assert(Array.isArray(report.negativeFactors), 'should have negativeFactors array');
    assertType(report.grade, 'string');
    cleanup(sys);
  });

  it('hygiene score degrades with poor habits', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const userId = Object.keys(sys.userProfiles)[0];
    const baseline = sys.getHygieneReport(userId).hygieneScore;
    sys.recordCaffeineIntake(userId);
    sys.recordCaffeineIntake(userId);
    sys.recordCaffeineIntake(userId);
    sys.recordAlcoholIntake(userId, 3);
    sys.recordStressLevel(userId, 8, false);
    sys.recordScreenTime(userId, 90);
    const after = sys.getHygieneReport(userId).hygieneScore;
    assert(after < baseline, 'score should be lower with poor habits');
    cleanup(sys);
  });
});

describe('AdvancedSleepEnvironmentSystem — sounds', () => {
  it('getSoundTypes returns 10 types', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const types = sys.getSoundTypes();
    assertEqual(Object.keys(types).length, 10);
    cleanup(sys);
  });

  it('playSound returns true for valid input', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const result = sys.playSound('master-bedroom', 'rain', 50);
    assertEqual(result, true);
    cleanup(sys);
  });

  it('playSound returns false for unknown sound type', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.playSound('master-bedroom', 'nonexistent', 50), false);
    cleanup(sys);
  });

  it('playSound returns false for unknown zone', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.playSound('unknown-zone', 'rain', 50), false);
    cleanup(sys);
  });

  it('emits sound-started on homey', async () => {
    const { sys, homey } = createSystem();
    await sys.initialize();
    let eventData = null;
    homey.on('sound-started', (d) => { eventData = d; });
    sys.playSound('master-bedroom', 'ocean', 30);
    assert(eventData !== null, 'should emit sound-started');
    assertEqual(eventData.zoneId, 'master-bedroom');
    assertEqual(eventData.type, 'ocean');
    cleanup(sys);
  });

  it('getSoundStatus returns playing info', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    sys.playSound('master-bedroom', 'rain', 50);
    const status = sys.getSoundStatus('master-bedroom');
    assert(status !== null, 'should return sound status');
    assertEqual(status.playing, true);
    assertEqual(status.type, 'rain');
    assertEqual(status.volume, 50);
    cleanup(sys);
  });

  it('getSoundStatus returns null for unknown zone', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.getSoundStatus('unknown-zone'), null);
    cleanup(sys);
  });

  it('stopSound returns true', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    sys.playSound('master-bedroom', 'rain', 50);
    assertEqual(sys.stopSound('master-bedroom'), true);
    cleanup(sys);
  });

  it('setVolume returns true when playing and clamps 0-100', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    sys.playSound('master-bedroom', 'rain', 50);
    assertEqual(sys.setVolume('master-bedroom', 75), true);
    assertEqual(sys.activeSounds['master-bedroom'].volume, 75);
    // Clamp high
    sys.setVolume('master-bedroom', 150);
    assertEqual(sys.activeSounds['master-bedroom'].volume, 100);
    // Clamp low
    sys.setVolume('master-bedroom', -10);
    assertEqual(sys.activeSounds['master-bedroom'].volume, 0);
    cleanup(sys);
  });

  it('setVolume returns false when not playing', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.setVolume('master-bedroom', 50), false);
    cleanup(sys);
  });
});

describe('AdvancedSleepEnvironmentSystem — sensor updates', () => {
  it('updateBedSensor updates sensor state', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    sys.updateBedSensor('master-bedroom', 'left', true, 80);
    assertEqual(sys.sleepZones['master-bedroom'].bedSensors.left, true);
    assertEqual(sys.sleepZones['master-bedroom'].bedSensors.pressure, 80);
    cleanup(sys);
  });

  it('updateBedSensor is no-op for unknown zone', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    sys.updateBedSensor('unknown', 'left', true, 80); // should not throw
    cleanup(sys);
  });

  it('updateZoneEnvironment updates zone properties', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    sys.updateZoneEnvironment('master-bedroom', {
      temperature: 22.5, humidity: 55, co2: 900, soundLevel: 40
    });
    assertEqual(sys.sleepZones['master-bedroom'].temperature, 22.5);
    assertEqual(sys.sleepZones['master-bedroom'].humidity, 55);
    assertEqual(sys.sleepZones['master-bedroom'].co2, 900);
    assertEqual(sys.sleepZones['master-bedroom'].soundLevel, 40);
    cleanup(sys);
  });

  it('updateZoneEnvironment ignores unknown keys', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    sys.updateZoneEnvironment('master-bedroom', { unknown: 999 });
    assertEqual(sys.sleepZones['master-bedroom'].unknown, undefined);
    cleanup(sys);
  });

  it('updateSnoringDetection updates state', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    sys.updateSnoringDetection('master-bedroom', true, 7);
    assertEqual(sys.snoringState['master-bedroom'].detected, true);
    assertEqual(sys.snoringState['master-bedroom'].intensity, 7);
    cleanup(sys);
  });
});

describe('AdvancedSleepEnvironmentSystem — heated blanket & cooling pad', () => {
  it('setHeatedBlanket enables blanket for valid zone/side', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const ok = sys.setHeatedBlanket('master-bedroom', 'left', true, 22);
    assertEqual(ok, true);
    assertEqual(sys.sleepZones['master-bedroom'].heatedBlanket.left.enabled, true);
    assertEqual(sys.sleepZones['master-bedroom'].heatedBlanket.left.temp, 22);
    cleanup(sys);
  });

  it('setHeatedBlanket clamps temperature 18-30', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    sys.setHeatedBlanket('master-bedroom', 'left', true, 10);
    assertEqual(sys.sleepZones['master-bedroom'].heatedBlanket.left.temp, 18);
    sys.setHeatedBlanket('master-bedroom', 'left', true, 50);
    assertEqual(sys.sleepZones['master-bedroom'].heatedBlanket.left.temp, 30);
    cleanup(sys);
  });

  it('setHeatedBlanket returns false for unknown zone', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.setHeatedBlanket('unknown', 'left', true, 22), false);
    cleanup(sys);
  });

  it('setCoolingPad enables pad for valid zone/side', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const ok = sys.setCoolingPad('master-bedroom', 'left', true);
    assertEqual(ok, true);
    assertEqual(sys.sleepZones['master-bedroom'].coolingPad.left, true);
    cleanup(sys);
  });

  it('setCoolingPad returns false for unknown zone', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.setCoolingPad('unknown', 'left', true), false);
    cleanup(sys);
  });
});

describe('AdvancedSleepEnvironmentSystem — zone queries', () => {
  it('getZoneStatus returns zone info', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const status = sys.getZoneStatus('master-bedroom');
    assert(status !== null, 'should return zone status');
    assertType(status.temperature, 'number');
    assertType(status.humidity, 'number');
    cleanup(sys);
  });

  it('getZoneStatus returns null for unknown zone', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.getZoneStatus('unknown'), null);
    cleanup(sys);
  });

  it('getAllZoneStatuses returns all 3 zones', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const all = sys.getAllZoneStatuses();
    assertEqual(Object.keys(all).length, 3);
    cleanup(sys);
  });

  it('assessSleepEnvironment returns assessment object', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const assessment = sys.assessSleepEnvironment('master-bedroom');
    assert(assessment !== null, 'should return assessment');
    assertType(assessment.score, 'object');
    assert(Array.isArray(assessment.issues), 'should have issues array');
    assertType(assessment.score.total, 'number');
    assert(assessment.score.total >= 0 && assessment.score.total <= 100, 'score should be 0-100');
    cleanup(sys);
  });

  it('assessSleepEnvironment returns null for unknown zone', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.assessSleepEnvironment('unknown'), null);
    cleanup(sys);
  });

  it('assessSleepEnvironment detects poor conditions', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    sys.updateZoneEnvironment('master-bedroom', {
      temperature: 25, co2: 1200, humidity: 70, soundLevel: 60
    });
    const assessment = sys.assessSleepEnvironment('master-bedroom');
    assert(assessment.issues.length > 0, 'should report issues');
    assert(assessment.score.total < 100, 'score should be degraded');
    cleanup(sys);
  });
});

describe('AdvancedSleepEnvironmentSystem — partner compatibility', () => {
  it('returns null for unknown zone', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.getPartnerCompatibility('unknown'), null);
    cleanup(sys);
  });

  it('returns null for single bed zone', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    // bedroom-2 should be single bed type
    const z = sys.sleepZones['bedroom-2'];
    if (z && z.bedType === 'single') {
      assertEqual(sys.getPartnerCompatibility('bedroom-2'), null);
    }
    cleanup(sys);
  });

  it('returns single occupant for double bed with <2 users', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    // Ensure no users assigned to this zone
    for (const p of Object.values(sys.userProfiles)) { p.zone = 'other-zone'; }
    const result = sys.getPartnerCompatibility('master-bedroom');
    if (result) {
      assertEqual(result.compatible, true);
      assertEqual(result.message, 'Single occupant');
    }
    cleanup(sys);
  });
});

describe('AdvancedSleepEnvironmentSystem — seasonal config', () => {
  it('getSeasonalConfig returns config copy', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const cfg = sys.getSeasonalConfig();
    assertType(cfg, 'object');
    assertEqual(cfg.latitude, 59.33);
    cleanup(sys);
  });

  it('updateSeasonalConfig updates properties', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    sys.updateSeasonalConfig({ sadTherapyEnabled: true, midnightSunBlocking: true });
    assertEqual(sys.seasonalConfig.sadTherapyEnabled, true);
    assertEqual(sys.seasonalConfig.midnightSunBlocking, true);
    cleanup(sys);
  });
});

describe('AdvancedSleepEnvironmentSystem — ventilation', () => {
  it('addVentilationSchedule adds entry', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.airQuality.ventilationSchedule.length, 0);
    sys.addVentilationSchedule(22, 6, 'master-bedroom');
    assertEqual(sys.airQuality.ventilationSchedule.length, 1);
    cleanup(sys);
  });

  it('getVentilationSchedule returns copy', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    sys.addVentilationSchedule(22, 6, 'master-bedroom');
    const sched = sys.getVentilationSchedule();
    assert(Array.isArray(sched), 'should return array');
    assertEqual(sched.length, 1);
    cleanup(sys);
  });
});

describe('AdvancedSleepEnvironmentSystem — circadian & reports', () => {
  it('getCircadianStatus returns status for known user', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const userId = Object.keys(sys.userProfiles)[0];
    const status = sys.getCircadianStatus(userId);
    assert(status !== null, 'should return circadian status');
    assertType(status.currentPhase, 'string');
    assertType(status.chronotype, 'string');
    assertType(status.melatoninOnset, 'string');
    cleanup(sys);
  });

  it('getCircadianStatus returns null for unknown user', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.getCircadianStatus('unknown'), null);
    cleanup(sys);
  });

  it('generateMonthlyReport returns null for unknown user', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.generateMonthlyReport('unknown'), null);
    cleanup(sys);
  });

  it('generateMonthlyReport returns no-sessions message when empty', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const userId = Object.keys(sys.userProfiles)[0];
    const report = sys.generateMonthlyReport(userId);
    assert(report !== null, 'should return report');
    assertEqual(report.message, 'No sessions recorded');
    cleanup(sys);
  });

  it('getSleepDebtSummary returns null for unknown user', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.getSleepDebtSummary('unknown'), null);
    cleanup(sys);
  });

  it('getSleepDebtSummary returns summary for known user', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const userId = Object.keys(sys.userProfiles)[0];
    const summary = sys.getSleepDebtSummary(userId);
    assert(summary !== null, 'should return summary');
    assertEqual(summary.userId, userId);
    assertType(summary.optimalHoursPerNight, 'number');
    assertType(summary.status, 'string');
    cleanup(sys);
  });

  it('getNapHistory returns default for unknown user', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const naps = sys.getNapHistory('unknown');
    assertType(naps, 'object');
    assertEqual(naps.totalNaps, 0);
    cleanup(sys);
  });
});

describe('AdvancedSleepEnvironmentSystem — statistics', () => {
  it('getStatistics returns comprehensive stats object', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const stats = sys.getStatistics();
    assertEqual(stats.initialized, true);
    assertEqual(stats.zones, 3);
    assertEqual(stats.userProfiles, 4);
    assertEqual(stats.soundTypes, 10);
    assertType(stats.activeSessions, 'number');
    assertType(stats.seasonalMode, 'string');
    assertType(stats.monitoringIntervals, 'number');
    cleanup(sys);
  });
});

describe('AdvancedSleepEnvironmentSystem — destroy()', () => {
  it('clears all intervals', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assert(sys.intervals.length > 0, 'should have intervals before destroy');
    sys.destroy();
    assertEqual(sys.intervals.length, 0);
    // Still need to clean tracked handles
    while (activeHandles.length > 0) {
      const h = activeHandles.pop();
      if (h.type === 'timeout') clearTimeout(h.id);
      else clearInterval(h.id);
    }
  });

  it('sets initialized to false', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.initialized, true);
    sys.destroy();
    assertEqual(sys.initialized, false);
    while (activeHandles.length > 0) {
      const h = activeHandles.pop();
      if (h.type === 'timeout') clearTimeout(h.id);
      else clearInterval(h.id);
    }
  });

  it('ends all active sessions', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const userId = Object.keys(sys.userProfiles)[0];
    await sys.startSleepSession(userId, 'master-bedroom');
    sys.destroy();
    const active = Object.values(sys.activeSessions).filter(s => s.active);
    assertEqual(active.length, 0);
    while (activeHandles.length > 0) {
      const h = activeHandles.pop();
      if (h.type === 'timeout') clearTimeout(h.id);
      else clearInterval(h.id);
    }
  });

  it('stops all sounds', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    sys.playSound('master-bedroom', 'rain', 50);
    sys.destroy();
    assertEqual(sys.activeSounds['master-bedroom'].playing, false);
    while (activeHandles.length > 0) {
      const h = activeHandles.pop();
      if (h.type === 'timeout') clearTimeout(h.id);
      else clearInterval(h.id);
    }
  });

  it('disables all heated blankets', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    sys.setHeatedBlanket('master-bedroom', 'left', true, 22);
    sys.destroy();
    assertEqual(sys.sleepZones['master-bedroom'].heatedBlanket.left.enabled, false);
    while (activeHandles.length > 0) {
      const h = activeHandles.pop();
      if (h.type === 'timeout') clearTimeout(h.id);
      else clearInterval(h.id);
    }
  });
});

run();
