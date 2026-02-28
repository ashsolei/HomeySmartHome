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

const AdvancedEnergyTradingSystem = require('../lib/AdvancedEnergyTradingSystem');

describe('EnergyTrading — constructor & lifecycle', () => {
  it('instantiates without errors', () => {
    const sys = new AdvancedEnergyTradingSystem(createMockHomey());
    assert(sys, 'should create instance');
    cleanup(sys);
  });

  it('constructor sets defaults', () => {
    const sys = new AdvancedEnergyTradingSystem(createMockHomey());
    assertEqual(sys.initialized, false);
    assertEqual(sys.currentStrategy, 'balanced');
    assertEqual(sys.dailyPnL, 0);
    assertEqual(sys.totalEnergyTraded, 0);
    cleanup(sys);
  });

  it('initialize populates storage, strategies, prices', async () => {
    const sys = new AdvancedEnergyTradingSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.initialized, true);
    assert(sys.storageUnits.size > 0, 'should have storage units');
    assert(sys.strategies.size > 0, 'should have strategies');
    assert(sys.spotPrices.length > 0, 'should have spot prices');
    assert(sys.priceHistory.length > 0, 'should have price history');
    cleanup(sys);
  });

  it('destroy clears intervals', async () => {
    const sys = new AdvancedEnergyTradingSystem(createMockHomey());
    await sys.initialize();
    sys.destroy();
    assertEqual(sys.monitoringInterval, null);
    assertEqual(sys.priceUpdateInterval, null);
    cleanup(sys);
  });
});

describe('EnergyTrading — pricing', () => {
  it('generateHourlyPrices returns 24 entries', async () => {
    const sys = new AdvancedEnergyTradingSystem(createMockHomey());
    await sys.initialize();
    const prices = sys.generateHourlyPrices();
    assertEqual(prices.length, 24);
    assertType(prices[0].price, 'number');
    assertType(prices[0].hour, 'number');
    cleanup(sys);
  });

  it('getCurrentPrice returns a number', async () => {
    const sys = new AdvancedEnergyTradingSystem(createMockHomey());
    await sys.initialize();
    const price = sys.getCurrentPrice();
    assertType(price, 'number');
    assert(price > 0, 'price should be positive');
    cleanup(sys);
  });

  it('predictPrices returns predictions', async () => {
    const sys = new AdvancedEnergyTradingSystem(createMockHomey());
    await sys.initialize();
    const predictions = sys.predictPrices(12);
    assertEqual(predictions.length, 12);
    assertType(predictions[0].predictedPrice, 'number');
    cleanup(sys);
  });
});

describe('EnergyTrading — storage operations', () => {
  it('chargeStorage charges a unit', async () => {
    const sys = new AdvancedEnergyTradingSystem(createMockHomey());
    await sys.initialize();
    const result = sys.chargeStorage('home_battery', 2);
    assertEqual(result.success, true);
    assertType(result.charged, 'number');
    assertType(result.cost, 'number');
    cleanup(sys);
  });

  it('chargeStorage returns failure for unknown unit', async () => {
    const sys = new AdvancedEnergyTradingSystem(createMockHomey());
    await sys.initialize();
    const result = sys.chargeStorage('nonexistent', 2);
    assertEqual(result.success, false);
    assertEqual(result.reason, 'unit_not_found');
    cleanup(sys);
  });

  it('dischargeStorage discharges a unit', async () => {
    const sys = new AdvancedEnergyTradingSystem(createMockHomey());
    await sys.initialize();
    const result = sys.dischargeStorage('home_battery', 1);
    assertEqual(result.success, true);
    assertType(result.discharged, 'number');
    assertType(result.revenue, 'number');
    cleanup(sys);
  });

  it('dischargeStorage returns failure for unknown unit', async () => {
    const sys = new AdvancedEnergyTradingSystem(createMockHomey());
    await sys.initialize();
    const result = sys.dischargeStorage('nonexistent', 1);
    assertEqual(result.success, false);
    cleanup(sys);
  });
});

describe('EnergyTrading — transactions & PnL', () => {
  it('recordTransaction creates a transaction', async () => {
    const sys = new AdvancedEnergyTradingSystem(createMockHomey());
    await sys.initialize();
    const txn = sys.recordTransaction('charge', 'home_battery', 5, 1.5, 7.5);
    assert(txn.id, 'should have id');
    assertEqual(txn.type, 'charge');
    assertEqual(txn.amountKWh, 5);
    cleanup(sys);
  });

  it('getPnL returns profit/loss for period', async () => {
    const sys = new AdvancedEnergyTradingSystem(createMockHomey());
    await sys.initialize();
    sys.chargeStorage('home_battery', 2);
    const pnl = sys.getPnL('today');
    assertType(pnl.revenue, 'number');
    assertType(pnl.costs, 'number');
    assertType(pnl.profit, 'number');
    assertType(pnl.transactionCount, 'number');
    cleanup(sys);
  });

  it('resetDailyPnL returns previous value and resets', async () => {
    const sys = new AdvancedEnergyTradingSystem(createMockHomey());
    await sys.initialize();
    sys.dailyPnL = 42;
    const prev = sys.resetDailyPnL();
    assertEqual(prev, 42);
    assertEqual(sys.dailyPnL, 0);
    cleanup(sys);
  });
});

describe('EnergyTrading — strategy & trading', () => {
  it('setStrategy changes strategy', async () => {
    const sys = new AdvancedEnergyTradingSystem(createMockHomey());
    await sys.initialize();
    const result = sys.setStrategy('aggressive');
    assertEqual(result, true);
    assertEqual(sys.currentStrategy, 'aggressive');
    cleanup(sys);
  });

  it('setStrategy returns false for unknown strategy', async () => {
    const sys = new AdvancedEnergyTradingSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.setStrategy('nonexistent'), false);
    cleanup(sys);
  });

  it('evaluateTradeOpportunity returns an opportunity', async () => {
    const sys = new AdvancedEnergyTradingSystem(createMockHomey());
    await sys.initialize();
    const opp = sys.evaluateTradeOpportunity();
    assert(opp, 'should return opportunity');
    assert(['buy', 'sell', 'hold'].includes(opp.action), 'should have valid action');
    cleanup(sys);
  });

  it('executeTrade returns null for hold', async () => {
    const sys = new AdvancedEnergyTradingSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.executeTrade({ action: 'hold' }), null);
    cleanup(sys);
  });
});

describe('EnergyTrading — status & statistics', () => {
  it('getStorageStatus returns status for all units', async () => {
    const sys = new AdvancedEnergyTradingSystem(createMockHomey());
    await sys.initialize();
    const status = sys.getStorageStatus();
    assert(Object.keys(status).length > 0, 'should have status entries');
    const firstKey = Object.keys(status)[0];
    assertType(status[firstKey].socPercent, 'number');
    cleanup(sys);
  });

  it('getMarketAnalysis returns analysis', async () => {
    const sys = new AdvancedEnergyTradingSystem(createMockHomey());
    await sys.initialize();
    const analysis = sys.getMarketAnalysis();
    assertType(analysis.currentPrice, 'number');
    assertEqual(analysis.priceArea, 'SE3');
    assert(analysis.predictions.length > 0, 'should have predictions');
    cleanup(sys);
  });

  it('getStatistics returns comprehensive stats', async () => {
    const sys = new AdvancedEnergyTradingSystem(createMockHomey());
    await sys.initialize();
    const stats = sys.getStatistics();
    assertType(stats.currentPrice, 'number');
    assertEqual(stats.currentStrategy, 'balanced');
    assert(stats.storage, 'should have storage');
    assert(stats.pnl, 'should have pnl');
    cleanup(sys);
  });

  it('getSettings returns settings copy', async () => {
    const sys = new AdvancedEnergyTradingSystem(createMockHomey());
    await sys.initialize();
    const settings = sys.getSettings();
    assertType(settings, 'object');
    cleanup(sys);
  });

  it('saveSettings updates known settings', async () => {
    const sys = new AdvancedEnergyTradingSystem(createMockHomey());
    await sys.initialize();
    const result = sys.saveSettings({ autoTradingEnabled: false });
    assertEqual(result.autoTradingEnabled, false);
    cleanup(sys);
  });
});

run();
