'use strict';

class AdvancedEnergyTradingSystem {
  constructor(homey) {
    this.homey = homey;
    this.spotPrices = [];
    this.priceHistory = [];
    this.storageUnits = new Map();
    this.strategies = new Map();
    this.transactions = [];
    this.gridServices = new Map();
    this.feedInTariffs = new Map();
    this.p2pNeighbors = new Map();
    this.settings = {};
    this.monitoringInterval = null;
    this.priceUpdateInterval = null;
    this.rollingStats = { mean: 0, stdDev: 0, min: Infinity, max: -Infinity };
    this.currentStrategy = 'balanced';
    this.dailyPnL = 0;
    this.totalEnergyTraded = 0;
    this.initialized = false;
  }

  async initialize() {
    this.log('Initializing Advanced Energy Trading System...');
    try {
      this._initializeStorageUnits();
      this._initializeStrategies();
      this._initializeP2PNeighbors();
      this._initializeFeedInTariffs();
      this._initializeGridServices();
      this._loadSettings();
      this.spotPrices = this.generateHourlyPrices();
      this._seedPriceHistory();
      this._startMonitoring();
      this.initialized = true;
      this.log('Advanced Energy Trading System initialized successfully');
    } catch (err) {
      this.error('Failed to initialize Energy Trading System: ' + err.message);
      throw err;
    }
  }

  _initializeStorageUnits() {
    this.storageUnits.set('home_battery', {
      id: 'home_battery',
      name: 'Home Battery',
      capacityKWh: 13.5,
      currentChargeKWh: 6.75,
      maxChargeRateKW: 5.0,
      maxDischargeRateKW: 5.0,
      chargeEfficiency: 0.95,
      dischargeEfficiency: 0.95,
      cycleCount: 0,
      maxCycles: 6000,
      degradation: 0,
      minSoC: 0.10,
      maxSoC: 0.95,
      status: 'idle',
      lastUpdated: Date.now()
    });

    this.storageUnits.set('ev_battery', {
      id: 'ev_battery',
      name: 'EV Battery',
      capacityKWh: 75,
      currentChargeKWh: 45,
      maxChargeRateKW: 11,
      maxDischargeRateKW: 7.4,
      chargeEfficiency: 0.92,
      dischargeEfficiency: 0.90,
      cycleCount: 0,
      maxCycles: 3000,
      degradation: 0,
      minSoC: 0.20,
      maxSoC: 0.90,
      status: 'idle',
      availableForTrading: true,
      departureTime: '07:30',
      requiredSoCAtDeparture: 0.80,
      lastUpdated: Date.now()
    });

    this.storageUnits.set('powerwall', {
      id: 'powerwall',
      name: 'Powerwall',
      capacityKWh: 27,
      currentChargeKWh: 13.5,
      maxChargeRateKW: 5.8,
      maxDischargeRateKW: 5.8,
      chargeEfficiency: 0.96,
      dischargeEfficiency: 0.96,
      cycleCount: 0,
      maxCycles: 8000,
      degradation: 0,
      minSoC: 0.05,
      maxSoC: 0.98,
      status: 'idle',
      lastUpdated: Date.now()
    });

    this.log('Storage units initialized: ' + this.storageUnits.size);
  }

  _initializeStrategies() {
    this.strategies.set('conservative', {
      name: 'Conservative',
      buyThresholdPercentile: 15,
      sellThresholdPercentile: 85,
      maxDailyTrades: 4,
      riskTolerance: 0.2,
      minProfitMargin: 0.15,
      description: 'Low risk, only trades on extreme price movements'
    });

    this.strategies.set('balanced', {
      name: 'Balanced',
      buyThresholdPercentile: 30,
      sellThresholdPercentile: 70,
      maxDailyTrades: 8,
      riskTolerance: 0.5,
      minProfitMargin: 0.08,
      description: 'Moderate risk, balanced between savings and active trading'
    });

    this.strategies.set('aggressive', {
      name: 'Aggressive',
      buyThresholdPercentile: 40,
      sellThresholdPercentile: 60,
      maxDailyTrades: 16,
      riskTolerance: 0.8,
      minProfitMargin: 0.03,
      description: 'High risk, trades frequently on smaller margins'
    });

    this.strategies.set('peak_shaving', {
      name: 'Peak Shaving',
      buyThresholdPercentile: 25,
      sellThresholdPercentile: 90,
      maxDailyTrades: 6,
      riskTolerance: 0.3,
      minProfitMargin: 0.10,
      peakHours: [7, 8, 9, 17, 18, 19, 20],
      description: 'Focuses on reducing peak demand charges by shifting load'
    });

    this.strategies.set('self_consumption', {
      name: 'Self Consumption',
      buyThresholdPercentile: 20,
      sellThresholdPercentile: 95,
      maxDailyTrades: 3,
      riskTolerance: 0.1,
      minProfitMargin: 0.20,
      solarPriority: true,
      description: 'Maximizes self-consumption of locally generated energy'
    });

    this.log('Trading strategies initialized: ' + this.strategies.size);
  }

  _initializeP2PNeighbors() {
    this.p2pNeighbors.set('neighbor_north', {
      id: 'neighbor_north',
      name: 'Nilsson Household',
      distance: 120,
      hasGeneration: true,
      generationCapacityKW: 8.5,
      trustScore: 0.92,
      tradeHistory: [],
      preferredBuyPrice: null,
      preferredSellPrice: null,
      connectionStatus: 'active',
      lastTrade: null
    });

    this.p2pNeighbors.set('neighbor_east', {
      id: 'neighbor_east',
      name: 'Andersson Household',
      distance: 85,
      hasGeneration: false,
      generationCapacityKW: 0,
      trustScore: 0.88,
      tradeHistory: [],
      preferredBuyPrice: null,
      preferredSellPrice: null,
      connectionStatus: 'active',
      lastTrade: null
    });

    this.p2pNeighbors.set('neighbor_south', {
      id: 'neighbor_south',
      name: 'Johansson Household',
      distance: 200,
      hasGeneration: true,
      generationCapacityKW: 12.0,
      trustScore: 0.95,
      tradeHistory: [],
      preferredBuyPrice: null,
      preferredSellPrice: null,
      connectionStatus: 'active',
      lastTrade: null
    });

    this.log('P2P neighbors initialized: ' + this.p2pNeighbors.size);
  }

  _initializeFeedInTariffs() {
    this.feedInTariffs.set('solar', {
      type: 'solar',
      rate: 0.50,
      currency: 'SEK',
      unit: 'kWh',
      validFrom: new Date('2025-01-01'),
      validTo: new Date('2026-12-31'),
      maxCapacityKW: 10,
      totalFedInKWh: 0,
      monthlyFedInKWh: 0,
      monthlyRevenue: 0
    });

    this.feedInTariffs.set('wind', {
      type: 'wind',
      rate: 0.45,
      currency: 'SEK',
      unit: 'kWh',
      validFrom: new Date('2025-01-01'),
      validTo: new Date('2026-12-31'),
      maxCapacityKW: 5,
      totalFedInKWh: 0,
      monthlyFedInKWh: 0,
      monthlyRevenue: 0
    });

    this.feedInTariffs.set('battery', {
      type: 'battery',
      rate: 0.35,
      currency: 'SEK',
      unit: 'kWh',
      validFrom: new Date('2025-01-01'),
      validTo: new Date('2026-12-31'),
      maxCapacityKW: 15,
      totalFedInKWh: 0,
      monthlyFedInKWh: 0,
      monthlyRevenue: 0
    });

    this.log('Feed-in tariffs initialized');
  }

  _initializeGridServices() {
    this.gridServices.set('frequency_regulation', {
      name: 'Frequency Regulation',
      enabled: true,
      contractPowerKW: 5.0,
      rewardPerMWh: 150,
      activations: 0,
      totalRevenue: 0,
      lastActivation: null,
      minResponseTimeMs: 1000,
      availableCapacityKW: 0
    });

    this.gridServices.set('demand_response', {
      name: 'Demand Response',
      enabled: true,
      contractPowerKW: 10.0,
      rewardPerEvent: 50,
      activations: 0,
      totalRevenue: 0,
      lastActivation: null,
      minNoticePeriodMs: 3600000,
      events: []
    });

    this.gridServices.set('capacity_market', {
      name: 'Capacity Market',
      enabled: true,
      pledgedCapacityKW: 8.0,
      monthlyPayment: 200,
      penaltyPerMissedMW: 500,
      activations: 0,
      totalRevenue: 0,
      lastActivation: null,
      availability: 0.98
    });

    this.log('Grid services initialized: ' + this.gridServices.size);
  }

  _loadSettings() {
    this.settings = {
      currency: 'SEK',
      timezone: 'Europe/Stockholm',
      gridConnectionCapacityKW: 25,
      solarCapacityKW: 10,
      defaultStrategy: 'balanced',
      autoTradingEnabled: true,
      maxInvestmentPerTrade: 100,
      dailyTradingBudget: 500,
      notifyOnTrade: true,
      notifyOnPriceAlert: true,
      priceAlertThresholdHigh: 2.0,
      priceAlertThresholdLow: 0.3,
      historicalDataRetentionDays: 90,
      p2pTradingEnabled: true,
      gridServicesEnabled: true,
      exportLimitKW: 15,
      importLimitKW: 25,
      taxDeductionEnabled: true,
      taxDeductionRate: 0.60
    };
    this.log('Settings loaded');
  }

  generateHourlyPrices() {
    const prices = [];
    const now = new Date();
    const month = now.getMonth();
    const dayOfWeek = now.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const seasonalMultiplier = this._getSeasonalMultiplier(month);
    const weekendDiscount = isWeekend ? 0.85 : 1.0;

    for (let hour = 0; hour < 24; hour++) {
      let basePrice;
      if (hour >= 0 && hour < 6) {
        basePrice = 0.3 + Math.random() * 0.2;
      } else if (hour >= 6 && hour < 8) {
        basePrice = 0.5 + Math.random() * 0.4;
      } else if (hour >= 8 && hour < 11) {
        basePrice = 0.8 + Math.random() * 0.4;
      } else if (hour >= 11 && hour < 14) {
        basePrice = 0.7 + Math.random() * 0.3;
      } else if (hour >= 14 && hour < 17) {
        basePrice = 0.8 + Math.random() * 0.4;
      } else if (hour >= 17 && hour < 21) {
        basePrice = 1.5 + Math.random() * 1.0;
      } else {
        basePrice = 0.6 + Math.random() * 0.3;
      }

      const noise = (Math.random() - 0.5) * 0.1;
      const finalPrice = Math.max(0.05, (basePrice + noise) * seasonalMultiplier * weekendDiscount);

      prices.push({
        hour: hour,
        price: Math.round(finalPrice * 100) / 100,
        currency: 'SEK',
        timestamp: new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour).getTime(),
        area: 'SE3',
        source: 'nordpool_simulated'
      });
    }

    return prices;
  }

  _getSeasonalMultiplier(month) {
    const multipliers = [1.4, 1.3, 1.1, 0.9, 0.7, 0.6, 0.5, 0.6, 0.8, 1.0, 1.2, 1.5];
    return multipliers[month] || 1.0;
  }

  _seedPriceHistory() {
    const now = Date.now();
    for (let day = 6; day >= 0; day--) {
      const dayTimestamp = now - day * 86400000;
      const dayDate = new Date(dayTimestamp);
      const month = dayDate.getMonth();
      const dayOfWeek = dayDate.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const seasonalMult = this._getSeasonalMultiplier(month);
      const weekendDisc = isWeekend ? 0.85 : 1.0;

      for (let hour = 0; hour < 24; hour++) {
        let basePrice;
        if (hour >= 0 && hour < 6) {
          basePrice = 0.3 + Math.random() * 0.2;
        } else if (hour >= 6 && hour < 8) {
          basePrice = 0.5 + Math.random() * 0.4;
        } else if (hour >= 8 && hour < 11) {
          basePrice = 0.8 + Math.random() * 0.4;
        } else if (hour >= 11 && hour < 14) {
          basePrice = 0.7 + Math.random() * 0.3;
        } else if (hour >= 14 && hour < 17) {
          basePrice = 0.8 + Math.random() * 0.4;
        } else if (hour >= 17 && hour < 21) {
          basePrice = 1.5 + Math.random() * 1.0;
        } else {
          basePrice = 0.6 + Math.random() * 0.3;
        }

        const noise = (Math.random() - 0.5) * 0.1;
        const finalPrice = Math.max(0.05, (basePrice + noise) * seasonalMult * weekendDisc);

        this.priceHistory.push({
          hour: hour,
          price: Math.round(finalPrice * 100) / 100,
          timestamp: new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), hour).getTime()
        });
      }
    }

    this._updateRollingStats();
    this.log('Price history seeded with ' + this.priceHistory.length + ' entries over 7 days');
  }

  _updateRollingStats() {
    if (this.priceHistory.length === 0) {
      return;
    }

    const prices = this.priceHistory.map(p => p.price);
    const sum = prices.reduce((a, b) => a + b, 0);
    this.rollingStats.mean = sum / prices.length;

    const squaredDiffs = prices.map(p => Math.pow(p - this.rollingStats.mean, 2));
    this.rollingStats.stdDev = Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / prices.length);
    this.rollingStats.min = Math.min(...prices);
    this.rollingStats.max = Math.max(...prices);

    const sorted = [...prices].sort((a, b) => a - b);
    this.rollingStats.p10 = sorted[Math.floor(sorted.length * 0.10)] || 0;
    this.rollingStats.p25 = sorted[Math.floor(sorted.length * 0.25)] || 0;
    this.rollingStats.p50 = sorted[Math.floor(sorted.length * 0.50)] || 0;
    this.rollingStats.p75 = sorted[Math.floor(sorted.length * 0.75)] || 0;
    this.rollingStats.p90 = sorted[Math.floor(sorted.length * 0.90)] || 0;
  }

  _getDynamicThreshold(percentile) {
    const sorted = this.priceHistory.map(p => p.price).sort((a, b) => a - b);
    if (sorted.length === 0) {
      return 0;
    }
    const index = Math.floor(sorted.length * (percentile / 100));
    return sorted[Math.min(index, sorted.length - 1)];
  }

  predictPrices(hours) {
    const predictions = [];
    const now = new Date();
    const bucketAverages = {};

    for (const entry of this.priceHistory) {
      const h = entry.hour;
      if (!bucketAverages[h]) {
        bucketAverages[h] = { sum: 0, count: 0 };
      }
      bucketAverages[h].sum += entry.price;
      bucketAverages[h].count += 1;
    }

    for (let i = 0; i < hours; i++) {
      const futureDate = new Date(now.getTime() + i * 3600000);
      const futureHour = futureDate.getHours();
      const bucket = bucketAverages[futureHour];
      let predictedPrice = this.rollingStats.mean;

      if (bucket && bucket.count > 0) {
        predictedPrice = bucket.sum / bucket.count;
      }

      const confidence = Math.max(0.3, 1 - (i * 0.02));
      const uncertainty = (1 - confidence) * this.rollingStats.stdDev;
      const noise = (Math.random() - 0.5) * uncertainty;

      predictions.push({
        hour: futureHour,
        timestamp: futureDate.getTime(),
        predictedPrice: Math.round((predictedPrice + noise) * 100) / 100,
        confidence: Math.round(confidence * 100) / 100,
        lowerBound: Math.round(Math.max(0.01, predictedPrice - 2 * this.rollingStats.stdDev) * 100) / 100,
        upperBound: Math.round((predictedPrice + 2 * this.rollingStats.stdDev) * 100) / 100
      });
    }

    this.log('Generated ' + predictions.length + '-hour price predictions');
    return predictions;
  }

  getCurrentPrice() {
    const hour = new Date().getHours();
    const priceEntry = this.spotPrices.find(p => p.hour === hour);
    return priceEntry ? priceEntry.price : this.rollingStats.mean;
  }

  chargeStorage(unitId, amountKWh) {
    const unit = this.storageUnits.get(unitId);
    if (!unit) {
      this.error('Storage unit not found: ' + unitId);
      return { success: false, reason: 'unit_not_found' };
    }

    const maxChargeable = (unit.maxSoC * unit.capacityKWh) - unit.currentChargeKWh;
    const effectiveAmount = Math.min(amountKWh, maxChargeable, unit.maxChargeRateKW);

    if (effectiveAmount <= 0) {
      return { success: false, reason: 'storage_full_or_at_max_soc' };
    }

    const energyFromGrid = effectiveAmount / unit.chargeEfficiency;
    unit.currentChargeKWh += effectiveAmount;
    unit.status = 'charging';
    unit.lastUpdated = Date.now();

    const price = this.getCurrentPrice();
    const cost = energyFromGrid * price;

    this.recordTransaction('charge', unitId, effectiveAmount, price, cost);
    this.log('Charged ' + unitId + ': ' + effectiveAmount.toFixed(2) + ' kWh at ' + price.toFixed(2) + ' SEK/kWh, cost: ' + cost.toFixed(2) + ' SEK');

    return {
      success: true,
      charged: effectiveAmount,
      energyFromGrid: energyFromGrid,
      cost: cost,
      newSoC: unit.currentChargeKWh / unit.capacityKWh
    };
  }

  dischargeStorage(unitId, amountKWh) {
    const unit = this.storageUnits.get(unitId);
    if (!unit) {
      this.error('Storage unit not found: ' + unitId);
      return { success: false, reason: 'unit_not_found' };
    }

    const minCharge = unit.minSoC * unit.capacityKWh;
    const maxDischargeable = unit.currentChargeKWh - minCharge;
    const effectiveAmount = Math.min(amountKWh, maxDischargeable, unit.maxDischargeRateKW);

    if (effectiveAmount <= 0) {
      return { success: false, reason: 'at_minimum_soc' };
    }

    const energyToGrid = effectiveAmount * unit.dischargeEfficiency;
    unit.currentChargeKWh -= effectiveAmount;
    unit.cycleCount += effectiveAmount / unit.capacityKWh;
    unit.status = 'discharging';
    unit.lastUpdated = Date.now();

    const price = this.getCurrentPrice();
    const revenue = energyToGrid * price;

    this.recordTransaction('discharge', unitId, effectiveAmount, price, revenue);
    this.log('Discharged ' + unitId + ': ' + effectiveAmount.toFixed(2) + ' kWh at ' + price.toFixed(2) + ' SEK/kWh, revenue: ' + revenue.toFixed(2) + ' SEK');

    return {
      success: true,
      discharged: effectiveAmount,
      energyToGrid: energyToGrid,
      revenue: revenue,
      newSoC: unit.currentChargeKWh / unit.capacityKWh
    };
  }

  recordTransaction(type, unitId, amountKWh, pricePerKWh, totalValue) {
    const transaction = {
      id: 'txn_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
      type: type,
      unitId: unitId,
      amountKWh: Math.round(amountKWh * 1000) / 1000,
      pricePerKWh: pricePerKWh,
      totalValue: Math.round(totalValue * 100) / 100,
      timestamp: Date.now(),
      strategy: this.currentStrategy,
      spotPriceAtTime: this.getCurrentPrice()
    };

    this.transactions.push(transaction);
    this.totalEnergyTraded += amountKWh;

    if (type === 'discharge' || type === 'sell' || type === 'feed_in') {
      this.dailyPnL += totalValue;
    } else if (type === 'charge' || type === 'buy') {
      this.dailyPnL -= totalValue;
    }

    if (this.transactions.length > 10000) {
      this.transactions = this.transactions.slice(-5000);
    }

    return transaction;
  }

  getPnL(period) {
    const now = Date.now();
    let startTime;

    switch (period) {
      case 'today':
        startTime = new Date().setHours(0, 0, 0, 0);
        break;
      case 'week':
        startTime = now - 7 * 86400000;
        break;
      case 'month':
        startTime = now - 30 * 86400000;
        break;
      case 'year':
        startTime = now - 365 * 86400000;
        break;
      default:
        startTime = now - 86400000;
    }

    const filtered = this.transactions.filter(t => t.timestamp >= startTime);
    let revenue = 0;
    let costs = 0;

    for (const txn of filtered) {
      if (txn.type === 'discharge' || txn.type === 'sell' || txn.type === 'feed_in' || txn.type === 'p2p_sell' || txn.type === 'grid_service') {
        revenue += txn.totalValue;
      } else {
        costs += txn.totalValue;
      }
    }

    const energyBought = filtered.filter(t => t.type === 'charge' || t.type === 'buy' || t.type === 'p2p_buy')
      .reduce((s, t) => s + t.amountKWh, 0);
    const energySold = filtered.filter(t => t.type === 'discharge' || t.type === 'sell' || t.type === 'p2p_sell')
      .reduce((s, t) => s + t.amountKWh, 0);

    return {
      period: period,
      revenue: Math.round(revenue * 100) / 100,
      costs: Math.round(costs * 100) / 100,
      profit: Math.round((revenue - costs) * 100) / 100,
      transactionCount: filtered.length,
      avgTransactionValue: filtered.length > 0
        ? Math.round(((revenue + costs) / filtered.length) * 100) / 100
        : 0,
      energyBoughtKWh: Math.round(energyBought * 100) / 100,
      energySoldKWh: Math.round(energySold * 100) / 100,
      totalEnergyTraded: Math.round((energyBought + energySold) * 100) / 100
    };
  }

  evaluateTradeOpportunity() {
    const currentPrice = this.getCurrentPrice();
    const strategy = this.strategies.get(this.currentStrategy);
    if (!strategy) {
      return null;
    }

    const buyThreshold = this._getDynamicThreshold(strategy.buyThresholdPercentile);
    const sellThreshold = this._getDynamicThreshold(strategy.sellThresholdPercentile);

    const todayStart = new Date().setHours(0, 0, 0, 0);
    const todayTrades = this.transactions.filter(t => t.timestamp >= todayStart).length;

    if (todayTrades >= strategy.maxDailyTrades) {
      return { action: 'hold', reason: 'daily_trade_limit_reached', todayTrades: todayTrades };
    }

    if (currentPrice <= buyThreshold) {
      const totalAvailableCapacity = this._getTotalAvailableChargeCapacity();
      if (totalAvailableCapacity > 0.5) {
        return {
          action: 'buy',
          price: currentPrice,
          threshold: buyThreshold,
          availableCapacity: totalAvailableCapacity,
          confidence: Math.min(1, (buyThreshold - currentPrice) / buyThreshold + 0.3),
          reason: 'price_below_buy_threshold'
        };
      }
    }

    if (currentPrice >= sellThreshold) {
      const totalAvailableDischarge = this._getTotalAvailableDischargeCapacity();
      if (totalAvailableDischarge > 0.5) {
        const expectedProfit = currentPrice - this._getAverageChargeCost();
        if (expectedProfit >= strategy.minProfitMargin) {
          return {
            action: 'sell',
            price: currentPrice,
            threshold: sellThreshold,
            availableCapacity: totalAvailableDischarge,
            expectedProfit: expectedProfit,
            confidence: Math.min(1, (currentPrice - sellThreshold) / currentPrice + 0.3),
            reason: 'price_above_sell_threshold'
          };
        }
      }
    }

    return {
      action: 'hold',
      price: currentPrice,
      buyThreshold: buyThreshold,
      sellThreshold: sellThreshold,
      reason: 'price_within_thresholds'
    };
  }

  _getTotalAvailableChargeCapacity() {
    let total = 0;
    for (const [, unit] of this.storageUnits) {
      const available = (unit.maxSoC * unit.capacityKWh) - unit.currentChargeKWh;
      total += Math.max(0, available);
    }
    return total;
  }

  _getTotalAvailableDischargeCapacity() {
    let total = 0;
    for (const [, unit] of this.storageUnits) {
      const available = unit.currentChargeKWh - (unit.minSoC * unit.capacityKWh);
      total += Math.max(0, available);
    }
    return total;
  }

  _getAverageChargeCost() {
    const charges = this.transactions.filter(t => t.type === 'charge');
    if (charges.length === 0) {
      return this.rollingStats.mean;
    }
    const total = charges.reduce((sum, t) => sum + t.pricePerKWh, 0);
    return total / charges.length;
  }

  executeTrade(opportunity) {
    if (!opportunity || opportunity.action === 'hold') {
      return null;
    }

    if (opportunity.action === 'buy') {
      const bestUnit = this._findBestStorageForCharge();
      if (bestUnit) {
        const chargeAmount = Math.min(opportunity.availableCapacity, bestUnit.maxChargeRateKW);
        return this.chargeStorage(bestUnit.id, chargeAmount);
      }
    }

    if (opportunity.action === 'sell') {
      const bestUnit = this._findBestStorageForDischarge();
      if (bestUnit) {
        const dischargeAmount = Math.min(opportunity.availableCapacity, bestUnit.maxDischargeRateKW);
        return this.dischargeStorage(bestUnit.id, dischargeAmount);
      }
    }

    return null;
  }

  _findBestStorageForCharge() {
    let bestUnit = null;
    let mostCapacity = 0;
    for (const [, unit] of this.storageUnits) {
      const available = (unit.maxSoC * unit.capacityKWh) - unit.currentChargeKWh;
      if (available > mostCapacity) {
        mostCapacity = available;
        bestUnit = unit;
      }
    }
    return bestUnit;
  }

  _findBestStorageForDischarge() {
    let bestUnit = null;
    let mostEnergy = 0;
    for (const [, unit] of this.storageUnits) {
      const available = unit.currentChargeKWh - (unit.minSoC * unit.capacityKWh);
      if (available > mostEnergy) {
        mostEnergy = available;
        bestUnit = unit;
      }
    }
    return bestUnit;
  }

  frequencyRegulation() {
    const service = this.gridServices.get('frequency_regulation');
    if (!service || !service.enabled) {
      return null;
    }

    const totalCapacity = this._getTotalAvailableDischargeCapacity();
    service.availableCapacityKW = Math.min(totalCapacity, service.contractPowerKW);

    const frequencyDeviation = (Math.random() - 0.5) * 0.4;
    const needsResponse = Math.abs(frequencyDeviation) > 0.1;

    if (needsResponse && service.availableCapacityKW > 0) {
      const responseKW = Math.min(Math.abs(frequencyDeviation) * 10, service.availableCapacityKW);
      const durationHours = 5 / 60;
      const reward = responseKW * (service.rewardPerMWh / 1000) * durationHours;

      service.activations += 1;
      service.totalRevenue += reward;
      service.lastActivation = Date.now();

      this.recordTransaction('grid_service', 'frequency_regulation', responseKW * durationHours, reward / (responseKW * durationHours), reward);
      this.log('Frequency regulation activated: ' + responseKW.toFixed(2) + ' kW response, reward: ' + reward.toFixed(2) + ' SEK');

      return {
        activated: true,
        deviation: frequencyDeviation,
        responseKW: responseKW,
        reward: reward,
        direction: frequencyDeviation > 0 ? 'discharge' : 'charge'
      };
    }

    return { activated: false, deviation: frequencyDeviation };
  }

  demandResponse() {
    const service = this.gridServices.get('demand_response');
    if (!service || !service.enabled) {
      return null;
    }

    const gridStress = Math.random();
    const eventTriggered = gridStress > 0.90;

    if (eventTriggered) {
      const reductionKW = Math.min(service.contractPowerKW, this._getTotalAvailableDischargeCapacity());
      const durationHours = 1 + Math.floor(Math.random() * 3);
      const reward = service.rewardPerEvent * (reductionKW / service.contractPowerKW);

      service.activations += 1;
      service.totalRevenue += reward;
      service.lastActivation = Date.now();
      service.events.push({
        timestamp: Date.now(),
        reductionKW: reductionKW,
        durationHours: durationHours,
        reward: reward,
        gridStress: gridStress
      });

      if (service.events.length > 100) {
        service.events = service.events.slice(-50);
      }

      this.recordTransaction('grid_service', 'demand_response', reductionKW * durationHours, reward / (reductionKW * durationHours), reward);
      this.log('Demand response event: ' + reductionKW.toFixed(2) + ' kW reduction for ' + durationHours + 'h, reward: ' + reward.toFixed(2) + ' SEK');

      return { activated: true, reductionKW: reductionKW, durationHours: durationHours, reward: reward };
    }

    return { activated: false, gridStress: gridStress };
  }

  capacityMarket() {
    const service = this.gridServices.get('capacity_market');
    if (!service || !service.enabled) {
      return null;
    }

    const totalCapacity = this._getTotalAvailableDischargeCapacity() + this._getTotalAvailableChargeCapacity();
    const availabilityRatio = Math.min(1, totalCapacity / service.pledgedCapacityKW);
    service.availability = service.availability * 0.99 + availabilityRatio * 0.01;

    const now = new Date();
    const isFirstOfMonth = now.getDate() === 1;
    const alreadyPaidToday = service.lastActivation && new Date(service.lastActivation).toDateString() === now.toDateString();

    if (isFirstOfMonth && !alreadyPaidToday) {
      const payment = service.monthlyPayment * service.availability;
      service.totalRevenue += payment;
      service.activations += 1;
      service.lastActivation = Date.now();

      this.recordTransaction('grid_service', 'capacity_market', service.pledgedCapacityKW, payment / service.pledgedCapacityKW, payment);
      this.log('Capacity market monthly payment received: ' + payment.toFixed(2) + ' SEK, availability: ' + (service.availability * 100).toFixed(1) + '%');

      return { payment: payment, availability: service.availability };
    }

    return { availability: service.availability, pledgedCapacityKW: service.pledgedCapacityKW };
  }

  initiateP2PTrade(neighborId, type, amountKWh) {
    const neighbor = this.p2pNeighbors.get(neighborId);
    if (!neighbor) {
      this.error('P2P neighbor not found: ' + neighborId);
      return { success: false, reason: 'neighbor_not_found' };
    }

    if (neighbor.connectionStatus !== 'active') {
      return { success: false, reason: 'neighbor_offline' };
    }

    const currentPrice = this.getCurrentPrice();
    const p2pDiscountRate = 0.15;
    const tradePrice = currentPrice * (1 - p2pDiscountRate);

    if (type === 'sell') {
      const availableEnergy = this._getTotalAvailableDischargeCapacity();
      const tradeAmount = Math.min(amountKWh, availableEnergy);
      if (tradeAmount <= 0) {
        return { success: false, reason: 'insufficient_energy' };
      }

      const revenue = tradeAmount * tradePrice;
      const bestUnit = this._findBestStorageForDischarge();
      if (bestUnit) {
        bestUnit.currentChargeKWh -= tradeAmount;
        bestUnit.lastUpdated = Date.now();
      }

      const trade = {
        timestamp: Date.now(),
        type: 'sell',
        neighborId: neighborId,
        neighborName: neighbor.name,
        amountKWh: tradeAmount,
        pricePerKWh: tradePrice,
        totalValue: revenue
      };

      neighbor.tradeHistory.push(trade);
      neighbor.lastTrade = Date.now();
      if (neighbor.tradeHistory.length > 200) {
        neighbor.tradeHistory = neighbor.tradeHistory.slice(-100);
      }

      this.recordTransaction('p2p_sell', neighborId, tradeAmount, tradePrice, revenue);
      this.log('P2P sold ' + tradeAmount.toFixed(2) + ' kWh to ' + neighbor.name + ' at ' + tradePrice.toFixed(2) + ' SEK/kWh');
      return { success: true, trade: trade };
    }

    if (type === 'buy') {
      if (!neighbor.hasGeneration) {
        return { success: false, reason: 'neighbor_has_no_generation' };
      }

      const availableCapacity = this._getTotalAvailableChargeCapacity();
      const tradeAmount = Math.min(amountKWh, availableCapacity);
      if (tradeAmount <= 0) {
        return { success: false, reason: 'storage_full' };
      }

      const cost = tradeAmount * tradePrice;
      const bestUnit = this._findBestStorageForCharge();
      if (bestUnit) {
        bestUnit.currentChargeKWh += tradeAmount * bestUnit.chargeEfficiency;
        bestUnit.lastUpdated = Date.now();
      }

      const trade = {
        timestamp: Date.now(),
        type: 'buy',
        neighborId: neighborId,
        neighborName: neighbor.name,
        amountKWh: tradeAmount,
        pricePerKWh: tradePrice,
        totalValue: cost
      };

      neighbor.tradeHistory.push(trade);
      neighbor.lastTrade = Date.now();
      if (neighbor.tradeHistory.length > 200) {
        neighbor.tradeHistory = neighbor.tradeHistory.slice(-100);
      }

      this.recordTransaction('p2p_buy', neighborId, tradeAmount, tradePrice, cost);
      this.log('P2P bought ' + tradeAmount.toFixed(2) + ' kWh from ' + neighbor.name + ' at ' + tradePrice.toFixed(2) + ' SEK/kWh');
      return { success: true, trade: trade };
    }

    return { success: false, reason: 'invalid_trade_type' };
  }

  trackFeedIn(type, amountKWh) {
    const tariff = this.feedInTariffs.get(type);
    if (!tariff) {
      this.error('Feed-in tariff not found: ' + type);
      return null;
    }

    const now = new Date();
    if (now < tariff.validFrom || now > tariff.validTo) {
      return { success: false, reason: 'tariff_expired' };
    }

    if (amountKWh <= 0) {
      return { success: false, reason: 'invalid_amount' };
    }

    const revenue = amountKWh * tariff.rate;
    tariff.totalFedInKWh += amountKWh;
    tariff.monthlyFedInKWh += amountKWh;
    tariff.monthlyRevenue += revenue;

    this.recordTransaction('feed_in', type, amountKWh, tariff.rate, revenue);
    this.log('Feed-in tracked: ' + amountKWh.toFixed(2) + ' kWh of ' + type + ' at ' + tariff.rate + ' SEK/kWh = ' + revenue.toFixed(2) + ' SEK');

    return {
      success: true,
      type: type,
      amountKWh: amountKWh,
      rate: tariff.rate,
      revenue: revenue,
      totalFedInKWh: tariff.totalFedInKWh,
      monthlyFedInKWh: tariff.monthlyFedInKWh
    };
  }

  setStrategy(strategyName) {
    if (!this.strategies.has(strategyName)) {
      this.error('Unknown strategy: ' + strategyName);
      return false;
    }
    const previous = this.currentStrategy;
    this.currentStrategy = strategyName;
    this.log('Strategy changed from ' + previous + ' to ' + strategyName);
    return true;
  }

  getStorageStatus() {
    const statuses = {};
    for (const [id, unit] of this.storageUnits) {
      const soc = unit.currentChargeKWh / unit.capacityKWh;
      const healthPercent = Math.max(0, (1 - unit.cycleCount / unit.maxCycles) * 100);
      statuses[id] = {
        name: unit.name,
        socPercent: Math.round(soc * 100),
        currentKWh: Math.round(unit.currentChargeKWh * 100) / 100,
        capacityKWh: unit.capacityKWh,
        status: unit.status,
        cycleCount: Math.round(unit.cycleCount * 10) / 10,
        healthPercent: Math.round(healthPercent),
        chargeEfficiency: unit.chargeEfficiency,
        dischargeEfficiency: unit.dischargeEfficiency,
        lastUpdated: unit.lastUpdated
      };
    }
    return statuses;
  }

  getMarketAnalysis() {
    const currentPrice = this.getCurrentPrice();
    const predictions = this.predictPrices(24);
    const pnlToday = this.getPnL('today');
    const pnlWeek = this.getPnL('week');

    const strategy = this.strategies.get(this.currentStrategy);
    const buyThreshold = this._getDynamicThreshold(strategy.buyThresholdPercentile);
    const sellThreshold = this._getDynamicThreshold(strategy.sellThresholdPercentile);

    let lowestFuturePrice = Infinity;
    let highestFuturePrice = -Infinity;
    let lowestHour = 0;
    let highestHour = 0;

    for (const pred of predictions) {
      if (pred.predictedPrice < lowestFuturePrice) {
        lowestFuturePrice = pred.predictedPrice;
        lowestHour = pred.hour;
      }
      if (pred.predictedPrice > highestFuturePrice) {
        highestFuturePrice = pred.predictedPrice;
        highestHour = pred.hour;
      }
    }

    return {
      currentPrice: currentPrice,
      priceArea: 'SE3',
      buyThreshold: buyThreshold,
      sellThreshold: sellThreshold,
      rollingStats: { ...this.rollingStats },
      predictions: predictions.slice(0, 6),
      lowestFuturePrice: lowestFuturePrice,
      lowestHour: lowestHour,
      highestFuturePrice: highestFuturePrice,
      highestHour: highestHour,
      pnlToday: pnlToday,
      pnlWeek: pnlWeek,
      currentStrategy: this.currentStrategy,
      recommendation: this.evaluateTradeOpportunity()
    };
  }

  _startMonitoring() {
    this.monitoringInterval = setInterval(() => {
      this._monitoringCycle();
    }, 300000);

    this.priceUpdateInterval = setInterval(() => {
      this._hourlyPriceUpdate();
    }, 3600000);

    this.log('Monitoring started: 5-min trading cycle, 1-hour price updates');
  }

  _hourlyPriceUpdate() {
    try {
      this.spotPrices = this.generateHourlyPrices();
      for (const price of this.spotPrices) {
        this.priceHistory.push(price);
      }
      const sevenDaysAgo = Date.now() - 7 * 86400000;
      this.priceHistory = this.priceHistory.filter(p => p.timestamp >= sevenDaysAgo);
      this._updateRollingStats();
      this.log('Hourly price update complete, history: ' + this.priceHistory.length + ' entries');
    } catch (err) {
      this.error('Hourly price update failed: ' + err.message);
    }
  }

  _monitoringCycle() {
    try {
      const opportunity = this.evaluateTradeOpportunity();

      if (this.settings.autoTradingEnabled && opportunity && opportunity.action !== 'hold') {
        const result = this.executeTrade(opportunity);
        if (result && result.success) {
          this.log('Auto-trade executed: ' + opportunity.action + ' - ' + JSON.stringify(result));
        }
      }

      if (this.settings.gridServicesEnabled) {
        this.frequencyRegulation();
        if (Math.random() > 0.80) {
          this.demandResponse();
        }
        this.capacityMarket();
      }

      for (const [, unit] of this.storageUnits) {
        if (unit.status !== 'idle') {
          unit.status = 'idle';
        }
      }

      const currentPrice = this.getCurrentPrice();
      if (this.settings.notifyOnPriceAlert) {
        if (currentPrice >= this.settings.priceAlertThresholdHigh) {
          this.log('HIGH PRICE ALERT: ' + currentPrice.toFixed(2) + ' SEK/kWh exceeds threshold ' + this.settings.priceAlertThresholdHigh);
        }
        if (currentPrice <= this.settings.priceAlertThresholdLow) {
          this.log('LOW PRICE ALERT: ' + currentPrice.toFixed(2) + ' SEK/kWh below threshold ' + this.settings.priceAlertThresholdLow);
        }
      }

      this._checkEVDepartureReadiness();
    } catch (err) {
      this.error('Monitoring cycle error: ' + err.message);
    }
  }

  _checkEVDepartureReadiness() {
    const evBattery = this.storageUnits.get('ev_battery');
    if (!evBattery || !evBattery.availableForTrading) {
      return;
    }

    const now = new Date();
    const [depHour, depMin] = evBattery.departureTime.split(':').map(Number);
    const minutesUntilDeparture = (depHour * 60 + depMin) - (now.getHours() * 60 + now.getMinutes());

    if (minutesUntilDeparture > 0 && minutesUntilDeparture <= 120) {
      const currentSoC = evBattery.currentChargeKWh / evBattery.capacityKWh;
      if (currentSoC < evBattery.requiredSoCAtDeparture) {
        const neededKWh = (evBattery.requiredSoCAtDeparture * evBattery.capacityKWh) - evBattery.currentChargeKWh;
        this.log('EV departure in ' + minutesUntilDeparture + ' min, needs ' + neededKWh.toFixed(1) + ' kWh to reach ' + (evBattery.requiredSoCAtDeparture * 100) + '% SoC');
        this.chargeStorage('ev_battery', Math.min(neededKWh, evBattery.maxChargeRateKW));
      }
    }
  }

  getStatistics() {
    const storageStatus = this.getStorageStatus();
    const pnlToday = this.getPnL('today');
    const pnlWeek = this.getPnL('week');
    const pnlMonth = this.getPnL('month');

    let gridServicesRevenue = 0;
    const gridServicesSummary = {};
    for (const [key, service] of this.gridServices) {
      gridServicesRevenue += service.totalRevenue;
      gridServicesSummary[key] = {
        name: service.name,
        enabled: service.enabled,
        activations: service.activations,
        totalRevenue: Math.round(service.totalRevenue * 100) / 100
      };
    }

    let feedInRevenue = 0;
    const feedInSummary = {};
    for (const [key, tariff] of this.feedInTariffs) {
      const rev = tariff.totalFedInKWh * tariff.rate;
      feedInRevenue += rev;
      feedInSummary[key] = {
        rate: tariff.rate,
        totalFedInKWh: Math.round(tariff.totalFedInKWh * 100) / 100,
        monthlyFedInKWh: Math.round(tariff.monthlyFedInKWh * 100) / 100,
        totalRevenue: Math.round(rev * 100) / 100
      };
    }

    let p2pTradeCount = 0;
    const p2pSummary = {};
    for (const [key, neighbor] of this.p2pNeighbors) {
      p2pTradeCount += neighbor.tradeHistory.length;
      p2pSummary[key] = {
        name: neighbor.name,
        trustScore: neighbor.trustScore,
        trades: neighbor.tradeHistory.length,
        connectionStatus: neighbor.connectionStatus,
        lastTrade: neighbor.lastTrade
      };
    }

    return {
      currentPrice: this.getCurrentPrice(),
      currentStrategy: this.currentStrategy,
      storage: storageStatus,
      pnl: {
        today: pnlToday,
        week: pnlWeek,
        month: pnlMonth
      },
      totalTransactions: this.transactions.length,
      totalEnergyTradedKWh: Math.round(this.totalEnergyTraded * 100) / 100,
      gridServices: gridServicesSummary,
      gridServicesRevenue: Math.round(gridServicesRevenue * 100) / 100,
      feedIn: feedInSummary,
      feedInRevenue: Math.round(feedInRevenue * 100) / 100,
      p2p: p2pSummary,
      p2pTradeCount: p2pTradeCount,
      priceHistoryEntries: this.priceHistory.length,
      rollingStats: this.rollingStats,
      marketAnalysis: this.getMarketAnalysis(),
      settings: this.settings,
      uptime: this.initialized ? 'active' : 'inactive'
    };
  }

  saveSettings(newSettings) {
    if (newSettings && typeof newSettings === 'object') {
      for (const key of Object.keys(newSettings)) {
        if (Object.prototype.hasOwnProperty.call(this.settings, key)) {
          this.settings[key] = newSettings[key];
          this.log('Setting updated: ' + key + ' = ' + JSON.stringify(newSettings[key]));
        }
      }
    }
    return { ...this.settings };
  }

  getSettings() {
    return { ...this.settings };
  }

  resetDailyPnL() {
    const previous = this.dailyPnL;
    this.dailyPnL = 0;
    this.log('Daily PnL reset from ' + previous.toFixed(2) + ' SEK');
    return previous;
  }

  resetMonthlyFeedIn() {
    for (const [, tariff] of this.feedInTariffs) {
      tariff.monthlyFedInKWh = 0;
      tariff.monthlyRevenue = 0;
    }
    this.log('Monthly feed-in counters reset');
  }

  log(msg) {
    this.homey.log('[EnergyTrading]', msg);
  }

  error(msg) {
    this.homey.error('[EnergyTrading]', msg);
  }

  destroy() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    if (this.priceUpdateInterval) {
      clearInterval(this.priceUpdateInterval);
      this.priceUpdateInterval = null;
    }
    this.log('Advanced Energy Trading System destroyed');
  }
}

module.exports = AdvancedEnergyTradingSystem;
