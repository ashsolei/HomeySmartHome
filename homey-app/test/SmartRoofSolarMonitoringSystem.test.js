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

const SmartRoofSolarMonitoringSystem = require('../lib/SmartRoofSolarMonitoringSystem');

describe('RoofSolar — constructor & lifecycle', () => {
  it('instantiates without errors', () => {
    const sys = new SmartRoofSolarMonitoringSystem(createMockHomey());
    assert(sys, 'should create instance');
    assertEqual(sys.initialized, false);
    cleanup(sys);
  });

  it('initialize discovers panels and starts intervals', async () => {
    const sys = new SmartRoofSolarMonitoringSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.initialized, true);
    assert(sys.panels.size > 0, 'should have panels');
    assert(sys.intervals.length > 0, 'should have intervals');
    cleanup(sys);
  });

  it('destroy clears intervals and resets initialized', async () => {
    const sys = new SmartRoofSolarMonitoringSystem(createMockHomey());
    await sys.initialize();
    sys.destroy();
    assertEqual(sys.initialized, false);
    assertEqual(sys.intervals.length, 0);
    cleanup(sys);
  });
});

describe('RoofSolar — panel queries', () => {
  it('listPanels returns array of panel ids', async () => {
    const sys = new SmartRoofSolarMonitoringSystem(createMockHomey());
    await sys.initialize();
    const panels = sys.listPanels();
    assert(Array.isArray(panels), 'should be array');
    assert(panels.length > 0, 'should have panels');
    cleanup(sys);
  });

  it('getPanelDetail returns detail for valid id', async () => {
    const sys = new SmartRoofSolarMonitoringSystem(createMockHomey());
    await sys.initialize();
    const ids = sys.listPanels();
    const detail = sys.getPanelDetail(ids[0]);
    assert(detail, 'should return detail');
    assertType(detail.efficiency, 'number');
    assertType(detail.currentWatts, 'number');
    cleanup(sys);
  });

  it('getPanelDetail returns null for unknown id', async () => {
    const sys = new SmartRoofSolarMonitoringSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.getPanelDetail('nope'), null);
    cleanup(sys);
  });
});

describe('RoofSolar — cleaning', () => {
  it('recordCleaning resets soiling index', async () => {
    const sys = new SmartRoofSolarMonitoringSystem(createMockHomey());
    await sys.initialize();
    const result = sys.recordCleaning('Test cleaning');
    assertType(result.soilingIndex, 'number');
    assertEqual(result.soilingIndex, 0);
    cleanup(sys);
  });

  it('recordCleaning resets panel soiling percentages', async () => {
    const sys = new SmartRoofSolarMonitoringSystem(createMockHomey());
    await sys.initialize();
    sys.recordCleaning();
    for (const [, panel] of sys.panels) {
      assertEqual(panel.soilingPercent, 0);
    }
    cleanup(sys);
  });
});

describe('RoofSolar — storm risk & damage', () => {
  it('stormRisk has currentRisk and riskScore', async () => {
    const sys = new SmartRoofSolarMonitoringSystem(createMockHomey());
    await sys.initialize();
    assert(sys.stormRisk.currentRisk, 'should have currentRisk');
    assertType(sys.stormRisk.riskScore, 'number');
    cleanup(sys);
  });

  it('recordDamageEvent adds to historical events', async () => {
    const sys = new SmartRoofSolarMonitoringSystem(createMockHomey());
    await sys.initialize();
    const before = sys.stormRisk.historicalDamageEvents.length;
    sys.recordDamageEvent({ date: '2026-01-15', type: 'hail', costSEK: 5000 });
    assertEqual(sys.stormRisk.historicalDamageEvents.length, before + 1);
    cleanup(sys);
  });
});

describe('RoofSolar — shading model', () => {
  it('addObstruction adds to obstructions list', async () => {
    const sys = new SmartRoofSolarMonitoringSystem(createMockHomey());
    await sys.initialize();
    const before = sys.shading.obstructions.length;
    sys.addObstruction({ name: 'Big Tree', azimuth: 180, elevation: 30, widthDeg: 20 });
    assertEqual(sys.shading.obstructions.length, before + 1);
    cleanup(sys);
  });

  it('addObstruction updates existing obstruction', async () => {
    const sys = new SmartRoofSolarMonitoringSystem(createMockHomey());
    await sys.initialize();
    sys.addObstruction({ name: 'Tree', azimuth: 180, elevation: 30, widthDeg: 20 });
    const count = sys.shading.obstructions.length;
    sys.addObstruction({ name: 'Tree', azimuth: 190, elevation: 35, widthDeg: 25 });
    assertEqual(sys.shading.obstructions.length, count);
    cleanup(sys);
  });

  it('removeObstruction removes by name', async () => {
    const sys = new SmartRoofSolarMonitoringSystem(createMockHomey());
    await sys.initialize();
    sys.addObstruction({ name: 'RemoveMe', azimuth: 90, elevation: 20, widthDeg: 10 });
    const before = sys.shading.obstructions.length;
    sys.removeObstruction('RemoveMe');
    assertEqual(sys.shading.obstructions.length, before - 1);
    cleanup(sys);
  });
});

describe('RoofSolar — integration & alerts', () => {
  it('getGridIntegrationData returns payload', async () => {
    const sys = new SmartRoofSolarMonitoringSystem(createMockHomey());
    await sys.initialize();
    const data = sys.getGridIntegrationData();
    assertType(data.currentProductionWatts, 'number');
    assertType(data.todayProductionKwh, 'number');
    assertType(data.panelCount, 'number');
    assertType(data.averageEfficiency, 'number');
    assert(data.stormRisk, 'should have stormRisk');
    cleanup(sys);
  });

  it('getActiveAlerts returns array', async () => {
    const sys = new SmartRoofSolarMonitoringSystem(createMockHomey());
    await sys.initialize();
    const alerts = sys.getActiveAlerts();
    assert(Array.isArray(alerts), 'should be array');
    cleanup(sys);
  });

  it('getTrend returns trend data', async () => {
    const sys = new SmartRoofSolarMonitoringSystem(createMockHomey());
    await sys.initialize();
    const trend = sys.getTrend();
    assert(trend, 'should return trend data');
    cleanup(sys);
  });

  it('onProductionUpdate returns unsubscribe function', async () => {
    const sys = new SmartRoofSolarMonitoringSystem(createMockHomey());
    await sys.initialize();
    const unsub = sys.onProductionUpdate(() => {});
    assertType(unsub, 'function');
    unsub();
    cleanup(sys);
  });
});

describe('RoofSolar — status & reporting', () => {
  it('getStatus returns comprehensive status', async () => {
    const sys = new SmartRoofSolarMonitoringSystem(createMockHomey());
    await sys.initialize();
    const status = sys.getStatus();
    assertEqual(status.initialized, true);
    assertType(status.panelCount, 'number');
    assert(status.power, 'should have power');
    assert(status.roofCondition, 'should have roofCondition');
    assert(status.stormRisk, 'should have stormRisk');
    assert(status.roi, 'should have roi');
    cleanup(sys);
  });

  it('getAnalytics returns detailed analytics', async () => {
    const sys = new SmartRoofSolarMonitoringSystem(createMockHomey());
    await sys.initialize();
    const analytics = sys.getAnalytics();
    assert(Array.isArray(analytics.panels), 'should have panels array');
    assert(analytics.fleet, 'should have fleet data');
    assert(analytics.roi, 'should have roi');
    cleanup(sys);
  });

  it('getHealth returns health summary', async () => {
    const sys = new SmartRoofSolarMonitoringSystem(createMockHomey());
    await sys.initialize();
    const health = sys.getHealth();
    assert(health.overall, 'should have overall');
    assert(health.panels, 'should have panels');
    assertType(health.roofScore, 'number');
    assert(health.alerts, 'should have alerts');
    cleanup(sys);
  });

  it('generateReport returns report object', async () => {
    const sys = new SmartRoofSolarMonitoringSystem(createMockHomey());
    await sys.initialize();
    const report = sys.generateReport();
    assert(report, 'should return report');
    cleanup(sys);
  });

  it('updateROIConfig updates ROI parameters', async () => {
    const sys = new SmartRoofSolarMonitoringSystem(createMockHomey());
    await sys.initialize();
    sys.updateROIConfig({ electricityPriceSEK: 2.0 });
    assertEqual(sys.roi.electricityPriceSEK, 2.0);
    cleanup(sys);
  });
});

run();
