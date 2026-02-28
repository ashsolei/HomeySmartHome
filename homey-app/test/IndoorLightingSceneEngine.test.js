'use strict';

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertDeepEqual, assertType, assertInstanceOf } = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');

/* ── Timer-leak prevention ─────────────────────────────────────────── */
const _origSetTimeout = global.setTimeout;
const _origSetInterval = global.setInterval;
const activeHandles = [];
global.setTimeout = (...args) => { const id = _origSetTimeout(...args); activeHandles.push({ type: 'timeout', id }); return id; };
global.setInterval = (...args) => { const id = _origSetInterval(...args); activeHandles.push({ type: 'interval', id }); return id; };

function cleanup(sys) {
  try {
    if (sys.circadianInterval) clearInterval(sys.circadianInterval);
    if (sys.scheduleInterval) clearInterval(sys.scheduleInterval);
    if (sys.monitoringInterval) clearInterval(sys.monitoringInterval);
    if (sys.partyInterval) clearInterval(sys.partyInterval);
    if (sys.activeTransitions) {
      for (const t of sys.activeTransitions.values()) clearInterval(t);
      sys.activeTransitions.clear();
    }
  } catch (_) { /* ignore */ }
  while (activeHandles.length > 0) {
    const h = activeHandles.pop();
    if (h.type === 'timeout') clearTimeout(h.id);
    else clearInterval(h.id);
  }
}

/* ── Helpers ───────────────────────────────────────────────────────── */
const IndoorLightingSceneEngine = require('../lib/IndoorLightingSceneEngine');

function makeMock(devices = []) {
  return createMockHomey({
    drivers: { getDevices: () => devices },
    app: { advancedNotificationManager: null }
  });
}

function _makeLightDevice(id, name, capabilities = ['onoff', 'dim', 'light_temperature']) {
  return {
    id,
    name,
    zone: 'living_room',
    capabilities,
    setCapabilityValue: async () => {},
    getCapabilityValue: async (cap) => {
      if (cap === 'dim') return 0.5;
      if (cap === 'light_temperature') return 0.4;
      if (cap === 'onoff') return true;
      return null;
    }
  };
}

/* ── Constructor ───────────────────────────────────────────────────── */
describe('IndoorLightingSceneEngine — constructor', () => {
  it('creates instance with correct defaults', () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    assertInstanceOf(sys.lights, Map);
    assertInstanceOf(sys.zones, Map);
    assertInstanceOf(sys.scenes, Map);
    assertInstanceOf(sys.activeScenes, Map);
    assertInstanceOf(sys.lightGroups, Map);
    assertEqual(sys.lights.size, 0);
    assertEqual(sys.zones.size, 0);
    assertEqual(sys.scenes.size, 0);
    assertEqual(sys.partyModeActive, false);
    assertEqual(sys.focusModeActive, false);
    assertEqual(sys.guestModeActive, false);
    assertType(sys.sceneHistory, 'object'); // array
    assert(Array.isArray(sys.sceneHistory));
    assertEqual(sys.sceneHistory.length, 0);
    assert(Array.isArray(sys.schedules));
    assertEqual(sys.schedules.length, 0);
    cleanup(sys);
  });
});

/* ── Preset Library ────────────────────────────────────────────────── */
describe('IndoorLightingSceneEngine — loadPresetLibrary', () => {
  it('loads 22 preset scenes', () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    sys.loadPresetLibrary();
    assertEqual(sys.scenes.size, 22);
    const bright = sys.scenes.get('bright_daylight');
    assert(bright !== undefined);
    assertEqual(bright.type, 'preset');
    assertType(bright.brightness, 'number');
    assertType(bright.colorTemp, 'number');
    cleanup(sys);
  });
});

/* ── Activity Scenes ───────────────────────────────────────────────── */
describe('IndoorLightingSceneEngine — setupActivityScenes', () => {
  it('creates 5 activity scenes', () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    sys.setupActivityScenes();
    const activities = [...sys.scenes.values()].filter(s => s.type === 'activity');
    assertEqual(activities.length, 5);
    const work = sys.scenes.get('activity_work');
    assert(work !== undefined);
    assertEqual(work.type, 'activity');
    assert(Array.isArray(work.zones));
    cleanup(sys);
  });
});

/* ── Color Themes ──────────────────────────────────────────────────── */
describe('IndoorLightingSceneEngine — setupColorThemes', () => {
  it('creates 9 color themes', () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    sys.setupColorThemes();
    const themes = [...sys.scenes.values()].filter(s => s.type === 'theme');
    assertEqual(themes.length, 9);
    const xmas = sys.scenes.get('theme_christmas');
    assert(xmas !== undefined);
    assertEqual(xmas.type, 'theme');
    assertType(xmas.hue, 'number');
    cleanup(sys);
  });
});

/* ── Setup Zones ───────────────────────────────────────────────────── */
describe('IndoorLightingSceneEngine — setupZones', () => {
  it('creates default zones when no lights exist', () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    sys.setupZones();
    // 6 defaults + possibly 'other'
    assert(sys.zones.size >= 6);
    assert(sys.zones.has('living_room'));
    assert(sys.zones.has('kitchen'));
    assert(sys.zones.has('bedroom'));
    assert(sys.zones.has('bathroom'));
    assert(sys.zones.has('hallway'));
    assert(sys.zones.has('office'));
    const lr = sys.zones.get('living_room');
    assertType(lr.name, 'string');
    assert(Array.isArray(lr.lights));
    cleanup(sys);
  });
});

/* ── createScene ───────────────────────────────────────────────────── */
describe('IndoorLightingSceneEngine — createScene', () => {
  it('creates a custom scene with valid config', async () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    const result = await sys.createScene({
      id: 'test_scene',
      name: 'Test Scene',
      brightness: 75,
      colorTemp: 3500,
      type: 'custom',
      transitionDuration: 5
    });
    assertEqual(result.success, true);
    assert(result.scene !== undefined);
    assertEqual(sys.scenes.has('test_scene'), true);
    cleanup(sys);
  });

  it('rejects duplicate scene id without overwrite', async () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    await sys.createScene({ id: 'dup', name: 'A', brightness: 50, colorTemp: 3000 });
    const result = await sys.createScene({ id: 'dup', name: 'B', brightness: 60, colorTemp: 4000 });
    assertEqual(result.success, false);
    assertEqual(result.reason, 'exists');
    cleanup(sys);
  });

  it('clamps brightness to 0-100 range', async () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    const r1 = await sys.createScene({ id: 's1', name: 'High', brightness: 200, colorTemp: 3000 });
    assertEqual(r1.success, true);
    assert(r1.scene.brightness <= 100);
    const r2 = await sys.createScene({ id: 's2', name: 'Low', brightness: -10, colorTemp: 3000 });
    assertEqual(r2.success, true);
    assert(r2.scene.brightness >= 0);
    cleanup(sys);
  });

  it('clamps colorTemp to 2000-6500 range', async () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    const r1 = await sys.createScene({ id: 'ct1', name: 'Hot', brightness: 50, colorTemp: 9000 });
    assertEqual(r1.success, true);
    assert(r1.scene.colorTemp <= 6500);
    const r2 = await sys.createScene({ id: 'ct2', name: 'Cold', brightness: 50, colorTemp: 500 });
    assertEqual(r2.success, true);
    assert(r2.scene.colorTemp >= 2000);
    cleanup(sys);
  });
});

/* ── activateScene ─────────────────────────────────────────────────── */
describe('IndoorLightingSceneEngine — activateScene', () => {
  it('returns not_found for unknown scene', async () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    const result = await sys.activateScene('nonexistent', null);
    assertEqual(result.success, false);
    assertEqual(result.reason, 'not_found');
    cleanup(sys);
  });

  it('activates a preset scene successfully', async () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    sys.loadPresetLibrary();
    sys.setupZones();
    const result = await sys.activateScene('warm_white', ['living_room']);
    assertEqual(result.success, true);
    assert(Array.isArray(result.applied));
    cleanup(sys);
  });

  it('restricts non-preset scenes in guest mode', async () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    sys.loadPresetLibrary();
    sys.setupActivityScenes();
    sys.setupZones();
    sys.guestModeActive = true;
    sys.guestAllowedZones = null;
    const result = await sys.activateScene('activity_work', ['office']);
    assertEqual(result.success, false);
    cleanup(sys);
  });
});

/* ── deactivateScene ───────────────────────────────────────────────── */
describe('IndoorLightingSceneEngine — deactivateScene', () => {
  it('returns not_active for scene that is not active', async () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    const result = await sys.deactivateScene('not_active_scene');
    assertEqual(result.success, false);
    assertEqual(result.reason, 'not_active');
    cleanup(sys);
  });
});

/* ── Circadian Interpolation ───────────────────────────────────────── */
describe('IndoorLightingSceneEngine — _interpolateCircadian', () => {
  it('returns object with colorTemp and brightness', () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    const result = sys._interpolateCircadian(720); // 12:00 noon
    assertType(result.colorTemp, 'number');
    assertType(result.brightness, 'number');
    assert(result.colorTemp >= 2000);
    assert(result.colorTemp <= 6500);
    assert(result.brightness >= 0);
    assert(result.brightness <= 100);
    cleanup(sys);
  });

  it('returns different values for morning vs evening', () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    const morning = sys._interpolateCircadian(480);  // 08:00
    const evening = sys._interpolateCircadian(1320); // 22:00
    // Morning should generally be cooler/brighter than evening
    assert(morning.colorTemp !== evening.colorTemp || morning.brightness !== evening.brightness);
    cleanup(sys);
  });
});

/* ── Adaptive Brightness ───────────────────────────────────────────── */
describe('IndoorLightingSceneEngine — adjustBrightnessFromSensor', () => {
  it('returns brightness object for valid lux value', async () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    const result = await sys.adjustBrightnessFromSensor(300);
    assert(result !== null);
    assertType(result.brightness, 'number');
    assertEqual(result.sensorLux, 300);
    cleanup(sys);
  });

  it('handles NaN input gracefully', async () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    const result = await sys.adjustBrightnessFromSensor(NaN);
    // May return result or null depending on implementation
    if (result !== null) {
      assertType(result.sensorLux, 'number');
    }
    cleanup(sys);
  });
});

/* ── Sunrise / Sunset Simulation ───────────────────────────────────── */
describe('IndoorLightingSceneEngine — sunrise/sunset simulation', () => {
  it('startSunriseSimulation fails for unknown zone', async () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    sys.setupZones();
    const result = await sys.startSunriseSimulation('nonexistent_zone');
    assertEqual(result.success, false);
    assertEqual(result.reason, 'zone_not_found');
    cleanup(sys);
  });

  it('startSunriseSimulation succeeds for valid zone', async () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    sys.setupZones();
    const result = await sys.startSunriseSimulation('bedroom', 10);
    assertEqual(result.success, true);
    assertType(result.zone, 'string');
    assertEqual(result.duration, 10);
    cleanup(sys);
  });

  it('startSunsetSimulation fails for unknown zone', async () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    sys.setupZones();
    const result = await sys.startSunsetSimulation('fake_zone');
    assertEqual(result.success, false);
    assertEqual(result.reason, 'zone_not_found');
    cleanup(sys);
  });

  it('startSunsetSimulation succeeds for valid zone', async () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    sys.setupZones();
    const result = await sys.startSunsetSimulation('living_room', 20);
    assertEqual(result.success, true);
    assertType(result.zone, 'string');
    assertEqual(result.duration, 20);
    cleanup(sys);
  });
});

/* ── Party Mode ────────────────────────────────────────────────────── */
describe('IndoorLightingSceneEngine — party mode', () => {
  it('enables party mode and sets flag', async () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    const result = await sys.enablePartyMode({ speed: 500 });
    assertEqual(result.success, true);
    assertEqual(result.mode, 'party');
    assertEqual(sys.partyModeActive, true);
    cleanup(sys);
  });

  it('disables party mode', async () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    await sys.enablePartyMode({});
    const result = await sys.disablePartyMode();
    assertEqual(result.success, true);
    assertEqual(sys.partyModeActive, false);
    cleanup(sys);
  });
});

/* ── Focus Mode ────────────────────────────────────────────────────── */
describe('IndoorLightingSceneEngine — focus mode', () => {
  it('enables focus mode with default office zone', async () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    sys.setupZones();
    const result = await sys.enableFocusMode();
    assertEqual(result.success, true);
    assertType(result.primaryZone, 'string');
    assertEqual(sys.focusModeActive, true);
    cleanup(sys);
  });

  it('disables focus mode', async () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    sys.setupZones();
    await sys.enableFocusMode();
    const result = await sys.disableFocusMode();
    assertEqual(result.success, true);
    assertEqual(sys.focusModeActive, false);
    cleanup(sys);
  });
});

/* ── Guest Mode ────────────────────────────────────────────────────── */
describe('IndoorLightingSceneEngine — guest mode', () => {
  it('enables guest mode with allowed zones', async () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    const result = await sys.enableGuestMode(['living_room', 'bathroom']);
    assertEqual(result.success, true);
    assertEqual(sys.guestModeActive, true);
    assertDeepEqual(result.allowedZones, ['living_room', 'bathroom']);
    cleanup(sys);
  });

  it('disables guest mode', async () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    await sys.enableGuestMode(['living_room']);
    const result = await sys.disableGuestMode();
    assertEqual(result.success, true);
    assertEqual(sys.guestModeActive, false);
    cleanup(sys);
  });

  it('getGuestScenes returns safe presets', () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    sys.loadPresetLibrary();
    const scenes = sys.getGuestScenes();
    assert(Array.isArray(scenes));
    assertEqual(scenes.length, 5);
    const ids = scenes.map(s => s.id);
    assert(ids.includes('warm_white'));
    assert(ids.includes('cozy_evening'));
    assert(ids.includes('bright_daylight'));
    assert(ids.includes('movie_night'));
    assert(ids.includes('hallway_welcome'));
    cleanup(sys);
  });
});

/* ── Motion Scenes ─────────────────────────────────────────────────── */
describe('IndoorLightingSceneEngine — motion scenes', () => {
  it('setMotionScene succeeds for valid zone and scene', async () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    sys.setupZones();
    sys.loadPresetLibrary();
    const result = await sys.setMotionScene('hallway', 'hallway_welcome');
    assertEqual(result.success, true);
    assertEqual(result.zone, 'hallway');
    assertEqual(result.scene, 'hallway_welcome');
    cleanup(sys);
  });

  it('setMotionScene fails for unknown zone', async () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    sys.setupZones();
    sys.loadPresetLibrary();
    const result = await sys.setMotionScene('garage', 'warm_white');
    assertEqual(result.success, false);
    cleanup(sys);
  });

  it('setMotionScene fails for unknown scene', async () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    sys.setupZones();
    const result = await sys.setMotionScene('hallway', 'nonexistent');
    assertEqual(result.success, false);
    cleanup(sys);
  });
});

/* ── Schedules ─────────────────────────────────────────────────────── */
describe('IndoorLightingSceneEngine — schedules', () => {
  it('addSchedule returns success with schedule object', () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    const result = sys.addSchedule({
      sceneId: 'warm_white',
      time: '18:00',
      days: [1, 2, 3, 4, 5],
      zones: ['living_room']
    });
    assertEqual(result.success, true);
    assert(result.schedule !== undefined);
    assertEqual(result.schedule.sceneId, 'warm_white');
    assertEqual(result.schedule.time, '18:00');
    assertEqual(sys.schedules.length, 1);
    cleanup(sys);
  });

  it('addSchedule with defaults fills days and enabled', () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    const result = sys.addSchedule({ sceneId: 'reading_nook', time: '20:00' });
    assertEqual(result.success, true);
    assertDeepEqual(result.schedule.days, [0, 1, 2, 3, 4, 5, 6]);
    assertEqual(result.schedule.enabled, true);
    assertEqual(result.schedule.zones, null);
    cleanup(sys);
  });

  it('removeSchedule succeeds for existing schedule', () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    sys.addSchedule({ id: 'sched1', sceneId: 'warm_white', time: '08:00' });
    const result = sys.removeSchedule('sched1');
    assertEqual(result.success, true);
    assertEqual(sys.schedules.length, 0);
    cleanup(sys);
  });

  it('removeSchedule fails for unknown schedule', () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    const result = sys.removeSchedule('unknown');
    assertEqual(result.success, false);
    assertEqual(result.reason, 'not_found');
    cleanup(sys);
  });
});

/* ── Light Groups ──────────────────────────────────────────────────── */
describe('IndoorLightingSceneEngine — light groups', () => {
  it('createLightGroup fails with no valid lights', () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    const result = sys.createLightGroup('g1', 'Test Group', ['fake_light']);
    assertEqual(result.success, false);
    assertEqual(result.reason, 'no_valid_lights');
    cleanup(sys);
  });

  it('createLightGroup succeeds with valid light ids', () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    sys.lights.set('light1', { id: 'light1', state: { on: true, brightness: 80 } });
    sys.lights.set('light2', { id: 'light2', state: { on: false, brightness: 0 } });
    const result = sys.createLightGroup('g1', 'My Group', ['light1', 'light2', 'missing']);
    assertEqual(result.success, true);
    assertEqual(result.lightCount, 2);
    assert(sys.lightGroups.has('g1'));
    cleanup(sys);
  });

  it('removeLightGroup succeeds for existing group', () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    sys.lights.set('l1', { id: 'l1', state: {} });
    sys.createLightGroup('g1', 'G1', ['l1']);
    const result = sys.removeLightGroup('g1');
    assertEqual(result.success, true);
    assertEqual(sys.lightGroups.has('g1'), false);
    cleanup(sys);
  });

  it('removeLightGroup fails for unknown group', () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    const result = sys.removeLightGroup('nope');
    assertEqual(result.success, false);
    assertEqual(result.reason, 'not_found');
    cleanup(sys);
  });

  it('applySceneToGroup fails for unknown group', async () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    sys.loadPresetLibrary();
    const result = await sys.applySceneToGroup('unknown', 'warm_white');
    assertEqual(result.success, false);
    assertEqual(result.reason, 'group_not_found');
    cleanup(sys);
  });

  it('applySceneToGroup fails for unknown scene', async () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    sys.lights.set('l1', { id: 'l1', state: {} });
    sys.createLightGroup('g1', 'G', ['l1']);
    const result = await sys.applySceneToGroup('g1', 'nonexistent');
    assertEqual(result.success, false);
    assertEqual(result.reason, 'scene_not_found');
    cleanup(sys);
  });
});

/* ── Energy Report ─────────────────────────────────────────────────── */
describe('IndoorLightingSceneEngine — energy tracking', () => {
  it('getEnergyReport returns structured report', () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    const report = sys.getEnergyReport();
    assertType(report.daily, 'number');
    assertType(report.weekly, 'number');
    assertType(report.monthly, 'number');
    assertType(report.perZone, 'object');
    assertType(report.perScene, 'object');
    cleanup(sys);
  });

  it('_trackEnergy increments activations', () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    sys._trackEnergy('warm_white', [], 80);
    sys._trackEnergy('warm_white', [], 60);
    const tracker = sys.energyTracking.perScene.get('warm_white');
    assert(tracker !== undefined);
    assertEqual(tracker.totalActivations, 2);
    cleanup(sys);
  });
});

/* ── Scene History ─────────────────────────────────────────────────── */
describe('IndoorLightingSceneEngine — scene history', () => {
  it('getSceneHistory returns empty array initially', () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    const history = sys.getSceneHistory();
    assert(Array.isArray(history));
    assertEqual(history.length, 0);
    cleanup(sys);
  });

  it('_recordHistory adds entries', () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    sys._recordHistory('warm_white', ['living_room'], 'activate');
    sys._recordHistory('warm_white', ['living_room'], 'deactivate');
    assertEqual(sys.sceneHistory.length, 2);
    const history = sys.getSceneHistory();
    assertEqual(history.length, 2);
    // Reversed order: most recent first
    assertEqual(history[0].action, 'deactivate');
    assertEqual(history[1].action, 'activate');
    cleanup(sys);
  });

  it('getUsagePatterns returns topScenes and hourlyDistribution', () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    sys._recordHistory('warm_white', ['living_room'], 'activate');
    sys._recordHistory('warm_white', ['kitchen'], 'activate');
    sys._recordHistory('movie_night', ['living_room'], 'activate');
    const patterns = sys.getUsagePatterns();
    assert(Array.isArray(patterns.topScenes));
    assert(patterns.topScenes.length > 0);
    assertEqual(patterns.topScenes[0].id, 'warm_white');
    assertEqual(patterns.topScenes[0].count, 2);
    assert(Array.isArray(patterns.hourlyDistribution));
    assertEqual(patterns.hourlyDistribution.length, 24);
    cleanup(sys);
  });
});

/* ── Query helpers ─────────────────────────────────────────────────── */
describe('IndoorLightingSceneEngine — queries', () => {
  it('getSceneList returns all scenes', () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    sys.loadPresetLibrary();
    sys.setupActivityScenes();
    sys.setupColorThemes();
    const all = sys.getSceneList();
    assertEqual(all.length, 36); // 22 + 5 + 9
    cleanup(sys);
  });

  it('getSceneList filters by type', () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    sys.loadPresetLibrary();
    sys.setupActivityScenes();
    sys.setupColorThemes();
    const presets = sys.getSceneList('preset');
    assertEqual(presets.length, 22);
    const themes = sys.getSceneList('theme');
    assertEqual(themes.length, 9);
    const activities = sys.getSceneList('activity');
    assertEqual(activities.length, 5);
    cleanup(sys);
  });

  it('getZoneStatus returns object per zone', () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    sys.setupZones();
    const status = sys.getZoneStatus();
    assertType(status, 'object');
    assert(status.living_room !== undefined);
    assertType(status.living_room.totalLights, 'number');
    assertType(status.living_room.activeLights, 'number');
    cleanup(sys);
  });
});

/* ── Statistics ────────────────────────────────────────────────────── */
describe('IndoorLightingSceneEngine — getStatistics', () => {
  it('returns comprehensive stats object', () => {
    const sys = new IndoorLightingSceneEngine(makeMock());
    sys.loadPresetLibrary();
    sys.setupActivityScenes();
    sys.setupColorThemes();
    sys.setupZones();
    const stats = sys.getStatistics();
    assertEqual(stats.totalLights, 0);
    assert(stats.totalZones >= 6);
    assertEqual(stats.totalScenes, 36);
    assertEqual(stats.activeScenes, 0);
    assertEqual(stats.lightGroups, 0);
    assertEqual(stats.schedules, 0);
    assertEqual(stats.historyEntries, 0);
    assertEqual(stats.partyModeActive, false);
    assertEqual(stats.focusModeActive, false);
    assertEqual(stats.guestModeActive, false);
    assertType(stats.energy, 'object');
    assertType(stats.energy.dailyWh, 'number');
    assertEqual(stats.presetCount, 22);
    assertEqual(stats.themeCount, 9);
    assertEqual(stats.activitySceneCount, 5);
    cleanup(sys);
  });
});

run();
