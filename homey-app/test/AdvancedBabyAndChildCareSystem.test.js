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

const AdvancedBabyAndChildCareSystem = require('../lib/AdvancedBabyAndChildCareSystem');

/* ================================================================== */
/*  AdvancedBabyAndChildCareSystem – test suite                       */
/* ================================================================== */

describe('BabyChildCare — constructor & lifecycle', () => {
  it('instantiates without errors', () => {
    const sys = new AdvancedBabyAndChildCareSystem(createMockHomey());
    assert(sys, 'should create instance');
    cleanup(sys);
  });

  it('constructor initializes empty collections', () => {
    const sys = new AdvancedBabyAndChildCareSystem(createMockHomey());
    assertEqual(sys.children.size, 0);
    assertEqual(sys.rooms.size, 0);
    assertEqual(sys.activities.length, 0);
    assertEqual(sys.sleepSessions.length, 0);
    cleanup(sys);
  });

  it('initialize populates children and rooms', async () => {
    const sys = new AdvancedBabyAndChildCareSystem(createMockHomey());
    await sys.initialize();
    assert(sys.children.size > 0, 'should have children');
    assert(sys.rooms.size > 0, 'should have rooms');
    cleanup(sys);
  });

  it('destroy clears interval and cache', async () => {
    const sys = new AdvancedBabyAndChildCareSystem(createMockHomey());
    await sys.initialize();
    await sys.destroy();
    assertEqual(sys._cache.size, 0);
    cleanup(sys);
  });
});

describe('BabyChildCare — sleep sessions', () => {
  it('startSleepSession creates a session', async () => {
    const sys = new AdvancedBabyAndChildCareSystem(createMockHomey());
    await sys.initialize();
    const session = await sys.startSleepSession('child-001');
    assert(session, 'should return session');
    assert(session.id, 'should have id');
    assertEqual(session.childId, 'child-001');
    assertEqual(session.endTime, null);
    cleanup(sys);
  });

  it('startSleepSession throws for unknown child', async () => {
    const sys = new AdvancedBabyAndChildCareSystem(createMockHomey());
    await sys.initialize();
    await assertRejects(() => sys.startSleepSession('nonexistent'), 'not found');
    cleanup(sys);
  });

  it('endSleepSession ends the session', async () => {
    const sys = new AdvancedBabyAndChildCareSystem(createMockHomey());
    await sys.initialize();
    await sys.startSleepSession('child-001');
    const session = await sys.endSleepSession('child-001');
    assert(session, 'should return session');
    assert(session.endTime !== null, 'should have endTime');
    cleanup(sys);
  });

  it('endSleepSession throws for unknown child', async () => {
    const sys = new AdvancedBabyAndChildCareSystem(createMockHomey());
    await sys.initialize();
    await assertRejects(() => sys.endSleepSession('nonexistent'), 'not found');
    cleanup(sys);
  });

  it('endSleepSession changes status to awake', async () => {
    const sys = new AdvancedBabyAndChildCareSystem(createMockHomey());
    await sys.initialize();
    await sys.startSleepSession('child-001');
    await sys.endSleepSession('child-001');
    const child = sys.children.get('child-001');
    assertEqual(child.currentStatus, 'awake');
    cleanup(sys);
  });
});

describe('BabyChildCare — feeding & diaper', () => {
  it('logFeeding records feeding event', async () => {
    const sys = new AdvancedBabyAndChildCareSystem(createMockHomey());
    await sys.initialize();
    const feeding = await sys.logFeeding('child-001', { type: 'breastfeeding', duration: 15, side: 'left' });
    assert(feeding, 'should return feeding');
    assertEqual(feeding.childId, 'child-001');
    assertEqual(feeding.type, 'breastfeeding');
    assert(sys.feedingLog.length >= 1, 'should add to log');
    cleanup(sys);
  });

  it('logFeeding throws for unknown child', async () => {
    const sys = new AdvancedBabyAndChildCareSystem(createMockHomey());
    await sys.initialize();
    await assertRejects(() => sys.logFeeding('nonexistent', {}), 'not found');
    cleanup(sys);
  });

  it('logFeeding updates lastFed', async () => {
    const sys = new AdvancedBabyAndChildCareSystem(createMockHomey());
    await sys.initialize();
    await sys.logFeeding('child-001', { type: 'breastfeeding', duration: 10 });
    const child = sys.children.get('child-001');
    assert(child.feedingSchedule.lastFed !== null, 'should set lastFed');
    cleanup(sys);
  });

  it('logDiaperChange records activity', async () => {
    const sys = new AdvancedBabyAndChildCareSystem(createMockHomey());
    await sys.initialize();
    const activity = await sys.logDiaperChange('child-001', { type: 'wet' });
    assert(activity, 'should return activity');
    assertEqual(activity.type, 'diaper-change');
    assert(sys.activities.length >= 1, 'should add to activities');
    cleanup(sys);
  });
});

describe('BabyChildCare — milestones', () => {
  it('recordMilestone creates a milestone', async () => {
    const sys = new AdvancedBabyAndChildCareSystem(createMockHomey());
    await sys.initialize();
    const milestone = await sys.recordMilestone('child-001', {
      category: 'motor',
      description: 'First crawl',
      notes: 'Exciting!'
    });
    assert(milestone, 'should return milestone');
    assertEqual(milestone.category, 'motor');
    assertEqual(milestone.description, 'First crawl');
    cleanup(sys);
  });

  it('recordMilestone throws for unknown child', async () => {
    const sys = new AdvancedBabyAndChildCareSystem(createMockHomey());
    await sys.initialize();
    await assertRejects(() => sys.recordMilestone('nonexistent', { category: 'motor', description: 'test' }), 'not found');
    cleanup(sys);
  });
});

describe('BabyChildCare — getters', () => {
  it('getChildren returns array', async () => {
    const sys = new AdvancedBabyAndChildCareSystem(createMockHomey());
    await sys.initialize();
    const children = sys.getChildren();
    assert(Array.isArray(children), 'should be array');
    assert(children.length > 0, 'should have children');
    cleanup(sys);
  });

  it('getRooms returns array', async () => {
    const sys = new AdvancedBabyAndChildCareSystem(createMockHomey());
    await sys.initialize();
    const rooms = sys.getRooms();
    assert(Array.isArray(rooms), 'should be array');
    assert(rooms.length > 0, 'should have rooms');
    cleanup(sys);
  });

  it('getSleepSessions returns sessions', async () => {
    const sys = new AdvancedBabyAndChildCareSystem(createMockHomey());
    await sys.initialize();
    await sys.startSleepSession('child-001');
    const sessions = sys.getSleepSessions('child-001');
    assert(Array.isArray(sessions), 'should be array');
    assert(sessions.length >= 1, 'should have sessions');
    cleanup(sys);
  });

  it('getFeedingLog returns feedings', async () => {
    const sys = new AdvancedBabyAndChildCareSystem(createMockHomey());
    await sys.initialize();
    await sys.logFeeding('child-001', { type: 'bottle', amount: 120 });
    const log = sys.getFeedingLog('child-001');
    assert(log.length >= 1, 'should have entries');
    cleanup(sys);
  });

  it('getActivities returns activities', async () => {
    const sys = new AdvancedBabyAndChildCareSystem(createMockHomey());
    await sys.initialize();
    await sys.logDiaperChange('child-001', { type: 'both' });
    const activities = sys.getActivities('child-001');
    assert(activities.length >= 1, 'should have activities');
    cleanup(sys);
  });

  it('getMilestones returns milestones', async () => {
    const sys = new AdvancedBabyAndChildCareSystem(createMockHomey());
    await sys.initialize();
    await sys.recordMilestone('child-001', { category: 'social', description: 'First smile' });
    const milestones = sys.getMilestones('child-001');
    assert(milestones.length >= 1, 'should have milestones');
    cleanup(sys);
  });

  it('getStats returns child stats', async () => {
    const sys = new AdvancedBabyAndChildCareSystem(createMockHomey());
    await sys.initialize();
    const stats = sys.getStats('child-001');
    assert(stats, 'should return stats');
    assertEqual(stats.child, 'Emma');
    assertType(stats.ageMonths, 'number');
    assertType(stats.totalSleepSessions, 'number');
    assertType(stats.totalFeedings, 'number');
    cleanup(sys);
  });

  it('getStats returns null for unknown child', async () => {
    const sys = new AdvancedBabyAndChildCareSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.getStats('nonexistent'), null);
    cleanup(sys);
  });
});

describe('BabyChildCare — environment', () => {
  it('adjustRoomTemperature updates target temperature', async () => {
    const sys = new AdvancedBabyAndChildCareSystem(createMockHomey());
    await sys.initialize();
    await sys.adjustRoomTemperature('nursery-001', 21);
    const room = sys.rooms.get('nursery-001');
    assertEqual(room.environment.temperature.target, 21);
    cleanup(sys);
  });

  it('prepareSleepEnvironment turns off main lights', async () => {
    const sys = new AdvancedBabyAndChildCareSystem(createMockHomey());
    await sys.initialize();
    await sys.prepareSleepEnvironment('nursery-001');
    const room = sys.rooms.get('nursery-001');
    assertEqual(room.environment.lighting.main.status, 'off');
    assertEqual(room.environment.lighting.nightLight.status, 'on');
    assertEqual(room.environment.sound.whiteNoise.status, 'on');
    cleanup(sys);
  });
});

run();
