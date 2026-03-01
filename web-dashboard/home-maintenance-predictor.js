'use strict';
const logger = require('./logger');
const MAX_ENTRIES = 1000;

/**
 * Home Maintenance Predictor
 * Predictive maintenance and home care management
 */
class HomeMaintenancePredictor {
  constructor(app) {
    this._intervals = [];
    this._timeouts = [];
    this.app = app;
    this.systems = new Map();
    this.maintenanceTasks = new Map();
    this.maintenanceHistory = [];
    this.inspections = [];
    this.contractors = new Map();
    this.warranties = new Map();
    this.predictions = [];
  }

  async initialize() {
    await this.setupHomeSystems();
    await this.setupMaintenanceTasks();
    await this.setupContractors();
    await this.setupWarranties();
    
    this.startMonitoring();
  }

  // ============================================
  // HOME SYSTEMS
  // ============================================

  async setupHomeSystems() {
    const systemsData = [
      {
        id: 'hvac',
        name: 'HVAC System',
        category: 'climate',
        installedDate: Date.now() - 5 * 365 * 24 * 60 * 60 * 1000, // 5 years ago
        expectedLifespan: 15, // years
        lastService: Date.now() - 180 * 24 * 60 * 60 * 1000, // 6 months ago
        serviceInterval: 365, // days
        condition: 'good',
        criticalityLevel: 'high'
      },
      {
        id: 'water_heater',
        name: 'Varmvattenberedare',
        category: 'plumbing',
        installedDate: Date.now() - 8 * 365 * 24 * 60 * 60 * 1000,
        expectedLifespan: 12,
        lastService: Date.now() - 400 * 24 * 60 * 60 * 1000,
        serviceInterval: 365,
        condition: 'fair',
        criticalityLevel: 'high'
      },
      {
        id: 'roof',
        name: 'Tak',
        category: 'structure',
        installedDate: Date.now() - 12 * 365 * 24 * 60 * 60 * 1000,
        expectedLifespan: 25,
        lastInspection: Date.now() - 730 * 24 * 60 * 60 * 1000, // 2 years
        inspectionInterval: 730,
        condition: 'good',
        criticalityLevel: 'critical'
      },
      {
        id: 'plumbing',
        name: 'Rörsystem',
        category: 'plumbing',
        installedDate: Date.now() - 15 * 365 * 24 * 60 * 60 * 1000,
        expectedLifespan: 50,
        lastInspection: Date.now() - 365 * 24 * 60 * 60 * 1000,
        inspectionInterval: 1825, // 5 years
        condition: 'good',
        criticalityLevel: 'high'
      },
      {
        id: 'electrical',
        name: 'Elsystem',
        category: 'electrical',
        installedDate: Date.now() - 20 * 365 * 24 * 60 * 60 * 1000,
        expectedLifespan: 40,
        lastInspection: Date.now() - 1095 * 24 * 60 * 60 * 1000, // 3 years
        inspectionInterval: 1825,
        condition: 'fair',
        criticalityLevel: 'critical'
      },
      {
        id: 'windows',
        name: 'Fönster',
        category: 'structure',
        installedDate: Date.now() - 10 * 365 * 24 * 60 * 60 * 1000,
        expectedLifespan: 30,
        lastService: Date.now() - 365 * 24 * 60 * 60 * 1000,
        serviceInterval: 365,
        condition: 'good',
        criticalityLevel: 'medium'
      },
      {
        id: 'foundation',
        name: 'Grund',
        category: 'structure',
        installedDate: Date.now() - 30 * 365 * 24 * 60 * 60 * 1000,
        expectedLifespan: 100,
        lastInspection: Date.now() - 3650 * 24 * 60 * 60 * 1000, // 10 years
        inspectionInterval: 3650,
        condition: 'good',
        criticalityLevel: 'critical'
      },
      {
        id: 'appliances',
        name: 'Vitvaror',
        category: 'appliances',
        installedDate: Date.now() - 3 * 365 * 24 * 60 * 60 * 1000,
        expectedLifespan: 10,
        lastService: Date.now() - 180 * 24 * 60 * 60 * 1000,
        serviceInterval: 365,
        condition: 'excellent',
        criticalityLevel: 'medium'
      }
    ];

    for (const system of systemsData) {
      this.systems.set(system.id, {
        ...system,
        usageHours: 0,
        faultHistory: [],
        maintenanceCost: 0,
        healthScore: this.calculateSystemHealth(system)
      });
    }
  }

  calculateSystemHealth(system) {
    const age = (Date.now() - system.installedDate) / (365 * 24 * 60 * 60 * 1000);
    const agePercent = (age / system.expectedLifespan) * 100;
    
    let health = 100;

    // Age impact
    if (agePercent > 80) health -= 30;
    else if (agePercent > 60) health -= 20;
    else if (agePercent > 40) health -= 10;

    // Condition impact
    const conditionScores = {
      excellent: 0,
      good: -5,
      fair: -15,
      poor: -30,
      critical: -50
    };
    health += conditionScores[system.condition] || 0;

    // Service overdue impact
    if (system.lastService) {
      const daysSinceService = (Date.now() - system.lastService) / (24 * 60 * 60 * 1000);
      if (daysSinceService > system.serviceInterval * 1.5) {
        health -= 15;
      }
    }

    return Math.max(0, Math.min(100, health));
  }

  // ============================================
  // MAINTENANCE TASKS
  // ============================================

  async setupMaintenanceTasks() {
    const tasksData = [
      // Regular maintenance
      {
        id: 'hvac_filter',
        name: 'Byt HVAC-filter',
        system: 'hvac',
        frequency: 90, // days
        duration: 15, // minutes
        difficulty: 'easy',
        cost: 150,
        priority: 'medium',
        season: null
      },
      {
        id: 'hvac_annual',
        name: 'Årlig HVAC-service',
        system: 'hvac',
        frequency: 365,
        duration: 120,
        difficulty: 'professional',
        cost: 2500,
        priority: 'high',
        season: 'spring'
      },
      {
        id: 'gutter_clean',
        name: 'Rensa takrännor',
        system: 'roof',
        frequency: 180,
        duration: 120,
        difficulty: 'medium',
        cost: 800,
        priority: 'medium',
        season: 'autumn'
      },
      {
        id: 'water_heater_flush',
        name: 'Spola varmvattenberedare',
        system: 'water_heater',
        frequency: 365,
        duration: 60,
        difficulty: 'medium',
        cost: 500,
        priority: 'high',
        season: null
      },
      {
        id: 'window_service',
        name: 'Fönsterservice',
        system: 'windows',
        frequency: 365,
        duration: 180,
        difficulty: 'easy',
        cost: 300,
        priority: 'low',
        season: 'spring'
      },
      {
        id: 'smoke_detector_test',
        name: 'Testa brandvarnare',
        system: 'electrical',
        frequency: 180,
        duration: 30,
        difficulty: 'easy',
        cost: 0,
        priority: 'high',
        season: null
      },
      {
        id: 'drain_clean',
        name: 'Rensa avlopp',
        system: 'plumbing',
        frequency: 180,
        duration: 45,
        difficulty: 'easy',
        cost: 200,
        priority: 'medium',
        season: null
      },
      {
        id: 'exterior_paint',
        name: 'Måla fasad',
        system: 'structure',
        frequency: 2555, // 7 years
        duration: 2880, // 2 days
        difficulty: 'professional',
        cost: 45000,
        priority: 'medium',
        season: 'summer'
      }
    ];

    for (const task of tasksData) {
      this.maintenanceTasks.set(task.id, {
        ...task,
        lastCompleted: null,
        nextDue: this.calculateNextDue(task),
        status: 'pending'
      });
    }
  }

  calculateNextDue(task) {
    if (task.lastCompleted) {
      return task.lastCompleted + task.frequency * 24 * 60 * 60 * 1000;
    }

    // If seasonal, schedule for appropriate season
    if (task.season) {
      const now = new Date();
      const _currentMonth = now.getMonth();
      
      const seasonMonths = {
        spring: 3, // April
        summer: 6, // July
        autumn: 9, // October
        winter: 0  // January
      };

      const targetMonth = seasonMonths[task.season];
      const nextDate = new Date(now.getFullYear(), targetMonth, 15);
      
      if (nextDate < now) {
        nextDate.setFullYear(nextDate.getFullYear() + 1);
      }

      return nextDate.getTime();
    }

    // Default: schedule within frequency period
    return Date.now() + task.frequency * 24 * 60 * 60 * 1000;
  }

  async completeTask(taskId, data = {}) {
    const task = this.maintenanceTasks.get(taskId);
    
    if (!task) {
      return { success: false, error: 'Task not found' };
    }

    task.lastCompleted = Date.now();
    task.nextDue = this.calculateNextDue(task);
    task.status = 'completed';

    // Log to history
    this.maintenanceHistory.push({
      id: `history_${Date.now()}`,
      taskId,
      taskName: task.name,
      system: task.system,
      completedDate: Date.now(),
      cost: data.actualCost || task.cost,
      duration: data.actualDuration || task.duration,
      notes: data.notes || null,
      contractor: data.contractor || null
    });
    if (this.maintenanceHistory.length > MAX_ENTRIES) this.maintenanceHistory.shift();

    // Update system
    const system = this.systems.get(task.system);
    if (system) {
      system.lastService = Date.now();
      system.maintenanceCost += data.actualCost || task.cost;
      system.healthScore = this.calculateSystemHealth(system);
    }

    logger.info(`✅ Completed: ${task.name} (Cost: ${data.actualCost || task.cost} SEK)`);

    // Reset status after logging
    this._timeouts.push(setTimeout(() => {
      task.status = 'pending';
    }, 1000));

    return { success: true, task };
  }

  // ============================================
  // PREDICTIVE ANALYSIS
  // ============================================

  async analyzeSystems() {
    logger.info('🔍 Analyzing home systems...');

    const predictions = [];

    for (const [systemId, system] of this.systems) {
      const age = (Date.now() - system.installedDate) / (365 * 24 * 60 * 60 * 1000);
      const lifeRemaining = system.expectedLifespan - age;
      const healthScore = system.healthScore;

      // Predict failure risk
      let failureRisk = 'low';
      let timeToFailure = lifeRemaining;

      if (healthScore < 40) {
        failureRisk = 'critical';
        timeToFailure = 0.5; // 6 months
      } else if (healthScore < 60) {
        failureRisk = 'high';
        timeToFailure = 1; // 1 year
      } else if (lifeRemaining < 2) {
        failureRisk = 'medium';
        timeToFailure = lifeRemaining;
      }

      if (failureRisk !== 'low') {
        predictions.push({
          system: system.name,
          systemId,
          currentHealth: healthScore,
          failureRisk,
          estimatedYearsRemaining: timeToFailure.toFixed(1),
          replacementCost: this.estimateReplacementCost(system),
          recommendedAction: this.getRecommendedAction(system, failureRisk),
          priority: system.criticalityLevel
        });

        logger.info(`  ⚠️ ${system.name}: ${failureRisk} risk (Health: ${healthScore}%)`);
      }

      // Check overdue maintenance
      if (system.lastService) {
        const daysSinceService = (Date.now() - system.lastService) / (24 * 60 * 60 * 1000);
        if (daysSinceService > system.serviceInterval * 1.2) {
          logger.info(`  📅 ${system.name}: Service overdue by ${Math.round(daysSinceService - system.serviceInterval)} days`);
        }
      }
    }

    this.predictions = predictions;

    return predictions;
  }

  estimateReplacementCost(system) {
    const costs = {
      hvac: 85000,
      water_heater: 25000,
      roof: 180000,
      plumbing: 120000,
      electrical: 150000,
      windows: 95000,
      foundation: 350000,
      appliances: 35000
    };

    return costs[system.id] || 50000;
  }

  getRecommendedAction(system, risk) {
    if (risk === 'critical') {
      return 'Byt omedelbart eller inom 6 månader';
    } else if (risk === 'high') {
      return 'Planera byte inom närmaste året';
    } else if (risk === 'medium') {
      return 'Övervaka noga och planera framtida byte';
    }
    return 'Fortsätt regelbundet underhåll';
  }

  async predictMaintenanceCosts(years = 5) {
    logger.info(`💰 Predicting maintenance costs for next ${years} years...`);

    const yearlyPredictions = [];

    for (let year = 1; year <= years; year++) {
      let totalCost = 0;
      const events = [];

      // Regular maintenance
      for (const [_taskId, task] of this.maintenanceTasks) {
        const occurrencesPerYear = 365 / task.frequency;
        const yearlyCost = task.cost * occurrencesPerYear;
        totalCost += yearlyCost;

        if (yearlyCost > 1000) {
          events.push({
            task: task.name,
            frequency: occurrencesPerYear.toFixed(1),
            cost: Math.round(yearlyCost)
          });
        }
      }

      // Predicted replacements
      for (const [_systemId, system] of this.systems) {
        const age = (Date.now() - system.installedDate) / (365 * 24 * 60 * 60 * 1000);
        const yearsUntilReplacement = system.expectedLifespan - age;

        if (yearsUntilReplacement <= year && yearsUntilReplacement > year - 1) {
          const replacementCost = this.estimateReplacementCost(system);
          totalCost += replacementCost;

          events.push({
            task: `Replace ${system.name}`,
            frequency: 'one-time',
            cost: replacementCost
          });

          logger.info(`  Year ${year}: Replace ${system.name} (~${replacementCost} SEK)`);
        }
      }

      yearlyPredictions.push({
        year,
        totalCost: Math.round(totalCost),
        events
      });
    }

    return yearlyPredictions;
  }

  // ============================================
  // CONTRACTORS
  // ============================================

  async setupContractors() {
    const contractorData = [
      {
        id: 'hvac_pro',
        name: 'Nordic HVAC Service AB',
        specialty: 'hvac',
        rating: 4.7,
        priceLevel: 'medium',
        phone: '08-123 456 78',
        lastUsed: Date.now() - 180 * 24 * 60 * 60 * 1000
      },
      {
        id: 'plumber_pro',
        name: 'Rörmokare Stockholm',
        specialty: 'plumbing',
        rating: 4.5,
        priceLevel: 'medium',
        phone: '08-234 567 89',
        lastUsed: null
      },
      {
        id: 'electrician',
        name: 'Elservice Syd',
        specialty: 'electrical',
        rating: 4.8,
        priceLevel: 'high',
        phone: '08-345 678 90',
        lastUsed: Date.now() - 365 * 24 * 60 * 60 * 1000
      },
      {
        id: 'roofer',
        name: 'Takläggare AB',
        specialty: 'roofing',
        rating: 4.6,
        priceLevel: 'medium',
        phone: '08-456 789 01',
        lastUsed: null
      },
      {
        id: 'general',
        name: 'Allround Hantverkare',
        specialty: 'general',
        rating: 4.3,
        priceLevel: 'low',
        phone: '08-567 890 12',
        lastUsed: Date.now() - 90 * 24 * 60 * 60 * 1000
      }
    ];

    for (const contractor of contractorData) {
      this.contractors.set(contractor.id, {
        ...contractor,
        jobsCompleted: 0,
        totalPaid: 0
      });
    }
  }

  async recommendContractor(system) {
    const categoryMap = {
      hvac: 'hvac',
      plumbing: 'plumbing',
      electrical: 'electrical',
      structure: 'general'
    };

    const category = categoryMap[this.systems.get(system)?.category] || 'general';

    const suitable = Array.from(this.contractors.values())
      .filter(c => c.specialty === category || c.specialty === 'general')
      .sort((a, b) => b.rating - a.rating);

    if (suitable.length > 0) {
      return {
        primary: suitable[0],
        alternatives: suitable.slice(1, 3)
      };
    }

    return null;
  }

  // ============================================
  // WARRANTIES
  // ============================================

  async setupWarranties() {
    const warrantyData = [
      {
        id: 'hvac_warranty',
        system: 'hvac',
        provider: 'Nordic HVAC Service AB',
        startDate: Date.now() - 5 * 365 * 24 * 60 * 60 * 1000,
        duration: 5, // years
        coverage: 'parts_and_labor',
        cost: 12000
      },
      {
        id: 'appliance_warranty',
        system: 'appliances',
        provider: 'ElGiganten',
        startDate: Date.now() - 3 * 365 * 24 * 60 * 60 * 1000,
        duration: 5,
        coverage: 'parts_and_labor',
        cost: 3500
      },
      {
        id: 'roof_warranty',
        system: 'roof',
        provider: 'Takläggare AB',
        startDate: Date.now() - 12 * 365 * 24 * 60 * 60 * 1000,
        duration: 20,
        coverage: 'workmanship',
        cost: 8000
      }
    ];

    for (const warranty of warrantyData) {
      const expiryDate = warranty.startDate + warranty.duration * 365 * 24 * 60 * 60 * 1000;
      
      this.warranties.set(warranty.id, {
        ...warranty,
        expiryDate,
        daysRemaining: Math.ceil((expiryDate - Date.now()) / (24 * 60 * 60 * 1000)),
        active: expiryDate > Date.now()
      });
    }
  }

  // ============================================
  // MONITORING
  // ============================================

  startMonitoring() {
    // Check maintenance tasks daily
    this._intervals.push(setInterval(() => {
      this.checkMaintenanceTasks();
    }, 24 * 60 * 60 * 1000));

    // Analyze systems weekly
    this._intervals.push(setInterval(() => {
      const day = new Date().getDay();
      if (day === 0) { // Sunday
        this.analyzeSystems();
      }
    }, 24 * 60 * 60 * 1000));

    // Check warranties monthly
    this._intervals.push(setInterval(() => {
      const date = new Date().getDate();
      if (date === 1) {
        this.checkWarranties();
      }
    }, 24 * 60 * 60 * 1000));

    // Initial analysis
    this.analyzeSystems();
  }

  async checkMaintenanceTasks() {
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;

    for (const [_taskId, task] of this.maintenanceTasks) {
      if (task.status === 'completed') continue;

      const daysUntilDue = Math.ceil((task.nextDue - now) / (24 * 60 * 60 * 1000));

      if (task.nextDue <= now) {
        logger.info(`⚠️ OVERDUE: ${task.name} (${Math.abs(daysUntilDue)} days overdue)`);
      } else if (task.nextDue - now <= thirtyDays) {
        logger.info(`📅 Upcoming: ${task.name} (${daysUntilDue} days until due)`);
      }
    }
  }

  async checkWarranties() {
    logger.info('📜 Checking warranties...');

    for (const [_warrantyId, warranty] of this.warranties) {
      if (warranty.daysRemaining < 90 && warranty.active) {
        logger.info(`⚠️ Warranty expiring soon: ${this.systems.get(warranty.system)?.name} (${warranty.daysRemaining} days)`);
      }

      if (!warranty.active) {
        logger.info(`  ❌ Expired: ${this.systems.get(warranty.system)?.name} warranty`);
      }
    }
  }

  // ============================================
  // REPORTING & ANALYTICS
  // ============================================

  getMaintenanceOverview() {
    const tasks = Array.from(this.maintenanceTasks.values());
    const overdue = tasks.filter(t => t.nextDue < Date.now() && t.status === 'pending');
    const upcoming30Days = tasks.filter(t => {
      const daysUntilDue = (t.nextDue - Date.now()) / (24 * 60 * 60 * 1000);
      return daysUntilDue > 0 && daysUntilDue <= 30;
    });

    const systems = Array.from(this.systems.values());
    const criticalSystems = systems.filter(s => s.healthScore < 60);

    return {
      totalTasks: tasks.length,
      overdueTasks: overdue.length,
      upcomingTasks: upcoming30Days.length,
      criticalSystems: criticalSystems.length,
      overdueTasks: overdue.map(t => ({
        name: t.name,
        daysOverdue: Math.ceil((Date.now() - t.nextDue) / (24 * 60 * 60 * 1000)),
        priority: t.priority
      })),
      upcomingTasks: upcoming30Days.map(t => ({
        name: t.name,
        dueDate: new Date(t.nextDue).toLocaleDateString('sv-SE'),
        priority: t.priority
      }))
    };
  }

  getSystemHealthReport() {
    const systems = [];

    for (const [_systemId, system] of this.systems) {
      const age = ((Date.now() - system.installedDate) / (365 * 24 * 60 * 60 * 1000)).toFixed(1);
      const lifeRemaining = (system.expectedLifespan - parseFloat(age)).toFixed(1);

      systems.push({
        name: system.name,
        age: `${age} years`,
        healthScore: system.healthScore,
        condition: system.condition,
        lifeRemaining: `${lifeRemaining} years`,
        criticalityLevel: system.criticalityLevel,
        status: system.healthScore >= 80 ? 'excellent' :
                system.healthScore >= 60 ? 'good' :
                system.healthScore >= 40 ? 'fair' : 'poor'
      });
    }

    return systems.sort((a, b) => a.healthScore - b.healthScore);
  }

  getMaintenanceHistory(months = 12) {
    const cutoff = Date.now() - months * 30 * 24 * 60 * 60 * 1000;
    const history = this.maintenanceHistory.filter(h => h.completedDate >= cutoff);

    const totalCost = history.reduce((sum, h) => sum + h.cost, 0);
    const bySystem = {};

    for (const record of history) {
      if (!bySystem[record.system]) {
        bySystem[record.system] = {
          count: 0,
          cost: 0
        };
      }
      bySystem[record.system].count += 1;
      bySystem[record.system].cost += record.cost;
    }

    return {
      period: `${months} months`,
      totalRecords: history.length,
      totalCost: Math.round(totalCost),
      averageCostPerTask: history.length > 0 ? Math.round(totalCost / history.length) : 0,
      bySystem,
      recentTasks: history.slice(-10).reverse().map(h => ({
        date: new Date(h.completedDate).toLocaleDateString('sv-SE'),
        task: h.taskName,
        cost: h.cost
      }))
    };
  }

  getMaintenanceCalendar(months = 6) {
    const calendar = [];
    const now = Date.now();

    for (let month = 0; month < months; month++) {
      const monthStart = now + month * 30 * 24 * 60 * 60 * 1000;
      const monthEnd = monthStart + 30 * 24 * 60 * 60 * 1000;

      const monthTasks = Array.from(this.maintenanceTasks.values())
        .filter(t => t.nextDue >= monthStart && t.nextDue < monthEnd);

      if (monthTasks.length > 0) {
        calendar.push({
          month: new Date(monthStart).toLocaleDateString('sv-SE', { year: 'numeric', month: 'long' }),
          tasks: monthTasks.map(t => ({
            name: t.name,
            date: new Date(t.nextDue).toLocaleDateString('sv-SE'),
            cost: t.cost,
            difficulty: t.difficulty
          })),
          estimatedCost: monthTasks.reduce((sum, t) => sum + t.cost, 0)
        });
      }
    }

    return calendar;
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

module.exports = HomeMaintenancePredictor;
