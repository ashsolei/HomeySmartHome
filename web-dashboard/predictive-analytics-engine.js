'use strict';
const logger = require('./logger');
const MAX_ENTRIES = 1000;

/**
 * Predictive Analytics Engine
 * Multi-system correlation and forecasting
 */
class PredictiveAnalyticsEngine {
  constructor(app) {
    this._intervals = [];
    this._timeouts = [];
    this.app = app;
    this.dataStreams = new Map();
    this.correlations = [];
    this.predictions = [];
    this.anomalies = [];
    this.trends = [];
    this.alerts = [];
  }

  async initialize() {
    await this.setupDataStreams();
    await this.loadHistoricalData();
    
    this.startAnalytics();
  }

  // ============================================
  // DATA COLLECTION
  // ============================================

  async setupDataStreams() {
    const streams = [
      { id: 'energy', name: 'Energy Usage', unit: 'kWh', frequency: 300 },      // 5 min
      { id: 'temperature', name: 'Temperature', unit: '°C', frequency: 300 },
      { id: 'humidity', name: 'Humidity', unit: '%', frequency: 300 },
      { id: 'presence', name: 'Presence', unit: 'boolean', frequency: 60 },     // 1 min
      { id: 'water', name: 'Water Usage', unit: 'liters', frequency: 600 },     // 10 min
      { id: 'co2', name: 'CO2 Level', unit: 'ppm', frequency: 300 },
      { id: 'price', name: 'Energy Price', unit: 'SEK/kWh', frequency: 3600 },  // 1 hour
      { id: 'weather', name: 'Outside Temperature', unit: '°C', frequency: 1800 } // 30 min
    ];

    for (const stream of streams) {
      this.dataStreams.set(stream.id, {
        ...stream,
        data: [],
        stats: {
          min: null,
          max: null,
          avg: null,
          stdDev: null
        }
      });
    }
  }

  async loadHistoricalData() {
    const now = Date.now();
    const days = 30;

    for (const [streamId, stream] of this.dataStreams) {
      const data = [];

      for (let i = days * 24 * 12; i >= 0; i--) { // 5-min intervals for 30 days
        const timestamp = now - i * 5 * 60 * 1000;
        let value;

        switch (streamId) {
          case 'energy':
            value = 1.5 + Math.random() * 3 + Math.sin(i / 12) * 2; // Daily pattern
            break;
          case 'temperature':
            value = 20 + Math.random() * 3 + Math.sin(i / 144) * 1.5;
            break;
          case 'humidity':
            value = 40 + Math.random() * 20;
            break;
          case 'presence':
            value = Math.random() > 0.3 ? 1 : 0;
            break;
          case 'water':
            value = Math.random() * 50;
            break;
          case 'co2':
            value = 400 + Math.random() * 400;
            break;
          case 'price':
            value = 0.5 + Math.random() * 1.5;
            break;
          case 'weather':
            value = 15 + Math.random() * 10 + Math.sin(i / 288) * 5; // Seasonal
            break;
          default:
            value = Math.random() * 100;
        }

        data.push({
          timestamp,
          value: parseFloat(value.toFixed(2))
        });
      }

      stream.data = data;
      await this.calculateStats(streamId);
    }
  }

  async calculateStats(streamId) {
    const stream = this.dataStreams.get(streamId);
    
    if (!stream || stream.data.length === 0) {
      return;
    }

    const values = stream.data.map(d => d.value);
    
    stream.stats.min = Math.min(...values);
    stream.stats.max = Math.max(...values);
    stream.stats.avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    
    // Calculate standard deviation
    const variance = values.reduce((sum, v) => sum + Math.pow(v - stream.stats.avg, 2), 0) / values.length;
    stream.stats.stdDev = Math.sqrt(variance);
  }

  async addDataPoint(streamId, value) {
    const stream = this.dataStreams.get(streamId);
    
    if (!stream) {
      return { success: false, error: 'Stream not found' };
    }

    stream.data.push({
      timestamp: Date.now(),
      value
    });

    // Keep only last 30 days
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    stream.data = stream.data.filter(d => d.timestamp >= cutoff);

    await this.calculateStats(streamId);

    // Check for anomalies
    await this.detectAnomaly(streamId, value);

    return { success: true };
  }

  // ============================================
  // CORRELATION ANALYSIS
  // ============================================

  async findCorrelations() {
    logger.info('🔍 Analyzing correlations...');

    const correlations = [];
    const streamIds = Array.from(this.dataStreams.keys());

    // Analyze pairs
    for (let i = 0; i < streamIds.length; i++) {
      for (let j = i + 1; j < streamIds.length; j++) {
        const correlation = await this.calculateCorrelation(streamIds[i], streamIds[j]);
        
        if (Math.abs(correlation.coefficient) > 0.5) { // Strong correlation
          correlations.push(correlation);
          logger.info(`  ${correlation.stream1} ↔️ ${correlation.stream2}: ${correlation.coefficient.toFixed(2)}`);
        }
      }
    }

    this.correlations = correlations.sort((a, b) => 
      Math.abs(b.coefficient) - Math.abs(a.coefficient)
    );

    return this.correlations;
  }

  async calculateCorrelation(streamId1, streamId2) {
    const stream1 = this.dataStreams.get(streamId1);
    const stream2 = this.dataStreams.get(streamId2);

    // Align data points by timestamp
    const aligned = this.alignDataStreams(stream1.data, stream2.data);

    if (aligned.length < 10) {
      return {
        stream1: stream1.name,
        stream2: stream2.name,
        coefficient: 0,
        strength: 'none'
      };
    }

    // Calculate Pearson correlation coefficient
    const mean1 = aligned.reduce((sum, d) => sum + d.value1, 0) / aligned.length;
    const mean2 = aligned.reduce((sum, d) => sum + d.value2, 0) / aligned.length;

    let numerator = 0;
    let denominator1 = 0;
    let denominator2 = 0;

    for (const point of aligned) {
      const diff1 = point.value1 - mean1;
      const diff2 = point.value2 - mean2;
      
      numerator += diff1 * diff2;
      denominator1 += diff1 * diff1;
      denominator2 += diff2 * diff2;
    }

    const coefficient = numerator / Math.sqrt(denominator1 * denominator2);

    return {
      stream1: stream1.name,
      stream2: stream2.name,
      coefficient: parseFloat(coefficient.toFixed(3)),
      strength: Math.abs(coefficient) > 0.7 ? 'strong' :
                Math.abs(coefficient) > 0.5 ? 'moderate' : 'weak',
      type: coefficient > 0 ? 'positive' : 'negative'
    };
  }

  alignDataStreams(data1, data2) {
    const aligned = [];
    const tolerance = 5 * 60 * 1000; // 5 minutes

    for (const point1 of data1) {
      const point2 = data2.find(p => 
        Math.abs(p.timestamp - point1.timestamp) < tolerance
      );

      if (point2) {
        aligned.push({
          timestamp: point1.timestamp,
          value1: point1.value,
          value2: point2.value
        });
      }
    }

    return aligned;
  }

  // ============================================
  // ANOMALY DETECTION
  // ============================================

  async detectAnomaly(streamId, value) {
    const stream = this.dataStreams.get(streamId);
    
    if (!stream || !stream.stats.stdDev) {
      return;
    }

    // Z-score method: value is anomalous if > 3 standard deviations from mean
    const zScore = Math.abs((value - stream.stats.avg) / stream.stats.stdDev);

    if (zScore > 3) {
      const anomaly = {
        id: `anomaly_${Date.now()}`,
        stream: stream.name,
        streamId,
        timestamp: Date.now(),
        value,
        expectedRange: {
          min: (stream.stats.avg - 3 * stream.stats.stdDev).toFixed(2),
          max: (stream.stats.avg + 3 * stream.stats.stdDev).toFixed(2)
        },
        severity: zScore > 5 ? 'critical' : zScore > 4 ? 'high' : 'medium',
        zScore: zScore.toFixed(2)
      };

      this.anomalies.push(anomaly);
    if (this.anomalies.length > MAX_ENTRIES) this.anomalies.shift();

      logger.info(`⚠️ Anomaly detected: ${stream.name} = ${value} (Z-score: ${zScore.toFixed(2)})`);

      // Create alert
      await this.createAlert({
        type: 'anomaly',
        severity: anomaly.severity,
        message: `Unusual ${stream.name}: ${value} ${stream.unit}`,
        details: anomaly
      });

      return anomaly;
    }

    return null;
  }

  async analyzeAnomalies() {
    // Group anomalies by stream
    const byStream = {};

    for (const anomaly of this.anomalies) {
      if (!byStream[anomaly.streamId]) {
        byStream[anomaly.streamId] = [];
      }
      byStream[anomaly.streamId].push(anomaly);
    }

    return {
      total: this.anomalies.length,
      byStream,
      recent: this.anomalies.slice(-10).reverse()
    };
  }

  // ============================================
  // TREND ANALYSIS
  // ============================================

  async analyzeTrends() {
    logger.info('📈 Analyzing trends...');

    const trends = [];

    for (const [streamId, stream] of this.dataStreams) {
      const trend = await this.calculateTrend(streamId);
      
      if (trend) {
        trends.push(trend);
        
        if (Math.abs(trend.changePercent) > 10) {
          logger.info(`  ${stream.name}: ${trend.direction} ${Math.abs(trend.changePercent).toFixed(1)}%`);
        }
      }
    }

    this.trends = trends;

    return trends;
  }

  async calculateTrend(streamId) {
    const stream = this.dataStreams.get(streamId);
    
    if (!stream || stream.data.length < 100) {
      return null;
    }

    // Compare last 7 days vs previous 7 days
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    const recent = stream.data.filter(d => 
      d.timestamp >= now - sevenDays
    );

    const previous = stream.data.filter(d => 
      d.timestamp >= now - 2 * sevenDays &&
      d.timestamp < now - sevenDays
    );

    if (recent.length === 0 || previous.length === 0) {
      return null;
    }

    const recentAvg = recent.reduce((sum, d) => sum + d.value, 0) / recent.length;
    const previousAvg = previous.reduce((sum, d) => sum + d.value, 0) / previous.length;

    const change = recentAvg - previousAvg;
    const changePercent = (change / previousAvg) * 100;

    return {
      stream: stream.name,
      streamId,
      recentAvg: recentAvg.toFixed(2),
      previousAvg: previousAvg.toFixed(2),
      change: change.toFixed(2),
      changePercent: changePercent.toFixed(1),
      direction: change > 0 ? 'increasing' : 'decreasing',
      significance: Math.abs(changePercent) > 20 ? 'high' :
                    Math.abs(changePercent) > 10 ? 'medium' : 'low'
    };
  }

  // ============================================
  // PREDICTIONS
  // ============================================

  async predictFuture(streamId, hours = 24) {
    logger.info(`🔮 Predicting ${streamId} for next ${hours} hours...`);

    const stream = this.dataStreams.get(streamId);
    
    if (!stream || stream.data.length < 100) {
      return null;
    }

    // Simple moving average prediction
    const recent = stream.data.slice(-288); // Last 24 hours (5-min intervals)
    const hourlyAverages = [];

    for (let hour = 0; hour < 24; hour++) {
      const hourData = recent.filter((d, i) => Math.floor(i / 12) === hour);
      const avg = hourData.reduce((sum, d) => sum + d.value, 0) / hourData.length;
      hourlyAverages.push(avg);
    }

    // Predict next N hours based on pattern
    const predictions = [];
    const now = Date.now();

    for (let hour = 0; hour < hours; hour++) {
      const patternHour = new Date(now + hour * 60 * 60 * 1000).getHours();
      const predictedValue = hourlyAverages[patternHour] || stream.stats.avg;

      predictions.push({
        timestamp: now + hour * 60 * 60 * 1000,
        hour: patternHour,
        value: parseFloat(predictedValue.toFixed(2)),
        confidence: 0.75 - (hour / hours) * 0.3 // Decreasing confidence
      });
    }

    this.predictions.push({
      stream: stream.name,
      streamId,
      timestamp: Date.now(),
      timeframe: hours,
      predictions
    });
    if (this.predictions.length > MAX_ENTRIES) this.predictions.shift();

    return predictions;
  }

  async predictEnergyPeak() {
    const energyPredictions = await this.predictFuture('energy', 24);
    
    if (!energyPredictions) {
      return null;
    }

    // Find peak hour
    const peak = energyPredictions.reduce((max, p) => 
      p.value > max.value ? p : max
    );

    return {
      hour: peak.hour,
      timestamp: peak.timestamp,
      expectedUsage: peak.value,
      confidence: peak.confidence
    };
  }

  async predictCost(hours = 24) {
    const energyPredictions = await this.predictFuture('energy', hours);
    const priceStream = this.dataStreams.get('price');
    
    if (!energyPredictions || !priceStream) {
      return null;
    }

    let totalCost = 0;

    for (const prediction of energyPredictions) {
      // Use average price (in real scenario, would use price prediction)
      const price = priceStream.stats.avg;
      totalCost += prediction.value * price;
    }

    return {
      timeframe: hours + ' hours',
      estimatedCost: totalCost.toFixed(2),
      averagePrice: priceStream.stats.avg.toFixed(2),
      confidence: 0.70
    };
  }

  // ============================================
  // OPTIMIZATION SUGGESTIONS
  // ============================================

  async generateOptimizationSuggestions() {
    logger.info('💡 Generating optimization suggestions...');

    const suggestions = [];

    // Analyze energy vs price correlation
    const energyPriceCorr = this.correlations.find(c => 
      (c.stream1 === 'Energy Usage' && c.stream2 === 'Energy Price') ||
      (c.stream2 === 'Energy Usage' && c.stream1 === 'Energy Price')
    );

    if (energyPriceCorr && energyPriceCorr.coefficient > 0.3) {
      suggestions.push({
        type: 'energy_timing',
        priority: 'high',
        title: 'Optimera energitimning',
        description: 'Energianvändningen korrelerar med höga priser',
        potentialSavings: '500 SEK/månad',
        actions: [
          'Flytta energikrävande uppgifter till låg-pris timmar',
          'Automatisera laddning till natten',
          'Använd batterilagring under peak-timmar'
        ]
      });
    }

    // Analyze temperature vs energy
    const tempEnergyTrend = this.trends.find(t => t.streamId === 'temperature');
    const energyTrend = this.trends.find(t => t.streamId === 'energy');

    if (tempEnergyTrend && energyTrend && 
        tempEnergyTrend.direction !== energyTrend.direction) {
      suggestions.push({
        type: 'heating_optimization',
        priority: 'medium',
        title: 'Optimera uppvärmning',
        description: 'Temperatur och energi visar olika trender',
        potentialSavings: '300 SEK/månad',
        actions: [
          'Justera värmekurvan',
          'Använd zonstyrning',
          'Sänk temperatur i outnyttjade rum'
        ]
      });
    }

    // Detect water anomalies
    const waterAnomalies = this.anomalies.filter(a => 
      a.streamId === 'water' && 
      a.timestamp > Date.now() - 7 * 24 * 60 * 60 * 1000
    );

    if (waterAnomalies.length > 3) {
      suggestions.push({
        type: 'water_leak',
        priority: 'critical',
        title: 'Möjlig vattenläcka',
        description: `${waterAnomalies.length} vattenavvikelser senaste veckan`,
        potentialSavings: 'Förhindra skador',
        actions: [
          'Kontrollera synliga rör',
          'Inspektera toaletter',
          'Kalla på rörmokare vid behov'
        ]
      });
    }

    // Analyze CO2 levels
    const co2Stream = this.dataStreams.get('co2');
    if (co2Stream && co2Stream.stats.avg > 800) {
      suggestions.push({
        type: 'ventilation',
        priority: 'medium',
        title: 'Förbättra ventilation',
        description: `Genomsnittlig CO2: ${co2Stream.stats.avg.toFixed(0)} ppm`,
        potentialSavings: 'Bättre luftkvalitet',
        actions: [
          'Öka ventilation',
          'Öppna fönster oftare',
          'Kontrollera frånluftsfilter'
        ]
      });
    }

    return suggestions;
  }

  // ============================================
  // ALERTS
  // ============================================

  async createAlert(alert) {
    const newAlert = {
      id: `alert_${Date.now()}`,
      timestamp: Date.now(),
      ...alert,
      acknowledged: false
    };

    this.alerts.push(newAlert);
    if (this.alerts.length > MAX_ENTRIES) this.alerts.shift();

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }

    return newAlert;
  }

  async acknowledgeAlert(alertId) {
    const alert = this.alerts.find(a => a.id === alertId);
    
    if (alert) {
      alert.acknowledged = true;
      return { success: true };
    }

    return { success: false, error: 'Alert not found' };
  }

  // ============================================
  // MONITORING
  // ============================================

  startAnalytics() {
    // Find correlations weekly
    this._intervals.push(setInterval(() => {
      const day = new Date().getDay();
      if (day === 0) { // Sunday
        this.findCorrelations();
      }
    }, 24 * 60 * 60 * 1000));

    // Analyze trends daily
    this._intervals.push(setInterval(() => {
      const hour = new Date().getHours();
      if (hour === 3) { // 3 AM
        this.analyzeTrends();
      }
    }, 60 * 60 * 1000));

    // Generate predictions every 6 hours
    this._intervals.push(setInterval(() => {
      const hour = new Date().getHours();
      if (hour % 6 === 0) {
        this.predictFuture('energy', 24);
        this.predictFuture('temperature', 24);
      }
    }, 60 * 60 * 1000));

    // Check for optimization opportunities daily
    this._intervals.push(setInterval(() => {
      const hour = new Date().getHours();
      if (hour === 8) { // 8 AM
        this.generateOptimizationSuggestions();
      }
    }, 60 * 60 * 1000));

    // Initial analysis
    this._timeouts.push(setTimeout(() => {
      this.findCorrelations();
      this.analyzeTrends();
    }, 5000));
  }

  // ============================================
  // REPORTING
  // ============================================

  getAnalyticsOverview() {
    const recentAnomalies = this.anomalies.filter(a => 
      a.timestamp > Date.now() - 7 * 24 * 60 * 60 * 1000
    ).length;

    const activeAlerts = this.alerts.filter(a => !a.acknowledged).length;

    return {
      dataStreams: this.dataStreams.size,
      correlations: this.correlations.length,
      predictions: this.predictions.length,
      anomalies: recentAnomalies,
      activeAlerts,
      trends: this.trends.length
    };
  }

  getStrongCorrelations() {
    return this.correlations
      .filter(c => Math.abs(c.coefficient) > 0.7)
      .slice(0, 5)
      .map(c => ({
        streams: `${c.stream1} ↔️ ${c.stream2}`,
        coefficient: c.coefficient,
        strength: c.strength,
        type: c.type
      }));
  }

  getRecentAnomalies() {
    return this.anomalies
      .filter(a => a.timestamp > Date.now() - 7 * 24 * 60 * 60 * 1000)
      .slice(-10)
      .reverse()
      .map(a => ({
        stream: a.stream,
        value: a.value,
        severity: a.severity,
        date: new Date(a.timestamp).toLocaleDateString('sv-SE')
      }));
  }

  getSignificantTrends() {
    return this.trends
      .filter(t => t.significance !== 'low')
      .slice(0, 5)
      .map(t => ({
        stream: t.stream,
        direction: t.direction,
        change: t.changePercent + '%',
        significance: t.significance
      }));
  }

  getActiveAlerts() {
    return this.alerts
      .filter(a => !a.acknowledged)
      .slice(-10)
      .reverse()
      .map(a => ({
        type: a.type,
        severity: a.severity,
        message: a.message,
        date: new Date(a.timestamp).toLocaleDateString('sv-SE')
      }));
  }

  destroy() {
    if (this._intervals) {
      this._intervals.forEach(id => clearInterval(id));
      this._intervals = [];
    }
    if (this._timeouts) {
      this._timeouts.forEach(id => clearTimeout(id));
      this._timeouts = [];
    }
  }
}

module.exports = PredictiveAnalyticsEngine;
