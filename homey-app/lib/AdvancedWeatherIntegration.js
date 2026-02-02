'use strict';

/**
 * Advanced Weather Integration
 * Comprehensive weather forecasting and automated home adjustments
 */
class AdvancedWeatherIntegration {
  constructor(homey) {
    this.homey = homey;
    this.currentWeather = null;
    this.forecast = [];
    this.weatherAlerts = [];
    this.automationRules = new Map();
    this.weatherHistory = [];
    this.updateInterval = 600000;
  }

  async initialize() {
    this.log('Initializing Advanced Weather Integration...');
    
    await this.setupWeatherAutomations();
    await this.updateWeatherData();
    await this.startMonitoring();
    
    this.log('Advanced Weather Integration initialized');
  }

  async setupWeatherAutomations() {
    this.automationRules.set('rain_windows', {
      id: 'rain_windows',
      name: 'Close windows on rain',
      condition: (weather) => weather.precipitation > 0,
      action: async () => await this.closeWindows(),
      enabled: true
    });

    this.automationRules.set('hot_blinds', {
      id: 'hot_blinds',
      name: 'Close blinds on hot days',
      condition: (weather) => weather.temperature > 28,
      action: async () => await this.closeBlinds(),
      enabled: true
    });

    this.automationRules.set('storm_security', {
      id: 'storm_security',
      name: 'Secure home on storm warning',
      condition: (weather) => weather.windSpeed > 20,
      action: async () => await this.secureHome(),
      enabled: true
    });

    this.automationRules.set('cold_heating', {
      id: 'cold_heating',
      name: 'Increase heating when cold',
      condition: (weather) => weather.temperature < 5,
      action: async () => await this.adjustHeating(22),
      enabled: true
    });

    this.automationRules.set('sunny_solar', {
      id: 'sunny_solar',
      name: 'Optimize solar on sunny days',
      condition: (weather) => weather.cloudCover < 30,
      action: async () => await this.optimizeSolar(),
      enabled: true
    });
  }

  async startMonitoring() {
    this.monitoringInterval = setInterval(async () => {
      await this.updateWeatherData();
      await this.evaluateAutomations();
      await this.checkWeatherAlerts();
    }, this.updateInterval);
  }

  async updateWeatherData() {
    try {
      const weather = await this.fetchWeatherData();
      this.currentWeather = weather;
      
      this.weatherHistory.push({
        timestamp: Date.now(),
        temperature: weather.temperature,
        humidity: weather.humidity,
        precipitation: weather.precipitation
      });

      if (this.weatherHistory.length > 288) {
        this.weatherHistory = this.weatherHistory.slice(-288);
      }

      await this.updateForecast();
      
      this.log(`Weather updated: ${weather.temperature}°C, ${weather.condition}`);
    } catch (error) {
      this.error(`Failed to update weather: ${error.message}`);
    }
  }

  async fetchWeatherData() {
    const simulatedWeather = {
      temperature: 15 + Math.random() * 10,
      humidity: 50 + Math.random() * 30,
      precipitation: Math.random() > 0.8 ? Math.random() * 10 : 0,
      windSpeed: Math.random() * 15,
      cloudCover: Math.random() * 100,
      condition: this.getWeatherCondition(),
      pressure: 1010 + Math.random() * 20,
      visibility: 10 + Math.random() * 5,
      uvIndex: Math.random() * 10
    };

    return simulatedWeather;
  }

  getWeatherCondition() {
    const conditions = ['sunny', 'cloudy', 'rainy', 'partly_cloudy', 'clear'];
    return conditions[Math.floor(Math.random() * conditions.length)];
  }

  async updateForecast() {
    this.forecast = [];
    
    for (let i = 0; i < 7; i++) {
      const baseTemp = this.currentWeather.temperature;
      const forecast = {
        day: i,
        date: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        temperatureHigh: baseTemp + Math.random() * 5,
        temperatureLow: baseTemp - Math.random() * 5,
        precipitation: Math.random() * 10,
        condition: this.getWeatherCondition(),
        windSpeed: Math.random() * 15
      };
      
      this.forecast.push(forecast);
    }
  }

  async evaluateAutomations() {
    if (!this.currentWeather) return;

    for (const [id, rule] of this.automationRules) {
      if (!rule.enabled) continue;

      try {
        if (rule.condition(this.currentWeather)) {
          if (!rule.lastTriggered || Date.now() - rule.lastTriggered > 3600000) {
            this.log(`Triggering automation: ${rule.name}`);
            await rule.action();
            rule.lastTriggered = Date.now();
          }
        }
      } catch (error) {
        this.error(`Automation error (${rule.name}): ${error.message}`);
      }
    }
  }

  async closeWindows() {
    this.log('Closing windows due to rain');
    
    const devices = this.homey.drivers.getDevices();
    for (const device of devices) {
      if (device.name.toLowerCase().includes('window') && device.hasCapability('windowcoverings_state')) {
        try {
          await device.setCapabilityValue('windowcoverings_state', 0);
        } catch {}
      }
    }

    try {
      const notificationManager = this.homey.app.advancedNotificationManager;
      if (notificationManager) {
        await notificationManager.sendNotification({
          title: '🌧️ Regn detekterat',
          message: 'Fönster stängs automatiskt',
          priority: 'normal',
          category: 'weather'
        });
      }
    } catch {}
  }

  async closeBlinds() {
    this.log('Closing blinds due to hot weather');
    
    const devices = this.homey.drivers.getDevices();
    for (const device of devices) {
      const name = device.name.toLowerCase();
      if ((name.includes('blind') || name.includes('persienn')) && device.hasCapability('windowcoverings_state')) {
        try {
          await device.setCapabilityValue('windowcoverings_state', 0);
        } catch {}
      }
    }
  }

  async secureHome() {
    this.log('Securing home due to storm warning');

    try {
      const securitySystem = this.homey.app.advancedSecuritySystem;
      if (securitySystem) {
        await securitySystem.lockAllDoors();
      }
    } catch {}

    await this.closeWindows();
    await this.closeBlinds();

    try {
      const notificationManager = this.homey.app.advancedNotificationManager;
      if (notificationManager) {
        await notificationManager.sendNotification({
          title: '⚠️ Stormvarning',
          message: 'Hemmet säkras automatiskt',
          priority: 'high',
          category: 'weather'
        });
      }
    } catch {}
  }

  async adjustHeating(temperature) {
    this.log(`Adjusting heating to ${temperature}°C due to cold weather`);
    
    const devices = this.homey.drivers.getDevices();
    for (const device of devices) {
      if (device.hasCapability('target_temperature')) {
        try {
          await device.setCapabilityValue('target_temperature', temperature);
        } catch {}
      }
    }
  }

  async optimizeSolar() {
    this.log('Optimizing solar usage for sunny day');
    
    try {
      const energyStorage = this.homey.app.energyStorageManagementSystem;
      if (energyStorage) {
        // Trigger charging during sunny periods
      }
    } catch {}
  }

  async checkWeatherAlerts() {
    if (!this.currentWeather) return;

    if (this.currentWeather.temperature > 35) {
      await this.createAlert('extreme_heat', 'Extrem värme', 'Temperaturen överstiger 35°C');
    }

    if (this.currentWeather.temperature < -10) {
      await this.createAlert('extreme_cold', 'Extrem kyla', 'Temperaturen understiger -10°C');
    }

    if (this.currentWeather.windSpeed > 25) {
      await this.createAlert('high_wind', 'Kraftig vind', 'Vindhastighet över 25 m/s');
    }

    if (this.currentWeather.precipitation > 20) {
      await this.createAlert('heavy_rain', 'Kraftigt regn', 'Nederbörd över 20mm/h');
    }
  }

  async createAlert(id, title, message) {
    const existingAlert = this.weatherAlerts.find(a => a.id === id && Date.now() - a.timestamp < 3600000);
    if (existingAlert) return;

    const alert = {
      id,
      title,
      message,
      timestamp: Date.now()
    };

    this.weatherAlerts.push(alert);

    try {
      const notificationManager = this.homey.app.advancedNotificationManager;
      if (notificationManager) {
        await notificationManager.sendNotification({
          title: `⚠️ ${title}`,
          message,
          priority: 'high',
          category: 'weather_alert'
        });
      }
    } catch {}
  }

  getStatistics() {
    return {
      currentTemperature: this.currentWeather?.temperature.toFixed(1) || 'N/A',
      currentCondition: this.currentWeather?.condition || 'unknown',
      forecastDays: this.forecast.length,
      activeAlerts: this.weatherAlerts.filter(a => Date.now() - a.timestamp < 3600000).length,
      automationRules: this.automationRules.size,
      weatherHistory: this.weatherHistory.length
    };
  }

  log(...args) {
    console.log('[AdvancedWeatherIntegration]', ...args);
  }

  error(...args) {
    console.error('[AdvancedWeatherIntegration]', ...args);
  }
}

module.exports = AdvancedWeatherIntegration;
