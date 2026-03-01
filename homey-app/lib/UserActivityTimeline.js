'use strict';

const crypto = require('crypto');

const MAX_EVENTS = 500;

class UserActivityTimeline {
  constructor(homey) {
    this.homey = homey;
    this.events = [];
    this._listeners = [];
  }

  async initialize() {
    this._subscribeToModules();
  }

  /**
   * Subscribe to events from existing modules on the homey EventEmitter.
   */
  _subscribeToModules() {
    const eventMap = [
      { event: 'security:alarm', type: 'security', severity: 'high', title: 'Security alarm triggered' },
      { event: 'security:mode', type: 'security', severity: 'info', title: 'Security mode changed' },
      { event: 'energy:update', type: 'energy', severity: 'info', title: 'Energy update' },
      { event: 'device:changed', type: 'device', severity: 'info', title: 'Device state changed' },
      { event: 'automation:triggered', type: 'automation', severity: 'info', title: 'Automation triggered' },
      { event: 'scene:activated', type: 'automation', severity: 'info', title: 'Scene activated' },
    ];

    for (const mapping of eventMap) {
      const handler = (data) => {
        this.addEvent({
          type: mapping.type,
          module: mapping.event.split(':')[0],
          title: mapping.title,
          description: typeof data === 'string' ? data : JSON.stringify(data || {}),
          severity: mapping.severity,
          metadata: typeof data === 'object' ? data : {},
        });
      };
      this.homey.on(mapping.event, handler);
      this._listeners.push({ event: mapping.event, handler });
    }
  }

  /**
   * Add a new event to the timeline. Maintains a circular buffer of MAX_EVENTS.
   */
  addEvent({ type, module, title, description, severity, metadata }) {
    const entry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: type || 'general',
      module: module || 'system',
      title: title || 'Event',
      description: description || '',
      severity: severity || 'info',
      metadata: metadata || {},
    };

    this.events.push(entry);

    // Circular buffer — drop oldest when exceeding max
    if (this.events.length > MAX_EVENTS) {
      this.events.shift();
    }

    // Emit for Socket.IO listeners
    this.homey.emit('timeline:event', entry);

    return entry;
  }

  /**
   * Get timeline events with optional filtering.
   * @param {object} opts
   * @param {number} [opts.limit=50] - Max events to return
   * @param {string} [opts.type] - Filter by event type
   * @param {string} [opts.since] - ISO 8601 timestamp lower bound
   * @returns {Array} Matching events, newest first
   */
  getEvents({ limit = 50, type, since } = {}) {
    let result = [...this.events];

    if (type) {
      result = result.filter(e => e.type === type);
    }

    if (since) {
      const sinceDate = new Date(since);
      if (!isNaN(sinceDate.getTime())) {
        result = result.filter(e => new Date(e.timestamp) >= sinceDate);
      }
    }

    // Return newest first, limited
    return result.reverse().slice(0, Math.max(1, limit));
  }

  /**
   * Get total event count.
   */
  getCount() {
    return this.events.length;
  }

  destroy() {
    for (const { event, handler } of this._listeners) {
      this.homey.removeListener(event, handler);
    }
    this._listeners = [];
    this.events = [];
  }
}

module.exports = UserActivityTimeline;
