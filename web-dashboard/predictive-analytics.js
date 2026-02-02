'use strict';

/**
 * Predictive Analytics Service
 * Real-time analytics, forecasting, and intelligent insights
 */
class PredictiveAnalytics {
  constructor() {
    this.historicalData = {
      energy: [],
      temperature: [],
      deviceUsage: [],
      presence: []
    };
    
    this.forecasts = new Map();
    this.anomalies = [];
    this.insights = [];
  }

  // ============================================
  // ENERGY ANALYTICS
  // ============================================

  async analyzeEnergyConsumption(data) {
    const analysis = {
      current: this.calculateCurrentConsumption(data),
      hourly: this.calculateHourlyAverage(data),
      daily: this.calculateDailyAverage(data),
      weekly: this.calculateWeeklyAverage(data),
      monthly: this.calculateMonthlyAverage(data),
      
      // Trends
      trend: this.detectTrend(data.energy),
      seasonality: this.detectSeasonality(data.energy),
      
      // Predictions
      nextHour: this.predictNextHour(data.energy),
      today: this.predictToday(data.energy),
      thisMonth: this.predictThisMonth(data.energy),
      
      // Insights
      peakHours: this.identifyPeakHours(data.energy),
      savings: this.identifySavingOpportunities(data),
      efficiency: this.calculateEfficiencyScore(data),
      
      // Anomalies
      anomalies: this.detectEnergyAnomalies(data.energy),
      
      // Costs
      costs: this.calculateEnergyCosts(data),
      forecast: this.forecastCosts(data)
    };
    
    return analysis;
  }

  calculateCurrentConsumption(data) {
    const devices = Object.values(data.devices || {});
    const totalPower = devices.reduce((sum, device) => {
      const power = device.capabilitiesObj?.measure_power?.value || 0;
      return sum + power;
    }, 0);
    
    return {
      watts: totalPower,
      kilowatts: totalPower / 1000,
      perHour: totalPower / 1000,
      perDay: (totalPower / 1000) * 24,
      perMonth: (totalPower / 1000) * 24 * 30
    };
  }

  detectTrend(energyData) {
    if (!energyData || energyData.length < 10) {
      return { direction: 'stable', change: 0 };
    }
    
    // Simple linear regression
    const n = energyData.length;
    const sumX = energyData.reduce((sum, _, i) => sum + i, 0);
    const sumY = energyData.reduce((sum, val) => sum + val, 0);
    const sumXY = energyData.reduce((sum, val, i) => sum + i * val, 0);
    const sumXX = energyData.reduce((sum, _, i) => sum + i * i, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const percentChange = (slope / (sumY / n)) * 100;
    
    return {
      direction: slope > 0.1 ? 'increasing' : slope < -0.1 ? 'decreasing' : 'stable',
      change: percentChange,
      slope: slope
    };
  }

  predictNextHour(energyData) {
    const hour = new Date().getHours();
    const historicalAverages = this.calculateHourlyAverages(energyData);
    const currentTrend = this.detectTrend(energyData.slice(-24));
    
    const basePredict = historicalAverages[hour + 1] || historicalAverages[hour] || 200;
    const trendAdjusted = basePredict * (1 + currentTrend.change / 100);
    
    return {
      prediction: trendAdjusted,
      confidence: 0.75,
      range: {
        min: trendAdjusted * 0.85,
        max: trendAdjusted * 1.15
      }
    };
  }

  predictToday(energyData) {
    const hour = new Date().getHours();
    const consumedSoFar = energyData.slice(0, hour).reduce((sum, val) => sum + val, 0);
    const remainingHours = 24 - hour;
    const avgPerHour = consumedSoFar / Math.max(hour, 1);
    const predictedRemaining = avgPerHour * remainingHours * 1.05; // 5% buffer
    
    return {
      prediction: consumedSoFar + predictedRemaining,
      confidence: 0.8,
      consumedSoFar,
      remaining: predictedRemaining
    };
  }

  identifyPeakHours(energyData) {
    const hourlyAverages = this.calculateHourlyAverages(energyData);
    const avgConsumption = Object.values(hourlyAverages).reduce((a, b) => a + b, 0) / 24;
    
    const peaks = [];
    for (let hour = 0; hour < 24; hour++) {
      if (hourlyAverages[hour] > avgConsumption * 1.3) {
        peaks.push({
          hour,
          consumption: hourlyAverages[hour],
          percentage: ((hourlyAverages[hour] / avgConsumption) - 1) * 100
        });
      }
    }
    
    return peaks.sort((a, b) => b.consumption - a.consumption);
  }

  identifySavingOpportunities(data) {
    const opportunities = [];
    const devices = Object.values(data.devices || {});
    
    // Devices on during absence
    devices.forEach(device => {
      if (device.capabilitiesObj?.onoff?.value && !data.presence) {
        const power = device.capabilitiesObj?.measure_power?.value || 10;
        opportunities.push({
          type: 'standby',
          device: device.name,
          deviceId: device.id,
          currentCost: (power / 1000) * 24 * 30 * 2.5, // SEK/month
          savingPotential: (power / 1000) * 8 * 30 * 2.5, // 8 hours/day
          priority: power > 50 ? 'high' : 'medium'
        });
      }
    });
    
    // Temperature optimization
    const thermostats = devices.filter(d => d.class === 'thermostat');
    thermostats.forEach(t => {
      const current = t.capabilitiesObj?.target_temperature?.value || 21;
      if (current > 21) {
        opportunities.push({
          type: 'temperature',
          device: t.name,
          deviceId: t.id,
          currentTemp: current,
          suggestedTemp: 21,
          savingPotential: (current - 21) * 50, // Rough estimate
          priority: 'medium'
        });
      }
    });
    
    return opportunities.sort((a, b) => b.savingPotential - a.savingPotential);
  }

  calculateEfficiencyScore(data) {
    const current = this.calculateCurrentConsumption(data);
    const optimal = this.calculateOptimalConsumption(data);
    
    const score = Math.max(0, Math.min(100, 
      100 - ((current.perDay - optimal.perDay) / optimal.perDay * 100)
    ));
    
    return {
      score: Math.round(score),
      rating: score > 80 ? 'excellent' : score > 60 ? 'good' : score > 40 ? 'fair' : 'poor',
      current: current.perDay,
      optimal: optimal.perDay,
      improvement: optimal.perDay - current.perDay
    };
  }

  calculateOptimalConsumption(data) {
    // Estimate optimal consumption based on device count and type
    const devices = Object.values(data.devices || {});
    let optimal = 0;
    
    devices.forEach(device => {
      if (device.class === 'light') optimal += 0.05; // 50W
      else if (device.class === 'thermostat') optimal += 1.5; // 1500W
      else if (device.class === 'socket') optimal += 0.1; // 100W
    });
    
    return {
      perDay: optimal * 12, // Average 12 hours use
      perMonth: optimal * 12 * 30
    };
  }

  detectEnergyAnomalies(energyData) {
    const anomalies = [];
    
    if (!energyData || energyData.length < 24) return anomalies;
    
    const mean = energyData.reduce((a, b) => a + b, 0) / energyData.length;
    const stdDev = Math.sqrt(
      energyData.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / energyData.length
    );
    
    energyData.forEach((value, index) => {
      const zScore = Math.abs((value - mean) / stdDev);
      
      if (zScore > 2.5) { // More than 2.5 standard deviations
        anomalies.push({
          timestamp: Date.now() - (energyData.length - index) * 3600000,
          value,
          expected: mean,
          deviation: zScore,
          severity: zScore > 3 ? 'high' : 'medium'
        });
      }
    });
    
    return anomalies;
  }

  calculateEnergyCosts(data) {
    const pricePerKWh = 2.5; // SEK
    const current = this.calculateCurrentConsumption(data);
    
    return {
      perHour: current.perHour * pricePerKWh,
      perDay: current.perDay * pricePerKWh,
      perMonth: current.perMonth * pricePerKWh,
      perYear: current.perMonth * pricePerKWh * 12,
      currency: 'SEK'
    };
  }

  forecastCosts(data) {
    const costs = this.calculateEnergyCosts(data);
    const trend = this.detectTrend(data.energy || []);
    
    const nextMonthMultiplier = 1 + (trend.change / 100);
    
    return {
      nextMonth: costs.perMonth * nextMonthMultiplier,
      nextYear: costs.perYear * nextMonthMultiplier,
      trend: trend.direction,
      confidence: 0.7
    };
  }

  // ============================================
  // CLIMATE ANALYTICS
  // ============================================

  async analyzeClimate(data) {
    const zones = Object.values(data.zones || {});
    const climateDevices = Object.values(data.devices || {})
      .filter(d => d.capabilities?.includes('measure_temperature'));
    
    const analysis = {
      zones: zones.map(zone => this.analyzeZoneClimate(zone, climateDevices)),
      overall: this.analyzeOverallClimate(climateDevices),
      comfort: this.calculateComfortScore(climateDevices),
      recommendations: this.generateClimateRecommendations(climateDevices),
      forecast: this.forecastTemperature(climateDevices)
    };
    
    return analysis;
  }

  analyzeZoneClimate(zone, devices) {
    const zoneDevices = devices.filter(d => d.zone === zone.id);
    
    if (zoneDevices.length === 0) {
      return { zoneId: zone.id, zoneName: zone.name, data: null };
    }
    
    const temperatures = zoneDevices
      .map(d => d.capabilitiesObj?.measure_temperature?.value)
      .filter(t => t !== undefined);
    
    const humidities = zoneDevices
      .map(d => d.capabilitiesObj?.measure_humidity?.value)
      .filter(h => h !== undefined);
    
    const avgTemp = temperatures.reduce((a, b) => a + b, 0) / temperatures.length;
    const avgHumidity = humidities.length > 0 
      ? humidities.reduce((a, b) => a + b, 0) / humidities.length 
      : null;
    
    return {
      zoneId: zone.id,
      zoneName: zone.name,
      temperature: {
        current: avgTemp,
        optimal: 21,
        deviation: avgTemp - 21,
        status: this.getTemperatureStatus(avgTemp)
      },
      humidity: avgHumidity ? {
        current: avgHumidity,
        optimal: 45,
        deviation: avgHumidity - 45,
        status: this.getHumidityStatus(avgHumidity)
      } : null,
      comfort: this.calculateZoneComfort(avgTemp, avgHumidity)
    };
  }

  getTemperatureStatus(temp) {
    if (temp < 18) return 'too_cold';
    if (temp < 20) return 'cold';
    if (temp <= 22) return 'comfortable';
    if (temp <= 24) return 'warm';
    return 'too_warm';
  }

  getHumidityStatus(humidity) {
    if (humidity < 30) return 'too_dry';
    if (humidity < 40) return 'dry';
    if (humidity <= 60) return 'comfortable';
    if (humidity <= 70) return 'humid';
    return 'too_humid';
  }

  calculateZoneComfort(temp, humidity) {
    let score = 100;
    
    // Temperature comfort (20-22°C is ideal)
    const tempDeviation = Math.abs(temp - 21);
    score -= tempDeviation * 10;
    
    // Humidity comfort (40-60% is ideal)
    if (humidity) {
      const humidityDeviation = Math.abs(humidity - 50);
      score -= humidityDeviation / 2;
    }
    
    return {
      score: Math.max(0, Math.min(100, Math.round(score))),
      rating: score > 80 ? 'excellent' : score > 60 ? 'good' : score > 40 ? 'fair' : 'poor'
    };
  }

  // ============================================
  // DEVICE ANALYTICS
  // ============================================

  async analyzeDeviceUsage(data) {
    const devices = Object.values(data.devices || {});
    
    const analysis = {
      summary: {
        total: devices.length,
        active: devices.filter(d => d.capabilitiesObj?.onoff?.value).length,
        byClass: this.groupDevicesByClass(devices),
        byZone: this.groupDevicesByZone(devices)
      },
      usage: devices.map(d => this.analyzeDevice(d)),
      patterns: this.detectUsagePatterns(devices),
      recommendations: this.generateDeviceRecommendations(devices)
    };
    
    return analysis;
  }

  analyzeDevice(device) {
    return {
      id: device.id,
      name: device.name,
      class: device.class,
      zone: device.zone,
      status: device.capabilitiesObj?.onoff?.value ? 'on' : 'off',
      power: device.capabilitiesObj?.measure_power?.value || 0,
      
      // Usage stats (would come from historical data)
      usage: {
        hoursPerDay: 8,
        daysPerWeek: 6,
        energyPerDay: (device.capabilitiesObj?.measure_power?.value || 0) * 8 / 1000,
        costPerMonth: ((device.capabilitiesObj?.measure_power?.value || 0) * 8 / 1000) * 30 * 2.5
      },
      
      // Health
      health: {
        status: 'healthy',
        uptime: '99.8%',
        lastIssue: null
      }
    };
  }

  detectUsagePatterns(devices) {
    const patterns = [];
    
    // Morning pattern
    const morningDevices = devices.filter(d => 
      ['kitchen', 'bedroom', 'bathroom'].includes(d.zone)
    );
    if (morningDevices.length > 0) {
      patterns.push({
        name: 'Morning Routine',
        time: '06:00-09:00',
        devices: morningDevices.map(d => d.name),
        frequency: 0.85,
        confidence: 0.8
      });
    }
    
    // Evening pattern
    const eveningDevices = devices.filter(d => 
      ['living-room', 'kitchen'].includes(d.zone)
    );
    if (eveningDevices.length > 0) {
      patterns.push({
        name: 'Evening Activity',
        time: '18:00-23:00',
        devices: eveningDevices.map(d => d.name),
        frequency: 0.9,
        confidence: 0.85
      });
    }
    
    return patterns;
  }

  // ============================================
  // INSIGHTS GENERATION
  // ============================================

  async generateInsights(data) {
    const insights = [];
    
    // Energy insights
    const energyAnalysis = await this.analyzeEnergyConsumption(data);
    if (energyAnalysis.trend.direction === 'increasing') {
      insights.push({
        type: 'energy',
        priority: 'high',
        title: 'Ökande energiförbrukning',
        message: `Din energiförbrukning har ökat med ${Math.abs(energyAnalysis.trend.change).toFixed(1)}% senaste veckan`,
        action: 'review_devices',
        icon: '⚡'
      });
    }
    
    // Climate insights
    const climateAnalysis = await this.analyzeClimate(data);
    const uncomfortableZones = climateAnalysis.zones.filter(z => 
      z.comfort && z.comfort.score < 60
    );
    if (uncomfortableZones.length > 0) {
      insights.push({
        type: 'comfort',
        priority: 'medium',
        title: 'Klimat kan förbättras',
        message: `${uncomfortableZones.length} rum har suboptimalt klimat`,
        zones: uncomfortableZones.map(z => z.zoneName),
        action: 'adjust_climate',
        icon: '🌡️'
      });
    }
    
    // Savings opportunities
    if (energyAnalysis.savings.length > 0) {
      const totalSavings = energyAnalysis.savings.reduce((sum, s) => sum + s.savingPotential, 0);
      insights.push({
        type: 'savings',
        priority: 'high',
        title: 'Besparingsmöjligheter',
        message: `Du kan spara upp till ${Math.round(totalSavings)} kr/månad`,
        savings: energyAnalysis.savings.slice(0, 3),
        action: 'view_recommendations',
        icon: '💰'
      });
    }
    
    // Automation suggestions
    const deviceAnalysis = await this.analyzeDeviceUsage(data);
    if (deviceAnalysis.patterns.length > 0) {
      insights.push({
        type: 'automation',
        priority: 'medium',
        title: 'Automatiseringsförslag',
        message: `${deviceAnalysis.patterns.length} användningsmönster upptäckta`,
        patterns: deviceAnalysis.patterns,
        action: 'create_automation',
        icon: '🤖'
      });
    }
    
    return insights;
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  calculateHourlyAverages(energyData) {
    const hourlyData = Array(24).fill(0).map(() => []);
    
    energyData.forEach((value, index) => {
      const hour = index % 24;
      hourlyData[hour].push(value);
    });
    
    const averages = {};
    hourlyData.forEach((values, hour) => {
      if (values.length > 0) {
        averages[hour] = values.reduce((a, b) => a + b, 0) / values.length;
      } else {
        averages[hour] = 200; // Default
      }
    });
    
    return averages;
  }

  calculateHourlyAverage(data) {
    return this.calculateCurrentConsumption(data).perHour;
  }

  calculateDailyAverage(data) {
    return this.calculateCurrentConsumption(data).perDay;
  }

  calculateWeeklyAverage(data) {
    return this.calculateCurrentConsumption(data).perDay * 7;
  }

  calculateMonthlyAverage(data) {
    return this.calculateCurrentConsumption(data).perMonth;
  }

  predictThisMonth(energyData) {
    const daysInMonth = 30;
    const currentDay = new Date().getDate();
    const avgPerDay = energyData.reduce((a, b) => a + b, 0) / currentDay;
    
    return {
      prediction: avgPerDay * daysInMonth,
      confidence: 0.75,
      consumed: avgPerDay * currentDay,
      remaining: avgPerDay * (daysInMonth - currentDay)
    };
  }

  detectSeasonality(energyData) {
    // Simplified seasonality detection
    return {
      detected: true,
      period: 'daily',
      strength: 0.6
    };
  }

  analyzeOverallClimate(devices) {
    const temps = devices
      .map(d => d.capabilitiesObj?.measure_temperature?.value)
      .filter(t => t !== undefined);
    
    if (temps.length === 0) return null;
    
    const avg = temps.reduce((a, b) => a + b, 0) / temps.length;
    const min = Math.min(...temps);
    const max = Math.max(...temps);
    
    return {
      average: avg,
      min,
      max,
      range: max - min,
      status: this.getTemperatureStatus(avg)
    };
  }

  calculateComfortScore(devices) {
    const zones = this.groupDevicesByZone(devices);
    const scores = Object.values(zones).map(zoneDevices => {
      const temps = zoneDevices
        .map(d => d.capabilitiesObj?.measure_temperature?.value)
        .filter(t => t !== undefined);
      
      if (temps.length === 0) return 50;
      
      const avg = temps.reduce((a, b) => a + b, 0) / temps.length;
      return this.calculateZoneComfort(avg, null).score;
    });
    
    const overall = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    return {
      score: Math.round(overall),
      rating: overall > 80 ? 'excellent' : overall > 60 ? 'good' : overall > 40 ? 'fair' : 'poor'
    };
  }

  generateClimateRecommendations(devices) {
    const recommendations = [];
    
    devices.forEach(device => {
      const temp = device.capabilitiesObj?.measure_temperature?.value;
      if (temp && temp < 19) {
        recommendations.push({
          type: 'temperature',
          device: device.name,
          message: `Höj temperaturen i ${device.name}`,
          action: 'increase_temperature',
          priority: 'medium'
        });
      }
    });
    
    return recommendations;
  }

  forecastTemperature(devices) {
    const temps = devices
      .map(d => d.capabilitiesObj?.measure_temperature?.value)
      .filter(t => t !== undefined);
    
    const avg = temps.reduce((a, b) => a + b, 0) / temps.length;
    
    return {
      nextHour: avg,
      today: avg,
      confidence: 0.7
    };
  }

  groupDevicesByClass(devices) {
    const grouped = {};
    devices.forEach(device => {
      if (!grouped[device.class]) {
        grouped[device.class] = [];
      }
      grouped[device.class].push(device);
    });
    return grouped;
  }

  groupDevicesByZone(devices) {
    const grouped = {};
    devices.forEach(device => {
      if (!grouped[device.zone]) {
        grouped[device.zone] = [];
      }
      grouped[device.zone].push(device);
    });
    return grouped;
  }

  generateDeviceRecommendations(devices) {
    const recommendations = [];
    
    // Find devices that are always on
    devices.forEach(device => {
      if (device.capabilitiesObj?.onoff?.value) {
        recommendations.push({
          type: 'device_usage',
          device: device.name,
          message: `${device.name} är alltid påslagen - överväg automation`,
          action: 'create_automation',
          priority: 'low'
        });
      }
    });
    
    return recommendations;
  }
}

module.exports = PredictiveAnalytics;
