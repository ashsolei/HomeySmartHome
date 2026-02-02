'use strict';

/**
 * Garden & Plant Care System
 * Automated plant care with growth tracking and health monitoring
 */
class GardenPlantCareSystem {
  constructor(homey) {
    this.homey = homey;
    this.plants = new Map();
    this.sensors = new Map();
    this.irrigationSystems = new Map();
    this.plantDatabase = this.initializePlantDatabase();
    this.careHistory = [];
    this.healthAlerts = [];
  }

  async initialize() {
    this.log('Initializing Garden & Plant Care System...');
    
    await this.discoverGardenDevices();
    await this.loadPlantRegistry();
    await this.startMonitoring();
    
    this.log('Garden & Plant Care System initialized');
  }

  initializePlantDatabase() {
    return {
      tomato: {
        name: 'Tomato',
        wateringFrequency: 'daily',
        optimalSoilMoisture: [60, 80],
        optimalTemperature: [18, 27],
        optimalLight: 'full_sun',
        fertilizingInterval: 14
      },
      rose: {
        name: 'Rose',
        wateringFrequency: 'every_2_days',
        optimalSoilMoisture: [50, 70],
        optimalTemperature: [15, 25],
        optimalLight: 'full_sun',
        fertilizingInterval: 21
      },
      basil: {
        name: 'Basil',
        wateringFrequency: 'daily',
        optimalSoilMoisture: [65, 85],
        optimalTemperature: [20, 25],
        optimalLight: 'full_sun',
        fertilizingInterval: 14
      },
      fern: {
        name: 'Fern',
        wateringFrequency: 'every_2_days',
        optimalSoilMoisture: [70, 90],
        optimalTemperature: [15, 24],
        optimalLight: 'shade',
        fertilizingInterval: 30
      }
    };
  }

  async discoverGardenDevices() {
    const devices = this.homey.drivers.getDevices();
    
    for (const device of devices) {
      const name = device.name.toLowerCase();
      
      if (name.includes('soil') || name.includes('jord')) {
        this.sensors.set(device.id, {
          id: device.id,
          name: device.name,
          device,
          type: 'soil_moisture',
          zone: device.zone?.name || 'unknown'
        });
      }

      if (name.includes('irrigation') || name.includes('bevattning')) {
        this.irrigationSystems.set(device.id, {
          id: device.id,
          name: device.name,
          device,
          zone: device.zone?.name || 'unknown',
          active: false
        });
      }
    }

    this.log(`Garden devices: ${this.sensors.size} sensors, ${this.irrigationSystems.size} irrigation systems`);
  }

  async loadPlantRegistry() {
    const saved = await this.homey.settings.get('plantRegistry') || {};
    Object.entries(saved).forEach(([id, plant]) => {
      this.plants.set(id, plant);
    });

    if (this.plants.size === 0) {
      await this.addDefaultPlants();
    }
  }

  async addDefaultPlants() {
    const defaultPlants = [
      {
        id: 'plant_1',
        name: 'Tomatoes (Front Garden)',
        type: 'tomato',
        location: 'front_garden',
        plantedDate: Date.now() - 30 * 24 * 60 * 60 * 1000,
        lastWatered: Date.now() - 24 * 60 * 60 * 1000,
        lastFertilized: Date.now() - 10 * 24 * 60 * 60 * 1000,
        health: 85
      },
      {
        id: 'plant_2',
        name: 'Roses (Back Garden)',
        type: 'rose',
        location: 'back_garden',
        plantedDate: Date.now() - 180 * 24 * 60 * 60 * 1000,
        lastWatered: Date.now() - 24 * 60 * 60 * 1000,
        lastFertilized: Date.now() - 15 * 24 * 60 * 60 * 1000,
        health: 90
      },
      {
        id: 'plant_3',
        name: 'Basil (Indoor)',
        type: 'basil',
        location: 'kitchen',
        plantedDate: Date.now() - 45 * 24 * 60 * 60 * 1000,
        lastWatered: Date.now() - 12 * 60 * 60 * 1000,
        lastFertilized: Date.now() - 12 * 24 * 60 * 60 * 1000,
        health: 95
      }
    ];

    for (const plant of defaultPlants) {
      this.plants.set(plant.id, plant);
    }

    await this.savePlantRegistry();
  }

  async startMonitoring() {
    this.monitoringInterval = setInterval(async () => {
      await this.checkPlantHealth();
      await this.checkWateringNeeds();
      await this.checkFertilizingNeeds();
    }, 600000);

    await this.checkPlantHealth();
  }

  async checkPlantHealth() {
    for (const [id, plant] of this.plants) {
      const requirements = this.plantDatabase[plant.type];
      if (!requirements) continue;

      let healthScore = 100;
      const issues = [];

      const hoursSinceWatered = (Date.now() - plant.lastWatered) / 3600000;
      if (hoursSinceWatered > 48) {
        healthScore -= 20;
        issues.push('needs_water');
      }

      const daysSinceFertilized = (Date.now() - plant.lastFertilized) / (24 * 3600000);
      if (daysSinceFertilized > requirements.fertilizingInterval + 7) {
        healthScore -= 15;
        issues.push('needs_fertilizer');
      }

      plant.health = Math.max(0, Math.min(100, healthScore));
      plant.issues = issues;

      if (plant.health < 60 && !plant.alertSent) {
        await this.sendHealthAlert(plant);
        plant.alertSent = true;
      } else if (plant.health >= 70) {
        plant.alertSent = false;
      }
    }
  }

  async checkWateringNeeds() {
    for (const [id, plant] of this.plants) {
      const requirements = this.plantDatabase[plant.type];
      if (!requirements) continue;

      const hoursSinceWatered = (Date.now() - plant.lastWatered) / 3600000;
      const needsWatering = this.calculateWateringNeed(plant.type, hoursSinceWatered);

      if (needsWatering) {
        await this.waterPlant(id);
      }
    }
  }

  calculateWateringNeed(plantType, hoursSinceWatered) {
    const requirements = this.plantDatabase[plantType];
    
    const frequencyHours = {
      'daily': 24,
      'every_2_days': 48,
      'twice_weekly': 84,
      'weekly': 168
    };

    const threshold = frequencyHours[requirements.wateringFrequency] || 48;
    return hoursSinceWatered >= threshold;
  }

  async waterPlant(plantId) {
    const plant = this.plants.get(plantId);
    if (!plant) return;

    this.log(`Watering ${plant.name}`);

    const irrigation = Array.from(this.irrigationSystems.values()).find(
      sys => sys.zone.toLowerCase().includes(plant.location.toLowerCase())
    );

    if (irrigation) {
      try {
        if (irrigation.device.hasCapability('onoff')) {
          await irrigation.device.setCapabilityValue('onoff', true);
          irrigation.active = true;

          setTimeout(async () => {
            await irrigation.device.setCapabilityValue('onoff', false);
            irrigation.active = false;
          }, 300000);
        }
      } catch {}
    }

    plant.lastWatered = Date.now();
    this.careHistory.push({
      plantId,
      action: 'watered',
      timestamp: Date.now()
    });

    await this.savePlantRegistry();
  }

  async checkFertilizingNeeds() {
    for (const [id, plant] of this.plants) {
      const requirements = this.plantDatabase[plant.type];
      if (!requirements) continue;

      const daysSinceFertilized = (Date.now() - plant.lastFertilized) / (24 * 3600000);
      
      if (daysSinceFertilized >= requirements.fertilizingInterval) {
        await this.sendFertilizingReminder(plant);
      }
    }
  }

  async sendHealthAlert(plant) {
    this.healthAlerts.push({
      plantId: plant.id,
      plantName: plant.name,
      health: plant.health,
      issues: plant.issues,
      timestamp: Date.now()
    });

    try {
      const notificationManager = this.homey.app.advancedNotificationManager;
      if (notificationManager) {
        await notificationManager.sendNotification({
          title: '🌱 Växthälsovarning',
          message: `${plant.name} mår dåligt (hälsa: ${plant.health}%)`,
          priority: 'normal',
          category: 'garden'
        });
      }
    } catch {}
  }

  async sendFertilizingReminder(plant) {
    try {
      const notificationManager = this.homey.app.advancedNotificationManager;
      if (notificationManager) {
        await notificationManager.sendNotification({
          title: '🌿 Gödsling behövs',
          message: `${plant.name} behöver gödslas`,
          priority: 'low',
          category: 'garden'
        });
      }
    } catch {}
  }

  async recordFertilizing(plantId) {
    const plant = this.plants.get(plantId);
    if (!plant) return;

    plant.lastFertilized = Date.now();
    this.careHistory.push({
      plantId,
      action: 'fertilized',
      timestamp: Date.now()
    });

    await this.savePlantRegistry();
    this.log(`Fertilizing recorded for ${plant.name}`);
  }

  async savePlantRegistry() {
    const registry = {};
    this.plants.forEach((plant, id) => {
      registry[id] = plant;
    });
    await this.homey.settings.set('plantRegistry', registry);
  }

  getStatistics() {
    const avgHealth = this.plants.size > 0
      ? Array.from(this.plants.values()).reduce((sum, p) => sum + p.health, 0) / this.plants.size
      : 0;

    return {
      totalPlants: this.plants.size,
      avgHealth: avgHealth.toFixed(1),
      healthAlerts: this.healthAlerts.length,
      careActions: this.careHistory.length,
      sensors: this.sensors.size,
      irrigationSystems: this.irrigationSystems.size
    };
  }

  log(...args) {
    console.log('[GardenPlantCareSystem]', ...args);
  }

  error(...args) {
    console.error('[GardenPlantCareSystem]', ...args);
  }
}

module.exports = GardenPlantCareSystem;
