'use strict';

/**
 * Smart Appliance Controller
 * Unified control and optimization for all smart appliances
 */
class SmartApplianceController {
  constructor(homey) {
    this.homey = homey;
    this.appliances = new Map();
    this.cycleHistory = [];
    this.energyOptimization = true;
    this.maintenanceAlerts = [];
    this.applianceTypes = {
      washingMachine: [],
      dryer: [],
      dishwasher: [],
      oven: [],
      refrigerator: [],
      coffeeMaker: [],
      vacuum: []
    };
  }

  async initialize() {
    this.log('Initializing Smart Appliance Controller...');
    
    await this.discoverAppliances();
    await this.loadCycleHistory();
    await this.startMonitoring();
    
    this.log('Smart Appliance Controller initialized');
  }

  async discoverAppliances() {
    const devices = this.homey.drivers.getDevices();
    
    for (const device of devices) {
      const name = device.name.toLowerCase();
      
      const appliance = {
        id: device.id,
        name: device.name,
        device,
        type: this.identifyApplianceType(name),
        status: 'idle',
        currentCycle: null,
        energyUsage: 0,
        maintenanceNeeded: false,
        lastMaintenance: null
      };

      if (appliance.type) {
        this.appliances.set(device.id, appliance);
        this.applianceTypes[appliance.type].push(appliance);
      }
    }

    this.log(`Discovered ${this.appliances.size} appliances`);
  }

  identifyApplianceType(name) {
    if (name.includes('washing') || name.includes('tvättmaskin')) return 'washingMachine';
    if (name.includes('dryer') || name.includes('tork')) return 'dryer';
    if (name.includes('dishwasher') || name.includes('diskmaskin')) return 'dishwasher';
    if (name.includes('oven') || name.includes('ugn')) return 'oven';
    if (name.includes('fridge') || name.includes('refrigerator') || name.includes('kyl')) return 'refrigerator';
    if (name.includes('coffee') || name.includes('kaffe')) return 'coffeeMaker';
    if (name.includes('vacuum') || name.includes('dammsugare')) return 'vacuum';
    return null;
  }

  async startMonitoring() {
    this.monitoringInterval = setInterval(async () => {
      await this.checkApplianceStatus();
      await this.checkMaintenanceNeeds();
    }, 60000);
  }

  async checkApplianceStatus() {
    for (const [id, appliance] of this.appliances) {
      try {
        if (appliance.device.hasCapability('onoff')) {
          const isOn = await appliance.device.getCapabilityValue('onoff');
          const previousStatus = appliance.status;
          appliance.status = isOn ? 'running' : 'idle';

          if (previousStatus === 'running' && appliance.status === 'idle') {
            await this.handleCycleComplete(appliance);
          }
        }

        if (appliance.device.hasCapability('measure_power')) {
          appliance.energyUsage = await appliance.device.getCapabilityValue('measure_power');
        }
      } catch {}
    }
  }

  async handleCycleComplete(appliance) {
    this.log(`Cycle completed: ${appliance.name}`);

    const cycle = {
      applianceId: appliance.id,
      applianceName: appliance.name,
      type: appliance.type,
      startTime: appliance.currentCycle?.startTime || Date.now() - 3600000,
      endTime: Date.now(),
      duration: null,
      energyUsed: appliance.currentCycle?.energyUsed || 0
    };

    cycle.duration = (cycle.endTime - cycle.startTime) / 60000;
    this.cycleHistory.push(cycle);

    try {
      const notificationManager = this.homey.app.advancedNotificationManager;
      if (notificationManager) {
        await notificationManager.sendNotification({
          title: '✅ Apparat klar',
          message: `${appliance.name} har avslutat sin cykel`,
          priority: 'normal',
          category: 'appliance'
        });
      }
    } catch {}
  }

  async startCycle(applianceId, cycleType, options = {}) {
    const appliance = this.appliances.get(applianceId);
    if (!appliance) throw new Error('Appliance not found');

    if (this.energyOptimization && !options.immediate) {
      const optimalTime = await this.findOptimalStartTime();
      this.log(`Energy optimization: Delaying start to ${new Date(optimalTime).toLocaleTimeString()}`);
      
      setTimeout(async () => {
        await this.executeStartCycle(appliance, cycleType);
      }, optimalTime - Date.now());
    } else {
      await this.executeStartCycle(appliance, cycleType);
    }
  }

  async executeStartCycle(appliance, cycleType) {
    try {
      if (appliance.device.hasCapability('onoff')) {
        await appliance.device.setCapabilityValue('onoff', true);
      }

      appliance.currentCycle = {
        type: cycleType,
        startTime: Date.now(),
        energyUsed: 0
      };

      appliance.status = 'running';
      this.log(`Started ${cycleType} cycle on ${appliance.name}`);
    } catch (error) {
      this.error(`Failed to start cycle: ${error.message}`);
    }
  }

  async findOptimalStartTime() {
    try {
      const energyForecasting = this.homey.app.energyForecastingEngine;
      if (energyForecasting) {
        const forecast = await energyForecasting.getOptimalTimeSlot();
        return forecast.timestamp;
      }
    } catch {}

    return Date.now() + 3600000;
  }

  async checkMaintenanceNeeds() {
    for (const [id, appliance] of this.appliances) {
      const needsMaintenance = await this.calculateMaintenanceNeed(appliance);
      
      if (needsMaintenance && !appliance.maintenanceNeeded) {
        appliance.maintenanceNeeded = true;
        await this.sendMaintenanceAlert(appliance);
      }
    }
  }

  async calculateMaintenanceNeed(appliance) {
    const cyclesForAppliance = this.cycleHistory.filter(c => c.applianceId === appliance.id);
    
    const maintenanceThresholds = {
      washingMachine: 50,
      dryer: 40,
      dishwasher: 60,
      coffeeMaker: 100,
      vacuum: 30
    };

    const threshold = maintenanceThresholds[appliance.type] || 50;
    
    if (appliance.lastMaintenance) {
      const cyclesSinceLastMaintenance = cyclesForAppliance.filter(
        c => c.endTime > appliance.lastMaintenance
      ).length;
      return cyclesSinceLastMaintenance >= threshold;
    }

    return cyclesForAppliance.length >= threshold;
  }

  async sendMaintenanceAlert(appliance) {
    this.maintenanceAlerts.push({
      applianceId: appliance.id,
      applianceName: appliance.name,
      timestamp: Date.now(),
      type: 'maintenance_needed'
    });

    try {
      const notificationManager = this.homey.app.advancedNotificationManager;
      if (notificationManager) {
        await notificationManager.sendNotification({
          title: '🔧 Underhåll behövs',
          message: `${appliance.name} behöver underhåll`,
          priority: 'normal',
          category: 'maintenance'
        });
      }
    } catch {}
  }

  async performMaintenance(applianceId) {
    const appliance = this.appliances.get(applianceId);
    if (!appliance) return;

    appliance.maintenanceNeeded = false;
    appliance.lastMaintenance = Date.now();
    
    await this.homey.settings.set(`maintenance_${applianceId}`, appliance.lastMaintenance);
    
    this.log(`Maintenance recorded for ${appliance.name}`);
  }

  async loadCycleHistory() {
    const saved = await this.homey.settings.get('applianceCycleHistory') || [];
    this.cycleHistory = saved.slice(-500);
  }

  async saveCycleHistory() {
    await this.homey.settings.set('applianceCycleHistory', this.cycleHistory.slice(-500));
  }

  getStatistics() {
    const stats = {
      totalAppliances: this.appliances.size,
      appliancesByType: {},
      totalCycles: this.cycleHistory.length,
      maintenanceAlerts: this.maintenanceAlerts.length,
      energyOptimization: this.energyOptimization
    };

    for (const [type, appliances] of Object.entries(this.applianceTypes)) {
      stats.appliancesByType[type] = appliances.length;
    }

    return stats;
  }

  log(...args) {
    console.log('[SmartApplianceController]', ...args);
  }

  error(...args) {
    console.error('[SmartApplianceController]', ...args);
  }
}

module.exports = SmartApplianceController;
