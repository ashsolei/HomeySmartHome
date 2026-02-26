'use strict';

/**
 * Smart Appliance Controller
 * Intelligent management and scheduling of household appliances
 */
class SmartApplianceController {
  constructor(app) {
    this._intervals = [];
    this._timeouts = [];
    this.app = app;
    this.appliances = new Map();
    this.schedules = new Map();
    this.energyPrices = [];
    this.usageHistory = [];
    this.maintenanceLog = [];
  }

  async initialize() {
    await this.setupAppliances();
    await this.createDefaultSchedules();
    
    this.startMonitoring();
  }

  // ============================================
  // APPLIANCE SETUP
  // ============================================

  async setupAppliances() {
    const applianceData = [
      // Kitchen Appliances
      {
        id: 'dishwasher',
        name: 'Diskmaskin',
        type: 'dishwasher',
        category: 'kitchen',
        power: 1800, // watts
        duration: 150, // minutes
        flexibleTiming: true,
        energyLabel: 'A+++',
        status: 'idle',
        canSchedule: true
      },
      {
        id: 'washing_machine',
        name: 'Tvättmaskin',
        type: 'washer',
        category: 'laundry',
        power: 2200,
        duration: 120,
        flexibleTiming: true,
        energyLabel: 'A+++',
        status: 'idle',
        canSchedule: true
      },
      {
        id: 'dryer',
        name: 'Torktumlare',
        type: 'dryer',
        category: 'laundry',
        power: 2800,
        duration: 90,
        flexibleTiming: true,
        energyLabel: 'A++',
        status: 'idle',
        canSchedule: true
      },
      {
        id: 'oven',
        name: 'Ugn',
        type: 'oven',
        category: 'kitchen',
        power: 3000,
        duration: null, // Variable
        flexibleTiming: false,
        energyLabel: 'A+',
        status: 'idle',
        canSchedule: false
      },
      {
        id: 'cooktop',
        name: 'Spishäll',
        type: 'cooktop',
        category: 'kitchen',
        power: 7400,
        duration: null,
        flexibleTiming: false,
        energyLabel: 'A',
        status: 'idle',
        canSchedule: false
      },
      {
        id: 'fridge',
        name: 'Kylskåp',
        type: 'refrigerator',
        category: 'kitchen',
        power: 150, // Average
        duration: null, // Always on
        flexibleTiming: false,
        energyLabel: 'A+++',
        status: 'running',
        canSchedule: false,
        alwaysOn: true
      },
      {
        id: 'freezer',
        name: 'Frys',
        type: 'freezer',
        category: 'kitchen',
        power: 180,
        duration: null,
        flexibleTiming: false,
        energyLabel: 'A++',
        status: 'running',
        canSchedule: false,
        alwaysOn: true
      },
      // Living Room
      {
        id: 'tv',
        name: 'TV',
        type: 'tv',
        category: 'entertainment',
        power: 120,
        duration: null,
        flexibleTiming: false,
        energyLabel: 'A',
        status: 'standby',
        canSchedule: false
      },
      {
        id: 'sound_system',
        name: 'Ljudsystem',
        type: 'audio',
        category: 'entertainment',
        power: 80,
        duration: null,
        flexibleTiming: false,
        status: 'standby',
        canSchedule: false
      },
      // Utility
      {
        id: 'water_heater',
        name: 'Varmvattenberedare',
        type: 'water_heater',
        category: 'utility',
        power: 3000,
        duration: null,
        flexibleTiming: true,
        energyLabel: 'B',
        status: 'running',
        canSchedule: true,
        temperature: 60,
        targetTemperature: 60
      },
      {
        id: 'ev_charger',
        name: 'Elbilsladdare',
        type: 'ev_charger',
        category: 'utility',
        power: 11000, // 11 kW
        duration: null,
        flexibleTiming: true,
        status: 'idle',
        canSchedule: true
      },
      {
        id: 'pool_pump',
        name: 'Poolpump',
        type: 'pump',
        category: 'outdoor',
        power: 1100,
        duration: 360, // 6 hours/day
        flexibleTiming: true,
        energyLabel: 'A',
        status: 'idle',
        canSchedule: true
      }
    ];

    for (const appliance of applianceData) {
      this.appliances.set(appliance.id, {
        ...appliance,
        totalEnergyUsed: 0,
        totalRuntime: 0,
        cyclesCompleted: 0,
        lastUsed: null,
        currentSession: null,
        estimatedCost: 0
      });
    }
  }

  // ============================================
  // APPLIANCE CONTROL
  // ============================================

  async startAppliance(applianceId, options = {}) {
    const appliance = this.appliances.get(applianceId);
    
    if (!appliance) {
      return { success: false, error: 'Appliance not found' };
    }

    if (appliance.status === 'running') {
      return { success: false, error: 'Already running' };
    }

    // Check if we should delay start for cheaper electricity
    if (appliance.flexibleTiming && !options.forceStart) {
      const optimization = await this.optimizeStartTime(applianceId);
      
      if (optimization.shouldDelay) {
        console.log(`⏰ Delaying ${appliance.name} start for cheaper electricity`);
        return {
          success: true,
          delayed: true,
          startTime: optimization.optimalStartTime,
          savings: optimization.estimatedSavings
        };
      }
    }

    // Start immediately
    const session = {
      id: `session_${Date.now()}`,
      applianceId,
      startTime: Date.now(),
      expectedDuration: appliance.duration,
      estimatedCost: this.calculateCost(appliance.power, appliance.duration)
    };

    appliance.currentSession = session;
    appliance.status = 'running';
    appliance.lastUsed = Date.now();

    console.log(`▶️ Started ${appliance.name}`);

    // Simulate completion
    if (appliance.duration) {
      this._timeouts.push(setTimeout(() => {
        this.completeAppliance(applianceId);
      }, appliance.duration * 60 * 1000)); // Convert minutes to ms
    }

    return { success: true, session };
  }

  async stopAppliance(applianceId) {
    const appliance = this.appliances.get(applianceId);
    
    if (!appliance) {
      return { success: false, error: 'Appliance not found' };
    }

    if (appliance.alwaysOn) {
      return { success: false, error: 'Cannot stop always-on appliance' };
    }

    if (appliance.status !== 'running') {
      return { success: false, error: 'Not running' };
    }

    await this.completeAppliance(applianceId, true);

    console.log(`⏹️ Stopped ${appliance.name}`);

    return { success: true };
  }

  async completeAppliance(applianceId, forceStopped = false) {
    const appliance = this.appliances.get(applianceId);
    
    if (!appliance || !appliance.currentSession) return;

    const session = appliance.currentSession;
    const actualDuration = (Date.now() - session.startTime) / (1000 * 60); // minutes

    session.endTime = Date.now();
    session.actualDuration = actualDuration;
    session.actualCost = this.calculateCost(appliance.power, actualDuration);
    session.forceStopped = forceStopped;

    // Update appliance stats
    appliance.totalEnergyUsed += (appliance.power / 1000) * (actualDuration / 60); // kWh
    appliance.totalRuntime += actualDuration;
    appliance.cyclesCompleted += forceStopped ? 0 : 1;
    appliance.estimatedCost += session.actualCost;
    appliance.status = 'idle';
    appliance.currentSession = null;

    // Log usage
    this.logUsage(appliance, session);

    if (!forceStopped) {
      console.log(`✅ ${appliance.name} completed (${actualDuration.toFixed(0)} min, ${session.actualCost.toFixed(2)} SEK)`);
    }
  }

  // ============================================
  // SCHEDULING
  // ============================================

  async createDefaultSchedules() {
    // Pool pump schedule - run during cheapest hours
    await this.createSchedule({
      id: 'pool_pump_daily',
      applianceId: 'pool_pump',
      name: 'Poolpump daglig',
      type: 'optimize',
      enabled: true,
      startBefore: '18:00', // Must start before 6 PM
      preferCheapHours: true
    });

    // Water heater - heat during night
    await this.createSchedule({
      id: 'water_heater_night',
      applianceId: 'water_heater',
      name: 'Varmvatten natt',
      type: 'time',
      enabled: true,
      time: '02:00',
      days: [0, 1, 2, 3, 4, 5, 6]
    });

    // EV charging - cheapest hours
    await this.createSchedule({
      id: 'ev_charge_night',
      applianceId: 'ev_charger',
      name: 'Elbil nattladdning',
      type: 'optimize',
      enabled: true,
      readyBy: '07:00',
      preferCheapHours: true
    });
  }

  async createSchedule(config) {
    this.schedules.set(config.id, {
      ...config,
      lastRun: null,
      nextRun: null,
      runsCompleted: 0
    });

    console.log(`📅 Schedule created: ${config.name}`);

    return { success: true, schedule: this.schedules.get(config.id) };
  }

  async optimizeStartTime(applianceId) {
    const appliance = this.appliances.get(applianceId);
    
    if (!appliance) return { shouldDelay: false };

    // Get next 12 hours of electricity prices
    const prices = this.getUpcomingPrices(12);
    
    if (prices.length === 0) {
      return { shouldDelay: false };
    }

    const currentPrice = prices[0].price;
    const _avgPrice = prices.reduce((sum, p) => sum + p.price, 0) / prices.length;

    // Find cheapest period that can accommodate the appliance duration
    const duration = appliance.duration || 60; // minutes
    const hoursNeeded = Math.ceil(duration / 60);

    let cheapestStart = 0;
    let cheapestAvgPrice = Infinity;

    for (let i = 0; i <= prices.length - hoursNeeded; i++) {
      const windowPrices = prices.slice(i, i + hoursNeeded);
      const windowAvg = windowPrices.reduce((sum, p) => sum + p.price, 0) / windowPrices.length;
      
      if (windowAvg < cheapestAvgPrice) {
        cheapestAvgPrice = windowAvg;
        cheapestStart = i;
      }
    }

    // Should we delay?
    const savingsThreshold = 0.15; // 15% cheaper
    const shouldDelay = (currentPrice - cheapestAvgPrice) / currentPrice > savingsThreshold;

    const estimatedSavings = shouldDelay 
      ? ((currentPrice - cheapestAvgPrice) / 100) * (appliance.power / 1000) * (duration / 60)
      : 0;

    return {
      shouldDelay,
      optimalStartTime: new Date(prices[cheapestStart].timestamp).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
      currentPrice,
      optimalPrice: cheapestAvgPrice,
      estimatedSavings: estimatedSavings.toFixed(2)
    };
  }

  getUpcomingPrices(hours) {
    // Simulate electricity prices
    const now = Date.now();
    const prices = [];

    for (let i = 0; i < hours; i++) {
      const timestamp = now + i * 60 * 60 * 1000;
      const hour = new Date(timestamp).getHours();
      
      // Base price with time-of-day variation
      let price = 80; // öre/kWh base
      
      if (hour >= 22 || hour < 6) {
        price = 50; // Night - cheap
      } else if (hour >= 6 && hour < 9) {
        price = 120; // Morning peak
      } else if (hour >= 17 && hour < 21) {
        price = 110; // Evening peak
      }

      prices.push({ timestamp, hour, price });
    }

    return prices;
  }

  // ============================================
  // LOAD MANAGEMENT
  // ============================================

  async checkLoadLimit() {
    const maxLoad = 15000; // watts (15 kW)
    
    let currentLoad = 0;
    const runningAppliances = [];

    for (const [_id, appliance] of this.appliances) {
      if (appliance.status === 'running') {
        currentLoad += appliance.power;
        runningAppliances.push(appliance.name);
      }
    }

    if (currentLoad > maxLoad) {
      console.log(`⚠️ Load limit exceeded: ${(currentLoad / 1000).toFixed(1)} kW / ${maxLoad / 1000} kW`);
      console.log(`  Running: ${runningAppliances.join(', ')}`);
      
      // Find appliance to defer
      await this.deferLowPriorityAppliance();
    }

    return {
      currentLoad,
      maxLoad,
      percentage: Math.round((currentLoad / maxLoad) * 100),
      safe: currentLoad <= maxLoad
    };
  }

  async deferLowPriorityAppliance() {
    // Find flexible appliances to defer
    const flexibleRunning = Array.from(this.appliances.values())
      .filter(a => a.status === 'running' && a.flexibleTiming && a.canSchedule);

    if (flexibleRunning.length > 0) {
      // Defer the highest power flexible appliance
      flexibleRunning.sort((a, b) => b.power - a.power);
      const toDefer = flexibleRunning[0];
      
      console.log(`  ⏸️ Deferring ${toDefer.name} to reduce load`);
      
      await this.stopAppliance(toDefer.id);
      
      // Reschedule for later
      this._timeouts.push(setTimeout(() => {
        this.startAppliance(toDefer.id, { forceStart: false });
      }, 30 * 60 * 1000)); // Retry in 30 minutes
    }
  }

  async balanceLoad(targetLoad) {
    console.log(`⚖️ Balancing load to ${targetLoad}W`);

    const currentLoad = await this.getCurrentLoad();
    
    if (currentLoad <= targetLoad) {
      return { success: true, message: 'Load already within target' };
    }

    const reduction = currentLoad - targetLoad;
    
    // Get flexible appliances sorted by power consumption
    const flexible = Array.from(this.appliances.values())
      .filter(a => a.status === 'running' && a.flexibleTiming)
      .sort((a, b) => b.power - a.power);

    let reducedLoad = 0;
    const deferred = [];

    for (const appliance of flexible) {
      if (reducedLoad >= reduction) break;
      
      await this.stopAppliance(appliance.id);
      reducedLoad += appliance.power;
      deferred.push(appliance.name);
    }

    console.log(`  ✓ Deferred: ${deferred.join(', ')}`);
    console.log(`  ✓ Reduced by ${(reducedLoad / 1000).toFixed(1)} kW`);

    return {
      success: true,
      deferred: deferred.length,
      reducedBy: reducedLoad
    };
  }

  async getCurrentLoad() {
    let load = 0;
    
    for (const appliance of this.appliances.values()) {
      if (appliance.status === 'running') {
        load += appliance.power;
      }
    }

    return load;
  }

  // ============================================
  // MAINTENANCE
  // ============================================

  async checkMaintenance() {
    console.log('🔧 Checking appliance maintenance...');

    for (const [id, appliance] of this.appliances) {
      const warnings = [];

      // Check usage-based maintenance
      if (appliance.type === 'dishwasher' && appliance.cyclesCompleted > 0 && appliance.cyclesCompleted % 50 === 0) {
        warnings.push('Clean filter');
      }

      if (appliance.type === 'washer' && appliance.cyclesCompleted > 0 && appliance.cyclesCompleted % 30 === 0) {
        warnings.push('Run cleaning cycle');
      }

      if (appliance.type === 'dryer' && appliance.cyclesCompleted > 0 && appliance.cyclesCompleted % 20 === 0) {
        warnings.push('Clean lint filter and condenser');
      }

      // Check refrigeration
      if (appliance.type === 'refrigerator' || appliance.type === 'freezer') {
        // Check every 6 months (simulate)
        if (Math.random() < 0.01) {
          warnings.push('Defrost and clean coils');
        }
      }

      if (warnings.length > 0) {
        console.log(`  🔧 ${appliance.name}: ${warnings.join(', ')}`);
        
        this.maintenanceLog.push({
          timestamp: Date.now(),
          applianceId: id,
          warnings
        });
      }
    }
  }

  // ============================================
  // MONITORING
  // ============================================

  startMonitoring() {
    // Check load every minute
    this._intervals.push(setInterval(() => {
      this.checkLoadLimit();
    }, 60 * 1000));

    // Monitor always-on appliances every 5 minutes
    this._intervals.push(setInterval(() => {
      this.monitorAlwaysOn();
    }, 5 * 60 * 1000));

    // Check schedules every 5 minutes
    this._intervals.push(setInterval(() => {
      this.checkSchedules();
    }, 5 * 60 * 1000));

    // Maintenance check weekly
    this._intervals.push(setInterval(() => {
      this.checkMaintenance();
    }, 7 * 24 * 60 * 60 * 1000));
  }

  async monitorAlwaysOn() {
    for (const [_id, appliance] of this.appliances) {
      if (appliance.alwaysOn && appliance.status === 'running') {
        // Track continuous energy usage
        const interval = 5 / 60; // 5 minutes in hours
        const energy = (appliance.power / 1000) * interval;
        
        appliance.totalEnergyUsed += energy;
        appliance.estimatedCost += this.calculateCost(appliance.power, 5);
      }
    }
  }

  async checkSchedules() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    for (const [_id, schedule] of this.schedules) {
      if (!schedule.enabled) continue;

      if (schedule.type === 'time') {
        const [scheduleHour, scheduleMinute] = schedule.time.split(':').map(Number);
        
        if (currentHour === scheduleHour && currentMinute === scheduleMinute) {
          console.log(`📅 Running scheduled task: ${schedule.name}`);
          await this.startAppliance(schedule.applianceId);
          schedule.lastRun = Date.now();
          schedule.runsCompleted += 1;
        }
      } else if (schedule.type === 'optimize') {
        // Run optimization-based schedules
        if (schedule.preferCheapHours) {
          const optimization = await this.optimizeStartTime(schedule.applianceId);
          
          // Check if current time is the optimal time
          const optimalHour = parseInt(optimization.optimalStartTime.split(':')[0]);
          
          if (currentHour === optimalHour && currentMinute < 5) {
            console.log(`📅 Running optimized task: ${schedule.name}`);
            await this.startAppliance(schedule.applianceId, { forceStart: true });
            schedule.lastRun = Date.now();
            schedule.runsCompleted += 1;
          }
        }
      }
    }
  }

  // ============================================
  // UTILITIES
  // ============================================

  calculateCost(power, durationMinutes) {
    const energy = (power / 1000) * (durationMinutes / 60); // kWh
    const pricePerKwh = 1.8; // SEK average
    return energy * pricePerKwh;
  }

  logUsage(appliance, session) {
    this.usageHistory.push({
      timestamp: session.startTime,
      applianceId: appliance.id,
      applianceName: appliance.name,
      duration: session.actualDuration,
      energyUsed: (appliance.power / 1000) * (session.actualDuration / 60),
      cost: session.actualCost
    });

    // Keep last 1000 entries
    if (this.usageHistory.length > 1000) {
      this.usageHistory = this.usageHistory.slice(-1000);
    }
  }

  // ============================================
  // REPORTING & ANALYTICS
  // ============================================

  getApplianceStatus(applianceId) {
    const appliance = this.appliances.get(applianceId);
    
    if (!appliance) return null;

    return {
      name: appliance.name,
      type: appliance.type,
      status: appliance.status,
      power: appliance.power,
      currentSession: appliance.currentSession ? {
        startTime: appliance.currentSession.startTime,
        expectedEnd: appliance.currentSession.startTime + (appliance.duration * 60 * 1000),
        estimatedCost: appliance.currentSession.estimatedCost
      } : null,
      stats: {
        totalEnergyUsed: appliance.totalEnergyUsed.toFixed(2),
        totalRuntime: Math.round(appliance.totalRuntime),
        cyclesCompleted: appliance.cyclesCompleted,
        estimatedCost: appliance.estimatedCost.toFixed(2)
      }
    };
  }

  getLoadStatus() {
    let currentLoad = 0;
    const active = [];

    for (const [_id, appliance] of this.appliances) {
      if (appliance.status === 'running') {
        currentLoad += appliance.power;
        active.push({
          name: appliance.name,
          power: appliance.power
        });
      }
    }

    return {
      currentLoad,
      maxLoad: 15000,
      utilizationPercent: Math.round((currentLoad / 15000) * 100),
      activeAppliances: active.length,
      active
    };
  }

  getEnergyReport(days = 30) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const recentUsage = this.usageHistory.filter(u => u.timestamp >= cutoff);

    const byAppliance = {};
    let totalEnergy = 0;
    let totalCost = 0;

    for (const usage of recentUsage) {
      if (!byAppliance[usage.applianceName]) {
        byAppliance[usage.applianceName] = {
          energy: 0,
          cost: 0,
          runs: 0
        };
      }

      byAppliance[usage.applianceName].energy += usage.energyUsed;
      byAppliance[usage.applianceName].cost += usage.cost;
      byAppliance[usage.applianceName].runs += 1;

      totalEnergy += usage.energyUsed;
      totalCost += usage.cost;
    }

    // Sort by energy consumption
    const sorted = Object.entries(byAppliance)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.energy - a.energy);

    return {
      period: `${days} days`,
      totalEnergy: totalEnergy.toFixed(2),
      totalCost: totalCost.toFixed(2),
      averageDailyCost: (totalCost / days).toFixed(2),
      byAppliance: sorted.map(a => ({
        name: a.name,
        energy: a.energy.toFixed(2),
        cost: a.cost.toFixed(2),
        runs: a.runs,
        percentage: Math.round((a.energy / totalEnergy) * 100)
      }))
    };
  }

  getOptimizationReport() {
    // Calculate potential savings from optimization
    const schedulable = Array.from(this.appliances.values())
      .filter(a => a.canSchedule && a.flexibleTiming);

    const currentPrices = this.getUpcomingPrices(24);
    const avgPrice = currentPrices.reduce((sum, p) => sum + p.price, 0) / currentPrices.length;
    const cheapestPrice = Math.min(...currentPrices.map(p => p.price));

    let potentialSavings = 0;

    for (const appliance of schedulable) {
      if (appliance.duration) {
        const energy = (appliance.power / 1000) * (appliance.duration / 60);
        const savingPerRun = ((avgPrice - cheapestPrice) / 100) * energy;
        const runsPerMonth = 30; // Estimate
        
        potentialSavings += savingPerRun * runsPerMonth;
      }
    }

    return {
      schedulableAppliances: schedulable.length,
      currentSchedules: this.schedules.size,
      potentialMonthlySavings: potentialSavings.toFixed(2),
      recommendations: [
        {
          appliance: 'Pool pump',
          action: 'Run during night (22:00-06:00)',
          savings: '~50 SEK/month'
        },
        {
          appliance: 'EV charging',
          action: 'Charge only during cheapest 6 hours',
          savings: '~200 SEK/month'
        },
        {
          appliance: 'Water heater',
          action: 'Heat during night low rates',
          savings: '~100 SEK/month'
        }
      ]
    };
  }

  getMaintenanceStatus() {
    const issues = [];

    for (const [_id, appliance] of this.appliances) {
      // Check if maintenance is due
      if (appliance.type === 'dishwasher' && appliance.cyclesCompleted >= 50) {
        issues.push({
          appliance: appliance.name,
          issue: 'Filter cleaning recommended',
          urgency: 'medium'
        });
      }

      if (appliance.type === 'washer' && appliance.cyclesCompleted >= 30) {
        issues.push({
          appliance: appliance.name,
          issue: 'Cleaning cycle needed',
          urgency: 'medium'
        });
      }

      if (appliance.type === 'dryer' && appliance.cyclesCompleted >= 20) {
        issues.push({
          appliance: appliance.name,
          issue: 'Lint filter and condenser cleaning',
          urgency: 'high'
        });
      }
    }

    return {
      totalIssues: issues.length,
      issues
    };
  }

  destroy() {
    if (this._intervals) {
      this._intervals.forEach(id => clearInterval(id));
      this._intervals = [];
    }
    if (this._timeouts) {
      this._timeouts.forEach(id => clearTimeout(id));
      this._timeouts = [];
    }
  }
}

module.exports = SmartApplianceController;
