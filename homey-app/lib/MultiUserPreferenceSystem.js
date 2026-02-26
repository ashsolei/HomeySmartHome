'use strict';

/**
 * Multi-User Preference System
 * Per-user settings, preference learning, and conflict resolution
 */
class MultiUserPreferenceSystem {
  constructor(homey) {
    this.homey = homey;
    this.users = new Map();
    this.preferences = new Map();
    this.profiles = new Map();
    this.activeUser = null;
    this.conflictResolver = null;
  }

  async initialize() {
    try {
      this.log('Initializing Multi-User Preference System...');

      // Load users
      const savedUsers = await this.homey.settings.get('users') || {};
      Object.entries(savedUsers).forEach(([id, user]) => {
        this.users.set(id, user);
      });

      // Load preferences
      const savedPreferences = await this.homey.settings.get('userPreferences') || {};
      Object.entries(savedPreferences).forEach(([id, prefs]) => {
        this.preferences.set(id, prefs);
      });

      // Load profiles
      const savedProfiles = await this.homey.settings.get('userProfiles') || {};
      Object.entries(savedProfiles).forEach(([id, profile]) => {
        this.profiles.set(id, profile);
      });

      // Create default profiles if needed
      if (this.users.size === 0) {
        await this.createDefaultUser();
      }

      // Start preference learning
      await this.startPreferenceLearning();

      this.log('Multi-User Preference System initialized');
    } catch (error) {
      console.error(`[MultiUserPreferenceSystem] Failed to initialize:`, error.message);
    }
  }

  /**
   * Create default user
   */
  async createDefaultUser() {
    const defaultUser = {
      id: 'default',
      name: 'Default User',
      role: 'admin',
      created: Date.now()
    };

    await this.createUser(defaultUser);
    await this.setActiveUser('default');
  }

  /**
   * Create a new user
   */
  async createUser(userData) {
    const user = {
      id: userData.id || this.generateUserId(),
      name: userData.name,
      email: userData.email,
      role: userData.role || 'user', // admin, user, guest
      created: Date.now(),
      lastActive: null,
      enabled: userData.enabled !== false,
      metadata: userData.metadata || {}
    };

    this.users.set(user.id, user);

    // Create default preferences
    await this.createDefaultPreferences(user.id);

    // Create default profile
    await this.createDefaultProfile(user.id);

    await this.saveUsers();

    return user;
  }

  /**
   * Create default preferences for user
   */
  async createDefaultPreferences(userId) {
    const preferences = {
      userId,
      climate: {
        preferredTemperature: 21,
        temperatureRange: { min: 18, max: 24 },
        autoAdjust: true
      },
      lighting: {
        preferredBrightness: 80,
        colorTemperature: 4000,
        adaptiveLighting: true,
        preferredScenes: []
      },
      automation: {
        morningRoutine: {
          enabled: true,
          time: '07:00',
          actions: []
        },
        eveningRoutine: {
          enabled: true,
          time: '22:00',
          actions: []
        },
        arrivalActions: [],
        departureActions: []
      },
      notifications: {
        channels: ['push'],
        quietHours: {
          enabled: true,
          start: '22:00',
          end: '07:00'
        },
        priorities: {
          security: 'high',
          energy: 'normal',
          info: 'low'
        }
      },
      voice: {
        enabled: true,
        language: 'sv',
        customCommands: []
      },
      dashboard: {
        layout: 'default',
        widgets: ['energy', 'climate', 'security', 'scenes'],
        refreshInterval: 5000
      },
      privacy: {
        sharePresence: true,
        shareActivity: true,
        dataRetention: 90 // days
      }
    };

    this.preferences.set(userId, preferences);
    await this.savePreferences();

    return preferences;
  }

  /**
   * Create default profile for user
   */
  async createDefaultProfile(userId) {
    const profile = {
      userId,
      behavioral: {
        activityPatterns: {},
        sleepSchedule: {
          weekday: { sleep: '23:00', wake: '07:00' },
          weekend: { sleep: '00:00', wake: '08:00' }
        },
        favoriteDevices: [],
        frequentActions: []
      },
      learned: {
        temperaturePreferences: [],
        lightingPreferences: [],
        routinePatterns: [],
        deviceUsage: {}
      },
      contextual: {
        homeOffice: false,
        fitnessRoutine: false,
        cookingFrequency: 'moderate',
        entertainmentPreferences: []
      },
      created: Date.now(),
      lastUpdated: Date.now()
    };

    this.profiles.set(userId, profile);
    await this.saveProfiles();

    return profile;
  }

  /**
   * Set active user
   */
  async setActiveUser(userId) {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    this.activeUser = userId;
    user.lastActive = Date.now();

    // Apply user preferences
    await this.applyUserPreferences(userId);

    await this.saveUsers();

    this.log(`Active user set to: ${user.name}`);

    return user;
  }

  /**
   * Apply user preferences to system
   */
  async applyUserPreferences(userId) {
    const preferences = this.preferences.get(userId);
    if (!preferences) return;

    // Apply climate preferences
    if (this.homey.app.climateManager) {
      await this.applyClimatePreferences(preferences.climate);
    }

    // Apply notification preferences
    if (this.homey.app.advancedNotificationManager) {
      await this.applyNotificationPreferences(userId, preferences.notifications);
    }

    // Apply dashboard preferences
    if (this.homey.app.intelligentDashboard) {
      await this.applyDashboardPreferences(userId, preferences.dashboard);
    }

    this.log(`Applied preferences for user: ${userId}`);
  }

  async applyClimatePreferences(climatePrefs) {
    try {
      await this.homey.app.climateManager.setTargetTemperature(climatePrefs.preferredTemperature);
    } catch (error) {
      this.error('Failed to apply climate preferences:', error);
    }
  }

  async applyNotificationPreferences(userId, notifPrefs) {
    try {
      this.homey.app.advancedNotificationManager.userPreferences = notifPrefs;
    } catch (error) {
      this.error('Failed to apply notification preferences:', error);
    }
  }

  async applyDashboardPreferences(userId, _dashboardPrefs) {
    // Dashboard would read preferences when loading
    this.log('Dashboard preferences ready for user:', userId);
  }

  /**
   * Update user preferences
   */
  async updatePreferences(userId, updates) {
    const preferences = this.preferences.get(userId);
    if (!preferences) {
      throw new Error('Preferences not found');
    }

    // Deep merge updates
    this.deepMerge(preferences, updates);

    await this.savePreferences();

    // Re-apply if active user
    if (this.activeUser === userId) {
      await this.applyUserPreferences(userId);
    }

    return preferences;
  }

  /**
   * Learn user preferences from behavior
   */
  async learnPreference(userId, category, data) {
    const profile = this.profiles.get(userId);
    if (!profile) return;

    switch (category) {
      case 'temperature':
        await this.learnTemperaturePreference(profile, data);
        break;

      case 'lighting':
        await this.learnLightingPreference(profile, data);
        break;

      case 'routine':
        await this.learnRoutinePattern(profile, data);
        break;

      case 'device_usage':
        await this.learnDeviceUsage(profile, data);
        break;

      default:
        this.log(`Unknown learning category: ${category}`);
    }

    profile.lastUpdated = Date.now();
    await this.saveProfiles();
  }

  /**
   * Learn temperature preferences
   */
  async learnTemperaturePreference(profile, data) {
    const { temperature, time, context } = data;

    profile.learned.temperaturePreferences.push({
      temperature,
      hour: new Date(time).getHours(),
      dayOfWeek: new Date(time).getDay(),
      context,
      timestamp: time
    });

    // Keep only last 200 data points
    if (profile.learned.temperaturePreferences.length > 200) {
      profile.learned.temperaturePreferences.shift();
    }

    // Analyze and update preferences
    await this.analyzeTemperaturePreferences(profile);
  }

  async analyzeTemperaturePreferences(profile) {
    const data = profile.learned.temperaturePreferences;
    if (data.length < 20) return;

    // Calculate average preferred temperature by time of day
    const byHour = {};
    for (const entry of data) {
      if (!byHour[entry.hour]) byHour[entry.hour] = [];
      byHour[entry.hour].push(entry.temperature);
    }

    // Update user preferences based on patterns
    const userId = profile.userId;
    const preferences = this.preferences.get(userId);
    
    if (preferences) {
      const avgTemp = this.calculateMean(data.map(d => d.temperature));
      preferences.climate.preferredTemperature = Math.round(avgTemp * 10) / 10;
    }
  }

  /**
   * Learn lighting preferences
   */
  async learnLightingPreference(profile, data) {
    const { deviceId, brightness, colorTemp, time } = data;

    profile.learned.lightingPreferences.push({
      deviceId,
      brightness,
      colorTemp,
      hour: new Date(time).getHours(),
      timestamp: time
    });

    if (profile.learned.lightingPreferences.length > 200) {
      profile.learned.lightingPreferences.shift();
    }
  }

  /**
   * Learn routine patterns
   */
  async learnRoutinePattern(profile, data) {
    const { action, time, devices } = data;

    profile.learned.routinePatterns.push({
      action,
      devices,
      hour: new Date(time).getHours(),
      dayOfWeek: new Date(time).getDay(),
      timestamp: time
    });

    if (profile.learned.routinePatterns.length > 500) {
      profile.learned.routinePatterns.shift();
    }

    // Identify common patterns
    await this.identifyRoutinePatterns(profile);
  }

  async identifyRoutinePatterns(profile) {
    // Group patterns by time and action type
    const patterns = this.groupPatterns(profile.learned.routinePatterns);

    // Suggest automation based on patterns
    for (const pattern of patterns) {
      if (pattern.frequency >= 5) {
        await this.suggestAutomation(profile.userId, pattern);
      }
    }
  }

  groupPatterns(data) {
    // Simplified pattern grouping
    const groups = new Map();

    for (const entry of data) {
      const key = `${entry.hour}_${entry.action}`;
      if (!groups.has(key)) {
        groups.set(key, {
          hour: entry.hour,
          action: entry.action,
          devices: new Set(),
          frequency: 0
        });
      }

      const group = groups.get(key);
      group.frequency++;
      entry.devices?.forEach(d => group.devices.add(d));
    }

    return Array.from(groups.values());
  }

  async suggestAutomation(userId, pattern) {
    this.log(`Suggesting automation for user ${userId}:`, pattern);

    // Could create notification or UI suggestion
    await this.homey.notifications.createNotification({
      excerpt: `Automation förslag: Automatisera "${pattern.action}" kl ${pattern.hour}:00`
    });
  }

  /**
   * Learn device usage patterns
   */
  async learnDeviceUsage(profile, data) {
    const { deviceId, action, timestamp } = data;

    if (!profile.learned.deviceUsage[deviceId]) {
      profile.learned.deviceUsage[deviceId] = {
        usageCount: 0,
        lastUsed: null,
        usageTimes: []
      };
    }

    const usage = profile.learned.deviceUsage[deviceId];
    usage.usageCount++;
    usage.lastUsed = timestamp;
    usage.usageTimes.push({
      action,
      hour: new Date(timestamp).getHours(),
      timestamp
    });

    // Keep only last 100 usage times per device
    if (usage.usageTimes.length > 100) {
      usage.usageTimes.shift();
    }

    // Track favorite devices
    await this.updateFavoriteDevices(profile);
  }

  async updateFavoriteDevices(profile) {
    const deviceUsage = Object.entries(profile.learned.deviceUsage)
      .map(([deviceId, usage]) => ({ deviceId, count: usage.usageCount }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    profile.behavioral.favoriteDevices = deviceUsage.map(d => d.deviceId);
  }

  /**
   * Detect active user from presence/behavior
   */
  async detectActiveUser() {
    // Simplified detection
    // In production, would use phone detection, voice recognition, etc.
    
    const presenceManager = this.homey.app.presenceManager;
    if (!presenceManager) return null;

    const status = await presenceManager.getStatus();
    
    if (status.status === 'home' && status.users) {
      // Return first detected user
      return status.users[0] || this.activeUser;
    }

    return this.activeUser;
  }

  /**
   * Handle preference conflict between users
   */
  async resolveConflict(conflictData) {
    const { type, users, values } = conflictData;

    switch (type) {
      case 'temperature':
        return await this.resolveTemperatureConflict(users, values);

      case 'lighting':
        return await this.resolveLightingConflict(users, values);

      case 'scene':
        return await this.resolveSceneConflict(users, values);

      default:
        // Default: use priority/voting
        return this.resolveByPriority(users, values);
    }
  }

  async resolveTemperatureConflict(users, values) {
    // Average the preferred temperatures
    const temps = values.map(v => v.temperature);
    const avgTemp = this.calculateMean(temps);

    return {
      resolution: 'average',
      value: Math.round(avgTemp * 10) / 10,
      reason: 'Genomsnitt av användarpreferenser'
    };
  }

  async resolveLightingConflict(users, values) {
    // Use highest priority user's preference
    const sortedUsers = users
      .map(userId => this.users.get(userId))
      .sort((a, b) => this.getUserPriority(b) - this.getUserPriority(a));

    const winnerIndex = users.indexOf(sortedUsers[0].id);

    return {
      resolution: 'priority',
      value: values[winnerIndex],
      reason: `Prioritet för ${sortedUsers[0].name}`
    };
  }

  async resolveSceneConflict(users, values) {
    // Voting mechanism
    const votes = {};
    values.forEach(v => {
      votes[v.sceneId] = (votes[v.sceneId] || 0) + 1;
    });

    const winner = Object.entries(votes)
      .sort((a, b) => b[1] - a[1])[0];

    return {
      resolution: 'vote',
      value: { sceneId: winner[0] },
      reason: `${winner[1]} röster`
    };
  }

  resolveByPriority(users, values) {
    const sortedUsers = users
      .map(userId => this.users.get(userId))
      .sort((a, b) => this.getUserPriority(b) - this.getUserPriority(a));

    const winnerIndex = users.indexOf(sortedUsers[0].id);

    return {
      resolution: 'priority',
      value: values[winnerIndex],
      reason: 'Användarprioritet'
    };
  }

  getUserPriority(user) {
    if (user.role === 'admin') return 3;
    if (user.role === 'user') return 2;
    return 1; // guest
  }

  /**
   * Get user profile with learned preferences
   */
  getUserProfile(userId) {
    const user = this.users.get(userId);
    const preferences = this.preferences.get(userId);
    const profile = this.profiles.get(userId);

    if (!user) return null;

    return {
      user,
      preferences,
      profile,
      insights: this.generateUserInsights(profile)
    };
  }

  /**
   * Generate insights from user profile
   */
  generateUserInsights(profile) {
    if (!profile) return [];

    const insights = [];

    // Most used devices
    const topDevices = Object.entries(profile.learned.deviceUsage)
      .sort((a, b) => b[1].usageCount - a[1].usageCount)
      .slice(0, 3)
      .map(([deviceId, usage]) => ({
        deviceId,
        usageCount: usage.usageCount
      }));

    if (topDevices.length > 0) {
      insights.push({
        type: 'device_usage',
        title: 'Mest använda enheter',
        data: topDevices
      });
    }

    // Active times
    const routineTimes = profile.learned.routinePatterns
      .map(p => p.hour);
    
    if (routineTimes.length > 0) {
      const peakHour = this.findMostCommon(routineTimes);
      insights.push({
        type: 'activity',
        title: 'Mest aktiv tid',
        data: { hour: peakHour }
      });
    }

    // Temperature preference trend
    const tempPrefs = profile.learned.temperaturePreferences;
    if (tempPrefs.length > 10) {
      const avgTemp = this.calculateMean(tempPrefs.map(t => t.temperature));
      insights.push({
        type: 'temperature',
        title: 'Genomsnittlig temperaturpreferens',
        data: { temperature: Math.round(avgTemp * 10) / 10 }
      });
    }

    return insights;
  }

  /**
   * Start preference learning system
   */
  async startPreferenceLearning() {
    // Monitor device interactions
    this.homey.devices.on('device.update', async (device) => {
      if (!this.activeUser) return;

      await this.learnPreference(this.activeUser, 'device_usage', {
        deviceId: device.id,
        action: 'update',
        timestamp: Date.now()
      });
    });

    // Periodic analysis
    this.learningInterval = setInterval(async () => {
      await this.analyzeBehaviorPatterns();
    }, 3600000); // Every hour
  }

  async analyzeBehaviorPatterns() {
    for (const [_userId, profile] of this.profiles) {
      await this.analyzeTemperaturePreferences(profile);
      await this.updateFavoriteDevices(profile);
      await this.identifyRoutinePatterns(profile);
    }
  }

  /**
   * Export user data (GDPR compliance)
   */
  async exportUserData(userId) {
    const user = this.users.get(userId);
    const preferences = this.preferences.get(userId);
    const profile = this.profiles.get(userId);

    if (!user) {
      throw new Error('User not found');
    }

    return {
      user,
      preferences,
      profile,
      exported: Date.now()
    };
  }

  /**
   * Delete user data (GDPR compliance)
   */
  async deleteUserData(userId) {
    this.users.delete(userId);
    this.preferences.delete(userId);
    this.profiles.delete(userId);

    await this.saveUsers();
    await this.savePreferences();
    await this.saveProfiles();

    this.log(`Deleted all data for user: ${userId}`);
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  deepMerge(target, source) {
    for (const key in source) {
      if (source[key] instanceof Object && key in target) {
        Object.assign(source[key], this.deepMerge(target[key], source[key]));
      }
    }
    Object.assign(target || {}, source);
    return target;
  }

  calculateMean(values) {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  findMostCommon(arr) {
    const counts = {};
    let maxCount = 0;
    let mostCommon = arr[0];

    for (const item of arr) {
      counts[item] = (counts[item] || 0) + 1;
      if (counts[item] > maxCount) {
        maxCount = counts[item];
        mostCommon = item;
      }
    }

    return mostCommon;
  }

  generateUserId() {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async saveUsers() {
    const data = {};
    this.users.forEach((user, id) => {
      data[id] = user;
    });
    await this.homey.settings.set('users', data);
  }

  async savePreferences() {
    const data = {};
    this.preferences.forEach((prefs, id) => {
      data[id] = prefs;
    });
    await this.homey.settings.set('userPreferences', data);
  }

  async saveProfiles() {
    const data = {};
    this.profiles.forEach((profile, id) => {
      data[id] = profile;
    });
    await this.homey.settings.set('userProfiles', data);
  }

  log(...args) {
    console.log('[MultiUserPreferenceSystem]', ...args);
  }

  error(...args) {
    console.error('[MultiUserPreferenceSystem]', ...args);
  }
}

module.exports = MultiUserPreferenceSystem;
