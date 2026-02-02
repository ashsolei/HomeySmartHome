'use strict';

/**
 * Advanced Automation Engine
 * Provides intelligent automation with learning capabilities, predictive actions,
 * and complex condition evaluation
 */
class AdvancedAutomationEngine {
  constructor(homey) {
    this.homey = homey;
    this.automations = new Map();
    this.executionHistory = [];
    this.patterns = new Map();
    this.learningEnabled = true;
    this.predictionAccuracy = new Map();
  }

  async initialize() {
    this.log('Initializing Advanced Automation Engine...');
    
    // Load saved automations
    const saved = await this.homey.settings.get('advancedAutomations') || {};
    Object.entries(saved).forEach(([id, automation]) => {
      this.automations.set(id, automation);
    });

    // Load learning data
    this.executionHistory = await this.homey.settings.get('executionHistory') || [];
    this.patterns = new Map(await this.homey.settings.get('patterns') || []);

    // Start automation engine
    this.startEngine();
    
    this.log('Advanced Automation Engine initialized');
  }

  /**
   * Create a new advanced automation
   */
  async createAutomation(config) {
    const automation = {
      id: config.id || this.generateId(),
      name: config.name,
      enabled: config.enabled !== false,
      priority: config.priority || 5,
      
      // Triggers
      triggers: config.triggers || [],
      
      // Advanced conditions
      conditions: config.conditions || [],
      conditionLogic: config.conditionLogic || 'AND', // AND, OR, CUSTOM
      customLogic: config.customLogic || null,
      
      // Actions
      actions: config.actions || [],
      
      // Advanced features
      learningEnabled: config.learningEnabled !== false,
      adaptiveThresholds: config.adaptiveThresholds || false,
      contextAware: config.contextAware !== false,
      
      // Scheduling
      schedule: config.schedule || null, // cron-like or time-based
      
      // Constraints
      constraints: {
        timeWindow: config.timeWindow || null,
        maxExecutionsPerDay: config.maxExecutionsPerDay || null,
        cooldownMinutes: config.cooldownMinutes || 0,
        requiredScenes: config.requiredScenes || [],
        excludedScenes: config.excludedScenes || []
      },
      
      // Analytics
      statistics: {
        created: Date.now(),
        lastExecuted: null,
        executionCount: 0,
        successCount: 0,
        failureCount: 0,
        averageExecutionTime: 0,
        userOverrides: 0
      }
    };

    this.automations.set(automation.id, automation);
    await this.saveAutomations();
    
    return automation;
  }

  /**
   * Evaluate complex conditions with support for nested logic
   */
  async evaluateConditions(automation, context = {}) {
    const { conditions, conditionLogic, customLogic } = automation;
    
    if (conditions.length === 0) return true;

    // Evaluate each condition
    const results = await Promise.all(
      conditions.map(condition => this.evaluateCondition(condition, context))
    );

    // Apply logic
    if (customLogic) {
      return this.evaluateCustomLogic(customLogic, results);
    }

    return conditionLogic === 'OR' 
      ? results.some(r => r) 
      : results.every(r => r);
  }

  /**
   * Evaluate a single condition with advanced operators
   */
  async evaluateCondition(condition, context) {
    const { type, operator, value, target } = condition;

    try {
      let actualValue;

      switch (type) {
        case 'device':
          actualValue = await this.getDeviceCapabilityValue(target.deviceId, target.capability);
          break;
        case 'time':
          actualValue = new Date().getHours() * 60 + new Date().getMinutes();
          break;
        case 'presence':
          actualValue = await this.getPresenceStatus(target.zone);
          break;
        case 'weather':
          actualValue = await this.getWeatherValue(target.property);
          break;
        case 'energy':
          actualValue = await this.getEnergyConsumption(target.scope);
          break;
        case 'custom':
          actualValue = await this.evaluateCustomCondition(condition, context);
          break;
        default:
          return false;
      }

      return this.compareValues(actualValue, operator, value);
    } catch (error) {
      this.error('Error evaluating condition:', error);
      return false;
    }
  }

  /**
   * Compare values with advanced operators
   */
  compareValues(actual, operator, expected) {
    switch (operator) {
      case 'equals':
      case '==':
        return actual === expected;
      case 'not_equals':
      case '!=':
        return actual !== expected;
      case 'greater_than':
      case '>':
        return actual > expected;
      case 'less_than':
      case '<':
        return actual < expected;
      case 'gte':
      case '>=':
        return actual >= expected;
      case 'lte':
      case '<=':
        return actual <= expected;
      case 'between':
        return actual >= expected.min && actual <= expected.max;
      case 'contains':
        return String(actual).includes(String(expected));
      case 'in':
        return Array.isArray(expected) && expected.includes(actual);
      case 'regex':
        return new RegExp(expected).test(String(actual));
      default:
        return false;
    }
  }

  /**
   * Execute automation with context awareness
   */
  async executeAutomation(automationId, context = {}, reason = 'manual') {
    const automation = this.automations.get(automationId);
    
    if (!automation || !automation.enabled) {
      return { success: false, reason: 'Automation not found or disabled' };
    }

    // Check constraints
    if (!this.checkConstraints(automation)) {
      return { success: false, reason: 'Constraints not met' };
    }

    const startTime = Date.now();
    const result = { success: true, actions: [], errors: [] };

    try {
      // Evaluate conditions
      const conditionsMet = await this.evaluateConditions(automation, context);
      
      if (!conditionsMet) {
        return { success: false, reason: 'Conditions not met' };
      }

      // Execute actions in sequence or parallel
      for (const action of automation.actions) {
        try {
          const actionResult = await this.executeAction(action, context);
          result.actions.push({ action: action.type, success: true, result: actionResult });
        } catch (error) {
          result.errors.push({ action: action.type, error: error.message });
        }
      }

      // Update statistics
      automation.statistics.lastExecuted = Date.now();
      automation.statistics.executionCount++;
      automation.statistics.successCount++;
      automation.statistics.averageExecutionTime = 
        (automation.statistics.averageExecutionTime * (automation.statistics.executionCount - 1) + 
         (Date.now() - startTime)) / automation.statistics.executionCount;

      // Record execution for learning
      this.recordExecution(automationId, context, result, reason);

      await this.saveAutomations();

      return result;
    } catch (error) {
      automation.statistics.failureCount++;
      this.error('Automation execution failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute a single action
   */
  async executeAction(action, context) {
    const { type, target, params } = action;

    switch (type) {
      case 'device_control':
        return await this.controlDevice(target.deviceId, target.capability, params.value);
      
      case 'scene':
        return await this.activateScene(target.sceneId);
      
      case 'notification':
        return await this.sendNotification(params.message, params.priority);
      
      case 'delay':
        await this.delay(params.milliseconds);
        return { delayed: params.milliseconds };
      
      case 'conditional_action':
        const shouldExecute = await this.evaluateCondition(params.condition, context);
        if (shouldExecute) {
          return await this.executeAction(params.action, context);
        }
        return { skipped: true };
      
      case 'loop':
        const results = [];
        for (let i = 0; i < params.iterations; i++) {
          results.push(await this.executeAction(params.action, { ...context, iteration: i }));
        }
        return { iterations: results };
      
      case 'api_call':
        return await this.makeApiCall(params.url, params.method, params.data);
      
      case 'script':
        return await this.executeScript(params.script, context);
      
      default:
        throw new Error(`Unknown action type: ${type}`);
    }
  }

  /**
   * Predictive automation based on learned patterns
   */
  async predictNextAction() {
    const currentContext = await this.getCurrentContext();
    const patterns = await this.findSimilarPatterns(currentContext);
    
    if (patterns.length === 0) return null;

    // Calculate confidence scores
    const predictions = patterns.map(pattern => ({
      automationId: pattern.automationId,
      confidence: this.calculateConfidence(pattern, currentContext),
      context: pattern.context
    }));

    // Sort by confidence
    predictions.sort((a, b) => b.confidence - a.confidence);

    return predictions[0].confidence > 0.7 ? predictions[0] : null;
  }

  /**
   * Learn from user behavior and automation outcomes
   */
  async learnFromExecution(automationId, context, outcome, userOverride = false) {
    if (!this.learningEnabled) return;

    const pattern = {
      timestamp: Date.now(),
      automationId,
      context: {
        timeOfDay: context.timeOfDay || new Date().getHours(),
        dayOfWeek: context.dayOfWeek || new Date().getDay(),
        presence: context.presence,
        weather: context.weather,
        energyState: context.energyState
      },
      outcome,
      userOverride
    };

    // Update patterns
    const patternKey = this.generatePatternKey(pattern.context);
    const existingPatterns = this.patterns.get(patternKey) || [];
    existingPatterns.push(pattern);
    
    // Keep only recent patterns (last 100)
    if (existingPatterns.length > 100) {
      existingPatterns.shift();
    }
    
    this.patterns.set(patternKey, existingPatterns);

    // Update automation learning data
    const automation = this.automations.get(automationId);
    if (automation && userOverride) {
      automation.statistics.userOverrides++;
    }

    await this.savePatterns();
  }

  /**
   * Adaptive threshold adjustment
   */
  async adjustThresholds(automationId) {
    const automation = this.automations.get(automationId);
    if (!automation || !automation.adaptiveThresholds) return;

    const recentExecutions = this.executionHistory
      .filter(e => e.automationId === automationId)
      .slice(-50);

    if (recentExecutions.length < 10) return;

    // Analyze success patterns
    const successfulExecutions = recentExecutions.filter(e => e.outcome.success);
    
    // Adjust thresholds in conditions
    automation.conditions.forEach(condition => {
      if (condition.adaptive && condition.type === 'device') {
        const values = successfulExecutions
          .map(e => e.context[condition.target.deviceId])
          .filter(v => v !== undefined);
        
        if (values.length > 5) {
          const avg = values.reduce((a, b) => a + b, 0) / values.length;
          const stdDev = Math.sqrt(
            values.reduce((sq, n) => sq + Math.pow(n - avg, 2), 0) / values.length
          );
          
          // Adjust threshold
          condition.value = avg + (condition.operator.includes('greater') ? stdDev : -stdDev);
        }
      }
    });

    await this.saveAutomations();
  }

  /**
   * Check automation constraints
   */
  checkConstraints(automation) {
    const { constraints, statistics } = automation;
    const now = Date.now();

    // Cooldown check
    if (constraints.cooldownMinutes > 0 && statistics.lastExecuted) {
      const minutesSinceLastExecution = (now - statistics.lastExecuted) / 60000;
      if (minutesSinceLastExecution < constraints.cooldownMinutes) {
        return false;
      }
    }

    // Time window check
    if (constraints.timeWindow) {
      const currentHour = new Date().getHours();
      const { start, end } = constraints.timeWindow;
      if (currentHour < start || currentHour > end) {
        return false;
      }
    }

    // Max executions per day check
    if (constraints.maxExecutionsPerDay) {
      const today = new Date().setHours(0, 0, 0, 0);
      const todayExecutions = this.executionHistory.filter(
        e => e.automationId === automation.id && e.timestamp >= today
      ).length;
      
      if (todayExecutions >= constraints.maxExecutionsPerDay) {
        return false;
      }
    }

    return true;
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  async getCurrentContext() {
    return {
      timeOfDay: new Date().getHours(),
      dayOfWeek: new Date().getDay(),
      presence: await this.getPresenceStatus(),
      weather: await this.getWeatherValue('temperature'),
      energyState: await this.getEnergyConsumption('total')
    };
  }

  generatePatternKey(context) {
    return `${context.timeOfDay}_${context.dayOfWeek}_${context.presence}`;
  }

  async findSimilarPatterns(context) {
    const key = this.generatePatternKey(context);
    return this.patterns.get(key) || [];
  }

  calculateConfidence(pattern, currentContext) {
    let score = 1.0;
    
    // Time similarity
    const timeDiff = Math.abs(pattern.context.timeOfDay - currentContext.timeOfDay);
    score *= 1 - (timeDiff / 24);
    
    // Day similarity
    if (pattern.context.dayOfWeek === currentContext.dayOfWeek) {
      score *= 1.2;
    }
    
    // Presence match
    if (pattern.context.presence === currentContext.presence) {
      score *= 1.3;
    }
    
    return Math.min(score, 1.0);
  }

  recordExecution(automationId, context, outcome, reason) {
    this.executionHistory.push({
      automationId,
      timestamp: Date.now(),
      context,
      outcome,
      reason
    });

    // Keep only last 1000 executions
    if (this.executionHistory.length > 1000) {
      this.executionHistory.shift();
    }

    this.homey.settings.set('executionHistory', this.executionHistory);
  }

  async controlDevice(deviceId, capability, value) {
    const device = await this.homey.devices.getDevice({ id: deviceId });
    await device.setCapabilityValue(capability, value);
    return { deviceId, capability, value };
  }

  async activateScene(sceneId) {
    return await this.homey.app.sceneManager.activateScene(sceneId);
  }

  async sendNotification(message, priority = 'normal') {
    await this.homey.notifications.createNotification({
      excerpt: message,
      priority
    });
    return { sent: true };
  }

  async getDeviceCapabilityValue(deviceId, capability) {
    const device = await this.homey.devices.getDevice({ id: deviceId });
    return device.getCapabilityValue(capability);
  }

  async getPresenceStatus(zone = null) {
    return await this.homey.app.presenceManager.getStatus(zone);
  }

  async getWeatherValue(property) {
    // Implement weather API integration
    return 20; // Placeholder
  }

  async getEnergyConsumption(scope) {
    return await this.homey.app.energyManager.getCurrentConsumption(scope);
  }

  async makeApiCall(url, method, data) {
    // Implement HTTP request
    return { status: 'not_implemented' };
  }

  async executeScript(script, context) {
    // Safely execute user script
    return { status: 'not_implemented' };
  }

  evaluateCustomLogic(logic, results) {
    // Evaluate custom boolean logic expression
    // Example: "(0 AND 1) OR (2 AND 3)"
    try {
      let expression = logic;
      results.forEach((result, index) => {
        expression = expression.replace(new RegExp(`\\b${index}\\b`, 'g'), result);
      });
      return eval(expression);
    } catch {
      return false;
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  generateId() {
    return `auto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async saveAutomations() {
    const data = {};
    this.automations.forEach((automation, id) => {
      data[id] = automation;
    });
    await this.homey.settings.set('advancedAutomations', data);
  }

  async savePatterns() {
    await this.homey.settings.set('patterns', Array.from(this.patterns.entries()));
  }

  startEngine() {
    // Monitor triggers and execute automations
    this.engineInterval = setInterval(async () => {
      await this.checkAndExecuteAutomations();
    }, 30000); // Check every 30 seconds
  }

  async checkAndExecuteAutomations() {
    const context = await this.getCurrentContext();
    
    for (const [id, automation] of this.automations) {
      if (automation.enabled) {
        const shouldExecute = await this.evaluateConditions(automation, context);
        if (shouldExecute) {
          await this.executeAutomation(id, context, 'automatic');
        }
      }
    }
  }

  log(...args) {
    console.log('[AdvancedAutomationEngine]', ...args);
  }

  error(...args) {
    console.error('[AdvancedAutomationEngine]', ...args);
  }
}

module.exports = AdvancedAutomationEngine;
