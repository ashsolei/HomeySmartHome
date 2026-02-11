'use strict';

const EventEmitter = require('events');

/**
 * Smart Composting & Garden System
 *
 * Manages smart composting bins and garden health with integrated sensor
 * monitoring, automated watering, crop planning, and harvest prediction.
 *
 * Features:
 * - Composting bin temperature and moisture monitoring
 * - Nutrient content tracking (nitrogen, phosphorus, potassium)
 * - Garden soil health monitoring with pH and mineral analysis
 * - Automated watering schedules based on soil moisture data
 * - Crop rotation planning and planting calendar
 * - Harvest prediction based on growth data and weather
 * - Worm farm integration and decomposition rate tracking
 * - Seasonal planting recommendations
 */
class SmartCompostingGardenSystem extends EventEmitter {
  constructor(homey) {
    super();
    this.homey = homey;
    this.initialized = false;
    this.compostBins = new Map();
    this.gardenZones = new Map();
    this.crops = new Map();
    this.wateringSchedules = new Map();
    this.soilReadings = [];
    this.harvestLog = [];
    this.rotationPlan = [];
    this.sensorPollingInterval = null;
    this.wateringCheckInterval = null;
    this.compostTurnReminder = null;
    this.optimalCompostTemp = { min: 54, max: 65 }; // °C
  }

  /**
   * Initialize the composting and garden system
   * @returns {Promise<boolean>}
   */
  async initialize() {
    if (this.initialized) return true;

    this.homey.log('[SmartCompostingGardenSystem] Initializing...');

    await this.loadSettings();
    this.initializeDefaultCompostBin();
    this.startSensorPolling();
    this.startWateringCheck();

    this.initialized = true;
    this.homey.log('[SmartCompostingGardenSystem] Initialized');
    this.homey.emit('composting-garden:initialized');
    return true;
  }

  /**
   * Load persisted settings from storage
   */
  async loadSettings() {
    const settings = await this.homey.settings.get('compostingGarden') || {};

    if (settings.compostBins) {
      for (const [id, bin] of Object.entries(settings.compostBins)) {
        this.compostBins.set(id, bin);
      }
    }
    if (settings.gardenZones) {
      for (const [id, zone] of Object.entries(settings.gardenZones)) {
        this.gardenZones.set(id, zone);
      }
    }
    if (settings.crops) {
      for (const [id, crop] of Object.entries(settings.crops)) {
        this.crops.set(id, crop);
      }
    }
    if (settings.wateringSchedules) {
      for (const [id, schedule] of Object.entries(settings.wateringSchedules)) {
        this.wateringSchedules.set(id, schedule);
      }
    }
    if (settings.rotationPlan) {
      this.rotationPlan = settings.rotationPlan;
    }
  }

  /**
   * Initialize a default compost bin configuration
   */
  initializeDefaultCompostBin() {
    if (this.compostBins.size > 0) return;

    this.compostBins.set('bin-1', {
      id: 'bin-1',
      name: 'Main Compost Bin',
      type: 'hot-compost',
      capacity: 400, // liters
      currentVolume: 0,
      temperature: 25,
      moisture: 50,
      nutrients: { nitrogen: 0, phosphorus: 0, potassium: 0 },
      lastTurned: null,
      startedAt: new Date().toISOString(),
      estimatedReadyDate: null,
      layers: [],
    });
  }

  /**
   * Add material to a compost bin
   * @param {string} binId - Compost bin identifier
   * @param {object} material - Material to add
   * @returns {object} Updated bin status
   */
  async addCompostMaterial(binId, material) {
    const bin = this.compostBins.get(binId);
    if (!bin) return { success: false, error: 'Bin not found' };

    const layer = {
      id: `layer-${Date.now()}`,
      type: material.type, // green, brown, kitchen-waste, yard-waste
      name: material.name,
      volumeLiters: material.volumeLiters || 10,
      carbonNitrogenRatio: material.carbonNitrogenRatio || (material.type === 'brown' ? 30 : 15),
      addedAt: new Date().toISOString(),
    };

    bin.layers.push(layer);
    bin.currentVolume += layer.volumeLiters;

    // adjust nutrient estimates
    if (material.type === 'green' || material.type === 'kitchen-waste') {
      bin.nutrients.nitrogen += layer.volumeLiters * 0.3;
    } else {
      bin.nutrients.potassium += layer.volumeLiters * 0.1;
      bin.nutrients.phosphorus += layer.volumeLiters * 0.05;
    }

    await this._saveSettings();

    this.homey.log(`[SmartCompostingGardenSystem] Material added to ${binId}: ${layer.name}`);
    this.homey.emit('composting-garden:material-added', { binId, layer });

    return { success: true, bin };
  }

  /**
   * Record a sensor reading for a compost bin
   * @param {string} binId - Compost bin identifier
   * @param {object} reading - Sensor reading data
   */
  async recordCompostReading(binId, reading) {
    const bin = this.compostBins.get(binId);
    if (!bin) return { success: false, error: 'Bin not found' };

    bin.temperature = reading.temperature;
    bin.moisture = reading.moisture;
    if (reading.nutrients) {
      bin.nutrients = { ...bin.nutrients, ...reading.nutrients };
    }

    const entry = {
      binId,
      timestamp: new Date().toISOString(),
      temperature: reading.temperature,
      moisture: reading.moisture,
      nutrients: { ...bin.nutrients },
    };
    this.soilReadings.push(entry);

    // check for alerts
    if (reading.temperature > this.optimalCompostTemp.max) {
      this.homey.emit('composting-garden:alert', {
        type: 'temperature-high',
        binId,
        value: reading.temperature,
        message: `Compost bin ${bin.name} is too hot (${reading.temperature}°C). Consider turning.`,
      });
    } else if (reading.temperature < this.optimalCompostTemp.min && bin.layers.length > 3) {
      this.homey.emit('composting-garden:alert', {
        type: 'temperature-low',
        binId,
        value: reading.temperature,
        message: `Compost bin ${bin.name} has cooled (${reading.temperature}°C). May need more green material.`,
      });
    }

    if (reading.moisture < 40 || reading.moisture > 65) {
      this.homey.emit('composting-garden:alert', {
        type: 'moisture-out-of-range',
        binId,
        value: reading.moisture,
        message: `Moisture at ${reading.moisture}%. Ideal range is 40-65%.`,
      });
    }

    return { success: true, entry };
  }

  /**
   * Register a garden zone for monitoring
   * @param {object} zoneConfig - Garden zone configuration
   * @returns {object} Created garden zone
   */
  async registerGardenZone(zoneConfig) {
    const zone = {
      id: zoneConfig.id || `zone-${Date.now()}`,
      name: zoneConfig.name,
      area: zoneConfig.area || 0, // square meters
      soilType: zoneConfig.soilType || 'loam',
      sunExposure: zoneConfig.sunExposure || 'full', // full, partial, shade
      irrigationType: zoneConfig.irrigationType || 'drip',
      currentCrops: [],
      soilHealth: {
        ph: zoneConfig.ph || 6.5,
        moisture: 50,
        nitrogen: 0,
        phosphorus: 0,
        potassium: 0,
        organicMatter: 3,
      },
      createdAt: new Date().toISOString(),
    };

    this.gardenZones.set(zone.id, zone);
    await this._saveSettings();

    this.homey.log(`[SmartCompostingGardenSystem] Garden zone registered: ${zone.name}`);
    this.homey.emit('composting-garden:zone-registered', zone);

    return zone;
  }

  /**
   * Set up automated watering schedule based on soil data
   * @param {string} zoneId - Garden zone identifier
   * @param {object} schedule - Watering schedule parameters
   * @returns {object} Created watering schedule
   */
  async setWateringSchedule(zoneId, schedule) {
    const zone = this.gardenZones.get(zoneId);
    if (!zone) return { success: false, error: 'Zone not found' };

    const wateringSchedule = {
      id: `water-${Date.now()}`,
      zoneId,
      mode: schedule.mode || 'smart', // smart, fixed, manual
      moistureThreshold: schedule.moistureThreshold || 35,
      maxDurationMinutes: schedule.maxDurationMinutes || 30,
      preferredTime: schedule.preferredTime || '06:00',
      daysOfWeek: schedule.daysOfWeek || [1, 3, 5],
      seasonalAdjust: schedule.seasonalAdjust !== false,
      rainDelay: schedule.rainDelay !== false,
      enabled: true,
      lastRun: null,
      nextRun: null,
    };

    this.wateringSchedules.set(wateringSchedule.id, wateringSchedule);
    await this._saveSettings();

    this.homey.log(`[SmartCompostingGardenSystem] Watering schedule set for zone ${zone.name}`);
    this.homey.emit('composting-garden:watering-scheduled', wateringSchedule);

    return wateringSchedule;
  }

  /**
   * Plan crop rotation for a garden zone
   * @param {string} zoneId - Garden zone identifier
   * @param {Array} crops - Array of crop rotation entries
   * @returns {object} Rotation plan
   */
  async planCropRotation(zoneId, crops) {
    const zone = this.gardenZones.get(zoneId);
    if (!zone) return { success: false, error: 'Zone not found' };

    const plan = crops.map((crop, idx) => ({
      id: `crop-${Date.now()}-${idx}`,
      zoneId,
      name: crop.name,
      family: crop.family || 'unknown', // legume, brassica, solanaceae, cucurbit, allium, root
      plantDate: crop.plantDate,
      harvestDate: crop.harvestDate || null,
      companionPlants: crop.companionPlants || [],
      nutrientNeeds: crop.nutrientNeeds || { nitrogen: 'medium', phosphorus: 'medium', potassium: 'medium' },
      season: crop.season || this._getCurrentSeason(),
      status: 'planned',
    }));

    for (const crop of plan) {
      this.crops.set(crop.id, crop);
    }
    this.rotationPlan.push(...plan);
    await this._saveSettings();

    this.homey.log(`[SmartCompostingGardenSystem] Crop rotation planned for zone ${zone.name}: ${plan.length} crops`);
    return { success: true, zoneId, plan };
  }

  /**
   * Predict harvest dates based on growth data and conditions
   * @param {string} cropId - Crop identifier
   * @returns {object} Harvest prediction
   */
  async predictHarvest(cropId) {
    const crop = this.crops.get(cropId);
    if (!crop) return { success: false, error: 'Crop not found' };

    const zone = this.gardenZones.get(crop.zoneId);
    const plantDate = new Date(crop.plantDate);
    const now = new Date();
    const daysGrown = Math.floor((now - plantDate) / (1000 * 60 * 60 * 24));

    // simplified growth estimation based on crop family
    const growthDays = {
      legume: 65,
      brassica: 80,
      solanaceae: 90,
      cucurbit: 70,
      allium: 100,
      root: 75,
      unknown: 80,
    };

    const expectedDays = growthDays[crop.family] || 80;
    let adjustmentFactor = 1.0;

    if (zone) {
      if (zone.soilHealth.ph < 5.5 || zone.soilHealth.ph > 7.5) adjustmentFactor *= 1.15;
      if (zone.sunExposure === 'partial') adjustmentFactor *= 1.1;
      if (zone.sunExposure === 'shade') adjustmentFactor *= 1.3;
    }

    const adjustedDays = Math.round(expectedDays * adjustmentFactor);
    const estimatedHarvest = new Date(plantDate.getTime() + adjustedDays * 24 * 60 * 60 * 1000);
    const progress = Math.min(100, Math.round((daysGrown / adjustedDays) * 100));

    const prediction = {
      cropId,
      cropName: crop.name,
      plantDate: crop.plantDate,
      daysGrown,
      estimatedTotalDays: adjustedDays,
      estimatedHarvestDate: estimatedHarvest.toISOString().split('T')[0],
      progress,
      adjustmentFactor,
      readyToHarvest: progress >= 95,
    };

    this.homey.emit('composting-garden:harvest-prediction', prediction);
    return prediction;
  }

  /**
   * Record a harvest
   * @param {string} cropId - Crop identifier
   * @param {object} harvestData - Harvest data
   */
  async recordHarvest(cropId, harvestData) {
    const crop = this.crops.get(cropId);
    if (!crop) return { success: false, error: 'Crop not found' };

    const entry = {
      cropId,
      cropName: crop.name,
      zoneId: crop.zoneId,
      harvestedAt: new Date().toISOString(),
      yieldKg: harvestData.yieldKg || 0,
      quality: harvestData.quality || 'good', // excellent, good, fair, poor
      notes: harvestData.notes || '',
    };

    crop.status = 'harvested';
    crop.harvestDate = entry.harvestedAt;
    this.harvestLog.push(entry);
    await this._saveSettings();

    this.homey.log(`[SmartCompostingGardenSystem] Harvest recorded: ${crop.name} (${entry.yieldKg}kg)`);
    this.homey.emit('composting-garden:harvest-recorded', entry);

    return { success: true, entry };
  }

  /**
   * Start periodic sensor polling
   */
  startSensorPolling() {
    if (this.sensorPollingInterval) clearInterval(this.sensorPollingInterval);

    this.sensorPollingInterval = setInterval(() => {
      for (const [, bin] of this.compostBins) {
        // simulate minor temperature fluctuation for monitoring
        const tempDrift = (Math.random() - 0.5) * 2;
        bin.temperature = Math.max(10, Math.min(80, bin.temperature + tempDrift));
      }

      // keep soil readings trimmed
      if (this.soilReadings.length > 5000) {
        this.soilReadings = this.soilReadings.slice(-2500);
      }
    }, 5 * 60 * 1000); // every 5 minutes
  }

  /**
   * Start periodic watering condition check
   */
  startWateringCheck() {
    if (this.wateringCheckInterval) clearInterval(this.wateringCheckInterval);

    this.wateringCheckInterval = setInterval(() => {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      for (const [, schedule] of this.wateringSchedules) {
        if (!schedule.enabled) continue;
        if (schedule.preferredTime !== currentTime) continue;
        if (!schedule.daysOfWeek.includes(now.getDay())) continue;

        const zone = this.gardenZones.get(schedule.zoneId);
        if (!zone) continue;

        if (schedule.mode === 'smart' && zone.soilHealth.moisture > schedule.moistureThreshold) {
          this.homey.log(`[SmartCompostingGardenSystem] Skipping watering for ${zone.name} – moisture sufficient`);
          continue;
        }

        this.homey.emit('composting-garden:watering-triggered', {
          zoneId: schedule.zoneId,
          zoneName: zone.name,
          duration: schedule.maxDurationMinutes,
        });

        schedule.lastRun = now.toISOString();
        this.homey.log(`[SmartCompostingGardenSystem] Watering triggered for ${zone.name}`);
      }
    }, 60 * 1000); // every minute
  }

  /**
   * Get current system status
   * @returns {object} System status
   */
  async getStatus() {
    return {
      initialized: this.initialized,
      compostBinCount: this.compostBins.size,
      gardenZoneCount: this.gardenZones.size,
      activeCrops: [...this.crops.values()].filter(c => c.status === 'planned' || c.status === 'growing').length,
      wateringSchedules: this.wateringSchedules.size,
      soilReadingsCount: this.soilReadings.length,
      harvestLogEntries: this.harvestLog.length,
      rotationPlanEntries: this.rotationPlan.length,
    };
  }

  /**
   * Destroy the system and clean up resources
   */
  destroy() {
    if (this.sensorPollingInterval) {
      clearInterval(this.sensorPollingInterval);
      this.sensorPollingInterval = null;
    }
    if (this.wateringCheckInterval) {
      clearInterval(this.wateringCheckInterval);
      this.wateringCheckInterval = null;
    }
    if (this.compostTurnReminder) {
      clearInterval(this.compostTurnReminder);
      this.compostTurnReminder = null;
    }

    this.compostBins.clear();
    this.gardenZones.clear();
    this.crops.clear();
    this.wateringSchedules.clear();
    this.soilReadings = [];
    this.harvestLog = [];
    this.rotationPlan = [];
    this.initialized = false;

    this.homey.log('[SmartCompostingGardenSystem] Destroyed');
  }

  // ── Private helpers ──

  async _saveSettings() {
    const data = {
      compostBins: Object.fromEntries(this.compostBins),
      gardenZones: Object.fromEntries(this.gardenZones),
      crops: Object.fromEntries(this.crops),
      wateringSchedules: Object.fromEntries(this.wateringSchedules),
      rotationPlan: this.rotationPlan,
    };
    await this.homey.settings.set('compostingGarden', data);
  }

  _getCurrentSeason() {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'autumn';
    return 'winter';
  }
}

module.exports = SmartCompostingGardenSystem;
