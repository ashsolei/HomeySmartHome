'use strict';

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertType } = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');

const AmbientIntelligenceSystem = require('../lib/AmbientIntelligenceSystem');

/* ---- Timer-leak prevention ---- */
const _origSetTimeout = global.setTimeout;
const _origSetInterval = global.setInterval;
const activeHandles = [];
global.setTimeout = (...args) => { const id = _origSetTimeout(...args); activeHandles.push({ type: 'timeout', id }); return id; };
global.setInterval = (...args) => { const id = _origSetInterval(...args); activeHandles.push({ type: 'interval', id }); return id; };
function cleanup(sys) {
  try { sys.destroy(); } catch (_) {}
  while (activeHandles.length > 0) {
    const h = activeHandles.pop();
    if (h.type === 'timeout') clearTimeout(h.id); else clearInterval(h.id);
  }
}

function createAmbientMockHomey() {
  const homey = createMockHomey();
  homey.drivers = { getDevices: () => [] };
  homey.app.presenceManager = {
    getStatus: async () => ({ status: 'home', users: ['user1'], confidence: 0.9 })
  };
  return homey;
}

describe('AmbientIntelligenceSystem', () => {

  describe('constructor', () => {
    it('initializes with empty data structures', () => {
      const homey = createAmbientMockHomey();
      const sys = new AmbientIntelligenceSystem(homey);
      assert(sys.ambientRules instanceof Map, 'ambientRules is Map');
      assertEqual(sys.contextEngine, null);
      assertEqual(sys.ambientActions.length, 0);
      cleanup(sys);
    });
  });

  describe('initialize', () => {
    it('sets up context engine, default rules, and monitoring intervals', async () => {
      const homey = createAmbientMockHomey();
      const sys = new AmbientIntelligenceSystem(homey);
      await sys.initialize();
      assert(sys.contextEngine !== null, 'contextEngine initialized');
      assert(sys.contextEngine.currentContext !== null, 'current context set');
      assertEqual(sys.ambientRules.size, 4);
      assert(sys.contextMonitoringInterval !== null, 'context monitoring started');
      assert(sys.environmentalMonitoringInterval !== null, 'environmental monitoring started');
      assert(sys.learningInterval !== null, 'learning interval started');
      cleanup(sys);
    });
  });

  describe('getTimeOfDay', () => {
    it('returns a valid time-of-day classification', () => {
      const homey = createAmbientMockHomey();
      const sys = new AmbientIntelligenceSystem(homey);
      const valid = ['early_morning', 'morning', 'afternoon', 'evening', 'late_evening', 'night'];
      const result = sys.getTimeOfDay();
      assert(valid.includes(result), 'returns valid time of day: ' + result);
      cleanup(sys);
    });
  });

  describe('calculateActivityLevel', () => {
    it('returns 0 for no device changes', () => {
      const homey = createAmbientMockHomey();
      const sys = new AmbientIntelligenceSystem(homey);
      assertEqual(sys.calculateActivityLevel([]), 0);
      cleanup(sys);
    });

    it('returns increasing levels for more changes', () => {
      const homey = createAmbientMockHomey();
      const sys = new AmbientIntelligenceSystem(homey);
      assertEqual(sys.calculateActivityLevel([{}]), 0.2);
      assertEqual(sys.calculateActivityLevel(new Array(5).fill({})), 0.5);
      assertEqual(sys.calculateActivityLevel(new Array(15).fill({})), 0.8);
      assertEqual(sys.calculateActivityLevel(new Array(25).fill({})), 1.0);
      cleanup(sys);
    });
  });

  describe('categorizeDevice', () => {
    it('categorizes devices by name keywords', () => {
      const homey = createAmbientMockHomey();
      const sys = new AmbientIntelligenceSystem(homey);
      assertEqual(sys.categorizeDevice('Kitchen Light'), 'kitchen');
      assertEqual(sys.categorizeDevice('Living Room TV'), 'entertainment');
      assertEqual(sys.categorizeDevice('Office Desk Lamp'), 'office');
      assertEqual(sys.categorizeDevice('Hallway Sensor'), 'other');
      cleanup(sys);
    });
  });

  describe('isEssentialDevice', () => {
    it('identifies essential and non-essential devices', () => {
      const homey = createAmbientMockHomey();
      const sys = new AmbientIntelligenceSystem(homey);
      assert(sys.isEssentialDevice({ name: 'Security Camera' }), 'security is essential');
      assert(!sys.isEssentialDevice({ name: 'Living Room Lamp' }), 'lamp is not essential');
      assert(sys.isEssentialDevice({ name: 'Front Door Lock' }), 'lock is essential');
      cleanup(sys);
    });
  });

  describe('detectContextTransition', () => {
    it('detects presence change', () => {
      const homey = createAmbientMockHomey();
      const sys = new AmbientIntelligenceSystem(homey);
      const oldCtx = { presence: { status: 'home' }, activity: { level: 'active', specific: 'general' }, time: { timeOfDay: 'morning' } };
      const newCtx = { presence: { status: 'away' }, activity: { level: 'active', specific: 'general' }, time: { timeOfDay: 'morning' } };
      const transition = sys.detectContextTransition(oldCtx, newCtx);
      assertEqual(transition.type, 'presence_change');
      assertEqual(transition.from, 'home');
      assertEqual(transition.to, 'away');
      cleanup(sys);
    });

    it('returns null when no change detected', () => {
      const homey = createAmbientMockHomey();
      const sys = new AmbientIntelligenceSystem(homey);
      const ctx = { presence: { status: 'home' }, activity: { level: 'active', specific: 'general' }, time: { timeOfDay: 'morning' } };
      assertEqual(sys.detectContextTransition(ctx, ctx), null);
      cleanup(sys);
    });
  });

  describe('checkAmbientConditions', () => {
    it('returns true for empty conditions', async () => {
      const homey = createAmbientMockHomey();
      const sys = new AmbientIntelligenceSystem(homey);
      const result = await sys.checkAmbientConditions([], {});
      assertEqual(result, true);
      cleanup(sys);
    });

    it('returns false for unmet presence condition', async () => {
      const homey = createAmbientMockHomey();
      const sys = new AmbientIntelligenceSystem(homey);
      const conditions = [{ type: 'presence', value: 'home' }];
      const context = { presence: { status: 'away' }, activity: { level: 'idle' } };
      const result = await sys.checkAmbientConditions(conditions, context);
      assertEqual(result, false);
      cleanup(sys);
    });

    it('returns true for met presence condition', async () => {
      const homey = createAmbientMockHomey();
      const sys = new AmbientIntelligenceSystem(homey);
      const conditions = [{ type: 'presence', value: 'home' }];
      const context = { presence: { status: 'home' }, activity: { level: 'active' } };
      const result = await sys.checkAmbientConditions(conditions, context);
      assertEqual(result, true);
      cleanup(sys);
    });
  });

  describe('createAmbientRule', () => {
    it('creates and stores a new ambient rule', async () => {
      const homey = createAmbientMockHomey();
      const sys = new AmbientIntelligenceSystem(homey);
      const rule = await sys.createAmbientRule({
        id: 'test_rule',
        name: 'Test Rule',
        triggers: ['test'],
        actions: [],
        enabled: true
      });
      assertEqual(rule.id, 'test_rule');
      assert(sys.ambientRules.has('test_rule'), 'rule stored in map');
      assertType(rule.created, 'number');
      cleanup(sys);
    });
  });

  describe('getAmbientStatistics', () => {
    it('returns statistics after initialization', async () => {
      const homey = createAmbientMockHomey();
      const sys = new AmbientIntelligenceSystem(homey);
      await sys.initialize();
      const stats = sys.getAmbientStatistics();
      assertEqual(stats.rules, 4);
      assertType(stats.adaptiveBehaviors, 'number');
      assert(stats.currentContext !== null, 'has current context');
      cleanup(sys);
    });
  });

  describe('identifyBehaviorPatterns', () => {
    it('returns empty array (stub implementation)', () => {
      const homey = createAmbientMockHomey();
      const sys = new AmbientIntelligenceSystem(homey);
      const patterns = sys.identifyBehaviorPatterns();
      assert(Array.isArray(patterns), 'returns array');
      assertEqual(patterns.length, 0);
      cleanup(sys);
    });
  });

  describe('detectPresence', () => {
    it('returns presence status from manager', async () => {
      const homey = createAmbientMockHomey();
      const sys = new AmbientIntelligenceSystem(homey);
      const result = await sys.detectPresence();
      assertEqual(result.status, 'home');
      assert(Array.isArray(result.users), 'has users array');
      cleanup(sys);
    });

    it('returns unknown when manager is unavailable', async () => {
      const homey = createAmbientMockHomey();
      homey.app.presenceManager = null;
      const sys = new AmbientIntelligenceSystem(homey);
      const result = await sys.detectPresence();
      assertEqual(result.status, 'unknown');
      cleanup(sys);
    });
  });

  describe('detectActivity', () => {
    it('returns idle with no device changes', async () => {
      const homey = createAmbientMockHomey();
      const sys = new AmbientIntelligenceSystem(homey);
      const result = await sys.detectActivity();
      assertEqual(result.level, 'idle');
      assertEqual(result.score, 0);
      assertEqual(result.recentChanges, 0);
      cleanup(sys);
    });
  });

  describe('saveAmbientRules', () => {
    it('persists rules to settings', async () => {
      const homey = createAmbientMockHomey();
      const sys = new AmbientIntelligenceSystem(homey);
      sys.ambientRules.set('r1', { id: 'r1', name: 'Rule 1' });
      await sys.saveAmbientRules();
      const saved = homey.settings.get('ambientRules');
      assert(saved !== null, 'rules saved to settings');
      assertEqual(saved.r1.name, 'Rule 1');
      cleanup(sys);
    });
  });

  describe('destroy', () => {
    it('clears all monitoring intervals', async () => {
      const homey = createAmbientMockHomey();
      const sys = new AmbientIntelligenceSystem(homey);
      await sys.initialize();
      sys.destroy();
      assertEqual(sys.contextMonitoringInterval, null);
      assertEqual(sys.environmentalMonitoringInterval, null);
      assertEqual(sys.learningInterval, null);
      cleanup(sys);
    });
  });

});

run();
