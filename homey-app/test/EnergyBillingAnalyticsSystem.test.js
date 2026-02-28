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

const EnergyBillingAnalyticsSystem = require('../lib/EnergyBillingAnalyticsSystem');

function mockHomey() {
  return createMockHomey({
    devices: {
      async getDevices() { return {}; },
      async getDevice({ id }) { return { id }; }
    }
  });
}

describe('EnergyBilling — constructor & lifecycle', () => {
  it('instantiates without errors', () => {
    const sys = new EnergyBillingAnalyticsSystem(mockHomey());
    assert(sys, 'should create instance');
    cleanup(sys);
  });

  it('constructor sets defaults', () => {
    const sys = new EnergyBillingAnalyticsSystem(mockHomey());
    assertEqual(sys.billingHistory.length, 0);
    assertEqual(sys.monthlyBudget.total, 0);
    assertEqual(sys.activeRatePlan, 'flat');
    assertEqual(sys.anomalies.length, 0);
    cleanup(sys);
  });

  it('initialize creates default rate plans', async () => {
    const sys = new EnergyBillingAnalyticsSystem(mockHomey());
    await sys.initialize();
    assert(sys.ratePlans.size >= 5, 'should have rate plans');
    assert(sys.ratePlans.has('flat'), 'should have flat plan');
    assert(sys.ratePlans.has('tiered'), 'should have tiered plan');
    assert(sys.ratePlans.has('time-of-use'), 'should have time-of-use plan');
    cleanup(sys);
  });

  it('destroy clears intervals', async () => {
    const sys = new EnergyBillingAnalyticsSystem(mockHomey());
    await sys.initialize();
    sys.destroy();
    assertEqual(sys._intervals.length, 0);
    cleanup(sys);
  });
});

describe('EnergyBilling — bill tracking', () => {
  it('recordBill adds a bill', async () => {
    const sys = new EnergyBillingAnalyticsSystem(mockHomey());
    await sys.initialize();
    const bill = await sys.recordBill('electricity', 500, 300, '2026-02');
    assert(bill.id, 'should have id');
    assertEqual(bill.type, 'electricity');
    assertEqual(bill.amount, 500);
    assertEqual(bill.kwh, 300);
    assertEqual(bill.period, '2026-02');
    assert(sys.billingHistory.length >= 1, 'should add to history');
    cleanup(sys);
  });

  it('recordBill throws for invalid type', async () => {
    const sys = new EnergyBillingAnalyticsSystem(mockHomey());
    await sys.initialize();
    let threw = false;
    try { await sys.recordBill('solar', 100, 50, '2026-02'); } catch (_) { threw = true; }
    assertEqual(threw, true);
    cleanup(sys);
  });

  it('getBillsByPeriod filters by period', async () => {
    const sys = new EnergyBillingAnalyticsSystem(mockHomey());
    await sys.initialize();
    await sys.recordBill('electricity', 400, 200, '2026-01');
    await sys.recordBill('electricity', 500, 300, '2026-02');
    const bills = sys.getBillsByPeriod('2026-01');
    assertEqual(bills.length, 1);
    assertEqual(bills[0].amount, 400);
    cleanup(sys);
  });

  it('getBillsByType filters by type', async () => {
    const sys = new EnergyBillingAnalyticsSystem(mockHomey());
    await sys.initialize();
    await sys.recordBill('electricity', 400, 200, '2026-01');
    await sys.recordBill('gas', 150, 50, '2026-01');
    const elBills = sys.getBillsByType('electricity');
    assertEqual(elBills.length, 1);
    cleanup(sys);
  });
});

describe('EnergyBilling — budget management', () => {
  it('setBudget sets monthly budget', async () => {
    const sys = new EnergyBillingAnalyticsSystem(mockHomey());
    await sys.initialize();
    await sys.setBudget(1000, 200, 100);
    assertEqual(sys.monthlyBudget.electricity, 1000);
    assertEqual(sys.monthlyBudget.gas, 200);
    assertEqual(sys.monthlyBudget.water, 100);
    assertEqual(sys.monthlyBudget.total, 1300);
    cleanup(sys);
  });

  it('getCurrentMonthSpending returns spending object', async () => {
    const sys = new EnergyBillingAnalyticsSystem(mockHomey());
    await sys.initialize();
    const spending = sys.getCurrentMonthSpending();
    assertType(spending.electricity, 'number');
    assertType(spending.gas, 'number');
    assertType(spending.water, 'number');
    assertType(spending.total, 'number');
    cleanup(sys);
  });
});

describe('EnergyBilling — rate plans', () => {
  it('getCurrentRate returns a number', async () => {
    const sys = new EnergyBillingAnalyticsSystem(mockHomey());
    await sys.initialize();
    const rate = sys.getCurrentRate();
    assertType(rate, 'number');
    assert(rate > 0, 'rate should be positive');
    cleanup(sys);
  });

  it('setActiveRatePlan changes the plan', async () => {
    const sys = new EnergyBillingAnalyticsSystem(mockHomey());
    await sys.initialize();
    await sys.setActiveRatePlan('tiered');
    assertEqual(sys.activeRatePlan, 'tiered');
    cleanup(sys);
  });

  it('setActiveRatePlan throws for unknown plan', async () => {
    const sys = new EnergyBillingAnalyticsSystem(mockHomey());
    await sys.initialize();
    let threw = false;
    try { await sys.setActiveRatePlan('nonexistent'); } catch (_) { threw = true; }
    assertEqual(threw, true);
    cleanup(sys);
  });

  it('addRatePlan adds a custom plan', async () => {
    const sys = new EnergyBillingAnalyticsSystem(mockHomey());
    await sys.initialize();
    const plan = await sys.addRatePlan('custom', { name: 'Custom', type: 'flat', rate: 2.0 });
    assertEqual(plan.name, 'Custom');
    assert(sys.ratePlans.has('custom'), 'should have custom plan');
    cleanup(sys);
  });

  it('calculateTieredCost returns a number', async () => {
    const sys = new EnergyBillingAnalyticsSystem(mockHomey());
    await sys.initialize();
    const cost = sys.calculateTieredCost(600);
    assertType(cost, 'number');
    assert(cost > 0, 'cost should be positive');
    cleanup(sys);
  });
});

describe('EnergyBilling — forecasting & comparison', () => {
  it('forecastEndOfMonth returns forecast', async () => {
    const sys = new EnergyBillingAnalyticsSystem(mockHomey());
    await sys.initialize();
    const forecast = sys.forecastEndOfMonth();
    assert(forecast, 'should return forecast');
    cleanup(sys);
  });

  it('comparePeriods returns comparison', async () => {
    const sys = new EnergyBillingAnalyticsSystem(mockHomey());
    await sys.initialize();
    await sys.recordBill('electricity', 500, 300, '2026-01');
    await sys.recordBill('electricity', 600, 350, '2026-02');
    const comp = sys.comparePeriods('2026-01', '2026-02');
    assertType(comp.difference, 'number');
    assertType(comp.percentChange, 'number');
    assertType(comp.direction, 'string');
    cleanup(sys);
  });

  it('compareMonthOverMonth returns result', async () => {
    const sys = new EnergyBillingAnalyticsSystem(mockHomey());
    await sys.initialize();
    const comp = sys.compareMonthOverMonth();
    assert(comp.periodA, 'should have periodA');
    assert(comp.periodB, 'should have periodB');
    cleanup(sys);
  });
});

describe('EnergyBilling — solar & carbon', () => {
  it('recordSolarGeneration updates total', async () => {
    const sys = new EnergyBillingAnalyticsSystem(mockHomey());
    await sys.initialize();
    await sys.recordSolarGeneration(10);
    assertEqual(sys.solarGeneration.totalKwh, 10);
    assertEqual(sys.solarGeneration.dailyReadings.length, 1);
    cleanup(sys);
  });

  it('calculateSolarOffset returns offset data', async () => {
    const sys = new EnergyBillingAnalyticsSystem(mockHomey());
    await sys.initialize();
    const offset = sys.calculateSolarOffset(1);
    assertType(offset.solarKwh, 'number');
    assertType(offset.gridKwh, 'number');
    assertType(offset.offsetPercentage, 'number');
    cleanup(sys);
  });

  it('calculateCarbonFootprint returns carbon data', async () => {
    const sys = new EnergyBillingAnalyticsSystem(mockHomey());
    await sys.initialize();
    const carbon = sys.calculateCarbonFootprint(1);
    assertType(carbon.electricityCO2kg, 'number');
    assertType(carbon.gasCO2kg, 'number');
    assertType(carbon.totalCO2kg, 'number');
    assertType(carbon.treesEquivalent, 'number');
    cleanup(sys);
  });
});

describe('EnergyBilling — analytics & reports', () => {
  it('analyzePeakHours returns peak data', async () => {
    const sys = new EnergyBillingAnalyticsSystem(mockHomey());
    await sys.initialize();
    const peak = sys.analyzePeakHours();
    assert(Array.isArray(peak.hourlyUsage), 'should have hourly usage');
    assertEqual(peak.hourlyUsage.length, 24);
    assertType(peak.peakPercentage, 'number');
    assertType(peak.mostExpensiveHour, 'number');
    cleanup(sys);
  });

  it('getSeasonalComparison returns comparison', async () => {
    const sys = new EnergyBillingAnalyticsSystem(mockHomey());
    await sys.initialize();
    const seasonal = sys.getSeasonalComparison();
    assertType(seasonal.winterAvg, 'number');
    assertType(seasonal.springAvg, 'number');
    assertType(seasonal.summerAvg, 'number');
    assertType(seasonal.autumnAvg, 'number');
    assertType(seasonal.mostExpensive, 'string');
    cleanup(sys);
  });

  it('generateBillSummary returns summary', async () => {
    const sys = new EnergyBillingAnalyticsSystem(mockHomey());
    await sys.initialize();
    const summary = sys.generateBillSummary('2026-02');
    assertEqual(summary.period, '2026-02');
    assert(summary.totals, 'should have totals');
    assertType(summary.grandTotal, 'number');
    cleanup(sys);
  });

  it('exportHistoryAsJSON returns export', async () => {
    const sys = new EnergyBillingAnalyticsSystem(mockHomey());
    await sys.initialize();
    const exported = sys.exportHistoryAsJSON(12);
    assertType(exported.months, 'number');
    assertType(exported.recordCount, 'number');
    assert(Array.isArray(exported.records), 'should have records');
    assert(exported.summary, 'should have summary');
    cleanup(sys);
  });

  it('getSavingsRecommendations returns array', async () => {
    const sys = new EnergyBillingAnalyticsSystem(mockHomey());
    await sys.initialize();
    const recs = await sys.getSavingsRecommendations();
    assert(Array.isArray(recs), 'should be array');
    cleanup(sys);
  });
});

describe('EnergyBilling — investments', () => {
  it('addInvestment adds an investment', async () => {
    const sys = new EnergyBillingAnalyticsSystem(mockHomey());
    await sys.initialize();
    const inv = await sys.addInvestment('Solar Panels', 50000, 500, 25);
    assert(inv.id, 'should have id');
    assertEqual(inv.name, 'Solar Panels');
    assertEqual(inv.cost, 50000);
    assertType(inv.paybackMonths, 'number');
    assertType(inv.roi, 'number');
    cleanup(sys);
  });

  it('calculateROI returns ROI for known investment', async () => {
    const sys = new EnergyBillingAnalyticsSystem(mockHomey());
    await sys.initialize();
    const inv = await sys.addInvestment('Heat Pump', 20000, 400);
    const roi = sys.calculateROI(inv.id);
    assert(roi, 'should return ROI');
    assertEqual(roi.name, 'Heat Pump');
    assertType(roi.savedSoFar, 'number');
    assertType(roi.netSoFar, 'number');
    cleanup(sys);
  });

  it('calculateROI returns null for unknown investment', async () => {
    const sys = new EnergyBillingAnalyticsSystem(mockHomey());
    await sys.initialize();
    assertEqual(sys.calculateROI('nonexistent'), null);
    cleanup(sys);
  });

  it('getAllInvestmentROI returns array', async () => {
    const sys = new EnergyBillingAnalyticsSystem(mockHomey());
    await sys.initialize();
    await sys.addInvestment('A', 1000, 50);
    await sys.addInvestment('B', 2000, 100);
    const all = sys.getAllInvestmentROI();
    assertEqual(all.length, 2);
    cleanup(sys);
  });
});

describe('EnergyBilling — statistics', () => {
  it('getStatistics returns comprehensive stats', async () => {
    const sys = new EnergyBillingAnalyticsSystem(mockHomey());
    await sys.initialize();
    const stats = sys.getStatistics();
    assert(stats.currentMonth, 'should have currentMonth');
    assert(stats.budget, 'should have budget');
    assert(stats.forecast, 'should have forecast');
    assert(stats.rates, 'should have rates');
    assert(stats.carbon, 'should have carbon');
    assert(stats.solar, 'should have solar');
    assert(stats.seasonal, 'should have seasonal');
    assert(stats.peakHours, 'should have peakHours');
    assertType(stats.anomalies, 'number');
    assertType(stats.investments, 'number');
    assertType(stats.billingRecords, 'number');
    cleanup(sys);
  });
});

run();
