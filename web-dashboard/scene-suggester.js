'use strict';

/**
 * Smart Scene Suggester AI
 * Analyzes usage patterns and suggests new automation scenes
 */
class SceneSuggester {
  constructor(app, intelligenceEngine) {
    this.app = app;
    this.intelligenceEngine = intelligenceEngine;
    this.existingScenes = new Map();
    this.suggestions = [];
    this.implementedSuggestions = new Set();
    this.userFeedback = new Map();
  }

  async initialize() {
    // Load existing scenes
    await this.loadExistingScenes();
    
    // Start suggestion generation
    this.startSuggestionEngine();
  }

  // ============================================
  // SCENE LOADING
  // ============================================

  async loadExistingScenes() {
    // Load from Homey API (simplified)
    const scenes = [
      {
        id: 'scene_morning',
        name: 'Morgon',
        triggers: [{ type: 'time', value: '06:30' }],
        actions: [
          { device: 'kitchen_light', action: 'on', value: 0.8 },
          { device: 'hall_light', action: 'on', value: 0.6 },
          { device: 'thermostat', action: 'increase', value: 1 }
        ],
        usage: 156
      },
      {
        id: 'scene_evening',
        name: 'Kväll',
        triggers: [{ type: 'time', value: '20:00' }],
        actions: [
          { device: 'living_light', action: 'on', value: 0.5 },
          { device: 'tv_light', action: 'on', value: 0.3 }
        ],
        usage: 148
      },
      {
        id: 'scene_movie',
        name: 'Film',
        triggers: [{ type: 'manual' }],
        actions: [
          { device: 'living_light', action: 'dim', value: 0.1 },
          { device: 'tv', action: 'on' }
        ],
        usage: 45
      },
      {
        id: 'scene_away',
        name: 'Borta',
        triggers: [{ type: 'manual' }],
        actions: [
          { device: 'all_lights', action: 'off' },
          { device: 'thermostat', action: 'decrease', value: 2 }
        ],
        usage: 67
      }
    ];

    scenes.forEach(scene => {
      this.existingScenes.set(scene.id, scene);
    });
  }

  // ============================================
  // SUGGESTION ENGINE
  // ============================================

  startSuggestionEngine() {
    // Generate suggestions every hour
    setInterval(() => {
      this.generateSuggestions();
    }, 60 * 60 * 1000);

    // Initial generation
    this.generateSuggestions();
  }

  async generateSuggestions() {
    const newSuggestions = [];

    // Analyze patterns from intelligence engine
    const patterns = await this.analyzePatterns();

    // Generate different types of suggestions
    newSuggestions.push(...await this.suggestTimeBasedScenes(patterns));
    newSuggestions.push(...await this.suggestWeatherBasedScenes(patterns));
    newSuggestions.push(...await this.suggestEnergyOptimizationScenes(patterns));
    newSuggestions.push(...await this.suggestComfortScenes(patterns));
    newSuggestions.push(...await this.suggestActivityScenes(patterns));
    newSuggestions.push(...await this.suggestSequenceScenes(patterns));

    // Filter out low-confidence suggestions
    this.suggestions = newSuggestions.filter(s => s.confidence > 0.6);

    // Rank suggestions
    this.rankSuggestions();

    return this.suggestions;
  }

  async analyzePatterns() {
    // Simulate pattern data (integrate with actual intelligence engine)
    return {
      temporal: {
        morning: { time: '06:30', devices: ['kitchen_light', 'thermostat'], frequency: 0.92 },
        lunch: { time: '12:00', devices: ['kitchen_light', 'kitchen_fan'], frequency: 0.78 },
        afternoon: { time: '15:00', devices: ['office_light'], frequency: 0.65 },
        evening: { time: '20:00', devices: ['living_light', 'tv'], frequency: 0.89 },
        night: { time: '23:00', devices: ['bedroom_light'], frequency: 0.85 }
      },
      device_combinations: [
        { devices: ['living_light', 'tv', 'sound_system'], frequency: 45, context: 'evening' },
        { devices: ['kitchen_light', 'kitchen_fan', 'coffee_maker'], frequency: 23, context: 'morning' },
        { devices: ['bedroom_light', 'thermostat', 'curtains'], frequency: 34, context: 'night' }
      ],
      weather_reactions: [
        { weather: 'rain', actions: ['close_windows', 'turn_on_lights'], frequency: 12 },
        { weather: 'hot', actions: ['lower_blinds', 'increase_fan'], frequency: 18 }
      ],
      presence_patterns: {
        leaving_home: { devices: ['all_lights_off', 'lock_door', 'arm_alarm'], frequency: 0.88 },
        arriving_home: { devices: ['hall_light', 'living_light'], frequency: 0.91 }
      }
    };
  }

  // ============================================
  // SCENE SUGGESTION GENERATORS
  // ============================================

  async suggestTimeBasedScenes(patterns) {
    const suggestions = [];

    // Lunch scene suggestion
    if (patterns.temporal.lunch.frequency > 0.7) {
      suggestions.push({
        id: this.generateSuggestionId(),
        type: 'time_based',
        name: 'Lunch',
        description: 'Automatisera lunchtid med ljus och fläkt',
        confidence: patterns.temporal.lunch.frequency,
        triggers: [
          { type: 'time', value: patterns.temporal.lunch.time }
        ],
        conditions: [
          { type: 'time', operator: 'weekday' }
        ],
        actions: patterns.temporal.lunch.devices.map(device => ({
          device,
          action: 'on',
          value: device.includes('light') ? 0.7 : 1
        })),
        benefits: [
          'Sparar tid',
          'Konsekvent miljö',
          'Automatisk fläktaktivering'
        ],
        estimatedUsage: Math.round(patterns.temporal.lunch.frequency * 30) + ' ggr/månad'
      });
    }

    // Afternoon work scene
    if (patterns.temporal.afternoon.frequency > 0.6) {
      suggestions.push({
        id: this.generateSuggestionId(),
        type: 'time_based',
        name: 'Arbetsläge Eftermiddag',
        description: 'Optimera belysning för eftermiddagsarbete',
        confidence: patterns.temporal.afternoon.frequency,
        triggers: [
          { type: 'time', value: patterns.temporal.afternoon.time }
        ],
        conditions: [
          { type: 'time', operator: 'weekday' },
          { type: 'presence', value: 'home' }
        ],
        actions: [
          { device: 'office_light', action: 'on', value: 0.9 },
          { device: 'desk_lamp', action: 'on', value: 1 }
        ],
        benefits: [
          'Bättre arbetsbelysning',
          'Minskar trötthet',
          'Automatisk aktivering'
        ],
        estimatedUsage: Math.round(patterns.temporal.afternoon.frequency * 22) + ' ggr/månad'
      });
    }

    return suggestions;
  }

  async suggestWeatherBasedScenes(patterns) {
    const suggestions = [];

    // Rainy day scene
    if (patterns.weather_reactions.some(w => w.weather === 'rain')) {
      suggestions.push({
        id: this.generateSuggestionId(),
        type: 'weather_based',
        name: 'Regnväder',
        description: 'Automatiska åtgärder vid regn',
        confidence: 0.85,
        triggers: [
          { type: 'weather', condition: 'rain' }
        ],
        actions: [
          { device: 'all_windows', action: 'close' },
          { device: 'living_light', action: 'on', value: 0.8 },
          { device: 'thermostat', action: 'increase', value: 0.5 }
        ],
        benefits: [
          'Stänger fönster automatiskt',
          'Kompenserar för mörker',
          'Håller värmen inne'
        ],
        estimatedUsage: '8-12 ggr/månad'
      });
    }

    // Hot weather scene
    if (patterns.weather_reactions.some(w => w.weather === 'hot')) {
      suggestions.push({
        id: this.generateSuggestionId(),
        type: 'weather_based',
        name: 'Varmt Väder',
        description: 'Håll hemmet svalt vid höga temperaturer',
        confidence: 0.82,
        triggers: [
          { type: 'weather', condition: 'temperature > 25°C' }
        ],
        actions: [
          { device: 'blinds', action: 'close', value: 0.7 },
          { device: 'fans', action: 'on' },
          { device: 'thermostat', action: 'decrease', value: 1 }
        ],
        benefits: [
          'Minskar värme inomhus',
          'Sparar på luftkonditionering',
          'Automatisk skuggning'
        ],
        estimatedUsage: '15-20 ggr/månad (sommar)'
      });
    }

    return suggestions;
  }

  async suggestEnergyOptimizationScenes(_patterns) {
    const suggestions = [];

    // Low energy price scene
    suggestions.push({
      id: this.generateSuggestionId(),
      type: 'energy_optimization',
      name: 'Lågt Elpris',
      description: 'Maximera förbrukning under billiga timmar',
      confidence: 0.88,
      triggers: [
        { type: 'energy_price', condition: 'below', value: 100 } // öre/kWh
      ],
      actions: [
        { device: 'water_heater', action: 'on' },
        { device: 'ev_charger', action: 'on' },
        { device: 'washing_machine', action: 'schedule' }
      ],
      benefits: [
        'Spara 200-300 kr/månad',
        'Automatisk optimering',
        'Använd billig el'
      ],
      estimatedSavings: '250 kr/månad'
    });

    // High energy price scene
    suggestions.push({
      id: this.generateSuggestionId(),
      type: 'energy_optimization',
      name: 'Högt Elpris',
      description: 'Begränsa förbrukning under dyra timmar',
      confidence: 0.86,
      triggers: [
        { type: 'energy_price', condition: 'above', value: 200 } // öre/kWh
      ],
      actions: [
        { device: 'thermostat', action: 'decrease', value: 1 },
        { device: 'non_essential_devices', action: 'off' },
        { device: 'notification', action: 'send', message: 'Högt elpris - begränsar förbrukning' }
      ],
      benefits: [
        'Undvik dyra toppar',
        'Spara 150-200 kr/månad',
        'Automatisk begränsning'
      ],
      estimatedSavings: '175 kr/månad'
    });

    return suggestions;
  }

  async suggestComfortScenes(_patterns) {
    const suggestions = [];

    // Wake up gently scene
    suggestions.push({
      id: this.generateSuggestionId(),
      type: 'comfort',
      name: 'Mjuk Väckning',
      description: 'Mjuk uppvakning med gradvis belysning',
      confidence: 0.79,
      triggers: [
        { type: 'time', value: '06:00' }
      ],
      conditions: [
        { type: 'time', operator: 'weekday' }
      ],
      actions: [
        { device: 'bedroom_light', action: 'gradual', from: 0, to: 0.8, duration: '15 min' },
        { device: 'thermostat', action: 'increase', value: 1 },
        { device: 'curtains', action: 'open', speed: 'slow' }
      ],
      benefits: [
        'Bättre sömnkvalitet',
        'Naturlig väckning',
        'Mer energi på morgonen'
      ],
      estimatedUsage: '22 ggr/månad'
    });

    // Reading scene
    suggestions.push({
      id: this.generateSuggestionId(),
      type: 'comfort',
      name: 'Läsläge',
      description: 'Optimal belysning för läsning',
      confidence: 0.72,
      triggers: [
        { type: 'manual' }
      ],
      actions: [
        { device: 'reading_lamp', action: 'on', value: 1, temperature: 'warm' },
        { device: 'ambient_lights', action: 'dim', value: 0.2 },
        { device: 'notification', action: 'disable', duration: '60 min' }
      ],
      benefits: [
        'Bättre läsupplevelse',
        'Minskar ögontrötthet',
        'Ingen distraktioner'
      ],
      estimatedUsage: '12-15 ggr/månad'
    });

    return suggestions;
  }

  async suggestActivityScenes(_patterns) {
    const suggestions = [];

    // Workout scene
    suggestions.push({
      id: this.generateSuggestionId(),
      type: 'activity',
      name: 'Träningsläge',
      description: 'Optimera miljön för hemmaträning',
      confidence: 0.68,
      triggers: [
        { type: 'manual' }
      ],
      actions: [
        { device: 'workout_lights', action: 'on', value: 1 },
        { device: 'music_system', action: 'on', playlist: 'workout' },
        { device: 'thermostat', action: 'decrease', value: 2 },
        { device: 'fan', action: 'on' }
      ],
      benefits: [
        'Bättre träningsupplevelse',
        'Motiverande miljö',
        'Optimal temperatur'
      ],
      estimatedUsage: '10-12 ggr/månad'
    });

    // Cooking scene
    suggestions.push({
      id: this.generateSuggestionId(),
      type: 'activity',
      name: 'Matlagning',
      description: 'Perfekt köksmiljö för matlagning',
      confidence: 0.81,
      triggers: [
        { type: 'device_activation', device: 'stove' }
      ],
      actions: [
        { device: 'kitchen_light', action: 'on', value: 1 },
        { device: 'kitchen_fan', action: 'on' },
        { device: 'music', action: 'on', volume: 0.3 }
      ],
      benefits: [
        'Automatisk fläkt',
        'Bra belysning',
        'Trevlig atmosfär'
      ],
      estimatedUsage: '40-50 ggr/månad'
    });

    return suggestions;
  }

  async suggestSequenceScenes(_patterns) {
    const suggestions = [];

    // Bedtime sequence
    suggestions.push({
      id: this.generateSuggestionId(),
      type: 'sequence',
      name: 'Läggdags',
      description: 'Steg-för-steg förberedelse för sömn',
      confidence: 0.84,
      triggers: [
        { type: 'manual' }
      ],
      sequence: [
        { step: 1, delay: 0, actions: [{ device: 'all_lights', action: 'dim', value: 0.3 }] },
        { step: 2, delay: '5 min', actions: [{ device: 'thermostat', action: 'set', value: 19 }] },
        { step: 3, delay: '10 min', actions: [{ device: 'tv', action: 'off' }] },
        { step: 4, delay: '15 min', actions: [{ device: 'all_lights', action: 'off' }, { device: 'bedroom_light', action: 'dim', value: 0.1 }] },
        { step: 5, delay: '20 min', actions: [{ device: 'bedroom_light', action: 'off' }] }
      ],
      benefits: [
        'Bättre sömnförberedelse',
        'Gradvis nedtrappning',
        'Optimal sovmiljö'
      ],
      estimatedUsage: '28-30 ggr/månad'
    });

    return suggestions;
  }

  // ============================================
  // RANKING & FILTERING
  // ============================================

  rankSuggestions() {
    this.suggestions.sort((a, b) => {
      // Calculate score based on multiple factors
      const scoreA = this.calculateSuggestionScore(a);
      const scoreB = this.calculateSuggestionScore(b);
      return scoreB - scoreA;
    });
  }

  calculateSuggestionScore(suggestion) {
    let score = suggestion.confidence * 100;

    // Boost based on type
    const typeBoosts = {
      energy_optimization: 20,
      comfort: 15,
      time_based: 10,
      activity: 10,
      sequence: 15,
      weather_based: 5
    };
    score += typeBoosts[suggestion.type] || 0;

    // Boost if has estimated savings
    if (suggestion.estimatedSavings) {
      score += 15;
    }

    // Boost based on estimated usage
    if (suggestion.estimatedUsage) {
      const usageMatch = suggestion.estimatedUsage.match(/(\d+)/);
      if (usageMatch) {
        const usage = parseInt(usageMatch[1]);
        score += Math.min(usage, 30); // Max +30 points
      }
    }

    // Penalize if already rejected by user
    if (this.userFeedback.get(suggestion.id) === 'rejected') {
      score -= 50;
    }

    // Boost if positively rated
    if (this.userFeedback.get(suggestion.id) === 'liked') {
      score += 30;
    }

    return score;
  }

  // ============================================
  // USER INTERACTION
  // ============================================

  async implementSuggestion(suggestionId) {
    const suggestion = this.suggestions.find(s => s.id === suggestionId);
    
    if (!suggestion) {
      return { success: false, error: 'Suggestion not found' };
    }

    try {
      // Create the scene in Homey
      const scene = await this.createScene(suggestion);
      
      // Mark as implemented
      this.implementedSuggestions.add(suggestionId);
      
      // Add to existing scenes
      this.existingScenes.set(scene.id, scene);

      // Record positive feedback
      this.userFeedback.set(suggestionId, 'implemented');

      return {
        success: true,
        scene: {
          id: scene.id,
          name: scene.name
        }
      };
    } catch (error) {
      console.error('Scene implementation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async createScene(suggestion) {
    // Simulate scene creation (integrate with Homey API)
    const sceneId = `scene_${Date.now()}`;
    
    console.log(`Creating scene: ${suggestion.name}`);

    return {
      id: sceneId,
      name: suggestion.name,
      triggers: suggestion.triggers,
      conditions: suggestion.conditions || [],
      actions: suggestion.sequence ? this.flattenSequence(suggestion.sequence) : suggestion.actions,
      usage: 0
    };
  }

  async rateSuggestion(suggestionId, rating) {
    // rating: 'liked', 'disliked', 'rejected'
    this.userFeedback.set(suggestionId, rating);

    if (rating === 'rejected') {
      // Remove from suggestions
      this.suggestions = this.suggestions.filter(s => s.id !== suggestionId);
    }

    return { success: true };
  }

  async customizeSuggestion(suggestionId, modifications) {
    const suggestion = this.suggestions.find(s => s.id === suggestionId);
    
    if (!suggestion) {
      return { success: false, error: 'Suggestion not found' };
    }

    // Apply modifications
    Object.assign(suggestion, modifications);

    return {
      success: true,
      suggestion
    };
  }

  // ============================================
  // ANALYTICS
  // ============================================

  getSuggestionStats() {
    return {
      total_generated: this.suggestions.length,
      implemented: this.implementedSuggestions.size,
      by_type: this.groupByType(),
      top_suggestions: this.suggestions.slice(0, 5).map(s => ({
        name: s.name,
        type: s.type,
        confidence: Math.round(s.confidence * 100),
        score: Math.round(this.calculateSuggestionScore(s))
      })),
      feedback: {
        liked: Array.from(this.userFeedback.values()).filter(f => f === 'liked').length,
        disliked: Array.from(this.userFeedback.values()).filter(f => f === 'disliked').length,
        rejected: Array.from(this.userFeedback.values()).filter(f => f === 'rejected').length
      }
    };
  }

  groupByType() {
    const groups = {};
    
    this.suggestions.forEach(s => {
      groups[s.type] = (groups[s.type] || 0) + 1;
    });

    return groups;
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  generateSuggestionId() {
    return `suggestion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  flattenSequence(sequence) {
    // Flatten sequence into simple actions for storage
    return sequence.flatMap(step => step.actions);
  }

  // ============================================
  // PUBLIC API
  // ============================================

  async getTopSuggestions(limit = 5) {
    return this.suggestions.slice(0, limit);
  }

  async getSuggestionById(suggestionId) {
    return this.suggestions.find(s => s.id === suggestionId);
  }

  async getSuggestionsByType(type) {
    return this.suggestions.filter(s => s.type === type);
  }

  getImplementedScenes() {
    return Array.from(this.implementedSuggestions);
  }
}

module.exports = SceneSuggester;
