'use strict';

const EventEmitter = require('events');

/**
 * @typedef {'CRITICAL'|'HIGH'|'MEDIUM'|'LOW'|'INFO'} ErrorSeverity
 *
 * @typedef {Object} ErrorEntry
 * @property {string}        id        - Unique error identifier
 * @property {Error|string}  error     - The original error
 * @property {string}        message   - Error message
 * @property {ErrorSeverity} severity  - Classified severity level
 * @property {string}        system    - Originating system / module name
 * @property {string}        context   - Additional context description
 * @property {number}        timestamp - Unix epoch ms
 * @property {string}        stack     - Stack trace when available
 *
 * @typedef {Object} CircuitState
 * @property {number}  failures      - Consecutive failure count
 * @property {boolean} open          - Whether the circuit is open (tripped)
 * @property {number}  lastFailure   - Timestamp of last failure
 * @property {number}  nextRetryAt   - Timestamp when half-open probe is allowed
 */

/** Maximum number of errors kept in the registry. */
const MAX_ERROR_HISTORY = 500;

/** Window (ms) used for error-storm detection. */
const STORM_WINDOW_MS = 60_000;

/** Threshold of errors from the same source within the storm window. */
const STORM_THRESHOLD = 10;

/** Window (ms) for duplicate-error suppression. */
const DUPLICATE_WINDOW_MS = 5_000;

/** Default circuit-breaker failure threshold. */
const DEFAULT_CIRCUIT_THRESHOLD = 5;

/** Default circuit-breaker cooldown before half-open retry (ms). */
const DEFAULT_CIRCUIT_COOLDOWN_MS = 30_000;

/**
 * Severity weight map – higher means more severe.
 * Used for sorting and trend analysis.
 */
const SEVERITY_WEIGHT = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  INFO: 1,
};

/* ──────────────────────────────────────────────────────────────────────────────
 * ErrorHandlingMiddleware
 * ────────────────────────────────────────────────────────────────────────────── */

/**
 * Centralised error-handling middleware for the Homey Smart Home platform.
 *
 * Features:
 * - Five-level error classification (CRITICAL → INFO)
 * - Bounded error registry with frequency tracking & storm detection
 * - Retry with exponential back-off, fallback, circuit-breaker, graceful degrade
 * - Reporting helpers (by category, system, time-window trends)
 * - `wrapAsync` / `wrapSync` / `createHandler` utilities to replace empty catches
 * - EventEmitter integration (`error`, `error-storm`, `circuit-open`, `circuit-close`)
 * - Singleton access via `getInstance()`
 *
 * @extends EventEmitter
 */
class ErrorHandlingMiddleware extends EventEmitter {
  /* ── Singleton ──────────────────────────────────────────────────────────── */

  /** @type {ErrorHandlingMiddleware|null} */
  static _instance = null;

  /**
   * Return the singleton instance, creating it on first call.
   *
   * @param {object} [homey] - Optional Homey SDK reference.
   * @returns {ErrorHandlingMiddleware}
   */
  static getInstance(homey) {
    if (!ErrorHandlingMiddleware._instance) {
      ErrorHandlingMiddleware._instance = new ErrorHandlingMiddleware(homey);
    }
    return ErrorHandlingMiddleware._instance;
  }

  /* ── Constructor ────────────────────────────────────────────────────────── */

  /**
   * @param {object} [homey] - Homey SDK reference (optional).
   */
  constructor(homey) {
    super();
    /** @type {object|null} */
    this.homey = homey || null;

    /**
     * Bounded FIFO list of error entries.
     * @type {ErrorEntry[]}
     */
    this._errors = [];

    /**
     * Per-system timestamps used for storm detection.
     * @type {Map<string, number[]>}
     */
    this._stormTracker = new Map();

    /**
     * Tracks the last recorded message per system for duplicate suppression.
     * @type {Map<string, {message: string, timestamp: number}>}
     */
    this._duplicateTracker = new Map();

    /**
     * Circuit-breaker state keyed by operation name.
     * @type {Map<string, CircuitState>}
     */
    this._circuits = new Map();

    /**
     * Counter incremented for every recorded error to produce unique IDs.
     * @type {number}
     */
    this._idCounter = 0;

    this._initialized = true;
  }

  /* ══════════════════════════════════════════════════════════════════════════
   * 1. ERROR CLASSIFICATION
   * ══════════════════════════════════════════════════════════════════════════ */

  /**
   * Automatically classify an error into a severity level based on its
   * message and optional hint.
   *
   * @param {Error|string} error        - The error to classify.
   * @param {ErrorSeverity} [hintSeverity] - Explicit severity override.
   * @returns {ErrorSeverity}
   */
  classifyError(error, hintSeverity) {
    if (hintSeverity && SEVERITY_WEIGHT[hintSeverity] !== undefined) {
      return hintSeverity;
    }

    const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();

    // CRITICAL – system crashes, security, data corruption
    if (/crash|segfault|security|breach|corrupt|fatal|unrecoverable/.test(msg)) {
      return 'CRITICAL';
    }
    // HIGH – device comms, API errors
    if (/device.*fail|api.*error|connection.*refused|econnreset|socket hang up|unauthorized/.test(msg)) {
      return 'HIGH';
    }
    // MEDIUM – cache, timeout, validation
    if (/timeout|timed?\s*out|cache miss|validation|invalid|enoent|not found/.test(msg)) {
      return 'MEDIUM';
    }
    // INFO – expected / transient
    if (/offline|rate.?limit|throttl|not available|econnrefused/.test(msg)) {
      return 'INFO';
    }
    // Default bucket
    return 'LOW';
  }

  /* ══════════════════════════════════════════════════════════════════════════
   * 2. ERROR REGISTRY
   * ══════════════════════════════════════════════════════════════════════════ */

  /**
   * Record an error in the centralised registry.
   *
   * Handles:
   * - Bounded history (drops oldest when full)
   * - Duplicate suppression (same message from same system within 5 s)
   * - Storm detection (>10 errors from same source in 1 min)
   *
   * @param {Error|string}  error              - The error to record.
   * @param {string}        [system='unknown'] - Originating system name.
   * @param {string}        [context='']       - Extra context description.
   * @param {ErrorSeverity} [severity]         - Explicit severity override.
   * @returns {ErrorEntry|null} The recorded entry, or `null` if suppressed.
   */
  recordError(error, system = 'unknown', context = '', severity) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : '';
    const now = Date.now();

    /* ── Duplicate suppression ──────────────────────────────────────────── */
    const dupKey = system;
    const lastDup = this._duplicateTracker.get(dupKey);
    if (lastDup && lastDup.message === message && now - lastDup.timestamp < DUPLICATE_WINDOW_MS) {
      return null; // suppressed
    }
    this._duplicateTracker.set(dupKey, { message, timestamp: now });

    /* ── Build entry ────────────────────────────────────────────────────── */
    const classified = this.classifyError(error, severity);
    /** @type {ErrorEntry} */
    const entry = {
      id: `err_${++this._idCounter}`,
      error,
      message,
      severity: classified,
      system,
      context,
      timestamp: now,
      stack,
    };

    /* ── Bounded FIFO ───────────────────────────────────────────────────── */
    this._errors.push(entry);
    if (this._errors.length > MAX_ERROR_HISTORY) {
      this._errors.shift();
    }

    /* ── Storm detection ────────────────────────────────────────────────── */
    if (!this._stormTracker.has(system)) {
      this._stormTracker.set(system, []);
    }
    const timestamps = this._stormTracker.get(system);
    timestamps.push(now);
    // Prune timestamps outside the window
    while (timestamps.length && timestamps[0] < now - STORM_WINDOW_MS) {
      timestamps.shift();
    }
    if (timestamps.length >= STORM_THRESHOLD) {
      this.emit('error-storm', { system, count: timestamps.length, window: STORM_WINDOW_MS });
    }

    /* ── Emit generic error event ───────────────────────────────────────── */
    this.emit('error', entry);

    return entry;
  }

  /* ══════════════════════════════════════════════════════════════════════════
   * 3. ERROR HANDLERS – retry, fallback, circuit breaker, graceful degrade
   * ══════════════════════════════════════════════════════════════════════════ */

  /**
   * Retry an async function with exponential back-off.
   *
   * @param {Function} fn           - Async function to execute.
   * @param {number}   [maxRetries=3] - Maximum number of retry attempts.
   * @param {number}   [backoffMs=500] - Initial back-off delay in ms.
   * @param {string}   [context='retry'] - Context label for error recording.
   * @returns {Promise<*>} Resolved value of `fn`.
   * @throws {Error} After all retries are exhausted.
   */
  async retry(fn, maxRetries = 3, backoffMs = 500, context = 'retry') {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        this.recordError(err, context, `Attempt ${attempt + 1}/${maxRetries + 1}`, 'MEDIUM');
        if (attempt < maxRetries) {
          const delay = backoffMs * Math.pow(2, attempt);
          await this._sleep(delay);
        }
      }
    }
    throw lastError;
  }

  /**
   * Execute a primary function; on failure fall back to a secondary function.
   *
   * @param {Function} primaryFn  - Primary async function.
   * @param {Function} fallbackFn - Fallback async function.
   * @param {string}   [context='fallback'] - Context label.
   * @returns {Promise<*>}
   */
  async fallback(primaryFn, fallbackFn, context = 'fallback') {
    try {
      return await primaryFn();
    } catch (primaryErr) {
      this.recordError(primaryErr, context, 'Primary failed – invoking fallback', 'HIGH');
      try {
        return await fallbackFn();
      } catch (fallbackErr) {
        this.recordError(fallbackErr, context, 'Fallback also failed', 'CRITICAL');
        throw fallbackErr;
      }
    }
  }

  /**
   * Execute a function through a circuit breaker.
   *
   * The circuit opens after `threshold` consecutive failures and remains open
   * for `cooldownMs` before allowing a single half-open probe.
   *
   * @param {string}   operation              - Unique name for this operation.
   * @param {Function} fn                     - Async function to protect.
   * @param {object}   [options]              - Configuration.
   * @param {number}   [options.threshold=5]  - Failures before opening.
   * @param {number}   [options.cooldownMs=30000] - Cooldown in ms.
   * @returns {Promise<*>}
   * @throws {Error} When the circuit is open and cooldown has not elapsed.
   */
  async circuitBreaker(operation, fn, options = {}) {
    const threshold = options.threshold ?? DEFAULT_CIRCUIT_THRESHOLD;
    const cooldownMs = options.cooldownMs ?? DEFAULT_CIRCUIT_COOLDOWN_MS;

    if (!this._circuits.has(operation)) {
      this._circuits.set(operation, {
        failures: 0,
        open: false,
        lastFailure: 0,
        nextRetryAt: 0,
      });
    }

    const state = this._circuits.get(operation);

    /* ── Circuit is OPEN ────────────────────────────────────────────────── */
    if (state.open) {
      const now = Date.now();
      if (now < state.nextRetryAt) {
        const err = new Error(`Circuit breaker OPEN for "${operation}" – retry after ${new Date(state.nextRetryAt).toISOString()}`);
        this.recordError(err, operation, 'Circuit open – request rejected', 'HIGH');
        throw err;
      }
      // Half-open probe
    }

    /* ── Execute ────────────────────────────────────────────────────────── */
    try {
      const result = await fn();
      // Success – reset circuit
      if (state.open) {
        state.open = false;
        this.emit('circuit-close', { operation });
      }
      state.failures = 0;
      return result;
    } catch (err) {
      state.failures++;
      state.lastFailure = Date.now();

      if (state.failures >= threshold && !state.open) {
        state.open = true;
        state.nextRetryAt = Date.now() + cooldownMs;
        this.emit('circuit-open', { operation, failures: state.failures });
      }

      this.recordError(err, operation, `Circuit failure #${state.failures}`, 'HIGH');
      throw err;
    }
  }

  /**
   * Execute a function and return a safe default if it throws.
   *
   * @param {Function} fn                - Function to execute (sync or async).
   * @param {*}        degradedResult    - Value to return on failure.
   * @param {string}   [context='gracefulDegrade'] - Context label.
   * @returns {Promise<*>} Result of `fn` or `degradedResult`.
   */
  async gracefulDegrade(fn, degradedResult, context = 'gracefulDegrade') {
    try {
      return await fn();
    } catch (err) {
      this.recordError(err, context, 'Degraded to safe default', 'LOW');
      return degradedResult;
    }
  }

  /* ══════════════════════════════════════════════════════════════════════════
   * 4. ERROR REPORTING
   * ══════════════════════════════════════════════════════════════════════════ */

  /**
   * Generate a comprehensive error report.
   *
   * @returns {{
   *   totalErrors: number,
   *   bySeverity: Record<ErrorSeverity, number>,
   *   bySystem: Record<string, number>,
   *   topErrors: {message: string, count: number}[],
   *   circuitBreakers: {operation: string, state: CircuitState}[],
   *   oldestTimestamp: number|null,
   *   newestTimestamp: number|null
   * }}
   */
  getErrorReport() {
    const bySeverity = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
    /** @type {Record<string, number>} */
    const bySystem = {};
    /** @type {Record<string, number>} */
    const msgFreq = {};

    for (const entry of this._errors) {
      bySeverity[entry.severity] = (bySeverity[entry.severity] || 0) + 1;
      bySystem[entry.system] = (bySystem[entry.system] || 0) + 1;
      msgFreq[entry.message] = (msgFreq[entry.message] || 0) + 1;
    }

    const topErrors = Object.entries(msgFreq)
      .map(([message, count]) => ({ message, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const circuitBreakers = [];
    for (const [operation, state] of this._circuits.entries()) {
      circuitBreakers.push({ operation, state: { ...state } });
    }

    return {
      totalErrors: this._errors.length,
      bySeverity,
      bySystem,
      topErrors,
      circuitBreakers,
      oldestTimestamp: this._errors.length ? this._errors[0].timestamp : null,
      newestTimestamp: this._errors.length ? this._errors[this._errors.length - 1].timestamp : null,
    };
  }

  /**
   * Retrieve all recorded errors originating from a specific system.
   *
   * @param {string} systemName - The system name to filter by.
   * @returns {ErrorEntry[]}
   */
  getErrorsBySystem(systemName) {
    return this._errors.filter((e) => e.system === systemName);
  }

  /**
   * Analyse error-rate trends over a number of recent hours.
   *
   * Returns hourly buckets with counts per severity so callers can
   * visualise whether error rates are rising or falling.
   *
   * @param {number} [hours=24] - How many hours of history to analyse.
   * @returns {{
   *   windowHours: number,
   *   buckets: {hour: string, total: number, bySeverity: Record<ErrorSeverity, number>}[],
   *   trend: 'rising'|'falling'|'stable'|'insufficient_data'
   * }}
   */
  getErrorTrends(hours = 24) {
    const now = Date.now();
    const windowStart = now - hours * 3_600_000;

    const relevant = this._errors.filter((e) => e.timestamp >= windowStart);

    /** @type {Map<string, {total: number, bySeverity: Record<ErrorSeverity, number>}>} */
    const bucketMap = new Map();

    // Pre-create empty buckets for every hour in the window
    for (let h = 0; h < hours; h++) {
      const bucketTime = new Date(windowStart + h * 3_600_000);
      const key = bucketTime.toISOString().slice(0, 13); // YYYY-MM-DDTHH
      bucketMap.set(key, { total: 0, bySeverity: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 } });
    }

    for (const entry of relevant) {
      const key = new Date(entry.timestamp).toISOString().slice(0, 13);
      if (!bucketMap.has(key)) {
        bucketMap.set(key, { total: 0, bySeverity: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 } });
      }
      const bucket = bucketMap.get(key);
      bucket.total++;
      bucket.bySeverity[entry.severity] = (bucket.bySeverity[entry.severity] || 0) + 1;
    }

    const buckets = Array.from(bucketMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([hour, data]) => ({ hour, ...data }));

    // Simple linear trend: compare first half average to second half average
    let trend = 'insufficient_data';
    if (buckets.length >= 4) {
      const mid = Math.floor(buckets.length / 2);
      const firstHalfAvg = buckets.slice(0, mid).reduce((s, b) => s + b.total, 0) / mid;
      const secondHalfAvg = buckets.slice(mid).reduce((s, b) => s + b.total, 0) / (buckets.length - mid);
      if (secondHalfAvg > firstHalfAvg * 1.25) trend = 'rising';
      else if (secondHalfAvg < firstHalfAvg * 0.75) trend = 'falling';
      else trend = 'stable';
    }

    return { windowHours: hours, buckets, trend };
  }

  /* ══════════════════════════════════════════════════════════════════════════
   * 5. ERROR WRAPPING – utilities for replacing empty catch blocks
   * ══════════════════════════════════════════════════════════════════════════ */

  /**
   * Wrap an **async** function with centralised error handling.
   *
   * Usage:
   * ```js
   * const safeFetch = middleware.wrapAsync(
   *   () => fetch(url),
   *   'HttpClient',
   *   'HIGH'
   * );
   * const data = await safeFetch();
   * ```
   *
   * @param {Function}      fn                - Async function to wrap.
   * @param {string}        [context='async'] - Context / system label.
   * @param {ErrorSeverity} [severity]        - Severity override.
   * @returns {Function} A new async function that records errors on failure.
   */
  wrapAsync(fn, context = 'async', severity) {
    const self = this;
    return async function wrappedAsync(...args) {
      try {
        return await fn.apply(this, args);
      } catch (err) {
        self.recordError(err, context, `wrapAsync(${fn.name || 'anonymous'})`, severity);
        throw err;
      }
    };
  }

  /**
   * Wrap a **synchronous** function with centralised error handling.
   *
   * @param {Function}      fn                - Sync function to wrap.
   * @param {string}        [context='sync']  - Context / system label.
   * @param {ErrorSeverity} [severity]        - Severity override.
   * @returns {Function} A new function that records errors on failure.
   */
  wrapSync(fn, context = 'sync', severity) {
    const self = this;
    return function wrappedSync(...args) {
      try {
        return fn.apply(this, args);
      } catch (err) {
        self.recordError(err, context, `wrapSync(${fn.name || 'anonymous'})`, severity);
        throw err;
      }
    };
  }

  /**
   * Create a **bound handler** for a specific sub-system.
   *
   * Returns an object whose methods are pre-bound to the system name so
   * callers don't need to repeat it on every call.
   *
   * Usage:
   * ```js
   * const handler = middleware.createHandler('EnergyModule');
   * await handler.wrapAsync(myFunc)();
   * await handler.retry(myFunc, 3);
   * await handler.gracefulDegrade(myFunc, defaultValue);
   * handler.record(error, 'optional extra context');
   * ```
   *
   * @param {string} systemName - Name of the sub-system.
   * @returns {{
   *   record: (error: Error|string, context?: string, severity?: ErrorSeverity) => ErrorEntry|null,
   *   wrapAsync: (fn: Function, severity?: ErrorSeverity) => Function,
   *   wrapSync: (fn: Function, severity?: ErrorSeverity) => Function,
   *   retry: (fn: Function, maxRetries?: number, backoffMs?: number) => Promise<*>,
   *   fallback: (primaryFn: Function, fallbackFn: Function) => Promise<*>,
   *   circuitBreaker: (operation: string, fn: Function, options?: object) => Promise<*>,
   *   gracefulDegrade: (fn: Function, degradedResult: *) => Promise<*>,
   *   getErrors: () => ErrorEntry[]
   * }}
   */
  createHandler(systemName) {
    return {
      record: (error, context = '', severity) =>
        this.recordError(error, systemName, context, severity),

      wrapAsync: (fn, severity) =>
        this.wrapAsync(fn, systemName, severity),

      wrapSync: (fn, severity) =>
        this.wrapSync(fn, systemName, severity),

      retry: (fn, maxRetries, backoffMs) =>
        this.retry(fn, maxRetries, backoffMs, systemName),

      fallback: (primaryFn, fallbackFn) =>
        this.fallback(primaryFn, fallbackFn, systemName),

      circuitBreaker: (operation, fn, options) =>
        this.circuitBreaker(`${systemName}:${operation}`, fn, options),

      gracefulDegrade: (fn, degradedResult) =>
        this.gracefulDegrade(fn, degradedResult, systemName),

      getErrors: () =>
        this.getErrorsBySystem(systemName),
    };
  }

  /* ══════════════════════════════════════════════════════════════════════════
   * 6. ADMINISTRATIVE HELPERS
   * ══════════════════════════════════════════════════════════════════════════ */

  /**
   * Clear all recorded errors and reset trackers.
   * Useful for tests or after a successful recovery cycle.
   */
  clearErrors() {
    this._errors = [];
    this._stormTracker.clear();
    this._duplicateTracker.clear();
    this._idCounter = 0;
  }

  /**
   * Reset a specific circuit breaker to closed state.
   *
   * @param {string} operation - The operation name.
   * @returns {boolean} `true` if the circuit existed and was reset.
   */
  resetCircuit(operation) {
    const state = this._circuits.get(operation);
    if (!state) return false;

    const wasOpen = state.open;
    state.failures = 0;
    state.open = false;
    state.lastFailure = 0;
    state.nextRetryAt = 0;

    if (wasOpen) {
      this.emit('circuit-close', { operation, reason: 'manual-reset' });
    }
    return true;
  }

  /**
   * Reset all circuit breakers to closed state.
   */
  resetAllCircuits() {
    for (const operation of this._circuits.keys()) {
      this.resetCircuit(operation);
    }
  }

  /**
   * Return a human-readable summary string suitable for logging.
   *
   * @returns {string}
   */
  getSummary() {
    const report = this.getErrorReport();
    const lines = [
      `── Error Handling Middleware Summary ──`,
      `Total errors recorded : ${report.totalErrors}`,
      `  CRITICAL : ${report.bySeverity.CRITICAL}`,
      `  HIGH     : ${report.bySeverity.HIGH}`,
      `  MEDIUM   : ${report.bySeverity.MEDIUM}`,
      `  LOW      : ${report.bySeverity.LOW}`,
      `  INFO     : ${report.bySeverity.INFO}`,
      ``,
      `Systems reporting errors: ${Object.keys(report.bySystem).length}`,
    ];

    for (const [sys, count] of Object.entries(report.bySystem)) {
      lines.push(`  ${sys}: ${count}`);
    }

    if (report.circuitBreakers.length) {
      lines.push('', 'Circuit breakers:');
      for (const cb of report.circuitBreakers) {
        lines.push(`  ${cb.operation}: ${cb.state.open ? 'OPEN' : 'CLOSED'} (failures: ${cb.state.failures})`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Destroy the singleton – primarily for testing.
   */
  static destroyInstance() {
    if (ErrorHandlingMiddleware._instance) {
      ErrorHandlingMiddleware._instance.removeAllListeners();
      ErrorHandlingMiddleware._instance = null;
    }
  }

  /* ══════════════════════════════════════════════════════════════════════════
   * INTERNAL UTILITIES
   * ══════════════════════════════════════════════════════════════════════════ */

  /**
   * Promise-based sleep helper.
   *
   * @param {number} ms - Milliseconds to wait.
   * @returns {Promise<void>}
   * @private
   */
  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/* ── Export ────────────────────────────────────────────────────────────────── */
module.exports = ErrorHandlingMiddleware;
