'use strict';

/**
 * Unit tests for AdvancedNotificationManager.
 *
 * The notification processor interval is suppressed by overriding
 * startNotificationProcessor to be a no-op before initialize() is called.
 */

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertNotEqual, assertType, assertDeepEqual, assertRejects } = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');
const AdvancedNotificationManager = require('../lib/AdvancedNotificationManager');

// ---------------------------------------------------------------------------
// Helper: create a manager with no background interval and a mocked speechOutput
// ---------------------------------------------------------------------------

function createManager(homeyOverrides = {}) {
  const homey = createMockHomey(homeyOverrides);
  homey.speechOutput = { say: async () => {} };

  const mgr = new AdvancedNotificationManager(homey);
  // Suppress the setInterval so tests don't leak timers
  mgr.startNotificationProcessor = () => {};
  return { mgr, homey };
}

async function initializedManager(homeyOverrides = {}) {
  const { mgr, homey } = createManager(homeyOverrides);
  await mgr.initialize();
  return { mgr, homey };
}

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

describe('AdvancedNotificationManager — constructor', () => {
  it('stores the homey reference', () => {
    const { mgr, homey } = createManager();
    assertEqual(mgr.homey, homey);
  });

  it('initialises notificationQueue as an empty array', () => {
    const { mgr } = createManager();
    assert(Array.isArray(mgr.notificationQueue), 'notificationQueue should be an array');
    assertEqual(mgr.notificationQueue.length, 0);
  });

  it('initialises notificationRules as an empty Map', () => {
    const { mgr } = createManager();
    assert(mgr.notificationRules instanceof Map, 'notificationRules should be a Map');
    assertEqual(mgr.notificationRules.size, 0);
  });

  it('initialises deliveredNotifications as an empty array', () => {
    const { mgr } = createManager();
    assert(Array.isArray(mgr.deliveredNotifications), 'deliveredNotifications should be an array');
    assertEqual(mgr.deliveredNotifications.length, 0);
  });

  it('initialises userPreferences as an empty object', () => {
    const { mgr } = createManager();
    assertDeepEqual(mgr.userPreferences, {});
  });
});

// ---------------------------------------------------------------------------
// initialize()
// ---------------------------------------------------------------------------

describe('AdvancedNotificationManager — initialize()', () => {
  it('loads default preferences when none are persisted', async () => {
    const { mgr } = await initializedManager();
    assert(mgr.userPreferences.channels, 'should have channels config after initialize');
    assert(mgr.userPreferences.grouping, 'should have grouping config after initialize');
    assert(mgr.userPreferences.quietHours, 'should have quietHours config after initialize');
  });

  it('registers default notification rules', async () => {
    const { mgr } = await initializedManager();
    assert(mgr.notificationRules.size > 0, 'should have default rules after initialize');
    assert(mgr.notificationRules.has('security_critical'), 'security_critical rule should exist');
    assert(mgr.notificationRules.has('energy_high'), 'energy_high rule should exist');
    assert(mgr.notificationRules.has('device_error'), 'device_error rule should exist');
    assert(mgr.notificationRules.has('info_low'), 'info_low rule should exist');
  });

  it('does not start the processor interval (suppressed by override)', async () => {
    const { mgr } = await initializedManager();
    // processorInterval is undefined because startNotificationProcessor was overridden
    assertEqual(mgr.processorInterval, undefined);
  });
});

// ---------------------------------------------------------------------------
// send()
// ---------------------------------------------------------------------------

describe('AdvancedNotificationManager — send()', () => {
  it('returns success:true with a notificationId', async () => {
    const { mgr } = await initializedManager();
    const result = await mgr.send({ title: 'Hello', message: 'World' });
    assertEqual(result.success, true);
    assertType(result.notificationId, 'string');
    assert(result.notificationId.startsWith('notif_'), 'id should start with notif_');
  });

  it('returns delivered:true or queued:true (mutually exclusive)', async () => {
    const { mgr } = await initializedManager();
    const result = await mgr.send({ title: 'Test', message: 'message' });
    // exactly one of delivered/queued must be true
    assert(result.delivered !== result.queued, 'delivered and queued should be mutually exclusive');
  });

  it('immediately delivers a critical notification', async () => {
    const { mgr } = await initializedManager();
    const result = await mgr.send({
      title: 'ALARM',
      message: 'Intrusion detected',
      priority: 5  // CRITICAL
    });
    assertEqual(result.delivered, true);
    assertEqual(result.queued, false);
  });

  it('enriches notification with an id and timestamp', async () => {
    const { mgr } = await initializedManager();
    const before = Date.now();
    const result = await mgr.send({ title: 'Enrich me' });
    const after = Date.now();
    // Check that the delivered notification has timestamp within range
    const delivered = mgr.deliveredNotifications;
    if (delivered.length > 0) {
      assert(delivered[0].timestamp >= before, 'timestamp should be >= before');
      assert(delivered[0].timestamp <= after, 'timestamp should be <= after');
    }
    assertType(result.notificationId, 'string');
  });
});

// ---------------------------------------------------------------------------
// determinePriority()
// ---------------------------------------------------------------------------

describe('AdvancedNotificationManager — determinePriority()', () => {
  it('returns explicit priority when provided', async () => {
    const { mgr } = await initializedManager();
    const notification = { priority: 4, metadata: { category: 'general' }, title: '', message: '' };
    const priority = await mgr.determinePriority(notification);
    assertEqual(priority, 4);
  });

  it('uses rule priority when notification matches a rule', async () => {
    const { mgr } = await initializedManager();
    // security_critical rule matches category:'security' → priority 5
    const notification = {
      metadata: { category: 'security' },
      title: 'alarm triggered',
      message: ''
    };
    const priority = await mgr.determinePriority(notification);
    assertEqual(priority, 5, 'security category should yield CRITICAL priority');
  });

  it('falls back to urgency analysis when no rule matches', async () => {
    const { mgr } = await initializedManager();
    const notification = {
      metadata: { category: 'general' },
      title: 'routine status',
      message: 'everything is fine'
    };
    const priority = await mgr.determinePriority(notification);
    // No urgency keywords → score 0.3 → score >= 0.2 → LOW (2)
    assertEqual(priority, 2);
  });
});

// ---------------------------------------------------------------------------
// analyzeUrgency()
// ---------------------------------------------------------------------------

describe('AdvancedNotificationManager — analyzeUrgency()', () => {
  it('returns 1.0 for critical words', () => {
    const { mgr } = createManager();
    assertEqual(mgr.analyzeUrgency({ title: 'Fire alarm', message: '' }), 1.0);
    assertEqual(mgr.analyzeUrgency({ title: '', message: 'critical system failure' }), 1.0);
    assertEqual(mgr.analyzeUrgency({ title: 'emergency', message: '' }), 1.0);
  });

  it('returns 0.7 for high-urgency words', () => {
    const { mgr } = createManager();
    assertEqual(mgr.analyzeUrgency({ title: 'warning: high temp', message: '' }), 0.7);
    assertEqual(mgr.analyzeUrgency({ title: 'Device error', message: '' }), 0.7);
    assertEqual(mgr.analyzeUrgency({ title: '', message: 'login failed' }), 0.7);
  });

  it('returns 0.5 for normal-urgency words', () => {
    const { mgr } = createManager();
    assertEqual(mgr.analyzeUrgency({ title: 'system update available', message: '' }), 0.5);
    assertEqual(mgr.analyzeUrgency({ title: '', message: 'complete' }), 0.5);
  });

  it('returns 0.3 as default when no keywords match', () => {
    const { mgr } = createManager();
    assertEqual(mgr.analyzeUrgency({ title: 'good morning', message: 'all systems nominal' }), 0.3);
  });

  it('is case-insensitive', () => {
    const { mgr } = createManager();
    assertEqual(mgr.analyzeUrgency({ title: 'ALARM', message: '' }), 1.0);
    assertEqual(mgr.analyzeUrgency({ title: 'Warning', message: '' }), 0.7);
  });
});

// ---------------------------------------------------------------------------
// matchesRule()
// ---------------------------------------------------------------------------

describe('AdvancedNotificationManager — matchesRule()', () => {
  it('matches by category', () => {
    const { mgr } = createManager();
    const rule = { conditions: { category: 'security' } };
    const notification = { metadata: { category: 'security' }, title: '', message: '' };
    assertEqual(mgr.matchesRule(notification, rule), true);
  });

  it('does not match when category differs', () => {
    const { mgr } = createManager();
    const rule = { conditions: { category: 'security' } };
    const notification = { metadata: { category: 'energy' }, title: '', message: '' };
    assertEqual(mgr.matchesRule(notification, rule), false);
  });

  it('matches by keyword in title', () => {
    const { mgr } = createManager();
    const rule = { conditions: { keywords: ['alarm'] } };
    const notification = { metadata: { category: 'general' }, title: 'alarm triggered', message: '' };
    assertEqual(mgr.matchesRule(notification, rule), true);
  });

  it('matches by keyword in message', () => {
    const { mgr } = createManager();
    const rule = { conditions: { keywords: ['error'] } };
    const notification = { metadata: { category: 'general' }, title: '', message: 'device error occurred' };
    assertEqual(mgr.matchesRule(notification, rule), true);
  });

  it('does not match when keyword is absent', () => {
    const { mgr } = createManager();
    const rule = { conditions: { keywords: ['alarm'] } };
    const notification = { metadata: { category: 'general' }, title: 'status update', message: 'all ok' };
    assertEqual(mgr.matchesRule(notification, rule), false);
  });

  it('matches by deviceId', () => {
    const { mgr } = createManager();
    const rule = { conditions: { deviceId: 'dev-42' } };
    const notification = { metadata: { category: 'general', deviceId: 'dev-42' }, title: '', message: '' };
    assertEqual(mgr.matchesRule(notification, rule), true);
  });

  it('does not match when deviceId differs', () => {
    const { mgr } = createManager();
    const rule = { conditions: { deviceId: 'dev-42' } };
    const notification = { metadata: { category: 'general', deviceId: 'dev-99' }, title: '', message: '' };
    assertEqual(mgr.matchesRule(notification, rule), false);
  });

  it('matches by zoneId', () => {
    const { mgr } = createManager();
    const rule = { conditions: { zoneId: 'zone-1' } };
    const notification = { metadata: { category: 'general', zoneId: 'zone-1' }, title: '', message: '' };
    assertEqual(mgr.matchesRule(notification, rule), true);
  });

  it('returns true when conditions object is empty', () => {
    const { mgr } = createManager();
    const rule = { conditions: {} };
    const notification = { metadata: { category: 'general' }, title: '', message: '' };
    assertEqual(mgr.matchesRule(notification, rule), true);
  });
});

// ---------------------------------------------------------------------------
// shouldDeliverNow()
// ---------------------------------------------------------------------------

describe('AdvancedNotificationManager — shouldDeliverNow()', () => {
  it('critical notification always delivers', async () => {
    const { mgr } = await initializedManager();
    const notification = {
      priority: 5,
      context: { presence: 'home', isQuietHours: false },
      rules: []
    };
    const result = await mgr.shouldDeliverNow(notification);
    assertEqual(result, true);
  });

  it('DND blocks low-priority notification', async () => {
    const { mgr } = await initializedManager();
    // Add an always-active DND schedule
    const allDays = [0, 1, 2, 3, 4, 5, 6];
    mgr.doNotDisturbSchedules = [{
      enabled: true,
      days: allDays,
      start: '00:00',
      end: '23:59'
    }];
    const notification = {
      priority: 2, // LOW — below HIGH threshold
      context: { presence: 'home', isQuietHours: false },
      rules: []
    };
    const result = await mgr.shouldDeliverNow(notification);
    assertEqual(result, false);
  });

  it('fatigue detection blocks low-priority when many recent notifications', async () => {
    const { mgr } = await initializedManager();
    // Simulate > 10 recently delivered notifications (within 10 min)
    const now = Date.now();
    mgr.deliveredNotifications = Array.from({ length: 11 }, (_, i) => ({
      deliveredAt: now - i * 1000
    }));
    const notification = {
      priority: 2, // LOW — below HIGH threshold
      context: { presence: 'home', isQuietHours: false },
      rules: []
    };
    const result = await mgr.shouldDeliverNow(notification);
    assertEqual(result, false);
  });
});

// ---------------------------------------------------------------------------
// selectChannels()
// ---------------------------------------------------------------------------

describe('AdvancedNotificationManager — selectChannels()', () => {
  it('returns rule channels when a matching rule has channels', async () => {
    const { mgr } = await initializedManager();
    const notification = {
      priority: 3,
      rules: [{ actions: { channels: ['sms', 'push'] } }]
    };
    const channels = mgr.selectChannels(notification);
    assertDeepEqual(channels, ['sms', 'push']);
  });

  it('uses preference-based channels when no rule applies', async () => {
    const { mgr } = await initializedManager();
    // CRITICAL priority (5) — push threshold is 3, speech is 4, so both should appear
    const notification = {
      priority: 5,
      rules: []
    };
    const channels = mgr.selectChannels(notification);
    assert(Array.isArray(channels), 'should return an array');
    assert(channels.includes('push'), 'push should be included for critical');
  });

  it('falls back to push when no channel meets the priority threshold', async () => {
    const { mgr } = await initializedManager();
    // INFO priority (1) — below all channel thresholds
    const notification = {
      priority: 1,
      rules: []
    };
    const channels = mgr.selectChannels(notification);
    assert(channels.includes('push'), 'fallback should always include push');
  });
});

// ---------------------------------------------------------------------------
// shouldGroup()
// ---------------------------------------------------------------------------

describe('AdvancedNotificationManager — shouldGroup()', () => {
  it('returns false when grouping is disabled in preferences', async () => {
    const { mgr } = await initializedManager();
    mgr.userPreferences.grouping.enabled = false;
    const notification = { priority: 3, rules: [] };
    assertEqual(mgr.shouldGroup(notification), false);
  });

  it('does not group critical notifications', async () => {
    const { mgr } = await initializedManager();
    mgr.userPreferences.grouping.enabled = true;
    const notification = { priority: 5, rules: [] };
    assertEqual(mgr.shouldGroup(notification), false);
  });

  it('does not group when rule sets allowGrouping:false', async () => {
    const { mgr } = await initializedManager();
    mgr.userPreferences.grouping.enabled = true;
    const notification = {
      priority: 3,
      rules: [{ actions: { allowGrouping: false } }]
    };
    assertEqual(mgr.shouldGroup(notification), false);
  });

  it('returns true for normal priority with grouping enabled and no rule override', async () => {
    const { mgr } = await initializedManager();
    mgr.userPreferences.grouping.enabled = true;
    const notification = {
      priority: 3,
      rules: [{ actions: { channels: ['push'] } }] // no allowGrouping field → defaults to true
    };
    assertEqual(mgr.shouldGroup(notification), true);
  });
});

// ---------------------------------------------------------------------------
// createRule / updateRule / deleteRule
// ---------------------------------------------------------------------------

describe('AdvancedNotificationManager — CRUD for rules', () => {
  it('createRule stores the rule and assigns id + created', async () => {
    const { mgr } = await initializedManager();
    const countBefore = mgr.notificationRules.size;
    const rule = await mgr.createRule({
      name: 'Test Rule',
      conditions: { category: 'test' },
      priority: 3,
      channels: ['push']
    });
    assertEqual(mgr.notificationRules.size, countBefore + 1);
    assertType(rule.id, 'string');
    assertType(rule.created, 'number');
    assertEqual(rule.enabled, true);
  });

  it('createRule respects a provided id', async () => {
    const { mgr } = await initializedManager();
    const rule = await mgr.createRule({
      id: 'my-custom-id',
      name: 'Custom',
      conditions: {},
      priority: 2,
      channels: ['push']
    });
    assertEqual(rule.id, 'my-custom-id');
    assert(mgr.notificationRules.has('my-custom-id'));
  });

  it('updateRule modifies existing rule fields', async () => {
    const { mgr } = await initializedManager();
    const rule = await mgr.createRule({
      name: 'Updatable',
      conditions: {},
      priority: 2,
      channels: ['push']
    });
    const updated = await mgr.updateRule(rule.id, { priority: 4, channels: ['sms'] });
    assertEqual(updated.priority, 4);
    assertDeepEqual(updated.channels, ['sms']);
  });

  it('updateRule throws when rule does not exist', async () => {
    const { mgr } = await initializedManager();
    await assertRejects(() => mgr.updateRule('nonexistent-id', { priority: 1 }), 'Rule not found');
  });

  it('deleteRule removes the rule and returns true', async () => {
    const { mgr } = await initializedManager();
    const rule = await mgr.createRule({
      name: 'To Delete',
      conditions: {},
      priority: 1,
      channels: ['push']
    });
    const deleted = await mgr.deleteRule(rule.id);
    assertEqual(deleted, true);
    assert(!mgr.notificationRules.has(rule.id));
  });

  it('deleteRule returns false for nonexistent id', async () => {
    const { mgr } = await initializedManager();
    const deleted = await mgr.deleteRule('does-not-exist');
    assertEqual(deleted, false);
  });
});

// ---------------------------------------------------------------------------
// isQuietHours()
// ---------------------------------------------------------------------------

describe('AdvancedNotificationManager — isQuietHours()', () => {
  it('returns false when quiet hours are disabled', async () => {
    const { mgr } = await initializedManager();
    mgr.userPreferences.quietHours.enabled = false;
    assertEqual(mgr.isQuietHours(), false);
  });

  it('returns true when current time falls within quiet hours range', async () => {
    const { mgr } = await initializedManager();
    mgr.userPreferences.quietHours.enabled = true;
    // Force a midnight-spanning range that covers all hours
    mgr.userPreferences.quietHours.start = '00:00';
    mgr.userPreferences.quietHours.end = '23:59';
    assertEqual(mgr.isQuietHours(), true);
  });
});

// ---------------------------------------------------------------------------
// isTimeBetween()
// ---------------------------------------------------------------------------

describe('AdvancedNotificationManager — isTimeBetween()', () => {
  it('handles normal (non-midnight-spanning) ranges', () => {
    const { mgr } = createManager();
    // 08:00 is between 07:00 and 22:00
    assertEqual(mgr.isTimeBetween(8 * 60, 7 * 60, 22 * 60), true);
    // 06:00 is not between 07:00 and 22:00
    assertEqual(mgr.isTimeBetween(6 * 60, 7 * 60, 22 * 60), false);
    // 23:00 is not between 07:00 and 22:00
    assertEqual(mgr.isTimeBetween(23 * 60, 7 * 60, 22 * 60), false);
  });

  it('handles midnight-spanning ranges', () => {
    const { mgr } = createManager();
    // 23:30 is within 22:00–07:00 (spans midnight)
    assertEqual(mgr.isTimeBetween(23 * 60 + 30, 22 * 60, 7 * 60), true);
    // 03:00 is within 22:00–07:00
    assertEqual(mgr.isTimeBetween(3 * 60, 22 * 60, 7 * 60), true);
    // 12:00 is NOT within 22:00–07:00
    assertEqual(mgr.isTimeBetween(12 * 60, 22 * 60, 7 * 60), false);
  });

  it('includes boundary values', () => {
    const { mgr } = createManager();
    assertEqual(mgr.isTimeBetween(7 * 60, 7 * 60, 22 * 60), true);   // at start
    assertEqual(mgr.isTimeBetween(22 * 60, 7 * 60, 22 * 60), true);  // at end
  });
});

// ---------------------------------------------------------------------------
// getStatistics()
// ---------------------------------------------------------------------------

describe('AdvancedNotificationManager — getStatistics()', () => {
  it('returns the expected structure with correct counts', async () => {
    const { mgr } = await initializedManager();
    const stats = await mgr.getStatistics();
    assertType(stats.total, 'number');
    assertType(stats.today, 'number');
    assertType(stats.thisWeek, 'number');
    assertType(stats.queued, 'number');
    assertType(stats.byPriority, 'object');
    assertType(stats.byCategory, 'object');
    assertType(stats.byChannel, 'object');
  });

  it('counts queued notifications correctly', async () => {
    const { mgr } = await initializedManager();
    mgr.notificationQueue.push({ id: 'q1' }, { id: 'q2' });
    const stats = await mgr.getStatistics();
    assertEqual(stats.queued, 2);
  });

  it('total matches deliveredNotifications length', async () => {
    const { mgr } = await initializedManager();
    mgr.deliveredNotifications = [
      { deliveredAt: Date.now(), priority: 3, metadata: { category: 'general' }, deliveryResults: {} },
      { deliveredAt: Date.now(), priority: 4, metadata: { category: 'energy' }, deliveryResults: {} }
    ];
    const stats = await mgr.getStatistics();
    assertEqual(stats.total, 2);
  });
});

// Run all tests
run();
