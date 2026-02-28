'use strict';

const { describe, it, run } = require('./helpers/runner');
const {
  assert, assertEqual, assertNotEqual, assertDeepEqual,
  assertType, assertThrows, assertRejects
} = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');

const AdvancedSecuritySystem = require('../lib/AdvancedSecuritySystem');

// ── helpers ────────────────────────────────────────────────────────────

function createSystem() {
  const homey = createMockHomey();
  homey.drivers = {
    getDevices: () => []
  };
  const sys = new AdvancedSecuritySystem(homey);
  return sys;
}

function createSystemWithDevices() {
  const homey = createMockHomey();
  const devices = [
    {
      id: 'motion-1', name: 'Hall Motion Sensor',
      capabilities: ['alarm_motion', 'measure_battery'],
      hasCapability: (c) => ['alarm_motion', 'measure_battery'].includes(c),
      getCapabilityValue: async (c) => c === 'alarm_motion' ? false : 80,
      setCapabilityValue: async () => {}
    },
    {
      id: 'door-1', name: 'Front Door Sensor',
      capabilities: ['alarm_contact'],
      hasCapability: (c) => c === 'alarm_contact',
      getCapabilityValue: async () => false,
      setCapabilityValue: async () => {}
    },
    {
      id: 'lock-1', name: 'Front Door Lock',
      capabilities: ['locked'],
      hasCapability: (c) => c === 'locked',
      getCapabilityValue: async () => true,
      setCapabilityValue: async () => {}
    },
    {
      id: 'cam-1', name: 'Security Camera Outdoor',
      capabilities: ['onoff'],
      hasCapability: (c) => c === 'onoff',
      getCapabilityValue: async () => true,
      setCapabilityValue: async () => {}
    }
  ];
  homey.drivers = { getDevices: () => devices };
  const sys = new AdvancedSecuritySystem(homey);
  return sys;
}

// ── calculateDistance (Haversine) ───────────────────────────────────────

describe('AdvancedSecuritySystem — calculateDistance', () => {
  it('returns 0 for identical coordinates', () => {
    const sys = createSystem();
    const d = sys.calculateDistance(59.3293, 18.0686, 59.3293, 18.0686);
    assertEqual(d, 0);
  });

  it('returns correct distance for known cities', () => {
    const sys = createSystem();
    // Stockholm → Gothenburg ≈ ~400 km
    const d = sys.calculateDistance(59.3293, 18.0686, 57.7089, 11.9746);
    assert(d > 350000 && d < 500000, `distance should be ~400km, got ${d}`);
  });

  it('handles antipodal points', () => {
    const sys = createSystem();
    // North pole to south pole ≈ ~20000 km
    const d = sys.calculateDistance(90, 0, -90, 0);
    assert(d > 19000000 && d < 21000000, `expected ~20000km, got ${d}`);
  });
});

// ── Zone management ────────────────────────────────────────────────────
// Zones stored in this.zones (Map), NOT this.securityZones

describe('AdvancedSecuritySystem — zones', () => {
  it('armZone sets a zone to armed', async () => {
    const sys = createSystem();
    // Set up a zone first — use sys.zones (the actual Map)
    sys.zones.set('zone-1', {
      id: 'zone-1', name: 'Perimeter', armed: false, devices: [], alerts: []
    });
    await sys.armZone('zone-1', 'user-1');
    const zone = sys.zones.get('zone-1');
    assertEqual(zone.armed, true);
  });

  it('disarmZone sets a zone to disarmed', async () => {
    const sys = createSystem();
    sys.zones.set('zone-1', {
      id: 'zone-1', name: 'Perimeter', armed: true, devices: [], alerts: []
    });
    await sys.disarmZone('zone-1', 'user-1');
    const zone = sys.zones.get('zone-1');
    assertEqual(zone.armed, false);
  });

  it('armZone throws for non-existent zone', async () => {
    const sys = createSystem();
    await assertRejects(async () => {
      await sys.armZone('zone-nonexistent', 'user-1');
    });
  });

  it('disarmZone throws for non-existent zone', async () => {
    const sys = createSystem();
    await assertRejects(async () => {
      await sys.disarmZone('zone-nonexistent', 'user-1');
    });
  });

  it('getZoneStatus returns all zone statuses', () => {
    const sys = createSystem();
    sys.zones.set('z1', { id: 'z1', name: 'A', armed: true, devices: [], alerts: [] });
    sys.zones.set('z2', { id: 'z2', name: 'B', armed: false, devices: [], alerts: [] });
    const status = sys.getZoneStatus();
    assertType(status, 'object');
    assertEqual(Object.keys(status).length, 2);
  });
});

// ── Timeline events ────────────────────────────────────────────────────

describe('AdvancedSecuritySystem — timeline', () => {
  it('addTimelineEvent creates an event with id and timestamp', () => {
    const sys = createSystem();
    const event = sys.addTimelineEvent({ type: 'motion', zone: 'hall' });
    assertType(event.id, 'string');
    assertType(event.timestamp, 'number');
    assertEqual(event.type, 'motion');
  });

  it('timeline caps at 1000 events', () => {
    const sys = createSystem();
    for (let i = 0; i < 1100; i++) {
      sys.addTimelineEvent({ type: 'test', index: i });
    }
    assert(sys.eventTimeline.length <= 1000, `should cap at 1000, got ${sys.eventTimeline.length}`);
  });

  it('linkEvidence attaches evidence to an event', () => {
    const sys = createSystem();
    const event = sys.addTimelineEvent({ type: 'intrusion' });
    sys.linkEvidence(event.id, { type: 'recording', cameraId: 'cam-1' });
    const found = sys.eventTimeline.find(e => e.id === event.id);
    assert(found.evidenceIds.length === 1, 'should have one evidence entry');
  });

  it('getEventTimeline returns limited results', () => {
    const sys = createSystem();
    for (let i = 0; i < 20; i++) {
      sys.addTimelineEvent({ type: 'test', index: i });
    }
    const result = sys.getEventTimeline(5);
    assertEqual(result.length, 5);
  });

  it('getEventTimeline filters by type', () => {
    const sys = createSystem();
    sys.addTimelineEvent({ type: 'motion' });
    sys.addTimelineEvent({ type: 'door' });
    sys.addTimelineEvent({ type: 'motion' });
    const result = sys.getEventTimeline(10, { type: 'motion' });
    assertEqual(result.length, 2);
  });
});

// ── Visitor access ─────────────────────────────────────────────────────

describe('AdvancedSecuritySystem — visitor access', () => {
  it('scheduleVisitorAccess grants temporary access', async () => {
    const sys = createSystem();
    const schedule = {
      name: 'Cleaner',
      allowedDays: [0, 1, 2, 3, 4, 5, 6],
      startTime: '00:00',
      endTime: '23:59',
      startDate: Date.now() - 1000,
      endDate: Date.now() + 3600000
    };
    await sys.scheduleVisitorAccess('visitor-1', schedule);
    // Must call checkVisitorSchedules to set currentlyAllowed flag
    await sys.checkVisitorSchedules();
    const allowed = sys.isVisitorAllowed('visitor-1');
    assertEqual(allowed, true);
  });

  it('isVisitorAllowed rejects unknown visitor', () => {
    const sys = createSystem();
    const allowed = sys.isVisitorAllowed('unknown-visitor');
    // Returns undefined for unknown visitors (falsy, not strict false)
    assert(!allowed, 'unknown visitor should not be allowed');
  });

  it('isVisitorAllowed rejects expired access', async () => {
    const sys = createSystem();
    const schedule = {
      name: 'Old Visitor',
      allowedDays: [0, 1, 2, 3, 4, 5, 6],
      startTime: '00:00',
      endTime: '23:59',
      startDate: Date.now() - 7200000,
      endDate: Date.now() - 3600000 // expired 1 hour ago
    };
    await sys.scheduleVisitorAccess('visitor-2', schedule);
    await sys.checkVisitorSchedules();
    const allowed = sys.isVisitorAllowed('visitor-2');
    assert(!allowed, 'expired visitor should not be allowed');
  });

  it('revokeVisitorAccess removes a visitor', async () => {
    const sys = createSystem();
    await sys.scheduleVisitorAccess('visitor-3', {
      name: 'Temp',
      allowedDays: [0, 1, 2, 3, 4, 5, 6],
      startTime: '00:00',
      endTime: '23:59',
      startDate: Date.now() - 1000,
      endDate: Date.now() + 3600000
    });
    await sys.revokeVisitorAccess('visitor-3');
    const allowed = sys.isVisitorAllowed('visitor-3');
    assert(!allowed, 'revoked visitor should not be allowed');
  });
});

// ── Audit trail ────────────────────────────────────────────────────────

describe('AdvancedSecuritySystem — audit trail', () => {
  it('addAuditEntry creates an entry with action and userId', () => {
    const sys = createSystem();
    const entry = sys.addAuditEntry('zone_arm', 'user-1', { zone: 'perimeter' });
    assertType(entry.id, 'string');
    assertEqual(entry.action, 'zone_arm');
    assertEqual(entry.userId, 'user-1');
    assertType(entry.timestamp, 'number');
  });

  it('audit trail caps at 1000 entries (trims to 800)', () => {
    const sys = createSystem();
    for (let i = 0; i < 1100; i++) {
      sys.addAuditEntry('test', 'sys', { i });
    }
    assert(sys.auditTrail.length <= 1000, `expected <= 1000, got ${sys.auditTrail.length}`);
  });

  it('getAuditTrail filters by action', () => {
    const sys = createSystem();
    sys.addAuditEntry('arm', 'user-1');
    sys.addAuditEntry('disarm', 'user-2');
    sys.addAuditEntry('arm', 'user-3');
    const result = sys.getAuditTrail(50, { action: 'arm' });
    assertEqual(result.length, 2);
  });

  it('getAuditTrail filters by userId', () => {
    const sys = createSystem();
    sys.addAuditEntry('act1', 'alice');
    sys.addAuditEntry('act2', 'bob');
    sys.addAuditEntry('act3', 'alice');
    const result = sys.getAuditTrail(50, { userId: 'alice' });
    assertEqual(result.length, 2);
  });

  it('getAuditTrail filters by since timestamp', () => {
    const sys = createSystem();
    const old = { id: 'a1', action: 'old', userId: 'x', details: {}, timestamp: Date.now() - 10000 };
    sys.auditTrail.push(old);
    sys.addAuditEntry('recent', 'y');
    const since = Date.now() - 5000;
    const result = sys.getAuditTrail(50, { since });
    assertEqual(result.length, 1);
    assertEqual(result[0].action, 'recent');
  });

  it('getAuditTrail respects limit', () => {
    const sys = createSystem();
    for (let i = 0; i < 10; i++) sys.addAuditEntry('act', 'u');
    const result = sys.getAuditTrail(3);
    assertEqual(result.length, 3);
  });
});

// ── Duress code ────────────────────────────────────────────────────────

describe('AdvancedSecuritySystem — duress codes', () => {
  it('addDuressCode registers a code', async () => {
    const sys = createSystem();
    await sys.addDuressCode('1234', { name: 'Test Duress' });
    assert(sys.duressCodes.has('1234'), 'should have the code');
  });

  it('checkDuressCode returns true for registered code', async () => {
    const sys = createSystem();
    await sys.addDuressCode('5678');
    const result = await sys.checkDuressCode('5678');
    assertEqual(result, true);
  });

  it('checkDuressCode returns false for unknown code', async () => {
    const sys = createSystem();
    const result = await sys.checkDuressCode('0000');
    assertEqual(result, false);
  });

  it('checkDuressCode adds an audit entry', async () => {
    const sys = createSystem();
    await sys.addDuressCode('9999');
    await sys.checkDuressCode('9999');
    const trail = sys.getAuditTrail(50, { action: 'duress_code_entered' });
    assertEqual(trail.length, 1);
  });
});

// ── Silent alarm ───────────────────────────────────────────────────────

describe('AdvancedSecuritySystem — silent alarm', () => {
  it('enableSilentAlarm activates silent mode', () => {
    const sys = createSystem();
    sys.enableSilentAlarm(['contact-1']);
    assertEqual(sys.silentAlarmMode, true);
    assertEqual(sys.silentAlarmContacts.length, 1);
  });

  it('disableSilentAlarm deactivates silent mode', () => {
    const sys = createSystem();
    sys.enableSilentAlarm();
    sys.disableSilentAlarm();
    assertEqual(sys.silentAlarmMode, false);
  });
});

// ── Escalation ─────────────────────────────────────────────────────────

describe('AdvancedSecuritySystem — escalation', () => {
  it('configureEscalation updates config', () => {
    const sys = createSystem();
    sys.configureEscalation({ warningDelaySec: 10, sirenDelaySec: 20, policeNotifyDelaySec: 60, enabled: true });
    assertEqual(sys.escalationConfig.warningDelaySec, 10);
    assertEqual(sys.escalationConfig.sirenDelaySec, 20);
  });

  it('cancelEscalation returns false for non-existent escalation', async () => {
    const sys = createSystem();
    const result = await sys.cancelEscalation('no-such-event');
    assertEqual(result, false);
  });

  it('cancelEscalation clears timers and adds audit entry', async () => {
    const sys = createSystem();
    // Manually insert an escalation to test cancellation
    const timer = setTimeout(() => {}, 60000);
    sys.activeEscalations.set('evt-1', {
      eventId: 'evt-1', event: {}, startedAt: Date.now(),
      stage: 'warning', timers: [timer], cancelled: false
    });
    const result = await sys.cancelEscalation('evt-1', 'user-1');
    assertEqual(result, true);
    assertEqual(sys.activeEscalations.size, 0);
    const trail = sys.getAuditTrail(50, { action: 'escalation_cancelled' });
    assertEqual(trail.length, 1);
  });
});

// ── Night vision ───────────────────────────────────────────────────────

describe('AdvancedSecuritySystem — night vision', () => {
  it('enableNightVision sets flag and creates audit entry', async () => {
    const sys = createSystem();
    await sys.enableNightVision();
    assertEqual(sys.nightVisionEnabled, true);
    const trail = sys.getAuditTrail(10, { action: 'night_vision_enabled' });
    assertEqual(trail.length, 1);
  });

  it('disableNightVision clears flag', async () => {
    const sys = createSystem();
    await sys.enableNightVision();
    await sys.disableNightVision();
    assertEqual(sys.nightVisionEnabled, false);
  });
});

// ── Security mode ──────────────────────────────────────────────────────

describe('AdvancedSecuritySystem — setSecurityMode', () => {
  it('changes the security mode', async () => {
    const sys = createSystem();
    await sys.setSecurityMode('armed_away', 'user-1', 'manual');
    assertEqual(sys.securityMode, 'armed_away');
  });

  it('creates an audit entry for mode change', async () => {
    const sys = createSystem();
    await sys.setSecurityMode('armed_home', 'user-1');
    const trail = sys.getAuditTrail(10, { action: 'mode_change' });
    assertEqual(trail.length, 1);
    assertEqual(trail[0].details.to, 'armed_home');
  });

  it('disarmed mode cancels active escalations', async () => {
    const sys = createSystem();
    const timer = setTimeout(() => {}, 60000);
    sys.activeEscalations.set('esc-1', {
      eventId: 'esc-1', event: {}, startedAt: Date.now(),
      stage: 'siren', timers: [timer], cancelled: false
    });
    await sys.setSecurityMode('disarmed', 'user-1');
    assertEqual(sys.activeEscalations.size, 0);
  });
});

// ── Geofence ───────────────────────────────────────────────────────────

describe('AdvancedSecuritySystem — geofence', () => {
  it('updateUserLocation tracks user position', async () => {
    const sys = createSystem();
    sys.geofenceConfig.enabled = true;
    sys.geofenceConfig.latitude = 59.3293;
    sys.geofenceConfig.longitude = 18.0686;
    sys.geofenceConfig.radiusMeters = 500;
    await sys.updateUserLocation('user-1', 59.3293, 18.0686);
    const loc = sys.geofenceConfig.userLocations.get('user-1');
    assertType(loc, 'object');
    assertEqual(loc.latitude, 59.3293);
  });

  it('areAllUsersAway returns true when no users tracked', () => {
    const sys = createSystem();
    const result = sys.areAllUsersAway();
    assertEqual(result, true);
  });

  it('areAllUsersAway returns false when user is inside geofence', async () => {
    const sys = createSystem();
    sys.geofenceConfig.enabled = true;
    sys.geofenceConfig.latitude = 59.3293;
    sys.geofenceConfig.longitude = 18.0686;
    sys.geofenceConfig.radiusMeters = 500;
    await sys.updateUserLocation('user-1', 59.3293, 18.0686); // same coords = 0m away
    const result = sys.areAllUsersAway();
    assertEqual(result, false);
  });
});

// ── Statistics ──────────────────────────────────────────────────────────

describe('AdvancedSecuritySystem — getStatistics', () => {
  it('returns a comprehensive status object', () => {
    const sys = createSystem();
    const stats = sys.getStatistics();
    assertType(stats, 'object');
    assertEqual(stats.mode, 'disarmed');
    assertType(stats.cameras, 'number');
    assertType(stats.panicMode, 'boolean');
    assertType(stats.sensorHealth, 'object');
  });
});

// ── Sensor health report ───────────────────────────────────────────────

describe('AdvancedSecuritySystem — getSensorHealthReport', () => {
  it('returns empty report when no sensors', () => {
    const sys = createSystem();
    const report = sys.getSensorHealthReport();
    assertEqual(report.healthy, 0);
    assertEqual(report.sensors.length, 0);
  });
});

// ── Destroy / cleanup ──────────────────────────────────────────────────

describe('AdvancedSecuritySystem — destroy', () => {
  it('clears intervals and escalation timers', () => {
    const sys = createSystem();
    sys.monitoringInterval = setInterval(() => {}, 60000);
    sys.healthCheckInterval = setInterval(() => {}, 60000);
    const timer = setTimeout(() => {}, 60000);
    sys.activeEscalations.set('e1', { timers: [timer], cancelled: false });

    sys.destroy();
    assertEqual(sys.monitoringInterval, null);
    assertEqual(sys.healthCheckInterval, null);
    assertEqual(sys.activeEscalations.size, 0);
  });
});

run();
