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

const SolarEnergyOptimizationSystem = require('../lib/SolarEnergyOptimizationSystem');

describe('Solar — constructor & lifecycle', () => {
  it('instantiates without errors', () => {
    const sys = new SolarEnergyOptimizationSystem(createMockHomey());
    assert(sys, 'should create instance');
    assertEqual(sys.initialized, false);
    assertEqual(sys.intervals.length, 0);
    cleanup(sys);
  });

  it('has 3 panel arrays configured', () => {
    const sys = new SolarEnergyOptimizationSystem(createMockHomey());
    assertEqual(Object.keys(sys.panelArrays).length, 3);
    assert(sys.panelArrays['south-roof'], 'should have south-roof');
    assert(sys.panelArrays['east-roof'], 'should have east-roof');
    assert(sys.panelArrays['west-roof'], 'should have west-roof');
    cleanup(sys);
  });

  it('initialize sets initialized flag and starts intervals', async () => {
    const sys = new SolarEnergyOptimizationSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.initialized, true);
    assert(sys.intervals.length > 0, 'should have intervals');
    cleanup(sys);
  });

  it('destroy clears intervals', async () => {
    const sys = new SolarEnergyOptimizationSystem(createMockHomey());
    await sys.initialize();
    sys.destroy();
    assertEqual(sys.intervals.length, 0);
    cleanup(sys);
  });
});

describe('Solar — array & panel queries', () => {
  it('getArrayDetails returns details for valid array', async () => {
    const sys = new SolarEnergyOptimizationSystem(createMockHomey());
    await sys.initialize();
    const details = sys.getArrayDetails('south-roof');
    assert(details, 'should return details');
    assertEqual(details.panelCount, 20);
    assertType(details.currentEfficiency, 'number');
    assertType(details.currentOutputKW, 'number');
    cleanup(sys);
  });

  it('getArrayDetails returns null for unknown array', async () => {
    const sys = new SolarEnergyOptimizationSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.getArrayDetails('nope'), null);
    cleanup(sys);
  });

  it('getPanelDetails returns details for valid panel', async () => {
    const sys = new SolarEnergyOptimizationSystem(createMockHomey());
    await sys.initialize();
    const panel = sys.getPanelDetails('south-roof-panel-1');
    assert(panel, 'should return panel');
    assertType(panel.currentEfficiency, 'number');
    cleanup(sys);
  });

  it('getPanelDetails returns null for unknown panel', async () => {
    const sys = new SolarEnergyOptimizationSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.getPanelDetails('nope'), null);
    cleanup(sys);
  });
});

describe('Solar — battery & inverter', () => {
  it('getBatteryDetails returns details for main battery', async () => {
    const sys = new SolarEnergyOptimizationSystem(createMockHomey());
    await sys.initialize();
    const details = sys.getBatteryDetails('main');
    assert(details, 'should return details');
    cleanup(sys);
  });

  it('getBatteryDetails returns null for unknown battery', async () => {
    const sys = new SolarEnergyOptimizationSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.getBatteryDetails('nope'), null);
    cleanup(sys);
  });

  it('getInverterDetails returns details for primary inverter', async () => {
    const sys = new SolarEnergyOptimizationSystem(createMockHomey());
    await sys.initialize();
    const details = sys.getInverterDetails('primary');
    assert(details, 'should return details');
    assertEqual(details.status, 'active');
    cleanup(sys);
  });

  it('getInverterDetails returns null for unknown inverter', async () => {
    const sys = new SolarEnergyOptimizationSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.getInverterDetails('nope'), null);
    cleanup(sys);
  });
});

describe('Solar — forecast, financial & carbon', () => {
  it('getProductionForecast returns forecast data', async () => {
    const sys = new SolarEnergyOptimizationSystem(createMockHomey());
    await sys.initialize();
    const forecast = sys.getProductionForecast();
    assertType(forecast.today, 'number');
    assertType(forecast.tomorrow, 'number');
    assertType(forecast.weekly, 'number');
    assertType(forecast.accuracy, 'number');
    assert(forecast.weatherFactors, 'should have weatherFactors');
    cleanup(sys);
  });

  it('getFinancialSummary returns financial data', async () => {
    const sys = new SolarEnergyOptimizationSystem(createMockHomey());
    await sys.initialize();
    const summary = sys.getFinancialSummary();
    assertType(summary.totalInvestmentSEK, 'number');
    assertType(summary.paybackYears, 'number');
    assert(summary.skattereduktion, 'should have skattereduktion');
    assert(summary.rotAvdrag, 'should have rotAvdrag');
    cleanup(sys);
  });

  it('getCarbonOffsetSummary returns carbon data', async () => {
    const sys = new SolarEnergyOptimizationSystem(createMockHomey());
    await sys.initialize();
    const carbon = sys.getCarbonOffsetSummary();
    assertType(carbon.kgCO2PerKWh, 'number');
    assertType(carbon.yearlyCarbonSavedKg, 'number');
    cleanup(sys);
  });
});

describe('Solar — grid, self-consumption & independence', () => {
  it('getGridStatus returns grid data', async () => {
    const sys = new SolarEnergyOptimizationSystem(createMockHomey());
    await sys.initialize();
    const grid = sys.getGridStatus();
    assert(grid.flowDirection, 'should have flowDirection');
    assertType(grid.spotPrice, 'number');
    assertType(grid.totalExportedKWh, 'number');
    cleanup(sys);
  });

  it('getSelfConsumptionData returns ratio data', async () => {
    const sys = new SolarEnergyOptimizationSystem(createMockHomey());
    await sys.initialize();
    const data = sys.getSelfConsumptionData();
    assertType(data.ratio, 'number');
    assertType(data.ratioPercentage, 'number');
    assertType(data.target, 'number');
    assertEqual(typeof data.meetsTarget, 'boolean');
    cleanup(sys);
  });

  it('getEnergyIndependenceScore returns score', async () => {
    const sys = new SolarEnergyOptimizationSystem(createMockHomey());
    await sys.initialize();
    const score = sys.getEnergyIndependenceScore();
    assertType(score.score, 'number');
    cleanup(sys);
  });
});

describe('Solar — historical data & maintenance', () => {
  it('getHistoricalData returns daily records', async () => {
    const sys = new SolarEnergyOptimizationSystem(createMockHomey());
    await sys.initialize();
    const data = sys.getHistoricalData(7);
    assert(data.records.length > 0, 'should have records');
    assertEqual(data.totalDays, data.records.length);
    assert(data.monthlyTotals, 'should have monthly totals');
    assert(data.seasonalComparison, 'should have seasonal comparison');
    cleanup(sys);
  });

  it('getMaintenanceStatus returns maintenance data', async () => {
    const sys = new SolarEnergyOptimizationSystem(createMockHomey());
    await sys.initialize();
    const status = sys.getMaintenanceStatus();
    assert(Array.isArray(status.schedule), 'should have schedule');
    assert(Array.isArray(status.alerts), 'should have alerts');
    cleanup(sys);
  });
});

describe('Solar — peak shaving, health, shade, weather, incentives', () => {
  it('getPeakShavingStatus returns peak shaving data', async () => {
    const sys = new SolarEnergyOptimizationSystem(createMockHomey());
    await sys.initialize();
    const status = sys.getPeakShavingStatus();
    assertEqual(status.enabled, true);
    assertType(status.thresholdKW, 'number');
    cleanup(sys);
  });

  it('getSystemHealthReport returns health data', async () => {
    const sys = new SolarEnergyOptimizationSystem(createMockHomey());
    await sys.initialize();
    const health = sys.getSystemHealthReport();
    assertType(health.overall, 'number');
    assertType(health.panels, 'number');
    assertType(health.inverters, 'number');
    assertType(health.batteries, 'number');
    assert(Array.isArray(health.issues), 'should have issues array');
    cleanup(sys);
  });

  it('getShadeAnalysis returns shade data', async () => {
    const sys = new SolarEnergyOptimizationSystem(createMockHomey());
    await sys.initialize();
    const shade = sys.getShadeAnalysis();
    assert(shade.hourlyShadeMap, 'should have hourlyShadeMap');
    assertType(shade.annualShadeLossPercentage, 'number');
    cleanup(sys);
  });

  it('getWeatherStatus returns weather data', async () => {
    const sys = new SolarEnergyOptimizationSystem(createMockHomey());
    await sys.initialize();
    const weather = sys.getWeatherStatus();
    assertType(weather.temperature, 'number');
    assertType(weather.cloudCover, 'number');
    assertType(weather.uvIndex, 'number');
    assert(weather.optimalTempRange, 'should have optimalTempRange');
    cleanup(sys);
  });

  it('getSwedishIncentives returns incentive data', async () => {
    const sys = new SolarEnergyOptimizationSystem(createMockHomey());
    await sys.initialize();
    const incentives = sys.getSwedishIncentives();
    assert(incentives.skattereduktion, 'should have skattereduktion');
    assert(incentives.rotAvdrag, 'should have rotAvdrag');
    assert(incentives.netMetering, 'should have netMetering');
    cleanup(sys);
  });
});

describe('Solar — statistics', () => {
  it('getStatistics returns comprehensive stats', async () => {
    const sys = new SolarEnergyOptimizationSystem(createMockHomey());
    await sys.initialize();
    const stats = sys.getStatistics();
    assertEqual(stats.initialized, true);
    assertType(stats.systemCapacityKW, 'number');
    assertType(stats.totalPanels, 'number');
    assertEqual(stats.arrays, 3);
    assertType(stats.batteryStorageKWh, 'number');
    assertType(stats.selfConsumptionRatio, 'number');
    assertType(stats.systemHealthScore, 'number');
    assert(stats.historicalDays > 0, 'should have historical days');
    cleanup(sys);
  });
});

run();
