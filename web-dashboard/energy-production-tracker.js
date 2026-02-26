'use strict';

/**
 * Energy Production Tracker
 * Tracks solar panel/renewable energy production and optimizes usage
 */
class EnergyProductionTracker {
  constructor(app) {
    this.app = app;
    this.productionSources = new Map();
    this.productionHistory = [];
    this.consumptionHistory = [];
    this.balanceData = [];
    this.forecasts = [];
  }

  async initialize() {
    // Load production sources
    await this.loadProductionSources();
    
    // Start monitoring
    this.startMonitoring();
    
    // Start forecasting
    this.startForecasting();
  }

  // ============================================
  // PRODUCTION SOURCES
  // ============================================

  async loadProductionSources() {
    // Solar panels
    this.productionSources.set('solar', {
      id: 'solar',
      name: 'Solpaneler',
      type: 'solar',
      capacity: 8.5, // kW
      installedDate: '2023-05-15',
      location: 'Tak syd',
      efficiency: 0.85,
      
      // Panel details
      panelCount: 20,
      panelWattage: 425, // W per panel
      inverterCapacity: 10, // kW
      
      // Current status
      status: 'active',
      currentProduction: 0,
      todayProduction: 0,
      totalProduction: 12500, // kWh lifetime
      
      // Statistics
      peakProduction: 8.2,
      averageDaily: 25,
      bestDay: 45,
      
      // Maintenance
      lastMaintenance: '2025-09-15',
      nextMaintenance: '2026-09-15'
    });

    // Battery storage (optional)
    this.productionSources.set('battery', {
      id: 'battery',
      name: 'Batteri',
      type: 'storage',
      capacity: 13.5, // kWh
      currentCharge: 8.5, // kWh
      chargePercent: 63,
      
      status: 'active',
      chargingRate: 0, // kW (+ charging, - discharging)
      
      // Limits
      maxChargingRate: 5, // kW
      maxDischargingRate: 5, // kW
      minCharge: 10, // % reserve
      maxCharge: 95, // % to preserve battery life
      
      // Statistics
      totalCycles: 450,
      efficiency: 0.92,
      estimatedLifetime: 10, // years
      degradation: 0.98 // 98% of original capacity
    });

    // Grid connection
    this.productionSources.set('grid', {
      id: 'grid',
      name: 'Elnät',
      type: 'grid',
      status: 'connected',
      
      // Current values
      importing: 0, // kW (from grid)
      exporting: 0, // kW (to grid)
      
      // Pricing
      importPrice: 1.85, // SEK/kWh
      exportPrice: 0.65, // SEK/kWh
      gridFee: 0.45, // SEK/kWh
      
      // Statistics
      totalImported: 8500, // kWh
      totalExported: 3200, // kWh
      netImport: 5300 // kWh (imported - exported)
    });
  }

  // ============================================
  // MONITORING
  // ============================================

  startMonitoring() {
    // Update production/consumption every 5 minutes
    setInterval(() => {
      this.updateProductionData();
      this.updateConsumptionData();
      this.calculateBalance();
    }, 5 * 60 * 1000);

    // Update forecasts every hour
    setInterval(() => {
      this.updateForecasts();
    }, 60 * 60 * 1000);

    // Initial update
    this.updateProductionData();
    this.updateConsumptionData();
    this.calculateBalance();
    this.updateForecasts();
  }

  updateProductionData() {
    const hour = new Date().getHours();
    const month = new Date().getMonth();
    
    // Calculate solar production based on time and season
    const solarProduction = this.calculateSolarProduction(hour, month);
    
    const solar = this.productionSources.get('solar');
    solar.currentProduction = solarProduction;
    
    // Update daily total
    solar.todayProduction += (solarProduction * 5) / 60; // 5 minutes in hours

    // Log production
    this.logProduction({
      timestamp: Date.now(),
      source: 'solar',
      value: solarProduction,
      hour
    });
  }

  calculateSolarProduction(hour, month) {
    const solar = this.productionSources.get('solar');
    
    // No production at night
    if (hour < 5 || hour > 20) return 0;
    
    // Peak production around noon
    const timeOfDay = Math.sin(((hour - 5) / 15) * Math.PI);
    
    // Season factor (higher in summer, lower in winter)
    const seasonFactor = 0.5 + 0.5 * Math.cos(((month - 6) / 12) * 2 * Math.PI);
    
    // Random weather variation
    const weatherFactor = 0.7 + Math.random() * 0.3;
    
    // Calculate production
    const production = solar.capacity * timeOfDay * seasonFactor * weatherFactor * solar.efficiency;
    
    return Math.max(0, production);
  }

  updateConsumptionData() {
    const hour = new Date().getHours();
    
    // Simulate consumption (in production: get from actual meters)
    const consumption = this.simulateConsumption(hour);
    
    // Log consumption
    this.logConsumption({
      timestamp: Date.now(),
      value: consumption,
      hour
    });
  }

  simulateConsumption(hour) {
    // Base load
    let consumption = 0.5;
    
    // Morning peak
    if (hour >= 6 && hour <= 8) {
      consumption += 2.0;
    }
    
    // Daytime
    if (hour >= 9 && hour <= 16) {
      consumption += 1.0;
    }
    
    // Evening peak
    if (hour >= 17 && hour <= 22) {
      consumption += 3.0;
    }
    
    // Random variation
    consumption += (Math.random() - 0.5) * 0.5;
    
    return Math.max(0.3, consumption);
  }

  calculateBalance() {
    const solar = this.productionSources.get('solar');
    const battery = this.productionSources.get('battery');
    const grid = this.productionSources.get('grid');
    
    const production = solar.currentProduction;
    const consumption = this.getLatestConsumption();
    
    const balance = production - consumption;
    
    // Update battery and grid based on balance
    if (balance > 0) {
      // Surplus - charge battery or export to grid
      if (battery && battery.chargePercent < battery.maxCharge) {
        // Charge battery
        const chargeAmount = Math.min(balance, battery.maxChargingRate);
        battery.chargingRate = chargeAmount;
        battery.currentCharge += (chargeAmount * 5) / 60; // 5 minutes
        battery.chargePercent = (battery.currentCharge / battery.capacity) * 100;
        
        const remaining = balance - chargeAmount;
        if (remaining > 0) {
          // Export excess to grid
          grid.exporting = remaining;
          grid.importing = 0;
          grid.totalExported += (remaining * 5) / 60;
        }
      } else {
        // Battery full, export all to grid
        grid.exporting = balance;
        grid.importing = 0;
        grid.totalExported += (balance * 5) / 60;
      }
    } else {
      // Deficit - use battery or import from grid
      const deficit = Math.abs(balance);
      
      if (battery && battery.chargePercent > battery.minCharge) {
        // Discharge battery
        const dischargeAmount = Math.min(deficit, battery.maxDischargingRate);
        const availableCharge = battery.currentCharge - (battery.capacity * battery.minCharge / 100);
        const actualDischarge = Math.min(dischargeAmount, availableCharge);
        
        battery.chargingRate = -actualDischarge;
        battery.currentCharge -= (actualDischarge * 5) / 60;
        battery.chargePercent = (battery.currentCharge / battery.capacity) * 100;
        
        const remaining = deficit - actualDischarge;
        if (remaining > 0) {
          // Import from grid
          grid.importing = remaining;
          grid.exporting = 0;
          grid.totalImported += (remaining * 5) / 60;
        }
      } else {
        // No battery or empty, import all from grid
        grid.importing = deficit;
        grid.exporting = 0;
        grid.totalImported += (deficit * 5) / 60;
      }
    }

    // Log balance
    this.balanceData.push({
      timestamp: Date.now(),
      production,
      consumption,
      balance,
      batteryCharge: battery ? battery.chargePercent : 0,
      gridImport: grid.importing,
      gridExport: grid.exporting
    });

    // Trim history
    if (this.balanceData.length > 288) { // 24 hours at 5-min intervals
      this.balanceData = this.balanceData.slice(-288);
    }
  }

  getLatestConsumption() {
    if (this.consumptionHistory.length === 0) return 0;
    return this.consumptionHistory[this.consumptionHistory.length - 1].value;
  }

  // ============================================
  // FORECASTING
  // ============================================

  startForecasting() {
    // Generate forecasts on initialization
    this.updateForecasts();
  }

  updateForecasts() {
    this.forecasts = [];
    
    const now = new Date();
    
    // Forecast next 24 hours
    for (let i = 1; i <= 24; i++) {
      const forecastTime = new Date(now.getTime() + i * 60 * 60 * 1000);
      const hour = forecastTime.getHours();
      const month = forecastTime.getMonth();
      
      const production = this.calculateSolarProduction(hour, month);
      const consumption = this.simulateConsumption(hour);
      const balance = production - consumption;
      
      this.forecasts.push({
        timestamp: forecastTime.getTime(),
        hour,
        production,
        consumption,
        balance,
        recommendation: this.getRecommendation(balance, hour)
      });
    }
  }

  getRecommendation(balance, _hour) {
    if (balance > 2) {
      return {
        type: 'surplus',
        message: 'Bra tid för energikrävande aktiviteter',
        suggestions: ['Tvätta', 'Diska', 'Dammsuga', 'Ladda elfordon']
      };
    } else if (balance < -1) {
      return {
        type: 'deficit',
        message: 'Högt nätuttag - överväg att minska förbrukning',
        suggestions: ['Vänta med energikrävande apparater', 'Sänk värmeinställningar']
      };
    }
    
    return {
      type: 'balanced',
      message: 'Balanserad energisituation',
      suggestions: []
    };
  }

  // ============================================
  // OPTIMIZATION
  // ============================================

  async optimizeUsage() {
    const recommendations = [];
    
    // Check forecasts for optimal times
    const surplusHours = this.forecasts.filter(f => f.balance > 2);
    
    if (surplusHours.length > 0) {
      const nextSurplus = surplusHours[0];
      const hoursUntil = Math.round((nextSurplus.timestamp - Date.now()) / (60 * 60 * 1000));
      
      recommendations.push({
        type: 'timing',
        priority: 'medium',
        title: 'Optimal tid för energiförbrukning',
        description: `Om ${hoursUntil} timmar kommer du ha överskott på ${nextSurplus.balance.toFixed(1)} kW`,
        suggestions: nextSurplus.recommendation.suggestions
      });
    }

    // Battery optimization
    const battery = this.productionSources.get('battery');
    
    if (battery) {
      if (battery.chargePercent < 30) {
        recommendations.push({
          type: 'battery',
          priority: 'high',
          title: 'Låg batteriladdning',
          description: `Batteriet är laddat till ${Math.round(battery.chargePercent)}%`,
          suggestions: ['Minska förbrukning för att ladda batteriet', 'Vänta med energikrävande aktiviteter']
        });
      }
      
      if (battery.chargePercent > 90) {
        recommendations.push({
          type: 'battery',
          priority: 'low',
          title: 'Batteriet fulladdat',
          description: 'Bra tillfälle att använda extra energi',
          suggestions: ['Kör energikrävande apparater utan extra kostnad']
        });
      }
    }

    // Grid pricing
    const _grid = this.productionSources.get('grid');
    const currentHour = new Date().getHours();
    
    // Peak hours (typically more expensive)
    if (currentHour >= 7 && currentHour <= 9 || currentHour >= 17 && currentHour <= 20) {
      recommendations.push({
        type: 'pricing',
        priority: 'medium',
        title: 'Höga elpriser (topptid)',
        description: 'Priset är högre under denna tid',
        suggestions: ['Använd egen elproduktion/batteri när möjligt', 'Vänta med icke-nödvändiga apparater']
      });
    }

    return recommendations;
  }

  async scheduleDeviceUsage(deviceId, estimatedDuration, energyRequired) {
    // Find optimal time window in next 24 hours
    let bestTime = null;
    let bestScore = -Infinity;
    
    for (const forecast of this.forecasts) {
      // Calculate score based on surplus and pricing
      const surplusScore = forecast.balance * 10;
      const pricingScore = this.isPeakHour(forecast.hour) ? -5 : 0;
      const score = surplusScore + pricingScore;
      
      if (score > bestScore) {
        bestScore = score;
        bestTime = forecast;
      }
    }

    return {
      success: true,
      recommendedTime: bestTime.timestamp,
      reason: bestTime.recommendation.message,
      estimatedSavings: this.calculateSavings(energyRequired, bestTime)
    };
  }

  isPeakHour(hour) {
    return (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20);
  }

  calculateSavings(energyRequired, forecast) {
    const grid = this.productionSources.get('grid');
    
    // Cost if imported from grid
    const gridCost = energyRequired * (grid.importPrice + grid.gridFee);
    
    // Cost if using own production (effectively free if surplus)
    const ownProductionCost = forecast.balance > 0 ? 0 : gridCost;
    
    return gridCost - ownProductionCost;
  }

  // ============================================
  // ANALYTICS & REPORTING
  // ============================================

  getCurrentStatus() {
    const solar = this.productionSources.get('solar');
    const battery = this.productionSources.get('battery');
    const grid = this.productionSources.get('grid');
    
    const consumption = this.getLatestConsumption();
    const production = solar.currentProduction;
    const balance = production - consumption;

    return {
      production: {
        current: production.toFixed(2),
        today: solar.todayProduction.toFixed(2),
        capacity: solar.capacity
      },
      consumption: {
        current: consumption.toFixed(2)
      },
      balance: {
        current: balance.toFixed(2),
        status: balance > 0 ? 'surplus' : balance < 0 ? 'deficit' : 'balanced'
      },
      battery: battery ? {
        charge: battery.chargePercent.toFixed(0),
        capacity: battery.capacity,
        rate: battery.chargingRate.toFixed(2),
        status: battery.chargingRate > 0 ? 'charging' : battery.chargingRate < 0 ? 'discharging' : 'idle'
      } : null,
      grid: {
        importing: grid.importing.toFixed(2),
        exporting: grid.exporting.toFixed(2),
        status: grid.importing > 0 ? 'importing' : grid.exporting > 0 ? 'exporting' : 'idle'
      }
    };
  }

  getDailyStats() {
    const solar = this.productionSources.get('solar');
    const grid = this.productionSources.get('grid');
    
    // Calculate today's consumption from history
    const today = new Date().setHours(0, 0, 0, 0);
    const todayConsumption = this.consumptionHistory
      .filter(c => c.timestamp >= today)
      .reduce((sum, c) => sum + (c.value * 5) / 60, 0);

    const selfConsumption = solar.todayProduction - grid.totalExported;
    const selfSufficiency = todayConsumption > 0 
      ? (selfConsumption / todayConsumption) * 100 
      : 0;

    return {
      production: solar.todayProduction.toFixed(2),
      consumption: todayConsumption.toFixed(2),
      selfConsumption: selfConsumption.toFixed(2),
      selfSufficiency: selfSufficiency.toFixed(0),
      gridImport: grid.totalImported.toFixed(2),
      gridExport: grid.totalExported.toFixed(2),
      netGrid: (grid.totalImported - grid.totalExported).toFixed(2)
    };
  }

  getFinancialReport() {
    const solar = this.productionSources.get('solar');
    const grid = this.productionSources.get('grid');
    
    // Calculate costs and savings
    const importCost = grid.totalImported * (grid.importPrice + grid.gridFee);
    const exportRevenue = grid.totalExported * grid.exportPrice;
    const netCost = importCost - exportRevenue;
    
    // Estimate cost without solar
    const totalConsumption = grid.totalImported + solar.todayProduction;
    const costWithoutSolar = totalConsumption * (grid.importPrice + grid.gridFee);
    const savings = costWithoutSolar - netCost;

    return {
      costs: {
        import: importCost.toFixed(2),
        export: exportRevenue.toFixed(2),
        net: netCost.toFixed(2)
      },
      savings: {
        today: savings.toFixed(2),
        estimated: {
          monthly: (savings * 30).toFixed(2),
          yearly: (savings * 365).toFixed(2)
        }
      },
      roi: {
        installationCost: 150000, // Example
        yearlySavings: savings * 365,
        paybackYears: (150000 / (savings * 365)).toFixed(1)
      }
    };
  }

  getForecasts(hours = 24) {
    return this.forecasts.slice(0, hours).map(f => ({
      time: new Date(f.timestamp).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
      timestamp: f.timestamp,
      production: f.production.toFixed(2),
      consumption: f.consumption.toFixed(2),
      balance: f.balance.toFixed(2),
      recommendation: f.recommendation.message
    }));
  }

  getHistoricalData(hours = 24) {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    
    return this.balanceData
      .filter(d => d.timestamp >= cutoff)
      .map(d => ({
        timestamp: d.timestamp,
        production: d.production.toFixed(2),
        consumption: d.consumption.toFixed(2),
        balance: d.balance.toFixed(2),
        batteryCharge: d.batteryCharge.toFixed(0),
        gridImport: d.gridImport.toFixed(2),
        gridExport: d.gridExport.toFixed(2)
      }));
  }

  // ============================================
  // LOGGING
  // ============================================

  logProduction(data) {
    this.productionHistory.push(data);
    
    // Keep last 24 hours (288 records at 5-min intervals)
    if (this.productionHistory.length > 288) {
      this.productionHistory = this.productionHistory.slice(-288);
    }
  }

  logConsumption(data) {
    this.consumptionHistory.push(data);
    
    // Keep last 24 hours
    if (this.consumptionHistory.length > 288) {
      this.consumptionHistory = this.consumptionHistory.slice(-288);
    }
  }
}

module.exports = EnergyProductionTracker;
