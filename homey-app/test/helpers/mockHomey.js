'use strict';

/**
 * Minimal in-process HomeyShim mock for unit tests.
 * Mirrors the API surface that modules call on `this.homey` without
 * requiring the full HomeyShim boot sequence or a live server.
 */

const EventEmitter = require('events');

function createMockHomey(overrides = {}) {
  const settings = new Map();

  const homey = new EventEmitter();

  homey.settings = {
    get(key) { return settings.get(key) ?? null; },
    set(key, value) { settings.set(key, value); },
    getKeys() { return Array.from(settings.keys()); },
    unset(key) { settings.delete(key); },
  };

  homey.notifications = {
    async createNotification({ excerpt }) {
      return { id: `notif-${Date.now()}`, excerpt };
    },
  };

  homey.devices = {
    async getDevice({ id }) {
      return {
        id,
        getCapabilityValue: async () => null,
        setCapabilityValue: async () => {},
      };
    },
  };

  homey.flow = {
    getTriggerCard() { return null; },
    getConditionCard() { return null; },
    getActionCard() { return null; },
  };

  homey.log = (...args) => {};
  homey.error = (...args) => {};

  // Wire up a minimal app stub; tests may override individual managers.
  homey.app = {
    presenceManager: {
      async getStatus() { return { status: 'away', users: [] }; },
    },
    energyManager: {
      async getCurrentConsumption() { return { total: 0, devices: [] }; },
    },
    sceneManager: {
      getActiveScene() { return null; },
      async activateScene() { return { success: true }; },
    },
    energyForecastingEngine: {
      getCurrentEnergyPrice() { return { price: 0.5, level: 'normal' }; },
    },
  };

  // Allow callers to overlay any part of the mock.
  Object.assign(homey, overrides);

  return homey;
}

module.exports = { createMockHomey };
