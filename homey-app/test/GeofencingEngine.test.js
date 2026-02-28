'use strict';

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertType, assertDeepEqual } = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');

const GeofencingEngine = require('../lib/GeofencingEngine');

/* ── helpers ──────────────────────────────────────────────────────────── */

const STOCKHOLM = { latitude: 59.3293, longitude: 18.0686 };
const GOTHENBURG = { latitude: 57.7089, longitude: 11.9746 };
const MALMO = { latitude: 55.6050, longitude: 13.0038 };
// ~400m from Stockholm center
const NEAR_STOCKHOLM = { latitude: 59.3325, longitude: 18.0710 };
// ~50m from Stockholm center
const VERY_NEAR = { latitude: 59.3297, longitude: 18.0692 };

/**
 * Create a GeofencingEngine with mocked geolocation and app stubs.
 */
function createSystem(opts = {}) {
  const homey = createMockHomey();

  homey.geolocation = {
    getLocation: async () => ({ ...STOCKHOLM }),
  };

  homey.app.sceneManager = {
    activateScene: async () => ({ success: true }),
  };
  homey.app.automationEngine = {
    executeAutomation: async () => ({ success: true }),
    evaluateCondition: async (cond) => cond.result !== false,
  };

  if (opts.homeyOverrides) {
    Object.assign(homey, opts.homeyOverrides);
  }

  const sys = new GeofencingEngine(homey);
  return { sys, homey };
}

/**
 * Create a geofence config object.
 */
function fenceConfig(overrides = {}) {
  return {
    id: 'test-fence',
    name: { en: 'Test Fence', sv: 'Testzon' },
    location: { ...STOCKHOLM },
    radius: 200,
    ...overrides,
  };
}

/* ══════════════════════════════════════════════════════════════════════ */
/*  TESTS                                                                */
/* ══════════════════════════════════════════════════════════════════════ */

describe('GeofencingEngine — constructor', () => {
  it('sets up initial data structures', () => {
    const { sys } = createSystem();
    assertType(sys.geofences, 'object');        // Map
    assertType(sys.userLocations, 'object');     // Map
    assert(Array.isArray(sys.locationHistory));
    assertType(sys.travelPatterns, 'object');    // Map
    assertType(sys.activeGeofences, 'object');   // Set
    assertEqual(sys.geofences.size, 0);
    assertEqual(sys.userLocations.size, 0);
    assertEqual(sys.locationHistory.length, 0);
    assertEqual(sys.travelPatterns.size, 0);
    assertEqual(sys.activeGeofences.size, 0);
  });

  it('has name set to GeofencingEngine', () => {
    const { sys } = createSystem();
    assertEqual(sys.name, 'GeofencingEngine');
  });

  it('is not initialized by default', () => {
    const { sys } = createSystem();
    assertEqual(sys.isInitialized, false);
  });
});

/* ── createGeofence ────────────────────────────────────────────────── */

describe('GeofencingEngine — createGeofence', () => {
  it('creates a geofence with provided config', async () => {
    const { sys } = createSystem();
    const fence = await sys.createGeofence(fenceConfig());

    assertEqual(fence.id, 'test-fence');
    assertEqual(fence.name.en, 'Test Fence');
    assertEqual(fence.location.latitude, STOCKHOLM.latitude);
    assertEqual(fence.location.longitude, STOCKHOLM.longitude);
    assertEqual(fence.radius, 200);
  });

  it('applies default radius when not provided', async () => {
    const { sys } = createSystem();
    const fence = await sys.createGeofence(fenceConfig({ radius: undefined }));
    assertEqual(fence.radius, 100);
  });

  it('sets adaptive to true by default', async () => {
    const { sys } = createSystem();
    const fence = await sys.createGeofence(fenceConfig());
    assertEqual(fence.adaptive, true);
  });

  it('allows disabling adaptive', async () => {
    const { sys } = createSystem();
    const fence = await sys.createGeofence(fenceConfig({ adaptive: false }));
    assertEqual(fence.adaptive, false);
  });

  it('stores the geofence in the map', async () => {
    const { sys } = createSystem();
    await sys.createGeofence(fenceConfig());
    assertEqual(sys.geofences.size, 1);
    assert(sys.geofences.has('test-fence'));
  });

  it('persists geofences to settings', async () => {
    const { sys, homey } = createSystem();
    await sys.createGeofence(fenceConfig());
    const saved = homey.settings.get('geofences');
    assert(saved !== null);
    assert('test-fence' in saved);
  });

  it('generates an id when not provided', async () => {
    const { sys } = createSystem();
    const fence = await sys.createGeofence(fenceConfig({ id: undefined }));
    assert(fence.id.startsWith('geo_'));
  });

  it('sets default action arrays', async () => {
    const { sys } = createSystem();
    const fence = await sys.createGeofence(fenceConfig());
    assert(Array.isArray(fence.actions.onEnter));
    assert(Array.isArray(fence.actions.onExit));
    assert(Array.isArray(fence.actions.onDwell));
    assert(Array.isArray(fence.actions.onApproach));
  });

  it('preserves provided actions', async () => {
    const { sys } = createSystem();
    const actions = {
      onEnter: [{ type: 'notification', message: 'Welcome' }],
      onExit: [{ type: 'notification', message: 'Goodbye' }],
    };
    const fence = await sys.createGeofence(fenceConfig({ actions }));
    assertEqual(fence.actions.onEnter.length, 1);
    assertEqual(fence.actions.onExit.length, 1);
    assertEqual(fence.actions.onDwell.length, 0);
    assertEqual(fence.actions.onApproach.length, 0);
  });

  it('sets default settings (dwellTime, approachDistance, cooldown)', async () => {
    const { sys } = createSystem();
    const fence = await sys.createGeofence(fenceConfig());
    assertEqual(fence.settings.dwellTime, 300000);
    assertEqual(fence.settings.approachDistance, 500);
    assertEqual(fence.settings.cooldown, 300000);
    assertEqual(fence.settings.requireConfirm, false);
  });

  it('initializes statistics correctly', async () => {
    const { sys } = createSystem();
    const fence = await sys.createGeofence(fenceConfig());
    assertEqual(fence.statistics.entries, 0);
    assertEqual(fence.statistics.exits, 0);
    assertEqual(fence.statistics.lastEntered, null);
    assertEqual(fence.statistics.lastExited, null);
    assertEqual(fence.statistics.averageDwellTime, 0);
  });

  it('defaults users to all', async () => {
    const { sys } = createSystem();
    const fence = await sys.createGeofence(fenceConfig());
    assertDeepEqual(fence.users, ['all']);
  });

  it('defaults enabled to true', async () => {
    const { sys } = createSystem();
    const fence = await sys.createGeofence(fenceConfig());
    assertEqual(fence.enabled, true);
  });

  it('allows creating a disabled geofence', async () => {
    const { sys } = createSystem();
    const fence = await sys.createGeofence(fenceConfig({ enabled: false }));
    assertEqual(fence.enabled, false);
  });

  it('can create multiple geofences', async () => {
    const { sys } = createSystem();
    await sys.createGeofence(fenceConfig({ id: 'fence-1' }));
    await sys.createGeofence(fenceConfig({ id: 'fence-2', location: GOTHENBURG }));
    assertEqual(sys.geofences.size, 2);
  });
});

/* ── calculateDistance ─────────────────────────────────────────────── */

describe('GeofencingEngine — calculateDistance', () => {
  it('returns 0 for same point', () => {
    const { sys } = createSystem();
    const d = sys.calculateDistance(59.33, 18.07, 59.33, 18.07);
    assertEqual(d, 0);
  });

  it('calculates Stockholm to Gothenburg (~395 km)', () => {
    const { sys } = createSystem();
    const d = sys.calculateDistance(
      STOCKHOLM.latitude, STOCKHOLM.longitude,
      GOTHENBURG.latitude, GOTHENBURG.longitude
    );
    // ~395 km within ±20 km tolerance
    assert(d > 375000 && d < 415000, `Expected ~395km, got ${(d / 1000).toFixed(1)}km`);
  });

  it('calculates Stockholm to Malmö (~510 km)', () => {
    const { sys } = createSystem();
    const d = sys.calculateDistance(
      STOCKHOLM.latitude, STOCKHOLM.longitude,
      MALMO.latitude, MALMO.longitude
    );
    assert(d > 490000 && d < 530000, `Expected ~510km, got ${(d / 1000).toFixed(1)}km`);
  });

  it('returns same distance regardless of direction', () => {
    const { sys } = createSystem();
    const d1 = sys.calculateDistance(
      STOCKHOLM.latitude, STOCKHOLM.longitude,
      GOTHENBURG.latitude, GOTHENBURG.longitude
    );
    const d2 = sys.calculateDistance(
      GOTHENBURG.latitude, GOTHENBURG.longitude,
      STOCKHOLM.latitude, STOCKHOLM.longitude
    );
    assertEqual(Math.round(d1), Math.round(d2));
  });

  it('calculates short distances within a few meters', () => {
    const { sys } = createSystem();
    // ~50 meters apart
    const d = sys.calculateDistance(
      STOCKHOLM.latitude, STOCKHOLM.longitude,
      VERY_NEAR.latitude, VERY_NEAR.longitude
    );
    assert(d > 30 && d < 80, `Expected ~50m, got ${d.toFixed(1)}m`);
  });
});

/* ── calculateSpeed ───────────────────────────────────────────────── */

describe('GeofencingEngine — calculateSpeed', () => {
  it('returns 0 when no previous location', () => {
    const { sys } = createSystem();
    const speed = sys.calculateSpeed(null, STOCKHOLM);
    assertEqual(speed, 0);
  });

  it('returns 0 when previousLocation is undefined', () => {
    const { sys } = createSystem();
    const speed = sys.calculateSpeed(undefined, STOCKHOLM);
    assertEqual(speed, 0);
  });

  it('calculates speed from two positions', () => {
    const { sys } = createSystem();
    const prev = {
      latitude: STOCKHOLM.latitude,
      longitude: STOCKHOLM.longitude,
      timestamp: Date.now() - 10000, // 10 seconds ago
    };
    const curr = {
      latitude: NEAR_STOCKHOLM.latitude,
      longitude: NEAR_STOCKHOLM.longitude,
    };
    const speed = sys.calculateSpeed(prev, curr);
    // ~400m in 10s = ~40 m/s
    assert(speed > 20 && speed < 60, `Expected ~40 m/s, got ${speed.toFixed(1)}`);
  });
});

/* ── userApplies ──────────────────────────────────────────────────── */

describe('GeofencingEngine — userApplies', () => {
  it('returns true when users include "all"', () => {
    const { sys } = createSystem();
    assert(sys.userApplies('anyone', { users: ['all'] }));
  });

  it('returns true when user is in list', () => {
    const { sys } = createSystem();
    assert(sys.userApplies('alice', { users: ['alice', 'bob'] }));
  });

  it('returns false when user is not in list', () => {
    const { sys } = createSystem();
    assert(!sys.userApplies('charlie', { users: ['alice', 'bob'] }));
  });
});

/* ── checkSchedule ────────────────────────────────────────────────── */

describe('GeofencingEngine — checkSchedule', () => {
  it('returns true when schedule is null', () => {
    const { sys } = createSystem();
    assert(sys.checkSchedule({ schedule: null }));
  });

  it('returns true when schedule has no constraints', () => {
    const { sys } = createSystem();
    assert(sys.checkSchedule({ schedule: {} }));
  });

  it('checks day-of-week restriction', () => {
    const { sys } = createSystem();
    const today = new Date().getDay();
    // Allow only today
    assert(sys.checkSchedule({ schedule: { days: [today] } }));
    // Disallow today (next day)
    const tomorrow = (today + 1) % 7;
    assert(!sys.checkSchedule({ schedule: { days: [tomorrow] } }));
  });

  it('checks hour-of-day restriction', () => {
    const { sys } = createSystem();
    const now = new Date().getHours();
    // Current hour is within range
    assert(sys.checkSchedule({ schedule: { hours: { start: 0, end: 23 } } }));
    // Current hour is outside range (impossible to be in both)
    const impossibleRange = now > 12
      ? { start: 0, end: now - 2 }
      : { start: now + 2, end: 23 };
    assert(!sys.checkSchedule({ schedule: { hours: impossibleRange } }));
  });
});

/* ── checkCooldown ────────────────────────────────────────────────── */

describe('GeofencingEngine — checkCooldown', () => {
  it('returns true when no previous enter event', () => {
    const { sys } = createSystem();
    const geofence = {
      statistics: { lastEntered: null, lastExited: null },
      settings: { cooldown: 300000 },
    };
    assert(sys.checkCooldown(geofence, 'enter'));
  });

  it('returns true when no previous exit event', () => {
    const { sys } = createSystem();
    const geofence = {
      statistics: { lastEntered: null, lastExited: null },
      settings: { cooldown: 300000 },
    };
    assert(sys.checkCooldown(geofence, 'exit'));
  });

  it('returns false when still within cooldown (enter)', () => {
    const { sys } = createSystem();
    const geofence = {
      statistics: { lastEntered: Date.now() - 1000 }, // 1 second ago
      settings: { cooldown: 300000 },
    };
    assert(!sys.checkCooldown(geofence, 'enter'));
  });

  it('returns false when still within cooldown (exit)', () => {
    const { sys } = createSystem();
    const geofence = {
      statistics: { lastExited: Date.now() - 1000 },
      settings: { cooldown: 300000 },
    };
    assert(!sys.checkCooldown(geofence, 'exit'));
  });

  it('returns true when cooldown has passed', () => {
    const { sys } = createSystem();
    const geofence = {
      statistics: { lastEntered: Date.now() - 400000 }, // 400s ago > 300s cooldown
      settings: { cooldown: 300000 },
    };
    assert(sys.checkCooldown(geofence, 'enter'));
  });
});

/* ── checkConditions ──────────────────────────────────────────────── */

describe('GeofencingEngine — checkConditions', () => {
  it('returns true for empty conditions array', async () => {
    const { sys } = createSystem();
    const result = await sys.checkConditions([]);
    assert(result);
  });

  it('returns true when all conditions pass', async () => {
    const { sys } = createSystem();
    const result = await sys.checkConditions([
      { type: 'test', result: true },
      { type: 'test', result: true },
    ]);
    assert(result);
  });

  it('returns false when any condition fails', async () => {
    const { sys } = createSystem();
    const result = await sys.checkConditions([
      { type: 'test', result: true },
      { type: 'test', result: false },
    ]);
    assert(!result);
  });

  it('returns true when no automationEngine exists', async () => {
    const { sys, homey } = createSystem();
    homey.app.automationEngine = null;
    const result = await sys.checkConditions([{ type: 'anything' }]);
    assert(result);
  });
});

/* ── countBoundaryCrossings ──────────────────────────────────────── */

describe('GeofencingEngine — countBoundaryCrossings', () => {
  it('returns 0 for empty history', () => {
    const { sys } = createSystem();
    const fence = { location: STOCKHOLM, radius: 100 };
    assertEqual(sys.countBoundaryCrossings([], fence), 0);
  });

  it('returns 0 when always inside', () => {
    const { sys } = createSystem();
    const fence = { location: STOCKHOLM, radius: 500 };
    const history = [
      { location: VERY_NEAR },
      { location: VERY_NEAR },
      { location: VERY_NEAR },
    ];
    assertEqual(sys.countBoundaryCrossings(history, fence), 0);
  });

  it('returns 0 when always outside', () => {
    const { sys } = createSystem();
    const fence = { location: STOCKHOLM, radius: 100 };
    const history = [
      { location: GOTHENBURG },
      { location: MALMO },
      { location: GOTHENBURG },
    ];
    assertEqual(sys.countBoundaryCrossings(history, fence), 0);
  });

  it('counts transitions between inside and outside', () => {
    const { sys } = createSystem();
    const fence = { location: STOCKHOLM, radius: 100 };
    // in → out → in = 2 crossings
    const history = [
      { location: VERY_NEAR },       // inside
      { location: GOTHENBURG },       // outside
      { location: VERY_NEAR },        // inside
    ];
    assertEqual(sys.countBoundaryCrossings(history, fence), 2);
  });

  it('counts multiple crossings', () => {
    const { sys } = createSystem();
    const fence = { location: STOCKHOLM, radius: 100 };
    // in → out → in → out = 3 crossings
    const history = [
      { location: VERY_NEAR },
      { location: GOTHENBURG },
      { location: VERY_NEAR },
      { location: MALMO },
    ];
    assertEqual(sys.countBoundaryCrossings(history, fence), 3);
  });
});

/* ── predictArrivalTime ──────────────────────────────────────────── */

describe('GeofencingEngine — predictArrivalTime', () => {
  it('calculates ETA from speed and distance', () => {
    const { sys } = createSystem();
    // 1000m at 10 m/s = 100s
    const eta = sys.predictArrivalTime('user1', {}, 1000, 10);
    assertEqual(eta.seconds, 100);
    assertEqual(eta.minutes, 2);
    assertType(eta.formatted, 'string');
  });

  it('uses default speed when speed is 0', () => {
    const { sys } = createSystem();
    const eta = sys.predictArrivalTime('user1', {}, 1000, 0);
    // Default is 10 m/s -> 100s
    assertEqual(eta.seconds, 100);
  });

  it('uses travel pattern average speed when available', () => {
    const { sys } = createSystem();
    sys.travelPatterns.set('user1', { averageSpeed: 20 });
    // 1000m at 20 m/s = 50s
    const eta = sys.predictArrivalTime('user1', {}, 1000, 0);
    assertEqual(eta.seconds, 50);
    assertEqual(eta.minutes, 1);
  });

  it('uses provided speed over pattern speed', () => {
    const { sys } = createSystem();
    sys.travelPatterns.set('user1', { averageSpeed: 20 });
    // Speed 5 is explicitly provided, 1000 / 5 = 200s
    const eta = sys.predictArrivalTime('user1', {}, 1000, 5);
    assertEqual(eta.seconds, 200);
  });
});

/* ── formatDuration ──────────────────────────────────────────────── */

describe('GeofencingEngine — formatDuration', () => {
  it('formats seconds', () => {
    const { sys } = createSystem();
    assertEqual(sys.formatDuration(30), '30 sekunder');
  });

  it('formats minutes', () => {
    const { sys } = createSystem();
    assertEqual(sys.formatDuration(120), '2 minuter');
  });

  it('formats hours', () => {
    const { sys } = createSystem();
    assertEqual(sys.formatDuration(7200), '2 timmar');
  });

  it('rounds seconds at boundary', () => {
    const { sys } = createSystem();
    assertEqual(sys.formatDuration(59), '59 sekunder');
  });

  it('shows 1 minut for 60 seconds', () => {
    const { sys } = createSystem();
    assertEqual(sys.formatDuration(60), '1 minuter');
  });

  it('shows 1 timmar for 3600 seconds', () => {
    const { sys } = createSystem();
    assertEqual(sys.formatDuration(3600), '1 timmar');
  });
});

/* ── generateId ──────────────────────────────────────────────────── */

describe('GeofencingEngine — generateId', () => {
  it('starts with geo_ prefix', () => {
    const { sys } = createSystem();
    assert(sys.generateId().startsWith('geo_'));
  });

  it('contains a timestamp component', () => {
    const { sys } = createSystem();
    const id = sys.generateId();
    const parts = id.split('_');
    // geo_timestamp_random
    assert(parts.length >= 3);
    const ts = parseInt(parts[1], 10);
    assert(ts > 0);
  });

  it('generates unique ids', () => {
    const { sys } = createSystem();
    const ids = new Set([sys.generateId(), sys.generateId(), sys.generateId()]);
    assertEqual(ids.size, 3);
  });
});

/* ── updateUserLocation ──────────────────────────────────────────── */

describe('GeofencingEngine — updateUserLocation', () => {
  it('stores user location in userLocations map', async () => {
    const { sys } = createSystem();
    await sys.updateUserLocation('user1', STOCKHOLM);
    assert(sys.userLocations.has('user1'));
    assertEqual(sys.userLocations.get('user1').latitude, STOCKHOLM.latitude);
  });

  it('uses geolocation when no location provided', async () => {
    const { sys } = createSystem();
    await sys.updateUserLocation('user1');
    assert(sys.userLocations.has('user1'));
    assertEqual(sys.userLocations.get('user1').latitude, STOCKHOLM.latitude);
  });

  it('adds to location history', async () => {
    const { sys } = createSystem();
    await sys.updateUserLocation('user1', STOCKHOLM);
    assertEqual(sys.locationHistory.length, 1);
    assertEqual(sys.locationHistory[0].userId, 'user1');
  });

  it('caps location history at 1000', async () => {
    const { sys } = createSystem();
    // Fill to 1000
    sys.locationHistory = new Array(1000).fill({
      userId: 'old',
      location: STOCKHOLM,
      timestamp: Date.now(),
    });
    await sys.updateUserLocation('user1', GOTHENBURG);
    assertEqual(sys.locationHistory.length, 1000);
    // Last entry should be the new one
    assertEqual(sys.locationHistory[999].userId, 'user1');
  });

  it('calculates speed from previous location', async () => {
    const { sys } = createSystem();
    // Set a previous location
    sys.userLocations.set('user1', {
      latitude: STOCKHOLM.latitude,
      longitude: STOCKHOLM.longitude,
      timestamp: Date.now() - 10000,
    });
    await sys.updateUserLocation('user1', NEAR_STOCKHOLM);
    const loc = sys.userLocations.get('user1');
    assert(loc.speed > 0, 'Speed should be > 0');
  });

  it('saves location history to settings', async () => {
    const { sys, homey } = createSystem();
    await sys.updateUserLocation('user1', STOCKHOLM);
    const saved = homey.settings.get('locationHistory');
    assert(Array.isArray(saved));
    assert(saved.length > 0);
  });

  it('handles geolocation errors gracefully', async () => {
    const { sys } = createSystem();
    sys.homey.geolocation = {
      getLocation: async () => { throw new Error('GPS unavailable'); },
    };
    // Should not throw
    await sys.updateUserLocation('user1');
    // Location should not be set
    assert(!sys.userLocations.has('user1'));
  });
});

/* ── handleEnter ─────────────────────────────────────────────────── */

describe('GeofencingEngine — handleEnter', () => {
  it('increments entry statistics', async () => {
    const { sys } = createSystem();
    const fence = await sys.createGeofence(fenceConfig());
    await sys.handleEnter('user1', fence);
    assertEqual(fence.statistics.entries, 1);
    assert(fence.statistics.lastEntered !== null);
  });

  it('executes onEnter actions', async () => {
    const { sys } = createSystem();
    let notified = false;
    sys.homey.notifications.createNotification = async () => { notified = true; };

    const fence = await sys.createGeofence(fenceConfig({
      actions: {
        onEnter: [{ type: 'notification', message: 'Welcome!' }],
      },
    }));
    await sys.handleEnter('user1', fence);
    assert(notified, 'Should have sent notification');
  });

  it('skips actions when in cooldown', async () => {
    const { sys } = createSystem();
    let notifyCount = 0;
    sys.homey.notifications.createNotification = async () => { notifyCount++; };

    const fence = await sys.createGeofence(fenceConfig({
      actions: {
        onEnter: [{ type: 'notification', message: 'Hello' }],
      },
    }));

    // First enter works
    await sys.handleEnter('user1', fence);
    assertEqual(notifyCount, 1);

    // Second enter within cooldown should be skipped
    await sys.handleEnter('user1', fence);
    assertEqual(notifyCount, 1); // Still 1
  });

  it('skips actions when conditions fail', async () => {
    const { sys } = createSystem();
    let notifyCount = 0;
    sys.homey.notifications.createNotification = async () => { notifyCount++; };

    // Make condition evaluator always return false
    sys.homey.app.automationEngine.evaluateCondition = async () => false;

    const fence = await sys.createGeofence(fenceConfig({
      conditions: [{ type: 'test' }],
      actions: {
        onEnter: [{ type: 'notification', message: 'Test' }],
      },
    }));

    await sys.handleEnter('user1', fence);
    assertEqual(notifyCount, 0);
  });

  it('handles action execution errors gracefully', async () => {
    const { sys } = createSystem();
    sys.homey.app.sceneManager.activateScene = async () => {
      throw new Error('Scene not found');
    };

    const fence = await sys.createGeofence(fenceConfig({
      actions: {
        onEnter: [{ type: 'scene', sceneId: 'nonexistent' }],
      },
    }));

    // Should not throw
    await sys.handleEnter('user1', fence);
    // Statistics still updated
    assertEqual(fence.statistics.entries, 1);
  });

  it('triggers flow card', async () => {
    const { sys } = createSystem();
    let triggered = false;
    sys.homey.flow.getTriggerCard = () => ({
      trigger: async () => { triggered = true; },
    });

    const fence = await sys.createGeofence(fenceConfig());
    await sys.handleEnter('user1', fence);
    assert(triggered, 'Should have triggered flow card');
  });
});

/* ── handleExit ──────────────────────────────────────────────────── */

describe('GeofencingEngine — handleExit', () => {
  it('increments exit statistics', async () => {
    const { sys } = createSystem();
    const fence = await sys.createGeofence(fenceConfig());
    // Simulate enter first to set lastEntered
    fence.statistics.lastEntered = Date.now() - 60000;
    await sys.handleExit('user1', fence);
    assertEqual(fence.statistics.exits, 1);
    assert(fence.statistics.lastExited !== null);
  });

  it('calculates average dwell time', async () => {
    const { sys } = createSystem();
    const fence = await sys.createGeofence(fenceConfig());
    fence.statistics.lastEntered = Date.now() - 120000; // 2 minutes ago
    fence.statistics.entries = 1;

    await sys.handleExit('user1', fence);
    assert(fence.statistics.averageDwellTime > 0, 'Average dwell time should be > 0');
  });

  it('executes onExit actions', async () => {
    const { sys } = createSystem();
    let notified = false;
    sys.homey.notifications.createNotification = async () => { notified = true; };

    const fence = await sys.createGeofence(fenceConfig({
      actions: {
        onExit: [{ type: 'notification', message: 'Goodbye!' }],
      },
    }));
    fence.statistics.lastEntered = Date.now() - 60000;
    await sys.handleExit('user1', fence);
    assert(notified);
  });

  it('skips when in cooldown', async () => {
    const { sys } = createSystem();
    let notifyCount = 0;
    sys.homey.notifications.createNotification = async () => { notifyCount++; };

    const fence = await sys.createGeofence(fenceConfig({
      actions: {
        onExit: [{ type: 'notification', message: 'Bye' }],
      },
    }));
    fence.statistics.lastEntered = Date.now() - 1000;
    await sys.handleExit('user1', fence);
    assertEqual(notifyCount, 1);

    // Second exit within cooldown
    await sys.handleExit('user1', fence);
    assertEqual(notifyCount, 1);
  });
});

/* ── handleDwell ─────────────────────────────────────────────────── */

describe('GeofencingEngine — handleDwell', () => {
  it('executes dwell actions when threshold exceeded', async () => {
    const { sys } = createSystem();
    let dwelled = false;
    sys.homey.notifications.createNotification = async () => { dwelled = true; };

    const fence = await sys.createGeofence(fenceConfig({
      dwellTime: 1000, // 1 second threshold
      actions: {
        onDwell: [{ type: 'notification', message: 'Still here' }],
      },
    }));
    fence.statistics.lastEntered = Date.now() - 2000; // 2s ago > 1s threshold

    await sys.handleDwell('user1', fence);
    assert(dwelled, 'Dwell actions should execute');
  });

  it('does not execute dwell actions before threshold', async () => {
    const { sys } = createSystem();
    let dwelled = false;
    sys.homey.notifications.createNotification = async () => { dwelled = true; };

    const fence = await sys.createGeofence(fenceConfig({
      actions: {
        onDwell: [{ type: 'notification', message: 'Still here' }],
      },
    }));
    fence.statistics.lastEntered = Date.now() - 1000; // 1s < 5min default threshold

    await sys.handleDwell('user1', fence);
    assert(!dwelled, 'Dwell actions should not execute before threshold');
  });

  it('executes dwell actions only once per enter', async () => {
    const { sys } = createSystem();
    let dwellCount = 0;
    sys.homey.notifications.createNotification = async () => { dwellCount++; };

    const fence = await sys.createGeofence(fenceConfig({
      dwellTime: 1000,
      actions: {
        onDwell: [{ type: 'notification', message: 'Test' }],
      },
    }));
    fence.statistics.lastEntered = Date.now() - 5000;

    await sys.handleDwell('user1', fence);
    await sys.handleDwell('user1', fence); // duplicate
    assertEqual(dwellCount, 1);
  });

  it('does nothing when no dwell actions defined', async () => {
    const { sys } = createSystem();
    const fence = await sys.createGeofence(fenceConfig({ dwellTime: 1 }));
    fence.statistics.lastEntered = Date.now() - 1000;
    // Should not throw
    await sys.handleDwell('user1', fence);
  });
});

/* ── handleApproach ──────────────────────────────────────────────── */

describe('GeofencingEngine — handleApproach', () => {
  it('executes approach actions', async () => {
    const { sys } = createSystem();
    let notified = false;
    sys.homey.notifications.createNotification = async () => { notified = true; };

    const fence = await sys.createGeofence(fenceConfig({
      actions: {
        onApproach: [{ type: 'notification', message: 'Approaching' }],
      },
    }));

    // Set user speed for ETA calculation
    sys.userLocations.set('user1', { speed: 10 });

    await sys.handleApproach('user1', fence, 300);
    assert(notified, 'Approach notification should fire');
    // Cleanup the wrapTimeout created by handleApproach
    await sys.destroy();
  });

  it('only triggers once per approach', async () => {
    const { sys } = createSystem();
    let count = 0;
    sys.homey.notifications.createNotification = async () => { count++; };

    const fence = await sys.createGeofence(fenceConfig({
      actions: {
        onApproach: [{ type: 'notification', message: 'Approaching' }],
      },
    }));

    sys.userLocations.set('user1', { speed: 10 });
    await sys.handleApproach('user1', fence, 300);
    await sys.handleApproach('user1', fence, 250); // should be suppressed
    assertEqual(count, 1);
    await sys.destroy();
  });

  it('triggers flow card with distance and eta', async () => {
    const { sys } = createSystem();
    let flowData = null;
    sys.homey.flow.getTriggerCard = () => ({
      trigger: async (data) => { flowData = data; },
    });

    const fence = await sys.createGeofence(fenceConfig());
    sys.userLocations.set('user1', { speed: 10 });
    await sys.handleApproach('user1', fence, 500);
    assert(flowData !== null, 'Flow card should be triggered');
    assert('distance' in flowData, 'Flow data should contain distance');
    assert('eta' in flowData, 'Flow data should contain eta');
    await sys.destroy();
  });
});

/* ── isApproachingGeofence ───────────────────────────────────────── */

describe('GeofencingEngine — isApproachingGeofence', () => {
  it('returns false with too few history points', async () => {
    const { sys } = createSystem();
    sys.locationHistory = [{ userId: 'user1', location: GOTHENBURG }];
    const result = await sys.isApproachingGeofence('user1', { location: STOCKHOLM }, NEAR_STOCKHOLM);
    assert(!result);
  });

  it('returns true when distance is decreasing', async () => {
    const { sys } = createSystem();
    // History: moving from Gothenburg towards Stockholm
    sys.locationHistory = [
      { userId: 'user1', location: GOTHENBURG },
      { userId: 'user1', location: MALMO },   // Malmö is further but let's use proper approach
      { userId: 'user1', location: { latitude: 58.5, longitude: 15.0 } },
      { userId: 'user1', location: { latitude: 59.0, longitude: 17.0 } },
      { userId: 'user1', location: NEAR_STOCKHOLM },
    ];
    const fence = { location: STOCKHOLM, radius: 100 };
    const result = await sys.isApproachingGeofence('user1', fence, NEAR_STOCKHOLM);
    assert(result, 'Should detect approach when distances are decreasing');
  });

  it('returns false when distance is increasing', async () => {
    const { sys } = createSystem();
    // History: moving away from Stockholm
    sys.locationHistory = [
      { userId: 'user1', location: NEAR_STOCKHOLM },
      { userId: 'user1', location: { latitude: 59.0, longitude: 17.0 } },
      { userId: 'user1', location: { latitude: 58.5, longitude: 15.0 } },
      { userId: 'user1', location: { latitude: 58.0, longitude: 13.0 } },
      { userId: 'user1', location: GOTHENBURG },
    ];
    const fence = { location: STOCKHOLM, radius: 100 };
    const result = await sys.isApproachingGeofence('user1', fence, GOTHENBURG);
    assert(!result, 'Should not detect approach when distances are increasing');
  });

  it('ignores history from other users', async () => {
    const { sys } = createSystem();
    sys.locationHistory = [
      { userId: 'other', location: NEAR_STOCKHOLM },
      { userId: 'other', location: VERY_NEAR },
      { userId: 'user1', location: GOTHENBURG },
    ];
    const fence = { location: STOCKHOLM, radius: 100 };
    const result = await sys.isApproachingGeofence('user1', fence, GOTHENBURG);
    assert(!result, 'Should not detect approach with only 1 record for user1');
  });
});

/* ── executeGeofenceAction ───────────────────────────────────────── */

describe('GeofencingEngine — executeGeofenceAction', () => {
  it('activates scene', async () => {
    const { sys } = createSystem();
    let activated = null;
    sys.homey.app.sceneManager.activateScene = async (id) => { activated = id; };

    await sys.executeGeofenceAction(
      { type: 'scene', sceneId: 'morning' },
      { userId: 'user1', geofence: {}, event: 'enter' }
    );
    assertEqual(activated, 'morning');
  });

  it('executes automation', async () => {
    const { sys } = createSystem();
    let automationId = null;
    sys.homey.app.automationEngine.executeAutomation = async (id) => { automationId = id; };

    await sys.executeGeofenceAction(
      { type: 'automation', automationId: 'auto-1' },
      { userId: 'user1', geofence: {}, event: 'exit' }
    );
    assertEqual(automationId, 'auto-1');
  });

  it('sends notification', async () => {
    const { sys } = createSystem();
    let message = null;
    sys.homey.notifications.createNotification = async ({ excerpt }) => { message = excerpt; };

    await sys.executeGeofenceAction(
      { type: 'notification', message: 'Hello' },
      {}
    );
    assertEqual(message, 'Hello');
  });

  it('controls device', async () => {
    const { sys } = createSystem();
    let setArgs = null;
    sys.homey.devices.getDevice = async () => ({
      setCapabilityValue: async (cap, val) => { setArgs = { cap, val }; },
    });

    await sys.executeGeofenceAction(
      { type: 'device', deviceId: 'light-1', capability: 'onoff', value: true },
      {}
    );
    assertDeepEqual(setArgs, { cap: 'onoff', val: true });
  });
});

/* ── analyzeTravelPattern ────────────────────────────────────────── */

describe('GeofencingEngine — analyzeTravelPattern', () => {
  it('does nothing with too few history points', async () => {
    const { sys } = createSystem();
    sys.locationHistory = [{ userId: 'user1', location: STOCKHOLM, timestamp: Date.now() }];
    await sys.analyzeTravelPattern('user1', STOCKHOLM);
    assert(!sys.travelPatterns.has('user1'));
  });

  it('calculates average speed from history', async () => {
    const { sys } = createSystem();
    const now = Date.now();
    sys.locationHistory = [
      { userId: 'user1', location: STOCKHOLM, timestamp: now - 20000 },
      { userId: 'user1', location: NEAR_STOCKHOLM, timestamp: now - 10000 },
      { userId: 'user1', location: VERY_NEAR, timestamp: now },
    ];
    await sys.analyzeTravelPattern('user1', VERY_NEAR);
    assert(sys.travelPatterns.has('user1'));
    const pattern = sys.travelPatterns.get('user1');
    assert(pattern.averageSpeed >= 0, 'Should have a non-negative average speed');
  });

  it('saves travel patterns to settings', async () => {
    const { sys, homey } = createSystem();
    const now = Date.now();
    sys.locationHistory = [
      { userId: 'user1', location: STOCKHOLM, timestamp: now - 10000 },
      { userId: 'user1', location: NEAR_STOCKHOLM, timestamp: now },
    ];
    await sys.analyzeTravelPattern('user1', NEAR_STOCKHOLM);
    const saved = homey.settings.get('travelPatterns');
    assert(saved !== null);
  });
});

/* ── identifyRoutes ──────────────────────────────────────────────── */

describe('GeofencingEngine — identifyRoutes', () => {
  it('returns empty array (stub implementation)', () => {
    const { sys } = createSystem();
    const routes = sys.identifyRoutes([]);
    assertDeepEqual(routes, []);
  });
});

/* ── adjustGeofenceRadius ────────────────────────────────────────── */

describe('GeofencingEngine — adjustGeofenceRadius', () => {
  it('adjusts radius based on location accuracy', async () => {
    const { sys } = createSystem();
    const fence = await sys.createGeofence(fenceConfig({ radius: undefined }));
    const originalRadius = fence.radius;

    sys.userLocations.set('user1', {
      latitude: STOCKHOLM.latitude,
      longitude: STOCKHOLM.longitude,
      accuracy: 200,
      timestamp: Date.now(),
    });

    await sys.adjustGeofenceRadius(fence, 'user1');
    assert(fence.radius !== originalRadius, 'Radius should have changed');
  });

  it('does nothing when user location is missing', async () => {
    const { sys } = createSystem();
    const fence = await sys.createGeofence(fenceConfig());
    const originalRadius = fence.radius;
    await sys.adjustGeofenceRadius(fence, 'nonexistent');
    assertEqual(fence.radius, originalRadius);
  });

  it('stays within min/max bounds', async () => {
    const { sys } = createSystem();
    const fence = await sys.createGeofence(fenceConfig());

    // Very high accuracy => small radius target
    sys.userLocations.set('user1', {
      latitude: STOCKHOLM.latitude,
      longitude: STOCKHOLM.longitude,
      accuracy: 5, // very high accuracy
      timestamp: Date.now(),
    });

    // Run adjustment many times to converge
    for (let i = 0; i < 100; i++) {
      await sys.adjustGeofenceRadius(fence, 'user1');
    }

    assert(fence.radius >= 50, `Radius ${fence.radius} should be >= 50`);
    assert(fence.radius <= 500, `Radius ${fence.radius} should be <= 500`);
  });
});

/* ── checkGeofences (integration) ────────────────────────────────── */

describe('GeofencingEngine — checkGeofences', () => {
  it('detects entry when user moves inside geofence', async () => {
    const { sys } = createSystem();
    const fence = await sys.createGeofence(fenceConfig({ radius: 100 }));

    // Place user inside the geofence
    sys.userLocations.set('user1', {
      latitude: VERY_NEAR.latitude,
      longitude: VERY_NEAR.longitude,
      accuracy: 50,
      timestamp: Date.now(),
    });

    await sys.checkGeofences();
    // User should now be in activeGeofences
    assert(sys.activeGeofences.has('user1_test-fence'), 'User should be inside fence');
    assertEqual(fence.statistics.entries, 1);
  });

  it('detects exit when user moves outside geofence', async () => {
    const { sys } = createSystem();
    const fence = await sys.createGeofence(fenceConfig({ radius: 100 }));

    // Simulate already inside
    sys.activeGeofences.add('user1_test-fence');
    fence.statistics.lastEntered = Date.now() - 60000;
    fence.statistics.entries = 1;

    // Place user far away
    sys.userLocations.set('user1', {
      latitude: GOTHENBURG.latitude,
      longitude: GOTHENBURG.longitude,
      accuracy: 50,
      timestamp: Date.now(),
    });

    await sys.checkGeofences();
    assert(!sys.activeGeofences.has('user1_test-fence'), 'User should be outside fence');
    assertEqual(fence.statistics.exits, 1);
  });

  it('skips disabled geofences', async () => {
    const { sys } = createSystem();
    await sys.createGeofence(fenceConfig({ enabled: false }));

    sys.userLocations.set('user1', {
      latitude: VERY_NEAR.latitude,
      longitude: VERY_NEAR.longitude,
      accuracy: 50,
      timestamp: Date.now(),
    });

    await sys.checkGeofences();
    assert(!sys.activeGeofences.has('user1_test-fence'), 'Disabled fence should be skipped');
  });

  it('skips users not in geofence user list', async () => {
    const { sys } = createSystem();
    await sys.createGeofence(fenceConfig({ users: ['alice'] }));

    sys.userLocations.set('bob', {
      latitude: VERY_NEAR.latitude,
      longitude: VERY_NEAR.longitude,
      accuracy: 50,
      timestamp: Date.now(),
    });

    await sys.checkGeofences();
    assert(!sys.activeGeofences.has('bob_test-fence'));
  });
});

/* ── initialize / destroy lifecycle ──────────────────────────────── */

describe('GeofencingEngine — initialize and destroy', () => {
  it('loads saved geofences on initialize', async () => {
    const { sys, homey } = createSystem();
    // Pre-populate settings with a saved geofence
    homey.settings.set('geofences', {
      'saved-1': {
        id: 'saved-1',
        name: { en: 'Saved' },
        location: STOCKHOLM,
        radius: 150,
        actions: { onEnter: [], onExit: [], onDwell: [], onApproach: [] },
        settings: { dwellTime: 300000, approachDistance: 500, cooldown: 300000 },
        statistics: { entries: 5, exits: 4, lastEntered: null, lastExited: null, averageDwellTime: 0 },
        users: ['all'],
        enabled: true,
      },
    });

    await sys.initialize();
    assertEqual(sys.geofences.size, 1);
    assert(sys.geofences.has('saved-1'));
    assertEqual(sys.isInitialized, true);
    await sys.destroy();
  });

  it('creates default home geofence when none saved', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    // Should have a 'home' geofence created
    assert(sys.geofences.has('home'), 'Should create default home geofence');
    const home = sys.geofences.get('home');
    assertEqual(home.location.latitude, STOCKHOLM.latitude);
    assertEqual(home.location.longitude, STOCKHOLM.longitude);
    await sys.destroy();
  });

  it('loads location history from settings', async () => {
    const { sys, homey } = createSystem();
    homey.settings.set('locationHistory', [
      { userId: 'u1', location: STOCKHOLM, timestamp: 1000 },
    ]);
    await sys.initialize();
    // 1 saved entry + 1 added by startLocationMonitoring's initial updateUserLocation
    assertEqual(sys.locationHistory.length, 2);
    await sys.destroy();
  });

  it('loads travel patterns from settings', async () => {
    const { sys, homey } = createSystem();
    homey.settings.set('travelPatterns', [['user1', { averageSpeed: 15 }]]);
    await sys.initialize();
    assert(sys.travelPatterns.has('user1'));
    assertEqual(sys.travelPatterns.get('user1').averageSpeed, 15);
    await sys.destroy();
  });

  it('destroy clears intervals and resets state', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.isInitialized, true);
    await sys.destroy();
    assertEqual(sys.isInitialized, false);
  });
});

/* ── triggerGeofenceFlow ─────────────────────────────────────────── */

describe('GeofencingEngine — triggerGeofenceFlow', () => {
  it('triggers with geofence name and user', async () => {
    const { sys } = createSystem();
    let triggerData = null;
    sys.homey.flow.getTriggerCard = () => ({
      trigger: async (data) => { triggerData = data; },
    });

    await sys.triggerGeofenceFlow('entered', { name: { en: 'Office' }, id: 'f1' }, 'alice');
    assertEqual(triggerData.geofence, 'Office');
    assertEqual(triggerData.user, 'alice');
  });

  it('falls back to Swedish name', async () => {
    const { sys } = createSystem();
    let triggerData = null;
    sys.homey.flow.getTriggerCard = () => ({
      trigger: async (data) => { triggerData = data; },
    });

    await sys.triggerGeofenceFlow('entered', { name: { sv: 'Kontor' }, id: 'f2' }, 'alice');
    // en is undefined, so it falls through to sv
    assertEqual(triggerData.geofence, 'Kontor');
  });

  it('does nothing when trigger card is null', async () => {
    const { sys } = createSystem();
    sys.homey.flow.getTriggerCard = () => null;
    // Should not throw
    await sys.triggerGeofenceFlow('entered', { name: { en: 'X' }, id: 'f3' }, 'user1');
  });

  it('includes extra data in trigger', async () => {
    const { sys } = createSystem();
    let triggerData = null;
    sys.homey.flow.getTriggerCard = () => ({
      trigger: async (data) => { triggerData = data; },
    });

    await sys.triggerGeofenceFlow('approaching', { name: { en: 'Home' }, id: 'h' }, 'u1', {
      distance: 500,
      eta: { seconds: 50 },
    });
    assertEqual(triggerData.distance, 500);
    assertDeepEqual(triggerData.eta, { seconds: 50 });
  });
});

/* ── saveGeofences / persistence ─────────────────────────────────── */

describe('GeofencingEngine — persistence', () => {
  it('saveGeofences serializes Map to object', async () => {
    const { sys, homey } = createSystem();
    await sys.createGeofence(fenceConfig({ id: 'a' }));
    await sys.createGeofence(fenceConfig({ id: 'b', location: GOTHENBURG }));

    const saved = homey.settings.get('geofences');
    assert('a' in saved);
    assert('b' in saved);
  });

  it('saveLocationHistory caps at 1000', async () => {
    const { sys, homey } = createSystem();
    sys.locationHistory = new Array(1500).fill({
      userId: 'u',
      location: STOCKHOLM,
      timestamp: Date.now(),
    });
    await sys.saveLocationHistory();
    const saved = homey.settings.get('locationHistory');
    assertEqual(saved.length, 1000);
  });

  it('saveTravelPatterns converts Map to entries array', async () => {
    const { sys, homey } = createSystem();
    sys.travelPatterns.set('u1', { averageSpeed: 10 });
    await sys.saveTravelPatterns();
    const saved = homey.settings.get('travelPatterns');
    assert(Array.isArray(saved));
    assertEqual(saved.length, 1);
    assertEqual(saved[0][0], 'u1');
  });
});

/* ── delay helper ────────────────────────────────────────────────── */

describe('GeofencingEngine — delay', () => {
  it('resolves after specified time', async () => {
    const { sys } = createSystem();
    const start = Date.now();
    await sys.delay(50);
    const elapsed = Date.now() - start;
    assert(elapsed >= 40, `Expected >= 40ms, got ${elapsed}ms`);
  });
});

run();
