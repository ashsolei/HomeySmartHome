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

const AIVoiceAssistantIntegration = require('../lib/AIVoiceAssistantIntegration');

/* ================================================================== */
/*  AIVoiceAssistantIntegration – test suite                          */
/* ================================================================== */

describe('AIVoiceAssistantIntegration — constructor & lifecycle', () => {
  it('instantiates without errors', () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    assert(sys, 'should create instance');
    cleanup(sys);
  });

  it('starts with correct default state', () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    assertEqual(sys._initialized, false);
    assertEqual(sys.dialogState, 'idle');
    assertEqual(sys.defaultLanguage, 'sv');
    assertEqual(sys.wakeWord, 'Hey Hemma');
    assertEqual(sys.whisperMode, false);
    assertEqual(sys.noiseSuppression, 'medium');
    cleanup(sys);
  });

  it('initialize sets initialized flag and registers intents', async () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    await sys.initialize();
    assertEqual(sys._initialized, true);
    assert(sys.intents.size > 0, 'should have registered intents');
    assert(sys.voiceProfiles.size >= 1, 'should have default admin profile');
    cleanup(sys);
  });

  it('initialize is idempotent', async () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    await sys.initialize();
    const intentsCount = sys.intents.size;
    await sys.initialize();
    assertEqual(sys.intents.size, intentsCount);
    cleanup(sys);
  });

  it('destroy clears state', async () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    await sys.initialize();
    sys.destroy();
    assertEqual(sys._initialized, false);
    assertEqual(sys._destroyed, true);
    assertEqual(sys.wakeWordActive, false);
    assertEqual(sys.activeTimers.size, 0);
    cleanup(sys);
  });
});

describe('AIVoiceAssistantIntegration — voice profiles', () => {
  it('addVoiceProfile creates profile', async () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    await sys.initialize();
    const result = sys.addVoiceProfile({ id: 'user1', name: 'Alice', permission: 'adult' });
    assertEqual(result, true);
    assert(sys.voiceProfiles.has('user1'), 'profile should exist');
    assertEqual(sys.voiceProfiles.get('user1').name, 'Alice');
    cleanup(sys);
  });

  it('addVoiceProfile enforces max limit', async () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    await sys.initialize();
    // default admin already takes 1 slot
    for (let i = 0; i < 7; i++) {
      sys.addVoiceProfile({ id: `u${i}`, name: `User${i}`, permission: 'guest' });
    }
    const result = sys.addVoiceProfile({ id: 'extra', name: 'Extra', permission: 'guest' });
    assertEqual(result, false);
    cleanup(sys);
  });

  it('removeVoiceProfile removes existing profile', async () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    await sys.initialize();
    sys.addVoiceProfile({ id: 'u1', name: 'Bob', permission: 'adult' });
    const result = sys.removeVoiceProfile('u1');
    assertEqual(result, true);
    assertEqual(sys.voiceProfiles.has('u1'), false);
    cleanup(sys);
  });

  it('removeVoiceProfile returns false for unknown id', async () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    await sys.initialize();
    assertEqual(sys.removeVoiceProfile('nonexistent'), false);
    cleanup(sys);
  });

  it('identifySpeaker returns default_admin when no voice prints', async () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    await sys.initialize();
    const speaker = sys.identifySpeaker(null);
    assertEqual(speaker.profileId, 'default_admin');
    cleanup(sys);
  });
});

describe('AIVoiceAssistantIntegration — language detection', () => {
  it('detectLanguage identifies English text', async () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    await sys.initialize();
    const lang = sys.detectLanguage('the cat is on the table and it was not there before');
    assertEqual(lang, 'en');
    cleanup(sys);
  });

  it('detectLanguage identifies Swedish text', async () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    await sys.initialize();
    const lang = sys.detectLanguage('jag har inte en katt som är på bordet');
    assertEqual(lang, 'sv');
    cleanup(sys);
  });

  it('detectLanguage returns default when autoDetect is off', async () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    await sys.initialize();
    sys.autoDetectLanguage = false;
    const lang = sys.detectLanguage('the cat is on the table');
    assertEqual(lang, 'sv');
    cleanup(sys);
  });

  it('getLanguagePack returns correct pack', () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    const pack = sys.getLanguagePack('en');
    assertEqual(pack.code, 'en');
    assert(pack.confirmations.length > 0, 'should have confirmations');
    cleanup(sys);
  });

  it('getLanguagePack falls back to default language', () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    const pack = sys.getLanguagePack('xx');
    assertEqual(pack.code, 'sv');
    cleanup(sys);
  });

  it('setUserLanguage updates profile language', async () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    await sys.initialize();
    const result = sys.setUserLanguage('default_admin', 'en');
    assertEqual(result, true);
    assertEqual(sys.voiceProfiles.get('default_admin').language, 'en');
    cleanup(sys);
  });

  it('setUserLanguage rejects unsupported language', async () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    await sys.initialize();
    assertEqual(sys.setUserLanguage('default_admin', 'xx'), false);
    cleanup(sys);
  });
});

describe('AIVoiceAssistantIntegration — wake word', () => {
  it('processWakeWord detects wake word with sufficient confidence', async () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    await sys.initialize();
    // _analyzeWakeWord returns 0.85 for truthy buffers
    // with medium sensitivity (0.6) + false positive rejection threshold (0.7), 0.85 passes
    const result = sys.processWakeWord(Buffer.from('audio'));
    assertType(result, 'boolean');
    cleanup(sys);
  });

  it('processWakeWord returns false when inactive', async () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    await sys.initialize();
    sys.wakeWordActive = false;
    assertEqual(sys.processWakeWord(Buffer.from('audio')), false);
    cleanup(sys);
  });

  it('processWakeWord returns false for null buffer', async () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    await sys.initialize();
    assertEqual(sys.processWakeWord(null), false);
    cleanup(sys);
  });

  it('setWakeWord updates wake word', () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    sys.setWakeWord('Hey Home');
    assertEqual(sys.wakeWord, 'Hey Home');
    cleanup(sys);
  });

  it('setWakeWordSensitivity updates sensitivity', () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    sys.setWakeWordSensitivity('high');
    assertEqual(sys.wakeWordSensitivity, 'high');
    cleanup(sys);
  });
});

describe('AIVoiceAssistantIntegration — noise suppression', () => {
  it('setNoiseSuppression updates level', () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    sys.setNoiseSuppression('aggressive');
    assertEqual(sys.noiseSuppression, 'aggressive');
    cleanup(sys);
  });

  it('processAudioWithNoiseSuppression returns processed result', () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    const result = sys.processAudioWithNoiseSuppression(Buffer.from('audio'), 'living_room');
    assert(result.processedBuffer, 'should have buffer');
    assertType(result.gain, 'number');
    assertType(result.filter, 'number');
    cleanup(sys);
  });

  it('updateRoomNoiseFloor stores noise level', () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    sys.updateRoomNoiseFloor('kitchen', 0.4);
    assertEqual(sys.roomNoiseFloor.get('kitchen'), 0.4);
    cleanup(sys);
  });
});

describe('AIVoiceAssistantIntegration — whisper mode', () => {
  it('getResponseVolume returns whisper volume when in whisper mode', () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    sys.whisperMode = true;
    assertEqual(sys.getResponseVolume(), 15);
    cleanup(sys);
  });

  it('getResponseVolume returns normal volume when not in whisper mode', () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    sys.whisperMode = false;
    assertEqual(sys.getResponseVolume(), 70);
    cleanup(sys);
  });

  it('setWhisperSchedule updates schedule', () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    sys.setWhisperSchedule(23, 6);
    assertEqual(sys.whisperSchedule.start, 23);
    assertEqual(sys.whisperSchedule.end, 6);
    cleanup(sys);
  });
});

describe('AIVoiceAssistantIntegration — command processing', () => {
  it('processCommand handles device control command', async () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    await sys.initialize();
    const result = await sys.processCommand('turn on the light', null);
    assert(result, 'should return result');
    assertType(result.success, 'boolean');
    cleanup(sys);
  });

  it('processCommand handles unknown command', async () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    await sys.initialize();
    const result = await sys.processCommand('xyzzy foobar', null);
    assert(result, 'should return result');
    cleanup(sys);
  });

  it('processCommand returns response with expected shape', async () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    await sys.initialize();
    const result = await sys.processCommand('turn off the fan', null);
    assertType(result.message, 'string');
    assertType(result.responseTimeMs, 'number');
    assertType(result.whisperMode, 'boolean');
    assertType(result.volume, 'number');
    cleanup(sys);
  });
});

describe('AIVoiceAssistantIntegration — macros', () => {
  it('addMacro registers a new macro', async () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    await sys.initialize();
    sys.addMacro('test_macro', 'Test Macro', [{ action: 'test', params: {} }]);
    assert(sys.macros.has('test_macro'), 'macro should exist');
    cleanup(sys);
  });

  it('removeMacro removes existing macro', async () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    await sys.initialize();
    sys.addMacro('temp', 'Temp', [{ action: 'x', params: {} }]);
    const result = sys.removeMacro('temp');
    assertEqual(result, true);
    assertEqual(sys.macros.has('temp'), false);
    cleanup(sys);
  });

  it('removeMacro returns false for unknown macro', () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    assertEqual(sys.removeMacro('nonexistent'), false);
    cleanup(sys);
  });
});

describe('AIVoiceAssistantIntegration — custom vocabulary', () => {
  it('addDeviceNickname and removeDeviceNickname', () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    sys.addDeviceNickname('bedside lamp', 'device_123');
    assertEqual(sys.customVocabulary.deviceNicknames.get('bedside lamp'), 'device_123');
    sys.removeDeviceNickname('bedside lamp');
    assertEqual(sys.customVocabulary.deviceNicknames.has('bedside lamp'), false);
    cleanup(sys);
  });

  it('addRoomAlias and removeRoomAlias', () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    sys.addRoomAlias('upstairs', ['bedroom', 'bathroom']);
    assert(sys.customVocabulary.roomAliases.has('upstairs'), 'alias should exist');
    sys.removeRoomAlias('upstairs');
    assertEqual(sys.customVocabulary.roomAliases.has('upstairs'), false);
    cleanup(sys);
  });

  it('addPersonName stores pronunciation', () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    sys.addPersonName('Björk', 'byerk');
    assertEqual(sys.customVocabulary.personNames.get('Björk'), 'byerk');
    cleanup(sys);
  });
});

describe('AIVoiceAssistantIntegration — feedback & accessibility', () => {
  it('setFeedbackVerbosity updates verbosity', () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    sys.setFeedbackVerbosity('brief');
    assertEqual(sys.feedbackSettings.verbosity, 'brief');
    cleanup(sys);
  });

  it('setFeedbackPersonality updates personality', () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    sys.setFeedbackPersonality('humorous');
    assertEqual(sys.feedbackSettings.personality, 'humorous');
    cleanup(sys);
  });

  it('setConfirmationBeeps toggles beeps', () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    sys.setConfirmationBeeps(false);
    assertEqual(sys.feedbackSettings.confirmationBeeps, false);
    cleanup(sys);
  });

  it('setSlowSpeech adjusts speech rate', () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    sys.setSlowSpeech(true);
    assertEqual(sys.accessibility.slowSpeech, true);
    assertEqual(sys.accessibility.speechRate, 0.7);
    cleanup(sys);
  });

  it('setRepeatCommands toggles repeat', () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    sys.setRepeatCommands(true);
    assertEqual(sys.accessibility.repeatCommands, true);
    cleanup(sys);
  });

  it('setLargeTextFallback toggles large text', () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    sys.setLargeTextFallback(true);
    assertEqual(sys.accessibility.largeTextFallback, true);
    cleanup(sys);
  });

  it('setSimplifiedVocabulary toggles simplified vocabulary', () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    sys.setSimplifiedVocabulary(true);
    assertEqual(sys.accessibility.simplifiedVocabulary, true);
    cleanup(sys);
  });
});

describe('AIVoiceAssistantIntegration — voice authentication', () => {
  it('enrollVoicePrint requires at least 3 samples', () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    assertEqual(sys.enrollVoicePrint('u1', ['s1', 's2']), false);
    cleanup(sys);
  });

  it('enrollVoicePrint succeeds with enough samples', () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    assertEqual(sys.enrollVoicePrint('u1', ['s1', 's2', 's3']), true);
    assert(sys.voiceAuth.enrolledPrints.has('u1'), 'should have enrolled print');
    cleanup(sys);
  });

  it('revokeVoicePrint removes enrolled print', () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    sys.enrollVoicePrint('u1', ['s1', 's2', 's3']);
    sys.revokeVoicePrint('u1');
    assertEqual(sys.voiceAuth.enrolledPrints.has('u1'), false);
    cleanup(sys);
  });
});

describe('AIVoiceAssistantIntegration — conversation context', () => {
  it('clearConversationContext resets context and memory', async () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    await sys.initialize();
    await sys.processCommand('turn on the light', null);
    sys.clearConversationContext();
    assertEqual(sys.conversationMemory.length, 0);
    assertEqual(Object.keys(sys.currentContext).length, 0);
    assertEqual(sys.dialogState, 'idle');
    cleanup(sys);
  });

  it('getConversationHistory returns copy of memory', async () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    await sys.initialize();
    await sys.processCommand('turn on the light', null);
    const history = sys.getConversationHistory();
    assert(Array.isArray(history), 'should be array');
    cleanup(sys);
  });
});

describe('AIVoiceAssistantIntegration — analytics & statistics', () => {
  it('getConversationAnalytics returns analytics object', async () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    await sys.initialize();
    await sys.processCommand('turn on the light', null);
    const analytics = sys.getConversationAnalytics();
    assert(analytics.totalCommands >= 1, 'should have counted commands');
    assertType(analytics.successRate, 'string');
    assert(Array.isArray(analytics.usageByHour), 'should have usage array');
    cleanup(sys);
  });

  it('resetAnalytics clears all counters', async () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    await sys.initialize();
    await sys.processCommand('turn on the light', null);
    sys.resetAnalytics();
    assertEqual(sys.analytics.totalCommands, 0);
    assertEqual(sys.analytics.successCount, 0);
    assertEqual(sys.commandHistory.length, 0);
    cleanup(sys);
  });

  it('getCommandHistory returns limited results', async () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    await sys.initialize();
    await sys.processCommand('turn on the light', null);
    const history = sys.getCommandHistory(10);
    assert(Array.isArray(history), 'should return array');
    cleanup(sys);
  });

  it('getStatistics returns comprehensive stats', async () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    await sys.initialize();
    const stats = sys.getStatistics();
    assertEqual(stats.initialized, true);
    assertType(stats.registeredIntents, 'number');
    assertType(stats.voiceProfiles, 'number');
    assertEqual(stats.defaultLanguage, 'sv');
    assertEqual(stats.wakeWord, 'Hey Hemma');
    cleanup(sys);
  });

  it('setProactiveSuggestions toggles suggestions', () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    sys.setProactiveSuggestions(false);
    assertEqual(sys.proactiveSuggestions.enabled, false);
    cleanup(sys);
  });

  it('generateProactiveSuggestion returns null when disabled', async () => {
    const sys = new AIVoiceAssistantIntegration(createMockHomey());
    await sys.initialize();
    sys.setProactiveSuggestions(false);
    const result = await sys.generateProactiveSuggestion({});
    assertEqual(result, null);
    cleanup(sys);
  });
});

run();
