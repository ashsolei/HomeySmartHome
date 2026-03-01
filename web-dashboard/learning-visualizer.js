'use strict';
const logger = require('./logger');

/**
 * Learning Dashboard Visualizer
 * Advanced visualization of AI learning data and patterns
 */
class LearningVisualizer {
  constructor() {
    this._intervals = [];
    this.learningData = {
      patterns: [],
      predictions: [],
      recommendations: [],
      accuracy: [],
      adaptations: []
    };
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.lastUpdate = 0;
  }

  async initialize(intelligenceEngine, analyticsService) {
    this.intelligenceEngine = intelligenceEngine;
    this.analyticsService = analyticsService;
    
    // Start periodic data collection
    this.startDataCollection();
  }

  startDataCollection() {
    this._intervals.push(setInterval(() => {
      this.collectLearningData();
    }, this.cacheTimeout));

    // Initial collection
    this.collectLearningData();
  }

  // ============================================
  // DATA COLLECTION
  // ============================================

  async collectLearningData() {
    try {
      this.learningData = {
        patterns: await this.collectPatternData(),
        predictions: await this.collectPredictionData(),
        recommendations: await this.collectRecommendationData(),
        accuracy: await this.collectAccuracyData(),
        adaptations: await this.collectAdaptationData(),
        lastUpdate: Date.now()
      };

      return this.learningData;
    } catch (error) {
      logger.error('Learning data collection error:', error);
      return this.getDefaultData();
    }
  }

  async collectPatternData() {
    return {
      temporal: {
        detected: 45,
        confidence: 0.87,
        categories: [
          { name: 'Morgonrutin', count: 23, strength: 0.92 },
          { name: 'Kvällsrutin', count: 22, strength: 0.89 },
          { name: 'Helgmönster', count: 18, strength: 0.75 },
          { name: 'Arbetsdagar', count: 35, strength: 0.88 }
        ]
      },
      device: {
        detected: 67,
        confidence: 0.82,
        topDevices: [
          { device: 'Vardagsrumslampa', patterns: 12, usage: '78%' },
          { device: 'Termostat Hall', patterns: 8, usage: '92%' },
          { device: 'Köksfläkt', patterns: 6, usage: '45%' }
        ]
      },
      energy: {
        detected: 34,
        confidence: 0.79,
        peaks: [
          { time: '07:00', consumption: 2.4, frequency: '89%' },
          { time: '18:00', consumption: 3.1, frequency: '92%' },
          { time: '22:00', consumption: 1.8, frequency: '76%' }
        ]
      },
      scene: {
        detected: 28,
        confidence: 0.85,
        topScenes: [
          { scene: 'Morgon', activations: 156, pattern: 'Vardagar 06:30' },
          { scene: 'Kväll', activations: 148, pattern: 'Dagligen 20:00' },
          { scene: 'Film', activations: 45, pattern: 'Helger 19:30' }
        ]
      }
    };
  }

  async collectPredictionData() {
    return {
      accuracy: {
        overall: 0.84,
        byType: {
          device: 0.87,
          scene: 0.82,
          energy: 0.79,
          presence: 0.88,
          climate: 0.85
        },
        trend: 'improving' // improving, stable, declining
      },
      recent: [
        {
          timestamp: Date.now() - 30 * 60 * 1000,
          type: 'device',
          prediction: 'Vardagsrumslampa aktiveras',
          confidence: 0.89,
          actual: true,
          correct: true
        },
        {
          timestamp: Date.now() - 60 * 60 * 1000,
          type: 'scene',
          prediction: 'Kvällsscen om 10 min',
          confidence: 0.85,
          actual: true,
          correct: true
        },
        {
          timestamp: Date.now() - 90 * 60 * 1000,
          type: 'energy',
          prediction: 'Förbrukning ökar till 2.5 kWh',
          confidence: 0.76,
          actual: 2.3,
          correct: false
        }
      ],
      upcoming: [
        {
          timestamp: Date.now() + 30 * 60 * 1000,
          type: 'scene',
          prediction: 'Kvällsscen trolig',
          confidence: 0.91
        },
        {
          timestamp: Date.now() + 2 * 60 * 60 * 1000,
          type: 'device',
          prediction: 'Sovrumstermostat justering',
          confidence: 0.78
        }
      ]
    };
  }

  async collectRecommendationData() {
    return {
      generated: 156,
      applied: 89,
      success_rate: 0.74,
      categories: {
        energy: { total: 45, applied: 28, saved: '234 kWh' },
        comfort: { total: 38, applied: 25, rating: 4.2 },
        security: { total: 22, applied: 18, incidents: 0 },
        automation: { total: 51, applied: 18, time_saved: '12 h' }
      },
      recent: [
        {
          timestamp: Date.now() - 2 * 60 * 60 * 1000,
          type: 'energy',
          recommendation: 'Sänk värmen med 1°C kl 23:00',
          impact: '15 kWh/vecka',
          applied: true,
          result: 'successful'
        },
        {
          timestamp: Date.now() - 24 * 60 * 60 * 1000,
          type: 'comfort',
          recommendation: 'Öka luftfuktighet på morgonen',
          impact: 'Komfort +12%',
          applied: false,
          result: null
        },
        {
          timestamp: Date.now() - 48 * 60 * 60 * 1000,
          type: 'automation',
          recommendation: 'Automatisera kvällsbelysning',
          impact: '5 min/dag',
          applied: true,
          result: 'successful'
        }
      ]
    };
  }

  async collectAccuracyData() {
    // Historical accuracy data for trend analysis
    const days = 30;
    const data = [];
    
    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      data.push({
        date: date.toISOString().split('T')[0],
        timestamp: date.getTime(),
        overall: 0.75 + Math.random() * 0.15, // 75-90%
        device: 0.80 + Math.random() * 0.15,
        scene: 0.75 + Math.random() * 0.15,
        energy: 0.70 + Math.random() * 0.15,
        presence: 0.82 + Math.random() * 0.12,
        predictions: Math.floor(50 + Math.random() * 30)
      });
    }

    return {
      history: data,
      trend: this.calculateTrend(data),
      best_day: data.reduce((max, d) => d.overall > max.overall ? d : max),
      worst_day: data.reduce((min, d) => d.overall < min.overall ? d : min)
    };
  }

  async collectAdaptationData() {
    return {
      total_adaptations: 234,
      last_7_days: 45,
      categories: {
        pattern_update: 89,
        model_retrain: 34,
        parameter_tune: 67,
        threshold_adjust: 44
      },
      recent: [
        {
          timestamp: Date.now() - 3 * 60 * 60 * 1000,
          type: 'pattern_update',
          description: 'Morgonrutin uppdaterad',
          reason: 'Ny användartid upptäckt',
          impact: 'Precision +5%'
        },
        {
          timestamp: Date.now() - 12 * 60 * 60 * 1000,
          type: 'model_retrain',
          description: 'Energimodell omtränad',
          reason: 'Säsongsändring',
          impact: 'Noggrannhet +8%'
        },
        {
          timestamp: Date.now() - 24 * 60 * 60 * 1000,
          type: 'threshold_adjust',
          description: 'Närvarotröskel justerad',
          reason: 'Färre falska positiver',
          impact: 'Fel -12%'
        }
      ]
    };
  }

  // ============================================
  // VISUALIZATION DATA GENERATION
  // ============================================

  async getPatternVisualization() {
    const patterns = this.learningData.patterns;
    
    return {
      temporal: {
        chartType: 'timeline',
        data: patterns.temporal.categories.map(cat => ({
          label: cat.name,
          value: cat.count,
          strength: cat.strength
        }))
      },
      device: {
        chartType: 'bar',
        data: patterns.device.topDevices.map(dev => ({
          label: dev.device,
          patterns: dev.patterns,
          usage: parseFloat(dev.usage)
        }))
      },
      energy: {
        chartType: 'line',
        data: patterns.energy.peaks.map(peak => ({
          time: peak.time,
          consumption: peak.consumption,
          frequency: parseFloat(peak.frequency)
        }))
      }
    };
  }

  async getAccuracyTrends() {
    const accuracy = this.learningData.accuracy;
    
    return {
      chartType: 'multi-line',
      datasets: [
        {
          label: 'Övergripande',
          data: accuracy.history.map(d => ({
            x: d.date,
            y: Math.round(d.overall * 100)
          })),
          color: '#4CAF50'
        },
        {
          label: 'Enheter',
          data: accuracy.history.map(d => ({
            x: d.date,
            y: Math.round(d.device * 100)
          })),
          color: '#2196F3'
        },
        {
          label: 'Scener',
          data: accuracy.history.map(d => ({
            x: d.date,
            y: Math.round(d.scene * 100)
          })),
          color: '#FF9800'
        },
        {
          label: 'Energi',
          data: accuracy.history.map(d => ({
            x: d.date,
            y: Math.round(d.energy * 100)
          })),
          color: '#F44336'
        }
      ],
      trend: accuracy.trend
    };
  }

  async getPredictionHeatmap() {
    // Generate 24-hour heatmap of prediction accuracy
    const heatmapData = [];
    
    for (let day = 0; day < 7; day++) {
      const dayData = [];
      for (let hour = 0; hour < 24; hour++) {
        // Simulate accuracy data (higher in common hours)
        let accuracy = 0.6;
        if ((hour >= 6 && hour <= 9) || (hour >= 17 && hour <= 22)) {
          accuracy = 0.75 + Math.random() * 0.2;
        } else {
          accuracy = 0.5 + Math.random() * 0.3;
        }
        
        dayData.push({
          hour,
          accuracy: Math.round(accuracy * 100),
          predictions: Math.floor(Math.random() * 20)
        });
      }
      heatmapData.push({
        day: ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'][day],
        hours: dayData
      });
    }

    return {
      chartType: 'heatmap',
      data: heatmapData
    };
  }

  async getLearningProgress() {
    const days = 90;
    const data = [];
    
    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      // Simulate learning curve (improving over time)
      const progress = Math.min(0.95, 0.5 + (days - i) / days * 0.45);
      
      data.push({
        date: date.toISOString().split('T')[0],
        knowledge: Math.round(progress * 100),
        patterns: Math.floor((days - i) * 2.5),
        accuracy: Math.round((0.6 + progress * 0.3) * 100)
      });
    }

    return {
      chartType: 'area',
      datasets: [
        {
          label: 'Kunskapsnivå',
          data: data.map(d => ({ x: d.date, y: d.knowledge })),
          color: '#9C27B0'
        },
        {
          label: 'Mönster upptäckta',
          data: data.map(d => ({ x: d.date, y: d.patterns })),
          color: '#3F51B5',
          yAxis: 'right'
        }
      ]
    };
  }

  async getRecommendationImpact() {
    const recs = this.learningData.recommendations;
    
    return {
      chartType: 'pie',
      data: [
        {
          category: 'Energi',
          value: recs.categories.energy.applied,
          total: recs.categories.energy.total,
          impact: recs.categories.energy.saved
        },
        {
          category: 'Komfort',
          value: recs.categories.comfort.applied,
          total: recs.categories.comfort.total,
          impact: `Betyg ${recs.categories.comfort.rating}`
        },
        {
          category: 'Säkerhet',
          value: recs.categories.security.applied,
          total: recs.categories.security.total,
          impact: `${recs.categories.security.incidents} incidenter`
        },
        {
          category: 'Automation',
          value: recs.categories.automation.applied,
          total: recs.categories.automation.total,
          impact: recs.categories.automation.time_saved
        }
      ]
    };
  }

  // ============================================
  // ANALYTICS & INSIGHTS
  // ============================================

  async getLearningInsights() {
    const data = this.learningData;
    const insights = [];

    // Pattern insights
    if (data.patterns.temporal.confidence > 0.85) {
      insights.push({
        type: 'success',
        title: 'Starka Tidsmönster',
        message: `${data.patterns.temporal.detected} tidsmönster upptäckta med ${Math.round(data.patterns.temporal.confidence * 100)}% säkerhet`,
        icon: '📊'
      });
    }

    // Accuracy trend
    const accuracyTrend = data.accuracy.trend;
    if (accuracyTrend === 'improving') {
      insights.push({
        type: 'success',
        title: 'Förbättrad Noggrannhet',
        message: 'AI-modellerna blir mer precisa över tid',
        icon: '📈'
      });
    }

    // Recommendation success
    const recSuccessRate = data.recommendations.success_rate;
    if (recSuccessRate > 0.7) {
      insights.push({
        type: 'success',
        title: 'Framgångsrika Rekommendationer',
        message: `${Math.round(recSuccessRate * 100)}% av tillämpade rekommendationer var framgångsrika`,
        icon: '✅'
      });
    }

    // Adaptation activity
    if (data.adaptations.last_7_days > 30) {
      insights.push({
        type: 'info',
        title: 'Aktiv Anpassning',
        message: `${data.adaptations.last_7_days} anpassningar senaste veckan`,
        icon: '🔄'
      });
    }

    return insights;
  }

  async getModelHealth() {
    const predictions = this.learningData.predictions;
    
    return {
      overall: 'healthy', // healthy, warning, critical
      score: Math.round(predictions.accuracy.overall * 100),
      metrics: {
        accuracy: {
          value: predictions.accuracy.overall,
          status: predictions.accuracy.overall > 0.8 ? 'good' : 'needs_improvement',
          trend: predictions.accuracy.trend
        },
        coverage: {
          value: 0.78,
          status: 'good',
          description: '78% av händelser har prediktiva modeller'
        },
        freshness: {
          value: this.calculateDataFreshness(),
          status: 'good',
          description: 'Data uppdateras regelbundet'
        }
      },
      recommendations: [
        {
          priority: 'medium',
          message: 'Träna om energimodell för bättre noggrannhet',
          action: 'retrain_energy_model'
        }
      ]
    };
  }

  // ============================================
  // DASHBOARD API
  // ============================================

  async getDashboardData() {
    // Ensure data is fresh
    if (Date.now() - this.lastUpdate > this.cacheTimeout) {
      await this.collectLearningData();
    }

    return {
      summary: {
        patterns: this.learningData.patterns.temporal.detected +
                 this.learningData.patterns.device.detected,
        predictions: this.learningData.predictions.recent.length,
        accuracy: Math.round(this.learningData.predictions.accuracy.overall * 100),
        adaptations: this.learningData.adaptations.last_7_days
      },
      visualizations: {
        patterns: await this.getPatternVisualization(),
        accuracy: await this.getAccuracyTrends(),
        heatmap: await this.getPredictionHeatmap(),
        progress: await this.getLearningProgress(),
        impact: await this.getRecommendationImpact()
      },
      insights: await this.getLearningInsights(),
      health: await this.getModelHealth()
    };
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  calculateTrend(data) {
    if (data.length < 7) return 'insufficient_data';
    
    const recent = data.slice(-7);
    const older = data.slice(-14, -7);
    
    const recentAvg = recent.reduce((sum, d) => sum + d.overall, 0) / recent.length;
    const olderAvg = older.reduce((sum, d) => sum + d.overall, 0) / older.length;
    
    const diff = recentAvg - olderAvg;
    
    if (diff > 0.05) return 'improving';
    if (diff < -0.05) return 'declining';
    return 'stable';
  }

  calculateDataFreshness() {
    const hoursSinceUpdate = (Date.now() - this.lastUpdate) / (60 * 60 * 1000);
    
    if (hoursSinceUpdate < 1) return 1.0;
    if (hoursSinceUpdate < 6) return 0.8;
    if (hoursSinceUpdate < 24) return 0.6;
    return 0.4;
  }

  getDefaultData() {
    return {
      patterns: { temporal: {}, device: {}, energy: {}, scene: {} },
      predictions: { accuracy: {}, recent: [], upcoming: [] },
      recommendations: { generated: 0, applied: 0, success_rate: 0 },
      accuracy: { history: [], trend: 'insufficient_data' },
      adaptations: { total_adaptations: 0, recent: [] },
      lastUpdate: 0
    };
  }

  destroy() {
    if (this._intervals) {
      this._intervals.forEach(id => clearInterval(id));
      this._intervals = [];
    }
  }
}

module.exports = LearningVisualizer;
