'use strict';

class AdvancedWeatherIntegration {
  constructor(homey) {
    this.homey = homey;
    this.currentWeather = {};
    this.forecast = [];
    this.pollenCounts = {};
    this.aqiData = {};
    this.automationRules = new Map();
    this.locations = new Map();
    this.historicalData = [];
    this.indoorCorrelation = {};
    this.severeWeatherAlerts = [];
    this.updateInterval = null;
    this.alertCheckInterval = null;
    this.initialized = false;
  }

  async initialize() {
    this.log('Initializing Advanced Weather Integration...');
    try {
      this._initializeLocations();
      this._initializeAutomationRules();
      this._initializePollenTracking();
      this._initializeAQI();
      this.currentWeather = this._generateCurrentWeather();
      this.forecast = this._generate72HourForecast();
      this._seedHistoricalData();
      this._startMonitoring();
      this.initialized = true;
      this.log('Advanced Weather Integration initialized successfully');
    } catch (err) {
      this.error('Failed to initialize Weather Integration: ' + err.message);
      throw err;
    }
  }

  _initializeLocations() {
    this.locations.set('home', {
      id: 'home',
      name: 'Home',
      latitude: 59.33,
      longitude: 18.07,
      elevation: 28,
      timezone: 'Europe/Stockholm',
      isPrimary: true,
      lastUpdate: null
    });

    this.locations.set('work', {
      id: 'work',
      name: 'Work Office',
      latitude: 59.34,
      longitude: 18.05,
      elevation: 22,
      timezone: 'Europe/Stockholm',
      isPrimary: false,
      lastUpdate: null
    });

    this.locations.set('vacation', {
      id: 'vacation',
      name: 'Summer Cottage',
      latitude: 57.70,
      longitude: 11.97,
      elevation: 5,
      timezone: 'Europe/Stockholm',
      isPrimary: false,
      lastUpdate: null
    });

    this.log('Locations initialized: ' + this.locations.size);
  }

  _initializeAutomationRules() {
    this.automationRules.set('rain_close_windows', {
      id: 'rain_close_windows',
      name: 'Close windows on rain',
      condition: (w) => w.precipitation > 0.5,
      action: 'close_windows',
      priority: 9,
      enabled: true,
      lastTriggered: null,
      triggerCount: 0
    });

    this.automationRules.set('heat_close_blinds', {
      id: 'heat_close_blinds',
      name: 'Close blinds on extreme heat',
      condition: (w) => w.temperature > 28,
      action: 'close_blinds',
      priority: 7,
      enabled: true,
      lastTriggered: null,
      triggerCount: 0
    });

    this.automationRules.set('storm_secure_home', {
      id: 'storm_secure_home',
      name: 'Secure home during storm',
      condition: (w) => w.windSpeed > 20 || w.windGust > 30,
      action: 'secure_home',
      priority: 10,
      enabled: true,
      lastTriggered: null,
      triggerCount: 0
    });

    this.automationRules.set('frost_heat_pipes', {
      id: 'frost_heat_pipes',
      name: 'Heat pipes on frost risk',
      condition: (w) => w.temperature < 2 && w.humidity > 80,
      action: 'heat_pipes',
      priority: 9,
      enabled: true,
      lastTriggered: null,
      triggerCount: 0
    });

    this.automationRules.set('uv_deploy_awning', {
      id: 'uv_deploy_awning',
      name: 'Deploy awning on high UV',
      condition: (w) => w.uvIndex > 6,
      action: 'deploy_awning',
      priority: 6,
      enabled: true,
      lastTriggered: null,
      triggerCount: 0
    });

    this.automationRules.set('wind_retract_awning', {
      id: 'wind_retract_awning',
      name: 'Retract awning on high wind',
      condition: (w) => w.windSpeed > 12,
      action: 'retract_awning',
      priority: 8,
      enabled: true,
      lastTriggered: null,
      triggerCount: 0
    });

    this.automationRules.set('cold_boost_heating', {
      id: 'cold_boost_heating',
      name: 'Boost heating in cold weather',
      condition: (w) => w.temperature < -5,
      action: 'boost_heating',
      priority: 8,
      enabled: true,
      lastTriggered: null,
      triggerCount: 0
    });

    this.automationRules.set('fog_turn_on_lights', {
      id: 'fog_turn_on_lights',
      name: 'Turn on outdoor lights in fog',
      condition: (w) => w.visibility < 500,
      action: 'outdoor_lights_on',
      priority: 5,
      enabled: true,
      lastTriggered: null,
      triggerCount: 0
    });

    this.automationRules.set('snow_clear_paths', {
      id: 'snow_clear_paths',
      name: 'Alert for snow path clearing',
      condition: (w) => w.snowfall > 2,
      action: 'snow_alert',
      priority: 6,
      enabled: true,
      lastTriggered: null,
      triggerCount: 0
    });

    this.automationRules.set('dry_start_irrigation', {
      id: 'dry_start_irrigation',
      name: 'Start irrigation in dry weather',
      condition: (w) => w.precipitation === 0 && w.temperature > 20 && w.humidity < 40,
      action: 'start_irrigation',
      priority: 4,
      enabled: true,
      lastTriggered: null,
      triggerCount: 0
    });

    this.automationRules.set('hail_protect_cars', {
      id: 'hail_protect_cars',
      name: 'Alert for hail protection',
      condition: (w) => w.hailRisk > 0.5,
      action: 'hail_alert',
      priority: 9,
      enabled: true,
      lastTriggered: null,
      triggerCount: 0
    });

    this.automationRules.set('nice_weather_open_windows', {
      id: 'nice_weather_open_windows',
      name: 'Open windows in nice weather',
      condition: (w) => w.temperature > 18 && w.temperature < 26 && w.precipitation === 0 && w.windSpeed < 8 && w.humidity < 65,
      action: 'open_windows',
      priority: 3,
      enabled: true,
      lastTriggered: null,
      triggerCount: 0
    });

    this.automationRules.set('sunset_outdoor_lights', {
      id: 'sunset_outdoor_lights',
      name: 'Turn on outdoor lights at sunset',
      condition: (w) => w.solarAltitude < 0 && w.solarAltitude > -6,
      action: 'outdoor_lights_on',
      priority: 4,
      enabled: true,
      lastTriggered: null,
      triggerCount: 0
    });

    this.automationRules.set('high_pollen_close_windows', {
      id: 'high_pollen_close_windows',
      name: 'Close windows on high pollen',
      condition: (w) => w.pollenLevel > 7,
      action: 'close_windows_pollen',
      priority: 7,
      enabled: true,
      lastTriggered: null,
      triggerCount: 0
    });

    this.automationRules.set('poor_aqi_ventilation', {
      id: 'poor_aqi_ventilation',
      name: 'Adjust ventilation on poor AQI',
      condition: (w) => w.aqi > 100,
      action: 'recirculate_air',
      priority: 8,
      enabled: true,
      lastTriggered: null,
      triggerCount: 0
    });

    this.automationRules.set('lightning_disconnect_electronics', {
      id: 'lightning_disconnect_electronics',
      name: 'Alert for lightning protection',
      condition: (w) => w.lightningRisk > 0.7,
      action: 'lightning_alert',
      priority: 10,
      enabled: true,
      lastTriggered: null,
      triggerCount: 0
    });

    this.log('Automation rules initialized: ' + this.automationRules.size);
  }

  _initializePollenTracking() {
    this.pollenCounts = {
      birch: { level: 0, trend: 'stable', season: [3, 4, 5], peak: 4 },
      grass: { level: 0, trend: 'stable', season: [5, 6, 7, 8], peak: 6 },
      mugwort: { level: 0, trend: 'stable', season: [7, 8, 9], peak: 8 },
      alder: { level: 0, trend: 'stable', season: [2, 3, 4], peak: 3 },
      oak: { level: 0, trend: 'stable', season: [4, 5, 6], peak: 5 }
    };
    this._updatePollenLevels();
    this.log('Pollen tracking initialized for 5 types');
  }

  _updatePollenLevels() {
    const month = new Date().getMonth();
    for (const [type, pollen] of Object.entries(this.pollenCounts)) {
      if (pollen.season.includes(month)) {
        const isPeak = month === pollen.peak;
        const baseLevel = isPeak ? 7 : 4;
        pollen.level = Math.min(10, Math.max(0, baseLevel + (Math.random() - 0.5) * 4));
        pollen.trend = Math.random() > 0.5 ? 'increasing' : 'decreasing';
      } else {
        pollen.level = Math.max(0, Math.random() * 1.5);
        pollen.trend = 'stable';
      }
      pollen.level = Math.round(pollen.level * 10) / 10;
    }
  }

  _initializeAQI() {
    this.aqiData = {
      overall: 45,
      pm25: 12,
      pm10: 22,
      o3: 35,
      no2: 18,
      so2: 5,
      co: 0.4,
      category: 'Good',
      healthAdvice: 'Air quality is satisfactory',
      lastUpdated: Date.now()
    };
    this.log('AQI tracking initialized');
  }

  _generateCurrentWeather() {
    const now = new Date();
    const month = now.getMonth();
    const hour = now.getHours();
    const season = this._getSeason(month);
    const profile = this.getSeasonProfile();

    const baseTemp = profile.avgTemp + (Math.random() - 0.5) * 10;
    const diurnalVariation = Math.sin((hour - 6) / 24 * 2 * Math.PI) * profile.diurnalRange;
    const temperature = Math.round((baseTemp + diurnalVariation) * 10) / 10;

    const humidity = Math.round(Math.min(100, Math.max(20, profile.avgHumidity + (Math.random() - 0.5) * 30)));
    const windSpeed = Math.round(Math.max(0, profile.avgWind + (Math.random() - 0.5) * 10) * 10) / 10;
    const windGust = Math.round((windSpeed * (1.3 + Math.random() * 0.7)) * 10) / 10;
    const windDirection = Math.floor(Math.random() * 360);
    const pressure = Math.round((1013 + (Math.random() - 0.5) * 30) * 10) / 10;

    const precipChance = profile.precipChance;
    const isRaining = Math.random() < precipChance;
    const precipitation = isRaining ? Math.round(Math.random() * 5 * 10) / 10 : 0;
    const snowfall = (temperature < 1 && isRaining) ? Math.round(Math.random() * 8 * 10) / 10 : 0;

    const cloudCover = Math.round(Math.min(100, Math.max(0, (isRaining ? 80 : 30) + (Math.random() - 0.5) * 40)));
    const visibility = isRaining ? Math.round(2000 + Math.random() * 8000) : Math.round(8000 + Math.random() * 12000);

    const sunPos = this.calculateSunPosition(now);
    const maxUV = profile.maxUV;
    const uvIndex = sunPos.altitude > 0
      ? Math.round(Math.max(0, maxUV * Math.sin(sunPos.altitude * Math.PI / 180) * (1 - cloudCover / 100 * 0.7)) * 10) / 10
      : 0;

    const totalPollen = Object.values(this.pollenCounts).reduce((s, p) => s + p.level, 0) / 5;

    return {
      temperature: temperature,
      feelsLike: this._calculateFeelsLike(temperature, windSpeed, humidity),
      humidity: humidity,
      pressure: pressure,
      windSpeed: windSpeed,
      windGust: windGust,
      windDirection: windDirection,
      windDirectionCardinal: this._getCardinalDirection(windDirection),
      precipitation: precipitation,
      snowfall: snowfall,
      cloudCover: cloudCover,
      visibility: visibility,
      uvIndex: uvIndex,
      dewPoint: this._calculateDewPoint(temperature, humidity),
      solarAltitude: sunPos.altitude,
      solarAzimuth: sunPos.azimuth,
      season: season,
      condition: this._getWeatherCondition(temperature, precipitation, snowfall, cloudCover, windSpeed),
      aqi: this.aqiData.overall,
      pollenLevel: Math.round(totalPollen * 10) / 10,
      hailRisk: (temperature > 15 && cloudCover > 80 && windGust > 20) ? 0.3 + Math.random() * 0.4 : 0,
      lightningRisk: (temperature > 20 && cloudCover > 70 && humidity > 60) ? 0.2 + Math.random() * 0.5 : 0,
      timestamp: Date.now()
    };
  }

  _generate72HourForecast() {
    const forecast = [];
    const now = new Date();

    for (let i = 0; i < 72; i++) {
      const futureDate = new Date(now.getTime() + i * 3600000);
      const month = futureDate.getMonth();
      const hour = futureDate.getHours();
      const profile = this._getSeasonProfileForMonth(month);

      const baseTemp = profile.avgTemp + (Math.random() - 0.5) * 8;
      const diurnalVariation = Math.sin((hour - 6) / 24 * 2 * Math.PI) * profile.diurnalRange;
      const temperature = Math.round((baseTemp + diurnalVariation) * 10) / 10;

      const humidity = Math.round(Math.min(100, Math.max(25, profile.avgHumidity + (Math.random() - 0.5) * 25)));
      const windSpeed = Math.round(Math.max(0, profile.avgWind + (Math.random() - 0.5) * 8) * 10) / 10;
      const isRaining = Math.random() < profile.precipChance;
      const precipitation = isRaining ? Math.round(Math.random() * 4 * 10) / 10 : 0;
      const cloudCover = Math.round(Math.min(100, Math.max(0, (isRaining ? 75 : 35) + (Math.random() - 0.5) * 35)));

      const sunPos = this.calculateSunPosition(futureDate);
      const uvIndex = sunPos.altitude > 0
        ? Math.round(Math.max(0, profile.maxUV * Math.sin(sunPos.altitude * Math.PI / 180) * (1 - cloudCover / 100 * 0.7)) * 10) / 10
        : 0;

      forecast.push({
        timestamp: futureDate.getTime(),
        hour: hour,
        date: futureDate.toISOString().substring(0, 10),
        temperature: temperature,
        feelsLike: this._calculateFeelsLike(temperature, windSpeed, humidity),
        humidity: humidity,
        windSpeed: windSpeed,
        windGust: Math.round(windSpeed * (1.3 + Math.random() * 0.5) * 10) / 10,
        precipitation: precipitation,
        cloudCover: cloudCover,
        uvIndex: uvIndex,
        condition: this._getWeatherCondition(temperature, precipitation, temperature < 1 ? precipitation : 0, cloudCover, windSpeed),
        confidence: Math.max(0.4, 1 - i * 0.008)
      });
    }

    this.log('72-hour forecast generated');
    return forecast;
  }

  _getSeason(month) {
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'autumn';
    return 'winter';
  }

  getSeasonProfile() {
    const month = new Date().getMonth();
    return this._getSeasonProfileForMonth(month);
  }

  _getSeasonProfileForMonth(month) {
    const profiles = {
      0: { avgTemp: -3, diurnalRange: 4, avgHumidity: 85, avgWind: 5, precipChance: 0.4, maxUV: 1, daylightHours: 6.5 },
      1: { avgTemp: -3, diurnalRange: 5, avgHumidity: 80, avgWind: 5, precipChance: 0.35, maxUV: 2, daylightHours: 8.5 },
      2: { avgTemp: 1, diurnalRange: 6, avgHumidity: 70, avgWind: 5, precipChance: 0.3, maxUV: 3, daylightHours: 11 },
      3: { avgTemp: 7, diurnalRange: 7, avgHumidity: 60, avgWind: 5, precipChance: 0.25, maxUV: 5, daylightHours: 14 },
      4: { avgTemp: 12, diurnalRange: 8, avgHumidity: 55, avgWind: 4, precipChance: 0.3, maxUV: 6, daylightHours: 17 },
      5: { avgTemp: 17, diurnalRange: 7, avgHumidity: 55, avgWind: 4, precipChance: 0.35, maxUV: 7, daylightHours: 18.5 },
      6: { avgTemp: 20, diurnalRange: 7, avgHumidity: 60, avgWind: 3, precipChance: 0.3, maxUV: 7, daylightHours: 18 },
      7: { avgTemp: 18, diurnalRange: 7, avgHumidity: 65, avgWind: 4, precipChance: 0.35, maxUV: 5, daylightHours: 15.5 },
      8: { avgTemp: 13, diurnalRange: 6, avgHumidity: 70, avgWind: 5, precipChance: 0.4, maxUV: 4, daylightHours: 13 },
      9: { avgTemp: 8, diurnalRange: 5, avgHumidity: 80, avgWind: 5, precipChance: 0.45, maxUV: 2, daylightHours: 10.5 },
      10: { avgTemp: 3, diurnalRange: 4, avgHumidity: 85, avgWind: 5, precipChance: 0.45, maxUV: 1, daylightHours: 7.5 },
      11: { avgTemp: -1, diurnalRange: 3, avgHumidity: 87, avgWind: 5, precipChance: 0.4, maxUV: 0.5, daylightHours: 6 }
    };
    return profiles[month] || profiles[0];
  }

  calculateSunPosition(date) {
    const lat = 59.33;
    const lon = 18.07;
    const d = date instanceof Date ? date : new Date(date);

    const dayOfYear = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
    const declination = -23.45 * Math.cos((2 * Math.PI / 365) * (dayOfYear + 10));

    const hourAngle = (d.getHours() + d.getMinutes() / 60 - 12) * 15;

    const latRad = lat * Math.PI / 180;
    const decRad = declination * Math.PI / 180;
    const haRad = hourAngle * Math.PI / 180;

    const altitude = Math.asin(
      Math.sin(latRad) * Math.sin(decRad) +
      Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad)
    ) * 180 / Math.PI;

    const azimuth = Math.atan2(
      Math.sin(haRad),
      Math.cos(haRad) * Math.sin(latRad) - Math.tan(decRad) * Math.cos(latRad)
    ) * 180 / Math.PI + 180;

    return {
      altitude: Math.round(altitude * 100) / 100,
      azimuth: Math.round(azimuth * 100) / 100,
      declination: Math.round(declination * 100) / 100
    };
  }

  calculateDaylightHours(date) {
    const d = date || new Date();
    const lat = 59.33;
    const dayOfYear = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
    const declination = -23.45 * Math.cos((2 * Math.PI / 365) * (dayOfYear + 10));

    const latRad = lat * Math.PI / 180;
    const decRad = declination * Math.PI / 180;

    const cosHourAngle = -Math.tan(latRad) * Math.tan(decRad);

    if (cosHourAngle < -1) return 24;
    if (cosHourAngle > 1) return 0;

    const hourAngle = Math.acos(cosHourAngle) * 180 / Math.PI;
    const daylightHours = (2 * hourAngle) / 15;

    return Math.round(daylightHours * 100) / 100;
  }

  getSunrise(date) {
    const d = date || new Date();
    const daylightHours = this.calculateDaylightHours(d);
    const solarNoon = 12;
    const sunriseHour = solarNoon - daylightHours / 2;
    const hours = Math.floor(sunriseHour);
    const minutes = Math.round((sunriseHour - hours) * 60);
    return { hours: hours, minutes: minutes, formatted: String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0') };
  }

  getSunset(date) {
    const d = date || new Date();
    const daylightHours = this.calculateDaylightHours(d);
    const solarNoon = 12;
    const sunsetHour = solarNoon + daylightHours / 2;
    const hours = Math.floor(sunsetHour);
    const minutes = Math.round((sunsetHour - hours) * 60);
    return { hours: hours, minutes: minutes, formatted: String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0') };
  }

  getCivilTwilight(date) {
    const sunrise = this.getSunrise(date);
    const sunset = this.getSunset(date);
    const dawnMinutes = (sunrise.hours * 60 + sunrise.minutes) - 30;
    const duskMinutes = (sunset.hours * 60 + sunset.minutes) + 30;
    return {
      dawn: { hours: Math.floor(dawnMinutes / 60), minutes: dawnMinutes % 60 },
      dusk: { hours: Math.floor(duskMinutes / 60), minutes: duskMinutes % 60 }
    };
  }

  getNauticalTwilight(date) {
    const sunrise = this.getSunrise(date);
    const sunset = this.getSunset(date);
    const dawnMinutes = (sunrise.hours * 60 + sunrise.minutes) - 60;
    const duskMinutes = (sunset.hours * 60 + sunset.minutes) + 60;
    return {
      dawn: { hours: Math.floor(Math.max(0, dawnMinutes) / 60), minutes: Math.max(0, dawnMinutes) % 60 },
      dusk: { hours: Math.floor(Math.min(1440, duskMinutes) / 60), minutes: Math.min(1440, duskMinutes) % 60 }
    };
  }

  checkFrostRisk() {
    const temp = this.currentWeather.temperature;
    const humidity = this.currentWeather.humidity;
    const windSpeed = this.currentWeather.windSpeed;
    const dewPoint = this.currentWeather.dewPoint;

    let riskLevel = 'none';
    let riskScore = 0;
    const warnings = [];

    if (temp <= 2) {
      riskScore += 30;
      warnings.push('Temperature near freezing: ' + temp + '°C');
    }
    if (temp <= 0) {
      riskScore += 25;
      warnings.push('Temperature below freezing');
    }
    if (temp < -5) {
      riskScore += 20;
      warnings.push('PIPE FREEZE WARNING: Temperature ' + temp + '°C is below -5°C');
    }
    if (humidity > 80 && temp < 3) {
      riskScore += 15;
      warnings.push('High humidity with near-freezing temps increases ice risk');
    }
    if (windSpeed < 3 && temp < 2) {
      riskScore += 10;
      warnings.push('Low wind increases ground frost risk');
    }
    if (dewPoint < 0) {
      riskScore += 10;
      warnings.push('Dew point below freezing');
    }

    const upcomingFrost = this.forecast.slice(0, 12).filter(f => f.temperature < 0);
    if (upcomingFrost.length > 0) {
      riskScore += 15;
      warnings.push('Frost predicted in next 12 hours');
    }

    if (riskScore >= 60) riskLevel = 'severe';
    else if (riskScore >= 40) riskLevel = 'high';
    else if (riskScore >= 20) riskLevel = 'moderate';
    else if (riskScore > 0) riskLevel = 'low';

    return {
      riskLevel: riskLevel,
      riskScore: riskScore,
      currentTemp: temp,
      pipeFreezeRisk: temp < -5,
      groundFrostRisk: temp < 2 && windSpeed < 3,
      icingRisk: humidity > 80 && temp <= 0,
      warnings: warnings
    };
  }

  detectSevereWeather() {
    const w = this.currentWeather;
    const alerts = [];

    if (w.windSpeed > 20 || w.windGust > 30) {
      alerts.push({
        type: 'storm',
        severity: w.windGust > 40 ? 'extreme' : 'severe',
        message: 'High winds detected: ' + w.windSpeed + ' m/s, gusts ' + w.windGust + ' m/s',
        timestamp: Date.now()
      });
    }

    if (w.temperature > 35) {
      alerts.push({
        type: 'heatwave',
        severity: w.temperature > 40 ? 'extreme' : 'severe',
        message: 'Extreme heat: ' + w.temperature + '°C',
        timestamp: Date.now()
      });
    }

    if (w.temperature < -20) {
      alerts.push({
        type: 'extreme_cold',
        severity: w.temperature < -30 ? 'extreme' : 'severe',
        message: 'Extreme cold: ' + w.temperature + '°C',
        timestamp: Date.now()
      });
    }

    if (w.precipitation > 10) {
      alerts.push({
        type: 'heavy_rain',
        severity: w.precipitation > 20 ? 'extreme' : 'severe',
        message: 'Heavy rainfall: ' + w.precipitation + ' mm/h',
        timestamp: Date.now()
      });
    }

    if (w.snowfall > 5) {
      alerts.push({
        type: 'heavy_snow',
        severity: w.snowfall > 15 ? 'extreme' : 'severe',
        message: 'Heavy snowfall: ' + w.snowfall + ' cm/h',
        timestamp: Date.now()
      });
    }

    if (w.visibility < 200) {
      alerts.push({
        type: 'dense_fog',
        severity: 'severe',
        message: 'Very low visibility: ' + w.visibility + ' m',
        timestamp: Date.now()
      });
    }

    if (w.lightningRisk > 0.7) {
      alerts.push({
        type: 'thunderstorm',
        severity: 'severe',
        message: 'High thunderstorm risk: ' + (w.lightningRisk * 100).toFixed(0) + '%',
        timestamp: Date.now()
      });
    }

    if (alerts.length > 0) {
      this.severeWeatherAlerts = this.severeWeatherAlerts.concat(alerts);
      if (this.severeWeatherAlerts.length > 200) {
        this.severeWeatherAlerts = this.severeWeatherAlerts.slice(-100);
      }
      this.log('Severe weather detected: ' + alerts.length + ' alerts');
    }

    return alerts;
  }

  evaluateAutomationRules() {
    const triggered = [];
    const w = this.currentWeather;

    for (const [id, rule] of this.automationRules) {
      if (!rule.enabled) continue;
      try {
        if (rule.condition(w)) {
          rule.lastTriggered = Date.now();
          rule.triggerCount += 1;
          triggered.push({
            ruleId: id,
            name: rule.name,
            action: rule.action,
            priority: rule.priority
          });
        }
      } catch (err) {
        this.error('Rule evaluation error (' + id + '): ' + err.message);
      }
    }

    triggered.sort((a, b) => b.priority - a.priority);
    return triggered;
  }

  _calculateFeelsLike(temp, windSpeed, humidity) {
    let feelsLike = temp;

    if (temp <= 10 && windSpeed > 1.3) {
      feelsLike = 13.12 + 0.6215 * temp - 11.37 * Math.pow(windSpeed * 3.6, 0.16) + 0.3965 * temp * Math.pow(windSpeed * 3.6, 0.16);
    } else if (temp >= 27) {
      feelsLike = temp + 0.33 * (humidity / 100 * 6.105 * Math.exp(17.27 * temp / (237.7 + temp))) - 4.0;
    }

    return Math.round(feelsLike * 10) / 10;
  }

  calculateWindChill(temp, windSpeed) {
    if (temp > 10 || windSpeed < 1.3) {
      return temp;
    }
    const windKmh = windSpeed * 3.6;
    const windChill = 13.12 + 0.6215 * temp - 11.37 * Math.pow(windKmh, 0.16) + 0.3965 * temp * Math.pow(windKmh, 0.16);
    return Math.round(windChill * 10) / 10;
  }

  calculateHeatIndex(temp, humidity) {
    if (temp < 27 || humidity < 40) {
      return temp;
    }
    const c1 = -8.784;
    const c2 = 1.611;
    const c3 = 2.339;
    const c4 = -0.146;
    const c5 = -0.013;
    const c6 = -0.016;
    const c7 = 0.002;
    const c8 = 0.001;
    const c9 = -0.000003;

    const hi = c1 + c2 * temp + c3 * humidity + c4 * temp * humidity +
      c5 * temp * temp + c6 * humidity * humidity +
      c7 * temp * temp * humidity + c8 * temp * humidity * humidity +
      c9 * temp * temp * humidity * humidity;

    return Math.round(hi * 10) / 10;
  }

  _calculateDewPoint(temp, humidity) {
    const a = 17.27;
    const b = 237.7;
    const gamma = (a * temp) / (b + temp) + Math.log(humidity / 100);
    const dewPoint = (b * gamma) / (a - gamma);
    return Math.round(dewPoint * 10) / 10;
  }

  _getCardinalDirection(degrees) {
    const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return dirs[index];
  }

  _getWeatherCondition(temp, precip, snow, clouds, wind) {
    if (snow > 0) return 'snowing';
    if (precip > 5) return 'heavy_rain';
    if (precip > 0) return 'rainy';
    if (wind > 15) return 'windy';
    if (clouds > 80) return 'overcast';
    if (clouds > 50) return 'partly_cloudy';
    if (clouds > 20) return 'mostly_clear';
    return 'clear';
  }

  trackIndoorCorrelation(room, indoorTemp, indoorHumidity) {
    if (!this.indoorCorrelation[room]) {
      this.indoorCorrelation[room] = {
        readings: [],
        avgTempDiff: 0,
        avgHumidityDiff: 0,
        insulationScore: 0
      };
    }

    const entry = {
      timestamp: Date.now(),
      outdoorTemp: this.currentWeather.temperature,
      outdoorHumidity: this.currentWeather.humidity,
      indoorTemp: indoorTemp,
      indoorHumidity: indoorHumidity,
      tempDiff: indoorTemp - this.currentWeather.temperature,
      humidityDiff: indoorHumidity - this.currentWeather.humidity
    };

    this.indoorCorrelation[room].readings.push(entry);
    if (this.indoorCorrelation[room].readings.length > 500) {
      this.indoorCorrelation[room].readings = this.indoorCorrelation[room].readings.slice(-250);
    }

    const readings = this.indoorCorrelation[room].readings;
    this.indoorCorrelation[room].avgTempDiff = readings.reduce((s, r) => s + Math.abs(r.tempDiff), 0) / readings.length;
    this.indoorCorrelation[room].avgHumidityDiff = readings.reduce((s, r) => s + Math.abs(r.humidityDiff), 0) / readings.length;

    const tempStability = Math.max(0, 100 - this.indoorCorrelation[room].avgTempDiff * 5);
    this.indoorCorrelation[room].insulationScore = Math.round(tempStability);

    return entry;
  }

  _seedHistoricalData() {
    const now = Date.now();
    for (let day = 89; day >= 0; day--) {
      const dayDate = new Date(now - day * 86400000);
      const month = dayDate.getMonth();
      const profile = this._getSeasonProfileForMonth(month);

      this.historicalData.push({
        date: dayDate.toISOString().substring(0, 10),
        timestamp: dayDate.getTime(),
        avgTemp: Math.round((profile.avgTemp + (Math.random() - 0.5) * 8) * 10) / 10,
        maxTemp: Math.round((profile.avgTemp + profile.diurnalRange / 2 + Math.random() * 3) * 10) / 10,
        minTemp: Math.round((profile.avgTemp - profile.diurnalRange / 2 - Math.random() * 3) * 10) / 10,
        avgHumidity: Math.round(profile.avgHumidity + (Math.random() - 0.5) * 20),
        totalPrecipMm: Math.random() < profile.precipChance ? Math.round(Math.random() * 15 * 10) / 10 : 0,
        avgWindSpeed: Math.round((profile.avgWind + (Math.random() - 0.5) * 4) * 10) / 10,
        maxUV: Math.round((profile.maxUV * (0.7 + Math.random() * 0.3)) * 10) / 10,
        sunshineHours: Math.round((profile.daylightHours * (0.3 + Math.random() * 0.5)) * 10) / 10
      });
    }

    this.log('Historical data seeded: ' + this.historicalData.length + ' days');
  }

  getHistoricalAnalysis(days) {
    const period = Math.min(days || 7, this.historicalData.length);
    const data = this.historicalData.slice(-period);

    if (data.length === 0) {
      return null;
    }

    const avgTemp = data.reduce((s, d) => s + d.avgTemp, 0) / data.length;
    const maxTemp = Math.max(...data.map(d => d.maxTemp));
    const minTemp = Math.min(...data.map(d => d.minTemp));
    const totalPrecip = data.reduce((s, d) => s + d.totalPrecipMm, 0);
    const rainyDays = data.filter(d => d.totalPrecipMm > 0).length;
    const avgHumidity = data.reduce((s, d) => s + d.avgHumidity, 0) / data.length;
    const avgWindSpeed = data.reduce((s, d) => s + d.avgWindSpeed, 0) / data.length;

    const tempTrend = data.length > 1
      ? (data[data.length - 1].avgTemp - data[0].avgTemp) / data.length
      : 0;

    return {
      period: period,
      avgTemp: Math.round(avgTemp * 10) / 10,
      maxTemp: maxTemp,
      minTemp: minTemp,
      totalPrecipMm: Math.round(totalPrecip * 10) / 10,
      rainyDays: rainyDays,
      avgHumidity: Math.round(avgHumidity),
      avgWindSpeed: Math.round(avgWindSpeed * 10) / 10,
      tempTrend: Math.round(tempTrend * 100) / 100,
      tempTrendDirection: tempTrend > 0.1 ? 'warming' : tempTrend < -0.1 ? 'cooling' : 'stable'
    };
  }

  getEnergyRecommendations() {
    const w = this.currentWeather;
    const recommendations = [];
    const profile = this.getSeasonProfile();

    if (w.temperature < 0) {
      recommendations.push({
        type: 'heating',
        priority: 'high',
        message: 'Cold weather: Consider pre-heating during low-price hours',
        potentialSavings: 'up to 15%'
      });
    }

    if (w.temperature > 25 && w.uvIndex > 4) {
      recommendations.push({
        type: 'solar',
        priority: 'high',
        message: 'Good solar conditions: Maximize self-consumption and battery charging',
        expectedGeneration: (w.uvIndex / profile.maxUV * 100).toFixed(0) + '% of capacity'
      });
    }

    if (w.cloudCover > 80) {
      recommendations.push({
        type: 'solar',
        priority: 'medium',
        message: 'Overcast: Reduced solar generation expected, consider grid charging during low prices',
        expectedGeneration: 'reduced by ' + (w.cloudCover * 0.7).toFixed(0) + '%'
      });
    }

    if (w.temperature > 28) {
      recommendations.push({
        type: 'cooling',
        priority: 'high',
        message: 'High temperature: Use natural ventilation in evening, pre-cool in low-price hours',
        potentialSavings: 'up to 20%'
      });
    }

    if (w.windSpeed > 8) {
      recommendations.push({
        type: 'ventilation',
        priority: 'medium',
        message: 'Windy conditions: Increase infiltration may require additional heating',
        estimatedImpact: '+' + (w.windSpeed * 0.5).toFixed(1) + '% heating load'
      });
    }

    return recommendations;
  }

  _startMonitoring() {
    this.updateInterval = setInterval(() => {
      this._updateCycle();
    }, 600000);

    this.alertCheckInterval = setInterval(() => {
      this.detectSevereWeather();
      this.checkFrostRisk();
    }, 300000);

    this.log('Monitoring started: 10-min weather updates, 5-min alert checks');
  }

  _updateCycle() {
    try {
      this.currentWeather = this._generateCurrentWeather();
      this._updatePollenLevels();
      this._updateAQI();

      if (Math.random() < 0.1) {
        this.forecast = this._generate72HourForecast();
      }

      const triggered = this.evaluateAutomationRules();
      if (triggered.length > 0) {
        this.log('Automation rules triggered: ' + triggered.map(t => t.name).join(', '));
      }

      const now = new Date();
      if (now.getHours() === 0 && now.getMinutes() < 11) {
        this.historicalData.push({
          date: new Date(Date.now() - 86400000).toISOString().substring(0, 10),
          timestamp: Date.now() - 86400000,
          avgTemp: this.currentWeather.temperature,
          maxTemp: this.currentWeather.temperature + 3,
          minTemp: this.currentWeather.temperature - 3,
          avgHumidity: this.currentWeather.humidity,
          totalPrecipMm: this.currentWeather.precipitation * 24,
          avgWindSpeed: this.currentWeather.windSpeed,
          maxUV: this.currentWeather.uvIndex,
          sunshineHours: this.calculateDaylightHours() * 0.5
        });
        if (this.historicalData.length > 365) {
          this.historicalData = this.historicalData.slice(-365);
        }
      }
    } catch (err) {
      this.error('Weather update cycle error: ' + err.message);
    }
  }

  _updateAQI() {
    const variation = (Math.random() - 0.5) * 10;
    this.aqiData.overall = Math.round(Math.max(0, Math.min(300, this.aqiData.overall + variation)));
    this.aqiData.pm25 = Math.round(Math.max(0, 12 + (Math.random() - 0.5) * 10));
    this.aqiData.pm10 = Math.round(Math.max(0, 22 + (Math.random() - 0.5) * 15));
    this.aqiData.o3 = Math.round(Math.max(0, 35 + (Math.random() - 0.5) * 20));
    this.aqiData.no2 = Math.round(Math.max(0, 18 + (Math.random() - 0.5) * 12));
    this.aqiData.lastUpdated = Date.now();

    if (this.aqiData.overall <= 50) this.aqiData.category = 'Good';
    else if (this.aqiData.overall <= 100) this.aqiData.category = 'Moderate';
    else if (this.aqiData.overall <= 150) this.aqiData.category = 'Unhealthy for Sensitive Groups';
    else if (this.aqiData.overall <= 200) this.aqiData.category = 'Unhealthy';
    else this.aqiData.category = 'Very Unhealthy';
  }

  getStatistics() {
    const analysis7d = this.getHistoricalAnalysis(7);
    const analysis30d = this.getHistoricalAnalysis(30);
    const analysis90d = this.getHistoricalAnalysis(90);
    const frostRisk = this.checkFrostRisk();
    const sunrise = this.getSunrise();
    const sunset = this.getSunset();
    const daylightHours = this.calculateDaylightHours();

    let totalRuleTriggers = 0;
    const rulesSummary = {};
    for (const [id, rule] of this.automationRules) {
      totalRuleTriggers += rule.triggerCount;
      rulesSummary[id] = {
        name: rule.name,
        enabled: rule.enabled,
        triggerCount: rule.triggerCount,
        lastTriggered: rule.lastTriggered
      };
    }

    return {
      currentWeather: this.currentWeather,
      forecast: {
        next6h: this.forecast.slice(0, 6),
        next24h: this.forecast.slice(0, 24).length,
        total: this.forecast.length
      },
      sunrise: sunrise.formatted,
      sunset: sunset.formatted,
      daylightHours: daylightHours,
      season: this._getSeason(new Date().getMonth()),
      frostRisk: frostRisk,
      pollenCounts: this.pollenCounts,
      aqi: this.aqiData,
      automationRules: rulesSummary,
      totalRuleTriggers: totalRuleTriggers,
      severeAlerts: this.severeWeatherAlerts.length,
      historicalAnalysis: {
        '7d': analysis7d,
        '30d': analysis30d,
        '90d': analysis90d
      },
      locations: Array.from(this.locations.values()).map(l => ({ id: l.id, name: l.name })),
      indoorCorrelation: Object.keys(this.indoorCorrelation).length,
      energyRecommendations: this.getEnergyRecommendations(),
      uptime: this.initialized ? 'active' : 'inactive'
    };
  }

  log(msg) {
    this.homey.log('[Weather]', msg);
  }

  error(msg) {
    this.homey.error('[Weather]', msg);
  }

  destroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    if (this.alertCheckInterval) {
      clearInterval(this.alertCheckInterval);
      this.alertCheckInterval = null;
    }
    this.log('Advanced Weather Integration destroyed');
  }
}

module.exports = AdvancedWeatherIntegration;
