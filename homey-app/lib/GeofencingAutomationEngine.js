'use strict';

const EventEmitter = require('events');

/**
 * GeofencingAutomationEngine — FEAT-20
 *
 * Automation trigger pipeline that listens to GeofencingEngine events
 * (arrive, depart) and executes configurable rules with actions like
 * setDeviceState, triggerScene, sendNotification, and setHVAC.
 */
class GeofencingAutomationEngine {
  constructor(homey) {
    this.homey = homey;
    this.events = new EventEmitter();

    // Rules storage: Map<id, rule>
    this.rules = new Map();

    // Built-in preset definitions
    this.presets = {
      arriveHome: {
        id: 'preset_arrive_home',
        name: 'Arrive Home',
        trigger: 'arrive',
        zone: 'home',
        enabled: true,
        actions: [
          { type: 'setDeviceState', deviceId: 'security_panel', capability: 'alarm_armed', value: false },
          { type: 'triggerScene', sceneId: 'welcome_home' },
          { type: 'setHVAC', mode: 'comfort', temperature: 22 },
          { type: 'sendNotification', message: 'Welcome home! Security disarmed, lights on.' },
        ],
      },
      leaveHome: {
        id: 'preset_leave_home',
        name: 'Leave Home',
        trigger: 'depart',
        zone: 'home',
        enabled: true,
        actions: [
          { type: 'setDeviceState', deviceId: 'security_panel', capability: 'alarm_armed', value: true },
          { type: 'triggerScene', sceneId: 'goodbye' },
          { type: 'setHVAC', mode: 'eco', temperature: 18 },
          { type: 'sendNotification', message: 'Goodbye! Security armed, eco mode activated.' },
        ],
      },
    };

    // Execution history for diagnostics
    this.executionHistory = [];
    this.maxHistorySize = 100;

    this._listeners = [];
  }

  async initialize() {
    this._log('Initializing GeofencingAutomationEngine...');

    // Install default presets
    for (const preset of Object.values(this.presets)) {
      if (!this.rules.has(preset.id)) {
        this.rules.set(preset.id, { ...preset, preset: true, createdAt: Date.now() });
      }
    }

    // Listen to GeofencingEngine events if available
    this._registerGeofenceListeners();

    this._log(`GeofencingAutomationEngine initialized with ${this.rules.size} rules`);
  }

  // ── Rule management ──────────────────────────────────────────────

  /**
   * Add a new automation rule.
   * @param {{ trigger: 'arrive'|'depart', zone: string, actions: Array, name?: string, enabled?: boolean, conditions?: Array }} rule
   * @returns {{ success: boolean, rule: object }}
   */
  addRule(rule) {
    if (!rule.trigger || !rule.zone || !Array.isArray(rule.actions)) {
      throw new Error('Rule must have trigger, zone, and actions array');
    }

    const id = rule.id || `rule_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const newRule = {
      id,
      name: rule.name || `${rule.trigger} at ${rule.zone}`,
      trigger: rule.trigger,
      zone: rule.zone,
      actions: rule.actions,
      conditions: rule.conditions || [],
      enabled: rule.enabled !== false,
      preset: false,
      createdAt: Date.now(),
    };

    this.rules.set(id, newRule);
    this.events.emit('ruleAdded', newRule);
    this._log(`Rule added: ${newRule.name} (${id})`);

    return { success: true, rule: newRule };
  }

  /**
   * Remove a rule by id.
   * @param {string} id
   * @returns {{ success: boolean }}
   */
  removeRule(id) {
    const deleted = this.rules.delete(id);
    if (deleted) {
      this.events.emit('ruleRemoved', { id });
      this._log(`Rule removed: ${id}`);
    }
    return { success: deleted };
  }

  /**
   * List all rules.
   * @returns {Array<object>}
   */
  listRules() {
    return Array.from(this.rules.values());
  }

  /**
   * Get a single rule by id.
   * @param {string} id
   * @returns {object|null}
   */
  getRule(id) {
    return this.rules.get(id) || null;
  }

  // ── Event processing ─────────────────────────────────────────────

  /**
   * Process a geofencing event and execute matching rules.
   * @param {{ type: 'arrive'|'depart', zone: string, userId?: string, timestamp?: number }} event
   * @returns {Promise<{ matched: number, executed: number, errors: number }>}
   */
  async processEvent(event) {
    if (!event || !event.type || !event.zone) {
      throw new Error('Event must have type and zone');
    }

    this._log(`Processing event: ${event.type} at ${event.zone} (user: ${event.userId || 'unknown'})`);

    let matched = 0;
    let executed = 0;
    let errors = 0;

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;
      if (rule.trigger !== event.type) continue;
      if (rule.zone !== event.zone && rule.zone !== '*') continue;

      // Check optional conditions
      if (rule.conditions && rule.conditions.length > 0) {
        const conditionsMet = await this._evaluateConditions(rule.conditions, event);
        if (!conditionsMet) continue;
      }

      matched++;

      try {
        await this._executeActions(rule.actions, event);
        executed++;

        this._recordExecution(rule, event, 'success');
        this.events.emit('ruleExecuted', { ruleId: rule.id, event });
      } catch (err) {
        errors++;
        this._error(`Error executing rule ${rule.id}:`, err.message);
        this._recordExecution(rule, event, 'error', err.message);
      }
    }

    this._log(`Event processed: ${matched} matched, ${executed} executed, ${errors} errors`);

    return { matched, executed, errors };
  }

  // ── Action execution ─────────────────────────────────────────────

  async _executeActions(actions, event) {
    for (const action of actions) {
      await this._executeAction(action, event);
    }
  }

  async _executeAction(action, event) {
    switch (action.type) {
      case 'setDeviceState':
        await this._actionSetDeviceState(action);
        break;
      case 'triggerScene':
        await this._actionTriggerScene(action);
        break;
      case 'sendNotification':
        await this._actionSendNotification(action, event);
        break;
      case 'setHVAC':
        await this._actionSetHVAC(action);
        break;
      default:
        this._log(`Unknown action type: ${action.type}`);
    }
  }

  async _actionSetDeviceState(action) {
    try {
      if (this.homey.app && this.homey.app.deviceManager) {
        const device = await this.homey.app.deviceManager.getDevice(action.deviceId);
        if (device && device.setCapabilityValue) {
          await device.setCapabilityValue(action.capability, action.value);
        }
      }
    } catch (err) {
      this._log(`setDeviceState: ${action.deviceId}.${action.capability}=${action.value} (simulated: ${err.message})`);
    }
  }

  async _actionTriggerScene(action) {
    try {
      if (this.homey.app && this.homey.app.sceneManager) {
        await this.homey.app.sceneManager.activateScene(action.sceneId);
      }
    } catch (err) {
      this._log(`triggerScene: ${action.sceneId} (simulated: ${err.message})`);
    }
  }

  async _actionSendNotification(action, event) {
    const message = (action.message || '')
      .replace('{zone}', event.zone || '')
      .replace('{user}', event.userId || 'someone');

    try {
      // Prefer PushNotificationSystem if available
      if (this.homey.app && this.homey.app.pushNotificationSystem) {
        await this.homey.app.pushNotificationSystem.sendNotification(
          'Geofencing',
          message,
          '/icons/geofence.png',
          { type: 'geofence', event: event.type, zone: event.zone }
        );
      } else if (this.homey.notifications) {
        await this.homey.notifications.createNotification({ excerpt: message });
      }
    } catch (err) {
      this._log(`sendNotification: ${message} (simulated: ${err.message})`);
    }
  }

  async _actionSetHVAC(action) {
    try {
      if (this.homey.app && this.homey.app.climateManager) {
        await this.homey.app.climateManager.setMode(action.mode);
        if (action.temperature != null) {
          await this.homey.app.climateManager.setTargetTemperature(action.temperature);
        }
      }
    } catch (err) {
      this._log(`setHVAC: mode=${action.mode} temp=${action.temperature} (simulated: ${err.message})`);
    }
  }

  // ── Condition evaluation ─────────────────────────────────────────

  async _evaluateConditions(conditions, _event) {
    for (const condition of conditions) {
      if (condition.type === 'timeRange') {
        const hour = new Date().getHours();
        if (hour < (condition.start || 0) || hour > (condition.end || 23)) {
          return false;
        }
      }
      if (condition.type === 'dayOfWeek') {
        const day = new Date().getDay();
        if (condition.days && !condition.days.includes(day)) {
          return false;
        }
      }
    }
    return true;
  }

  // ── GeofencingEngine integration ─────────────────────────────────

  _registerGeofenceListeners() {
    const homey = this.homey;

    const enterHandler = (data) => {
      this.processEvent({
        type: 'arrive',
        zone: data.geofence?.id || data.zone || 'home',
        userId: data.userId || data.user,
        timestamp: Date.now(),
      });
    };

    const exitHandler = (data) => {
      this.processEvent({
        type: 'depart',
        zone: data.geofence?.id || data.zone || 'home',
        userId: data.userId || data.user,
        timestamp: Date.now(),
      });
    };

    // Listen on HomeyShim EventEmitter
    if (homey.on) {
      homey.on('geofence:entered', enterHandler);
      homey.on('geofence:exited', exitHandler);
      this._listeners.push(
        { event: 'geofence:entered', handler: enterHandler },
        { event: 'geofence:exited', handler: exitHandler }
      );
    }
  }

  // ── History / diagnostics ────────────────────────────────────────

  _recordExecution(rule, event, status, errorMessage) {
    this.executionHistory.push({
      ruleId: rule.id,
      ruleName: rule.name,
      event: { type: event.type, zone: event.zone },
      status,
      errorMessage,
      timestamp: Date.now(),
    });

    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory.shift();
    }
  }

  getExecutionHistory() {
    return [...this.executionHistory];
  }

  getStatistics() {
    const total = this.executionHistory.length;
    const successes = this.executionHistory.filter(e => e.status === 'success').length;
    return {
      totalRules: this.rules.size,
      activeRules: Array.from(this.rules.values()).filter(r => r.enabled).length,
      totalExecutions: total,
      successfulExecutions: successes,
      failedExecutions: total - successes,
    };
  }

  destroy() {
    if (this.homey && this.homey.removeListener) {
      for (const { event, handler } of this._listeners) {
        this.homey.removeListener(event, handler);
      }
    }
    this._listeners = [];
    this.rules.clear();
    this.executionHistory = [];
    this.events.removeAllListeners();
  }

  _log(...args) {
    if (this.homey && this.homey.log) {
      this.homey.log('[GeofencingAutomationEngine]', ...args);
    }
  }

  _error(...args) {
    if (this.homey && this.homey.error) {
      this.homey.error('[GeofencingAutomationEngine]', ...args);
    }
  }
}

module.exports = GeofencingAutomationEngine;
