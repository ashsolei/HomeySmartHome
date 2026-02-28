'use strict';

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertType, assertRejects } = require('./helpers/assert');
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

const SmartWindowManagementSystem = require('../lib/SmartWindowManagementSystem');

describe('WindowMgmt — constructor & lifecycle', () => {
  it('instantiates without errors', () => {
    const sys = new SmartWindowManagementSystem(createMockHomey());
    assert(sys, 'should create instance');
    assertEqual(sys.windows.size, 0);
    cleanup(sys);
  });

  it('initialize populates windows and rules', async () => {
    const sys = new SmartWindowManagementSystem(createMockHomey());
    await sys.initialize();
    assert(sys.windows.size > 0, 'should have windows');
    assert(sys.automationRules.length > 0, 'should have automation rules');
    assert(sys.schedules.length > 0, 'should have schedules');
    cleanup(sys);
  });

  it('destroy clears monitoring interval', async () => {
    const sys = new SmartWindowManagementSystem(createMockHomey());
    await sys.initialize();
    await sys.destroy();
    cleanup(sys);
  });
});

describe('WindowMgmt — window queries', () => {
  it('getWindows returns all windows', async () => {
    const sys = new SmartWindowManagementSystem(createMockHomey());
    await sys.initialize();
    const windows = sys.getWindows();
    assert(Array.isArray(windows), 'should be array');
    assert(windows.length > 0, 'should have windows');
    cleanup(sys);
  });

  it('getWindowsByRoom filters by room', async () => {
    const sys = new SmartWindowManagementSystem(createMockHomey());
    await sys.initialize();
    const all = sys.getWindows();
    const room = all[0].room;
    const roomWindows = sys.getWindowsByRoom(room);
    assert(roomWindows.length > 0, 'should have windows in room');
    for (const w of roomWindows) {
      assertEqual(w.room, room);
    }
    cleanup(sys);
  });

  it('getAutomationRules returns rules array', async () => {
    const sys = new SmartWindowManagementSystem(createMockHomey());
    await sys.initialize();
    const rules = sys.getAutomationRules();
    assert(Array.isArray(rules), 'should be array');
    assert(rules.length > 0, 'should have rules');
    cleanup(sys);
  });

  it('getSchedules returns schedules array', async () => {
    const sys = new SmartWindowManagementSystem(createMockHomey());
    await sys.initialize();
    const schedules = sys.getSchedules();
    assert(Array.isArray(schedules), 'should be array');
    assert(schedules.length > 0, 'should have schedules');
    cleanup(sys);
  });
});

describe('WindowMgmt — window position control', () => {
  it('setWindowPosition opens an unlocked window', async () => {
    const sys = new SmartWindowManagementSystem(createMockHomey());
    await sys.initialize();
    const windows = sys.getWindows();
    const openable = windows.find(w => w.capabilities.openable);
    if (!openable) return;
    openable.status.lockStatus = 'unlocked';
    const result = await sys.setWindowPosition(openable.id, 'open');
    assertEqual(result.status.position, 'open');
    cleanup(sys);
  });

  it('setWindowPosition tilts an unlocked window', async () => {
    const sys = new SmartWindowManagementSystem(createMockHomey());
    await sys.initialize();
    const windows = sys.getWindows();
    const openable = windows.find(w => w.capabilities.openable);
    if (!openable) return;
    openable.status.lockStatus = 'unlocked';
    const result = await sys.setWindowPosition(openable.id, 'tilted');
    assertEqual(result.status.position, 'tilted');
    cleanup(sys);
  });

  it('setWindowPosition throws when window is locked', async () => {
    const sys = new SmartWindowManagementSystem(createMockHomey());
    await sys.initialize();
    const windows = sys.getWindows();
    const openable = windows.find(w => w.capabilities.openable);
    if (!openable) return;
    assertEqual(openable.status.lockStatus, 'locked');
    await assertRejects(() => sys.setWindowPosition(openable.id, 'open'), 'låst');
    cleanup(sys);
  });

  it('setWindowPosition closes an unlocked window', async () => {
    const sys = new SmartWindowManagementSystem(createMockHomey());
    await sys.initialize();
    const windows = sys.getWindows();
    const openable = windows.find(w => w.capabilities.openable);
    if (!openable) return;
    openable.status.lockStatus = 'unlocked';
    await sys.setWindowPosition(openable.id, 'open');
    const result = await sys.setWindowPosition(openable.id, 'closed');
    assertEqual(result.status.position, 'closed');
    cleanup(sys);
  });

  it('setWindowPosition throws for unknown window', async () => {
    const sys = new SmartWindowManagementSystem(createMockHomey());
    await sys.initialize();
    await assertRejects(() => sys.setWindowPosition('nope', 'open'), 'hittades inte');
    cleanup(sys);
  });
});

describe('WindowMgmt — blind control', () => {
  it('setBlindPosition adjusts blind position', async () => {
    const sys = new SmartWindowManagementSystem(createMockHomey());
    await sys.initialize();
    const windows = sys.getWindows();
    const withBlind = windows.find(w => w.capabilities.hasBlind);
    if (!withBlind) return;
    const result = await sys.setBlindPosition(withBlind.id, 75);
    assertEqual(result.status.blindPosition, 75);
    cleanup(sys);
  });

  it('setBlindPosition clamps to 0-100', async () => {
    const sys = new SmartWindowManagementSystem(createMockHomey());
    await sys.initialize();
    const windows = sys.getWindows();
    const withBlind = windows.find(w => w.capabilities.hasBlind);
    if (!withBlind) return;
    const result = await sys.setBlindPosition(withBlind.id, 150);
    assertEqual(result.status.blindPosition, 100);
    cleanup(sys);
  });

  it('setBlindPosition throws for unknown window', async () => {
    const sys = new SmartWindowManagementSystem(createMockHomey());
    await sys.initialize();
    await assertRejects(() => sys.setBlindPosition('nope', 50), 'hittades inte');
    cleanup(sys);
  });
});

describe('WindowMgmt — stats', () => {
  it('getStats returns comprehensive statistics', async () => {
    const sys = new SmartWindowManagementSystem(createMockHomey());
    await sys.initialize();
    const stats = sys.getStats();
    assertType(stats.totalWindows, 'number');
    assertType(stats.openWindows, 'number');
    assertType(stats.closedWindows, 'number');
    assertType(stats.automationRules, 'number');
    assertType(stats.schedules, 'number');
    assert(stats.byRoom, 'should have byRoom');
    cleanup(sys);
  });

  it('getWindowStatsByRoom returns room-based stats', async () => {
    const sys = new SmartWindowManagementSystem(createMockHomey());
    await sys.initialize();
    const byRoom = sys.getWindowStatsByRoom();
    assert(Object.keys(byRoom).length > 0, 'should have rooms');
    const firstRoom = Object.values(byRoom)[0];
    assertType(firstRoom.count, 'number');
    assertType(firstRoom.open, 'number');
    assertType(firstRoom.averageBlindPosition, 'number');
    cleanup(sys);
  });
});

run();
