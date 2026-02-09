'use strict';

/**
 * SmartPetDoorActivitySystem
 * Comprehensive smart pet door and activity tracking system
 * Supports multi-door management, RFID pet identification, scheduling,
 * health correlation, intruder detection, GPS integration, and more.
 */

const DEFAULT_MONITORING_INTERVAL = 2 * 60 * 1000; // 2 minutes
const MAX_DOORS = 6;
const MAX_PETS = 12;
const MAX_ACTIVITY_EVENTS = 1000;
const MAX_CAMERA_CLIPS = 50;
const DOOR_COOLDOWN_MS = 30 * 1000; // 30 seconds
const CAMERA_CLIP_DURATION = 15; // seconds
const DEFAULT_GEOFENCE_RADIUS = 200; // meters
const CURFEW_GRACE_PERIOD_MINUTES = 10;

const DOOR_LOCATIONS = ['front', 'back', 'garage', 'deck', 'basement', 'balcony'];
const DOOR_SIZES = ['small', 'medium', 'large'];
const PET_SPECIES = ['cat', 'dog', 'rabbit'];
const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

class SmartPetDoorActivitySystem {
  constructor(homey) {
    this.homey = homey;

    // Door registry
    this.doors = new Map();

    // Pet registry
    this.pets = new Map();

    // Access schedules: Map<petId, Map<doorId, scheduleConfig>>
    this.accessSchedules = new Map();

    // Curfew configuration
    this.curfew = {
      enabled: false,
      globalTime: '22:00',
      gracePeriodMinutes: CURFEW_GRACE_PERIOD_MINUTES,
      petOverrides: new Map(),
      lastAlerts: new Map()
    };

    // Activity log (circular buffer)
    this.activityLog = [];
    this.activityLogMaxSize = MAX_ACTIVITY_EVENTS;

    // Pet location state
    this.petLocations = new Map(); // petId -> { inside: boolean, lastDoorId, lastDirection, lastTimestamp }

    // Time outside tracking: petId -> { currentSessionStart, totalTodayMs, dailyHistory[] }
    this.timeOutsideTracking = new Map();

    // GPS data: petId -> { enabled, lat, lng, lastUpdate, geofenceRadius, outsideGeofence }
    this.gpsData = new Map();

    // Health correlation data: petId -> { tripsToday, dailyTripsHistory[], weightHistory[], unusualBehaviorFlags[] }
    this.healthData = new Map();

    // Veterinary reminders: petId -> { vaccinations[], deworming[], appointments[], medications[], milestones[] }
    this.vetReminders = new Map();

    // Feeding integration: petId -> { mealsToday[], waterIntake, dailyHistory[], mealTimeRestrictions[] }
    this.feedingData = new Map();

    // Behavioral analytics: petId -> { rollingTrips[], favoriteDoor, peakHours{}, indoorOutdoorRatio, seasonalData{} }
    this.behavioralAnalytics = new Map();

    // Intruder detection state
    this.intruderDetection = {
      enabled: true,
      sizeFiltering: true,
      cameraTriggered: false,
      lastIntruderEvent: null,
      blockedAttempts: 0
    };

    // Night vision camera
    this.cameraClips = [];
    this.cameraConfig = {
      enabled: true,
      motionSensitivity: 0.7, // 0.0 - 1.0
      clipDuration: CAMERA_CLIP_DURATION,
      nightVisionEnabled: true,
      maxClips: MAX_CAMERA_CLIPS
    };

    // Weather rules
    this.weatherRules = {
      enabled: true,
      minTemperature: -10,
      maxTemperature: 35,
      blockDuringStorm: true,
      blockDuringHeavyRain: true,
      uvWarningForLightPets: true,
      currentWeather: null
    };

    // Emergency lockdown
    this.emergencyLockdown = {
      active: false,
      activatedAt: null,
      recallAlertSent: false,
      petsInsideDuringLockdown: [],
      petsOutsideDuringLockdown: []
    };

    // Neighbor notifications
    this.neighborNotifications = {
      enabled: false,
      neighbors: [],
      lostPetMode: {
        active: false,
        petId: null,
        activatedAt: null
      }
    };

    // Door maintenance tracking: doorId -> { usageCount, motorHealth, batteryReplacedAt, weathersealStatus, hingeLubricationDate }
    this.doorMaintenance = new Map();

    // Multi-pet coordination
    this.doorCooldowns = new Map(); // doorId -> lastOperationTimestamp
    this.simultaneousApproachQueue = [];

    // Monitoring
    this.monitoringInterval = null;
    this.monitoringIntervalMs = DEFAULT_MONITORING_INTERVAL;

    // Statistics
    this.stats = {
      totalDoorEvents: 0,
      totalIntruderBlocks: 0,
      totalCurfewAlerts: 0,
      totalWeatherBlocks: 0,
      totalEmergencyLockdowns: 0,
      systemStartedAt: null,
      lastMonitoringCycle: null
    };

    this.initialized = false;
  }

  /**
   * Initialize the pet door activity system
   */
  async initialize() {
    if (this.initialized) {
      this.log('System already initialized');
      return;
    }

    this.log('Initializing SmartPetDoorActivitySystem...');

    try {
      this._initializeDefaultDoors();
      this._initializeMonitoring();
      this._initializeDailyReset();

      this.stats.systemStartedAt = new Date().toISOString();
      this.initialized = true;

      this.log('SmartPetDoorActivitySystem initialized successfully');
      this.log(`Doors configured: ${this.doors.size}, Pets registered: ${this.pets.size}`);
      this.log(`Monitoring interval: ${this.monitoringIntervalMs / 1000}s`);
    } catch (err) {
      this.error(`Failed to initialize SmartPetDoorActivitySystem: ${err.message}`);
      throw err;
    }
  }

  // ─── DOOR MANAGEMENT ──────────────────────────────────────────────────

  _initializeDefaultDoors() {
    DOOR_LOCATIONS.forEach((location, index) => {
      this.registerDoor({
        id: `door_${location}`,
        location: location,
        size: 'medium',
        locked: true,
        batteryLevel: 100,
        installed: index < 2, // front and back installed by default
        enabled: index < 2
      });
    });
    this.log(`Default doors initialized: ${DOOR_LOCATIONS.length} locations configured`);
  }

  registerDoor(config) {
    if (this.doors.size >= MAX_DOORS) {
      this.error('Maximum number of doors reached');
      return { success: false, reason: 'max_doors_reached' };
    }

    const door = {
      id: config.id || `door_${Date.now()}`,
      location: config.location || 'front',
      size: DOOR_SIZES.includes(config.size) ? config.size : 'medium',
      locked: config.locked !== undefined ? config.locked : true,
      batteryLevel: config.batteryLevel || 100,
      installed: config.installed || false,
      enabled: config.enabled || false,
      lastOperation: null,
      lastOperationTimestamp: null,
      motorStatus: 'healthy',
      weathersealStatus: 'good',
      firmwareVersion: '1.0.0',
      createdAt: new Date().toISOString()
    };

    this.doors.set(door.id, door);

    // Initialize maintenance tracking
    this.doorMaintenance.set(door.id, {
      usageCount: 0,
      motorHealth: 100,
      batteryReplacedAt: new Date().toISOString(),
      weathersealStatus: 'good',
      hingeLubricationDate: new Date().toISOString(),
      lastInspection: null,
      estimatedMotorLifeRemaining: 50000
    });

    this.doorCooldowns.set(door.id, 0);

    this.log(`Door registered: ${door.id} at ${door.location} (size: ${door.size})`);
    return { success: true, door };
  }

  lockDoor(doorId) {
    const door = this.doors.get(doorId);
    if (!door) {
      this.error(`Door not found: ${doorId}`);
      return { success: false, reason: 'door_not_found' };
    }
    door.locked = true;
    door.lastOperation = 'lock';
    door.lastOperationTimestamp = Date.now();
    this.log(`Door locked: ${doorId}`);
    return { success: true };
  }

  unlockDoor(doorId) {
    const door = this.doors.get(doorId);
    if (!door) {
      this.error(`Door not found: ${doorId}`);
      return { success: false, reason: 'door_not_found' };
    }
    if (this.emergencyLockdown.active) {
      this.log(`Cannot unlock door ${doorId} during emergency lockdown`);
      return { success: false, reason: 'emergency_lockdown_active' };
    }
    door.locked = false;
    door.lastOperation = 'unlock';
    door.lastOperationTimestamp = Date.now();
    this.log(`Door unlocked: ${doorId}`);
    return { success: true };
  }

  getDoorStatus(doorId) {
    const door = this.doors.get(doorId);
    if (!door) return null;
    const maintenance = this.doorMaintenance.get(doorId) || {};
    return { ...door, maintenance };
  }

  getAllDoorStatuses() {
    const statuses = {};
    for (const [doorId] of this.doors) {
      statuses[doorId] = this.getDoorStatus(doorId);
    }
    return statuses;
  }

  setDoorSize(doorId, size) {
    const door = this.doors.get(doorId);
    if (!door) return { success: false, reason: 'door_not_found' };
    if (!DOOR_SIZES.includes(size)) return { success: false, reason: 'invalid_size' };
    door.size = size;
    this.log(`Door ${doorId} size set to ${size}`);
    return { success: true };
  }

  updateDoorBattery(doorId, level) {
    const door = this.doors.get(doorId);
    if (!door) return { success: false, reason: 'door_not_found' };
    door.batteryLevel = Math.max(0, Math.min(100, level));
    if (door.batteryLevel < 15) {
      this.log(`WARNING: Door ${doorId} battery low: ${door.batteryLevel}%`);
    }
    return { success: true, batteryLevel: door.batteryLevel };
  }

  // ─── PET REGISTRATION ─────────────────────────────────────────────────

  registerPet(config) {
    if (this.pets.size >= MAX_PETS) {
      this.error('Maximum number of pets reached');
      return { success: false, reason: 'max_pets_reached' };
    }

    if (!config.rfidTagId) {
      this.error('RFID tag ID required for pet registration');
      return { success: false, reason: 'rfid_required' };
    }

    // Check for duplicate RFID
    for (const [, pet] of this.pets) {
      if (pet.rfidTagId === config.rfidTagId) {
        this.error(`RFID tag ${config.rfidTagId} already registered`);
        return { success: false, reason: 'rfid_duplicate' };
      }
    }

    const pet = {
      id: config.id || `pet_${Date.now()}`,
      rfidTagId: config.rfidTagId,
      name: config.name || 'Unknown',
      species: PET_SPECIES.includes(config.species) ? config.species : 'cat',
      breed: config.breed || 'Unknown',
      weight: config.weight || 0,
      photoUrl: config.photoUrl || null,
      color: config.color || 'unknown',
      lightColored: config.lightColored || false,
      dateOfBirth: config.dateOfBirth || null,
      registeredDate: new Date().toISOString(),
      active: true,
      collarGpsEnabled: config.collarGpsEnabled || false
    };

    this.pets.set(pet.id, pet);

    // Initialize tracking data for this pet
    this.petLocations.set(pet.id, {
      inside: true,
      lastDoorId: null,
      lastDirection: null,
      lastTimestamp: null
    });

    this.timeOutsideTracking.set(pet.id, {
      currentSessionStart: null,
      totalTodayMs: 0,
      dailyHistory: []
    });

    this.gpsData.set(pet.id, {
      enabled: pet.collarGpsEnabled,
      lat: null,
      lng: null,
      lastUpdate: null,
      geofenceRadius: DEFAULT_GEOFENCE_RADIUS,
      outsideGeofence: false,
      homeLocation: { lat: null, lng: null }
    });

    this.healthData.set(pet.id, {
      tripsToday: 0,
      dailyTripsHistory: [],
      weightHistory: [{ weight: pet.weight, date: new Date().toISOString() }],
      unusualBehaviorFlags: [],
      averageTripsPerDay: 0,
      lastHealthCheck: null
    });

    this.vetReminders.set(pet.id, {
      vaccinations: [],
      deworming: [],
      appointments: [],
      medications: [],
      milestones: []
    });

    this.feedingData.set(pet.id, {
      mealsToday: [],
      waterIntakeMl: 0,
      dailyHistory: [],
      mealTimeRestrictions: [],
      targetCalories: 0,
      smartBowlConnected: false
    });

    this.behavioralAnalytics.set(pet.id, {
      rollingTrips: [],
      favoriteDoor: null,
      peakHours: {},
      indoorOutdoorRatio: 1.0,
      seasonalData: { spring: [], summer: [], autumn: [], winter: [] },
      averageTimeOutsideMinutes: 0,
      doorPreferences: {}
    });

    this.accessSchedules.set(pet.id, new Map());

    this.log(`Pet registered: ${pet.name} (${pet.species}, RFID: ${pet.rfidTagId})`);
    return { success: true, pet };
  }

  unregisterPet(petId) {
    if (!this.pets.has(petId)) {
      return { success: false, reason: 'pet_not_found' };
    }
    const pet = this.pets.get(petId);
    this.pets.delete(petId);
    this.petLocations.delete(petId);
    this.timeOutsideTracking.delete(petId);
    this.gpsData.delete(petId);
    this.healthData.delete(petId);
    this.vetReminders.delete(petId);
    this.feedingData.delete(petId);
    this.behavioralAnalytics.delete(petId);
    this.accessSchedules.delete(petId);
    this.log(`Pet unregistered: ${pet.name} (${petId})`);
    return { success: true };
  }

  getPetById(petId) {
    return this.pets.get(petId) || null;
  }

  getPetByRfid(rfidTagId) {
    for (const [, pet] of this.pets) {
      if (pet.rfidTagId === rfidTagId) return pet;
    }
    return null;
  }

  getAllPets() {
    return Array.from(this.pets.values());
  }

  updatePetWeight(petId, weight) {
    const pet = this.pets.get(petId);
    if (!pet) return { success: false, reason: 'pet_not_found' };
    pet.weight = weight;
    const health = this.healthData.get(petId);
    if (health) {
      health.weightHistory.push({ weight, date: new Date().toISOString() });
      if (health.weightHistory.length > 365) {
        health.weightHistory = health.weightHistory.slice(-365);
      }
    }
    this.log(`Pet ${pet.name} weight updated: ${weight}kg`);
    return { success: true };
  }

  // ─── ACCESS SCHEDULES ─────────────────────────────────────────────────

  setAccessSchedule(petId, doorId, schedule) {
    if (!this.pets.has(petId)) return { success: false, reason: 'pet_not_found' };
    if (!this.doors.has(doorId)) return { success: false, reason: 'door_not_found' };

    const petSchedules = this.accessSchedules.get(petId);
    if (!petSchedules) return { success: false, reason: 'schedule_map_missing' };

    const scheduleConfig = {
      doorId,
      petId,
      allowedHours: schedule.allowedHours || { start: '00:00', end: '23:59' },
      dayOfWeekVariations: schedule.dayOfWeekVariations || {},
      seasonalAdjustments: schedule.seasonalAdjustments || {},
      enabled: schedule.enabled !== undefined ? schedule.enabled : true,
      createdAt: new Date().toISOString()
    };

    // Validate allowed hours format
    if (!this._isValidTimeFormat(scheduleConfig.allowedHours.start) ||
        !this._isValidTimeFormat(scheduleConfig.allowedHours.end)) {
      return { success: false, reason: 'invalid_time_format' };
    }

    // Validate day of week variations
    for (const day of Object.keys(scheduleConfig.dayOfWeekVariations)) {
      if (!DAYS_OF_WEEK.includes(day)) {
        return { success: false, reason: `invalid_day: ${day}` };
      }
    }

    petSchedules.set(doorId, scheduleConfig);
    const pet = this.pets.get(petId);
    this.log(`Access schedule set for ${pet.name} at door ${doorId}: ${scheduleConfig.allowedHours.start}-${scheduleConfig.allowedHours.end}`);
    return { success: true, schedule: scheduleConfig };
  }

  getAccessSchedule(petId, doorId) {
    const petSchedules = this.accessSchedules.get(petId);
    if (!petSchedules) return null;
    return petSchedules.get(doorId) || null;
  }

  isAccessAllowed(petId, doorId, timestamp) {
    const now = timestamp ? new Date(timestamp) : new Date();
    const schedule = this.getAccessSchedule(petId, doorId);

    // No schedule means access is allowed
    if (!schedule || !schedule.enabled) return true;

    // Check curfew first
    if (this._isCurfewActive(petId, now)) return false;

    // Check weather restrictions
    if (this._isWeatherBlocked()) return false;

    // Check emergency lockdown
    if (this.emergencyLockdown.active) return false;

    // Get applicable hours for today
    const dayName = DAYS_OF_WEEK[now.getDay() === 0 ? 6 : now.getDay() - 1];
    const dayVariation = schedule.dayOfWeekVariations[dayName];
    const hours = dayVariation || schedule.allowedHours;

    // Get current season and check for seasonal adjustments
    const season = this._getCurrentSeason(now);
    const seasonalAdj = schedule.seasonalAdjustments[season];
    const effectiveHours = seasonalAdj || hours;

    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    return currentTime >= effectiveHours.start && currentTime <= effectiveHours.end;
  }

  _isValidTimeFormat(time) {
    return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
  }

  _getCurrentSeason(date) {
    const month = date.getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'autumn';
    return 'winter';
  }

  // ─── CURFEW MANAGEMENT ────────────────────────────────────────────────

  setCurfew(config) {
    this.curfew.enabled = config.enabled !== undefined ? config.enabled : true;
    this.curfew.globalTime = config.globalTime || '22:00';
    this.curfew.gracePeriodMinutes = config.gracePeriodMinutes || CURFEW_GRACE_PERIOD_MINUTES;
    this.log(`Curfew set: ${this.curfew.globalTime} (grace: ${this.curfew.gracePeriodMinutes}min)`);
    return { success: true, curfew: { ...this.curfew, petOverrides: undefined, lastAlerts: undefined } };
  }

  setCurfewOverride(petId, overrideTime) {
    if (!this.pets.has(petId)) return { success: false, reason: 'pet_not_found' };
    this.curfew.petOverrides.set(petId, overrideTime);
    const pet = this.pets.get(petId);
    this.log(`Curfew override for ${pet.name}: ${overrideTime}`);
    return { success: true };
  }

  _isCurfewActive(petId, now) {
    if (!this.curfew.enabled) return false;

    const curfewTime = this.curfew.petOverrides.get(petId) || this.curfew.globalTime;
    const [curfewHour, curfewMin] = curfewTime.split(':').map(Number);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const curfewMinutes = curfewHour * 60 + curfewMin;

    return currentMinutes >= curfewMinutes;
  }

  _checkCurfewCompliance() {
    if (!this.curfew.enabled) return;

    const now = new Date();
    const curfewTimeStr = this.curfew.globalTime;
    const [curfewHour, curfewMin] = curfewTimeStr.split(':').map(Number);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const curfewMinutes = curfewHour * 60 + curfewMin;
    const graceEnd = curfewMinutes + this.curfew.gracePeriodMinutes;

    if (currentMinutes < curfewMinutes) return;

    for (const [petId, location] of this.petLocations) {
      if (!location.inside) {
        const pet = this.pets.get(petId);
        if (!pet) continue;

        const petCurfew = this.curfew.petOverrides.get(petId);
        if (petCurfew) {
          const [pH, pM] = petCurfew.split(':').map(Number);
          if (currentMinutes < pH * 60 + pM) continue;
        }

        const alertKey = `${now.toDateString()}_${petId}`;
        const lastAlert = this.curfew.lastAlerts.get(petId);
        if (lastAlert !== alertKey) {
          this.curfew.lastAlerts.set(petId, alertKey);
          this.stats.totalCurfewAlerts++;

          if (currentMinutes >= graceEnd) {
            this.log(`CURFEW ALERT: ${pet.name} is still outside past curfew + grace period!`);
            this._lockAllDoorsInward();
          } else {
            this.log(`CURFEW WARNING: ${pet.name} is still outside. Grace period active.`);
          }
        }
      }
    }
  }

  _lockAllDoorsInward() {
    for (const [doorId, door] of this.doors) {
      if (door.enabled && door.installed) {
        door.locked = true;
        this.log(`Door ${doorId} locked for curfew compliance`);
      }
    }
  }

  // ─── ACTIVITY LOGGING ─────────────────────────────────────────────────

  logDoorEvent(petId, doorId, direction, confidence) {
    const pet = this.pets.get(petId);
    const door = this.doors.get(doorId);

    if (!pet || !door) {
      this.error(`Invalid door event: pet=${petId}, door=${doorId}`);
      return { success: false, reason: 'invalid_pet_or_door' };
    }

    // Check cooldown
    const lastOp = this.doorCooldowns.get(doorId) || 0;
    const now = Date.now();
    if (now - lastOp < DOOR_COOLDOWN_MS) {
      this.log(`Door ${doorId} in cooldown, event queued`);
      this.simultaneousApproachQueue.push({ petId, doorId, direction, confidence, timestamp: now });
      return { success: false, reason: 'cooldown_active' };
    }

    // Check access
    if (!this.isAccessAllowed(petId, doorId)) {
      this.log(`Access denied for ${pet.name} at ${doorId}`);
      return { success: false, reason: 'access_denied' };
    }

    const event = {
      id: `evt_${now}_${Math.random().toString(36).substr(2, 6)}`,
      petId,
      doorId,
      direction, // 'in' or 'out'
      timestamp: new Date(now).toISOString(),
      confidence: confidence || 1.0,
      petName: pet.name,
      doorLocation: door.location
    };

    // Add to activity log (circular buffer)
    this.activityLog.push(event);
    if (this.activityLog.length > this.activityLogMaxSize) {
      this.activityLog.shift();
    }

    // Update pet location
    const location = this.petLocations.get(petId);
    if (location) {
      location.inside = direction === 'in';
      location.lastDoorId = doorId;
      location.lastDirection = direction;
      location.lastTimestamp = event.timestamp;
    }

    // Update time outside tracking
    this._updateTimeOutside(petId, direction, now);

    // Update health data
    this._updateHealthData(petId, doorId, direction);

    // Update behavioral analytics
    this._updateBehavioralAnalytics(petId, doorId, direction, now);

    // Update door maintenance
    this._incrementDoorUsage(doorId);

    // Set cooldown
    this.doorCooldowns.set(doorId, now);

    this.stats.totalDoorEvents++;
    this.log(`Door event: ${pet.name} went ${direction} through ${door.location} door (confidence: ${confidence})`);

    return { success: true, event };
  }

  _updateTimeOutside(petId, direction, timestamp) {
    const tracking = this.timeOutsideTracking.get(petId);
    if (!tracking) return;

    if (direction === 'out') {
      tracking.currentSessionStart = timestamp;
    } else if (direction === 'in' && tracking.currentSessionStart) {
      const duration = timestamp - tracking.currentSessionStart;
      tracking.totalTodayMs += duration;
      tracking.currentSessionStart = null;
    }
  }

  _updateHealthData(petId, doorId, direction) {
    const health = this.healthData.get(petId);
    if (!health) return;

    if (direction === 'out') {
      health.tripsToday++;
    }

    // Check for unusual behavior
    if (health.dailyTripsHistory.length >= 7) {
      const avgTrips = health.dailyTripsHistory.slice(-7).reduce((a, b) => a + b, 0) / 7;
      health.averageTripsPerDay = avgTrips;

      if (health.tripsToday > avgTrips * 2.5) {
        const flag = {
          type: 'excessive_trips',
          date: new Date().toISOString(),
          value: health.tripsToday,
          average: avgTrips
        };
        health.unusualBehaviorFlags.push(flag);
        this.log(`Unusual behavior detected for pet ${petId}: excessive trips (${health.tripsToday} vs avg ${avgTrips.toFixed(1)})`);
      }
    }
  }

  _updateBehavioralAnalytics(petId, doorId, direction, timestamp) {
    const analytics = this.behavioralAnalytics.get(petId);
    if (!analytics) return;

    const date = new Date(timestamp);
    const hour = date.getHours();

    // Update rolling trips (last 7 days)
    analytics.rollingTrips.push({ timestamp, doorId, direction });
    const sevenDaysAgo = timestamp - (7 * 24 * 60 * 60 * 1000);
    analytics.rollingTrips = analytics.rollingTrips.filter(t => t.timestamp > sevenDaysAgo);

    // Update peak hours
    analytics.peakHours[hour] = (analytics.peakHours[hour] || 0) + 1;

    // Update door preferences
    analytics.doorPreferences[doorId] = (analytics.doorPreferences[doorId] || 0) + 1;

    // Determine favorite door
    let maxUsage = 0;
    let favDoor = null;
    for (const [did, count] of Object.entries(analytics.doorPreferences)) {
      if (count > maxUsage) {
        maxUsage = count;
        favDoor = did;
      }
    }
    analytics.favoriteDoor = favDoor;

    // Update indoor/outdoor ratio
    const tracking = this.timeOutsideTracking.get(petId);
    if (tracking) {
      const totalDayMs = 24 * 60 * 60 * 1000;
      const outsideMs = tracking.totalTodayMs;
      const insideMs = totalDayMs - outsideMs;
      analytics.indoorOutdoorRatio = insideMs > 0 ? outsideMs / insideMs : 0;
      analytics.averageTimeOutsideMinutes = outsideMs / 60000;
    }

    // Seasonal data
    const season = this._getCurrentSeason(date);
    analytics.seasonalData[season].push({ timestamp, doorId, direction });
    if (analytics.seasonalData[season].length > 1000) {
      analytics.seasonalData[season] = analytics.seasonalData[season].slice(-1000);
    }
  }

  getActivityLog(filters) {
    let events = [...this.activityLog];

    if (filters) {
      if (filters.petId) events = events.filter(e => e.petId === filters.petId);
      if (filters.doorId) events = events.filter(e => e.doorId === filters.doorId);
      if (filters.direction) events = events.filter(e => e.direction === filters.direction);
      if (filters.since) {
        const since = new Date(filters.since).getTime();
        events = events.filter(e => new Date(e.timestamp).getTime() >= since);
      }
      if (filters.limit) events = events.slice(-filters.limit);
    }

    return events;
  }

  // ─── INTRUDER / WILDLIFE DETECTION ────────────────────────────────────

  processRfidScan(doorId, rfidTagId, animalSize) {
    const door = this.doors.get(doorId);
    if (!door) return { success: false, reason: 'door_not_found' };

    const pet = this.getPetByRfid(rfidTagId);

    // Unknown RFID or no RFID
    if (!pet) {
      this.log(`INTRUDER ALERT: Unknown RFID ${rfidTagId || 'none'} at ${door.location} door`);
      this._handleIntruderDetection(doorId, rfidTagId, animalSize);
      return { success: false, reason: 'unknown_rfid', intruderAlert: true };
    }

    // Size-based filtering
    if (this.intruderDetection.sizeFiltering && animalSize) {
      const sizeMap = { small: 1, medium: 2, large: 3 };
      const doorSizeVal = sizeMap[door.size] || 2;
      const animalSizeVal = sizeMap[animalSize] || 2;
      if (animalSizeVal > doorSizeVal) {
        this.log(`Size filter: Animal too large (${animalSize}) for door ${doorId} (${door.size})`);
        this.lockDoor(doorId);
        return { success: false, reason: 'animal_too_large' };
      }
    }

    return { success: true, pet, door };
  }

  _handleIntruderDetection(doorId, rfidTagId, animalSize) {
    this.lockDoor(doorId);
    this.intruderDetection.blockedAttempts++;
    this.stats.totalIntruderBlocks++;

    this.intruderDetection.lastIntruderEvent = {
      doorId,
      rfidTagId,
      animalSize,
      timestamp: new Date().toISOString()
    };

    // Trigger camera
    if (this.cameraConfig.enabled) {
      this._triggerNightVisionCamera(doorId, 'intruder_detection');
    }

    this.log(`Intruder blocked at ${doorId}. Total blocks: ${this.intruderDetection.blockedAttempts}`);
  }

  // ─── GPS INTEGRATION ──────────────────────────────────────────────────

  updateGpsLocation(petId, lat, lng) {
    const gps = this.gpsData.get(petId);
    if (!gps) return { success: false, reason: 'pet_not_found' };
    if (!gps.enabled) return { success: false, reason: 'gps_not_enabled' };

    gps.lat = lat;
    gps.lng = lng;
    gps.lastUpdate = new Date().toISOString();

    // Check geofence
    if (gps.homeLocation.lat !== null && gps.homeLocation.lng !== null) {
      const distance = this._calculateDistance(lat, lng, gps.homeLocation.lat, gps.homeLocation.lng);
      const wasOutside = gps.outsideGeofence;
      gps.outsideGeofence = distance > gps.geofenceRadius;

      if (gps.outsideGeofence && !wasOutside) {
        const pet = this.pets.get(petId);
        this.log(`GEOFENCE ALERT: ${pet ? pet.name : petId} has left the geofence! Distance: ${distance.toFixed(0)}m`);
      }
    }

    return { success: true, outsideGeofence: gps.outsideGeofence };
  }

  setHomeLocation(petId, lat, lng) {
    const gps = this.gpsData.get(petId);
    if (!gps) return { success: false, reason: 'pet_not_found' };
    gps.homeLocation = { lat, lng };
    this.log(`Home location set for pet ${petId}: ${lat}, ${lng}`);
    return { success: true };
  }

  setGeofenceRadius(petId, radius) {
    const gps = this.gpsData.get(petId);
    if (!gps) return { success: false, reason: 'pet_not_found' };
    gps.geofenceRadius = radius;
    this.log(`Geofence radius for pet ${petId} set to ${radius}m`);
    return { success: true };
  }

  getLastKnownLocation(petId) {
    const gps = this.gpsData.get(petId);
    if (!gps) return null;
    return {
      lat: gps.lat,
      lng: gps.lng,
      lastUpdate: gps.lastUpdate,
      outsideGeofence: gps.outsideGeofence
    };
  }

  _calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000; // Earth radius in meters
    const dLat = this._toRad(lat2 - lat1);
    const dLng = this._toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this._toRad(lat1)) * Math.cos(this._toRad(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  _toRad(deg) {
    return deg * (Math.PI / 180);
  }

  // ─── WEATHER-AWARE RULES ──────────────────────────────────────────────

  updateWeatherData(weather) {
    this.weatherRules.currentWeather = {
      temperature: weather.temperature,
      condition: weather.condition,
      humidity: weather.humidity,
      windSpeed: weather.windSpeed,
      uvIndex: weather.uvIndex,
      precipitation: weather.precipitation,
      updatedAt: new Date().toISOString()
    };
    this.log(`Weather updated: ${weather.temperature}°C, ${weather.condition}`);

    // Check UV warning for light-colored pets
    if (this.weatherRules.uvWarningForLightPets && weather.uvIndex > 6) {
      for (const [petId, pet] of this.pets) {
        if (pet.lightColored) {
          this.log(`UV WARNING for ${pet.name}: UV index is ${weather.uvIndex}. Consider keeping indoors.`);
        }
      }
    }

    return { success: true };
  }

  _isWeatherBlocked() {
    if (!this.weatherRules.enabled || !this.weatherRules.currentWeather) return false;

    const weather = this.weatherRules.currentWeather;

    if (weather.temperature < this.weatherRules.minTemperature) {
      this.stats.totalWeatherBlocks++;
      return true;
    }
    if (weather.temperature > this.weatherRules.maxTemperature) {
      this.stats.totalWeatherBlocks++;
      return true;
    }
    if (this.weatherRules.blockDuringStorm && weather.condition === 'storm') {
      this.stats.totalWeatherBlocks++;
      return true;
    }
    if (this.weatherRules.blockDuringHeavyRain && weather.condition === 'heavy_rain') {
      this.stats.totalWeatherBlocks++;
      return true;
    }

    return false;
  }

  // ─── MULTI-PET COORDINATION ───────────────────────────────────────────

  getPetsInsideOutside() {
    const inside = [];
    const outside = [];

    for (const [petId, location] of this.petLocations) {
      const pet = this.pets.get(petId);
      if (!pet) continue;
      if (location.inside) {
        inside.push({ petId, name: pet.name, since: location.lastTimestamp });
      } else {
        outside.push({ petId, name: pet.name, since: location.lastTimestamp });
      }
    }

    return { inside, outside };
  }

  _processApproachQueue() {
    if (this.simultaneousApproachQueue.length === 0) return;

    const now = Date.now();
    const readyEvents = [];

    for (let i = this.simultaneousApproachQueue.length - 1; i >= 0; i--) {
      const queued = this.simultaneousApproachQueue[i];
      const lastOp = this.doorCooldowns.get(queued.doorId) || 0;
      if (now - lastOp >= DOOR_COOLDOWN_MS) {
        readyEvents.push(queued);
        this.simultaneousApproachQueue.splice(i, 1);
      }
    }

    for (const event of readyEvents) {
      this.logDoorEvent(event.petId, event.doorId, event.direction, event.confidence);
    }
  }

  // ─── VETERINARY REMINDERS ─────────────────────────────────────────────

  addVaccination(petId, vaccination) {
    const reminders = this.vetReminders.get(petId);
    if (!reminders) return { success: false, reason: 'pet_not_found' };

    reminders.vaccinations.push({
      id: `vax_${Date.now()}`,
      name: vaccination.name,
      dateAdministered: vaccination.dateAdministered || new Date().toISOString(),
      nextDue: vaccination.nextDue,
      veterinarian: vaccination.veterinarian || null,
      notes: vaccination.notes || ''
    });

    this.log(`Vaccination recorded for pet ${petId}: ${vaccination.name}`);
    return { success: true };
  }

  addDewormingSchedule(petId, schedule) {
    const reminders = this.vetReminders.get(petId);
    if (!reminders) return { success: false, reason: 'pet_not_found' };

    reminders.deworming.push({
      id: `dew_${Date.now()}`,
      product: schedule.product,
      dateAdministered: schedule.dateAdministered || new Date().toISOString(),
      nextDue: schedule.nextDue,
      intervalDays: schedule.intervalDays || 90
    });

    return { success: true };
  }

  addVetAppointment(petId, appointment) {
    const reminders = this.vetReminders.get(petId);
    if (!reminders) return { success: false, reason: 'pet_not_found' };

    reminders.appointments.push({
      id: `apt_${Date.now()}`,
      date: appointment.date,
      veterinarian: appointment.veterinarian,
      reason: appointment.reason,
      clinic: appointment.clinic || null,
      completed: false,
      notes: appointment.notes || ''
    });

    this.log(`Vet appointment scheduled for pet ${petId}: ${appointment.reason} on ${appointment.date}`);
    return { success: true };
  }

  addMedication(petId, medication) {
    const reminders = this.vetReminders.get(petId);
    if (!reminders) return { success: false, reason: 'pet_not_found' };

    reminders.medications.push({
      id: `med_${Date.now()}`,
      name: medication.name,
      dosage: medication.dosage,
      frequency: medication.frequency,
      startDate: medication.startDate || new Date().toISOString(),
      endDate: medication.endDate || null,
      administeredHistory: [],
      active: true
    });

    return { success: true };
  }

  addHealthMilestone(petId, milestone) {
    const reminders = this.vetReminders.get(petId);
    if (!reminders) return { success: false, reason: 'pet_not_found' };

    reminders.milestones.push({
      id: `mst_${Date.now()}`,
      type: milestone.type, // e.g., 'puppy_first_year', 'senior_checkup'
      description: milestone.description,
      date: milestone.date || new Date().toISOString(),
      ageMonths: milestone.ageMonths || null
    });

    return { success: true };
  }

  getUpcomingReminders(petId, daysAhead) {
    const reminders = this.vetReminders.get(petId);
    if (!reminders) return [];

    const now = new Date();
    const cutoff = new Date(now.getTime() + (daysAhead || 30) * 24 * 60 * 60 * 1000);
    const upcoming = [];

    for (const vax of reminders.vaccinations) {
      if (vax.nextDue && new Date(vax.nextDue) <= cutoff && new Date(vax.nextDue) >= now) {
        upcoming.push({ type: 'vaccination', item: vax });
      }
    }

    for (const dew of reminders.deworming) {
      if (dew.nextDue && new Date(dew.nextDue) <= cutoff && new Date(dew.nextDue) >= now) {
        upcoming.push({ type: 'deworming', item: dew });
      }
    }

    for (const apt of reminders.appointments) {
      if (!apt.completed && new Date(apt.date) <= cutoff && new Date(apt.date) >= now) {
        upcoming.push({ type: 'appointment', item: apt });
      }
    }

    for (const med of reminders.medications) {
      if (med.active && (!med.endDate || new Date(med.endDate) >= now)) {
        upcoming.push({ type: 'medication', item: med });
      }
    }

    return upcoming.sort((a, b) => {
      const dateA = new Date(a.item.nextDue || a.item.date || a.item.startDate);
      const dateB = new Date(b.item.nextDue || b.item.date || b.item.startDate);
      return dateA - dateB;
    });
  }

  // ─── FEEDING INTEGRATION ──────────────────────────────────────────────

  recordMeal(petId, meal) {
    const feeding = this.feedingData.get(petId);
    if (!feeding) return { success: false, reason: 'pet_not_found' };

    feeding.mealsToday.push({
      id: `meal_${Date.now()}`,
      time: new Date().toISOString(),
      amountGrams: meal.amountGrams || 0,
      calories: meal.calories || 0,
      foodType: meal.foodType || 'dry',
      bowlId: meal.bowlId || null
    });

    this.log(`Meal recorded for pet ${petId}: ${meal.amountGrams}g`);
    return { success: true, mealsToday: feeding.mealsToday.length };
  }

  updateWaterIntake(petId, amountMl) {
    const feeding = this.feedingData.get(petId);
    if (!feeding) return { success: false, reason: 'pet_not_found' };
    feeding.waterIntakeMl += amountMl;
    return { success: true, totalWaterMl: feeding.waterIntakeMl };
  }

  setMealTimeRestriction(petId, restriction) {
    const feeding = this.feedingData.get(petId);
    if (!feeding) return { success: false, reason: 'pet_not_found' };

    feeding.mealTimeRestrictions.push({
      startTime: restriction.startTime,
      endTime: restriction.endTime,
      keepInside: restriction.keepInside !== undefined ? restriction.keepInside : true,
      description: restriction.description || 'Meal time'
    });

    return { success: true };
  }

  isMealTimeRestrictionActive(petId) {
    const feeding = this.feedingData.get(petId);
    if (!feeding) return false;

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    for (const restriction of feeding.mealTimeRestrictions) {
      if (currentTime >= restriction.startTime && currentTime <= restriction.endTime && restriction.keepInside) {
        return true;
      }
    }

    return false;
  }

  getFeedingSummary(petId) {
    const feeding = this.feedingData.get(petId);
    if (!feeding) return null;

    const totalCalories = feeding.mealsToday.reduce((sum, m) => sum + (m.calories || 0), 0);
    const totalGrams = feeding.mealsToday.reduce((sum, m) => sum + (m.amountGrams || 0), 0);

    return {
      mealsToday: feeding.mealsToday.length,
      totalCalories,
      totalGrams,
      waterIntakeMl: feeding.waterIntakeMl,
      targetCalories: feeding.targetCalories,
      smartBowlConnected: feeding.smartBowlConnected,
      mealTimeRestrictions: feeding.mealTimeRestrictions
    };
  }

  // ─── EMERGENCY LOCKDOWN ───────────────────────────────────────────────

  activateEmergencyLockdown() {
    this.emergencyLockdown.active = true;
    this.emergencyLockdown.activatedAt = new Date().toISOString();

    // Lock all doors immediately
    for (const [doorId] of this.doors) {
      this.lockDoor(doorId);
    }

    // Track which pets are inside/outside
    const { inside, outside } = this.getPetsInsideOutside();
    this.emergencyLockdown.petsInsideDuringLockdown = inside.map(p => p.petId);
    this.emergencyLockdown.petsOutsideDuringLockdown = outside.map(p => p.petId);

    // Send recall alert
    this.emergencyLockdown.recallAlertSent = true;
    for (const p of outside) {
      this.log(`RECALL ALERT sent to ${p.name}'s collar (sound/vibration)`);
    }

    this.stats.totalEmergencyLockdowns++;
    this.log(`EMERGENCY LOCKDOWN ACTIVATED. Pets inside: ${inside.length}, outside: ${outside.length}`);

    return {
      success: true,
      petsInside: inside,
      petsOutside: outside,
      activatedAt: this.emergencyLockdown.activatedAt
    };
  }

  deactivateEmergencyLockdown() {
    if (!this.emergencyLockdown.active) {
      return { success: false, reason: 'lockdown_not_active' };
    }

    this.emergencyLockdown.active = false;
    this.emergencyLockdown.recallAlertSent = false;

    // Unlock enabled doors
    for (const [doorId, door] of this.doors) {
      if (door.enabled && door.installed) {
        this.unlockDoor(doorId);
      }
    }

    this.log('Emergency lockdown deactivated. Doors unlocked.');
    return { success: true };
  }

  getEmergencyLockdownStatus() {
    return { ...this.emergencyLockdown };
  }

  // ─── NEIGHBOR NOTIFICATIONS ───────────────────────────────────────────

  addNeighbor(neighbor) {
    this.neighborNotifications.neighbors.push({
      id: `nbr_${Date.now()}`,
      name: neighbor.name,
      phone: neighbor.phone || null,
      email: neighbor.email || null,
      notifyWhenPetOutside: neighbor.notifyWhenPetOutside || false,
      petIds: neighbor.petIds || []
    });

    this.log(`Neighbor added: ${neighbor.name}`);
    return { success: true };
  }

  activateLostPetMode(petId) {
    const pet = this.pets.get(petId);
    if (!pet) return { success: false, reason: 'pet_not_found' };

    this.neighborNotifications.lostPetMode = {
      active: true,
      petId,
      activatedAt: new Date().toISOString()
    };

    // Unlock all doors so pet can return
    for (const [doorId, door] of this.doors) {
      if (door.installed) {
        this.unlockDoor(doorId);
      }
    }

    // Enable GPS tracking if available
    const gps = this.gpsData.get(petId);
    if (gps) {
      gps.enabled = true;
    }

    // Notify neighbors
    for (const neighbor of this.neighborNotifications.neighbors) {
      this.log(`LOST PET ALERT sent to neighbor ${neighbor.name}: ${pet.name} (${pet.species}, ${pet.breed}) is missing!`);
    }

    this.log(`LOST PET MODE activated for ${pet.name}. All doors unlocked, GPS enabled, neighbors notified.`);
    return { success: true, pet: pet.name };
  }

  deactivateLostPetMode() {
    if (!this.neighborNotifications.lostPetMode.active) {
      return { success: false, reason: 'lost_pet_mode_not_active' };
    }

    const petId = this.neighborNotifications.lostPetMode.petId;
    const pet = this.pets.get(petId);

    this.neighborNotifications.lostPetMode = {
      active: false,
      petId: null,
      activatedAt: null
    };

    // Notify neighbors of resolution
    for (const neighbor of this.neighborNotifications.neighbors) {
      this.log(`Lost pet resolved notification sent to ${neighbor.name}`);
    }

    this.log(`Lost pet mode deactivated${pet ? ` for ${pet.name}` : ''}`);
    return { success: true };
  }

  // ─── NIGHT VISION CAMERA ─────────────────────────────────────────────

  _triggerNightVisionCamera(doorId, reason) {
    if (!this.cameraConfig.enabled) return null;

    const clip = {
      id: `clip_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      doorId,
      reason,
      timestamp: new Date().toISOString(),
      durationSeconds: this.cameraConfig.clipDuration,
      nightVision: this.cameraConfig.nightVisionEnabled,
      motionSensitivity: this.cameraConfig.motionSensitivity,
      status: 'recorded',
      fileSize: null,
      thumbnailUrl: null
    };

    this.cameraClips.push(clip);
    if (this.cameraClips.length > this.cameraConfig.maxClips) {
      this.cameraClips.shift();
    }

    this.log(`Camera clip recorded at ${doorId}: ${reason} (${clip.durationSeconds}s)`);
    return clip;
  }

  getCameraClips(filters) {
    let clips = [...this.cameraClips];

    if (filters) {
      if (filters.doorId) clips = clips.filter(c => c.doorId === filters.doorId);
      if (filters.reason) clips = clips.filter(c => c.reason === filters.reason);
      if (filters.since) {
        const since = new Date(filters.since).getTime();
        clips = clips.filter(c => new Date(c.timestamp).getTime() >= since);
      }
      if (filters.limit) clips = clips.slice(-filters.limit);
    }

    return clips;
  }

  setCameraConfig(config) {
    if (config.enabled !== undefined) this.cameraConfig.enabled = config.enabled;
    if (config.motionSensitivity !== undefined) {
      this.cameraConfig.motionSensitivity = Math.max(0, Math.min(1, config.motionSensitivity));
    }
    if (config.clipDuration !== undefined) this.cameraConfig.clipDuration = config.clipDuration;
    if (config.nightVisionEnabled !== undefined) this.cameraConfig.nightVisionEnabled = config.nightVisionEnabled;
    if (config.maxClips !== undefined) this.cameraConfig.maxClips = config.maxClips;

    this.log(`Camera config updated: sensitivity=${this.cameraConfig.motionSensitivity}, nightVision=${this.cameraConfig.nightVisionEnabled}`);
    return { success: true, config: { ...this.cameraConfig } };
  }

  // ─── DOOR MAINTENANCE ─────────────────────────────────────────────────

  _incrementDoorUsage(doorId) {
    const maintenance = this.doorMaintenance.get(doorId);
    if (!maintenance) return;

    maintenance.usageCount++;
    maintenance.estimatedMotorLifeRemaining = Math.max(0, maintenance.estimatedMotorLifeRemaining - 1);

    // Motor health degrades gradually
    if (maintenance.usageCount % 1000 === 0) {
      maintenance.motorHealth = Math.max(0, maintenance.motorHealth - 2);
      this.log(`Door ${doorId} motor health: ${maintenance.motorHealth}% (${maintenance.usageCount} operations)`);
    }

    // Battery reminder check
    const door = this.doors.get(doorId);
    if (door && door.batteryLevel < 10) {
      this.log(`MAINTENANCE ALERT: Door ${doorId} battery critically low (${door.batteryLevel}%)`);
    }

    // Weatherseal check (every 5000 operations)
    if (maintenance.usageCount % 5000 === 0) {
      maintenance.weathersealStatus = maintenance.usageCount > 20000 ? 'needs_replacement' :
                                       maintenance.usageCount > 10000 ? 'worn' : 'good';
      this.log(`Door ${doorId} weatherseal status: ${maintenance.weathersealStatus}`);
    }

    // Hinge lubrication reminder (every 10000 operations)
    if (maintenance.usageCount % 10000 === 0) {
      this.log(`MAINTENANCE REMINDER: Door ${doorId} hinges need lubrication`);
    }
  }

  getDoorMaintenanceReport(doorId) {
    const maintenance = this.doorMaintenance.get(doorId);
    if (!maintenance) return null;

    const door = this.doors.get(doorId);
    const daysSinceBatteryReplacement = Math.floor(
      (Date.now() - new Date(maintenance.batteryReplacedAt).getTime()) / (24 * 60 * 60 * 1000)
    );
    const daysSinceHingeLubrication = Math.floor(
      (Date.now() - new Date(maintenance.hingeLubricationDate).getTime()) / (24 * 60 * 60 * 1000)
    );

    return {
      doorId,
      location: door ? door.location : 'unknown',
      usageCount: maintenance.usageCount,
      motorHealth: maintenance.motorHealth,
      estimatedMotorLifeRemaining: maintenance.estimatedMotorLifeRemaining,
      batteryLevel: door ? door.batteryLevel : null,
      daysSinceBatteryReplacement,
      weathersealStatus: maintenance.weathersealStatus,
      daysSinceHingeLubrication,
      needsAttention: maintenance.motorHealth < 50 ||
                       (door && door.batteryLevel < 15) ||
                       maintenance.weathersealStatus === 'needs_replacement' ||
                       daysSinceHingeLubrication > 180
    };
  }

  getAllMaintenanceReports() {
    const reports = {};
    for (const [doorId] of this.doorMaintenance) {
      reports[doorId] = this.getDoorMaintenanceReport(doorId);
    }
    return reports;
  }

  recordBatteryReplacement(doorId) {
    const maintenance = this.doorMaintenance.get(doorId);
    const door = this.doors.get(doorId);
    if (!maintenance || !door) return { success: false, reason: 'door_not_found' };
    maintenance.batteryReplacedAt = new Date().toISOString();
    door.batteryLevel = 100;
    this.log(`Battery replaced for door ${doorId}`);
    return { success: true };
  }

  recordHingeLubrication(doorId) {
    const maintenance = this.doorMaintenance.get(doorId);
    if (!maintenance) return { success: false, reason: 'door_not_found' };
    maintenance.hingeLubricationDate = new Date().toISOString();
    this.log(`Hinges lubricated for door ${doorId}`);
    return { success: true };
  }

  // ─── MONITORING ───────────────────────────────────────────────────────

  _initializeMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(() => {
      this._runMonitoringCycle();
    }, this.monitoringIntervalMs);

    this.log(`Monitoring started: every ${this.monitoringIntervalMs / 1000}s`);
  }

  _runMonitoringCycle() {
    try {
      const cycleStart = Date.now();

      // Check all door states
      this._checkDoorStates();

      // Check pet locations and GPS
      this._checkPetLocations();

      // Check curfew compliance
      this._checkCurfewCompliance();

      // Check battery levels
      this._checkBatteryLevels();

      // Process queued approach events
      this._processApproachQueue();

      // Check for unusual behavior
      this._checkUnusualBehavior();

      // Check weather blocking
      this._checkWeatherConditions();

      // Check meal time restrictions
      this._checkMealTimeRestrictions();

      this.stats.lastMonitoringCycle = new Date().toISOString();

      const cycleDuration = Date.now() - cycleStart;
      if (cycleDuration > 5000) {
        this.log(`Monitoring cycle slow: ${cycleDuration}ms`);
      }
    } catch (err) {
      this.error(`Monitoring cycle error: ${err.message}`);
    }
  }

  _checkDoorStates() {
    for (const [doorId, door] of this.doors) {
      if (!door.installed || !door.enabled) continue;

      // Check motor status
      const maintenance = this.doorMaintenance.get(doorId);
      if (maintenance && maintenance.motorHealth < 20) {
        door.motorStatus = 'critical';
        this.log(`CRITICAL: Door ${doorId} motor health is ${maintenance.motorHealth}%`);
      } else if (maintenance && maintenance.motorHealth < 50) {
        door.motorStatus = 'degraded';
      } else {
        door.motorStatus = 'healthy';
      }
    }
  }

  _checkPetLocations() {
    for (const [petId, gps] of this.gpsData) {
      if (!gps.enabled || !gps.lat) continue;

      const pet = this.pets.get(petId);
      if (!pet) continue;

      // Check if GPS data is stale (> 10 minutes)
      if (gps.lastUpdate) {
        const staleness = Date.now() - new Date(gps.lastUpdate).getTime();
        if (staleness > 10 * 60 * 1000) {
          this.log(`GPS data stale for ${pet.name}: last update ${Math.floor(staleness / 60000)} minutes ago`);
        }
      }

      // Geofence check
      if (gps.outsideGeofence) {
        this.log(`WARNING: ${pet.name} is outside geofence`);
      }
    }
  }

  _checkBatteryLevels() {
    for (const [doorId, door] of this.doors) {
      if (!door.installed) continue;

      if (door.batteryLevel < 5) {
        this.log(`CRITICAL: Door ${doorId} battery at ${door.batteryLevel}% - immediate replacement needed`);
      } else if (door.batteryLevel < 15) {
        this.log(`WARNING: Door ${doorId} battery low at ${door.batteryLevel}%`);
      }

      // Simulate gradual battery drain (0.01% per monitoring cycle for installed doors)
      door.batteryLevel = Math.max(0, door.batteryLevel - 0.01);
    }
  }

  _checkUnusualBehavior() {
    for (const [petId, health] of this.healthData) {
      if (health.dailyTripsHistory.length < 7) continue;

      const avg = health.dailyTripsHistory.slice(-7).reduce((a, b) => a + b, 0) / 7;

      // Significantly fewer trips than average
      if (health.tripsToday < avg * 0.3 && avg > 2) {
        const existing = health.unusualBehaviorFlags.find(
          f => f.type === 'low_activity' && f.date === new Date().toDateString()
        );
        if (!existing) {
          const pet = this.pets.get(petId);
          health.unusualBehaviorFlags.push({
            type: 'low_activity',
            date: new Date().toDateString(),
            value: health.tripsToday,
            average: avg
          });
          this.log(`Unusual behavior: ${pet ? pet.name : petId} has very low activity today (${health.tripsToday} trips vs avg ${avg.toFixed(1)})`);
        }
      }

      // Check time outside
      const tracking = this.timeOutsideTracking.get(petId);
      if (tracking && tracking.currentSessionStart) {
        const outsideDuration = Date.now() - tracking.currentSessionStart;
        const hoursOutside = outsideDuration / (60 * 60 * 1000);

        if (hoursOutside > 4) {
          const pet = this.pets.get(petId);
          this.log(`WARNING: ${pet ? pet.name : petId} has been outside for ${hoursOutside.toFixed(1)} hours`);
        }
      }
    }
  }

  _checkWeatherConditions() {
    if (!this.weatherRules.enabled || !this.weatherRules.currentWeather) return;

    if (this._isWeatherBlocked()) {
      // Lock all doors for outgoing direction
      for (const [doorId, door] of this.doors) {
        if (door.enabled && door.installed && !door.locked) {
          this.log(`Weather blocking active: locking door ${doorId}`);
          this.lockDoor(doorId);
        }
      }
    }
  }

  _checkMealTimeRestrictions() {
    for (const [petId] of this.pets) {
      if (this.isMealTimeRestrictionActive(petId)) {
        const location = this.petLocations.get(petId);
        if (location && !location.inside) {
          const pet = this.pets.get(petId);
          this.log(`Meal time: ${pet ? pet.name : petId} should be inside for feeding`);
        }
      }
    }
  }

  _initializeDailyReset() {
    // Schedule daily reset at midnight
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const msUntilMidnight = midnight.getTime() - now.getTime();

    this._dailyResetTimeout = setTimeout(() => {
      this._performDailyReset();
      // Set up recurring daily reset
      this._dailyResetInterval = setInterval(() => {
        this._performDailyReset();
      }, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);

    this.log(`Daily reset scheduled in ${Math.floor(msUntilMidnight / 60000)} minutes`);
  }

  _performDailyReset() {
    this.log('Performing daily reset...');

    for (const [petId, health] of this.healthData) {
      // Archive today's trips
      health.dailyTripsHistory.push(health.tripsToday);
      if (health.dailyTripsHistory.length > 90) {
        health.dailyTripsHistory = health.dailyTripsHistory.slice(-90);
      }
      health.tripsToday = 0;

      // Archive time outside
      const tracking = this.timeOutsideTracking.get(petId);
      if (tracking) {
        tracking.dailyHistory.push({
          date: new Date().toISOString(),
          totalMs: tracking.totalTodayMs
        });
        if (tracking.dailyHistory.length > 90) {
          tracking.dailyHistory = tracking.dailyHistory.slice(-90);
        }
        tracking.totalTodayMs = 0;
      }

      // Archive feeding data
      const feeding = this.feedingData.get(petId);
      if (feeding) {
        feeding.dailyHistory.push({
          date: new Date().toISOString(),
          meals: feeding.mealsToday.length,
          totalCalories: feeding.mealsToday.reduce((sum, m) => sum + (m.calories || 0), 0),
          totalGrams: feeding.mealsToday.reduce((sum, m) => sum + (m.amountGrams || 0), 0),
          waterIntakeMl: feeding.waterIntakeMl
        });
        if (feeding.dailyHistory.length > 90) {
          feeding.dailyHistory = feeding.dailyHistory.slice(-90);
        }
        feeding.mealsToday = [];
        feeding.waterIntakeMl = 0;
      }

      // Clear unusual behavior flags older than 30 days
      health.unusualBehaviorFlags = health.unusualBehaviorFlags.filter(f => {
        const flagDate = new Date(f.date);
        return (Date.now() - flagDate.getTime()) < 30 * 24 * 60 * 60 * 1000;
      });
    }

    // Reset curfew alerts
    this.curfew.lastAlerts.clear();

    this.log('Daily reset complete');
  }

  // ─── STATISTICS & ANALYTICS ───────────────────────────────────────────

  getStatistics() {
    const petStats = {};
    for (const [petId, pet] of this.pets) {
      const health = this.healthData.get(petId) || {};
      const tracking = this.timeOutsideTracking.get(petId) || {};
      const analytics = this.behavioralAnalytics.get(petId) || {};
      const feeding = this.feedingData.get(petId) || {};
      const gps = this.gpsData.get(petId) || {};
      const location = this.petLocations.get(petId) || {};

      petStats[petId] = {
        name: pet.name,
        species: pet.species,
        breed: pet.breed,
        weight: pet.weight,
        inside: location.inside,
        tripsToday: health.tripsToday || 0,
        averageTripsPerDay: health.averageTripsPerDay || 0,
        timeOutsideTodayMinutes: (tracking.totalTodayMs || 0) / 60000,
        favoriteDoor: analytics.favoriteDoor || null,
        peakHours: analytics.peakHours || {},
        indoorOutdoorRatio: analytics.indoorOutdoorRatio || 1.0,
        mealsToday: feeding.mealsToday ? feeding.mealsToday.length : 0,
        waterIntakeMl: feeding.waterIntakeMl || 0,
        gpsEnabled: gps.enabled || false,
        outsideGeofence: gps.outsideGeofence || false,
        unusualBehaviorFlags: (health.unusualBehaviorFlags || []).length
      };
    }

    const doorStats = {};
    for (const [doorId, door] of this.doors) {
      const maintenance = this.doorMaintenance.get(doorId) || {};
      doorStats[doorId] = {
        location: door.location,
        size: door.size,
        locked: door.locked,
        enabled: door.enabled,
        installed: door.installed,
        batteryLevel: door.batteryLevel,
        motorStatus: door.motorStatus,
        usageCount: maintenance.usageCount || 0,
        motorHealth: maintenance.motorHealth || 100,
        weathersealStatus: maintenance.weathersealStatus || 'good'
      };
    }

    return {
      system: {
        initialized: this.initialized,
        startedAt: this.stats.systemStartedAt,
        lastMonitoringCycle: this.stats.lastMonitoringCycle,
        totalDoorEvents: this.stats.totalDoorEvents,
        totalIntruderBlocks: this.stats.totalIntruderBlocks,
        totalCurfewAlerts: this.stats.totalCurfewAlerts,
        totalWeatherBlocks: this.stats.totalWeatherBlocks,
        totalEmergencyLockdowns: this.stats.totalEmergencyLockdowns,
        monitoringIntervalMs: this.monitoringIntervalMs,
        activityLogSize: this.activityLog.length,
        cameraClipsStored: this.cameraClips.length
      },
      doors: doorStats,
      pets: petStats,
      curfew: {
        enabled: this.curfew.enabled,
        globalTime: this.curfew.globalTime,
        gracePeriodMinutes: this.curfew.gracePeriodMinutes,
        overrideCount: this.curfew.petOverrides.size
      },
      weather: this.weatherRules.currentWeather ? {
        temperature: this.weatherRules.currentWeather.temperature,
        condition: this.weatherRules.currentWeather.condition,
        blocked: this._isWeatherBlocked()
      } : null,
      emergencyLockdown: {
        active: this.emergencyLockdown.active,
        activatedAt: this.emergencyLockdown.activatedAt
      },
      lostPetMode: {
        active: this.neighborNotifications.lostPetMode.active,
        petId: this.neighborNotifications.lostPetMode.petId
      },
      intruderDetection: {
        enabled: this.intruderDetection.enabled,
        blockedAttempts: this.intruderDetection.blockedAttempts,
        lastEvent: this.intruderDetection.lastIntruderEvent
      },
      registeredDoors: this.doors.size,
      registeredPets: this.pets.size,
      maxDoors: MAX_DOORS,
      maxPets: MAX_PETS
    };
  }

  getBehavioralReport(petId) {
    const analytics = this.behavioralAnalytics.get(petId);
    const health = this.healthData.get(petId);
    const tracking = this.timeOutsideTracking.get(petId);
    const pet = this.pets.get(petId);

    if (!analytics || !health || !pet) return null;

    // Calculate 7-day rolling average trips
    const recentTrips = analytics.rollingTrips.filter(t => t.direction === 'out');
    const tripsPerDayMap = {};
    for (const trip of recentTrips) {
      const day = new Date(trip.timestamp).toDateString();
      tripsPerDayMap[day] = (tripsPerDayMap[day] || 0) + 1;
    }
    const days = Object.keys(tripsPerDayMap);
    const avgTripsPerDay = days.length > 0
      ? Object.values(tripsPerDayMap).reduce((a, b) => a + b, 0) / days.length
      : 0;

    // Find peak activity hour
    let peakHour = null;
    let peakCount = 0;
    for (const [hour, count] of Object.entries(analytics.peakHours)) {
      if (count > peakCount) {
        peakCount = count;
        peakHour = parseInt(hour);
      }
    }

    return {
      petName: pet.name,
      species: pet.species,
      averageTripsPerDay7Day: avgTripsPerDay,
      favoriteDoor: analytics.favoriteDoor,
      peakActivityHour: peakHour,
      indoorOutdoorRatio: analytics.indoorOutdoorRatio,
      averageTimeOutsideMinutes: analytics.averageTimeOutsideMinutes,
      doorPreferences: analytics.doorPreferences,
      seasonalData: {
        spring: analytics.seasonalData.spring.length,
        summer: analytics.seasonalData.summer.length,
        autumn: analytics.seasonalData.autumn.length,
        winter: analytics.seasonalData.winter.length
      },
      unusualBehaviorFlags: health.unusualBehaviorFlags,
      weightTrend: health.weightHistory.slice(-10),
      tripsToday: health.tripsToday,
      timeOutsideTodayMinutes: tracking ? tracking.totalTodayMs / 60000 : 0
    };
  }

  // ─── LOGGING ──────────────────────────────────────────────────────────

  log(msg) {
    if (this.homey && typeof this.homey.log === 'function') {
      this.homey.log(`[PetDoor] ${msg}`);
    } else {
      console.log(`[PetDoor] ${msg}`);
    }
  }

  error(msg) {
    if (this.homey && typeof this.homey.error === 'function') {
      this.homey.error(`[PetDoor] ${msg}`);
    } else {
      console.error(`[PetDoor] ${msg}`);
    }
  }

  // ─── CLEANUP ──────────────────────────────────────────────────────────

  destroy() {
    this.log('Destroying SmartPetDoorActivitySystem...');

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this._dailyResetTimeout) {
      clearTimeout(this._dailyResetTimeout);
      this._dailyResetTimeout = null;
    }

    if (this._dailyResetInterval) {
      clearInterval(this._dailyResetInterval);
      this._dailyResetInterval = null;
    }

    this.doors.clear();
    this.pets.clear();
    this.accessSchedules.clear();
    this.petLocations.clear();
    this.timeOutsideTracking.clear();
    this.gpsData.clear();
    this.healthData.clear();
    this.vetReminders.clear();
    this.feedingData.clear();
    this.behavioralAnalytics.clear();
    this.doorMaintenance.clear();
    this.doorCooldowns.clear();
    this.activityLog = [];
    this.cameraClips = [];
    this.simultaneousApproachQueue = [];

    this.initialized = false;
    this.log('SmartPetDoorActivitySystem destroyed');
  }
}

module.exports = SmartPetDoorActivitySystem;
