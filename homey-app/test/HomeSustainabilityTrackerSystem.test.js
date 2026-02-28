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

const HomeSustainabilityTrackerSystem = require('../lib/HomeSustainabilityTrackerSystem');

describe('HomeSustainabilityTrackerSystem — constructor & init', () => {
  it('instantiates without errors', () => {
    const sys = new HomeSustainabilityTrackerSystem(createMockHomey());
    assert(sys, 'should create instance');
    assertEqual(sys.initialized, false);
    cleanup(sys);
  });

  it('initialize sets flag', async () => {
    const sys = new HomeSustainabilityTrackerSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.initialized, true);
    cleanup(sys);
  });

  it('destroy clears state', async () => {
    const sys = new HomeSustainabilityTrackerSystem(createMockHomey());
    await sys.initialize();
    await sys.destroy();
    assertEqual(sys.initialized, false);
    cleanup(sys);
  });
});

describe('HomeSustainabilityTrackerSystem — device emissions', () => {
  it('registerDevice adds device', async () => {
    const sys = new HomeSustainabilityTrackerSystem(createMockHomey());
    await sys.initialize();
    const device = sys.registerDevice('lamp1', { name: 'Desk Lamp', room: 'office', watts: 12 });
    assert(device, 'should return device');
    cleanup(sys);
  });

  it('recordDeviceConsumption logs kWh and CO2', async () => {
    const sys = new HomeSustainabilityTrackerSystem(createMockHomey());
    await sys.initialize();
    sys.registerDevice('pc1', { name: 'PC', room: 'office', watts: 250 });
    const result = sys.recordDeviceConsumption('pc1', 2.5, 10);
    assert(result, 'should return result');
    cleanup(sys);
  });

  it('getDeviceEmissions returns data', async () => {
    const sys = new HomeSustainabilityTrackerSystem(createMockHomey());
    await sys.initialize();
    sys.registerDevice('pc1', { name: 'PC', room: 'office', watts: 250 });
    sys.recordDeviceConsumption('pc1', 1.0, 4);
    const emissions = sys.getDeviceEmissions('pc1');
    assert(emissions, 'should return emissions');
    cleanup(sys);
  });

  it('unregisterDevice removes device', async () => {
    const sys = new HomeSustainabilityTrackerSystem(createMockHomey());
    await sys.initialize();
    sys.registerDevice('temp1', { name: 'Temp', room: 'office', watts: 10 });
    const result = sys.unregisterDevice('temp1');
    assertEqual(result, true);
    cleanup(sys);
  });

  it('getTopEmittingDevices returns sorted list', async () => {
    const sys = new HomeSustainabilityTrackerSystem(createMockHomey());
    await sys.initialize();
    sys.registerDevice('d1', { name: 'D1', room: 'r1', watts: 100 });
    sys.registerDevice('d2', { name: 'D2', room: 'r1', watts: 200 });
    sys.recordDeviceConsumption('d1', 10, 10);
    sys.recordDeviceConsumption('d2', 20, 10);
    const top = sys.getTopEmittingDevices(5);
    assert(Array.isArray(top), 'should be array');
    cleanup(sys);
  });
});

describe('HomeSustainabilityTrackerSystem — energy sources', () => {
  it('updateEnergySourceShare changes share', async () => {
    const sys = new HomeSustainabilityTrackerSystem(createMockHomey());
    await sys.initialize();
    sys.updateEnergySourceShare('solar', 50);
    assertEqual(sys.energySources.solar.currentSharePercent, 50);
    cleanup(sys);
  });

  it('getGreenEnergyPercentage returns number', async () => {
    const sys = new HomeSustainabilityTrackerSystem(createMockHomey());
    await sys.initialize();
    const pct = sys.getGreenEnergyPercentage();
    assertType(pct, 'number');
    cleanup(sys);
  });

  it('getEnergySourceBreakdown returns all sources', async () => {
    const sys = new HomeSustainabilityTrackerSystem(createMockHomey());
    await sys.initialize();
    const breakdown = sys.getEnergySourceBreakdown();
    assert(Array.isArray(breakdown), 'should be array');
    assert(breakdown.length > 0, 'should have sources');
    cleanup(sys);
  });
});

describe('HomeSustainabilityTrackerSystem — water tracking', () => {
  it('recordWaterUsage logs usage', async () => {
    const sys = new HomeSustainabilityTrackerSystem(createMockHomey());
    await sys.initialize();
    sys.recordWaterUsage(150);
    assert(sys.waterTracking.dailyUsageLiters.length >= 1, 'should have water log');
    cleanup(sys);
  });

  it('getWaterFootprint returns footprint data', async () => {
    const sys = new HomeSustainabilityTrackerSystem(createMockHomey());
    await sys.initialize();
    sys.recordWaterUsage(200);
    const fp = sys.getWaterFootprint(7);
    assert(fp, 'should return footprint');
    cleanup(sys);
  });

  it('setHouseholdSize updates size', async () => {
    const sys = new HomeSustainabilityTrackerSystem(createMockHomey());
    await sys.initialize();
    sys.setHouseholdSize(4);
    assertEqual(sys.waterTracking.householdSize, 4);
    cleanup(sys);
  });
});

describe('HomeSustainabilityTrackerSystem — transport', () => {
  it('addTransportProfile creates profile', async () => {
    const sys = new HomeSustainabilityTrackerSystem(createMockHomey());
    await sys.initialize();
    const profile = sys.addTransportProfile('car', { type: 'petrol', kgCO2PerKm: 0.12 });
    assert(profile, 'should return profile');
    cleanup(sys);
  });

  it('logTrip records a trip', async () => {
    const sys = new HomeSustainabilityTrackerSystem(createMockHomey());
    await sys.initialize();
    sys.addTransportProfile('car', { type: 'petrol', kgCO2PerKm: 0.12 });
    const trip = sys.logTrip('car', 30, 'commute');
    assert(trip, 'should return trip');
    cleanup(sys);
  });

  it('getTransportSummary returns summary', async () => {
    const sys = new HomeSustainabilityTrackerSystem(createMockHomey());
    await sys.initialize();
    sys.addTransportProfile('bike', { type: 'bicycle', kgCO2PerKm: 0 });
    sys.logTrip('bike', 10, 'exercise');
    const summary = sys.getTransportSummary();
    assert(summary, 'should return summary');
    cleanup(sys);
  });

  it('removeTransportProfile removes profile', async () => {
    const sys = new HomeSustainabilityTrackerSystem(createMockHomey());
    await sys.initialize();
    sys.addTransportProfile('bus', { type: 'public', kgCO2PerKm: 0.05 });
    const result = sys.removeTransportProfile('bus');
    assertEqual(result, true);
    cleanup(sys);
  });
});

describe('HomeSustainabilityTrackerSystem — goals & badges', () => {
  it('addGoal creates a goal', async () => {
    const sys = new HomeSustainabilityTrackerSystem(createMockHomey());
    await sys.initialize();
    const goal = sys.addGoal({ name: 'Reduce CO2', type: 'reduction', target: 100, unit: 'kgCO2', period: 'monthly' });
    assert(goal, 'should return goal');
    cleanup(sys);
  });

  it('removeGoal deletes a goal', async () => {
    const sys = new HomeSustainabilityTrackerSystem(createMockHomey());
    await sys.initialize();
    const goal = sys.addGoal({ name: 'Test', type: 'reduction', target: 50, unit: 'kgCO2', period: 'monthly' });
    const result = sys.removeGoal(goal.id);
    assertEqual(result, true);
    cleanup(sys);
  });

  it('getBadges returns all badges', async () => {
    const sys = new HomeSustainabilityTrackerSystem(createMockHomey());
    await sys.initialize();
    const badges = sys.getBadges();
    assert(badges, 'should return badges');
    assert(Array.isArray(badges), 'should be array');
    assert(badges.length > 0, 'should have badges');
    cleanup(sys);
  });
});

describe('HomeSustainabilityTrackerSystem — appliance & reporting', () => {
  it('registerAppliance adds appliance', async () => {
    const sys = new HomeSustainabilityTrackerSystem(createMockHomey());
    await sys.initialize();
    const app = sys.registerAppliance('fridge1', { name: 'Fridge', type: 'refrigerator', annualKWh: 200, euLabel: 'A++' });
    assert(app, 'should return appliance');
    cleanup(sys);
  });

  it('getEfficiencyOverview returns data', async () => {
    const sys = new HomeSustainabilityTrackerSystem(createMockHomey());
    await sys.initialize();
    sys.registerAppliance('wash1', { name: 'Washer', type: 'washing_machine', annualKWh: 150, euLabel: 'A+' });
    const overview = sys.getEfficiencyOverview();
    assert(overview, 'should return overview');
    cleanup(sys);
  });

  it('getContextualTips returns tips', async () => {
    const sys = new HomeSustainabilityTrackerSystem(createMockHomey());
    await sys.initialize();
    const tips = sys.getContextualTips(3);
    assert(Array.isArray(tips), 'should be array');
    assert(tips.length > 0, 'should have tips');
    cleanup(sys);
  });

  it('getHomeEmissionsSummary returns summary', async () => {
    const sys = new HomeSustainabilityTrackerSystem(createMockHomey());
    await sys.initialize();
    const summary = sys.getHomeEmissionsSummary();
    assert(summary, 'should return summary');
    assertType(summary.totalKgCO2, 'number');
    cleanup(sys);
  });

  it('getStatistics returns comprehensive stats', async () => {
    const sys = new HomeSustainabilityTrackerSystem(createMockHomey());
    await sys.initialize();
    const stats = sys.getStatistics();
    assertEqual(stats.initialized, true);
    cleanup(sys);
  });

  it('addCarbonOffset logs offset', async () => {
    const sys = new HomeSustainabilityTrackerSystem(createMockHomey());
    await sys.initialize();
    const offset = sys.addCarbonOffset({ name: 'Tree planting', kgCO2Offset: 100, costSEK: 500, verified: true });
    assert(offset, 'should return offset');
    cleanup(sys);
  });

  it('getNeighbourhoodComparison returns comparison', async () => {
    const sys = new HomeSustainabilityTrackerSystem(createMockHomey());
    await sys.initialize();
    const comparison = sys.getNeighbourhoodComparison();
    assert(comparison, 'should return comparison');
    cleanup(sys);
  });
});

run();
