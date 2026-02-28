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

const HomeWaterLeakProtectionSystem = require('../lib/HomeWaterLeakProtectionSystem');

describe('HomeWaterLeakProtectionSystem — constructor & init', () => {
  it('instantiates without errors', () => {
    const sys = new HomeWaterLeakProtectionSystem(createMockHomey());
    assert(sys, 'should create instance');
    assertEqual(sys.initialized, false);
    cleanup(sys);
  });

  it('initialize sets up sensors and valves', async () => {
    const sys = new HomeWaterLeakProtectionSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.initialized, true);
    cleanup(sys);
  });

  it('destroy clears intervals', async () => {
    const sys = new HomeWaterLeakProtectionSystem(createMockHomey());
    await sys.initialize();
    sys.destroy();
    assertEqual(sys.intervals.length, 0);
    cleanup(sys);
  });
});

describe('HomeWaterLeakProtectionSystem — sensors', () => {
  it('getSensorStatus returns all sensors', async () => {
    const sys = new HomeWaterLeakProtectionSystem(createMockHomey());
    await sys.initialize();
    const status = sys.getSensorStatus();
    assert(status, 'should return status');
    assertEqual(status.success, true);
    assert(status.sensors.length > 0, 'should have sensors');
    cleanup(sys);
  });

  it('getSensorStatus returns single sensor', async () => {
    const sys = new HomeWaterLeakProtectionSystem(createMockHomey());
    await sys.initialize();
    const sensorId = Object.keys(sys.sensors)[0];
    const status = sys.getSensorStatus(sensorId);
    assert(status, 'should return status');
    cleanup(sys);
  });

  it('addSensor adds new sensor', async () => {
    const sys = new HomeWaterLeakProtectionSystem(createMockHomey());
    await sys.initialize();
    const result = sys.addSensor({ id: 'test-sensor', name: 'Test Sensor', zone: 'kitchen', type: 'floor_pad' });
    assert(result.success, 'should succeed');
    assert(sys.sensors['test-sensor'], 'should have sensor');
    cleanup(sys);
  });

  it('addSensor rejects duplicate id', async () => {
    const sys = new HomeWaterLeakProtectionSystem(createMockHomey());
    await sys.initialize();
    const sensorId = Object.keys(sys.sensors)[0];
    const result = sys.addSensor({ id: sensorId, name: 'Dup', zone: 'kitchen', type: 'floor_pad' });
    assertEqual(result.success, false);
    cleanup(sys);
  });

  it('removeSensor removes sensor', async () => {
    const sys = new HomeWaterLeakProtectionSystem(createMockHomey());
    await sys.initialize();
    sys.addSensor({ id: 'temp-sensor', name: 'Temp', zone: 'kitchen', type: 'floor_pad' });
    const result = sys.removeSensor('temp-sensor');
    assert(result.success, 'should succeed');
    cleanup(sys);
  });

  it('setSensorSensitivity updates sensitivity', async () => {
    const sys = new HomeWaterLeakProtectionSystem(createMockHomey());
    await sys.initialize();
    const sensorId = Object.keys(sys.sensors)[0];
    const result = sys.setSensorSensitivity(sensorId, 'high');
    assert(result.success, 'should succeed');
    cleanup(sys);
  });
});

describe('HomeWaterLeakProtectionSystem — valves', () => {
  it('shutoffValve closes valve', async () => {
    const sys = new HomeWaterLeakProtectionSystem(createMockHomey());
    await sys.initialize();
    const valveId = Object.keys(sys.valves)[0];
    const result = sys.shutoffValve(valveId, 'test');
    assert(result.success, 'should succeed');
    cleanup(sys);
  });

  it('openValve opens valve', async () => {
    const sys = new HomeWaterLeakProtectionSystem(createMockHomey());
    await sys.initialize();
    const valveId = Object.keys(sys.valves)[0];
    sys.shutoffValve(valveId, 'test');
    const result = sys.openValve(valveId, 'test');
    assert(result.success, 'should succeed');
    cleanup(sys);
  });

  it('getValveStatus returns status', async () => {
    const sys = new HomeWaterLeakProtectionSystem(createMockHomey());
    await sys.initialize();
    const status = sys.getValveStatus();
    assertEqual(status.success, true);
    assert(status.valves.length > 0, 'should have valves');
    cleanup(sys);
  });

  it('setValveManualOverride toggles override', async () => {
    const sys = new HomeWaterLeakProtectionSystem(createMockHomey());
    await sys.initialize();
    const valveId = Object.keys(sys.valves)[0];
    const result = sys.setValveManualOverride(valveId, true);
    assert(result.success, 'should succeed');
    cleanup(sys);
  });
});

describe('HomeWaterLeakProtectionSystem — leak detection', () => {
  it('reportLeak triggers alert', async () => {
    const sys = new HomeWaterLeakProtectionSystem(createMockHomey());
    await sys.initialize();
    const sensorId = Object.keys(sys.sensors)[0];
    const result = sys.reportLeak(sensorId, 'damp');
    assert(result.success, 'should succeed');
    cleanup(sys);
  });

  it('clearLeak clears sensor state', async () => {
    const sys = new HomeWaterLeakProtectionSystem(createMockHomey());
    await sys.initialize();
    const sensorId = Object.keys(sys.sensors)[0];
    sys.reportLeak(sensorId, 'damp');
    const result = sys.clearLeak(sensorId);
    assert(result.success, 'should succeed');
    cleanup(sys);
  });

  it('getAlertHistory returns alerts', async () => {
    const sys = new HomeWaterLeakProtectionSystem(createMockHomey());
    await sys.initialize();
    const history = sys.getAlertHistory({});
    assertEqual(history.success, true);
    assert(Array.isArray(history.alerts), 'should have alerts array');
    cleanup(sys);
  });
});

describe('HomeWaterLeakProtectionSystem — monitoring & status', () => {
  it('getFlowData returns flow info', async () => {
    const sys = new HomeWaterLeakProtectionSystem(createMockHomey());
    await sys.initialize();
    const data = sys.getFlowData();
    assert(data, 'should return data');
    cleanup(sys);
  });

  it('getPressureData returns pressure info', async () => {
    const sys = new HomeWaterLeakProtectionSystem(createMockHomey());
    await sys.initialize();
    const data = sys.getPressureData();
    assert(data, 'should return data');
    cleanup(sys);
  });

  it('getFreezeStatus returns freeze info', async () => {
    const sys = new HomeWaterLeakProtectionSystem(createMockHomey());
    await sys.initialize();
    const status = sys.getFreezeStatus();
    assert(status, 'should return status');
    cleanup(sys);
  });

  it('getSystemStatus returns overall status', async () => {
    const sys = new HomeWaterLeakProtectionSystem(createMockHomey());
    await sys.initialize();
    const status = sys.getSystemStatus();
    assert(status, 'should return status');
    assertEqual(status.success, true);
    assertType(status.status.activeSensors, 'number');
    cleanup(sys);
  });

  it('getUsageReport returns usage data', async () => {
    const sys = new HomeWaterLeakProtectionSystem(createMockHomey());
    await sys.initialize();
    const report = sys.getUsageReport('daily');
    assert(report, 'should return report');
    cleanup(sys);
  });

  it('testSystem runs diagnostics', async () => {
    const sys = new HomeWaterLeakProtectionSystem(createMockHomey());
    await sys.initialize();
    const result = await sys.testSystem();
    assert(result, 'should return test result');
    cleanup(sys);
  });

  it('setOccupancy toggles occupancy', async () => {
    const sys = new HomeWaterLeakProtectionSystem(createMockHomey());
    await sys.initialize();
    sys.setOccupancy(false);
    assertEqual(sys.config.currentlyOccupied, false);
    sys.setOccupancy(true);
    assertEqual(sys.config.currentlyOccupied, true);
    cleanup(sys);
  });

  it('getZoneStatus returns zone info', async () => {
    const sys = new HomeWaterLeakProtectionSystem(createMockHomey());
    await sys.initialize();
    const zones = sys.getZoneStatus();
    assertEqual(zones.success, true);
    assert(Array.isArray(zones.zones), 'should have zones array');
    cleanup(sys);
  });

  it('getMaintenanceReport returns report', async () => {
    const sys = new HomeWaterLeakProtectionSystem(createMockHomey());
    await sys.initialize();
    const report = sys.getMaintenanceReport();
    assert(report, 'should return report');
    cleanup(sys);
  });

  it('addEmergencyContact adds contact', async () => {
    const sys = new HomeWaterLeakProtectionSystem(createMockHomey());
    await sys.initialize();
    const result = sys.addEmergencyContact({ name: 'Erik', phone: '0701234567' });
    assert(result.success, 'should succeed');
    cleanup(sys);
  });
});

run();
