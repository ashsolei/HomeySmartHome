'use strict';

const { describe, it, run } = require('./helpers/runner');
const {
  assert, assertEqual, assertType, assertRejects,
  assertInstanceOf
} = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');

const EnergyStorageManagementSystem = require('../lib/EnergyStorageManagementSystem');

/* ──── timer tracking ────
 * startManagement() creates 4 named intervals plus the initial
 * monitorEnergyFlow. We track and clean ALL handles.
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

/* ──── mock devices ──── */
function createMockDevice(id, name, capabilities = {}, settings = {}) {
  return {
    id,
    name,
    hasCapability: (cap) => cap in capabilities,
    getCapabilityValue: async (cap) => capabilities[cap] || 0,
    getSettings: async () => settings
  };
}

function createMockDevices() {
  return [
    createMockDevice('bat-1', 'Home Battery Pack', {
      measure_battery: 75,
      measure_power: 200
    }, { capacity: 13500 }),
    createMockDevice('solar-1', 'Solar Panel Array', {
      measure_power: 3500,
      'measure_power.solar': 3500
    }),
    createMockDevice('grid-1', 'Grid Meter', {
      measure_power: -500
    })
  ];
}

/* ──── helpers ──── */
function createSystem(devices) {
  const homey = createMockHomey();
  homey.drivers = {
    getDevices: () => devices || createMockDevices()
  };
  const sys = new EnergyStorageManagementSystem(homey);
  return { homey, sys };
}

function cleanup(sys) {
  try { sys.destroy(); } catch (_) { /* ignore */ }
  while (activeHandles.length > 0) {
    const h = activeHandles.pop();
    if (h.type === 'timeout') clearTimeout(h.id);
    else clearInterval(h.id);
  }
}

/* ================================================================
   TESTS
   ================================================================ */

describe('EnergyStorageManagementSystem — constructor', () => {
  it('creates an instance with correct defaults', () => {
    const { sys } = createSystem([]);
    assertInstanceOf(sys.storageDevices, Map);
    assertInstanceOf(sys.solarPanels, Map);
    assertEqual(sys.gridConnection, null);
    assert(Array.isArray(sys.chargingSchedule), 'chargingSchedule should be array');
    assertEqual(sys.chargingSchedule.length, 0);
    assertEqual(sys.energyStrategy, 'balanced');
    assert(Array.isArray(sys.storageHistory), 'storageHistory should be array');
    assertEqual(sys.storageHistory.length, 0);
    cleanup(sys);
  });

  it('stores homey reference', () => {
    const { sys, homey } = createSystem([]);
    assertEqual(sys.homey, homey);
    cleanup(sys);
  });
});

describe('EnergyStorageManagementSystem — initialize()', () => {
  it('discovers battery devices', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.storageDevices.size, 1);
    assert(sys.storageDevices.has('bat-1'), 'should discover battery');
    cleanup(sys);
  });

  it('discovers solar panels', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.solarPanels.size, 1);
    assert(sys.solarPanels.has('solar-1'), 'should discover solar');
    cleanup(sys);
  });

  it('discovers grid connection', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assert(sys.gridConnection !== null, 'should discover grid');
    assertEqual(sys.gridConnection.id, 'grid-1');
    cleanup(sys);
  });

  it('loads saved charging schedule from settings', async () => {
    const savedSchedule = [{ hour: 0, action: 'charge', reason: 'test', price: 0.5 }];
    const { sys, homey } = createSystem([]);
    homey.settings.set('chargingSchedule', savedSchedule);
    await sys.initialize();
    assertEqual(sys.chargingSchedule.length, 1);
    assertEqual(sys.chargingSchedule[0].reason, 'test');
    cleanup(sys);
  });

  it('loads saved energy strategy from settings', async () => {
    const { sys, homey } = createSystem([]);
    homey.settings.set('energyStrategy', 'eco-mode');
    await sys.initialize();
    assertEqual(sys.energyStrategy, 'eco-mode');
    cleanup(sys);
  });

  it('defaults strategy to balanced when none saved', async () => {
    const { sys } = createSystem([]);
    await sys.initialize();
    assertEqual(sys.energyStrategy, 'balanced');
    cleanup(sys);
  });

  it('sets up strategies object', async () => {
    const { sys } = createSystem([]);
    await sys.initialize();
    assertType(sys.strategies, 'object');
    assert('balanced' in sys.strategies, 'should have balanced strategy');
    assert('self-consumption' in sys.strategies, 'should have self-consumption');
    assert('cost-optimization' in sys.strategies, 'should have cost-optimization');
    assert('backup-priority' in sys.strategies, 'should have backup-priority');
    assert('eco-mode' in sys.strategies, 'should have eco-mode');
    cleanup(sys);
  });

  it('starts 4 named intervals', async () => {
    const { sys } = createSystem([]);
    await sys.initialize();
    assert(sys.monitoringInterval !== null && sys.monitoringInterval !== undefined,
      'should have monitoringInterval');
    assert(sys.optimizationInterval !== null && sys.optimizationInterval !== undefined,
      'should have optimizationInterval');
    assert(sys.strategyInterval !== null && sys.strategyInterval !== undefined,
      'should have strategyInterval');
    assert(sys.forecastInterval !== null && sys.forecastInterval !== undefined,
      'should have forecastInterval');
    cleanup(sys);
  });

  it('does not re-throw errors', async () => {
    const { sys, homey } = createSystem([]);
    // Break drivers to cause error
    homey.drivers = { getDevices: () => { throw new Error('boom'); } };
    // Should not throw
    await sys.initialize();
    cleanup(sys);
  });

  it('handles empty device list gracefully', async () => {
    const { sys } = createSystem([]);
    await sys.initialize();
    assertEqual(sys.storageDevices.size, 0);
    assertEqual(sys.solarPanels.size, 0);
    assertEqual(sys.gridConnection, null);
    cleanup(sys);
  });
});

describe('EnergyStorageManagementSystem — device discovery', () => {
  it('detects storage via measure_battery capability', async () => {
    const devices = [
      createMockDevice('dev-1', 'Some RandomDevice', { measure_battery: 80 })
    ];
    const { sys } = createSystem(devices);
    await sys.initialize();
    assertEqual(sys.storageDevices.size, 1);
    cleanup(sys);
  });

  it('detects solar via measure_power.solar capability', async () => {
    const devices = [
      createMockDevice('dev-2', 'Roof Thing', { 'measure_power.solar': 2000 })
    ];
    const { sys } = createSystem(devices);
    await sys.initialize();
    assertEqual(sys.solarPanels.size, 1);
    cleanup(sys);
  });

  it('detects battery by name containing "battery"', async () => {
    const devices = [
      createMockDevice('dev-3', 'My Battery Unit', {})
    ];
    const { sys } = createSystem(devices);
    await sys.initialize();
    assertEqual(sys.storageDevices.size, 1);
    cleanup(sys);
  });

  it('detects solar by name containing "solar"', async () => {
    const devices = [
      createMockDevice('dev-4', 'Solar Station', {})
    ];
    const { sys } = createSystem(devices);
    await sys.initialize();
    assertEqual(sys.solarPanels.size, 1);
    cleanup(sys);
  });

  it('detects grid by name containing "grid"', async () => {
    const devices = [
      createMockDevice('dev-5', 'Grid Connection', {})
    ];
    const { sys } = createSystem(devices);
    await sys.initialize();
    assert(sys.gridConnection !== null, 'should detect grid');
    cleanup(sys);
  });

  it('detects grid by name containing "meter"', async () => {
    const devices = [
      createMockDevice('dev-6', 'Power Meter Main', {})
    ];
    const { sys } = createSystem(devices);
    await sys.initialize();
    assert(sys.gridConnection !== null, 'should detect meter as grid');
    cleanup(sys);
  });

  it('detects capacity from device settings', async () => {
    const devices = [
      createMockDevice('bat-x', 'Battery X', { measure_battery: 50 }, { capacity: 20000 })
    ];
    const { sys } = createSystem(devices);
    await sys.initialize();
    const storage = sys.storageDevices.get('bat-x');
    assertEqual(storage.capacity, 20000);
    cleanup(sys);
  });

  it('falls back to 10000 capacity when no settings', async () => {
    const devices = [
      createMockDevice('bat-y', 'Battery Y', { measure_battery: 50 }, {})
    ];
    const { sys } = createSystem(devices);
    await sys.initialize();
    const storage = sys.storageDevices.get('bat-y');
    assertEqual(storage.capacity, 10000);
    cleanup(sys);
  });
});

describe('EnergyStorageManagementSystem — setEnergyStrategy', () => {
  it('sets valid strategy and persists', async () => {
    const { sys, homey } = createSystem([]);
    await sys.initialize();
    await sys.setEnergyStrategy('eco-mode');
    assertEqual(sys.energyStrategy, 'eco-mode');
    assertEqual(homey.settings.get('energyStrategy'), 'eco-mode');
    cleanup(sys);
  });

  it('throws for unknown strategy', async () => {
    const { sys } = createSystem([]);
    await sys.initialize();
    await assertRejects(
      () => sys.setEnergyStrategy('invalid-strategy'),
      'Unknown strategy'
    );
    cleanup(sys);
  });

  it('accepts all 5 valid strategies', async () => {
    const strategies = ['balanced', 'self-consumption', 'cost-optimization', 'backup-priority', 'eco-mode'];
    for (const s of strategies) {
      const { sys } = createSystem([]);
      await sys.initialize();
      await sys.setEnergyStrategy(s);
      assertEqual(sys.energyStrategy, s);
      cleanup(sys);
    }
  });
});

describe('EnergyStorageManagementSystem — monitorEnergyFlow', () => {
  it('returns flow data structure', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const flow = await sys.monitorEnergyFlow();
    assertType(flow, 'object');
    assertType(flow.timestamp, 'number');
    assertType(flow.solar, 'object');
    assertType(flow.battery, 'object');
    assertType(flow.grid, 'object');
    assertType(flow.consumption, 'number');
    cleanup(sys);
  });

  it('records history', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const before = sys.storageHistory.length;
    await sys.monitorEnergyFlow();
    assert(sys.storageHistory.length > before, 'should add to history');
    cleanup(sys);
  });

  it('caps history at 1000 via shift when exceeding limit', async () => {
    const { sys } = createSystem([]);
    await sys.initialize();
    // Fill to exactly 1000
    while (sys.storageHistory.length < 1000) {
      sys.storageHistory.push({ timestamp: Date.now(), solar: { production: 0 }, battery: { percentage: 0 }, grid: { importing: 0, exporting: 0 } });
    }
    assertEqual(sys.storageHistory.length, 1000);
    // Adding one more via monitorEnergyFlow pushes to 1001, shift brings it back to 1000
    await sys.monitorEnergyFlow();
    assertEqual(sys.storageHistory.length, 1000);
    cleanup(sys);
  });

  it('updates solar panel production', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const flow = await sys.monitorEnergyFlow();
    assert(flow.solar.production > 0, 'should have solar production');
    assert(flow.solar.devices.length > 0, 'should list solar devices');
    cleanup(sys);
  });

  it('updates battery status', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const flow = await sys.monitorEnergyFlow();
    assert(flow.battery.devices.length > 0, 'should list battery devices');
    assertType(flow.battery.percentage, 'number');
    cleanup(sys);
  });

  it('includes baseline consumption', async () => {
    const { sys } = createSystem([]);
    await sys.initialize();
    const flow = await sys.monitorEnergyFlow();
    assert(flow.consumption >= 200, 'should include 200W baseline');
    cleanup(sys);
  });
});

describe('EnergyStorageManagementSystem — optimizeCharging', () => {
  it('creates 24-hour schedule', async () => {
    const { sys } = createSystem([]);
    await sys.initialize();
    await sys.optimizeCharging();
    assertEqual(sys.chargingSchedule.length, 24);
    cleanup(sys);
  });

  it('schedule entries have correct structure', async () => {
    const { sys } = createSystem([]);
    await sys.initialize();
    await sys.optimizeCharging();
    for (const entry of sys.chargingSchedule) {
      assertType(entry.hour, 'number');
      assertType(entry.action, 'string');
      assertType(entry.reason, 'string');
    }
    cleanup(sys);
  });

  it('saves schedule to settings', async () => {
    const { sys, homey } = createSystem([]);
    await sys.initialize();
    await sys.optimizeCharging();
    const saved = homey.settings.get('chargingSchedule');
    assert(Array.isArray(saved), 'should save array to settings');
    assertEqual(saved.length, 24);
    cleanup(sys);
  });
});

describe('EnergyStorageManagementSystem — evaluateStrategy', () => {
  it('returns early when insufficient history', async () => {
    const { sys } = createSystem([]);
    await sys.initialize();
    // Should not throw with <100 records
    await sys.evaluateStrategy();
    cleanup(sys);
  });

  it('processes when enough history exists', async () => {
    const { sys } = createSystem([]);
    await sys.initialize();
    // Fill 200 records
    for (let i = 0; i < 200; i++) {
      sys.storageHistory.push({
        solar: { production: 1000 },
        battery: { percentage: 50 },
        grid: { importing: 200, exporting: 100 }
      });
    }
    // Should not throw
    await sys.evaluateStrategy();
    cleanup(sys);
  });
});

describe('EnergyStorageManagementSystem — energy forecast', () => {
  it('updateEnergyForecast generates forecast data', async () => {
    const { sys } = createSystem([]);
    await sys.initialize();
    await sys.updateEnergyForecast();
    assertType(sys.forecastData, 'object');
    assertType(sys.forecastData.today, 'object');
    assertType(sys.forecastData.tomorrow, 'object');
    assertType(sys.forecastData.tomorrowSolar, 'string');
    assert(Array.isArray(sys.forecastData.hourly), 'should have hourly array');
    assertEqual(sys.forecastData.hourly.length, 48);
    cleanup(sys);
  });

  it('estimateSolarProduction returns a positive number', () => {
    const { sys } = createSystem([]);
    const prod = sys.estimateSolarProduction('today');
    assertType(prod, 'number');
    assert(prod > 0, 'should be > 0');
    cleanup(sys);
  });

  it('estimateHourlySolar returns 0 at night', () => {
    const { sys } = createSystem([]);
    assertEqual(sys.estimateHourlySolar(3), 0);
    assertEqual(sys.estimateHourlySolar(23), 0);
    cleanup(sys);
  });

  it('estimateHourlySolar returns positive during day', () => {
    const { sys } = createSystem([]);
    const noon = sys.estimateHourlySolar(12);
    assert(noon > 0, 'noon should produce > 0');
    cleanup(sys);
  });
});

describe('EnergyStorageManagementSystem — battery charging control', () => {
  it('enableBatteryCharging sets charging flag', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const bat = sys.storageDevices.get('bat-1');
    bat.charging = false;
    await sys.enableBatteryCharging();
    assertEqual(bat.charging, true);
    cleanup(sys);
  });

  it('disableBatteryCharging clears charging flag', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const bat = sys.storageDevices.get('bat-1');
    bat.charging = true;
    await sys.disableBatteryCharging();
    assertEqual(bat.charging, false);
    cleanup(sys);
  });

  it('forceCharging(true) enables all', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    await sys.forceCharging(true);
    for (const [, s] of sys.storageDevices) {
      assertEqual(s.charging, true);
    }
    cleanup(sys);
  });

  it('forceCharging(false) disables all', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    await sys.forceCharging(true);
    await sys.forceCharging(false);
    for (const [, s] of sys.storageDevices) {
      assertEqual(s.charging, false);
    }
    cleanup(sys);
  });
});

describe('EnergyStorageManagementSystem — getStatistics', () => {
  it('returns stats structure', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const stats = sys.getStatistics();
    assertType(stats, 'object');
    assertEqual(stats.strategy, 'balanced');
    assert(Array.isArray(stats.storageDevices), 'should have storageDevices array');
    assert(Array.isArray(stats.solarPanels), 'should have solarPanels array');
    assert(Array.isArray(stats.chargingSchedule), 'should have chargingSchedule');
    assertType(stats.forecast, 'object');
    assert(Array.isArray(stats.history), 'should have history array');
    cleanup(sys);
  });

  it('history is limited to last 100', async () => {
    const { sys } = createSystem([]);
    await sys.initialize();
    for (let i = 0; i < 200; i++) {
      sys.storageHistory.push({ i });
    }
    const stats = sys.getStatistics();
    assertEqual(stats.history.length, 100);
    cleanup(sys);
  });
});

describe('EnergyStorageManagementSystem — getElectricityPrices', () => {
  it('returns 24 prices', async () => {
    const { sys } = createSystem([]);
    const prices = await sys.getElectricityPrices();
    assert(Array.isArray(prices), 'should be array');
    assertEqual(prices.length, 24);
    cleanup(sys);
  });

  it('peak prices are higher than off-peak', async () => {
    const { sys } = createSystem([]);
    const prices = await sys.getElectricityPrices();
    assert(prices[12] > prices[2], 'midday should cost more than night');
    cleanup(sys);
  });
});

describe('EnergyStorageManagementSystem — destroy()', () => {
  it('clears all 4 intervals', async () => {
    const { sys } = createSystem([]);
    await sys.initialize();
    assert(sys.monitoringInterval !== null, 'should have monitoring');
    sys.destroy();
    assertEqual(sys.monitoringInterval, null);
    assertEqual(sys.optimizationInterval, null);
    assertEqual(sys.strategyInterval, null);
    assertEqual(sys.forecastInterval, null);
    while (activeHandles.length > 0) {
      const h = activeHandles.pop();
      if (h.type === 'timeout') clearTimeout(h.id);
      else clearInterval(h.id);
    }
  });

  it('is safe to call twice', async () => {
    const { sys } = createSystem([]);
    await sys.initialize();
    sys.destroy();
    sys.destroy(); // should not throw
    while (activeHandles.length > 0) {
      const h = activeHandles.pop();
      if (h.type === 'timeout') clearTimeout(h.id);
      else clearInterval(h.id);
    }
  });
});

describe('EnergyStorageManagementSystem — log / error', () => {
  it('log method calls console.log', () => {
    const { sys } = createSystem([]);
    // Should not throw
    sys.log('test message');
    cleanup(sys);
  });

  it('error method calls console.error', () => {
    const { sys } = createSystem([]);
    sys.error('test error');
    cleanup(sys);
  });
});

run();
