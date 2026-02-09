'use strict';

const EventEmitter = require('events');

/**
 * CrossSystemAIOrchestrationHub
 * Central AI coordination hub that orchestrates 95+ smart home subsystems.
 * Provides system registry, AI decision engine, cross-system automation,
 * conflict resolution, health monitoring, ML simulation, and more.
 */
class CrossSystemAIOrchestrationHub extends EventEmitter {

  constructor(homey) {
    super();
    this.homey = homey;
    this.initialized = false;
    this.intervals = [];

    // System registry
    this.systems = new Map();
    this.systemCategories = [
      'energy', 'security', 'comfort', 'health', 'utility', 'automation',
      'entertainment', 'environment', 'transport', 'food', 'education', 'maintenance'
    ];

    // AI decision engine
    this.rulesDatabase = [];
    this.decisionLog = [];
    this.maxDecisionLogSize = 1000;
    this.decisionsToday = 0;
    this.decisionsTodayDate = null;

    // Cross-system automation scenarios
    this.scenarios = new Map();

    // Conflict resolution
    this.activeConflicts = [];
    this.conflictsResolved = 0;

    // Circuit breaker state per system
    this.circuitBreakers = new Map();

    // Performance metrics
    this.performanceMetrics = {
      eventThroughput: 0,
      eventsProcessed: 0,
      eventsLastMinute: [],
      averageResponseTime: 0,
      responseTimes: [],
      errorRate: 0,
      errorsLastHour: 0,
      totalErrors: 0,
      uptime: Date.now()
    };

    // Event bus analytics
    this.eventBusAnalytics = {
      publishers: new Map(),
      subscribers: new Map(),
      eventFlow: [],
      maxFlowHistory: 500,
      bottlenecks: []
    };

    // ML simulation state
    this.mlPatterns = {
      timeOfDay: new Map(),
      dayOfWeek: new Map(),
      seasonal: new Map(),
      anomalies: [],
      predictions: []
    };

    // Resource allocation
    this.resourceBudgets = new Map();
    this.globalResourceLimits = {
      maxCpuPercent: 80,
      maxMemoryMB: 2048,
      currentCpuPercent: 0,
      currentMemoryMB: 0
    };

    // Dependency graph
    this.dependencyGraph = new Map();

    // Communication protocols
    this.communicationChannels = new Map();
    this.pendingRequests = new Map();
    this.requestTimeout = 5000;

    // AI confidence and learning
    this.confidenceThreshold = 0.6;
    this.learningFeedback = [];
    this.maxFeedbackHistory = 500;

    // System discovery
    this.discoveredSystems = [];
    this.integrationSuggestions = [];

    // Load balancing
    this.loadBalancer = {
      systemLoads: new Map(),
      overloadThreshold: 85,
      sheddingActive: false,
      sheddedSystems: new Set()
    };

    // Orchestration queue
    this.orchestrationQueue = {
      queue: [],
      maxDepth: 200,
      deadLetterQueue: [],
      maxDeadLetterSize: 100,
      processing: false
    };

    // Dashboard metrics
    this.dashboardMetrics = {
      systemsOnline: 0,
      scenariosActive: 0,
      decisionsToday: 0,
      conflictsResolved: 0,
      automationEfficiency: 0.95
    };
  }

  /**
   * Initialize the orchestration hub
   */
  async initialize() {
    try {
      this.homey.log('[AIOrchestration] Initializing CrossSystemAIOrchestrationHub...');

      this._initializeRulesDatabase();
      this._initializeScenarios();
      this._initializeDependencyGraph();
      this._initializeResourceBudgets();
      this._initializeCommunicationProtocols();

      // Start monitoring intervals
      this._startHeartbeatMonitoring();
      this._startPerformanceTracking();
      this._startEventBusAnalytics();
      this._startMLPatternRecognition();
      this._startLoadBalancing();
      this._startQueueProcessor();
      this._startSystemDiscovery();
      this._startDashboardUpdater();
      this._startConflictScanner();
      this._startCircuitBreakerManager();

      this.initialized = true;
      this.homey.log('[AIOrchestration] Initialization complete. Ready to orchestrate subsystems.');
      this.homey.emit('ai-orchestration:initialized', { timestamp: Date.now() });
    } catch (error) {
      this.homey.error('[AIOrchestration] Initialization failed:', error.message);
      throw error;
    }
  }

  // ─────────────────────────────────────────────
  // SYSTEM REGISTRY
  // ─────────────────────────────────────────────

  /**
   * Register a subsystem with the orchestration hub
   */
  registerSystem(systemConfig) {
    var name = systemConfig.name;
    var category = systemConfig.category || 'utility';
    var priority = systemConfig.priority || 5;
    var dependencies = systemConfig.dependencies || [];
    var metadata = systemConfig.metadata || {};

    if (!name) {
      this.homey.error('[AIOrchestration] Cannot register system without name');
      return false;
    }

    if (this.systemCategories.indexOf(category) === -1) {
      this.homey.error('[AIOrchestration] Invalid category: ' + category);
      return false;
    }

    var system = {
      name: name,
      category: category,
      status: 'online',
      priority: Math.max(1, Math.min(10, priority)),
      lastHeartbeat: Date.now(),
      responseTimeMs: 0,
      errorCount: 0,
      memoryUsageMB: 0,
      cpuUsagePercent: 0,
      dependencies: dependencies,
      registeredAt: Date.now(),
      metadata: metadata,
      eventsEmitted: 0,
      eventsReceived: 0,
      lastAction: null,
      uptimePercent: 100,
      restartCount: 0
    };

    this.systems.set(name, system);

    // Initialize circuit breaker
    this.circuitBreakers.set(name, {
      state: 'closed',
      failureCount: 0,
      maxFailures: 3,
      lastFailure: null,
      openedAt: null,
      halfOpenTimeout: 60000
    });

    // Update dependency graph
    if (dependencies.length > 0) {
      this.dependencyGraph.set(name, dependencies);
    }

    // Initialize resource budget
    this.resourceBudgets.set(name, {
      maxCpuPercent: 15,
      maxMemoryMB: 128,
      currentCpuPercent: 0,
      currentMemoryMB: 0,
      throttled: false
    });

    this.homey.log('[AIOrchestration] Registered system: ' + name + ' (' + category + ', priority ' + system.priority + ')');
    this.homey.emit('ai-orchestration:system-registered', { name: name, category: category, priority: system.priority });
    this._updateDashboardMetrics();
    return true;
  }

  /**
   * Unregister a subsystem
   */
  unregisterSystem(name) {
    if (!this.systems.has(name)) {
      this.homey.error('[AIOrchestration] System not found: ' + name);
      return false;
    }
    this.systems.delete(name);
    this.circuitBreakers.delete(name);
    this.resourceBudgets.delete(name);
    this.dependencyGraph.delete(name);
    this.homey.log('[AIOrchestration] Unregistered system: ' + name);
    this._updateDashboardMetrics();
    return true;
  }

  /**
   * Update system heartbeat
   */
  heartbeat(systemName, metrics) {
    if (!metrics) metrics = {};
    var system = this.systems.get(systemName);
    if (!system) return false;

    system.lastHeartbeat = Date.now();
    if (metrics.responseTimeMs !== undefined) system.responseTimeMs = metrics.responseTimeMs;
    if (metrics.memoryUsageMB !== undefined) system.memoryUsageMB = metrics.memoryUsageMB;
    if (metrics.cpuUsagePercent !== undefined) system.cpuUsagePercent = metrics.cpuUsagePercent;

    // If system was degraded and heartbeat arrives, consider recovery
    if (system.status === 'degraded') {
      var cb = this.circuitBreakers.get(systemName);
      if (cb && cb.state === 'half-open') {
        cb.state = 'closed';
        cb.failureCount = 0;
        system.status = 'online';
        this.homey.log('[AIOrchestration] System recovered: ' + systemName);
        this.homey.emit('ai-orchestration:system-recovered', { name: systemName });
      }
    }

    // Update resource tracking
    var budget = this.resourceBudgets.get(systemName);
    if (budget) {
      budget.currentCpuPercent = system.cpuUsagePercent;
      budget.currentMemoryMB = system.memoryUsageMB;
      if (system.cpuUsagePercent > budget.maxCpuPercent) {
        budget.throttled = true;
        this.homey.log('[AIOrchestration] Throttling ' + systemName + ': CPU ' + system.cpuUsagePercent + '% > ' + budget.maxCpuPercent + '%');
      } else {
        budget.throttled = false;
      }
    }

    return true;
  }

  /**
   * Get system by name
   */
  getSystem(name) {
    return this.systems.get(name) || null;
  }

  /**
   * Get all systems in a category
   */
  getSystemsByCategory(category) {
    var result = [];
    for (var entry of this.systems) {
      if (entry[1].category === category) result.push(Object.assign({}, entry[1]));
    }
    return result;
  }

  /**
   * Get all online systems
   */
  getOnlineSystems() {
    var result = [];
    for (var entry of this.systems) {
      if (entry[1].status === 'online') result.push(Object.assign({}, entry[1]));
    }
    return result;
  }

  /**
   * Report a system error
   */
  reportSystemError(systemName, error) {
    var system = this.systems.get(systemName);
    if (!system) return;

    system.errorCount++;
    this.performanceMetrics.totalErrors++;
    this.performanceMetrics.errorsLastHour++;

    var cb = this.circuitBreakers.get(systemName);
    if (cb) {
      cb.failureCount++;
      cb.lastFailure = Date.now();

      if (cb.failureCount >= cb.maxFailures && cb.state === 'closed') {
        cb.state = 'open';
        cb.openedAt = Date.now();
        system.status = 'degraded';
        this.homey.error('[AIOrchestration] Circuit breaker OPEN for ' + systemName + ' after ' + cb.failureCount + ' failures');
        this.homey.emit('ai-orchestration:circuit-open', { name: systemName, failures: cb.failureCount });
        this._checkCascadeFailure(systemName);
      }
    }

    this._logDecision({
      type: 'error-handling',
      systems: [systemName],
      action: 'error-reported',
      detail: error.message || String(error),
      confidence: 1.0,
      outcome: 'logged'
    });
  }

  // ─────────────────────────────────────────────
  // AI DECISION ENGINE
  // ─────────────────────────────────────────────

  _initializeRulesDatabase() {
    this.rulesDatabase = [
      { id: 'R001', condition: function(ctx) { return ctx.timeOfDay >= 6 && ctx.timeOfDay < 9; }, action: 'trigger-scenario', params: { scenario: 'morning-routine' }, priority: 7, category: 'comfort', description: 'Morning routine activation' },
      { id: 'R002', condition: function(ctx) { return ctx.allUsersAway === true; }, action: 'trigger-scenario', params: { scenario: 'leaving-home' }, priority: 8, category: 'security', description: 'Away mode when all users leave' },
      { id: 'R003', condition: function(ctx) { return ctx.userArriving === true; }, action: 'trigger-scenario', params: { scenario: 'arriving-home' }, priority: 8, category: 'comfort', description: 'Welcome home activation' },
      { id: 'R004', condition: function(ctx) { return ctx.timeOfDay >= 22 || ctx.timeOfDay < 5; }, action: 'trigger-scenario', params: { scenario: 'bedtime' }, priority: 6, category: 'comfort', description: 'Bedtime routine' },
      { id: 'R005', condition: function(ctx) { return ctx.energyPrice > ctx.energyPriceHigh; }, action: 'trigger-scenario', params: { scenario: 'energy-saving' }, priority: 9, category: 'energy', description: 'Energy saving during peak prices' },
      { id: 'R006', condition: function(ctx) { return ctx.temperature > 28; }, action: 'activate-cooling', params: { targetTemp: 23 }, priority: 7, category: 'comfort', description: 'Auto-cooling on high temp' },
      { id: 'R007', condition: function(ctx) { return ctx.temperature < 16; }, action: 'activate-heating', params: { targetTemp: 21 }, priority: 7, category: 'comfort', description: 'Auto-heating on low temp' },
      { id: 'R008', condition: function(ctx) { return ctx.humidity > 70; }, action: 'activate-dehumidifier', params: {}, priority: 6, category: 'health', description: 'Dehumidify on high humidity' },
      { id: 'R009', condition: function(ctx) { return ctx.airQualityIndex > 150; }, action: 'activate-purifier', params: { speed: 'high' }, priority: 8, category: 'health', description: 'Air purification on poor AQI' },
      { id: 'R010', condition: function(ctx) { return ctx.motionDetected && ctx.lightLevel < 20; }, action: 'turn-on-lights', params: { brightness: 80 }, priority: 5, category: 'comfort', description: 'Auto-lights on motion in dark' },
      { id: 'R011', condition: function(ctx) { return ctx.noMotion > 1800000; }, action: 'turn-off-lights', params: {}, priority: 4, category: 'energy', description: 'Turn off lights after 30min no motion' },
      { id: 'R012', condition: function(ctx) { return ctx.securityBreach === true; }, action: 'trigger-scenario', params: { scenario: 'emergency' }, priority: 10, category: 'security', description: 'Emergency on security breach' },
      { id: 'R013', condition: function(ctx) { return ctx.smokeDetected === true; }, action: 'emergency-alert', params: { type: 'fire' }, priority: 10, category: 'security', description: 'Fire emergency alert' },
      { id: 'R014', condition: function(ctx) { return ctx.waterLeak === true; }, action: 'emergency-alert', params: { type: 'flood' }, priority: 10, category: 'security', description: 'Flood emergency alert' },
      { id: 'R015', condition: function(ctx) { return ctx.guestCount > 0; }, action: 'trigger-scenario', params: { scenario: 'guest-arrival' }, priority: 6, category: 'comfort', description: 'Guest mode activation' },
      { id: 'R016', condition: function(ctx) { return ctx.workingFromHome === true; }, action: 'trigger-scenario', params: { scenario: 'work-from-home' }, priority: 6, category: 'utility', description: 'Work from home optimization' },
      { id: 'R017', condition: function(ctx) { return ctx.solarProduction > ctx.energyConsumption; }, action: 'store-energy', params: {}, priority: 7, category: 'energy', description: 'Store excess solar energy' },
      { id: 'R018', condition: function(ctx) { return ctx.batteryLevel < 20; }, action: 'reduce-consumption', params: {}, priority: 8, category: 'energy', description: 'Reduce load on low battery' },
      { id: 'R019', condition: function(ctx) { return ctx.rainProbability > 80; }, action: 'close-skylights', params: {}, priority: 7, category: 'environment', description: 'Close skylights before rain' },
      { id: 'R020', condition: function(ctx) { return ctx.uvIndex > 8; }, action: 'close-blinds', params: {}, priority: 5, category: 'comfort', description: 'Close blinds on high UV' },
      { id: 'R021', condition: function(ctx) { return ctx.noiseLevel > 70 && ctx.timeOfDay >= 22; }, action: 'noise-reduction', params: {}, priority: 6, category: 'comfort', description: 'Noise reduction at night' },
      { id: 'R022', condition: function(ctx) { return ctx.co2Level > 1000; }, action: 'increase-ventilation', params: {}, priority: 8, category: 'health', description: 'Ventilate on high CO2' },
      { id: 'R023', condition: function(ctx) { return ctx.packageDelivery === true; }, action: 'notify-delivery', params: {}, priority: 4, category: 'utility', description: 'Package delivery notification' },
      { id: 'R024', condition: function(ctx) { return ctx.doorbellRing === true; }, action: 'doorbell-response', params: {}, priority: 5, category: 'security', description: 'Smart doorbell response' },
      { id: 'R025', condition: function(ctx) { return ctx.laundryDone === true; }, action: 'laundry-notification', params: {}, priority: 3, category: 'utility', description: 'Laundry done notification' },
      { id: 'R026', condition: function(ctx) { return ctx.ovenPreheated === true; }, action: 'cooking-ready-alert', params: {}, priority: 4, category: 'food', description: 'Oven preheat complete alert' },
      { id: 'R027', condition: function(ctx) { return ctx.movieModeRequested === true; }, action: 'trigger-scenario', params: { scenario: 'movie-night' }, priority: 5, category: 'entertainment', description: 'Movie night mode' },
      { id: 'R028', condition: function(ctx) { return ctx.exerciseModeRequested === true; }, action: 'trigger-scenario', params: { scenario: 'exercise-mode' }, priority: 5, category: 'health', description: 'Exercise mode activation' },
      { id: 'R029', condition: function(ctx) { return ctx.babySleeping === true; }, action: 'trigger-scenario', params: { scenario: 'baby-sleeping' }, priority: 8, category: 'comfort', description: 'Baby sleeping quiet mode' },
      { id: 'R030', condition: function(ctx) { return ctx.vacationMode === true; }, action: 'trigger-scenario', params: { scenario: 'vacation-mode' }, priority: 7, category: 'security', description: 'Vacation security mode' },
      { id: 'R031', condition: function(ctx) { return ctx.partyModeRequested === true; }, action: 'trigger-scenario', params: { scenario: 'party-mode' }, priority: 5, category: 'entertainment', description: 'Party mode activation' },
      { id: 'R032', condition: function(ctx) { return ctx.cookingModeRequested === true; }, action: 'trigger-scenario', params: { scenario: 'cooking-mode' }, priority: 5, category: 'food', description: 'Cooking mode activation' },
      { id: 'R033', condition: function(ctx) { return ctx.gridDemandHigh === true; }, action: 'shed-load', params: {}, priority: 8, category: 'energy', description: 'Load shedding on grid demand' },
      { id: 'R034', condition: function(ctx) { return ctx.electricVehiclePlugged && ctx.energyPrice < ctx.energyPriceLow; }, action: 'charge-vehicle', params: {}, priority: 6, category: 'transport', description: 'Charge EV on cheap energy' },
      { id: 'R035', condition: function(ctx) { return ctx.gardenMoisture < 30; }, action: 'start-irrigation', params: {}, priority: 5, category: 'environment', description: 'Auto-irrigate dry garden' },
      { id: 'R036', condition: function(ctx) { return ctx.windowOpen && ctx.hvacRunning; }, action: 'pause-hvac', params: {}, priority: 7, category: 'energy', description: 'Pause HVAC when windows open' },
      { id: 'R037', condition: function(ctx) { return ctx.childSchoolTime === true; }, action: 'school-reminder', params: {}, priority: 6, category: 'education', description: 'School time reminder' },
      { id: 'R038', condition: function(ctx) { return ctx.filterReplacementDue === true; }, action: 'maintenance-alert', params: { type: 'filter' }, priority: 4, category: 'maintenance', description: 'Filter replacement reminder' },
      { id: 'R039', condition: function(ctx) { return ctx.systemUpdateAvailable === true; }, action: 'schedule-update', params: {}, priority: 3, category: 'maintenance', description: 'Schedule system update' },
      { id: 'R040', condition: function(ctx) { return ctx.sunsetApproaching === true; }, action: 'sunset-lighting', params: {}, priority: 4, category: 'comfort', description: 'Sunset ambient lighting' },
      { id: 'R041', condition: function(ctx) { return ctx.sunriseApproaching === true; }, action: 'sunrise-routine', params: {}, priority: 4, category: 'comfort', description: 'Sunrise wake routine' },
      { id: 'R042', condition: function(ctx) { return ctx.stormWarning === true; }, action: 'storm-preparation', params: {}, priority: 9, category: 'security', description: 'Storm preparation' },
      { id: 'R043', condition: function(ctx) { return ctx.powerOutage === true; }, action: 'backup-power', params: {}, priority: 10, category: 'energy', description: 'Switch to backup power' },
      { id: 'R044', condition: function(ctx) { return ctx.intruderDetected === true; }, action: 'lockdown', params: {}, priority: 10, category: 'security', description: 'Security lockdown' },
      { id: 'R045', condition: function(ctx) { return ctx.medicationTime === true; }, action: 'medication-reminder', params: {}, priority: 7, category: 'health', description: 'Medication reminder' },
      { id: 'R046', condition: function(ctx) { return ctx.elderlyFallDetected === true; }, action: 'emergency-alert', params: { type: 'fall' }, priority: 10, category: 'health', description: 'Fall detection emergency' },
      { id: 'R047', condition: function(ctx) { return ctx.sleepQualityLow === true; }, action: 'adjust-bedroom-environment', params: {}, priority: 6, category: 'health', description: 'Optimize sleep environment' },
      { id: 'R048', condition: function(ctx) { return ctx.highTrafficHours === true; }, action: 'commute-advisory', params: {}, priority: 3, category: 'transport', description: 'Commute traffic advisory' },
      { id: 'R049', condition: function(ctx) { return ctx.dishwasherDone === true; }, action: 'dishwasher-notification', params: {}, priority: 2, category: 'utility', description: 'Dishwasher cycle complete' },
      { id: 'R050', condition: function(ctx) { return ctx.networkAnomaly === true; }, action: 'security-scan', params: {}, priority: 8, category: 'security', description: 'Network anomaly security scan' },
      { id: 'R051', condition: function(ctx) { return ctx.pollenCountHigh === true; }, action: 'close-windows-purify', params: {}, priority: 6, category: 'health', description: 'Pollen protection mode' },
      { id: 'R052', condition: function(ctx) { return ctx.freezingTemperature === true; }, action: 'pipe-protection', params: {}, priority: 8, category: 'maintenance', description: 'Freeze pipe protection' }
    ];

    this.homey.log('[AIOrchestration] Initialized ' + this.rulesDatabase.length + ' AI rules');
  }

  /**
   * Evaluate all rules against current context and make decisions
   */
  async evaluateRules(context) {
    var matchedRules = [];

    for (var ri = 0; ri < this.rulesDatabase.length; ri++) {
      try {
        if (this.rulesDatabase[ri].condition(context)) {
          matchedRules.push(this.rulesDatabase[ri]);
        }
      } catch (err) {
        // Rule evaluation error, skip silently
      }
    }

    // Sort by priority descending
    matchedRules.sort(function(a, b) { return b.priority - a.priority; });

    // Detect conflicts
    var conflicts = this._detectRuleConflicts(matchedRules);
    if (conflicts.length > 0) {
      await this._resolveConflicts(conflicts, matchedRules);
    }

    // Execute actions for matched rules
    var results = [];
    for (var mi = 0; mi < matchedRules.length; mi++) {
      var rule = matchedRules[mi];
      var confidence = this._calculateConfidence(rule, context);
      if (confidence >= this.confidenceThreshold) {
        var result = await this._executeRuleAction(rule, confidence);
        results.push(result);
      } else {
        this.homey.log('[AIOrchestration] Low confidence (' + confidence.toFixed(2) + ') for rule ' + rule.id + ', requesting confirmation');
        this.homey.emit('ai-orchestration:confirmation-needed', {
          ruleId: rule.id,
          description: rule.description,
          confidence: confidence
        });
      }
    }

    this._updateDecisionsToday();
    return results;
  }

  /**
   * Calculate confidence for a rule decision
   */
  _calculateConfidence(rule, context) {
    var confidence = 0.75;

    // Adjust based on historical success rate
    var relevantFeedback = [];
    for (var i = 0; i < this.learningFeedback.length; i++) {
      if (this.learningFeedback[i].ruleId === rule.id) {
        relevantFeedback.push(this.learningFeedback[i]);
      }
    }
    if (relevantFeedback.length > 0) {
      var successCount = 0;
      for (var j = 0; j < relevantFeedback.length; j++) {
        if (relevantFeedback[j].outcome === 'success') successCount++;
      }
      var historicalRate = successCount / relevantFeedback.length;
      confidence = confidence * 0.4 + historicalRate * 0.6;
    }

    // Higher priority rules get slight confidence boost
    confidence += (rule.priority - 5) * 0.02;

    // Clamp to 0-1
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Execute a rule action
   */
  async _executeRuleAction(rule, confidence) {
    var startTime = Date.now();
    var decision = {
      timestamp: Date.now(),
      ruleId: rule.id,
      type: rule.action,
      systems: [],
      confidence: confidence,
      outcome: 'pending',
      duration: 0,
      detail: rule.description
    };

    try {
      if (rule.action === 'trigger-scenario') {
        var scenarioName = rule.params.scenario;
        await this.executeScenario(scenarioName);
        var scenario = this.scenarios.get(scenarioName);
        decision.systems = scenario ? scenario.affectedSystems : [];
        decision.outcome = 'success';
      } else {
        this.homey.emit('ai-orchestration:action-' + rule.action, rule.params);
        decision.outcome = 'success';
      }
    } catch (error) {
      decision.outcome = 'failure';
      this.homey.error('[AIOrchestration] Rule ' + rule.id + ' execution failed: ' + error.message);
    }

    decision.duration = Date.now() - startTime;
    this._logDecision(decision);
    this._recordFeedback(rule.id, decision.outcome, confidence);

    return decision;
  }

  // ─────────────────────────────────────────────
  // CROSS-SYSTEM AUTOMATION SCENARIOS
  // ─────────────────────────────────────────────

  _initializeScenarios() {
    var scenarioDefs = [
      {
        name: 'morning-routine',
        description: 'Gradual wake-up with lights, heating, coffee, and news briefing',
        triggerConditions: ['time:06:30', 'alarm-dismissed'],
        affectedSystems: ['lighting', 'hvac', 'kitchen', 'audio', 'blinds', 'coffee-machine'],
        actions: [
          { system: 'blinds', action: 'open-gradually', params: { duration: 300 } },
          { system: 'lighting', action: 'sunrise-simulation', params: { duration: 600 } },
          { system: 'hvac', action: 'set-temperature', params: { temp: 22 } },
          { system: 'coffee-machine', action: 'brew', params: { type: 'default' } },
          { system: 'audio', action: 'play-briefing', params: { volume: 30 } }
        ],
        priority: 7, enabled: true, executionCount: 0, lastExecuted: null, averageDurationMs: 0
      },
      {
        name: 'leaving-home',
        description: 'Secure home, save energy, activate surveillance',
        triggerConditions: ['all-users-away', 'geofence-exit'],
        affectedSystems: ['security', 'lighting', 'hvac', 'locks', 'cameras', 'appliances'],
        actions: [
          { system: 'locks', action: 'lock-all', params: {} },
          { system: 'lighting', action: 'all-off', params: {} },
          { system: 'hvac', action: 'eco-mode', params: {} },
          { system: 'security', action: 'arm', params: { mode: 'away' } },
          { system: 'cameras', action: 'activate-recording', params: {} },
          { system: 'appliances', action: 'standby-check', params: {} }
        ],
        priority: 8, enabled: true, executionCount: 0, lastExecuted: null, averageDurationMs: 0
      },
      {
        name: 'arriving-home',
        description: 'Welcome home with lights, climate, and disarm security',
        triggerConditions: ['geofence-enter', 'door-unlock'],
        affectedSystems: ['security', 'lighting', 'hvac', 'audio', 'locks'],
        actions: [
          { system: 'security', action: 'disarm', params: {} },
          { system: 'locks', action: 'unlock-front', params: {} },
          { system: 'lighting', action: 'welcome-scene', params: {} },
          { system: 'hvac', action: 'comfort-mode', params: {} },
          { system: 'audio', action: 'welcome-music', params: { volume: 25 } }
        ],
        priority: 8, enabled: true, executionCount: 0, lastExecuted: null, averageDurationMs: 0
      },
      {
        name: 'bedtime',
        description: 'Dim lights, lock doors, lower temperature, enable night mode',
        triggerConditions: ['time:22:30', 'voice:goodnight'],
        affectedSystems: ['lighting', 'hvac', 'locks', 'security', 'blinds', 'audio'],
        actions: [
          { system: 'lighting', action: 'dim-all', params: { brightness: 5 } },
          { system: 'locks', action: 'lock-all', params: {} },
          { system: 'hvac', action: 'night-mode', params: { temp: 18 } },
          { system: 'security', action: 'arm', params: { mode: 'night' } },
          { system: 'blinds', action: 'close-all', params: {} },
          { system: 'audio', action: 'stop-all', params: {} }
        ],
        priority: 6, enabled: true, executionCount: 0, lastExecuted: null, averageDurationMs: 0
      },
      {
        name: 'party-mode',
        description: 'Colorful lighting, music, adjusted climate for guests',
        triggerConditions: ['voice:party-mode', 'manual-trigger'],
        affectedSystems: ['lighting', 'audio', 'hvac', 'kitchen', 'security'],
        actions: [
          { system: 'lighting', action: 'party-scene', params: { colors: true } },
          { system: 'audio', action: 'party-playlist', params: { volume: 60 } },
          { system: 'hvac', action: 'set-temperature', params: { temp: 21 } },
          { system: 'security', action: 'guest-mode', params: {} }
        ],
        priority: 5, enabled: true, executionCount: 0, lastExecuted: null, averageDurationMs: 0
      },
      {
        name: 'vacation-mode',
        description: 'Simulate presence, max security, minimal energy use',
        triggerConditions: ['manual-trigger', 'calendar:vacation'],
        affectedSystems: ['security', 'lighting', 'hvac', 'cameras', 'irrigation', 'locks'],
        actions: [
          { system: 'security', action: 'arm', params: { mode: 'vacation' } },
          { system: 'lighting', action: 'presence-simulation', params: {} },
          { system: 'hvac', action: 'minimal-mode', params: {} },
          { system: 'cameras', action: 'enhanced-monitoring', params: {} },
          { system: 'irrigation', action: 'scheduled-only', params: {} },
          { system: 'locks', action: 'lock-all', params: {} }
        ],
        priority: 7, enabled: true, executionCount: 0, lastExecuted: null, averageDurationMs: 0
      },
      {
        name: 'emergency',
        description: 'Full alert mode, unlock exits, max lighting, call emergency',
        triggerConditions: ['smoke-detected', 'intrusion', 'panic-button'],
        affectedSystems: ['security', 'lighting', 'locks', 'audio', 'hvac', 'cameras'],
        actions: [
          { system: 'lighting', action: 'all-max', params: {} },
          { system: 'locks', action: 'unlock-exits', params: {} },
          { system: 'audio', action: 'emergency-alarm', params: {} },
          { system: 'security', action: 'emergency-protocol', params: {} },
          { system: 'cameras', action: 'record-all', params: {} },
          { system: 'hvac', action: 'shutdown', params: {} }
        ],
        priority: 10, enabled: true, executionCount: 0, lastExecuted: null, averageDurationMs: 0
      },
      {
        name: 'energy-saving',
        description: 'Minimize energy consumption across all systems',
        triggerConditions: ['energy-price-peak', 'battery-low', 'grid-demand'],
        affectedSystems: ['hvac', 'lighting', 'appliances', 'ev-charger', 'pool'],
        actions: [
          { system: 'hvac', action: 'eco-mode', params: {} },
          { system: 'lighting', action: 'reduce-brightness', params: { factor: 0.5 } },
          { system: 'appliances', action: 'defer-non-essential', params: {} },
          { system: 'ev-charger', action: 'pause', params: {} },
          { system: 'pool', action: 'reduce-pump', params: {} }
        ],
        priority: 9, enabled: true, executionCount: 0, lastExecuted: null, averageDurationMs: 0
      },
      {
        name: 'comfort-max',
        description: 'Maximum comfort settings across all systems',
        triggerConditions: ['voice:comfort-max', 'manual-trigger'],
        affectedSystems: ['hvac', 'lighting', 'audio', 'blinds', 'air-purifier'],
        actions: [
          { system: 'hvac', action: 'optimal-comfort', params: {} },
          { system: 'lighting', action: 'warm-ambient', params: { brightness: 70 } },
          { system: 'air-purifier', action: 'auto-max', params: {} },
          { system: 'blinds', action: 'optimize-natural-light', params: {} }
        ],
        priority: 5, enabled: true, executionCount: 0, lastExecuted: null, averageDurationMs: 0
      },
      {
        name: 'guest-arrival',
        description: 'Prepare home for guests with welcoming ambience',
        triggerConditions: ['doorbell', 'expected-guest-time'],
        affectedSystems: ['lighting', 'audio', 'hvac', 'security', 'kitchen'],
        actions: [
          { system: 'lighting', action: 'guest-welcome', params: {} },
          { system: 'audio', action: 'ambient-music', params: { volume: 20 } },
          { system: 'hvac', action: 'set-temperature', params: { temp: 22 } },
          { system: 'security', action: 'guest-mode', params: {} }
        ],
        priority: 6, enabled: true, executionCount: 0, lastExecuted: null, averageDurationMs: 0
      },
      {
        name: 'work-from-home',
        description: 'Optimize environment for productivity and focus',
        triggerConditions: ['calendar:work', 'voice:work-mode'],
        affectedSystems: ['lighting', 'hvac', 'audio', 'network', 'blinds'],
        actions: [
          { system: 'lighting', action: 'focus-lighting', params: { colorTemp: 5000, brightness: 80 } },
          { system: 'hvac', action: 'set-temperature', params: { temp: 22 } },
          { system: 'audio', action: 'do-not-disturb', params: {} },
          { system: 'network', action: 'prioritize-work', params: {} },
          { system: 'blinds', action: 'anti-glare', params: {} }
        ],
        priority: 6, enabled: true, executionCount: 0, lastExecuted: null, averageDurationMs: 0
      },
      {
        name: 'movie-night',
        description: 'Cinema-like experience with dimmed lights and surround sound',
        triggerConditions: ['voice:movie-time', 'tv-streaming-started'],
        affectedSystems: ['lighting', 'audio', 'blinds', 'hvac', 'tv'],
        actions: [
          { system: 'lighting', action: 'movie-scene', params: { brightness: 5 } },
          { system: 'blinds', action: 'close-all', params: {} },
          { system: 'audio', action: 'surround-mode', params: {} },
          { system: 'hvac', action: 'quiet-mode', params: {} }
        ],
        priority: 5, enabled: true, executionCount: 0, lastExecuted: null, averageDurationMs: 0
      },
      {
        name: 'cooking-mode',
        description: 'Kitchen optimization with ventilation, lighting, and timers',
        triggerConditions: ['voice:cooking-mode', 'oven-activated'],
        affectedSystems: ['kitchen', 'lighting', 'hvac', 'audio', 'ventilation'],
        actions: [
          { system: 'lighting', action: 'kitchen-bright', params: { brightness: 100 } },
          { system: 'ventilation', action: 'kitchen-extract', params: { speed: 'auto' } },
          { system: 'audio', action: 'kitchen-playlist', params: { volume: 30 } }
        ],
        priority: 5, enabled: true, executionCount: 0, lastExecuted: null, averageDurationMs: 0
      },
      {
        name: 'exercise-mode',
        description: 'Energize environment for workout with music and climate',
        triggerConditions: ['voice:workout', 'gym-equipment-active'],
        affectedSystems: ['lighting', 'audio', 'hvac', 'air-purifier'],
        actions: [
          { system: 'lighting', action: 'energize-scene', params: { brightness: 100, colorTemp: 6500 } },
          { system: 'audio', action: 'workout-playlist', params: { volume: 70 } },
          { system: 'hvac', action: 'set-temperature', params: { temp: 19 } },
          { system: 'air-purifier', action: 'max-speed', params: {} }
        ],
        priority: 5, enabled: true, executionCount: 0, lastExecuted: null, averageDurationMs: 0
      },
      {
        name: 'baby-sleeping',
        description: 'Ultra-quiet mode with minimal disturbances and monitoring',
        triggerConditions: ['baby-monitor:sleeping', 'voice:baby-sleeping'],
        affectedSystems: ['lighting', 'audio', 'hvac', 'security', 'doorbell'],
        actions: [
          { system: 'audio', action: 'silence-all', params: {} },
          { system: 'lighting', action: 'nursery-nightlight', params: {} },
          { system: 'hvac', action: 'silent-mode', params: { temp: 20 } },
          { system: 'doorbell', action: 'silent-mode', params: {} },
          { system: 'security', action: 'nursery-monitor-enhanced', params: {} }
        ],
        priority: 8, enabled: true, executionCount: 0, lastExecuted: null, averageDurationMs: 0
      }
    ];

    for (var si = 0; si < scenarioDefs.length; si++) {
      this.scenarios.set(scenarioDefs[si].name, scenarioDefs[si]);
    }

    this.homey.log('[AIOrchestration] Initialized ' + this.scenarios.size + ' automation scenarios');
  }

  /**
   * Execute a cross-system automation scenario
   */
  async executeScenario(scenarioName) {
    var scenario = this.scenarios.get(scenarioName);
    if (!scenario) {
      this.homey.error('[AIOrchestration] Unknown scenario: ' + scenarioName);
      return { success: false, error: 'Unknown scenario' };
    }

    if (!scenario.enabled) {
      this.homey.log('[AIOrchestration] Scenario disabled: ' + scenarioName);
      return { success: false, error: 'Scenario disabled' };
    }

    var startTime = Date.now();
    this.homey.log('[AIOrchestration] Executing scenario: ' + scenarioName);

    var results = [];
    for (var ai = 0; ai < scenario.actions.length; ai++) {
      var action = scenario.actions[ai];
      try {
        var cb = this.circuitBreakers.get(action.system);
        if (cb && cb.state === 'open') {
          results.push({ system: action.system, action: action.action, status: 'skipped', reason: 'circuit-open' });
          continue;
        }

        this.homey.emit('ai-orchestration:scenario-action', {
          scenario: scenarioName,
          system: action.system,
          action: action.action,
          params: action.params
        });

        results.push({ system: action.system, action: action.action, status: 'executed' });
      } catch (error) {
        results.push({ system: action.system, action: action.action, status: 'failed', error: error.message });
        this.homey.error('[AIOrchestration] Scenario action failed: ' + action.system + '.' + action.action);
      }
    }

    var duration = Date.now() - startTime;
    scenario.executionCount++;
    scenario.lastExecuted = Date.now();
    scenario.averageDurationMs = scenario.executionCount === 1
      ? duration
      : (scenario.averageDurationMs * (scenario.executionCount - 1) + duration) / scenario.executionCount;

    this.homey.emit('ai-orchestration:scenario-completed', {
      scenario: scenarioName,
      duration: duration,
      results: results
    });

    var allExecuted = true;
    for (var ri2 = 0; ri2 < results.length; ri2++) {
      if (results[ri2].status !== 'executed') { allExecuted = false; break; }
    }

    this._logDecision({
      type: 'scenario-execution',
      systems: scenario.affectedSystems,
      action: scenarioName,
      confidence: 0.9,
      outcome: allExecuted ? 'success' : 'partial',
      duration: duration
    });

    return { success: true, duration: duration, results: results };
  }

  /**
   * Enable or disable a scenario
   */
  setScenarioEnabled(scenarioName, enabled) {
    var scenario = this.scenarios.get(scenarioName);
    if (!scenario) return false;
    scenario.enabled = enabled;
    this.homey.log('[AIOrchestration] Scenario ' + scenarioName + ' ' + (enabled ? 'enabled' : 'disabled'));
    return true;
  }

  /**
   * Get scenario details
   */
  getScenario(scenarioName) {
    return this.scenarios.get(scenarioName) || null;
  }

  /**
   * List all scenarios with summary info
   */
  listScenarios() {
    var list = [];
    for (var entry of this.scenarios) {
      list.push({
        name: entry[0],
        description: entry[1].description,
        enabled: entry[1].enabled,
        priority: entry[1].priority,
        executionCount: entry[1].executionCount,
        lastExecuted: entry[1].lastExecuted,
        affectedSystemsCount: entry[1].affectedSystems.length
      });
    }
    return list;
  }

  // ─────────────────────────────────────────────
  // CONFLICT RESOLUTION ENGINE
  // ─────────────────────────────────────────────

  _detectRuleConflicts(matchedRules) {
    var conflicts = [];
    var conflictPairs = [
      ['activate-cooling', 'activate-heating'],
      ['turn-on-lights', 'turn-off-lights'],
      ['lock-all', 'unlock-exits'],
      ['silence-all', 'party-playlist'],
      ['eco-mode', 'comfort-max'],
      ['open-gradually', 'close-all'],
      ['increase-ventilation', 'close-windows-purify']
    ];

    for (var i = 0; i < matchedRules.length; i++) {
      for (var j = i + 1; j < matchedRules.length; j++) {
        for (var cp = 0; cp < conflictPairs.length; cp++) {
          var actA = conflictPairs[cp][0];
          var actB = conflictPairs[cp][1];
          if ((matchedRules[i].action === actA && matchedRules[j].action === actB) ||
              (matchedRules[i].action === actB && matchedRules[j].action === actA)) {
            conflicts.push({ ruleA: matchedRules[i], ruleB: matchedRules[j], type: actA + '-vs-' + actB });
          }
        }
      }
    }
    return conflicts;
  }

  async _resolveConflicts(conflicts, matchedRules) {
    for (var ci = 0; ci < conflicts.length; ci++) {
      var conflict = conflicts[ci];
      var loser = conflict.ruleA.priority >= conflict.ruleB.priority ? conflict.ruleB : conflict.ruleA;
      var winner = conflict.ruleA.priority >= conflict.ruleB.priority ? conflict.ruleA : conflict.ruleB;

      var idx = matchedRules.indexOf(loser);
      if (idx !== -1) matchedRules.splice(idx, 1);

      this.conflictsResolved++;
      this.activeConflicts.push({
        timestamp: Date.now(),
        type: conflict.type,
        winner: winner.id,
        loser: loser.id,
        resolvedBy: 'priority'
      });

      if (this.activeConflicts.length > 100) {
        this.activeConflicts = this.activeConflicts.slice(-100);
      }

      this.homey.log('[AIOrchestration] Conflict resolved: ' + winner.id + ' (priority ' + winner.priority + ') wins over ' + loser.id + ' (priority ' + loser.priority + ')');
      this.homey.emit('ai-orchestration:conflict-resolved', {
        type: conflict.type,
        winnerId: winner.id,
        loserId: loser.id
      });
    }
  }

  // ─────────────────────────────────────────────
  // SYSTEM HEALTH MONITORING
  // ─────────────────────────────────────────────

  _startHeartbeatMonitoring() {
    var self = this;
    var heartbeatInterval = setInterval(function() {
      var now = Date.now();
      var heartbeatTimeout = 60000;

      for (var entry of self.systems) {
        var sName = entry[0];
        var sys = entry[1];
        if (sys.status === 'offline') continue;

        var elapsed = now - sys.lastHeartbeat;
        if (elapsed > heartbeatTimeout && sys.status === 'online') {
          sys.status = 'degraded';
          self.homey.log('[AIOrchestration] System heartbeat timeout: ' + sName + ' (' + elapsed + 'ms)');
          self.homey.emit('ai-orchestration:heartbeat-timeout', { name: sName, elapsed: elapsed });
          self.reportSystemError(sName, new Error('Heartbeat timeout'));
        }

        var uptime = sys.registeredAt ? ((now - sys.registeredAt) - (sys.errorCount * 5000)) / (now - sys.registeredAt) * 100 : 100;
        sys.uptimePercent = Math.max(0, Math.min(100, uptime));
      }
    }, 30000);

    this.intervals.push(heartbeatInterval);
  }

  _startCircuitBreakerManager() {
    var self = this;
    var cbInterval = setInterval(function() {
      var now = Date.now();
      for (var entry of self.circuitBreakers) {
        var cbName = entry[0];
        var cb = entry[1];
        if (cb.state === 'open' && cb.openedAt) {
          if (now - cb.openedAt >= cb.halfOpenTimeout) {
            cb.state = 'half-open';
            self.homey.log('[AIOrchestration] Circuit breaker half-open for ' + cbName + ', attempting recovery');
            self.homey.emit('ai-orchestration:circuit-half-open', { name: cbName });
          }
        }
      }
    }, 15000);

    this.intervals.push(cbInterval);
  }

  _checkCascadeFailure(failedSystem) {
    var affected = [];
    for (var entry of this.dependencyGraph) {
      var depName = entry[0];
      var deps = entry[1];
      if (deps.indexOf(failedSystem) !== -1) {
        affected.push(depName);
        var sys = this.systems.get(depName);
        if (sys && sys.status === 'online') {
          sys.status = 'degraded';
          this.homey.log('[AIOrchestration] Cascade degradation: ' + depName + ' depends on failed ' + failedSystem);
        }
      }
    }

    if (affected.length > 0) {
      this.homey.emit('ai-orchestration:cascade-failure', { source: failedSystem, affected: affected });
    }
  }

  // ─────────────────────────────────────────────
  // PERFORMANCE METRICS
  // ─────────────────────────────────────────────

  _startPerformanceTracking() {
    var self = this;
    var perfInterval = setInterval(function() {
      var now = Date.now();

      self.performanceMetrics.eventsLastMinute = self.performanceMetrics.eventsLastMinute.filter(function(ts) { return now - ts < 60000; });
      self.performanceMetrics.eventThroughput = self.performanceMetrics.eventsLastMinute.length / 60;

      if (self.performanceMetrics.responseTimes.length > 0) {
        var sum = 0;
        for (var i = 0; i < self.performanceMetrics.responseTimes.length; i++) {
          sum += self.performanceMetrics.responseTimes[i];
        }
        self.performanceMetrics.averageResponseTime = sum / self.performanceMetrics.responseTimes.length;
        if (self.performanceMetrics.responseTimes.length > 100) {
          self.performanceMetrics.responseTimes = self.performanceMetrics.responseTimes.slice(-100);
        }
      }

      var totalOps = self.performanceMetrics.eventsProcessed || 1;
      self.performanceMetrics.errorRate = self.performanceMetrics.totalErrors / totalOps;
      self.performanceMetrics.errorsLastHour = Math.max(0, self.performanceMetrics.errorsLastHour - 1);

      var totalCpu = 0;
      var totalMem = 0;
      for (var entry of self.systems) {
        totalCpu += entry[1].cpuUsagePercent;
        totalMem += entry[1].memoryUsageMB;
      }
      self.globalResourceLimits.currentCpuPercent = totalCpu;
      self.globalResourceLimits.currentMemoryMB = totalMem;
    }, 10000);

    this.intervals.push(perfInterval);
  }

  /**
   * Record an event for throughput tracking
   */
  recordEvent(eventName, source, target) {
    this.performanceMetrics.eventsProcessed++;
    this.performanceMetrics.eventsLastMinute.push(Date.now());

    var pubCount = this.eventBusAnalytics.publishers.get(source) || 0;
    this.eventBusAnalytics.publishers.set(source, pubCount + 1);

    if (target) {
      var subCount = this.eventBusAnalytics.subscribers.get(target) || 0;
      this.eventBusAnalytics.subscribers.set(target, subCount + 1);
    }

    this.eventBusAnalytics.eventFlow.push({
      timestamp: Date.now(),
      event: eventName,
      source: source,
      target: target
    });

    if (this.eventBusAnalytics.eventFlow.length > this.eventBusAnalytics.maxFlowHistory) {
      this.eventBusAnalytics.eventFlow = this.eventBusAnalytics.eventFlow.slice(-this.eventBusAnalytics.maxFlowHistory);
    }
  }

  /**
   * Record response time for a system
   */
  recordResponseTime(systemName, responseTimeMs) {
    this.performanceMetrics.responseTimes.push(responseTimeMs);
    var sys = this.systems.get(systemName);
    if (sys) sys.responseTimeMs = responseTimeMs;
  }

  // ─────────────────────────────────────────────
  // EVENT BUS ANALYTICS
  // ─────────────────────────────────────────────

  _startEventBusAnalytics() {
    var self = this;
    var analyticsInterval = setInterval(function() {
      var bottlenecks = [];

      for (var entry of self.systems) {
        var sysName = entry[0];
        var sys = entry[1];
        var pubCnt = self.eventBusAnalytics.publishers.get(sysName) || 0;
        var subCnt = self.eventBusAnalytics.subscribers.get(sysName) || 0;
        var totalEvts = pubCnt + subCnt;

        if (totalEvts > 50 && sys.responseTimeMs > 500) {
          bottlenecks.push({
            system: sysName,
            events: totalEvts,
            responseTimeMs: sys.responseTimeMs,
            severity: sys.responseTimeMs > 1000 ? 'high' : 'medium'
          });
        }
      }

      self.eventBusAnalytics.bottlenecks = bottlenecks;
      if (bottlenecks.length > 0) {
        self.homey.log('[AIOrchestration] Detected ' + bottlenecks.length + ' event bus bottlenecks');
        self.homey.emit('ai-orchestration:bottlenecks-detected', { bottlenecks: bottlenecks });
      }
    }, 60000);

    this.intervals.push(analyticsInterval);
  }

  /**
   * Get top publishers and subscribers
   */
  getEventBusTopActors(limit) {
    if (!limit) limit = 10;
    var pubs = [];
    for (var pe of this.eventBusAnalytics.publishers) {
      pubs.push({ name: pe[0], count: pe[1] });
    }
    pubs.sort(function(a, b) { return b.count - a.count; });

    var subs = [];
    for (var se of this.eventBusAnalytics.subscribers) {
      subs.push({ name: se[0], count: se[1] });
    }
    subs.sort(function(a, b) { return b.count - a.count; });

    return { publishers: pubs.slice(0, limit), subscribers: subs.slice(0, limit), bottlenecks: this.eventBusAnalytics.bottlenecks };
  }

  // ─────────────────────────────────────────────
  // ML SIMULATION - PATTERN RECOGNITION
  // ─────────────────────────────────────────────

  _startMLPatternRecognition() {
    var self = this;
    var mlInterval = setInterval(function() {
      self._analyzeTimePatterns();
      self._detectAnomalies();
      self._generatePredictions();
    }, 120000);

    this.intervals.push(mlInterval);
  }

  _analyzeTimePatterns() {
    var now = new Date();
    var hour = now.getHours();
    var day = now.getDay();
    var month = now.getMonth();

    var hourKey = 'hour-' + hour;
    var existing = this.mlPatterns.timeOfDay.get(hourKey) || {
      activeSystems: [], commonScenarios: [], avgEnergyUsage: 0, sampleCount: 0
    };
    var onlineSys = this.getOnlineSystems().map(function(s) { return s.name; });
    existing.activeSystems = onlineSys;
    existing.sampleCount++;
    this.mlPatterns.timeOfDay.set(hourKey, existing);

    var dayKey = 'day-' + day;
    var dayExist = this.mlPatterns.dayOfWeek.get(dayKey) || {
      peakHours: [], avgSystemsActive: 0, sampleCount: 0
    };
    dayExist.avgSystemsActive = (dayExist.avgSystemsActive * dayExist.sampleCount + onlineSys.length) / (dayExist.sampleCount + 1);
    dayExist.sampleCount++;
    this.mlPatterns.dayOfWeek.set(dayKey, dayExist);

    var seasonKey = 'month-' + month;
    var seasonExist = this.mlPatterns.seasonal.get(seasonKey) || {
      avgTemperature: null, energyTrend: 'stable', sampleCount: 0
    };
    seasonExist.sampleCount++;
    this.mlPatterns.seasonal.set(seasonKey, seasonExist);
  }

  _detectAnomalies() {
    var anomalies = [];

    for (var entry of this.systems) {
      var aName = entry[0];
      var aSys = entry[1];

      if (aSys.cpuUsagePercent > 90) {
        anomalies.push({ timestamp: Date.now(), system: aName, type: 'high-cpu', value: aSys.cpuUsagePercent, threshold: 90, severity: 'warning' });
      }
      if (aSys.memoryUsageMB > 200) {
        anomalies.push({ timestamp: Date.now(), system: aName, type: 'high-memory', value: aSys.memoryUsageMB, threshold: 200, severity: 'warning' });
      }
      if (aSys.errorCount > 10) {
        anomalies.push({ timestamp: Date.now(), system: aName, type: 'high-error-rate', value: aSys.errorCount, threshold: 10, severity: 'critical' });
      }
      if (aSys.responseTimeMs > 2000) {
        anomalies.push({ timestamp: Date.now(), system: aName, type: 'slow-response', value: aSys.responseTimeMs, threshold: 2000, severity: 'warning' });
      }
    }

    if (anomalies.length > 0) {
      this.mlPatterns.anomalies = this.mlPatterns.anomalies.concat(anomalies).slice(-200);
      this.homey.emit('ai-orchestration:anomalies-detected', { anomalies: anomalies });
    }
  }

  _generatePredictions() {
    var predictions = [];
    var now = new Date();
    var nextHour = (now.getHours() + 1) % 24;

    var nextHourPattern = this.mlPatterns.timeOfDay.get('hour-' + nextHour);
    if (nextHourPattern && nextHourPattern.sampleCount > 3) {
      predictions.push({
        type: 'activity-forecast',
        timeframe: 'hour-' + nextHour,
        predictedSystems: nextHourPattern.activeSystems,
        confidence: Math.min(0.95, 0.5 + nextHourPattern.sampleCount * 0.05),
        generatedAt: Date.now()
      });
    }

    for (var entry of this.scenarios) {
      var scName = entry[0];
      var sc = entry[1];
      if (sc.executionCount > 5 && sc.lastExecuted) {
        var avgInterval = (Date.now() - sc.lastExecuted) / sc.executionCount;
        if (avgInterval < 86400000) {
          predictions.push({
            type: 'scenario-prediction',
            scenario: scName,
            likelyWithin: avgInterval,
            confidence: Math.min(0.85, 0.4 + sc.executionCount * 0.03),
            generatedAt: Date.now()
          });
        }
      }
    }

    this.mlPatterns.predictions = predictions;
  }

  /**
   * Get current ML predictions
   */
  getPredictions() {
    return {
      predictions: this.mlPatterns.predictions,
      anomalies: this.mlPatterns.anomalies.slice(-20),
      patternCount: {
        timeOfDay: this.mlPatterns.timeOfDay.size,
        dayOfWeek: this.mlPatterns.dayOfWeek.size,
        seasonal: this.mlPatterns.seasonal.size
      }
    };
  }

  // ─────────────────────────────────────────────
  // RESOURCE ALLOCATION
  // ─────────────────────────────────────────────

  _initializeResourceBudgets() {
    this.homey.log('[AIOrchestration] Resource allocation engine initialized');
  }

  /**
   * Set resource budget for a system
   */
  setResourceBudget(systemName, budget) {
    var existing = this.resourceBudgets.get(systemName);
    if (!existing) return false;

    if (budget.maxCpuPercent !== undefined) existing.maxCpuPercent = budget.maxCpuPercent;
    if (budget.maxMemoryMB !== undefined) existing.maxMemoryMB = budget.maxMemoryMB;

    this.homey.log('[AIOrchestration] Updated resource budget for ' + systemName + ': CPU ' + existing.maxCpuPercent + '%, Memory ' + existing.maxMemoryMB + 'MB');
    return true;
  }

  /**
   * Get resource usage summary
   */
  getResourceUsage() {
    var usage = [];
    for (var entry of this.resourceBudgets) {
      usage.push({
        system: entry[0],
        cpuUsage: entry[1].currentCpuPercent,
        cpuBudget: entry[1].maxCpuPercent,
        memoryUsage: entry[1].currentMemoryMB,
        memoryBudget: entry[1].maxMemoryMB,
        throttled: entry[1].throttled,
        cpuUtilization: entry[1].maxCpuPercent > 0 ? (entry[1].currentCpuPercent / entry[1].maxCpuPercent * 100).toFixed(1) : 0
      });
    }
    return { systems: usage, global: Object.assign({}, this.globalResourceLimits) };
  }

  // ─────────────────────────────────────────────
  // DEPENDENCY GRAPH
  // ─────────────────────────────────────────────

  _initializeDependencyGraph() {
    var defaultDeps = {
      'lighting': [],
      'hvac': ['energy-manager'],
      'security': ['network', 'cameras'],
      'cameras': ['network', 'storage'],
      'audio': ['network'],
      'kitchen': ['energy-manager'],
      'ev-charger': ['energy-manager'],
      'irrigation': ['weather-service'],
      'air-purifier': ['air-quality-sensor'],
      'blinds': ['weather-service']
    };

    var keys = Object.keys(defaultDeps);
    for (var i = 0; i < keys.length; i++) {
      this.dependencyGraph.set(keys[i], defaultDeps[keys[i]]);
    }

    this.homey.log('[AIOrchestration] Dependency graph initialized with ' + this.dependencyGraph.size + ' entries');
  }

  /**
   * Get startup order based on dependency graph (topological sort)
   */
  getStartupOrder() {
    var visited = new Set();
    var order = [];
    var visiting = new Set();
    var self = this;

    function visit(node) {
      if (visited.has(node)) return;
      if (visiting.has(node)) {
        self.homey.log('[AIOrchestration] Circular dependency detected involving: ' + node);
        return;
      }
      visiting.add(node);
      var deps = self.dependencyGraph.get(node) || [];
      for (var i = 0; i < deps.length; i++) { visit(deps[i]); }
      visiting.delete(node);
      visited.add(node);
      order.push(node);
    }

    for (var entry of this.dependencyGraph) { visit(entry[0]); }
    return order;
  }

  /**
   * Get all dependents of a system
   */
  getDependents(systemName) {
    var dependents = [];
    for (var entry of this.dependencyGraph) {
      if (entry[1].indexOf(systemName) !== -1) dependents.push(entry[0]);
    }
    return dependents;
  }

  /**
   * Get full dependency chain for a system
   */
  getDependencyChain(systemName) {
    var chain = [];
    var visited = new Set();
    var self = this;

    function traverse(name) {
      if (visited.has(name)) return;
      visited.add(name);
      var deps = self.dependencyGraph.get(name) || [];
      for (var i = 0; i < deps.length; i++) {
        chain.push({ from: name, to: deps[i] });
        traverse(deps[i]);
      }
    }

    traverse(systemName);
    return chain;
  }

  // ─────────────────────────────────────────────
  // COMMUNICATION PROTOCOLS
  // ─────────────────────────────────────────────

  _initializeCommunicationProtocols() {
    this.communicationChannels.set('direct', { type: 'sync', timeout: 5000, active: true });
    this.communicationChannels.set('event-bus', { type: 'async', active: true, queueSize: 0 });
    this.communicationChannels.set('broadcast', { type: 'async', active: true, subscribers: new Set() });
    this.communicationChannels.set('request-response', { type: 'sync', timeout: 10000, active: true, pendingCount: 0 });
    this.homey.log('[AIOrchestration] Communication protocols initialized');
  }

  /**
   * Send a direct synchronous message to a system
   */
  async sendDirectMessage(targetSystem, message) {
    var sys = this.systems.get(targetSystem);
    if (!sys || sys.status === 'offline') {
      return { success: false, error: 'System unavailable' };
    }
    var cb = this.circuitBreakers.get(targetSystem);
    if (cb && cb.state === 'open') {
      return { success: false, error: 'Circuit breaker open' };
    }

    var startTime = Date.now();
    try {
      this.homey.emit('ai-orchestration:direct-message:' + targetSystem, message);
      var responseTime = Date.now() - startTime;
      this.recordResponseTime(targetSystem, responseTime);
      this.recordEvent('direct-message', 'orchestrator', targetSystem);
      return { success: true, responseTime: responseTime };
    } catch (error) {
      this.reportSystemError(targetSystem, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Broadcast message to all systems or specific category
   */
  broadcast(message, category) {
    var count = 0;
    for (var entry of this.systems) {
      if (category && entry[1].category !== category) continue;
      if (entry[1].status === 'offline') continue;
      this.homey.emit('ai-orchestration:broadcast:' + entry[0], message);
      count++;
    }
    this.recordEvent('broadcast', 'orchestrator', (category || 'all'));
    this.homey.log('[AIOrchestration] Broadcast sent to ' + count + ' systems' + (category ? ' (' + category + ')' : ''));
    return { recipientCount: count };
  }

  /**
   * Send request-response with timeout
   */
  async requestResponse(targetSystem, request, timeout) {
    var effectiveTimeout = timeout || this.requestTimeout;
    var requestId = 'req-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

    this.pendingRequests.set(requestId, {
      target: targetSystem, request: request,
      timestamp: Date.now(), timeout: effectiveTimeout, resolved: false
    });

    var channel = this.communicationChannels.get('request-response');
    if (channel) channel.pendingCount++;

    try {
      this.homey.emit('ai-orchestration:request:' + targetSystem, Object.assign({ requestId: requestId }, request));

      var result = await new Promise(function(resolve, reject) {
        var timer = setTimeout(function() {
          reject(new Error('Request to ' + targetSystem + ' timed out after ' + effectiveTimeout + 'ms'));
        }, effectiveTimeout);

        setTimeout(function() {
          clearTimeout(timer);
          resolve({ requestId: requestId, status: 'acknowledged', target: targetSystem });
        }, Math.min(100, effectiveTimeout - 100));
      });

      var pending = this.pendingRequests.get(requestId);
      if (pending) pending.resolved = true;
      return { success: true, result: result };
    } catch (error) {
      this.homey.error('[AIOrchestration] Request failed: ' + error.message);
      return { success: false, error: error.message };
    } finally {
      this.pendingRequests.delete(requestId);
      if (channel) channel.pendingCount = Math.max(0, channel.pendingCount - 1);
    }
  }

  // ─────────────────────────────────────────────
  // AI CONFIDENCE & LEARNING FEEDBACK
  // ─────────────────────────────────────────────

  _recordFeedback(ruleId, outcome, confidence) {
    this.learningFeedback.push({
      timestamp: Date.now(), ruleId: ruleId, outcome: outcome, confidence: confidence
    });
    if (this.learningFeedback.length > this.maxFeedbackHistory) {
      this.learningFeedback = this.learningFeedback.slice(-this.maxFeedbackHistory);
    }
  }

  /**
   * Submit manual feedback for a decision
   */
  submitFeedback(decisionTimestamp, outcome) {
    var decision = null;
    for (var i = 0; i < this.decisionLog.length; i++) {
      if (this.decisionLog[i].timestamp === decisionTimestamp) { decision = this.decisionLog[i]; break; }
    }
    if (!decision) return false;

    decision.userFeedback = outcome;
    this.learningFeedback.push({
      timestamp: Date.now(), ruleId: decision.ruleId || 'manual',
      outcome: outcome, confidence: decision.confidence, isUserFeedback: true
    });
    this.homey.log('[AIOrchestration] Feedback received for decision at ' + decisionTimestamp + ': ' + outcome);
    return true;
  }

  /**
   * Get learning statistics
   */
  getLearningStats() {
    var total = this.learningFeedback.length;
    if (total === 0) return { total: 0, successRate: 0, avgConfidence: 0 };

    var successes = 0;
    var totalConf = 0;
    var userFbCount = 0;
    var ruleStats = {};
    for (var i = 0; i < total; i++) {
      var fb = this.learningFeedback[i];
      if (fb.outcome === 'success') successes++;
      totalConf += fb.confidence;
      if (fb.isUserFeedback) userFbCount++;
      if (!ruleStats[fb.ruleId]) ruleStats[fb.ruleId] = { total: 0, successes: 0 };
      ruleStats[fb.ruleId].total++;
      if (fb.outcome === 'success') ruleStats[fb.ruleId].successes++;
    }

    return {
      total: total,
      successRate: successes / total,
      avgConfidence: totalConf / total,
      ruleStats: ruleStats,
      feedbackCount: userFbCount
    };
  }

  // ─────────────────────────────────────────────
  // SYSTEM DISCOVERY
  // ─────────────────────────────────────────────

  _startSystemDiscovery() {
    var self = this;
    var discoveryInterval = setInterval(function() {
      self._runDiscoveryScan();
    }, 300000);

    this.intervals.push(discoveryInterval);
  }

  _runDiscoveryScan() {
    var knownSystems = new Set(this.systems.keys());

    for (var entry of this.eventBusAnalytics.publishers) {
      var source = entry[0];
      if (!knownSystems.has(source)) {
        var found = false;
        for (var d = 0; d < this.discoveredSystems.length; d++) {
          if (this.discoveredSystems[d].name === source) { found = true; break; }
        }
        if (!found) {
          var discovered = {
            name: source,
            discoveredAt: Date.now(),
            suggestedCategory: this._suggestCategory(source),
            autoRegistered: false,
            eventCount: entry[1] || 0
          };
          this.discoveredSystems.push(discovered);
          this.homey.log('[AIOrchestration] Discovered new system: ' + source);
          this.homey.emit('ai-orchestration:system-discovered', discovered);
          this._generateIntegrationSuggestion(discovered);
        }
      }
    }
  }

  _suggestCategory(systemName) {
    var categoryKeywords = {
      energy: ['energy', 'power', 'solar', 'battery', 'grid', 'ev', 'charger'],
      security: ['security', 'camera', 'lock', 'alarm', 'motion', 'sensor'],
      comfort: ['light', 'blind', 'hvac', 'climate', 'thermostat', 'temperature'],
      health: ['health', 'air', 'purifier', 'medical', 'fitness', 'sleep'],
      utility: ['washer', 'dryer', 'dishwasher', 'vacuum', 'robot'],
      automation: ['auto', 'scene', 'routine', 'schedule', 'timer'],
      entertainment: ['audio', 'music', 'tv', 'media', 'speaker', 'stream'],
      environment: ['garden', 'irrigation', 'weather', 'pool', 'outdoor'],
      transport: ['vehicle', 'garage', 'car', 'bike', 'commute'],
      food: ['kitchen', 'oven', 'fridge', 'coffee', 'cook'],
      education: ['learn', 'school', 'study', 'child', 'homework'],
      maintenance: ['maintenance', 'repair', 'filter', 'update', 'clean']
    };

    var lowerName = systemName.toLowerCase();
    var cats = Object.keys(categoryKeywords);
    for (var c = 0; c < cats.length; c++) {
      var kws = categoryKeywords[cats[c]];
      for (var k = 0; k < kws.length; k++) {
        if (lowerName.indexOf(kws[k]) !== -1) return cats[c];
      }
    }
    return 'utility';
  }

  _generateIntegrationSuggestion(discoveredSystem) {
    var suggestion = {
      system: discoveredSystem.name,
      suggestedCategory: discoveredSystem.suggestedCategory,
      suggestedPriority: 5,
      potentialScenarios: [],
      timestamp: Date.now()
    };

    for (var entry of this.scenarios) {
      if (entry[1].affectedSystems.length < 8) {
        suggestion.potentialScenarios.push(entry[0]);
      }
    }

    this.integrationSuggestions.push(suggestion);
    this.homey.emit('ai-orchestration:integration-suggestion', suggestion);
  }

  /**
   * Get discovered but unregistered systems
   */
  getDiscoveredSystems() {
    return this.discoveredSystems.filter(function(d) { return !d.autoRegistered; });
  }

  /**
   * Auto-register a discovered system
   */
  autoRegisterDiscovered(systemName) {
    var discovered = null;
    for (var i = 0; i < this.discoveredSystems.length; i++) {
      if (this.discoveredSystems[i].name === systemName) { discovered = this.discoveredSystems[i]; break; }
    }
    if (!discovered) return false;

    this.registerSystem({ name: discovered.name, category: discovered.suggestedCategory, priority: 5 });
    discovered.autoRegistered = true;
    this.homey.log('[AIOrchestration] Auto-registered discovered system: ' + systemName);
    return true;
  }

  // ─────────────────────────────────────────────
  // LOAD BALANCING
  // ─────────────────────────────────────────────

  _startLoadBalancing() {
    var self = this;
    var lbInterval = setInterval(function() {
      self._evaluateSystemLoads();
    }, 20000);

    this.intervals.push(lbInterval);
  }

  _evaluateSystemLoads() {
    var overloadedCount = 0;

    for (var entry of this.systems) {
      var lbName = entry[0];
      var lbSys = entry[1];
      var load = (lbSys.cpuUsagePercent * 0.6) + ((lbSys.memoryUsageMB / 256) * 100 * 0.4);
      this.loadBalancer.systemLoads.set(lbName, load);

      if (load > this.loadBalancer.overloadThreshold) {
        overloadedCount++;
        if (!this.loadBalancer.sheddedSystems.has(lbName) && lbSys.priority < 7) {
          this.loadBalancer.sheddedSystems.add(lbName);
          this.homey.log('[AIOrchestration] Load shedding non-critical system: ' + lbName + ' (load: ' + load.toFixed(1) + '%)');
          this.homey.emit('ai-orchestration:load-shed', { name: lbName, load: load });
        }
      } else {
        if (this.loadBalancer.sheddedSystems.has(lbName)) {
          this.loadBalancer.sheddedSystems.delete(lbName);
          this.homey.log('[AIOrchestration] Restoring shed system: ' + lbName + ' (load: ' + load.toFixed(1) + '%)');
        }
      }
    }

    this.loadBalancer.sheddingActive = overloadedCount > 0;
  }

  /**
   * Get load balancing status
   */
  getLoadBalancingStatus() {
    var loads = [];
    for (var entry of this.loadBalancer.systemLoads) {
      loads.push({ system: entry[0], load: parseFloat(entry[1].toFixed(1)), shed: this.loadBalancer.sheddedSystems.has(entry[0]) });
    }
    loads.sort(function(a, b) { return b.load - a.load; });

    return {
      sheddingActive: this.loadBalancer.sheddingActive,
      sheddedCount: this.loadBalancer.sheddedSystems.size,
      systemLoads: loads,
      overloadThreshold: this.loadBalancer.overloadThreshold
    };
  }

  // ─────────────────────────────────────────────
  // ORCHESTRATION QUEUE
  // ─────────────────────────────────────────────

  _startQueueProcessor() {
    var self = this;
    var queueInterval = setInterval(function() {
      self._processQueue();
    }, 1000);

    this.intervals.push(queueInterval);
  }

  /**
   * Enqueue an action with optional priority override
   */
  enqueueAction(action) {
    var targetSystem = action.targetSystem;
    var actionType = action.actionType;
    var params = action.params || {};
    var priority = action.priority || 5;
    var callback = action.callback || null;

    if (this.orchestrationQueue.queue.length >= this.orchestrationQueue.maxDepth) {
      var lowIdx = -1;
      for (var lp = 0; lp < this.orchestrationQueue.queue.length; lp++) {
        if (this.orchestrationQueue.queue[lp].priority < 5) { lowIdx = lp; break; }
      }
      if (lowIdx !== -1) {
        var removed = this.orchestrationQueue.queue.splice(lowIdx, 1)[0];
        this._addToDeadLetterQueue(removed, 'queue-full-displaced');
      } else {
        this._addToDeadLetterQueue(action, 'queue-full-rejected');
        return { queued: false, reason: 'Queue at maximum depth' };
      }
    }

    var queueItem = {
      id: 'q-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
      targetSystem: targetSystem,
      actionType: actionType,
      params: params,
      priority: priority,
      callback: callback,
      enqueuedAt: Date.now(),
      attempts: 0,
      maxAttempts: 3
    };

    var inserted = false;
    for (var i = 0; i < this.orchestrationQueue.queue.length; i++) {
      if (this.orchestrationQueue.queue[i].priority < priority) {
        this.orchestrationQueue.queue.splice(i, 0, queueItem);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      this.orchestrationQueue.queue.push(queueItem);
    }

    return { queued: true, id: queueItem.id, position: this.orchestrationQueue.queue.indexOf(queueItem) };
  }

  async _processQueue() {
    if (this.orchestrationQueue.processing || this.orchestrationQueue.queue.length === 0) return;
    this.orchestrationQueue.processing = true;

    try {
      var item = this.orchestrationQueue.queue.shift();
      if (!item) return;
      item.attempts++;

      try {
        var cb = this.circuitBreakers.get(item.targetSystem);
        if (cb && cb.state === 'open') {
          throw new Error('Circuit breaker open');
        }

        this.homey.emit('ai-orchestration:queue-action:' + item.targetSystem, {
          actionType: item.actionType,
          params: item.params
        });

        if (item.callback && typeof item.callback === 'function') {
          item.callback(null, { success: true });
        }
      } catch (error) {
        if (item.attempts < item.maxAttempts) {
          this.orchestrationQueue.queue.unshift(item);
        } else {
          this._addToDeadLetterQueue(item, error.message);
        }
      }
    } finally {
      this.orchestrationQueue.processing = false;
    }
  }

  _addToDeadLetterQueue(item, reason) {
    this.orchestrationQueue.deadLetterQueue.push({
      id: item.id,
      targetSystem: item.targetSystem,
      actionType: item.actionType,
      params: item.params,
      priority: item.priority,
      enqueuedAt: item.enqueuedAt,
      attempts: item.attempts,
      failedAt: Date.now(),
      failureReason: reason
    });

    if (this.orchestrationQueue.deadLetterQueue.length > this.orchestrationQueue.maxDeadLetterSize) {
      this.orchestrationQueue.deadLetterQueue.shift();
    }

    this.homey.log('[AIOrchestration] Action moved to dead letter queue: ' + (item.actionType || 'unknown') + ' -> ' + (item.targetSystem || 'unknown') + ' (' + reason + ')');
  }

  /**
   * Get queue status
   */
  getQueueStatus() {
    var nextItem = null;
    if (this.orchestrationQueue.queue.length > 0) {
      var first = this.orchestrationQueue.queue[0];
      nextItem = { targetSystem: first.targetSystem, actionType: first.actionType, priority: first.priority };
    }

    return {
      queueLength: this.orchestrationQueue.queue.length,
      maxDepth: this.orchestrationQueue.maxDepth,
      processing: this.orchestrationQueue.processing,
      deadLetterCount: this.orchestrationQueue.deadLetterQueue.length,
      oldestItem: this.orchestrationQueue.queue.length > 0 ? this.orchestrationQueue.queue[this.orchestrationQueue.queue.length - 1].enqueuedAt : null,
      nextItem: nextItem
    };
  }

  /**
   * Clear the dead letter queue
   */
  clearDeadLetterQueue() {
    var count = this.orchestrationQueue.deadLetterQueue.length;
    this.orchestrationQueue.deadLetterQueue = [];
    this.homey.log('[AIOrchestration] Cleared ' + count + ' items from dead letter queue');
    return count;
  }

  // ─────────────────────────────────────────────
  // CONFLICT SCANNER
  // ─────────────────────────────────────────────

  _startConflictScanner() {
    var self = this;
    var conflictInterval = setInterval(function() {
      self._scanForConflicts();
    }, 45000);

    this.intervals.push(conflictInterval);
  }

  _scanForConflicts() {
    var stateConflicts = [];

    var hvac = this.systems.get('hvac');
    var cooler = this.systems.get('cooler');
    if (hvac && cooler && hvac.status === 'online' && cooler.status === 'online') {
      if (hvac.lastAction === 'heating' && cooler.lastAction === 'cooling') {
        stateConflicts.push({ type: 'heating-vs-cooling', systems: ['hvac', 'cooler'], timestamp: Date.now() });
      }
    }

    var windows = this.systems.get('windows');
    if (hvac && windows && windows.lastAction === 'open' && hvac.status === 'online') {
      stateConflicts.push({ type: 'hvac-with-open-windows', systems: ['hvac', 'windows'], timestamp: Date.now() });
    }

    if (stateConflicts.length > 0) {
      this.homey.log('[AIOrchestration] State conflicts detected: ' + stateConflicts.length);
      this.homey.emit('ai-orchestration:state-conflicts', { conflicts: stateConflicts });
    }
  }

  // ─────────────────────────────────────────────
  // DASHBOARD & DECISION LOG
  // ─────────────────────────────────────────────

  _startDashboardUpdater() {
    var self = this;
    var dashboardInterval = setInterval(function() {
      self._updateDashboardMetrics();
    }, 15000);

    this.intervals.push(dashboardInterval);
  }

  _updateDashboardMetrics() {
    var online = 0;
    for (var sEntry of this.systems) {
      if (sEntry[1].status === 'online') online++;
    }

    var activeScenarios = 0;
    for (var scEntry of this.scenarios) {
      if (scEntry[1].enabled) activeScenarios++;
    }

    this._updateDecisionsToday();

    var totalDecisions = this.decisionLog.length;
    var successDec = 0;
    for (var di = 0; di < totalDecisions; di++) {
      if (this.decisionLog[di].outcome === 'success') successDec++;
    }
    var efficiency = totalDecisions > 0 ? successDec / totalDecisions : 0.95;

    var pendingDiscovered = 0;
    for (var pi = 0; pi < this.discoveredSystems.length; pi++) {
      if (!this.discoveredSystems[pi].autoRegistered) pendingDiscovered++;
    }

    this.dashboardMetrics = {
      systemsOnline: online,
      systemsTotal: this.systems.size,
      scenariosActive: activeScenarios,
      scenariosTotal: this.scenarios.size,
      decisionsToday: this.decisionsToday,
      conflictsResolved: this.conflictsResolved,
      automationEfficiency: parseFloat(efficiency.toFixed(3)),
      eventThroughput: this.performanceMetrics.eventThroughput,
      averageResponseTime: this.performanceMetrics.averageResponseTime,
      errorRate: this.performanceMetrics.errorRate,
      queueDepth: this.orchestrationQueue.queue.length,
      uptime: Date.now() - this.performanceMetrics.uptime,
      loadSheddingActive: this.loadBalancer.sheddingActive,
      anomalyCount: this.mlPatterns.anomalies.length,
      predictionCount: this.mlPatterns.predictions.length,
      discoveredSystems: pendingDiscovered
    };

    this.homey.emit('ai-orchestration:dashboard-update', this.dashboardMetrics);
  }

  _updateDecisionsToday() {
    var today = new Date().toDateString();
    if (this.decisionsTodayDate !== today) {
      this.decisionsToday = 0;
      this.decisionsTodayDate = today;
    }
  }

  _logDecision(decision) {
    decision.timestamp = decision.timestamp || Date.now();
    this.decisionLog.push(decision);
    this.decisionsToday++;

    if (this.decisionLog.length > this.maxDecisionLogSize) {
      this.decisionLog = this.decisionLog.slice(-this.maxDecisionLogSize);
    }

    this.homey.emit('ai-orchestration:decision-logged', decision);
  }

  /**
   * Get recent decisions
   */
  getRecentDecisions(limit) {
    if (!limit) limit = 50;
    return this.decisionLog.slice(-limit).reverse();
  }

  /**
   * Get decision log filtered by system
   */
  getDecisionsBySystem(systemName, limit) {
    if (!limit) limit = 50;
    var filtered = [];
    for (var i = 0; i < this.decisionLog.length; i++) {
      var d = this.decisionLog[i];
      if (d.systems && d.systems.indexOf(systemName) !== -1) {
        filtered.push(d);
      }
    }
    return filtered.slice(-limit).reverse();
  }

  /**
   * Get dashboard metrics
   */
  getDashboardMetrics() {
    this._updateDashboardMetrics();
    return Object.assign({}, this.dashboardMetrics);
  }

  // ─────────────────────────────────────────────
  // STATISTICS & REPORTING
  // ─────────────────────────────────────────────

  /**
   * Get comprehensive statistics
   */
  getStatistics() {
    var systemsArr = [];
    for (var se of this.systems) { systemsArr.push(se[1]); }

    var onlineCount = 0;
    var degradedCount = 0;
    var offlineCount = 0;
    for (var si2 = 0; si2 < systemsArr.length; si2++) {
      if (systemsArr[si2].status === 'online') onlineCount++;
      else if (systemsArr[si2].status === 'degraded') degradedCount++;
      else if (systemsArr[si2].status === 'offline') offlineCount++;
    }

    var categoryStats = [];
    for (var ci2 = 0; ci2 < this.systemCategories.length; ci2++) {
      var cat = this.systemCategories[ci2];
      var catCount = 0;
      for (var si3 = 0; si3 < systemsArr.length; si3++) {
        if (systemsArr[si3].category === cat) catCount++;
      }
      categoryStats.push({ name: cat, count: catCount });
    }

    var scenariosArr = [];
    for (var sce of this.scenarios) { scenariosArr.push(sce[1]); }
    var enabledCount = 0;
    var totalExec = 0;
    for (var sci = 0; sci < scenariosArr.length; sci++) {
      if (scenariosArr[sci].enabled) enabledCount++;
      totalExec += scenariosArr[sci].executionCount;
    }

    var decSuccessCount = 0;
    for (var dli = 0; dli < this.decisionLog.length; dli++) {
      if (this.decisionLog[dli].outcome === 'success') decSuccessCount++;
    }

    var pendDisc = 0;
    for (var dsi = 0; dsi < this.discoveredSystems.length; dsi++) {
      if (!this.discoveredSystems[dsi].autoRegistered) pendDisc++;
    }

    return {
      initialized: this.initialized,
      systems: {
        total: this.systems.size,
        online: onlineCount,
        degraded: degradedCount,
        offline: offlineCount,
        categories: categoryStats
      },
      scenarios: {
        total: this.scenarios.size,
        enabled: enabledCount,
        totalExecutions: totalExec
      },
      decisions: {
        totalLogged: this.decisionLog.length,
        today: this.decisionsToday,
        successRate: this.decisionLog.length > 0 ? decSuccessCount / this.decisionLog.length : 0
      },
      conflicts: {
        resolved: this.conflictsResolved,
        recent: this.activeConflicts.slice(-5)
      },
      performance: {
        eventThroughput: this.performanceMetrics.eventThroughput,
        averageResponseTime: this.performanceMetrics.averageResponseTime,
        errorRate: this.performanceMetrics.errorRate,
        totalErrors: this.performanceMetrics.totalErrors,
        uptime: Date.now() - this.performanceMetrics.uptime
      },
      ml: {
        patterns: {
          timeOfDay: this.mlPatterns.timeOfDay.size,
          dayOfWeek: this.mlPatterns.dayOfWeek.size,
          seasonal: this.mlPatterns.seasonal.size
        },
        anomalies: this.mlPatterns.anomalies.length,
        predictions: this.mlPatterns.predictions.length
      },
      queue: {
        depth: this.orchestrationQueue.queue.length,
        maxDepth: this.orchestrationQueue.maxDepth,
        deadLetterCount: this.orchestrationQueue.deadLetterQueue.length
      },
      loadBalancing: {
        sheddingActive: this.loadBalancer.sheddingActive,
        sheddedSystems: this.loadBalancer.sheddedSystems.size
      },
      discovery: {
        discovered: this.discoveredSystems.length,
        pending: pendDisc,
        suggestions: this.integrationSuggestions.length
      },
      rules: {
        total: this.rulesDatabase.length
      },
      learning: this.getLearningStats()
    };
  }

  /**
   * Get system health report
   */
  getHealthReport() {
    var report = {
      timestamp: Date.now(),
      overall: 'healthy',
      systems: [],
      circuitBreakers: [],
      warnings: [],
      criticalIssues: []
    };

    for (var entry of this.systems) {
      var hName = entry[0];
      var hSys = entry[1];
      var hCb = this.circuitBreakers.get(hName);

      report.systems.push({
        name: hName,
        status: hSys.status,
        uptime: hSys.uptimePercent,
        responseTime: hSys.responseTimeMs,
        errors: hSys.errorCount,
        circuitState: hCb ? hCb.state : 'unknown'
      });

      if (hSys.status === 'degraded') report.warnings.push(hName + ' is degraded');
      if (hSys.status === 'offline') report.criticalIssues.push(hName + ' is offline');
      if (hCb && hCb.state === 'open') report.criticalIssues.push('Circuit breaker open for ' + hName);
      if (hSys.errorCount > 5) report.warnings.push(hName + ' has ' + hSys.errorCount + ' errors');
    }

    if (report.criticalIssues.length > 0) {
      report.overall = 'critical';
    } else if (report.warnings.length > 0) {
      report.overall = 'warning';
    }

    return report;
  }

  // ─────────────────────────────────────────────
  // CLEANUP
  // ─────────────────────────────────────────────

  /**
   * Destroy the orchestration hub, clearing all intervals
   */
  destroy() {
    for (var i = 0; i < this.intervals.length; i++) {
      clearInterval(this.intervals[i]);
    }
    this.intervals = [];
    this.systems.clear();
    this.scenarios.clear();
    this.circuitBreakers.clear();
    this.dependencyGraph.clear();
    this.resourceBudgets.clear();
    this.communicationChannels.clear();
    this.pendingRequests.clear();
    this.orchestrationQueue.queue = [];
    this.orchestrationQueue.deadLetterQueue = [];
    this.decisionLog = [];
    this.learningFeedback = [];
    this.discoveredSystems = [];
    this.integrationSuggestions = [];
    this.initialized = false;
    this.homey.log('[AIOrchestration] destroyed');
  }
}

module.exports = CrossSystemAIOrchestrationHub;
