'use strict';
const logger = require('./logger');

/**
 * Multi-User Profile Manager
 * Manages different user profiles with personalized preferences and settings
 */
class UserProfileManager {
  constructor(app) {
    this._intervals = [];
    this._timeouts = [];
    this.app = app;
    this.profiles = new Map();
    this.currentUser = null;
    this.presenceHistory = [];
    this.profileSwitchLog = [];
  }

  async initialize() {
    // Load user profiles
    await this.loadProfiles();
    
    // Set default user
    await this.detectCurrentUser();
    
    // Start presence detection
    this.startPresenceDetection();
  }

  // ============================================
  // PROFILE MANAGEMENT
  // ============================================

  async createProfile(config) {
    const profile = {
      id: config.id || `user_${Date.now()}`,
      name: config.name,
      type: config.type || 'adult', // 'adult', 'child', 'guest'
      avatar: config.avatar,
      
      // Authentication
      devices: config.devices || [], // Phones/devices for presence detection
      nfcTag: config.nfcTag,
      faceId: config.faceId,
      
      // Preferences
      preferences: {
        temperature: config.preferences?.temperature || 21,
        lightingBrightness: config.preferences?.lightingBrightness || 0.7,
        lightingColor: config.preferences?.lightingColor || 'warm',
        musicVolume: config.preferences?.musicVolume || 50,
        wakeUpTime: config.preferences?.wakeUpTime || '07:00',
        bedTime: config.preferences?.bedTime || '23:00'
      },
      
      // Room preferences
      roomPreferences: config.roomPreferences || {
        living_room: { temperature: 21, lighting: 0.7 },
        bedroom: { temperature: 18, lighting: 0.3 },
        office: { temperature: 21.5, lighting: 0.9 },
        kitchen: { temperature: 20, lighting: 0.8 }
      },
      
      // Automation preferences
      automationSettings: {
        enableAutoLighting: config.automationSettings?.enableAutoLighting !== false,
        enableAutoHeating: config.automationSettings?.enableAutoHeating !== false,
        enableSceneSuggestions: config.automationSettings?.enableSceneSuggestions !== false,
        enableVoiceControl: config.automationSettings?.enableVoiceControl !== false,
        presenceTimeout: config.automationSettings?.presenceTimeout || 30 // minutes
      },
      
      // Notification preferences
      notifications: {
        email: config.notifications?.email,
        phone: config.notifications?.phone,
        pushEnabled: config.notifications?.pushEnabled !== false,
        priority: config.notifications?.priority || 'medium',
        quietHours: config.notifications?.quietHours || {
          enabled: true,
          start: '22:00',
          end: '07:00'
        }
      },
      
      // Schedule
      schedule: config.schedule || {
        workDays: [1, 2, 3, 4, 5],
        workHours: { start: '09:00', end: '17:00' },
        lunchTime: '12:00'
      },
      
      // Access control
      permissions: config.permissions || {
        canModifyAutomations: true,
        canControlAllDevices: true,
        canManageUsers: true,
        canViewEnergyData: true,
        canModifySchedules: true
      },
      
      // Statistics
      stats: {
        created: Date.now(),
        lastActive: 0,
        totalActivations: 0,
        totalTimeActive: 0,
        favoriteScenes: [],
        mostUsedDevices: []
      }
    };

    this.profiles.set(profile.id, profile);

    return {
      success: true,
      profile: this.getProfileInfo(profile.id)
    };
  }

  async updateProfile(userId, updates) {
    const profile = this.profiles.get(userId);
    
    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }

    // Deep merge updates
    if (updates.preferences) {
      profile.preferences = { ...profile.preferences, ...updates.preferences };
    }
    
    if (updates.roomPreferences) {
      profile.roomPreferences = { ...profile.roomPreferences, ...updates.roomPreferences };
    }
    
    if (updates.automationSettings) {
      profile.automationSettings = { ...profile.automationSettings, ...updates.automationSettings };
    }
    
    if (updates.notifications) {
      profile.notifications = { ...profile.notifications, ...updates.notifications };
    }

    // Direct updates
    const directFields = ['name', 'avatar', 'type', 'devices', 'nfcTag', 'schedule', 'permissions'];
    directFields.forEach(field => {
      if (updates[field] !== undefined) {
        profile[field] = updates[field];
      }
    });

    return {
      success: true,
      profile: this.getProfileInfo(userId)
    };
  }

  async deleteProfile(userId) {
    const profile = this.profiles.get(userId);
    
    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }

    // Don't delete if currently active
    if (this.currentUser === userId) {
      return { success: false, error: 'Cannot delete active profile' };
    }

    this.profiles.delete(userId);

    return { success: true };
  }

  // ============================================
  // USER SWITCHING
  // ============================================

  async switchToUser(userId, method = 'manual') {
    const profile = this.profiles.get(userId);
    
    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }

    const previousUser = this.currentUser;
    this.currentUser = userId;

    // Update stats
    profile.stats.lastActive = Date.now();
    profile.stats.totalActivations++;

    // Apply user preferences
    await this.applyUserPreferences(profile);

    // Log switch
    this.logProfileSwitch({
      from: previousUser,
      to: userId,
      method,
      timestamp: Date.now()
    });

    logger.info(`Switched to user: ${profile.name} (${method})`);

    return {
      success: true,
      user: this.getProfileInfo(userId),
      appliedSettings: this.getAppliedSettings(profile)
    };
  }

  async applyUserPreferences(profile) {
    const settings = [];

    // Apply temperature preferences per room
    for (const [room, prefs] of Object.entries(profile.roomPreferences)) {
      // await this.app.devices.setRoomTemperature(room, prefs.temperature);
      settings.push({
        room,
        type: 'temperature',
        value: prefs.temperature
      });
    }

    // Apply lighting preferences
    if (profile.automationSettings.enableAutoLighting) {
      // await this.app.lighting.setBrightness(profile.preferences.lightingBrightness);
      settings.push({
        type: 'lighting',
        brightness: profile.preferences.lightingBrightness,
        color: profile.preferences.lightingColor
      });
    }

    // Apply automation settings
    // await this.app.automation.updateSettings(profile.automationSettings);

    logger.info(`Applied ${settings.length} settings for ${profile.name}`);

    return settings;
  }

  getAppliedSettings(profile) {
    return {
      temperature: profile.preferences.temperature,
      lighting: {
        brightness: profile.preferences.lightingBrightness,
        color: profile.preferences.lightingColor
      },
      automations: profile.automationSettings,
      notifications: profile.notifications
    };
  }

  // ============================================
  // PRESENCE DETECTION
  // ============================================

  startPresenceDetection() {
    // Check presence every 30 seconds
    this._intervals.push(setInterval(() => {
      this.detectCurrentUser();
    }, 30 * 1000));
  }

  async detectCurrentUser() {
    // Method 1: Device presence (phone WiFi/BLE)
    const deviceUser = await this.detectByDevice();
    
    if (deviceUser) {
      if (this.currentUser !== deviceUser) {
        await this.switchToUser(deviceUser, 'device_detection');
      }
      return deviceUser;
    }

    // Method 2: Face recognition (if available)
    const faceUser = await this.detectByFace();
    
    if (faceUser) {
      if (this.currentUser !== faceUser) {
        await this.switchToUser(faceUser, 'face_recognition');
      }
      return faceUser;
    }

    // Method 3: Schedule-based prediction
    const predictedUser = this.predictUserBySchedule();
    
    if (predictedUser && !this.currentUser) {
      await this.switchToUser(predictedUser, 'schedule_prediction');
      return predictedUser;
    }

    return this.currentUser;
  }

  async detectByDevice() {
    // Check which user's devices are present
    // In production: Check WiFi/BLE presence via Homey
    
    const hour = new Date().getHours();
    
    // Simulate device detection based on time
    for (const [userId, profile] of this.profiles) {
      if (profile.type === 'adult') {
        // Simulate presence during waking hours
        const [wakeHour] = profile.preferences.wakeUpTime.split(':').map(Number);
        const [bedHour] = profile.preferences.bedTime.split(':').map(Number);
        
        if (hour >= wakeHour && hour < bedHour) {
          return userId;
        }
      }
    }

    return null;
  }

  async detectByFace() {
    // Placeholder for face recognition integration
    // In production: Integrate with camera system
    return null;
  }

  predictUserBySchedule() {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay() || 7;

    for (const [userId, profile] of this.profiles) {
      const schedule = profile.schedule;
      
      // Check if it's a work day for this user
      if (schedule.workDays.includes(dayOfWeek)) {
        const [workStart] = schedule.workHours.start.split(':').map(Number);
        const [workEnd] = schedule.workHours.end.split(':').map(Number);
        
        // User typically home before/after work
        if (hour < workStart || hour >= workEnd) {
          return userId;
        }
      } else {
        // Weekend - likely home during waking hours
        const [wakeHour] = profile.preferences.wakeUpTime.split(':').map(Number);
        const [bedHour] = profile.preferences.bedTime.split(':').map(Number);
        
        if (hour >= wakeHour && hour < bedHour) {
          return userId;
        }
      }
    }

    return null;
  }

  async scanNFCTag(tagId) {
    // Find user with this NFC tag
    for (const [userId, profile] of this.profiles) {
      if (profile.nfcTag === tagId) {
        return await this.switchToUser(userId, 'nfc_tag');
      }
    }

    return { success: false, error: 'Unknown NFC tag' };
  }

  // ============================================
  // FAMILY MODE
  // ============================================

  async enableFamilyMode() {
    // Family mode uses averaged/combined preferences
    const familyProfile = this.createFamilyProfile();
    
    await this.applyUserPreferences(familyProfile);

    return {
      success: true,
      mode: 'family',
      settings: this.getAppliedSettings(familyProfile)
    };
  }

  createFamilyProfile() {
    const profiles = Array.from(this.profiles.values())
      .filter(p => p.type === 'adult' || p.type === 'child');

    // Average temperature preferences
    const avgTemp = profiles.reduce((sum, p) => sum + p.preferences.temperature, 0) / profiles.length;
    
    // Use moderate lighting
    const avgBrightness = profiles.reduce((sum, p) => sum + p.preferences.lightingBrightness, 0) / profiles.length;

    return {
      name: 'Familj',
      type: 'family',
      preferences: {
        temperature: Math.round(avgTemp * 10) / 10,
        lightingBrightness: Math.round(avgBrightness * 10) / 10,
        lightingColor: 'warm'
      },
      roomPreferences: {
        living_room: { temperature: avgTemp, lighting: avgBrightness }
      },
      automationSettings: {
        enableAutoLighting: true,
        enableAutoHeating: true,
        enableSceneSuggestions: false
      }
    };
  }

  async enableGuestMode(duration = 24) {
    // Guest mode uses conservative settings
    const guestProfile = {
      name: 'Gäst',
      type: 'guest',
      preferences: {
        temperature: 21,
        lightingBrightness: 0.6,
        lightingColor: 'neutral'
      },
      automationSettings: {
        enableAutoLighting: true,
        enableAutoHeating: true,
        enableSceneSuggestions: false,
        enableVoiceControl: false
      }
    };

    await this.applyUserPreferences(guestProfile);

    // Auto-disable after duration
    this._timeouts.push(setTimeout(() => {
      this.detectCurrentUser();
    }, duration * 60 * 60 * 1000));

    return {
      success: true,
      mode: 'guest',
      duration,
      settings: this.getAppliedSettings(guestProfile)
    };
  }

  // ============================================
  // LEARNING & ADAPTATION
  // ============================================

  async learnUserPreferences(userId) {
    const profile = this.profiles.get(userId);
    
    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }

    // Analyze user's manual adjustments
    // In production: Track temperature changes, lighting adjustments, etc.
    
    const learned = {
      temperatureAdjustments: [],
      lightingAdjustments: [],
      frequentScenes: [],
      activeHours: []
    };

    logger.info(`Learning preferences for ${profile.name}...`);

    return {
      success: true,
      learned
    };
  }

  trackDeviceUsage(userId, deviceId) {
    const profile = this.profiles.get(userId);
    
    if (!profile) return;

    // Track most used devices
    const device = profile.stats.mostUsedDevices.find(d => d.id === deviceId);
    
    if (device) {
      device.count++;
    } else {
      profile.stats.mostUsedDevices.push({ id: deviceId, count: 1 });
    }

    // Sort by usage
    profile.stats.mostUsedDevices.sort((a, b) => b.count - a.count);
    
    // Keep top 10
    profile.stats.mostUsedDevices = profile.stats.mostUsedDevices.slice(0, 10);
  }

  trackSceneUsage(userId, sceneId) {
    const profile = this.profiles.get(userId);
    
    if (!profile) return;

    // Track favorite scenes
    const scene = profile.stats.favoriteScenes.find(s => s.id === sceneId);
    
    if (scene) {
      scene.count++;
    } else {
      profile.stats.favoriteScenes.push({ id: sceneId, count: 1 });
    }

    // Sort by usage
    profile.stats.favoriteScenes.sort((a, b) => b.count - a.count);
    
    // Keep top 10
    profile.stats.favoriteScenes = profile.stats.favoriteScenes.slice(0, 10);
  }

  // ============================================
  // ANALYTICS & REPORTING
  // ============================================

  getProfileInfo(userId) {
    const profile = this.profiles.get(userId);
    
    if (!profile) return null;

    return {
      id: profile.id,
      name: profile.name,
      type: profile.type,
      avatar: profile.avatar,
      isActive: this.currentUser === userId,
      lastActive: profile.stats.lastActive,
      preferences: profile.preferences,
      automationSettings: profile.automationSettings
    };
  }

  getAllProfiles() {
    return Array.from(this.profiles.values()).map(p => ({
      id: p.id,
      name: p.name,
      type: p.type,
      isActive: this.currentUser === p.id,
      lastActive: p.stats.lastActive
    }));
  }

  getCurrentUser() {
    if (!this.currentUser) return null;

    return this.getProfileInfo(this.currentUser);
  }

  getUserStats(userId) {
    const profile = this.profiles.get(userId);
    
    if (!profile) return null;

    return {
      user: {
        id: profile.id,
        name: profile.name
      },
      stats: {
        created: profile.stats.created,
        lastActive: profile.stats.lastActive,
        totalActivations: profile.stats.totalActivations,
        totalTimeActive: profile.stats.totalTimeActive,
        averageActiveTime: profile.stats.totalActivations > 0 
          ? Math.round(profile.stats.totalTimeActive / profile.stats.totalActivations / 60000) 
          : 0 // minutes
      },
      usage: {
        favoriteScenes: profile.stats.favoriteScenes.slice(0, 5),
        mostUsedDevices: profile.stats.mostUsedDevices.slice(0, 5)
      },
      recentSwitches: this.profileSwitchLog
        .filter(log => log.to === userId)
        .slice(-10)
    };
  }

  getSystemStats() {
    const profiles = Array.from(this.profiles.values());
    
    return {
      totalProfiles: profiles.length,
      byType: {
        adults: profiles.filter(p => p.type === 'adult').length,
        children: profiles.filter(p => p.type === 'child').length,
        guests: profiles.filter(p => p.type === 'guest').length
      },
      currentUser: this.getCurrentUser(),
      recentSwitches: this.profileSwitchLog.slice(-10),
      totalSwitches: this.profileSwitchLog.length
    };
  }

  logProfileSwitch(switchInfo) {
    this.profileSwitchLog.push(switchInfo);

    // Trim log
    if (this.profileSwitchLog.length > 500) {
      this.profileSwitchLog = this.profileSwitchLog.slice(-500);
    }
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  async loadProfiles() {
    // Create default profiles for demo
    
    await this.createProfile({
      id: 'user_1',
      name: 'Magnus',
      type: 'adult',
      devices: ['phone_magnus'],
      preferences: {
        temperature: 21,
        lightingBrightness: 0.7,
        lightingColor: 'warm',
        wakeUpTime: '06:30',
        bedTime: '23:00'
      },
      schedule: {
        workDays: [1, 2, 3, 4, 5],
        workHours: { start: '08:00', end: '17:00' }
      }
    });

    await this.createProfile({
      id: 'user_2',
      name: 'Anna',
      type: 'adult',
      devices: ['phone_anna'],
      preferences: {
        temperature: 22,
        lightingBrightness: 0.6,
        lightingColor: 'neutral',
        wakeUpTime: '07:00',
        bedTime: '22:30'
      },
      schedule: {
        workDays: [1, 2, 3, 4, 5],
        workHours: { start: '09:00', end: '18:00' }
      }
    });

    await this.createProfile({
      id: 'user_3',
      name: 'Emma',
      type: 'child',
      devices: ['tablet_emma'],
      preferences: {
        temperature: 20.5,
        lightingBrightness: 0.5,
        lightingColor: 'cool',
        wakeUpTime: '07:30',
        bedTime: '21:00'
      },
      permissions: {
        canModifyAutomations: false,
        canControlAllDevices: false,
        canManageUsers: false,
        canViewEnergyData: false,
        canModifySchedules: false
      }
    });
  }

  destroy() {
    if (this._intervals) {
      this._intervals.forEach(id => clearInterval(id));
      this._intervals = [];
    }
    if (this._timeouts) {
      this._timeouts.forEach(id => clearTimeout(id));
      this._timeouts = [];
    }
  }
}

module.exports = UserProfileManager;
