'use strict';

const EventEmitter = require('events');

/**
 * EnergySpotPriceSystem — FEAT-21
 *
 * Fetches Nord Pool spot prices for Sweden (SE3 area).
 * Falls back to a simulated price curve when the real API is
 * unavailable. Caches prices for 1 hour. Integrates with the
 * EVCharging module for cost-optimised charge scheduling.
 */
class EnergySpotPriceSystem {
  constructor(homey) {
    this.homey = homey;
    this.events = new EventEmitter();

    // Price area (Sweden SE3 — Stockholm)
    this.area = 'SE3';
    this.currency = 'SEK';
    this.unit = 'öre/kWh';

    // Price cache
    this.priceCache = null;
    this.cacheExpiry = 0;
    this.cacheTTL = 3600000; // 1 hour

    // Thresholds (öre/kWh)
    this.cheapThreshold = 50;   // below = cheap
    this.expensiveThreshold = 150; // above = expensive
    this.lastEmittedState = null;

    // Price monitoring interval
    this._monitorInterval = null;

    this._listeners = [];
  }

  async initialize() {
    this._log('Initializing EnergySpotPriceSystem...');

    // Load initial prices
    await this._refreshPrices();

    // Start price monitoring every 15 minutes
    this._monitorInterval = setInterval(() => {
      this._refreshPrices();
      this._checkPriceThresholds();
    }, 900000); // 15 min

    // Check thresholds immediately
    this._checkPriceThresholds();

    this._log('EnergySpotPriceSystem initialized for ' + this.area);
  }

  // ── Public API ───────────────────────────────────────────────────

  /**
   * Get the current spot price for this hour.
   * @returns {Promise<{ price: number, hour: number, area: string, currency: string, source: string }>}
   */
  async getCurrentPrice() {
    const prices = await this._getPrices();
    const currentHour = new Date().getHours();
    const price = prices[currentHour];

    return {
      price,
      hour: currentHour,
      area: this.area,
      currency: this.currency,
      unit: this.unit,
      source: this.priceCache?.source || 'simulated',
      isCheap: price < this.cheapThreshold,
      isExpensive: price > this.expensiveThreshold,
    };
  }

  /**
   * Get the spot price for a specific hour.
   * @param {number} hour - 0-23
   * @returns {Promise<{ price: number, hour: number }>}
   */
  async getPriceForHour(hour) {
    if (hour < 0 || hour > 23) {
      throw new Error('Hour must be between 0 and 23');
    }
    const prices = await this._getPrices();
    return {
      price: prices[hour],
      hour,
      area: this.area,
      currency: this.currency,
      unit: this.unit,
    };
  }

  /**
   * Get the N cheapest hours of the day, sorted by price ascending.
   * @param {number} n - number of hours
   * @returns {Promise<Array<{ hour: number, price: number }>>}
   */
  async getCheapestHours(n) {
    const prices = await this._getPrices();
    const hourlyPrices = prices.map((price, hour) => ({ hour, price }));
    hourlyPrices.sort((a, b) => a.price - b.price);
    return hourlyPrices.slice(0, Math.min(n, 24));
  }

  /**
   * Check whether the current price is below the cheap threshold.
   * @param {number} [threshold] - custom threshold (öre/kWh)
   * @returns {Promise<boolean>}
   */
  async isCurrentlyCheap(threshold) {
    const current = await this.getCurrentPrice();
    return current.price < (threshold != null ? threshold : this.cheapThreshold);
  }

  /**
   * Find the best time to start a charging session of `durationHours`.
   * Returns the optimal start hour that minimises total cost.
   * @param {number} durationHours - number of consecutive hours needed
   * @returns {Promise<{ startHour: number, endHour: number, averagePrice: number, totalCost: number }>}
   */
  async scheduleChargingWindow(durationHours) {
    if (durationHours < 1 || durationHours > 24) {
      throw new Error('Duration must be between 1 and 24 hours');
    }

    const prices = await this._getPrices();
    let bestStart = 0;
    let bestCost = Infinity;

    for (let start = 0; start <= 24 - durationHours; start++) {
      let cost = 0;
      for (let h = start; h < start + durationHours; h++) {
        cost += prices[h];
      }
      if (cost < bestCost) {
        bestCost = cost;
        bestStart = start;
      }
    }

    const averagePrice = bestCost / durationHours;
    const endHour = bestStart + durationHours;

    return {
      startHour: bestStart,
      endHour: endHour > 23 ? endHour - 24 : endHour,
      averagePrice: Math.round(averagePrice * 100) / 100,
      totalCost: Math.round(bestCost * 100) / 100,
      durationHours,
    };
  }

  /**
   * Get all 24 hourly prices.
   * @returns {Promise<Array<{ hour: number, price: number }>>}
   */
  async getAllPrices() {
    const prices = await this._getPrices();
    return prices.map((price, hour) => ({
      hour,
      price,
      isCheap: price < this.cheapThreshold,
      isExpensive: price > this.expensiveThreshold,
    }));
  }

  // ── Price fetching ───────────────────────────────────────────────

  async _refreshPrices() {
    try {
      const prices = await this._fetchNordPoolPrices();
      this.priceCache = { prices, source: 'nordpool', fetchedAt: Date.now() };
      this.cacheExpiry = Date.now() + this.cacheTTL;
      this._log('Prices refreshed from Nord Pool');
    } catch (_err) {
      // Fall back to simulated prices
      const prices = this._generateSimulatedPrices();
      this.priceCache = { prices, source: 'simulated', fetchedAt: Date.now() };
      this.cacheExpiry = Date.now() + this.cacheTTL;
      this._log('Using simulated prices (Nord Pool unavailable)');
    }
  }

  async _getPrices() {
    if (!this.priceCache || Date.now() > this.cacheExpiry) {
      await this._refreshPrices();
    }
    return this.priceCache.prices;
  }

  /**
   * Attempt to fetch real Nord Pool prices.
   * Since the real API requires registration, this will throw
   * and trigger the simulated fallback in most environments.
   */
  async _fetchNordPoolPrices() {
    // Use Node's built-in https module
    const https = require('https');
    const today = new Date().toISOString().split('T')[0];

    return new Promise((resolve, reject) => {
      const url = `https://www.elprisetjustnu.se/api/v1/prices/${today.replace(/-/g, '/')}_${this.area}.json`;

      const req = https.get(url, { timeout: 5000 }, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          res.resume();
          return;
        }

        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            // API returns array of { SEK_per_kWh, time_start, ... }
            const prices = new Array(24).fill(0);
            for (const entry of json) {
              const hour = new Date(entry.time_start).getHours();
              // Convert SEK/kWh to öre/kWh
              prices[hour] = Math.round(entry.SEK_per_kWh * 100);
            }
            resolve(prices);
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
      req.on('error', reject);
    });
  }

  /**
   * Generate a realistic simulated price curve for SE3.
   * Peaks at 7-9am and 5-7pm, cheapest at night (1-5am).
   * @returns {number[]} 24 hourly prices in öre/kWh
   */
  _generateSimulatedPrices() {
    const basePrice = 80; // öre/kWh
    const hourlyFactors = [
      0.55, 0.45, 0.40, 0.38, 0.40, 0.50, // 00-05: night low
      0.75, 1.60, 1.80, 1.40, 1.20, 1.10, // 06-11: morning peak
      1.00, 0.95, 0.90, 1.00, 1.20, 1.70, // 12-17: afternoon + evening peak
      1.80, 1.50, 1.20, 0.90, 0.70, 0.60, // 18-23: evening descent
    ];

    // Add some randomness (+-10%)
    return hourlyFactors.map(factor => {
      const jitter = 1 + (Math.random() - 0.5) * 0.2;
      return Math.round(basePrice * factor * jitter);
    });
  }

  // ── Threshold monitoring ─────────────────────────────────────────

  async _checkPriceThresholds() {
    try {
      const current = await this.getCurrentPrice();
      let state = 'normal';

      if (current.price < this.cheapThreshold) {
        state = 'cheap';
      } else if (current.price > this.expensiveThreshold) {
        state = 'expensive';
      }

      if (state !== this.lastEmittedState) {
        this.lastEmittedState = state;

        if (state === 'cheap') {
          this.events.emit('price:cheap', current);
          this._emitHomeyEvent('energy:priceCheap', current);
          this._notifyEVCharging(current);
        } else if (state === 'expensive') {
          this.events.emit('price:expensive', current);
          this._emitHomeyEvent('energy:priceExpensive', current);
        }
      }
    } catch (err) {
      this._error('Threshold check failed:', err.message);
    }
  }

  _emitHomeyEvent(event, data) {
    if (this.homey && this.homey.emit) {
      this.homey.emit(event, data);
    }
  }

  /**
   * Notify the EV charging module that prices are cheap,
   * so it can auto-schedule charging.
   */
  async _notifyEVCharging(priceData) {
    try {
      const evSystem = this.homey.app?.smartEVChargingManagementSystem;
      if (evSystem && evSystem.startSmartCharging) {
        this._log('Notifying EV charging system of cheap prices');
        await evSystem.startSmartCharging({ reason: 'spot_price_cheap', priceData });
      }
    } catch (err) {
      this._log('EV charging notification skipped:', err.message);
    }
  }

  // ── Statistics ───────────────────────────────────────────────────

  getStatistics() {
    return {
      area: this.area,
      currency: this.currency,
      source: this.priceCache?.source || 'none',
      cacheAge: this.priceCache ? Date.now() - this.priceCache.fetchedAt : null,
      cheapThreshold: this.cheapThreshold,
      expensiveThreshold: this.expensiveThreshold,
      currentState: this.lastEmittedState,
    };
  }

  destroy() {
    if (this._monitorInterval) {
      clearInterval(this._monitorInterval);
      this._monitorInterval = null;
    }
    if (this.homey && this.homey.removeListener) {
      for (const { event, handler } of this._listeners) {
        this.homey.removeListener(event, handler);
      }
    }
    this._listeners = [];
    this.priceCache = null;
    this.events.removeAllListeners();
  }

  _log(...args) {
    if (this.homey && this.homey.log) {
      this.homey.log('[EnergySpotPriceSystem]', ...args);
    }
  }

  _error(...args) {
    if (this.homey && this.homey.error) {
      this.homey.error('[EnergySpotPriceSystem]', ...args);
    }
  }
}

module.exports = EnergySpotPriceSystem;
