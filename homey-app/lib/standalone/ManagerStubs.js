'use strict';

/**
 * Manager Stubs — Lightweight stand-ins for Homey SDK managers
 * Used in standalone/Docker mode where the real SDK isn't available.
 *
 * @module ManagerStubs
 * @version 3.1.0
 */

class DeviceManager {
  constructor(app) {
    this.app = app;
    this.devices = {};
  }

  async initialize() {
    console.log('[DeviceManager] initialized (standalone stub)');
  }

  async getDevices() {
    return this.devices;
  }

  async getDevicesSummary() {
    return {
      total: Object.keys(this.devices).length,
      byClass: {},
      byZone: {},
      online: 0,
      offline: 0,
    };
  }

  async setZoneLights() {}
}

class SceneManager {
  constructor(app) {
    this.app = app;
    this.activeScene = null;
  }

  async initialize() {
    console.log('[SceneManager] initialized (standalone stub)');
  }

  async activateScene(sceneId) {
    const scene = this.app.scenes[sceneId];
    if (!scene) throw new Error(`Scene not found: ${sceneId}`);
    this.activeScene = sceneId;
  }

  getActiveScene() {
    return this.activeScene;
  }
}

class AutomationManager {
  constructor(app) {
    this.app = app;
    this.executionHistory = [];
  }

  async initialize() {
    console.log('[AutomationManager] initialized (standalone stub)');
  }

  async executeRoutine(routineId) {
    const routine = this.app.routines[routineId];
    if (!routine) throw new Error(`Routine not found: ${routineId}`);
    this.executionHistory.push({ routineId, timestamp: new Date().toISOString() });
  }
}

class EnergyManager {
  constructor(app) {
    this.app = app;
    this.consumptionHistory = [];
    this.threshold = 3000;
  }

  async initialize() {
    console.log('[EnergyManager] initialized (standalone stub)');
  }

  async getCurrentConsumption() {
    return { total: 0, devices: [], threshold: this.threshold, isHigh: false };
  }
}

class SecurityManager {
  constructor(app) {
    this.app = app;
    this.events = [];
  }

  async initialize() {
    console.log('[SecurityManager] initialized (standalone stub)');
  }

  async setMode(mode) {
    this.app.securityMode = mode;
  }

  async getStatus() {
    return {
      mode: this.app.securityMode,
      devices: [],
      recentEvents: this.events.slice(-10),
    };
  }
}

class ClimateManager {
  constructor(app) {
    this.app = app;
    this.targets = {};
  }

  async initialize() {
    console.log('[ClimateManager] initialized (standalone stub)');
  }

  async getAllZonesStatus() {
    return {};
  }

  async setZoneTemperature() {}

  async setTargetTemperature(zone, temp) {
    this.targets[zone] = temp;
  }
}

class PresenceManager {
  constructor(app) {
    this.app = app;
    this.presenceStatus = {};
  }

  async initialize() {
    console.log('[PresenceManager] initialized (standalone stub)');
  }

  isAnyoneHome() {
    return Object.values(this.presenceStatus).some((p) => p.present);
  }

  async getStatus() {
    return {
      users: this.presenceStatus,
      anyoneHome: this.isAnyoneHome(),
      homeCount: 0,
    };
  }
}

class NotificationManager {
  constructor(app) {
    this.app = app;
    this.history = [];
  }

  async initialize() {
    console.log('[NotificationManager] initialized (standalone stub)');
  }

  async send(message, priority = 'normal') {
    const n = { message, priority, timestamp: new Date().toISOString() };
    this.history.push(n);
    if (this.history.length > 100) this.history.shift();
    return n;
  }
}

module.exports = {
  DeviceManager,
  SceneManager,
  AutomationManager,
  EnergyManager,
  SecurityManager,
  ClimateManager,
  PresenceManager,
  NotificationManager,
};
