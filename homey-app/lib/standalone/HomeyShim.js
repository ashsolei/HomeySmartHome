'use strict';

const EventEmitter = require('events');

/**
 * HomeyShim - Emulates the Homey SDK runtime for standalone/container deployment.
 * Provides the same API surface that all systems expect from `this.homey`.
 */
class HomeyShim extends EventEmitter {
  constructor(options = {}) {
    super();
    this.setMaxListeners(200);
    this._settings = new Map();
    this._store = new Map();
    this._timers = new Set();
    this._intervals = new Set();
    this._startedAt = Date.now();
    this._options = options;
    this._devices = new Map();
    this._zones = new Map();
    this._flowTokens = new Map();

    // Mimic Homey's sub-managers
    this.settings = this._createSettingsManager();
    this.notifications = this._createNotificationsManager();
    this.clock = this._createClockManager();
    this.geolocation = this._createGeolocationManager();
    this.speechInput = this._createSpeechManager();
    this.speechOutput = this._createSpeechManager();
    this.ledring = this._createLedringManager();
    this.devices = this._createDevicesManager();
    this.drivers = this._createDriversManager();
    this.zones = this._createZonesManager();
    this.flow = this._createFlowManager();
    this.api = this._createApiManager();
    this.images = this._createImagesManager();
    this.i18n = this._createI18nManager();

    // The app reference (set externally after initialization)
    this.app = null;

    // Manifest placeholder
    this.manifest = options.manifest || {};
    this.version = options.version || '1.0.0';
    this.platform = 'standalone';
  }

  // ─── Settings Manager ───────────────────────────────────────────────
  _createSettingsManager() {
    const self = this;
    return {
      get(key) {
        return self._settings.get(key) || null;
      },
      set(key, value) {
        self._settings.set(key, value);
        self.emit('settings.set', key, value);
      },
      getKeys() {
        return Array.from(self._settings.keys());
      },
      unset(key) {
        self._settings.delete(key);
      }
    };
  }

  // ─── Notifications Manager ──────────────────────────────────────────
  _createNotificationsManager() {
    return {
      async createNotification({ excerpt }) {
        const timestamp = new Date().toISOString();
        console.log(`[NOTIFICATION ${timestamp}] ${excerpt}`);
        return { id: `notif-${Date.now()}`, excerpt, timestamp };
      }
    };
  }

  // ─── Clock Manager ─────────────────────────────────────────────────
  _createClockManager() {
    return {
      getTimezone() {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Stockholm';
      },
      getTime() {
        return new Date();
      }
    };
  }

  // ─── Geolocation Manager ───────────────────────────────────────────
  _createGeolocationManager() {
    const lat = this._options.latitude || 59.3293;  // Stockholm default
    const lon = this._options.longitude || 18.0686;
    return {
      getLatitude() { return lat; },
      getLongitude() { return lon; },
      getAccuracy() { return 10; },
      getLocation() { return { latitude: lat, longitude: lon, accuracy: 10 }; }
    };
  }

  // ─── Speech Manager ────────────────────────────────────────────────
  _createSpeechManager() {
    return {
      say(text) {
        console.log(`[SPEECH] ${text}`);
        return Promise.resolve();
      },
      on() {},
      removeListener() {}
    };
  }

  // ─── LED Ring Manager ──────────────────────────────────────────────
  _createLedringManager() {
    return {
      async registerAnimation() { return { id: `anim-${Date.now()}` }; },
      async setScreensaver() {},
      async animate() {}
    };
  }

  // ─── Devices Manager ──────────────────────────────────────────────
  _createDevicesManager() {
    const self = this;
    return {
      async getDevices() {
        return Object.fromEntries(self._devices);
      },
      async getDevice({ id }) {
        return self._devices.get(id) || null;
      },
      registerDevice(device) {
        self._devices.set(device.id, device);
      }
    };
  }

  // ─── Drivers Manager (legacy compat) ──────────────────────────────
  _createDriversManager() {
    const self = this;
    return {
      getDevices() {
        return Array.from(self._devices.values());
      },
      getDriver() { return null; },
      getDrivers() { return {}; },
      on() {},
      removeListener() {}
    };
  }

  // ─── Zones Manager ────────────────────────────────────────────────
  _createZonesManager() {
    const self = this;
    return {
      async getZones() {
        return Object.fromEntries(self._zones);
      },
      async getZone({ id }) {
        return self._zones.get(id) || null;
      }
    };
  }

  // ─── Flow Manager ─────────────────────────────────────────────────
  _createFlowManager() {
    const self = this;
    return {
      createToken(id, opts) {
        const token = {
          id,
          ...opts,
          value: opts.value || null,
          async setValue(val) { this.value = val; }
        };
        self._flowTokens.set(id, token);
        return token;
      },
      getToken(id) {
        return self._flowTokens.get(id) || null;
      },
      getTriggerCard(id) {
        return {
          registerRunListener(fn) { return this; },
          trigger(tokens, state) {
            self.emit(`flow:trigger:${id}`, tokens, state);
            return Promise.resolve();
          }
        };
      },
      getConditionCard(id) {
        return {
          registerRunListener(fn) { return this; }
        };
      },
      getActionCard(id) {
        return {
          registerRunListener(fn) { return this; }
        };
      }
    };
  }

  // ─── API Manager ──────────────────────────────────────────────────
  _createApiManager() {
    return {
      getApiUrl() { return `http://localhost:${process.env.PORT || 3000}`; },
      getLocalUrl() { return `http://localhost:${process.env.PORT || 3000}`; },
      realtime(event, data) {
        // WebSocket push stub
      }
    };
  }

  // ─── Images Manager ───────────────────────────────────────────────
  _createImagesManager() {
    return {
      createImage() {
        return {
          setStream(fn) { this._streamFn = fn; },
          setUrl(url) { this._url = url; },
          setPath(path) { this._path = path; },
          async register() {},
          async update() {}
        };
      }
    };
  }

  // ─── i18n Manager ─────────────────────────────────────────────────
  _createI18nManager() {
    return {
      getLanguage() { return 'en'; },
      getUnits() {
        return { temperature: 'celsius', length: 'metric' };
      },
      __(key, tokens) {
        // Simple pass-through
        if (typeof key === 'string') return key;
        return key.en || Object.values(key)[0] || '';
      }
    };
  }

  // ─── Timer helpers (Homey-compatible) ─────────────────────────────
  setTimeout(fn, ms) {
    const t = setTimeout(fn, ms);
    this._timers.add(t);
    return t;
  }

  setInterval(fn, ms) {
    const i = setInterval(fn, ms);
    this._intervals.add(i);
    return i;
  }

  clearTimeout(t) {
    clearTimeout(t);
    this._timers.delete(t);
  }

  clearInterval(i) {
    clearInterval(i);
    this._intervals.delete(i);
  }

  // ─── Logging ──────────────────────────────────────────────────────
  log(...args) {
    console.log('[Homey]', ...args);
  }

  error(...args) {
    console.error('[Homey:ERROR]', ...args);
  }

  // ─── Cleanup ──────────────────────────────────────────────────────
  destroy() {
    this._timers.forEach(t => clearTimeout(t));
    this._intervals.forEach(i => clearInterval(i));
    this._timers.clear();
    this._intervals.clear();
    this._settings.clear();
    this._store.clear();
    this.removeAllListeners();
  }

  // ─── Info ─────────────────────────────────────────────────────────
  getUptime() {
    return Math.floor((Date.now() - this._startedAt) / 1000);
  }
}

module.exports = HomeyShim;
