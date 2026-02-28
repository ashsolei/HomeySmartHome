'use strict';

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertType, assertInstanceOf } = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');

/* ── timer-leak prevention ─────────────────────────────────────────── */
const _origSetTimeout = global.setTimeout;
const _origSetInterval = global.setInterval;
const activeHandles = [];
global.setTimeout = (...a) => { const id = _origSetTimeout(...a); activeHandles.push({ type: 'timeout', id }); return id; };
global.setInterval = (...a) => { const id = _origSetInterval(...a); activeHandles.push({ type: 'interval', id }); return id; };
function cleanup(sys) {
  try { if (sys && typeof sys.destroy === 'function') sys.destroy(); } catch (_) { /* ignore */ }
  while (activeHandles.length > 0) {
    const h = activeHandles.pop();
    if (h.type === 'timeout') clearTimeout(h.id); else clearInterval(h.id);
  }
}

/* ── helpers ────────────────────────────────────────────────────────── */
const SmartHomeAdaptiveLearningSystem = require('../lib/SmartHomeAdaptiveLearningSystem');

async function createInitialized() {
  const homey = createMockHomey();
  const sys = new SmartHomeAdaptiveLearningSystem(homey);
  await sys.initialize();
  return sys;
}

/* ════════════════════════════════════════════════════════════════════ */
/*  TESTS                                                              */
/* ════════════════════════════════════════════════════════════════════ */

describe('SmartHomeAdaptiveLearningSystem', () => {

  // ── constructor ──────────────────────────────────────────────────

  describe('constructor', () => {
    it('creates instance with expected defaults', () => {
      const homey = createMockHomey();
      const sys = new SmartHomeAdaptiveLearningSystem(homey);
      try {
        assertEqual(sys.initialized, false);
        assertInstanceOf(sys.userProfiles, Map);
        assertInstanceOf(sys.preferenceModels, Map);
        assertInstanceOf(sys.circadianModels, Map);
        assertInstanceOf(sys.habitStreaks, Map);
        assertInstanceOf(sys.comfortScores, Map);
        assertInstanceOf(sys.routines, Map);
        assertType(sys.behaviorLog, 'object'); // array
        assertEqual(sys.maxBehaviorLogSize, 50000);
        assertEqual(sys.dataRetentionDays, 90);
        assertEqual(sys.confidenceThreshold, 0.75);
      } finally { cleanup(sys); }
    });

    it('sets default preferences', () => {
      const homey = createMockHomey();
      const sys = new SmartHomeAdaptiveLearningSystem(homey);
      try {
        assertEqual(sys.defaultPreferences.lighting.brightness, 70);
        assertEqual(sys.defaultPreferences.temperature.target, 21.5);
        assertEqual(sys.defaultPreferences.music.volume, 30);
        assertEqual(sys.defaultPreferences.curtains.position, 50);
      } finally { cleanup(sys); }
    });

    it('initialises reward weights map', () => {
      const homey = createMockHomey();
      const sys = new SmartHomeAdaptiveLearningSystem(homey);
      try {
        assertEqual(sys.rewardWeights.get('lightingAccepted'), 1.0);
        assertEqual(sys.rewardWeights.get('lightingOverridden'), -0.5);
        assertEqual(sys.rewardWeights.get('automationAccepted'), 1.5);
        assertEqual(sys.rewardWeights.get('automationDismissed'), -1.0);
      } finally { cleanup(sys); }
    });

    it('sets up config with interval timings', () => {
      const homey = createMockHomey();
      const sys = new SmartHomeAdaptiveLearningSystem(homey);
      try {
        assertEqual(sys.config.enabled, true);
        assertEqual(sys.config.learningRate, 0.05);
        assertEqual(sys.config.anonymiseDataOnExpiry, true);
      } finally { cleanup(sys); }
    });
  });

  // ── initialize ───────────────────────────────────────────────────

  describe('initialize', () => {
    it('sets initialized to true and starts intervals', async () => {
      const sys = await createInitialized();
      try {
        assertEqual(sys.initialized, true);
        assert(sys.intervals.length > 0, 'intervals should be registered');
      } finally { cleanup(sys); }
    });

    it('emits initialized event', async () => {
      const homey = createMockHomey();
      const sys = new SmartHomeAdaptiveLearningSystem(homey);
      let emitted = false;
      sys.on('initialized', () => { emitted = true; });
      try {
        await sys.initialize();
        assert(emitted, 'initialized event should fire');
      } finally { cleanup(sys); }
    });

    it('loads persisted state from settings', async () => {
      const homey = createMockHomey();
      const persisted = JSON.stringify({
        confidenceThreshold: 0.85,
        behaviorLog: [{ id: '1', userId: 'u1', eventType: 'wake', timestamp: Date.now() }]
      });
      homey.settings.set('adaptiveLearningState', persisted);
      const sys = new SmartHomeAdaptiveLearningSystem(homey);
      try {
        await sys.initialize();
        assertEqual(sys.confidenceThreshold, 0.85);
        assertEqual(sys.behaviorLog.length, 1);
      } finally { cleanup(sys); }
    });
  });

  // ── destroy ──────────────────────────────────────────────────────

  describe('destroy', () => {
    it('clears intervals and resets state', async () => {
      const sys = await createInitialized();
      sys.recordBehaviorEvent('u1', 'wake');
      sys.destroy();
      try {
        assertEqual(sys.initialized, false);
        assertEqual(sys.intervals.length, 0);
        assertEqual(sys.behaviorLog.length, 0);
        assertEqual(sys.userProfiles.size, 0);
      } finally { cleanup(sys); }
    });

    it('emits destroyed event', async () => {
      const sys = await createInitialized();
      let emitted = false;
      sys.on('destroyed', () => { emitted = true; });
      sys.destroy();
      try {
        assert(emitted, 'destroyed event should fire');
      } finally { cleanup(sys); }
    });

    it('persists state to settings', async () => {
      const homey = createMockHomey();
      const sys = new SmartHomeAdaptiveLearningSystem(homey);
      await sys.initialize();
      sys.recordBehaviorEvent('u1', 'wake');
      sys.destroy();
      try {
        const saved = homey.settings.get('adaptiveLearningState');
        assert(saved !== undefined, 'state should be persisted');
        const parsed = JSON.parse(saved);
        assert(parsed.savedAt > 0, 'savedAt should be set');
      } finally { cleanup(sys); }
    });
  });

  // ── getStatus ────────────────────────────────────────────────────

  describe('getStatus', () => {
    it('returns comprehensive status object', async () => {
      const sys = await createInitialized();
      try {
        const status = sys.getStatus();
        assertEqual(status.initialized, true);
        assertType(status.userCount, 'number');
        assertType(status.behaviorLogSize, 'number');
        assertType(status.routineCount, 'number');
        assertType(status.pendingPredictions, 'number');
        assertType(status.anomalyCount, 'number');
        assertType(status.confidenceThreshold, 'number');
        assertType(status.context, 'object');
        assertType(status.config, 'object');
      } finally { cleanup(sys); }
    });
  });

  // ── recordBehaviorEvent ──────────────────────────────────────────

  describe('recordBehaviorEvent', () => {
    it('adds event to behavior log', async () => {
      const sys = await createInitialized();
      try {
        sys.recordBehaviorEvent('user1', 'wake', { room: 'bedroom' });
        assertEqual(sys.behaviorLog.length, 1);
        assertEqual(sys.behaviorLog[0].userId, 'user1');
        assertEqual(sys.behaviorLog[0].eventType, 'wake');
        assertType(sys.behaviorLog[0].timestamp, 'number');
      } finally { cleanup(sys); }
    });

    it('creates user profile if not existing', async () => {
      const sys = await createInitialized();
      try {
        sys.recordBehaviorEvent('newUser', 'arrive');
        assert(sys.userProfiles.has('newUser'), 'profile should exist');
        assertEqual(sys.userProfiles.get('newUser').userId, 'newUser');
      } finally { cleanup(sys); }
    });

    it('emits behaviorEvent', async () => {
      const sys = await createInitialized();
      let captured = null;
      sys.on('behaviorEvent', (ev) => { captured = ev; });
      try {
        sys.recordBehaviorEvent('u1', 'depart');
        assert(captured !== null, 'event should fire');
        assertEqual(captured.eventType, 'depart');
      } finally { cleanup(sys); }
    });

    it('respects maxBehaviorLogSize', async () => {
      const sys = await createInitialized();
      sys.maxBehaviorLogSize = 5;
      try {
        for (let i = 0; i < 8; i++) {
          sys.recordBehaviorEvent('u1', 'device_use');
        }
        assertEqual(sys.behaviorLog.length, 5);
      } finally { cleanup(sys); }
    });
  });

  // ── recordPreference ─────────────────────────────────────────────

  describe('recordPreference', () => {
    it('stores preference observation', async () => {
      const sys = await createInitialized();
      try {
        sys.recordPreference('u1', 'lighting', { brightness: 85, colorTemp: 4500 });
        const model = sys.preferenceModels.get('u1');
        assert(model !== undefined, 'model should exist');
        assertEqual(model.lighting.length, 1);
        assertEqual(model.lighting[0].values.brightness, 85);
      } finally { cleanup(sys); }
    });

    it('emits preferenceRecorded', async () => {
      const sys = await createInitialized();
      let captured = null;
      sys.on('preferenceRecorded', (ev) => { captured = ev; });
      try {
        sys.recordPreference('u1', 'temperature', { target: 22 });
        assert(captured !== null, 'event should fire');
        assertEqual(captured.category, 'temperature');
      } finally { cleanup(sys); }
    });

    it('caps at 2000 observations per category', async () => {
      const sys = await createInitialized();
      try {
        for (let i = 0; i < 2010; i++) {
          sys.recordPreference('u1', 'lighting', { brightness: i % 100 });
        }
        const model = sys.preferenceModels.get('u1');
        assertEqual(model.lighting.length, 2000);
      } finally { cleanup(sys); }
    });
  });

  // ── recordFeedback ───────────────────────────────────────────────

  describe('recordFeedback', () => {
    it('stores feedback with weight from rewardWeights', async () => {
      const sys = await createInitialized();
      try {
        sys.recordFeedback('u1', 'lightingAccepted', { brightness: 70 });
        assertEqual(sys.feedbackLog.length, 1);
        assertEqual(sys.feedbackLog[0].weight, 1.0);
        assertEqual(sys.feedbackLog[0].actionType, 'lightingAccepted');
      } finally { cleanup(sys); }
    });

    it('adjusts confidence threshold on negative feedback', async () => {
      const sys = await createInitialized();
      const before = sys.confidenceThreshold;
      try {
        sys.recordFeedback('u1', 'lightingOverridden');
        assert(sys.confidenceThreshold > before, 'threshold should increase on negative feedback');
      } finally { cleanup(sys); }
    });

    it('lowers confidence threshold on positive feedback', async () => {
      const sys = await createInitialized();
      const before = sys.confidenceThreshold;
      try {
        sys.recordFeedback('u1', 'lightingAccepted');
        assert(sys.confidenceThreshold < before, 'threshold should decrease on positive feedback');
      } finally { cleanup(sys); }
    });

    it('tracks prediction accuracy', async () => {
      const sys = await createInitialized();
      try {
        sys.recordFeedback('u1', 'lightingAccepted');
        assertEqual(sys.predictionAccuracy.correctPredictions, 1);
      } finally { cleanup(sys); }
    });

    it('tracks per-category accuracy', async () => {
      const sys = await createInitialized();
      try {
        sys.recordFeedback('u1', 'lightingAccepted');
        sys.recordFeedback('u1', 'lightingOverridden');
        assertEqual(sys.predictionAccuracy.byCategory.lighting.total, 2);
        assertEqual(sys.predictionAccuracy.byCategory.lighting.correct, 1);
      } finally { cleanup(sys); }
    });
  });

  // ── setGuestPresence ─────────────────────────────────────────────

  describe('setGuestPresence', () => {
    it('updates context guest state', async () => {
      const sys = await createInitialized();
      try {
        sys.setGuestPresence(true, 3);
        assertEqual(sys.context.guestsPresent, true);
        assertEqual(sys.context.guestCount, 3);
      } finally { cleanup(sys); }
    });

    it('emits guestPresenceChanged', async () => {
      const sys = await createInitialized();
      let captured = null;
      sys.on('guestPresenceChanged', (ev) => { captured = ev; });
      try {
        sys.setGuestPresence(false, 0);
        assertEqual(captured.present, false);
        assertEqual(captured.count, 0);
      } finally { cleanup(sys); }
    });
  });

  // ── updateWeatherContext ─────────────────────────────────────────

  describe('updateWeatherContext', () => {
    it('merges weather into context', async () => {
      const sys = await createInitialized();
      try {
        sys.updateWeatherContext({ condition: 'rain', tempC: 12 });
        assertEqual(sys.context.weather.condition, 'rain');
        assertEqual(sys.context.weather.tempC, 12);
      } finally { cleanup(sys); }
    });

    it('ignores non-object input', async () => {
      const sys = await createInitialized();
      try {
        sys.updateWeatherContext(null);
        assertEqual(sys.context.weather.condition, 'clear');
      } finally { cleanup(sys); }
    });
  });

  // ── setUserPriority ──────────────────────────────────────────────

  describe('setUserPriority', () => {
    it('stores priority in conflict resolution map', async () => {
      const sys = await createInitialized();
      try {
        sys.setUserPriority('u1', 10);
        assertEqual(sys.conflictResolution.userPriorities.get('u1'), 10);
      } finally { cleanup(sys); }
    });
  });

  // ── getCurrentPredictions ────────────────────────────────────────

  describe('getCurrentPredictions', () => {
    it('returns empty array when no predictions', async () => {
      const sys = await createInitialized();
      try {
        const preds = sys.getCurrentPredictions();
        assertType(preds, 'object');
        assertEqual(preds.length, 0);
      } finally { cleanup(sys); }
    });

    it('filters by confidence threshold', async () => {
      const sys = await createInitialized();
      try {
        sys.pendingPredictions.push(
          { id: '1', confidence: 0.9, userId: 'u1' },
          { id: '2', confidence: 0.3, userId: 'u1' }
        );
        const preds = sys.getCurrentPredictions();
        assertEqual(preds.length, 1);
        assertEqual(preds[0].id, '1');
      } finally { cleanup(sys); }
    });
  });

  // ── getRecentAnomalies ───────────────────────────────────────────

  describe('getRecentAnomalies', () => {
    it('returns anomalies within time window', async () => {
      const sys = await createInitialized();
      try {
        const now = Date.now();
        sys.anomalies.push(
          { id: '1', timestamp: now - 1000, type: 'test' },
          { id: '2', timestamp: now - 100000000, type: 'old' }
        );
        const recent = sys.getRecentAnomalies(86400000);
        assertEqual(recent.length, 1);
        assertEqual(recent[0].id, '1');
      } finally { cleanup(sys); }
    });
  });

  // ── getAutomationSuggestions ─────────────────────────────────────

  describe('getAutomationSuggestions', () => {
    it('returns copy of suggestions array', async () => {
      const sys = await createInitialized();
      try {
        sys.automationSuggestions.push({ id: 's1', title: 'test' });
        const suggestions = sys.getAutomationSuggestions();
        assertEqual(suggestions.length, 1);
        suggestions.push({ id: 's2' });
        assertEqual(sys.automationSuggestions.length, 1);
      } finally { cleanup(sys); }
    });
  });

  // ── respondToSuggestion ──────────────────────────────────────────

  describe('respondToSuggestion', () => {
    it('accepts suggestion and records feedback', async () => {
      const sys = await createInitialized();
      try {
        sys.automationSuggestions.push({
          id: 's1', title: 'test', responded: false, userId: 'u1'
        });
        sys.respondToSuggestion('s1', true);
        assertEqual(sys.automationSuggestions.length, 0);
        assert(sys.feedbackLog.length > 0, 'feedback should be recorded');
      } finally { cleanup(sys); }
    });

    it('dismisses suggestion and records negative feedback', async () => {
      const sys = await createInitialized();
      try {
        sys.automationSuggestions.push({
          id: 's2', title: 'test', responded: false, userId: 'u1'
        });
        sys.respondToSuggestion('s2', false);
        assertEqual(sys.automationSuggestions.length, 0);
        const fb = sys.feedbackLog.find(f => f.actionType === 'automationDismissed');
        assert(fb !== undefined, 'dismissal feedback should exist');
      } finally { cleanup(sys); }
    });

    it('does nothing for unknown suggestion id', async () => {
      const sys = await createInitialized();
      try {
        sys.respondToSuggestion('nonexistent', true);
        assertEqual(sys.feedbackLog.length, 0);
      } finally { cleanup(sys); }
    });
  });

  // ── getComfortScore ──────────────────────────────────────────────

  describe('getComfortScore', () => {
    it('returns null for unknown user', async () => {
      const sys = await createInitialized();
      try {
        assertEqual(sys.getComfortScore('unknown'), null);
      } finally { cleanup(sys); }
    });

    it('returns score when set', async () => {
      const sys = await createInitialized();
      try {
        sys.comfortScores.set('u1', { overall: 85, userId: 'u1' });
        const score = sys.getComfortScore('u1');
        assertEqual(score.overall, 85);
      } finally { cleanup(sys); }
    });
  });

  // ── getOptimisationRecommendations ───────────────────────────────

  describe('getOptimisationRecommendations', () => {
    it('returns copy of recommendations', async () => {
      const sys = await createInitialized();
      try {
        sys.optimisationRecommendations.push({ id: 'r1', type: 'test' });
        const recs = sys.getOptimisationRecommendations();
        assertEqual(recs.length, 1);
        recs.push({ id: 'r2' });
        assertEqual(sys.optimisationRecommendations.length, 1);
      } finally { cleanup(sys); }
    });
  });

  // ── getHabitStreaks ──────────────────────────────────────────────

  describe('getHabitStreaks', () => {
    it('returns null for unknown user', async () => {
      const sys = await createInitialized();
      try {
        assertEqual(sys.getHabitStreaks('ghost'), null);
      } finally { cleanup(sys); }
    });

    it('returns streak data when set', async () => {
      const sys = await createInitialized();
      try {
        sys.habitStreaks.set('u1', { habits: { wake: { currentStreak: 5 } } });
        const streaks = sys.getHabitStreaks('u1');
        assertEqual(streaks.habits.wake.currentStreak, 5);
      } finally { cleanup(sys); }
    });
  });

  // ── getCircadianModel ────────────────────────────────────────────

  describe('getCircadianModel', () => {
    it('returns null for unknown user', async () => {
      const sys = await createInitialized();
      try {
        assertEqual(sys.getCircadianModel('ghost'), null);
      } finally { cleanup(sys); }
    });

    it('returns model when set', async () => {
      const sys = await createInitialized();
      try {
        sys.circadianModels.set('u1', { wakeTimeMinutes: 420, chronotype: 'moderate' });
        const model = sys.getCircadianModel('u1');
        assertEqual(model.chronotype, 'moderate');
      } finally { cleanup(sys); }
    });
  });

  // ── resolveConflict ──────────────────────────────────────────────

  describe('resolveConflict', () => {
    it('returns defaults for empty preferences', async () => {
      const sys = await createInitialized();
      try {
        const result = sys.resolveConflict('lighting', 'living', []);
        assertType(result, 'object');
      } finally { cleanup(sys); }
    });

    it('returns single-user method for one preference', async () => {
      const sys = await createInitialized();
      try {
        const result = sys.resolveConflict('lighting', 'living', [
          { userId: 'u1', value: 80 }
        ]);
        assertEqual(result.resolved, 80);
        assertEqual(result.method, 'single-user');
      } finally { cleanup(sys); }
    });

    it('uses weighted-average strategy by default', async () => {
      const sys = await createInitialized();
      try {
        sys.setUserPriority('u1', 2);
        sys.setUserPriority('u2', 1);
        const result = sys.resolveConflict('temperature', 'living', [
          { userId: 'u1', value: 22 },
          { userId: 'u2', value: 19 }
        ]);
        assertEqual(result.method, 'weighted-average');
        assertType(result.resolved, 'number');
        // u1 has weight 2, u2 has weight 1: (22*2 + 19*1)/(2+1) = 21
        assertEqual(result.resolved, 21);
      } finally { cleanup(sys); }
    });

    it('uses priority strategy when configured', async () => {
      const sys = await createInitialized();
      sys.conflictResolution.strategy = 'priority';
      try {
        sys.setUserPriority('u1', 1);
        sys.setUserPriority('u2', 10);
        const result = sys.resolveConflict('lighting', 'bedroom', [
          { userId: 'u1', value: 50 },
          { userId: 'u2', value: 90 }
        ]);
        assertEqual(result.resolved, 90);
        assertEqual(result.method, 'priority');
      } finally { cleanup(sys); }
    });

    it('increments resolvedCount', async () => {
      const sys = await createInitialized();
      try {
        sys.resolveConflict('lighting', 'living', [
          { userId: 'u1', value: 80 },
          { userId: 'u2', value: 60 }
        ]);
        assertEqual(sys.conflictResolution.resolvedCount, 1);
      } finally { cleanup(sys); }
    });

    it('stores conflict in activeConflicts', async () => {
      const sys = await createInitialized();
      try {
        sys.resolveConflict('temperature', 'bedroom', [
          { userId: 'u1', value: 20 },
          { userId: 'u2', value: 23 }
        ]);
        assertEqual(sys.conflictResolution.activeConflicts.length, 1);
      } finally { cleanup(sys); }
    });
  });

  // ── recordEnergySample ───────────────────────────────────────────

  describe('recordEnergySample', () => {
    it('adds sample with timestamp', async () => {
      const sys = await createInitialized();
      try {
        sys.recordEnergySample({ energyKwh: 1.5, activeBehaviors: ['heating'] });
        assertEqual(sys.energyBehaviorSamples.length, 1);
        assertType(sys.energyBehaviorSamples[0].timestamp, 'number');
      } finally { cleanup(sys); }
    });

    it('caps at 10000 samples', async () => {
      const sys = await createInitialized();
      try {
        for (let i = 0; i < 10010; i++) {
          sys.recordEnergySample({ energyKwh: 0.1 });
        }
        assertEqual(sys.energyBehaviorSamples.length, 10000);
      } finally { cleanup(sys); }
    });
  });

  // ── _classifyChronotype (private, tested via circadian) ──────────

  describe('chronotype classification', () => {
    it('classifies extreme-early for very early wake', async () => {
      const sys = await createInitialized();
      try {
        assertEqual(sys._classifyChronotype(300), 'extreme-early');
      } finally { cleanup(sys); }
    });

    it('classifies early-bird', async () => {
      const sys = await createInitialized();
      try {
        assertEqual(sys._classifyChronotype(360), 'early-bird');
      } finally { cleanup(sys); }
    });

    it('classifies moderate', async () => {
      const sys = await createInitialized();
      try {
        assertEqual(sys._classifyChronotype(420), 'moderate');
      } finally { cleanup(sys); }
    });

    it('classifies late-riser', async () => {
      const sys = await createInitialized();
      try {
        assertEqual(sys._classifyChronotype(500), 'late-riser');
      } finally { cleanup(sys); }
    });

    it('classifies night-owl', async () => {
      const sys = await createInitialized();
      try {
        assertEqual(sys._classifyChronotype(600), 'night-owl');
      } finally { cleanup(sys); }
    });
  });

  // ── _estimatePeakAlertness ───────────────────────────────────────

  describe('peak alertness', () => {
    it('returns window 2-4 hours after wake', async () => {
      const sys = await createInitialized();
      try {
        const peak = sys._estimatePeakAlertness(420);
        assertEqual(peak.start, 540);
        assertEqual(peak.end, 660);
      } finally { cleanup(sys); }
    });
  });

  // ── _currentSeason ───────────────────────────────────────────────

  describe('_currentSeason', () => {
    it('returns a valid season string', async () => {
      const sys = await createInitialized();
      try {
        const season = sys._currentSeason();
        assert(
          ['spring', 'summer', 'autumn', 'winter'].includes(season),
          `${season} should be valid`
        );
      } finally { cleanup(sys); }
    });
  });

  // ── _classifyTimeOfDay ───────────────────────────────────────────

  describe('_classifyTimeOfDay', () => {
    it('classifies early morning', async () => {
      const sys = await createInitialized();
      try {
        const d = new Date(); d.setHours(6, 0, 0, 0);
        assertEqual(sys._classifyTimeOfDay(d), 'early-morning');
      } finally { cleanup(sys); }
    });

    it('classifies evening', async () => {
      const sys = await createInitialized();
      try {
        const d = new Date(); d.setHours(18, 0, 0, 0);
        assertEqual(sys._classifyTimeOfDay(d), 'evening');
      } finally { cleanup(sys); }
    });

    it('classifies late-night', async () => {
      const sys = await createInitialized();
      try {
        const d = new Date(); d.setHours(2, 0, 0, 0);
        assertEqual(sys._classifyTimeOfDay(d), 'late-night');
      } finally { cleanup(sys); }
    });
  });

  // ── _isHoliday ──────────────────────────────────────────────────

  describe('_isHoliday', () => {
    it('returns true for Christmas Eve', async () => {
      const sys = await createInitialized();
      try {
        const d = new Date(2024, 11, 24); // Dec 24
        assertEqual(sys._isHoliday(d), true);
      } finally { cleanup(sys); }
    });

    it('returns false for regular day', async () => {
      const sys = await createInitialized();
      try {
        const d = new Date(2024, 2, 15); // Mar 15
        assertEqual(sys._isHoliday(d), false);
      } finally { cleanup(sys); }
    });
  });

  // ── _minutesToTimeStr ────────────────────────────────────────────

  describe('_minutesToTimeStr', () => {
    it('converts minutes to HH:MM', async () => {
      const sys = await createInitialized();
      try {
        assertEqual(sys._minutesToTimeStr(420), '07:00');
        assertEqual(sys._minutesToTimeStr(1350), '22:30');
        assertEqual(sys._minutesToTimeStr(0), '00:00');
      } finally { cleanup(sys); }
    });
  });

  // ── _anonymise ───────────────────────────────────────────────────

  describe('_anonymise', () => {
    it('returns anon for falsy input', async () => {
      const sys = await createInitialized();
      try {
        assertEqual(sys._anonymise(null), 'anon');
        assertEqual(sys._anonymise(''), 'anon');
      } finally { cleanup(sys); }
    });

    it('returns deterministic hash for same input', async () => {
      const sys = await createInitialized();
      try {
        const a = sys._anonymise('user123');
        const b = sys._anonymise('user123');
        assertEqual(a, b);
        assert(a.startsWith('anon_'), 'should start with anon_');
      } finally { cleanup(sys); }
    });
  });

  // ── context management ───────────────────────────────────────────

  describe('context', () => {
    it('has valid initial context fields', async () => {
      const sys = await createInitialized();
      try {
        assertType(sys.context.dayOfWeek, 'number');
        assertType(sys.context.isWeekend, 'boolean');
        assertType(sys.context.timeOfDay, 'string');
        assertType(sys.context.season, 'string');
        assertType(sys.context.weather, 'object');
      } finally { cleanup(sys); }
    });

    it('_refreshContext updates all context fields', async () => {
      const sys = await createInitialized();
      try {
        sys.context.season = 'fake';
        sys._refreshContext();
        assert(sys.context.season !== 'fake', 'season should be refreshed');
      } finally { cleanup(sys); }
    });
  });

  // ── _uid ─────────────────────────────────────────────────────────

  describe('_uid', () => {
    it('generates unique ids', async () => {
      const sys = await createInitialized();
      try {
        const a = sys._uid();
        const b = sys._uid();
        assertType(a, 'string');
        assert(a !== b, 'ids should be unique');
      } finally { cleanup(sys); }
    });
  });

  // ── _estimateSunPosition ─────────────────────────────────────────

  describe('_estimateSunPosition', () => {
    it('returns rising for early morning', async () => {
      const sys = await createInitialized();
      try {
        const d = new Date(); d.setHours(7, 0, 0, 0);
        assertEqual(sys._estimateSunPosition(d), 'rising');
      } finally { cleanup(sys); }
    });

    it('returns zenith at noon', async () => {
      const sys = await createInitialized();
      try {
        const d = new Date(); d.setHours(13, 0, 0, 0);
        assertEqual(sys._estimateSunPosition(d), 'zenith');
      } finally { cleanup(sys); }
    });

    it('returns below-horizon at night', async () => {
      const sys = await createInitialized();
      try {
        const d = new Date(); d.setHours(23, 0, 0, 0);
        assertEqual(sys._estimateSunPosition(d), 'below-horizon');
      } finally { cleanup(sys); }
    });
  });

  // ── _getMaxStep ──────────────────────────────────────────────────

  describe('_getMaxStep', () => {
    it('returns correct max steps per system', async () => {
      const sys = await createInitialized();
      try {
        assertEqual(sys._getMaxStep('lighting', 'setBrightness'), 5);
        assertEqual(sys._getMaxStep('climate', 'setTemperature'), 0.3);
        assertEqual(sys._getMaxStep('music', 'setVolume'), 3);
        assertEqual(sys._getMaxStep('curtains', 'setPosition'), 5);
        assertEqual(sys._getMaxStep('unknown', 'x'), 5);
      } finally { cleanup(sys); }
    });
  });

  // ── _estimateCurrentValue ────────────────────────────────────────

  describe('_estimateCurrentValue', () => {
    it('returns default values per system', async () => {
      const sys = await createInitialized();
      try {
        assertEqual(sys._estimateCurrentValue('lighting', 'setBrightness'), 70);
        assertEqual(sys._estimateCurrentValue('lighting', 'setColorTemp'), 4000);
        assertEqual(sys._estimateCurrentValue('climate', 'setTemperature'), 21.5);
        assertEqual(sys._estimateCurrentValue('curtains', 'setPosition'), 50);
        assertEqual(sys._estimateCurrentValue('music', 'setVolume'), 30);
        assertEqual(sys._estimateCurrentValue('x', 'y'), 0);
      } finally { cleanup(sys); }
    });
  });

  // ── gradual transitions ──────────────────────────────────────────

  describe('gradual transitions', () => {
    it('_startGradualTransition adds to activeTransitions', async () => {
      const sys = await createInitialized();
      try {
        sys._startGradualTransition({
          system: 'lighting', action: 'setBrightness',
          targetValue: 90, durationMs: 5000, startedAt: Date.now()
        });
        assertEqual(sys.activeTransitions.length, 1);
        assert(sys.activeTransitions[0].id !== undefined, 'should have id');
      } finally { cleanup(sys); }
    });
  });
});

run();
