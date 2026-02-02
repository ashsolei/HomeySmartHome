'use strict';

const Homey = require('homey');

/**
 * AI Intelligence Engine for Smart Home
 * Provides machine learning, pattern recognition, and predictive automation
 */
class IntelligenceEngine {
  constructor(app) {
    this.app = app;
    this.patterns = new Map();
    this.predictions = new Map();
    this.learningData = {
      deviceUsage: {},
      sceneActivations: {},
      presencePatterns: {},
      energyPatterns: {},
      temperaturePreferences: {}
    };
    this.rules = [];
    this.confidenceThreshold = 0.7;
  }

  async initialize() {
    this.app.log('Intelligence Engine initializing...');
    
    // Load historical data
    await this.loadHistoricalData();
    
    // Start learning processes
    this.startLearning();
    
    // Initialize predictive models
    await this.initializePredictiveModels();
    
    this.app.log('Intelligence Engine initialized');
  }

  // ============================================
  // PATTERN RECOGNITION
  // ============================================

  async analyzePatterns() {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();
    
    // Analyze device usage patterns
    const devicePatterns = await this.analyzeDevicePatterns(hour, dayOfWeek);
    
    // Analyze presence patterns
    const presencePatterns = await this.analyzePresencePatterns(hour, dayOfWeek);
    
    // Analyze energy consumption patterns
    const energyPatterns = await this.analyzeEnergyPatterns(hour, dayOfWeek);
    
    // Analyze climate preferences
    const climatePatterns = await this.analyzeClimatePatterns();
    
    return {
      devices: devicePatterns,
      presence: presencePatterns,
      energy: energyPatterns,
      climate: climatePatterns
    };
  }

  async analyzeDevicePatterns(hour, dayOfWeek) {
    const patterns = [];
    
    for (const [deviceId, usageData] of Object.entries(this.learningData.deviceUsage)) {
      const pattern = this.detectTemporalPattern(usageData, hour, dayOfWeek);
      
      if (pattern.confidence > this.confidenceThreshold) {
        patterns.push({
          deviceId,
          type: 'temporal',
          pattern: pattern.pattern,
          confidence: pattern.confidence,
          recommendation: this.generateRecommendation(deviceId, pattern)
        });
      }
    }
    
    return patterns;
  }

  detectTemporalPattern(usageData, currentHour, currentDay) {
    const timeSlots = {};
    let totalEvents = 0;
    
    // Group events by time slots
    for (const event of usageData.events || []) {
      const eventHour = new Date(event.timestamp).getHours();
      const eventDay = new Date(event.timestamp).getDay();
      const key = `${eventDay}-${eventHour}`;
      
      timeSlots[key] = (timeSlots[key] || 0) + 1;
      totalEvents++;
    }
    
    // Calculate probability for current time
    const currentKey = `${currentDay}-${currentHour}`;
    const probability = (timeSlots[currentKey] || 0) / Math.max(totalEvents, 1);
    
    return {
      pattern: 'temporal',
      confidence: probability,
      frequency: timeSlots[currentKey] || 0,
      prediction: probability > 0.5 ? 'likely' : 'unlikely'
    };
  }

  // ============================================
  // PREDICTIVE AUTOMATION
  // ============================================

  async generatePredictions() {
    const predictions = [];
    
    // Predict next device activation
    const devicePredictions = await this.predictDeviceActivations();
    predictions.push(...devicePredictions);
    
    // Predict scene activations
    const scenePredictions = await this.predictSceneActivations();
    predictions.push(...scenePredictions);
    
    // Predict energy consumption
    const energyPredictions = await this.predictEnergyConsumption();
    predictions.push(...energyPredictions);
    
    // Predict presence changes
    const presencePredictions = await this.predictPresenceChanges();
    predictions.push(...presencePredictions);
    
    // Store predictions
    this.predictions.set(Date.now(), predictions);
    
    return predictions;
  }

  async predictDeviceActivations() {
    const predictions = [];
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay();
    
    for (const [deviceId, usageData] of Object.entries(this.learningData.deviceUsage)) {
      const pattern = this.detectTemporalPattern(usageData, currentHour, currentDay);
      
      if (pattern.confidence > 0.6) {
        predictions.push({
          type: 'device_activation',
          deviceId,
          confidence: pattern.confidence,
          timeframe: '15min',
          action: 'prepare',
          timestamp: Date.now()
        });
      }
    }
    
    return predictions;
  }

  async predictSceneActivations() {
    const predictions = [];
    const now = new Date();
    const hour = now.getHours();
    
    // Morning scene prediction
    if (hour >= 6 && hour <= 8) {
      const morningData = this.learningData.sceneActivations['morning'] || { frequency: 0, lastActivated: 0 };
      const daysSinceLastActivation = (Date.now() - morningData.lastActivated) / (1000 * 60 * 60 * 24);
      
      if (daysSinceLastActivation >= 1) {
        predictions.push({
          type: 'scene_activation',
          sceneId: 'morning',
          confidence: Math.min(0.8 + (morningData.frequency / 100), 0.95),
          suggestedTime: `${hour}:30`,
          action: 'suggest'
        });
      }
    }
    
    // Evening scene prediction
    if (hour >= 18 && hour <= 21) {
      predictions.push({
        type: 'scene_activation',
        sceneId: 'evening',
        confidence: 0.75,
        suggestedTime: '19:00',
        action: 'suggest'
      });
    }
    
    // Night scene prediction
    if (hour >= 22 || hour <= 1) {
      predictions.push({
        type: 'scene_activation',
        sceneId: 'night',
        confidence: 0.85,
        suggestedTime: '23:00',
        action: 'suggest'
      });
    }
    
    return predictions;
  }

  async predictEnergyConsumption() {
    const predictions = [];
    const currentHour = new Date().getHours();
    
    // Analyze historical energy data
    const avgConsumption = this.calculateAverageConsumption(currentHour);
    const currentConsumption = await this.getCurrentEnergyConsumption();
    
    if (currentConsumption > avgConsumption * 1.3) {
      predictions.push({
        type: 'energy_alert',
        severity: 'warning',
        confidence: 0.9,
        message: `Ovanligt hög energiförbrukning detekterad (${currentConsumption}W vs ${avgConsumption}W normalt)`,
        action: 'alert',
        suggestions: await this.generateEnergySavingSuggestions()
      });
    }
    
    return predictions;
  }

  async predictPresenceChanges() {
    const predictions = [];
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    
    // Weekday morning departure prediction (Mon-Fri)
    if (day >= 1 && day <= 5 && hour >= 7 && hour <= 9) {
      predictions.push({
        type: 'presence_change',
        change: 'departure',
        confidence: 0.8,
        timeframe: '30min',
        action: 'prepare_away_mode',
        suggestions: ['Sänk värme', 'Bekräfta att fönster är stängda', 'Aktivera larm']
      });
    }
    
    // Evening arrival prediction
    if (day >= 1 && day <= 5 && hour >= 16 && hour <= 18) {
      predictions.push({
        type: 'presence_change',
        change: 'arrival',
        confidence: 0.75,
        timeframe: '60min',
        action: 'prepare_welcome',
        suggestions: ['Höj värme', 'Förbered belysning', 'Inaktivera larm']
      });
    }
    
    return predictions;
  }

  // ============================================
  // INTELLIGENT RECOMMENDATIONS
  // ============================================

  async generateRecommendations() {
    const recommendations = [];
    
    // Energy optimization recommendations
    const energyRecs = await this.generateEnergyRecommendations();
    recommendations.push(...energyRecs);
    
    // Comfort optimization recommendations
    const comfortRecs = await this.generateComfortRecommendations();
    recommendations.push(...comfortRecs);
    
    // Security recommendations
    const securityRecs = await this.generateSecurityRecommendations();
    recommendations.push(...securityRecs);
    
    // Automation suggestions
    const automationRecs = await this.generateAutomationRecommendations();
    recommendations.push(...automationRecs);
    
    return recommendations;
  }

  async generateEnergyRecommendations() {
    const recommendations = [];
    const devices = await this.app.homey.devices.getDevices();
    
    // Find devices left on unnecessarily
    for (const device of Object.values(devices)) {
      if (device.capabilitiesObj?.onoff?.value === true) {
        const usagePattern = this.learningData.deviceUsage[device.id];
        
        if (usagePattern && this.isAnomalousUsage(device.id, usagePattern)) {
          recommendations.push({
            type: 'energy',
            priority: 'medium',
            deviceId: device.id,
            deviceName: device.name,
            message: `${device.name} är påslagen längre än vanligt`,
            action: 'turn_off',
            potentialSavings: this.calculatePotentialSavings(device),
            confidence: 0.8
          });
        }
      }
    }
    
    // Recommend vampire power elimination
    recommendations.push({
      type: 'energy',
      priority: 'low',
      message: 'Koppla bort enheter i standby-läge när du sover',
      action: 'create_automation',
      potentialSavings: { kWh: 2, sek: 8 },
      confidence: 0.9
    });
    
    return recommendations;
  }

  async generateComfortRecommendations() {
    const recommendations = [];
    const zones = await this.app.homey.zones.getZones();
    
    for (const zone of Object.values(zones)) {
      const temperature = await this.getZoneTemperature(zone.id);
      const preferredTemp = this.learningData.temperaturePreferences[zone.id]?.preferred || 21;
      
      if (Math.abs(temperature - preferredTemp) > 2) {
        recommendations.push({
          type: 'comfort',
          priority: 'medium',
          zoneId: zone.id,
          zoneName: zone.name,
          message: `Temperaturen i ${zone.name} är ${temperature}°C, du föredrar vanligtvis ${preferredTemp}°C`,
          action: 'adjust_temperature',
          targetTemperature: preferredTemp,
          confidence: 0.85
        });
      }
    }
    
    return recommendations;
  }

  async generateSecurityRecommendations() {
    const recommendations = [];
    const hour = new Date().getHours();
    
    // Night security check
    if (hour >= 22 || hour <= 6) {
      const openSensors = await this.getOpenSensors();
      
      if (openSensors.length > 0) {
        recommendations.push({
          type: 'security',
          priority: 'high',
          message: `${openSensors.length} fönster/dörrar öppna under natten`,
          devices: openSensors,
          action: 'alert',
          confidence: 1.0
        });
      }
    }
    
    return recommendations;
  }

  async generateAutomationRecommendations() {
    const recommendations = [];
    
    // Analyze repeated manual actions
    const repeatedActions = this.findRepeatedManualActions();
    
    for (const action of repeatedActions) {
      if (action.frequency > 10) {
        recommendations.push({
          type: 'automation',
          priority: 'high',
          message: `Du ${action.description} regelbundet. Vill du automatisera detta?`,
          action: 'create_automation',
          pattern: action.pattern,
          confidence: action.frequency / 50
        });
      }
    }
    
    return recommendations;
  }

  // ============================================
  // LEARNING MECHANISMS
  // ============================================

  startLearning() {
    // Learn from device usage
    this.app.homey.devices.on('device.update', (device) => {
      this.recordDeviceUsage(device);
    });
    
    // Learn from scene activations
    this.app.on('scene-activated', (scene) => {
      this.recordSceneActivation(scene);
    });
    
    // Learn from presence changes
    this.app.on('presence-changed', (data) => {
      this.recordPresenceChange(data);
    });
    
    // Periodic pattern analysis
    setInterval(() => {
      this.analyzePatterns();
    }, 5 * 60 * 1000); // Every 5 minutes
    
    // Daily learning summary
    setInterval(() => {
      this.generateDailyLearningSummary();
    }, 24 * 60 * 60 * 1000); // Daily
  }

  recordDeviceUsage(device) {
    if (!this.learningData.deviceUsage[device.id]) {
      this.learningData.deviceUsage[device.id] = {
        events: [],
        patterns: []
      };
    }
    
    this.learningData.deviceUsage[device.id].events.push({
      timestamp: Date.now(),
      state: device.capabilitiesObj,
      triggered: 'manual' // or 'automation'
    });
    
    // Keep only last 1000 events
    if (this.learningData.deviceUsage[device.id].events.length > 1000) {
      this.learningData.deviceUsage[device.id].events.shift();
    }
    
    this.saveLearningData();
  }

  recordSceneActivation(scene) {
    if (!this.learningData.sceneActivations[scene.id]) {
      this.learningData.sceneActivations[scene.id] = {
        frequency: 0,
        lastActivated: 0,
        timePatterns: []
      };
    }
    
    this.learningData.sceneActivations[scene.id].frequency++;
    this.learningData.sceneActivations[scene.id].lastActivated = Date.now();
    this.learningData.sceneActivations[scene.id].timePatterns.push({
      timestamp: Date.now(),
      hour: new Date().getHours(),
      day: new Date().getDay()
    });
    
    this.saveLearningData();
  }

  recordPresenceChange(data) {
    const key = `${data.zone}-${data.presence}`;
    
    if (!this.learningData.presencePatterns[key]) {
      this.learningData.presencePatterns[key] = [];
    }
    
    this.learningData.presencePatterns[key].push({
      timestamp: Date.now(),
      hour: new Date().getHours(),
      day: new Date().getDay()
    });
    
    this.saveLearningData();
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  async loadHistoricalData() {
    try {
      const saved = await this.app.homey.settings.get('learningData');
      if (saved) {
        this.learningData = { ...this.learningData, ...saved };
      }
    } catch (error) {
      this.app.error('Error loading historical data:', error);
    }
  }

  async saveLearningData() {
    try {
      await this.app.homey.settings.set('learningData', this.learningData);
    } catch (error) {
      this.app.error('Error saving learning data:', error);
    }
  }

  generateRecommendation(deviceId, pattern) {
    return {
      action: 'suggest_automation',
      description: `Skapa automation baserad på uppmärksammad pattern`,
      pattern: pattern
    };
  }

  calculateAverageConsumption(hour) {
    // Simplified - would use real historical data
    const baseConsumption = 150;
    const hourlyVariation = {
      0: 0.5, 1: 0.4, 2: 0.4, 3: 0.4, 4: 0.4, 5: 0.5,
      6: 0.7, 7: 0.9, 8: 0.8, 9: 0.7, 10: 0.7, 11: 0.7,
      12: 0.8, 13: 0.7, 14: 0.7, 15: 0.7, 16: 0.8, 17: 0.9,
      18: 1.0, 19: 1.1, 20: 1.0, 21: 0.9, 22: 0.7, 23: 0.6
    };
    
    return baseConsumption * (hourlyVariation[hour] || 0.7);
  }

  async getCurrentEnergyConsumption() {
    // Would get real consumption from energy manager
    return 245;
  }

  async generateEnergySavingSuggestions() {
    return [
      'Sänk termostaten med 1°C',
      'Stäng av oanvända lampor',
      'Aktivera energisparläge'
    ];
  }

  isAnomalousUsage(deviceId, usagePattern) {
    // Simplified anomaly detection
    const recentEvents = usagePattern.events.slice(-10);
    const avgDuration = recentEvents.reduce((sum, e) => sum + (e.duration || 60), 0) / recentEvents.length;
    const currentDuration = Date.now() - (recentEvents[recentEvents.length - 1]?.timestamp || Date.now());
    
    return currentDuration > avgDuration * 2;
  }

  calculatePotentialSavings(device) {
    const power = device.capabilitiesObj?.measure_power?.value || 10;
    const kWhPerDay = (power / 1000) * 2; // Assume 2 hours saving
    const costPerKWh = 2.5; // SEK
    
    return {
      kWh: kWhPerDay,
      sek: kWhPerDay * costPerKWh
    };
  }

  async getZoneTemperature(zoneId) {
    // Would get real temperature from sensors
    return 20 + Math.random() * 3;
  }

  async getOpenSensors() {
    // Would check real sensor states
    return [];
  }

  findRepeatedManualActions() {
    // Analyze learning data for patterns
    return [
      {
        description: 'stänger av vardagsrumsbelysningen vid 23:00',
        frequency: 25,
        pattern: { type: 'time', hour: 23, action: 'lights_off', zone: 'living_room' }
      }
    ];
  }

  async generateDailyLearningSummary() {
    const summary = {
      date: new Date().toISOString(),
      patternsDetected: this.patterns.size,
      predictionsGenerated: this.predictions.size,
      recommendations: await this.generateRecommendations()
    };
    
    // Store summary
    this.app.log('Daily learning summary:', summary);
    
    // Could send notification to user
    return summary;
  }

  async initializePredictiveModels() {
    // Initialize various predictive models
    this.models = {
      deviceUsage: new TemporalPatternModel(),
      energyPrediction: new EnergyPredictionModel(),
      presencePrediction: new PresencePredictionModel()
    };
  }
}

// ============================================
// PREDICTIVE MODELS
// ============================================

class TemporalPatternModel {
  constructor() {
    this.patterns = new Map();
  }

  train(data) {
    // Simple temporal pattern recognition
    for (const event of data) {
      const hour = new Date(event.timestamp).getHours();
      const day = new Date(event.timestamp).getDay();
      const key = `${day}-${hour}`;
      
      if (!this.patterns.has(key)) {
        this.patterns.set(key, 0);
      }
      
      this.patterns.set(key, this.patterns.get(key) + 1);
    }
  }

  predict(day, hour) {
    const key = `${day}-${hour}`;
    return this.patterns.get(key) || 0;
  }
}

class EnergyPredictionModel {
  predict(currentHour, historicalData) {
    // Simplified energy prediction
    const baseLoad = 150;
    const timeFactors = [0.5, 0.4, 0.4, 0.4, 0.4, 0.5, 0.7, 0.9, 0.8, 0.7, 0.7, 0.7,
                        0.8, 0.7, 0.7, 0.7, 0.8, 0.9, 1.0, 1.1, 1.0, 0.9, 0.7, 0.6];
    
    return baseLoad * timeFactors[currentHour];
  }
}

class PresencePredictionModel {
  predict(day, hour, historicalData) {
    // Weekday work schedule prediction
    if (day >= 1 && day <= 5) {
      if (hour >= 8 && hour <= 17) {
        return { presence: false, confidence: 0.8 };
      }
    }
    
    return { presence: true, confidence: 0.6 };
  }
}

module.exports = IntelligenceEngine;
