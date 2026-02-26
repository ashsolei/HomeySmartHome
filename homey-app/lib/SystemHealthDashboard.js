'use strict';

const EventEmitter = require('events');

/**
 * @typedef {'HEALTHY'|'DEGRADED'|'UNHEALTHY'|'UNRESPONSIVE'} HealthStatus
 * @typedef {'INFO'|'WARNING'|'CRITICAL'} AlertLevel
 *
 * @typedef {Object} SystemEntry
 * @property {string} name
 * @property {Object} ref
 * @property {HealthStatus} status
 * @property {number} score
 * @property {number} lastChecked
 * @property {number} registeredAt
 * @property {number} consecutiveDegradedChecks
 * @property {Object|null} lastHealthData
 *
 * @typedef {Object} HealthAlert
 * @property {string} id
 * @property {AlertLevel} level
 * @property {string} message
 * @property {string} system
 * @property {number} timestamp
 * @property {boolean} resolved
 * @property {number|null} resolvedAt
 *
 * @typedef {Object} HealthSnapshot
 * @property {number} timestamp
 * @property {number} overallScore
 * @property {Map<string,number>} systemScores
 * @property {number} healthyCount
 * @property {number} degradedCount
 * @property {number} unhealthyCount
 */

/** Points awarded per health status */
const STATUS_SCORES = {
  HEALTHY: 100,
  DEGRADED: 50,
  UNHEALTHY: 0,
  UNRESPONSIVE: 0,
};

/** Default configuration values */
const DEFAULTS = {
  POLL_INTERVAL_MS: 60_000,
  SNAPSHOT_INTERVAL_MS: 300_000,        // 5 minutes
  MAX_SNAPSHOTS: 288,                   // 24 h @ 5-min resolution
  HEALTH_CHECK_TIMEOUT_MS: 5_000,
  ALERT_THRESHOLD: 80,
  SUSTAINED_DEGRADATION_MS: 600_000,    // 10 minutes
  MAX_ALERTS: 500,
  DEDUP_WINDOW_MS: 300_000,
};

/**
 * SystemHealthDashboard – Unified health monitoring aggregator for every
 * registered sub-system in the Homey Smart Home platform.
 *
 * Features
 * --------
 * - Automatic discovery of systems from the app instance
 * - Periodic health polling with configurable timeout
 * - Overall platform health score (0-100)
 * - 24-hour rolling history at 5-minute resolution (288 snapshots)
 * - Alert management with deduplication and severity levels
 * - Performance-metrics aggregation (API calls, errors, memory, caches)
 * - Comprehensive startup diagnostics via `runDiagnostics()`
 *
 * @extends EventEmitter
 * @emits SystemHealthDashboard#health-check
 * @emits SystemHealthDashboard#health-alert
 * @emits SystemHealthDashboard#system-degraded
 * @emits SystemHealthDashboard#system-recovered
 */
class SystemHealthDashboard extends EventEmitter {
  /**
   * @param {Object}  homeyApp                  - Reference to the main Homey app instance
   * @param {Object}  [options]
   * @param {number}  [options.pollInterval]     - Milliseconds between health polls
   * @param {number}  [options.snapshotInterval] - Milliseconds between history snapshots
   * @param {number}  [options.alertThreshold]   - Overall score below which alerts fire (0-100)
   * @param {number}  [options.healthCheckTimeout] - Max ms to wait for a system health reply
   * @param {boolean} [options.autoDiscover]     - Auto-discover systems from app instance
   */
  constructor(homeyApp, options = {}) {
    super();

    /** @type {Object} */
    this.app = homeyApp;

    /** @type {Map<string, SystemEntry>} */
    this.systems = new Map();

    /** @type {HealthAlert[]} */
    this.alerts = [];

    /** @type {HealthSnapshot[]} */
    this.healthHistory = [];

    /** @type {number} */
    this.overallScore = 100;

    /** @type {boolean} */
    this.initialized = false;

    /* ---- Configuration ---- */
    this.pollIntervalMs = options.pollInterval ?? DEFAULTS.POLL_INTERVAL_MS;
    this.snapshotIntervalMs = options.snapshotInterval ?? DEFAULTS.SNAPSHOT_INTERVAL_MS;
    this.alertThreshold = options.alertThreshold ?? DEFAULTS.ALERT_THRESHOLD;
    this.healthCheckTimeoutMs = options.healthCheckTimeout ?? DEFAULTS.HEALTH_CHECK_TIMEOUT_MS;
    this.autoDiscover = options.autoDiscover !== false;

    /* ---- Timers ---- */
    this._pollTimer = null;
    this._snapshotTimer = null;

    /* ---- Aggregate counters ---- */
    this._aggregatedMetrics = {
      totalApiCalls: 0,
      totalErrors: 0,
      memoryBySystem: {},
      cacheEfficiency: null,
      schedulerEfficiency: null,
    };

    /* ---- Sustained-degradation tracking ---- */
    this._degradedSince = null;
    this._sustainedAlertFired = false;
  }

  /* =================================================================
   *  Lifecycle
   * ================================================================= */

  /**
   * Initialise the dashboard – discover systems, start polling.
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      if (this.initialized) return;

      if (this.autoDiscover) {
        this._discoverSystems();
      }

      // Perform an initial health check immediately
      await this.pollAllSystems();
      this._takeSnapshot();

      // Start recurring timers
      this._pollTimer = setInterval(() => this.pollAllSystems(), this.pollIntervalMs);
      this._snapshotTimer = setInterval(() => this._takeSnapshot(), this.snapshotIntervalMs);

      this.initialized = true;
      this.emit('health-check', { type: 'initialize', overallScore: this.overallScore });
    } catch (error) {
      console.error(`[SystemHealthDashboard] Failed to initialize:`, error.message);
    }
  }

  /**
   * Gracefully shut down timers and release references.
   */
  destroy() {
    if (this._pollTimer) clearInterval(this._pollTimer);
    if (this._snapshotTimer) clearInterval(this._snapshotTimer);
    this._pollTimer = null;
    this._snapshotTimer = null;
    this.systems.clear();
    this.alerts = [];
    this.healthHistory = [];
    this.initialized = false;
    this.removeAllListeners();
  }

  /* =================================================================
   *  System Registry
   * ================================================================= */

  /**
   * Register a sub-system for health monitoring.
   *
   * @param {string} name      - Unique name for the system
   * @param {Object} systemRef - Reference to the system object (must expose getHealth/getStatus)
   * @throws {Error} If name is already registered
   */
  registerSystem(name, systemRef) {
    if (this.systems.has(name)) {
      throw new Error(`System "${name}" is already registered`);
    }

    /** @type {SystemEntry} */
    const entry = {
      name,
      ref: systemRef,
      status: 'HEALTHY',
      score: 100,
      lastChecked: 0,
      registeredAt: Date.now(),
      consecutiveDegradedChecks: 0,
      lastHealthData: null,
    };

    this.systems.set(name, entry);
    this._addAlert('INFO', `System "${name}" registered for monitoring`, name);
  }

  /**
   * Remove a system from monitoring.
   *
   * @param {string} name
   * @returns {boolean} True if the system was found and removed
   */
  unregisterSystem(name) {
    const existed = this.systems.delete(name);
    if (existed) {
      this._addAlert('INFO', `System "${name}" unregistered from monitoring`, name);
    }
    return existed;
  }

  /* =================================================================
   *  Auto-Discovery
   * ================================================================= */

  /**
   * Walk the app instance and register every property that looks like
   * a system (has getHealth, getStatus, or a `health` property).
   * @private
   */
  _discoverSystems() {
    if (!this.app) return;

    const candidates = Object.entries(this.app).filter(([, value]) => {
      return (
        value &&
        typeof value === 'object' &&
        (typeof value.getHealth === 'function' ||
          typeof value.getStatus === 'function' ||
          typeof value.health !== 'undefined')
      );
    });

    for (const [key, ref] of candidates) {
      if (!this.systems.has(key)) {
        try {
          this.registerSystem(key, ref);
        } catch (_) {
          /* ignore duplicates */
        }
      }
    }
  }

  /* =================================================================
   *  Health Polling
   * ================================================================= */

  /**
   * Poll every registered system for its current health.
   * Systems that do not respond within the configured timeout are
   * marked **UNRESPONSIVE**.
   *
   * @returns {Promise<number>} The newly-calculated overall health score
   */
  async pollAllSystems() {
    const checks = [];

    for (const [name, entry] of this.systems) {
      checks.push(this._checkSystem(name, entry));
    }

    await Promise.allSettled(checks);

    const previousScore = this.overallScore;
    this.overallScore = this._calculateOverallScore();

    this._evaluateAlerts(previousScore);
    this._aggregatePerformanceMetrics();

    this.emit('health-check', {
      type: 'poll',
      overallScore: this.overallScore,
      systemCount: this.systems.size,
      timestamp: Date.now(),
    });

    return this.overallScore;
  }

  /**
   * Check a single system's health with a timeout guard.
   *
   * @param {string}      name
   * @param {SystemEntry} entry
   * @returns {Promise<void>}
   * @private
   */
  async _checkSystem(name, entry) {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Health check timeout')), this.healthCheckTimeoutMs),
    );

    try {
      let healthData;

      if (typeof entry.ref.getHealth === 'function') {
        healthData = await Promise.race([entry.ref.getHealth(), timeout]);
      } else if (typeof entry.ref.getStatus === 'function') {
        healthData = await Promise.race([entry.ref.getStatus(), timeout]);
      } else if (entry.ref.health !== undefined) {
        healthData = entry.ref.health;
      } else {
        // System has no introspection method – assume healthy
        healthData = { status: 'HEALTHY' };
      }

      const previousStatus = entry.status;
      entry.lastHealthData = healthData;
      entry.lastChecked = Date.now();
      entry.status = this._resolveStatus(healthData);
      entry.score = STATUS_SCORES[entry.status];

      // Factor in optional metrics
      entry.score = this._adjustScoreByMetrics(entry.score, healthData);

      this._trackDegradation(entry, previousStatus);
    } catch (err) {
      const previousStatus = entry.status;
      entry.status = 'UNRESPONSIVE';
      entry.score = 0;
      entry.lastChecked = Date.now();
      entry.lastHealthData = { error: err.message };

      this._trackDegradation(entry, previousStatus);

      this._addAlert(
        'CRITICAL',
        `System "${name}" is unresponsive: ${err.message}`,
        name,
      );
    }
  }

  /**
   * Determine a canonical HealthStatus from arbitrary health data.
   *
   * @param {Object} data
   * @returns {HealthStatus}
   * @private
   */
  _resolveStatus(data) {
    if (!data) return 'UNHEALTHY';

    const raw = (data.status || data.state || '').toString().toUpperCase();

    if (['HEALTHY', 'OK', 'GOOD', 'UP', 'ACTIVE', 'RUNNING'].includes(raw)) return 'HEALTHY';
    if (['DEGRADED', 'WARNING', 'WARN', 'PARTIAL'].includes(raw)) return 'DEGRADED';
    if (['UNHEALTHY', 'ERROR', 'CRITICAL', 'DOWN', 'FAILED'].includes(raw)) return 'UNHEALTHY';
    if (['UNRESPONSIVE', 'TIMEOUT'].includes(raw)) return 'UNRESPONSIVE';

    // Heuristic: check for error fields
    if (data.error || data.errors?.length) return 'UNHEALTHY';

    return 'HEALTHY';
  }

  /**
   * Fine-tune a system's score by looking at optional metrics such as
   * error rates, memory usage, and cache hit rates.
   *
   * @param {number} baseScore
   * @param {Object} data
   * @returns {number}
   * @private
   */
  _adjustScoreByMetrics(baseScore, data) {
    if (!data || baseScore === 0) return baseScore;

    let adjusted = baseScore;

    // Error-rate penalty (errorRate as 0-1 fraction)
    if (typeof data.errorRate === 'number' && data.errorRate > 0) {
      adjusted -= Math.min(30, Math.round(data.errorRate * 100));
    }

    // High memory usage penalty (memoryUsagePercent 0-100)
    if (typeof data.memoryUsagePercent === 'number' && data.memoryUsagePercent > 80) {
      adjusted -= Math.min(20, Math.round((data.memoryUsagePercent - 80)));
    }

    // Low cache-hit-rate penalty (cacheHitRate as 0-1 fraction)
    if (typeof data.cacheHitRate === 'number' && data.cacheHitRate < 0.5) {
      adjusted -= Math.min(10, Math.round((0.5 - data.cacheHitRate) * 20));
    }

    return Math.max(0, Math.min(100, adjusted));
  }

  /**
   * Track consecutive degraded/unhealthy checks and emit events on
   * status transitions.
   *
   * @param {SystemEntry} entry
   * @param {HealthStatus} previousStatus
   * @private
   */
  _trackDegradation(entry, previousStatus) {
    if (entry.status === 'DEGRADED' || entry.status === 'UNHEALTHY' || entry.status === 'UNRESPONSIVE') {
      entry.consecutiveDegradedChecks += 1;
    } else {
      entry.consecutiveDegradedChecks = 0;
    }

    // Transition: was bad, now good
    if (previousStatus !== 'HEALTHY' && entry.status === 'HEALTHY') {
      this.emit('system-recovered', { system: entry.name, previousStatus });
      this._addAlert('INFO', `System "${entry.name}" recovered → HEALTHY`, entry.name);
    }

    // Transition: was good, now bad
    if (previousStatus === 'HEALTHY' && entry.status !== 'HEALTHY') {
      this.emit('system-degraded', { system: entry.name, status: entry.status });
      this._addAlert(
        entry.status === 'UNHEALTHY' || entry.status === 'UNRESPONSIVE' ? 'CRITICAL' : 'WARNING',
        `System "${entry.name}" degraded → ${entry.status}`,
        entry.name,
      );
    }
  }

  /* =================================================================
   *  Score Calculation
   * ================================================================= */

  /**
   * Calculate the overall platform health score (0-100).
   * Every registered system contributes equally.
   *
   * @returns {number}
   * @private
   */
  _calculateOverallScore() {
    if (this.systems.size === 0) return 100;

    let total = 0;
    for (const entry of this.systems.values()) {
      total += entry.score;
    }

    return Math.round(total / this.systems.size);
  }

  /* =================================================================
   *  Alerts
   * ================================================================= */

  /**
   * Evaluate overall-score thresholds and sustained-degradation rules.
   *
   * @param {number} previousScore
   * @private
   */
  _evaluateAlerts(previousScore) {
    const now = Date.now();

    // Overall threshold alert
    if (this.overallScore < this.alertThreshold && previousScore >= this.alertThreshold) {
      this._addAlert(
        'WARNING',
        `Overall health dropped below threshold: ${this.overallScore} < ${this.alertThreshold}`,
        '_platform',
      );
    }

    // Sustained-degradation tracking
    if (this.overallScore < this.alertThreshold) {
      if (!this._degradedSince) {
        this._degradedSince = now;
      } else if (
        now - this._degradedSince >= DEFAULTS.SUSTAINED_DEGRADATION_MS &&
        !this._sustainedAlertFired
      ) {
        this._addAlert(
          'CRITICAL',
          `Platform health below ${this.alertThreshold} for over 10 minutes (current: ${this.overallScore})`,
          '_platform',
        );
        this._sustainedAlertFired = true;
      }
    } else {
      this._degradedSince = null;
      this._sustainedAlertFired = false;
    }
  }

  /**
   * Create a new alert with deduplication.
   *
   * @param {AlertLevel} level
   * @param {string}     message
   * @param {string}     system
   * @private
   */
  _addAlert(level, message, system) {
    const now = Date.now();

    // Deduplication: skip if an identical unresolved alert exists within window
    const duplicate = this.alerts.find(
      (a) =>
        !a.resolved &&
        a.level === level &&
        a.system === system &&
        a.message === message &&
        now - a.timestamp < DEFAULTS.DEDUP_WINDOW_MS,
    );
    if (duplicate) return;

    /** @type {HealthAlert} */
    const alert = {
      id: `alert_${now}_${Math.random().toString(36).slice(2, 8)}`,
      level,
      message,
      system,
      timestamp: now,
      resolved: false,
      resolvedAt: null,
    };

    this.alerts.push(alert);

    // Cap history length
    if (this.alerts.length > DEFAULTS.MAX_ALERTS) {
      this.alerts = this.alerts.slice(-DEFAULTS.MAX_ALERTS);
    }

    this.emit('health-alert', alert);
  }

  /**
   * Resolve an alert by id.
   *
   * @param {string} alertId
   * @returns {boolean}
   */
  resolveAlert(alertId) {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (!alert || alert.resolved) return false;
    alert.resolved = true;
    alert.resolvedAt = Date.now();
    return true;
  }

  /* =================================================================
   *  History Snapshots
   * ================================================================= */

  /**
   * Record a point-in-time snapshot of the platform health.
   * @private
   */
  _takeSnapshot() {
    const systemScores = {};
    let healthyCount = 0;
    let degradedCount = 0;
    let unhealthyCount = 0;

    for (const [name, entry] of this.systems) {
      systemScores[name] = entry.score;
      if (entry.status === 'HEALTHY') healthyCount++;
      else if (entry.status === 'DEGRADED') degradedCount++;
      else unhealthyCount++;
    }

    /** @type {HealthSnapshot} */
    const snapshot = {
      timestamp: Date.now(),
      overallScore: this.overallScore,
      systemScores,
      healthyCount,
      degradedCount,
      unhealthyCount,
    };

    this.healthHistory.push(snapshot);

    // Trim to max length
    if (this.healthHistory.length > DEFAULTS.MAX_SNAPSHOTS) {
      this.healthHistory = this.healthHistory.slice(-DEFAULTS.MAX_SNAPSHOTS);
    }
  }

  /* =================================================================
   *  Performance Metrics Aggregation
   * ================================================================= */

  /**
   * Collect performance counters from well-known companion systems
   * (MemoryGuardSystem, CentralizedCacheManager, UnifiedEventScheduler,
   *  ErrorHandlingMiddleware) and per-system memory usage.
   * @private
   */
  _aggregatePerformanceMetrics() {
    let totalApiCalls = 0;
    let totalErrors = 0;
    const memoryBySystem = {};

    for (const [name, entry] of this.systems) {
      const d = entry.lastHealthData || {};

      if (typeof d.apiCalls === 'number') totalApiCalls += d.apiCalls;
      if (typeof d.totalCalls === 'number') totalApiCalls += d.totalCalls;
      if (typeof d.errorCount === 'number') totalErrors += d.errorCount;
      if (typeof d.errors === 'number') totalErrors += d.errors;
      if (typeof d.memoryUsageMB === 'number') memoryBySystem[name] = d.memoryUsageMB;
      if (typeof d.memoryUsage === 'number') memoryBySystem[name] = d.memoryUsage;
    }

    // Pull from known integrations
    this._aggregatedMetrics.totalApiCalls = totalApiCalls;
    this._aggregatedMetrics.totalErrors = totalErrors;
    this._aggregatedMetrics.memoryBySystem = memoryBySystem;

    // CentralizedCacheManager
    const cacheMgr = this._resolveCompanion('centralizedCacheManager', 'CentralizedCacheManager');
    if (cacheMgr) {
      try {
        const stats = typeof cacheMgr.getStats === 'function' ? cacheMgr.getStats() : null;
        this._aggregatedMetrics.cacheEfficiency = stats
          ? { hitRate: stats.hitRate ?? null, totalHits: stats.hits ?? null, totalMisses: stats.misses ?? null }
          : null;
      } catch (_) { /* best-effort */ }
    }

    // UnifiedEventScheduler
    const scheduler = this._resolveCompanion('unifiedEventScheduler', 'UnifiedEventScheduler');
    if (scheduler) {
      try {
        const stats = typeof scheduler.getStats === 'function' ? scheduler.getStats() : null;
        this._aggregatedMetrics.schedulerEfficiency = stats
          ? { scheduled: stats.scheduled ?? null, executed: stats.executed ?? null, missed: stats.missed ?? null }
          : null;
      } catch (_) { /* best-effort */ }
    }

    // ErrorHandlingMiddleware
    const errMw = this._resolveCompanion('errorHandlingMiddleware', 'ErrorHandlingMiddleware');
    if (errMw && typeof errMw.getErrorCount === 'function') {
      try {
        this._aggregatedMetrics.totalErrors = Math.max(totalErrors, errMw.getErrorCount());
      } catch (_) { /* best-effort */ }
    }
  }

  /**
   * Try to locate a companion system by conventional property names.
   *
   * @param  {...string} names  Candidate property names on `this.app`
   * @returns {Object|null}
   * @private
   */
  _resolveCompanion(...names) {
    for (const n of names) {
      if (this.app && this.app[n]) return this.app[n];
      const camel = n.charAt(0).toLowerCase() + n.slice(1);
      if (this.app && this.app[camel]) return this.app[camel];
    }
    return null;
  }

  /* =================================================================
   *  Dashboard API
   * ================================================================= */

  /**
   * Return a complete dashboard overview.
   *
   * @returns {Object} Full dashboard payload
   */
  getDashboard() {
    const systems = {};
    for (const [name, entry] of this.systems) {
      systems[name] = {
        status: entry.status,
        score: entry.score,
        lastChecked: entry.lastChecked,
        registeredAt: entry.registeredAt,
        consecutiveDegradedChecks: entry.consecutiveDegradedChecks,
      };
    }

    return {
      overallScore: this.overallScore,
      systemCount: this.systems.size,
      systems,
      healthyCounts: this._countByStatus(),
      recentAlerts: this.alerts.filter((a) => !a.resolved).slice(-20),
      metrics: { ...this._aggregatedMetrics },
      snapshotCount: this.healthHistory.length,
      lastPoll: this._lastPollTimestamp(),
      generatedAt: Date.now(),
    };
  }

  /**
   * Return health details for a single system.
   *
   * @param {string} name
   * @returns {Object|null} System health detail or null if not found
   */
  getSystemHealth(name) {
    const entry = this.systems.get(name);
    if (!entry) return null;

    return {
      name: entry.name,
      status: entry.status,
      score: entry.score,
      lastChecked: entry.lastChecked,
      registeredAt: entry.registeredAt,
      consecutiveDegradedChecks: entry.consecutiveDegradedChecks,
      lastHealthData: entry.lastHealthData,
    };
  }

  /**
   * Return health history filtered by a time window.
   *
   * @param {number} [hours=24] - How many hours of history to return
   * @returns {HealthSnapshot[]}
   */
  getHealthHistory(hours = 24) {
    const cutoff = Date.now() - hours * 3_600_000;
    return this.healthHistory.filter((s) => s.timestamp >= cutoff);
  }

  /**
   * Return alerts, optionally filtered by severity.
   *
   * @param {AlertLevel} [severity] - If supplied only alerts of this level are returned
   * @returns {HealthAlert[]}
   */
  getAlerts(severity) {
    if (!severity) return [...this.alerts];
    return this.alerts.filter((a) => a.level === severity);
  }

  /**
   * Generate a detailed performance report.
   *
   * @returns {Object}
   */
  getPerformanceReport() {
    const statusCounts = this._countByStatus();

    return {
      overallScore: this.overallScore,
      systemCount: this.systems.size,
      statusBreakdown: statusCounts,
      metrics: { ...this._aggregatedMetrics },
      alertsSummary: {
        total: this.alerts.length,
        unresolved: this.alerts.filter((a) => !a.resolved).length,
        critical: this.alerts.filter((a) => a.level === 'CRITICAL' && !a.resolved).length,
        warning: this.alerts.filter((a) => a.level === 'WARNING' && !a.resolved).length,
      },
      historyDepth: this.healthHistory.length,
      uptimePercent: this._calculateUptimePercent(),
      generatedAt: Date.now(),
    };
  }

  /**
   * Return the top N most problematic systems (lowest scores first).
   *
   * @param {number} [count=5]
   * @returns {Object[]}
   */
  getTopIssues(count = 5) {
    return [...this.systems.values()]
      .sort((a, b) => a.score - b.score)
      .slice(0, count)
      .map((entry) => ({
        name: entry.name,
        status: entry.status,
        score: entry.score,
        consecutiveDegradedChecks: entry.consecutiveDegradedChecks,
        lastHealthData: entry.lastHealthData,
      }));
  }

  /* =================================================================
   *  Diagnostics
   * ================================================================= */

  /**
   * Perform a comprehensive startup diagnostic across every registered
   * system.  Returns a structured report with pass/fail per system and
   * an overall verdict.
   *
   * @returns {Promise<Object>} Diagnostic report
   */
  async runDiagnostics() {
    const report = {
      startedAt: Date.now(),
      systemCount: this.systems.size,
      results: {},
      passed: 0,
      failed: 0,
      warnings: 0,
      overallVerdict: 'PASS',
    };

    for (const [name, entry] of this.systems) {
      const result = { name, status: 'UNKNOWN', message: '', durationMs: 0 };
      const t0 = Date.now();

      try {
        await this._checkSystem(name, entry);

        result.status = entry.status;
        result.durationMs = Date.now() - t0;
        result.message =
          entry.status === 'HEALTHY'
            ? 'System responded normally'
            : `System reports ${entry.status}`;

        if (entry.status === 'HEALTHY') {
          report.passed++;
        } else if (entry.status === 'DEGRADED') {
          report.warnings++;
        } else {
          report.failed++;
        }
      } catch (err) {
        result.status = 'ERROR';
        result.message = err.message;
        result.durationMs = Date.now() - t0;
        report.failed++;
      }

      report.results[name] = result;
    }

    // Memory guard quick-check
    const memGuard = this._resolveCompanion('memoryGuardSystem', 'MemoryGuardSystem');
    if (memGuard && typeof memGuard.getHealth === 'function') {
      try {
        const mh = await memGuard.getHealth();
        report.memoryGuard = {
          status: mh.status ?? 'UNKNOWN',
          heapUsedMB: mh.heapUsedMB ?? null,
          heapLimitMB: mh.heapLimitMB ?? null,
        };
      } catch (_) {
        report.memoryGuard = { status: 'UNAVAILABLE' };
      }
    }

    // Determine overall verdict
    if (report.failed > 0) {
      report.overallVerdict = 'FAIL';
    } else if (report.warnings > 0) {
      report.overallVerdict = 'WARN';
    }

    report.completedAt = Date.now();
    report.totalDurationMs = report.completedAt - report.startedAt;

    return report;
  }

  /* =================================================================
   *  Internal Helpers
   * ================================================================= */

  /**
   * Count systems by their current health status.
   *
   * @returns {{healthy:number, degraded:number, unhealthy:number, unresponsive:number}}
   * @private
   */
  _countByStatus() {
    let healthy = 0;
    let degraded = 0;
    let unhealthy = 0;
    let unresponsive = 0;

    for (const entry of this.systems.values()) {
      switch (entry.status) {
        case 'HEALTHY':      healthy++;      break;
        case 'DEGRADED':     degraded++;     break;
        case 'UNHEALTHY':    unhealthy++;    break;
        case 'UNRESPONSIVE': unresponsive++; break;
      }
    }

    return { healthy, degraded, unhealthy, unresponsive };
  }

  /**
   * Calculate approximate uptime percentage from history snapshots.
   *
   * @returns {number} Uptime as a percentage (0-100)
   * @private
   */
  _calculateUptimePercent() {
    if (this.healthHistory.length === 0) return 100;

    const aboveThreshold = this.healthHistory.filter(
      (s) => s.overallScore >= this.alertThreshold,
    ).length;

    return Math.round((aboveThreshold / this.healthHistory.length) * 10000) / 100;
  }

  /**
   * Return the most-recent poll timestamp across all systems.
   *
   * @returns {number}
   * @private
   */
  _lastPollTimestamp() {
    let latest = 0;
    for (const entry of this.systems.values()) {
      if (entry.lastChecked > latest) latest = entry.lastChecked;
    }
    return latest;
  }
}

module.exports = SystemHealthDashboard;
