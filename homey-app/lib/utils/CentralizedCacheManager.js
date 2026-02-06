'use strict';

const EventEmitter = require('events');

/**
 * TTL level presets in milliseconds.
 * Used to standardize cache durations across all subsystems.
 * @enum {number}
 */
const TTL_LEVELS = Object.freeze({
  REALTIME: 10 * 1000,        // 10 seconds – sensor readings, live status
  SHORT: 60 * 1000,           // 1 minute  – frequently changing data
  MEDIUM: 5 * 60 * 1000,     // 5 minutes – moderately stable data
  LONG: 30 * 60 * 1000,      // 30 minutes – slow-changing data
  PERSISTENT: 24 * 60 * 60 * 1000, // 24 hours – nearly static data
});

/**
 * @typedef {Object} CacheEntry
 * @property {*}      value       - The cached value (serialized internally)
 * @property {number} createdAt   - Timestamp when the entry was created
 * @property {number} expiresAt   - Timestamp when the entry expires
 * @property {number} lastAccess  - Timestamp of last read access
 * @property {number} accessCount - Total number of times this entry was read
 * @property {number} size        - Approximate size in bytes
 */

/**
 * @typedef {Object} NamespaceStats
 * @property {number} entries       - Current number of entries
 * @property {number} hits          - Total cache hits
 * @property {number} misses        - Total cache misses
 * @property {number} evictions     - Total evictions
 * @property {number} totalSize     - Approximate memory in bytes
 * @property {number} hitRate       - Hit rate as a percentage (0-100)
 */

/**
 * @typedef {Object} CacheProxy
 * @property {function(string): *}               get        - Retrieve a value
 * @property {function(string, *, number=): void} set        - Store a value
 * @property {function(string): boolean}          invalidate - Remove a key
 */

/**
 * CentralizedCacheManager
 *
 * A singleton, namespace-isolated, LRU-evicting, memory-aware cache manager
 * that replaces the 50+ ad-hoc cache implementations scattered across the
 * Homey Smart Home platform.
 *
 * Features:
 *  - Namespace-based isolation (each subsystem gets its own keyspace)
 *  - LRU eviction with configurable per-namespace and global limits
 *  - Tiered TTL presets (REALTIME → PERSISTENT)
 *  - Memory-pressure monitoring with automatic eviction
 *  - Per-namespace hit/miss/eviction statistics
 *  - Bulk operations: getMulti, setMulti, invalidatePattern
 *  - Cache warming via preload()
 *  - Event-driven: emits 'miss', 'eviction', 'memoryPressure'
 *  - Correct serialization of Map, Set, and Date objects
 *  - Simple proxy interface via createCacheProxy()
 *
 * @extends EventEmitter
 *
 * @example
 *   const { getInstance } = require('./utils/CentralizedCacheManager');
 *   const cache = getInstance();
 *   cache.set('weatherSystem', 'forecast:amsterdam', data, TTL_LEVELS.MEDIUM);
 *   const forecast = cache.get('weatherSystem', 'forecast:amsterdam');
 */
class CentralizedCacheManager extends EventEmitter {

  /**
   * @param {Object}  [options]
   * @param {number}  [options.globalMax=10000]          - Maximum entries across all namespaces
   * @param {number}  [options.namespaceMax=1000]        - Default max entries per namespace
   * @param {number}  [options.memoryThreshold=52428800] - Memory ceiling in bytes (default 50 MB)
   * @param {number}  [options.monitorInterval=60000]    - Monitoring tick interval in ms
   * @param {boolean} [options.enableLogging=true]       - Whether to log periodic stats
   */
  constructor(options = {}) {
    super();

    /** @private */ this._globalMax = options.globalMax ?? 10_000;
    /** @private */ this._namespaceMax = options.namespaceMax ?? 1_000;
    /** @private */ this._memoryThreshold = options.memoryThreshold ?? 50 * 1024 * 1024; // 50 MB
    /** @private */ this._enableLogging = options.enableLogging ?? true;

    /**
     * Primary store: namespace → Map<key, CacheEntry>
     * @private
     * @type {Map<string, Map<string, CacheEntry>>}
     */
    this._namespaces = new Map();

    /**
     * Per-namespace statistics counters.
     * @private
     * @type {Map<string, {hits: number, misses: number, evictions: number}>}
     */
    this._stats = new Map();

    /**
     * Per-namespace max-entry overrides.
     * @private
     * @type {Map<string, number>}
     */
    this._namespaceLimits = new Map();

    /** @private */ this._totalEntries = 0;
    /** @private */ this._totalSize = 0;
    /** @private */ this._destroyed = false;

    // Start the periodic monitoring loop
    /** @private */
    this._monitorTimer = setInterval(
      () => this._monitorTick(),
      options.monitorInterval ?? 60_000,
    );
    // Allow the process to exit even if the timer is still active
    if (this._monitorTimer.unref) this._monitorTimer.unref();
  }

  // ---------------------------------------------------------------------------
  // Namespace helpers
  // ---------------------------------------------------------------------------

  /**
   * Ensure a namespace map and its stats bucket exist.
   * @private
   * @param {string} namespace
   * @returns {Map<string, CacheEntry>}
   */
  _ensureNamespace(namespace) {
    if (!this._namespaces.has(namespace)) {
      this._namespaces.set(namespace, new Map());
      this._stats.set(namespace, { hits: 0, misses: 0, evictions: 0 });
    }
    return this._namespaces.get(namespace);
  }

  /**
   * Register a namespace with a custom entry limit.
   * @param {string} namespace
   * @param {number} maxEntries
   */
  configureNamespace(namespace, maxEntries) {
    this._namespaceLimits.set(namespace, maxEntries);
    this._ensureNamespace(namespace);
  }

  /**
   * Return the effective max-entry limit for a namespace.
   * @private
   * @param {string} namespace
   * @returns {number}
   */
  _limitFor(namespace) {
    return this._namespaceLimits.get(namespace) ?? this._namespaceMax;
  }

  // ---------------------------------------------------------------------------
  // Serialization helpers (Map, Set, Date)
  // ---------------------------------------------------------------------------

  /**
   * Deep-clone and tag special objects so they survive storage.
   * @private
   * @param {*} value
   * @returns {*}
   */
  _serialize(value) {
    if (value === null || value === undefined) return value;
    if (value instanceof Date) return { __type: 'Date', __value: value.toISOString() };
    if (value instanceof Map) {
      return { __type: 'Map', __value: Array.from(value.entries()).map(([k, v]) => [k, this._serialize(v)]) };
    }
    if (value instanceof Set) {
      return { __type: 'Set', __value: Array.from(value).map(v => this._serialize(v)) };
    }
    if (Array.isArray(value)) return value.map(v => this._serialize(v));
    if (typeof value === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(value)) out[k] = this._serialize(v);
      return out;
    }
    return value;
  }

  /**
   * Restore tagged objects back to their original types.
   * @private
   * @param {*} value
   * @returns {*}
   */
  _deserialize(value) {
    if (value === null || value === undefined) return value;
    if (typeof value === 'object' && value.__type) {
      switch (value.__type) {
        case 'Date': return new Date(value.__value);
        case 'Map': return new Map(value.__value.map(([k, v]) => [k, this._deserialize(v)]));
        case 'Set': return new Set(value.__value.map(v => this._deserialize(v)));
        default: break;
      }
    }
    if (Array.isArray(value)) return value.map(v => this._deserialize(v));
    if (typeof value === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(value)) out[k] = this._deserialize(v);
      return out;
    }
    return value;
  }

  /**
   * Rough byte-size estimation for a value (JSON length × 2 for UTF-16).
   * @private
   * @param {*} value
   * @returns {number}
   */
  _estimateSize(value) {
    try {
      return JSON.stringify(value).length * 2;
    } catch {
      return 256; // fallback for circular refs / symbols
    }
  }

  // ---------------------------------------------------------------------------
  // Core operations
  // ---------------------------------------------------------------------------

  /**
   * Store a value in the cache.
   *
   * @param {string} namespace - Target namespace (e.g. 'weatherSystem')
   * @param {string} key       - Cache key
   * @param {*}      value     - Value to cache (Map, Set, Date are handled)
   * @param {number} [ttl=TTL_LEVELS.MEDIUM] - Time-to-live in ms
   */
  set(namespace, key, value, ttl = TTL_LEVELS.MEDIUM) {
    const nsMap = this._ensureNamespace(namespace);
    const serialized = this._serialize(value);
    const size = this._estimateSize(serialized);
    const now = Date.now();

    // If the key already exists, subtract its old size
    if (nsMap.has(key)) {
      const old = nsMap.get(key);
      this._totalSize -= old.size;
      this._totalEntries -= 1;
    }

    /** @type {CacheEntry} */
    const entry = {
      value: serialized,
      createdAt: now,
      expiresAt: now + ttl,
      lastAccess: now,
      accessCount: 0,
      size,
    };

    nsMap.set(key, entry);
    this._totalEntries += 1;
    this._totalSize += size;

    // Enforce per-namespace limit
    this._evictIfNeeded(namespace, nsMap);

    // Enforce global limit
    this._evictGlobalIfNeeded();
  }

  /**
   * Retrieve a value from the cache.
   *
   * @param {string} namespace
   * @param {string} key
   * @returns {*|undefined} The cached value, or undefined on miss / expiry
   */
  get(namespace, key) {
    const nsMap = this._namespaces.get(namespace);
    const stats = this._stats.get(namespace);

    if (!nsMap || !nsMap.has(key)) {
      if (stats) stats.misses += 1;
      this.emit('miss', { namespace, key });
      return undefined;
    }

    const entry = nsMap.get(key);

    // Check TTL expiry
    if (Date.now() > entry.expiresAt) {
      this._removeEntry(namespace, nsMap, key, entry);
      if (stats) stats.misses += 1;
      this.emit('miss', { namespace, key });
      return undefined;
    }

    // Update LRU tracking
    entry.lastAccess = Date.now();
    entry.accessCount += 1;
    if (stats) stats.hits += 1;

    return this._deserialize(entry.value);
  }

  /**
   * Check whether a key exists and is not expired.
   * @param {string} namespace
   * @param {string} key
   * @returns {boolean}
   */
  has(namespace, key) {
    const nsMap = this._namespaces.get(namespace);
    if (!nsMap || !nsMap.has(key)) return false;
    const entry = nsMap.get(key);
    if (Date.now() > entry.expiresAt) {
      this._removeEntry(namespace, nsMap, key, entry);
      return false;
    }
    return true;
  }

  /**
   * Invalidate (delete) a single key.
   * @param {string} namespace
   * @param {string} key
   * @returns {boolean} true if the key existed
   */
  invalidate(namespace, key) {
    const nsMap = this._namespaces.get(namespace);
    if (!nsMap || !nsMap.has(key)) return false;
    const entry = nsMap.get(key);
    this._removeEntry(namespace, nsMap, key, entry);
    return true;
  }

  /**
   * Invalidate all keys in a namespace whose key matches a pattern.
   * Supports simple wildcard '*' patterns (converted to RegExp).
   *
   * @param {string} namespace
   * @param {string} pattern - Glob-like pattern, e.g. 'forecast:*'
   * @returns {number} Number of entries removed
   */
  invalidatePattern(namespace, pattern) {
    const nsMap = this._namespaces.get(namespace);
    if (!nsMap) return 0;

    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
    let removed = 0;

    for (const [key, entry] of Array.from(nsMap.entries())) {
      if (regex.test(key)) {
        this._removeEntry(namespace, nsMap, key, entry);
        removed += 1;
      }
    }
    return removed;
  }

  /**
   * Clear an entire namespace.
   * @param {string} namespace
   */
  clearNamespace(namespace) {
    const nsMap = this._namespaces.get(namespace);
    if (!nsMap) return;
    for (const entry of nsMap.values()) {
      this._totalSize -= entry.size;
      this._totalEntries -= 1;
    }
    nsMap.clear();
  }

  // ---------------------------------------------------------------------------
  // Bulk operations
  // ---------------------------------------------------------------------------

  /**
   * Retrieve multiple keys from a namespace in a single call.
   *
   * @param {string}   namespace
   * @param {string[]} keys
   * @returns {Map<string, *>} Map of key → value (missing keys are omitted)
   */
  getMulti(namespace, keys) {
    const results = new Map();
    for (const key of keys) {
      const val = this.get(namespace, key);
      if (val !== undefined) results.set(key, val);
    }
    return results;
  }

  /**
   * Store multiple key-value pairs in a single call.
   *
   * @param {string}              namespace
   * @param {Array<[string, *]>}  entries  - Array of [key, value] pairs
   * @param {number}              [ttl=TTL_LEVELS.MEDIUM]
   */
  setMulti(namespace, entries, ttl = TTL_LEVELS.MEDIUM) {
    for (const [key, value] of entries) {
      this.set(namespace, key, value, ttl);
    }
  }

  // ---------------------------------------------------------------------------
  // Cache warming
  // ---------------------------------------------------------------------------

  /**
   * Pre-populate a namespace using an async loader function.
   * The loader should return an array of [key, value] tuples.
   *
   * @param {string}   namespace
   * @param {function(): Promise<Array<[string, *]>>} loader
   * @param {number}   [ttl=TTL_LEVELS.LONG]
   * @returns {Promise<number>} Number of entries loaded
   */
  async preload(namespace, loader, ttl = TTL_LEVELS.LONG) {
    const entries = await loader();
    if (!Array.isArray(entries)) return 0;
    this.setMulti(namespace, entries, ttl);
    return entries.length;
  }

  // ---------------------------------------------------------------------------
  // LRU eviction
  // ---------------------------------------------------------------------------

  /**
   * Evict least-recently-used entries when a namespace exceeds its limit.
   * @private
   * @param {string} namespace
   * @param {Map<string, CacheEntry>} nsMap
   */
  _evictIfNeeded(namespace, nsMap) {
    const limit = this._limitFor(namespace);
    while (nsMap.size > limit) {
      const victim = this._findLRU(nsMap);
      if (!victim) break;
      this._removeEntry(namespace, nsMap, victim.key, victim.entry, true);
    }
  }

  /**
   * Evict globally when total entries exceed the global max.
   * Picks the largest namespace first, then evicts LRU within it.
   * @private
   */
  _evictGlobalIfNeeded() {
    while (this._totalEntries > this._globalMax) {
      // Find the namespace with the most entries
      let largestNs = null;
      let largestSize = 0;
      for (const [ns, nsMap] of this._namespaces) {
        if (nsMap.size > largestSize) {
          largestSize = nsMap.size;
          largestNs = ns;
        }
      }
      if (!largestNs) break;
      const nsMap = this._namespaces.get(largestNs);
      const victim = this._findLRU(nsMap);
      if (!victim) break;
      this._removeEntry(largestNs, nsMap, victim.key, victim.entry, true);
    }
  }

  /**
   * Evict entries until total memory drops below the threshold.
   * Targets expired entries first, then LRU across all namespaces.
   * @private
   */
  _evictForMemory() {
    const now = Date.now();

    // Pass 1: remove all expired entries
    for (const [ns, nsMap] of this._namespaces) {
      for (const [key, entry] of Array.from(nsMap.entries())) {
        if (now > entry.expiresAt) {
          this._removeEntry(ns, nsMap, key, entry, false);
        }
      }
    }

    // Pass 2: LRU eviction until we are under threshold
    let safety = 0;
    while (this._totalSize > this._memoryThreshold && safety < 5000) {
      safety += 1;
      let oldestAccess = Infinity;
      let victimNs = null;
      let victimKey = null;
      let victimEntry = null;

      for (const [ns, nsMap] of this._namespaces) {
        for (const [key, entry] of nsMap) {
          if (entry.lastAccess < oldestAccess) {
            oldestAccess = entry.lastAccess;
            victimNs = ns;
            victimKey = key;
            victimEntry = entry;
          }
        }
      }
      if (!victimNs) break;
      this._removeEntry(victimNs, this._namespaces.get(victimNs), victimKey, victimEntry, true);
    }
  }

  /**
   * Find the least-recently-used entry in a namespace map.
   * Uses lastAccess as the primary sort, accessCount as tie-breaker.
   * @private
   * @param {Map<string, CacheEntry>} nsMap
   * @returns {{key: string, entry: CacheEntry}|null}
   */
  _findLRU(nsMap) {
    let oldestKey = null;
    let oldestEntry = null;
    let oldestAccess = Infinity;
    let lowestCount = Infinity;

    for (const [key, entry] of nsMap) {
      if (
        entry.lastAccess < oldestAccess ||
        (entry.lastAccess === oldestAccess && entry.accessCount < lowestCount)
      ) {
        oldestAccess = entry.lastAccess;
        lowestCount = entry.accessCount;
        oldestKey = key;
        oldestEntry = entry;
      }
    }
    return oldestKey ? { key: oldestKey, entry: oldestEntry } : null;
  }

  /**
   * Remove a single entry and update bookkeeping.
   * @private
   * @param {string}  namespace
   * @param {Map}     nsMap
   * @param {string}  key
   * @param {CacheEntry} entry
   * @param {boolean} [isEviction=false]
   */
  _removeEntry(namespace, nsMap, key, entry, isEviction = false) {
    nsMap.delete(key);
    this._totalEntries -= 1;
    this._totalSize -= entry.size;

    if (isEviction) {
      const stats = this._stats.get(namespace);
      if (stats) stats.evictions += 1;
      this.emit('eviction', { namespace, key });
    }
  }

  // ---------------------------------------------------------------------------
  // Monitoring
  // ---------------------------------------------------------------------------

  /**
   * Periodic monitoring tick – checks memory pressure and optionally logs stats.
   * @private
   */
  _monitorTick() {
    if (this._destroyed) return;

    // Memory pressure check
    if (this._totalSize > this._memoryThreshold) {
      this.emit('memoryPressure', {
        currentSize: this._totalSize,
        threshold: this._memoryThreshold,
        totalEntries: this._totalEntries,
      });
      this._evictForMemory();
    }

    // Purge expired entries lazily
    const now = Date.now();
    for (const [ns, nsMap] of this._namespaces) {
      for (const [key, entry] of Array.from(nsMap.entries())) {
        if (now > entry.expiresAt) {
          this._removeEntry(ns, nsMap, key, entry, false);
        }
      }
    }

    if (this._enableLogging) {
      this._logStats();
    }
  }

  /**
   * Write a summary line per namespace to the console.
   * @private
   */
  _logStats() {
    const summary = [];
    for (const [ns] of this._namespaces) {
      const s = this.getStats(ns);
      summary.push(`${ns}: ${s.entries} entries, ${s.hitRate.toFixed(1)}% hit rate`);
    }
    if (summary.length > 0) {
      const totalMB = (this._totalSize / (1024 * 1024)).toFixed(2);
      console.log(`[CacheManager] ${this._totalEntries} total entries, ${totalMB} MB | ${summary.join(' | ')}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Statistics
  // ---------------------------------------------------------------------------

  /**
   * Return statistics for a single namespace.
   *
   * @param {string} namespace
   * @returns {NamespaceStats}
   */
  getStats(namespace) {
    const nsMap = this._namespaces.get(namespace);
    const counters = this._stats.get(namespace) || { hits: 0, misses: 0, evictions: 0 };
    const entries = nsMap ? nsMap.size : 0;

    let totalSize = 0;
    if (nsMap) {
      for (const entry of nsMap.values()) totalSize += entry.size;
    }

    const total = counters.hits + counters.misses;
    return {
      entries,
      hits: counters.hits,
      misses: counters.misses,
      evictions: counters.evictions,
      totalSize,
      hitRate: total > 0 ? (counters.hits / total) * 100 : 0,
    };
  }

  /**
   * Return aggregated statistics across all namespaces.
   *
   * @returns {Object} Global stats including per-namespace breakdown
   */
  getGlobalStats() {
    const namespaces = {};
    for (const [ns] of this._namespaces) {
      namespaces[ns] = this.getStats(ns);
    }
    return {
      totalEntries: this._totalEntries,
      totalSizeBytes: this._totalSize,
      totalSizeMB: +(this._totalSize / (1024 * 1024)).toFixed(2),
      memoryThreshold: this._memoryThreshold,
      memoryUsagePercent: +(this._totalSize / this._memoryThreshold * 100).toFixed(1),
      namespaces,
    };
  }

  // ---------------------------------------------------------------------------
  // Integration helper
  // ---------------------------------------------------------------------------

  /**
   * Create a simple proxy object scoped to a namespace with a fixed TTL level.
   * Ideal for subsystems that only need basic get/set/invalidate.
   *
   * @param {string} namespace
   * @param {number} [ttlLevel=TTL_LEVELS.MEDIUM] - One of the TTL_LEVELS constants
   * @returns {CacheProxy}
   *
   * @example
   *   const weatherCache = cacheManager.createCacheProxy('weatherSystem', TTL_LEVELS.SHORT);
   *   weatherCache.set('forecast:amsterdam', data);
   *   const forecast = weatherCache.get('forecast:amsterdam');
   */
  createCacheProxy(namespace, ttlLevel = TTL_LEVELS.MEDIUM) {
    this._ensureNamespace(namespace);
    return {
      /**
       * Get a cached value.
       * @param {string} key
       * @returns {*|undefined}
       */
      get: (key) => this.get(namespace, key),

      /**
       * Set a cached value.
       * @param {string} key
       * @param {*}      value
       * @param {number} [ttl] - Override the proxy's default TTL
       */
      set: (key, value, ttl) => this.set(namespace, key, value, ttl ?? ttlLevel),

      /**
       * Invalidate a cached key.
       * @param {string} key
       * @returns {boolean}
       */
      invalidate: (key) => this.invalidate(namespace, key),
    };
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Destroy the cache manager – clears all data, stops monitoring, and
   * removes the singleton reference so a fresh instance can be created.
   */
  destroy() {
    this._destroyed = true;

    if (this._monitorTimer) {
      clearInterval(this._monitorTimer);
      this._monitorTimer = null;
    }

    for (const nsMap of this._namespaces.values()) nsMap.clear();
    this._namespaces.clear();
    this._stats.clear();
    this._namespaceLimits.clear();
    this._totalEntries = 0;
    this._totalSize = 0;

    this.removeAllListeners();

    // Reset singleton so getInstance() creates a new one if needed
    _instance = null;
  }
}

// ---------------------------------------------------------------------------
// Singleton management
// ---------------------------------------------------------------------------

/** @type {CentralizedCacheManager|null} */
let _instance = null;

/**
 * Return the singleton CentralizedCacheManager instance.
 * Creates one on first call with the provided options.
 *
 * @param {Object} [options] - Passed to the constructor on first call only
 * @returns {CentralizedCacheManager}
 */
function getInstance(options) {
  if (!_instance) {
    _instance = new CentralizedCacheManager(options);
  }
  return _instance;
}

module.exports = CentralizedCacheManager;
module.exports.CentralizedCacheManager = CentralizedCacheManager;
module.exports.getInstance = getInstance;
module.exports.TTL_LEVELS = TTL_LEVELS;
