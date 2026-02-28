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
  try { if (sys && typeof sys.destroy === 'function') sys.destroy(); } catch (_) { /* ignore */ }
  while (activeHandles.length > 0) {
    const h = activeHandles.pop();
    if (h.type === 'timeout') clearTimeout(h.id); else clearInterval(h.id);
  }
}

/* ── helpers ────────────────────────────────────────────────────────── */
const EnergySpotPriceSystem = require('../lib/EnergySpotPriceSystem');

function createSystem() {
  const homey = createMockHomey();
  const sys = new EnergySpotPriceSystem(homey);
  return sys;
}

async function createInitialized() {
  const sys = createSystem();
  await sys.initialize();
  return sys;
}

/* ════════════════════════════════════════════════════════════════════ */
/*  TESTS                                                              */
/* ════════════════════════════════════════════════════════════════════ */

describe('EnergySpotPriceSystem', () => {

  // ── constructor ──────────────────────────────────────────────────

  describe('constructor', () => {
    it('creates instance with expected defaults', () => {
      const sys = createSystem();
      try {
        assertEqual(sys.area, 'SE3');
        assertEqual(sys.currency, 'SEK');
        assertEqual(sys.cacheTTL, 3600000);
        assertEqual(sys.cheapThreshold, 50);
        assertEqual(sys.expensiveThreshold, 150);
        assertEqual(sys.priceCache, null);
      } finally { cleanup(sys); }
    });
  });

  // ── initialize ───────────────────────────────────────────────────

  describe('initialize', () => {
    it('loads prices on init (falls back to simulated)', async () => {
      const sys = await createInitialized();
      try {
        assert(sys.priceCache !== null, 'price cache should be populated');
        assertEqual(sys.priceCache.source, 'simulated');
        assertEqual(sys.priceCache.prices.length, 24);
      } finally { cleanup(sys); }
    });
  });

  // ── getCurrentPrice ──────────────────────────────────────────────

  describe('getCurrentPrice', () => {
    it('returns current hour price', async () => {
      const sys = await createInitialized();
      try {
        const result = await sys.getCurrentPrice();
        assertType(result.price, 'number');
        assertEqual(result.hour, new Date().getHours());
        assertEqual(result.area, 'SE3');
        assertEqual(result.currency, 'SEK');
        assertEqual(result.source, 'simulated');
        assertType(result.isCheap, 'boolean');
        assertType(result.isExpensive, 'boolean');
      } finally { cleanup(sys); }
    });
  });

  // ── getPriceForHour ──────────────────────────────────────────────

  describe('getPriceForHour', () => {
    it('returns price for a specific hour', async () => {
      const sys = await createInitialized();
      try {
        const result = await sys.getPriceForHour(12);
        assertType(result.price, 'number');
        assertEqual(result.hour, 12);
      } finally { cleanup(sys); }
    });

    it('throws for out-of-range hour', async () => {
      const sys = await createInitialized();
      try {
        let threw = false;
        try { await sys.getPriceForHour(25); } catch (_) { threw = true; }
        assert(threw, 'should throw for hour > 23');

        threw = false;
        try { await sys.getPriceForHour(-1); } catch (_) { threw = true; }
        assert(threw, 'should throw for hour < 0');
      } finally { cleanup(sys); }
    });
  });

  // ── getCheapestHours ─────────────────────────────────────────────

  describe('getCheapestHours', () => {
    it('returns N cheapest hours sorted by price', async () => {
      const sys = await createInitialized();
      try {
        const result = await sys.getCheapestHours(3);
        assertEqual(result.length, 3);
        // Verify sorted ascending
        assert(result[0].price <= result[1].price, 'should be sorted ascending');
        assert(result[1].price <= result[2].price, 'should be sorted ascending');
        assertType(result[0].hour, 'number');
        assertType(result[0].price, 'number');
      } finally { cleanup(sys); }
    });

    it('returns all 24 when requesting more than available', async () => {
      const sys = await createInitialized();
      try {
        const result = await sys.getCheapestHours(30);
        assertEqual(result.length, 24);
      } finally { cleanup(sys); }
    });
  });

  // ── isCurrentlyCheap ────────────────────────────────────────────

  describe('isCurrentlyCheap', () => {
    it('returns boolean based on default threshold', async () => {
      const sys = await createInitialized();
      try {
        const result = await sys.isCurrentlyCheap();
        assertType(result, 'boolean');
      } finally { cleanup(sys); }
    });

    it('accepts custom threshold', async () => {
      const sys = await createInitialized();
      try {
        // With threshold of 99999, it should always be cheap
        const result = await sys.isCurrentlyCheap(99999);
        assertEqual(result, true);
      } finally { cleanup(sys); }
    });

    it('returns false with zero threshold', async () => {
      const sys = await createInitialized();
      try {
        const result = await sys.isCurrentlyCheap(0);
        assertEqual(result, false);
      } finally { cleanup(sys); }
    });
  });

  // ── scheduleChargingWindow ───────────────────────────────────────

  describe('scheduleChargingWindow', () => {
    it('returns optimal charging window', async () => {
      const sys = await createInitialized();
      try {
        const result = await sys.scheduleChargingWindow(4);
        assertType(result.startHour, 'number');
        assertType(result.endHour, 'number');
        assertType(result.averagePrice, 'number');
        assertType(result.totalCost, 'number');
        assertEqual(result.durationHours, 4);
        assert(result.startHour >= 0 && result.startHour <= 23, 'startHour should be 0-23');
      } finally { cleanup(sys); }
    });

    it('finds cheapest single hour', async () => {
      const sys = await createInitialized();
      try {
        const result = await sys.scheduleChargingWindow(1);
        assertEqual(result.durationHours, 1);
        // The cheapest window should match getCheapestHours(1)
        const cheapest = await sys.getCheapestHours(1);
        assertEqual(result.startHour, cheapest[0].hour);
      } finally { cleanup(sys); }
    });

    it('throws for invalid duration', async () => {
      const sys = await createInitialized();
      try {
        let threw = false;
        try { await sys.scheduleChargingWindow(0); } catch (_) { threw = true; }
        assert(threw, 'should throw for duration 0');

        threw = false;
        try { await sys.scheduleChargingWindow(25); } catch (_) { threw = true; }
        assert(threw, 'should throw for duration > 24');
      } finally { cleanup(sys); }
    });
  });

  // ── getAllPrices ──────────────────────────────────────────────────

  describe('getAllPrices', () => {
    it('returns 24 hourly prices with metadata', async () => {
      const sys = await createInitialized();
      try {
        const result = await sys.getAllPrices();
        assertEqual(result.length, 24);
        for (let i = 0; i < 24; i++) {
          assertEqual(result[i].hour, i);
          assertType(result[i].price, 'number');
          assertType(result[i].isCheap, 'boolean');
          assertType(result[i].isExpensive, 'boolean');
        }
      } finally { cleanup(sys); }
    });
  });

  // ── simulated prices ─────────────────────────────────────────────

  describe('_generateSimulatedPrices', () => {
    it('generates 24 hourly prices', () => {
      const sys = createSystem();
      try {
        const prices = sys._generateSimulatedPrices();
        assertEqual(prices.length, 24);
        for (const p of prices) {
          assertType(p, 'number');
          assert(p > 0, 'prices should be positive');
        }
      } finally { cleanup(sys); }
    });

    it('has lower night prices than peak prices on average', () => {
      const sys = createSystem();
      try {
        // Generate multiple samples to reduce random noise
        let nightSum = 0;
        let peakSum = 0;
        const samples = 20;
        for (let s = 0; s < samples; s++) {
          const prices = sys._generateSimulatedPrices();
          // Night hours: 0-5
          for (let h = 0; h <= 5; h++) nightSum += prices[h];
          // Peak hours: 7-8 and 17-18
          for (const h of [7, 8, 17, 18]) peakSum += prices[h];
        }
        const avgNight = nightSum / (6 * samples);
        const avgPeak = peakSum / (4 * samples);
        assert(avgNight < avgPeak, `night avg (${avgNight.toFixed(1)}) should be less than peak avg (${avgPeak.toFixed(1)})`);
      } finally { cleanup(sys); }
    });
  });

  // ── getStatistics ────────────────────────────────────────────────

  describe('getStatistics', () => {
    it('returns system statistics', async () => {
      const sys = await createInitialized();
      try {
        const stats = sys.getStatistics();
        assertEqual(stats.area, 'SE3');
        assertEqual(stats.currency, 'SEK');
        assertEqual(stats.source, 'simulated');
        assertType(stats.cacheAge, 'number');
        assertEqual(stats.cheapThreshold, 50);
        assertEqual(stats.expensiveThreshold, 150);
      } finally { cleanup(sys); }
    });
  });

  // ── destroy ──────────────────────────────────────────────────────

  describe('destroy', () => {
    it('clears state and stops monitoring', async () => {
      const sys = await createInitialized();
      sys.destroy();
      assertEqual(sys.priceCache, null);
      assertEqual(sys._monitorInterval, null);
    });
  });
});

run();
