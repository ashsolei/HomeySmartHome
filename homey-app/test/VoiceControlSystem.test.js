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

const VoiceControlSystem = require('../lib/VoiceControlSystem');

function mockHomeyForVoice() {
  const homey = createMockHomey();
  // startVoiceRecognition tries to access homey.speechInput
  homey.speechInput = { on() {} };
  return homey;
}

describe('Voice — constructor & lifecycle', () => {
  it('instantiates without errors', () => {
    const sys = new VoiceControlSystem(mockHomeyForVoice());
    assert(sys, 'should create instance');
    assertEqual(sys.commands.size, 0);
    assertEqual(sys.conversationHistory.length, 0);
    cleanup(sys);
  });

  it('initialize registers default commands', async () => {
    const sys = new VoiceControlSystem(mockHomeyForVoice());
    await sys.initialize();
    assert(sys.commands.size > 0, 'should have commands');
    assert(sys.commands.has('lights_on'), 'should have lights_on command');
    assert(sys.commands.has('lights_off'), 'should have lights_off command');
    assert(sys.commands.has('set_temperature'), 'should have set_temperature');
    cleanup(sys);
  });
});

describe('Voice — registerCommand', () => {
  it('registerCommand adds a new command', () => {
    const sys = new VoiceControlSystem(mockHomeyForVoice());
    sys.registerCommand({
      id: 'test_cmd',
      patterns: ['test pattern'],
      action: async () => ({ message: 'ok' }),
      category: 'test'
    });
    assertEqual(sys.commands.has('test_cmd'), true);
    const cmd = sys.commands.get('test_cmd');
    assertEqual(cmd.category, 'test');
    assertType(cmd.executionCount, 'number');
    assertEqual(cmd.executionCount, 0);
    cleanup(sys);
  });
});

describe('Voice — pattern matching', () => {
  it('matchPattern returns exact match with score 1.0', () => {
    const sys = new VoiceControlSystem(mockHomeyForVoice());
    const result = sys.matchPattern('tänd lamporna', 'tänd lamporna');
    assert(result, 'should match');
    assertEqual(result.score, 1.0);
    cleanup(sys);
  });

  it('matchPattern extracts parameters', () => {
    const sys = new VoiceControlSystem(mockHomeyForVoice());
    const result = sys.matchPattern('aktivera {scene}', 'aktivera filmläge');
    assert(result, 'should match');
    assertEqual(result.params.scene, 'filmläge');
    cleanup(sys);
  });

  it('matchPattern returns null for non-matching input', () => {
    const sys = new VoiceControlSystem(mockHomeyForVoice());
    const result = sys.matchPattern('tänd lamporna', 'completely different command that is very long');
    assertEqual(result, null);
    cleanup(sys);
  });
});

describe('Voice — similarity & normalization', () => {
  it('calculateSimilarity returns 1.0 for identical strings', () => {
    const sys = new VoiceControlSystem(mockHomeyForVoice());
    assertEqual(sys.calculateSimilarity('hello', 'hello'), 1.0);
    cleanup(sys);
  });

  it('calculateSimilarity returns lower score for different strings', () => {
    const sys = new VoiceControlSystem(mockHomeyForVoice());
    const sim = sys.calculateSimilarity('hello', 'world');
    assert(sim < 1.0, 'should be less than 1');
    assert(sim >= 0, 'should be non-negative');
    cleanup(sys);
  });

  it('normalizeInput lowercases and trims', () => {
    const sys = new VoiceControlSystem(mockHomeyForVoice());
    assertEqual(sys.normalizeInput('  HELLO World  '), 'hello world');
    cleanup(sys);
  });

  it('levenshteinDistance computes correct distance', () => {
    const sys = new VoiceControlSystem(mockHomeyForVoice());
    assertEqual(sys.levenshteinDistance('kitten', 'kitten'), 0);
    assertEqual(sys.levenshteinDistance('kitten', 'sitting'), 3);
    cleanup(sys);
  });
});

describe('Voice — processVoiceInput', () => {
  it('processVoiceInput matches known command', async () => {
    const sys = new VoiceControlSystem(mockHomeyForVoice());
    await sys.initialize();
    const result = await sys.processVoiceInput('tänd lamporna');
    assertEqual(result.success, true);
    assert(result.message, 'should have message');
    cleanup(sys);
  });

  it('processVoiceInput returns failure for unrecognized input', async () => {
    const sys = new VoiceControlSystem(mockHomeyForVoice());
    await sys.initialize();
    const result = await sys.processVoiceInput('xyzzy completely unrecognizable very long gibberish');
    assertEqual(result.success, false);
    assert(result.message, 'should have message');
    cleanup(sys);
  });

  it('processVoiceInput records to conversation history', async () => {
    const sys = new VoiceControlSystem(mockHomeyForVoice());
    await sys.initialize();
    await sys.processVoiceInput('tänd lamporna');
    assert(sys.conversationHistory.length > 0, 'should have history');
    cleanup(sys);
  });

  it('processVoiceInput increments execution count', async () => {
    const sys = new VoiceControlSystem(mockHomeyForVoice());
    await sys.initialize();
    await sys.processVoiceInput('tänd lamporna');
    const cmd = sys.commands.get('lights_on');
    assert(cmd.executionCount > 0, 'should have incremented');
    cleanup(sys);
  });
});

describe('Voice — context & custom commands', () => {
  it('updateContext sets context', () => {
    const sys = new VoiceControlSystem(mockHomeyForVoice());
    sys.updateContext('test input', 'user-1');
    assert(sys.context, 'should have context');
    assertEqual(sys.context.lastInput, 'test input');
    assertEqual(sys.context.userId, 'user-1');
    cleanup(sys);
  });

  it('createCustomCommand creates and registers command', async () => {
    const sys = new VoiceControlSystem(mockHomeyForVoice());
    await sys.initialize();
    const cmd = await sys.createCustomCommand({
      name: 'test custom',
      patterns: ['custom test phrase'],
      action: async () => ({ message: 'custom executed' })
    });
    assert(cmd, 'should return command');
    assert(cmd.id, 'should have id');
    assertEqual(cmd.category, 'custom');
    assert(sys.commands.has(cmd.id), 'should be registered');
    cleanup(sys);
  });

  it('createVoiceProfile creates a profile', async () => {
    const sys = new VoiceControlSystem(mockHomeyForVoice());
    await sys.initialize();
    const profile = await sys.createVoiceProfile('user-test', { language: 'en' });
    assert(profile, 'should return profile');
    assertEqual(profile.preferences.language, 'en');
    assertEqual(profile.preferences.responseStyle, 'friendly');
    assert(sys.voiceProfiles.has('user-test'), 'should be in map');
    cleanup(sys);
  });
});

describe('Voice — suggestions', () => {
  it('getSuggestions returns suggestions array', async () => {
    const sys = new VoiceControlSystem(mockHomeyForVoice());
    await sys.initialize();
    const suggestions = await sys.getSuggestions('tänd');
    assert(Array.isArray(suggestions), 'should be array');
    cleanup(sys);
  });
});

run();
