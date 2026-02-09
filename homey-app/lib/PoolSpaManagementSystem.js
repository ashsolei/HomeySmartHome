'use strict';

/**
 * PoolSpaManagementSystem
 * Comprehensive pool, spa & water feature management
 * Supports multi-pool, chemistry, auto-dosing, solar heating,
 * freeze protection, salt chlorinator, cover, lighting, and more.
 */
class PoolSpaManagementSystem {
  constructor(homey) {
    this.homey = homey;

    // ── Water Bodies (up to 4) ──────────────────────────────────────────
    this.waterBodies = new Map();
    this.maxWaterBodies = 4;
    this.waterBodyTemplates = {
      main_pool: {
        label: 'Main Pool',
        defaultVolumeLiters: 75000,
        defaultTempTarget: 28,
        minTemp: 15,
        maxTemp: 35,
        hasCover: true,
        hasLighting: true,
        hasJets: false
      },
      children_pool: {
        label: "Children's Pool",
        defaultVolumeLiters: 15000,
        defaultTempTarget: 30,
        minTemp: 20,
        maxTemp: 34,
        hasCover: true,
        hasLighting: true,
        hasJets: false
      },
      hot_tub: {
        label: 'Hot Tub / Spa',
        defaultVolumeLiters: 2000,
        defaultTempTarget: 38,
        minTemp: 30,
        maxTemp: 42,
        hasCover: true,
        hasLighting: true,
        hasJets: true
      },
      infinity_edge: {
        label: 'Infinity Edge Pool',
        defaultVolumeLiters: 50000,
        defaultTempTarget: 27,
        minTemp: 15,
        maxTemp: 35,
        hasCover: false,
        hasLighting: true,
        hasJets: false
      }
    };

    // ── Chemistry Targets & Ranges ──────────────────────────────────────
    this.chemistryParams = {
      ph: { min: 6.8, max: 7.8, targetLow: 7.2, targetHigh: 7.4, unit: '' },
      freeChlorine: { min: 1.0, max: 5.0, targetLow: 2.0, targetHigh: 3.0, unit: 'ppm' },
      combinedChlorine: { min: 0, max: 0.5, targetLow: 0, targetHigh: 0.2, unit: 'ppm' },
      totalAlkalinity: { min: 80, max: 120, targetLow: 90, targetHigh: 110, unit: 'ppm' },
      calciumHardness: { min: 200, max: 400, targetLow: 250, targetHigh: 350, unit: 'ppm' },
      cyanuricAcid: { min: 30, max: 60, targetLow: 40, targetHigh: 50, unit: 'ppm' },
      tds: { min: 0, max: 3000, targetLow: 500, targetHigh: 2000, unit: 'ppm' },
      saltLevel: { min: 2500, max: 3500, targetLow: 2800, targetHigh: 3200, unit: 'ppm' }
    };

    // ── Auto-Dosing Config ──────────────────────────────────────────────
    this.dosingConfig = {
      chlorine: {
        pumpId: null,
        mlPerPpmPer1000L: 14.3,
        minIntervalMinutes: 60,
        maxDoseMl: 500,
        lastDoseTime: null,
        totalDosedMl: 0,
        enabled: false
      },
      acid: {
        pumpId: null,
        mlPerPhPointPer1000L: 25.0,
        minIntervalMinutes: 30,
        maxDoseMl: 250,
        lastDoseTime: null,
        totalDosedMl: 0,
        enabled: false
      },
      alkalinityIncreaser: {
        pumpId: null,
        gramsPerPpmPer1000L: 1.8,
        minIntervalMinutes: 120,
        maxDoseGrams: 1000,
        lastDoseTime: null,
        totalDosedGrams: 0,
        enabled: false
      }
    };

    // ── Variable Speed Pump ─────────────────────────────────────────────
    this.pumpSpeeds = {
      low: { rpm: 1000, watts: 250, label: 'Low' },
      eco: { rpm: 1800, watts: 500, label: 'Eco' },
      normal: { rpm: 2400, watts: 1100, label: 'Normal' },
      high: { rpm: 3200, watts: 2200, label: 'High' }
    };
    this.pumpState = {
      running: false,
      currentSpeed: 'normal',
      scheduledSpeeds: [],
      totalRunHours: 0,
      dailyRunHours: 0,
      energyCostPerKwh: 0.12,
      dailyEnergyCost: 0,
      monthlyEnergyCost: 0,
      lastStartTime: null,
      priming: false
    };

    // ── Solar Heating ───────────────────────────────────────────────────
    this.solarHeating = {
      enabled: false,
      panelTemperature: 0,
      roofSensorTemperature: 0,
      differentialOnThreshold: 5,
      differentialOffThreshold: 2,
      solarPumpRunning: false,
      dailySolarHours: 0,
      totalSolarHours: 0,
      auxiliaryHeaterEnabled: false,
      auxiliaryHeaterRunning: false,
      auxiliaryHeaterType: 'gas',
      auxiliaryHeaterBtu: 400000,
      lastSolarCheckTime: null
    };

    // ── Freeze Protection ───────────────────────────────────────────────
    this.freezeProtection = {
      enabled: true,
      activationTempC: 3,
      airTemperature: null,
      pipeSensorTemperature: null,
      isActive: false,
      heaterLowFire: false,
      autoDrainEquipmentPad: false,
      activationCount: 0,
      lastActivation: null
    };

    // ── Salt Chlorinator ────────────────────────────────────────────────
    this.saltChlorinator = {
      enabled: false,
      outputPercentage: 50,
      cellRunHours: 0,
      cellCleaningIntervalHours: 500,
      cellMaxLifeHours: 10000,
      lastCleaningTime: null,
      reversePolarityIntervalHours: 4,
      lastPolarityReversal: null,
      cellCondition: 'good',
      isGenerating: false,
      currentSaltLevel: 3000
    };

    // ── Cover Management ────────────────────────────────────────────────
    this.coverState = {
      isOpen: false,
      autoMode: true,
      sunriseOffsetMinutes: 60,
      closeAtSunset: true,
      heatRetentionMode: true,
      heatRetentionDiffC: 2,
      rainDetectionClose: true,
      safetyLockChildren: false,
      lastOpenTime: null,
      lastCloseTime: null,
      motorStatus: 'idle',
      coverType: 'automatic'
    };

    // ── Lighting ────────────────────────────────────────────────────────
    this.lightingPresets = {
      white: { r: 255, g: 255, b: 255, label: 'White' },
      blue: { r: 0, g: 50, b: 255, label: 'Blue' },
      cyan: { r: 0, g: 220, b: 255, label: 'Cyan' },
      green: { r: 0, g: 255, b: 80, label: 'Green' },
      red: { r: 255, g: 30, b: 30, label: 'Red' },
      magenta: { r: 255, g: 0, b: 200, label: 'Magenta' },
      yellow: { r: 255, g: 220, b: 0, label: 'Yellow' },
      rainbow_cycle: { r: -1, g: -1, b: -1, label: 'Rainbow Cycle' }
    };
    this.lightingZones = {
      underwater: { on: false, brightness: 100, preset: 'blue' },
      perimeter: { on: false, brightness: 80, preset: 'white' },
      landscape: { on: false, brightness: 60, preset: 'white' }
    };
    this.lightingCyclePosition = 0;

    // ── Water Level ─────────────────────────────────────────────────────
    this.waterLevel = {
      currentLevelCm: 0,
      targetLevelCm: 15,
      floatSensorActive: false,
      autoFillValveOpen: false,
      evaporationRateLitersPerDay: 0,
      evaporationHistory: [],
      leakDetectionThresholdCmPerDay: 5,
      leakAlertActive: false,
      overflowPreventionEnabled: true,
      overflowLevelCm: 20,
      lastFillStartTime: null,
      totalFillLiters: 0
    };

    // ── Filtration ──────────────────────────────────────────────────────
    this.filtration = {
      filterType: 'cartridge',
      cleanPressurePsi: 10,
      dirtyPressurePsi: 25,
      currentPressurePsi: 10,
      backwashReminder: false,
      filterAgeDays: 0,
      filterInstallDate: null,
      replacementIntervalDays: 365,
      totalFilteredGallons: 0,
      lastBackwashDate: null
    };

    // ── Maintenance Calendar ────────────────────────────────────────────
    this.maintenanceSchedule = {
      daily: {
        tasks: [
          { id: 'skim', label: 'Skim surface debris', completedToday: false },
          { id: 'test_chemistry', label: 'Test water chemistry', completedToday: false }
        ]
      },
      weekly: {
        tasks: [
          { id: 'brush_walls', label: 'Brush pool walls and floor', completedThisWeek: false },
          { id: 'vacuum', label: 'Vacuum pool', completedThisWeek: false },
          { id: 'clean_skimmer', label: 'Clean skimmer basket', completedThisWeek: false }
        ]
      },
      monthly: {
        tasks: [
          { id: 'check_equipment', label: 'Inspect all equipment', completedThisMonth: false },
          { id: 'clean_salt_cell', label: 'Clean salt chlorinator cell', completedThisMonth: false }
        ]
      },
      seasonal: {
        tasks: [
          { id: 'winterize', label: 'Winterization procedure', completedThisSeason: false },
          { id: 'spring_open', label: 'Spring opening procedure', completedThisSeason: false }
        ]
      }
    };
    this.maintenanceHistory = [];

    // ── Energy Monitoring ───────────────────────────────────────────────
    this.energyMonitoring = {
      pumpKwhToday: 0,
      pumpKwhMonth: 0,
      heaterUsageToday: 0,
      heaterUsageMonth: 0,
      totalCostToday: 0,
      totalCostMonth: 0,
      previousMonthCost: 0,
      costHistory: [],
      recommendations: []
    };

    // ── Weather Integration ─────────────────────────────────────────────
    this.weather = {
      currentTemp: null,
      uvIndex: 0,
      isRaining: false,
      stormWarning: false,
      rainExpected: false,
      windSpeedKmh: 0,
      lastUpdate: null,
      preRainChemistryAdjusted: false,
      postRainChemistryAdjusted: false
    };

    // ── Spa Jets ────────────────────────────────────────────────────────
    this.spaJets = {
      running: false,
      intensity: 'medium',
      intensityLevels: { low: 30, medium: 60, high: 100 },
      timerMinutes: 30,
      timerOptions: [15, 30, 45, 60],
      autoOffTime: null,
      aromatherapyEnabled: false,
      aromatherapyScent: 'eucalyptus',
      aromatherapyScents: ['eucalyptus', 'lavender', 'peppermint', 'chamomile', 'citrus'],
      hydrotherapySequences: {
        relax: [
          { intensity: 'low', durationSec: 120 },
          { intensity: 'medium', durationSec: 60 },
          { intensity: 'low', durationSec: 120 }
        ],
        invigorate: [
          { intensity: 'high', durationSec: 60 },
          { intensity: 'low', durationSec: 30 },
          { intensity: 'high', durationSec: 60 },
          { intensity: 'medium', durationSec: 120 }
        ],
        massage: [
          { intensity: 'medium', durationSec: 90 },
          { intensity: 'high', durationSec: 45 },
          { intensity: 'medium', durationSec: 90 },
          { intensity: 'low', durationSec: 60 }
        ]
      },
      activeSequence: null,
      sequenceStepIndex: 0
    };

    // ── Guest / Party Mode ──────────────────────────────────────────────
    this.partyMode = {
      active: false,
      preHeatSpa: true,
      lightingPreset: 'rainbow_cycle',
      extendedPumpRun: true,
      disableAutoCoverClose: true,
      autoReturnMinutes: 240,
      activationTime: null,
      returnToNormalTime: null,
      savedSettings: null
    };

    // ── Monitoring ──────────────────────────────────────────────────────
    this.monitoringIntervalMs = 3 * 60 * 1000; // 3 minutes
    this.monitoringTimer = null;

    // ── History (30-day) ────────────────────────────────────────────────
    this.historyRetentionDays = 30;
    this.chemistryHistory = [];
    this.pumpRunHistory = [];
    this.heatingHistory = [];
    this.costHistory = [];

    // ── General ─────────────────────────────────────────────────────────
    this.initialized = false;
    this.lastMonitoringCycle = null;
  }

  // ====================================================================
  //  INITIALIZATION
  // ====================================================================
  async initialize() {
    this.log('Initializing PoolSpaManagementSystem...');
    try {
      this._initializeDefaultWaterBodies();
      this._loadPumpSchedule();
      this._initializeMaintenanceDates();
      this._startMonitoringCycle();
      this.initialized = true;
      this.log('PoolSpaManagementSystem initialized successfully');
    } catch (err) {
      this.error(`Initialization failed: ${err.message}`);
    }
  }

  _initializeDefaultWaterBodies() {
    const mainPool = this._createWaterBody('main_pool', {});
    this.waterBodies.set('main_pool', mainPool);
    const hotTub = this._createWaterBody('hot_tub', {});
    this.waterBodies.set('hot_tub', hotTub);
    this.log(`Initialized ${this.waterBodies.size} water bodies`);
  }

  _createWaterBody(type, overrides) {
    const template = this.waterBodyTemplates[type];
    if (!template) {
      this.error(`Unknown water body type: ${type}`);
      return null;
    }
    return {
      type,
      label: template.label,
      volumeLiters: template.defaultVolumeLiters,
      currentTemperature: 22,
      targetTemperature: template.defaultTempTarget,
      minTemp: template.minTemp,
      maxTemp: template.maxTemp,
      hasCover: template.hasCover,
      hasLighting: template.hasLighting,
      hasJets: template.hasJets,
      chemistry: {
        ph: 7.3,
        freeChlorine: 2.5,
        combinedChlorine: 0.1,
        totalAlkalinity: 100,
        calciumHardness: 300,
        cyanuricAcid: 45,
        tds: 1200,
        saltLevel: 3000
      },
      heatingActive: false,
      filterRunning: false,
      lastChemistryTest: null,
      alerts: [],
      ...overrides
    };
  }

  addWaterBody(type, overrides = {}) {
    if (this.waterBodies.size >= this.maxWaterBodies) {
      this.error(`Cannot add water body: maximum of ${this.maxWaterBodies} reached`);
      return null;
    }
    if (this.waterBodies.has(type)) {
      this.error(`Water body '${type}' already exists`);
      return null;
    }
    const wb = this._createWaterBody(type, overrides);
    if (wb) {
      this.waterBodies.set(type, wb);
      this.log(`Added water body: ${wb.label}`);
    }
    return wb;
  }

  removeWaterBody(type) {
    if (this.waterBodies.delete(type)) {
      this.log(`Removed water body: ${type}`);
      return true;
    }
    return false;
  }

  // ====================================================================
  //  PUMP SCHEDULING
  // ====================================================================
  _loadPumpSchedule() {
    this.pumpState.scheduledSpeeds = [
      { startHour: 0, endHour: 6, speed: 'low' },
      { startHour: 6, endHour: 10, speed: 'eco' },
      { startHour: 10, endHour: 16, speed: 'normal' },
      { startHour: 16, endHour: 20, speed: 'eco' },
      { startHour: 20, endHour: 24, speed: 'low' }
    ];
    this.log('Pump schedule loaded with 5 time blocks');
  }

  setPumpSpeed(speed) {
    if (!this.pumpSpeeds[speed]) {
      this.error(`Invalid pump speed: ${speed}`);
      return false;
    }
    this.pumpState.currentSpeed = speed;
    this.log(`Pump speed set to ${this.pumpSpeeds[speed].label} (${this.pumpSpeeds[speed].rpm} RPM)`);
    return true;
  }

  startPump(speed) {
    if (speed) {
      this.setPumpSpeed(speed);
    }
    if (this.pumpState.running) {
      this.log('Pump is already running');
      return;
    }
    this.pumpState.running = true;
    this.pumpState.lastStartTime = Date.now();
    this.pumpState.priming = true;
    const cfg = this.pumpSpeeds[this.pumpState.currentSpeed];
    this.log(`Pump started at ${cfg.label} speed (${cfg.rpm} RPM, ${cfg.watts}W)`);

    // simulate priming complete after a brief delay
    setTimeout(() => {
      this.pumpState.priming = false;
      this.log('Pump priming complete');
    }, 5000);
  }

  stopPump() {
    if (!this.pumpState.running) return;
    const runMs = Date.now() - (this.pumpState.lastStartTime || Date.now());
    const runHours = runMs / 3600000;
    this.pumpState.totalRunHours += runHours;
    this.pumpState.dailyRunHours += runHours;

    const watts = this.pumpSpeeds[this.pumpState.currentSpeed].watts;
    const kwh = (watts * runHours) / 1000;
    this.energyMonitoring.pumpKwhToday += kwh;
    this.pumpState.dailyEnergyCost += kwh * this.pumpState.energyCostPerKwh;

    this.pumpState.running = false;
    this.pumpState.lastStartTime = null;
    this.log(`Pump stopped. Session: ${runHours.toFixed(2)}h, ${kwh.toFixed(2)} kWh`);
  }

  _getScheduledSpeed() {
    const hour = new Date().getHours();
    for (const block of this.pumpState.scheduledSpeeds) {
      if (hour >= block.startHour && hour < block.endHour) {
        return block.speed;
      }
    }
    return 'eco';
  }

  _adjustPumpSpeedForSchedule() {
    const scheduled = this._getScheduledSpeed();
    if (this.pumpState.currentSpeed !== scheduled && this.pumpState.running) {
      this.setPumpSpeed(scheduled);
    }
  }

  // ====================================================================
  //  CHEMISTRY MANAGEMENT
  // ====================================================================
  updateChemistry(waterBodyType, readings) {
    const wb = this.waterBodies.get(waterBodyType);
    if (!wb) {
      this.error(`Water body not found: ${waterBodyType}`);
      return;
    }
    Object.assign(wb.chemistry, readings);
    wb.lastChemistryTest = Date.now();
    this._checkChemistryAlerts(waterBodyType, wb);
    this._recordChemistryHistory(waterBodyType, wb.chemistry);
    this.log(`Chemistry updated for ${wb.label}`);
  }

  _checkChemistryAlerts(type, wb) {
    wb.alerts = [];
    for (const [param, range] of Object.entries(this.chemistryParams)) {
      const value = wb.chemistry[param];
      if (value === undefined || value === null) continue;
      if (value < range.min) {
        wb.alerts.push({ param, level: 'critical', message: `${param} too low: ${value}${range.unit} (min ${range.min})` });
      } else if (value > range.max) {
        wb.alerts.push({ param, level: 'critical', message: `${param} too high: ${value}${range.unit} (max ${range.max})` });
      } else if (value < range.targetLow) {
        wb.alerts.push({ param, level: 'warning', message: `${param} below target: ${value}${range.unit} (target ${range.targetLow}-${range.targetHigh})` });
      } else if (value > range.targetHigh) {
        wb.alerts.push({ param, level: 'warning', message: `${param} above target: ${value}${range.unit} (target ${range.targetLow}-${range.targetHigh})` });
      }
    }
    if (wb.alerts.length > 0) {
      this.log(`${wb.label}: ${wb.alerts.length} chemistry alert(s)`);
    }
  }

  _recordChemistryHistory(type, chemistry) {
    const entry = {
      timestamp: Date.now(),
      waterBody: type,
      readings: { ...chemistry }
    };
    this.chemistryHistory.push(entry);
    this._pruneHistory(this.chemistryHistory);
  }

  // ====================================================================
  //  AUTO-DOSING
  // ====================================================================
  enableAutoDosing(chemical, pumpId) {
    if (!this.dosingConfig[chemical]) {
      this.error(`Unknown chemical: ${chemical}`);
      return false;
    }
    this.dosingConfig[chemical].enabled = true;
    this.dosingConfig[chemical].pumpId = pumpId || `${chemical}_pump`;
    this.log(`Auto-dosing enabled for ${chemical}`);
    return true;
  }

  disableAutoDosing(chemical) {
    if (this.dosingConfig[chemical]) {
      this.dosingConfig[chemical].enabled = false;
      this.log(`Auto-dosing disabled for ${chemical}`);
    }
  }

  _calculateChlorineDose(waterBodyType) {
    const wb = this.waterBodies.get(waterBodyType);
    if (!wb) return 0;
    const cfg = this.dosingConfig.chlorine;
    if (!cfg.enabled) return 0;
    const current = wb.chemistry.freeChlorine;
    const target = (this.chemistryParams.freeChlorine.targetLow + this.chemistryParams.freeChlorine.targetHigh) / 2;
    if (current >= target) return 0;
    const deficit = target - current;
    const volumeUnits = wb.volumeLiters / 1000;
    const doseMl = deficit * cfg.mlPerPpmPer1000L * volumeUnits;
    return Math.min(doseMl, cfg.maxDoseMl);
  }

  _calculateAcidDose(waterBodyType) {
    const wb = this.waterBodies.get(waterBodyType);
    if (!wb) return 0;
    const cfg = this.dosingConfig.acid;
    if (!cfg.enabled) return 0;
    const current = wb.chemistry.ph;
    const target = (this.chemistryParams.ph.targetLow + this.chemistryParams.ph.targetHigh) / 2;
    if (current <= target) return 0;
    const excess = current - target;
    const volumeUnits = wb.volumeLiters / 1000;
    const doseMl = excess * cfg.mlPerPhPointPer1000L * volumeUnits;
    return Math.min(doseMl, cfg.maxDoseMl);
  }

  _calculateAlkalinityDose(waterBodyType) {
    const wb = this.waterBodies.get(waterBodyType);
    if (!wb) return 0;
    const cfg = this.dosingConfig.alkalinityIncreaser;
    if (!cfg.enabled) return 0;
    const current = wb.chemistry.totalAlkalinity;
    const target = (this.chemistryParams.totalAlkalinity.targetLow + this.chemistryParams.totalAlkalinity.targetHigh) / 2;
    if (current >= target) return 0;
    const deficit = target - current;
    const volumeUnits = wb.volumeLiters / 1000;
    const doseG = deficit * cfg.gramsPerPpmPer1000L * volumeUnits;
    return Math.min(doseG, cfg.maxDoseGrams);
  }

  _canDose(chemical) {
    const cfg = this.dosingConfig[chemical];
    if (!cfg || !cfg.enabled) return false;
    if (!cfg.lastDoseTime) return true;
    const elapsed = (Date.now() - cfg.lastDoseTime) / 60000;
    return elapsed >= cfg.minIntervalMinutes;
  }

  _executeDosing(waterBodyType) {
    if (this._canDose('chlorine')) {
      const dose = this._calculateChlorineDose(waterBodyType);
      if (dose > 0) {
        this.dosingConfig.chlorine.lastDoseTime = Date.now();
        this.dosingConfig.chlorine.totalDosedMl += dose;
        this.log(`Chlorine dose: ${dose.toFixed(1)} ml to ${waterBodyType}`);
      }
    }
    if (this._canDose('acid')) {
      const dose = this._calculateAcidDose(waterBodyType);
      if (dose > 0) {
        this.dosingConfig.acid.lastDoseTime = Date.now();
        this.dosingConfig.acid.totalDosedMl += dose;
        this.log(`Acid dose: ${dose.toFixed(1)} ml to ${waterBodyType}`);
      }
    }
    if (this._canDose('alkalinityIncreaser')) {
      const dose = this._calculateAlkalinityDose(waterBodyType);
      if (dose > 0) {
        this.dosingConfig.alkalinityIncreaser.lastDoseTime = Date.now();
        this.dosingConfig.alkalinityIncreaser.totalDosedGrams += dose;
        this.log(`Alkalinity increaser dose: ${dose.toFixed(1)} g to ${waterBodyType}`);
      }
    }
  }

  // ====================================================================
  //  SOLAR HEATING
  // ====================================================================
  updateSolarReadings(panelTemp, roofTemp) {
    this.solarHeating.panelTemperature = panelTemp;
    this.solarHeating.roofSensorTemperature = roofTemp;
    this.solarHeating.lastSolarCheckTime = Date.now();
  }

  _evaluateSolarHeating() {
    if (!this.solarHeating.enabled) return;

    const mainPool = this.waterBodies.get('main_pool');
    if (!mainPool) return;

    const poolTemp = mainPool.currentTemperature;
    const panelTemp = this.solarHeating.panelTemperature;
    const diff = panelTemp - poolTemp;

    if (!this.solarHeating.solarPumpRunning && diff >= this.solarHeating.differentialOnThreshold) {
      this.solarHeating.solarPumpRunning = true;
      this.log(`Solar pump ON: panel ${panelTemp}°C, pool ${poolTemp}°C (diff ${diff.toFixed(1)}°C)`);
    } else if (this.solarHeating.solarPumpRunning && diff <= this.solarHeating.differentialOffThreshold) {
      this.solarHeating.solarPumpRunning = false;
      this.log(`Solar pump OFF: differential too low (${diff.toFixed(1)}°C)`);
    }

    if (this.solarHeating.solarPumpRunning) {
      this.solarHeating.dailySolarHours += (this.monitoringIntervalMs / 3600000);
      this.solarHeating.totalSolarHours += (this.monitoringIntervalMs / 3600000);
    }

    // Auxiliary heater fallback
    if (this.solarHeating.auxiliaryHeaterEnabled) {
      const targetTemp = mainPool.targetTemperature;
      const needsHeat = poolTemp < targetTemp - 1;
      const solarInsufficient = !this.solarHeating.solarPumpRunning || diff < this.solarHeating.differentialOnThreshold;

      if (needsHeat && solarInsufficient && !this.solarHeating.auxiliaryHeaterRunning) {
        this.solarHeating.auxiliaryHeaterRunning = true;
        this.log('Auxiliary heater activated (solar insufficient)');
      } else if (poolTemp >= targetTemp && this.solarHeating.auxiliaryHeaterRunning) {
        this.solarHeating.auxiliaryHeaterRunning = false;
        this.log('Auxiliary heater deactivated (target reached)');
      }
    }
  }

  // ====================================================================
  //  FREEZE PROTECTION
  // ====================================================================
  updateAirTemperature(tempC) {
    this.freezeProtection.airTemperature = tempC;
    if (this.weather) this.weather.currentTemp = tempC;
  }

  updatePipeSensorTemperature(tempC) {
    this.freezeProtection.pipeSensorTemperature = tempC;
  }

  _evaluateFreezeProtection() {
    if (!this.freezeProtection.enabled) return;
    const airTemp = this.freezeProtection.airTemperature;
    if (airTemp === null) return;

    if (airTemp < this.freezeProtection.activationTempC && !this.freezeProtection.isActive) {
      this.freezeProtection.isActive = true;
      this.freezeProtection.activationCount++;
      this.freezeProtection.lastActivation = Date.now();
      this.log(`Freeze protection ACTIVATED: air temp ${airTemp}°C`);
      if (!this.pumpState.running) {
        this.startPump('low');
      }
      if (this.freezeProtection.heaterLowFire) {
        this.solarHeating.auxiliaryHeaterRunning = true;
        this.log('Heater low-fire engaged for freeze protection');
      }
    } else if (airTemp >= this.freezeProtection.activationTempC + 2 && this.freezeProtection.isActive) {
      this.freezeProtection.isActive = false;
      this.log(`Freeze protection DEACTIVATED: air temp ${airTemp}°C`);
      if (this.freezeProtection.heaterLowFire) {
        this.solarHeating.auxiliaryHeaterRunning = false;
      }
    }

    // Pipe sensor warning
    if (this.freezeProtection.pipeSensorTemperature !== null && this.freezeProtection.pipeSensorTemperature < 1) {
      this.log('WARNING: Pipe sensor near freezing!');
      if (this.freezeProtection.autoDrainEquipmentPad) {
        this.log('Auto-drain activated for equipment pad');
      }
    }
  }

  // ====================================================================
  //  SALT CHLORINATOR
  // ====================================================================
  setSaltChlorinatorOutput(percentage) {
    if (percentage < 0 || percentage > 100) {
      this.error('Salt chlorinator output must be 0-100%');
      return false;
    }
    this.saltChlorinator.outputPercentage = percentage;
    this.log(`Salt chlorinator output set to ${percentage}%`);
    return true;
  }

  _evaluateSaltChlorinator() {
    if (!this.saltChlorinator.enabled || !this.pumpState.running) {
      this.saltChlorinator.isGenerating = false;
      return;
    }

    this.saltChlorinator.isGenerating = true;
    this.saltChlorinator.cellRunHours += (this.monitoringIntervalMs / 3600000);

    // Cell cleaning reminder
    const hoursSinceClean = this.saltChlorinator.lastCleaningTime
      ? (Date.now() - this.saltChlorinator.lastCleaningTime) / 3600000
      : this.saltChlorinator.cellRunHours;

    if (hoursSinceClean >= this.saltChlorinator.cellCleaningIntervalHours) {
      this.log('Salt cell cleaning required (500 hour interval reached)');
    }

    // Cell life tracking
    const lifePercent = ((this.saltChlorinator.cellMaxLifeHours - this.saltChlorinator.cellRunHours) /
      this.saltChlorinator.cellMaxLifeHours) * 100;
    if (lifePercent < 10) {
      this.saltChlorinator.cellCondition = 'replace_soon';
      this.log(`Salt cell life remaining: ${lifePercent.toFixed(1)}% — replacement needed`);
    } else if (lifePercent < 30) {
      this.saltChlorinator.cellCondition = 'aging';
    } else {
      this.saltChlorinator.cellCondition = 'good';
    }

    // Reverse polarity timer
    const hoursSinceReversal = this.saltChlorinator.lastPolarityReversal
      ? (Date.now() - this.saltChlorinator.lastPolarityReversal) / 3600000
      : this.saltChlorinator.reversePolarityIntervalHours + 1;

    if (hoursSinceReversal >= this.saltChlorinator.reversePolarityIntervalHours) {
      this.saltChlorinator.lastPolarityReversal = Date.now();
      this.log('Salt cell reverse polarity cycle triggered');
    }

    // Salt level check
    const salt = this.saltChlorinator.currentSaltLevel;
    if (salt < this.chemistryParams.saltLevel.targetLow) {
      this.log(`Salt level low: ${salt} ppm (target ${this.chemistryParams.saltLevel.targetLow}-${this.chemistryParams.saltLevel.targetHigh})`);
    } else if (salt > this.chemistryParams.saltLevel.targetHigh) {
      this.log(`Salt level high: ${salt} ppm — consider dilution`);
    }
  }

  // ====================================================================
  //  COVER MANAGEMENT
  // ====================================================================
  openCover() {
    if (this.coverState.safetyLockChildren) {
      this.log('Cover safety lock is engaged — cannot open');
      return false;
    }
    if (this.coverState.isOpen) return true;
    this.coverState.isOpen = true;
    this.coverState.motorStatus = 'opening';
    this.coverState.lastOpenTime = Date.now();
    this.log('Pool cover opening');
    setTimeout(() => {
      this.coverState.motorStatus = 'idle';
      this.log('Pool cover fully open');
    }, 3000);
    return true;
  }

  closeCover() {
    if (!this.coverState.isOpen) return true;
    this.coverState.isOpen = false;
    this.coverState.motorStatus = 'closing';
    this.coverState.lastCloseTime = Date.now();
    this.log('Pool cover closing');
    setTimeout(() => {
      this.coverState.motorStatus = 'idle';
      this.log('Pool cover fully closed');
    }, 3000);
    return true;
  }

  toggleChildSafetyLock(enabled) {
    this.coverState.safetyLockChildren = enabled;
    this.log(`Cover child safety lock: ${enabled ? 'ENGAGED' : 'disengaged'}`);
  }

  _evaluateCover() {
    if (!this.coverState.autoMode || this.partyMode.active) return;

    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const totalMin = hour * 60 + minute;

    // Approximate sunrise/sunset for mid-latitude
    const sunriseMin = 6 * 60 + 30;
    const sunsetMin = 19 * 60 + 30;
    const openTime = sunriseMin + this.coverState.sunriseOffsetMinutes;

    if (totalMin >= openTime && totalMin < sunsetMin && !this.coverState.isOpen) {
      this.openCover();
    } else if (this.coverState.closeAtSunset && totalMin >= sunsetMin && this.coverState.isOpen) {
      this.closeCover();
    }

    // Heat retention
    if (this.coverState.heatRetentionMode && this.coverState.isOpen) {
      const mainPool = this.waterBodies.get('main_pool');
      if (mainPool) {
        const diff = mainPool.targetTemperature - mainPool.currentTemperature;
        if (diff > this.coverState.heatRetentionDiffC) {
          this.closeCover();
          this.log('Cover closed for heat retention');
        }
      }
    }

    // Rain detection
    if (this.coverState.rainDetectionClose && this.weather.isRaining && this.coverState.isOpen) {
      this.closeCover();
      this.log('Cover closed due to rain detection');
    }
  }

  // ====================================================================
  //  LIGHTING
  // ====================================================================
  setLightingPreset(zone, presetName) {
    if (!this.lightingZones[zone]) {
      this.error(`Unknown lighting zone: ${zone}`);
      return false;
    }
    if (!this.lightingPresets[presetName]) {
      this.error(`Unknown lighting preset: ${presetName}`);
      return false;
    }
    this.lightingZones[zone].preset = presetName;
    this.log(`Lighting zone '${zone}' set to preset '${presetName}'`);
    return true;
  }

  setLightingBrightness(zone, brightness) {
    if (!this.lightingZones[zone]) {
      this.error(`Unknown lighting zone: ${zone}`);
      return false;
    }
    this.lightingZones[zone].brightness = Math.max(0, Math.min(100, brightness));
    this.log(`Lighting zone '${zone}' brightness set to ${this.lightingZones[zone].brightness}%`);
    return true;
  }

  turnOnLighting(zone) {
    if (!this.lightingZones[zone]) {
      this.error(`Unknown lighting zone: ${zone}`);
      return false;
    }
    this.lightingZones[zone].on = true;
    this.log(`Lighting zone '${zone}' turned ON`);
    return true;
  }

  turnOffLighting(zone) {
    if (!this.lightingZones[zone]) {
      this.error(`Unknown lighting zone: ${zone}`);
      return false;
    }
    this.lightingZones[zone].on = false;
    this.log(`Lighting zone '${zone}' turned OFF`);
    return true;
  }

  setAllLightingPreset(presetName) {
    for (const zone of Object.keys(this.lightingZones)) {
      this.setLightingPreset(zone, presetName);
      this.turnOnLighting(zone);
    }
  }

  _advanceRainbowCycle() {
    this.lightingCyclePosition = (this.lightingCyclePosition + 1) % 360;
    // HSL hue rotation for rainbow effect
    const h = this.lightingCyclePosition;
    const s = 1;
    const l = 0.5;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255)
    };
  }

  // ====================================================================
  //  WATER LEVEL
  // ====================================================================
  updateWaterLevel(levelCm) {
    const previousLevel = this.waterLevel.currentLevelCm;
    this.waterLevel.currentLevelCm = levelCm;

    // Evaporation tracking
    if (previousLevel > 0 && levelCm < previousLevel) {
      const lossCm = previousLevel - levelCm;
      this.waterLevel.evaporationHistory.push({
        timestamp: Date.now(),
        lossCm
      });
    }

    // Leak detection
    this._evaluateLeakDetection();

    // Auto-fill
    this._evaluateAutoFill();

    // Overflow prevention
    if (this.waterLevel.overflowPreventionEnabled && levelCm >= this.waterLevel.overflowLevelCm) {
      this.log('Water level at overflow threshold — closing fill valve');
      this.waterLevel.autoFillValveOpen = false;
    }
  }

  _evaluateLeakDetection() {
    const recentReadings = this.waterLevel.evaporationHistory.filter(
      (e) => Date.now() - e.timestamp < 86400000
    );
    if (recentReadings.length > 0) {
      const totalLossCm = recentReadings.reduce((sum, r) => sum + r.lossCm, 0);
      if (totalLossCm > this.waterLevel.leakDetectionThresholdCmPerDay) {
        if (!this.waterLevel.leakAlertActive) {
          this.waterLevel.leakAlertActive = true;
          this.log(`LEAK ALERT: Water loss ${totalLossCm.toFixed(1)} cm/day exceeds threshold`);
        }
      } else {
        this.waterLevel.leakAlertActive = false;
      }
      // Approximate evaporation rate in liters based on main pool area estimate
      const mainPool = this.waterBodies.get('main_pool');
      if (mainPool) {
        const surfaceAreaM2 = mainPool.volumeLiters / 1500; // rough estimate
        this.waterLevel.evaporationRateLitersPerDay = totalLossCm * surfaceAreaM2 * 10;
      }
    }
  }

  _evaluateAutoFill() {
    if (this.waterLevel.currentLevelCm < this.waterLevel.targetLevelCm - 2) {
      if (!this.waterLevel.autoFillValveOpen) {
        this.waterLevel.autoFillValveOpen = true;
        this.waterLevel.lastFillStartTime = Date.now();
        this.log('Auto-fill valve OPENED');
      }
    } else if (this.waterLevel.currentLevelCm >= this.waterLevel.targetLevelCm) {
      if (this.waterLevel.autoFillValveOpen) {
        this.waterLevel.autoFillValveOpen = false;
        this.log('Auto-fill valve CLOSED (target level reached)');
      }
    }
  }

  // ====================================================================
  //  FILTRATION
  // ====================================================================
  updateFilterPressure(psi) {
    this.filtration.currentPressurePsi = psi;
    if (psi >= this.filtration.dirtyPressurePsi) {
      this.filtration.backwashReminder = true;
      this.log(`Filter pressure HIGH: ${psi} psi — backwash/clean required`);
    } else if (psi <= this.filtration.cleanPressurePsi + 2) {
      this.filtration.backwashReminder = false;
    }
  }

  recordBackwash() {
    this.filtration.lastBackwashDate = Date.now();
    this.filtration.backwashReminder = false;
    this.log('Filter backwash recorded');
  }

  setFilterType(type) {
    const valid = ['sand', 'cartridge', 'DE'];
    if (!valid.includes(type)) {
      this.error(`Invalid filter type: ${type}. Use: ${valid.join(', ')}`);
      return false;
    }
    this.filtration.filterType = type;
    this.log(`Filter type set to ${type}`);
    return true;
  }

  _checkFilterAge() {
    if (!this.filtration.filterInstallDate) return;
    const ageDays = (Date.now() - this.filtration.filterInstallDate) / 86400000;
    this.filtration.filterAgeDays = Math.floor(ageDays);
    if (ageDays >= this.filtration.replacementIntervalDays) {
      this.log(`Filter replacement overdue (${Math.floor(ageDays)} days old)`);
    } else if (ageDays >= this.filtration.replacementIntervalDays * 0.9) {
      this.log(`Filter replacement approaching (${Math.floor(ageDays)}/${this.filtration.replacementIntervalDays} days)`);
    }
  }

  // ====================================================================
  //  MAINTENANCE CALENDAR
  // ====================================================================
  _initializeMaintenanceDates() {
    this.filtration.filterInstallDate = Date.now() - (120 * 86400000); // 120 days ago
    this.saltChlorinator.lastCleaningTime = Date.now() - (400 * 3600000); // 400 hours ago
    this.log('Maintenance dates initialized');
  }

  completeMaintenanceTask(frequency, taskId) {
    const schedule = this.maintenanceSchedule[frequency];
    if (!schedule) {
      this.error(`Invalid maintenance frequency: ${frequency}`);
      return false;
    }
    const task = schedule.tasks.find((t) => t.id === taskId);
    if (!task) {
      this.error(`Task not found: ${taskId}`);
      return false;
    }
    const fieldMap = {
      daily: 'completedToday',
      weekly: 'completedThisWeek',
      monthly: 'completedThisMonth',
      seasonal: 'completedThisSeason'
    };
    task[fieldMap[frequency]] = true;
    this.maintenanceHistory.push({
      timestamp: Date.now(),
      frequency,
      taskId,
      label: task.label
    });
    this.log(`Maintenance completed: ${task.label}`);
    return true;
  }

  getOutstandingMaintenance() {
    const outstanding = {};
    for (const [freq, schedule] of Object.entries(this.maintenanceSchedule)) {
      const fieldMap = {
        daily: 'completedToday',
        weekly: 'completedThisWeek',
        monthly: 'completedThisMonth',
        seasonal: 'completedThisSeason'
      };
      const incomplete = schedule.tasks.filter((t) => !t[fieldMap[freq]]);
      if (incomplete.length > 0) {
        outstanding[freq] = incomplete.map((t) => t.label);
      }
    }
    return outstanding;
  }

  _resetDailyMaintenance() {
    for (const task of this.maintenanceSchedule.daily.tasks) {
      task.completedToday = false;
    }
  }

  _resetWeeklyMaintenance() {
    for (const task of this.maintenanceSchedule.weekly.tasks) {
      task.completedThisWeek = false;
    }
  }

  // ====================================================================
  //  ENERGY MONITORING
  // ====================================================================
  _trackEnergy() {
    if (this.pumpState.running && this.pumpState.lastStartTime) {
      const watts = this.pumpSpeeds[this.pumpState.currentSpeed].watts;
      const intervalHours = this.monitoringIntervalMs / 3600000;
      const kwh = (watts * intervalHours) / 1000;
      this.energyMonitoring.pumpKwhToday += kwh;
      this.energyMonitoring.pumpKwhMonth += kwh;
    }

    if (this.solarHeating.auxiliaryHeaterRunning) {
      const intervalHours = this.monitoringIntervalMs / 3600000;
      const heaterKw = this.solarHeating.auxiliaryHeaterType === 'electric' ? 11 : 0;
      const heaterKwh = heaterKw * intervalHours;
      this.energyMonitoring.heaterUsageToday += intervalHours;
      this.energyMonitoring.heaterUsageMonth += intervalHours;
      if (heaterKwh > 0) {
        this.energyMonitoring.pumpKwhToday += heaterKwh;
        this.energyMonitoring.pumpKwhMonth += heaterKwh;
      }
    }

    const totalKwh = this.energyMonitoring.pumpKwhMonth;
    this.energyMonitoring.totalCostMonth = totalKwh * this.pumpState.energyCostPerKwh;
    this.energyMonitoring.totalCostToday = this.energyMonitoring.pumpKwhToday * this.pumpState.energyCostPerKwh;

    this._generateEnergyRecommendations();
  }

  _generateEnergyRecommendations() {
    this.energyMonitoring.recommendations = [];

    if (this.pumpState.currentSpeed === 'high' && this.pumpState.dailyRunHours > 4) {
      this.energyMonitoring.recommendations.push(
        'Consider reducing pump speed to "normal" — high speed for extended periods increases cost significantly.'
      );
    }

    if (this.solarHeating.enabled && this.solarHeating.dailySolarHours < 2 && this.solarHeating.auxiliaryHeaterRunning) {
      this.energyMonitoring.recommendations.push(
        'Solar heating is underperforming. Check panel orientation and condition to reduce auxiliary heater reliance.'
      );
    }

    if (this.energyMonitoring.totalCostMonth > this.energyMonitoring.previousMonthCost * 1.2 && this.energyMonitoring.previousMonthCost > 0) {
      this.energyMonitoring.recommendations.push(
        `Monthly energy cost is ${((this.energyMonitoring.totalCostMonth / this.energyMonitoring.previousMonthCost - 1) * 100).toFixed(0)}% higher than last month.`
      );
    }
  }

  // ====================================================================
  //  WEATHER INTEGRATION
  // ====================================================================
  updateWeather(data) {
    if (data.temperature !== undefined) this.weather.currentTemp = data.temperature;
    if (data.uvIndex !== undefined) this.weather.uvIndex = data.uvIndex;
    if (data.isRaining !== undefined) this.weather.isRaining = data.isRaining;
    if (data.stormWarning !== undefined) this.weather.stormWarning = data.stormWarning;
    if (data.rainExpected !== undefined) this.weather.rainExpected = data.rainExpected;
    if (data.windSpeedKmh !== undefined) this.weather.windSpeedKmh = data.windSpeedKmh;
    this.weather.lastUpdate = Date.now();
  }

  _evaluateWeatherAdjustments() {
    // Pre-rain chemistry adjustment
    if (this.weather.rainExpected && !this.weather.preRainChemistryAdjusted) {
      this.log('Rain expected — increasing chlorine target for pre-rain dosing');
      this.weather.preRainChemistryAdjusted = true;
    }

    // Post-rain chemistry adjustment
    if (!this.weather.isRaining && this.weather.preRainChemistryAdjusted && !this.weather.postRainChemistryAdjusted) {
      this.log('Post-rain chemistry check recommended');
      this.weather.postRainChemistryAdjusted = true;
    }

    // Reset flags when no rain expected
    if (!this.weather.rainExpected && !this.weather.isRaining) {
      this.weather.preRainChemistryAdjusted = false;
      this.weather.postRainChemistryAdjusted = false;
    }

    // Storm preparation
    if (this.weather.stormWarning) {
      this.log('Storm warning active — securing covers and checking water level');
      if (this.coverState.isOpen) {
        this.closeCover();
      }
    }

    // UV index affects chlorine demand
    if (this.weather.uvIndex >= 8) {
      this.log(`High UV index (${this.weather.uvIndex}) — chlorine demand will be elevated`);
    }

    // Update freeze protection with weather data
    if (this.weather.currentTemp !== null) {
      this.updateAirTemperature(this.weather.currentTemp);
    }
  }

  // ====================================================================
  //  SPA JETS
  // ====================================================================
  startJets(options = {}) {
    const hotTub = this.waterBodies.get('hot_tub');
    if (!hotTub || !hotTub.hasJets) {
      this.error('No hot tub with jets available');
      return false;
    }
    const intensity = options.intensity || this.spaJets.intensity;
    const timer = options.timerMinutes || this.spaJets.timerMinutes;

    if (!this.spaJets.intensityLevels[intensity]) {
      this.error(`Invalid jet intensity: ${intensity}`);
      return false;
    }
    if (!this.spaJets.timerOptions.includes(timer)) {
      this.log(`Non-standard timer: ${timer} min (standard: ${this.spaJets.timerOptions.join(', ')})`);
    }

    this.spaJets.running = true;
    this.spaJets.intensity = intensity;
    this.spaJets.timerMinutes = timer;
    this.spaJets.autoOffTime = Date.now() + (timer * 60000);

    if (options.aromatherapy && this.spaJets.aromatherapyScents.includes(options.aromatherapy)) {
      this.spaJets.aromatherapyEnabled = true;
      this.spaJets.aromatherapyScent = options.aromatherapy;
      this.log(`Aromatherapy activated: ${options.aromatherapy}`);
    }

    this.log(`Spa jets started: ${intensity} intensity, ${timer} min timer`);
    return true;
  }

  stopJets() {
    this.spaJets.running = false;
    this.spaJets.autoOffTime = null;
    this.spaJets.aromatherapyEnabled = false;
    this.spaJets.activeSequence = null;
    this.spaJets.sequenceStepIndex = 0;
    this.log('Spa jets stopped');
  }

  startHydrotherapySequence(sequenceName) {
    const sequence = this.spaJets.hydrotherapySequences[sequenceName];
    if (!sequence) {
      this.error(`Unknown hydrotherapy sequence: ${sequenceName}`);
      return false;
    }
    this.spaJets.activeSequence = sequenceName;
    this.spaJets.sequenceStepIndex = 0;
    this.spaJets.running = true;

    const firstStep = sequence[0];
    this.spaJets.intensity = firstStep.intensity;
    this.spaJets.autoOffTime = Date.now() + (firstStep.durationSec * 1000);
    this.log(`Hydrotherapy sequence '${sequenceName}' started — step 1/${sequence.length}`);
    return true;
  }

  _evaluateJetTimer() {
    if (!this.spaJets.running || !this.spaJets.autoOffTime) return;

    if (Date.now() >= this.spaJets.autoOffTime) {
      // Check if we're running a hydrotherapy sequence
      if (this.spaJets.activeSequence) {
        const sequence = this.spaJets.hydrotherapySequences[this.spaJets.activeSequence];
        this.spaJets.sequenceStepIndex++;
        if (this.spaJets.sequenceStepIndex < sequence.length) {
          const step = sequence[this.spaJets.sequenceStepIndex];
          this.spaJets.intensity = step.intensity;
          this.spaJets.autoOffTime = Date.now() + (step.durationSec * 1000);
          this.log(`Hydrotherapy step ${this.spaJets.sequenceStepIndex + 1}/${sequence.length}: ${step.intensity}`);
          return;
        }
        this.log(`Hydrotherapy sequence '${this.spaJets.activeSequence}' complete`);
      }
      this.stopJets();
    }
  }

  // ====================================================================
  //  GUEST / PARTY MODE
  // ====================================================================
  activatePartyMode(options = {}) {
    if (this.partyMode.active) {
      this.log('Party mode is already active');
      return;
    }

    // Save current settings for restoration
    this.partyMode.savedSettings = {
      pumpSpeed: this.pumpState.currentSpeed,
      coverAutoMode: this.coverState.autoMode,
      lightingPresets: {}
    };
    for (const [zone, state] of Object.entries(this.lightingZones)) {
      this.partyMode.savedSettings.lightingPresets[zone] = { ...state };
    }

    this.partyMode.active = true;
    this.partyMode.activationTime = Date.now();
    const durationMin = options.durationMinutes || this.partyMode.autoReturnMinutes;
    this.partyMode.returnToNormalTime = Date.now() + (durationMin * 60000);

    // Pre-heat spa
    if (this.partyMode.preHeatSpa) {
      const hotTub = this.waterBodies.get('hot_tub');
      if (hotTub) {
        hotTub.heatingActive = true;
        this.log('Party mode: Spa pre-heating started');
      }
    }

    // Set lighting to party colors
    const lightPreset = options.lightingPreset || this.partyMode.lightingPreset;
    this.setAllLightingPreset(lightPreset);
    this.log(`Party mode: Lighting set to '${lightPreset}'`);

    // Extend pump run at normal speed
    if (this.partyMode.extendedPumpRun) {
      this.startPump('normal');
    }

    // Disable auto-cover close
    if (this.partyMode.disableAutoCoverClose) {
      this.coverState.autoMode = false;
    }

    this.log(`Party mode ACTIVATED for ${durationMin} minutes`);
  }

  deactivatePartyMode() {
    if (!this.partyMode.active) return;

    // Restore saved settings
    if (this.partyMode.savedSettings) {
      this.setPumpSpeed(this.partyMode.savedSettings.pumpSpeed);
      this.coverState.autoMode = this.partyMode.savedSettings.coverAutoMode;
      for (const [zone, state] of Object.entries(this.partyMode.savedSettings.lightingPresets)) {
        if (this.lightingZones[zone]) {
          Object.assign(this.lightingZones[zone], state);
        }
      }
    }

    this.partyMode.active = false;
    this.partyMode.activationTime = null;
    this.partyMode.returnToNormalTime = null;
    this.partyMode.savedSettings = null;
    this.log('Party mode DEACTIVATED — settings restored');
  }

  _evaluatePartyMode() {
    if (!this.partyMode.active) return;
    if (this.partyMode.returnToNormalTime && Date.now() >= this.partyMode.returnToNormalTime) {
      this.log('Party mode auto-return triggered');
      this.deactivatePartyMode();
    }
  }

  // ====================================================================
  //  MONITORING CYCLE (every 3 minutes)
  // ====================================================================
  _startMonitoringCycle() {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
    }
    this.monitoringTimer = setInterval(() => {
      this._runMonitoringCycle();
    }, this.monitoringIntervalMs);
    this.log(`Monitoring cycle started (every ${this.monitoringIntervalMs / 1000}s)`);
  }

  _runMonitoringCycle() {
    try {
      this.lastMonitoringCycle = Date.now();

      // Pump schedule
      this._adjustPumpSpeedForSchedule();

      // Solar heating evaluation
      this._evaluateSolarHeating();

      // Freeze protection
      this._evaluateFreezeProtection();

      // Salt chlorinator
      this._evaluateSaltChlorinator();

      // Cover management
      this._evaluateCover();

      // Water level & filtration
      this._checkFilterAge();

      // Auto-dosing for each water body
      for (const [type] of this.waterBodies) {
        this._executeDosing(type);
      }

      // Weather adjustments
      this._evaluateWeatherAdjustments();

      // Spa jet timer
      this._evaluateJetTimer();

      // Party mode timer
      this._evaluatePartyMode();

      // Energy tracking
      this._trackEnergy();

      // Rainbow cycle update
      for (const [zone, state] of Object.entries(this.lightingZones)) {
        if (state.on && state.preset === 'rainbow_cycle') {
          this._advanceRainbowCycle();
        }
      }

      // Record pump run history
      if (this.pumpState.running) {
        this.pumpRunHistory.push({
          timestamp: Date.now(),
          speed: this.pumpState.currentSpeed,
          rpm: this.pumpSpeeds[this.pumpState.currentSpeed].rpm,
          watts: this.pumpSpeeds[this.pumpState.currentSpeed].watts
        });
        this._pruneHistory(this.pumpRunHistory);
      }

      // Record heating history
      if (this.solarHeating.solarPumpRunning || this.solarHeating.auxiliaryHeaterRunning) {
        this.heatingHistory.push({
          timestamp: Date.now(),
          solarActive: this.solarHeating.solarPumpRunning,
          auxiliaryActive: this.solarHeating.auxiliaryHeaterRunning,
          panelTemp: this.solarHeating.panelTemperature
        });
        this._pruneHistory(this.heatingHistory);
      }

    } catch (err) {
      this.error(`Monitoring cycle error: ${err.message}`);
    }
  }

  // ====================================================================
  //  HISTORY MANAGEMENT
  // ====================================================================
  _pruneHistory(arr) {
    const cutoff = Date.now() - (this.historyRetentionDays * 86400000);
    while (arr.length > 0 && arr[0].timestamp < cutoff) {
      arr.shift();
    }
    // Also cap at a max number of entries to prevent memory issues
    const maxEntries = 15000;
    while (arr.length > maxEntries) {
      arr.shift();
    }
  }

  getChemistryHistory(waterBodyType, days = 7) {
    const cutoff = Date.now() - (days * 86400000);
    return this.chemistryHistory.filter(
      (e) => e.waterBody === waterBodyType && e.timestamp >= cutoff
    );
  }

  getPumpRunHistory(days = 7) {
    const cutoff = Date.now() - (days * 86400000);
    return this.pumpRunHistory.filter((e) => e.timestamp >= cutoff);
  }

  getHeatingHistory(days = 7) {
    const cutoff = Date.now() - (days * 86400000);
    return this.heatingHistory.filter((e) => e.timestamp >= cutoff);
  }

  // ====================================================================
  //  STATISTICS
  // ====================================================================
  getStatistics() {
    const waterBodyStats = {};
    for (const [type, wb] of this.waterBodies) {
      waterBodyStats[type] = {
        label: wb.label,
        currentTemperature: wb.currentTemperature,
        targetTemperature: wb.targetTemperature,
        volumeLiters: wb.volumeLiters,
        chemistry: { ...wb.chemistry },
        alerts: wb.alerts.length,
        heatingActive: wb.heatingActive,
        filterRunning: wb.filterRunning,
        lastChemistryTest: wb.lastChemistryTest
      };
    }

    return {
      initialized: this.initialized,
      lastMonitoringCycle: this.lastMonitoringCycle,
      waterBodies: waterBodyStats,
      waterBodyCount: this.waterBodies.size,
      pump: {
        running: this.pumpState.running,
        currentSpeed: this.pumpState.currentSpeed,
        rpm: this.pumpSpeeds[this.pumpState.currentSpeed].rpm,
        totalRunHours: parseFloat(this.pumpState.totalRunHours.toFixed(2)),
        dailyRunHours: parseFloat(this.pumpState.dailyRunHours.toFixed(2)),
        dailyEnergyCost: parseFloat(this.pumpState.dailyEnergyCost.toFixed(2))
      },
      solarHeating: {
        enabled: this.solarHeating.enabled,
        solarPumpRunning: this.solarHeating.solarPumpRunning,
        panelTemperature: this.solarHeating.panelTemperature,
        dailySolarHours: parseFloat(this.solarHeating.dailySolarHours.toFixed(2)),
        totalSolarHours: parseFloat(this.solarHeating.totalSolarHours.toFixed(2)),
        auxiliaryHeaterRunning: this.solarHeating.auxiliaryHeaterRunning
      },
      freezeProtection: {
        enabled: this.freezeProtection.enabled,
        isActive: this.freezeProtection.isActive,
        airTemperature: this.freezeProtection.airTemperature,
        activationCount: this.freezeProtection.activationCount
      },
      saltChlorinator: {
        enabled: this.saltChlorinator.enabled,
        outputPercentage: this.saltChlorinator.outputPercentage,
        cellRunHours: parseFloat(this.saltChlorinator.cellRunHours.toFixed(1)),
        cellCondition: this.saltChlorinator.cellCondition,
        cellLifeRemainingPercent: parseFloat(
          (((this.saltChlorinator.cellMaxLifeHours - this.saltChlorinator.cellRunHours) /
            this.saltChlorinator.cellMaxLifeHours) * 100).toFixed(1)
        ),
        isGenerating: this.saltChlorinator.isGenerating
      },
      cover: {
        isOpen: this.coverState.isOpen,
        autoMode: this.coverState.autoMode,
        safetyLock: this.coverState.safetyLockChildren,
        motorStatus: this.coverState.motorStatus
      },
      lighting: { ...this.lightingZones },
      waterLevel: {
        currentLevelCm: this.waterLevel.currentLevelCm,
        targetLevelCm: this.waterLevel.targetLevelCm,
        autoFillValveOpen: this.waterLevel.autoFillValveOpen,
        leakAlertActive: this.waterLevel.leakAlertActive,
        evaporationRateLitersPerDay: parseFloat(this.waterLevel.evaporationRateLitersPerDay.toFixed(1))
      },
      filtration: {
        filterType: this.filtration.filterType,
        currentPressurePsi: this.filtration.currentPressurePsi,
        backwashReminder: this.filtration.backwashReminder,
        filterAgeDays: this.filtration.filterAgeDays
      },
      dosing: {
        chlorine: {
          enabled: this.dosingConfig.chlorine.enabled,
          totalDosedMl: parseFloat(this.dosingConfig.chlorine.totalDosedMl.toFixed(1))
        },
        acid: {
          enabled: this.dosingConfig.acid.enabled,
          totalDosedMl: parseFloat(this.dosingConfig.acid.totalDosedMl.toFixed(1))
        },
        alkalinityIncreaser: {
          enabled: this.dosingConfig.alkalinityIncreaser.enabled,
          totalDosedGrams: parseFloat(this.dosingConfig.alkalinityIncreaser.totalDosedGrams.toFixed(1))
        }
      },
      energy: {
        pumpKwhToday: parseFloat(this.energyMonitoring.pumpKwhToday.toFixed(2)),
        pumpKwhMonth: parseFloat(this.energyMonitoring.pumpKwhMonth.toFixed(2)),
        totalCostToday: parseFloat(this.energyMonitoring.totalCostToday.toFixed(2)),
        totalCostMonth: parseFloat(this.energyMonitoring.totalCostMonth.toFixed(2)),
        previousMonthCost: parseFloat(this.energyMonitoring.previousMonthCost.toFixed(2)),
        recommendations: this.energyMonitoring.recommendations
      },
      weather: {
        currentTemp: this.weather.currentTemp,
        uvIndex: this.weather.uvIndex,
        isRaining: this.weather.isRaining,
        stormWarning: this.weather.stormWarning
      },
      spaJets: {
        running: this.spaJets.running,
        intensity: this.spaJets.intensity,
        aromatherapyEnabled: this.spaJets.aromatherapyEnabled,
        aromatherapyScent: this.spaJets.aromatherapyScent,
        activeSequence: this.spaJets.activeSequence
      },
      partyMode: {
        active: this.partyMode.active,
        activationTime: this.partyMode.activationTime,
        returnToNormalTime: this.partyMode.returnToNormalTime
      },
      maintenance: this.getOutstandingMaintenance(),
      history: {
        chemistryEntries: this.chemistryHistory.length,
        pumpRunEntries: this.pumpRunHistory.length,
        heatingEntries: this.heatingHistory.length,
        maintenanceEntries: this.maintenanceHistory.length
      }
    };
  }

  // ====================================================================
  //  LOGGING
  // ====================================================================
  log(msg) {
    try {
      if (this.homey && typeof this.homey.log === 'function') {
        this.homey.log(`[PoolSpa] ${msg}`);
      } else {
        console.log(`[PoolSpa] ${msg}`);
      }
    } catch (_) {
      console.log(`[PoolSpa] ${msg}`);
    }
  }

  error(msg) {
    try {
      if (this.homey && typeof this.homey.error === 'function') {
        this.homey.error(`[PoolSpa] ${msg}`);
      } else {
        console.error(`[PoolSpa] ${msg}`);
      }
    } catch (_) {
      console.error(`[PoolSpa] ${msg}`);
    }
  }

  // ====================================================================
  //  DESTROY
  // ====================================================================
  destroy() {
    this.log('Destroying PoolSpaManagementSystem...');
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }
    if (this.pumpState.running) {
      this.stopPump();
    }
    if (this.spaJets.running) {
      this.stopJets();
    }
    if (this.partyMode.active) {
      this.deactivatePartyMode();
    }
    this.waterBodies.clear();
    this.chemistryHistory = [];
    this.pumpRunHistory = [];
    this.heatingHistory = [];
    this.costHistory = [];
    this.maintenanceHistory = [];
    this.initialized = false;
    this.log('PoolSpaManagementSystem destroyed');
  }
}

module.exports = PoolSpaManagementSystem;
