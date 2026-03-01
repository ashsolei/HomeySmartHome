'use strict';

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertType } = require('./helpers/assert');

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
const ApiPaginator = require('../lib/ApiPaginator');

function createPaginator() {
  return new ApiPaginator();
}

/* ════════════════════════════════════════════════════════════════════ */
/*  TESTS                                                              */
/* ════════════════════════════════════════════════════════════════════ */

describe('ApiPaginator', () => {

  // ── constructor ──────────────────────────────────────────────────

  describe('constructor', () => {
    it('creates instance with expected defaults', () => {
      const pag = createPaginator();
      try {
        assertEqual(pag.defaultLimit, 20);
        assertEqual(pag.maxLimit, 100);
      } finally { cleanup(pag); }
    });
  });

  // ── paginate ─────────────────────────────────────────────────────

  describe('paginate', () => {
    it('returns first page with defaults', () => {
      const pag = createPaginator();
      try {
        const items = Array.from({ length: 50 }, (_, i) => ({ id: i }));
        const result = pag.paginate(items);
        assertEqual(result.data.length, 20);
        assertEqual(result.pagination.page, 1);
        assertEqual(result.pagination.limit, 20);
        assertEqual(result.pagination.total, 50);
        assertEqual(result.pagination.totalPages, 3);
        assertType(result.pagination.links.self, 'string');
        assertType(result.pagination.links.first, 'string');
        assertType(result.pagination.links.last, 'string');
        assertType(result.pagination.links.next, 'string');
        assertEqual(result.pagination.links.prev, undefined);
      } finally { cleanup(pag); }
    });

    it('returns correct page with custom page/limit', () => {
      const pag = createPaginator();
      try {
        const items = Array.from({ length: 50 }, (_, i) => ({ id: i }));
        const result = pag.paginate(items, { page: 2, limit: 10 });
        assertEqual(result.data.length, 10);
        assertEqual(result.data[0].id, 10);
        assertEqual(result.data[9].id, 19);
        assertEqual(result.pagination.page, 2);
        assertEqual(result.pagination.limit, 10);
        assertEqual(result.pagination.totalPages, 5);
        assertType(result.pagination.links.prev, 'string');
        assertType(result.pagination.links.next, 'string');
      } finally { cleanup(pag); }
    });

    it('returns last page correctly', () => {
      const pag = createPaginator();
      try {
        const items = Array.from({ length: 25 }, (_, i) => ({ id: i }));
        const result = pag.paginate(items, { page: 2, limit: 20 });
        assertEqual(result.data.length, 5);
        assertEqual(result.pagination.page, 2);
        assertEqual(result.pagination.totalPages, 2);
        assertType(result.pagination.links.prev, 'string');
        assertEqual(result.pagination.links.next, undefined);
      } finally { cleanup(pag); }
    });

    it('clamps limit to maxLimit', () => {
      const pag = createPaginator();
      try {
        const items = Array.from({ length: 200 }, (_, i) => ({ id: i }));
        const result = pag.paginate(items, { page: 1, limit: 500 });
        assertEqual(result.data.length, 100);
        assertEqual(result.pagination.limit, 100);
      } finally { cleanup(pag); }
    });

    it('handles empty array', () => {
      const pag = createPaginator();
      try {
        const result = pag.paginate([]);
        assertEqual(result.data.length, 0);
        assertEqual(result.pagination.total, 0);
        assertEqual(result.pagination.totalPages, 1);
      } finally { cleanup(pag); }
    });

    it('handles page beyond range gracefully', () => {
      const pag = createPaginator();
      try {
        const items = [{ id: 1 }, { id: 2 }];
        const result = pag.paginate(items, { page: 99, limit: 10 });
        assertEqual(result.data.length, 0);
        assertEqual(result.pagination.page, 99);
        assertEqual(result.pagination.total, 2);
      } finally { cleanup(pag); }
    });

    it('includes baseUrl in links', () => {
      const pag = createPaginator();
      try {
        const items = Array.from({ length: 30 }, (_, i) => ({ id: i }));
        const result = pag.paginate(items, { page: 1, limit: 10, baseUrl: '/api/v1/devices' });
        assert(result.pagination.links.self.startsWith('/api/v1/devices'), 'should include baseUrl');
        assert(result.pagination.links.next.includes('/api/v1/devices'), 'next should include baseUrl');
      } finally { cleanup(pag); }
    });

    it('defaults invalid page to 1', () => {
      const pag = createPaginator();
      try {
        const items = [{ id: 1 }];
        const result = pag.paginate(items, { page: -5 });
        assertEqual(result.pagination.page, 1);
      } finally { cleanup(pag); }
    });

    it('defaults invalid limit to defaultLimit', () => {
      const pag = createPaginator();
      try {
        const items = Array.from({ length: 30 }, (_, i) => ({ id: i }));
        const result = pag.paginate(items, { limit: 'abc' });
        assertEqual(result.pagination.limit, 20);
      } finally { cleanup(pag); }
    });
  });

  // ── initialize / destroy ─────────────────────────────────────────

  describe('initialize', () => {
    it('is a no-op', async () => {
      const pag = createPaginator();
      try {
        await pag.initialize();
        assertEqual(pag.defaultLimit, 20);
      } finally { cleanup(pag); }
    });
  });

  describe('destroy', () => {
    it('is a no-op', () => {
      const pag = createPaginator();
      pag.destroy();
      assertEqual(pag.defaultLimit, 20);
    });
  });
});

run();
