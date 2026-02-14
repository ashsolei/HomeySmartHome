'use strict';

/**
 * @fileoverview Smart Home Predictive Cleaning & Maintenance Scheduling System
 * @description Predicts cleaning needs based on occupancy, air quality, and historical
 * patterns. Coordinates robot vacuums, tracks supplies, optimizes energy usage, and
 * adjusts schedules seasonally. Provides contamination scoring, effectiveness analytics,
 * and multi-floor coordination.
 * @version 1.0.0
 */

/**
 * @typedef {Object} RoomConfig
 * @property {string} id - Unique room identifier
 * @property {string} name - Human-readable room name
 * @property {number} floor - Floor number (0-indexed)
 * @property {string} surfaceType - 'hardwood' | 'carpet' | 'tile' | 'mixed'
 * @property {number} areaSqMeters - Room area in square meters
 * @property {boolean} hasPets - Whether pets frequent this room
 * @property {boolean} isKitchen - Whether cooking events occur here
 * @property {number} baseCleaningIntervalHours - Default cleaning interval
 */

/**
 * @typedef {Object} ContaminationScore
 * @property {number} dust - Dust particle concentration (0-100)
 * @property {number} humidity - Relative humidity deviation from ideal (0-100)
 * @property {number} footTraffic - Foot traffic intensity (0-100)
 * @property {number} petPresence - Pet contamination factor (0-100)
 * @property {number} cookingEvents - Cooking residue factor (0-100)
 * @property {number} composite - Weighted composite score (0-100)
 * @property {number} velocity - Rate of contamination change per hour
 */

/**
 * @typedef {Object} CleaningSupply
 * @property {string} id - Supply identifier
 * @property {string} name - Supply name
 * @property {number} currentLevel - Current level (0-100 percent)
 * @property {number} consumptionRate - Usage rate per cleaning cycle
 * @property {number} reorderThreshold - Level at which to alert for reorder
 * @property {string} lastRefilled - ISO timestamp of last refill
 */

/**
 * @typedef {Object} CleaningEvent
 * @property {string} roomId - Room that was cleaned
 * @property {string} type - 'daily' | 'deep' | 'spot' | 'guest_prep'
 * @property {number} prScore - Contamination score before cleaning
 * @property {number} postScore - Contamination score after cleaning
 * @property {number} effectiveness - Cleaning effectiveness percentage
 * @property {number} durationMinutes - Duration of cleaning
 * @property {number} energyUsedWh - Energy consumed in watt-hours
 * @property {string} timestamp - ISO timestamp
 */

const SURFACE_PROFILES = {
  hardwood: {
    baseIntervalHours: 48,
    deepCleanIntervalDays: 14,
    dustAccumulationRate: 0.6,
    moistureSensitivity: 0.8,
    cleaningDurationMultiplier: 0.9,
    recommendedProducts: ['wood_cleaner', 'microfiber_pads'],
  },
  carpet: {
    baseIntervalHours: 24,
    deepCleanIntervalDays: 30,
    dustAccumulationRate: 1.0,
    moistureSensitivity: 0.4,
    cleaningDurationMultiplier: 1.3,
    recommendedProducts: ['carpet_shampoo', 'vacuum_bags', 'stain_remover'],
  },
  tile: {
    baseIntervalHours: 72,
    deepCleanIntervalDays: 7,
    dustAccumulationRate: 0.4,
    moistureSensitivity: 0.2,
    cleaningDurationMultiplier: 0.8,
    recommendedProducts: ['tile_cleaner', 'grout_cleaner', 'mop_pads'],
  },
  mixed: {
    baseIntervalHours: 36,
    deepCleanIntervalDays: 14,
    dustAccumulationRate: 0.7,
    moistureSensitivity: 0.5,
    cleaningDurationMultiplier: 1.1,
    recommendedProducts: ['all_purpose_cleaner', 'vacuum_bags', 'mop_pads'],
  },
};

const SEASONAL_PROFILES = {
  spring: {
    label: 'Spring Cleaning',
    months: [2, 3, 4],
    frequencyMultiplier: 1.4,
    allergenBoost: 1.6,
    deepCleanTrigger: true,
    focusAreas: ['windows', 'carpets', 'upholstery', 'air_ducts'],
  },
  summer: {
    label: 'Summer Maintenance',
    months: [5, 6, 7],
    frequencyMultiplier: 1.1,
    allergenBoost: 1.2,
    deepCleanTrigger: false,
    focusAreas: ['kitchen', 'bathrooms', 'outdoor_tracked_dirt'],
  },
  fall: {
    label: 'Fall Preparation',
    months: [8, 9, 10],
    frequencyMultiplier: 1.3,
    allergenBoost: 1.4,
    deepCleanTrigger: true,
    focusAreas: ['heating_vents', 'carpets', 'entryways'],
  },
  winter: {
    label: 'Winter Upkeep',
    months: [11, 0, 1],
    frequencyMultiplier: 0.9,
    allergenBoost: 0.8,
    deepCleanTrigger: false,
    focusAreas: ['entryways', 'salt_tracked_areas', 'humidifier_zones'],
  },
};

const DEFAULT_SUPPLIES = [
  { id: 'detergent', name: 'All-Purpose Detergent', currentLevel: 100, consumptionRate: 2.5, reorderThreshold: 20, lastRefilled: null },
  { id: 'vacuum_bags', name: 'Vacuum Bags', currentLevel: 100, consumptionRate: 8, reorderThreshold: 15, lastRefilled: null },
  { id: 'hepa_filters', name: 'HEPA Filters', currentLevel: 100, consumptionRate: 1.0, reorderThreshold: 25, lastRefilled: null },
  { id: 'mop_pads', name: 'Disposable Mop Pads', currentLevel: 100, consumptionRate: 5, reorderThreshold: 20, lastRefilled: null },
  { id: 'wipes', name: 'Disinfecting Wipes', currentLevel: 100, consumptionRate: 4, reorderThreshold: 15, lastRefilled: null },
  { id: 'carpet_shampoo', name: 'Carpet Shampoo', currentLevel: 100, consumptionRate: 3, reorderThreshold: 20, lastRefilled: null },
  { id: 'glass_cleaner', name: 'Glass Cleaner', currentLevel: 100, consumptionRate: 1.5, reorderThreshold: 25, lastRefilled: null },
  { id: 'wood_cleaner', name: 'Wood Floor Cleaner', currentLevel: 100, consumptionRate: 2, reorderThreshold: 20, lastRefilled: null },
];

const OFF_PEAK_HOURS = [
  { start: 1, end: 6 },
  { start: 10, end: 14 },
  { start: 22, end: 24 },
];

const EMA_ALPHA = 0.3;
const CONTAMINATION_WEIGHTS = {
  dust: 0.30,
  humidity: 0.10,
  footTraffic: 0.25,
  petPresence: 0.20,
  cookingEvents: 0.15,
};

/**
 * Predictive Cleaning & Maintenance Scheduling System
 *
 * Uses sensor data, occupancy patterns, and historical trends to predict
 * when each room needs cleaning, then coordinates robot vacuums and
 * schedules maintenance windows during energy-optimal periods.
 */
class SmartHomePredictiveCleaningSystem {
  /**
   * @param {Object} homey - The Homey app instance
   */
  constructor(homey) {
    /** @type {Object} */
    this.homey = homey;

    /** @type {Map<string, RoomConfig>} */
    this.rooms = new Map();

    /** @type {Map<string, ContaminationScore>} */
    this.contaminationScores = new Map();

    /** @type {Map<string, number[]>} */
    this.contaminationHistory = new Map();

    /** @type {Map<string, number>} */
    this.emaScores = new Map();

    /** @type {Map<string, number>} */
    this.predictedNextCleaning = new Map();

    /** @type {CleaningEvent[]} */
    this.cleaningHistory = [];

    /** @type {CleaningSupply[]} */
    this.supplies = JSON.parse(JSON.stringify(DEFAULT_SUPPLIES));

    /** @type {Map<string, Object>} */
    this.robotVacuums = new Map();

    /** @type {Map<string, Object>} */
    this.obstacleMap = new Map();

    /** @type {Map<string, number[]>} */
    this.zonePriorities = new Map();

    /** @type {Object|null} */
    this.currentSeason = null;

    /** @type {Map<string, Object>} */
    this.floorPlans = new Map();

    /** @type {boolean} */
    this.guestMode = false;

    /** @type {string|null} */
    this.guestArrivalTime = null;

    /** @type {Map<string, number>} */
    this.allergenLevels = new Map();

    /** @type {Object} */
    this.energyPricing = { currentRate: 0.12, offPeakRate: 0.06, peakRate: 0.22 };

    /** @type {boolean} */
    this.initialized = false;

    /** @type {Object} */
    this._intervals = {
      contaminationScan: null,
      predictiveScheduler: null,
      supplyMonitor: null,
      seasonalCheck: null,
      allergenUpdate: null,
      analyticsAggregate: null,
      robotCoordination: null,
      deepCleanCheck: null,
    };

    /** @type {Object} */
    this._listeners = {};

    /** @type {number} */
    this._maxHistoryEntries = 5000;

    /** @type {number} */
    this._maxContaminationSamples = 500;

    this.log('SmartHomePredictiveCleaningSystem instance created');
  }

  // ─── Logging Helpers ────────────────────────────────────────────────

  /**
   * Log an informational message
   * @param {...*} args - Arguments to log
   */
  log(...args) {
    try {
      if (this.homey && typeof this.homey.log === 'function') {
        this.homey.log('[PredictiveCleaning]', ...args);
      }
    } catch (_) { /* silent */ }
  }

  /**
   * Log an error message
   * @param {...*} args - Arguments to log
   */
  error(...args) {
    try {
      if (this.homey && typeof this.homey.error === 'function') {
        this.homey.error('[PredictiveCleaning]', ...args);
      }
    } catch (_) { /* silent */ }
  }

  // ─── Initialization & Lifecycle ─────────────────────────────────────

  /**
   * Initialize the predictive cleaning system
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      this.log('Initializing Predictive Cleaning & Maintenance Scheduling System...');

      await this._loadPersistedState();
      this._initializeDefaultRooms();
      this._detectCurrentSeason();
      this._initializeAllergenTracking();
      this._initializeRobotVacuums();
      this._buildObstacleMap();
      this._initializeFloorPlans();
      this._startContaminationScanning();
      this._startPredictiveScheduler();
      this._startSupplyMonitoring();
      this._startSeasonalChecks();
      this._startAllergenUpdates();
      this._startAnalyticsAggregation();
      this._startRobotCoordination();
      this._startDeepCleanChecks();
      this._registerEventListeners();

      this.initialized = true;
      this.log('Predictive Cleaning System initialized successfully');
      this.log(`Tracking ${this.rooms.size} rooms across ${this.floorPlans.size} floors`);
      this.log(`Season: ${this.currentSeason ? this.currentSeason.label : 'unknown'}`);
      this.log(`Supplies tracked: ${this.supplies.length} items`);
    } catch (err) {
      this.error('Failed to initialize Predictive Cleaning System:', err.message);
      throw err;
    }
  }

  /**
   * Load persisted state from Homey settings
   * @returns {Promise<void>}
   * @private
   */
  async _loadPersistedState() {
    try {
      if (this.homey && typeof this.homey.settings === 'object') {
        const savedHistory = this.homey.settings.get('predictiveCleaning_history');
        if (savedHistory && Array.isArray(savedHistory)) {
          this.cleaningHistory = savedHistory.slice(-this._maxHistoryEntries);
          this.log(`Loaded ${this.cleaningHistory.length} historical cleaning events`);
        }

        const savedSupplies = this.homey.settings.get('predictiveCleaning_supplies');
        if (savedSupplies && Array.isArray(savedSupplies)) {
          this.supplies = savedSupplies;
          this.log('Restored supply inventory from storage');
        }

        const savedRooms = this.homey.settings.get('predictiveCleaning_rooms');
        if (savedRooms && typeof savedRooms === 'object') {
          for (const [id, config] of Object.entries(savedRooms)) {
            this.rooms.set(id, config);
          }
          this.log(`Restored ${this.rooms.size} room configurations`);
        }
      }
    } catch (err) {
      this.error('Error loading persisted state:', err.message);
    }
  }

  /**
   * Persist current state to Homey settings
   * @returns {Promise<void>}
   * @private
   */
  async _persistState() {
    try {
      if (this.homey && typeof this.homey.settings === 'object') {
        const trimmedHistory = this.cleaningHistory.slice(-this._maxHistoryEntries);
        this.homey.settings.set('predictiveCleaning_history', trimmedHistory);
        this.homey.settings.set('predictiveCleaning_supplies', this.supplies);

        const roomObj = {};
        for (const [id, config] of this.rooms) {
          roomObj[id] = config;
        }
        this.homey.settings.set('predictiveCleaning_rooms', roomObj);
      }
    } catch (err) {
      this.error('Error persisting state:', err.message);
    }
  }

  /**
   * Shut down the system, clearing all intervals and listeners
   */
  destroy() {
    try {
      this.log('Destroying Predictive Cleaning System...');

      for (const [key, intervalId] of Object.entries(this._intervals)) {
        if (intervalId) {
          clearInterval(intervalId);
          this._intervals[key] = null;
        }
      }

      this._unregisterEventListeners();
      this._persistState().catch((err) => {
        this.error('Error persisting state during destroy:', err.message);
      });

      this.guestMode = false;
      this.guestArrivalTime = null;
      this.initialized = false;

      this.log('Predictive Cleaning System destroyed');
    } catch (err) {
      this.error('Error during destroy:', err.message);
    }
  }

  // ─── Room Configuration ─────────────────────────────────────────────

  /**
   * Set up default rooms if none are configured
   * @private
   */
  _initializeDefaultRooms() {
    if (this.rooms.size > 0) return;

    const defaults = [
      { id: 'living_room', name: 'Living Room', floor: 0, surfaceType: 'carpet', areaSqMeters: 35, hasPets: false, isKitchen: false, baseCleaningIntervalHours: 24 },
      { id: 'kitchen', name: 'Kitchen', floor: 0, surfaceType: 'tile', areaSqMeters: 18, hasPets: false, isKitchen: true, baseCleaningIntervalHours: 12 },
      { id: 'master_bedroom', name: 'Master Bedroom', floor: 1, surfaceType: 'carpet', areaSqMeters: 22, hasPets: false, isKitchen: false, baseCleaningIntervalHours: 48 },
      { id: 'bathroom_main', name: 'Main Bathroom', floor: 0, surfaceType: 'tile', areaSqMeters: 8, hasPets: false, isKitchen: false, baseCleaningIntervalHours: 24 },
      { id: 'hallway', name: 'Hallway', floor: 0, surfaceType: 'hardwood', areaSqMeters: 12, hasPets: false, isKitchen: false, baseCleaningIntervalHours: 36 },
      { id: 'home_office', name: 'Home Office', floor: 1, surfaceType: 'hardwood', areaSqMeters: 15, hasPets: false, isKitchen: false, baseCleaningIntervalHours: 48 },
      { id: 'guest_room', name: 'Guest Room', floor: 1, surfaceType: 'carpet', areaSqMeters: 16, hasPets: false, isKitchen: false, baseCleaningIntervalHours: 168 },
      { id: 'dining_room', name: 'Dining Room', floor: 0, surfaceType: 'hardwood', areaSqMeters: 20, hasPets: false, isKitchen: false, baseCleaningIntervalHours: 36 },
      { id: 'laundry', name: 'Laundry Room', floor: 0, surfaceType: 'tile', areaSqMeters: 6, hasPets: false, isKitchen: false, baseCleaningIntervalHours: 72 },
      { id: 'entryway', name: 'Entryway', floor: 0, surfaceType: 'tile', areaSqMeters: 5, hasPets: false, isKitchen: false, baseCleaningIntervalHours: 12 },
    ];

    for (const room of defaults) {
      this.rooms.set(room.id, room);
      this.contaminationScores.set(room.id, this._createEmptyContaminationScore());
      this.contaminationHistory.set(room.id, []);
      this.emaScores.set(room.id, 0);
      this.predictedNextCleaning.set(room.id, Date.now() + room.baseCleaningIntervalHours * 3600000);
    }

    this.log(`Initialized ${defaults.length} default rooms`);
  }

  /**
   * Add or update a room configuration
   * @param {RoomConfig} config - Room configuration
   */
  addRoom(config) {
    try {
      if (!config || !config.id) {
        this.error('Invalid room configuration: missing id');
        return;
      }
      this.rooms.set(config.id, {
        ...config,
        surfaceType: config.surfaceType || 'mixed',
        baseCleaningIntervalHours: config.baseCleaningIntervalHours || 36,
      });
      if (!this.contaminationScores.has(config.id)) {
        this.contaminationScores.set(config.id, this._createEmptyContaminationScore());
        this.contaminationHistory.set(config.id, []);
        this.emaScores.set(config.id, 0);
        this.predictedNextCleaning.set(config.id, Date.now() + (config.baseCleaningIntervalHours || 36) * 3600000);
      }
      this.log(`Room configured: ${config.name || config.id}`);
    } catch (err) {
      this.error('Error adding room:', err.message);
    }
  }

  /**
   * Remove a room from tracking
   * @param {string} roomId - Room identifier
   */
  removeRoom(roomId) {
    try {
      this.rooms.delete(roomId);
      this.contaminationScores.delete(roomId);
      this.contaminationHistory.delete(roomId);
      this.emaScores.delete(roomId);
      this.predictedNextCleaning.delete(roomId);
      this.zonePriorities.delete(roomId);
      this.log(`Room removed: ${roomId}`);
    } catch (err) {
      this.error('Error removing room:', err.message);
    }
  }

  /**
   * Create a zeroed-out contamination score object
   * @returns {ContaminationScore}
   * @private
   */
  _createEmptyContaminationScore() {
    return {
      dust: 0,
      humidity: 0,
      footTraffic: 0,
      petPresence: 0,
      cookingEvents: 0,
      composite: 0,
      velocity: 0,
    };
  }

  // ─── Contamination Scoring ──────────────────────────────────────────

  /**
   * Start the contamination scanning interval
   * @private
   */
  _startContaminationScanning() {
    this._intervals.contaminationScan = setInterval(() => {
      this._scanAllRooms();
    }, 5 * 60 * 1000); // Every 5 minutes

    this.log('Contamination scanning started (5-min interval)');
  }

  /**
   * Scan all rooms and update contamination scores
   * @private
   */
  _scanAllRooms() {
    try {
      for (const [roomId, room] of this.rooms) {
        this._updateRoomContamination(roomId, room);
      }
    } catch (err) {
      this.error('Error during room scan:', err.message);
    }
  }

  /**
   * Update the contamination score for a single room
   * @param {string} roomId - Room identifier
   * @param {RoomConfig} room - Room configuration
   * @private
   */
  _updateRoomContamination(roomId, room) {
    try {
      const prevScore = this.contaminationScores.get(roomId) || this._createEmptyContaminationScore();
      const surfaceProfile = SURFACE_PROFILES[room.surfaceType] || SURFACE_PROFILES.mixed;
      const season = this.currentSeason || SEASONAL_PROFILES.summer;

      // Simulate sensor readings with gradual accumulation
      const hoursSinceInit = (Date.now() - (this._initTimestamp || Date.now())) / 3600000;
      const timeDecay = Math.min(hoursSinceInit * 0.01, 1);

      const dustDelta = surfaceProfile.dustAccumulationRate * (0.3 + Math.random() * 0.4) * season.frequencyMultiplier;
      const humidityReading = this._readHumiditySensor(roomId);
      const trafficReading = this._readFootTrafficSensor(roomId, room);
      const petReading = room.hasPets ? this._readPetPresenceSensor(roomId) : 0;
      const cookReading = room.isKitchen ? this._readCookingSensor(roomId) : 0;

      const newScore = {
        dust: Math.min(100, prevScore.dust + dustDelta),
        humidity: humidityReading,
        footTraffic: trafficReading,
        petPresence: petReading,
        cookingEvents: cookReading,
        composite: 0,
        velocity: 0,
      };

      // Apply allergen multiplier if pollen is high
      const allergenLevel = this.allergenLevels.get('pollen') || 0;
      if (allergenLevel > 50) {
        newScore.dust = Math.min(100, newScore.dust * (1 + allergenLevel / 200));
      }

      // Calculate composite score
      newScore.composite = this._calculateCompositeScore(newScore);

      // Calculate contamination velocity
      newScore.velocity = this._calculateContaminationVelocity(roomId, newScore.composite);

      // Update EMA
      const prevEma = this.emaScores.get(roomId) || 0;
      const newEma = EMA_ALPHA * newScore.composite + (1 - EMA_ALPHA) * prevEma;
      this.emaScores.set(roomId, newEma);

      // Store score
      this.contaminationScores.set(roomId, newScore);

      // Append to history
      const history = this.contaminationHistory.get(roomId) || [];
      history.push(newScore.composite);
      if (history.length > this._maxContaminationSamples) {
        history.splice(0, history.length - this._maxContaminationSamples);
      }
      this.contaminationHistory.set(roomId, history);
    } catch (err) {
      this.error(`Error updating contamination for ${roomId}:`, err.message);
    }
  }

  /**
   * Calculate the weighted composite contamination score
   * @param {ContaminationScore} score - Individual contamination readings
   * @returns {number} - Composite score (0-100)
   * @private
   */
  _calculateCompositeScore(score) {
    return Math.min(100, Math.max(0,
      score.dust * CONTAMINATION_WEIGHTS.dust +
      score.humidity * CONTAMINATION_WEIGHTS.humidity +
      score.footTraffic * CONTAMINATION_WEIGHTS.footTraffic +
      score.petPresence * CONTAMINATION_WEIGHTS.petPresence +
      score.cookingEvents * CONTAMINATION_WEIGHTS.cookingEvents
    ));
  }

  /**
   * Calculate how fast contamination is increasing per hour
   * @param {string} roomId - Room identifier
   * @param {number} currentComposite - Current composite score
   * @returns {number} - Contamination velocity (score points per hour)
   * @private
   */
  _calculateContaminationVelocity(roomId, currentComposite) {
    const history = this.contaminationHistory.get(roomId) || [];
    if (history.length < 2) return 0;

    const lookback = Math.min(12, history.length);
    const recentSlice = history.slice(-lookback);
    const oldest = recentSlice[0];
    const newest = currentComposite;
    const hoursElapsed = (lookback * 5) / 60; // 5-min intervals → hours

    return hoursElapsed > 0 ? (newest - oldest) / hoursElapsed : 0;
  }

  // ─── Sensor Readers (simulated / integration points) ────────────────

  /**
   * Read humidity deviation for a room
   * @param {string} roomId - Room identifier
   * @returns {number} - Humidity contamination factor (0-100)
   * @private
   */
  _readHumiditySensor(roomId) {
    try {
      // Integration point: read from actual humidity sensor
      // Simulated: ideal is 45%, deviation scored proportionally
      const simulated = 40 + Math.random() * 30; // 40–70%
      const deviation = Math.abs(simulated - 45);
      return Math.min(100, deviation * 3);
    } catch (err) {
      this.error(`Humidity sensor error for ${roomId}:`, err.message);
      return 0;
    }
  }

  /**
   * Read foot traffic intensity for a room
   * @param {string} roomId - Room identifier
   * @param {RoomConfig} room - Room configuration
   * @returns {number} - Foot traffic score (0-100)
   * @private
   */
  _readFootTrafficSensor(roomId, room) {
    try {
      // Integration point: read from motion sensor event count
      const hour = new Date().getHours();
      const isActiveHour = hour >= 7 && hour <= 22;
      const baseLine = isActiveHour ? 30 : 5;
      const entryMultiplier = roomId === 'entryway' || roomId === 'hallway' ? 2.0 : 1.0;
      const kitchenMultiplier = room.isKitchen && (hour >= 11 && hour <= 13 || hour >= 17 && hour <= 20) ? 1.8 : 1.0;

      return Math.min(100, baseLine * entryMultiplier * kitchenMultiplier + Math.random() * 15);
    } catch (err) {
      this.error(`Foot traffic sensor error for ${roomId}:`, err.message);
      return 0;
    }
  }

  /**
   * Read pet presence contamination factor
   * @param {string} roomId - Room identifier
   * @returns {number} - Pet contamination score (0-100)
   * @private
   */
  _readPetPresenceSensor(roomId) {
    try {
      // Integration point: pet activity tracker / motion sensor
      const basePresence = 20 + Math.random() * 30;
      const season = this.currentSeason || SEASONAL_PROFILES.summer;
      const sheddingMultiplier = (season === SEASONAL_PROFILES.spring || season === SEASONAL_PROFILES.fall) ? 1.5 : 1.0;
      return Math.min(100, basePresence * sheddingMultiplier);
    } catch (err) {
      this.error(`Pet sensor error for ${roomId}:`, err.message);
      return 0;
    }
  }

  /**
   * Read cooking event contamination factor
   * @param {string} roomId - Room identifier
   * @returns {number} - Cooking contamination score (0-100)
   * @private
   */
  _readCookingSensor(roomId) {
    try {
      // Integration point: air quality sensor in kitchen (VOCs, particulates)
      const hour = new Date().getHours();
      const isMealTime = (hour >= 7 && hour <= 9) || (hour >= 11 && hour <= 14) || (hour >= 17 && hour <= 21);
      const base = isMealTime ? 40 : 5;
      return Math.min(100, base + Math.random() * 20);
    } catch (err) {
      this.error(`Cooking sensor error for ${roomId}:`, err.message);
      return 0;
    }
  }

  // ─── Predictive Scheduling ──────────────────────────────────────────

  /**
   * Start the predictive scheduling loop
   * @private
   */
  _startPredictiveScheduler() {
    this._intervals.predictiveScheduler = setInterval(() => {
      this._runPredictiveScheduling();
    }, 15 * 60 * 1000); // Every 15 minutes

    this.log('Predictive scheduler started (15-min interval)');
  }

  /**
   * Run the predictive scheduling algorithm across all rooms
   * @private
   */
  _runPredictiveScheduling() {
    try {
      const now = Date.now();
      const roomPriorities = [];

      for (const [roomId, room] of this.rooms) {
        const score = this.contaminationScores.get(roomId);
        const ema = this.emaScores.get(roomId) || 0;
        const velocity = score ? score.velocity : 0;

        if (!score) continue;

        // Predict when score will reach cleaning threshold
        const threshold = this._getCleaningThreshold(room);
        const remainingCapacity = Math.max(0, threshold - ema);
        const hoursUntilDirty = velocity > 0.1 ? remainingCapacity / velocity : room.baseCleaningIntervalHours;

        const predictedTime = now + hoursUntilDirty * 3600000;
        this.predictedNextCleaning.set(roomId, predictedTime);

        // Calculate urgency
        const urgency = this._calculateCleaningUrgency(roomId, room, ema, velocity, threshold);

        roomPriorities.push({
          roomId,
          room,
          ema,
          velocity,
          predictedTime,
          urgency,
          threshold,
        });
      }

      // Sort by urgency descending
      roomPriorities.sort((a, b) => b.urgency - a.urgency);

      // Check if any rooms need immediate cleaning
      for (const entry of roomPriorities) {
        if (entry.urgency >= 80 && this._isEnergyOptimalTime()) {
          this._scheduleCleaning(entry.roomId, 'daily', entry.urgency);
        } else if (entry.urgency >= 95) {
          // Critical — clean regardless of energy pricing
          this._scheduleCleaning(entry.roomId, 'daily', entry.urgency);
        }
      }

      // Store zone priorities for robot coordination
      this.zonePriorities.set('current', roomPriorities.map((e) => e.roomId));
    } catch (err) {
      this.error('Error in predictive scheduling:', err.message);
    }
  }

  /**
   * Get the contamination threshold at which cleaning should be triggered
   * @param {RoomConfig} room - Room configuration
   * @returns {number} - Threshold score (0-100)
   * @private
   */
  _getCleaningThreshold(room) {
    const surfaceProfile = SURFACE_PROFILES[room.surfaceType] || SURFACE_PROFILES.mixed;
    let threshold = 60; // Base threshold

    // Carpet gets dirty faster, lower threshold
    if (room.surfaceType === 'carpet') threshold = 50;
    if (room.surfaceType === 'tile') threshold = 65;

    // Kitchen and entryway have lower thresholds
    if (room.isKitchen) threshold -= 10;
    if (room.id === 'entryway') threshold -= 10;

    // Guest mode lowers thresholds
    if (this.guestMode) threshold -= 15;

    // Seasonal adjustment
    const season = this.currentSeason;
    if (season && season.frequencyMultiplier > 1.2) {
      threshold -= 5;
    }

    return Math.max(20, Math.min(90, threshold));
  }

  /**
   * Calculate cleaning urgency for a room
   * @param {string} roomId - Room identifier
   * @param {RoomConfig} room - Room config
   * @param {number} ema - Current EMA contamination score
   * @param {number} velocity - Contamination velocity
   * @param {number} threshold - Cleaning threshold
   * @returns {number} - Urgency score (0-100)
   * @private
   */
  _calculateCleaningUrgency(roomId, room, ema, velocity, threshold) {
    let urgency = 0;

    // Base urgency from EMA vs threshold ratio
    urgency = (ema / threshold) * 70;

    // Velocity bonus — rapidly dirtying rooms need attention sooner
    if (velocity > 1) urgency += Math.min(15, velocity * 3);

    // Guest mode urgency boost for guest-facing rooms
    if (this.guestMode) {
      const guestRooms = ['living_room', 'guest_room', 'bathroom_main', 'kitchen', 'dining_room', 'entryway'];
      if (guestRooms.includes(roomId)) {
        urgency += 20;
      }
    }

    // Allergen urgency boost
    const pollenLevel = this.allergenLevels.get('pollen') || 0;
    if (pollenLevel > 60 && room.surfaceType === 'carpet') {
      urgency += 10;
    }

    return Math.min(100, Math.max(0, urgency));
  }

  /**
   * Check whether the current time falls in an off-peak energy window
   * @returns {boolean}
   * @private
   */
  _isEnergyOptimalTime() {
    const hour = new Date().getHours();
    return OFF_PEAK_HOURS.some((window) => hour >= window.start && hour < window.end);
  }

  /**
   * Schedule a cleaning event for a room
   * @param {string} roomId - Room identifier
   * @param {string} type - Cleaning type ('daily' | 'deep' | 'spot' | 'guest_prep')
   * @param {number} urgency - Urgency score that triggered the cleaning
   * @private
   */
  _scheduleCleaning(roomId, type, urgency) {
    try {
      const room = this.rooms.get(roomId);
      if (!room) return;

      const preScore = this.contaminationScores.get(roomId);
      const surfaceProfile = SURFACE_PROFILES[room.surfaceType] || SURFACE_PROFILES.mixed;
      const duration = this._estimateCleaningDuration(room, type);
      const energyUsed = this._estimateEnergyUsage(duration, type);

      this.log(`Scheduling ${type} cleaning for ${room.name} (urgency: ${urgency.toFixed(1)})`);

      // Dispatch robot vacuum if available
      this._dispatchRobotVacuum(roomId, type);

      // Simulate cleaning completion & effectiveness
      const effectiveness = this._simulateCleaningResult(roomId, type);

      // Consume supplies
      this._consumeSupplies(type, room.surfaceType, room.areaSqMeters);

      // Trigger ventilation after chemical cleaning
      if (type === 'deep') {
        this._triggerPostCleaningVentilation(roomId);
      }

      // Record event
      const event = {
        roomId,
        type,
        prScore: preScore ? preScore.composite : 0,
        postScore: preScore ? preScore.composite * (1 - effectiveness / 100) : 0,
        effectiveness,
        durationMinutes: duration,
        energyUsedWh: energyUsed,
        timestamp: new Date().toISOString(),
      };
      this.cleaningHistory.push(event);
      if (this.cleaningHistory.length > this._maxHistoryEntries) {
        this.cleaningHistory.splice(0, this.cleaningHistory.length - this._maxHistoryEntries);
      }

      // Reset contamination after cleaning
      this._resetContaminationAfterCleaning(roomId, effectiveness);

      // Update predictions
      const room2 = this.rooms.get(roomId);
      if (room2) {
        this.predictedNextCleaning.set(roomId, Date.now() + room2.baseCleaningIntervalHours * 3600000);
      }

      this.log(`${room.name} ${type} clean complete — effectiveness: ${effectiveness.toFixed(1)}%`);
    } catch (err) {
      this.error(`Error scheduling cleaning for ${roomId}:`, err.message);
    }
  }

  /**
   * Estimate cleaning duration in minutes
   * @param {RoomConfig} room - Room configuration
   * @param {string} type - Cleaning type
   * @returns {number} - Estimated minutes
   * @private
   */
  _estimateCleaningDuration(room, type) {
    const surfaceProfile = SURFACE_PROFILES[room.surfaceType] || SURFACE_PROFILES.mixed;
    const baseMinutesPerSqMeter = 1.2;
    let duration = room.areaSqMeters * baseMinutesPerSqMeter * surfaceProfile.cleaningDurationMultiplier;

    switch (type) {
      case 'deep':
        duration *= 2.5;
        break;
      case 'spot':
        duration *= 0.3;
        break;
      case 'guest_prep':
        duration *= 1.5;
        break;
      default: // daily
        break;
    }

    return Math.ceil(duration);
  }

  /**
   * Estimate energy usage in watt-hours
   * @param {number} durationMinutes - Cleaning duration
   * @param {string} type - Cleaning type
   * @returns {number} - Estimated Wh
   * @private
   */
  _estimateEnergyUsage(durationMinutes, type) {
    const basePowerWatts = type === 'deep' ? 1200 : 800;
    return Math.round((basePowerWatts * durationMinutes) / 60);
  }

  /**
   * Simulate cleaning result and return effectiveness percentage
   * @param {string} roomId - Room identifier
   * @param {string} type - Cleaning type
   * @returns {number} - Effectiveness (0-100)
   * @private
   */
  _simulateCleaningResult(roomId, type) {
    let baseEffectiveness;
    switch (type) {
      case 'deep':
        baseEffectiveness = 92;
        break;
      case 'guest_prep':
        baseEffectiveness = 88;
        break;
      case 'spot':
        baseEffectiveness = 60;
        break;
      default: // daily
        baseEffectiveness = 78;
    }

    // Add noise
    const noise = (Math.random() - 0.5) * 10;
    return Math.min(100, Math.max(40, baseEffectiveness + noise));
  }

  /**
   * Reset contamination scores after a cleaning event
   * @param {string} roomId - Room identifier
   * @param {number} effectiveness - Cleaning effectiveness percentage
   * @private
   */
  _resetContaminationAfterCleaning(roomId, effectiveness) {
    try {
      const factor = 1 - effectiveness / 100;
      const score = this.contaminationScores.get(roomId);
      if (!score) return;

      score.dust *= factor;
      score.humidity *= factor;
      score.footTraffic *= factor;
      score.petPresence *= factor;
      score.cookingEvents *= factor;
      score.composite = this._calculateCompositeScore(score);
      score.velocity = 0;

      this.contaminationScores.set(roomId, score);
      this.emaScores.set(roomId, score.composite);
    } catch (err) {
      this.error(`Error resetting contamination for ${roomId}:`, err.message);
    }
  }

  // ─── Robot Vacuum Integration ───────────────────────────────────────

  /**
   * Initialize robot vacuum devices
   * @private
   */
  _initializeRobotVacuums() {
    try {
      // Integration point: discover actual robot vacuum devices via Homey API
      this.robotVacuums.set('vacuum_01', {
        id: 'vacuum_01',
        name: 'Main Floor Vacuum',
        floor: 0,
        status: 'docked',
        batteryLevel: 100,
        dustbinLevel: 0,
        currentRoom: null,
        totalCleaningHours: 0,
        lastMaintenance: new Date().toISOString(),
      });

      this.robotVacuums.set('vacuum_02', {
        id: 'vacuum_02',
        name: 'Upper Floor Vacuum',
        floor: 1,
        status: 'docked',
        batteryLevel: 100,
        dustbinLevel: 0,
        currentRoom: null,
        totalCleaningHours: 0,
        lastMaintenance: new Date().toISOString(),
      });

      this.log(`Initialized ${this.robotVacuums.size} robot vacuums`);
    } catch (err) {
      this.error('Error initializing robot vacuums:', err.message);
    }
  }

  /**
   * Build the obstacle map for robot navigation
   * @private
   */
  _buildObstacleMap() {
    try {
      for (const [roomId, room] of this.rooms) {
        this.obstacleMap.set(roomId, {
          permanentObstacles: [],
          temporaryObstacles: [],
          noGoZones: [],
          lastUpdated: new Date().toISOString(),
        });
      }
      this.log('Obstacle map initialized');
    } catch (err) {
      this.error('Error building obstacle map:', err.message);
    }
  }

  /**
   * Dispatch a robot vacuum to clean a room
   * @param {string} roomId - Room identifier
   * @param {string} cleanType - Type of cleaning
   * @private
   */
  _dispatchRobotVacuum(roomId, cleanType) {
    try {
      const room = this.rooms.get(roomId);
      if (!room) return;

      // Find available vacuum on the correct floor
      let selectedVacuum = null;
      for (const [vacId, vac] of this.robotVacuums) {
        if (vac.floor === room.floor && vac.status === 'docked' && vac.batteryLevel > 20) {
          selectedVacuum = vac;
          break;
        }
      }

      if (!selectedVacuum) {
        this.log(`No available vacuum for ${room.name} on floor ${room.floor}`);
        return;
      }

      // Determine suction power based on surface type and clean type
      const suctionLevel = this._determineSuctionLevel(room.surfaceType, cleanType);

      selectedVacuum.status = 'cleaning';
      selectedVacuum.currentRoom = roomId;

      this.log(`Dispatching ${selectedVacuum.name} to ${room.name} (suction: ${suctionLevel})`);

      // Simulate cleaning completion after duration
      const duration = this._estimateCleaningDuration(room, cleanType);
      setTimeout(() => {
        this._completeVacuumRun(selectedVacuum.id, roomId, duration);
      }, Math.min(duration * 1000, 60000)); // Accelerated for simulation
    } catch (err) {
      this.error(`Error dispatching vacuum to ${roomId}:`, err.message);
    }
  }

  /**
   * Determine robot vacuum suction level
   * @param {string} surfaceType - Room surface type
   * @param {string} cleanType - Type of cleaning
   * @returns {string} - 'low' | 'medium' | 'high' | 'max'
   * @private
   */
  _determineSuctionLevel(surfaceType, cleanType) {
    if (cleanType === 'deep') return 'max';
    if (cleanType === 'spot') return 'high';

    switch (surfaceType) {
      case 'carpet': return 'high';
      case 'hardwood': return 'low';
      case 'tile': return 'medium';
      default: return 'medium';
    }
  }

  /**
   * Handle vacuum run completion
   * @param {string} vacuumId - Vacuum identifier
   * @param {string} roomId - Room that was cleaned
   * @param {number} durationMin - Cleaning duration in minutes
   * @private
   */
  _completeVacuumRun(vacuumId, roomId, durationMin) {
    try {
      const vac = this.robotVacuums.get(vacuumId);
      if (!vac) return;

      vac.status = 'returning';
      vac.currentRoom = null;
      vac.batteryLevel = Math.max(0, vac.batteryLevel - durationMin * 0.5);
      vac.dustbinLevel = Math.min(100, vac.dustbinLevel + durationMin * 0.8);
      vac.totalCleaningHours += durationMin / 60;

      // Return to dock
      setTimeout(() => {
        vac.status = 'docked';
        this.log(`${vac.name} returned to dock (battery: ${vac.batteryLevel.toFixed(0)}%, dustbin: ${vac.dustbinLevel.toFixed(0)}%)`);

        // Alert if dustbin is full
        if (vac.dustbinLevel >= 80) {
          this.log(`WARNING: ${vac.name} dustbin nearly full (${vac.dustbinLevel.toFixed(0)}%)`);
        }
      }, 5000);
    } catch (err) {
      this.error(`Error completing vacuum run for ${vacuumId}:`, err.message);
    }
  }

  /**
   * Start the robot coordination loop
   * @private
   */
  _startRobotCoordination() {
    this._intervals.robotCoordination = setInterval(() => {
      this._coordinateRobots();
    }, 10 * 60 * 1000); // Every 10 minutes

    this.log('Robot coordination started (10-min interval)');
  }

  /**
   * Coordinate multiple robot vacuums to avoid conflicts
   * @private
   */
  _coordinateRobots() {
    try {
      for (const [vacId, vac] of this.robotVacuums) {
        // Recharge monitoring
        if (vac.status === 'docked' && vac.batteryLevel < 100) {
          vac.batteryLevel = Math.min(100, vac.batteryLevel + 5); // Simulate charging
        }

        // Maintenance alerts
        if (vac.totalCleaningHours > 50) {
          const hoursSinceMaint = (Date.now() - new Date(vac.lastMaintenance).getTime()) / 3600000;
          if (hoursSinceMaint > 168) { // 1 week
            this.log(`Maintenance advisory: ${vac.name} has ${vac.totalCleaningHours.toFixed(1)} hours since last service`);
          }
        }
      }
    } catch (err) {
      this.error('Error coordinating robots:', err.message);
    }
  }

  // ─── Multi-Floor Coordination ───────────────────────────────────────

  /**
   * Initialize floor plan data
   * @private
   */
  _initializeFloorPlans() {
    try {
      const floors = new Set();
      for (const [, room] of this.rooms) {
        floors.add(room.floor);
      }

      for (const floor of floors) {
        const roomsOnFloor = [];
        for (const [roomId, room] of this.rooms) {
          if (room.floor === floor) roomsOnFloor.push(roomId);
        }

        this.floorPlans.set(`floor_${floor}`, {
          floorNumber: floor,
          rooms: roomsOnFloor,
          totalAreaSqMeters: roomsOnFloor.reduce((sum, id) => {
            const r = this.rooms.get(id);
            return sum + (r ? r.areaSqMeters : 0);
          }, 0),
          hasVacuum: Array.from(this.robotVacuums.values()).some((v) => v.floor === floor),
        });
      }

      this.log(`Floor plans initialized: ${this.floorPlans.size} floors`);
    } catch (err) {
      this.error('Error initializing floor plans:', err.message);
    }
  }

  /**
   * Get a cleaning schedule optimized per floor to reduce vacuum transit time
   * @param {number} floorNumber - Floor number
   * @returns {Object[]} - Ordered list of rooms to clean with priorities
   */
  getFloorCleaningSchedule(floorNumber) {
    try {
      const floorKey = `floor_${floorNumber}`;
      const plan = this.floorPlans.get(floorKey);
      if (!plan) return [];

      return plan.rooms
        .map((roomId) => ({
          roomId,
          room: this.rooms.get(roomId),
          score: this.contaminationScores.get(roomId),
          ema: this.emaScores.get(roomId) || 0,
          predicted: this.predictedNextCleaning.get(roomId),
        }))
        .sort((a, b) => b.ema - a.ema);
    } catch (err) {
      this.error('Error getting floor schedule:', err.message);
      return [];
    }
  }

  // ─── Seasonal Adjustment ────────────────────────────────────────────

  /**
   * Detect the current season based on month
   * @private
   */
  _detectCurrentSeason() {
    try {
      const month = new Date().getMonth();
      for (const [key, profile] of Object.entries(SEASONAL_PROFILES)) {
        if (profile.months.includes(month)) {
          this.currentSeason = profile;
          this.log(`Current season detected: ${profile.label}`);
          return;
        }
      }
      this.currentSeason = SEASONAL_PROFILES.summer;
    } catch (err) {
      this.error('Error detecting season:', err.message);
      this.currentSeason = SEASONAL_PROFILES.summer;
    }
  }

  /**
   * Start the seasonal check interval
   * @private
   */
  _startSeasonalChecks() {
    this._intervals.seasonalCheck = setInterval(() => {
      this._detectCurrentSeason();
      this._applySeasonalAdjustments();
    }, 24 * 60 * 60 * 1000); // Daily

    this.log('Seasonal checks started (daily interval)');
  }

  /**
   * Apply seasonal adjustments to cleaning schedules
   * @private
   */
  _applySeasonalAdjustments() {
    try {
      if (!this.currentSeason) return;

      const season = this.currentSeason;
      this.log(`Applying seasonal adjustments for ${season.label}`);

      // Trigger deep cleaning if season demands it
      if (season.deepCleanTrigger) {
        const lastDeepClean = this._getLastDeepCleanDate();
        const daysSinceDeep = lastDeepClean ? (Date.now() - lastDeepClean) / 86400000 : 999;

        if (daysSinceDeep > 30) {
          this.log(`Seasonal deep clean recommended (${daysSinceDeep.toFixed(0)} days since last)`);
          this._scheduleFullDeepClean();
        }
      }

      // Log focus areas for the season
      if (season.focusAreas && season.focusAreas.length > 0) {
        this.log(`Seasonal focus areas: ${season.focusAreas.join(', ')}`);
      }
    } catch (err) {
      this.error('Error applying seasonal adjustments:', err.message);
    }
  }

  /**
   * Get the date of the last deep cleaning event
   * @returns {number|null} - Timestamp or null
   * @private
   */
  _getLastDeepCleanDate() {
    for (let i = this.cleaningHistory.length - 1; i >= 0; i--) {
      if (this.cleaningHistory[i].type === 'deep') {
        return new Date(this.cleaningHistory[i].timestamp).getTime();
      }
    }
    return null;
  }

  /**
   * Schedule a full deep cleaning of all rooms
   * @private
   */
  _scheduleFullDeepClean() {
    try {
      this.log('Scheduling full-house deep cleaning cycle...');
      const sortedRooms = this._getRoomPriorityRanking();
      for (const entry of sortedRooms) {
        this._scheduleCleaning(entry.roomId, 'deep', 100);
      }
    } catch (err) {
      this.error('Error scheduling full deep clean:', err.message);
    }
  }

  // ─── Deep Cleaning Scheduler ────────────────────────────────────────

  /**
   * Start the deep cleaning check interval
   * @private
   */
  _startDeepCleanChecks() {
    this._intervals.deepCleanCheck = setInterval(() => {
      this._checkDeepCleanNeeds();
    }, 6 * 60 * 60 * 1000); // Every 6 hours

    this.log('Deep cleaning checks started (6-hour interval)');
  }

  /**
   * Check each room to determine if a deep clean is needed
   * @private
   */
  _checkDeepCleanNeeds() {
    try {
      for (const [roomId, room] of this.rooms) {
        const surfaceProfile = SURFACE_PROFILES[room.surfaceType] || SURFACE_PROFILES.mixed;
        const deepInterval = surfaceProfile.deepCleanIntervalDays * 86400000;

        // Find last deep clean for this room
        let lastDeepClean = 0;
        for (let i = this.cleaningHistory.length - 1; i >= 0; i--) {
          const evt = this.cleaningHistory[i];
          if (evt.roomId === roomId && evt.type === 'deep') {
            lastDeepClean = new Date(evt.timestamp).getTime();
            break;
          }
        }

        const elapsed = Date.now() - lastDeepClean;
        if (elapsed > deepInterval && this._isEnergyOptimalTime()) {
          this.log(`Deep clean overdue for ${room.name} (${(elapsed / 86400000).toFixed(1)} days)`);
          this._scheduleCleaning(roomId, 'deep', 85);
        }
      }
    } catch (err) {
      this.error('Error checking deep clean needs:', err.message);
    }
  }

  // ─── Cleaning Supply Inventory ──────────────────────────────────────

  /**
   * Start the supply monitoring interval
   * @private
   */
  _startSupplyMonitoring() {
    this._intervals.supplyMonitor = setInterval(() => {
      this._checkSupplyLevels();
    }, 60 * 60 * 1000); // Every hour

    this.log('Supply monitoring started (hourly interval)');
  }

  /**
   * Check all supply levels and emit warnings
   * @private
   */
  _checkSupplyLevels() {
    try {
      for (const supply of this.supplies) {
        if (supply.currentLevel <= 0) {
          this.log(`CRITICAL: ${supply.name} is depleted — cleaning efficiency degraded`);
        } else if (supply.currentLevel <= supply.reorderThreshold) {
          this.log(`LOW SUPPLY: ${supply.name} at ${supply.currentLevel.toFixed(1)}% — reorder recommended`);
        }
      }
    } catch (err) {
      this.error('Error checking supply levels:', err.message);
    }
  }

  /**
   * Consume cleaning supplies based on cleaning type and room
   * @param {string} cleanType - Type of cleaning
   * @param {string} surfaceType - Room surface type
   * @param {number} areaSqMeters - Room area
   * @private
   */
  _consumeSupplies(cleanType, surfaceType, areaSqMeters) {
    try {
      const areaFactor = areaSqMeters / 20; // Normalize to ~20 sqm reference room
      const typeMultiplier = cleanType === 'deep' ? 2.5 : cleanType === 'guest_prep' ? 1.5 : 1.0;

      for (const supply of this.supplies) {
        const consumption = supply.consumptionRate * areaFactor * typeMultiplier * 0.1;
        supply.currentLevel = Math.max(0, supply.currentLevel - consumption);
      }
    } catch (err) {
      this.error('Error consuming supplies:', err.message);
    }
  }

  /**
   * Refill a cleaning supply to full
   * @param {string} supplyId - Supply identifier
   */
  refillSupply(supplyId) {
    try {
      const supply = this.supplies.find((s) => s.id === supplyId);
      if (!supply) {
        this.error(`Supply not found: ${supplyId}`);
        return;
      }
      supply.currentLevel = 100;
      supply.lastRefilled = new Date().toISOString();
      this.log(`${supply.name} refilled to 100%`);
    } catch (err) {
      this.error('Error refilling supply:', err.message);
    }
  }

  /**
   * Get current supply levels
   * @returns {CleaningSupply[]}
   */
  getSupplyLevels() {
    return this.supplies.map((s) => ({ ...s }));
  }

  // ─── Allergen Tracking ──────────────────────────────────────────────

  /**
   * Initialize allergen tracking levels
   * @private
   */
  _initializeAllergenTracking() {
    try {
      this.allergenLevels.set('pollen', 0);
      this.allergenLevels.set('dust_mites', 0);
      this.allergenLevels.set('mold_spores', 0);
      this.allergenLevels.set('pet_dander', 0);
      this.log('Allergen tracking initialized');
    } catch (err) {
      this.error('Error initializing allergen tracking:', err.message);
    }
  }

  /**
   * Start the allergen update interval
   * @private
   */
  _startAllergenUpdates() {
    this._intervals.allergenUpdate = setInterval(() => {
      this._updateAllergenLevels();
    }, 30 * 60 * 1000); // Every 30 minutes

    this.log('Allergen updates started (30-min interval)');
  }

  /**
   * Update allergen levels based on season, weather, and sensors
   * @private
   */
  _updateAllergenLevels() {
    try {
      const season = this.currentSeason || SEASONAL_PROFILES.summer;
      const allergenBoost = season.allergenBoost || 1.0;

      // Simulate pollen levels (integration point: weather API)
      const basePollenByMonth = [10, 15, 40, 65, 80, 70, 50, 55, 60, 35, 15, 10];
      const month = new Date().getMonth();
      const pollen = Math.min(100, basePollenByMonth[month] * allergenBoost + (Math.random() - 0.5) * 10);
      this.allergenLevels.set('pollen', pollen);

      // Dust mite levels correlate with humidity
      const dustMites = 30 + Math.random() * 20;
      this.allergenLevels.set('dust_mites', dustMites);

      // Mold spores increase with humidity
      const moldSpores = 15 + Math.random() * 25;
      this.allergenLevels.set('mold_spores', moldSpores);

      // Pet dander
      const hasAnyPets = Array.from(this.rooms.values()).some((r) => r.hasPets);
      this.allergenLevels.set('pet_dander', hasAnyPets ? 30 + Math.random() * 30 : 5);

      // Trigger extra cleaning if allergens are critically high
      if (pollen > 75) {
        this.log(`High pollen alert (${pollen.toFixed(1)}) — increasing carpet cleaning frequency`);
      }
    } catch (err) {
      this.error('Error updating allergen levels:', err.message);
    }
  }

  /**
   * Get current allergen levels
   * @returns {Object} - Map of allergen types to levels
   */
  getAllergenLevels() {
    const levels = {};
    for (const [key, value] of this.allergenLevels) {
      levels[key] = Math.round(value * 10) / 10;
    }
    return levels;
  }

  // ─── Air Quality Integration ────────────────────────────────────────

  /**
   * Trigger ventilation after chemical cleaning to disperse fumes
   * @param {string} roomId - Room that was deep-cleaned
   * @private
   */
  _triggerPostCleaningVentilation(roomId) {
    try {
      const room = this.rooms.get(roomId);
      if (!room) return;

      this.log(`Triggering post-cleaning ventilation for ${room.name} (30-minute cycle)`);

      // Integration point: activate HVAC ventilation for the room zone
      // this.homey.emit('ventilation:activate', { roomId, durationMinutes: 30, mode: 'exhaust' });

      // Log the ventilation event
      this.log(`Ventilation scheduled: ${room.name} — exhaust mode for 30 minutes`);
    } catch (err) {
      this.error(`Error triggering ventilation for ${roomId}:`, err.message);
    }
  }

  // ─── Guest Arrival Preparation ──────────────────────────────────────

  /**
   * Activate guest preparation mode — triggers immediate cleaning of guest-facing areas
   * @param {string} arrivalTime - ISO timestamp of expected guest arrival
   * @param {string[]} [priorityRooms] - Specific rooms to prioritize
   */
  activateGuestMode(arrivalTime, priorityRooms) {
    try {
      this.guestMode = true;
      this.guestArrivalTime = arrivalTime;

      const hoursUntilArrival = (new Date(arrivalTime).getTime() - Date.now()) / 3600000;
      this.log(`Guest mode activated — arrival in ${hoursUntilArrival.toFixed(1)} hours`);

      // Default guest rooms if none specified
      const targetRooms = priorityRooms || [
        'living_room', 'guest_room', 'bathroom_main', 'kitchen', 'dining_room', 'entryway', 'hallway',
      ];

      // Schedule guest-prep cleaning for each target room
      for (const roomId of targetRooms) {
        if (this.rooms.has(roomId)) {
          this._scheduleCleaning(roomId, 'guest_prep', 90);
        }
      }

      this.log(`Guest preparation cleaning dispatched for ${targetRooms.length} rooms`);
    } catch (err) {
      this.error('Error activating guest mode:', err.message);
    }
  }

  /**
   * Deactivate guest preparation mode
   */
  deactivateGuestMode() {
    this.guestMode = false;
    this.guestArrivalTime = null;
    this.log('Guest mode deactivated');
  }

  // ─── Room Priority Ranking ──────────────────────────────────────────

  /**
   * Get rooms ranked by contamination velocity (fastest-dirtying first)
   * @returns {Object[]} - Ranked list of rooms with metrics
   */
  _getRoomPriorityRanking() {
    try {
      const ranking = [];
      for (const [roomId, room] of this.rooms) {
        const score = this.contaminationScores.get(roomId);
        const ema = this.emaScores.get(roomId) || 0;
        ranking.push({
          roomId,
          name: room.name,
          floor: room.floor,
          surfaceType: room.surfaceType,
          composite: score ? score.composite : 0,
          velocity: score ? score.velocity : 0,
          ema,
          predictedNext: this.predictedNextCleaning.get(roomId) || 0,
        });
      }

      ranking.sort((a, b) => b.velocity - a.velocity);
      return ranking;
    } catch (err) {
      this.error('Error computing priority ranking:', err.message);
      return [];
    }
  }

  /**
   * Get the public room priority ranking
   * @returns {Object[]}
   */
  getRoomPriorityRanking() {
    return this._getRoomPriorityRanking();
  }

  // ─── Cleaning History Analytics ─────────────────────────────────────

  /**
   * Start the analytics aggregation interval
   * @private
   */
  _startAnalyticsAggregation() {
    this._intervals.analyticsAggregate = setInterval(() => {
      this._aggregateAnalytics();
    }, 60 * 60 * 1000); // Every hour

    this.log('Analytics aggregation started (hourly interval)');
  }

  /**
   * Aggregate cleaning analytics for trend analysis
   * @private
   */
  _aggregateAnalytics() {
    try {
      if (this.cleaningHistory.length === 0) return;

      const last24h = Date.now() - 86400000;
      const recentEvents = this.cleaningHistory.filter(
        (e) => new Date(e.timestamp).getTime() > last24h
      );

      if (recentEvents.length > 0) {
        const avgEffectiveness = recentEvents.reduce((sum, e) => sum + e.effectiveness, 0) / recentEvents.length;
        const totalEnergy = recentEvents.reduce((sum, e) => sum + e.energyUsedWh, 0);
        const totalDuration = recentEvents.reduce((sum, e) => sum + e.durationMinutes, 0);

        this.log(`24h analytics: ${recentEvents.length} cleanings, avg effectiveness ${avgEffectiveness.toFixed(1)}%, energy ${totalEnergy}Wh, duration ${totalDuration}min`);
      }
    } catch (err) {
      this.error('Error aggregating analytics:', err.message);
    }
  }

  /**
   * Get cleaning trend data for visualization
   * @param {number} [days=7] - Number of days to look back
   * @returns {Object} - Trend analytics data
   */
  getCleaningTrends(days = 7) {
    try {
      const cutoff = Date.now() - days * 86400000;
      const relevantEvents = this.cleaningHistory.filter(
        (e) => new Date(e.timestamp).getTime() > cutoff
      );

      // Aggregate by day
      const dailyStats = {};
      for (const event of relevantEvents) {
        const dayKey = event.timestamp.substring(0, 10); // YYYY-MM-DD
        if (!dailyStats[dayKey]) {
          dailyStats[dayKey] = {
            date: dayKey,
            cleaningCount: 0,
            totalDuration: 0,
            totalEnergy: 0,
            avgEffectiveness: 0,
            effectivenessSum: 0,
            byType: { daily: 0, deep: 0, spot: 0, guest_prep: 0 },
          };
        }
        const day = dailyStats[dayKey];
        day.cleaningCount++;
        day.totalDuration += event.durationMinutes;
        day.totalEnergy += event.energyUsedWh;
        day.effectivenessSum += event.effectiveness;
        day.avgEffectiveness = day.effectivenessSum / day.cleaningCount;
        if (day.byType[event.type] !== undefined) {
          day.byType[event.type]++;
        }
      }

      // Aggregate by room
      const roomStats = {};
      for (const event of relevantEvents) {
        if (!roomStats[event.roomId]) {
          roomStats[event.roomId] = {
            roomId: event.roomId,
            cleaningCount: 0,
            avgEffectiveness: 0,
            effectivenessSum: 0,
            totalDuration: 0,
            totalEnergy: 0,
          };
        }
        const rs = roomStats[event.roomId];
        rs.cleaningCount++;
        rs.effectivenessSum += event.effectiveness;
        rs.avgEffectiveness = rs.effectivenessSum / rs.cleaningCount;
        rs.totalDuration += event.durationMinutes;
        rs.totalEnergy += event.energyUsedWh;
      }

      // Contamination trend per room
      const contaminationTrends = {};
      for (const [roomId, history] of this.contaminationHistory) {
        contaminationTrends[roomId] = {
          current: history.length > 0 ? history[history.length - 1] : 0,
          min: history.length > 0 ? Math.min(...history) : 0,
          max: history.length > 0 ? Math.max(...history) : 0,
          avg: history.length > 0 ? history.reduce((a, b) => a + b, 0) / history.length : 0,
          samples: history.length,
        };
      }

      return {
        period: { days, from: new Date(cutoff).toISOString(), to: new Date().toISOString() },
        totalEvents: relevantEvents.length,
        daily: Object.values(dailyStats),
        byRoom: Object.values(roomStats),
        contaminationTrends,
        supplySummary: this.getSupplyLevels(),
        allergenSnapshot: this.getAllergenLevels(),
      };
    } catch (err) {
      this.error('Error computing cleaning trends:', err.message);
      return { error: err.message };
    }
  }

  /**
   * Get effectiveness comparison data (before vs after)
   * @param {string} [roomId] - Optional room filter
   * @param {number} [limit=50] - Max events to return
   * @returns {Object[]} - List of effectiveness data points
   */
  getCleaningEffectivenessData(roomId, limit = 50) {
    try {
      let events = this.cleaningHistory;
      if (roomId) {
        events = events.filter((e) => e.roomId === roomId);
      }

      return events.slice(-limit).map((e) => ({
        roomId: e.roomId,
        type: e.type,
        prScore: Math.round(e.prScore * 10) / 10,
        postScore: Math.round(e.postScore * 10) / 10,
        effectiveness: Math.round(e.effectiveness * 10) / 10,
        durationMinutes: e.durationMinutes,
        timestamp: e.timestamp,
      }));
    } catch (err) {
      this.error('Error getting effectiveness data:', err.message);
      return [];
    }
  }

  // ─── Energy-Optimal Scheduling ──────────────────────────────────────

  /**
   * Get the next optimal cleaning window based on energy pricing
   * @returns {Object} - Optimal window information
   */
  getNextOptimalCleaningWindow() {
    try {
      const now = new Date();
      const currentHour = now.getHours();

      let nextWindow = null;
      let minWait = Infinity;

      for (const window of OFF_PEAK_HOURS) {
        let hoursUntil = window.start - currentHour;
        if (hoursUntil < 0) hoursUntil += 24;
        if (hoursUntil === 0 && currentHour < window.end) hoursUntil = 0;

        if (hoursUntil < minWait) {
          minWait = hoursUntil;
          nextWindow = window;
        }
      }

      const isCurrentlyOptimal = this._isEnergyOptimalTime();

      return {
        isCurrentlyOptimal,
        currentRate: isCurrentlyOptimal ? this.energyPricing.offPeakRate : this.energyPricing.peakRate,
        nextOptimalWindow: nextWindow,
        hoursUntilNextWindow: isCurrentlyOptimal ? 0 : minWait,
        offPeakRate: this.energyPricing.offPeakRate,
        peakRate: this.energyPricing.peakRate,
        estimatedSavingsPercent: Math.round((1 - this.energyPricing.offPeakRate / this.energyPricing.peakRate) * 100),
      };
    } catch (err) {
      this.error('Error calculating optimal window:', err.message);
      return { isCurrentlyOptimal: false, error: err.message };
    }
  }

  /**
   * Update energy pricing rates
   * @param {Object} pricing - New pricing object
   * @param {number} [pricing.offPeakRate] - Off-peak rate
   * @param {number} [pricing.peakRate] - Peak rate
   * @param {number} [pricing.currentRate] - Current rate
   */
  updateEnergyPricing(pricing) {
    try {
      if (pricing.offPeakRate !== undefined) this.energyPricing.offPeakRate = pricing.offPeakRate;
      if (pricing.peakRate !== undefined) this.energyPricing.peakRate = pricing.peakRate;
      if (pricing.currentRate !== undefined) this.energyPricing.currentRate = pricing.currentRate;
      this.log(`Energy pricing updated: off-peak=$${this.energyPricing.offPeakRate}, peak=$${this.energyPricing.peakRate}`);
    } catch (err) {
      this.error('Error updating energy pricing:', err.message);
    }
  }

  // ─── Event Listeners ────────────────────────────────────────────────

  /**
   * Register event listeners for external integrations
   * @private
   */
  _registerEventListeners() {
    try {
      if (!this.homey || typeof this.homey.on !== 'function') return;

      this._listeners.occupancyChange = (data) => {
        this._handleOccupancyChange(data);
      };
      this.homey.on('occupancy:change', this._listeners.occupancyChange);

      this._listeners.airQualityAlert = (data) => {
        this._handleAirQualityAlert(data);
      };
      this.homey.on('airQuality:alert', this._listeners.airQualityAlert);

      this._listeners.guestArrival = (data) => {
        this._handleGuestArrivalEvent(data);
      };
      this.homey.on('guest:arrival', this._listeners.guestArrival);

      this._listeners.cookingEvent = (data) => {
        this._handleCookingEvent(data);
      };
      this.homey.on('kitchen:cooking', this._listeners.cookingEvent);

      this._listeners.petActivity = (data) => {
        this._handlePetActivity(data);
      };
      this.homey.on('pet:activity', this._listeners.petActivity);

      this.log('Event listeners registered');
    } catch (err) {
      this.error('Error registering event listeners:', err.message);
    }
  }

  /**
   * Remove all event listeners
   * @private
   */
  _unregisterEventListeners() {
    try {
      if (!this.homey || typeof this.homey.off !== 'function') return;

      for (const [event, handler] of Object.entries(this._listeners)) {
        if (handler) {
          const eventName = {
            occupancyChange: 'occupancy:change',
            airQualityAlert: 'airQuality:alert',
            guestArrival: 'guest:arrival',
            cookingEvent: 'kitchen:cooking',
            petActivity: 'pet:activity',
          }[event];
          if (eventName) {
            this.homey.off(eventName, handler);
          }
        }
      }
      this._listeners = {};
      this.log('Event listeners unregistered');
    } catch (err) {
      this.error('Error unregistering event listeners:', err.message);
    }
  }

  /**
   * Handle occupancy change events
   * @param {Object} data - Occupancy data { roomId, occupantCount }
   * @private
   */
  _handleOccupancyChange(data) {
    try {
      if (!data || !data.roomId) return;
      const score = this.contaminationScores.get(data.roomId);
      if (score) {
        const trafficBoost = (data.occupantCount || 1) * 5;
        score.footTraffic = Math.min(100, score.footTraffic + trafficBoost);
        score.composite = this._calculateCompositeScore(score);
        this.contaminationScores.set(data.roomId, score);
      }
    } catch (err) {
      this.error('Error handling occupancy change:', err.message);
    }
  }

  /**
   * Handle air quality alerts — may trigger spot cleaning
   * @param {Object} data - Air quality data { roomId, pm25, vocs }
   * @private
   */
  _handleAirQualityAlert(data) {
    try {
      if (!data || !data.roomId) return;
      this.log(`Air quality alert for ${data.roomId}: PM2.5=${data.pm25}, VOCs=${data.vocs}`);

      if (data.pm25 > 50 || data.vocs > 400) {
        this._scheduleCleaning(data.roomId, 'spot', 75);
        this._triggerPostCleaningVentilation(data.roomId);
      }
    } catch (err) {
      this.error('Error handling air quality alert:', err.message);
    }
  }

  /**
   * Handle guest arrival event
   * @param {Object} data - Guest data { arrivalTime, roomPreferences }
   * @private
   */
  _handleGuestArrivalEvent(data) {
    try {
      if (data && data.arrivalTime) {
        this.activateGuestMode(data.arrivalTime, data.roomPreferences);
      }
    } catch (err) {
      this.error('Error handling guest arrival event:', err.message);
    }
  }

  /**
   * Handle cooking event — boosts kitchen contamination
   * @param {Object} data - Cooking data { intensity, duration }
   * @private
   */
  _handleCookingEvent(data) {
    try {
      const kitchenRooms = Array.from(this.rooms.entries())
        .filter(([, r]) => r.isKitchen)
        .map(([id]) => id);

      for (const roomId of kitchenRooms) {
        const score = this.contaminationScores.get(roomId);
        if (score) {
          const boost = (data && data.intensity) ? data.intensity * 10 : 15;
          score.cookingEvents = Math.min(100, score.cookingEvents + boost);
          score.composite = this._calculateCompositeScore(score);
          this.contaminationScores.set(roomId, score);
        }
      }
    } catch (err) {
      this.error('Error handling cooking event:', err.message);
    }
  }

  /**
   * Handle pet activity event
   * @param {Object} data - Pet data { roomId, activityLevel }
   * @private
   */
  _handlePetActivity(data) {
    try {
      if (!data || !data.roomId) return;
      const score = this.contaminationScores.get(data.roomId);
      if (score) {
        const boost = (data.activityLevel || 1) * 8;
        score.petPresence = Math.min(100, score.petPresence + boost);
        score.composite = this._calculateCompositeScore(score);
        this.contaminationScores.set(data.roomId, score);
      }
    } catch (err) {
      this.error('Error handling pet activity:', err.message);
    }
  }

  // ─── Obstacle Map Management ────────────────────────────────────────

  /**
   * Add an obstacle to a room's map
   * @param {string} roomId - Room identifier
   * @param {Object} obstacle - Obstacle { x, y, width, height, type, permanent }
   */
  addObstacle(roomId, obstacle) {
    try {
      const mapData = this.obstacleMap.get(roomId);
      if (!mapData) {
        this.error(`No obstacle map for room ${roomId}`);
        return;
      }

      if (obstacle.permanent) {
        mapData.permanentObstacles.push(obstacle);
      } else {
        mapData.temporaryObstacles.push(obstacle);
      }
      mapData.lastUpdated = new Date().toISOString();
      this.log(`Obstacle added to ${roomId}: ${obstacle.type || 'unknown'}`);
    } catch (err) {
      this.error('Error adding obstacle:', err.message);
    }
  }

  /**
   * Add a no-go zone to a room
   * @param {string} roomId - Room identifier
   * @param {Object} zone - Zone definition { x, y, width, height, reason }
   */
  addNoGoZone(roomId, zone) {
    try {
      const mapData = this.obstacleMap.get(roomId);
      if (!mapData) return;

      mapData.noGoZones.push(zone);
      mapData.lastUpdated = new Date().toISOString();
      this.log(`No-go zone added to ${roomId}: ${zone.reason || 'unspecified'}`);
    } catch (err) {
      this.error('Error adding no-go zone:', err.message);
    }
  }

  /**
   * Clear temporary obstacles from a room
   * @param {string} roomId - Room identifier
   */
  clearTemporaryObstacles(roomId) {
    try {
      const mapData = this.obstacleMap.get(roomId);
      if (!mapData) return;

      const removed = mapData.temporaryObstacles.length;
      mapData.temporaryObstacles = [];
      mapData.lastUpdated = new Date().toISOString();
      this.log(`Cleared ${removed} temporary obstacles from ${roomId}`);
    } catch (err) {
      this.error('Error clearing obstacles:', err.message);
    }
  }

  // ─── Public API: Manual Triggers ────────────────────────────────────

  /**
   * Manually trigger cleaning for a specific room
   * @param {string} roomId - Room identifier
   * @param {string} [type='daily'] - Cleaning type
   */
  triggerCleaning(roomId, type = 'daily') {
    try {
      if (!this.rooms.has(roomId)) {
        this.error(`Room not found: ${roomId}`);
        return;
      }
      this._scheduleCleaning(roomId, type, 100);
    } catch (err) {
      this.error('Error triggering manual cleaning:', err.message);
    }
  }

  /**
   * Update pet presence status for a room
   * @param {string} roomId - Room identifier
   * @param {boolean} hasPets - Whether pets are present
   */
  updatePetPresence(roomId, hasPets) {
    try {
      const room = this.rooms.get(roomId);
      if (room) {
        room.hasPets = hasPets;
        this.rooms.set(roomId, room);
        this.log(`Pet presence updated for ${room.name}: ${hasPets}`);
      }
    } catch (err) {
      this.error('Error updating pet presence:', err.message);
    }
  }

  // ─── Status & Diagnostics ──────────────────────────────────────────

  /**
   * Get comprehensive system status
   * @returns {Object} - Full system status object
   */
  getStatus() {
    try {
      const roomStatuses = {};
      for (const [roomId, room] of this.rooms) {
        const score = this.contaminationScores.get(roomId);
        const ema = this.emaScores.get(roomId) || 0;
        const predicted = this.predictedNextCleaning.get(roomId);

        roomStatuses[roomId] = {
          name: room.name,
          floor: room.floor,
          surfaceType: room.surfaceType,
          areaSqMeters: room.areaSqMeters,
          contamination: score ? {
            dust: Math.round(score.dust * 10) / 10,
            humidity: Math.round(score.humidity * 10) / 10,
            footTraffic: Math.round(score.footTraffic * 10) / 10,
            petPresence: Math.round(score.petPresence * 10) / 10,
            cookingEvents: Math.round(score.cookingEvents * 10) / 10,
            composite: Math.round(score.composite * 10) / 10,
            velocity: Math.round(score.velocity * 100) / 100,
          } : null,
          ema: Math.round(ema * 10) / 10,
          predictedNextCleaning: predicted ? new Date(predicted).toISOString() : null,
          threshold: this._getCleaningThreshold(room),
        };
      }

      const vacuumStatuses = {};
      for (const [vacId, vac] of this.robotVacuums) {
        vacuumStatuses[vacId] = {
          name: vac.name,
          floor: vac.floor,
          status: vac.status,
          batteryLevel: Math.round(vac.batteryLevel),
          dustbinLevel: Math.round(vac.dustbinLevel),
          totalCleaningHours: Math.round(vac.totalCleaningHours * 10) / 10,
        };
      }

      const lowSupplies = this.supplies.filter((s) => s.currentLevel <= s.reorderThreshold);

      return {
        initialized: this.initialized,
        timestamp: new Date().toISOString(),
        season: this.currentSeason ? this.currentSeason.label : 'Unknown',
        guestMode: this.guestMode,
        guestArrivalTime: this.guestArrivalTime,
        rooms: roomStatuses,
        roomCount: this.rooms.size,
        floorCount: this.floorPlans.size,
        vacuums: vacuumStatuses,
        supplies: {
          total: this.supplies.length,
          low: lowSupplies.length,
          lowItems: lowSupplies.map((s) => ({ id: s.id, name: s.name, level: Math.round(s.currentLevel) })),
        },
        allergens: this.getAllergenLevels(),
        energyOptimal: this._isEnergyOptimalTime(),
        nextOptimalWindow: this.getNextOptimalCleaningWindow(),
        cleaningHistoryCount: this.cleaningHistory.length,
        priorityRanking: this._getRoomPriorityRanking().slice(0, 5).map((r) => ({
          roomId: r.roomId,
          name: r.name,
          velocity: Math.round(r.velocity * 100) / 100,
          ema: Math.round(r.ema * 10) / 10,
        })),
        intervals: Object.fromEntries(
          Object.entries(this._intervals).map(([k, v]) => [k, v !== null])
        ),
      };
    } catch (err) {
      this.error('Error getting status:', err.message);
      return {
        initialized: this.initialized,
        error: err.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get a compact summary suitable for dashboard display
   * @returns {Object} - Summary object
   */
  getDashboardSummary() {
    try {
      const ranking = this._getRoomPriorityRanking();
      const dirtiestRoom = ranking.length > 0 ? ranking[0] : null;
      const cleanestRoom = ranking.length > 0 ? ranking[ranking.length - 1] : null;

      const last24h = Date.now() - 86400000;
      const recentCleanings = this.cleaningHistory.filter(
        (e) => new Date(e.timestamp).getTime() > last24h
      );
      const avgEffectiveness = recentCleanings.length > 0
        ? recentCleanings.reduce((s, e) => s + e.effectiveness, 0) / recentCleanings.length
        : 0;

      return {
        dirtiestRoom: dirtiestRoom ? { name: dirtiestRoom.name, score: Math.round(dirtiestRoom.ema) } : null,
        cleanestRoom: cleanestRoom ? { name: cleanestRoom.name, score: Math.round(cleanestRoom.ema) } : null,
        cleaningsLast24h: recentCleanings.length,
        avgEffectiveness24h: Math.round(avgEffectiveness),
        guestMode: this.guestMode,
        lowSupplies: this.supplies.filter((s) => s.currentLevel <= s.reorderThreshold).length,
        season: this.currentSeason ? this.currentSeason.label : 'N/A',
        allergenAlert: (this.allergenLevels.get('pollen') || 0) > 60,
      };
    } catch (err) {
      this.error('Error getting dashboard summary:', err.message);
      return { error: err.message };
    }
  }
}

module.exports = SmartHomePredictiveCleaningSystem;
