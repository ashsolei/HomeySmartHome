'use strict';

/**
 * Scene Learning System
 * Automatically learns and creates scenes based on user behavior patterns
 * Uses ML to identify repeating device state combinations
 */
class SceneLearningSystem {
  constructor(homey) {
    this.homey = homey;
    this.deviceStateHistory = [];
    this.learnedScenes = new Map();
    this.candidateScenes = new Map();
    this.sceneExecutions = new Map();
  }

  async initialize() {
    try {
      this.log('Initializing Scene Learning System...');

      // Load learned scenes
      const saved = await this.homey.settings.get('learnedScenes') || {};
      Object.entries(saved).forEach(([id, scene]) => {
        this.learnedScenes.set(id, scene);
      });

      // Load device state history
      this.deviceStateHistory = await this.homey.settings.get('deviceStateHistory') || [];

      // Start monitoring
      await this.startMonitoring();

      this.log('Scene Learning System initialized');
    } catch (error) {
      console.error(`[SceneLearningSystem] Failed to initialize:`, error.message);
    }
  }

  /**
   * Start monitoring device states
   */
  async startMonitoring() {
    // Monitor device capability changes
    this.homey.devices.on('device.update', async (device) => {
      await this.recordDeviceState(device);
    });

    // Analyze patterns periodically
    this.analysisInterval = setInterval(async () => {
      await this.analyzePatterns();
    }, 3600000); // Every hour

    // Daily deep analysis
    this.deepAnalysisInterval = setInterval(async () => {
      await this.performDeepAnalysis();
    }, 86400000); // Every day
  }

  /**
   * Record device state change
   */
  async recordDeviceState(device) {
    const state = {
      deviceId: device.id,
      deviceName: device.name,
      capabilities: {},
      zone: device.zone?.name,
      timestamp: Date.now(),
      hour: new Date().getHours(),
      dayOfWeek: new Date().getDay()
    };

    // Record all capability values
    for (const capability of device.capabilities) {
      try {
        state.capabilities[capability] = await device.getCapabilityValue(capability);
      } catch (_error) {
        // Capability might not be readable
      }
    }

    this.deviceStateHistory.push(state);

    // Keep only last 5000 records
    if (this.deviceStateHistory.length > 5000) {
      this.deviceStateHistory.shift();
    }

    // Check if this could be part of a pattern
    await this.checkForPattern();
    
    await this.saveDeviceStateHistory();
  }

  /**
   * Check for immediate patterns (multiple devices changed quickly)
   */
  async checkForPattern() {
    const recentWindow = 60000; // 1 minute
    const now = Date.now();
    
    // Get recent state changes
    const recentChanges = this.deviceStateHistory.filter(
      state => now - state.timestamp < recentWindow
    );

    if (recentChanges.length >= 3) {
      // Multiple devices changed - potential scene
      const patternKey = this.generatePatternKey(recentChanges);
      
      if (!this.candidateScenes.has(patternKey)) {
        this.candidateScenes.set(patternKey, {
          changes: recentChanges,
          firstSeen: now,
          occurrences: 1,
          timestamps: [now],
          context: {
            hour: new Date().getHours(),
            dayOfWeek: new Date().getDay(),
            presence: await this.getPresenceStatus()
          }
        });
      } else {
        const candidate = this.candidateScenes.get(patternKey);
        candidate.occurrences++;
        candidate.timestamps.push(now);
      }
    }
  }

  /**
   * Analyze patterns to identify potential scenes
   */
  async analyzePatterns() {
    this.log('Analyzing patterns for scene learning...');

    // Check candidate scenes
    for (const [key, candidate] of this.candidateScenes) {
      // If pattern has occurred 5+ times, consider it a scene
      if (candidate.occurrences >= 5) {
        await this.createLearnedScene(candidate);
        this.candidateScenes.delete(key);
      }
    }

    // Clean up old candidates (not seen in 7 days)
    const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    for (const [key, candidate] of this.candidateScenes) {
      if (candidate.firstSeen < weekAgo) {
        this.candidateScenes.delete(key);
      }
    }
  }

  /**
   * Perform deep analysis to find complex patterns
   */
  async performDeepAnalysis() {
    this.log('Performing deep pattern analysis...');

    // Group states by time windows
    const timeWindows = this.groupByTimeWindows(this.deviceStateHistory);

    // Find repeating patterns in each time window
    for (const [window, states] of Object.entries(timeWindows)) {
      const patterns = this.findRepeatingPatterns(states);
      
      for (const pattern of patterns) {
        if (pattern.frequency >= 5) {
          await this.createLearnedScene({
            changes: pattern.states,
            occurrences: pattern.frequency,
            timestamps: pattern.timestamps,
            context: {
              hour: parseInt(window),
              confidence: pattern.confidence
            }
          });
        }
      }
    }

    // Identify scene sequences
    await this.identifySceneSequences();

    // Optimize existing learned scenes
    await this.optimizeLearnedScenes();
  }

  /**
   * Create a learned scene from pattern
   */
  async createLearnedScene(candidate) {
    const sceneId = this.generateSceneId();
    
    // Extract device actions
    const actions = this.extractActions(candidate.changes);
    
    // Generate scene name
    const name = await this.generateSceneName(actions, candidate.context);
    
    // Calculate confidence score
    const confidence = this.calculateConfidence(candidate);

    const scene = {
      id: sceneId,
      name,
      actions,
      learned: true,
      confidence,
      statistics: {
        occurrences: candidate.occurrences,
        firstSeen: candidate.firstSeen,
        lastSeen: candidate.timestamps[candidate.timestamps.length - 1],
        executionCount: 0,
        userApprovals: 0,
        userRejections: 0
      },
      context: candidate.context,
      status: 'suggested', // suggested, approved, active, rejected
      created: Date.now()
    };

    this.learnedScenes.set(sceneId, scene);
    await this.saveLearnedScenes();

    // Notify user about new learned scene
    await this.notifyNewLearnedScene(scene);

    return scene;
  }

  /**
   * Extract actions from device state changes
   */
  extractActions(changes) {
    const actions = [];
    const deviceStates = new Map();

    // Group by device
    for (const change of changes) {
      if (!deviceStates.has(change.deviceId)) {
        deviceStates.set(change.deviceId, {
          deviceId: change.deviceId,
          deviceName: change.deviceName,
          zone: change.zone,
          capabilities: {}
        });
      }
      
      const device = deviceStates.get(change.deviceId);
      Object.assign(device.capabilities, change.capabilities);
    }

    // Convert to actions
    for (const [deviceId, device] of deviceStates) {
      for (const [capability, value] of Object.entries(device.capabilities)) {
        actions.push({
          type: 'device_control',
          target: {
            deviceId,
            deviceName: device.deviceName,
            capability
          },
          params: { value },
          zone: device.zone
        });
      }
    }

    return actions;
  }

  /**
   * Generate intelligent scene name
   */
  async generateSceneName(actions, context) {
    const hour = context.hour;
    const _devices = new Set(actions.map(a => a.target.deviceName));
    const zones = new Set(actions.map(a => a.zone).filter(Boolean));

    // Determine time of day
    let timeOfDay;
    if (hour >= 6 && hour < 12) timeOfDay = 'Morgon';
    else if (hour >= 12 && hour < 17) timeOfDay = 'Eftermiddag';
    else if (hour >= 17 && hour < 22) timeOfDay = 'Kväll';
    else timeOfDay = 'Natt';

    // Analyze action types
    const lightsCount = actions.filter(a => 
      a.target.capability === 'onoff' && 
      (a.target.deviceName.toLowerCase().includes('lamp') || 
       a.target.deviceName.toLowerCase().includes('ljus'))
    ).length;

    const heatingCount = actions.filter(a => 
      a.target.capability === 'target_temperature'
    ).length;

    // Generate descriptive name
    let name;
    
    if (lightsCount > 2) {
      name = `${timeOfDay} Belysning`;
    } else if (heatingCount > 0) {
      name = `${timeOfDay} Klimat`;
    } else if (zones.size === 1) {
      name = `${timeOfDay} ${Array.from(zones)[0]}`;
    } else {
      name = `${timeOfDay} Rutin`;
    }

    // Make unique if needed
    let counter = 1;
    let uniqueName = name;
    while (this.sceneNameExists(uniqueName)) {
      uniqueName = `${name} ${counter}`;
      counter++;
    }

    return {
      sv: uniqueName,
      en: uniqueName // Could add translation logic
    };
  }

  /**
   * Calculate confidence score for learned scene
   */
  calculateConfidence(candidate) {
    let confidence = 0;

    // Frequency (max 40 points)
    confidence += Math.min(candidate.occurrences * 4, 40);

    // Consistency in timing (max 30 points)
    const timeConsistency = this.calculateTimeConsistency(candidate.timestamps);
    confidence += timeConsistency * 30;

    // Number of devices involved (max 20 points)
    const deviceCount = new Set(candidate.changes.map(c => c.deviceId)).size;
    confidence += Math.min(deviceCount * 5, 20);

    // Recency (max 10 points)
    const daysSinceLastSeen = (Date.now() - candidate.timestamps[candidate.timestamps.length - 1]) / (24 * 60 * 60 * 1000);
    confidence += Math.max(10 - daysSinceLastSeen, 0);

    return Math.round(confidence);
  }

  /**
   * Calculate time consistency (how regular the pattern occurs)
   */
  calculateTimeConsistency(timestamps) {
    if (timestamps.length < 2) return 0;

    const hours = timestamps.map(ts => new Date(ts).getHours());
    const avgHour = hours.reduce((a, b) => a + b, 0) / hours.length;
    
    // Calculate standard deviation
    const variance = hours.reduce((sum, hour) => {
      const diff = hour - avgHour;
      return sum + diff * diff;
    }, 0) / hours.length;
    
    const stdDev = Math.sqrt(variance);

    // Lower standard deviation = higher consistency
    return Math.max(0, 1 - (stdDev / 12)); // Normalize to 0-1
  }

  /**
   * Identify scene sequences (scenes that often follow each other)
   */
  async identifySceneSequences() {
    const sequences = new Map();

    // Analyze scene executions
    const executions = Array.from(this.sceneExecutions.values());
    
    for (let i = 1; i < executions.length; i++) {
      const prev = executions[i - 1];
      const curr = executions[i];
      
      // If scenes executed within 30 minutes
      if (curr.timestamp - prev.timestamp < 1800000) {
        const key = `${prev.sceneId}->${curr.sceneId}`;
        sequences.set(key, (sequences.get(key) || 0) + 1);
      }
    }

    // Identify strong sequences
    for (const [sequence, count] of sequences) {
      if (count >= 5) {
        this.log(`Identified scene sequence: ${sequence} (${count} times)`);
        // Could create composite scenes or suggestions
      }
    }
  }

  /**
   * Optimize existing learned scenes
   */
  async optimizeLearnedScenes() {
    for (const [_id, scene] of this.learnedScenes) {
      // Remove actions that are consistently reversed
      scene.actions = await this.removeReversedActions(scene);

      // Merge similar actions
      scene.actions = this.mergeSimilarActions(scene.actions);

      // Update confidence based on user feedback
      if (scene.statistics.userApprovals > 0 || scene.statistics.userRejections > 0) {
        const approval = scene.statistics.userApprovals;
        const total = scene.statistics.userApprovals + scene.statistics.userRejections;
        const userScore = (approval / total) * 100;
        
        // Blend with original confidence
        scene.confidence = (scene.confidence * 0.5) + (userScore * 0.5);
      }
    }

    await this.saveLearnedScenes();
  }

  /**
   * Remove actions that are consistently reversed shortly after
   */
  async removeReversedActions(scene) {
    // Implementation would check if actions are frequently undone
    return scene.actions;
  }

  /**
   * Merge similar actions on same device
   */
  mergeSimilarActions(actions) {
    const merged = new Map();

    for (const action of actions) {
      const key = `${action.target.deviceId}_${action.target.capability}`;
      merged.set(key, action); // Later actions override earlier ones
    }

    return Array.from(merged.values());
  }

  /**
   * User approves learned scene
   */
  async approveLearnedScene(sceneId) {
    const scene = this.learnedScenes.get(sceneId);
    if (!scene) return;

    scene.status = 'approved';
    scene.statistics.userApprovals++;

    // Add to main scene manager
    await this.homey.app.sceneManager.createScene({
      id: scene.id,
      name: scene.name,
      actions: scene.actions,
      learned: true
    });

    await this.saveLearnedScenes();

    return { success: true, scene };
  }

  /**
   * User rejects learned scene
   */
  async rejectLearnedScene(sceneId, reason = null) {
    const scene = this.learnedScenes.get(sceneId);
    if (!scene) return;

    scene.status = 'rejected';
    scene.statistics.userRejections++;
    scene.rejectionReason = reason;

    // Learn from rejection
    if (reason) {
      await this.learnFromRejection(scene, reason);
    }

    await this.saveLearnedScenes();

    return { success: true };
  }

  /**
   * Learn from user's scene rejection
   */
  async learnFromRejection(scene, reason) {
    // Adjust learning parameters based on rejection reason
    if (reason === 'too_frequent') {
      // Increase occurrence threshold
    } else if (reason === 'wrong_timing') {
      // Improve time-based learning
    } else if (reason === 'incorrect_devices') {
      // Refine device pattern matching
    }
  }

  /**
   * Record scene execution for learning
   */
  async recordSceneExecution(sceneId, source = 'user') {
    this.sceneExecutions.set(Date.now(), {
      sceneId,
      source,
      timestamp: Date.now()
    });

    // Update scene statistics
    const scene = this.learnedScenes.get(sceneId);
    if (scene) {
      scene.statistics.executionCount++;
    }
  }

  /**
   * Get learned scene suggestions for current context
   */
  async getSuggestions() {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();

    const suggestions = [];

    for (const [_id, scene] of this.learnedScenes) {
      if (scene.status !== 'suggested' && scene.status !== 'approved') {
        continue;
      }

      // Check if context matches
      const contextMatch = this.matchesContext(scene.context, { hour, day });
      
      if (contextMatch > 0.7) {
        suggestions.push({
          ...scene,
          matchScore: contextMatch
        });
      }
    }

    // Sort by match score and confidence
    suggestions.sort((a, b) => {
      const scoreA = a.matchScore * a.confidence;
      const scoreB = b.matchScore * b.confidence;
      return scoreB - scoreA;
    });

    return suggestions.slice(0, 5);
  }

  /**
   * Check if current context matches scene context
   */
  matchesContext(sceneContext, currentContext) {
    let score = 0;

    // Hour match (within 1 hour)
    const hourDiff = Math.abs(sceneContext.hour - currentContext.hour);
    if (hourDiff <= 1) {
      score += 0.5;
    } else if (hourDiff <= 2) {
      score += 0.3;
    }

    // Day of week match
    if (sceneContext.dayOfWeek === currentContext.day) {
      score += 0.3;
    } else {
      // Weekday vs weekend similarity
      const sceneIsWeekday = sceneContext.dayOfWeek >= 1 && sceneContext.dayOfWeek <= 5;
      const currentIsWeekday = currentContext.day >= 1 && currentContext.day <= 5;
      if (sceneIsWeekday === currentIsWeekday) {
        score += 0.2;
      }
    }

    return score;
  }

  /**
   * Notify user about new learned scene
   */
  async notifyNewLearnedScene(scene) {
    await this.homey.notifications.createNotification({
      excerpt: `Ny scen upptäckt: "${scene.name.sv}" (${scene.confidence}% säkerhet). Vill du aktivera den?`
    });

    // Could trigger a flow card
    const trigger = this.homey.flow.getTriggerCard('scene_learned');
    if (trigger) {
      await trigger.trigger({
        scene: scene.name.sv,
        confidence: scene.confidence
      });
    }
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  groupByTimeWindows(history) {
    const windows = {};
    
    for (const state of history) {
      const window = state.hour;
      if (!windows[window]) {
        windows[window] = [];
      }
      windows[window].push(state);
    }

    return windows;
  }

  findRepeatingPatterns(_states) {
    // Simplified pattern detection
    // In production, use more sophisticated clustering algorithms
    return [];
  }

  generatePatternKey(changes) {
    const devices = changes
      .map(c => `${c.deviceId}_${JSON.stringify(c.capabilities)}`)
      .sort()
      .join('|');
    
    return `pattern_${this.hashCode(devices)}`;
  }

  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }

  sceneNameExists(name) {
    for (const [_id, scene] of this.learnedScenes) {
      if (scene.name.sv === name || scene.name.en === name) {
        return true;
      }
    }
    return false;
  }

  generateSceneId() {
    return `learned_scene_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async getPresenceStatus() {
    try {
      return await this.homey.app.presenceManager.getStatus();
    } catch {
      return 'unknown';
    }
  }

  async saveLearnedScenes() {
    const data = {};
    this.learnedScenes.forEach((scene, id) => {
      data[id] = scene;
    });
    await this.homey.settings.set('learnedScenes', data);
  }

  async saveDeviceStateHistory() {
    await this.homey.settings.set('deviceStateHistory', this.deviceStateHistory.slice(-5000));
  }

  log(...args) {
    console.log('[SceneLearningSystem]', ...args);
  }

  error(...args) {
    console.error('[SceneLearningSystem]', ...args);
  }
}

module.exports = SceneLearningSystem;
