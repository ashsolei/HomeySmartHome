'use strict';

const { BaseSystem } = require('./utils/BaseSystem');

/**
 * @typedef {'once'|'recurring'|'conditional'} TaskType
 */

/**
 * @typedef {object} TaskSchedule
 * @property {number} [time] - Absolute timestamp for one-time tasks
 * @property {'hourly'|'daily'|'weekly'|'monthly'|'interval'} [frequency] - Recurring frequency
 * @property {number} [hour] - Hour of day (0–23)
 * @property {number} [minute] - Minute (0–59)
 * @property {number} [day] - Day of month (1–31)
 * @property {number} [dayOfWeek] - Day of week (0 = Sun)
 * @property {number} [intervalMs] - Interval duration in ms for 'interval' frequency
 */

/**
 * @typedef {object} TaskData
 * @property {string} name - Human-readable task name
 * @property {string} [description] - Optional description
 * @property {TaskType} type - Execution type
 * @property {TaskSchedule} schedule - When/how often to run
 * @property {object} action - Action descriptor (type + params)
 * @property {number} [priority=5] - Priority 1–10 (10 = highest)
 * @property {object} [constraints={}] - Execution constraints
 * @property {object[]} [conditions=[]] - Pre-execution conditions
 * @property {string[]} [dependencies=[]] - Task IDs that must complete first
 * @property {number} [maxRetries=3] - Maximum retry attempts on failure
 * @property {number} [retryDelay=300000] - Delay between retries (ms)
 * @property {number} [timeout=60000] - Execution timeout (ms)
 * @property {boolean} [enabled=true] - Whether the task is active
 * @property {object} [metadata={}] - Arbitrary metadata
 */

/**
 * @typedef {object} Task
 * @property {string} id - Unique task identifier
 * @property {string} name - Task name
 * @property {string} [description] - Task description
 * @property {TaskType} type - Execution type
 * @property {TaskSchedule} schedule - Schedule configuration
 * @property {object} action - Action descriptor
 * @property {number} priority - Priority (1–10)
 * @property {object} constraints - Execution constraints
 * @property {object[]} conditions - Pre-execution conditions
 * @property {string[]} dependencies - Dependency task IDs
 * @property {number} maxRetries - Maximum retries
 * @property {number} retryDelay - Retry delay (ms)
 * @property {number} timeout - Execution timeout (ms)
 * @property {boolean} enabled - Active flag
 * @property {'pending'|'queued'|'running'|'completed'|'failed'|'retrying'|'cancelled'} status - Current status
 * @property {number} created - Creation timestamp (ms)
 * @property {number|null} nextExecution - Next scheduled run (ms)
 * @property {number|null} lastExecution - Last run start timestamp (ms)
 * @property {number} executionCount - Successful execution count
 * @property {number} failureCount - Consecutive failure count
 * @property {object} metadata - Arbitrary metadata
 */

/**
 * Smart Scheduling System.
 *
 * Manages named tasks with full lifecycle support: creation, queuing,
 * execution, retry logic, conflict resolution, dependency checking, and
 * automatic daily schedule optimisation based on historical failure patterns.
 *
 * @extends BaseSystem
 */
class SmartSchedulingSystem extends BaseSystem {
  /**
   * @param {import('homey').Homey} homey - Homey app instance
   */
  constructor(homey) {
    super(homey);
    this.tasks = new Map();
    this.schedules = new Map();
    this.executionQueue = [];
    this.executionHistory = [];
  }

  async initialize() {
    try {
      await super.initialize();
      this.log('Initializing Smart Scheduling System...');

      // Load tasks
      const savedTasks = await this.homey.settings.get('scheduledTasks') || {};
      Object.entries(savedTasks).forEach(([id, task]) => {
        this.tasks.set(id, task);
      });

      // Load schedules
      const savedSchedules = await this.homey.settings.get('schedules') || {};
      Object.entries(savedSchedules).forEach(([id, schedule]) => {
        this.schedules.set(id, schedule);
      });

      // Load execution history
      this.executionHistory = await this.homey.settings.get('schedulingSystem:executionHistory') || [];

      // Start scheduler
      await this.startScheduler();

      this.log('Smart Scheduling System initialized');
    } catch (error) {
      this.homey.error(`[SmartSchedulingSystem] Failed to initialize:`, error.message);
    }
  }

  /**
   * Start the scheduler
   */
  async startScheduler() {
    // Check for due tasks every minute
    this.schedulerInterval = this.wrapInterval(async () => {
      await this.checkDueTasks();
    }, 60000);

    // Process execution queue every 10 seconds
    this.queueInterval = this.wrapInterval(async () => {
      await this.processQueue();
    }, 10000);

    // Optimize schedules daily
    this.optimizationInterval = this.wrapInterval(async () => {
      await this.optimizeSchedules();
    }, 86400000);

    // Initial check
    await this.checkDueTasks();
  }

  /**
   * Create a new scheduled task, compute its first execution time, persist it,
   * and return the stored task object.
   *
   * @param {TaskData} taskData - Task configuration
   * @returns {Promise<Task>}
   */
  async createTask(taskData) {
    const task = {
      id: this.generateTaskId(),
      name: taskData.name,
      description: taskData.description,
      type: taskData.type, // 'once', 'recurring', 'conditional'
      schedule: taskData.schedule,
      action: taskData.action,
      priority: taskData.priority || 5, // 1-10, 10 highest
      constraints: taskData.constraints || {},
      conditions: taskData.conditions || [],
      dependencies: taskData.dependencies || [],
      maxRetries: taskData.maxRetries || 3,
      retryDelay: taskData.retryDelay || 300000, // 5 minutes
      timeout: taskData.timeout || 60000, // 1 minute
      enabled: taskData.enabled !== false,
      status: 'pending',
      created: Date.now(),
      nextExecution: null,
      lastExecution: null,
      executionCount: 0,
      failureCount: 0,
      metadata: taskData.metadata || {}
    };

    // Calculate next execution time
    task.nextExecution = await this.calculateNextExecution(task);

    this.tasks.set(task.id, task);
    await this.saveTasks();

    return task;
  }

  /**
   * Compute the next absolute execution timestamp for a task based on its type
   * and schedule, returning null for disabled or expired one-time tasks.
   *
   * @param {Task} task - Task to compute the next execution for
   * @returns {Promise<number|null>} Timestamp in ms, or null
   */
  async calculateNextExecution(task) {
    if (!task.enabled) return null;

    const now = Date.now();

    switch (task.type) {
      case 'once':
        return task.schedule.time > now ? task.schedule.time : null;

      case 'recurring':
        return this.calculateRecurringExecution(task.schedule, now);

      case 'conditional':
        // Conditional tasks are checked continuously
        return now + 60000; // Check in 1 minute

      default:
        return null;
    }
  }

  /**
   * Calculate the next occurrence timestamp for a recurring task schedule,
   * measured forward from `fromTime`.
   *
   * @param {TaskSchedule} schedule - Recurring schedule config
   * @param {number} fromTime - Reference timestamp in ms
   * @returns {number|null} Next execution timestamp in ms, or null
   */
  calculateRecurringExecution(schedule, fromTime) {
    const date = new Date(fromTime);

    switch (schedule.frequency) {
      case 'hourly':
        date.setMinutes(schedule.minute || 0);
        date.setSeconds(0);
        if (date.getTime() <= fromTime) {
          date.setHours(date.getHours() + 1);
        }
        break;

      case 'daily':
        date.setHours(schedule.hour || 0);
        date.setMinutes(schedule.minute || 0);
        date.setSeconds(0);
        if (date.getTime() <= fromTime) {
          date.setDate(date.getDate() + 1);
        }
        break;

      case 'weekly':
        date.setHours(schedule.hour || 0);
        date.setMinutes(schedule.minute || 0);
        date.setSeconds(0);
        
        // Find next occurrence of specified day
        const targetDay = schedule.dayOfWeek || 0;
        const currentDay = date.getDay();
        let daysToAdd = targetDay - currentDay;
        if (daysToAdd <= 0 || (daysToAdd === 0 && date.getTime() <= fromTime)) {
          daysToAdd += 7;
        }
        date.setDate(date.getDate() + daysToAdd);
        break;

      case 'monthly':
        date.setDate(schedule.day || 1);
        date.setHours(schedule.hour || 0);
        date.setMinutes(schedule.minute || 0);
        date.setSeconds(0);
        if (date.getTime() <= fromTime) {
          date.setMonth(date.getMonth() + 1);
        }
        break;

      case 'interval':
        return fromTime + (schedule.intervalMs || 3600000);

      default:
        return null;
    }

    return date.getTime();
  }

  /**
   * Check for due tasks
   */
  async checkDueTasks() {
    const now = Date.now();
    const dueTasks = [];

    for (const [_id, task] of this.tasks) {
      if (!task.enabled || !task.nextExecution) continue;

      // Check if task is due
      if (task.nextExecution <= now) {
        // Check conditions
        const conditionsMet = await this.checkConditions(task);
        
        if (conditionsMet) {
          dueTasks.push(task);
        } else if (task.type === 'conditional') {
          // Reschedule conditional task for next check
          task.nextExecution = now + 60000;
        }
      }
    }

    // Sort by priority
    dueTasks.sort((a, b) => b.priority - a.priority);

    // Add to execution queue
    for (const task of dueTasks) {
      await this.queueTask(task);
    }
  }

  /**
   * Check if task conditions are met
   */
  async checkConditions(task) {
    if (!task.conditions || task.conditions.length === 0) {
      return true;
    }

    for (const condition of task.conditions) {
      const met = await this.evaluateCondition(condition);
      if (!met) return false;
    }

    return true;
  }

  /**
   * Evaluate a single condition
   */
  async evaluateCondition(condition) {
    switch (condition.type) {
      case 'time_range':
        return this.checkTimeRange(condition);

      case 'presence':
        return await this.checkPresence(condition);

      case 'device_state':
        return await this.checkDeviceState(condition);

      case 'weather':
        return await this.checkWeather(condition);

      case 'energy_price':
        return await this.checkEnergyPrice(condition);

      default:
        return true;
    }
  }

  checkTimeRange(condition) {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const start = this.parseTime(condition.start);
    const end = this.parseTime(condition.end);

    if (start <= end) {
      return currentTime >= start && currentTime <= end;
    } else {
      return currentTime >= start || currentTime <= end;
    }
  }

  async checkPresence(condition) {
    try {
      const presenceManager = this.homey.app.presenceManager;
      if (!presenceManager) return true;

      const status = await presenceManager.getStatus();
      return status.status === condition.expectedState;
    } catch {
      return true;
    }
  }

  async checkDeviceState(condition) {
    try {
      const device = await this.homey.devices.getDevice({ id: condition.deviceId });
      const value = await device.getCapabilityValue(condition.capability);
      
      switch (condition.operator) {
        case 'equals':
          return value === condition.value;
        case 'not_equals':
          return value !== condition.value;
        case 'greater_than':
          return value > condition.value;
        case 'less_than':
          return value < condition.value;
        default:
          return true;
      }
    } catch {
      return false;
    }
  }

  async checkWeather(_condition) {
    // Would check weather conditions
    return true;
  }

  async checkEnergyPrice(condition) {
    try {
      const forecastingEngine = this.homey.app.energyForecastingEngine;
      if (!forecastingEngine) return true;

      const currentPrice = forecastingEngine.getCurrentEnergyPrice();
      
      switch (condition.operator) {
        case 'below':
          return currentPrice.price < condition.price;
        case 'above':
          return currentPrice.price > condition.price;
        case 'level':
          return currentPrice.level === condition.level;
        default:
          return true;
      }
    } catch {
      return true;
    }
  }

  /**
   * Validate constraints and dependencies for a task and, if all checks pass,
   * append it to the execution queue.  Conflicting tasks are resolved by
   * priority before queuing.
   *
   * @param {Task} task - Task to enqueue
   * @returns {Promise<void>}
   */
  async queueTask(task) {
    // Check constraints
    const constraintsMet = await this.checkConstraints(task);
    if (!constraintsMet) {
      this.log(`Task ${task.name} constraints not met, rescheduling`);
      await this.rescheduleTask(task);
      return;
    }

    // Check dependencies
    const dependenciesMet = await this.checkDependencies(task);
    if (!dependenciesMet) {
      this.log(`Task ${task.name} dependencies not met, waiting`);
      // Will be checked again later
      return;
    }

    // Check for conflicts
    const hasConflict = this.hasConflictingTask(task);
    if (hasConflict) {
      this.log(`Task ${task.name} has conflicts, resolving`);
      await this.resolveConflict(task);
      return;
    }

    // Add to queue
    this.executionQueue.push({
      task,
      queuedAt: Date.now(),
      attempts: 0
    });

    task.status = 'queued';
    await this.saveTasks();
  }

  /**
   * Test whether all runtime constraints for a task are currently satisfied
   * (excluded hours, max concurrent tasks, energy price ceiling).
   *
   * @param {Task} task - Task to check
   * @returns {Promise<boolean>}
   */
  async checkConstraints(task) {
    const constraints = task.constraints;

    // No execution during specific hours
    if (constraints.excludeHours) {
      const hour = new Date().getHours();
      if (constraints.excludeHours.includes(hour)) {
        return false;
      }
    }

    // Max concurrent tasks
    if (constraints.maxConcurrent) {
      const runningTasks = Array.from(this.tasks.values())
        .filter(t => t.status === 'running');
      if (runningTasks.length >= constraints.maxConcurrent) {
        return false;
      }
    }

    // Energy price constraint
    if (constraints.maxEnergyPrice) {
      try {
        const forecastingEngine = this.homey.app.energyForecastingEngine;
        const currentPrice = forecastingEngine?.getCurrentEnergyPrice();
        if (currentPrice && currentPrice.price > constraints.maxEnergyPrice) {
          return false;
        }
      } catch {
        // Continue if forecasting engine not available
      }
    }

    return true;
  }

  /**
   * Verify that all tasks listed in `task.dependencies` have completed
   * (and are still within `dependencyMaxAge` if specified).
   *
   * @param {Task} task - Task whose dependencies to check
   * @returns {Promise<boolean>}
   */
  async checkDependencies(task) {
    if (!task.dependencies || task.dependencies.length === 0) {
      return true;
    }

    for (const depId of task.dependencies) {
      const depTask = this.tasks.get(depId);
      if (!depTask) continue;

      // Dependency must be completed
      if (depTask.status !== 'completed') {
        return false;
      }

      // Dependency must have completed recently
      if (task.constraints.dependencyMaxAge) {
        const age = Date.now() - depTask.lastExecution;
        if (age > task.constraints.dependencyMaxAge) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Check whether any currently running or queued task conflicts with the
   * given task (same device/scene target or overlapping conflict zones).
   *
   * @param {Task} task - Task to check
   * @returns {boolean}
   */
  hasConflictingTask(task) {
    // Check if any running tasks conflict with this one
    const runningTasks = Array.from(this.tasks.values())
      .filter(t => t.status === 'running' || t.status === 'queued');

    for (const runningTask of runningTasks) {
      if (this.tasksConflict(task, runningTask)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Determine whether two tasks have conflicting targets (same device, same
   * scene, or overlapping conflict zones).
   *
   * @param {Task} task1 - First task
   * @param {Task} task2 - Second task
   * @returns {boolean}
   */
  tasksConflict(task1, task2) {
    // Same device actions
    if (task1.action.deviceId && task2.action.deviceId) {
      if (task1.action.deviceId === task2.action.deviceId) {
        return true;
      }
    }

    // Same scene
    if (task1.action.sceneId && task2.action.sceneId) {
      if (task1.action.sceneId === task2.action.sceneId) {
        return true;
      }
    }

    // Conflicting zones
    if (task1.metadata?.conflictingZones && task2.action.zone) {
      if (task1.metadata.conflictingZones.includes(task2.action.zone)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Resolve a scheduling conflict by priority: cancel lower-priority
   * conflicting tasks and retry queuing, or reschedule this task if it loses.
   *
   * @param {Task} task - Task that has a conflict to resolve
   * @returns {Promise<void>}
   */
  async resolveConflict(task) {
    const conflictingTasks = Array.from(this.tasks.values())
      .filter(t => (t.status === 'running' || t.status === 'queued') && this.tasksConflict(task, t));

    // Priority-based resolution
    for (const conflicting of conflictingTasks) {
      if (task.priority > conflicting.priority) {
        // Cancel lower priority task
        await this.cancelTask(conflicting.id);
      } else {
        // Reschedule this task
        await this.rescheduleTask(task);
        return;
      }
    }

    // Try queueing again
    await this.queueTask(task);
  }

  /**
   * Process execution queue
   */
  async processQueue() {
    if (this.executionQueue.length === 0) return;

    // Take first task from queue
    const queueItem = this.executionQueue.shift();
    await this.executeTask(queueItem.task, queueItem.attempts);
  }

  /**
   * Execute a queued task with timeout enforcement and automatic retry on
   * failure.  Updates task status and records the result in execution history.
   *
   * @param {Task} task - Task to execute
   * @param {number} [attempt=0] - Zero-based attempt number (used for retries)
   * @returns {Promise<void>}
   */
  async executeTask(task, attempt = 0) {
    this.log(`Executing task: ${task.name} (attempt ${attempt + 1})`);

    task.status = 'running';
    task.lastExecution = Date.now();

    try {
      // Set timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Task timeout')), task.timeout)
      );

      const executionPromise = this.performTaskAction(task);

      await Promise.race([executionPromise, timeoutPromise]);

      // Success
      task.status = 'completed';
      task.executionCount++;
      task.failureCount = 0;

      this.log(`Task ${task.name} completed successfully`);

      // Record in history
      this.recordExecution(task, true);

      // Calculate next execution
      if (task.type === 'recurring') {
        task.nextExecution = await this.calculateNextExecution(task);
        task.status = 'pending';
      }

    } catch (error) {
      this.error(`Task ${task.name} failed:`, error);

      task.failureCount++;

      // Retry logic
      if (attempt < task.maxRetries) {
        this.log(`Retrying task ${task.name} in ${task.retryDelay}ms`);
        
        setTimeout(async () => {
          this.executionQueue.unshift({ task, attempts: attempt + 1 });
        }, task.retryDelay);

        task.status = 'retrying';
      } else {
        task.status = 'failed';
        this.log(`Task ${task.name} failed after ${task.maxRetries} retries`);
        
        // Notify user
        await this.notifyTaskFailure(task, error);
      }

      this.recordExecution(task, false, error.message);

      // Reschedule if recurring
      if (task.type === 'recurring' && task.status === 'failed') {
        task.nextExecution = await this.calculateNextExecution(task);
        task.status = 'pending';
      }
    }

    await this.saveTasks();
  }

  /**
   * Perform the actual task action
   */
  async performTaskAction(task) {
    const action = task.action;

    switch (action.type) {
      case 'device':
        return await this.executeDeviceAction(action);

      case 'scene':
        return await this.executeSceneAction(action);

      case 'flow':
        return await this.executeFlowAction(action);

      case 'script':
        return await this.executeScriptAction(action);

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  async executeDeviceAction(action) {
    const device = await this.homey.devices.getDevice({ id: action.deviceId });
    await device.setCapabilityValue(action.capability, action.value);
  }

  async executeSceneAction(action) {
    const sceneManager = this.homey.app.sceneManager;
    if (!sceneManager) throw new Error('Scene manager not available');
    
    await sceneManager.activateScene(action.sceneId);
  }

  async executeFlowAction(action) {
    const trigger = this.homey.flow.getTriggerCard(action.flowId);
    if (!trigger) throw new Error('Flow trigger not found');
    
    await trigger.trigger(action.tokens || {});
  }

  async executeScriptAction(action) {
    // Safe action executor - only supports predefined action types
    // No dynamic code execution (new Function/eval) allowed
    if (!action || !action.type) {
      throw new Error('Script action must have a "type" property');
    }

    switch (action.type) {
      case 'emit': {
        // Emit a Homey event with optional data
        const eventName = String(action.event || '').replace(/[^a-zA-Z0-9_.\-:]/g, '');
        if (!eventName) throw new Error('Emit action requires a valid "event" name');
        this.homey.emit(eventName, action.data || {});
        break;
      }
      case 'setting': {
        // Set a Homey setting to a value (only string/number/boolean allowed)
        const key = String(action.key || '');
        if (!key) throw new Error('Setting action requires a "key"');
        const valueType = typeof action.value;
        if (valueType !== 'string' && valueType !== 'number' && valueType !== 'boolean') {
          throw new Error('Setting value must be a string, number, or boolean');
        }
        await this.homey.settings.set(key, action.value);
        break;
      }
      case 'log': {
        // Log a message
        const message = String(action.message || '');
        this.homey.log(`[ScheduledScript] ${message}`);
        break;
      }
      default:
        throw new Error(`Unsupported script action type: "${action.type}". Allowed types: emit, setting, log`);
    }
  }

  /**
   * Cancel a task: mark it cancelled, clear its next-execution time, and
   * remove it from the execution queue.
   *
   * @param {string} taskId - Task identifier
   * @returns {Promise<void>}
   */
  async cancelTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = 'cancelled';
    task.nextExecution = null;

    // Remove from queue
    this.executionQueue = this.executionQueue.filter(item => item.task.id !== taskId);

    await this.saveTasks();
  }

  /**
   * Delay the next execution of a task by `delayMs` milliseconds from now and
   * reset its status to 'pending'.
   *
   * @param {Task} task - Task to reschedule
   * @param {number} [delayMs=300000] - Delay before next attempt (ms)
   * @returns {Promise<void>}
   */
  async rescheduleTask(task, delayMs = 300000) {
    task.nextExecution = Date.now() + delayMs;
    task.status = 'pending';
    await this.saveTasks();
  }

  /**
   * Append an execution result to the in-memory history ring-buffer (capped at
   * 1000 entries).
   *
   * @param {Task} task - Task that was executed
   * @param {boolean} success - Whether the execution succeeded
   * @param {string|null} [errorMessage=null] - Error message on failure
   * @returns {void}
   */
  recordExecution(task, success, errorMessage = null) {
    this.executionHistory.push({
      taskId: task.id,
      taskName: task.name,
      timestamp: Date.now(),
      success,
      errorMessage,
      duration: Date.now() - task.lastExecution
    });

    // Keep only last 1000 executions
    if (this.executionHistory.length > 1000) {
      this.executionHistory.shift();
    }
  }

  /**
   * Optimize schedules
   */
  async optimizeSchedules() {
    this.log('Optimizing schedules...');

    // Identify tasks that frequently fail
    const failingTasks = Array.from(this.tasks.values())
      .filter(t => t.failureCount > 3);

    for (const task of failingTasks) {
      // Adjust schedule to avoid failure patterns
      this.log(`Optimizing failing task: ${task.name}`);
      
      // Analyze failure patterns
      const failures = this.executionHistory
        .filter(h => h.taskId === task.id && !h.success)
        .slice(-10);

      if (failures.length > 0) {
        // Find common failure time
        const failureHours = failures.map(f => new Date(f.timestamp).getHours());
        const mostCommonHour = this.findMostCommon(failureHours);

        // Adjust schedule to avoid that hour
        if (task.schedule.hour === mostCommonHour) {
          task.schedule.hour = (mostCommonHour + 2) % 24;
          task.nextExecution = await this.calculateNextExecution(task);
          this.log(`Adjusted ${task.name} schedule to avoid hour ${mostCommonHour}`);
        }
      }
    }

    await this.saveTasks();
  }

  /**
   * Get an aggregate statistics summary for all tasks and execution history.
   *
   * @returns {{total: number, byStatus: object, queueLength: number, executionHistory: {total: number, successful: number, failed: number}}}
   */
  getStatistics() {
    const tasks = Array.from(this.tasks.values());

    return {
      total: tasks.length,
      byStatus: {
        pending: tasks.filter(t => t.status === 'pending').length,
        queued: tasks.filter(t => t.status === 'queued').length,
        running: tasks.filter(t => t.status === 'running').length,
        completed: tasks.filter(t => t.status === 'completed').length,
        failed: tasks.filter(t => t.status === 'failed').length
      },
      queueLength: this.executionQueue.length,
      executionHistory: {
        total: this.executionHistory.length,
        successful: this.executionHistory.filter(h => h.success).length,
        failed: this.executionHistory.filter(h => !h.success).length
      }
    };
  }

  /**
   * Notify task failure
   */
  async notifyTaskFailure(task, error) {
    await this.homey.notifications.createNotification({
      excerpt: `Schemalagd uppgift "${task.name}" misslyckades: ${error.message}`
    });
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  parseTime(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  findMostCommon(arr) {
    const counts = {};
    let maxCount = 0;
    let mostCommon = arr[0];

    for (const item of arr) {
      counts[item] = (counts[item] || 0) + 1;
      if (counts[item] > maxCount) {
        maxCount = counts[item];
        mostCommon = item;
      }
    }

    return mostCommon;
  }

  generateTaskId() {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async saveTasks() {
    const data = {};
    this.tasks.forEach((task, id) => {
      data[id] = task;
    });
    await this.homey.settings.set('scheduledTasks', data);
    await this.homey.settings.set('schedulingSystem:executionHistory', this.executionHistory.slice(-1000));
  }

}

module.exports = SmartSchedulingSystem;
