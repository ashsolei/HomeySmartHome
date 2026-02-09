'use strict';

/**
 * SmartSeasonalAdaptationSystem
 * Wave 14 — Comprehensive automatic seasonal adaptation for Nordic smart homes
 *
 * Features:
 *  - Nordic 8-sub-season engine with transition detection
 *  - Daylight adaptation & SAD light therapy
 *  - Heating / ventilation / humidity seasonal profiles
 *  - Window & blind automation (solar shading, storm protection)
 *  - Lighting color temperature curves (circadian + seasonal)
 *  - Garden / outdoor / irrigation scheduling
 *  - Energy optimization per season
 *  - Swedish holiday automation & decoration lighting
 *  - Clothing / comfort / pollen / UV alerts
 *  - Pool & outdoor water management
 *  - Wildlife & nature activity
 *  - Seasonal maintenance reminders
 *  - Sleep environment adaptation
 *  - Food / kitchen seasonal suggestions
 *  - Transition management with hysteresis & seasonal score
 */

const STOCKHOLM_LATITUDE = 59.3;
const STOCKHOLM_LONGITUDE = 18.07;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

// ---------------------------------------------------------------------------
// Nordic sub-season definitions
// ---------------------------------------------------------------------------
const NORDIC_SEASONS = {
  MIDWINTER: {
    id: 'midwinter',
    label: 'Midvinter',
    months: [12, 1],
    lighting: { colorTempDay: 6500, colorTempEvening: 2700, brightnessDay: 100, brightnessEvening: 70 },
    heating: { dayTarget: 21, nightTarget: 18, mode: 'full' },
    ventilation: { mode: 'minimal', heatRecovery: true, freshAirPercent: 15 },
    humidity: { target: [35, 45], mode: 'humidify' },
    description: 'Coldest, darkest period — maximum heating, SAD compensation lighting'
  },
  LATE_WINTER: {
    id: 'late_winter',
    label: 'Senvinter',
    months: [2],
    lighting: { colorTempDay: 6000, colorTempEvening: 2700, brightnessDay: 95, brightnessEvening: 65 },
    heating: { dayTarget: 21, nightTarget: 18, mode: 'full' },
    ventilation: { mode: 'minimal', heatRecovery: true, freshAirPercent: 20 },
    humidity: { target: [35, 45], mode: 'humidify' },
    description: 'Still cold but daylight increasing — begin transition awareness'
  },
  EARLY_SPRING: {
    id: 'early_spring',
    label: 'Tidig vår',
    months: [3, 4],
    lighting: { colorTempDay: 5500, colorTempEvening: 2700, brightnessDay: 85, brightnessEvening: 60 },
    heating: { dayTarget: 20, nightTarget: 18, mode: 'moderate' },
    ventilation: { mode: 'increasing', heatRecovery: true, freshAirPercent: 35 },
    humidity: { target: [35, 50], mode: 'transitional' },
    description: 'Warming up, pollen season starting — increase ventilation cautiously'
  },
  LATE_SPRING: {
    id: 'late_spring',
    label: 'Senvår',
    months: [5],
    lighting: { colorTempDay: 5000, colorTempEvening: 2700, brightnessDay: 70, brightnessEvening: 50 },
    heating: { dayTarget: 20, nightTarget: 18, mode: 'low' },
    ventilation: { mode: 'fresh', heatRecovery: false, freshAirPercent: 55 },
    humidity: { target: [40, 55], mode: 'balanced' },
    description: 'Mild weather, long days — open windows, reduce heating'
  },
  SUMMER: {
    id: 'summer',
    label: 'Sommar',
    months: [6, 7],
    lighting: { colorTempDay: 4000, colorTempEvening: 2700, brightnessDay: 50, brightnessEvening: 40 },
    heating: { dayTarget: 24, nightTarget: 22, mode: 'cooling' },
    ventilation: { mode: 'natural', heatRecovery: false, freshAirPercent: 80 },
    humidity: { target: [40, 60], mode: 'dehumidify_if_needed' },
    description: 'Warmest period, midnight sun — minimal artificial light, natural ventilation'
  },
  LATE_SUMMER: {
    id: 'late_summer',
    label: 'Sensommar',
    months: [8],
    lighting: { colorTempDay: 4500, colorTempEvening: 2700, brightnessDay: 60, brightnessEvening: 50 },
    heating: { dayTarget: 22, nightTarget: 19, mode: 'standby' },
    ventilation: { mode: 'fresh', heatRecovery: false, freshAirPercent: 60 },
    humidity: { target: [40, 55], mode: 'balanced' },
    description: 'Days shortening, harvest season — begin autumn preparation'
  },
  AUTUMN: {
    id: 'autumn',
    label: 'Höst',
    months: [9, 10],
    lighting: { colorTempDay: 5500, colorTempEvening: 2700, brightnessDay: 80, brightnessEvening: 60 },
    heating: { dayTarget: 20, nightTarget: 18, mode: 'moderate' },
    ventilation: { mode: 'dehumidify', heatRecovery: true, freshAirPercent: 30 },
    humidity: { target: [35, 50], mode: 'dehumidify' },
    description: 'Cooling down, rainy — dehumidification focus, gutter cleaning'
  },
  DARK_NOVEMBER: {
    id: 'dark_november',
    label: 'Mörka november',
    months: [11],
    lighting: { colorTempDay: 6500, colorTempEvening: 2700, brightnessDay: 100, brightnessEvening: 70 },
    heating: { dayTarget: 21, nightTarget: 18, mode: 'full' },
    ventilation: { mode: 'minimal', heatRecovery: true, freshAirPercent: 20 },
    humidity: { target: [35, 45], mode: 'humidify' },
    description: 'Darkest transition month — full SAD compensation, prepare for winter'
  }
};

// ---------------------------------------------------------------------------
// Swedish holidays
// ---------------------------------------------------------------------------
const SWEDISH_HOLIDAYS_TEMPLATES = [
  { name: 'Nyårsdagen', month: 1, day: 1, scene: 'new_year', decoration: 'fireworks_lights' },
  { name: 'Trettondedag jul', month: 1, day: 6, scene: 'epiphany', decoration: 'star_lights' },
  { name: 'Alla hjärtans dag', month: 2, day: 14, scene: 'valentines', decoration: 'warm_red' },
  { name: 'Valborg', month: 4, day: 30, scene: 'walpurgis', decoration: 'bonfire_warm' },
  { name: 'Första maj', month: 5, day: 1, scene: 'may_day', decoration: 'spring_colors' },
  { name: 'Nationaldagen', month: 6, day: 6, scene: 'national_day', decoration: 'blue_yellow' },
  { name: 'Alla helgons dag', month: 11, day: 1, scene: 'all_saints', decoration: 'candle_warm' },
  { name: 'Lucia', month: 12, day: 13, scene: 'lucia', decoration: 'candle_procession' },
  { name: 'Julafton', month: 12, day: 24, scene: 'christmas_eve', decoration: 'christmas_full' },
  { name: 'Juldagen', month: 12, day: 25, scene: 'christmas', decoration: 'christmas_full' },
  { name: 'Annandag jul', month: 12, day: 26, scene: 'christmas_second', decoration: 'christmas_full' },
  { name: 'Nyårsafton', month: 12, day: 31, scene: 'new_years_eve', decoration: 'party_lights' }
];

// Easter and Midsommar are movable — computed at runtime

// ---------------------------------------------------------------------------
// Maintenance schedule templates
// ---------------------------------------------------------------------------
const MAINTENANCE_SCHEDULE = [
  { task: 'HVAC filter replacement', months: [1, 4, 7, 10], priority: 'high' },
  { task: 'Gutter cleaning', months: [10, 11], priority: 'high' },
  { task: 'Roof inspection', months: [3, 4], priority: 'medium' },
  { task: 'Chimney sweep', months: [9, 10], priority: 'high' },
  { task: 'Window cleaning', months: [4, 5, 9, 10], priority: 'low' },
  { task: 'Exterior painting check', months: [5, 6, 7, 8, 9], priority: 'low' },
  { task: 'Smoke detector battery check', months: [3, 9], priority: 'high' },
  { task: 'Heat pump service', months: [3, 9], priority: 'medium' },
  { task: 'Outdoor furniture maintenance', months: [5, 9], priority: 'low' },
  { task: 'Garden tool maintenance', months: [3, 10], priority: 'low' }
];

// ---------------------------------------------------------------------------
// Seasonal recipe / food suggestions
// ---------------------------------------------------------------------------
const SEASONAL_FOOD = {
  midwinter: { suggestions: ['Rotfruktsgryta', 'Ärtsoppa', 'Kålpudding'], baking: ['Lussebullar', 'Pepparkakor'], outdoor: false },
  late_winter: { suggestions: ['Pannkaka med lingon', 'Semlor'], baking: ['Semlor', 'Fastlagsbullar'], outdoor: false },
  early_spring: { suggestions: ['Vårsoppa', 'Färsk sparris'], baking: ['Påskbröd'], outdoor: false },
  late_spring: { suggestions: ['Färskpotatis', 'Grillad lax'], baking: ['Rabarberpaj'], outdoor: true },
  summer: { suggestions: ['Grillat kött', 'Sill och nypotatis', 'Jordgubbar med grädde'], baking: ['Jordgubbstårta'], outdoor: true },
  late_summer: { suggestions: ['Kräftor', 'Svampsås', 'Inlagda gurkor'], baking: ['Blåbärspaj'], outdoor: true },
  autumn: { suggestions: ['Älggryta', 'Kantarelltoast', 'Rotfrukter'], baking: ['Äppelpaj', 'Kanelbullar'], outdoor: false },
  dark_november: { suggestions: ['Julskinka preparation', 'Glögg', 'Pepparkaksdeg'], baking: ['Pepparkakor', 'Lussebullar'], outdoor: false }
};

// ---------------------------------------------------------------------------
// Pollen data (simplified)
// ---------------------------------------------------------------------------
const POLLEN_SEASONS = [
  { type: 'Al (Alder)', startMonth: 3, endMonth: 4, peakMonth: 3, severity: 'moderate' },
  { type: 'Björk (Birch)', startMonth: 4, endMonth: 5, peakMonth: 5, severity: 'high' },
  { type: 'Gräs (Grass)', startMonth: 5, endMonth: 8, peakMonth: 6, severity: 'high' },
  { type: 'Gråbo (Mugwort)', startMonth: 7, endMonth: 9, peakMonth: 8, severity: 'moderate' }
];

// ---------------------------------------------------------------------------
// Main class
// ---------------------------------------------------------------------------
class SmartSeasonalAdaptationSystem {
  constructor(homey) {
    this.homey = homey;

    // State
    this.currentSeason = null;
    this.previousSeason = null;
    this.transitionProgress = 0; // 0-100
    this.transitionActive = false;
    this.transitionStartDate = null;
    this.transitionDurationDays = 14;
    this.seasonalScore = 0;
    this.manualOverride = false;
    this.manualOverrideExpiry = null;

    // Tracked data
    this.temperatureHistory = [];
    this.daylightHistory = [];
    this.heatingDegreeDays = 0;
    this.energyBudget = { forecast: 0, actual: 0, savings: 0 };

    // Daylight data
    this.sunrise = null;
    this.sunset = null;
    this.daylightHours = 0;

    // Holiday cache
    this.holidays = [];
    this.upcomingHolidays = [];

    // Maintenance reminders
    this.maintenanceDue = [];
    this.maintenanceCompleted = [];

    // Intervals
    this._monitoringInterval = null;
    this._daylightInterval = null;

    // Configuration
    this.config = {
      latitude: STOCKHOLM_LATITUDE,
      longitude: STOCKHOLM_LONGITUDE,
      sadLightEnabled: true,
      sadLightLux: 10000,
      sadLightDurationMin: 30,
      dawnSimulationEnabled: true,
      dawnSimulationMinutes: 30,
      alarmTime: { hour: 7, minute: 0 },
      frostProtectionTemp: 10,
      stormWindThreshold: 60,
      co2ForceVentThreshold: 800,
      solarShadingTempThreshold: 25,
      solarShadingAngleThreshold: 30,
      poolOpenMonth: 5,
      poolCloseMonth: 9,
      monitoringIntervalMs: 10 * 60 * 1000,
      transitionHysteresisHours: 48,
      blindAutomationEnabled: true,
      gardenIrrigationEnabled: true,
      pollenAlertEnabled: true,
      uvAlertEnabled: true,
      wildlifeNotificationsEnabled: true,
      clothingAlertEnabled: true,
      foodSuggestionsEnabled: true,
      poolManagementEnabled: true
    };

    // Current environmental state
    this.environment = {
      outdoorTemp: null,
      indoorTemp: null,
      indoorHumidity: null,
      co2Level: null,
      windSpeed: null,
      windDirection: null,
      uvIndex: null,
      cloudCover: null,
      rainfall: null,
      snowDepth: null,
      airQualityIndex: null,
      pollenLevel: null
    };

    // Active profiles
    this.activeProfiles = {
      lighting: null,
      heating: null,
      ventilation: null,
      humidity: null,
      blinds: null,
      sleep: null
    };

    // Statistics
    this.stats = {
      seasonTransitions: 0,
      holidayScenesActivated: 0,
      sadSessionsCompleted: 0,
      dawnSimulationsRun: 0,
      stormProtectionsActivated: 0,
      maintenanceReminders: 0,
      clothingAlertsSent: 0,
      energyOptimizations: 0,
      pollenAlertsSent: 0,
      uvAlertsSent: 0,
      ventilationOverrides: 0,
      blindAdjustments: 0,
      irrigationCycles: 0,
      frostProtections: 0,
      totalMonitoringCycles: 0
    };
  }

  // =========================================================================
  // Lifecycle
  // =========================================================================

  async initialize() {
    this.log('Initializing SmartSeasonalAdaptationSystem...');

    this._buildHolidayCalendar();
    this._updateDaylight();
    this._detectCurrentSeason();
    this._applySeasonalProfiles();
    this._checkMaintenanceSchedule();
    this._calculateSeasonalScore();

    // Main monitoring loop — every 10 minutes
    this._monitoringInterval = setInterval(() => {
      this._monitoringCycle();
    }, this.config.monitoringIntervalMs);

    // Daylight recalculation — every hour
    this._daylightInterval = setInterval(() => {
      this._updateDaylight();
    }, 60 * 60 * 1000);

    this.log(`Initialized — Season: ${this.currentSeason ? this.currentSeason.label : 'unknown'}, ` +
             `Daylight: ${this.daylightHours.toFixed(1)}h, Score: ${this.seasonalScore}`);
    return true;
  }

  getStatistics() {
    return {
      currentSeason: this.currentSeason ? this.currentSeason.id : null,
      currentSeasonLabel: this.currentSeason ? this.currentSeason.label : null,
      previousSeason: this.previousSeason ? this.previousSeason.id : null,
      transitionActive: this.transitionActive,
      transitionProgress: this.transitionProgress,
      seasonalScore: this.seasonalScore,
      manualOverride: this.manualOverride,
      sunrise: this.sunrise,
      sunset: this.sunset,
      daylightHours: this.daylightHours,
      heatingDegreeDays: this.heatingDegreeDays,
      energyBudget: { ...this.energyBudget },
      upcomingHolidays: this.upcomingHolidays.slice(0, 5),
      maintenanceDue: [...this.maintenanceDue],
      activeProfiles: { ...this.activeProfiles },
      environment: { ...this.environment },
      config: { ...this.config },
      stats: { ...this.stats }
    };
  }

  log(msg) {
    if (this.homey && typeof this.homey.log === 'function') {
      this.homey.log(`[Seasonal] ${msg}`);
    } else {
      console.log(`[Seasonal] ${msg}`);
    }
  }

  error(msg) {
    if (this.homey && typeof this.homey.error === 'function') {
      this.homey.error(`[Seasonal] ${msg}`);
    } else {
      console.error(`[Seasonal] ${msg}`);
    }
  }

  destroy() {
    this.log('Destroying SmartSeasonalAdaptationSystem...');
    if (this._monitoringInterval) {
      clearInterval(this._monitoringInterval);
      this._monitoringInterval = null;
    }
    if (this._daylightInterval) {
      clearInterval(this._daylightInterval);
      this._daylightInterval = null;
    }
    this.temperatureHistory = [];
    this.daylightHistory = [];
    this.holidays = [];
    this.upcomingHolidays = [];
    this.maintenanceDue = [];
    this.log('Destroyed.');
  }

  // =========================================================================
  // Core monitoring cycle (every 10 min)
  // =========================================================================

  async _monitoringCycle() {
    try {
      this.stats.totalMonitoringCycles++;

      this._updateDaylight();
      this._detectCurrentSeason();
      this._processTransition();
      this._applySeasonalProfiles();
      this._evaluateHeating();
      this._evaluateVentilation();
      this._evaluateHumidity();
      this._evaluateBlindsAndWindows();
      this._evaluateLightingColorTemp();
      this._evaluateSADTherapy();
      this._evaluateDawnSimulation();
      this._evaluateEnergyOptimization();
      this._evaluateGardenOutdoor();
      this._evaluatePoolOutdoorWater();
      this._evaluateHolidayAutomation();
      this._evaluateClothingComfortAlerts();
      this._evaluatePollenAlerts();
      this._evaluateUVWarnings();
      this._evaluateWildlifeNature();
      this._evaluateSleepAdaptation();
      this._evaluateFoodSuggestions();
      this._checkMaintenanceSchedule();
      this._trackTemperature();
      this._updateHeatingDegreeDays();
      this._calculateSeasonalScore();
      this._calculateEnergyBudget();
    } catch (err) {
      this.error(`Monitoring cycle error: ${err.message}`);
    }
  }

  // =========================================================================
  // 1. Nordic Season Engine
  // =========================================================================

  _detectCurrentSeason() {
    if (this.manualOverride && this.manualOverrideExpiry && Date.now() < this.manualOverrideExpiry) {
      return;
    }
    if (this.manualOverride && this.manualOverrideExpiry && Date.now() >= this.manualOverrideExpiry) {
      this.manualOverride = false;
      this.manualOverrideExpiry = null;
      this.log('Manual override expired — resuming automatic detection');
    }

    const now = new Date();
    const month = now.getMonth() + 1;

    let detectedSeason = null;
    for (const key of Object.keys(NORDIC_SEASONS)) {
      const season = NORDIC_SEASONS[key];
      if (season.months.includes(month)) {
        detectedSeason = season;
        break;
      }
    }

    if (!detectedSeason) {
      detectedSeason = NORDIC_SEASONS.MIDWINTER;
    }

    // Temperature-based adjustment — if unusually warm/cold, shift season
    detectedSeason = this._adjustSeasonByTemperature(detectedSeason, month);

    if (this.currentSeason && this.currentSeason.id !== detectedSeason.id) {
      this._initiateTransition(this.currentSeason, detectedSeason);
    } else if (!this.currentSeason) {
      this.currentSeason = detectedSeason;
      this.log(`Season detected: ${detectedSeason.label}`);
    }
  }

  _adjustSeasonByTemperature(baseSeason, month) {
    if (this.temperatureHistory.length < 6) return baseSeason;

    const recentTemps = this.temperatureHistory.slice(-6);
    const avgTemp = recentTemps.reduce((s, t) => s + t.value, 0) / recentTemps.length;

    const seasonKeys = Object.keys(NORDIC_SEASONS);
    const currentIndex = seasonKeys.findIndex(k => NORDIC_SEASONS[k].id === baseSeason.id);

    // If avg temp is significantly warmer than expected, nudge toward next season
    if (month >= 2 && month <= 6 && avgTemp > this._expectedTempForSeason(baseSeason) + 5) {
      const nextIndex = Math.min(currentIndex + 1, seasonKeys.length - 1);
      return NORDIC_SEASONS[seasonKeys[nextIndex]];
    }
    // If significantly cooler, nudge back
    if (month >= 8 && month <= 11 && avgTemp < this._expectedTempForSeason(baseSeason) - 5) {
      const prevIndex = Math.max(currentIndex - 1, 0);
      return NORDIC_SEASONS[seasonKeys[prevIndex]];
    }

    return baseSeason;
  }

  _expectedTempForSeason(season) {
    const temps = {
      midwinter: -3, late_winter: -1, early_spring: 5, late_spring: 12,
      summer: 20, late_summer: 18, autumn: 8, dark_november: 2
    };
    return temps[season.id] || 10;
  }

  // =========================================================================
  // Transition Management
  // =========================================================================

  _initiateTransition(fromSeason, toSeason) {
    // Hysteresis check
    if (this.transitionStartDate) {
      const hoursSinceLastTransition = (Date.now() - this.transitionStartDate.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastTransition < this.config.transitionHysteresisHours) {
        return;
      }
    }

    this.previousSeason = fromSeason;
    this.currentSeason = toSeason;
    this.transitionActive = true;
    this.transitionProgress = 0;
    this.transitionStartDate = new Date();
    this.stats.seasonTransitions++;

    this.log(`Season transition: ${fromSeason.label} → ${toSeason.label} ` +
             `(${this.transitionDurationDays} day ramp)`);
  }

  _processTransition() {
    if (!this.transitionActive || !this.transitionStartDate) return;

    const elapsed = Date.now() - this.transitionStartDate.getTime();
    const durationMs = this.transitionDurationDays * 24 * 60 * 60 * 1000;
    this.transitionProgress = Math.min(100, Math.round((elapsed / durationMs) * 100));

    if (this.transitionProgress >= 100) {
      this.transitionActive = false;
      this.previousSeason = null;
      this.transitionProgress = 100;
      this.log(`Transition complete — now fully in ${this.currentSeason.label}`);
    }
  }

  _interpolateValue(fromVal, toVal) {
    if (!this.transitionActive || this.transitionProgress >= 100) return toVal;
    const ratio = this.transitionProgress / 100;
    return fromVal + (toVal - fromVal) * ratio;
  }

  // =========================================================================
  // 2. Daylight Adaptation
  // =========================================================================

  _updateDaylight() {
    const now = new Date();
    const dayOfYear = this._getDayOfYear(now);
    const lat = this.config.latitude;

    // Solar declination
    const declination = 23.45 * Math.sin(DEG_TO_RAD * (360 / 365) * (dayOfYear - 81));
    const decRad = declination * DEG_TO_RAD;
    const latRad = lat * DEG_TO_RAD;

    // Hour angle
    const cosHourAngle = -Math.tan(latRad) * Math.tan(decRad);
    let hourAngle;
    if (cosHourAngle < -1) {
      // Midnight sun
      hourAngle = 180;
    } else if (cosHourAngle > 1) {
      // Polar night
      hourAngle = 0;
    } else {
      hourAngle = Math.acos(cosHourAngle) * RAD_TO_DEG;
    }

    this.daylightHours = (2 * hourAngle) / 15;

    // Approximate sunrise/sunset (solar noon ~12:00 for simplicity)
    const solarNoon = 12;
    const halfDay = hourAngle / 15;
    const sunriseHour = solarNoon - halfDay;
    const sunsetHour = solarNoon + halfDay;

    this.sunrise = this._decimalHourToTimeString(Math.max(0, sunriseHour));
    this.sunset = this._decimalHourToTimeString(Math.min(24, sunsetHour));

    this.daylightHistory.push({
      date: now.toISOString().slice(0, 10),
      hours: this.daylightHours,
      sunrise: this.sunrise,
      sunset: this.sunset
    });

    // Keep 90 days of history
    if (this.daylightHistory.length > 90) {
      this.daylightHistory = this.daylightHistory.slice(-90);
    }
  }

  _getDayOfYear(date) {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date - start;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  _decimalHourToTimeString(decHour) {
    const h = Math.floor(decHour);
    const m = Math.round((decHour - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  _getSunAngle() {
    const now = new Date();
    const dayOfYear = this._getDayOfYear(now);
    const hour = now.getHours() + now.getMinutes() / 60;
    const declination = 23.45 * Math.sin(DEG_TO_RAD * (360 / 365) * (dayOfYear - 81));
    const hourAngle = (hour - 12) * 15;
    const latRad = this.config.latitude * DEG_TO_RAD;
    const decRad = declination * DEG_TO_RAD;
    const haRad = hourAngle * DEG_TO_RAD;

    const sinAlt = Math.sin(latRad) * Math.sin(decRad) +
                   Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad);
    return Math.asin(sinAlt) * RAD_TO_DEG;
  }

  _getSunAzimuth() {
    const now = new Date();
    const dayOfYear = this._getDayOfYear(now);
    const hour = now.getHours() + now.getMinutes() / 60;
    const declination = 23.45 * Math.sin(DEG_TO_RAD * (360 / 365) * (dayOfYear - 81));
    const hourAngle = (hour - 12) * 15;
    const latRad = this.config.latitude * DEG_TO_RAD;
    const decRad = declination * DEG_TO_RAD;
    const haRad = hourAngle * DEG_TO_RAD;

    const sinAlt = Math.sin(latRad) * Math.sin(decRad) +
                   Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad);
    const altitude = Math.asin(sinAlt);
    const cosAz = (Math.sin(decRad) - Math.sin(latRad) * sinAlt) /
                  (Math.cos(latRad) * Math.cos(altitude));
    let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAz))) * RAD_TO_DEG;
    if (hourAngle > 0) azimuth = 360 - azimuth;
    return azimuth;
  }

  // =========================================================================
  // SAD Light Therapy
  // =========================================================================

  _evaluateSADTherapy() {
    if (!this.config.sadLightEnabled) return;
    if (!this.currentSeason) return;

    const darkSeasons = ['midwinter', 'late_winter', 'dark_november'];
    if (!darkSeasons.includes(this.currentSeason.id)) return;

    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();

    // Activate SAD light in the morning (7:00–8:00)
    if (hour === 7 && minute < this.config.sadLightDurationMin) {
      this._activateSADLight();
    }
  }

  _activateSADLight() {
    this.stats.sadSessionsCompleted++;
    this.log(`SAD light therapy session — ${this.config.sadLightLux} lux for ` +
             `${this.config.sadLightDurationMin} min`);
    this._emitEvent('sad_light_activated', {
      lux: this.config.sadLightLux,
      durationMin: this.config.sadLightDurationMin,
      season: this.currentSeason.id
    });
  }

  // =========================================================================
  // Dawn Simulation
  // =========================================================================

  _evaluateDawnSimulation() {
    if (!this.config.dawnSimulationEnabled) return;

    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const alarmHour = this.config.alarmTime.hour;
    const alarmMinute = this.config.alarmTime.minute;

    // Start dawn simulation 30 min before alarm
    const alarmTotalMin = alarmHour * 60 + alarmMinute;
    const nowTotalMin = hour * 60 + minute;
    const dawnStartMin = alarmTotalMin - this.config.dawnSimulationMinutes;

    if (nowTotalMin >= dawnStartMin && nowTotalMin < alarmTotalMin) {
      const progress = (nowTotalMin - dawnStartMin) / this.config.dawnSimulationMinutes;
      const brightness = Math.round(progress * 100);
      const colorTemp = Math.round(2700 + progress * (this._getMorningColorTemp() - 2700));

      this.stats.dawnSimulationsRun++;
      this._emitEvent('dawn_simulation', {
        brightness,
        colorTemp,
        progress: Math.round(progress * 100),
        season: this.currentSeason ? this.currentSeason.id : 'unknown'
      });
    }
  }

  _getMorningColorTemp() {
    if (!this.currentSeason) return 5000;
    return this.currentSeason.lighting.colorTempDay;
  }

  // =========================================================================
  // 3. Heating Profiles
  // =========================================================================

  _evaluateHeating() {
    if (!this.currentSeason) return;

    const profile = this.currentSeason.heating;
    const now = new Date();
    const hour = now.getHours();
    const isNight = hour >= 22 || hour < 6;

    let targetTemp;
    if (this.transitionActive && this.previousSeason) {
      const fromProfile = this.previousSeason.heating;
      const dayTarget = this._interpolateValue(
        fromProfile.dayTarget, profile.dayTarget
      );
      const nightTarget = this._interpolateValue(
        fromProfile.nightTarget, profile.nightTarget
      );
      targetTemp = isNight ? nightTarget : dayTarget;
    } else {
      targetTemp = isNight ? profile.nightTarget : profile.dayTarget;
    }

    // Frost protection override
    if (this.environment.indoorTemp !== null && this.environment.indoorTemp < this.config.frostProtectionTemp) {
      targetTemp = Math.max(targetTemp, this.config.frostProtectionTemp);
      this.stats.frostProtections++;
      this.log(`Frost protection activated — heating to ${this.config.frostProtectionTemp}°C`);
    }

    this.activeProfiles.heating = {
      targetTemp: Math.round(targetTemp * 10) / 10,
      mode: profile.mode,
      isNight,
      frostProtection: this.environment.indoorTemp !== null &&
                        this.environment.indoorTemp < this.config.frostProtectionTemp
    };

    this._emitEvent('heating_profile_update', this.activeProfiles.heating);
  }

  _updateHeatingDegreeDays() {
    if (this.environment.outdoorTemp === null) return;
    const baseTemp = 17; // Swedish standard
    const hdd = Math.max(0, baseTemp - this.environment.outdoorTemp);
    this.heatingDegreeDays += hdd / 144; // 10-min intervals, 144 per day
  }

  // =========================================================================
  // 4. Ventilation Strategy
  // =========================================================================

  _evaluateVentilation() {
    if (!this.currentSeason) return;

    const profile = this.currentSeason.ventilation;
    let freshAirPercent = profile.freshAirPercent;
    let mode = profile.mode;
    let override = false;

    // CO2 override
    if (this.environment.co2Level !== null && this.environment.co2Level > this.config.co2ForceVentThreshold) {
      freshAirPercent = Math.max(freshAirPercent, 80);
      mode = 'forced_co2';
      override = true;
      this.stats.ventilationOverrides++;
      this.log(`CO2 override: ${this.environment.co2Level} ppm > ${this.config.co2ForceVentThreshold} ppm`);
    }

    // Summer natural ventilation — suggest opening windows
    if (this.currentSeason.id === 'summer' || this.currentSeason.id === 'late_spring') {
      if (this.environment.outdoorTemp !== null && this.environment.indoorTemp !== null) {
        if (this.environment.outdoorTemp < this.environment.indoorTemp &&
            this.environment.outdoorTemp > 15 && this.environment.outdoorTemp < 28) {
          mode = 'natural_open_windows';
        }
      }
    }

    // Transition interpolation
    if (this.transitionActive && this.previousSeason && !override) {
      freshAirPercent = this._interpolateValue(
        this.previousSeason.ventilation.freshAirPercent,
        profile.freshAirPercent
      );
    }

    this.activeProfiles.ventilation = {
      mode,
      freshAirPercent: Math.round(freshAirPercent),
      heatRecovery: profile.heatRecovery,
      override
    };

    this._emitEvent('ventilation_profile_update', this.activeProfiles.ventilation);
  }

  // =========================================================================
  // 5. Window / Blind Automation
  // =========================================================================

  _evaluateBlindsAndWindows() {
    if (!this.config.blindAutomationEnabled) return;
    if (!this.currentSeason) return;

    const sunAngle = this._getSunAngle();
    const sunAzimuth = this._getSunAzimuth();
    const season = this.currentSeason.id;

    let blindAction = { south: 'open', east: 'open', west: 'open', north: 'open' };
    let reason = 'default';

    // Storm protection — close all blinds
    if (this.environment.windSpeed !== null && this.environment.windSpeed > this.config.stormWindThreshold) {
      blindAction = { south: 'closed', east: 'closed', west: 'closed', north: 'closed' };
      reason = 'storm_protection';
      this.stats.stormProtectionsActivated++;
      this.log(`Storm protection: wind ${this.environment.windSpeed} km/h > ${this.config.stormWindThreshold} km/h — closing all blinds`);
    }
    // Summer solar shading
    else if ((season === 'summer' || season === 'late_spring' || season === 'late_summer') &&
             sunAngle > this.config.solarShadingAngleThreshold &&
             this.environment.outdoorTemp !== null &&
             this.environment.outdoorTemp > this.config.solarShadingTempThreshold) {
      // Close south-facing blinds
      if (sunAzimuth >= 135 && sunAzimuth <= 225) {
        blindAction.south = 'closed';
      }
      if (sunAzimuth >= 45 && sunAzimuth < 135) {
        blindAction.east = 'closed';
      }
      if (sunAzimuth > 225 && sunAzimuth <= 315) {
        blindAction.west = 'closed';
      }
      reason = 'solar_shading';
    }
    // Winter — maximize solar gain
    else if (season === 'midwinter' || season === 'late_winter' || season === 'dark_november') {
      if (sunAngle > 0 && this.environment.cloudCover !== null && this.environment.cloudCover < 50) {
        blindAction = { south: 'open', east: 'open', west: 'open', north: 'open' };
        reason = 'maximize_solar_gain';
      }
    }

    this.activeProfiles.blinds = { ...blindAction, reason };
    this.stats.blindAdjustments++;
    this._emitEvent('blind_automation', this.activeProfiles.blinds);
  }

  // =========================================================================
  // 6. Lighting Color Temperature
  // =========================================================================

  _evaluateLightingColorTemp() {
    if (!this.currentSeason) return;

    const now = new Date();
    const hour = now.getHours();
    const profile = this.currentSeason.lighting;

    let colorTemp;
    let brightness;

    // Evening — always warm
    if (hour >= 19 || hour < 5) {
      colorTemp = profile.colorTempEvening;
      brightness = profile.brightnessEvening;
    }
    // Morning transition
    else if (hour >= 5 && hour < 9) {
      const morningProgress = (hour - 5) / 4;
      colorTemp = Math.round(profile.colorTempEvening +
                  morningProgress * (profile.colorTempDay - profile.colorTempEvening));
      brightness = Math.round(profile.brightnessEvening +
                   morningProgress * (profile.brightnessDay - profile.brightnessEvening));
    }
    // Daytime
    else if (hour >= 9 && hour < 17) {
      colorTemp = profile.colorTempDay;
      brightness = profile.brightnessDay;
    }
    // Evening transition
    else {
      const eveningProgress = (hour - 17) / 2;
      colorTemp = Math.round(profile.colorTempDay +
                  eveningProgress * (profile.colorTempEvening - profile.colorTempDay));
      brightness = Math.round(profile.brightnessDay +
                   eveningProgress * (profile.brightnessEvening - profile.brightnessDay));
    }

    // Midsummer — minimal artificial light
    if (this.currentSeason.id === 'summer' && this.daylightHours > 18) {
      brightness = Math.round(brightness * 0.4);
    }

    // Transition interpolation
    if (this.transitionActive && this.previousSeason) {
      const prevProfile = this.previousSeason.lighting;
      const prevColorTemp = hour >= 19 || hour < 5 ? prevProfile.colorTempEvening : prevProfile.colorTempDay;
      colorTemp = Math.round(this._interpolateValue(prevColorTemp, colorTemp));
    }

    this.activeProfiles.lighting = { colorTemp, brightness };
    this._emitEvent('lighting_color_temp', { colorTemp, brightness, season: this.currentSeason.id });
  }

  // =========================================================================
  // 7. Garden / Outdoor
  // =========================================================================

  _evaluateGardenOutdoor() {
    if (!this.config.gardenIrrigationEnabled) return;
    if (!this.currentSeason) return;

    const season = this.currentSeason.id;
    const actions = [];

    // Irrigation scheduling
    const irrigationSeasons = ['late_spring', 'summer', 'late_summer'];
    if (irrigationSeasons.includes(season)) {
      const hour = new Date().getHours();
      // Early morning irrigation (6 AM)
      if (hour === 6) {
        let duration = season === 'summer' ? 30 : 15;
        if (this.environment.rainfall !== null && this.environment.rainfall > 5) {
          duration = 0; // Skip — already raining
        }
        if (duration > 0) {
          actions.push({ type: 'irrigation', duration, reason: 'scheduled' });
          this.stats.irrigationCycles++;
        }
      }
    }

    // Frost warning
    if (this.environment.outdoorTemp !== null && this.environment.outdoorTemp < 2 &&
        (season === 'early_spring' || season === 'late_spring' || season === 'autumn')) {
      actions.push({ type: 'frost_warning', temp: this.environment.outdoorTemp });
      this._emitEvent('frost_warning', { temp: this.environment.outdoorTemp });
    }

    // Snow melt system
    if ((season === 'midwinter' || season === 'late_winter') &&
        this.environment.snowDepth !== null && this.environment.snowDepth > 5) {
      actions.push({ type: 'snow_melt', activate: true });
    }

    // Outdoor furniture alerts
    if (season === 'autumn' && this.environment.windSpeed !== null && this.environment.windSpeed > 40) {
      actions.push({ type: 'furniture_protection', reason: 'high_wind' });
    }

    // Lawn mowing suggestion (dry days, growing season)
    if (['late_spring', 'summer', 'late_summer'].includes(season)) {
      const now = new Date();
      if (now.getDay() === 6 && now.getHours() === 10) { // Saturday 10 AM
        if (this.environment.rainfall === null || this.environment.rainfall < 1) {
          actions.push({ type: 'lawn_mowing_suggestion' });
        }
      }
    }

    // Growing season tracking
    const growingSeasons = ['late_spring', 'summer', 'late_summer'];
    const isGrowingSeason = growingSeasons.includes(season);

    if (actions.length > 0) {
      this._emitEvent('garden_outdoor', { actions, isGrowingSeason, season });
    }
  }

  // =========================================================================
  // 8. Energy Optimization
  // =========================================================================

  _evaluateEnergyOptimization() {
    if (!this.currentSeason) return;

    const season = this.currentSeason.id;
    const hour = new Date().getHours();
    const optimizations = [];

    // Winter energy strategies
    if (season === 'midwinter' || season === 'late_winter' || season === 'dark_november') {
      // Pre-heat during off-peak hours (22:00–06:00)
      if (hour >= 22 || hour < 6) {
        optimizations.push({ type: 'pre_heat_offpeak', description: 'Pre-heating during off-peak electricity' });
      }
      // Maximize solar panel tilt (steeper in winter)
      optimizations.push({ type: 'solar_tilt', angle: 60, reason: 'winter_optimization' });
      // Thermal mass loading
      if (hour >= 11 && hour <= 14 && this.environment.cloudCover !== null && this.environment.cloudCover < 40) {
        optimizations.push({ type: 'thermal_mass_loading', description: 'Store solar heat in thermal mass' });
      }
    }

    // Summer energy strategies
    if (season === 'summer' || season === 'late_summer' || season === 'late_spring') {
      // Solar overproduction routing
      optimizations.push({ type: 'solar_tilt', angle: 30, reason: 'summer_optimization' });
      if (hour >= 10 && hour <= 15) {
        optimizations.push({
          type: 'solar_overproduction',
          routing: ['battery_charge', 'ev_charge', 'grid_export'],
          description: 'Route excess solar to battery/EV/grid'
        });
      }
      // Night cooling strategy
      if (hour >= 22 || hour < 6) {
        if (this.environment.outdoorTemp !== null && this.environment.outdoorTemp < 20) {
          optimizations.push({ type: 'night_cooling', description: 'Cool home using night air' });
        }
      }
    }

    if (optimizations.length > 0) {
      this.stats.energyOptimizations += optimizations.length;
      this._emitEvent('energy_optimization', { optimizations, season });
    }
  }

  _calculateEnergyBudget() {
    if (!this.currentSeason) return;

    const seasonMultipliers = {
      midwinter: 1.8, late_winter: 1.6, early_spring: 1.2, late_spring: 0.8,
      summer: 0.5, late_summer: 0.6, autumn: 1.1, dark_november: 1.5
    };
    const multiplier = seasonMultipliers[this.currentSeason.id] || 1.0;
    const baseDailyKwh = 30; // Base daily consumption estimate
    this.energyBudget.forecast = Math.round(baseDailyKwh * multiplier * 30); // Monthly
    this.energyBudget.savings = Math.max(0, Math.round(
      this.energyBudget.forecast * 0.15 // Estimated 15% savings from optimization
    ));
  }

  // =========================================================================
  // 9. Holiday Automation
  // =========================================================================

  _buildHolidayCalendar() {
    const year = new Date().getFullYear();
    this.holidays = [];

    // Fixed holidays
    for (const h of SWEDISH_HOLIDAYS_TEMPLATES) {
      this.holidays.push({
        ...h,
        date: new Date(year, h.month - 1, h.day),
        year
      });
    }

    // Easter (computed)
    const easter = this._computeEaster(year);
    this.holidays.push({
      name: 'Långfredagen', date: new Date(easter.getTime() - 2 * 86400000),
      scene: 'good_friday', decoration: 'subtle_candles', month: 0, day: 0, year
    });
    this.holidays.push({
      name: 'Påskdagen', date: easter,
      scene: 'easter', decoration: 'easter_colors', month: 0, day: 0, year
    });
    this.holidays.push({
      name: 'Annandag påsk', date: new Date(easter.getTime() + 86400000),
      scene: 'easter_monday', decoration: 'easter_colors', month: 0, day: 0, year
    });

    // Midsommar (Friday between June 19-25)
    const midsommar = this._computeMidsommar(year);
    this.holidays.push({
      name: 'Midsommarafton', date: new Date(midsommar.getTime() - 86400000),
      scene: 'midsummer_eve', decoration: 'midsummer_flowers', month: 6, day: 0, year
    });
    this.holidays.push({
      name: 'Midsommardagen', date: midsommar,
      scene: 'midsummer', decoration: 'midsummer_flowers', month: 6, day: 0, year
    });

    // Vacation periods (approximate)
    this.holidays.push({
      name: 'Sportlov', date: new Date(year, 1, 15),
      scene: 'vacation', decoration: 'cozy', month: 2, day: 15, year,
      isPeriod: true, endDate: new Date(year, 1, 22)
    });
    this.holidays.push({
      name: 'Sommarlov', date: new Date(year, 5, 10),
      scene: 'summer_vacation', decoration: 'summer_party', month: 6, day: 10, year,
      isPeriod: true, endDate: new Date(year, 7, 20)
    });

    this._updateUpcomingHolidays();
  }

  _computeEaster(year) {
    // Anonymous Gregorian algorithm
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  }

  _computeMidsommar(year) {
    // Midsommardagen = Saturday between June 20-26
    for (let d = 20; d <= 26; d++) {
      const date = new Date(year, 5, d);
      if (date.getDay() === 6) return date;
    }
    return new Date(year, 5, 21);
  }

  _updateUpcomingHolidays() {
    const now = new Date();
    this.upcomingHolidays = this.holidays
      .filter(h => h.date >= now || (h.endDate && h.endDate >= now))
      .sort((a, b) => a.date - b.date)
      .slice(0, 10)
      .map(h => ({
        name: h.name,
        date: h.date.toISOString().slice(0, 10),
        scene: h.scene,
        decoration: h.decoration,
        daysUntil: Math.ceil((h.date - now) / 86400000),
        isPeriod: !!h.isPeriod
      }));
  }

  _evaluateHolidayAutomation() {
    this._updateUpcomingHolidays();

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    for (const holiday of this.holidays) {
      const holidayStr = holiday.date.toISOString().slice(0, 10);
      const isActive = holidayStr === todayStr ||
        (holiday.isPeriod && holiday.endDate && now >= holiday.date && now <= holiday.endDate);

      if (isActive) {
        this.stats.holidayScenesActivated++;
        this._emitEvent('holiday_scene', {
          name: holiday.name,
          scene: holiday.scene,
          decoration: holiday.decoration
        });
      }

      // Pre-decoration (1 day before for major holidays)
      const daysUntil = Math.ceil((holiday.date - now) / 86400000);
      if (daysUntil === 1 && !holiday.isPeriod) {
        this._emitEvent('holiday_preparation', {
          name: holiday.name,
          decoration: holiday.decoration,
          message: `Imorgon: ${holiday.name} — förbereder dekoration`
        });
      }
    }
  }

  // =========================================================================
  // 10. Clothing / Comfort Alerts
  // =========================================================================

  _evaluateClothingComfortAlerts() {
    if (!this.config.clothingAlertEnabled) return;

    const now = new Date();
    if (now.getHours() !== 7 || now.getMinutes() > 10) return;

    const temp = this.environment.outdoorTemp;
    if (temp === null) return;

    let suggestion = '';
    let extras = [];

    if (temp < -15) {
      suggestion = 'Tjock vinterjacka, mössa, vantar, halsduk. Mycket kallt ute!';
    } else if (temp < -5) {
      suggestion = 'Vinterjacka, mössa och vantar behövs.';
    } else if (temp < 5) {
      suggestion = 'Varm jacka och lager på lager rekommenderas.';
    } else if (temp < 12) {
      suggestion = 'Lätt jacka eller tjock tröja. Kolla om det regnar!';
    } else if (temp < 18) {
      suggestion = 'Lätt jacka eller kofta — trevligt väder.';
    } else if (temp < 25) {
      suggestion = 'T-shirt och lätta byxor. Njut av sommarvärmen!';
    } else {
      suggestion = 'Lätta kläder, solhatt. Var försiktig med solen!';
    }

    // Rain check
    if (this.environment.rainfall !== null && this.environment.rainfall > 0) {
      extras.push('Ta med paraply — regn väntas!');
    }

    // Wind chill
    if (this.environment.windSpeed !== null && this.environment.windSpeed > 30 && temp < 10) {
      extras.push(`Stark vind (${this.environment.windSpeed} km/h) — klä dig varmare.`);
    }

    this.stats.clothingAlertsSent++;
    this._emitEvent('clothing_alert', {
      temperature: temp,
      suggestion,
      extras,
      season: this.currentSeason ? this.currentSeason.id : 'unknown'
    });
  }

  // =========================================================================
  // 11. Humidity Management
  // =========================================================================

  _evaluateHumidity() {
    if (!this.currentSeason) return;

    const profile = this.currentSeason.humidity;
    let targetRange = profile.target;
    let mode = profile.mode;

    // Transition interpolation
    if (this.transitionActive && this.previousSeason) {
      const prevTarget = this.previousSeason.humidity.target;
      targetRange = [
        Math.round(this._interpolateValue(prevTarget[0], profile.target[0])),
        Math.round(this._interpolateValue(prevTarget[1], profile.target[1]))
      ];
    }

    // Bathroom mold prevention — always active
    let bathroomOverride = false;
    if (this.environment.indoorHumidity !== null && this.environment.indoorHumidity > 70) {
      bathroomOverride = true;
      mode = 'dehumidify_urgent';
    }

    // Winter dry air
    if ((this.currentSeason.id === 'midwinter' || this.currentSeason.id === 'late_winter') &&
        this.environment.indoorHumidity !== null && this.environment.indoorHumidity < 30) {
      mode = 'humidify_urgent';
    }

    this.activeProfiles.humidity = {
      targetRange,
      mode,
      currentHumidity: this.environment.indoorHumidity,
      bathroomOverride
    };

    this._emitEvent('humidity_profile_update', this.activeProfiles.humidity);
  }

  // =========================================================================
  // 12. Pool / Outdoor Water
  // =========================================================================

  _evaluatePoolOutdoorWater() {
    if (!this.config.poolManagementEnabled) return;
    if (!this.currentSeason) return;

    const now = new Date();
    const month = now.getMonth() + 1;
    const season = this.currentSeason.id;
    const actions = [];

    // Pool opening (late May)
    if (month === 5 && now.getDate() >= 20) {
      actions.push({ type: 'pool_opening_preparation', message: 'Dags att förbereda poolen för säsongen!' });
    }

    // Pool heating season (Jun-Aug)
    if (['summer', 'late_summer'].includes(season)) {
      let targetPoolTemp = 24;
      if (this.environment.outdoorTemp !== null && this.environment.outdoorTemp > 25) {
        targetPoolTemp = 22; // Less heating needed when warm
      }
      actions.push({ type: 'pool_heating', targetTemp: targetPoolTemp, active: true });
    }

    // Pool winterization (September)
    if (month === 9 && now.getDate() >= 15) {
      actions.push({ type: 'pool_winterization', message: 'Dags att vinterstänga poolen' });
    }

    // Outdoor tap frost protection
    if (this.environment.outdoorTemp !== null && this.environment.outdoorTemp < 3 &&
        (season === 'autumn' || season === 'dark_november' || season === 'midwinter' || season === 'late_winter')) {
      actions.push({ type: 'outdoor_tap_frost_protection', temp: this.environment.outdoorTemp });
    }

    // Hot tub season extension
    if (['autumn', 'early_spring'].includes(season)) {
      actions.push({
        type: 'hot_tub_cover',
        message: 'Använd lock på badtunnan för att förlänga säsongen',
        targetTemp: 38
      });
    }

    if (actions.length > 0) {
      this._emitEvent('pool_outdoor_water', { actions, season });
    }
  }

  // =========================================================================
  // 13. Wildlife / Nature
  // =========================================================================

  _evaluateWildlifeNature() {
    if (!this.config.wildlifeNotificationsEnabled) return;
    if (!this.currentSeason) return;

    const season = this.currentSeason.id;
    const now = new Date();
    const notifications = [];

    // Bird feeder reminder (winter)
    if (['midwinter', 'late_winter', 'dark_november'].includes(season)) {
      if (now.getDay() === 0 && now.getHours() === 9) { // Sunday 9 AM
        notifications.push({ type: 'bird_feeder', message: 'Fyll på fågelmataren!' });
      }
    }

    // Garden wildlife camera
    if (['early_spring', 'late_spring', 'summer'].includes(season)) {
      notifications.push({ type: 'wildlife_camera', active: true });
    }

    // Bird migration
    if (season === 'early_spring' && now.getDate() >= 15) {
      notifications.push({ type: 'bird_migration', direction: 'north', message: 'Flyttfåglarna kommer tillbaka!' });
    }
    if (season === 'autumn' && now.getDate() >= 1 && now.getDate() <= 15) {
      notifications.push({ type: 'bird_migration', direction: 'south', message: 'Flyttfåglarna drar söderut' });
    }

    // Nature activity suggestions
    const activitySuggestions = {
      midwinter: ['Skidåkning', 'Fågelskådning vid mataren', 'Norrskensjakt'],
      late_winter: ['Skridskoturer', 'Vinterpromenad i skogen'],
      early_spring: ['Vitsippspromenad', 'Fågelvandring', 'Plantera frön inomhus'],
      late_spring: ['Trädgårdsarbete', 'Fågelholkar', 'Fjärilsvandring'],
      summer: ['Bärplockning', 'Kanottur', 'Nattfjärilar'],
      late_summer: ['Svampplockning', 'Kräftfiske', 'Stjärnskådning'],
      autumn: ['Älgjakt', 'Höstfärger promenad', 'Tranflytt'],
      dark_november: ['Fågelmatare iordningställning', 'Inomhusodling']
    };

    if (now.getDay() === 6 && now.getHours() === 8) { // Saturday 8 AM
      const activities = activitySuggestions[season] || [];
      if (activities.length > 0) {
        notifications.push({
          type: 'nature_activity',
          suggestions: activities,
          message: 'Helgens naturaktiviteter'
        });
      }
    }

    if (notifications.length > 0) {
      this._emitEvent('wildlife_nature', { notifications, season });
    }
  }

  // =========================================================================
  // 14. Seasonal Maintenance
  // =========================================================================

  _checkMaintenanceSchedule() {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    this.maintenanceDue = [];

    for (const task of MAINTENANCE_SCHEDULE) {
      if (task.months.includes(currentMonth)) {
        const completedKey = `${task.task}_${now.getFullYear()}_${currentMonth}`;
        if (!this.maintenanceCompleted.includes(completedKey)) {
          this.maintenanceDue.push({
            task: task.task,
            priority: task.priority,
            dueMonth: currentMonth,
            key: completedKey
          });
        }
      }
    }

    if (this.maintenanceDue.length > 0) {
      this.stats.maintenanceReminders = this.maintenanceDue.length;
      this._emitEvent('maintenance_due', {
        tasks: this.maintenanceDue,
        count: this.maintenanceDue.length
      });
    }
  }

  completeMaintenanceTask(taskKey) {
    if (!this.maintenanceCompleted.includes(taskKey)) {
      this.maintenanceCompleted.push(taskKey);
      this.maintenanceDue = this.maintenanceDue.filter(t => t.key !== taskKey);
      this.log(`Maintenance completed: ${taskKey}`);
    }
  }

  // =========================================================================
  // 15. Sleep Adaptation
  // =========================================================================

  _evaluateSleepAdaptation() {
    if (!this.currentSeason) return;

    const season = this.currentSeason.id;
    const sleepProfile = { blinds: 'normal', cooling: false, extraWarmth: false, lightAlarm: false, notes: '' };

    switch (season) {
      case 'summer':
      case 'late_spring':
        sleepProfile.blinds = 'blackout';
        sleepProfile.cooling = true;
        sleepProfile.notes = 'Midnight sun — blackout blinds + cooling active';
        break;
      case 'midwinter':
      case 'late_winter':
      case 'dark_november':
        sleepProfile.extraWarmth = true;
        sleepProfile.lightAlarm = true;
        sleepProfile.notes = 'Dark mornings — gradual light alarm + extra warmth';
        break;
      case 'early_spring':
      case 'autumn':
        sleepProfile.notes = 'Transition season — balanced sleep environment';
        break;
      case 'late_summer':
        sleepProfile.blinds = 'semi-blackout';
        sleepProfile.notes = 'Days shortening — reduced blackout needed';
        break;
      default:
        break;
    }

    this.activeProfiles.sleep = sleepProfile;
    this._emitEvent('sleep_adaptation', sleepProfile);
  }

  // =========================================================================
  // 16. Food / Kitchen
  // =========================================================================

  _evaluateFoodSuggestions() {
    if (!this.config.foodSuggestionsEnabled) return;
    if (!this.currentSeason) return;

    const now = new Date();
    // Weekly suggestion on Sundays at 10 AM
    if (now.getDay() !== 0 || now.getHours() !== 10 || now.getMinutes() > 10) return;

    const season = this.currentSeason.id;
    const food = SEASONAL_FOOD[season];
    if (!food) return;

    this._emitEvent('food_suggestion', {
      season,
      suggestions: food.suggestions,
      baking: food.baking,
      outdoorGrilling: food.outdoor,
      message: `Veckans säsongsmat: ${food.suggestions.join(', ')}`
    });
  }

  // =========================================================================
  // Pollen Alerts
  // =========================================================================

  _evaluatePollenAlerts() {
    if (!this.config.pollenAlertEnabled) return;
    if (!this.currentSeason) return;

    const now = new Date();
    const month = now.getMonth() + 1;
    const activePollenTypes = POLLEN_SEASONS.filter(p => month >= p.startMonth && month <= p.endMonth);

    if (activePollenTypes.length > 0 && now.getHours() === 7) {
      const alerts = activePollenTypes.map(p => ({
        type: p.type,
        severity: p.peakMonth === month ? 'peak' : p.severity,
        advice: p.peakMonth === month
          ? `Hög pollenhalt av ${p.type} — håll fönster stängda`
          : `Pollensäsong för ${p.type} — var uppmärksam`
      }));

      this.stats.pollenAlertsSent++;
      this._emitEvent('pollen_alert', { alerts, month });
    }
  }

  // =========================================================================
  // UV Warnings
  // =========================================================================

  _evaluateUVWarnings() {
    if (!this.config.uvAlertEnabled) return;

    if (this.environment.uvIndex === null) return;
    if (this.environment.uvIndex < 3) return;

    let warning = '';
    let protection = [];

    if (this.environment.uvIndex >= 8) {
      warning = 'Mycket hög UV-strålning!';
      protection = ['Solskyddsfaktor 50+', 'Solglasögon', 'Hatt', 'Undvik sol 11-15'];
    } else if (this.environment.uvIndex >= 6) {
      warning = 'Hög UV-strålning';
      protection = ['Solskyddsfaktor 30+', 'Solglasögon', 'Skugga vid lunch'];
    } else if (this.environment.uvIndex >= 3) {
      warning = 'Måttlig UV-strålning';
      protection = ['Solskyddsfaktor 15+', 'Solglasögon rekommenderas'];
    }

    this.stats.uvAlertsSent++;
    this._emitEvent('uv_warning', {
      uvIndex: this.environment.uvIndex,
      warning,
      protection
    });
  }

  // =========================================================================
  // Seasonal Profiles Application
  // =========================================================================

  _applySeasonalProfiles() {
    if (!this.currentSeason) return;

    this._evaluateHeating();
    this._evaluateVentilation();
    this._evaluateHumidity();
    this._evaluateLightingColorTemp();
    this._evaluateBlindsAndWindows();
    this._evaluateSleepAdaptation();
  }

  // =========================================================================
  // Temperature Tracking
  // =========================================================================

  _trackTemperature() {
    if (this.environment.outdoorTemp === null) return;

    this.temperatureHistory.push({
      timestamp: Date.now(),
      value: this.environment.outdoorTemp
    });

    // Keep 30 days at 10-min intervals (4320 entries)
    if (this.temperatureHistory.length > 4320) {
      this.temperatureHistory = this.temperatureHistory.slice(-4320);
    }
  }

  _getTemperatureTrend() {
    if (this.temperatureHistory.length < 12) return 'unknown';

    const recent = this.temperatureHistory.slice(-6);
    const older = this.temperatureHistory.slice(-12, -6);

    const recentAvg = recent.reduce((s, t) => s + t.value, 0) / recent.length;
    const olderAvg = older.reduce((s, t) => s + t.value, 0) / older.length;
    const diff = recentAvg - olderAvg;

    if (diff > 2) return 'warming';
    if (diff < -2) return 'cooling';
    return 'stable';
  }

  // =========================================================================
  // Seasonal Score
  // =========================================================================

  _calculateSeasonalScore() {
    if (!this.currentSeason) {
      this.seasonalScore = 0;
      return;
    }

    let score = 50; // Base score

    // Heating alignment
    if (this.activeProfiles.heating) {
      const target = this.activeProfiles.heating.targetTemp;
      if (this.environment.indoorTemp !== null) {
        const diff = Math.abs(this.environment.indoorTemp - target);
        if (diff < 0.5) score += 10;
        else if (diff < 1.5) score += 5;
        else if (diff > 3) score -= 10;
      } else {
        score += 5; // Assume okay if no sensor
      }
    }

    // Humidity alignment
    if (this.activeProfiles.humidity && this.environment.indoorHumidity !== null) {
      const range = this.activeProfiles.humidity.targetRange;
      if (this.environment.indoorHumidity >= range[0] && this.environment.indoorHumidity <= range[1]) {
        score += 10;
      } else {
        score -= 5;
      }
    }

    // Daylight adaptation active
    if (this.activeProfiles.lighting) {
      score += 5;
    }

    // Ventilation active
    if (this.activeProfiles.ventilation) {
      score += 5;
    }

    // Transition penalty
    if (this.transitionActive) {
      score -= Math.round((100 - this.transitionProgress) / 10);
    }

    // SAD therapy in dark months
    if (['midwinter', 'late_winter', 'dark_november'].includes(this.currentSeason.id)) {
      if (this.config.sadLightEnabled) score += 5;
    }

    // Blind automation active
    if (this.activeProfiles.blinds) {
      score += 5;
    }

    // Energy optimization
    if (this.stats.energyOptimizations > 0) {
      score += 5;
    }

    this.seasonalScore = Math.max(0, Math.min(100, score));
  }

  // =========================================================================
  // Manual Override
  // =========================================================================

  setManualOverride(seasonId, durationHours = 24) {
    const seasonKey = Object.keys(NORDIC_SEASONS).find(
      k => NORDIC_SEASONS[k].id === seasonId
    );
    if (!seasonKey) {
      this.error(`Unknown season ID: ${seasonId}`);
      return false;
    }

    this.manualOverride = true;
    this.manualOverrideExpiry = Date.now() + durationHours * 60 * 60 * 1000;
    this.previousSeason = this.currentSeason;
    this.currentSeason = NORDIC_SEASONS[seasonKey];
    this.transitionActive = false;
    this.transitionProgress = 100;

    this.log(`Manual override: ${this.currentSeason.label} for ${durationHours}h`);
    this._applySeasonalProfiles();
    return true;
  }

  clearManualOverride() {
    this.manualOverride = false;
    this.manualOverrideExpiry = null;
    this.log('Manual override cleared — resuming automatic detection');
    this._detectCurrentSeason();
    this._applySeasonalProfiles();
  }

  // =========================================================================
  // Environment Update
  // =========================================================================

  updateEnvironment(data) {
    if (!data || typeof data !== 'object') return;

    const fields = [
      'outdoorTemp', 'indoorTemp', 'indoorHumidity', 'co2Level',
      'windSpeed', 'windDirection', 'uvIndex', 'cloudCover',
      'rainfall', 'snowDepth', 'airQualityIndex', 'pollenLevel'
    ];

    for (const field of fields) {
      if (data[field] !== undefined) {
        this.environment[field] = data[field];
      }
    }
  }

  // =========================================================================
  // Configuration Update
  // =========================================================================

  updateConfig(newConfig) {
    if (!newConfig || typeof newConfig !== 'object') return;

    for (const key of Object.keys(newConfig)) {
      if (this.config.hasOwnProperty(key)) {
        this.config[key] = newConfig[key];
        this.log(`Config updated: ${key} = ${JSON.stringify(newConfig[key])}`);
      }
    }
  }

  // =========================================================================
  // Query Methods
  // =========================================================================

  getCurrentSeason() {
    if (!this.currentSeason) return null;
    return {
      id: this.currentSeason.id,
      label: this.currentSeason.label,
      description: this.currentSeason.description,
      transitionActive: this.transitionActive,
      transitionProgress: this.transitionProgress
    };
  }

  getSeasonalProfiles() {
    return { ...this.activeProfiles };
  }

  getDaylightInfo() {
    return {
      sunrise: this.sunrise,
      sunset: this.sunset,
      daylightHours: this.daylightHours,
      latitude: this.config.latitude
    };
  }

  getHolidayCalendar() {
    return this.holidays.map(h => ({
      name: h.name,
      date: h.date.toISOString().slice(0, 10),
      scene: h.scene,
      decoration: h.decoration,
      isPeriod: !!h.isPeriod,
      endDate: h.endDate ? h.endDate.toISOString().slice(0, 10) : null
    }));
  }

  getUpcomingHolidays() {
    return [...this.upcomingHolidays];
  }

  getMaintenanceSchedule() {
    return {
      due: [...this.maintenanceDue],
      completed: [...this.maintenanceCompleted],
      allTasks: MAINTENANCE_SCHEDULE.map(t => ({ ...t }))
    };
  }

  getEnergyReport() {
    return {
      heatingDegreeDays: Math.round(this.heatingDegreeDays * 10) / 10,
      energyBudget: { ...this.energyBudget },
      season: this.currentSeason ? this.currentSeason.id : null,
      temperatureTrend: this._getTemperatureTrend()
    };
  }

  getSeasonalScore() {
    return this.seasonalScore;
  }

  getPollenForecast() {
    const month = new Date().getMonth() + 1;
    return POLLEN_SEASONS
      .filter(p => month >= p.startMonth - 1 && month <= p.endMonth)
      .map(p => ({
        type: p.type,
        active: month >= p.startMonth && month <= p.endMonth,
        isPeak: month === p.peakMonth,
        severity: p.severity
      }));
  }

  getFoodSuggestions() {
    if (!this.currentSeason) return null;
    return SEASONAL_FOOD[this.currentSeason.id] || null;
  }

  getAllSeasons() {
    return Object.values(NORDIC_SEASONS).map(s => ({
      id: s.id,
      label: s.label,
      months: [...s.months],
      description: s.description
    }));
  }

  // =========================================================================
  // Event Emission (integration with Homey)
  // =========================================================================

  _emitEvent(eventName, data) {
    try {
      if (this.homey && typeof this.homey.emit === 'function') {
        this.homey.emit(`seasonal:${eventName}`, data);
      }
      if (this.homey && this.homey.api && typeof this.homey.api.realtime === 'function') {
        this.homey.api.realtime(`seasonal:${eventName}`, data);
      }
    } catch (err) {
      // Silently ignore emission errors
    }
  }

  // =========================================================================
  // Air Quality Warning (winter wood-burning)
  // =========================================================================

  _evaluateAirQualityWarning() {
    if (!this.currentSeason) return;
    if (this.environment.airQualityIndex === null) return;

    const season = this.currentSeason.id;
    const winterSeasons = ['midwinter', 'late_winter', 'dark_november'];

    if (winterSeasons.includes(season) && this.environment.airQualityIndex > 100) {
      this._emitEvent('air_quality_warning', {
        aqi: this.environment.airQualityIndex,
        season,
        message: 'Dålig luftkvalitet — vedeldning i området. Håll fönster stängda.',
        actions: ['close_windows', 'activate_air_purifier', 'reduce_ventilation_intake']
      });
    }
  }

  // =========================================================================
  // Extended season-aware automation helpers
  // =========================================================================

  isGrowingSeason() {
    if (!this.currentSeason) return false;
    return ['late_spring', 'summer', 'late_summer'].includes(this.currentSeason.id);
  }

  isHeatingRequired() {
    if (!this.currentSeason) return true;
    return ['midwinter', 'late_winter', 'early_spring', 'autumn', 'dark_november'].includes(this.currentSeason.id);
  }

  isCoolingRequired() {
    if (!this.currentSeason) return false;
    return this.currentSeason.id === 'summer' && this.environment.indoorTemp !== null && this.environment.indoorTemp > 25;
  }

  isDarkSeason() {
    if (!this.currentSeason) return false;
    return ['midwinter', 'late_winter', 'dark_november'].includes(this.currentSeason.id);
  }

  isOutdoorSeason() {
    if (!this.currentSeason) return false;
    return ['late_spring', 'summer', 'late_summer'].includes(this.currentSeason.id);
  }

  isPollenSeason() {
    const month = new Date().getMonth() + 1;
    return POLLEN_SEASONS.some(p => month >= p.startMonth && month <= p.endMonth);
  }

  getSeasonalDecorationMode() {
    const now = new Date();
    const month = now.getMonth() + 1;

    // Christmas season (Dec 1 — Jan 6)
    if (month === 12 || (month === 1 && now.getDate() <= 6)) {
      return { mode: 'christmas', description: 'Juldekoration', lights: 'warm_white_twinkle' };
    }
    // Easter (around April)
    if (month === 4) {
      return { mode: 'easter', description: 'Påskdekoration', lights: 'pastel_colors' };
    }
    // Midsummer
    if (month === 6 && now.getDate() >= 18 && now.getDate() <= 26) {
      return { mode: 'midsummer', description: 'Midsommardekoration', lights: 'natural_warm' };
    }
    // Lucia
    if (month === 12 && now.getDate() >= 10 && now.getDate() <= 13) {
      return { mode: 'lucia', description: 'Luciadekoration', lights: 'candle_warm' };
    }
    return { mode: 'default', description: 'Standard', lights: 'none' };
  }

  // =========================================================================
  // Comprehensive status for dashboard
  // =========================================================================

  getDashboardStatus() {
    return {
      season: this.getCurrentSeason(),
      daylight: this.getDaylightInfo(),
      profiles: this.getSeasonalProfiles(),
      score: this.seasonalScore,
      temperatureTrend: this._getTemperatureTrend(),
      environment: { ...this.environment },
      upcomingHolidays: this.getUpcomingHolidays().slice(0, 3),
      maintenanceDue: this.maintenanceDue.slice(0, 3),
      pollenForecast: this.getPollenForecast(),
      decorationMode: this.getSeasonalDecorationMode(),
      energy: this.getEnergyReport(),
      isGrowingSeason: this.isGrowingSeason(),
      isDarkSeason: this.isDarkSeason(),
      isOutdoorSeason: this.isOutdoorSeason(),
      stats: { ...this.stats }
    };
  }
}

module.exports = SmartSeasonalAdaptationSystem;
