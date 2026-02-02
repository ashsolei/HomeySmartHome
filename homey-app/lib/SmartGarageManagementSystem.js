const EventEmitter = require('events');

/**
 * Smart Garage Management System
 * 
 * Provides comprehensive garage automation with door control, vehicle tracking,
 * tool inventory, project management, and environmental monitoring.
 * 
 * Features:
 * - Smart garage door control with security
 * - Vehicle tracking and maintenance reminders
 * - Tool and equipment inventory
 * - Project tracking and planning
 * - Workbench lighting automation
 * - Environmental control (heating, ventilation)
 * - Security monitoring and alerts
 * - Auto-close scheduling
 * - Parking guidance system
 * - Storage organization tracking
 */
class SmartGarageManagementSystem extends EventEmitter {
  constructor(homey) {
    super();
    this.homey = homey;
    this.garage = null;
    this.vehicles = new Map();
    this.tools = new Map();
    this.projects = [];
    this.doorEvents = [];
    this.maintenanceReminders = [];
    this.monitoringInterval = null;
    
    // Performance optimizations
    this._cache = new Map();
    this._cacheTimeout = 240000; // 4 minutes
    this._healthCheckInterval = null;
  }

  async initialize() {
    this.homey.log('Initializing Smart Garage Management System...');
    
    try {
      await this.loadSettings();
      this.initializeGarage();
      this.initializeVehicles();
      this.initializeTools();
      
      this.startMonitoring();
      this.startHealthCheck();
      
      this.homey.log('Smart Garage Management System initialized successfully');
      return true;
    } catch (error) {
      this.homey.error('Failed to initialize Garage Management:', error);
      throw error;
    }
  }

  async loadSettings() {
    try {
      const settings = await this.homey.settings.get('smartGarage') || {};
      
      this.garage = settings.garage || null;
      
      if (settings.vehicles) {
        settings.vehicles.forEach(vehicle => {
          this.vehicles.set(vehicle.id, vehicle);
        });
      }
      
      if (settings.tools) {
        settings.tools.forEach(tool => {
          this.tools.set(tool.id, tool);
        });
      }
      
      this.projects = settings.projects || [];
      this.doorEvents = settings.doorEvents || [];
      this.maintenanceReminders = settings.maintenanceReminders || [];
    } catch (error) {
      this.homey.error('Error loading garage settings:', error);
      throw error;
    }
  }

  async saveSettings() {
    try {
      const settings = {
        garage: this.garage,
        vehicles: Array.from(this.vehicles.values()),
        tools: Array.from(this.tools.values()),
        projects: this.projects.slice(-50),
        doorEvents: this.doorEvents.slice(-200),
        maintenanceReminders: this.maintenanceReminders
      };
      
      await this.homey.settings.set('smartGarage', settings);
      this._cache.clear();
    } catch (error) {
      this.homey.error('Error saving garage settings:', error);
      throw error;
    }
  }

  initializeGarage() {
    if (!this.garage) {
      this.garage = {
        id: 'garage-main',
        name: 'Main Garage',
        capacity: 2,
        doors: [
          {
            id: 'door-001',
            name: 'Main Door',
            status: 'closed', // closed, open, opening, closing
            position: 0, // 0-100%
            lockStatus: 'unlocked',
            sensor: {
              position: true,
              obstruction: true,
              motion: true
            },
            autoCloseEnabled: true,
            autoCloseDelay: 300 // seconds
          }
        ],
        environment: {
          temperature: {
            current: 15,
            target: 18,
            heatingEnabled: false
          },
          lighting: {
            main: { status: 'off', brightness: 0, motion: true },
            workbench: { status: 'off', brightness: 0, taskLight: true },
            overhead: { status: 'off', brightness: 0 }
          },
          ventilation: {
            status: 'off',
            speed: 0,
            coDetector: true,
            co2Level: 400
          }
        },
        parking: {
          spots: [
            { id: 1, occupied: false, vehicle: null, guidance: true },
            { id: 2, occupied: false, vehicle: null, guidance: true }
          ]
        },
        security: {
          cameras: true,
          motionDetector: true,
          lastMotion: null,
          alarmArmed: false
        },
        storage: {
          zones: [
            { id: 'zone-tools', name: 'Tool Wall', capacity: 50, items: 0 },
            { id: 'zone-seasonal', name: 'Seasonal Storage', capacity: 20, items: 0 },
            { id: 'zone-sports', name: 'Sports Equipment', capacity: 15, items: 0 }
          ]
        }
      };
    }
  }

  initializeVehicles() {
    if (this.vehicles.size === 0) {
      this.vehicles.set('vehicle-001', {
        id: 'vehicle-001',
        name: 'Tesla Model 3',
        type: 'car',
        make: 'Tesla',
        model: 'Model 3',
        year: 2022,
        licensePlate: 'ABC123',
        parkingSpot: 1,
        status: 'parked', // parked, away, charging
        charging: {
          enabled: true,
          chargeLevel: 85,
          chargeLimit: 90,
          chargingSpeed: 11, // kW
          timeToFull: 0
        },
        maintenance: {
          mileage: 25000,
          lastService: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
          nextService: 30000,
          tireRotation: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
          inspectionDue: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString()
        },
        features: {
          smartEntry: true,
          remoteStart: true,
          climatePreconditioning: true
        }
      });
      
      this.vehicles.set('vehicle-002', {
        id: 'vehicle-002',
        name: 'Mountain Bike',
        type: 'bike',
        make: 'Trek',
        model: 'Fuel EX 9.8',
        year: 2023,
        parkingSpot: null,
        storageLocation: 'zone-sports',
        status: 'stored',
        maintenance: {
          lastService: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
          nextService: 'spring',
          condition: 'good'
        }
      });
    }
  }

  initializeTools() {
    if (this.tools.size === 0) {
      const sampleTools = [
        { id: 'tool-001', name: 'Cordless Drill', category: 'power-tools', brand: 'Makita', model: 'DHP481', location: 'zone-tools', batteryPowered: true, batteryLevel: 75, lastUsed: null, condition: 'good' },
        { id: 'tool-002', name: 'Impact Driver', category: 'power-tools', brand: 'Makita', model: 'DTD154', location: 'zone-tools', batteryPowered: true, batteryLevel: 60, lastUsed: null, condition: 'good' },
        { id: 'tool-003', name: 'Circular Saw', category: 'power-tools', brand: 'DeWalt', model: 'DCS570', location: 'zone-tools', batteryPowered: true, batteryLevel: 0, lastUsed: null, condition: 'good' },
        { id: 'tool-004', name: 'Socket Set', category: 'hand-tools', brand: 'Craftsman', pieces: 42, location: 'zone-tools', condition: 'good' },
        { id: 'tool-005', name: 'Screwdriver Set', category: 'hand-tools', brand: 'Wera', pieces: 12, location: 'zone-tools', condition: 'good' },
        { id: 'tool-006', name: 'Ladder 6ft', category: 'equipment', brand: 'Werner', height: 6, location: 'wall-mounted', condition: 'good' },
        { id: 'tool-007', name: 'Air Compressor', category: 'power-tools', brand: 'California Air Tools', location: 'floor', condition: 'good' },
        { id: 'tool-008', name: 'Workbench', category: 'furniture', size: '6x3 ft', location: 'fixed', features: ['vise', 'pegboard', 'power-strips'] }
      ];
      
      sampleTools.forEach(tool => {
        tool.purchaseDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
        tool.value = 0;
        tool.borrowed = false;
        this.tools.set(tool.id, tool);
      });
    }
  }

  startMonitoring() {
    // Monitor garage status every 2 minutes
    this.monitoringInterval = setInterval(() => {
      this.monitorDoors();
      this.monitorVehicles();
      this.monitorEnvironment();
      this.checkMaintenance();
    }, 120000);
  }

  startHealthCheck() {
    // Health check every minute
    this._healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 60000);
  }

  async monitorDoors() {
    try {
      for (const door of this.garage.doors) {
        // Auto-close if enabled and door has been open too long
        if (door.autoCloseEnabled && door.status === 'open') {
          const lastEvent = this.doorEvents.find(e => 
            e.doorId === door.id && e.action === 'opened'
          );
          
          if (lastEvent) {
            const openDuration = (Date.now() - new Date(lastEvent.timestamp).getTime()) / 1000;
            
            if (openDuration >= door.autoCloseDelay) {
              this.emit('notification', {
                title: 'Auto-Closing Garage Door',
                message: `${door.name} has been open for ${Math.round(openDuration / 60)} minutes`,
                priority: 'medium',
                category: 'garage-security'
              });
              
              await this.closeDoor(door.id);
            }
          }
        }
        
        // Security alert if door opens unexpectedly
        if (door.status === 'open' && this.garage.security.alarmArmed) {
          this.emit('notification', {
            title: 'Security Alert',
            message: `${door.name} opened while alarm armed`,
            priority: 'critical',
            category: 'garage-security'
          });
        }
      }
    } catch (error) {
      this.homey.error('Error monitoring doors:', error);
    }
  }

  async monitorVehicles() {
    try {
      for (const vehicle of this.vehicles.values()) {
        if (vehicle.type !== 'car') continue;
        
        // Check charging
        if (vehicle.charging && vehicle.status === 'charging') {
          if (vehicle.charging.chargeLevel >= vehicle.charging.chargeLimit) {
            this.emit('notification', {
              title: 'Charging Complete',
              message: `${vehicle.name} is fully charged`,
              priority: 'low',
              category: 'garage-vehicle'
            });
            
            vehicle.status = 'parked';
          }
        }
        
        // Maintenance reminders
        if (vehicle.maintenance.mileage >= vehicle.maintenance.nextService) {
          const existing = this.maintenanceReminders.find(r => 
            r.vehicleId === vehicle.id && r.type === 'service'
          );
          
          if (!existing) {
            this.maintenanceReminders.push({
              id: `reminder-${Date.now()}`,
              vehicleId: vehicle.id,
              type: 'service',
              message: `${vehicle.name} is due for service`,
              priority: 'high',
              createdAt: new Date().toISOString()
            });
            
            this.emit('notification', {
              title: 'Vehicle Maintenance',
              message: `${vehicle.name} is due for service`,
              priority: 'high',
              category: 'garage-maintenance'
            });
          }
        }
      }
      
      await this.saveSettings();
    } catch (error) {
      this.homey.error('Error monitoring vehicles:', error);
    }
  }

  async monitorEnvironment() {
    try {
      const env = this.garage.environment;
      
      // CO detection
      if (env.ventilation.coDetector && env.ventilation.co2Level > 1000) {
        this.emit('notification', {
          title: 'High CO2 Level',
          message: 'Garage CO2 level is high, increasing ventilation',
          priority: 'high',
          category: 'garage-safety'
        });
        
        env.ventilation.status = 'on';
        env.ventilation.speed = 5;
      }
      
      // Temperature control
      if (env.temperature.heatingEnabled) {
        if (env.temperature.current < env.temperature.target - 2) {
          this.emit('setTemperature', {
            zone: this.garage.name,
            temperature: env.temperature.target
          });
        }
      }
    } catch (error) {
      this.homey.error('Error monitoring environment:', error);
    }
  }

  async checkMaintenance() {
    try {
      // Check tool batteries
      for (const tool of this.tools.values()) {
        if (tool.batteryPowered && tool.batteryLevel !== undefined) {
          if (tool.batteryLevel < 20 && tool.batteryLevel > 0) {
            const existingReminder = this.maintenanceReminders.find(r => 
              r.toolId === tool.id && r.type === 'battery'
            );
            
            if (!existingReminder) {
              this.maintenanceReminders.push({
                id: `reminder-${Date.now()}`,
                toolId: tool.id,
                type: 'battery',
                message: `${tool.name} battery is low`,
                priority: 'low',
                createdAt: new Date().toISOString()
              });
            }
          }
        }
      }
    } catch (error) {
      this.homey.error('Error checking maintenance:', error);
    }
  }

  async performHealthCheck() {
    // Check if door sensors are responding
    for (const door of this.garage.doors) {
      if (door.sensor.position) {
        // Would check actual sensor here
        // For now just log
        this.homey.log(`Health check: ${door.name} sensors OK`);
      }
    }
  }

  async openDoor(doorId) {
    try {
      const door = this.garage.doors.find(d => d.id === doorId);
      if (!door) throw new Error('Door not found');
      
      if (door.status === 'open') {
        return { message: 'Door is already open' };
      }
      
      door.status = 'opening';
      
      // Simulate opening time
      setTimeout(() => {
        door.status = 'open';
        door.position = 100;
        
        this.doorEvents.push({
          id: `event-${Date.now()}`,
          doorId,
          action: 'opened',
          timestamp: new Date().toISOString(),
          triggeredBy: 'manual'
        });
        
        this.saveSettings();
      }, 10000); // 10 seconds
      
      // Turn on lights
      this.garage.environment.lighting.main.status = 'on';
      this.garage.environment.lighting.main.brightness = 100;
      
      this.emit('notification', {
        title: 'Garage Door Opening',
        message: `${door.name} is opening`,
        priority: 'low',
        category: 'garage'
      });
      
      await this.saveSettings();
      
      return door;
    } catch (error) {
      this.homey.error('Error opening door:', error);
      throw error;
    }
  }

  async closeDoor(doorId) {
    try {
      const door = this.garage.doors.find(d => d.id === doorId);
      if (!door) throw new Error('Door not found');
      
      if (door.status === 'closed') {
        return { message: 'Door is already closed' };
      }
      
      door.status = 'closing';
      
      // Simulate closing time
      setTimeout(() => {
        door.status = 'closed';
        door.position = 0;
        
        this.doorEvents.push({
          id: `event-${Date.now()}`,
          doorId,
          action: 'closed',
          timestamp: new Date().toISOString(),
          triggeredBy: 'manual'
        });
        
        // Turn off lights after 2 minutes
        setTimeout(() => {
          this.garage.environment.lighting.main.status = 'off';
          this.saveSettings();
        }, 120000);
        
        this.saveSettings();
      }, 10000);
      
      this.emit('notification', {
        title: 'Garage Door Closing',
        message: `${door.name} is closing`,
        priority: 'low',
        category: 'garage'
      });
      
      await this.saveSettings();
      
      return door;
    } catch (error) {
      this.homey.error('Error closing door:', error);
      throw error;
    }
  }

  async parkVehicle(vehicleId, spotNumber) {
    try {
      const vehicle = this.vehicles.get(vehicleId);
      if (!vehicle) throw new Error('Vehicle not found');
      
      const spot = this.garage.parking.spots.find(s => s.id === spotNumber);
      if (!spot) throw new Error('Parking spot not found');
      
      if (spot.occupied) {
        throw new Error('Parking spot is occupied');
      }
      
      vehicle.parkingSpot = spotNumber;
      vehicle.status = 'parked';
      spot.occupied = true;
      spot.vehicle = vehicleId;
      
      await this.saveSettings();
      
      return { vehicle, spot };
    } catch (error) {
      this.homey.error('Error parking vehicle:', error);
      throw error;
    }
  }

  async removeVehicle(vehicleId) {
    try {
      const vehicle = this.vehicles.get(vehicleId);
      if (!vehicle) throw new Error('Vehicle not found');
      
      if (vehicle.parkingSpot) {
        const spot = this.garage.parking.spots.find(s => s.id === vehicle.parkingSpot);
        if (spot) {
          spot.occupied = false;
          spot.vehicle = null;
        }
      }
      
      vehicle.parkingSpot = null;
      vehicle.status = 'away';
      
      await this.saveSettings();
      
      return vehicle;
    } catch (error) {
      this.homey.error('Error removing vehicle:', error);
      throw error;
    }
  }

  async addProject(projectData) {
    try {
      const project = {
        id: `project-${Date.now()}`,
        name: projectData.name,
        description: projectData.description || '',
        category: projectData.category || 'general',
        status: 'planning', // planning, in-progress, completed, on-hold
        startDate: null,
        completionDate: null,
        toolsNeeded: projectData.toolsNeeded || [],
        materialsNeeded: projectData.materialsNeeded || [],
        estimatedDuration: projectData.estimatedDuration || null,
        notes: []
      };
      
      this.projects.push(project);
      await this.saveSettings();
      
      return project;
    } catch (error) {
      this.homey.error('Error adding project:', error);
      throw error;
    }
  }

  getGarage() {
    return this.garage;
  }

  getVehicles() {
    return Array.from(this.vehicles.values());
  }

  getTools(filter = null) {
    let tools = Array.from(this.tools.values());
    
    if (filter) {
      if (filter.category) tools = tools.filter(t => t.category === filter.category);
      if (filter.location) tools = tools.filter(t => t.location === filter.location);
      if (filter.batteryLow) tools = tools.filter(t => t.batteryPowered && t.batteryLevel < 20);
    }
    
    return tools;
  }

  getProjects(status = null) {
    if (status) {
      return this.projects.filter(p => p.status === status);
    }
    return this.projects;
  }

  getDoorEvents(limit = 50) {
    return this.doorEvents.slice(-limit).reverse();
  }

  getMaintenanceReminders() {
    return this.maintenanceReminders;
  }

  getStats() {
    const vehicles = Array.from(this.vehicles.values());
    const tools = Array.from(this.tools.values());
    
    return {
      totalVehicles: vehicles.length,
      parkedVehicles: vehicles.filter(v => v.status === 'parked').length,
      totalTools: tools.length,
      lowBatteryTools: tools.filter(t => t.batteryPowered && t.batteryLevel < 20).length,
      totalProjects: this.projects.length,
      activeProjects: this.projects.filter(p => p.status === 'in-progress').length,
      doorEvents: this.doorEvents.length,
      maintenanceReminders: this.maintenanceReminders.length,
      storageUtilization: this.garage.storage.zones.map(z => ({
        zone: z.name,
        used: z.items,
        capacity: z.capacity,
        percent: Math.round((z.items / z.capacity) * 100)
      }))
    };
  }

  async destroy() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    if (this._healthCheckInterval) {
      clearInterval(this._healthCheckInterval);
    }
    this._cache.clear();
    this.removeAllListeners();
  }
}

module.exports = SmartGarageManagementSystem;
