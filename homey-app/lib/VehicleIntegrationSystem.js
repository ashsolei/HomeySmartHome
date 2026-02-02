'use strict';

/**
 * Vehicle Integration System
 * EV charging optimization, garage control, and vehicle status monitoring
 */
class VehicleIntegrationSystem {
  constructor(homey) {
    this.homey = homey;
    this.vehicles = new Map();
    this.chargers = new Map();
    this.garageDoors = new Map();
    this.chargingSessions = [];
    this.chargingSchedule = new Map();
    this.smartChargingEnabled = true;
  }

  async initialize() {
    this.log('Initializing Vehicle Integration System...');
    
    await this.discoverVehicleDevices();
    await this.loadVehicleProfiles();
    await this.startMonitoring();
    
    this.log('Vehicle Integration System initialized');
  }

  async discoverVehicleDevices() {
    const devices = this.homey.drivers.getDevices();
    
    for (const device of devices) {
      const name = device.name.toLowerCase();
      
      if (name.includes('charger') || name.includes('laddare')) {
        this.chargers.set(device.id, {
          id: device.id,
          name: device.name,
          device,
          charging: false,
          power: 0,
          maxPower: 11000
        });
      }

      if (name.includes('garage') && (name.includes('door') || name.includes('dörr'))) {
        this.garageDoors.set(device.id, {
          id: device.id,
          name: device.name,
          device,
          open: false
        });
      }
    }

    this.log(`Vehicle devices: ${this.chargers.size} chargers, ${this.garageDoors.size} garage doors`);
  }

  async loadVehicleProfiles() {
    const saved = await this.homey.settings.get('vehicleProfiles') || {};
    Object.entries(saved).forEach(([id, vehicle]) => {
      this.vehicles.set(id, vehicle);
    });

    if (this.vehicles.size === 0) {
      await this.addDefaultVehicles();
    }
  }

  async addDefaultVehicles() {
    const defaultVehicles = [
      {
        id: 'vehicle_1',
        name: 'Tesla Model 3',
        type: 'electric',
        batteryCapacity: 75,
        currentCharge: 60,
        targetCharge: 80,
        range: 450,
        chargingSpeed: 11,
        preferredChargingTime: '22:00'
      }
    ];

    for (const vehicle of defaultVehicles) {
      this.vehicles.set(vehicle.id, vehicle);
    }

    await this.saveVehicleProfiles();
  }

  async startMonitoring() {
    this.monitoringInterval = setInterval(async () => {
      await this.checkChargingStatus();
      await this.checkChargingSchedule();
      await this.checkGarageDoors();
    }, 60000);

    await this.checkChargingSchedule();
  }

  async checkChargingStatus() {
    for (const [id, charger] of this.chargers) {
      try {
        if (charger.device.hasCapability('onoff')) {
          charger.charging = await charger.device.getCapabilityValue('onoff');
        }

        if (charger.device.hasCapability('measure_power')) {
          charger.power = await charger.device.getCapabilityValue('measure_power');
        }

        if (charger.charging) {
          await this.updateChargingSession(charger);
        }
      } catch {}
    }
  }

  async updateChargingSession(charger) {
    const activeSession = this.chargingSessions.find(s => s.chargerId === charger.id && !s.endTime);
    
    if (!activeSession) {
      this.chargingSessions.push({
        id: `session_${Date.now()}`,
        chargerId: charger.id,
        startTime: Date.now(),
        endTime: null,
        energyDelivered: 0,
        cost: 0
      });
    } else {
      const duration = (Date.now() - activeSession.startTime) / 3600000;
      activeSession.energyDelivered = (charger.power / 1000) * duration;
      activeSession.cost = activeSession.energyDelivered * 1.5;
    }
  }

  async checkChargingSchedule() {
    if (!this.smartChargingEnabled) return;

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    for (const [id, vehicle] of this.vehicles) {
      if (vehicle.type !== 'electric') continue;

      if (vehicle.currentCharge < vehicle.targetCharge && currentTime === vehicle.preferredChargingTime) {
        await this.startCharging(id);
      }

      if (vehicle.currentCharge >= vehicle.targetCharge) {
        await this.stopCharging(id);
      }
    }
  }

  async startCharging(vehicleId, immediate = false) {
    const vehicle = this.vehicles.get(vehicleId);
    if (!vehicle) return;

    const charger = Array.from(this.chargers.values())[0];
    if (!charger) {
      this.log('No charger available');
      return;
    }

    if (!immediate && this.smartChargingEnabled) {
      const optimalTime = await this.findOptimalChargingTime(vehicle);
      if (optimalTime > Date.now()) {
        this.log(`Smart charging: Delaying start to ${new Date(optimalTime).toLocaleTimeString()}`);
        setTimeout(() => this.executeCharging(vehicle, charger), optimalTime - Date.now());
        return;
      }
    }

    await this.executeCharging(vehicle, charger);
  }

  async executeCharging(vehicle, charger) {
    try {
      if (charger.device.hasCapability('onoff')) {
        await charger.device.setCapabilityValue('onoff', true);
      }

      charger.charging = true;
      vehicle.charging = true;

      this.log(`Charging started for ${vehicle.name}`);

      try {
        const notificationManager = this.homey.app.advancedNotificationManager;
        if (notificationManager) {
          await notificationManager.sendNotification({
            title: '⚡ Laddning påbörjad',
            message: `${vehicle.name} laddar nu`,
            priority: 'low',
            category: 'vehicle'
          });
        }
      } catch {}
    } catch (error) {
      this.error(`Failed to start charging: ${error.message}`);
    }
  }

  async findOptimalChargingTime(vehicle) {
    try {
      const energyForecasting = this.homey.app.energyForecastingEngine;
      if (energyForecasting) {
        const forecast = await energyForecasting.getOptimalTimeSlot();
        return forecast.timestamp;
      }
    } catch {}

    return Date.now() + 3600000;
  }

  async stopCharging(vehicleId) {
    const vehicle = this.vehicles.get(vehicleId);
    if (!vehicle) return;

    const charger = Array.from(this.chargers.values())[0];
    if (!charger) return;

    try {
      if (charger.device.hasCapability('onoff')) {
        await charger.device.setCapabilityValue('onoff', false);
      }

      charger.charging = false;
      vehicle.charging = false;

      const activeSession = this.chargingSessions.find(s => s.chargerId === charger.id && !s.endTime);
      if (activeSession) {
        activeSession.endTime = Date.now();
        
        try {
          const notificationManager = this.homey.app.advancedNotificationManager;
          if (notificationManager) {
            await notificationManager.sendNotification({
              title: '✅ Laddning klar',
              message: `${vehicle.name} har laddats klart (${activeSession.energyDelivered.toFixed(1)} kWh)`,
              priority: 'low',
              category: 'vehicle'
            });
          }
        } catch {}
      }

      this.log(`Charging stopped for ${vehicle.name}`);
    } catch (error) {
      this.error(`Failed to stop charging: ${error.message}`);
    }
  }

  async checkGarageDoors() {
    for (const [id, door] of this.garageDoors) {
      try {
        if (door.device.hasCapability('alarm_contact')) {
          const open = await door.device.getCapabilityValue('alarm_contact');
          
          if (open && !door.open) {
            door.openedAt = Date.now();
          }
          
          door.open = open;

          if (door.open && door.openedAt && Date.now() - door.openedAt > 1800000) {
            await this.sendGarageDoorAlert(door);
          }
        }
      } catch {}
    }
  }

  async sendGarageDoorAlert(door) {
    try {
      const notificationManager = this.homey.app.advancedNotificationManager;
      if (notificationManager) {
        await notificationManager.sendNotification({
          title: '⚠️ Garageport öppen',
          message: `${door.name} har varit öppen i över 30 minuter`,
          priority: 'normal',
          category: 'vehicle'
        });
      }
    } catch {}
  }

  async openGarageDoor(doorId) {
    const door = this.garageDoors.get(doorId);
    if (!door) return;

    try {
      if (door.device.hasCapability('button')) {
        await door.device.setCapabilityValue('button', true);
      }
      
      this.log(`Garage door opened: ${door.name}`);
    } catch (error) {
      this.error(`Failed to open garage door: ${error.message}`);
    }
  }

  async closeGarageDoor(doorId) {
    const door = this.garageDoors.get(doorId);
    if (!door) return;

    try {
      if (door.device.hasCapability('button')) {
        await door.device.setCapabilityValue('button', true);
      }
      
      this.log(`Garage door closed: ${door.name}`);
    } catch (error) {
      this.error(`Failed to close garage door: ${error.message}`);
    }
  }

  async saveVehicleProfiles() {
    const profiles = {};
    this.vehicles.forEach((vehicle, id) => {
      profiles[id] = vehicle;
    });
    await this.homey.settings.set('vehicleProfiles', profiles);
  }

  getStatistics() {
    const totalEnergy = this.chargingSessions.reduce((sum, s) => sum + s.energyDelivered, 0);
    const totalCost = this.chargingSessions.reduce((sum, s) => sum + s.cost, 0);

    return {
      vehicles: this.vehicles.size,
      chargers: this.chargers.size,
      garageDoors: this.garageDoors.size,
      chargingSessions: this.chargingSessions.length,
      totalEnergyDelivered: totalEnergy.toFixed(1),
      totalCost: totalCost.toFixed(2),
      smartChargingEnabled: this.smartChargingEnabled
    };
  }

  log(...args) {
    console.log('[VehicleIntegrationSystem]', ...args);
  }

  error(...args) {
    console.error('[VehicleIntegrationSystem]', ...args);
  }
}

module.exports = VehicleIntegrationSystem;
