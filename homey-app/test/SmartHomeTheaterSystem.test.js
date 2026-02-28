'use strict';

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertType, assertRejects } = require('./helpers/assert');
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

const SmartHomeTheaterSystem = require('../lib/SmartHomeTheaterSystem');

/* ================================================================== */
/*  SmartHomeTheaterSystem – test suite                                */
/* ================================================================== */

describe('SmartHomeTheaterSystem — constructor & init', () => {
  it('instantiates without errors', () => {
    const sys = new SmartHomeTheaterSystem(createMockHomey());
    assert(sys, 'should create instance');
    cleanup(sys);
  });

  it('starts with empty theaters and scenes', () => {
    const sys = new SmartHomeTheaterSystem(createMockHomey());
    assertEqual(sys.theaters.size, 0);
    assertEqual(sys.scenes.size, 0);
    assertEqual(sys.currentSession, null);
    cleanup(sys);
  });

  it('initialize populates default theaters and scenes', async () => {
    const sys = new SmartHomeTheaterSystem(createMockHomey());
    await sys.initialize();
    assert(sys.theaters.size > 0, 'should have default theaters');
    assert(sys.scenes.size > 0, 'should have default scenes');
    cleanup(sys);
  });

  it('initialize starts monitoring interval', async () => {
    const sys = new SmartHomeTheaterSystem(createMockHomey());
    await sys.initialize();
    assert(sys.monitoringInterval !== null, 'monitoring interval should be set');
    cleanup(sys);
  });

  it('destroy clears interval and cache', async () => {
    const sys = new SmartHomeTheaterSystem(createMockHomey());
    await sys.initialize();
    await sys.destroy();
    assertEqual(sys._cache.size, 0);
    cleanup(sys);
  });
});

describe('SmartHomeTheaterSystem — theater & scene getters', () => {
  it('getTheaters returns array of theaters', async () => {
    const sys = new SmartHomeTheaterSystem(createMockHomey());
    await sys.initialize();
    const theaters = sys.getTheaters();
    assert(Array.isArray(theaters), 'should be array');
    assert(theaters.length > 0, 'should have theaters');
    cleanup(sys);
  });

  it('getTheater returns specific theater', async () => {
    const sys = new SmartHomeTheaterSystem(createMockHomey());
    await sys.initialize();
    const theater = sys.getTheater('main-theater');
    assert(theater, 'should return main theater');
    assertEqual(theater.id, 'main-theater');
    cleanup(sys);
  });

  it('getTheater returns undefined for unknown id', async () => {
    const sys = new SmartHomeTheaterSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.getTheater('nonexistent'), undefined);
    cleanup(sys);
  });

  it('getScenes returns array of scenes', async () => {
    const sys = new SmartHomeTheaterSystem(createMockHomey());
    await sys.initialize();
    const scenes = sys.getScenes();
    assert(Array.isArray(scenes), 'should be array');
    assert(scenes.length >= 4, 'should have at least 4 scenes');
    cleanup(sys);
  });

  it('getTheaters uses caching', async () => {
    const sys = new SmartHomeTheaterSystem(createMockHomey());
    await sys.initialize();
    const first = sys.getTheaters();
    const second = sys.getTheaters();
    assertEqual(first.length, second.length);
    cleanup(sys);
  });
});

describe('SmartHomeTheaterSystem — sessions', () => {
  it('getViewingSessions returns array', async () => {
    const sys = new SmartHomeTheaterSystem(createMockHomey());
    await sys.initialize();
    const sessions = sys.getViewingSessions();
    assert(Array.isArray(sessions), 'should be array');
    cleanup(sys);
  });

  it('getCurrentSession returns null initially', async () => {
    const sys = new SmartHomeTheaterSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.getCurrentSession(), null);
    cleanup(sys);
  });

  it('getViewingSessions supports limit parameter', async () => {
    const sys = new SmartHomeTheaterSystem(createMockHomey());
    await sys.initialize();
    const sessions = sys.getViewingSessions(null, 5);
    assert(Array.isArray(sessions), 'should be array');
    cleanup(sys);
  });
});

describe('SmartHomeTheaterSystem — scene activation', () => {
  it('activateScene throws for unknown scene', async () => {
    const sys = new SmartHomeTheaterSystem(createMockHomey());
    await sys.initialize();
    // Override delay to be instant for testing
    sys.delay = () => Promise.resolve();
    await assertRejects(() => sys.activateScene('nonexistent'), 'Scene not found');
    cleanup(sys);
  });

  it('activateScene throws for unknown theater', async () => {
    const sys = new SmartHomeTheaterSystem(createMockHomey());
    await sys.initialize();
    sys.delay = () => Promise.resolve();
    await assertRejects(() => sys.activateScene('movie-night', 'unknown-theater'), 'Theater not found');
    cleanup(sys);
  });

  it('activateScene activates movie-night scene', async () => {
    const sys = new SmartHomeTheaterSystem(createMockHomey());
    await sys.initialize();
    sys.delay = () => Promise.resolve();
    const result = await sys.activateScene('movie-night');
    assert(result, 'should return result');
    assert(result.scene, 'should have scene');
    assert(result.theater, 'should have theater');
    assert(result.session, 'should have session');
    assertEqual(result.theater.status, 'active');
    assertEqual(result.theater.activeScene, 'movie-night');
    cleanup(sys);
  });

  it('activateScene creates a viewing session', async () => {
    const sys = new SmartHomeTheaterSystem(createMockHomey());
    await sys.initialize();
    sys.delay = () => Promise.resolve();
    await sys.activateScene('gaming-mode');
    const session = sys.getCurrentSession();
    assert(session, 'should have current session');
    assertEqual(session.sceneId, 'gaming-mode');
    assertType(session.startTime, 'number');
    cleanup(sys);
  });

  it('theater-shutdown ends session', async () => {
    const sys = new SmartHomeTheaterSystem(createMockHomey());
    await sys.initialize();
    sys.delay = () => Promise.resolve();
    await sys.activateScene('movie-night');
    assert(sys.getCurrentSession(), 'should have active session');
    await sys.activateScene('theater-shutdown');
    assertEqual(sys.getCurrentSession(), null);
    const theater = sys.getTheater('main-theater');
    assertEqual(theater.status, 'off');
    cleanup(sys);
  });
});

describe('SmartHomeTheaterSystem — stats', () => {
  it('getStats returns comprehensive statistics', async () => {
    const sys = new SmartHomeTheaterSystem(createMockHomey());
    await sys.initialize();
    const stats = sys.getStats();
    assertType(stats.totalTheaters, 'number');
    assertType(stats.activeTheaters, 'number');
    assertType(stats.totalSessions, 'number');
    assertType(stats.totalViewingHours, 'number');
    assert(Array.isArray(stats.lampStatus), 'lampStatus should be array');
    assert(stats.lampStatus.length > 0, 'should have lamp status entries');
    assertType(stats.lampStatus[0].remainingPercent, 'number');
    cleanup(sys);
  });
});

describe('SmartHomeTheaterSystem — equipment control helpers', () => {
  it('controlAVReceiver sets receiver input', async () => {
    const sys = new SmartHomeTheaterSystem(createMockHomey());
    await sys.initialize();
    const theater = sys.getTheater('main-theater');
    await sys.controlAVReceiver(theater, { action: 'powerOn', input: 'HDMI3' });
    assertEqual(theater.equipment.avReceiver.status, 'on');
    assertEqual(theater.equipment.avReceiver.input, 'HDMI3');
    cleanup(sys);
  });

  it('controlLighting sets zone lighting', async () => {
    const sys = new SmartHomeTheaterSystem(createMockHomey());
    await sys.initialize();
    const theater = sys.getTheater('main-theater');
    await sys.controlLighting(theater, { zone: 'floor', action: 'on', brightness: 50, color: 'red' });
    assertEqual(theater.equipment.lighting.floor.enabled, true);
    assertEqual(theater.equipment.lighting.floor.brightness, 50);
    assertEqual(theater.equipment.lighting.floor.color, 'red');
    cleanup(sys);
  });

  it('controlLighting sets all zones at once', async () => {
    const sys = new SmartHomeTheaterSystem(createMockHomey());
    await sys.initialize();
    const theater = sys.getTheater('main-theater');
    await sys.controlLighting(theater, { zone: 'all', action: 'on', brightness: 80 });
    for (const zone of Object.values(theater.equipment.lighting)) {
      assertEqual(zone.enabled, true);
      assertEqual(zone.brightness, 80);
    }
    cleanup(sys);
  });

  it('controlSubwoofer boosts volume', async () => {
    const sys = new SmartHomeTheaterSystem(createMockHomey());
    await sys.initialize();
    const theater = sys.getTheater('main-theater');
    const originalVol = theater.equipment.speakers.subwoofer.volume;
    await sys.controlSubwoofer(theater, { action: 'boost', level: 8 });
    assertEqual(theater.equipment.speakers.subwoofer.volume, originalVol + 8);
    cleanup(sys);
  });

  it('applyAudioProfile sets receiver volume', async () => {
    const sys = new SmartHomeTheaterSystem(createMockHomey());
    await sys.initialize();
    const theater = sys.getTheater('main-theater');
    await sys.applyAudioProfile(theater, 'gaming');
    assertEqual(theater.equipment.avReceiver.volume, theater.presets.gaming.volume);
    cleanup(sys);
  });
});

run();
