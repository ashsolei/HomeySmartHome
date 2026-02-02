'use strict';

const Homey = require('homey');

/**
 * Advanced Automation System
 * Supports complex conditions, multi-step sequences, and adaptive behaviors
 */
class AdvancedAutomationManager {
  constructor(app) {
    this.app = app;
    this.automations = new Map();
    this.sequences = new Map();
    this.contexts = new Map();
    this.runningAutomations = new Set();
  }

  async initialize() {
    this.app.log('Advanced Automation Manager initializing...');
    
    // Load saved automations
    await this.loadAutomations();
    
    // Setup event listeners
    this.setupListeners();
    
    // Start automation engine
    this.startAutomationEngine();
    
    this.app.log('Advanced Automation Manager initialized');
  }

  // ============================================
  // AUTOMATION CREATION
  // ============================================

  async createAutomation(config) {
    const automation = {
      id: config.id || this.generateId(),
      name: config.name,
      description: config.description,
      enabled: config.enabled !== false,
      priority: config.priority || 'normal', // low, normal, high, critical
      
      // Triggers
      triggers: config.triggers || [],
      
      // Conditions (must all be true)
      conditions: config.conditions || [],
      
      // Actions to execute
      actions: config.actions || [],
      
      // Advanced features
      cooldown: config.cooldown || 0, // Seconds before can trigger again
      maxExecutions: config.maxExecutions || null, // Limit executions per day
      adaptiveBehavior: config.adaptiveBehavior || false, // Learn and adjust
      contextAware: config.contextAware || false, // Consider context
      
      // Sequences
      sequences: config.sequences || [], // Multi-step automation
      
      // Analytics
      analytics: {
        created: Date.now(),
        executions: 0,
        lastExecuted: null,
        successRate: 1.0,
        avgDuration: 0
      }
    };
    
    this.automations.set(automation.id, automation);
    await this.saveAutomations();
    
    this.app.log(`Automation created: ${automation.name}`);
    
    return automation;
  }

  // ============================================
  // COMPLEX TRIGGERS
  // ============================================

  async evaluateTriggers(automation, event) {
    for (const trigger of automation.triggers) {
      if (await this.matchesTrigger(trigger, event)) {
        return true;
      }
    }
    return false;
  }

  async matchesTrigger(trigger, event) {
    switch (trigger.type) {
      case 'time':
        return this.matchesTimeTrigger(trigger, event);
      
      case 'device':
        return this.matchesDeviceTrigger(trigger, event);
      
      case 'scene':
        return this.matchesSceneTrigger(trigger, event);
      
      case 'presence':
        return this.matchesPresenceTrigger(trigger, event);
      
      case 'energy':
        return this.matchesEnergyTrigger(trigger, event);
      
      case 'weather':
        return this.matchesWeatherTrigger(trigger, event);
      
      case 'composite':
        return this.matchesCompositeTrigger(trigger, event);
      
      case 'predictive':
        return this.matchesPredictiveTrigger(trigger, event);
      
      default:
        return false;
    }
  }

  matchesTimeTrigger(trigger, event) {
    if (event.type !== 'time') return false;
    
    const now = new Date();
    
    // Specific time
    if (trigger.time) {
      const [hours, minutes] = trigger.time.split(':').map(Number);
      return now.getHours() === hours && now.getMinutes() === minutes;
    }
    
    // Time range
    if (trigger.after && trigger.before) {
      const currentTime = now.getHours() * 60 + now.getMinutes();
      const [afterH, afterM] = trigger.after.split(':').map(Number);
      const [beforeH, beforeM] = trigger.before.split(':').map(Number);
      const afterTime = afterH * 60 + afterM;
      const beforeTime = beforeH * 60 + beforeM;
      
      return currentTime >= afterTime && currentTime <= beforeTime;
    }
    
    // Sunrise/sunset
    if (trigger.sunEvent) {
      return event.sunEvent === trigger.sunEvent;
    }
    
    return false;
  }

  matchesDeviceTrigger(trigger, event) {
    if (event.type !== 'device') return false;
    
    if (trigger.deviceId && event.deviceId !== trigger.deviceId) {
      return false;
    }
    
    if (trigger.capability) {
      const value = event.capability?.[trigger.capability];
      
      if (trigger.operator === 'equals') {
        return value === trigger.value;
      } else if (trigger.operator === 'greater') {
        return value > trigger.value;
      } else if (trigger.operator === 'less') {
        return value < trigger.value;
      } else if (trigger.operator === 'changed') {
        return event.changed === trigger.capability;
      }
    }
    
    return false;
  }

  matchesCompositeTrigger(trigger, event) {
    // Trigger requires multiple conditions
    const subTriggers = trigger.triggers || [];
    const operator = trigger.operator || 'AND';
    
    if (operator === 'AND') {
      return subTriggers.every(t => this.matchesTrigger(t, event));
    } else if (operator === 'OR') {
      return subTriggers.some(t => this.matchesTrigger(t, event));
    }
    
    return false;
  }

  async matchesPredictiveTrigger(trigger, event) {
    // Uses AI predictions
    if (!this.app.intelligenceEngine) return false;
    
    const predictions = await this.app.intelligenceEngine.generatePredictions();
    
    return predictions.some(p => 
      p.type === trigger.predictionType && 
      p.confidence >= trigger.minConfidence
    );
  }

  // ============================================
  // ADVANCED CONDITIONS
  // ============================================

  async evaluateConditions(automation) {
    for (const condition of automation.conditions) {
      if (!await this.matchesCondition(condition)) {
        return false;
      }
    }
    return true;
  }

  async matchesCondition(condition) {
    switch (condition.type) {
      case 'time':
        return this.matchesTimeCondition(condition);
      
      case 'presence':
        return await this.matchesPresenceCondition(condition);
      
      case 'device':
        return await this.matchesDeviceCondition(condition);
      
      case 'weather':
        return await this.matchesWeatherCondition(condition);
      
      case 'energy':
        return await this.matchesEnergyCondition(condition);
      
      case 'context':
        return await this.matchesContextCondition(condition);
      
      case 'custom':
        return await this.evaluateCustomCondition(condition);
      
      default:
        return true;
    }
  }

  matchesTimeCondition(condition) {
    const now = new Date();
    
    // Day of week
    if (condition.days) {
      const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      const today = dayNames[now.getDay()];
      if (!condition.days.includes(today)) {
        return false;
      }
    }
    
    // Time range
    if (condition.after || condition.before) {
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      
      if (condition.after) {
        const [h, m] = condition.after.split(':').map(Number);
        const afterMinutes = h * 60 + m;
        if (currentMinutes < afterMinutes) return false;
      }
      
      if (condition.before) {
        const [h, m] = condition.before.split(':').map(Number);
        const beforeMinutes = h * 60 + m;
        if (currentMinutes > beforeMinutes) return false;
      }
    }
    
    return true;
  }

  async matchesPresenceCondition(condition) {
    // Check if anyone is home
    if (condition.anyoneHome !== undefined) {
      const presence = await this.getPresenceStatus();
      return presence.anyoneHome === condition.anyoneHome;
    }
    
    // Check specific person
    if (condition.person) {
      const presence = await this.getPresenceStatus();
      return presence.people[condition.person]?.present === condition.present;
    }
    
    return true;
  }

  async matchesDeviceCondition(condition) {
    const devices = await this.app.homey.devices.getDevices();
    const device = devices[condition.deviceId];
    
    if (!device) return false;
    
    const value = device.capabilitiesObj?.[condition.capability]?.value;
    
    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'not_equals':
        return value !== condition.value;
      case 'greater':
        return value > condition.value;
      case 'less':
        return value < condition.value;
      case 'between':
        return value >= condition.min && value <= condition.max;
      default:
        return false;
    }
  }

  async matchesContextCondition(condition) {
    const context = await this.getCurrentContext();
    
    // Match context mode (home, away, sleep, party, etc.)
    if (condition.mode) {
      return context.mode === condition.mode;
    }
    
    // Match activity
    if (condition.activity) {
      return context.activity === condition.activity;
    }
    
    return true;
  }

  async evaluateCustomCondition(condition) {
    // Evaluate custom JavaScript expression
    try {
      const context = await this.buildConditionContext();
      const fn = new Function(...Object.keys(context), `return ${condition.expression}`);
      return fn(...Object.values(context));
    } catch (error) {
      this.app.error('Custom condition error:', error);
      return false;
    }
  }

  // ============================================
  // ADVANCED ACTIONS
  // ============================================

  async executeActions(automation) {
    const startTime = Date.now();
    let success = true;
    
    try {
      for (const action of automation.actions) {
        await this.executeAction(action, automation);
        
        // Delay between actions if specified
        if (action.delay) {
          await this.sleep(action.delay);
        }
      }
      
      // Execute sequences if defined
      if (automation.sequences && automation.sequences.length > 0) {
        await this.executeSequences(automation.sequences);
      }
      
    } catch (error) {
      this.app.error(`Automation ${automation.name} failed:`, error);
      success = false;
    }
    
    // Update analytics
    automation.analytics.executions++;
    automation.analytics.lastExecuted = Date.now();
    automation.analytics.avgDuration = 
      (automation.analytics.avgDuration * (automation.analytics.executions - 1) + 
       (Date.now() - startTime)) / automation.analytics.executions;
    automation.analytics.successRate = 
      (automation.analytics.successRate * (automation.analytics.executions - 1) + 
       (success ? 1 : 0)) / automation.analytics.executions;
    
    await this.saveAutomations();
    
    return success;
  }

  async executeAction(action, automation) {
    switch (action.type) {
      case 'device':
        return await this.executeDeviceAction(action);
      
      case 'scene':
        return await this.executeSceneAction(action);
      
      case 'notification':
        return await this.executeNotificationAction(action);
      
      case 'wait':
        return await this.sleep(action.duration);
      
      case 'condition':
        return await this.executeConditionalAction(action);
      
      case 'loop':
        return await this.executeLoopAction(action);
      
      case 'api':
        return await this.executeApiAction(action);
      
      case 'script':
        return await this.executeScriptAction(action);
      
      case 'adaptive':
        return await this.executeAdaptiveAction(action, automation);
      
      default:
        this.app.log(`Unknown action type: ${action.type}`);
    }
  }

  async executeDeviceAction(action) {
    const device = await this.app.homey.devices.getDevice({ id: action.deviceId });
    
    if (action.capability && action.value !== undefined) {
      await device.setCapabilityValue(action.capability, action.value);
    }
    
    // Gradual change (e.g., fade lights)
    if (action.gradual && action.duration) {
      await this.executeGradualChange(device, action);
    }
  }

  async executeGradualChange(device, action) {
    const startValue = device.capabilitiesObj[action.capability]?.value || 0;
    const endValue = action.value;
    const duration = action.duration; // milliseconds
    const steps = 20;
    const stepDuration = duration / steps;
    const stepSize = (endValue - startValue) / steps;
    
    for (let i = 1; i <= steps; i++) {
      const value = startValue + (stepSize * i);
      await device.setCapabilityValue(action.capability, value);
      await this.sleep(stepDuration);
    }
  }

  async executeConditionalAction(action) {
    const conditionMet = await this.matchesCondition(action.condition);
    
    if (conditionMet) {
      for (const subAction of action.then || []) {
        await this.executeAction(subAction);
      }
    } else {
      for (const subAction of action.else || []) {
        await this.executeAction(subAction);
      }
    }
  }

  async executeLoopAction(action) {
    const iterations = action.iterations || 1;
    
    for (let i = 0; i < iterations; i++) {
      for (const subAction of action.actions || []) {
        await this.executeAction(subAction);
      }
      
      if (i < iterations - 1 && action.loopDelay) {
        await this.sleep(action.loopDelay);
      }
    }
  }

  async executeAdaptiveAction(action, automation) {
    // Use AI to determine best action based on context
    if (!this.app.intelligenceEngine) {
      return await this.executeAction(action.fallback);
    }
    
    const recommendations = await this.app.intelligenceEngine.generateRecommendations();
    const relevant = recommendations.find(r => r.type === action.adaptiveType);
    
    if (relevant && relevant.confidence > 0.7) {
      // Execute AI-recommended action
      return await this.executeAction(relevant.action);
    } else {
      // Fall back to default
      return await this.executeAction(action.fallback);
    }
  }

  // ============================================
  // SEQUENCES (Multi-step automations)
  // ============================================

  async executeSequences(sequences) {
    for (const sequence of sequences) {
      await this.executeSequence(sequence);
    }
  }

  async executeSequence(sequence) {
    this.app.log(`Executing sequence: ${sequence.name}`);
    
    for (const step of sequence.steps || []) {
      // Check step conditions
      if (step.conditions && !(await this.evaluateConditions({ conditions: step.conditions }))) {
        this.app.log(`Skipping step ${step.name} - conditions not met`);
        continue;
      }
      
      // Execute step actions
      for (const action of step.actions || []) {
        await this.executeAction(action);
      }
      
      // Wait between steps
      if (step.wait) {
        await this.sleep(step.wait);
      }
      
      // Abort if condition met
      if (step.abortIf && await this.matchesCondition(step.abortIf)) {
        this.app.log(`Aborting sequence ${sequence.name} at step ${step.name}`);
        break;
      }
    }
  }

  // ============================================
  // AUTOMATION ENGINE
  // ============================================

  startAutomationEngine() {
    // Time-based automation checker
    setInterval(() => {
      this.checkTimeBasedAutomations();
    }, 60 * 1000); // Every minute
    
    // Device event listener
    this.app.homey.devices.on('device.update', async (device) => {
      await this.handleDeviceEvent(device);
    });
    
    // Context-aware automation checker
    setInterval(() => {
      this.checkContextBasedAutomations();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  async checkTimeBasedAutomations() {
    const timeEvent = { type: 'time', timestamp: Date.now() };
    
    for (const automation of this.automations.values()) {
      if (!automation.enabled) continue;
      
      if (await this.shouldTriggerAutomation(automation, timeEvent)) {
        await this.triggerAutomation(automation, timeEvent);
      }
    }
  }

  async handleDeviceEvent(device) {
    const deviceEvent = {
      type: 'device',
      deviceId: device.id,
      capability: device.capabilitiesObj,
      timestamp: Date.now()
    };
    
    for (const automation of this.automations.values()) {
      if (!automation.enabled) continue;
      
      if (await this.shouldTriggerAutomation(automation, deviceEvent)) {
        await this.triggerAutomation(automation, deviceEvent);
      }
    }
  }

  async checkContextBasedAutomations() {
    const context = await this.getCurrentContext();
    const contextEvent = { type: 'context', context, timestamp: Date.now() };
    
    for (const automation of this.automations.values()) {
      if (!automation.enabled || !automation.contextAware) continue;
      
      if (await this.shouldTriggerAutomation(automation, contextEvent)) {
        await this.triggerAutomation(automation, contextEvent);
      }
    }
  }

  async shouldTriggerAutomation(automation, event) {
    // Check cooldown
    if (automation.cooldown > 0 && automation.analytics.lastExecuted) {
      const timeSinceLastExecution = Date.now() - automation.analytics.lastExecuted;
      if (timeSinceLastExecution < automation.cooldown * 1000) {
        return false;
      }
    }
    
    // Check max executions
    if (automation.maxExecutions) {
      const today = new Date().setHours(0, 0, 0, 0);
      const lastExecDate = new Date(automation.analytics.lastExecuted || 0).setHours(0, 0, 0, 0);
      
      if (lastExecDate === today && automation.analytics.executions >= automation.maxExecutions) {
        return false;
      }
    }
    
    // Check if already running
    if (this.runningAutomations.has(automation.id)) {
      return false;
    }
    
    // Evaluate triggers and conditions
    const triggersMatch = await this.evaluateTriggers(automation, event);
    const conditionsMatch = await this.evaluateConditions(automation);
    
    return triggersMatch && conditionsMatch;
  }

  async triggerAutomation(automation, event) {
    this.app.log(`Triggering automation: ${automation.name}`);
    
    this.runningAutomations.add(automation.id);
    
    try {
      await this.executeActions(automation);
      
      // Adaptive learning
      if (automation.adaptiveBehavior && this.app.intelligenceEngine) {
        await this.app.intelligenceEngine.recordAutomationExecution(automation, event);
      }
      
    } finally {
      this.runningAutomations.delete(automation.id);
    }
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  async loadAutomations() {
    try {
      const saved = await this.app.homey.settings.get('advancedAutomations');
      if (saved) {
        for (const auto of saved) {
          this.automations.set(auto.id, auto);
        }
      } else {
        // Load default automations
        await this.createDefaultAutomations();
      }
    } catch (error) {
      this.app.error('Error loading automations:', error);
    }
  }

  async saveAutomations() {
    try {
      const automations = Array.from(this.automations.values());
      await this.app.homey.settings.set('advancedAutomations', automations);
    } catch (error) {
      this.app.error('Error saving automations:', error);
    }
  }

  async createDefaultAutomations() {
    // Intelligent morning routine
    await this.createAutomation({
      name: 'Intelligent Morning Routine',
      description: 'Adaptiv morgonrutin baserad på dina vanor',
      triggers: [
        { type: 'time', time: '06:30' },
        { type: 'predictive', predictionType: 'wake_up', minConfidence: 0.7 }
      ],
      conditions: [
        { type: 'time', days: ['mon', 'tue', 'wed', 'thu', 'fri'] },
        { type: 'presence', anyoneHome: true }
      ],
      sequences: [
        {
          name: 'Gradual Wake Up',
          steps: [
            {
              name: 'Start bedroom lights',
              actions: [
                { type: 'device', deviceId: 'bedroom-lights', capability: 'dim', value: 0.1, gradual: true, duration: 300000 }
              ]
            },
            {
              name: 'Increase brightness',
              wait: 300000,
              actions: [
                { type: 'device', deviceId: 'bedroom-lights', capability: 'dim', value: 0.5, gradual: true, duration: 300000 }
              ]
            },
            {
              name: 'Kitchen lights',
              wait: 300000,
              actions: [
                { type: 'device', deviceId: 'kitchen-lights', capability: 'onoff', value: true }
              ]
            }
          ]
        }
      ],
      adaptiveBehavior: true,
      contextAware: true
    });

    // Smart energy saver
    await this.createAutomation({
      name: 'Smart Energy Saver',
      description: 'Intelligent energibesparing baserad på användningsmönster',
      triggers: [
        { type: 'energy', threshold: 2000, operator: 'greater' }
      ],
      conditions: [
        { type: 'presence', anyoneHome: false }
      ],
      actions: [
        {
          type: 'adaptive',
          adaptiveType: 'energy',
          fallback: { type: 'notification', message: 'Hög energiförbrukning detekterad' }
        }
      ],
      adaptiveBehavior: true,
      cooldown: 3600
    });

    // Context-aware lighting
    await this.createAutomation({
      name: 'Context-Aware Lighting',
      description: 'Anpassar belysning baserat på aktivitet och tid',
      triggers: [
        { type: 'presence', event: 'room_entered' }
      ],
      actions: [
        {
          type: 'condition',
          condition: { type: 'context', activity: 'movie' },
          then: [
            { type: 'device', deviceId: 'living-room-lights', capability: 'dim', value: 0.2 }
          ],
          else: [
            {
              type: 'condition',
              condition: { type: 'time', after: '18:00', before: '23:00' },
              then: [
                { type: 'device', deviceId: 'living-room-lights', capability: 'dim', value: 0.7 }
              ],
              else: [
                { type: 'device', deviceId: 'living-room-lights', capability: 'onoff', value: true }
              ]
            }
          ]
        }
      ],
      contextAware: true
    });
  }

  async getCurrentContext() {
    // Build current context from various sources
    return {
      mode: await this.app.homey.settings.get('contextMode') || 'home',
      activity: await this.app.homey.settings.get('currentActivity') || 'normal',
      securityMode: await this.app.homey.settings.get('securityMode') || 'disarmed',
      presence: await this.getPresenceStatus()
    };
  }

  async getPresenceStatus() {
    // Simplified presence status
    return {
      anyoneHome: true,
      people: {}
    };
  }

  async buildConditionContext() {
    const devices = await this.app.homey.devices.getDevices();
    const zones = await this.app.homey.zones.getZones();
    
    return {
      devices,
      zones,
      time: new Date(),
      context: await this.getCurrentContext()
    };
  }

  generateId() {
    return `auto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  setupListeners() {
    // Additional event listeners can be added here
  }
}

module.exports = AdvancedAutomationManager;
