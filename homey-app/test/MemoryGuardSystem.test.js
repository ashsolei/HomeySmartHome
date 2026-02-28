'use strict';

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertType } = require('./helpers/assert');

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

const MemoryGuardSystem = require('../lib/MemoryGuardSystem');

// Reset singleton between tests
function resetSingleton() {
  MemoryGuardSystem.destroyInstance();
}

describe('MemoryGuardSystem — constructor & lifecycle', () => {
  it('instantiates without errors', () => {
    resetSingleton();
    const sys = new MemoryGuardSystem();
    assert(sys, 'should create instance');
    assertType(sys._currentLevel, 'string');
    assertEqual(sys._leakSuspected, false);
    cleanup(sys);
  });

  it('uses custom thresholds', () => {
    resetSingleton();
    const sys = new MemoryGuardSystem({ thresholds: { warning: 0.5, critical: 0.7, emergency: 0.9 } });
    assertEqual(sys._thresholds.warning, 0.5);
    assertEqual(sys._thresholds.critical, 0.7);
    assertEqual(sys._thresholds.emergency, 0.9);
    cleanup(sys);
  });

  it('destroy clears state', () => {
    resetSingleton();
    const sys = new MemoryGuardSystem();
    sys.destroy();
    assertEqual(sys._samplerRef, null);
    assertEqual(sys._history.length, 0);
    assertEqual(sys._alerts.length, 0);
    cleanup(sys);
  });

  it('singleton getInstance returns same instance', () => {
    resetSingleton();
    const a = MemoryGuardSystem.getInstance();
    const b = MemoryGuardSystem.getInstance();
    assert(a === b, 'should be same instance');
    cleanup(a);
    resetSingleton();
  });

  it('destroyInstance clears singleton', () => {
    resetSingleton();
    MemoryGuardSystem.getInstance();
    MemoryGuardSystem.destroyInstance();
    assertEqual(MemoryGuardSystem._instance, null);
  });
});

describe('MemoryGuardSystem — BoundedArray', () => {
  it('creates bounded array', () => {
    const arr = MemoryGuardSystem.BoundedArray(5);
    assert(arr, 'should create');
    assertEqual(arr.maxSize, 5);
    assertEqual(arr.length, 0);
    cleanup();
  });

  it('push adds items', () => {
    const arr = MemoryGuardSystem.BoundedArray(5);
    arr.push('a');
    arr.push('b');
    assertEqual(arr.length, 2);
    assertEqual(arr.items[0], 'a');
    cleanup();
  });

  it('push evicts oldest when full', () => {
    const arr = MemoryGuardSystem.BoundedArray(3);
    arr.push(1);
    arr.push(2);
    arr.push(3);
    arr.push(4);
    assertEqual(arr.length, 3);
    assertEqual(arr.items[0], 2);
    assertEqual(arr.overflowCount, 1);
    cleanup();
  });

  it('clear resets array', () => {
    const arr = MemoryGuardSystem.BoundedArray(5);
    arr.push(1);
    arr.push(2);
    arr.clear();
    assertEqual(arr.length, 0);
    assertEqual(arr.overflowCount, 0);
    cleanup();
  });
});

describe('MemoryGuardSystem — BoundedMap', () => {
  it('creates bounded map', () => {
    const map = MemoryGuardSystem.BoundedMap(5);
    assert(map, 'should create');
    assertEqual(map.maxSize, 5);
    assertEqual(map.size, 0);
    cleanup();
  });

  it('set and get work', () => {
    const map = MemoryGuardSystem.BoundedMap(5);
    map.set('key1', 'val1');
    assertEqual(map.get('key1'), 'val1');
    assertEqual(map.has('key1'), true);
    assertEqual(map.size, 1);
    cleanup();
  });

  it('evicts oldest when full', () => {
    const map = MemoryGuardSystem.BoundedMap(2);
    map.set('a', 1);
    map.set('b', 2);
    map.set('c', 3);
    assertEqual(map.size, 2);
    assertEqual(map.has('a'), false);
    assertEqual(map.has('c'), true);
    assertEqual(map.overflowCount, 1);
    cleanup();
  });

  it('delete removes entry', () => {
    const map = MemoryGuardSystem.BoundedMap(5);
    map.set('x', 1);
    assertEqual(map.delete('x'), true);
    assertEqual(map.has('x'), false);
    cleanup();
  });

  it('clear resets map', () => {
    const map = MemoryGuardSystem.BoundedMap(5);
    map.set('a', 1);
    map.clear();
    assertEqual(map.size, 0);
    assertEqual(map.overflowCount, 0);
    cleanup();
  });
});

describe('MemoryGuardSystem — BoundedSet', () => {
  it('creates bounded set', () => {
    const set = MemoryGuardSystem.BoundedSet(5);
    assert(set, 'should create');
    assertEqual(set.maxSize, 5);
    assertEqual(set.size, 0);
    cleanup();
  });

  it('add and has work', () => {
    const set = MemoryGuardSystem.BoundedSet(5);
    set.add('a');
    assertEqual(set.has('a'), true);
    assertEqual(set.size, 1);
    cleanup();
  });

  it('evicts oldest when full', () => {
    const set = MemoryGuardSystem.BoundedSet(2);
    set.add('a');
    set.add('b');
    set.add('c');
    assertEqual(set.size, 2);
    assertEqual(set.has('a'), false);
    assertEqual(set.has('c'), true);
    cleanup();
  });

  it('add ignores duplicates', () => {
    const set = MemoryGuardSystem.BoundedSet(5);
    set.add('a');
    set.add('a');
    assertEqual(set.size, 1);
    cleanup();
  });
});

describe('MemoryGuardSystem — interval registry', () => {
  it('registerInterval adds interval', () => {
    resetSingleton();
    const sys = new MemoryGuardSystem();
    const ref = _origSetInterval(() => {}, 99999);
    sys.registerInterval('test-1', ref, 'TestOwner', 'A test interval');
    assertEqual(sys._intervals.size, 1);
    cleanup(sys);
    clearInterval(ref);
  });

  it('unregisterInterval removes interval', () => {
    resetSingleton();
    const sys = new MemoryGuardSystem();
    const ref = _origSetInterval(() => {}, 99999);
    sys.registerInterval('test-1', ref, 'TestOwner');
    assertEqual(sys.unregisterInterval('test-1'), true);
    assertEqual(sys._intervals.size, 0);
    cleanup(sys);
  });

  it('unregisterInterval returns false for unknown', () => {
    resetSingleton();
    const sys = new MemoryGuardSystem();
    assertEqual(sys.unregisterInterval('nonexistent'), false);
    cleanup(sys);
  });

  it('getActiveIntervals returns list', () => {
    resetSingleton();
    const sys = new MemoryGuardSystem();
    const ref = _origSetInterval(() => {}, 99999);
    sys.registerInterval('test-1', ref, 'TestOwner', 'desc');
    const intervals = sys.getActiveIntervals();
    assert(Array.isArray(intervals), 'should be array');
    assertEqual(intervals.length, 1);
    assertEqual(intervals[0].id, 'test-1');
    assertEqual(intervals[0].owner, 'TestOwner');
    cleanup(sys);
    clearInterval(ref);
  });

  it('clearAll clears all intervals', () => {
    resetSingleton();
    const sys = new MemoryGuardSystem();
    const ref1 = _origSetInterval(() => {}, 99999);
    const ref2 = _origSetInterval(() => {}, 99999);
    sys.registerInterval('i1', ref1, 'Owner1');
    sys.registerInterval('i2', ref2, 'Owner2');
    const count = sys.clearAll();
    assertEqual(count, 2);
    assertEqual(sys._intervals.size, 0);
    cleanup(sys);
  });

  it('clearByOwner clears only that owner', () => {
    resetSingleton();
    const sys = new MemoryGuardSystem();
    const ref1 = _origSetInterval(() => {}, 99999);
    const ref2 = _origSetInterval(() => {}, 99999);
    sys.registerInterval('i1', ref1, 'Owner1');
    sys.registerInterval('i2', ref2, 'Owner2');
    const count = sys.clearByOwner('Owner1');
    assertEqual(count, 1);
    assertEqual(sys._intervals.size, 1);
    cleanup(sys);
    clearInterval(ref2);
  });

  it('detectOrphanedIntervals finds orphans', () => {
    resetSingleton();
    const sys = new MemoryGuardSystem();
    const ref = _origSetInterval(() => {}, 99999);
    sys.registerInterval('i1', ref, 'Alive');
    sys.registerInterval('i2', _origSetInterval(() => {}, 99999), 'Dead');
    const orphans = sys.detectOrphanedIntervals(['Alive']);
    assertEqual(orphans.length, 1);
    assertEqual(orphans[0].id, 'i2');
    cleanup(sys);
    clearInterval(ref);
  });
});

describe('MemoryGuardSystem — reporting', () => {
  it('getMemoryReport returns report', () => {
    resetSingleton();
    const sys = new MemoryGuardSystem();
    const report = sys.getMemoryReport();
    assert(report, 'should return report');
    assert(report.current, 'should have current sample');
    assertType(report.growthRateMBpm, 'number');
    assertType(report.sampleCount, 'number');
    assert(Array.isArray(report.history), 'should have history array');
    assert(Array.isArray(report.alerts), 'should have alerts array');
    assertType(report.activeIntervals, 'number');
    assertEqual(report.leakSuspected, false);
    cleanup(sys);
  });

  it('getIntervalReport returns report', () => {
    resetSingleton();
    const sys = new MemoryGuardSystem();
    const report = sys.getIntervalReport();
    assertType(report.total, 'number');
    assert(Array.isArray(report.intervals), 'should have intervals');
    assert(report.byOwner, 'should have byOwner');
    cleanup(sys);
  });

  it('getSnapshot returns quick snapshot', () => {
    resetSingleton();
    const sys = new MemoryGuardSystem();
    const snapshot = sys.getSnapshot();
    assertType(snapshot.heapUsedMB, 'string');
    assertType(snapshot.heapTotalMB, 'string');
    assertType(snapshot.rssMB, 'string');
    assertType(snapshot.level, 'string');
    assertType(snapshot.intervals, 'number');
    assertEqual(snapshot.leakSuspected, false);
    cleanup(sys);
  });
});

run();
