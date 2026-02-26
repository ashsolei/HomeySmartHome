'use strict';

/**
 * Energy Storage Optimizer
 * Advanced battery management, grid arbitrage, and energy optimization
 */
class EnergyStorageOptimizer {
  constructor(app) {
    this._intervals = [];
    this.app = app;
    this.batteries = new Map();
    this.strategies = new Map();
    this.priceHistory = [];
    this.forecasts = [];
    this.transactions = [];
  }

  async initialize() {
    await this.loadBatteries();
    await this.loadStrategies();
    await this.loadPriceData();
    
    this.startOptimization();
  }

  // ============================================
  // BATTERY MANAGEMENT
  // ============================================

  async loadBatteries() {
    const batteryConfigs = [
      {
        id: 'battery_home',
        name: 'Hemmalagring Tesla Powerwall',
        type: 'lithium_ion',
        capacity: 13.5, // kWh
        maxChargePower: 5, // kW
        maxDischargePower: 5, // kW
        efficiency: 0.90, // 90% round-trip
        minSoC: 10, // Minimum state of charge (%)
        maxSoC: 100,
        reservePower: 20, // Reserve for backup (%)
        installDate: new Date('2023-06-01').getTime(),
        warranty: {
          years: 10,
          cycles: 3650,
          capacityRetention: 70 // 70% after warranty
        }
      },
      {
        id: 'battery_ev',
        name: 'Elbil (V2H kapabel)',
        type: 'ev_battery',
        capacity: 75, // kWh
        maxChargePower: 11, // kW (3-fas)
        maxDischargePower: 10, // kW V2H
        efficiency: 0.95,
        minSoC: 20, // Never below 20%
        maxSoC: 80, // Daily max to preserve battery
        reservePower: 30, // Always keep 30% for driving
        v2hEnabled: true,
        connectedToHome: false,
        location: 'home' // or 'away'
      }
    ];

    for (const config of batteryConfigs) {
      this.batteries.set(config.id, {
        ...config,
        currentSoC: 50, // Start at 50%
        currentPower: 0, // kW (positive = charging, negative = discharging)
        temperature: 20,
        cycleCount: 0,
        totalEnergyCharged: 0, // kWh lifetime
        totalEnergyDischarged: 0,
        status: 'idle', // idle, charging, discharging, fault
        health: 100, // Battery health %
        lastUpdate: Date.now()
      });
    }
  }

  // ============================================
  // OPTIMIZATION STRATEGIES
  // ============================================

  async loadStrategies() {
    // Self-consumption optimization
    this.strategies.set('self_consumption', {
      id: 'self_consumption',
      name: 'Självförbrukning',
      description: 'Maximera användning av egen solenergi',
      priority: 'high',
      enabled: true,
      rules: [
        {
          condition: 'solar_production > house_consumption',
          action: 'charge_battery',
          power: 'excess_solar'
        },
        {
          condition: 'solar_production < house_consumption && battery_soc > reserve',
          action: 'discharge_battery',
          power: 'shortfall'
        }
      ]
    });

    // Price arbitrage (spot market)
    this.strategies.set('price_arbitrage', {
      id: 'price_arbitrage',
      name: 'Prisoptimering',
      description: 'Köp billig el, sälj dyr el',
      priority: 'medium',
      enabled: true,
      rules: [
        {
          condition: 'price < avg_price * 0.7 && battery_soc < 90',
          action: 'charge_battery',
          power: 'max_charge_power'
        },
        {
          condition: 'price > avg_price * 1.3 && battery_soc > reserve',
          action: 'discharge_battery',
          power: 'max_discharge_power'
        }
      ],
      thresholds: {
        cheapPrice: 0.7, // 30% below average
        expensivePrice: 1.3 // 30% above average
      }
    });

    // Peak shaving
    this.strategies.set('peak_shaving', {
      id: 'peak_shaving',
      name: 'Toppeffektutjämning',
      description: 'Undvik höga effekttoppar',
      priority: 'high',
      enabled: true,
      rules: [
        {
          condition: 'grid_power > peak_limit && battery_soc > reserve',
          action: 'discharge_battery',
          power: 'peak_excess'
        }
      ],
      peakLimit: 10 // kW max from grid
    });

    // Backup reserve
    this.strategies.set('backup_reserve', {
      id: 'backup_reserve',
      name: 'Reservkraft',
      description: 'Säkerställ backup vid elavbrott',
      priority: 'critical',
      enabled: true,
      rules: [
        {
          condition: 'grid_available == false',
          action: 'island_mode',
          power: 'critical_loads_only'
        },
        {
          condition: 'battery_soc < reserve && grid_available',
          action: 'charge_to_reserve',
          power: 'max_charge_power'
        }
      ]
    });

    // Time-of-use optimization
    this.strategies.set('tou_optimization', {
      id: 'tou_optimization',
      name: 'Tidstaxeoptimering',
      description: 'Anpassa efter dygnstariff',
      priority: 'medium',
      enabled: true,
      schedule: {
        offPeak: { start: '22:00', end: '06:00', action: 'charge' },
        peak: { start: '06:00', end: '22:00', action: 'discharge_if_needed' }
      }
    });

    // EV smart charging
    this.strategies.set('ev_smart_charge', {
      id: 'ev_smart_charge',
      name: 'Smart Elbilsladdning',
      description: 'Ladda bil när elen är billigast',
      priority: 'high',
      enabled: true,
      rules: [
        {
          condition: 'ev_connected && ev_soc < target_soc',
          action: 'charge_ev',
          timing: 'cheapest_hours',
          targetSoC: 80
        },
        {
          condition: 'v2h_enabled && home_price_high && ev_soc > 50',
          action: 'v2h_discharge',
          power: 'up_to_10kw'
        }
      ]
    });
  }

  // ============================================
  // PRICE DATA & FORECASTING
  // ============================================

  async loadPriceData() {
    // Simulate Swedish spot prices (öre/kWh)
    // Real implementation would fetch from Nord Pool API
    const basePrice = 80; // öre/kWh average
    
    for (let hour = 0; hour < 48; hour++) {
      const hourOfDay = (new Date().getHours() + hour) % 24;
      
      // Price pattern: expensive 6-9am and 5-8pm, cheap at night
      let price = basePrice;
      
      if (hourOfDay >= 6 && hourOfDay < 9) {
        price = basePrice * 1.5; // Morning peak
      } else if (hourOfDay >= 17 && hourOfDay < 21) {
        price = basePrice * 1.4; // Evening peak
      } else if (hourOfDay >= 22 || hourOfDay < 6) {
        price = basePrice * 0.6; // Night valley
      }
      
      // Add some randomness
      price += (Math.random() - 0.5) * 20;
      
      const timestamp = Date.now() + hour * 60 * 60 * 1000;
      
      if (hour < 24) {
        // Historical (today)
        this.priceHistory.push({
          timestamp,
          price: Math.round(price),
          type: 'actual'
        });
      } else {
        // Forecast (tomorrow)
        this.forecasts.push({
          timestamp,
          price: Math.round(price),
          type: 'forecast'
        });
      }
    }
  }

  getCurrentPrice() {
    const now = Date.now();
    return this.priceHistory
      .filter(p => p.timestamp <= now)
      .sort((a, b) => b.timestamp - a.timestamp)[0]?.price || 80;
  }

  getAveragePrice(hours = 24) {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    const prices = this.priceHistory.filter(p => p.timestamp >= cutoff);
    
    if (prices.length === 0) return 80;
    
    return prices.reduce((sum, p) => sum + p.price, 0) / prices.length;
  }

  getCheapestHours(count = 6) {
    return this.forecasts
      .sort((a, b) => a.price - b.price)
      .slice(0, count)
      .map(p => ({
        hour: new Date(p.timestamp).getHours(),
        price: p.price
      }));
  }

  // ============================================
  // OPTIMIZATION ENGINE
  // ============================================

  startOptimization() {
    // Update battery status every 5 minutes
    this._intervals.push(setInterval(() => {
      this.updateBatteryStatus();
    }, 5 * 60 * 1000));

    // Run optimization every 15 minutes
    this._intervals.push(setInterval(() => {
      this.runOptimization();
    }, 15 * 60 * 1000));

    // Update price data every hour
    this._intervals.push(setInterval(() => {
      this.updatePriceData();
    }, 60 * 60 * 1000));

    // Calculate daily savings at midnight
    this._intervals.push(setInterval(() => {
      if (new Date().getHours() === 0) {
        this.calculateDailySavings();
      }
    }, 60 * 60 * 1000));

    // Initial run
    this.updateBatteryStatus();
    this.runOptimization();
  }

  async updateBatteryStatus() {
    for (const [_batteryId, battery] of this.batteries) {
      // Simulate battery behavior
      if (battery.status === 'charging') {
        const chargeAmount = (battery.currentPower * (5/60)); // 5 minutes in hours
        const actualCharge = chargeAmount * battery.efficiency;
        
        battery.currentSoC = Math.min(battery.maxSoC, 
          battery.currentSoC + (actualCharge / battery.capacity) * 100
        );
        
        battery.totalEnergyCharged += actualCharge;
        
        // Stop if full
        if (battery.currentSoC >= battery.maxSoC - 1) {
          battery.status = 'idle';
          battery.currentPower = 0;
        }
      } else if (battery.status === 'discharging') {
        const dischargeAmount = Math.abs(battery.currentPower * (5/60));
        
        battery.currentSoC = Math.max(battery.minSoC,
          battery.currentSoC - (dischargeAmount / battery.capacity) * 100
        );
        
        battery.totalEnergyDischarged += dischargeAmount;
        
        // Stop if at minimum
        if (battery.currentSoC <= battery.minSoC + 1) {
          battery.status = 'idle';
          battery.currentPower = 0;
        }
      }

      // Update health (0.01% degradation per cycle)
      battery.health = Math.max(70, 100 - (battery.cycleCount * 0.01));
      
      battery.lastUpdate = Date.now();
    }
  }

  async runOptimization() {
    const currentPrice = this.getCurrentPrice();
    const _avgPrice = this.getAveragePrice();
    const hour = new Date().getHours();
    
    // Get current energy situation
    const situation = await this.assessEnergySituation();
    
    console.log(`⚡ Energy Optimization (${hour}:00, ${currentPrice} öre/kWh)`);
    
    // Execute strategies in priority order
    const sortedStrategies = Array.from(this.strategies.values())
      .filter(s => s.enabled)
      .sort((a, b) => {
        const priorities = { critical: 0, high: 1, medium: 2, low: 3 };
        return priorities[a.priority] - priorities[b.priority];
      });

    for (const strategy of sortedStrategies) {
      await this.executeStrategy(strategy, situation);
    }
  }

  async assessEnergySituation() {
    // Simulate current energy situation
    const hour = new Date().getHours();
    
    // Solar production (0 at night, peak at noon)
    let solarProduction = 0;
    if (hour >= 6 && hour <= 20) {
      const sunAngle = Math.sin((hour - 6) * Math.PI / 14);
      solarProduction = sunAngle * 8; // Max 8 kW
    }
    
    // House consumption (varies by time)
    let houseConsumption = 1.5; // Base load
    if (hour >= 6 && hour <= 9) houseConsumption = 3.5; // Morning
    else if (hour >= 17 && hour <= 22) houseConsumption = 4.5; // Evening
    
    const homeBattery = this.batteries.get('battery_home');
    const evBattery = this.batteries.get('battery_ev');
    
    return {
      solarProduction,
      houseConsumption,
      netProduction: solarProduction - houseConsumption,
      gridPower: houseConsumption - solarProduction,
      homeBatterySoC: homeBattery.currentSoC,
      evBatterySoC: evBattery.currentSoC,
      evConnected: Math.random() > 0.3, // 70% chance connected at home
      gridAvailable: true,
      currentPrice: this.getCurrentPrice(),
      averagePrice: this.getAveragePrice()
    };
  }

  async executeStrategy(strategy, situation) {
    const homeBattery = this.batteries.get('battery_home');
    
    switch (strategy.id) {
      case 'self_consumption':
        if (situation.netProduction > 0 && homeBattery.currentSoC < 90) {
          // Excess solar - charge battery
          await this.chargeBattery('battery_home', Math.min(
            situation.netProduction,
            homeBattery.maxChargePower
          ));
          console.log(`  ☀️ Charging from solar: ${situation.netProduction.toFixed(1)} kW`);
        } else if (situation.netProduction < 0 && homeBattery.currentSoC > homeBattery.reservePower) {
          // Need power - discharge battery
          await this.dischargeBattery('battery_home', Math.min(
            Math.abs(situation.netProduction),
            homeBattery.maxDischargePower
          ));
          console.log(`  🔋 Discharging to cover load: ${Math.abs(situation.netProduction).toFixed(1)} kW`);
        }
        break;

      case 'price_arbitrage':
        const priceRatio = situation.currentPrice / situation.averagePrice;
        
        if (priceRatio < 0.7 && homeBattery.currentSoC < 90) {
          // Cheap price - charge
          await this.chargeBattery('battery_home', homeBattery.maxChargePower);
          console.log(`  💰 Cheap price (${situation.currentPrice} öre) - charging`);
        } else if (priceRatio > 1.3 && homeBattery.currentSoC > homeBattery.reservePower) {
          // Expensive price - discharge
          await this.dischargeBattery('battery_home', homeBattery.maxDischargePower);
          console.log(`  💸 Expensive price (${situation.currentPrice} öre) - discharging`);
        }
        break;

      case 'peak_shaving':
        if (situation.gridPower > strategy.peakLimit && homeBattery.currentSoC > homeBattery.reservePower) {
          const peakExcess = situation.gridPower - strategy.peakLimit;
          await this.dischargeBattery('battery_home', Math.min(
            peakExcess,
            homeBattery.maxDischargePower
          ));
          console.log(`  📊 Peak shaving: Reducing grid load by ${peakExcess.toFixed(1)} kW`);
        }
        break;

      case 'ev_smart_charge':
        const evBattery = this.batteries.get('battery_ev');
        
        if (situation.evConnected && evBattery.currentSoC < 80) {
          const cheapHours = this.getCheapestHours();
          const currentHour = new Date().getHours();
          
          if (cheapHours.some(h => h.hour === currentHour)) {
            await this.chargeBattery('battery_ev', evBattery.maxChargePower);
            console.log(`  🚗 Smart EV charging (cheap hour)`);
          }
        }
        break;
    }
  }

  async chargeBattery(batteryId, power) {
    const battery = this.batteries.get(batteryId);
    
    if (!battery) return;

    battery.status = 'charging';
    battery.currentPower = Math.min(power, battery.maxChargePower);

    // Log transaction
    this.transactions.push({
      timestamp: Date.now(),
      batteryId,
      type: 'charge',
      power: battery.currentPower,
      soc: battery.currentSoC,
      price: this.getCurrentPrice()
    });

    return { success: true, power: battery.currentPower };
  }

  async dischargeBattery(batteryId, power) {
    const battery = this.batteries.get(batteryId);
    
    if (!battery) return;
    if (battery.currentSoC <= battery.reservePower) return; // Don't discharge below reserve

    battery.status = 'discharging';
    battery.currentPower = -Math.min(power, battery.maxDischargePower);

    // Log transaction
    this.transactions.push({
      timestamp: Date.now(),
      batteryId,
      type: 'discharge',
      power: Math.abs(battery.currentPower),
      soc: battery.currentSoC,
      price: this.getCurrentPrice()
    });

    return { success: true, power: Math.abs(battery.currentPower) };
  }

  async updatePriceData() {
    // Shift history
    this.priceHistory = this.priceHistory.filter(
      p => p.timestamp > Date.now() - 48 * 60 * 60 * 1000
    );

    // Move forecast to history as time passes
    const now = Date.now();
    const movedForecasts = this.forecasts.filter(f => f.timestamp <= now);
    
    for (const forecast of movedForecasts) {
      forecast.type = 'actual';
      this.priceHistory.push(forecast);
    }

    this.forecasts = this.forecasts.filter(f => f.timestamp > now);

    // Generate new forecasts if needed
    while (this.forecasts.length < 24) {
      await this.loadPriceData();
    }
  }

  // ============================================
  // ANALYTICS & REPORTING
  // ============================================

  async calculateDailySavings() {
    const yesterday = Date.now() - 24 * 60 * 60 * 1000;
    const todayTransactions = this.transactions.filter(t => t.timestamp >= yesterday);

    let totalSavings = 0;

    for (const transaction of todayTransactions) {
      const avgPrice = this.getAveragePrice();
      const price = transaction.price;
      const energy = transaction.power * 0.25; // 15-min intervals converted to hours
      
      if (transaction.type === 'charge') {
        // Saved by buying at lower price
        totalSavings += (avgPrice - price) * energy / 100; // Convert öre to SEK
      } else if (transaction.type === 'discharge') {
        // Saved by selling at higher price
        totalSavings += (price - avgPrice) * energy / 100;
      }
    }

    console.log(`💰 Daily savings: ${totalSavings.toFixed(2)} SEK`);
    
    return totalSavings;
  }

  getBatteryStatus(batteryId) {
    const battery = this.batteries.get(batteryId);
    
    if (!battery) return null;

    const usableCapacity = battery.capacity * (battery.health / 100);
    const currentEnergy = (battery.currentSoC / 100) * usableCapacity;

    return {
      id: battery.id,
      name: battery.name,
      soc: Math.round(battery.currentSoC),
      energy: currentEnergy.toFixed(1),
      capacity: usableCapacity.toFixed(1),
      power: battery.currentPower.toFixed(1),
      status: battery.status,
      health: battery.health.toFixed(1),
      cycles: battery.cycleCount,
      temperature: battery.temperature,
      timeToFull: battery.status === 'charging' 
        ? this.calculateTimeToFull(battery) 
        : null,
      timeToEmpty: battery.status === 'discharging'
        ? this.calculateTimeToEmpty(battery)
        : null
    };
  }

  calculateTimeToFull(battery) {
    if (battery.currentPower <= 0) return null;
    
    const remainingCapacity = battery.capacity * ((battery.maxSoC - battery.currentSoC) / 100);
    const hours = remainingCapacity / (battery.currentPower * battery.efficiency);
    
    return Math.round(hours * 60); // minutes
  }

  calculateTimeToEmpty(battery) {
    if (battery.currentPower >= 0) return null;
    
    const availableCapacity = battery.capacity * ((battery.currentSoC - battery.minSoC) / 100);
    const hours = availableCapacity / Math.abs(battery.currentPower);
    
    return Math.round(hours * 60); // minutes
  }

  getAllBatteries() {
    return Array.from(this.batteries.values()).map(b => ({
      id: b.id,
      name: b.name,
      soc: Math.round(b.currentSoC),
      status: b.status,
      power: b.currentPower.toFixed(1),
      health: b.health.toFixed(1)
    }));
  }

  getEnergyFlow() {
    const situation = this.assessEnergySituation();
    const homeBattery = this.batteries.get('battery_home');
    
    return {
      solar: situation.solarProduction.toFixed(1),
      consumption: situation.houseConsumption.toFixed(1),
      battery: homeBattery.currentPower.toFixed(1),
      grid: situation.gridPower.toFixed(1),
      selfSufficiency: situation.solarProduction > 0 
        ? Math.min(100, (situation.solarProduction / situation.houseConsumption) * 100).toFixed(0)
        : 0
    };
  }

  getPriceData(hours = 48) {
    const combined = [...this.priceHistory, ...this.forecasts]
      .filter(p => p.timestamp >= Date.now() - hours * 60 * 60 * 1000)
      .sort((a, b) => a.timestamp - b.timestamp);

    return combined.map(p => ({
      timestamp: p.timestamp,
      hour: new Date(p.timestamp).getHours(),
      price: p.price,
      type: p.type
    }));
  }

  getOptimizationReport(days = 7) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const transactions = this.transactions.filter(t => t.timestamp >= cutoff);

    const totalCharged = transactions
      .filter(t => t.type === 'charge')
      .reduce((sum, t) => sum + t.power * 0.25, 0); // kWh

    const totalDischarged = transactions
      .filter(t => t.type === 'discharge')
      .reduce((sum, t) => sum + t.power * 0.25, 0);

    const homeBattery = this.batteries.get('battery_home');
    const cyclesUsed = (totalDischarged / homeBattery.capacity);

    return {
      period: `${days} days`,
      totalCharged: totalCharged.toFixed(1),
      totalDischarged: totalDischarged.toFixed(1),
      cyclesUsed: cyclesUsed.toFixed(2),
      efficiency: totalCharged > 0 
        ? ((totalDischarged / totalCharged) * 100).toFixed(1) 
        : 0,
      transactionCount: transactions.length,
      estimatedSavings: (days * 15).toFixed(0) // Rough estimate 15 SEK/day
    };
  }

  getStrategies() {
    return Array.from(this.strategies.values()).map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      priority: s.priority,
      enabled: s.enabled
    }));
  }

  async toggleStrategy(strategyId, enabled) {
    const strategy = this.strategies.get(strategyId);
    
    if (!strategy) {
      return { success: false, error: 'Strategy not found' };
    }

    strategy.enabled = enabled;
    
    console.log(`${enabled ? '✅' : '❌'} Strategy ${strategy.name}: ${enabled ? 'enabled' : 'disabled'}`);

    return { success: true, strategy };
  }

  getRecommendations() {
    const recommendations = [];
    const homeBattery = this.batteries.get('battery_home');
    const currentPrice = this.getCurrentPrice();
    const avgPrice = this.getAveragePrice();
    const cheapHours = this.getCheapestHours();

    // Price-based recommendations
    if (currentPrice < avgPrice * 0.7) {
      recommendations.push({
        type: 'price',
        priority: 'high',
        message: 'Elpriset är mycket lågt nu - ladda batteriet!',
        action: 'charge',
        savings: `Spara ~${((avgPrice - currentPrice) * 0.1).toFixed(0)} SEK/kWh`
      });
    } else if (currentPrice > avgPrice * 1.3) {
      recommendations.push({
        type: 'price',
        priority: 'high',
        message: 'Elpriset är högt - använd batteriström!',
        action: 'discharge',
        savings: `Spara ~${((currentPrice - avgPrice) * 0.1).toFixed(0)} SEK/kWh`
      });
    }

    // Battery health recommendations
    if (homeBattery.health < 85) {
      recommendations.push({
        type: 'maintenance',
        priority: 'medium',
        message: 'Batterihälsan har minskat - överväg service',
        action: 'service'
      });
    }

    // Upcoming cheap hours
    const nextCheapHour = cheapHours[0];
    if (nextCheapHour && homeBattery.currentSoC < 80) {
      recommendations.push({
        type: 'schedule',
        priority: 'low',
        message: `Billigaste timmen: ${nextCheapHour.hour}:00 (${nextCheapHour.price} öre/kWh)`,
        action: 'schedule_charge'
      });
    }

    return recommendations;
  }

  destroy() {
    if (this._intervals) {
      this._intervals.forEach(id => clearInterval(id));
      this._intervals = [];
    }
  }
}

module.exports = EnergyStorageOptimizer;
