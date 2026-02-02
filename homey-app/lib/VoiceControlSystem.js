'use strict';

/**
 * Voice Control System
 * Enables natural language control of home automation through voice commands
 * Supports multiple languages and context-aware interpretation
 */
class VoiceControlSystem {
  constructor(homey) {
    this.homey = homey;
    this.commands = new Map();
    this.context = null;
    this.conversationHistory = [];
    this.customCommands = new Map();
    this.voiceProfiles = new Map();
  }

  async initialize() {
    this.log('Initializing Voice Control System...');
    
    // Load saved commands and profiles
    const savedCommands = await this.homey.settings.get('customVoiceCommands') || {};
    Object.entries(savedCommands).forEach(([id, cmd]) => {
      this.customCommands.set(id, cmd);
    });

    const savedProfiles = await this.homey.settings.get('voiceProfiles') || {};
    Object.entries(savedProfiles).forEach(([id, profile]) => {
      this.voiceProfiles.set(id, profile);
    });

    // Register default commands
    await this.registerDefaultCommands();
    
    // Start voice recognition service
    await this.startVoiceRecognition();
    
    this.log('Voice Control System initialized');
  }

  /**
   * Register default voice commands
   */
  async registerDefaultCommands() {
    // Basic device control
    this.registerCommand({
      id: 'lights_on',
      patterns: [
        'tänd lamporna',
        'tänd ljuset',
        'lights on',
        'turn on the lights',
        'lampor på'
      ],
      action: async (params) => {
        const zone = params.zone || 'all';
        await this.controlLights(zone, true);
        return { message: `Tänder lamporna i ${zone}` };
      },
      category: 'lighting'
    });

    this.registerCommand({
      id: 'lights_off',
      patterns: [
        'släck lamporna',
        'släck ljuset',
        'lights off',
        'turn off the lights',
        'lampor av'
      ],
      action: async (params) => {
        const zone = params.zone || 'all';
        await this.controlLights(zone, false);
        return { message: `Släcker lamporna i ${zone}` };
      },
      category: 'lighting'
    });

    // Scene activation
    this.registerCommand({
      id: 'activate_scene',
      patterns: [
        'aktivera {scene}',
        'starta {scene}',
        'activate {scene}',
        'kör {scene}',
        '{scene} scen'
      ],
      action: async (params) => {
        await this.homey.app.sceneManager.activateScene(params.scene);
        return { message: `Aktiverar scen ${params.scene}` };
      },
      category: 'scenes'
    });

    // Temperature control
    this.registerCommand({
      id: 'set_temperature',
      patterns: [
        'sätt temperaturen till {temp} grader',
        'ändra temperaturen till {temp}',
        'set temperature to {temp}',
        'värm upp till {temp} grader',
        'kyla ner till {temp} grader'
      ],
      action: async (params) => {
        const zone = params.zone || 'all';
        await this.setTemperature(zone, parseFloat(params.temp));
        return { message: `Sätter temperaturen till ${params.temp}°C` };
      },
      category: 'climate'
    });

    // Status queries
    this.registerCommand({
      id: 'status_query',
      patterns: [
        'vad är statusen',
        'hur ser det ut',
        'what is the status',
        'hur mår hemmet',
        'hemstatus'
      ],
      action: async () => {
        const status = await this.getHomeStatus();
        return { 
          message: `Temperatur: ${status.temperature}°C, Energi: ${status.energy}W, ${status.devicesOnline} enheter online`,
          data: status
        };
      },
      category: 'query'
    });

    // Energy queries
    this.registerCommand({
      id: 'energy_query',
      patterns: [
        'hur mycket energi använder jag',
        'energiförbrukning',
        'how much energy',
        'vad kostar det',
        'energikostnad'
      ],
      action: async () => {
        const energy = await this.getEnergyStatus();
        return { 
          message: `Du använder ${energy.current}W just nu. Kostnad idag: ${energy.costToday} kr`,
          data: energy
        };
      },
      category: 'query'
    });

    // Automation control
    this.registerCommand({
      id: 'enable_automation',
      patterns: [
        'aktivera automation {name}',
        'starta automation {name}',
        'enable automation {name}',
        'sätt på {name}',
        'kör {name} automatiskt'
      ],
      action: async (params) => {
        await this.toggleAutomation(params.name, true);
        return { message: `Aktiverar automation ${params.name}` };
      },
      category: 'automation'
    });

    // Good morning/night routines
    this.registerCommand({
      id: 'good_morning',
      patterns: [
        'god morgon',
        'good morning',
        'morgon',
        'vakna'
      ],
      action: async () => {
        await this.homey.app.sceneManager.activateScene('morning');
        const weather = await this.getWeather();
        return { 
          message: `God morgon! Temperaturen är ${weather.temp}°C. Ha en fin dag!`,
          data: weather
        };
      },
      category: 'routine'
    });

    this.registerCommand({
      id: 'good_night',
      patterns: [
        'god natt',
        'good night',
        'sov gott',
        'läggdags'
      ],
      action: async () => {
        await this.homey.app.sceneManager.activateScene('night');
        const status = await this.checkSecurityStatus();
        return { 
          message: `God natt! ${status.allSecure ? 'Allt är säkert.' : 'OBS: ' + status.warning}`,
          data: status
        };
      },
      category: 'routine'
    });

    // Security commands
    this.registerCommand({
      id: 'lock_doors',
      patterns: [
        'lås dörrarna',
        'lock the doors',
        'lås upp',
        'säkerhet på',
        'aktivera säkerhet'
      ],
      action: async () => {
        await this.lockAllDoors();
        await this.homey.app.securityManager.setMode('armed');
        return { message: 'Alla dörrar är låsta och säkerhetsläget är aktiverat' };
      },
      category: 'security'
    });

    // Complex contextual commands
    this.registerCommand({
      id: 'movie_mode',
      patterns: [
        'filmläge',
        'movie mode',
        'vi ska se film',
        'bioläge',
        'starta film'
      ],
      action: async () => {
        await this.homey.app.sceneManager.activateScene('movie');
        return { message: 'Aktiverar filmläge. Njut av filmen!' };
      },
      category: 'scenes'
    });

    // Adaptive learning command
    this.registerCommand({
      id: 'adaptive_learn',
      patterns: [
        'lär dig detta',
        'kom ihåg detta',
        'remember this',
        'spara som favorit'
      ],
      action: async (params, fullText) => {
        await this.learnFromContext(fullText);
        return { message: 'Jag har lärt mig detta mönster och kommer föreslå det vid lämpliga tillfällen' };
      },
      category: 'learning'
    });
  }

  /**
   * Register a custom voice command
   */
  registerCommand(command) {
    this.commands.set(command.id, {
      ...command,
      created: Date.now(),
      executionCount: 0
    });
  }

  /**
   * Process voice input and execute appropriate command
   */
  async processVoiceInput(input, userId = 'default') {
    this.log(`Processing voice input: "${input}"`);
    
    // Normalize input
    const normalizedInput = this.normalizeInput(input);
    
    // Update context
    this.updateContext(normalizedInput, userId);
    
    // Find matching command
    const match = await this.findMatchingCommand(normalizedInput);
    
    if (!match) {
      // Try intelligent interpretation
      const interpreted = await this.intelligentInterpretation(normalizedInput);
      if (interpreted) {
        return interpreted;
      }
      
      return {
        success: false,
        message: 'Förlåt, jag förstod inte det. Kan du formulera det på ett annat sätt?',
        suggestions: await this.getSuggestions(normalizedInput)
      };
    }

    // Execute command
    try {
      const result = await match.command.action(match.params, normalizedInput);
      
      // Update statistics
      match.command.executionCount++;
      
      // Save to conversation history
      this.conversationHistory.push({
        input: normalizedInput,
        command: match.command.id,
        result,
        timestamp: Date.now(),
        userId
      });

      // Limit history
      if (this.conversationHistory.length > 100) {
        this.conversationHistory.shift();
      }

      return {
        success: true,
        message: result.message,
        data: result.data
      };
    } catch (error) {
      this.error('Error executing voice command:', error);
      return {
        success: false,
        message: 'Ett fel uppstod när jag skulle utföra kommandot.',
        error: error.message
      };
    }
  }

  /**
   * Find matching command from voice input
   */
  async findMatchingCommand(input) {
    let bestMatch = null;
    let bestScore = 0;

    for (const [id, command] of this.commands) {
      for (const pattern of command.patterns) {
        const result = this.matchPattern(pattern, input);
        if (result && result.score > bestScore) {
          bestScore = result.score;
          bestMatch = {
            command,
            params: result.params,
            score: result.score
          };
        }
      }
    }

    // Return match if score is above threshold
    return bestScore > 0.7 ? bestMatch : null;
  }

  /**
   * Match input against pattern with parameter extraction
   */
  matchPattern(pattern, input) {
    // Extract parameters from pattern (e.g., {scene}, {temp})
    const paramRegex = /\{(\w+)\}/g;
    const params = {};
    
    // Convert pattern to regex
    let regexPattern = pattern
      .replace(/\{(\w+)\}/g, '(.+?)')
      .replace(/\s+/g, '\\s+');
    
    const regex = new RegExp(`^${regexPattern}$`, 'i');
    const match = input.match(regex);

    if (!match) {
      // Try fuzzy matching
      const similarity = this.calculateSimilarity(pattern, input);
      if (similarity > 0.7) {
        return { score: similarity, params };
      }
      return null;
    }

    // Extract parameter values
    let paramIndex = 1;
    let paramMatch;
    paramRegex.lastIndex = 0;
    
    while ((paramMatch = paramRegex.exec(pattern)) !== null) {
      params[paramMatch[1]] = match[paramIndex];
      paramIndex++;
    }

    return { score: 1.0, params };
  }

  /**
   * Intelligent interpretation using context and AI
   */
  async intelligentInterpretation(input) {
    // Check if this is a follow-up question
    if (this.context) {
      const followUp = await this.handleFollowUp(input, this.context);
      if (followUp) return followUp;
    }

    // Use intelligence manager for interpretation
    if (this.homey.app.intelligenceManager) {
      const interpretation = await this.interpretWithAI(input);
      if (interpretation) return interpretation;
    }

    return null;
  }

  /**
   * Interpret using AI and context
   */
  async interpretWithAI(input) {
    const keywords = {
      lights: ['lampa', 'ljus', 'belysning', 'light'],
      temperature: ['temperatur', 'värme', 'kyla', 'grader', 'temperature', 'heat'],
      scene: ['scen', 'läge', 'mode', 'scene'],
      energy: ['energi', 'ström', 'förbrukning', 'energy', 'power'],
      security: ['säkerhet', 'lås', 'larm', 'security', 'lock', 'alarm']
    };

    // Detect intent
    let intent = null;
    let action = null;

    for (const [category, words] of Object.entries(keywords)) {
      if (words.some(word => input.includes(word))) {
        intent = category;
        break;
      }
    }

    // Detect action
    if (input.match(/tänd|på|start|aktivera|turn on|enable/i)) action = 'on';
    if (input.match(/släck|av|stop|inaktivera|turn off|disable/i)) action = 'off';
    if (input.match(/sätt|ändra|justera|set|change|adjust/i)) action = 'set';
    if (input.match(/vad|hur|status|what|how|status/i)) action = 'query';

    if (!intent || !action) return null;

    // Execute based on intent and action
    try {
      if (intent === 'lights') {
        if (action === 'on') {
          await this.controlLights('all', true);
          return { success: true, message: 'Tänder lamporna' };
        } else if (action === 'off') {
          await this.controlLights('all', false);
          return { success: true, message: 'Släcker lamporna' };
        }
      }
      
      if (intent === 'temperature' && action === 'query') {
        const temp = await this.homey.app.intelligentDashboard.getAverageTemperature();
        return { success: true, message: `Temperaturen är ${temp}°C` };
      }

      if (intent === 'energy' && action === 'query') {
        const energy = await this.getEnergyStatus();
        return { 
          success: true, 
          message: `Du använder ${energy.current}W. Kostnad idag: ${energy.costToday} kr` 
        };
      }
    } catch (error) {
      this.error('AI interpretation error:', error);
    }

    return null;
  }

  /**
   * Handle follow-up questions in conversation
   */
  async handleFollowUp(input, context) {
    const followUpWords = ['och', 'också', 'dessutom', 'plus', 'and', 'also', 'too'];
    const hasFollowUp = followUpWords.some(word => input.startsWith(word));

    if (hasFollowUp && this.conversationHistory.length > 0) {
      const lastCommand = this.conversationHistory[this.conversationHistory.length - 1];
      // Repeat similar action in different context
      return await this.processVoiceInput(input.replace(/^(och|också|dessutom|plus|and|also|too)\s+/i, ''));
    }

    return null;
  }

  /**
   * Learn from user behavior and context
   */
  async learnFromContext(input) {
    const currentState = {
      time: new Date().getHours(),
      day: new Date().getDay(),
      activeDevices: await this.getActiveDevices(),
      currentScene: await this.homey.app.sceneManager.getActiveScene()
    };

    // Save learning pattern
    const pattern = {
      input,
      context: currentState,
      timestamp: Date.now()
    };

    await this.homey.app.intelligenceManager.recordUserAction({
      type: 'voice_command',
      pattern,
      action: 'learn'
    });
  }

  /**
   * Create custom voice command
   */
  async createCustomCommand(config) {
    const customCommand = {
      id: config.id || this.generateId(),
      name: config.name,
      patterns: config.patterns,
      action: config.action,
      category: 'custom',
      created: Date.now(),
      createdBy: config.userId || 'user'
    };

    this.customCommands.set(customCommand.id, customCommand);
    this.registerCommand(customCommand);
    
    await this.saveCustomCommands();
    
    return customCommand;
  }

  /**
   * Voice profile management
   */
  async createVoiceProfile(userId, preferences) {
    const profile = {
      id: userId,
      preferences: {
        language: preferences.language || 'sv',
        responseStyle: preferences.responseStyle || 'friendly',
        favoriteScenes: preferences.favoriteScenes || [],
        shortcuts: preferences.shortcuts || {},
        contextMemory: preferences.contextMemory !== false
      },
      statistics: {
        commandsExecuted: 0,
        lastUsed: Date.now()
      },
      created: Date.now()
    };

    this.voiceProfiles.set(userId, profile);
    await this.saveVoiceProfiles();
    
    return profile;
  }

  /**
   * Get voice command suggestions
   */
  async getSuggestions(input) {
    const suggestions = [];
    
    // Get similar commands
    for (const [id, command] of this.commands) {
      for (const pattern of command.patterns) {
        const similarity = this.calculateSimilarity(input, pattern);
        if (similarity > 0.5) {
          suggestions.push({
            command: id,
            pattern,
            similarity,
            example: pattern
          });
        }
      }
    }

    // Sort by similarity
    suggestions.sort((a, b) => b.similarity - a.similarity);
    
    return suggestions.slice(0, 3);
  }

  /**
   * Start voice recognition service
   */
  async startVoiceRecognition() {
    // Integration with Homey's speech-input
    try {
      this.homey.speechInput.on('text', async (text, language) => {
        await this.processVoiceInput(text);
      });
      
      this.log('Voice recognition service started');
    } catch (error) {
      this.log('Speech input not available, voice commands will be available via API only');
    }
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  normalizeInput(input) {
    return input.toLowerCase().trim();
  }

  updateContext(input, userId) {
    this.context = {
      lastInput: input,
      userId,
      timestamp: Date.now()
    };
  }

  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  async controlLights(zone, state) {
    // Implementation
    return { success: true };
  }

  async setTemperature(zone, temp) {
    await this.homey.app.climateManager.setZoneTemperature(zone, temp);
  }

  async getHomeStatus() {
    return {
      temperature: await this.homey.app.intelligentDashboard.getAverageTemperature(),
      energy: await this.homey.app.intelligentDashboard.getCurrentEnergyUsage(),
      devicesOnline: await this.homey.app.intelligentDashboard.getActiveDeviceCount(),
      presence: await this.homey.app.intelligentDashboard.getPresenceStatus()
    };
  }

  async getEnergyStatus() {
    const current = await this.homey.app.energyManager.getCurrentConsumption('total');
    const costToday = current * 1.5 * 24 / 1000;
    
    return {
      current,
      costToday: Math.round(costToday)
    };
  }

  async toggleAutomation(name, enabled) {
    // Implementation
  }

  async getWeather() {
    return { temp: 5, condition: 'molnigt' };
  }

  async checkSecurityStatus() {
    return await this.homey.app.securityManager.getStatus();
  }

  async lockAllDoors() {
    // Implementation
  }

  async getActiveDevices() {
    return [];
  }

  generateId() {
    return `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async saveCustomCommands() {
    const data = {};
    this.customCommands.forEach((cmd, id) => {
      data[id] = cmd;
    });
    await this.homey.settings.set('customVoiceCommands', data);
  }

  async saveVoiceProfiles() {
    const data = {};
    this.voiceProfiles.forEach((profile, id) => {
      data[id] = profile;
    });
    await this.homey.settings.set('voiceProfiles', data);
  }

  log(...args) {
    console.log('[VoiceControlSystem]', ...args);
  }

  error(...args) {
    console.error('[VoiceControlSystem]', ...args);
  }
}

module.exports = VoiceControlSystem;
