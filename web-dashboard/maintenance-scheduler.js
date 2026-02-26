'use strict';

/**
 * Maintenance Scheduler
 * Tracks device maintenance, service reminders, warranties
 */
class MaintenanceScheduler {
  constructor(app) {
    this.app = app;
    this.devices = new Map();
    this.tasks = new Map();
    this.history = [];
    this.warranties = new Map();
  }

  async initialize() {
    await this.loadDevices();
    await this.loadTasks();
    await this.loadWarranties();
    
    this.startScheduler();
  }

  // ============================================
  // DEVICE MANAGEMENT
  // ============================================

  async loadDevices() {
    const deviceConfigs = [
      // HVAC
      {
        id: 'hvac_main',
        name: 'Värmepump',
        category: 'hvac',
        brand: 'Nibe',
        model: 'F2120',
        installDate: new Date('2020-03-15').getTime(),
        warrantyMonths: 60,
        serviceInterval: 12, // months
        lastService: new Date('2023-11-15').getTime()
      },
      // Water heater
      {
        id: 'water_heater',
        name: 'Varmvattenberedare',
        category: 'water',
        brand: 'OSO',
        model: 'Super S 300',
        installDate: new Date('2019-06-01').getTime(),
        warrantyMonths: 84, // 7 years
        serviceInterval: 24,
        lastService: new Date('2023-06-01').getTime()
      },
      // Ventilation
      {
        id: 'ventilation',
        name: 'Ventilationsaggregat',
        category: 'hvac',
        brand: 'Villavent',
        model: 'Save VSR 300',
        installDate: new Date('2018-09-01').getTime(),
        warrantyMonths: 36,
        serviceInterval: 6, // Filter change
        lastService: new Date('2024-01-15').getTime()
      },
      // Dishwasher
      {
        id: 'dishwasher',
        name: 'Diskmaskin',
        category: 'appliance',
        brand: 'Bosch',
        model: 'SMV46KX01E',
        installDate: new Date('2021-08-20').getTime(),
        warrantyMonths: 24,
        serviceInterval: 6, // Clean filter
        lastService: new Date('2024-01-10').getTime()
      },
      // Washing machine
      {
        id: 'washing_machine',
        name: 'Tvättmaskin',
        category: 'appliance',
        brand: 'Electrolux',
        model: 'EW6F4842G5',
        installDate: new Date('2021-05-10').getTime(),
        warrantyMonths: 24,
        serviceInterval: 3, // Clean filter & drum
        lastService: new Date('2024-02-01').getTime()
      },
      // Dryer
      {
        id: 'dryer',
        name: 'Torktumlare',
        category: 'appliance',
        brand: 'Electrolux',
        model: 'EW8H358S',
        installDate: new Date('2021-05-10').getTime(),
        warrantyMonths: 24,
        serviceInterval: 1, // Clean lint filter monthly
        lastService: new Date('2024-04-01').getTime()
      },
      // Refrigerator
      {
        id: 'refrigerator',
        name: 'Kylskåp',
        category: 'appliance',
        brand: 'Liebherr',
        model: 'CBNes 5778',
        installDate: new Date('2020-11-05').getTime(),
        warrantyMonths: 24,
        serviceInterval: 12, // Clean coils
        lastService: new Date('2023-11-05').getTime()
      },
      // Smoke detectors
      {
        id: 'smoke_detector_1',
        name: 'Brandvarnare (sovrum)',
        category: 'safety',
        brand: 'Netatmo',
        model: 'Smart Smoke Alarm',
        installDate: new Date('2022-03-01').getTime(),
        warrantyMonths: 24,
        serviceInterval: 12, // Test
        batteryLife: 120, // months (10 years)
        lastService: new Date('2024-03-01').getTime()
      },
      {
        id: 'smoke_detector_2',
        name: 'Brandvarnare (vardagsrum)',
        category: 'safety',
        brand: 'Netatmo',
        model: 'Smart Smoke Alarm',
        installDate: new Date('2022-03-01').getTime(),
        warrantyMonths: 24,
        serviceInterval: 12,
        batteryLife: 120,
        lastService: new Date('2024-03-01').getTime()
      },
      // Solar panels
      {
        id: 'solar_panels',
        name: 'Solpaneler',
        category: 'energy',
        brand: 'SunPower',
        model: 'Maxeon 3',
        installDate: new Date('2021-07-01').getTime(),
        warrantyMonths: 300, // 25 years
        serviceInterval: 24, // Cleaning & inspection
        lastService: new Date('2023-07-01').getTime()
      },
      // Car charger
      {
        id: 'car_charger',
        name: 'Elbilsladdare',
        category: 'energy',
        brand: 'Easee',
        model: 'Home',
        installDate: new Date('2022-09-15').getTime(),
        warrantyMonths: 36,
        serviceInterval: 12,
        lastService: new Date('2023-09-15').getTime()
      },
      // Router
      {
        id: 'router',
        name: 'Router',
        category: 'tech',
        brand: 'Asus',
        model: 'RT-AX86U',
        installDate: new Date('2022-01-10').getTime(),
        warrantyMonths: 36,
        serviceInterval: 6, // Firmware update
        lastService: new Date('2024-03-10').getTime()
      }
    ];

    for (const config of deviceConfigs) {
      this.devices.set(config.id, {
        ...config,
        status: 'operational',
        notes: [],
        documents: []
      });
    }
  }

  // ============================================
  // TASK MANAGEMENT
  // ============================================

  async loadTasks() {
    // Generate upcoming tasks based on device service intervals
    for (const [deviceId, device] of this.devices) {
      const nextService = this.calculateNextService(device);
      const daysUntil = Math.floor((nextService - Date.now()) / (1000 * 60 * 60 * 24));

      if (daysUntil <= 90) { // Show tasks within 90 days
        await this.createTask({
          deviceId,
          type: 'service',
          title: `Service: ${device.name}`,
          description: this.getServiceDescription(device),
          dueDate: nextService,
          priority: this.calculatePriority(daysUntil, device.category),
          estimatedTime: this.getEstimatedTime(device),
          estimatedCost: this.getEstimatedCost(device)
        });
      }

      // Check warranty expiration
      if (device.warrantyMonths) {
        const warrantyExpires = device.installDate + device.warrantyMonths * 30 * 24 * 60 * 60 * 1000;
        const daysUntilExpiry = Math.floor((warrantyExpires - Date.now()) / (1000 * 60 * 60 * 24));

        if (daysUntilExpiry > 0 && daysUntilExpiry <= 60) {
          await this.createTask({
            deviceId,
            type: 'warranty',
            title: `Garanti utgår snart: ${device.name}`,
            description: `Garantin utgår om ${daysUntilExpiry} dagar. Överväg att köpa förlängd garanti eller kontrollera enhetens skick.`,
            dueDate: warrantyExpires,
            priority: 'medium',
            estimatedTime: 15,
            estimatedCost: 0
          });
        }
      }
    }

    // Add seasonal tasks
    await this.addSeasonalTasks();
  }

  calculateNextService(device) {
    const lastService = device.lastService || device.installDate;
    const intervalMs = device.serviceInterval * 30 * 24 * 60 * 60 * 1000; // months to ms
    
    return lastService + intervalMs;
  }

  getServiceDescription(device) {
    const descriptions = {
      hvac: 'Kontrollera köldmedium, rengör filter, inspektera kompressor',
      water: 'Kontrollera anod, rengör tank, testa säkerhetsventil',
      appliance: 'Rengör filter, inspektera slang och anslutningar',
      safety: 'Testa alarm, byt batteri om nödvändigt',
      energy: 'Rengör paneler, inspektera kablar, kontrollera prestanda',
      tech: 'Uppdatera firmware, kontrollera anslutningar'
    };

    return descriptions[device.category] || 'Allmän service och inspektion';
  }

  calculatePriority(daysUntil, category) {
    // Safety devices always high priority
    if (category === 'safety') {
      if (daysUntil <= 7) return 'critical';
      if (daysUntil <= 30) return 'high';
      return 'medium';
    }

    // Other devices
    if (daysUntil <= 0) return 'critical';
    if (daysUntil <= 7) return 'high';
    if (daysUntil <= 30) return 'medium';
    return 'low';
  }

  getEstimatedTime(device) {
    const times = {
      hvac: 120, // 2 hours
      water: 90,
      appliance: 30,
      safety: 15,
      energy: 180, // 3 hours
      tech: 30
    };

    return times[device.category] || 60;
  }

  getEstimatedCost(device) {
    const costs = {
      hvac: 1500, // SEK
      water: 800,
      appliance: 0, // DIY
      safety: 0,
      energy: 2000,
      tech: 0
    };

    return costs[device.category] || 500;
  }

  async addSeasonalTasks() {
    const month = new Date().getMonth();

    // Spring tasks (March-May)
    if (month >= 2 && month <= 4) {
      await this.createTask({
        type: 'seasonal',
        title: 'Vårstädning: Rengör ventilationsgaller',
        description: 'Rengör alla ventilationsgaller i hemmet',
        dueDate: new Date(new Date().getFullYear(), 4, 1).getTime(),
        priority: 'low',
        estimatedTime: 60,
        estimatedCost: 0
      });

      await this.createTask({
        type: 'seasonal',
        title: 'Kontrollera utomhusbelysning',
        description: 'Testa och rengör utomhusbelysning',
        dueDate: new Date(new Date().getFullYear(), 3, 15).getTime(),
        priority: 'low',
        estimatedTime: 45,
        estimatedCost: 0
      });
    }

    // Summer tasks (June-August)
    if (month >= 5 && month <= 7) {
      await this.createTask({
        type: 'seasonal',
        title: 'Service: AC och värmepump',
        description: 'Förbered klimatsystem för sommar',
        dueDate: new Date(new Date().getFullYear(), 5, 1).getTime(),
        priority: 'medium',
        estimatedTime: 120,
        estimatedCost: 1500
      });
    }

    // Fall tasks (September-November)
    if (month >= 8 && month <= 10) {
      await this.createTask({
        type: 'seasonal',
        title: 'Förbered värmesystem för vinter',
        description: 'Kontrollera värmepump och radiatorer',
        dueDate: new Date(new Date().getFullYear(), 9, 1).getTime(),
        priority: 'high',
        estimatedTime: 90,
        estimatedCost: 1000
      });

      await this.createTask({
        type: 'seasonal',
        title: 'Rengör rännor och stuprör',
        description: 'Ta bort löv och skräp från takrännor',
        dueDate: new Date(new Date().getFullYear(), 10, 15).getTime(),
        priority: 'medium',
        estimatedTime: 120,
        estimatedCost: 0
      });
    }

    // Winter tasks (December-February)
    if (month >= 11 || month <= 1) {
      await this.createTask({
        type: 'seasonal',
        title: 'Kontrollera isolering',
        description: 'Inspektera fönster och dörrar för drag',
        dueDate: new Date(new Date().getFullYear(), 11, 1).getTime(),
        priority: 'medium',
        estimatedTime: 60,
        estimatedCost: 0
      });
    }
  }

  async createTask(config) {
    const task = {
      id: config.id || `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      deviceId: config.deviceId || null,
      type: config.type, // 'service', 'repair', 'inspection', 'warranty', 'seasonal'
      title: config.title,
      description: config.description,
      dueDate: config.dueDate,
      priority: config.priority || 'medium',
      status: 'pending',
      estimatedTime: config.estimatedTime || 60, // minutes
      estimatedCost: config.estimatedCost || 0,
      assignedTo: config.assignedTo || null,
      completedDate: null,
      completedBy: null,
      notes: [],
      created: Date.now()
    };

    this.tasks.set(task.id, task);

    return { success: true, task };
  }

  async updateTask(taskId, updates) {
    const task = this.tasks.get(taskId);
    
    if (!task) {
      return { success: false, error: 'Task not found' };
    }

    Object.assign(task, updates);

    return { success: true, task };
  }

  async completeTask(taskId, data) {
    const task = this.tasks.get(taskId);
    
    if (!task) {
      return { success: false, error: 'Task not found' };
    }

    task.status = 'completed';
    task.completedDate = Date.now();
    task.completedBy = data.completedBy || 'user';
    task.actualTime = data.actualTime;
    task.actualCost = data.actualCost;
    
    if (data.notes) {
      task.notes.push({
        text: data.notes,
        timestamp: Date.now()
      });
    }

    // Update device last service date if applicable
    if (task.deviceId && task.type === 'service') {
      const device = this.devices.get(task.deviceId);
      if (device) {
        device.lastService = Date.now();
        
        // Schedule next service
        const nextService = this.calculateNextService(device);
        await this.createTask({
          deviceId: device.id,
          type: 'service',
          title: `Service: ${device.name}`,
          description: this.getServiceDescription(device),
          dueDate: nextService,
          priority: 'medium',
          estimatedTime: this.getEstimatedTime(device),
          estimatedCost: this.getEstimatedCost(device)
        });
      }
    }

    // Add to history
    this.history.push({
      taskId,
      task: { ...task },
      timestamp: Date.now()
    });

    return { success: true, task };
  }

  async deleteTask(taskId) {
    this.tasks.delete(taskId);
    return { success: true };
  }

  // ============================================
  // WARRANTY MANAGEMENT
  // ============================================

  async loadWarranties() {
    for (const [deviceId, device] of this.devices) {
      if (device.warrantyMonths) {
        const expiryDate = device.installDate + device.warrantyMonths * 30 * 24 * 60 * 60 * 1000;
        
        this.warranties.set(deviceId, {
          deviceId,
          deviceName: device.name,
          startDate: device.installDate,
          months: device.warrantyMonths,
          expiryDate,
          provider: device.brand,
          active: expiryDate > Date.now(),
          documents: []
        });
      }
    }
  }

  getWarrantyStatus(deviceId) {
    const warranty = this.warranties.get(deviceId);
    
    if (!warranty) return null;

    const daysRemaining = Math.floor((warranty.expiryDate - Date.now()) / (1000 * 60 * 60 * 24));

    return {
      ...warranty,
      daysRemaining,
      expired: daysRemaining < 0,
      expiringSoon: daysRemaining > 0 && daysRemaining <= 60
    };
  }

  getAllWarranties() {
    return Array.from(this.warranties.values()).map(w => {
      const daysRemaining = Math.floor((w.expiryDate - Date.now()) / (1000 * 60 * 60 * 24));
      
      return {
        deviceId: w.deviceId,
        deviceName: w.deviceName,
        active: w.active,
        daysRemaining,
        expiryDate: w.expiryDate,
        expiringSoon: daysRemaining > 0 && daysRemaining <= 60
      };
    });
  }

  // ============================================
  // SCHEDULER
  // ============================================

  startScheduler() {
    // Check for due tasks every hour
    setInterval(() => {
      this.checkDueTasks();
    }, 60 * 60 * 1000);

    // Initial check
    this.checkDueTasks();
  }

  async checkDueTasks() {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    for (const [_taskId, task] of this.tasks) {
      if (task.status !== 'pending') continue;

      const timeUntilDue = task.dueDate - now;

      // Send reminders
      if (timeUntilDue <= oneDayMs && timeUntilDue > 0 && !task.reminderSent) {
        await this.sendReminder(task);
        task.reminderSent = true;
      }

      // Update priority if overdue
      if (timeUntilDue < 0 && task.priority !== 'critical') {
        task.priority = 'critical';
      }
    }
  }

  async sendReminder(task) {
    const daysUntil = Math.ceil((task.dueDate - Date.now()) / (1000 * 60 * 60 * 24));
    
    console.log(`🔔 Påminnelse: ${task.title} - förfaller om ${daysUntil} dag(ar)`);
    
    // In production: send actual notification
    // await this.app.notifications.send({
    //   title: 'Underhållspåminnelse',
    //   message: `${task.title} - förfaller om ${daysUntil} dag(ar)`,
    //   priority: task.priority
    // });
  }

  // ============================================
  // ANALYTICS & REPORTING
  // ============================================

  getDashboard() {
    const tasks = Array.from(this.tasks.values());
    const pending = tasks.filter(t => t.status === 'pending');
    
    const overdue = pending.filter(t => t.dueDate < Date.now());
    const dueSoon = pending.filter(t => {
      const days = (t.dueDate - Date.now()) / (1000 * 60 * 60 * 24);
      return days > 0 && days <= 7;
    });

    const byPriority = {
      critical: pending.filter(t => t.priority === 'critical').length,
      high: pending.filter(t => t.priority === 'high').length,
      medium: pending.filter(t => t.priority === 'medium').length,
      low: pending.filter(t => t.priority === 'low').length
    };

    return {
      pendingTasks: pending.length,
      overdueTasks: overdue.length,
      dueSoonTasks: dueSoon.length,
      completedTasks: tasks.filter(t => t.status === 'completed').length,
      byPriority,
      estimatedCostPending: pending.reduce((sum, t) => sum + (t.estimatedCost || 0), 0),
      estimatedTimePending: pending.reduce((sum, t) => sum + (t.estimatedTime || 0), 0)
    };
  }

  getUpcomingTasks(days = 30) {
    const cutoff = Date.now() + days * 24 * 60 * 60 * 1000;
    
    return Array.from(this.tasks.values())
      .filter(t => t.status === 'pending' && t.dueDate <= cutoff)
      .sort((a, b) => a.dueDate - b.dueDate)
      .map(t => ({
        id: t.id,
        title: t.title,
        deviceName: t.deviceId ? this.devices.get(t.deviceId)?.name : null,
        dueDate: t.dueDate,
        daysUntil: Math.ceil((t.dueDate - Date.now()) / (1000 * 60 * 60 * 24)),
        priority: t.priority,
        estimatedTime: t.estimatedTime,
        estimatedCost: t.estimatedCost
      }));
  }

  getDeviceMaintenanceHistory(deviceId) {
    return this.history
      .filter(h => h.task.deviceId === deviceId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .map(h => ({
        date: h.task.completedDate,
        type: h.task.type,
        description: h.task.description,
        cost: h.task.actualCost,
        time: h.task.actualTime,
        notes: h.task.notes
      }));
  }

  getMaintenanceStats() {
    const completed = this.history;
    const thisYear = new Date().getFullYear();
    const thisYearCompleted = completed.filter(h => 
      new Date(h.timestamp).getFullYear() === thisYear
    );

    return {
      totalCompleted: completed.length,
      thisYearCompleted: thisYearCompleted.length,
      totalCost: completed.reduce((sum, h) => sum + (h.task.actualCost || 0), 0),
      thisYearCost: thisYearCompleted.reduce((sum, h) => sum + (h.task.actualCost || 0), 0),
      totalTime: completed.reduce((sum, h) => sum + (h.task.actualTime || 0), 0),
      thisYearTime: thisYearCompleted.reduce((sum, h) => sum + (h.task.actualTime || 0), 0),
      byCategory: this.getStatsByCategory(completed)
    };
  }

  getStatsByCategory(history) {
    const categories = {};

    for (const entry of history) {
      if (!entry.task.deviceId) continue;
      
      const device = this.devices.get(entry.task.deviceId);
      if (!device) continue;

      const cat = device.category;
      
      if (!categories[cat]) {
        categories[cat] = {
          count: 0,
          cost: 0,
          time: 0
        };
      }

      categories[cat].count++;
      categories[cat].cost += entry.task.actualCost || 0;
      categories[cat].time += entry.task.actualTime || 0;
    }

    return categories;
  }

  getAllDevices() {
    return Array.from(this.devices.values()).map(d => ({
      id: d.id,
      name: d.name,
      category: d.category,
      brand: d.brand,
      model: d.model,
      installDate: d.installDate,
      lastService: d.lastService,
      nextService: this.calculateNextService(d),
      status: d.status
    }));
  }

  getDeviceDetails(deviceId) {
    const device = this.devices.get(deviceId);
    
    if (!device) return null;

    return {
      ...device,
      nextService: this.calculateNextService(device),
      pendingTasks: Array.from(this.tasks.values())
        .filter(t => t.deviceId === deviceId && t.status === 'pending')
        .length,
      maintenanceHistory: this.getDeviceMaintenanceHistory(deviceId),
      warranty: this.getWarrantyStatus(deviceId)
    };
  }
}

module.exports = MaintenanceScheduler;
