'use strict';

/**
 * Pet Care Automation System
 * Comprehensive pet care with feeding, health monitoring, and activity tracking
 */
class PetCareAutomationSystem {
  constructor(homey) {
    this.homey = homey;
    this.pets = new Map();
    this.feeders = new Map();
    this.waterBowls = new Map();
    this.activityTrackers = new Map();
    this.cameras = new Map();
    this.healthData = [];
    this.feedingSchedule = new Map();
    this.activityHistory = [];
  }

  async initialize() {
    this.log('Initializing Pet Care Automation System...');
    
    await this.discoverPetDevices();
    await this.loadPetProfiles();
    await this.startMonitoring();
    
    this.log('Pet Care Automation System initialized');
  }

  async discoverPetDevices() {
    const devices = this.homey.drivers.getDevices();
    
    for (const device of devices) {
      const name = device.name.toLowerCase();
      
      if (name.includes('feeder') || name.includes('matare')) {
        this.feeders.set(device.id, {
          id: device.id,
          name: device.name,
          device,
          lastFed: null,
          foodLevel: 100
        });
      }

      if (name.includes('water bowl') || name.includes('vattenskål')) {
        this.waterBowls.set(device.id, {
          id: device.id,
          name: device.name,
          device,
          waterLevel: 100,
          lastRefilled: Date.now()
        });
      }

      if (name.includes('pet') && name.includes('camera')) {
        this.cameras.set(device.id, {
          id: device.id,
          name: device.name,
          device,
          recording: false
        });
      }

      if (name.includes('activity') || name.includes('tracker')) {
        this.activityTrackers.set(device.id, {
          id: device.id,
          name: device.name,
          device,
          steps: 0,
          active: false
        });
      }
    }

    this.log(`Pet devices: ${this.feeders.size} feeders, ${this.waterBowls.size} water bowls, ${this.cameras.size} cameras`);
  }

  async loadPetProfiles() {
    const saved = await this.homey.settings.get('petProfiles') || {};
    Object.entries(saved).forEach(([id, pet]) => {
      this.pets.set(id, pet);
    });

    if (this.pets.size === 0) {
      await this.addDefaultPets();
    }
  }

  async addDefaultPets() {
    const defaultPets = [
      {
        id: 'pet_1',
        name: 'Max',
        type: 'dog',
        breed: 'Golden Retriever',
        age: 4,
        weight: 30,
        feedingSchedule: ['07:00', '18:00'],
        activityGoal: 10000,
        healthStatus: 'healthy'
      },
      {
        id: 'pet_2',
        name: 'Luna',
        type: 'cat',
        breed: 'Persian',
        age: 2,
        weight: 4.5,
        feedingSchedule: ['08:00', '17:00'],
        activityGoal: 5000,
        healthStatus: 'healthy'
      }
    ];

    for (const pet of defaultPets) {
      this.pets.set(pet.id, pet);
      await this.createFeedingSchedule(pet.id);
    }

    await this.savePetProfiles();
  }

  async createFeedingSchedule(petId) {
    const pet = this.pets.get(petId);
    if (!pet) return;

    for (const time of pet.feedingSchedule) {
      const scheduleId = `${petId}_${time}`;
      this.feedingSchedule.set(scheduleId, {
        petId,
        time,
        enabled: true,
        portionSize: this.calculatePortionSize(pet)
      });
    }
  }

  calculatePortionSize(pet) {
    if (pet.type === 'dog') {
      return Math.round(pet.weight * 0.025 * 1000);
    } else if (pet.type === 'cat') {
      return Math.round(pet.weight * 0.04 * 1000);
    }
    return 100;
  }

  async startMonitoring() {
    this.monitoringInterval = setInterval(async () => {
      await this.checkFeedingSchedule();
      await this.checkWaterLevels();
      await this.checkActivityLevels();
    }, 60000);

    await this.checkFeedingSchedule();
  }

  async checkFeedingSchedule() {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    for (const [scheduleId, schedule] of this.feedingSchedule) {
      if (schedule.enabled && schedule.time === currentTime) {
        await this.feedPet(schedule.petId, schedule.portionSize);
      }
    }
  }

  async feedPet(petId, portionSize) {
    const pet = this.pets.get(petId);
    if (!pet) return;

    const feeder = Array.from(this.feeders.values())[0];
    if (!feeder) {
      this.log('No feeder available');
      return;
    }

    this.log(`Feeding ${pet.name} - ${portionSize}g`);

    try {
      if (feeder.device.hasCapability('onoff')) {
        await feeder.device.setCapabilityValue('onoff', true);
        
        setTimeout(async () => {
          await feeder.device.setCapabilityValue('onoff', false);
        }, 3000);
      }

      feeder.lastFed = Date.now();
      feeder.foodLevel -= (portionSize / 1000) * 10;

      pet.lastFed = Date.now();
      await this.savePetProfiles();

      try {
        const notificationManager = this.homey.app.advancedNotificationManager;
        if (notificationManager) {
          await notificationManager.sendNotification({
            title: '🐾 Matning klar',
            message: `${pet.name} har matats med ${portionSize}g`,
            priority: 'low',
            category: 'pet'
          });
        }
      } catch {}

      if (feeder.foodLevel < 20) {
        await this.sendLowFoodAlert(feeder);
      }
    } catch (error) {
      this.error(`Failed to feed pet: ${error.message}`);
    }
  }

  async checkWaterLevels() {
    for (const [id, bowl] of this.waterBowls) {
      try {
        if (bowl.device.hasCapability('measure_water')) {
          bowl.waterLevel = await bowl.device.getCapabilityValue('measure_water');
        } else {
          const hoursSinceRefill = (Date.now() - bowl.lastRefilled) / 3600000;
          bowl.waterLevel = Math.max(0, 100 - (hoursSinceRefill * 5));
        }

        if (bowl.waterLevel < 20) {
          await this.sendLowWaterAlert(bowl);
        }
      } catch {}
    }
  }

  async sendLowFoodAlert(feeder) {
    try {
      const notificationManager = this.homey.app.advancedNotificationManager;
      if (notificationManager) {
        await notificationManager.sendNotification({
          title: '⚠️ Låg matnivå',
          message: `${feeder.name} behöver fyllas på (${Math.round(feeder.foodLevel)}% kvar)`,
          priority: 'normal',
          category: 'pet'
        });
      }
    } catch {}
  }

  async sendLowWaterAlert(bowl) {
    try {
      const notificationManager = this.homey.app.advancedNotificationManager;
      if (notificationManager) {
        await notificationManager.sendNotification({
          title: '💧 Låg vattennivå',
          message: `${bowl.name} behöver fyllas på (${Math.round(bowl.waterLevel)}% kvar)`,
          priority: 'normal',
          category: 'pet'
        });
      }
    } catch {}
  }

  async checkActivityLevels() {
    for (const [petId, pet] of this.pets) {
      const tracker = Array.from(this.activityTrackers.values())[0];
      if (!tracker) continue;

      try {
        if (tracker.device.hasCapability('measure_steps')) {
          const steps = await tracker.device.getCapabilityValue('measure_steps');
          tracker.steps = steps;

          const activity = {
            petId,
            petName: pet.name,
            steps,
            timestamp: Date.now(),
            goalReached: steps >= pet.activityGoal
          };

          this.activityHistory.push(activity);

          if (steps >= pet.activityGoal && !pet.goalNotificationSent) {
            await this.sendActivityGoalReached(pet, steps);
            pet.goalNotificationSent = true;
            await this.savePetProfiles();
          }
        }
      } catch {}
    }
  }

  async sendActivityGoalReached(pet, steps) {
    try {
      const notificationManager = this.homey.app.advancedNotificationManager;
      if (notificationManager) {
        await notificationManager.sendNotification({
          title: '🎯 Aktivitetsmål uppnått!',
          message: `${pet.name} har nått sitt dagliga mål med ${steps} steg!`,
          priority: 'low',
          category: 'pet'
        });
      }
    } catch {}
  }

  async recordHealthData(petId, data) {
    const pet = this.pets.get(petId);
    if (!pet) return;

    const healthRecord = {
      petId,
      petName: pet.name,
      weight: data.weight || pet.weight,
      temperature: data.temperature || null,
      notes: data.notes || '',
      timestamp: Date.now()
    };

    this.healthData.push(healthRecord);

    if (this.healthData.length > 500) {
      this.healthData = this.healthData.slice(-500);
    }

    await this.homey.settings.set('petHealthData', this.healthData);
    this.log(`Health data recorded for ${pet.name}`);
  }

  async savePetProfiles() {
    const profiles = {};
    this.pets.forEach((pet, id) => {
      profiles[id] = pet;
    });
    await this.homey.settings.set('petProfiles', profiles);
  }

  getStatistics() {
    const totalFeedings = this.feedingSchedule.size * 30;
    const avgActivity = this.activityHistory.length > 0
      ? this.activityHistory.reduce((sum, a) => sum + a.steps, 0) / this.activityHistory.length
      : 0;

    return {
      totalPets: this.pets.size,
      feeders: this.feeders.size,
      waterBowls: this.waterBowls.size,
      cameras: this.cameras.size,
      scheduledFeedings: this.feedingSchedule.size,
      totalFeedings,
      healthRecords: this.healthData.length,
      avgActivity: Math.round(avgActivity)
    };
  }

  log(...args) {
    console.log('[PetCareAutomationSystem]', ...args);
  }

  error(...args) {
    console.error('[PetCareAutomationSystem]', ...args);
  }
}

module.exports = PetCareAutomationSystem;
