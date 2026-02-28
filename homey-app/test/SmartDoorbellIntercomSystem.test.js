'use strict';

const { describe, it, run } = require('./helpers/runner');
const {
  assert, assertEqual, assertType, assertThrows, assertRejects
} = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');

const SmartDoorbellIntercomSystem = require('../lib/SmartDoorbellIntercomSystem');

/* ──── timer tracking ────
 * _startHealthMonitoring() creates a 5-min setInterval.
 * _startSecurityRecording() and _handleMotionEvent() use setTimeout.
 */
const _origSetTimeout = global.setTimeout;
const _origSetInterval = global.setInterval;
const activeHandles = [];

global.setTimeout = (...args) => {
  const id = _origSetTimeout(...args);
  activeHandles.push({ type: 'timeout', id });
  return id;
};
global.setInterval = (...args) => {
  const id = _origSetInterval(...args);
  activeHandles.push({ type: 'interval', id });
  return id;
};

/* ──── helpers ──── */
function createSystem() {
  const homey = createMockHomey();
  const sys = new SmartDoorbellIntercomSystem(homey);
  return { homey, sys };
}

function cleanup(sys) {
  try { sys.destroy(); } catch (_e) { /* ignore */ }
  while (activeHandles.length > 0) {
    const h = activeHandles.pop();
    if (h.type === 'timeout') clearTimeout(h.id);
    else clearInterval(h.id);
  }
}

/* ================================================================
   TESTS
   ================================================================ */

describe('SmartDoorbellIntercomSystem — constructor', () => {
  it('creates instance with default config', () => {
    const { sys } = createSystem();
    assertEqual(sys.initialized, false);
    assertType(sys.doorbells, 'object');
    assertType(sys.knownVisitors, 'object');
    assertEqual(sys.ringHistory.length, 0);
    assert(sys.dndConfig.enabled === false, 'DND should be disabled by default');
    cleanup(sys);
  });

  it('has Swedish quick responses', () => {
    const { sys } = createSystem();
    const responses = Object.values(sys.quickResponses);
    assert(responses.length > 0, 'should have quick responses');
    cleanup(sys);
  });
});

describe('SmartDoorbellIntercomSystem — initialize()', () => {
  it('discovers doorbells and returns success', async () => {
    const { sys } = createSystem();
    const result = await sys.initialize();
    assertEqual(result.success, true);
    assert(result.doorbellCount > 0, 'should discover doorbells');
    assertEqual(sys.initialized, true);
    cleanup(sys);
  });

  it('creates 4 default doorbells', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.doorbells.size, 4);
    assert(sys.doorbells.has('front_door'), 'should have front_door');
    assert(sys.doorbells.has('side_entrance'), 'should have side_entrance');
    assert(sys.doorbells.has('gate'), 'should have gate');
    cleanup(sys);
  });

  it('registers event listeners on homey', async () => {
    const { sys, homey } = createSystem();
    await sys.initialize();
    // EventEmitter should have listeners for doorbell events
    assert(homey.listenerCount('doorbell:ring') > 0, 'should have ring listener');
    assert(homey.listenerCount('doorbell:motion') > 0, 'should have motion listener');
    assert(homey.listenerCount('doorbell:answer') > 0, 'should have answer listener');
    cleanup(sys);
  });
});

describe('SmartDoorbellIntercomSystem — _handleRingEvent()', () => {
  it('creates a ring event with expected structure', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const ringEvent = await sys._handleRingEvent({ doorbellId: 'front_door' });
    assertType(ringEvent.id, 'string');
    assertEqual(ringEvent.doorbellId, 'front_door');
    assertType(ringEvent.timestamp, 'number');
    assertType(ringEvent.visitorInfo, 'object');
    assert(sys.ringHistory.length === 1, 'should store in history');
    cleanup(sys);
  });

  it('increments ring statistics', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const before = sys.stats.totalRings;
    await sys._handleRingEvent({ doorbellId: 'front_door' });
    assertEqual(sys.stats.totalRings, before + 1);
    cleanup(sys);
  });

  it('sends notification', async () => {
    const { sys, homey } = createSystem();
    await sys.initialize();
    const sent = [];
    homey.notifications = {
      async createNotification({ excerpt }) {
        const n = { id: `notif-${Date.now()}`, excerpt };
        sent.push(n);
        return n;
      },
    };
    await sys._handleRingEvent({ doorbellId: 'front_door' });
    assert(sent.length > 0, 'should create notification');
    cleanup(sys);
  });
});

describe('SmartDoorbellIntercomSystem — intercom sessions', () => {
  it('starts an intercom session on a doorbell with intercom', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const session = await sys.startIntercomSession('front_door', 'user1');
    assertType(session.id, 'string');
    assertEqual(session.doorbellId, 'front_door');
    assertEqual(session.userId, 'user1');
    assert(sys.activeSessions.size > 0, 'should have active session');
    cleanup(sys);
  });

  it('throws for doorbell without intercom', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    // side_entrance has no intercom
    await assertRejects(() => sys.startIntercomSession('side_entrance', 'user1'));
    cleanup(sys);
  });

  it('ends session and records in call history', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const session = await sys.startIntercomSession('front_door', 'user1');
    await sys.endIntercomSession(session.id);
    assertEqual(sys.activeSessions.size, 0);
    assert(sys.callHistory.length > 0, 'should record in call history');
    cleanup(sys);
  });
});

describe('SmartDoorbellIntercomSystem — quick responses', () => {
  it('sends a quick response', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    // First create a ring event to mark as answered
    await sys._handleRingEvent({ doorbellId: 'front_door' });
    const responseId = Object.keys(sys.quickResponses)[0];
    const result = await sys.sendQuickResponse('front_door', responseId);
    assertType(result.message, 'string');
    cleanup(sys);
  });

  it('adds a custom quick response', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const before = Object.keys(sys.quickResponses).length;
    sys.addQuickResponse('test_resp', 'Test', 'Hello there', 5000);
    assertEqual(Object.keys(sys.quickResponses).length, before + 1);
    cleanup(sys);
  });

  it('retrieves all quick responses as array', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const responses = sys.getQuickResponses();
    assert(Array.isArray(responses), 'should return array');
    assert(responses.length >= 5, 'should have at least 5 default responses');
    cleanup(sys);
  });
});

describe('SmartDoorbellIntercomSystem — known visitors', () => {
  it('adds a known visitor', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const visitor = sys.addKnownVisitor('Erik', 'friend', { phone: '555' });
    assertType(visitor.id, 'string');
    assertEqual(visitor.name, 'Erik');
    assertEqual(visitor.category, 'friend');
    assert(sys.knownVisitors.has(visitor.id), 'should be in visitor map');
    cleanup(sys);
  });

  it('family visitors are allowed during DND', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const visitor = sys.addKnownVisitor('Anna', 'family');
    assertEqual(sys.knownVisitors.get(visitor.id).allowDuringDnd, true);
    cleanup(sys);
  });

  it('removes a known visitor', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const visitor = sys.addKnownVisitor('Test', 'friend');
    sys.removeKnownVisitor(visitor.id);
    assert(!sys.knownVisitors.has(visitor.id), 'should be removed');
    cleanup(sys);
  });

  it('throws when removing non-existent visitor', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertThrows(() => sys.removeKnownVisitor('nonexistent'));
    cleanup(sys);
  });
});

describe('SmartDoorbellIntercomSystem — DND', () => {
  it('enables and disables DND', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    sys.enableDnd('sleeping');
    assertEqual(sys.dndConfig.enabled, true);
    sys.disableDnd();
    assertEqual(sys.dndConfig.enabled, false);
    cleanup(sys);
  });

  it('blocks rings when DND is active', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    sys.enableDnd('sleeping', 60000); // duration creates active override
    const before = sys.stats.dndSuppressed;
    const ringEvent = await sys._handleRingEvent({ doorbellId: 'front_door' });
    assert(ringEvent === undefined, 'ring should be suppressed by DND');
    assertEqual(sys.stats.dndSuppressed, before + 1);
    cleanup(sys);
  });

  it('adds a DND schedule', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const schedule = sys.addDndSchedule('Night', 22, 0, 7, 0, [0, 1, 2, 3, 4, 5, 6]);
    assertType(schedule.id, 'string');
    assertEqual(schedule.label, 'Night');
    assertEqual(schedule.active, true);
    cleanup(sys);
  });

  it('removes a DND schedule', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const schedule = sys.addDndSchedule('Test', 9, 0, 10, 0, [1]);
    const before = sys.dndConfig.schedules.length;
    sys.removeDndSchedule(schedule.id);
    assertEqual(sys.dndConfig.schedules.length, before - 1);
    cleanup(sys);
  });

  it('throws for non-existent schedule removal', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertThrows(() => sys.removeDndSchedule('nonexistent'));
    cleanup(sys);
  });
});

describe('SmartDoorbellIntercomSystem — delivery management', () => {
  it('registers expected delivery', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const delivery = sys.registerExpectedDelivery('PostNord', 'PKG123', new Date(), 'Leave at door');
    assertType(delivery.id, 'string');
    assertEqual(delivery.carrier, 'PostNord');
    assertEqual(delivery.status, 'pending');
    cleanup(sys);
  });

  it('updates delivery instructions', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    sys.setDeliveryInstructions('Ring twice');
    assertEqual(sys.deliveryConfig.deliveryInstructions, 'Ring twice');
    cleanup(sys);
  });
});

describe('SmartDoorbellIntercomSystem — night mode', () => {
  it('enables night mode with options', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    sys.setNightMode(true, { reducedVolume: true });
    assertEqual(sys.nightMode.enabled, true);
    cleanup(sys);
  });

  it('increments nightModeActivations stat', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const before = sys.stats.nightModeActivations;
    sys.setNightMode(true);
    assertEqual(sys.stats.nightModeActivations, before + 1);
    cleanup(sys);
  });
});

describe('SmartDoorbellIntercomSystem — multi-unit', () => {
  it('configures multi-unit mode', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    sys.configureMultiUnit([
      { id: 'unit1', name: 'Apartment 1' },
      { id: 'unit2', name: 'Apartment 2' }
    ]);
    assertEqual(sys.multiUnitConfig.enabled, true);
    assertEqual(sys.multiUnitConfig.units.size, 2);
    cleanup(sys);
  });

  it('routes call to a unit', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    sys.configureMultiUnit([{ id: 'unit1', name: 'Apt 1' }]);
    const result = await sys.routeToUnit('unit1', { name: 'Visitor' });
    assert(result.success, 'should succeed');
    assertEqual(result.unit, 'Apt 1');
    cleanup(sys);
  });

  it('throws for non-existent unit', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    sys.configureMultiUnit([{ id: 'unit1', name: 'Apt 1' }]);
    await assertRejects(() => sys.routeToUnit('unit99', {}));
    cleanup(sys);
  });
});

describe('SmartDoorbellIntercomSystem — visitor log', () => {
  it('filters ring history with options', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    await sys._handleRingEvent({ doorbellId: 'front_door' });
    await sys._handleRingEvent({ doorbellId: 'gate' });
    const log = sys.getVisitorLog({ doorbellId: 'front_door' });
    assertEqual(log.entries.length, 1);
    assertEqual(log.entries[0].doorbellId, 'front_door');
    cleanup(sys);
  });

  it('respects limit option', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    await sys._handleRingEvent({ doorbellId: 'front_door' });
    await sys._handleRingEvent({ doorbellId: 'front_door' });
    await sys._handleRingEvent({ doorbellId: 'front_door' });
    const log = sys.getVisitorLog({ limit: 2 });
    assertEqual(log.entries.length, 2);
    cleanup(sys);
  });

  it('adds note to ring event', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const ring = await sys._handleRingEvent({ doorbellId: 'front_door' });
    sys.addNoteToRingEvent(ring.id, 'Suspicious person');
    const updated = sys.ringHistory.find(r => r.id === ring.id);
    assert(updated.notes.includes('Suspicious person'), 'note should be added');
    cleanup(sys);
  });

  it('throws when adding note to non-existent ring', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertThrows(() => sys.addNoteToRingEvent('fake_id', 'note'));
    cleanup(sys);
  });
});

describe('SmartDoorbellIntercomSystem — device health', () => {
  it('returns health for a specific doorbell', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const health = sys.getDeviceHealth('front_door');
    assertType(health.batteryLevel, 'number');
    assertType(health.wifiSignal, 'number');
    cleanup(sys);
  });

  it('returns health for all doorbells when no id given', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const all = sys.getDeviceHealth();
    assertType(all, 'object');
    assert(Object.keys(all).length === 4, 'should have 4 doorbells');
    cleanup(sys);
  });
});

describe('SmartDoorbellIntercomSystem — getStatistics()', () => {
  it('returns comprehensive stats object', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    await sys._handleRingEvent({ doorbellId: 'front_door' });
    const stats = sys.getStatistics();
    assertType(stats.overview, 'object');
    assertType(stats.visitors, 'object');
    assertType(stats.patterns, 'object');
    assertEqual(stats.overview.totalRings, 1);
    cleanup(sys);
  });
});

describe('SmartDoorbellIntercomSystem — destroy()', () => {
  it('clears health monitoring and ends sessions', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    await sys.startIntercomSession('front_door', 'user1');
    await sys.destroy();
    assertEqual(sys.initialized, false);
    assertEqual(sys.activeSessions.size, 0);
    cleanup(sys);
  });
});

run();
