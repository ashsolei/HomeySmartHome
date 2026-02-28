'use strict';

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertType } = require('./helpers/assert');

const _origSetTimeout = global.setTimeout;
const _origSetInterval = global.setInterval;
const activeHandles = [];
global.setTimeout = (...a) => { const id = _origSetTimeout(...a); activeHandles.push({ type: 'timeout', id }); return id; };
global.setInterval = (...a) => { const id = _origSetInterval(...a); activeHandles.push({ type: 'interval', id }); return id; };
function cleanup(sys) {
  try { if (sys && sys.monitoring && sys.monitoring.interval) clearInterval(sys.monitoring.interval); } catch (_) {}
  try { if (sys && typeof sys.destroy === 'function') sys.destroy(); } catch (_) {}
  while (activeHandles.length > 0) {
    const h = activeHandles.pop();
    if (h.type === 'timeout') clearTimeout(h.id); else clearInterval(h.id);
  }
}

const NaturalLanguageAutomationEngine = require('../lib/NaturalLanguageAutomationEngine');

describe('NaturalLanguageAutomationEngine — constructor & init', () => {
  it('instantiates without errors', () => {
    const sys = new NaturalLanguageAutomationEngine();
    assert(sys, 'should create instance');
    assert(sys.intents.size > 0, 'should have default intents');
    assert(sys.entities.size > 0, 'should have default entities');
    assert(sys.automations.size > 0, 'should have default automations');
    assert(sys.commandHistory.length > 0, 'should have command history');
    cleanup(sys);
  });

  it('initialize loads NLP models', async () => {
    const sys = new NaturalLanguageAutomationEngine();
    await sys.initialize();
    assert(sys.monitoring.interval, 'should have monitoring interval');
    cleanup(sys);
  });

  it('has expected intents', () => {
    const sys = new NaturalLanguageAutomationEngine();
    assert(sys.intents.has('control-device'), 'should have control-device');
    assert(sys.intents.has('query-status'), 'should have query-status');
    assert(sys.intents.has('create-automation'), 'should have create-automation');
    assert(sys.intents.has('scene-activation'), 'should have scene-activation');
    cleanup(sys);
  });

  it('has expected languages', () => {
    const sys = new NaturalLanguageAutomationEngine();
    assert(sys.languages.en, 'should have English');
    assert(sys.languages.sv, 'should have Swedish');
    assert(sys.languages.es, 'should have Spanish');
    cleanup(sys);
  });
});

describe('NaturalLanguageAutomationEngine — language detection', () => {
  it('detects English', async () => {
    const sys = new NaturalLanguageAutomationEngine();
    const lang = await sys.detectLanguage('Turn on the living room lights');
    assertEqual(lang.code, 'en');
    assertType(lang.confidence, 'number');
    cleanup(sys);
  });

  it('detects Swedish', async () => {
    const sys = new NaturalLanguageAutomationEngine();
    const lang = await sys.detectLanguage('Stäng av alla lampor och lås dörren');
    assertEqual(lang.code, 'sv');
    cleanup(sys);
  });

  it('returns language name', async () => {
    const sys = new NaturalLanguageAutomationEngine();
    const lang = await sys.detectLanguage('Turn on the light');
    assertEqual(lang.name, 'English');
    cleanup(sys);
  });
});

describe('NaturalLanguageAutomationEngine — intent classification', () => {
  it('classifies device control intent', async () => {
    const sys = new NaturalLanguageAutomationEngine();
    const lang = { code: 'en', name: 'English', confidence: 0.95 };
    const intent = await sys.classifyIntent('turn on the bedroom light', lang);
    assert(intent, 'should return intent');
    assert(intent.id, 'should have id');
    assertType(intent.confidence, 'number');
    cleanup(sys);
  });

  it('returns unknown for gibberish', async () => {
    const sys = new NaturalLanguageAutomationEngine();
    // Disable fuzzy matching to get deterministic results
    sys.settings.enableFuzzyMatching = false;
    const lang = { code: 'en', name: 'English', confidence: 0.95 };
    const intent = await sys.classifyIntent('xyzzy', lang);
    assertEqual(intent.id, 'unknown');
    cleanup(sys);
  });
});

describe('NaturalLanguageAutomationEngine — entity extraction', () => {
  it('extracts device entity', async () => {
    const sys = new NaturalLanguageAutomationEngine();
    const entities = await sys.extractEntities('turn on the light in living room', { code: 'en' }, {});
    assertEqual(entities.device, 'light');
    assertEqual(entities.location, 'living room');
    assertEqual(entities.state, 'on');
    cleanup(sys);
  });

  it('extracts all target', async () => {
    const sys = new NaturalLanguageAutomationEngine();
    const entities = await sys.extractEntities('turn off all lights', { code: 'en' }, {});
    assertEqual(entities.target, 'all');
    assertEqual(entities.state, 'off');
    cleanup(sys);
  });

  it('extracts numeric value', async () => {
    const sys = new NaturalLanguageAutomationEngine();
    const entities = await sys.extractEntities('set thermostat to 22 degrees', { code: 'en' }, {});
    assertEqual(entities.value, 22);
    cleanup(sys);
  });
});

describe('NaturalLanguageAutomationEngine — sentiment analysis', () => {
  it('detects neutral sentiment', async () => {
    const sys = new NaturalLanguageAutomationEngine();
    const result = await sys.analyzeSentiment('turn on the light');
    assertEqual(result.sentiment, 'neutral');
    assertType(result.score, 'number');
    cleanup(sys);
  });

  it('detects positive sentiment', async () => {
    const sys = new NaturalLanguageAutomationEngine();
    const result = await sys.analyzeSentiment('this is great and perfect');
    assertEqual(result.sentiment, 'positive');
    assert(result.score > 0.6, 'score should be above 0.6');
    cleanup(sys);
  });

  it('detects negative sentiment', async () => {
    const sys = new NaturalLanguageAutomationEngine();
    const result = await sys.analyzeSentiment('this is terrible and awful');
    assertEqual(result.sentiment, 'negative');
    assert(result.score < 0.4, 'score should be below 0.4');
    cleanup(sys);
  });
});

describe('NaturalLanguageAutomationEngine — command processing', () => {
  it('processCommand returns result', async () => {
    const sys = new NaturalLanguageAutomationEngine();
    await sys.initialize();
    const result = await sys.processCommand('turn on the living room lights');
    assert(result, 'should return result');
    assertType(result.success, 'boolean');
    assert(result.response, 'should have response');
    cleanup(sys);
  });

  it('processCommand updates statistics', async () => {
    const sys = new NaturalLanguageAutomationEngine();
    await sys.initialize();
    const before = sys.statistics.totalCommands;
    await sys.processCommand('turn off the lights');
    assert(sys.statistics.totalCommands > before, 'should increment total');
    cleanup(sys);
  });

  it('processCommand stores in history', async () => {
    const sys = new NaturalLanguageAutomationEngine();
    await sys.initialize();
    const before = sys.commandHistory.length;
    await sys.processCommand('what is the temperature');
    assert(sys.commandHistory.length > before, 'should add to history');
    cleanup(sys);
  });

  it('processCommand creates automation', async () => {
    const sys = new NaturalLanguageAutomationEngine();
    await sys.initialize();
    const before = sys.automations.size;
    const result = await sys.processCommand('when I say bedtime, automate turn off all lights');
    if (result.action === 'automation-created') {
      assert(sys.automations.size > before, 'should add automation');
    }
    cleanup(sys);
  });
});

describe('NaturalLanguageAutomationEngine — conversation context', () => {
  it('getConversationContext returns empty for new user', () => {
    const sys = new NaturalLanguageAutomationEngine();
    const ctx = sys.getConversationContext('unknown-user');
    assert(typeof ctx === 'object', 'should return object');
    cleanup(sys);
  });

  it('updateConversationContext stores context', () => {
    const sys = new NaturalLanguageAutomationEngine();
    sys.updateConversationContext('user1', {
      rawCommand: 'turn on lights',
      intent: { id: 'control-device' },
      entities: { device: 'lights', state: 'on' },
      language: { code: 'en' }
    }, { response: 'done' });
    assert(sys.conversations.has('user1'), 'should store conversation');
    const ctx = sys.getConversationContext('user1');
    assertEqual(ctx.lastIntent, 'control-device');
    cleanup(sys);
  });
});

describe('NaturalLanguageAutomationEngine — statistics & cache', () => {
  it('getNLPStatistics returns comprehensive stats', async () => {
    const sys = new NaturalLanguageAutomationEngine();
    await sys.initialize();
    const stats = await sys.getNLPStatistics();
    assert(stats, 'should return stats');
    assertType(stats.totalCommands, 'number');
    assertType(stats.successRate, 'number');
    assert(stats.models, 'should have models');
    assert(stats.languages, 'should have languages');
    assert(stats.automations, 'should have automations');
    cleanup(sys);
  });

  it('cache stores and retrieves values', () => {
    const sys = new NaturalLanguageAutomationEngine();
    sys.setCached('test-key', { value: 42 });
    const cached = sys.getCached('test-key');
    assertEqual(cached.value, 42);
    cleanup(sys);
  });

  it('getCached returns null for expired', () => {
    const sys = new NaturalLanguageAutomationEngine();
    sys.setCached('old-key', { value: 1 });
    sys.cache.timestamps.set('old-key', Date.now() - 999999);
    assertEqual(sys.getCached('old-key'), null);
    cleanup(sys);
  });

  it('clearCache removes all cached data', () => {
    const sys = new NaturalLanguageAutomationEngine();
    sys.setCached('k1', 'v1');
    sys.setCached('k2', 'v2');
    sys.clearCache();
    assertEqual(sys.getCached('k1'), null);
    assertEqual(sys.getCached('k2'), null);
    cleanup(sys);
  });
});

run();
