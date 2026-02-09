'use strict';

const EventEmitter = require('events');

class SmartFireplaceManagementSystem extends EventEmitter {
  constructor(homey) {
    super();
    this.homey = homey;
    this.initialized = false;
    this.intervals = [];

    // Fireplace inventory - Nordic home setup
    this.fireplaces = {
      'living-room-wood': {
        id: 'living-room-wood',
        name: 'Living Room Wood Fireplace',
        type: 'wood',
        location: 'living-room',
        status: 'off',
        fuelType: 'birch',
        heatOutputKW: 12,
        currentTemp: 20,
        targetTemp: 23,
        flueTemp: 20,
        efficiency: 78,
        carbonMonoxidePPM: 0,
        oxygenLevel: 20.9,
        damperPosition: 0,
        fanSpeed: 0,
        lastCleaned: null,
        totalBurnHours: 0,
        installDate: '2021-09-15',
        glassTemp: 20,
        fireScreenClosed: true,
        childLockEngaged: false,
        insertType: 'cast-iron',
        ashLevel: 0
      },
      'bedroom-pellet': {
        id: 'bedroom-pellet',
        name: 'Bedroom Pellet Stove',
        type: 'pellet',
        location: 'bedroom',
        status: 'off',
        fuelType: 'pellet',
        heatOutputKW: 8,
        currentTemp: 19,
        targetTemp: 21,
        flueTemp: 20,
        efficiency: 92,
        carbonMonoxidePPM: 0,
        oxygenLevel: 20.9,
        damperPosition: 0,
        fanSpeed: 0,
        lastCleaned: null,
        totalBurnHours: 0,
        installDate: '2022-03-10',
        glassTemp: 20,
        fireScreenClosed: true,
        childLockEngaged: false,
        autoFeedEnabled: true,
        hopperLevel: 80
      },
      'outdoor-patio': {
        id: 'outdoor-patio',
        name: 'Outdoor Patio Gas Fireplace',
        type: 'gas',
        location: 'patio',
        status: 'off',
        fuelType: 'propane',
        heatOutputKW: 6,
        currentTemp: null,
        targetTemp: null,
        flueTemp: 20,
        efficiency: 85,
        carbonMonoxidePPM: 0,
        oxygenLevel: 20.9,
        damperPosition: 0,
        fanSpeed: 0,
        lastCleaned: null,
        totalBurnHours: 0,
        installDate: '2023-06-20',
        glassTemp: 20,
        fireScreenClosed: true,
        childLockEngaged: false,
        flameHeight: 50,
        pilotLitStatus: false
      },
      'sauna-wood': {
        id: 'sauna-wood',
        name: 'Sauna Wood Stove',
        type: 'wood',
        location: 'sauna',
        status: 'off',
        fuelType: 'birch',
        heatOutputKW: 15,
        currentTemp: 20,
        targetTemp: 80,
        flueTemp: 20,
        efficiency: 70,
        carbonMonoxidePPM: 0,
        oxygenLevel: 20.9,
        damperPosition: 0,
        fanSpeed: 0,
        lastCleaned: null,
        totalBurnHours: 0,
        installDate: '2020-11-01',
        glassTemp: 20,
        fireScreenClosed: true,
        childLockEngaged: false,
        stonesTemp: 20,
        steamGenerated: false
      }
    };

    // Fuel management
    this.fuelInventory = {
      wood: {
        birch: { quantity_m3: 6.5, moistureContent: 15, seasoningMonths: 18, status: 'seasoned', split: true, covered: true },
        pine: { quantity_m3: 2.0, moistureContent: 22, seasoningMonths: 10, status: 'seasoning', split: true, covered: true },
        oak: { quantity_m3: 1.5, moistureContent: 12, seasoningMonths: 24, status: 'seasoned', split: true, covered: true }
      },
      pellets: {
        brand: 'Nordic Pellets Premium',
        bagCount: 40,
        bagWeightKg: 15,
        hopperCapacityKg: 25,
        currentHopperKg: 20,
        autoFeedLevel: 80,
        consumptionRateKgHr: 1.2
      },
      gas: {
        tankLevel: 72,
        tankCapacityL: 500,
        consumptionRateLHr: 1.8,
        refillThreshold: 20,
        lastRefill: '2025-10-15',
        supplier: 'AGA Gas AB'
      }
    };

    // Wood storage tracking
    this.woodStorage = {
      totalCapacity_m3: 15,
      seasoned_m3: 8.0,
      green_m3: 2.0,
      splitReady_m3: 9.0,
      unsplit_m3: 1.0,
      coveredStorage: true,
      storageLocation: 'vedförråd',
      lastInventoryCheck: null
    };

    // Chimney maintenance records
    this.chimneyMaintenance = {
      'living-room-wood': {
        lastSweep: '2025-09-20',
        nextSweepDue: '2026-09-20',
        creosoteBuildupMm: 1.5,
        draftPa: 12,
        sparkArrestorOk: true,
        rainCapOk: true,
        birdGuardOk: true,
        inspectionRecords: [],
        sweepProvider: 'Kommunal Sotare'
      },
      'bedroom-pellet': {
        lastSweep: '2025-09-20',
        nextSweepDue: '2026-09-20',
        creosoteBuildupMm: 0.5,
        draftPa: 10,
        sparkArrestorOk: true,
        rainCapOk: true,
        birdGuardOk: true,
        inspectionRecords: [],
        sweepProvider: 'Kommunal Sotare'
      },
      'sauna-wood': {
        lastSweep: '2025-09-20',
        nextSweepDue: '2026-09-20',
        creosoteBuildupMm: 2.0,
        draftPa: 14,
        sparkArrestorOk: true,
        rainCapOk: true,
        birdGuardOk: true,
        inspectionRecords: [],
        sweepProvider: 'Kommunal Sotare'
      }
    };

    // Air quality monitoring
    this.airQuality = {
      indoorCO2: 420,
      indoorPM25: 5,
      outdoorPM25: 8,
      ventilationActive: false,
      freshAirIntakeOpen: false,
      smokeSpillageDetected: false,
      lastReading: null
    };

    // Burn session management
    this.activeSessions = {};
    this.sessionHistory = [];

    // Energy contribution tracking
    this.energyContribution = {
      totalKwhThisSeason: 0,
      totalKwhThisMonth: 0,
      homeHeatingPercentage: 0,
      costSavingsSEK: 0,
      monthlyContributions: {},
      costPerKwhElectric: 1.85,
      costPerKwhDistrict: 0.95,
      costPerKwhWood: 0.35,
      costPerKwhPellet: 0.55,
      costPerKwhGas: 1.10
    };

    // Swedish regulations
    this.regulations = {
      eldningsförbud: false,
      eldningsförbudRegion: 'Stockholm',
      environmentalZone: 'zone-2',
      emissionStandardMet: true,
      insuranceValid: true,
      insuranceExpiry: '2026-12-31',
      approvedAppliances: ['living-room-wood', 'bedroom-pellet', 'outdoor-patio', 'sauna-wood'],
      lastInspectionDate: '2025-09-20'
    };

    // Seasonal operation
    this.seasonalConfig = {
      heatingSeasonStart: 10,
      heatingSeasonEnd: 4,
      isHeatingSeason: false,
      summerShutdownComplete: false,
      startupChecklistDone: false,
      startupChecklist: {
        chimneyInspected: false,
        damperOperational: false,
        coDetectorsTested: false,
        fuelStocked: false,
        ashRemoved: false,
        gasketChecked: false,
        fireExtinguisherReady: false
      }
    };

    // Wood procurement
    this.woodProcurement = {
      suppliers: [
        { name: 'Skogsägare Eriksson', pricePerM3: 750, woodType: 'birch', phone: '070-1234567', deliveryAvailable: true },
        { name: 'Ved & Bränsle AB', pricePerM3: 850, woodType: 'mixed', phone: '08-9876543', deliveryAvailable: true },
        { name: 'Lokalt Sågverk', pricePerM3: 600, woodType: 'pine', phone: '070-5551234', deliveryAvailable: false }
      ],
      pendingOrders: [],
      orderHistory: [],
      optimalOrderMonth: 4,
      totalSpentSEK: 0
    };

    // Emission tracking
    this.emissions = {
      totalCO2kg: 0,
      totalPMg: 0,
      totalNOxg: 0,
      sessionEmissions: [],
      monthlyTotals: {}
    };

    // Fireplace scenes
    this.scenes = {
      romantic: { flameLevel: 30, lightsLevel: 15, musicEnabled: true, soundscape: 'crackling-soft', fanSpeed: 0 },
      'cozy-evening': { flameLevel: 60, lightsLevel: 40, musicEnabled: true, soundscape: 'crackling-medium', fanSpeed: 20 },
      'heating-boost': { flameLevel: 100, lightsLevel: 70, musicEnabled: false, soundscape: null, fanSpeed: 100 },
      'sauna-session': { preheatTarget: 80, timerMinutes: 60, cooldownMinutes: 30, steamBursts: true }
    };
    this.activeScene = null;

    // Safety thresholds
    this.safetyThresholds = {
      coAlarmPPM: 35,
      coWarningPPM: 9,
      maxFlueTempC: 350,
      maxRoomTempC: 40,
      maxGlassTempC: 200,
      minOxygenPercent: 19.0,
      minDraftPa: 5
    };

    // Outdoor weather context
    this.weatherContext = {
      outdoorTemp: 0,
      indoorTemp: 20,
      windSpeed: 5,
      windDirection: 'NW',
      humidity: 65
    };

    // Smart damper state
    this.smartDamper = {
      motorized: true,
      autoCloseOnExtinction: true,
      windCompensation: true,
      backdraftPrevention: true
    };
  }

  async initialize() {
    if (this.initialized) {
      this.homey.log('[Fireplace] Already initialized');
      return;
    }

    this.homey.log('[Fireplace] Initializing Smart Fireplace Management System...');

    try {
      this._determineHeatingSeason();
      this._checkStartupChecklist();
      this._updateWoodStorageStatus();
      this._loadSessionHistory();

      // Safety monitoring interval - every 10 seconds
      const safetyInterval = setInterval(() => this._runSafetyChecks(), 10000);
      this.intervals.push(safetyInterval);

      // Air quality monitoring - every 30 seconds
      const airQualityInterval = setInterval(() => this._monitorAirQuality(), 30000);
      this.intervals.push(airQualityInterval);

      // Temperature automation - every 60 seconds
      const tempInterval = setInterval(() => this._temperatureAutomation(), 60000);
      this.intervals.push(tempInterval);

      // Fuel level monitoring - every 5 minutes
      const fuelInterval = setInterval(() => this._monitorFuelLevels(), 300000);
      this.intervals.push(fuelInterval);

      // Energy tracking - every 15 minutes
      const energyInterval = setInterval(() => this._updateEnergyContribution(), 900000);
      this.intervals.push(energyInterval);

      // Chimney maintenance check - every hour
      const chimneyInterval = setInterval(() => this._checkChimneyMaintenance(), 3600000);
      this.intervals.push(chimneyInterval);

      // Burn ban check - every 30 minutes
      const burnBanInterval = setInterval(() => this._checkBurnBanStatus(), 1800000);
      this.intervals.push(burnBanInterval);

      // Pellet auto-feed - every 2 minutes
      const pelletInterval = setInterval(() => this._managePelletAutoFeed(), 120000);
      this.intervals.push(pelletInterval);

      // Smart damper control - every 20 seconds
      const damperInterval = setInterval(() => this._smartDamperControl(), 20000);
      this.intervals.push(damperInterval);

      // Emission tracking - every 5 minutes
      const emissionInterval = setInterval(() => this._trackEmissions(), 300000);
      this.intervals.push(emissionInterval);

      this.initialized = true;
      this.homey.log('[Fireplace] System initialized with ' + Object.keys(this.fireplaces).length + ' fireplaces');
      this.homey.emit('fireplace-system-ready', { fireplaceCount: Object.keys(this.fireplaces).length });

    } catch (err) {
      this.homey.error('[Fireplace] Initialization failed:', err.message);
      throw err;
    }
  }

  // --- Fireplace Control ---

  async startFireplace(fireplaceId, options = {}) {
    const fp = this.fireplaces[fireplaceId];
    if (!fp) {
      this.homey.error('[Fireplace] Unknown fireplace: ' + fireplaceId);
      return { success: false, reason: 'unknown_fireplace' };
    }

    if (fp.status === 'running' || fp.status === 'starting') {
      this.homey.log('[Fireplace] ' + fireplaceId + ' is already ' + fp.status);
      return { success: false, reason: 'already_active' };
    }

    if (this.regulations.eldningsförbud && fp.type !== 'gas') {
      this.homey.log('[Fireplace] Burn ban active - cannot start ' + fireplaceId);
      this.homey.emit('fireplace-burn-ban-blocked', { fireplaceId });
      return { success: false, reason: 'burn_ban_active' };
    }

    if (fp.childLockEngaged) {
      this.homey.log('[Fireplace] Child lock engaged on ' + fireplaceId);
      return { success: false, reason: 'child_lock_engaged' };
    }

    // Pre-start safety checks
    const safetyResult = this._preStartSafetyCheck(fireplaceId);
    if (!safetyResult.safe) {
      this.homey.error('[Fireplace] Pre-start safety check failed for ' + fireplaceId + ': ' + safetyResult.reason);
      return { success: false, reason: safetyResult.reason };
    }

    fp.status = 'starting';
    fp.damperPosition = options.damperPosition || 80;
    if (options.targetTemp) fp.targetTemp = options.targetTemp;

    this.homey.log('[Fireplace] Starting ' + fireplaceId + ' (' + fp.type + ')');

    // Type-specific startup
    if (fp.type === 'wood') {
      await this._startWoodFireplace(fireplaceId, options);
    } else if (fp.type === 'pellet') {
      await this._startPelletStove(fireplaceId, options);
    } else if (fp.type === 'gas') {
      await this._startGasFireplace(fireplaceId, options);
    }

    this._startBurnSession(fireplaceId);
    this.homey.emit('fireplace-started', { fireplaceId, type: fp.type, targetTemp: fp.targetTemp });

    return { success: true, fireplaceId, status: fp.status };
  }

  async stopFireplace(fireplaceId) {
    const fp = this.fireplaces[fireplaceId];
    if (!fp) return { success: false, reason: 'unknown_fireplace' };

    if (fp.status === 'off' || fp.status === 'cooling') {
      return { success: false, reason: 'not_running' };
    }

    this.homey.log('[Fireplace] Stopping ' + fireplaceId);
    fp.status = 'cooling';
    fp.fanSpeed = 0;

    if (fp.type === 'gas') {
      fp.flameHeight = 0;
      fp.pilotLitStatus = false;
    }

    // Gradual cooldown
    fp.damperPosition = 20;

    this._endBurnSession(fireplaceId);

    // Auto-close damper after cooling
    setTimeout(() => {
      if (fp.status === 'cooling') {
        fp.status = 'off';
        fp.damperPosition = 0;
        fp.flueTemp = Math.max(fp.flueTemp - 100, 20);
        fp.currentTemp = fp.currentTemp !== null ? Math.max(fp.currentTemp - 2, 18) : null;
        this.homey.log('[Fireplace] ' + fireplaceId + ' fully cooled and damper closed');
        this.homey.emit('fireplace-cooled', { fireplaceId });
      }
    }, 1800000);

    this.homey.emit('fireplace-stopping', { fireplaceId });
    return { success: true, fireplaceId, status: 'cooling' };
  }

  async _startWoodFireplace(fireplaceId, options) {
    const fp = this.fireplaces[fireplaceId];
    const fuelType = options.fuelType || fp.fuelType;

    // Check wood inventory
    const woodStock = this.fuelInventory.wood[fuelType];
    if (!woodStock || woodStock.quantity_m3 < 0.01) {
      this.homey.error('[Fireplace] Insufficient ' + fuelType + ' wood supply');
      fp.status = 'error';
      return;
    }

    if (woodStock.moistureContent > 20) {
      this.homey.log('[Fireplace] Warning: ' + fuelType + ' wood moisture is ' + woodStock.moistureContent + '% (recommended <20%)');
      this.homey.emit('fireplace-wood-moisture-warning', { fuelType, moisture: woodStock.moistureContent });
    }

    // Simulate startup sequence
    fp.flueTemp = 45;
    fp.efficiency = 65;

    setTimeout(() => {
      if (fp.status === 'starting') {
        fp.status = 'running';
        fp.flueTemp = 180;
        fp.efficiency = 78;
        fp.currentTemp = fp.currentTemp !== null ? fp.currentTemp + 1 : null;
        this.homey.log('[Fireplace] ' + fireplaceId + ' now running');
      }
    }, 600000);
  }

  async _startPelletStove(fireplaceId, options) {
    const fp = this.fireplaces[fireplaceId];

    if (this.fuelInventory.pellets.currentHopperKg < 1) {
      this.homey.error('[Fireplace] Pellet hopper nearly empty');
      fp.status = 'error';
      return;
    }

    fp.autoFeedEnabled = true;
    fp.hopperLevel = Math.round((this.fuelInventory.pellets.currentHopperKg / this.fuelInventory.pellets.hopperCapacityKg) * 100);
    fp.flueTemp = 60;
    fp.fanSpeed = 30;

    setTimeout(() => {
      if (fp.status === 'starting') {
        fp.status = 'running';
        fp.flueTemp = 150;
        fp.efficiency = 92;
        fp.fanSpeed = 50;
        this.homey.log('[Fireplace] ' + fireplaceId + ' pellet stove running');
      }
    }, 180000);
  }

  async _startGasFireplace(fireplaceId, options) {
    const fp = this.fireplaces[fireplaceId];

    if (this.fuelInventory.gas.tankLevel < 5) {
      this.homey.error('[Fireplace] Gas tank too low to start');
      fp.status = 'error';
      return;
    }

    fp.pilotLitStatus = true;
    fp.flameHeight = options.flameHeight || 50;

    setTimeout(() => {
      if (fp.status === 'starting') {
        fp.status = 'running';
        fp.flueTemp = 120;
        fp.efficiency = 85;
        this.homey.log('[Fireplace] ' + fireplaceId + ' gas fireplace running');
      }
    }, 30000);
  }

  // --- Burn Session Management ---

  _startBurnSession(fireplaceId) {
    const fp = this.fireplaces[fireplaceId];
    const session = {
      id: 'session-' + Date.now() + '-' + fireplaceId,
      fireplaceId,
      startTime: new Date().toISOString(),
      endTime: null,
      fuelType: fp.fuelType,
      fuelUsed: 0,
      heatProducedKwh: 0,
      durationMinutes: 0,
      efficiencyScore: fp.efficiency,
      emissionsCO2kg: 0,
      emissionsPMg: 0,
      startTemp: fp.currentTemp,
      peakTemp: fp.currentTemp
    };
    this.activeSessions[fireplaceId] = session;
    this.homey.log('[Fireplace] Burn session started: ' + session.id);
  }

  _endBurnSession(fireplaceId) {
    const session = this.activeSessions[fireplaceId];
    if (!session) return;

    session.endTime = new Date().toISOString();
    const startMs = new Date(session.startTime).getTime();
    const endMs = new Date(session.endTime).getTime();
    session.durationMinutes = Math.round((endMs - startMs) / 60000);

    const fp = this.fireplaces[fireplaceId];
    const hours = session.durationMinutes / 60;
    session.heatProducedKwh = Math.round(fp.heatOutputKW * hours * (fp.efficiency / 100) * 100) / 100;
    session.efficiencyScore = fp.efficiency;

    // Estimate fuel used
    if (fp.type === 'wood') {
      session.fuelUsed = Math.round(hours * 3.5 * 100) / 100; // kg
    } else if (fp.type === 'pellet') {
      session.fuelUsed = Math.round(hours * this.fuelInventory.pellets.consumptionRateKgHr * 100) / 100;
    } else if (fp.type === 'gas') {
      session.fuelUsed = Math.round(hours * this.fuelInventory.gas.consumptionRateLHr * 100) / 100;
    }

    // Emission estimates
    session.emissionsCO2kg = this._estimateSessionCO2(fp.type, session.fuelUsed);
    session.emissionsPMg = this._estimateSessionPM(fp.type, session.fuelUsed);

    fp.totalBurnHours += hours;
    this.sessionHistory.push(session);
    delete this.activeSessions[fireplaceId];

    this.homey.log('[Fireplace] Burn session ended: ' + session.id + ' (' + session.durationMinutes + 'min, ' + session.heatProducedKwh + 'kWh)');
    this.homey.emit('fireplace-session-ended', session);
  }

  _estimateSessionCO2(type, fuelUsed) {
    const factors = { wood: 0.39, pellet: 0.0, gas: 2.75 }; // kg CO2 per kg/L fuel (pellet considered carbon-neutral)
    return Math.round((factors[type] || 0) * fuelUsed * 100) / 100;
  }

  _estimateSessionPM(type, fuelUsed) {
    const factors = { wood: 4.5, pellet: 0.3, gas: 0.01 }; // g PM per kg/L
    return Math.round((factors[type] || 0) * fuelUsed * 100) / 100;
  }

  // --- Safety Monitoring ---

  _runSafetyChecks() {
    for (const [id, fp] of Object.entries(this.fireplaces)) {
      if (fp.status === 'off') continue;

      // CO monitoring
      if (fp.carbonMonoxidePPM >= this.safetyThresholds.coAlarmPPM) {
        this.homey.error('[Fireplace] ALARM: CO level critical at ' + id + ': ' + fp.carbonMonoxidePPM + ' ppm');
        this.homey.emit('fireplace-co-alarm', { fireplaceId: id, level: fp.carbonMonoxidePPM });
        this._emergencyShutdown(id, 'co_alarm');
      } else if (fp.carbonMonoxidePPM >= this.safetyThresholds.coWarningPPM) {
        this.homey.log('[Fireplace] WARNING: CO level elevated at ' + id + ': ' + fp.carbonMonoxidePPM + ' ppm');
        this.homey.emit('fireplace-co-warning', { fireplaceId: id, level: fp.carbonMonoxidePPM });
      }

      // Flue temperature
      if (fp.flueTemp >= this.safetyThresholds.maxFlueTempC) {
        this.homey.error('[Fireplace] ALARM: Flue temp too high at ' + id + ': ' + fp.flueTemp + '°C');
        this.homey.emit('fireplace-flue-overheat', { fireplaceId: id, temp: fp.flueTemp });
        this._emergencyShutdown(id, 'flue_overheat');
      }

      // Room temperature
      if (fp.currentTemp !== null && fp.currentTemp >= this.safetyThresholds.maxRoomTempC) {
        this.homey.log('[Fireplace] Room temp limit reached at ' + id + ': ' + fp.currentTemp + '°C');
        this.stopFireplace(id);
      }

      // Glass temperature warning
      if (fp.glassTemp >= this.safetyThresholds.maxGlassTempC) {
        this.homey.emit('fireplace-glass-hot', { fireplaceId: id, temp: fp.glassTemp });
      }

      // Oxygen level
      if (fp.oxygenLevel < this.safetyThresholds.minOxygenPercent) {
        this.homey.error('[Fireplace] Low oxygen at ' + id + ': ' + fp.oxygenLevel + '%');
        this.homey.emit('fireplace-low-oxygen', { fireplaceId: id, level: fp.oxygenLevel });
        this._emergencyShutdown(id, 'low_oxygen');
      }

      // Fire screen check
      if (!fp.fireScreenClosed && fp.status === 'running' && fp.type === 'wood') {
        this.homey.log('[Fireplace] WARNING: Fire screen open on ' + id);
        this.homey.emit('fireplace-screen-open', { fireplaceId: id });
      }
    }
  }

  _preStartSafetyCheck(fireplaceId) {
    const fp = this.fireplaces[fireplaceId];

    if (fp.carbonMonoxidePPM > this.safetyThresholds.coWarningPPM) {
      return { safe: false, reason: 'co_level_elevated' };
    }

    if (fp.oxygenLevel < this.safetyThresholds.minOxygenPercent) {
      return { safe: false, reason: 'low_oxygen' };
    }

    const chimney = this.chimneyMaintenance[fireplaceId];
    if (chimney && chimney.draftPa < this.safetyThresholds.minDraftPa) {
      return { safe: false, reason: 'insufficient_draft' };
    }

    if (chimney && chimney.creosoteBuildupMm > 5) {
      return { safe: false, reason: 'creosote_buildup_excessive' };
    }

    if (fp.ashLevel > 80) {
      return { safe: false, reason: 'ash_needs_removal' };
    }

    return { safe: true };
  }

  _emergencyShutdown(fireplaceId, reason) {
    const fp = this.fireplaces[fireplaceId];
    this.homey.error('[Fireplace] EMERGENCY SHUTDOWN: ' + fireplaceId + ' - ' + reason);

    fp.status = 'error';
    fp.fanSpeed = 100;
    fp.damperPosition = 100;

    if (fp.type === 'gas') {
      fp.flameHeight = 0;
      fp.pilotLitStatus = false;
    }

    if (fp.type === 'pellet') {
      fp.autoFeedEnabled = false;
    }

    this._endBurnSession(fireplaceId);
    this.homey.emit('fireplace-emergency-shutdown', { fireplaceId, reason, timestamp: new Date().toISOString() });
  }

  // --- Temperature Automation ---

  _temperatureAutomation() {
    const indoorTemp = this.weatherContext.indoorTemp;
    const outdoorTemp = this.weatherContext.outdoorTemp;
    const month = new Date().getMonth() + 1;

    if (!this.seasonalConfig.isHeatingSeason) return;

    // Auto-start logic: indoor <18°C and outdoor <5°C
    if (indoorTemp < 18 && outdoorTemp < 5) {
      for (const [id, fp] of Object.entries(this.fireplaces)) {
        if (fp.status === 'off' && fp.location !== 'patio' && fp.location !== 'sauna') {
          this.homey.log('[Fireplace] Auto-start triggered for ' + id + ' (indoor: ' + indoorTemp + '°C, outdoor: ' + outdoorTemp + '°C)');
          this.startFireplace(id, { targetTemp: 22 });
          break;
        }
      }
    }

    // Auto-shutdown when target reached
    for (const [id, fp] of Object.entries(this.fireplaces)) {
      if (fp.status === 'running' && fp.currentTemp !== null && fp.targetTemp !== null) {
        if (fp.currentTemp >= fp.targetTemp + 1) {
          this.homey.log('[Fireplace] Target temp reached at ' + id + ', initiating shutdown');
          this.stopFireplace(id);
        }
      }
    }

    // Auto-damper adjustment based on flue temp
    for (const [id, fp] of Object.entries(this.fireplaces)) {
      if (fp.status === 'running') {
        this._adjustDamperForFlueTemp(id);
      }
    }

    // Night mode - bank coals between 22:00 and 06:00
    const hour = new Date().getHours();
    if (hour >= 22 || hour < 6) {
      for (const [id, fp] of Object.entries(this.fireplaces)) {
        if (fp.status === 'running' && fp.type === 'wood' && fp.location !== 'sauna') {
          if (fp.damperPosition > 25) {
            fp.damperPosition = 25;
            fp.fanSpeed = 0;
            this.homey.log('[Fireplace] Night mode: banking coals on ' + id);
            this.homey.emit('fireplace-night-mode', { fireplaceId: id });
          }
        }
      }
    }
  }

  _adjustDamperForFlueTemp(fireplaceId) {
    const fp = this.fireplaces[fireplaceId];

    if (fp.flueTemp > 280) {
      fp.damperPosition = Math.max(fp.damperPosition - 10, 20);
      this.homey.log('[Fireplace] Reducing damper on ' + fireplaceId + ' (flue: ' + fp.flueTemp + '°C)');
    } else if (fp.flueTemp < 120 && fp.status === 'running') {
      fp.damperPosition = Math.min(fp.damperPosition + 10, 90);
      this.homey.log('[Fireplace] Increasing damper on ' + fireplaceId + ' (flue: ' + fp.flueTemp + '°C)');
    }
  }

  // --- Smart Damper Control ---

  _smartDamperControl() {
    if (!this.smartDamper.motorized) return;

    for (const [id, fp] of Object.entries(this.fireplaces)) {
      // Auto-close on extinction
      if (this.smartDamper.autoCloseOnExtinction && fp.status === 'off' && fp.damperPosition > 0) {
        fp.damperPosition = 0;
        this.homey.log('[Fireplace] Auto-closed damper on ' + id);
      }

      // Wind compensation for backdraft prevention
      if (this.smartDamper.windCompensation && fp.status === 'running') {
        const windSpeed = this.weatherContext.windSpeed;
        if (windSpeed > 15 && this.smartDamper.backdraftPrevention) {
          const adjustment = Math.min(windSpeed - 10, 20);
          fp.damperPosition = Math.max(fp.damperPosition - adjustment, 30);
          this.homey.log('[Fireplace] Wind compensation on ' + id + ': damper adjusted to ' + fp.damperPosition + '%');
        }
      }
    }
  }

  // --- Air Quality Integration ---

  _monitorAirQuality() {
    const anyRunning = Object.values(this.fireplaces).some(fp => fp.status === 'running' || fp.status === 'starting');
    if (!anyRunning) return;

    this.airQuality.lastReading = new Date().toISOString();

    // CO2 monitoring during burn
    if (this.airQuality.indoorCO2 > 1000) {
      this.homey.log('[Fireplace] Elevated indoor CO2: ' + this.airQuality.indoorCO2 + ' ppm');
      this.airQuality.ventilationActive = true;
      this.airQuality.freshAirIntakeOpen = true;
      this.homey.emit('fireplace-ventilation-needed', { co2: this.airQuality.indoorCO2 });
    }

    // Smoke spillage detection
    if (this.airQuality.indoorPM25 > 35) {
      this.airQuality.smokeSpillageDetected = true;
      this.homey.error('[Fireplace] Smoke spillage detected! Indoor PM2.5: ' + this.airQuality.indoorPM25);
      this.homey.emit('fireplace-smoke-spillage', { pm25: this.airQuality.indoorPM25 });
    } else {
      this.airQuality.smokeSpillageDetected = false;
    }

    // Outdoor air quality impact
    if (this.airQuality.outdoorPM25 > 50) {
      this.homey.log('[Fireplace] Poor outdoor air quality (PM2.5: ' + this.airQuality.outdoorPM25 + '), consider reducing burn');
      this.homey.emit('fireplace-outdoor-air-quality-poor', { pm25: this.airQuality.outdoorPM25 });
    }
  }

  // --- Fuel Level Monitoring ---

  _monitorFuelLevels() {
    // Wood inventory check
    let totalWood = 0;
    for (const [type, stock] of Object.entries(this.fuelInventory.wood)) {
      totalWood += stock.quantity_m3;
      if (stock.quantity_m3 < 1.0) {
        this.homey.log('[Fireplace] Low ' + type + ' wood stock: ' + stock.quantity_m3 + ' m³');
        this.homey.emit('fireplace-low-wood', { woodType: type, quantity: stock.quantity_m3 });
      }
    }

    // Pellet hopper monitoring
    const pellets = this.fuelInventory.pellets;
    pellets.autoFeedLevel = Math.round((pellets.currentHopperKg / pellets.hopperCapacityKg) * 100);
    if (pellets.autoFeedLevel < 20) {
      this.homey.log('[Fireplace] Pellet hopper low: ' + pellets.autoFeedLevel + '%');
      this.homey.emit('fireplace-low-pellets', { hopperLevel: pellets.autoFeedLevel, bagsRemaining: pellets.bagCount });
    }
    if (pellets.bagCount < 5) {
      this.homey.emit('fireplace-order-pellets', { bagsRemaining: pellets.bagCount });
    }

    // Gas tank monitoring
    const gas = this.fuelInventory.gas;
    if (gas.tankLevel <= gas.refillThreshold) {
      this.homey.log('[Fireplace] Gas tank low: ' + gas.tankLevel + '%');
      this.homey.emit('fireplace-low-gas', { level: gas.tankLevel, supplier: gas.supplier });
    }
  }

  _managePelletAutoFeed() {
    const fp = this.fireplaces['bedroom-pellet'];
    if (!fp || fp.status !== 'running' || !fp.autoFeedEnabled) return;

    const pellets = this.fuelInventory.pellets;
    const consumptionPerCycle = (this.fuelInventory.pellets.consumptionRateKgHr / 30); // per 2-minute cycle

    pellets.currentHopperKg = Math.max(pellets.currentHopperKg - consumptionPerCycle, 0);
    fp.hopperLevel = Math.round((pellets.currentHopperKg / pellets.hopperCapacityKg) * 100);

    // Auto-refill hopper from bags
    if (pellets.currentHopperKg < 3 && pellets.bagCount > 0) {
      pellets.bagCount -= 1;
      pellets.currentHopperKg += pellets.bagWeightKg;
      this.homey.log('[Fireplace] Auto-refilled pellet hopper from bag. Bags remaining: ' + pellets.bagCount);
      this.homey.emit('fireplace-pellet-hopper-refilled', { bagsRemaining: pellets.bagCount });
    }

    if (pellets.currentHopperKg <= 0) {
      this.homey.error('[Fireplace] Pellet hopper empty, shutting down stove');
      this.stopFireplace('bedroom-pellet');
    }
  }

  // --- Energy Contribution Tracking ---

  _updateEnergyContribution() {
    const now = new Date();
    const monthKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

    for (const [id, fp] of Object.entries(this.fireplaces)) {
      if (fp.status !== 'running') continue;

      const kwhIncrement = (fp.heatOutputKW * (fp.efficiency / 100) * 0.25); // 15-min interval
      this.energyContribution.totalKwhThisSeason += kwhIncrement;
      this.energyContribution.totalKwhThisMonth += kwhIncrement;

      if (!this.energyContribution.monthlyContributions[monthKey]) {
        this.energyContribution.monthlyContributions[monthKey] = { kwhTotal: 0, byFireplace: {} };
      }
      this.energyContribution.monthlyContributions[monthKey].kwhTotal += kwhIncrement;

      if (!this.energyContribution.monthlyContributions[monthKey].byFireplace[id]) {
        this.energyContribution.monthlyContributions[monthKey].byFireplace[id] = 0;
      }
      this.energyContribution.monthlyContributions[monthKey].byFireplace[id] += kwhIncrement;
    }

    // Calculate cost savings vs electric heating
    const electricCost = this.energyContribution.totalKwhThisSeason * this.energyContribution.costPerKwhElectric;
    const fireplaceCost = this.energyContribution.totalKwhThisSeason * this.energyContribution.costPerKwhWood;
    this.energyContribution.costSavingsSEK = Math.round((electricCost - fireplaceCost) * 100) / 100;
  }

  getEnergyReport() {
    return {
      totalKwhThisSeason: Math.round(this.energyContribution.totalKwhThisSeason * 100) / 100,
      totalKwhThisMonth: Math.round(this.energyContribution.totalKwhThisMonth * 100) / 100,
      homeHeatingPercentage: this.energyContribution.homeHeatingPercentage,
      costSavingsSEK: this.energyContribution.costSavingsSEK,
      monthlyBreakdown: this.energyContribution.monthlyContributions,
      costComparison: {
        electricSEK: Math.round(this.energyContribution.totalKwhThisSeason * this.energyContribution.costPerKwhElectric * 100) / 100,
        districtSEK: Math.round(this.energyContribution.totalKwhThisSeason * this.energyContribution.costPerKwhDistrict * 100) / 100,
        woodSEK: Math.round(this.energyContribution.totalKwhThisSeason * this.energyContribution.costPerKwhWood * 100) / 100,
        pelletSEK: Math.round(this.energyContribution.totalKwhThisSeason * this.energyContribution.costPerKwhPellet * 100) / 100
      }
    };
  }

  // --- Chimney Maintenance ---

  _checkChimneyMaintenance() {
    const now = new Date();

    for (const [id, maintenance] of Object.entries(this.chimneyMaintenance)) {
      const nextSweep = new Date(maintenance.nextSweepDue);
      const daysUntilSweep = Math.round((nextSweep.getTime() - now.getTime()) / 86400000);

      if (daysUntilSweep <= 30) {
        this.homey.log('[Fireplace] Chimney sweep due within 30 days for ' + id + ' (sotning)');
        this.homey.emit('fireplace-sweep-due', { fireplaceId: id, dueDate: maintenance.nextSweepDue, provider: maintenance.sweepProvider });
      }

      // Creosote buildup warning
      if (maintenance.creosoteBuildupMm > 3) {
        this.homey.log('[Fireplace] Creosote buildup warning on ' + id + ': ' + maintenance.creosoteBuildupMm + 'mm');
        this.homey.emit('fireplace-creosote-warning', { fireplaceId: id, buildupMm: maintenance.creosoteBuildupMm });
      }

      // Draft check
      if (maintenance.draftPa < this.safetyThresholds.minDraftPa) {
        this.homey.log('[Fireplace] Low draft on ' + id + ': ' + maintenance.draftPa + ' Pa');
        this.homey.emit('fireplace-low-draft', { fireplaceId: id, draftPa: maintenance.draftPa });
      }
    }
  }

  recordChimneySweep(fireplaceId, details = {}) {
    const maintenance = this.chimneyMaintenance[fireplaceId];
    if (!maintenance) return { success: false, reason: 'no_chimney_record' };

    const now = new Date();
    maintenance.lastSweep = now.toISOString().split('T')[0];
    maintenance.nextSweepDue = new Date(now.setFullYear(now.getFullYear() + 1)).toISOString().split('T')[0];
    maintenance.creosoteBuildupMm = 0;

    const record = {
      date: maintenance.lastSweep,
      provider: details.provider || maintenance.sweepProvider,
      findings: details.findings || 'Normal',
      creosoteRemoved: details.creosoteRemoved || true,
      draftMeasured: details.draftPa || maintenance.draftPa,
      passed: details.passed !== false
    };
    maintenance.inspectionRecords.push(record);

    this.homey.log('[Fireplace] Chimney sweep recorded for ' + fireplaceId);
    this.homey.emit('fireplace-sweep-completed', { fireplaceId, record });
    return { success: true, record };
  }

  // --- Burn Ban (Eldningsförbud) ---

  _checkBurnBanStatus() {
    // In production, this would check SMHI or municipality data
    this.homey.log('[Fireplace] Checking burn ban status for ' + this.regulations.eldningsförbudRegion);

    if (this.regulations.eldningsförbud) {
      // Shut down wood-burning fireplaces if burn ban is active
      for (const [id, fp] of Object.entries(this.fireplaces)) {
        if (fp.type === 'wood' && (fp.status === 'running' || fp.status === 'starting')) {
          this.homey.log('[Fireplace] Burn ban active - stopping ' + id);
          this.stopFireplace(id);
        }
      }
    }
  }

  setBurnBanStatus(active) {
    const previousState = this.regulations.eldningsförbud;
    this.regulations.eldningsförbud = active;

    if (active && !previousState) {
      this.homey.log('[Fireplace] Eldningsförbud activated for ' + this.regulations.eldningsförbudRegion);
      this.homey.emit('fireplace-burn-ban-active', { region: this.regulations.eldningsförbudRegion });
      this._checkBurnBanStatus();
    } else if (!active && previousState) {
      this.homey.log('[Fireplace] Eldningsförbud lifted for ' + this.regulations.eldningsförbudRegion);
      this.homey.emit('fireplace-burn-ban-lifted', { region: this.regulations.eldningsförbudRegion });
    }

    return { success: true, burnBan: active };
  }

  // --- Seasonal Operation ---

  _determineHeatingSeason() {
    const month = new Date().getMonth() + 1;
    const { heatingSeasonStart, heatingSeasonEnd } = this.seasonalConfig;

    this.seasonalConfig.isHeatingSeason = (month >= heatingSeasonStart || month <= heatingSeasonEnd);
    this.homey.log('[Fireplace] Heating season: ' + (this.seasonalConfig.isHeatingSeason ? 'YES' : 'NO') + ' (month: ' + month + ')');
  }

  _checkStartupChecklist() {
    if (!this.seasonalConfig.isHeatingSeason) return;
    if (this.seasonalConfig.startupChecklistDone) return;

    const checklist = this.seasonalConfig.startupChecklist;
    const allDone = Object.values(checklist).every(v => v === true);

    if (!allDone) {
      const pending = Object.entries(checklist).filter(([k, v]) => !v).map(([k]) => k);
      this.homey.log('[Fireplace] Startup checklist incomplete. Pending: ' + pending.join(', '));
      this.homey.emit('fireplace-startup-checklist-pending', { pending });
    } else {
      this.seasonalConfig.startupChecklistDone = true;
      this.homey.log('[Fireplace] Startup checklist complete');
    }
  }

  updateStartupChecklist(item, done) {
    if (!(item in this.seasonalConfig.startupChecklist)) {
      return { success: false, reason: 'unknown_checklist_item' };
    }
    this.seasonalConfig.startupChecklist[item] = done;
    this._checkStartupChecklist();
    return { success: true, item, done, checklist: this.seasonalConfig.startupChecklist };
  }

  performSummerShutdown() {
    this.homey.log('[Fireplace] Performing summer shutdown procedure');

    for (const [id, fp] of Object.entries(this.fireplaces)) {
      if (fp.status !== 'off') {
        this.stopFireplace(id);
      }
      fp.damperPosition = 0;
    }

    this.seasonalConfig.summerShutdownComplete = true;
    this.seasonalConfig.startupChecklistDone = false;
    Object.keys(this.seasonalConfig.startupChecklist).forEach(k => {
      this.seasonalConfig.startupChecklist[k] = false;
    });

    this.homey.emit('fireplace-summer-shutdown', { timestamp: new Date().toISOString() });
    return { success: true, message: 'Summer shutdown complete' };
  }

  getAnnualMaintenanceCalendar() {
    return {
      january: 'Peak heating season - monitor fuel levels weekly',
      february: 'Peak heating season - check creosote buildup',
      march: 'Late heating season - plan wood orders for next year',
      april: 'Heating season ends - final burns, begin spring cleaning',
      may: 'Summer shutdown - clean ash, inspect gaskets, close dampers',
      june: 'Schedule chimney sweep (sotning)',
      july: 'Wood procurement - order and stack for next season',
      august: 'Wood splitting and stacking, ensure proper seasoning',
      september: 'Startup checklist - inspect, test CO detectors, stock fuel',
      october: 'Heating season begins - first fires, verify draft',
      november: 'Full operation - establish regular burning schedule',
      december: 'Peak season - festive fires, monitor wood consumption'
    };
  }

  // --- Fireplace Scenes ---

  async activateScene(sceneName) {
    const scene = this.scenes[sceneName];
    if (!scene) {
      this.homey.error('[Fireplace] Unknown scene: ' + sceneName);
      return { success: false, reason: 'unknown_scene' };
    }

    this.homey.log('[Fireplace] Activating scene: ' + sceneName);

    if (sceneName === 'sauna-session') {
      return await this._activateSaunaScene(scene);
    }

    // Find suitable fireplace for scene
    const suitableFp = Object.entries(this.fireplaces).find(([id, fp]) => {
      return fp.location !== 'sauna' && fp.location !== 'patio';
    });

    if (!suitableFp) {
      return { success: false, reason: 'no_suitable_fireplace' };
    }

    const [fpId, fp] = suitableFp;

    if (fp.status === 'off') {
      await this.startFireplace(fpId);
    }

    // Apply scene settings
    if (fp.type === 'gas' && scene.flameLevel !== undefined) {
      fp.flameHeight = scene.flameLevel;
    }
    if (scene.fanSpeed !== undefined) {
      fp.fanSpeed = scene.fanSpeed;
    }

    this.activeScene = sceneName;

    // Emit ambiance events for other systems
    this.homey.emit('fireplace-scene-activated', {
      scene: sceneName,
      fireplaceId: fpId,
      lightsLevel: scene.lightsLevel,
      musicEnabled: scene.musicEnabled,
      soundscape: scene.soundscape
    });

    this.homey.log('[Fireplace] Scene ' + sceneName + ' activated on ' + fpId);
    return { success: true, scene: sceneName, fireplaceId: fpId };
  }

  async _activateSaunaScene(sceneConfig) {
    const saunaFp = this.fireplaces['sauna-wood'];
    if (!saunaFp) return { success: false, reason: 'no_sauna_fireplace' };

    this.homey.log('[Fireplace] Starting sauna session - preheat target: ' + sceneConfig.preheatTarget + '°C');

    if (saunaFp.status === 'off') {
      await this.startFireplace('sauna-wood', { targetTemp: sceneConfig.preheatTarget });
    }

    saunaFp.targetTemp = sceneConfig.preheatTarget;
    this.activeScene = 'sauna-session';

    // Set timer for session
    const sessionTimer = setTimeout(() => {
      this.homey.log('[Fireplace] Sauna session timer expired - beginning cooldown');
      this.stopFireplace('sauna-wood');
      this.activeScene = null;
      this.homey.emit('fireplace-sauna-session-ended', { duration: sceneConfig.timerMinutes });
    }, sceneConfig.timerMinutes * 60000);

    this.intervals.push(sessionTimer);

    this.homey.emit('fireplace-sauna-session-started', {
      target: sceneConfig.preheatTarget,
      timerMinutes: sceneConfig.timerMinutes
    });

    return { success: true, scene: 'sauna-session', target: sceneConfig.preheatTarget, timerMinutes: sceneConfig.timerMinutes };
  }

  deactivateScene() {
    if (!this.activeScene) return { success: false, reason: 'no_active_scene' };

    const previousScene = this.activeScene;
    this.activeScene = null;
    this.homey.log('[Fireplace] Scene deactivated: ' + previousScene);
    this.homey.emit('fireplace-scene-deactivated', { scene: previousScene });
    return { success: true, deactivatedScene: previousScene };
  }

  // --- Emission Tracking ---

  _trackEmissions() {
    const now = new Date();
    const monthKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

    for (const [id, fp] of Object.entries(this.fireplaces)) {
      if (fp.status !== 'running') continue;

      const hours = 5 / 60; // 5-minute interval
      let co2 = 0;
      let pm = 0;
      let nox = 0;

      if (fp.type === 'wood') {
        const fuelKg = 3.5 * hours;
        co2 = fuelKg * 0.39;
        pm = fuelKg * 4.5;
        nox = fuelKg * 1.2;
      } else if (fp.type === 'pellet') {
        const fuelKg = this.fuelInventory.pellets.consumptionRateKgHr * hours;
        co2 = 0; // carbon neutral
        pm = fuelKg * 0.3;
        nox = fuelKg * 0.8;
      } else if (fp.type === 'gas') {
        const fuelL = this.fuelInventory.gas.consumptionRateLHr * hours;
        co2 = fuelL * 2.75;
        pm = fuelL * 0.01;
        nox = fuelL * 0.5;
      }

      this.emissions.totalCO2kg += co2;
      this.emissions.totalPMg += pm;
      this.emissions.totalNOxg += nox;

      if (!this.emissions.monthlyTotals[monthKey]) {
        this.emissions.monthlyTotals[monthKey] = { co2kg: 0, pmG: 0, noxG: 0 };
      }
      this.emissions.monthlyTotals[monthKey].co2kg += co2;
      this.emissions.monthlyTotals[monthKey].pmG += pm;
      this.emissions.monthlyTotals[monthKey].noxG += nox;
    }
  }

  getEmissionReport() {
    return {
      totalCO2kg: Math.round(this.emissions.totalCO2kg * 100) / 100,
      totalParticulateMatterG: Math.round(this.emissions.totalPMg * 100) / 100,
      totalNOxG: Math.round(this.emissions.totalNOxg * 100) / 100,
      monthlyBreakdown: this.emissions.monthlyTotals,
      sessionHistory: this.emissions.sessionEmissions.slice(-20),
      complianceStatus: this.regulations.emissionStandardMet
    };
  }

  // --- Wood Procurement ---

  orderWood(supplierIndex, quantity_m3, woodType) {
    if (supplierIndex < 0 || supplierIndex >= this.woodProcurement.suppliers.length) {
      return { success: false, reason: 'invalid_supplier' };
    }

    const supplier = this.woodProcurement.suppliers[supplierIndex];
    const costSEK = supplier.pricePerM3 * quantity_m3;

    const order = {
      id: 'order-' + Date.now(),
      supplier: supplier.name,
      woodType: woodType || supplier.woodType,
      quantity_m3,
      costSEK,
      orderDate: new Date().toISOString(),
      deliveryDate: null,
      status: 'pending',
      delivered: false
    };

    this.woodProcurement.pendingOrders.push(order);
    this.woodProcurement.totalSpentSEK += costSEK;

    this.homey.log('[Fireplace] Wood ordered: ' + quantity_m3 + ' m³ ' + (woodType || 'mixed') + ' from ' + supplier.name + ' (' + costSEK + ' SEK)');
    this.homey.emit('fireplace-wood-ordered', order);

    return { success: true, order };
  }

  confirmWoodDelivery(orderId) {
    const order = this.woodProcurement.pendingOrders.find(o => o.id === orderId);
    if (!order) return { success: false, reason: 'order_not_found' };

    order.status = 'delivered';
    order.delivered = true;
    order.deliveryDate = new Date().toISOString();

    // Add to wood inventory as green wood
    const woodType = order.woodType === 'mixed' ? 'birch' : order.woodType;
    if (this.fuelInventory.wood[woodType]) {
      this.fuelInventory.wood[woodType].quantity_m3 += order.quantity_m3;
    }

    // Move to order history
    this.woodProcurement.pendingOrders = this.woodProcurement.pendingOrders.filter(o => o.id !== orderId);
    this.woodProcurement.orderHistory.push(order);

    this.homey.log('[Fireplace] Wood delivery confirmed: ' + orderId);
    this.homey.emit('fireplace-wood-delivered', order);
    return { success: true, order };
  }

  getWoodProcurementReport() {
    const month = new Date().getMonth() + 1;
    const isOptimalOrderTime = (month >= 3 && month <= 5);

    return {
      suppliers: this.woodProcurement.suppliers,
      pendingOrders: this.woodProcurement.pendingOrders,
      recentOrders: this.woodProcurement.orderHistory.slice(-10),
      totalSpentSEK: this.woodProcurement.totalSpentSEK,
      isOptimalOrderTime,
      recommendation: isOptimalOrderTime
        ? 'Spring is the best time to order wood for next winter season'
        : 'Consider ordering in spring (Mar-May) for best prices and seasoning time',
      currentInventory: this.fuelInventory.wood
    };
  }

  // --- Ambiance Control ---

  setFlameHeight(fireplaceId, height) {
    const fp = this.fireplaces[fireplaceId];
    if (!fp) return { success: false, reason: 'unknown_fireplace' };
    if (fp.type !== 'gas') return { success: false, reason: 'not_gas_fireplace' };
    if (fp.status !== 'running') return { success: false, reason: 'not_running' };

    fp.flameHeight = Math.max(0, Math.min(100, height));
    this.homey.log('[Fireplace] Flame height set to ' + fp.flameHeight + '% on ' + fireplaceId);
    this.homey.emit('fireplace-flame-adjusted', { fireplaceId, height: fp.flameHeight });
    return { success: true, flameHeight: fp.flameHeight };
  }

  setFanSpeed(fireplaceId, speed) {
    const fp = this.fireplaces[fireplaceId];
    if (!fp) return { success: false, reason: 'unknown_fireplace' };
    if (fp.status !== 'running') return { success: false, reason: 'not_running' };

    fp.fanSpeed = Math.max(0, Math.min(100, speed));
    this.homey.log('[Fireplace] Fan speed set to ' + fp.fanSpeed + '% on ' + fireplaceId);
    return { success: true, fanSpeed: fp.fanSpeed };
  }

  setDamperPosition(fireplaceId, position) {
    const fp = this.fireplaces[fireplaceId];
    if (!fp) return { success: false, reason: 'unknown_fireplace' };

    fp.damperPosition = Math.max(0, Math.min(100, position));
    this.homey.log('[Fireplace] Damper position set to ' + fp.damperPosition + '% on ' + fireplaceId);
    return { success: true, damperPosition: fp.damperPosition };
  }

  toggleChildLock(fireplaceId, engaged) {
    const fp = this.fireplaces[fireplaceId];
    if (!fp) return { success: false, reason: 'unknown_fireplace' };

    fp.childLockEngaged = engaged;
    this.homey.log('[Fireplace] Child lock ' + (engaged ? 'engaged' : 'disengaged') + ' on ' + fireplaceId);
    this.homey.emit('fireplace-child-lock', { fireplaceId, engaged });
    return { success: true, childLockEngaged: engaged };
  }

  // --- Weather Context ---

  updateWeatherContext(data) {
    if (data.outdoorTemp !== undefined) this.weatherContext.outdoorTemp = data.outdoorTemp;
    if (data.indoorTemp !== undefined) this.weatherContext.indoorTemp = data.indoorTemp;
    if (data.windSpeed !== undefined) this.weatherContext.windSpeed = data.windSpeed;
    if (data.windDirection !== undefined) this.weatherContext.windDirection = data.windDirection;
    if (data.humidity !== undefined) this.weatherContext.humidity = data.humidity;

    this.homey.log('[Fireplace] Weather updated: outdoor=' + this.weatherContext.outdoorTemp + '°C, wind=' + this.weatherContext.windSpeed + 'm/s');
  }

  updateAirQuality(data) {
    if (data.indoorCO2 !== undefined) this.airQuality.indoorCO2 = data.indoorCO2;
    if (data.indoorPM25 !== undefined) this.airQuality.indoorPM25 = data.indoorPM25;
    if (data.outdoorPM25 !== undefined) this.airQuality.outdoorPM25 = data.outdoorPM25;
  }

  // --- Utility / Internal ---

  _updateWoodStorageStatus() {
    let totalSeasoned = 0;
    let totalGreen = 0;

    for (const [type, stock] of Object.entries(this.fuelInventory.wood)) {
      if (stock.status === 'seasoned') {
        totalSeasoned += stock.quantity_m3;
      } else {
        totalGreen += stock.quantity_m3;
      }
    }

    this.woodStorage.seasoned_m3 = totalSeasoned;
    this.woodStorage.green_m3 = totalGreen;
    this.woodStorage.lastInventoryCheck = new Date().toISOString();
    this.homey.log('[Fireplace] Wood storage: ' + totalSeasoned + ' m³ seasoned, ' + totalGreen + ' m³ green');
  }

  _loadSessionHistory() {
    // In production would load from persistent storage
    this.homey.log('[Fireplace] Session history loaded: ' + this.sessionHistory.length + ' records');
  }

  updateFireplaceReading(fireplaceId, readings) {
    const fp = this.fireplaces[fireplaceId];
    if (!fp) return { success: false, reason: 'unknown_fireplace' };

    if (readings.currentTemp !== undefined) fp.currentTemp = readings.currentTemp;
    if (readings.flueTemp !== undefined) fp.flueTemp = readings.flueTemp;
    if (readings.carbonMonoxidePPM !== undefined) fp.carbonMonoxidePPM = readings.carbonMonoxidePPM;
    if (readings.oxygenLevel !== undefined) fp.oxygenLevel = readings.oxygenLevel;
    if (readings.glassTemp !== undefined) fp.glassTemp = readings.glassTemp;

    // Update peak temp in active session
    const session = this.activeSessions[fireplaceId];
    if (session && fp.currentTemp !== null && fp.currentTemp > session.peakTemp) {
      session.peakTemp = fp.currentTemp;
    }

    return { success: true };
  }

  recordCleaning(fireplaceId) {
    const fp = this.fireplaces[fireplaceId];
    if (!fp) return { success: false, reason: 'unknown_fireplace' };

    fp.lastCleaned = new Date().toISOString();
    fp.ashLevel = 0;
    this.homey.log('[Fireplace] Cleaning recorded for ' + fireplaceId);
    this.homey.emit('fireplace-cleaned', { fireplaceId, date: fp.lastCleaned });
    return { success: true, lastCleaned: fp.lastCleaned };
  }

  // --- Optimal Loading Instructions ---

  getLoadingInstructions(fireplaceId) {
    const fp = this.fireplaces[fireplaceId];
    if (!fp) return { success: false, reason: 'unknown_fireplace' };

    if (fp.type === 'wood') {
      return {
        success: true,
        instructions: {
          step1: 'Ensure damper is fully open before loading',
          step2: 'Place crumpled newspaper or natural firelighters at base',
          step3: 'Stack 2-3 medium birch logs in a criss-cross pattern',
          step4: 'Add kindling on top (top-down burning method)',
          step5: 'Light from the top for cleaner combustion',
          step6: 'Keep door slightly open for 5 minutes until fire establishes',
          step7: 'Close door and adjust damper to 60-70% after 15 minutes',
          step8: 'Add logs every 45-60 minutes, do not overload',
          tips: [
            'Use seasoned wood only (moisture <20%)',
            'Birch provides best heat output for Nordic homes',
            'Never burn treated or painted wood',
            'Clean glass with damp newspaper and ash'
          ],
          optimalLoad: '2-3 logs of 30cm length, 8-12cm diameter'
        }
      };
    } else if (fp.type === 'pellet') {
      return {
        success: true,
        instructions: {
          step1: 'Ensure hopper is filled above 20%',
          step2: 'Set desired temperature on control panel',
          step3: 'Auto-ignition will start the pellet feed',
          step4: 'Adjust fan speed for desired heat distribution',
          tips: [
            'Use only approved pellet brands',
            'Keep pellets dry - moisture ruins combustion',
            'Clean ash pan weekly during heavy use'
          ]
        }
      };
    } else if (fp.type === 'gas') {
      return {
        success: true,
        instructions: {
          step1: 'Verify gas supply valve is open',
          step2: 'Check pilot light status',
          step3: 'Use remote or control to ignite',
          step4: 'Adjust flame height to desired level',
          tips: [
            'Annual gas line inspection required',
            'Check for gas odor before ignition',
            'Ensure adequate ventilation for outdoor unit'
          ]
        }
      };
    }

    return { success: false, reason: 'unsupported_type' };
  }

  // --- Statistics & Status ---

  getFireplaceStatus(fireplaceId) {
    const fp = this.fireplaces[fireplaceId];
    if (!fp) return null;

    return {
      ...fp,
      activeSession: this.activeSessions[fireplaceId] || null,
      chimney: this.chimneyMaintenance[fireplaceId] || null,
      fuelStatus: this._getFuelStatusForFireplace(fireplaceId)
    };
  }

  _getFuelStatusForFireplace(fireplaceId) {
    const fp = this.fireplaces[fireplaceId];
    if (!fp) return null;

    if (fp.type === 'wood') {
      return {
        woodInventory: this.fuelInventory.wood,
        totalAvailable_m3: Object.values(this.fuelInventory.wood).reduce((sum, w) => sum + w.quantity_m3, 0)
      };
    } else if (fp.type === 'pellet') {
      return {
        hopperLevel: this.fuelInventory.pellets.autoFeedLevel,
        bagsRemaining: this.fuelInventory.pellets.bagCount,
        currentHopperKg: this.fuelInventory.pellets.currentHopperKg
      };
    } else if (fp.type === 'gas') {
      return {
        tankLevel: this.fuelInventory.gas.tankLevel,
        estimatedHoursRemaining: Math.round((this.fuelInventory.gas.tankCapacityL * (this.fuelInventory.gas.tankLevel / 100)) / this.fuelInventory.gas.consumptionRateLHr)
      };
    }
    return null;
  }

  getAllFireplaceStatuses() {
    const statuses = {};
    for (const id of Object.keys(this.fireplaces)) {
      statuses[id] = this.getFireplaceStatus(id);
    }
    return statuses;
  }

  getStatistics() {
    const activeCount = Object.values(this.fireplaces).filter(fp => fp.status === 'running' || fp.status === 'starting').length;
    const totalBurnHours = Object.values(this.fireplaces).reduce((sum, fp) => sum + fp.totalBurnHours, 0);

    return {
      initialized: this.initialized,
      fireplaceCount: Object.keys(this.fireplaces).length,
      activeFireplaces: activeCount,
      totalBurnHoursAllTime: Math.round(totalBurnHours * 100) / 100,
      sessionsRecorded: this.sessionHistory.length,
      activeScene: this.activeScene,
      isHeatingSeason: this.seasonalConfig.isHeatingSeason,
      burnBanActive: this.regulations.eldningsförbud,
      fuelInventory: {
        woodTotal_m3: Object.values(this.fuelInventory.wood).reduce((s, w) => s + w.quantity_m3, 0),
        pelletBags: this.fuelInventory.pellets.bagCount,
        gasLevel: this.fuelInventory.gas.tankLevel
      },
      energySeason: {
        totalKwh: Math.round(this.energyContribution.totalKwhThisSeason * 100) / 100,
        savingsSEK: this.energyContribution.costSavingsSEK
      },
      emissions: {
        totalCO2kg: Math.round(this.emissions.totalCO2kg * 100) / 100,
        totalPMg: Math.round(this.emissions.totalPMg * 100) / 100
      },
      airQuality: {
        indoorCO2: this.airQuality.indoorCO2,
        smokeSpillage: this.airQuality.smokeSpillageDetected
      },
      safetyStatus: this._getSafetyOverview(),
      monitoringIntervals: this.intervals.length
    };
  }

  _getSafetyOverview() {
    const issues = [];

    for (const [id, fp] of Object.entries(this.fireplaces)) {
      if (fp.carbonMonoxidePPM > this.safetyThresholds.coWarningPPM) {
        issues.push({ fireplaceId: id, issue: 'elevated_co', value: fp.carbonMonoxidePPM });
      }
      if (fp.glassTemp > this.safetyThresholds.maxGlassTempC) {
        issues.push({ fireplaceId: id, issue: 'hot_glass', value: fp.glassTemp });
      }
      if (fp.oxygenLevel < this.safetyThresholds.minOxygenPercent) {
        issues.push({ fireplaceId: id, issue: 'low_oxygen', value: fp.oxygenLevel });
      }
      if (fp.status === 'error') {
        issues.push({ fireplaceId: id, issue: 'error_state' });
      }
    }

    for (const [id, maint] of Object.entries(this.chimneyMaintenance)) {
      if (maint.creosoteBuildupMm > 3) {
        issues.push({ fireplaceId: id, issue: 'creosote_buildup', value: maint.creosoteBuildupMm });
      }
    }

    return {
      safe: issues.length === 0,
      issueCount: issues.length,
      issues
    };
  }

  getRegulationsStatus() {
    return {
      burnBan: this.regulations.eldningsförbud,
      region: this.regulations.eldningsförbudRegion,
      environmentalZone: this.regulations.environmentalZone,
      emissionStandardMet: this.regulations.emissionStandardMet,
      insuranceValid: this.regulations.insuranceValid,
      insuranceExpiry: this.regulations.insuranceExpiry,
      approvedAppliances: this.regulations.approvedAppliances,
      lastInspection: this.regulations.lastInspectionDate,
      nextSweepDates: Object.fromEntries(
        Object.entries(this.chimneyMaintenance).map(([id, m]) => [id, m.nextSweepDue])
      )
    };
  }

  // --- Destroy ---

  destroy() {
    for (const i of this.intervals) {
      clearInterval(i);
      clearTimeout(i);
    }
    this.intervals = [];

    // End all active sessions
    for (const id of Object.keys(this.activeSessions)) {
      this._endBurnSession(id);
    }

    this.initialized = false;
    this.homey.log('[Fireplace] Smart Fireplace Management System destroyed');
  }
}

module.exports = SmartFireplaceManagementSystem;
