'use strict';

const EventEmitter = require('events');

/**
 * Homey SDK Shim — provides the `require('homey')` module interface
 * for standalone/container deployment outside of the Homey platform.
 */

class App extends EventEmitter {
  constructor() {
    super();
  }
  async onInit() {}
  async onUninit() {}
  log(...args) { console.log('[App]', ...args); }
  error(...args) { console.error('[App:ERROR]', ...args); }
}

// ManagerSettings shim (singleton in-memory store)
const _settingsStore = new Map();
const ManagerSettings = {
  get(key) { return _settingsStore.get(key) || null; },
  set(key, value) { _settingsStore.set(key, value); },
  getKeys() { return Array.from(_settingsStore.keys()); },
  unset(key) { _settingsStore.delete(key); },
  on() {},
  removeListener() {}
};

// ManagerDrivers shim
const ManagerDrivers = {
  getDriver(id) { return null; },
  getDrivers() { return {}; },
  on() {},
  removeListener() {}
};

// ManagerDevices shim
const ManagerDevices = {
  getDevices() { return {}; },
  getDevice(id) { return null; },
  on() {},
  removeListener() {}
};

// ManagerFlow shim
const ManagerFlow = {
  getCard(type, id) {
    return {
      registerRunListener() { return this; },
      register() { return this; },
      trigger() { return Promise.resolve(); },
      getArgumentValues() { return []; }
    };
  },
  on() {},
  removeListener() {}
};

// ManagerSpeechInput shim
const ManagerSpeechInput = {
  on() {},
  removeListener() {}
};

// ManagerSpeechOutput shim
const ManagerSpeechOutput = {
  say(text) { console.log('[Speech]', text); return Promise.resolve(); },
  on() {},
  removeListener() {}
};

// ManagerNotifications shim
const ManagerNotifications = {
  createNotification({ excerpt }) {
    console.log('[Notification]', excerpt);
    return Promise.resolve();
  }
};

// ManagerGeolocation shim
const ManagerGeolocation = {
  getLatitude() { return 59.3293; },
  getLongitude() { return 18.0686; },
  getMode() { return 'auto'; },
  on() {},
  removeListener() {}
};

// ManagerClock shim
const ManagerClock = {
  getTimezone() { return 'Europe/Stockholm'; },
  on() {},
  removeListener() {}
};

// ManagerImages shim
const ManagerImages = {
  createImage() {
    return {
      setStream() {},
      setUrl() {},
      setPath() {},
      register() { return Promise.resolve(); },
      update() { return Promise.resolve(); }
    };
  }
};

// ManagerApi shim
const ManagerApi = {
  getOwnerApiToken() { return 'standalone-token'; },
  realtime() {},
  on() {},
  removeListener() {}
};

// ManagerLedring shim
const ManagerLedring = {
  registerAnimation() { return Promise.resolve(); },
  registerScreensaver() { return Promise.resolve(); }
};

// ManagerI18n shim
const ManagerI18n = {
  getLanguage() { return 'en'; },
  __(key) { return typeof key === 'string' ? key : (key.en || ''); }
};

module.exports = {
  App,
  ManagerSettings,
  ManagerDrivers,
  ManagerDevices,
  ManagerFlow,
  ManagerSpeechInput,
  ManagerSpeechOutput,
  ManagerNotifications,
  ManagerGeolocation,
  ManagerClock,
  ManagerImages,
  ManagerApi,
  ManagerLedring,
  ManagerI18n
};
