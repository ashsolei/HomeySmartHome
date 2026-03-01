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
const UserActivityTimeline = require('../lib/UserActivityTimeline');

function createSystem() {
  const homey = createMockHomey();
  return new UserActivityTimeline(homey);
}

async function createInitialized() {
  const sys = createSystem();
  await sys.initialize();
  return sys;
}

/* ════════════════════════════════════════════════════════════════════ */
/*  TESTS                                                              */
/* ════════════════════════════════════════════════════════════════════ */

describe('UserActivityTimeline', () => {

  // ── constructor ──────────────────────────────────────────────────

  describe('constructor', () => {
    it('creates instance with empty events', () => {
      const sys = createSystem();
      try {
        assert(Array.isArray(sys.events), 'events should be array');
        assertEqual(sys.events.length, 0);
      } finally { cleanup(sys); }
    });
  });

  // ── initialize ───────────────────────────────────────────────────

  describe('initialize', () => {
    it('subscribes to module events', async () => {
      const sys = await createInitialized();
      try {
        assert(sys._listeners.length > 0, 'should register listeners');
      } finally { cleanup(sys); }
    });
  });

  // ── addEvent ─────────────────────────────────────────────────────

  describe('addEvent', () => {
    it('adds event with generated id and timestamp', async () => {
      const sys = await createInitialized();
      try {
        const entry = sys.addEvent({
          type: 'security',
          module: 'security',
          title: 'Test alarm',
          description: 'Motion detected',
          severity: 'high',
          metadata: { zone: 'living-room' },
        });
        assertType(entry.id, 'string');
        assert(entry.id.length > 0, 'id should not be empty');
        assertType(entry.timestamp, 'string');
        assertEqual(entry.type, 'security');
        assertEqual(entry.module, 'security');
        assertEqual(entry.title, 'Test alarm');
        assertEqual(entry.severity, 'high');
        assertEqual(sys.events.length, 1);
      } finally { cleanup(sys); }
    });

    it('maintains circular buffer at max 500', async () => {
      const sys = await createInitialized();
      try {
        for (let i = 0; i < 510; i++) {
          sys.addEvent({ type: 'test', title: `Event ${i}` });
        }
        assertEqual(sys.events.length, 500);
        // The oldest events should have been removed
        assert(sys.events[0].title !== 'Event 0', 'first event should not be Event 0');
        assertEqual(sys.events[sys.events.length - 1].title, 'Event 509');
      } finally { cleanup(sys); }
    });

    it('applies defaults for missing fields', async () => {
      const sys = await createInitialized();
      try {
        const entry = sys.addEvent({});
        assertEqual(entry.type, 'general');
        assertEqual(entry.module, 'system');
        assertEqual(entry.title, 'Event');
        assertEqual(entry.severity, 'info');
      } finally { cleanup(sys); }
    });
  });

  // ── getEvents ────────────────────────────────────────────────────

  describe('getEvents', () => {
    it('returns events newest first', async () => {
      const sys = await createInitialized();
      try {
        sys.addEvent({ type: 'a', title: 'First' });
        sys.addEvent({ type: 'b', title: 'Second' });
        sys.addEvent({ type: 'c', title: 'Third' });
        const events = sys.getEvents();
        assertEqual(events[0].title, 'Third');
        assertEqual(events[2].title, 'First');
      } finally { cleanup(sys); }
    });

    it('limits results', async () => {
      const sys = await createInitialized();
      try {
        for (let i = 0; i < 10; i++) {
          sys.addEvent({ type: 'test', title: `Event ${i}` });
        }
        const events = sys.getEvents({ limit: 3 });
        assertEqual(events.length, 3);
      } finally { cleanup(sys); }
    });

    it('filters by type', async () => {
      const sys = await createInitialized();
      try {
        sys.addEvent({ type: 'security', title: 'Alarm' });
        sys.addEvent({ type: 'energy', title: 'Usage' });
        sys.addEvent({ type: 'security', title: 'Mode change' });
        const events = sys.getEvents({ type: 'security' });
        assertEqual(events.length, 2);
        for (const e of events) {
          assertEqual(e.type, 'security');
        }
      } finally { cleanup(sys); }
    });

    it('filters by since timestamp', async () => {
      const sys = await createInitialized();
      try {
        // Manually inject an event with a past timestamp
        sys.events.push({
          id: 'old-1',
          timestamp: '2020-01-01T00:00:00.000Z',
          type: 'old',
          module: 'system',
          title: 'Old event',
          description: '',
          severity: 'info',
          metadata: {},
        });
        const sinceTime = '2025-01-01T00:00:00.000Z';
        sys.addEvent({ type: 'new', title: 'New event' });
        const events = sys.getEvents({ since: sinceTime });
        assertEqual(events.length, 1);
        assertEqual(events[0].title, 'New event');
      } finally { cleanup(sys); }
    });

    it('returns empty array when no events match', async () => {
      const sys = await createInitialized();
      try {
        const events = sys.getEvents({ type: 'nonexistent' });
        assertEqual(events.length, 0);
      } finally { cleanup(sys); }
    });
  });

  // ── getCount ─────────────────────────────────────────────────────

  describe('getCount', () => {
    it('returns current event count', async () => {
      const sys = await createInitialized();
      try {
        assertEqual(sys.getCount(), 0);
        sys.addEvent({ type: 'test' });
        sys.addEvent({ type: 'test' });
        assertEqual(sys.getCount(), 2);
      } finally { cleanup(sys); }
    });
  });

  // ── event listeners ──────────────────────────────────────────────

  describe('event listeners', () => {
    it('captures security events via homey emitter', async () => {
      const sys = await createInitialized();
      try {
        sys.homey.emit('security:alarm', { zone: 'front-door' });
        assertEqual(sys.events.length, 1);
        assertEqual(sys.events[0].type, 'security');
      } finally { cleanup(sys); }
    });

    it('captures energy events via homey emitter', async () => {
      const sys = await createInitialized();
      try {
        sys.homey.emit('energy:update', { watts: 500 });
        assertEqual(sys.events.length, 1);
        assertEqual(sys.events[0].type, 'energy');
      } finally { cleanup(sys); }
    });
  });

  // ── destroy ──────────────────────────────────────────────────────

  describe('destroy', () => {
    it('clears events and removes listeners', async () => {
      const sys = await createInitialized();
      sys.addEvent({ type: 'test' });
      sys.destroy();
      assertEqual(sys.events.length, 0);
      assertEqual(sys._listeners.length, 0);
    });
  });
});

run();
