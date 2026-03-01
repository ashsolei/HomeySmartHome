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
const AIRecommendationEngine = require('../lib/AIRecommendationEngine');

function createSystem() {
  const homey = createMockHomey();
  const sys = new AIRecommendationEngine(homey);
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

describe('AIRecommendationEngine', () => {

  // ── constructor ──────────────────────────────────────────────────

  describe('constructor', () => {
    it('creates instance with expected defaults', () => {
      const sys = createSystem();
      try {
        assert(Array.isArray(sys.recommendations), 'recommendations should be array');
        assertEqual(sys.recommendations.length, 0);
        assertEqual(sys.lastRefresh, null);
        assertEqual(sys.refreshInterval, 600000);
      } finally { cleanup(sys); }
    });
  });

  // ── initialize ───────────────────────────────────────────────────

  describe('initialize', () => {
    it('generates recommendations on init', async () => {
      const sys = await createInitialized();
      try {
        assert(sys.recommendations.length > 0, 'should have recommendations after init');
        assert(sys.lastRefresh !== null, 'lastRefresh should be set');
      } finally { cleanup(sys); }
    });
  });

  // ── generateRecommendations ──────────────────────────────────────

  describe('generateRecommendations', () => {
    it('returns array of recommendation objects', async () => {
      const sys = await createInitialized();
      try {
        const recs = await sys.generateRecommendations();
        assert(Array.isArray(recs), 'should return array');
        for (const rec of recs) {
          assertType(rec.id, 'string');
          assertType(rec.category, 'string');
          assertType(rec.title, 'string');
          assertType(rec.description, 'string');
          assertType(rec.confidence, 'number');
          assert(rec.confidence >= 0 && rec.confidence <= 1, 'confidence should be 0-1');
          assert(['energy_saving', 'comfort', 'security', 'automation'].includes(rec.category),
            `invalid category: ${rec.category}`);
        }
      } finally { cleanup(sys); }
    });

    it('generates unique IDs for each recommendation', async () => {
      const sys = await createInitialized();
      try {
        const recs = await sys.generateRecommendations();
        const ids = recs.map(r => r.id);
        const uniqueIds = new Set(ids);
        assertEqual(ids.length, uniqueIds.size);
      } finally { cleanup(sys); }
    });
  });

  // ── getRecommendations ───────────────────────────────────────────

  describe('getRecommendations', () => {
    it('returns all recommendations when no category', async () => {
      const sys = await createInitialized();
      try {
        const all = sys.getRecommendations();
        assertEqual(all.length, sys.recommendations.length);
      } finally { cleanup(sys); }
    });

    it('filters by category', async () => {
      const sys = await createInitialized();
      try {
        const energyRecs = sys.getRecommendations('energy_saving');
        for (const rec of energyRecs) {
          assertEqual(rec.category, 'energy_saving');
        }
      } finally { cleanup(sys); }
    });

    it('returns empty array for non-matching category', async () => {
      const sys = await createInitialized();
      try {
        const recs = sys.getRecommendations('nonexistent_category');
        assertEqual(recs.length, 0);
      } finally { cleanup(sys); }
    });
  });

  // ── getStatistics ────────────────────────────────────────────────

  describe('getStatistics', () => {
    it('returns statistics object', async () => {
      const sys = await createInitialized();
      try {
        const stats = sys.getStatistics();
        assertType(stats.total, 'number');
        assertType(stats.byCategory, 'object');
        assertType(stats.lastRefresh, 'string');
        assertEqual(stats.refreshInterval, 600000);
      } finally { cleanup(sys); }
    });
  });

  // ── destroy ──────────────────────────────────────────────────────

  describe('destroy', () => {
    it('clears state and stops refresh timer', async () => {
      const sys = await createInitialized();
      sys.destroy();
      assertEqual(sys.recommendations.length, 0);
      assertEqual(sys.lastRefresh, null);
      assertEqual(sys._refreshTimer, null);
    });
  });
});

run();
