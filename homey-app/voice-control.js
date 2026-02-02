'use strict';

/**
 * Voice Control Module
 * Natural language processing for smart home control
 */
class VoiceControl {
  constructor(app) {
    this.app = app;
    this.commands = new Map();
    this.commandHistory = [];
    this.nlpPatterns = this.initializeNLPPatterns();
  }

  async initialize() {
    this.app.log('Voice Control initializing...');
    
    // Register default commands
    this.registerDefaultCommands();
    
    // Setup speech recognition integration
    this.setupSpeechIntegration();
    
    this.app.log('Voice Control initialized');
  }

  // ============================================
  // NLP PATTERNS
  // ============================================

  initializeNLPPatterns() {
    return {
      // Device control patterns
      turnOn: [
        /tänd (.*)/i,
        /slå på (.*)/i,
        /aktivera (.*)/i,
        /turn on (.*)/i,
        /switch on (.*)/i
      ],
      turnOff: [
        /släck (.*)/i,
        /stäng av (.*)/i,
        /slå av (.*)/i,
        /deaktivera (.*)/i,
        /turn off (.*)/i,
        /switch off (.*)/i
      ],
      setBrightness: [
        /sätt (.*) till (\d+) procent/i,
        /sätt ljuset (.*) till (\d+)/i,
        /dimma (.*) till (\d+)/i,
        /set (.*) to (\d+) percent/i
      ],
      setTemperature: [
        /sätt temperaturen (.*) till (\d+) grader/i,
        /höj temperaturen till (\d+)/i,
        /sänk temperaturen till (\d+)/i,
        /set temperature (.*) to (\d+)/i
      ],
      
      // Scene patterns
      activateScene: [
        /aktivera scen (.*)/i,
        /starta (.*) läge/i,
        /sätt (.*) scen/i,
        /activate (.*) scene/i,
        /start (.*) mode/i
      ],
      
      // Query patterns
      whatIs: [
        /vad är temperaturen (.*)/i,
        /hur varmt är det (.*)/i,
        /vilken temperatur är det (.*)/i,
        /what is the temperature (.*)/i,
        /how warm is (.*)/i
      ],
      isOn: [
        /är (.*) på/i,
        /är (.*) tänd/i,
        /is (.*) on/i
      ],
      
      // Automation patterns
      createAutomation: [
        /skapa automation (.*)/i,
        /automatisera (.*)/i,
        /create automation (.*)/i,
        /automate (.*)/i
      ],
      
      // Status patterns
      status: [
        /status/i,
        /läge/i,
        /översikt/i,
        /what's happening/i,
        /home status/i
      ],
      
      // Help patterns
      help: [
        /hjälp/i,
        /vad kan du göra/i,
        /kommandon/i,
        /help/i,
        /what can you do/i
      ]
    };
  }

  // ============================================
  // COMMAND PROCESSING
  // ============================================

  async processCommand(text) {
    const normalizedText = text.toLowerCase().trim();
    
    // Log command
    this.commandHistory.push({
      text,
      timestamp: Date.now(),
      success: false
    });

    // Try to match patterns
    const result = await this.matchAndExecute(normalizedText);
    
    if (result.success) {
      this.commandHistory[this.commandHistory.length - 1].success = true;
      return result;
    }

    // AI-powered fallback
    return await this.aiInterpretation(normalizedText);
  }

  async matchAndExecute(text) {
    // Turn on device
    for (const pattern of this.nlpPatterns.turnOn) {
      const match = text.match(pattern);
      if (match) {
        return await this.executeDeviceCommand(match[1], 'on');
      }
    }

    // Turn off device
    for (const pattern of this.nlpPatterns.turnOff) {
      const match = text.match(pattern);
      if (match) {
        return await this.executeDeviceCommand(match[1], 'off');
      }
    }

    // Set brightness
    for (const pattern of this.nlpPatterns.setBrightness) {
      const match = text.match(pattern);
      if (match) {
        return await this.executeDeviceCommand(match[1], 'dim', parseInt(match[2]) / 100);
      }
    }

    // Set temperature
    for (const pattern of this.nlpPatterns.setTemperature) {
      const match = text.match(pattern);
      if (match) {
        return await this.executeDeviceCommand(match[1] || 'alla', 'temperature', parseInt(match[2]));
      }
    }

    // Activate scene
    for (const pattern of this.nlpPatterns.activateScene) {
      const match = text.match(pattern);
      if (match) {
        return await this.activateScene(match[1]);
      }
    }

    // Query temperature
    for (const pattern of this.nlpPatterns.whatIs) {
      const match = text.match(pattern);
      if (match) {
        return await this.queryTemperature(match[1] || 'alla');
      }
    }

    // Check if device is on
    for (const pattern of this.nlpPatterns.isOn) {
      const match = text.match(pattern);
      if (match) {
        return await this.checkDeviceStatus(match[1]);
      }
    }

    // Status
    for (const pattern of this.nlpPatterns.status) {
      if (text.match(pattern)) {
        return await this.getHomeStatus();
      }
    }

    // Help
    for (const pattern of this.nlpPatterns.help) {
      if (text.match(pattern)) {
        return this.getHelp();
      }
    }

    return { success: false, message: 'Kommandot förstods inte' };
  }

  // ============================================
  // COMMAND EXECUTION
  // ============================================

  async executeDeviceCommand(deviceName, command, value) {
    try {
      const device = await this.findDevice(deviceName);
      
      if (!device) {
        return {
          success: false,
          message: `Kunde inte hitta enhet: ${deviceName}`,
          suggestions: await this.getSimilarDevices(deviceName)
        };
      }

      let result;
      switch (command) {
        case 'on':
          result = await device.setCapabilityValue('onoff', true);
          return {
            success: true,
            message: `${device.name} är nu på`,
            device: device.name
          };

        case 'off':
          result = await device.setCapabilityValue('onoff', false);
          return {
            success: true,
            message: `${device.name} är nu av`,
            device: device.name
          };

        case 'dim':
          result = await device.setCapabilityValue('dim', value);
          return {
            success: true,
            message: `${device.name} är nu ${Math.round(value * 100)}% ljus`,
            device: device.name,
            value
          };

        case 'temperature':
          result = await device.setCapabilityValue('target_temperature', value);
          return {
            success: true,
            message: `Temperaturen är satt till ${value}°C`,
            device: device.name,
            value
          };

        default:
          return {
            success: false,
            message: `Okänt kommando: ${command}`
          };
      }
    } catch (error) {
      return {
        success: false,
        message: `Fel vid utförande: ${error.message}`
      };
    }
  }

  async activateScene(sceneName) {
    try {
      const scenes = {
        'morgon': 'morning',
        'kväll': 'evening',
        'natt': 'night',
        'borta': 'away',
        'film': 'movie',
        'fest': 'party',
        'morning': 'morning',
        'evening': 'evening',
        'night': 'night',
        'away': 'away',
        'movie': 'movie',
        'party': 'party'
      };

      const sceneId = scenes[sceneName.toLowerCase()];
      
      if (!sceneId) {
        return {
          success: false,
          message: `Okänd scen: ${sceneName}`,
          availableScenes: Object.keys(scenes).slice(0, 6)
        };
      }

      // Trigger scene (would be implemented with actual scene manager)
      return {
        success: true,
        message: `Scen "${sceneName}" aktiverad`,
        scene: sceneId
      };
    } catch (error) {
      return {
        success: false,
        message: `Fel vid scenaktivering: ${error.message}`
      };
    }
  }

  async queryTemperature(location) {
    try {
      const devices = await this.app.homey.devices.getDevices();
      const thermometers = Object.values(devices).filter(d => 
        d.capabilities.includes('measure_temperature')
      );

      if (location.toLowerCase() !== 'alla') {
        const device = thermometers.find(d => 
          d.name.toLowerCase().includes(location.toLowerCase())
        );

        if (device) {
          const temp = device.capabilitiesObj.measure_temperature.value;
          return {
            success: true,
            message: `Temperaturen i ${device.name} är ${temp}°C`,
            temperature: temp,
            location: device.name
          };
        }
      }

      // Return all temperatures
      const temps = thermometers.map(d => ({
        name: d.name,
        temperature: d.capabilitiesObj.measure_temperature.value
      }));

      const avgTemp = temps.reduce((sum, t) => sum + t.temperature, 0) / temps.length;

      return {
        success: true,
        message: `Medeltemperaturen är ${avgTemp.toFixed(1)}°C`,
        temperatures: temps,
        average: avgTemp
      };
    } catch (error) {
      return {
        success: false,
        message: `Kunde inte hämta temperatur: ${error.message}`
      };
    }
  }

  async checkDeviceStatus(deviceName) {
    try {
      const device = await this.findDevice(deviceName);
      
      if (!device) {
        return {
          success: false,
          message: `Kunde inte hitta enhet: ${deviceName}`
        };
      }

      const isOn = device.capabilitiesObj?.onoff?.value || false;

      return {
        success: true,
        message: `${device.name} är ${isOn ? 'på' : 'av'}`,
        device: device.name,
        status: isOn
      };
    } catch (error) {
      return {
        success: false,
        message: `Fel vid statuscheck: ${error.message}`
      };
    }
  }

  async getHomeStatus() {
    try {
      const devices = await this.app.homey.devices.getDevices();
      const devicesArray = Object.values(devices);

      const lightsOn = devicesArray.filter(d => 
        d.class === 'light' && d.capabilitiesObj?.onoff?.value
      ).length;

      const thermostats = devicesArray.filter(d => 
        d.capabilities?.includes('measure_temperature')
      );
      const avgTemp = thermostats.length > 0
        ? thermostats.reduce((sum, d) => sum + (d.capabilitiesObj?.measure_temperature?.value || 0), 0) / thermostats.length
        : 0;

      const totalPower = devicesArray.reduce((sum, d) => 
        sum + (d.capabilitiesObj?.measure_power?.value || 0), 0
      );

      return {
        success: true,
        message: `${lightsOn} lampor på, medeltemperatur ${avgTemp.toFixed(1)}°C, förbrukar ${Math.round(totalPower)}W`,
        status: {
          lightsOn,
          averageTemperature: avgTemp,
          powerConsumption: totalPower,
          totalDevices: devicesArray.length
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Kunde inte hämta status: ${error.message}`
      };
    }
  }

  getHelp() {
    return {
      success: true,
      message: 'Här är några exempel på kommandon',
      commands: [
        'Tänd vardagsrummet',
        'Släck köket',
        'Sätt sovrummet till 50 procent',
        'Sätt temperaturen till 21 grader',
        'Aktivera scen kväll',
        'Vad är temperaturen i vardagsrummet',
        'Är lampan på',
        'Status'
      ],
      categories: {
        'Enhetskontroll': ['tänd', 'släck', 'sätt till X procent'],
        'Temperatur': ['sätt temperaturen till X grader', 'vad är temperaturen'],
        'Scener': ['aktivera scen X'],
        'Status': ['status', 'är X på']
      }
    };
  }

  // ============================================
  // AI INTERPRETATION
  // ============================================

  async aiInterpretation(text) {
    // Use intelligence engine for interpretation
    if (this.app.intelligenceEngine) {
      // Extract intent and entities
      const intent = this.extractIntent(text);
      const entities = this.extractEntities(text);

      if (intent && entities.length > 0) {
        return await this.executeIntent(intent, entities);
      }
    }

    return {
      success: false,
      message: 'Förlåt, jag förstod inte det kommandot',
      suggestion: 'Säg "hjälp" för att se exempel på kommandon'
    };
  }

  extractIntent(text) {
    const keywords = {
      control: ['tänd', 'släck', 'stäng', 'slå', 'turn', 'switch'],
      query: ['vad', 'hur', 'vilken', 'what', 'how', 'which'],
      scene: ['scen', 'läge', 'mode', 'scene'],
      automation: ['automatisera', 'schema', 'automate', 'schedule']
    };

    for (const [intent, words] of Object.entries(keywords)) {
      if (words.some(word => text.includes(word))) {
        return intent;
      }
    }

    return null;
  }

  extractEntities(text) {
    const entities = [];
    const words = text.split(' ');

    // Extract numbers
    words.forEach(word => {
      const num = parseInt(word);
      if (!isNaN(num)) {
        entities.push({ type: 'number', value: num });
      }
    });

    // Extract device names (simplified)
    const deviceKeywords = ['lampa', 'ljus', 'light', 'termostat', 'thermostat', 'vägg', 'tak'];
    words.forEach(word => {
      if (deviceKeywords.some(k => word.includes(k))) {
        entities.push({ type: 'device', value: word });
      }
    });

    return entities;
  }

  async executeIntent(intent, entities) {
    // Simplified intent execution
    return {
      success: false,
      message: 'AI-interpretation behöver mer träning',
      intent,
      entities
    };
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  async findDevice(name) {
    const devices = await this.app.homey.devices.getDevices();
    const deviceArray = Object.values(devices);

    // Exact match
    let device = deviceArray.find(d => 
      d.name.toLowerCase() === name.toLowerCase()
    );

    if (device) return device;

    // Partial match
    device = deviceArray.find(d => 
      d.name.toLowerCase().includes(name.toLowerCase()) ||
      name.toLowerCase().includes(d.name.toLowerCase())
    );

    if (device) return device;

    // Zone match
    const zones = await this.app.homey.zones.getZones();
    const zone = Object.values(zones).find(z => 
      z.name.toLowerCase().includes(name.toLowerCase())
    );

    if (zone) {
      return deviceArray.filter(d => d.zone === zone.id);
    }

    return null;
  }

  async getSimilarDevices(name) {
    const devices = await this.app.homey.devices.getDevices();
    const deviceArray = Object.values(devices);

    // Simple similarity based on string inclusion
    return deviceArray
      .filter(d => {
        const deviceName = d.name.toLowerCase();
        const searchName = name.toLowerCase();
        return deviceName.includes(searchName) || searchName.includes(deviceName);
      })
      .slice(0, 5)
      .map(d => d.name);
  }

  registerDefaultCommands() {
    // Commands can be registered for quick execution
    this.commands.set('good morning', async () => {
      return await this.activateScene('morning');
    });

    this.commands.set('good night', async () => {
      return await this.activateScene('night');
    });

    this.commands.set('i am home', async () => {
      return await this.activateScene('home');
    });

    this.commands.set('i am leaving', async () => {
      return await this.activateScene('away');
    });
  }

  setupSpeechIntegration() {
    // Integration with Homey speech recognition
    if (this.app.homey.speechInput) {
      this.app.homey.speechInput.on('speechInput', async (speech) => {
        const result = await this.processCommand(speech.text);
        
        if (result.success && this.app.homey.speechOutput) {
          await this.app.homey.speechOutput.say(result.message);
        }
      });
    }
  }

  getCommandHistory(limit = 10) {
    return this.commandHistory.slice(-limit);
  }

  getSuccessRate() {
    if (this.commandHistory.length === 0) return 0;
    
    const successful = this.commandHistory.filter(c => c.success).length;
    return (successful / this.commandHistory.length) * 100;
  }
}

module.exports = VoiceControl;
