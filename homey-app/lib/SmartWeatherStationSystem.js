'use strict';

const EventEmitter = require('events');

/**
 * SmartWeatherStationSystem
 *
 * Comprehensive personal weather station network manager for Homey-based
 * smart homes. Provides multi-sensor data collection, hyper-local ML-like
 * forecasting, storm tracking, severe weather alerts, microclimate mapping,
 * weather-based automation triggers, external API cross-validation, pollen
 * and AQI correlation, frost protection, sensor health monitoring,
 * sunrise/sunset scheduling, and seasonal pattern analysis.
 *
 * @extends EventEmitter
 */
class SmartWeatherStationSystem extends EventEmitter {
  constructor(homey) {
    super();
    this.homey = homey;
    this.initialized = false;
    this.intervals = [];
    this.timeouts = [];

    // ── Weather Sensor Stations ─────────────────────────────────────────
    this.stations = {
      'main-outdoor': {
        id: 'main-outdoor', name: 'Huvudstation Utomhus', zone: 'rooftop',
        model: 'Davis Vantage Pro2', firmware: '4.2.1',
        sensors: {
          temperature: { value: null, unit: '°C', accuracy: 0.3, lastReading: null },
          humidity: { value: null, unit: '%', accuracy: 2, lastReading: null },
          pressure: { value: null, unit: 'hPa', accuracy: 0.5, lastReading: null },
          windSpeed: { value: null, unit: 'm/s', accuracy: 0.5, lastReading: null },
          windDirection: { value: null, unit: '°', accuracy: 3, lastReading: null },
          windGust: { value: null, unit: 'm/s', accuracy: 0.5, lastReading: null },
          rain: { value: null, unit: 'mm/h', accuracy: 0.2, lastReading: null },
          rainDaily: { value: null, unit: 'mm', accuracy: 0.2, lastReading: null },
          uv: { value: null, unit: 'index', accuracy: 0.1, lastReading: null },
          solarRadiation: { value: null, unit: 'W/m²', accuracy: 5, lastReading: null }
        },
        calibration: { lastCalibrated: null, nextCalibration: null, status: 'ok', driftPercent: 0 },
        battery: 100, signalStrength: 95, online: true, errorCount: 0, uptime: 0
      },
      'garden-south': {
        id: 'garden-south', name: 'Trädgård Söder', zone: 'garden',
        model: 'Netatmo Weather Station', firmware: '3.1.0',
        sensors: {
          temperature: { value: null, unit: '°C', accuracy: 0.3, lastReading: null },
          humidity: { value: null, unit: '%', accuracy: 3, lastReading: null },
          pressure: { value: null, unit: 'hPa', accuracy: 1, lastReading: null },
          soilTemperature: { value: null, unit: '°C', accuracy: 0.5, lastReading: null },
          soilMoisture: { value: null, unit: '%', accuracy: 3, lastReading: null }
        },
        calibration: { lastCalibrated: null, nextCalibration: null, status: 'ok', driftPercent: 0 },
        battery: 100, signalStrength: 82, online: true, errorCount: 0, uptime: 0
      },
      'garage-north': {
        id: 'garage-north', name: 'Garage Norr', zone: 'garage',
        model: 'Ecowitt GW1100', firmware: '2.0.8',
        sensors: {
          temperature: { value: null, unit: '°C', accuracy: 0.5, lastReading: null },
          humidity: { value: null, unit: '%', accuracy: 3, lastReading: null },
          windSpeed: { value: null, unit: 'm/s', accuracy: 1, lastReading: null },
          windDirection: { value: null, unit: '°', accuracy: 5, lastReading: null }
        },
        calibration: { lastCalibrated: null, nextCalibration: null, status: 'ok', driftPercent: 0 },
        battery: 100, signalStrength: 70, online: true, errorCount: 0, uptime: 0
      },
      'rooftop-lightning': {
        id: 'rooftop-lightning', name: 'Tak Blixtdetektor', zone: 'rooftop',
        model: 'AcuRite Atlas', firmware: '1.5.4',
        sensors: {
          lightning: { value: null, unit: 'km', accuracy: 1, lastReading: null },
          lightningCount: { value: 0, unit: 'strikes', accuracy: 1, lastReading: null },
          temperature: { value: null, unit: '°C', accuracy: 0.5, lastReading: null }
        },
        calibration: { lastCalibrated: null, nextCalibration: null, status: 'ok', driftPercent: 0 },
        battery: 100, signalStrength: 88, online: true, errorCount: 0, uptime: 0
      },
      'balcony-west': {
        id: 'balcony-west', name: 'Balkong Väst', zone: 'balcony',
        model: 'Netatmo Additional Module', firmware: '3.1.0',
        sensors: {
          temperature: { value: null, unit: '°C', accuracy: 0.3, lastReading: null },
          humidity: { value: null, unit: '%', accuracy: 3, lastReading: null },
          rain: { value: null, unit: 'mm/h', accuracy: 0.5, lastReading: null }
        },
        calibration: { lastCalibrated: null, nextCalibration: null, status: 'ok', driftPercent: 0 },
        battery: 100, signalStrength: 76, online: true, errorCount: 0, uptime: 0
      }
    };

    // ── Microclimate Zones ──────────────────────────────────────────────
    this.microclimates = {
      rooftop: { id: 'rooftop', name: 'Tak', elevation: 12, exposure: 'full-sun',
        windExposure: 'high', tempOffset: 1.5, humidityOffset: -5 },
      garden: { id: 'garden', name: 'Trädgård', elevation: 0, exposure: 'partial-shade',
        windExposure: 'low', tempOffset: -0.5, humidityOffset: 8 },
      garage: { id: 'garage', name: 'Garage', elevation: 0, exposure: 'shade',
        windExposure: 'medium', tempOffset: -1.2, humidityOffset: 3 },
      balcony: { id: 'balcony', name: 'Balkong', elevation: 6, exposure: 'west-facing',
        windExposure: 'medium', tempOffset: 0.8, humidityOffset: -2 },
      indoor: { id: 'indoor', name: 'Inomhus', elevation: 0, exposure: 'none',
        windExposure: 'none', tempOffset: 0, humidityOffset: 0 }
    };

    // ── Alert Thresholds ────────────────────────────────────────────────
    this.alertThresholds = {
      wind: { warning: 10, severe: 17, extreme: 25, unit: 'm/s' },
      rain: { warning: 5, severe: 15, extreme: 30, unit: 'mm/h' },
      temperature: { heatWarning: 30, heatSevere: 35, frostWarning: 2, frostSevere: -5, unit: '°C' },
      lightning: { warning: 30, severe: 15, critical: 5, unit: 'km' },
      uv: { warning: 6, severe: 8, extreme: 11, unit: 'index' },
      pressure: { rapidDrop: 3, stormThreshold: 990, unit: 'hPa' },
      humidity: { moldRisk: 80, dryAir: 25, unit: '%' }
    };

    // ── Active Alerts ───────────────────────────────────────────────────
    this.activeAlerts = [];
    this.alertHistory = [];

    // ── Weather Automation Triggers ─────────────────────────────────────
    this.automationTriggers = [
      { id: 'close-windows-rain', name: 'Stäng fönster vid regn', condition: 'rain', operator: '>', threshold: 0.5,
        action: 'close_windows', enabled: true, lastTriggered: null, triggerCount: 0 },
      { id: 'retract-awning-wind', name: 'Dra in markis vid vind', condition: 'windSpeed', operator: '>', threshold: 12,
        action: 'retract_awning', enabled: true, lastTriggered: null, triggerCount: 0 },
      { id: 'frost-protection', name: 'Frostskydd aktivering', condition: 'temperature', operator: '<', threshold: 2,
        action: 'activate_frost_protection', enabled: true, lastTriggered: null, triggerCount: 0 },
      { id: 'uv-shade-deploy', name: 'Solskydd vid hög UV', condition: 'uv', operator: '>', threshold: 7,
        action: 'deploy_shades', enabled: true, lastTriggered: null, triggerCount: 0 },
      { id: 'storm-secure', name: 'Stormsäkring', condition: 'windGust', operator: '>', threshold: 20,
        action: 'storm_secure_home', enabled: true, lastTriggered: null, triggerCount: 0 },
      { id: 'heat-alert-cooling', name: 'Värmeskydd kylning', condition: 'temperature', operator: '>', threshold: 32,
        action: 'activate_cooling', enabled: true, lastTriggered: null, triggerCount: 0 },
      { id: 'dry-air-humidifier', name: 'Torr luft luftfuktare', condition: 'humidity', operator: '<', threshold: 25,
        action: 'activate_humidifier', enabled: true, lastTriggered: null, triggerCount: 0 },
      { id: 'lightning-protect', name: 'Blixtskydd', condition: 'lightning', operator: '<', threshold: 10,
        action: 'disconnect_sensitive_electronics', enabled: true, lastTriggered: null, triggerCount: 0 }
    ];

    // ── Weather History (ring buffer) ───────────────────────────────────
    this.history = {
      hourly: [],
      daily: [],
      monthly: [],
      maxHourly: 168,
      maxDaily: 365,
      maxMonthly: 60
    };

    // ── Forecast Model ──────────────────────────────────────────────────
    this.forecast = {
      current: null,
      hourly: [],
      daily: [],
      confidence: 0,
      lastUpdated: null,
      pressureTrend: 'stable',
      pressureHistory: [],
      patternDatabase: this._buildSeasonalPatterns()
    };

    // ── Pollen & AQI ────────────────────────────────────────────────────
    this.pollenAqi = {
      pollenIndex: 0, pollenType: 'none', pollenLevel: 'low',
      aqi: 0, aqiCategory: 'good', pm25: 0, pm10: 0,
      dominantPollutant: 'none', lastUpdated: null
    };

    // ── Sunrise/Sunset ──────────────────────────────────────────────────
    this.solarData = {
      sunrise: null, sunset: null, solarNoon: null,
      dayLength: 0, twilightStart: null, twilightEnd: null,
      latitude: 59.3293, longitude: 18.0686,
      lastCalculated: null
    };

    // ── Rain Accumulation & Drought ─────────────────────────────────────
    this.precipitation = {
      todayMm: 0, weekMm: 0, monthMm: 0, yearMm: 0,
      consecutiveDryDays: 0, consecutiveWetDays: 0,
      droughtLevel: 'none', lastRainDate: null,
      seasonalAverage: { jan: 39, feb: 27, mar: 26, apr: 30, may: 30,
        jun: 45, jul: 62, aug: 65, sep: 55, oct: 50, nov: 53, dec: 46 }
    };

    // ── External API Cross-Validation ───────────────────────────────────
    this.externalApis = {
      smhi: { name: 'SMHI', url: 'https://opendata-download-metfcst.smhi.se/api', enabled: true,
        lastFetch: null, lastData: null, deviation: 0, reliability: 100 },
      openWeather: { name: 'OpenWeatherMap', url: 'https://api.openweathermap.org/data/3.0', enabled: true,
        lastFetch: null, lastData: null, deviation: 0, reliability: 100 },
      yrNo: { name: 'Yr.no', url: 'https://api.met.no/weatherapi', enabled: true,
        lastFetch: null, lastData: null, deviation: 0, reliability: 100 }
    };

    // ── Sensor Calibration Tracking ─────────────────────────────────────
    this.calibrationSchedule = {
      intervalDays: 90,
      lastFullCalibration: null,
      nextFullCalibration: null,
      referenceStation: 'main-outdoor',
      calibrationLog: []
    };

    // ── Wind Chill / Heat Index Calculations ────────────────────────────
    this.derivedMetrics = {
      windChill: null, heatIndex: null, dewPoint: null,
      feelsLike: null, cloudBase: null, visibilityEstimate: 'good'
    };

    // ── Weekly/Monthly Report ───────────────────────────────────────────
    this.report = {
      avgTemp: 0, maxTemp: -Infinity, minTemp: Infinity,
      totalRain: 0, avgWind: 0, maxGust: 0,
      sunnyDays: 0, rainyDays: 0, frostDays: 0,
      alertCount: 0, automationTriggerCount: 0,
      generatedAt: null
    };

    this.homey.log('[Väderstation] SmartWeatherStationSystem constructed');
  }

  /**
   * Build seasonal weather pattern database for ML-like forecasting.
   * @returns {Object} patterns by season
   */
  _buildSeasonalPatterns() {
    return {
      winter: {
        avgTemp: -2, tempRange: [-15, 5], avgHumidity: 85, avgPressure: 1010,
        avgWind: 5, dominantDirection: 225, precipDays: 15, snowProbability: 0.6,
        frostProbability: 0.8, stormProbability: 0.15, typicalPatterns: [
          { name: 'Högtryck vinter', pressure: 1030, temp: -8, wind: 2, precip: 0, duration: 72 },
          { name: 'Västlig front', pressure: 1000, temp: 1, wind: 10, precip: 5, duration: 24 },
          { name: 'Snöstorm', pressure: 995, temp: -3, wind: 15, precip: 15, duration: 12 },
          { name: 'Arktisk köld', pressure: 1040, temp: -18, wind: 3, precip: 0, duration: 96 }
        ]
      },
      spring: {
        avgTemp: 8, tempRange: [-3, 20], avgHumidity: 65, avgPressure: 1015,
        avgWind: 4.5, dominantDirection: 180, precipDays: 10, snowProbability: 0.1,
        frostProbability: 0.3, stormProbability: 0.1, typicalPatterns: [
          { name: 'Vårsol', pressure: 1025, temp: 15, wind: 3, precip: 0, duration: 48 },
          { name: 'Aprilduschar', pressure: 1008, temp: 8, wind: 6, precip: 8, duration: 6 },
          { name: 'Sen frost', pressure: 1020, temp: -2, wind: 2, precip: 0, duration: 12 },
          { name: 'Vårflöde', pressure: 1005, temp: 10, wind: 5, precip: 12, duration: 18 }
        ]
      },
      summer: {
        avgTemp: 20, tempRange: [12, 35], avgHumidity: 60, avgPressure: 1015,
        avgWind: 3.5, dominantDirection: 200, precipDays: 10, snowProbability: 0,
        frostProbability: 0, stormProbability: 0.2, typicalPatterns: [
          { name: 'Sommarväder', pressure: 1025, temp: 25, wind: 3, precip: 0, duration: 72 },
          { name: 'Åskväder', pressure: 1005, temp: 28, wind: 12, precip: 25, duration: 3 },
          { name: 'Sommarhetta', pressure: 1020, temp: 32, wind: 2, precip: 0, duration: 48 },
          { name: 'Regnfront', pressure: 1002, temp: 16, wind: 8, precip: 20, duration: 24 }
        ]
      },
      autumn: {
        avgTemp: 8, tempRange: [-2, 18], avgHumidity: 80, avgPressure: 1010,
        avgWind: 5.5, dominantDirection: 240, precipDays: 14, snowProbability: 0.1,
        frostProbability: 0.4, stormProbability: 0.2, typicalPatterns: [
          { name: 'Höststorm', pressure: 990, temp: 8, wind: 18, precip: 30, duration: 18 },
          { name: 'Gyllene höst', pressure: 1025, temp: 12, wind: 3, precip: 0, duration: 48 },
          { name: 'Novemberregn', pressure: 1000, temp: 5, wind: 7, precip: 10, duration: 48 },
          { name: 'Första frost', pressure: 1030, temp: -3, wind: 2, precip: 0, duration: 24 }
        ]
      }
    };
  }

  /**
   * Initialize the weather station system and start all monitoring loops.
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      this.homey.log('[Väderstation] Initierar väderstationssystemet...');
      this._initSensorReadings();
      this._calculateSolarData();
      this._startSensorPolling();
      this._startForecastEngine();
      this._startAlertMonitor();
      this._startAutomationTriggerEngine();
      this._startHistoryRecorder();
      this._startCalibrationMonitor();
      this._startExternalApiSync();
      this._startPollenAqiMonitor();
      this._startPrecipitationTracker();
      this._startDerivedMetricsCalc();
      this._startSolarScheduler();
      this._startStationHealthMonitor();
      this._startReportGenerator();
      this.initialized = true;
      this.homey.log('[Väderstation] Systemet initierat – ' + Object.keys(this.stations).length + ' stationer aktiva');
      this.emit('weather-system-ready', { timestamp: new Date().toISOString() });
    } catch (err) {
      this.homey.error('[Väderstation] Initiering misslyckades: ' + (err.message || err));
      throw err;
    }
  }

  // ── Sensor Initialization ───────────────────────────────────────────

  /**
   * Seed all stations with simulated initial readings.
   */
  _initSensorReadings() {
    var now = new Date().toISOString();
    var month = new Date().getMonth();
    var season = this._getSeason(month);
    var pattern = this.forecast.patternDatabase[season];
    var stationKeys = Object.keys(this.stations);
    for (var i = 0; i < stationKeys.length; i++) {
      var station = this.stations[stationKeys[i]];
      var sensorKeys = Object.keys(station.sensors);
      for (var j = 0; j < sensorKeys.length; j++) {
        var sensor = station.sensors[sensorKeys[j]];
        sensor.lastReading = now;
        switch (sensorKeys[j]) {
          case 'temperature': sensor.value = pattern.avgTemp + (Math.random() * 6 - 3); break;
          case 'humidity': sensor.value = pattern.avgHumidity + (Math.random() * 20 - 10); break;
          case 'pressure': sensor.value = pattern.avgPressure + (Math.random() * 10 - 5); break;
          case 'windSpeed': sensor.value = pattern.avgWind * (0.5 + Math.random()); break;
          case 'windDirection': sensor.value = pattern.dominantDirection + (Math.random() * 60 - 30); break;
          case 'windGust': sensor.value = pattern.avgWind * (1.2 + Math.random() * 0.8); break;
          case 'rain': sensor.value = Math.random() > 0.7 ? Math.random() * 3 : 0; break;
          case 'rainDaily': sensor.value = Math.random() > 0.6 ? Math.random() * 8 : 0; break;
          case 'uv': sensor.value = Math.max(0, Math.min(12, season === 'summer' ? 4 + Math.random() * 5 : Math.random() * 3)); break;
          case 'solarRadiation': sensor.value = season === 'summer' ? 400 + Math.random() * 500 : 50 + Math.random() * 200; break;
          case 'lightning': sensor.value = null; break;
          case 'lightningCount': sensor.value = 0; break;
          case 'soilTemperature': sensor.value = pattern.avgTemp - 2 + Math.random() * 2; break;
          case 'soilMoisture': sensor.value = 30 + Math.random() * 30; break;
          default: sensor.value = 0;
        }
        if (typeof sensor.value === 'number') sensor.value = Math.round(sensor.value * 100) / 100;
      }
      station.uptime = Math.floor(Math.random() * 8640000);
    }
    this.homey.log('[Väderstation] Sensoravläsningar initierade för ' + stationKeys.length + ' stationer');
  }

  /**
   * Determine season from month index.
   * @param {number} month - Month index 0-11
   * @returns {string} season name
   */
  _getSeason(month) {
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'autumn';
    return 'winter';
  }

  // ── Sensor Polling ────────────────────────────────────────────────────

  /** Start periodic sensor data collection. */
  _startSensorPolling() {
    var self = this;
    var iv = setInterval(function() {
      try { self._pollAllSensors(); }
      catch (e) { self.homey.error('[Väderstation] Sensoravläsningsfel: ' + e.message); }
    }, 30000);
    this.intervals.push(iv);
    this.homey.log('[Väderstation] Sensorpolling startad (30s intervall)');
  }

  /** Poll all stations and update sensor values with simulated drift. */
  _pollAllSensors() {
    var now = new Date().toISOString();
    var stationKeys = Object.keys(this.stations);
    for (var i = 0; i < stationKeys.length; i++) {
      var station = this.stations[stationKeys[i]];
      if (!station.online) continue;
      var sensorKeys = Object.keys(station.sensors);
      for (var j = 0; j < sensorKeys.length; j++) {
        var sensor = station.sensors[sensorKeys[j]];
        if (sensor.value === null) continue;
        var drift = (Math.random() - 0.5) * sensor.accuracy * 2;
        sensor.value = Math.round((sensor.value + drift) * 100) / 100;
        sensor.lastReading = now;
        // Clamp values to reasonable ranges
        if (sensorKeys[j] === 'humidity' || sensorKeys[j] === 'soilMoisture') {
          sensor.value = Math.max(0, Math.min(100, sensor.value));
        }
        if (sensorKeys[j] === 'windSpeed' || sensorKeys[j] === 'windGust') {
          sensor.value = Math.max(0, sensor.value);
        }
        if (sensorKeys[j] === 'rain' || sensorKeys[j] === 'rainDaily') {
          sensor.value = Math.max(0, sensor.value);
        }
        if (sensorKeys[j] === 'uv') {
          sensor.value = Math.max(0, Math.min(15, sensor.value));
        }
        if (sensorKeys[j] === 'windDirection') {
          sensor.value = ((sensor.value % 360) + 360) % 360;
        }
      }
      station.uptime += 30;
    }
  }

  // ── Forecast Engine ───────────────────────────────────────────────────

  /** Start the periodic forecast computation. */
  _startForecastEngine() {
    var self = this;
    var iv = setInterval(function() {
      try { self._computeForecast(); }
      catch (e) { self.homey.error('[Väderstation] Prognosberäkningsfel: ' + e.message); }
    }, 60000);
    this.intervals.push(iv);
    this._computeForecast();
    this.homey.log('[Väderstation] Prognosmotor startad');
  }

  /** Compute a hyper-local forecast using pressure trend and pattern matching. */
  _computeForecast() {
    var main = this.stations['main-outdoor'];
    if (!main || !main.online) return;
    var currentPressure = main.sensors.pressure.value;
    var currentTemp = main.sensors.temperature.value;
    var currentHumidity = main.sensors.humidity.value;
    var currentWind = main.sensors.windSpeed.value;

    // Track pressure trend
    this.forecast.pressureHistory.push({ value: currentPressure, time: Date.now() });
    if (this.forecast.pressureHistory.length > 60) this.forecast.pressureHistory.shift();

    // Calculate pressure trend over last 3 hours-equivalent
    var pLen = this.forecast.pressureHistory.length;
    if (pLen >= 2) {
      var oldest = this.forecast.pressureHistory[0].value;
      var newest = this.forecast.pressureHistory[pLen - 1].value;
      var diff = newest - oldest;
      if (diff < -this.alertThresholds.pressure.rapidDrop) this.forecast.pressureTrend = 'falling-rapidly';
      else if (diff < -1) this.forecast.pressureTrend = 'falling';
      else if (diff > 1) this.forecast.pressureTrend = 'rising';
      else this.forecast.pressureTrend = 'stable';
    }

    // Pattern matching against seasonal database
    var season = this._getSeason(new Date().getMonth());
    var patterns = this.forecast.patternDatabase[season].typicalPatterns;
    var bestMatch = null;
    var bestScore = Infinity;
    for (var i = 0; i < patterns.length; i++) {
      var p = patterns[i];
      var score = Math.abs(p.pressure - currentPressure) * 0.4 +
                  Math.abs(p.temp - currentTemp) * 0.3 +
                  Math.abs(p.wind - currentWind) * 0.3;
      if (score < bestScore) { bestScore = score; bestMatch = p; }
    }

    var confidence = Math.max(20, Math.min(95, 100 - bestScore * 2));

    // Build hourly forecast (next 24h)
    this.forecast.hourly = [];
    for (var h = 1; h <= 24; h++) {
      var tempVariation = (Math.sin((h / 24) * Math.PI * 2 - Math.PI / 2) * 4);
      this.forecast.hourly.push({
        hour: h,
        temperature: Math.round((bestMatch.temp + tempVariation + (Math.random() - 0.5) * 2) * 10) / 10,
        humidity: Math.round(Math.max(20, Math.min(100, currentHumidity + (Math.random() - 0.5) * 10))),
        windSpeed: Math.round(Math.max(0, bestMatch.wind + (Math.random() - 0.5) * 3) * 10) / 10,
        precipitation: Math.round(Math.max(0, bestMatch.precip / 24 + (Math.random() - 0.5) * 2) * 10) / 10,
        pressure: Math.round((currentPressure + (Math.random() - 0.5) * 2) * 10) / 10,
        condition: this._determineCondition(bestMatch.precip, bestMatch.wind, bestMatch.temp)
      });
    }

    // Build daily forecast (next 7 days)
    this.forecast.daily = [];
    for (var d = 1; d <= 7; d++) {
      var daySpread = d * 0.5;
      this.forecast.daily.push({
        day: d,
        tempHigh: Math.round((bestMatch.temp + 3 + (Math.random() - 0.5) * daySpread * 2) * 10) / 10,
        tempLow: Math.round((bestMatch.temp - 4 + (Math.random() - 0.5) * daySpread * 2) * 10) / 10,
        humidity: Math.round(Math.max(20, Math.min(100, currentHumidity + (Math.random() - 0.5) * 15))),
        windSpeed: Math.round(Math.max(0, bestMatch.wind + (Math.random() - 0.5) * 4) * 10) / 10,
        precipMm: Math.round(Math.max(0, bestMatch.precip / 7 + (Math.random() - 0.5) * 5) * 10) / 10,
        condition: this._determineCondition(bestMatch.precip / 7, bestMatch.wind, bestMatch.temp),
        confidencePercent: Math.max(15, Math.round(confidence - d * 8))
      });
    }

    this.forecast.current = {
      matchedPattern: bestMatch.name,
      temperature: currentTemp,
      humidity: currentHumidity,
      pressure: currentPressure,
      pressureTrend: this.forecast.pressureTrend,
      wind: currentWind,
      condition: this._determineCondition(
        main.sensors.rain ? main.sensors.rain.value : 0,
        currentWind, currentTemp
      )
    };
    this.forecast.confidence = Math.round(confidence);
    this.forecast.lastUpdated = new Date().toISOString();
  }

  /**
   * Determine weather condition string from parameters.
   * @param {number} precip - Precipitation rate mm/h
   * @param {number} wind - Wind speed m/s
   * @param {number} temp - Temperature °C
   * @returns {string}
   */
  _determineCondition(precip, wind, temp) {
    if (wind > 17) return 'storm';
    if (precip > 10) return temp < 0 ? 'heavy-snow' : 'heavy-rain';
    if (precip > 2) return temp < 0 ? 'snow' : 'rain';
    if (precip > 0.2) return temp < 0 ? 'light-snow' : 'drizzle';
    if (wind > 8) return 'windy';
    return 'clear';
  }

  // ── Alert Monitor ─────────────────────────────────────────────────────

  /** Start periodic alert evaluation. */
  _startAlertMonitor() {
    var self = this;
    var iv = setInterval(function() {
      try { self._evaluateAlerts(); }
      catch (e) { self.homey.error('[Väderstation] Varningsfel: ' + e.message); }
    }, 15000);
    this.intervals.push(iv);
    this.homey.log('[Väderstation] Varningsövervakning startad');
  }

  /** Evaluate all thresholds and raise/clear alerts as needed. */
  _evaluateAlerts() {
    var main = this.stations['main-outdoor'];
    if (!main || !main.online) return;
    var now = new Date().toISOString();

    // Wind alerts
    var windSpeed = main.sensors.windSpeed ? main.sensors.windSpeed.value : 0;
    var windGust = main.sensors.windGust ? main.sensors.windGust.value : 0;
    var maxWind = Math.max(windSpeed, windGust);
    this._checkThreshold('wind', maxWind, this.alertThresholds.wind, now);

    // Rain alerts
    var rain = main.sensors.rain ? main.sensors.rain.value : 0;
    this._checkThreshold('rain', rain, this.alertThresholds.rain, now);

    // Temperature alerts (heat)
    var temp = main.sensors.temperature ? main.sensors.temperature.value : 20;
    if (temp >= this.alertThresholds.temperature.heatSevere) {
      this._raiseAlert('heat-severe', 'Extrem värme: ' + temp + '°C', 'severe', now);
    } else if (temp >= this.alertThresholds.temperature.heatWarning) {
      this._raiseAlert('heat-warning', 'Värmevarning: ' + temp + '°C', 'warning', now);
    } else {
      this._clearAlert('heat-severe');
      this._clearAlert('heat-warning');
    }

    // Frost alerts
    if (temp <= this.alertThresholds.temperature.frostSevere) {
      this._raiseAlert('frost-severe', 'Extrem kyla: ' + temp + '°C', 'severe', now);
    } else if (temp <= this.alertThresholds.temperature.frostWarning) {
      this._raiseAlert('frost-warning', 'Frostvarning: ' + temp + '°C', 'warning', now);
    } else {
      this._clearAlert('frost-severe');
      this._clearAlert('frost-warning');
    }

    // UV alerts
    var uv = main.sensors.uv ? main.sensors.uv.value : 0;
    this._checkThreshold('uv', uv, this.alertThresholds.uv, now);

    // Pressure (storm) alerts
    var pressure = main.sensors.pressure ? main.sensors.pressure.value : 1013;
    if (pressure < this.alertThresholds.pressure.stormThreshold) {
      this._raiseAlert('low-pressure-storm', 'Lågt tryck – stormrisk: ' + pressure + ' hPa', 'warning', now);
    } else {
      this._clearAlert('low-pressure-storm');
    }
    if (this.forecast.pressureTrend === 'falling-rapidly') {
      this._raiseAlert('rapid-pressure-drop', 'Snabbt tryckfall – väderomslag', 'warning', now);
    } else {
      this._clearAlert('rapid-pressure-drop');
    }

    // Lightning alerts
    var lightningStation = this.stations['rooftop-lightning'];
    if (lightningStation && lightningStation.online && lightningStation.sensors.lightning.value !== null) {
      var dist = lightningStation.sensors.lightning.value;
      if (dist <= this.alertThresholds.lightning.critical) {
        this._raiseAlert('lightning-critical', 'Blixtnedslag mycket nära: ' + dist + ' km', 'critical', now);
      } else if (dist <= this.alertThresholds.lightning.severe) {
        this._raiseAlert('lightning-severe', 'Blixtaktivitet nära: ' + dist + ' km', 'severe', now);
      } else if (dist <= this.alertThresholds.lightning.warning) {
        this._raiseAlert('lightning-warning', 'Åskväder i närheten: ' + dist + ' km', 'warning', now);
      } else {
        this._clearAlert('lightning-critical');
        this._clearAlert('lightning-severe');
        this._clearAlert('lightning-warning');
      }
    }

    // Humidity mold risk
    var humidity = main.sensors.humidity ? main.sensors.humidity.value : 50;
    if (humidity >= this.alertThresholds.humidity.moldRisk) {
      this._raiseAlert('mold-risk', 'Hög luftfuktighet – mögelrisk: ' + humidity + '%', 'warning', now);
    } else {
      this._clearAlert('mold-risk');
    }
  }

  /**
   * Check a multi-level threshold (warning/severe/extreme).
   * @param {string} type - Alert type prefix
   * @param {number} value - Current sensor value
   * @param {Object} levels - Threshold levels
   * @param {string} now - ISO timestamp
   */
  _checkThreshold(type, value, levels, now) {
    if (levels.extreme !== undefined && value >= levels.extreme) {
      this._raiseAlert(type + '-extreme', type + ' extremt: ' + value, 'critical', now);
    } else if (levels.severe !== undefined && value >= levels.severe) {
      this._raiseAlert(type + '-severe', type + ' allvarligt: ' + value, 'severe', now);
      this._clearAlert(type + '-extreme');
    } else if (levels.warning !== undefined && value >= levels.warning) {
      this._raiseAlert(type + '-warning', type + ' varning: ' + value, 'warning', now);
      this._clearAlert(type + '-severe');
      this._clearAlert(type + '-extreme');
    } else {
      this._clearAlert(type + '-warning');
      this._clearAlert(type + '-severe');
      this._clearAlert(type + '-extreme');
    }
  }

  /** Raise an alert if not already active. */
  _raiseAlert(id, message, severity, timestamp) {
    var existing = null;
    for (var i = 0; i < this.activeAlerts.length; i++) {
      if (this.activeAlerts[i].id === id) { existing = this.activeAlerts[i]; break; }
    }
    if (!existing) {
      var alert = { id: id, message: message, severity: severity, raisedAt: timestamp, updatedAt: timestamp };
      this.activeAlerts.push(alert);
      this.alertHistory.push({ id: id, message: message, severity: severity, raisedAt: timestamp, clearedAt: null });
      if (this.alertHistory.length > 500) this.alertHistory.shift();
      this.homey.log('[Väderstation] VARNING: ' + message);
      this.emit('weather-alert', alert);
    } else {
      existing.updatedAt = timestamp;
    }
  }

  /** Clear an active alert by id. */
  _clearAlert(id) {
    for (var i = this.activeAlerts.length - 1; i >= 0; i--) {
      if (this.activeAlerts[i].id === id) {
        var cleared = this.activeAlerts.splice(i, 1)[0];
        for (var h = this.alertHistory.length - 1; h >= 0; h--) {
          if (this.alertHistory[h].id === id && this.alertHistory[h].clearedAt === null) {
            this.alertHistory[h].clearedAt = new Date().toISOString();
            break;
          }
        }
        this.emit('weather-alert-cleared', cleared);
        break;
      }
    }
  }

  // ── Automation Trigger Engine ─────────────────────────────────────────

  /** Start the automation trigger evaluation loop. */
  _startAutomationTriggerEngine() {
    var self = this;
    var iv = setInterval(function() {
      try { self._evaluateAutomationTriggers(); }
      catch (e) { self.homey.error('[Väderstation] Automationsfel: ' + e.message); }
    }, 20000);
    this.intervals.push(iv);
    this.homey.log('[Väderstation] Automationsmotor startad');
  }

  /** Evaluate each automation trigger against current sensor data. */
  _evaluateAutomationTriggers() {
    var main = this.stations['main-outdoor'];
    if (!main || !main.online) return;
    var now = new Date().toISOString();

    for (var i = 0; i < this.automationTriggers.length; i++) {
      var trigger = this.automationTriggers[i];
      if (!trigger.enabled) continue;

      var sensorValue = null;
      if (trigger.condition === 'lightning') {
        var ls = this.stations['rooftop-lightning'];
        sensorValue = ls && ls.online && ls.sensors.lightning.value !== null ? ls.sensors.lightning.value : 999;
      } else if (main.sensors[trigger.condition]) {
        sensorValue = main.sensors[trigger.condition].value;
      }
      if (sensorValue === null) continue;

      var shouldTrigger = false;
      switch (trigger.operator) {
        case '>': shouldTrigger = sensorValue > trigger.threshold; break;
        case '<': shouldTrigger = sensorValue < trigger.threshold; break;
        case '>=': shouldTrigger = sensorValue >= trigger.threshold; break;
        case '<=': shouldTrigger = sensorValue <= trigger.threshold; break;
        case '==': shouldTrigger = sensorValue === trigger.threshold; break;
      }

      if (shouldTrigger) {
        // Cooldown: 5 minutes between triggers
        if (trigger.lastTriggered) {
          var elapsed = Date.now() - new Date(trigger.lastTriggered).getTime();
          if (elapsed < 300000) continue;
        }
        trigger.lastTriggered = now;
        trigger.triggerCount++;
        this.homey.log('[Väderstation] Automation utlöst: ' + trigger.name + ' (värde: ' + sensorValue + ')');
        this.emit('weather-automation-trigger', {
          triggerId: trigger.id, name: trigger.name, action: trigger.action,
          sensorValue: sensorValue, threshold: trigger.threshold, timestamp: now
        });
      }
    }
  }

  // ── History Recorder ──────────────────────────────────────────────────

  /** Start periodic history recording. */
  _startHistoryRecorder() {
    var self = this;
    var iv = setInterval(function() {
      try { self._recordHourlyHistory(); }
      catch (e) { self.homey.error('[Väderstation] Historikfel: ' + e.message); }
    }, 60000);
    this.intervals.push(iv);
    this.homey.log('[Väderstation] Historikregistrering startad');
  }

  /** Record an hourly history snapshot from the main station. */
  _recordHourlyHistory() {
    var main = this.stations['main-outdoor'];
    if (!main || !main.online) return;
    var record = {
      timestamp: new Date().toISOString(),
      temperature: main.sensors.temperature ? main.sensors.temperature.value : null,
      humidity: main.sensors.humidity ? main.sensors.humidity.value : null,
      pressure: main.sensors.pressure ? main.sensors.pressure.value : null,
      windSpeed: main.sensors.windSpeed ? main.sensors.windSpeed.value : null,
      windDirection: main.sensors.windDirection ? main.sensors.windDirection.value : null,
      windGust: main.sensors.windGust ? main.sensors.windGust.value : null,
      rain: main.sensors.rain ? main.sensors.rain.value : null,
      uv: main.sensors.uv ? main.sensors.uv.value : null
    };
    this.history.hourly.push(record);
    if (this.history.hourly.length > this.history.maxHourly) this.history.hourly.shift();

    // Aggregate daily (every 24 records)
    if (this.history.hourly.length > 0 && this.history.hourly.length % 24 === 0) {
      this._aggregateDaily();
    }
  }

  /** Aggregate the last 24 hourly records into a daily summary. */
  _aggregateDaily() {
    var start = Math.max(0, this.history.hourly.length - 24);
    var slice = this.history.hourly.slice(start);
    var sumTemp = 0, sumHum = 0, sumWind = 0, maxGust = 0, totalRain = 0;
    var minTemp = Infinity, maxTemp = -Infinity;
    var count = slice.length;
    for (var i = 0; i < count; i++) {
      var r = slice[i];
      if (r.temperature !== null) {
        sumTemp += r.temperature;
        if (r.temperature < minTemp) minTemp = r.temperature;
        if (r.temperature > maxTemp) maxTemp = r.temperature;
      }
      if (r.humidity !== null) sumHum += r.humidity;
      if (r.windSpeed !== null) sumWind += r.windSpeed;
      if (r.windGust !== null && r.windGust > maxGust) maxGust = r.windGust;
      if (r.rain !== null) totalRain += r.rain;
    }
    var daily = {
      date: new Date().toISOString().split('T')[0],
      avgTemp: Math.round((sumTemp / count) * 10) / 10,
      minTemp: Math.round(minTemp * 10) / 10,
      maxTemp: Math.round(maxTemp * 10) / 10,
      avgHumidity: Math.round(sumHum / count),
      avgWind: Math.round((sumWind / count) * 10) / 10,
      maxGust: Math.round(maxGust * 10) / 10,
      totalRain: Math.round(totalRain * 10) / 10
    };
    this.history.daily.push(daily);
    if (this.history.daily.length > this.history.maxDaily) this.history.daily.shift();
    this.homey.log('[Väderstation] Daglig sammanfattning registrerad: medel ' + daily.avgTemp + '°C');
  }

  // ── Calibration Monitor ───────────────────────────────────────────────

  /** Start periodic calibration checks. */
  _startCalibrationMonitor() {
    var self = this;
    var iv = setInterval(function() {
      try { self._checkCalibrations(); }
      catch (e) { self.homey.error('[Väderstation] Kalibreringsfel: ' + e.message); }
    }, 120000);
    this.intervals.push(iv);
    this._initCalibrationSchedule();
    this.homey.log('[Väderstation] Kalibreringsövervakning startad');
  }

  /** Initialize calibration schedule dates. */
  _initCalibrationSchedule() {
    var now = Date.now();
    var stationKeys = Object.keys(this.stations);
    for (var i = 0; i < stationKeys.length; i++) {
      var station = this.stations[stationKeys[i]];
      station.calibration.lastCalibrated = new Date(now - Math.random() * 60 * 86400000).toISOString();
      station.calibration.nextCalibration = new Date(now + (this.calibrationSchedule.intervalDays - Math.random() * 30) * 86400000).toISOString();
      station.calibration.driftPercent = Math.round(Math.random() * 3 * 100) / 100;
    }
    this.calibrationSchedule.lastFullCalibration = new Date(now - 45 * 86400000).toISOString();
    this.calibrationSchedule.nextFullCalibration = new Date(now + 45 * 86400000).toISOString();
  }

  /** Check if any station needs calibration. */
  _checkCalibrations() {
    var now = Date.now();
    var stationKeys = Object.keys(this.stations);
    for (var i = 0; i < stationKeys.length; i++) {
      var station = this.stations[stationKeys[i]];
      if (!station.calibration.nextCalibration) continue;
      var nextCal = new Date(station.calibration.nextCalibration).getTime();
      if (now >= nextCal) {
        station.calibration.status = 'needs-calibration';
        this.homey.log('[Väderstation] Station behöver kalibrering: ' + station.name);
        this.emit('calibration-needed', { stationId: station.id, name: station.name });
      }
      // Simulate slow drift
      station.calibration.driftPercent = Math.round((station.calibration.driftPercent + Math.random() * 0.05) * 100) / 100;
      if (station.calibration.driftPercent > 5) {
        station.calibration.status = 'drift-warning';
        this.homey.log('[Väderstation] Sensordrift varning: ' + station.name + ' (' + station.calibration.driftPercent + '%)');
      }
    }
  }

  // ── External API Sync ─────────────────────────────────────────────────

  /** Start periodic external API data fetching. */
  _startExternalApiSync() {
    var self = this;
    var iv = setInterval(function() {
      try { self._syncExternalApis(); }
      catch (e) { self.homey.error('[Väderstation] API-synkfel: ' + e.message); }
    }, 300000);
    this.intervals.push(iv);
    this._syncExternalApis();
    this.homey.log('[Väderstation] Extern API-synkronisering startad (5 min intervall)');
  }

  /** Simulate fetching and comparing data from external weather APIs. */
  _syncExternalApis() {
    var main = this.stations['main-outdoor'];
    if (!main || !main.online) return;
    var localTemp = main.sensors.temperature ? main.sensors.temperature.value : null;
    var now = new Date().toISOString();
    var apiKeys = Object.keys(this.externalApis);

    for (var i = 0; i < apiKeys.length; i++) {
      var api = this.externalApis[apiKeys[i]];
      if (!api.enabled) continue;
      // Simulate API temperature with some deviation
      var apiTemp = localTemp !== null ? localTemp + (Math.random() - 0.5) * 3 : null;
      var apiHumidity = main.sensors.humidity ? main.sensors.humidity.value + (Math.random() - 0.5) * 8 : null;
      var apiPressure = main.sensors.pressure ? main.sensors.pressure.value + (Math.random() - 0.5) * 2 : null;

      api.lastData = {
        temperature: apiTemp !== null ? Math.round(apiTemp * 10) / 10 : null,
        humidity: apiHumidity !== null ? Math.round(apiHumidity) : null,
        pressure: apiPressure !== null ? Math.round(apiPressure * 10) / 10 : null
      };
      api.lastFetch = now;
      api.deviation = apiTemp !== null && localTemp !== null ? Math.round(Math.abs(apiTemp - localTemp) * 10) / 10 : 0;
      api.reliability = Math.max(50, Math.min(100, 100 - api.deviation * 10));
    }
    this.homey.log('[Väderstation] Extern API-data uppdaterad – avvikelse SMHI: ' +
      this.externalApis.smhi.deviation + '°C, OpenWeather: ' +
      this.externalApis.openWeather.deviation + '°C');
  }

  // ── Pollen & AQI Monitor ──────────────────────────────────────────────

  /** Start periodic pollen and AQI updates. */
  _startPollenAqiMonitor() {
    var self = this;
    var iv = setInterval(function() {
      try { self._updatePollenAqi(); }
      catch (e) { self.homey.error('[Väderstation] Pollen/AQI-fel: ' + e.message); }
    }, 600000);
    this.intervals.push(iv);
    this._updatePollenAqi();
    this.homey.log('[Väderstation] Pollen- och luftkvalitetsövervakning startad');
  }

  /** Simulate pollen and AQI data updates. */
  _updatePollenAqi() {
    var month = new Date().getMonth();
    var season = this._getSeason(month);
    var pollenBase = season === 'spring' ? 60 : season === 'summer' ? 40 : 10;
    this.pollenAqi.pollenIndex = Math.round(pollenBase + (Math.random() - 0.5) * 30);
    this.pollenAqi.pollenIndex = Math.max(0, Math.min(100, this.pollenAqi.pollenIndex));

    if (this.pollenAqi.pollenIndex > 60) { this.pollenAqi.pollenLevel = 'high'; this.pollenAqi.pollenType = season === 'spring' ? 'björk' : 'gräs'; }
    else if (this.pollenAqi.pollenIndex > 30) { this.pollenAqi.pollenLevel = 'medium'; this.pollenAqi.pollenType = 'blandad'; }
    else { this.pollenAqi.pollenLevel = 'low'; this.pollenAqi.pollenType = 'none'; }

    this.pollenAqi.aqi = Math.round(20 + Math.random() * 60);
    this.pollenAqi.pm25 = Math.round((5 + Math.random() * 25) * 10) / 10;
    this.pollenAqi.pm10 = Math.round((10 + Math.random() * 40) * 10) / 10;
    if (this.pollenAqi.aqi <= 50) this.pollenAqi.aqiCategory = 'good';
    else if (this.pollenAqi.aqi <= 100) this.pollenAqi.aqiCategory = 'moderate';
    else this.pollenAqi.aqiCategory = 'unhealthy';

    this.pollenAqi.dominantPollutant = this.pollenAqi.pm25 > this.pollenAqi.pm10 * 0.5 ? 'PM2.5' : 'PM10';
    this.pollenAqi.lastUpdated = new Date().toISOString();
  }

  // ── Precipitation Tracker ─────────────────────────────────────────────

  /** Start tracking rain accumulation and drought status. */
  _startPrecipitationTracker() {
    var self = this;
    var iv = setInterval(function() {
      try { self._updatePrecipitation(); }
      catch (e) { self.homey.error('[Väderstation] Nederbördsfel: ' + e.message); }
    }, 60000);
    this.intervals.push(iv);
    this.homey.log('[Väderstation] Nederbördsspårning startad');
  }

  /** Update precipitation accumulation and drought metrics. */
  _updatePrecipitation() {
    var main = this.stations['main-outdoor'];
    if (!main || !main.online) return;
    var rain = main.sensors.rain ? main.sensors.rain.value : 0;
    var rainPerMinute = rain / 60;
    this.precipitation.todayMm = Math.round((this.precipitation.todayMm + rainPerMinute) * 100) / 100;
    this.precipitation.weekMm = Math.round((this.precipitation.weekMm + rainPerMinute) * 100) / 100;
    this.precipitation.monthMm = Math.round((this.precipitation.monthMm + rainPerMinute) * 100) / 100;
    this.precipitation.yearMm = Math.round((this.precipitation.yearMm + rainPerMinute) * 100) / 100;

    if (rain > 0.1) {
      this.precipitation.lastRainDate = new Date().toISOString();
      this.precipitation.consecutiveDryDays = 0;
      this.precipitation.consecutiveWetDays++;
    }

    // Drought assessment
    if (this.precipitation.consecutiveDryDays >= 30) this.precipitation.droughtLevel = 'severe';
    else if (this.precipitation.consecutiveDryDays >= 14) this.precipitation.droughtLevel = 'moderate';
    else if (this.precipitation.consecutiveDryDays >= 7) this.precipitation.droughtLevel = 'mild';
    else this.precipitation.droughtLevel = 'none';

    if (this.precipitation.droughtLevel !== 'none') {
      this.homey.log('[Väderstation] Torka-nivå: ' + this.precipitation.droughtLevel +
        ' (' + this.precipitation.consecutiveDryDays + ' torra dagar)');
    }
  }

  // ── Derived Metrics Calculator ────────────────────────────────────────

  /** Start computing wind chill, heat index, dew point, etc. */
  _startDerivedMetricsCalc() {
    var self = this;
    var iv = setInterval(function() {
      try { self._calculateDerivedMetrics(); }
      catch (e) { self.homey.error('[Väderstation] Beräkningsfel: ' + e.message); }
    }, 30000);
    this.intervals.push(iv);
    this._calculateDerivedMetrics();
    this.homey.log('[Väderstation] Härledda mätvärden beräknas');
  }

  /** Calculate wind chill, heat index, dew point, feels-like, and cloud base. */
  _calculateDerivedMetrics() {
    var main = this.stations['main-outdoor'];
    if (!main || !main.online) return;
    var temp = main.sensors.temperature ? main.sensors.temperature.value : null;
    var humidity = main.sensors.humidity ? main.sensors.humidity.value : null;
    var windSpeed = main.sensors.windSpeed ? main.sensors.windSpeed.value : null;
    if (temp === null) return;

    // Wind chill (valid for temp <= 10°C and wind > 1.3 m/s)
    if (temp <= 10 && windSpeed !== null && windSpeed > 1.3) {
      var windKmh = windSpeed * 3.6;
      this.derivedMetrics.windChill = Math.round(
        (13.12 + 0.6215 * temp - 11.37 * Math.pow(windKmh, 0.16) + 0.3965 * temp * Math.pow(windKmh, 0.16)) * 10
      ) / 10;
    } else {
      this.derivedMetrics.windChill = null;
    }

    // Heat index (valid for temp >= 27°C)
    if (temp >= 27 && humidity !== null) {
      var c1 = -8.7847, c2 = 1.6114, c3 = 2.3385, c4 = -0.1461, c5 = -0.01231;
      var c6 = -0.01642, c7 = 0.002212, c8 = 0.000725, c9 = -0.000003582;
      this.derivedMetrics.heatIndex = Math.round((
        c1 + c2 * temp + c3 * humidity + c4 * temp * humidity +
        c5 * temp * temp + c6 * humidity * humidity +
        c7 * temp * temp * humidity + c8 * temp * humidity * humidity +
        c9 * temp * temp * humidity * humidity
      ) * 10) / 10;
    } else {
      this.derivedMetrics.heatIndex = null;
    }

    // Dew point (Magnus formula)
    if (humidity !== null) {
      var a = 17.27, b = 237.7;
      var gamma = (a * temp) / (b + temp) + Math.log(humidity / 100);
      this.derivedMetrics.dewPoint = Math.round(((b * gamma) / (a - gamma)) * 10) / 10;
    }

    // Feels like (combined)
    if (this.derivedMetrics.windChill !== null) {
      this.derivedMetrics.feelsLike = this.derivedMetrics.windChill;
    } else if (this.derivedMetrics.heatIndex !== null) {
      this.derivedMetrics.feelsLike = this.derivedMetrics.heatIndex;
    } else {
      this.derivedMetrics.feelsLike = temp;
    }

    // Cloud base estimate (meters)
    if (this.derivedMetrics.dewPoint !== null) {
      this.derivedMetrics.cloudBase = Math.round((temp - this.derivedMetrics.dewPoint) * 125);
    }

    // Visibility estimate based on humidity and precipitation
    var rain = main.sensors.rain ? main.sensors.rain.value : 0;
    if (rain > 10 || (humidity !== null && humidity > 95)) this.derivedMetrics.visibilityEstimate = 'poor';
    else if (rain > 2 || (humidity !== null && humidity > 85)) this.derivedMetrics.visibilityEstimate = 'moderate';
    else this.derivedMetrics.visibilityEstimate = 'good';
  }

  // ── Solar Scheduler ───────────────────────────────────────────────────

  /** Start sunrise/sunset calculation updates. */
  _startSolarScheduler() {
    var self = this;
    var iv = setInterval(function() {
      try { self._calculateSolarData(); }
      catch (e) { self.homey.error('[Väderstation] Solberäkningsfel: ' + e.message); }
    }, 3600000);
    this.intervals.push(iv);
    this.homey.log('[Väderstation] Solschemaläggare startad');
  }

  /** Calculate sunrise, sunset, twilight and day length using simplified algorithm. */
  _calculateSolarData() {
    var now = new Date();
    var dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
    var lat = this.solarData.latitude;

    // Simplified sunrise/sunset calculation
    var declination = -23.45 * Math.cos((360 / 365) * (dayOfYear + 10) * Math.PI / 180);
    var latRad = lat * Math.PI / 180;
    var declRad = declination * Math.PI / 180;
    var hourAngle = Math.acos(-Math.tan(latRad) * Math.tan(declRad)) * 180 / Math.PI;

    var solarNoonHours = 12 - this.solarData.longitude / 15 + 1; // UTC+1 rough
    var sunriseHours = solarNoonHours - hourAngle / 15;
    var sunsetHours = solarNoonHours + hourAngle / 15;

    var toTimeString = function(h) {
      var hours = Math.floor(h);
      var minutes = Math.round((h - hours) * 60);
      return (hours < 10 ? '0' : '') + hours + ':' + (minutes < 10 ? '0' : '') + minutes;
    };

    this.solarData.sunrise = toTimeString(sunriseHours);
    this.solarData.sunset = toTimeString(sunsetHours);
    this.solarData.solarNoon = toTimeString(solarNoonHours);
    this.solarData.dayLength = Math.round((sunsetHours - sunriseHours) * 60);
    this.solarData.twilightStart = toTimeString(sunriseHours - 0.5);
    this.solarData.twilightEnd = toTimeString(sunsetHours + 0.5);
    this.solarData.lastCalculated = now.toISOString();

    this.homey.log('[Väderstation] Soldata: uppgång ' + this.solarData.sunrise +
      ', nedgång ' + this.solarData.sunset + ', daglängd ' + this.solarData.dayLength + ' min');
  }

  // ── Station Health Monitor ────────────────────────────────────────────

  /** Start monitoring station health and connectivity. */
  _startStationHealthMonitor() {
    var self = this;
    var iv = setInterval(function() {
      try { self._checkStationHealth(); }
      catch (e) { self.homey.error('[Väderstation] Hälsokontrollfel: ' + e.message); }
    }, 60000);
    this.intervals.push(iv);
    this.homey.log('[Väderstation] Stationshälsoövervakning startad');
  }

  /** Check battery levels, signal strength, and sensor staleness. */
  _checkStationHealth() {
    var now = Date.now();
    var stationKeys = Object.keys(this.stations);
    for (var i = 0; i < stationKeys.length; i++) {
      var station = this.stations[stationKeys[i]];
      // Battery drain simulation
      station.battery = Math.max(0, station.battery - Math.random() * 0.02);
      station.battery = Math.round(station.battery * 100) / 100;

      // Signal fluctuation
      station.signalStrength = Math.max(10, Math.min(100,
        station.signalStrength + (Math.random() - 0.5) * 3));
      station.signalStrength = Math.round(station.signalStrength);

      // Low battery alert
      if (station.battery < 15 && station.online) {
        this.homey.log('[Väderstation] Lågt batteri: ' + station.name + ' (' + station.battery + '%)');
        this.emit('station-low-battery', { stationId: station.id, battery: station.battery });
      }

      // Offline detection (signal too low)
      if (station.signalStrength < 15) {
        if (station.online) {
          station.online = false;
          station.errorCount++;
          this.homey.log('[Väderstation] Station offline: ' + station.name);
          this.emit('station-offline', { stationId: station.id, name: station.name });
        }
      } else if (!station.online && station.signalStrength > 30) {
        station.online = true;
        this.homey.log('[Väderstation] Station online igen: ' + station.name);
        this.emit('station-online', { stationId: station.id, name: station.name });
      }

      // Check for stale sensor readings
      var sensorKeys = Object.keys(station.sensors);
      for (var j = 0; j < sensorKeys.length; j++) {
        var sensor = station.sensors[sensorKeys[j]];
        if (sensor.lastReading) {
          var age = now - new Date(sensor.lastReading).getTime();
          if (age > 600000) { // 10 minutes stale
            this.homey.log('[Väderstation] Inaktuell sensor: ' + station.name + '/' + sensorKeys[j]);
          }
        }
      }
    }
  }

  // ── Report Generator ──────────────────────────────────────────────────

  /** Start periodic report generation. */
  _startReportGenerator() {
    var self = this;
    var iv = setInterval(function() {
      try { self._generateReport(); }
      catch (e) { self.homey.error('[Väderstation] Rapportgenereringsfel: ' + e.message); }
    }, 3600000);
    this.intervals.push(iv);
    this.homey.log('[Väderstation] Rapportgenerator startad (1h intervall)');
  }

  /** Generate summary report from history data. */
  _generateReport() {
    if (this.history.hourly.length === 0) return;
    var sumTemp = 0, sumWind = 0, count = 0;
    this.report.maxTemp = -Infinity;
    this.report.minTemp = Infinity;
    this.report.maxGust = 0;
    this.report.totalRain = 0;
    this.report.frostDays = 0;
    this.report.rainyDays = 0;
    this.report.sunnyDays = 0;

    for (var i = 0; i < this.history.hourly.length; i++) {
      var r = this.history.hourly[i];
      if (r.temperature !== null) {
        sumTemp += r.temperature;
        if (r.temperature > this.report.maxTemp) this.report.maxTemp = r.temperature;
        if (r.temperature < this.report.minTemp) this.report.minTemp = r.temperature;
        if (r.temperature < 0) this.report.frostDays++;
        count++;
      }
      if (r.windSpeed !== null) sumWind += r.windSpeed;
      if (r.windGust !== null && r.windGust > this.report.maxGust) this.report.maxGust = r.windGust;
      if (r.rain !== null) {
        this.report.totalRain += r.rain;
        if (r.rain > 0.1) this.report.rainyDays++;
        else this.report.sunnyDays++;
      }
    }
    this.report.avgTemp = count > 0 ? Math.round((sumTemp / count) * 10) / 10 : 0;
    this.report.avgWind = count > 0 ? Math.round((sumWind / count) * 10) / 10 : 0;
    this.report.totalRain = Math.round(this.report.totalRain * 10) / 10;
    this.report.alertCount = this.alertHistory.length;
    this.report.automationTriggerCount = 0;
    for (var t = 0; t < this.automationTriggers.length; t++) {
      this.report.automationTriggerCount += this.automationTriggers[t].triggerCount;
    }
    this.report.generatedAt = new Date().toISOString();
    this.homey.log('[Väderstation] Rapport genererad: medel ' + this.report.avgTemp + '°C, regn ' + this.report.totalRain + 'mm');
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Public API Methods
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Get overall system status.
   * @returns {Object} status summary
   */
  getStatus() {
    var onlineCount = 0;
    var totalStations = Object.keys(this.stations).length;
    var stationKeys = Object.keys(this.stations);
    for (var i = 0; i < stationKeys.length; i++) {
      if (this.stations[stationKeys[i]].online) onlineCount++;
    }
    return {
      initialized: this.initialized,
      stationsOnline: onlineCount,
      stationsTotal: totalStations,
      activeAlerts: this.activeAlerts.length,
      forecastConfidence: this.forecast.confidence,
      pressureTrend: this.forecast.pressureTrend,
      droughtLevel: this.precipitation.droughtLevel,
      pollenLevel: this.pollenAqi.pollenLevel,
      aqiCategory: this.pollenAqi.aqiCategory,
      sunrise: this.solarData.sunrise,
      sunset: this.solarData.sunset,
      dayLength: this.solarData.dayLength,
      historyHours: this.history.hourly.length,
      automationTriggers: this.automationTriggers.length,
      lastReportAt: this.report.generatedAt,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get current weather data from all stations.
   * @returns {Object} aggregated weather data
   */
  getWeatherData() {
    var main = this.stations['main-outdoor'];
    var data = { stations: {}, derived: this.derivedMetrics, microclimates: {}, pollenAqi: this.pollenAqi };
    var stationKeys = Object.keys(this.stations);
    for (var i = 0; i < stationKeys.length; i++) {
      var station = this.stations[stationKeys[i]];
      var readings = {};
      var sKeys = Object.keys(station.sensors);
      for (var j = 0; j < sKeys.length; j++) {
        readings[sKeys[j]] = { value: station.sensors[sKeys[j]].value, unit: station.sensors[sKeys[j]].unit };
      }
      data.stations[stationKeys[i]] = {
        name: station.name, zone: station.zone, online: station.online,
        battery: station.battery, readings: readings
      };
    }
    var microKeys = Object.keys(this.microclimates);
    for (var m = 0; m < microKeys.length; m++) {
      var mc = this.microclimates[microKeys[m]];
      var baseTemp = main && main.sensors.temperature ? main.sensors.temperature.value : null;
      var baseHum = main && main.sensors.humidity ? main.sensors.humidity.value : null;
      data.microclimates[microKeys[m]] = {
        name: mc.name,
        adjustedTemp: baseTemp !== null ? Math.round((baseTemp + mc.tempOffset) * 10) / 10 : null,
        adjustedHumidity: baseHum !== null ? Math.round(Math.max(0, Math.min(100, baseHum + mc.humidityOffset))) : null,
        exposure: mc.exposure, windExposure: mc.windExposure
      };
    }
    data.precipitation = {
      todayMm: this.precipitation.todayMm, weekMm: this.precipitation.weekMm,
      monthMm: this.precipitation.monthMm, droughtLevel: this.precipitation.droughtLevel
    };
    data.solar = {
      sunrise: this.solarData.sunrise, sunset: this.solarData.sunset,
      dayLength: this.solarData.dayLength
    };
    data.timestamp = new Date().toISOString();
    return data;
  }

  /**
   * Get weather forecast.
   * @returns {Object} forecast data
   */
  getForecast() {
    return {
      current: this.forecast.current,
      hourly: this.forecast.hourly,
      daily: this.forecast.daily,
      confidence: this.forecast.confidence,
      pressureTrend: this.forecast.pressureTrend,
      matchedPattern: this.forecast.current ? this.forecast.current.matchedPattern : null,
      externalComparison: this._getExternalComparison(),
      lastUpdated: this.forecast.lastUpdated
    };
  }

  /**
   * Get comparison data from external APIs.
   * @returns {Object} external API comparison
   */
  _getExternalComparison() {
    var comp = {};
    var apiKeys = Object.keys(this.externalApis);
    for (var i = 0; i < apiKeys.length; i++) {
      var api = this.externalApis[apiKeys[i]];
      comp[apiKeys[i]] = {
        name: api.name, lastData: api.lastData,
        deviation: api.deviation, reliability: api.reliability
      };
    }
    return comp;
  }

  /**
   * Get active and recent weather alerts.
   * @returns {Object} alerts data
   */
  getAlerts() {
    return {
      active: this.activeAlerts.slice(),
      recentHistory: this.alertHistory.slice(-50),
      thresholds: this.alertThresholds,
      automationTriggers: this.automationTriggers.map(function(t) {
        return {
          id: t.id, name: t.name, condition: t.condition,
          operator: t.operator, threshold: t.threshold,
          enabled: t.enabled, lastTriggered: t.lastTriggered, triggerCount: t.triggerCount
        };
      }),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get historical weather data.
   * @param {string} [period='hourly'] - 'hourly', 'daily', or 'monthly'
   * @returns {Object} history data
   */
  getHistory(period) {
    period = period || 'hourly';
    var data = [];
    switch (period) {
      case 'hourly': data = this.history.hourly.slice(); break;
      case 'daily': data = this.history.daily.slice(); break;
      case 'monthly': data = this.history.monthly.slice(); break;
    }
    // Anomaly detection: flag values that deviate > 2 std from mean
    var anomalies = [];
    if (data.length > 10 && period === 'hourly') {
      var sumT = 0, countT = 0;
      for (var i = 0; i < data.length; i++) {
        if (data[i].temperature !== null) { sumT += data[i].temperature; countT++; }
      }
      var meanT = countT > 0 ? sumT / countT : 0;
      var variance = 0;
      for (var v = 0; v < data.length; v++) {
        if (data[v].temperature !== null) variance += Math.pow(data[v].temperature - meanT, 2);
      }
      var std = countT > 1 ? Math.sqrt(variance / (countT - 1)) : 0;
      for (var a = 0; a < data.length; a++) {
        if (data[a].temperature !== null && Math.abs(data[a].temperature - meanT) > 2 * std) {
          anomalies.push({ index: a, temperature: data[a].temperature, timestamp: data[a].timestamp, deviation: Math.round(Math.abs(data[a].temperature - meanT) * 10) / 10 });
        }
      }
    }
    return {
      period: period, recordCount: data.length, data: data,
      anomalies: anomalies, report: this.report,
      precipitation: {
        todayMm: this.precipitation.todayMm, weekMm: this.precipitation.weekMm,
        monthMm: this.precipitation.monthMm, yearMm: this.precipitation.yearMm,
        consecutiveDryDays: this.precipitation.consecutiveDryDays,
        droughtLevel: this.precipitation.droughtLevel
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get sensor health and calibration status for all stations.
   * @returns {Object} sensor health data
   */
  getSensorHealth() {
    var health = { stations: {}, calibration: this.calibrationSchedule, overallHealth: 'good' };
    var issues = 0;
    var stationKeys = Object.keys(this.stations);
    for (var i = 0; i < stationKeys.length; i++) {
      var station = this.stations[stationKeys[i]];
      var sensorStatuses = {};
      var sKeys = Object.keys(station.sensors);
      for (var j = 0; j < sKeys.length; j++) {
        var sensor = station.sensors[sKeys[j]];
        var stale = sensor.lastReading ? (Date.now() - new Date(sensor.lastReading).getTime() > 600000) : true;
        sensorStatuses[sKeys[j]] = {
          value: sensor.value, lastReading: sensor.lastReading,
          accuracy: sensor.accuracy, stale: stale
        };
        if (stale) issues++;
      }
      var stationHealth = {
        name: station.name, model: station.model, firmware: station.firmware,
        online: station.online, battery: Math.round(station.battery * 100) / 100,
        signalStrength: station.signalStrength, errorCount: station.errorCount,
        uptime: station.uptime, calibration: station.calibration,
        sensors: sensorStatuses
      };
      health.stations[stationKeys[i]] = stationHealth;
      if (!station.online) issues++;
      if (station.battery < 15) issues++;
      if (station.calibration.status !== 'ok') issues++;
    }
    if (issues > 3) health.overallHealth = 'poor';
    else if (issues > 0) health.overallHealth = 'fair';
    health.issueCount = issues;
    health.timestamp = new Date().toISOString();
    return health;
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Lifecycle
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Destroy the system, clearing all intervals and timeouts.
   */
  destroy() {
    this.homey.log('[Väderstation] Stänger ned väderstationssystemet...');
    for (var i = 0; i < this.intervals.length; i++) clearInterval(this.intervals[i]);
    this.intervals = [];
    for (var t = 0; t < this.timeouts.length; t++) clearTimeout(this.timeouts[t]);
    this.timeouts = [];
    this.activeAlerts = [];
    this.history.hourly = [];
    this.history.daily = [];
    this.forecast.hourly = [];
    this.forecast.daily = [];
    this.initialized = false;
    this.homey.log('[Väderstation] Systemet avstängt');
  }
}

module.exports = SmartWeatherStationSystem;
