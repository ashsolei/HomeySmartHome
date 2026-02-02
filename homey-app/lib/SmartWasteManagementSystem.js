'use strict';

/**
 * Smart Waste Management System
 * Intelligent waste tracking, recycling optimization, and collection scheduling
 */
class SmartWasteManagementSystem {
  constructor(homey) {
    this.homey = homey;
    this.wasteBins = new Map();
    this.collectionSchedule = new Map();
    this.wasteHistory = [];
    this.recyclingStats = {
      paper: 0,
      plastic: 0,
      glass: 0,
      metal: 0,
      organic: 0,
      general: 0
    };
    this.collectionReminders = [];
  }

  async initialize() {
    this.log('Initializing Smart Waste Management System...');
    
    await this.discoverWasteBins();
    await this.loadCollectionSchedule();
    await this.startMonitoring();
    
    this.log('Smart Waste Management System initialized');
  }

  async discoverWasteBins() {
    const devices = this.homey.drivers.getDevices();
    
    for (const device of devices) {
      const name = device.name.toLowerCase();
      
      if (name.includes('waste') || name.includes('bin') || name.includes('sopkärl')) {
        const binType = this.identifyBinType(name);
        this.wasteBins.set(device.id, {
          id: device.id,
          name: device.name,
          device,
          type: binType,
          fillLevel: 0,
          lastEmptied: Date.now(),
          capacity: 100
        });
      }
    }

    if (this.wasteBins.size === 0) {
      await this.createDefaultBins();
    }

    this.log(`Discovered ${this.wasteBins.size} waste bins`);
  }

  identifyBinType(name) {
    if (name.includes('paper') || name.includes('papper')) return 'paper';
    if (name.includes('plastic') || name.includes('plast')) return 'plastic';
    if (name.includes('glass') || name.includes('glas')) return 'glass';
    if (name.includes('metal') || name.includes('metall')) return 'metal';
    if (name.includes('organic') || name.includes('kompost')) return 'organic';
    return 'general';
  }

  async createDefaultBins() {
    const defaultBins = [
      { id: 'bin_general', name: 'General Waste', type: 'general', capacity: 240 },
      { id: 'bin_paper', name: 'Paper Recycling', type: 'paper', capacity: 240 },
      { id: 'bin_plastic', name: 'Plastic Recycling', type: 'plastic', capacity: 240 },
      { id: 'bin_organic', name: 'Organic Waste', type: 'organic', capacity: 120 }
    ];

    for (const bin of defaultBins) {
      this.wasteBins.set(bin.id, {
        ...bin,
        device: null,
        fillLevel: 0,
        lastEmptied: Date.now()
      });
    }
  }

  async loadCollectionSchedule() {
    const saved = await this.homey.settings.get('wasteCollectionSchedule') || {};
    Object.entries(saved).forEach(([id, schedule]) => {
      this.collectionSchedule.set(id, schedule);
    });

    if (this.collectionSchedule.size === 0) {
      await this.createDefaultSchedule();
    }
  }

  async createDefaultSchedule() {
    const schedules = [
      {
        id: 'general_collection',
        binType: 'general',
        dayOfWeek: 2,
        time: '07:00',
        frequency: 'weekly',
        enabled: true
      },
      {
        id: 'recycling_collection',
        binType: ['paper', 'plastic', 'glass'],
        dayOfWeek: 4,
        time: '07:00',
        frequency: 'biweekly',
        enabled: true
      },
      {
        id: 'organic_collection',
        binType: 'organic',
        dayOfWeek: 1,
        time: '07:00',
        frequency: 'weekly',
        enabled: true
      }
    ];

    for (const schedule of schedules) {
      this.collectionSchedule.set(schedule.id, schedule);
    }

    await this.saveCollectionSchedule();
  }

  async startMonitoring() {
    this.monitoringInterval = setInterval(async () => {
      await this.checkFillLevels();
      await this.checkCollectionSchedule();
    }, 300000);

    await this.checkCollectionSchedule();
  }

  async checkFillLevels() {
    for (const [id, bin] of this.wasteBins) {
      try {
        if (bin.device && bin.device.hasCapability('measure_fill')) {
          bin.fillLevel = await bin.device.getCapabilityValue('measure_fill');
        } else {
          const daysSinceEmpty = (Date.now() - bin.lastEmptied) / (24 * 60 * 60 * 1000);
          bin.fillLevel = Math.min(100, daysSinceEmpty * 15);
        }

        if (bin.fillLevel > 80 && !bin.alertSent) {
          await this.sendFullBinAlert(bin);
          bin.alertSent = true;
        } else if (bin.fillLevel < 70) {
          bin.alertSent = false;
        }
      } catch {}
    }
  }

  async sendFullBinAlert(bin) {
    try {
      const notificationManager = this.homey.app.advancedNotificationManager;
      if (notificationManager) {
        await notificationManager.sendNotification({
          title: '🗑️ Sopkärlet fullt',
          message: `${bin.name} är ${Math.round(bin.fillLevel)}% fullt`,
          priority: 'normal',
          category: 'waste'
        });
      }
    } catch {}
  }

  async checkCollectionSchedule() {
    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    for (const [id, schedule] of this.collectionSchedule) {
      if (!schedule.enabled) continue;

      const reminderTime = this.getCollectionReminderTime(schedule);
      const reminderDay = (schedule.dayOfWeek - 1 + 7) % 7;

      if (currentDay === reminderDay && currentTime === reminderTime) {
        await this.sendCollectionReminder(schedule);
      }

      if (currentDay === schedule.dayOfWeek && currentTime === schedule.time) {
        await this.handleCollection(schedule);
      }
    }
  }

  getCollectionReminderTime(schedule) {
    const [hours] = schedule.time.split(':');
    const reminderHour = parseInt(hours) - 1;
    return `${String((reminderHour + 24) % 24).padStart(2, '0')}:00`;
  }

  async sendCollectionReminder(schedule) {
    const binTypes = Array.isArray(schedule.binType) ? schedule.binType : [schedule.binType];
    const binNames = binTypes.map(type => {
      const bin = Array.from(this.wasteBins.values()).find(b => b.type === type);
      return bin?.name || type;
    }).join(', ');

    this.collectionReminders.push({
      scheduleId: schedule.id,
      binTypes,
      timestamp: Date.now()
    });

    try {
      const notificationManager = this.homey.app.advancedNotificationManager;
      if (notificationManager) {
        await notificationManager.sendNotification({
          title: '🚛 Sophämtning imorgon',
          message: `Kom ihåg att ställa ut: ${binNames}`,
          priority: 'normal',
          category: 'waste_collection'
        });
      }
    } catch {}
  }

  async handleCollection(schedule) {
    const binTypes = Array.isArray(schedule.binType) ? schedule.binType : [schedule.binType];
    
    for (const binType of binTypes) {
      for (const [id, bin] of this.wasteBins) {
        if (bin.type === binType) {
          await this.emptyBin(id);
        }
      }
    }

    this.log(`Collection completed for: ${binTypes.join(', ')}`);
  }

  async emptyBin(binId) {
    const bin = this.wasteBins.get(binId);
    if (!bin) return;

    const wasteAmount = (bin.fillLevel / 100) * bin.capacity;

    this.wasteHistory.push({
      binId,
      binName: bin.name,
      type: bin.type,
      amount: wasteAmount,
      timestamp: Date.now()
    });

    this.recyclingStats[bin.type] += wasteAmount;

    bin.fillLevel = 0;
    bin.lastEmptied = Date.now();
    bin.alertSent = false;

    this.log(`Bin emptied: ${bin.name} (${wasteAmount.toFixed(1)}L)`);
  }

  async recordWaste(binId, amount) {
    const bin = this.wasteBins.get(binId);
    if (!bin) return;

    const fillIncrease = (amount / bin.capacity) * 100;
    bin.fillLevel = Math.min(100, bin.fillLevel + fillIncrease);

    this.wasteHistory.push({
      binId,
      binName: bin.name,
      type: bin.type,
      amount,
      timestamp: Date.now(),
      action: 'added'
    });

    this.log(`Waste recorded: ${bin.name} +${amount}L`);
  }

  async saveCollectionSchedule() {
    const schedule = {};
    this.collectionSchedule.forEach((s, id) => {
      schedule[id] = s;
    });
    await this.homey.settings.set('wasteCollectionSchedule', schedule);
  }

  getRecyclingRate() {
    const totalRecycled = this.recyclingStats.paper + 
                          this.recyclingStats.plastic + 
                          this.recyclingStats.glass + 
                          this.recyclingStats.metal + 
                          this.recyclingStats.organic;
    const totalWaste = totalRecycled + this.recyclingStats.general;
    
    return totalWaste > 0 ? ((totalRecycled / totalWaste) * 100).toFixed(1) : 0;
  }

  getStatistics() {
    return {
      totalBins: this.wasteBins.size,
      collections: this.collectionSchedule.size,
      recyclingRate: this.getRecyclingRate(),
      totalWaste: Object.values(this.recyclingStats).reduce((a, b) => a + b, 0).toFixed(1),
      wasteHistory: this.wasteHistory.length,
      collectionReminders: this.collectionReminders.length
    };
  }

  log(...args) {
    console.log('[SmartWasteManagementSystem]', ...args);
  }

  error(...args) {
    console.error('[SmartWasteManagementSystem]', ...args);
  }
}

module.exports = SmartWasteManagementSystem;
