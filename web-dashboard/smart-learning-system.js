'use strict';

/**
 * Smart Learning System
 * Adaptive AI learning from all home systems
 */
class SmartLearningSystem {
  constructor(app) {
    this.app = app;
    this.patterns = new Map();
    this.rules = new Map();
    this.insights = [];
    this.predictions = [];
    this.adaptations = [];
    this.learningHistory = [];
  }

  async initialize() {
    await this.loadLearningData();
    await this.setupBasicRules();
    
    this.startLearning();
  }

  /**
   * Load existing learning data (patterns, history, rules) from storage.
   * Initializes with defaults if no prior data exists.
   */
  async loadLearningData() {
    try {
      // In a real system, this would load from persistent storage
      // For now, initialize with baseline learning data
      const categories = ['schedule', 'energy', 'comfort', 'security', 'presence'];
      for (const cat of categories) {
        this.patterns.set(cat, {
          category: cat,
          dataPoints: [],
          confidence: 0,
          lastAnalyzed: null
        });
      }
      console.log('📚 Learning data loaded: 5 pattern categories initialized');
    } catch (error) {
      console.error('Failed to load learning data:', error.message);
      // Non-fatal — continue with empty data
    }
  }

  // ============================================
  // PATTERN RECOGNITION
  // ============================================

  async analyzeUserBehavior(category) {
    console.log(`🧠 Analyzing ${category} patterns...`);

    const behaviors = {
      schedule: await this.analyzeSchedulePatterns(),
      energy: await this.analyzeEnergyPatterns(),
      comfort: await this.analyzeComfortPatterns(),
      security: await this.analyzeSecurityPatterns(),
      presence: await this.analyzePresencePatterns()
    };

    return behaviors[category] || null;
  }

  async analyzeSchedulePatterns() {
    // Simulate historical schedule data
    const patterns = {
      wakeUpTime: {
        weekday: { hour: 6, minute: 30, stdDev: 15 },  // 6:30 ± 15 min
        weekend: { hour: 8, minute: 0, stdDev: 30 }    // 8:00 ± 30 min
      },
      leaveHome: {
        weekday: { hour: 7, minute: 45, stdDev: 10 },
        weekend: null
      },
      returnHome: {
        weekday: { hour: 17, minute: 30, stdDev: 45 },
        weekend: { hour: 15, minute: 0, stdDev: 120 }
      },
      bedTime: {
        weekday: { hour: 22, minute: 30, stdDev: 20 },
        weekend: { hour: 23, minute: 30, stdDev: 40 }
      },
      confidence: 0.87  // 87% pattern confidence
    };

    this.patterns.set('schedule', patterns);

    return patterns;
  }

  async analyzeEnergyPatterns() {
    const patterns = {
      peakUsageHours: [7, 8, 18, 19, 20],  // Morning & evening
      lowUsageHours: [2, 3, 4, 5],          // Night
      weekdayAverage: 32.5,                 // kWh per day
      weekendAverage: 28.3,
      seasonalVariation: {
        winter: 45.0,   // Higher (heating)
        spring: 28.5,
        summer: 22.0,   // Lower
        autumn: 30.5
      },
      solarOptimization: {
        utilization: 0.68,  // 68% of solar production used directly
        batteryUsage: 0.25,
        gridExport: 0.07
      },
      confidence: 0.92
    };

    this.patterns.set('energy', patterns);

    return patterns;
  }

  async analyzeComfortPatterns() {
    const patterns = {
      temperature: {
        preferred: {
          living_room: { day: 21.5, night: 19.0 },
          bedroom: { day: 20.0, night: 18.5 },
          office: { day: 21.0, night: 19.0 }
        },
        tolerance: 0.5  // ±0.5°C
      },
      lighting: {
        preferred: {
          morning: { brightness: 70, colorTemp: 4000 },    // Cool white
          day: { brightness: 100, colorTemp: 5500 },       // Daylight
          evening: { brightness: 50, colorTemp: 2700 },    // Warm white
          night: { brightness: 10, colorTemp: 2200 }       // Very warm
        },
        autoAdjust: true
      },
      humidity: {
        preferred: 45,  // %
        tolerance: 5
      },
      confidence: 0.85
    };

    this.patterns.set('comfort', patterns);

    return patterns;
  }

  async analyzeSecurityPatterns() {
    const patterns = {
      armingSchedule: {
        weekday: {
          away: { hour: 7, minute: 45 },
          home: { hour: 17, minute: 30 },
          night: { hour: 23, minute: 0 }
        },
        weekend: {
          away: null,
          home: 'all-day',
          night: { hour: 23, minute: 30 }
        }
      },
      falseAlarms: {
        total: 3,
        lastMonth: 0,
        commonCauses: ['pet motion', 'window draft']
      },
      vulnerableTimes: [
        { day: 'weekday', hours: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17] },
        { day: 'weekend', hours: [] }
      ],
      confidence: 0.78
    };

    this.patterns.set('security', patterns);

    return patterns;
  }

  async analyzePresencePatterns() {
    const patterns = {
      occupancy: {
        weekday: {
          morning: ['Anna', 'Erik', 'Emma', 'Oscar'],
          day: [],  // All at work/school
          evening: ['Anna', 'Erik', 'Emma', 'Oscar'],
          night: ['Anna', 'Erik', 'Emma', 'Oscar']
        },
        weekend: {
          morning: ['Anna', 'Erik', 'Emma', 'Oscar'],
          day: ['Anna', 'Erik', 'Emma', 'Oscar'],
          evening: ['Anna', 'Erik', 'Emma', 'Oscar'],
          night: ['Anna', 'Erik', 'Emma', 'Oscar']
        }
      },
      rooms: {
        most_used: ['living_room', 'kitchen', 'master_bedroom'],
        least_used: ['guest_room', 'storage'],
        usage_by_time: {
          morning: ['bathroom', 'kitchen', 'bedroom'],
          day: ['living_room', 'office'],
          evening: ['living_room', 'kitchen', 'dining_room'],
          night: ['bedroom', 'bathroom']
        }
      },
      confidence: 0.90
    };

    this.patterns.set('presence', patterns);

    return patterns;
  }

  // ============================================
  // ADAPTIVE RULES
  // ============================================

  async setupBasicRules() {
    const rulesData = [
      {
        id: 'morning_routine',
        name: 'Morgonrutin',
        trigger: 'schedule',
        conditions: [
          { type: 'time', operator: 'between', value: ['06:00', '07:30'] },
          { type: 'day', operator: 'in', value: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] }
        ],
        actions: [
          { device: 'lighting', action: 'gradual_on', params: { duration: 900, brightness: 70 } },
          { device: 'heating', action: 'increase', params: { target: 21.5 } },
          { device: 'coffee_maker', action: 'start', params: { delay: 600 } }
        ],
        confidence: 0.90,
        timesTriggered: 0,
        timesSuccessful: 0,
        enabled: true
      },
      {
        id: 'leaving_home',
        name: 'Lämnar hemmet',
        trigger: 'presence',
        conditions: [
          { type: 'presence', operator: 'none', value: null },
          { type: 'time', operator: 'between', value: ['07:00', '09:00'] }
        ],
        actions: [
          { device: 'lighting', action: 'all_off', params: {} },
          { device: 'heating', action: 'eco_mode', params: { target: 19 } },
          { device: 'security', action: 'arm_away', params: {} },
          { device: 'appliances', action: 'check_off', params: {} }
        ],
        confidence: 0.95,
        timesTriggered: 0,
        timesSuccessful: 0,
        enabled: true
      },
      {
        id: 'arriving_home',
        name: 'Kommer hem',
        trigger: 'presence',
        conditions: [
          { type: 'presence', operator: 'any', value: null },
          { type: 'time', operator: 'between', value: ['16:00', '19:00'] }
        ],
        actions: [
          { device: 'security', action: 'disarm', params: {} },
          { device: 'lighting', action: 'welcome', params: { brightness: 70 } },
          { device: 'heating', action: 'comfort', params: { target: 21.5 } },
          { device: 'ventilation', action: 'boost', params: { duration: 600 } }
        ],
        confidence: 0.92,
        timesTriggered: 0,
        timesSuccessful: 0,
        enabled: true
      },
      {
        id: 'evening_routine',
        name: 'Kvällsrutin',
        trigger: 'schedule',
        conditions: [
          { type: 'time', operator: 'after', value: '20:00' },
          { type: 'presence', operator: 'any', value: null }
        ],
        actions: [
          { device: 'lighting', action: 'evening_mode', params: { brightness: 50, colorTemp: 2700 } },
          { device: 'media', action: 'suggest', params: { type: 'relaxing' } },
          { device: 'security', action: 'arm_home', params: {} }
        ],
        confidence: 0.88,
        timesTriggered: 0,
        timesSuccessful: 0,
        enabled: true
      },
      {
        id: 'night_routine',
        name: 'Kvällsläge',
        trigger: 'schedule',
        conditions: [
          { type: 'time', operator: 'between', value: ['22:00', '23:30'] },
          { type: 'presence', operator: 'all_home', value: null }
        ],
        actions: [
          { device: 'lighting', action: 'gradual_off', params: { duration: 1800 } },
          { device: 'heating', action: 'night_mode', params: { target: 19 } },
          { device: 'security', action: 'arm_night', params: {} },
          { device: 'doors', action: 'lock_all', params: {} }
        ],
        confidence: 0.85,
        timesTriggered: 0,
        timesSuccessful: 0,
        enabled: true
      },
      {
        id: 'energy_optimization',
        name: 'Energioptimering',
        trigger: 'energy_price',
        conditions: [
          { type: 'price', operator: 'below', value: 0.50 }  // Below 0.50 SEK/kWh
        ],
        actions: [
          { device: 'battery', action: 'charge', params: { target: 90 } },
          { device: 'water_heater', action: 'heat', params: { target: 65 } },
          { device: 'ev_charger', action: 'start', params: {} }
        ],
        confidence: 0.94,
        timesTriggered: 0,
        timesSuccessful: 0,
        enabled: true
      }
    ];

    for (const rule of rulesData) {
      this.rules.set(rule.id, rule);
    }
  }

  async evaluateRule(ruleId) {
    const rule = this.rules.get(ruleId);
    
    if (!rule || !rule.enabled) {
      return { shouldTrigger: false };
    }

    // Simulate condition evaluation
    let allConditionsMet = true;

    for (const _condition of rule.conditions) {
      // In real implementation, check actual system state
      const conditionMet = Math.random() > 0.2; // 80% chance
      
      if (!conditionMet) {
        allConditionsMet = false;
        break;
      }
    }

    if (allConditionsMet) {
      rule.timesTriggered += 1;
      
      // Simulate action success
      const success = Math.random() > 0.1; // 90% success rate
      
      if (success) {
        rule.timesSuccessful += 1;
      }

      // Update confidence based on success rate
      if (rule.timesTriggered > 10) {
        rule.confidence = rule.timesSuccessful / rule.timesTriggered;
      }

      console.log(`🤖 Rule triggered: ${rule.name} (Confidence: ${(rule.confidence * 100).toFixed(0)}%)`);

      return {
        shouldTrigger: true,
        actions: rule.actions,
        confidence: rule.confidence
      };
    }

    return { shouldTrigger: false };
  }

  async createAdaptiveRule(insights) {
    // Create new rule based on learned patterns
    const newRule = {
      id: `adaptive_${Date.now()}`,
      name: insights.name,
      trigger: insights.trigger,
      conditions: insights.conditions,
      actions: insights.actions,
      confidence: 0.50,  // Start with lower confidence
      timesTriggered: 0,
      timesSuccessful: 0,
      enabled: true,
      adaptive: true,
      createdDate: Date.now()
    };

    this.rules.set(newRule.id, newRule);

    console.log(`✨ Created adaptive rule: ${newRule.name}`);

    return newRule;
  }

  // ============================================
  // MACHINE LEARNING
  // ============================================

  async learnFromData(dataType, data) {
    console.log(`📚 Learning from ${dataType} data...`);

    const insights = {
      dataType,
      timestamp: Date.now(),
      patterns: [],
      confidence: 0
    };

    if (dataType === 'energy') {
      // Analyze energy usage patterns
      const avgUsage = data.reduce((sum, d) => sum + d.consumption, 0) / data.length;
      const peakTimes = this.findPeakTimes(data);
      
      insights.patterns.push({
        type: 'average_consumption',
        value: avgUsage.toFixed(2),
        unit: 'kWh'
      });

      insights.patterns.push({
        type: 'peak_times',
        value: peakTimes,
        unit: 'hours'
      });

      insights.confidence = 0.85;

    } else if (dataType === 'comfort') {
      // Analyze comfort preferences
      const avgTemp = data.reduce((sum, d) => sum + d.temperature, 0) / data.length;
      const avgHumidity = data.reduce((sum, d) => sum + d.humidity, 0) / data.length;
      
      insights.patterns.push({
        type: 'preferred_temperature',
        value: avgTemp.toFixed(1),
        unit: '°C'
      });

      insights.patterns.push({
        type: 'preferred_humidity',
        value: avgHumidity.toFixed(0),
        unit: '%'
      });

      insights.confidence = 0.78;

    } else if (dataType === 'presence') {
      // Analyze presence patterns
      const occupancyRate = data.filter(d => d.occupied).length / data.length;
      
      insights.patterns.push({
        type: 'occupancy_rate',
        value: (occupancyRate * 100).toFixed(0),
        unit: '%'
      });

      insights.confidence = 0.90;
    }

    this.insights.push(insights);
    this.learningHistory.push({
      timestamp: Date.now(),
      dataType,
      samplesProcessed: data.length,
      insightsGenerated: insights.patterns.length
    });

    return insights;
  }

  findPeakTimes(data) {
    // Simple peak detection
    const hourlyUsage = new Array(24).fill(0);
    const hourlyCounts = new Array(24).fill(0);

    for (const entry of data) {
      const hour = new Date(entry.timestamp).getHours();
      hourlyUsage[hour] += entry.consumption;
      hourlyCounts[hour] += 1;
    }

    // Calculate averages
    const hourlyAverages = hourlyUsage.map((usage, hour) => ({
      hour,
      average: hourlyCounts[hour] > 0 ? usage / hourlyCounts[hour] : 0
    }));

    // Find top 3 peak hours
    const peaks = hourlyAverages
      .sort((a, b) => b.average - a.average)
      .slice(0, 3)
      .map(p => p.hour)
      .sort((a, b) => a - b);

    return peaks;
  }

  // ============================================
  // PREDICTIONS
  // ============================================

  async predictBehavior(type, timeframe = 24) {
    console.log(`🔮 Predicting ${type} for next ${timeframe} hours...`);

    const patterns = this.patterns.get(type);
    
    if (!patterns) {
      return null;
    }

    const predictions = [];
    const now = new Date();

    for (let hour = 0; hour < timeframe; hour++) {
      const futureTime = new Date(now.getTime() + hour * 60 * 60 * 1000);
      const hourOfDay = futureTime.getHours();
      const isWeekday = futureTime.getDay() >= 1 && futureTime.getDay() <= 5;

      let prediction = null;

      if (type === 'energy') {
        // Predict energy usage
        const baseUsage = patterns.weekdayAverage / 24;
        const isPeak = patterns.peakUsageHours.includes(hourOfDay);
        const multiplier = isPeak ? 1.8 : 0.6;
        
        prediction = {
          hour: hourOfDay,
          expectedUsage: (baseUsage * multiplier).toFixed(2),
          confidence: patterns.confidence
        };

      } else if (type === 'presence') {
        // Predict presence
        const schedule = isWeekday ? patterns.occupancy.weekday : patterns.occupancy.weekend;
        let timeOfDay = 'day';
        
        if (hourOfDay >= 6 && hourOfDay < 12) timeOfDay = 'morning';
        else if (hourOfDay >= 18 && hourOfDay < 23) timeOfDay = 'evening';
        else if (hourOfDay >= 23 || hourOfDay < 6) timeOfDay = 'night';

        prediction = {
          hour: hourOfDay,
          expectedOccupants: schedule[timeOfDay] || [],
          confidence: patterns.confidence
        };
      }

      if (prediction) {
        predictions.push(prediction);
      }
    }

    this.predictions.push({
      type,
      timestamp: Date.now(),
      timeframe,
      predictions
    });

    return predictions;
  }

  // ============================================
  // ADAPTATIONS
  // ============================================

  async suggestOptimization(system) {
    console.log(`💡 Suggesting optimization for ${system}...`);

    const suggestions = [];

    if (system === 'energy') {
      const energyPatterns = this.patterns.get('energy');
      
      if (energyPatterns) {
        // Suggest load shifting
        suggestions.push({
          type: 'load_shift',
          title: 'Flytta energianvändning',
          description: 'Flytta tunga laster till låg-pris timmar',
          potentialSavings: '300 SEK/månad',
          confidence: energyPatterns.confidence,
          actions: [
            'Starta diskmaskinen kl. 23:00',
            'Ladda elbil kl. 02:00-06:00',
            'Värm varmvatten under natten'
          ]
        });

        // Suggest solar optimization
        if (energyPatterns.solarOptimization.utilization < 0.75) {
          suggestions.push({
            type: 'solar_optimization',
            title: 'Optimera solenergianvändning',
            description: `Använd ${(energyPatterns.solarOptimization.utilization * 100).toFixed(0)}% av solenergin direkt`,
            potentialSavings: '200 SEK/månad',
            confidence: 0.88,
            actions: [
              'Kör maskiner på dagen',
              'Öka batterikapacitet',
              'Automatisera energikrävande uppgifter'
            ]
          });
        }
      }

    } else if (system === 'comfort') {
      const comfortPatterns = this.patterns.get('comfort');
      
      if (comfortPatterns) {
        suggestions.push({
          type: 'temperature_optimization',
          title: 'Optimera temperaturinställningar',
          description: 'Anpassa temperatur efter schema',
          potentialSavings: '150 SEK/månad',
          confidence: comfortPatterns.confidence,
          actions: [
            'Sänk temperatur kl. 07:00-17:00 (borta)',
            'Höj temperatur 30 min före hemkomst',
            'Nattläge kl. 23:00-06:00'
          ]
        });
      }

    } else if (system === 'security') {
      const securityPatterns = this.patterns.get('security');
      
      if (securityPatterns) {
        suggestions.push({
          type: 'security_automation',
          title: 'Automatisera säkerhet',
          description: 'Larm enligt schema',
          potentialSavings: 'Ökad säkerhet',
          confidence: securityPatterns.confidence,
          actions: [
            'Auto-aktivera larm kl. 07:45',
            'Auto-avaktivera vid hemkomst',
            'Nattläge kl. 23:00'
          ]
        });
      }
    }

    this.adaptations.push({
      timestamp: Date.now(),
      system,
      suggestions
    });

    return suggestions;
  }

  async implementAdaptation(adaptationId) {
    // Find the adaptation
    for (const adaptation of this.adaptations) {
      for (const suggestion of adaptation.suggestions) {
        if (suggestion.type === adaptationId) {
          // Create adaptive rule
          const rule = await this.createAdaptiveRule({
            name: suggestion.title,
            trigger: 'schedule',
            conditions: [],
            actions: suggestion.actions.map(action => ({
              device: 'automation',
              action: 'execute',
              params: { command: action }
            }))
          });

          console.log(`✅ Implemented: ${suggestion.title}`);

          return { success: true, rule };
        }
      }
    }

    return { success: false, error: 'Adaptation not found' };
  }

  // ============================================
  // MONITORING
  // ============================================

  startLearning() {
    // Continuous learning from all systems
    setInterval(() => {
      this.continuousLearning();
    }, 60 * 60 * 1000); // Every hour

    // Daily pattern analysis
    setInterval(() => {
      const hour = new Date().getHours();
      if (hour === 2) { // 2 AM
        this.dailyAnalysis();
      }
    }, 60 * 60 * 1000);

    // Weekly optimization suggestions
    setInterval(() => {
      const day = new Date().getDay();
      if (day === 0) { // Sunday
        this.weeklyOptimization();
      }
    }, 24 * 60 * 60 * 1000);

    // Initial analysis
    this.analyzeUserBehavior('schedule');
    this.analyzeUserBehavior('energy');
    this.analyzeUserBehavior('comfort');
  }

  async continuousLearning() {
    console.log('🧠 Continuous learning cycle...');

    // Simulate data collection
    const energyData = Array(24).fill(0).map((_, i) => ({
      timestamp: Date.now() - (24 - i) * 60 * 60 * 1000,
      consumption: 15 + Math.random() * 20
    }));

    await this.learnFromData('energy', energyData);
  }

  async dailyAnalysis() {
    console.log('📊 Daily analysis...');

    await this.analyzeUserBehavior('schedule');
    await this.analyzeUserBehavior('energy');
    await this.analyzeUserBehavior('presence');

    // Evaluate rule performance
    for (const [_ruleId, rule] of this.rules) {
      if (rule.timesTriggered > 0) {
        const successRate = (rule.timesSuccessful / rule.timesTriggered * 100).toFixed(0);
        console.log(`  Rule: ${rule.name} - ${successRate}% success rate`);
      }
    }
  }

  async weeklyOptimization() {
    console.log('💡 Weekly optimization...');

    const energySuggestions = await this.suggestOptimization('energy');
    const comfortSuggestions = await this.suggestOptimization('comfort');
    const securitySuggestions = await this.suggestOptimization('security');

    console.log(`Generated ${energySuggestions.length + comfortSuggestions.length + securitySuggestions.length} optimization suggestions`);
  }

  // ============================================
  // REPORTING
  // ============================================

  getLearningReport() {
    const totalPatterns = this.patterns.size;
    const totalRules = this.rules.size;
    const adaptiveRules = Array.from(this.rules.values()).filter(r => r.adaptive).length;
    const totalInsights = this.insights.length;

    return {
      patterns: totalPatterns,
      rules: totalRules,
      adaptiveRules,
      insights: totalInsights,
      adaptations: this.adaptations.length,
      averageConfidence: this.calculateAverageConfidence()
    };
  }

  calculateAverageConfidence() {
    const patterns = Array.from(this.patterns.values());
    
    if (patterns.length === 0) return 0;

    const totalConfidence = patterns.reduce((sum, p) => sum + (p.confidence || 0), 0);
    return (totalConfidence / patterns.length).toFixed(2);
  }

  getRulePerformance() {
    const rules = Array.from(this.rules.values());

    return rules
      .filter(r => r.timesTriggered > 0)
      .map(r => ({
        name: r.name,
        timesTriggered: r.timesTriggered,
        successRate: ((r.timesSuccessful / r.timesTriggered) * 100).toFixed(0) + '%',
        confidence: (r.confidence * 100).toFixed(0) + '%',
        enabled: r.enabled
      }))
      .sort((a, b) => b.timesTriggered - a.timesTriggered);
  }

  getInsightsSummary() {
    return this.insights.slice(-10).reverse().map(i => ({
      dataType: i.dataType,
      date: new Date(i.timestamp).toLocaleDateString('sv-SE'),
      patterns: i.patterns.length,
      confidence: (i.confidence * 100).toFixed(0) + '%'
    }));
  }
}

module.exports = SmartLearningSystem;
