'use strict';

const EventEmitter = require('events');

class SmartHVACZoneControlSystem extends EventEmitter {
  constructor(homey) {
    super();
    this.homey = homey;
    this.initialized = false;
    this.intervals = [];

    // HVAC Zones
    this.zones = new Map();
    this.equipment = new Map();
    this.trvValves = new Map();
    this.underfloorZones = new Map();
    this.ventilation = null;

    // Scheduling & patterns
    this.schedules = new Map();
    this.learnedPatterns = { weekday: {}, weekend: {} };
    this.holidayMode = false;
    this.vacationMode = false;

    // Climate quality
    this.climateQuality = new Map();
    this.filters = [];

    // Weather
    this.outdoorConditions = {
      temperature: 5.0,
      humidity: 65,
      windSpeed: 3.0,
      windDirection: 'SW',
      solarIrradiance: 0,
      forecast: [],
      sevenDayAvgTemp: 5.0
    };

    // Seasonal
    this.currentSeason = 'winter-heating';
    this.seasonalConfig = {
      'winter-heating': { months: [10, 11, 12, 1, 2, 3, 4], heatFocused: true, antiFreeze: true, acEnabled: false },
      'summer-cooling': { months: [6, 7, 8], heatFocused: false, antiFreeze: false, acEnabled: true },
      'transition-spring': { months: [4, 5], heatFocused: false, antiFreeze: false, acEnabled: false },
      'transition-autumn': { months: [9, 10], heatFocused: false, antiFreeze: false, acEnabled: false }
    };

    // Cost tracking
    this.costTracking = {
      electricityPriceSEK: 1.85,
      districtHeatingPriceSEK: 0.72,
      peakHours: [7, 8, 9, 17, 18, 19, 20],
      monthlyCosts: new Map(),
      previousMonthCost: 0,
      previousYearCost: 0,
      savingsFromOptimization: 0
    };

    // Energy optimization
    this.demandResponse = { active: false, reductionPercent: 0 };
    this.loadBalancing = { maxSimultaneousPower: 15000, currentLoad: 0 };

    // Historical data
    this.historicalData = {
      temperatureLogs: new Map(),
      energyConsumption: new Map(),
      outdoorTempLog: []
    };

    // Comfort scoring
    this.comfortScores = new Map();

    // Zone dependencies
    this.zoneDependencies = [
      { zones: ['living-room', 'kitchen'], type: 'open-plan', transferRate: 0.35 },
      { zones: ['hallway', 'living-room'], type: 'stairwell', transferRate: 0.15 },
      { zones: ['hallway', 'master-bedroom'], type: 'door', transferRate: 0.10 },
      { zones: ['hallway', 'bedroom-2'], type: 'door', transferRate: 0.10 },
      { zones: ['hallway', 'bedroom-3'], type: 'door', transferRate: 0.10 },
      { zones: ['hallway', 'office'], type: 'door', transferRate: 0.10 },
      { zones: ['hallway', 'bathroom-main'], type: 'door', transferRate: 0.05 },
      { zones: ['hallway', 'bathroom-2'], type: 'door', transferRate: 0.05 }
    ];

    // Predictive maintenance
    this.maintenanceAlerts = [];
  }

  async initialize() {
    try {
      this.homey.log('[HVACZone] Initializing Smart HVAC Zone Control System...');

      this._initializeZones();
      this._initializeEquipment();
      this._initializeTRVValves();
      this._initializeUnderfloorHeating();
      this._initializeVentilation();
      this._initializeSchedules();
      this._initializeFilters();
      this._initializeClimateQuality();
      this._initializeHistoricalData();
      this._detectSeason();

      // Start monitoring intervals
      const zoneInterval = setInterval(() => this._monitorZones(), 30000);
      this.intervals.push(zoneInterval);

      const occupancyInterval = setInterval(() => this._processOccupancy(), 60000);
      this.intervals.push(occupancyInterval);

      const climateInterval = setInterval(() => this._assessClimateQuality(), 120000);
      this.intervals.push(climateInterval);

      const weatherInterval = setInterval(() => this._processWeatherCompensation(), 300000);
      this.intervals.push(weatherInterval);

      const energyInterval = setInterval(() => this._optimizeEnergy(), 180000);
      this.intervals.push(energyInterval);

      const costInterval = setInterval(() => this._trackCosts(), 600000);
      this.intervals.push(costInterval);

      const maintenanceInterval = setInterval(() => this._checkMaintenance(), 3600000);
      this.intervals.push(maintenanceInterval);

      const comfortInterval = setInterval(() => this._calculateComfortScores(), 120000);
      this.intervals.push(comfortInterval);

      const ventilationInterval = setInterval(() => this._manageVentilation(), 60000);
      this.intervals.push(ventilationInterval);

      const trvInterval = setInterval(() => this._manageTRVValves(), 60000);
      this.intervals.push(trvInterval);

      const underfloorInterval = setInterval(() => this._manageUnderfloorHeating(), 120000);
      this.intervals.push(underfloorInterval);

      const historyInterval = setInterval(() => this._recordHistoricalData(), 3600000);
      this.intervals.push(historyInterval);

      const seasonInterval = setInterval(() => this._detectSeason(), 86400000);
      this.intervals.push(seasonInterval);

      const dependencyInterval = setInterval(() => this._processZoneDependencies(), 120000);
      this.intervals.push(dependencyInterval);

      this.initialized = true;
      this.homey.log('[HVACZone] System initialized with ' + this.zones.size + ' zones and ' + this.equipment.size + ' equipment units');
      this.homey.emit('hvac-zone-initialized', { zones: this.zones.size, equipment: this.equipment.size });
    } catch (err) {
      this.homey.error('[HVACZone] Initialization error:', err.message);
      throw err;
    }
  }

  _initializeZones() {
    const zoneDefinitions = [
      { id: 'living-room', name: 'Living Room', area: 35, ceilingHeight: 2.7, targetTemp: 21.5, insulation: 'B', sunExposure: 'high' },
      { id: 'kitchen', name: 'Kitchen', area: 18, ceilingHeight: 2.7, targetTemp: 21.0, insulation: 'B', sunExposure: 'medium' },
      { id: 'master-bedroom', name: 'Master Bedroom', area: 22, ceilingHeight: 2.5, targetTemp: 20.0, insulation: 'A', sunExposure: 'medium' },
      { id: 'bedroom-2', name: 'Bedroom 2', area: 14, ceilingHeight: 2.5, targetTemp: 20.0, insulation: 'B', sunExposure: 'low' },
      { id: 'bedroom-3', name: 'Bedroom 3', area: 12, ceilingHeight: 2.5, targetTemp: 19.5, insulation: 'B', sunExposure: 'low' },
      { id: 'bathroom-main', name: 'Main Bathroom', area: 10, ceilingHeight: 2.4, targetTemp: 23.0, insulation: 'C', sunExposure: 'none' },
      { id: 'bathroom-2', name: 'Bathroom 2', area: 6, ceilingHeight: 2.4, targetTemp: 23.0, insulation: 'C', sunExposure: 'none' },
      { id: 'office', name: 'Office', area: 15, ceilingHeight: 2.5, targetTemp: 21.0, insulation: 'A', sunExposure: 'high' },
      { id: 'hallway', name: 'Hallway', area: 12, ceilingHeight: 2.7, targetTemp: 19.0, insulation: 'C', sunExposure: 'none' },
      { id: 'garage', name: 'Garage', area: 30, ceilingHeight: 3.0, targetTemp: 12.0, insulation: 'F', sunExposure: 'none' }
    ];

    for (const def of zoneDefinitions) {
      this.zones.set(def.id, {
        id: def.id,
        name: def.name,
        area: def.area,
        ceilingHeight: def.ceilingHeight,
        volume: def.area * def.ceilingHeight,
        currentTemp: def.targetTemp + (Math.random() * 2 - 1),
        targetTemp: def.targetTemp,
        humidity: 35 + Math.random() * 15,
        mode: def.id === 'garage' ? 'eco' : 'auto',
        fanSpeed: 'auto',
        ventPosition: 50,
        occupancy: { detected: false, count: 0 },
        lastOccupied: Date.now() - 3600000,
        windowOpen: false,
        doorOpen: false,
        sunExposure: def.sunExposure,
        insulation: def.insulation,
        co2Level: 400 + Math.floor(Math.random() * 200),
        setbackTemp: def.targetTemp - 3,
        setbackActive: false,
        boostMode: false,
        boostUntil: null
      });
    }
    this.homey.log('[HVACZone] Initialized ' + zoneDefinitions.length + ' zones');
  }

  _initializeEquipment() {
    const equipmentList = [
      {
        id: 'heat-pump-main', type: 'heat-pump', model: 'Nibe F2040', capacity: 12000,
        cop: 4.2, efficiency: 0.95, status: 'running', powerConsumption: 2857,
        runtimeHours: 12450, maintenanceDue: '2026-06-15', compressorHealth: 92,
        refrigerantLevel: 97, copDegradation: 0.03
      },
      {
        id: 'district-heating', type: 'district-heating', model: 'Vattenfall DH Connection', capacity: 20000,
        cop: 1.0, efficiency: 0.98, status: 'standby', powerConsumption: 0,
        runtimeHours: 8200, maintenanceDue: '2026-09-01', compressorHealth: null,
        refrigerantLevel: null, copDegradation: 0
      },
      {
        id: 'ac-living', type: 'ac-split', model: 'Mitsubishi MSZ-LN35VG', capacity: 3500,
        cop: 3.8, efficiency: 0.92, status: 'off', powerConsumption: 0,
        runtimeHours: 2100, maintenanceDue: '2026-04-20', compressorHealth: 98,
        refrigerantLevel: 99, copDegradation: 0.01, assignedZone: 'living-room'
      },
      {
        id: 'ac-master', type: 'ac-split', model: 'Mitsubishi MSZ-LN25VG', capacity: 2500,
        cop: 3.6, efficiency: 0.90, status: 'off', powerConsumption: 0,
        runtimeHours: 1650, maintenanceDue: '2026-04-20', compressorHealth: 97,
        refrigerantLevel: 98, copDegradation: 0.01, assignedZone: 'master-bedroom'
      },
      {
        id: 'erv-unit', type: 'erv', model: 'Systemair SAVE VTR 300', capacity: 300,
        cop: null, efficiency: 0.85, status: 'running', powerConsumption: 120,
        runtimeHours: 18500, maintenanceDue: '2026-03-10', compressorHealth: null,
        refrigerantLevel: null, copDegradation: 0, heatRecoveryEfficiency: 0.85
      }
    ];

    for (const eq of equipmentList) {
      this.equipment.set(eq.id, { ...eq });
    }
    this.homey.log('[HVACZone] Initialized ' + equipmentList.length + ' equipment units');
  }

  _initializeTRVValves() {
    const valveDefinitions = [
      { id: 'trv-living-1', zone: 'living-room', name: 'Living Room Radiator 1', battery: 87 },
      { id: 'trv-living-2', zone: 'living-room', name: 'Living Room Radiator 2', battery: 92 },
      { id: 'trv-kitchen', zone: 'kitchen', name: 'Kitchen Radiator', battery: 78 },
      { id: 'trv-master', zone: 'master-bedroom', name: 'Master Bedroom Radiator', battery: 95 },
      { id: 'trv-bed2', zone: 'bedroom-2', name: 'Bedroom 2 Radiator', battery: 81 },
      { id: 'trv-bed3', zone: 'bedroom-3', name: 'Bedroom 3 Radiator', battery: 88 },
      { id: 'trv-office', zone: 'office', name: 'Office Radiator', battery: 90 },
      { id: 'trv-hallway', zone: 'hallway', name: 'Hallway Radiator', battery: 73 }
    ];

    for (const valve of valveDefinitions) {
      this.trvValves.set(valve.id, {
        id: valve.id,
        zone: valve.zone,
        name: valve.name,
        battery: valve.battery,
        openPercent: 50,
        calibrated: true,
        lastCalibration: Date.now() - 86400000 * 30,
        windowOpenDetected: false,
        boostMode: false,
        boostUntil: null,
        frostProtection: false,
        targetTemp: 21.0,
        measuredTemp: 21.0 + (Math.random() * 0.6 - 0.3),
        motorSteps: 0,
        lastMotorRun: Date.now() - 600000
      });
    }
    this.homey.log('[HVACZone] Initialized ' + valveDefinitions.length + ' TRV valves');
  }

  _initializeUnderfloorHeating() {
    const ufhZones = [
      { id: 'ufh-bathroom', zone: 'bathroom-main', floorType: 'tile', warmupMinutes: 45, maxFloorTemp: 27 },
      { id: 'ufh-kitchen', zone: 'kitchen', floorType: 'tile', warmupMinutes: 45, maxFloorTemp: 27 },
      { id: 'ufh-hallway', zone: 'hallway', floorType: 'laminate', warmupMinutes: 25, maxFloorTemp: 27 }
    ];

    for (const ufh of ufhZones) {
      this.underfloorZones.set(ufh.id, {
        id: ufh.id,
        zone: ufh.zone,
        floorType: ufh.floorType,
        warmupMinutes: ufh.warmupMinutes,
        maxFloorTemp: ufh.maxFloorTemp,
        currentFloorTemp: 22.0 + Math.random() * 2,
        targetFloorTemp: 24.0,
        active: true,
        valveOpen: true,
        pumpRunning: true,
        preheatingScheduled: false,
        preheatingTime: null,
        thermalMassKJ: ufh.floorType === 'tile' ? 850 : ufh.floorType === 'wood' ? 520 : 380,
        lastStateChange: Date.now() - 1800000
      });
    }
    this.homey.log('[HVACZone] Initialized ' + ufhZones.length + ' underfloor heating zones');
  }

  _initializeVentilation() {
    this.ventilation = {
      id: 'erv-main',
      model: 'Systemair SAVE VTR 300',
      mode: 'auto',
      fanSpeedSupply: 45,
      fanSpeedExtract: 47,
      supplyTemp: 19.5,
      extractTemp: 21.2,
      outdoorTemp: 5.0,
      heatRecoveryEfficiency: 0.85,
      boostMode: false,
      boostUntil: null,
      nightReduction: false,
      nightReductionSchedule: { start: '23:00', end: '06:00', reduction: 30 },
      co2Driven: true,
      humidityDriven: true,
      airChangesPerHour: 0.5,
      freshAirCFMPerOccupant: 20,
      totalAirflow: 180,
      filterPressureDrop: 45,
      bypassActive: false,
      defrostActive: false
    };
    this.homey.log('[HVACZone] Ventilation system initialized');
  }

  _initializeSchedules() {
    const defaultSchedule = (targetWake, targetDay, targetEvening, targetSleep) => ({
      weekday: {
        wake: { start: '06:30', end: '08:00', targetTemp: targetWake },
        day: { start: '08:00', end: '17:00', targetTemp: targetDay },
        evening: { start: '17:00', end: '22:30', targetTemp: targetEvening },
        sleep: { start: '22:30', end: '06:30', targetTemp: targetSleep }
      },
      weekend: {
        wake: { start: '08:00', end: '10:00', targetTemp: targetWake },
        day: { start: '10:00', end: '18:00', targetTemp: targetDay },
        evening: { start: '18:00', end: '23:30', targetTemp: targetEvening },
        sleep: { start: '23:30', end: '08:00', targetTemp: targetSleep }
      }
    });

    this.schedules.set('living-room', defaultSchedule(21.0, 20.5, 21.5, 18.0));
    this.schedules.set('kitchen', defaultSchedule(21.0, 20.0, 21.0, 17.0));
    this.schedules.set('master-bedroom', defaultSchedule(20.5, 18.0, 20.0, 18.0));
    this.schedules.set('bedroom-2', defaultSchedule(20.0, 17.5, 20.0, 18.0));
    this.schedules.set('bedroom-3', defaultSchedule(20.0, 17.5, 19.5, 18.0));
    this.schedules.set('bathroom-main', defaultSchedule(23.0, 21.0, 23.0, 20.0));
    this.schedules.set('bathroom-2', defaultSchedule(23.0, 21.0, 22.0, 19.0));
    this.schedules.set('office', defaultSchedule(20.0, 21.0, 19.0, 16.0));
    this.schedules.set('hallway', defaultSchedule(19.0, 18.0, 19.0, 16.0));
    this.schedules.set('garage', defaultSchedule(10.0, 10.0, 10.0, 8.0));

    this.homey.log('[HVACZone] Schedules initialized for ' + this.schedules.size + ' zones');
  }

  _initializeFilters() {
    this.filters = [
      { id: 'filter-supply', name: 'Supply Air Filter (F7)', type: 'F7', installedDate: '2025-09-15', lifeMonths: 6, condition: 72, maxPressureDrop: 120, currentPressureDrop: 58 },
      { id: 'filter-extract', name: 'Extract Air Filter (M5)', type: 'M5', installedDate: '2025-09-15', lifeMonths: 6, condition: 78, maxPressureDrop: 100, currentPressureDrop: 42 },
      { id: 'filter-recirculation', name: 'Recirculation Filter (G4)', type: 'G4', installedDate: '2025-11-01', lifeMonths: 3, condition: 55, maxPressureDrop: 80, currentPressureDrop: 50 }
    ];
    this.homey.log('[HVACZone] Initialized ' + this.filters.length + ' filters');
  }

  _initializeClimateQuality() {
    for (const [zoneId] of this.zones) {
      this.climateQuality.set(zoneId, {
        temperature: { current: 0, accuracy: 0, withinTarget: false },
        humidity: { current: 0, target: { min: 30, max: 50 }, withinRange: false },
        co2: { current: 400, target: 800, acceptable: true },
        ach: { current: 0.5, target: 0.5, adequate: true },
        freshAirCFM: 0,
        draft: false,
        noise: 'low'
      });
    }
  }

  _initializeHistoricalData() {
    for (const [zoneId] of this.zones) {
      this.historicalData.temperatureLogs.set(zoneId, []);
      this.historicalData.energyConsumption.set(zoneId, []);
    }
    this.homey.log('[HVACZone] Historical data storage initialized');
  }

  _detectSeason() {
    const avgTemp = this.outdoorConditions.sevenDayAvgTemp;
    let newSeason = this.currentSeason;

    if (avgTemp < 5) {
      newSeason = 'winter-heating';
    } else if (avgTemp >= 5 && avgTemp < 15) {
      const month = new Date().getMonth() + 1;
      newSeason = (month >= 3 && month <= 5) ? 'transition-spring' : 'transition-autumn';
    } else if (avgTemp >= 20) {
      newSeason = 'summer-cooling';
    }

    if (newSeason !== this.currentSeason) {
      const oldSeason = this.currentSeason;
      this.currentSeason = newSeason;
      this.homey.log('[HVACZone] Season changed: ' + oldSeason + ' -> ' + newSeason);
      this.homey.emit('hvac-season-changed', { from: oldSeason, to: newSeason, avgTemp });
      this._applySeasonalSettings();
    }
  }

  _applySeasonalSettings() {
    const config = this.seasonalConfig[this.currentSeason];
    if (!config) return;

    for (const [, zone] of this.zones) {
      if (this.currentSeason === 'winter-heating') {
        if (zone.mode === 'cool') zone.mode = 'heat';
      } else if (this.currentSeason === 'summer-cooling') {
        if (zone.mode === 'heat' && zone.id !== 'garage') zone.mode = 'cool';
      }
    }

    const acLiving = this.equipment.get('ac-living');
    const acMaster = this.equipment.get('ac-master');
    if (config.acEnabled) {
      if (acLiving) acLiving.status = 'standby';
      if (acMaster) acMaster.status = 'standby';
    } else {
      if (acLiving) acLiving.status = 'off';
      if (acMaster) acMaster.status = 'off';
    }

    this.homey.log('[HVACZone] Seasonal settings applied for: ' + this.currentSeason);
  }

  _monitorZones() {
    try {
      for (const [zoneId, zone] of this.zones) {
        if (zone.mode === 'off') continue;

        const schedule = this._getCurrentScheduleTarget(zoneId);
        const effectiveTarget = this._getEffectiveTarget(zone, schedule);

        // Simulate temperature drift
        const tempDiff = effectiveTarget - zone.currentTemp;
        const driftRate = this._calculateDriftRate(zone);
        zone.currentTemp += tempDiff * driftRate;
        zone.currentTemp = Math.round(zone.currentTemp * 10) / 10;

        // Humidity simulation
        zone.humidity += (Math.random() * 2 - 1) * 0.3;
        zone.humidity = Math.max(20, Math.min(70, zone.humidity));
        zone.humidity = Math.round(zone.humidity * 10) / 10;

        // CO2 simulation
        if (zone.occupancy.detected) {
          zone.co2Level += zone.occupancy.count * 8;
        } else {
          zone.co2Level -= 15;
        }
        zone.co2Level = Math.max(380, Math.min(2000, zone.co2Level));

        // Check temperature deviation
        if (Math.abs(zone.currentTemp - effectiveTarget) > 2.0) {
          this.homey.emit('hvac-zone-deviation', {
            zoneId,
            currentTemp: zone.currentTemp,
            targetTemp: effectiveTarget,
            deviation: Math.round((zone.currentTemp - effectiveTarget) * 10) / 10
          });
        }

        // Window open detection
        if (zone.windowOpen && zone.mode !== 'off') {
          this._handleWindowOpen(zoneId, zone);
        }
      }
    } catch (err) {
      this.homey.error('[HVACZone] Zone monitoring error:', err.message);
    }
  }

  _calculateDriftRate(zone) {
    const insulationFactor = { A: 0.15, B: 0.12, C: 0.10, D: 0.08, E: 0.06, F: 0.04 };
    let rate = insulationFactor[zone.insulation] || 0.08;

    if (zone.windowOpen) rate *= 0.3;
    if (zone.doorOpen) rate *= 0.7;

    // Sun exposure bonus in heating mode
    if (zone.sunExposure === 'high' && this.outdoorConditions.solarIrradiance > 200) {
      rate *= 1.3;
    }
    return rate;
  }

  _getCurrentScheduleTarget(zoneId) {
    const schedule = this.schedules.get(zoneId);
    if (!schedule) return null;

    if (this.vacationMode) return 8.0;
    if (this.holidayMode) {
      const zone = this.zones.get(zoneId);
      return zone ? zone.targetTemp : 20.0;
    }

    const now = new Date();
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;
    const daySchedule = isWeekend ? schedule.weekend : schedule.weekday;
    const currentTime = now.getHours() * 60 + now.getMinutes();

    for (const period of Object.values(daySchedule)) {
      const [startH, startM] = period.start.split(':').map(Number);
      const [endH, endM] = period.end.split(':').map(Number);
      const startMin = startH * 60 + startM;
      const endMin = endH * 60 + endM;

      if (endMin > startMin) {
        if (currentTime >= startMin && currentTime < endMin) return period.targetTemp;
      } else {
        if (currentTime >= startMin || currentTime < endMin) return period.targetTemp;
      }
    }
    return null;
  }

  _getEffectiveTarget(zone, scheduleTarget) {
    let target = scheduleTarget !== null ? scheduleTarget : zone.targetTemp;

    if (this.vacationMode) {
      target = Math.max(8.0, target);
      return 8.0;
    }

    if (zone.setbackActive) {
      target = zone.setbackTemp;
    }

    if (zone.boostMode && zone.boostUntil && Date.now() < zone.boostUntil) {
      target += 2.0;
    } else if (zone.boostMode) {
      zone.boostMode = false;
      zone.boostUntil = null;
    }

    // Demand response reduction
    if (this.demandResponse.active) {
      target -= this.demandResponse.reductionPercent * 0.05;
    }

    // Frost protection
    target = Math.max(target, 5.0);

    return Math.round(target * 10) / 10;
  }

  _handleWindowOpen(zoneId, _zone) {
    // Reduce heating when window is open
    const trvs = this._getTRVsForZone(zoneId);
    for (const trv of trvs) {
      if (!trv.windowOpenDetected) {
        trv.windowOpenDetected = true;
        trv.openPercent = 0;
        this.homey.log('[HVACZone] Window open detected in ' + zoneId + ', closing TRV ' + trv.id);
        this.homey.emit('hvac-window-open-action', { zoneId, trvId: trv.id, action: 'closed-valve' });
      }
    }
  }

  _getTRVsForZone(zoneId) {
    const result = [];
    for (const [, trv] of this.trvValves) {
      if (trv.zone === zoneId) result.push(trv);
    }
    return result;
  }

  _processOccupancy() {
    try {
      for (const [zoneId, zone] of this.zones) {
        if (zone.mode === 'off') continue;

        const now = Date.now();
        const timeSinceOccupied = now - zone.lastOccupied;
        const thirtyMinutes = 30 * 60 * 1000;

        if (!zone.occupancy.detected && timeSinceOccupied > thirtyMinutes && !zone.setbackActive) {
          zone.setbackActive = true;
          this.homey.log('[HVACZone] Zone ' + zoneId + ' unoccupied >30min, activating setback');
          this.homey.emit('hvac-setback-activated', { zoneId, setbackTemp: zone.setbackTemp });
        }

        if (zone.occupancy.detected && zone.setbackActive) {
          zone.setbackActive = false;
          zone.lastOccupied = now;
          this.homey.log('[HVACZone] Zone ' + zoneId + ' occupied, resuming comfort temp');
          this.homey.emit('hvac-comfort-resumed', { zoneId, targetTemp: zone.targetTemp });
        }

        // Learn patterns
        if (zone.occupancy.detected) {
          this._recordOccupancyPattern(zoneId);
        }
      }

      // Predictive pre-heating
      this._predictivePreHeating();
    } catch (err) {
      this.homey.error('[HVACZone] Occupancy processing error:', err.message);
    }
  }

  _recordOccupancyPattern(zoneId) {
    const now = new Date();
    const hour = now.getHours();
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;
    const patternKey = isWeekend ? 'weekend' : 'weekday';

    if (!this.learnedPatterns[patternKey][zoneId]) {
      this.learnedPatterns[patternKey][zoneId] = new Array(24).fill(0);
    }
    this.learnedPatterns[patternKey][zoneId][hour] = Math.min(
      1.0,
      (this.learnedPatterns[patternKey][zoneId][hour] || 0) * 0.95 + 0.05
    );
  }

  _predictivePreHeating() {
    const now = new Date();
    const nextHour = (now.getHours() + 1) % 24;
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;
    const patternKey = isWeekend ? 'weekend' : 'weekday';

    for (const [zoneId, zone] of this.zones) {
      if (zone.mode === 'off' || zone.occupancy.detected) continue;

      const pattern = this.learnedPatterns[patternKey][zoneId];
      if (pattern && pattern[nextHour] > 0.6) {
        if (zone.setbackActive && zone.currentTemp < zone.targetTemp - 1.0) {
          zone.setbackActive = false;
          this.homey.log('[HVACZone] Predictive pre-heating for ' + zoneId + ' (expected occupancy at hour ' + nextHour + ')');
          this.homey.emit('hvac-predictive-preheat', { zoneId, expectedHour: nextHour });
        }
      }
    }
  }

  _assessClimateQuality() {
    try {
      for (const [zoneId, zone] of this.zones) {
        const quality = this.climateQuality.get(zoneId);
        if (!quality) continue;

        const scheduleTarget = this._getCurrentScheduleTarget(zoneId);
        const effectiveTarget = this._getEffectiveTarget(zone, scheduleTarget);

        quality.temperature.current = zone.currentTemp;
        quality.temperature.accuracy = Math.abs(zone.currentTemp - effectiveTarget);
        quality.temperature.withinTarget = quality.temperature.accuracy <= 0.5;

        quality.humidity.current = zone.humidity;
        quality.humidity.withinRange = zone.humidity >= 30 && zone.humidity <= 50;

        quality.co2.current = zone.co2Level;
        quality.co2.acceptable = zone.co2Level < 800;

        // Fresh air CFM per occupant
        if (zone.occupancy.detected && zone.occupancy.count > 0) {
          quality.freshAirCFM = this.ventilation.totalAirflow / zone.occupancy.count;
        } else {
          quality.freshAirCFM = this.ventilation.totalAirflow;
        }

        if (!quality.co2.acceptable) {
          this.homey.emit('hvac-co2-high', { zoneId, co2Level: zone.co2Level });
        }

        if (!quality.humidity.withinRange) {
          this.homey.emit('hvac-humidity-alert', {
            zoneId,
            humidity: zone.humidity,
            status: zone.humidity < 30 ? 'too-dry' : 'too-humid'
          });
        }
      }
    } catch (err) {
      this.homey.error('[HVACZone] Climate quality assessment error:', err.message);
    }
  }

  _processWeatherCompensation() {
    try {
      const outdoor = this.outdoorConditions;

      // Wind chill factor
      let windChillFactor = 0;
      if (outdoor.temperature < 10 && outdoor.windSpeed > 2) {
        windChillFactor = 13.12 + 0.6215 * outdoor.temperature
          - 11.37 * Math.pow(outdoor.windSpeed, 0.16)
          + 0.3965 * outdoor.temperature * Math.pow(outdoor.windSpeed, 0.16);
        windChillFactor = outdoor.temperature - windChillFactor;
      }

      // Solar gain compensation
      const solarGain = outdoor.solarIrradiance > 300;
      if (solarGain) {
        for (const [zoneId, zone] of this.zones) {
          if (zone.sunExposure === 'high') {
            const reduction = Math.min(1.5, outdoor.solarIrradiance / 500);
            zone.currentTemp += reduction * 0.1;
            this.homey.log('[HVACZone] Solar gain compensation in ' + zoneId + ': +' + (reduction * 0.1).toFixed(1) + '°C');
          }
        }
      }

      // Heating curve adjustment
      const heatPump = this.equipment.get('heat-pump-main');
      if (heatPump && heatPump.status === 'running') {
        const effectiveOutdoor = outdoor.temperature - windChillFactor;
        const heatingCurve = this._calculateHeatingCurve(effectiveOutdoor);
        this.homey.log('[HVACZone] Heating curve adjusted: outdoor=' + effectiveOutdoor.toFixed(1) + '°C, curve=' + heatingCurve.toFixed(1));
      }

      // Forecast-based pre-conditioning
      if (outdoor.forecast.length > 0) {
        this._forecastPreConditioning(outdoor.forecast);
      }

      // Update 7-day average
      this.historicalData.outdoorTempLog.push({ temp: outdoor.temperature, timestamp: Date.now() });
      const sevenDaysAgo = Date.now() - 7 * 86400000;
      this.historicalData.outdoorTempLog = this.historicalData.outdoorTempLog.filter(e => e.timestamp > sevenDaysAgo);
      if (this.historicalData.outdoorTempLog.length > 0) {
        outdoor.sevenDayAvgTemp = this.historicalData.outdoorTempLog.reduce((s, e) => s + e.temp, 0) / this.historicalData.outdoorTempLog.length;
        outdoor.sevenDayAvgTemp = Math.round(outdoor.sevenDayAvgTemp * 10) / 10;
      }
    } catch (err) {
      this.homey.error('[HVACZone] Weather compensation error:', err.message);
    }
  }

  _calculateHeatingCurve(outdoorTemp) {
    // Linear heating curve: at -20°C -> supply 55°C, at +15°C -> supply 25°C
    const slope = (55 - 25) / (-20 - 15);
    const supplyTemp = 25 + slope * (outdoorTemp - 15);
    return Math.max(25, Math.min(55, supplyTemp));
  }

  _forecastPreConditioning(forecast) {
    for (const entry of forecast) {
      if (entry.hoursAhead <= 6) {
        const tempDrop = this.outdoorConditions.temperature - entry.temperature;
        if (tempDrop > 5) {
          this.homey.log('[HVACZone] Forecast: significant temp drop expected (' + tempDrop.toFixed(1) + '°C in ' + entry.hoursAhead + 'h), pre-conditioning');
          this.homey.emit('hvac-forecast-precondition', { tempDrop, hoursAhead: entry.hoursAhead });
        }
      }
    }
  }

  _optimizeEnergy() {
    try {
      const now = new Date();
      const currentHour = now.getHours();

      // Demand response during peak hours
      const isPeakHour = this.costTracking.peakHours.includes(currentHour);
      if (isPeakHour && !this.demandResponse.active) {
        this.demandResponse.active = true;
        this.demandResponse.reductionPercent = 15;
        this.homey.log('[HVACZone] Peak hour demand response activated (' + currentHour + ':00)');
        this.homey.emit('hvac-demand-response', { active: true, reduction: 15 });
      } else if (!isPeakHour && this.demandResponse.active) {
        this.demandResponse.active = false;
        this.demandResponse.reductionPercent = 0;
        this.homey.log('[HVACZone] Peak hour demand response deactivated');
        this.homey.emit('hvac-demand-response', { active: false, reduction: 0 });
      }

      // Heat pump vs district heating cost comparison
      this._optimizeHeatSource();

      // Load balancing
      this._balanceLoad();
    } catch (err) {
      this.homey.error('[HVACZone] Energy optimization error:', err.message);
    }
  }

  _optimizeHeatSource() {
    const heatPump = this.equipment.get('heat-pump-main');
    const districtHeating = this.equipment.get('district-heating');
    if (!heatPump || !districtHeating) return;

    const hpCostPerKWh = this.costTracking.electricityPriceSEK / heatPump.cop;
    const dhCostPerKWh = this.costTracking.districtHeatingPriceSEK;

    const _switchPoint = dhCostPerKWh / this.costTracking.electricityPriceSEK * heatPump.cop;

    if (hpCostPerKWh > dhCostPerKWh && heatPump.status === 'running') {
      // District heating is cheaper
      heatPump.status = 'standby';
      districtHeating.status = 'running';
      this.homey.log('[HVACZone] Switched to district heating (HP cost: ' + hpCostPerKWh.toFixed(3) + ' SEK/kWh vs DH: ' + dhCostPerKWh.toFixed(3) + ' SEK/kWh)');
      this.homey.emit('hvac-heat-source-switch', { source: 'district-heating', reason: 'cost-optimization' });
    } else if (hpCostPerKWh <= dhCostPerKWh && districtHeating.status === 'running') {
      districtHeating.status = 'standby';
      heatPump.status = 'running';
      this.homey.log('[HVACZone] Switched to heat pump (cheaper at COP ' + heatPump.cop + ')');
      this.homey.emit('hvac-heat-source-switch', { source: 'heat-pump', reason: 'cost-optimization' });
    }
  }

  _balanceLoad() {
    let totalLoad = 0;
    for (const [, eq] of this.equipment) {
      if (eq.status === 'running') {
        totalLoad += eq.powerConsumption;
      }
    }
    this.loadBalancing.currentLoad = totalLoad;

    if (totalLoad > this.loadBalancing.maxSimultaneousPower) {
      this.homey.log('[HVACZone] Load balancing: current ' + totalLoad + 'W exceeds max ' + this.loadBalancing.maxSimultaneousPower + 'W');

      // Reduce lower priority equipment
      const acLiving = this.equipment.get('ac-living');
      const acMaster = this.equipment.get('ac-master');
      if (acLiving && acLiving.status === 'running') {
        acLiving.status = 'standby';
        totalLoad -= acLiving.powerConsumption;
        this.homey.emit('hvac-load-shed', { equipmentId: 'ac-living', reason: 'overload' });
      }
      if (totalLoad > this.loadBalancing.maxSimultaneousPower && acMaster && acMaster.status === 'running') {
        acMaster.status = 'standby';
        totalLoad -= acMaster.powerConsumption;
        this.homey.emit('hvac-load-shed', { equipmentId: 'ac-master', reason: 'overload' });
      }
      this.loadBalancing.currentLoad = totalLoad;
    }
  }

  _trackCosts() {
    try {
      const now = new Date();
      const monthKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

      if (!this.costTracking.monthlyCosts.has(monthKey)) {
        this.costTracking.monthlyCosts.set(monthKey, {
          totalSEK: 0,
          electricitySEK: 0,
          districtHeatingSEK: 0,
          perZone: {},
          costPerDegree: 0
        });
      }

      const monthly = this.costTracking.monthlyCosts.get(monthKey);
      const intervalHours = 600000 / 3600000; // 10 minutes in hours

      for (const [, eq] of this.equipment) {
        if (eq.status !== 'running') continue;
        const energyKWh = (eq.powerConsumption / 1000) * intervalHours;

        if (eq.type === 'district-heating') {
          monthly.districtHeatingSEK += energyKWh * this.costTracking.districtHeatingPriceSEK;
        } else {
          monthly.electricitySEK += energyKWh * this.costTracking.electricityPriceSEK;
        }
      }

      monthly.totalSEK = monthly.electricitySEK + monthly.districtHeatingSEK;

      // Cost per zone estimation
      for (const [zoneId, zone] of this.zones) {
        if (!monthly.perZone[zoneId]) monthly.perZone[zoneId] = 0;
        const zoneShare = zone.area / this._getTotalArea();
        monthly.perZone[zoneId] = monthly.totalSEK * zoneShare;
      }

      // Cost per degree
      const avgTarget = this._getAverageTargetTemp();
      const avgOutdoor = this.outdoorConditions.temperature;
      const deltaDegree = avgTarget - avgOutdoor;
      if (deltaDegree > 0) {
        monthly.costPerDegree = monthly.totalSEK / deltaDegree;
      }

      this.homey.emit('hvac-cost-update', {
        month: monthKey,
        totalSEK: Math.round(monthly.totalSEK * 100) / 100,
        electricitySEK: Math.round(monthly.electricitySEK * 100) / 100,
        districtHeatingSEK: Math.round(monthly.districtHeatingSEK * 100) / 100
      });
    } catch (err) {
      this.homey.error('[HVACZone] Cost tracking error:', err.message);
    }
  }

  _getTotalArea() {
    let total = 0;
    for (const [, zone] of this.zones) {
      total += zone.area;
    }
    return total;
  }

  _getAverageTargetTemp() {
    let sum = 0;
    let count = 0;
    for (const [, zone] of this.zones) {
      if (zone.mode !== 'off') {
        sum += zone.targetTemp;
        count++;
      }
    }
    return count > 0 ? sum / count : 20;
  }

  _calculateComfortScores() {
    try {
      for (const [zoneId, zone] of this.zones) {
        const quality = this.climateQuality.get(zoneId);
        if (!quality) continue;

        let score = 100;

        // Temperature accuracy (max -40 points)
        const tempDeviation = Math.abs(zone.currentTemp - zone.targetTemp);
        score -= Math.min(40, tempDeviation * 20);

        // Humidity (max -20 points)
        if (zone.humidity < 30) score -= Math.min(20, (30 - zone.humidity) * 2);
        else if (zone.humidity > 50) score -= Math.min(20, (zone.humidity - 50) * 2);

        // CO2 (max -20 points)
        if (zone.co2Level > 800) score -= Math.min(20, (zone.co2Level - 800) / 60);

        // Draft penalty (max -10 points)
        if (zone.windowOpen) score -= 10;

        // Noise penalty (max -10 points)
        if (quality.noise === 'medium') score -= 5;
        else if (quality.noise === 'high') score -= 10;

        score = Math.max(0, Math.min(100, Math.round(score)));
        this.comfortScores.set(zoneId, {
          score,
          factors: {
            temperature: Math.round(Math.max(0, 100 - tempDeviation * 50)),
            humidity: Math.round(Math.max(0, 100 - Math.abs(zone.humidity - 40) * 3.3)),
            co2: Math.round(Math.max(0, 100 - Math.max(0, zone.co2Level - 400) / 16)),
            draft: zone.windowOpen ? 0 : 100,
            noise: quality.noise === 'low' ? 100 : quality.noise === 'medium' ? 50 : 0
          },
          timestamp: Date.now()
        });
      }

      const avgScore = this._getHouseholdComfortAverage();
      this.homey.emit('hvac-comfort-update', { householdAverage: avgScore });

      if (avgScore < 60) {
        this.homey.log('[HVACZone] Low household comfort score: ' + avgScore);
        this.homey.emit('hvac-comfort-low', { score: avgScore });
      }
    } catch (err) {
      this.homey.error('[HVACZone] Comfort scoring error:', err.message);
    }
  }

  _getHouseholdComfortAverage() {
    let sum = 0;
    let count = 0;
    for (const [, cs] of this.comfortScores) {
      sum += cs.score;
      count++;
    }
    return count > 0 ? Math.round(sum / count) : 0;
  }

  _manageTRVValves() {
    try {
      for (const [trvId, trv] of this.trvValves) {
        const zone = this.zones.get(trv.zone);
        if (!zone) continue;

        // Window-open detection via rapid temp drop
        if (!trv.windowOpenDetected && !zone.windowOpen) {
          const tempDiff = trv.targetTemp - trv.measuredTemp;
          if (tempDiff > 3.0) {
            trv.windowOpenDetected = true;
            trv.openPercent = 0;
            zone.windowOpen = true;
            this.homey.log('[HVACZone] TRV ' + trvId + ' detected rapid temp drop, possible window open');
            this.homey.emit('hvac-trv-window-detected', { trvId, zone: trv.zone });
          }
        }

        // Restore after window closed
        if (trv.windowOpenDetected && !zone.windowOpen) {
          trv.windowOpenDetected = false;
          this.homey.log('[HVACZone] TRV ' + trvId + ' window closed, resuming normal operation');
        }

        // Boost mode management
        if (trv.boostMode && trv.boostUntil && Date.now() > trv.boostUntil) {
          trv.boostMode = false;
          trv.boostUntil = null;
          this.homey.log('[HVACZone] TRV ' + trvId + ' boost mode ended');
        }

        // Calculate valve position
        if (!trv.windowOpenDetected) {
          const schedTarget = this._getCurrentScheduleTarget(trv.zone);
          const effectiveTarget = this._getEffectiveTarget(zone, schedTarget);
          trv.targetTemp = effectiveTarget;

          const diff = effectiveTarget - trv.measuredTemp;
          if (trv.boostMode) {
            trv.openPercent = 100;
          } else if (diff > 1.0) {
            trv.openPercent = Math.min(100, 50 + diff * 25);
          } else if (diff > 0.2) {
            trv.openPercent = Math.min(80, 30 + diff * 30);
          } else if (diff < -0.5) {
            trv.openPercent = Math.max(0, 10 + diff * 20);
          } else {
            trv.openPercent = 40;
          }
          trv.openPercent = Math.round(Math.max(0, Math.min(100, trv.openPercent)));
        }

        // Frost protection
        if (trv.measuredTemp < 5.0 && !trv.frostProtection) {
          trv.frostProtection = true;
          trv.openPercent = 30;
          this.homey.log('[HVACZone] TRV ' + trvId + ' frost protection activated');
          this.homey.emit('hvac-trv-frost', { trvId, temp: trv.measuredTemp });
        } else if (trv.measuredTemp >= 7.0 && trv.frostProtection) {
          trv.frostProtection = false;
        }

        // Battery warning
        if (trv.battery < 15) {
          this.homey.emit('hvac-trv-battery-low', { trvId, battery: trv.battery, name: trv.name });
        }

        // Simulate temperature measurement drift
        trv.measuredTemp += (zone.currentTemp - trv.measuredTemp) * 0.1;
        trv.measuredTemp = Math.round(trv.measuredTemp * 10) / 10;
      }
    } catch (err) {
      this.homey.error('[HVACZone] TRV management error:', err.message);
    }
  }

  _manageUnderfloorHeating() {
    try {
      for (const [ufhId, ufh] of this.underfloorZones) {
        const zone = this.zones.get(ufh.zone);
        if (!zone) continue;

        // Safety: max floor temperature
        if (ufh.currentFloorTemp >= ufh.maxFloorTemp) {
          if (ufh.valveOpen) {
            ufh.valveOpen = false;
            this.homey.log('[HVACZone] UFH ' + ufhId + ' max temp reached (' + ufh.currentFloorTemp + '°C), valve closed');
            this.homey.emit('hvac-ufh-safety', { ufhId, temp: ufh.currentFloorTemp, maxTemp: ufh.maxFloorTemp });
          }
        }

        // Pre-heating schedule
        const schedule = this._getCurrentScheduleTarget(ufh.zone);
        if (schedule !== null && zone.currentTemp < schedule - 1.5) {
          if (!ufh.preheatingScheduled) {
            ufh.preheatingScheduled = true;
            ufh.preheatingTime = Date.now() + ufh.warmupMinutes * 60000;
            ufh.valveOpen = true;
            this.homey.log('[HVACZone] UFH ' + ufhId + ' pre-heating started (warmup: ' + ufh.warmupMinutes + 'min, floor: ' + ufh.floorType + ')');
          }
        }

        // Thermal mass simulation
        if (ufh.valveOpen && ufh.active) {
          const heatRate = ufh.floorType === 'tile' ? 0.02 : ufh.floorType === 'wood' ? 0.03 : 0.035;
          ufh.currentFloorTemp += heatRate;
        } else {
          const coolRate = 0.01;
          ufh.currentFloorTemp -= coolRate;
        }
        ufh.currentFloorTemp = Math.round(Math.max(15, Math.min(30, ufh.currentFloorTemp)) * 10) / 10;

        // Target control
        if (ufh.currentFloorTemp >= ufh.targetFloorTemp && ufh.valveOpen) {
          ufh.valveOpen = false;
          ufh.preheatingScheduled = false;
        } else if (ufh.currentFloorTemp < ufh.targetFloorTemp - 1.5 && !ufh.valveOpen && ufh.active) {
          ufh.valveOpen = true;
        }
      }
    } catch (err) {
      this.homey.error('[HVACZone] Underfloor heating management error:', err.message);
    }
  }

  _manageVentilation() {
    try {
      if (!this.ventilation) return;
      const v = this.ventilation;

      // CO2-driven ventilation
      let maxCO2 = 0;
      for (const [, zone] of this.zones) {
        if (zone.co2Level > maxCO2) maxCO2 = zone.co2Level;
      }

      if (v.co2Driven) {
        if (maxCO2 > 1200) {
          v.fanSpeedSupply = 80;
          v.fanSpeedExtract = 82;
          v.boostMode = true;
          this.homey.log('[HVACZone] Ventilation boost: high CO2 (' + maxCO2 + 'ppm)');
        } else if (maxCO2 > 800) {
          v.fanSpeedSupply = 60;
          v.fanSpeedExtract = 62;
          v.boostMode = false;
        } else {
          v.fanSpeedSupply = 40;
          v.fanSpeedExtract = 42;
          v.boostMode = false;
        }
      }

      // Humidity-driven ventilation
      if (v.humidityDriven) {
        let maxHumidity = 0;
        for (const [, zone] of this.zones) {
          if (zone.humidity > maxHumidity) maxHumidity = zone.humidity;
        }
        if (maxHumidity > 60) {
          v.fanSpeedSupply = Math.max(v.fanSpeedSupply, 70);
          v.fanSpeedExtract = Math.max(v.fanSpeedExtract, 72);
          this.homey.log('[HVACZone] Ventilation boost: high humidity (' + maxHumidity.toFixed(1) + '%)');
        }
      }

      // Night reduction
      const now = new Date();
      const currentHour = now.getHours();
      const nightStart = parseInt(v.nightReductionSchedule.start.split(':')[0], 10);
      const nightEnd = parseInt(v.nightReductionSchedule.end.split(':')[0], 10);
      const isNight = currentHour >= nightStart || currentHour < nightEnd;

      if (isNight && !v.nightReduction) {
        v.nightReduction = true;
        v.fanSpeedSupply = Math.max(25, v.fanSpeedSupply - v.nightReductionSchedule.reduction);
        v.fanSpeedExtract = Math.max(27, v.fanSpeedExtract - v.nightReductionSchedule.reduction);
        this.homey.log('[HVACZone] Ventilation night reduction active');
      } else if (!isNight && v.nightReduction) {
        v.nightReduction = false;
        this.homey.log('[HVACZone] Ventilation night reduction ended');
      }

      // Bypass mode (free cooling when outdoor < indoor and cooling needed)
      if (this.currentSeason === 'summer-cooling') {
        const avgIndoor = this._getAverageTargetTemp();
        if (this.outdoorConditions.temperature < avgIndoor - 2 && this.outdoorConditions.temperature > 15) {
          v.bypassActive = true;
        } else {
          v.bypassActive = false;
        }
      } else {
        v.bypassActive = false;
      }

      // Defrost mode (outdoor temp < -5°C)
      if (this.outdoorConditions.temperature < -5) {
        v.defrostActive = true;
        v.fanSpeedSupply = Math.max(20, v.fanSpeedSupply - 20);
      } else {
        v.defrostActive = false;
      }

      // Update air changes and supply temp
      v.totalAirflow = v.fanSpeedSupply * 4;
      const totalVolume = this._getTotalVolume();
      v.airChangesPerHour = totalVolume > 0 ? (v.totalAirflow * 60 / totalVolume) : 0.5;
      v.airChangesPerHour = Math.round(v.airChangesPerHour * 100) / 100;

      // Supply temperature with heat recovery
      if (!v.bypassActive) {
        v.supplyTemp = this.outdoorConditions.temperature +
          (v.extractTemp - this.outdoorConditions.temperature) * v.heatRecoveryEfficiency;
        v.supplyTemp = Math.round(v.supplyTemp * 10) / 10;
      } else {
        v.supplyTemp = this.outdoorConditions.temperature;
      }

      // Update ERV equipment power
      const erv = this.equipment.get('erv-unit');
      if (erv) {
        erv.powerConsumption = Math.round(40 + (v.fanSpeedSupply / 100) * 180);
      }

      // Filter pressure monitoring
      for (const filter of this.filters) {
        if (filter.currentPressureDrop > filter.maxPressureDrop * 0.85) {
          this.homey.emit('hvac-filter-warning', {
            filterId: filter.id,
            name: filter.name,
            condition: filter.condition,
            pressureDrop: filter.currentPressureDrop
          });
        }
      }
    } catch (err) {
      this.homey.error('[HVACZone] Ventilation management error:', err.message);
    }
  }

  _getTotalVolume() {
    let total = 0;
    for (const [, zone] of this.zones) {
      total += zone.volume || (zone.area * zone.ceilingHeight);
    }
    return total;
  }

  _checkMaintenance() {
    try {
      this.maintenanceAlerts = [];
      const now = Date.now();

      for (const [eqId, eq] of this.equipment) {
        // Runtime hours check
        if (eq.runtimeHours > 15000 && eq.type === 'heat-pump') {
          this.maintenanceAlerts.push({
            equipmentId: eqId,
            type: 'runtime-high',
            message: eq.model + ' has ' + eq.runtimeHours + ' runtime hours',
            priority: 'medium'
          });
        }

        // Maintenance due date
        if (eq.maintenanceDue) {
          const dueDate = new Date(eq.maintenanceDue).getTime();
          const daysUntilDue = (dueDate - now) / 86400000;
          if (daysUntilDue < 30 && daysUntilDue > 0) {
            this.maintenanceAlerts.push({
              equipmentId: eqId,
              type: 'maintenance-due-soon',
              message: eq.model + ' maintenance due in ' + Math.round(daysUntilDue) + ' days',
              priority: 'low'
            });
          } else if (daysUntilDue <= 0) {
            this.maintenanceAlerts.push({
              equipmentId: eqId,
              type: 'maintenance-overdue',
              message: eq.model + ' maintenance overdue!',
              priority: 'high'
            });
          }
        }

        // COP degradation
        if (eq.copDegradation > 0.1) {
          this.maintenanceAlerts.push({
            equipmentId: eqId,
            type: 'cop-degradation',
            message: eq.model + ' COP degradation: ' + (eq.copDegradation * 100).toFixed(1) + '%',
            priority: 'medium'
          });
        }

        // Compressor health
        if (eq.compressorHealth !== null && eq.compressorHealth < 80) {
          this.maintenanceAlerts.push({
            equipmentId: eqId,
            type: 'compressor-health',
            message: eq.model + ' compressor health: ' + eq.compressorHealth + '%',
            priority: 'high'
          });
        }

        // Refrigerant level
        if (eq.refrigerantLevel !== null && eq.refrigerantLevel < 90) {
          this.maintenanceAlerts.push({
            equipmentId: eqId,
            type: 'refrigerant-low',
            message: eq.model + ' refrigerant level: ' + eq.refrigerantLevel + '%',
            priority: 'high'
          });
        }

        // Update runtime hours
        if (eq.status === 'running') {
          eq.runtimeHours += 1;
        }
      }

      // Filter life check
      for (const filter of this.filters) {
        if (filter.condition < 20) {
          this.maintenanceAlerts.push({
            equipmentId: filter.id,
            type: 'filter-replace',
            message: filter.name + ' condition: ' + filter.condition + '% - replacement needed',
            priority: 'high'
          });
        } else if (filter.condition < 40) {
          this.maintenanceAlerts.push({
            equipmentId: filter.id,
            type: 'filter-low',
            message: filter.name + ' condition: ' + filter.condition + '%',
            priority: 'medium'
          });
        }
        // Degrade filter condition over time
        filter.condition = Math.max(0, filter.condition - 0.1);
        filter.currentPressureDrop += 0.05;
      }

      // TRV battery check
      for (const [trvId, trv] of this.trvValves) {
        if (trv.battery < 10) {
          this.maintenanceAlerts.push({
            equipmentId: trvId,
            type: 'battery-critical',
            message: trv.name + ' battery critical: ' + trv.battery + '%',
            priority: 'high'
          });
        }
        // Simulate slow battery drain
        trv.battery = Math.max(0, trv.battery - 0.01);
      }

      if (this.maintenanceAlerts.length > 0) {
        const highPriority = this.maintenanceAlerts.filter(a => a.priority === 'high');
        if (highPriority.length > 0) {
          this.homey.log('[HVACZone] ' + highPriority.length + ' high priority maintenance alerts');
          this.homey.emit('hvac-maintenance-alert', { alerts: highPriority });
        }
      }
    } catch (err) {
      this.homey.error('[HVACZone] Maintenance check error:', err.message);
    }
  }

  _processZoneDependencies() {
    try {
      for (const dep of this.zoneDependencies) {
        const zone1 = this.zones.get(dep.zones[0]);
        const zone2 = this.zones.get(dep.zones[1]);
        if (!zone1 || !zone2) continue;

        let transferActive = false;
        let transferRate = dep.transferRate;

        if (dep.type === 'open-plan') {
          transferActive = true;
        } else if (dep.type === 'door') {
          transferActive = zone1.doorOpen || zone2.doorOpen;
          if (!transferActive) transferRate *= 0.1;
          else transferActive = true;
        } else if (dep.type === 'stairwell') {
          transferActive = true;
          // Stack effect: warm air rises
          if (zone1.currentTemp > zone2.currentTemp) {
            transferRate *= 1.2;
          }
        }

        if (transferActive) {
          const tempDiff = zone1.currentTemp - zone2.currentTemp;
          const transfer = tempDiff * transferRate * 0.01;
          zone1.currentTemp -= transfer;
          zone2.currentTemp += transfer;
          zone1.currentTemp = Math.round(zone1.currentTemp * 10) / 10;
          zone2.currentTemp = Math.round(zone2.currentTemp * 10) / 10;
        }
      }
    } catch (err) {
      this.homey.error('[HVACZone] Zone dependency processing error:', err.message);
    }
  }

  _recordHistoricalData() {
    try {
      const now = Date.now();
      const thirtyDaysAgo = now - 30 * 86400000;

      for (const [zoneId, zone] of this.zones) {
        const tempLog = this.historicalData.temperatureLogs.get(zoneId);
        if (tempLog) {
          tempLog.push({
            timestamp: now,
            temperature: zone.currentTemp,
            targetTemp: zone.targetTemp,
            humidity: zone.humidity,
            co2: zone.co2Level,
            occupancy: zone.occupancy.detected
          });
          // Trim to 30 days
          while (tempLog.length > 0 && tempLog[0].timestamp < thirtyDaysAgo) {
            tempLog.shift();
          }
        }

        const energyLog = this.historicalData.energyConsumption.get(zoneId);
        if (energyLog) {
          const zoneShare = zone.area / this._getTotalArea();
          let totalPower = 0;
          for (const [, eq] of this.equipment) {
            if (eq.status === 'running') totalPower += eq.powerConsumption;
          }
          energyLog.push({
            timestamp: now,
            energyWh: totalPower * zoneShare,
            outdoorTemp: this.outdoorConditions.temperature
          });
          while (energyLog.length > 0 && energyLog[0].timestamp < thirtyDaysAgo) {
            energyLog.shift();
          }
        }
      }

      this.homey.log('[HVACZone] Historical data recorded for all zones');
    } catch (err) {
      this.homey.error('[HVACZone] Historical data recording error:', err.message);
    }
  }

  // === Public API Methods ===

  setZoneTarget(zoneId, targetTemp) {
    const zone = this.zones.get(zoneId);
    if (!zone) {
      this.homey.error('[HVACZone] Zone not found: ' + zoneId);
      return false;
    }
    if (targetTemp < 5 || targetTemp > 30) {
      this.homey.error('[HVACZone] Target temp out of range (5-30°C): ' + targetTemp);
      return false;
    }
    zone.targetTemp = targetTemp;
    this.homey.log('[HVACZone] Zone ' + zoneId + ' target set to ' + targetTemp + '°C');
    this.homey.emit('hvac-target-changed', { zoneId, targetTemp });
    return true;
  }

  setZoneMode(zoneId, mode) {
    const validModes = ['heat', 'cool', 'auto', 'off', 'eco'];
    if (!validModes.includes(mode)) {
      this.homey.error('[HVACZone] Invalid mode: ' + mode);
      return false;
    }
    const zone = this.zones.get(zoneId);
    if (!zone) {
      this.homey.error('[HVACZone] Zone not found: ' + zoneId);
      return false;
    }
    zone.mode = mode;
    this.homey.log('[HVACZone] Zone ' + zoneId + ' mode set to ' + mode);
    this.homey.emit('hvac-mode-changed', { zoneId, mode });
    return true;
  }

  setZoneFanSpeed(zoneId, speed) {
    const validSpeeds = ['auto', 'low', 'medium', 'high'];
    if (!validSpeeds.includes(speed)) return false;
    const zone = this.zones.get(zoneId);
    if (!zone) return false;
    zone.fanSpeed = speed;
    this.homey.log('[HVACZone] Zone ' + zoneId + ' fan speed set to ' + speed);
    return true;
  }

  boostZone(zoneId, durationMinutes) {
    const zone = this.zones.get(zoneId);
    if (!zone) return false;
    const dur = durationMinutes || 30;
    zone.boostMode = true;
    zone.boostUntil = Date.now() + dur * 60000;
    this.homey.log('[HVACZone] Zone ' + zoneId + ' boost mode for ' + dur + ' minutes');
    this.homey.emit('hvac-boost-activated', { zoneId, durationMinutes: dur });

    // Also boost associated TRVs
    const trvs = this._getTRVsForZone(zoneId);
    for (const trv of trvs) {
      trv.boostMode = true;
      trv.boostUntil = zone.boostUntil;
      trv.openPercent = 100;
    }
    return true;
  }

  setVacationMode(enabled, frostProtectionTemp) {
    this.vacationMode = enabled;
    const frostTemp = frostProtectionTemp || 8;
    if (enabled) {
      for (const [, zone] of this.zones) {
        zone.targetTemp = Math.max(frostTemp, zone.targetTemp);
      }
      this.homey.log('[HVACZone] Vacation mode enabled (frost protection: ' + frostTemp + '°C)');
    } else {
      this.homey.log('[HVACZone] Vacation mode disabled');
    }
    this.homey.emit('hvac-vacation-mode', { enabled, frostProtectionTemp: frostTemp });
    return true;
  }

  setHolidayMode(enabled) {
    this.holidayMode = enabled;
    this.homey.log('[HVACZone] Holiday mode ' + (enabled ? 'enabled' : 'disabled'));
    this.homey.emit('hvac-holiday-mode', { enabled });
    return true;
  }

  updateOccupancy(zoneId, detected, count) {
    const zone = this.zones.get(zoneId);
    if (!zone) return false;
    zone.occupancy.detected = detected;
    zone.occupancy.count = count || 0;
    if (detected) zone.lastOccupied = Date.now();
    return true;
  }

  updateWindowStatus(zoneId, isOpen) {
    const zone = this.zones.get(zoneId);
    if (!zone) return false;
    zone.windowOpen = isOpen;
    if (!isOpen) {
      const trvs = this._getTRVsForZone(zoneId);
      for (const trv of trvs) {
        trv.windowOpenDetected = false;
      }
    }
    this.homey.log('[HVACZone] Zone ' + zoneId + ' window ' + (isOpen ? 'opened' : 'closed'));
    return true;
  }

  updateDoorStatus(zoneId, isOpen) {
    const zone = this.zones.get(zoneId);
    if (!zone) return false;
    zone.doorOpen = isOpen;
    return true;
  }

  updateOutdoorConditions(conditions) {
    if (conditions.temperature !== undefined) this.outdoorConditions.temperature = conditions.temperature;
    if (conditions.humidity !== undefined) this.outdoorConditions.humidity = conditions.humidity;
    if (conditions.windSpeed !== undefined) this.outdoorConditions.windSpeed = conditions.windSpeed;
    if (conditions.windDirection !== undefined) this.outdoorConditions.windDirection = conditions.windDirection;
    if (conditions.solarIrradiance !== undefined) this.outdoorConditions.solarIrradiance = conditions.solarIrradiance;
    if (conditions.forecast) this.outdoorConditions.forecast = conditions.forecast;
    return true;
  }

  setVentilationBoost(enabled, durationMinutes) {
    if (!this.ventilation) return false;
    if (enabled) {
      this.ventilation.boostMode = true;
      this.ventilation.boostUntil = Date.now() + (durationMinutes || 30) * 60000;
      this.ventilation.fanSpeedSupply = 85;
      this.ventilation.fanSpeedExtract = 87;
      this.homey.log('[HVACZone] Ventilation boost activated for ' + (durationMinutes || 30) + ' min');
    } else {
      this.ventilation.boostMode = false;
      this.ventilation.boostUntil = null;
      this.homey.log('[HVACZone] Ventilation boost deactivated');
    }
    this.homey.emit('hvac-ventilation-boost', { enabled });
    return true;
  }

  updateElectricityPrice(priceSEK) {
    this.costTracking.electricityPriceSEK = priceSEK;
    this.homey.log('[HVACZone] Electricity price updated: ' + priceSEK + ' SEK/kWh');
    return true;
  }

  getZoneStatus(zoneId) {
    const zone = this.zones.get(zoneId);
    if (!zone) return null;
    const comfort = this.comfortScores.get(zoneId);
    const quality = this.climateQuality.get(zoneId);
    const trvs = this._getTRVsForZone(zoneId);
    return {
      ...zone,
      comfortScore: comfort ? comfort.score : null,
      comfortFactors: comfort ? comfort.factors : null,
      climateQuality: quality || null,
      trvValves: trvs.map(t => ({ id: t.id, openPercent: t.openPercent, battery: t.battery, measuredTemp: t.measuredTemp })),
      schedule: this.schedules.get(zoneId) || null
    };
  }

  getAllZonesStatus() {
    const result = {};
    for (const [zoneId] of this.zones) {
      result[zoneId] = this.getZoneStatus(zoneId);
    }
    return result;
  }

  getEquipmentStatus() {
    const result = {};
    for (const [eqId, eq] of this.equipment) {
      result[eqId] = { ...eq };
    }
    return result;
  }

  getVentilationStatus() {
    if (!this.ventilation) return null;
    return {
      ...this.ventilation,
      filters: this.filters.map(f => ({
        id: f.id,
        name: f.name,
        condition: Math.round(f.condition),
        pressureDrop: Math.round(f.currentPressureDrop)
      }))
    };
  }

  getCostReport() {
    const monthlyArr = [];
    for (const [month, data] of this.costTracking.monthlyCosts) {
      monthlyArr.push({
        month,
        totalSEK: Math.round(data.totalSEK * 100) / 100,
        electricitySEK: Math.round(data.electricitySEK * 100) / 100,
        districtHeatingSEK: Math.round(data.districtHeatingSEK * 100) / 100,
        costPerDegree: Math.round(data.costPerDegree * 100) / 100,
        perZone: data.perZone
      });
    }
    return {
      currentElectricityPrice: this.costTracking.electricityPriceSEK,
      currentDistrictHeatingPrice: this.costTracking.districtHeatingPriceSEK,
      demandResponseActive: this.demandResponse.active,
      currentLoad: this.loadBalancing.currentLoad,
      monthlyCosts: monthlyArr,
      savingsFromOptimization: this.costTracking.savingsFromOptimization
    };
  }

  getComfortReport() {
    const zones = {};
    for (const [zoneId, cs] of this.comfortScores) {
      zones[zoneId] = {
        score: cs.score,
        factors: cs.factors,
        timestamp: cs.timestamp
      };
    }
    return {
      householdAverage: this._getHouseholdComfortAverage(),
      zones,
      season: this.currentSeason
    };
  }

  getMaintenanceReport() {
    return {
      alerts: this.maintenanceAlerts,
      equipment: Array.from(this.equipment.values()).map(eq => ({
        id: eq.id,
        model: eq.model,
        runtimeHours: eq.runtimeHours,
        maintenanceDue: eq.maintenanceDue,
        compressorHealth: eq.compressorHealth,
        refrigerantLevel: eq.refrigerantLevel,
        copDegradation: eq.copDegradation
      })),
      filters: this.filters.map(f => ({
        id: f.id,
        name: f.name,
        condition: Math.round(f.condition),
        installedDate: f.installedDate,
        lifeMonths: f.lifeMonths
      })),
      trvBatteries: Array.from(this.trvValves.values()).map(t => ({
        id: t.id,
        name: t.name,
        battery: Math.round(t.battery)
      }))
    };
  }

  getDashboard() {
    const zoneMap = {};
    for (const [zoneId, zone] of this.zones) {
      const comfort = this.comfortScores.get(zoneId);
      zoneMap[zoneId] = {
        name: zone.name,
        currentTemp: zone.currentTemp,
        targetTemp: zone.targetTemp,
        humidity: Math.round(zone.humidity),
        co2: zone.co2Level,
        mode: zone.mode,
        occupancy: zone.occupancy,
        comfortScore: comfort ? comfort.score : null,
        windowOpen: zone.windowOpen,
        doorOpen: zone.doorOpen
      };
    }

    const equipmentStatus = {};
    for (const [eqId, eq] of this.equipment) {
      equipmentStatus[eqId] = {
        model: eq.model,
        status: eq.status,
        powerConsumption: eq.powerConsumption,
        type: eq.type
      };
    }

    const energyFlow = {
      totalPowerW: this.loadBalancing.currentLoad,
      maxPowerW: this.loadBalancing.maxSimultaneousPower,
      loadPercent: Math.round((this.loadBalancing.currentLoad / this.loadBalancing.maxSimultaneousPower) * 100),
      heatSource: this.equipment.get('heat-pump-main')?.status === 'running' ? 'heat-pump' : 'district-heating',
      demandResponse: this.demandResponse.active
    };

    return {
      zones: zoneMap,
      equipment: equipmentStatus,
      energyFlow,
      ventilation: this.ventilation ? {
        mode: this.ventilation.mode,
        fanSpeed: this.ventilation.fanSpeedSupply,
        boostActive: this.ventilation.boostMode,
        ach: this.ventilation.airChangesPerHour,
        supplyTemp: this.ventilation.supplyTemp
      } : null,
      comfortAverage: this._getHouseholdComfortAverage(),
      season: this.currentSeason,
      outdoor: {
        temperature: this.outdoorConditions.temperature,
        humidity: this.outdoorConditions.humidity,
        wind: this.outdoorConditions.windSpeed,
        solar: this.outdoorConditions.solarIrradiance
      },
      vacationMode: this.vacationMode,
      holidayMode: this.holidayMode,
      maintenanceAlerts: this.maintenanceAlerts.filter(a => a.priority === 'high').length,
      timestamp: Date.now()
    };
  }

  getHistoricalData(zoneId, hours) {
    const h = hours || 24;
    const cutoff = Date.now() - h * 3600000;
    const tempLog = this.historicalData.temperatureLogs.get(zoneId);
    const energyLog = this.historicalData.energyConsumption.get(zoneId);

    return {
      zoneId,
      hours: h,
      temperatureLog: tempLog ? tempLog.filter(e => e.timestamp > cutoff) : [],
      energyLog: energyLog ? energyLog.filter(e => e.timestamp > cutoff) : [],
      outdoorTempLog: this.historicalData.outdoorTempLog.filter(e => e.timestamp > cutoff)
    };
  }

  getUnderfloorStatus() {
    const result = {};
    for (const [ufhId, ufh] of this.underfloorZones) {
      result[ufhId] = {
        id: ufh.id,
        zone: ufh.zone,
        floorType: ufh.floorType,
        currentFloorTemp: ufh.currentFloorTemp,
        targetFloorTemp: ufh.targetFloorTemp,
        maxFloorTemp: ufh.maxFloorTemp,
        warmupMinutes: ufh.warmupMinutes,
        valveOpen: ufh.valveOpen,
        pumpRunning: ufh.pumpRunning,
        active: ufh.active,
        preheatingScheduled: ufh.preheatingScheduled
      };
    }
    return result;
  }

  getTRVStatus() {
    const result = {};
    for (const [trvId, trv] of this.trvValves) {
      result[trvId] = {
        id: trv.id,
        zone: trv.zone,
        name: trv.name,
        battery: Math.round(trv.battery),
        openPercent: trv.openPercent,
        measuredTemp: trv.measuredTemp,
        targetTemp: trv.targetTemp,
        windowOpenDetected: trv.windowOpenDetected,
        boostMode: trv.boostMode,
        frostProtection: trv.frostProtection,
        calibrated: trv.calibrated
      };
    }
    return result;
  }

  getStatistics() {
    const activeZones = Array.from(this.zones.values()).filter(z => z.mode !== 'off').length;
    const runningEquipment = Array.from(this.equipment.values()).filter(e => e.status === 'running').length;
    const avgTemp = this._getAverageTargetTemp();
    const avgComfort = this._getHouseholdComfortAverage();
    const highAlerts = this.maintenanceAlerts.filter(a => a.priority === 'high').length;

    return {
      initialized: this.initialized,
      totalZones: this.zones.size,
      activeZones,
      totalEquipment: this.equipment.size,
      runningEquipment,
      trvValves: this.trvValves.size,
      underfloorZones: this.underfloorZones.size,
      averageTargetTemp: Math.round(avgTemp * 10) / 10,
      averageComfortScore: avgComfort,
      currentSeason: this.currentSeason,
      vacationMode: this.vacationMode,
      holidayMode: this.holidayMode,
      demandResponseActive: this.demandResponse.active,
      currentLoadW: this.loadBalancing.currentLoad,
      maxLoadW: this.loadBalancing.maxSimultaneousPower,
      outdoorTemp: this.outdoorConditions.temperature,
      outdoorHumidity: this.outdoorConditions.humidity,
      sevenDayAvgTemp: this.outdoorConditions.sevenDayAvgTemp,
      ventilationACH: this.ventilation ? this.ventilation.airChangesPerHour : 0,
      ventilationBoost: this.ventilation ? this.ventilation.boostMode : false,
      maintenanceAlertsHigh: highAlerts,
      maintenanceAlertsTotal: this.maintenanceAlerts.length,
      filtersCount: this.filters.length,
      intervalsRunning: this.intervals.length,
      costTrackingMonths: this.costTracking.monthlyCosts.size,
      electricityPriceSEK: this.costTracking.electricityPriceSEK,
      districtHeatingPriceSEK: this.costTracking.districtHeatingPriceSEK
    };
  }

  destroy() {
    for (const i of this.intervals) {
      clearInterval(i);
    }
    this.intervals = [];
    this.zones.clear();
    this.equipment.clear();
    this.trvValves.clear();
    this.underfloorZones.clear();
    this.comfortScores.clear();
    this.climateQuality.clear();
    this.schedules.clear();
    this.historicalData.temperatureLogs.clear();
    this.historicalData.energyConsumption.clear();
    this.maintenanceAlerts = [];
    this.initialized = false;
    this.homey.log('[HVACZone] destroyed');
  }
}

module.exports = SmartHVACZoneControlSystem;
