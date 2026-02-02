'use strict';

const EventEmitter = require('events');
const Homey = require('homey');

/**
 * Home Accessibility & Elderly Care System
 * 
 * Accessibility features, elderly care monitoring, fall detection, and assisted living automation.
 * 
 * @extends EventEmitter
 */
class HomeAccessibilityElderlyCareSystem extends EventEmitter {
  constructor() {
    super();
    
    this.residents = new Map();
    this.assistiveDevices = new Map();
    this.careSchedules = [];
    this.activityLog = [];
    this.healthAlerts = [];
    
    this.settings = {
      fallDetectionEnabled: true,
      inactivityAlertsEnabled: true,
      inactivityThreshold: 4, // hours
      medicationRemindersEnabled: true,
      emergencyContactsEnabled: true,
      voiceControlEnabled: true,
      largeTextMode: true,
      highContrastMode: false
    };
    
    this.currentStatus = {
      allResidentsSafe: true,
      activeAlerts: 0,
      lastActivity: Date.now(),
      emergencyMode: false
    };
    
    this.cache = { data: new Map(), timestamps: new Map(), ttl: 3 * 60 * 1000 };
    this.monitoring = { interval: null, checkInterval: 1 * 60 * 1000, lastCheck: null };
    
    this.initializeDefaultData();
  }
  
  initializeDefaultData() {
    // Residents
    this.residents.set('resident-001', {
      id: 'resident-001',
      name: 'Margaret Anderson',
      age: 78,
      mobilityLevel: 'assisted', // independent, assisted, wheelchair
      medicalConditions: ['Arthritis', 'Hypertension'],
      medications: [
        { name: 'Lisinopril', dosage: '10mg', schedule: ['08:00', '20:00'] },
        { name: 'Ibuprofen', dosage: '400mg', schedule: ['12:00'], asNeeded: true }
      ],
      emergencyContacts: [
        { name: 'Daughter Sarah', phone: '+46701234567', relationship: 'daughter' },
        { name: 'Dr. Johnson', phone: '+46709876543', relationship: 'physician' }
      ],
      lastSeen: Date.now() - 15 * 60 * 1000,
      lastActivity: 'kitchen-movement',
      wearableDevice: 'watch-001',
      careLevel: 'moderate'
    });
    
    // Assistive devices
    this.assistiveDevices.set('watch-001', {
      id: 'watch-001',
      name: 'Smart Health Watch',
      type: 'wearable',
      residentId: 'resident-001',
      features: ['fall-detection', 'heart-rate', 'sos-button', 'gps'],
      status: 'active',
      batteryLevel: 75,
      lastSync: Date.now() - 10 * 60 * 1000,
      measurements: {
        heartRate: 72, // bpm
        steps: 1240,
        temperature: 36.5,
        bloodOxygen: 97 // %
      }
    });
    
    this.assistiveDevices.set('sensor-001', {
      id: 'sensor-001',
      name: 'Bed Occupancy Sensor',
      type: 'bed-sensor',
      location: 'bedroom',
      status: 'active',
      occupied: false,
      lastChanged: Date.now() - 6 * 60 * 60 * 1000, // Got out of bed 6h ago
      nightRestQuality: 'good'
    });
    
    this.assistiveDevices.set('sensor-002', {
      id: 'sensor-002',
      name: 'Bathroom Motion Sensor',
      type: 'motion-sensor',
      location: 'bathroom',
      status: 'active',
      lastMotion: Date.now() - 45 * 60 * 1000,
      dailyVisits: 5
    });
    
    this.assistiveDevices.set('device-001', {
      id: 'device-001',
      name: 'Stair Lift',
      type: 'mobility-aid',
      location: 'staircase',
      status: 'ready',
      position: 'bottom',
      usageCount: 234,
      lastMaintenance: Date.now() - 45 * 24 * 60 * 60 * 1000,
      batteryBackup: true
    });
    
    this.assistiveDevices.set('device-002', {
      id: 'device-002',
      name: 'Emergency Call Button',
      type: 'emergency-button',
      location: 'bedroom-wall',
      status: 'active',
      lastTest: Date.now() - 7 * 24 * 60 * 60 * 1000,
      directDial: '+46112' // Emergency services
    });
    
    // Care schedules
    this.careSchedules.push({
      id: 'schedule-001',
      type: 'medication',
      residentId: 'resident-001',
      title: 'Morning Medication',
      time: '08:00',
      description: 'Lisinopril 10mg',
      frequency: 'daily',
      enabled: true,
      lastCompleted: Date.now() - 8 * 60 * 60 * 1000
    });
    
    this.careSchedules.push({
      id: 'schedule-002',
      type: 'activity',
      residentId: 'resident-001',
      title: 'Morning Walk',
      time: '10:00',
      description: '15-minute walk in garden',
      frequency: 'daily',
      enabled: true,
      lastCompleted: Date.now() - 6 * 60 * 60 * 1000
    });
    
    this.careSchedules.push({
      id: 'schedule-003',
      type: 'health-check',
      residentId: 'resident-001',
      title: 'Blood Pressure Check',
      time: '12:00',
      description: 'Measure and log blood pressure',
      frequency: 'daily',
      enabled: true,
      lastCompleted: Date.now() - 4 * 60 * 60 * 1000
    });
    
    // Activity log (last 24 hours)
    const now = Date.now();
    this.activityLog.push(
      { timestamp: now - 15 * 60 * 1000, type: 'movement', location: 'kitchen', residentId: 'resident-001' },
      { timestamp: now - 45 * 60 * 1000, type: 'bathroom-visit', location: 'bathroom', residentId: 'resident-001', duration: 8 },
      { timestamp: now - 2 * 60 * 60 * 1000, type: 'meal', location: 'kitchen', residentId: 'resident-001' },
      { timestamp: now - 4 * 60 * 60 * 1000, type: 'medication-taken', residentId: 'resident-001', medication: 'Ibuprofen' },
      { timestamp: now - 6 * 60 * 60 * 1000, type: 'out-of-bed', location: 'bedroom', residentId: 'resident-001' }
    );
  }
  
  async initialize() {
    try {
      await this.loadSettings();
      this.startMonitoring();
      
      this.emit('notification', {
        type: 'info',
        priority: 'low',
        title: 'Elderly Care System',
        message: `Care system initialized for ${this.residents.size} resident(s)`
      });
      
      return { success: true, residents: this.residents.size };
    } catch (error) {
      this.emit('notification', {
        type: 'error',
        priority: 'high',
        title: 'Care System Error',
        message: `Failed to initialize: ${error.message}`
      });
      throw error;
    }
  }
  
  async detectFall(residentId) {
    const resident = this.residents.get(residentId);
    if (!resident) throw new Error(`Resident ${residentId} not found`);
    
    const alert = {
      id: `alert-${Date.now()}`,
      type: 'fall-detected',
      severity: 'critical',
      residentId,
      residentName: resident.name,
      timestamp: Date.now(),
      location: 'unknown',
      status: 'active',
      responseTime: null
    };
    
    this.healthAlerts.unshift(alert);
    this.currentStatus.activeAlerts++;
    this.currentStatus.emergencyMode = true;
    this.currentStatus.allResidentsSafe = false;
    
    // Auto-notify emergency contacts
    await this.notifyEmergencyContacts(resident, 'Fall detected');
    
    this.emit('notification', {
      type: 'error',
      priority: 'critical',
      title: '🚨 FALL DETECTED',
      message: `${resident.name} - Fall detected! Emergency contacts notified.`
    });
    
    await this.saveSettings();
    this.clearCache();
    
    return { success: true, alert: alert.id };
  }
  
  async notifyEmergencyContacts(resident, reason) {
    const notifications = [];
    
    for (const contact of resident.emergencyContacts) {
      notifications.push({
        contactName: contact.name,
        phone: contact.phone,
        relationship: contact.relationship,
        message: `EMERGENCY: ${reason} - ${resident.name}`,
        timestamp: Date.now()
      });
    }
    
    return { success: true, contactsNotified: notifications.length, notifications };
  }
  
  async logActivity(residentId, activityType, location, details = {}) {
    const resident = this.residents.get(residentId);
    if (!resident) throw new Error(`Resident ${residentId} not found`);
    
    const activity = {
      timestamp: Date.now(),
      type: activityType,
      location,
      residentId,
      ...details
    };
    
    this.activityLog.unshift(activity);
    
    if (this.activityLog.length > 200) {
      this.activityLog = this.activityLog.slice(0, 200);
    }
    
    resident.lastActivity = activityType;
    resident.lastSeen = Date.now();
    this.currentStatus.lastActivity = Date.now();
    
    await this.saveSettings();
    
    return { success: true, activity: activityType };
  }
  
  async medicationReminder(residentId, medication) {
    const resident = this.residents.get(residentId);
    if (!resident) throw new Error(`Resident ${residentId} not found`);
    
    this.emit('notification', {
      type: 'info',
      priority: 'high',
      title: '💊 Medication Reminder',
      message: `${resident.name}: Time to take ${medication}`
    });
    
    return { success: true, resident: resident.name, medication };
  }
  
  async completeCareTask(scheduleId) {
    const schedule = this.careSchedules.find(s => s.id === scheduleId);
    if (!schedule) throw new Error(`Schedule ${scheduleId} not found`);
    
    schedule.lastCompleted = Date.now();
    
    // Log as activity
    const resident = this.residents.get(schedule.residentId);
    if (resident) {
      await this.logActivity(schedule.residentId, schedule.type, 'home', {
        description: schedule.title
      });
    }
    
    this.emit('notification', {
      type: 'success',
      priority: 'low',
      title: 'Care Task Completed',
      message: `${schedule.title} completed`
    });
    
    await this.saveSettings();
    return { success: true, task: schedule.title };
  }
  
  getCareStatistics() {
    const cached = this.getCached('care-stats');
    if (cached) return cached;
    
    const residents = Array.from(this.residents.values());
    const devices = Array.from(this.assistiveDevices.values());
    
    // Calculate activity patterns
    const last24h = this.activityLog.filter(a => Date.now() - a.timestamp < 24 * 60 * 60 * 1000);
    const activityByType = {};
    for (const activity of last24h) {
      activityByType[activity.type] = (activityByType[activity.type] || 0) + 1;
    }
    
    // Check for overdue tasks
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const overdueTasks = this.careSchedules.filter(s => {
      if (!s.enabled) return false;
      const [hours, minutes] = s.time.split(':').map(Number);
      const taskTime = hours * 60 + minutes;
      const timeSinceTask = currentTime - taskTime;
      return timeSinceTask > 0 && timeSinceTask < 240 && // Within 4 hours past due
             (Date.now() - s.lastCompleted > 12 * 60 * 60 * 1000); // Not done in last 12h
    });
    
    const stats = {
      residents: {
        total: residents.length,
        safe: residents.filter(r => Date.now() - r.lastSeen < 4 * 60 * 60 * 1000).length,
        requiresAttention: residents.filter(r => Date.now() - r.lastSeen > 4 * 60 * 60 * 1000).length
      },
      devices: {
        total: devices.length,
        active: devices.filter(d => d.status === 'active' || d.status === 'ready').length,
        wearables: devices.filter(d => d.type === 'wearable').length,
        sensors: devices.filter(d => d.type.includes('sensor')).length,
        lowBattery: devices.filter(d => d.batteryLevel && d.batteryLevel < 20).length
      },
      activity: {
        last24h: last24h.length,
        byType: activityByType,
        lastActivity: Math.round((Date.now() - this.currentStatus.lastActivity) / 60000) // minutes
      },
      care: {
        scheduledTasks: this.careSchedules.length,
        overdueTasks: overdueTasks.length,
        completedToday: this.careSchedules.filter(s => 
          Date.now() - s.lastCompleted < 24 * 60 * 60 * 1000
        ).length
      },
      alerts: {
        active: this.currentStatus.activeAlerts,
        total: this.healthAlerts.length,
        last24h: this.healthAlerts.filter(a => Date.now() - a.timestamp < 24 * 60 * 60 * 1000).length
      },
      status: {
        emergencyMode: this.currentStatus.emergencyMode,
        allSafe: this.currentStatus.allResidentsSafe
      }
    };
    
    this.setCached('care-stats', stats);
    return stats;
  }
  
  startMonitoring() {
    if (this.monitoring.interval) clearInterval(this.monitoring.interval);
    this.monitoring.interval = setInterval(() => this.monitorResidents(), this.monitoring.checkInterval);
  }
  
  monitorResidents() {
    this.monitoring.lastCheck = Date.now();
    
    // Check for inactivity
    if (this.settings.inactivityAlertsEnabled) {
      for (const [id, resident] of this.residents) {
        const hoursSinceLastSeen = (Date.now() - resident.lastSeen) / (60 * 60 * 1000);
        
        if (hoursSinceLastSeen > this.settings.inactivityThreshold) {
          this.emit('notification', {
            type: 'warning',
            priority: 'high',
            title: 'Inactivity Alert',
            message: `${resident.name} - No activity for ${Math.floor(hoursSinceLastSeen)} hours`
          });
        }
      }
    }
    
    // Check medication schedules
    if (this.settings.medicationRemindersEnabled) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      for (const schedule of this.careSchedules) {
        if (schedule.type === 'medication' && schedule.enabled && schedule.time === currentTime) {
          const hoursSinceLast = (Date.now() - schedule.lastCompleted) / (60 * 60 * 1000);
          
          if (hoursSinceLast > 12) { // Don't remind if already taken recently
            this.medicationReminder(schedule.residentId, schedule.description);
          }
        }
      }
    }
    
    // Check wearable device batteries
    for (const [id, device] of this.assistiveDevices) {
      if (device.batteryLevel && device.batteryLevel < 20) {
        this.emit('notification', {
          type: 'warning',
          priority: 'medium',
          title: 'Low Device Battery',
          message: `${device.name} battery at ${device.batteryLevel}%`
        });
      }
    }
    
    // Simulate wearable updates
    const watch = this.assistiveDevices.get('watch-001');
    if (watch) {
      watch.measurements.heartRate = 65 + Math.floor(Math.random() * 20);
      watch.measurements.steps += Math.floor(Math.random() * 5);
      watch.lastSync = Date.now();
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
      const settings = Homey.ManagerSettings.get('homeAccessibilityElderlyCareSystem');
      if (settings) {
        this.residents = new Map(settings.residents || []);
        this.assistiveDevices = new Map(settings.assistiveDevices || []);
        this.careSchedules = settings.careSchedules || [];
        this.activityLog = settings.activityLog || [];
        this.healthAlerts = settings.healthAlerts || [];
        Object.assign(this.settings, settings.settings || {});
        Object.assign(this.currentStatus, settings.currentStatus || {});
      }
    } catch (error) {
      console.error('Failed to load elderly care settings:', error);
    }
  }
  
  async saveSettings() {
    try {
      const settings = {
        residents: Array.from(this.residents.entries()),
        assistiveDevices: Array.from(this.assistiveDevices.entries()),
        careSchedules: this.careSchedules,
        activityLog: this.activityLog.slice(0, 200),
        healthAlerts: this.healthAlerts.slice(0, 100),
        settings: this.settings,
        currentStatus: this.currentStatus
      };
      Homey.ManagerSettings.set('homeAccessibilityElderlyCareSystem', settings);
    } catch (error) {
      console.error('Failed to save elderly care settings:', error);
      throw error;
    }
  }
  
  getResidents() { return Array.from(this.residents.values()); }
  getAssistiveDevices() { return Array.from(this.assistiveDevices.values()); }
  getCareSchedules() { return this.careSchedules; }
  getActivityLog(limit = 50) { return this.activityLog.slice(0, limit); }
  getHealthAlerts(limit = 20) { return this.healthAlerts.slice(0, limit); }
  getCurrentStatus() { return this.currentStatus; }
}

module.exports = HomeAccessibilityElderlyCareSystem;
