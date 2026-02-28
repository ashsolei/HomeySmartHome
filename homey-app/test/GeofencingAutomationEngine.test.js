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
  try { if (sys && typeof sys.destroy === 'function') sys.destroy(); } catch (_) { /* ignore */ }
  while (activeHandles.length > 0) {
    const h = activeHandles.pop();
    if (h.type === 'timeout') clearTimeout(h.id); else clearInterval(h.id);
  }
}

/* ── helpers ────────────────────────────────────────────────────────── */
const GeofencingAutomationEngine = require('../lib/GeofencingAutomationEngine');

function createSystem() {
  const homey = createMockHomey();
  const sys = new GeofencingAutomationEngine(homey);
  return sys;
}

async function createInitialized() {
  const sys = createSystem();
  await sys.initialize();
  return sys;
}

/* ════════════════════════════════════════════════════════════════════ */
/*  TESTS                                                              */
/* ════════════════════════════════════════════════════════════════════ */

describe('GeofencingAutomationEngine', () => {

  // ── constructor ──────────────────────────────────────────────────

  describe('constructor', () => {
    it('creates instance with expected defaults', () => {
      const sys = createSystem();
      try {
        assertEqual(sys.rules.size, 0);
        assertEqual(sys.executionHistory.length, 0);
        assertEqual(sys.maxHistorySize, 100);
        assert(sys.presets.arriveHome, 'should have arriveHome preset');
        assert(sys.presets.leaveHome, 'should have leaveHome preset');
      } finally { cleanup(sys); }
    });
  });

  // ── initialize ───────────────────────────────────────────────────

  describe('initialize', () => {
    it('installs default presets', async () => {
      const sys = await createInitialized();
      try {
        assertEqual(sys.rules.size, 2);
        assert(sys.rules.has('preset_arrive_home'), 'should have arrive preset');
        assert(sys.rules.has('preset_leave_home'), 'should have leave preset');
      } finally { cleanup(sys); }
    });

    it('presets have correct trigger types', async () => {
      const sys = await createInitialized();
      try {
        const arrive = sys.rules.get('preset_arrive_home');
        const leave = sys.rules.get('preset_leave_home');
        assertEqual(arrive.trigger, 'arrive');
        assertEqual(arrive.zone, 'home');
        assertEqual(leave.trigger, 'depart');
        assertEqual(leave.zone, 'home');
      } finally { cleanup(sys); }
    });
  });

  // ── addRule ──────────────────────────────────────────────────────

  describe('addRule', () => {
    it('adds a custom rule', async () => {
      const sys = await createInitialized();
      try {
        const result = sys.addRule({
          trigger: 'arrive',
          zone: 'office',
          actions: [{ type: 'sendNotification', message: 'At office' }],
        });
        assert(result.success, 'should succeed');
        assertType(result.rule.id, 'string');
        assertEqual(result.rule.trigger, 'arrive');
        assertEqual(result.rule.zone, 'office');
        assertEqual(sys.rules.size, 3); // 2 presets + 1 custom
      } finally { cleanup(sys); }
    });

    it('throws without required fields', async () => {
      const sys = await createInitialized();
      try {
        let threw = false;
        try { sys.addRule({ trigger: 'arrive' }); } catch (_) { threw = true; }
        assert(threw, 'should throw without zone/actions');
      } finally { cleanup(sys); }
    });

    it('accepts custom id', async () => {
      const sys = await createInitialized();
      try {
        const result = sys.addRule({
          id: 'custom_rule_1',
          trigger: 'depart',
          zone: 'gym',
          actions: [{ type: 'setHVAC', mode: 'eco', temperature: 18 }],
        });
        assertEqual(result.rule.id, 'custom_rule_1');
        assert(sys.rules.has('custom_rule_1'), 'rule should be stored');
      } finally { cleanup(sys); }
    });
  });

  // ── removeRule ───────────────────────────────────────────────────

  describe('removeRule', () => {
    it('removes an existing rule', async () => {
      const sys = await createInitialized();
      try {
        sys.addRule({ id: 'to_remove', trigger: 'arrive', zone: 'park', actions: [] });
        assertEqual(sys.rules.size, 3);
        const result = sys.removeRule('to_remove');
        assert(result.success, 'should succeed');
        assertEqual(sys.rules.size, 2);
      } finally { cleanup(sys); }
    });

    it('returns false for non-existent rule', async () => {
      const sys = await createInitialized();
      try {
        const result = sys.removeRule('nonexistent');
        assertEqual(result.success, false);
      } finally { cleanup(sys); }
    });
  });

  // ── listRules ────────────────────────────────────────────────────

  describe('listRules', () => {
    it('returns all rules as array', async () => {
      const sys = await createInitialized();
      try {
        const rules = sys.listRules();
        assertEqual(rules.length, 2);
        assert(Array.isArray(rules), 'should be array');
      } finally { cleanup(sys); }
    });
  });

  // ── processEvent ─────────────────────────────────────────────────

  describe('processEvent', () => {
    it('matches and executes arrive rules', async () => {
      const sys = await createInitialized();
      try {
        const result = await sys.processEvent({ type: 'arrive', zone: 'home', userId: 'user1' });
        assertEqual(result.matched, 1);
        assertEqual(result.executed, 1);
        assertEqual(result.errors, 0);
      } finally { cleanup(sys); }
    });

    it('matches and executes depart rules', async () => {
      const sys = await createInitialized();
      try {
        const result = await sys.processEvent({ type: 'depart', zone: 'home', userId: 'user1' });
        assertEqual(result.matched, 1);
        assertEqual(result.executed, 1);
      } finally { cleanup(sys); }
    });

    it('does not match wrong zone', async () => {
      const sys = await createInitialized();
      try {
        const result = await sys.processEvent({ type: 'arrive', zone: 'office' });
        assertEqual(result.matched, 0);
        assertEqual(result.executed, 0);
      } finally { cleanup(sys); }
    });

    it('does not execute disabled rules', async () => {
      const sys = await createInitialized();
      try {
        // Disable the arrive preset
        const rule = sys.rules.get('preset_arrive_home');
        rule.enabled = false;

        const result = await sys.processEvent({ type: 'arrive', zone: 'home' });
        assertEqual(result.matched, 0);
      } finally { cleanup(sys); }
    });

    it('supports wildcard zone', async () => {
      const sys = await createInitialized();
      try {
        sys.addRule({
          id: 'wildcard_rule',
          trigger: 'arrive',
          zone: '*',
          actions: [{ type: 'sendNotification', message: 'Arrived somewhere' }],
        });

        const result = await sys.processEvent({ type: 'arrive', zone: 'anywhere' });
        assertEqual(result.matched, 1);
        assertEqual(result.executed, 1);
      } finally { cleanup(sys); }
    });

    it('throws on invalid event', async () => {
      const sys = await createInitialized();
      try {
        let threw = false;
        try { await sys.processEvent({}); } catch (_) { threw = true; }
        assert(threw, 'should throw on invalid event');
      } finally { cleanup(sys); }
    });

    it('records execution history', async () => {
      const sys = await createInitialized();
      try {
        await sys.processEvent({ type: 'arrive', zone: 'home', userId: 'user1' });
        const history = sys.getExecutionHistory();
        assertEqual(history.length, 1);
        assertEqual(history[0].ruleId, 'preset_arrive_home');
        assertEqual(history[0].status, 'success');
      } finally { cleanup(sys); }
    });
  });

  // ── getStatistics ────────────────────────────────────────────────

  describe('getStatistics', () => {
    it('returns correct statistics', async () => {
      const sys = await createInitialized();
      try {
        await sys.processEvent({ type: 'arrive', zone: 'home' });
        const stats = sys.getStatistics();
        assertEqual(stats.totalRules, 2);
        assertEqual(stats.activeRules, 2);
        assertEqual(stats.totalExecutions, 1);
        assertEqual(stats.successfulExecutions, 1);
        assertEqual(stats.failedExecutions, 0);
      } finally { cleanup(sys); }
    });
  });

  // ── destroy ──────────────────────────────────────────────────────

  describe('destroy', () => {
    it('clears all state', async () => {
      const sys = await createInitialized();
      await sys.processEvent({ type: 'arrive', zone: 'home' });
      sys.destroy();
      assertEqual(sys.rules.size, 0);
      assertEqual(sys.executionHistory.length, 0);
    });
  });
});

run();
