'use strict';

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertType, assertRejects: _assertRejects } = require('./helpers/assert');
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

const VisitorGuestManagementSystem = require('../lib/VisitorGuestManagementSystem');

describe('Visitor — constructor & lifecycle', () => {
  it('instantiates without errors', () => {
    const sys = new VisitorGuestManagementSystem(createMockHomey());
    assert(sys, 'should create instance');
    assertEqual(sys.guestProfiles.size, 0);
    assertEqual(sys._initialized, false);
    cleanup(sys);
  });

  it('initialize sets initialized flag', async () => {
    const sys = new VisitorGuestManagementSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys._initialized, true);
    cleanup(sys);
  });

  it('destroy clears timers', async () => {
    const sys = new VisitorGuestManagementSystem(createMockHomey());
    await sys.initialize();
    sys.destroy();
    cleanup(sys);
  });
});

describe('Visitor — guest profiles', () => {
  it('createGuestProfile creates a profile', async () => {
    const sys = new VisitorGuestManagementSystem(createMockHomey());
    await sys.initialize();
    const profile = sys.createGuestProfile({ name: 'Anna Svensson', phone: '0701234567', relationship: 'friend' });
    assert(profile, 'should return profile');
    assertEqual(profile.name, 'Anna Svensson');
    assertEqual(profile.relationship, 'friend');
    assert(profile.guestId, 'should have guestId');
    cleanup(sys);
  });

  it('createGuestProfile throws without name', async () => {
    const sys = new VisitorGuestManagementSystem(createMockHomey());
    await sys.initialize();
    let threw = false;
    try { sys.createGuestProfile({}); } catch (_e) { threw = true; }
    assert(threw, 'should throw');
    cleanup(sys);
  });

  it('updateGuestProfile updates fields', async () => {
    const sys = new VisitorGuestManagementSystem(createMockHomey());
    await sys.initialize();
    const profile = sys.createGuestProfile({ name: 'Erik' });
    const updated = sys.updateGuestProfile(profile.guestId, { phone: '0709999999' });
    assertEqual(updated.phone, '0709999999');
    cleanup(sys);
  });

  it('deleteGuestProfile removes profile', async () => {
    const sys = new VisitorGuestManagementSystem(createMockHomey());
    await sys.initialize();
    const profile = sys.createGuestProfile({ name: 'Delete Me' });
    assertEqual(sys.deleteGuestProfile(profile.guestId), true);
    assertEqual(sys.getGuestProfile(profile.guestId), null);
    cleanup(sys);
  });

  it('getGuestProfile returns null for unknown', async () => {
    const sys = new VisitorGuestManagementSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.getGuestProfile('nope'), null);
    cleanup(sys);
  });

  it('listGuestProfiles returns sorted list', async () => {
    const sys = new VisitorGuestManagementSystem(createMockHomey());
    await sys.initialize();
    sys.createGuestProfile({ name: 'Zebra' });
    sys.createGuestProfile({ name: 'Anna' });
    const list = sys.listGuestProfiles();
    assertEqual(list[0].name, 'Anna');
    assertEqual(list[1].name, 'Zebra');
    cleanup(sys);
  });
});

describe('Visitor — visit scheduling', () => {
  it('scheduleVisit creates a visit', async () => {
    const sys = new VisitorGuestManagementSystem(createMockHomey());
    await sys.initialize();
    const guest = sys.createGuestProfile({ name: 'Visitor' });
    const now = Date.now();
    const visit = sys.scheduleVisit({
      guestId: guest.guestId,
      startTime: new Date(now + 3600000).toISOString(),
      endTime: new Date(now + 7200000).toISOString(),
      purpose: 'dinner'
    });
    assert(visit, 'should return visit');
    assertEqual(visit.status, 'scheduled');
    assertEqual(visit.purpose, 'dinner');
    cleanup(sys);
  });

  it('cancelVisit cancels a visit', async () => {
    const sys = new VisitorGuestManagementSystem(createMockHomey());
    await sys.initialize();
    const guest = sys.createGuestProfile({ name: 'Cancel Test' });
    const now = Date.now();
    const visit = sys.scheduleVisit({
      guestId: guest.guestId,
      startTime: new Date(now + 3600000).toISOString(),
      endTime: new Date(now + 7200000).toISOString()
    });
    assertEqual(sys.cancelVisit(visit.visitId), true);
    cleanup(sys);
  });

  it('registerArrival updates visit status', async () => {
    const sys = new VisitorGuestManagementSystem(createMockHomey());
    await sys.initialize();
    const guest = sys.createGuestProfile({ name: 'Arriving Guest' });
    const now = Date.now();
    const visit = sys.scheduleVisit({
      guestId: guest.guestId,
      startTime: new Date(now + 3600000).toISOString(),
      endTime: new Date(now + 7200000).toISOString()
    });
    const result = sys.registerArrival(visit.visitId);
    assertEqual(result.status, 'in_progress');
    assert(result.arrivedAt, 'should have arrivedAt');
    cleanup(sys);
  });

  it('registerDeparture completes a visit', async () => {
    const sys = new VisitorGuestManagementSystem(createMockHomey());
    await sys.initialize();
    const guest = sys.createGuestProfile({ name: 'Departing Guest' });
    const now = Date.now();
    const visit = sys.scheduleVisit({
      guestId: guest.guestId,
      startTime: new Date(now + 3600000).toISOString(),
      endTime: new Date(now + 7200000).toISOString()
    });
    sys.registerArrival(visit.visitId);
    const result = sys.registerDeparture(visit.visitId);
    assertEqual(result.status, 'completed');
    assert(result.departedAt, 'should have departedAt');
    cleanup(sys);
  });

  it('getUpcomingVisits returns future visits', async () => {
    const sys = new VisitorGuestManagementSystem(createMockHomey());
    await sys.initialize();
    const guest = sys.createGuestProfile({ name: 'Future Guest' });
    const now = Date.now();
    sys.scheduleVisit({
      guestId: guest.guestId,
      startTime: new Date(now + 3600000).toISOString(),
      endTime: new Date(now + 7200000).toISOString()
    });
    const upcoming = sys.getUpcomingVisits(48);
    assert(upcoming.length > 0, 'should have upcoming visits');
    cleanup(sys);
  });
});

describe('Visitor — access codes', () => {
  it('generateTemporaryAccessCode creates a code', async () => {
    const sys = new VisitorGuestManagementSystem(createMockHomey());
    await sys.initialize();
    const guest = sys.createGuestProfile({ name: 'Code Guest' });
    const code = sys.generateTemporaryAccessCode({
      guestId: guest.guestId,
      target: 'lock',
      validUntil: new Date(Date.now() + 86400000).toISOString()
    });
    assert(code, 'should return code entry');
    assertEqual(code.code.length, 6);
    assertEqual(code.revoked, false);
    cleanup(sys);
  });

  it('validateAccessCode validates a valid code', async () => {
    const sys = new VisitorGuestManagementSystem(createMockHomey());
    await sys.initialize();
    const guest = sys.createGuestProfile({ name: 'Validate Guest' });
    const entry = sys.generateTemporaryAccessCode({
      guestId: guest.guestId,
      validUntil: new Date(Date.now() + 86400000).toISOString()
    });
    const result = sys.validateAccessCode(entry.code);
    assertEqual(result.valid, true);
    assert(result.entry, 'should have entry');
    cleanup(sys);
  });

  it('validateAccessCode rejects invalid code', async () => {
    const sys = new VisitorGuestManagementSystem(createMockHomey());
    await sys.initialize();
    const result = sys.validateAccessCode('INVALID');
    assertEqual(result.valid, false);
    cleanup(sys);
  });

  it('revokeAccessCode revokes a code', async () => {
    const sys = new VisitorGuestManagementSystem(createMockHomey());
    await sys.initialize();
    const guest = sys.createGuestProfile({ name: 'Revoke Guest' });
    const entry = sys.generateTemporaryAccessCode({
      guestId: guest.guestId,
      validUntil: new Date(Date.now() + 86400000).toISOString()
    });
    assertEqual(sys.revokeAccessCode(entry.codeId), true);
    const result = sys.validateAccessCode(entry.code);
    assertEqual(result.valid, false);
    cleanup(sys);
  });
});

describe('Visitor — guest wifi', () => {
  it('activateGuestWifi creates a session', async () => {
    const sys = new VisitorGuestManagementSystem(createMockHomey());
    await sys.initialize();
    const guest = sys.createGuestProfile({ name: 'Wifi Guest' });
    const session = sys.activateGuestWifi({ guestId: guest.guestId, durationMinutes: 60 });
    assert(session, 'should return session');
    assert(session.sessionId, 'should have sessionId');
    assert(session.password, 'should have password');
    cleanup(sys);
  });

  it('deactivateGuestWifi removes session', async () => {
    const sys = new VisitorGuestManagementSystem(createMockHomey());
    await sys.initialize();
    const guest = sys.createGuestProfile({ name: 'Wifi End' });
    const session = sys.activateGuestWifi({ guestId: guest.guestId });
    assertEqual(sys.deactivateGuestWifi(session.sessionId), true);
    cleanup(sys);
  });

  it('getActiveWifiSessions returns active sessions', async () => {
    const sys = new VisitorGuestManagementSystem(createMockHomey());
    await sys.initialize();
    const guest = sys.createGuestProfile({ name: 'Wifi Sessions' });
    sys.activateGuestWifi({ guestId: guest.guestId });
    const sessions = sys.getActiveWifiSessions();
    assert(Array.isArray(sessions), 'should be array');
    assert(sessions.length > 0, 'should have sessions');
    cleanup(sys);
  });
});

describe('Visitor — service providers', () => {
  it('addServiceProvider creates a provider', async () => {
    const sys = new VisitorGuestManagementSystem(createMockHomey());
    await sys.initialize();
    const provider = sys.addServiceProvider({ name: 'Städfirman AB', role: 'cleaner' });
    assert(provider, 'should return provider');
    assert(provider.providerId, 'should have providerId');
    assertEqual(provider.name, 'Städfirman AB');
    cleanup(sys);
  });

  it('listServiceProviders returns providers', async () => {
    const sys = new VisitorGuestManagementSystem(createMockHomey());
    await sys.initialize();
    sys.addServiceProvider({ name: 'Provider A', role: 'cleaner' });
    sys.addServiceProvider({ name: 'Provider B', role: 'plumber' });
    const all = sys.listServiceProviders();
    assert(all.length >= 2, 'should have at least 2');
    const cleaners = sys.listServiceProviders('cleaner');
    assert(cleaners.length >= 1, 'should have at least 1 cleaner');
    cleanup(sys);
  });
});

describe('Visitor — house rules & preferences', () => {
  it('configureHouseRules updates rules', async () => {
    const sys = new VisitorGuestManagementSystem(createMockHomey());
    await sys.initialize();
    sys.configureHouseRules({ parkingInfo: 'P-plats 15' });
    const rules = sys.getHouseRules();
    assertEqual(rules.parkingInfo, 'P-plats 15');
    cleanup(sys);
  });

  it('setGuestPreferences stores preferences', async () => {
    const sys = new VisitorGuestManagementSystem(createMockHomey());
    await sys.initialize();
    const guest = sys.createGuestProfile({ name: 'Pref Guest' });
    const prefs = sys.setGuestPreferences(guest.guestId, { temperature: 22, musicGenre: 'jazz' });
    assert(prefs, 'should return preferences');
    const stored = sys.getGuestPreferences(guest.guestId);
    assertEqual(stored.temperature, 22);
    cleanup(sys);
  });
});

describe('Visitor — statistics', () => {
  it('getStatistics returns comprehensive stats', async () => {
    const sys = new VisitorGuestManagementSystem(createMockHomey());
    await sys.initialize();
    sys.createGuestProfile({ name: 'Stats Guest' });
    const stats = sys.getStatistics();
    assertEqual(stats.initialized, true);
    assertType(stats.guestProfiles, 'number');
    assertType(stats.scheduledVisits, 'number');
    assertType(stats.activeAccessCodes, 'number');
    assert(stats.analytics, 'should have analytics');
    cleanup(sys);
  });

  it('getGuestAnalytics returns analytics data', async () => {
    const sys = new VisitorGuestManagementSystem(createMockHomey());
    await sys.initialize();
    const analytics = sys.getGuestAnalytics();
    assert(analytics, 'should return analytics');
    assertType(analytics.totalVisits, 'number');
    cleanup(sys);
  });
});

run();
