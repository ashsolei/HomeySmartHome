'use strict';

class AIRecommendationEngine {
  constructor(homey) {
    this.homey = homey;
    this.recommendations = [];
    this.lastRefresh = null;
    this.refreshInterval = 10 * 60 * 1000; // 10 minutes
    this._refreshTimer = null;
  }

  async initialize() {
    await this.generateRecommendations();
    this._refreshTimer = setInterval(() => {
      this.generateRecommendations().catch(() => {});
    }, this.refreshInterval);
  }

  async generateRecommendations() {
    const recommendations = [];
    let idCounter = 1;

    // Energy-saving recommendations
    try {
      const energyData = await this._getEnergyData();
      if (energyData.currentWatts > 3000) {
        recommendations.push({
          id: `rec-${idCounter++}`,
          category: 'energy_saving',
          title: 'High energy consumption detected',
          description: `Current usage is ${energyData.currentWatts}W. Consider shifting heavy loads to off-peak hours.`,
          confidence: 0.85,
          estimatedSaving: '15-20%',
          action: 'schedule_off_peak'
        });
      }
      if (energyData.currentWatts > 1000) {
        recommendations.push({
          id: `rec-${idCounter++}`,
          category: 'energy_saving',
          title: 'Off-peak charging recommended',
          description: 'Schedule EV and battery charging during nighttime hours (00:00-06:00) for lower rates.',
          confidence: 0.9,
          estimatedSaving: '10-25%',
          action: 'enable_off_peak_charging'
        });
      }
    } catch (_) { /* energy data unavailable */ }

    // Comfort recommendations
    try {
      const climateData = await this._getClimateData();
      if (climateData.tempVariance > 3) {
        recommendations.push({
          id: `rec-${idCounter++}`,
          category: 'comfort',
          title: 'Temperature variance too high',
          description: `Temperature varies by ${climateData.tempVariance.toFixed(1)}C across zones. Consider adjusting HVAC schedules for more consistent comfort.`,
          confidence: 0.8,
          estimatedSaving: '5-10%',
          action: 'optimize_hvac_schedule'
        });
      }
      if (climateData.avgTemp > 23) {
        recommendations.push({
          id: `rec-${idCounter++}`,
          category: 'comfort',
          title: 'Consider lowering temperature',
          description: `Average temperature is ${climateData.avgTemp.toFixed(1)}C. Lowering by 1-2C can save energy while maintaining comfort.`,
          confidence: 0.75,
          estimatedSaving: '5-8%',
          action: 'lower_temperature'
        });
      }
    } catch (_) { /* climate data unavailable */ }

    // Security recommendations
    try {
      const presenceData = await this._getPresenceData();
      if (!presenceData.anyoneHome) {
        recommendations.push({
          id: `rec-${idCounter++}`,
          category: 'security',
          title: 'Enable presence simulation',
          description: 'No motion detected for an extended period. Enable presence simulation to deter intruders.',
          confidence: 0.85,
          estimatedSaving: null,
          action: 'enable_presence_simulation'
        });
        recommendations.push({
          id: `rec-${idCounter++}`,
          category: 'energy_saving',
          title: 'Turn off unnecessary devices',
          description: 'Nobody is home. Consider turning off lights and reducing HVAC to eco mode.',
          confidence: 0.9,
          estimatedSaving: '20-30%',
          action: 'activate_away_mode'
        });
      }
    } catch (_) { /* presence data unavailable */ }

    // Automation recommendations
    try {
      const automationData = await this._getAutomationData();
      if (automationData.activeCount < 3) {
        recommendations.push({
          id: `rec-${idCounter++}`,
          category: 'automation',
          title: 'Increase automation usage',
          description: 'You have few active automations. Adding morning/evening routines can improve comfort and save energy.',
          confidence: 0.7,
          estimatedSaving: '10-15%',
          action: 'suggest_automations'
        });
      }
    } catch (_) { /* automation data unavailable */ }

    // Time-based recommendations
    const hour = new Date().getHours();
    if (hour >= 22 || hour < 6) {
      recommendations.push({
        id: `rec-${idCounter++}`,
        category: 'comfort',
        title: 'Activate night mode',
        description: 'It is nighttime. Consider activating night mode to dim lights and reduce noise.',
        confidence: 0.85,
        estimatedSaving: '5-10%',
        action: 'activate_night_mode'
      });
    }

    if (hour >= 7 && hour <= 9) {
      recommendations.push({
        id: `rec-${idCounter++}`,
        category: 'automation',
        title: 'Morning routine available',
        description: 'Good morning! Consider running your morning routine to set lights, temperature, and briefing.',
        confidence: 0.8,
        estimatedSaving: null,
        action: 'run_morning_routine'
      });
    }

    this.recommendations = recommendations;
    this.lastRefresh = Date.now();
    return recommendations;
  }

  getRecommendations(category) {
    if (category) {
      return this.recommendations.filter(r => r.category === category);
    }
    return this.recommendations;
  }

  getStatistics() {
    const byCategory = {};
    for (const rec of this.recommendations) {
      byCategory[rec.category] = (byCategory[rec.category] || 0) + 1;
    }
    return {
      total: this.recommendations.length,
      byCategory,
      lastRefresh: this.lastRefresh ? new Date(this.lastRefresh).toISOString() : null,
      refreshInterval: this.refreshInterval
    };
  }

  async _getEnergyData() {
    try {
      const mgr = this.homey.app?.energyManager;
      if (mgr && typeof mgr.getCurrentConsumption === 'function') {
        const data = await mgr.getCurrentConsumption();
        return { currentWatts: data.currentWatts || data.total || 1500 };
      }
    } catch (_) { /* ignore */ }
    return { currentWatts: 1500 };
  }

  async _getClimateData() {
    try {
      const mgr = this.homey.app?.climateManager;
      if (mgr && typeof mgr.getAllZonesStatus === 'function') {
        const zones = await mgr.getAllZonesStatus();
        const temps = Array.isArray(zones) ? zones.map(z => z.temperature || 21) : [21, 22, 20];
        const avg = temps.reduce((a, b) => a + b, 0) / temps.length;
        const variance = Math.max(...temps) - Math.min(...temps);
        return { avgTemp: avg, tempVariance: variance };
      }
    } catch (_) { /* ignore */ }
    return { avgTemp: 21.5, tempVariance: 2 };
  }

  async _getPresenceData() {
    try {
      const mgr = this.homey.app?.presenceManager;
      if (mgr && typeof mgr.getStatus === 'function') {
        const status = await mgr.getStatus();
        return { anyoneHome: status.anyoneHome !== false };
      }
    } catch (_) { /* ignore */ }
    return { anyoneHome: true };
  }

  async _getAutomationData() {
    try {
      const engine = this.homey.app?.automationEngine;
      if (engine && engine.automations) {
        const active = Array.from(engine.automations.values()).filter(a => a.enabled !== false);
        return { activeCount: active.length };
      }
    } catch (_) { /* ignore */ }
    return { activeCount: 5 };
  }

  destroy() {
    if (this._refreshTimer) {
      clearInterval(this._refreshTimer);
      this._refreshTimer = null;
    }
    this.recommendations = [];
    this.lastRefresh = null;
  }
}

module.exports = AIRecommendationEngine;
