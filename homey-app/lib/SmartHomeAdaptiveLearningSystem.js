'use strict';

const EventEmitter = require('events');

/**
 * SmartHomeAdaptiveLearningSystem
 *
 * Adaptive Learning & User Behavior Prediction System for the Homey
 * smart-home platform.  Learns and predicts user behavior patterns to
 * preemptively adjust the home environment — lighting, temperature,
 * music, curtains and more — before the user explicitly asks.
 *
 * Core capabilities:
 *  - Behavioral pattern recognition (wake-up, arrival/departure, meals, bedtime)
 *  - Temporal pattern clustering (weekday vs weekend, seasonal, holidays)
 *  - User preference learning (lighting, temperature, music, curtains by TOD)
 *  - Anomaly detection (health / security concern indicators)
 *  - Prediction confidence scoring
 *  - Multi-user household conflict resolution
 *  - Reinforcement learning via user-override feedback
 *  - Circadian rhythm analysis
 *  - Routine detection & automation suggestion engine
 *  - Habit streak tracking
 *  - Context-aware adaptations (weather, season, day-of-week, guests)
 *  - Gradual adjustment protocol
 *  - Privacy-respecting data retention & anonymisation
 *  - Cross-system optimisation recommendations
 *  - Energy-behavior correlation analysis
 *  - Comfort score prediction per user
 *  - Proactive deviation notifications
 *
 * @module SmartHomeAdaptiveLearningSystem
 */
class SmartHomeAdaptiveLearningSystem extends EventEmitter {

  /**
   * @param {object} homey - Homey app instance
   */
  constructor(homey) {
    super();
    this.homey = homey;
    this.initialized = false;

    /** @type {number[]} Active interval IDs for cleanup */
    this.intervals = [];

    // ── User profiles ───────────────────────────────────────────────
    /** @type {Map<string,object>} Per-user behaviour profiles keyed by userId */
    this.userProfiles = new Map();

    /** @type {string|null} Currently dominant user (single-occupancy shortcut) */
    this.dominantUser = null;

    // ── Behavioral event log ────────────────────────────────────────
    /** @type {object[]} Rolling window of raw behavioural events */
    this.behaviorLog = [];

    /** @type {number} Maximum behavioural events to retain */
    this.maxBehaviorLogSize = 50000;

    /** @type {number} Data retention period in days */
    this.dataRetentionDays = 90;

    // ── Temporal patterns ───────────────────────────────────────────
    /** @type {object} Aggregated temporal pattern clusters */
    this.temporalPatterns = {
      weekday: { wake: [], depart: [], arrive: [], meal: [], bedtime: [] },
      weekend: { wake: [], depart: [], arrive: [], meal: [], bedtime: [] },
      seasonal: { spring: {}, summer: {}, autumn: {}, winter: {} },
      holidays: []
    };

    /** @type {Map<string,object>} Detected recurring routines */
    this.routines = new Map();

    // ── Preference models ───────────────────────────────────────────
    /** @type {Map<string,object>} Per-user learned preference models */
    this.preferenceModels = new Map();

    /** @type {object} Global default preferences (fallback) */
    this.defaultPreferences = {
      lighting: { brightness: 70, colorTemp: 4000 },
      temperature: { target: 21.5, tolerance: 1.0 },
      music: { volume: 30, genre: null },
      curtains: { position: 50 }
    };

    // ── Prediction engine ───────────────────────────────────────────
    /** @type {object[]} Pending predictions awaiting execution */
    this.pendingPredictions = [];

    /** @type {number} Minimum confidence to act on a prediction (0-1) */
    this.confidenceThreshold = 0.75;

    /** @type {object} Prediction accuracy tracking */
    this.predictionAccuracy = {
      totalPredictions: 0,
      correctPredictions: 0,
      rollingAccuracy: 0,
      byCategory: {}
    };

    // ── Anomaly detection ───────────────────────────────────────────
    /** @type {object[]} Recent anomalies detected */
    this.anomalies = [];

    /** @type {number} Z-score threshold for anomaly flagging */
    this.anomalyZScoreThreshold = 2.5;

    /** @type {number} Maximum anomalies to retain */
    this.maxAnomalies = 500;

    // ── Reinforcement learning ──────────────────────────────────────
    /** @type {object[]} Feedback events from user overrides */
    this.feedbackLog = [];

    /** @type {Map<string,number>} Reward/penalty weights per action type */
    this.rewardWeights = new Map([
      ['lightingAccepted', 1.0],
      ['lightingOverridden', -0.5],
      ['temperatureAccepted', 1.0],
      ['temperatureOverridden', -0.5],
      ['musicAccepted', 0.8],
      ['musicOverridden', -0.3],
      ['curtainAccepted', 0.8],
      ['curtainOverridden', -0.3],
      ['automationAccepted', 1.5],
      ['automationDismissed', -1.0]
    ]);

    // ── Circadian rhythm ────────────────────────────────────────────
    /** @type {Map<string,object>} Per-user circadian rhythm models */
    this.circadianModels = new Map();

    // ── Habit streaks ───────────────────────────────────────────────
    /** @type {Map<string,object>} Per-user habit streak tracking */
    this.habitStreaks = new Map();

    // ── Context state ───────────────────────────────────────────────
    /** @type {object} Current contextual state */
    this.context = {
      weather: { condition: 'clear', tempC: 20, humidity: 50 },
      season: this._currentSeason(),
      dayOfWeek: new Date().getDay(),
      isWeekend: [0, 6].includes(new Date().getDay()),
      isHoliday: false,
      guestsPresent: false,
      guestCount: 0,
      timeOfDay: this._classifyTimeOfDay(new Date()),
      sunPosition: 'unknown'
    };

    // ── Conflict resolution ─────────────────────────────────────────
    /** @type {object} Multi-user conflict resolution state */
    this.conflictResolution = {
      activeConflicts: [],
      resolvedCount: 0,
      strategy: 'weighted-average',  // 'priority' | 'weighted-average' | 'round-robin'
      userPriorities: new Map()
    };

    // ── Gradual adjustment ──────────────────────────────────────────
    /** @type {object[]} Active gradual transitions */
    this.activeTransitions = [];

    /** @type {number} Maximum adjustment step per tick */
    this.maxAdjustmentStep = {
      brightness: 5,        // percent per step
      temperature: 0.3,     // °C per step
      volume: 3,            // percent per step
      curtainPosition: 5    // percent per step
    };

    // ── Energy-behaviour correlation ────────────────────────────────
    /** @type {object[]} Energy usage samples correlated with behaviour */
    this.energyBehaviorSamples = [];

    /** @type {object} Current energy-behaviour correlation metrics */
    this.energyCorrelation = {
      wastefulPatterns: [],
      savingOpportunities: [],
      weeklyDelta: 0,
      monthlyDelta: 0
    };

    // ── Comfort scoring ─────────────────────────────────────────────
    /** @type {Map<string,object>} Per-user comfort score history */
    this.comfortScores = new Map();

    // ── Automation suggestions ───────────────────────────────────────
    /** @type {object[]} Generated automation suggestions */
    this.automationSuggestions = [];

    /** @type {number} Maximum pending suggestions */
    this.maxSuggestions = 50;

    // ── Cross-system optimisation ───────────────────────────────────
    /** @type {object[]} Optimisation recommendations */
    this.optimisationRecommendations = [];

    // ── Configuration ───────────────────────────────────────────────
    /** @type {object} System configuration */
    this.config = {
      enabled: true,
      learningRate: 0.05,
      patternAnalysisIntervalMs: 5 * 60 * 1000,     // 5 min
      predictionCycleIntervalMs: 60 * 1000,          // 1 min
      dataCleanupIntervalMs: 6 * 60 * 60 * 1000,     // 6 h
      anomalyCheckIntervalMs: 10 * 60 * 1000,         // 10 min
      comfortScoreIntervalMs: 15 * 60 * 1000,         // 15 min
      energyCorrelationIntervalMs: 30 * 60 * 1000,    // 30 min
      contextRefreshIntervalMs: 2 * 60 * 1000,        // 2 min
      gradualAdjustmentTickMs: 15 * 1000,              // 15 s
      streakCheckIntervalMs: 60 * 60 * 1000,           // 1 h
      suggestionGenerationIntervalMs: 60 * 60 * 1000,  // 1 h
      anonymiseDataOnExpiry: true,
      logLevel: 'info'
    };

    this.log('SmartHomeAdaptiveLearningSystem constructed');
  }

  // ════════════════════════════════════════════════════════════════════
  //  LIFECYCLE
  // ════════════════════════════════════════════════════════════════════

  /**
   * Initialise the system — start all background processing loops.
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      this.log('Initialising Adaptive Learning System …');

      await this._loadPersistedState();
      this._refreshContext();

      // Register intervals
      this.intervals.push(
        setInterval(() => this._runPatternAnalysis(), this.config.patternAnalysisIntervalMs)
      );
      this.intervals.push(
        setInterval(() => this._runPredictionCycle(), this.config.predictionCycleIntervalMs)
      );
      this.intervals.push(
        setInterval(() => this._runDataCleanup(), this.config.dataCleanupIntervalMs)
      );
      this.intervals.push(
        setInterval(() => this._runAnomalyCheck(), this.config.anomalyCheckIntervalMs)
      );
      this.intervals.push(
        setInterval(() => this._computeComfortScores(), this.config.comfortScoreIntervalMs)
      );
      this.intervals.push(
        setInterval(() => this._runEnergyCorrelation(), this.config.energyCorrelationIntervalMs)
      );
      this.intervals.push(
        setInterval(() => this._refreshContext(), this.config.contextRefreshIntervalMs)
      );
      this.intervals.push(
        setInterval(() => this._tickGradualAdjustments(), this.config.gradualAdjustmentTickMs)
      );
      this.intervals.push(
        setInterval(() => this._checkHabitStreaks(), this.config.streakCheckIntervalMs)
      );
      this.intervals.push(
        setInterval(() => this._generateAutomationSuggestions(), this.config.suggestionGenerationIntervalMs)
      );

      this.initialized = true;
      this.emit('initialized');
      this.log('Adaptive Learning System initialised successfully');
    } catch (err) {
      this.error('Failed to initialise Adaptive Learning System', err);
      this.emit('error', err);
    }
  }

  /**
   * Return a comprehensive status snapshot.
   * @returns {object}
   */
  getStatus() {
    return {
      initialized: this.initialized,
      userCount: this.userProfiles.size,
      behaviorLogSize: this.behaviorLog.length,
      routineCount: this.routines.size,
      pendingPredictions: this.pendingPredictions.length,
      predictionAccuracy: this.predictionAccuracy,
      anomalyCount: this.anomalies.length,
      activeConflicts: this.conflictResolution.activeConflicts.length,
      activeTransitions: this.activeTransitions.length,
      automationSuggestions: this.automationSuggestions.length,
      optimisationRecommendations: this.optimisationRecommendations.length,
      confidenceThreshold: this.confidenceThreshold,
      context: { ...this.context },
      config: { ...this.config },
      dataRetentionDays: this.dataRetentionDays,
      intervalCount: this.intervals.length,
      feedbackLogSize: this.feedbackLog.length
    };
  }

  /**
   * Tear down all intervals, persist state and release resources.
   */
  destroy() {
    try {
      this.log('Destroying Adaptive Learning System …');

      for (const id of this.intervals) {
        clearInterval(id);
      }
      this.intervals = [];

      this._persistState();

      this.behaviorLog = [];
      this.pendingPredictions = [];
      this.anomalies = [];
      this.feedbackLog = [];
      this.activeTransitions = [];
      this.automationSuggestions = [];
      this.optimisationRecommendations = [];
      this.energyBehaviorSamples = [];

      this.userProfiles.clear();
      this.preferenceModels.clear();
      this.circadianModels.clear();
      this.habitStreaks.clear();
      this.comfortScores.clear();
      this.routines.clear();
      this.conflictResolution.userPriorities.clear();

      this.initialized = false;
      this.emit('destroyed');
      this.removeAllListeners();
      this.log('Adaptive Learning System destroyed');
    } catch (err) {
      this.error('Error during destroy', err);
    }
  }

  // ════════════════════════════════════════════════════════════════════
  //  PUBLIC API — event ingestion
  // ════════════════════════════════════════════════════════════════════

  /**
   * Record a behavioural event (presence change, device interaction, etc.).
   * @param {string} userId
   * @param {string} eventType - e.g. 'wake', 'depart', 'arrive', 'meal', 'bedtime', 'device_use'
   * @param {object} [payload={}]
   */
  recordBehaviorEvent(userId, eventType, payload = {}) {
    try {
      const event = {
        id: this._uid(),
        userId,
        eventType,
        payload,
        timestamp: Date.now(),
        context: { ...this.context }
      };
      this.behaviorLog.push(event);
      if (this.behaviorLog.length > this.maxBehaviorLogSize) {
        this.behaviorLog.shift();
      }
      this._ensureUserProfile(userId);
      this._updateTemporalPattern(userId, eventType, event.timestamp);
      this.emit('behaviorEvent', event);
      this.log(`Behavior event recorded: ${eventType} for user ${userId}`);
    } catch (err) {
      this.error('Failed to record behavior event', err);
    }
  }

  /**
   * Record a user preference observation.
   * @param {string} userId
   * @param {string} category - 'lighting' | 'temperature' | 'music' | 'curtains'
   * @param {object} values
   */
  recordPreference(userId, category, values) {
    try {
      this._ensureUserProfile(userId);
      const model = this._ensurePreferenceModel(userId);
      if (!model[category]) {
        model[category] = [];
      }
      model[category].push({
        values,
        timestamp: Date.now(),
        context: { ...this.context }
      });
      // Keep last 2000 observations per category
      if (model[category].length > 2000) {
        model[category] = model[category].slice(-2000);
      }
      this.emit('preferenceRecorded', { userId, category, values });
    } catch (err) {
      this.error('Failed to record preference', err);
    }
  }

  /**
   * Register feedback from a user override (reinforcement signal).
   * @param {string} userId
   * @param {string} actionType - e.g. 'lightingAccepted', 'temperatureOverridden'
   * @param {object} [details={}]
   */
  recordFeedback(userId, actionType, details = {}) {
    try {
      const weight = this.rewardWeights.get(actionType) || 0;
      const entry = {
        userId,
        actionType,
        weight,
        details,
        timestamp: Date.now()
      };
      this.feedbackLog.push(entry);
      this._applyReinforcementUpdate(userId, actionType, weight, details);
      this.emit('feedbackRecorded', entry);
      this.log(`Feedback: ${actionType} (weight ${weight}) for user ${userId}`);
    } catch (err) {
      this.error('Failed to record feedback', err);
    }
  }

  /**
   * Notify the system about guest presence changes.
   * @param {boolean} present
   * @param {number} [count=0]
   */
  setGuestPresence(present, count = 0) {
    this.context.guestsPresent = present;
    this.context.guestCount = count;
    this.emit('guestPresenceChanged', { present, count });
    this.log(`Guest presence updated: present=${present}, count=${count}`);
  }

  /**
   * Update external weather context.
   * @param {object} weather
   */
  updateWeatherContext(weather) {
    if (weather && typeof weather === 'object') {
      Object.assign(this.context.weather, weather);
      this.emit('weatherContextUpdated', this.context.weather);
    }
  }

  /**
   * Set user priority for conflict resolution.
   * @param {string} userId
   * @param {number} priority - Higher = more weight
   */
  setUserPriority(userId, priority) {
    this.conflictResolution.userPriorities.set(userId, priority);
    this.log(`User priority set: ${userId} → ${priority}`);
  }

  /**
   * Retrieve predictions relevant to the current moment.
   * @returns {object[]}
   */
  getCurrentPredictions() {
    return this.pendingPredictions.filter(p => p.confidence >= this.confidenceThreshold);
  }

  /**
   * Get detected anomalies within a time window.
   * @param {number} [windowMs=86400000] - Default 24 h
   * @returns {object[]}
   */
  getRecentAnomalies(windowMs = 86400000) {
    const cutoff = Date.now() - windowMs;
    return this.anomalies.filter(a => a.timestamp >= cutoff);
  }

  /**
   * Retrieve pending automation suggestions.
   * @returns {object[]}
   */
  getAutomationSuggestions() {
    return [...this.automationSuggestions];
  }

  /**
   * Accept or dismiss an automation suggestion.
   * @param {string} suggestionId
   * @param {boolean} accepted
   */
  respondToSuggestion(suggestionId, accepted) {
    try {
      const idx = this.automationSuggestions.findIndex(s => s.id === suggestionId);
      if (idx === -1) return;
      const suggestion = this.automationSuggestions.splice(idx, 1)[0];
      suggestion.responded = true;
      suggestion.accepted = accepted;
      suggestion.respondedAt = Date.now();
      const feedback = accepted ? 'automationAccepted' : 'automationDismissed';
      this.recordFeedback(suggestion.userId || '_system', feedback, { suggestionId });
      this.emit('suggestionResponse', suggestion);
    } catch (err) {
      this.error('Failed to respond to suggestion', err);
    }
  }

  /**
   * Get comfort score for a specific user.
   * @param {string} userId
   * @returns {object|null}
   */
  getComfortScore(userId) {
    return this.comfortScores.get(userId) || null;
  }

  /**
   * Get optimisation recommendations.
   * @returns {object[]}
   */
  getOptimisationRecommendations() {
    return [...this.optimisationRecommendations];
  }

  /**
   * Get habit streak data for a user.
   * @param {string} userId
   * @returns {object|null}
   */
  getHabitStreaks(userId) {
    return this.habitStreaks.get(userId) || null;
  }

  /**
   * Get the circadian model for a user.
   * @param {string} userId
   * @returns {object|null}
   */
  getCircadianModel(userId) {
    return this.circadianModels.get(userId) || null;
  }

  // ════════════════════════════════════════════════════════════════════
  //  PATTERN ANALYSIS
  // ════════════════════════════════════════════════════════════════════

  /**
   * Run the main pattern-analysis pass across all user behaviour data.
   * @private
   */
  _runPatternAnalysis() {
    try {
      const now = Date.now();
      for (const [userId] of this.userProfiles) {
        this._analyzeUserPatterns(userId, now);
        this._updateCircadianModel(userId, now);
        this._detectRoutines(userId, now);
      }
      this.emit('patternAnalysisComplete', { timestamp: now });
    } catch (err) {
      this.error('Pattern analysis failed', err);
    }
  }

  /**
   * Analyse patterns for a single user.
   * @private
   * @param {string} userId
   * @param {number} now
   */
  _analyzeUserPatterns(userId, now) {
    const events = this.behaviorLog.filter(e => e.userId === userId);
    if (events.length < 5) return;

    const profile = this.userProfiles.get(userId);
    const dayBucket = this.context.isWeekend ? 'weekend' : 'weekday';

    const byType = {};
    for (const ev of events) {
      if (!byType[ev.eventType]) byType[ev.eventType] = [];
      byType[ev.eventType].push(ev);
    }

    // Compute average time-of-day for each event type
    for (const [type, evs] of Object.entries(byType)) {
      const times = evs.map(e => {
        const d = new Date(e.timestamp);
        return d.getHours() * 60 + d.getMinutes();
      });
      const avgMinutes = times.reduce((a, b) => a + b, 0) / times.length;
      const stdDev = Math.sqrt(
        times.reduce((sum, t) => sum + Math.pow(t - avgMinutes, 2), 0) / times.length
      );

      if (!profile.patterns) profile.patterns = {};
      profile.patterns[type] = {
        averageMinuteOfDay: Math.round(avgMinutes),
        stdDevMinutes: Math.round(stdDev * 10) / 10,
        sampleCount: evs.length,
        lastOccurrence: evs[evs.length - 1].timestamp,
        dayBucket
      };

      // Update temporal pattern cluster
      if (this.temporalPatterns[dayBucket] && this.temporalPatterns[dayBucket][type]) {
        const cluster = this.temporalPatterns[dayBucket][type];
        cluster.push({ avgMinutes: Math.round(avgMinutes), stdDev, userId, updatedAt: now });
        if (cluster.length > 200) {
          this.temporalPatterns[dayBucket][type] = cluster.slice(-200);
        }
      }
    }
  }

  /**
   * Detect recurring routines for a user.
   * @private
   * @param {string} userId
   * @param {number} now
   */
  _detectRoutines(userId, now) {
    const profile = this.userProfiles.get(userId);
    if (!profile || !profile.patterns) return;

    for (const [type, pat] of Object.entries(profile.patterns)) {
      if (pat.sampleCount < 5) continue;
      if (pat.stdDevMinutes > 45) continue;   // too noisy

      const routineKey = `${userId}:${type}:${pat.dayBucket}`;
      const confidence = Math.min(1, pat.sampleCount / 30) * Math.max(0, 1 - pat.stdDevMinutes / 60);
      this.routines.set(routineKey, {
        userId,
        eventType: type,
        dayBucket: pat.dayBucket,
        averageMinuteOfDay: pat.averageMinuteOfDay,
        stdDevMinutes: pat.stdDevMinutes,
        confidence: Math.round(confidence * 1000) / 1000,
        sampleCount: pat.sampleCount,
        updatedAt: now
      });
    }
  }

  // ════════════════════════════════════════════════════════════════════
  //  CIRCADIAN RHYTHM
  // ════════════════════════════════════════════════════════════════════

  /**
   * Update the circadian rhythm model for a user.
   * @private
   * @param {string} userId
   * @param {number} now
   */
  _updateCircadianModel(userId, now) {
    try {
      const profile = this.userProfiles.get(userId);
      if (!profile || !profile.patterns) return;

      const wakePattern = profile.patterns.wake;
      const bedPattern = profile.patterns.bedtime;
      if (!wakePattern || !bedPattern) return;

      const wakeMin = wakePattern.averageMinuteOfDay;
      const bedMin = bedPattern.averageMinuteOfDay;
      const awakeMinutes = bedMin > wakeMin ? bedMin - wakeMin : (1440 - wakeMin) + bedMin;

      const model = {
        userId,
        wakeTimeMinutes: wakeMin,
        bedTimeMinutes: bedMin,
        awakeDurationMinutes: awakeMinutes,
        sleepDurationMinutes: 1440 - awakeMinutes,
        chronotype: this._classifyChronotype(wakeMin),
        peakAlertness: this._estimatePeakAlertness(wakeMin),
        lightPreferenceCurve: this._buildLightPreferenceCurve(wakeMin, bedMin),
        temperaturePreferenceCurve: this._buildTemperaturePreferenceCurve(wakeMin, bedMin),
        updatedAt: now
      };
      this.circadianModels.set(userId, model);
      this.emit('circadianModelUpdated', { userId, model });
    } catch (err) {
      this.error(`Circadian model update failed for ${userId}`, err);
    }
  }

  /**
   * Classify a chronotype based on wake time.
   * @private
   * @param {number} wakeMin - Minutes since midnight
   * @returns {string}
   */
  _classifyChronotype(wakeMin) {
    if (wakeMin < 330) return 'extreme-early';
    if (wakeMin < 390) return 'early-bird';
    if (wakeMin < 480) return 'moderate';
    if (wakeMin < 570) return 'late-riser';
    return 'night-owl';
  }

  /**
   * Estimate the peak alertness window (minutes since midnight).
   * @private
   * @param {number} wakeMin
   * @returns {{ start: number, end: number }}
   */
  _estimatePeakAlertness(wakeMin) {
    // Roughly 2-4 hours after waking
    return { start: wakeMin + 120, end: wakeMin + 240 };
  }

  /**
   * Build a simplified light-preference curve across 24 h.
   * @private
   * @param {number} wakeMin
   * @param {number} bedMin
   * @returns {object[]}
   */
  _buildLightPreferenceCurve(wakeMin, bedMin) {
    const curve = [];
    for (let m = 0; m < 1440; m += 60) {
      let brightness = 0;
      let colorTemp = 2700;
      if (m >= wakeMin && m < wakeMin + 60) {
        // Gradual wake-up
        brightness = Math.round(((m - wakeMin) / 60) * 70);
        colorTemp = 3000 + Math.round(((m - wakeMin) / 60) * 2000);
      } else if (m >= wakeMin + 60 && m < bedMin - 120) {
        brightness = 80;
        colorTemp = 5000;
      } else if (m >= bedMin - 120 && m < bedMin) {
        // Wind-down
        const progress = (bedMin - m) / 120;
        brightness = Math.round(20 + progress * 60);
        colorTemp = Math.round(2700 + progress * 1300);
      } else if (m >= bedMin || m < wakeMin) {
        brightness = 0;
        colorTemp = 2700;
      }
      curve.push({ minuteOfDay: m, brightness, colorTemp });
    }
    return curve;
  }

  /**
   * Build a simplified temperature-preference curve across 24 h.
   * @private
   * @param {number} wakeMin
   * @param {number} bedMin
   * @returns {object[]}
   */
  _buildTemperaturePreferenceCurve(wakeMin, bedMin) {
    const curve = [];
    for (let m = 0; m < 1440; m += 60) {
      let temp = 18.0;
      if (m >= wakeMin && m < wakeMin + 60) {
        temp = 19.0 + ((m - wakeMin) / 60) * 2.5;
      } else if (m >= wakeMin + 60 && m < bedMin - 60) {
        temp = 21.5;
      } else if (m >= bedMin - 60 && m < bedMin) {
        temp = 21.5 - ((m - (bedMin - 60)) / 60) * 2.0;
      } else {
        temp = 18.0;
      }
      curve.push({ minuteOfDay: m, targetTemp: Math.round(temp * 10) / 10 });
    }
    return curve;
  }

  // ════════════════════════════════════════════════════════════════════
  //  PREDICTION CYCLE
  // ════════════════════════════════════════════════════════════════════

  /**
   * Run the prediction cycle — generate and optionally execute predictions.
   * @private
   */
  _runPredictionCycle() {
    try {
      if (!this.config.enabled) return;
      const now = Date.now();
      const currentMinute = this._minuteOfDay(now);

      this.pendingPredictions = [];

      for (const [key, routine] of this.routines) {
        const leadTimeMin = 15;
        const diff = routine.averageMinuteOfDay - currentMinute;
        if (diff > 0 && diff <= leadTimeMin && routine.confidence >= this.confidenceThreshold) {
          const prediction = {
            id: this._uid(),
            routineKey: key,
            userId: routine.userId,
            eventType: routine.eventType,
            predictedMinute: routine.averageMinuteOfDay,
            confidence: routine.confidence,
            leadTimeMinutes: diff,
            actions: this._planActionsForPrediction(routine),
            timestamp: now,
            executed: false
          };
          this.pendingPredictions.push(prediction);
          this.predictionAccuracy.totalPredictions++;
          this.emit('predictionGenerated', prediction);
        }
      }

      // Execute high-confidence predictions via gradual adjustment
      for (const pred of this.pendingPredictions) {
        if (!pred.executed && pred.confidence >= this.confidenceThreshold) {
          this._schedulePredictedActions(pred);
          pred.executed = true;
        }
      }
    } catch (err) {
      this.error('Prediction cycle failed', err);
    }
  }

  /**
   * Plan adjustment actions for a predicted routine event.
   * @private
   * @param {object} routine
   * @returns {object[]}
   */
  _planActionsForPrediction(routine) {
    const actions = [];
    const userId = routine.userId;
    const prefModel = this.preferenceModels.get(userId);

    if (routine.eventType === 'wake') {
      const lightPref = this._resolvePreference(userId, 'lighting');
      const tempPref = this._resolvePreference(userId, 'temperature');
      actions.push(
        { system: 'lighting', action: 'setBrightness', value: lightPref.brightness, room: 'bedroom' },
        { system: 'lighting', action: 'setColorTemp', value: lightPref.colorTemp, room: 'bedroom' },
        { system: 'climate', action: 'setTemperature', value: tempPref.target, zone: 'bedroom' },
        { system: 'curtains', action: 'setPosition', value: 30, room: 'bedroom' }
      );
    } else if (routine.eventType === 'arrive') {
      const lightPref = this._resolvePreference(userId, 'lighting');
      const tempPref = this._resolvePreference(userId, 'temperature');
      actions.push(
        { system: 'lighting', action: 'setBrightness', value: lightPref.brightness, room: 'hallway' },
        { system: 'climate', action: 'setTemperature', value: tempPref.target, zone: 'living' },
        { system: 'music', action: 'play', value: this._resolvePreference(userId, 'music') }
      );
    } else if (routine.eventType === 'bedtime') {
      actions.push(
        { system: 'lighting', action: 'setBrightness', value: 10, room: 'all' },
        { system: 'lighting', action: 'setColorTemp', value: 2700, room: 'all' },
        { system: 'climate', action: 'setTemperature', value: 18.5, zone: 'bedroom' },
        { system: 'curtains', action: 'setPosition', value: 0, room: 'bedroom' }
      );
    } else if (routine.eventType === 'depart') {
      actions.push(
        { system: 'lighting', action: 'setBrightness', value: 0, room: 'all' },
        { system: 'climate', action: 'setMode', value: 'away', zone: 'all' },
        { system: 'security', action: 'arm', value: 'away' }
      );
    } else if (routine.eventType === 'meal') {
      const lightPref = this._resolvePreference(userId, 'lighting');
      actions.push(
        { system: 'lighting', action: 'setBrightness', value: lightPref.brightness, room: 'kitchen' },
        { system: 'lighting', action: 'setColorTemp', value: 4500, room: 'kitchen' }
      );
    }
    return actions;
  }

  /**
   * Schedule predicted actions through the gradual adjustment pipeline.
   * @private
   * @param {object} prediction
   */
  _schedulePredictedActions(prediction) {
    for (const action of prediction.actions) {
      this._startGradualTransition({
        predictionId: prediction.id,
        userId: prediction.userId,
        system: action.system,
        action: action.action,
        targetValue: action.value,
        room: action.room || action.zone || 'unknown',
        durationMs: prediction.leadTimeMinutes * 60 * 1000,
        startedAt: Date.now()
      });
    }
  }

  // ════════════════════════════════════════════════════════════════════
  //  GRADUAL ADJUSTMENT
  // ════════════════════════════════════════════════════════════════════

  /**
   * Register a gradual transition.
   * @private
   * @param {object} transition
   */
  _startGradualTransition(transition) {
    transition.id = this._uid();
    transition.currentValue = this._estimateCurrentValue(transition.system, transition.action);
    transition.complete = false;
    this.activeTransitions.push(transition);
    this.emit('transitionStarted', transition);
    this.log(`Gradual transition started: ${transition.system}.${transition.action} → ${transition.targetValue}`);
  }

  /**
   * Tick all active gradual transitions one step forward.
   * @private
   */
  _tickGradualAdjustments() {
    try {
      const now = Date.now();
      const completed = [];

      for (const t of this.activeTransitions) {
        if (t.complete) {
          completed.push(t.id);
          continue;
        }
        const elapsed = now - t.startedAt;
        if (elapsed >= t.durationMs) {
          t.currentValue = t.targetValue;
          t.complete = true;
          completed.push(t.id);
          this.emit('transitionComplete', t);
          continue;
        }

        const progress = elapsed / t.durationMs;
        const range = typeof t.targetValue === 'number' && typeof t.currentValue === 'number'
          ? t.targetValue - t.currentValue
          : 0;

        if (range !== 0) {
          const maxStep = this._getMaxStep(t.system, t.action);
          const desiredStep = range * progress;
          const step = Math.sign(desiredStep) * Math.min(Math.abs(desiredStep), maxStep);
          t.currentValue = Math.round((t.currentValue + step) * 10) / 10;
        }
        this.emit('transitionTick', t);
      }

      // Remove completed
      this.activeTransitions = this.activeTransitions.filter(t => !completed.includes(t.id));
    } catch (err) {
      this.error('Gradual adjustment tick failed', err);
    }
  }

  /**
   * Get the maximum step size for a given system + action.
   * @private
   * @param {string} system
   * @param {string} action
   * @returns {number}
   */
  _getMaxStep(system, action) {
    if (system === 'lighting' && action === 'setBrightness') return this.maxAdjustmentStep.brightness;
    if (system === 'climate' && (action === 'setTemperature' || action === 'setMode')) return this.maxAdjustmentStep.temperature;
    if (system === 'music') return this.maxAdjustmentStep.volume;
    if (system === 'curtains') return this.maxAdjustmentStep.curtainPosition;
    return 5;
  }

  /**
   * Estimate the current value of a device/system attribute.
   * @private
   * @param {string} system
   * @param {string} action
   * @returns {number}
   */
  _estimateCurrentValue(system, action) {
    if (system === 'lighting' && action === 'setBrightness') return this.defaultPreferences.lighting.brightness;
    if (system === 'lighting' && action === 'setColorTemp') return this.defaultPreferences.lighting.colorTemp;
    if (system === 'climate') return this.defaultPreferences.temperature.target;
    if (system === 'curtains') return this.defaultPreferences.curtains.position;
    if (system === 'music') return this.defaultPreferences.music.volume;
    return 0;
  }

  // ════════════════════════════════════════════════════════════════════
  //  ANOMALY DETECTION
  // ════════════════════════════════════════════════════════════════════

  /**
   * Run anomaly detection over recent behaviour.
   * @private
   */
  _runAnomalyCheck() {
    try {
      const now = Date.now();
      const windowMs = 24 * 60 * 60 * 1000;

      for (const [userId, profile] of this.userProfiles) {
        if (!profile.patterns) continue;

        const recentEvents = this.behaviorLog.filter(
          e => e.userId === userId && e.timestamp > now - windowMs
        );

        // Check for missing expected events
        for (const [type, pat] of Object.entries(profile.patterns)) {
          if (pat.sampleCount < 7) continue;
          const expectedOccurrence = this._hasOccurredToday(userId, type, now);
          const expectedMinute = pat.averageMinuteOfDay;
          const currentMinute = this._minuteOfDay(now);

          if (!expectedOccurrence && currentMinute > expectedMinute + pat.stdDevMinutes * 2) {
            this._raiseAnomaly(userId, 'missing_event', {
              eventType: type,
              expectedMinute,
              currentMinute,
              stdDevMinutes: pat.stdDevMinutes,
              message: `Expected "${type}" event around ${this._minutesToTimeStr(expectedMinute)} but not observed.`
            }, now);
          }
        }

        // Check for unusual timing
        for (const ev of recentEvents) {
          const pat = profile.patterns[ev.eventType];
          if (!pat || pat.sampleCount < 7) continue;
          const evMinute = this._minuteOfDay(ev.timestamp);
          const zScore = Math.abs(evMinute - pat.averageMinuteOfDay) / Math.max(pat.stdDevMinutes, 1);
          if (zScore > this.anomalyZScoreThreshold) {
            this._raiseAnomaly(userId, 'unusual_timing', {
              eventType: ev.eventType,
              observedMinute: evMinute,
              expectedMinute: pat.averageMinuteOfDay,
              zScore: Math.round(zScore * 100) / 100,
              message: `"${ev.eventType}" at ${this._minutesToTimeStr(evMinute)} is unusual (z=${zScore.toFixed(1)}).`
            }, ev.timestamp);
          }
        }
      }
    } catch (err) {
      this.error('Anomaly check failed', err);
    }
  }

  /**
   * Raise and store an anomaly.
   * @private
   * @param {string} userId
   * @param {string} type
   * @param {object} details
   * @param {number} timestamp
   */
  _raiseAnomaly(userId, type, details, timestamp) {
    const anomaly = {
      id: this._uid(),
      userId,
      type,
      details,
      timestamp,
      acknowledged: false
    };
    this.anomalies.push(anomaly);
    if (this.anomalies.length > this.maxAnomalies) {
      this.anomalies.shift();
    }
    this.emit('anomalyDetected', anomaly);
    this.log(`Anomaly detected: ${type} for user ${userId} — ${details.message || ''}`);
  }

  /**
   * Check if an event type has occurred today for a user.
   * @private
   * @param {string} userId
   * @param {string} eventType
   * @param {number} now
   * @returns {boolean}
   */
  _hasOccurredToday(userId, eventType, now) {
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const dayStart = startOfDay.getTime();
    return this.behaviorLog.some(
      e => e.userId === userId && e.eventType === eventType && e.timestamp >= dayStart
    );
  }

  // ════════════════════════════════════════════════════════════════════
  //  REINFORCEMENT LEARNING
  // ════════════════════════════════════════════════════════════════════

  /**
   * Apply a reinforcement update to the user's preference model.
   * @private
   * @param {string} userId
   * @param {string} actionType
   * @param {number} weight
   * @param {object} details
   */
  _applyReinforcementUpdate(userId, actionType, weight, details) {
    try {
      const model = this._ensurePreferenceModel(userId);
      if (!model._reinforcement) {
        model._reinforcement = { totalReward: 0, updates: 0 };
      }
      model._reinforcement.totalReward += weight;
      model._reinforcement.updates++;

      // If negative feedback, adjust the confidence threshold upward slightly
      if (weight < 0) {
        this.confidenceThreshold = Math.min(0.95, this.confidenceThreshold + this.config.learningRate * 0.1);
      } else if (weight > 0) {
        this.confidenceThreshold = Math.max(0.50, this.confidenceThreshold - this.config.learningRate * 0.05);
      }

      // Track accuracy
      if (actionType.includes('Accepted')) {
        this.predictionAccuracy.correctPredictions++;
      }
      if (this.predictionAccuracy.totalPredictions > 0) {
        this.predictionAccuracy.rollingAccuracy =
          Math.round((this.predictionAccuracy.correctPredictions / this.predictionAccuracy.totalPredictions) * 1000) / 1000;
      }

      // Per-category tracking
      const cat = actionType.replace(/Accepted|Overridden|Dismissed/, '');
      if (!this.predictionAccuracy.byCategory[cat]) {
        this.predictionAccuracy.byCategory[cat] = { total: 0, correct: 0 };
      }
      this.predictionAccuracy.byCategory[cat].total++;
      if (actionType.includes('Accepted')) {
        this.predictionAccuracy.byCategory[cat].correct++;
      }

      this.emit('reinforcementApplied', { userId, actionType, weight, newThreshold: this.confidenceThreshold });
    } catch (err) {
      this.error('Reinforcement update failed', err);
    }
  }

  // ════════════════════════════════════════════════════════════════════
  //  CONFLICT RESOLUTION
  // ════════════════════════════════════════════════════════════════════

  /**
   * Resolve a preference conflict between multiple users.
   * @param {string} category - 'lighting' | 'temperature' | 'music' | 'curtains'
   * @param {string} room
   * @param {object[]} preferences - [{ userId, value }]
   * @returns {object} Resolved preference
   */
  resolveConflict(category, room, preferences) {
    try {
      if (!preferences || preferences.length === 0) {
        return this.defaultPreferences[category] || {};
      }
      if (preferences.length === 1) {
        return { resolved: preferences[0].value, method: 'single-user' };
      }

      const strategy = this.conflictResolution.strategy;
      let resolvedValue;

      if (strategy === 'priority') {
        const sorted = preferences.sort((a, b) => {
          const pa = this.conflictResolution.userPriorities.get(a.userId) || 0;
          const pb = this.conflictResolution.userPriorities.get(b.userId) || 0;
          return pb - pa;
        });
        resolvedValue = sorted[0].value;
      } else if (strategy === 'weighted-average') {
        let totalWeight = 0;
        let weightedSum = 0;
        for (const pref of preferences) {
          const w = this.conflictResolution.userPriorities.get(pref.userId) || 1;
          if (typeof pref.value === 'number') {
            weightedSum += pref.value * w;
            totalWeight += w;
          }
        }
        resolvedValue = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : preferences[0].value;
      } else {
        // round-robin — pick the first one and rotate
        resolvedValue = preferences[0].value;
      }

      const conflict = {
        id: this._uid(),
        category,
        room,
        preferences,
        resolved: resolvedValue,
        strategy,
        timestamp: Date.now()
      };
      this.conflictResolution.activeConflicts.push(conflict);
      if (this.conflictResolution.activeConflicts.length > 100) {
        this.conflictResolution.activeConflicts.shift();
      }
      this.conflictResolution.resolvedCount++;
      this.emit('conflictResolved', conflict);

      return { resolved: resolvedValue, method: strategy };
    } catch (err) {
      this.error('Conflict resolution failed', err);
      return this.defaultPreferences[category] || {};
    }
  }

  // ════════════════════════════════════════════════════════════════════
  //  COMFORT SCORES
  // ════════════════════════════════════════════════════════════════════

  /**
   * Compute comfort scores for every user.
   * @private
   */
  _computeComfortScores() {
    try {
      const now = Date.now();
      for (const [userId] of this.userProfiles) {
        const score = this._computeUserComfort(userId, now);
        this.comfortScores.set(userId, score);
      }
      this.emit('comfortScoresUpdated', { timestamp: now });
    } catch (err) {
      this.error('Comfort score computation failed', err);
    }
  }

  /**
   * Compute the comfort score for one user.
   * @private
   * @param {string} userId
   * @param {number} now
   * @returns {object}
   */
  _computeUserComfort(userId, now) {
    const prefModel = this.preferenceModels.get(userId);
    const circadian = this.circadianModels.get(userId);

    let lightingScore = 70;
    let temperatureScore = 70;
    let noiseScore = 80;
    let overallScore = 70;

    if (circadian) {
      const currentMinute = this._minuteOfDay(now);
      const lightEntry = (circadian.lightPreferenceCurve || []).find(
        e => Math.abs(e.minuteOfDay - currentMinute) < 30
      );
      if (lightEntry && lightEntry.brightness > 0) {
        lightingScore = 85;
      }
      const tempEntry = (circadian.temperaturePreferenceCurve || []).find(
        e => Math.abs(e.minuteOfDay - currentMinute) < 30
      );
      if (tempEntry) {
        const diff = Math.abs(this.context.weather.tempC - tempEntry.targetTemp);
        temperatureScore = Math.max(0, 100 - diff * 10);
      }
    }

    // Factor in recent feedback
    const recentFeedback = this.feedbackLog.filter(
      f => f.userId === userId && f.timestamp > now - 3600000
    );
    const posCount = recentFeedback.filter(f => f.weight > 0).length;
    const negCount = recentFeedback.filter(f => f.weight < 0).length;
    const feedbackBonus = (posCount - negCount) * 3;

    overallScore = Math.round(
      (lightingScore * 0.3 + temperatureScore * 0.4 + noiseScore * 0.3) + feedbackBonus
    );
    overallScore = Math.max(0, Math.min(100, overallScore));

    return {
      userId,
      overall: overallScore,
      lighting: Math.round(lightingScore),
      temperature: Math.round(temperatureScore),
      noise: Math.round(noiseScore),
      feedbackBonus,
      updatedAt: now
    };
  }

  // ════════════════════════════════════════════════════════════════════
  //  ENERGY-BEHAVIOUR CORRELATION
  // ════════════════════════════════════════════════════════════════════

  /**
   * Run energy-behaviour correlation analysis.
   * @private
   */
  _runEnergyCorrelation() {
    try {
      const now = Date.now();
      const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
      const monthAgo = now - 30 * 24 * 60 * 60 * 1000;

      const recentSamples = this.energyBehaviorSamples.filter(s => s.timestamp >= weekAgo);
      const monthlySamples = this.energyBehaviorSamples.filter(s => s.timestamp >= monthAgo);

      // Identify wasteful patterns
      const wasteful = [];
      const saving = [];

      for (const [userId, profile] of this.userProfiles) {
        if (!profile.patterns) continue;

        const departPat = profile.patterns.depart;
        const arrivePat = profile.patterns.arrive;
        if (departPat && arrivePat) {
          const awayMinutes = arrivePat.averageMinuteOfDay - departPat.averageMinuteOfDay;
          if (awayMinutes > 60) {
            saving.push({
              userId,
              type: 'away_setback',
              description: `Lower heating/cooling during ${awayMinutes}-minute absence`,
              estimatedSavingPercent: Math.round(awayMinutes / 60 * 2)
            });
          }
        }

        const bedPat = profile.patterns.bedtime;
        if (bedPat) {
          wasteful.push({
            userId,
            type: 'post_bedtime_devices',
            description: 'Devices left on after bedtime may waste energy',
            severity: 'low'
          });
          saving.push({
            userId,
            type: 'night_setback',
            description: 'Reduce heating by 2°C after bedtime',
            estimatedSavingPercent: 5
          });
        }
      }

      this.energyCorrelation.wastefulPatterns = wasteful;
      this.energyCorrelation.savingOpportunities = saving;

      // Compute deltas
      if (recentSamples.length > 1) {
        const weeklyTotal = recentSamples.reduce((sum, s) => sum + (s.energyKwh || 0), 0);
        this.energyCorrelation.weeklyDelta = Math.round(weeklyTotal * 100) / 100;
      }
      if (monthlySamples.length > 1) {
        const monthlyTotal = monthlySamples.reduce((sum, s) => sum + (s.energyKwh || 0), 0);
        this.energyCorrelation.monthlyDelta = Math.round(monthlyTotal * 100) / 100;
      }

      this.emit('energyCorrelationUpdated', this.energyCorrelation);
    } catch (err) {
      this.error('Energy correlation analysis failed', err);
    }
  }

  /**
   * Record an energy sample correlated with behaviour.
   * @param {object} sample - { energyKwh, activeBehaviors, userId? }
   */
  recordEnergySample(sample) {
    try {
      sample.timestamp = Date.now();
      this.energyBehaviorSamples.push(sample);
      if (this.energyBehaviorSamples.length > 10000) {
        this.energyBehaviorSamples = this.energyBehaviorSamples.slice(-10000);
      }
    } catch (err) {
      this.error('Failed to record energy sample', err);
    }
  }

  // ════════════════════════════════════════════════════════════════════
  //  HABIT STREAK TRACKING
  // ════════════════════════════════════════════════════════════════════

  /**
   * Check and update habit streaks for all users.
   * @private
   */
  _checkHabitStreaks() {
    try {
      const now = Date.now();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      for (const [userId, profile] of this.userProfiles) {
        if (!profile.patterns) continue;
        let streakData = this.habitStreaks.get(userId);
        if (!streakData) {
          streakData = { habits: {} };
          this.habitStreaks.set(userId, streakData);
        }

        for (const [type, pat] of Object.entries(profile.patterns)) {
          if (pat.sampleCount < 3) continue;

          if (!streakData.habits[type]) {
            streakData.habits[type] = {
              currentStreak: 0,
              longestStreak: 0,
              lastDate: null,
              isActive: false
            };
          }

          const habit = streakData.habits[type];
          const occurredToday = this._hasOccurredToday(userId, type, now);
          const todayStr = todayStart.toISOString().split('T')[0];

          if (occurredToday && habit.lastDate !== todayStr) {
            // Check if yesterday was also a streak day
            const yesterday = new Date(todayStart);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            if (habit.lastDate === yesterdayStr) {
              habit.currentStreak++;
            } else {
              habit.currentStreak = 1;
            }
            habit.lastDate = todayStr;
            habit.isActive = true;
            habit.longestStreak = Math.max(habit.longestStreak, habit.currentStreak);
          } else if (!occurredToday) {
            // Check if streak is broken (past the expected time + 2 stddev)
            const currentMinute = this._minuteOfDay(now);
            if (currentMinute > pat.averageMinuteOfDay + pat.stdDevMinutes * 2) {
              habit.isActive = false;
            }
          }
        }

        streakData.updatedAt = now;
      }
      this.emit('habitStreaksUpdated', { timestamp: now });
    } catch (err) {
      this.error('Habit streak check failed', err);
    }
  }

  // ════════════════════════════════════════════════════════════════════
  //  AUTOMATION SUGGESTION ENGINE
  // ════════════════════════════════════════════════════════════════════

  /**
   * Generate automation suggestions based on detected routines and patterns.
   * @private
   */
  _generateAutomationSuggestions() {
    try {
      const now = Date.now();
      const newSuggestions = [];

      for (const [key, routine] of this.routines) {
        if (routine.confidence < 0.6) continue;
        if (routine.sampleCount < 10) continue;

        // Check we haven't already suggested this routine
        const existingSuggestion = this.automationSuggestions.find(
          s => s.routineKey === key && !s.responded
        );
        if (existingSuggestion) continue;

        const timeStr = this._minutesToTimeStr(routine.averageMinuteOfDay);
        const suggestion = {
          id: this._uid(),
          routineKey: key,
          userId: routine.userId,
          title: `Automate "${routine.eventType}" routine`,
          description: `You consistently have a "${routine.eventType}" event around ${timeStr} on ${routine.dayBucket}s ` +
                        `(confidence: ${Math.round(routine.confidence * 100)}%). ` +
                        `Would you like to automate related home adjustments?`,
          confidence: routine.confidence,
          category: routine.eventType,
          suggestedActions: this._planActionsForPrediction(routine),
          createdAt: now,
          responded: false,
          accepted: null,
          respondedAt: null
        };
        newSuggestions.push(suggestion);
      }

      // Also generate cross-system recommendations
      this._generateCrossSystemRecommendations(now);

      // Merge and cap
      this.automationSuggestions = [
        ...this.automationSuggestions.filter(s => !s.responded),
        ...newSuggestions
      ].slice(-this.maxSuggestions);

      if (newSuggestions.length > 0) {
        this.emit('newSuggestions', newSuggestions);
        this.log(`Generated ${newSuggestions.length} new automation suggestion(s)`);
      }
    } catch (err) {
      this.error('Automation suggestion generation failed', err);
    }
  }

  /**
   * Generate cross-system optimisation recommendations.
   * @private
   * @param {number} now
   */
  _generateCrossSystemRecommendations(now) {
    try {
      const recs = [];

      // Energy + behaviour
      if (this.energyCorrelation.savingOpportunities.length > 0) {
        for (const opp of this.energyCorrelation.savingOpportunities) {
          recs.push({
            id: this._uid(),
            type: 'energy_saving',
            system: 'energy',
            crossSystem: 'behavior',
            description: opp.description,
            estimatedSavingPercent: opp.estimatedSavingPercent || 0,
            createdAt: now
          });
        }
      }

      // Circadian + lighting
      for (const [userId, model] of this.circadianModels) {
        if (model.chronotype === 'night-owl') {
          recs.push({
            id: this._uid(),
            type: 'circadian_alignment',
            system: 'lighting',
            crossSystem: 'circadian',
            description: `User ${userId} is a night-owl; consider blue-light filtering after ${this._minutesToTimeStr(model.bedTimeMinutes - 120)}.`,
            createdAt: now
          });
        }
      }

      // Context-aware: seasonal
      if (this.context.season === 'winter') {
        recs.push({
          id: this._uid(),
          type: 'seasonal',
          system: 'climate',
          crossSystem: 'weather',
          description: 'Winter detected — consider preheating before wake-up routines.',
          createdAt: now
        });
      }

      if (this.context.season === 'summer') {
        recs.push({
          id: this._uid(),
          type: 'seasonal',
          system: 'curtains',
          crossSystem: 'weather',
          description: 'Summer detected — close curtains during peak sun hours to reduce cooling load.',
          createdAt: now
        });
      }

      this.optimisationRecommendations = recs.slice(-100);
    } catch (err) {
      this.error('Cross-system recommendation generation failed', err);
    }
  }

  // ════════════════════════════════════════════════════════════════════
  //  DATA CLEANUP & PRIVACY
  // ════════════════════════════════════════════════════════════════════

  /**
   * Run periodic data cleanup — expire old data, anonymise where configured.
   * @private
   */
  _runDataCleanup() {
    try {
      const now = Date.now();
      const retentionMs = this.dataRetentionDays * 24 * 60 * 60 * 1000;
      const cutoff = now - retentionMs;

      // Trim behaviour log
      const beforeCount = this.behaviorLog.length;
      if (this.config.anonymiseDataOnExpiry) {
        this.behaviorLog = this.behaviorLog
          .map(e => {
            if (e.timestamp < cutoff) {
              return { ...e, userId: this._anonymise(e.userId), payload: {} };
            }
            return e;
          })
          .filter(e => e.timestamp >= cutoff - retentionMs);
      } else {
        this.behaviorLog = this.behaviorLog.filter(e => e.timestamp >= cutoff);
      }

      // Trim feedback log
      this.feedbackLog = this.feedbackLog.filter(f => f.timestamp >= cutoff);

      // Trim anomalies
      this.anomalies = this.anomalies.filter(a => a.timestamp >= cutoff);

      // Trim energy samples
      this.energyBehaviorSamples = this.energyBehaviorSamples.filter(s => s.timestamp >= cutoff);

      // Trim preference model observations
      for (const [, model] of this.preferenceModels) {
        for (const cat of Object.keys(model)) {
          if (cat.startsWith('_')) continue;
          if (Array.isArray(model[cat])) {
            model[cat] = model[cat].filter(o => o.timestamp >= cutoff);
          }
        }
      }

      const removedCount = beforeCount - this.behaviorLog.length;
      if (removedCount > 0) {
        this.log(`Data cleanup removed ${removedCount} expired behaviour events ` +
                  `(anonymise=${this.config.anonymiseDataOnExpiry})`);
      }
      this.emit('dataCleanupComplete', { removedCount, timestamp: now });
    } catch (err) {
      this.error('Data cleanup failed', err);
    }
  }

  /**
   * Anonymise a user ID.
   * @private
   * @param {string} userId
   * @returns {string}
   */
  _anonymise(userId) {
    if (!userId) return 'anon';
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
    }
    return `anon_${Math.abs(hash).toString(36)}`;
  }

  // ════════════════════════════════════════════════════════════════════
  //  PERSISTENCE (stub — delegates to Homey settings)
  // ════════════════════════════════════════════════════════════════════

  /**
   * Load persisted state from Homey settings.
   * @private
   * @returns {Promise<void>}
   */
  async _loadPersistedState() {
    try {
      if (this.homey && typeof this.homey.settings === 'object' && typeof this.homey.settings.get === 'function') {
        const raw = this.homey.settings.get('adaptiveLearningState');
        if (raw) {
          const state = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (state.behaviorLog) this.behaviorLog = state.behaviorLog;
          if (state.feedbackLog) this.feedbackLog = state.feedbackLog;
          if (state.confidenceThreshold) this.confidenceThreshold = state.confidenceThreshold;
          if (state.predictionAccuracy) this.predictionAccuracy = state.predictionAccuracy;
          if (state.temporalPatterns) this.temporalPatterns = state.temporalPatterns;
          this.log('Persisted state loaded successfully');
        }
      }
    } catch (err) {
      this.error('Failed to load persisted state', err);
    }
  }

  /**
   * Persist critical state to Homey settings.
   * @private
   */
  _persistState() {
    try {
      if (this.homey && typeof this.homey.settings === 'object' && typeof this.homey.settings.set === 'function') {
        const state = {
          behaviorLog: this.behaviorLog.slice(-5000),
          feedbackLog: this.feedbackLog.slice(-1000),
          confidenceThreshold: this.confidenceThreshold,
          predictionAccuracy: this.predictionAccuracy,
          temporalPatterns: this.temporalPatterns,
          savedAt: Date.now()
        };
        this.homey.settings.set('adaptiveLearningState', JSON.stringify(state));
        this.log('State persisted');
      }
    } catch (err) {
      this.error('Failed to persist state', err);
    }
  }

  // ════════════════════════════════════════════════════════════════════
  //  CONTEXT MANAGEMENT
  // ════════════════════════════════════════════════════════════════════

  /**
   * Refresh the current context state.
   * @private
   */
  _refreshContext() {
    try {
      const now = new Date();
      this.context.dayOfWeek = now.getDay();
      this.context.isWeekend = [0, 6].includes(now.getDay());
      this.context.season = this._currentSeason();
      this.context.timeOfDay = this._classifyTimeOfDay(now);
      this.context.isHoliday = this._isHoliday(now);
      this.context.sunPosition = this._estimateSunPosition(now);
      this.emit('contextRefreshed', this.context);
    } catch (err) {
      this.error('Context refresh failed', err);
    }
  }

  /**
   * Determine the current meteorological season.
   * @private
   * @returns {string}
   */
  _currentSeason() {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'autumn';
    return 'winter';
  }

  /**
   * Classify the time of day into a named bucket.
   * @private
   * @param {Date} date
   * @returns {string}
   */
  _classifyTimeOfDay(date) {
    const h = date.getHours();
    if (h >= 5 && h < 9) return 'early-morning';
    if (h >= 9 && h < 12) return 'morning';
    if (h >= 12 && h < 14) return 'midday';
    if (h >= 14 && h < 17) return 'afternoon';
    if (h >= 17 && h < 20) return 'evening';
    if (h >= 20 && h < 23) return 'night';
    return 'late-night';
  }

  /**
   * Basic holiday check (major Swedish/international holidays, extendable).
   * @private
   * @param {Date} date
   * @returns {boolean}
   */
  _isHoliday(date) {
    const mmdd = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const holidays = [
      '01-01', '01-06', '05-01', '06-06',
      '12-24', '12-25', '12-26', '12-31'
    ];
    return holidays.includes(mmdd);
  }

  /**
   * Rough sun-position estimate based on hour.
   * @private
   * @param {Date} date
   * @returns {string}
   */
  _estimateSunPosition(date) {
    const h = date.getHours();
    if (h >= 6 && h < 8) return 'rising';
    if (h >= 8 && h < 12) return 'morning-sky';
    if (h >= 12 && h < 14) return 'zenith';
    if (h >= 14 && h < 17) return 'afternoon-sky';
    if (h >= 17 && h < 20) return 'setting';
    return 'below-horizon';
  }

  // ════════════════════════════════════════════════════════════════════
  //  PREFERENCE RESOLUTION
  // ════════════════════════════════════════════════════════════════════

  /**
   * Resolve the current preferred setting for a category, blending learned
   * preferences with defaults and context.
   * @private
   * @param {string} userId
   * @param {string} category
   * @returns {object}
   */
  _resolvePreference(userId, category) {
    try {
      const model = this.preferenceModels.get(userId);
      const defaults = this.defaultPreferences[category] || {};
      if (!model || !model[category] || model[category].length === 0) {
        return { ...defaults };
      }

      // Use exponentially-weighted recent observations
      const observations = model[category].slice(-50);
      const weights = observations.map((_, i) => Math.pow(0.97, observations.length - 1 - i));
      const totalWeight = weights.reduce((a, b) => a + b, 0);

      // Average numeric fields
      const result = {};
      const numericKeys = Object.keys(observations[0].values || {}).filter(
        k => typeof observations[0].values[k] === 'number'
      );
      for (const key of numericKeys) {
        let wSum = 0;
        for (let i = 0; i < observations.length; i++) {
          const val = observations[i].values?.[key];
          if (typeof val === 'number') {
            wSum += val * weights[i];
          }
        }
        result[key] = Math.round((wSum / totalWeight) * 10) / 10;
      }

      return { ...defaults, ...result };
    } catch (err) {
      this.error(`Preference resolution failed for ${userId}/${category}`, err);
      return { ...(this.defaultPreferences[category] || {}) };
    }
  }

  // ════════════════════════════════════════════════════════════════════
  //  TEMPORAL PATTERN HELPERS
  // ════════════════════════════════════════════════════════════════════

  /**
   * Update temporal pattern data for a user event.
   * @private
   * @param {string} userId
   * @param {string} eventType
   * @param {number} timestamp
   */
  _updateTemporalPattern(userId, eventType, timestamp) {
    try {
      const d = new Date(timestamp);
      const bucket = [0, 6].includes(d.getDay()) ? 'weekend' : 'weekday';
      const minute = d.getHours() * 60 + d.getMinutes();

      if (this.temporalPatterns[bucket] && this.temporalPatterns[bucket][eventType]) {
        this.temporalPatterns[bucket][eventType].push({
          minute,
          userId,
          timestamp
        });
        // Cap
        if (this.temporalPatterns[bucket][eventType].length > 500) {
          this.temporalPatterns[bucket][eventType] =
            this.temporalPatterns[bucket][eventType].slice(-500);
        }
      }

      // Seasonal
      const season = this._currentSeason();
      if (!this.temporalPatterns.seasonal[season][eventType]) {
        this.temporalPatterns.seasonal[season][eventType] = [];
      }
      this.temporalPatterns.seasonal[season][eventType].push({
        minute,
        userId,
        timestamp
      });
      if (this.temporalPatterns.seasonal[season][eventType].length > 300) {
        this.temporalPatterns.seasonal[season][eventType] =
          this.temporalPatterns.seasonal[season][eventType].slice(-300);
      }
    } catch (err) {
      this.error('Temporal pattern update failed', err);
    }
  }

  // ════════════════════════════════════════════════════════════════════
  //  USER PROFILE & MODEL HELPERS
  // ════════════════════════════════════════════════════════════════════

  /**
   * Ensure a user profile exists.
   * @private
   * @param {string} userId
   */
  _ensureUserProfile(userId) {
    if (!this.userProfiles.has(userId)) {
      this.userProfiles.set(userId, {
        userId,
        createdAt: Date.now(),
        patterns: {},
        preferences: {},
        lastSeen: Date.now()
      });
      this.log(`Created user profile: ${userId}`);
    } else {
      this.userProfiles.get(userId).lastSeen = Date.now();
    }
  }

  /**
   * Ensure a preference model exists for a user.
   * @private
   * @param {string} userId
   * @returns {object}
   */
  _ensurePreferenceModel(userId) {
    if (!this.preferenceModels.has(userId)) {
      this.preferenceModels.set(userId, {});
    }
    return this.preferenceModels.get(userId);
  }

  // ════════════════════════════════════════════════════════════════════
  //  UTILITY HELPERS
  // ════════════════════════════════════════════════════════════════════

  /**
   * Generate a lightweight unique ID.
   * @private
   * @returns {string}
   */
  _uid() {
    return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Get the minute of day from a timestamp.
   * @private
   * @param {number} ts
   * @returns {number}
   */
  _minuteOfDay(ts) {
    const d = new Date(ts);
    return d.getHours() * 60 + d.getMinutes();
  }

  /**
   * Convert minutes-since-midnight to "HH:MM" string.
   * @private
   * @param {number} minutes
   * @returns {string}
   */
  _minutesToTimeStr(minutes) {
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  // ════════════════════════════════════════════════════════════════════
  //  LOGGING
  // ════════════════════════════════════════════════════════════════════

  /**
   * Log an informational message.
   * @param {...*} args
   */
  log(...args) {
    if (this.homey && typeof this.homey.log === 'function') {
      this.homey.log('[AdaptiveLearning]', ...args);
    }
  }

  /**
   * Log an error message.
   * @param {...*} args
   */
  error(...args) {
    if (this.homey && typeof this.homey.error === 'function') {
      this.homey.error('[AdaptiveLearning]', ...args);
    }
  }
}

module.exports = SmartHomeAdaptiveLearningSystem;
