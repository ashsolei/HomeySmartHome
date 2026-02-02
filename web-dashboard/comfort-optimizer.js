'use strict';

/**
 * Comfort Optimizer Engine
 * Automatically optimizes home environment for maximum comfort
 */
class ComfortOptimizer {
  constructor(app) {
    this.app = app;
    this.zones = new Map();
    this.comfortProfiles = new Map();
    this.optimizationHistory = [];
    this.preferences = {
      temperature: { min: 19, max: 23, ideal: 21 },
      humidity: { min: 30, max: 60, ideal: 45 },
      lighting: { min: 100, max: 1000, ideal: 500 }, // lux
      airQuality: { co2Max: 1000, pm25Max: 25 },
      noise: { max: 50 } // dB
    };
  }

  async initialize() {
    // Load zones and sensors
    await this.loadZones();
    
    // Load user comfort profiles
    await this.loadComfortProfiles();
    
    // Start comfort monitoring
    this.startComfortMonitoring();
    
    // Start optimization engine
    this.startOptimization();
  }

  // ============================================
  // ZONE MANAGEMENT
  // ============================================

  async loadZones() {
    const zoneConfigs = [
      {
        id: 'living_room',
        name: 'Vardagsrum',
        type: 'living',
        sensors: {
          temperature: 'temp_living',
          humidity: 'humid_living',
          light: 'light_living',
          co2: 'co2_living'
        },
        actuators: {
          heating: 'thermostat_living',
          lighting: ['light_living_1', 'light_living_2'],
          ventilation: 'fan_living',
          blinds: 'blinds_living'
        },
        priority: 'high'
      },
      {
        id: 'bedroom',
        name: 'Sovrum',
        type: 'bedroom',
        sensors: {
          temperature: 'temp_bedroom',
          humidity: 'humid_bedroom',
          light: 'light_bedroom'
        },
        actuators: {
          heating: 'thermostat_bedroom',
          lighting: ['light_bedroom'],
          blinds: 'blinds_bedroom'
        },
        priority: 'high'
      },
      {
        id: 'kitchen',
        name: 'Kök',
        type: 'kitchen',
        sensors: {
          temperature: 'temp_kitchen',
          humidity: 'humid_kitchen',
          co2: 'co2_kitchen'
        },
        actuators: {
          lighting: ['light_kitchen'],
          ventilation: 'fan_kitchen'
        },
        priority: 'medium'
      },
      {
        id: 'bathroom',
        name: 'Badrum',
        type: 'bathroom',
        sensors: {
          temperature: 'temp_bathroom',
          humidity: 'humid_bathroom'
        },
        actuators: {
          heating: 'heater_bathroom',
          ventilation: 'fan_bathroom'
        },
        priority: 'medium'
      },
      {
        id: 'office',
        name: 'Kontor',
        type: 'office',
        sensors: {
          temperature: 'temp_office',
          humidity: 'humid_office',
          light: 'light_office',
          co2: 'co2_office'
        },
        actuators: {
          heating: 'thermostat_office',
          lighting: ['light_office', 'desk_lamp'],
          ventilation: 'fan_office'
        },
        priority: 'high'
      }
    ];

    for (const config of zoneConfigs) {
      this.zones.set(config.id, {
        ...config,
        currentReadings: {},
        comfortScore: 100,
        issues: [],
        lastOptimization: 0
      });
    }
  }

  // ============================================
  // COMFORT MONITORING
  // ============================================

  startComfortMonitoring() {
    // Update readings every 30 seconds
    setInterval(() => {
      this.updateZoneReadings();
    }, 30000);

    // Calculate comfort scores every minute
    setInterval(() => {
      this.calculateComfortScores();
    }, 60000);

    // Initial update
    this.updateZoneReadings();
    this.calculateComfortScores();
  }

  async updateZoneReadings() {
    const hour = new Date().getHours();
    
    for (const [zoneId, zone] of this.zones) {
      // Simulate sensor readings (integrate with actual sensors)
      zone.currentReadings = {
        temperature: this.simulateTemperature(zoneId, hour),
        humidity: this.simulateHumidity(zoneId, hour),
        light: this.simulateLight(zoneId, hour),
        co2: this.simulateCO2(zoneId, hour),
        timestamp: Date.now()
      };
    }
  }

  simulateTemperature(zoneId, hour) {
    const base = 20.5;
    const variance = Math.random() * 2 - 1;
    
    // Bedroom cooler at night
    if (zoneId === 'bedroom' && (hour >= 22 || hour <= 6)) {
      return base - 1.5 + variance;
    }
    
    // Kitchen warmer when cooking
    if (zoneId === 'kitchen' && (hour >= 17 && hour <= 19)) {
      return base + 2 + variance;
    }
    
    return base + variance;
  }

  simulateHumidity(zoneId, hour) {
    const base = 45;
    const variance = Math.random() * 10 - 5;
    
    // Bathroom higher humidity after shower
    if (zoneId === 'bathroom' && (hour >= 6 && hour <= 8)) {
      return base + 15 + variance;
    }
    
    return base + variance;
  }

  simulateLight(zoneId, hour) {
    // Daylight pattern
    if (hour >= 6 && hour <= 8) return 200 + Math.random() * 200;
    if (hour >= 9 && hour <= 16) return 500 + Math.random() * 300;
    if (hour >= 17 && hour <= 18) return 200 + Math.random() * 100;
    return 50 + Math.random() * 50; // Night/artificial light
  }

  simulateCO2(zoneId, hour) {
    const base = 600;
    
    // Office higher during work hours
    if (zoneId === 'office' && hour >= 9 && hour <= 17) {
      return base + 200 + Math.random() * 100;
    }
    
    // Living room higher in evening
    if (zoneId === 'living_room' && hour >= 18 && hour <= 23) {
      return base + 150 + Math.random() * 100;
    }
    
    return base + Math.random() * 100;
  }

  // ============================================
  // COMFORT SCORING
  // ============================================

  calculateComfortScores() {
    for (const [zoneId, zone] of this.zones) {
      const readings = zone.currentReadings;
      const profile = this.getActiveProfile();
      
      let score = 100;
      const issues = [];

      // Temperature score
      const tempScore = this.scoreParameter(
        readings.temperature,
        profile.temperature.min,
        profile.temperature.max,
        profile.temperature.ideal
      );
      score -= (100 - tempScore) * 0.35; // 35% weight
      
      if (tempScore < 80) {
        issues.push({
          type: 'temperature',
          severity: tempScore < 60 ? 'high' : 'medium',
          message: this.getTemperatureIssue(readings.temperature, profile.temperature),
          impact: 100 - tempScore
        });
      }

      // Humidity score
      const humidScore = this.scoreParameter(
        readings.humidity,
        profile.humidity.min,
        profile.humidity.max,
        profile.humidity.ideal
      );
      score -= (100 - humidScore) * 0.25; // 25% weight
      
      if (humidScore < 80) {
        issues.push({
          type: 'humidity',
          severity: humidScore < 60 ? 'high' : 'medium',
          message: this.getHumidityIssue(readings.humidity, profile.humidity),
          impact: 100 - humidScore
        });
      }

      // Light level score (if applicable)
      if (readings.light !== undefined) {
        const hour = new Date().getHours();
        const isActiveHours = hour >= 6 && hour <= 23;
        
        if (isActiveHours) {
          const lightScore = this.scoreParameter(
            readings.light,
            profile.lighting.min,
            profile.lighting.max,
            profile.lighting.ideal
          );
          score -= (100 - lightScore) * 0.20; // 20% weight
          
          if (lightScore < 80) {
            issues.push({
              type: 'lighting',
              severity: 'medium',
              message: this.getLightingIssue(readings.light, profile.lighting),
              impact: 100 - lightScore
            });
          }
        }
      }

      // Air quality score (CO2)
      if (readings.co2 !== undefined) {
        const co2Score = readings.co2 > profile.airQuality.co2Max 
          ? Math.max(0, 100 - (readings.co2 - profile.airQuality.co2Max) / 10)
          : 100;
        score -= (100 - co2Score) * 0.20; // 20% weight
        
        if (co2Score < 80) {
          issues.push({
            type: 'air_quality',
            severity: co2Score < 60 ? 'high' : 'medium',
            message: `Höga CO2-nivåer: ${Math.round(readings.co2)} ppm`,
            impact: 100 - co2Score
          });
        }
      }

      zone.comfortScore = Math.max(0, Math.round(score));
      zone.issues = issues;
    }
  }

  scoreParameter(value, min, max, ideal) {
    if (value >= min && value <= max) {
      // Within acceptable range
      const distanceFromIdeal = Math.abs(value - ideal);
      const maxDistance = Math.max(ideal - min, max - ideal);
      return 100 - (distanceFromIdeal / maxDistance) * 20; // Max -20 points
    } else if (value < min) {
      // Below minimum
      const deficit = min - value;
      return Math.max(0, 80 - deficit * 10);
    } else {
      // Above maximum
      const excess = value - max;
      return Math.max(0, 80 - excess * 10);
    }
  }

  getTemperatureIssue(temp, profile) {
    if (temp < profile.min) {
      return `För kallt: ${temp.toFixed(1)}°C (mål: ${profile.ideal}°C)`;
    } else if (temp > profile.max) {
      return `För varmt: ${temp.toFixed(1)}°C (mål: ${profile.ideal}°C)`;
    } else {
      return `Temperatur inte optimal: ${temp.toFixed(1)}°C`;
    }
  }

  getHumidityIssue(humidity, profile) {
    if (humidity < profile.min) {
      return `För torr luft: ${Math.round(humidity)}% (mål: ${profile.ideal}%)`;
    } else if (humidity > profile.max) {
      return `För fuktig luft: ${Math.round(humidity)}% (mål: ${profile.ideal}%)`;
    } else {
      return `Luftfuktighet inte optimal: ${Math.round(humidity)}%`;
    }
  }

  getLightingIssue(light, profile) {
    if (light < profile.min) {
      return `För mörkt: ${Math.round(light)} lux (rekommenderat: ${profile.ideal} lux)`;
    } else if (light > profile.max) {
      return `För ljust: ${Math.round(light)} lux (rekommenderat: ${profile.ideal} lux)`;
    }
    return `Belysning inte optimal: ${Math.round(light)} lux`;
  }

  // ============================================
  // OPTIMIZATION ENGINE
  // ============================================

  startOptimization() {
    // Run optimization every 5 minutes
    setInterval(() => {
      this.optimizeAllZones();
    }, 5 * 60 * 1000);

    // Initial optimization
    this.optimizeAllZones();
  }

  async optimizeAllZones() {
    const profile = this.getActiveProfile();
    
    for (const [zoneId, zone] of this.zones) {
      // Skip if recently optimized (within 3 minutes)
      if (Date.now() - zone.lastOptimization < 3 * 60 * 1000) continue;
      
      // Only optimize if comfort score is below threshold
      if (zone.comfortScore < 85 && zone.issues.length > 0) {
        await this.optimizeZone(zoneId, profile);
        zone.lastOptimization = Date.now();
      }
    }
  }

  async optimizeZone(zoneId, profile) {
    const zone = this.zones.get(zoneId);
    const actions = [];

    for (const issue of zone.issues) {
      switch (issue.type) {
        case 'temperature':
          actions.push(...this.optimizeTemperature(zone, issue, profile));
          break;
        
        case 'humidity':
          actions.push(...this.optimizeHumidity(zone, issue, profile));
          break;
        
        case 'lighting':
          actions.push(...this.optimizeLighting(zone, issue, profile));
          break;
        
        case 'air_quality':
          actions.push(...this.optimizeAirQuality(zone, issue, profile));
          break;
      }
    }

    // Execute optimization actions
    if (actions.length > 0) {
      await this.executeOptimizationActions(zoneId, actions);
      
      // Log optimization
      this.logOptimization({
        zoneId,
        zoneName: zone.name,
        timestamp: Date.now(),
        comfortScoreBefore: zone.comfortScore,
        issues: zone.issues,
        actions
      });
    }
  }

  optimizeTemperature(zone, issue, profile) {
    const actions = [];
    const currentTemp = zone.currentReadings.temperature;
    const targetTemp = profile.temperature.ideal;

    if (zone.actuators.heating) {
      if (currentTemp < targetTemp) {
        actions.push({
          type: 'heating',
          device: zone.actuators.heating,
          action: 'increase',
          value: Math.min(2, targetTemp - currentTemp),
          reason: 'Öka temperaturen'
        });
      } else if (currentTemp > targetTemp) {
        actions.push({
          type: 'heating',
          device: zone.actuators.heating,
          action: 'decrease',
          value: Math.min(2, currentTemp - targetTemp),
          reason: 'Sänk temperaturen'
        });
      }
    }

    // Use ventilation to cool if too warm
    if (currentTemp > targetTemp + 1 && zone.actuators.ventilation) {
      actions.push({
        type: 'ventilation',
        device: zone.actuators.ventilation,
        action: 'on',
        reason: 'Kyla ner rummet'
      });
    }

    return actions;
  }

  optimizeHumidity(zone, issue, profile) {
    const actions = [];
    const currentHumidity = zone.currentReadings.humidity;

    // High humidity - increase ventilation
    if (currentHumidity > profile.humidity.max && zone.actuators.ventilation) {
      actions.push({
        type: 'ventilation',
        device: zone.actuators.ventilation,
        action: 'on',
        duration: 30, // minutes
        reason: 'Minska luftfuktighet'
      });
    }

    // Low humidity - suggest humidifier (if available)
    if (currentHumidity < profile.humidity.min) {
      actions.push({
        type: 'notification',
        message: `Låg luftfuktighet i ${zone.name}: ${Math.round(currentHumidity)}%`,
        suggestion: 'Överväg att använda luftfuktare',
        reason: 'Öka luftfuktighet'
      });
    }

    return actions;
  }

  optimizeLighting(zone, issue, profile) {
    const actions = [];
    const currentLight = zone.currentReadings.light;
    const targetLight = profile.lighting.ideal;

    if (!zone.actuators.lighting) return actions;

    if (currentLight < targetLight) {
      // Increase lighting
      const brightness = Math.min(1.0, 0.5 + (targetLight - currentLight) / targetLight);
      
      zone.actuators.lighting.forEach(light => {
        actions.push({
          type: 'lighting',
          device: light,
          action: 'dim',
          value: brightness,
          reason: 'Öka belysning'
        });
      });
    } else if (currentLight > targetLight * 1.5) {
      // Decrease lighting if significantly too bright
      const brightness = Math.max(0.3, targetLight / currentLight);
      
      zone.actuators.lighting.forEach(light => {
        actions.push({
          type: 'lighting',
          device: light,
          action: 'dim',
          value: brightness,
          reason: 'Minska belysning'
        });
      });
    }

    // Adjust blinds if available
    if (zone.actuators.blinds) {
      if (currentLight > targetLight * 2) {
        actions.push({
          type: 'blinds',
          device: zone.actuators.blinds,
          action: 'close',
          value: 0.5,
          reason: 'Minska dagsljus'
        });
      }
    }

    return actions;
  }

  optimizeAirQuality(zone, issue, profile) {
    const actions = [];
    const currentCO2 = zone.currentReadings.co2;

    if (currentCO2 > profile.airQuality.co2Max && zone.actuators.ventilation) {
      actions.push({
        type: 'ventilation',
        device: zone.actuators.ventilation,
        action: 'on',
        speed: currentCO2 > 1200 ? 'high' : 'medium',
        duration: 20,
        reason: 'Förbättra luftkvalitet'
      });
    }

    return actions;
  }

  async executeOptimizationActions(zoneId, actions) {
    console.log(`Optimizing zone: ${this.zones.get(zoneId).name}`);
    
    for (const action of actions) {
      console.log(`  → ${action.reason}: ${action.type} ${action.action || ''}`);
      
      // Execute action (integrate with actual device control)
      // await this.app.devices.get(action.device).setCapability(...)
    }
  }

  // ============================================
  // COMFORT PROFILES
  // ============================================

  async loadComfortProfiles() {
    // Default profile
    this.comfortProfiles.set('default', {
      id: 'default',
      name: 'Standard',
      temperature: { min: 19, max: 23, ideal: 21 },
      humidity: { min: 30, max: 60, ideal: 45 },
      lighting: { min: 100, max: 1000, ideal: 500 },
      airQuality: { co2Max: 1000, pm25Max: 25 },
      active: true
    });

    // Sleep profile
    this.comfortProfiles.set('sleep', {
      id: 'sleep',
      name: 'Sömn',
      temperature: { min: 17, max: 20, ideal: 18.5 },
      humidity: { min: 40, max: 60, ideal: 50 },
      lighting: { min: 0, max: 10, ideal: 0 },
      airQuality: { co2Max: 800, pm25Max: 20 },
      active: false
    });

    // Work profile
    this.comfortProfiles.set('work', {
      id: 'work',
      name: 'Arbete',
      temperature: { min: 20, max: 23, ideal: 21.5 },
      humidity: { min: 35, max: 55, ideal: 45 },
      lighting: { min: 300, max: 800, ideal: 500 },
      airQuality: { co2Max: 900, pm25Max: 25 },
      active: false
    });

    // Relax profile
    this.comfortProfiles.set('relax', {
      id: 'relax',
      name: 'Avkoppling',
      temperature: { min: 20, max: 24, ideal: 22 },
      humidity: { min: 40, max: 60, ideal: 50 },
      lighting: { min: 50, max: 300, ideal: 150 },
      airQuality: { co2Max: 1000, pm25Max: 25 },
      active: false
    });
  }

  getActiveProfile() {
    // Check time-based profiles
    const hour = new Date().getHours();
    
    if (hour >= 22 || hour <= 6) {
      return this.comfortProfiles.get('sleep');
    } else if (hour >= 9 && hour <= 17) {
      return this.comfortProfiles.get('work');
    } else if (hour >= 18 && hour <= 21) {
      return this.comfortProfiles.get('relax');
    }
    
    return this.comfortProfiles.get('default');
  }

  async setActiveProfile(profileId) {
    const profile = this.comfortProfiles.get(profileId);
    
    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }

    // Deactivate all profiles
    for (const [id, p] of this.comfortProfiles) {
      p.active = false;
    }

    // Activate selected profile
    profile.active = true;

    // Trigger immediate optimization
    await this.optimizeAllZones();

    return {
      success: true,
      profile: {
        id: profile.id,
        name: profile.name
      }
    };
  }

  // ============================================
  // ANALYTICS & REPORTING
  // ============================================

  async getComfortReport() {
    const zones = Array.from(this.zones.values());
    
    return {
      overall: {
        averageComfort: Math.round(
          zones.reduce((sum, z) => sum + z.comfortScore, 0) / zones.length
        ),
        zonesOptimal: zones.filter(z => z.comfortScore >= 85).length,
        zonesNeedAttention: zones.filter(z => z.comfortScore < 85).length,
        activeIssues: zones.reduce((sum, z) => sum + z.issues.length, 0)
      },
      zones: zones.map(z => ({
        id: z.id,
        name: z.name,
        comfortScore: z.comfortScore,
        readings: z.currentReadings,
        issues: z.issues.length,
        priority: z.priority
      })),
      activeProfile: this.getActiveProfile().name,
      recentOptimizations: this.optimizationHistory.slice(-10)
    };
  }

  async getZoneDetails(zoneId) {
    const zone = this.zones.get(zoneId);
    
    if (!zone) {
      return { error: 'Zone not found' };
    }

    return {
      zone: {
        id: zone.id,
        name: zone.name,
        type: zone.type,
        priority: zone.priority
      },
      comfort: {
        score: zone.comfortScore,
        issues: zone.issues
      },
      readings: zone.currentReadings,
      recommendations: this.getZoneRecommendations(zone),
      history: this.optimizationHistory
        .filter(h => h.zoneId === zoneId)
        .slice(-20)
    };
  }

  getZoneRecommendations(zone) {
    const recommendations = [];
    const profile = this.getActiveProfile();

    for (const issue of zone.issues) {
      if (issue.type === 'temperature') {
        recommendations.push({
          priority: issue.severity,
          title: 'Temperaturjustering',
          description: issue.message,
          actions: ['Justera termostat', 'Kontrollera isolering', 'Stäng/öppna fönster']
        });
      } else if (issue.type === 'humidity') {
        recommendations.push({
          priority: issue.severity,
          title: 'Luftfuktighetsbalans',
          description: issue.message,
          actions: ['Använd luftfuktare/avfuktare', 'Öka ventilation', 'Kontrollera källor']
        });
      } else if (issue.type === 'air_quality') {
        recommendations.push({
          priority: issue.severity,
          title: 'Luftkvalitet',
          description: issue.message,
          actions: ['Öka ventilation', 'Öppna fönster', 'Kontrollera luftfilter']
        });
      }
    }

    return recommendations;
  }

  logOptimization(optimization) {
    this.optimizationHistory.push(optimization);

    // Trim history
    if (this.optimizationHistory.length > 500) {
      this.optimizationHistory = this.optimizationHistory.slice(-500);
    }
  }

  // ============================================
  // PUBLIC API
  // ============================================

  getAllZonesStatus() {
    return Array.from(this.zones.values()).map(z => ({
      id: z.id,
      name: z.name,
      comfortScore: z.comfortScore,
      temperature: z.currentReadings.temperature?.toFixed(1),
      humidity: Math.round(z.currentReadings.humidity),
      issues: z.issues.length,
      status: z.comfortScore >= 85 ? 'optimal' : z.comfortScore >= 70 ? 'good' : 'needs_attention'
    }));
  }

  getComfortScoreSummary() {
    const zones = Array.from(this.zones.values());
    const scores = zones.map(z => z.comfortScore);
    
    return {
      average: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      highest: Math.max(...scores),
      lowest: Math.min(...scores),
      optimal: zones.filter(z => z.comfortScore >= 85).length,
      total: zones.length
    };
  }

  getActiveIssues() {
    const issues = [];
    
    for (const [zoneId, zone] of this.zones) {
      zone.issues.forEach(issue => {
        issues.push({
          zone: zone.name,
          ...issue
        });
      });
    }

    return issues.sort((a, b) => b.impact - a.impact);
  }

  getAvailableProfiles() {
    return Array.from(this.comfortProfiles.values()).map(p => ({
      id: p.id,
      name: p.name,
      active: p.active
    }));
  }
}

module.exports = ComfortOptimizer;
