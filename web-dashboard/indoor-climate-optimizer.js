'use strict';

/**
 * Indoor Climate Optimizer
 * Advanced HVAC control and air quality management
 */
class IndoorClimateOptimizer {
  constructor(app) {
    this._intervals = [];
    this._timeouts = [];
    this.app = app;
    this.rooms = new Map();
    this.hvacZones = new Map();
    this.sensors = new Map();
    this.schedules = new Map();
    this.climateHistory = [];
    this.preferences = new Map();
  }

  async initialize() {
    await this.setupRooms();
    await this.setupHVACZones();
    await this.setupSensors();
    await this.setupSchedules();
    await this.loadPreferences();
    
    this.startMonitoring();
  }

  // ============================================
  // ROOM CONFIGURATION
  // ============================================

  async setupRooms() {
    const roomData = [
      {
        id: 'living_room',
        name: 'Vardagsrum',
        area: 35, // m²
        volume: 87.5, // m³
        windows: 2,
        occupancy: 0,
        hvacZone: 'main_floor',
        targetTemp: 21,
        targetHumidity: 45
      },
      {
        id: 'kitchen',
        name: 'Kök',
        area: 18,
        volume: 45,
        windows: 1,
        occupancy: 0,
        hvacZone: 'main_floor',
        targetTemp: 20,
        targetHumidity: 50
      },
      {
        id: 'bedroom_master',
        name: 'Sovrum',
        area: 22,
        volume: 55,
        windows: 2,
        occupancy: 0,
        hvacZone: 'upstairs',
        targetTemp: 18,
        targetHumidity: 45
      },
      {
        id: 'bedroom_child',
        name: 'Barnrum',
        area: 15,
        volume: 37.5,
        windows: 1,
        occupancy: 0,
        hvacZone: 'upstairs',
        targetTemp: 19,
        targetHumidity: 45
      },
      {
        id: 'bathroom',
        name: 'Badrum',
        area: 8,
        volume: 20,
        windows: 1,
        occupancy: 0,
        hvacZone: 'main_floor',
        targetTemp: 22,
        targetHumidity: 55
      },
      {
        id: 'office',
        name: 'Kontor',
        area: 12,
        volume: 30,
        windows: 1,
        occupancy: 0,
        hvacZone: 'upstairs',
        targetTemp: 21,
        targetHumidity: 45
      },
      {
        id: 'basement',
        name: 'Källare',
        area: 40,
        volume: 88,
        windows: 2,
        occupancy: 0,
        hvacZone: 'basement',
        targetTemp: 19,
        targetHumidity: 50
      }
    ];

    for (const room of roomData) {
      this.rooms.set(room.id, {
        ...room,
        currentTemp: 20 + Math.random() * 2,
        currentHumidity: 40 + Math.random() * 10,
        currentCO2: 400 + Math.random() * 200,
        currentVOC: 100 + Math.random() * 50,
        airQuality: 'good',
        lastUpdated: Date.now()
      });
    }
  }

  // ============================================
  // HVAC ZONES
  // ============================================

  async setupHVACZones() {
    const zoneData = [
      {
        id: 'main_floor',
        name: 'Bottenvåning',
        rooms: ['living_room', 'kitchen', 'bathroom'],
        heatingCapacity: 5000, // watts
        coolingCapacity: 3500,
        ventilationRate: 150, // m³/h
        currentMode: 'heat',
        currentPower: 0,
        enabled: true
      },
      {
        id: 'upstairs',
        name: 'Övervåning',
        rooms: ['bedroom_master', 'bedroom_child', 'office'],
        heatingCapacity: 4000,
        coolingCapacity: 2800,
        ventilationRate: 120,
        currentMode: 'heat',
        currentPower: 0,
        enabled: true
      },
      {
        id: 'basement',
        name: 'Källare',
        rooms: ['basement'],
        heatingCapacity: 2500,
        coolingCapacity: 1500,
        ventilationRate: 80,
        currentMode: 'heat',
        currentPower: 0,
        enabled: true
      }
    ];

    for (const zone of zoneData) {
      this.hvacZones.set(zone.id, {
        ...zone,
        fanSpeed: 'auto',
        targetTemp: 21,
        energyUsed: 0,
        runtime: 0
      });
    }
  }

  async updateHVACZone(zoneId, updates) {
    const zone = this.hvacZones.get(zoneId);
    
    if (!zone) {
      return { success: false, error: 'Zone not found' };
    }

    Object.assign(zone, updates);

    console.log(`🌡️ Updated HVAC zone ${zone.name}: ${JSON.stringify(updates)}`);

    return { success: true, zone };
  }

  // ============================================
  // SENSORS
  // ============================================

  async setupSensors() {
    for (const [roomId, room] of this.rooms) {
      const sensorId = `sensor_${roomId}`;
      
      this.sensors.set(sensorId, {
        id: sensorId,
        roomId,
        roomName: room.name,
        types: ['temperature', 'humidity', 'co2', 'voc', 'pressure'],
        lastReading: Date.now(),
        batteryLevel: 100
      });
    }
  }

  async updateSensorReadings() {
    for (const [_roomId, room] of this.rooms) {
      // Get HVAC zone influence
      const zone = this.hvacZones.get(room.hvacZone);
      
      // Simulate temperature drift
      let tempChange = 0;
      
      if (zone && zone.enabled && zone.currentPower > 0) {
        if (zone.currentMode === 'heat') {
          tempChange = (zone.currentPower / zone.heatingCapacity) * 0.1;
        } else if (zone.currentMode === 'cool') {
          tempChange = -(zone.currentPower / zone.coolingCapacity) * 0.1;
        }
      } else {
        // Natural drift toward outdoor temp (assume 5°C outdoor)
        const outdoorTemp = 5;
        tempChange = (outdoorTemp - room.currentTemp) * 0.01;
      }

      room.currentTemp += tempChange;

      // Simulate humidity changes
      const humidityChange = (45 - room.currentHumidity) * 0.02 + (Math.random() - 0.5) * 0.5;
      room.currentHumidity = Math.max(20, Math.min(80, room.currentHumidity + humidityChange));

      // CO2 increases with occupancy
      if (room.occupancy > 0) {
        room.currentCO2 += room.occupancy * 10;
      } else {
        room.currentCO2 -= 20; // Ventilation reduces CO2
      }
      room.currentCO2 = Math.max(400, Math.min(2000, room.currentCO2));

      // VOC levels
      room.currentVOC = 100 + Math.random() * 50;

      // Calculate air quality
      room.airQuality = this.calculateAirQuality(room);

      room.lastUpdated = Date.now();
    }

    // Log climate data
    this.logClimateData();
  }

  calculateAirQuality(room) {
    let score = 100;

    // Temperature comfort (18-24°C ideal)
    if (room.currentTemp < 18 || room.currentTemp > 24) {
      score -= 10;
    }

    // Humidity (30-60% ideal)
    if (room.currentHumidity < 30 || room.currentHumidity > 60) {
      score -= 10;
    }

    // CO2 levels
    if (room.currentCO2 > 1000) score -= 15;
    if (room.currentCO2 > 1500) score -= 25;

    // VOC levels
    if (room.currentVOC > 300) score -= 10;
    if (room.currentVOC > 500) score -= 20;

    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'moderate';
    if (score >= 20) return 'poor';
    return 'unhealthy';
  }

  // ============================================
  // CLIMATE CONTROL
  // ============================================

  async optimizeClimate() {
    console.log('🌡️ Optimizing climate...');

    for (const [_zoneId, zone] of this.hvacZones) {
      if (!zone.enabled) continue;

      // Get all rooms in zone
      const zoneRooms = zone.rooms.map(rid => this.rooms.get(rid)).filter(r => r);

      if (zoneRooms.length === 0) continue;

      // Calculate average current temp and target
      const avgCurrentTemp = zoneRooms.reduce((sum, r) => sum + r.currentTemp, 0) / zoneRooms.length;
      const avgTargetTemp = zoneRooms.reduce((sum, r) => sum + r.targetTemp, 0) / zoneRooms.length;

      const tempDiff = avgTargetTemp - avgCurrentTemp;

      // Determine mode and power
      if (Math.abs(tempDiff) < 0.5) {
        // Temperature OK, minimal power
        zone.currentPower = 0;
        zone.fanSpeed = 'low';
      } else if (tempDiff > 0) {
        // Need heating
        zone.currentMode = 'heat';
        zone.currentPower = Math.min(zone.heatingCapacity, Math.abs(tempDiff) * 1000);
        zone.fanSpeed = tempDiff > 2 ? 'high' : 'medium';
      } else {
        // Need cooling
        zone.currentMode = 'cool';
        zone.currentPower = Math.min(zone.coolingCapacity, Math.abs(tempDiff) * 800);
        zone.fanSpeed = tempDiff < -2 ? 'high' : 'medium';
      }

      // Check for high CO2 - increase ventilation
      const maxCO2 = Math.max(...zoneRooms.map(r => r.currentCO2));
      if (maxCO2 > 1000) {
        zone.fanSpeed = 'high';
        console.log(`  💨 Increased ventilation in ${zone.name} (CO2: ${Math.round(maxCO2)} ppm)`);
      }

      // Track energy usage (kWh)
      zone.energyUsed += (zone.currentPower / 1000) * (5 / 60); // 5 min interval
      zone.runtime += zone.currentPower > 0 ? 5 : 0; // minutes
    }
  }

  async setRoomTarget(roomId, temperature, humidity = null) {
    const room = this.rooms.get(roomId);
    
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    room.targetTemp = temperature;
    if (humidity !== null) {
      room.targetHumidity = humidity;
    }

    console.log(`🎯 ${room.name}: Target ${temperature}°C${humidity ? `, ${humidity}%` : ''}`);

    // Trigger immediate optimization
    await this.optimizeClimate();

    return { success: true, room };
  }

  // ============================================
  // SCHEDULES
  // ============================================

  async setupSchedules() {
    const scheduleData = [
      {
        id: 'weekday_morning',
        name: 'Vardagsmorgon',
        enabled: true,
        days: [1, 2, 3, 4, 5], // Mon-Fri
        time: '06:00',
        actions: [
          { room: 'bedroom_master', temp: 20 },
          { room: 'bedroom_child', temp: 20 },
          { room: 'bathroom', temp: 23 },
          { room: 'kitchen', temp: 21 }
        ]
      },
      {
        id: 'weekday_day',
        name: 'Vardagsdag',
        enabled: true,
        days: [1, 2, 3, 4, 5],
        time: '08:00',
        actions: [
          { room: 'living_room', temp: 20 },
          { room: 'bedroom_master', temp: 18 },
          { room: 'bedroom_child', temp: 18 }
        ]
      },
      {
        id: 'weekday_evening',
        name: 'Vardagskväll',
        enabled: true,
        days: [1, 2, 3, 4, 5],
        time: '17:00',
        actions: [
          { room: 'living_room', temp: 22 },
          { room: 'kitchen', temp: 21 },
          { room: 'bedroom_master', temp: 19 },
          { room: 'bedroom_child', temp: 19 }
        ]
      },
      {
        id: 'night',
        name: 'Natt',
        enabled: true,
        days: [0, 1, 2, 3, 4, 5, 6],
        time: '22:00',
        actions: [
          { room: 'living_room', temp: 19 },
          { room: 'kitchen', temp: 18 },
          { room: 'bedroom_master', temp: 18 },
          { room: 'bedroom_child', temp: 18 }
        ]
      },
      {
        id: 'weekend_morning',
        name: 'Helgmorgon',
        enabled: true,
        days: [0, 6], // Sun, Sat
        time: '08:00',
        actions: [
          { room: 'bedroom_master', temp: 20 },
          { room: 'bedroom_child', temp: 20 }
        ]
      }
    ];

    for (const schedule of scheduleData) {
      this.schedules.set(schedule.id, {
        ...schedule,
        lastRun: null,
        nextRun: this.calculateNextRun(schedule)
      });
    }
  }

  calculateNextRun(schedule) {
    const now = new Date();
    const [hours, minutes] = schedule.time.split(':').map(Number);
    
    for (let i = 0; i < 7; i++) {
      const next = new Date(now);
      next.setDate(now.getDate() + i);
      next.setHours(hours, minutes, 0, 0);
      
      if (next > now && schedule.days.includes(next.getDay())) {
        return next.getTime();
      }
    }
    
    return null;
  }

  async executeSchedule(scheduleId) {
    const schedule = this.schedules.get(scheduleId);
    
    if (!schedule || !schedule.enabled) return;

    console.log(`📅 Executing schedule: ${schedule.name}`);

    for (const action of schedule.actions) {
      await this.setRoomTarget(action.room, action.temp, action.humidity);
    }

    schedule.lastRun = Date.now();
    schedule.nextRun = this.calculateNextRun(schedule);
  }

  async checkSchedules() {
    const now = Date.now();

    for (const [scheduleId, schedule] of this.schedules) {
      if (schedule.enabled && schedule.nextRun && now >= schedule.nextRun) {
        await this.executeSchedule(scheduleId);
      }
    }
  }

  // ============================================
  // PREFERENCES & COMFORT
  // ============================================

  async loadPreferences() {
    // User comfort preferences
    this.preferences.set('comfort_mode', {
      tempTolerance: 0.5, // °C
      humidityTolerance: 5, // %
      prioritizeEfficiency: true,
      nightModeEnabled: true,
      ecoModeEnabled: false
    });

    this.preferences.set('air_quality', {
      maxCO2: 1000, // ppm
      maxVOC: 300, // ppb
      minVentilation: 0.5 // air changes per hour
    });
  }

  async setComfortPreference(key, value) {
    const prefs = this.preferences.get('comfort_mode');
    
    if (prefs) {
      prefs[key] = value;
      console.log(`💡 Preference updated: ${key} = ${value}`);
      
      return { success: true };
    }

    return { success: false, error: 'Preferences not found' };
  }

  // ============================================
  // SMART FEATURES
  // ============================================

  async detectOccupancy(roomId, occupantCount) {
    const room = this.rooms.get(roomId);
    
    if (!room) return;

    const previousOccupancy = room.occupancy;
    room.occupancy = occupantCount;

    if (occupantCount > 0 && previousOccupancy === 0) {
      console.log(`👤 ${room.name}: Occupied (${occupantCount} person(s))`);
      
      // Adjust target temperature for comfort
      if (room.targetTemp < 20) {
        await this.setRoomTarget(roomId, 21);
      }
    } else if (occupantCount === 0 && previousOccupancy > 0) {
      console.log(`🚪 ${room.name}: Vacant`);
      
      // Energy saving when vacant
      const prefs = this.preferences.get('comfort_mode');
      if (prefs && prefs.prioritizeEfficiency) {
        await this.setRoomTarget(roomId, room.targetTemp - 1);
      }
    }
  }

  async optimizeForWeather(outdoorTemp, outdoorHumidity) {
    console.log(`🌤️ Outdoor: ${outdoorTemp}°C, ${outdoorHumidity}%`);

    // Adjust indoor targets based on outdoor conditions
    for (const [roomId, room] of this.rooms) {
      let adjustment = 0;

      // If very cold outside, reduce targets slightly to save energy
      if (outdoorTemp < -5) {
        adjustment = -1;
      }

      // If mild outside, can be more comfortable inside
      if (outdoorTemp > 10 && outdoorTemp < 20) {
        adjustment = 0.5;
      }

      if (adjustment !== 0) {
        const newTarget = room.targetTemp + adjustment;
        await this.setRoomTarget(roomId, newTarget);
      }
    }
  }

  async optimizeForEnergyPrice(currentPrice, averagePrice) {
    console.log(`💰 Energy price: ${currentPrice} öre/kWh (avg: ${averagePrice})`);

    const priceRatio = currentPrice / averagePrice;

    if (priceRatio > 1.3) {
      // Very expensive - reduce heating/cooling
      console.log('  ⚠️ High energy price - reducing HVAC usage');
      
      for (const [roomId, room] of this.rooms) {
        await this.setRoomTarget(roomId, room.targetTemp - 1);
      }
    } else if (priceRatio < 0.7) {
      // Very cheap - can be more comfortable
      console.log('  💚 Low energy price - increasing comfort');
      
      for (const [roomId, room] of this.rooms) {
        await this.setRoomTarget(roomId, room.targetTemp + 0.5);
      }
    }
  }

  async preConditionRoom(roomId, minutesFromNow) {
    const room = this.rooms.get(roomId);
    
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    console.log(`⏰ Pre-conditioning ${room.name} in ${minutesFromNow} minutes`);

    // Calculate when to start heating/cooling
    const tempDiff = Math.abs(room.targetTemp - room.currentTemp);
    const timeNeeded = tempDiff * 10; // Rough estimate: 10 min per degree

    const startTime = minutesFromNow - timeNeeded;

    if (startTime > 0) {
      setTimeout(async () => {
        console.log(`🌡️ Starting pre-conditioning for ${room.name}`);
        await this.setRoomTarget(roomId, room.targetTemp);
      }, startTime * 60 * 1000);
    } else {
      // Start now
      await this.setRoomTarget(roomId, room.targetTemp);
    }

    return {
      success: true,
      startTime: startTime > 0 ? `in ${Math.round(startTime)} minutes` : 'now',
      estimatedReady: `in ${Math.round(timeNeeded)} minutes`
    };
  }

  // ============================================
  // MONITORING
  // ============================================

  startMonitoring() {
    // Update sensor readings every 5 minutes
    this._intervals.push(setInterval(() => {
      this.updateSensorReadings();
    }, 5 * 60 * 1000));

    // Optimize climate every 5 minutes
    this._intervals.push(setInterval(() => {
      this.optimizeClimate();
    }, 5 * 60 * 1000));

    // Check schedules every minute
    this._intervals.push(setInterval(() => {
      this.checkSchedules();
    }, 60 * 1000));

    // Check air quality every 10 minutes
    this._intervals.push(setInterval(() => {
      this.checkAirQuality();
    }, 10 * 60 * 1000));

    // Initial run
    this.updateSensorReadings();
    this.optimizeClimate();
  }

  async checkAirQuality() {
    const prefs = this.preferences.get('air_quality');
    
    if (!prefs) return;

    for (const [_roomId, room] of this.rooms) {
      const warnings = [];

      if (room.currentCO2 > prefs.maxCO2) {
        warnings.push(`High CO2: ${Math.round(room.currentCO2)} ppm`);
      }

      if (room.currentVOC > prefs.maxVOC) {
        warnings.push(`High VOC: ${Math.round(room.currentVOC)} ppb`);
      }

      if (warnings.length > 0) {
        console.log(`⚠️ ${room.name}: ${warnings.join(', ')}`);
        console.log(`  💨 Increasing ventilation`);
        
        // Increase ventilation for this zone
        const zone = this.hvacZones.get(room.hvacZone);
        if (zone) {
          zone.fanSpeed = 'high';
        }
      }
    }
  }

  logClimateData() {
    const snapshot = {
      timestamp: Date.now(),
      rooms: {}
    };

    for (const [roomId, room] of this.rooms) {
      snapshot.rooms[roomId] = {
        temp: room.currentTemp,
        humidity: room.currentHumidity,
        co2: room.currentCO2,
        quality: room.airQuality
      };
    }

    this.climateHistory.push(snapshot);

    // Keep last 24 hours (288 entries at 5-min intervals)
    if (this.climateHistory.length > 288) {
      this.climateHistory = this.climateHistory.slice(-288);
    }
  }

  // ============================================
  // REPORTING & ANALYTICS
  // ============================================

  getClimateOverview() {
    const rooms = Array.from(this.rooms.values());
    
    const avgTemp = rooms.reduce((sum, r) => sum + r.currentTemp, 0) / rooms.length;
    const avgHumidity = rooms.reduce((sum, r) => sum + r.currentHumidity, 0) / rooms.length;
    
    const airQualityCount = {
      excellent: 0,
      good: 0,
      moderate: 0,
      poor: 0,
      unhealthy: 0
    };

    for (const room of rooms) {
      airQualityCount[room.airQuality]++;
    }

    const zones = Array.from(this.hvacZones.values());
    const totalEnergyUsed = zones.reduce((sum, z) => sum + z.energyUsed, 0);
    const totalRuntime = zones.reduce((sum, z) => sum + z.runtime, 0);

    return {
      averageTemp: avgTemp.toFixed(1),
      averageHumidity: Math.round(avgHumidity),
      airQualityDistribution: airQualityCount,
      totalRooms: rooms.length,
      hvacZones: zones.length,
      energyUsed: totalEnergyUsed.toFixed(2),
      totalRuntime: Math.round(totalRuntime)
    };
  }

  getRoomDetails(roomId) {
    const room = this.rooms.get(roomId);
    
    if (!room) return null;

    const zone = this.hvacZones.get(room.hvacZone);

    return {
      name: room.name,
      current: {
        temperature: room.currentTemp.toFixed(1),
        humidity: Math.round(room.currentHumidity),
        co2: Math.round(room.currentCO2),
        voc: Math.round(room.currentVOC),
        airQuality: room.airQuality
      },
      target: {
        temperature: room.targetTemp,
        humidity: room.targetHumidity
      },
      occupancy: room.occupancy,
      hvacZone: zone ? zone.name : null,
      hvacMode: zone ? zone.currentMode : null
    };
  }

  getEnergyReport(hours = 24) {
    const zones = Array.from(this.hvacZones.values());
    
    const report = {
      period: `${hours} hours`,
      zones: zones.map(z => ({
        name: z.name,
        energyUsed: z.energyUsed.toFixed(2),
        runtime: Math.round(z.runtime),
        efficiency: z.runtime > 0 ? (z.energyUsed / (z.runtime / 60)).toFixed(2) : 0
      })),
      totalEnergy: zones.reduce((sum, z) => sum + z.energyUsed, 0).toFixed(2),
      estimatedCost: (zones.reduce((sum, z) => sum + z.energyUsed, 0) * 1.8).toFixed(2)
    };

    return report;
  }

  getComfortScore() {
    const rooms = Array.from(this.rooms.values());
    let totalScore = 0;

    for (const room of rooms) {
      let score = 100;

      // Temperature deviation from target
      const tempDiff = Math.abs(room.currentTemp - room.targetTemp);
      score -= tempDiff * 10;

      // Humidity deviation from target
      const humidDiff = Math.abs(room.currentHumidity - room.targetHumidity);
      score -= humidDiff * 2;

      // Air quality impact
      const qualityScores = {
        excellent: 0,
        good: -5,
        moderate: -15,
        poor: -30,
        unhealthy: -50
      };
      score += qualityScores[room.airQuality] || 0;

      totalScore += Math.max(0, score);
    }

    const avgScore = totalScore / rooms.length;

    return {
      score: Math.round(avgScore),
      rating: avgScore >= 90 ? 'excellent' :
              avgScore >= 75 ? 'good' :
              avgScore >= 60 ? 'moderate' :
              avgScore >= 40 ? 'fair' : 'poor'
    };
  }

  getClimateHistory(roomId, hours = 6) {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    const history = this.climateHistory.filter(h => h.timestamp >= cutoff);

    if (!roomId) {
      // Average across all rooms
      return history.map(h => {
        const rooms = Object.values(h.rooms);
        const avgTemp = rooms.reduce((sum, r) => sum + r.temp, 0) / rooms.length;
        const avgHumidity = rooms.reduce((sum, r) => sum + r.humidity, 0) / rooms.length;
        
        return {
          timestamp: h.timestamp,
          temperature: avgTemp.toFixed(1),
          humidity: Math.round(avgHumidity)
        };
      });
    }

    // Specific room
    return history.map(h => ({
      timestamp: h.timestamp,
      ...h.rooms[roomId]
    })).filter(h => h.temp !== undefined);
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

module.exports = IndoorClimateOptimizer;
