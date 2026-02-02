'use strict';

/**
 * Energy Budget Manager
 * Set, track, and manage energy consumption budgets
 */
class EnergyBudgetManager {
  constructor(app) {
    this.app = app;
    this.budgets = new Map();
    this.consumptionHistory = [];
    this.alerts = [];
    this.recommendations = [];
  }

  async initialize() {
    // Load existing budgets
    await this.loadBudgets();
    
    // Start consumption tracking
    this.startConsumptionTracking();
    
    // Start budget monitoring
    this.startBudgetMonitoring();
  }

  // ============================================
  // BUDGET MANAGEMENT
  // ============================================

  async loadBudgets() {
    // Load from storage or create defaults
    const defaultBudgets = [
      {
        id: 'daily',
        name: 'Daglig Budget',
        period: 'daily',
        limit: 25, // kWh
        limitType: 'energy', // energy, cost
        enabled: true,
        alertThresholds: [0.8, 0.9, 1.0] // 80%, 90%, 100%
      },
      {
        id: 'weekly',
        name: 'Veckobudget',
        period: 'weekly',
        limit: 150, // kWh
        limitType: 'energy',
        enabled: true,
        alertThresholds: [0.8, 0.9, 1.0]
      },
      {
        id: 'monthly',
        name: 'Månadsbudget',
        period: 'monthly',
        limit: 600, // kWh
        limitType: 'energy',
        enabled: true,
        alertThresholds: [0.75, 0.9, 1.0]
      },
      {
        id: 'monthly_cost',
        name: 'Kostnadsbudget',
        period: 'monthly',
        limit: 2000, // SEK
        limitType: 'cost',
        enabled: true,
        alertThresholds: [0.75, 0.9, 1.0]
      }
    ];

    for (const budget of defaultBudgets) {
      this.budgets.set(budget.id, {
        ...budget,
        current: 0,
        percentage: 0,
        remaining: budget.limit,
        startDate: this.getPeriodStart(budget.period),
        endDate: this.getPeriodEnd(budget.period),
        status: 'on_track', // on_track, approaching, exceeded
        history: []
      });
    }
  }

  async createBudget(config) {
    const budgetId = config.id || `budget_${Date.now()}`;
    
    const budget = {
      id: budgetId,
      name: config.name,
      period: config.period,
      limit: config.limit,
      limitType: config.limitType || 'energy',
      enabled: config.enabled !== false,
      alertThresholds: config.alertThresholds || [0.8, 0.9, 1.0],
      current: 0,
      percentage: 0,
      remaining: config.limit,
      startDate: this.getPeriodStart(config.period),
      endDate: this.getPeriodEnd(config.period),
      status: 'on_track',
      history: []
    };

    this.budgets.set(budgetId, budget);

    return {
      success: true,
      budget: {
        id: budget.id,
        name: budget.name
      }
    };
  }

  async updateBudget(budgetId, updates) {
    const budget = this.budgets.get(budgetId);
    
    if (!budget) {
      return { success: false, error: 'Budget not found' };
    }

    // Apply updates
    Object.assign(budget, updates);
    
    // Recalculate if limit changed
    if (updates.limit) {
      budget.remaining = updates.limit - budget.current;
      budget.percentage = (budget.current / updates.limit) * 100;
      this.updateBudgetStatus(budgetId);
    }

    return {
      success: true,
      budget
    };
  }

  async deleteBudget(budgetId) {
    if (this.budgets.has(budgetId)) {
      this.budgets.delete(budgetId);
      return { success: true };
    }
    return { success: false, error: 'Budget not found' };
  }

  // ============================================
  // CONSUMPTION TRACKING
  // ============================================

  startConsumptionTracking() {
    // Track consumption every 5 minutes
    setInterval(() => {
      this.updateConsumption();
    }, 5 * 60 * 1000);

    // Initial update
    this.updateConsumption();
  }

  async updateConsumption() {
    // Simulate consumption reading (integrate with actual meter)
    const currentPower = 2.0 + Math.random() * 2.0; // kW
    const energyIncrement = (currentPower * 5) / 60; // kWh for 5 minutes
    const pricePerKWh = 1.50; // SEK
    const costIncrement = energyIncrement * pricePerKWh;

    // Record consumption
    this.consumptionHistory.push({
      timestamp: Date.now(),
      power: currentPower,
      energy: energyIncrement,
      cost: costIncrement
    });

    // Trim history (keep last 10000 records)
    if (this.consumptionHistory.length > 10000) {
      this.consumptionHistory = this.consumptionHistory.slice(-10000);
    }

    // Update all active budgets
    for (const [budgetId, budget] of this.budgets) {
      if (!budget.enabled) continue;

      // Check if budget period is still valid
      if (Date.now() > budget.endDate) {
        this.resetBudget(budgetId);
      }

      // Add consumption to budget
      if (budget.limitType === 'energy') {
        budget.current += energyIncrement;
      } else if (budget.limitType === 'cost') {
        budget.current += costIncrement;
      }

      budget.remaining = Math.max(0, budget.limit - budget.current);
      budget.percentage = (budget.current / budget.limit) * 100;

      // Update status
      this.updateBudgetStatus(budgetId);
    }
  }

  updateBudgetStatus(budgetId) {
    const budget = this.budgets.get(budgetId);
    const percentage = budget.percentage;

    if (percentage >= 100) {
      budget.status = 'exceeded';
      this.triggerAlert(budgetId, 'exceeded');
    } else if (percentage >= 90) {
      budget.status = 'critical';
      if (!this.hasRecentAlert(budgetId, 1.0)) {
        this.triggerAlert(budgetId, 'threshold', 1.0);
      }
    } else if (percentage >= 80) {
      budget.status = 'approaching';
      if (!this.hasRecentAlert(budgetId, 0.9)) {
        this.triggerAlert(budgetId, 'threshold', 0.9);
      }
    } else {
      budget.status = 'on_track';
    }
  }

  resetBudget(budgetId) {
    const budget = this.budgets.get(budgetId);
    
    // Save to history
    budget.history.push({
      period: {
        start: budget.startDate,
        end: budget.endDate
      },
      consumption: budget.current,
      limit: budget.limit,
      percentage: budget.percentage,
      status: budget.status
    });

    // Trim history (keep last 12 periods)
    if (budget.history.length > 12) {
      budget.history = budget.history.slice(-12);
    }

    // Reset for new period
    budget.current = 0;
    budget.percentage = 0;
    budget.remaining = budget.limit;
    budget.startDate = this.getPeriodStart(budget.period);
    budget.endDate = this.getPeriodEnd(budget.period);
    budget.status = 'on_track';
  }

  // ============================================
  // BUDGET MONITORING
  // ============================================

  startBudgetMonitoring() {
    // Check budgets every hour
    setInterval(() => {
      this.monitorBudgets();
    }, 60 * 60 * 1000);

    // Initial monitoring
    this.monitorBudgets();
  }

  async monitorBudgets() {
    for (const [budgetId, budget] of this.budgets) {
      if (!budget.enabled) continue;

      // Generate projections
      const projection = this.projectConsumption(budget);
      budget.projection = projection;

      // Generate recommendations if approaching limit
      if (budget.percentage > 70) {
        this.generateRecommendations(budgetId);
      }
    }
  }

  projectConsumption(budget) {
    const now = Date.now();
    const elapsed = now - budget.startDate;
    const remaining = budget.endDate - now;
    const total = budget.endDate - budget.startDate;
    
    // Current consumption rate
    const currentRate = budget.current / elapsed;
    
    // Projected total consumption
    const projected = currentRate * total;
    
    // Days remaining
    const daysRemaining = Math.ceil(remaining / (24 * 60 * 60 * 1000));
    
    return {
      projected: Math.round(projected * 100) / 100,
      projectedPercentage: (projected / budget.limit) * 100,
      willExceed: projected > budget.limit,
      daysRemaining,
      recommendedDailyLimit: budget.limitType === 'energy' 
        ? Math.round((budget.remaining / daysRemaining) * 10) / 10
        : Math.round(budget.remaining / daysRemaining)
    };
  }

  // ============================================
  // ALERTS
  // ============================================

  triggerAlert(budgetId, type, threshold = null) {
    const budget = this.budgets.get(budgetId);
    
    let message = '';
    let severity = 'info';

    if (type === 'exceeded') {
      message = `${budget.name}: Budget överskriden! ${Math.round(budget.current)} / ${budget.limit} ${budget.limitType === 'energy' ? 'kWh' : 'SEK'}`;
      severity = 'critical';
    } else if (type === 'threshold') {
      const percentage = Math.round(threshold * 100);
      message = `${budget.name}: ${percentage}% av budget använd (${Math.round(budget.current)} / ${budget.limit} ${budget.limitType === 'energy' ? 'kWh' : 'SEK'})`;
      severity = threshold >= 0.9 ? 'high' : 'medium';
    }

    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      budgetId,
      budgetName: budget.name,
      type,
      threshold,
      message,
      severity,
      status: 'active'
    };

    this.alerts.push(alert);

    // Trim old alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }

    console.log(`🚨 Budget Alert: ${message}`);

    return alert;
  }

  hasRecentAlert(budgetId, threshold) {
    const recentTime = Date.now() - 24 * 60 * 60 * 1000; // Last 24 hours
    
    return this.alerts.some(a => 
      a.budgetId === budgetId && 
      a.threshold === threshold && 
      a.timestamp >= recentTime &&
      a.status === 'active'
    );
  }

  // ============================================
  // RECOMMENDATIONS
  // ============================================

  generateRecommendations(budgetId) {
    const budget = this.budgets.get(budgetId);
    const recommendations = [];

    // Check if on track to exceed
    if (budget.projection && budget.projection.willExceed) {
      const excessAmount = Math.round(budget.projection.projected - budget.limit);
      
      recommendations.push({
        id: `rec_${Date.now()}_1`,
        budgetId,
        type: 'reduce_consumption',
        priority: 'high',
        title: 'Minska förbrukning',
        description: `Du är på väg att överskrida budgeten med ${excessAmount} ${budget.limitType === 'energy' ? 'kWh' : 'SEK'}`,
        actions: [
          {
            action: 'adjust_thermostat',
            description: 'Sänk värmen med 1°C',
            impact: '~15% besparingar'
          },
          {
            action: 'optimize_lighting',
            description: 'Använd mer naturgligt ljus',
            impact: '~10% besparingar'
          },
          {
            action: 'delay_high_consumption',
            description: 'Skjut upp tvättmaskin/torktumlare',
            impact: '~5-10 kWh'
          }
        ]
      });
    }

    // Daily limit recommendation
    if (budget.projection && budget.projection.daysRemaining > 0) {
      recommendations.push({
        id: `rec_${Date.now()}_2`,
        budgetId,
        type: 'daily_target',
        priority: 'medium',
        title: 'Dagligt mål',
        description: `Håll förbrukningen under ${budget.projection.recommendedDailyLimit} ${budget.limitType === 'energy' ? 'kWh' : 'SEK'}/dag`,
        details: `${budget.projection.daysRemaining} dagar kvar i period`
      });
    }

    // Peak hour avoidance
    recommendations.push({
      id: `rec_${Date.now()}_3`,
      budgetId,
      type: 'time_shifting',
      priority: 'low',
      title: 'Tidsoptimering',
      description: 'Flytta energikrävande aktiviteter till billigare timmar',
      potentialSavings: '100-200 SEK/månad'
    });

    // Store recommendations
    this.recommendations = this.recommendations.concat(recommendations);

    // Trim old recommendations
    if (this.recommendations.length > 50) {
      this.recommendations = this.recommendations.slice(-50);
    }

    return recommendations;
  }

  // ============================================
  // STATISTICS & REPORTS
  // ============================================

  async getBudgetSummary() {
    const budgets = Array.from(this.budgets.values());
    
    return {
      budgets: budgets.map(b => ({
        id: b.id,
        name: b.name,
        period: b.period,
        current: Math.round(b.current * 10) / 10,
        limit: b.limit,
        remaining: Math.round(b.remaining * 10) / 10,
        percentage: Math.round(b.percentage),
        status: b.status,
        unit: b.limitType === 'energy' ? 'kWh' : 'SEK',
        daysRemaining: Math.ceil((b.endDate - Date.now()) / (24 * 60 * 60 * 1000)),
        projection: b.projection
      })),
      totalAlerts: this.alerts.filter(a => a.status === 'active').length,
      recommendations: this.getActiveRecommendations()
    };
  }

  async getBudgetDetails(budgetId) {
    const budget = this.budgets.get(budgetId);
    
    if (!budget) {
      return { error: 'Budget not found' };
    }

    // Calculate daily breakdown
    const dailyData = this.getDailyBreakdown(budget);
    
    return {
      budget: {
        id: budget.id,
        name: budget.name,
        period: budget.period,
        limit: budget.limit,
        limitType: budget.limitType,
        current: Math.round(budget.current * 10) / 10,
        remaining: Math.round(budget.remaining * 10) / 10,
        percentage: Math.round(budget.percentage),
        status: budget.status,
        startDate: new Date(budget.startDate).toISOString(),
        endDate: new Date(budget.endDate).toISOString()
      },
      projection: budget.projection,
      dailyBreakdown: dailyData,
      history: budget.history,
      alerts: this.alerts.filter(a => a.budgetId === budgetId),
      recommendations: this.recommendations.filter(r => r.budgetId === budgetId)
    };
  }

  getDailyBreakdown(budget) {
    const days = [];
    const periodStart = budget.startDate;
    const now = Date.now();
    
    // Get consumption data for budget period
    const periodConsumption = this.consumptionHistory.filter(c => 
      c.timestamp >= periodStart && c.timestamp <= now
    );

    // Group by day
    const dailyGroups = {};
    periodConsumption.forEach(c => {
      const date = new Date(c.timestamp).toISOString().split('T')[0];
      if (!dailyGroups[date]) {
        dailyGroups[date] = { energy: 0, cost: 0 };
      }
      dailyGroups[date].energy += c.energy;
      dailyGroups[date].cost += c.cost;
    });

    // Convert to array
    Object.entries(dailyGroups).forEach(([date, data]) => {
      days.push({
        date,
        consumption: budget.limitType === 'energy' ? data.energy : data.cost,
        unit: budget.limitType === 'energy' ? 'kWh' : 'SEK'
      });
    });

    return days;
  }

  async getConsumptionTrends(days = 30) {
    const since = Date.now() - days * 24 * 60 * 60 * 1000;
    const recentConsumption = this.consumptionHistory.filter(c => c.timestamp >= since);

    // Group by day
    const dailyTotals = {};
    recentConsumption.forEach(c => {
      const date = new Date(c.timestamp).toISOString().split('T')[0];
      if (!dailyTotals[date]) {
        dailyTotals[date] = { energy: 0, cost: 0 };
      }
      dailyTotals[date].energy += c.energy;
      dailyTotals[date].cost += c.cost;
    });

    const trend = Object.entries(dailyTotals).map(([date, data]) => ({
      date,
      energy: Math.round(data.energy * 10) / 10,
      cost: Math.round(data.cost * 10) / 10
    }));

    return {
      period: `${days} days`,
      data: trend,
      average: {
        energy: Math.round((trend.reduce((sum, d) => sum + d.energy, 0) / trend.length) * 10) / 10,
        cost: Math.round((trend.reduce((sum, d) => sum + d.cost, 0) / trend.length) * 10) / 10
      }
    };
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  getPeriodStart(period) {
    const now = new Date();
    
    switch (period) {
      case 'daily':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      
      case 'weekly':
        const day = now.getDay();
        const diff = day === 0 ? 6 : day - 1; // Monday as start
        const monday = new Date(now);
        monday.setDate(now.getDate() - diff);
        return new Date(monday.getFullYear(), monday.getMonth(), monday.getDate()).getTime();
      
      case 'monthly':
        return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      
      case 'yearly':
        return new Date(now.getFullYear(), 0, 1).getTime();
      
      default:
        return Date.now();
    }
  }

  getPeriodEnd(period) {
    const start = this.getPeriodStart(period);
    const startDate = new Date(start);
    
    switch (period) {
      case 'daily':
        return new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 1).getTime();
      
      case 'weekly':
        return start + 7 * 24 * 60 * 60 * 1000;
      
      case 'monthly':
        return new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1).getTime();
      
      case 'yearly':
        return new Date(startDate.getFullYear() + 1, 0, 1).getTime();
      
      default:
        return Date.now();
    }
  }

  getActiveRecommendations() {
    // Get recommendations from last 7 days
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return this.recommendations
      .filter(r => {
        const recId = parseInt(r.id.split('_')[1]);
        return recId >= sevenDaysAgo;
      })
      .slice(-10); // Max 10 recommendations
  }

  // ============================================
  // PUBLIC API
  // ============================================

  getAllBudgets() {
    return Array.from(this.budgets.values()).map(b => ({
      id: b.id,
      name: b.name,
      period: b.period,
      current: Math.round(b.current * 10) / 10,
      limit: b.limit,
      percentage: Math.round(b.percentage),
      status: b.status,
      unit: b.limitType === 'energy' ? 'kWh' : 'SEK'
    }));
  }

  getBudget(budgetId) {
    return this.budgets.get(budgetId);
  }

  getActiveAlerts() {
    return this.alerts.filter(a => a.status === 'active');
  }

  async dismissAlert(alertId) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.status = 'dismissed';
      return { success: true };
    }
    return { success: false, error: 'Alert not found' };
  }
}

module.exports = EnergyBudgetManager;
