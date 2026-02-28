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

const SmartApplianceController = require('../lib/SmartApplianceController');

function createController() {
  const sys = new SmartApplianceController(createMockHomey());
  // Manually register an appliance for testing
  sys.appliances.set('wm1', {
    id: 'wm1', name: 'Washing Machine', type: 'washingMachine',
    status: 'idle', currentCycle: null, energyUsage: 0,
    totalEnergyKwh: 0, totalWaterLiters: 0, maintenanceNeeded: false,
    lastMaintenance: null, cycleCount: 0, lastFaultCode: null,
    device: { id: 'wm1', name: 'Washing Machine', hasCapability: () => true, getCapabilityValue: async () => false, setCapabilityValue: async () => {} }
  });
  sys.applianceProfiles.set('wm1', {
    applianceId: 'wm1', type: 'washingMachine',
    brand: 'Test', cycles: ['quick', 'normal', 'eco'],
    avgPowerW: 500, avgCycleDurationMin: 60, avgWaterLiters: 50
  });
  return sys;
}

describe('SmartApplianceController — constructor', () => {
  it('instantiates without errors', () => {
    const sys = new SmartApplianceController(createMockHomey());
    assert(sys, 'should create instance');
    cleanup(sys);
  });

  it('has correct defaults', () => {
    const sys = new SmartApplianceController(createMockHomey());
    assertEqual(sys.appliances.size, 0);
    assertEqual(sys.energyOptimization, true);
    assertEqual(sys.interlockEnabled, true);
    assertEqual(sys.maxConcurrentPowerW, 7000);
    assert(sys.defaultProfiles.washingMachine, 'should have washing machine profile');
    cleanup(sys);
  });
});

describe('SmartApplianceController — identifyApplianceType', () => {
  it('identifies washing machine', () => {
    const sys = new SmartApplianceController(createMockHomey());
    assertEqual(sys.identifyApplianceType('washing machine'), 'washingMachine');
    assertEqual(sys.identifyApplianceType('tvättmaskin'), 'washingMachine');
    cleanup(sys);
  });

  it('identifies dryer', () => {
    const sys = new SmartApplianceController(createMockHomey());
    assertEqual(sys.identifyApplianceType('tumble dryer'), 'dryer');
    cleanup(sys);
  });

  it('identifies dishwasher', () => {
    const sys = new SmartApplianceController(createMockHomey());
    assertEqual(sys.identifyApplianceType('dishwasher'), 'dishwasher');
    assertEqual(sys.identifyApplianceType('diskmaskin'), 'dishwasher');
    cleanup(sys);
  });

  it('identifies coffee maker', () => {
    const sys = new SmartApplianceController(createMockHomey());
    assertEqual(sys.identifyApplianceType('coffee maker'), 'coffeeMaker');
    assertEqual(sys.identifyApplianceType('kaffemaskin'), 'coffeeMaker');
    cleanup(sys);
  });

  it('returns null for unknown type', () => {
    const sys = new SmartApplianceController(createMockHomey());
    assertEqual(sys.identifyApplianceType('generic device'), null);
    cleanup(sys);
  });
});

describe('SmartApplianceController — appliance profiles', () => {
  it('getApplianceProfile returns profile', () => {
    const sys = createController();
    const profile = sys.getApplianceProfile('wm1');
    assert(profile, 'should return profile');
    assertEqual(profile.type, 'washingMachine');
    cleanup(sys);
  });

  it('getApplianceProfile returns null for unknown', () => {
    const sys = createController();
    assertEqual(sys.getApplianceProfile('nonexistent'), null);
    cleanup(sys);
  });

  it('getAvailableCycles returns cycles for known appliance', () => {
    const sys = createController();
    const cycles = sys.getAvailableCycles('wm1');
    assert(cycles.length > 0, 'should have cycles');
    assert(cycles.includes('normal'), 'should include normal');
    cleanup(sys);
  });

  it('updateApplianceProfile updates profile data', () => {
    const sys = createController();
    const updated = sys.updateApplianceProfile('wm1', { brand: 'Samsung' });
    assertEqual(updated.brand, 'Samsung');
    cleanup(sys);
  });
});

describe('SmartApplianceController — energy cost tracking', () => {
  it('getEnergyCostSummary returns summary structure', () => {
    const sys = createController();
    sys.energyCostHistory.push({
      applianceId: 'wm1', applianceName: 'WM', timestamp: Date.now(),
      powerW: 500, energyKwh: 0.5, cost: 0.75, isPeak: false, rate: 1.5
    });
    const summary = sys.getEnergyCostSummary(null, 'daily');
    assertEqual(summary.period, 'daily');
    assertType(summary.totalEnergyKwh, 'number');
    assertType(summary.totalCostSEK, 'number');
    assertType(summary.peakCostSEK, 'number');
    cleanup(sys);
  });

  it('getEnergyCostSummary filters by appliance', () => {
    const sys = createController();
    sys.energyCostHistory.push(
      { applianceId: 'wm1', applianceName: 'WM', timestamp: Date.now(), powerW: 500, energyKwh: 0.5, cost: 0.75, isPeak: false, rate: 1.5 },
      { applianceId: 'other', applianceName: 'Other', timestamp: Date.now(), powerW: 100, energyKwh: 0.1, cost: 0.15, isPeak: false, rate: 1.5 }
    );
    const summary = sys.getEnergyCostSummary('wm1', 'daily');
    assertEqual(Object.keys(summary.byAppliance).length, 1);
    cleanup(sys);
  });
});

describe('SmartApplianceController — usage patterns', () => {
  it('recordUsageEvent stores pattern', () => {
    const sys = createController();
    sys.recordUsageEvent('wm1', 'normal');
    assert(sys.usagePatterns.size > 0, 'should have patterns');
    cleanup(sys);
  });

  it('getUsageSuggestions returns suggestions for frequent usage', () => {
    const sys = createController();
    const now = new Date();
    const key = `wm1_${now.getDay()}_${now.getHours()}`;
    sys.usagePatterns.set(key, { count: 5, cycleTypes: { normal: 5 } });
    const suggestions = sys.getUsageSuggestions('wm1');
    assert(suggestions.length > 0, 'should have suggestions');
    cleanup(sys);
  });
});

describe('SmartApplianceController — fault codes', () => {
  it('interpretFaultCode returns description', () => {
    const sys = createController();
    assertEqual(sys.interpretFaultCode('E01'), 'Water inlet error');
    assertEqual(sys.interpretFaultCode('E09'), 'Water leak detected');
    cleanup(sys);
  });

  it('interpretFaultCode handles unknown codes', () => {
    const sys = createController();
    assert(sys.interpretFaultCode('E99').includes('Unknown'), 'should indicate unknown');
    cleanup(sys);
  });
});

describe('SmartApplianceController — interlock', () => {
  it('canStartAppliance allows when under limit', () => {
    const sys = createController();
    const result = sys.canStartAppliance('wm1');
    assertEqual(result.allowed, true);
    cleanup(sys);
  });

  it('canStartAppliance blocks when over limit', () => {
    const sys = createController();
    sys.maxConcurrentPowerW = 400;
    // Add a running appliance consuming 500W
    sys.appliances.get('wm1').status = 'running';
    sys.appliances.get('wm1').energyUsage = 500;
    const result = sys.canStartAppliance('wm1');
    assertEqual(result.allowed, false);
    assert(result.reason, 'should have reason');
    cleanup(sys);
  });

  it('canStartAppliance always allows when interlock disabled', () => {
    const sys = createController();
    sys.interlockEnabled = false;
    const result = sys.canStartAppliance('wm1');
    assertEqual(result.allowed, true);
    cleanup(sys);
  });
});

describe('SmartApplianceController — water usage', () => {
  it('recordWaterUsage tracks water', () => {
    const sys = createController();
    sys.recordWaterUsage('wm1', 50);
    assertEqual(sys.waterUsageHistory.length, 1);
    assertEqual(sys.appliances.get('wm1').totalWaterLiters, 50);
    cleanup(sys);
  });

  it('getWaterUsageSummary returns summary', () => {
    const sys = createController();
    sys.recordWaterUsage('wm1', 50);
    const summary = sys.getWaterUsageSummary('daily');
    assertEqual(summary.totalLiters, 50);
    assertType(summary.totalCostSEK, 'number');
    cleanup(sys);
  });
});

describe('SmartApplianceController — consumables', () => {
  it('addConsumable stores consumable', async () => {
    const sys = createController();
    await sys.addConsumable('wm1', { type: 'detergent', name: 'Detergent', level: 80 });
    assertEqual(sys.consumables.size, 1);
    cleanup(sys);
  });

  it('getConsumableStatus returns status', async () => {
    const sys = createController();
    await sys.addConsumable('wm1', { type: 'filter', name: 'Filter' });
    const status = sys.getConsumableStatus('wm1');
    assertEqual(status.length, 1);
    assertEqual(status[0].type, 'filter');
    cleanup(sys);
  });

  it('getConsumableStatus filters by appliance', async () => {
    const sys = createController();
    await sys.addConsumable('wm1', { type: 'filter', name: 'Filter' });
    const all = sys.getConsumableStatus();
    const filtered = sys.getConsumableStatus('other');
    assertEqual(all.length, 1);
    assertEqual(filtered.length, 0);
    cleanup(sys);
  });
});

describe('SmartApplianceController — notification escalation', () => {
  it('acknowledgeNotification clears escalation', async () => {
    const sys = createController();
    const escId = 'esc_wm1_123';
    sys.pendingNotifications.set(escId, { acknowledged: false });
    assertEqual(sys.acknowledgeNotification(escId), true);
    assertEqual(sys.pendingNotifications.get(escId).acknowledged, true);
    cleanup(sys);
  });

  it('acknowledgeNotification returns false for unknown', () => {
    const sys = createController();
    assertEqual(sys.acknowledgeNotification('nonexistent'), false);
    cleanup(sys);
  });
});

describe('SmartApplianceController — maintenance', () => {
  it('performMaintenance clears maintenance flag', async () => {
    const sys = createController();
    sys.appliances.get('wm1').maintenanceNeeded = true;
    await sys.performMaintenance('wm1');
    assertEqual(sys.appliances.get('wm1').maintenanceNeeded, false);
    assert(sys.appliances.get('wm1').lastMaintenance > 0, 'should record timestamp');
    cleanup(sys);
  });
});

describe('SmartApplianceController — programMultiStepCycle', () => {
  it('creates multi-step program', async () => {
    const sys = createController();
    const program = await sys.programMultiStepCycle('wm1', [
      { cycleType: 'quick', durationMin: 15 },
      { cycleType: 'normal', durationMin: 60 }
    ]);
    assertEqual(program.steps.length, 2);
    assertEqual(program.status, 'ready');
    assertEqual(program.steps[0].cycleType, 'quick');
    cleanup(sys);
  });

  it('throws for unknown appliance', async () => {
    const sys = createController();
    let threw = false;
    try {
      await sys.programMultiStepCycle('nonexistent', []);
    } catch (_e) {
      threw = true;
    }
    assertEqual(threw, true);
    cleanup(sys);
  });
});

describe('SmartApplianceController — getStatistics', () => {
  it('returns comprehensive statistics', () => {
    const sys = createController();
    const stats = sys.getStatistics();
    assertEqual(stats.totalAppliances, 1);
    assertEqual(stats.energyOptimization, true);
    assertEqual(stats.interlockEnabled, true);
    assertType(stats.totalCycles, 'number');
    assert(stats.energySummary, 'should have energy summary');
    assert(stats.waterSummary, 'should have water summary');
    cleanup(sys);
  });
});

describe('SmartApplianceController — destroy', () => {
  it('cleans up intervals and timers', async () => {
    const sys = createController();
    await sys.startMonitoring();
    sys.destroy();
    assertEqual(sys.monitoringInterval, null);
    cleanup(sys);
  });
});

run();
