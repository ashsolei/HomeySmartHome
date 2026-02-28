'use strict';

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertType } = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');

/* ---------------------------------------------------------------
 * Helper: build a system with drivers + climateManager
 * ------------------------------------------------------------- */
function createSystem(opts = {}) {
  const homey = createMockHomey();
  homey.drivers = { getDevices: () => opts.devices || [] };
  homey.app.climateManager = opts.climateManager || null;
  const AdvancedSceneTemplateSystem = require('../lib/AdvancedSceneTemplateSystem');
  const sys = new AdvancedSceneTemplateSystem(homey);
  return { sys, homey };
}

/* Helper: mock device with capabilities + optional zone */
function createMockDevice(name, capabilities, zone) {
  const capValues = {};
  return {
    name,
    zone: zone || null,
    hasCapability: (cap) => capabilities.includes(cap),
    setCapabilityValue: async (cap, val) => { capValues[cap] = val; },
    getCapabilityValue: (cap) => capValues[cap],
    _capValues: capValues // expose for assertions
  };
}

// ----------------------------------------------------------------
// Constructor
// ----------------------------------------------------------------
describe('constructor', () => {
  it('creates empty templates, customScenes, and sceneHistory', () => {
    const { sys } = createSystem();
    assertType(sys.templates, 'object');
    assertEqual(sys.templates.size, 0);
    assertEqual(sys.customScenes.size, 0);
    assertEqual(sys.sceneHistory.length, 0);
  });

  it('stores homey reference', () => {
    const { sys, homey } = createSystem();
    assertEqual(sys.homey, homey);
  });
});

// ----------------------------------------------------------------
// setupDefaultTemplates
// ----------------------------------------------------------------
describe('setupDefaultTemplates', () => {
  it('loads 19 templates', async () => {
    const { sys } = createSystem();
    await sys.setupDefaultTemplates();
    assertEqual(sys.templates.size, 19);
  });

  it('templates include expected IDs', async () => {
    const { sys } = createSystem();
    await sys.setupDefaultTemplates();
    const ids = Array.from(sys.templates.keys());
    assert(ids.includes('good_morning'), 'should include good_morning');
    assert(ids.includes('movie_night'), 'should include movie_night');
    assert(ids.includes('party_mode'), 'should include party_mode');
    assert(ids.includes('vacation_mode'), 'should include vacation_mode');
    assert(ids.includes('meditation'), 'should include meditation');
  });

  it('each template has required fields', async () => {
    const { sys } = createSystem();
    await sys.setupDefaultTemplates();
    for (const [_id, tpl] of sys.templates) {
      assertType(tpl.id, 'string');
      assertType(tpl.name, 'string');
      assertType(tpl.category, 'string');
      assert(Array.isArray(tpl.actions), 'actions should be array');
      assert(Array.isArray(tpl.customizable), 'customizable should be array');
    }
  });

  it('categories cover expected set', async () => {
    const { sys } = createSystem();
    await sys.setupDefaultTemplates();
    const cats = new Set(Array.from(sys.templates.values()).map(t => t.category));
    for (const expected of ['morning', 'work', 'evening', 'sleep', 'entertainment', 'security', 'special', 'wellness', 'seasonal']) {
      assert(cats.has(expected), `should include category ${expected}`);
    }
  });
});

// ----------------------------------------------------------------
// initialize
// ----------------------------------------------------------------
describe('initialize', () => {
  it('loads saved custom scenes from settings', async () => {
    const { sys, homey } = createSystem();
    const saved = { scn_1: { id: 'scn_1', name: 'Test Scene', useCount: 3 } };
    homey.settings.set('customScenes', saved);
    await sys.initialize();
    assertEqual(sys.customScenes.size, 1);
    assertEqual(sys.customScenes.get('scn_1').name, 'Test Scene');
  });

  it('populates default templates during init', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assert(sys.templates.size >= 19, 'should load default templates');
  });

  it('handles missing saved scenes gracefully', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    // no customScenes in settings → empty map + templates loaded
    assertEqual(sys.customScenes.size, 0);
    assert(sys.templates.size > 0, 'templates still loaded');
  });

  it('does not throw on error', async () => {
    const { sys, homey } = createSystem();
    // Force initialize error by making settings.get throw
    const origGet = homey.settings.get.bind(homey.settings);
    homey.settings.get = () => { throw new Error('disk error'); };
    await sys.initialize(); // should not throw
    homey.settings.get = origGet;
  });
});

// ----------------------------------------------------------------
// getAllTemplates
// ----------------------------------------------------------------
describe('getAllTemplates', () => {
  it('returns all templates as array', async () => {
    const { sys } = createSystem();
    await sys.setupDefaultTemplates();
    const all = sys.getAllTemplates();
    assert(Array.isArray(all), 'should return array');
    assertEqual(all.length, 19);
  });
});

// ----------------------------------------------------------------
// getTemplatesByCategory
// ----------------------------------------------------------------
describe('getTemplatesByCategory', () => {
  it('filters templates by category', async () => {
    const { sys } = createSystem();
    await sys.setupDefaultTemplates();
    const morning = sys.getTemplatesByCategory('morning');
    assert(morning.length === 2, 'should have 2 morning templates');
    assert(morning.every(t => t.category === 'morning'), 'all should be morning');
  });

  it('returns empty array for unknown category', async () => {
    const { sys } = createSystem();
    await sys.setupDefaultTemplates();
    const result = sys.getTemplatesByCategory('nonexistent');
    assertEqual(result.length, 0);
  });

  it('returns sleep templates', async () => {
    const { sys } = createSystem();
    await sys.setupDefaultTemplates();
    const sleep = sys.getTemplatesByCategory('sleep');
    assertEqual(sleep.length, 2);
  });
});

// ----------------------------------------------------------------
// getTemplate
// ----------------------------------------------------------------
describe('getTemplate', () => {
  it('returns template by id', async () => {
    const { sys } = createSystem();
    await sys.setupDefaultTemplates();
    const tpl = sys.getTemplate('focus_mode');
    assertEqual(tpl.id, 'focus_mode');
    assertEqual(tpl.category, 'work');
  });

  it('returns undefined for missing id', async () => {
    const { sys } = createSystem();
    await sys.setupDefaultTemplates();
    assertEqual(sys.getTemplate('nonexistent'), undefined);
  });
});

// ----------------------------------------------------------------
// customizeActions
// ----------------------------------------------------------------
describe('customizeActions', () => {
  it('customizes brightness on light actions', () => {
    const { sys } = createSystem();
    const actions = [
      { type: 'lights', action: 'adjust', brightness: 0.5 },
      { type: 'music', action: 'play', volume: 0.3 }
    ];
    const result = sys.customizeActions(actions, { brightness: 0.9 });
    assertEqual(result[0].brightness, 0.9);
    assertEqual(result[1].volume, 0.3); // unchanged
  });

  it('customizes temperature on climate actions', () => {
    const { sys } = createSystem();
    const actions = [{ type: 'climate', action: 'adjust', temperature: 20 }];
    const result = sys.customizeActions(actions, { temperature: 25 });
    assertEqual(result[0].temperature, 25);
  });

  it('customizes volume on music actions', () => {
    const { sys } = createSystem();
    const actions = [{ type: 'music', action: 'play', volume: 0.3 }];
    const result = sys.customizeActions(actions, { volume: 0.8 });
    assertEqual(result[0].volume, 0.8);
  });

  it('customizes duration on actions that have duration field', () => {
    const { sys } = createSystem();
    const actions = [{ type: 'lights', action: 'fade_in', duration: 900000 }];
    const result = sys.customizeActions(actions, { duration: 300000 });
    assertEqual(result[0].duration, 300000);
  });

  it('customizes color on light actions', () => {
    const { sys } = createSystem();
    const actions = [{ type: 'lights', action: 'adjust', color: 'warm' }];
    const result = sys.customizeActions(actions, { color: 'blue' });
    assertEqual(result[0].color, 'blue');
  });

  it('does not modify original actions', () => {
    const { sys } = createSystem();
    const actions = [{ type: 'lights', action: 'on', brightness: 0.5 }];
    sys.customizeActions(actions, { brightness: 1.0 });
    assertEqual(actions[0].brightness, 0.5); // original unchanged
  });

  it('returns same-length array', () => {
    const { sys } = createSystem();
    const actions = [{ type: 'lights' }, { type: 'music' }, { type: 'climate' }];
    const result = sys.customizeActions(actions, {});
    assertEqual(result.length, 3);
  });
});

// ----------------------------------------------------------------
// createSceneFromTemplate
// ----------------------------------------------------------------
describe('createSceneFromTemplate', () => {
  it('creates scene with template defaults', async () => {
    const { sys } = createSystem();
    await sys.setupDefaultTemplates();
    const scene = await sys.createSceneFromTemplate('focus_mode');
    assert(scene.id.startsWith('scene_'), 'id should start with scene_');
    assertEqual(scene.templateId, 'focus_mode');
    assertEqual(scene.category, 'work');
    assertEqual(scene.useCount, 0);
    assertEqual(scene.lastUsed, null);
  });

  it('applies name customization', async () => {
    const { sys } = createSystem();
    await sys.setupDefaultTemplates();
    const scene = await sys.createSceneFromTemplate('party_mode', { name: 'My Party' });
    assertEqual(scene.name, 'My Party');
  });

  it('stores scene in customScenes map', async () => {
    const { sys } = createSystem();
    await sys.setupDefaultTemplates();
    const scene = await sys.createSceneFromTemplate('bedtime');
    assert(sys.customScenes.has(scene.id), 'should store in map');
  });

  it('persists to settings', async () => {
    const { sys, homey } = createSystem();
    await sys.setupDefaultTemplates();
    await sys.createSceneFromTemplate('meditation');
    const saved = homey.settings.get('customScenes');
    assert(saved !== null && saved !== undefined, 'should save to settings');
    const keys = Object.keys(saved);
    assertEqual(keys.length, 1);
  });

  it('throws for unknown template', async () => {
    const { sys } = createSystem();
    await sys.setupDefaultTemplates();
    let threw = false;
    try {
      await sys.createSceneFromTemplate('nonexistent');
    } catch (e) {
      threw = true;
      assert(e.message.includes('Template not found'), 'should mention template not found');
    }
    assert(threw, 'should throw');
  });

  it('applies brightness customization to actions', async () => {
    const { sys } = createSystem();
    await sys.setupDefaultTemplates();
    const scene = await sys.createSceneFromTemplate('focus_mode', { brightness: 1.0 });
    const lightAction = scene.actions.find(a => a.type === 'lights');
    assertEqual(lightAction.brightness, 1.0);
  });
});

// ----------------------------------------------------------------
// executeScene
// ----------------------------------------------------------------
describe('executeScene', () => {
  it('executes scene and updates useCount', async () => {
    const { sys } = createSystem();
    await sys.setupDefaultTemplates();
    const scene = await sys.createSceneFromTemplate('romantic');
    await sys.executeScene(scene.id);
    const updated = sys.customScenes.get(scene.id);
    assertEqual(updated.useCount, 1);
    assert(updated.lastUsed !== null, 'lastUsed should be set');
  });

  it('records execution in sceneHistory', async () => {
    const { sys } = createSystem();
    await sys.setupDefaultTemplates();
    const scene = await sys.createSceneFromTemplate('workout');
    await sys.executeScene(scene.id);
    assertEqual(sys.sceneHistory.length, 1);
    assertEqual(sys.sceneHistory[0].sceneId, scene.id);
  });

  it('throws for unknown scene', async () => {
    const { sys } = createSystem();
    let threw = false;
    try {
      await sys.executeScene('nonexistent');
    } catch (e) {
      threw = true;
      assert(e.message.includes('Scene not found'), 'should mention scene not found');
    }
    assert(threw, 'should throw');
  });

  it('trims history to 100 entries', async () => {
    const { sys } = createSystem();
    await sys.setupDefaultTemplates();
    const scene = await sys.createSceneFromTemplate('celebration');
    // Fill history to 100
    for (let i = 0; i < 100; i++) {
      sys.sceneHistory.push({ sceneId: `s${i}`, sceneName: `S${i}`, timestamp: Date.now() });
    }
    assertEqual(sys.sceneHistory.length, 100);
    await sys.executeScene(scene.id);
    assertEqual(sys.sceneHistory.length, 100); // still 100 — oldest removed
  });

  it('returns success result', async () => {
    const { sys } = createSystem();
    await sys.setupDefaultTemplates();
    const scene = await sys.createSceneFromTemplate('cozy_winter');
    const result = await sys.executeScene(scene.id);
    assertEqual(result.success, true);
    assertEqual(result.scene, scene.name);
  });
});

// ----------------------------------------------------------------
// executeAction — dispatcher
// ----------------------------------------------------------------
describe('executeAction', () => {
  it('handles unknown action type without throwing', async () => {
    const { sys } = createSystem();
    await sys.executeAction({ type: 'unknown_gadget', action: 'do_stuff' });
    // should not throw
  });

  it('handles security action', async () => {
    const { sys } = createSystem();
    await sys.executeAction({ type: 'security', action: 'arm', mode: 'away' });
    // logs only — no throw
  });

  it('handles notifications action', async () => {
    const { sys } = createSystem();
    await sys.executeAction({ type: 'notifications', action: 'silence' });
  });
});

// ----------------------------------------------------------------
// executeLightAction
// ----------------------------------------------------------------
describe('executeLightAction', () => {
  it('turns on lights and sets brightness', async () => {
    const { sys } = createSystem();
    const dev = createMockDevice('Living room light', ['onoff', 'dim']);
    await sys.executeLightAction({ action: 'on', brightness: 0.7 }, [dev]);
    assertEqual(dev._capValues['onoff'], true);
    assertEqual(dev._capValues['dim'], 0.7);
  });

  it('turns off lights', async () => {
    const { sys } = createSystem();
    const dev = createMockDevice('Bedroom light', ['onoff', 'dim']);
    await sys.executeLightAction({ action: 'off' }, [dev]);
    assertEqual(dev._capValues['onoff'], false);
  });

  it('adjusts dim level', async () => {
    const { sys } = createSystem();
    const dev = createMockDevice('Desk lamp', ['onoff', 'dim']);
    await sys.executeLightAction({ action: 'adjust', brightness: 0.4 }, [dev]);
    assertEqual(dev._capValues['dim'], 0.4);
  });

  it('dims lights with dim action', async () => {
    const { sys } = createSystem();
    const dev = createMockDevice('Floor lamp', ['onoff', 'dim']);
    await sys.executeLightAction({ action: 'dim', brightness: 0.3 }, [dev]);
    assertEqual(dev._capValues['dim'], 0.3);
  });

  it('filters devices without light capabilities', async () => {
    const { sys } = createSystem();
    const sensor = createMockDevice('Temp sensor', ['measure_temperature']);
    await sys.executeLightAction({ action: 'on', brightness: 1 }, [sensor]);
    // sensor should not be modified
    assertEqual(Object.keys(sensor._capValues).length, 0);
  });

  it('filters by zone when specified', async () => {
    const { sys } = createSystem();
    const devIn = createMockDevice('Office light', ['onoff', 'dim'], { name: 'Office' });
    const devOut = createMockDevice('Kitchen light', ['onoff', 'dim'], { name: 'Kitchen' });
    await sys.executeLightAction({ action: 'on', brightness: 1, zones: ['office'] }, [devIn, devOut]);
    assertEqual(devIn._capValues['onoff'], true);
    assertEqual(devOut._capValues['onoff'], undefined); // skipped
  });

  it('handles device error gracefully', async () => {
    const { sys } = createSystem();
    const dev = {
      name: 'Broken light',
      hasCapability: () => true,
      setCapabilityValue: async () => { throw new Error('hw error'); },
      zone: null
    };
    // should not throw
    await sys.executeLightAction({ action: 'on' }, [dev]);
  });

  it('includes devices with light_hue capability', async () => {
    const { sys } = createSystem();
    const dev = createMockDevice('Color light', ['onoff', 'light_hue']);
    await sys.executeLightAction({ action: 'on' }, [dev]);
    assertEqual(dev._capValues['onoff'], true);
  });
});

// ----------------------------------------------------------------
// fadeLights
// ----------------------------------------------------------------
describe('fadeLights', () => {
  it('fades brightness from 0 to target', async () => {
    const { sys } = createSystem();
    const dev = createMockDevice('Light', ['onoff', 'dim']);
    // Use minimal duration to avoid slow test (20 steps × 1ms = 20ms)
    await sys.fadeLights(dev, 0, 1.0, 20);
    // After 20 steps the last value should be ~1.0
    const finalVal = dev._capValues['dim'];
    assert(finalVal >= 0.95 && finalVal <= 1.0, `final brightness should be ~1.0 but got ${finalVal}`);
  });

  it('fades brightness down to 0', async () => {
    const { sys } = createSystem();
    const dev = createMockDevice('Light', ['onoff', 'dim']);
    await sys.fadeLights(dev, 0.8, 0, 20);
    const finalVal = dev._capValues['dim'];
    assert(finalVal >= 0 && finalVal <= 0.05, `final brightness should be ~0 but got ${finalVal}`);
  });

  it('stops on device error', async () => {
    const { sys } = createSystem();
    let calls = 0;
    const dev = {
      setCapabilityValue: async () => {
        calls++;
        if (calls > 2) throw new Error('hw fail');
      }
    };
    await sys.fadeLights(dev, 0, 1, 20);
    // Should have stopped early due to error
    assert(calls <= 3, 'should stop on error');
  });
});

// ----------------------------------------------------------------
// matchesZone
// ----------------------------------------------------------------
describe('matchesZone', () => {
  it('returns true when device zone matches', () => {
    const { sys } = createSystem();
    const dev = { zone: { name: 'Living Room' } };
    assertEqual(sys.matchesZone(dev, ['living']), true);
  });

  it('returns false when device zone does not match', () => {
    const { sys } = createSystem();
    const dev = { zone: { name: 'Kitchen' } };
    assertEqual(sys.matchesZone(dev, ['bedroom']), false);
  });

  it('handles missing zone gracefully', () => {
    const { sys } = createSystem();
    const dev = { zone: null };
    assertEqual(sys.matchesZone(dev, ['office']), false);
  });

  it('case-insensitive matching', () => {
    const { sys } = createSystem();
    const dev = { zone: { name: 'OFFICE' } };
    assertEqual(sys.matchesZone(dev, ['office']), true);
  });

  it('matches any zone in array', () => {
    const { sys } = createSystem();
    const dev = { zone: { name: 'Bedroom' } };
    assertEqual(sys.matchesZone(dev, ['kitchen', 'bedroom']), true);
  });
});

// ----------------------------------------------------------------
// executeMusicAction
// ----------------------------------------------------------------
describe('executeMusicAction', () => {
  it('starts playback and sets volume', async () => {
    const { sys } = createSystem();
    const dev = createMockDevice('Speaker', ['speaker_playing', 'volume_set']);
    await sys.executeMusicAction({ action: 'play', volume: 0.5 }, [dev]);
    assertEqual(dev._capValues['speaker_playing'], true);
    assertEqual(dev._capValues['volume_set'], 0.5);
  });

  it('stops playback', async () => {
    const { sys } = createSystem();
    const dev = createMockDevice('Speaker', ['speaker_playing', 'volume_set']);
    await sys.executeMusicAction({ action: 'stop' }, [dev]);
    assertEqual(dev._capValues['speaker_playing'], false);
  });

  it('skips non-media devices', async () => {
    const { sys } = createSystem();
    const dev = createMockDevice('Sensor', ['measure_temperature']);
    await sys.executeMusicAction({ action: 'play', volume: 0.5 }, [dev]);
    assertEqual(Object.keys(dev._capValues).length, 0);
  });

  it('handles device error silently', async () => {
    const { sys } = createSystem();
    const dev = {
      name: 'Broken speaker',
      hasCapability: () => true,
      setCapabilityValue: async () => { throw new Error('nope'); }
    };
    await sys.executeMusicAction({ action: 'play' }, [dev]);
  });
});

// ----------------------------------------------------------------
// executeClimateAction
// ----------------------------------------------------------------
describe('executeClimateAction', () => {
  it('sets temperature via climateManager', async () => {
    let setCalls = [];
    const climateManager = {
      getAllZonesStatus: async () => [{ id: 'z1' }, { id: 'z2' }],
      setZoneTemperature: async (id, temp) => { setCalls.push({ id, temp }); }
    };
    const { sys } = createSystem({ climateManager });
    await sys.executeClimateAction({ action: 'adjust', temperature: 22 });
    assertEqual(setCalls.length, 2);
    assertEqual(setCalls[0].temp, 22);
  });

  it('does nothing when climateManager is missing', async () => {
    const { sys } = createSystem({ climateManager: null });
    await sys.executeClimateAction({ action: 'adjust', temperature: 20 });
    // no throw
  });

  it('handles error silently', async () => {
    const climateManager = {
      getAllZonesStatus: async () => { throw new Error('fail'); }
    };
    const { sys } = createSystem({ climateManager });
    await sys.executeClimateAction({ action: 'adjust', temperature: 20 });
  });
});

// ----------------------------------------------------------------
// executeBlindsAction
// ----------------------------------------------------------------
describe('executeBlindsAction', () => {
  it('opens blinds', async () => {
    const { sys } = createSystem();
    const dev = createMockDevice('Blinds', ['windowcoverings_state']);
    await sys.executeBlindsAction({ action: 'open' }, [dev]);
    assertEqual(dev._capValues['windowcoverings_state'], 'up');
  });

  it('closes blinds', async () => {
    const { sys } = createSystem();
    const dev = createMockDevice('Blinds', ['windowcoverings_state']);
    await sys.executeBlindsAction({ action: 'close' }, [dev]);
    assertEqual(dev._capValues['windowcoverings_state'], 'down');
  });

  it('adjusts position when capability exists', async () => {
    const { sys } = createSystem();
    const dev = createMockDevice('Blinds', ['windowcoverings_state', 'windowcoverings_set']);
    await sys.executeBlindsAction({ action: 'adjust', position: 0.5 }, [dev]);
    assertEqual(dev._capValues['windowcoverings_set'], 0.5);
  });

  it('skips non-blind devices', async () => {
    const { sys } = createSystem();
    const dev = createMockDevice('Sensor', ['measure_temperature']);
    await sys.executeBlindsAction({ action: 'open' }, [dev]);
    assertEqual(Object.keys(dev._capValues).length, 0);
  });

  it('handles device error silently', async () => {
    const { sys } = createSystem();
    const dev = {
      name: 'Broken blinds',
      hasCapability: () => true,
      setCapabilityValue: async () => { throw new Error('motor fail'); }
    };
    await sys.executeBlindsAction({ action: 'open' }, [dev]);
  });
});

// ----------------------------------------------------------------
// getStatistics
// ----------------------------------------------------------------
describe('getStatistics', () => {
  it('returns template count', async () => {
    const { sys } = createSystem();
    await sys.setupDefaultTemplates();
    const stats = sys.getStatistics();
    assertEqual(stats.templates, 19);
  });

  it('returns custom scene count', async () => {
    const { sys } = createSystem();
    await sys.setupDefaultTemplates();
    await sys.createSceneFromTemplate('party_mode');
    // Small delay to avoid Date.now() ID collision
    await new Promise(r => setTimeout(r, 5));
    await sys.createSceneFromTemplate('movie_night');
    const stats = sys.getStatistics();
    assertEqual(stats.customScenes, 2);
  });

  it('returns recent executions', async () => {
    const { sys } = createSystem();
    await sys.setupDefaultTemplates();
    const scene = await sys.createSceneFromTemplate('romantic');
    await sys.executeScene(scene.id);
    const stats = sys.getStatistics();
    assertEqual(stats.recentExecutions.length, 1);
  });

  it('includes popular scenes', async () => {
    const { sys } = createSystem();
    await sys.setupDefaultTemplates();
    // Use focus_mode (no delays/fades) to avoid test hanging
    const scene = await sys.createSceneFromTemplate('focus_mode');
    await sys.executeScene(scene.id);
    await sys.executeScene(scene.id);
    const stats = sys.getStatistics();
    assert(Array.isArray(stats.popularScenes), 'should be array');
    assertEqual(stats.popularScenes[0].useCount, 2);
  });
});

// ----------------------------------------------------------------
// getPopularScenes
// ----------------------------------------------------------------
describe('getPopularScenes', () => {
  it('sorts by useCount descending', async () => {
    const { sys } = createSystem();
    await sys.setupDefaultTemplates();

    // Manually add scenes to avoid executeScene delays from template actions
    sys.customScenes.set('s1', { id: 's1', name: 'Scene A', useCount: 1, lastUsed: Date.now() });
    sys.customScenes.set('s2', { id: 's2', name: 'Scene B', useCount: 5, lastUsed: Date.now() });
    sys.customScenes.set('s3', { id: 's3', name: 'Scene C', useCount: 3, lastUsed: Date.now() });

    const popular = sys.getPopularScenes();
    assertEqual(popular[0].useCount, 5);
    assertEqual(popular[1].useCount, 3);
    assertEqual(popular[2].useCount, 1);
  });

  it('returns max 5 scenes', async () => {
    const { sys } = createSystem();
    // Manually add 6 scenes to avoid executeScene delays from template actions
    for (let i = 0; i < 6; i++) {
      sys.customScenes.set(`scn_${i}`, { id: `scn_${i}`, name: `Scene ${i}`, useCount: i + 1, lastUsed: Date.now() });
    }
    const popular = sys.getPopularScenes();
    assert(popular.length <= 5, 'should return at most 5');
    assertEqual(popular.length, 5);
  });

  it('returns empty array when no scenes', () => {
    const { sys } = createSystem();
    assertEqual(sys.getPopularScenes().length, 0);
  });
});

// ----------------------------------------------------------------
// saveCustomScenes
// ----------------------------------------------------------------
describe('saveCustomScenes', () => {
  it('persists all custom scenes to settings', async () => {
    const { sys, homey } = createSystem();
    await sys.setupDefaultTemplates();
    await sys.createSceneFromTemplate('focus_mode');
    // Small delay to avoid Date.now() ID collision
    await new Promise(r => setTimeout(r, 5));
    await sys.createSceneFromTemplate('movie_night');
    const saved = homey.settings.get('customScenes');
    assertEqual(Object.keys(saved).length, 2);
  });

  it('saved data matches custom scenes map', async () => {
    const { sys, homey } = createSystem();
    await sys.setupDefaultTemplates();
    const scene = await sys.createSceneFromTemplate('relax_evening');
    const saved = homey.settings.get('customScenes');
    assertEqual(saved[scene.id].name, scene.name);
  });
});

// ----------------------------------------------------------------
// executeScene — integration with devices
// ----------------------------------------------------------------
describe('executeScene integration with devices', () => {
  it('executes light actions on real mock devices', async () => {
    const light = createMockDevice('Living light', ['onoff', 'dim', 'light_hue']);
    const { sys } = createSystem({ devices: [light] });
    await sys.setupDefaultTemplates();
    // Create scene from romantic (has lights action with brightness 0.2)
    const scene = await sys.createSceneFromTemplate('romantic');
    await sys.executeScene(scene.id);
    // Light should have been adjusted
    assertEqual(light._capValues['dim'], 0.2);
  });

  it('executes music actions on speaker devices', async () => {
    const speaker = createMockDevice('Sonos', ['speaker_playing', 'volume_set']);
    const { sys } = createSystem({ devices: [speaker] });
    await sys.setupDefaultTemplates();
    const scene = await sys.createSceneFromTemplate('dinner_party');
    await sys.executeScene(scene.id);
    assertEqual(speaker._capValues['speaker_playing'], true);
    assertEqual(speaker._capValues['volume_set'], 0.3);
  });

  it('executes blinds actions', async () => {
    const blind = createMockDevice('Window blind', ['windowcoverings_state']);
    const { sys } = createSystem({ devices: [blind] });
    await sys.setupDefaultTemplates();
    const scene = await sys.createSceneFromTemplate('relax_evening');
    await sys.executeScene(scene.id);
    assertEqual(blind._capValues['windowcoverings_state'], 'down');
  });
});

// ----------------------------------------------------------------
// Edge cases
// ----------------------------------------------------------------
describe('edge cases', () => {
  it('multiple scenes from same template get unique IDs', async () => {
    const { sys } = createSystem();
    await sys.setupDefaultTemplates();
    const s1 = await sys.createSceneFromTemplate('focus_mode');
    // small delay to ensure different Date.now()
    await new Promise(r => setTimeout(r, 5));
    const s2 = await sys.createSceneFromTemplate('focus_mode');
    assert(s1.id !== s2.id, 'IDs should be unique');
  });

  it('executeScene increments useCount on each call', async () => {
    const { sys } = createSystem();
    await sys.setupDefaultTemplates();
    // Use focus_mode (no delays) to avoid hanging
    const scene = await sys.createSceneFromTemplate('focus_mode');
    await sys.executeScene(scene.id);
    await sys.executeScene(scene.id);
    await sys.executeScene(scene.id);
    assertEqual(sys.customScenes.get(scene.id).useCount, 3);
  });

  it('sceneHistory preserves order', async () => {
    const { sys } = createSystem();
    await sys.setupDefaultTemplates();
    const s1 = await sys.createSceneFromTemplate('focus_mode', { name: 'First' });
    // Small delay to avoid Date.now() ID collision
    await new Promise(r => setTimeout(r, 5));
    const s2 = await sys.createSceneFromTemplate('party_mode', { name: 'Second' });
    await sys.executeScene(s1.id);
    await sys.executeScene(s2.id);
    assertEqual(sys.sceneHistory[0].sceneName, 'First');
    assertEqual(sys.sceneHistory[1].sceneName, 'Second');
  });

  it('description customization applies', async () => {
    const { sys } = createSystem();
    await sys.setupDefaultTemplates();
    const scene = await sys.createSceneFromTemplate('meditation', { description: 'My zen' });
    assertEqual(scene.description, 'My zen');
  });

  it('icon customization applies', async () => {
    const { sys } = createSystem();
    await sys.setupDefaultTemplates();
    const scene = await sys.createSceneFromTemplate('workout', { icon: 'custom-icon' });
    assertEqual(scene.icon, 'custom-icon');
  });
});

// ----------------------------------------------------------------
// log and error methods
// ----------------------------------------------------------------
describe('log and error methods', () => {
  it('log method does not throw', () => {
    const { sys } = createSystem();
    sys.log('test message');
  });

  it('error method does not throw', () => {
    const { sys } = createSystem();
    sys.error('test error');
  });
});

run();
