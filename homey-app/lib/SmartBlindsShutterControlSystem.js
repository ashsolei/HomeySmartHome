'use strict';

const EventEmitter = require('events');

/**
 * SmartBlindsShutterControlSystem
 *
 * Comprehensive smart home automation module for controlling blinds,
 * shutters, and curtains. Supports multiple device types with solar
 * tracking, energy optimization, privacy modes, weather integration,
 * and advanced scheduling.
 *
 * Default configuration is tailored for a Swedish home in Stockholm
 * (59.33°N, 18.07°E) with Nordic-specific season handling.
 *
 * @extends EventEmitter
 */
class SmartBlindsShutterControlSystem extends EventEmitter {

  /**
   * @param {object} homey - The Homey app instance
   */
  constructor(homey) {
    super();
    this.homey = homey;
    this.initialized = false;
    this.intervals = [];

    // Location defaults — Stockholm, Sweden
    this.location = { latitude: 59.33, longitude: 18.07, timezone: 'Europe/Stockholm' };

    // Supported device types
    this.deviceTypes = [
      'roller_blind', 'venetian_blind', 'vertical_blind',
      'roman_shade', 'curtain', 'external_shutter', 'skylight_blind'
    ];

    // ── Devices ──────────────────────────────────────────────────
    this.devices = new Map();
    this._buildDefaultDevices();

    // ── Room / Zone Control ──────────────────────────────────────
    this.zones = new Map();
    this._buildDefaultZones();

    // ── Zone presets ─────────────────────────────────────────────
    this.zonePresets = {
      open_all: { label: 'Öppna alla', position: 100, tilt: 0 },
      close_all: { label: 'Stäng alla', position: 0, tilt: 0 },
      privacy: { label: 'Integritet', position: 15, tilt: 45 },
      movie_mode: { label: 'Bioläge', position: 0, tilt: 0 },
      energy_save: { label: 'Energibesparing', position: null, tilt: null },
      ventilation: { label: 'Ventilation', position: 30, tilt: 90 }
    };

    // ── Solar tracking state ────────────────────────────────────
    this.solarState = {
      azimuth: 0,
      elevation: 0,
      sunrise: null,
      sunset: null,
      solarNoon: null,
      isDaylight: false,
      lastCalculated: null
    };

    // ── Energy optimization ─────────────────────────────────────
    this.energyConfig = {
      electricityPriceSEK: 1.85,
      coolingCostPerHourSEK: 4.50,
      heatingCostPerHourSEK: 3.20,
      solarHeatGainCoefficient: 0.65,
      windowUValue: 1.2,
      currentSeason: 'winter',
      seasonalConfig: {
        summer: { months: [6, 7, 8], strategy: 'block_heat', priority: 'cooling' },
        winter: { months: [11, 12, 1, 2, 3], strategy: 'maximize_solar', priority: 'heating' },
        spring: { months: [4, 5], strategy: 'balanced', priority: 'comfort' },
        autumn: { months: [9, 10], strategy: 'balanced', priority: 'comfort' }
      }
    };
    this.energyStats = {
      dailySavingsSEK: 0,
      monthlySavingsSEK: 0,
      yearlySavingsSEK: 0,
      totalCyclesSaved: 0,
      solarGainKwh: 0,
      coolingReductionKwh: 0
    };

    // ── Privacy configuration ───────────────────────────────────
    this.privacyConfig = {
      autoCloseAtSunset: true,
      sunsetOffsetMinutes: -15,
      autoOpenAtSunrise: true,
      sunriseOffsetMinutes: 30,
      occupancyBasedSecurity: true,
      unoccupiedCloseDelayMinutes: 10,
      streetFacingRooms: ['vardagsrum', 'kontor'],
      gardenFacingRooms: ['sovrum', 'kok']
    };
    this.privacySchedules = new Map();
    this._buildDefaultPrivacySchedules();

    // ── Scene integration ───────────────────────────────────────
    this.scenes = new Map();
    this._buildDefaultScenes();

    // ── Weather integration ─────────────────────────────────────
    this.weatherState = {
      temperature: 5.0,
      windSpeed: 3.0,
      windGust: 5.0,
      rainIntensity: 0,
      snowfall: false,
      humidity: 65,
      forecast: [],
      alerts: []
    };
    this.weatherThresholds = {
      highWindRetractSpeed: 15.0,
      stormRetractSpeed: 20.0,
      heavyRainRetract: 5.0,
      frostProtectionTemp: -5.0,
      hailRetract: true
    };

    // ── Scheduling ──────────────────────────────────────────────
    this.schedules = new Map();
    this._buildDefaultSchedules();

    // ── Automation rules ────────────────────────────────────────
    this.automationRules = new Map();
    this._buildDefaultAutomationRules();

    // ── Statistics / Analytics ───────────────────────────────────
    this.statistics = new Map();
    this._initStatistics();

    // ── Position log ────────────────────────────────────────────
    this.positionLog = [];
    this.maxLogEntries = 5000;

    // ── Calibration state ───────────────────────────────────────
    this.calibrationState = new Map();

    // ── Occupancy cache ─────────────────────────────────────────
    this.roomOccupancy = new Map();

    // ── Notification thresholds ─────────────────────────────────
    this.notificationConfig = {
      batteryLowThreshold: 15,
      motorCycleWarning: 8000,
      motorCycleCritical: 12000,
      calibrationIntervalDays: 180,
      energyMilestoneSEK: 500
    };
  }

  // ════════════════════════════════════════════════════════════════
  //  DEFAULT DATA BUILDERS
  // ════════════════════════════════════════════════════════════════

  /**
   * Build default blind/shutter devices for a Swedish home.
   * @private
   */
  _buildDefaultDevices() {
    var defaults = [
      { id: 'vr-blind-1', name: 'Vardagsrum Fönster Vänster', room: 'vardagsrum', type: 'roller_blind', facing: 'south', width: 120, height: 180, isExterior: false, isStreetFacing: true },
      { id: 'vr-blind-2', name: 'Vardagsrum Fönster Höger', room: 'vardagsrum', type: 'roller_blind', facing: 'south', width: 120, height: 180, isExterior: false, isStreetFacing: true },
      { id: 'vr-curtain-1', name: 'Vardagsrum Gardin', room: 'vardagsrum', type: 'curtain', facing: 'south', width: 280, height: 240, isExterior: false, isStreetFacing: true },
      { id: 'vr-venetian-1', name: 'Vardagsrum Persienn Väst', room: 'vardagsrum', type: 'venetian_blind', facing: 'west', width: 100, height: 140, isExterior: false, isStreetFacing: false },
      { id: 'sr-blind-1', name: 'Sovrum Rullgardin', room: 'sovrum', type: 'roller_blind', facing: 'east', width: 140, height: 180, isExterior: false, isStreetFacing: false },
      { id: 'sr-blind-2', name: 'Sovrum Mörkläggning', room: 'sovrum', type: 'roller_blind', facing: 'east', width: 140, height: 180, isExterior: false, isStreetFacing: false },
      { id: 'sr-curtain-1', name: 'Sovrum Gardin', room: 'sovrum', type: 'curtain', facing: 'east', width: 300, height: 240, isExterior: false, isStreetFacing: false },
      { id: 'kok-venetian-1', name: 'Kök Persienn', room: 'kok', type: 'venetian_blind', facing: 'north', width: 120, height: 120, isExterior: false, isStreetFacing: false },
      { id: 'kok-roman-1', name: 'Kök Hissgardin', room: 'kok', type: 'roman_shade', facing: 'east', width: 80, height: 100, isExterior: false, isStreetFacing: false },
      { id: 'kontor-blind-1', name: 'Kontor Rullgardin', room: 'kontor', type: 'roller_blind', facing: 'south', width: 160, height: 180, isExterior: false, isStreetFacing: true },
      { id: 'kontor-venetian-1', name: 'Kontor Persienn', room: 'kontor', type: 'venetian_blind', facing: 'south', width: 100, height: 140, isExterior: false, isStreetFacing: true },
      { id: 'kontor-vertical-1', name: 'Kontor Lamellgardin', room: 'kontor', type: 'vertical_blind', facing: 'west', width: 200, height: 220, isExterior: false, isStreetFacing: false },
      { id: 'bad-blind-1', name: 'Badrum Rullgardin', room: 'badrum', type: 'roller_blind', facing: 'north', width: 60, height: 80, isExterior: false, isStreetFacing: false },
      { id: 'ext-shutter-vr', name: 'Vardagsrum Ytterjalusi', room: 'vardagsrum', type: 'external_shutter', facing: 'south', width: 280, height: 200, isExterior: true, isStreetFacing: true },
      { id: 'ext-shutter-sr', name: 'Sovrum Ytterjalusi', room: 'sovrum', type: 'external_shutter', facing: 'east', width: 140, height: 180, isExterior: true, isStreetFacing: false },
      { id: 'skylight-1', name: 'Övervåning Takfönster', room: 'sovrum', type: 'skylight_blind', facing: 'south', width: 80, height: 120, isExterior: false, isStreetFacing: false }
    ];

    for (var i = 0; i < defaults.length; i++) {
      var d = defaults[i];
      this.devices.set(d.id, {
        id: d.id,
        name: d.name,
        room: d.room,
        type: d.type,
        facing: d.facing,
        width: d.width,
        height: d.height,
        isExterior: d.isExterior,
        isStreetFacing: d.isStreetFacing,
        position: 0,
        targetPosition: 0,
        tilt: 0,
        targetTilt: 0,
        batteryLevel: 95 + Math.floor(Math.random() * 6),
        motorStatus: 'idle',
        motorCycles: Math.floor(Math.random() * 2000),
        lastMoved: null,
        lastCalibrated: null,
        firmware: '2.4.1',
        signalStrength: -45 - Math.floor(Math.random() * 25),
        isOnline: true,
        isMoving: false,
        speed: 'normal',
        obstacleDetected: false,
        favoritePositions: { morning: 80, afternoon: 50, evening: 10, night: 0 },
        errorHistory: [],
        installed: '2024-08-15T10:00:00.000Z'
      });
    }
  }

  /**
   * Build default room zones.
   * @private
   */
  _buildDefaultZones() {
    var zoneData = [
      { id: 'vardagsrum', name: 'Vardagsrum', floor: 0, devices: ['vr-blind-1', 'vr-blind-2', 'vr-curtain-1', 'vr-venetian-1', 'ext-shutter-vr'], priority: 'high' },
      { id: 'sovrum', name: 'Sovrum', floor: 1, devices: ['sr-blind-1', 'sr-blind-2', 'sr-curtain-1', 'ext-shutter-sr', 'skylight-1'], priority: 'high' },
      { id: 'kok', name: 'Kök', floor: 0, devices: ['kok-venetian-1', 'kok-roman-1'], priority: 'medium' },
      { id: 'kontor', name: 'Kontor', floor: 0, devices: ['kontor-blind-1', 'kontor-venetian-1', 'kontor-vertical-1'], priority: 'high' },
      { id: 'badrum', name: 'Badrum', floor: 1, devices: ['bad-blind-1'], priority: 'low' }
    ];

    for (var i = 0; i < zoneData.length; i++) {
      var z = zoneData[i];
      this.zones.set(z.id, {
        id: z.id,
        name: z.name,
        floor: z.floor,
        devices: z.devices,
        priority: z.priority,
        activePreset: null,
        lastChanged: null
      });
    }
  }

  /**
   * Build default privacy schedules per room.
   * @private
   */
  _buildDefaultPrivacySchedules() {
    this.privacySchedules.set('vardagsrum', { closeTime: 'sunset', openTime: '07:30', weekendOpenTime: '09:00', alwaysPrivate: false });
    this.privacySchedules.set('sovrum', { closeTime: '21:00', openTime: '07:00', weekendOpenTime: '09:30', alwaysPrivate: false });
    this.privacySchedules.set('kok', { closeTime: 'sunset', openTime: '06:30', weekendOpenTime: '08:30', alwaysPrivate: false });
    this.privacySchedules.set('kontor', { closeTime: 'sunset', openTime: '08:00', weekendOpenTime: '10:00', alwaysPrivate: false });
    this.privacySchedules.set('badrum', { closeTime: null, openTime: null, weekendOpenTime: null, alwaysPrivate: true });
  }

  /**
   * Build default scenes.
   * @private
   */
  _buildDefaultScenes() {
    this.scenes.set('morning', {
      id: 'morning', name: 'Morgonrutin', description: 'Gradvis öppning av alla gardiner',
      actions: [
        { zone: 'sovrum', position: 50, tilt: 0, delay: 0, gradual: true, durationMs: 300000 },
        { zone: 'kok', position: 100, tilt: 0, delay: 60000, gradual: false, durationMs: 0 },
        { zone: 'vardagsrum', position: 80, tilt: 0, delay: 120000, gradual: true, durationMs: 120000 },
        { zone: 'kontor', position: 70, tilt: 45, delay: 180000, gradual: false, durationMs: 0 }
      ],
      isActive: false, lastTriggered: null
    });

    this.scenes.set('goodnight', {
      id: 'goodnight', name: 'God natt', description: 'Stäng alla gardiner och jalusier',
      actions: [
        { zone: 'all', position: 0, tilt: 0, delay: 0, gradual: false, durationMs: 0 }
      ],
      isActive: false, lastTriggered: null
    });

    this.scenes.set('movie', {
      id: 'movie', name: 'Bioläge', description: 'Total mörkläggning i vardagsrummet',
      actions: [
        { zone: 'vardagsrum', position: 0, tilt: 0, delay: 0, gradual: true, durationMs: 15000 }
      ],
      isActive: false, lastTriggered: null
    });

    this.scenes.set('away', {
      id: 'away', name: 'Bortaläge', description: 'Simulera närvaro med slumpmässiga positioner',
      actions: [],
      isActive: false, lastTriggered: null, simulateOccupancy: true, intervalMinutes: 45
    });

    this.scenes.set('wakeup_light', {
      id: 'wakeup_light', name: 'Väckningsljus', description: 'Synk med väckningssystem för gradvis ljusinsläpp',
      actions: [
        { zone: 'sovrum', position: 30, tilt: 0, delay: 0, gradual: true, durationMs: 600000 },
        { zone: 'sovrum', position: 80, tilt: 0, delay: 600000, gradual: true, durationMs: 300000 }
      ],
      isActive: false, lastTriggered: null, syncWithWakeUpSystem: true
    });

    this.scenes.set('work_from_home', {
      id: 'work_from_home', name: 'Hemmakontor', description: 'Optimal belysning för kontorsarbete',
      actions: [
        { zone: 'kontor', position: 60, tilt: 45, delay: 0, gradual: false, durationMs: 0 },
        { zone: 'vardagsrum', position: 40, tilt: 30, delay: 0, gradual: false, durationMs: 0 }
      ],
      isActive: false, lastTriggered: null
    });
  }

  /**
   * Build default schedules.
   * @private
   */
  _buildDefaultSchedules() {
    this.schedules.set('weekday-morning', {
      id: 'weekday-morning', name: 'Vardag morgon', enabled: true,
      days: ['mon', 'tue', 'wed', 'thu', 'fri'],
      triggerType: 'time', triggerValue: '06:45',
      sunriseOffset: null, sunsetOffset: null,
      actions: [
        { deviceId: 'sr-blind-1', position: 60, tilt: 0 },
        { deviceId: 'sr-blind-2', position: 60, tilt: 0 },
        { deviceId: 'kok-venetian-1', position: 100, tilt: 0 }
      ],
      lastRun: null, nextRun: null
    });

    this.schedules.set('weekday-evening', {
      id: 'weekday-evening', name: 'Vardag kväll', enabled: true,
      days: ['mon', 'tue', 'wed', 'thu', 'fri'],
      triggerType: 'sunset', triggerValue: null,
      sunriseOffset: null, sunsetOffset: -10,
      actions: [
        { deviceId: 'all', position: 0, tilt: 0 }
      ],
      lastRun: null, nextRun: null
    });

    this.schedules.set('weekend-morning', {
      id: 'weekend-morning', name: 'Helg morgon', enabled: true,
      days: ['sat', 'sun'],
      triggerType: 'time', triggerValue: '08:30',
      sunriseOffset: null, sunsetOffset: null,
      actions: [
        { deviceId: 'kok-venetian-1', position: 100, tilt: 0 },
        { deviceId: 'vr-blind-1', position: 80, tilt: 0 },
        { deviceId: 'vr-blind-2', position: 80, tilt: 0 }
      ],
      lastRun: null, nextRun: null
    });

    this.schedules.set('holiday-mode', {
      id: 'holiday-mode', name: 'Semesterläge', enabled: false,
      days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      triggerType: 'sunrise', triggerValue: null,
      sunriseOffset: 30, sunsetOffset: null,
      actions: [
        { deviceId: 'vr-blind-1', position: 50, tilt: 0 },
        { deviceId: 'kontor-blind-1', position: 40, tilt: 0 }
      ],
      lastRun: null, nextRun: null, simulateOccupancy: true
    });
  }

  /**
   * Build default automation rules.
   * @private
   */
  _buildDefaultAutomationRules() {
    this.automationRules.set('temp-high-close', {
      id: 'temp-high-close', name: 'Hög temperatur — stäng soliga fönster',
      enabled: true, trigger: 'temperature', condition: 'above', value: 26,
      targetFacing: ['south', 'west'], action: 'close', priority: 8,
      cooldownMinutes: 30, lastTriggered: null
    });

    this.automationRules.set('temp-low-open', {
      id: 'temp-low-open', name: 'Låg temperatur — solvärme',
      enabled: true, trigger: 'temperature', condition: 'below', value: 18,
      targetFacing: ['south'], action: 'open', priority: 7,
      cooldownMinutes: 30, lastTriggered: null, seasonRestriction: 'winter'
    });

    this.automationRules.set('humidity-high-bathroom', {
      id: 'humidity-high-bathroom', name: 'Hög luftfuktighet — öppna badrum',
      enabled: true, trigger: 'humidity', condition: 'above', value: 75,
      targetRooms: ['badrum'], action: 'open', priority: 6,
      cooldownMinutes: 15, lastTriggered: null
    });

    this.automationRules.set('bright-light-glare', {
      id: 'bright-light-glare', name: 'Starkt ljus — bländningsskydd',
      enabled: true, trigger: 'light_level', condition: 'above', value: 40000,
      targetFacing: ['south', 'west'], action: 'tilt_45', priority: 5,
      cooldownMinutes: 10, lastTriggered: null
    });

    this.automationRules.set('room-unoccupied', {
      id: 'room-unoccupied', name: 'Rum tomt — energibesparing',
      enabled: true, trigger: 'occupancy', condition: 'unoccupied', value: 15,
      targetFacing: null, action: 'energy_position', priority: 3,
      cooldownMinutes: 5, lastTriggered: null
    });

    this.automationRules.set('room-occupied-restore', {
      id: 'room-occupied-restore', name: 'Rum bemannat — återställ',
      enabled: true, trigger: 'occupancy', condition: 'occupied', value: 0,
      targetFacing: null, action: 'restore_previous', priority: 4,
      cooldownMinutes: 0, lastTriggered: null
    });
  }

  /**
   * Initialize per-device statistics.
   * @private
   */
  _initStatistics() {
    var deviceIds = Array.from(this.devices.keys());
    for (var i = 0; i < deviceIds.length; i++) {
      this.statistics.set(deviceIds[i], {
        totalCycles: 0,
        totalTiltChanges: 0,
        dailyCycles: 0,
        dailyTiltChanges: 0,
        energySavedSEK: 0,
        solarGainKwh: 0,
        avgDailyPosition: 50,
        positionHistory: [],
        lastResetDate: new Date().toISOString().slice(0, 10)
      });
    }
  }

  // ════════════════════════════════════════════════════════════════
  //  INITIALIZATION
  // ════════════════════════════════════════════════════════════════

  /**
   * Initialize the blinds/shutter control system.
   * Starts all background intervals for solar tracking, scheduling,
   * weather monitoring, and statistics collection.
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      if (this.initialized) return;
      this.homey.log('[Blinds] Initializing Smart Blinds & Shutter Control System...');

      this._updateSeason();
      this._calculateSunPosition();
      this._evaluateAllSchedules();

      // Solar tracking — every 5 minutes
      this.intervals.push(setInterval(this._solarTrackingCycle.bind(this), 300000));

      // Schedule evaluation — every minute
      this.intervals.push(setInterval(this._evaluateAllSchedules.bind(this), 60000));

      // Weather check — every 10 minutes
      this.intervals.push(setInterval(this._weatherCheckCycle.bind(this), 600000));

      // Energy optimization — every 15 minutes
      this.intervals.push(setInterval(this._energyOptimizationCycle.bind(this), 900000));

      // Privacy mode evaluation — every 5 minutes
      this.intervals.push(setInterval(this._privacyEvaluationCycle.bind(this), 300000));

      // Statistics collection — every hour
      this.intervals.push(setInterval(this._statisticsCollectionCycle.bind(this), 3600000));

      // Battery / motor health check — every 6 hours
      this.intervals.push(setInterval(this._healthCheckCycle.bind(this), 21600000));

      // Automation rules evaluation — every 2 minutes
      this.intervals.push(setInterval(this._evaluateAutomationRules.bind(this), 120000));

      // Occupancy simulation (away mode) — every 30 minutes
      this.intervals.push(setInterval(this._occupancySimulationCycle.bind(this), 1800000));

      // Daily statistics reset — every hour (checks date change)
      this.intervals.push(setInterval(this._dailyStatsReset.bind(this), 3600000));

      this.initialized = true;
      this.homey.log('[Blinds] System initialized with ' + this.devices.size + ' devices across ' + this.zones.size + ' zones');
      this.emit('system_initialized', { deviceCount: this.devices.size, zoneCount: this.zones.size, timestamp: new Date().toISOString() });
    } catch (error) {
      this.homey.error(`[SmartBlindsShutterControlSystem] Failed to initialize:`, error.message);
    }
  }

  // ════════════════════════════════════════════════════════════════
  //  SOLAR TRACKING
  // ════════════════════════════════════════════════════════════════

  /**
   * Calculate current sun position (azimuth and elevation) based on
   * latitude, longitude, date and time. Uses simplified astronomical
   * formulas suitable for Nordic latitudes.
   * @private
   */
  _calculateSunPosition() {
    var now = new Date();
    var dayOfYear = this._dayOfYear(now);
    var lat = this.location.latitude * Math.PI / 180;
    var lon = this.location.longitude;

    // Solar declination (Spencer, 1971)
    var B = (2 * Math.PI / 365) * (dayOfYear - 1);
    var declination = 0.006918 - 0.399912 * Math.cos(B) + 0.070257 * Math.sin(B)
      - 0.006758 * Math.cos(2 * B) + 0.000907 * Math.sin(2 * B)
      - 0.002697 * Math.cos(3 * B) + 0.00148 * Math.sin(3 * B);

    // Equation of time (minutes)
    var eot = 229.18 * (0.000075 + 0.001868 * Math.cos(B) - 0.032077 * Math.sin(B)
      - 0.014615 * Math.cos(2 * B) - 0.04089 * Math.sin(2 * B));

    // Hour angle
    var utcHours = now.getUTCHours() + now.getUTCMinutes() / 60;
    var solarTime = utcHours + (lon / 15) + (eot / 60);
    var hourAngle = (solarTime - 12) * 15 * Math.PI / 180;

    // Elevation
    var sinElevation = Math.sin(lat) * Math.sin(declination) +
      Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle);
    var elevation = Math.asin(Math.max(-1, Math.min(1, sinElevation))) * 180 / Math.PI;

    // Azimuth
    var cosAzimuth = (Math.sin(declination) - Math.sin(lat) * sinElevation) /
      (Math.cos(lat) * Math.cos(elevation * Math.PI / 180));
    cosAzimuth = Math.max(-1, Math.min(1, cosAzimuth));
    var azimuth = Math.acos(cosAzimuth) * 180 / Math.PI;
    if (hourAngle > 0) azimuth = 360 - azimuth;

    // Sunrise / sunset approximation
    var cosHourAngleSunrise = -Math.tan(lat) * Math.tan(declination);
    var sunriseHour = null;
    var sunsetHour = null;
    if (cosHourAngleSunrise >= -1 && cosHourAngleSunrise <= 1) {
      var haSunrise = Math.acos(cosHourAngleSunrise) * 180 / Math.PI;
      sunriseHour = 12 - (haSunrise / 15) - (eot / 60) - (lon / 15);
      sunsetHour = 12 + (haSunrise / 15) - (eot / 60) - (lon / 15);
    } else if (cosHourAngleSunrise < -1) {
      // Midnight sun
      sunriseHour = 0;
      sunsetHour = 24;
    }
    // else polar night: both remain null

    this.solarState.azimuth = Math.round(azimuth * 100) / 100;
    this.solarState.elevation = Math.round(elevation * 100) / 100;
    this.solarState.isDaylight = elevation > 0;
    this.solarState.lastCalculated = now.toISOString();

    if (sunriseHour !== null) {
      this.solarState.sunrise = this._decimalHoursToTime(sunriseHour);
      this.solarState.sunset = this._decimalHoursToTime(sunsetHour);
      this.solarState.solarNoon = this._decimalHoursToTime((sunriseHour + sunsetHour) / 2);
    }
  }

  /**
   * Solar tracking cycle: recalculate sun position and adjust
   * blinds for optimal light / glare prevention.
   * @private
   */
  _solarTrackingCycle() {
    this._calculateSunPosition();

    if (!this.solarState.isDaylight) return;

    var facingAzimuths = { north: 0, northeast: 45, east: 90, southeast: 135, south: 180, southwest: 225, west: 270, northwest: 315 };
    var sunAz = this.solarState.azimuth;
    var sunEl = this.solarState.elevation;

    var deviceIds = Array.from(this.devices.keys());
    for (var i = 0; i < deviceIds.length; i++) {
      var device = this.devices.get(deviceIds[i]);
      if (!device.isOnline || device.isMoving) continue;

      var windowAz = facingAzimuths[device.facing];
      if (windowAz === undefined) continue;

      var angleDiff = Math.abs(sunAz - windowAz);
      if (angleDiff > 180) angleDiff = 360 - angleDiff;

      // Sun is facing this window (within 90°)
      if (angleDiff < 90 && sunEl > 5) {
        var season = this.energyConfig.currentSeason;
        var glareRisk = sunEl < 30 && angleDiff < 45;

        if (season === 'summer') {
          // Block solar heat gain
          var targetPos = Math.max(0, Math.min(100, 100 - Math.round(sunEl * 1.2)));
          var targetTilt = glareRisk ? 60 : 45;
          if (device.type === 'venetian_blind' || device.type === 'vertical_blind') {
            this._applyPositionIfChanged(device.id, targetPos, targetTilt, 'solar_tracking_summer');
          } else {
            this._applyPositionIfChanged(device.id, Math.min(targetPos, 30), 0, 'solar_tracking_summer');
          }
        } else if (season === 'winter') {
          // Maximize solar heat gain
          if (glareRisk && (device.type === 'venetian_blind' || device.type === 'vertical_blind')) {
            this._applyPositionIfChanged(device.id, 80, 30, 'solar_tracking_winter_antiglare');
          } else {
            this._applyPositionIfChanged(device.id, 100, 0, 'solar_tracking_winter');
          }
        } else {
          // Spring/Autumn — balanced
          if (glareRisk) {
            this._applyPositionIfChanged(device.id, 50, 45, 'solar_tracking_balanced');
          } else {
            this._applyPositionIfChanged(device.id, 75, 0, 'solar_tracking_balanced');
          }
        }
      }
    }

    this.homey.log('[Blinds] Solar tracking: az=' + this.solarState.azimuth + '° el=' + this.solarState.elevation + '°');
  }

  /**
   * Get the sun azimuth/elevation angle for a specific facing direction.
   * @param {string} facing - Cardinal direction of the window
   * @returns {object} Optimal position and tilt
   */
  _getOptimalSolarPosition(facing) {
    var facingAzimuths = { north: 0, east: 90, south: 180, west: 270 };
    var windowAz = facingAzimuths[facing] || 180;
    var angleDiff = Math.abs(this.solarState.azimuth - windowAz);
    if (angleDiff > 180) angleDiff = 360 - angleDiff;
    var sunExposure = angleDiff < 90 ? (90 - angleDiff) / 90 : 0;
    return { sunExposure: sunExposure, optimalPosition: Math.round(sunExposure * 100), glareRisk: this.solarState.elevation < 25 && sunExposure > 0.7 };
  }

  // ════════════════════════════════════════════════════════════════
  //  ENERGY OPTIMIZATION
  // ════════════════════════════════════════════════════════════════

  /**
   * Update the current season based on month.
   * @private
   */
  _updateSeason() {
    var month = new Date().getMonth() + 1;
    var configs = this.energyConfig.seasonalConfig;
    var seasons = Object.keys(configs);
    for (var i = 0; i < seasons.length; i++) {
      if (configs[seasons[i]].months.indexOf(month) !== -1) {
        this.energyConfig.currentSeason = seasons[i];
        break;
      }
    }
    this.homey.log('[Blinds] Current season: ' + this.energyConfig.currentSeason);
  }

  /**
   * Energy optimization cycle: adjust blinds for heating/cooling
   * savings based on season, sun position and outdoor temperature.
   * @private
   */
  _energyOptimizationCycle() {
    var season = this.energyConfig.currentSeason;
    var temp = this.weatherState.temperature;
    var daylight = this.solarState.isDaylight;

    var deviceIds = Array.from(this.devices.keys());
    var totalSavingsThisCycle = 0;

    for (var i = 0; i < deviceIds.length; i++) {
      var device = this.devices.get(deviceIds[i]);
      if (!device.isOnline) continue;

      var windowArea = (device.width * device.height) / 10000; // m²
      var saving = 0;

      if (season === 'summer' && daylight && temp > 22) {
        // Closed blinds reduce solar heat gain
        var blockedFraction = (100 - device.position) / 100;
        var solarGain = windowArea * this.energyConfig.solarHeatGainCoefficient * blockedFraction;
        saving = solarGain * this.energyConfig.coolingCostPerHourSEK * 0.25; // per 15-min cycle
      } else if (season === 'winter' && daylight && temp < 10) {
        // Open blinds allow solar heating
        var openFraction = device.position / 100;
        var solarInfo = this._getOptimalSolarPosition(device.facing);
        var solarContribution = openFraction * solarInfo.sunExposure * windowArea * 0.3;
        saving = solarContribution * this.energyConfig.heatingCostPerHourSEK * 0.25;
      } else if (!daylight) {
        // Night: closed blinds reduce heat loss (U-value improvement)
        var closedFraction = (100 - device.position) / 100;
        var uValueImprovement = closedFraction * 0.3;
        var heatLossReduction = windowArea * uValueImprovement * Math.abs(20 - temp) / 1000;
        saving = heatLossReduction * this.energyConfig.heatingCostPerHourSEK * 0.25;
      }

      totalSavingsThisCycle += saving;
      var stats = this.statistics.get(device.id);
      if (stats) stats.energySavedSEK += saving;
    }

    this.energyStats.dailySavingsSEK += totalSavingsThisCycle;
    this.energyStats.monthlySavingsSEK += totalSavingsThisCycle;
    this.energyStats.yearlySavingsSEK += totalSavingsThisCycle;

    // Check milestone
    if (this.energyStats.yearlySavingsSEK > 0 &&
        Math.floor(this.energyStats.yearlySavingsSEK / this.notificationConfig.energyMilestoneSEK) >
        Math.floor((this.energyStats.yearlySavingsSEK - totalSavingsThisCycle) / this.notificationConfig.energyMilestoneSEK)) {
      var milestone = Math.floor(this.energyStats.yearlySavingsSEK / this.notificationConfig.energyMilestoneSEK) * this.notificationConfig.energyMilestoneSEK;
      this.emit('energy_savings_milestone', { totalSavedSEK: milestone, timestamp: new Date().toISOString() });
      this.homey.log('[Blinds] Energy savings milestone reached: ' + milestone + ' SEK');
    }
  }

  /**
   * Get a comprehensive energy report.
   * @returns {object} Energy report with savings breakdown
   */
  getEnergyReport() {
    var perDevice = [];
    var deviceIds = Array.from(this.devices.keys());
    for (var i = 0; i < deviceIds.length; i++) {
      var d = this.devices.get(deviceIds[i]);
      var s = this.statistics.get(deviceIds[i]);
      perDevice.push({
        id: d.id, name: d.name, room: d.room, facing: d.facing,
        energySavedSEK: s ? Math.round(s.energySavedSEK * 100) / 100 : 0,
        solarGainKwh: s ? Math.round(s.solarGainKwh * 100) / 100 : 0,
        totalCycles: s ? s.totalCycles : 0
      });
    }

    return {
      summary: {
        dailySavingsSEK: Math.round(this.energyStats.dailySavingsSEK * 100) / 100,
        monthlySavingsSEK: Math.round(this.energyStats.monthlySavingsSEK * 100) / 100,
        yearlySavingsSEK: Math.round(this.energyStats.yearlySavingsSEK * 100) / 100,
        currentSeason: this.energyConfig.currentSeason,
        strategy: this.energyConfig.seasonalConfig[this.energyConfig.currentSeason].strategy
      },
      perDevice: perDevice,
      timestamp: new Date().toISOString()
    };
  }

  // ════════════════════════════════════════════════════════════════
  //  PRIVACY MODES
  // ════════════════════════════════════════════════════════════════

  /**
   * Privacy evaluation cycle: handle sunset/sunrise auto-close/open,
   * per-room schedules, and occupancy-based security logic.
   * @private
   */
  _privacyEvaluationCycle() {
    var now = new Date();
    var currentTime = this._formatTime(now);
    var isWeekend = now.getDay() === 0 || now.getDay() === 6;

    // Sunset auto-close
    if (this.privacyConfig.autoCloseAtSunset && this.solarState.sunset) {
      var sunsetTime = this._addMinutesToTime(this.solarState.sunset, this.privacyConfig.sunsetOffsetMinutes);
      if (this._isTimeMatch(currentTime, sunsetTime)) {
        this._closeStreetFacingBlinds('sunset_auto_close');
      }
    }

    // Sunrise auto-open
    if (this.privacyConfig.autoOpenAtSunrise && this.solarState.sunrise) {
      var sunriseTime = this._addMinutesToTime(this.solarState.sunrise, this.privacyConfig.sunriseOffsetMinutes);
      if (this._isTimeMatch(currentTime, sunriseTime)) {
        this._openNonPrivateBlinds('sunrise_auto_open');
      }
    }

    // Per-room privacy schedules
    var scheduleIds = Array.from(this.privacySchedules.keys());
    for (var i = 0; i < scheduleIds.length; i++) {
      var roomId = scheduleIds[i];
      var sched = this.privacySchedules.get(roomId);
      if (sched.alwaysPrivate) continue;

      var openTime = isWeekend && sched.weekendOpenTime ? sched.weekendOpenTime : sched.openTime;
      var closeTime = sched.closeTime === 'sunset' ? this.solarState.sunset : sched.closeTime;

      if (closeTime && this._isTimeMatch(currentTime, closeTime)) {
        this._setZonePosition(roomId, 0, 0, 'privacy_schedule_close');
      }
      if (openTime && this._isTimeMatch(currentTime, openTime)) {
        this._setZonePosition(roomId, 80, 0, 'privacy_schedule_open');
      }
    }

    // Occupancy-based security
    if (this.privacyConfig.occupancyBasedSecurity) {
      var roomIds = Array.from(this.roomOccupancy.keys());
      for (var j = 0; j < roomIds.length; j++) {
        var occData = this.roomOccupancy.get(roomIds[j]);
        if (!occData.occupied && occData.lastSeen) {
          var minutesEmpty = (now.getTime() - new Date(occData.lastSeen).getTime()) / 60000;
          if (minutesEmpty >= this.privacyConfig.unoccupiedCloseDelayMinutes) {
            var zone = this.zones.get(roomIds[j]);
            if (zone && this.privacyConfig.streetFacingRooms.indexOf(roomIds[j]) !== -1) {
              this._setZonePosition(roomIds[j], 10, 0, 'occupancy_security');
            }
          }
        }
      }
    }
  }

  /**
   * Close all street-facing blinds for privacy.
   * @param {string} reason - Trigger reason
   * @private
   */
  _closeStreetFacingBlinds(reason) {
    var deviceIds = Array.from(this.devices.keys());
    for (var i = 0; i < deviceIds.length; i++) {
      var d = this.devices.get(deviceIds[i]);
      if (d.isStreetFacing && d.isOnline) {
        this._applyPositionIfChanged(d.id, 0, 0, reason);
      }
    }
    this.homey.log('[Blinds] Street-facing blinds closed: ' + reason);
  }

  /**
   * Open all non-privacy blinds for daylight.
   * @param {string} reason - Trigger reason
   * @private
   */
  _openNonPrivateBlinds(reason) {
    var deviceIds = Array.from(this.devices.keys());
    for (var i = 0; i < deviceIds.length; i++) {
      var d = this.devices.get(deviceIds[i]);
      var schedule = this.privacySchedules.get(d.room);
      if (schedule && schedule.alwaysPrivate) continue;
      if (d.isOnline) {
        this._applyPositionIfChanged(d.id, 80, 0, reason);
      }
    }
  }

  // ════════════════════════════════════════════════════════════════
  //  SCENE INTEGRATION
  // ════════════════════════════════════════════════════════════════

  /**
   * Activate a scene by its ID.
   * @param {string} sceneId - The scene identifier
   * @returns {object} Result with applied actions
   */
  activateScene(sceneId) {
    var scene = this.scenes.get(sceneId);
    if (!scene) return { success: false, error: 'Unknown scene: ' + sceneId };

    this.homey.log('[Blinds] Activating scene: ' + scene.name);

    // Deactivate other scenes first
    var sceneKeys = Array.from(this.scenes.keys());
    for (var k = 0; k < sceneKeys.length; k++) {
      this.scenes.get(sceneKeys[k]).isActive = false;
    }
    scene.isActive = true;
    scene.lastTriggered = new Date().toISOString();

    var appliedCount = 0;
    for (var i = 0; i < scene.actions.length; i++) {
      var action = scene.actions[i];
      if (action.zone === 'all') {
        var allZoneIds = Array.from(this.zones.keys());
        for (var z = 0; z < allZoneIds.length; z++) {
          this._setZonePosition(allZoneIds[z], action.position, action.tilt, 'scene_' + sceneId);
          appliedCount++;
        }
      } else {
        this._setZonePosition(action.zone, action.position, action.tilt, 'scene_' + sceneId);
        appliedCount++;
      }
    }

    // Sync with wake-up system if applicable
    if (scene.syncWithWakeUpSystem) {
      this.emit('wakeup_sync_request', { sceneId: sceneId, timestamp: new Date().toISOString() });
    }

    this.emit('scene_activated', { sceneId: sceneId, name: scene.name, actionsApplied: appliedCount, timestamp: new Date().toISOString() });
    return { success: true, sceneId: sceneId, name: scene.name, actionsApplied: appliedCount };
  }

  /**
   * Deactivate the currently active scene.
   * @returns {object} Result
   */
  deactivateScene() {
    var sceneKeys = Array.from(this.scenes.keys());
    var deactivated = null;
    for (var i = 0; i < sceneKeys.length; i++) {
      var s = this.scenes.get(sceneKeys[i]);
      if (s.isActive) {
        deactivated = s.name;
        s.isActive = false;
      }
    }
    return { success: true, deactivated: deactivated };
  }

  // ════════════════════════════════════════════════════════════════
  //  WEATHER INTEGRATION
  // ════════════════════════════════════════════════════════════════

  /**
   * Update weather data from an external source.
   * @param {object} weatherData - Current weather conditions
   */
  updateWeather(weatherData) {
    if (weatherData.temperature !== undefined) this.weatherState.temperature = weatherData.temperature;
    if (weatherData.windSpeed !== undefined) this.weatherState.windSpeed = weatherData.windSpeed;
    if (weatherData.windGust !== undefined) this.weatherState.windGust = weatherData.windGust;
    if (weatherData.rainIntensity !== undefined) this.weatherState.rainIntensity = weatherData.rainIntensity;
    if (weatherData.snowfall !== undefined) this.weatherState.snowfall = weatherData.snowfall;
    if (weatherData.humidity !== undefined) this.weatherState.humidity = weatherData.humidity;
    if (weatherData.forecast) this.weatherState.forecast = weatherData.forecast;
    this._weatherCheckCycle();
  }

  /**
   * Weather check cycle: retract exterior blinds during dangerous
   * conditions (wind, rain, frost, hail).
   * @private
   */
  _weatherCheckCycle() {
    var wind = Math.max(this.weatherState.windSpeed, this.weatherState.windGust);
    var rain = this.weatherState.rainIntensity;
    var temp = this.weatherState.temperature;
    var alertsTriggered = [];

    // High wind — retract external shutters
    if (wind >= this.weatherThresholds.highWindRetractSpeed) {
      this._retractExteriorDevices('wind_safety');
      alertsTriggered.push('high_wind');
    }

    // Storm — retract everything exterior
    if (wind >= this.weatherThresholds.stormRetractSpeed) {
      this._retractExteriorDevices('storm_safety');
      alertsTriggered.push('storm');
    }

    // Heavy rain — retract exterior and close skylights
    if (rain >= this.weatherThresholds.heavyRainRetract) {
      this._retractExteriorDevices('rain_safety');
      this._closeSkylights('rain_safety');
      alertsTriggered.push('heavy_rain');
    }

    // Frost protection
    if (temp <= this.weatherThresholds.frostProtectionTemp) {
      this._frostProtection();
      alertsTriggered.push('frost');
    }

    if (alertsTriggered.length > 0) {
      this.weatherState.alerts = alertsTriggered;
      this.emit('weather_alert_retract', { alerts: alertsTriggered, wind: wind, rain: rain, temp: temp, timestamp: new Date().toISOString() });
      this.homey.log('[Blinds] Weather alerts triggered: ' + alertsTriggered.join(', '));
    }
  }

  /**
   * Retract all exterior devices.
   * @param {string} reason - Why we are retracting
   * @private
   */
  _retractExteriorDevices(reason) {
    var deviceIds = Array.from(this.devices.keys());
    for (var i = 0; i < deviceIds.length; i++) {
      var d = this.devices.get(deviceIds[i]);
      if (d.isExterior && d.isOnline && d.position > 0) {
        this._setDevicePosition(d.id, 0, 0, reason);
      }
    }
  }

  /**
   * Close all skylight blinds.
   * @param {string} reason
   * @private
   */
  _closeSkylights(reason) {
    var deviceIds = Array.from(this.devices.keys());
    for (var i = 0; i < deviceIds.length; i++) {
      var d = this.devices.get(deviceIds[i]);
      if (d.type === 'skylight_blind' && d.isOnline) {
        this._setDevicePosition(d.id, 0, 0, reason);
      }
    }
  }

  /**
   * Apply frost protection to exterior devices — close fully to
   * provide insulation layer.
   * @private
   */
  _frostProtection() {
    var deviceIds = Array.from(this.devices.keys());
    for (var i = 0; i < deviceIds.length; i++) {
      var d = this.devices.get(deviceIds[i]);
      if (d.isExterior && d.isOnline) {
        this._setDevicePosition(d.id, 0, 0, 'frost_protection');
      }
    }
    this.homey.log('[Blinds] Frost protection activated at ' + this.weatherState.temperature + '°C');
  }

  // ════════════════════════════════════════════════════════════════
  //  SCHEDULING
  // ════════════════════════════════════════════════════════════════

  /**
   * Evaluate all active schedules and execute matching ones.
   * @private
   */
  _evaluateAllSchedules() {
    var now = new Date();
    var currentTime = this._formatTime(now);
    var dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    var today = dayNames[now.getDay()];

    var scheduleIds = Array.from(this.schedules.keys());
    for (var i = 0; i < scheduleIds.length; i++) {
      var sched = this.schedules.get(scheduleIds[i]);
      if (!sched.enabled) continue;
      if (sched.days.indexOf(today) === -1) continue;

      var triggerTime = null;
      if (sched.triggerType === 'time') {
        triggerTime = sched.triggerValue;
      } else if (sched.triggerType === 'sunrise' && this.solarState.sunrise) {
        triggerTime = this._addMinutesToTime(this.solarState.sunrise, sched.sunriseOffset || 0);
      } else if (sched.triggerType === 'sunset' && this.solarState.sunset) {
        triggerTime = this._addMinutesToTime(this.solarState.sunset, sched.sunsetOffset || 0);
      }

      if (triggerTime && this._isTimeMatch(currentTime, triggerTime)) {
        // Avoid re-triggering within same minute
        if (sched.lastRun && this._isTimeMatch(sched.lastRun.slice(11, 16), currentTime)) continue;
        this._executeSchedule(sched);
        sched.lastRun = now.toISOString();
      }
    }
  }

  /**
   * Execute a single schedule's actions.
   * @param {object} schedule - The schedule to execute
   * @private
   */
  _executeSchedule(schedule) {
    this.homey.log('[Blinds] Executing schedule: ' + schedule.name);
    for (var i = 0; i < schedule.actions.length; i++) {
      var action = schedule.actions[i];
      if (action.deviceId === 'all') {
        var allIds = Array.from(this.devices.keys());
        for (var j = 0; j < allIds.length; j++) {
          this._setDevicePosition(allIds[j], action.position, action.tilt, 'schedule_' + schedule.id);
        }
      } else {
        this._setDevicePosition(action.deviceId, action.position, action.tilt, 'schedule_' + schedule.id);
      }
    }

    // Handle occupancy simulation in holiday mode
    if (schedule.simulateOccupancy) {
      this._randomizePositionsForOccupancySimulation();
    }
  }

  /**
   * Add a new schedule.
   * @param {object} scheduleData - Schedule configuration
   * @returns {object} Result with schedule ID
   */
  addSchedule(scheduleData) {
    if (!scheduleData.id) scheduleData.id = 'sched-' + Date.now();
    if (!scheduleData.name) return { success: false, error: 'Schedule name required' };
    if (!scheduleData.actions || scheduleData.actions.length === 0) return { success: false, error: 'At least one action required' };

    var schedule = {
      id: scheduleData.id,
      name: scheduleData.name,
      enabled: scheduleData.enabled !== false,
      days: scheduleData.days || ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      triggerType: scheduleData.triggerType || 'time',
      triggerValue: scheduleData.triggerValue || null,
      sunriseOffset: scheduleData.sunriseOffset || null,
      sunsetOffset: scheduleData.sunsetOffset || null,
      actions: scheduleData.actions,
      lastRun: null,
      nextRun: null,
      simulateOccupancy: scheduleData.simulateOccupancy || false
    };

    this.schedules.set(schedule.id, schedule);
    this.homey.log('[Blinds] Schedule added: ' + schedule.name);
    return { success: true, scheduleId: schedule.id };
  }

  /**
   * Remove a schedule by ID.
   * @param {string} scheduleId - Schedule to remove
   * @returns {object} Result
   */
  removeSchedule(scheduleId) {
    if (!this.schedules.has(scheduleId)) return { success: false, error: 'Schedule not found' };
    var name = this.schedules.get(scheduleId).name;
    this.schedules.delete(scheduleId);
    this.homey.log('[Blinds] Schedule removed: ' + name);
    return { success: true, removed: name };
  }

  // ════════════════════════════════════════════════════════════════
  //  AUTOMATION RULES
  // ════════════════════════════════════════════════════════════════

  /**
   * Evaluate all automation rules against current conditions.
   * @private
   */
  _evaluateAutomationRules() {
    var ruleIds = Array.from(this.automationRules.keys());
    var now = Date.now();

    for (var i = 0; i < ruleIds.length; i++) {
      var rule = this.automationRules.get(ruleIds[i]);
      if (!rule.enabled) continue;

      // Check cooldown
      if (rule.lastTriggered) {
        var elapsed = (now - new Date(rule.lastTriggered).getTime()) / 60000;
        if (elapsed < rule.cooldownMinutes) continue;
      }

      // Check season restriction
      if (rule.seasonRestriction && rule.seasonRestriction !== this.energyConfig.currentSeason) continue;

      var triggered = false;

      if (rule.trigger === 'temperature') {
        if (rule.condition === 'above' && this.weatherState.temperature > rule.value) triggered = true;
        if (rule.condition === 'below' && this.weatherState.temperature < rule.value) triggered = true;
      } else if (rule.trigger === 'humidity') {
        if (rule.condition === 'above' && this.weatherState.humidity > rule.value) triggered = true;
        if (rule.condition === 'below' && this.weatherState.humidity < rule.value) triggered = true;
      } else if (rule.trigger === 'light_level') {
        // Light level would come from sensor data; use sun elevation as proxy
        var estimatedLux = this.solarState.isDaylight ? Math.max(0, this.solarState.elevation * 1500) : 0;
        if (rule.condition === 'above' && estimatedLux > rule.value) triggered = true;
        if (rule.condition === 'below' && estimatedLux < rule.value) triggered = true;
      } else if (rule.trigger === 'occupancy') {
        // Evaluate per target room
        if (rule.targetRooms) {
          for (var r = 0; r < rule.targetRooms.length; r++) {
            var occ = this.roomOccupancy.get(rule.targetRooms[r]);
            if (occ) {
              if (rule.condition === 'unoccupied' && !occ.occupied) triggered = true;
              if (rule.condition === 'occupied' && occ.occupied) triggered = true;
            }
          }
        }
      }

      if (triggered) {
        this._executeAutomationRule(rule);
        rule.lastTriggered = new Date().toISOString();
      }
    }
  }

  /**
   * Execute a triggered automation rule.
   * @param {object} rule - The rule to execute
   * @private
   */
  _executeAutomationRule(rule) {
    this.homey.log('[Blinds] Automation rule triggered: ' + rule.name);

    var targetDevices = this._getDevicesForRule(rule);
    for (var i = 0; i < targetDevices.length; i++) {
      var device = targetDevices[i];
      if (!device.isOnline) continue;

      switch (rule.action) {
        case 'close':
          this._setDevicePosition(device.id, 0, 0, 'rule_' + rule.id);
          break;
        case 'open':
          this._setDevicePosition(device.id, 100, 0, 'rule_' + rule.id);
          break;
        case 'tilt_45':
          this._setDevicePosition(device.id, device.position, 45, 'rule_' + rule.id);
          break;
        case 'energy_position':
          var ePos = this._calculateEnergyPosition(device);
          this._setDevicePosition(device.id, ePos.position, ePos.tilt, 'rule_' + rule.id);
          break;
        case 'restore_previous':
          var fav = device.favoritePositions;
          var hour = new Date().getHours();
          var period = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
          this._setDevicePosition(device.id, fav[period], 0, 'rule_' + rule.id);
          break;
        default:
          break;
      }
    }
  }

  /**
   * Get the list of devices matching a rule's target criteria.
   * @param {object} rule - Automation rule
   * @returns {Array} Matching devices
   * @private
   */
  _getDevicesForRule(rule) {
    var result = [];
    var deviceIds = Array.from(this.devices.keys());

    for (var i = 0; i < deviceIds.length; i++) {
      var d = this.devices.get(deviceIds[i]);
      var match = true;

      if (rule.targetFacing) {
        if (rule.targetFacing.indexOf(d.facing) === -1) match = false;
      }
      if (rule.targetRooms) {
        if (rule.targetRooms.indexOf(d.room) === -1) match = false;
      }

      if (match) result.push(d);
    }
    return result;
  }

  /**
   * Calculate the optimal energy-saving position for a device.
   * @param {object} device - The blind device
   * @returns {object} { position, tilt }
   * @private
   */
  _calculateEnergyPosition(device) {
    var season = this.energyConfig.currentSeason;
    var daylight = this.solarState.isDaylight;

    if (!daylight) return { position: 0, tilt: 0 };

    var solar = this._getOptimalSolarPosition(device.facing);
    if (season === 'summer') {
      return { position: solar.sunExposure > 0.5 ? 10 : 50, tilt: solar.glareRisk ? 60 : 30 };
    } else if (season === 'winter') {
      return { position: solar.sunExposure > 0.3 ? 90 : 40, tilt: 0 };
    }
    return { position: 60, tilt: 15 };
  }

  // ════════════════════════════════════════════════════════════════
  //  OCCUPANCY SIMULATION
  // ════════════════════════════════════════════════════════════════

  /**
   * Simulate occupancy by randomly adjusting blind positions when
   * the away scene is active.
   * @private
   */
  _occupancySimulationCycle() {
    var awayScene = this.scenes.get('away');
    if (!awayScene || !awayScene.isActive) return;

    this._randomizePositionsForOccupancySimulation();
    this.homey.log('[Blinds] Occupancy simulation: positions randomized');
  }

  /**
   * Randomize positions for selected rooms to simulate presence.
   * @private
   */
  _randomizePositionsForOccupancySimulation() {
    var hour = new Date().getHours();
    if (hour < 6 || hour > 23) return; // Don't simulate at night

    var roomsToSimulate = ['vardagsrum', 'kontor', 'kok'];
    for (var i = 0; i < roomsToSimulate.length; i++) {
      var zone = this.zones.get(roomsToSimulate[i]);
      if (!zone) continue;

      // Pick 1-2 random devices in the zone
      var devicesToMove = Math.min(2, Math.ceil(Math.random() * zone.devices.length));
      for (var j = 0; j < devicesToMove; j++) {
        var idx = Math.floor(Math.random() * zone.devices.length);
        var deviceId = zone.devices[idx];
        var randomPos = 20 + Math.floor(Math.random() * 60);
        this._setDevicePosition(deviceId, randomPos, 0, 'occupancy_simulation');
      }
    }
  }

  // ════════════════════════════════════════════════════════════════
  //  STATISTICS & ANALYTICS
  // ════════════════════════════════════════════════════════════════

  /**
   * Collect statistics on all devices.
   * @private
   */
  _statisticsCollectionCycle() {
    var deviceIds = Array.from(this.devices.keys());
    for (var i = 0; i < deviceIds.length; i++) {
      var device = this.devices.get(deviceIds[i]);
      var stats = this.statistics.get(deviceIds[i]);
      if (!stats) continue;

      stats.positionHistory.push({
        position: device.position,
        tilt: device.tilt,
        timestamp: new Date().toISOString()
      });

      // Keep last 168 entries (7 days at hourly)
      if (stats.positionHistory.length > 168) {
        stats.positionHistory = stats.positionHistory.slice(-168);
      }

      // Calculate average daily position
      var sum = 0;
      var count = 0;
      for (var j = 0; j < stats.positionHistory.length; j++) {
        sum += stats.positionHistory[j].position;
        count++;
      }
      stats.avgDailyPosition = count > 0 ? Math.round(sum / count) : 50;
    }
  }

  /**
   * Reset daily statistics counters when date changes.
   * @private
   */
  _dailyStatsReset() {
    var today = new Date().toISOString().slice(0, 10);
    var deviceIds = Array.from(this.statistics.keys());
    for (var i = 0; i < deviceIds.length; i++) {
      var stats = this.statistics.get(deviceIds[i]);
      if (stats.lastResetDate !== today) {
        stats.dailyCycles = 0;
        stats.dailyTiltChanges = 0;
        stats.lastResetDate = today;
      }
    }

    // Reset daily energy savings
    this.energyStats.dailySavingsSEK = 0;
  }

  /**
   * Get usage statistics for all devices or a specific room.
   * @param {string} [roomId] - Optional room filter
   * @returns {object} Statistics report
   */
  getStatistics(roomId) {
    var result = { devices: [], totals: { totalCycles: 0, totalEnergySavedSEK: 0, avgPosition: 0 } };
    var positionSum = 0;
    var deviceCount = 0;

    var deviceIds = Array.from(this.devices.keys());
    for (var i = 0; i < deviceIds.length; i++) {
      var device = this.devices.get(deviceIds[i]);
      if (roomId && device.room !== roomId) continue;

      var stats = this.statistics.get(deviceIds[i]);
      if (!stats) continue;

      result.devices.push({
        id: device.id, name: device.name, room: device.room,
        totalCycles: stats.totalCycles, dailyCycles: stats.dailyCycles,
        totalTiltChanges: stats.totalTiltChanges,
        energySavedSEK: Math.round(stats.energySavedSEK * 100) / 100,
        avgDailyPosition: stats.avgDailyPosition
      });

      result.totals.totalCycles += stats.totalCycles;
      result.totals.totalEnergySavedSEK += stats.energySavedSEK;
      positionSum += stats.avgDailyPosition;
      deviceCount++;
    }

    result.totals.totalEnergySavedSEK = Math.round(result.totals.totalEnergySavedSEK * 100) / 100;
    result.totals.avgPosition = deviceCount > 0 ? Math.round(positionSum / deviceCount) : 0;
    result.timestamp = new Date().toISOString();
    return result;
  }

  // ════════════════════════════════════════════════════════════════
  //  HEALTH CHECKS & NOTIFICATIONS
  // ════════════════════════════════════════════════════════════════

  /**
   * Check battery levels, motor health, and calibration status for
   * all devices. Emit notifications as needed.
   * @private
   */
  _healthCheckCycle() {
    var deviceIds = Array.from(this.devices.keys());
    var now = new Date();

    for (var i = 0; i < deviceIds.length; i++) {
      var device = this.devices.get(deviceIds[i]);

      // Battery check
      if (device.batteryLevel <= this.notificationConfig.batteryLowThreshold) {
        this.emit('battery_low', {
          deviceId: device.id, name: device.name,
          batteryLevel: device.batteryLevel,
          timestamp: now.toISOString()
        });
        this.homey.log('[Blinds] Battery low: ' + device.name + ' (' + device.batteryLevel + '%)');
      }

      // Motor cycle warning
      if (device.motorCycles >= this.notificationConfig.motorCycleCritical) {
        this.emit('motor_stuck', {
          deviceId: device.id, name: device.name,
          motorCycles: device.motorCycles, level: 'critical',
          timestamp: now.toISOString()
        });
      } else if (device.motorCycles >= this.notificationConfig.motorCycleWarning) {
        this.emit('motor_stuck', {
          deviceId: device.id, name: device.name,
          motorCycles: device.motorCycles, level: 'warning',
          timestamp: now.toISOString()
        });
      }

      // Calibration check
      if (device.lastCalibrated) {
        var daysSinceCalibration = (now.getTime() - new Date(device.lastCalibrated).getTime()) / 86400000;
        if (daysSinceCalibration > this.notificationConfig.calibrationIntervalDays) {
          this.emit('calibration_needed', {
            deviceId: device.id, name: device.name,
            daysSinceCalibration: Math.round(daysSinceCalibration),
            timestamp: now.toISOString()
          });
        }
      }
    }
  }

  // ════════════════════════════════════════════════════════════════
  //  API METHODS
  // ════════════════════════════════════════════════════════════════

  /**
   * Set the position of a specific blind/shutter.
   * @param {string} deviceId - Device identifier
   * @param {number} position - Target position (0=closed, 100=fully open)
   * @param {object} [options] - Additional options
   * @param {number} [options.tilt] - Tilt angle (0-90)
   * @param {string} [options.speed] - Motor speed (slow, normal, fast)
   * @returns {object} Result of the operation
   */
  setPosition(deviceId, position, options) {
    var device = this.devices.get(deviceId);
    if (!device) return { success: false, error: 'Device not found: ' + deviceId };
    if (!device.isOnline) return { success: false, error: 'Device offline: ' + device.name };
    if (position < 0 || position > 100) return { success: false, error: 'Position must be 0-100' };

    var tilt = (options && options.tilt !== undefined) ? options.tilt : device.tilt;
    var speed = (options && options.speed) ? options.speed : device.speed;

    if (tilt < 0 || tilt > 90) return { success: false, error: 'Tilt must be 0-90' };

    device.speed = speed;
    this._setDevicePosition(deviceId, position, tilt, 'api_setPosition');

    return {
      success: true,
      deviceId: deviceId,
      name: device.name,
      position: device.position,
      tilt: device.tilt,
      previousPosition: device.position,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Set the tilt angle of a venetian or vertical blind.
   * @param {string} deviceId - Device identifier
   * @param {number} tilt - Target tilt angle (0-90)
   * @returns {object} Result
   */
  setTilt(deviceId, tilt) {
    var device = this.devices.get(deviceId);
    if (!device) return { success: false, error: 'Device not found: ' + deviceId };
    if (!device.isOnline) return { success: false, error: 'Device offline: ' + device.name };
    if (device.type !== 'venetian_blind' && device.type !== 'vertical_blind') {
      return { success: false, error: 'Tilt not supported for ' + device.type };
    }
    if (tilt < 0 || tilt > 90) return { success: false, error: 'Tilt must be 0-90' };

    var oldTilt = device.tilt;
    device.tilt = tilt;
    device.targetTilt = tilt;
    device.lastMoved = new Date().toISOString();

    var stats = this.statistics.get(deviceId);
    if (stats) {
      stats.totalTiltChanges++;
      stats.dailyTiltChanges++;
    }

    this._logPosition(deviceId, device.position, tilt, 'api_setTilt');
    this.homey.log('[Blinds] Tilt set: ' + device.name + ' ' + oldTilt + '° -> ' + tilt + '°');

    return { success: true, deviceId: deviceId, name: device.name, tilt: tilt, oldTilt: oldTilt };
  }

  /**
   * Set the position of all devices in a zone/room group.
   * @param {string} zoneId - Zone identifier
   * @param {number} position - Target position (0-100)
   * @param {object} [options] - Additional options
   * @param {number} [options.tilt] - Tilt angle
   * @param {string} [options.preset] - Preset name instead of position
   * @returns {object} Result
   */
  setGroupPosition(zoneId, position, options) {
    var zone = this.zones.get(zoneId);
    if (!zone) return { success: false, error: 'Zone not found: ' + zoneId };

    // Handle preset
    if (options && options.preset) {
      var preset = this.zonePresets[options.preset];
      if (!preset) return { success: false, error: 'Unknown preset: ' + options.preset };
      if (preset.position !== null) position = preset.position;
      if (preset.tilt !== null && options) options.tilt = preset.tilt;
    }

    if (position < 0 || position > 100) return { success: false, error: 'Position must be 0-100' };

    var tilt = (options && options.tilt !== undefined) ? options.tilt : 0;
    this._setZonePosition(zoneId, position, tilt, 'api_setGroupPosition');

    zone.activePreset = (options && options.preset) ? options.preset : null;
    zone.lastChanged = new Date().toISOString();

    return {
      success: true,
      zoneId: zoneId,
      name: zone.name,
      position: position,
      tilt: tilt,
      devicesAffected: zone.devices.length,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get the comprehensive status of all devices, zones, solar state,
   * weather, and active scenes.
   * @returns {object} Full system status
   */
  getStatus() {
    var devices = [];
    var deviceIds = Array.from(this.devices.keys());
    for (var i = 0; i < deviceIds.length; i++) {
      var d = this.devices.get(deviceIds[i]);
      devices.push({
        id: d.id, name: d.name, room: d.room, type: d.type,
        position: d.position, tilt: d.tilt, batteryLevel: d.batteryLevel,
        motorStatus: d.motorStatus, isOnline: d.isOnline, isMoving: d.isMoving,
        facing: d.facing, isExterior: d.isExterior
      });
    }

    var zones = [];
    var zoneIds = Array.from(this.zones.keys());
    for (var j = 0; j < zoneIds.length; j++) {
      var z = this.zones.get(zoneIds[j]);
      zones.push({ id: z.id, name: z.name, devices: z.devices.length, activePreset: z.activePreset });
    }

    var activeScene = null;
    var sceneKeys = Array.from(this.scenes.keys());
    for (var k = 0; k < sceneKeys.length; k++) {
      if (this.scenes.get(sceneKeys[k]).isActive) {
        activeScene = sceneKeys[k];
        break;
      }
    }

    return {
      initialized: this.initialized,
      devices: devices,
      zones: zones,
      solar: {
        azimuth: this.solarState.azimuth,
        elevation: this.solarState.elevation,
        sunrise: this.solarState.sunrise,
        sunset: this.solarState.sunset,
        isDaylight: this.solarState.isDaylight
      },
      weather: {
        temperature: this.weatherState.temperature,
        windSpeed: this.weatherState.windSpeed,
        alerts: this.weatherState.alerts
      },
      activeScene: activeScene,
      currentSeason: this.energyConfig.currentSeason,
      energySavings: {
        dailySEK: Math.round(this.energyStats.dailySavingsSEK * 100) / 100,
        monthlySEK: Math.round(this.energyStats.monthlySavingsSEK * 100) / 100,
        yearlySEK: Math.round(this.energyStats.yearlySavingsSEK * 100) / 100
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Calibrate a specific device — resets motor position tracking
   * and marks the device as freshly calibrated.
   * @param {string} deviceId - Device to calibrate
   * @returns {object} Calibration result
   */
  calibrate(deviceId) {
    var device = this.devices.get(deviceId);
    if (!device) return { success: false, error: 'Device not found: ' + deviceId };
    if (!device.isOnline) return { success: false, error: 'Device offline: ' + device.name };

    this.homey.log('[Blinds] Calibrating device: ' + device.name);

    // Simulate calibration: move to full close, then full open
    device.motorStatus = 'calibrating';
    device.isMoving = true;

    // Schedule calibration completion
    var self = this;
    setTimeout(function () {
      device.motorStatus = 'idle';
      device.isMoving = false;
      device.position = 0;
      device.tilt = 0;
      device.lastCalibrated = new Date().toISOString();
      device.obstacleDetected = false;

      self.calibrationState.set(deviceId, {
        lastCalibrated: device.lastCalibrated,
        calibrationCount: (self.calibrationState.get(deviceId) || { calibrationCount: 0 }).calibrationCount + 1,
        status: 'completed'
      });

      self.emit('calibration_completed', {
        deviceId: device.id, name: device.name,
        timestamp: device.lastCalibrated
      });
      self.homey.log('[Blinds] Calibration complete: ' + device.name);
    }, 10000);

    return {
      success: true,
      deviceId: deviceId,
      name: device.name,
      status: 'calibrating',
      estimatedTimeSeconds: 10
    };
  }

  /**
   * Update the room occupancy state (called by external sensors).
   * @param {string} roomId - Room identifier
   * @param {boolean} occupied - Whether the room is occupied
   */
  updateOccupancy(roomId, occupied) {
    this.roomOccupancy.set(roomId, {
      occupied: occupied,
      lastSeen: occupied ? new Date().toISOString() : (this.roomOccupancy.get(roomId) || {}).lastSeen || null,
      updatedAt: new Date().toISOString()
    });
  }

  /**
   * Set position for all devices, optionally filtered.
   * @param {number} position - Target position
   * @param {object} [filter] - Filter criteria
   * @param {string} [filter.type] - Device type filter
   * @param {string} [filter.facing] - Facing direction filter
   * @param {boolean} [filter.exteriorOnly] - Only exterior devices
   * @returns {object} Result
   */
  setAllPositions(position, filter) {
    if (position < 0 || position > 100) return { success: false, error: 'Position must be 0-100' };

    var affected = 0;
    var deviceIds = Array.from(this.devices.keys());

    for (var i = 0; i < deviceIds.length; i++) {
      var device = this.devices.get(deviceIds[i]);
      if (!device.isOnline) continue;

      if (filter) {
        if (filter.type && device.type !== filter.type) continue;
        if (filter.facing && device.facing !== filter.facing) continue;
        if (filter.exteriorOnly && !device.isExterior) continue;
      }

      this._setDevicePosition(device.id, position, 0, 'api_setAllPositions');
      affected++;
    }

    return { success: true, affected: affected, position: position, timestamp: new Date().toISOString() };
  }

  /**
   * Get the position log for audit / analytics.
   * @param {object} [filter] - Filter options
   * @param {string} [filter.deviceId] - Specific device
   * @param {string} [filter.room] - Specific room
   * @param {number} [filter.limit] - Max entries
   * @returns {Array} Position log entries
   */
  getPositionLog(filter) {
    var log = this.positionLog;

    if (filter) {
      if (filter.deviceId) {
        log = log.filter(function (e) { return e.deviceId === filter.deviceId; });
      }
      if (filter.room) {
        log = log.filter(function (e) { return e.room === filter.room; });
      }
      if (filter.limit) {
        log = log.slice(-filter.limit);
      }
    }

    return log;
  }

  /**
   * Add or update a device in the system.
   * @param {object} deviceData - Device configuration
   * @returns {object} Result
   */
  addDevice(deviceData) {
    if (!deviceData.id) return { success: false, error: 'Device ID required' };
    if (!deviceData.name) return { success: false, error: 'Device name required' };
    if (this.deviceTypes.indexOf(deviceData.type) === -1) {
      return { success: false, error: 'Invalid type. Supported: ' + this.deviceTypes.join(', ') };
    }

    this.devices.set(deviceData.id, {
      id: deviceData.id,
      name: deviceData.name,
      room: deviceData.room || 'unassigned',
      type: deviceData.type,
      facing: deviceData.facing || 'south',
      width: deviceData.width || 100,
      height: deviceData.height || 150,
      isExterior: deviceData.isExterior || false,
      isStreetFacing: deviceData.isStreetFacing || false,
      position: 0,
      targetPosition: 0,
      tilt: 0,
      targetTilt: 0,
      batteryLevel: 100,
      motorStatus: 'idle',
      motorCycles: 0,
      lastMoved: null,
      lastCalibrated: null,
      firmware: '2.4.1',
      signalStrength: -50,
      isOnline: true,
      isMoving: false,
      speed: 'normal',
      obstacleDetected: false,
      favoritePositions: { morning: 80, afternoon: 50, evening: 10, night: 0 },
      errorHistory: [],
      installed: new Date().toISOString()
    });

    // Initialize statistics
    this.statistics.set(deviceData.id, {
      totalCycles: 0, totalTiltChanges: 0, dailyCycles: 0, dailyTiltChanges: 0,
      energySavedSEK: 0, solarGainKwh: 0, avgDailyPosition: 50,
      positionHistory: [], lastResetDate: new Date().toISOString().slice(0, 10)
    });

    // Add to zone if room matches
    var zone = this.zones.get(deviceData.room);
    if (zone && zone.devices.indexOf(deviceData.id) === -1) {
      zone.devices.push(deviceData.id);
    }

    this.homey.log('[Blinds] Device added: ' + deviceData.name + ' (' + deviceData.type + ')');
    return { success: true, deviceId: deviceData.id, name: deviceData.name };
  }

  /**
   * Remove a device from the system.
   * @param {string} deviceId - Device to remove
   * @returns {object} Result
   */
  removeDevice(deviceId) {
    var device = this.devices.get(deviceId);
    if (!device) return { success: false, error: 'Device not found: ' + deviceId };

    // Remove from zone
    var zoneIds = Array.from(this.zones.keys());
    for (var i = 0; i < zoneIds.length; i++) {
      var zone = this.zones.get(zoneIds[i]);
      var idx = zone.devices.indexOf(deviceId);
      if (idx !== -1) zone.devices.splice(idx, 1);
    }

    this.devices.delete(deviceId);
    this.statistics.delete(deviceId);
    this.calibrationState.delete(deviceId);

    this.homey.log('[Blinds] Device removed: ' + device.name);
    return { success: true, removed: device.name };
  }

  /**
   * Get a list of all available scenes.
   * @returns {Array} Scene list
   */
  getScenes() {
    var result = [];
    var keys = Array.from(this.scenes.keys());
    for (var i = 0; i < keys.length; i++) {
      var s = this.scenes.get(keys[i]);
      result.push({ id: s.id, name: s.name, description: s.description, isActive: s.isActive, lastTriggered: s.lastTriggered });
    }
    return result;
  }

  /**
   * Get all active schedules.
   * @returns {Array} Schedule list
   */
  getSchedules() {
    var result = [];
    var keys = Array.from(this.schedules.keys());
    for (var i = 0; i < keys.length; i++) {
      var s = this.schedules.get(keys[i]);
      result.push({ id: s.id, name: s.name, enabled: s.enabled, days: s.days, triggerType: s.triggerType, triggerValue: s.triggerValue, lastRun: s.lastRun });
    }
    return result;
  }

  /**
   * Get solar tracking data.
   * @returns {object} Solar position and window exposure data
   */
  getSolarData() {
    this._calculateSunPosition();
    var windowExposure = [];
    var facings = ['north', 'east', 'south', 'west'];
    for (var i = 0; i < facings.length; i++) {
      var info = this._getOptimalSolarPosition(facings[i]);
      windowExposure.push({ facing: facings[i], sunExposure: Math.round(info.sunExposure * 100) / 100, glareRisk: info.glareRisk, optimalPosition: info.optimalPosition });
    }
    return { sun: this.solarState, windowExposure: windowExposure, season: this.energyConfig.currentSeason, timestamp: new Date().toISOString() };
  }

  /**
   * Get weather state and thresholds.
   * @returns {object} Weather information
   */
  getWeatherStatus() {
    return { current: this.weatherState, thresholds: this.weatherThresholds, timestamp: new Date().toISOString() };
  }

  /**
   * Update location settings (lat/lon).
   * @param {number} latitude
   * @param {number} longitude
   * @returns {object} Result
   */
  setLocation(latitude, longitude) {
    this.location.latitude = latitude;
    this.location.longitude = longitude;
    this._calculateSunPosition();
    this.homey.log('[Blinds] Location updated: ' + latitude + '°N, ' + longitude + '°E');
    return { success: true, latitude: latitude, longitude: longitude };
  }

  // ════════════════════════════════════════════════════════════════
  //  INTERNAL HELPERS
  // ════════════════════════════════════════════════════════════════

  /**
   * Set position of a single device with logging and events.
   * @param {string} deviceId
   * @param {number} position
   * @param {number} tilt
   * @param {string} reason
   * @private
   */
  _setDevicePosition(deviceId, position, tilt, reason) {
    var device = this.devices.get(deviceId);
    if (!device || !device.isOnline) return;

    var oldPos = device.position;
    var oldTilt = device.tilt;

    if (oldPos === position && oldTilt === tilt) return;

    device.targetPosition = position;
    device.targetTilt = tilt;
    device.position = position;
    device.tilt = tilt;
    device.lastMoved = new Date().toISOString();
    device.motorStatus = 'moving';
    device.isMoving = true;

    // Simulate motor movement completion
    var _self = this;
    setTimeout(function () {
      device.motorStatus = 'idle';
      device.isMoving = false;
    }, 2000 + Math.random() * 3000);

    // Update statistics
    var stats = this.statistics.get(deviceId);
    if (stats) {
      if (oldPos !== position) { stats.totalCycles++; stats.dailyCycles++; }
      if (oldTilt !== tilt) { stats.totalTiltChanges++; stats.dailyTiltChanges++; }
    }

    // Update motor cycles on device
    if (oldPos !== position) device.motorCycles++;

    // Simulate battery drain
    if (device.batteryLevel > 0) {
      device.batteryLevel = Math.max(0, device.batteryLevel - 0.02);
    }

    this._logPosition(deviceId, position, tilt, reason);
  }

  /**
   * Apply position to device only if it has changed.
   * @param {string} deviceId
   * @param {number} position
   * @param {number} tilt
   * @param {string} reason
   * @private
   */
  _applyPositionIfChanged(deviceId, position, tilt, reason) {
    var device = this.devices.get(deviceId);
    if (!device) return;
    if (device.position === position && device.tilt === tilt) return;
    this._setDevicePosition(deviceId, position, tilt, reason);
  }

  /**
   * Set position for all devices in a zone.
   * @param {string} zoneId
   * @param {number} position
   * @param {number} tilt
   * @param {string} reason
   * @private
   */
  _setZonePosition(zoneId, position, tilt, reason) {
    var zone = this.zones.get(zoneId);
    if (!zone) return;

    for (var i = 0; i < zone.devices.length; i++) {
      this._setDevicePosition(zone.devices[i], position, tilt, reason);
    }
  }

  /**
   * Log a position change.
   * @param {string} deviceId
   * @param {number} position
   * @param {number} tilt
   * @param {string} reason
   * @private
   */
  _logPosition(deviceId, position, tilt, reason) {
    var device = this.devices.get(deviceId);
    this.positionLog.push({
      deviceId: deviceId,
      name: device ? device.name : deviceId,
      room: device ? device.room : 'unknown',
      position: position,
      tilt: tilt,
      reason: reason,
      timestamp: new Date().toISOString()
    });

    if (this.positionLog.length > this.maxLogEntries) {
      this.positionLog = this.positionLog.slice(-Math.floor(this.maxLogEntries * 0.8));
    }
  }

  /**
   * Get day of year (1-365/366).
   * @param {Date} date
   * @returns {number}
   * @private
   */
  _dayOfYear(date) {
    var start = new Date(date.getFullYear(), 0, 0);
    var diff = date - start;
    var oneDay = 86400000;
    return Math.floor(diff / oneDay);
  }

  /**
   * Convert decimal hours to HH:MM string.
   * @param {number} hours - Decimal hours (e.g. 14.5 = 14:30)
   * @returns {string} Time string
   * @private
   */
  _decimalHoursToTime(hours) {
    // Offset for Stockholm (UTC+1 / UTC+2 summer)
    var now = new Date();
    var jan = new Date(now.getFullYear(), 0, 1);
    var jul = new Date(now.getFullYear(), 6, 1);
    var stdOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
    var isDST = now.getTimezoneOffset() < stdOffset;
    var utcOffset = isDST ? 2 : 1;

    var localHours = hours + utcOffset;
    if (localHours < 0) localHours += 24;
    if (localHours >= 24) localHours -= 24;
    var h = Math.floor(localHours);
    var m = Math.round((localHours - h) * 60);
    if (m === 60) { h++; m = 0; }
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }

  /**
   * Format a Date to HH:MM string.
   * @param {Date} date
   * @returns {string}
   * @private
   */
  _formatTime(date) {
    var h = date.getHours();
    var m = date.getMinutes();
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }

  /**
   * Add minutes to a HH:MM time string.
   * @param {string} timeStr - HH:MM
   * @param {number} minutes - Minutes to add (can be negative)
   * @returns {string} New HH:MM
   * @private
   */
  _addMinutesToTime(timeStr, minutes) {
    if (!timeStr) return null;
    var parts = timeStr.split(':');
    var totalMinutes = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10) + minutes;
    if (totalMinutes < 0) totalMinutes += 1440;
    if (totalMinutes >= 1440) totalMinutes -= 1440;
    var h = Math.floor(totalMinutes / 60);
    var m = totalMinutes % 60;
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }

  /**
   * Check if two HH:MM times match (same hour and minute).
   * @param {string} time1
   * @param {string} time2
   * @returns {boolean}
   * @private
   */
  _isTimeMatch(time1, time2) {
    if (!time1 || !time2) return false;
    return time1.slice(0, 5) === time2.slice(0, 5);
  }

  // ════════════════════════════════════════════════════════════════
  //  DESTROY
  // ════════════════════════════════════════════════════════════════

  /**
   * Destroy the system, clearing all intervals and resetting state.
   */
  destroy() {
    this.homey.log('[Blinds] Destroying Smart Blinds & Shutter Control System...');

    for (var i = 0; i < this.intervals.length; i++) {
      clearInterval(this.intervals[i]);
    }
    this.intervals = [];

    // Stop all moving devices
    var deviceIds = Array.from(this.devices.keys());
    for (var j = 0; j < deviceIds.length; j++) {
      var d = this.devices.get(deviceIds[j]);
      if (d.isMoving) {
        d.isMoving = false;
        d.motorStatus = 'idle';
      }
    }

    this.positionLog = [];
    this.initialized = false;
    this.homey.log('[Blinds] System destroyed');
  }
}

module.exports = SmartBlindsShutterControlSystem;
