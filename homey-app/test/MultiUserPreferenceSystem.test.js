'use strict';

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertType: _assertType } = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');

const _origSetTimeout = global.setTimeout;
const _origSetInterval = global.setInterval;
const activeHandles = [];
global.setTimeout = (...a) => { const id = _origSetTimeout(...a); activeHandles.push({ type: 'timeout', id }); return id; };
global.setInterval = (...a) => { const id = _origSetInterval(...a); activeHandles.push({ type: 'interval', id }); return id; };
function cleanup(sys) {
  try { if (sys && sys.learningInterval) clearInterval(sys.learningInterval); } catch (_) {}
  try { if (sys && typeof sys.destroy === 'function') sys.destroy(); } catch (_) {}
  while (activeHandles.length > 0) {
    const h = activeHandles.pop();
    if (h.type === 'timeout') clearTimeout(h.id); else clearInterval(h.id);
  }
}

const MultiUserPreferenceSystem = require('../lib/MultiUserPreferenceSystem');

describe('MultiUserPreferenceSystem — constructor & init', () => {
  it('instantiates without errors', () => {
    const sys = new MultiUserPreferenceSystem(createMockHomey());
    assert(sys, 'should create instance');
    assertEqual(sys.users.size, 0);
    assertEqual(sys.preferences.size, 0);
    assertEqual(sys.profiles.size, 0);
    assertEqual(sys.activeUser, null);
    cleanup(sys);
  });

  it('initialize creates default user', async () => {
    const sys = new MultiUserPreferenceSystem(createMockHomey());
    await sys.initialize();
    assert(sys.users.size > 0, 'should have users');
    assert(sys.users.has('default'), 'should have default user');
    assertEqual(sys.activeUser, 'default');
    cleanup(sys);
  });

  it('initialize creates default preferences', async () => {
    const sys = new MultiUserPreferenceSystem(createMockHomey());
    await sys.initialize();
    assert(sys.preferences.has('default'), 'should have default preferences');
    const prefs = sys.preferences.get('default');
    assertEqual(prefs.climate.preferredTemperature, 21);
    cleanup(sys);
  });

  it('initialize creates default profile', async () => {
    const sys = new MultiUserPreferenceSystem(createMockHomey());
    await sys.initialize();
    assert(sys.profiles.has('default'), 'should have default profile');
    cleanup(sys);
  });
});

describe('MultiUserPreferenceSystem — user management', () => {
  it('createUser adds user', async () => {
    const sys = new MultiUserPreferenceSystem(createMockHomey());
    await sys.initialize();
    const user = await sys.createUser({ id: 'user2', name: 'Test User', role: 'user' });
    assert(user, 'should return user');
    assertEqual(user.id, 'user2');
    assertEqual(user.name, 'Test User');
    assertEqual(user.role, 'user');
    assert(sys.users.has('user2'), 'should be stored');
    cleanup(sys);
  });

  it('createUser generates id if not provided', async () => {
    const sys = new MultiUserPreferenceSystem(createMockHomey());
    await sys.initialize();
    const user = await sys.createUser({ name: 'Auto ID' });
    assert(user.id, 'should have auto-generated id');
    assert(user.id.startsWith('user_'), 'id should start with user_');
    cleanup(sys);
  });

  it('setActiveUser switches user', async () => {
    const sys = new MultiUserPreferenceSystem(createMockHomey());
    await sys.initialize();
    await sys.createUser({ id: 'u2', name: 'User 2' });
    const user = await sys.setActiveUser('u2');
    assertEqual(sys.activeUser, 'u2');
    assertEqual(user.name, 'User 2');
    assert(user.lastActive, 'should have lastActive');
    cleanup(sys);
  });

  it('setActiveUser throws for unknown user', async () => {
    const sys = new MultiUserPreferenceSystem(createMockHomey());
    await sys.initialize();
    try {
      await sys.setActiveUser('nonexistent');
      assert(false, 'should have thrown');
    } catch (e) {
      assert(e.message.includes('not found'), 'should mention not found');
    }
    cleanup(sys);
  });

  it('deleteUserData removes user', async () => {
    const sys = new MultiUserPreferenceSystem(createMockHomey());
    await sys.initialize();
    await sys.createUser({ id: 'temp', name: 'Temp' });
    await sys.deleteUserData('temp');
    assertEqual(sys.users.has('temp'), false);
    assertEqual(sys.preferences.has('temp'), false);
    assertEqual(sys.profiles.has('temp'), false);
    cleanup(sys);
  });
});

describe('MultiUserPreferenceSystem — preferences', () => {
  it('updatePreferences updates nested prefs', async () => {
    const sys = new MultiUserPreferenceSystem(createMockHomey());
    await sys.initialize();
    const updated = await sys.updatePreferences('default', {
      climate: { preferredTemperature: 23 }
    });
    assertEqual(updated.climate.preferredTemperature, 23);
    cleanup(sys);
  });

  it('updatePreferences throws for unknown user', async () => {
    const sys = new MultiUserPreferenceSystem(createMockHomey());
    await sys.initialize();
    try {
      await sys.updatePreferences('nonexistent', {});
      assert(false, 'should have thrown');
    } catch (e) {
      assert(e.message.includes('not found'), 'should mention not found');
    }
    cleanup(sys);
  });
});

describe('MultiUserPreferenceSystem — learning', () => {
  it('learnPreference records temperature data', async () => {
    const sys = new MultiUserPreferenceSystem(createMockHomey());
    await sys.initialize();
    await sys.learnPreference('default', 'temperature', {
      temperature: 22,
      time: Date.now(),
      context: 'evening'
    });
    const profile = sys.profiles.get('default');
    assert(profile.learned.temperaturePreferences.length >= 1, 'should have temp data');
    cleanup(sys);
  });

  it('learnPreference records lighting data', async () => {
    const sys = new MultiUserPreferenceSystem(createMockHomey());
    await sys.initialize();
    await sys.learnPreference('default', 'lighting', {
      deviceId: 'lamp1',
      brightness: 80,
      colorTemp: 4000,
      time: Date.now()
    });
    const profile = sys.profiles.get('default');
    assert(profile.learned.lightingPreferences.length >= 1, 'should have lighting data');
    cleanup(sys);
  });

  it('learnPreference records device usage', async () => {
    const sys = new MultiUserPreferenceSystem(createMockHomey());
    await sys.initialize();
    await sys.learnPreference('default', 'device_usage', {
      deviceId: 'dev1',
      action: 'on',
      timestamp: Date.now()
    });
    const profile = sys.profiles.get('default');
    assert(profile.learned.deviceUsage['dev1'], 'should have device usage');
    assertEqual(profile.learned.deviceUsage['dev1'].usageCount, 1);
    cleanup(sys);
  });
});

describe('MultiUserPreferenceSystem — conflict resolution', () => {
  it('resolveConflict temperature averages values', async () => {
    const sys = new MultiUserPreferenceSystem(createMockHomey());
    await sys.initialize();
    await sys.createUser({ id: 'u2', name: 'User 2' });
    const result = await sys.resolveConflict({
      type: 'temperature',
      users: ['default', 'u2'],
      values: [{ temperature: 20 }, { temperature: 24 }]
    });
    assertEqual(result.resolution, 'average');
    assertEqual(result.value, 22);
    cleanup(sys);
  });

  it('resolveConflict scene uses voting', async () => {
    const sys = new MultiUserPreferenceSystem(createMockHomey());
    await sys.initialize();
    await sys.createUser({ id: 'u2', name: 'User 2' });
    await sys.createUser({ id: 'u3', name: 'User 3' });
    const result = await sys.resolveConflict({
      type: 'scene',
      users: ['default', 'u2', 'u3'],
      values: [{ sceneId: 'movie' }, { sceneId: 'relax' }, { sceneId: 'movie' }]
    });
    assertEqual(result.resolution, 'vote');
    assertEqual(result.value.sceneId, 'movie');
    cleanup(sys);
  });
});

describe('MultiUserPreferenceSystem — profile & export', () => {
  it('getUserProfile returns full profile', async () => {
    const sys = new MultiUserPreferenceSystem(createMockHomey());
    await sys.initialize();
    const profile = sys.getUserProfile('default');
    assert(profile, 'should return profile');
    assert(profile.user, 'should have user');
    assert(profile.preferences, 'should have preferences');
    assert(profile.profile, 'should have profile');
    assert(Array.isArray(profile.insights), 'should have insights');
    cleanup(sys);
  });

  it('getUserProfile returns null for unknown user', async () => {
    const sys = new MultiUserPreferenceSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.getUserProfile('nonexistent'), null);
    cleanup(sys);
  });

  it('exportUserData returns user data', async () => {
    const sys = new MultiUserPreferenceSystem(createMockHomey());
    await sys.initialize();
    const data = await sys.exportUserData('default');
    assert(data, 'should return data');
    assert(data.user, 'should have user');
    assert(data.preferences, 'should have preferences');
    assert(data.exported, 'should have exported timestamp');
    cleanup(sys);
  });

  it('exportUserData throws for unknown user', async () => {
    const sys = new MultiUserPreferenceSystem(createMockHomey());
    await sys.initialize();
    try {
      await sys.exportUserData('nonexistent');
      assert(false, 'should have thrown');
    } catch (e) {
      assert(e.message.includes('not found'), 'should mention not found');
    }
    cleanup(sys);
  });

  it('getUserPriority returns correct priorities', () => {
    const sys = new MultiUserPreferenceSystem(createMockHomey());
    assertEqual(sys.getUserPriority({ role: 'admin' }), 3);
    assertEqual(sys.getUserPriority({ role: 'user' }), 2);
    assertEqual(sys.getUserPriority({ role: 'guest' }), 1);
    cleanup(sys);
  });
});

describe('MultiUserPreferenceSystem — helpers', () => {
  it('calculateMean computes correct mean', () => {
    const sys = new MultiUserPreferenceSystem(createMockHomey());
    assertEqual(sys.calculateMean([10, 20, 30]), 20);
    assertEqual(sys.calculateMean([]), 0);
    cleanup(sys);
  });

  it('findMostCommon finds correct value', () => {
    const sys = new MultiUserPreferenceSystem(createMockHomey());
    assertEqual(sys.findMostCommon([1, 2, 2, 3, 2]), 2);
    cleanup(sys);
  });

  it('generateUserId creates unique ids', () => {
    const sys = new MultiUserPreferenceSystem(createMockHomey());
    const id1 = sys.generateUserId();
    const id2 = sys.generateUserId();
    assert(id1 !== id2, 'ids should be unique');
    assert(id1.startsWith('user_'), 'should start with user_');
    cleanup(sys);
  });

  it('deepMerge merges nested objects', () => {
    const sys = new MultiUserPreferenceSystem(createMockHomey());
    const target = { a: { b: 1, c: 2 } };
    sys.deepMerge(target, { a: { b: 3 } });
    assertEqual(target.a.b, 3);
    cleanup(sys);
  });
});

run();
