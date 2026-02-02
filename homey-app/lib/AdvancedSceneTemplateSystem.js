'use strict';

/**
 * Advanced Scene Template System
 * Pre-built scene templates with AI customization and quick setup
 */
class AdvancedSceneTemplateSystem {
  constructor(homey) {
    this.homey = homey;
    this.templates = new Map();
    this.customScenes = new Map();
    this.sceneHistory = [];
  }

  async initialize() {
    this.log('Initializing Advanced Scene Template System...');
    
    // Load custom scenes
    const savedScenes = await this.homey.settings.get('customScenes') || {};
    Object.entries(savedScenes).forEach(([id, scene]) => {
      this.customScenes.set(id, scene);
    });

    // Setup default templates
    await this.setupDefaultTemplates();

    this.log('Advanced Scene Template System initialized');
  }

  /**
   * Setup default scene templates
   */
  async setupDefaultTemplates() {
    const templates = [
      // Morning routines
      {
        id: 'good_morning',
        name: 'God morgon',
        category: 'morning',
        description: 'Mjuk väckning med gradvis ljus och trevlig musik',
        icon: 'sunrise',
        actions: [
          { type: 'lights', action: 'fade_in', duration: 900000, brightness: 0.7 },
          { type: 'blinds', action: 'open', delay: 300000 },
          { type: 'music', action: 'play', playlist: 'morning', volume: 0.3 },
          { type: 'climate', action: 'adjust', temperature: 21 },
          { type: 'coffee', action: 'brew', delay: 600000 }
        ],
        customizable: ['duration', 'brightness', 'temperature', 'music']
      },
      {
        id: 'energetic_morning',
        name: 'Energisk morgon',
        category: 'morning',
        description: 'Snabb och energisk start på dagen',
        icon: 'zap',
        actions: [
          { type: 'lights', action: 'on', brightness: 1.0, color: 'white_bright' },
          { type: 'blinds', action: 'open' },
          { type: 'music', action: 'play', playlist: 'energetic', volume: 0.6 },
          { type: 'climate', action: 'adjust', temperature: 19 }
        ],
        customizable: ['brightness', 'volume', 'temperature']
      },

      // Work/Focus scenes
      {
        id: 'focus_mode',
        name: 'Fokusläge',
        category: 'work',
        description: 'Optimal miljö för koncentrerat arbete',
        icon: 'briefcase',
        actions: [
          { type: 'lights', action: 'adjust', brightness: 0.8, color: 'cool_white' },
          { type: 'notifications', action: 'silence' },
          { type: 'music', action: 'play', playlist: 'focus', volume: 0.2 },
          { type: 'climate', action: 'adjust', temperature: 20 },
          { type: 'phone', action: 'do_not_disturb' }
        ],
        customizable: ['brightness', 'temperature', 'music']
      },
      {
        id: 'video_conference',
        name: 'Videomöte',
        category: 'work',
        description: 'Professionell belysning för videomöten',
        icon: 'video',
        actions: [
          { type: 'lights', action: 'adjust', brightness: 0.9, color: 'neutral', zones: ['office'] },
          { type: 'background_lights', action: 'off' },
          { type: 'notifications', action: 'silence' },
          { type: 'door', action: 'lock' }
        ],
        customizable: ['brightness', 'zones']
      },

      // Evening/Relaxation scenes
      {
        id: 'relax_evening',
        name: 'Avkoppling',
        category: 'evening',
        description: 'Lugn och harmonisk kvällsstämning',
        icon: 'moon',
        actions: [
          { type: 'lights', action: 'adjust', brightness: 0.4, color: 'warm' },
          { type: 'music', action: 'play', playlist: 'chill', volume: 0.3 },
          { type: 'climate', action: 'adjust', temperature: 22 },
          { type: 'blinds', action: 'close' },
          { type: 'candles', action: 'on' }
        ],
        customizable: ['brightness', 'temperature', 'music']
      },
      {
        id: 'movie_night',
        name: 'Bioläge',
        category: 'entertainment',
        description: 'Perfekt atmosfär för film',
        icon: 'film',
        actions: [
          { type: 'lights', action: 'dim', brightness: 0.1, zones: ['living_room'] },
          { type: 'tv', action: 'on' },
          { type: 'blinds', action: 'close' },
          { type: 'ambient_lights', action: 'on', color: 'purple' },
          { type: 'notifications', action: 'silence' }
        ],
        customizable: ['brightness', 'ambient_color']
      },
      {
        id: 'reading_mode',
        name: 'Läsläge',
        category: 'evening',
        description: 'Bekväm belysning för läsning',
        icon: 'book',
        actions: [
          { type: 'lights', action: 'adjust', brightness: 0.6, color: 'warm', zones: ['reading_area'] },
          { type: 'other_lights', action: 'dim', brightness: 0.2 },
          { type: 'music', action: 'play', playlist: 'ambient', volume: 0.15 },
          { type: 'climate', action: 'adjust', temperature: 21 }
        ],
        customizable: ['brightness', 'temperature']
      },

      // Sleep scenes
      {
        id: 'bedtime',
        name: 'Sänggåendet',
        category: 'sleep',
        description: 'Förberedelse för sömn med avslappning',
        icon: 'moon-stars',
        actions: [
          { type: 'lights', action: 'fade_out', duration: 1800000, zones: ['all'] },
          { type: 'music', action: 'play', playlist: 'sleep', volume: 0.2 },
          { type: 'climate', action: 'adjust', temperature: 18 },
          { type: 'doors', action: 'lock' },
          { type: 'security', action: 'arm', mode: 'night' },
          { type: 'music', action: 'stop', delay: 1800000 }
        ],
        customizable: ['duration', 'temperature', 'music']
      },
      {
        id: 'deep_sleep',
        name: 'Djup sömn',
        category: 'sleep',
        description: 'Optimal miljö för djup sömn',
        icon: 'sleep',
        actions: [
          { type: 'lights', action: 'off', zones: ['all'] },
          { type: 'blinds', action: 'close' },
          { type: 'climate', action: 'adjust', temperature: 17 },
          { type: 'white_noise', action: 'on', volume: 0.1 },
          { type: 'notifications', action: 'silence' }
        ],
        customizable: ['temperature', 'white_noise']
      },

      // Entertainment scenes
      {
        id: 'party_mode',
        name: 'Festläge',
        category: 'entertainment',
        description: 'Energisk och färgglad partystämning',
        icon: 'party',
        actions: [
          { type: 'lights', action: 'color_loop', speed: 'medium', brightness: 0.8 },
          { type: 'music', action: 'play', playlist: 'party', volume: 0.7 },
          { type: 'climate', action: 'adjust', temperature: 19 },
          { type: 'disco_lights', action: 'on' }
        ],
        customizable: ['brightness', 'speed', 'volume']
      },
      {
        id: 'dinner_party',
        name: 'Middag',
        category: 'entertainment',
        description: 'Elegant och mysig middagsstämning',
        icon: 'utensils',
        actions: [
          { type: 'lights', action: 'adjust', brightness: 0.5, color: 'warm' },
          { type: 'music', action: 'play', playlist: 'dinner', volume: 0.3 },
          { type: 'climate', action: 'adjust', temperature: 21 },
          { type: 'candles', action: 'on' }
        ],
        customizable: ['brightness', 'music', 'temperature']
      },

      // Away/Vacation scenes
      {
        id: 'away_mode',
        name: 'Bortaväroläge',
        category: 'security',
        description: 'Simulerar närvaro när du är borta',
        icon: 'shield',
        actions: [
          { type: 'security', action: 'arm', mode: 'away' },
          { type: 'lights', action: 'random', schedule: 'evening' },
          { type: 'blinds', action: 'random' },
          { type: 'climate', action: 'eco' },
          { type: 'water', action: 'off' },
          { type: 'cameras', action: 'activate' }
        ],
        customizable: ['security_mode', 'climate']
      },
      {
        id: 'vacation_mode',
        name: 'Semesterläge',
        category: 'security',
        description: 'Långtidsfrånvaro med full säkerhet',
        icon: 'suitcase',
        actions: [
          { type: 'security', action: 'arm', mode: 'vacation' },
          { type: 'lights', action: 'simulate_presence' },
          { type: 'climate', action: 'minimum' },
          { type: 'water', action: 'off' },
          { type: 'appliances', action: 'off', exclude: ['fridge', 'freezer'] },
          { type: 'mail_forwarding', action: 'enable' }
        ],
        customizable: ['security_mode', 'presence_simulation']
      },

      // Special occasions
      {
        id: 'romantic',
        name: 'Romantiskt',
        category: 'special',
        description: 'Romantisk och intim stämning',
        icon: 'heart',
        actions: [
          { type: 'lights', action: 'adjust', brightness: 0.2, color: 'red' },
          { type: 'music', action: 'play', playlist: 'romantic', volume: 0.25 },
          { type: 'candles', action: 'on' },
          { type: 'climate', action: 'adjust', temperature: 22 },
          { type: 'notifications', action: 'silence' }
        ],
        customizable: ['brightness', 'color', 'music']
      },
      {
        id: 'celebration',
        name: 'Firande',
        category: 'special',
        description: 'Festlig och glädjefylld stämning',
        icon: 'champagne',
        actions: [
          { type: 'lights', action: 'sparkle', colors: ['gold', 'white'] },
          { type: 'music', action: 'play', playlist: 'celebration', volume: 0.6 },
          { type: 'confetti_cannon', action: 'ready' }
        ],
        customizable: ['colors', 'music']
      },

      // Health & Wellness
      {
        id: 'meditation',
        name: 'Meditation',
        category: 'wellness',
        description: 'Lugn och centrerad miljö för meditation',
        icon: 'lotus',
        actions: [
          { type: 'lights', action: 'adjust', brightness: 0.3, color: 'purple' },
          { type: 'music', action: 'play', playlist: 'meditation', volume: 0.2 },
          { type: 'climate', action: 'adjust', temperature: 21 },
          { type: 'notifications', action: 'silence' },
          { type: 'incense', action: 'on' }
        ],
        customizable: ['brightness', 'music', 'temperature']
      },
      {
        id: 'workout',
        name: 'Träning',
        category: 'wellness',
        description: 'Energisk miljö för hemmaträning',
        icon: 'dumbbell',
        actions: [
          { type: 'lights', action: 'bright', color: 'white' },
          { type: 'music', action: 'play', playlist: 'workout', volume: 0.7 },
          { type: 'climate', action: 'adjust', temperature: 18 },
          { type: 'fan', action: 'on', speed: 'medium' }
        ],
        customizable: ['music', 'temperature', 'fan_speed']
      },

      // Seasonal scenes
      {
        id: 'cozy_winter',
        name: 'Mysig vinter',
        category: 'seasonal',
        description: 'Varm och mysig vinterstämning',
        icon: 'snowflake',
        actions: [
          { type: 'lights', action: 'adjust', brightness: 0.6, color: 'warm_orange' },
          { type: 'fireplace', action: 'on' },
          { type: 'climate', action: 'adjust', temperature: 23 },
          { type: 'music', action: 'play', playlist: 'winter', volume: 0.25 }
        ],
        customizable: ['brightness', 'temperature']
      },
      {
        id: 'summer_breeze',
        name: 'Sommarbris',
        category: 'seasonal',
        description: 'Fräsch och luftig sommarstämning',
        icon: 'sun',
        actions: [
          { type: 'blinds', action: 'adjust', position: 0.5 },
          { type: 'fan', action: 'on', speed: 'low' },
          { type: 'lights', action: 'adjust', brightness: 0.7, color: 'cool_white' },
          { type: 'climate', action: 'adjust', temperature: 21 }
        ],
        customizable: ['blinds', 'fan_speed', 'temperature']
      }
    ];

    for (const template of templates) {
      this.templates.set(template.id, template);
    }

    this.log(`Loaded ${this.templates.size} scene templates`);
  }

  /**
   * Get all templates
   */
  getAllTemplates() {
    return Array.from(this.templates.values());
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(category) {
    return Array.from(this.templates.values())
      .filter(t => t.category === category);
  }

  /**
   * Get template by ID
   */
  getTemplate(id) {
    return this.templates.get(id);
  }

  /**
   * Create scene from template
   */
  async createSceneFromTemplate(templateId, customizations = {}) {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Apply customizations
    const scene = {
      id: `scene_${Date.now()}`,
      name: customizations.name || template.name,
      templateId,
      category: template.category,
      description: customizations.description || template.description,
      icon: customizations.icon || template.icon,
      actions: this.customizeActions(template.actions, customizations),
      created: Date.now(),
      lastUsed: null,
      useCount: 0
    };

    this.customScenes.set(scene.id, scene);
    await this.saveCustomScenes();

    this.log(`Created scene: ${scene.name} from template ${templateId}`);

    return scene;
  }

  /**
   * Customize template actions
   */
  customizeActions(actions, customizations) {
    return actions.map(action => {
      const customAction = { ...action };

      // Apply customizations
      if (customizations.brightness !== undefined && action.type === 'lights') {
        customAction.brightness = customizations.brightness;
      }

      if (customizations.temperature !== undefined && action.type === 'climate') {
        customAction.temperature = customizations.temperature;
      }

      if (customizations.volume !== undefined && action.type === 'music') {
        customAction.volume = customizations.volume;
      }

      if (customizations.duration !== undefined && action.duration) {
        customAction.duration = customizations.duration;
      }

      if (customizations.color !== undefined && action.type === 'lights') {
        customAction.color = customizations.color;
      }

      return customAction;
    });
  }

  /**
   * Execute scene
   */
  async executeScene(sceneId) {
    const scene = this.customScenes.get(sceneId);
    if (!scene) {
      throw new Error(`Scene not found: ${sceneId}`);
    }

    this.log(`Executing scene: ${scene.name}`);

    // Execute each action
    for (const action of scene.actions) {
      try {
        await this.executeAction(action);
      } catch (error) {
        this.error(`Failed to execute action:`, error);
      }
    }

    // Update usage statistics
    scene.lastUsed = Date.now();
    scene.useCount++;

    // Record in history
    this.sceneHistory.push({
      sceneId: scene.id,
      sceneName: scene.name,
      timestamp: Date.now()
    });

    // Keep only last 100 executions
    if (this.sceneHistory.length > 100) {
      this.sceneHistory.shift();
    }

    await this.saveCustomScenes();

    return { success: true, scene: scene.name };
  }

  /**
   * Execute individual action
   */
  async executeAction(action) {
    const devices = this.homey.drivers.getDevices();

    switch (action.type) {
      case 'lights':
        await this.executeLightAction(action, devices);
        break;

      case 'music':
        await this.executeMusicAction(action, devices);
        break;

      case 'climate':
        await this.executeClimateAction(action);
        break;

      case 'blinds':
        await this.executeBlindsAction(action, devices);
        break;

      case 'security':
        await this.executeSecurityAction(action);
        break;

      case 'notifications':
        await this.executeNotificationAction(action);
        break;

      default:
        this.log(`Unknown action type: ${action.type}`);
    }

    // Handle delay if specified
    if (action.delay) {
      await new Promise(resolve => setTimeout(resolve, action.delay));
    }
  }

  /**
   * Execute light action
   */
  async executeLightAction(action, devices) {
    const lights = devices.filter(d => 
      d.hasCapability('onoff') && 
      (d.hasCapability('dim') || d.hasCapability('light_hue'))
    );

    for (const light of lights) {
      try {
        // Filter by zones if specified
        if (action.zones && !this.matchesZone(light, action.zones)) {
          continue;
        }

        switch (action.action) {
          case 'on':
            await light.setCapabilityValue('onoff', true);
            if (action.brightness && light.hasCapability('dim')) {
              await light.setCapabilityValue('dim', action.brightness);
            }
            break;

          case 'off':
            await light.setCapabilityValue('onoff', false);
            break;

          case 'dim':
          case 'adjust':
            if (light.hasCapability('dim')) {
              await light.setCapabilityValue('dim', action.brightness);
            }
            break;

          case 'fade_in':
            await this.fadeLights(light, 0, action.brightness || 0.7, action.duration || 900000);
            break;

          case 'fade_out':
            await this.fadeLights(light, action.brightness || 0.7, 0, action.duration || 900000);
            break;
        }
      } catch (error) {
        this.error(`Failed to control light ${light.name}:`, error);
      }
    }
  }

  /**
   * Fade lights gradually
   */
  async fadeLights(light, fromBrightness, toBrightness, duration) {
    const steps = 20;
    const stepDuration = duration / steps;
    const stepSize = (toBrightness - fromBrightness) / steps;

    let currentBrightness = fromBrightness;

    for (let i = 0; i < steps; i++) {
      currentBrightness += stepSize;
      
      try {
        await light.setCapabilityValue('dim', Math.max(0, Math.min(1, currentBrightness)));
        await new Promise(resolve => setTimeout(resolve, stepDuration));
      } catch {
        break;
      }
    }
  }

  /**
   * Match device to zone
   */
  matchesZone(device, zones) {
    const zoneName = device.zone?.name?.toLowerCase() || '';
    return zones.some(z => zoneName.includes(z.toLowerCase()));
  }

  /**
   * Execute music action
   */
  async executeMusicAction(action, devices) {
    const mediaDevices = devices.filter(d => 
      d.hasCapability('speaker_playing') || d.hasCapability('volume_set')
    );

    for (const device of mediaDevices) {
      try {
        switch (action.action) {
          case 'play':
            if (device.hasCapability('speaker_playing')) {
              await device.setCapabilityValue('speaker_playing', true);
            }
            if (action.volume && device.hasCapability('volume_set')) {
              await device.setCapabilityValue('volume_set', action.volume);
            }
            break;

          case 'stop':
            if (device.hasCapability('speaker_playing')) {
              await device.setCapabilityValue('speaker_playing', false);
            }
            break;
        }
      } catch {}
    }
  }

  /**
   * Execute climate action
   */
  async executeClimateAction(action) {
    try {
      const climateManager = this.homey.app.climateManager;
      if (!climateManager) return;

      const zones = await climateManager.getAllZonesStatus();
      
      for (const zone of zones) {
        if (action.action === 'adjust' && action.temperature) {
          await climateManager.setZoneTemperature(zone.id, action.temperature);
        }
      }
    } catch {}
  }

  /**
   * Execute blinds action
   */
  async executeBlindsAction(action, devices) {
    const blinds = devices.filter(d => 
      d.hasCapability('windowcoverings_state')
    );

    for (const blind of blinds) {
      try {
        switch (action.action) {
          case 'open':
            await blind.setCapabilityValue('windowcoverings_state', 'up');
            break;

          case 'close':
            await blind.setCapabilityValue('windowcoverings_state', 'down');
            break;

          case 'adjust':
            if (blind.hasCapability('windowcoverings_set') && action.position !== undefined) {
              await blind.setCapabilityValue('windowcoverings_set', action.position);
            }
            break;
        }
      } catch {}
    }
  }

  /**
   * Execute security action
   */
  async executeSecurityAction(action) {
    this.log(`Security action: ${action.action}, mode: ${action.mode}`);
    // Would integrate with security system
  }

  /**
   * Execute notification action
   */
  async executeNotificationAction(action) {
    this.log(`Notification action: ${action.action}`);
    // Would integrate with notification manager
  }

  /**
   * Get scene statistics
   */
  getStatistics() {
    return {
      templates: this.templates.size,
      customScenes: this.customScenes.size,
      recentExecutions: this.sceneHistory.slice(-20),
      popularScenes: this.getPopularScenes()
    };
  }

  /**
   * Get popular scenes
   */
  getPopularScenes() {
    return Array.from(this.customScenes.values())
      .sort((a, b) => b.useCount - a.useCount)
      .slice(0, 5)
      .map(s => ({
        id: s.id,
        name: s.name,
        useCount: s.useCount,
        lastUsed: s.lastUsed
      }));
  }

  async saveCustomScenes() {
    const data = {};
    this.customScenes.forEach((scene, id) => {
      data[id] = scene;
    });
    await this.homey.settings.set('customScenes', data);
  }

  log(...args) {
    console.log('[AdvancedSceneTemplateSystem]', ...args);
  }

  error(...args) {
    console.error('[AdvancedSceneTemplateSystem]', ...args);
  }
}

module.exports = AdvancedSceneTemplateSystem;
