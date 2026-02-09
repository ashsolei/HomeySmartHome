'use strict';

const EventEmitter = require('events');

class SmartIrrigationWaterConservationSystem extends EventEmitter {
  constructor(homey) {
    super();
    this.homey = homey;
    this.initialized = false;
    this.intervals = [];

    // 8 Irrigation Zones
    this.zones = [
      {
        id: 'lawn',
        name: 'Front & Back Lawn',
        type: 'lawn',
        area: 120,
        soilType: 'loam',
        moistureLevel: 45,
        moistureThreshold: 30,
        lastWatered: null,
        nextScheduled: null,
        waterUsageLiters: 0,
        sprinklerHeads: 6,
        dripEmitters: 0,
        enabled: true,
        flowRateLPM: 12,
        dailyUsageHistory: [],
        weeklyUsageHistory: [],
        monthlyUsageHistory: [],
        efficiency: 100,
        status: 'idle'
      },
      {
        id: 'garden-beds',
        name: 'Raised Garden Beds',
        type: 'garden-beds',
        area: 35,
        soilType: 'peat',
        moistureLevel: 52,
        moistureThreshold: 40,
        lastWatered: null,
        nextScheduled: null,
        waterUsageLiters: 0,
        sprinklerHeads: 0,
        dripEmitters: 24,
        enabled: true,
        flowRateLPM: 4,
        dailyUsageHistory: [],
        weeklyUsageHistory: [],
        monthlyUsageHistory: [],
        efficiency: 100,
        status: 'idle'
      },
      {
        id: 'trees',
        name: 'Fruit & Ornamental Trees',
        type: 'trees',
        area: 80,
        soilType: 'clay',
        moistureLevel: 40,
        moistureThreshold: 35,
        lastWatered: null,
        nextScheduled: null,
        waterUsageLiters: 0,
        sprinklerHeads: 0,
        dripEmitters: 16,
        enabled: true,
        flowRateLPM: 6,
        dailyUsageHistory: [],
        weeklyUsageHistory: [],
        monthlyUsageHistory: [],
        efficiency: 100,
        status: 'idle'
      },
      {
        id: 'hedges',
        name: 'Perimeter Hedges',
        type: 'hedges',
        area: 45,
        soilType: 'loam',
        moistureLevel: 38,
        moistureThreshold: 30,
        lastWatered: null,
        nextScheduled: null,
        waterUsageLiters: 0,
        sprinklerHeads: 4,
        dripEmitters: 0,
        enabled: true,
        flowRateLPM: 8,
        dailyUsageHistory: [],
        weeklyUsageHistory: [],
        monthlyUsageHistory: [],
        efficiency: 100,
        status: 'idle'
      },
      {
        id: 'greenhouse',
        name: 'Greenhouse',
        type: 'greenhouse',
        area: 20,
        soilType: 'peat',
        moistureLevel: 55,
        moistureThreshold: 40,
        lastWatered: null,
        nextScheduled: null,
        waterUsageLiters: 0,
        sprinklerHeads: 0,
        dripEmitters: 30,
        enabled: true,
        flowRateLPM: 3,
        dailyUsageHistory: [],
        weeklyUsageHistory: [],
        monthlyUsageHistory: [],
        efficiency: 100,
        status: 'idle'
      },
      {
        id: 'balcony',
        name: 'Balcony Planters',
        type: 'balcony',
        area: 8,
        soilType: 'peat',
        moistureLevel: 42,
        moistureThreshold: 40,
        lastWatered: null,
        nextScheduled: null,
        waterUsageLiters: 0,
        sprinklerHeads: 0,
        dripEmitters: 12,
        enabled: true,
        flowRateLPM: 1.5,
        dailyUsageHistory: [],
        weeklyUsageHistory: [],
        monthlyUsageHistory: [],
        efficiency: 100,
        status: 'idle'
      },
      {
        id: 'rooftop-garden',
        name: 'Rooftop Garden',
        type: 'rooftop-garden',
        area: 30,
        soilType: 'loam',
        moistureLevel: 35,
        moistureThreshold: 30,
        lastWatered: null,
        nextScheduled: null,
        waterUsageLiters: 0,
        sprinklerHeads: 2,
        dripEmitters: 18,
        enabled: true,
        flowRateLPM: 5,
        dailyUsageHistory: [],
        weeklyUsageHistory: [],
        monthlyUsageHistory: [],
        efficiency: 100,
        status: 'idle'
      },
      {
        id: 'drip-system',
        name: 'Dedicated Drip Line',
        type: 'drip-system',
        area: 25,
        soilType: 'sandy',
        moistureLevel: 22,
        moistureThreshold: 20,
        lastWatered: null,
        nextScheduled: null,
        waterUsageLiters: 0,
        sprinklerHeads: 0,
        dripEmitters: 40,
        enabled: true,
        flowRateLPM: 2,
        dailyUsageHistory: [],
        weeklyUsageHistory: [],
        monthlyUsageHistory: [],
        efficiency: 100,
        status: 'idle'
      }
    ];

    // Soil moisture thresholds by type
    this.soilMoistureThresholds = {
      sandy: 20,
      clay: 35,
      loam: 30,
      peat: 40
    };

    // Seasonal coefficients for ET calculation (Nordic/Scandinavian)
    this.seasonalCoefficients = {
      spring: 0.6,
      summer: 1.0,
      autumn: 0.4,
      winter: 0.0
    };

    // Seasonal watering profiles
    this.seasonalProfiles = {
      'spring-rampup': { months: [3, 4, 5], label: 'Spring Ramp-Up', multiplier: 0.6, description: 'Gradual increase from dormancy' },
      'summer-peak': { months: [6, 7, 8], label: 'Summer Peak', multiplier: 1.0, description: 'Full watering schedule' },
      'autumn-winddown': { months: [9, 10], label: 'Autumn Wind-Down', multiplier: 0.4, description: 'Reducing toward dormancy' },
      'winter-off': { months: [11, 12, 1, 2], label: 'Winter Off', multiplier: 0.0, description: 'No watering - frozen ground' }
    };

    // Water sources: municipal, rainBarrel (500L), cistern (2000L)
    this.waterSources = [
      {
        id: 'municipal',
        name: 'Municipal Water Supply',
        type: 'municipal',
        capacity: Infinity,
        currentLevel: Infinity,
        costPerLiter: 0.045,
        priority: 3,
        available: true,
        qualityRating: 98
      },
      {
        id: 'rainBarrel',
        name: 'Rain Collection Barrel',
        type: 'rainBarrel',
        capacity: 500,
        currentLevel: 320,
        costPerLiter: 0,
        priority: 1,
        available: true,
        qualityRating: 85
      },
      {
        id: 'cistern',
        name: 'Underground Cistern',
        type: 'cistern',
        capacity: 2000,
        currentLevel: 1450,
        costPerLiter: 0.005,
        priority: 2,
        available: true,
        qualityRating: 90
      }
    ];

    // Grey water recycling monitoring
    this.greyWater = {
      enabled: true,
      filterStatus: 'clean',
      filterLifePercent: 82,
      filterLastChanged: new Date(Date.now() - 30 * 24 * 3600000).toISOString(),
      filterNextChange: new Date(Date.now() + 60 * 24 * 3600000).toISOString(),
      qualityPH: 7.1,
      qualityTurbidity: 12,
      qualityBOD: 25,
      totalRecycledLiters: 3200,
      dailyCapacityLiters: 150,
      currentDailyUsageLiters: 0,
      suitableForZones: ['trees', 'hedges', 'lawn']
    };

    // Water consumption analytics
    this.waterAnalytics = {
      totalLitersToday: 0,
      totalLitersThisWeek: 0,
      totalLitersThisMonth: 0,
      totalLitersLastMonth: 0,
      totalLitersSameMonthLastYear: 280,
      totalCostToday: 0,
      totalCostThisMonth: 0,
      dailyHistory: [],
      weeklyHistory: [],
      monthlyHistory: [],
      costPerCubicMeter: 45
    };

    // Weather conditions
    this.weatherConditions = {
      currentTemp: 18,
      humidity: 55,
      windSpeed: 8,
      rainForecastMM: 0,
      frostForecast: false,
      solarRadiation: 450,
      lastUpdated: null
    };

    // Leak detection
    this.leakDetection = {
      enabled: true,
      anomalyThreshold: 1.5,
      currentFlowRate: 0,
      expectedFlowRate: 0,
      leakAlerts: [],
      lastCheck: null,
      totalLeaksDetected: 0
    };

    // Frost protection
    this.frostProtection = {
      enabled: true,
      drainActivated: false,
      lastDrainDate: null,
      autoResumeTemp: 5,
      pipesDrained: false
    };

    // Water pressure monitoring (2-6 bar)
    this.waterPressure = {
      current: 3.8,
      min: 2.0,
      max: 6.0,
      unit: 'bar',
      history: [],
      alerts: [],
      lastReading: null
    };

    // Municipal water restrictions
    this.waterRestrictions = {
      currentLevel: 'normal',
      levels: {
        normal: { maxDailyLiters: Infinity, allowedHours: [0, 23], description: 'No restrictions' },
        advisory: { maxDailyLiters: 500, allowedHours: [6, 9, 18, 21], description: 'Voluntary conservation' },
        mandatory: { maxDailyLiters: 200, allowedHours: [6, 8, 19, 21], description: 'Mandatory limits in effect' },
        critical: { maxDailyLiters: 50, allowedHours: [6, 7], description: 'Emergency - essential only' }
      }
    };

    // Sprinkler head health monitoring
    this.sprinklerHeads = [
      { id: 'SH-001', zone: 'lawn', status: 'active', lastInspected: '2025-12-01', replacementCost: 189, flowRateLPM: 2.0, hoursRun: 340 },
      { id: 'SH-002', zone: 'lawn', status: 'active', lastInspected: '2025-12-01', replacementCost: 189, flowRateLPM: 2.0, hoursRun: 310 },
      { id: 'SH-003', zone: 'lawn', status: 'clogged', lastInspected: '2025-11-15', replacementCost: 189, flowRateLPM: 0.8, hoursRun: 520 },
      { id: 'SH-004', zone: 'lawn', status: 'active', lastInspected: '2025-12-01', replacementCost: 189, flowRateLPM: 2.0, hoursRun: 290 },
      { id: 'SH-005', zone: 'lawn', status: 'active', lastInspected: '2025-12-01', replacementCost: 189, flowRateLPM: 2.0, hoursRun: 280 },
      { id: 'SH-006', zone: 'lawn', status: 'damaged', lastInspected: '2025-11-20', replacementCost: 189, flowRateLPM: 0, hoursRun: 610 },
      { id: 'SH-007', zone: 'hedges', status: 'active', lastInspected: '2025-12-10', replacementCost: 149, flowRateLPM: 2.0, hoursRun: 200 },
      { id: 'SH-008', zone: 'hedges', status: 'active', lastInspected: '2025-12-10', replacementCost: 149, flowRateLPM: 2.0, hoursRun: 195 },
      { id: 'SH-009', zone: 'hedges', status: 'active', lastInspected: '2025-12-10', replacementCost: 149, flowRateLPM: 2.0, hoursRun: 210 },
      { id: 'SH-010', zone: 'hedges', status: 'active', lastInspected: '2025-12-10', replacementCost: 149, flowRateLPM: 2.0, hoursRun: 180 },
      { id: 'SH-011', zone: 'rooftop-garden', status: 'active', lastInspected: '2025-11-25', replacementCost: 219, flowRateLPM: 2.5, hoursRun: 150 },
      { id: 'SH-012', zone: 'rooftop-garden', status: 'active', lastInspected: '2025-11-25', replacementCost: 219, flowRateLPM: 2.5, hoursRun: 145 }
    ];

    // Plant water requirements database (20+ Nordic-appropriate plants)
    this.plantDatabase = [
      { species: 'grass', commonName: 'Lawn Grass (Nordic Mix)', waterNeedMLPerDay: 5, sunRequirement: 'full', frostTolerant: true, zonePreference: 'lawn', category: 'ground-cover' },
      { species: 'rosa', commonName: 'Roses', waterNeedMLPerDay: 8, sunRequirement: 'full', frostTolerant: false, zonePreference: 'garden-beds', category: 'ornamental' },
      { species: 'solanum-lycopersicum', commonName: 'Tomatoes', waterNeedMLPerDay: 12, sunRequirement: 'full', frostTolerant: false, zonePreference: 'greenhouse', category: 'vegetable' },
      { species: 'solanum-tuberosum', commonName: 'Potatoes', waterNeedMLPerDay: 7, sunRequirement: 'partial', frostTolerant: false, zonePreference: 'garden-beds', category: 'vegetable' },
      { species: 'daucus-carota', commonName: 'Carrots', waterNeedMLPerDay: 6, sunRequirement: 'full', frostTolerant: true, zonePreference: 'garden-beds', category: 'vegetable' },
      { species: 'anethum-graveolens', commonName: 'Dill', waterNeedMLPerDay: 4, sunRequirement: 'full', frostTolerant: false, zonePreference: 'balcony', category: 'herb' },
      { species: 'petroselinum-crispum', commonName: 'Parsley', waterNeedMLPerDay: 5, sunRequirement: 'partial', frostTolerant: true, zonePreference: 'balcony', category: 'herb' },
      { species: 'thymus-vulgaris', commonName: 'Thyme', waterNeedMLPerDay: 3, sunRequirement: 'full', frostTolerant: true, zonePreference: 'balcony', category: 'herb' },
      { species: 'malus-domestica', commonName: 'Apple Tree', waterNeedMLPerDay: 20, sunRequirement: 'full', frostTolerant: true, zonePreference: 'trees', category: 'fruit-tree' },
      { species: 'betula-pendula', commonName: 'Silver Birch', waterNeedMLPerDay: 15, sunRequirement: 'full', frostTolerant: true, zonePreference: 'trees', category: 'deciduous-tree' },
      { species: 'syringa-vulgaris', commonName: 'Lilac', waterNeedMLPerDay: 10, sunRequirement: 'full', frostTolerant: true, zonePreference: 'hedges', category: 'ornamental-shrub' },
      { species: 'lavandula-angustifolia', commonName: 'Lavender', waterNeedMLPerDay: 3, sunRequirement: 'full', frostTolerant: true, zonePreference: 'garden-beds', category: 'ornamental' },
      { species: 'fragaria-ananassa', commonName: 'Strawberries', waterNeedMLPerDay: 8, sunRequirement: 'full', frostTolerant: false, zonePreference: 'garden-beds', category: 'fruit' },
      { species: 'vaccinium-corymbosum', commonName: 'Blueberries', waterNeedMLPerDay: 10, sunRequirement: 'partial', frostTolerant: true, zonePreference: 'garden-beds', category: 'fruit' },
      { species: 'rheum-rhabarbarum', commonName: 'Rhubarb', waterNeedMLPerDay: 9, sunRequirement: 'partial', frostTolerant: true, zonePreference: 'garden-beds', category: 'vegetable' },
      { species: 'pisum-sativum', commonName: 'Peas', waterNeedMLPerDay: 6, sunRequirement: 'full', frostTolerant: true, zonePreference: 'garden-beds', category: 'vegetable' },
      { species: 'lactuca-sativa', commonName: 'Lettuce', waterNeedMLPerDay: 7, sunRequirement: 'partial', frostTolerant: false, zonePreference: 'greenhouse', category: 'vegetable' },
      { species: 'cucumis-sativus', commonName: 'Cucumber', waterNeedMLPerDay: 11, sunRequirement: 'full', frostTolerant: false, zonePreference: 'greenhouse', category: 'vegetable' },
      { species: 'helianthus-annuus', commonName: 'Sunflower', waterNeedMLPerDay: 9, sunRequirement: 'full', frostTolerant: false, zonePreference: 'garden-beds', category: 'ornamental' },
      { species: 'tulipa', commonName: 'Tulips', waterNeedMLPerDay: 5, sunRequirement: 'full', frostTolerant: true, zonePreference: 'garden-beds', category: 'bulb' },
      { species: 'rhododendron', commonName: 'Rhododendron', waterNeedMLPerDay: 12, sunRequirement: 'partial', frostTolerant: true, zonePreference: 'hedges', category: 'evergreen-shrub' },
      { species: 'ribes-nigrum', commonName: 'Blackcurrant', waterNeedMLPerDay: 8, sunRequirement: 'partial', frostTolerant: true, zonePreference: 'garden-beds', category: 'fruit' },
      { species: 'allium-schoenoprasum', commonName: 'Chives', waterNeedMLPerDay: 4, sunRequirement: 'full', frostTolerant: true, zonePreference: 'balcony', category: 'herb' },
      { species: 'mentha', commonName: 'Mint', waterNeedMLPerDay: 6, sunRequirement: 'partial', frostTolerant: true, zonePreference: 'balcony', category: 'herb' }
    ];

    // Schedule and tracking
    this.activeSchedules = [];
    this.wateringLog = [];
    this.dailyWaterUsage = new Array(30).fill(0);
    this.weeklyWaterUsage = new Array(52).fill(0);
    this.monthlyWaterUsage = new Array(12).fill(0);
  }

  // ====================================================================
  //  INITIALIZATION
  // ====================================================================
  async initialize() {
    try {
      this.homey.log('[Irrigation] Initializing Smart Irrigation & Water Conservation System...');

      this._applyDefaultMoistureThresholds();
      this._generateDefaultSchedules();
      this._loadSeasonalProfile();
      this._initializeWaterAnalytics();
      this._initializeSprinklerHealthData();

      // Monitoring intervals
      const moistureInterval = setInterval(() => this._monitorSoilMoisture(), 300000);
      this.intervals.push(moistureInterval);

      const weatherInterval = setInterval(() => this._updateWeatherConditions(), 600000);
      this.intervals.push(weatherInterval);

      const leakInterval = setInterval(() => this._runLeakDetection(), 120000);
      this.intervals.push(leakInterval);

      const pressureInterval = setInterval(() => this._monitorWaterPressure(), 180000);
      this.intervals.push(pressureInterval);

      const frostInterval = setInterval(() => this._checkFrostProtection(), 900000);
      this.intervals.push(frostInterval);

      const scheduleInterval = setInterval(() => this._executeScheduledWatering(), 60000);
      this.intervals.push(scheduleInterval);

      const analyticsInterval = setInterval(() => this._updateWaterAnalytics(), 3600000);
      this.intervals.push(analyticsInterval);

      const greyWaterInterval = setInterval(() => this._monitorGreyWater(), 600000);
      this.intervals.push(greyWaterInterval);

      const etInterval = setInterval(() => this._calculateEvapotranspiration(), 1800000);
      this.intervals.push(etInterval);

      const sprinklerHealthInterval = setInterval(() => this._checkSprinklerHealth(), 7200000);
      this.intervals.push(sprinklerHealthInterval);

      this.initialized = true;
      this.homey.log('[Irrigation] System initialized successfully with ' + this.zones.length + ' zones');
      this.homey.emit('irrigation:initialized', { zones: this.zones.length, sources: this.waterSources.length });

      return true;
    } catch (error) {
      this.homey.error('[Irrigation] Initialization failed:', error.message);
      return false;
    }
  }

  // ====================================================================
  //  INTERNAL SETUP HELPERS
  // ====================================================================
  _applyDefaultMoistureThresholds() {
    for (const zone of this.zones) {
      const threshold = this.soilMoistureThresholds[zone.soilType];
      if (threshold !== undefined) {
        zone.moistureThreshold = threshold;
      }
    }
    this.homey.log('[Irrigation] Applied soil-type moisture thresholds to all zones');
  }

  _generateDefaultSchedules() {
    const now = new Date();
    for (const zone of this.zones) {
      if (!zone.enabled) continue;
      const schedule = {
        zoneId: zone.id,
        startHour: zone.type === 'greenhouse' ? 7 : 5,
        startMinute: 0,
        durationMinutes: this._calculateDefaultDuration(zone),
        daysOfWeek: zone.type === 'lawn' ? [1, 3, 5] : [0, 2, 4, 6],
        enabled: true,
        createdAt: now.toISOString()
      };
      this.activeSchedules.push(schedule);
      zone.nextScheduled = this._getNextScheduledTime(schedule);
    }
    this.homey.log('[Irrigation] Generated default schedules for ' + this.activeSchedules.length + ' zones');
  }

  _calculateDefaultDuration(zone) {
    const baseDuration = Math.ceil(zone.area / 10) * 5;
    if (zone.type === 'drip-system' || zone.dripEmitters > 0) {
      return Math.min(baseDuration * 1.5, 60);
    }
    return Math.min(baseDuration, 45);
  }

  _getNextScheduledTime(schedule) {
    const now = new Date();
    const today = now.getDay();
    let nextDay = null;
    for (const day of schedule.daysOfWeek) {
      if (day > today || (day === today && now.getHours() < schedule.startHour)) {
        nextDay = day;
        break;
      }
    }
    if (nextDay === null) {
      nextDay = schedule.daysOfWeek[0];
    }
    const daysUntil = (nextDay - today + 7) % 7 || 7;
    const next = new Date(now);
    next.setDate(next.getDate() + daysUntil);
    next.setHours(schedule.startHour, schedule.startMinute, 0, 0);
    return next.toISOString();
  }

  _loadSeasonalProfile() {
    const month = new Date().getMonth() + 1;
    this.currentSeason = null;
    for (const [key, profile] of Object.entries(this.seasonalProfiles)) {
      if (profile.months.includes(month)) {
        this.currentSeason = key;
        this.currentSeasonMultiplier = profile.multiplier;
        break;
      }
    }
    if (!this.currentSeason) {
      this.currentSeason = 'winter-off';
      this.currentSeasonMultiplier = 0.0;
    }
    this.homey.log('[Irrigation] Current seasonal profile: ' + this.currentSeason + ' (multiplier: ' + this.currentSeasonMultiplier + ')');
  }

  _initializeWaterAnalytics() {
    const now = new Date();
    for (let i = 0; i < 30; i++) {
      const day = new Date(now);
      day.setDate(day.getDate() - i);
      this.waterAnalytics.dailyHistory.push({
        date: day.toISOString().slice(0, 10),
        liters: Math.round(Math.random() * 80 + 20),
        cost: 0
      });
    }
    for (const entry of this.waterAnalytics.dailyHistory) {
      entry.cost = parseFloat(((entry.liters / 1000) * this.waterAnalytics.costPerCubicMeter).toFixed(2));
    }
    this.homey.log('[Irrigation] Water analytics history initialized');
  }

  _initializeSprinklerHealthData() {
    let issues = 0;
    for (const head of this.sprinklerHeads) {
      if (head.status === 'clogged' || head.status === 'damaged') {
        issues++;
      }
    }
    if (issues > 0) {
      this.homey.log('[Irrigation] Sprinkler health: ' + issues + ' head(s) need attention');
    }
  }

  // ====================================================================
  //  SOIL MOISTURE MONITORING
  // ====================================================================
  _monitorSoilMoisture() {
    try {
      for (const zone of this.zones) {
        if (!zone.enabled) continue;

        const previousLevel = zone.moistureLevel;
        const drift = (Math.random() - 0.55) * 4;
        zone.moistureLevel = Math.max(0, Math.min(100, zone.moistureLevel + drift));
        zone.moistureLevel = parseFloat(zone.moistureLevel.toFixed(1));

        if (zone.moistureLevel < zone.moistureThreshold && previousLevel >= zone.moistureThreshold) {
          this.homey.log('[Irrigation] Zone ' + zone.id + ' moisture dropped below threshold (' + zone.moistureLevel + '% < ' + zone.moistureThreshold + '%)');
          this.homey.emit('irrigation:moisture-low', {
            zoneId: zone.id,
            level: zone.moistureLevel,
            threshold: zone.moistureThreshold
          });
        }

        if (zone.moistureLevel > 85) {
          this.homey.log('[Irrigation] Zone ' + zone.id + ' is saturated at ' + zone.moistureLevel + '%');
          this.homey.emit('irrigation:zone-saturated', { zoneId: zone.id, level: zone.moistureLevel });
        }
      }
    } catch (error) {
      this.homey.error('[Irrigation] Soil moisture monitoring error:', error.message);
    }
  }

  getMoistureReadings() {
    const readings = {};
    for (const zone of this.zones) {
      readings[zone.id] = {
        level: zone.moistureLevel,
        threshold: zone.moistureThreshold,
        soilType: zone.soilType,
        needsWater: zone.moistureLevel < zone.moistureThreshold,
        status: zone.moistureLevel < zone.moistureThreshold ? 'dry' :
                zone.moistureLevel > 80 ? 'saturated' : 'optimal'
      };
    }
    return readings;
  }

  // ====================================================================
  //  WEATHER-BASED SMART SCHEDULING
  // ====================================================================
  _updateWeatherConditions() {
    try {
      this.weatherConditions.currentTemp = parseFloat((15 + Math.random() * 15).toFixed(1));
      this.weatherConditions.humidity = Math.round(40 + Math.random() * 50);
      this.weatherConditions.windSpeed = parseFloat((Math.random() * 20).toFixed(1));
      this.weatherConditions.rainForecastMM = parseFloat((Math.random() * 12).toFixed(1));
      this.weatherConditions.frostForecast = this.weatherConditions.currentTemp < 2;
      this.weatherConditions.solarRadiation = Math.round(100 + Math.random() * 700);
      this.weatherConditions.lastUpdated = new Date().toISOString();

      this.homey.log('[Irrigation] Weather updated: ' + this.weatherConditions.currentTemp + 'C, humidity ' + this.weatherConditions.humidity + '%, rain forecast ' + this.weatherConditions.rainForecastMM + 'mm');
    } catch (error) {
      this.homey.error('[Irrigation] Weather update failed:', error.message);
    }
  }

  evaluateWeatherModifiers() {
    const modifiers = {
      skipWatering: false,
      adjustmentFactor: 1.0,
      reasons: []
    };

    // Skip if rain forecast >5mm
    if (this.weatherConditions.rainForecastMM > 5) {
      modifiers.skipWatering = true;
      modifiers.adjustmentFactor = 0;
      modifiers.reasons.push('Rain forecast > 5mm (' + this.weatherConditions.rainForecastMM + 'mm expected)');
    }

    // Skip if frost forecast
    if (this.weatherConditions.frostForecast) {
      modifiers.skipWatering = true;
      modifiers.adjustmentFactor = 0;
      modifiers.reasons.push('Frost forecast - pipes at risk');
    }

    // Reduce 50% if humidity >80%
    if (!modifiers.skipWatering && this.weatherConditions.humidity > 80) {
      modifiers.adjustmentFactor *= 0.5;
      modifiers.reasons.push('Humidity > 80% - reducing by 50%');
    }

    // Increase 20% if temp >30C
    if (!modifiers.skipWatering && this.weatherConditions.currentTemp > 30) {
      modifiers.adjustmentFactor *= 1.2;
      modifiers.reasons.push('Temperature > 30C - increasing by 20%');
    }

    return modifiers;
  }

  // ====================================================================
  //  EVAPOTRANSPIRATION (ET) CALCULATION - NORDIC CLIMATE
  // ====================================================================
  _calculateEvapotranspiration() {
    try {
      const temp = this.weatherConditions.currentTemp;
      const humidity = this.weatherConditions.humidity;
      const solar = this.weatherConditions.solarRadiation;
      const wind = this.weatherConditions.windSpeed;

      // Simplified Penman-Monteith reference
      const satVapPressure = 0.6108 * Math.exp((17.27 * temp) / (temp + 237.3));
      const actVapPressure = satVapPressure * (humidity / 100);
      const vpd = satVapPressure - actVapPressure;

      const netRadiation = solar * 0.0036;
      const tempFactor = 900 / (temp + 273);

      let et0 = (0.408 * netRadiation + 0.063 * tempFactor * wind * vpd) /
                (1 + 0.034 * wind);
      et0 = Math.max(0, et0);

      // Apply seasonal coefficient for Nordic climate
      const seasonCoeff = this.currentSeasonMultiplier || 0;
      const adjustedET = et0 * seasonCoeff;

      this.currentET0 = parseFloat(et0.toFixed(2));
      this.adjustedET = parseFloat(adjustedET.toFixed(2));

      // Calculate crop-specific ET for each zone
      for (const zone of this.zones) {
        if (!zone.enabled) continue;
        const cropCoeff = this._getCropCoefficient(zone.type);
        zone.etcDaily = parseFloat((adjustedET * cropCoeff).toFixed(2));
        zone.waterDeficit = parseFloat(Math.max(0, zone.etcDaily - (zone.moistureLevel / 20)).toFixed(2));
      }

      this.homey.log('[Irrigation] ET0: ' + this.currentET0 + ' mm/day, adjusted: ' + this.adjustedET + ' mm/day (season: ' + this.currentSeason + ')');
    } catch (error) {
      this.homey.error('[Irrigation] ET calculation error:', error.message);
    }
  }

  _getCropCoefficient(zoneType) {
    const coefficients = {
      'lawn': 0.85,
      'garden-beds': 1.05,
      'trees': 0.90,
      'hedges': 0.75,
      'greenhouse': 1.15,
      'balcony': 0.80,
      'rooftop-garden': 0.95,
      'drip-system': 1.0
    };
    return coefficients[zoneType] || 1.0;
  }

  // ====================================================================
  //  SCHEDULED WATERING EXECUTION
  // ====================================================================
  _executeScheduledWatering() {
    try {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentDay = now.getDay();

      // No watering in winter
      if (this.currentSeasonMultiplier === 0) {
        return;
      }

      // Check weather modifiers
      const weatherMods = this.evaluateWeatherModifiers();
      if (weatherMods.skipWatering) {
        this.homey.log('[Irrigation] Watering skipped: ' + weatherMods.reasons.join(', '));
        return;
      }

      // Check water restrictions
      const restriction = this.waterRestrictions.levels[this.waterRestrictions.currentLevel];
      if (this.waterAnalytics.totalLitersToday >= restriction.maxDailyLiters) {
        this.homey.log('[Irrigation] Daily water limit reached under ' + this.waterRestrictions.currentLevel + ' restrictions');
        return;
      }

      for (const schedule of this.activeSchedules) {
        if (!schedule.enabled) continue;
        if (!schedule.daysOfWeek.includes(currentDay)) continue;
        if (currentHour !== schedule.startHour || currentMinute !== schedule.startMinute) continue;

        const zone = this.zones.find(function(z) { return z.id === schedule.zoneId; });
        if (!zone || !zone.enabled) continue;

        // Skip if moisture is sufficient
        if (zone.moistureLevel >= zone.moistureThreshold + 15) {
          this.homey.log('[Irrigation] Skipping ' + zone.id + ' - moisture sufficient (' + zone.moistureLevel + '%)');
          continue;
        }

        // Check allowed watering hours
        const allowedHours = restriction.allowedHours;
        let hourAllowed = false;
        for (let i = 0; i < allowedHours.length; i += 2) {
          if (currentHour >= allowedHours[i] && currentHour <= allowedHours[i + 1]) {
            hourAllowed = true;
            break;
          }
        }
        if (!hourAllowed) {
          this.homey.log('[Irrigation] Watering not allowed at hour ' + currentHour + ' under current restrictions');
          continue;
        }

        this._executeZoneWatering(zone, schedule, weatherMods.adjustmentFactor);
      }
    } catch (error) {
      this.homey.error('[Irrigation] Schedule execution error:', error.message);
    }
  }

  _executeZoneWatering(zone, schedule, adjustmentFactor) {
    const duration = schedule.durationMinutes * this.currentSeasonMultiplier * adjustmentFactor;
    if (duration <= 0) return;

    const litersUsed = parseFloat((zone.flowRateLPM * duration).toFixed(1));
    const source = this._selectWaterSource(litersUsed);

    if (!source) {
      this.homey.error('[Irrigation] No water source available for zone ' + zone.id);
      this.homey.emit('irrigation:no-water-source', { zoneId: zone.id, litersNeeded: litersUsed });
      return;
    }

    // Deduct from source
    if (source.type !== 'municipal') {
      source.currentLevel = Math.max(0, source.currentLevel - litersUsed);
    }

    // Update zone stats
    zone.waterUsageLiters += litersUsed;
    zone.lastWatered = new Date().toISOString();
    zone.status = 'watering';
    zone.moistureLevel = Math.min(100, zone.moistureLevel + (litersUsed / zone.area) * 5);

    // Update analytics
    const cost = parseFloat((litersUsed * source.costPerLiter).toFixed(2));
    this.waterAnalytics.totalLitersToday += litersUsed;
    this.waterAnalytics.totalLitersThisMonth += litersUsed;
    this.waterAnalytics.totalCostToday += cost;
    this.waterAnalytics.totalCostThisMonth += cost;

    // Check for leaks during watering
    this._checkForLeaks(zone, litersUsed, duration);

    // Log the watering event
    const logEntry = {
      timestamp: new Date().toISOString(),
      zoneId: zone.id,
      durationMinutes: parseFloat(duration.toFixed(1)),
      litersUsed: litersUsed,
      source: source.id,
      cost: cost,
      moistureAfter: parseFloat(zone.moistureLevel.toFixed(1)),
      adjustmentFactor: adjustmentFactor,
      season: this.currentSeason
    };
    this.wateringLog.push(logEntry);

    // Keep log bounded
    if (this.wateringLog.length > 500) {
      this.wateringLog = this.wateringLog.slice(-500);
    }

    // Schedule next watering
    zone.nextScheduled = this._getNextScheduledTime(schedule);

    // Set zone back to idle after duration
    setTimeout(function() { zone.status = 'idle'; }, duration * 60000);

    this.homey.log('[Irrigation] Watered zone ' + zone.id + ': ' + litersUsed + 'L over ' + duration.toFixed(1) + ' min from ' + source.id);
    this.homey.emit('irrigation:zone-watered', logEntry);
  }

  _selectWaterSource(litersNeeded) {
    // Sort by priority (lowest first = preferred)
    const sorted = this.waterSources
      .filter(function(s) { return s.available; })
      .sort(function(a, b) { return a.priority - b.priority; });

    for (const source of sorted) {
      if (source.type === 'municipal') return source;
      if (source.currentLevel >= litersNeeded) return source;
    }
    return null;
  }

  // ====================================================================
  //  LEAK DETECTION
  // ====================================================================
  _runLeakDetection() {
    try {
      const activeZones = this.zones.filter(function(z) { return z.status === 'watering'; });
      if (activeZones.length === 0) {
        // No zones should be flowing
        const ambientFlow = Math.random() * 0.5;
        this.leakDetection.currentFlowRate = parseFloat(ambientFlow.toFixed(2));

        if (ambientFlow > 0.3) {
          const alert = {
            timestamp: new Date().toISOString(),
            type: 'unexpected-flow',
            flowRate: this.leakDetection.currentFlowRate,
            message: 'Unexpected water flow detected when no zones are active'
          };
          this.leakDetection.leakAlerts.push(alert);
          this.leakDetection.totalLeaksDetected++;
          this.homey.log('[Irrigation] LEAK ALERT: Unexpected flow of ' + ambientFlow.toFixed(2) + ' LPM');
          this.homey.emit('irrigation:leak-detected', alert);
        }
      } else {
        // Check flow against expected
        let expectedFlow = 0;
        for (const zone of activeZones) {
          expectedFlow += zone.flowRateLPM;
        }
        const actualFlow = expectedFlow * (0.8 + Math.random() * 0.5);
        this.leakDetection.currentFlowRate = parseFloat(actualFlow.toFixed(2));
        this.leakDetection.expectedFlowRate = parseFloat(expectedFlow.toFixed(2));

        // >150% of expected = leak alert
        const ratio = actualFlow / expectedFlow;
        if (ratio > this.leakDetection.anomalyThreshold) {
          const alert = {
            timestamp: new Date().toISOString(),
            type: 'flow-anomaly',
            expected: expectedFlow,
            actual: parseFloat(actualFlow.toFixed(2)),
            ratio: parseFloat(ratio.toFixed(2)),
            message: 'Flow rate ' + Math.round(ratio * 100) + '% of expected (threshold: ' + Math.round(this.leakDetection.anomalyThreshold * 100) + '%)'
          };
          this.leakDetection.leakAlerts.push(alert);
          this.leakDetection.totalLeaksDetected++;
          this.homey.log('[Irrigation] LEAK ALERT: Flow anomaly detected - ' + Math.round(ratio * 100) + '% of expected');
          this.homey.emit('irrigation:leak-detected', alert);
        }
      }

      this.leakDetection.lastCheck = new Date().toISOString();

      // Keep alerts bounded
      if (this.leakDetection.leakAlerts.length > 100) {
        this.leakDetection.leakAlerts = this.leakDetection.leakAlerts.slice(-100);
      }
    } catch (error) {
      this.homey.error('[Irrigation] Leak detection error:', error.message);
    }
  }

  _checkForLeaks(zone, litersUsed, duration) {
    const expectedLiters = zone.flowRateLPM * duration;
    const ratio = litersUsed / expectedLiters;
    if (ratio > this.leakDetection.anomalyThreshold) {
      this.homey.log('[Irrigation] Possible leak in zone ' + zone.id + ': used ' + litersUsed + 'L vs expected ' + expectedLiters.toFixed(1) + 'L');
    }
  }

  // ====================================================================
  //  FROST PROTECTION
  // ====================================================================
  _checkFrostProtection() {
    try {
      if (!this.frostProtection.enabled) return;

      // Auto-drain when frost forecast and temp < 0C
      if (this.weatherConditions.frostForecast && !this.frostProtection.pipesDrained) {
        this.homey.log('[Irrigation] Frost forecast detected - initiating pipe drain');
        this._drainPipes();
      }

      // Auto-resume when frost has passed
      if (!this.weatherConditions.frostForecast &&
          this.frostProtection.pipesDrained &&
          this.weatherConditions.currentTemp > this.frostProtection.autoResumeTemp) {
        this.homey.log('[Irrigation] Temperature above ' + this.frostProtection.autoResumeTemp + 'C - resuming normal operations');
        this.frostProtection.pipesDrained = false;
        this.frostProtection.drainActivated = false;
        // Re-enable all zones
        for (const zone of this.zones) {
          zone.enabled = true;
          zone.status = 'idle';
        }
        this.homey.emit('irrigation:frost-protection-off', { temp: this.weatherConditions.currentTemp });
      }
    } catch (error) {
      this.homey.error('[Irrigation] Frost protection check error:', error.message);
    }
  }

  _drainPipes() {
    this.frostProtection.drainActivated = true;
    this.frostProtection.pipesDrained = true;
    this.frostProtection.lastDrainDate = new Date().toISOString();

    for (const zone of this.zones) {
      zone.status = 'drained';
      zone.enabled = false;
    }

    this.homey.log('[Irrigation] All pipes drained - zones disabled for frost protection');
    this.homey.emit('irrigation:pipes-drained', { timestamp: this.frostProtection.lastDrainDate });
  }

  // ====================================================================
  //  WATER PRESSURE MONITORING
  // ====================================================================
  _monitorWaterPressure() {
    try {
      const variation = (Math.random() - 0.5) * 1.2;
      this.waterPressure.current = parseFloat(Math.max(1, Math.min(8, this.waterPressure.current + variation)).toFixed(2));
      this.waterPressure.lastReading = new Date().toISOString();

      this.waterPressure.history.push({
        timestamp: this.waterPressure.lastReading,
        pressure: this.waterPressure.current
      });

      // Keep history bounded (288 = every 5 min for 24h)
      if (this.waterPressure.history.length > 288) {
        this.waterPressure.history = this.waterPressure.history.slice(-288);
      }

      // Check thresholds (2-6 bar)
      if (this.waterPressure.current < this.waterPressure.min) {
        const alert = {
          timestamp: this.waterPressure.lastReading,
          type: 'low-pressure',
          value: this.waterPressure.current,
          threshold: this.waterPressure.min
        };
        this.waterPressure.alerts.push(alert);
        this.homey.log('[Irrigation] Low water pressure: ' + this.waterPressure.current + ' bar (min: ' + this.waterPressure.min + ')');
        this.homey.emit('irrigation:pressure-low', alert);
      }

      if (this.waterPressure.current > this.waterPressure.max) {
        const alert = {
          timestamp: this.waterPressure.lastReading,
          type: 'high-pressure',
          value: this.waterPressure.current,
          threshold: this.waterPressure.max
        };
        this.waterPressure.alerts.push(alert);
        this.homey.log('[Irrigation] High water pressure: ' + this.waterPressure.current + ' bar (max: ' + this.waterPressure.max + ')');
        this.homey.emit('irrigation:pressure-high', alert);
      }

      if (this.waterPressure.alerts.length > 50) {
        this.waterPressure.alerts = this.waterPressure.alerts.slice(-50);
      }
    } catch (error) {
      this.homey.error('[Irrigation] Pressure monitoring error:', error.message);
    }
  }

  // ====================================================================
  //  GREY WATER RECYCLING MONITORING
  // ====================================================================
  _monitorGreyWater() {
    try {
      if (!this.greyWater.enabled) return;

      // Simulate quality readings
      this.greyWater.qualityPH = parseFloat((6.5 + Math.random() * 1.5).toFixed(1));
      this.greyWater.qualityTurbidity = Math.round(5 + Math.random() * 20);
      this.greyWater.qualityBOD = Math.round(15 + Math.random() * 30);

      // Degrade filter over time
      this.greyWater.filterLifePercent = Math.max(0, this.greyWater.filterLifePercent - 0.1);

      if (this.greyWater.filterLifePercent < 10) {
        this.greyWater.filterStatus = 'needs-replacement';
        this.homey.log('[Irrigation] Grey water filter needs replacement (' + this.greyWater.filterLifePercent.toFixed(0) + '% life remaining)');
        this.homey.emit('irrigation:greywater-filter-low', {
          lifePercent: this.greyWater.filterLifePercent,
          nextChange: this.greyWater.filterNextChange
        });
      } else if (this.greyWater.filterLifePercent < 30) {
        this.greyWater.filterStatus = 'degraded';
      } else {
        this.greyWater.filterStatus = 'clean';
      }

      // Quality alerts
      if (this.greyWater.qualityPH < 6.0 || this.greyWater.qualityPH > 8.5) {
        this.homey.log('[Irrigation] Grey water pH out of range: ' + this.greyWater.qualityPH);
        this.homey.emit('irrigation:greywater-quality-alert', {
          metric: 'pH',
          value: this.greyWater.qualityPH,
          acceptableRange: '6.0 - 8.5'
        });
      }

      if (this.greyWater.qualityBOD > 40) {
        this.homey.log('[Irrigation] Grey water BOD high: ' + this.greyWater.qualityBOD + ' mg/L');
        this.homey.emit('irrigation:greywater-quality-alert', {
          metric: 'BOD',
          value: this.greyWater.qualityBOD,
          maxAcceptable: 40
        });
      }
    } catch (error) {
      this.homey.error('[Irrigation] Grey water monitoring error:', error.message);
    }
  }

  // ====================================================================
  //  SPRINKLER HEAD HEALTH MONITORING
  // ====================================================================
  _checkSprinklerHealth() {
    try {
      let cloggedCount = 0;
      let damagedCount = 0;
      let totalReplacementCost = 0;

      for (const head of this.sprinklerHeads) {
        // Small chance of degradation
        if (head.status === 'active') {
          if (Math.random() < 0.02) {
            head.status = 'clogged';
            head.flowRateLPM = head.flowRateLPM * 0.4;
            this.homey.log('[Irrigation] Sprinkler ' + head.id + ' in zone ' + head.zone + ' has become clogged');
          }
        }

        if (head.status === 'clogged') cloggedCount++;
        if (head.status === 'damaged') damagedCount++;
        if (head.status !== 'active') totalReplacementCost += head.replacementCost;
      }

      if (cloggedCount > 0 || damagedCount > 0) {
        this.homey.emit('irrigation:sprinkler-maintenance', {
          clogged: cloggedCount,
          damaged: damagedCount,
          estimatedCost: totalReplacementCost
        });
      }
    } catch (error) {
      this.homey.error('[Irrigation] Sprinkler health check error:', error.message);
    }
  }

  getSprinklerHealthReport() {
    const report = {
      total: this.sprinklerHeads.length,
      active: 0,
      clogged: 0,
      damaged: 0,
      replacementCostTotal: 0,
      byZone: {},
      heads: []
    };

    for (const head of this.sprinklerHeads) {
      if (head.status === 'active') report.active++;
      else if (head.status === 'clogged') report.clogged++;
      else if (head.status === 'damaged') report.damaged++;

      if (head.status !== 'active') {
        report.replacementCostTotal += head.replacementCost;
      }

      if (!report.byZone[head.zone]) {
        report.byZone[head.zone] = { active: 0, clogged: 0, damaged: 0 };
      }
      report.byZone[head.zone][head.status] = (report.byZone[head.zone][head.status] || 0) + 1;

      report.heads.push({
        id: head.id,
        zone: head.zone,
        status: head.status,
        lastInspected: head.lastInspected,
        hoursRun: head.hoursRun,
        flowRateLPM: head.flowRateLPM
      });
    }

    return report;
  }

  // ====================================================================
  //  WATER CONSUMPTION ANALYTICS
  // ====================================================================
  _updateWaterAnalytics() {
    try {
      const dayIndex = new Date().getDate() - 1;
      this.dailyWaterUsage[dayIndex] = this.waterAnalytics.totalLitersToday;

      const weekIndex = this._getWeekNumber(new Date());
      this.weeklyWaterUsage[weekIndex] = (this.weeklyWaterUsage[weekIndex] || 0) + this.waterAnalytics.totalLitersToday;

      const monthIndex = new Date().getMonth();
      this.monthlyWaterUsage[monthIndex] = (this.monthlyWaterUsage[monthIndex] || 0) + this.waterAnalytics.totalLitersToday;

      this.homey.log('[Irrigation] Analytics updated: ' + this.waterAnalytics.totalLitersToday + 'L today, ' + this.waterAnalytics.totalLitersThisMonth + 'L this month');
    } catch (error) {
      this.homey.error('[Irrigation] Analytics update error:', error.message);
    }
  }

  _getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  getWaterConsumptionReport() {
    const report = {
      today: {
        liters: this.waterAnalytics.totalLitersToday,
        cost: parseFloat(((this.waterAnalytics.totalLitersToday / 1000) * this.waterAnalytics.costPerCubicMeter).toFixed(2))
      },
      thisWeek: {
        liters: this.waterAnalytics.totalLitersThisWeek,
        cost: parseFloat(((this.waterAnalytics.totalLitersThisWeek / 1000) * this.waterAnalytics.costPerCubicMeter).toFixed(2))
      },
      thisMonth: {
        liters: this.waterAnalytics.totalLitersThisMonth,
        cost: parseFloat(((this.waterAnalytics.totalLitersThisMonth / 1000) * this.waterAnalytics.costPerCubicMeter).toFixed(2))
      },
      lastMonth: {
        liters: this.waterAnalytics.totalLitersLastMonth,
        cost: parseFloat(((this.waterAnalytics.totalLitersLastMonth / 1000) * this.waterAnalytics.costPerCubicMeter).toFixed(2))
      },
      sameMonthLastYear: {
        liters: this.waterAnalytics.totalLitersSameMonthLastYear,
        cost: parseFloat(((this.waterAnalytics.totalLitersSameMonthLastYear / 1000) * this.waterAnalytics.costPerCubicMeter).toFixed(2))
      },
      perZone: {},
      costPerCubicMeter: this.waterAnalytics.costPerCubicMeter,
      currency: 'SEK'
    };

    for (const zone of this.zones) {
      report.perZone[zone.id] = {
        totalLiters: zone.waterUsageLiters,
        cost: parseFloat(((zone.waterUsageLiters / 1000) * this.waterAnalytics.costPerCubicMeter).toFixed(2)),
        lastWatered: zone.lastWatered,
        efficiency: zone.efficiency
      };
    }

    return report;
  }

  // Water cost calculator at 45 SEK per cubic meter
  calculateWaterCost(liters) {
    const cubicMeters = liters / 1000;
    const cost = cubicMeters * 45;
    return {
      liters: liters,
      cubicMeters: parseFloat(cubicMeters.toFixed(3)),
      costSEK: parseFloat(cost.toFixed(2)),
      ratePerCubicMeter: 45
    };
  }

  // ====================================================================
  //  ZONE MANAGEMENT
  // ====================================================================
  getZoneStatus(zoneId) {
    const zone = this.zones.find(function(z) { return z.id === zoneId; });
    if (!zone) return null;

    return {
      id: zone.id,
      name: zone.name,
      type: zone.type,
      area: zone.area,
      soilType: zone.soilType,
      moistureLevel: zone.moistureLevel,
      moistureThreshold: zone.moistureThreshold,
      lastWatered: zone.lastWatered,
      nextScheduled: zone.nextScheduled,
      waterUsageLiters: zone.waterUsageLiters,
      status: zone.status,
      enabled: zone.enabled,
      flowRateLPM: zone.flowRateLPM,
      sprinklerHeads: zone.sprinklerHeads,
      dripEmitters: zone.dripEmitters,
      efficiency: zone.efficiency,
      etcDaily: zone.etcDaily || 0,
      waterDeficit: zone.waterDeficit || 0
    };
  }

  getAllZoneStatuses() {
    const statuses = {};
    for (const zone of this.zones) {
      statuses[zone.id] = this.getZoneStatus(zone.id);
    }
    return statuses;
  }

  setZoneEnabled(zoneId, enabled) {
    const zone = this.zones.find(function(z) { return z.id === zoneId; });
    if (!zone) {
      this.homey.error('[Irrigation] Zone not found: ' + zoneId);
      return false;
    }
    zone.enabled = enabled;
    this.homey.log('[Irrigation] Zone ' + zoneId + ' ' + (enabled ? 'enabled' : 'disabled'));
    this.homey.emit('irrigation:zone-toggled', { zoneId: zoneId, enabled: enabled });
    return true;
  }

  manualWaterZone(zoneId, durationMinutes) {
    const zone = this.zones.find(function(z) { return z.id === zoneId; });
    if (!zone) {
      this.homey.error('[Irrigation] Zone not found for manual watering: ' + zoneId);
      return { success: false, reason: 'Zone not found' };
    }
    if (!zone.enabled) {
      return { success: false, reason: 'Zone is disabled' };
    }
    if (zone.status === 'watering') {
      return { success: false, reason: 'Zone is already watering' };
    }
    if (this.frostProtection.pipesDrained) {
      return { success: false, reason: 'Pipes are drained for frost protection' };
    }

    const now = new Date();
    const schedule = {
      durationMinutes: durationMinutes,
      zoneId: zoneId,
      daysOfWeek: [now.getDay()],
      startHour: now.getHours(),
      startMinute: now.getMinutes(),
      enabled: true
    };
    this._executeZoneWatering(zone, schedule, 1.0);

    return {
      success: true,
      zoneId: zoneId,
      duration: durationMinutes,
      estimatedLiters: parseFloat((zone.flowRateLPM * durationMinutes).toFixed(1))
    };
  }

  // ====================================================================
  //  ZONE OPTIMIZATION BASED ON ET AND MOISTURE
  // ====================================================================
  optimizeZoneWatering(zoneId) {
    const zone = this.zones.find(function(z) { return z.id === zoneId; });
    if (!zone) return null;

    const etcDaily = zone.etcDaily || 0;
    const moistureDeficit = Math.max(0, zone.moistureThreshold - zone.moistureLevel);
    const weatherMods = this.evaluateWeatherModifiers();

    // Calculate water need from ET
    const baseWaterNeedLiters = (etcDaily * zone.area) / 1000;
    // Calculate water need from moisture deficit
    const deficitWaterLiters = (moistureDeficit / 100) * zone.area * 2;
    // Total need adjusted for weather and season
    const totalNeed = (baseWaterNeedLiters + deficitWaterLiters) * weatherMods.adjustmentFactor * this.currentSeasonMultiplier;

    // Calculate optimal watering duration
    const optimalDuration = totalNeed > 0 ? totalNeed / zone.flowRateLPM : 0;
    // Adjust for irrigation method efficiency
    const efficiency = zone.dripEmitters > 0 ? 0.92 : 0.75;
    const adjustedDuration = optimalDuration / efficiency;

    const recommendation = {
      zoneId: zone.id,
      currentMoisture: zone.moistureLevel,
      threshold: zone.moistureThreshold,
      etcDaily: etcDaily,
      moistureDeficit: moistureDeficit,
      baseWaterNeedLiters: parseFloat(baseWaterNeedLiters.toFixed(2)),
      deficitWaterLiters: parseFloat(deficitWaterLiters.toFixed(2)),
      totalWaterNeedLiters: parseFloat(totalNeed.toFixed(2)),
      optimalDurationMinutes: parseFloat(adjustedDuration.toFixed(1)),
      irrigationEfficiency: efficiency,
      weatherAdjustment: weatherMods.adjustmentFactor,
      seasonMultiplier: this.currentSeasonMultiplier,
      estimatedCostSEK: parseFloat(((totalNeed / 1000) * 45).toFixed(2)),
      recommendation: totalNeed <= 0 ? 'No watering needed' :
                       adjustedDuration < 5 ? 'Brief watering recommended' :
                       adjustedDuration < 15 ? 'Standard watering cycle' :
                       'Extended watering needed'
    };

    return recommendation;
  }

  optimizeAllZones() {
    const recommendations = {};
    for (const zone of this.zones) {
      if (!zone.enabled) continue;
      recommendations[zone.id] = this.optimizeZoneWatering(zone.id);
    }
    return recommendations;
  }

  // ====================================================================
  //  WATER SOURCE MANAGEMENT
  // ====================================================================
  getWaterSourceLevels() {
    const levels = {};
    for (const source of this.waterSources) {
      levels[source.id] = {
        name: source.name,
        type: source.type,
        capacity: source.capacity === Infinity ? 'unlimited' : source.capacity,
        currentLevel: source.currentLevel === Infinity ? 'unlimited' : source.currentLevel,
        percentFull: source.capacity === Infinity ? 100 : parseFloat(((source.currentLevel / source.capacity) * 100).toFixed(1)),
        costPerLiter: source.costPerLiter,
        priority: source.priority,
        available: source.available,
        qualityRating: source.qualityRating
      };
    }
    return levels;
  }

  refillWaterSource(sourceId, liters) {
    const source = this.waterSources.find(function(s) { return s.id === sourceId; });
    if (!source) {
      this.homey.error('[Irrigation] Water source not found: ' + sourceId);
      return { success: false, reason: 'Source not found' };
    }
    if (source.type === 'municipal') {
      return { success: false, reason: 'Municipal supply does not need refilling' };
    }

    const previousLevel = source.currentLevel;
    source.currentLevel = Math.min(source.capacity, source.currentLevel + liters);
    const actualAdded = source.currentLevel - previousLevel;

    this.homey.log('[Irrigation] Refilled ' + source.id + ': added ' + actualAdded.toFixed(0) + 'L (now ' + source.currentLevel.toFixed(0) + '/' + source.capacity + 'L)');
    this.homey.emit('irrigation:source-refilled', { sourceId: sourceId, added: actualAdded, level: source.currentLevel });

    return {
      success: true,
      sourceId: sourceId,
      previousLevel: previousLevel,
      currentLevel: source.currentLevel,
      added: actualAdded,
      capacity: source.capacity,
      percentFull: parseFloat(((source.currentLevel / source.capacity) * 100).toFixed(1))
    };
  }

  // ====================================================================
  //  WATER RESTRICTION MANAGEMENT
  // ====================================================================
  setWaterRestrictionLevel(level) {
    if (!this.waterRestrictions.levels[level]) {
      this.homey.error('[Irrigation] Invalid restriction level: ' + level);
      return false;
    }

    const previousLevel = this.waterRestrictions.currentLevel;
    this.waterRestrictions.currentLevel = level;

    this.homey.log('[Irrigation] Water restriction level changed: ' + previousLevel + ' to ' + level);
    this.homey.emit('irrigation:restriction-changed', {
      previous: previousLevel,
      current: level,
      description: this.waterRestrictions.levels[level].description,
      maxDailyLiters: this.waterRestrictions.levels[level].maxDailyLiters
    });

    return true;
  }

  getWaterRestrictionStatus() {
    const current = this.waterRestrictions.levels[this.waterRestrictions.currentLevel];
    return {
      currentLevel: this.waterRestrictions.currentLevel,
      description: current.description,
      maxDailyLiters: current.maxDailyLiters === Infinity ? 'unlimited' : current.maxDailyLiters,
      allowedHours: current.allowedHours,
      usedToday: this.waterAnalytics.totalLitersToday,
      remainingToday: current.maxDailyLiters === Infinity ? 'unlimited' :
                      Math.max(0, current.maxDailyLiters - this.waterAnalytics.totalLitersToday)
    };
  }

  // ====================================================================
  //  PLANT DATABASE QUERIES
  // ====================================================================
  getPlantInfo(species) {
    return this.plantDatabase.find(function(p) {
      return p.species === species || p.commonName.toLowerCase() === species.toLowerCase();
    }) || null;
  }

  getPlantsForZone(zoneId) {
    return this.plantDatabase.filter(function(p) { return p.zonePreference === zoneId; });
  }

  getFrostTolerantPlants() {
    return this.plantDatabase.filter(function(p) { return p.frostTolerant; });
  }

  getPlantsByCategory(category) {
    return this.plantDatabase.filter(function(p) { return p.category === category; });
  }

  getHighWaterNeedPlants(minMLPerDay) {
    const threshold = minMLPerDay || 8;
    return this.plantDatabase.filter(function(p) { return p.waterNeedMLPerDay >= threshold; });
  }

  getPlantWateringGuide() {
    const guide = {};
    for (const plant of this.plantDatabase) {
      if (!guide[plant.zonePreference]) {
        guide[plant.zonePreference] = [];
      }
      guide[plant.zonePreference].push({
        species: plant.species,
        commonName: plant.commonName,
        dailyWaterML: plant.waterNeedMLPerDay,
        sunRequirement: plant.sunRequirement,
        frostTolerant: plant.frostTolerant
      });
    }
    return guide;
  }

  // ====================================================================
  //  DRIP IRRIGATION EFFICIENCY TRACKING
  // ====================================================================
  getDripEfficiencyReport() {
    const dripZones = this.zones.filter(function(z) { return z.dripEmitters > 0; });
    const report = {
      totalDripZones: dripZones.length,
      totalEmitters: 0,
      averageEfficiency: 0,
      zones: []
    };

    let efficiencySum = 0;
    for (const zone of dripZones) {
      report.totalEmitters += zone.dripEmitters;
      const zoneEfficiency = 85 + Math.random() * 15;
      efficiencySum += zoneEfficiency;

      report.zones.push({
        id: zone.id,
        name: zone.name,
        emitters: zone.dripEmitters,
        flowRateLPM: zone.flowRateLPM,
        efficiency: parseFloat(zoneEfficiency.toFixed(1)),
        waterSavedPercent: parseFloat((zoneEfficiency - 75).toFixed(1)),
        status: zoneEfficiency > 90 ? 'optimal' : zoneEfficiency > 80 ? 'good' : 'needs-maintenance'
      });
    }

    report.averageEfficiency = dripZones.length > 0 ?
      parseFloat((efficiencySum / dripZones.length).toFixed(1)) : 0;

    return report;
  }

  // ====================================================================
  //  SEASONAL PROFILE ACCESS
  // ====================================================================
  getCurrentSeasonalProfile() {
    const profile = this.seasonalProfiles[this.currentSeason];
    return {
      season: this.currentSeason,
      label: profile ? profile.label : 'Unknown',
      multiplier: this.currentSeasonMultiplier,
      description: profile ? profile.description : '',
      activeMonth: new Date().getMonth() + 1,
      allProfiles: Object.entries(this.seasonalProfiles).map(function(entry) {
        var key = entry[0];
        var p = entry[1];
        return {
          id: key,
          label: p.label,
          months: p.months,
          multiplier: p.multiplier
        };
      })
    };
  }

  // ====================================================================
  //  GREY WATER STATUS
  // ====================================================================
  getGreyWaterStatus() {
    return {
      enabled: this.greyWater.enabled,
      filterStatus: this.greyWater.filterStatus,
      filterLifePercent: this.greyWater.filterLifePercent,
      filterLastChanged: this.greyWater.filterLastChanged,
      filterNextChange: this.greyWater.filterNextChange,
      quality: {
        pH: this.greyWater.qualityPH,
        turbidity: this.greyWater.qualityTurbidity,
        BOD: this.greyWater.qualityBOD
      },
      totalRecycledLiters: this.greyWater.totalRecycledLiters,
      dailyCapacity: this.greyWater.dailyCapacityLiters,
      todayUsage: this.greyWater.currentDailyUsageLiters,
      suitableZones: this.greyWater.suitableForZones
    };
  }

  // ====================================================================
  //  WATERING LOG ACCESS
  // ====================================================================
  getWateringLog(limit) {
    const count = limit || 50;
    return this.wateringLog.slice(-count).reverse();
  }

  getZoneWateringHistory(zoneId, limit) {
    const count = limit || 20;
    return this.wateringLog
      .filter(function(entry) { return entry.zoneId === zoneId; })
      .slice(-count)
      .reverse();
  }

  // ====================================================================
  //  FROST PROTECTION STATUS
  // ====================================================================
  getFrostProtectionStatus() {
    return {
      enabled: this.frostProtection.enabled,
      drainActivated: this.frostProtection.drainActivated,
      pipesDrained: this.frostProtection.pipesDrained,
      lastDrainDate: this.frostProtection.lastDrainDate,
      autoResumeTemp: this.frostProtection.autoResumeTemp,
      currentTemp: this.weatherConditions.currentTemp,
      frostForecast: this.weatherConditions.frostForecast
    };
  }

  // ====================================================================
  //  LEAK DETECTION STATUS
  // ====================================================================
  getLeakDetectionStatus() {
    return {
      enabled: this.leakDetection.enabled,
      currentFlowRate: this.leakDetection.currentFlowRate,
      expectedFlowRate: this.leakDetection.expectedFlowRate,
      anomalyThreshold: this.leakDetection.anomalyThreshold,
      totalLeaksDetected: this.leakDetection.totalLeaksDetected,
      recentAlerts: this.leakDetection.leakAlerts.slice(-10).reverse(),
      lastCheck: this.leakDetection.lastCheck
    };
  }

  // ====================================================================
  //  WATER PRESSURE STATUS
  // ====================================================================
  getWaterPressureStatus() {
    return {
      current: this.waterPressure.current,
      min: this.waterPressure.min,
      max: this.waterPressure.max,
      unit: this.waterPressure.unit,
      status: this.waterPressure.current < this.waterPressure.min ? 'low' :
              this.waterPressure.current > this.waterPressure.max ? 'high' : 'normal',
      recentReadings: this.waterPressure.history.slice(-24),
      alerts: this.waterPressure.alerts.slice(-10).reverse(),
      lastReading: this.waterPressure.lastReading
    };
  }

  // ====================================================================
  //  WEATHER CONDITIONS ACCESS
  // ====================================================================
  getWeatherConditions() {
    return {
      currentTemp: this.weatherConditions.currentTemp,
      humidity: this.weatherConditions.humidity,
      windSpeed: this.weatherConditions.windSpeed,
      rainForecastMM: this.weatherConditions.rainForecastMM,
      frostForecast: this.weatherConditions.frostForecast,
      solarRadiation: this.weatherConditions.solarRadiation,
      lastUpdated: this.weatherConditions.lastUpdated,
      modifiers: this.evaluateWeatherModifiers()
    };
  }

  // ====================================================================
  //  SYSTEM DASHBOARD
  // ====================================================================
  getSystemDashboard() {
    const activeZones = this.zones.filter(function(z) { return z.status === 'watering'; }).length;
    const dryZones = this.zones.filter(function(z) { return z.moistureLevel < z.moistureThreshold; }).length;
    const totalUsageToday = this.waterAnalytics.totalLitersToday;
    const weatherMods = this.evaluateWeatherModifiers();

    return {
      system: {
        initialized: this.initialized,
        season: this.currentSeason,
        seasonMultiplier: this.currentSeasonMultiplier,
        activeWateringZones: activeZones,
        zonesNeedingWater: dryZones,
        totalZones: this.zones.length
      },
      water: {
        usageToday: totalUsageToday,
        costToday: parseFloat(((totalUsageToday / 1000) * 45).toFixed(2)),
        restrictionLevel: this.waterRestrictions.currentLevel,
        pressure: this.waterPressure.current,
        pressureUnit: this.waterPressure.unit
      },
      sources: this.getWaterSourceLevels(),
      weather: {
        temp: this.weatherConditions.currentTemp,
        humidity: this.weatherConditions.humidity,
        rainForecast: this.weatherConditions.rainForecastMM,
        frostForecast: this.weatherConditions.frostForecast,
        skipWatering: weatherMods.skipWatering,
        adjustmentFactor: weatherMods.adjustmentFactor
      },
      alerts: {
        leaks: this.leakDetection.totalLeaksDetected,
        pressureAlerts: this.waterPressure.alerts.length,
        sprinklerIssues: this.sprinklerHeads.filter(function(h) { return h.status !== 'active'; }).length,
        frostProtectionActive: this.frostProtection.pipesDrained,
        greyWaterFilterStatus: this.greyWater.filterStatus
      },
      et: {
        et0: this.currentET0 || 0,
        adjusted: this.adjustedET || 0
      }
    };
  }

  // ====================================================================
  //  STATISTICS
  // ====================================================================
  getStatistics() {
    return {
      initialized: this.initialized,
      totalZones: this.zones.length,
      enabledZones: this.zones.filter(function(z) { return z.enabled; }).length,
      activelyWatering: this.zones.filter(function(z) { return z.status === 'watering'; }).length,
      currentSeason: this.currentSeason,
      seasonMultiplier: this.currentSeasonMultiplier,
      totalWaterUsedToday: this.waterAnalytics.totalLitersToday,
      totalWaterUsedThisMonth: this.waterAnalytics.totalLitersThisMonth,
      costToday: parseFloat(((this.waterAnalytics.totalLitersToday / 1000) * 45).toFixed(2)),
      costThisMonth: parseFloat(((this.waterAnalytics.totalLitersThisMonth / 1000) * 45).toFixed(2)),
      waterSources: this.waterSources.length,
      rainBarrelLevel: this.waterSources.find(function(s) { return s.id === 'rainBarrel'; }).currentLevel,
      cisternLevel: this.waterSources.find(function(s) { return s.id === 'cistern'; }).currentLevel,
      waterPressure: this.waterPressure.current,
      et0: this.currentET0 || 0,
      adjustedET: this.adjustedET || 0,
      restrictionLevel: this.waterRestrictions.currentLevel,
      leaksDetected: this.leakDetection.totalLeaksDetected,
      frostProtectionActive: this.frostProtection.pipesDrained,
      sprinklerHeadsTotal: this.sprinklerHeads.length,
      sprinklerIssues: this.sprinklerHeads.filter(function(h) { return h.status !== 'active'; }).length,
      greyWaterFilterLife: this.greyWater.filterLifePercent,
      plantDatabaseCount: this.plantDatabase.length,
      wateringLogEntries: this.wateringLog.length,
      activeSchedules: this.activeSchedules.filter(function(s) { return s.enabled; }).length,
      intervalsRunning: this.intervals.length,
      dailyUsageArray: this.dailyWaterUsage,
      weeklyUsageArray: this.weeklyWaterUsage,
      monthlyUsageArray: this.monthlyWaterUsage
    };
  }

  // ====================================================================
  //  DESTROY
  // ====================================================================
  destroy() {
    for (const interval of this.intervals) {
      clearInterval(interval);
    }
    this.intervals = [];
    this.homey.log('[Irrigation] Smart Irrigation & Water Conservation System destroyed');
  }
}

module.exports = SmartIrrigationWaterConservationSystem;
