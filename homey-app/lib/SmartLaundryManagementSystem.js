'use strict';

const EventEmitter = require('events');
const Homey = require('homey');

/**
 * Smart Laundry Management System
 * 
 * Comprehensive laundry automation with washer/dryer control, detergent tracking,
 * fabric care recommendations, and smart scheduling for energy efficiency.
 * 
 * Features:
 * - Multi-appliance control (washers, dryers, combo units)
 * - Fabric care recommendations based on garment type
 * - Detergent and fabric softener inventory tracking
 * - Smart scheduling for off-peak energy usage
 * - Load tracking with wash/dry cycles
 * - Maintenance reminders (filter cleaning, drum cleaning)
 * - Wrinkle prevention (auto-tumble after dry)
 * - Integration with wardrobe management for care instructions
 * 
 * @extends EventEmitter
 */
class SmartLaundryManagementSystem extends EventEmitter {
  constructor() {
    super();
    
    this.laundryAppliances = new Map();
    this.laundryLoads = [];
    this.detergentInventory = new Map();
    this.fabricCareProfiles = new Map();
    this.laundrySchedules = [];
    this.maintenanceHistory = [];
    
    this.settings = {
      preferredWashTime: '22:00', // Off-peak hours
      autoStartEnabled: true,
      wrinklePreventionEnabled: true,
      energySavingMode: true,
      notificationsEnabled: true,
      maxLoadsPerDay: 3
    };
    
    this.cache = {
      data: new Map(),
      timestamps: new Map(),
      ttl: 4 * 60 * 1000 // 4 minutes cache
    };
    
    this.monitoring = {
      interval: null,
      checkInterval: 2 * 60 * 1000, // Check every 2 minutes
      lastCheck: null
    };
    
    this.initializeDefaultData();
  }
  
  /**
   * Initialize default laundry appliances and data
   */
  initializeDefaultData() {
    // Washing Machine
    this.laundryAppliances.set('washer-001', {
      id: 'washer-001',
      name: 'Main Washer',
      type: 'washer',
      brand: 'Bosch',
      model: 'Serie 8 WAW325H0SN',
      capacity: 9, // kg
      powerRating: 1400, // watts
      waterConsumption: 46, // liters per cycle
      spinSpeed: 1600, // RPM max
      programs: [
        { id: 'cottons', name: 'Cottons', duration: 150, temp: 60, spinSpeed: 1600, waterLevel: 'high' },
        { id: 'synthetics', name: 'Synthetics', duration: 120, temp: 40, spinSpeed: 1200, waterLevel: 'medium' },
        { id: 'delicates', name: 'Delicates', duration: 60, temp: 30, spinSpeed: 800, waterLevel: 'low' },
        { id: 'wool', name: 'Wool', duration: 40, temp: 20, spinSpeed: 600, waterLevel: 'low' },
        { id: 'quick', name: 'Quick Wash', duration: 30, temp: 30, spinSpeed: 1200, waterLevel: 'medium' },
        { id: 'eco', name: 'Eco 40-60', duration: 240, temp: 50, spinSpeed: 1400, waterLevel: 'medium' },
        { id: 'sportswear', name: 'Sportswear', duration: 90, temp: 30, spinSpeed: 1000, waterLevel: 'medium' }
      ],
      status: 'idle',
      currentProgram: null,
      remainingTime: 0,
      doorLocked: false,
      drumLight: false,
      addWashEnabled: true, // Can pause to add items
      maintenance: {
        drumCleanDue: false,
        filterCleanDue: false,
        lastDrumClean: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
        lastFilterClean: Date.now() - 45 * 24 * 60 * 60 * 1000, // 45 days ago
        cyclesCount: 127,
        totalRuntime: 25400 // minutes
      }
    });
    
    // Dryer
    this.laundryAppliances.set('dryer-001', {
      id: 'dryer-001',
      name: 'Main Dryer',
      type: 'dryer',
      brand: 'Bosch',
      model: 'Serie 8 WTX87M90SN',
      capacity: 9, // kg
      powerRating: 1000, // watts (heat pump efficient)
      heatPumpType: true,
      programs: [
        { id: 'cottons', name: 'Cottons', duration: 120, temp: 60, dryLevel: 'cupboard-dry' },
        { id: 'synthetics', name: 'Synthetics', duration: 90, temp: 50, dryLevel: 'cupboard-dry' },
        { id: 'delicates', name: 'Delicates', duration: 60, temp: 40, dryLevel: 'iron-dry' },
        { id: 'wool', name: 'Wool Finish', duration: 30, temp: 30, dryLevel: 'extra-dry' },
        { id: 'quick', name: 'Quick 40', duration: 40, temp: 60, dryLevel: 'cupboard-dry' },
        { id: 'refresh', name: 'Refresh', duration: 20, temp: 40, dryLevel: 'refresh' },
        { id: 'bedding', name: 'Bedding', duration: 150, temp: 60, dryLevel: 'extra-dry' }
      ],
      status: 'idle',
      currentProgram: null,
      remainingTime: 0,
      doorLocked: false,
      drumLight: false,
      wrinklePrevention: true, // Auto-tumble after cycle
      sensorDrying: true, // Moisture sensor
      maintenance: {
        lintFilterDue: true, // Should clean after each use
        condenserCleanDue: false,
        lastCondenserClean: Date.now() - 60 * 24 * 60 * 60 * 1000, // 60 days ago
        waterTankFull: false,
        cyclesCount: 134,
        totalRuntime: 16800 // minutes
      }
    });
    
    // Detergent Inventory
    this.detergentInventory.set('detergent-001', {
      id: 'detergent-001',
      name: 'Liquid Detergent',
      brand: 'Ariel',
      type: 'liquid',
      category: 'universal',
      volume: 2400, // ml remaining
      totalCapacity: 3000, // ml
      dosagePerLoad: 60, // ml
      loadsRemaining: 40,
      purchaseDate: Date.now() - 15 * 24 * 60 * 60 * 1000,
      expiryDate: Date.now() + 365 * 24 * 60 * 60 * 1000,
      costPerBottle: 89, // SEK
      location: 'laundry-room-shelf'
    });
    
    this.detergentInventory.set('detergent-002', {
      id: 'detergent-002',
      name: 'Color Detergent',
      brand: 'Persil',
      type: 'liquid',
      category: 'color',
      volume: 1500,
      totalCapacity: 2000,
      dosagePerLoad: 50,
      loadsRemaining: 30,
      purchaseDate: Date.now() - 20 * 24 * 60 * 60 * 1000,
      expiryDate: Date.now() + 350 * 24 * 60 * 60 * 1000,
      costPerBottle: 79,
      location: 'laundry-room-shelf'
    });
    
    this.detergentInventory.set('softener-001', {
      id: 'softener-001',
      name: 'Fabric Softener',
      brand: 'Comfort',
      type: 'softener',
      category: 'universal',
      volume: 800,
      totalCapacity: 1500,
      dosagePerLoad: 40,
      loadsRemaining: 20,
      purchaseDate: Date.now() - 10 * 24 * 60 * 60 * 1000,
      expiryDate: Date.now() + 300 * 24 * 60 * 60 * 1000,
      costPerBottle: 45,
      location: 'laundry-room-shelf'
    });
    
    this.detergentInventory.set('stain-remover-001', {
      id: 'stain-remover-001',
      name: 'Stain Remover Spray',
      brand: 'Vanish',
      type: 'stain-remover',
      category: 'spot-treatment',
      volume: 350,
      totalCapacity: 500,
      dosagePerLoad: 0, // Used as needed, not per load
      loadsRemaining: null,
      purchaseDate: Date.now() - 30 * 24 * 60 * 60 * 1000,
      expiryDate: Date.now() + 500 * 24 * 60 * 60 * 1000,
      costPerBottle: 55,
      location: 'laundry-room-shelf'
    });
    
    // Fabric Care Profiles
    this.fabricCareProfiles.set('cotton', {
      fabric: 'cotton',
      washerProgram: 'cottons',
      dryerProgram: 'cottons',
      temperature: 60,
      spinSpeed: 1600,
      dryLevel: 'cupboard-dry',
      detergentType: 'universal',
      specialCare: ['can-bleach', 'high-temp-ok'],
      tips: 'Durable fabric, can handle high temperatures'
    });
    
    this.fabricCareProfiles.set('polyester', {
      fabric: 'polyester',
      washerProgram: 'synthetics',
      dryerProgram: 'synthetics',
      temperature: 40,
      spinSpeed: 1200,
      dryLevel: 'cupboard-dry',
      detergentType: 'color',
      specialCare: ['no-bleach', 'medium-temp'],
      tips: 'Use color detergent to prevent fading'
    });
    
    this.fabricCareProfiles.set('wool', {
      fabric: 'wool',
      washerProgram: 'wool',
      dryerProgram: 'wool',
      temperature: 20,
      spinSpeed: 600,
      dryLevel: 'extra-dry',
      detergentType: 'delicate',
      specialCare: ['no-bleach', 'low-temp', 'gentle-spin', 'air-dry-preferred'],
      tips: 'Use wool-specific detergent, consider air drying'
    });
    
    this.fabricCareProfiles.set('silk', {
      fabric: 'silk',
      washerProgram: 'delicates',
      dryerProgram: 'delicates',
      temperature: 30,
      spinSpeed: 800,
      dryLevel: 'iron-dry',
      detergentType: 'delicate',
      specialCare: ['no-bleach', 'low-temp', 'gentle-spin', 'air-dry-recommended'],
      tips: 'Hand wash preferred, use mesh bag if machine washing'
    });
    
    this.fabricCareProfiles.set('denim', {
      fabric: 'denim',
      washerProgram: 'cottons',
      dryerProgram: 'cottons',
      temperature: 40,
      spinSpeed: 1400,
      dryLevel: 'cupboard-dry',
      detergentType: 'color',
      specialCare: ['wash-inside-out', 'color-preserve'],
      tips: 'Wash inside out to preserve color, avoid overwashing'
    });
    
    // Sample laundry loads (history)
    this.laundryLoads.push({
      id: 'load-1234567890',
      applianceId: 'washer-001',
      loadType: 'mixed',
      fabricTypes: ['cotton', 'polyester'],
      weight: 6.5, // kg
      programUsed: 'cottons',
      detergentUsed: 'detergent-001',
      detergentAmount: 60,
      softenerUsed: true,
      startTime: Date.now() - 3 * 60 * 60 * 1000,
      endTime: Date.now() - 30 * 60 * 1000,
      status: 'completed',
      energyUsed: 0.95, // kWh
      waterUsed: 46, // liters
      cost: 4.75 // SEK (energy + water)
    });
    
    // Scheduled loads
    this.laundrySchedules.push({
      id: 'schedule-001',
      name: 'Weekday Evening Wash',
      applianceId: 'washer-001',
      program: 'cottons',
      loadType: 'mixed',
      scheduledTime: '22:00',
      days: ['mon', 'wed', 'fri'],
      enabled: true,
      autoStart: true,
      estimatedDuration: 150 // minutes
    });
  }
  
  /**
   * Initialize the laundry system
   */
  async initialize() {
    try {
      await this.loadSettings();
      this.startMonitoring();
      
      this.emit('notification', {
        type: 'info',
        priority: 'low',
        title: 'Smart Laundry System',
        message: `Laundry system initialized with ${this.laundryAppliances.size} appliances`
      });
      
      return { success: true, appliances: this.laundryAppliances.size };
    } catch (error) {
      this.emit('notification', {
        type: 'error',
        priority: 'high',
        title: 'Laundry System Error',
        message: `Failed to initialize: ${error.message}`
      });
      throw error;
    }
  }
  
  /**
   * Start a laundry load
   */
  async startLaundryLoad(applianceId, options = {}) {
    try {
      const appliance = this.laundryAppliances.get(applianceId);
      if (!appliance) {
        throw new Error(`Appliance ${applianceId} not found`);
      }
      
      if (appliance.status !== 'idle') {
        throw new Error(`Appliance is currently ${appliance.status}`);
      }
      
      const program = appliance.programs.find(p => p.id === options.programId);
      if (!program) {
        throw new Error(`Program ${options.programId} not found`);
      }
      
      // Check if scheduled for off-peak hours
      if (this.settings.energySavingMode && options.delayStart) {
        const delayMinutes = this.calculateOffPeakDelay();
        if (delayMinutes > 0) {
          appliance.status = 'scheduled';
          appliance.remainingTime = delayMinutes + program.duration;
          
          this.emit('notification', {
            type: 'info',
            priority: 'low',
            title: 'Laundry Scheduled',
            message: `${appliance.name} will start in ${delayMinutes} minutes (off-peak hours)`
          });
          
          // Simulate delay start
          setTimeout(() => {
            this.executeWashCycle(applianceId, program, options);
          }, delayMinutes * 60 * 1000);
          
          await this.saveSettings();
          return { success: true, status: 'scheduled', delayMinutes };
        }
      }
      
      // Start immediately
      return await this.executeWashCycle(applianceId, program, options);
      
    } catch (error) {
      this.emit('notification', {
        type: 'error',
        priority: 'high',
        title: 'Laundry Load Error',
        message: error.message
      });
      throw error;
    }
  }
  
  /**
   * Execute wash/dry cycle
   */
  async executeWashCycle(applianceId, program, options) {
    const appliance = this.laundryAppliances.get(applianceId);
    
    // Update appliance status
    appliance.status = 'running';
    appliance.currentProgram = program.id;
    appliance.remainingTime = program.duration;
    appliance.doorLocked = true;
    appliance.drumLight = true;
    
    // Create load record
    const loadId = `load-${Date.now()}`;
    const load = {
      id: loadId,
      applianceId,
      loadType: options.loadType || 'mixed',
      fabricTypes: options.fabricTypes || ['cotton'],
      weight: options.weight || 5,
      programUsed: program.id,
      detergentUsed: options.detergentId || 'detergent-001',
      detergentAmount: this.calculateDetergentDosage(options.weight, program),
      softenerUsed: options.useSoftener !== false,
      startTime: Date.now(),
      endTime: null,
      status: 'running',
      energyUsed: null,
      waterUsed: null,
      cost: null
    };
    
    this.laundryLoads.unshift(load);
    if (this.laundryLoads.length > 100) {
      this.laundryLoads = this.laundryLoads.slice(0, 100);
    }
    
    // Update detergent inventory
    if (options.detergentId) {
      await this.updateDetergentInventory(options.detergentId, load.detergentAmount);
    }
    
    // Increment cycle count
    appliance.maintenance.cyclesCount++;
    appliance.maintenance.totalRuntime += program.duration;
    
    this.emit('notification', {
      type: 'info',
      priority: 'medium',
      title: 'Laundry Started',
      message: `${appliance.name} - ${program.name} (${program.duration} minutes)`
    });
    
    // Simulate cycle completion
    setTimeout(() => {
      this.completeLaundryLoad(loadId);
    }, program.duration * 60 * 1000);
    
    await this.saveSettings();
    this.clearCache();
    
    return { 
      success: true, 
      loadId, 
      appliance: appliance.name,
      program: program.name,
      estimatedCompletion: new Date(Date.now() + program.duration * 60 * 1000)
    };
  }
  
  /**
   * Complete a laundry load
   */
  completeLaundryLoad(loadId) {
    const load = this.laundryLoads.find(l => l.id === loadId);
    if (!load) return;
    
    const appliance = this.laundryAppliances.get(load.applianceId);
    if (!appliance) return;
    
    // Update load status
    load.endTime = Date.now();
    load.status = 'completed';
    
    // Calculate energy and water usage
    const program = appliance.programs.find(p => p.id === load.programUsed);
    if (appliance.type === 'washer') {
      load.energyUsed = (appliance.powerRating * program.duration / 60 / 1000).toFixed(2); // kWh
      load.waterUsed = appliance.waterConsumption;
    } else if (appliance.type === 'dryer') {
      load.energyUsed = (appliance.powerRating * program.duration / 60 / 1000).toFixed(2);
      load.waterUsed = 0;
    }
    
    // Calculate cost (electricity 2 SEK/kWh, water 0.05 SEK/liter)
    load.cost = (parseFloat(load.energyUsed) * 2 + load.waterUsed * 0.05).toFixed(2);
    
    // Update appliance status
    appliance.status = 'completed';
    appliance.currentProgram = null;
    appliance.remainingTime = 0;
    appliance.doorLocked = false;
    appliance.drumLight = false;
    
    // Wrinkle prevention for dryer
    if (appliance.type === 'dryer' && this.settings.wrinklePreventionEnabled && appliance.wrinklePrevention) {
      appliance.status = 'wrinkle-prevention';
      this.emit('notification', {
        type: 'info',
        priority: 'low',
        title: 'Dryer Complete',
        message: `${appliance.name} - Wrinkle prevention active. Remove clothes soon.`
      });
      
      // Stop wrinkle prevention after 2 hours
      setTimeout(() => {
        if (appliance.status === 'wrinkle-prevention') {
          appliance.status = 'idle';
        }
      }, 2 * 60 * 60 * 1000);
    } else {
      appliance.status = 'idle';
      
      this.emit('notification', {
        type: 'success',
        priority: 'medium',
        title: 'Laundry Complete',
        message: `${appliance.name} - Load complete. Energy: ${load.energyUsed} kWh, Cost: ${load.cost} SEK`
      });
    }
    
    this.saveSettings();
    this.clearCache();
  }
  
  /**
   * Get fabric care recommendation
   */
  getFabricCareRecommendation(fabricType) {
    const cached = this.getCached(`fabric-care-${fabricType}`);
    if (cached) return cached;
    
    const profile = this.fabricCareProfiles.get(fabricType.toLowerCase());
    if (!profile) {
      return {
        success: false,
        message: `No care profile found for fabric: ${fabricType}`,
        defaultRecommendation: {
          washerProgram: 'synthetics',
          temperature: 40,
          dryerProgram: 'synthetics'
        }
      };
    }
    
    const recommendation = {
      fabric: profile.fabric,
      washer: {
        program: profile.washerProgram,
        temperature: profile.temperature,
        spinSpeed: profile.spinSpeed
      },
      dryer: {
        program: profile.dryerProgram,
        dryLevel: profile.dryLevel
      },
      detergent: {
        type: profile.detergentType,
        recommended: this.getRecommendedDetergent(profile.detergentType)
      },
      specialCare: profile.specialCare,
      tips: profile.tips
    };
    
    this.setCached(`fabric-care-${fabricType}`, recommendation);
    return recommendation;
  }
  
  /**
   * Calculate detergent dosage based on load weight
   */
  calculateDetergentDosage(weight, program) {
    const baseAmount = 40; // ml for light load
    const waterLevel = program.waterLevel || 'medium';
    
    let dosage = baseAmount;
    
    if (weight <= 3) {
      dosage = 40;
    } else if (weight <= 5) {
      dosage = 60;
    } else if (weight <= 7) {
      dosage = 80;
    } else {
      dosage = 100;
    }
    
    // Adjust for water level
    if (waterLevel === 'high') {
      dosage *= 1.2;
    } else if (waterLevel === 'low') {
      dosage *= 0.8;
    }
    
    return Math.round(dosage);
  }
  
  /**
   * Update detergent inventory after use
   */
  async updateDetergentInventory(detergentId, amountUsed) {
    const detergent = this.detergentInventory.get(detergentId);
    if (!detergent) return;
    
    detergent.volume -= amountUsed;
    detergent.loadsRemaining = Math.floor(detergent.volume / detergent.dosagePerLoad);
    
    // Low stock alert
    if (detergent.loadsRemaining <= 5 && detergent.loadsRemaining > 0) {
      this.emit('notification', {
        type: 'warning',
        priority: 'medium',
        title: 'Detergent Low',
        message: `${detergent.name} - Only ${detergent.loadsRemaining} loads remaining`
      });
    }
    
    if (detergent.volume <= 0) {
      detergent.volume = 0;
      detergent.loadsRemaining = 0;
      
      this.emit('notification', {
        type: 'error',
        priority: 'high',
        title: 'Detergent Empty',
        message: `${detergent.name} is empty. Please refill.`
      });
    }
    
    await this.saveSettings();
    this.clearCache();
  }
  
  /**
   * Get recommended detergent for fabric type
   */
  getRecommendedDetergent(detergentType) {
    const available = Array.from(this.detergentInventory.values())
      .filter(d => d.category === detergentType && d.loadsRemaining > 0)
      .sort((a, b) => b.loadsRemaining - a.loadsRemaining);
    
    return available.length > 0 ? available[0] : null;
  }
  
  /**
   * Calculate delay for off-peak hours
   */
  calculateOffPeakDelay() {
    const now = new Date();
    const currentHour = now.getHours();
    const targetHour = parseInt(this.settings.preferredWashTime.split(':')[0]);
    
    // If we're past target hour, schedule for tomorrow
    if (currentHour >= targetHour && currentHour < 6) {
      return 0; // Already in off-peak
    }
    
    if (currentHour < targetHour) {
      return (targetHour - currentHour) * 60; // Minutes until target
    }
    
    // Schedule for tomorrow's target hour
    return ((24 - currentHour) + targetHour) * 60;
  }
  
  /**
   * Check maintenance requirements
   */
  checkMaintenanceRequirements() {
    const maintenanceNeeded = [];
    
    for (const [id, appliance] of this.laundryAppliances) {
      const maint = appliance.maintenance;
      const now = Date.now();
      
      // Drum clean needed every 60 days or 90 cycles
      if (appliance.type === 'washer') {
        const daysSinceClean = (now - maint.lastDrumClean) / (24 * 60 * 60 * 1000);
        if (daysSinceClean >= 60 || maint.cyclesCount >= 90) {
          maint.drumCleanDue = true;
          maintenanceNeeded.push({
            applianceId: id,
            appliance: appliance.name,
            type: 'drum-clean',
            urgency: 'medium',
            message: 'Drum cleaning recommended'
          });
        }
        
        // Filter clean every 90 days
        const daysSinceFilter = (now - maint.lastFilterClean) / (24 * 60 * 60 * 1000);
        if (daysSinceFilter >= 90) {
          maint.filterCleanDue = true;
          maintenanceNeeded.push({
            applianceId: id,
            appliance: appliance.name,
            type: 'filter-clean',
            urgency: 'high',
            message: 'Filter cleaning required'
          });
        }
      }
      
      // Dryer lint filter (after every use)
      if (appliance.type === 'dryer') {
        if (maint.lintFilterDue) {
          maintenanceNeeded.push({
            applianceId: id,
            appliance: appliance.name,
            type: 'lint-filter',
            urgency: 'high',
            message: 'Clean lint filter before next use'
          });
        }
        
        // Condenser clean every 90 days
        const daysSinceCondenser = (now - maint.lastCondenserClean) / (24 * 60 * 60 * 1000);
        if (daysSinceCondenser >= 90) {
          maint.condenserCleanDue = true;
          maintenanceNeeded.push({
            applianceId: id,
            appliance: appliance.name,
            type: 'condenser-clean',
            urgency: 'medium',
            message: 'Condenser cleaning recommended'
          });
        }
      }
    }
    
    return maintenanceNeeded;
  }
  
  /**
   * Perform maintenance action
   */
  async performMaintenance(applianceId, maintenanceType) {
    try {
      const appliance = this.laundryAppliances.get(applianceId);
      if (!appliance) {
        throw new Error(`Appliance ${applianceId} not found`);
      }
      
      const now = Date.now();
      const maint = appliance.maintenance;
      
      switch (maintenanceType) {
        case 'drum-clean':
          maint.drumCleanDue = false;
          maint.lastDrumClean = now;
          break;
        case 'filter-clean':
          maint.filterCleanDue = false;
          maint.lastFilterClean = now;
          break;
        case 'lint-filter':
          maint.lintFilterDue = false;
          break;
        case 'condenser-clean':
          maint.condenserCleanDue = false;
          maint.lastCondenserClean = now;
          break;
        default:
          throw new Error(`Unknown maintenance type: ${maintenanceType}`);
      }
      
      // Record in maintenance history
      this.maintenanceHistory.unshift({
        id: `maint-${now}`,
        applianceId,
        type: maintenanceType,
        date: now,
        performedBy: 'user'
      });
      
      if (this.maintenanceHistory.length > 50) {
        this.maintenanceHistory = this.maintenanceHistory.slice(0, 50);
      }
      
      this.emit('notification', {
        type: 'success',
        priority: 'low',
        title: 'Maintenance Complete',
        message: `${appliance.name} - ${maintenanceType} completed`
      });
      
      await this.saveSettings();
      this.clearCache();
      
      return { success: true, appliance: appliance.name, type: maintenanceType };
      
    } catch (error) {
      this.emit('notification', {
        type: 'error',
        priority: 'high',
        title: 'Maintenance Error',
        message: error.message
      });
      throw error;
    }
  }
  
  /**
   * Get laundry statistics
   */
  getLaundryStatistics() {
    const cached = this.getCached('laundry-stats');
    if (cached) return cached;
    
    const completedLoads = this.laundryLoads.filter(l => l.status === 'completed');
    
    const totalLoads = completedLoads.length;
    const totalEnergy = completedLoads.reduce((sum, l) => sum + parseFloat(l.energyUsed || 0), 0);
    const totalWater = completedLoads.reduce((sum, l) => sum + (l.waterUsed || 0), 0);
    const totalCost = completedLoads.reduce((sum, l) => sum + parseFloat(l.cost || 0), 0);
    
    const avgEnergyPerLoad = totalLoads > 0 ? (totalEnergy / totalLoads).toFixed(2) : 0;
    const avgWaterPerLoad = totalLoads > 0 ? Math.round(totalWater / totalLoads) : 0;
    const avgCostPerLoad = totalLoads > 0 ? (totalCost / totalLoads).toFixed(2) : 0;
    
    // Most used programs
    const programUsage = {};
    completedLoads.forEach(load => {
      programUsage[load.programUsed] = (programUsage[load.programUsed] || 0) + 1;
    });
    
    const mostUsedProgram = Object.entries(programUsage)
      .sort((a, b) => b[1] - a[1])[0];
    
    const stats = {
      totalLoads,
      totalEnergy: totalEnergy.toFixed(2),
      totalWater,
      totalCost: totalCost.toFixed(2),
      averages: {
        energyPerLoad: avgEnergyPerLoad,
        waterPerLoad: avgWaterPerLoad,
        costPerLoad: avgCostPerLoad
      },
      mostUsedProgram: mostUsedProgram ? {
        program: mostUsedProgram[0],
        count: mostUsedProgram[1]
      } : null,
      appliances: {
        total: this.laundryAppliances.size,
        active: Array.from(this.laundryAppliances.values())
          .filter(a => a.status !== 'idle').length
      },
      detergent: {
        items: this.detergentInventory.size,
        lowStock: Array.from(this.detergentInventory.values())
          .filter(d => d.loadsRemaining > 0 && d.loadsRemaining <= 5).length
      },
      maintenance: this.checkMaintenanceRequirements().length
    };
    
    this.setCached('laundry-stats', stats);
    return stats;
  }
  
  /**
   * Get all laundry appliances
   */
  getLaundryAppliances() {
    return Array.from(this.laundryAppliances.values());
  }
  
  /**
   * Get recent laundry loads
   */
  getRecentLoads(limit = 20) {
    return this.laundryLoads.slice(0, limit);
  }
  
  /**
   * Get detergent inventory
   */
  getDetergentInventory() {
    return Array.from(this.detergentInventory.values());
  }
  
  /**
   * Start monitoring
   */
  startMonitoring() {
    if (this.monitoring.interval) {
      clearInterval(this.monitoring.interval);
    }
    
    this.monitoring.interval = setInterval(() => {
      this.monitorAppliances();
      this.monitorDetergentInventory();
      this.checkScheduledLoads();
    }, this.monitoring.checkInterval);
  }
  
  /**
   * Monitor appliance status
   */
  monitorAppliances() {
    this.monitoring.lastCheck = Date.now();
    
    for (const [id, appliance] of this.laundryAppliances) {
      // Update remaining time for running appliances
      if (appliance.status === 'running' && appliance.remainingTime > 0) {
        appliance.remainingTime = Math.max(0, appliance.remainingTime - 2); // 2 minutes since last check
      }
    }
  }
  
  /**
   * Monitor detergent inventory
   */
  monitorDetergentInventory() {
    for (const [id, detergent] of this.detergentInventory) {
      if (detergent.loadsRemaining === 5) {
        // Alert already sent when inventory updated
        continue;
      }
    }
  }
  
  /**
   * Check scheduled loads
   */
  checkScheduledLoads() {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const currentDay = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][now.getDay()];
    
    for (const schedule of this.laundrySchedules) {
      if (!schedule.enabled || !schedule.autoStart) continue;
      
      if (schedule.scheduledTime === currentTime && schedule.days.includes(currentDay)) {
        const appliance = this.laundryAppliances.get(schedule.applianceId);
        if (appliance && appliance.status === 'idle') {
          this.emit('notification', {
            type: 'info',
            priority: 'medium',
            title: 'Scheduled Laundry',
            message: `${schedule.name} ready to start. Load machine and confirm.`
          });
        }
      }
    }
  }
  
  /**
   * Cache management
   */
  getCached(key) {
    const cached = this.cache.data.get(key);
    const timestamp = this.cache.timestamps.get(key);
    
    if (cached && timestamp && (Date.now() - timestamp < this.cache.ttl)) {
      return cached;
    }
    
    return null;
  }
  
  setCached(key, value) {
    this.cache.data.set(key, value);
    this.cache.timestamps.set(key, Date.now());
    
    // LRU eviction if cache too large
    if (this.cache.data.size > 50) {
      const oldestKey = Array.from(this.cache.timestamps.entries())
        .sort((a, b) => a[1] - b[1])[0][0];
      this.cache.data.delete(oldestKey);
      this.cache.timestamps.delete(oldestKey);
    }
  }
  
  clearCache() {
    this.cache.data.clear();
    this.cache.timestamps.clear();
  }
  
  /**
   * Load settings from Homey
   */
  async loadSettings() {
    try {
      const settings = Homey.ManagerSettings.get('smartLaundryManagementSystem');
      if (settings) {
        this.laundryAppliances = new Map(settings.laundryAppliances || []);
        this.laundryLoads = settings.laundryLoads || [];
        this.detergentInventory = new Map(settings.detergentInventory || []);
        this.laundrySchedules = settings.laundrySchedules || [];
        this.maintenanceHistory = settings.maintenanceHistory || [];
        Object.assign(this.settings, settings.settings || {});
      }
    } catch (error) {
      console.error('Failed to load laundry settings:', error);
    }
  }
  
  /**
   * Save settings to Homey
   */
  async saveSettings() {
    try {
      const settings = {
        laundryAppliances: Array.from(this.laundryAppliances.entries()),
        laundryLoads: this.laundryLoads,
        detergentInventory: Array.from(this.detergentInventory.entries()),
        laundrySchedules: this.laundrySchedules,
        maintenanceHistory: this.maintenanceHistory,
        settings: this.settings
      };
      
      Homey.ManagerSettings.set('smartLaundryManagementSystem', settings);
    } catch (error) {
      console.error('Failed to save laundry settings:', error);
      throw error;
    }
  }
}

module.exports = SmartLaundryManagementSystem;
