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
  try { if (sys && sys.detectionInterval) clearInterval(sys.detectionInterval); } catch (_) {}
  try { if (sys && sys.learningInterval) clearInterval(sys.learningInterval); } catch (_) {}
  try { if (sys && typeof sys.destroy === 'function') sys.destroy(); } catch (_) {}
  while (activeHandles.length > 0) {
    const h = activeHandles.pop();
    if (h.type === 'timeout') clearTimeout(h.id); else clearInterval(h.id);
  }
}

const MoodActivityDetectionSystem = require('../lib/MoodActivityDetectionSystem');

describe('MoodActivityDetectionSystem — constructor & init', () => {
  it('instantiates without errors', () => {
    const sys = new MoodActivityDetectionSystem(createMockHomey());
    assert(sys, 'should create instance');
    assertEqual(sys.moodProfiles.size, 0);
    assertEqual(sys.activityProfiles.size, 0);
    assertEqual(sys.currentMood, null);
    assertEqual(sys.currentActivity, null);
    cleanup(sys);
  });

  it('initialize sets up default profiles', async () => {
    const sys = new MoodActivityDetectionSystem(createMockHomey());
    await sys.initialize();
    assert(sys.moodProfiles.size > 0, 'should have mood profiles');
    assert(sys.activityProfiles.size > 0, 'should have activity profiles');
    cleanup(sys);
  });

  it('initialize creates known mood profiles', async () => {
    const sys = new MoodActivityDetectionSystem(createMockHomey());
    await sys.initialize();
    assert(sys.moodProfiles.has('energetic'), 'should have energetic');
    assert(sys.moodProfiles.has('relaxed'), 'should have relaxed');
    assert(sys.moodProfiles.has('focused'), 'should have focused');
    assert(sys.moodProfiles.has('social'), 'should have social');
    assert(sys.moodProfiles.has('sleepy'), 'should have sleepy');
    cleanup(sys);
  });

  it('initialize creates known activity profiles', async () => {
    const sys = new MoodActivityDetectionSystem(createMockHomey());
    await sys.initialize();
    assert(sys.activityProfiles.has('sleeping'), 'should have sleeping');
    assert(sys.activityProfiles.has('working'), 'should have working');
    assert(sys.activityProfiles.has('cooking'), 'should have cooking');
    assert(sys.activityProfiles.has('away'), 'should have away');
    cleanup(sys);
  });
});

describe('MoodActivityDetectionSystem — time helpers', () => {
  it('getTimeOfDay returns a string', () => {
    const sys = new MoodActivityDetectionSystem(createMockHomey());
    const tod = sys.getTimeOfDay();
    assertType(tod, 'string');
    const valid = ['early_morning', 'morning', 'afternoon', 'evening', 'late_evening', 'night'];
    assert(valid.includes(tod), 'should be a valid time of day');
    cleanup(sys);
  });

  it('categorizeRoom maps known rooms', () => {
    const sys = new MoodActivityDetectionSystem(createMockHomey());
    assertEqual(sys.categorizeRoom('Master Bedroom'), 'bedroom');
    assertEqual(sys.categorizeRoom('Living Room'), 'living_room');
    assertEqual(sys.categorizeRoom('Kitchen'), 'kitchen');
    assertEqual(sys.categorizeRoom('Bathroom'), 'bathroom');
    assertEqual(sys.categorizeRoom('Home Office'), 'office');
    assertEqual(sys.categorizeRoom('Garage'), 'other');
    cleanup(sys);
  });
});

describe('MoodActivityDetectionSystem — mood scoring', () => {
  it('calculateMoodScore returns number between 0 and 1', async () => {
    const sys = new MoodActivityDetectionSystem(createMockHomey());
    await sys.initialize();
    const profile = sys.moodProfiles.get('energetic');
    const context = {
      devices: { activityLevel: 0.8, avgLighting: 0.8, avgVolume: 0.7 },
      time: { timeOfDay: 'morning', dayOfWeek: 2 },
      presence: { status: 'home', count: 1 },
      rooms: { bedroom: 0, living_room: 0, kitchen: 0, office: 1, other: 0 }
    };
    const score = sys.calculateMoodScore(profile, context);
    assertType(score, 'number');
    assert(score >= 0 && score <= 1, 'should be between 0 and 1');
    cleanup(sys);
  });

  it('calculateMoodScore returns 0 for empty indicators', () => {
    const sys = new MoodActivityDetectionSystem(createMockHomey());
    const score = sys.calculateMoodScore({ indicators: {} }, {
      devices: {}, time: {}, presence: {}, rooms: {}
    });
    assertEqual(score, 0);
    cleanup(sys);
  });
});

describe('MoodActivityDetectionSystem — activity scoring', () => {
  it('calculateActivityScore returns number between 0 and 1', async () => {
    const sys = new MoodActivityDetectionSystem(createMockHomey());
    await sys.initialize();
    const profile = sys.activityProfiles.get('working');
    const context = {
      devices: { activityLevel: 0.6, avgLighting: 0.7, avgVolume: 0.2 },
      time: { timeOfDay: 'morning', dayOfWeek: 2 },
      presence: { status: 'home', count: 1 },
      rooms: { office: 3, bedroom: 0, living_room: 0, kitchen: 0, bathroom: 0, other: 0 }
    };
    const score = sys.calculateActivityScore(profile, context);
    assertType(score, 'number');
    assert(score >= 0 && score <= 1, 'should be between 0 and 1');
    cleanup(sys);
  });
});

describe('MoodActivityDetectionSystem — pattern analysis', () => {
  it('analyzeMoodPatterns returns patterns', async () => {
    const sys = new MoodActivityDetectionSystem(createMockHomey());
    await sys.initialize();
    sys.moodHistory = [
      { mood: 'energetic', confidence: 0.8, timestamp: Date.now() },
      { mood: 'energetic', confidence: 0.9, timestamp: Date.now() },
      { mood: 'relaxed', confidence: 0.7, timestamp: Date.now() }
    ];
    const patterns = sys.analyzeMoodPatterns();
    assert(Array.isArray(patterns), 'should be array');
    assert(patterns.length >= 2, 'should have at least 2 patterns');
    cleanup(sys);
  });

  it('analyzeActivityPatterns returns patterns', async () => {
    const sys = new MoodActivityDetectionSystem(createMockHomey());
    await sys.initialize();
    sys.activityHistory = [
      { activity: 'working', confidence: 0.8, timestamp: Date.now() },
      { activity: 'relaxing', confidence: 0.7, timestamp: Date.now() }
    ];
    const patterns = sys.analyzeActivityPatterns();
    assert(Array.isArray(patterns), 'should be array');
    assert(patterns.length >= 2, 'should have at least 2 patterns');
    cleanup(sys);
  });
});

describe('MoodActivityDetectionSystem — statistics', () => {
  it('getStatistics returns full stats', async () => {
    const sys = new MoodActivityDetectionSystem(createMockHomey());
    await sys.initialize();
    const stats = sys.getStatistics();
    assert(stats, 'should return stats');
    assertType(stats.moodProfiles, 'number');
    assertType(stats.activityProfiles, 'number');
    assert(Array.isArray(stats.moodHistory), 'should have moodHistory');
    assert(Array.isArray(stats.activityHistory), 'should have activityHistory');
    assert(Array.isArray(stats.behaviorPatterns), 'should have behaviorPatterns');
    cleanup(sys);
  });
});

run();
