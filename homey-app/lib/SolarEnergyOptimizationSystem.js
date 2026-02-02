'use strict';

const EventEmitter = require('events');
const Homey = require('homey');

/**
 * Solar Energy Optimization System
 * 
 * Advanced solar panel management with production forecasting, battery optimization, and grid interaction.
 * 
 * @extends EventEmitter
 */
class SolarEnergyOptimizationSystem extends EventEmitter {
  constructor() {
    super();
    
    this.solarPanels = new Map();
    this.batteries = new Map();
    this.inverters = new Map();
    this.productionHistory = [];
    this.consumptionHistory = [];
    this.gridTransactions = [];
    
    this.settings = {
      autoOptimizationEnabled: true,
      priorityMode: 'self-consumption', // self-consumption, grid-export, battery-priority
      batteryReserve: 20, // % minimum battery level
      gridExportEnabled: true,
      peakShavingEnabled: true,
      weatherForecastEnabled: true
    };
    
    this.currentState = {
      totalProduction: 0, // W
      totalConsumption: 0, // W
      batteryLevel: 0, // %
      gridImport: 0, // W
      gridExport: 0, // W
      selfConsumptionRate: 0 // %
    };
    
    this.cache = { data: new Map(), timestamps: new Map(), ttl: 5 * 60 * 1000 };
    this.monitoring = { interval: null, checkInterval: 1 * 60 * 1000, lastCheck: null };
    
    this.initializeDefaultData();
  }
  
  initializeDefaultData() {
    // Solar panel arrays
    this.solarPanels.set('array-001', {
      id: 'array-001',
      name: 'South Roof Array',
      location: 'main-roof-south',
      panels: 12,
      wattagePerPanel: 400, // W
      totalCapacity: 4800, // W
      orientation: 'south',
      tilt: 35, // degrees
      efficiency: 0.20,
      currentProduction: 3200, // W
      dailyProduction: 18.5, // kWh
      lifetimeProduction: 8420, // kWh
      installDate: Date.now() - 365 * 24 * 60 * 60 * 1000,
      status: 'active',
      temperature: 45, // °C
      performanceRatio: 0.85
    });
    
    this.solarPanels.set('array-002', {
      id: 'array-002',
      name: 'East Roof Array',
      location: 'main-roof-east',
      panels: 8,
      wattagePerPanel: 400,
      totalCapacity: 3200,
      orientation: 'east',
      tilt: 35,
      efficiency: 0.20,
      currentProduction: 1800,
      dailyProduction: 11.2,
      lifetimeProduction: 5630,
      installDate: Date.now() - 365 * 24 * 60 * 60 * 1000,
      status: 'active',
      temperature: 42,
      performanceRatio: 0.82
    });
    
    // Battery storage
    this.batteries.set('battery-001', {
      id: 'battery-001',
      name: 'Tesla Powerwall 2',
      capacity: 13.5, // kWh
      usableCapacity: 13.5,
      currentCharge: 9.2, // kWh
      currentLevel: 68, // %
      power: 500, // W (positive = charging, negative = discharging)
      maxChargePower: 5000, // W
      maxDischargePower: 5000,
      cycles: 342,
      maxCycles: 10000,
      efficiency: 0.90,
      temperature: 22,
      status: 'charging',
      warrantyYears: 10,
      installDate: Date.now() - 200 * 24 * 60 * 60 * 1000
    });
    
    // Inverters
    this.inverters.set('inverter-001', {
      id: 'inverter-001',
      name: 'SolarEdge SE7600H',
      type: 'hybrid',
      maxPower: 7600, // W
      efficiency: 0.97,
      currentPower: 4850, // W
      status: 'active',
      temperature: 38,
      gridConnected: true,
      mpptTrackers: 2
    });
    
    // Recent production data (last 24h, hourly)
    const now = Date.now();
    for (let i = 23; i >= 0; i--) {
      const hour = new Date(now - i * 60 * 60 * 1000).getHours();
      let production = 0;
      
      // Simulate solar curve (peak at noon)
      if (hour >= 6 && hour <= 18) {
        const solarFactor = Math.sin(((hour - 6) / 12) * Math.PI);
        production = 8000 * solarFactor * (0.8 + Math.random() * 0.4); // 0-8000W
      }
      
      this.productionHistory.push({
        timestamp: now - i * 60 * 60 * 1000,
        production: Math.round(production),
        consumption: Math.round(2000 + Math.random() * 2000), // 2-4kW
        batteryLevel: 50 + Math.random() * 40,
        gridImport: Math.max(0, Math.round(2500 - production)),
        gridExport: Math.max(0, Math.round(production - 2500))
      });
    }
    
    // Grid transactions (last 7 days)
    for (let i = 6; i >= 0; i--) {
      this.gridTransactions.push({
        id: `transaction-${Date.now() - i * 24 * 60 * 60 * 1000}`,
        date: Date.now() - i * 24 * 60 * 60 * 1000,
        imported: 15 + Math.random() * 10, // kWh
        exported: 20 + Math.random() * 15, // kWh
        importCost: (15 + Math.random() * 10) * 1.5, // SEK @ 1.5 SEK/kWh
        exportRevenue: (20 + Math.random() * 15) * 0.6, // SEK @ 0.6 SEK/kWh
        netCost: 0
      });
      
      const last = this.gridTransactions[this.gridTransactions.length - 1];
      last.netCost = last.importCost - last.exportRevenue;
    }
  }
  
  async initialize() {
    try {
      await this.loadSettings();
      this.startMonitoring();
      
      this.emit('notification', {
        type: 'info',
        priority: 'low',
        title: 'Solar Energy System',
        message: `Solar system initialized with ${this.solarPanels.size} arrays`
      });
      
      return { success: true, arrays: this.solarPanels.size };
    } catch (error) {
      this.emit('notification', {
        type: 'error',
        priority: 'high',
        title: 'Solar System Error',
        message: `Failed to initialize: ${error.message}`
      });
      throw error;
    }
  }
  
  async optimizeEnergyFlow() {
    const totalProduction = this.getTotalProduction();
    const totalConsumption = this.getCurrentConsumption();
    const surplus = totalProduction - totalConsumption;
    
    const battery = this.batteries.get('battery-001');
    if (!battery) return;
    
    let action = 'balanced';
    
    if (this.settings.priorityMode === 'self-consumption') {
      if (surplus > 0) {
        // Surplus energy - charge battery first
        if (battery.currentLevel < 95) {
          action = 'charge-battery';
          const chargeRate = Math.min(surplus, battery.maxChargePower);
          battery.power = chargeRate;
          battery.status = 'charging';
        } else if (this.settings.gridExportEnabled) {
          action = 'export-to-grid';
          battery.power = 0;
          battery.status = 'idle';
        }
      } else {
        // Deficit - use battery first
        if (battery.currentLevel > this.settings.batteryReserve) {
          action = 'discharge-battery';
          const dischargeRate = Math.min(Math.abs(surplus), battery.maxDischargePower);
          battery.power = -dischargeRate;
          battery.status = 'discharging';
        } else {
          action = 'import-from-grid';
          battery.power = 0;
          battery.status = 'standby';
        }
      }
    } else if (this.settings.priorityMode === 'battery-priority') {
      // Always prioritize battery charging
      if (surplus > 0 && battery.currentLevel < 100) {
        action = 'charge-battery';
        const chargeRate = Math.min(surplus, battery.maxChargePower);
        battery.power = chargeRate;
        battery.status = 'charging';
      }
    }
    
    this.updateCurrentState();
    await this.saveSettings();
    
    return { action, surplus, batteryLevel: battery.currentLevel };
  }
  
  getTotalProduction() {
    let total = 0;
    for (const [id, panel] of this.solarPanels) {
      total += panel.currentProduction;
    }
    return total;
  }
  
  getCurrentConsumption() {
    // In real implementation, this would come from smart meter
    // Simulated consumption: 2-4 kW
    return 2000 + Math.random() * 2000;
  }
  
  updateCurrentState() {
    const totalProduction = this.getTotalProduction();
    const totalConsumption = this.getCurrentConsumption();
    const battery = this.batteries.get('battery-001');
    
    this.currentState.totalProduction = Math.round(totalProduction);
    this.currentState.totalConsumption = Math.round(totalConsumption);
    this.currentState.batteryLevel = battery ? battery.currentLevel : 0;
    
    const surplus = totalProduction - totalConsumption;
    
    if (battery && battery.status === 'charging') {
      this.currentState.gridImport = 0;
      this.currentState.gridExport = Math.max(0, surplus - battery.power);
    } else if (battery && battery.status === 'discharging') {
      this.currentState.gridImport = Math.max(0, Math.abs(surplus) + battery.power);
      this.currentState.gridExport = 0;
    } else {
      this.currentState.gridImport = Math.max(0, -surplus);
      this.currentState.gridExport = Math.max(0, surplus);
    }
    
    // Calculate self-consumption rate
    if (totalProduction > 0) {
      const selfConsumed = Math.min(totalProduction, totalConsumption);
      this.currentState.selfConsumptionRate = Math.round((selfConsumed / totalProduction) * 100);
    }
  }
  
  async forecastProduction(hours = 24) {
    const cached = this.getCached('production-forecast');
    if (cached) return cached;
    
    // Simple forecast based on historical patterns
    // In real implementation, would use weather API
    const forecast = [];
    const now = new Date();
    
    for (let i = 0; i < hours; i++) {
      const futureTime = new Date(now.getTime() + i * 60 * 60 * 1000);
      const hour = futureTime.getHours();
      
      let production = 0;
      if (hour >= 6 && hour <= 18) {
        const solarFactor = Math.sin(((hour - 6) / 12) * Math.PI);
        production = 8000 * solarFactor * 0.9; // Slightly conservative estimate
      }
      
      forecast.push({
        hour,
        time: futureTime.toISOString(),
        estimatedProduction: Math.round(production),
        confidence: 0.75
      });
    }
    
    this.setCached('production-forecast', forecast);
    return forecast;
  }
  
  getSolarStatistics() {
    const cached = this.getCached('solar-stats');
    if (cached) return cached;
    
    const panels = Array.from(this.solarPanels.values());
    const batteries = Array.from(this.batteries.values());
    
    // Calculate today's production
    const today = this.productionHistory.filter(h => {
      const recordDate = new Date(h.timestamp).toDateString();
      const nowDate = new Date().toDateString();
      return recordDate === nowDate;
    });
    
    const todayProduction = today.reduce((sum, h) => sum + h.production / 1000, 0); // kWh
    const todayConsumption = today.reduce((sum, h) => sum + h.consumption / 1000, 0);
    const todayGridImport = today.reduce((sum, h) => sum + h.gridImport / 1000, 0);
    const todayGridExport = today.reduce((sum, h) => sum + h.gridExport / 1000, 0);
    
    // Financial calculations
    const importCost = todayGridImport * 1.5; // SEK @ 1.5 SEK/kWh
    const exportRevenue = todayGridExport * 0.6; // SEK @ 0.6 SEK/kWh
    const savings = todayProduction * 1.5; // Value of self-generated energy
    
    const stats = {
      production: {
        current: this.currentState.totalProduction,
        today: Math.round(todayProduction * 100) / 100,
        arrays: panels.length,
        totalCapacity: panels.reduce((sum, p) => sum + p.totalCapacity, 0),
        averageEfficiency: panels.reduce((sum, p) => sum + p.efficiency, 0) / panels.length,
        averagePerformanceRatio: panels.reduce((sum, p) => sum + p.performanceRatio, 0) / panels.length
      },
      consumption: {
        current: this.currentState.totalConsumption,
        today: Math.round(todayConsumption * 100) / 100,
        selfConsumptionRate: this.currentState.selfConsumptionRate
      },
      battery: batteries.length > 0 ? {
        level: batteries[0].currentLevel,
        capacity: batteries[0].capacity,
        status: batteries[0].status,
        cycles: batteries[0].cycles,
        health: Math.round((1 - batteries[0].cycles / batteries[0].maxCycles) * 100)
      } : null,
      grid: {
        importToday: Math.round(todayGridImport * 100) / 100,
        exportToday: Math.round(todayGridExport * 100) / 100,
        currentFlow: this.currentState.gridImport > 0 ? -this.currentState.gridImport : this.currentState.gridExport
      },
      financial: {
        todayImportCost: Math.round(importCost * 100) / 100,
        todayExportRevenue: Math.round(exportRevenue * 100) / 100,
        todaySavings: Math.round(savings * 100) / 100,
        netBalance: Math.round((exportRevenue - importCost) * 100) / 100
      }
    };
    
    this.setCached('solar-stats', stats);
    return stats;
  }
  
  async simulatePeakShaving(threshold = 5000) {
    const battery = this.batteries.get('battery-001');
    if (!battery) throw new Error('No battery available');
    
    if (!this.settings.peakShavingEnabled) {
      throw new Error('Peak shaving not enabled');
    }
    
    const consumption = this.getCurrentConsumption();
    
    if (consumption > threshold && battery.currentLevel > this.settings.batteryReserve) {
      const reduction = consumption - threshold;
      const dischargeRate = Math.min(reduction, battery.maxDischargePower);
      
      battery.power = -dischargeRate;
      battery.status = 'discharging';
      
      await this.saveSettings();
      
      return {
        success: true,
        peakReduced: Math.round(dischargeRate),
        newConsumption: Math.round(consumption - dischargeRate)
      };
    }
    
    return { success: false, reason: 'Below threshold or insufficient battery' };
  }
  
  startMonitoring() {
    if (this.monitoring.interval) clearInterval(this.monitoring.interval);
    this.monitoring.interval = setInterval(() => this.monitorSolarSystem(), this.monitoring.checkInterval);
  }
  
  monitorSolarSystem() {
    this.monitoring.lastCheck = Date.now();
    
    // Update production based on time of day
    const hour = new Date().getHours();
    for (const [id, panel] of this.solarPanels) {
      if (hour >= 6 && hour <= 18) {
        const solarFactor = Math.sin(((hour - 6) / 12) * Math.PI);
        panel.currentProduction = Math.round(panel.totalCapacity * solarFactor * panel.performanceRatio * (0.8 + Math.random() * 0.4));
      } else {
        panel.currentProduction = 0;
      }
      
      // Update panel temperature
      panel.temperature = 20 + (panel.currentProduction / panel.totalCapacity) * 30;
    }
    
    // Update battery
    const battery = this.batteries.get('battery-001');
    if (battery) {
      if (battery.status === 'charging' && battery.power > 0) {
        const chargeIncrease = (battery.power / 1000) * (1 / 60) * battery.efficiency; // kWh per minute
        battery.currentCharge = Math.min(battery.capacity, battery.currentCharge + chargeIncrease);
        battery.currentLevel = Math.round((battery.currentCharge / battery.capacity) * 100);
      } else if (battery.status === 'discharging' && battery.power < 0) {
        const dischargeDecrease = (Math.abs(battery.power) / 1000) * (1 / 60) / battery.efficiency;
        battery.currentCharge = Math.max(0, battery.currentCharge - dischargeDecrease);
        battery.currentLevel = Math.round((battery.currentCharge / battery.capacity) * 100);
      }
    }
    
    // Auto-optimize if enabled
    if (this.settings.autoOptimizationEnabled) {
      this.optimizeEnergyFlow();
    }
    
    // Log production data
    this.productionHistory.push({
      timestamp: Date.now(),
      production: this.getTotalProduction(),
      consumption: this.getCurrentConsumption(),
      batteryLevel: battery ? battery.currentLevel : 0,
      gridImport: this.currentState.gridImport,
      gridExport: this.currentState.gridExport
    });
    
    // Keep only last 24 hours
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    this.productionHistory = this.productionHistory.filter(h => h.timestamp > dayAgo);
    
    // Alerts
    if (battery && battery.currentLevel < 15) {
      this.emit('notification', {
        type: 'warning',
        priority: 'medium',
        title: 'Low Battery',
        message: `Battery level at ${battery.currentLevel}%`
      });
    }
    
    for (const [id, panel] of this.solarPanels) {
      if (panel.performanceRatio < 0.7) {
        this.emit('notification', {
          type: 'warning',
          priority: 'high',
          title: 'Low Solar Performance',
          message: `${panel.name} performance ratio: ${Math.round(panel.performanceRatio * 100)}%`
        });
      }
    }
  }
  
  getCached(key) {
    const cached = this.cache.data.get(key);
    const timestamp = this.cache.timestamps.get(key);
    if (cached && timestamp && (Date.now() - timestamp < this.cache.ttl)) return cached;
    return null;
  }
  
  setCached(key, value) {
    this.cache.data.set(key, value);
    this.cache.timestamps.set(key, Date.now());
  }
  
  clearCache() {
    this.cache.data.clear();
    this.cache.timestamps.clear();
  }
  
  async loadSettings() {
    try {
      const settings = Homey.ManagerSettings.get('solarEnergyOptimizationSystem');
      if (settings) {
        this.solarPanels = new Map(settings.solarPanels || []);
        this.batteries = new Map(settings.batteries || []);
        this.inverters = new Map(settings.inverters || []);
        this.productionHistory = settings.productionHistory || [];
        this.consumptionHistory = settings.consumptionHistory || [];
        this.gridTransactions = settings.gridTransactions || [];
        Object.assign(this.settings, settings.settings || {});
        Object.assign(this.currentState, settings.currentState || {});
      }
    } catch (error) {
      console.error('Failed to load solar settings:', error);
    }
  }
  
  async saveSettings() {
    try {
      const settings = {
        solarPanels: Array.from(this.solarPanels.entries()),
        batteries: Array.from(this.batteries.entries()),
        inverters: Array.from(this.inverters.entries()),
        productionHistory: this.productionHistory.slice(-100), // Keep last 100 entries
        consumptionHistory: this.consumptionHistory.slice(-100),
        gridTransactions: this.gridTransactions.slice(-30), // Keep last 30 days
        settings: this.settings,
        currentState: this.currentState
      };
      Homey.ManagerSettings.set('solarEnergyOptimizationSystem', settings);
    } catch (error) {
      console.error('Failed to save solar settings:', error);
      throw error;
    }
  }
  
  getSolarPanels() { return Array.from(this.solarPanels.values()); }
  getBatteries() { return Array.from(this.batteries.values()); }
  getInverters() { return Array.from(this.inverters.values()); }
  getProductionHistory(limit = 24) { return this.productionHistory.slice(-limit); }
  getGridTransactions(limit = 7) { return this.gridTransactions.slice(-limit); }
  getCurrentState() { return this.currentState; }
}

module.exports = SolarEnergyOptimizationSystem;
