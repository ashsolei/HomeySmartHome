'use strict';
const logger = require('./logger');

/**
 * Advanced Notification System
 * Multi-channel, priority-based notification system with smart filtering
 */
class NotificationSystem {
  constructor(app) {
    this._intervals = [];
    this.app = app;
    this.channels = new Map();
    this.notificationQueue = [];
    this.history = [];
    this.rules = new Map();
    this.userPreferences = {};
    this.maxHistorySize = 1000;
  }

  async initialize() {
    // Initialize notification channels
    this.initializeChannels();
    
    // Load user preferences
    await this.loadPreferences();
    
    // Initialize notification rules
    this.initializeRules();
    
    // Start queue processor
    this.startQueueProcessor();
  }

  // ============================================
  // CHANNEL MANAGEMENT
  // ============================================

  initializeChannels() {
    // Homey native notifications
    this.channels.set('homey', {
      name: 'Homey App',
      type: 'push',
      enabled: true,
      priority: ['critical', 'high', 'normal', 'low'],
      send: async (notification) => await this.sendHomeyNotification(notification)
    });

    // Mobile push notifications
    this.channels.set('mobile', {
      name: 'Mobile Push',
      type: 'push',
      enabled: true,
      priority: ['critical', 'high'],
      send: async (notification) => await this.sendMobilePush(notification)
    });

    // Email notifications
    this.channels.set('email', {
      name: 'Email',
      type: 'email',
      enabled: false,
      priority: ['critical', 'high'],
      send: async (notification) => await this.sendEmail(notification)
    });

    // SMS notifications (for critical alerts)
    this.channels.set('sms', {
      name: 'SMS',
      type: 'sms',
      enabled: false,
      priority: ['critical'],
      send: async (notification) => await this.sendSMS(notification)
    });

    // Speech/TTS notifications
    this.channels.set('speech', {
      name: 'Speech',
      type: 'audio',
      enabled: true,
      priority: ['critical', 'high'],
      send: async (notification) => await this.sendSpeechNotification(notification)
    });

    // Dashboard notifications
    this.channels.set('dashboard', {
      name: 'Dashboard',
      type: 'visual',
      enabled: true,
      priority: ['critical', 'high', 'normal', 'low'],
      send: async (notification) => await this.sendDashboardNotification(notification)
    });
  }

  // ============================================
  // NOTIFICATION CREATION
  // ============================================

  async send(notification) {
    // Validate and enrich notification
    const enrichedNotification = this.enrichNotification(notification);
    
    // Check if notification should be sent (rules, quiet hours, etc.)
    if (!this.shouldSendNotification(enrichedNotification)) {
      return { sent: false, reason: 'filtered' };
    }

    // Add to queue
    this.notificationQueue.push(enrichedNotification);
    
    // Add to history
    this.addToHistory(enrichedNotification);

    return { sent: true, id: enrichedNotification.id };
  }

  enrichNotification(notification) {
    return {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      priority: notification.priority || 'normal',
      category: notification.category || 'general',
      title: notification.title,
      message: notification.message,
      data: notification.data || {},
      actions: notification.actions || [],
      channels: notification.channels || ['homey', 'dashboard'],
      icon: notification.icon || this.getDefaultIcon(notification.category),
      sound: notification.sound,
      persistent: notification.persistent || false,
      expiresAt: notification.expiresAt || (Date.now() + 24 * 60 * 60 * 1000)
    };
  }

  // ============================================
  // NOTIFICATION RULES
  // ============================================

  initializeRules() {
    // Quiet hours rule
    this.rules.set('quiet_hours', {
      name: 'Tyst-läge',
      description: 'Ingen notifikation under nattetid (utom kritiska)',
      enabled: true,
      check: (notification) => {
        const hour = new Date().getHours();
        const isQuietTime = hour >= 22 || hour <= 7;
        return !isQuietTime || notification.priority === 'critical';
      }
    });

    // Duplicate suppression
    this.rules.set('duplicate_suppression', {
      name: 'Undvik dubbletter',
      description: 'Blockera identiska notifikationer inom 5 minuter',
      enabled: true,
      check: (notification) => {
        const recentSimilar = this.history
          .filter(h => Date.now() - h.timestamp < 5 * 60 * 1000)
          .find(h => 
            h.title === notification.title && 
            h.message === notification.message
          );
        return !recentSimilar;
      }
    });

    // Rate limiting
    this.rules.set('rate_limit', {
      name: 'Hastighetsbegränsning',
      description: 'Max 10 notifikationer per 5 minuter',
      enabled: true,
      check: (notification) => {
        const recent = this.history.filter(h => 
          Date.now() - h.timestamp < 5 * 60 * 1000
        );
        return recent.length < 10 || notification.priority === 'critical';
      }
    });

    // Category grouping
    this.rules.set('category_grouping', {
      name: 'Gruppera liknande',
      description: 'Gruppera liknande notifikationer',
      enabled: true,
      check: (notification) => {
        const sameCategory = this.history
          .filter(h => 
            h.category === notification.category &&
            Date.now() - h.timestamp < 60 * 1000
          );
        return sameCategory.length < 3 || notification.priority === 'critical';
      }
    });
  }

  shouldSendNotification(notification) {
    // Always send critical notifications
    if (notification.priority === 'critical') {
      return true;
    }

    // Check all enabled rules
    for (const [_key, rule] of this.rules) {
      if (rule.enabled && !rule.check(notification)) {
        logger.info(`Notification blocked by rule: ${rule.name}`);
        return false;
      }
    }

    return true;
  }

  // ============================================
  // QUEUE PROCESSING
  // ============================================

  startQueueProcessor() {
    this._intervals.push(setInterval(() => {
      this.processQueue();
    }, 1000)); // Process every second
  }

  async processQueue() {
    if (this.notificationQueue.length === 0) return;

    // Sort by priority
    this.notificationQueue.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    // Process notifications
    while (this.notificationQueue.length > 0) {
      const notification = this.notificationQueue.shift();
      await this.dispatchNotification(notification);
    }
  }

  async dispatchNotification(notification) {
    const results = [];

    for (const channelId of notification.channels) {
      const channel = this.channels.get(channelId);
      
      if (!channel || !channel.enabled) continue;
      
      // Check if channel supports this priority
      if (!channel.priority.includes(notification.priority)) continue;

      try {
        await channel.send(notification);
        results.push({ channel: channelId, success: true });
      } catch (error) {
        logger.error(`Channel ${channelId} error:`, error);
        results.push({ channel: channelId, success: false, error: error.message });
      }
    }

    return results;
  }

  // ============================================
  // CHANNEL IMPLEMENTATIONS
  // ============================================

  async sendHomeyNotification(notification) {
    try {
      await this.app.api.notifications.createNotification({
        excerpt: `${notification.title}: ${notification.message}`
      });
      return { sent: true };
    } catch (error) {
      logger.error('Homey notification error:', error);
      return { sent: false, error };
    }
  }

  async sendMobilePush(notification) {
    // Integration with mobile push service (FCM, APNS, etc.)
    logger.info('Mobile push:', notification.title);
    return { sent: true, platform: 'mobile' };
  }

  async sendEmail(notification) {
    // Email integration (SMTP, SendGrid, etc.)
    logger.info('Email notification:', notification.title);
    return { sent: true, platform: 'email' };
  }

  async sendSMS(notification) {
    // SMS integration (Twilio, etc.)
    logger.info('SMS notification:', notification.title);
    return { sent: true, platform: 'sms' };
  }

  async sendSpeechNotification(notification) {
    try {
      // Use Homey's speech output
      await this.app.speechOutput({
        text: `${notification.title}. ${notification.message}`
      });
      return { sent: true };
    } catch (error) {
      logger.error('Speech notification error:', error);
      return { sent: false, error };
    }
  }

  async sendDashboardNotification(notification) {
    // Emit to dashboard via Socket.io or similar
    logger.info('Dashboard notification:', notification.title);
    return { sent: true, platform: 'dashboard' };
  }

  // ============================================
  // NOTIFICATION TEMPLATES
  // ============================================

  async sendEnergyAlert(data) {
    return await this.send({
      priority: 'high',
      category: 'energy',
      title: 'Energivarning',
      message: data.message,
      data,
      icon: '⚡',
      actions: [
        { id: 'view_details', label: 'Se detaljer' },
        { id: 'dismiss', label: 'Avfärda' }
      ]
    });
  }

  async sendSecurityAlert(data) {
    return await this.send({
      priority: 'critical',
      category: 'security',
      title: 'Säkerhetsvarning',
      message: data.message,
      data,
      icon: '🔒',
      channels: ['homey', 'mobile', 'speech', 'dashboard'],
      sound: 'alert',
      persistent: true
    });
  }

  async sendComfortRecommendation(data) {
    return await this.send({
      priority: 'low',
      category: 'comfort',
      title: 'Komfortrekommendation',
      message: data.message,
      data,
      icon: '🏡',
      actions: [
        { id: 'apply', label: 'Tillämpa' },
        { id: 'dismiss', label: 'Avfärda' }
      ]
    });
  }

  async sendAutomationNotification(data) {
    return await this.send({
      priority: 'normal',
      category: 'automation',
      title: 'Automation',
      message: data.message,
      data,
      icon: '🤖'
    });
  }

  async sendDeviceAlert(device, status) {
    return await this.send({
      priority: status === 'offline' ? 'high' : 'normal',
      category: 'device',
      title: `Enhet: ${device.name}`,
      message: `Status: ${status}`,
      data: { device, status },
      icon: '📱'
    });
  }

  async sendWeatherAlert(data) {
    return await this.send({
      priority: data.severity || 'normal',
      category: 'weather',
      title: 'Vädervarning',
      message: data.message,
      data,
      icon: this.getWeatherIcon(data.type)
    });
  }

  async sendCostSavingTip(data) {
    return await this.send({
      priority: 'low',
      category: 'savings',
      title: 'Sparmöjlighet',
      message: data.message,
      data,
      icon: '💰',
      actions: [
        { id: 'learn_more', label: 'Läs mer' },
        { id: 'dismiss', label: 'Avfärda' }
      ]
    });
  }

  // ============================================
  // HISTORY & ANALYTICS
  // ============================================

  addToHistory(notification) {
    this.history.push({
      ...notification,
      sentAt: Date.now()
    });

    // Trim history if too large
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }
  }

  getHistory(filters = {}) {
    let filtered = [...this.history];

    if (filters.category) {
      filtered = filtered.filter(n => n.category === filters.category);
    }

    if (filters.priority) {
      filtered = filtered.filter(n => n.priority === filters.priority);
    }

    if (filters.since) {
      filtered = filtered.filter(n => n.timestamp >= filters.since);
    }

    if (filters.until) {
      filtered = filtered.filter(n => n.timestamp <= filters.until);
    }

    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }

  getStatistics(period = 24 * 60 * 60 * 1000) {
    const since = Date.now() - period;
    const recent = this.history.filter(n => n.timestamp >= since);

    const byCategory = {};
    const byPriority = {};
    const byChannel = {};

    recent.forEach(n => {
      // By category
      byCategory[n.category] = (byCategory[n.category] || 0) + 1;
      
      // By priority
      byPriority[n.priority] = (byPriority[n.priority] || 0) + 1;
      
      // By channels
      n.channels.forEach(ch => {
        byChannel[ch] = (byChannel[ch] || 0) + 1;
      });
    });

    return {
      total: recent.length,
      byCategory,
      byPriority,
      byChannel,
      period: period / (60 * 60 * 1000) + ' hours'
    };
  }

  // ============================================
  // USER PREFERENCES
  // ============================================

  async loadPreferences() {
    // Load from storage
    this.userPreferences = {
      quietHoursStart: 22,
      quietHoursEnd: 7,
      enabledChannels: ['homey', 'dashboard', 'speech'],
      categorySettings: {
        energy: { enabled: true, minPriority: 'normal' },
        security: { enabled: true, minPriority: 'high' },
        comfort: { enabled: true, minPriority: 'low' },
        automation: { enabled: true, minPriority: 'normal' },
        device: { enabled: true, minPriority: 'high' },
        weather: { enabled: true, minPriority: 'normal' },
        savings: { enabled: true, minPriority: 'low' }
      }
    };
  }

  async updatePreferences(preferences) {
    this.userPreferences = {
      ...this.userPreferences,
      ...preferences
    };
    
    // Save to storage
    return this.userPreferences;
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  getDefaultIcon(category) {
    const icons = {
      energy: '⚡',
      security: '🔒',
      comfort: '🏡',
      automation: '🤖',
      device: '📱',
      weather: '🌤',
      savings: '💰',
      general: '🔔'
    };
    return icons[category] || icons.general;
  }

  getWeatherIcon(weatherType) {
    const icons = {
      rain: '🌧',
      snow: '❄️',
      storm: '⛈',
      wind: '💨',
      heat: '🔥',
      cold: '🥶',
      fog: '🌫'
    };
    return icons[weatherType] || '🌤';
  }

  // ============================================
  // PUBLIC API
  // ============================================

  async clearHistory() {
    this.history = [];
    return { cleared: true };
  }

  async getActiveNotifications() {
    const now = Date.now();
    return this.history.filter(n => 
      n.persistent && n.expiresAt > now
    );
  }

  async dismissNotification(notificationId) {
    const notification = this.history.find(n => n.id === notificationId);
    if (notification) {
      notification.dismissed = true;
      notification.dismissedAt = Date.now();
    }
    return { dismissed: true };
  }

  destroy() {
    if (this._intervals) {
      this._intervals.forEach(id => clearInterval(id));
      this._intervals = [];
    }
  }
}

module.exports = NotificationSystem;
