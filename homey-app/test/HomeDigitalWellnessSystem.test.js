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

const HomeDigitalWellnessSystem = require('../lib/HomeDigitalWellnessSystem');

describe('DigitalWellness — constructor & lifecycle', () => {
  it('instantiates without errors', () => {
    const sys = new HomeDigitalWellnessSystem(createMockHomey());
    assert(sys, 'should create instance');
    cleanup(sys);
  });

  it('constructor sets defaults', () => {
    const sys = new HomeDigitalWellnessSystem(createMockHomey());
    assertEqual(sys.initialized, false);
    assertEqual(sys.users.size, 0);
    assertEqual(sys.focusZones.size, 0);
    assertEqual(sys.detoxSessions.length, 0);
    cleanup(sys);
  });

  it('initialize sets initialized flag', async () => {
    const sys = new HomeDigitalWellnessSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.initialized, true);
    cleanup(sys);
  });

  it('initialize is idempotent', async () => {
    const sys = new HomeDigitalWellnessSystem(createMockHomey());
    await sys.initialize();
    await sys.initialize();
    assertEqual(sys.initialized, true);
    cleanup(sys);
  });

  it('initialize creates default budgets', async () => {
    const sys = new HomeDigitalWellnessSystem(createMockHomey());
    await sys.initialize();
    assert(sys.budgets.has('adult-default'), 'should have adult budget');
    assert(sys.budgets.has('child-default'), 'should have child budget');
    assert(sys.budgets.has('teen-default'), 'should have teen budget');
    cleanup(sys);
  });

  it('destroy clears all state', async () => {
    const sys = new HomeDigitalWellnessSystem(createMockHomey());
    await sys.initialize();
    sys.destroy();
    assertEqual(sys.initialized, false);
    assertEqual(sys.users.size, 0);
    assertEqual(sys.budgets.size, 0);
    assertEqual(sys.focusZones.size, 0);
    cleanup(sys);
  });
});

describe('DigitalWellness — user management', () => {
  it('registerUser creates a user', async () => {
    const sys = new HomeDigitalWellnessSystem(createMockHomey());
    await sys.initialize();
    const user = await sys.registerUser({ name: 'Alice', role: 'adult' });
    assert(user.id, 'should have id');
    assertEqual(user.name, 'Alice');
    assertEqual(user.role, 'adult');
    assertEqual(user.todayUsage.totalMinutes, 0);
    cleanup(sys);
  });

  it('registerUser assigns correct budget', async () => {
    const sys = new HomeDigitalWellnessSystem(createMockHomey());
    await sys.initialize();
    const child = await sys.registerUser({ name: 'Bob', role: 'child' });
    assertEqual(child.budgetId, 'child-default');
    cleanup(sys);
  });

  it('recordUsage updates user usage', async () => {
    const sys = new HomeDigitalWellnessSystem(createMockHomey());
    await sys.initialize();
    const user = await sys.registerUser({ name: 'Charlie', role: 'adult' });
    const result = await sys.recordUsage(user.id, { category: 'social', durationMinutes: 30 });
    assertEqual(result.success, true);
    assertEqual(result.todayTotal, 30);
    cleanup(sys);
  });

  it('recordUsage fails for unknown user', async () => {
    const sys = new HomeDigitalWellnessSystem(createMockHomey());
    await sys.initialize();
    const result = await sys.recordUsage('nonexistent', { durationMinutes: 10 });
    assertEqual(result.success, false);
    cleanup(sys);
  });

  it('recordUsage tracks categories', async () => {
    const sys = new HomeDigitalWellnessSystem(createMockHomey());
    await sys.initialize();
    const user = await sys.registerUser({ name: 'Dave', role: 'teen' });
    await sys.recordUsage(user.id, { category: 'gaming', durationMinutes: 20 });
    await sys.recordUsage(user.id, { category: 'social', durationMinutes: 15 });
    const u = sys.users.get(user.id);
    assertEqual(u.todayUsage.categories.gaming, 20);
    assertEqual(u.todayUsage.categories.social, 15);
    assertEqual(u.todayUsage.totalMinutes, 35);
    cleanup(sys);
  });
});

describe('DigitalWellness — digital detox', () => {
  it('startDigitalDetox creates session', async () => {
    const sys = new HomeDigitalWellnessSystem(createMockHomey());
    await sys.initialize();
    const session = await sys.startDigitalDetox({ durationMinutes: 30 });
    assert(session.id, 'should have id');
    assertEqual(session.durationMinutes, 30);
    assertEqual(session.status, 'active');
    assert(session.blockedCategories.length > 0, 'should have blocked categories');
    assert(sys.detoxSessions.length >= 1, 'should add to sessions');
    cleanup(sys);
  });

  it('startDigitalDetox uses defaults', async () => {
    const sys = new HomeDigitalWellnessSystem(createMockHomey());
    await sys.initialize();
    const session = await sys.startDigitalDetox();
    assertEqual(session.durationMinutes, 60);
    assertEqual(session.userId, 'all');
    cleanup(sys);
  });
});

describe('DigitalWellness — focus zones', () => {
  it('configureFocusZone creates a zone', async () => {
    const sys = new HomeDigitalWellnessSystem(createMockHomey());
    await sys.initialize();
    const zone = await sys.configureFocusZone({ name: 'Office', roomId: 'office-1' });
    assert(zone.id, 'should have id');
    assertEqual(zone.name, 'Office');
    assertEqual(zone.enabled, true);
    assertEqual(zone.blockNotifications, true);
    assert(sys.focusZones.size >= 1, 'should store zone');
    cleanup(sys);
  });

  it('configureFocusZone respects disabled flag', async () => {
    const sys = new HomeDigitalWellnessSystem(createMockHomey());
    await sys.initialize();
    const zone = await sys.configureFocusZone({ name: 'Quiet', roomId: 'r1', enabled: false });
    assertEqual(zone.enabled, false);
    cleanup(sys);
  });
});

describe('DigitalWellness — scheduling', () => {
  it('setInternetSchedule creates schedule', async () => {
    const sys = new HomeDigitalWellnessSystem(createMockHomey());
    await sys.initialize();
    const user = await sys.registerUser({ name: 'Eve', role: 'child' });
    const sched = await sys.setInternetSchedule({ userId: user.id, allowedStart: '08:00', allowedEnd: '20:00' });
    assert(sched.id, 'should have id');
    assertEqual(sched.userId, user.id);
    assertEqual(sched.allowedStart, '08:00');
    assertEqual(sched.enabled, true);
    cleanup(sys);
  });

  it('configureQuietHours updates quiet hours', async () => {
    const sys = new HomeDigitalWellnessSystem(createMockHomey());
    await sys.initialize();
    const qh = await sys.configureQuietHours({ start: '23:00', end: '06:00' });
    assertEqual(qh.enabled, true);
    assertEqual(qh.start, '23:00');
    assertEqual(qh.end, '06:00');
    cleanup(sys);
  });
});

describe('DigitalWellness — reports & status', () => {
  it('generateWellnessReport returns report', async () => {
    const sys = new HomeDigitalWellnessSystem(createMockHomey());
    await sys.initialize();
    const user = await sys.registerUser({ name: 'Frank', role: 'adult' });
    await sys.recordUsage(user.id, { category: 'social', durationMinutes: 90 });
    const report = await sys.generateWellnessReport(user.id);
    assertEqual(report.userId, user.id);
    assertEqual(report.totalScreenTime, 90);
    assert(report.categoryBreakdown, 'should have category breakdown');
    assert(Array.isArray(report.recommendations), 'should have recommendations');
    cleanup(sys);
  });

  it('generateWellnessReport fails for unknown user', async () => {
    const sys = new HomeDigitalWellnessSystem(createMockHomey());
    await sys.initialize();
    const report = await sys.generateWellnessReport('nonexistent');
    assertEqual(report.success, false);
    cleanup(sys);
  });

  it('getStatus returns system status', async () => {
    const sys = new HomeDigitalWellnessSystem(createMockHomey());
    await sys.initialize();
    const status = await sys.getStatus();
    assertEqual(status.initialized, true);
    assertType(status.userCount, 'number');
    assertType(status.activeDetoxSessions, 'number');
    assertType(status.focusZoneCount, 'number');
    assertType(status.budgetCount, 'number');
    assertType(status.scheduleCount, 'number');
    cleanup(sys);
  });
});

run();
