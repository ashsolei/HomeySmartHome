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

const HomeGymFitnessSystem = require('../lib/HomeGymFitnessSystem');

describe('HomeGym — constructor & lifecycle', () => {
  it('instantiates without errors', () => {
    const sys = new HomeGymFitnessSystem(createMockHomey());
    assert(sys, 'should create instance');
    cleanup(sys);
  });

  it('constructor sets defaults', () => {
    const sys = new HomeGymFitnessSystem(createMockHomey());
    assertEqual(sys.workoutSessions.length, 0);
    assertEqual(sys.equipment.size, 0);
    assertEqual(sys.activeSession, null);
    cleanup(sys);
  });

  it('initialize populates equipment and programs', async () => {
    const sys = new HomeGymFitnessSystem(createMockHomey());
    await sys.initialize();
    assert(sys.equipment.size >= 4, 'should have equipment');
    assert(sys.workoutPrograms.size >= 3, 'should have programs');
    assert(sys.userProfiles.size >= 1, 'should have user profiles');
    cleanup(sys);
  });

  it('destroy clears monitoring', async () => {
    const sys = new HomeGymFitnessSystem(createMockHomey());
    await sys.initialize();
    await sys.destroy();
    cleanup(sys);
  });
});

describe('HomeGym — equipment & programs', () => {
  it('getEquipment returns array', async () => {
    const sys = new HomeGymFitnessSystem(createMockHomey());
    await sys.initialize();
    const equipment = sys.getEquipment();
    assert(Array.isArray(equipment), 'should be array');
    assert(equipment.length >= 4, 'should have equipment');
    cleanup(sys);
  });

  it('getWorkoutPrograms returns array', async () => {
    const sys = new HomeGymFitnessSystem(createMockHomey());
    await sys.initialize();
    const programs = sys.getWorkoutPrograms();
    assert(Array.isArray(programs), 'should be array');
    assert(programs.length >= 3, 'should have programs');
    cleanup(sys);
  });

  it('getUserProfile returns profile for default user', async () => {
    const sys = new HomeGymFitnessSystem(createMockHomey());
    await sys.initialize();
    const profile = sys.getUserProfile('default');
    assert(profile, 'should return profile');
    assertEqual(profile.userId, 'default');
    assertType(profile.weight, 'number');
    assertType(profile.height, 'number');
    cleanup(sys);
  });

  it('getUserProfile returns undefined for unknown user', async () => {
    const sys = new HomeGymFitnessSystem(createMockHomey());
    await sys.initialize();
    const profile = sys.getUserProfile('nonexistent');
    assertEqual(profile, undefined);
    cleanup(sys);
  });
});

describe('HomeGym — workout sessions', () => {
  it('startWorkout creates active session', async () => {
    const sys = new HomeGymFitnessSystem(createMockHomey());
    await sys.initialize();
    const session = await sys.startWorkout('default', 'beginner-cardio');
    assert(session, 'should return session');
    assert(session.id, 'should have id');
    assertEqual(session.userId, 'default');
    assert(session.program, 'should have program');
    assert(session.startTime, 'should have start time');
    assertEqual(session.endTime, null);
    cleanup(sys);
  });

  it('startWorkout throws for unknown user', async () => {
    const sys = new HomeGymFitnessSystem(createMockHomey());
    await sys.initialize();
    let threw = false;
    try { await sys.startWorkout('nonexistent'); } catch (_) { threw = true; }
    assertEqual(threw, true);
    cleanup(sys);
  });

  it('startWorkout throws if session already active', async () => {
    const sys = new HomeGymFitnessSystem(createMockHomey());
    await sys.initialize();
    await sys.startWorkout('default');
    let threw = false;
    try { await sys.startWorkout('default'); } catch (_) { threw = true; }
    assertEqual(threw, true);
    cleanup(sys);
  });

  it('startWorkout activates equipment', async () => {
    const sys = new HomeGymFitnessSystem(createMockHomey());
    await sys.initialize();
    await sys.startWorkout('default', 'beginner-cardio');
    const treadmill = sys.equipment.get('treadmill-1');
    assertEqual(treadmill.status, 'active');
    cleanup(sys);
  });

  it('getActiveSession returns current session', async () => {
    const sys = new HomeGymFitnessSystem(createMockHomey());
    await sys.initialize();
    await sys.startWorkout('default');
    const active = sys.getActiveSession();
    assert(active, 'should return active session');
    assertEqual(active.userId, 'default');
    cleanup(sys);
  });

  it('getActiveSession returns null when no session', async () => {
    const sys = new HomeGymFitnessSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.getActiveSession(), null);
    cleanup(sys);
  });
});

describe('HomeGym — exercise logging', () => {
  it('logExercise records exercise', async () => {
    const sys = new HomeGymFitnessSystem(createMockHomey());
    await sys.initialize();
    await sys.startWorkout('default');
    const exercise = await sys.logExercise({
      name: 'Running', type: 'cardio', duration: 20, distance: 3, calories: 200
    });
    assert(exercise, 'should return exercise');
    assertEqual(exercise.name, 'Running');
    assertEqual(exercise.calories, 200);
    assertEqual(sys.activeSession.totalCalories, 200);
    assertEqual(sys.activeSession.distance, 3);
    cleanup(sys);
  });

  it('logExercise throws when no active session', async () => {
    const sys = new HomeGymFitnessSystem(createMockHomey());
    await sys.initialize();
    let threw = false;
    try { await sys.logExercise({ name: 'Run' }); } catch (_) { threw = true; }
    assertEqual(threw, true);
    cleanup(sys);
  });
});

describe('HomeGym — heart rate', () => {
  it('updateHeartRate updates session heart rate', async () => {
    const sys = new HomeGymFitnessSystem(createMockHomey());
    await sys.initialize();
    await sys.startWorkout('default');
    await sys.updateHeartRate(140);
    assertEqual(sys.activeSession.currentHeartRate, 140);
    assertEqual(sys.activeSession.maxHeartRate, 140);
    cleanup(sys);
  });

  it('updateHeartRate tracks max heart rate', async () => {
    const sys = new HomeGymFitnessSystem(createMockHomey());
    await sys.initialize();
    await sys.startWorkout('default');
    await sys.updateHeartRate(120);
    await sys.updateHeartRate(160);
    await sys.updateHeartRate(130);
    assertEqual(sys.activeSession.maxHeartRate, 160);
    cleanup(sys);
  });

  it('getHeartRateZone returns zone name', async () => {
    const sys = new HomeGymFitnessSystem(createMockHomey());
    await sys.initialize();
    const profile = sys.getUserProfile('default');
    const zone = sys.getHeartRateZone(140, profile.heartRateZones);
    assertType(zone, 'string');
    cleanup(sys);
  });
});

describe('HomeGym — workout completion', () => {
  it('completeWorkout finalizes session', async () => {
    const sys = new HomeGymFitnessSystem(createMockHomey());
    await sys.initialize();
    await sys.startWorkout('default', 'beginner-cardio');
    await sys.logExercise({ name: 'Running', type: 'cardio', duration: 20, calories: 200 });
    const session = await sys.completeWorkout();
    assert(session.endTime, 'should have end time');
    assertType(session.duration, 'number');
    assertEqual(sys.activeSession, null);
    assert(sys.workoutSessions.length >= 1, 'should save session');
    cleanup(sys);
  });

  it('completeWorkout updates user stats', async () => {
    const sys = new HomeGymFitnessSystem(createMockHomey());
    await sys.initialize();
    await sys.startWorkout('default');
    await sys.completeWorkout();
    const profile = sys.getUserProfile('default');
    assertEqual(profile.stats.totalWorkouts, 1);
    assert(profile.stats.currentStreak >= 1, 'should increment streak');
    cleanup(sys);
  });

  it('completeWorkout throws when no active session', async () => {
    const sys = new HomeGymFitnessSystem(createMockHomey());
    await sys.initialize();
    let threw = false;
    try { await sys.completeWorkout(); } catch (_) { threw = true; }
    assertEqual(threw, true);
    cleanup(sys);
  });

  it('completeWorkout resets equipment to idle', async () => {
    const sys = new HomeGymFitnessSystem(createMockHomey());
    await sys.initialize();
    await sys.startWorkout('default', 'beginner-cardio');
    await sys.completeWorkout();
    const treadmill = sys.equipment.get('treadmill-1');
    assertEqual(treadmill.status, 'idle');
    cleanup(sys);
  });
});

describe('HomeGym — recommendations & stats', () => {
  it('getWorkoutRecommendation returns recommendation', async () => {
    const sys = new HomeGymFitnessSystem(createMockHomey());
    await sys.initialize();
    const rec = await sys.getWorkoutRecommendation('default');
    assert(rec, 'should return recommendation');
    assert(rec.program, 'should have program');
    assertType(rec.reason, 'string');
    assertType(rec.recentWorkouts, 'number');
    cleanup(sys);
  });

  it('getWorkoutRecommendation throws for unknown user', async () => {
    const sys = new HomeGymFitnessSystem(createMockHomey());
    await sys.initialize();
    let threw = false;
    try { await sys.getWorkoutRecommendation('nonexistent'); } catch (_) { threw = true; }
    assertEqual(threw, true);
    cleanup(sys);
  });

  it('getWorkoutHistory returns history', async () => {
    const sys = new HomeGymFitnessSystem(createMockHomey());
    await sys.initialize();
    const history = sys.getWorkoutHistory('default');
    assert(Array.isArray(history), 'should be array');
    cleanup(sys);
  });

  it('getStats returns user stats', async () => {
    const sys = new HomeGymFitnessSystem(createMockHomey());
    await sys.initialize();
    const stats = sys.getStats('default');
    assert(stats, 'should return stats');
    assertEqual(stats.user, 'Default User');
    assert(stats.stats, 'should have stats');
    assert(stats.goals, 'should have goals');
    assert(stats.recentActivity, 'should have recentActivity');
    cleanup(sys);
  });

  it('getStats returns null for unknown user', async () => {
    const sys = new HomeGymFitnessSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.getStats('nonexistent'), null);
    cleanup(sys);
  });
});

run();
