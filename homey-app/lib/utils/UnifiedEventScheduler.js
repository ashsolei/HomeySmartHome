'use strict';

const EventEmitter = require('events');

/**
 * @typedef {'CRITICAL'|'HIGH'|'NORMAL'|'LOW'|'BACKGROUND'} PriorityGroup
 */

/**
 * @typedef {Object} TaskOptions
 * @property {boolean}        [enabled=true]        - Whether the task starts enabled
 * @property {boolean}        [runImmediately=false] - Execute once on registration
 * @property {Function|null}  [errorHandler=null]    - Per-task error handler
 * @property {number}         [timeout=30000]        - Max execution time in ms
 * @property {string[]}       [dependsOn=[]]         - Task IDs that must have run successfully first
 */

/**
 * @typedef {Object} TaskMetrics
 * @property {number}      executionCount  - Total number of completed executions
 * @property {number|null} lastRunTime     - Timestamp of last execution start
 * @property {number}      totalDuration   - Accumulated execution duration in ms
 * @property {number}      averageDuration - Mean execution duration in ms
 * @property {number}      errorCount      - Total errors encountered
 * @property {Error|null}  lastError       - Most recent error object
 * @property {number|null} lastSuccessTime - Timestamp of last successful completion
 */

/**
 * @typedef {Object} TaskEntry
 * @property {string}        id          - Unique task identifier
 * @property {PriorityGroup} group       - Priority group the task belongs to
 * @property {Function}      callback    - The work to execute
 * @property {TaskOptions}   options     - Merged options
 * @property {TaskMetrics}   metrics     - Runtime statistics
 * @property {boolean}       running     - Whether the task is currently executing
 * @property {number}        staggerMs   - Calculated stagger offset in ms
 */

/**
 * Priority group interval definitions in milliseconds.
 * Only 5 master timers replace 96+ individual setInterval calls.
 *
 * @readonly
 * @enum {number}
 */
const GROUP_INTERVALS = Object.freeze({
  CRITICAL:   30 * 1000,        //  30 seconds
  HIGH:       60 * 1000,        //   1 minute
  NORMAL:     5 * 60 * 1000,    //   5 minutes
  LOW:        10 * 60 * 1000,   //  10 minutes
  BACKGROUND: 60 * 60 * 1000,  //   1 hour
});

/** Human-readable labels for logging. */
const GROUP_LABELS = Object.freeze({
  CRITICAL:   'CRITICAL (30s)',
  HIGH:       'HIGH (1min)',
  NORMAL:     'NORMAL (5min)',
  LOW:        'LOW (10min)',
  BACKGROUND: 'BACKGROUND (1hr)',
});

/**
 * Default options applied to every registered task.
 * @type {TaskOptions}
 */
const DEFAULT_TASK_OPTIONS = Object.freeze({
  enabled: true,
  runImmediately: false,
  errorHandler: null,
  timeout: 30000,
  dependsOn: [],
});

/* ------------------------------------------------------------------ */

/**
 * UnifiedEventScheduler
 *
 * Replaces 96+ individual `setInterval` calls (54 of which leaked and
 * were never cleaned up) with exactly **5 master interval timers** —
 * one per priority group.  Every periodic task in the platform registers
 * here instead of managing its own timer.
 *
 * Key properties:
 * - Staggered execution prevents CPU spikes
 * - Error isolation: one task cannot crash another
 * - Timeout protection kills runaway callbacks
 * - Per-task metrics (count, duration, errors)
 * - Optional task dependencies
 * - Graceful shutdown waits for in-flight work
 *
 * @extends EventEmitter
 *
 * @example
 *   const { getInstance } = require('./utils/UnifiedEventScheduler');
 *   const scheduler = getInstance();
 *
 *   scheduler.registerTask('security.doorCheck', 'CRITICAL', async () => {
 *     await checkAllDoorSensors();
 *   }, { timeout: 10000 });
 *
 *   scheduler.on('task-failed', ({ taskId, error }) => {
 *     console.error(`Task ${taskId} failed:`, error.message);
 *   });
 */
class UnifiedEventScheduler extends EventEmitter {

  /* ---------------------------------------------------------------- */
  /*  Construction & singleton                                        */
  /* ---------------------------------------------------------------- */

  /**
   * Use {@link getInstance} to obtain the singleton.
   * Direct construction is supported but discouraged.
   */
  constructor() {
    super();

    /** @type {Map<string, TaskEntry>} All registered tasks keyed by id */
    this._tasks = new Map();

    /** @type {Map<PriorityGroup, NodeJS.Timeout>} Master interval handles */
    this._intervals = new Map();

    /** @type {Map<PriorityGroup, string[]>} Ordered task-id lists per group */
    this._groupIndex = new Map();

    /** @type {boolean} Whether the scheduler is actively ticking */
    this._running = false;

    /** @type {boolean} Whether destroy() has been called */
    this._destroyed = false;

    /** @type {number} Monotonic counter for ordering within a group */
    this._registrationSeq = 0;

    /** @type {number} Timestamp when the scheduler was started */
    this._startedAt = null;

    // Initialise group index buckets
    for (const group of Object.keys(GROUP_INTERVALS)) {
      this._groupIndex.set(group, []);
    }
  }

  /**
   * Returns the singleton scheduler instance.
   * Creates one on first call.
   *
   * @returns {UnifiedEventScheduler}
   */
  static getInstance() {
    if (!UnifiedEventScheduler._instance) {
      UnifiedEventScheduler._instance = new UnifiedEventScheduler();
    }
    return UnifiedEventScheduler._instance;
  }

  /* ---------------------------------------------------------------- */
  /*  Lifecycle                                                       */
  /* ---------------------------------------------------------------- */

  /**
   * Start the master interval timers.
   * Safe to call multiple times — subsequent calls are no-ops.
   *
   * @returns {UnifiedEventScheduler} this (for chaining)
   */
  start() {
    if (this._running || this._destroyed) return this;

    this._running = true;
    this._startedAt = Date.now();

    for (const [group, intervalMs] of Object.entries(GROUP_INTERVALS)) {
      const handle = setInterval(() => this._onGroupTick(group), intervalMs);

      // Allow the Node process to exit even if timers are alive
      if (handle.unref) handle.unref();

      this._intervals.set(group, handle);
    }

    this.emit('started', { timestamp: this._startedAt });
    return this;
  }

  /**
   * Gracefully shut down the scheduler.
   *
   * 1. Clears all 5 master intervals immediately.
   * 2. Waits for every in-flight task to finish (up to `waitMs`).
   * 3. Removes all registered tasks.
   *
   * @param {number} [waitMs=60000] - Max time to wait for running tasks
   * @returns {Promise<void>}
   */
  async destroy(waitMs = 60000) {
    if (this._destroyed) return;
    this._destroyed = true;
    this._running = false;

    // 1. Clear all master intervals
    for (const [, handle] of this._intervals) {
      clearInterval(handle);
    }
    this._intervals.clear();

    // 2. Wait for in-flight tasks
    const deadline = Date.now() + waitMs;
    while (this._hasRunningTasks() && Date.now() < deadline) {
      await this._sleep(250);
    }

    // 3. Warn about any still-running stragglers
    for (const [id, task] of this._tasks) {
      if (task.running) {
        this.emit('task-timeout', {
          taskId: id,
          group: task.group,
          message: 'Task still running at scheduler destroy',
        });
      }
    }

    // 4. Clean up
    this._tasks.clear();
    this._groupIndex.clear();
    for (const group of Object.keys(GROUP_INTERVALS)) {
      this._groupIndex.set(group, []);
    }

    this.emit('destroyed', { timestamp: Date.now() });
    this.removeAllListeners();

    // Reset singleton so a fresh instance can be created if needed
    if (UnifiedEventScheduler._instance === this) {
      UnifiedEventScheduler._instance = null;
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Task registration                                               */
  /* ---------------------------------------------------------------- */

  /**
   * Register a periodic task.
   *
   * @param {string}        id       - Unique identifier (e.g. 'energy.meterRead')
   * @param {PriorityGroup} group    - One of CRITICAL, HIGH, NORMAL, LOW, BACKGROUND
   * @param {Function}      callback - Async or sync function to execute
   * @param {TaskOptions}   [options={}] - Additional options
   * @returns {UnifiedEventScheduler} this (for chaining)
   *
   * @throws {Error} If the id is already registered
   * @throws {Error} If the group is invalid
   *
   * @example
   *   scheduler.registerTask('climate.humidity', 'HIGH', async () => {
   *     const reading = await humiditySensor.read();
   *     await store.save('humidity', reading);
   *   }, { timeout: 15000, runImmediately: true });
   */
  registerTask(id, group, callback, options = {}) {
    if (this._destroyed) {
      throw new Error('Cannot register tasks on a destroyed scheduler');
    }
    if (this._tasks.has(id)) {
      throw new Error(`Task "${id}" is already registered`);
    }
    if (!GROUP_INTERVALS[group]) {
      throw new Error(
        `Invalid group "${group}". Must be one of: ${Object.keys(GROUP_INTERVALS).join(', ')}`
      );
    }
    if (typeof callback !== 'function') {
      throw new TypeError(`Callback for task "${id}" must be a function`);
    }

    const merged = { ...DEFAULT_TASK_OPTIONS, ...options };

    /** @type {TaskEntry} */
    const entry = {
      id,
      group,
      callback,
      options: merged,
      metrics: this._freshMetrics(),
      running: false,
      staggerMs: 0,          // recalculated after insertion
      _seq: this._registrationSeq++,
    };

    this._tasks.set(id, entry);
    this._groupIndex.get(group).push(id);
    this._recalcStagger(group);

    this.emit('task-registered', { taskId: id, group, options: merged });

    // Optionally fire the task once right away
    if (merged.runImmediately && merged.enabled && this._running) {
      // Use setImmediate so the caller's code completes first
      setImmediate(() => this._executeTask(entry));
    }

    return this;
  }

  /**
   * Remove a previously registered task.
   *
   * @param {string} id - Task identifier
   * @returns {boolean} true if the task existed and was removed
   */
  unregisterTask(id) {
    const entry = this._tasks.get(id);
    if (!entry) return false;

    this._tasks.delete(id);
    const list = this._groupIndex.get(entry.group);
    const idx = list.indexOf(id);
    if (idx !== -1) list.splice(idx, 1);
    this._recalcStagger(entry.group);

    this.emit('task-unregistered', { taskId: id, group: entry.group });
    return true;
  }

  /* ---------------------------------------------------------------- */
  /*  Task control                                                    */
  /* ---------------------------------------------------------------- */

  /**
   * Enable a previously disabled task.
   *
   * @param {string} id - Task identifier
   * @returns {boolean} true if the task exists
   */
  enableTask(id) {
    const entry = this._tasks.get(id);
    if (!entry) return false;
    entry.options.enabled = true;
    this.emit('task-enabled', { taskId: id });
    return true;
  }

  /**
   * Disable a task so it is skipped on subsequent ticks.
   * If the task is currently executing it will finish, but won't run again.
   *
   * @param {string} id - Task identifier
   * @returns {boolean} true if the task exists
   */
  disableTask(id) {
    const entry = this._tasks.get(id);
    if (!entry) return false;
    entry.options.enabled = false;
    this.emit('task-disabled', { taskId: id });
    return true;
  }

  /**
   * Execute a specific task on-demand, regardless of its schedule.
   *
   * @param {string} id - Task identifier
   * @returns {Promise<boolean>} true if the task was executed
   */
  async runTaskNow(id) {
    const entry = this._tasks.get(id);
    if (!entry) return false;
    if (entry.running) return false;
    await this._executeTask(entry);
    return true;
  }

  /* ---------------------------------------------------------------- */
  /*  Introspection                                                   */
  /* ---------------------------------------------------------------- */

  /**
   * Return a snapshot of every registered task's status and metrics.
   *
   * @returns {Object[]} Array of task summaries
   */
  listTasks() {
    const result = [];
    for (const [id, entry] of this._tasks) {
      result.push({
        id,
        group: entry.group,
        enabled: entry.options.enabled,
        running: entry.running,
        staggerMs: entry.staggerMs,
        dependsOn: entry.options.dependsOn,
        timeout: entry.options.timeout,
        metrics: { ...entry.metrics },
      });
    }
    return result;
  }

  /**
   * Return comprehensive scheduler-wide statistics.
   *
   * @returns {Object} Scheduler stats
   */
  getStats() {
    const groups = {};
    for (const [group, ids] of this._groupIndex) {
      const tasks = ids.map(id => this._tasks.get(id)).filter(Boolean);
      groups[group] = {
        label: GROUP_LABELS[group],
        intervalMs: GROUP_INTERVALS[group],
        taskCount: tasks.length,
        enabledCount: tasks.filter(t => t.options.enabled).length,
        runningCount: tasks.filter(t => t.running).length,
        totalExecutions: tasks.reduce((s, t) => s + t.metrics.executionCount, 0),
        totalErrors: tasks.reduce((s, t) => s + t.metrics.errorCount, 0),
      };
    }

    const allTasks = Array.from(this._tasks.values());
    return {
      running: this._running,
      destroyed: this._destroyed,
      startedAt: this._startedAt,
      uptimeMs: this._startedAt ? Date.now() - this._startedAt : 0,
      masterIntervals: this._intervals.size,
      totalRegisteredTasks: this._tasks.size,
      totalEnabledTasks: allTasks.filter(t => t.options.enabled).length,
      totalRunningTasks: allTasks.filter(t => t.running).length,
      totalExecutions: allTasks.reduce((s, t) => s + t.metrics.executionCount, 0),
      totalErrors: allTasks.reduce((s, t) => s + t.metrics.errorCount, 0),
      groups,
    };
  }

  /**
   * Check whether a task with the given id exists.
   *
   * @param {string} id
   * @returns {boolean}
   */
  hasTask(id) {
    return this._tasks.has(id);
  }

  /**
   * Return metrics for a single task.
   *
   * @param {string} id
   * @returns {TaskMetrics|null}
   */
  getTaskMetrics(id) {
    const entry = this._tasks.get(id);
    return entry ? { ...entry.metrics } : null;
  }

  /* ---------------------------------------------------------------- */
  /*  Master tick handler                                             */
  /* ---------------------------------------------------------------- */

  /**
   * Called once per group interval.  Iterates the group's task list and
   * schedules each enabled task with its individual stagger offset.
   *
   * @param {PriorityGroup} group
   * @private
   */
  _onGroupTick(group) {
    const taskIds = this._groupIndex.get(group);
    if (!taskIds || taskIds.length === 0) return;

    this.emit('group-tick', { group, taskCount: taskIds.length, timestamp: Date.now() });

    for (const id of taskIds) {
      const entry = this._tasks.get(id);
      if (!entry) continue;
      if (!entry.options.enabled) continue;
      if (entry.running) continue; // prevent overlapping executions

      // Stagger: delay the task by its calculated offset
      if (entry.staggerMs > 0) {
        setTimeout(() => this._executeTask(entry), entry.staggerMs);
      } else {
        // First task in the group fires immediately
        this._executeTask(entry);
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Task execution with error isolation & timeout                   */
  /* ---------------------------------------------------------------- */

  /**
   * Execute a single task with full error isolation and timeout protection.
   *
   * @param {TaskEntry} entry
   * @returns {Promise<void>}
   * @private
   */
  async _executeTask(entry) {
    // Guard: already running (double-check for stagger race)
    if (entry.running) return;

    // Dependency check
    if (!this._areDependenciesMet(entry)) {
      this.emit('task-skipped', {
        taskId: entry.id,
        reason: 'unmet-dependencies',
        dependsOn: entry.options.dependsOn,
      });
      return;
    }

    entry.running = true;
    const startTime = Date.now();
    entry.metrics.lastRunTime = startTime;

    let timeoutHandle = null;
    let timedOut = false;

    try {
      const result = await Promise.race([
        // The actual work
        Promise.resolve().then(() => entry.callback()),

        // Timeout guard
        new Promise((_, reject) => {
          timeoutHandle = setTimeout(() => {
            timedOut = true;
            reject(new Error(
              `Task "${entry.id}" exceeded timeout of ${entry.options.timeout}ms`
            ));
          }, entry.options.timeout);
        }),
      ]);

      // Success path
      clearTimeout(timeoutHandle);
      const duration = Date.now() - startTime;
      entry.metrics.executionCount++;
      entry.metrics.totalDuration += duration;
      entry.metrics.averageDuration = Math.round(
        entry.metrics.totalDuration / entry.metrics.executionCount
      );
      entry.metrics.lastSuccessTime = Date.now();

      this.emit('task-completed', {
        taskId: entry.id,
        group: entry.group,
        durationMs: duration,
        result,
      });
    } catch (error) {
      clearTimeout(timeoutHandle);
      const duration = Date.now() - startTime;
      entry.metrics.errorCount++;
      entry.metrics.lastError = error;

      if (timedOut) {
        this.emit('task-timeout', {
          taskId: entry.id,
          group: entry.group,
          timeoutMs: entry.options.timeout,
          error,
        });
      } else {
        this.emit('task-failed', {
          taskId: entry.id,
          group: entry.group,
          durationMs: duration,
          error,
        });
      }

      // Invoke per-task error handler if provided
      if (typeof entry.options.errorHandler === 'function') {
        try {
          entry.options.errorHandler(error, entry.id);
        } catch (_handlerErr) {
          // Swallow errors from the error handler itself
        }
      }
    } finally {
      entry.running = false;
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Dependency resolution                                           */
  /* ---------------------------------------------------------------- */

  /**
   * Check whether all tasks listed in `dependsOn` have completed
   * successfully at least once.
   *
   * @param {TaskEntry} entry
   * @returns {boolean}
   * @private
   */
  _areDependenciesMet(entry) {
    const deps = entry.options.dependsOn;
    if (!deps || deps.length === 0) return true;

    for (const depId of deps) {
      const dep = this._tasks.get(depId);
      // Dependency doesn't exist or has never succeeded
      if (!dep || dep.metrics.lastSuccessTime === null) {
        return false;
      }
    }
    return true;
  }

  /* ---------------------------------------------------------------- */
  /*  Stagger calculation                                             */
  /* ---------------------------------------------------------------- */

  /**
   * Recalculate stagger offsets for every task in a group.
   *
   * Formula:  offset = (taskIndex * groupInterval) / taskCount
   *
   * This spreads tasks evenly across the interval window so they don't
   * all fire at the same instant, preventing CPU spikes.
   *
   * @param {PriorityGroup} group
   * @private
   */
  _recalcStagger(group) {
    const ids = this._groupIndex.get(group);
    if (!ids || ids.length === 0) return;

    const interval = GROUP_INTERVALS[group];
    const count = ids.length;

    for (let i = 0; i < count; i++) {
      const entry = this._tasks.get(ids[i]);
      if (entry) {
        entry.staggerMs = Math.floor((i * interval) / count);
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Internal helpers                                                */
  /* ---------------------------------------------------------------- */

  /**
   * Return a blank metrics object for a newly registered task.
   *
   * @returns {TaskMetrics}
   * @private
   */
  _freshMetrics() {
    return {
      executionCount: 0,
      lastRunTime: null,
      totalDuration: 0,
      averageDuration: 0,
      errorCount: 0,
      lastError: null,
      lastSuccessTime: null,
    };
  }

  /**
   * Check whether any registered task is currently executing.
   *
   * @returns {boolean}
   * @private
   */
  _hasRunningTasks() {
    for (const [, entry] of this._tasks) {
      if (entry.running) return true;
    }
    return false;
  }

  /**
   * Promise-based sleep utility.
   *
   * @param {number} ms
   * @returns {Promise<void>}
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/** @type {UnifiedEventScheduler|null} Singleton reference */
UnifiedEventScheduler._instance = null;

/* ------------------------------------------------------------------ */
/*  Module exports                                                    */
/* ------------------------------------------------------------------ */

/**
 * Convenience accessor for the singleton scheduler.
 *
 * @returns {UnifiedEventScheduler}
 */
function getInstance() {
  return UnifiedEventScheduler.getInstance();
}

module.exports = { UnifiedEventScheduler, getInstance };
