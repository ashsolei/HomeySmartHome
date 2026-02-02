'use strict';

/**
 * AI Voice Assistant Integration
 * Advanced natural language processing and conversational AI
 */
class AIVoiceAssistantIntegration {
  constructor(homey) {
    this.homey = homey;
    this.conversationHistory = [];
    this.contextMemory = new Map();
    this.voiceCommands = new Map();
    this.intentRecognition = true;
    this.learningEnabled = true;
    this.commandPatterns = this.initializeCommandPatterns();
  }

  async initialize() {
    this.log('Initializing AI Voice Assistant Integration...');
    
    await this.setupVoiceCommands();
    await this.loadConversationHistory();
    
    this.log('AI Voice Assistant Integration initialized');
  }

  initializeCommandPatterns() {
    return {
      lights: {
        patterns: ['turn on', 'turn off', 'dim', 'brighten', 'set brightness'],
        devices: ['light', 'lamp', 'ljus', 'lampa']
      },
      temperature: {
        patterns: ['set temperature', 'increase', 'decrease', 'warmer', 'cooler'],
        devices: ['thermostat', 'termostat', 'heating', 'värme']
      },
      scenes: {
        patterns: ['activate', 'start', 'run', 'execute', 'aktivera'],
        devices: ['scene', 'scen', 'mode', 'läge']
      },
      security: {
        patterns: ['arm', 'disarm', 'lock', 'unlock', 'lås', 'lås upp'],
        devices: ['alarm', 'lock', 'security', 'säkerhet']
      }
    };
  }

  async setupVoiceCommands() {
    this.registerCommand('turn_on_lights', async (context) => {
      return await this.controlLights('on', context);
    });

    this.registerCommand('turn_off_lights', async (context) => {
      return await this.controlLights('off', context);
    });

    this.registerCommand('set_temperature', async (context) => {
      return await this.setTemperature(context.temperature, context.room);
    });

    this.registerCommand('activate_scene', async (context) => {
      return await this.activateScene(context.scene);
    });

    this.registerCommand('arm_security', async (context) => {
      return await this.armSecurity(context.mode);
    });

    this.registerCommand('device_status', async (context) => {
      return await this.getDeviceStatus(context.device);
    });
  }

  registerCommand(name, handler) {
    this.voiceCommands.set(name, handler);
    this.log(`Registered voice command: ${name}`);
  }

  async processVoiceInput(input, userId = 'default') {
    this.log(`Processing voice input: "${input}"`);

    const conversation = {
      input,
      userId,
      timestamp: Date.now(),
      intent: null,
      entities: [],
      response: null
    };

    try {
      const intent = await this.recognizeIntent(input);
      conversation.intent = intent;

      const entities = await this.extractEntities(input, intent);
      conversation.entities = entities;

      const context = this.buildContext(userId, intent, entities);

      const response = await this.executeIntent(intent, context);
      conversation.response = response;

      this.conversationHistory.push(conversation);
      await this.saveConversationHistory();

      if (this.learningEnabled) {
        await this.learnFromInteraction(conversation);
      }

      return {
        success: true,
        response: response.message,
        actions: response.actions
      };

    } catch (error) {
      this.error(`Voice processing error: ${error.message}`);
      conversation.response = { message: 'Förlåt, jag förstod inte det.', error: error.message };
      return {
        success: false,
        response: 'Förlåt, jag förstod inte det.',
        error: error.message
      };
    }
  }

  async recognizeIntent(input) {
    const lowerInput = input.toLowerCase();

    if (lowerInput.match(/(tänd|slå på|turn on).*(ljus|lampa|light)/)) {
      return 'turn_on_lights';
    }
    if (lowerInput.match(/(släck|stäng av|turn off).*(ljus|lampa|light)/)) {
      return 'turn_off_lights';
    }
    if (lowerInput.match(/(sätt|ställ in|set).*(temperatur|temp|grader)/)) {
      return 'set_temperature';
    }
    if (lowerInput.match(/(aktivera|kör|starta|run|activate).*(scen|scene|läge)/)) {
      return 'activate_scene';
    }
    if (lowerInput.match(/(larm|säkerhet|security|arm)/)) {
      return 'arm_security';
    }
    if (lowerInput.match(/(status|hur|vad|what|how).*(mår|är|is)/)) {
      return 'device_status';
    }

    return 'unknown';
  }

  async extractEntities(input, intent) {
    const entities = [];
    const lowerInput = input.toLowerCase();

    const numberMatch = lowerInput.match(/(\d+)/);
    if (numberMatch) {
      entities.push({ type: 'number', value: parseInt(numberMatch[1]) });
    }

    const roomPatterns = [
      'living room', 'bedroom', 'kitchen', 'bathroom', 'vardagsrum', 'sovrum', 'kök', 'badrum'
    ];
    for (const room of roomPatterns) {
      if (lowerInput.includes(room)) {
        entities.push({ type: 'room', value: room });
        break;
      }
    }

    const scenePatterns = [
      'movie', 'relax', 'party', 'sleep', 'film', 'avslappning', 'fest', 'sömn'
    ];
    for (const scene of scenePatterns) {
      if (lowerInput.includes(scene)) {
        entities.push({ type: 'scene', value: scene });
        break;
      }
    }

    return entities;
  }

  buildContext(userId, intent, entities) {
    const context = {
      userId,
      intent,
      timestamp: Date.now()
    };

    for (const entity of entities) {
      if (entity.type === 'number') {
        context.temperature = entity.value;
      } else if (entity.type === 'room') {
        context.room = entity.value;
      } else if (entity.type === 'scene') {
        context.scene = entity.value;
      }
    }

    const userContext = this.contextMemory.get(userId);
    if (userContext) {
      context.previousIntent = userContext.lastIntent;
      context.previousRoom = userContext.lastRoom;
    }

    return context;
  }

  async executeIntent(intent, context) {
    const handler = this.voiceCommands.get(intent);
    
    if (handler) {
      const result = await handler(context);
      
      this.contextMemory.set(context.userId, {
        lastIntent: intent,
        lastRoom: context.room,
        timestamp: Date.now()
      });

      return result;
    }

    return {
      message: 'Förlåt, jag kan inte göra det ännu.',
      actions: []
    };
  }

  async controlLights(action, context) {
    const devices = this.homey.drivers.getDevices();
    const affectedDevices = [];

    for (const device of devices) {
      if (!device.hasCapability('onoff')) continue;

      const deviceName = device.name.toLowerCase();
      const deviceZone = device.zone?.name?.toLowerCase() || '';

      if ((deviceName.includes('light') || deviceName.includes('lamp') || 
           deviceName.includes('ljus') || deviceName.includes('lampa')) &&
          (!context.room || deviceZone.includes(context.room.toLowerCase()))) {
        
        try {
          await device.setCapabilityValue('onoff', action === 'on');
          affectedDevices.push(device.name);
        } catch {}
      }
    }

    const roomText = context.room ? ` i ${context.room}` : '';
    const actionText = action === 'on' ? 'tänt' : 'släckt';

    return {
      message: `Jag har ${actionText} ${affectedDevices.length} lampor${roomText}`,
      actions: affectedDevices.map(name => ({ device: name, action }))
    };
  }

  async setTemperature(temperature, room) {
    const devices = this.homey.drivers.getDevices();
    const affectedDevices = [];

    for (const device of devices) {
      if (!device.hasCapability('target_temperature')) continue;

      const deviceZone = device.zone?.name?.toLowerCase() || '';

      if (!room || deviceZone.includes(room.toLowerCase())) {
        try {
          await device.setCapabilityValue('target_temperature', temperature);
          affectedDevices.push(device.name);
        } catch {}
      }
    }

    const roomText = room ? ` i ${room}` : '';
    return {
      message: `Jag har ställt in temperaturen till ${temperature}°C${roomText}`,
      actions: affectedDevices.map(name => ({ device: name, temperature }))
    };
  }

  async activateScene(sceneName) {
    try {
      const sceneLearning = this.homey.app.sceneLearningSystem;
      if (sceneLearning) {
        await sceneLearning.executeScene(sceneName);
        return {
          message: `Jag har aktiverat scenen "${sceneName}"`,
          actions: [{ scene: sceneName, action: 'activated' }]
        };
      }
    } catch {}

    return {
      message: `Kunde inte hitta scenen "${sceneName}"`,
      actions: []
    };
  }

  async armSecurity(mode = 'armed_away') {
    try {
      const security = this.homey.app.advancedSecuritySystem;
      if (security) {
        await security.setSecurityMode(mode);
        return {
          message: `Säkerhetssystemet är nu ${mode}`,
          actions: [{ system: 'security', mode }]
        };
      }
    } catch {}

    return {
      message: 'Kunde inte aktivera säkerhetssystemet',
      actions: []
    };
  }

  async getDeviceStatus(deviceName) {
    const devices = this.homey.drivers.getDevices();
    
    for (const device of devices) {
      if (device.name.toLowerCase().includes(deviceName?.toLowerCase() || '')) {
        const status = await this.getDeviceStatusInfo(device);
        return {
          message: `${device.name}: ${status}`,
          actions: [{ device: device.name, status }]
        };
      }
    }

    return {
      message: `Kunde inte hitta enheten "${deviceName}"`,
      actions: []
    };
  }

  async getDeviceStatusInfo(device) {
    const statusParts = [];

    if (device.hasCapability('onoff')) {
      const isOn = await device.getCapabilityValue('onoff');
      statusParts.push(isOn ? 'på' : 'av');
    }

    if (device.hasCapability('measure_temperature')) {
      const temp = await device.getCapabilityValue('measure_temperature');
      statusParts.push(`${temp}°C`);
    }

    if (device.hasCapability('dim')) {
      const brightness = await device.getCapabilityValue('dim');
      statusParts.push(`${Math.round(brightness * 100)}% ljusstyrka`);
    }

    return statusParts.join(', ') || 'okänd status';
  }

  async learnFromInteraction(conversation) {
    if (conversation.response?.error) return;

    this.log(`Learning from successful interaction: ${conversation.intent}`);
  }

  async loadConversationHistory() {
    const saved = await this.homey.settings.get('voiceConversationHistory') || [];
    this.conversationHistory = saved.slice(-100);
  }

  async saveConversationHistory() {
    await this.homey.settings.set('voiceConversationHistory', this.conversationHistory.slice(-100));
  }

  getStatistics() {
    const intentCounts = {};
    this.conversationHistory.forEach(conv => {
      intentCounts[conv.intent] = (intentCounts[conv.intent] || 0) + 1;
    });

    return {
      totalConversations: this.conversationHistory.length,
      registeredCommands: this.voiceCommands.size,
      intentDistribution: intentCounts,
      learningEnabled: this.learningEnabled
    };
  }

  log(...args) {
    console.log('[AIVoiceAssistantIntegration]', ...args);
  }

  error(...args) {
    console.error('[AIVoiceAssistantIntegration]', ...args);
  }
}

module.exports = AIVoiceAssistantIntegration;
