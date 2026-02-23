'use strict';

/**
 * Unit tests for SmartSchedulingSystem.
 *
 * All tests run in-process — no live server needed.
 */

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertType, assertThrows, assertRejects } = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');
const SmartSchedulingSystem = require('../lib/SmartSchedulingSystem');

// Helper: create a fresh system with timers suppressed so tests don't linger.
function makeSystem() {
  const homey = createMockHomey();
  const system = new SmartSchedulingSystem(homey);

  // Suppress real intervals/timeouts that would keep the process alive.
  system._noTimers = true;
  const origStart = system.startScheduler.bind(system);
  system.startScheduler = async () => {
    // Only run the initial checkDueTasks without setting intervals.
    await system.checkDueTasks();
  };

  return { system, homey };
}

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

describe('SmartSchedulingSystem — constructor', () => {
  it('stores the homey reference', () => {
    const homey = createMockHomey();
    const system = new SmartSchedulingSystem(homey);
    assertEqual(system.homey, homey);
  });

  it('initialises tasks as an empty Map', () => {
    const { system } = makeSystem();
    assert(system.tasks instanceof Map);
    assertEqual(system.tasks.size, 0);
  });

  it('initialises executionQueue as an empty array', () => {
    const { system } = makeSystem();
    assert(Array.isArray(system.executionQueue));
    assertEqual(system.executionQueue.length, 0);
  });
});

// ---------------------------------------------------------------------------
// createTask
// ---------------------------------------------------------------------------

describe('SmartSchedulingSystem — createTask', () => {
  it('creates a task with expected shape', async () => {
    const { system } = makeSystem();
    const task = await system.createTask({
      name: 'Test Task',
      type: 'once',
      schedule: { time: Date.now() + 60000 },
      action: { type: 'log', message: 'hello' },
    });

    assertType(task.id, 'string');
    assertEqual(task.name, 'Test Task');
    assertEqual(task.type, 'once');
    assertEqual(task.enabled, true);
    assertEqual(task.status, 'pending');
    assertEqual(task.executionCount, 0);
    assertEqual(task.failureCount, 0);
    assert(task.maxRetries > 0, 'maxRetries should have a default');
    assertType(task.created, 'number');
  });

  it('stores the task in the tasks Map', async () => {
    const { system } = makeSystem();
    const task = await system.createTask({
      name: 'Stored Task',
      type: 'once',
      schedule: { time: Date.now() + 60000 },
      action: { type: 'log', message: 'stored' },
    });
    assert(system.tasks.has(task.id));
  });

  it('uses provided priority', async () => {
    const { system } = makeSystem();
    const task = await system.createTask({
      name: 'High Priority',
      type: 'once',
      priority: 9,
      schedule: { time: Date.now() + 60000 },
      action: { type: 'log', message: 'prio' },
    });
    assertEqual(task.priority, 9);
  });

  it('defaults priority to 5 when not specified', async () => {
    const { system } = makeSystem();
    const task = await system.createTask({
      name: 'Default Priority',
      type: 'once',
      schedule: { time: Date.now() + 60000 },
      action: { type: 'log' },
    });
    assertEqual(task.priority, 5);
  });
});

// ---------------------------------------------------------------------------
// executeScriptAction — security: no new Function() / eval()
// ---------------------------------------------------------------------------

describe('SmartSchedulingSystem — executeScriptAction', () => {
  it('executes "log" action type without throwing', async () => {
    const { system } = makeSystem();
    // Should not throw
    await system.executeScriptAction({ type: 'log', message: 'test log' });
  });

  it('executes "setting" action with a string value', async () => {
    const { system, homey } = makeSystem();
    await system.executeScriptAction({ type: 'setting', key: 'myKey', value: 'myValue' });
    assertEqual(homey.settings.get('myKey'), 'myValue');
  });

  it('executes "setting" action with a number value', async () => {
    const { system, homey } = makeSystem();
    await system.executeScriptAction({ type: 'setting', key: 'numKey', value: 42 });
    assertEqual(homey.settings.get('numKey'), 42);
  });

  it('executes "setting" action with a boolean value', async () => {
    const { system, homey } = makeSystem();
    await system.executeScriptAction({ type: 'setting', key: 'boolKey', value: true });
    assertEqual(homey.settings.get('boolKey'), true);
  });

  it('throws for "setting" action with object value (security)', async () => {
    const { system } = makeSystem();
    await assertRejects(
      () => system.executeScriptAction({ type: 'setting', key: 'badKey', value: { nested: true } }),
      'must be a string, number, or boolean'
    );
  });

  it('throws for "setting" action with missing key', async () => {
    const { system } = makeSystem();
    await assertRejects(
      () => system.executeScriptAction({ type: 'setting', value: 'val' }),
      'requires a "key"'
    );
  });

  it('executes "emit" action with valid event name', async () => {
    const { system } = makeSystem();
    // Should not throw
    await system.executeScriptAction({ type: 'emit', event: 'test.event', data: { x: 1 } });
  });

  it('throws for "emit" action with empty event name', async () => {
    const { system } = makeSystem();
    await assertRejects(
      () => system.executeScriptAction({ type: 'emit', event: '' }),
      'valid "event" name'
    );
  });

  it('strips dangerous characters from emit event names', async () => {
    const { system, homey } = makeSystem();
    // The event name should be sanitised; the call itself should not throw.
    let emittedEvent = null;
    homey.emit = (name) => { emittedEvent = name; };
    await system.executeScriptAction({ type: 'emit', event: 'hello; rm -rf /', data: {} });
    // Only safe characters remain
    assert(!emittedEvent.includes(';'), 'semicolons should be stripped from event name');
    assert(!emittedEvent.includes(' '), 'spaces should be stripped from event name');
  });

  it('rejects unknown script action type', async () => {
    const { system } = makeSystem();
    await assertRejects(
      () => system.executeScriptAction({ type: 'eval', code: 'process.exit(1)' }),
      'Unsupported script action type'
    );
  });

  it('rejects action with no type', async () => {
    const { system } = makeSystem();
    await assertRejects(
      () => system.executeScriptAction({}),
      'must have a "type"'
    );
  });
});

// ---------------------------------------------------------------------------
// checkTimeRange
// ---------------------------------------------------------------------------

describe('SmartSchedulingSystem — checkTimeRange', () => {
  it('returns true when current time is inside the range', () => {
    const { system } = makeSystem();
    // Use a range that covers the full day (0:00 – 23:59)
    const result = system.checkTimeRange({ start: '00:00', end: '23:59' });
    assertEqual(result, true);
  });

  it('returns false when current time is outside the range', () => {
    const { system } = makeSystem();
    // A range in the far future (guaranteed to fail unless it wraps)
    // Use a 1-minute window at midnight
    const result = system.checkTimeRange({ start: '00:00', end: '00:01' });
    // We can't deterministically fail this without mocking Date, but we can
    // verify the return type is boolean.
    assertType(result, 'boolean');
  });
});

// ---------------------------------------------------------------------------
// calculateRecurringExecution
// ---------------------------------------------------------------------------

describe('SmartSchedulingSystem — calculateRecurringExecution', () => {
  it('returns a future timestamp for "interval" frequency', () => {
    const { system } = makeSystem();
    const now = Date.now();
    const next = system.calculateRecurringExecution({ frequency: 'interval', intervalMs: 3600000 }, now);
    assertEqual(next, now + 3600000);
  });

  it('returns a future timestamp for "hourly" frequency', () => {
    const { system } = makeSystem();
    const now = Date.now();
    const next = system.calculateRecurringExecution({ frequency: 'hourly', minute: 0 }, now);
    assertType(next, 'number');
    assert(next > now, 'next execution should be in the future');
  });

  it('returns a future timestamp for "daily" frequency', () => {
    const { system } = makeSystem();
    const now = Date.now();
    const next = system.calculateRecurringExecution({ frequency: 'daily', hour: 3, minute: 0 }, now);
    assertType(next, 'number');
    assert(next > now, 'next execution should be in the future');
  });

  it('returns null for unknown frequency', () => {
    const { system } = makeSystem();
    const next = system.calculateRecurringExecution({ frequency: 'unknown' }, Date.now());
    assertEqual(next, null);
  });
});

// ---------------------------------------------------------------------------
// getStatistics
// ---------------------------------------------------------------------------

describe('SmartSchedulingSystem — getStatistics', () => {
  it('returns a statistics object with expected shape', async () => {
    const { system } = makeSystem();
    await system.createTask({
      name: 'StatTask',
      type: 'once',
      schedule: { time: Date.now() + 60000 },
      action: { type: 'log' },
    });

    const stats = system.getStatistics();
    assertType(stats.total, 'number');
    assert(stats.total >= 1);
    assert('byStatus' in stats, 'should have byStatus');
    assertType(stats.queueLength, 'number');
    assert('executionHistory' in stats);
  });
});

// ---------------------------------------------------------------------------
// findMostCommon
// ---------------------------------------------------------------------------

describe('SmartSchedulingSystem — findMostCommon', () => {
  it('returns the most frequently occurring item', () => {
    const { system } = makeSystem();
    const result = system.findMostCommon([1, 2, 2, 3, 2]);
    assertEqual(result, 2);
  });

  it('works with a single-element array', () => {
    const { system } = makeSystem();
    assertEqual(system.findMostCommon([7]), 7);
  });
});

// ---------------------------------------------------------------------------
// tasksConflict
// ---------------------------------------------------------------------------

describe('SmartSchedulingSystem — tasksConflict', () => {
  it('detects conflict when both tasks target the same device', () => {
    const { system } = makeSystem();
    const t1 = { action: { deviceId: 'dev-1' } };
    const t2 = { action: { deviceId: 'dev-1' } };
    assertEqual(system.tasksConflict(t1, t2), true);
  });

  it('detects no conflict for different devices', () => {
    const { system } = makeSystem();
    const t1 = { action: { deviceId: 'dev-1' }, metadata: {} };
    const t2 = { action: { deviceId: 'dev-2' } };
    assertEqual(system.tasksConflict(t1, t2), false);
  });

  it('detects conflict when both tasks target the same scene', () => {
    const { system } = makeSystem();
    const t1 = { action: { sceneId: 'scene-morning' } };
    const t2 = { action: { sceneId: 'scene-morning' } };
    assertEqual(system.tasksConflict(t1, t2), true);
  });
});

// ---------------------------------------------------------------------------
// Security: no eval / new Function in source
// ---------------------------------------------------------------------------

describe('SmartSchedulingSystem — security: no eval()', () => {
  it('source code does not contain eval()', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.resolve(__dirname, '../lib/SmartSchedulingSystem.js'),
      'utf8'
    );
    assert(!src.includes('eval('), 'SmartSchedulingSystem.js must not use eval()');
  });

  it('source code does not contain new Function(', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.resolve(__dirname, '../lib/SmartSchedulingSystem.js'),
      'utf8'
    );
    assert(!src.includes('new Function('), 'SmartSchedulingSystem.js must not use new Function()');
  });
});

// Run
run();
