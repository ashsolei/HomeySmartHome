const EventEmitter = require('events');

/**
 * Smart Home Theater System
 * 
 * Provides comprehensive home theater automation with immersive audio/video control,
 * content-synchronized lighting, and scene-based experiences.
 * 
 * Features:
 * - Automated projector/screen control
 * - Immersive audio orchestration (Dolby Atmos, 7.1, 5.1)
 * - Content-synchronized ambient lighting (Philips Hue Sync)
 * - Theater scene automation (Movie, Gaming, Sports, Concert)
 * - Popcorn maker and concession automation
 * - Seat and climate control for comfort
 * - Multi-room audio synchronization
 * - Voice command integration
 * - Streaming service integration (Netflix, Disney+, etc)
 * - Acoustic calibration and optimization
 */
class SmartHomeTheaterSystem extends EventEmitter {
  constructor(homey) {
    super();
    this.homey = homey;
    this.theaters = new Map();
    this.scenes = new Map();
    this.viewingSessions = [];
    this.currentSession = null;
    this.monitoringInterval = null;
    
    // Performance optimization
    this._cache = new Map();
    this._cacheTimeout = 300000; // 5 minutes
  }

  async initialize() {
    this.homey.log('Initializing Smart Home Theater System...');
    
    try {
      await this.loadSettings();
      this.initializeDefaultTheaters();
      this.initializeTheaterScenes();
      
      this.startMonitoring();
      
      this.homey.log('Smart Home Theater System initialized successfully');
      return true;
    } catch (error) {
      this.homey.error('Failed to initialize Smart Home Theater System:', error);
      throw error;
    }
  }

  async loadSettings() {
    try {
      const settings = await this.homey.settings.get('smartHomeTheater') || {};
      
      if (settings.theaters) {
        settings.theaters.forEach(theater => {
          this.theaters.set(theater.id, theater);
        });
      }
      
      if (settings.scenes) {
        settings.scenes.forEach(scene => {
          this.scenes.set(scene.id, scene);
        });
      }
      
      this.viewingSessions = settings.viewingSessions || [];
      this.currentSession = settings.currentSession || null;
    } catch (error) {
      this.homey.error('Error loading theater settings:', error);
      throw error;
    }
  }

  async saveSettings() {
    try {
      const settings = {
        theaters: Array.from(this.theaters.values()),
        scenes: Array.from(this.scenes.values()),
        viewingSessions: this.viewingSessions.slice(-50), // Keep last 50
        currentSession: this.currentSession
      };
      
      await this.homey.settings.set('smartHomeTheater', settings);
      
      // Clear cache after save
      this._cache.clear();
    } catch (error) {
      this.homey.error('Error saving theater settings:', error);
      throw error;
    }
  }

  initializeDefaultTheaters() {
    if (this.theaters.size === 0) {
      this.theaters.set('main-theater', {
        id: 'main-theater',
        name: 'Main Home Theater',
        room: 'theater-room',
        status: 'off',
        equipment: {
          projector: {
            id: 'projector-4k',
            model: 'Epson 5050UB',
            status: 'off',
            resolution: '4K',
            brightness: 2600, // lumens
            aspectRatio: '16:9',
            lampHours: 1250,
            lampLifespan: 4000
          },
          screen: {
            id: 'screen-motorized',
            type: 'motorized',
            size: 120, // inches diagonal
            position: 'retracted', // retracted, deployed
            aspectRatio: '16:9'
          },
          avReceiver: {
            id: 'receiver-denon',
            model: 'Denon AVR-X4700H',
            status: 'standby',
            input: 'HDMI1',
            volume: -30, // dB
            audioFormat: 'Dolby Atmos',
            channels: '7.1.4'
          },
          speakers: {
            front_left: { id: 'sp-fl', status: 'ready' },
            front_right: { id: 'sp-fr', status: 'ready' },
            center: { id: 'sp-c', status: 'ready' },
            surround_left: { id: 'sp-sl', status: 'ready' },
            surround_right: { id: 'sp-sr', status: 'ready' },
            rear_left: { id: 'sp-rl', status: 'ready' },
            rear_right: { id: 'sp-rr', status: 'ready' },
            subwoofer: { id: 'sp-sub', status: 'ready', volume: 50 },
            atmos_front_left: { id: 'sp-afl', status: 'ready' },
            atmos_front_right: { id: 'sp-afr', status: 'ready' },
            atmos_rear_left: { id: 'sp-arl', status: 'ready' },
            atmos_rear_right: { id: 'sp-arr', status: 'ready' }
          },
          lighting: {
            ambient: {
              enabled: true,
              brightness: 0,
              color: 'warm-white',
              syncWithContent: false
            },
            sconce: {
              enabled: false,
              brightness: 30
            },
            floor: {
              enabled: true,
              brightness: 10,
              color: 'blue'
            },
            bias: {
              enabled: false,
              brightness: 20,
              color: 'white'
            }
          },
          seating: {
            type: 'recliners',
            count: 8,
            heatedSeats: true,
            massage: false,
            cupHolders: true
          },
          concessions: {
            popcornMaker: {
              id: 'popcorn-maker',
              status: 'off',
              presets: ['classic', 'butter', 'caramel']
            },
            miniBar: {
              enabled: true,
              temperature: 4 // °C
            }
          }
        },
        features: {
          acousticCalibration: true,
          dynamicRangeControl: true,
          lipsync: 'auto',
          hueSync: true,
          voiceControl: true,
          smartPopcorn: true
        },
        presets: {
          movie: { volume: -20, bass: 5, treble: 0 },
          gaming: { volume: -15, bass: 7, treble: 2 },
          sports: { volume: -18, bass: 3, treble: 1 },
          concert: { volume: -12, bass: 4, treble: 3 }
        }
      });
    }
  }

  initializeTheaterScenes() {
    if (this.scenes.size === 0) {
      // Movie Scene
      this.scenes.set('movie-night', {
        id: 'movie-night',
        name: 'Movie Night',
        description: 'Full cinematic experience',
        actions: [
          { device: 'projector', action: 'powerOn', delay: 0 },
          { device: 'screen', action: 'deploy', delay: 2000 },
          { device: 'avReceiver', action: 'powerOn', input: 'HDMI1', delay: 1000 },
          { device: 'lighting', zone: 'ambient', action: 'off', delay: 3000 },
          { device: 'lighting', zone: 'floor', action: 'on', brightness: 10, color: 'blue', delay: 3000 },
          { device: 'seating', action: 'recline', delay: 5000 },
          { device: 'popcornMaker', action: 'start', preset: 'butter', delay: 0 }
        ],
        audioProfile: 'movie',
        lightingProfile: 'cinema',
        temperature: 20,
        notifications: false
      });

      // Gaming Scene
      this.scenes.set('gaming-mode', {
        id: 'gaming-mode',
        name: 'Gaming Mode',
        description: 'Low latency gaming setup',
        actions: [
          { device: 'projector', action: 'powerOn', gameMode: true, delay: 0 },
          { device: 'screen', action: 'deploy', delay: 2000 },
          { device: 'avReceiver', action: 'powerOn', input: 'HDMI2', gameMode: true, delay: 1000 },
          { device: 'lighting', zone: 'ambient', action: 'on', brightness: 30, color: 'gaming-rgb', delay: 3000 },
          { device: 'lighting', zone: 'bias', action: 'on', brightness: 40, delay: 3000 }
        ],
        audioProfile: 'gaming',
        lightingProfile: 'dynamic',
        temperature: 19,
        notifications: true
      });

      // Sports Scene
      this.scenes.set('sports-viewing', {
        id: 'sports-viewing',
        name: 'Sports Viewing',
        description: 'Stadium-like atmosphere',
        actions: [
          { device: 'projector', action: 'powerOn', brightness: 'high', delay: 0 },
          { device: 'screen', action: 'deploy', delay: 2000 },
          { device: 'avReceiver', action: 'powerOn', input: 'TV', delay: 1000 },
          { device: 'lighting', zone: 'ambient', action: 'on', brightness: 40, delay: 3000 },
          { device: 'miniBar', action: 'chill', delay: 0 }
        ],
        audioProfile: 'sports',
        lightingProfile: 'bright',
        temperature: 20,
        notifications: true
      });

      // Concert Scene
      this.scenes.set('concert-experience', {
        id: 'concert-experience',
        name: 'Concert Experience',
        description: 'Live music venue feel',
        actions: [
          { device: 'projector', action: 'powerOn', delay: 0 },
          { device: 'screen', action: 'deploy', delay: 2000 },
          { device: 'avReceiver', action: 'powerOn', input: 'HDMI3', delay: 1000 },
          { device: 'lighting', zone: 'ambient', action: 'on', brightness: 60, color: 'concert-rgb', sync: true, delay: 3000 },
          { device: 'subwoofer', action: 'boost', level: 10, delay: 4000 }
        ],
        audioProfile: 'concert',
        lightingProfile: 'concert',
        temperature: 21,
        notifications: false
      });

      // Shutdown Scene
      this.scenes.set('theater-shutdown', {
        id: 'theater-shutdown',
        name: 'Theater Shutdown',
        description: 'Graceful shutdown sequence',
        actions: [
          { device: 'projector', action: 'powerOff', delay: 0 },
          { device: 'avReceiver', action: 'standby', delay: 1000 },
          { device: 'screen', action: 'retract', delay: 3000 },
          { device: 'lighting', zone: 'all', action: 'on', brightness: 50, delay: 2000 },
          { device: 'seating', action: 'upright', delay: 4000 },
          { device: 'popcornMaker', action: 'off', delay: 0 }
        ]
      });
    }
  }

  startMonitoring() {
    // Monitor theater status every 2 minutes
    this.monitoringInterval = setInterval(() => {
      this.monitorLampLife();
      this.updateViewingSession();
    }, 120000);
  }

  async monitorLampLife() {
    try {
      for (const theater of this.theaters.values()) {
        const projector = theater.equipment.projector;
        
        if (projector.status === 'on') {
          projector.lampHours += (2 / 60); // 2 minutes in hours
        }
        
        const remainingPercent = ((projector.lampLifespan - projector.lampHours) / projector.lampLifespan) * 100;
        
        if (remainingPercent <= 10 && !projector.lampWarningShown) {
          projector.lampWarningShown = true;
          this.emit('notification', {
            title: 'Projector Lamp Warning',
            message: `${theater.name}: Lamp life ${Math.round(remainingPercent)}% remaining`,
            priority: 'high',
            category: 'theater-maintenance'
          });
        }
      }
      
      await this.saveSettings();
    } catch (error) {
      this.homey.error('Error monitoring lamp life:', error);
    }
  }

  async updateViewingSession() {
    if (!this.currentSession) return;
    
    try {
      const elapsed = Date.now() - this.currentSession.startTime;
      this.currentSession.duration = Math.floor(elapsed / 60000); // minutes
    } catch (error) {
      this.homey.error('Error updating viewing session:', error);
    }
  }

  async activateScene(sceneId, theaterId = 'main-theater') {
    try {
      const scene = this.scenes.get(sceneId);
      const theater = this.theaters.get(theaterId);
      
      if (!scene) {
        throw new Error('Scene not found');
      }
      
      if (!theater) {
        throw new Error('Theater not found');
      }

      this.homey.log(`Activating scene: ${scene.name} in ${theater.name}`);
      
      theater.status = 'starting';
      
      // Execute scene actions in sequence
      for (const action of scene.actions) {
        await this.delay(action.delay || 0);
        await this.executeAction(theater, action);
      }
      
      // Apply audio profile
      if (scene.audioProfile && theater.presets[scene.audioProfile]) {
        await this.applyAudioProfile(theater, scene.audioProfile);
      }
      
      // Set temperature
      if (scene.temperature) {
        this.emit('setTemperature', {
          zone: theater.room,
          temperature: scene.temperature
        });
      }
      
      theater.status = 'active';
      theater.activeScene = sceneId;
      
      // Start viewing session
      if (sceneId !== 'theater-shutdown') {
        this.currentSession = {
          id: `session-${Date.now()}`,
          theaterId,
          sceneId,
          startTime: Date.now(),
          duration: 0,
          content: null
        };
        this.viewingSessions.push(this.currentSession);
      } else {
        if (this.currentSession) {
          this.currentSession.endTime = Date.now();
          this.currentSession = null;
        }
        theater.status = 'off';
      }
      
      await this.saveSettings();
      
      this.emit('notification', {
        title: 'Theater Scene Active',
        message: `${scene.name} activated in ${theater.name}`,
        priority: 'low',
        category: 'theater'
      });
      
      this.emit('sceneActivated', { scene, theater });
      
      return { scene, theater, session: this.currentSession };
    } catch (error) {
      this.homey.error('Error activating scene:', error);
      throw error;
    }
  }

  async executeAction(theater, action) {
    try {
      switch (action.device) {
        case 'projector':
          await this.controlProjector(theater, action);
          break;
        case 'screen':
          await this.controlScreen(theater, action);
          break;
        case 'avReceiver':
          await this.controlAVReceiver(theater, action);
          break;
        case 'lighting':
          await this.controlLighting(theater, action);
          break;
        case 'seating':
          await this.controlSeating(theater, action);
          break;
        case 'popcornMaker':
          await this.controlPopcornMaker(theater, action);
          break;
        case 'miniBar':
          await this.controlMiniBar(theater, action);
          break;
        case 'subwoofer':
          await this.controlSubwoofer(theater, action);
          break;
      }
    } catch (error) {
      this.homey.error(`Error executing action for ${action.device}:`, error);
      // Continue with other actions even if one fails
    }
  }

  async controlProjector(theater, action) {
    const projector = theater.equipment.projector;
    
    switch (action.action) {
      case 'powerOn':
        projector.status = 'warming';
        await this.delay(10000); // Warm-up time
        projector.status = 'on';
        if (action.gameMode) {
          projector.latency = 'low';
        }
        break;
      case 'powerOff':
        projector.status = 'cooling';
        await this.delay(60000); // Cool-down time
        projector.status = 'off';
        break;
    }
  }

  async controlScreen(theater, action) {
    const screen = theater.equipment.screen;
    
    switch (action.action) {
      case 'deploy':
        screen.position = 'deploying';
        await this.delay(5000);
        screen.position = 'deployed';
        break;
      case 'retract':
        screen.position = 'retracting';
        await this.delay(5000);
        screen.position = 'retracted';
        break;
    }
  }

  async controlAVReceiver(theater, action) {
    const receiver = theater.equipment.avReceiver;
    
    switch (action.action) {
      case 'powerOn':
        receiver.status = 'on';
        if (action.input) {
          receiver.input = action.input;
        }
        if (action.gameMode) {
          receiver.processingMode = 'direct';
        }
        break;
      case 'standby':
        receiver.status = 'standby';
        break;
    }
  }

  async controlLighting(theater, action) {
    const zone = action.zone;
    const lighting = theater.equipment.lighting;
    
    if (zone === 'all') {
      Object.keys(lighting).forEach(lightZone => {
        lighting[lightZone].enabled = action.action === 'on';
        if (action.brightness !== undefined) {
          lighting[lightZone].brightness = action.brightness;
        }
      });
    } else if (lighting[zone]) {
      lighting[zone].enabled = action.action === 'on';
      if (action.brightness !== undefined) {
        lighting[zone].brightness = action.brightness;
      }
      if (action.color) {
        lighting[zone].color = action.color;
      }
      if (action.sync) {
        lighting[zone].syncWithContent = true;
      }
    }
    
    this.emit('setLights', {
      zone: theater.room,
      state: action.action === 'on' ? 'on' : 'off',
      brightness: action.brightness,
      color: action.color
    });
  }

  async controlSeating(theater, action) {
    switch (action.action) {
      case 'recline':
        // Trigger motorized seating
        this.emit('controlDevice', {
          device: 'theater-seating',
          action: 'recline'
        });
        break;
      case 'upright':
        this.emit('controlDevice', {
          device: 'theater-seating',
          action: 'upright'
        });
        break;
    }
  }

  async controlPopcornMaker(theater, action) {
    const popcorn = theater.equipment.concessions.popcornMaker;
    
    switch (action.action) {
      case 'start':
        popcorn.status = 'running';
        this.emit('controlDevice', {
          device: popcorn.id,
          action: 'start',
          preset: action.preset || 'classic'
        });
        
        // Auto-stop after 5 minutes
        setTimeout(() => {
          popcorn.status = 'ready';
          this.emit('notification', {
            title: 'Popcorn Ready!',
            message: 'Your popcorn is ready to enjoy',
            priority: 'low',
            category: 'theater'
          });
        }, 300000);
        break;
      case 'off':
        popcorn.status = 'off';
        break;
    }
  }

  async controlMiniBar(theater, action) {
    // Control mini bar temperature
    this.emit('controlDevice', {
      device: 'theater-minibar',
      action: action.action
    });
  }

  async controlSubwoofer(theater, action) {
    const sub = theater.equipment.speakers.subwoofer;
    
    if (action.action === 'boost') {
      sub.volume += action.level || 5;
    }
  }

  async applyAudioProfile(theater, profileName) {
    const profile = theater.presets[profileName];
    const receiver = theater.equipment.avReceiver;
    
    if (profile) {
      receiver.volume = profile.volume;
      // Would apply bass, treble, etc. to actual device
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Cached getter for theaters
  getTheaters() {
    const cacheKey = 'theaters_list';
    const cached = this._cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this._cacheTimeout) {
      return cached.data;
    }
    
    const theaters = Array.from(this.theaters.values());
    this._cache.set(cacheKey, { data: theaters, timestamp: Date.now() });
    return theaters;
  }

  getTheater(theaterId) {
    return this.theaters.get(theaterId);
  }

  getScenes() {
    return Array.from(this.scenes.values());
  }

  getViewingSessions(theaterId = null, limit = 20) {
    let sessions = this.viewingSessions;
    
    if (theaterId) {
      sessions = sessions.filter(s => s.theaterId === theaterId);
    }
    
    return sessions.slice(-limit).reverse();
  }

  getCurrentSession() {
    return this.currentSession;
  }

  getStats() {
    const theaters = Array.from(this.theaters.values());
    const sessions = this.viewingSessions;
    
    return {
      totalTheaters: theaters.length,
      activeTheaters: theaters.filter(t => t.status === 'active').length,
      totalSessions: sessions.length,
      totalViewingHours: Math.round(sessions.reduce((sum, s) => sum + s.duration, 0) / 60),
      currentSession: this.currentSession,
      lampStatus: theaters.map(t => ({
        theater: t.name,
        lampHours: t.equipment.projector.lampHours,
        lampLifespan: t.equipment.projector.lampLifespan,
        remainingPercent: Math.round(
          ((t.equipment.projector.lampLifespan - t.equipment.projector.lampHours) / 
          t.equipment.projector.lampLifespan) * 100
        )
      }))
    };
  }

  async destroy() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    this._cache.clear();
    this.removeAllListeners();
  }
}

module.exports = SmartHomeTheaterSystem;
