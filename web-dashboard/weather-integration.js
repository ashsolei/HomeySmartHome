'use strict';
const logger = require('./logger');

/**
 * Weather Integration Service
 * Integrates weather data for enhanced predictions and automations
 */
class WeatherIntegration {
  constructor() {
    this._intervals = [];
    this.apiKey = process.env.OPENWEATHER_API_KEY || '';
    this.location = {
      lat: 59.3293,  // Stockholm default
      lon: 18.0686
    };
    this.cache = {
      current: null,
      forecast: null,
      lastUpdate: 0
    };
    this.cacheDuration = 10 * 60 * 1000; // 10 minutes
  }

  async initialize(lat, lon) {
    if (lat && lon) {
      this.location = { lat, lon };
    }
    
    await this.updateWeatherData();
    
    // Auto-refresh every 10 minutes
    this._intervals.push(setInterval(() => {
      this.updateWeatherData();
    }, this.cacheDuration));
  }

  // ============================================
  // WEATHER DATA FETCHING
  // ============================================

  async updateWeatherData() {
    try {
      const [current, forecast] = await Promise.all([
        this.fetchCurrentWeather(),
        this.fetchForecast()
      ]);

      this.cache.current = current;
      this.cache.forecast = forecast;
      this.cache.lastUpdate = Date.now();

      return { current, forecast };
    } catch (error) {
      logger.error('Weather update error:', error);
      return this.getDefaultWeather();
    }
  }

  async fetchCurrentWeather() {
    if (!this.apiKey) {
      return this.getDefaultCurrentWeather();
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${this.location.lat}&lon=${this.location.lon}&appid=${this.apiKey}&units=metric&lang=sv`;
    
    const response = await fetch(url);
    const data = await response.json();

    return this.parseCurrentWeather(data);
  }

  async fetchForecast() {
    if (!this.apiKey) {
      return this.getDefaultForecast();
    }

    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${this.location.lat}&lon=${this.location.lon}&appid=${this.apiKey}&units=metric&lang=sv`;
    
    const response = await fetch(url);
    const data = await response.json();

    return this.parseForecast(data);
  }

  parseCurrentWeather(data) {
    return {
      temperature: data.main?.temp || 0,
      feelsLike: data.main?.feels_like || 0,
      humidity: data.main?.humidity || 0,
      pressure: data.main?.pressure || 0,
      windSpeed: data.wind?.speed || 0,
      windDirection: data.wind?.deg || 0,
      cloudiness: data.clouds?.all || 0,
      visibility: data.visibility || 0,
      condition: data.weather?.[0]?.main || 'Clear',
      description: data.weather?.[0]?.description || 'clear sky',
      icon: data.weather?.[0]?.icon || '01d',
      sunrise: data.sys?.sunrise ? new Date(data.sys.sunrise * 1000) : null,
      sunset: data.sys?.sunset ? new Date(data.sys.sunset * 1000) : null,
      timestamp: new Date()
    };
  }

  parseForecast(data) {
    const forecasts = (data.list || []).map(item => ({
      timestamp: new Date(item.dt * 1000),
      temperature: item.main?.temp || 0,
      feelsLike: item.main?.feels_like || 0,
      humidity: item.main?.humidity || 0,
      pressure: item.main?.pressure || 0,
      windSpeed: item.wind?.speed || 0,
      cloudiness: item.clouds?.all || 0,
      condition: item.weather?.[0]?.main || 'Clear',
      description: item.weather?.[0]?.description || 'clear sky',
      icon: item.weather?.[0]?.icon || '01d',
      rain: item.rain?.['3h'] || 0,
      snow: item.snow?.['3h'] || 0
    }));

    return {
      hourly: forecasts.slice(0, 24),
      daily: this.aggregateDailyForecast(forecasts),
      raw: forecasts
    };
  }

  aggregateDailyForecast(hourlyData) {
    const days = {};
    
    hourlyData.forEach(hour => {
      const date = hour.timestamp.toDateString();
      
      if (!days[date]) {
        days[date] = {
          date: hour.timestamp,
          temps: [],
          conditions: [],
          humidity: [],
          windSpeed: [],
          rain: 0,
          snow: 0
        };
      }
      
      days[date].temps.push(hour.temperature);
      days[date].conditions.push(hour.condition);
      days[date].humidity.push(hour.humidity);
      days[date].windSpeed.push(hour.windSpeed);
      days[date].rain += hour.rain;
      days[date].snow += hour.snow;
    });

    return Object.values(days).map(day => ({
      date: day.date,
      tempMin: Math.min(...day.temps),
      tempMax: Math.max(...day.temps),
      tempAvg: day.temps.reduce((a, b) => a + b, 0) / day.temps.length,
      condition: this.getMostCommonCondition(day.conditions),
      humidity: day.humidity.reduce((a, b) => a + b, 0) / day.humidity.length,
      windSpeed: day.windSpeed.reduce((a, b) => a + b, 0) / day.windSpeed.length,
      rain: day.rain,
      snow: day.snow
    })).slice(0, 7);
  }

  // ============================================
  // WEATHER-BASED PREDICTIONS
  // ============================================

  async getHeatingRecommendation() {
    const weather = await this.getCurrentWeather();
    
    const recommendation = {
      action: 'maintain',
      reason: '',
      targetTemp: 21,
      priority: 'normal'
    };

    // Cold weather
    if (weather.temperature < 0) {
      recommendation.action = 'increase';
      recommendation.reason = 'Mycket kallt ute, höj inomhustemperaturen';
      recommendation.targetTemp = 22;
      recommendation.priority = 'high';
    } else if (weather.temperature < 10) {
      recommendation.action = 'increase';
      recommendation.reason = 'Kallt ute, se till att hemmet är varmt';
      recommendation.targetTemp = 21.5;
      recommendation.priority = 'medium';
    }

    // Warm weather
    if (weather.temperature > 25) {
      recommendation.action = 'decrease';
      recommendation.reason = 'Varmt ute, sänk värme för att spara energi';
      recommendation.targetTemp = 20;
      recommendation.priority = 'medium';
    }

    // Upcoming cold front
    const forecast = await this.getForecast();
    const nextHours = forecast.hourly.slice(0, 6);
    const tempDrop = weather.temperature - Math.min(...nextHours.map(h => h.temperature));
    
    if (tempDrop > 5) {
      recommendation.action = 'preheat';
      recommendation.reason = 'Temperaturen kommer att sjunka kraftigt';
      recommendation.targetTemp = 22;
      recommendation.priority = 'high';
    }

    return recommendation;
  }

  async getLightingRecommendation() {
    const weather = await this.getCurrentWeather();
    const now = new Date();
    const hour = now.getHours();

    const recommendation = {
      action: 'auto',
      brightness: 0.7,
      reason: '',
      priority: 'normal'
    };

    // Dark/cloudy conditions
    if (weather.cloudiness > 80 && hour >= 8 && hour <= 20) {
      recommendation.action = 'increase';
      recommendation.brightness = 0.9;
      recommendation.reason = 'Mycket molnigt, öka belysning';
      recommendation.priority = 'medium';
    }

    // Sunny conditions
    if (weather.cloudiness < 20 && hour >= 9 && hour <= 18) {
      recommendation.action = 'decrease';
      recommendation.brightness = 0.3;
      recommendation.reason = 'Soligt ute, minska konstgjord belysning';
      recommendation.priority = 'low';
    }

    return recommendation;
  }

  async getEnergyOptimization() {
    const weather = await this.getCurrentWeather();
    const forecast = await this.getForecast();

    const optimization = {
      recommendations: [],
      potentialSavings: 0
    };

    // Heating optimization
    if (weather.temperature > 15) {
      optimization.recommendations.push({
        type: 'heating',
        action: 'Sänk värme',
        description: 'Temperaturen är mild, du kan spara energi',
        savings: 45 // SEK/day
      });
      optimization.potentialSavings += 45;
    }

    // Window optimization
    const nextRain = forecast.hourly.find(h => h.rain > 0);
    if (nextRain && !nextRain.timestamp) {
      const hoursUntilRain = Math.floor((nextRain.timestamp - Date.now()) / (1000 * 60 * 60));
      if (hoursUntilRain < 2) {
        optimization.recommendations.push({
          type: 'windows',
          action: 'Stäng fönster',
          description: `Regn förväntas om ${hoursUntilRain} timmar`,
          savings: 0,
          priority: 'high'
        });
      }
    }

    // Solar optimization
    if (weather.condition === 'Clear' && weather.cloudiness < 30) {
      optimization.recommendations.push({
        type: 'solar',
        action: 'Utnyttja solljus',
        description: 'Öppna gardiner och minska konstgjord belysning',
        savings: 15
      });
      optimization.potentialSavings += 15;
    }

    return optimization;
  }

  async getComfortOptimization() {
    const weather = await this.getCurrentWeather();
    
    const comfort = {
      score: 100,
      factors: [],
      recommendations: []
    };

    // Humidity considerations
    if (weather.humidity > 70) {
      comfort.score -= 15;
      comfort.factors.push('Hög luftfuktighet ute');
      comfort.recommendations.push({
        action: 'Använd avfuktare',
        priority: 'medium'
      });
    } else if (weather.humidity < 30) {
      comfort.score -= 10;
      comfort.factors.push('Låg luftfuktighet ute');
      comfort.recommendations.push({
        action: 'Använd luftfuktare',
        priority: 'low'
      });
    }

    // Wind considerations
    if (weather.windSpeed > 10) {
      comfort.score -= 10;
      comfort.factors.push('Blåsigt ute');
      comfort.recommendations.push({
        action: 'Stäng fönster och täta',
        priority: 'medium'
      });
    }

    // Temperature comfort
    const tempDiff = Math.abs(weather.temperature - weather.feelsLike);
    if (tempDiff > 5) {
      comfort.score -= 5;
      comfort.factors.push('Stor skillnad mellan faktisk och upplevd temperatur');
    }

    return comfort;
  }

  // ============================================
  // WEATHER ALERTS & AUTOMATIONS
  // ============================================

  async generateWeatherAlerts() {
    const weather = await this.getCurrentWeather();
    const forecast = await this.getForecast();
    const alerts = [];

    // Freeze warning
    if (weather.temperature < 0 || forecast.hourly.some(h => h.temperature < 0)) {
      alerts.push({
        type: 'freeze',
        severity: 'warning',
        title: 'Frysvärning',
        message: 'Temperatur under noll, se till att rör inte fryser',
        action: 'increase_heating',
        priority: 'high'
      });
    }

    // Heavy rain warning
    const totalRain = forecast.hourly.slice(0, 6).reduce((sum, h) => sum + h.rain, 0);
    if (totalRain > 10) {
      alerts.push({
        type: 'rain',
        severity: 'warning',
        title: 'Kraftigt regn förväntas',
        message: 'Stäng fönster och kontrollera dränering',
        action: 'close_windows',
        priority: 'medium'
      });
    }

    // Storm warning
    if (weather.windSpeed > 15) {
      alerts.push({
        type: 'wind',
        severity: 'alert',
        title: 'Storm varning',
        message: 'Stark vind, säkra lösa föremål',
        action: 'secure_outdoor_items',
        priority: 'high'
      });
    }

    // Heat wave
    if (weather.temperature > 30) {
      alerts.push({
        type: 'heat',
        severity: 'info',
        title: 'Mycket varmt',
        message: 'Stäng gardiner och aktivera fläktar',
        action: 'cooling_mode',
        priority: 'medium'
      });
    }

    return alerts;
  }

  async getAutomationSuggestions() {
    const weather = await this.getCurrentWeather();
    const forecast = await this.getForecast();
    const suggestions = [];

    // Morning routine adjustment
    if (weather.sunrise) {
      const sunriseHour = weather.sunrise.getHours();
      suggestions.push({
        type: 'morning',
        title: 'Anpassa morgonrutin till soluppgång',
        description: `Soluppgång kl ${sunriseHour}:${weather.sunrise.getMinutes().toString().padStart(2, '0')}`,
        automation: {
          trigger: { type: 'sun', event: 'sunrise', offset: -30 },
          actions: ['gradual_lights']
        }
      });
    }

    // Rain-based automation
    const willRain = forecast.hourly.slice(0, 12).some(h => h.rain > 0);
    if (willRain) {
      suggestions.push({
        type: 'rain',
        title: 'Regn-automation',
        description: 'Stäng fönster automatiskt vid regn',
        automation: {
          trigger: { type: 'weather', condition: 'rain' },
          actions: ['close_windows', 'notify']
        }
      });
    }

    // Temperature-based heating
    const coldNight = forecast.hourly.filter(h => {
      const hour = h.timestamp.getHours();
      return hour >= 22 || hour <= 6;
    }).some(h => h.temperature < 5);

    if (coldNight) {
      suggestions.push({
        type: 'heating',
        title: 'Nattvärme-automation',
        description: 'Höj värme under kalla nätter',
        automation: {
          trigger: { type: 'time', time: '22:00' },
          conditions: [{ type: 'weather', temperature: '<', value: 5 }],
          actions: ['increase_heating']
        }
      });
    }

    return suggestions;
  }

  // ============================================
  // PUBLIC API
  // ============================================

  async getCurrentWeather() {
    if (this.cache.current && Date.now() - this.cache.lastUpdate < this.cacheDuration) {
      return this.cache.current;
    }
    
    const data = await this.updateWeatherData();
    return data.current;
  }

  async getForecast() {
    if (this.cache.forecast && Date.now() - this.cache.lastUpdate < this.cacheDuration) {
      return this.cache.forecast;
    }
    
    const data = await this.updateWeatherData();
    return data.forecast;
  }

  async getWeatherBasedRecommendations() {
    const [heating, lighting, energy, comfort, alerts, automations] = await Promise.all([
      this.getHeatingRecommendation(),
      this.getLightingRecommendation(),
      this.getEnergyOptimization(),
      this.getComfortOptimization(),
      this.generateWeatherAlerts(),
      this.getAutomationSuggestions()
    ]);

    return {
      heating,
      lighting,
      energy,
      comfort,
      alerts,
      automations
    };
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  getMostCommonCondition(conditions) {
    const counts = {};
    conditions.forEach(c => {
      counts[c] = (counts[c] || 0) + 1;
    });
    
    return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
  }

  getWeatherIcon(condition) {
    const icons = {
      'Clear': '☀️',
      'Clouds': '☁️',
      'Rain': '🌧️',
      'Snow': '❄️',
      'Thunderstorm': '⛈️',
      'Drizzle': '🌦️',
      'Mist': '🌫️',
      'Fog': '🌫️'
    };
    return icons[condition] || '🌤️';
  }

  getDefaultWeather() {
    return {
      current: this.getDefaultCurrentWeather(),
      forecast: this.getDefaultForecast()
    };
  }

  getDefaultCurrentWeather() {
    return {
      temperature: 5,
      feelsLike: 3,
      humidity: 75,
      pressure: 1013,
      windSpeed: 3,
      windDirection: 180,
      cloudiness: 50,
      visibility: 10000,
      condition: 'Clouds',
      description: 'molnigt',
      icon: '03d',
      sunrise: new Date(),
      sunset: new Date(),
      timestamp: new Date()
    };
  }

  getDefaultForecast() {
    const hourly = Array.from({ length: 24 }, (_, i) => ({
      timestamp: new Date(Date.now() + i * 60 * 60 * 1000),
      temperature: 5 + Math.random() * 5,
      feelsLike: 3 + Math.random() * 5,
      humidity: 70 + Math.random() * 20,
      pressure: 1010 + Math.random() * 10,
      windSpeed: 2 + Math.random() * 3,
      cloudiness: 40 + Math.random() * 40,
      condition: 'Clouds',
      description: 'molnigt',
      icon: '03d',
      rain: 0,
      snow: 0
    }));

    return {
      hourly,
      daily: this.aggregateDailyForecast(hourly),
      raw: hourly
    };
  }

  destroy() {
    if (this._intervals) {
      this._intervals.forEach(id => clearInterval(id));
      this._intervals = [];
    }
  }
}

module.exports = WeatherIntegration;
