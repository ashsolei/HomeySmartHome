'use strict';

const EventEmitter = require('events');

/**
 * @typedef {'normal'|'warning'|'critical'|'emergency'} MemoryPressureLevel
 */

/**
 * @typedef {Object} MemoryThresholds
 * @property {number} warning  - Fraction of heap limit triggering WARNING  (default 0.70)
 * @property {number} critical - Fraction of heap limit triggering CRITICAL (default 0.85)
 * @property {number} emergency - Fraction of heap limit triggering EMERGENCY (default 0.95)
 */

/**
 * @typedef {Object} IntervalEntry
 * @property {string}      id          - Unique identifier for the interval
 * @property {NodeJS.Timeout} ref      - The interval reference returned by setInterval
 * @property {string}      owner       - Name of the owning system / module
 * @property {string}      description - Human-readable description
 * @property {number}      registeredAt - Timestamp (ms) when the interval was registered
 */

/**
 * @typedef {Object} MemorySample
 * @property {number} timestamp   - Date.now() when the sample was taken
 * @property {number} heapUsed    - Bytes of heap currently in use
 * @property {number} heapTotal   - Total heap allocated by V8
 * @property {number} rss         - Resident set size in bytes
 * @property {number} external    - Bytes of C++ objects bound to JS objects
 * @property {MemoryPressureLevel} level - Pressure level at sample time
 */

/**
 * @typedef {Object} MemoryReport
 * @property {MemorySample}        current        - Most recent memory sample
 * @property {MemoryPressureLevel} level          - Current pressure level
 * @property {number}              growthRateMBpm - Heap growth rate in MB/minute
 * @property {number}              sampleCount    - Number of stored history samples
 * @property {MemorySample[]}      history        - Recent memory samples
 * @property {string[]}            alerts         - Active alert messages
 * @property {number}              activeIntervals - Count of registered intervals
 * @property {boolean}             leakSuspected  - Whether a leak is currently suspected
 */

/**
 * @typedef {Object} IntervalReport
 * @property {number} total   - Total registered intervals
 * @property {Object[]} intervals - Details for every registered interval
 * @property {Object<string,number>} byOwner - Count of intervals grouped by owner
 */

// ---------------------------------------------------------------------------
// Bounded Collection Helpers
// ---------------------------------------------------------------------------

/**
 * Create an array-like structure that automatically evicts the oldest entry
 * when `maxSize` is exceeded.  Tracks total overflow count.
 *
 * @param {number} maxSize - Maximum number of elements to retain.
 * @returns {{ items: any[], push: Function, clear: Function, overflowCount: number, maxSize: number }}
 *
 * @example
 *   const buf = MemoryGuardSystem.BoundedArray(100);
 *   buf.push({ ts: Date.now(), value: 42 });
 */
function BoundedArray(maxSize = 1000) {
  const store = {
    items: [],
    maxSize,
    overflowCount: 0,

    /**
     * Append a value, evicting the oldest when the limit is reached.
     * @param {*} value
     */
    push(value) {
      if (store.items.length >= store.maxSize) {
        store.items.shift();
        store.overflowCount++;
      }
      store.items.push(value);
    },

    /** Remove all items and reset overflow counter. */
    clear() {
      store.items.length = 0;
      store.overflowCount = 0;
    },

    /** @returns {number} Current number of items. */
    get length() {
      return store.items.length;
    },
  };

  return store;
}

/**
 * Create a Map wrapper that auto-evicts the oldest entry when `maxSize` is
 * exceeded.  Iteration order of the underlying Map provides insertion order.
 *
 * @param {number} maxSize - Maximum number of entries.
 * @returns {{ map: Map, set: Function, get: Function, delete: Function, has: Function, clear: Function, size: number, maxSize: number, overflowCount: number }}
 *
 * @example
 *   const cache = MemoryGuardSystem.BoundedMap(500);
 *   cache.set('sensor:temp', 21.5);
 */
function BoundedMap(maxSize = 1000) {
  const inner = new Map();
  const store = {
    map: inner,
    maxSize,
    overflowCount: 0,

    /**
     * Set a key/value pair, evicting the oldest entry if at capacity.
     * @param {*} key
     * @param {*} value
     */
    set(key, value) {
      if (inner.has(key)) {
        inner.delete(key); // refresh insertion order
      } else if (inner.size >= store.maxSize) {
        const oldest = inner.keys().next().value;
        inner.delete(oldest);
        store.overflowCount++;
      }
      inner.set(key, value);
    },

    /** @param {*} key @returns {*} */
    get(key) {
      return inner.get(key);
    },

    /** @param {*} key @returns {boolean} */
    has(key) {
      return inner.has(key);
    },

    /** @param {*} key @returns {boolean} */
    delete(key) {
      return inner.delete(key);
    },

    /** Remove all entries. */
    clear() {
      inner.clear();
      store.overflowCount = 0;
    },

    /** @returns {number} */
    get size() {
      return inner.size;
    },
  };

  return store;
}

/**
 * Create a Set wrapper that auto-evicts the oldest entry when `maxSize` is
 * exceeded.
 *
 * @param {number} maxSize - Maximum number of values.
 * @returns {{ set: Set, add: Function, delete: Function, has: Function, clear: Function, size: number, maxSize: number, overflowCount: number }}
 *
 * @example
 *   const seen = MemoryGuardSystem.BoundedSet(200);
 *   seen.add(deviceId);
 */
function BoundedSet(maxSize = 1000) {
  const inner = new Set();
  const store = {
    set: inner,
    maxSize,
    overflowCount: 0,

    /**
     * Add a value, evicting the oldest if at capacity.
     * @param {*} value
     */
    add(value) {
      if (inner.has(value)) return;
      if (inner.size >= store.maxSize) {
        const oldest = inner.values().next().value;
        inner.delete(oldest);
        store.overflowCount++;
      }
      inner.add(value);
    },

    /** @param {*} value @returns {boolean} */
    has(value) {
      return inner.has(value);
    },

    /** @param {*} value @returns {boolean} */
    delete(value) {
      return inner.delete(value);
    },

    /** Remove all values. */
    clear() {
      inner.clear();
      store.overflowCount = 0;
    },

    /** @returns {number} */
    get size() {
      return inner.size;
    },
  };

  return store;
}

// ---------------------------------------------------------------------------
// MemoryGuardSystem
// ---------------------------------------------------------------------------

/** Maximum number of memory-history samples to keep (1 hour at 30 s intervals). */
const MAX_HISTORY_SAMPLES = 120;

/** Default sampling interval in milliseconds (30 seconds). */
const DEFAULT_SAMPLE_INTERVAL_MS = 30_000;

/** Minutes of consistent growth before declaring a probable leak. */
const LEAK_DETECTION_WINDOW_MIN = 10;

/**
 * MemoryGuardSystem – central memory-management guard for the Homey Smart Home
 * platform.
 *
 * Responsibilities:
 *  • Periodically sample `process.memoryUsage()` and evaluate pressure levels.
 *  • Provide bounded-collection utilities to replace unbounded `.push()` sites.
 *  • Maintain a global registry of `setInterval` references so every interval
 *    can be inspected, stopped per-owner, or emergency-cleared.
 *  • Detect probable memory leaks by analysing sustained heap growth.
 *  • Orchestrate graduated pressure responses (warn → cache-clear → emergency).
 *
 * @extends EventEmitter
 * @fires MemoryGuardSystem#memory-warning
 * @fires MemoryGuardSystem#memory-critical
 * @fires MemoryGuardSystem#memory-emergency
 * @fires MemoryGuardSystem#leak-detected
 * @fires MemoryGuardSystem#interval-registered
 * @fires MemoryGuardSystem#interval-cleared
 */
class MemoryGuardSystem extends EventEmitter {
  /**
   * @param {Object}           [options]
   * @param {MemoryThresholds} [options.thresholds]       - Custom threshold overrides
   * @param {number}           [options.sampleIntervalMs] - Sampling period in ms
   * @param {number}           [options.maxHistorySamples] - Max retained samples
   * @param {Object|null}      [options.homey]            - Homey instance reference
   */
  constructor(options = {}) {
    super();

    /** @private */
    this._thresholds = Object.assign(
      { warning: 0.70, critical: 0.85, emergency: 0.95 },
      options.thresholds,
    );

    /** @private */
    this._sampleIntervalMs = options.sampleIntervalMs || DEFAULT_SAMPLE_INTERVAL_MS;

    /** @private */
    this._maxHistorySamples = options.maxHistorySamples || MAX_HISTORY_SAMPLES;

    /** @private @type {MemorySample[]} */
    this._history = [];

    /** @private @type {MemoryPressureLevel} */
    this._currentLevel = 'normal';

    /** @private @type {Map<string, IntervalEntry>} */
    this._intervals = new Map();

    /** @private */
    this._samplerRef = null;

    /** @private */
    this._leakSuspected = false;

    /** @private */
    this._consecutiveGrowthSamples = 0;

    /** @private – number of consecutive growth samples before leak alert */
    this._leakThresholdSamples = Math.ceil(
      (LEAK_DETECTION_WINDOW_MIN * 60_000) / this._sampleIntervalMs,
    );

    /** @private */
    this._alerts = [];

    /** @private */
    this._homey = options.homey || null;

    /** @private */
    this._emergencyModeActive = false;

    /** @private – cache-manager reference, lazily resolved */
    this._cacheManager = null;

    this._startSampler();
    this._log('MemoryGuardSystem initialised', {
      thresholds: this._thresholds,
      sampleIntervalMs: this._sampleIntervalMs,
    });
  }

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  /** @private @type {MemoryGuardSystem|null} */
  static _instance = null;

  /**
   * Retrieve (or create) the singleton instance.
   *
   * @param {Object} [options] - Constructor options (used only on first call).
   * @returns {MemoryGuardSystem}
   */
  static getInstance(options) {
    if (!MemoryGuardSystem._instance) {
      MemoryGuardSystem._instance = new MemoryGuardSystem(options);
    }
    return MemoryGuardSystem._instance;
  }

  /**
   * Destroy the singleton (useful for testing or full shutdown).
   */
  static destroyInstance() {
    if (MemoryGuardSystem._instance) {
      MemoryGuardSystem._instance.destroy();
      MemoryGuardSystem._instance = null;
    }
  }

  // -----------------------------------------------------------------------
  // Static collection helpers (convenience re-exports)
  // -----------------------------------------------------------------------

  /** @see BoundedArray */
  static BoundedArray = BoundedArray;

  /** @see BoundedMap */
  static BoundedMap = BoundedMap;

  /** @see BoundedSet */
  static BoundedSet = BoundedSet;

  // -----------------------------------------------------------------------
  // Memory sampling & pressure evaluation
  // -----------------------------------------------------------------------

  /**
   * Start the periodic memory sampler.
   * @private
   */
  _startSampler() {
    if (this._samplerRef) return;
    // Take an initial sample immediately
    this._takeSample();
    this._samplerRef = setInterval(() => this._takeSample(), this._sampleIntervalMs);
    // Allow the process to exit even if the sampler is still running
    if (this._samplerRef && typeof this._samplerRef.unref === 'function') {
      this._samplerRef.unref();
    }
  }

  /**
   * Record a single memory sample and evaluate pressure.
   * @private
   */
  _takeSample() {
    const mem = process.memoryUsage();
    const level = this._evaluateLevel(mem);

    /** @type {MemorySample} */
    const sample = {
      timestamp: Date.now(),
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      rss: mem.rss,
      external: mem.external,
      level,
    };

    // Bounded history
    if (this._history.length >= this._maxHistorySamples) {
      this._history.shift();
    }
    this._history.push(sample);

    // Detect transitions
    const previousLevel = this._currentLevel;
    this._currentLevel = level;

    if (level !== 'normal' && level !== previousLevel) {
      this._handlePressureTransition(level, sample);
    }

    // Leak detection
    this._updateLeakDetection(sample);
  }

  /**
   * Map current heap usage to a pressure level.
   *
   * @param {NodeJS.MemoryUsage} mem
   * @returns {MemoryPressureLevel}
   * @private
   */
  _evaluateLevel(mem) {
    // v8.getHeapStatistics() could give heap_size_limit, but heapTotal is a
    // reasonable proxy that doesn't require the v8 module.
    const ratio = mem.heapUsed / (mem.heapTotal || 1);
    if (ratio >= this._thresholds.emergency) return 'emergency';
    if (ratio >= this._thresholds.critical) return 'critical';
    if (ratio >= this._thresholds.warning) return 'warning';
    return 'normal';
  }

  /**
   * React to a pressure-level change.
   *
   * @param {MemoryPressureLevel} level
   * @param {MemorySample}        sample
   * @private
   */
  _handlePressureTransition(level, sample) {
    const mbUsed = (sample.heapUsed / 1_048_576).toFixed(1);
    const mbTotal = (sample.heapTotal / 1_048_576).toFixed(1);
    const pct = ((sample.heapUsed / (sample.heapTotal || 1)) * 100).toFixed(1);

    const detail = { level, heapUsedMB: mbUsed, heapTotalMB: mbTotal, pct };

    switch (level) {
      case 'warning':
        this._addAlert(`Memory WARNING: ${mbUsed} MB / ${mbTotal} MB (${pct}%)`);
        this._log('Memory pressure WARNING', detail);
        this.emit('memory-warning', detail);
        this._suggestGC();
        break;

      case 'critical':
        this._addAlert(`Memory CRITICAL: ${mbUsed} MB / ${mbTotal} MB (${pct}%)`);
        this._log('Memory pressure CRITICAL – clearing caches', detail);
        this.emit('memory-critical', detail);
        this._clearCaches();
        this._forceGC();
        break;

      case 'emergency':
        this._addAlert(`Memory EMERGENCY: ${mbUsed} MB / ${mbTotal} MB (${pct}%)`);
        this._log('Memory EMERGENCY – disabling non-critical systems', detail);
        this._emergencyModeActive = true;
        this.emit('memory-emergency', detail);
        this._emergencyResponse();
        break;

      default:
        break;
    }
  }

  // -----------------------------------------------------------------------
  // Pressure response helpers
  // -----------------------------------------------------------------------

  /**
   * Suggest a garbage-collection cycle (logged only; no forced GC).
   * @private
   */
  _suggestGC() {
    this._log('Suggesting garbage collection – expose --expose-gc for forced GC');
  }

  /**
   * Attempt to force a V8 garbage-collection cycle if `global.gc` is available
   * (requires `--expose-gc` flag).
   * @private
   */
  _forceGC() {
    if (typeof global.gc === 'function') {
      this._log('Forcing garbage collection');
      global.gc();
    }
  }

  /**
   * Ask the CentralizedCacheManager (if available) to flush all caches.
   * @private
   */
  _clearCaches() {
    try {
      if (!this._cacheManager) {
        // Lazy-require to avoid circular deps
        try {
          const CentralizedCacheManager = require('./CentralizedCacheManager');
          this._cacheManager =
            typeof CentralizedCacheManager.getInstance === 'function'
              ? CentralizedCacheManager.getInstance()
              : null;
        } catch (_) {
          /* CentralizedCacheManager may not exist yet */
        }
      }
      if (this._cacheManager && typeof this._cacheManager.clearAll === 'function') {
        this._cacheManager.clearAll();
        this._log('All caches cleared via CentralizedCacheManager');
      }
    } catch (err) {
      this._log('Failed to clear caches', { error: err.message });
    }
  }

  /**
   * Emergency response: clear history arrays, force GC, and attempt to disable
   * non-critical intervals.
   * @private
   */
  _emergencyResponse() {
    // 1. Trim own history to a bare minimum
    while (this._history.length > 10) {
      this._history.shift();
    }

    // 2. Clear all caches
    this._clearCaches();

    // 3. Force GC
    this._forceGC();

    // 4. Log active intervals so the operator can investigate
    this._log('Emergency – active intervals snapshot', {
      count: this._intervals.size,
      owners: this._getIntervalCountsByOwner(),
    });
  }

  // -----------------------------------------------------------------------
  // Leak detection
  // -----------------------------------------------------------------------

  /**
   * Track whether heap is consistently growing.
   *
   * @param {MemorySample} sample
   * @private
   */
  _updateLeakDetection(sample) {
    if (this._history.length < 2) return;

    const prev = this._history[this._history.length - 2];
    if (sample.heapUsed > prev.heapUsed) {
      this._consecutiveGrowthSamples++;
    } else {
      this._consecutiveGrowthSamples = 0;
      if (this._leakSuspected) {
        this._leakSuspected = false;
        this._log('Heap growth stabilised – leak suspicion cleared');
      }
    }

    if (
      !this._leakSuspected &&
      this._consecutiveGrowthSamples >= this._leakThresholdSamples
    ) {
      this._leakSuspected = true;
      const report = this._buildLeakReport();
      this._addAlert('Probable memory leak detected – consistent heap growth');
      this._log('Probable memory leak detected', report);
      this.emit('leak-detected', report);
    }
  }

  /**
   * Build a diagnostic report for a suspected leak.
   *
   * @returns {Object}
   * @private
   */
  _buildLeakReport() {
    const growthRate = this._calculateGrowthRate();
    return {
      growthRateMBpm: growthRate,
      consecutiveGrowthSamples: this._consecutiveGrowthSamples,
      windowMinutes: (
        (this._consecutiveGrowthSamples * this._sampleIntervalMs) /
        60_000
      ).toFixed(1),
      intervalsByOwner: this._getIntervalCountsByOwner(),
      totalIntervals: this._intervals.size,
    };
  }

  /**
   * Calculate the heap growth rate in megabytes per minute over the stored
   * history window.
   *
   * @returns {number} Growth rate in MB/min (negative means shrinking).
   */
  _calculateGrowthRate() {
    if (this._history.length < 2) return 0;

    const first = this._history[0];
    const last = this._history[this._history.length - 1];
    const elapsedMin = (last.timestamp - first.timestamp) / 60_000;

    if (elapsedMin <= 0) return 0;

    const deltaBytes = last.heapUsed - first.heapUsed;
    return +(deltaBytes / 1_048_576 / elapsedMin).toFixed(3);
  }

  // -----------------------------------------------------------------------
  // Interval registry
  // -----------------------------------------------------------------------

  /**
   * Register a `setInterval` reference so it can be tracked and managed
   * globally.
   *
   * @param {string}         id          - Unique identifier (e.g. "EnergyForecasting:refresh")
   * @param {NodeJS.Timeout} intervalRef - Return value of `setInterval()`
   * @param {string}         owner       - Owning system name (e.g. "EnergyForecastingEngine")
   * @param {string}         [description=''] - Human-readable description
   * @returns {void}
   */
  registerInterval(id, intervalRef, owner, description = '') {
    if (this._intervals.has(id)) {
      this._log(`Interval "${id}" already registered – replacing`, { owner });
      clearInterval(this._intervals.get(id).ref);
    }

    /** @type {IntervalEntry} */
    const entry = {
      id,
      ref: intervalRef,
      owner,
      description,
      registeredAt: Date.now(),
    };

    this._intervals.set(id, entry);
    this.emit('interval-registered', { id, owner, description });
  }

  /**
   * Stop and remove a single registered interval.
   *
   * @param {string} id - The interval identifier.
   * @returns {boolean} `true` if the interval existed and was cleared.
   */
  unregisterInterval(id) {
    const entry = this._intervals.get(id);
    if (!entry) return false;

    clearInterval(entry.ref);
    this._intervals.delete(id);
    this.emit('interval-cleared', { id, owner: entry.owner });
    return true;
  }

  /**
   * List all currently registered intervals.
   *
   * @returns {IntervalEntry[]}
   */
  getActiveIntervals() {
    return Array.from(this._intervals.values()).map((e) => ({
      id: e.id,
      owner: e.owner,
      description: e.description,
      registeredAt: e.registeredAt,
      runtimeMs: Date.now() - e.registeredAt,
    }));
  }

  /**
   * Emergency-stop **all** registered intervals.
   *
   * @returns {number} Number of intervals that were cleared.
   */
  clearAll() {
    const count = this._intervals.size;
    for (const [id, entry] of this._intervals) {
      clearInterval(entry.ref);
      this.emit('interval-cleared', { id, owner: entry.owner });
    }
    this._intervals.clear();
    this._log(`Cleared all ${count} intervals`);
    return count;
  }

  /**
   * Stop all intervals owned by a specific system.
   *
   * @param {string} ownerName - Owner identifier to match.
   * @returns {number} Number of intervals cleared.
   */
  clearByOwner(ownerName) {
    let cleared = 0;
    for (const [id, entry] of this._intervals) {
      if (entry.owner === ownerName) {
        clearInterval(entry.ref);
        this._intervals.delete(id);
        this.emit('interval-cleared', { id, owner: ownerName });
        cleared++;
      }
    }
    if (cleared > 0) {
      this._log(`Cleared ${cleared} interval(s) for owner "${ownerName}"`);
    }
    return cleared;
  }

  /**
   * Detect intervals whose owner string does not correspond to a currently
   * loaded module / class.  Uses a caller-supplied set of known-alive owners.
   *
   * @param {Set<string>|string[]} aliveOwners - Names of owners still active.
   * @returns {IntervalEntry[]} Orphaned interval entries.
   */
  detectOrphanedIntervals(aliveOwners) {
    const alive = aliveOwners instanceof Set ? aliveOwners : new Set(aliveOwners);
    const orphans = [];
    for (const entry of this._intervals.values()) {
      if (!alive.has(entry.owner)) {
        orphans.push({ ...entry, ref: '[interval ref]' });
      }
    }
    if (orphans.length > 0) {
      this._log(`Detected ${orphans.length} orphaned interval(s)`, {
        orphans: orphans.map((o) => o.id),
      });
    }
    return orphans;
  }

  // -----------------------------------------------------------------------
  // Health reporting
  // -----------------------------------------------------------------------

  /**
   * Generate a comprehensive memory report.
   *
   * @returns {MemoryReport}
   */
  getMemoryReport() {
    const current =
      this._history.length > 0
        ? this._history[this._history.length - 1]
        : this._buildCurrentSample();

    return {
      current,
      level: this._currentLevel,
      growthRateMBpm: this._calculateGrowthRate(),
      sampleCount: this._history.length,
      history: [...this._history],
      alerts: [...this._alerts],
      activeIntervals: this._intervals.size,
      leakSuspected: this._leakSuspected,
      emergencyMode: this._emergencyModeActive,
    };
  }

  /**
   * Generate a report of all registered intervals.
   *
   * @returns {IntervalReport}
   */
  getIntervalReport() {
    const intervals = this.getActiveIntervals();
    return {
      total: intervals.length,
      intervals,
      byOwner: this._getIntervalCountsByOwner(),
    };
  }

  /**
   * Quick snapshot without history (low-cost).
   *
   * @returns {{ heapUsedMB: string, heapTotalMB: string, rssMB: string, level: MemoryPressureLevel, intervals: number, leakSuspected: boolean }}
   */
  getSnapshot() {
    const mem = process.memoryUsage();
    return {
      heapUsedMB: (mem.heapUsed / 1_048_576).toFixed(1),
      heapTotalMB: (mem.heapTotal / 1_048_576).toFixed(1),
      rssMB: (mem.rss / 1_048_576).toFixed(1),
      level: this._currentLevel,
      intervals: this._intervals.size,
      leakSuspected: this._leakSuspected,
    };
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  /**
   * Build a sample object from the current process memory (used when history
   * is empty).
   *
   * @returns {MemorySample}
   * @private
   */
  _buildCurrentSample() {
    const mem = process.memoryUsage();
    return {
      timestamp: Date.now(),
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      rss: mem.rss,
      external: mem.external,
      level: this._evaluateLevel(mem),
    };
  }

  /**
   * Return a plain object mapping owner names to their interval count.
   *
   * @returns {Object<string, number>}
   * @private
   */
  _getIntervalCountsByOwner() {
    const counts = {};
    for (const entry of this._intervals.values()) {
      counts[entry.owner] = (counts[entry.owner] || 0) + 1;
    }
    return counts;
  }

  /**
   * Append an alert message (bounded to 50 entries).
   *
   * @param {string} msg
   * @private
   */
  _addAlert(msg) {
    if (this._alerts.length >= 50) {
      this._alerts.shift();
    }
    this._alerts.push(`[${new Date().toISOString()}] ${msg}`);
  }

  /**
   * Internal structured logger.
   *
   * @param {string} message
   * @param {Object} [data]
   * @private
   */
  _log(message, data) {
    const prefix = '[MemoryGuard]';
    if (data) {
      console.log(prefix, message, JSON.stringify(data));
    } else {
      console.log(prefix, message);
    }
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  /**
   * Gracefully shut down the guard system:
   *  - Stop the sampler interval.
   *  - Clear all registered intervals.
   *  - Remove all event listeners.
   */
  destroy() {
    if (this._samplerRef) {
      clearInterval(this._samplerRef);
      this._samplerRef = null;
    }
    this.clearAll();
    this._history.length = 0;
    this._alerts.length = 0;
    this.removeAllListeners();
    this._log('MemoryGuardSystem destroyed');
  }
}

module.exports = MemoryGuardSystem;
