'use strict';

/**
 * Pool/Spa Management System
 * Comprehensive pool and spa control with temperature, chemical, and filtration management
 */
class PoolSpaManagementSystem {
  constructor(homey) {
    this.homey = homey;
    this.pools = new Map();
    this.spas = new Map();
    this.pumps = new Map();
    this.heaters = new Map();
    this.chemicalSensors = new Map();
    this.maintenanceLog = [];
    this.schedules = new Map();
  }

  async initialize() {
    this.log('Initializing Pool/Spa Management System...');
    
    await this.discoverPoolDevices();
    await this.loadPoolProfiles();
    await this.setupSchedules();
    await this.startMonitoring();
    
    this.log('Pool/Spa Management System initialized');
  }

  async discoverPoolDevices() {
    const devices = this.homey.drivers.getDevices();
    
    for (const device of devices) {
      const name = device.name.toLowerCase();
      
      if (name.includes('pump') && (name.includes('pool') || name.includes('spa'))) {
        this.pumps.set(device.id, {
          id: device.id,
          name: device.name,
          device,
          running: false,
          type: name.includes('spa') ? 'spa' : 'pool'
        });
      }

      if (name.includes('heater') && (name.includes('pool') || name.includes('spa'))) {
        this.heaters.set(device.id, {
          id: device.id,
          name: device.name,
          device,
          heating: false,
          targetTemp: 27,
          type: name.includes('spa') ? 'spa' : 'pool'
        });
      }

      if (name.includes('ph') || name.includes('chlorine') || name.includes('klor')) {
        this.chemicalSensors.set(device.id, {
          id: device.id,
          name: device.name,
          device,
          type: name.includes('ph') ? 'ph' : 'chlorine',
          value: 0
        });
      }
    }

    this.log(`Pool devices: ${this.pumps.size} pumps, ${this.heaters.size} heaters, ${this.chemicalSensors.size} sensors`);
  }

  async loadPoolProfiles() {
    const saved = await this.homey.settings.get('poolProfiles') || {};
    Object.entries(saved).forEach(([id, profile]) => {
      if (profile.type === 'pool') {
        this.pools.set(id, profile);
      } else {
        this.spas.set(id, profile);
      }
    });

    if (this.pools.size === 0 && this.spas.size === 0) {
      await this.createDefaultProfiles();
    }
  }

  async createDefaultProfiles() {
    const defaultPool = {
      id: 'pool_main',
      name: 'Main Pool',
      type: 'pool',
      volume: 45000,
      targetTemp: 26,
      currentTemp: 22,
      ph: 7.4,
      chlorine: 1.5,
      optimalPH: [7.2, 7.6],
      optimalChlorine: [1.0, 3.0],
      filterSchedule: { start: '08:00', duration: 8 }
    };

    const defaultSpa = {
      id: 'spa_main',
      name: 'Hot Tub',
      type: 'spa',
      volume: 1500,
      targetTemp: 38,
      currentTemp: 35,
      ph: 7.4,
      chlorine: 2.0,
      optimalPH: [7.2, 7.8],
      optimalChlorine: [1.5, 3.0],
      filterSchedule: { start: '20:00', duration: 2 }
    };

    this.pools.set(defaultPool.id, defaultPool);
    this.spas.set(defaultSpa.id, defaultSpa);

    await this.savePoolProfiles();
  }

  async setupSchedules() {
    for (const [id, pool] of this.pools) {
      this.schedules.set(`${id}_filter`, {
        id: `${id}_filter`,
        poolId: id,
        type: 'filtration',
        start: pool.filterSchedule.start,
        duration: pool.filterSchedule.duration,
        enabled: true
      });

      this.schedules.set(`${id}_chemical`, {
        id: `${id}_chemical`,
        poolId: id,
        type: 'chemical_check',
        interval: 4,
        enabled: true
      });
    }

    for (const [id, spa] of this.spas) {
      this.schedules.set(`${id}_filter`, {
        id: `${id}_filter`,
        poolId: id,
        type: 'filtration',
        start: spa.filterSchedule.start,
        duration: spa.filterSchedule.duration,
        enabled: true
      });
    }
  }

  async startMonitoring() {
    this.monitoringInterval = setInterval(async () => {
      await this.checkTemperatures();
      await this.checkChemicalLevels();
      await this.checkFilterSchedules();
    }, 300000);

    await this.checkFilterSchedules();
  }

  async checkTemperatures() {
    for (const [id, pool] of this.pools) {
      await this.monitorTemperature(pool);
    }

    for (const [id, spa] of this.spas) {
      await this.monitorTemperature(spa);
    }
  }

  async monitorTemperature(poolOrSpa) {
    const heater = Array.from(this.heaters.values()).find(h => h.type === poolOrSpa.type);
    if (!heater) return;

    try {
      if (heater.device.hasCapability('measure_temperature')) {
        poolOrSpa.currentTemp = await heater.device.getCapabilityValue('measure_temperature');
      }

      if (poolOrSpa.currentTemp < poolOrSpa.targetTemp - 1) {
        await this.startHeating(poolOrSpa.id);
      } else if (poolOrSpa.currentTemp >= poolOrSpa.targetTemp) {
        await this.stopHeating(poolOrSpa.id);
      }
    } catch {}
  }

  async startHeating(poolId) {
    const pool = this.pools.get(poolId) || this.spas.get(poolId);
    if (!pool) return;

    const heater = Array.from(this.heaters.values()).find(h => h.type === pool.type);
    if (!heater) return;

    try {
      if (heater.device.hasCapability('onoff')) {
        await heater.device.setCapabilityValue('onoff', true);
        heater.heating = true;
      }

      if (heater.device.hasCapability('target_temperature')) {
        await heater.device.setCapabilityValue('target_temperature', pool.targetTemp);
      }

      this.log(`Heating started for ${pool.name} (target: ${pool.targetTemp}°C)`);
    } catch (error) {
      this.error(`Failed to start heating: ${error.message}`);
    }
  }

  async stopHeating(poolId) {
    const pool = this.pools.get(poolId) || this.spas.get(poolId);
    if (!pool) return;

    const heater = Array.from(this.heaters.values()).find(h => h.type === pool.type);
    if (!heater || !heater.heating) return;

    try {
      if (heater.device.hasCapability('onoff')) {
        await heater.device.setCapabilityValue('onoff', false);
        heater.heating = false;
      }

      this.log(`Heating stopped for ${pool.name}`);
    } catch {}
  }

  async checkChemicalLevels() {
    for (const [id, pool] of this.pools) {
      await this.analyzeChemicals(pool);
    }

    for (const [id, spa] of this.spas) {
      await this.analyzeChemicals(spa);
    }
  }

  async analyzeChemicals(poolOrSpa) {
    try {
      for (const [id, sensor] of this.chemicalSensors) {
        if (sensor.device.hasCapability('measure_numeric')) {
          sensor.value = await sensor.device.getCapabilityValue('measure_numeric');
          
          if (sensor.type === 'ph') {
            poolOrSpa.ph = sensor.value;
          } else if (sensor.type === 'chlorine') {
            poolOrSpa.chlorine = sensor.value;
          }
        }
      }

      const phInRange = poolOrSpa.ph >= poolOrSpa.optimalPH[0] && poolOrSpa.ph <= poolOrSpa.optimalPH[1];
      const chlorineInRange = poolOrSpa.chlorine >= poolOrSpa.optimalChlorine[0] && 
                             poolOrSpa.chlorine <= poolOrSpa.optimalChlorine[1];

      if (!phInRange || !chlorineInRange) {
        await this.sendChemicalAlert(poolOrSpa, phInRange, chlorineInRange);
      }
    } catch {}
  }

  async sendChemicalAlert(poolOrSpa, phOk, chlorineOk) {
    let message = `${poolOrSpa.name} kemiska värden: `;
    if (!phOk) message += `pH ${poolOrSpa.ph.toFixed(1)} (optimal: ${poolOrSpa.optimalPH[0]}-${poolOrSpa.optimalPH[1]}) `;
    if (!chlorineOk) message += `Klor ${poolOrSpa.chlorine.toFixed(1)} ppm (optimal: ${poolOrSpa.optimalChlorine[0]}-${poolOrSpa.optimalChlorine[1]})`;

    try {
      const notificationManager = this.homey.app.advancedNotificationManager;
      if (notificationManager) {
        await notificationManager.sendNotification({
          title: '⚗️ Kemiska värden utanför intervall',
          message: message.trim(),
          priority: 'normal',
          category: 'pool'
        });
      }
    } catch {}
  }

  async checkFilterSchedules() {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const currentHour = now.getHours();

    for (const [id, schedule] of this.schedules) {
      if (!schedule.enabled || schedule.type !== 'filtration') continue;

      const [startHour] = schedule.start.split(':').map(Number);
      const endHour = (startHour + schedule.duration) % 24;

      const shouldRun = (currentHour >= startHour && currentHour < endHour) ||
                       (endHour < startHour && (currentHour >= startHour || currentHour < endHour));

      if (currentTime === schedule.start) {
        await this.startFiltration(schedule.poolId);
      }

      const endTime = `${String(endHour).padStart(2, '0')}:00`;
      if (currentTime === endTime) {
        await this.stopFiltration(schedule.poolId);
      }
    }
  }

  async startFiltration(poolId) {
    const pool = this.pools.get(poolId) || this.spas.get(poolId);
    if (!pool) return;

    const pump = Array.from(this.pumps.values()).find(p => p.type === pool.type);
    if (!pump) return;

    try {
      if (pump.device.hasCapability('onoff')) {
        await pump.device.setCapabilityValue('onoff', true);
        pump.running = true;
      }

      this.log(`Filtration started for ${pool.name}`);
    } catch (error) {
      this.error(`Failed to start filtration: ${error.message}`);
    }
  }

  async stopFiltration(poolId) {
    const pool = this.pools.get(poolId) || this.spas.get(poolId);
    if (!pool) return;

    const pump = Array.from(this.pumps.values()).find(p => p.type === pool.type);
    if (!pump || !pump.running) return;

    try {
      if (pump.device.hasCapability('onoff')) {
        await pump.device.setCapabilityValue('onoff', false);
        pump.running = false;
      }

      this.log(`Filtration stopped for ${pool.name}`);
    } catch {}
  }

  async recordMaintenance(poolId, type, notes) {
    const pool = this.pools.get(poolId) || this.spas.get(poolId);
    if (!pool) return;

    const maintenance = {
      poolId,
      poolName: pool.name,
      type,
      notes,
      timestamp: Date.now()
    };

    this.maintenanceLog.push(maintenance);

    if (this.maintenanceLog.length > 200) {
      this.maintenanceLog = this.maintenanceLog.slice(-200);
    }

    await this.homey.settings.set('poolMaintenanceLog', this.maintenanceLog);
    this.log(`Maintenance recorded for ${pool.name}: ${type}`);
  }

  async savePoolProfiles() {
    const profiles = {};
    
    this.pools.forEach((pool, id) => {
      profiles[id] = pool;
    });
    
    this.spas.forEach((spa, id) => {
      profiles[id] = spa;
    });

    await this.homey.settings.set('poolProfiles', profiles);
  }

  getStatistics() {
    return {
      pools: this.pools.size,
      spas: this.spas.size,
      pumps: this.pumps.size,
      heaters: this.heaters.size,
      chemicalSensors: this.chemicalSensors.size,
      maintenanceRecords: this.maintenanceLog.length,
      schedules: this.schedules.size
    };
  }

  log(...args) {
    console.log('[PoolSpaManagementSystem]', ...args);
  }

  error(...args) {
    console.error('[PoolSpaManagementSystem]', ...args);
  }
}

module.exports = PoolSpaManagementSystem;
