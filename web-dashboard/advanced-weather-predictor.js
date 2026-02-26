'use strict';

/**
 * Advanced Weather Predictor
 * Hyperlocal weather forecasting and home automation
 */
class AdvancedWeatherPredictor {
  constructor(app) {
    this.app = app;
    this.location = { lat: 59.3293, lon: 18.0686 };  // Stockholm
    this.currentWeather = null;
    this.forecast = [];
    this.weatherHistory = [];
    this.weatherAlerts = [];
    this.automationRules = new Map();
  }

  async initialize() {
    await this.updateCurrentWeather();
    await this.updateForecast();
    await this.setupAutomationRules();
    
    this.startMonitoring();
  }

  // ============================================
  // CURRENT WEATHER
  // ============================================

  async updateCurrentWeather() {
    // Simulated weather data (would use real API like SMHI)
    this.currentWeather = {
      temperature: 18,
      feelsLike: 16,
      humidity: 65,
      pressure: 1013,
      windSpeed: 5.2,
      windDirection: 'SW',
      precipitation: 0,
      cloudCover: 40,
      visibility: 10,
      uvIndex: 4,
      condition: 'partly_cloudy',
      description: 'Delvis molnigt',
      timestamp: Date.now()
    };

    console.log(`🌤️ Weather updated: ${this.currentWeather.temperature}°C, ${this.currentWeather.description}`);

    // Store in history
    this.weatherHistory.push({
      ...this.currentWeather,
      timestamp: Date.now()
    });

    // Trigger automation based on weather
    await this.checkWeatherAutomation();

    return this.currentWeather;
  }

  // ============================================
  // FORECAST
  // ============================================

  async updateForecast() {
    // Simulated 7-day forecast
    const conditions = ['sunny', 'partly_cloudy', 'cloudy', 'rainy', 'stormy', 'snowy'];
    const descriptions = ['Soligt', 'Delvis molnigt', 'Molnigt', 'Regn', 'Storm', 'Snö'];

    this.forecast = [];

    for (let day = 0; day < 7; day++) {
      const date = new Date();
      date.setDate(date.getDate() + day);

      const conditionIndex = Math.floor(Math.random() * conditions.length);

      const forecast = {
        date: date.getTime(),
        dayOfWeek: date.toLocaleDateString('sv-SE', { weekday: 'long' }),
        high: 15 + Math.floor(Math.random() * 10),
        low: 10 + Math.floor(Math.random() * 5),
        condition: conditions[conditionIndex],
        description: descriptions[conditionIndex],
        precipitation: Math.random() * 10,
        precipitationChance: Math.floor(Math.random() * 100),
        windSpeed: 3 + Math.random() * 8,
        humidity: 50 + Math.floor(Math.random() * 30),
        sunrise: this.calculateSunrise(date),
        sunset: this.calculateSunset(date)
      };

      this.forecast.push(forecast);
    }

    console.log(`📅 Forecast updated for ${this.forecast.length} days`);

    return this.forecast;
  }

  calculateSunrise(date) {
    // Simplified calculation (would use actual astronomical calculations)
    const base = new Date(date);
    base.setHours(6, 30, 0, 0);
    return base.getTime();
  }

  calculateSunset(date) {
    // Simplified calculation
    const base = new Date(date);
    base.setHours(20, 15, 0, 0);
    return base.getTime();
  }

  // ============================================
  // WEATHER ALERTS
  // ============================================

  async checkWeatherAlerts() {
    const alerts = [];

    const current = this.currentWeather;
    const tomorrow = this.forecast[1];

    // High wind alert
    if (current.windSpeed > 15) {
      alerts.push({
        id: 'alert_wind_' + Date.now(),
        type: 'wind',
        severity: 'warning',
        title: 'Kraftig vind',
        message: `Vindstyrka: ${current.windSpeed.toFixed(1)} m/s`,
        actions: ['Säkra lösa föremål utomhus', 'Kontrollera fönster']
      });
    }

    // Rain alert
    if (tomorrow.precipitationChance > 70) {
      alerts.push({
        id: 'alert_rain_' + Date.now(),
        type: 'rain',
        severity: 'info',
        title: 'Regn imorgon',
        message: `${tomorrow.precipitationChance}% sannolikhet för regn`,
        actions: ['Ta med paraply', 'Stäng markiser']
      });
    }

    // Temperature drop alert
    if (tomorrow.low < current.temperature - 5) {
      alerts.push({
        id: 'alert_temp_' + Date.now(),
        type: 'temperature',
        severity: 'info',
        title: 'Temperaturfall',
        message: `Temperaturen sjunker till ${tomorrow.low}°C`,
        actions: ['Justera värme', 'Ta på varmare kläder']
      });
    }

    // Storm alert
    if (tomorrow.condition === 'stormy') {
      alerts.push({
        id: 'alert_storm_' + Date.now(),
        type: 'storm',
        severity: 'alert',
        title: '⚠️ Stormvarning',
        message: 'Storm förväntas imorgon',
        actions: ['Säkra utomhusmöbler', 'Lås fönster och dörrar', 'Ha ficklampa tillgänglig']
      });
    }

    this.weatherAlerts = alerts;

    if (alerts.length > 0) {
      console.log(`⚠️ ${alerts.length} weather alerts`);
      for (const alert of alerts) {
        console.log(`  ${alert.severity.toUpperCase()}: ${alert.title}`);
      }
    }

    return alerts;
  }

  // ============================================
  // AUTOMATION RULES
  // ============================================

  async setupAutomationRules() {
    const rules = [
      {
        id: 'rain_windows',
        name: 'Stäng fönster vid regn',
        condition: 'rain',
        threshold: 1,  // mm/h
        actions: [
          { type: 'notify', message: 'Regn detekterat - kontrollera fönster' },
          { type: 'close_windows', rooms: ['all'] }
        ],
        enabled: true
      },
      {
        id: 'hot_sun_blinds',
        name: 'Sänk markiser vid starkt sol',
        condition: 'temperature_high',
        threshold: 25,
        actions: [
          { type: 'lower_blinds', rooms: ['living_room', 'bedroom'] },
          { type: 'adjust_ac', target: 22 }
        ],
        enabled: true
      },
      {
        id: 'cold_heating',
        name: 'Höj värme vid kallt väder',
        condition: 'temperature_low',
        threshold: 5,
        actions: [
          { type: 'increase_heating', delta: 2 },
          { type: 'notify', message: 'Kallt väder - värmen har höjts' }
        ],
        enabled: true
      },
      {
        id: 'storm_prep',
        name: 'Förbered för storm',
        condition: 'storm',
        threshold: null,
        actions: [
          { type: 'notify', message: '⚠️ Storm förväntas - förbered hemmet' },
          { type: 'close_windows', rooms: ['all'] },
          { type: 'lower_blinds', rooms: ['all'] },
          { type: 'check_batteries', devices: ['flashlights'] }
        ],
        enabled: true
      },
      {
        id: 'sunrise_lights',
        name: 'Släck vid soluppgång',
        condition: 'sunrise',
        threshold: null,
        actions: [
          { type: 'turn_off_lights', rooms: ['outdoor'] }
        ],
        enabled: true
      },
      {
        id: 'sunset_lights',
        name: 'Tänd vid solnedgång',
        condition: 'sunset',
        threshold: null,
        actions: [
          { type: 'turn_on_lights', rooms: ['outdoor'], brightness: 80 }
        ],
        enabled: true
      }
    ];

    for (const rule of rules) {
      this.automationRules.set(rule.id, rule);
    }
  }

  async checkWeatherAutomation() {
    const current = this.currentWeather;
    const tomorrow = this.forecast[1];

    for (const [_ruleId, rule] of this.automationRules) {
      if (!rule.enabled) continue;

      let shouldTrigger = false;

      switch (rule.condition) {
        case 'rain':
          shouldTrigger = current.precipitation >= rule.threshold;
          break;

        case 'temperature_high':
          shouldTrigger = current.temperature >= rule.threshold;
          break;

        case 'temperature_low':
          shouldTrigger = current.temperature <= rule.threshold;
          break;

        case 'storm':
          shouldTrigger = tomorrow?.condition === 'stormy';
          break;

        case 'sunrise':
          const now = Date.now();
          const sunrise = tomorrow?.sunrise || 0;
          shouldTrigger = Math.abs(now - sunrise) < 5 * 60 * 1000;  // Within 5 minutes
          break;

        case 'sunset':
          const sunset = tomorrow?.sunset || 0;
          shouldTrigger = Math.abs(Date.now() - sunset) < 5 * 60 * 1000;
          break;
      }

      if (shouldTrigger) {
        await this.executeAutomationActions(rule);
      }
    }
  }

  async executeAutomationActions(rule) {
    console.log(`🤖 Executing weather automation: ${rule.name}`);

    for (const action of rule.actions) {
      switch (action.type) {
        case 'notify':
          console.log(`  📢 ${action.message}`);
          break;

        case 'close_windows':
          console.log(`  🪟 Closing windows in: ${action.rooms.join(', ')}`);
          break;

        case 'lower_blinds':
          console.log(`  🪟 Lowering blinds in: ${action.rooms.join(', ')}`);
          break;

        case 'adjust_ac':
          console.log(`  ❄️ Adjusting AC to ${action.target}°C`);
          break;

        case 'increase_heating':
          console.log(`  🔥 Increasing heating by ${action.delta}°C`);
          break;

        case 'turn_off_lights':
          console.log(`  💡 Turning off lights in: ${action.rooms.join(', ')}`);
          break;

        case 'turn_on_lights':
          console.log(`  💡 Turning on lights in: ${action.rooms.join(', ')} @ ${action.brightness}%`);
          break;

        case 'check_batteries':
          console.log(`  🔋 Checking batteries in: ${action.devices.join(', ')}`);
          break;
      }
    }
  }

  // ============================================
  // ENERGY IMPACT
  // ============================================

  async predictEnergyImpact(days = 3) {
    const predictions = [];

    for (let i = 0; i < days; i++) {
      const forecast = this.forecast[i];
      
      if (!forecast) continue;

      let heatingNeed = 0;
      let coolingNeed = 0;
      let solarPotential = 0;

      // Heating need based on temperature
      if (forecast.low < 15) {
        heatingNeed = (15 - forecast.low) * 2;  // kWh estimate
      }

      // Cooling need based on temperature
      if (forecast.high > 25) {
        coolingNeed = (forecast.high - 25) * 1.5;  // kWh estimate
      }

      // Solar potential based on cloud cover
      if (forecast.condition === 'sunny') {
        solarPotential = 15;
      } else if (forecast.condition === 'partly_cloudy') {
        solarPotential = 10;
      } else {
        solarPotential = 5;
      }

      predictions.push({
        date: forecast.dayOfWeek,
        heatingNeed: heatingNeed.toFixed(1) + ' kWh',
        coolingNeed: coolingNeed.toFixed(1) + ' kWh',
        solarPotential: solarPotential.toFixed(1) + ' kWh',
        netImpact: (heatingNeed + coolingNeed - solarPotential).toFixed(1) + ' kWh'
      });
    }

    return predictions;
  }

  // ============================================
  // COMFORT RECOMMENDATIONS
  // ============================================

  async getComfortRecommendations() {
    const current = this.currentWeather;
    const tomorrow = this.forecast[1];
    const recommendations = [];

    // Temperature recommendations
    if (current.temperature < 10) {
      recommendations.push({
        type: 'heating',
        priority: 'high',
        title: 'Kallt ute',
        message: 'Överväg att höja inomhustemperaturen',
        action: 'increase_heating'
      });
    } else if (current.temperature > 25) {
      recommendations.push({
        type: 'cooling',
        priority: 'high',
        title: 'Varmt ute',
        message: 'Sänk markiser och använd AC',
        action: 'activate_cooling'
      });
    }

    // Humidity recommendations
    if (current.humidity > 70) {
      recommendations.push({
        type: 'dehumidify',
        priority: 'medium',
        title: 'Hög luftfuktighet',
        message: 'Aktivera avfuktare för bättre komfort',
        action: 'start_dehumidifier'
      });
    } else if (current.humidity < 30) {
      recommendations.push({
        type: 'humidify',
        priority: 'medium',
        title: 'Låg luftfuktighet',
        message: 'Aktivera luftfuktare',
        action: 'start_humidifier'
      });
    }

    // Air quality recommendations
    if (current.condition === 'sunny' && current.temperature > 15 && current.temperature < 22) {
      recommendations.push({
        type: 'ventilation',
        priority: 'low',
        title: 'Perfekt väder',
        message: 'Öppna fönster för frisk luft',
        action: 'open_windows'
      });
    }

    // Tomorrow preparations
    if (tomorrow) {
      if (tomorrow.precipitationChance > 50) {
        recommendations.push({
          type: 'preparation',
          priority: 'medium',
          title: 'Regn imorgon',
          message: 'Stäng markiser och fönster',
          action: 'prepare_for_rain'
        });
      }

      if (tomorrow.high > current.temperature + 5) {
        recommendations.push({
          type: 'preparation',
          priority: 'low',
          title: 'Varmare imorgon',
          message: 'Förbered sommarkläder',
          action: 'none'
        });
      }
    }

    return recommendations;
  }

  // ============================================
  // HISTORICAL ANALYSIS
  // ============================================

  async analyzeWeatherPatterns(days = 30) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const history = this.weatherHistory.filter(h => h.timestamp >= cutoff);

    if (history.length === 0) {
      return { success: false, error: 'No data' };
    }

    const analysis = {
      avgTemperature: 0,
      maxTemperature: -Infinity,
      minTemperature: Infinity,
      avgHumidity: 0,
      totalPrecipitation: 0,
      rainyDays: 0,
      sunnyDays: 0
    };

    for (const entry of history) {
      analysis.avgTemperature += entry.temperature;
      analysis.avgHumidity += entry.humidity;
      analysis.totalPrecipitation += entry.precipitation;

      if (entry.temperature > analysis.maxTemperature) {
        analysis.maxTemperature = entry.temperature;
      }
      if (entry.temperature < analysis.minTemperature) {
        analysis.minTemperature = entry.temperature;
      }

      if (entry.precipitation > 0) {
        analysis.rainyDays++;
      }
      if (entry.condition === 'sunny') {
        analysis.sunnyDays++;
      }
    }

    analysis.avgTemperature = (analysis.avgTemperature / history.length).toFixed(1);
    analysis.avgHumidity = (analysis.avgHumidity / history.length).toFixed(0);
    analysis.totalPrecipitation = analysis.totalPrecipitation.toFixed(1);

    return analysis;
  }

  // ============================================
  // MONITORING
  // ============================================

  startMonitoring() {
    // Update weather every 30 minutes
    setInterval(() => {
      this.updateCurrentWeather();
    }, 30 * 60 * 1000);

    // Update forecast every 6 hours
    setInterval(() => {
      this.updateForecast();
    }, 6 * 60 * 60 * 1000);

    // Check alerts every hour
    setInterval(() => {
      this.checkWeatherAlerts();
    }, 60 * 60 * 1000);

    console.log('🌦️ Weather Predictor active');
  }

  // ============================================
  // REPORTING
  // ============================================

  getWeatherOverview() {
    const current = this.currentWeather;

    return {
      temperature: current.temperature + '°C',
      condition: current.description,
      humidity: current.humidity + '%',
      wind: current.windSpeed.toFixed(1) + ' m/s ' + current.windDirection,
      forecast: this.forecast.length + ' days',
      alerts: this.weatherAlerts.length
    };
  }

  getCurrentWeather() {
    const current = this.currentWeather;

    return {
      temperature: current.temperature + '°C',
      feelsLike: current.feelsLike + '°C',
      condition: current.description,
      humidity: current.humidity + '%',
      pressure: current.pressure + ' hPa',
      wind: current.windSpeed.toFixed(1) + ' m/s ' + current.windDirection,
      precipitation: current.precipitation + ' mm/h',
      cloudCover: current.cloudCover + '%',
      uvIndex: current.uvIndex
    };
  }

  getWeekForecast() {
    return this.forecast.map(f => ({
      day: f.dayOfWeek,
      high: f.high + '°C',
      low: f.low + '°C',
      condition: f.description,
      rain: f.precipitationChance + '%',
      wind: f.windSpeed.toFixed(1) + ' m/s'
    }));
  }

  getWeatherAlerts() {
    return this.weatherAlerts.map(a => ({
      severity: a.severity.toUpperCase(),
      title: a.title,
      message: a.message,
      actions: a.actions.join(', ')
    }));
  }

  getAutomationRules() {
    return Array.from(this.automationRules.values()).map(r => ({
      name: r.name,
      condition: r.condition,
      enabled: r.enabled ? '✅' : '❌',
      actions: r.actions.length + ' actions'
    }));
  }
}

module.exports = AdvancedWeatherPredictor;
