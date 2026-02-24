'use strict';

/**
 * @typedef {1|2|3|4|5} PriorityLevel
 * INFO=1, LOW=2, NORMAL=3, HIGH=4, CRITICAL=5
 */

/**
 * @typedef {object} NotificationInput
 * @property {string} [title] - Short notification title
 * @property {string} [message] - Full notification message
 * @property {string} [category='general'] - Category (e.g. 'security', 'energy', 'device')
 * @property {string} [source='system'] - Originating module/source
 * @property {PriorityLevel} [priority] - Override priority (auto-detected if omitted)
 * @property {string} [deviceId] - Related device identifier
 * @property {string} [zoneId] - Related zone identifier
 */

/**
 * @typedef {object} NotificationRule
 * @property {string} id - Unique rule identifier
 * @property {string} name - Human-readable rule name
 * @property {{category?: string, keywords?: string[], deviceId?: string, zoneId?: string}} conditions - Match conditions
 * @property {PriorityLevel} priority - Resulting priority if rule matches
 * @property {string[]} channels - Forced delivery channels (e.g. ['push', 'speech'])
 * @property {boolean} [ignoreDND=false] - Ignore Do Not Disturb if true
 * @property {boolean} [allowGrouping=true] - Allow grouping with similar notifications
 * @property {boolean} [canDelay=false] - Whether delivery can be deferred
 * @property {boolean} [enabled=true] - Whether the rule is active
 * @property {number} [created] - Creation timestamp (ms)
 */

/**
 * Advanced Notification Manager.
 *
 * Provides intelligent notification routing with priority determination,
 * rule-based channel selection, smart delivery (DND / quiet hours / presence /
 * notification-fatigue awareness), grouping of similar notifications, and a
 * deferred queue for notifications that should not be delivered immediately.
 */
class AdvancedNotificationManager {
  /**
   * @param {import('homey').Homey} homey - Homey app instance
   */
  constructor(homey) {
    this.homey = homey;
    this.notificationQueue = [];
    this.deliveredNotifications = [];
    this.notificationRules = new Map();
    this.userPreferences = {};
    this.doNotDisturbSchedules = [];
    this.priorityLevels = {
      CRITICAL: 5,
      HIGH: 4,
      NORMAL: 3,
      LOW: 2,
      INFO: 1
    };
  }

  /**
   * Load persisted preferences, rules, and notification history, then start
   * the queue-processor interval and register default rules.
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    this.log('Initializing Advanced Notification Manager...');
    
    // Load configuration
    this.userPreferences = await this.homey.settings.get('notificationPreferences') || this.getDefaultPreferences();
    this.doNotDisturbSchedules = await this.homey.settings.get('dndSchedules') || [];
    
    const savedRules = await this.homey.settings.get('notificationRules') || {};
    Object.entries(savedRules).forEach(([id, rule]) => {
      this.notificationRules.set(id, rule);
    });

    // Load notification history
    this.deliveredNotifications = await this.homey.settings.get('notificationHistory') || [];

    // Start notification processor
    this.startNotificationProcessor();
    
    // Setup default rules
    await this.setupDefaultRules();
    
    this.log('Advanced Notification Manager initialized');
  }

  /**
   * Get default notification preferences
   */
  getDefaultPreferences() {
    return {
      channels: {
        push: { enabled: true, priority: this.priorityLevels.NORMAL },
        email: { enabled: false, priority: this.priorityLevels.HIGH },
        sms: { enabled: false, priority: this.priorityLevels.CRITICAL },
        speech: { enabled: true, priority: this.priorityLevels.HIGH },
        visual: { enabled: true, priority: this.priorityLevels.NORMAL }
      },
      grouping: {
        enabled: true,
        window: 300000, // 5 minutes
        maxPerGroup: 5
      },
      quietHours: {
        enabled: true,
        start: '22:00',
        end: '07:00',
        allowCritical: true
      },
      smartDelivery: {
        enabled: true,
        considerPresence: true,
        considerActivity: true,
        delayNonUrgent: true
      }
    };
  }

  /**
   * Setup default notification rules
   */
  async setupDefaultRules() {
    // Security alerts - always critical
    await this.createRule({
      id: 'security_critical',
      name: 'Security Alerts',
      conditions: {
        category: 'security',
        keywords: ['alarm', 'intrång', 'intrusion', 'motion detected']
      },
      priority: this.priorityLevels.CRITICAL,
      channels: ['push', 'speech', 'sms'],
      ignoreDND: true
    });

    // Energy alerts - high priority
    await this.createRule({
      id: 'energy_high',
      name: 'Energy Warnings',
      conditions: {
        category: 'energy',
        keywords: ['hög förbrukning', 'high consumption', 'överskridande', 'exceeded']
      },
      priority: this.priorityLevels.HIGH,
      channels: ['push'],
      allowGrouping: true
    });

    // Device errors - high priority
    await this.createRule({
      id: 'device_error',
      name: 'Device Errors',
      conditions: {
        category: 'device',
        keywords: ['fel', 'error', 'offline', 'failed']
      },
      priority: this.priorityLevels.HIGH,
      channels: ['push'],
      allowGrouping: false
    });

    // Information - low priority
    await this.createRule({
      id: 'info_low',
      name: 'Information',
      conditions: {
        category: 'info'
      },
      priority: this.priorityLevels.LOW,
      channels: ['push'],
      allowGrouping: true,
      canDelay: true
    });
  }

  /**
   * Main entry point for sending a notification.  Enriches the notification
   * with metadata, determines priority, applies rules, and either delivers
   * immediately or queues for later.
   *
   * @param {NotificationInput} notification - Notification to send
   * @returns {Promise<{success: boolean, notificationId: string, delivered: boolean, queued: boolean}>}
   */
  async send(notification) {
    // Enrich notification
    const enriched = await this.enrichNotification(notification);
    
    // Determine priority
    enriched.priority = await this.determinePriority(enriched);
    
    // Apply rules
    enriched.rules = await this.applyRules(enriched);
    
    // Check if should be delivered now
    const shouldDeliver = await this.shouldDeliverNow(enriched);
    
    if (shouldDeliver) {
      await this.deliverNotification(enriched);
    } else {
      // Queue for later delivery
      this.notificationQueue.push(enriched);
      await this.saveQueue();
    }

    return { 
      success: true, 
      notificationId: enriched.id,
      delivered: shouldDeliver,
      queued: !shouldDeliver
    };
  }

  /**
   * Enrich notification with metadata
   */
  async enrichNotification(notification) {
    return {
      id: this.generateNotificationId(),
      timestamp: Date.now(),
      ...notification,
      metadata: {
        source: notification.source || 'system',
        category: notification.category || 'general',
        deviceId: notification.deviceId,
        zoneId: notification.zoneId
      },
      context: await this.getContext()
    };
  }

  /**
   * Get current context for smart decisions
   */
  async getContext() {
    const now = new Date();
    
    let presence = 'unknown';
    try {
      const presenceStatus = await this.homey.app.presenceManager?.getStatus();
      presence = presenceStatus?.status || 'unknown';
    } catch (error) {
      // Presence manager not available
    }

    return {
      hour: now.getHours(),
      dayOfWeek: now.getDay(),
      presence,
      isQuietHours: this.isQuietHours(),
      activeNotifications: this.getActiveNotificationCount()
    };
  }

  /**
   * Determine notification priority
   */
  async determinePriority(notification) {
    // Use explicit priority if provided
    if (notification.priority) {
      return notification.priority;
    }

    // Check rules for priority
    for (const [id, rule] of this.notificationRules) {
      if (this.matchesRule(notification, rule)) {
        return rule.priority;
      }
    }

    // Analyze content for urgency keywords
    const urgencyScore = this.analyzeUrgency(notification);
    
    if (urgencyScore >= 0.8) return this.priorityLevels.CRITICAL;
    if (urgencyScore >= 0.6) return this.priorityLevels.HIGH;
    if (urgencyScore >= 0.4) return this.priorityLevels.NORMAL;
    if (urgencyScore >= 0.2) return this.priorityLevels.LOW;
    return this.priorityLevels.INFO;
  }

  /**
   * Analyse notification title and message for urgency keywords and return a
   * normalised urgency score in [0, 1].
   *
   * @param {object} notification - Partially enriched notification
   * @returns {number} Urgency score (0 = none, 1 = critical)
   */
  analyzeUrgency(notification) {
    const content = `${notification.title || ''} ${notification.message || ''}`.toLowerCase();
    
    const criticalWords = ['alarm', 'kritisk', 'critical', 'nöd', 'emergency', 'brand', 'fire', 'intrång'];
    const highWords = ['varning', 'warning', 'fel', 'error', 'problem', 'failed'];
    const normalWords = ['uppdatering', 'update', 'ändring', 'change', 'complete'];
    
    if (criticalWords.some(word => content.includes(word))) return 1.0;
    if (highWords.some(word => content.includes(word))) return 0.7;
    if (normalWords.some(word => content.includes(word))) return 0.5;
    
    return 0.3;
  }

  /**
   * Apply notification rules
   */
  async applyRules(notification) {
    const appliedRules = [];
    
    for (const [id, rule] of this.notificationRules) {
      if (this.matchesRule(notification, rule)) {
        appliedRules.push({
          ruleId: id,
          ruleName: rule.name,
          actions: rule
        });
      }
    }

    return appliedRules;
  }

  /**
   * Check if notification matches rule conditions
   */
  matchesRule(notification, rule) {
    const conditions = rule.conditions;
    
    // Check category
    if (conditions.category && notification.metadata.category !== conditions.category) {
      return false;
    }

    // Check keywords
    if (conditions.keywords && conditions.keywords.length > 0) {
      const content = `${notification.title || ''} ${notification.message || ''}`.toLowerCase();
      const hasKeyword = conditions.keywords.some(keyword => 
        content.includes(keyword.toLowerCase())
      );
      if (!hasKeyword) return false;
    }

    // Check device
    if (conditions.deviceId && notification.metadata.deviceId !== conditions.deviceId) {
      return false;
    }

    // Check zone
    if (conditions.zoneId && notification.metadata.zoneId !== conditions.zoneId) {
      return false;
    }

    return true;
  }

  /**
   * Check if notification should be delivered now
   */
  async shouldDeliverNow(notification) {
    // Critical always delivers
    if (notification.priority >= this.priorityLevels.CRITICAL) {
      return true;
    }

    // Check Do Not Disturb
    if (this.isDoNotDisturb() && notification.priority < this.priorityLevels.HIGH) {
      return false;
    }

    // Check quiet hours
    if (this.isQuietHours() && 
        !this.userPreferences.quietHours.allowCritical &&
        notification.priority < this.priorityLevels.CRITICAL) {
      return false;
    }

    // Smart delivery - delay non-urgent when user is away
    if (this.userPreferences.smartDelivery.enabled &&
        this.userPreferences.smartDelivery.delayNonUrgent &&
        notification.context.presence === 'away' &&
        notification.priority < this.priorityLevels.HIGH) {
      return false;
    }

    // Check notification fatigue (too many recent notifications)
    if (this.hasNotificationFatigue() && notification.priority < this.priorityLevels.HIGH) {
      return false;
    }

    return true;
  }

  /**
   * Deliver notification through appropriate channels
   */
  async deliverNotification(notification) {
    const channels = this.selectChannels(notification);
    const deliveryResults = {};

    // Group similar notifications if enabled
    if (this.shouldGroup(notification)) {
      notification = await this.groupNotification(notification);
    }

    // Deliver through each channel
    for (const channel of channels) {
      try {
        deliveryResults[channel] = await this.deliverToChannel(notification, channel);
      } catch (error) {
        this.error(`Failed to deliver to ${channel}:`, error);
        deliveryResults[channel] = { success: false, error: error.message };
      }
    }

    // Record delivery
    this.deliveredNotifications.push({
      ...notification,
      deliveryResults,
      deliveredAt: Date.now()
    });

    // Keep only last 1000 notifications
    if (this.deliveredNotifications.length > 1000) {
      this.deliveredNotifications = this.deliveredNotifications.slice(-1000);
    }

    await this.saveHistory();

    // Trigger flow card
    await this.triggerNotificationFlow(notification);

    return deliveryResults;
  }

  /**
   * Select which delivery channels to use for a notification, respecting
   * matching rule overrides and per-channel priority thresholds.
   *
   * @param {object} notification - Enriched notification with `rules` and `priority`
   * @returns {string[]} Array of channel names (e.g. ['push', 'speech'])
   */
  selectChannels(notification) {
    const channels = [];
    const prefs = this.userPreferences.channels;

    // Check rules first
    if (notification.rules && notification.rules.length > 0) {
      const ruleChannels = notification.rules[0].actions.channels;
      if (ruleChannels) {
        return ruleChannels;
      }
    }

    // Use preferences based on priority
    for (const [channel, config] of Object.entries(prefs)) {
      if (config.enabled && notification.priority >= config.priority) {
        channels.push(channel);
      }
    }

    // At least push notification for everything
    if (channels.length === 0) {
      channels.push('push');
    }

    return channels;
  }

  /**
   * Deliver notification to specific channel
   */
  async deliverToChannel(notification, channel) {
    switch (channel) {
      case 'push':
        return await this.deliverPush(notification);
      
      case 'email':
        return await this.deliverEmail(notification);
      
      case 'sms':
        return await this.deliverSMS(notification);
      
      case 'speech':
        return await this.deliverSpeech(notification);
      
      case 'visual':
        return await this.deliverVisual(notification);
      
      default:
        throw new Error(`Unknown channel: ${channel}`);
    }
  }

  /**
   * Deliver push notification
   */
  async deliverPush(notification) {
    await this.homey.notifications.createNotification({
      excerpt: notification.title || notification.message
    });

    return { success: true, channel: 'push' };
  }

  /**
   * Deliver email notification (placeholder)
   */
  async deliverEmail(notification) {
    // Would integrate with email service
    this.log('Email delivery:', notification.title);
    return { success: true, channel: 'email', note: 'Email integration not configured' };
  }

  /**
   * Deliver SMS notification (placeholder)
   */
  async deliverSMS(notification) {
    // Would integrate with SMS service
    this.log('SMS delivery:', notification.title);
    return { success: true, channel: 'sms', note: 'SMS integration not configured' };
  }

  /**
   * Deliver speech notification
   */
  async deliverSpeech(notification) {
    try {
      const message = notification.message || notification.title;
      await this.homey.speechOutput.say(message);
      return { success: true, channel: 'speech' };
    } catch (error) {
      return { success: false, channel: 'speech', error: error.message };
    }
  }

  /**
   * Deliver visual notification (LED, display, etc.)
   */
  async deliverVisual(notification) {
    // Would trigger LED indicators or display messages
    this.log('Visual delivery:', notification.title);
    return { success: true, channel: 'visual', note: 'Visual delivery simulated' };
  }

  /**
   * Check if notification should be grouped
   */
  shouldGroup(notification) {
    if (!this.userPreferences.grouping.enabled) {
      return false;
    }

    // Don't group critical
    if (notification.priority >= this.priorityLevels.CRITICAL) {
      return false;
    }

    // Check rules
    if (notification.rules && notification.rules.length > 0) {
      if (notification.rules[0].actions.allowGrouping === false) {
        return false;
      }
    }

    return true;
  }

  /**
   * Group similar notifications
   */
  async groupNotification(notification) {
    const groupWindow = this.userPreferences.grouping.window;
    const now = Date.now();

    // Find similar recent notifications
    const similar = this.deliveredNotifications.filter(n => 
      now - n.deliveredAt < groupWindow &&
      n.metadata.category === notification.metadata.category &&
      n.metadata.source === notification.metadata.source
    );

    if (similar.length > 0) {
      // Create grouped notification
      notification.isGrouped = true;
      notification.groupCount = similar.length + 1;
      notification.title = `${notification.metadata.category} (${notification.groupCount})`;
      notification.message = `${notification.groupCount} nya händelser`;
    }

    return notification;
  }

  /**
   * Start notification processor for queued notifications
   */
  startNotificationProcessor() {
    this.processorInterval = setInterval(async () => {
      await this.processQueue();
    }, 60000); // Every minute
  }

  /**
   * Process queued notifications
   */
  async processQueue() {
    if (this.notificationQueue.length === 0) return;

    const now = Date.now();
    const toDeliver = [];

    // Check each queued notification
    for (let i = this.notificationQueue.length - 1; i >= 0; i--) {
      const notification = this.notificationQueue[i];
      
      // Re-evaluate if should deliver now
      notification.context = await this.getContext();
      const shouldDeliver = await this.shouldDeliverNow(notification);
      
      if (shouldDeliver) {
        toDeliver.push(notification);
        this.notificationQueue.splice(i, 1);
      }
      
      // Remove if too old (24 hours)
      if (now - notification.timestamp > 86400000) {
        this.notificationQueue.splice(i, 1);
      }
    }

    // Deliver queued notifications
    for (const notification of toDeliver) {
      await this.deliverNotification(notification);
    }

    if (toDeliver.length > 0) {
      await this.saveQueue();
    }
  }

  /**
   * Create notification rule
   */
  async createRule(rule) {
    const ruleId = rule.id || this.generateRuleId();
    rule.id = ruleId;
    rule.created = Date.now();
    rule.enabled = rule.enabled !== false;

    this.notificationRules.set(ruleId, rule);
    await this.saveRules();

    return rule;
  }

  /**
   * Update notification rule
   */
  async updateRule(ruleId, updates) {
    const rule = this.notificationRules.get(ruleId);
    if (!rule) {
      throw new Error('Rule not found');
    }

    Object.assign(rule, updates);
    await this.saveRules();

    return rule;
  }

  /**
   * Delete notification rule
   */
  async deleteRule(ruleId) {
    const deleted = this.notificationRules.delete(ruleId);
    if (deleted) {
      await this.saveRules();
    }
    return deleted;
  }

  /**
   * Set Do Not Disturb schedule
   */
  async setDNDSchedule(schedule) {
    this.doNotDisturbSchedules.push({
      ...schedule,
      id: this.generateScheduleId(),
      created: Date.now()
    });

    await this.homey.settings.set('dndSchedules', this.doNotDisturbSchedules);
  }

  /**
   * Check if currently in Do Not Disturb
   */
  isDoNotDisturb() {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const currentDay = now.getDay();

    for (const schedule of this.doNotDisturbSchedules) {
      if (!schedule.enabled) continue;

      // Check day
      if (schedule.days && !schedule.days.includes(currentDay)) continue;

      // Check time
      const startTime = this.parseTime(schedule.start);
      const endTime = this.parseTime(schedule.end);

      if (this.isTimeBetween(currentTime, startTime, endTime)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if in quiet hours
   */
  isQuietHours() {
    if (!this.userPreferences.quietHours.enabled) return false;

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const start = this.parseTime(this.userPreferences.quietHours.start);
    const end = this.parseTime(this.userPreferences.quietHours.end);

    return this.isTimeBetween(currentTime, start, end);
  }

  /**
   * Check for notification fatigue
   */
  hasNotificationFatigue() {
    const recentWindow = 600000; // 10 minutes
    const now = Date.now();
    
    const recentCount = this.deliveredNotifications.filter(
      n => now - n.deliveredAt < recentWindow
    ).length;

    return recentCount > 10; // More than 10 notifications in 10 minutes
  }

  /**
   * Get active notification count
   */
  getActiveNotificationCount() {
    const recentWindow = 3600000; // 1 hour
    const now = Date.now();
    
    return this.deliveredNotifications.filter(
      n => now - n.deliveredAt < recentWindow
    ).length;
  }

  /**
   * Get notification statistics
   */
  async getStatistics() {
    const now = Date.now();
    const dayAgo = now - 86400000;
    const weekAgo = now - (7 * 86400000);

    const dayNotifications = this.deliveredNotifications.filter(n => n.deliveredAt > dayAgo);
    const weekNotifications = this.deliveredNotifications.filter(n => n.deliveredAt > weekAgo);

    return {
      total: this.deliveredNotifications.length,
      today: dayNotifications.length,
      thisWeek: weekNotifications.length,
      queued: this.notificationQueue.length,
      byPriority: this.groupByPriority(dayNotifications),
      byCategory: this.groupByCategory(dayNotifications),
      byChannel: this.groupByChannel(dayNotifications)
    };
  }

  groupByPriority(notifications) {
    const groups = {};
    for (const n of notifications) {
      const priority = n.priority || this.priorityLevels.NORMAL;
      groups[priority] = (groups[priority] || 0) + 1;
    }
    return groups;
  }

  groupByCategory(notifications) {
    const groups = {};
    for (const n of notifications) {
      const category = n.metadata?.category || 'unknown';
      groups[category] = (groups[category] || 0) + 1;
    }
    return groups;
  }

  groupByChannel(notifications) {
    const groups = {};
    for (const n of notifications) {
      if (n.deliveryResults) {
        for (const channel of Object.keys(n.deliveryResults)) {
          groups[channel] = (groups[channel] || 0) + 1;
        }
      }
    }
    return groups;
  }

  /**
   * Trigger notification flow card
   */
  async triggerNotificationFlow(notification) {
    try {
      const trigger = this.homey.flow.getTriggerCard('advanced_notification_received');
      if (trigger) {
        await trigger.trigger({
          priority: notification.priority,
          category: notification.metadata.category,
          message: notification.message
        });
      }
    } catch (error) {
      // Flow card might not exist
    }
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  parseTime(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  isTimeBetween(current, start, end) {
    if (start <= end) {
      return current >= start && current <= end;
    } else {
      // Spans midnight
      return current >= start || current <= end;
    }
  }

  generateNotificationId() {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateRuleId() {
    return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateScheduleId() {
    return `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async saveRules() {
    const data = {};
    this.notificationRules.forEach((rule, id) => {
      data[id] = rule;
    });
    await this.homey.settings.set('notificationRules', data);
  }

  async saveQueue() {
    await this.homey.settings.set('notificationQueue', this.notificationQueue);
  }

  async saveHistory() {
    await this.homey.settings.set('notificationHistory', this.deliveredNotifications.slice(-1000));
  }

  log(...args) {
    console.log('[AdvancedNotificationManager]', ...args);
  }

  error(...args) {
    console.error('[AdvancedNotificationManager]', ...args);
  }
}

module.exports = AdvancedNotificationManager;
