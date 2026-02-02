const EventEmitter = require('events');

/**
 * Home Spa & Sauna Control System
 * 
 * Provides comprehensive spa and sauna automation with wellness tracking,
 * aromatherapy, chromotherapy, and personalized relaxation experiences.
 * 
 * Features:
 * - Traditional and infrared sauna control
 * - Hot tub and jacuzzi automation
 * - Steam room management
 * - Aromatherapy diffusion
 * - Chromotherapy lighting
 * - Personalized wellness programs
 * - Session tracking and health monitoring
 * - Automated cleaning cycles
 * - Energy-efficient scheduling
 * - Safety monitoring and alerts
 */
class HomeSpaAndSaunaSystem extends EventEmitter {
  constructor(homey) {
    super();
    this.homey = homey;
    this.facilities = new Map();
    this.programs = new Map();
    this.sessions = [];
    this.currentSession = null;
    this.monitoringInterval = null;
    
    // Performance optimizations
    this._cache = new Map();
    this._cacheTimeout = 240000; // 4 minutes
    this._healthCheckInterval = null;
  }

  async initialize() {
    this.homey.log('Initializing Home Spa & Sauna System...');
    
    try {
      await this.loadSettings();
      this.initializeDefaultFacilities();
      this.initializeWellnessPrograms();
      
      this.startMonitoring();
      this.startHealthCheck();
      
      this.homey.log('Home Spa & Sauna System initialized successfully');
      return true;
    } catch (error) {
      this.homey.error('Failed to initialize Spa & Sauna System:', error);
      throw error;
    }
  }

  async loadSettings() {
    try {
      const settings = await this.homey.settings.get('homeSpaAndSauna') || {};
      
      if (settings.facilities) {
        settings.facilities.forEach(facility => {
          this.facilities.set(facility.id, facility);
        });
      }
      
      if (settings.programs) {
        settings.programs.forEach(program => {
          this.programs.set(program.id, program);
        });
      }
      
      this.sessions = settings.sessions || [];
      this.currentSession = settings.currentSession || null;
    } catch (error) {
      this.homey.error('Error loading spa settings:', error);
      throw error;
    }
  }

  async saveSettings() {
    try {
      const settings = {
        facilities: Array.from(this.facilities.values()),
        programs: Array.from(this.programs.values()),
        sessions: this.sessions.slice(-100), // Keep last 100
        currentSession: this.currentSession
      };
      
      await this.homey.settings.set('homeSpaAndSauna', settings);
      this._cache.clear();
    } catch (error) {
      this.homey.error('Error saving spa settings:', error);
      throw error;
    }
  }

  initializeDefaultFacilities() {
    if (this.facilities.size === 0) {
      // Traditional Sauna
      this.facilities.set('sauna-traditional', {
        id: 'sauna-traditional',
        name: 'Traditional Finnish Sauna',
        type: 'sauna-traditional',
        status: 'off', // off, heating, ready, in-use, cooling
        temperature: {
          current: 20,
          target: 0,
          min: 60,
          max: 100,
          optimal: 80
        },
        humidity: {
          current: 30,
          target: 0,
          min: 10,
          max: 30
        },
        heater: {
          power: 9000, // watts
          heatupTime: 30, // minutes to reach target
          status: 'off'
        },
        lighting: {
          enabled: false,
          brightness: 0,
          color: 'warm-white',
          chromotherapy: false
        },
        aromatherapy: {
          enabled: false,
          scent: 'none',
          intensity: 0,
          available: ['eucalyptus', 'pine', 'birch', 'lavender', 'mint']
        },
        ventilation: {
          status: 'off',
          speed: 0
        },
        safety: {
          maxSessionTime: 30, // minutes
          doorSensor: 'closed',
          occupancySensor: false,
          temperatureSafety: true,
          autoShutoff: true
        },
        capacity: 6,
        features: {
          benches: 3,
          stereo: true,
          waterBucket: true
        },
        energy: {
          totalUsage: 0
        }
      });

      // Infrared Sauna
      this.facilities.set('sauna-infrared', {
        id: 'sauna-infrared',
        name: 'Infrared Sauna',
        type: 'sauna-infrared',
        status: 'off',
        temperature: {
          current: 20,
          target: 0,
          min: 40,
          max: 65,
          optimal: 55
        },
        heater: {
          type: 'infrared',
          power: 2000,
          heatupTime: 15,
          status: 'off',
          wavelength: 'far-infrared' // near, mid, far
        },
        lighting: {
          enabled: false,
          brightness: 0,
          color: 'red',
          chromotherapy: true,
          program: 'relaxation'
        },
        chromotherapyPrograms: [
          { color: 'red', benefit: 'energy', duration: 10 },
          { color: 'orange', benefit: 'creativity', duration: 8 },
          { color: 'yellow', benefit: 'optimism', duration: 8 },
          { color: 'green', benefit: 'balance', duration: 10 },
          { color: 'blue', benefit: 'calm', duration: 12 },
          { color: 'indigo', benefit: 'intuition', duration: 8 },
          { color: 'violet', benefit: 'spiritual', duration: 10 }
        ],
        music: {
          enabled: false,
          playlist: 'spa-ambient',
          volume: 30
        },
        safety: {
          maxSessionTime: 45,
          doorSensor: 'closed',
          occupancySensor: false,
          autoShutoff: true
        },
        capacity: 2,
        energy: {
          totalUsage: 0
        }
      });

      // Hot Tub / Jacuzzi
      this.facilities.set('hottub-main', {
        id: 'hottub-main',
        name: 'Outdoor Hot Tub',
        type: 'hottub',
        status: 'off',
        temperature: {
          current: 35,
          target: 0,
          min: 35,
          max: 40,
          optimal: 38
        },
        water: {
          level: 100, // %
          quality: 'good',
          ph: 7.4,
          chlorine: 3.0, // ppm
          filterStatus: 'clean',
          filterHours: 0,
          filterLifespan: 720 // hours
        },
        jets: {
          status: 'off',
          intensity: 0, // 0-10
          zones: [
            { id: 1, name: 'Back Jets', status: 'off', intensity: 0 },
            { id: 2, name: 'Lumbar Jets', status: 'off', intensity: 0 },
            { id: 3, name: 'Foot Jets', status: 'off', intensity: 0 },
            { id: 4, name: 'Seat Jets', status: 'off', intensity: 0 }
          ]
        },
        bubbles: {
          status: 'off',
          intensity: 0
        },
        lighting: {
          enabled: false,
          brightness: 0,
          color: 'blue',
          underwater: true,
          perimeter: true
        },
        cover: {
          position: 'closed', // closed, open
          motorized: true
        },
        heater: {
          power: 3000,
          status: 'off'
        },
        safety: {
          maxSessionTime: 30,
          temperatureAlert: true,
          autoShutoff: true
        },
        capacity: 6,
        maintenance: {
          lastCleaned: new Date().toISOString(),
          nextCleaningDue: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        },
        energy: {
          totalUsage: 0
        }
      });

      // Steam Room
      this.facilities.set('steam-room', {
        id: 'steam-room',
        name: 'Steam Room',
        type: 'steam-room',
        status: 'off',
        temperature: {
          current: 20,
          target: 0,
          min: 40,
          max: 50,
          optimal: 45
        },
        humidity: {
          current: 40,
          target: 0,
          min: 95,
          max: 100
        },
        steamGenerator: {
          power: 12000,
          status: 'off',
          waterLevel: 80
        },
        aromatherapy: {
          enabled: false,
          scent: 'none',
          intensity: 0,
          available: ['eucalyptus', 'mint', 'citrus', 'lavender']
        },
        lighting: {
          enabled: false,
          brightness: 0,
          color: 'white',
          chromotherapy: true
        },
        ventilation: {
          status: 'off',
          speed: 0
        },
        safety: {
          maxSessionTime: 20,
          doorSensor: 'closed',
          occupancySensor: false,
          autoShutoff: true
        },
        capacity: 4,
        energy: {
          totalUsage: 0
        }
      });
    }
  }

  initializeWellnessPrograms() {
    if (this.programs.size === 0) {
      // Detox Program
      this.programs.set('detox', {
        id: 'detox',
        name: 'Deep Detox',
        description: 'Cleanse and rejuvenate with heat therapy',
        facility: 'sauna-infrared',
        duration: 45, // minutes
        steps: [
          { minute: 0, temp: 50, lighting: { color: 'red', brightness: 30 }, music: true },
          { minute: 15, temp: 55, lighting: { color: 'orange', brightness: 40 } },
          { minute: 30, temp: 60, lighting: { color: 'yellow', brightness: 50 } },
          { minute: 40, temp: 55, lighting: { color: 'green', brightness: 30 } }
        ],
        benefits: ['detoxification', 'circulation', 'skin-health'],
        recommendedFrequency: '2-3 times per week'
      });

      // Relaxation Program
      this.programs.set('relaxation', {
        id: 'relaxation',
        name: 'Ultimate Relaxation',
        description: 'Stress relief and muscle relaxation',
        facility: 'hottub-main',
        duration: 30,
        steps: [
          { minute: 0, temp: 37, jets: { intensity: 3, zones: [1, 2] }, lighting: { color: 'blue', brightness: 40 } },
          { minute: 10, jets: { intensity: 5, zones: [1, 2, 3] }, bubbles: { intensity: 5 } },
          { minute: 20, jets: { intensity: 7, zones: 'all' }, lighting: { color: 'violet', brightness: 50 } },
          { minute: 25, jets: { intensity: 3 }, bubbles: { intensity: 2 }, lighting: { color: 'blue', brightness: 30 } }
        ],
        benefits: ['stress-relief', 'muscle-relaxation', 'sleep-quality'],
        recommendedFrequency: 'daily'
      });

      // Finnish Experience
      this.programs.set('finnish', {
        id: 'finnish',
        name: 'Traditional Finnish',
        description: 'Authentic sauna experience with löyly',
        facility: 'sauna-traditional',
        duration: 30,
        steps: [
          { minute: 0, temp: 75, humidity: 10, lighting: { brightness: 20, color: 'warm-white' } },
          { minute: 10, temp: 80, humidity: 15, aromatherapy: { scent: 'birch', intensity: 3 } },
          { minute: 15, temp: 85, humidity: 20 },
          { minute: 20, temp: 80, humidity: 15 },
          { minute: 25, temp: 75, ventilation: { speed: 2 } }
        ],
        benefits: ['cardiovascular', 'respiratory', 'relaxation'],
        recommendedFrequency: '2-3 times per week',
        traditions: {
          loyly: true, // Water on hot stones
          vihta: true, // Birch branch whisking
          coolDown: 'required'
        }
      });

      // Respiratory Therapy
      this.programs.set('respiratory', {
        id: 'respiratory',
        name: 'Respiratory Therapy',
        description: 'Steam therapy for respiratory health',
        facility: 'steam-room',
        duration: 20,
        steps: [
          { minute: 0, temp: 43, humidity: 95, aromatherapy: { scent: 'eucalyptus', intensity: 5 } },
          { minute: 10, temp: 45, humidity: 100, aromatherapy: { scent: 'mint', intensity: 4 } },
          { minute: 15, temp: 44, aromatherapy: { scent: 'eucalyptus', intensity: 3 } }
        ],
        benefits: ['respiratory-health', 'sinus-relief', 'relaxation'],
        recommendedFrequency: 'as needed',
        contraindications: ['asthma-severe', 'respiratory-infection']
      });
    }
  }

  startMonitoring() {
    // Monitor facilities every 2 minutes
    this.monitoringInterval = setInterval(() => {
      this.monitorSafety();
      this.monitorMaintenance();
      this.updateCurrentSession();
    }, 120000);
  }

  startHealthCheck() {
    // Health check every minute for active sessions
    this._healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 60000);
  }

  async monitorSafety() {
    try {
      for (const facility of this.facilities.values()) {
        if (facility.status === 'in-use' && this.currentSession) {
          const sessionDuration = (Date.now() - this.currentSession.startTime) / 60000;
          
          // Check max session time
          if (sessionDuration >= facility.safety.maxSessionTime) {
            this.emit('notification', {
              title: 'Session Time Alert',
              message: `Maximum session time reached in ${facility.name}`,
              priority: 'high',
              category: 'spa-safety'
            });
            
            if (facility.safety.autoShutoff) {
              await this.stopProgram(facility.id);
            }
          }
          
          // Temperature safety check
          if (facility.temperature.current > facility.temperature.max + 5) {
            this.emit('notification', {
              title: 'Temperature Warning',
              message: `${facility.name} temperature exceeds safe limits`,
              priority: 'critical',
              category: 'spa-safety'
            });
            
            await this.emergencyShutdown(facility.id);
          }
        }
      }
    } catch (error) {
      this.homey.error('Error monitoring safety:', error);
    }
  }

  async monitorMaintenance() {
    try {
      // Check hot tub filter
      const hottub = this.facilities.get('hottub-main');
      if (hottub && hottub.status !== 'off') {
        hottub.water.filterHours += (2 / 60);
        
        if (hottub.water.filterHours >= hottub.water.filterLifespan) {
          hottub.water.filterStatus = 'replace';
          
          this.emit('notification', {
            title: 'Filter Replacement',
            message: 'Hot tub filter needs replacement',
            priority: 'medium',
            category: 'spa-maintenance'
          });
        }
      }
      
      // Check water quality
      if (hottub && (hottub.water.ph < 7.2 || hottub.water.ph > 7.6)) {
        this.emit('notification', {
          title: 'Water Quality Alert',
          message: `pH level is ${hottub.water.ph} - adjustment needed`,
          priority: 'medium',
          category: 'spa-maintenance'
        });
      }
      
      await this.saveSettings();
    } catch (error) {
      this.homey.error('Error monitoring maintenance:', error);
    }
  }

  async updateCurrentSession() {
    if (!this.currentSession) return;
    
    try {
      const elapsed = Date.now() - this.currentSession.startTime;
      this.currentSession.duration = Math.floor(elapsed / 60000);
    } catch (error) {
      this.homey.error('Error updating session:', error);
    }
  }

  async performHealthCheck() {
    // Check if facilities are responding
    for (const facility of this.facilities.values()) {
      if (facility.status === 'heating' || facility.status === 'in-use') {
        // Verify temperature is progressing
        if (facility.temperature.current < facility.temperature.target - 10) {
          this.homey.log(`Health check: ${facility.name} heating slowly`);
        }
      }
    }
  }

  async startProgram(programId, userId = null) {
    try {
      const program = this.programs.get(programId);
      if (!program) {
        throw new Error('Program not found');
      }

      const facility = this.facilities.get(program.facility);
      if (!facility) {
        throw new Error('Facility not found');
      }

      if (facility.status !== 'off' && facility.status !== 'ready') {
        throw new Error('Facility is not available');
      }

      this.homey.log(`Starting wellness program: ${program.name}`);
      
      // Start heating/preparing facility
      facility.status = 'heating';
      const firstStep = program.steps[0];
      facility.temperature.target = firstStep.temp;
      
      if (firstStep.humidity) {
        facility.humidity.target = firstStep.humidity;
      }
      
      // Simulate heatup time
      const heatupTime = facility.heater.heatupTime * 60000;
      
      setTimeout(async () => {
        facility.status = 'ready';
        facility.temperature.current = facility.temperature.target;
        
        this.emit('notification', {
          title: 'Spa Ready',
          message: `${facility.name} is ready for your ${program.name} session`,
          priority: 'low',
          category: 'spa'
        });
        
        // Auto-start session
        await this.startSession(program.facility, programId, userId);
      }, heatupTime);
      
      await this.saveSettings();
      
      return { program, facility, estimatedReadyTime: heatupTime };
    } catch (error) {
      this.homey.error('Error starting program:', error);
      throw error;
    }
  }

  async startSession(facilityId, programId = null, userId = null) {
    try {
      const facility = this.facilities.get(facilityId);
      if (!facility) {
        throw new Error('Facility not found');
      }

      facility.status = 'in-use';
      
      this.currentSession = {
        id: `session-${Date.now()}`,
        facilityId,
        programId,
        userId,
        startTime: Date.now(),
        duration: 0,
        status: 'active'
      };
      
      this.sessions.push(this.currentSession);
      
      // Apply program steps if program specified
      if (programId) {
        const program = this.programs.get(programId);
        if (program) {
          this.applyProgramSteps(facility, program);
        }
      }
      
      await this.saveSettings();
      
      return { facility, session: this.currentSession };
    } catch (error) {
      this.homey.error('Error starting session:', error);
      throw error;
    }
  }

  async applyProgramSteps(facility, program) {
    for (const step of program.steps) {
      setTimeout(async () => {
        // Apply temperature
        if (step.temp) {
          facility.temperature.target = step.temp;
          facility.temperature.current = step.temp;
        }
        
        // Apply lighting
        if (step.lighting) {
          facility.lighting.enabled = true;
          facility.lighting.color = step.lighting.color || facility.lighting.color;
          facility.lighting.brightness = step.lighting.brightness || 50;
        }
        
        // Apply aromatherapy
        if (step.aromatherapy) {
          facility.aromatherapy.enabled = true;
          facility.aromatherapy.scent = step.aromatherapy.scent;
          facility.aromatherapy.intensity = step.aromatherapy.intensity;
        }
        
        // Apply jets (hot tub)
        if (step.jets && facility.jets) {
          facility.jets.status = 'on';
          facility.jets.intensity = step.jets.intensity;
          
          if (step.jets.zones === 'all') {
            facility.jets.zones.forEach(z => {
              z.status = 'on';
              z.intensity = step.jets.intensity;
            });
          } else if (Array.isArray(step.jets.zones)) {
            step.jets.zones.forEach(zoneId => {
              const zone = facility.jets.zones.find(z => z.id === zoneId);
              if (zone) {
                zone.status = 'on';
                zone.intensity = step.jets.intensity;
              }
            });
          }
        }
        
        // Apply bubbles
        if (step.bubbles && facility.bubbles) {
          facility.bubbles.status = 'on';
          facility.bubbles.intensity = step.bubbles.intensity;
        }
        
        // Apply ventilation
        if (step.ventilation) {
          facility.ventilation.status = 'on';
          facility.ventilation.speed = step.ventilation.speed;
        }
        
        await this.saveSettings();
      }, step.minute * 60000);
    }
  }

  async stopProgram(facilityId) {
    try {
      const facility = this.facilities.get(facilityId);
      if (!facility) {
        throw new Error('Facility not found');
      }

      facility.status = 'cooling';
      
      // Turn off heating
      if (facility.heater) {
        facility.heater.status = 'off';
      }
      if (facility.steamGenerator) {
        facility.steamGenerator.status = 'off';
      }
      
      // Turn off jets/bubbles
      if (facility.jets) {
        facility.jets.status = 'off';
        facility.jets.zones.forEach(z => z.status = 'off');
      }
      if (facility.bubbles) {
        facility.bubbles.status = 'off';
      }
      
      // Enable ventilation for cooling
      facility.ventilation.status = 'on';
      facility.ventilation.speed = 3;
      
      // End session
      if (this.currentSession && this.currentSession.facilityId === facilityId) {
        this.currentSession.endTime = Date.now();
        this.currentSession.status = 'completed';
        this.currentSession = null;
      }
      
      // After cooling period, turn off
      setTimeout(() => {
        facility.status = 'off';
        facility.ventilation.status = 'off';
        facility.lighting.enabled = false;
        facility.aromatherapy.enabled = false;
      }, 300000); // 5 minutes cooling
      
      await this.saveSettings();
      
      return facility;
    } catch (error) {
      this.homey.error('Error stopping program:', error);
      throw error;
    }
  }

  async emergencyShutdown(facilityId) {
    this.homey.log(`EMERGENCY SHUTDOWN: ${facilityId}`);
    
    const facility = this.facilities.get(facilityId);
    if (facility) {
      facility.status = 'emergency-off';
      
      // Turn off all heating/power
      if (facility.heater) facility.heater.status = 'off';
      if (facility.steamGenerator) facility.steamGenerator.status = 'off';
      if (facility.jets) facility.jets.status = 'off';
      
      // Max ventilation
      facility.ventilation.status = 'on';
      facility.ventilation.speed = 5;
      
      await this.saveSettings();
    }
  }

  getFacilities() {
    return Array.from(this.facilities.values());
  }

  getPrograms() {
    return Array.from(this.programs.values());
  }

  getSessions(limit = 30) {
    return this.sessions.slice(-limit).reverse();
  }

  getCurrentSession() {
    return this.currentSession;
  }

  getStats() {
    const facilities = Array.from(this.facilities.values());
    
    return {
      totalFacilities: facilities.length,
      activeFacilities: facilities.filter(f => f.status === 'in-use').length,
      totalSessions: this.sessions.length,
      totalWellnessHours: Math.round(this.sessions.reduce((sum, s) => sum + s.duration, 0) / 60),
      currentSession: this.currentSession,
      energyUsage: facilities.reduce((sum, f) => sum + (f.energy?.totalUsage || 0), 0)
    };
  }

  async destroy() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    if (this._healthCheckInterval) {
      clearInterval(this._healthCheckInterval);
    }
    this._cache.clear();
    this.removeAllListeners();
  }
}

module.exports = HomeSpaAndSaunaSystem;
