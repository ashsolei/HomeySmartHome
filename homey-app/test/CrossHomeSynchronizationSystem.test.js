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

const CrossHomeSynchronizationSystem = require('../lib/CrossHomeSynchronizationSystem');

function mockHomey() {
  return createMockHomey({
    drivers: { getDevices() { return []; } }
  });
}

describe('CrossHomeSync — constructor & lifecycle', () => {
  it('instantiates without errors', () => {
    const sys = new CrossHomeSynchronizationSystem(mockHomey());
    assert(sys, 'should create instance');
    cleanup(sys);
  });

  it('constructor sets empty collections', () => {
    const sys = new CrossHomeSynchronizationSystem(mockHomey());
    assertEqual(sys.homes.size, 0);
    assertEqual(sys.syncGroups.size, 0);
    assertEqual(sys.syncHistory.length, 0);
    assertEqual(sys.conflictResolutions.size, 0);
    cleanup(sys);
  });

  it('initialize registers primary home and sync groups', async () => {
    const sys = new CrossHomeSynchronizationSystem(mockHomey());
    await sys.initialize();
    assert(sys.homes.has('home_primary'), 'should have primary home');
    assert(sys.syncGroups.size >= 4, 'should have default sync groups');
    cleanup(sys);
  });

  it('initialize is idempotent for sync groups', async () => {
    const sys = new CrossHomeSynchronizationSystem(mockHomey());
    await sys.initialize();
    const count = sys.syncGroups.size;
    await sys.initialize();
    assertEqual(sys.syncGroups.size, count);
    cleanup(sys);
  });
});

describe('CrossHomeSync — home management', () => {
  it('addHome creates a secondary home', async () => {
    const sys = new CrossHomeSynchronizationSystem(mockHomey());
    await sys.initialize();
    const home = await sys.addHome({ name: 'Beach House', url: 'http://example.com', token: 'abc' });
    assert(home.id, 'should have id');
    assertEqual(home.name, 'Beach House');
    assertEqual(home.type, 'secondary');
    assertEqual(home.connection.status, 'connected');
    cleanup(sys);
  });

  it('testHomeConnection returns true for secondary home', async () => {
    const sys = new CrossHomeSynchronizationSystem(mockHomey());
    await sys.initialize();
    const home = await sys.addHome({ name: 'Lake House' });
    const result = await sys.testHomeConnection(home.id);
    assertEqual(result, true);
    cleanup(sys);
  });

  it('testHomeConnection returns false for unknown home', async () => {
    const sys = new CrossHomeSynchronizationSystem(mockHomey());
    await sys.initialize();
    const result = await sys.testHomeConnection('nonexistent');
    assertEqual(result, false);
    cleanup(sys);
  });
});

describe('CrossHomeSync — sync operations', () => {
  it('syncData returns sync results for scenes', async () => {
    const sys = new CrossHomeSynchronizationSystem(mockHomey());
    await sys.initialize();
    const results = await sys.syncData('scenes_sync');
    assert(results.groupId, 'should have groupId');
    assert(results.started, 'should have started timestamp');
    assert(results.completed, 'should have completed timestamp');
    assert(Array.isArray(results.results), 'should have results array');
    cleanup(sys);
  });

  it('syncData adds to sync history', async () => {
    const sys = new CrossHomeSynchronizationSystem(mockHomey());
    await sys.initialize();
    await sys.syncData('settings_sync');
    assert(sys.syncHistory.length >= 1, 'should have history entry');
    cleanup(sys);
  });

  it('syncData throws for unknown group', async () => {
    const sys = new CrossHomeSynchronizationSystem(mockHomey());
    await sys.initialize();
    let threw = false;
    try { await sys.syncData('nonexistent'); } catch (_) { threw = true; }
    assertEqual(threw, true);
    cleanup(sys);
  });

  it('collectDataForSync returns data object', async () => {
    const sys = new CrossHomeSynchronizationSystem(mockHomey());
    await sys.initialize();
    const data = await sys.collectDataForSync('scenes');
    assertEqual(data.type, 'scenes');
    assert(data.timestamp, 'should have timestamp');
    assert(Array.isArray(data.items), 'should have items array');
    cleanup(sys);
  });

  it('collectDataForSync works for all types', async () => {
    const sys = new CrossHomeSynchronizationSystem(mockHomey());
    await sys.initialize();
    for (const type of ['scenes', 'settings', 'automations', 'users']) {
      const data = await sys.collectDataForSync(type);
      assertEqual(data.type, type);
    }
    cleanup(sys);
  });

  it('collectDataForSync throws for unknown type', async () => {
    const sys = new CrossHomeSynchronizationSystem(mockHomey());
    await sys.initialize();
    let threw = false;
    try { await sys.collectDataForSync('invalid'); } catch (_) { threw = true; }
    assertEqual(threw, true);
    cleanup(sys);
  });
});

describe('CrossHomeSync — auto-sync', () => {
  it('enableAutoSync enables auto sync', async () => {
    const sys = new CrossHomeSynchronizationSystem(mockHomey());
    await sys.initialize();
    await sys.enableAutoSync('scenes_sync');
    const group = sys.syncGroups.get('scenes_sync');
    assertEqual(group.autoSync, true);
    assert(group.intervalId, 'should have interval');
    cleanup(sys);
  });

  it('disableAutoSync disables auto sync', async () => {
    const sys = new CrossHomeSynchronizationSystem(mockHomey());
    await sys.initialize();
    await sys.enableAutoSync('scenes_sync');
    await sys.disableAutoSync('scenes_sync');
    const group = sys.syncGroups.get('scenes_sync');
    assertEqual(group.autoSync, false);
    cleanup(sys);
  });

  it('enableAutoSync throws for unknown group', async () => {
    const sys = new CrossHomeSynchronizationSystem(mockHomey());
    await sys.initialize();
    let threw = false;
    try { await sys.enableAutoSync('nonexistent'); } catch (_) { threw = true; }
    assertEqual(threw, true);
    cleanup(sys);
  });

  it('disableAutoSync throws for unknown group', async () => {
    const sys = new CrossHomeSynchronizationSystem(mockHomey());
    await sys.initialize();
    let threw = false;
    try { await sys.disableAutoSync('nonexistent'); } catch (_) { threw = true; }
    assertEqual(threw, true);
    cleanup(sys);
  });
});

describe('CrossHomeSync — conflict resolution', () => {
  it('resolveConflict stores resolution', async () => {
    const sys = new CrossHomeSynchronizationSystem(mockHomey());
    await sys.initialize();
    await sys.resolveConflict('conflict-1', 'use_source');
    assert(sys.conflictResolutions.has('conflict-1'), 'should store resolution');
    assertEqual(sys.conflictResolutions.get('conflict-1').resolution, 'use_source');
    cleanup(sys);
  });

  it('resolveConflict accepts valid resolutions', async () => {
    const sys = new CrossHomeSynchronizationSystem(mockHomey());
    await sys.initialize();
    for (const res of ['use_source', 'use_target', 'merge', 'skip']) {
      await sys.resolveConflict(`c-${res}`, res);
      assertEqual(sys.conflictResolutions.get(`c-${res}`).resolution, res);
    }
    cleanup(sys);
  });

  it('resolveConflict throws for invalid resolution', async () => {
    const sys = new CrossHomeSynchronizationSystem(mockHomey());
    await sys.initialize();
    let threw = false;
    try { await sys.resolveConflict('c1', 'invalid'); } catch (_) { threw = true; }
    assertEqual(threw, true);
    cleanup(sys);
  });
});

describe('CrossHomeSync — status & statistics', () => {
  it('getSyncStatus returns comprehensive status', async () => {
    const sys = new CrossHomeSynchronizationSystem(mockHomey());
    await sys.initialize();
    const status = sys.getSyncStatus();
    assert(Array.isArray(status.homes), 'should have homes array');
    assert(Array.isArray(status.syncGroups), 'should have syncGroups array');
    assert(Array.isArray(status.recentSyncs), 'should have recentSyncs');
    assertType(status.pendingConflicts, 'number');
    cleanup(sys);
  });

  it('getStatistics returns comprehensive stats', async () => {
    const sys = new CrossHomeSynchronizationSystem(mockHomey());
    await sys.initialize();
    const stats = sys.getStatistics();
    assertType(stats.homes, 'number');
    assertType(stats.syncGroups, 'number');
    assertType(stats.totalSyncs, 'number');
    assertType(stats.successfulSyncs, 'number');
    assert(stats.syncStatus, 'should have syncStatus');
    cleanup(sys);
  });

  it('getStatistics reflects sync activity', async () => {
    const sys = new CrossHomeSynchronizationSystem(mockHomey());
    await sys.initialize();
    await sys.syncData('scenes_sync');
    const stats = sys.getStatistics();
    assert(stats.totalSyncs >= 1, 'should count syncs');
    cleanup(sys);
  });
});

run();
