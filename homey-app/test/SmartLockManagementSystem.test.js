'use strict';

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertType, assertDeepEqual } = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');

const SmartLockManagementSystem = require('../lib/SmartLockManagementSystem');

/* ── helpers ──────────────────────────────────────────────────────────── */

/**
 * Create a mock device that behaves like a Homey smart lock.
 */
function createMockDevice(id, name, opts = {}) {
  const caps = { locked: true, ...opts.capabilities };
  return {
    id,
    name,
    zone: { name: opts.zone || 'hallway' },
    hasCapability: (cap) => cap in caps,
    getCapabilityValue: async (cap) => caps[cap] ?? null,
    setCapabilityValue: async (cap, val) => { caps[cap] = val; },
  };
}

/**
 * Build a SmartLockManagementSystem with pre-populated mock locks, skipping
 * the full async initialize() which requires real drivers.
 */
function createSystem(lockDevices = []) {
  const homey = createMockHomey();

  // discoverLocks() calls homey.drivers.getDevices()
  homey.drivers = {
    getDevices: () => lockDevices,
  };

  // Provide notification + security stubs used by several methods
  homey.app.advancedNotificationManager = {
    sendNotification: async () => {},
  };
  homey.app.advancedSecuritySystem = {
    handleIntrusionEvent: async () => {},
  };

  const sys = new SmartLockManagementSystem(homey);
  return { sys, homey };
}

/**
 * Helper: create system with two pre-registered locks already in the map
 * (no need to go through discoverLocks).
 */
function createSystemWithLocks() {
  const dev1 = createMockDevice('lock-1', 'Front Door Lock', { zone: 'entrance' });
  const dev2 = createMockDevice('lock-2', 'Back Door Lock', { zone: 'garden' });

  const { sys, homey } = createSystem([dev1, dev2]);

  // Manually add them as discoverLocks would:
  for (const device of [dev1, dev2]) {
    sys.locks.set(device.id, {
      id: device.id,
      name: device.name,
      device,
      zone: device.zone.name,
      locked: true,
      lastAccess: null,
      autoLock: true,
      autoLockDelayMs: sys.autoLockDelay,
      batteryLevel: null,
      lastBatteryCheck: null,
      tamperAlerted: false,
      doorOpen: false,
      doorOpenedAt: null,
    });
    sys.usageAnalytics.doorUsageCounts.set(device.id, 0);
  }

  return { sys, homey, dev1, dev2 };
}

/* ── tests ────────────────────────────────────────────────────────────── */

describe('SmartLockManagementSystem — Constructor', () => {
  it('sets default configuration values', () => {
    const { sys } = createSystem();
    assertEqual(sys.autoLockEnabled, true);
    assertEqual(sys.autoLockDelay, 300000);
    assertEqual(sys.tamperDetectionEnabled, true);
    assertEqual(sys.lockBehindMeEnabled, false);
    assertEqual(sys.emergencyUnlockEnabled, true);
    assertEqual(sys.lowBatteryThreshold, 20);
    assertEqual(sys.criticalBatteryThreshold, 10);
    assertEqual(sys.syncGroupsEnabled, false);
    assertEqual(sys.securityIntegrationEnabled, true);
    assertEqual(sys.locks.size, 0);
    assertEqual(sys.accessCodes.size, 0);
    assertEqual(sys.accessLog.length, 0);
    assertEqual(sys.tamperEvents.length, 0);
    assertEqual(sys.emergencyLog.length, 0);
    assertEqual(sys.keyRegistry.size, 0);
  });

  it('initialises analytics arrays correctly', () => {
    const { sys } = createSystem();
    assertEqual(sys.usageAnalytics.hourlyUsage.length, 24);
    assertEqual(sys.usageAnalytics.dailyUsage.length, 7);
    assertEqual(sys.usageAnalytics.doorUsageCounts.size, 0);
  });
});

describe('SmartLockManagementSystem — discoverLocks', () => {
  it('discovers devices whose name contains "lock"', async () => {
    const dev = createMockDevice('d1', 'Front Door Lock');
    const { sys } = createSystem([dev]);
    await sys.discoverLocks();
    assertEqual(sys.locks.size, 1);
    assert(sys.locks.has('d1'));
  });

  it('discovers devices whose name contains "lås" (Swedish)', async () => {
    const dev = createMockDevice('d2', 'Ytterdörr lås');
    const { sys } = createSystem([dev]);
    await sys.discoverLocks();
    assertEqual(sys.locks.size, 1);
  });

  it('discovers devices with locked capability', async () => {
    const dev = {
      id: 'd3',
      name: 'Smart Deadbolt',
      zone: { name: 'entrance' },
      hasCapability: (c) => c === 'locked',
      getCapabilityValue: async () => true,
      setCapabilityValue: async () => {},
    };
    const { sys } = createSystem([dev]);
    await sys.discoverLocks();
    assertEqual(sys.locks.size, 1);
  });

  it('ignores non-lock devices', async () => {
    const dev = {
      id: 'x',
      name: 'Kitchen Light',
      zone: { name: 'kitchen' },
      hasCapability: () => false,
      getCapabilityValue: async () => null,
      setCapabilityValue: async () => {},
    };
    const { sys } = createSystem([dev]);
    await sys.discoverLocks();
    assertEqual(sys.locks.size, 0);
  });
});

describe('SmartLockManagementSystem — Access Codes', () => {
  it('adds a permanent access code', async () => {
    const { sys } = createSystemWithLocks();
    const result = await sys.addAccessCode('1111', { name: 'Family', type: 'permanent' });
    assertEqual(result.name, 'Family');
    assertEqual(result.type, 'permanent');
    assertEqual(result.enabled, true);
    assert(sys.accessCodes.has('1111'));
  });

  it('adds a temporary access code with expiry', async () => {
    const { sys } = createSystemWithLocks();
    const future = Date.now() + 3600000;
    const result = await sys.addAccessCode('2222', { name: 'Guest', type: 'temporary', expiresAt: future });
    assertEqual(result.type, 'temporary');
    assertEqual(result.expiresAt, future);
  });

  it('removes an access code', async () => {
    const { sys } = createSystemWithLocks();
    await sys.addAccessCode('3333', { name: 'Temp' });
    const removed = await sys.removeAccessCode('3333');
    assertEqual(removed, true);
    assertEqual(sys.accessCodes.has('3333'), false);
  });

  it('returns false when removing non-existent code', async () => {
    const { sys } = createSystemWithLocks();
    const removed = await sys.removeAccessCode('9999');
    assertEqual(removed, false);
  });

  it('defaults name to Unnamed and type to permanent', async () => {
    const { sys } = createSystemWithLocks();
    const result = await sys.addAccessCode('4444');
    assertEqual(result.name, 'Unnamed');
    assertEqual(result.type, 'permanent');
  });

  it('persists access codes to settings', async () => {
    const { sys, homey } = createSystemWithLocks();
    await sys.addAccessCode('5555', { name: 'Persisted' });
    const saved = homey.settings.get('accessCodes');
    assert(saved !== null, 'accessCodes should be persisted');
    assertEqual(saved['5555'].name, 'Persisted');
  });
});

describe('SmartLockManagementSystem — Code Validation', () => {
  it('validates a correct code', async () => {
    const { sys } = createSystemWithLocks();
    await sys.addAccessCode('1234', { name: 'Valid' });
    const result = await sys.validateAndUseCode('1234', 'lock-1');
    assertEqual(result.valid, true);
    assertEqual(result.codeName, 'Valid');
  });

  it('rejects unknown code', async () => {
    const { sys } = createSystemWithLocks();
    const result = await sys.validateAndUseCode('0000', 'lock-1');
    assertEqual(result.valid, false);
    assertEqual(result.reason, 'code_not_found');
  });

  it('rejects disabled code', async () => {
    const { sys } = createSystemWithLocks();
    await sys.addAccessCode('1111', { name: 'Off', enabled: false });
    const result = await sys.validateAndUseCode('1111', 'lock-1');
    assertEqual(result.valid, false);
    assertEqual(result.reason, 'code_disabled');
  });

  it('rejects expired code', async () => {
    const { sys } = createSystemWithLocks();
    await sys.addAccessCode('2222', { name: 'Expired', expiresAt: Date.now() - 1000 });
    const result = await sys.validateAndUseCode('2222', 'lock-1');
    assertEqual(result.valid, false);
    assertEqual(result.reason, 'code_expired');
    // Code should also be auto-disabled
    assertEqual(sys.accessCodes.get('2222').enabled, false);
  });

  it('rejects code not allowed for lock', async () => {
    const { sys } = createSystemWithLocks();
    await sys.addAccessCode('3333', { name: 'Restricted', allowedLocks: ['lock-2'] });
    const result = await sys.validateAndUseCode('3333', 'lock-1');
    assertEqual(result.valid, false);
    assertEqual(result.reason, 'lock_not_allowed');
  });

  it('decrements usesRemaining and disables at zero', async () => {
    const { sys } = createSystemWithLocks();
    await sys.addAccessCode('4444', { name: 'Single Use', maxUses: 1 });

    const first = await sys.validateAndUseCode('4444', 'lock-1');
    assertEqual(first.valid, true);

    const second = await sys.validateAndUseCode('4444', 'lock-1');
    assertEqual(second.valid, false);
    assertEqual(second.reason, 'max_uses_reached');
  });
});

describe('SmartLockManagementSystem — Temporary Codes', () => {
  it('creates a temporary code with defaults', async () => {
    const { sys } = createSystemWithLocks();
    const code = await sys.createTemporaryCode({});
    assertType(code.code, 'string');
    assertEqual(code.name, 'Temporary Access');
    assert(code.expiresAt > Date.now(), 'should expire in the future');
    assertEqual(code.type, 'temporary');
    assertEqual(code.enabled, true);
    assert(sys.accessCodes.has(code.code));
  });

  it('creates code with custom duration', async () => {
    const { sys } = createSystemWithLocks();
    const before = Date.now();
    const code = await sys.createTemporaryCode({ durationHours: 2 });
    const expected = before + 2 * 3600000;
    // Allow 1s tolerance
    assert(code.expiresAt >= expected - 1000 && code.expiresAt <= expected + 1000,
      'expiresAt should be ~2h from now');
  });

  it('creates code with explicit expiresAt overriding durationHours', async () => {
    const { sys } = createSystemWithLocks();
    const target = Date.now() + 10 * 60 * 1000;
    const code = await sys.createTemporaryCode({ expiresAt: target, durationHours: 48 });
    assertEqual(code.expiresAt, target);
  });

  it('creates code with use limit', async () => {
    const { sys } = createSystemWithLocks();
    const code = await sys.createTemporaryCode({ maxUses: 3 });
    assertEqual(code.maxUses, 3);
    assertEqual(code.usesRemaining, 3);
  });

  it('creates code restricted to specific locks', async () => {
    const { sys } = createSystemWithLocks();
    const code = await sys.createTemporaryCode({ allowedLocks: ['lock-1'] });
    assertDeepEqual(code.allowedLocks, ['lock-1']);
  });

  it('uses custom code string when provided', async () => {
    const { sys } = createSystemWithLocks();
    const code = await sys.createTemporaryCode({ code: '999888' });
    assertEqual(code.code, '999888');
    assert(sys.accessCodes.has('999888'));
  });
});

describe('SmartLockManagementSystem — Random Code Generation', () => {
  it('generates a 6-digit code by default', () => {
    const { sys } = createSystem();
    const code = sys.generateRandomCode();
    assertEqual(code.length, 6);
    assert(/^\d{6}$/.test(code), 'should be all digits');
  });

  it('generates a code of specified length', () => {
    const { sys } = createSystem();
    const code = sys.generateRandomCode(8);
    assertEqual(code.length, 8);
    assert(/^\d{8}$/.test(code), 'should be all digits');
  });
});

describe('SmartLockManagementSystem — Lock / Unlock', () => {
  it('locks a door and updates state', async () => {
    const { sys } = createSystemWithLocks();
    // Pre-unlock it
    sys.locks.get('lock-1').locked = false;

    const result = await sys.lockDoor('lock-1', 'test');
    assertEqual(result.success, true);
    assertEqual(sys.locks.get('lock-1').locked, true);
  });

  it('throws when locking unknown lock', async () => {
    const { sys } = createSystemWithLocks();
    let threw = false;
    try {
      await sys.lockDoor('nonexistent');
    } catch (e) {
      threw = true;
      assert(e.message.includes('Lock not found'));
    }
    assert(threw, 'should have thrown');
  });

  it('unlocks a door and updates state', async () => {
    const { sys } = createSystemWithLocks();
    const result = await sys.unlockDoor('lock-1', null, null, 'test');
    assertEqual(result.success, true);
    assertEqual(sys.locks.get('lock-1').locked, false);
    assert(sys.locks.get('lock-1').lastAccess !== null);
  });

  it('throws when unlocking unknown lock', async () => {
    const { sys } = createSystemWithLocks();
    let threw = false;
    try {
      await sys.unlockDoor('nonexistent');
    } catch (_e) {
      threw = true;
    }
    assert(threw, 'should have thrown for unknown lock');
  });

  it('validates access code during unlock', async () => {
    const { sys } = createSystemWithLocks();
    await sys.addAccessCode('1234', { name: 'Test' });
    const result = await sys.unlockDoor('lock-1', '1234', null, 'code');
    assertEqual(result.success, true);
  });

  it('rejects invalid access code during unlock', async () => {
    const { sys } = createSystemWithLocks();
    let threw = false;
    try {
      await sys.unlockDoor('lock-1', 'wrong', null, 'code');
    } catch (e) {
      threw = true;
      assert(e.message.includes('Invalid access'));
    }
    assert(threw, 'should reject invalid code');
  });

  it('records access log entries on lock/unlock', async () => {
    const { sys } = createSystemWithLocks();
    sys.locks.get('lock-1').locked = false;
    await sys.lockDoor('lock-1', 'test');
    await sys.unlockDoor('lock-2', null, null, 'manual');

    const log = sys.getAccessLog();
    assert(log.length >= 2, 'should have at least 2 log entries');

    const lockEntry = log.find(e => e.lockId === 'lock-1' && e.action === 'lock');
    assert(lockEntry, 'should have lock entry');
    assertEqual(lockEntry.triggeredBy, 'test');

    const unlockEntry = log.find(e => e.lockId === 'lock-2' && e.action === 'unlock');
    assert(unlockEntry, 'should have unlock entry');
  });

  it('locks all doors', async () => {
    const { sys } = createSystemWithLocks();
    sys.locks.get('lock-1').locked = false;
    sys.locks.get('lock-2').locked = false;

    const results = await sys.lockAllDoors('security');
    assertEqual(results.length, 2);
    assert(results.every(r => r.success), 'all should succeed');
    assertEqual(sys.locks.get('lock-1').locked, true);
    assertEqual(sys.locks.get('lock-2').locked, true);
  });

  it('rejects unlock when user schedule is restricted', async () => {
    const { sys } = createSystemWithLocks();
    // Set a schedule that only allows access on day 99 (never)
    await sys.setAccessSchedule('user-1', {
      allowedDays: [], // No days allowed
      startTime: '00:00',
      endTime: '23:59',
    });

    let threw = false;
    try {
      await sys.unlockDoor('lock-1', null, 'user-1', 'test');
    } catch (e) {
      threw = true;
      assert(e.message.includes('Access not allowed'));
    }
    assert(threw, 'should reject restricted user');
  });

  it('rejects unlock when temporary access is expired', async () => {
    const { sys } = createSystemWithLocks();
    // Set expired temporary access
    sys.temporaryAccess.set('user-2', {
      userId: 'user-2',
      grantedAt: Date.now() - 48 * 3600000,
      expiresAt: Date.now() - 1000,
      allowedLocks: null,
    });

    let threw = false;
    try {
      await sys.unlockDoor('lock-1', null, 'user-2', 'test');
    } catch (e) {
      threw = true;
      assert(e.message.includes('expired'));
    }
    assert(threw, 'should reject expired temp access');
  });
});

describe('SmartLockManagementSystem — Auto-Lock', () => {
  it('setAutoLockDelay updates lock config', () => {
    const { sys } = createSystemWithLocks();
    const result = sys.setAutoLockDelay('lock-1', 60000);
    assertEqual(result.lockId, 'lock-1');
    assertEqual(result.autoLockDelayMs, 60000);
    assertEqual(sys.locks.get('lock-1').autoLockDelayMs, 60000);
  });

  it('setAutoLockDelay returns null for unknown lock', () => {
    const { sys } = createSystemWithLocks();
    const result = sys.setAutoLockDelay('nope', 10000);
    assertEqual(result, null);
  });
});

describe('SmartLockManagementSystem — Key Management', () => {
  it('registers a physical key', async () => {
    const { sys, homey } = createSystemWithLocks();
    const key = await sys.registerKey('key-1', {
      type: 'physical',
      assignedTo: 'Alice',
      label: 'Main Key',
    });
    assertEqual(key.keyId, 'key-1');
    assertEqual(key.type, 'physical');
    assertEqual(key.assignedTo, 'Alice');
    assertEqual(key.active, true);
    assert(sys.keyRegistry.has('key-1'));

    // Persists
    const saved = homey.settings.get('keyRegistry');
    assert(saved['key-1'], 'key should be persisted');
  });

  it('registers a digital key with defaults', async () => {
    const { sys } = createSystemWithLocks();
    const key = await sys.registerKey('dkey-1', {});
    assertEqual(key.type, 'physical'); // default
    assertEqual(key.assignedTo, 'unassigned');
    assertEqual(key.label, 'dkey-1'); // defaults to keyId
  });

  it('revokes a key', async () => {
    const { sys } = createSystemWithLocks();
    await sys.registerKey('key-2', { assignedTo: 'Bob' });
    const revoked = await sys.revokeKey('key-2', 'lost');
    assertEqual(revoked.active, false);
    assertEqual(revoked.revokeReason, 'lost');
    assert(revoked.revokedAt > 0);
  });

  it('returns null when revoking non-existent key', async () => {
    const { sys } = createSystemWithLocks();
    const result = await sys.revokeKey('no-such-key');
    assertEqual(result, null);
  });

  it('getKeyInventory categorises keys', async () => {
    const { sys } = createSystemWithLocks();
    await sys.registerKey('phys-1', { type: 'physical', assignedTo: 'A' });
    await sys.registerKey('digi-1', { type: 'digital', assignedTo: 'B' });
    await sys.registerKey('phys-2', { type: 'physical', assignedTo: 'C' });

    const inv = sys.getKeyInventory();
    assertEqual(inv.physical.length, 2);
    assertEqual(inv.digital.length, 1);
    assertEqual(inv.totalActive, 3);
  });

  it('getKeyInventory counts active correctly after revoke', async () => {
    const { sys } = createSystemWithLocks();
    await sys.registerKey('k1', { type: 'physical' });
    await sys.registerKey('k2', { type: 'digital' });
    await sys.revokeKey('k1', 'stolen');

    const inv = sys.getKeyInventory();
    assertEqual(inv.totalActive, 1);
  });
});

describe('SmartLockManagementSystem — Usage Analytics', () => {
  it('recordUsageEvent increments counters', () => {
    const { sys } = createSystemWithLocks();
    sys.recordUsageEvent('lock-1', 'unlock');
    sys.recordUsageEvent('lock-1', 'lock');
    sys.recordUsageEvent('lock-2', 'unlock');

    assertEqual(sys.usageAnalytics.doorUsageCounts.get('lock-1'), 2);
    assertEqual(sys.usageAnalytics.doorUsageCounts.get('lock-2'), 1);

    const hourlyTotal = sys.usageAnalytics.hourlyUsage.reduce((a, b) => a + b, 0);
    assertEqual(hourlyTotal, 3);
  });

  it('getUsageAnalytics returns structured report', () => {
    const { sys } = createSystemWithLocks();
    sys.recordUsageEvent('lock-1', 'unlock');
    sys.recordUsageEvent('lock-1', 'lock');

    const analytics = sys.getUsageAnalytics();
    assertEqual(analytics.mostUsedDoor.id, 'lock-1');
    assertEqual(analytics.mostUsedDoor.name, 'Front Door Lock');
    assertEqual(analytics.mostUsedDoor.count, 2);
    assertEqual(analytics.hourlyDistribution.length, 24);
    assertEqual(analytics.dailyDistribution.length, 7);
    assertType(analytics.busiestHour, 'string');
    assertType(analytics.busiestDay, 'string');
  });
});

describe('SmartLockManagementSystem — Tamper Detection', () => {
  it('handleTamperEvent records event', async () => {
    const { sys } = createSystemWithLocks();
    const lock = sys.locks.get('lock-1');
    await sys.handleTamperEvent(lock, 'physical_tamper');

    assertEqual(sys.tamperEvents.length, 1);
    assertEqual(sys.tamperEvents[0].lockId, 'lock-1');
    assertEqual(sys.tamperEvents[0].type, 'physical_tamper');
    assert(sys.tamperEvents[0].timestamp > 0);
  });

  it('handleTamperEvent notifies security system when enabled', async () => {
    let securityNotified = false;
    const { sys, homey } = createSystemWithLocks();
    homey.app.advancedSecuritySystem = {
      handleIntrusionEvent: async () => { securityNotified = true; },
    };

    sys.securityIntegrationEnabled = true;
    const lock = sys.locks.get('lock-1');
    await sys.handleTamperEvent(lock, 'physical_tamper');
    assertEqual(securityNotified, true);
  });
});

describe('SmartLockManagementSystem — Emergency Unlock', () => {
  it('unlocks all locks', async () => {
    const { sys } = createSystemWithLocks();
    assertEqual(sys.locks.get('lock-1').locked, true);
    assertEqual(sys.locks.get('lock-2').locked, true);

    const result = await sys.emergencyUnlockAll('fire_alarm', 'fire');
    assertEqual(result.success, true);
    assertEqual(result.results.length, 2);
    assert(result.results.every(r => r.success));
    assertEqual(sys.locks.get('lock-1').locked, false);
    assertEqual(sys.locks.get('lock-2').locked, false);
  });

  it('records emergency log entry', async () => {
    const { sys } = createSystemWithLocks();
    await sys.emergencyUnlockAll('admin', 'drill');
    assertEqual(sys.emergencyLog.length, 1);
    assertEqual(sys.emergencyLog[0].triggeredBy, 'admin');
    assertEqual(sys.emergencyLog[0].reason, 'drill');
  });

  it('records access log entry for emergency', async () => {
    const { sys } = createSystemWithLocks();
    await sys.emergencyUnlockAll('tester', 'test');
    const entry = sys.accessLog.find(e => e.action === 'emergency_unlock');
    assert(entry, 'should have emergency_unlock log entry');
    assertEqual(entry.lockId, 'ALL');
    assertEqual(entry.triggeredBy, 'tester');
  });

  it('returns failure when emergency unlock is disabled', async () => {
    const { sys } = createSystemWithLocks();
    sys.emergencyUnlockEnabled = false;
    const result = await sys.emergencyUnlockAll();
    assertEqual(result.success, false);
    assertEqual(result.reason, 'disabled');
  });
});

describe('SmartLockManagementSystem — Battery Monitoring', () => {
  it('getBatteryReport returns lock battery statuses', () => {
    const { sys } = createSystemWithLocks();
    sys.locks.get('lock-1').batteryLevel = 85;
    sys.locks.get('lock-2').batteryLevel = 15;

    const report = sys.getBatteryReport();
    assertEqual(report.length, 2);

    const healthy = report.find(r => r.lockId === 'lock-1');
    assertEqual(healthy.status, 'healthy');
    assertEqual(healthy.batteryLevel, 85);

    const low = report.find(r => r.lockId === 'lock-2');
    assertEqual(low.status, 'low');
  });

  it('marks unknown when battery is null', () => {
    const { sys } = createSystemWithLocks();
    // Default batteryLevel is null
    const report = sys.getBatteryReport();
    assert(report.every(r => r.status === 'unknown'));
  });

  it('marks critical when below threshold', () => {
    const { sys } = createSystemWithLocks();
    sys.locks.get('lock-1').batteryLevel = 5;
    const report = sys.getBatteryReport();
    const item = report.find(r => r.lockId === 'lock-1');
    assertEqual(item.status, 'critical');
  });
});

describe('SmartLockManagementSystem — Sync Groups', () => {
  it('creates a sync group with valid locks', async () => {
    const { sys } = createSystemWithLocks();
    const group = await sys.createSyncGroup('front-back', ['lock-1', 'lock-2']);
    assertEqual(group.name, 'front-back');
    assertEqual(group.lockIds.length, 2);
    assertEqual(group.enabled, true);
    assertEqual(sys.syncGroupsEnabled, true);
    assert(sys.syncGroups.has('front-back'));
  });

  it('filters out invalid lock IDs', async () => {
    const { sys } = createSystemWithLocks();
    const group = await sys.createSyncGroup('mixed', ['lock-1', 'fake-3', 'lock-2']);
    assertEqual(group.lockIds.length, 2);
    assert(!group.lockIds.includes('fake-3'));
  });

  it('throws when fewer than 2 valid locks', async () => {
    const { sys } = createSystemWithLocks();
    let threw = false;
    try {
      await sys.createSyncGroup('solo', ['lock-1', 'fake']);
    } catch (e) {
      threw = true;
      assert(e.message.includes('at least 2'));
    }
    assert(threw, 'should throw for insufficient valid locks');
  });

  it('persists sync groups to settings', async () => {
    const { sys, homey } = createSystemWithLocks();
    await sys.createSyncGroup('pair', ['lock-1', 'lock-2']);
    const saved = homey.settings.get('lockSyncGroups');
    assert(saved['pair'], 'sync group should be persisted');
  });
});

describe('SmartLockManagementSystem — Access Schedules', () => {
  it('sets an access schedule', async () => {
    const { sys, homey } = createSystemWithLocks();
    const schedule = await sys.setAccessSchedule('cleaner', {
      name: 'Cleaner',
      allowedDays: [1, 2, 3, 4, 5],
      startTime: '08:00',
      endTime: '17:00',
    });
    assertEqual(schedule.userId, 'cleaner');
    assertEqual(schedule.name, 'Cleaner');
    assertDeepEqual(schedule.allowedDays, [1, 2, 3, 4, 5]);
    assertEqual(schedule.allowedStartTime, '08:00');
    assertEqual(schedule.allowedEndTime, '17:00');
    assertEqual(schedule.active, true);

    // Persisted
    const saved = homey.settings.get('accessSchedules');
    assert(saved['cleaner'], 'schedule should be persisted');
  });

  it('defaults to all days and full time range', async () => {
    const { sys } = createSystemWithLocks();
    const schedule = await sys.setAccessSchedule('guest', {});
    assertDeepEqual(schedule.allowedDays, [0, 1, 2, 3, 4, 5, 6]);
    assertEqual(schedule.allowedStartTime, '00:00');
    assertEqual(schedule.allowedEndTime, '23:59');
  });

  it('isAccessAllowed returns true when no schedule exists', () => {
    const { sys } = createSystemWithLocks();
    assertEqual(sys.isAccessAllowed('random-user'), true);
  });

  it('isAccessAllowed respects day restrictions', async () => {
    const { sys } = createSystemWithLocks();
    const today = new Date().getDay();
    const otherDay = (today + 1) % 7;

    // Allow only a different day — should be denied today
    await sys.setAccessSchedule('restricted', {
      allowedDays: [otherDay],
      startTime: '00:00',
      endTime: '23:59',
    });

    assertEqual(sys.isAccessAllowed('restricted'), false);
  });

  it('isAccessAllowed respects lock restrictions', async () => {
    const { sys } = createSystemWithLocks();
    await sys.setAccessSchedule('lock-restricted', {
      allowedLocks: ['lock-2'],
    });

    // lock-1 should be denied; lock-2 allowed
    assertEqual(sys.isAccessAllowed('lock-restricted', 'lock-1'), false);
    assertEqual(sys.isAccessAllowed('lock-restricted', 'lock-2'), true);
  });
});

describe('SmartLockManagementSystem — Temporary Access', () => {
  it('grants temporary access', async () => {
    const { sys } = createSystemWithLocks();
    const access = await sys.grantTemporaryAccess('visitor-1', 8);
    assertEqual(access.userId, 'visitor-1');
    assert(access.expiresAt > Date.now());
    assert(sys.temporaryAccess.has('visitor-1'));
  });

  it('defaults to 24 hours', async () => {
    const { sys } = createSystemWithLocks();
    const before = Date.now();
    const access = await sys.grantTemporaryAccess('visitor-2');
    const expected = before + 24 * 3600000;
    assert(access.expiresAt >= expected - 1000 && access.expiresAt <= expected + 1000);
  });

  it('supports lock restrictions', async () => {
    const { sys } = createSystemWithLocks();
    const access = await sys.grantTemporaryAccess('visitor-3', 2, ['lock-1']);
    assertDeepEqual(access.allowedLocks, ['lock-1']);
  });
});

describe('SmartLockManagementSystem — Security Integration', () => {
  it('onSecurityModeChange locks all doors on armed_away', async () => {
    const { sys } = createSystemWithLocks();
    sys.locks.get('lock-1').locked = false;
    sys.locks.get('lock-2').locked = false;

    await sys.onSecurityModeChange('armed_away');
    assertEqual(sys.locks.get('lock-1').locked, true);
    assertEqual(sys.locks.get('lock-2').locked, true);
  });

  it('onSecurityModeChange locks all doors on armed_night', async () => {
    const { sys } = createSystemWithLocks();
    sys.locks.get('lock-1').locked = false;

    await sys.onSecurityModeChange('armed_night');
    assertEqual(sys.locks.get('lock-1').locked, true);
  });

  it('does nothing when security integration is disabled', async () => {
    const { sys } = createSystemWithLocks();
    sys.securityIntegrationEnabled = false;
    sys.locks.get('lock-1').locked = false;

    await sys.onSecurityModeChange('armed_away');
    assertEqual(sys.locks.get('lock-1').locked, false);
  });
});

describe('SmartLockManagementSystem — Statistics', () => {
  it('returns comprehensive statistics', async () => {
    const { sys } = createSystemWithLocks();
    await sys.addAccessCode('1111', { name: 'Test' });
    await sys.registerKey('k1', { type: 'physical' });
    await sys.setAccessSchedule('u1', {});

    const stats = sys.getStatistics();
    assertEqual(stats.totalLocks, 2);
    assertEqual(stats.accessCodes, 1);
    assertEqual(stats.keysRegistered, 1);
    assertEqual(stats.accessSchedules, 1);
    assertEqual(stats.autoLockEnabled, true);
    assertEqual(stats.autoLockDelay, 300); // 300000ms / 1000 = 300s
    assertEqual(stats.tamperEvents, 0);
    assertEqual(stats.emergencyEvents, 0);
    assertEqual(stats.syncGroupsEnabled, false);
    assertEqual(stats.syncGroups, 0);
    assertEqual(stats.lockBehindMeEnabled, false);
    assertType(stats.busiestHour, 'string');
    assert(Array.isArray(stats.batteryStatus));
    assertEqual(stats.batteryStatus.length, 2);
  });
});

describe('SmartLockManagementSystem — Cleanup', () => {
  it('destroy clears monitoring interval', async () => {
    const { sys } = createSystemWithLocks();
    // Start monitoring so interval exists
    await sys.startMonitoring();
    assert(sys.monitoringInterval !== null, 'interval should be set');

    sys.destroy();
    assertEqual(sys.monitoringInterval, null);
  });

  it('destroy is safe when no interval exists', () => {
    const { sys } = createSystem();
    sys.destroy(); // Should not throw
    assertEqual(sys.monitoringInterval, undefined);
  });
});

describe('SmartLockManagementSystem — Failed Access Logging', () => {
  it('logFailedAccess records to access log', async () => {
    const { sys } = createSystemWithLocks();
    await sys.logFailedAccess('lock-1', 'bad_code', 'intruder');

    const entry = sys.accessLog.find(e => e.action === 'failed_unlock');
    assert(entry, 'should have failed_unlock entry');
    assertEqual(entry.lockId, 'lock-1');
    assertEqual(entry.reason, 'bad_code');
    assertEqual(entry.userId, 'intruder');
  });

  it('handles unknown lock gracefully', async () => {
    const { sys } = createSystemWithLocks();
    await sys.logFailedAccess('unknown-lock', 'test');
    const entry = sys.accessLog.find(e => e.lockId === 'unknown-lock');
    assert(entry);
    assertEqual(entry.lockName, 'unknown');
  });
});

describe('SmartLockManagementSystem — Access Log', () => {
  it('getAccessLog returns limited entries', async () => {
    const { sys } = createSystemWithLocks();
    // Add 60 entries
    for (let i = 0; i < 60; i++) {
      sys.accessLog.push({ lockId: 'lock-1', action: 'lock', timestamp: Date.now() + i });
    }

    const log = sys.getAccessLog(10);
    assertEqual(log.length, 10);
  });

  it('getAccessLog defaults to 50', () => {
    const { sys } = createSystemWithLocks();
    for (let i = 0; i < 100; i++) {
      sys.accessLog.push({ lockId: 'lock-1', action: 'lock', timestamp: Date.now() + i });
    }
    const log = sys.getAccessLog();
    assertEqual(log.length, 50);
  });
});

run();
