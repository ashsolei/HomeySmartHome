'use strict';

/**
 * Ambient Intelligence System
 * Proactive and context-aware automation that adapts silently to user needs
 */
class AmbientIntelligenceSystem {
  constructor(homey) {
    this.homey = homey;
    this.contextEngine = null;
    this.ambientRules = new Map();
    this.environmentalFactors = {};
    this.userContext = {};
    this.adaptiveBehaviors = new Map();
    this.ambientActions = [];
  }

  async initialize() {
    this.log('Initializing Ambient Intelligence System...');
    
    // Load ambient rules
    const savedRules = await this.homey.settings.get('ambientRules') || {};
    Object.entries(savedRules).forEach(([id, rule]) => {
      this.ambientRules.set(id, rule);
    });

    // Load adaptive behaviors
    const savedBehaviors = await this.homey.settings.get('adaptiveBehaviors') || {};
    Object.entries(savedBehaviors).forEach(([id, behavior]) => {
      this.adaptiveBehaviors.set(id, behavior);
    });

    // Initialize context engine
    await this.initializeContextEngine();

    // Setup default ambient rules
    await this.setupDefaultAmbientRules();

    // Start ambient monitoring
    await this.startAmbientMonitoring();

    this.log('Ambient Intelligence System initialized');
  }

  /**
   * Initialize context engine
   */
  async initializeContextEngine() {
    this.contextEngine = {
      currentContext: null,
      contextHistory: [],
      contextTransitions: []
    };

    // Start context detection
    await this.detectContext();
  }

  /**
   * Setup default ambient rules
   */
  async setupDefaultAmbientRules() {
    // Ambient lighting adjustment
    await this.createAmbientRule({
      id: 'ambient_lighting',
      name: 'Ambient Lighting',
      description: 'Automatically adjust lighting based on time of day and activity',
      triggers: ['time_change', 'activity_change', 'ambient_light_change'],
      conditions: [
        { type: 'presence', value: 'home' }
      ],
      actions: [
        {
          type: 'lighting_adjustment',
          parameters: {
            subtle: true,
            transitionTime: 30000, // 30 seconds
            adaptToActivity: true
          }
        }
      ],
      enabled: true,
      subtle: true
    });

    // Ambient climate control
    await this.createAmbientRule({
      id: 'ambient_climate',
      name: 'Ambient Climate',
      description: 'Subtle temperature adjustments for comfort',
      triggers: ['temperature_deviation', 'occupancy_change'],
      conditions: [
        { type: 'user_active', value: true }
      ],
      actions: [
        {
          type: 'climate_adjustment',
          parameters: {
            maxChange: 0.5, // Max 0.5°C per adjustment
            gradual: true
          }
        }
      ],
      enabled: true,
      subtle: true
    });

    // Ambient sound environment
    await this.createAmbientRule({
      id: 'ambient_sound',
      name: 'Ambient Sound',
      description: 'Adjust background sounds and music volume',
      triggers: ['activity_change', 'conversation_detected'],
      actions: [
        {
          type: 'volume_adjustment',
          parameters: {
            fadeTime: 5000,
            contextAware: true
          }
        }
      ],
      enabled: true,
      subtle: true
    });

    // Proactive energy saving
    await this.createAmbientRule({
      id: 'ambient_energy',
      name: 'Ambient Energy Saving',
      description: 'Silently reduce energy consumption when possible',
      triggers: ['inactivity_detected', 'high_energy_price'],
      conditions: [
        { type: 'user_away_or_inactive', duration: 1800000 } // 30 min
      ],
      actions: [
        {
          type: 'energy_optimization',
          parameters: {
            aggressive: false,
            preserveComfort: true
          }
        }
      ],
      enabled: true,
      subtle: true
    });
  }

  /**
   * Start ambient monitoring
   */
  async startAmbientMonitoring() {
    // Continuous context monitoring (every 30 seconds)
    this.contextMonitoringInterval = setInterval(async () => {
      await this.detectContext();
      await this.evaluateAmbientRules();
    }, 30000);

    // Environmental monitoring (every minute)
    this.environmentalMonitoringInterval = setInterval(async () => {
      await this.monitorEnvironment();
    }, 60000);

    // Adaptive behavior learning (every hour)
    this.learningInterval = setInterval(async () => {
      await this.learnAdaptiveBehaviors();
    }, 3600000);
  }

  /**
   * Detect current context
   */
  async detectContext() {
    const context = {
      timestamp: Date.now(),
      time: {
        hour: new Date().getHours(),
        dayOfWeek: new Date().getDay(),
        isWeekend: [0, 6].includes(new Date().getDay()),
        timeOfDay: this.getTimeOfDay()
      },
      presence: await this.detectPresence(),
      activity: await this.detectActivity(),
      environment: await this.getEnvironmentalState(),
      devices: await this.getDeviceContext()
    };

    // Detect context transition
    if (this.contextEngine.currentContext) {
      const transition = this.detectContextTransition(
        this.contextEngine.currentContext,
        context
      );
      
      if (transition) {
        this.contextEngine.contextTransitions.push({
          from: this.contextEngine.currentContext,
          to: context,
          transition,
          timestamp: Date.now()
        });

        await this.handleContextTransition(transition, context);
      }
    }

    this.contextEngine.currentContext = context;
    this.contextEngine.contextHistory.push(context);

    // Keep only last 100 contexts
    if (this.contextEngine.contextHistory.length > 100) {
      this.contextEngine.contextHistory.shift();
    }

    return context;
  }

  /**
   * Get time of day classification
   */
  getTimeOfDay() {
    const hour = new Date().getHours();
    
    if (hour >= 5 && hour < 8) return 'early_morning';
    if (hour >= 8 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    if (hour >= 21 && hour < 23) return 'late_evening';
    return 'night';
  }

  /**
   * Detect presence state
   */
  async detectPresence() {
    try {
      const presenceManager = this.homey.app.presenceManager;
      if (!presenceManager) return { status: 'unknown' };

      const status = await presenceManager.getStatus();
      return {
        status: status.status,
        users: status.users || [],
        confidence: status.confidence || 0.5
      };
    } catch {
      return { status: 'unknown', confidence: 0 };
    }
  }

  /**
   * Detect current activity
   */
  async detectActivity() {
    const recentDeviceChanges = await this.getRecentDeviceChanges();
    const activityLevel = this.calculateActivityLevel(recentDeviceChanges);

    let activity = 'idle';
    
    if (activityLevel > 0.7) activity = 'active';
    else if (activityLevel > 0.3) activity = 'moderate';
    else if (activityLevel > 0.1) activity = 'light';

    // Detect specific activities
    const specificActivity = await this.detectSpecificActivity(recentDeviceChanges);

    return {
      level: activity,
      specific: specificActivity,
      score: activityLevel,
      recentChanges: recentDeviceChanges.length
    };
  }

  /**
   * Get recent device changes
   */
  async getRecentDeviceChanges() {
    const fiveMinutesAgo = Date.now() - 300000;
    const deviceHistory = await this.homey.settings.get('deviceStateHistory') || [];
    
    return deviceHistory.filter(d => d.timestamp > fiveMinutesAgo);
  }

  /**
   * Calculate activity level
   */
  calculateActivityLevel(recentChanges) {
    // More device changes = higher activity
    const changeCount = recentChanges.length;
    
    if (changeCount === 0) return 0;
    if (changeCount < 3) return 0.2;
    if (changeCount < 10) return 0.5;
    if (changeCount < 20) return 0.8;
    return 1.0;
  }

  /**
   * Detect specific activity
   */
  async detectSpecificActivity(recentChanges) {
    // Analyze device patterns to detect activities
    const deviceTypes = {};
    
    for (const change of recentChanges) {
      const type = this.categorizeDevice(change.deviceName);
      deviceTypes[type] = (deviceTypes[type] || 0) + 1;
    }

    // Cooking: kitchen devices active
    if (deviceTypes.kitchen && deviceTypes.kitchen > 2) {
      return 'cooking';
    }

    // Entertainment: TV/media devices
    if (deviceTypes.entertainment && deviceTypes.entertainment > 1) {
      return 'entertainment';
    }

    // Cleaning: vacuum, etc.
    if (deviceTypes.cleaning) {
      return 'cleaning';
    }

    // Working: office devices
    if (deviceTypes.office && deviceTypes.office > 2) {
      return 'working';
    }

    // Sleeping: bedroom, lights off
    if (deviceTypes.bedroom && recentChanges.some(c => 
      c.capabilities.onoff === false && c.zone === 'bedroom'
    )) {
      return 'sleeping';
    }

    return 'general';
  }

  /**
   * Categorize device by name/type
   */
  categorizeDevice(deviceName) {
    const name = deviceName.toLowerCase();
    
    if (name.includes('kitchen') || name.includes('oven') || name.includes('stove')) {
      return 'kitchen';
    }
    if (name.includes('tv') || name.includes('media') || name.includes('speaker')) {
      return 'entertainment';
    }
    if (name.includes('vacuum') || name.includes('clean')) {
      return 'cleaning';
    }
    if (name.includes('office') || name.includes('desk') || name.includes('computer')) {
      return 'office';
    }
    if (name.includes('bedroom') || name.includes('bed')) {
      return 'bedroom';
    }
    
    return 'other';
  }

  /**
   * Get environmental state
   */
  async getEnvironmentalState() {
    const environment = {
      temperature: null,
      humidity: null,
      lightLevel: null,
      ambientNoise: null,
      airQuality: null
    };

    try {
      // Get climate data
      const climateManager = this.homey.app.climateManager;
      if (climateManager) {
        const zones = await climateManager.getAllZonesStatus();
        if (zones.length > 0) {
          environment.temperature = zones[0].currentTemp;
          environment.humidity = zones[0].humidity;
        }
      }

      // Get light levels from sensors
      const devices = this.homey.drivers.getDevices();
      for (const device of devices) {
        if (device.hasCapability('measure_luminance')) {
          environment.lightLevel = await device.getCapabilityValue('measure_luminance');
          break;
        }
      }
    } catch (error) {
      this.error('Error getting environmental state:', error);
    }

    return environment;
  }

  /**
   * Get device context
   */
  async getDeviceContext() {
    const devices = this.homey.drivers.getDevices();
    const context = {
      total: devices.length,
      active: 0,
      categories: {}
    };

    for (const device of devices) {
      if (device.hasCapability('onoff')) {
        try {
          const state = await device.getCapabilityValue('onoff');
          if (state) context.active++;
        } catch {
          // Skip
        }
      }
    }

    return context;
  }

  /**
   * Detect context transition
   */
  detectContextTransition(oldContext, newContext) {
    // Presence change
    if (oldContext.presence.status !== newContext.presence.status) {
      return {
        type: 'presence_change',
        from: oldContext.presence.status,
        to: newContext.presence.status
      };
    }

    // Activity change
    if (oldContext.activity.level !== newContext.activity.level) {
      return {
        type: 'activity_change',
        from: oldContext.activity.level,
        to: newContext.activity.level
      };
    }

    // Time of day change
    if (oldContext.time.timeOfDay !== newContext.time.timeOfDay) {
      return {
        type: 'time_of_day_change',
        from: oldContext.time.timeOfDay,
        to: newContext.time.timeOfDay
      };
    }

    // Specific activity change
    if (oldContext.activity.specific !== newContext.activity.specific) {
      return {
        type: 'specific_activity_change',
        from: oldContext.activity.specific,
        to: newContext.activity.specific
      };
    }

    return null;
  }

  /**
   * Handle context transition
   */
  async handleContextTransition(transition, newContext) {
    this.log('Context transition:', transition.type, transition.from, '->', transition.to);

    // Trigger ambient rules based on transition
    for (const [id, rule] of this.ambientRules) {
      if (!rule.enabled) continue;

      if (rule.triggers.includes(transition.type)) {
        await this.executeAmbientRule(rule, newContext, transition);
      }
    }
  }

  /**
   * Monitor environment continuously
   */
  async monitorEnvironment() {
    const environment = await this.getEnvironmentalState();
    this.environmentalFactors = environment;

    // Check for environmental triggers
    await this.checkEnvironmentalTriggers(environment);
  }

  /**
   * Check environmental triggers
   */
  async checkEnvironmentalTriggers(environment) {
    // Temperature deviation
    if (environment.temperature) {
      const userPrefs = this.homey.app.multiUserPreferenceSystem?.preferences;
      if (userPrefs) {
        const activeUser = this.homey.app.multiUserPreferenceSystem.activeUser;
        const prefs = userPrefs.get(activeUser);
        
        if (prefs && prefs.climate) {
          const deviation = Math.abs(
            environment.temperature - prefs.climate.preferredTemperature
          );
          
          if (deviation > 1.5) {
            await this.triggerAmbientAction('temperature_deviation', {
              current: environment.temperature,
              preferred: prefs.climate.preferredTemperature,
              deviation
            });
          }
        }
      }
    }

    // Low light level
    if (environment.lightLevel !== null && environment.lightLevel < 50) {
      await this.triggerAmbientAction('low_light', {
        level: environment.lightLevel
      });
    }
  }

  /**
   * Trigger ambient action
   */
  async triggerAmbientAction(trigger, data) {
    // Find matching ambient rules
    for (const [id, rule] of this.ambientRules) {
      if (!rule.enabled) continue;

      if (rule.triggers.includes(trigger)) {
        const context = this.contextEngine.currentContext;
        await this.executeAmbientRule(rule, context, { type: trigger, data });
      }
    }
  }

  /**
   * Evaluate all ambient rules
   */
  async evaluateAmbientRules() {
    const context = this.contextEngine.currentContext;
    if (!context) return;

    for (const [id, rule] of this.ambientRules) {
      if (!rule.enabled) continue;

      // Check if conditions are met
      const conditionsMet = await this.checkAmbientConditions(rule.conditions, context);
      
      if (conditionsMet) {
        // Check if enough time has passed since last execution
        if (rule.lastExecuted && Date.now() - rule.lastExecuted < 300000) {
          continue; // Wait at least 5 minutes between executions
        }

        await this.executeAmbientRule(rule, context);
      }
    }
  }

  /**
   * Check ambient conditions
   */
  async checkAmbientConditions(conditions, context) {
    if (!conditions || conditions.length === 0) return true;

    for (const condition of conditions) {
      switch (condition.type) {
        case 'presence':
          if (context.presence.status !== condition.value) return false;
          break;

        case 'user_active':
          if (context.activity.level === 'idle' && condition.value) return false;
          break;

        case 'time_range':
          const hour = context.time.hour;
          if (hour < condition.start || hour > condition.end) return false;
          break;

        case 'user_away_or_inactive':
          const isInactive = context.activity.level === 'idle';
          const isAway = context.presence.status === 'away';
          if (!isInactive && !isAway) return false;
          break;
      }
    }

    return true;
  }

  /**
   * Execute ambient rule
   */
  async executeAmbientRule(rule, context, trigger = null) {
    this.log(`Executing ambient rule: ${rule.name}`);

    for (const action of rule.actions) {
      try {
        await this.executeAmbientAction(action, context, rule);
      } catch (error) {
        this.error(`Failed to execute ambient action:`, error);
      }
    }

    rule.lastExecuted = Date.now();
    rule.executionCount = (rule.executionCount || 0) + 1;

    // Record action
    this.ambientActions.push({
      ruleId: rule.id,
      ruleName: rule.name,
      context: context.time.timeOfDay,
      trigger: trigger?.type,
      timestamp: Date.now()
    });

    // Keep only last 100 actions
    if (this.ambientActions.length > 100) {
      this.ambientActions.shift();
    }

    await this.saveAmbientRules();
  }

  /**
   * Execute ambient action
   */
  async executeAmbientAction(action, context, rule) {
    switch (action.type) {
      case 'lighting_adjustment':
        await this.adjustLightingAmbiently(action.parameters, context);
        break;

      case 'climate_adjustment':
        await this.adjustClimateAmbiently(action.parameters, context);
        break;

      case 'volume_adjustment':
        await this.adjustVolumeAmbiently(action.parameters, context);
        break;

      case 'energy_optimization':
        await this.optimizeEnergyAmbiently(action.parameters, context);
        break;

      default:
        this.log(`Unknown ambient action type: ${action.type}`);
    }
  }

  /**
   * Adjust lighting ambiently
   */
  async adjustLightingAmbiently(parameters, context) {
    const devices = this.homey.drivers.getDevices();
    const lights = devices.filter(d => 
      d.hasCapability('onoff') && 
      (d.hasCapability('dim') || d.hasCapability('light_hue'))
    );

    for (const light of lights) {
      try {
        // Skip if light is off and user explicitly turned it off
        const isOn = await light.getCapabilityValue('onoff');
        if (!isOn) continue;

        // Calculate target brightness based on context
        let targetBrightness = 0.7; // Default 70%

        switch (context.time.timeOfDay) {
          case 'early_morning':
            targetBrightness = 0.3;
            break;
          case 'morning':
            targetBrightness = 0.8;
            break;
          case 'afternoon':
            targetBrightness = 0.9;
            break;
          case 'evening':
            targetBrightness = 0.6;
            break;
          case 'late_evening':
            targetBrightness = 0.4;
            break;
          case 'night':
            targetBrightness = 0.2;
            break;
        }

        // Adjust based on activity
        if (context.activity.level === 'active') {
          targetBrightness = Math.min(1.0, targetBrightness + 0.1);
        } else if (context.activity.level === 'light') {
          targetBrightness = Math.max(0.2, targetBrightness - 0.1);
        }

        // Apply subtly if enabled
        if (parameters.subtle) {
          const currentBrightness = await light.getCapabilityValue('dim') || 0.5;
          const diff = targetBrightness - currentBrightness;
          
          // Only adjust if difference is significant
          if (Math.abs(diff) > 0.15) {
            await light.setCapabilityValue('dim', targetBrightness);
            this.log(`Ambient lighting adjusted: ${light.name} -> ${Math.round(targetBrightness * 100)}%`);
          }
        }
      } catch (error) {
        // Skip this light
      }
    }
  }

  /**
   * Adjust climate ambiently
   */
  async adjustClimateAmbiently(parameters, context) {
    try {
      const climateManager = this.homey.app.climateManager;
      if (!climateManager) return;

      const zones = await climateManager.getAllZonesStatus();
      
      for (const zone of zones) {
        const currentTemp = zone.currentTemp;
        const targetTemp = zone.targetTemp;

        // Calculate optimal adjustment
        const deviation = currentTemp - targetTemp;
        
        if (Math.abs(deviation) > 0.5 && Math.abs(deviation) < 3) {
          const adjustment = Math.sign(deviation) * Math.min(
            Math.abs(deviation) * 0.3,
            parameters.maxChange || 0.5
          );
          
          const newTarget = targetTemp - adjustment;
          await climateManager.setZoneTemperature(zone.id, newTarget);
          
          this.log(`Ambient climate adjusted: ${zone.name} -> ${newTarget}°C`);
        }
      }
    } catch (error) {
      this.error('Error adjusting climate:', error);
    }
  }

  /**
   * Adjust volume ambiently
   */
  async adjustVolumeAmbiently(parameters, context) {
    const devices = this.homey.drivers.getDevices();
    const mediaDevices = devices.filter(d => 
      d.hasCapability('volume_set') || d.hasCapability('speaker_playing')
    );

    for (const device of mediaDevices) {
      try {
        const currentVolume = await device.getCapabilityValue('volume_set');
        let targetVolume = currentVolume;

        // Reduce volume if conversation might be happening
        if (context.activity.level === 'active') {
          targetVolume = Math.max(0.3, currentVolume * 0.7);
        }

        if (Math.abs(targetVolume - currentVolume) > 0.1) {
          await device.setCapabilityValue('volume_set', targetVolume);
          this.log(`Ambient volume adjusted: ${device.name}`);
        }
      } catch {
        // Skip
      }
    }
  }

  /**
   * Optimize energy ambiently
   */
  async optimizeEnergyAmbiently(parameters, context) {
    // Turn off devices that aren't needed
    if (context.activity.level === 'idle' && context.presence.status === 'away') {
      const devices = this.homey.drivers.getDevices();
      
      for (const device of devices) {
        if (device.hasCapability('onoff')) {
          try {
            const isOn = await device.getCapabilityValue('onoff');
            
            // Only turn off non-essential devices
            if (isOn && !this.isEssentialDevice(device)) {
              await device.setCapabilityValue('onoff', false);
              this.log(`Ambient energy save: turned off ${device.name}`);
            }
          } catch {
            // Skip
          }
        }
      }
    }
  }

  /**
   * Check if device is essential (shouldn't be turned off)
   */
  isEssentialDevice(device) {
    const name = device.name.toLowerCase();
    const essentialKeywords = ['security', 'alarm', 'camera', 'lock', 'fridge', 'freezer'];
    
    return essentialKeywords.some(keyword => name.includes(keyword));
  }

  /**
   * Learn adaptive behaviors
   */
  async learnAdaptiveBehaviors() {
    this.log('Learning adaptive behaviors...');

    // Analyze context history
    if (this.contextEngine.contextHistory.length < 50) return;

    const patterns = this.identifyBehaviorPatterns();
    
    for (const pattern of patterns) {
      const behaviorId = `adaptive_${pattern.type}_${pattern.timeOfDay}`;
      
      if (!this.adaptiveBehaviors.has(behaviorId)) {
        this.adaptiveBehaviors.set(behaviorId, {
          id: behaviorId,
          pattern,
          confidence: pattern.frequency / this.contextEngine.contextHistory.length,
          created: Date.now(),
          lastReinforced: Date.now()
        });
      }
    }

    await this.saveAdaptiveBehaviors();
  }

  /**
   * Identify behavior patterns
   */
  identifyBehaviorPatterns() {
    // Simplified pattern identification
    return [];
  }

  /**
   * Create ambient rule
   */
  async createAmbientRule(rule) {
    rule.created = rule.created || Date.now();
    rule.executionCount = rule.executionCount || 0;
    rule.lastExecuted = null;

    this.ambientRules.set(rule.id, rule);
    await this.saveAmbientRules();

    return rule;
  }

  /**
   * Get ambient statistics
   */
  getAmbientStatistics() {
    return {
      rules: this.ambientRules.size,
      adaptiveBehaviors: this.adaptiveBehaviors.size,
      recentActions: this.ambientActions.slice(-20),
      currentContext: this.contextEngine.currentContext,
      contextTransitions: this.contextEngine.contextTransitions.slice(-10)
    };
  }

  async saveAmbientRules() {
    const data = {};
    this.ambientRules.forEach((rule, id) => {
      data[id] = rule;
    });
    await this.homey.settings.set('ambientRules', data);
  }

  async saveAdaptiveBehaviors() {
    const data = {};
    this.adaptiveBehaviors.forEach((behavior, id) => {
      data[id] = behavior;
    });
    await this.homey.settings.set('adaptiveBehaviors', data);
  }

  log(...args) {
    console.log('[AmbientIntelligenceSystem]', ...args);
  }

  error(...args) {
    console.error('[AmbientIntelligenceSystem]', ...args);
  }
}

module.exports = AmbientIntelligenceSystem;
