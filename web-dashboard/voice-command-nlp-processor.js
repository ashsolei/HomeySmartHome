'use strict';

/**
 * Voice Command & NLP Processor
 * Natural language processing for voice commands
 */
class VoiceCommandNLPProcessor {
  constructor(app) {
    this.app = app;
    this.commands = new Map();
    this.commandHistory = [];
    this.userProfiles = new Map();
    this.customPhrases = new Map();
    this.contexts = new Map();
    this.conversationState = null;
  }

  async initialize() {
    await this.setupDefaultCommands();
    await this.setupUserProfiles();
    await this.loadCustomPhrases();
    
    this.startProcessing();
  }

  // ============================================
  // COMMAND DEFINITIONS
  // ============================================

  async setupDefaultCommands() {
    const commands = [
      // Lighting commands
      {
        id: 'lights_on',
        patterns: [
          'tänd lamporna',
          'tänd ljuset',
          'sätt på lamporna',
          'ljus på',
          'tänd belysningen'
        ],
        intent: 'control_lights',
        action: 'turn_on',
        entities: ['all_lights'],
        response: 'Tänder lamporna',
        category: 'lighting'
      },
      {
        id: 'lights_off',
        patterns: [
          'släck lamporna',
          'släck ljuset',
          'stäng av lamporna',
          'ljus av',
          'släck belysningen'
        ],
        intent: 'control_lights',
        action: 'turn_off',
        entities: ['all_lights'],
        response: 'Släcker lamporna',
        category: 'lighting'
      },
      {
        id: 'dim_lights',
        patterns: [
          'dimma lamporna',
          'sänk ljuset',
          'dämpa belysningen',
          'mindre ljus'
        ],
        intent: 'control_lights',
        action: 'dim',
        entities: ['all_lights'],
        extractValue: 'brightness',
        response: 'Dimmar lamporna till {value}%',
        category: 'lighting'
      },

      // Climate commands
      {
        id: 'increase_temp',
        patterns: [
          'höj temperaturen',
          'varmare',
          'öka värmen',
          'värm upp',
          'jag fryser'
        ],
        intent: 'control_climate',
        action: 'increase',
        entities: ['temperature'],
        extractValue: 'degrees',
        response: 'Höjer temperaturen till {value}°C',
        category: 'climate'
      },
      {
        id: 'decrease_temp',
        patterns: [
          'sänk temperaturen',
          'kallare',
          'minska värmen',
          'kyl ner',
          'det är för varmt'
        ],
        intent: 'control_climate',
        action: 'decrease',
        entities: ['temperature'],
        extractValue: 'degrees',
        response: 'Sänker temperaturen till {value}°C',
        category: 'climate'
      },

      // Security commands
      {
        id: 'arm_alarm',
        patterns: [
          'aktivera larmet',
          'sätt på larmet',
          'lås huset',
          'säkerhetsläge på'
        ],
        intent: 'control_security',
        action: 'arm',
        entities: ['alarm_system'],
        response: 'Aktiverar larmet',
        category: 'security'
      },
      {
        id: 'disarm_alarm',
        patterns: [
          'avaktivera larmet',
          'stäng av larmet',
          'lås upp huset',
          'säkerhetsläge av'
        ],
        intent: 'control_security',
        action: 'disarm',
        entities: ['alarm_system'],
        requireConfirmation: true,
        response: 'Avaktiverar larmet',
        category: 'security'
      },

      // Scene commands
      {
        id: 'good_morning',
        patterns: [
          'god morgon',
          'morgonläge',
          'starta dagen',
          'väck mig'
        ],
        intent: 'activate_scene',
        action: 'morning',
        entities: ['morning_scene'],
        response: 'God morgon! Startar morgonrutinen',
        category: 'scene'
      },
      {
        id: 'good_night',
        patterns: [
          'god natt',
          'kvällsläge',
          'läggdags',
          'dags att sova'
        ],
        intent: 'activate_scene',
        action: 'night',
        entities: ['night_scene'],
        response: 'God natt! Aktiverar kvällsläget',
        category: 'scene'
      },
      {
        id: 'movie_mode',
        patterns: [
          'bioläge',
          'filmkväll',
          'dags för film',
          'se film'
        ],
        intent: 'activate_scene',
        action: 'movie',
        entities: ['movie_scene'],
        response: 'Aktiverar bioläge',
        category: 'scene'
      },

      // Information queries
      {
        id: 'current_temp',
        patterns: [
          'hur varmt är det',
          'vilken temperatur',
          'vad är temperaturen',
          'grader inne'
        ],
        intent: 'query_info',
        action: 'get_temperature',
        entities: ['temperature_sensor'],
        response: 'Temperaturen är {value}°C',
        category: 'information'
      },
      {
        id: 'energy_usage',
        patterns: [
          'hur mycket energi',
          'energiförbrukning',
          'strömförbrukning',
          'kilowatt'
        ],
        intent: 'query_info',
        action: 'get_energy',
        entities: ['energy_meter'],
        response: 'Aktuell förbrukning är {value} kWh',
        category: 'information'
      },
      {
        id: 'weather_query',
        patterns: [
          'hur är vädret',
          'vad blir det för väder',
          'väderprognos',
          'ska det regna'
        ],
        intent: 'query_info',
        action: 'get_weather',
        entities: ['weather_service'],
        response: '{weather_description}, {value}°C',
        category: 'information'
      },

      // Media commands
      {
        id: 'play_music',
        patterns: [
          'spela musik',
          'sätt på musik',
          'starta musiken',
          'musik på'
        ],
        intent: 'control_media',
        action: 'play',
        entities: ['media_player'],
        extractValue: 'playlist',
        response: 'Spelar musik',
        category: 'media'
      },
      {
        id: 'pause_music',
        patterns: [
          'pausa',
          'stoppa musiken',
          'sluta spela',
          'musik av'
        ],
        intent: 'control_media',
        action: 'pause',
        entities: ['media_player'],
        response: 'Pausar musiken',
        category: 'media'
      },

      // Appliance commands
      {
        id: 'start_coffee',
        patterns: [
          'brygg kaffe',
          'starta kaffebryggaren',
          'sätt på kaffe',
          'jag vill ha kaffe'
        ],
        intent: 'control_appliance',
        action: 'start',
        entities: ['coffee_maker'],
        response: 'Brygger kaffe',
        category: 'appliance'
      }
    ];

    for (const command of commands) {
      this.commands.set(command.id, {
        ...command,
        timesUsed: 0,
        lastUsed: null,
        successRate: 1.0
      });
    }
  }

  // ============================================
  // NLP PROCESSING
  // ============================================

  async processVoiceCommand(voiceInput, userId = 'default') {
    console.log(`🎤 Processing: "${voiceInput}"`);

    const normalized = this.normalizeInput(voiceInput);
    
    // Find matching command
    const match = await this.findBestMatch(normalized);

    if (!match) {
      return this.handleUnknownCommand(voiceInput, userId);
    }

    // Extract entities and values
    const entities = await this.extractEntities(normalized, match.command);

    // Check if confirmation needed
    if (match.command.requireConfirmation && !entities.confirmed) {
      return this.requestConfirmation(match.command);
    }

    // Execute command
    const result = await this.executeCommand(match.command, entities, userId);

    // Update statistics
    match.command.timesUsed += 1;
    match.command.lastUsed = Date.now();

    // Log to history
    this.commandHistory.push({
      timestamp: Date.now(),
      userId,
      input: voiceInput,
      normalized,
      commandId: match.command.id,
      confidence: match.confidence,
      success: result.success,
      response: result.response
    });

    console.log(`  ✅ ${result.response} (Confidence: ${(match.confidence * 100).toFixed(0)}%)`);

    return result;
  }

  normalizeInput(input) {
    return input
      .toLowerCase()
      .trim()
      .replace(/[?.!]/g, '')
      .replace(/\s+/g, ' ');
  }

  async findBestMatch(normalized) {
    let bestMatch = null;
    let bestScore = 0;

    for (const [_commandId, command] of this.commands) {
      for (const pattern of command.patterns) {
        const score = this.calculateSimilarity(normalized, pattern);
        
        if (score > bestScore) {
          bestScore = score;
          bestMatch = {
            command,
            confidence: score
          };
        }
      }
    }

    // Require at least 70% confidence
    if (bestScore < 0.7) {
      return null;
    }

    return bestMatch;
  }

  calculateSimilarity(input, pattern) {
    // Simple word overlap similarity
    const inputWords = new Set(input.split(' '));
    const patternWords = new Set(pattern.split(' '));
    
    let matches = 0;
    for (const word of inputWords) {
      if (patternWords.has(word)) {
        matches++;
      }
    }

    const similarity = matches / Math.max(inputWords.size, patternWords.size);
    
    // Exact match bonus
    if (input === pattern) {
      return 1.0;
    }

    // Contains pattern bonus
    if (input.includes(pattern) || pattern.includes(input)) {
      return Math.max(similarity, 0.9);
    }

    return similarity;
  }

  async extractEntities(input, command) {
    const entities = {};

    // Extract numeric values
    if (command.extractValue) {
      const numbers = input.match(/\d+/g);
      if (numbers && numbers.length > 0) {
        entities[command.extractValue] = parseInt(numbers[0]);
      } else {
        // Default values based on type
        if (command.extractValue === 'brightness') {
          entities[command.extractValue] = 50; // 50%
        } else if (command.extractValue === 'degrees') {
          if (command.action === 'increase') {
            entities[command.extractValue] = 22; // 22°C
          } else {
            entities[command.extractValue] = 20; // 20°C
          }
        }
      }
    }

    // Extract room/location
    const rooms = ['vardagsrum', 'sovrum', 'kök', 'badrum', 'hall', 'kontor'];
    for (const room of rooms) {
      if (input.includes(room)) {
        entities.room = room;
        break;
      }
    }

    return entities;
  }

  // ============================================
  // COMMAND EXECUTION
  // ============================================

  async executeCommand(command, entities, _userId) {
    console.log(`  🔧 Executing: ${command.intent}/${command.action}`);

    let response = command.response;

    // Replace placeholders
    if (entities.brightness) {
      response = response.replace('{value}', entities.brightness);
    }
    if (entities.degrees) {
      response = response.replace('{value}', entities.degrees);
    }

    // Simulate execution
    switch (command.intent) {
      case 'control_lights':
        await this.controlLights(command.action, entities);
        break;

      case 'control_climate':
        await this.controlClimate(command.action, entities);
        break;

      case 'control_security':
        await this.controlSecurity(command.action, entities);
        break;

      case 'activate_scene':
        await this.activateScene(command.action, entities);
        break;

      case 'query_info':
        const info = await this.queryInformation(command.action);
        response = response.replace('{value}', info.value);
        if (info.description) {
          response = response.replace('{weather_description}', info.description);
        }
        break;

      case 'control_media':
        await this.controlMedia(command.action, entities);
        break;

      case 'control_appliance':
        await this.controlAppliance(command.action, entities);
        break;
    }

    return {
      success: true,
      response,
      commandId: command.id,
      entities
    };
  }

  async controlLights(action, entities) {
    const room = entities.room || 'all';
    const brightness = entities.brightness || 100;

    console.log(`    💡 Lights ${action} in ${room} (${brightness}%)`);
  }

  async controlClimate(action, entities) {
    const degrees = entities.degrees || 21;
    console.log(`    🌡️ Temperature ${action} to ${degrees}°C`);
  }

  async controlSecurity(action, _entities) {
    console.log(`    🔒 Security ${action}`);
  }

  async activateScene(action, _entities) {
    console.log(`    🎬 Scene ${action} activated`);
  }

  async queryInformation(action) {
    const info = {
      get_temperature: { value: 21.5 },
      get_energy: { value: 2.3 },
      get_weather: { value: 15, description: 'Soligt' }
    };

    return info[action] || { value: 'Unknown' };
  }

  async controlMedia(action, _entities) {
    console.log(`    🎵 Media ${action}`);
  }

  async controlAppliance(action, _entities) {
    console.log(`    ⚙️ Appliance ${action}`);
  }

  // ============================================
  // USER PROFILES
  // ============================================

  async setupUserProfiles() {
    const profiles = [
      {
        id: 'anna',
        name: 'Anna',
        voiceSignature: 'female_1',
        preferredLanguage: 'sv-SE',
        permissions: ['all'],
        customCommands: [],
        preferences: {
          lightingLevel: 'bright',
          temperaturePreference: 22,
          musicGenre: 'pop'
        }
      },
      {
        id: 'erik',
        name: 'Erik',
        voiceSignature: 'male_1',
        preferredLanguage: 'sv-SE',
        permissions: ['all'],
        customCommands: [],
        preferences: {
          lightingLevel: 'medium',
          temperaturePreference: 21,
          musicGenre: 'rock'
        }
      },
      {
        id: 'emma',
        name: 'Emma',
        voiceSignature: 'child_1',
        preferredLanguage: 'sv-SE',
        permissions: ['lighting', 'media', 'information'],
        customCommands: [],
        preferences: {
          lightingLevel: 'bright',
          musicGenre: 'pop'
        }
      }
    ];

    for (const profile of profiles) {
      this.userProfiles.set(profile.id, profile);
    }
  }

  async identifyUser(voiceSignature) {
    // Simple voice signature matching
    for (const [userId, profile] of this.userProfiles) {
      if (profile.voiceSignature === voiceSignature) {
        return userId;
      }
    }

    return 'default';
  }

  // ============================================
  // CUSTOM PHRASES
  // ============================================

  async loadCustomPhrases() {
    const phrases = [
      {
        id: 'custom_1',
        userId: 'anna',
        phrase: 'jag går och lägger mig',
        commandId: 'good_night',
        active: true
      },
      {
        id: 'custom_2',
        userId: 'erik',
        phrase: 'kaffe tack',
        commandId: 'start_coffee',
        active: true
      },
      {
        id: 'custom_3',
        userId: 'default',
        phrase: 'mysläge',
        commandId: 'movie_mode',
        active: true
      }
    ];

    for (const phrase of phrases) {
      this.customPhrases.set(phrase.id, phrase);
    }
  }

  async addCustomPhrase(userId, phrase, commandId) {
    const custom = {
      id: `custom_${Date.now()}`,
      userId,
      phrase: phrase.toLowerCase(),
      commandId,
      active: true,
      createdAt: Date.now()
    };

    this.customPhrases.set(custom.id, custom);

    console.log(`✅ Added custom phrase: "${phrase}" → ${commandId}`);

    return custom;
  }

  // ============================================
  // CONTEXT AWARENESS
  // ============================================

  async updateContext(context) {
    this.contexts.set('current', {
      ...context,
      timestamp: Date.now()
    });

    console.log(`📍 Context updated: ${JSON.stringify(context)}`);
  }

  async getContextualResponse(command, entities) {
    const context = this.contexts.get('current');

    if (!context) {
      return null;
    }

    // Adjust based on time of day
    const hour = new Date().getHours();
    
    if (command.id === 'lights_on') {
      if (hour >= 22 || hour < 6) {
        entities.brightness = 30; // Dim at night
        return 'Tänder lamporna i nattläge';
      }
    }

    // Adjust based on presence
    if (context.presence === 'nobody_home') {
      if (command.category === 'lighting') {
        return 'Ingen hemma - simulerar närvaro';
      }
    }

    return null;
  }

  // ============================================
  // CONVERSATION STATE
  // ============================================

  async handleConversation(input, userId) {
    // Check if this is a follow-up
    if (this.conversationState) {
      const elapsed = Date.now() - this.conversationState.timestamp;
      
      // Conversation timeout: 30 seconds
      if (elapsed < 30000) {
        return await this.handleFollowUp(input, userId);
      }
    }

    // New conversation
    this.conversationState = {
      userId,
      timestamp: Date.now(),
      lastCommand: null,
      context: {}
    };

    return await this.processVoiceCommand(input, userId);
  }

  async handleFollowUp(input, userId) {
    const normalized = this.normalizeInput(input);

    // Check for confirmation
    if (normalized.match(/ja|ok|gör det|visst|absolut/)) {
      if (this.conversationState.pendingCommand) {
        return await this.executeCommand(
          this.conversationState.pendingCommand,
          this.conversationState.pendingEntities,
          userId
        );
      }
    }

    // Check for cancellation
    if (normalized.match(/nej|avbryt|stanna|strunta/)) {
      this.conversationState = null;
      return {
        success: true,
        response: 'OK, jag avbryter'
      };
    }

    // Process as new command
    return await this.processVoiceCommand(input, userId);
  }

  requestConfirmation(command) {
    this.conversationState = {
      ...this.conversationState,
      pendingCommand: command,
      pendingEntities: {},
      timestamp: Date.now()
    };

    return {
      success: true,
      response: `Vill du verkligen ${command.response.toLowerCase()}?`,
      requiresConfirmation: true
    };
  }

  handleUnknownCommand(input, userId) {
    console.log(`  ❓ Unknown command: "${input}"`);

    // Learn from unknown commands
    this.logUnknownCommand(input, userId);

    return {
      success: false,
      response: 'Förlåt, jag förstod inte det. Kan du formulera om?',
      error: 'unknown_command'
    };
  }

  logUnknownCommand(input, userId) {
    // Could be used for training/improvement
    console.log(`  📝 Logging unknown: "${input}" from ${userId}`);
  }

  // ============================================
  // MONITORING
  // ============================================

  startProcessing() {
    console.log('🎤 Voice Command & NLP Processor active');

    // Analyze command usage weekly
    setInterval(() => {
      const day = new Date().getDay();
      if (day === 0) { // Sunday
        this.analyzeCommandUsage();
      }
    }, 24 * 60 * 60 * 1000);
  }

  async analyzeCommandUsage() {
    console.log('📊 Analyzing command usage...');

    const recentCommands = this.commandHistory.filter(c => 
      c.timestamp > Date.now() - 30 * 24 * 60 * 60 * 1000
    );

    const byCategory = {};
    const byUser = {};

    for (const cmd of recentCommands) {
      const command = this.commands.get(cmd.commandId);
      
      if (command) {
        // By category
        if (!byCategory[command.category]) {
          byCategory[command.category] = 0;
        }
        byCategory[command.category]++;

        // By user
        if (!byUser[cmd.userId]) {
          byUser[cmd.userId] = 0;
        }
        byUser[cmd.userId]++;
      }
    }

    console.log('  Categories:', byCategory);
    console.log('  Users:', byUser);
  }

  // ============================================
  // REPORTING
  // ============================================

  getCommandStats() {
    const totalCommands = this.commands.size;
    const totalHistory = this.commandHistory.length;
    const recentHistory = this.commandHistory.filter(c => 
      c.timestamp > Date.now() - 7 * 24 * 60 * 60 * 1000
    );

    const successRate = recentHistory.length > 0 ?
      (recentHistory.filter(c => c.success).length / recentHistory.length * 100).toFixed(0) :
      100;

    return {
      totalCommands,
      customPhrases: this.customPhrases.size,
      totalHistory,
      lastWeek: recentHistory.length,
      successRate: successRate + '%',
      users: this.userProfiles.size
    };
  }

  getTopCommands(limit = 10) {
    return Array.from(this.commands.values())
      .filter(c => c.timesUsed > 0)
      .sort((a, b) => b.timesUsed - a.timesUsed)
      .slice(0, limit)
      .map(c => ({
        command: c.patterns[0],
        category: c.category,
        timesUsed: c.timesUsed,
        lastUsed: c.lastUsed ? new Date(c.lastUsed).toLocaleDateString('sv-SE') : 'Never'
      }));
  }

  getRecentCommands(limit = 20) {
    return this.commandHistory
      .slice(-limit)
      .reverse()
      .map(c => ({
        time: new Date(c.timestamp).toLocaleTimeString('sv-SE'),
        user: c.userId,
        command: c.input,
        success: c.success,
        confidence: (c.confidence * 100).toFixed(0) + '%'
      }));
  }

  getUserStats() {
    return Array.from(this.userProfiles.values()).map(u => ({
      name: u.name,
      permissions: u.permissions.join(', '),
      customCommands: u.customCommands.length,
      preferences: Object.keys(u.preferences).length
    }));
  }
}

module.exports = VoiceCommandNLPProcessor;
