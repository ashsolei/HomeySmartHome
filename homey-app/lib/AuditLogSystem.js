'use strict';

/**
 * Audit Log System
 * Tracks all user actions and system events for auditing and compliance.
 * Keeps an in-memory circular buffer capped at _maxEntries records.
 */
class AuditLogSystem {
  /**
   * @param {import('homey').Homey} homey - Homey app instance
   */
  constructor(homey) {
    this.homey = homey;
    this._log = [];
    this._maxEntries = 10000;
  }

  /**
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      this.log('AuditLogSystem initialized');
    } catch (error) {
      this.homey.error(`[AuditLogSystem] Failed to initialize:`, error.message);
    }
  }

  /**
   * Record a new audit event.
   *
   * @param {string} action   - Action name, e.g. 'device.toggle', 'scene.activate'
   * @param {object} details  - Arbitrary additional fields (userId, deviceId, etc.)
   * @returns {object}        - The audit entry that was stored
   */
  record(action, details = {}) {
    const entry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      action,
      ...details,
    };
    this._log.push(entry);
    if (this._log.length > this._maxEntries) {
      this._log = this._log.slice(-this._maxEntries);
    }
    return entry;
  }

  /**
   * Return log entries in reverse-chronological order (newest first).
   *
   * @param {number} limit  - Maximum number of entries to return (default 100)
   * @param {number} offset - Number of entries to skip from the newest (default 0)
   * @returns {object[]}
   */
  getLog(limit = 100, offset = 0) {
    return this._log.slice().reverse().slice(offset, offset + limit);
  }

  /**
   * Return summary statistics about the audit log.
   *
   * @returns {{ total: number, last24h: number, actionCounts: object }}
   */
  getStats() {
    const now = Date.now();
    const last24h = this._log.filter(
      (e) => now - new Date(e.timestamp).getTime() < 86400000
    );
    const actions = {};
    for (const entry of last24h) {
      actions[entry.action] = (actions[entry.action] || 0) + 1;
    }
    return { total: this._log.length, last24h: last24h.length, actionCounts: actions };
  }

  destroy() {
    this._log = [];
  }

  log(...args) {
    if (this.homey && typeof this.homey.log === 'function') {
      this.homey.log('[AuditLogSystem]', ...args);
    } else {
      console.log('[AuditLogSystem]', ...args);
    }
  }
}

module.exports = AuditLogSystem;
