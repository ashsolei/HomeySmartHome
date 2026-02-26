'use strict';

/**
 * Energy Storage Management System
 * Advanced system for managing solar panels, batteries, and grid interaction
 */
class EnergyStorageManagementSystem {
  constructor(homey) {
    this.homey = homey;
    this.storageDevices = new Map();
    this.solarPanels = new Map();
    this.gridConnection = null;
    this.chargingSchedule = [];
    this.energyStrategy = 'balanced';
    this.storageHistory = [];
    this.forecastData = {};
  }

  async initialize() {
    this.log('Initializing Energy Storage Management System...');
    
    // Load storage devices
    await this.discoverStorageDevices();

    // Load charging schedule
    const savedSchedule = await this.homey.settings.get('chargingSchedule') || [];
    this.chargingSchedule = savedSchedule;

    // Load energy strategy
    const savedStrategy = await this.homey.settings.get('energyStrategy') || 'balanced';
    this.energyStrategy = savedStrategy;

    // Setup default strategy
    await this.setupDefaultStrategy();

    // Start management
    await this.startManagement();

    this.log('Energy Storage Management System initialized');
  }

  /**
   * Discover storage devices (batteries, solar panels)
   */
  async discoverStorageDevices() {
    const devices = this.homey.drivers.getDevices();
    
    for (const device of devices) {
      const name = device.name.toLowerCase();
      
      // Detect battery/storage devices
      if (name.includes('battery') || name.includes('storage') || 
          device.hasCapability('measure_battery')) {
        this.storageDevices.set(device.id, {
          id: device.id,
          name: device.name,
          device,
          type: 'battery',
          capacity: await this.detectCapacity(device),
          currentCharge: await this.getCurrentCharge(device),
          charging: false
        });
      }

      // Detect solar panels
      if (name.includes('solar') || name.includes('panel') || 
          device.hasCapability('measure_power.solar')) {
        this.solarPanels.set(device.id, {
          id: device.id,
          name: device.name,
          device,
          type: 'solar',
          currentProduction: await this.getCurrentProduction(device)
        });
      }

      // Detect grid connection
      if (name.includes('grid') || name.includes('meter')) {
        this.gridConnection = {
          id: device.id,
          name: device.name,
          device,
          type: 'grid'
        };
      }
    }

    this.log(`Discovered ${this.storageDevices.size} storage devices, ${this.solarPanels.size} solar panels`);
  }

  /**
   * Detect battery capacity
   */
  async detectCapacity(device) {
    // Try to get from device settings or estimate
    try {
      const settings = await device.getSettings();
      if (settings.capacity) return settings.capacity;
    } catch {}

    // Default estimate: 10 kWh
    return 10000;
  }

  /**
   * Get current battery charge
   */
  async getCurrentCharge(device) {
    try {
      if (device.hasCapability('measure_battery')) {
        const percentage = await device.getCapabilityValue('measure_battery');
        const capacity = await this.detectCapacity(device);
        return (percentage / 100) * capacity;
      }
    } catch {}

    return 0;
  }

  /**
   * Get current solar production
   */
  async getCurrentProduction(device) {
    try {
      if (device.hasCapability('measure_power')) {
        return await device.getCapabilityValue('measure_power');
      }
      if (device.hasCapability('measure_power.solar')) {
        return await device.getCapabilityValue('measure_power.solar');
      }
    } catch {}

    return 0;
  }

  /**
   * Setup default energy strategy
   */
  async setupDefaultStrategy() {
    // Define strategies
    const strategies = {
      'self-consumption': {
        name: 'Self-Consumption',
        description: 'Maximize use of own solar energy',
        priority: ['solar', 'battery', 'grid'],
        chargingPreference: 'solar_only',
        exportToGrid: false
      },
      'cost-optimization': {
        name: 'Cost Optimization',
        description: 'Minimize electricity costs',
        priority: ['solar', 'battery', 'grid'],
        chargingPreference: 'off_peak',
        exportToGrid: true,
        buyLowSellHigh: true
      },
      'backup-priority': {
        name: 'Backup Priority',
        description: 'Keep battery charged for emergencies',
        priority: ['grid', 'solar', 'battery'],
        chargingPreference: 'always',
        minBatteryLevel: 0.8,
        exportToGrid: false
      },
      'balanced': {
        name: 'Balanced',
        description: 'Balance between cost and self-consumption',
        priority: ['solar', 'battery', 'grid'],
        chargingPreference: 'smart',
        exportToGrid: true,
        minBatteryLevel: 0.3
      },
      'eco-mode': {
        name: 'Eco Mode',
        description: 'Maximum renewable energy usage',
        priority: ['solar', 'battery', 'grid'],
        chargingPreference: 'solar_only',
        exportToGrid: true,
        avoidGrid: true
      }
    };

    this.strategies = strategies;
  }

  /**
   * Start energy management
   */
  async startManagement() {
    // Continuous monitoring (every 5 minutes)
    this.monitoringInterval = setInterval(async () => {
      await this.monitorEnergyFlow();
    }, 300000);

    // Charging optimization (every 15 minutes)
    this.optimizationInterval = setInterval(async () => {
      await this.optimizeCharging();
    }, 900000);

    // Daily strategy evaluation
    this.strategyInterval = setInterval(async () => {
      await this.evaluateStrategy();
    }, 86400000);

    // Weather forecast update (every 6 hours)
    this.forecastInterval = setInterval(async () => {
      await this.updateEnergyForecast();
    }, 21600000);

    // Initial monitoring
    await this.monitorEnergyFlow();
    await this.updateEnergyForecast();
  }

  /**
   * Monitor energy flow
   */
  async monitorEnergyFlow() {
    const flow = {
      timestamp: Date.now(),
      solar: {
        production: 0,
        devices: []
      },
      battery: {
        charge: 0,
        capacity: 0,
        percentage: 0,
        charging: false,
        devices: []
      },
      grid: {
        importing: 0,
        exporting: 0
      },
      consumption: 0
    };

    // Update solar production
    for (const [id, panel] of this.solarPanels) {
      const production = await this.getCurrentProduction(panel.device);
      panel.currentProduction = production;
      flow.solar.production += production;
      flow.solar.devices.push({
        id,
        name: panel.name,
        production
      });
    }

    // Update battery status
    for (const [id, storage] of this.storageDevices) {
      const charge = await this.getCurrentCharge(storage.device);
      storage.currentCharge = charge;
      flow.battery.charge += charge;
      flow.battery.capacity += storage.capacity;
      flow.battery.devices.push({
        id,
        name: storage.name,
        charge,
        capacity: storage.capacity,
        percentage: (charge / storage.capacity) * 100
      });
    }

    flow.battery.percentage = flow.battery.capacity > 0 
      ? (flow.battery.charge / flow.battery.capacity) * 100 
      : 0;

    // Estimate consumption
    flow.consumption = await this.estimateCurrentConsumption();

    // Calculate grid interaction
    const netProduction = flow.solar.production - flow.consumption;
    
    if (netProduction > 0) {
      // Surplus - either charge battery or export to grid
      if (flow.battery.percentage < 100) {
        flow.battery.charging = true;
      } else {
        flow.grid.exporting = netProduction;
      }
    } else {
      // Deficit - use battery or import from grid
      flow.battery.charging = false;
      
      if (flow.battery.charge > 0) {
        // Use battery first
        const batteryUsage = Math.min(Math.abs(netProduction), flow.battery.charge);
        flow.grid.importing = Math.max(0, Math.abs(netProduction) - batteryUsage);
      } else {
        flow.grid.importing = Math.abs(netProduction);
      }
    }

    // Store history
    this.storageHistory.push(flow);
    
    // Keep only last 1000 records
    if (this.storageHistory.length > 1000) {
      this.storageHistory.shift();
    }

    // Apply strategy
    await this.applyEnergyStrategy(flow);

    return flow;
  }

  /**
   * Estimate current consumption
   */
  async estimateCurrentConsumption() {
    let totalConsumption = 0;

    const devices = this.homey.drivers.getDevices();
    
    for (const device of devices) {
      if (device.hasCapability('measure_power')) {
        try {
          const power = await device.getCapabilityValue('measure_power');
          if (power > 0) {
            totalConsumption += power;
          }
        } catch {}
      }
    }

    // Add baseline consumption (lights, appliances without power measurement)
    totalConsumption += 200; // 200W baseline

    return totalConsumption;
  }

  /**
   * Apply energy strategy
   */
  async applyEnergyStrategy(flow) {
    const strategy = this.strategies[this.energyStrategy];
    if (!strategy) return;

    // Check minimum battery level
    if (strategy.minBatteryLevel) {
      if (flow.battery.percentage < strategy.minBatteryLevel * 100) {
        // Force charging
        await this.forceCharging(true);
      }
    }

    // Handle charging preference
    switch (strategy.chargingPreference) {
      case 'solar_only':
        // Only charge from solar
        if (flow.solar.production > flow.consumption) {
          await this.enableBatteryCharging();
        } else {
          await this.disableBatteryCharging();
        }
        break;

      case 'off_peak':
        // Charge during off-peak hours
        const hour = new Date().getHours();
        if (hour >= 23 || hour < 7) {
          await this.enableBatteryCharging();
        }
        break;

      case 'always':
        await this.forceCharging(true);
        break;

      case 'smart':
        await this.smartCharging(flow);
        break;
    }

    // Handle grid export
    if (strategy.exportToGrid && flow.grid.exporting > 0) {
      this.log(`Exporting ${flow.grid.exporting}W to grid`);
    }
  }

  /**
   * Smart charging algorithm
   */
  async smartCharging(flow) {
    // Consider multiple factors
    const factors = {
      batteryLevel: flow.battery.percentage,
      solarProduction: flow.solar.production,
      consumption: flow.consumption,
      timeOfDay: new Date().getHours(),
      forecast: this.forecastData
    };

    // Charge if:
    // 1. Battery is low (<30%)
    // 2. Solar surplus available
    // 3. Off-peak hours and battery not full
    // 4. Weather forecast shows low solar production tomorrow

    const shouldCharge = 
      factors.batteryLevel < 30 ||
      (factors.solarProduction > factors.consumption * 1.2) ||
      ((factors.timeOfDay >= 23 || factors.timeOfDay < 7) && factors.batteryLevel < 80) ||
      (this.forecastData.tomorrowSolar === 'low' && factors.batteryLevel < 60);

    if (shouldCharge) {
      await this.enableBatteryCharging();
    } else {
      await this.disableBatteryCharging();
    }
  }

  /**
   * Enable battery charging
   */
  async enableBatteryCharging() {
    for (const [id, storage] of this.storageDevices) {
      if (!storage.charging) {
        try {
          // Enable charging (device-specific implementation)
          storage.charging = true;
          this.log(`Enabled charging for ${storage.name}`);
        } catch (error) {
          this.error(`Failed to enable charging for ${storage.name}:`, error);
        }
      }
    }
  }

  /**
   * Disable battery charging
   */
  async disableBatteryCharging() {
    for (const [id, storage] of this.storageDevices) {
      if (storage.charging) {
        try {
          // Disable charging (device-specific implementation)
          storage.charging = false;
          this.log(`Disabled charging for ${storage.name}`);
        } catch (error) {
          this.error(`Failed to disable charging for ${storage.name}:`, error);
        }
      }
    }
  }

  /**
   * Force charging on/off
   */
  async forceCharging(enable) {
    if (enable) {
      await this.enableBatteryCharging();
    } else {
      await this.disableBatteryCharging();
    }
  }

  /**
   * Optimize charging schedule
   */
  async optimizeCharging() {
    this.log('Optimizing charging schedule...');

    // Clear old schedule
    this.chargingSchedule = [];

    // Get energy forecast
    const forecast = this.forecastData;

    // Get electricity price forecast (if available)
    const prices = await this.getElectricityPrices();

    // Create 24-hour charging schedule
    for (let hour = 0; hour < 24; hour++) {
      const schedule = {
        hour,
        action: 'auto',
        reason: '',
        price: prices[hour] || null
      };

      // Charge during off-peak if battery is low
      if (hour >= 23 || hour < 7) {
        schedule.action = 'charge';
        schedule.reason = 'Off-peak charging';
      }

      // Don't charge if high solar production expected
      if (forecast.hourly && forecast.hourly[hour]?.solar > 500) {
        schedule.action = 'solar_only';
        schedule.reason = 'High solar production expected';
      }

      // Charge if very cheap electricity
      if (prices[hour] && prices[hour] < 0.5) {
        schedule.action = 'charge';
        schedule.reason = 'Very cheap electricity';
      }

      this.chargingSchedule.push(schedule);
    }

    await this.saveChargingSchedule();
  }

  /**
   * Get electricity prices (mock - would integrate with real API)
   */
  async getElectricityPrices() {
    const prices = [];
    
    for (let hour = 0; hour < 24; hour++) {
      // Higher prices during peak hours (8-20)
      let price = 1.0;
      
      if (hour >= 8 && hour < 20) {
        price = 1.5; // Peak price
      } else {
        price = 0.7; // Off-peak price
      }

      prices.push(price);
    }

    return prices;
  }

  /**
   * Update energy forecast
   */
  async updateEnergyForecast() {
    this.log('Updating energy forecast...');

    // Mock forecast data (would integrate with weather API)
    const forecast = {
      today: {
        solar: this.estimateSolarProduction('today'),
        temperature: 20,
        cloudCover: 30
      },
      tomorrow: {
        solar: this.estimateSolarProduction('tomorrow'),
        temperature: 22,
        cloudCover: 40
      },
      tomorrowSolar: 'medium',
      hourly: []
    };

    // Generate hourly forecast
    for (let hour = 0; hour < 48; hour++) {
      forecast.hourly.push({
        hour,
        solar: this.estimateHourlySolar(hour),
        temperature: 18 + Math.random() * 8,
        cloudCover: Math.random() * 100
      });
    }

    // Classify tomorrow's solar
    if (forecast.tomorrow.solar > 5000) {
      forecast.tomorrowSolar = 'high';
    } else if (forecast.tomorrow.solar > 2000) {
      forecast.tomorrowSolar = 'medium';
    } else {
      forecast.tomorrowSolar = 'low';
    }

    this.forecastData = forecast;
  }

  /**
   * Estimate solar production
   */
  estimateSolarProduction(day) {
    // Simplified estimation based on season and typical patterns
    const month = new Date().getMonth();
    
    // Summer months (May-August): higher production
    if (month >= 4 && month <= 7) {
      return 6000 + Math.random() * 2000; // 6-8 kWh
    }
    // Winter months: lower production
    else if (month >= 11 || month <= 1) {
      return 1000 + Math.random() * 1000; // 1-2 kWh
    }
    // Spring/Fall: medium production
    else {
      return 3000 + Math.random() * 2000; // 3-5 kWh
    }
  }

  /**
   * Estimate hourly solar production
   */
  estimateHourlySolar(hour) {
    const hourOfDay = hour % 24;
    
    // Peak production 10-16
    if (hourOfDay >= 10 && hourOfDay <= 16) {
      return 400 + Math.random() * 400; // 400-800W
    }
    // Low production 8-10, 16-18
    else if ((hourOfDay >= 8 && hourOfDay < 10) || (hourOfDay > 16 && hourOfDay <= 18)) {
      return 100 + Math.random() * 200; // 100-300W
    }
    // No production at night
    else {
      return 0;
    }
  }

  /**
   * Evaluate strategy effectiveness
   */
  async evaluateStrategy() {
    if (this.storageHistory.length < 100) return;

    // Calculate metrics
    const last24Hours = this.storageHistory.slice(-288); // 5min intervals = 288 records/day
    
    let totalSolarUsed = 0;
    let totalGridImport = 0;
    let totalGridExport = 0;

    for (const record of last24Hours) {
      totalSolarUsed += record.solar.production;
      totalGridImport += record.grid.importing;
      totalGridExport += record.grid.exporting;
    }

    const metrics = {
      solarSelfConsumption: totalSolarUsed / (totalSolarUsed + totalGridImport) * 100,
      gridDependency: totalGridImport / (totalSolarUsed + totalGridImport) * 100,
      exportRatio: totalGridExport / totalSolarUsed * 100,
      averageBatteryLevel: last24Hours.reduce((sum, r) => sum + r.battery.percentage, 0) / last24Hours.length
    };

    this.log('Energy strategy metrics:', metrics);

    // Auto-adjust strategy if needed
    await this.autoAdjustStrategy(metrics);
  }

  /**
   * Auto-adjust strategy based on metrics
   */
  async autoAdjustStrategy(metrics) {
    // If grid dependency is high, consider more aggressive solar usage
    if (metrics.gridDependency > 60 && this.energyStrategy !== 'self-consumption') {
      this.log('High grid dependency detected, considering self-consumption mode');
    }

    // If battery is often full and exporting a lot, enable more export
    if (metrics.averageBatteryLevel > 80 && metrics.exportRatio > 40) {
      this.log('High export ratio, current strategy is optimal');
    }
  }

  /**
   * Set energy strategy
   */
  async setEnergyStrategy(strategy) {
    if (!this.strategies[strategy]) {
      throw new Error(`Unknown strategy: ${strategy}`);
    }

    this.energyStrategy = strategy;
    await this.homey.settings.set('energyStrategy', strategy);
    
    this.log(`Energy strategy set to: ${strategy}`);
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const latestFlow = this.storageHistory[this.storageHistory.length - 1];
    
    return {
      currentFlow: latestFlow,
      strategy: this.energyStrategy,
      storageDevices: Array.from(this.storageDevices.values()),
      solarPanels: Array.from(this.solarPanels.values()),
      chargingSchedule: this.chargingSchedule,
      forecast: this.forecastData,
      history: this.storageHistory.slice(-100)
    };
  }

  async saveChargingSchedule() {
    await this.homey.settings.set('chargingSchedule', this.chargingSchedule);
  }

  destroy() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
      this.optimizationInterval = null;
    }
    if (this.strategyInterval) {
      clearInterval(this.strategyInterval);
      this.strategyInterval = null;
    }
    if (this.forecastInterval) {
      clearInterval(this.forecastInterval);
      this.forecastInterval = null;
    }
  }

  log(...args) {
    console.log('[EnergyStorageManagementSystem]', ...args);
  }

  error(...args) {
    console.error('[EnergyStorageManagementSystem]', ...args);
  }
}

module.exports = EnergyStorageManagementSystem;
