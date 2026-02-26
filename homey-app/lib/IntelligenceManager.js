'use strict';

/**
 * AI Intelligence Manager
 * Provides machine learning-based predictions, pattern recognition,
 * and intelligent recommendations for home automation
 */
class IntelligenceManager {
  constructor(homey) {
    this.homey = homey;
    this.patterns = new Map();
    this.predictions = new Map();
    this.recommendations = [];
    this.learningData = {
      userBehavior: [],
      deviceUsage: [],
      energyPatterns: [],
      climatePreferences: []
    };
  }

  async initialize() {
    try {
      this.log('Initializing Intelligence Manager...');

      // Load learning data
      this.learningData = await this.homey.settings.get('learningData') || this.learningData;
      this.patterns = new Map(await this.homey.settings.get('intelligencePatterns') || []);

      // Start intelligence engine
      await this.startIntelligenceEngine();

      this.log('Intelligence Manager initialized');
    } catch (error) {
      console.error(`[IntelligenceManager] Failed to initialize:`, error.message);
    }
  }

  // ============================================
  // PATTERN RECOGNITION
  // ============================================

  /**
   * Analyze user behavior patterns
   */
  async analyzeUserBehavior() {
    const recentActions = this.learningData.userBehavior.slice(-500);
    
    const patterns = {
      timePatterns: this.analyzeTimePatterns(recentActions),
      routinePatterns: this.analyzeRoutinePatterns(recentActions),
      preferencePatterns: this.analyzePreferencePatterns(recentActions),
      anomalies: this.detectAnomalies(recentActions)
    };

    return patterns;
  }

  analyzeTimePatterns(actions) {
    const hourlyActivity = Array(24).fill(0);
    const weeklyActivity = Array(7).fill(0);

    actions.forEach(action => {
      const date = new Date(action.timestamp);
      hourlyActivity[date.getHours()]++;
      weeklyActivity[date.getDay()]++;
    });

    return {
      hourly: hourlyActivity,
      weekly: weeklyActivity,
      peakHours: this.findPeakHours(hourlyActivity),
      peakDays: this.findPeakDays(weeklyActivity)
    };
  }

  analyzeRoutinePatterns(actions) {
    const routines = new Map();

    // Group actions by time windows
    actions.forEach(action => {
      const hour = new Date(action.timestamp).getHours();
      const timeWindow = this.getTimeWindow(hour);
      
      if (!routines.has(timeWindow)) {
        routines.set(timeWindow, []);
      }
      routines.get(timeWindow).push(action);
    });

    // Find common sequences
    const sequences = [];
    routines.forEach((actions, window) => {
      const sequence = this.findCommonSequence(actions);
      if (sequence.length > 0) {
        sequences.push({ window, sequence, frequency: sequence.length });
      }
    });

    return sequences;
  }

  analyzePreferencePatterns(actions) {
    const preferences = {
      lighting: this.analyzeLightingPreferences(actions),
      climate: this.analyzeClimatePreferences(actions),
      scenes: this.analyzeScenePreferences(actions)
    };

    return preferences;
  }

  analyzeLightingPreferences(actions) {
    const lightActions = actions.filter(a => a.type === 'light' || a.deviceClass === 'light');
    
    const preferences = {
      averageBrightness: {},
      preferredColors: {},
      timeBasedSettings: {}
    };

    // Group by time of day
    ['morning', 'afternoon', 'evening', 'night'].forEach(period => {
      const periodActions = lightActions.filter(a => this.getTimeWindow(new Date(a.timestamp).getHours()) === period);
      
      if (periodActions.length > 0) {
        preferences.timeBasedSettings[period] = {
          brightness: this.calculateAverage(periodActions.map(a => a.brightness || 100)),
          color: this.getMostCommonValue(periodActions.map(a => a.color)),
          frequency: periodActions.length
        };
      }
    });

    return preferences;
  }

  analyzeClimatePreferences(actions) {
    const climateActions = actions.filter(a => a.type === 'climate' || a.capability === 'target_temperature');
    
    const preferences = {
      targetTemperatures: {},
      schedulePreferences: {}
    };

    // Analyze temperature preferences by time and season
    climateActions.forEach(action => {
      const hour = new Date(action.timestamp).getHours();
      const temp = action.temperature || action.value;
      
      const period = this.getTimeWindow(hour);
      if (!preferences.targetTemperatures[period]) {
        preferences.targetTemperatures[period] = [];
      }
      preferences.targetTemperatures[period].push(temp);
    });

    // Calculate averages
    Object.keys(preferences.targetTemperatures).forEach(period => {
      const temps = preferences.targetTemperatures[period];
      preferences.targetTemperatures[period] = {
        average: this.calculateAverage(temps),
        min: Math.min(...temps),
        max: Math.max(...temps),
        stdDev: this.calculateStdDev(temps)
      };
    });

    return preferences;
  }

  analyzeScenePreferences(actions) {
    const sceneActions = actions.filter(a => a.type === 'scene');
    
    const sceneUsage = {};
    sceneActions.forEach(action => {
      const sceneId = action.sceneId;
      if (!sceneUsage[sceneId]) {
        sceneUsage[sceneId] = { count: 0, times: [] };
      }
      sceneUsage[sceneId].count++;
      sceneUsage[sceneId].times.push(new Date(action.timestamp).getHours());
    });

    return sceneUsage;
  }

  detectAnomalies(actions) {
    const anomalies = [];
    
    // Detect unusual energy consumption
    const energyActions = actions.filter(a => a.type === 'energy');
    if (energyActions.length > 10) {
      const values = energyActions.map(a => a.value);
      const avg = this.calculateAverage(values);
      const stdDev = this.calculateStdDev(values);
      
      energyActions.forEach(action => {
        if (Math.abs(action.value - avg) > 2 * stdDev) {
          anomalies.push({
            type: 'energy_spike',
            timestamp: action.timestamp,
            value: action.value,
            expected: avg,
            severity: 'medium'
          });
        }
      });
    }

    // Detect unusual access patterns
    const accessByHour = Array(24).fill(0);
    actions.forEach(action => {
      accessByHour[new Date(action.timestamp).getHours()]++;
    });
    
    accessByHour.forEach((count, hour) => {
      const expectedCount = this.calculateAverage(accessByHour);
      if (count > expectedCount * 3) {
        anomalies.push({
          type: 'unusual_activity',
          hour,
          count,
          expected: expectedCount,
          severity: 'low'
        });
      }
    });

    return anomalies;
  }

  // ============================================
  // PREDICTIONS
  // ============================================

  /**
   * Predict next user action
   */
  async predictNextAction(context = {}) {
    const currentHour = context.hour || new Date().getHours();
    const currentDay = context.day || new Date().getDay();
    
    // Get similar historical contexts
    const similarContexts = this.findSimilarContexts({
      hour: currentHour,
      day: currentDay,
      presence: context.presence,
      weather: context.weather
    });

    if (similarContexts.length === 0) {
      return null;
    }

    // Find most common next action
    const nextActions = similarContexts.map(ctx => ctx.nextAction).filter(Boolean);
    const actionCounts = {};
    
    nextActions.forEach(action => {
      const key = `${action.type}_${action.target}`;
      actionCounts[key] = (actionCounts[key] || 0) + 1;
    });

    const mostCommonAction = Object.entries(actionCounts)
      .sort((a, b) => b[1] - a[1])[0];

    if (!mostCommonAction) return null;

    const [type, target] = mostCommonAction[0].split('_');
    const confidence = mostCommonAction[1] / similarContexts.length;

    return {
      type,
      target,
      confidence,
      suggestedTime: this.calculateOptimalTime(similarContexts)
    };
  }

  /**
   * Predict energy consumption
   */
  async predictEnergy(period = 'today') {
    const historicalData = this.learningData.energyPatterns.slice(-90); // Last 90 days
    
    if (historicalData.length < 7) {
      return null; // Not enough data
    }

    const prediction = {
      today: this.predictDailyEnergy(historicalData),
      week: this.predictWeeklyEnergy(historicalData),
      month: this.predictMonthlyEnergy(historicalData)
    };

    return prediction[period] || prediction.today;
  }

  predictDailyEnergy(historicalData) {
    const currentDay = new Date().getDay();
    const sameWeekdays = historicalData.filter(d => new Date(d.date).getDay() === currentDay);
    
    if (sameWeekdays.length === 0) return null;

    const recentWeekdays = sameWeekdays.slice(-4);
    const average = this.calculateAverage(recentWeekdays.map(d => d.consumption));
    const trend = this.calculateTrend(recentWeekdays.map(d => d.consumption));

    return {
      value: average + trend,
      confidence: Math.min(recentWeekdays.length / 4, 1),
      range: {
        min: average * 0.8,
        max: average * 1.2
      }
    };
  }

  predictWeeklyEnergy(historicalData) {
    const recentWeeks = [];
    for (let i = 0; i < 4 && i * 7 < historicalData.length; i++) {
      const weekData = historicalData.slice(-7 * (i + 1), -7 * i || undefined);
      const weekTotal = weekData.reduce((sum, d) => sum + d.consumption, 0);
      recentWeeks.push(weekTotal);
    }

    const average = this.calculateAverage(recentWeeks);
    const trend = this.calculateTrend(recentWeeks);

    return {
      value: average + trend * 7,
      confidence: Math.min(recentWeeks.length / 4, 1),
      range: {
        min: average * 0.85,
        max: average * 1.15
      }
    };
  }

  predictMonthlyEnergy(historicalData) {
    const monthlyAverages = [];
    
    for (let i = 0; i < 3; i++) {
      const monthData = historicalData.slice(-30 * (i + 1), -30 * i || undefined);
      if (monthData.length >= 28) {
        const monthTotal = monthData.reduce((sum, d) => sum + d.consumption, 0);
        monthlyAverages.push(monthTotal);
      }
    }

    if (monthlyAverages.length === 0) return null;

    const average = this.calculateAverage(monthlyAverages);
    const trend = this.calculateTrend(monthlyAverages);

    return {
      value: average + trend * 30,
      confidence: Math.min(monthlyAverages.length / 3, 1),
      range: {
        min: average * 0.9,
        max: average * 1.1
      }
    };
  }

  /**
   * Predict optimal temperature settings
   */
  async predictOptimalTemperature(zone, context = {}) {
    const hour = context.hour || new Date().getHours();
    const preferences = this.learningData.climatePreferences.filter(p => p.zone === zone);
    
    if (preferences.length < 10) {
      return { temperature: 21, confidence: 0.3 }; // Default
    }

    const timeWindow = this.getTimeWindow(hour);
    const relevantPrefs = preferences.filter(p => 
      this.getTimeWindow(new Date(p.timestamp).getHours()) === timeWindow
    );

    if (relevantPrefs.length === 0) {
      return { temperature: 21, confidence: 0.5 };
    }

    const temps = relevantPrefs.map(p => p.temperature);
    const average = this.calculateAverage(temps);
    const stdDev = this.calculateStdDev(temps);

    return {
      temperature: Math.round(average * 2) / 2, // Round to 0.5
      confidence: Math.min(relevantPrefs.length / 20, 1),
      range: {
        min: average - stdDev,
        max: average + stdDev
      }
    };
  }

  // ============================================
  // RECOMMENDATIONS
  // ============================================

  /**
   * Generate intelligent recommendations
   */
  async generateRecommendations() {
    this.recommendations = [];

    // Energy saving recommendations
    const energyRecs = await this.generateEnergySavingRecommendations();
    this.recommendations.push(...energyRecs);

    // Comfort optimization recommendations
    const comfortRecs = await this.generateComfortRecommendations();
    this.recommendations.push(...comfortRecs);

    // Security recommendations
    const securityRecs = await this.generateSecurityRecommendations();
    this.recommendations.push(...securityRecs);

    // Automation recommendations
    const autoRecs = await this.generateAutomationRecommendations();
    this.recommendations.push(...autoRecs);

    // Sort by priority
    this.recommendations.sort((a, b) => b.priority - a.priority);

    return this.recommendations;
  }

  async generateEnergySavingRecommendations() {
    const recommendations = [];
    const _energyData = await this.homey.app.energyManager.getCurrentConsumption();
    const topConsumers = await this.homey.app.energyManager.getTopConsumers(5);

    // High consumption devices
    topConsumers.forEach(device => {
      if (device.consumption > 100) {
        recommendations.push({
          id: `energy_${device.id}`,
          type: 'energy_saving',
          priority: 8,
          title: {
            en: `High energy consumption detected`,
            sv: `Hög energiförbrukning upptäckt`
          },
          description: {
            en: `${device.name} is consuming ${device.consumption}W. Consider reducing usage or checking for issues.`,
            sv: `${device.name} förbrukar ${device.consumption}W. Överväg att minska användningen eller kontrollera om det finns problem.`
          },
          action: {
            type: 'reduce_usage',
            deviceId: device.id
          },
          potentialSavings: device.consumption * 0.3 * 24 * 30 * 0.15 / 1000 // SEK per month
        });
      }
    });

    // Unused devices
    const devices = await this.homey.app.deviceManager.getAllDevices();
    const unusedDevices = devices.filter(d => 
      d.lastActive && Date.now() - d.lastActive > 7 * 24 * 60 * 60 * 1000
    );

    if (unusedDevices.length > 0) {
      recommendations.push({
        id: 'energy_unused_devices',
        type: 'energy_saving',
        priority: 6,
        title: {
          en: `${unusedDevices.length} unused devices detected`,
          sv: `${unusedDevices.length} oanvända enheter upptäckta`
        },
        description: {
          en: `These devices haven't been active for over a week. Consider turning them off.`,
          sv: `Dessa enheter har inte varit aktiva på över en vecka. Överväg att stänga av dem.`
        },
        action: {
          type: 'show_unused_devices',
          devices: unusedDevices.map(d => d.id)
        },
        potentialSavings: unusedDevices.length * 5 * 24 * 30 * 0.15 / 1000
      });
    }

    return recommendations;
  }

  async generateComfortRecommendations() {
    const recommendations = [];
    const patterns = await this.analyzeUserBehavior();

    // Temperature optimization
    if (patterns.preferencePatterns.climate) {
      const climatePrefs = patterns.preferencePatterns.climate;
      
      Object.entries(climatePrefs.targetTemperatures).forEach(([period, data]) => {
        if (data.stdDev > 2) {
          recommendations.push({
            id: `comfort_temp_${period}`,
            type: 'comfort',
            priority: 5,
            title: {
              en: `Inconsistent ${period} temperature`,
              sv: `Inkonsekvent ${period}temperatur`
            },
            description: {
              en: `Your ${period} temperature varies significantly. Create an automation for consistent comfort.`,
              sv: `Din ${period}temperatur varierar betydligt. Skapa en automation för konsekvent komfort.`
            },
            action: {
              type: 'create_climate_automation',
              period,
              suggestedTemp: data.average
            }
          });
        }
      });
    }

    // Lighting optimization
    if (patterns.preferencePatterns.lighting) {
      const lightingPrefs = patterns.preferencePatterns.lighting;
      
      Object.entries(lightingPrefs.timeBasedSettings).forEach(([period, settings]) => {
        if (settings.frequency > 10) {
          recommendations.push({
            id: `comfort_light_${period}`,
            type: 'comfort',
            priority: 4,
            title: {
              en: `Automate ${period} lighting`,
              sv: `Automatisera ${period}belysning`
            },
            description: {
              en: `You frequently adjust lights during ${period}. Create a scene for one-tap control.`,
              sv: `Du justerar ofta ljusen under ${period}. Skapa en scen för enkel kontroll.`
            },
            action: {
              type: 'create_lighting_scene',
              period,
              settings
            }
          });
        }
      });
    }

    return recommendations;
  }

  async generateSecurityRecommendations() {
    const recommendations = [];
    const securityStatus = await this.homey.app.securityManager.getStatus();

    // Check for open doors/windows when away
    if (!securityStatus.allSecure) {
      recommendations.push({
        id: 'security_open_sensors',
        type: 'security',
        priority: 9,
        title: {
          en: `Security alert: Open sensors detected`,
          sv: `Säkerhetsvarning: Öppna sensorer upptäckta`
        },
        description: {
          en: `Some doors or windows are open. Secure your home before leaving.`,
          sv: `Några dörrar eller fönster är öppna. Säkra ditt hem innan du lämnar.`
        },
        action: {
          type: 'show_open_sensors'
        },
        urgency: 'high'
      });
    }

    return recommendations;
  }

  async generateAutomationRecommendations() {
    const recommendations = [];
    const patterns = await this.analyzeUserBehavior();

    // Suggest automations based on routines
    patterns.routinePatterns.forEach(routine => {
      if (routine.frequency > 15) {
        recommendations.push({
          id: `auto_routine_${routine.window}`,
          type: 'automation',
          priority: 7,
          title: {
            en: `Automate your ${routine.window} routine`,
            sv: `Automatisera din ${routine.window}rutin`
          },
          description: {
            en: `You have a consistent routine during ${routine.window}. Create an automation to save time.`,
            sv: `Du har en konsekvent rutin under ${routine.window}. Skapa en automation för att spara tid.`
          },
          action: {
            type: 'create_routine_automation',
            routine
          }
        });
      }
    });

    return recommendations;
  }

  /**
   * Get AI insights
   */
  async getAIInsights(config = {}) {
    const insights = {
      patterns: await this.analyzeUserBehavior(),
      predictions: {
        nextAction: await this.predictNextAction(),
        energy: await this.predictEnergy('today'),
      },
      recommendations: this.recommendations.slice(0, 10),
      statistics: await this.generateStatistics()
    };

    if (config.showPredictions) {
      insights.predictions.temperature = await this.predictOptimalTemperature('living_room');
    }

    return insights;
  }

  /**
   * Generate overall statistics
   */
  async generateStatistics() {
    return {
      learningDataPoints: Object.values(this.learningData).reduce((sum, arr) => sum + arr.length, 0),
      patternsDiscovered: this.patterns.size,
      recommendationsGenerated: this.recommendations.length,
      predictionAccuracy: await this.calculatePredictionAccuracy()
    };
  }

  async calculatePredictionAccuracy() {
    // Calculate accuracy of past predictions
    const recentPredictions = Array.from(this.predictions.values()).slice(-100);
    if (recentPredictions.length === 0) return 0;

    const accurate = recentPredictions.filter(p => p.wasAccurate).length;
    return (accurate / recentPredictions.length) * 100;
  }

  // ============================================
  // LEARNING
  // ============================================

  /**
   * Record user action for learning
   */
  async recordUserAction(action) {
    this.learningData.userBehavior.push({
      ...action,
      timestamp: Date.now()
    });

    // Limit storage
    if (this.learningData.userBehavior.length > 10000) {
      this.learningData.userBehavior = this.learningData.userBehavior.slice(-5000);
    }

    await this.saveLearningData();
  }

  /**
   * Record device usage
   */
  async recordDeviceUsage(deviceId, capability, value) {
    this.learningData.deviceUsage.push({
      deviceId,
      capability,
      value,
      timestamp: Date.now()
    });

    if (this.learningData.deviceUsage.length > 5000) {
      this.learningData.deviceUsage = this.learningData.deviceUsage.slice(-2500);
    }

    await this.saveLearningData();
  }

  /**
   * Record energy pattern
   */
  async recordEnergyPattern(consumption) {
    this.learningData.energyPatterns.push({
      date: new Date().toISOString().split('T')[0],
      consumption,
      timestamp: Date.now()
    });

    await this.saveLearningData();
  }

  /**
   * Record climate preference
   */
  async recordClimatePreference(zone, temperature) {
    this.learningData.climatePreferences.push({
      zone,
      temperature,
      timestamp: Date.now()
    });

    if (this.learningData.climatePreferences.length > 2000) {
      this.learningData.climatePreferences = this.learningData.climatePreferences.slice(-1000);
    }

    await this.saveLearningData();
  }

  // ============================================
  // INTELLIGENCE ENGINE
  // ============================================

  async startIntelligenceEngine() {
    // Analyze patterns periodically
    this.analysisInterval = setInterval(async () => {
      await this.runAnalysis();
    }, 60 * 60 * 1000); // Every hour

    // Generate recommendations daily
    this.recommendationInterval = setInterval(async () => {
      await this.generateRecommendations();
    }, 24 * 60 * 60 * 1000); // Daily

    // Initial analysis
    await this.runAnalysis();
    await this.generateRecommendations();
  }

  async runAnalysis() {
    try {
      await this.analyzeUserBehavior();
      await this.predictEnergy();
      this.log('Analysis completed');
    } catch (error) {
      this.error('Analysis failed:', error);
    }
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  getTimeWindow(hour) {
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 22) return 'evening';
    return 'night';
  }

  findPeakHours(hourlyActivity) {
    const threshold = this.calculateAverage(hourlyActivity) * 1.5;
    return hourlyActivity
      .map((count, hour) => ({ hour, count }))
      .filter(h => h.count > threshold)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }

  findPeakDays(weeklyActivity) {
    return weeklyActivity
      .map((count, day) => ({ day, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 2);
  }

  findCommonSequence(actions) {
    // Simple sequence detection
    const sequences = new Map();
    
    for (let i = 0; i < actions.length - 1; i++) {
      const key = `${actions[i].type}_${actions[i + 1].type}`;
      sequences.set(key, (sequences.get(key) || 0) + 1);
    }

    return Array.from(sequences.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  }

  findSimilarContexts(context) {
    return this.learningData.userBehavior
      .filter(action => {
        const actionHour = new Date(action.timestamp).getHours();
        const actionDay = new Date(action.timestamp).getDay();
        return Math.abs(actionHour - context.hour) <= 1 && actionDay === context.day;
      })
      .slice(-50);
  }

  calculateOptimalTime(contexts) {
    const times = contexts.map(c => new Date(c.timestamp).getHours() * 60 + new Date(c.timestamp).getMinutes());
    return Math.round(this.calculateAverage(times));
  }

  calculateAverage(values) {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  calculateStdDev(values) {
    const avg = this.calculateAverage(values);
    const squareDiffs = values.map(value => Math.pow(value - avg, 2));
    return Math.sqrt(this.calculateAverage(squareDiffs));
  }

  calculateTrend(values) {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const indices = Array.from({ length: n }, (_, i) => i);
    
    const sumX = indices.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = indices.reduce((sum, x, i) => sum + x * values[i], 0);
    const sumX2 = indices.reduce((sum, x) => sum + x * x, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }

  getMostCommonValue(values) {
    const counts = {};
    values.forEach(v => {
      counts[v] = (counts[v] || 0) + 1;
    });
    
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])[0]?.[0];
  }

  async saveLearningData() {
    await this.homey.settings.set('learningData', this.learningData);
  }

  async savePatterns() {
    await this.homey.settings.set('intelligencePatterns', Array.from(this.patterns.entries()));
  }

  log(...args) {
    console.log('[IntelligenceManager]', ...args);
  }

  error(...args) {
    console.error('[IntelligenceManager]', ...args);
  }
}

module.exports = IntelligenceManager;
