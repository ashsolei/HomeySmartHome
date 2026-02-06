'use strict';

const EventEmitter = require('events');

/**
 * @fileoverview Abstract base class for all Homey Smart Home subsystems.
 *
 * BaseSystem provides a standardized foundation that every system module should
 * extend. It handles lifecycle management, structured logging, resource tracking,
 * error-safe execution, metrics collection, caching, health reporting, and state
 * persistence — eliminating boilerplate and ensuring consistent behaviour across
 * the entire platform.
 *
 * @example
 *   const { BaseSystem } = require('./utils/BaseSystem');
 *
 *   class LightingSystem extends BaseSystem {
 *     async onInitialize() {
 *       this.lights = [];
 *       this.pollInterval = this.wrapInterval(() => this.poll(), 30_000);
 *     }
 *     async onDestroy() {
 *       this.lights = [];
 *     }
 *   }
 *
 * @module utils/BaseSystem
 */

/** Sentinel used to detect missing cache managers gracefully. */
const NO_CACHE = Symbol('NO_CACHE');

/**
 * Abstract base class for all smart-home subsystems.
 *
 * Provides lifecycle hooks, structured logging, resource tracking,
 * metrics, caching, health reporting, and state persistence.
 *
 * @extends EventEmitter
 */
class BaseSystem extends EventEmitter {
  /** Semantic version of the BaseSystem contract. */
  static VERSION = '1.0.0';

  /**
   * Create a new subsystem instance.
   *
   * @param {object}  [homey]   - The Homey API instance (optional).
   * @param {object}  [options] - Additional configuration options.
   * @param {number}  [options.cacheTTL=300000]      - Default cache TTL in ms (5 min).
   * @param {number}  [options.maxBoundedSize=100]    - Default cap for boundedPush().
   * @param {object}  [options.cacheManager]          - External CentralizedCacheManager.
   * @param {string}  [options.stateNamespace]        - Namespace prefix for state keys.
   */
  constructor(homey = null, options = {}) {
    super();

    /** @type {object|null} Homey API reference. */
    this.homey = homey;

    /** @type {string} Human-readable system name derived from the class. */
    this.name = this.constructor.name;

    /** @type {boolean} Whether initialize() has completed successfully. */
    this.isInitialized = false;

    /** @private @type {boolean} Guard flag to prevent concurrent init calls. */
    this._initializing = false;

    // ── Options ────────────────────────────────────────────────────────
    /** @private */ this._cacheTTL = options.cacheTTL ?? 300_000;
    /** @private */ this._maxBoundedSize = options.maxBoundedSize ?? 100;
    /** @private */ this._cacheManager = options.cacheManager ?? NO_CACHE;
    /** @private */ this._stateNamespace = options.stateNamespace ?? this.name;

    // ── Resource tracking ──────────────────────────────────────────────
    /** @private @type {Set<NodeJS.Timeout>} Active intervals. */
    this._intervals = new Set();

    /** @private @type {Set<NodeJS.Timeout>} Active timeouts. */
    this._timeouts = new Set();

    // ── Metrics ────────────────────────────────────────────────────────
    /** @type {object} Runtime metrics for this system. */
    this.metrics = {
      startedAt: null,
      errorCount: 0,
      lastError: null,
      lastErrorTime: null,
      operationCount: 0,
    };

    // ── Internal cache (fallback when no external manager) ─────────────
    /** @private @type {Map<string, {value: any, expiresAt: number}>} */
    this._localCache = new Map();

    // ── State store (in-memory, can be overridden) ─────────────────────
    /** @private @type {Map<string, any>} */
    this._stateStore = new Map();
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Initialize the system. Calls the subclass `onInitialize()` hook.
   * Prevents double-initialization and emits an `initialized` event on success.
   *
   * @returns {Promise<void>}
   * @throws {Error} If initialization fails (error is also emitted).
   */
  async initialize() {
    if (this.isInitialized) {
      this.warn('initialize() called but system is already initialized — skipping.');
      return;
    }
    if (this._initializing) {
      this.warn('initialize() called while initialization is already in progress — skipping.');
      return;
    }

    this._initializing = true;

    try {
      this.log('Initializing…');
      this.metrics.startedAt = Date.now();

      await this.onInitialize();

      this.isInitialized = true;
      this._initializing = false;
      this.log('Initialized successfully.');
      this.emit('initialized');
    } catch (err) {
      this._initializing = false;
      this._recordError(err);
      this.error('Initialization failed:', err.message);
      this.emit('error', err);
      throw err;
    }
  }

  /**
   * Tear down the system: calls `onDestroy()`, clears all tracked timers,
   * flushes the local cache, and emits a `destroyed` event.
   *
   * @returns {Promise<void>}
   */
  async destroy() {
    if (!this.isInitialized) {
      this.warn('destroy() called but system was never initialized — performing cleanup anyway.');
    }

    try {
      this.log('Destroying…');

      await this.onDestroy();

      this._clearAllIntervals();
      this._clearAllTimeouts();
      this._localCache.clear();

      this.isInitialized = false;
      this.log('Destroyed successfully.');
      this.emit('destroyed');
    } catch (err) {
      this._recordError(err);
      this.error('Error during destroy:', err.message);
      this.emit('error', err);
      throw err;
    }
  }

  /**
   * Subclass hook — override to perform custom initialization logic.
   * Called by {@link BaseSystem#initialize}.
   *
   * @abstract
   * @returns {Promise<void>}
   */
  async onInitialize() {
    // Override in subclass
  }

  /**
   * Subclass hook — override to perform custom teardown logic.
   * Called by {@link BaseSystem#destroy}.
   *
   * @abstract
   * @returns {Promise<void>}
   */
  async onDestroy() {
    // Override in subclass
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  STRUCTURED LOGGING
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Return a formatted timestamp string for log output.
   *
   * @private
   * @returns {string} ISO-style timestamp, e.g. "2026-02-06T14:30:00.123Z".
   */
  _timestamp() {
    return new Date().toISOString();
  }

  /**
   * Log an informational message with the system name and timestamp.
   *
   * @param {...any} args - Values to log.
   */
  log(...args) {
    console.log(`[${this._timestamp()}] [${this.name}]`, ...args);
  }

  /**
   * Log a warning message with the system name and timestamp.
   *
   * @param {...any} args - Values to log.
   */
  warn(...args) {
    console.warn(`[${this._timestamp()}] [${this.name}] ⚠`, ...args);
  }

  /**
   * Log an error message with the system name and timestamp.
   *
   * @param {...any} args - Values to log.
   */
  error(...args) {
    console.error(`[${this._timestamp()}] [${this.name}] ✖`, ...args);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  TIMER TRACKING
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Create a tracked `setInterval`. The handle is stored internally and
   * will be cleared automatically when {@link BaseSystem#destroy} is called.
   *
   * @param {Function} fn       - Callback to execute on each tick.
   * @param {number}   ms       - Interval period in milliseconds.
   * @param {...any}   args     - Extra arguments forwarded to `setInterval`.
   * @returns {NodeJS.Timeout}  The interval handle.
   */
  wrapInterval(fn, ms, ...args) {
    const handle = setInterval(fn, ms, ...args);
    this._intervals.add(handle);
    return handle;
  }

  /**
   * Create a tracked `setTimeout`. The handle is stored internally and
   * will be cleared automatically when {@link BaseSystem#destroy} is called.
   *
   * @param {Function} fn       - Callback to execute after the delay.
   * @param {number}   ms       - Delay in milliseconds.
   * @param {...any}   args     - Extra arguments forwarded to `setTimeout`.
   * @returns {NodeJS.Timeout}  The timeout handle.
   */
  wrapTimeout(fn, ms, ...args) {
    const handle = setTimeout(() => {
      this._timeouts.delete(handle);
      fn(...args);
    }, ms);
    this._timeouts.add(handle);
    return handle;
  }

  /**
   * Manually clear a previously wrapped interval.
   *
   * @param {NodeJS.Timeout} handle - The interval handle to clear.
   */
  clearWrappedInterval(handle) {
    clearInterval(handle);
    this._intervals.delete(handle);
  }

  /**
   * Manually clear a previously wrapped timeout.
   *
   * @param {NodeJS.Timeout} handle - The timeout handle to clear.
   */
  clearWrappedTimeout(handle) {
    clearTimeout(handle);
    this._timeouts.delete(handle);
  }

  /**
   * Clear every tracked interval.
   *
   * @private
   */
  _clearAllIntervals() {
    for (const handle of this._intervals) {
      clearInterval(handle);
    }
    this._intervals.clear();
    this.log(`All intervals cleared (count reset to 0).`);
  }

  /**
   * Clear every tracked timeout.
   *
   * @private
   */
  _clearAllTimeouts() {
    for (const handle of this._timeouts) {
      clearTimeout(handle);
    }
    this._timeouts.clear();
    this.log(`All timeouts cleared (count reset to 0).`);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  ERROR-SAFE EXECUTION
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Execute a function inside a try/catch, logging any errors with context.
   * Never silently swallows exceptions — every failure is logged and tracked
   * in the metrics.
   *
   * @template T
   * @param {() => T | Promise<T>} fn       - The operation to execute.
   * @param {string}               [context='unknown'] - Human-readable label
   *   describing the operation (used in log messages).
   * @returns {Promise<T | null>} The return value of `fn`, or `null` on error.
   */
  async safeExecute(fn, context = 'unknown') {
    try {
      this.metrics.operationCount++;
      const result = await fn();
      return result;
    } catch (err) {
      this._recordError(err);
      this.error(`safeExecute failed [${context}]:`, err.message);
      this.emit('error', err);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  METRICS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Record an error in the internal metrics counters.
   *
   * @private
   * @param {Error} err - The error that occurred.
   */
  _recordError(err) {
    this.metrics.errorCount++;
    this.metrics.lastError = err.message;
    this.metrics.lastErrorTime = Date.now();
  }

  /**
   * Get the system's uptime in milliseconds, or `0` if it was never started.
   *
   * @returns {number} Uptime in ms.
   */
  getUptime() {
    if (!this.metrics.startedAt) return 0;
    return Date.now() - this.metrics.startedAt;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  HEALTH REPORTING
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Return a standardized health report for this system.
   *
   * @returns {{ name: string, status: string, uptime: number, errors: number, metrics: object }}
   */
  getHealth() {
    const status = this.isInitialized ? 'running' : 'stopped';
    return {
      name: this.name,
      status,
      uptime: this.getUptime(),
      errors: this.metrics.errorCount,
      metrics: {
        operationCount: this.metrics.operationCount,
        lastError: this.metrics.lastError,
        lastErrorTime: this.metrics.lastErrorTime,
        activeIntervals: this._intervals.size,
        activeTimeouts: this._timeouts.size,
        cacheSize: this._localCache.size,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  CACHE INTEGRATION
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Store a value in the cache. Delegates to an external
   * `CentralizedCacheManager` when one is available, otherwise falls back to
   * a simple in-memory Map with TTL expiry.
   *
   * @param {string} key   - Cache key.
   * @param {any}    value - Value to cache.
   * @param {number} [ttl] - Time-to-live in ms (defaults to `this._cacheTTL`).
   */
  cacheSet(key, value, ttl) {
    const effectiveTTL = ttl ?? this._cacheTTL;
    const namespacedKey = `${this._stateNamespace}:${key}`;

    if (this._cacheManager !== NO_CACHE && typeof this._cacheManager?.set === 'function') {
      this._cacheManager.set(namespacedKey, value, effectiveTTL);
      return;
    }

    this._localCache.set(namespacedKey, {
      value,
      expiresAt: Date.now() + effectiveTTL,
    });
  }

  /**
   * Retrieve a value from the cache. Returns `undefined` if the key is
   * missing or the entry has expired.
   *
   * @param {string} key - Cache key.
   * @returns {any | undefined}
   */
  cacheGet(key) {
    const namespacedKey = `${this._stateNamespace}:${key}`;

    if (this._cacheManager !== NO_CACHE && typeof this._cacheManager?.get === 'function') {
      return this._cacheManager.get(namespacedKey);
    }

    const entry = this._localCache.get(namespacedKey);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this._localCache.delete(namespacedKey);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Delete a value from the cache.
   *
   * @param {string} key - Cache key.
   * @returns {boolean} Whether the key existed before deletion.
   */
  cacheDelete(key) {
    const namespacedKey = `${this._stateNamespace}:${key}`;

    if (this._cacheManager !== NO_CACHE && typeof this._cacheManager?.delete === 'function') {
      return this._cacheManager.delete(namespacedKey);
    }

    return this._localCache.delete(namespacedKey);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  BOUNDED ARRAY HELPER
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Push an item onto an array while capping its maximum length to prevent
   * unbounded growth. Oldest entries (at the front) are removed first.
   *
   * @param {Array}  array           - Target array.
   * @param {any}    item            - Item to push.
   * @param {number} [maxSize=100]   - Maximum allowed length.
   * @returns {Array} The same array reference, for chaining.
   */
  boundedPush(array, item, maxSize) {
    const cap = maxSize ?? this._maxBoundedSize;
    array.push(item);
    while (array.length > cap) {
      array.shift();
    }
    return array;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  STATE PERSISTENCE
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Persist a piece of state under the given key. When running on Homey the
   * data is stored via `this.homey.settings`; otherwise it uses an in-memory
   * map. Subclasses may override for custom persistence backends.
   *
   * @param {string} key  - State key (automatically namespaced).
   * @param {any}    data - Serializable data to store.
   */
  saveState(key, data) {
    const nsKey = `${this._stateNamespace}:state:${key}`;

    if (this.homey && typeof this.homey.settings?.set === 'function') {
      try {
        this.homey.settings.set(nsKey, JSON.stringify(data));
      } catch (err) {
        this.error(`Failed to persist state "${key}":`, err.message);
        this._recordError(err);
      }
      return;
    }

    this._stateStore.set(nsKey, data);
  }

  /**
   * Load a previously saved piece of state. Returns `null` when the key
   * does not exist.
   *
   * @param {string} key - State key (automatically namespaced).
   * @returns {any | null}
   */
  loadState(key) {
    const nsKey = `${this._stateNamespace}:state:${key}`;

    if (this.homey && typeof this.homey.settings?.get === 'function') {
      try {
        const raw = this.homey.settings.get(nsKey);
        return raw != null ? JSON.parse(raw) : null;
      } catch (err) {
        this.error(`Failed to load state "${key}":`, err.message);
        this._recordError(err);
        return null;
      }
    }

    return this._stateStore.has(nsKey) ? this._stateStore.get(nsKey) : null;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  UTILITIES
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Return a human-readable summary string for debugging.
   *
   * @returns {string}
   */
  toString() {
    const status = this.isInitialized ? 'running' : 'stopped';
    return `[${this.name} v${BaseSystem.VERSION} | ${status} | uptime=${this.getUptime()}ms | errors=${this.metrics.errorCount}]`;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  FACTORY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Factory function that instantiates a given BaseSystem subclass and
 * optionally initializes it.
 *
 * @template {typeof BaseSystem} T
 * @param {T}       SystemClass          - A class that extends BaseSystem.
 * @param {object}  [homey]              - Homey API instance.
 * @param {object}  [options]            - Options forwarded to the constructor.
 * @param {boolean} [autoInit=false]     - When `true`, calls `initialize()` before returning.
 * @returns {Promise<InstanceType<T>>}   The created (and optionally initialized) instance.
 */
async function createSystem(SystemClass, homey = null, options = {}, autoInit = false) {
  if (!(SystemClass.prototype instanceof BaseSystem)) {
    throw new TypeError(`createSystem: ${SystemClass.name} must extend BaseSystem.`);
  }

  const instance = new SystemClass(homey, options);

  if (autoInit) {
    await instance.initialize();
  }

  return instance;
}

// ═══════════════════════════════════════════════════════════════════════════
//  EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = { BaseSystem, createSystem };
