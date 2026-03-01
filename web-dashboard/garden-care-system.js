'use strict';
const logger = require('./logger');

/**
 * Garden Care System
 * Automated garden watering, soil monitoring, plant care
 */
class GardenCareSystem {
  constructor(app) {
    this._intervals = [];
    this._timeouts = [];
    this.app = app;
    this.zones = new Map();
    this.plants = new Map();
    this.sensors = new Map();
    this.wateringSchedule = new Map();
    this.tasks = [];
  }

  async initialize() {
    await this.loadZones();
    await this.loadPlants();
    await this.loadSensors();
    await this.loadWateringSchedule();
    await this.loadSeasonalTasks();
    
    this.startMonitoring();
  }

  // ============================================
  // GARDEN ZONES
  // ============================================

  async loadZones() {
    const zoneConfigs = [
      {
        id: 'zone_lawn',
        name: 'Gräsmatta',
        type: 'lawn',
        area: 50, // square meters
        sunExposure: 'full', // full, partial, shade
        soilType: 'loam',
        wateringValve: 'valve_1',
        sprinklerHeads: 4
      },
      {
        id: 'zone_flower_front',
        name: 'Blommor fram',
        type: 'flower_bed',
        area: 8,
        sunExposure: 'full',
        soilType: 'enriched',
        wateringValve: 'valve_2',
        dripLines: 2
      },
      {
        id: 'zone_flower_back',
        name: 'Blommor bak',
        type: 'flower_bed',
        area: 12,
        sunExposure: 'partial',
        soilType: 'enriched',
        wateringValve: 'valve_3',
        dripLines: 3
      },
      {
        id: 'zone_vegetables',
        name: 'Grönsaksland',
        type: 'vegetable_garden',
        area: 15,
        sunExposure: 'full',
        soilType: 'enriched',
        wateringValve: 'valve_4',
        dripLines: 4
      },
      {
        id: 'zone_shrubs',
        name: 'Buskar',
        type: 'shrubs',
        area: 10,
        sunExposure: 'partial',
        soilType: 'native',
        wateringValve: 'valve_5',
        dripLines: 2
      }
    ];

    for (const config of zoneConfigs) {
      this.zones.set(config.id, {
        ...config,
        enabled: true,
        lastWatered: null,
        totalWaterUsed: 0 // liters
      });
    }
  }

  // ============================================
  // PLANTS
  // ============================================

  async loadPlants() {
    const plantConfigs = [
      // Vegetables
      {
        id: 'plant_tomato',
        name: 'Tomater',
        species: 'Solanum lycopersicum',
        variety: 'Gardener\'s Delight',
        zone: 'zone_vegetables',
        plantedDate: new Date('2024-05-15').getTime(),
        quantity: 6,
        waterNeeds: 'high',
        sunNeeds: 'full',
        harvestTime: new Date('2024-08-01').getTime()
      },
      {
        id: 'plant_cucumber',
        name: 'Gurka',
        species: 'Cucumis sativus',
        variety: 'Burpless',
        zone: 'zone_vegetables',
        plantedDate: new Date('2024-05-20').getTime(),
        quantity: 4,
        waterNeeds: 'high',
        sunNeeds: 'full',
        harvestTime: new Date('2024-07-15').getTime()
      },
      {
        id: 'plant_lettuce',
        name: 'Sallad',
        species: 'Lactuca sativa',
        variety: 'Mixed',
        zone: 'zone_vegetables',
        plantedDate: new Date('2024-04-01').getTime(),
        quantity: 12,
        waterNeeds: 'medium',
        sunNeeds: 'partial',
        harvestTime: new Date('2024-06-01').getTime()
      },
      // Flowers front
      {
        id: 'plant_roses',
        name: 'Rosor',
        species: 'Rosa',
        variety: 'Hybrid Tea',
        zone: 'zone_flower_front',
        plantedDate: new Date('2023-09-01').getTime(),
        quantity: 8,
        waterNeeds: 'medium',
        sunNeeds: 'full',
        bloomTime: 'June-September'
      },
      {
        id: 'plant_lavender',
        name: 'Lavendel',
        species: 'Lavandula',
        variety: 'Hidcote',
        zone: 'zone_flower_front',
        plantedDate: new Date('2023-09-01').getTime(),
        quantity: 12,
        waterNeeds: 'low',
        sunNeeds: 'full',
        bloomTime: 'July-August'
      },
      // Flowers back
      {
        id: 'plant_hostas',
        name: 'Funkia',
        species: 'Hosta',
        variety: 'Mixed',
        zone: 'zone_flower_back',
        plantedDate: new Date('2022-05-01').getTime(),
        quantity: 10,
        waterNeeds: 'medium',
        sunNeeds: 'shade',
        bloomTime: 'July-August'
      },
      {
        id: 'plant_hydrangea',
        name: 'Hortensia',
        species: 'Hydrangea macrophylla',
        variety: 'Endless Summer',
        zone: 'zone_flower_back',
        plantedDate: new Date('2022-05-01').getTime(),
        quantity: 3,
        waterNeeds: 'high',
        sunNeeds: 'partial',
        bloomTime: 'June-September'
      },
      // Shrubs
      {
        id: 'plant_boxwood',
        name: 'Buxbom',
        species: 'Buxus',
        variety: 'Sempervirens',
        zone: 'zone_shrubs',
        plantedDate: new Date('2021-09-01').getTime(),
        quantity: 15,
        waterNeeds: 'low',
        sunNeeds: 'partial',
        pruneTime: 'June'
      }
    ];

    for (const config of plantConfigs) {
      this.plants.set(config.id, {
        ...config,
        health: 'good',
        notes: []
      });
    }
  }

  // ============================================
  // SOIL SENSORS
  // ============================================

  async loadSensors() {
    // One sensor per zone
    for (const [zoneId, zone] of this.zones) {
      this.sensors.set(`sensor_${zoneId}`, {
        id: `sensor_${zoneId}`,
        zoneId,
        zoneName: zone.name,
        type: 'soil',
        readings: {
          moisture: 0,
          temperature: 0,
          light: 0,
          pH: 7.0
        },
        lastUpdate: null
      });
    }
  }

  // ============================================
  // WATERING SCHEDULE
  // ============================================

  async loadWateringSchedule() {
    // Lawn - every other day, early morning
    await this.createWateringSchedule({
      zoneId: 'zone_lawn',
      schedules: [
        {
          time: '05:00',
          duration: 30, // minutes
          days: [1, 3, 5], // Mon, Wed, Fri
          enabled: true
        }
      ]
    });

    // Front flowers - daily during summer
    await this.createWateringSchedule({
      zoneId: 'zone_flower_front',
      schedules: [
        {
          time: '06:00',
          duration: 15,
          days: [1, 2, 3, 4, 5, 6, 0],
          enabled: true,
          seasonalAdjust: true
        }
      ]
    });

    // Back flowers - daily
    await this.createWateringSchedule({
      zoneId: 'zone_flower_back',
      schedules: [
        {
          time: '06:15',
          duration: 20,
          days: [1, 2, 3, 4, 5, 6, 0],
          enabled: true,
          seasonalAdjust: true
        }
      ]
    });

    // Vegetables - twice daily in summer
    await this.createWateringSchedule({
      zoneId: 'zone_vegetables',
      schedules: [
        {
          time: '06:30',
          duration: 20,
          days: [1, 2, 3, 4, 5, 6, 0],
          enabled: true
        },
        {
          time: '18:00',
          duration: 15,
          days: [1, 2, 3, 4, 5, 6, 0],
          enabled: true,
          seasonalAdjust: true
        }
      ]
    });

    // Shrubs - weekly
    await this.createWateringSchedule({
      zoneId: 'zone_shrubs',
      schedules: [
        {
          time: '06:45',
          duration: 25,
          days: [2, 5], // Tue, Fri
          enabled: true
        }
      ]
    });
  }

  async createWateringSchedule(config) {
    this.wateringSchedule.set(config.zoneId, {
      ...config,
      history: [],
      skipNext: false,
      rainDelay: 0 // hours to delay after rain
    });

    return { success: true };
  }

  // ============================================
  // MONITORING
  // ============================================

  startMonitoring() {
    // Update soil sensors every 15 minutes
    this._intervals.push(setInterval(() => {
      this.updateSensors();
    }, 15 * 60 * 1000));

    // Check watering schedules every minute
    this._intervals.push(setInterval(() => {
      this.checkWateringSchedules();
    }, 60 * 1000));

    // Check weather and adjust schedules hourly
    this._intervals.push(setInterval(() => {
      this.checkWeatherAndAdjust();
    }, 60 * 60 * 1000));

    // Check plant health daily
    this._intervals.push(setInterval(() => {
      this.checkPlantHealth();
    }, 24 * 60 * 60 * 1000));

    // Initial updates
    this.updateSensors();
    this.checkWeatherAndAdjust();
  }

  async updateSensors() {
    for (const [_sensorId, sensor] of this.sensors) {
      // Simulate sensor readings
      const zone = this.zones.get(sensor.zoneId);
      const readings = this.simulateSensorReadings(zone);

      sensor.readings = readings;
      sensor.lastUpdate = Date.now();

      // Check if watering needed based on moisture
      if (readings.moisture < 30) {
        logger.info(`💧 Low moisture in ${sensor.zoneName}: ${readings.moisture}%`);
        
        // Consider triggering watering
        // await this.waterZone(sensor.zoneId, 10); // Quick 10-minute watering
      }
    }
  }

  simulateSensorReadings(zone) {
    const hour = new Date().getHours();
    const month = new Date().getMonth();

    // Base moisture depends on zone type and last watering
    let baseMoisture = 50;
    
    if (zone.lastWatered) {
      const hoursSinceWatering = (Date.now() - zone.lastWatered) / (1000 * 60 * 60);
      baseMoisture = Math.max(20, 80 - hoursSinceWatering * 3); // Dries 3% per hour
    }

    // Temperature varies by time of day and season
    let temperature = 15; // Base temperature
    
    if (month >= 5 && month <= 8) { // Summer
      temperature = 20 + (hour >= 12 && hour <= 16 ? 5 : 0);
    } else if (month >= 11 || month <= 2) { // Winter
      temperature = 5 + (hour >= 12 && hour <= 14 ? 2 : 0);
    }

    // Light depends on sun exposure and time
    let light = 0;
    
    if (hour >= 6 && hour <= 20) {
      const sunIntensity = Math.sin((hour - 6) * Math.PI / 14); // Peak at noon
      
      switch (zone.sunExposure) {
        case 'full':
          light = sunIntensity * 100;
          break;
        case 'partial':
          light = sunIntensity * 60;
          break;
        case 'shade':
          light = sunIntensity * 30;
          break;
      }
    }

    // pH relatively stable
    const pH = 6.5 + Math.random() * 1; // 6.5-7.5

    return {
      moisture: Math.round(baseMoisture + (Math.random() - 0.5) * 10),
      temperature: Math.round(temperature + (Math.random() - 0.5) * 2),
      light: Math.round(light),
      pH: Math.round(pH * 10) / 10
    };
  }

  async checkWateringSchedules() {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const currentDay = now.getDay();
    const month = now.getMonth();

    // Only water during growing season (April-September in Sweden)
    if (month < 3 || month > 9) {
      return; // No watering in winter/early spring
    }

    for (const [zoneId, schedule] of this.wateringSchedule) {
      if (schedule.skipNext) continue;
      if (schedule.rainDelay > 0) {
        schedule.rainDelay--;
        continue;
      }

      for (const wateringTime of schedule.schedules) {
        if (!wateringTime.enabled) continue;
        if (wateringTime.time !== currentTime) continue;
        if (!wateringTime.days.includes(currentDay)) continue;

        // Calculate adjusted duration
        let duration = wateringTime.duration;
        
        if (wateringTime.seasonalAdjust) {
          duration = this.adjustDurationForSeason(duration, month);
        }

        // Start watering
        await this.waterZone(zoneId, duration);
      }
    }
  }

  adjustDurationForSeason(baseDuration, month) {
    // Increase watering in peak summer (June-July)
    if (month === 5 || month === 6) {
      return Math.round(baseDuration * 1.5);
    }
    // Normal watering May, August
    else if (month === 4 || month === 7) {
      return baseDuration;
    }
    // Reduce in early/late season
    else {
      return Math.round(baseDuration * 0.7);
    }
  }

  async waterZone(zoneId, duration) {
    const zone = this.zones.get(zoneId);
    
    if (!zone) {
      return { success: false, error: 'Zone not found' };
    }

    logger.info(`💦 Watering ${zone.name} for ${duration} minutes`);

    // Calculate water usage (approximate)
    let waterUsed;
    
    if (zone.type === 'lawn') {
      waterUsed = zone.area * 4 * (duration / 30); // ~4L per m² per 30 min
    } else {
      waterUsed = zone.area * 2 * (duration / 30); // ~2L per m² per 30 min (drip irrigation)
    }

    zone.lastWatered = Date.now();
    zone.totalWaterUsed += waterUsed;

    // Record in schedule history
    const schedule = this.wateringSchedule.get(zoneId);
    if (schedule) {
      schedule.history.push({
        timestamp: Date.now(),
        duration,
        waterUsed,
        trigger: 'scheduled'
      });

      // Keep last 90 days
      const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
      schedule.history = schedule.history.filter(h => h.timestamp >= cutoff);
    }

    // In production: actually control valve
    // await this.app.devices.get(zone.wateringValve).setCapability('onoff', true);
    // setTimeout(async () => {
    //   await this.app.devices.get(zone.wateringValve).setCapability('onoff', false);
    // }, duration * 60 * 1000);

    return { success: true, waterUsed };
  }

  async checkWeatherAndAdjust() {
    // Simulate weather check
    const weather = {
      rain: Math.random() < 0.2, // 20% chance of rain
      rainAmount: Math.random() * 10, // 0-10mm
      temperature: 15 + Math.random() * 10, // 15-25°C
      forecast: {
        rainNext24h: Math.random() < 0.3,
        expectedRain: Math.random() * 15
      }
    };

    logger.info(`🌤️ Weather check: Rain ${weather.rain ? 'yes' : 'no'}, Temp ${weather.temperature.toFixed(1)}°C`);

    // Skip watering if rain today or forecast
    if (weather.rain && weather.rainAmount > 5) {
      logger.info(`  → Skipping watering due to rain (${weather.rainAmount.toFixed(1)}mm)`);
      
      for (const [_zoneId, schedule] of this.wateringSchedule) {
        schedule.rainDelay = 24; // Skip next 24 hours
      }
    }

    if (weather.forecast.rainNext24h && weather.forecast.expectedRain > 10) {
      logger.info(`  → Rain expected (${weather.forecast.expectedRain.toFixed(1)}mm), delaying watering`);
      
      for (const [_zoneId, schedule] of this.wateringSchedule) {
        schedule.skipNext = true;
      }
    }
  }

  async checkPlantHealth() {
    for (const [_plantId, plant] of this.plants) {
      // Check if harvest time approaching
      if (plant.harvestTime && typeof plant.harvestTime === 'number') {
        const daysUntilHarvest = (plant.harvestTime - Date.now()) / (1000 * 60 * 60 * 24);
        
        if (daysUntilHarvest > 0 && daysUntilHarvest <= 7) {
          logger.info(`🌱 ${plant.name} ready to harvest in ${Math.ceil(daysUntilHarvest)} days`);
        }
      }

      // Check zone moisture
      const sensor = Array.from(this.sensors.values()).find(s => s.zoneId === plant.zone);
      
      if (sensor && sensor.readings.moisture < 30 && plant.waterNeeds === 'high') {
        logger.info(`⚠️ ${plant.name} may need extra water (moisture ${sensor.readings.moisture}%)`);
      }
    }
  }

  // ============================================
  // SEASONAL TASKS
  // ============================================

  async loadSeasonalTasks() {
    const month = new Date().getMonth();

    // Spring tasks (March-May)
    if (month >= 2 && month <= 4) {
      this.tasks.push(
        { task: 'Rensa ogräs från rabatter', priority: 'high', due: new Date(2024, 3, 1) },
        { task: 'Plantera sommarblommor', priority: 'high', due: new Date(2024, 4, 15) },
        { task: 'Gödsel gräsmatta', priority: 'medium', due: new Date(2024, 4, 1) },
        { task: 'Beskär rosenbuskar', priority: 'medium', due: new Date(2024, 3, 15) }
      );
    }

    // Summer tasks (June-August)
    if (month >= 5 && month <= 7) {
      this.tasks.push(
        { task: 'Klipp gräsmattan veckovis', priority: 'high', due: null, recurring: 'weekly' },
        { task: 'Dödplocka blommor', priority: 'medium', due: null, recurring: 'weekly' },
        { task: 'Skörda grönsaker', priority: 'high', due: null, recurring: 'as_needed' }
      );
    }

    // Fall tasks (September-November)
    if (month >= 8 && month <= 10) {
      this.tasks.push(
        { task: 'Räfsa löv', priority: 'high', due: null, recurring: 'weekly' },
        { task: 'Plantera höstlökar', priority: 'medium', due: new Date(2024, 9, 15) },
        { task: 'Förbered trädgård för vintern', priority: 'high', due: new Date(2024, 10, 1) },
        { task: 'Töm och vinterförvara vattensystem', priority: 'high', due: new Date(2024, 10, 15) }
      );
    }

    // Winter tasks (December-February)
    if (month >= 11 || month <= 1) {
      this.tasks.push(
        { task: 'Planera nästa säsongs trädgård', priority: 'low', due: new Date(2025, 1, 1) },
        { task: 'Beställ frön', priority: 'medium', due: new Date(2025, 1, 15) }
      );
    }
  }

  // ============================================
  // ANALYTICS & REPORTING
  // ============================================

  getGardenStatus() {
    return {
      zones: this.zones.size,
      plants: this.plants.size,
      activeZones: Array.from(this.zones.values()).filter(z => z.enabled).length,
      totalWaterUsed: Array.from(this.zones.values()).reduce((sum, z) => sum + z.totalWaterUsed, 0),
      sensorReadings: Array.from(this.sensors.values()).map(s => ({
        zone: s.zoneName,
        moisture: s.readings.moisture,
        temperature: s.readings.temperature
      }))
    };
  }

  getZoneDetails(zoneId) {
    const zone = this.zones.get(zoneId);
    
    if (!zone) return null;

    const sensor = Array.from(this.sensors.values()).find(s => s.zoneId === zoneId);
    const _schedule = this.wateringSchedule.get(zoneId);
    const plants = Array.from(this.plants.values()).filter(p => p.zone === zoneId);

    return {
      ...zone,
      sensor: sensor?.readings,
      nextWatering: this.getNextWatering(zoneId),
      plants: plants.map(p => ({
        name: p.name,
        quantity: p.quantity,
        health: p.health
      })),
      waterUsageThisMonth: this.getMonthlyWaterUsage(zoneId)
    };
  }

  getNextWatering(zoneId) {
    const schedule = this.wateringSchedule.get(zoneId);
    
    if (!schedule) return null;

    const now = new Date();
    const today = now.getDay();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    for (const wateringTime of schedule.schedules) {
      if (!wateringTime.enabled) continue;

      const [hours, minutes] = wateringTime.time.split(':').map(Number);
      const scheduleTime = hours * 60 + minutes;

      for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
        const checkDay = (today + dayOffset) % 7;
        
        if (wateringTime.days.includes(checkDay)) {
          if (dayOffset === 0 && scheduleTime <= currentTime) continue;

          const nextDate = new Date(now);
          nextDate.setDate(nextDate.getDate() + dayOffset);
          nextDate.setHours(hours, minutes, 0, 0);

          return {
            date: nextDate.toLocaleDateString('sv-SE'),
            time: wateringTime.time,
            duration: wateringTime.duration
          };
        }
      }
    }

    return null;
  }

  getMonthlyWaterUsage(zoneId) {
    const schedule = this.wateringSchedule.get(zoneId);
    
    if (!schedule) return 0;

    const _now = Date.now();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    return schedule.history
      .filter(h => h.timestamp >= monthStart.getTime())
      .reduce((sum, h) => sum + h.waterUsed, 0);
  }

  getAllPlants() {
    return Array.from(this.plants.values()).map(p => ({
      id: p.id,
      name: p.name,
      variety: p.variety,
      zone: this.zones.get(p.zone)?.name,
      quantity: p.quantity,
      health: p.health,
      harvestTime: p.harvestTime
    }));
  }

  getPlantCareSchedule(plantId) {
    const plant = this.plants.get(plantId);
    
    if (!plant) return null;

    const careSchedule = [];

    // Watering
    careSchedule.push({
      task: 'Vattning',
      frequency: plant.waterNeeds === 'high' ? 'Dagligen' : plant.waterNeeds === 'medium' ? 'Varannan dag' : 'Veckovis',
      nextDue: this.getNextWatering(plant.zone)?.date
    });

    // Fertilizing
    careSchedule.push({
      task: 'Gödsling',
      frequency: 'Var 2:a vecka',
      nextDue: null
    });

    // Harvest (if applicable)
    if (plant.harvestTime && typeof plant.harvestTime === 'number') {
      careSchedule.push({
        task: 'Skörd',
        frequency: 'En gång',
        nextDue: new Date(plant.harvestTime).toLocaleDateString('sv-SE')
      });
    }

    return {
      plant: {
        name: plant.name,
        variety: plant.variety
      },
      careSchedule
    };
  }

  getWaterUsageReport(days = 30) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    let totalWater = 0;
    const byZone = {};

    for (const [zoneId, schedule] of this.wateringSchedule) {
      const zoneWater = schedule.history
        .filter(h => h.timestamp >= cutoff)
        .reduce((sum, h) => sum + h.waterUsed, 0);

      totalWater += zoneWater;
      byZone[this.zones.get(zoneId).name] = Math.round(zoneWater);
    }

    return {
      period: `${days} days`,
      totalWater: Math.round(totalWater),
      averageDaily: Math.round(totalWater / days),
      byZone
    };
  }

  getSeasonalTasks() {
    return this.tasks.map(t => ({
      task: t.task,
      priority: t.priority,
      due: t.due ? new Date(t.due).toLocaleDateString('sv-SE') : null,
      recurring: t.recurring || null
    }));
  }

  getGardenTips() {
    const month = new Date().getMonth();
    
    const seasonalTips = {
      spring: [
        'Vänta tills frosten är borta innan du planterar känsliga växter',
        'Börja förså inomhus i mars för tidig skörd',
        'Rensa ogräs tidigt innan de får tag',
        'Mulcha rabatter för att behålla fukt'
      ],
      summer: [
        'Vattna tidigt på morgonen för bästa upptag',
        'Dödplocka blommor regelbundet för längre blomning',
        'Klipp gräsmattan ofta men inte för kort',
        'Skörda grönsaker ofta för fortsatt produktion'
      ],
      fall: [
        'Räfsa löv regelbundet',
        'Plantera vårlökar före första frosten',
        'Beskär buskar efter att de slutat växa',
        'Förbered trädgårdsmaskiner för vinterförvaring'
      ],
      winter: [
        'Planera nästa års trädgård',
        'Beställ frön tidigt för bästa urval',
        'Kontrollera lagrade lök och rotfrukter',
        'Skydda känsliga växter med vinterskydd'
      ]
    };

    let season;
    if (month >= 2 && month <= 4) season = 'spring';
    else if (month >= 5 && month <= 7) season = 'summer';
    else if (month >= 8 && month <= 10) season = 'fall';
    else season = 'winter';

    return seasonalTips[season];
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

module.exports = GardenCareSystem;
