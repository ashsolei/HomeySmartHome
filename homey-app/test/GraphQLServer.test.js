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
const GraphQLServer = require('../lib/GraphQLServer');

function createSystem() {
  const homey = createMockHomey();
  return new GraphQLServer(homey);
}

async function createInitialized() {
  const sys = createSystem();
  await sys.initialize();
  return sys;
}

/* ════════════════════════════════════════════════════════════════════ */
/*  TESTS                                                              */
/* ════════════════════════════════════════════════════════════════════ */

describe('GraphQLServer', () => {

  // ── constructor ──────────────────────────────────────────────────

  describe('constructor', () => {
    it('creates instance with homey reference', () => {
      const sys = createSystem();
      try {
        assert(sys.homey !== undefined, 'should have homey reference');
      } finally { cleanup(sys); }
    });
  });

  // ── initialize ───────────────────────────────────────────────────

  describe('initialize', () => {
    it('initializes without errors', async () => {
      const sys = await createInitialized();
      try {
        assert(true, 'should initialize successfully');
      } finally { cleanup(sys); }
    });
  });

  // ── getSchemaAndRoot ─────────────────────────────────────────────

  describe('getSchemaAndRoot', () => {
    it('returns schema and rootValue', async () => {
      const sys = await createInitialized();
      try {
        const { schema, rootValue } = sys.getSchemaAndRoot();
        assert(schema !== undefined, 'should return schema');
        assert(rootValue !== undefined, 'should return rootValue');
        assertType(rootValue.devices, 'function');
        assertType(rootValue.automations, 'function');
        assertType(rootValue.energySummary, 'function');
        assertType(rootValue.securityStatus, 'function');
        assertType(rootValue.systemStats, 'function');
      } finally { cleanup(sys); }
    });
  });

  // ── resolvers ────────────────────────────────────────────────────

  describe('resolvers', () => {
    it('devices resolver returns empty array with no device manager', async () => {
      const sys = await createInitialized();
      try {
        const { rootValue } = sys.getSchemaAndRoot();
        const result = await rootValue.devices();
        assert(Array.isArray(result), 'should return array');
      } finally { cleanup(sys); }
    });

    it('automations resolver returns empty array with no automation manager', async () => {
      const sys = await createInitialized();
      try {
        const { rootValue } = sys.getSchemaAndRoot();
        const result = await rootValue.automations();
        assert(Array.isArray(result), 'should return array');
      } finally { cleanup(sys); }
    });

    it('energySummary resolver returns defaults', async () => {
      const sys = await createInitialized();
      try {
        const { rootValue } = sys.getSchemaAndRoot();
        const result = await rootValue.energySummary();
        assertType(result.todayKwh, 'number');
        assertType(result.thisMonthKwh, 'number');
      } finally { cleanup(sys); }
    });

    it('securityStatus returns armed state', async () => {
      const sys = await createInitialized();
      try {
        const { rootValue } = sys.getSchemaAndRoot();
        const result = rootValue.securityStatus();
        assertEqual(result.armed, false);
        assert(Array.isArray(result.zones), 'zones should be array');
      } finally { cleanup(sys); }
    });

    it('systemStats returns runtime info', async () => {
      const sys = await createInitialized();
      try {
        const { rootValue } = sys.getSchemaAndRoot();
        const result = rootValue.systemStats();
        assertType(result.uptime, 'number');
        assertType(result.modules, 'number');
        assertType(result.memoryMb, 'number');
        assert(result.uptime > 0, 'uptime should be positive');
        assert(result.memoryMb > 0, 'memoryMb should be positive');
      } finally { cleanup(sys); }
    });
  });

  // ── middleware ────────────────────────────────────────────────────

  describe('middleware', () => {
    it('returns a function', async () => {
      const sys = await createInitialized();
      try {
        const mw = sys.middleware();
        assertType(mw, 'function');
      } finally { cleanup(sys); }
    });

    it('returns 400 for missing query', async () => {
      const sys = await createInitialized();
      try {
        const mw = sys.middleware();
        let statusCode;
        let responseBody;
        const req = { body: {} };
        const res = {
          status(code) { statusCode = code; return this; },
          json(data) { responseBody = data; },
        };
        await mw(req, res);
        assertEqual(statusCode, 400);
        assert(responseBody.errors[0].message.includes('Missing query'), 'should report missing query');
      } finally { cleanup(sys); }
    });

    it('executes a valid query', async () => {
      const sys = await createInitialized();
      try {
        const mw = sys.middleware();
        let responseBody;
        const req = { body: { query: '{ systemStats { uptime modules memoryMb } }' } };
        const res = {
          status(_code) { return this; },
          json(data) { responseBody = data; },
        };
        await mw(req, res);
        assert(responseBody.data !== undefined, 'should have data field');
        assertType(responseBody.data.systemStats.uptime, 'number');
        assertType(responseBody.data.systemStats.modules, 'number');
        assertType(responseBody.data.systemStats.memoryMb, 'number');
      } finally { cleanup(sys); }
    });
  });

  // ── destroy ──────────────────────────────────────────────────────

  describe('destroy', () => {
    it('destroys without errors', async () => {
      const sys = await createInitialized();
      sys.destroy();
    });
  });
});

run();
