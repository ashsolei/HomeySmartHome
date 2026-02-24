'use strict';

const { BaseSystem } = require('./utils/BaseSystem');

/**
 * Energy Forecasting Engine
 * Advanced energy prediction, cost forecasting, and optimization
 */
class EnergyForecastingEngine extends BaseSystem {
  constructor(homey) {
    super(homey);
    this.historicalData = [];
    this.forecastModels = new Map();
    this.energyPrices = [];
    this.predictions = new Map();
    this.optimizationRules = [];
  }

  async initialize() {
    await super.initialize();
    this.log('Initializing Energy Forecasting Engine...');
    
    // Load historical data
    this.historicalData = await this.homey.settings.get('energyHistoricalData') || [];
    
    // Load energy prices
    this.energyPrices = await this.homey.settings.get('energyPrices') || [];
    
    // Load optimization rules
    this.optimizationRules = await this.homey.settings.get('optimizationRules') || [];

    // Start data collection
    await this.startDataCollection();
    
    // Train initial models
    await this.trainModels();
    
    this.log('Energy Forecasting Engine initialized');
  }

  /**
   * Start collecting energy data
   */
  async startDataCollection() {
    // Collect energy data every 5 minutes
    this.dataCollectionInterval = this.registerInterval(setInterval(async () => {
      await this.collectEnergyData();
    }, 300000));

    // Update forecasts every hour
    this.forecastInterval = this.registerInterval(setInterval(async () => {
      await this.updateForecasts();
    }, 3600000));

    // Train models daily
    this.trainingInterval = this.registerInterval(setInterval(async () => {
      await this.trainModels();
    }, 86400000));

    // Fetch energy prices every hour
    this.priceUpdateInterval = this.registerInterval(setInterval(async () => {
      await this.fetchEnergyPrices();
    }, 3600000));
  }

  /**
   * Collect current energy data
   */
  async collectEnergyData() {
    const dataPoint = {
      timestamp: Date.now(),
      datetime: new Date(),
      hour: new Date().getHours(),
      dayOfWeek: new Date().getDay(),
      totalConsumption: 0,
      byDevice: {},
      byZone: {},
      production: 0,
      gridImport: 0,
      gridExport: 0,
      cost: 0
    };

    try {
      // Get total energy consumption
      const energyManager = this.homey.app.energyManager;
      if (energyManager) {
        const consumption = await energyManager.getTotalConsumption();
        dataPoint.totalConsumption = consumption;
      }

      // Get energy by device
      const devices = this.homey.drivers.getDevices();
      for (const device of devices) {
        if (device.hasCapability('measure_power')) {
          try {
            const power = await device.getCapabilityValue('measure_power');
            dataPoint.byDevice[device.id] = {
              name: device.name,
              power,
              zone: device.zone?.name
            };

            // Aggregate by zone
            const zone = device.zone?.name || 'unknown';
            dataPoint.byZone[zone] = (dataPoint.byZone[zone] || 0) + power;
          } catch (error) {
            // Device might not support power measurement
          }
        }
      }

      // Calculate cost
      const currentPrice = this.getCurrentEnergyPrice();
      if (currentPrice) {
        dataPoint.cost = (dataPoint.totalConsumption / 1000) * currentPrice.price;
        dataPoint.priceLevel = currentPrice.level;
      }

      // Add weather data if available
      const weather = await this.getWeatherData();
      if (weather) {
        dataPoint.weather = weather;
      }

      this.historicalData.push(dataPoint);

      // Keep only last 10000 data points (~35 days at 5-min intervals)
      if (this.historicalData.length > 10000) {
        this.historicalData.shift();
      }

      await this.saveHistoricalData();

    } catch (error) {
      this.error('Error collecting energy data:', error);
    }
  }

  /**
   * Train forecasting models
   */
  async trainModels() {
    this.log('Training forecasting models...');

    if (this.historicalData.length < 100) {
      this.log('Insufficient data for training');
      return;
    }

    // Train hourly model
    await this.trainHourlyModel();

    // Train daily model
    await this.trainDailyModel();

    // Train weekly model
    await this.trainWeeklyModel();

    // Train device-specific models
    await this.trainDeviceModels();

    this.log('Model training complete');
  }

  /**
   * Train hourly forecasting model
   */
  async trainHourlyModel() {
    const model = {
      type: 'hourly',
      trained: Date.now(),
      patterns: {}
    };

    // Group data by hour of day
    const byHour = {};
    for (const dataPoint of this.historicalData) {
      const hour = dataPoint.hour;
      if (!byHour[hour]) byHour[hour] = [];
      byHour[hour].push(dataPoint.totalConsumption);
    }

    // Calculate statistics for each hour
    for (const [hour, values] of Object.entries(byHour)) {
      model.patterns[hour] = {
        mean: this.calculateMean(values),
        median: this.calculateMedian(values),
        stdDev: this.calculateStdDev(values),
        min: Math.min(...values),
        max: Math.max(...values),
        samples: values.length
      };
    }

    this.forecastModels.set('hourly', model);
  }

  /**
   * Train daily forecasting model
   */
  async trainDailyModel() {
    const model = {
      type: 'daily',
      trained: Date.now(),
      patterns: {}
    };

    // Group by day of week
    const byDay = {};
    for (const dataPoint of this.historicalData) {
      const day = dataPoint.dayOfWeek;
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(dataPoint.totalConsumption);
    }

    // Calculate patterns
    for (const [day, values] of Object.entries(byDay)) {
      model.patterns[day] = {
        mean: this.calculateMean(values),
        median: this.calculateMedian(values),
        trend: this.calculateTrend(values),
        samples: values.length
      };
    }

    this.forecastModels.set('daily', model);
  }

  /**
   * Train weekly forecasting model
   */
  async trainWeeklyModel() {
    const model = {
      type: 'weekly',
      trained: Date.now(),
      weekdayAvg: 0,
      weekendAvg: 0
    };

    const weekdayData = this.historicalData.filter(d => d.dayOfWeek >= 1 && d.dayOfWeek <= 5);
    const weekendData = this.historicalData.filter(d => d.dayOfWeek === 0 || d.dayOfWeek === 6);

    model.weekdayAvg = this.calculateMean(weekdayData.map(d => d.totalConsumption));
    model.weekendAvg = this.calculateMean(weekendData.map(d => d.totalConsumption));

    this.forecastModels.set('weekly', model);
  }

  /**
   * Train device-specific models
   */
  async trainDeviceModels() {
    const deviceData = {};

    // Aggregate data by device
    for (const dataPoint of this.historicalData) {
      for (const [deviceId, device] of Object.entries(dataPoint.byDevice)) {
        if (!deviceData[deviceId]) {
          deviceData[deviceId] = {
            name: device.name,
            values: []
          };
        }
        deviceData[deviceId].values.push(device.power);
      }
    }

    // Create models
    for (const [deviceId, data] of Object.entries(deviceData)) {
      if (data.values.length < 50) continue;

      const model = {
        type: 'device',
        deviceId,
        deviceName: data.name,
        trained: Date.now(),
        avgPower: this.calculateMean(data.values),
        maxPower: Math.max(...data.values),
        typicalUsage: this.calculateMedian(data.values),
        usagePattern: this.identifyUsagePattern(data.values)
      };

      this.forecastModels.set(`device_${deviceId}`, model);
    }
  }

  /**
   * Identify usage pattern (constant, periodic, random)
   */
  identifyUsagePattern(values) {
    const stdDev = this.calculateStdDev(values);
    const mean = this.calculateMean(values);
    const cv = stdDev / mean; // Coefficient of variation

    if (cv < 0.1) return 'constant';
    if (cv < 0.5) return 'periodic';
    return 'variable';
  }

  /**
   * Update forecasts
   */
  async updateForecasts() {
    this.log('Updating forecasts...');

    // Forecast next 24 hours
    const hourlyForecast = await this.forecastNextHours(24);
    this.predictions.set('hourly_24h', hourlyForecast);

    // Forecast next 7 days
    const dailyForecast = await this.forecastNextDays(7);
    this.predictions.set('daily_7d', dailyForecast);

    // Forecast cost
    const costForecast = await this.forecastCost(24);
    this.predictions.set('cost_24h', costForecast);

    // Identify optimization opportunities
    const opportunities = await this.identifyOptimizationOpportunities();
    this.predictions.set('optimization', opportunities);

    await this.notifyImportantPredictions(hourlyForecast, costForecast);
  }

  /**
   * Forecast next N hours
   */
  async forecastNextHours(hours) {
    const model = this.forecastModels.get('hourly');
    if (!model) return [];

    const forecast = [];
    const now = new Date();

    for (let i = 0; i < hours; i++) {
      const futureTime = new Date(now.getTime() + (i * 3600000));
      const hour = futureTime.getHours();
      const pattern = model.patterns[hour];

      if (pattern) {
        // Apply trend adjustment
        const trendFactor = this.calculateTrendFactor();
        
        forecast.push({
          hour: i,
          timestamp: futureTime.getTime(),
          datetime: futureTime,
          predicted: pattern.mean * trendFactor,
          confidence: this.calculateConfidence(pattern.samples),
          range: {
            low: pattern.mean - pattern.stdDev,
            high: pattern.mean + pattern.stdDev
          }
        });
      }
    }

    return forecast;
  }

  /**
   * Forecast next N days
   */
  async forecastNextDays(days) {
    const model = this.forecastModels.get('daily');
    if (!model) return [];

    const forecast = [];
    const now = new Date();

    for (let i = 0; i < days; i++) {
      const futureDate = new Date(now.getTime() + (i * 86400000));
      const dayOfWeek = futureDate.getDay();
      const pattern = model.patterns[dayOfWeek];

      if (pattern) {
        forecast.push({
          day: i,
          date: futureDate,
          dayOfWeek,
          predicted: pattern.mean,
          trend: pattern.trend,
          confidence: this.calculateConfidence(pattern.samples)
        });
      }
    }

    return forecast;
  }

  /**
   * Forecast energy cost
   */
  async forecastCost(hours) {
    const energyForecast = await this.forecastNextHours(hours);
    const costForecast = [];

    for (const forecast of energyForecast) {
      const price = await this.predictPriceForTime(forecast.datetime);
      
      costForecast.push({
        ...forecast,
        price: price.price,
        priceLevel: price.level,
        cost: (forecast.predicted / 1000) * price.price
      });
    }

    // Calculate total cost
    const totalCost = costForecast.reduce((sum, f) => sum + f.cost, 0);

    return {
      hourly: costForecast,
      totalCost,
      currency: 'SEK'
    };
  }

  /**
   * Predict energy price for future time
   */
  async predictPriceForTime(datetime) {
    const hour = datetime.getHours();
    
    // Simple model based on typical Swedish electricity pricing
    // Peak hours: 7-9, 17-20
    // Off-peak: 22-6
    
    let basePrice = 1.5; // SEK/kWh
    let level = 'normal';

    if (hour >= 7 && hour <= 9 || hour >= 17 && hour <= 20) {
      basePrice = 2.5; // Peak
      level = 'high';
    } else if (hour >= 22 || hour <= 6) {
      basePrice = 0.8; // Off-peak
      level = 'low';
    }

    return {
      price: basePrice,
      level,
      timestamp: datetime.getTime()
    };
  }

  /**
   * Identify optimization opportunities
   */
  async identifyOptimizationOpportunities() {
    const opportunities = [];

    // Opportunity 1: Shift consumption to off-peak hours
    const costForecast = this.predictions.get('cost_24h');
    if (costForecast) {
      const highCostHours = costForecast.hourly.filter(h => h.priceLevel === 'high');
      const lowCostHours = costForecast.hourly.filter(h => h.priceLevel === 'low');

      if (highCostHours.length > 0 && lowCostHours.length > 0) {
        opportunities.push({
          type: 'shift_consumption',
          title: 'Skjut upp energikrävande aktiviteter',
          description: `Spara upp till ${this.calculateSavings(highCostHours, lowCostHours)} SEK genom att använda el under lågtimmar`,
          savings: this.calculateSavings(highCostHours, lowCostHours),
          action: 'schedule_loads',
          priority: 'medium',
          impact: 'high'
        });
      }
    }

    // Opportunity 2: High consumption devices
    const deviceModels = Array.from(this.forecastModels.entries())
      .filter(([key, _]) => key.startsWith('device_'));

    const highConsumers = deviceModels
      .map(([key, model]) => model)
      .filter(m => m.avgPower > 500) // > 500W
      .sort((a, b) => b.avgPower - a.avgPower)
      .slice(0, 3);

    if (highConsumers.length > 0) {
      opportunities.push({
        type: 'reduce_consumption',
        title: 'Optimera högförbrukande enheter',
        description: `${highConsumers.map(d => d.deviceName).join(', ')} förbrukar mest energi`,
        devices: highConsumers,
        priority: 'low',
        impact: 'medium'
      });
    }

    // Opportunity 3: Predictive preheating/cooling
    const weatherForecast = await this.getWeatherForecast();
    if (weatherForecast && weatherForecast.temperatureChange > 5) {
      opportunities.push({
        type: 'predictive_climate',
        title: 'Förvärm/kyla baserat på väderprognos',
        description: `Temperaturändring på ${weatherForecast.temperatureChange}°C förväntas`,
        priority: 'medium',
        impact: 'medium'
      });
    }

    // Opportunity 4: Peak shaving
    const peakConsumption = Math.max(...this.historicalData.slice(-288).map(d => d.totalConsumption));
    const avgConsumption = this.calculateMean(this.historicalData.slice(-288).map(d => d.totalConsumption));
    
    if (peakConsumption > avgConsumption * 2) {
      opportunities.push({
        type: 'peak_shaving',
        title: 'Minska effekttoppar',
        description: 'Höga effekttoppar kan ge extra avgifter',
        peakPower: peakConsumption,
        avgPower: avgConsumption,
        priority: 'high',
        impact: 'high'
      });
    }

    return opportunities;
  }

  /**
   * Calculate potential savings
   */
  calculateSavings(highCostHours, lowCostHours) {
    if (highCostHours.length === 0 || lowCostHours.length === 0) return 0;

    const avgHighCost = this.calculateMean(highCostHours.map(h => h.cost));
    const avgLowCost = this.calculateMean(lowCostHours.map(h => h.cost));
    
    return Math.round((avgHighCost - avgLowCost) * 30); // Monthly savings
  }

  /**
   * Get comprehensive forecast report
   */
  async getForecastReport() {
    const hourly = this.predictions.get('hourly_24h') || [];
    const daily = this.predictions.get('daily_7d') || [];
    const cost = this.predictions.get('cost_24h');
    const optimization = this.predictions.get('optimization') || [];

    // Calculate insights
    const peakHour = hourly.length > 0 ? 
      hourly.reduce((max, h) => h.predicted > max.predicted ? h : max) : null;

    const lowestCostHour = cost && cost.hourly.length > 0 ?
      cost.hourly.reduce((min, h) => h.cost < min.cost ? h : min) : null;

    return {
      timestamp: Date.now(),
      hourlyForecast: hourly,
      dailyForecast: daily,
      costForecast: cost,
      insights: {
        peakHour: peakHour ? {
          time: new Date(peakHour.timestamp),
          consumption: peakHour.predicted
        } : null,
        lowestCostHour: lowestCostHour ? {
          time: new Date(lowestCostHour.timestamp),
          cost: lowestCostHour.cost,
          price: lowestCostHour.price
        } : null,
        expectedDailyCost: cost ? cost.totalCost : 0,
        optimization: optimization
      }
    };
  }

  /**
   * Get energy statistics
   */
  async getEnergyStatistics(period = '24h') {
    let data = [];
    const now = Date.now();

    switch (period) {
      case '24h':
        data = this.historicalData.filter(d => now - d.timestamp < 86400000);
        break;
      case '7d':
        data = this.historicalData.filter(d => now - d.timestamp < (7 * 86400000));
        break;
      case '30d':
        data = this.historicalData.filter(d => now - d.timestamp < (30 * 86400000));
        break;
      default:
        data = this.historicalData;
    }

    if (data.length === 0) {
      return { error: 'No data available' };
    }

    const consumption = data.map(d => d.totalConsumption);
    const costs = data.map(d => d.cost).filter(c => c > 0);

    return {
      period,
      dataPoints: data.length,
      totalConsumption: consumption.reduce((sum, c) => sum + c, 0),
      avgConsumption: this.calculateMean(consumption),
      peakConsumption: Math.max(...consumption),
      minConsumption: Math.min(...consumption),
      totalCost: costs.reduce((sum, c) => sum + c, 0),
      avgCost: costs.length > 0 ? this.calculateMean(costs) : 0,
      trend: this.calculateTrend(consumption)
    };
  }

  /**
   * Fetch energy prices (placeholder)
   */
  async fetchEnergyPrices() {
    // Would integrate with energy price API (e.g., Nordpool)
    this.log('Fetching energy prices...');
    
    // Simulated data
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const hour = new Date(now.getTime() + (i * 3600000));
      const price = await this.predictPriceForTime(hour);
      
      this.energyPrices.push({
        ...price,
        hour: hour.getHours(),
        date: hour.toISOString().split('T')[0]
      });
    }

    // Keep only recent prices
    const weekAgo = Date.now() - (7 * 86400000);
    this.energyPrices = this.energyPrices.filter(p => p.timestamp > weekAgo);
  }

  /**
   * Get current energy price
   */
  getCurrentEnergyPrice() {
    const now = new Date();
    const currentHour = now.getHours();
    const today = now.toISOString().split('T')[0];

    return this.energyPrices.find(p => p.hour === currentHour && p.date === today) || {
      price: 1.5,
      level: 'normal'
    };
  }

  /**
   * Get weather data (placeholder)
   */
  async getWeatherData() {
    // Would integrate with weather API
    return null;
  }

  /**
   * Get weather forecast (placeholder)
   */
  async getWeatherForecast() {
    // Would integrate with weather forecast API
    return null;
  }

  /**
   * Notify about important predictions
   */
  async notifyImportantPredictions(hourlyForecast, costForecast) {
    if (!hourlyForecast || !costForecast) return;

    // Notify about high consumption prediction
    const peakHour = hourlyForecast.reduce((max, h) => h.predicted > max.predicted ? h : max, hourlyForecast[0]);
    const avgPredicted = this.calculateMean(hourlyForecast.map(h => h.predicted));

    if (peakHour.predicted > avgPredicted * 1.5) {
      await this.homey.notifications.createNotification({
        excerpt: `Hög energiförbrukning förväntas kl ${new Date(peakHour.timestamp).getHours()}:00`
      });
    }

    // Notify about high cost hours
    const highCostHours = costForecast.hourly.filter(h => h.priceLevel === 'high');
    if (highCostHours.length > 0) {
      const hours = highCostHours.map(h => new Date(h.timestamp).getHours()).join(', ');
      await this.homey.notifications.createNotification({
        excerpt: `Höga elpriser förväntas kl ${hours}`
      });
    }
  }

  // ============================================
  // STATISTICAL HELPER METHODS
  // ============================================

  calculateMean(values) {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  calculateMedian(values) {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  calculateStdDev(values) {
    if (values.length === 0) return 0;
    const mean = this.calculateMean(values);
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const variance = this.calculateMean(squaredDiffs);
    return Math.sqrt(variance);
  }

  calculateTrend(values) {
    if (values.length < 2) return 0;
    
    // Simple linear regression slope
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, v) => sum + v, 0);
    const sumXY = values.reduce((sum, v, i) => sum + (i * v), 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }

  calculateTrendFactor() {
    // Adjust predictions based on recent trend
    if (this.historicalData.length < 20) return 1.0;
    
    const recent = this.historicalData.slice(-20).map(d => d.totalConsumption);
    const trend = this.calculateTrend(recent);
    
    // Apply small adjustment based on trend
    return 1.0 + (trend * 0.1);
  }

  calculateConfidence(sampleSize) {
    // More samples = higher confidence
    if (sampleSize < 10) return 0.3;
    if (sampleSize < 50) return 0.6;
    if (sampleSize < 100) return 0.8;
    return 0.95;
  }

  async saveHistoricalData() {
    await this.homey.settings.set('energyHistoricalData', this.historicalData.slice(-10000));
  }

}

module.exports = EnergyForecastingEngine;
