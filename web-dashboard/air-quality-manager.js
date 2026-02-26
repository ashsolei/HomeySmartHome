'use strict';

/**
 * Air Quality Manager
 * Monitors and optimizes indoor air quality
 */
class AirQualityManager {
  constructor(app) {
    this._intervals = [];
    this.app = app;
    this.sensors = new Map();
    this.rooms = new Map();
    this.measurements = [];
    this.alerts = [];
    this.ventilationDevices = new Map();
    
    // WHO Air Quality Guidelines
    this.thresholds = {
      co2: {
        excellent: 400,
        good: 600,
        fair: 1000,
        poor: 1400,
        bad: 2000
      },
      pm25: {
        excellent: 5,
        good: 12,
        fair: 25,
        poor: 50,
        bad: 75
      },
      pm10: {
        excellent: 10,
        good: 25,
        fair: 50,
        poor: 75,
        bad: 100
      },
      voc: {
        excellent: 220,
        good: 660,
        fair: 1430,
        poor: 2200,
        bad: 5500
      },
      humidity: {
        min: 30,
        ideal_min: 40,
        ideal_max: 60,
        max: 70
      },
      temperature: {
        min: 18,
        ideal_min: 20,
        ideal_max: 23,
        max: 26
      }
    };
  }

  async initialize() {
    // Load sensors
    await this.loadSensors();
    
    // Load rooms
    await this.loadRooms();
    
    // Load ventilation devices
    await this.loadVentilationDevices();
    
    // Start monitoring
    this.startMonitoring();
  }

  // ============================================
  // SENSOR MANAGEMENT
  // ============================================

  async loadSensors() {
    const sensorConfigs = [
      {
        id: 'aq_living',
        name: 'Vardagsrum - Luftkvalitet',
        room: 'living_room',
        capabilities: ['co2', 'pm25', 'pm10', 'voc', 'temperature', 'humidity']
      },
      {
        id: 'aq_bedroom',
        name: 'Sovrum - Luftkvalitet',
        room: 'bedroom',
        capabilities: ['co2', 'temperature', 'humidity']
      },
      {
        id: 'aq_kitchen',
        name: 'Kök - Luftkvalitet',
        room: 'kitchen',
        capabilities: ['co2', 'pm25', 'voc', 'humidity']
      },
      {
        id: 'aq_office',
        name: 'Kontor - Luftkvalitet',
        room: 'office',
        capabilities: ['co2', 'pm25', 'voc', 'temperature', 'humidity']
      },
      {
        id: 'aq_bathroom',
        name: 'Badrum - Luftkvalitet',
        room: 'bathroom',
        capabilities: ['humidity', 'temperature']
      }
    ];

    for (const config of sensorConfigs) {
      this.sensors.set(config.id, {
        ...config,
        status: 'active',
        lastReading: null,
        lastUpdate: 0
      });
    }
  }

  async loadRooms() {
    const roomConfigs = [
      {
        id: 'living_room',
        name: 'Vardagsrum',
        area: 35, // m²
        volume: 87.5, // m³
        occupants: 0,
        windows: 3,
        ventilation: 'mechanical'
      },
      {
        id: 'bedroom',
        name: 'Sovrum',
        area: 18,
        volume: 45,
        occupants: 0,
        windows: 2,
        ventilation: 'natural'
      },
      {
        id: 'kitchen',
        name: 'Kök',
        area: 15,
        volume: 37.5,
        occupants: 0,
        windows: 1,
        ventilation: 'exhaust'
      },
      {
        id: 'office',
        name: 'Kontor',
        area: 12,
        volume: 30,
        occupants: 0,
        windows: 1,
        ventilation: 'mechanical'
      },
      {
        id: 'bathroom',
        name: 'Badrum',
        area: 6,
        volume: 15,
        occupants: 0,
        windows: 0,
        ventilation: 'exhaust'
      }
    ];

    for (const config of roomConfigs) {
      this.rooms.set(config.id, {
        ...config,
        airQuality: {
          score: 100,
          status: 'excellent',
          issues: []
        },
        lastVentilation: 0,
        ventilationActive: false
      });
    }
  }

  async loadVentilationDevices() {
    this.ventilationDevices.set('fan_living', {
      id: 'fan_living',
      name: 'Fläkt Vardagsrum',
      room: 'living_room',
      type: 'mechanical',
      capacity: 150, // m³/h
      status: 'off',
      speed: 0,
      autoMode: true
    });

    this.ventilationDevices.set('fan_kitchen', {
      id: 'fan_kitchen',
      name: 'Köksfläkt',
      room: 'kitchen',
      type: 'exhaust',
      capacity: 200,
      status: 'off',
      speed: 0,
      autoMode: true
    });

    this.ventilationDevices.set('fan_bathroom', {
      id: 'fan_bathroom',
      name: 'Badrumsfläkt',
      room: 'bathroom',
      type: 'exhaust',
      capacity: 100,
      status: 'off',
      speed: 0,
      autoMode: true
    });

    this.ventilationDevices.set('fan_office', {
      id: 'fan_office',
      name: 'Fläkt Kontor',
      room: 'office',
      type: 'mechanical',
      capacity: 120,
      status: 'off',
      speed: 0,
      autoMode: true
    });
  }

  // ============================================
  // MONITORING
  // ============================================

  startMonitoring() {
    // Update readings every minute
    this._intervals.push(setInterval(() => {
      this.updateAllReadings();
    }, 60 * 1000));

    // Calculate air quality scores every 2 minutes
    this._intervals.push(setInterval(() => {
      this.calculateAirQualityScores();
    }, 2 * 60 * 1000));

    // Check for alerts every minute
    this._intervals.push(setInterval(() => {
      this.checkAlerts();
    }, 60 * 1000));

    // Auto-ventilation control every 3 minutes
    this._intervals.push(setInterval(() => {
      this.autoVentilationControl();
    }, 3 * 60 * 1000));

    // Initial updates
    this.updateAllReadings();
    this.calculateAirQualityScores();
  }

  async updateAllReadings() {
    const hour = new Date().getHours();
    
    for (const [sensorId, sensor] of this.sensors) {
      const room = this.rooms.get(sensor.room);
      
      const reading = {
        timestamp: Date.now(),
        sensorId,
        room: sensor.room
      };

      // Simulate readings based on room and time
      if (sensor.capabilities.includes('co2')) {
        reading.co2 = this.simulateCO2(sensor.room, hour, room.occupants);
      }
      
      if (sensor.capabilities.includes('pm25')) {
        reading.pm25 = this.simulatePM25(sensor.room, hour);
      }
      
      if (sensor.capabilities.includes('pm10')) {
        reading.pm10 = reading.pm25 ? reading.pm25 * 2 : null;
      }
      
      if (sensor.capabilities.includes('voc')) {
        reading.voc = this.simulateVOC(sensor.room, hour);
      }
      
      if (sensor.capabilities.includes('temperature')) {
        reading.temperature = this.simulateTemperature(sensor.room, hour);
      }
      
      if (sensor.capabilities.includes('humidity')) {
        reading.humidity = this.simulateHumidity(sensor.room, hour);
      }

      // Update sensor
      sensor.lastReading = reading;
      sensor.lastUpdate = Date.now();

      // Store measurement
      this.measurements.push(reading);
    }

    // Trim old measurements (keep 24 hours)
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    this.measurements = this.measurements.filter(m => m.timestamp >= dayAgo);
  }

  simulateCO2(roomId, hour, occupants) {
    let base = 400; // Outdoor CO2
    
    // Increase based on occupancy
    base += occupants * 300;
    
    // Office higher during work hours
    if (roomId === 'office' && hour >= 9 && hour <= 17) {
      base += 400;
    }
    
    // Living room higher in evening
    if (roomId === 'living_room' && hour >= 18 && hour <= 23) {
      base += 300;
    }
    
    // Bedroom higher at night
    if (roomId === 'bedroom' && (hour >= 23 || hour <= 6)) {
      base += 500;
    }
    
    // Add random variation
    const variation = (Math.random() - 0.5) * 100;
    
    return Math.max(400, base + variation);
  }

  simulatePM25(roomId, hour) {
    let base = 5; // Good air quality
    
    // Kitchen higher during cooking
    if (roomId === 'kitchen' && (hour >= 7 && hour <= 8 || hour >= 17 && hour <= 19)) {
      base = 15 + Math.random() * 20;
    }
    
    // Living room slightly higher when occupied
    if (roomId === 'living_room' && hour >= 18 && hour <= 23) {
      base = 8 + Math.random() * 5;
    }
    
    return base;
  }

  simulateVOC(roomId, hour) {
    let base = 200; // Low VOC
    
    // Kitchen higher during cooking
    if (roomId === 'kitchen' && (hour >= 7 && hour <= 8 || hour >= 17 && hour <= 19)) {
      base = 500 + Math.random() * 300;
    }
    
    // Office - cleaning products in morning
    if (roomId === 'office' && hour >= 8 && hour <= 9) {
      base = 400 + Math.random() * 200;
    }
    
    return base + (Math.random() - 0.5) * 50;
  }

  simulateTemperature(roomId, _hour) {
    const base = 21;
    
    // Slight variation by room
    const roomOffset = {
      living_room: 0,
      bedroom: -1,
      kitchen: 1,
      office: 0.5,
      bathroom: 1
    };
    
    return base + (roomOffset[roomId] || 0) + (Math.random() - 0.5) * 0.5;
  }

  simulateHumidity(roomId, hour) {
    let base = 45;
    
    // Bathroom higher after shower
    if (roomId === 'bathroom' && (hour >= 6 && hour <= 8 || hour >= 21 && hour <= 23)) {
      base = 65 + Math.random() * 10;
    }
    
    // Kitchen higher during cooking
    if (roomId === 'kitchen' && (hour >= 17 && hour <= 19)) {
      base = 55 + Math.random() * 5;
    }
    
    return base + (Math.random() - 0.5) * 5;
  }

  // ============================================
  // AIR QUALITY SCORING
  // ============================================

  calculateAirQualityScores() {
    for (const [roomId, room] of this.rooms) {
      const sensor = this.getSensorForRoom(roomId);
      
      if (!sensor || !sensor.lastReading) continue;

      const reading = sensor.lastReading;
      const scores = [];
      const issues = [];

      // CO2 score
      if (reading.co2) {
        const co2Score = this.scoreCO2(reading.co2);
        scores.push(co2Score.score);
        if (co2Score.issue) issues.push(co2Score.issue);
      }

      // PM2.5 score
      if (reading.pm25) {
        const pm25Score = this.scorePM25(reading.pm25);
        scores.push(pm25Score.score);
        if (pm25Score.issue) issues.push(pm25Score.issue);
      }

      // VOC score
      if (reading.voc) {
        const vocScore = this.scoreVOC(reading.voc);
        scores.push(vocScore.score);
        if (vocScore.issue) issues.push(vocScore.issue);
      }

      // Humidity score
      if (reading.humidity) {
        const humidityScore = this.scoreHumidity(reading.humidity);
        scores.push(humidityScore.score);
        if (humidityScore.issue) issues.push(humidityScore.issue);
      }

      // Temperature score
      if (reading.temperature) {
        const tempScore = this.scoreTemperature(reading.temperature);
        scores.push(tempScore.score);
        if (tempScore.issue) issues.push(tempScore.issue);
      }

      // Calculate overall score (weighted average)
      const overallScore = scores.length > 0 
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 100;

      room.airQuality = {
        score: overallScore,
        status: this.getQualityStatus(overallScore),
        issues,
        lastUpdate: Date.now()
      };
    }
  }

  scoreCO2(value) {
    const t = this.thresholds.co2;
    
    if (value <= t.excellent) return { score: 100, issue: null };
    if (value <= t.good) return { score: 85, issue: null };
    if (value <= t.fair) return { score: 70, issue: { type: 'co2', severity: 'low', value } };
    if (value <= t.poor) return { score: 50, issue: { type: 'co2', severity: 'medium', value } };
    if (value <= t.bad) return { score: 30, issue: { type: 'co2', severity: 'high', value } };
    return { score: 10, issue: { type: 'co2', severity: 'critical', value } };
  }

  scorePM25(value) {
    const t = this.thresholds.pm25;
    
    if (value <= t.excellent) return { score: 100, issue: null };
    if (value <= t.good) return { score: 85, issue: null };
    if (value <= t.fair) return { score: 70, issue: { type: 'pm25', severity: 'low', value } };
    if (value <= t.poor) return { score: 50, issue: { type: 'pm25', severity: 'medium', value } };
    if (value <= t.bad) return { score: 30, issue: { type: 'pm25', severity: 'high', value } };
    return { score: 10, issue: { type: 'pm25', severity: 'critical', value } };
  }

  scoreVOC(value) {
    const t = this.thresholds.voc;
    
    if (value <= t.excellent) return { score: 100, issue: null };
    if (value <= t.good) return { score: 85, issue: null };
    if (value <= t.fair) return { score: 70, issue: { type: 'voc', severity: 'low', value } };
    if (value <= t.poor) return { score: 50, issue: { type: 'voc', severity: 'medium', value } };
    if (value <= t.bad) return { score: 30, issue: { type: 'voc', severity: 'high', value } };
    return { score: 10, issue: { type: 'voc', severity: 'critical', value } };
  }

  scoreHumidity(value) {
    const t = this.thresholds.humidity;
    
    if (value >= t.ideal_min && value <= t.ideal_max) return { score: 100, issue: null };
    if (value >= t.min && value <= t.max) return { score: 85, issue: null };
    
    if (value < t.min) {
      return { score: 60, issue: { type: 'humidity_low', severity: 'medium', value } };
    } else {
      return { score: 60, issue: { type: 'humidity_high', severity: 'medium', value } };
    }
  }

  scoreTemperature(value) {
    const t = this.thresholds.temperature;
    
    if (value >= t.ideal_min && value <= t.ideal_max) return { score: 100, issue: null };
    if (value >= t.min && value <= t.max) return { score: 85, issue: null };
    
    return { score: 70, issue: { type: 'temperature', severity: 'low', value } };
  }

  getQualityStatus(score) {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'fair';
    if (score >= 40) return 'poor';
    return 'bad';
  }

  // ============================================
  // ALERTS
  // ============================================

  checkAlerts() {
    const newAlerts = [];

    for (const [roomId, room] of this.rooms) {
      for (const issue of room.airQuality.issues) {
        if (issue.severity === 'high' || issue.severity === 'critical') {
          newAlerts.push({
            id: `alert_${Date.now()}_${roomId}_${issue.type}`,
            room: roomId,
            roomName: room.name,
            issue: issue.type,
            severity: issue.severity,
            value: issue.value,
            message: this.getAlertMessage(issue, room.name),
            recommendations: this.getRecommendations(issue, roomId),
            timestamp: Date.now(),
            acknowledged: false
          });
        }
      }
    }

    // Add new alerts
    for (const alert of newAlerts) {
      // Check if similar alert already exists
      const existing = this.alerts.find(a => 
        !a.acknowledged && a.room === alert.room && a.issue === alert.issue
      );
      
      if (!existing) {
        this.alerts.push(alert);
        console.log(`🚨 Air Quality Alert: ${alert.message}`);
      }
    }

    // Trim old alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }
  }

  getAlertMessage(issue, roomName) {
    const messages = {
      co2: `Höga CO2-nivåer i ${roomName}: ${Math.round(issue.value)} ppm`,
      pm25: `Höga partikelnivåer (PM2.5) i ${roomName}: ${Math.round(issue.value)} μg/m³`,
      voc: `Höga VOC-nivåer i ${roomName}: ${Math.round(issue.value)} ppb`,
      humidity_high: `För hög luftfuktighet i ${roomName}: ${Math.round(issue.value)}%`,
      humidity_low: `För låg luftfuktighet i ${roomName}: ${Math.round(issue.value)}%`
    };
    
    return messages[issue.type] || `Luftkvalitetsproblem i ${roomName}`;
  }

  getRecommendations(issue, _roomId) {
    const recommendations = [];
    
    switch (issue.type) {
      case 'co2':
        recommendations.push('Öppna fönster för ventilation');
        recommendations.push('Aktivera mekanisk ventilation');
        recommendations.push('Minska antal personer i rummet');
        break;
      
      case 'pm25':
        recommendations.push('Aktivera luftrenare');
        recommendations.push('Undvik dammalstrande aktiviteter');
        recommendations.push('Kontrollera ventilationsfilter');
        break;
      
      case 'voc':
        recommendations.push('Öka ventilationen');
        recommendations.push('Identifiera VOC-källa (nya möbler, färg, städprodukter)');
        recommendations.push('Använd naturliga rengöringsprodukter');
        break;
      
      case 'humidity_high':
        recommendations.push('Aktivera avfuktare');
        recommendations.push('Öka ventilationen');
        recommendations.push('Kontrollera fuktskador');
        break;
      
      case 'humidity_low':
        recommendations.push('Använd luftfuktare');
        recommendations.push('Placera ut vattenskålar');
        recommendations.push('Sänk rumstemperaturen något');
        break;
    }
    
    return recommendations;
  }

  // ============================================
  // VENTILATION CONTROL
  // ============================================

  async autoVentilationControl() {
    for (const [deviceId, device] of this.ventilationDevices) {
      if (!device.autoMode) continue;

      const room = this.rooms.get(device.room);
      const sensor = this.getSensorForRoom(device.room);
      
      if (!room || !sensor || !sensor.lastReading) continue;

      const reading = sensor.lastReading;
      let shouldActivate = false;
      let requiredSpeed = 0;

      // Check CO2
      if (reading.co2 && reading.co2 > this.thresholds.co2.fair) {
        shouldActivate = true;
        requiredSpeed = Math.max(requiredSpeed, reading.co2 > this.thresholds.co2.poor ? 3 : 2);
      }

      // Check PM2.5
      if (reading.pm25 && reading.pm25 > this.thresholds.pm25.fair) {
        shouldActivate = true;
        requiredSpeed = Math.max(requiredSpeed, reading.pm25 > this.thresholds.pm25.poor ? 3 : 2);
      }

      // Check humidity (bathroom and kitchen)
      if ((device.room === 'bathroom' || device.room === 'kitchen') && reading.humidity) {
        if (reading.humidity > this.thresholds.humidity.max) {
          shouldActivate = true;
          requiredSpeed = Math.max(requiredSpeed, 3);
        }
      }

      // Control device
      if (shouldActivate && device.status === 'off') {
        await this.activateVentilation(deviceId, requiredSpeed);
      } else if (!shouldActivate && device.status === 'on') {
        await this.deactivateVentilation(deviceId);
      } else if (shouldActivate && device.speed !== requiredSpeed) {
        await this.setVentilationSpeed(deviceId, requiredSpeed);
      }
    }
  }

  async activateVentilation(deviceId, speed = 2) {
    const device = this.ventilationDevices.get(deviceId);
    
    if (!device) return;

    device.status = 'on';
    device.speed = speed;
    
    const room = this.rooms.get(device.room);
    room.ventilationActive = true;
    room.lastVentilation = Date.now();

    console.log(`✓ Activated ${device.name} at speed ${speed}`);
  }

  async deactivateVentilation(deviceId) {
    const device = this.ventilationDevices.get(deviceId);
    
    if (!device) return;

    device.status = 'off';
    device.speed = 0;
    
    const room = this.rooms.get(device.room);
    room.ventilationActive = false;

    console.log(`✓ Deactivated ${device.name}`);
  }

  async setVentilationSpeed(deviceId, speed) {
    const device = this.ventilationDevices.get(deviceId);
    
    if (!device) return;

    device.speed = speed;
    
    console.log(`✓ Set ${device.name} to speed ${speed}`);
  }

  // ============================================
  // UTILITIES
  // ============================================

  getSensorForRoom(roomId) {
    return Array.from(this.sensors.values()).find(s => s.room === roomId);
  }

  // ============================================
  // API & REPORTING
  // ============================================

  getOverallStatus() {
    const rooms = Array.from(this.rooms.values());
    const scores = rooms.map(r => r.airQuality.score);
    
    return {
      averageScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      status: this.getQualityStatus(Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)),
      roomsExcellent: rooms.filter(r => r.airQuality.status === 'excellent').length,
      roomsGood: rooms.filter(r => r.airQuality.status === 'good').length,
      roomsFair: rooms.filter(r => r.airQuality.status === 'fair').length,
      roomsPoor: rooms.filter(r => r.airQuality.status === 'poor').length,
      roomsBad: rooms.filter(r => r.airQuality.status === 'bad').length,
      activeAlerts: this.alerts.filter(a => !a.acknowledged).length,
      activeVentilation: Array.from(this.ventilationDevices.values()).filter(d => d.status === 'on').length
    };
  }

  getRoomStatus(roomId) {
    const room = this.rooms.get(roomId);
    const sensor = this.getSensorForRoom(roomId);
    
    if (!room) return null;

    return {
      room: {
        id: room.id,
        name: room.name,
        area: room.area,
        volume: room.volume
      },
      airQuality: room.airQuality,
      currentReadings: sensor?.lastReading || null,
      ventilation: {
        active: room.ventilationActive,
        lastActivation: room.lastVentilation
      },
      alerts: this.alerts.filter(a => a.room === roomId && !a.acknowledged)
    };
  }

  getAllRoomsStatus() {
    return Array.from(this.rooms.values()).map(room => ({
      id: room.id,
      name: room.name,
      score: room.airQuality.score,
      status: room.airQuality.status,
      issues: room.airQuality.issues.length,
      ventilationActive: room.ventilationActive
    }));
  }

  getActiveAlerts() {
    return this.alerts
      .filter(a => !a.acknowledged)
      .sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });
  }

  async acknowledgeAlert(alertId) {
    const alert = this.alerts.find(a => a.id === alertId);
    
    if (!alert) {
      return { success: false, error: 'Alert not found' };
    }

    alert.acknowledged = true;
    alert.acknowledgedAt = Date.now();

    return { success: true };
  }

  getVentilationStatus() {
    return Array.from(this.ventilationDevices.values()).map(device => ({
      id: device.id,
      name: device.name,
      room: device.room,
      status: device.status,
      speed: device.speed,
      autoMode: device.autoMode,
      capacity: device.capacity
    }));
  }

  async setVentilationAutoMode(deviceId, enabled) {
    const device = this.ventilationDevices.get(deviceId);
    
    if (!device) {
      return { success: false, error: 'Device not found' };
    }

    device.autoMode = enabled;

    return { success: true, device: { id: device.id, autoMode: device.autoMode } };
  }

  getHistoricalData(roomId, hours = 24) {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    
    return this.measurements
      .filter(m => m.room === roomId && m.timestamp >= cutoff)
      .map(m => ({
        timestamp: m.timestamp,
        co2: m.co2,
        pm25: m.pm25,
        voc: m.voc,
        temperature: m.temperature,
        humidity: m.humidity
      }));
  }

  getRecommendationsForRoom(roomId) {
    const room = this.rooms.get(roomId);
    
    if (!room || room.airQuality.issues.length === 0) {
      return [];
    }

    const recommendations = [];
    
    for (const issue of room.airQuality.issues) {
      recommendations.push(...this.getRecommendations(issue, roomId));
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }

  destroy() {
    if (this._intervals) {
      this._intervals.forEach(id => clearInterval(id));
      this._intervals = [];
    }
  }
}

module.exports = AirQualityManager;
