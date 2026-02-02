const EventEmitter = require('events');

/**
 * Advanced Baby & Child Care System
 * 
 * Provides comprehensive child monitoring and care automation with
 * environmental control, sleep tracking, and safety features.
 * 
 * Features:
 * - Baby monitor integration with video/audio
 * - Sleep pattern tracking and analysis
 * - Automated nursery environment control
 * - Feeding and diaper change tracking
 * - Growth milestone monitoring
 * - Safety alerts and emergency notifications
 * - White noise and lullaby automation
 * - Temperature and humidity optimization
 * - Night light automation
 * - Childproofing status monitoring
 */
class AdvancedBabyAndChildCareSystem extends EventEmitter {
  constructor(homey) {
    super();
    this.homey = homey;
    this.children = new Map();
    this.rooms = new Map();
    this.activities = [];
    this.sleepSessions = [];
    this.feedingLog = [];
    this.milestones = [];
    this.monitoringInterval = null;
    
    // Performance optimizations
    this._cache = new Map();
    this._cacheTimeout = 120000; // 2 minutes
  }

  async initialize() {
    this.homey.log('Initializing Advanced Baby & Child Care System...');
    
    try {
      await this.loadSettings();
      this.initializeDefaultChildren();
      this.initializeNurseryRooms();
      
      this.startMonitoring();
      
      this.homey.log('Advanced Baby & Child Care System initialized successfully');
      return true;
    } catch (error) {
      this.homey.error('Failed to initialize Baby & Child Care System:', error);
      throw error;
    }
  }

  async loadSettings() {
    try {
      const settings = await this.homey.settings.get('babyAndChildCare') || {};
      
      if (settings.children) {
        settings.children.forEach(child => {
          this.children.set(child.id, child);
        });
      }
      
      if (settings.rooms) {
        settings.rooms.forEach(room => {
          this.rooms.set(room.id, room);
        });
      }
      
      this.activities = settings.activities || [];
      this.sleepSessions = settings.sleepSessions || [];
      this.feedingLog = settings.feedingLog || [];
      this.milestones = settings.milestones || [];
    } catch (error) {
      this.homey.error('Error loading child care settings:', error);
      throw error;
    }
  }

  async saveSettings() {
    try {
      const settings = {
        children: Array.from(this.children.values()),
        rooms: Array.from(this.rooms.values()),
        activities: this.activities.slice(-500),
        sleepSessions: this.sleepSessions.slice(-100),
        feedingLog: this.feedingLog.slice(-200),
        milestones: this.milestones
      };
      
      await this.homey.settings.set('babyAndChildCare', settings);
      this._cache.clear();
    } catch (error) {
      this.homey.error('Error saving child care settings:', error);
      throw error;
    }
  }

  initializeDefaultChildren() {
    if (this.children.size === 0) {
      this.children.set('child-001', {
        id: 'child-001',
        name: 'Emma',
        birthDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(), // 6 months old
        ageMonths: 6,
        roomId: 'nursery-001',
        sleepSchedule: {
          bedtime: '19:00',
          wakeTime: '07:00',
          naps: [
            { time: '09:30', duration: 60 },
            { time: '13:00', duration: 90 }
          ]
        },
        feedingSchedule: {
          type: 'breastfeeding',
          intervalHours: 3,
          lastFed: null
        },
        currentStatus: 'sleeping',
        preferences: {
          whiteNoise: true,
          nightLight: true,
          sleepMusic: 'lullabies',
          temperature: 20
        }
      });
    }
  }

  initializeNurseryRooms() {
    if (this.rooms.size === 0) {
      this.rooms.set('nursery-001', {
        id: 'nursery-001',
        name: 'Nursery',
        childId: 'child-001',
        environment: {
          temperature: {
            current: 20,
            target: 20,
            min: 18,
            max: 22
          },
          humidity: {
            current: 50,
            target: 50,
            min: 40,
            max: 60
          },
          airQuality: {
            co2: 450,
            voc: 50,
            status: 'excellent'
          },
          lighting: {
            main: { status: 'off', brightness: 0 },
            nightLight: { status: 'off', brightness: 10, color: 'warm-amber' }
          },
          sound: {
            whiteNoise: { status: 'off', volume: 30, type: 'ocean-waves' },
            lullabies: { status: 'off', volume: 20, playlist: 'brahms-lullaby' }
          }
        },
        monitoring: {
          babyMonitor: {
            status: 'active',
            video: true,
            audio: true,
            nightVision: true,
            twoWayAudio: true,
            motionDetection: true,
            soundDetection: true,
            breathingMonitor: false
          },
          doorSensor: 'closed',
          windowSensor: 'closed',
          movementDetected: false,
          cryingDetected: false,
          lastActivity: null
        },
        safety: {
          childproofing: true,
          outletCovers: true,
          furnitureAnchored: true,
          cordManagement: true,
          emergencyButton: true
        }
      });
    }
  }

  startMonitoring() {
    // Monitor every minute for baby care
    this.monitoringInterval = setInterval(() => {
      this.monitorSleepPatterns();
      this.monitorFeeding();
      this.monitorEnvironment();
      this.checkSafety();
    }, 60000); // 1 minute
  }

  async monitorSleepPatterns() {
    try {
      for (const child of this.children.values()) {
        if (child.currentStatus === 'sleeping') {
          const currentSession = this.sleepSessions.find(s => 
            s.childId === child.id && !s.endTime
          );
          
          if (currentSession) {
            const duration = (Date.now() - new Date(currentSession.startTime).getTime()) / 60000;
            currentSession.durationMinutes = Math.floor(duration);
          }
        }
      }
    } catch (error) {
      this.homey.error('Error monitoring sleep patterns:', error);
    }
  }

  async monitorFeeding() {
    try {
      for (const child of this.children.values()) {
        if (!child.feedingSchedule.lastFed) continue;
        
        const lastFedTime = new Date(child.feedingSchedule.lastFed).getTime();
        const hoursSinceLastFeed = (Date.now() - lastFedTime) / (1000 * 60 * 60);
        
        if (hoursSinceLastFeed >= child.feedingSchedule.intervalHours + 0.5) {
          this.emit('notification', {
            title: 'Feeding Reminder',
            message: `${child.name} may be ready for feeding`,
            priority: 'medium',
            category: 'childcare-feeding'
          });
        }
      }
    } catch (error) {
      this.homey.error('Error monitoring feeding:', error);
    }
  }

  async monitorEnvironment() {
    try {
      for (const room of this.rooms.values()) {
        const env = room.environment;
        
        // Temperature check
        if (env.temperature.current < env.temperature.min || 
            env.temperature.current > env.temperature.max) {
          this.emit('notification', {
            title: 'Nursery Temperature Alert',
            message: `${room.name} temperature is ${env.temperature.current}°C`,
            priority: 'high',
            category: 'childcare-safety'
          });
          
          // Auto-adjust
          await this.adjustRoomTemperature(room.id, env.temperature.target);
        }
        
        // Air quality check
        if (env.airQuality.co2 > 800) {
          this.emit('notification', {
            title: 'Air Quality Alert',
            message: `High CO2 level in ${room.name}`,
            priority: 'medium',
            category: 'childcare-safety'
          });
        }
      }
    } catch (error) {
      this.homey.error('Error monitoring environment:', error);
    }
  }

  async checkSafety() {
    try {
      for (const room of this.rooms.values()) {
        const monitoring = room.monitoring;
        
        // Crying detection
        if (monitoring.cryingDetected) {
          const child = this.children.get(room.childId);
          if (child) {
            this.emit('notification', {
              title: 'Baby Crying',
              message: `${child.name} is crying in ${room.name}`,
              priority: 'high',
              category: 'childcare-alert'
            });
          }
        }
        
        // Window/door open during sleep
        if (monitoring.doorSensor === 'open' || monitoring.windowSensor === 'open') {
          const child = this.children.get(room.childId);
          if (child && child.currentStatus === 'sleeping') {
            this.emit('notification', {
              title: 'Security Alert',
              message: `Door/window open while ${child.name} is sleeping`,
              priority: 'high',
              category: 'childcare-safety'
            });
          }
        }
      }
    } catch (error) {
      this.homey.error('Error checking safety:', error);
    }
  }

  async startSleepSession(childId) {
    try {
      const child = this.children.get(childId);
      if (!child) throw new Error('Child not found');
      
      const room = this.rooms.get(child.roomId);
      if (!room) throw new Error('Room not found');
      
      // Create sleep session
      const session = {
        id: `sleep-${Date.now()}`,
        childId,
        startTime: new Date().toISOString(),
        endTime: null,
        durationMinutes: 0,
        quality: null,
        interruptions: 0
      };
      
      this.sleepSessions.push(session);
      child.currentStatus = 'sleeping';
      
      // Prepare sleep environment
      await this.prepareSleepEnvironment(room.id);
      
      await this.saveSettings();
      
      return session;
    } catch (error) {
      this.homey.error('Error starting sleep session:', error);
      throw error;
    }
  }

  async prepareSleepEnvironment(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    
    const child = this.children.get(room.childId);
    const env = room.environment;
    
    // Turn off main lights
    env.lighting.main.status = 'off';
    
    // Turn on night light if preferred
    if (child.preferences.nightLight) {
      env.lighting.nightLight.status = 'on';
      env.lighting.nightLight.brightness = 10;
    }
    
    // Start white noise if preferred
    if (child.preferences.whiteNoise) {
      env.sound.whiteNoise.status = 'on';
      env.sound.whiteNoise.volume = 30;
    }
    
    // Set temperature
    env.temperature.target = child.preferences.temperature;
    
    this.emit('setTemperature', {
      zone: room.name,
      temperature: env.temperature.target
    });
    
    this.emit('setLights', {
      zone: room.name,
      state: 'off'
    });
  }

  async endSleepSession(childId) {
    try {
      const child = this.children.get(childId);
      if (!child) throw new Error('Child not found');
      
      const session = this.sleepSessions.find(s => 
        s.childId === childId && !s.endTime
      );
      
      if (session) {
        session.endTime = new Date().toISOString();
        const duration = (new Date(session.endTime) - new Date(session.startTime)) / 60000;
        session.durationMinutes = Math.floor(duration);
        
        // Analyze sleep quality
        if (duration >= 120) {
          session.quality = session.interruptions === 0 ? 'excellent' : 
                           session.interruptions <= 1 ? 'good' : 'fair';
        } else {
          session.quality = 'poor';
        }
      }
      
      child.currentStatus = 'awake';
      
      // Wake environment
      const room = this.rooms.get(child.roomId);
      if (room) {
        room.environment.lighting.main.status = 'on';
        room.environment.lighting.main.brightness = 30;
        room.environment.sound.whiteNoise.status = 'off';
      }
      
      await this.saveSettings();
      
      return session;
    } catch (error) {
      this.homey.error('Error ending sleep session:', error);
      throw error;
    }
  }

  async logFeeding(childId, feedingData) {
    try {
      const child = this.children.get(childId);
      if (!child) throw new Error('Child not found');
      
      const feeding = {
        id: `feeding-${Date.now()}`,
        childId,
        timestamp: new Date().toISOString(),
        type: feedingData.type || child.feedingSchedule.type,
        duration: feedingData.duration || null, // minutes
        amount: feedingData.amount || null, // ml
        side: feedingData.side || null, // left/right for breastfeeding
        notes: feedingData.notes || ''
      };
      
      this.feedingLog.push(feeding);
      child.feedingSchedule.lastFed = feeding.timestamp;
      
      await this.saveSettings();
      
      return feeding;
    } catch (error) {
      this.homey.error('Error logging feeding:', error);
      throw error;
    }
  }

  async logDiaperChange(childId, changeData) {
    try {
      const activity = {
        id: `activity-${Date.now()}`,
        childId,
        type: 'diaper-change',
        timestamp: new Date().toISOString(),
        data: {
          type: changeData.type || 'wet', // wet, dirty, both
          rash: changeData.rash || false,
          notes: changeData.notes || ''
        }
      };
      
      this.activities.push(activity);
      await this.saveSettings();
      
      return activity;
    } catch (error) {
      this.homey.error('Error logging diaper change:', error);
      throw error;
    }
  }

  async recordMilestone(childId, milestoneData) {
    try {
      const child = this.children.get(childId);
      if (!child) throw new Error('Child not found');
      
      const milestone = {
        id: `milestone-${Date.now()}`,
        childId,
        date: new Date().toISOString(),
        ageMonths: child.ageMonths,
        category: milestoneData.category, // motor, cognitive, social, language
        description: milestoneData.description,
        notes: milestoneData.notes || ''
      };
      
      this.milestones.push(milestone);
      await this.saveSettings();
      
      this.emit('notification', {
        title: 'New Milestone!',
        message: `${child.name}: ${milestone.description}`,
        priority: 'low',
        category: 'childcare-milestone'
      });
      
      return milestone;
    } catch (error) {
      this.homey.error('Error recording milestone:', error);
      throw error;
    }
  }

  async adjustRoomTemperature(roomId, targetTemp) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.environment.temperature.target = targetTemp;
      
      this.emit('setTemperature', {
        zone: room.name,
        temperature: targetTemp
      });
    }
  }

  getChildren() {
    return Array.from(this.children.values());
  }

  getRooms() {
    return Array.from(this.rooms.values());
  }

  getSleepSessions(childId = null, limit = 30) {
    let sessions = this.sleepSessions;
    if (childId) {
      sessions = sessions.filter(s => s.childId === childId);
    }
    return sessions.slice(-limit).reverse();
  }

  getFeedingLog(childId = null, limit = 50) {
    let feedings = this.feedingLog;
    if (childId) {
      feedings = feedings.filter(f => f.childId === childId);
    }
    return feedings.slice(-limit).reverse();
  }

  getActivities(childId = null, limit = 50) {
    let activities = this.activities;
    if (childId) {
      activities = activities.filter(a => a.childId === childId);
    }
    return activities.slice(-limit).reverse();
  }

  getMilestones(childId = null) {
    if (childId) {
      return this.milestones.filter(m => m.childId === childId);
    }
    return this.milestones;
  }

  getStats(childId) {
    const child = this.children.get(childId);
    if (!child) return null;
    
    const sleepSessions = this.sleepSessions.filter(s => s.childId === childId && s.endTime);
    const avgSleepDuration = sleepSessions.length > 0 ?
      sleepSessions.reduce((sum, s) => sum + s.durationMinutes, 0) / sleepSessions.length : 0;
    
    const todayFeedings = this.feedingLog.filter(f => {
      const feedTime = new Date(f.timestamp);
      const today = new Date();
      return f.childId === childId && 
             feedTime.toDateString() === today.toDateString();
    });
    
    return {
      child: child.name,
      ageMonths: child.ageMonths,
      currentStatus: child.currentStatus,
      totalSleepSessions: sleepSessions.length,
      avgSleepDuration: Math.round(avgSleepDuration),
      totalFeedings: this.feedingLog.filter(f => f.childId === childId).length,
      todayFeedings: todayFeedings.length,
      totalMilestones: this.milestones.filter(m => m.childId === childId).length,
      lastFed: child.feedingSchedule.lastFed
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

module.exports = AdvancedBabyAndChildCareSystem;
