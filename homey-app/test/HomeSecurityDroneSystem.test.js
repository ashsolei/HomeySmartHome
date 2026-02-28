'use strict';

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertType } = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');

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

const HomeSecurityDroneSystem = require('../lib/HomeSecurityDroneSystem');

describe('HomeSecurityDroneSystem — constructor & init', () => {
  it('instantiates without errors', () => {
    const sys = new HomeSecurityDroneSystem(createMockHomey());
    assert(sys, 'should create instance');
    assertEqual(sys.initialized, false);
    cleanup(sys);
  });

  it('initialize sets up fleet and routes', async () => {
    const sys = new HomeSecurityDroneSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.initialized, true);
    assert(sys.drones.size > 0, 'should have drones');
    assert(sys.patrolRoutes.size > 0, 'should have patrol routes');
    assert(sys.landingPads.size > 0, 'should have landing pads');
    cleanup(sys);
  });

  it('destroy cleans up', async () => {
    const sys = new HomeSecurityDroneSystem(createMockHomey());
    await sys.initialize();
    sys.destroy();
    assertEqual(sys.initialized, false);
    cleanup(sys);
  });
});

describe('HomeSecurityDroneSystem — drone status & management', () => {
  it('getDroneStatus returns drone info', async () => {
    const sys = new HomeSecurityDroneSystem(createMockHomey());
    await sys.initialize();
    const droneId = sys.drones.keys().next().value;
    const status = sys.getDroneStatus(droneId);
    assert(status, 'should return status');
    assertType(status.batteryLevel, 'number');
    cleanup(sys);
  });

  it('getDroneStatus returns null for unknown drone', async () => {
    const sys = new HomeSecurityDroneSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.getDroneStatus('nonexistent'), null);
    cleanup(sys);
  });

  it('getAllDroneStatuses returns all drones', async () => {
    const sys = new HomeSecurityDroneSystem(createMockHomey());
    await sys.initialize();
    const statuses = sys.getAllDroneStatuses();
    assert(Array.isArray(statuses), 'should be array');
    assert(statuses.length > 0, 'should have statuses');
    cleanup(sys);
  });

  it('getDroneHealthReport returns health info', async () => {
    const sys = new HomeSecurityDroneSystem(createMockHomey());
    await sys.initialize();
    const droneId = sys.drones.keys().next().value;
    const report = sys.getDroneHealthReport(droneId);
    assert(report, 'should return report');
    assertType(report.overallHealth, 'number');
    cleanup(sys);
  });
});

describe('HomeSecurityDroneSystem — routes & patrols', () => {
  it('enableRoute and disableRoute toggle route', async () => {
    const sys = new HomeSecurityDroneSystem(createMockHomey());
    await sys.initialize();
    const routeId = sys.patrolRoutes.keys().next().value;
    sys.disableRoute(routeId);
    assertEqual(sys.patrolRoutes.get(routeId).enabled, false);
    sys.enableRoute(routeId);
    assertEqual(sys.patrolRoutes.get(routeId).enabled, true);
    cleanup(sys);
  });

  it('updateRouteFrequency changes frequency', async () => {
    const sys = new HomeSecurityDroneSystem(createMockHomey());
    await sys.initialize();
    const routeId = sys.patrolRoutes.keys().next().value;
    sys.updateRouteFrequency(routeId, 'every-2h');
    assertEqual(sys.patrolRoutes.get(routeId).frequency, 'every-2h');
    cleanup(sys);
  });

  it('triggerEventPatrol responds to events', async () => {
    const sys = new HomeSecurityDroneSystem(createMockHomey());
    await sys.initialize();
    const result = sys.triggerEventPatrol('perimeter-breach', { location: 'north' });
    // May succeed or fail depending on drone availability
    assert(result !== undefined, 'should return something');
    cleanup(sys);
  });
});

describe('HomeSecurityDroneSystem — live feeds', () => {
  it('startLiveFeed creates a feed', async () => {
    const sys = new HomeSecurityDroneSystem(createMockHomey());
    await sys.initialize();
    const droneId = sys.drones.keys().next().value;
    const feed = sys.startLiveFeed(droneId, 'viewer1');
    assert(feed, 'should return feed');
    assert(feed.id, 'should have id');
    cleanup(sys);
  });

  it('stopLiveFeed ends a feed', async () => {
    const sys = new HomeSecurityDroneSystem(createMockHomey());
    await sys.initialize();
    const droneId = sys.drones.keys().next().value;
    const feed = sys.startLiveFeed(droneId, 'viewer1');
    const result = sys.stopLiveFeed(feed.id);
    assertEqual(result, true);
    cleanup(sys);
  });
});

describe('HomeSecurityDroneSystem — manual control', () => {
  it('activateManualControl enables control', async () => {
    const sys = new HomeSecurityDroneSystem(createMockHomey());
    await sys.initialize();
    const droneId = sys.drones.keys().next().value;
    const result = sys.activateManualControl(droneId, 'operator1', 'joystick');
    assertEqual(result, true);
    assertEqual(sys.manualControl.active, true);
    cleanup(sys);
  });

  it('deactivateManualControl disables control', async () => {
    const sys = new HomeSecurityDroneSystem(createMockHomey());
    await sys.initialize();
    const droneId = sys.drones.keys().next().value;
    sys.activateManualControl(droneId, 'operator1', 'joystick');
    const result = sys.deactivateManualControl();
    assertEqual(result, true);
    assertEqual(sys.manualControl.active, false);
    cleanup(sys);
  });
});

describe('HomeSecurityDroneSystem — landing pads & no-fly', () => {
  it('getLandingPadStatus returns pad info', async () => {
    const sys = new HomeSecurityDroneSystem(createMockHomey());
    await sys.initialize();
    const padId = sys.landingPads.keys().next().value;
    const status = sys.getLandingPadStatus(padId);
    assert(status, 'should return status');
    cleanup(sys);
  });

  it('getAllLandingPadStatuses returns all pads', async () => {
    const sys = new HomeSecurityDroneSystem(createMockHomey());
    await sys.initialize();
    const pads = sys.getAllLandingPadStatuses();
    assert(Array.isArray(pads), 'should be array');
    assert(pads.length > 0, 'should have pads');
    cleanup(sys);
  });

  it('getNoFlyZones returns zones', async () => {
    const sys = new HomeSecurityDroneSystem(createMockHomey());
    await sys.initialize();
    const zones = sys.getNoFlyZones();
    assert(Array.isArray(zones), 'should be array');
    cleanup(sys);
  });

  it('toggleNoFlyZone changes enforcement', async () => {
    const sys = new HomeSecurityDroneSystem(createMockHomey());
    await sys.initialize();
    if (sys.noFlyZones.length > 0) {
      const result = sys.toggleNoFlyZone(sys.noFlyZones[0].id, false);
      assertEqual(result, true);
    }
    cleanup(sys);
  });
});

describe('HomeSecurityDroneSystem — analytics & events', () => {
  it('getDroneAnalytics returns analytics', async () => {
    const sys = new HomeSecurityDroneSystem(createMockHomey());
    await sys.initialize();
    const analytics = sys.getDroneAnalytics();
    assert(analytics, 'should return analytics');
    cleanup(sys);
  });

  it('getEventLog returns log entries', async () => {
    const sys = new HomeSecurityDroneSystem(createMockHomey());
    await sys.initialize();
    const log = sys.getEventLog();
    assert(Array.isArray(log), 'should be array');
    cleanup(sys);
  });

  it('getStatistics returns stats', async () => {
    const sys = new HomeSecurityDroneSystem(createMockHomey());
    await sys.initialize();
    const stats = sys.getStatistics();
    assert(stats, 'should return stats');
    assert(stats.drones, 'should have drones in stats');
    cleanup(sys);
  });

  it('exportConfiguration returns config', async () => {
    const sys = new HomeSecurityDroneSystem(createMockHomey());
    await sys.initialize();
    const config = sys.exportConfiguration();
    assert(config, 'should return config');
    cleanup(sys);
  });

  it('getCoverageMap returns coverage', async () => {
    const sys = new HomeSecurityDroneSystem(createMockHomey());
    await sys.initialize();
    const map = sys.getCoverageMap();
    assert(map, 'should return map');
    cleanup(sys);
  });
});

run();
