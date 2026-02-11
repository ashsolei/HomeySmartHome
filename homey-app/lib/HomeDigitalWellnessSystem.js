'use strict';

const EventEmitter = require('events');

/**
 * Home Digital Wellness System
 *
 * Tracks and manages screen time, device usage patterns, and digital wellness
 * across the household. Provides tools for digital detox, focus zones,
 * family screen time budgets, and comprehensive wellness reporting.
 *
 * Features:
 * - Screen time tracking per user and device
 * - Digital detox mode with scheduled internet pauses
 * - Focus zone management (no-notification areas)
 * - Family screen time budgets with parental controls
 * - Internet scheduling and access management
 * - Notification batching and quiet hours
 * - Wellness reports with trends and recommendations
 * - App category usage breakdowns
 */
class HomeDigitalWellnessSystem extends EventEmitter {
  constructor(homey) {
    super();
    this.homey = homey;
    this.initialized = false;
    this.users = new Map();
    this.devices = new Map();
    this.focusZones = new Map();
    this.budgets = new Map();
    this.detoxSessions = [];
    this.usageHistory = [];
    this.notificationQueue = [];
    this.schedules = new Map();
    this.trackingInterval = null;
    this.batchInterval = null;
    this.reportInterval = null;
    this.quietHours = { enabled: false, start: '22:00', end: '07:00' };
  }

  /**
   * Initialize the digital wellness system
   * @returns {Promise<boolean>}
   */
  async initialize() {
    if (this.initialized) return true;

    this.homey.log('[HomeDigitalWellnessSystem] Initializing...');

    await this.loadSettings();
    this.initializeDefaultBudgets();
    this.startUsageTracking();
    this.startNotificationBatching();

    this.initialized = true;
    this.homey.log('[HomeDigitalWellnessSystem] Initialized');
    this.homey.emit('digital-wellness:initialized');
    return true;
  }

  /**
   * Load persisted settings from storage
   */
  async loadSettings() {
    const settings = await this.homey.settings.get('digitalWellness') || {};

    if (settings.users) {
      for (const [id, user] of Object.entries(settings.users)) {
        this.users.set(id, user);
      }
    }
    if (settings.budgets) {
      for (const [id, budget] of Object.entries(settings.budgets)) {
        this.budgets.set(id, budget);
      }
    }
    if (settings.focusZones) {
      for (const [id, zone] of Object.entries(settings.focusZones)) {
        this.focusZones.set(id, zone);
      }
    }
    if (settings.schedules) {
      for (const [id, schedule] of Object.entries(settings.schedules)) {
        this.schedules.set(id, schedule);
      }
    }
    if (settings.quietHours) {
      this.quietHours = settings.quietHours;
    }
  }

  /**
   * Initialize default screen time budgets
   */
  initializeDefaultBudgets() {
    if (this.budgets.size > 0) return;

    this.budgets.set('adult-default', {
      id: 'adult-default',
      name: 'Adult Default',
      dailyLimitMinutes: 480,
      categories: {
        social: 60,
        entertainment: 120,
        gaming: 60,
        productivity: 240,
        education: 120,
      },
      warningThreshold: 0.8,
      hardLimit: false,
    });

    this.budgets.set('child-default', {
      id: 'child-default',
      name: 'Child Default',
      dailyLimitMinutes: 120,
      categories: {
        social: 15,
        entertainment: 45,
        gaming: 30,
        productivity: 60,
        education: 120,
      },
      warningThreshold: 0.75,
      hardLimit: true,
    });

    this.budgets.set('teen-default', {
      id: 'teen-default',
      name: 'Teen Default',
      dailyLimitMinutes: 240,
      categories: {
        social: 45,
        entertainment: 90,
        gaming: 60,
        productivity: 120,
        education: 120,
      },
      warningThreshold: 0.8,
      hardLimit: true,
    });
  }

  /**
   * Register a user for screen time tracking
   * @param {object} userConfig - User configuration
   * @returns {object} Created user profile
   */
  async registerUser(userConfig) {
    const user = {
      id: userConfig.id || `user-${Date.now()}`,
      name: userConfig.name,
      role: userConfig.role || 'adult', // adult, teen, child
      budgetId: userConfig.budgetId || `${userConfig.role || 'adult'}-default`,
      devices: userConfig.devices || [],
      todayUsage: { totalMinutes: 0, categories: {}, sessions: [] },
      weeklyUsage: [],
      createdAt: new Date().toISOString(),
    };

    this.users.set(user.id, user);
    await this._saveSettings();

    this.homey.log(`[HomeDigitalWellnessSystem] User registered: ${user.name} (${user.role})`);
    this.homey.emit('digital-wellness:user-registered', { userId: user.id, name: user.name });

    return user;
  }

  /**
   * Record screen time usage for a user
   * @param {string} userId - User identifier
   * @param {object} usage - Usage data
   */
  async recordUsage(userId, usage) {
    const user = this.users.get(userId);
    if (!user) return { success: false, error: 'User not found' };

    const entry = {
      timestamp: new Date().toISOString(),
      deviceId: usage.deviceId,
      category: usage.category || 'uncategorized',
      durationMinutes: usage.durationMinutes,
      appName: usage.appName || null,
    };

    user.todayUsage.totalMinutes += entry.durationMinutes;
    user.todayUsage.categories[entry.category] =
      (user.todayUsage.categories[entry.category] || 0) + entry.durationMinutes;
    user.todayUsage.sessions.push(entry);

    this.usageHistory.push({ userId, ...entry });

    // check budget
    const budget = this.budgets.get(user.budgetId);
    if (budget) {
      const usagePercent = user.todayUsage.totalMinutes / budget.dailyLimitMinutes;

      if (usagePercent >= 1 && budget.hardLimit) {
        this.homey.emit('digital-wellness:limit-reached', {
          userId,
          totalMinutes: user.todayUsage.totalMinutes,
          limit: budget.dailyLimitMinutes,
        });
      } else if (usagePercent >= budget.warningThreshold) {
        this.homey.emit('digital-wellness:limit-warning', {
          userId,
          totalMinutes: user.todayUsage.totalMinutes,
          limit: budget.dailyLimitMinutes,
          percent: Math.round(usagePercent * 100),
        });
      }
    }

    return { success: true, todayTotal: user.todayUsage.totalMinutes };
  }

  /**
   * Start a digital detox session
   * @param {object} config - Detox session configuration
   * @returns {object} Detox session details
   */
  async startDigitalDetox(config = {}) {
    const session = {
      id: `detox-${Date.now()}`,
      userId: config.userId || 'all',
      durationMinutes: config.durationMinutes || 60,
      blockedCategories: config.blockedCategories || ['social', 'entertainment', 'gaming'],
      allowedApps: config.allowedApps || [],
      startedAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + (config.durationMinutes || 60) * 60000).toISOString(),
      status: 'active',
    };

    this.detoxSessions.push(session);

    this.homey.log(`[HomeDigitalWellnessSystem] Digital detox started: ${session.id} (${session.durationMinutes}min)`);
    this.homey.emit('digital-wellness:detox-started', session);

    return session;
  }

  /**
   * Create or update a focus zone
   * @param {object} zoneConfig - Focus zone configuration
   * @returns {object} Focus zone details
   */
  async configureFocusZone(zoneConfig) {
    const zone = {
      id: zoneConfig.id || `focus-${Date.now()}`,
      name: zoneConfig.name,
      roomId: zoneConfig.roomId,
      enabled: zoneConfig.enabled !== false,
      blockNotifications: zoneConfig.blockNotifications !== false,
      blockSocial: zoneConfig.blockSocial !== false,
      allowedDevices: zoneConfig.allowedDevices || [],
      schedule: zoneConfig.schedule || null,
      updatedAt: new Date().toISOString(),
    };

    this.focusZones.set(zone.id, zone);
    await this._saveSettings();

    this.homey.emit('digital-wellness:focus-zone-updated', zone);
    return zone;
  }

  /**
   * Set up internet scheduling rules
   * @param {object} schedule - Internet schedule configuration
   */
  async setInternetSchedule(schedule) {
    const entry = {
      id: schedule.id || `schedule-${Date.now()}`,
      userId: schedule.userId,
      daysOfWeek: schedule.daysOfWeek || [0, 1, 2, 3, 4, 5, 6],
      allowedStart: schedule.allowedStart || '06:00',
      allowedEnd: schedule.allowedEnd || '22:00',
      exceptions: schedule.exceptions || [],
      enabled: schedule.enabled !== false,
      createdAt: new Date().toISOString(),
    };

    this.schedules.set(entry.id, entry);
    await this._saveSettings();

    this.homey.log(`[HomeDigitalWellnessSystem] Internet schedule set for user ${entry.userId}`);
    this.homey.emit('digital-wellness:schedule-updated', entry);

    return entry;
  }

  /**
   * Configure notification batching and quiet hours
   * @param {object} config - Quiet hours and batching configuration
   */
  async configureQuietHours(config) {
    this.quietHours = {
      enabled: config.enabled !== false,
      start: config.start || '22:00',
      end: config.end || '07:00',
      batchIntervalMinutes: config.batchIntervalMinutes || 30,
      allowUrgent: config.allowUrgent !== false,
      allowedContacts: config.allowedContacts || [],
    };

    await this._saveSettings();
    this.homey.emit('digital-wellness:quiet-hours-updated', this.quietHours);

    return this.quietHours;
  }

  /**
   * Generate a wellness report for a user
   * @param {string} userId - User identifier
   * @param {string} period - Report period: 'daily', 'weekly', 'monthly'
   * @returns {object} Wellness report
   */
  async generateWellnessReport(userId, period = 'daily') {
    const user = this.users.get(userId);
    if (!user) return { success: false, error: 'User not found' };

    const budget = this.budgets.get(user.budgetId);
    const report = {
      userId,
      userName: user.name,
      period,
      generatedAt: new Date().toISOString(),
      totalScreenTime: user.todayUsage.totalMinutes,
      categoryBreakdown: { ...user.todayUsage.categories },
      budgetCompliance: budget
        ? Math.round((1 - user.todayUsage.totalMinutes / budget.dailyLimitMinutes) * 100)
        : null,
      detoxSessions: this.detoxSessions.filter(s => s.userId === userId || s.userId === 'all').length,
      recommendations: [],
    };

    // generate recommendations
    if (budget && user.todayUsage.totalMinutes > budget.dailyLimitMinutes * 0.9) {
      report.recommendations.push('Consider reducing entertainment screen time');
    }
    if ((user.todayUsage.categories.social || 0) > 60) {
      report.recommendations.push('Social media usage is high — try a short detox');
    }
    if (report.detoxSessions === 0) {
      report.recommendations.push('Schedule regular digital detox breaks');
    }

    this.homey.emit('digital-wellness:report-generated', { userId, period });
    return report;
  }

  /**
   * Start periodic usage tracking
   */
  startUsageTracking() {
    if (this.trackingInterval) clearInterval(this.trackingInterval);

    this.trackingInterval = setInterval(() => {
      // daily reset check
      const now = new Date();
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        for (const [, user] of this.users) {
          user.weeklyUsage.push({ ...user.todayUsage, date: new Date().toISOString() });
          if (user.weeklyUsage.length > 30) user.weeklyUsage = user.weeklyUsage.slice(-30);
          user.todayUsage = { totalMinutes: 0, categories: {}, sessions: [] };
        }
        this.homey.log('[HomeDigitalWellnessSystem] Daily usage reset');
      }

      // trim usage history
      if (this.usageHistory.length > 10000) {
        this.usageHistory = this.usageHistory.slice(-5000);
      }
    }, 60 * 1000);
  }

  /**
   * Start notification batching timer
   */
  startNotificationBatching() {
    if (this.batchInterval) clearInterval(this.batchInterval);

    this.batchInterval = setInterval(() => {
      if (this.notificationQueue.length > 0 && !this._isQuietHour()) {
        const batch = [...this.notificationQueue];
        this.notificationQueue = [];
        this.homey.emit('digital-wellness:notification-batch', { count: batch.length, notifications: batch });
      }
    }, 5 * 60 * 1000); // every 5 minutes
  }

  /**
   * Get current system status
   * @returns {object} System status
   */
  async getStatus() {
    return {
      initialized: this.initialized,
      userCount: this.users.size,
      activeDetoxSessions: this.detoxSessions.filter(s => s.status === 'active').length,
      focusZoneCount: this.focusZones.size,
      budgetCount: this.budgets.size,
      scheduleCount: this.schedules.size,
      quietHours: this.quietHours,
      pendingNotifications: this.notificationQueue.length,
      usageHistoryEntries: this.usageHistory.length,
    };
  }

  /**
   * Destroy the system and clean up resources
   */
  destroy() {
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
    }
    if (this.batchInterval) {
      clearInterval(this.batchInterval);
      this.batchInterval = null;
    }
    if (this.reportInterval) {
      clearInterval(this.reportInterval);
      this.reportInterval = null;
    }

    this.users.clear();
    this.devices.clear();
    this.focusZones.clear();
    this.budgets.clear();
    this.schedules.clear();
    this.detoxSessions = [];
    this.usageHistory = [];
    this.notificationQueue = [];
    this.initialized = false;

    this.homey.log('[HomeDigitalWellnessSystem] Destroyed');
  }

  // ── Private helpers ──

  async _saveSettings() {
    const data = {
      users: Object.fromEntries(this.users),
      budgets: Object.fromEntries(this.budgets),
      focusZones: Object.fromEntries(this.focusZones),
      schedules: Object.fromEntries(this.schedules),
      quietHours: this.quietHours,
    };
    await this.homey.settings.set('digitalWellness', data);
  }

  _isQuietHour() {
    if (!this.quietHours.enabled) return false;
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const { start, end } = this.quietHours;

    if (start <= end) {
      return currentTime >= start && currentTime < end;
    }
    return currentTime >= start || currentTime < end;
  }
}

module.exports = HomeDigitalWellnessSystem;
