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
const MultiHomeManager = require('../lib/MultiHomeManager');

function createSystem() {
  const homey = createMockHomey();
  const sys = new MultiHomeManager(homey);
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

describe('MultiHomeManager', () => {

  // ── constructor ──────────────────────────────────────────────────

  describe('constructor', () => {
    it('creates instance with expected defaults', () => {
      const sys = createSystem();
      try {
        assertEqual(sys.homes.size, 0);
        assertEqual(sys.activeHomeId, null);
      } finally { cleanup(sys); }
    });
  });

  // ── initialize ───────────────────────────────────────────────────

  describe('initialize', () => {
    it('creates default home on init', async () => {
      const sys = await createInitialized();
      try {
        assertEqual(sys.homes.size, 1);
        assertEqual(sys.activeHomeId, 'home-default');
        const home = sys.getHome('home-default');
        assertEqual(home.name, 'Primary Home');
        assertEqual(home.timezone, 'Europe/Stockholm');
      } finally { cleanup(sys); }
    });
  });

  // ── createHome ───────────────────────────────────────────────────

  describe('createHome', () => {
    it('creates a new home', async () => {
      const sys = await createInitialized();
      try {
        const home = sys.createHome({ name: 'Vacation House', timezone: 'Europe/Paris' });
        assertType(home.id, 'string');
        assertEqual(home.name, 'Vacation House');
        assertEqual(home.timezone, 'Europe/Paris');
        assert(Array.isArray(home.devices), 'devices should be array');
        assert(Array.isArray(home.automations), 'automations should be array');
        assertType(home.createdAt, 'string');
        assertEqual(sys.homes.size, 2);
      } finally { cleanup(sys); }
    });

    it('throws when name is missing', async () => {
      const sys = await createInitialized();
      try {
        let threw = false;
        try { sys.createHome({}); } catch (_) { threw = true; }
        assert(threw, 'should throw for missing name');

        threw = false;
        try { sys.createHome(null); } catch (_) { threw = true; }
        assert(threw, 'should throw for null config');
      } finally { cleanup(sys); }
    });
  });

  // ── getHome ──────────────────────────────────────────────────────

  describe('getHome', () => {
    it('returns existing home', async () => {
      const sys = await createInitialized();
      try {
        const home = sys.getHome('home-default');
        assertEqual(home.id, 'home-default');
      } finally { cleanup(sys); }
    });

    it('throws for non-existent home', async () => {
      const sys = await createInitialized();
      try {
        let threw = false;
        try { sys.getHome('nonexistent'); } catch (_) { threw = true; }
        assert(threw, 'should throw for non-existent home');
      } finally { cleanup(sys); }
    });
  });

  // ── listHomes ────────────────────────────────────────────────────

  describe('listHomes', () => {
    it('lists all homes', async () => {
      const sys = await createInitialized();
      try {
        sys.createHome({ name: 'Second Home' });
        const homes = sys.listHomes();
        assertEqual(homes.length, 2);
      } finally { cleanup(sys); }
    });

    it('filters by ownerId', async () => {
      const sys = await createInitialized();
      try {
        sys.createHome({ name: 'Other Owner', ownerId: 'owner-2' });
        const filtered = sys.listHomes('owner-2');
        assertEqual(filtered.length, 1);
        assertEqual(filtered[0].ownerId, 'owner-2');
      } finally { cleanup(sys); }
    });
  });

  // ── updateHome ───────────────────────────────────────────────────

  describe('updateHome', () => {
    it('updates allowed fields', async () => {
      const sys = await createInitialized();
      try {
        const updated = sys.updateHome('home-default', { name: 'Renamed Home', timezone: 'US/Eastern' });
        assertEqual(updated.name, 'Renamed Home');
        assertEqual(updated.timezone, 'US/Eastern');
        assertType(updated.updatedAt, 'string');
      } finally { cleanup(sys); }
    });

    it('throws for non-existent home', async () => {
      const sys = await createInitialized();
      try {
        let threw = false;
        try { sys.updateHome('bad-id', { name: 'x' }); } catch (_) { threw = true; }
        assert(threw, 'should throw for non-existent home');
      } finally { cleanup(sys); }
    });
  });

  // ── deleteHome ───────────────────────────────────────────────────

  describe('deleteHome', () => {
    it('deletes a home', async () => {
      const sys = await createInitialized();
      try {
        const home = sys.createHome({ name: 'To Delete' });
        const result = sys.deleteHome(home.id);
        assertEqual(result.success, true);
        assertEqual(sys.homes.size, 1);
      } finally { cleanup(sys); }
    });

    it('clears activeHomeId when deleting active home', async () => {
      const sys = await createInitialized();
      try {
        sys.deleteHome('home-default');
        assertEqual(sys.activeHomeId, null);
      } finally { cleanup(sys); }
    });

    it('throws for non-existent home', async () => {
      const sys = await createInitialized();
      try {
        let threw = false;
        try { sys.deleteHome('nonexistent'); } catch (_) { threw = true; }
        assert(threw, 'should throw for non-existent home');
      } finally { cleanup(sys); }
    });
  });

  // ── switchActiveHome ─────────────────────────────────────────────

  describe('switchActiveHome', () => {
    it('switches active home', async () => {
      const sys = await createInitialized();
      try {
        const newHome = sys.createHome({ name: 'Second' });
        const result = sys.switchActiveHome(newHome.id);
        assertEqual(sys.activeHomeId, newHome.id);
        assertEqual(result.name, 'Second');
      } finally { cleanup(sys); }
    });

    it('throws for non-existent home', async () => {
      const sys = await createInitialized();
      try {
        let threw = false;
        try { sys.switchActiveHome('bad-id'); } catch (_) { threw = true; }
        assert(threw, 'should throw for non-existent home');
      } finally { cleanup(sys); }
    });
  });

  // ── getActiveHome ────────────────────────────────────────────────

  describe('getActiveHome', () => {
    it('returns active home', async () => {
      const sys = await createInitialized();
      try {
        const active = sys.getActiveHome();
        assertEqual(active.id, 'home-default');
      } finally { cleanup(sys); }
    });

    it('returns null when no active home', () => {
      const sys = createSystem();
      try {
        assertEqual(sys.getActiveHome(), null);
      } finally { cleanup(sys); }
    });
  });

  // ── getStatistics ────────────────────────────────────────────────

  describe('getStatistics', () => {
    it('returns statistics', async () => {
      const sys = await createInitialized();
      try {
        const stats = sys.getStatistics();
        assertEqual(stats.totalHomes, 1);
        assertEqual(stats.activeHomeId, 'home-default');
        assert(Array.isArray(stats.homes), 'homes should be array');
      } finally { cleanup(sys); }
    });
  });

  // ── destroy ──────────────────────────────────────────────────────

  describe('destroy', () => {
    it('clears all state', async () => {
      const sys = await createInitialized();
      sys.destroy();
      assertEqual(sys.homes.size, 0);
      assertEqual(sys.activeHomeId, null);
    });
  });
});

run();
