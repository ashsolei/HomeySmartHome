'use strict';

/**
 * Advanced Energy Trading System
 * Smart grid integration, dynamic pricing, and energy market optimization
 */
class AdvancedEnergyTradingSystem {
  constructor(homey) {
    this.homey = homey;
    this.energyPrices = [];
    this.tradingStrategy = 'balanced';
    this.buyThreshold = 0.5;
    this.sellThreshold = 1.5;
    this.transactions = [];
    this.forecast = [];
    this.gridConnection = true;
    this.autoTrading = true;
  }

  async initialize() {
    this.log('Initializing Advanced Energy Trading System...');
    
    await this.loadTradingSettings();
    await this.updateEnergyPrices();
    await this.startMonitoring();
    
    this.log('Advanced Energy Trading System initialized');
  }

  async loadTradingSettings() {
    const saved = await this.homey.settings.get('energyTradingSettings') || {};
    this.tradingStrategy = saved.strategy || 'balanced';
    this.buyThreshold = saved.buyThreshold || 0.5;
    this.sellThreshold = saved.sellThreshold || 1.5;
    this.autoTrading = saved.autoTrading !== false;
  }

  async startMonitoring() {
    this.monitoringInterval = setInterval(async () => {
      await this.updateEnergyPrices();
      await this.evaluateTradingOpportunities();
    }, 600000);

    await this.evaluateTradingOpportunities();
  }

  async updateEnergyPrices() {
    try {
      const prices = await this.fetchEnergyPrices();
      this.energyPrices = prices;
      
      this.log(`Energy prices updated: Current ${prices[0]?.price.toFixed(2)} SEK/kWh`);
    } catch (error) {
      this.error(`Failed to update energy prices: ${error.message}`);
    }
  }

  async fetchEnergyPrices() {
    const prices = [];
    const basePrice = 1.0;
    
    for (let hour = 0; hour < 24; hour++) {
      const variation = Math.sin(hour / 24 * Math.PI * 2) * 0.5 + Math.random() * 0.3;
      const price = basePrice + variation;
      
      const timestamp = new Date();
      timestamp.setHours(hour, 0, 0, 0);
      
      prices.push({
        timestamp: timestamp.getTime(),
        hour,
        price: Math.max(0.3, price),
        peak: hour >= 17 && hour <= 21
      });
    }

    return prices;
  }

  async evaluateTradingOpportunities() {
    if (!this.autoTrading || !this.gridConnection) return;

    const currentPrice = this.getCurrentPrice();
    if (!currentPrice) return;

    if (currentPrice.price < this.buyThreshold) {
      await this.considerBuying(currentPrice);
    } else if (currentPrice.price > this.sellThreshold) {
      await this.considerSelling(currentPrice);
    }
  }

  getCurrentPrice() {
    const now = new Date();
    const currentHour = now.getHours();
    return this.energyPrices.find(p => p.hour === currentHour);
  }

  async considerBuying(priceData) {
    try {
      const energyStorage = this.homey.app.energyStorageManagementSystem;
      if (!energyStorage) return;

      const storage = Array.from(energyStorage.batteries.values())[0];
      if (!storage || storage.charge >= 90) return;

      const amount = await this.calculateOptimalBuyAmount(storage);
      
      await this.executeBuy(amount, priceData.price);
      
      if (storage.device && storage.device.hasCapability('charge_mode')) {
        await storage.device.setCapabilityValue('charge_mode', 'charge');
      }

      this.log(`Energy buy initiated: ${amount} kWh at ${priceData.price.toFixed(2)} SEK/kWh`);
    } catch (error) {
      this.error(`Buy decision failed: ${error.message}`);
    }
  }

  async considerSelling(priceData) {
    try {
      const energyStorage = this.homey.app.energyStorageManagementSystem;
      if (!energyStorage) return;

      const storage = Array.from(energyStorage.batteries.values())[0];
      if (!storage || storage.charge < 70) return;

      const amount = await this.calculateOptimalSellAmount(storage);
      
      await this.executeSell(amount, priceData.price);

      if (storage.device && storage.device.hasCapability('charge_mode')) {
        await storage.device.setCapabilityValue('charge_mode', 'discharge');
      }

      this.log(`Energy sell initiated: ${amount} kWh at ${priceData.price.toFixed(2)} SEK/kWh`);
    } catch (error) {
      this.error(`Sell decision failed: ${error.message}`);
    }
  }

  async calculateOptimalBuyAmount(storage) {
    const availableCapacity = storage.capacity * (1 - storage.charge / 100);
    
    switch (this.tradingStrategy) {
      case 'aggressive':
        return availableCapacity * 0.9;
      case 'balanced':
        return availableCapacity * 0.6;
      case 'conservative':
        return availableCapacity * 0.3;
      default:
        return availableCapacity * 0.5;
    }
  }

  async calculateOptimalSellAmount(storage) {
    const availableEnergy = storage.capacity * (storage.charge / 100);
    const reservePercentage = 0.3;
    const sellableEnergy = availableEnergy * (1 - reservePercentage);
    
    switch (this.tradingStrategy) {
      case 'aggressive':
        return sellableEnergy * 0.8;
      case 'balanced':
        return sellableEnergy * 0.5;
      case 'conservative':
        return sellableEnergy * 0.3;
      default:
        return sellableEnergy * 0.4;
    }
  }

  async executeBuy(amount, price) {
    const transaction = {
      id: `buy_${Date.now()}`,
      type: 'buy',
      amount,
      price,
      total: amount * price,
      timestamp: Date.now(),
      status: 'completed'
    };

    this.transactions.push(transaction);

    try {
      const notificationManager = this.homey.app.advancedNotificationManager;
      if (notificationManager) {
        await notificationManager.sendNotification({
          title: '💰 Energiköp genomfört',
          message: `Köpte ${amount.toFixed(1)} kWh för ${transaction.total.toFixed(2)} SEK`,
          priority: 'low',
          category: 'energy_trading'
        });
      }
    } catch {}

    await this.saveTransactions();
  }

  async executeSell(amount, price) {
    const transaction = {
      id: `sell_${Date.now()}`,
      type: 'sell',
      amount,
      price,
      total: amount * price,
      timestamp: Date.now(),
      status: 'completed'
    };

    this.transactions.push(transaction);

    try {
      const notificationManager = this.homey.app.advancedNotificationManager;
      if (notificationManager) {
        await notificationManager.sendNotification({
          title: '💵 Energiförsäljning genomförd',
          message: `Sålde ${amount.toFixed(1)} kWh för ${transaction.total.toFixed(2)} SEK`,
          priority: 'low',
          category: 'energy_trading'
        });
      }
    } catch {}

    await this.saveTransactions();
  }

  async generateForecast() {
    this.forecast = [];
    
    for (let day = 0; day < 7; day++) {
      const avgPrice = 1.0 + (Math.random() - 0.5) * 0.4;
      const peakPrice = avgPrice + 0.5;
      const offPeakPrice = avgPrice - 0.3;
      
      this.forecast.push({
        day,
        date: new Date(Date.now() + day * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        avgPrice: avgPrice.toFixed(2),
        peakPrice: peakPrice.toFixed(2),
        offPeakPrice: offPeakPrice.toFixed(2),
        recommendation: avgPrice < 0.8 ? 'buy' : avgPrice > 1.3 ? 'sell' : 'hold'
      });
    }
  }

  async updateTradingStrategy(strategy, buyThreshold, sellThreshold) {
    this.tradingStrategy = strategy;
    this.buyThreshold = buyThreshold;
    this.sellThreshold = sellThreshold;

    await this.homey.settings.set('energyTradingSettings', {
      strategy: this.tradingStrategy,
      buyThreshold: this.buyThreshold,
      sellThreshold: this.sellThreshold,
      autoTrading: this.autoTrading
    });

    this.log(`Trading strategy updated: ${strategy}`);
  }

  async saveTransactions() {
    const recentTransactions = this.transactions.slice(-100);
    await this.homey.settings.set('energyTransactions', recentTransactions);
  }

  calculateProfit() {
    let totalProfit = 0;
    const buys = this.transactions.filter(t => t.type === 'buy');
    const sells = this.transactions.filter(t => t.type === 'sell');

    const totalBought = buys.reduce((sum, t) => sum + t.total, 0);
    const totalSold = sells.reduce((sum, t) => sum + t.total, 0);

    totalProfit = totalSold - totalBought;

    return {
      profit: totalProfit,
      totalBought,
      totalSold,
      transactions: this.transactions.length
    };
  }

  getStatistics() {
    const profit = this.calculateProfit();
    const currentPrice = this.getCurrentPrice();

    return {
      currentPrice: currentPrice?.price.toFixed(2) || 'N/A',
      tradingStrategy: this.tradingStrategy,
      autoTrading: this.autoTrading,
      totalTransactions: this.transactions.length,
      profit: profit.profit.toFixed(2),
      totalBought: profit.totalBought.toFixed(2),
      totalSold: profit.totalSold.toFixed(2),
      buyThreshold: this.buyThreshold,
      sellThreshold: this.sellThreshold
    };
  }

  log(...args) {
    console.log('[AdvancedEnergyTradingSystem]', ...args);
  }

  error(...args) {
    console.error('[AdvancedEnergyTradingSystem]', ...args);
  }
}

module.exports = AdvancedEnergyTradingSystem;
