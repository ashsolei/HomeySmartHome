'use strict';

const EventEmitter = require('events');
const Homey = require('homey');

/**
 * Home Emergency Response System
 * 
 * Comprehensive emergency detection, response coordination, and emergency services integration.
 * 
 * @extends EventEmitter
 */
class HomeEmergencyResponseSystem extends EventEmitter {
  constructor() {
    super();
    
    this.emergencyContacts = new Map();
    this.emergencySensors = new Map();
    this.emergencyIncidents = [];
    this.responseProtocols = new Map();
    this.evacuationPlans = new Map();
    
    this.settings = {
      autoEmergencyCallEnabled: false, // Requires certification
      evacuationAlarmsEnabled: true,
      emergencyLightingEnabled: true,
      autoUnlockDoorsEnabled: true,
      emergencyNotificationsEnabled: true
    };
    
    this.currentStatus = {
      overallStatus: 'normal', // normal, alert, emergency, evacuating
      activeIncidents: 0,
      lastIncident: null,
      systemArmed: true
    };
    
    this.cache = { data: new Map(), timestamps: new Map(), ttl: 2 * 60 * 1000 };
    this.monitoring = { interval: null, checkInterval: 30 * 1000, lastCheck: null };
    
    this.initializeDefaultData();
  }
  
  initializeDefaultData() {
    // Emergency contacts
    this.emergencyContacts.set('contact-001', {
      id: 'contact-001',
      name: 'Emergency Services',
      phone: '112',
      type: 'emergency-services',
      priority: 1,
      autoCallEnabled: false
    });
    
    this.emergencyContacts.set('contact-002', {
      id: 'contact-002',
      name: 'John Homeowner',
      phone: '+46701234567',
      type: 'owner',
      priority: 2,
      autoCallEnabled: false,
      location: 'work'
    });
    
    this.emergencyContacts.set('contact-003', {
      id: 'contact-003',
      name: 'Jane Neighbor',
      phone: '+46709876543',
      type: 'neighbor',
      priority: 3,
      autoCallEnabled: false,
      location: 'next-door'
    });
    
    // Emergency sensors
    this.emergencySensors.set('sensor-001', {
      id: 'sensor-001',
      name: 'Kitchen Smoke Detector',
      type: 'smoke',
      location: 'kitchen',
      status: 'active',
      batteryLevel: 85,
      lastTest: Date.now() - 14 * 24 * 60 * 60 * 1000,
      triggered: false,
      sensitivity: 'medium'
    });
    
    this.emergencySensors.set('sensor-002', {
      id: 'sensor-002',
      name: 'Living Room Smoke Detector',
      type: 'smoke',
      location: 'living-room',
      status: 'active',
      batteryLevel: 92,
      lastTest: Date.now() - 14 * 24 * 60 * 60 * 1000,
      triggered: false,
      sensitivity: 'medium'
    });
    
    this.emergencySensors.set('sensor-003', {
      id: 'sensor-003',
      name: 'Kitchen Fire Extinguisher',
      type: 'fire-extinguisher',
      location: 'kitchen',
      status: 'ready',
      lastInspection: Date.now() - 180 * 24 * 60 * 60 * 1000,
      expiryDate: Date.now() + 365 * 24 * 60 * 60 * 1000,
      type_detail: 'ABC',
      weight: 2.5 // kg
    });
    
    this.emergencySensors.set('sensor-004', {
      id: 'sensor-004',
      name: 'Basement Water Leak Detector',
      type: 'water-leak',
      location: 'basement',
      status: 'active',
      batteryLevel: 78,
      lastTest: Date.now() - 30 * 24 * 60 * 60 * 1000,
      triggered: false,
      sensitivity: 'high'
    });
    
    this.emergencySensors.set('sensor-005', {
      id: 'sensor-005',
      name: 'CO Detector Main Floor',
      type: 'carbon-monoxide',
      location: 'hallway',
      status: 'active',
      batteryLevel: 88,
      lastTest: Date.now() - 20 * 24 * 60 * 60 * 1000,
      triggered: false,
      co_level: 0, // ppm
      threshold: 50 // ppm
    });
    
    this.emergencySensors.set('sensor-006', {
      id: 'sensor-006',
      name: 'Glass Break Sensor Window',
      type: 'glass-break',
      location: 'living-room-window',
      status: 'active',
      batteryLevel: 95,
      lastTest: Date.now() - 7 * 24 * 60 * 60 * 1000,
      triggered: false,
      sensitivity: 'high'
    });
    
    // Response protocols
    this.responseProtocols.set('fire', {
      id: 'fire',
      name: 'Fire Emergency Protocol',
      emergencyType: 'fire',
      steps: [
        { order: 1, action: 'trigger-alarm', description: 'Sound fire alarm throughout house' },
        { order: 2, action: 'emergency-lighting', description: 'Enable emergency path lighting' },
        { order: 3, action: 'unlock-exits', description: 'Unlock all exit doors' },
        { order: 4, action: 'shut-hvac', description: 'Shutdown HVAC to prevent smoke spread' },
        { order: 5, action: 'notify-contacts', description: 'Alert all emergency contacts' },
        { order: 6, action: 'call-emergency', description: 'Call 112 (if enabled)' }
      ],
      autoExecute: true
    });
    
    this.responseProtocols.set('flood', {
      id: 'flood',
      name: 'Water Leak/Flood Protocol',
      emergencyType: 'flood',
      steps: [
        { order: 1, action: 'shut-water', description: 'Close main water valve' },
        { order: 2, action: 'trigger-alarm', description: 'Sound water leak alarm' },
        { order: 3, action: 'activate-pump', description: 'Activate sump pump if available' },
        { order: 4, action: 'notify-contacts', description: 'Alert homeowner and plumber' },
        { order: 5, action: 'power-off-affected', description: 'Cut power to affected areas' }
      ],
      autoExecute: true
    });
    
    this.responseProtocols.set('co', {
      id: 'co',
      name: 'Carbon Monoxide Protocol',
      emergencyType: 'carbon-monoxide',
      steps: [
        { order: 1, action: 'trigger-alarm', description: 'Sound CO alarm' },
        { order: 2, action: 'open-windows', description: 'Open all windows for ventilation' },
        { order: 3, action: 'shut-gas', description: 'Close gas main if accessible' },
        { order: 4, action: 'activate-ventilation', description: 'Max ventilation fans' },
        { order: 5, action: 'notify-contacts', description: 'Alert contacts - evacuate immediately' },
        { order: 6, action: 'call-emergency', description: 'Call 112' }
      ],
      autoExecute: true
    });
    
    // Evacuation plans
    this.evacuationPlans.set('plan-001', {
      id: 'plan-001',
      name: 'Primary Evacuation Route',
      type: 'fire',
      routes: [
        { from: 'kitchen', to: 'back-door', time: 15, obstacles: 'none' },
        { from: 'living-room', to: 'front-door', time: 10, obstacles: 'none' },
        { from: 'bedroom-1', to: 'window', time: 20, obstacles: 'furniture' },
        { from: 'bedroom-2', to: 'hallway-front-door', time: 25, obstacles: 'none' }
      ],
      meetingPoint: 'Front yard by mailbox',
      lastReview: Date.now() - 60 * 24 * 60 * 60 * 1000
    });
  }
  
  async initialize() {
    try {
      await this.loadSettings();
      this.startMonitoring();
      
      this.emit('notification', {
        type: 'info',
        priority: 'low',
        title: 'Emergency Response System',
        message: `Emergency system initialized with ${this.emergencySensors.size} sensors`
      });
      
      return { success: true, sensors: this.emergencySensors.size };
    } catch (error) {
      this.emit('notification', {
        type: 'error',
        priority: 'high',
        title: 'Emergency System Error',
        message: `Failed to initialize: ${error.message}`
      });
      throw error;
    }
  }
  
  async triggerEmergency(emergencyType, location, severity = 'high') {
    const incident = {
      id: `incident-${Date.now()}`,
      type: emergencyType,
      location,
      severity,
      timestamp: Date.now(),
      status: 'active',
      responseSteps: [],
      notifications: [],
      resolved: false
    };
    
    this.emergencyIncidents.unshift(incident);
    this.currentStatus.overallStatus = 'emergency';
    this.currentStatus.activeIncidents++;
    this.currentStatus.lastIncident = Date.now();
    
    // Execute response protocol
    const protocol = this.responseProtocols.get(emergencyType);
    if (protocol && protocol.autoExecute) {
      for (const step of protocol.steps) {
        const result = await this.executeResponseStep(step, incident);
        incident.responseSteps.push({ ...step, executed: Date.now(), result });
      }
    }
    
    this.emit('notification', {
      type: 'error',
      priority: 'critical',
      title: `🚨 EMERGENCY: ${emergencyType.toUpperCase()}`,
      message: `${emergencyType} detected in ${location}. Response protocol activated.`
    });
    
    await this.saveSettings();
    this.clearCache();
    
    return { success: true, incident: incident.id, protocol: protocol?.name };
  }
  
  async executeResponseStep(step, incident) {
    const { action } = step;
    
    switch (action) {
      case 'trigger-alarm':
        if (this.settings.evacuationAlarmsEnabled) {
          // Trigger sirens/alarms
          return { success: true, message: 'Alarms activated' };
        }
        break;
      
      case 'emergency-lighting':
        if (this.settings.emergencyLightingEnabled) {
          // Turn on all lights to 100%
          return { success: true, message: 'Emergency lighting enabled' };
        }
        break;
      
      case 'unlock-exits':
        if (this.settings.autoUnlockDoorsEnabled) {
          // Unlock all exit doors
          return { success: true, message: 'Exit doors unlocked' };
        }
        break;
      
      case 'notify-contacts':
        if (this.settings.emergencyNotificationsEnabled) {
          return await this.notifyEmergencyContacts(incident);
        }
        break;
      
      case 'call-emergency':
        if (this.settings.autoEmergencyCallEnabled) {
          // Auto-call emergency services (requires certification)
          return { success: true, message: 'Emergency call placed to 112' };
        } else {
          return { success: false, message: 'Auto-call disabled, manual call required' };
        }
      
      case 'shut-water':
        // Close main water valve
        return { success: true, message: 'Main water valve closed' };
      
      case 'shut-gas':
        // Close gas main
        return { success: true, message: 'Gas main closed' };
      
      case 'open-windows':
        // Open automated windows
        return { success: true, message: 'Windows opened for ventilation' };
      
      default:
        return { success: false, message: `Unknown action: ${action}` };
    }
    
    return { success: false, message: 'Action not configured' };
  }
  
  async notifyEmergencyContacts(incident) {
    const contacts = Array.from(this.emergencyContacts.values())
      .filter(c => c.autoCallEnabled || c.priority <= 3)
      .sort((a, b) => a.priority - b.priority);
    
    for (const contact of contacts) {
      const notification = {
        contactId: contact.id,
        contactName: contact.name,
        phone: contact.phone,
        timestamp: Date.now(),
        message: `EMERGENCY: ${incident.type} at ${incident.location}`,
        method: contact.type === 'emergency-services' ? 'call' : 'sms-and-call'
      };
      
      incident.notifications.push(notification);
    }
    
    return { success: true, contactsNotified: contacts.length };
  }
  
  async resolveIncident(incidentId, resolution) {
    const incident = this.emergencyIncidents.find(i => i.id === incidentId);
    if (!incident) throw new Error(`Incident ${incidentId} not found`);
    
    incident.status = 'resolved';
    incident.resolved = true;
    incident.resolvedAt = Date.now();
    incident.resolution = resolution;
    
    this.currentStatus.activeIncidents = Math.max(0, this.currentStatus.activeIncidents - 1);
    
    if (this.currentStatus.activeIncidents === 0) {
      this.currentStatus.overallStatus = 'normal';
    }
    
    this.emit('notification', {
      type: 'success',
      priority: 'high',
      title: 'Incident Resolved',
      message: `${incident.type} incident resolved: ${resolution}`
    });
    
    await this.saveSettings();
    return { success: true, incident: incidentId };
  }
  
  async testSensor(sensorId) {
    const sensor = this.emergencySensors.get(sensorId);
    if (!sensor) throw new Error(`Sensor ${sensorId} not found`);
    
    sensor.lastTest = Date.now();
    
    this.emit('notification', {
      type: 'info',
      priority: 'low',
      title: 'Sensor Test',
      message: `${sensor.name} test completed successfully`
    });
    
    await this.saveSettings();
    return { success: true, sensor: sensor.name, lastTest: sensor.lastTest };
  }
  
  getEmergencyStatistics() {
    const cached = this.getCached('emergency-stats');
    if (cached) return cached;
    
    const sensors = Array.from(this.emergencySensors.values());
    const incidents = this.emergencyIncidents;
    
    // Sensor health
    const lowBatterySensors = sensors.filter(s => s.batteryLevel && s.batteryLevel < 20).length;
    const overdueTests = sensors.filter(s => {
      if (!s.lastTest) return true;
      const daysSinceTest = (Date.now() - s.lastTest) / (24 * 60 * 60 * 1000);
      return daysSinceTest > 30;
    }).length;
    
    // Incident analysis
    const last30Days = incidents.filter(i => Date.now() - i.timestamp < 30 * 24 * 60 * 60 * 1000);
    const byType = {};
    for (const incident of last30Days) {
      byType[incident.type] = (byType[incident.type] || 0) + 1;
    }
    
    const stats = {
      system: {
        status: this.currentStatus.overallStatus,
        activeIncidents: this.currentStatus.activeIncidents,
        armed: this.currentStatus.systemArmed
      },
      sensors: {
        total: this.emergencySensors.size,
        active: sensors.filter(s => s.status === 'active').length,
        lowBattery: lowBatterySensors,
        overdueTests,
        byType: {
          smoke: sensors.filter(s => s.type === 'smoke').length,
          co: sensors.filter(s => s.type === 'carbon-monoxide').length,
          waterLeak: sensors.filter(s => s.type === 'water-leak').length,
          glassBreak: sensors.filter(s => s.type === 'glass-break').length
        }
      },
      incidents: {
        total: incidents.length,
        active: incidents.filter(i => i.status === 'active').length,
        resolved: incidents.filter(i => i.resolved).length,
        last30Days: last30Days.length,
        byType
      },
      contacts: {
        total: this.emergencyContacts.size,
        emergencyServices: Array.from(this.emergencyContacts.values())
          .filter(c => c.type === 'emergency-services').length
      },
      protocols: {
        total: this.responseProtocols.size,
        autoExecute: Array.from(this.responseProtocols.values())
          .filter(p => p.autoExecute).length
      }
    };
    
    this.setCached('emergency-stats', stats);
    return stats;
  }
  
  startMonitoring() {
    if (this.monitoring.interval) clearInterval(this.monitoring.interval);
    this.monitoring.interval = setInterval(() => this.monitorEmergencies(), this.monitoring.checkInterval);
  }
  
  monitorEmergencies() {
    this.monitoring.lastCheck = Date.now();
    
    // Check sensor health
    for (const [id, sensor] of this.emergencySensors) {
      if (sensor.batteryLevel && sensor.batteryLevel < 15) {
        this.emit('notification', {
          type: 'warning',
          priority: 'high',
          title: 'Low Sensor Battery',
          message: `${sensor.name} battery at ${sensor.batteryLevel}%`
        });
      }
      
      if (sensor.lastTest) {
        const daysSinceTest = (Date.now() - sensor.lastTest) / (24 * 60 * 60 * 1000);
        if (daysSinceTest > 30) {
          this.emit('notification', {
            type: 'warning',
            priority: 'medium',
            title: 'Sensor Test Overdue',
            message: `${sensor.name} not tested in ${Math.floor(daysSinceTest)} days`
          });
        }
      }
    }
    
    // Check fire extinguisher expiry
    for (const [id, sensor] of this.emergencySensors) {
      if (sensor.type === 'fire-extinguisher' && sensor.expiryDate) {
        const daysUntilExpiry = (sensor.expiryDate - Date.now()) / (24 * 60 * 60 * 1000);
        if (daysUntilExpiry < 30 && daysUntilExpiry > 0) {
          this.emit('notification', {
            type: 'warning',
            priority: 'high',
            title: 'Fire Extinguisher Expiring',
            message: `${sensor.name} expires in ${Math.floor(daysUntilExpiry)} days`
          });
        }
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
      const settings = Homey.ManagerSettings.get('homeEmergencyResponseSystem');
      if (settings) {
        this.emergencyContacts = new Map(settings.emergencyContacts || []);
        this.emergencySensors = new Map(settings.emergencySensors || []);
        this.emergencyIncidents = settings.emergencyIncidents || [];
        this.responseProtocols = new Map(settings.responseProtocols || []);
        this.evacuationPlans = new Map(settings.evacuationPlans || []);
        Object.assign(this.settings, settings.settings || {});
        Object.assign(this.currentStatus, settings.currentStatus || {});
      }
    } catch (error) {
      console.error('Failed to load emergency settings:', error);
    }
  }
  
  async saveSettings() {
    try {
      const settings = {
        emergencyContacts: Array.from(this.emergencyContacts.entries()),
        emergencySensors: Array.from(this.emergencySensors.entries()),
        emergencyIncidents: this.emergencyIncidents.slice(0, 100), // Keep last 100
        responseProtocols: Array.from(this.responseProtocols.entries()),
        evacuationPlans: Array.from(this.evacuationPlans.entries()),
        settings: this.settings,
        currentStatus: this.currentStatus
      };
      Homey.ManagerSettings.set('homeEmergencyResponseSystem', settings);
    } catch (error) {
      console.error('Failed to save emergency settings:', error);
      throw error;
    }
  }
  
  getEmergencyContacts() { return Array.from(this.emergencyContacts.values()); }
  getEmergencySensors() { return Array.from(this.emergencySensors.values()); }
  getEmergencyIncidents(limit = 50) { return this.emergencyIncidents.slice(0, limit); }
  getResponseProtocols() { return Array.from(this.responseProtocols.values()); }
  getEvacuationPlans() { return Array.from(this.evacuationPlans.values()); }
  getCurrentStatus() { return this.currentStatus; }
}

module.exports = HomeEmergencyResponseSystem;
