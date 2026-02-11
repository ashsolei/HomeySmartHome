'use strict';

/**
 * SmartFloorHeatingControlSystem
 *
 * Comprehensive underfloor heating automation module for the Homey smart-home
 * platform.  Manages multiple heating zones (electric, water-based, hybrid),
 * performs PID-style temperature control with thermal-inertia compensation,
 * optimises energy consumption against Nordpool spot prices, and provides
 * comfort analysis, floor protection, scheduling, and maintenance features.
 *
 * Swedish defaults: rooms, Stockholm weather, SEK currency,
 * electricity prices ~1.5 SEK/kWh base.
 *
 * @module SmartFloorHeatingControlSystem
 */

var EventEmitter = require('events');

class SmartFloorHeatingControlSystem extends EventEmitter {

  /**
   * Create a new SmartFloorHeatingControlSystem instance.
   * @param {object} homey - The Homey instance.
   */
  constructor(homey) {
    super();
    this.homey = homey;
    this.initialized = false;
    this.intervals = [];
    this.timeouts = [];

    /* ------------------------------------------------------------------ */
    /*  Default zones – Swedish room names                                */
    /* ------------------------------------------------------------------ */
    this.zones = {
      'vardagsrum': this._createZone('vardagsrum', 'Vardagsrum', 'water', 'wood', {
        targetTemp: 22, comfortTemp: 22, ecoTemp: 19, frostTemp: 8,
        maxFloorTemp: 27, area: 35, installedPower: 2800
      }),
      'sovrum-master': this._createZone('sovrum-master', 'Sovrum Master', 'electric', 'wood', {
        targetTemp: 20, comfortTemp: 20, ecoTemp: 17, frostTemp: 8,
        maxFloorTemp: 27, area: 18, installedPower: 1440
      }),
      'sovrum-2': this._createZone('sovrum-2', 'Sovrum 2', 'electric', 'wood', {
        targetTemp: 20, comfortTemp: 20, ecoTemp: 17, frostTemp: 8,
        maxFloorTemp: 27, area: 14, installedPower: 1120
      }),
      'badrum': this._createZone('badrum', 'Badrum', 'electric', 'tile', {
        targetTemp: 24, comfortTemp: 24, ecoTemp: 20, frostTemp: 10,
        maxFloorTemp: 33, area: 8, installedPower: 960
      }),
      'badrum-2': this._createZone('badrum-2', 'Badrum 2', 'electric', 'tile', {
        targetTemp: 24, comfortTemp: 24, ecoTemp: 20, frostTemp: 10,
        maxFloorTemp: 33, area: 6, installedPower: 720
      }),
      'kok': this._createZone('kok', 'Kök', 'water', 'tile', {
        targetTemp: 21, comfortTemp: 21, ecoTemp: 18, frostTemp: 8,
        maxFloorTemp: 33, area: 20, installedPower: 1600
      }),
      'hall': this._createZone('hall', 'Hall', 'water', 'stone', {
        targetTemp: 20, comfortTemp: 20, ecoTemp: 17, frostTemp: 8,
        maxFloorTemp: 35, area: 12, installedPower: 960
      }),
      'tvattrum': this._createZone('tvattrum', 'Tvättrum', 'electric', 'vinyl', {
        targetTemp: 22, comfortTemp: 22, ecoTemp: 18, frostTemp: 8,
        maxFloorTemp: 27, area: 6, installedPower: 480
      })
    };

    /* ------------------------------------------------------------------ */
    /*  Schedules (per-zone, weekly)                                      */
    /* ------------------------------------------------------------------ */
    this.schedules = this._buildDefaultSchedules();

    /* ------------------------------------------------------------------ */
    /*  PID controller state per zone                                     */
    /* ------------------------------------------------------------------ */
    this.pidState = {};
    for (const zoneId of Object.keys(this.zones)) {
      this.pidState[zoneId] = { integral: 0, previousError: 0, lastUpdate: Date.now(),
        output: 0, outputSmoothed: 0 };
    }

    /* ------------------------------------------------------------------ */
    /*  Energy tracking                                                   */
    /* ------------------------------------------------------------------ */
    this.energy = {
      totalKwh: 0,
      totalCostSEK: 0,
      currentPriceSEKperKwh: 1.50,
      priceHistory: [],
      dailyConsumption: {},
      weeklyConsumption: {},
      monthlyConsumption: {},
      annualComparison: [],
      heatingDegreeDays: 0
    };

    /* ------------------------------------------------------------------ */
    /*  Outdoor / weather state                                           */
    /* ------------------------------------------------------------------ */
    this.weather = {
      outdoorTemp: 2,
      outdoorHumidity: 75,
      forecast: [],
      sunIrradiance: 0,
      windSpeed: 3,
      season: 'winter',
      stockholmLatitude: 59.33,
      stockholmLongitude: 18.07,
      summerShutdownThreshold: 18,
      winterBoostThreshold: -15,
      transitionRange: { low: 5, high: 15 }
    };

    /* ------------------------------------------------------------------ */
    /*  Floor material limits                                             */
    /* ------------------------------------------------------------------ */
    this.floorLimits = {
      wood:  { maxTemp: 27, maxRatePerHour: 2.0, minTemp: 15 },
      tile:  { maxTemp: 33, maxRatePerHour: 4.0, minTemp: 10 },
      stone: { maxTemp: 35, maxRatePerHour: 4.5, minTemp: 10 },
      vinyl: { maxTemp: 27, maxRatePerHour: 1.5, minTemp: 15 }
    };

    /* ------------------------------------------------------------------ */
    /*  Occupancy / smart features                                        */
    /* ------------------------------------------------------------------ */
    this.occupancy = {};
    for (const zoneId of Object.keys(this.zones)) {
      this.occupancy[zoneId] = { occupied: true, lastSeen: Date.now(),
        unoccupiedMinutes: 0, reductionActive: false };
    }
    this.geofencing = { homeDistance: 0, isHome: true, etaMinutes: 0,
      preHeatTriggered: false };
    this.doorWindowSensors = {};

    /* ------------------------------------------------------------------ */
    /*  Maintenance state                                                 */
    /* ------------------------------------------------------------------ */
    this.maintenance = {
      valveCycleInterval: 7 * 24 * 60 * 60 * 1000,
      lastValveCycle: null,
      valveStuckAlerts: [],
      flowRateAnomalies: [],
      systemHealth: 100,
      pumpHours: 0,
      antiSeizeScheduled: false
    };

    /* ------------------------------------------------------------------ */
    /*  Statistics                                                        */
    /* ------------------------------------------------------------------ */
    this.statistics = {
      runtimeHoursPerZone: {},
      heatingCyclesPerZone: {},
      avgEfficiencyScore: 0,
      comfortScores: {}
    };
    for (const zoneId of Object.keys(this.zones)) {
      this.statistics.runtimeHoursPerZone[zoneId] = 0;
      this.statistics.heatingCyclesPerZone[zoneId] = 0;
      this.statistics.comfortScores[zoneId] = 100;
    }

    /* ------------------------------------------------------------------ */
    /*  System configuration                                              */
    /* ------------------------------------------------------------------ */
    this.config = {
      controlIntervalMs: 60000,
      energyLogIntervalMs: 300000,
      weatherUpdateIntervalMs: 900000,
      occupancyCheckIntervalMs: 120000,
      maintenanceCheckIntervalMs: 3600000,
      anticipatoryMinutes: 30,
      pidParams: { kp: 2.0, ki: 0.05, kd: 1.5 },
      smoothingFactor: 0.3,
      overshootGuardDeg: 0.5,
      nightSetbackStart: '22:00',
      nightSetbackEnd: '06:00',
      bathroomPreHeatMinutes: 45,
      bathroomPreHeatTime: '06:15',
      holidayMode: false,
      summerShutdown: false
    };
  }

  /* ==================================================================== */
  /*  Zone factory                                                        */
  /* ==================================================================== */

  /**
   * Create a new heating zone configuration object.
   * @param {string} id - Zone identifier.
   * @param {string} name - Human-readable name.
   * @param {string} type - 'electric' | 'water' | 'hybrid'.
   * @param {string} floorMaterial - 'wood' | 'tile' | 'stone' | 'vinyl'.
   * @param {object} opts - Temperature and sizing options.
   * @returns {object} Zone configuration.
   */
  _createZone(id, name, type, floorMaterial, opts) {
    return {
      id,
      name,
      type,
      floorMaterial,
      enabled: true,
      mode: 'comfort',
      targetTemp: opts.targetTemp || 21,
      comfortTemp: opts.comfortTemp || 21,
      ecoTemp: opts.ecoTemp || 18,
      frostTemp: opts.frostTemp || 8,
      currentTemp: opts.targetTemp || 21,
      floorTemp: opts.targetTemp ? opts.targetTemp - 1 : 20,
      airTemp: opts.targetTemp || 21,
      humidity: 45,
      heatingState: false,
      valvePosition: 0,
      flowRate: 0,
      maxFloorTemp: opts.maxFloorTemp || 27,
      area: opts.area || 10,
      installedPower: opts.installedPower || 800,
      currentPower: 0,
      energyTodayKwh: 0,
      energyTotalKwh: 0,
      costTodaySEK: 0,
      costTotalSEK: 0,
      runtimeToday: 0,
      runtimeTotal: 0,
      lastHeatingStart: null,
      lastHeatingStop: null,
      thermalMass: type === 'water' ? 0.85 : 0.55,
      responseTime: type === 'water' ? 45 : 20,
      moistureDetected: false,
      faultCode: null,
      firmwareVersion: '2.4.1',
      sensorBattery: 95,
      lastCalibration: null,
      temperatureHistory: [],
      heatingCycles: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  /* ==================================================================== */
  /*  Initialization / Destroy                                            */
  /* ==================================================================== */

  /**
   * Initialise all subsystems – control loops, scheduling, maintenance.
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) return;
    this.homey.log('[FloorHeating] Initializing Smart Floor Heating Control System…');

    this._determineSeason();
    this._checkSummerShutdown();
    this._buildEnergyDayBucket();

    // Primary control loop
    this.intervals.push(setInterval(() => this._controlLoop(), this.config.controlIntervalMs));

    // Energy logging
    this.intervals.push(setInterval(() => this._logEnergy(), this.config.energyLogIntervalMs));

    // Weather update
    this.intervals.push(setInterval(() => this._updateWeather(), this.config.weatherUpdateIntervalMs));

    // Occupancy check
    this.intervals.push(setInterval(() => this._checkOccupancy(), this.config.occupancyCheckIntervalMs));

    // Maintenance check
    this.intervals.push(setInterval(() => this._maintenanceCheck(), this.config.maintenanceCheckIntervalMs));

    // Schedule evaluator – every minute
    this.intervals.push(setInterval(() => this._evaluateSchedules(), 60000));

    // Bathroom pre-heat
    this.intervals.push(setInterval(() => this._bathroomPreHeat(), 60000));

    this.initialized = true;
    this.emit('initialized');
    this.homey.log('[FloorHeating] System initialised with', Object.keys(this.zones).length, 'zones.');
  }

  /**
   * Tear down the system – clear all intervals and timeouts.
   */
  destroy() {
    this.homey.log('[FloorHeating] Destroying Smart Floor Heating Control System…');
    this.intervals.forEach(i => clearInterval(i));
    this.intervals = [];
    this.timeouts.forEach(t => clearTimeout(t));
    this.timeouts = [];
    this.initialized = false;
    this.emit('destroyed');
  }

  /* ==================================================================== */
  /*  PID Control with Thermal Inertia Compensation                       */
  /* ==================================================================== */

  /**
   * Primary control loop – iterates all enabled zones and applies PID.
   * @private
   */
  _controlLoop() {
    const now = Date.now();
    for (const [zoneId, zone] of Object.entries(this.zones)) {
      if (!zone.enabled) continue;
      if (this.config.summerShutdown && this.weather.season === 'summer') {
        this._setHeating(zoneId, false);
        continue;
      }
      if (this.config.holidayMode) {
        this._applyFrostProtection(zoneId);
        continue;
      }

      // Window open → pause
      if (this._isWindowOpen(zoneId)) {
        this._setHeating(zoneId, false);
        this.emit('window-open-pause', { zoneId });
        continue;
      }

      const target = this._effectiveTarget(zoneId);
      const pid = this._pidCompute(zoneId, target, zone.currentTemp, now);
      const safe = this._floorProtection(zoneId, pid);

      if (safe > 0) {
        this._setHeating(zoneId, true, safe);
      } else {
        this._setHeating(zoneId, false);
      }

      // Record temperature history (keep last 1440 entries ~24h at 1-min interval)
      zone.temperatureHistory.push({ t: now, floor: zone.floorTemp, air: zone.airTemp,
        target, valve: zone.valvePosition });
      if (zone.temperatureHistory.length > 1440) zone.temperatureHistory.shift();
      zone.updatedAt = now;
    }
    this.emit('control-loop-complete');
  }

  /**
   * Compute PID output for a zone.
   * @param {string} zoneId
   * @param {number} target - Target temperature °C.
   * @param {number} current - Current measured temperature °C.
   * @param {number} now - Timestamp ms.
   * @returns {number} Output 0-100 (valve/power percentage).
   * @private
   */
  _pidCompute(zoneId, target, current, now) {
    const state = this.pidState[zoneId];
    const dt = Math.max((now - state.lastUpdate) / 1000, 1);
    const { kp, ki, kd } = this.config.pidParams;

    const error = target - current;
    state.integral += error * dt;
    // Anti-windup clamp
    state.integral = Math.max(-500, Math.min(500, state.integral));

    const derivative = (error - state.previousError) / dt;
    let output = kp * error + ki * state.integral + kd * derivative;

    // Thermal-inertia anticipation: if close to target, reduce to prevent overshoot
    const zone = this.zones[zoneId];
    if (zone) {
      const rateOfRise = derivative * dt;
      const anticipatedTemp = current + rateOfRise * (zone.responseTime / 60);
      if (anticipatedTemp > target + this.config.overshootGuardDeg) {
        output *= 0.3;
      } else if (anticipatedTemp > target) {
        output *= 0.6;
      }
    }

    output = Math.max(0, Math.min(100, output));

    // Smoothing
    state.outputSmoothed = state.outputSmoothed * (1 - this.config.smoothingFactor) +
      output * this.config.smoothingFactor;

    state.previousError = error;
    state.lastUpdate = now;
    state.output = state.outputSmoothed;
    return Math.round(state.outputSmoothed * 10) / 10;
  }

  /**
   * Determine the effective target temperature for a zone considering mode,
   * night setback, occupancy reduction and outdoor compensation.
   * @param {string} zoneId
   * @returns {number} Target temperature °C.
   * @private
   */
  _effectiveTarget(zoneId) {
    const zone = this.zones[zoneId];
    let target;

    switch (zone.mode) {
      case 'comfort': target = zone.comfortTemp; break;
      case 'eco':     target = zone.ecoTemp;     break;
      case 'frost':   target = zone.frostTemp;   break;
      default:        target = zone.targetTemp;
    }

    // Night setback
    if (this._isNightSetback()) {
      target = Math.min(target, zone.ecoTemp);
    }

    // Occupancy reduction
    const occ = this.occupancy[zoneId];
    if (occ && !occ.occupied && occ.unoccupiedMinutes > 30) {
      target -= 2;
    }

    // Outdoor compensation – reduce target when outdoor is mild
    if (this.weather.outdoorTemp > this.weather.transitionRange.high) {
      target -= 1;
    } else if (this.weather.outdoorTemp < this.weather.winterBoostThreshold) {
      target += 1.5;
    }

    return Math.max(zone.frostTemp, Math.round(target * 2) / 2);
  }

  /* ==================================================================== */
  /*  Floor Protection                                                    */
  /* ==================================================================== */

  /**
   * Enforce floor temperature limits and thermal shock prevention.
   * Returns an adjusted PID output.
   * @param {string} zoneId
   * @param {number} pidOutput - Raw PID output 0-100.
   * @returns {number} Safe output.
   * @private
   */
  _floorProtection(zoneId, pidOutput) {
    const zone = this.zones[zoneId];
    const limits = this.floorLimits[zone.floorMaterial] || this.floorLimits.tile;

    // Hard floor-temp cap
    if (zone.floorTemp >= zone.maxFloorTemp) {
      this.emit('floor-temp-limit', { zoneId, floorTemp: zone.floorTemp, limit: zone.maxFloorTemp });
      return 0;
    }

    // Gradual heating – limit rate of rise
    if (zone.temperatureHistory.length >= 2) {
      const prev = zone.temperatureHistory[zone.temperatureHistory.length - 2];
      const deltaMinutes = (Date.now() - prev.t) / 60000;
      if (deltaMinutes > 0) {
        const ratePerHour = ((zone.floorTemp - prev.floor) / deltaMinutes) * 60;
        if (ratePerHour > limits.maxRatePerHour) {
          pidOutput = Math.min(pidOutput, 30);
        }
      }
    }

    // Near-limit derating
    const headroom = zone.maxFloorTemp - zone.floorTemp;
    if (headroom < 2) {
      pidOutput *= headroom / 2;
    }

    // Moisture safety
    if (zone.moistureDetected) {
      this.emit('moisture-alert', { zoneId });
      return 0;
    }

    return Math.max(0, Math.round(pidOutput * 10) / 10);
  }

  /**
   * Apply frost protection to a zone (holiday / shutdown mode).
   * @param {string} zoneId
   * @private
   */
  _applyFrostProtection(zoneId) {
    const zone = this.zones[zoneId];
    if (zone.currentTemp < zone.frostTemp + 1) {
      this._setHeating(zoneId, true, 40);
    } else if (zone.currentTemp >= zone.frostTemp + 3) {
      this._setHeating(zoneId, false);
    }
  }

  /**
   * Pipe freeze protection for water-based systems.
   * @private
   */
  _pipeFreezeProtection() {
    for (const [zoneId, zone] of Object.entries(this.zones)) {
      if (zone.type !== 'water' && zone.type !== 'hybrid') continue;
      if (zone.floorTemp < 5) {
        this._setHeating(zoneId, true, 50);
        this.emit('pipe-freeze-protection', { zoneId, floorTemp: zone.floorTemp });
      }
    }
  }

  /* ==================================================================== */
  /*  Heating actuator control                                            */
  /* ==================================================================== */

  /**
   * Set the heating state for a zone.
   * @param {string} zoneId
   * @param {boolean} active
   * @param {number} [output=0] Valve/power percentage 0-100.
   * @private
   */
  _setHeating(zoneId, active, output = 0) {
    const zone = this.zones[zoneId];
    if (!zone) return;

    const wasHeating = zone.heatingState;
    zone.heatingState = active;
    zone.valvePosition = active ? Math.round(output) : 0;
    zone.currentPower = active ? Math.round(zone.installedPower * (output / 100)) : 0;

    if (zone.type === 'water' || zone.type === 'hybrid') {
      zone.flowRate = active ? Math.round(output * 0.12 * 100) / 100 : 0;
    }

    if (active && !wasHeating) {
      zone.lastHeatingStart = Date.now();
      zone.heatingCycles++;
      this.statistics.heatingCyclesPerZone[zoneId] = (this.statistics.heatingCyclesPerZone[zoneId] || 0) + 1;
      this.emit('heating-started', { zoneId, output });
    } else if (!active && wasHeating) {
      zone.lastHeatingStop = Date.now();
      if (zone.lastHeatingStart) {
        const runMin = (zone.lastHeatingStop - zone.lastHeatingStart) / 60000;
        zone.runtimeToday += runMin;
        zone.runtimeTotal += runMin;
        this.statistics.runtimeHoursPerZone[zoneId] =
          (this.statistics.runtimeHoursPerZone[zoneId] || 0) + runMin / 60;
      }
      this.emit('heating-stopped', { zoneId });
    }
  }

  /* ==================================================================== */
  /*  Scheduling                                                          */
  /* ==================================================================== */

  /**
   * Build default weekly schedules for every zone.
   * @returns {object}
   * @private
   */
  _buildDefaultSchedules() {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const schedules = {};
    for (const zoneId of Object.keys(this.zones)) {
      const isBathroom = zoneId.startsWith('badrum');
      schedules[zoneId] = { active: true, quickHeatEnabled: true, periods: {} };
      for (const day of days) {
        const isWeekend = day === 'saturday' || day === 'sunday';
        schedules[zoneId].periods[day] = isBathroom
          ? [
              { start: '05:30', end: '09:00', mode: 'comfort' },
              { start: '09:00', end: '17:00', mode: 'eco' },
              { start: '17:00', end: '22:30', mode: 'comfort' },
              { start: '22:30', end: '05:30', mode: 'eco' }
            ]
          : isWeekend
            ? [
                { start: '07:00', end: '23:00', mode: 'comfort' },
                { start: '23:00', end: '07:00', mode: 'eco' }
              ]
            : [
                { start: '06:00', end: '09:00', mode: 'comfort' },
                { start: '09:00', end: '17:00', mode: 'eco' },
                { start: '17:00', end: '22:00', mode: 'comfort' },
                { start: '22:00', end: '06:00', mode: 'eco' }
              ];
      }
    }
    return schedules;
  }

  /**
   * Evaluate schedules and switch zone modes accordingly.
   * Also triggers quick-heat in advance of the next comfort period.
   * @private
   */
  _evaluateSchedules() {
    const now = new Date();
    const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    for (const [zoneId, sched] of Object.entries(this.schedules)) {
      if (!sched.active) continue;
      const zone = this.zones[zoneId];
      if (!zone || !zone.enabled) continue;

      const periods = sched.periods[dayName] || [];
      let matched = false;
      for (const period of periods) {
        const startMin = this._timeToMinutes(period.start);
        const endMin = this._timeToMinutes(period.end);
        const wraps = endMin <= startMin;
        const inPeriod = wraps
          ? (nowMinutes >= startMin || nowMinutes < endMin)
          : (nowMinutes >= startMin && nowMinutes < endMin);
        if (inPeriod) {
          if (zone.mode !== period.mode) {
            zone.mode = period.mode;
            zone.targetTemp = period.mode === 'comfort'
              ? zone.comfortTemp
              : period.mode === 'eco' ? zone.ecoTemp : zone.frostTemp;
            this.emit('mode-changed', { zoneId, mode: period.mode, source: 'schedule' });
          }
          matched = true;
          break;
        }
      }

      // Quick-heat: pre-warm before next comfort period
      if (!matched && sched.quickHeatEnabled) {
        this._checkQuickHeat(zoneId, dayName, nowMinutes);
      }
    }
  }

  /**
   * Check if a zone should start quick-heating (pre-warm).
   * @param {string} zoneId
   * @param {string} dayName
   * @param {number} nowMinutes
   * @private
   */
  _checkQuickHeat(zoneId, dayName, nowMinutes) {
    const sched = this.schedules[zoneId];
    if (!sched) return;
    const periods = sched.periods[dayName] || [];
    const zone = this.zones[zoneId];
    const anticipate = this.config.anticipatoryMinutes;

    for (const period of periods) {
      if (period.mode !== 'comfort') continue;
      const startMin = this._timeToMinutes(period.start);
      const preHeatStart = startMin - anticipate;
      if (preHeatStart < 0) continue;
      if (nowMinutes >= preHeatStart && nowMinutes < startMin) {
        if (zone.mode !== 'comfort') {
          zone.mode = 'comfort';
          zone.targetTemp = zone.comfortTemp;
          this.emit('quick-heat-started', { zoneId, comfortAt: period.start });
        }
        return;
      }
    }
  }

  /* ==================================================================== */
  /*  Energy Tracking & Optimisation                                      */
  /* ==================================================================== */

  /**
   * Initialise today's energy bucket.
   * @private
   */
  _buildEnergyDayBucket() {
    const key = this._dayKey();
    if (!this.energy.dailyConsumption[key]) {
      this.energy.dailyConsumption[key] = { totalKwh: 0, costSEK: 0, perZone: {} };
      for (const zoneId of Object.keys(this.zones)) {
        this.energy.dailyConsumption[key].perZone[zoneId] = { kwh: 0, costSEK: 0 };
      }
    }
  }

  /**
   * Log energy consumption snapshot.
   * @private
   */
  _logEnergy() {
    const key = this._dayKey();
    this._buildEnergyDayBucket();
    const intervalHours = this.config.energyLogIntervalMs / 3600000;

    for (const [zoneId, zone] of Object.entries(this.zones)) {
      if (!zone.heatingState) continue;
      const kwh = (zone.currentPower / 1000) * intervalHours;
      const cost = kwh * this.energy.currentPriceSEKperKwh;

      zone.energyTodayKwh += kwh;
      zone.energyTotalKwh += kwh;
      zone.costTodaySEK += cost;
      zone.costTotalSEK += cost;

      this.energy.totalKwh += kwh;
      this.energy.totalCostSEK += cost;

      const dayBucket = this.energy.dailyConsumption[key];
      dayBucket.totalKwh += kwh;
      dayBucket.costSEK += cost;
      dayBucket.perZone[zoneId].kwh += kwh;
      dayBucket.perZone[zoneId].costSEK += cost;
    }

    this._aggregateWeekly();
    this._aggregateMonthly();
    this._computeEfficiency();

    this.emit('energy-logged', { totalKwh: this.energy.totalKwh, costSEK: this.energy.totalCostSEK });
  }

  /**
   * Aggregate daily data into weekly buckets.
   * @private
   */
  _aggregateWeekly() {
    const weekKey = this._weekKey();
    if (!this.energy.weeklyConsumption[weekKey]) {
      this.energy.weeklyConsumption[weekKey] = { totalKwh: 0, costSEK: 0 };
    }
    let sum = 0;
    let cost = 0;
    const start = this._weekStartDate();
    for (const [day, data] of Object.entries(this.energy.dailyConsumption)) {
      if (new Date(day) >= start) {
        sum += data.totalKwh;
        cost += data.costSEK;
      }
    }
    this.energy.weeklyConsumption[weekKey] = { totalKwh: sum, costSEK: cost };
  }

  /**
   * Aggregate daily data into monthly buckets.
   * @private
   */
  _aggregateMonthly() {
    const monthKey = this._monthKey();
    if (!this.energy.monthlyConsumption[monthKey]) {
      this.energy.monthlyConsumption[monthKey] = { totalKwh: 0, costSEK: 0 };
    }
    let sum = 0;
    let cost = 0;
    const prefix = monthKey;
    for (const [day, data] of Object.entries(this.energy.dailyConsumption)) {
      if (day.startsWith(prefix)) {
        sum += data.totalKwh;
        cost += data.costSEK;
      }
    }
    this.energy.monthlyConsumption[monthKey] = { totalKwh: sum, costSEK: cost };
  }

  /**
   * Efficiency score: ratio of useful heating vs total energy spent.
   * @private
   */
  _computeEfficiency() {
    let totalTarget = 0;
    let totalActual = 0;
    let count = 0;
    for (const [zoneId, zone] of Object.entries(this.zones)) {
      if (!zone.enabled) continue;
      const diff = Math.abs(zone.currentTemp - zone.targetTemp);
      const score = Math.max(0, 100 - diff * 20);
      this.statistics.comfortScores[zoneId] = Math.round(score);
      totalTarget += zone.targetTemp;
      totalActual += zone.currentTemp;
      count++;
    }
    if (count > 0) {
      const avgDiff = Math.abs(totalTarget / count - totalActual / count);
      this.statistics.avgEfficiencyScore = Math.round(Math.max(0, 100 - avgDiff * 15));
    }
  }

  /**
   * Determine if current electricity price is off-peak.
   * @returns {boolean}
   * @private
   */
  _isOffPeak() {
    const hour = new Date().getHours();
    return hour >= 1 && hour < 6;
  }

  /**
   * Determine if current electricity price is on-peak.
   * @returns {boolean}
   * @private
   */
  _isOnPeak() {
    const hour = new Date().getHours();
    return (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20);
  }

  /**
   * Update energy prices (simulated Nordpool spot prices).
   * @param {number} priceSEK - Current spot price in SEK/kWh.
   */
  updateEnergyPrice(priceSEK) {
    this.energy.currentPriceSEKperKwh = priceSEK;
    this.energy.priceHistory.push({ time: Date.now(), price: priceSEK });
    if (this.energy.priceHistory.length > 288) this.energy.priceHistory.shift();

    // Thermal mass strategy: heat aggressively during low prices
    if (priceSEK < 0.80) {
      this._thermalMassCharge();
    } else if (priceSEK > 2.50) {
      this._thermalMassCoast();
    }
    this.emit('price-updated', { priceSEK });
  }

  /**
   * Charge thermal mass – increase targets temporarily during cheap power.
   * @private
   */
  _thermalMassCharge() {
    for (const [zoneId, zone] of Object.entries(this.zones)) {
      if (!zone.enabled || zone.mode === 'frost') continue;
      const limits = this.floorLimits[zone.floorMaterial];
      const boost = Math.min(zone.targetTemp + 2, limits.maxTemp - 1);
      zone.targetTemp = boost;
    }
    this.emit('thermal-mass-charge');
  }

  /**
   * Coast – reduce heating during expensive power, relying on stored heat.
   * @private
   */
  _thermalMassCoast() {
    for (const [zoneId, zone] of Object.entries(this.zones)) {
      if (!zone.enabled || zone.mode === 'frost') continue;
      if (zone.currentTemp > zone.ecoTemp) {
        zone.targetTemp = zone.ecoTemp;
      }
    }
    this.emit('thermal-mass-coast');
  }

  /* ==================================================================== */
  /*  Weather & Season                                                    */
  /* ==================================================================== */

  /**
   * Update outdoor weather conditions.
   * @private
   */
  _updateWeather() {
    this._determineSeason();
    this._checkSummerShutdown();
    this._computeHeatingDegreeDays();
    this._outdoorCompensation();
    this.emit('weather-updated', { season: this.weather.season, outdoorTemp: this.weather.outdoorTemp });
  }

  /**
   * Set outdoor conditions (called externally or via integration).
   * @param {object} conditions
   * @param {number} conditions.temperature - Outdoor temperature °C.
   * @param {number} [conditions.humidity] - Outdoor humidity %.
   * @param {number} [conditions.windSpeed] - Wind speed m/s.
   * @param {number} [conditions.sunIrradiance] - Sun irradiance W/m².
   */
  setOutdoorConditions(conditions) {
    if (conditions.temperature !== undefined) this.weather.outdoorTemp = conditions.temperature;
    if (conditions.humidity !== undefined)    this.weather.outdoorHumidity = conditions.humidity;
    if (conditions.windSpeed !== undefined)   this.weather.windSpeed = conditions.windSpeed;
    if (conditions.sunIrradiance !== undefined) this.weather.sunIrradiance = conditions.sunIrradiance;
    this._updateWeather();
  }

  /**
   * Determine the current season based on outdoor temperature trends.
   * @private
   */
  _determineSeason() {
    const t = this.weather.outdoorTemp;
    const month = new Date().getMonth(); // 0-11
    if (month >= 5 && month <= 7)       this.weather.season = 'summer';
    else if (month >= 11 || month <= 1) this.weather.season = 'winter';
    else if (month >= 2 && month <= 4)  this.weather.season = 'spring';
    else                                this.weather.season = 'autumn';

    // Override with temperature reality
    if (t > 20)  this.weather.season = 'summer';
    if (t < -10) this.weather.season = 'winter';
  }

  /**
   * Check and apply summer shutdown.
   * @private
   */
  _checkSummerShutdown() {
    if (this.weather.outdoorTemp > this.weather.summerShutdownThreshold) {
      if (!this.config.summerShutdown) {
        this.config.summerShutdown = true;
        this.emit('summer-shutdown-activated');
        this.homey.log('[FloorHeating] Summer shutdown activated – outdoor temp',
          this.weather.outdoorTemp, '°C');
      }
    } else {
      if (this.config.summerShutdown) {
        this.config.summerShutdown = false;
        this.emit('summer-shutdown-deactivated');
        this.homey.log('[FloorHeating] Summer shutdown deactivated.');
      }
    }
  }

  /**
   * Compute heating degree days (base 17°C).
   * @private
   */
  _computeHeatingDegreeDays() {
    const base = 17;
    if (this.weather.outdoorTemp < base) {
      this.energy.heatingDegreeDays += (base - this.weather.outdoorTemp) / 24;
    }
  }

  /**
   * Apply outdoor temperature compensation to all zones.
   * Uses a simple heating curve: the colder it is, the higher the water/floor target.
   * @private
   */
  _outdoorCompensation() {
    const outdoor = this.weather.outdoorTemp;
    for (const [zoneId, zone] of Object.entries(this.zones)) {
      if (!zone.enabled || zone.mode === 'frost') continue;
      // Simple linear compensation curve
      // At outdoor 15°C → offset 0, at outdoor -20°C → offset +3
      const offset = Math.max(0, (15 - outdoor) * 0.085);
      // Don't exceed floor limits
      const maxTarget = zone.maxFloorTemp - 2;
      const compensated = Math.min(zone.comfortTemp + offset, maxTarget);
      if (zone.mode === 'comfort' && compensated > zone.targetTemp) {
        zone.targetTemp = Math.round(compensated * 2) / 2;
      }
    }
  }

  /* ==================================================================== */
  /*  Smart Features                                                      */
  /* ==================================================================== */

  /**
   * Periodic occupancy check – reduce heating in unoccupied rooms.
   * @private
   */
  _checkOccupancy() {
    const now = Date.now();
    for (const [zoneId, occ] of Object.entries(this.occupancy)) {
      if (!occ.occupied) {
        occ.unoccupiedMinutes = (now - occ.lastSeen) / 60000;
        if (occ.unoccupiedMinutes > 30 && !occ.reductionActive) {
          occ.reductionActive = true;
          this.emit('occupancy-reduction', { zoneId, minutes: Math.round(occ.unoccupiedMinutes) });
        }
      } else {
        occ.unoccupiedMinutes = 0;
        occ.reductionActive = false;
      }
    }
  }

  /**
   * Update occupancy status for a zone.
   * @param {string} zoneId
   * @param {boolean} occupied
   */
  setOccupancy(zoneId, occupied) {
    if (!this.occupancy[zoneId]) return;
    this.occupancy[zoneId].occupied = occupied;
    if (occupied) {
      this.occupancy[zoneId].lastSeen = Date.now();
      this.occupancy[zoneId].unoccupiedMinutes = 0;
      this.occupancy[zoneId].reductionActive = false;
    }
    this.emit('occupancy-changed', { zoneId, occupied });
  }

  /**
   * Update geofencing data for pre-heat on arrival.
   * @param {object} data
   * @param {number} data.distanceKm - Distance from home in km.
   * @param {number} data.etaMinutes - Estimated minutes to arrival.
   * @param {boolean} data.isHome - Whether occupant is home.
   */
  updateGeofencing(data) {
    this.geofencing.homeDistance = data.distanceKm || 0;
    this.geofencing.etaMinutes = data.etaMinutes || 0;
    this.geofencing.isHome = data.isHome !== undefined ? data.isHome : true;

    if (!this.geofencing.isHome && this.geofencing.etaMinutes > 0 &&
        this.geofencing.etaMinutes <= 45 && !this.geofencing.preHeatTriggered) {
      this.geofencing.preHeatTriggered = true;
      this._preHeatAllZones();
      this.emit('pre-heat-arrival', { eta: this.geofencing.etaMinutes });
    }
    if (this.geofencing.isHome) {
      this.geofencing.preHeatTriggered = false;
    }
  }

  /**
   * Pre-heat all zones to comfort temperature before arrival.
   * @private
   */
  _preHeatAllZones() {
    for (const [zoneId, zone] of Object.entries(this.zones)) {
      if (!zone.enabled) continue;
      zone.mode = 'comfort';
      zone.targetTemp = zone.comfortTemp;
    }
    this.homey.log('[FloorHeating] Pre-heating all zones for arrival.');
  }

  /**
   * Bathroom pre-heat before morning wake-up.
   * @private
   */
  _bathroomPreHeat() {
    const now = new Date();
    const currentTime = this._formatTime(now.getHours(), now.getMinutes());
    const preHeatTime = this.config.bathroomPreHeatTime;
    const preHeatMs = this.config.bathroomPreHeatMinutes * 60000;

    const preHeatStart = new Date(now);
    const [ph, pm] = preHeatTime.split(':').map(Number);
    preHeatStart.setHours(ph, pm, 0, 0);
    preHeatStart.setTime(preHeatStart.getTime() - preHeatMs);

    const preStartStr = this._formatTime(preHeatStart.getHours(), preHeatStart.getMinutes());

    if (currentTime === preStartStr) {
      for (const [zoneId, zone] of Object.entries(this.zones)) {
        if (!zoneId.startsWith('badrum')) continue;
        if (!zone.enabled) continue;
        zone.mode = 'comfort';
        zone.targetTemp = zone.comfortTemp;
        this.emit('bathroom-preheat', { zoneId, target: zone.comfortTemp });
      }
    }
  }

  /**
   * Register a door/window sensor for a zone.
   * @param {string} sensorId
   * @param {string} zoneId
   */
  registerDoorWindowSensor(sensorId, zoneId) {
    this.doorWindowSensors[sensorId] = { zoneId, open: false, openedAt: null };
  }

  /**
   * Update door/window sensor state.
   * @param {string} sensorId
   * @param {boolean} open
   */
  updateDoorWindowSensor(sensorId, open) {
    const sensor = this.doorWindowSensors[sensorId];
    if (!sensor) return;
    sensor.open = open;
    sensor.openedAt = open ? Date.now() : null;
    this.emit('door-window-changed', { sensorId, zoneId: sensor.zoneId, open });
  }

  /**
   * Check if any window/door is open in a zone.
   * @param {string} zoneId
   * @returns {boolean}
   * @private
   */
  _isWindowOpen(zoneId) {
    for (const sensor of Object.values(this.doorWindowSensors)) {
      if (sensor.zoneId === zoneId && sensor.open) return true;
    }
    return false;
  }

  /* ==================================================================== */
  /*  Night Setback                                                       */
  /* ==================================================================== */

  /**
   * Check if current time is within night setback period.
   * @returns {boolean}
   * @private
   */
  _isNightSetback() {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const start = this._timeToMinutes(this.config.nightSetbackStart);
    const end = this._timeToMinutes(this.config.nightSetbackEnd);
    if (start > end) {
      return nowMin >= start || nowMin < end;
    }
    return nowMin >= start && nowMin < end;
  }

  /* ==================================================================== */
  /*  Comfort Analysis (Simplified PMV/PPD)                               */
  /* ==================================================================== */

  /**
   * Compute thermal comfort score for a zone using a simplified PMV/PPD.
   * @param {string} zoneId
   * @returns {object} { pmv, ppd, score, rating }
   */
  getComfortScore(zoneId) {
    const zone = this.zones[zoneId];
    if (!zone) return { pmv: 0, ppd: 100, score: 0, rating: 'unknown' };

    const airTemp = zone.airTemp;
    const floorTemp = zone.floorTemp;
    const humidity = zone.humidity;
    const meanRadiantTemp = (floorTemp * 0.4 + airTemp * 0.6);

    // Simplified PMV (Fanger) approximation
    const operativeTemp = (airTemp + meanRadiantTemp) / 2;
    const idealTemp = 21.5;
    const pmv = (operativeTemp - idealTemp) * 0.5;
    const clampedPMV = Math.max(-3, Math.min(3, pmv));

    // PPD from PMV (simplified exponential)
    const ppd = Math.round(100 - 95 * Math.exp(-0.03353 * Math.pow(clampedPMV, 4) -
      0.2179 * Math.pow(clampedPMV, 2)));
    const ppdClamped = Math.max(5, Math.min(100, ppd));

    // Floor comfort: ideal floor temp is 19-26°C for standing
    const floorPenalty = floorTemp < 19 ? (19 - floorTemp) * 5 : floorTemp > 26 ? (floorTemp - 26) * 5 : 0;

    // Humidity penalty
    const humPenalty = humidity < 30 ? (30 - humidity) * 0.5 : humidity > 60 ? (humidity - 60) * 0.5 : 0;

    const score = Math.round(Math.max(0, Math.min(100, 100 - ppdClamped - floorPenalty - humPenalty)));
    let rating;
    if (score >= 85) rating = 'excellent';
    else if (score >= 70) rating = 'good';
    else if (score >= 50) rating = 'acceptable';
    else if (score >= 30) rating = 'poor';
    else rating = 'very poor';

    this.statistics.comfortScores[zoneId] = score;
    return { pmv: Math.round(clampedPMV * 100) / 100, ppd: ppdClamped, score, rating,
      operative: Math.round(operativeTemp * 10) / 10, floorTemp, airTemp, humidity };
  }

  /**
   * Get comfort comparison across all zones.
   * @returns {object[]} Array of { zoneId, name, score, rating }.
   */
  getComfortComparison() {
    const results = [];
    for (const [zoneId, zone] of Object.entries(this.zones)) {
      const comfort = this.getComfortScore(zoneId);
      results.push({ zoneId, name: zone.name, score: comfort.score, rating: comfort.rating,
        airTemp: zone.airTemp, floorTemp: zone.floorTemp });
    }
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Compute floor surface temperature uniformity for a zone.
   * @param {string} zoneId
   * @returns {object} { uniformity, min, max, avg, deviation }
   */
  getFloorUniformity(zoneId) {
    const zone = this.zones[zoneId];
    if (!zone) return null;
    // Simulate sensor readings across the floor area
    const readings = [];
    const sensors = Math.max(4, Math.floor(zone.area / 3));
    for (let i = 0; i < sensors; i++) {
      const variation = (Math.random() - 0.5) * 2.0;
      readings.push(zone.floorTemp + variation);
    }
    const min = Math.min(...readings);
    const max = Math.max(...readings);
    const avg = readings.reduce((a, b) => a + b, 0) / readings.length;
    const variance = readings.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) / readings.length;
    const deviation = Math.sqrt(variance);
    const uniformity = Math.round(Math.max(0, 100 - deviation * 20));
    return {
      uniformity,
      min: Math.round(min * 10) / 10,
      max: Math.round(max * 10) / 10,
      avg: Math.round(avg * 10) / 10,
      deviation: Math.round(deviation * 100) / 100,
      sensorCount: sensors
    };
  }

  /* ==================================================================== */
  /*  Maintenance & Diagnostics                                           */
  /* ==================================================================== */

  /**
   * Periodic maintenance check.
   * @private
   */
  _maintenanceCheck() {
    this._checkValveHealth();
    this._checkFlowRates();
    this._antiSeizeCycle();
    this._pipeFreezeProtection();
    this._computeSystemHealth();
    this.emit('maintenance-check-complete', { health: this.maintenance.systemHealth });
  }

  /**
   * Check for stuck valves.
   * @private
   */
  _checkValveHealth() {
    for (const [zoneId, zone] of Object.entries(this.zones)) {
      if (zone.type !== 'water' && zone.type !== 'hybrid') continue;
      // If valve position is >0 but flow rate is 0 → valve might be stuck
      if (zone.valvePosition > 20 && zone.flowRate < 0.01 && zone.heatingState) {
        const alert = { zoneId, type: 'valve-stuck', detected: Date.now(),
          valvePosition: zone.valvePosition, flowRate: zone.flowRate };
        this.maintenance.valveStuckAlerts.push(alert);
        zone.faultCode = 'VALVE_STUCK';
        this.emit('valve-stuck', alert);
      }
    }
  }

  /**
   * Check for flow rate anomalies in water-based systems.
   * @private
   */
  _checkFlowRates() {
    for (const [zoneId, zone] of Object.entries(this.zones)) {
      if (zone.type !== 'water' && zone.type !== 'hybrid') continue;
      if (!zone.heatingState) continue;
      const expectedFlow = zone.valvePosition * 0.12;
      const actualFlow = zone.flowRate;
      if (expectedFlow > 0) {
        const deviation = Math.abs(actualFlow - expectedFlow) / expectedFlow;
        if (deviation > 0.4) {
          const anomaly = { zoneId, expected: expectedFlow, actual: actualFlow,
            deviation: Math.round(deviation * 100), detected: Date.now() };
          this.maintenance.flowRateAnomalies.push(anomaly);
          if (this.maintenance.flowRateAnomalies.length > 100) {
            this.maintenance.flowRateAnomalies.shift();
          }
          this.emit('flow-rate-anomaly', anomaly);
        }
      }
    }
  }

  /**
   * Anti-seize valve cycling – operate each water valve briefly to prevent sticking.
   * Runs every 7 days.
   * @private
   */
  _antiSeizeCycle() {
    const now = Date.now();
    if (this.maintenance.lastValveCycle &&
        (now - this.maintenance.lastValveCycle) < this.maintenance.valveCycleInterval) {
      return;
    }
    this.maintenance.lastValveCycle = now;
    for (const [zoneId, zone] of Object.entries(this.zones)) {
      if (zone.type !== 'water' && zone.type !== 'hybrid') continue;
      // Briefly open and close the valve
      const origValve = zone.valvePosition;
      zone.valvePosition = 100;
      this.timeouts.push(setTimeout(() => {
        zone.valvePosition = 0;
        this.timeouts.push(setTimeout(() => {
          zone.valvePosition = origValve;
        }, 5000));
      }, 10000));
    }
    this.emit('anti-seize-cycle', { timestamp: now });
    this.homey.log('[FloorHeating] Anti-seize valve cycle executed.');
  }

  /**
   * Compute overall system health percentage.
   * @private
   */
  _computeSystemHealth() {
    let deductions = 0;
    const zoneCount = Object.keys(this.zones).length;

    // -10 per stuck valve
    deductions += this.maintenance.valveStuckAlerts.filter(a =>
      Date.now() - a.detected < 86400000).length * 10;

    // -5 per flow anomaly in last 24h
    deductions += this.maintenance.flowRateAnomalies.filter(a =>
      Date.now() - a.detected < 86400000).length * 5;

    // -3 per zone with fault code
    for (const zone of Object.values(this.zones)) {
      if (zone.faultCode) deductions += 3;
      if (zone.sensorBattery < 20) deductions += 2;
      if (zone.moistureDetected) deductions += 5;
    }

    this.maintenance.systemHealth = Math.max(0, Math.min(100, 100 - deductions));
  }

  /**
   * Get maintenance report.
   * @returns {object}
   */
  getMaintenanceReport() {
    return {
      systemHealth: this.maintenance.systemHealth,
      pumpHours: this.maintenance.pumpHours,
      lastValveCycle: this.maintenance.lastValveCycle
        ? new Date(this.maintenance.lastValveCycle).toISOString() : null,
      stuckValves: this.maintenance.valveStuckAlerts.filter(a =>
        Date.now() - a.detected < 86400000),
      flowAnomalies: this.maintenance.flowRateAnomalies.filter(a =>
        Date.now() - a.detected < 86400000),
      zones: Object.entries(this.zones).map(([id, z]) => ({
        id,
        name: z.name,
        faultCode: z.faultCode,
        sensorBattery: z.sensorBattery,
        firmwareVersion: z.firmwareVersion,
        moistureDetected: z.moistureDetected,
        lastCalibration: z.lastCalibration,
        heatingCycles: z.heatingCycles,
        runtimeHours: Math.round(z.runtimeTotal / 60)
      }))
    };
  }

  /* ==================================================================== */
  /*  API Methods                                                         */
  /* ==================================================================== */

  /**
   * Set the target temperature for a zone.
   * @param {string} zoneId
   * @param {number} temperature - Target temperature in °C.
   * @returns {object} Updated zone status.
   */
  setZoneTemp(zoneId, temperature) {
    const zone = this.zones[zoneId];
    if (!zone) throw new Error(`Zone '${zoneId}' not found.`);

    const limits = this.floorLimits[zone.floorMaterial];
    if (temperature > limits.maxTemp) {
      throw new Error(`Temperature ${temperature}°C exceeds floor limit of ${limits.maxTemp}°C for ${zone.floorMaterial}.`);
    }
    if (temperature < zone.frostTemp) {
      throw new Error(`Temperature ${temperature}°C is below frost protection (${zone.frostTemp}°C).`);
    }

    zone.targetTemp = temperature;
    zone.updatedAt = Date.now();
    this.emit('zone-temp-set', { zoneId, temperature });
    this.homey.log(`[FloorHeating] Zone '${zoneId}' target set to ${temperature}°C.`);
    return this.getZoneStatus(zoneId);
  }

  /**
   * Get current status of a zone.
   * @param {string} zoneId
   * @returns {object} Zone status snapshot.
   */
  getZoneStatus(zoneId) {
    const zone = this.zones[zoneId];
    if (!zone) throw new Error(`Zone '${zoneId}' not found.`);
    const comfort = this.getComfortScore(zoneId);
    return {
      id: zone.id,
      name: zone.name,
      type: zone.type,
      floorMaterial: zone.floorMaterial,
      enabled: zone.enabled,
      mode: zone.mode,
      targetTemp: zone.targetTemp,
      currentTemp: zone.currentTemp,
      floorTemp: zone.floorTemp,
      airTemp: zone.airTemp,
      humidity: zone.humidity,
      heatingState: zone.heatingState,
      valvePosition: zone.valvePosition,
      flowRate: zone.flowRate,
      currentPower: zone.currentPower,
      energyTodayKwh: Math.round(zone.energyTodayKwh * 100) / 100,
      costTodaySEK: Math.round(zone.costTodaySEK * 100) / 100,
      comfortScore: comfort.score,
      comfortRating: comfort.rating,
      faultCode: zone.faultCode,
      sensorBattery: zone.sensorBattery,
      lastUpdated: zone.updatedAt ? new Date(zone.updatedAt).toISOString() : null
    };
  }

  /**
   * Get status of all zones.
   * @returns {object[]} Array of zone status objects.
   */
  getAllZoneStatus() {
    return Object.keys(this.zones).map(id => this.getZoneStatus(id));
  }

  /**
   * Set the schedule for a zone.
   * @param {string} zoneId
   * @param {object} schedule - Schedule object with periods per day.
   * @returns {object} Updated schedule.
   */
  setSchedule(zoneId, schedule) {
    if (!this.zones[zoneId]) throw new Error(`Zone '${zoneId}' not found.`);
    if (!this.schedules[zoneId]) {
      this.schedules[zoneId] = { active: true, quickHeatEnabled: true, periods: {} };
    }
    if (schedule.active !== undefined) this.schedules[zoneId].active = schedule.active;
    if (schedule.quickHeatEnabled !== undefined) this.schedules[zoneId].quickHeatEnabled = schedule.quickHeatEnabled;
    if (schedule.periods) {
      for (const [day, periods] of Object.entries(schedule.periods)) {
        this.schedules[zoneId].periods[day] = periods;
      }
    }
    this.emit('schedule-updated', { zoneId });
    return this.schedules[zoneId];
  }

  /**
   * Get the schedule for a zone.
   * @param {string} zoneId
   * @returns {object} Schedule.
   */
  getSchedule(zoneId) {
    if (!this.zones[zoneId]) throw new Error(`Zone '${zoneId}' not found.`);
    return this.schedules[zoneId] || null;
  }

  /**
   * Set the operating mode for a zone.
   * @param {string} zoneId
   * @param {string} mode - 'comfort' | 'eco' | 'frost'.
   * @returns {object} Updated zone status.
   */
  setMode(zoneId, mode) {
    const zone = this.zones[zoneId];
    if (!zone) throw new Error(`Zone '${zoneId}' not found.`);
    if (!['comfort', 'eco', 'frost'].includes(mode)) {
      throw new Error(`Invalid mode '${mode}'. Use 'comfort', 'eco', or 'frost'.`);
    }
    zone.mode = mode;
    switch (mode) {
      case 'comfort': zone.targetTemp = zone.comfortTemp; break;
      case 'eco':     zone.targetTemp = zone.ecoTemp;     break;
      case 'frost':   zone.targetTemp = zone.frostTemp;   break;
    }
    zone.updatedAt = Date.now();
    this.emit('mode-changed', { zoneId, mode, source: 'api' });
    return this.getZoneStatus(zoneId);
  }

  /**
   * Set all zones to a specific mode.
   * @param {string} mode - 'comfort' | 'eco' | 'frost'.
   * @returns {object[]} Updated status of all zones.
   */
  setAllZonesMode(mode) {
    return Object.keys(this.zones).map(id => this.setMode(id, mode));
  }

  /**
   * Enable or disable holiday/vacation mode.
   * @param {boolean} enabled
   * @returns {object} Updated config state.
   */
  setHolidayMode(enabled) {
    this.config.holidayMode = enabled;
    if (enabled) {
      for (const zone of Object.values(this.zones)) {
        zone.mode = 'frost';
        zone.targetTemp = zone.frostTemp;
      }
    }
    this.emit('holiday-mode', { enabled });
    this.homey.log(`[FloorHeating] Holiday mode ${enabled ? 'activated' : 'deactivated'}.`);
    return { holidayMode: this.config.holidayMode };
  }

  /**
   * Get energy report.
   * @param {string} [period='day'] - 'day' | 'week' | 'month' | 'total'.
   * @returns {object} Energy report.
   */
  getEnergyReport(period = 'day') {
    const report = {
      period,
      currentPriceSEKperKwh: this.energy.currentPriceSEKperKwh,
      heatingDegreeDays: Math.round(this.energy.heatingDegreeDays * 10) / 10,
      efficiencyScore: this.statistics.avgEfficiencyScore
    };

    switch (period) {
      case 'day': {
        const key = this._dayKey();
        const day = this.energy.dailyConsumption[key] || { totalKwh: 0, costSEK: 0, perZone: {} };
        report.totalKwh = Math.round(day.totalKwh * 100) / 100;
        report.costSEK = Math.round(day.costSEK * 100) / 100;
        report.perZone = {};
        for (const [zoneId, data] of Object.entries(day.perZone || {})) {
          report.perZone[zoneId] = {
            name: this.zones[zoneId] ? this.zones[zoneId].name : zoneId,
            kwh: Math.round(data.kwh * 100) / 100,
            costSEK: Math.round(data.costSEK * 100) / 100
          };
        }
        break;
      }
      case 'week': {
        const key = this._weekKey();
        const week = this.energy.weeklyConsumption[key] || { totalKwh: 0, costSEK: 0 };
        report.totalKwh = Math.round(week.totalKwh * 100) / 100;
        report.costSEK = Math.round(week.costSEK * 100) / 100;
        break;
      }
      case 'month': {
        const key = this._monthKey();
        const month = this.energy.monthlyConsumption[key] || { totalKwh: 0, costSEK: 0 };
        report.totalKwh = Math.round(month.totalKwh * 100) / 100;
        report.costSEK = Math.round(month.costSEK * 100) / 100;
        break;
      }
      case 'total':
      default:
        report.totalKwh = Math.round(this.energy.totalKwh * 100) / 100;
        report.costSEK = Math.round(this.energy.totalCostSEK * 100) / 100;
        break;
    }

    report.runtimeHoursPerZone = {};
    for (const [zoneId, hours] of Object.entries(this.statistics.runtimeHoursPerZone)) {
      report.runtimeHoursPerZone[zoneId] = Math.round(hours * 10) / 10;
    }

    return report;
  }

  /**
   * Get annual energy comparison.
   * @returns {object[]} Array of { year, kwh, costSEK }.
   */
  getAnnualComparison() {
    const years = {};
    for (const [key, data] of Object.entries(this.energy.monthlyConsumption)) {
      const year = key.substring(0, 4);
      if (!years[year]) years[year] = { year, kwh: 0, costSEK: 0 };
      years[year].kwh += data.totalKwh;
      years[year].costSEK += data.costSEK;
    }
    return Object.values(years).map(y => ({
      year: y.year,
      kwh: Math.round(y.kwh * 10) / 10,
      costSEK: Math.round(y.costSEK * 10) / 10
    }));
  }

  /**
   * Add a new heating zone.
   * @param {string} id - Zone identifier.
   * @param {string} name - Display name.
   * @param {string} type - 'electric' | 'water' | 'hybrid'.
   * @param {string} floorMaterial - 'wood' | 'tile' | 'stone' | 'vinyl'.
   * @param {object} [opts={}] - Additional configuration.
   * @returns {object} The new zone.
   */
  addZone(id, name, type, floorMaterial, opts = {}) {
    if (this.zones[id]) throw new Error(`Zone '${id}' already exists.`);
    if (!['electric', 'water', 'hybrid'].includes(type)) {
      throw new Error(`Invalid zone type '${type}'.`);
    }
    if (!this.floorLimits[floorMaterial]) {
      throw new Error(`Unknown floor material '${floorMaterial}'.`);
    }

    this.zones[id] = this._createZone(id, name, type, floorMaterial, {
      targetTemp: opts.targetTemp || 21,
      comfortTemp: opts.comfortTemp || 21,
      ecoTemp: opts.ecoTemp || 18,
      frostTemp: opts.frostTemp || 8,
      maxFloorTemp: opts.maxFloorTemp || this.floorLimits[floorMaterial].maxTemp,
      area: opts.area || 10,
      installedPower: opts.installedPower || 800
    });

    this.pidState[id] = { integral: 0, previousError: 0, lastUpdate: Date.now(),
      output: 0, outputSmoothed: 0 };
    this.occupancy[id] = { occupied: true, lastSeen: Date.now(),
      unoccupiedMinutes: 0, reductionActive: false };
    this.statistics.runtimeHoursPerZone[id] = 0;
    this.statistics.heatingCyclesPerZone[id] = 0;
    this.statistics.comfortScores[id] = 100;

    this._buildScheduleForZone(id);

    this.emit('zone-added', { id, name, type, floorMaterial });
    this.homey.log(`[FloorHeating] Zone '${id}' (${name}) added.`);
    return this.getZoneStatus(id);
  }

  /**
   * Remove a heating zone.
   * @param {string} zoneId
   * @returns {boolean}
   */
  removeZone(zoneId) {
    if (!this.zones[zoneId]) throw new Error(`Zone '${zoneId}' not found.`);
    this._setHeating(zoneId, false);
    delete this.zones[zoneId];
    delete this.pidState[zoneId];
    delete this.occupancy[zoneId];
    delete this.schedules[zoneId];
    delete this.statistics.runtimeHoursPerZone[zoneId];
    delete this.statistics.heatingCyclesPerZone[zoneId];
    delete this.statistics.comfortScores[zoneId];
    this.emit('zone-removed', { zoneId });
    this.homey.log(`[FloorHeating] Zone '${zoneId}' removed.`);
    return true;
  }

  /**
   * Build a default schedule for a single newly added zone.
   * @param {string} zoneId
   * @private
   */
  _buildScheduleForZone(zoneId) {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    this.schedules[zoneId] = { active: true, quickHeatEnabled: true, periods: {} };
    for (const day of days) {
      const isWeekend = day === 'saturday' || day === 'sunday';
      this.schedules[zoneId].periods[day] = isWeekend
        ? [
            { start: '07:00', end: '23:00', mode: 'comfort' },
            { start: '23:00', end: '07:00', mode: 'eco' }
          ]
        : [
            { start: '06:00', end: '09:00', mode: 'comfort' },
            { start: '09:00', end: '17:00', mode: 'eco' },
            { start: '17:00', end: '22:00', mode: 'comfort' },
            { start: '22:00', end: '06:00', mode: 'eco' }
          ];
    }
  }

  /**
   * Enable or disable a zone.
   * @param {string} zoneId
   * @param {boolean} enabled
   * @returns {object} Updated zone status.
   */
  setZoneEnabled(zoneId, enabled) {
    const zone = this.zones[zoneId];
    if (!zone) throw new Error(`Zone '${zoneId}' not found.`);
    zone.enabled = enabled;
    if (!enabled) this._setHeating(zoneId, false);
    zone.updatedAt = Date.now();
    this.emit('zone-enabled', { zoneId, enabled });
    return this.getZoneStatus(zoneId);
  }

  /**
   * Update sensor readings for a zone (called externally by thermostat devices).
   * @param {string} zoneId
   * @param {object} readings
   * @param {number} [readings.floorTemp] - Floor surface temperature °C.
   * @param {number} [readings.airTemp] - Room air temperature °C.
   * @param {number} [readings.humidity] - Relative humidity %.
   * @param {boolean} [readings.moisture] - Moisture detected.
   * @param {number} [readings.battery] - Sensor battery %.
   */
  updateSensorReadings(zoneId, readings) {
    const zone = this.zones[zoneId];
    if (!zone) return;
    if (readings.floorTemp !== undefined) zone.floorTemp = readings.floorTemp;
    if (readings.airTemp !== undefined) {
      zone.airTemp = readings.airTemp;
      zone.currentTemp = readings.airTemp;
    }
    if (readings.humidity !== undefined) zone.humidity = readings.humidity;
    if (readings.moisture !== undefined) zone.moistureDetected = readings.moisture;
    if (readings.battery !== undefined) zone.sensorBattery = readings.battery;
    zone.updatedAt = Date.now();
    this.emit('sensor-updated', { zoneId, readings });
  }

  /**
   * Get full system summary.
   * @returns {object}
   */
  getSystemSummary() {
    const zones = this.getAllZoneStatus();
    const activeHeating = zones.filter(z => z.heatingState).length;
    const totalPower = zones.reduce((sum, z) => sum + z.currentPower, 0);
    const energy = this.getEnergyReport('day');
    const comfort = this.getComfortComparison();
    const maintenance = this.getMaintenanceReport();

    return {
      timestamp: new Date().toISOString(),
      systemState: this.config.summerShutdown ? 'summer-shutdown'
        : this.config.holidayMode ? 'holiday'
        : 'active',
      season: this.weather.season,
      outdoorTemp: this.weather.outdoorTemp,
      zoneCount: zones.length,
      activeHeatingZones: activeHeating,
      totalCurrentPowerW: totalPower,
      energyTodayKwh: energy.totalKwh,
      costTodaySEK: energy.costSEK,
      currentPriceSEKperKwh: this.energy.currentPriceSEKperKwh,
      avgComfortScore: comfort.length > 0
        ? Math.round(comfort.reduce((s, c) => s + c.score, 0) / comfort.length)
        : 0,
      systemHealth: maintenance.systemHealth,
      zones,
      comfort,
      maintenance: { health: maintenance.systemHealth,
        stuckValves: maintenance.stuckValves.length,
        flowAnomalies: maintenance.flowAnomalies.length }
    };
  }

  /**
   * Get statistics overview.
   * @returns {object}
   */
  getStatistics() {
    return {
      runtimeHoursPerZone: Object.entries(this.statistics.runtimeHoursPerZone).map(([id, hours]) => ({
        zoneId: id,
        name: this.zones[id] ? this.zones[id].name : id,
        hours: Math.round(hours * 10) / 10
      })),
      heatingCyclesPerZone: Object.entries(this.statistics.heatingCyclesPerZone).map(([id, cycles]) => ({
        zoneId: id,
        name: this.zones[id] ? this.zones[id].name : id,
        cycles
      })),
      efficiencyScore: this.statistics.avgEfficiencyScore,
      comfortScores: Object.entries(this.statistics.comfortScores).map(([id, score]) => ({
        zoneId: id,
        name: this.zones[id] ? this.zones[id].name : id,
        score
      })),
      heatingDegreeDays: Math.round(this.energy.heatingDegreeDays * 10) / 10,
      totalEnergyKwh: Math.round(this.energy.totalKwh * 10) / 10,
      totalCostSEK: Math.round(this.energy.totalCostSEK * 10) / 10,
      annualComparison: this.getAnnualComparison()
    };
  }

  /**
   * Calibrate a zone's temperature sensor.
   * @param {string} zoneId
   * @param {number} offset - Calibration offset in °C.
   * @returns {object} Updated zone.
   */
  calibrateSensor(zoneId, offset) {
    const zone = this.zones[zoneId];
    if (!zone) throw new Error(`Zone '${zoneId}' not found.`);
    zone.lastCalibration = Date.now();
    zone.currentTemp += offset;
    zone.airTemp += offset;
    zone.floorTemp += offset;
    this.emit('sensor-calibrated', { zoneId, offset });
    return this.getZoneStatus(zoneId);
  }

  /**
   * Clear a fault code on a zone.
   * @param {string} zoneId
   * @returns {object} Updated zone.
   */
  clearFault(zoneId) {
    const zone = this.zones[zoneId];
    if (!zone) throw new Error(`Zone '${zoneId}' not found.`);
    zone.faultCode = null;
    zone.updatedAt = Date.now();
    this.emit('fault-cleared', { zoneId });
    return this.getZoneStatus(zoneId);
  }

  /**
   * Configure PID parameters.
   * @param {object} params - { kp, ki, kd }.
   * @returns {object} Updated PID params.
   */
  setPIDParams(params) {
    if (params.kp !== undefined) this.config.pidParams.kp = params.kp;
    if (params.ki !== undefined) this.config.pidParams.ki = params.ki;
    if (params.kd !== undefined) this.config.pidParams.kd = params.kd;
    this.emit('pid-params-updated', this.config.pidParams);
    return { ...this.config.pidParams };
  }

  /**
   * Set night setback hours.
   * @param {string} start - Start time HH:MM.
   * @param {string} end - End time HH:MM.
   */
  setNightSetback(start, end) {
    this.config.nightSetbackStart = start;
    this.config.nightSetbackEnd = end;
    this.emit('night-setback-updated', { start, end });
  }

  /**
   * Set bathroom pre-heat configuration.
   * @param {string} time - Wake-up time HH:MM.
   * @param {number} minutes - Minutes before to start pre-heating.
   */
  setBathroomPreHeat(time, minutes) {
    this.config.bathroomPreHeatTime = time;
    this.config.bathroomPreHeatMinutes = minutes;
    this.emit('bathroom-preheat-config', { time, minutes });
  }

  /**
   * Force reset daily energy counters (midnight rollover).
   */
  resetDailyEnergy() {
    for (const zone of Object.values(this.zones)) {
      zone.energyTodayKwh = 0;
      zone.costTodaySEK = 0;
      zone.runtimeToday = 0;
    }
    this._buildEnergyDayBucket();
    this.emit('daily-energy-reset');
  }

  /* ==================================================================== */
  /*  Utility helpers                                                     */
  /* ==================================================================== */

  /**
   * Convert HH:MM string to minutes since midnight.
   * @param {string} time
   * @returns {number}
   * @private
   */
  _timeToMinutes(time) {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + (m || 0);
  }

  /**
   * Format hours and minutes to HH:MM.
   * @param {number} h
   * @param {number} m
   * @returns {string}
   * @private
   */
  _formatTime(h, m) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  /**
   * Get a YYYY-MM-DD key for today.
   * @returns {string}
   * @private
   */
  _dayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /**
   * Get a YYYY-Www key for the current ISO week.
   * @returns {string}
   * @private
   */
  _weekKey() {
    const d = new Date();
    const jan1 = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
  }

  /**
   * Get start date of the current week (Monday).
   * @returns {Date}
   * @private
   */
  _weekStartDate() {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }

  /**
   * Get a YYYY-MM key for the current month.
   * @returns {string}
   * @private
   */
  _monthKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
}

module.exports = SmartFloorHeatingControlSystem;
