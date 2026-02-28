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

const PowerContinuityUPSSystem = require('../lib/PowerContinuityUPSSystem');

/* ================================================================== */
/*  PowerContinuityUPSSystem – test suite                              */
/* ================================================================== */

describe('PowerContinuityUPSSystem — constructor & lifecycle', () => {
  it('instantiates without errors', () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    assert(sys, 'should create instance');
    cleanup(sys);
  });

  it('starts uninitialized with correct defaults', () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    assertEqual(sys._initialized, false);
    assertEqual(sys.upsDevices.size, 0);
    assertEqual(sys.gridStatus.online, true);
    assertEqual(sys.gridStatus.voltage, 230);
    assertEqual(sys.currentOutage, null);
    assertEqual(sys.stats.totalOutages, 0);
    cleanup(sys);
  });

  it('initialize sets initialized flag', async () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys._initialized, true);
    assert(sys.testSchedule.nextTestTime > 0, 'should schedule self-test');
    cleanup(sys);
  });

  it('destroy clears intervals and resets flag', async () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    await sys.initialize();
    sys.destroy();
    assertEqual(sys._initialized, false);
    assertEqual(sys._intervals.length, 0);
    cleanup(sys);
  });
});

describe('PowerContinuityUPSSystem — UPS registry', () => {
  it('registerUPS creates a UPS device', () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    const id = sys.registerUPS('Main UPS', { capacityWh: 2000 });
    assert(id, 'should return id');
    assertEqual(sys.upsDevices.size, 1);
    const ups = sys.upsDevices.get(id);
    assertEqual(ups.name, 'Main UPS');
    assertEqual(ups.capacityWh, 2000);
    assertEqual(ups.status, 'online');
    cleanup(sys);
  });

  it('registerUPS assigns default values', () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    const id = sys.registerUPS('Test');
    const ups = sys.upsDevices.get(id);
    assertEqual(ups.capacityWh, 1500);
    assertEqual(ups.batteryPct, 100);
    assertEqual(ups.batteryHealthPct, 100);
    cleanup(sys);
  });

  it('unregisterUPS removes device', () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    const id = sys.registerUPS('Test');
    assertEqual(sys.unregisterUPS(id), true);
    assertEqual(sys.upsDevices.size, 0);
    cleanup(sys);
  });

  it('unregisterUPS returns false for unknown id', () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    assertEqual(sys.unregisterUPS('nonexistent'), false);
    cleanup(sys);
  });

  it('getUPSStatus returns UPS or null', () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    const id = sys.registerUPS('Test');
    assert(sys.getUPSStatus(id), 'should return UPS');
    assertEqual(sys.getUPSStatus('nonexistent'), null);
    cleanup(sys);
  });

  it('listUPSDevices returns all devices', () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    sys.registerUPS('UPS1');
    sys.registerUPS('UPS2');
    assertEqual(sys.listUPSDevices().length, 2);
    cleanup(sys);
  });

  it('updateUPSMetrics updates metrics correctly', () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    const id = sys.registerUPS('Test', { capacityWh: 1000 });
    sys.updateUPSMetrics(id, { currentLoadW: 500, batteryPct: 80, temperature: 30 });
    const ups = sys.upsDevices.get(id);
    assertEqual(ups.currentLoadW, 500);
    assertEqual(ups.batteryPct, 80);
    assertEqual(ups.temperature, 30);
    assert(ups.runtimeEstimateSec > 0, 'should estimate runtime');
    cleanup(sys);
  });

  it('updateUPSMetrics clamps battery to 0-100', () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    const id = sys.registerUPS('Test');
    sys.updateUPSMetrics(id, { batteryPct: 150 });
    assertEqual(sys.upsDevices.get(id).batteryPct, 100);
    sys.updateUPSMetrics(id, { batteryPct: -10 });
    assertEqual(sys.upsDevices.get(id).batteryPct, 0);
    cleanup(sys);
  });

  it('updateUPSMetrics returns false for unknown id', () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    assertEqual(sys.updateUPSMetrics('nonexistent', {}), false);
    cleanup(sys);
  });
});

describe('PowerContinuityUPSSystem — grid status & outage', () => {
  it('updateGridStatus stores voltage and frequency', () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    sys.updateGridStatus(232, 50.1);
    assertEqual(sys.gridStatus.voltage, 232);
    assertEqual(sys.gridStatus.frequency, 50.1);
    cleanup(sys);
  });

  it('updateGridStatus detects outage when online goes false', () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    sys.registerUPS('Test');
    sys.updateGridStatus(0, 0, false);
    assertEqual(sys.gridStatus.online, false);
    assert(sys.currentOutage, 'should create current outage');
    assertEqual(sys.stats.totalOutages, 1);
    cleanup(sys);
  });

  it('updateGridStatus detects power restored', () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    sys.registerUPS('Test');
    sys.updateGridStatus(0, 0, false);
    sys.updateGridStatus(230, 50, true);
    assertEqual(sys.gridStatus.online, true);
    assertEqual(sys.currentOutage, null);
    assert(sys.outageHistory.length > 0, 'should have outage in history');
    cleanup(sys);
  });

  it('getGridStatus returns copy of grid status', () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    const status = sys.getGridStatus();
    assertEqual(status.online, true);
    assertEqual(status.voltage, 230);
    cleanup(sys);
  });

  it('getCurrentOutage returns null when no outage', () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    assertEqual(sys.getCurrentOutage(), null);
    cleanup(sys);
  });

  it('getCurrentOutage returns details during outage', () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    sys.updateGridStatus(0, 0, false);
    const outage = sys.getCurrentOutage();
    assert(outage, 'should return outage');
    assertType(outage.elapsedMs, 'number');
    cleanup(sys);
  });
});

describe('PowerContinuityUPSSystem — load shedding', () => {
  it('assignDevicePriority assigns to group', () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    assertEqual(sys.assignDevicePriority('light-1', 'non-critical'), true);
    assert(sys.priorityGroups['non-critical'].devices.includes('light-1'), 'should be in group');
    cleanup(sys);
  });

  it('assignDevicePriority rejects unknown group', () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    assertEqual(sys.assignDevicePriority('light-1', 'unknown'), false);
    cleanup(sys);
  });

  it('assignDevicePriority moves device between groups', () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    sys.assignDevicePriority('light-1', 'non-critical');
    sys.assignDevicePriority('light-1', 'safety');
    assertEqual(sys.priorityGroups['non-critical'].devices.length, 0);
    assert(sys.priorityGroups['safety'].devices.includes('light-1'), 'should be in safety');
    cleanup(sys);
  });

  it('getLoadSheddingPlan returns sorted groups', () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    sys.assignDevicePriority('d1', 'safety');
    sys.assignDevicePriority('d2', 'non-critical');
    const plan = sys.getLoadSheddingPlan();
    assertEqual(plan[0].group, 'non-critical');
    assertEqual(plan[plan.length - 1].group, 'safety');
    cleanup(sys);
  });

  it('executeLoadShedding returns devices to shed', () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    sys.assignDevicePriority('d1', 'non-critical');
    sys.assignDevicePriority('d2', 'luxury');
    sys.assignDevicePriority('d3', 'safety');
    const shed = sys.executeLoadShedding(2);
    assert(shed.includes('d1'), 'non-critical should be shed');
    assert(shed.includes('d2'), 'luxury should be shed');
    assert(!shed.includes('d3'), 'safety should NOT be shed');
    assertEqual(sys.stats.totalLoadShedEvents, 1);
    cleanup(sys);
  });
});

describe('PowerContinuityUPSSystem — battery health', () => {
  it('recordChargeCycle increments cycles and degrades health', () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    const id = sys.registerUPS('Test');
    sys.recordChargeCycle(id);
    const ups = sys.upsDevices.get(id);
    assertEqual(ups.chargeCycles, 1);
    assert(ups.batteryHealthPct < 100, 'health should degrade');
    cleanup(sys);
  });

  it('recordChargeCycle returns false for unknown UPS', () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    assertEqual(sys.recordChargeCycle('nonexistent'), false);
    cleanup(sys);
  });

  it('getBatteryHealth returns health info or null', () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    const id = sys.registerUPS('Test');
    const health = sys.getBatteryHealth(id);
    assert(health, 'should return health');
    assertEqual(health.healthPct, 100);
    assertEqual(sys.getBatteryHealth('nonexistent'), null);
    cleanup(sys);
  });
});

describe('PowerContinuityUPSSystem — power quality', () => {
  it('detects voltage sag', () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    sys.updateGridStatus(200, 50); // below 207 threshold
    assertEqual(sys.powerQuality.voltageSags, 1);
    assert(sys.powerQuality.lastSagTimestamp > 0, 'should record sag');
    cleanup(sys);
  });

  it('detects voltage surge', () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    sys.updateGridStatus(260, 50); // above 253 threshold
    assertEqual(sys.powerQuality.voltageSurges, 1);
    assert(sys.powerQuality.lastSurgeTimestamp > 0, 'should record surge');
    cleanup(sys);
  });

  it('reportHarmonicEvent increments counter', () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    sys.reportHarmonicEvent({ source: 'inverter' });
    assertEqual(sys.powerQuality.harmonicEvents, 1);
    cleanup(sys);
  });

  it('getPowerQualitySummary returns summary', () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    const summary = sys.getPowerQualitySummary();
    assertEqual(summary.nominalVoltage, 230);
    assertType(summary.voltageSags, 'number');
    cleanup(sys);
  });
});

describe('PowerContinuityUPSSystem — generator', () => {
  it('configureGenerator updates settings', () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    const config = sys.configureGenerator({ available: true, fuelLevelPct: 80 });
    assertEqual(config.available, true);
    assertEqual(config.fuelLevelPct, 80);
    cleanup(sys);
  });

  it('getGeneratorStatus returns status', () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    const status = sys.getGeneratorStatus();
    assertEqual(status.running, false);
    assertEqual(status.available, false);
    cleanup(sys);
  });
});

describe('PowerContinuityUPSSystem — self-test', () => {
  it('runSelfTest returns results for registered UPS', async () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    const id = sys.registerUPS('Test');
    const results = await sys.runSelfTest(id);
    assertEqual(results.length, 1);
    assertEqual(results[0].passed, true);
    assertEqual(sys.stats.selfTestsRun, 1);
    cleanup(sys);
  });

  it('runSelfTest fails for unhealthy UPS', async () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    const id = sys.registerUPS('Test', { batteryHealthPct: 10 });
    const results = await sys.runSelfTest(id);
    assertEqual(results[0].passed, false);
    cleanup(sys);
  });

  it('runSelfTest returns empty for no UPS devices', async () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    const results = await sys.runSelfTest();
    assertEqual(results.length, 0);
    cleanup(sys);
  });

  it('configureTestSchedule updates schedule', () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    const sched = sys.configureTestSchedule({ enabled: false });
    assertEqual(sched.enabled, false);
    cleanup(sys);
  });
});

describe('PowerContinuityUPSSystem — device circuit mapping', () => {
  it('mapDeviceToCircuit maps device correctly', () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    const upsId = sys.registerUPS('Test');
    sys.mapDeviceToCircuit('fridge', upsId, 'circuit-1', 'safety');
    const info = sys.getDeviceCircuitInfo('fridge');
    assert(info, 'should return info');
    assertEqual(info.upsId, upsId);
    assertEqual(info.priority, 'safety');
    cleanup(sys);
  });

  it('getDevicesOnUPS returns connected devices', () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    const upsId = sys.registerUPS('Test');
    sys.mapDeviceToCircuit('fridge', upsId, 'circuit-1', 'safety');
    const devices = sys.getDevicesOnUPS(upsId);
    assertEqual(devices.length, 1);
    assertEqual(devices[0].deviceId, 'fridge');
    cleanup(sys);
  });

  it('getDevicesOnUPS returns empty for unknown UPS', () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    assertEqual(sys.getDevicesOnUPS('nonexistent').length, 0);
    cleanup(sys);
  });
});

describe('PowerContinuityUPSSystem — consumption baseline', () => {
  it('recordConsumptionSample tracks average and peak', () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    sys.recordConsumptionSample(100);
    sys.recordConsumptionSample(200);
    const baseline = sys.getConsumptionBaseline();
    assertEqual(baseline.sampleCount, 2);
    assertEqual(baseline.averageWatts, 150);
    assertEqual(baseline.peakWatts, 200);
    cleanup(sys);
  });

  it('detects consumption anomalies', () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    // Build baseline with 30 normal samples
    for (let i = 0; i < 30; i++) sys.recordConsumptionSample(100);
    // Anomalous sample
    sys.recordConsumptionSample(500);
    assertEqual(sys.stats.anomaliesDetected, 1);
    cleanup(sys);
  });
});

describe('PowerContinuityUPSSystem — maintenance', () => {
  it('scheduleMaintenance creates record', () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    const upsId = sys.registerUPS('Test');
    const record = sys.scheduleMaintenance(upsId, 'battery_replacement');
    assert(record, 'should return record');
    assert(record.id, 'should have id');
    assertEqual(record.completed, false);
    cleanup(sys);
  });

  it('scheduleMaintenance returns null for unknown UPS', () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    assertEqual(sys.scheduleMaintenance('nonexistent', 'check'), null);
    cleanup(sys);
  });

  it('completeMaintenance marks record complete', () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    const upsId = sys.registerUPS('Test');
    const record = sys.scheduleMaintenance(upsId, 'inspection');
    assertEqual(sys.completeMaintenance(record.id, 'All good'), true);
    assertEqual(sys.maintenanceRecords[0].completed, true);
    cleanup(sys);
  });

  it('completeMaintenance resets battery on replacement', () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    const upsId = sys.registerUPS('Test', { batteryHealthPct: 50 });
    const record = sys.scheduleMaintenance(upsId, 'battery_replacement');
    sys.completeMaintenance(record.id);
    const ups = sys.upsDevices.get(upsId);
    assertEqual(ups.batteryHealthPct, 100);
    assertEqual(ups.chargeCycles, 0);
    cleanup(sys);
  });
});

describe('PowerContinuityUPSSystem — power events & statistics', () => {
  it('getPowerEvents returns filtered events', () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    sys.registerUPS('Test');
    const allEvents = sys.getPowerEvents();
    assert(allEvents.length > 0, 'should have events from registration');
    const upsEvents = sys.getPowerEvents('ups_registered');
    assertEqual(upsEvents.length, 1);
    cleanup(sys);
  });

  it('getStatistics returns comprehensive stats', () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    sys.registerUPS('Test');
    const stats = sys.getStatistics();
    assertEqual(stats.upsCount, 1);
    assertEqual(stats.gridOnline, true);
    assertType(stats.totalOutages, 'number');
    assertType(stats.generatorRunning, 'boolean');
    cleanup(sys);
  });

  it('_formatDuration formats correctly', () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    assertEqual(sys._formatDuration(0), '0s');
    assertEqual(sys._formatDuration(5000), '5s');
    assertEqual(sys._formatDuration(125000), '2m 5s');
    assertEqual(sys._formatDuration(3725000), '1h 2m 5s');
    cleanup(sys);
  });
});

describe('PowerContinuityUPSSystem — runtime estimation', () => {
  it('_estimateRuntime returns Infinity with no load', () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    const id = sys.registerUPS('Test', { capacityWh: 1000 });
    const ups = sys.upsDevices.get(id);
    const runtime = sys._estimateRuntime(ups);
    assertEqual(runtime, Infinity);
    cleanup(sys);
  });

  it('_estimateRuntime calculates with load', () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    const id = sys.registerUPS('Test', { capacityWh: 1000, batteryPct: 100, batteryHealthPct: 100 });
    const ups = sys.upsDevices.get(id);
    ups.currentLoadW = 500;
    const runtime = sys._estimateRuntime(ups);
    assert(runtime > 0, 'should have positive runtime');
    assertType(runtime, 'number');
    cleanup(sys);
  });

  it('getRuntimeEstimates returns all estimates', () => {
    const sys = new PowerContinuityUPSSystem(createMockHomey());
    sys.registerUPS('UPS1');
    sys.registerUPS('UPS2');
    const estimates = sys.getRuntimeEstimates();
    assertEqual(estimates.length, 2);
    cleanup(sys);
  });
});

run();
