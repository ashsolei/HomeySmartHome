'use strict';

/**
 * Anomaly Detection AI
 * Detects unusual patterns and anomalies in device behavior and home activity
 */
class AnomalyDetectionAI {
  constructor(app) {
    this._intervals = [];
    this.app = app;
    this.baselines = new Map();
    this.anomalies = [];
    this.patterns = new Map();
    this.alertThresholds = {
      low: 0.3,
      medium: 0.5,
      high: 0.7,
      critical: 0.9
    };
  }

  async initialize() {
    // Load baseline patterns
    await this.loadBaselines();
    
    // Start monitoring
    this.startMonitoring();
    
    // Start learning
    this.startLearning();
  }

  // ============================================
  // BASELINE LEARNING
  // ============================================

  async loadBaselines() {
    // Energy consumption baselines
    this.baselines.set('energy', {
      hourly: new Array(24).fill(0).map((_, hour) => ({
        hour,
        average: this.getTypicalEnergyForHour(hour),
        stdDev: 0.5,
        min: 0,
        max: 10
      })),
      daily: { average: 25, stdDev: 5, min: 15, max: 40 },
      weekly: { average: 175, stdDev: 20, min: 120, max: 250 }
    });

    // Temperature baselines
    this.baselines.set('temperature', {
      rooms: {
        living_room: { average: 21, stdDev: 1, min: 18, max: 24 },
        bedroom: { average: 19, stdDev: 1, min: 16, max: 22 },
        kitchen: { average: 20, stdDev: 1.5, min: 18, max: 25 },
        bathroom: { average: 22, stdDev: 2, min: 18, max: 26 },
        office: { average: 21, stdDev: 1, min: 19, max: 23 }
      }
    });

    // Device usage baselines
    this.baselines.set('devices', {
      lights: {
        dailyActivations: { average: 15, stdDev: 5 },
        typicalOnDuration: 180, // minutes
        peakHours: [6, 7, 8, 18, 19, 20, 21, 22]
      },
      heating: {
        dailyCycles: { average: 4, stdDev: 2 },
        typicalOnDuration: 120,
        peakHours: [6, 7, 18, 19, 20, 21]
      },
      appliances: {
        dailyActivations: { average: 8, stdDev: 3 },
        unusualHours: [0, 1, 2, 3, 4, 5]
      }
    });

    // Motion/presence baselines
    this.baselines.set('presence', {
      rooms: {
        living_room: {
          typicalHours: [7, 8, 18, 19, 20, 21, 22],
          averageDuration: 120,
          maxDuration: 480
        },
        bedroom: {
          typicalHours: [22, 23, 0, 1, 2, 3, 4, 5, 6, 7],
          averageDuration: 480,
          maxDuration: 720
        },
        office: {
          typicalHours: [9, 10, 11, 12, 13, 14, 15, 16],
          averageDuration: 60,
          maxDuration: 480
        }
      }
    });

    // Door/window baselines
    this.baselines.set('access', {
      dailyOpenings: { average: 12, stdDev: 4 },
      typicalHours: [6, 7, 8, 17, 18, 19],
      unusualHours: [0, 1, 2, 3, 4],
      maxOpenDuration: 60 // minutes
    });
  }

  getTypicalEnergyForHour(hour) {
    // Simulate typical energy consumption pattern
    if (hour >= 0 && hour <= 5) return 0.5; // Night - low usage
    if (hour >= 6 && hour <= 8) return 2.5; // Morning peak
    if (hour >= 9 && hour <= 16) return 1.2; // Day - moderate
    if (hour >= 17 && hour <= 22) return 3.0; // Evening peak
    return 1.0; // Late evening
  }

  // ============================================
  // MONITORING
  // ============================================

  startMonitoring() {
    // Check for anomalies every minute
    this._intervals.push(setInterval(() => {
      this.checkEnergyAnomalies();
      this.checkTemperatureAnomalies();
      this.checkDeviceAnomalies();
      this.checkPresenceAnomalies();
      this.checkAccessAnomalies();
    }, 60 * 1000));

    // Initial check
    this.checkEnergyAnomalies();
  }

  startLearning() {
    // Update baselines every hour
    this._intervals.push(setInterval(() => {
      this.updateBaselines();
    }, 60 * 60 * 1000));
  }

  // ============================================
  // ENERGY ANOMALY DETECTION
  // ============================================

  async checkEnergyAnomalies() {
    const currentHour = new Date().getHours();
    const baseline = this.baselines.get('energy').hourly[currentHour];
    
    // Simulate current consumption
    const currentConsumption = this.simulateCurrentEnergy(currentHour);
    
    // Calculate z-score (standard deviations from mean)
    const zScore = Math.abs(currentConsumption - baseline.average) / baseline.stdDev;
    
    if (zScore > 2.5) { // More than 2.5 standard deviations
      const severity = this.calculateSeverity(zScore, 2.5, 4);
      
      this.reportAnomaly({
        type: 'energy',
        category: 'consumption',
        severity,
        title: 'Ovanlig energiförbrukning',
        description: `Energiförbrukningen är ${currentConsumption.toFixed(1)} kWh/h, normalt ${baseline.average.toFixed(1)} kWh/h`,
        value: currentConsumption,
        expected: baseline.average,
        deviation: zScore,
        timestamp: Date.now(),
        recommendations: this.getEnergyRecommendations(currentConsumption, baseline)
      });
    }
  }

  simulateCurrentEnergy(hour) {
    const baseline = this.getTypicalEnergyForHour(hour);
    
    // Add some randomness
    const random = (Math.random() - 0.5) * 0.4;
    
    // Occasionally create an anomaly
    if (Math.random() < 0.05) {
      return baseline * (1.5 + Math.random());
    }
    
    return baseline + random;
  }

  getEnergyRecommendations(current, baseline) {
    const recommendations = [];
    
    if (current > baseline.average * 1.5) {
      recommendations.push('Kontrollera om alla apparater är nödvändiga');
      recommendations.push('Kolla efter apparater som står i standby');
      recommendations.push('Verifiera värmesystemets inställningar');
    }
    
    if (current > baseline.average * 2) {
      recommendations.push('⚠️ Möjlig defekt apparat - kontrollera omedelbart');
    }
    
    return recommendations;
  }

  // ============================================
  // TEMPERATURE ANOMALY DETECTION
  // ============================================

  async checkTemperatureAnomalies() {
    const tempBaselines = this.baselines.get('temperature').rooms;
    
    for (const [room, baseline] of Object.entries(tempBaselines)) {
      const currentTemp = this.simulateRoomTemperature(room);
      
      const zScore = Math.abs(currentTemp - baseline.average) / baseline.stdDev;
      
      if (zScore > 2.0) {
        const severity = this.calculateSeverity(zScore, 2.0, 3.5);
        
        this.reportAnomaly({
          type: 'temperature',
          category: 'climate',
          room,
          severity,
          title: `Ovanlig temperatur i ${this.getRoomName(room)}`,
          description: `Temperaturen är ${currentTemp.toFixed(1)}°C, normalt ${baseline.average}°C`,
          value: currentTemp,
          expected: baseline.average,
          deviation: zScore,
          timestamp: Date.now(),
          recommendations: this.getTemperatureRecommendations(currentTemp, baseline, room)
        });
      }
    }
  }

  simulateRoomTemperature(room) {
    const baseline = this.baselines.get('temperature').rooms[room];
    
    // Normal variation
    const random = (Math.random() - 0.5) * 0.6;
    
    // Occasional anomaly
    if (Math.random() < 0.03) {
      return baseline.average + (Math.random() > 0.5 ? 4 : -4) + random;
    }
    
    return baseline.average + random;
  }

  getTemperatureRecommendations(temp, baseline, _room) {
    const recommendations = [];
    
    if (temp > baseline.average + 2) {
      recommendations.push('Kontrollera att fönster är stängda');
      recommendations.push('Verifiera värmeelement');
      recommendations.push('Kolla ventilationssystem');
    } else if (temp < baseline.average - 2) {
      recommendations.push('Kontrollera att dörrar/fönster är stängda');
      recommendations.push('Verifiera termostatinställningar');
      recommendations.push('Kolla isolering');
    }
    
    return recommendations;
  }

  // ============================================
  // DEVICE ANOMALY DETECTION
  // ============================================

  async checkDeviceAnomalies() {
    const deviceBaselines = this.baselines.get('devices');
    const currentHour = new Date().getHours();
    
    // Check for unusual device activity
    for (const [deviceType, baseline] of Object.entries(deviceBaselines)) {
      // Simulate device activations
      const activations = this.simulateDeviceActivity(deviceType, currentHour);
      
      // Check if unusual for this hour
      if (deviceType === 'appliances' && baseline.unusualHours.includes(currentHour)) {
        if (activations > 0) {
          this.reportAnomaly({
            type: 'device',
            category: 'usage',
            deviceType,
            severity: 'medium',
            title: 'Ovanlig apparatanvändning',
            description: `${this.getDeviceTypeName(deviceType)} används vid ovanlig tid (${currentHour}:00)`,
            timestamp: Date.now(),
            recommendations: [
              'Verifiera att ingen ovanlig aktivitet pågår',
              'Kontrollera att inga apparater är på av misstag'
            ]
          });
        }
      }
    }
  }

  simulateDeviceActivity(deviceType, hour) {
    const baseline = this.baselines.get('devices')[deviceType];
    
    // Check if peak hour
    if (baseline.peakHours?.includes(hour)) {
      return Math.random() < 0.7 ? 1 : 0;
    }
    
    // Check if unusual hour
    if (baseline.unusualHours?.includes(hour)) {
      return Math.random() < 0.05 ? 1 : 0; // Rarely active
    }
    
    return Math.random() < 0.3 ? 1 : 0;
  }

  // ============================================
  // PRESENCE ANOMALY DETECTION
  // ============================================

  async checkPresenceAnomalies() {
    const presenceBaselines = this.baselines.get('presence').rooms;
    const currentHour = new Date().getHours();
    
    for (const [room, baseline] of Object.entries(presenceBaselines)) {
      const isPresent = this.simulatePresence(room, currentHour);
      const isTypicalHour = baseline.typicalHours.includes(currentHour);
      
      // Presence at unusual time
      if (isPresent && !isTypicalHour) {
        this.reportAnomaly({
          type: 'presence',
          category: 'activity',
          room,
          severity: 'low',
          title: `Ovanlig aktivitet i ${this.getRoomName(room)}`,
          description: `Aktivitet detekterad vid ovanlig tid (${currentHour}:00)`,
          timestamp: Date.now(),
          recommendations: [
            'Verifiera att allt är normalt',
            'Kontrollera säkerhetssystem'
          ]
        });
      }
      
      // Extended presence
      const duration = this.simulatePresenceDuration(room);
      if (duration > baseline.maxDuration) {
        this.reportAnomaly({
          type: 'presence',
          category: 'duration',
          room,
          severity: 'medium',
          title: `Lång vistelse i ${this.getRoomName(room)}`,
          description: `Person har varit i rummet i ${Math.round(duration)} minuter`,
          value: duration,
          expected: baseline.averageDuration,
          timestamp: Date.now(),
          recommendations: [
            'Verifiera att personen mår bra',
            'Kolla om sensorn fastnat'
          ]
        });
      }
    }
  }

  simulatePresence(room, hour) {
    const baseline = this.baselines.get('presence').rooms[room];
    
    if (baseline.typicalHours.includes(hour)) {
      return Math.random() < 0.6;
    }
    
    return Math.random() < 0.1;
  }

  simulatePresenceDuration(room) {
    const baseline = this.baselines.get('presence').rooms[room];
    
    // Occasionally return extended duration
    if (Math.random() < 0.02) {
      return baseline.maxDuration + Math.random() * 120;
    }
    
    return baseline.averageDuration + (Math.random() - 0.5) * 60;
  }

  // ============================================
  // ACCESS ANOMALY DETECTION
  // ============================================

  async checkAccessAnomalies() {
    const accessBaseline = this.baselines.get('access');
    const currentHour = new Date().getHours();
    
    // Simulate door/window opening
    const opened = Math.random() < 0.05;
    
    if (opened && accessBaseline.unusualHours.includes(currentHour)) {
      this.reportAnomaly({
        type: 'access',
        category: 'security',
        severity: 'high',
        title: 'Dörr/fönster öppnad vid ovanlig tid',
        description: `Åtkomst detekterad klockan ${currentHour}:${new Date().getMinutes()}`,
        timestamp: Date.now(),
        recommendations: [
          '⚠️ Kontrollera säkerheten omedelbart',
          'Verifiera att det är auktoriserad åtkomst',
          'Granska säkerhetskameror'
        ],
        priority: 'urgent'
      });
    }
  }

  // ============================================
  // PATTERN ANALYSIS
  // ============================================

  async analyzePatterns() {
    const patterns = {
      energy: this.analyzeEnergyPatterns(),
      usage: this.analyzeUsagePatterns(),
      temporal: this.analyzeTemporalPatterns()
    };

    return patterns;
  }

  analyzeEnergyPatterns() {
    return {
      trend: 'stable', // 'increasing', 'decreasing', 'stable'
      variance: 'normal', // 'low', 'normal', 'high'
      peakShifts: [], // Unusual changes in peak times
      anomalyRate: this.calculateAnomalyRate('energy')
    };
  }

  analyzeUsagePatterns() {
    return {
      deviceUsageChange: 'normal',
      newPatterns: [],
      disappearedPatterns: [],
      anomalyRate: this.calculateAnomalyRate('device')
    };
  }

  analyzeTemporalPatterns() {
    return {
      scheduleAdherence: 0.85, // How well actual matches expected
      routineStrength: 0.75, // How consistent routines are
      predictability: 0.80 // How predictable behavior is
    };
  }

  calculateAnomalyRate(type) {
    const recentAnomalies = this.anomalies
      .filter(a => a.type === type)
      .filter(a => Date.now() - a.timestamp < 24 * 60 * 60 * 1000);
    
    return recentAnomalies.length / 24; // Anomalies per hour
  }

  // ============================================
  // ANOMALY MANAGEMENT
  // ============================================

  reportAnomaly(anomaly) {
    // Add unique ID
    anomaly.id = `anomaly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    anomaly.acknowledged = false;
    anomaly.resolved = false;
    
    // Store anomaly
    this.anomalies.push(anomaly);

    // Log
    console.log(`🚨 Anomaly detected: ${anomaly.title}`);
    console.log(`   Severity: ${anomaly.severity}`);
    console.log(`   ${anomaly.description}`);

    // Trigger alerts based on severity
    if (anomaly.severity === 'high' || anomaly.severity === 'critical') {
      this.triggerAlert(anomaly);
    }

    // Trim old anomalies
    if (this.anomalies.length > 1000) {
      this.anomalies = this.anomalies.slice(-1000);
    }

    return anomaly;
  }

  async acknowledgeAnomaly(anomalyId) {
    const anomaly = this.anomalies.find(a => a.id === anomalyId);
    
    if (!anomaly) {
      return { success: false, error: 'Anomaly not found' };
    }

    anomaly.acknowledged = true;
    anomaly.acknowledgedAt = Date.now();

    return { success: true, anomaly };
  }

  async resolveAnomaly(anomalyId, resolution) {
    const anomaly = this.anomalies.find(a => a.id === anomalyId);
    
    if (!anomaly) {
      return { success: false, error: 'Anomaly not found' };
    }

    anomaly.resolved = true;
    anomaly.resolvedAt = Date.now();
    anomaly.resolution = resolution;

    return { success: true, anomaly };
  }

  triggerAlert(anomaly) {
    // Send notification through notification system
    console.log(`📢 ALERT: ${anomaly.title}`);
    
    // In production: integrate with notification system
    // this.app.notifications.send({
    //   title: anomaly.title,
    //   message: anomaly.description,
    //   priority: anomaly.severity,
    //   category: 'anomaly'
    // });
  }

  // ============================================
  // UTILITIES
  // ============================================

  calculateSeverity(zScore, lowThreshold, highThreshold) {
    if (zScore >= highThreshold) return 'critical';
    if (zScore >= (lowThreshold + highThreshold) / 2) return 'high';
    if (zScore >= lowThreshold) return 'medium';
    return 'low';
  }

  getRoomName(roomId) {
    const names = {
      living_room: 'Vardagsrummet',
      bedroom: 'Sovrummet',
      kitchen: 'Köket',
      bathroom: 'Badrummet',
      office: 'Kontoret'
    };
    return names[roomId] || roomId;
  }

  getDeviceTypeName(deviceType) {
    const names = {
      lights: 'Belysning',
      heating: 'Uppvärmning',
      appliances: 'Apparater'
    };
    return names[deviceType] || deviceType;
  }

  updateBaselines() {
    console.log('Updating baselines based on recent data...');
    
    // In production: Analyze historical data and update baselines
    // This would use machine learning to adapt to changing patterns
  }

  // ============================================
  // API & REPORTING
  // ============================================

  getActiveAnomalies() {
    return this.anomalies
      .filter(a => !a.resolved)
      .sort((a, b) => {
        // Sort by severity, then timestamp
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
        return severityDiff !== 0 ? severityDiff : b.timestamp - a.timestamp;
      });
  }

  getRecentAnomalies(hours = 24) {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    
    return this.anomalies
      .filter(a => a.timestamp >= cutoff)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  getAnomalyStats() {
    const total = this.anomalies.length;
    const active = this.anomalies.filter(a => !a.resolved).length;
    const last24h = this.getRecentAnomalies(24).length;
    
    return {
      total,
      active,
      last24h,
      bySeverity: {
        critical: this.anomalies.filter(a => a.severity === 'critical' && !a.resolved).length,
        high: this.anomalies.filter(a => a.severity === 'high' && !a.resolved).length,
        medium: this.anomalies.filter(a => a.severity === 'medium' && !a.resolved).length,
        low: this.anomalies.filter(a => a.severity === 'low' && !a.resolved).length
      },
      byType: {
        energy: this.anomalies.filter(a => a.type === 'energy' && !a.resolved).length,
        temperature: this.anomalies.filter(a => a.type === 'temperature' && !a.resolved).length,
        device: this.anomalies.filter(a => a.type === 'device' && !a.resolved).length,
        presence: this.anomalies.filter(a => a.type === 'presence' && !a.resolved).length,
        access: this.anomalies.filter(a => a.type === 'access' && !a.resolved).length
      },
      resolutionRate: total > 0 ? this.anomalies.filter(a => a.resolved).length / total : 0
    };
  }

  getAnomalyTrends() {
    const last7days = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const dayStart = date.getTime();
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;
      
      const dayAnomalies = this.anomalies.filter(a => 
        a.timestamp >= dayStart && a.timestamp < dayEnd
      );
      
      last7days.push({
        date: date.toISOString().split('T')[0],
        count: dayAnomalies.length,
        bySeverity: {
          critical: dayAnomalies.filter(a => a.severity === 'critical').length,
          high: dayAnomalies.filter(a => a.severity === 'high').length,
          medium: dayAnomalies.filter(a => a.severity === 'medium').length,
          low: dayAnomalies.filter(a => a.severity === 'low').length
        }
      });
    }
    
    return last7days;
  }

  destroy() {
    if (this._intervals) {
      this._intervals.forEach(id => clearInterval(id));
      this._intervals = [];
    }
  }
}

module.exports = AnomalyDetectionAI;
