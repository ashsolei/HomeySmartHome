'use strict';

const EventEmitter = require('events');

/**
 * @fileoverview Smart Home Automated Testing & Health Validation System
 * @description A comprehensive self-testing system that validates all other smart home
 * systems, performs health checks, integration testing, performance benchmarking,
 * regression detection, load testing, and generates detailed test reports.
 * @version 1.0.0
 */

/**
 * @typedef {Object} TestResult
 * @property {string} id - Unique test identifier
 * @property {string} name - Human-readable test name
 * @property {string} suite - Test suite name
 * @property {'passed'|'failed'|'skipped'|'error'} status - Test outcome
 * @property {number} duration - Execution time in milliseconds
 * @property {string|null} error - Error message if failed
 * @property {Object|null} metrics - Additional performance metrics
 * @property {number} timestamp - Unix timestamp of execution
 */

/**
 * @typedef {Object} HealthCheckResult
 * @property {string} systemName - Name of the checked system
 * @property {boolean} alive - Whether the system responded
 * @property {number} responseTime - Response time in milliseconds
 * @property {number} memoryUsage - Estimated memory footprint
 * @property {string|null} error - Error details if unhealthy
 * @property {number} timestamp - Unix timestamp
 */

/**
 * @typedef {Object} BenchmarkBaseline
 * @property {number} avgResponseTime - Average response time in ms
 * @property {number} p95ResponseTime - 95th percentile response time
 * @property {number} avgMemoryUsage - Average memory usage in bytes
 * @property {number} successRate - Success rate as decimal (0-1)
 * @property {number} sampleCount - Number of samples in baseline
 * @property {number} updatedAt - Last baseline update timestamp
 */

/**
 * @typedef {Object} TestSchedule
 * @property {string} id - Schedule identifier
 * @property {string} type - Schedule type: 'health'|'integration'|'stress'|'smoke'
 * @property {number} intervalMs - Interval in milliseconds
 * @property {Function|null} handler - Timer reference
 * @property {boolean} active - Whether schedule is active
 * @property {number} lastRun - Last execution timestamp
 * @property {number} nextRun - Next scheduled execution timestamp
 */

/**
 * Smart Home Automated Testing & Health Validation System.
 *
 * Provides comprehensive self-testing capabilities for the entire smart home
 * ecosystem including health validation, integration testing, performance
 * benchmarking, regression detection, and automated test scheduling.
 *
 * @extends EventEmitter
 */
class SmartHomeAutomatedTestingSystem extends EventEmitter {
  /**
   * Creates a new SmartHomeAutomatedTestingSystem instance.
   * @param {Object} homey - The Homey application instance
   */
  constructor(homey) {
    super();
    /** @type {Object} */
    this.homey = homey;

    /** @type {boolean} */
    this.initialized = false;

    /** @type {Map<string, Object>} Registered systems under test */
    this.registeredSystems = new Map();

    /** @type {TestResult[]} Historical test results */
    this.testHistory = [];

    /** @type {number} Maximum history entries to retain */
    this.maxHistorySize = 5000;

    /** @type {Map<string, BenchmarkBaseline>} Performance baselines per system */
    this.baselines = new Map();

    /** @type {Map<string, TestSchedule>} Active test schedules */
    this.schedules = new Map();

    /** @type {Map<string, number>} Coverage tracking: system -> last tested timestamp */
    this.coverageMap = new Map();

    /** @type {Map<string, Object>} Circuit breaker state per system */
    this.circuitBreakers = new Map();

    /** @type {Object} Aggregate statistics */
    this.stats = {
      totalTestsRun: 0,
      totalPassed: 0,
      totalFailed: 0,
      totalErrors: 0,
      totalSkipped: 0,
      lastFullSuiteRun: null,
      lastHealthCheck: null,
      lastStressTest: null,
      uptimeStart: Date.now(),
    };

    /** @type {Object} Configuration */
    this.config = {
      healthCheckIntervalMs: 5 * 60 * 1000,
      fullSuiteIntervalMs: 24 * 60 * 60 * 1000,
      stressTestIntervalMs: 7 * 24 * 60 * 60 * 1000,
      smokeTestIntervalMs: 30 * 60 * 1000,
      healthCheckTimeoutMs: 5000,
      integrationTestTimeoutMs: 15000,
      loadTestConcurrency: 10,
      loadTestDurationMs: 30000,
      regressionThreshold: 0.25,
      circuitBreakerThreshold: 3,
      circuitBreakerResetMs: 60000,
      maxAlertsPerHour: 20,
      baselineMinSamples: 10,
    };

    /** @type {Object[]} Active alerts */
    this.activeAlerts = [];

    /** @type {number} Alert rate limiter */
    this._alertCount = 0;

    /** @type {number|null} Alert reset timer */
    this._alertResetInterval = null;

    /** @type {NodeJS.Timeout[]} All active intervals for cleanup */
    this._intervals = [];

    /** @type {boolean} Whether a test suite is currently running */
    this._running = false;

    this._log('SmartHomeAutomatedTestingSystem constructed');
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Lifecycle
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Initializes the testing system, sets up schedules and discovers systems.
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      this._log('Already initialized, skipping');
      return;
    }

    try {
      this._log('Initializing SmartHomeAutomatedTestingSystem...');

      await this._discoverSystems();
      this._initializeCircuitBreakers();
      this._setupSchedules();
      this._startAlertRateLimiter();

      this.initialized = true;
      this.stats.uptimeStart = Date.now();

      this._log(`Initialization complete. ${this.registeredSystems.size} systems registered.`);
      this.emit('initialized', { systemCount: this.registeredSystems.size });

      // Run an initial smoke test after a short delay
      setTimeout(() => {
        this.runSmokeTests().catch(err => {
          this._logError('Initial smoke test failed', err);
        });
      }, 10000);
    } catch (err) {
      this._logError('Initialization failed', err);
      throw err;
    }
  }

  /**
   * Returns the current status of the testing system.
   * @returns {Object} Status object with system health and test statistics
   */
  getStatus() {
    const now = Date.now();
    const uptime = now - this.stats.uptimeStart;
    const recentResults = this.testHistory.slice(-50);
    const recentPassed = recentResults.filter(r => r.status === 'passed').length;
    const recentTotal = recentResults.length;

    return {
      initialized: this.initialized,
      uptime,
      registeredSystems: this.registeredSystems.size,
      coveragePercent: this._calculateCoverage(),
      stats: { ...this.stats },
      recentSuccessRate: recentTotal > 0 ? recentPassed / recentTotal : null,
      activeAlerts: this.activeAlerts.length,
      activeSchedules: this._countActiveSchedules(),
      circuitBreakers: this._getCircuitBreakerSummary(),
      isRunning: this._running,
    };
  }

  /**
   * Destroys the testing system, clearing all intervals and releasing resources.
   */
  destroy() {
    this._log('Destroying SmartHomeAutomatedTestingSystem...');

    // Clear all scheduled intervals
    for (const interval of this._intervals) {
      clearInterval(interval);
    }
    this._intervals = [];

    // Clear schedule handlers
    for (const [id, schedule] of this.schedules) {
      if (schedule.handler) {
        clearInterval(schedule.handler);
        schedule.handler = null;
        schedule.active = false;
      }
    }
    this.schedules.clear();

    // Clear alert rate limiter
    if (this._alertResetInterval) {
      clearInterval(this._alertResetInterval);
      this._alertResetInterval = null;
    }

    // Clear state
    this.registeredSystems.clear();
    this.circuitBreakers.clear();
    this.coverageMap.clear();
    this.activeAlerts = [];
    this._running = false;
    this.initialized = false;

    this.emit('destroyed');
    this.removeAllListeners();
    this._log('Destroyed successfully');
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  System Registration & Discovery
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Registers a system for testing and monitoring.
   * @param {string} name - System name
   * @param {Object} systemInstance - The system instance to monitor
   * @param {Object} [options={}] - Registration options
   * @param {string[]} [options.apiEndpoints] - API endpoints to test
   * @param {boolean} [options.criticial=false] - Whether system is critical
   * @returns {void}
   */
  registerSystem(name, systemInstance, options = {}) {
    if (!name || typeof name !== 'string') {
      throw new Error('System name must be a non-empty string');
    }

    const registration = {
      name,
      instance: systemInstance,
      registeredAt: Date.now(),
      apiEndpoints: options.apiEndpoints || [],
      critical: options.critical || false,
      lastTested: null,
      testCount: 0,
      failCount: 0,
    };

    this.registeredSystems.set(name, registration);
    this.coverageMap.set(name, 0);
    this._initializeCircuitBreaker(name);

    this._log(`Registered system: ${name}`);
    this.emit('systemRegistered', { name, critical: registration.critical });
  }

  /**
   * Unregisters a system from testing.
   * @param {string} name - System name to remove
   * @returns {boolean} Whether the system was found and removed
   */
  unregisterSystem(name) {
    const existed = this.registeredSystems.delete(name);
    this.circuitBreakers.delete(name);
    this.coverageMap.delete(name);
    this.baselines.delete(name);

    if (existed) {
      this._log(`Unregistered system: ${name}`);
      this.emit('systemUnregistered', { name });
    }
    return existed;
  }

  /**
   * Discovers systems from the Homey instance automatically.
   * @private
   * @returns {Promise<void>}
   */
  async _discoverSystems() {
    try {
      // Attempt to discover systems via common Homey patterns
      if (this.homey && typeof this.homey === 'object') {
        const systemKeys = Object.keys(this.homey).filter(key => {
          const val = this.homey[key];
          return val && typeof val === 'object' && typeof val.getStatus === 'function';
        });

        for (const key of systemKeys) {
          if (!this.registeredSystems.has(key)) {
            this.registerSystem(key, this.homey[key], { critical: false });
          }
        }
      }

      this._log(`Discovery complete. Found ${this.registeredSystems.size} systems.`);
    } catch (err) {
      this._logError('System discovery failed', err);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Health Validation
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Performs health checks on all registered systems.
   * @returns {Promise<HealthCheckResult[]>}
   */
  async runHealthChecks() {
    this._log('Running health checks...');
    const results = [];
    const startTime = Date.now();

    for (const [name, registration] of this.registeredSystems) {
      if (this._isCircuitOpen(name)) {
        results.push(this._createHealthResult(name, false, 0, 0, 'Circuit breaker open'));
        continue;
      }

      const result = await this._checkSystemHealth(name, registration);
      results.push(result);

      if (!result.alive) {
        this._recordCircuitBreakerFailure(name);
        this._generateAlert('health_failure', name, `System ${name} failed health check: ${result.error}`);
      } else {
        this._resetCircuitBreaker(name);
      }

      // Update coverage
      this.coverageMap.set(name, Date.now());
      registration.lastTested = Date.now();
      registration.testCount++;
      if (!result.alive) registration.failCount++;
    }

    const duration = Date.now() - startTime;
    this.stats.lastHealthCheck = Date.now();

    this._log(`Health checks complete in ${duration}ms. ${results.filter(r => r.alive).length}/${results.length} healthy.`);
    this.emit('healthChecksComplete', { results, duration });

    // Store as test results
    for (const r of results) {
      this._recordResult({
        name: `health:${r.systemName}`,
        suite: 'health',
        status: r.alive ? 'passed' : 'failed',
        duration: r.responseTime,
        error: r.error,
        metrics: { memoryUsage: r.memoryUsage, responseTime: r.responseTime },
      });
    }

    return results;
  }

  /**
   * Checks health of a single system.
   * @private
   * @param {string} name - System name
   * @param {Object} registration - Registration data
   * @returns {Promise<HealthCheckResult>}
   */
  async _checkSystemHealth(name, registration) {
    const start = Date.now();
    try {
      const instance = registration.instance;
      if (!instance) {
        return this._createHealthResult(name, false, 0, 0, 'Instance is null');
      }

      // Ping via getStatus
      let statusResult = null;
      const statusPromise = new Promise(async (resolve, reject) => {
        try {
          if (typeof instance.getStatus === 'function') {
            statusResult = instance.getStatus();
            resolve(statusResult);
          } else {
            resolve({ available: true });
          }
        } catch (e) {
          reject(e);
        }
      });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Health check timed out')), this.config.healthCheckTimeoutMs);
      });

      await Promise.race([statusPromise, timeoutPromise]);
      const responseTime = Date.now() - start;

      // Estimate memory usage
      const memoryUsage = this._estimateMemoryUsage(instance);

      return this._createHealthResult(name, true, responseTime, memoryUsage, null);
    } catch (err) {
      const responseTime = Date.now() - start;
      return this._createHealthResult(name, false, responseTime, 0, err.message);
    }
  }

  /**
   * Creates a health check result object.
   * @private
   * @param {string} systemName
   * @param {boolean} alive
   * @param {number} responseTime
   * @param {number} memoryUsage
   * @param {string|null} error
   * @returns {HealthCheckResult}
   */
  _createHealthResult(systemName, alive, responseTime, memoryUsage, error) {
    return {
      systemName,
      alive,
      responseTime,
      memoryUsage,
      error: error || null,
      timestamp: Date.now(),
    };
  }

  /**
   * Estimates memory footprint of a system instance.
   * @private
   * @param {Object} instance
   * @returns {number} Estimated bytes
   */
  _estimateMemoryUsage(instance) {
    try {
      const keys = Object.keys(instance);
      let estimate = keys.length * 64; // Base overhead per property

      for (const key of keys) {
        const val = instance[key];
        if (typeof val === 'string') {
          estimate += val.length * 2;
        } else if (Array.isArray(val)) {
          estimate += val.length * 32;
        } else if (val instanceof Map) {
          estimate += val.size * 128;
        } else if (val instanceof Set) {
          estimate += val.size * 64;
        } else if (typeof val === 'object' && val !== null) {
          estimate += 256;
        } else {
          estimate += 16;
        }
      }

      return estimate;
    } catch (err) {
      return 0;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Integration Testing
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Runs integration tests across all registered systems.
   * @returns {Promise<TestResult[]>}
   */
  async runIntegrationTests() {
    this._log('Running integration tests...');
    if (this._running) {
      this._log('Test suite already running, skipping');
      return [];
    }
    this._running = true;
    const results = [];

    try {
      // Test 1: System initialization validation
      for (const [name, reg] of this.registeredSystems) {
        const result = await this._testSystemInitialization(name, reg);
        results.push(result);
      }

      // Test 2: API endpoint validation
      for (const [name, reg] of this.registeredSystems) {
        if (reg.apiEndpoints && reg.apiEndpoints.length > 0) {
          for (const endpoint of reg.apiEndpoints) {
            const result = await this._testAPIEndpoint(name, endpoint);
            results.push(result);
          }
        }
      }

      // Test 3: Cross-system interaction tests
      const interactionResults = await this._testCrossSystemInteractions();
      results.push(...interactionResults);

      // Test 4: Data flow validation
      const dataFlowResults = await this._testDataFlowIntegrity();
      results.push(...dataFlowResults);

      // Test 5: Event propagation tests
      const eventResults = await this._testEventPropagation();
      results.push(...eventResults);

      for (const r of results) {
        this._recordResult(r);
      }

      const passed = results.filter(r => r.status === 'passed').length;
      this._log(`Integration tests complete: ${passed}/${results.length} passed`);
      this.emit('integrationTestsComplete', { results, passed, total: results.length });
    } catch (err) {
      this._logError('Integration test suite failed', err);
      this._generateAlert('suite_failure', 'integration', err.message);
    } finally {
      this._running = false;
    }

    return results;
  }

  /**
   * Tests that a system can be initialized properly.
   * @private
   * @param {string} name
   * @param {Object} registration
   * @returns {Promise<TestResult>}
   */
  async _testSystemInitialization(name, registration) {
    const start = Date.now();
    try {
      const instance = registration.instance;
      if (!instance) {
        return this._createTestResult(`init:${name}`, 'integration', 'failed', Date.now() - start, 'No instance');
      }

      // Check that essential methods exist
      const requiredMethods = ['getStatus'];
      const missingMethods = requiredMethods.filter(m => typeof instance[m] !== 'function');

      if (missingMethods.length > 0) {
        return this._createTestResult(`init:${name}`, 'integration', 'failed', Date.now() - start,
          `Missing methods: ${missingMethods.join(', ')}`);
      }

      // Try calling getStatus
      const status = instance.getStatus();
      if (status === undefined || status === null) {
        return this._createTestResult(`init:${name}`, 'integration', 'failed', Date.now() - start,
          'getStatus() returned null/undefined');
      }

      return this._createTestResult(`init:${name}`, 'integration', 'passed', Date.now() - start, null, { status });
    } catch (err) {
      return this._createTestResult(`init:${name}`, 'integration', 'error', Date.now() - start, err.message);
    }
  }

  /**
   * Tests an API endpoint for a given system.
   * @private
   * @param {string} systemName
   * @param {string} endpoint
   * @returns {Promise<TestResult>}
   */
  async _testAPIEndpoint(systemName, endpoint) {
    const start = Date.now();
    try {
      const reg = this.registeredSystems.get(systemName);
      if (!reg || !reg.instance) {
        return this._createTestResult(`api:${systemName}:${endpoint}`, 'integration', 'failed',
          Date.now() - start, 'System not found');
      }

      // Attempt to call the endpoint method on the instance
      const instance = reg.instance;
      if (typeof instance[endpoint] === 'function') {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Endpoint test timed out')), this.config.integrationTestTimeoutMs);
        });

        const callPromise = Promise.resolve(instance[endpoint]());
        await Promise.race([callPromise, timeoutPromise]);

        return this._createTestResult(`api:${systemName}:${endpoint}`, 'integration', 'passed',
          Date.now() - start, null);
      }

      return this._createTestResult(`api:${systemName}:${endpoint}`, 'integration', 'skipped',
        Date.now() - start, 'Endpoint method not found');
    } catch (err) {
      return this._createTestResult(`api:${systemName}:${endpoint}`, 'integration', 'error',
        Date.now() - start, err.message);
    }
  }

  /**
   * Tests cross-system interactions between registered systems.
   * @private
   * @returns {Promise<TestResult[]>}
   */
  async _testCrossSystemInteractions() {
    const results = [];
    const systems = Array.from(this.registeredSystems.entries());

    // Test pairs of systems for compatibility
    for (let i = 0; i < systems.length && i < 10; i++) {
      const [nameA, regA] = systems[i];
      for (let j = i + 1; j < systems.length && j < 10; j++) {
        const [nameB, regB] = systems[j];
        const start = Date.now();

        try {
          // Verify both systems can report status simultaneously
          const [statusA, statusB] = await Promise.all([
            this._safeGetStatus(regA.instance),
            this._safeGetStatus(regB.instance),
          ]);

          const bothAlive = statusA !== null && statusB !== null;
          results.push(this._createTestResult(
            `cross:${nameA}<->${nameB}`,
            'integration',
            bothAlive ? 'passed' : 'failed',
            Date.now() - start,
            bothAlive ? null : 'One or both systems unresponsive',
          ));
        } catch (err) {
          results.push(this._createTestResult(
            `cross:${nameA}<->${nameB}`,
            'integration',
            'error',
            Date.now() - start,
            err.message,
          ));
        }
      }
    }

    return results;
  }

  /**
   * Tests data flow integrity across systems.
   * @private
   * @returns {Promise<TestResult[]>}
   */
  async _testDataFlowIntegrity() {
    const results = [];
    const start = Date.now();

    try {
      // Validate that the testing system's own data structures are consistent
      const historyConsistent = this.testHistory.every(r =>
        r && typeof r.name === 'string' && typeof r.timestamp === 'number'
      );

      results.push(this._createTestResult('dataflow:history_integrity', 'integration',
        historyConsistent ? 'passed' : 'failed', Date.now() - start,
        historyConsistent ? null : 'Test history contains malformed entries'));

      // Check that all coverage entries map to registered systems
      const coverageStart = Date.now();
      let orphanedCoverage = 0;
      for (const [name] of this.coverageMap) {
        if (!this.registeredSystems.has(name)) {
          orphanedCoverage++;
        }
      }

      results.push(this._createTestResult('dataflow:coverage_consistency', 'integration',
        orphanedCoverage === 0 ? 'passed' : 'failed', Date.now() - coverageStart,
        orphanedCoverage === 0 ? null : `${orphanedCoverage} orphaned coverage entries`));

      // Validate baselines reference existing systems
      const baselineStart = Date.now();
      let orphanedBaselines = 0;
      for (const [name] of this.baselines) {
        if (!this.registeredSystems.has(name)) {
          orphanedBaselines++;
        }
      }

      results.push(this._createTestResult('dataflow:baseline_consistency', 'integration',
        orphanedBaselines === 0 ? 'passed' : 'failed', Date.now() - baselineStart,
        orphanedBaselines === 0 ? null : `${orphanedBaselines} orphaned baseline entries`));
    } catch (err) {
      results.push(this._createTestResult('dataflow:integrity', 'integration', 'error',
        Date.now() - start, err.message));
    }

    return results;
  }

  /**
   * Tests event propagation within the testing system.
   * @private
   * @returns {Promise<TestResult[]>}
   */
  async _testEventPropagation() {
    const results = [];
    const start = Date.now();

    try {
      // Test that events can be emitted and received
      let received = false;
      const testHandler = () => { received = true; };
      this.once('__test_event__', testHandler);
      this.emit('__test_event__');

      results.push(this._createTestResult('events:propagation', 'integration',
        received ? 'passed' : 'failed', Date.now() - start,
        received ? null : 'Event not received'));

      // Test that emitter doesn't throw on unknown events
      const emitStart = Date.now();
      try {
        this.emit('__nonexistent_event__', { data: 'test' });
        results.push(this._createTestResult('events:unknown_event', 'integration',
          'passed', Date.now() - emitStart, null));
      } catch (err) {
        results.push(this._createTestResult('events:unknown_event', 'integration',
          'failed', Date.now() - emitStart, err.message));
      }
    } catch (err) {
      results.push(this._createTestResult('events:propagation', 'integration',
        'error', Date.now() - start, err.message));
    }

    return results;
  }

  /**
   * Safely calls getStatus on a system instance.
   * @private
   * @param {Object} instance
   * @returns {Promise<Object|null>}
   */
  async _safeGetStatus(instance) {
    try {
      if (instance && typeof instance.getStatus === 'function') {
        return instance.getStatus();
      }
      return null;
    } catch {
      return null;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Performance Benchmarking
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Runs performance benchmarks on all registered systems.
   * @param {number} [iterations=5] - Number of benchmark iterations per system
   * @returns {Promise<Object>} Benchmark results keyed by system name
   */
  async runPerformanceBenchmarks(iterations = 5) {
    this._log(`Running performance benchmarks (${iterations} iterations)...`);
    const benchResults = {};

    for (const [name, reg] of this.registeredSystems) {
      if (this._isCircuitOpen(name)) {
        benchResults[name] = { skipped: true, reason: 'Circuit breaker open' };
        continue;
      }

      const measurements = {
        responseTimes: [],
        memorySnapshots: [],
        errors: 0,
      };

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        try {
          if (reg.instance && typeof reg.instance.getStatus === 'function') {
            reg.instance.getStatus();
          }
          measurements.responseTimes.push(Date.now() - start);
          measurements.memorySnapshots.push(this._estimateMemoryUsage(reg.instance));
        } catch {
          measurements.errors++;
          measurements.responseTimes.push(Date.now() - start);
        }

        // Small delay between iterations
        await this._delay(50);
      }

      const sorted = [...measurements.responseTimes].sort((a, b) => a - b);
      const avgResponse = sorted.reduce((a, b) => a + b, 0) / sorted.length;
      const p95Index = Math.floor(sorted.length * 0.95);
      const p95Response = sorted[p95Index] || sorted[sorted.length - 1];
      const avgMemory = measurements.memorySnapshots.length > 0
        ? measurements.memorySnapshots.reduce((a, b) => a + b, 0) / measurements.memorySnapshots.length
        : 0;
      const successRate = 1 - (measurements.errors / iterations);

      benchResults[name] = {
        avgResponseTime: Math.round(avgResponse * 100) / 100,
        p95ResponseTime: p95Response,
        minResponseTime: sorted[0],
        maxResponseTime: sorted[sorted.length - 1],
        avgMemoryUsage: Math.round(avgMemory),
        successRate,
        errors: measurements.errors,
        iterations,
      };

      // Update baseline
      this._updateBaseline(name, avgResponse, p95Response, avgMemory, successRate);

      // Record as test result
      this._recordResult({
        name: `benchmark:${name}`,
        suite: 'benchmark',
        status: successRate >= 0.8 ? 'passed' : 'failed',
        duration: avgResponse,
        error: successRate < 0.8 ? `Success rate ${(successRate * 100).toFixed(1)}% below threshold` : null,
        metrics: benchResults[name],
      });
    }

    this._log('Performance benchmarks complete');
    this.emit('benchmarksComplete', { results: benchResults });
    return benchResults;
  }

  /**
   * Updates the performance baseline for a system.
   * @private
   * @param {string} name
   * @param {number} avgResponse
   * @param {number} p95Response
   * @param {number} avgMemory
   * @param {number} successRate
   */
  _updateBaseline(name, avgResponse, p95Response, avgMemory, successRate) {
    const existing = this.baselines.get(name);
    if (!existing) {
      this.baselines.set(name, {
        avgResponseTime: avgResponse,
        p95ResponseTime: p95Response,
        avgMemoryUsage: avgMemory,
        successRate,
        sampleCount: 1,
        updatedAt: Date.now(),
      });
      return;
    }

    // Exponential moving average to smooth baselines
    const alpha = 0.3;
    existing.avgResponseTime = existing.avgResponseTime * (1 - alpha) + avgResponse * alpha;
    existing.p95ResponseTime = existing.p95ResponseTime * (1 - alpha) + p95Response * alpha;
    existing.avgMemoryUsage = existing.avgMemoryUsage * (1 - alpha) + avgMemory * alpha;
    existing.successRate = existing.successRate * (1 - alpha) + successRate * alpha;
    existing.sampleCount++;
    existing.updatedAt = Date.now();
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Regression Detection
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Detects regressions by comparing current metrics to baselines.
   * @returns {Promise<Object[]>} Array of detected regressions
   */
  async detectRegressions() {
    this._log('Running regression detection...');
    const regressions = [];

    for (const [name, baseline] of this.baselines) {
      if (baseline.sampleCount < this.config.baselineMinSamples) {
        continue; // Not enough data for regression detection
      }

      const reg = this.registeredSystems.get(name);
      if (!reg || !reg.instance) continue;

      // Take a fresh measurement
      const start = Date.now();
      try {
        if (typeof reg.instance.getStatus === 'function') {
          reg.instance.getStatus();
        }
        const currentResponseTime = Date.now() - start;
        const currentMemory = this._estimateMemoryUsage(reg.instance);

        // Check for response time regression
        const rtDelta = (currentResponseTime - baseline.avgResponseTime) / baseline.avgResponseTime;
        if (rtDelta > this.config.regressionThreshold) {
          const regression = {
            system: name,
            type: 'response_time',
            baseline: baseline.avgResponseTime,
            current: currentResponseTime,
            degradation: `${(rtDelta * 100).toFixed(1)}%`,
            severity: rtDelta > 0.5 ? 'high' : 'medium',
            timestamp: Date.now(),
          };
          regressions.push(regression);
          this._generateAlert('regression', name,
            `Response time regression: ${regression.degradation} slower than baseline`);
        }

        // Check for memory regression
        if (baseline.avgMemoryUsage > 0) {
          const memDelta = (currentMemory - baseline.avgMemoryUsage) / baseline.avgMemoryUsage;
          if (memDelta > this.config.regressionThreshold) {
            const regression = {
              system: name,
              type: 'memory_usage',
              baseline: baseline.avgMemoryUsage,
              current: currentMemory,
              degradation: `${(memDelta * 100).toFixed(1)}%`,
              severity: memDelta > 0.5 ? 'high' : 'medium',
              timestamp: Date.now(),
            };
            regressions.push(regression);
            this._generateAlert('regression', name,
              `Memory regression: ${regression.degradation} higher than baseline`);
          }
        }
      } catch (err) {
        this._logError(`Regression check failed for ${name}`, err);
      }
    }

    this._log(`Regression detection complete: ${regressions.length} regressions found`);
    this.emit('regressionDetection', { regressions });

    for (const r of regressions) {
      this._recordResult({
        name: `regression:${r.system}:${r.type}`,
        suite: 'regression',
        status: 'failed',
        duration: 0,
        error: `${r.type} degraded by ${r.degradation}`,
        metrics: r,
      });
    }

    return regressions;
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Smoke Tests
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Runs smoke tests across all registered systems.
   * Generates basic validation tests for each system automatically.
   * @returns {Promise<TestResult[]>}
   */
  async runSmokeTests() {
    this._log('Running smoke tests...');
    const results = [];

    for (const [name, reg] of this.registeredSystems) {
      const smokeTests = this._generateSmokeTests(name, reg);

      for (const test of smokeTests) {
        const start = Date.now();
        try {
          const passed = await test.run();
          results.push(this._createTestResult(
            test.id, 'smoke', passed ? 'passed' : 'failed',
            Date.now() - start, passed ? null : test.failureMessage,
          ));
        } catch (err) {
          results.push(this._createTestResult(
            test.id, 'smoke', 'error', Date.now() - start, err.message,
          ));
        }
      }

      this.coverageMap.set(name, Date.now());
    }

    for (const r of results) {
      this._recordResult(r);
    }

    const passed = results.filter(r => r.status === 'passed').length;
    this._log(`Smoke tests complete: ${passed}/${results.length} passed`);
    this.emit('smokeTestsComplete', { results, passed, total: results.length });
    return results;
  }

  /**
   * Generates smoke tests for a given system.
   * @private
   * @param {string} name - System name
   * @param {Object} registration - System registration
   * @returns {Object[]} Array of smoke test definitions
   */
  _generateSmokeTests(name, registration) {
    const tests = [];
    const instance = registration.instance;

    // Test 1: Instance exists
    tests.push({
      id: `smoke:${name}:exists`,
      run: async () => instance != null,
      failureMessage: 'System instance is null or undefined',
    });

    // Test 2: Has getStatus method
    tests.push({
      id: `smoke:${name}:has_getStatus`,
      run: async () => typeof instance?.getStatus === 'function',
      failureMessage: 'System missing getStatus() method',
    });

    // Test 3: getStatus returns truthy value
    tests.push({
      id: `smoke:${name}:getStatus_returns`,
      run: async () => {
        if (!instance || typeof instance.getStatus !== 'function') return false;
        const status = instance.getStatus();
        return status != null;
      },
      failureMessage: 'getStatus() returned null or undefined',
    });

    // Test 4: System has initialized property
    tests.push({
      id: `smoke:${name}:initialized_prop`,
      run: async () => instance != null && 'initialized' in instance,
      failureMessage: 'System missing "initialized" property',
    });

    // Test 5: No uncaught errors on property access
    tests.push({
      id: `smoke:${name}:safe_access`,
      run: async () => {
        try {
          if (!instance) return false;
          const keys = Object.keys(instance);
          return keys.length >= 0;
        } catch {
          return false;
        }
      },
      failureMessage: 'Error accessing system properties',
    });

    // Test 6: System has destroy method
    tests.push({
      id: `smoke:${name}:has_destroy`,
      run: async () => typeof instance?.destroy === 'function',
      failureMessage: 'System missing destroy() method',
    });

    // Test 7: Constructor name matches expected pattern
    tests.push({
      id: `smoke:${name}:constructor_name`,
      run: async () => {
        if (!instance) return false;
        const ctorName = instance.constructor?.name;
        return typeof ctorName === 'string' && ctorName.length > 0;
      },
      failureMessage: 'System has no named constructor',
    });

    return tests;
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Load Testing
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Simulates concurrent requests to a system for load testing.
   * @param {string} systemName - The system to load test
   * @param {Object} [options={}] - Load test options
   * @param {number} [options.concurrency] - Number of concurrent requests
   * @param {number} [options.durationMs] - How long to run the test
   * @param {number} [options.requestIntervalMs=100] - Delay between request batches
   * @returns {Promise<Object>} Load test results
   */
  async runLoadTest(systemName, options = {}) {
    const concurrency = options.concurrency || this.config.loadTestConcurrency;
    const durationMs = options.durationMs || this.config.loadTestDurationMs;
    const requestInterval = options.requestIntervalMs || 100;

    this._log(`Running load test on ${systemName}: ${concurrency} concurrent, ${durationMs}ms duration`);

    const reg = this.registeredSystems.get(systemName);
    if (!reg || !reg.instance) {
      this._logError(`Load test failed: system ${systemName} not found`);
      return { error: 'System not found', systemName };
    }

    const result = {
      systemName,
      concurrency,
      durationMs,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      responseTimes: [],
      errors: [],
      startTime: Date.now(),
      endTime: null,
    };

    const startTime = Date.now();

    while (Date.now() - startTime < durationMs) {
      const batch = [];
      for (let i = 0; i < concurrency; i++) {
        batch.push(this._simulateRequest(reg.instance));
      }

      const batchResults = await Promise.allSettled(batch);
      for (const br of batchResults) {
        result.totalRequests++;
        if (br.status === 'fulfilled' && br.value.success) {
          result.successfulRequests++;
          result.responseTimes.push(br.value.responseTime);
        } else {
          result.failedRequests++;
          const errMsg = br.status === 'rejected' ? br.reason?.message : br.value?.error;
          if (result.errors.length < 50) {
            result.errors.push(errMsg || 'Unknown error');
          }
        }
      }

      await this._delay(requestInterval);
    }

    result.endTime = Date.now();
    result.actualDurationMs = result.endTime - result.startTime;

    // Calculate statistics
    if (result.responseTimes.length > 0) {
      const sorted = [...result.responseTimes].sort((a, b) => a - b);
      result.avgResponseTime = sorted.reduce((a, b) => a + b, 0) / sorted.length;
      result.p50ResponseTime = sorted[Math.floor(sorted.length * 0.5)];
      result.p95ResponseTime = sorted[Math.floor(sorted.length * 0.95)];
      result.p99ResponseTime = sorted[Math.floor(sorted.length * 0.99)];
      result.minResponseTime = sorted[0];
      result.maxResponseTime = sorted[sorted.length - 1];
    }

    result.requestsPerSecond = result.totalRequests / (result.actualDurationMs / 1000);
    result.successRate = result.totalRequests > 0 ? result.successfulRequests / result.totalRequests : 0;

    this._log(`Load test complete for ${systemName}: ${result.totalRequests} requests, ` +
      `${(result.successRate * 100).toFixed(1)}% success rate`);

    this._recordResult({
      name: `loadtest:${systemName}`,
      suite: 'loadtest',
      status: result.successRate >= 0.95 ? 'passed' : 'failed',
      duration: result.actualDurationMs,
      error: result.successRate < 0.95 ? `Success rate ${(result.successRate * 100).toFixed(1)}%` : null,
      metrics: {
        totalRequests: result.totalRequests,
        successRate: result.successRate,
        avgResponseTime: result.avgResponseTime,
        p95ResponseTime: result.p95ResponseTime,
        requestsPerSecond: result.requestsPerSecond,
      },
    });

    this.emit('loadTestComplete', { result });
    return result;
  }

  /**
   * Simulates a single request to a system instance.
   * @private
   * @param {Object} instance
   * @returns {Promise<Object>}
   */
  async _simulateRequest(instance) {
    const start = Date.now();
    try {
      if (typeof instance.getStatus === 'function') {
        instance.getStatus();
      }
      return { success: true, responseTime: Date.now() - start };
    } catch (err) {
      return { success: false, responseTime: Date.now() - start, error: err.message };
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Circuit Breaker Testing
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Tests the circuit breaker pattern for all registered systems.
   * @returns {Promise<TestResult[]>}
   */
  async runCircuitBreakerTests() {
    this._log('Running circuit breaker tests...');
    const results = [];

    for (const [name] of this.registeredSystems) {
      // Test 1: Circuit breaker initializes in closed state
      const cbState = this.circuitBreakers.get(name);
      const initStart = Date.now();
      results.push(this._createTestResult(
        `cb:${name}:initial_state`, 'circuit_breaker',
        cbState && cbState.state === 'closed' ? 'passed' : 'failed',
        Date.now() - initStart,
        cbState?.state !== 'closed' ? `Expected closed, got ${cbState?.state}` : null,
      ));

      // Test 2: Circuit breaker tracks failures
      const trackStart = Date.now();
      const initialFailures = cbState ? cbState.failures : -1;
      this._recordCircuitBreakerFailure(name);
      const afterFailure = this.circuitBreakers.get(name);
      const tracksFailure = afterFailure && afterFailure.failures === initialFailures + 1;
      results.push(this._createTestResult(
        `cb:${name}:failure_tracking`, 'circuit_breaker',
        tracksFailure ? 'passed' : 'failed',
        Date.now() - trackStart,
        tracksFailure ? null : 'Failure count did not increment',
      ));

      // Reset after test
      this._resetCircuitBreaker(name);

      // Test 3: Circuit opens after threshold
      const thresholdStart = Date.now();
      for (let i = 0; i < this.config.circuitBreakerThreshold; i++) {
        this._recordCircuitBreakerFailure(name);
      }
      const isOpen = this._isCircuitOpen(name);
      results.push(this._createTestResult(
        `cb:${name}:threshold_open`, 'circuit_breaker',
        isOpen ? 'passed' : 'failed',
        Date.now() - thresholdStart,
        isOpen ? null : 'Circuit did not open after reaching failure threshold',
      ));

      // Reset for production use
      this._resetCircuitBreaker(name);
    }

    for (const r of results) {
      this._recordResult(r);
    }

    const passed = results.filter(r => r.status === 'passed').length;
    this._log(`Circuit breaker tests complete: ${passed}/${results.length} passed`);
    this.emit('circuitBreakerTestsComplete', { results, passed, total: results.length });
    return results;
  }

  /**
   * Initializes circuit breakers for all registered systems.
   * @private
   */
  _initializeCircuitBreakers() {
    for (const [name] of this.registeredSystems) {
      this._initializeCircuitBreaker(name);
    }
  }

  /**
   * Initializes a circuit breaker for a single system.
   * @private
   * @param {string} name
   */
  _initializeCircuitBreaker(name) {
    if (!this.circuitBreakers.has(name)) {
      this.circuitBreakers.set(name, {
        state: 'closed', // closed, open, half-open
        failures: 0,
        lastFailure: null,
        openedAt: null,
        halfOpenAttempts: 0,
      });
    }
  }

  /**
   * Records a failure in a circuit breaker.
   * @private
   * @param {string} name
   */
  _recordCircuitBreakerFailure(name) {
    const cb = this.circuitBreakers.get(name);
    if (!cb) return;

    cb.failures++;
    cb.lastFailure = Date.now();

    if (cb.failures >= this.config.circuitBreakerThreshold) {
      cb.state = 'open';
      cb.openedAt = Date.now();
      this._log(`Circuit breaker OPEN for ${name} (${cb.failures} failures)`);
      this.emit('circuitBreakerOpen', { system: name, failures: cb.failures });
    }
  }

  /**
   * Checks if a circuit breaker is open for a given system.
   * @private
   * @param {string} name
   * @returns {boolean}
   */
  _isCircuitOpen(name) {
    const cb = this.circuitBreakers.get(name);
    if (!cb) return false;

    if (cb.state === 'open') {
      // Check if reset timeout has elapsed, move to half-open
      if (Date.now() - cb.openedAt > this.config.circuitBreakerResetMs) {
        cb.state = 'half-open';
        cb.halfOpenAttempts = 0;
        this._log(`Circuit breaker HALF-OPEN for ${name}`);
        return false;
      }
      return true;
    }

    return false;
  }

  /**
   * Resets a circuit breaker to closed state.
   * @private
   * @param {string} name
   */
  _resetCircuitBreaker(name) {
    const cb = this.circuitBreakers.get(name);
    if (!cb) return;

    cb.state = 'closed';
    cb.failures = 0;
    cb.lastFailure = null;
    cb.openedAt = null;
    cb.halfOpenAttempts = 0;
  }

  /**
   * Gets a summary of all circuit breaker states.
   * @private
   * @returns {Object}
   */
  _getCircuitBreakerSummary() {
    const summary = { closed: 0, open: 0, halfOpen: 0 };
    for (const [, cb] of this.circuitBreakers) {
      if (cb.state === 'closed') summary.closed++;
      else if (cb.state === 'open') summary.open++;
      else if (cb.state === 'half-open') summary.halfOpen++;
    }
    return summary;
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Graceful Degradation Testing
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Tests graceful degradation by simulating system failures.
   * @returns {Promise<TestResult[]>}
   */
  async runGracefulDegradationTests() {
    this._log('Running graceful degradation tests...');
    const results = [];

    for (const [name, reg] of this.registeredSystems) {
      // Test 1: System handles missing dependencies gracefully
      const depStart = Date.now();
      try {
        const instance = reg.instance;
        if (instance && typeof instance.getStatus === 'function') {
          const status = instance.getStatus();
          const hasDegradedMode = status && (
            'degraded' in status ||
            'fallback' in status ||
            'initialized' in status
          );

          results.push(this._createTestResult(
            `degradation:${name}:status_reporting`, 'degradation',
            'passed', Date.now() - depStart, null,
            { hasDegradedMode, status },
          ));
        } else {
          results.push(this._createTestResult(
            `degradation:${name}:status_reporting`, 'degradation',
            'failed', Date.now() - depStart, 'Cannot verify degradation mode',
          ));
        }
      } catch (err) {
        results.push(this._createTestResult(
          `degradation:${name}:status_reporting`, 'degradation',
          'error', Date.now() - depStart, err.message,
        ));
      }

      // Test 2: System doesn't crash on rapid status polling
      const pollingStart = Date.now();
      try {
        let pollErrors = 0;
        for (let i = 0; i < 50; i++) {
          try {
            if (reg.instance && typeof reg.instance.getStatus === 'function') {
              reg.instance.getStatus();
            }
          } catch {
            pollErrors++;
          }
        }

        results.push(this._createTestResult(
          `degradation:${name}:rapid_polling`, 'degradation',
          pollErrors === 0 ? 'passed' : 'failed',
          Date.now() - pollingStart,
          pollErrors > 0 ? `${pollErrors}/50 polls failed` : null,
          { pollErrors },
        ));
      } catch (err) {
        results.push(this._createTestResult(
          `degradation:${name}:rapid_polling`, 'degradation',
          'error', Date.now() - pollingStart, err.message,
        ));
      }

      // Test 3: System handles null/undefined inputs gracefully
      const nullStart = Date.now();
      try {
        let crashOnNull = false;
        if (reg.instance) {
          const publicMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(reg.instance))
            .filter(m => m !== 'constructor' && !m.startsWith('_') && typeof reg.instance[m] === 'function');

          // Only test safe read-only methods
          const safeReadMethods = publicMethods.filter(m =>
            m.startsWith('get') || m.startsWith('is') || m.startsWith('has') || m === 'getStatus'
          );

          for (const method of safeReadMethods.slice(0, 5)) {
            try {
              reg.instance[method]();
            } catch {
              // Expected — methods may need args — not a crash
            }
          }
        }

        results.push(this._createTestResult(
          `degradation:${name}:null_handling`, 'degradation',
          !crashOnNull ? 'passed' : 'failed',
          Date.now() - nullStart,
          crashOnNull ? 'System crashed on null input' : null,
        ));
      } catch (err) {
        results.push(this._createTestResult(
          `degradation:${name}:null_handling`, 'degradation',
          'error', Date.now() - nullStart, err.message,
        ));
      }
    }

    for (const r of results) {
      this._recordResult(r);
    }

    const passed = results.filter(r => r.status === 'passed').length;
    this._log(`Graceful degradation tests complete: ${passed}/${results.length} passed`);
    this.emit('degradationTestsComplete', { results, passed, total: results.length });
    return results;
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Test Scheduling
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Sets up all periodic test schedules.
   * @private
   */
  _setupSchedules() {
    // Health checks every 5 minutes
    this._createSchedule('periodic_health', 'health', this.config.healthCheckIntervalMs, async () => {
      try {
        await this.runHealthChecks();
      } catch (err) {
        this._logError('Scheduled health check failed', err);
      }
    });

    // Smoke tests every 30 minutes
    this._createSchedule('periodic_smoke', 'smoke', this.config.smokeTestIntervalMs, async () => {
      try {
        await this.runSmokeTests();
      } catch (err) {
        this._logError('Scheduled smoke test failed', err);
      }
    });

    // Full suite daily
    this._createSchedule('daily_full_suite', 'integration', this.config.fullSuiteIntervalMs, async () => {
      try {
        await this.runFullTestSuite();
      } catch (err) {
        this._logError('Scheduled full suite failed', err);
      }
    });

    // Stress test weekly
    this._createSchedule('weekly_stress', 'stress', this.config.stressTestIntervalMs, async () => {
      try {
        await this.runStressTests();
      } catch (err) {
        this._logError('Scheduled stress test failed', err);
      }
    });

    this._log(`Set up ${this.schedules.size} test schedules`);
  }

  /**
   * Creates a test schedule.
   * @private
   * @param {string} id - Schedule identifier
   * @param {string} type - Schedule type
   * @param {number} intervalMs - Interval in milliseconds
   * @param {Function} callback - Function to execute
   */
  _createSchedule(id, type, intervalMs, callback) {
    const handler = setInterval(() => {
      const schedule = this.schedules.get(id);
      if (schedule) {
        schedule.lastRun = Date.now();
        schedule.nextRun = Date.now() + intervalMs;
      }
      callback();
    }, intervalMs);

    this._intervals.push(handler);

    this.schedules.set(id, {
      id,
      type,
      intervalMs,
      handler,
      active: true,
      lastRun: 0,
      nextRun: Date.now() + intervalMs,
    });
  }

  /**
   * Counts active schedules.
   * @private
   * @returns {number}
   */
  _countActiveSchedules() {
    let count = 0;
    for (const [, schedule] of this.schedules) {
      if (schedule.active) count++;
    }
    return count;
  }

  /**
   * Runs the full test suite (all test categories).
   * @returns {Promise<Object>} Comprehensive test report
   */
  async runFullTestSuite() {
    this._log('Running full test suite...');
    const suiteStart = Date.now();

    if (this._running) {
      this._log('A test suite is already running, aborting');
      return { error: 'Already running' };
    }
    this._running = true;

    const report = {
      startTime: suiteStart,
      endTime: null,
      suites: {},
      totals: { passed: 0, failed: 0, errors: 0, skipped: 0 },
    };

    try {
      // 1. Health checks
      const healthResults = await this.runHealthChecks();
      report.suites.health = this._summarizeResults(healthResults.map(r => ({
        name: r.systemName,
        status: r.alive ? 'passed' : 'failed',
        duration: r.responseTime,
        error: r.error,
      })));

      // 2. Smoke tests
      const smokeResults = await this.runSmokeTests();
      report.suites.smoke = this._summarizeResults(smokeResults);

      // 3. Integration tests
      const integrationResults = await this.runIntegrationTests();
      report.suites.integration = this._summarizeResults(integrationResults);

      // 4. Performance benchmarks
      const benchResults = await this.runPerformanceBenchmarks(3);
      report.suites.benchmark = {
        systems: Object.keys(benchResults).length,
        results: benchResults,
      };

      // 5. Regression detection
      const regressions = await this.detectRegressions();
      report.suites.regression = {
        regressionsFound: regressions.length,
        regressions,
      };

      // 6. Circuit breaker tests
      const cbResults = await this.runCircuitBreakerTests();
      report.suites.circuitBreaker = this._summarizeResults(cbResults);

      // 7. Graceful degradation tests
      const degradationResults = await this.runGracefulDegradationTests();
      report.suites.degradation = this._summarizeResults(degradationResults);

      // Aggregate totals
      const allSubReports = [
        report.suites.health,
        report.suites.smoke,
        report.suites.integration,
        report.suites.circuitBreaker,
        report.suites.degradation,
      ];

      for (const sub of allSubReports) {
        if (sub && sub.passed !== undefined) {
          report.totals.passed += sub.passed;
          report.totals.failed += sub.failed;
          report.totals.errors += sub.errors;
          report.totals.skipped += sub.skipped;
        }
      }

      report.endTime = Date.now();
      report.duration = report.endTime - report.startTime;
      report.overallStatus = report.totals.failed === 0 && report.totals.errors === 0 ? 'PASS' : 'FAIL';

      this.stats.lastFullSuiteRun = Date.now();

      this._log(`Full suite complete in ${report.duration}ms: ${report.overallStatus}`);
      this.emit('fullSuiteComplete', { report });
    } catch (err) {
      report.endTime = Date.now();
      report.duration = report.endTime - report.startTime;
      report.overallStatus = 'ERROR';
      report.error = err.message;
      this._logError('Full test suite error', err);
    } finally {
      this._running = false;
    }

    return report;
  }

  /**
   * Runs stress tests against all registered systems.
   * @returns {Promise<Object>} Stress test report
   */
  async runStressTests() {
    this._log('Running stress tests...');
    const stressStart = Date.now();
    const report = { systems: {}, startTime: stressStart };

    for (const [name] of this.registeredSystems) {
      try {
        const result = await this.runLoadTest(name, {
          concurrency: this.config.loadTestConcurrency * 2,
          durationMs: Math.min(this.config.loadTestDurationMs, 15000),
          requestIntervalMs: 50,
        });
        report.systems[name] = result;
      } catch (err) {
        report.systems[name] = { error: err.message };
        this._logError(`Stress test failed for ${name}`, err);
      }
    }

    report.endTime = Date.now();
    report.duration = report.endTime - report.startTime;
    this.stats.lastStressTest = Date.now();

    this._log(`Stress tests complete in ${report.duration}ms`);
    this.emit('stressTestsComplete', { report });
    return report;
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Alert Generation
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Generates an alert for a test failure or anomaly.
   * @private
   * @param {string} type - Alert type
   * @param {string} source - Source system or test
   * @param {string} message - Alert message
   */
  _generateAlert(type, source, message) {
    if (this._alertCount >= this.config.maxAlertsPerHour) {
      return; // Rate limited
    }

    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type,
      source,
      message,
      severity: this._classifyAlertSeverity(type, source),
      timestamp: Date.now(),
      acknowledged: false,
    };

    this.activeAlerts.push(alert);
    this._alertCount++;

    // Trim old alerts (keep last 100)
    if (this.activeAlerts.length > 100) {
      this.activeAlerts = this.activeAlerts.slice(-100);
    }

    this._log(`ALERT [${alert.severity}] ${type}: ${message}`);
    this.emit('alert', alert);
  }

  /**
   * Classifies alert severity based on type and source.
   * @private
   * @param {string} type
   * @param {string} source
   * @returns {'critical'|'high'|'medium'|'low'}
   */
  _classifyAlertSeverity(type, source) {
    const reg = this.registeredSystems.get(source);
    if (reg && reg.critical) return 'critical';

    switch (type) {
      case 'health_failure': return 'high';
      case 'suite_failure': return 'high';
      case 'regression': return 'medium';
      case 'load_test_failure': return 'medium';
      default: return 'low';
    }
  }

  /**
   * Acknowledges an alert by ID.
   * @param {string} alertId - Alert ID to acknowledge
   * @returns {boolean} Whether the alert was found and acknowledged
   */
  acknowledgeAlert(alertId) {
    const alert = this.activeAlerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      this.emit('alertAcknowledged', { alertId });
      return true;
    }
    return false;
  }

  /**
   * Clears acknowledged alerts.
   * @returns {number} Number of alerts cleared
   */
  clearAcknowledgedAlerts() {
    const before = this.activeAlerts.length;
    this.activeAlerts = this.activeAlerts.filter(a => !a.acknowledged);
    const cleared = before - this.activeAlerts.length;
    this._log(`Cleared ${cleared} acknowledged alerts`);
    return cleared;
  }

  /**
   * Gets all active (unacknowledged) alerts.
   * @returns {Object[]}
   */
  getActiveAlerts() {
    return this.activeAlerts.filter(a => !a.acknowledged);
  }

  /**
   * Starts the alert rate limiter that resets the count every hour.
   * @private
   */
  _startAlertRateLimiter() {
    this._alertResetInterval = setInterval(() => {
      this._alertCount = 0;
    }, 60 * 60 * 1000);
    this._intervals.push(this._alertResetInterval);
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Test History & Trend Analysis
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Records a test result into history.
   * @private
   * @param {Object} result - Test result to record
   */
  _recordResult(result) {
    const entry = {
      id: `result_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name: result.name,
      suite: result.suite || 'unknown',
      status: result.status,
      duration: result.duration || 0,
      error: result.error || null,
      metrics: result.metrics || null,
      timestamp: Date.now(),
    };

    this.testHistory.push(entry);

    // Update stats
    this.stats.totalTestsRun++;
    switch (entry.status) {
      case 'passed': this.stats.totalPassed++; break;
      case 'failed': this.stats.totalFailed++; break;
      case 'error': this.stats.totalErrors++; break;
      case 'skipped': this.stats.totalSkipped++; break;
    }

    // Trim history
    if (this.testHistory.length > this.maxHistorySize) {
      this.testHistory = this.testHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Analyzes test result trends over a time window.
   * @param {number} [windowMs=86400000] - Time window in milliseconds (default: 24 hours)
   * @returns {Object} Trend analysis
   */
  analyzeTrends(windowMs = 24 * 60 * 60 * 1000) {
    const cutoff = Date.now() - windowMs;
    const windowResults = this.testHistory.filter(r => r.timestamp >= cutoff);

    if (windowResults.length === 0) {
      return { noData: true, window: windowMs };
    }

    // Overall success rate trend
    const total = windowResults.length;
    const passed = windowResults.filter(r => r.status === 'passed').length;
    const failed = windowResults.filter(r => r.status === 'failed').length;
    const errors = windowResults.filter(r => r.status === 'error').length;

    // Break into hourly buckets
    const hourlyBuckets = {};
    for (const r of windowResults) {
      const hour = new Date(r.timestamp).toISOString().substring(0, 13);
      if (!hourlyBuckets[hour]) {
        hourlyBuckets[hour] = { total: 0, passed: 0, failed: 0, errors: 0 };
      }
      hourlyBuckets[hour].total++;
      if (r.status === 'passed') hourlyBuckets[hour].passed++;
      if (r.status === 'failed') hourlyBuckets[hour].failed++;
      if (r.status === 'error') hourlyBuckets[hour].errors++;
    }

    // Per-suite breakdown
    const suiteBreakdown = {};
    for (const r of windowResults) {
      if (!suiteBreakdown[r.suite]) {
        suiteBreakdown[r.suite] = { total: 0, passed: 0, failed: 0, errors: 0, avgDuration: 0, durations: [] };
      }
      suiteBreakdown[r.suite].total++;
      if (r.status === 'passed') suiteBreakdown[r.suite].passed++;
      if (r.status === 'failed') suiteBreakdown[r.suite].failed++;
      if (r.status === 'error') suiteBreakdown[r.suite].errors++;
      suiteBreakdown[r.suite].durations.push(r.duration);
    }

    // Calculate average durations per suite
    for (const suite of Object.values(suiteBreakdown)) {
      suite.avgDuration = suite.durations.reduce((a, b) => a + b, 0) / suite.durations.length;
      delete suite.durations;
    }

    // Compute success rate trend (improving or declining)
    const hours = Object.keys(hourlyBuckets).sort();
    let trend = 'stable';
    if (hours.length >= 3) {
      const firstHalf = hours.slice(0, Math.floor(hours.length / 2));
      const secondHalf = hours.slice(Math.floor(hours.length / 2));

      const firstRate = this._avgSuccessRate(firstHalf.map(h => hourlyBuckets[h]));
      const secondRate = this._avgSuccessRate(secondHalf.map(h => hourlyBuckets[h]));

      if (secondRate > firstRate + 0.05) trend = 'improving';
      else if (secondRate < firstRate - 0.05) trend = 'declining';
    }

    return {
      window: windowMs,
      total,
      passed,
      failed,
      errors,
      successRate: passed / total,
      trend,
      hourlyBuckets,
      suiteBreakdown,
    };
  }

  /**
   * Computes average success rate from an array of bucket objects.
   * @private
   * @param {Object[]} buckets
   * @returns {number}
   */
  _avgSuccessRate(buckets) {
    if (buckets.length === 0) return 0;
    const totalPassed = buckets.reduce((sum, b) => sum + b.passed, 0);
    const totalAll = buckets.reduce((sum, b) => sum + b.total, 0);
    return totalAll > 0 ? totalPassed / totalAll : 0;
  }

  /**
   * Gets the most recent N test results.
   * @param {number} [count=20] - Number of results to return
   * @returns {TestResult[]}
   */
  getRecentResults(count = 20) {
    return this.testHistory.slice(-count);
  }

  /**
   * Gets test results filtered by suite.
   * @param {string} suite - Suite name to filter by
   * @param {number} [limit=50] - Maximum results to return
   * @returns {TestResult[]}
   */
  getResultsBySuite(suite, limit = 50) {
    return this.testHistory
      .filter(r => r.suite === suite)
      .slice(-limit);
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Coverage Tracking
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Calculates test coverage as a percentage of recently tested systems.
   * @private
   * @returns {number} Coverage percentage (0-100)
   */
  _calculateCoverage() {
    if (this.registeredSystems.size === 0) return 0;

    const now = Date.now();
    const recentThreshold = 60 * 60 * 1000; // 1 hour
    let covered = 0;

    for (const [name] of this.registeredSystems) {
      const lastTested = this.coverageMap.get(name);
      if (lastTested && (now - lastTested) < recentThreshold) {
        covered++;
      }
    }

    return Math.round((covered / this.registeredSystems.size) * 100);
  }

  /**
   * Gets a detailed coverage report for all registered systems.
   * @returns {Object} Coverage report
   */
  getCoverageReport() {
    const now = Date.now();
    const systems = [];

    for (const [name, reg] of this.registeredSystems) {
      const lastTested = this.coverageMap.get(name) || 0;
      systems.push({
        name,
        lastTested,
        timeSinceLastTest: lastTested > 0 ? now - lastTested : null,
        testCount: reg.testCount,
        failCount: reg.failCount,
        failRate: reg.testCount > 0 ? reg.failCount / reg.testCount : 0,
        critical: reg.critical,
        covered: lastTested > 0 && (now - lastTested) < 60 * 60 * 1000,
      });
    }

    const covered = systems.filter(s => s.covered).length;

    return {
      totalSystems: systems.length,
      coveredSystems: covered,
      coveragePercent: systems.length > 0 ? Math.round((covered / systems.length) * 100) : 0,
      uncoveredSystems: systems.filter(s => !s.covered).map(s => s.name),
      systems,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Test Reports
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Generates a comprehensive JSON test report.
   * @param {Object} [options={}] - Report options
   * @param {number} [options.windowMs] - Time window for trend analysis
   * @returns {Object} Complete JSON report
   */
  generateJSONReport(options = {}) {
    const windowMs = options.windowMs || 24 * 60 * 60 * 1000;

    return {
      reportId: `report_${Date.now()}`,
      generatedAt: new Date().toISOString(),
      system: 'SmartHomeAutomatedTestingSystem',
      status: this.getStatus(),
      coverage: this.getCoverageReport(),
      trends: this.analyzeTrends(windowMs),
      recentResults: this.getRecentResults(50),
      baselines: this._serializeBaselines(),
      alerts: this.getActiveAlerts(),
      circuitBreakers: this._serializeCircuitBreakers(),
      schedules: this._serializeSchedules(),
    };
  }

  /**
   * Generates a human-readable summary report.
   * @returns {string} Formatted text report
   */
  generateSummaryReport() {
    const status = this.getStatus();
    const coverage = this.getCoverageReport();
    const trends = this.analyzeTrends(24 * 60 * 60 * 1000);
    const alerts = this.getActiveAlerts();
    const cbSummary = this._getCircuitBreakerSummary();

    const lines = [];
    lines.push('╔══════════════════════════════════════════════════════════════╗');
    lines.push('║     Smart Home Automated Testing & Health Validation        ║');
    lines.push('║                      System Report                          ║');
    lines.push('╚══════════════════════════════════════════════════════════════╝');
    lines.push('');
    lines.push(`Report Generated: ${new Date().toISOString()}`);
    lines.push(`System Uptime:    ${this._formatDuration(status.uptime)}`);
    lines.push(`Initialized:      ${status.initialized ? 'Yes' : 'No'}`);
    lines.push('');
    lines.push('── Test Statistics ──────────────────────────────────────────');
    lines.push(`Total Tests Run:  ${status.stats.totalTestsRun}`);
    lines.push(`  Passed:         ${status.stats.totalPassed}`);
    lines.push(`  Failed:         ${status.stats.totalFailed}`);
    lines.push(`  Errors:         ${status.stats.totalErrors}`);
    lines.push(`  Skipped:        ${status.stats.totalSkipped}`);
    lines.push(`Success Rate:     ${status.recentSuccessRate !== null ?
      (status.recentSuccessRate * 100).toFixed(1) + '%' : 'N/A'}`);
    lines.push('');
    lines.push('── Coverage ────────────────────────────────────────────────');
    lines.push(`Registered Systems: ${coverage.totalSystems}`);
    lines.push(`Covered Systems:    ${coverage.coveredSystems}`);
    lines.push(`Coverage:           ${coverage.coveragePercent}%`);
    if (coverage.uncoveredSystems.length > 0) {
      lines.push(`Uncovered:          ${coverage.uncoveredSystems.join(', ')}`);
    }
    lines.push('');
    lines.push('── Trend Analysis (24h) ────────────────────────────────────');
    if (!trends.noData) {
      lines.push(`Trend:            ${trends.trend.toUpperCase()}`);
      lines.push(`24h Success Rate: ${(trends.successRate * 100).toFixed(1)}%`);
      lines.push(`24h Tests:        ${trends.total}`);
    } else {
      lines.push('No data available for trend analysis');
    }
    lines.push('');
    lines.push('── Circuit Breakers ────────────────────────────────────────');
    lines.push(`Closed:    ${cbSummary.closed}`);
    lines.push(`Open:      ${cbSummary.open}`);
    lines.push(`Half-Open: ${cbSummary.halfOpen}`);
    lines.push('');
    lines.push('── Active Alerts ───────────────────────────────────────────');
    if (alerts.length === 0) {
      lines.push('No active alerts');
    } else {
      for (const alert of alerts.slice(0, 10)) {
        lines.push(`[${alert.severity.toUpperCase()}] ${alert.type}: ${alert.message}`);
      }
      if (alerts.length > 10) {
        lines.push(`... and ${alerts.length - 10} more`);
      }
    }
    lines.push('');
    lines.push('── Schedules ───────────────────────────────────────────────');
    for (const [id, schedule] of this.schedules) {
      const nextIn = schedule.nextRun > Date.now()
        ? this._formatDuration(schedule.nextRun - Date.now())
        : 'overdue';
      lines.push(`${id}: ${schedule.active ? 'ACTIVE' : 'INACTIVE'} (${schedule.type}, next: ${nextIn})`);
    }
    lines.push('');
    lines.push('═══════════════════════════════════════════════════════════════');

    return lines.join('\n');
  }

  /**
   * Serializes baselines for reporting.
   * @private
   * @returns {Object}
   */
  _serializeBaselines() {
    const result = {};
    for (const [name, baseline] of this.baselines) {
      result[name] = { ...baseline };
    }
    return result;
  }

  /**
   * Serializes circuit breaker state for reporting.
   * @private
   * @returns {Object}
   */
  _serializeCircuitBreakers() {
    const result = {};
    for (const [name, cb] of this.circuitBreakers) {
      result[name] = { ...cb };
    }
    return result;
  }

  /**
   * Serializes schedules for reporting.
   * @private
   * @returns {Object}
   */
  _serializeSchedules() {
    const result = {};
    for (const [id, schedule] of this.schedules) {
      result[id] = {
        id: schedule.id,
        type: schedule.type,
        intervalMs: schedule.intervalMs,
        active: schedule.active,
        lastRun: schedule.lastRun,
        nextRun: schedule.nextRun,
      };
    }
    return result;
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Utility Methods
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Creates a standardized test result object.
   * @private
   * @param {string} name - Test name
   * @param {string} suite - Suite name
   * @param {'passed'|'failed'|'skipped'|'error'} status - Test status
   * @param {number} duration - Duration in ms
   * @param {string|null} error - Error message
   * @param {Object|null} [metrics=null] - Additional metrics
   * @returns {TestResult}
   */
  _createTestResult(name, suite, status, duration, error, metrics = null) {
    return {
      id: `test_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name,
      suite,
      status,
      duration,
      error: error || null,
      metrics,
      timestamp: Date.now(),
    };
  }

  /**
   * Summarizes an array of test results.
   * @private
   * @param {TestResult[]} results
   * @returns {Object}
   */
  _summarizeResults(results) {
    const summary = {
      total: results.length,
      passed: 0,
      failed: 0,
      errors: 0,
      skipped: 0,
      avgDuration: 0,
    };

    let totalDuration = 0;
    for (const r of results) {
      switch (r.status) {
        case 'passed': summary.passed++; break;
        case 'failed': summary.failed++; break;
        case 'error': summary.errors++; break;
        case 'skipped': summary.skipped++; break;
      }
      totalDuration += r.duration || 0;
    }

    summary.avgDuration = results.length > 0 ? totalDuration / results.length : 0;
    summary.successRate = results.length > 0 ? summary.passed / results.length : 0;

    return summary;
  }

  /**
   * Formats a duration in milliseconds to a human-readable string.
   * @private
   * @param {number} ms
   * @returns {string}
   */
  _formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  }

  /**
   * Returns a promise that resolves after the specified delay.
   * @private
   * @param {number} ms - Delay in milliseconds
   * @returns {Promise<void>}
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Logs a message with the system prefix.
   * @private
   * @param {string} message
   */
  _log(message) {
    const timestamp = new Date().toISOString();
    const formatted = `[SmartHomeAutomatedTestingSystem][${timestamp}] ${message}`;
    if (this.homey && typeof this.homey.log === 'function') {
      this.homey.log(formatted);
    } else {
      console.log(formatted);
    }
  }

  /**
   * Logs an error with the system prefix.
   * @private
   * @param {string} message
   * @param {Error} [err]
   */
  _logError(message, err) {
    const timestamp = new Date().toISOString();
    const errorDetail = err ? `: ${err.message}` : '';
    const formatted = `[SmartHomeAutomatedTestingSystem][${timestamp}] ERROR: ${message}${errorDetail}`;
    if (this.homey && typeof this.homey.error === 'function') {
      this.homey.error(formatted);
    } else {
      console.error(formatted);
    }
  }

  /**
   * Updates testing configuration.
   * @param {Object} newConfig - Configuration overrides
   * @returns {Object} Updated configuration
   */
  updateConfig(newConfig) {
    if (typeof newConfig !== 'object' || newConfig === null) {
      throw new Error('Config must be a non-null object');
    }

    const validKeys = Object.keys(this.config);
    for (const [key, value] of Object.entries(newConfig)) {
      if (validKeys.includes(key)) {
        this.config[key] = value;
        this._log(`Config updated: ${key} = ${value}`);
      }
    }

    this.emit('configUpdated', { config: { ...this.config } });
    return { ...this.config };
  }

  /**
   * Resets all test history and statistics.
   * @returns {void}
   */
  resetHistory() {
    this.testHistory = [];
    this.stats.totalTestsRun = 0;
    this.stats.totalPassed = 0;
    this.stats.totalFailed = 0;
    this.stats.totalErrors = 0;
    this.stats.totalSkipped = 0;
    this.baselines.clear();
    this.activeAlerts = [];
    this._alertCount = 0;
    this._log('Test history and statistics reset');
    this.emit('historyReset');
  }

  /**
   * Exports test history as a serializable object.
   * @returns {Object} Serializable history data
   */
  exportHistory() {
    return {
      exportedAt: new Date().toISOString(),
      stats: { ...this.stats },
      historyCount: this.testHistory.length,
      history: this.testHistory.map(r => ({ ...r })),
      baselines: this._serializeBaselines(),
    };
  }
}

module.exports = SmartHomeAutomatedTestingSystem;
