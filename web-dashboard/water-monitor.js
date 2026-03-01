'use strict';
const logger = require('./logger');

/**
 * Water Consumption Monitor
 * Tracks water usage, detects leaks, and provides conservation insights
 */
class WaterConsumptionMonitor {
  constructor(app) {
    this._intervals = [];
    this.app = app;
    this.meters = new Map();
    this.usageHistory = [];
    this.leakAlerts = [];
    this.baselines = new Map();
    this.conservationGoals = new Map();
  }

  async initialize() {
    // Load water meters
    await this.loadMeters();
    
    // Load baselines
    await this.loadBaselines();
    
    // Load conservation goals
    await this.loadConservationGoals();
    
    // Start monitoring
    this.startMonitoring();
  }

  // ============================================
  // METER MANAGEMENT
  // ============================================

  async loadMeters() {
    const meterConfigs = [
      {
        id: 'main_meter',
        name: 'Huvudmätare',
        location: 'main',
        type: 'main',
        unit: 'L',
        totalConsumption: 145000, // Liters lifetime
        lastReading: 145000,
        installed: '2020-01-15'
      },
      {
        id: 'hot_water',
        name: 'Varmvatten',
        location: 'main',
        type: 'hot',
        unit: 'L',
        totalConsumption: 45000,
        lastReading: 45000,
        installed: '2020-01-15'
      },
      {
        id: 'cold_water',
        name: 'Kallvatten',
        location: 'main',
        type: 'cold',
        unit: 'L',
        totalConsumption: 100000,
        lastReading: 100000,
        installed: '2020-01-15'
      },
      {
        id: 'bathroom',
        name: 'Badrum',
        location: 'bathroom',
        type: 'room',
        unit: 'L',
        totalConsumption: 35000,
        lastReading: 35000,
        installed: '2021-03-10'
      },
      {
        id: 'kitchen',
        name: 'Kök',
        location: 'kitchen',
        type: 'room',
        unit: 'L',
        totalConsumption: 25000,
        lastReading: 25000,
        installed: '2021-03-10'
      },
      {
        id: 'washing_machine',
        name: 'Tvättmaskin',
        location: 'utility',
        type: 'appliance',
        unit: 'L',
        totalConsumption: 15000,
        lastReading: 15000,
        installed: '2021-06-20'
      },
      {
        id: 'dishwasher',
        name: 'Diskmaskin',
        location: 'kitchen',
        type: 'appliance',
        unit: 'L',
        totalConsumption: 8000,
        lastReading: 8000,
        installed: '2021-06-20'
      }
    ];

    for (const config of meterConfigs) {
      this.meters.set(config.id, {
        ...config,
        currentFlow: 0, // L/min
        todayUsage: 0,
        weekUsage: 0,
        monthUsage: 0,
        status: 'active',
        lastUpdate: Date.now()
      });
    }
  }

  // ============================================
  // MONITORING
  // ============================================

  startMonitoring() {
    // Update readings every 30 seconds
    this._intervals.push(setInterval(() => {
      this.updateReadings();
    }, 30 * 1000));

    // Check for leaks every minute
    this._intervals.push(setInterval(() => {
      this.checkForLeaks();
    }, 60 * 1000));

    // Calculate daily statistics at midnight
    this._intervals.push(setInterval(() => {
      const hour = new Date().getHours();
      if (hour === 0) {
        this.calculateDailyStats();
      }
    }, 60 * 60 * 1000));

    // Initial update
    this.updateReadings();
  }

  async updateReadings() {
    const hour = new Date().getHours();
    const minute = new Date().getMinutes();
    
    for (const [meterId, meter] of this.meters) {
      // Simulate water flow
      const flow = this.simulateFlow(meterId, hour, minute);
      
      meter.currentFlow = flow;
      
      // Calculate consumption (30 seconds interval)
      const consumption = (flow * 0.5); // L/min * 0.5 min
      
      // Update totals
      if (consumption > 0) {
        meter.totalConsumption += consumption;
        meter.todayUsage += consumption;
        meter.weekUsage += consumption;
        meter.monthUsage += consumption;
      }
      
      meter.lastUpdate = Date.now();

      // Log usage
      if (consumption > 0) {
        this.logUsage({
          meterId,
          timestamp: Date.now(),
          flow,
          consumption,
          hour,
          minute
        });
      }
    }
  }

  simulateFlow(meterId, hour, minute) {
    const meter = this.meters.get(meterId);
    
    // No flow at night (23:00 - 05:00)
    if (hour >= 23 || hour <= 5) {
      // Occasional small leak simulation
      return Math.random() < 0.02 ? 0.5 : 0;
    }

    switch (meter.type) {
      case 'main':
        // Sum of all sub-meters
        return this.calculateMainFlow(hour);
      
      case 'room':
        if (meterId === 'bathroom') {
          return this.simulateBathroomFlow(hour, minute);
        } else if (meterId === 'kitchen') {
          return this.simulateKitchenFlow(hour, minute);
        }
        break;
      
      case 'appliance':
        if (meterId === 'washing_machine') {
          return this.simulateWashingMachineFlow(hour, minute);
        } else if (meterId === 'dishwasher') {
          return this.simulateDishwasherFlow(hour, minute);
        }
        break;
      
      case 'hot':
      case 'cold':
        // Calculated from main flow
        return this.calculateMainFlow(hour) * (meter.type === 'hot' ? 0.3 : 0.7);
    }

    return 0;
  }

  calculateMainFlow(_hour) {
    // Sum all room and appliance flows
    let total = 0;
    
    for (const [_meterId, meter] of this.meters) {
      if (meter.type === 'room' || meter.type === 'appliance') {
        total += meter.currentFlow;
      }
    }
    
    return total;
  }

  simulateBathroomFlow(hour, minute) {
    // Morning shower (06:00-08:00)
    if (hour === 6 || hour === 7) {
      if (minute >= 30 && minute <= 45) {
        return 8 + Math.random() * 2; // Shower: 8-10 L/min
      }
    }
    
    // Evening shower (21:00-22:00)
    if (hour === 21) {
      if (minute >= 0 && minute <= 15) {
        return 8 + Math.random() * 2;
      }
    }
    
    // Toilet flushes (random throughout day)
    if (hour >= 6 && hour <= 23) {
      if (Math.random() < 0.02) { // ~2% chance per check
        return 6; // Toilet flush: ~6 L/min
      }
    }
    
    // Sink usage
    if (hour >= 6 && hour <= 23) {
      if (Math.random() < 0.01) {
        return 4 + Math.random() * 2; // Sink: 4-6 L/min
      }
    }
    
    return 0;
  }

  simulateKitchenFlow(hour, _minute) {
    // Breakfast (07:00-08:00)
    if (hour === 7) {
      if (Math.random() < 0.03) {
        return 5 + Math.random() * 2; // Sink: 5-7 L/min
      }
    }
    
    // Dinner prep (17:00-19:00)
    if (hour >= 17 && hour <= 18) {
      if (Math.random() < 0.05) {
        return 6 + Math.random() * 3; // Cooking: 6-9 L/min
      }
    }
    
    // Dishes (after meals)
    if (hour === 8 || hour === 19) {
      if (Math.random() < 0.04) {
        return 5 + Math.random() * 2;
      }
    }
    
    return 0;
  }

  simulateWashingMachineFlow(hour, _minute) {
    // Laundry typically done during day (09:00-17:00)
    if (hour >= 9 && hour <= 17) {
      // Check if in middle of wash cycle
      if (Math.random() < 0.01) {
        return 12 + Math.random() * 3; // Washing: 12-15 L/min
      }
    }
    
    return 0;
  }

  simulateDishwasherFlow(hour, _minute) {
    // Dishwasher runs after dinner (20:00-21:00)
    if (hour === 20) {
      if (Math.random() < 0.02) {
        return 10 + Math.random() * 2; // Dishwasher: 10-12 L/min
      }
    }
    
    return 0;
  }

  // ============================================
  // LEAK DETECTION
  // ============================================

  async checkForLeaks() {
    const mainMeter = this.meters.get('main_meter');
    
    if (!mainMeter) return;

    const hour = new Date().getHours();
    
    // Check for continuous flow during night
    if (hour >= 23 || hour <= 5) {
      if (mainMeter.currentFlow > 0.3) {
        // Potential leak detected
        this.reportLeak({
          severity: mainMeter.currentFlow > 2 ? 'high' : 'medium',
          type: 'continuous_flow_night',
          flow: mainMeter.currentFlow,
          message: `Kontinuerligt vattenflöde upptäckt nattetid: ${mainMeter.currentFlow.toFixed(1)} L/min`,
          recommendations: [
            'Kontrollera alla kranar och toaletter',
            'Inspektera synliga rör',
            'Överväg att stänga huvudkranen',
            'Kontakta rörmokare om problemet kvarstår'
          ]
        });
      }
    }

    // Check for unusual high flow
    if (mainMeter.currentFlow > 50) {
      this.reportLeak({
        severity: 'critical',
        type: 'high_flow',
        flow: mainMeter.currentFlow,
        message: `Ovanligt högt vattenflöde: ${mainMeter.currentFlow.toFixed(1)} L/min`,
        recommendations: [
          '⚠️ AKUT: Stäng huvudkranen omedelbart',
          'Kontrollera för synliga läckor',
          'Kontakta rörmokare akut'
        ]
      });
    }

    // Check daily consumption against baseline
    const baseline = this.baselines.get('daily_average');
    
    if (baseline && mainMeter.todayUsage > baseline * 1.5) {
      this.reportLeak({
        severity: 'low',
        type: 'high_daily_usage',
        usage: mainMeter.todayUsage,
        expected: baseline,
        message: `Högre vattenförbrukning än normalt: ${Math.round(mainMeter.todayUsage)} L (normalt ${Math.round(baseline)} L)`,
        recommendations: [
          'Kontrollera för ovanlig användning',
          'Leta efter små läckor',
          'Verifiera att inga apparater kör onödigt'
        ]
      });
    }
  }

  reportLeak(leak) {
    leak.id = `leak_${Date.now()}`;
    leak.timestamp = Date.now();
    leak.acknowledged = false;
    leak.resolved = false;

    // Check if similar leak already reported
    const existing = this.leakAlerts.find(l => 
      !l.resolved && l.type === leak.type && 
      (Date.now() - l.timestamp) < 60 * 60 * 1000 // Within last hour
    );

    if (!existing) {
      this.leakAlerts.push(leak);
      
      logger.info(`💧 Leak Alert: ${leak.message}`);
      logger.info(`   Severity: ${leak.severity}`);
      
      // Trigger notification
      // this.app.notifications.send({
      //   title: 'Vattenläckage upptäckt',
      //   message: leak.message,
      //   priority: leak.severity,
      //   category: 'water_leak'
      // });
    }
  }

  // ============================================
  // BASELINES & LEARNING
  // ============================================

  async loadBaselines() {
    // Average daily consumption per person in Sweden: ~140 L/day
    this.baselines.set('daily_average', 420); // 3 people * 140 L
    this.baselines.set('weekly_average', 2940);
    this.baselines.set('monthly_average', 12600);

    // Per-room baselines
    this.baselines.set('bathroom_daily', 200); // Showers, toilet, sink
    this.baselines.set('kitchen_daily', 120); // Cooking, dishes
    this.baselines.set('washing_machine_cycle', 60); // Per cycle
    this.baselines.set('dishwasher_cycle', 12); // Per cycle

    // Hourly patterns
    this.baselines.set('hourly_pattern', {
      0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0,
      6: 35, 7: 50, 8: 40, 9: 15, 10: 10, 11: 10,
      12: 20, 13: 10, 14: 10, 15: 10, 16: 10, 17: 25,
      18: 40, 19: 35, 20: 30, 21: 25, 22: 15, 23: 5
    });
  }

  // ============================================
  // CONSERVATION GOALS
  // ============================================

  async loadConservationGoals() {
    this.conservationGoals.set('daily', {
      target: 350, // L/day (reduced from 420)
      current: 0,
      savings: 70, // L/day
      percentage: 16.7 // % reduction
    });

    this.conservationGoals.set('monthly', {
      target: 10500, // L/month
      current: 0,
      savings: 2100,
      percentage: 16.7
    });
  }

  async setConservationGoal(period, target) {
    const goal = this.conservationGoals.get(period);
    
    if (!goal) {
      return { success: false, error: 'Invalid period' };
    }

    const baseline = this.baselines.get(`${period}_average`);
    goal.target = target;
    goal.savings = baseline - target;
    goal.percentage = ((baseline - target) / baseline) * 100;

    return {
      success: true,
      goal: {
        period,
        target,
        savings: goal.savings,
        percentage: goal.percentage.toFixed(1)
      }
    };
  }

  // ============================================
  // CONSERVATION TIPS
  // ============================================

  getConservationTips() {
    const tips = [
      {
        category: 'shower',
        title: 'Kortare duschar',
        description: 'Minska duschtiden med 2 minuter',
        savings: '16 L per dusch',
        difficulty: 'easy',
        annualSavings: 11680 // 2 duschar/dag * 16 L * 365
      },
      {
        category: 'toilet',
        title: 'Toalett med dubbelspolning',
        description: 'Använd liten spolning när möjligt',
        savings: '3 L per spolning',
        difficulty: 'easy',
        annualSavings: 8760 // 8 spolningar/dag * 3 L * 365
      },
      {
        category: 'faucet',
        title: 'Stäng kranen',
        description: 'Stäng kranan när du borstar tänderna',
        savings: '6 L per gång',
        difficulty: 'easy',
        annualSavings: 4380 // 2 ggr/dag * 6 L * 365
      },
      {
        category: 'washing',
        title: 'Fulla maskiner',
        description: 'Kör tvättmaskinen endast när den är full',
        savings: '60 L per maskintvätt',
        difficulty: 'easy',
        annualSavings: 3120 // 1 ggr/vecka * 60 L * 52
      },
      {
        category: 'dishwasher',
        title: 'Maskindisk istället för handdisk',
        description: 'Moderna diskmaskiner är effektivare än handdisk',
        savings: '50 L per diskning',
        difficulty: 'medium',
        annualSavings: 18250 // 1 ggr/dag * 50 L * 365
      },
      {
        category: 'faucet',
        title: 'Luftare i kranar',
        description: 'Installera luftare för minskad vattenförbrukning',
        savings: '50% vattenbesparing',
        difficulty: 'medium',
        annualSavings: 21000 // Estimated
      },
      {
        category: 'leak',
        title: 'Fixa läckor omedelbart',
        description: 'En droppande kran kan slösa 20 L/dag',
        savings: '20 L per dag',
        difficulty: 'medium',
        annualSavings: 7300
      },
      {
        category: 'outdoor',
        title: 'Samla regnvatten',
        description: 'Använd regnvatten för bevattning',
        savings: 'Varierar',
        difficulty: 'hard',
        annualSavings: 10000 // Estimated for garden
      }
    ];

    return tips.sort((a, b) => b.annualSavings - a.annualSavings);
  }

  // ============================================
  // STATISTICS & REPORTING
  // ============================================

  getCurrentStatus() {
    const mainMeter = this.meters.get('main_meter');
    
    return {
      currentFlow: mainMeter.currentFlow.toFixed(1),
      todayUsage: Math.round(mainMeter.todayUsage),
      weekUsage: Math.round(mainMeter.weekUsage),
      monthUsage: Math.round(mainMeter.monthUsage),
      totalUsage: Math.round(mainMeter.totalConsumption),
      status: mainMeter.currentFlow > 0 ? 'flowing' : 'idle',
      leakAlerts: this.leakAlerts.filter(l => !l.resolved).length
    };
  }

  getMeterDetails(meterId) {
    const meter = this.meters.get(meterId);
    
    if (!meter) return null;

    return {
      id: meter.id,
      name: meter.name,
      location: meter.location,
      type: meter.type,
      currentFlow: meter.currentFlow.toFixed(1),
      todayUsage: Math.round(meter.todayUsage),
      weekUsage: Math.round(meter.weekUsage),
      monthUsage: Math.round(meter.monthUsage),
      totalUsage: Math.round(meter.totalConsumption)
    };
  }

  getAllMeters() {
    return Array.from(this.meters.values()).map(m => ({
      id: m.id,
      name: m.name,
      type: m.type,
      location: m.location,
      currentFlow: m.currentFlow.toFixed(1),
      todayUsage: Math.round(m.todayUsage)
    }));
  }

  getDailyBreakdown() {
    const meters = Array.from(this.meters.values())
      .filter(m => m.type === 'room' || m.type === 'appliance');

    return meters.map(m => ({
      name: m.name,
      usage: Math.round(m.todayUsage),
      percentage: ((m.todayUsage / this.meters.get('main_meter').todayUsage) * 100).toFixed(1)
    })).sort((a, b) => b.usage - a.usage);
  }

  getConservationProgress() {
    const mainMeter = this.meters.get('main_meter');
    const dailyGoal = this.conservationGoals.get('daily');
    const monthlyGoal = this.conservationGoals.get('monthly');

    return {
      today: {
        usage: Math.round(mainMeter.todayUsage),
        target: dailyGoal.target,
        percentage: ((mainMeter.todayUsage / dailyGoal.target) * 100).toFixed(0),
        onTrack: mainMeter.todayUsage <= dailyGoal.target
      },
      month: {
        usage: Math.round(mainMeter.monthUsage),
        target: monthlyGoal.target,
        percentage: ((mainMeter.monthUsage / monthlyGoal.target) * 100).toFixed(0),
        onTrack: mainMeter.monthUsage <= monthlyGoal.target
      },
      potentialSavings: this.calculatePotentialSavings()
    };
  }

  calculatePotentialSavings() {
    const tips = this.getConservationTips();
    const easyTips = tips.filter(t => t.difficulty === 'easy');
    
    const totalAnnualSavings = easyTips.reduce((sum, tip) => sum + tip.annualSavings, 0);
    const waterCost = 35; // SEK per m³
    const costSavings = (totalAnnualSavings / 1000) * waterCost;

    return {
      liters: Math.round(totalAnnualSavings),
      cost: Math.round(costSavings),
      tips: easyTips.length
    };
  }

  getLeakAlerts() {
    return this.leakAlerts
      .filter(l => !l.resolved)
      .sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });
  }

  async acknowledgeAlert(alertId) {
    const alert = this.leakAlerts.find(a => a.id === alertId);
    
    if (!alert) {
      return { success: false, error: 'Alert not found' };
    }

    alert.acknowledged = true;
    alert.acknowledgedAt = Date.now();

    return { success: true };
  }

  async resolveAlert(alertId, resolution) {
    const alert = this.leakAlerts.find(a => a.id === alertId);
    
    if (!alert) {
      return { success: false, error: 'Alert not found' };
    }

    alert.resolved = true;
    alert.resolvedAt = Date.now();
    alert.resolution = resolution;

    return { success: true };
  }

  getHistoricalData(hours = 24) {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    
    return this.usageHistory
      .filter(u => u.timestamp >= cutoff)
      .map(u => ({
        timestamp: u.timestamp,
        meterId: u.meterId,
        flow: u.flow.toFixed(1),
        consumption: u.consumption.toFixed(1)
      }));
  }

  calculateDailyStats() {
    // Reset daily counters
    for (const meter of this.meters.values()) {
      meter.todayUsage = 0;
    }

    logger.info('Daily water statistics reset');
  }

  logUsage(usage) {
    this.usageHistory.push(usage);

    // Keep last 24 hours (at 30-second intervals = 2880 records)
    if (this.usageHistory.length > 2880) {
      this.usageHistory = this.usageHistory.slice(-2880);
    }
  }

  destroy() {
    if (this._intervals) {
      this._intervals.forEach(id => clearInterval(id));
      this._intervals = [];
    }
  }
}

module.exports = WaterConsumptionMonitor;
