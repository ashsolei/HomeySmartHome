'use strict';

/**
 * Mood & Activity Detection System
 * Advanced system for detecting user mood and activities to enable adaptive automation
 */
class MoodActivityDetectionSystem {
  constructor(homey) {
    this.homey = homey;
    this.moodProfiles = new Map();
    this.activityProfiles = new Map();
    this.currentMood = null;
    this.currentActivity = null;
    this.moodHistory = [];
    this.activityHistory = [];
    this.behaviorPatterns = new Map();
  }

  async initialize() {
    this.log('Initializing Mood & Activity Detection System...');
    
    // Load mood profiles
    const savedMoods = await this.homey.settings.get('moodProfiles') || {};
    Object.entries(savedMoods).forEach(([id, profile]) => {
      this.moodProfiles.set(id, profile);
    });

    // Load activity profiles
    const savedActivities = await this.homey.settings.get('activityProfiles') || {};
    Object.entries(savedActivities).forEach(([id, profile]) => {
      this.activityProfiles.set(id, profile);
    });

    // Setup default profiles
    await this.setupDefaultProfiles();

    // Start detection
    await this.startDetection();

    this.log('Mood & Activity Detection System initialized');
  }

  /**
   * Setup default mood and activity profiles
   */
  async setupDefaultProfiles() {
    // Mood profiles
    const defaultMoods = [
      {
        id: 'energetic',
        name: 'Energetic',
        description: 'High energy, active mood',
        indicators: {
          deviceActivity: { min: 0.7, max: 1.0 },
          lightingLevel: { min: 0.7, max: 1.0 },
          musicVolume: { min: 0.6, max: 1.0 },
          timeOfDay: ['morning', 'afternoon'],
          dayOfWeek: [1, 2, 3, 4, 5] // Weekdays
        },
        sceneRecommendations: ['active', 'productive', 'energizing']
      },
      {
        id: 'relaxed',
        name: 'Relaxed',
        description: 'Calm, peaceful mood',
        indicators: {
          deviceActivity: { min: 0.2, max: 0.5 },
          lightingLevel: { min: 0.3, max: 0.6 },
          musicVolume: { min: 0.2, max: 0.5 },
          timeOfDay: ['evening', 'late_evening'],
          dayOfWeek: [0, 6] // Weekend
        },
        sceneRecommendations: ['relaxation', 'calm', 'meditation']
      },
      {
        id: 'focused',
        name: 'Focused',
        description: 'Concentrated, working mood',
        indicators: {
          deviceActivity: { min: 0.4, max: 0.7 },
          lightingLevel: { min: 0.6, max: 0.9 },
          musicVolume: { min: 0.1, max: 0.4 },
          timeOfDay: ['morning', 'afternoon'],
          roomActivity: ['office', 'study']
        },
        sceneRecommendations: ['work', 'focus', 'productive']
      },
      {
        id: 'social',
        name: 'Social',
        description: 'Entertaining, social mood',
        indicators: {
          deviceActivity: { min: 0.6, max: 1.0 },
          lightingLevel: { min: 0.5, max: 0.8 },
          musicVolume: { min: 0.5, max: 0.9 },
          timeOfDay: ['evening', 'late_evening'],
          presenceCount: { min: 2 }
        },
        sceneRecommendations: ['party', 'dinner', 'entertainment']
      },
      {
        id: 'sleepy',
        name: 'Sleepy',
        description: 'Tired, ready for rest',
        indicators: {
          deviceActivity: { min: 0.0, max: 0.2 },
          lightingLevel: { min: 0.0, max: 0.3 },
          musicVolume: { min: 0.0, max: 0.2 },
          timeOfDay: ['late_evening', 'night'],
          roomActivity: ['bedroom']
        },
        sceneRecommendations: ['sleep', 'night', 'bedtime']
      }
    ];

    for (const mood of defaultMoods) {
      if (!this.moodProfiles.has(mood.id)) {
        this.moodProfiles.set(mood.id, mood);
      }
    }

    // Activity profiles
    const defaultActivities = [
      {
        id: 'sleeping',
        name: 'Sleeping',
        description: 'User is sleeping',
        indicators: {
          timeOfDay: ['night', 'early_morning'],
          deviceActivity: { max: 0.1 },
          roomActivity: ['bedroom'],
          duration: { min: 18000000 } // At least 5 hours
        },
        automation: {
          disableNotifications: true,
          dimLights: true,
          silentMode: true
        }
      },
      {
        id: 'working',
        name: 'Working',
        description: 'User is working',
        indicators: {
          timeOfDay: ['morning', 'afternoon'],
          roomActivity: ['office', 'study'],
          deviceActivity: { min: 0.4, max: 0.8 },
          dayOfWeek: [1, 2, 3, 4, 5]
        },
        automation: {
          optimalLighting: true,
          minimizeDistractions: true,
          focusMode: true
        }
      },
      {
        id: 'cooking',
        name: 'Cooking',
        description: 'User is cooking',
        indicators: {
          roomActivity: ['kitchen'],
          deviceActivity: { min: 0.5 },
          deviceTypes: ['oven', 'stove', 'hood']
        },
        automation: {
          enhancedLighting: true,
          timerAssistance: true
        }
      },
      {
        id: 'entertaining',
        name: 'Entertaining',
        description: 'User is entertaining guests',
        indicators: {
          presenceCount: { min: 2 },
          deviceActivity: { min: 0.6 },
          roomActivity: ['living_room', 'dining_room'],
          timeOfDay: ['evening', 'late_evening']
        },
        automation: {
          ambientLighting: true,
          musicRecommendations: true
        }
      },
      {
        id: 'exercising',
        name: 'Exercising',
        description: 'User is exercising',
        indicators: {
          deviceActivity: { min: 0.5 },
          roomActivity: ['gym', 'living_room'],
          musicVolume: { min: 0.6 },
          heartRate: { min: 100 } // If health integration available
        },
        automation: {
          energizingLighting: true,
          motivationalMusic: true
        }
      },
      {
        id: 'relaxing',
        name: 'Relaxing',
        description: 'User is relaxing',
        indicators: {
          deviceActivity: { min: 0.2, max: 0.5 },
          roomActivity: ['living_room', 'bedroom'],
          lightingLevel: { min: 0.3, max: 0.6 },
          timeOfDay: ['evening', 'late_evening']
        },
        automation: {
          calmLighting: true,
          soothingMusic: true
        }
      },
      {
        id: 'away',
        name: 'Away',
        description: 'User is away from home',
        indicators: {
          presence: 'away',
          deviceActivity: { max: 0.1 },
          duration: { min: 1800000 } // At least 30 minutes
        },
        automation: {
          securityMode: true,
          energySaving: true,
          awaySimulation: true
        }
      }
    ];

    for (const activity of defaultActivities) {
      if (!this.activityProfiles.has(activity.id)) {
        this.activityProfiles.set(activity.id, activity);
      }
    }

    await this.saveMoodProfiles();
    await this.saveActivityProfiles();
  }

  /**
   * Start mood and activity detection
   */
  async startDetection() {
    // Continuous detection (every minute)
    this.detectionInterval = setInterval(async () => {
      await this.detectMoodAndActivity();
    }, 60000);

    // Pattern learning (every 30 minutes)
    this.learningInterval = setInterval(async () => {
      await this.learnBehaviorPatterns();
    }, 1800000);

    // Initial detection
    await this.detectMoodAndActivity();
  }

  /**
   * Detect current mood and activity
   */
  async detectMoodAndActivity() {
    const context = await this.collectContext();
    
    // Detect mood
    const mood = await this.detectMood(context);
    if (mood && mood.id !== this.currentMood?.id) {
      await this.handleMoodChange(this.currentMood, mood);
      this.currentMood = mood;
      
      this.moodHistory.push({
        mood: mood.id,
        confidence: mood.confidence,
        timestamp: Date.now()
      });

      // Keep only last 100 mood records
      if (this.moodHistory.length > 100) {
        this.moodHistory.shift();
      }
    }

    // Detect activity
    const activity = await this.detectActivity(context);
    if (activity && activity.id !== this.currentActivity?.id) {
      await this.handleActivityChange(this.currentActivity, activity);
      this.currentActivity = activity;

      this.activityHistory.push({
        activity: activity.id,
        confidence: activity.confidence,
        timestamp: Date.now()
      });

      // Keep only last 100 activity records
      if (this.activityHistory.length > 100) {
        this.activityHistory.shift();
      }
    }
  }

  /**
   * Collect context data
   */
  async collectContext() {
    const context = {
      timestamp: Date.now(),
      time: {
        hour: new Date().getHours(),
        dayOfWeek: new Date().getDay(),
        timeOfDay: this.getTimeOfDay()
      },
      devices: await this.getDeviceContext(),
      presence: await this.getPresenceContext(),
      environment: await this.getEnvironmentContext(),
      rooms: await this.getRoomActivity()
    };

    return context;
  }

  /**
   * Get time of day
   */
  getTimeOfDay() {
    const hour = new Date().getHours();
    
    if (hour >= 5 && hour < 8) return 'early_morning';
    if (hour >= 8 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    if (hour >= 21 && hour < 23) return 'late_evening';
    return 'night';
  }

  /**
   * Get device context
   */
  async getDeviceContext() {
    const devices = this.homey.drivers.getDevices();
    const context = {
      total: devices.length,
      active: 0,
      recentChanges: 0,
      avgLighting: 0,
      avgVolume: 0
    };

    let lightingSum = 0;
    let lightCount = 0;
    let volumeSum = 0;
    let volumeCount = 0;

    // Get recent changes
    const recentHistory = await this.homey.settings.get('deviceStateHistory') || [];
    const fiveMinutesAgo = Date.now() - 300000;
    context.recentChanges = recentHistory.filter(h => h.timestamp > fiveMinutesAgo).length;

    for (const device of devices) {
      // Active devices
      if (device.hasCapability('onoff')) {
        try {
          const isOn = await device.getCapabilityValue('onoff');
          if (isOn) context.active++;
        } catch {}
      }

      // Lighting levels
      if (device.hasCapability('dim')) {
        try {
          const dim = await device.getCapabilityValue('dim');
          lightingSum += dim;
          lightCount++;
        } catch {}
      }

      // Volume levels
      if (device.hasCapability('volume_set')) {
        try {
          const volume = await device.getCapabilityValue('volume_set');
          volumeSum += volume;
          volumeCount++;
        } catch {}
      }
    }

    context.avgLighting = lightCount > 0 ? lightingSum / lightCount : 0;
    context.avgVolume = volumeCount > 0 ? volumeSum / volumeCount : 0;
    context.activityLevel = context.recentChanges / 20; // Normalize

    return context;
  }

  /**
   * Get presence context
   */
  async getPresenceContext() {
    try {
      const presenceManager = this.homey.app.presenceManager;
      if (!presenceManager) {
        return { status: 'unknown', count: 1 };
      }

      const status = await presenceManager.getStatus();
      return {
        status: status.status,
        count: status.users?.length || 1
      };
    } catch {
      return { status: 'unknown', count: 1 };
    }
  }

  /**
   * Get environment context
   */
  async getEnvironmentContext() {
    const environment = {
      temperature: null,
      humidity: null,
      lightLevel: null
    };

    try {
      const climateManager = this.homey.app.climateManager;
      if (climateManager) {
        const zones = await climateManager.getAllZonesStatus();
        if (zones.length > 0) {
          environment.temperature = zones[0].currentTemp;
          environment.humidity = zones[0].humidity;
        }
      }
    } catch {}

    return environment;
  }

  /**
   * Get room activity
   */
  async getRoomActivity() {
    const rooms = {
      bedroom: 0,
      living_room: 0,
      kitchen: 0,
      bathroom: 0,
      office: 0,
      other: 0
    };

    const recentHistory = await this.homey.settings.get('deviceStateHistory') || [];
    const fiveMinutesAgo = Date.now() - 300000;
    const recentChanges = recentHistory.filter(h => h.timestamp > fiveMinutesAgo);

    for (const change of recentChanges) {
      const room = this.categorizeRoom(change.zone || change.deviceName);
      if (rooms.hasOwnProperty(room)) {
        rooms[room]++;
      } else {
        rooms.other++;
      }
    }

    return rooms;
  }

  /**
   * Categorize room from zone/device name
   */
  categorizeRoom(name) {
    const lowerName = name.toLowerCase();
    
    if (lowerName.includes('bedroom') || lowerName.includes('bed')) return 'bedroom';
    if (lowerName.includes('living') || lowerName.includes('lounge')) return 'living_room';
    if (lowerName.includes('kitchen')) return 'kitchen';
    if (lowerName.includes('bathroom') || lowerName.includes('bath')) return 'bathroom';
    if (lowerName.includes('office') || lowerName.includes('study')) return 'office';
    
    return 'other';
  }

  /**
   * Detect mood from context
   */
  async detectMood(context) {
    let bestMatch = null;
    let highestScore = 0;

    for (const [id, profile] of this.moodProfiles) {
      const score = this.calculateMoodScore(profile, context);
      
      if (score > highestScore && score > 0.5) {
        highestScore = score;
        bestMatch = {
          id: profile.id,
          name: profile.name,
          description: profile.description,
          confidence: score,
          sceneRecommendations: profile.sceneRecommendations
        };
      }
    }

    return bestMatch;
  }

  /**
   * Calculate mood score
   */
  calculateMoodScore(profile, context) {
    let score = 0;
    let factors = 0;

    const indicators = profile.indicators;

    // Check device activity
    if (indicators.deviceActivity) {
      factors++;
      const activity = context.devices.activityLevel;
      if (activity >= indicators.deviceActivity.min && 
          activity <= indicators.deviceActivity.max) {
        score++;
      }
    }

    // Check lighting level
    if (indicators.lightingLevel) {
      factors++;
      const lighting = context.devices.avgLighting;
      if (lighting >= indicators.lightingLevel.min && 
          lighting <= indicators.lightingLevel.max) {
        score++;
      }
    }

    // Check music volume
    if (indicators.musicVolume) {
      factors++;
      const volume = context.devices.avgVolume;
      if (volume >= indicators.musicVolume.min && 
          volume <= indicators.musicVolume.max) {
        score++;
      }
    }

    // Check time of day
    if (indicators.timeOfDay) {
      factors++;
      if (indicators.timeOfDay.includes(context.time.timeOfDay)) {
        score++;
      }
    }

    // Check day of week
    if (indicators.dayOfWeek) {
      factors++;
      if (indicators.dayOfWeek.includes(context.time.dayOfWeek)) {
        score++;
      }
    }

    // Check presence count
    if (indicators.presenceCount) {
      factors++;
      if (context.presence.count >= indicators.presenceCount.min) {
        score++;
      }
    }

    // Check room activity
    if (indicators.roomActivity) {
      factors++;
      const activeRooms = Object.entries(context.rooms)
        .filter(([room, count]) => count > 0)
        .map(([room]) => room);
      
      if (indicators.roomActivity.some(room => activeRooms.includes(room))) {
        score++;
      }
    }

    return factors > 0 ? score / factors : 0;
  }

  /**
   * Detect activity from context
   */
  async detectActivity(context) {
    let bestMatch = null;
    let highestScore = 0;

    for (const [id, profile] of this.activityProfiles) {
      const score = this.calculateActivityScore(profile, context);
      
      if (score > highestScore && score > 0.6) {
        highestScore = score;
        bestMatch = {
          id: profile.id,
          name: profile.name,
          description: profile.description,
          confidence: score,
          automation: profile.automation
        };
      }
    }

    return bestMatch;
  }

  /**
   * Calculate activity score
   */
  calculateActivityScore(profile, context) {
    let score = 0;
    let factors = 0;

    const indicators = profile.indicators;

    // Check time of day
    if (indicators.timeOfDay) {
      factors++;
      if (indicators.timeOfDay.includes(context.time.timeOfDay)) {
        score++;
      }
    }

    // Check device activity
    if (indicators.deviceActivity) {
      factors++;
      const activity = context.devices.activityLevel;
      
      if (indicators.deviceActivity.min !== undefined && 
          activity >= indicators.deviceActivity.min) {
        score += 0.5;
      }
      if (indicators.deviceActivity.max !== undefined && 
          activity <= indicators.deviceActivity.max) {
        score += 0.5;
      }
    }

    // Check room activity
    if (indicators.roomActivity) {
      factors++;
      const mostActiveRoom = Object.entries(context.rooms)
        .sort((a, b) => b[1] - a[1])[0];
      
      if (mostActiveRoom && indicators.roomActivity.includes(mostActiveRoom[0])) {
        score++;
      }
    }

    // Check presence
    if (indicators.presence) {
      factors++;
      if (context.presence.status === indicators.presence) {
        score++;
      }
    }

    // Check presence count
    if (indicators.presenceCount) {
      factors++;
      if (context.presence.count >= indicators.presenceCount.min) {
        score++;
      }
    }

    // Check day of week
    if (indicators.dayOfWeek) {
      factors++;
      if (indicators.dayOfWeek.includes(context.time.dayOfWeek)) {
        score++;
      }
    }

    // Check lighting level
    if (indicators.lightingLevel) {
      factors++;
      const lighting = context.devices.avgLighting;
      if (lighting >= indicators.lightingLevel.min && 
          lighting <= indicators.lightingLevel.max) {
        score++;
      }
    }

    // Check music volume
    if (indicators.musicVolume) {
      factors++;
      const volume = context.devices.avgVolume;
      if (volume >= indicators.musicVolume.min) {
        score++;
      }
    }

    return factors > 0 ? score / factors : 0;
  }

  /**
   * Handle mood change
   */
  async handleMoodChange(oldMood, newMood) {
    this.log(`Mood changed: ${oldMood?.name || 'Unknown'} -> ${newMood.name} (${Math.round(newMood.confidence * 100)}%)`);

    // Trigger mood-based automation
    await this.triggerMoodAutomation(newMood);

    // Emit event
    this.homey.app.emit('mood_changed', {
      old: oldMood,
      new: newMood,
      timestamp: Date.now()
    });
  }

  /**
   * Handle activity change
   */
  async handleActivityChange(oldActivity, newActivity) {
    this.log(`Activity changed: ${oldActivity?.name || 'Unknown'} -> ${newActivity.name} (${Math.round(newActivity.confidence * 100)}%)`);

    // Trigger activity-based automation
    await this.triggerActivityAutomation(newActivity);

    // Emit event
    this.homey.app.emit('activity_changed', {
      old: oldActivity,
      new: newActivity,
      timestamp: Date.now()
    });
  }

  /**
   * Trigger mood-based automation
   */
  async triggerMoodAutomation(mood) {
    // Apply scene recommendations if available
    if (mood.sceneRecommendations && mood.sceneRecommendations.length > 0) {
      this.log(`Mood-based scene recommendation: ${mood.sceneRecommendations[0]}`);
    }
  }

  /**
   * Trigger activity-based automation
   */
  async triggerActivityAutomation(activity) {
    if (!activity.automation) return;

    const automation = activity.automation;

    // Apply automations based on activity
    if (automation.disableNotifications) {
      this.log('Activity automation: Disabling notifications');
    }

    if (automation.optimalLighting) {
      this.log('Activity automation: Optimizing lighting');
      await this.optimizeLighting(activity.id);
    }

    if (automation.securityMode) {
      this.log('Activity automation: Enabling security mode');
    }

    if (automation.energySaving) {
      this.log('Activity automation: Enabling energy saving');
    }
  }

  /**
   * Optimize lighting for activity
   */
  async optimizeLighting(activityId) {
    const devices = this.homey.drivers.getDevices();
    const lights = devices.filter(d => d.hasCapability('dim'));

    let targetBrightness = 0.7;

    switch (activityId) {
      case 'working':
        targetBrightness = 0.9;
        break;
      case 'relaxing':
        targetBrightness = 0.4;
        break;
      case 'sleeping':
        targetBrightness = 0.1;
        break;
      case 'entertaining':
        targetBrightness = 0.6;
        break;
    }

    for (const light of lights) {
      try {
        const isOn = await light.getCapabilityValue('onoff');
        if (isOn) {
          await light.setCapabilityValue('dim', targetBrightness);
        }
      } catch {}
    }
  }

  /**
   * Learn behavior patterns
   */
  async learnBehaviorPatterns() {
    if (this.moodHistory.length < 20 || this.activityHistory.length < 20) {
      return;
    }

    // Analyze mood patterns
    const moodPatterns = this.analyzeMoodPatterns();
    
    // Analyze activity patterns
    const activityPatterns = this.analyzeActivityPatterns();

    // Store patterns
    moodPatterns.forEach(pattern => {
      this.behaviorPatterns.set(`mood_${pattern.id}`, pattern);
    });

    activityPatterns.forEach(pattern => {
      this.behaviorPatterns.set(`activity_${pattern.id}`, pattern);
    });

    await this.saveBehaviorPatterns();
  }

  /**
   * Analyze mood patterns
   */
  analyzeMoodPatterns() {
    const patterns = [];
    const moodCounts = {};

    for (const record of this.moodHistory) {
      moodCounts[record.mood] = (moodCounts[record.mood] || 0) + 1;
    }

    for (const [mood, count] of Object.entries(moodCounts)) {
      patterns.push({
        id: mood,
        type: 'mood',
        frequency: count / this.moodHistory.length,
        count
      });
    }

    return patterns;
  }

  /**
   * Analyze activity patterns
   */
  analyzeActivityPatterns() {
    const patterns = [];
    const activityCounts = {};

    for (const record of this.activityHistory) {
      activityCounts[record.activity] = (activityCounts[record.activity] || 0) + 1;
    }

    for (const [activity, count] of Object.entries(activityCounts)) {
      patterns.push({
        id: activity,
        type: 'activity',
        frequency: count / this.activityHistory.length,
        count
      });
    }

    return patterns;
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return {
      currentMood: this.currentMood,
      currentActivity: this.currentActivity,
      moodProfiles: this.moodProfiles.size,
      activityProfiles: this.activityProfiles.size,
      moodHistory: this.moodHistory.slice(-10),
      activityHistory: this.activityHistory.slice(-10),
      behaviorPatterns: Array.from(this.behaviorPatterns.values())
    };
  }

  async saveMoodProfiles() {
    const data = {};
    this.moodProfiles.forEach((profile, id) => {
      data[id] = profile;
    });
    await this.homey.settings.set('moodProfiles', data);
  }

  async saveActivityProfiles() {
    const data = {};
    this.activityProfiles.forEach((profile, id) => {
      data[id] = profile;
    });
    await this.homey.settings.set('activityProfiles', data);
  }

  async saveBehaviorPatterns() {
    const data = {};
    this.behaviorPatterns.forEach((pattern, id) => {
      data[id] = pattern;
    });
    await this.homey.settings.set('behaviorPatterns', data);
  }

  log(...args) {
    console.log('[MoodActivityDetectionSystem]', ...args);
  }

  error(...args) {
    console.error('[MoodActivityDetectionSystem]', ...args);
  }
}

module.exports = MoodActivityDetectionSystem;
