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
  try {
    if (sys && sys.analysisInterval) { clearInterval(sys.analysisInterval); sys.analysisInterval = null; }
    if (sys && sys.deepAnalysisInterval) { clearInterval(sys.deepAnalysisInterval); sys.deepAnalysisInterval = null; }
  } catch (_) {}
  while (activeHandles.length > 0) {
    const h = activeHandles.pop();
    if (h.type === 'timeout') clearTimeout(h.id); else clearInterval(h.id);
  }
}

const SceneLearningSystem = require('../lib/SceneLearningSystem');

describe('SceneLearningSystem — constructor', () => {
  it('instantiates without errors', () => {
    const sys = new SceneLearningSystem(createMockHomey());
    assert(sys, 'should create instance');
    cleanup(sys);
  });

  it('starts with empty collections', () => {
    const sys = new SceneLearningSystem(createMockHomey());
    assertEqual(sys.deviceStateHistory.length, 0);
    assertEqual(sys.learnedScenes.size, 0);
    assertEqual(sys.candidateScenes.size, 0);
    assertEqual(sys.sceneExecutions.size, 0);
    cleanup(sys);
  });
});

describe('SceneLearningSystem — extractActions', () => {
  it('groups changes by device and extracts actions', () => {
    const sys = new SceneLearningSystem(createMockHomey());
    const changes = [
      { deviceId: 'd1', deviceName: 'Lamp', zone: 'Living', capabilities: { onoff: true } },
      { deviceId: 'd1', deviceName: 'Lamp', zone: 'Living', capabilities: { dim: 0.8 } },
      { deviceId: 'd2', deviceName: 'Thermostat', zone: 'Living', capabilities: { target_temperature: 22 } }
    ];
    const actions = sys.extractActions(changes);
    assert(actions.length >= 2, 'should have at least 2 actions');
    assert(actions.some(a => a.target.deviceId === 'd1'), 'should have lamp actions');
    assert(actions.some(a => a.target.deviceId === 'd2'), 'should have thermostat actions');
    cleanup(sys);
  });
});

describe('SceneLearningSystem — generateSceneName', () => {
  it('generates morning name for morning context', async () => {
    const sys = new SceneLearningSystem(createMockHomey());
    const actions = [
      { target: { deviceName: 'Device', capability: 'onoff' }, zone: 'Kök' }
    ];
    const name = await sys.generateSceneName(actions, { hour: 8 });
    assertEqual(name.sv, 'Morgon Kök');
    cleanup(sys);
  });

  it('generates evening name for evening context', async () => {
    const sys = new SceneLearningSystem(createMockHomey());
    const actions = [
      { target: { deviceName: 'Device', capability: 'onoff' }, zone: null }
    ];
    const name = await sys.generateSceneName(actions, { hour: 20 });
    assert(name.sv.startsWith('Kväll'), 'should start with Kväll');
    cleanup(sys);
  });

  it('generates lighting name when many lights', async () => {
    const sys = new SceneLearningSystem(createMockHomey());
    const actions = [
      { target: { deviceName: 'Lampa 1', capability: 'onoff' }, zone: 'Vardagsrum' },
      { target: { deviceName: 'Lampa 2', capability: 'onoff' }, zone: 'Vardagsrum' },
      { target: { deviceName: 'Ljus 3', capability: 'onoff' }, zone: 'Vardagsrum' }
    ];
    const name = await sys.generateSceneName(actions, { hour: 20 });
    assert(name.sv.includes('Belysning'), 'should include Belysning');
    cleanup(sys);
  });
});

describe('SceneLearningSystem — calculateConfidence', () => {
  it('increases confidence with more occurrences', () => {
    const sys = new SceneLearningSystem(createMockHomey());
    const now = Date.now();
    const low = sys.calculateConfidence({
      occurrences: 1,
      timestamps: [now],
      changes: [{ deviceId: 'd1' }]
    });
    const high = sys.calculateConfidence({
      occurrences: 10,
      timestamps: Array.from({ length: 10 }, (_, i) => now - i * 3600000),
      changes: [{ deviceId: 'd1' }, { deviceId: 'd2' }, { deviceId: 'd3' }]
    });
    assert(high > low, 'more occurrences should yield higher confidence');
    cleanup(sys);
  });
});

describe('SceneLearningSystem — calculateTimeConsistency', () => {
  it('returns 0 for single timestamp', () => {
    const sys = new SceneLearningSystem(createMockHomey());
    assertEqual(sys.calculateTimeConsistency([Date.now()]), 0);
    cleanup(sys);
  });

  it('returns high consistency for same-hour timestamps', () => {
    const sys = new SceneLearningSystem(createMockHomey());
    const base = new Date();
    base.setHours(10, 0, 0, 0);
    const timestamps = [base.getTime(), base.getTime() + 86400000, base.getTime() + 172800000];
    const consistency = sys.calculateTimeConsistency(timestamps);
    assert(consistency > 0.9, 'same hour should be very consistent');
    cleanup(sys);
  });
});

describe('SceneLearningSystem — matchesContext', () => {
  it('scores high for matching hour and day', () => {
    const sys = new SceneLearningSystem(createMockHomey());
    const score = sys.matchesContext({ hour: 10, dayOfWeek: 1 }, { hour: 10, day: 1 });
    assert(score >= 0.8, 'exact match should score high');
    cleanup(sys);
  });

  it('scores lower for different hour', () => {
    const sys = new SceneLearningSystem(createMockHomey());
    const exact = sys.matchesContext({ hour: 10, dayOfWeek: 1 }, { hour: 10, day: 1 });
    const offset = sys.matchesContext({ hour: 10, dayOfWeek: 1 }, { hour: 15, day: 1 });
    assert(exact > offset, 'exact hour match should score higher');
    cleanup(sys);
  });
});

describe('SceneLearningSystem — mergeSimilarActions', () => {
  it('merges duplicate device+capability actions', () => {
    const sys = new SceneLearningSystem(createMockHomey());
    const actions = [
      { target: { deviceId: 'd1', capability: 'onoff' }, params: { value: false } },
      { target: { deviceId: 'd1', capability: 'onoff' }, params: { value: true } }
    ];
    const merged = sys.mergeSimilarActions(actions);
    assertEqual(merged.length, 1);
    assertEqual(merged[0].params.value, true); // last value wins
    cleanup(sys);
  });
});

describe('SceneLearningSystem — rejectLearnedScene', () => {
  it('marks scene as rejected', async () => {
    const sys = new SceneLearningSystem(createMockHomey());
    sys.learnedScenes.set('s1', {
      id: 's1',
      status: 'suggested',
      statistics: { userApprovals: 0, userRejections: 0 }
    });
    const result = await sys.rejectLearnedScene('s1', 'too_frequent');
    assert(result.success, 'should succeed');
    assertEqual(sys.learnedScenes.get('s1').status, 'rejected');
    assertEqual(sys.learnedScenes.get('s1').statistics.userRejections, 1);
    cleanup(sys);
  });

  it('does nothing for unknown scene', async () => {
    const sys = new SceneLearningSystem(createMockHomey());
    const result = await sys.rejectLearnedScene('nonexistent');
    assertEqual(result, undefined);
    cleanup(sys);
  });
});

describe('SceneLearningSystem — recordSceneExecution', () => {
  it('records execution and updates stats', async () => {
    const sys = new SceneLearningSystem(createMockHomey());
    sys.learnedScenes.set('s1', {
      id: 's1',
      statistics: { executionCount: 0 }
    });
    await sys.recordSceneExecution('s1', 'auto');
    assertEqual(sys.sceneExecutions.size, 1);
    assertEqual(sys.learnedScenes.get('s1').statistics.executionCount, 1);
    cleanup(sys);
  });
});

describe('SceneLearningSystem — helper methods', () => {
  it('hashCode returns consistent hash', () => {
    const sys = new SceneLearningSystem(createMockHomey());
    const h1 = sys.hashCode('test');
    const h2 = sys.hashCode('test');
    assertEqual(h1, h2);
    assertType(h1, 'number');
    cleanup(sys);
  });

  it('sceneNameExists checks learned scenes', () => {
    const sys = new SceneLearningSystem(createMockHomey());
    assertEqual(sys.sceneNameExists('Test'), false);
    sys.learnedScenes.set('s1', { name: { sv: 'Test', en: 'Test' } });
    assertEqual(sys.sceneNameExists('Test'), true);
    cleanup(sys);
  });

  it('generateSceneId returns unique IDs', () => {
    const sys = new SceneLearningSystem(createMockHomey());
    const id1 = sys.generateSceneId();
    const id2 = sys.generateSceneId();
    assert(id1.startsWith('learned_scene_'), 'should have prefix');
    assert(id1 !== id2, 'IDs should differ');
    cleanup(sys);
  });

  it('groupByTimeWindows groups states by hour', () => {
    const sys = new SceneLearningSystem(createMockHomey());
    const states = [
      { hour: 10, deviceId: 'd1' },
      { hour: 10, deviceId: 'd2' },
      { hour: 14, deviceId: 'd3' }
    ];
    const windows = sys.groupByTimeWindows(states);
    assertEqual(windows[10].length, 2);
    assertEqual(windows[14].length, 1);
    cleanup(sys);
  });

  it('generatePatternKey returns consistent keys', () => {
    const sys = new SceneLearningSystem(createMockHomey());
    const changes = [
      { deviceId: 'd1', capabilities: { onoff: true } },
      { deviceId: 'd2', capabilities: { dim: 0.5 } }
    ];
    const key1 = sys.generatePatternKey(changes);
    const key2 = sys.generatePatternKey(changes);
    assertEqual(key1, key2);
    assert(key1.startsWith('pattern_'), 'should have prefix');
    cleanup(sys);
  });
});

describe('SceneLearningSystem — getSuggestions', () => {
  it('returns matching scene suggestions', async () => {
    const sys = new SceneLearningSystem(createMockHomey());
    const now = new Date();
    sys.learnedScenes.set('s1', {
      id: 's1',
      status: 'suggested',
      confidence: 80,
      context: { hour: now.getHours(), dayOfWeek: now.getDay() }
    });
    const suggestions = await sys.getSuggestions();
    assert(suggestions.length > 0, 'should have suggestions');
    cleanup(sys);
  });

  it('filters out rejected scenes', async () => {
    const sys = new SceneLearningSystem(createMockHomey());
    sys.learnedScenes.set('s1', {
      id: 's1',
      status: 'rejected',
      confidence: 80,
      context: { hour: new Date().getHours(), dayOfWeek: new Date().getDay() }
    });
    const suggestions = await sys.getSuggestions();
    assertEqual(suggestions.length, 0);
    cleanup(sys);
  });
});

run();
