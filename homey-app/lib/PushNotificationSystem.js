'use strict';

const EventEmitter = require('events');

/**
 * PushNotificationSystem — FEAT-17
 *
 * Real-time Web Push notifications using the VAPID protocol.
 * When the `web-push` npm package is not available, operates as a
 * lightweight stub that logs what it would send.
 */
class PushNotificationSystem {
  constructor(homey) {
    this.homey = homey;
    this.events = new EventEmitter();

    // VAPID configuration from environment variables
    this.vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
    this.vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
    this.vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@smarthomepro.local';

    // Subscription storage: Map<endpoint, { subscription, userId, createdAt }>
    this.subscriptions = new Map();

    // Track sent notifications for diagnostics
    this.sentCount = 0;
    this.failedCount = 0;
    this.lastSent = null;

    // Will be set during initialize if web-push is available
    this.webPush = null;
    this.stubMode = true;

    this._listeners = [];
  }

  async initialize() {
    this._log('Initializing PushNotificationSystem...');

    // Attempt to load web-push
    try {
      this.webPush = require('web-push');
      this.stubMode = false;
      this._log('web-push loaded successfully');
    } catch (_) {
      this.stubMode = true;
      this._log('web-push not available — running in stub mode (logs only)');
    }

    // Configure VAPID details if keys are available
    if (!this.stubMode && this.vapidPublicKey && this.vapidPrivateKey) {
      try {
        this.webPush.setVapidDetails(
          this.vapidSubject,
          this.vapidPublicKey,
          this.vapidPrivateKey
        );
        this._log('VAPID details configured');
      } catch (err) {
        this._error('Failed to set VAPID details:', err.message);
        this.stubMode = true;
      }
    } else if (!this.stubMode) {
      this._log('VAPID keys not set — running in stub mode. Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT env vars.');
      this.stubMode = true;
    }

    // Listen to system events for automatic push notifications
    this._registerEventListeners();

    this._log('PushNotificationSystem initialized (stub=' + this.stubMode + ')');
  }

  // ── Subscription management ──────────────────────────────────────

  /**
   * Store a push subscription object from a client.
   * @param {{ endpoint: string, keys: { p256dh: string, auth: string } }} subscription
   * @param {string} [userId='anonymous']
   * @returns {{ success: boolean, endpoint: string }}
   */
  subscribe(subscription, userId = 'anonymous') {
    if (!subscription || !subscription.endpoint) {
      throw new Error('Invalid subscription: endpoint is required');
    }

    this.subscriptions.set(subscription.endpoint, {
      subscription,
      userId,
      createdAt: Date.now(),
    });

    this._log(`Subscription added for user ${userId} (total: ${this.subscriptions.size})`);
    this.events.emit('subscribed', { endpoint: subscription.endpoint, userId });

    return { success: true, endpoint: subscription.endpoint };
  }

  /**
   * Remove a push subscription by endpoint.
   * @param {string} endpoint
   * @returns {{ success: boolean }}
   */
  unsubscribe(endpoint) {
    const deleted = this.subscriptions.delete(endpoint);
    if (deleted) {
      this._log(`Subscription removed (total: ${this.subscriptions.size})`);
    }
    this.events.emit('unsubscribed', { endpoint, found: deleted });
    return { success: deleted };
  }

  /**
   * Get all active subscriptions (for diagnostics).
   * @returns {Array<{ endpoint: string, userId: string, createdAt: number }>}
   */
  getSubscriptions() {
    return Array.from(this.subscriptions.values()).map(s => ({
      endpoint: s.subscription.endpoint,
      userId: s.userId,
      createdAt: s.createdAt,
    }));
  }

  // ── Sending notifications ────────────────────────────────────────

  /**
   * Send a push notification to all subscribers.
   * @param {string} title
   * @param {string} body
   * @param {string} [icon]
   * @param {object} [data]
   * @returns {Promise<{ sent: number, failed: number }>}
   */
  async sendNotification(title, body, icon, data) {
    const payload = JSON.stringify({
      title,
      body,
      icon: icon || '/icons/notification.png',
      data: data || {},
      timestamp: Date.now(),
    });

    let sent = 0;
    let failed = 0;

    for (const [endpoint, entry] of this.subscriptions) {
      try {
        await this._sendPush(entry.subscription, payload);
        sent++;
      } catch (err) {
        failed++;
        this._error(`Push failed for ${endpoint}:`, err.message);
        // Remove expired/invalid subscriptions (410 Gone)
        if (err.statusCode === 410 || err.statusCode === 404) {
          this.subscriptions.delete(endpoint);
          this._log(`Removed stale subscription: ${endpoint}`);
        }
      }
    }

    this.sentCount += sent;
    this.failedCount += failed;
    this.lastSent = Date.now();

    this.events.emit('notificationSent', { title, sent, failed });

    return { sent, failed };
  }

  /**
   * Send a push notification to a specific user's subscriptions.
   * @param {string} userId
   * @param {string} title
   * @param {string} body
   * @param {object} [data]
   * @returns {Promise<{ sent: number, failed: number }>}
   */
  async sendToUser(userId, title, body, data) {
    const payload = JSON.stringify({
      title,
      body,
      icon: '/icons/notification.png',
      data: data || {},
      timestamp: Date.now(),
    });

    let sent = 0;
    let failed = 0;

    for (const [endpoint, entry] of this.subscriptions) {
      if (entry.userId !== userId) continue;

      try {
        await this._sendPush(entry.subscription, payload);
        sent++;
      } catch (err) {
        failed++;
        this._error(`Push failed for user ${userId} at ${endpoint}:`, err.message);
        if (err.statusCode === 410 || err.statusCode === 404) {
          this.subscriptions.delete(endpoint);
        }
      }
    }

    this.sentCount += sent;
    this.failedCount += failed;
    this.lastSent = Date.now();

    return { sent, failed };
  }

  // ── Event listener integration ───────────────────────────────────

  _registerEventListeners() {
    const homey = this.homey;

    // Security alerts
    const securityHandler = (data) => {
      this.sendNotification(
        'Security Alert',
        data.message || 'A security event was detected',
        '/icons/security.png',
        { type: 'security', ...data }
      );
    };

    // Energy anomalies
    const energyHandler = (data) => {
      this.sendNotification(
        'Energy Anomaly',
        data.message || 'Unusual energy usage detected',
        '/icons/energy.png',
        { type: 'energy', ...data }
      );
    };

    // Emergency events
    const emergencyHandler = (data) => {
      this.sendNotification(
        'Emergency',
        data.message || 'An emergency condition was detected',
        '/icons/emergency.png',
        { type: 'emergency', priority: 'high', ...data }
      );
    };

    if (homey.on) {
      homey.on('security:alert', securityHandler);
      homey.on('energy:anomaly', energyHandler);
      homey.on('emergency:detected', emergencyHandler);

      this._listeners.push(
        { event: 'security:alert', handler: securityHandler },
        { event: 'energy:anomaly', handler: energyHandler },
        { event: 'emergency:detected', handler: emergencyHandler }
      );
    }
  }

  // ── Internal ─────────────────────────────────────────────────────

  async _sendPush(subscription, payload) {
    if (this.stubMode) {
      this._log(`[STUB] Would send push to ${subscription.endpoint}: ${payload}`);
      return;
    }
    return this.webPush.sendNotification(subscription, payload);
  }

  /**
   * Get system statistics.
   */
  getStatistics() {
    return {
      stubMode: this.stubMode,
      subscriptionCount: this.subscriptions.size,
      sentCount: this.sentCount,
      failedCount: this.failedCount,
      lastSent: this.lastSent,
      vapidConfigured: !!(this.vapidPublicKey && this.vapidPrivateKey),
    };
  }

  destroy() {
    // Remove event listeners
    if (this.homey && this.homey.removeListener) {
      for (const { event, handler } of this._listeners) {
        this.homey.removeListener(event, handler);
      }
    }
    this._listeners = [];
    this.subscriptions.clear();
    this.events.removeAllListeners();
  }

  _log(...args) {
    if (this.homey && this.homey.log) {
      this.homey.log('[PushNotificationSystem]', ...args);
    }
  }

  _error(...args) {
    if (this.homey && this.homey.error) {
      this.homey.error('[PushNotificationSystem]', ...args);
    }
  }
}

module.exports = PushNotificationSystem;
