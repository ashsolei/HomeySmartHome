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

const AdvancedNeighborhoodIntegrationSystem = require('../lib/AdvancedNeighborhoodIntegrationSystem');

describe('Neighborhood — constructor & lifecycle', () => {
  it('instantiates without errors', () => {
    const sys = new AdvancedNeighborhoodIntegrationSystem(createMockHomey());
    assert(sys, 'should create instance');
    cleanup(sys);
  });

  it('initialize sets initialized flag', async () => {
    const sys = new AdvancedNeighborhoodIntegrationSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.initialized, true);
    assert(sys.neighborhoodId, 'should have neighborhood id');
    cleanup(sys);
  });

  it('initialize is idempotent', async () => {
    const sys = new AdvancedNeighborhoodIntegrationSystem(createMockHomey());
    await sys.initialize();
    await sys.initialize();
    assertEqual(sys.initialized, true);
    cleanup(sys);
  });

  it('destroy clears all state', async () => {
    const sys = new AdvancedNeighborhoodIntegrationSystem(createMockHomey());
    await sys.initialize();
    sys.destroy();
    assertEqual(sys.initialized, false);
    assertEqual(sys.neighbors.size, 0);
    assertEqual(sys.emergencyChannel.active, false);
    cleanup(sys);
  });
});

describe('Neighborhood — neighbor registration', () => {
  it('registerNeighbor adds a neighbor', async () => {
    const sys = new AdvancedNeighborhoodIntegrationSystem(createMockHomey());
    await sys.initialize();
    const neighbor = await sys.registerNeighbor({ name: 'Alice', address: '123 Main St' });
    assert(neighbor.id, 'should have id');
    assertEqual(neighbor.name, 'Alice');
    assertEqual(neighbor.status, 'active');
    cleanup(sys);
  });

  it('registerNeighbor adds trusted peer', async () => {
    const sys = new AdvancedNeighborhoodIntegrationSystem(createMockHomey());
    await sys.initialize();
    const neighbor = await sys.registerNeighbor({ name: 'Bob', trusted: true });
    assert(sys.trustedPeers.has(neighbor.id), 'should be trusted');
    cleanup(sys);
  });
});

describe('Neighborhood — security alerts', () => {
  it('broadcastSecurityAlert creates alert', async () => {
    const sys = new AdvancedNeighborhoodIntegrationSystem(createMockHomey());
    await sys.initialize();
    const result = await sys.broadcastSecurityAlert({
      type: 'suspicious-activity',
      severity: 'high',
      message: 'Unknown person at gate'
    });
    assertEqual(result.success, true);
    assert(result.alert.id, 'should have alert id');
    assert(sys.securityAlerts.length >= 1, 'should add to alerts');
    cleanup(sys);
  });
});

describe('Neighborhood — energy grid', () => {
  it('shareEnergyData records energy data', async () => {
    const sys = new AdvancedNeighborhoodIntegrationSystem(createMockHomey());
    await sys.initialize();
    const entry = await sys.shareEnergyData({ production: 5, consumption: 3 });
    assertEqual(entry.production, 5);
    assertEqual(entry.consumption, 3);
    assertEqual(entry.surplus, 2);
    cleanup(sys);
  });
});

describe('Neighborhood — community events', () => {
  it('createCommunityEvent creates an event', async () => {
    const sys = new AdvancedNeighborhoodIntegrationSystem(createMockHomey());
    await sys.initialize();
    const event = await sys.createCommunityEvent({
      title: 'Block Party',
      type: 'social',
      date: '2026-03-15'
    });
    assert(event.id, 'should have id');
    assertEqual(event.title, 'Block Party');
    assertEqual(event.status, 'upcoming');
    cleanup(sys);
  });
});

describe('Neighborhood — lending registry', () => {
  it('registerLendingItem adds item', async () => {
    const sys = new AdvancedNeighborhoodIntegrationSystem(createMockHomey());
    await sys.initialize();
    const item = await sys.registerLendingItem({ name: 'Drill', category: 'tools' });
    assert(item.id, 'should have id');
    assertEqual(item.name, 'Drill');
    assertEqual(item.available, true);
    cleanup(sys);
  });

  it('borrowItem marks item as borrowed', async () => {
    const sys = new AdvancedNeighborhoodIntegrationSystem(createMockHomey());
    await sys.initialize();
    const item = await sys.registerLendingItem({ name: 'Ladder' });
    const result = await sys.borrowItem(item.id, 'neighbor-1');
    assertEqual(result.success, true);
    assertEqual(result.item.available, false);
    cleanup(sys);
  });

  it('borrowItem fails for unavailable item', async () => {
    const sys = new AdvancedNeighborhoodIntegrationSystem(createMockHomey());
    await sys.initialize();
    const item = await sys.registerLendingItem({ name: 'Saw' });
    await sys.borrowItem(item.id, 'n1');
    const result = await sys.borrowItem(item.id, 'n2');
    assertEqual(result.success, false);
    cleanup(sys);
  });

  it('borrowItem fails for unknown item', async () => {
    const sys = new AdvancedNeighborhoodIntegrationSystem(createMockHomey());
    await sys.initialize();
    const result = await sys.borrowItem('nonexistent', 'n1');
    assertEqual(result.success, false);
    cleanup(sys);
  });
});

describe('Neighborhood — weather & emergency', () => {
  it('reportWeatherData records weather', async () => {
    const sys = new AdvancedNeighborhoodIntegrationSystem(createMockHomey());
    await sys.initialize();
    const reading = await sys.reportWeatherData({ temperature: 18, humidity: 65 });
    assertEqual(reading.temperature, 18);
    assertEqual(reading.humidity, 65);
    cleanup(sys);
  });

  it('getAggregatedWeather aggregates from stations', async () => {
    const sys = new AdvancedNeighborhoodIntegrationSystem(createMockHomey());
    await sys.initialize();
    await sys.reportWeatherData({ stationId: 's1', temperature: 20, humidity: 50 });
    await sys.reportWeatherData({ stationId: 's2', temperature: 22, humidity: 60 });
    const result = await sys.getAggregatedWeather();
    assertEqual(result.stationCount, 2);
    assertType(result.temperature.avg, 'number');
    cleanup(sys);
  });

  it('activateEmergencyChannel activates channel', async () => {
    const sys = new AdvancedNeighborhoodIntegrationSystem(createMockHomey());
    await sys.initialize();
    const result = await sys.activateEmergencyChannel({ type: 'fire', description: 'Smoke detected' });
    assertEqual(result.success, true);
    assertEqual(sys.emergencyChannel.active, true);
    cleanup(sys);
  });

  it('getStatus returns system status', async () => {
    const sys = new AdvancedNeighborhoodIntegrationSystem(createMockHomey());
    await sys.initialize();
    const status = await sys.getStatus();
    assertEqual(status.initialized, true);
    assertType(status.neighborCount, 'number');
    assertType(status.trustedPeerCount, 'number');
    cleanup(sys);
  });
});

run();
