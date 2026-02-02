'use strict';

const EventEmitter = require('events');
const Homey = require('homey');

/**
 * Smart Pet Door & Activity System
 * 
 * Intelligent pet door with selective access, activity tracking, and pet health monitoring.
 * 
 * @extends EventEmitter
 */
class SmartPetDoorActivitySystem extends EventEmitter {
  constructor() {
    super();
    
    this.pets = new Map();
    this.petDoors = new Map();
    this.activityLog = [];
    this.healthMetrics = [];
    
    this.settings = {
      selectiveAccessEnabled: true,
      curfewEnabled: true,
      curfewStart: '22:00',
      curfewEnd: '06:00',
      activityAlertsEnabled: true,
      nightModeEnabled: true
    };
    
    this.cache = { data: new Map(), timestamps: new Map(), ttl: 3 * 60 * 1000 };
    this.monitoring = { interval: null, checkInterval: 1 * 60 * 1000, lastCheck: null };
    
    this.initializeDefaultData();
  }
  
  initializeDefaultData() {
    this.pets.set('pet-001', {
      id: 'pet-001',
      name: 'Luna',
      type: 'cat',
      breed: 'Maine Coon',
      age: 3,
      weight: 5.2, // kg
      microchipId: 'CHIP-123456789',
      rfidTag: 'RFID-CAT-001',
      accessPermissions: ['door-001'],
      location: 'inside',
      lastSeen: Date.now() - 30 * 60 * 1000,
      lastEntry: Date.now() - 2 * 60 * 60 * 1000,
      lastExit: Date.now() - 30 * 60 * 1000,
      dailyActivity: 12, // entries/exits today
      health: {
        status: 'good',
        lastVetVisit: Date.now() - 90 * 24 * 60 * 60 * 1000,
        nextVaccination: Date.now() + 90 * 24 * 60 * 60 * 1000,
        medications: []
      }
    });
    
    this.pets.set('pet-002', {
      id: 'pet-002',
      name: 'Max',
      type: 'dog',
      breed: 'Golden Retriever',
      age: 5,
      weight: 28.5,
      microchipId: 'CHIP-987654321',
      rfidTag: 'RFID-DOG-001',
      accessPermissions: ['door-001'],
      location: 'inside',
      lastSeen: Date.now() - 10 * 60 * 1000,
      lastEntry: Date.now() - 3 * 60 * 60 * 1000,
      lastExit: Date.now() - 10 * 60 * 1000,
      dailyActivity: 8,
      health: {
        status: 'excellent',
        lastVetVisit: Date.now() - 60 * 24 * 60 * 60 * 1000,
        nextVaccination: Date.now() + 120 * 24 * 60 * 60 * 1000,
        medications: ['Flea prevention']
      }
    });
    
    this.petDoors.set('door-001', {
      id: 'door-001',
      name: 'Back Door Pet Entrance',
      type: 'smart-door',
      location: 'back-door',
      status: 'locked',
      mode: 'selective', // selective, locked, unlocked
      rfidReader: true,
      cameraEnabled: true,
      nightVisionEnabled: true,
      weatherSeal: true,
      insulated: true,
      doorSize: 'large', // small, medium, large
      batteryLevel: 85,
      lastMaintenance: Date.now() - 30 * 24 * 60 * 60 * 1000,
      entryCount: 1247,
      exitCount: 1239
    });
    
    this.activityLog.push({
      id: 'activity-001',
      petId: 'pet-001',
      doorId: 'door-001',
      type: 'entry',
      timestamp: Date.now() - 30 * 60 * 1000,
      rfidDetected: true,
      photoTaken: true,
      weatherConditions: { temp: 5, condition: 'cloudy' }
    });
  }
  
  async initialize() {
    try {
      await this.loadSettings();
      this.startMonitoring();
      
      this.emit('notification', {
        type: 'info',
        priority: 'low',
        title: 'Pet Door System',
        message: `Pet door system initialized with ${this.pets.size} pets`
      });
      
      return { success: true, pets: this.pets.size, doors: this.petDoors.size };
    } catch (error) {
      this.emit('notification', {
        type: 'error',
        priority: 'high',
        title: 'Pet Door Error',
        message: `Failed to initialize: ${error.message}`
      });
      throw error;
    }
  }
  
  async handlePetMovement(doorId, rfidTag, direction) {
    const door = this.petDoors.get(doorId);
    if (!door) throw new Error(`Door ${doorId} not found`);
    
    const pet = Array.from(this.pets.values()).find(p => p.rfidTag === rfidTag);
    if (!pet) throw new Error(`Pet with RFID ${rfidTag} not found`);
    
    // Check access permissions
    if (!pet.accessPermissions.includes(doorId)) {
      this.emit('notification', {
        type: 'warning',
        priority: 'high',
        title: 'Access Denied',
        message: `${pet.name} does not have permission for ${door.name}`
      });
      return { success: false, reason: 'access-denied' };
    }
    
    // Check curfew
    if (this.settings.curfewEnabled && this.isInCurfew() && direction === 'exit') {
      this.emit('notification', {
        type: 'warning',
        priority: 'medium',
        title: 'Curfew Active',
        message: `${pet.name} attempting to exit during curfew hours`
      });
      return { success: false, reason: 'curfew' };
    }
    
    // Update pet location
    pet.location = direction === 'entry' ? 'inside' : 'outside';
    pet.lastSeen = Date.now();
    
    if (direction === 'entry') {
      pet.lastEntry = Date.now();
      door.entryCount++;
    } else {
      pet.lastExit = Date.now();
      door.exitCount++;
    }
    
    pet.dailyActivity++;
    
    // Log activity
    this.activityLog.unshift({
      id: `activity-${Date.now()}`,
      petId: pet.id,
      doorId,
      type: direction,
      timestamp: Date.now(),
      rfidDetected: true,
      photoTaken: door.cameraEnabled
    });
    
    if (this.activityLog.length > 500) {
      this.activityLog = this.activityLog.slice(0, 500);
    }
    
    this.emit('notification', {
      type: 'info',
      priority: 'low',
      title: `Pet ${direction === 'entry' ? 'Entered' : 'Left'}`,
      message: `${pet.name} is now ${pet.location}`
    });
    
    await this.saveSettings();
    this.clearCache();
    
    return { success: true, pet: pet.name, location: pet.location };
  }
  
  async setDoorMode(doorId, mode) {
    const door = this.petDoors.get(doorId);
    if (!door) throw new Error(`Door ${doorId} not found`);
    
    const validModes = ['selective', 'locked', 'unlocked'];
    if (!validModes.includes(mode)) {
      throw new Error(`Invalid mode. Must be one of: ${validModes.join(', ')}`);
    }
    
    door.mode = mode;
    door.status = mode === 'locked' ? 'locked' : 'unlocked';
    
    this.emit('notification', {
      type: 'info',
      priority: 'medium',
      title: 'Door Mode Changed',
      message: `${door.name} set to ${mode} mode`
    });
    
    await this.saveSettings();
    return { success: true, door: door.name, mode };
  }
  
  isInCurfew() {
    const now = new Date();
    const currentHour = now.getHours();
    const startHour = parseInt(this.settings.curfewStart.split(':')[0]);
    const endHour = parseInt(this.settings.curfewEnd.split(':')[0]);
    
    if (startHour < endHour) {
      return currentHour >= startHour && currentHour < endHour;
    } else {
      return currentHour >= startHour || currentHour < endHour;
    }
  }
  
  getPetActivity(petId) {
    const cached = this.getCached(`pet-activity-${petId}`);
    if (cached) return cached;
    
    const pet = this.pets.get(petId);
    if (!pet) throw new Error(`Pet ${petId} not found`);
    
    const petActivities = this.activityLog.filter(a => a.petId === petId);
    const last24h = petActivities.filter(a => Date.now() - a.timestamp < 24 * 60 * 60 * 1000);
    
    const entries = last24h.filter(a => a.type === 'entry').length;
    const exits = last24h.filter(a => a.type === 'exit').length;
    
    const activity = {
      name: pet.name,
      type: pet.type,
      location: pet.location,
      lastSeen: pet.lastSeen,
      today: {
        entries,
        exits,
        totalActivity: pet.dailyActivity
      },
      health: pet.health,
      minutesSinceLastSeen: Math.round((Date.now() - pet.lastSeen) / 60000)
    };
    
    this.setCached(`pet-activity-${petId}`, activity);
    return activity;
  }
  
  getPetStatistics() {
    const cached = this.getCached('pet-stats');
    if (cached) return cached;
    
    const pets = Array.from(this.pets.values());
    const doors = Array.from(this.petDoors.values());
    
    const stats = {
      pets: {
        total: this.pets.size,
        inside: pets.filter(p => p.location === 'inside').length,
        outside: pets.filter(p => p.location === 'outside').length,
        cats: pets.filter(p => p.type === 'cat').length,
        dogs: pets.filter(p => p.type === 'dog').length
      },
      activity: {
        todayTotal: pets.reduce((sum, p) => sum + p.dailyActivity, 0),
        averagePerPet: pets.length > 0 ? Math.round(pets.reduce((sum, p) => sum + p.dailyActivity, 0) / pets.length) : 0,
        recentEntries: this.activityLog.filter(a => a.type === 'entry' && Date.now() - a.timestamp < 60 * 60 * 1000).length,
        recentExits: this.activityLog.filter(a => a.type === 'exit' && Date.now() - a.timestamp < 60 * 60 * 1000).length
      },
      doors: {
        total: this.petDoors.size,
        locked: doors.filter(d => d.mode === 'locked').length,
        selective: doors.filter(d => d.mode === 'selective').length,
        totalEntries: doors.reduce((sum, d) => sum + d.entryCount, 0),
        totalExits: doors.reduce((sum, d) => sum + d.exitCount, 0)
      },
      health: {
        allHealthy: pets.every(p => p.health.status === 'excellent' || p.health.status === 'good'),
        needsVetVisit: pets.filter(p => {
          const daysSinceVisit = (Date.now() - p.health.lastVetVisit) / (24 * 60 * 60 * 1000);
          return daysSinceVisit > 180;
        }).length
      }
    };
    
    this.setCached('pet-stats', stats);
    return stats;
  }
  
  startMonitoring() {
    if (this.monitoring.interval) clearInterval(this.monitoring.interval);
    this.monitoring.interval = setInterval(() => this.monitorPets(), this.monitoring.checkInterval);
  }
  
  monitorPets() {
    this.monitoring.lastCheck = Date.now();
    
    for (const [id, pet] of this.pets) {
      const minutesSinceLastSeen = (Date.now() - pet.lastSeen) / 60000;
      
      // Alert if pet hasn't been seen in a while
      if (minutesSinceLastSeen > 120 && pet.location === 'outside') {
        this.emit('notification', {
          type: 'warning',
          priority: 'high',
          title: 'Pet Not Seen',
          message: `${pet.name} has been outside for ${Math.round(minutesSinceLastSeen / 60)} hours`
        });
      }
      
      // Check vaccination due date
      const daysUntilVaccination = (pet.health.nextVaccination - Date.now()) / (24 * 60 * 60 * 1000);
      if (daysUntilVaccination <= 7 && daysUntilVaccination > 0) {
        this.emit('notification', {
          type: 'info',
          priority: 'medium',
          title: 'Vaccination Due',
          message: `${pet.name} needs vaccination in ${Math.floor(daysUntilVaccination)} days`
        });
      }
    }
    
    // Reset daily activity at midnight
    const now = new Date();
    if (now.getHours() === 0 && now.getMinutes() === 0) {
      for (const [id, pet] of this.pets) {
        pet.dailyActivity = 0;
      }
    }
  }
  
  getCached(key) {
    const cached = this.cache.data.get(key);
    const timestamp = this.cache.timestamps.get(key);
    if (cached && timestamp && (Date.now() - timestamp < this.cache.ttl)) return cached;
    return null;
  }
  
  setCached(key, value) {
    this.cache.data.set(key, value);
    this.cache.timestamps.set(key, Date.now());
  }
  
  clearCache() {
    this.cache.data.clear();
    this.cache.timestamps.clear();
  }
  
  async loadSettings() {
    try {
      const settings = Homey.ManagerSettings.get('smartPetDoorActivitySystem');
      if (settings) {
        this.pets = new Map(settings.pets || []);
        this.petDoors = new Map(settings.petDoors || []);
        this.activityLog = settings.activityLog || [];
        this.healthMetrics = settings.healthMetrics || [];
        Object.assign(this.settings, settings.settings || {});
      }
    } catch (error) {
      console.error('Failed to load pet door settings:', error);
    }
  }
  
  async saveSettings() {
    try {
      const settings = {
        pets: Array.from(this.pets.entries()),
        petDoors: Array.from(this.petDoors.entries()),
        activityLog: this.activityLog,
        healthMetrics: this.healthMetrics,
        settings: this.settings
      };
      Homey.ManagerSettings.set('smartPetDoorActivitySystem', settings);
    } catch (error) {
      console.error('Failed to save pet door settings:', error);
      throw error;
    }
  }
  
  getPets() { return Array.from(this.pets.values()); }
  getPetDoors() { return Array.from(this.petDoors.values()); }
  getActivityLog(limit = 100) { return this.activityLog.slice(0, limit); }
}

module.exports = SmartPetDoorActivitySystem;
