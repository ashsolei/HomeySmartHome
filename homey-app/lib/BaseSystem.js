'use strict';

/**
 * BaseSystem
 *
 * Common base class for all Smart Home modules.
 *
 * Responsibilities:
 *  - Hold a reference to the Homey instance.
 *  - Track all setInterval / setTimeout handles created by subclasses so
 *    they can be cleaned up reliably on shutdown (destroy()).
 *  - Guard against double-initialization.
 *  - Provide a consistent log/error interface prefixed with the class name.
 *
 * Usage:
 *   class SmartExampleSystem extends BaseSystem {
 *     async initialize() {
 *       await super.initialize();
 *       this.registerInterval(setInterval(() => this._tick(), 30_000));
 *     }
 *   }
 */
class BaseSystem {
  /**
   * @param {Object} homey - Homey app instance passed from the SDK entry point.
   */
  constructor(homey) {
    this.homey = homey;

    /** @private @type {NodeJS.Timeout[]} */
    this._intervals = [];

    /** @private @type {NodeJS.Timeout[]} */
    this._timeouts = [];

    /** @private */
    this._initialized = false;
  }

  /**
   * Initialize the system.
   * Subclasses must call `await super.initialize()` before their own logic.
   */
  async initialize() {
    if (this._initialized) {
      this.log('Already initialized, skipping');
      return;
    }
    this._initialized = true;
  }

  /**
   * Register a setInterval handle for automatic cleanup on destroy().
   *
   * @param {NodeJS.Timeout} interval - Return value of setInterval().
   * @returns {NodeJS.Timeout} The same interval handle (for chaining / assignment).
   */
  registerInterval(interval) {
    this._intervals.push(interval);
    return interval;
  }

  /**
   * Register a setTimeout handle for automatic cleanup on destroy().
   *
   * @param {NodeJS.Timeout} timeout - Return value of setTimeout().
   * @returns {NodeJS.Timeout} The same timeout handle (for chaining / assignment).
   */
  registerTimeout(timeout) {
    this._timeouts.push(timeout);
    return timeout;
  }

  /**
   * Tear down the system: clear all registered intervals and timeouts.
   * Subclasses that override destroy() must call `await super.destroy()`.
   */
  async destroy() {
    this._intervals.forEach(i => clearInterval(i));
    this._timeouts.forEach(t => clearTimeout(t));
    this._intervals = [];
    this._timeouts = [];
    this._initialized = false;
  }

  // ---------------------------------------------------------------------------
  // Logging helpers
  // ---------------------------------------------------------------------------

  /**
   * Log an informational message, prefixed with the class name.
   * @param {...*} args
   */
  log(...args) {
    console.log(`[${this.constructor.name}]`, ...args);
  }

  /**
   * Log an error message, prefixed with the class name.
   * @param {...*} args
   */
  error(...args) {
    console.error(`[${this.constructor.name}]`, ...args);
  }
}

module.exports = BaseSystem;
