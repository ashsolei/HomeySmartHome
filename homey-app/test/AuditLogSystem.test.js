'use strict';

/**
 * Unit tests for AuditLogSystem.
 */

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertType, assertDeepEqual } = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');
const AuditLogSystem = require('../lib/AuditLogSystem');

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

describe('AuditLogSystem — constructor', () => {
  it('stores the homey reference', () => {
    const homey = createMockHomey();
    const sys = new AuditLogSystem(homey);
    assertEqual(sys.homey, homey);
  });

  it('initialises _log as an empty array', () => {
    const sys = new AuditLogSystem(createMockHomey());
    assert(Array.isArray(sys._log), '_log should be an array');
    assertEqual(sys._log.length, 0);
  });

  it('sets _maxEntries to 10000', () => {
    const sys = new AuditLogSystem(createMockHomey());
    assertEqual(sys._maxEntries, 10000);
  });
});

// ---------------------------------------------------------------------------
// initialize()
// ---------------------------------------------------------------------------

describe('AuditLogSystem — initialize()', () => {
  it('resolves without error', async () => {
    const sys = new AuditLogSystem(createMockHomey());
    await sys.initialize(); // should not throw
    assert(true, 'initialize should complete successfully');
  });

  it('does not populate _log during initialization', async () => {
    const sys = new AuditLogSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys._log.length, 0);
  });
});

// ---------------------------------------------------------------------------
// record()
// ---------------------------------------------------------------------------

describe('AuditLogSystem — record()', () => {
  it('creates an entry with id, timestamp, and action', () => {
    const sys = new AuditLogSystem(createMockHomey());
    const entry = sys.record('device.toggle', { deviceId: 'dev-1' });

    assertType(entry.id, 'string');
    assert(entry.id.startsWith('audit-'), 'id should start with audit-');
    assertType(entry.timestamp, 'string');
    // Verify ISO format
    assert(!isNaN(new Date(entry.timestamp).getTime()), 'timestamp should be a valid ISO date');
    assertEqual(entry.action, 'device.toggle');
  });

  it('merges details into the entry', () => {
    const sys = new AuditLogSystem(createMockHomey());
    const entry = sys.record('scene.activate', { userId: 'u-1', sceneId: 's-42' });
    assertEqual(entry.userId, 'u-1');
    assertEqual(entry.sceneId, 's-42');
  });

  it('works with no details argument (defaults to {})', () => {
    const sys = new AuditLogSystem(createMockHomey());
    const entry = sys.record('system.boot');
    assertEqual(entry.action, 'system.boot');
    assertType(entry.id, 'string');
  });

  it('stores the entry in _log', () => {
    const sys = new AuditLogSystem(createMockHomey());
    const entry = sys.record('device.toggle');
    assertEqual(sys._log.length, 1);
    assertEqual(sys._log[0], entry);
  });

  it('appends multiple entries in order', () => {
    const sys = new AuditLogSystem(createMockHomey());
    sys.record('action.a');
    sys.record('action.b');
    sys.record('action.c');
    assertEqual(sys._log.length, 3);
    assertEqual(sys._log[0].action, 'action.a');
    assertEqual(sys._log[2].action, 'action.c');
  });

  it('enforces circular buffer at _maxEntries', () => {
    const sys = new AuditLogSystem(createMockHomey());
    sys._maxEntries = 5;

    for (let i = 0; i < 7; i++) {
      sys.record(`action.${i}`);
    }

    // Buffer should not exceed 5
    assertEqual(sys._log.length, 5);
    // Oldest entries are dropped — the last 5 remain (action.2 .. action.6)
    assertEqual(sys._log[0].action, 'action.2');
    assertEqual(sys._log[4].action, 'action.6');
  });
});

// ---------------------------------------------------------------------------
// getLog()
// ---------------------------------------------------------------------------

describe('AuditLogSystem — getLog()', () => {
  it('returns entries in newest-first order', () => {
    const sys = new AuditLogSystem(createMockHomey());
    sys.record('first');
    sys.record('second');
    sys.record('third');

    const log = sys.getLog();
    assertEqual(log[0].action, 'third');
    assertEqual(log[1].action, 'second');
    assertEqual(log[2].action, 'first');
  });

  it('respects the limit parameter', () => {
    const sys = new AuditLogSystem(createMockHomey());
    for (let i = 0; i < 10; i++) sys.record(`action.${i}`);

    const log = sys.getLog(3);
    assertEqual(log.length, 3);
    // newest first: action.9, action.8, action.7
    assertEqual(log[0].action, 'action.9');
    assertEqual(log[2].action, 'action.7');
  });

  it('respects the offset parameter', () => {
    const sys = new AuditLogSystem(createMockHomey());
    for (let i = 0; i < 5; i++) sys.record(`action.${i}`);

    // Newest-first order: action.4, action.3, action.2, action.1, action.0
    // Offset 2 → start from action.2
    const log = sys.getLog(10, 2);
    assertEqual(log[0].action, 'action.2');
  });

  it('returns empty array when log is empty', () => {
    const sys = new AuditLogSystem(createMockHomey());
    const log = sys.getLog();
    assert(Array.isArray(log));
    assertEqual(log.length, 0);
  });

  it('does not mutate the internal _log order', () => {
    const sys = new AuditLogSystem(createMockHomey());
    sys.record('first');
    sys.record('second');
    sys.getLog(); // reverse happens on a copy
    assertEqual(sys._log[0].action, 'first');
    assertEqual(sys._log[1].action, 'second');
  });
});

// ---------------------------------------------------------------------------
// getStats()
// ---------------------------------------------------------------------------

describe('AuditLogSystem — getStats()', () => {
  it('returns total, last24h, and actionCounts', () => {
    const sys = new AuditLogSystem(createMockHomey());
    const stats = sys.getStats();
    assertType(stats.total, 'number');
    assertType(stats.last24h, 'number');
    assertType(stats.actionCounts, 'object');
  });

  it('total equals the number of recorded entries', () => {
    const sys = new AuditLogSystem(createMockHomey());
    sys.record('a');
    sys.record('b');
    sys.record('c');
    const stats = sys.getStats();
    assertEqual(stats.total, 3);
  });

  it('last24h counts only recent entries', () => {
    const sys = new AuditLogSystem(createMockHomey());
    // Inject a very old entry (2 days ago) directly into _log
    sys._log.push({
      id: 'old',
      action: 'old.action',
      timestamp: new Date(Date.now() - 2 * 86400000).toISOString()
    });
    sys.record('fresh.action');

    const stats = sys.getStats();
    assertEqual(stats.total, 2);
    assertEqual(stats.last24h, 1);
  });

  it('actionCounts tallies each action correctly', () => {
    const sys = new AuditLogSystem(createMockHomey());
    sys.record('device.toggle');
    sys.record('device.toggle');
    sys.record('scene.activate');
    const stats = sys.getStats();
    assertEqual(stats.actionCounts['device.toggle'], 2);
    assertEqual(stats.actionCounts['scene.activate'], 1);
  });

  it('returns zero counts for an empty log', () => {
    const sys = new AuditLogSystem(createMockHomey());
    const stats = sys.getStats();
    assertEqual(stats.total, 0);
    assertEqual(stats.last24h, 0);
    assertDeepEqual(stats.actionCounts, {});
  });
});

// ---------------------------------------------------------------------------
// destroy()
// ---------------------------------------------------------------------------

describe('AuditLogSystem — destroy()', () => {
  it('clears the internal log', () => {
    const sys = new AuditLogSystem(createMockHomey());
    sys.record('a');
    sys.record('b');
    sys.destroy();
    assertEqual(sys._log.length, 0);
  });

  it('can be called on an already-empty log without error', () => {
    const sys = new AuditLogSystem(createMockHomey());
    sys.destroy();
    assertEqual(sys._log.length, 0);
  });
});

// Run all tests
run();
