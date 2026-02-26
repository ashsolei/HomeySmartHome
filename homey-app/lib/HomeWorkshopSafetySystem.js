'use strict';

const EventEmitter = require('events');
const Homey = require('homey');

/**
 * Home Workshop Safety System
 * 
 * Comprehensive workshop safety automation with power tool interlocks, hazard detection,
 * environmental monitoring, and project safety tracking.
 * 
 * Features:
 * - Power tool safety interlocks (automatic shutoff)
 * - Dust and air quality monitoring
 * - Safety equipment verification (goggles, gloves, hearing protection)
 * - Emergency stop systems
 * - Fire detection and suppression
 * - Ventilation control (automated exhaust)
 * - Tool usage tracking and maintenance
 * - Project safety checklists
 * - First aid station monitoring
 * 
 * @extends EventEmitter
 */
class HomeWorkshopSafetySystem extends EventEmitter {
  constructor() {
    super();
    
    this.powerTools = new Map();
    this.safetyEquipment = new Map();
    this.safetyZones = new Map();
    this.safetyIncidents = [];
    this.projectSafetyPlans = new Map();
    this.maintenanceLog = [];
    
    this.settings = {
      requireSafetyEquipment: true,
      autoShutoffEnabled: true,
      dustCollectionRequired: true,
      emergencyStopEnabled: true,
      ventilationAutoControl: true,
      maxToolsSimultaneous: 2,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00'
    };
    
    this.environment = {
      temperature: 18, // °C
      humidity: 45, // %
      dustLevel: 15, // µg/m³
      coLevel: 0, // ppm
      noiseLevel: 35, // dB
      lightLevel: 400, // lux
      ventilationActive: false,
      exhaustFanSpeed: 0 // 0-100%
    };
    
    this.emergencyStatus = {
      emergencyStopActivated: false,
      fireDetected: false,
      gasLeakDetected: false,
      powerCutOff: false,
      evacuationRequired: false,
      lastIncident: null
    };
    
    this.cache = {
      data: new Map(),
      timestamps: new Map(),
      ttl: 3 * 60 * 1000 // 3 minutes cache
    };
    
    this.monitoring = {
      interval: null,
      checkInterval: 1 * 60 * 1000, // Check every 1 minute (safety critical)
      lastCheck: null
    };
    
    this.initializeDefaultData();
  }
  
  /**
   * Initialize default workshop data
   */
  initializeDefaultData() {
    // Power Tools
    this.powerTools.set('tool-001', {
      id: 'tool-001',
      name: 'Table Saw',
      type: 'table-saw',
      brand: 'DeWalt',
      model: 'DWE7491RS',
      powerRating: 1850, // watts
      requiresSafetyEquipment: ['safety-glasses', 'hearing-protection'],
      requiresDustCollection: true,
      bladeGuardRequired: true,
      kickbackPrevention: true,
      status: 'off',
      powerState: 'disconnected',
      safetyInterlockActive: true,
      currentDraw: 0,
      runningTime: 0, // minutes
      maintenance: {
        bladeDull: false,
        lastBladeChange: Date.now() - 180 * 24 * 60 * 60 * 1000, // 180 days ago
        hoursUsed: 145,
        nextMaintenance: 200 // hours
      },
      safety: {
        emergencyStopDistance: 2, // meters
        autoStopOnObstacle: true,
        guardSensor: 'ok',
        kickbackDetection: true
      }
    });
    
    this.powerTools.set('tool-002', {
      id: 'tool-002',
      name: 'Router',
      type: 'router',
      brand: 'Bosch',
      model: 'GOF 1600 CE',
      powerRating: 1600,
      requiresSafetyEquipment: ['safety-glasses', 'hearing-protection', 'dust-mask'],
      requiresDustCollection: true,
      status: 'off',
      powerState: 'disconnected',
      safetyInterlockActive: true,
      currentDraw: 0,
      runningTime: 0,
      maintenance: {
        brushesWorn: false,
        lastService: Date.now() - 90 * 24 * 60 * 60 * 1000,
        hoursUsed: 67,
        nextMaintenance: 150
      },
      safety: {
        twoHandOperation: true,
        softStart: true,
        constantSpeed: true
      }
    });
    
    this.powerTools.set('tool-003', {
      id: 'tool-003',
      name: 'Miter Saw',
      type: 'miter-saw',
      brand: 'Makita',
      model: 'LS1219L',
      powerRating: 1650,
      requiresSafetyEquipment: ['safety-glasses', 'hearing-protection'],
      requiresDustCollection: true,
      laserGuideEnabled: true,
      status: 'off',
      powerState: 'disconnected',
      safetyInterlockActive: true,
      currentDraw: 0,
      runningTime: 0,
      maintenance: {
        bladeDull: false,
        lastBladeChange: Date.now() - 120 * 24 * 60 * 60 * 1000,
        hoursUsed: 89,
        nextMaintenance: 150
      },
      safety: {
        guardAutoReturn: true,
        electricBrake: true,
        clampRequired: true
      }
    });
    
    this.powerTools.set('tool-004', {
      id: 'tool-004',
      name: 'Dust Collector',
      type: 'dust-collector',
      brand: 'Shop Fox',
      model: 'W1727',
      powerRating: 1100,
      requiresSafetyEquipment: [],
      requiresDustCollection: false, // It IS the dust collection
      status: 'off',
      powerState: 'connected',
      bagCapacity: 100, // liters
      bagFillLevel: 35, // %
      filterCleanRequired: false,
      cfm: 700, // cubic feet per minute
      maintenance: {
        lastFilterClean: Date.now() - 30 * 24 * 60 * 60 * 1000,
        lastBagEmpty: Date.now() - 7 * 24 * 60 * 60 * 1000,
        hoursUsed: 234,
        nextFilterClean: 300
      }
    });
    
    // Safety Equipment
    this.safetyEquipment.set('safety-glasses', {
      id: 'safety-glasses',
      name: 'Safety Glasses',
      type: 'eye-protection',
      location: 'wall-mount-station',
      quantity: 3,
      inUse: false,
      rfidTag: 'RFID-GLASSES-001',
      lastInspection: Date.now() - 30 * 24 * 60 * 60 * 1000,
      condition: 'good'
    });
    
    this.safetyEquipment.set('hearing-protection', {
      id: 'hearing-protection',
      name: 'Hearing Protection',
      type: 'ear-protection',
      location: 'wall-mount-station',
      quantity: 2,
      inUse: false,
      rfidTag: 'RFID-EARMUFF-001',
      noiseReduction: 32, // dB
      lastInspection: Date.now() - 30 * 24 * 60 * 60 * 1000,
      condition: 'good'
    });
    
    this.safetyEquipment.set('dust-mask', {
      id: 'dust-mask',
      name: 'Dust Mask N95',
      type: 'respiratory-protection',
      location: 'wall-mount-station',
      quantity: 8,
      inUse: false,
      filterRating: 'N95',
      disposable: true,
      lastReplacement: Date.now() - 14 * 24 * 60 * 60 * 1000,
      condition: 'good'
    });
    
    this.safetyEquipment.set('work-gloves', {
      id: 'work-gloves',
      name: 'Work Gloves',
      type: 'hand-protection',
      location: 'wall-mount-station',
      quantity: 4,
      inUse: false,
      material: 'leather',
      cutResistant: true,
      lastInspection: Date.now() - 30 * 24 * 60 * 60 * 1000,
      condition: 'good'
    });
    
    // Safety Zones
    this.safetyZones.set('zone-001', {
      id: 'zone-001',
      name: 'Power Tool Zone',
      area: 'main-workshop',
      type: 'high-risk',
      dimensions: { width: 4, length: 6, height: 2.5 }, // meters
      requiredSafety: ['safety-glasses', 'hearing-protection'],
      maxOccupancy: 2,
      currentOccupancy: 0,
      activeSensors: ['motion', 'proximity', 'dust', 'noise'],
      emergencyExitDistance: 3, // meters
      fireExtinguisherPresent: true,
      firstAidKitPresent: true
    });
    
    this.safetyZones.set('zone-002', {
      id: 'zone-002',
      name: 'Hand Tool Zone',
      area: 'workbench',
      type: 'medium-risk',
      dimensions: { width: 2, length: 2.5, height: 1 },
      requiredSafety: ['safety-glasses'],
      maxOccupancy: 2,
      currentOccupancy: 0,
      activeSensors: ['motion'],
      emergencyExitDistance: 2,
      fireExtinguisherPresent: true,
      firstAidKitPresent: false
    });
    
    this.safetyZones.set('zone-003', {
      id: 'zone-003',
      name: 'Finishing Zone',
      area: 'paint-booth',
      type: 'high-risk',
      dimensions: { width: 2, length: 2, height: 2.5 },
      requiredSafety: ['safety-glasses', 'dust-mask'],
      maxOccupancy: 1,
      currentOccupancy: 0,
      activeSensors: ['motion', 'voc', 'ventilation'],
      ventilationRequired: true,
      emergencyExitDistance: 2,
      fireExtinguisherPresent: true,
      firstAidKitPresent: false
    });
    
    // Project Safety Plans
    this.projectSafetyPlans.set('project-001', {
      id: 'project-001',
      projectName: 'Bookshelf Build',
      startDate: Date.now() - 5 * 24 * 60 * 60 * 1000,
      status: 'in-progress',
      riskLevel: 'medium',
      toolsRequired: ['tool-001', 'tool-002', 'tool-003'],
      safetyChecklist: [
        { item: 'Blade guards in place', checked: true, required: true },
        { item: 'Dust collection connected', checked: true, required: true },
        { item: 'Safety equipment worn', checked: false, required: true },
        { item: 'First aid kit accessible', checked: true, required: true },
        { item: 'Fire extinguisher checked', checked: true, required: true },
        { item: 'Emergency exits clear', checked: true, required: true }
      ],
      hazards: [
        { type: 'kickback', severity: 'high', mitigation: 'Use push stick, maintain stance' },
        { type: 'flying-debris', severity: 'medium', mitigation: 'Safety glasses required' },
        { type: 'noise', severity: 'medium', mitigation: 'Hearing protection required' },
        { type: 'dust', severity: 'medium', mitigation: 'Dust collection, mask if needed' }
      ]
    });
  }
  
  /**
   * Initialize the workshop safety system
   */
  async initialize() {
    try {
      await this.loadSettings();
      this.startMonitoring();
      
      this.emit('notification', {
        type: 'info',
        priority: 'high',
        title: 'Workshop Safety System',
        message: `Workshop safety initialized. ${this.powerTools.size} tools monitored.`
      });
      
      return { success: true, tools: this.powerTools.size, zones: this.safetyZones.size };
    } catch (error) {
      this.emit('notification', {
        type: 'error',
        priority: 'critical',
        title: 'Workshop Safety Error',
        message: `Failed to initialize: ${error.message}`
      });
      throw error;
    }
  }
  
  /**
   * Request tool activation with safety checks
   */
  async requestToolActivation(toolId, _userId = 'user-001') {
    try {
      const tool = this.powerTools.get(toolId);
      if (!tool) {
        throw new Error(`Tool ${toolId} not found`);
      }
      
      // Check emergency status
      if (this.emergencyStatus.emergencyStopActivated) {
        throw new Error('Emergency stop is active. Reset required before using tools.');
      }
      
      if (this.emergencyStatus.powerCutOff) {
        throw new Error('Power is cut off for safety. Check workshop status.');
      }
      
      // Check quiet hours
      if (this.isQuietHours() && tool.type !== 'dust-collector') {
        throw new Error('Cannot activate loud tools during quiet hours');
      }
      
      // Check safety equipment
      if (this.settings.requireSafetyEquipment && tool.requiresSafetyEquipment.length > 0) {
        const equipmentCheck = this.verifySafetyEquipment(tool.requiresSafetyEquipment);
        if (!equipmentCheck.allPresent) {
          throw new Error(`Missing safety equipment: ${equipmentCheck.missing.join(', ')}`);
        }
      }
      
      // Check dust collection
      if (this.settings.dustCollectionRequired && tool.requiresDustCollection) {
        const dustCollector = Array.from(this.powerTools.values())
          .find(t => t.type === 'dust-collector');
        
        if (!dustCollector || dustCollector.status !== 'running') {
          throw new Error('Dust collection must be running before activating this tool');
        }
      }
      
      // Check simultaneous tool limit
      const activeTools = Array.from(this.powerTools.values())
        .filter(t => t.status === 'running' && t.type !== 'dust-collector').length;
      
      if (activeTools >= this.settings.maxToolsSimultaneous) {
        throw new Error(`Maximum ${this.settings.maxToolsSimultaneous} tools can run simultaneously`);
      }
      
      // Activate tool
      tool.status = 'running';
      tool.powerState = 'connected';
      tool.safetyInterlockActive = true;
      tool.currentDraw = tool.powerRating;
      
      // Auto-start dust collector if needed
      if (tool.requiresDustCollection && tool.type !== 'dust-collector') {
        await this.ensureDustCollectionRunning();
      }
      
      // Auto-enable ventilation for high-dust tools
      if (tool.requiresDustCollection && this.settings.ventilationAutoControl) {
        await this.setVentilation(true, 60); // 60% fan speed
      }
      
      this.emit('notification', {
        type: 'success',
        priority: 'medium',
        title: 'Tool Activated',
        message: `${tool.name} is now active. Safety interlocks engaged.`
      });
      
      await this.saveSettings();
      this.clearCache();
      
      return { 
        success: true, 
        tool: tool.name,
        safetyInterlockActive: tool.safetyInterlockActive,
        dustCollectionActive: tool.requiresDustCollection
      };
      
    } catch (error) {
      this.emit('notification', {
        type: 'error',
        priority: 'high',
        title: 'Tool Activation Failed',
        message: error.message
      });
      throw error;
    }
  }
  
  /**
   * Deactivate tool
   */
  async deactivateTool(toolId) {
    try {
      const tool = this.powerTools.get(toolId);
      if (!tool) {
        throw new Error(`Tool ${toolId} not found`);
      }
      
      tool.status = 'off';
      tool.powerState = 'disconnected';
      tool.currentDraw = 0;
      
      // Check if any other tools are running that need dust collection
      const otherToolsRunning = Array.from(this.powerTools.values())
        .filter(t => t.id !== toolId && t.status === 'running' && t.requiresDustCollection).length;
      
      if (otherToolsRunning === 0) {
        // Can safely turn off dust collection after delay
        setTimeout(() => {
          const dustCollector = Array.from(this.powerTools.values())
            .find(t => t.type === 'dust-collector');
          if (dustCollector) {
            dustCollector.status = 'off';
            dustCollector.currentDraw = 0;
          }
          
          // Turn off ventilation
          if (this.settings.ventilationAutoControl) {
            this.setVentilation(false, 0);
          }
        }, 30000); // 30 second delay to clear remaining dust
      }
      
      this.emit('notification', {
        type: 'info',
        priority: 'low',
        title: 'Tool Deactivated',
        message: `${tool.name} has been safely turned off.`
      });
      
      await this.saveSettings();
      this.clearCache();
      
      return { success: true, tool: tool.name };
      
    } catch (error) {
      this.emit('notification', {
        type: 'error',
        priority: 'high',
        title: 'Tool Deactivation Error',
        message: error.message
      });
      throw error;
    }
  }
  
  /**
   * Verify safety equipment is present/worn
   */
  verifySafetyEquipment(requiredEquipment) {
    const present = [];
    const missing = [];
    
    for (const equipId of requiredEquipment) {
      const equipment = this.safetyEquipment.get(equipId);
      if (equipment && equipment.quantity > 0) {
        present.push(equipId);
      } else {
        missing.push(equipId);
      }
    }
    
    return {
      allPresent: missing.length === 0,
      present,
      missing
    };
  }
  
  /**
   * Ensure dust collection is running
   */
  async ensureDustCollectionRunning() {
    const dustCollector = Array.from(this.powerTools.values())
      .find(t => t.type === 'dust-collector');
    
    if (!dustCollector) {
      throw new Error('No dust collector found in workshop');
    }
    
    if (dustCollector.status !== 'running') {
      dustCollector.status = 'running';
      dustCollector.powerState = 'connected';
      dustCollector.currentDraw = dustCollector.powerRating;
      
      this.emit('notification', {
        type: 'info',
        priority: 'medium',
        title: 'Dust Collection Active',
        message: 'Dust collector automatically started'
      });
    }
  }
  
  /**
   * Set ventilation system
   */
  async setVentilation(active, fanSpeed = 50) {
    this.environment.ventilationActive = active;
    this.environment.exhaustFanSpeed = active ? fanSpeed : 0;
    
    if (active) {
      this.emit('notification', {
        type: 'info',
        priority: 'low',
        title: 'Ventilation Active',
        message: `Exhaust fan running at ${fanSpeed}%`
      });
    }
    
    await this.saveSettings();
  }
  
  /**
   * Trigger emergency stop
   */
  async triggerEmergencyStop(reason = 'Manual activation') {
    try {
      this.emergencyStatus.emergencyStopActivated = true;
      this.emergencyStatus.powerCutOff = true;
      this.emergencyStatus.lastIncident = {
        timestamp: Date.now(),
        reason,
        type: 'emergency-stop'
      };
      
      // Immediately cut power to all tools
      for (const [_id, tool] of this.powerTools) {
        if (tool.status === 'running') {
          tool.status = 'emergency-stopped';
          tool.powerState = 'disconnected';
          tool.currentDraw = 0;
        }
      }
      
      // Log incident
      this.safetyIncidents.unshift({
        id: `incident-${Date.now()}`,
        type: 'emergency-stop',
        severity: 'critical',
        reason,
        timestamp: Date.now(),
        toolsAffected: Array.from(this.powerTools.values())
          .filter(t => t.status === 'emergency-stopped')
          .map(t => t.name),
        resolved: false
      });
      
      if (this.safetyIncidents.length > 50) {
        this.safetyIncidents = this.safetyIncidents.slice(0, 50);
      }
      
      this.emit('notification', {
        type: 'error',
        priority: 'critical',
        title: '🚨 EMERGENCY STOP ACTIVATED 🚨',
        message: `All power tools have been shut down. Reason: ${reason}`
      });
      
      await this.saveSettings();
      this.clearCache();
      
      return { success: true, reason, toolsStopped: this.powerTools.size };
      
    } catch (error) {
      console.error('Emergency stop error:', error);
      throw error;
    }
  }
  
  /**
   * Reset emergency stop
   */
  async resetEmergencyStop(userId = 'user-001') {
    try {
      if (!this.emergencyStatus.emergencyStopActivated) {
        return { success: true, message: 'No emergency stop active' };
      }
      
      // Verify workshop is safe
      const safetyCheck = this.performSafetyCheck();
      if (!safetyCheck.safe) {
        throw new Error(`Cannot reset: ${safetyCheck.issues.join(', ')}`);
      }
      
      this.emergencyStatus.emergencyStopActivated = false;
      this.emergencyStatus.powerCutOff = false;
      
      // Reset tools to idle state
      for (const [_id, tool] of this.powerTools) {
        if (tool.status === 'emergency-stopped') {
          tool.status = 'off';
          tool.powerState = 'disconnected';
        }
      }
      
      // Mark incident as resolved
      if (this.safetyIncidents.length > 0) {
        this.safetyIncidents[0].resolved = true;
        this.safetyIncidents[0].resolvedAt = Date.now();
        this.safetyIncidents[0].resolvedBy = userId;
      }
      
      this.emit('notification', {
        type: 'success',
        priority: 'high',
        title: 'Emergency Stop Reset',
        message: 'Workshop is ready for use. Safety checks passed.'
      });
      
      await this.saveSettings();
      this.clearCache();
      
      return { success: true, message: 'Emergency stop reset successfully' };
      
    } catch (error) {
      this.emit('notification', {
        type: 'error',
        priority: 'high',
        title: 'Reset Failed',
        message: error.message
      });
      throw error;
    }
  }
  
  /**
   * Perform comprehensive safety check
   */
  performSafetyCheck() {
    const issues = [];
    
    // Check fire detection
    if (this.emergencyStatus.fireDetected) {
      issues.push('Fire detected');
    }
    
    // Check gas leaks
    if (this.emergencyStatus.gasLeakDetected) {
      issues.push('Gas leak detected');
    }
    
    // Check dust levels
    if (this.environment.dustLevel > 100) {
      issues.push('Dust level too high');
    }
    
    // Check CO levels
    if (this.environment.coLevel > 50) {
      issues.push('CO level dangerous');
    }
    
    // Check emergency exits
    for (const [_id, zone] of this.safetyZones) {
      if (zone.type === 'high-risk' && !zone.fireExtinguisherPresent) {
        issues.push(`No fire extinguisher in ${zone.name}`);
      }
    }
    
    return {
      safe: issues.length === 0,
      issues,
      timestamp: Date.now()
    };
  }
  
  /**
   * Check if currently in quiet hours
   */
  isQuietHours() {
    const now = new Date();
    const currentHour = now.getHours();
    const startHour = parseInt(this.settings.quietHoursStart.split(':')[0]);
    const endHour = parseInt(this.settings.quietHoursEnd.split(':')[0]);
    
    if (startHour < endHour) {
      return currentHour >= startHour && currentHour < endHour;
    } else {
      return currentHour >= startHour || currentHour < endHour;
    }
  }
  
  /**
   * Get workshop safety status
   */
  getWorkshopStatus() {
    const cached = this.getCached('workshop-status');
    if (cached) return cached;
    
    const activeTools = Array.from(this.powerTools.values())
      .filter(t => t.status === 'running');
    
    const status = {
      safe: !this.emergencyStatus.emergencyStopActivated,
      emergencyStop: this.emergencyStatus.emergencyStopActivated,
      activeTools: activeTools.length,
      activePowerDraw: activeTools.reduce((sum, t) => sum + t.currentDraw, 0),
      environment: {
        temperature: this.environment.temperature,
        humidity: this.environment.humidity,
        dustLevel: this.environment.dustLevel,
        dustStatus: this.environment.dustLevel < 50 ? 'good' : this.environment.dustLevel < 100 ? 'fair' : 'poor',
        noiseLevel: this.environment.noiseLevel,
        ventilationActive: this.environment.ventilationActive
      },
      safetyEquipmentStatus: this.getSafetyEquipmentStatus(),
      recentIncidents: this.safetyIncidents.slice(0, 5),
      maintenanceRequired: this.checkMaintenanceRequired()
    };
    
    this.setCached('workshop-status', status);
    return status;
  }
  
  /**
   * Get safety equipment status
   */
  getSafetyEquipmentStatus() {
    const equipment = Array.from(this.safetyEquipment.values());
    return {
      total: equipment.length,
      available: equipment.filter(e => e.quantity > 0 && e.condition === 'good').length,
      inUse: equipment.filter(e => e.inUse).length,
      needsReplacement: equipment.filter(e => e.condition === 'worn' || e.quantity === 0).length
    };
  }
  
  /**
   * Check maintenance requirements
   */
  checkMaintenanceRequired() {
    const maintenanceNeeded = [];
    
    for (const [id, tool] of this.powerTools) {
      const maint = tool.maintenance;
      
      if (maint.hoursUsed >= maint.nextMaintenance) {
        maintenanceNeeded.push({
          toolId: id,
          tool: tool.name,
          type: 'scheduled-maintenance',
          urgency: 'high',
          message: `Scheduled maintenance due (${maint.hoursUsed} hours used)`
        });
      }
      
      if (tool.type === 'table-saw' || tool.type === 'miter-saw') {
        const daysSinceBladeChange = (Date.now() - maint.lastBladeChange) / (24 * 60 * 60 * 1000);
        if (daysSinceBladeChange >= 180 || maint.bladeDull) {
          maintenanceNeeded.push({
            toolId: id,
            tool: tool.name,
            type: 'blade-change',
            urgency: 'medium',
            message: 'Blade replacement recommended'
          });
        }
      }
      
      if (tool.type === 'dust-collector') {
        if (maint.bagFillLevel >= 80) {
          maintenanceNeeded.push({
            toolId: id,
            tool: tool.name,
            type: 'empty-bag',
            urgency: 'high',
            message: 'Dust bag needs emptying'
          });
        }
      }
    }
    
    return maintenanceNeeded;
  }
  
  /**
   * Get workshop statistics
   */
  getWorkshopStatistics() {
    const cached = this.getCached('workshop-stats');
    if (cached) return cached;
    
    const tools = Array.from(this.powerTools.values());
    const totalHoursUsed = tools.reduce((sum, t) => sum + (t.maintenance.hoursUsed || 0), 0);
    
    const stats = {
      tools: {
        total: this.powerTools.size,
        active: tools.filter(t => t.status === 'running').length,
        maintenance: this.checkMaintenanceRequired().length
      },
      usage: {
        totalHours: totalHoursUsed,
        averagePerTool: (totalHoursUsed / tools.length).toFixed(1)
      },
      safety: {
        totalIncidents: this.safetyIncidents.length,
        unresolvedIncidents: this.safetyIncidents.filter(i => !i.resolved).length,
        emergencyStopsTotal: this.safetyIncidents.filter(i => i.type === 'emergency-stop').length,
        daysSinceLastIncident: this.safetyIncidents.length > 0 
          ? Math.floor((Date.now() - this.safetyIncidents[0].timestamp) / (24 * 60 * 60 * 1000))
          : null
      },
      environment: {
        averageDustLevel: this.environment.dustLevel,
        averageNoiseLevel: this.environment.noiseLevel,
        ventilationRuntime: '45%' // Simulated
      },
      projects: {
        total: this.projectSafetyPlans.size,
        active: Array.from(this.projectSafetyPlans.values())
          .filter(p => p.status === 'in-progress').length
      }
    };
    
    this.setCached('workshop-stats', stats);
    return stats;
  }
  
  /**
   * Get all power tools
   */
  getPowerTools() {
    return Array.from(this.powerTools.values());
  }
  
  /**
   * Get safety zones
   */
  getSafetyZones() {
    return Array.from(this.safetyZones.values());
  }
  
  /**
   * Get safety equipment
   */
  getSafetyEquipment() {
    return Array.from(this.safetyEquipment.values());
  }
  
  /**
   * Start monitoring
   */
  startMonitoring() {
    if (this.monitoring.interval) {
      clearInterval(this.monitoring.interval);
    }
    
    this.monitoring.interval = setInterval(() => {
      this.monitorEnvironment();
      this.monitorToolStatus();
      this.monitorSafety();
    }, this.monitoring.checkInterval);
  }
  
  /**
   * Monitor environment
   */
  monitorEnvironment() {
    this.monitoring.lastCheck = Date.now();
    
    // Simulate environmental changes based on tool usage
    const activeTools = Array.from(this.powerTools.values())
      .filter(t => t.status === 'running' && t.type !== 'dust-collector');
    
    if (activeTools.length > 0) {
      // Increase dust and noise when tools active
      this.environment.dustLevel = Math.min(150, this.environment.dustLevel + 5);
      this.environment.noiseLevel = 85 + (activeTools.length * 5);
      this.environment.temperature = Math.min(25, this.environment.temperature + 0.5);
    } else {
      // Decrease when idle
      if (this.environment.ventilationActive) {
        this.environment.dustLevel = Math.max(10, this.environment.dustLevel - 10);
      } else {
        this.environment.dustLevel = Math.max(10, this.environment.dustLevel - 2);
      }
      this.environment.noiseLevel = 35;
      this.environment.temperature = Math.max(18, this.environment.temperature - 0.3);
    }
    
    // Alert on high dust
    if (this.environment.dustLevel > 100) {
      this.emit('notification', {
        type: 'warning',
        priority: 'high',
        title: 'High Dust Level',
        message: `Dust level: ${this.environment.dustLevel} µg/m³. Increase ventilation or enable dust collection.`
      });
    }
  }
  
  /**
   * Monitor tool status
   */
  monitorToolStatus() {
    for (const [_id, tool] of this.powerTools) {
      if (tool.status === 'running') {
        tool.runningTime += 1; // 1 minute since last check
        tool.maintenance.hoursUsed += (1 / 60); // Convert minutes to hours
        
        // Check for overheating (simulated)
        if (tool.runningTime > 60 && tool.type !== 'dust-collector') {
          this.emit('notification', {
            type: 'warning',
            priority: 'medium',
            title: 'Tool Running Long',
            message: `${tool.name} has been running for ${tool.runningTime} minutes. Consider taking a break.`
          });
        }
      }
    }
  }
  
  /**
   * Monitor safety
   */
  monitorSafety() {
    // Check for safety violations
    const activeTools = Array.from(this.powerTools.values())
      .filter(t => t.status === 'running' && t.type !== 'dust-collector');
    
    if (activeTools.length > this.settings.maxToolsSimultaneous) {
      this.emit('notification', {
        type: 'error',
        priority: 'critical',
        title: 'Safety Violation',
        message: `Too many tools running simultaneously (${activeTools.length}). Maximum allowed: ${this.settings.maxToolsSimultaneous}`
      });
    }
    
    // Check dust collector is running when needed
    if (this.settings.dustCollectionRequired) {
      const toolsNeedingDust = activeTools.filter(t => t.requiresDustCollection);
      const dustCollector = Array.from(this.powerTools.values())
        .find(t => t.type === 'dust-collector');
      
      if (toolsNeedingDust.length > 0 && (!dustCollector || dustCollector.status !== 'running')) {
        this.emit('notification', {
          type: 'error',
          priority: 'critical',
          title: 'Safety Violation',
          message: 'Dust collection required but not running!'
        });
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
    
    if (this.cache.data.size > 30) {
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
      const settings = Homey.ManagerSettings.get('homeWorkshopSafetySystem');
      if (settings) {
        this.powerTools = new Map(settings.powerTools || []);
        this.safetyEquipment = new Map(settings.safetyEquipment || []);
        this.safetyZones = new Map(settings.safetyZones || []);
        this.safetyIncidents = settings.safetyIncidents || [];
        this.projectSafetyPlans = new Map(settings.projectSafetyPlans || []);
        this.maintenanceLog = settings.maintenanceLog || [];
        Object.assign(this.settings, settings.settings || {});
        Object.assign(this.environment, settings.environment || {});
        Object.assign(this.emergencyStatus, settings.emergencyStatus || {});
      }
    } catch (error) {
      console.error('Failed to load workshop settings:', error);
    }
  }
  
  /**
   * Save settings to Homey
   */
  async saveSettings() {
    try {
      const settings = {
        powerTools: Array.from(this.powerTools.entries()),
        safetyEquipment: Array.from(this.safetyEquipment.entries()),
        safetyZones: Array.from(this.safetyZones.entries()),
        safetyIncidents: this.safetyIncidents,
        projectSafetyPlans: Array.from(this.projectSafetyPlans.entries()),
        maintenanceLog: this.maintenanceLog,
        settings: this.settings,
        environment: this.environment,
        emergencyStatus: this.emergencyStatus
      };
      
      Homey.ManagerSettings.set('homeWorkshopSafetySystem', settings);
    } catch (error) {
      console.error('Failed to save workshop settings:', error);
      throw error;
    }
  }
}

module.exports = HomeWorkshopSafetySystem;
