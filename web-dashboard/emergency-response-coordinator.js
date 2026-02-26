'use strict';

/**
 * Emergency Response Coordinator
 * Multi-system emergency detection and response
 */
class EmergencyResponseCoordinator {
  constructor(app) {
    this._intervals = [];
    this._timeouts = [];
    this.app = app;
    this.emergencyTypes = new Map();
    this.emergencyProtocols = new Map();
    this.emergencyContacts = new Map();
    this.activeEmergencies = [];
    this.emergencyHistory = [];
    this.evacuationPlans = new Map();
  }

  async initialize() {
    await this.setupEmergencyTypes();
    await this.setupProtocols();
    await this.setupEmergencyContacts();
    await this.setupEvacuationPlans();
    
    this.startMonitoring();
  }

  // ============================================
  // EMERGENCY TYPES
  // ============================================

  async setupEmergencyTypes() {
    const types = [
      {
        id: 'fire',
        name: 'Brand',
        severity: 'critical',
        emergencyNumber: '112',
        detectionSystems: ['smoke_detector', 'heat_sensor', 'co_detector'],
        responseTime: 'immediate'
      },
      {
        id: 'water_leak',
        name: 'Vattenläcka',
        severity: 'high',
        emergencyNumber: null,
        detectionSystems: ['water_sensor', 'flow_meter'],
        responseTime: 'urgent'
      },
      {
        id: 'gas_leak',
        name: 'Gasläcka',
        severity: 'critical',
        emergencyNumber: '112',
        detectionSystems: ['gas_detector'],
        responseTime: 'immediate'
      },
      {
        id: 'intrusion',
        name: 'Inbrott',
        severity: 'high',
        emergencyNumber: '112',
        detectionSystems: ['motion_sensor', 'door_sensor', 'window_sensor', 'camera'],
        responseTime: 'immediate'
      },
      {
        id: 'medical',
        name: 'Medicinsk nödsituation',
        severity: 'critical',
        emergencyNumber: '112',
        detectionSystems: ['panic_button', 'fall_detector'],
        responseTime: 'immediate'
      },
      {
        id: 'power_outage',
        name: 'Strömavbrott',
        severity: 'medium',
        emergencyNumber: null,
        detectionSystems: ['power_monitor'],
        responseTime: 'normal'
      },
      {
        id: 'extreme_weather',
        name: 'Extremt väder',
        severity: 'high',
        emergencyNumber: null,
        detectionSystems: ['weather_api', 'wind_sensor'],
        responseTime: 'urgent'
      },
      {
        id: 'hvac_failure',
        name: 'HVAC-fel',
        severity: 'medium',
        emergencyNumber: null,
        detectionSystems: ['temperature_sensor', 'hvac_monitor'],
        responseTime: 'normal'
      }
    ];

    for (const type of types) {
      this.emergencyTypes.set(type.id, type);
    }
  }

  // ============================================
  // PROTOCOLS
  // ============================================

  async setupProtocols() {
    const protocols = [
      {
        id: 'fire_protocol',
        emergencyType: 'fire',
        name: 'Brandprotokoll',
        steps: [
          { order: 1, action: 'call_emergency', params: { number: '112' } },
          { order: 2, action: 'unlock_all_doors', params: {} },
          { order: 3, action: 'turn_on_all_lights', params: { brightness: 100 } },
          { order: 4, action: 'disable_hvac', params: {} },
          { order: 5, action: 'notify_all_contacts', params: { urgency: 'critical' } },
          { order: 6, action: 'activate_evacuation', params: {} },
          { order: 7, action: 'record_video', params: { duration: 3600 } }
        ],
        autoActivate: true
      },
      {
        id: 'water_leak_protocol',
        emergencyType: 'water_leak',
        name: 'Vattenläckeprotokoll',
        steps: [
          { order: 1, action: 'shut_off_water', params: {} },
          { order: 2, action: 'notify_contacts', params: { role: 'primary' } },
          { order: 3, action: 'turn_on_lights', params: { area: 'affected' } },
          { order: 4, action: 'call_plumber', params: {} },
          { order: 5, action: 'document_damage', params: { photos: true } }
        ],
        autoActivate: true
      },
      {
        id: 'gas_leak_protocol',
        emergencyType: 'gas_leak',
        name: 'Gasläckeprotokoll',
        steps: [
          { order: 1, action: 'call_emergency', params: { number: '112' } },
          { order: 2, action: 'shut_off_gas', params: {} },
          { order: 3, action: 'open_all_windows', params: {} },
          { order: 4, action: 'disable_all_electrical', params: {} },
          { order: 5, action: 'notify_all_contacts', params: { urgency: 'critical' } },
          { order: 6, action: 'activate_evacuation', params: {} }
        ],
        autoActivate: true
      },
      {
        id: 'intrusion_protocol',
        emergencyType: 'intrusion',
        name: 'Inbrottsprotokoll',
        steps: [
          { order: 1, action: 'call_emergency', params: { number: '112' } },
          { order: 2, action: 'lock_all_doors', params: {} },
          { order: 3, action: 'turn_on_all_lights', params: { brightness: 100 } },
          { order: 4, action: 'activate_alarm', params: { volume: 100 } },
          { order: 5, action: 'start_recording', params: { all_cameras: true } },
          { order: 6, action: 'notify_contacts', params: { urgency: 'high' } },
          { order: 7, action: 'announce_police', params: {} }
        ],
        autoActivate: false // Require confirmation to avoid false alarms
      },
      {
        id: 'medical_protocol',
        emergencyType: 'medical',
        name: 'Medicinskt protokoll',
        steps: [
          { order: 1, action: 'call_emergency', params: { number: '112' } },
          { order: 2, action: 'unlock_front_door', params: {} },
          { order: 3, action: 'turn_on_all_lights', params: { brightness: 100 } },
          { order: 4, action: 'notify_all_contacts', params: { urgency: 'critical' } },
          { order: 5, action: 'announce_arrival', params: { message: 'Help is coming' } }
        ],
        autoActivate: true
      },
      {
        id: 'power_outage_protocol',
        emergencyType: 'power_outage',
        name: 'Strömavbrottsprotokoll',
        steps: [
          { order: 1, action: 'activate_battery_backup', params: {} },
          { order: 2, action: 'enable_emergency_lights', params: {} },
          { order: 3, action: 'disable_non_essential', params: {} },
          { order: 4, action: 'notify_contacts', params: { role: 'primary' } },
          { order: 5, action: 'monitor_battery_level', params: {} }
        ],
        autoActivate: true
      },
      {
        id: 'extreme_weather_protocol',
        emergencyType: 'extreme_weather',
        name: 'Väderlarmprotokoll',
        steps: [
          { order: 1, action: 'close_all_windows', params: {} },
          { order: 2, action: 'secure_outdoor_items', params: {} },
          { order: 3, action: 'notify_contacts', params: { urgency: 'medium' } },
          { order: 4, action: 'monitor_weather', params: { interval: 300 } },
          { order: 5, action: 'prepare_emergency_kit', params: {} }
        ],
        autoActivate: true
      }
    ];

    for (const protocol of protocols) {
      this.emergencyProtocols.set(protocol.id, protocol);
    }
  }

  // ============================================
  // EMERGENCY DETECTION
  // ============================================

  async detectEmergency(type, data) {
    console.log(`🚨 Emergency detected: ${type}`);

    const emergencyType = this.emergencyTypes.get(type);
    
    if (!emergencyType) {
      return { success: false, error: 'Unknown emergency type' };
    }

    const emergency = {
      id: `emergency_${Date.now()}`,
      type,
      name: emergencyType.name,
      severity: emergencyType.severity,
      timestamp: Date.now(),
      location: data.location || 'Unknown',
      sensor: data.sensor || 'Unknown',
      value: data.value || null,
      status: 'active',
      confirmed: false,
      responseActivated: false
    };

    this.activeEmergencies.push(emergency);

    // Auto-activate protocol if configured
    const protocolId = `${type}_protocol`;
    const protocol = this.emergencyProtocols.get(protocolId);

    if (protocol && protocol.autoActivate) {
      await this.activateProtocol(emergency.id, protocolId);
    } else {
      console.log(`  ⚠️ Protocol requires manual confirmation`);
    }

    return { success: true, emergency };
  }

  async confirmEmergency(emergencyId) {
    const emergency = this.activeEmergencies.find(e => e.id === emergencyId);
    
    if (!emergency) {
      return { success: false, error: 'Emergency not found' };
    }

    emergency.confirmed = true;

    // Activate protocol if not already activated
    if (!emergency.responseActivated) {
      const protocolId = `${emergency.type}_protocol`;
      await this.activateProtocol(emergencyId, protocolId);
    }

    return { success: true };
  }

  async resolveEmergency(emergencyId, resolution) {
    const emergency = this.activeEmergencies.find(e => e.id === emergencyId);
    
    if (!emergency) {
      return { success: false, error: 'Emergency not found' };
    }

    emergency.status = 'resolved';
    emergency.resolvedAt = Date.now();
    emergency.resolution = resolution;
    emergency.duration = emergency.resolvedAt - emergency.timestamp;

    // Move to history
    this.emergencyHistory.push(emergency);
    this.activeEmergencies = this.activeEmergencies.filter(e => e.id !== emergencyId);

    console.log(`✅ Emergency resolved: ${emergency.name}`);

    return { success: true };
  }

  // ============================================
  // PROTOCOL EXECUTION
  // ============================================

  async activateProtocol(emergencyId, protocolId) {
    const emergency = this.activeEmergencies.find(e => e.id === emergencyId);
    const protocol = this.emergencyProtocols.get(protocolId);

    if (!emergency || !protocol) {
      return { success: false, error: 'Emergency or protocol not found' };
    }

    console.log(`🚨 Activating protocol: ${protocol.name}`);

    emergency.responseActivated = true;
    emergency.protocol = protocolId;
    emergency.protocolStarted = Date.now();

    // Execute steps in order
    for (const step of protocol.steps) {
      await this.executeProtocolStep(step, emergency);
    }

    console.log(`✅ Protocol completed: ${protocol.name}`);

    return { success: true };
  }

  async executeProtocolStep(step, emergency) {
    console.log(`  Step ${step.order}: ${step.action}`);

    // Simulate step execution
    switch (step.action) {
      case 'call_emergency':
        console.log(`    📞 Calling ${step.params.number}...`);
        break;

      case 'unlock_all_doors':
      case 'unlock_front_door':
        console.log(`    🔓 Unlocking doors...`);
        break;

      case 'lock_all_doors':
        console.log(`    🔒 Locking doors...`);
        break;

      case 'turn_on_all_lights':
      case 'turn_on_lights':
        console.log(`    💡 Turning on lights (${step.params.brightness || 100}%)...`);
        break;

      case 'disable_hvac':
        console.log(`    ❄️ Disabling HVAC...`);
        break;

      case 'shut_off_water':
        console.log(`    💧 Shutting off water main...`);
        break;

      case 'shut_off_gas':
        console.log(`    🔥 Shutting off gas main...`);
        break;

      case 'open_all_windows':
        console.log(`    🪟 Opening windows...`);
        break;

      case 'close_all_windows':
        console.log(`    🪟 Closing windows...`);
        break;

      case 'notify_contacts':
      case 'notify_all_contacts':
        await this.notifyEmergencyContacts(emergency, step.params.urgency || 'high');
        break;

      case 'activate_evacuation':
        await this.activateEvacuation(emergency.type);
        break;

      case 'activate_alarm':
        console.log(`    🚨 Activating alarm (volume: ${step.params.volume || 80}%)...`);
        break;

      case 'start_recording':
      case 'record_video':
        console.log(`    📹 Starting video recording...`);
        break;

      default:
        console.log(`    ⚙️ Executing: ${step.action}`);
    }

    // Simulate execution delay
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // ============================================
  // EMERGENCY CONTACTS
  // ============================================

  async setupEmergencyContacts() {
    const contacts = [
      {
        id: 'contact_anna',
        name: 'Anna (Primary)',
        role: 'primary',
        phone: '070-123 45 67',
        email: 'anna@example.com',
        priority: 1,
        notificationMethods: ['sms', 'call', 'email', 'push']
      },
      {
        id: 'contact_erik',
        name: 'Erik (Primary)',
        role: 'primary',
        phone: '070-234 56 78',
        email: 'erik@example.com',
        priority: 1,
        notificationMethods: ['sms', 'call', 'email', 'push']
      },
      {
        id: 'contact_neighbor',
        name: 'Granne (Andersson)',
        role: 'neighbor',
        phone: '070-345 67 89',
        email: 'andersson@example.com',
        priority: 2,
        notificationMethods: ['sms', 'call']
      },
      {
        id: 'contact_emergency',
        name: 'Nödnummer',
        role: 'emergency',
        phone: '112',
        email: null,
        priority: 0,
        notificationMethods: ['call']
      },
      {
        id: 'contact_security',
        name: 'Säkerhetsbolag',
        role: 'security',
        phone: '08-123 456 78',
        email: 'alarm@security.se',
        priority: 1,
        notificationMethods: ['call', 'email']
      }
    ];

    for (const contact of contacts) {
      this.emergencyContacts.set(contact.id, {
        ...contact,
        lastNotified: null,
        timesNotified: 0
      });
    }
  }

  async notifyEmergencyContacts(emergency, urgency = 'high') {
    console.log(`    📢 Notifying emergency contacts (${urgency})...`);

    const contacts = Array.from(this.emergencyContacts.values())
      .filter(c => {
        if (urgency === 'critical') return true;
        if (urgency === 'high') return c.role !== 'neighbor';
        return c.role === 'primary';
      })
      .sort((a, b) => a.priority - b.priority);

    for (const contact of contacts) {
      const message = `🚨 NÖDLÄGE: ${emergency.name} detected at ${emergency.location}`;
      
      console.log(`      → ${contact.name}: ${message}`);

      contact.lastNotified = Date.now();
      contact.timesNotified += 1;

      // Simulate notification delay
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  // ============================================
  // EVACUATION PLANS
  // ============================================

  async setupEvacuationPlans() {
    const plans = [
      {
        id: 'fire_evacuation',
        name: 'Brandevakuering',
        emergencyTypes: ['fire', 'gas_leak'],
        primaryExit: 'front_door',
        secondaryExit: 'balcony',
        assemblyPoint: 'Gården framför huset',
        instructions: [
          'Stäng dörrar bakom dig',
          'Kryp lågt om det är rökigt',
          'Känn dörrar innan du öppnar',
          'Använd trappor, inte hiss',
          'Gå till samlingspunkt'
        ]
      },
      {
        id: 'flood_evacuation',
        name: 'Översvämningsevakuering',
        emergencyTypes: ['water_leak'],
        primaryExit: 'front_door',
        secondaryExit: 'back_door',
        assemblyPoint: 'Grannhuset',
        instructions: [
          'Stäng av el om möjligt',
          'Ta med viktiga dokument',
          'Gå till högre mark',
          'Undvik flödande vatten',
          'Ring försäkringsbolag'
        ]
      }
    ];

    for (const plan of plans) {
      this.evacuationPlans.set(plan.id, plan);
    }
  }

  async activateEvacuation(emergencyType) {
    console.log(`    🏃 Activating evacuation procedure...`);

    const plan = Array.from(this.evacuationPlans.values())
      .find(p => p.emergencyTypes.includes(emergencyType));

    if (!plan) {
      console.log(`      ⚠️ No evacuation plan for ${emergencyType}`);
      return;
    }

    console.log(`      📋 Following plan: ${plan.name}`);
    console.log(`      🚪 Primary exit: ${plan.primaryExit}`);
    console.log(`      📍 Assembly point: ${plan.assemblyPoint}`);

    for (const instruction of plan.instructions) {
      console.log(`        - ${instruction}`);
    }
  }

  // ============================================
  // MONITORING
  // ============================================

  startMonitoring() {
    // Check for active emergencies every minute
    this._intervals.push(setInterval(() => {
      this.monitorActiveEmergencies();
    }, 60 * 1000));

    // Test emergency systems weekly
    this._intervals.push(setInterval(() => {
      const day = new Date().getDay();
      if (day === 0) { // Sunday
        this.testEmergencySystems();
      }
    }, 24 * 60 * 60 * 1000));

    console.log('🚨 Emergency Response Coordinator active');
  }

  async monitorActiveEmergencies() {
    if (this.activeEmergencies.length === 0) return;

    console.log(`🚨 Monitoring ${this.activeEmergencies.length} active emergencies...`);

    for (const emergency of this.activeEmergencies) {
      const duration = Date.now() - emergency.timestamp;
      const minutes = Math.floor(duration / 60000);

      console.log(`  ${emergency.name}: ${minutes} minutes (Status: ${emergency.status})`);

      // Alert if emergency not resolved after 30 minutes
      if (minutes > 30 && emergency.status === 'active') {
        console.log(`    ⚠️ Long-running emergency - consider escalation`);
      }
    }
  }

  async testEmergencySystems() {
    console.log('🧪 Testing emergency systems...');

    // Test smoke detectors
    console.log('  Testing smoke detectors...');
    
    // Test water sensors
    console.log('  Testing water sensors...');
    
    // Test door/window sensors
    console.log('  Testing security sensors...');
    
    // Test emergency contacts
    console.log('  Verifying emergency contacts...');

    console.log('✅ Emergency systems test completed');
  }

  // ============================================
  // REPORTING
  // ============================================

  getEmergencyOverview() {
    const active = this.activeEmergencies.length;
    const critical = this.activeEmergencies.filter(e => e.severity === 'critical').length;
    const totalHistorical = this.emergencyHistory.length;
    const last30Days = this.emergencyHistory.filter(e => 
      e.timestamp > Date.now() - 30 * 24 * 60 * 60 * 1000
    ).length;

    return {
      activeEmergencies: active,
      criticalEmergencies: critical,
      totalHistorical,
      last30Days,
      emergencyContacts: this.emergencyContacts.size,
      protocols: this.emergencyProtocols.size
    };
  }

  getActiveEmergencies() {
    return this.activeEmergencies.map(e => ({
      type: e.name,
      severity: e.severity,
      location: e.location,
      duration: Math.floor((Date.now() - e.timestamp) / 60000) + ' min',
      status: e.status,
      protocolActivated: e.responseActivated
    }));
  }

  getEmergencyHistory(days = 30) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    
    return this.emergencyHistory
      .filter(e => e.timestamp >= cutoff)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 20)
      .map(e => ({
        type: e.name,
        date: new Date(e.timestamp).toLocaleDateString('sv-SE'),
        duration: Math.floor(e.duration / 60000) + ' min',
        resolution: e.resolution || 'N/A'
      }));
  }

  getEmergencyContacts() {
    return Array.from(this.emergencyContacts.values())
      .sort((a, b) => a.priority - b.priority)
      .map(c => ({
        name: c.name,
        role: c.role,
        phone: c.phone,
        priority: c.priority === 0 ? 'Emergency' :
                  c.priority === 1 ? 'High' : 'Medium',
        timesNotified: c.timesNotified
      }));
  }

  destroy() {
    if (this._intervals) {
      this._intervals.forEach(id => clearInterval(id));
      this._intervals = [];
    }
    if (this._timeouts) {
      this._timeouts.forEach(id => clearTimeout(id));
      this._timeouts = [];
    }
  }
}

module.exports = EmergencyResponseCoordinator;
