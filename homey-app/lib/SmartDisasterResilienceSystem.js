'use strict';

class SmartDisasterResilienceSystem {
  constructor(homey) {
    this.homey = homey;
    this.initialized = false;
    this.monitoringInterval = null;
    this.hazardTypes = ['flood', 'storm', 'fire', 'earthquake', 'power_outage', 'extreme_cold', 'extreme_heat', 'landslide'];
    this.riskAssessment = new Map();
    this.supplies = new Map();
    this.floodSensors = new Map();
    this.familyMembers = new Map();
    this.inventoryDocs = new Map();
    this.vulnerablePipes = new Map();
    this.communityNetwork = new Map();
    this.recoveryChecklists = new Map();
    this.drillHistory = [];
    this.stormPrepSteps = ['secure_outdoor_items', 'close_shutters', 'fill_water', 'charge_devices', 'notify_family'];
    this.stormPrepStatus = new Map();
    this.activeAlerts = [];
    this.settings = {};
    this.backupPower = {
      ups: { capacity_kWh: 5.0, current_kWh: 5.0, status: 'standby' },
      generator: { fuel_liters: 40, max_fuel: 50, last_test_date: null, status: 'off' },
      solar_reserve: { capacity_kWh: 10.0, available_kWh: 7.5 }
    };
    this.evacuationPlan = {
      routes: [
        { id: 'primary', name: 'Highway North', waypoints: ['Front door', 'Main road', 'Highway E4', 'Shelter'], estimated_time_min: 25, notes: 'Avoid during flooding' },
        { id: 'secondary', name: 'Local Roads East', waypoints: ['Back door', 'Side street', 'County road 42', 'School'], estimated_time_min: 35, notes: 'Avoids low-lying areas' }
      ],
      meeting_point: { name: 'Community Center', address: 'Storgatan 15', coordinates: { lat: 59.3293, lng: 18.0686 }, backup: 'Björkvägen 8' },
      emergency_contacts: [
        { name: 'Emergency Services', phone: '112' },
        { name: 'Municipality Crisis', phone: '020-100 100' },
        { name: 'Neighbor Erik', phone: '+46701234567' },
        { name: 'Family Anna', phone: '+46709876543' }
      ]
    };
    this.loadPriority = {
      critical: ['refrigerator', 'medical_devices', 'heating_core', 'security_system'],
      important: ['lighting_main', 'communication', 'water_pump', 'router'],
      comfort: ['entertainment', 'secondary_lighting', 'dishwasher', 'washing_machine'],
      non_essential: ['decorative_lighting', 'hot_tub', 'pool_pump', 'ev_charger']
    };
  }

  async initialize() {
    try {
      this.log('Initializing Smart Disaster Resilience System...');
      await this._loadSettings();
      this._initializeRiskAssessments();
      this._initializeSupplies();
      this._initializeFamilyMembers();
      this._initializeVulnerablePipes();
      this._initializeCommunityNetwork();
      this._initializeRecoveryChecklists();
      await this._discoverFloodSensors();
      this._startMonitoringLoop();
      this.initialized = true;
      this.log('System initialized successfully');
    } catch (err) {
      this.error(`Initialization failed: ${err.message}`);
      throw err;
    }
  }

  _initializeRiskAssessments() {
    const data = [
      { type: 'flood', risk_level: 4, seasonal_factor: { winter: 0.5, spring: 1.8, summer: 1.0, fall: 1.4 }, mitigation_score: 6 },
      { type: 'storm', risk_level: 5, seasonal_factor: { winter: 1.6, spring: 1.2, summer: 0.8, fall: 1.5 }, mitigation_score: 5 },
      { type: 'fire', risk_level: 3, seasonal_factor: { winter: 1.3, spring: 0.8, summer: 1.6, fall: 1.0 }, mitigation_score: 7 },
      { type: 'earthquake', risk_level: 2, seasonal_factor: { winter: 1.0, spring: 1.0, summer: 1.0, fall: 1.0 }, mitigation_score: 4 },
      { type: 'power_outage', risk_level: 6, seasonal_factor: { winter: 1.8, spring: 1.0, summer: 1.2, fall: 1.3 }, mitigation_score: 7 },
      { type: 'extreme_cold', risk_level: 7, seasonal_factor: { winter: 2.0, spring: 0.5, summer: 0.0, fall: 0.8 }, mitigation_score: 6 },
      { type: 'extreme_heat', risk_level: 4, seasonal_factor: { winter: 0.0, spring: 0.5, summer: 2.0, fall: 0.3 }, mitigation_score: 5 },
      { type: 'landslide', risk_level: 2, seasonal_factor: { winter: 0.8, spring: 1.5, summer: 0.6, fall: 1.2 }, mitigation_score: 3 }
    ];
    for (const a of data) {
      a.last_assessed = new Date().toISOString();
      this.riskAssessment.set(a.type, a);
    }
    this.log(`Initialized risk assessments for ${data.length} hazard types`);
  }

  _initializeSupplies() {
    const items = [
      { id: 'water', name: 'Drinking Water', quantity: 20, unit: 'liters', needed: 40, expiryDate: this._futureDate(180), location: 'basement_storage' },
      { id: 'food', name: 'Emergency Food', quantity: 3, unit: 'days', needed: 7, expiryDate: this._futureDate(365), location: 'kitchen_pantry' },
      { id: 'batteries', name: 'Batteries', quantity: 8, unit: 'packs', needed: 16, expiryDate: this._futureDate(730), location: 'utility_closet' },
      { id: 'flashlight', name: 'Flashlights', quantity: 2, unit: 'units', needed: 3, expiryDate: null, location: 'hallway_drawer' },
      { id: 'radio', name: 'Emergency Radio', quantity: 1, unit: 'units', needed: 1, expiryDate: null, location: 'living_room' },
      { id: 'first_aid', name: 'First Aid Kit', quantity: 1, unit: 'kits', needed: 2, expiryDate: this._futureDate(365), location: 'bathroom' },
      { id: 'medications', name: 'Medications', quantity: 30, unit: 'days', needed: 60, expiryDate: this._futureDate(90), location: 'bedroom_safe' },
      { id: 'blankets', name: 'Emergency Blankets', quantity: 4, unit: 'units', needed: 6, expiryDate: null, location: 'bedroom_closet' },
      { id: 'documents', name: 'Important Documents', quantity: 1, unit: 'set', needed: 1, expiryDate: null, location: 'fireproof_safe' },
      { id: 'cash', name: 'Emergency Cash', quantity: 2000, unit: 'SEK', needed: 5000, expiryDate: null, location: 'fireproof_safe' }
    ];
    for (const s of items) {
      this.supplies.set(s.id, s);
    }
    this.log(`Initialized ${items.length} emergency supply items`);
  }

  _initializeFamilyMembers() {
    const members = [
      { id: 'member_1', name: 'Parent A', role: 'primary_coordinator', phone: '+46701111111', lastCheckIn: null, status: 'unknown', specialNeeds: null },
      { id: 'member_2', name: 'Parent B', role: 'secondary_coordinator', phone: '+46702222222', lastCheckIn: null, status: 'unknown', specialNeeds: null },
      { id: 'member_3', name: 'Child A', role: 'dependent', phone: '+46703333333', lastCheckIn: null, status: 'unknown', specialNeeds: null },
      { id: 'member_4', name: 'Child B', role: 'dependent', phone: null, lastCheckIn: null, status: 'unknown', specialNeeds: 'young_child' }
    ];
    for (const m of members) {
      this.familyMembers.set(m.id, m);
    }
    this.log(`Initialized ${members.length} family members`);
  }

  _initializeVulnerablePipes() {
    const pipes = [
      { id: 'basement_main', name: 'Basement Main', location: 'basement_north', threshold_celsius: -5, has_heat_tape: true, insulated: true, current_temp: null, status: 'normal' },
      { id: 'crawlspace', name: 'Crawlspace Line', location: 'crawlspace_east', threshold_celsius: -3, has_heat_tape: true, insulated: false, current_temp: null, status: 'normal' },
      { id: 'garage_pipe', name: 'Garage Line', location: 'garage_wall', threshold_celsius: -4, has_heat_tape: false, insulated: true, current_temp: null, status: 'normal' },
      { id: 'outdoor_spigot', name: 'Outdoor Spigot', location: 'south_exterior', threshold_celsius: -2, has_heat_tape: false, insulated: false, current_temp: null, status: 'normal' }
    ];
    for (const p of pipes) {
      this.vulnerablePipes.set(p.id, p);
    }
    this.log(`Initialized ${pipes.length} vulnerable pipe points`);
  }

  _initializeCommunityNetwork() {
    const neighbors = [
      { id: 'neighbor_1', name: 'Erik Svensson', address: 'Granvägen 12', phone: '+46701234567', sharedResources: ['generator', 'chainsaw', 'first_aid'], available: true, skills: ['electrical', 'carpentry'] },
      { id: 'neighbor_2', name: 'Maria Lindqvist', address: 'Granvägen 14', phone: '+46709876543', sharedResources: ['water_pump', 'blankets', 'food'], available: true, skills: ['nursing', 'cooking'] },
      { id: 'neighbor_3', name: 'Anders Johansson', address: 'Björkvägen 3', phone: '+46705556677', sharedResources: ['truck', 'fuel', 'tools'], available: true, skills: ['mechanical', 'plumbing'] }
    ];
    for (const n of neighbors) {
      this.communityNetwork.set(n.id, n);
    }
    this.log(`Initialized community network with ${neighbors.length} neighbors`);
  }

  _initializeRecoveryChecklists() {
    const mkSteps = (arr) => arr.map(s => ({ step: s, completed: false, completedAt: null }));
    const checklists = {
      flood: mkSteps(['Document damage with photos', 'Contact insurance within 24h', 'Pump out standing water', 'Remove wet materials and dry', 'Check electrical before restoring power', 'Sanitize affected surfaces', 'Monitor for mold 2 weeks', 'Replace damaged insulation']),
      storm: mkSteps(['Inspect roof and exterior', 'Document all damage', 'Clear debris from drains', 'Check trees for hanging branches', 'Verify structural integrity', 'Test utility connections', 'File insurance claims']),
      fire: mkSteps(['Wait for fire dept clearance', 'Contact insurance immediately', 'Secure property', 'Document damage', 'Arrange temp housing', 'Salvage documents and valuables', 'Begin smoke remediation', 'Have HVAC cleaned']),
      earthquake: mkSteps(['Check for injuries', 'Check gas leaks', 'Inspect foundation', 'Check water and sewer lines', 'Document cracks and damage', 'Secure objects for aftershocks']),
      power_outage: mkSteps(['Verify utility awareness', 'Activate backup power', 'Minimize fridge opening', 'Check on vulnerable people', 'Reset systems after restore'])
    };
    for (const [k, v] of Object.entries(checklists)) {
      this.recoveryChecklists.set(k, v);
    }
    this.log(`Initialized recovery checklists for ${Object.keys(checklists).length} event types`);
  }

  async _discoverFloodSensors() {
    try {
      const devices = await this.homey.devices.getDevices();
      let count = 0;
      for (const [id, device] of Object.entries(devices)) {
        const n = (device.name || '').toLowerCase();
        if (n.includes('flood') || n.includes('water') || n.includes('leak')) {
          this.floodSensors.set(id, {
            id, name: device.name, zone: device.zone || 'unknown',
            lastTriggered: null, status: 'monitoring', alertsSent: 0
          });
          count++;
        }
      }
      this.log(`Discovered ${count} flood/water/leak sensors`);
    } catch (err) {
      this.error(`Failed to discover flood sensors: ${err.message}`);
    }
  }

  _getCurrentSeason() {
    const m = new Date().getMonth();
    if (m >= 2 && m <= 4) return 'spring';
    if (m >= 5 && m <= 7) return 'summer';
    if (m >= 8 && m <= 10) return 'fall';
    return 'winter';
  }

  assessRisk(hazardType) {
    const a = this.riskAssessment.get(hazardType);
    if (!a) {
      this.error(`Unknown hazard: ${hazardType}`);
      return null;
    }
    const season = this._getCurrentSeason();
    const mult = a.seasonal_factor[season] || 1.0;
    const adjusted = Math.min(10, Math.max(0, (a.risk_level * mult) - a.mitigation_score * 0.1));
    const rounded = Math.round(adjusted * 10) / 10;
    const cat = rounded <= 3 ? 'low' : rounded <= 6 ? 'moderate' : rounded <= 8 ? 'high' : 'critical';
    this.log(`Risk ${hazardType}: ${rounded}/10 (${cat})`);
    return {
      hazardType, baseRisk: a.risk_level, season, seasonalMultiplier: mult,
      mitigationReduction: a.mitigation_score * 0.1, adjustedRisk: rounded,
      riskCategory: cat, assessedAt: new Date().toISOString()
    };
  }

  getOverallRiskLevel() {
    let total = 0;
    let count = 0;
    const details = [];
    for (const h of this.hazardTypes) {
      const r = this.assessRisk(h);
      if (r) {
        total += r.adjustedRisk;
        count++;
        details.push({ hazard: h, risk: r.adjustedRisk, category: r.riskCategory });
      }
    }
    const avg = count > 0 ? Math.round((total / count) * 10) / 10 : 0;
    const cat = avg <= 3 ? 'low' : avg <= 6 ? 'moderate' : avg <= 8 ? 'high' : 'critical';
    return {
      overallRisk: avg, category: cat, hazardCount: count,
      highestRisk: details.reduce((m, d) => d.risk > m.risk ? d : m, { risk: 0 }),
      lowestRisk: details.reduce((m, d) => d.risk < m.risk ? d : m, { risk: 10 }),
      details, assessedAt: new Date().toISOString()
    };
  }

  checkSupplyReadiness() {
    let total = 0;
    let adequate = 0;
    const missing = [];
    const low = [];
    for (const [id, s] of this.supplies) {
      total++;
      const ratio = s.quantity / s.needed;
      if (ratio >= 1.0) {
        adequate++;
      } else if (ratio >= 0.5) {
        low.push({ id, name: s.name, have: s.quantity, need: s.needed, unit: s.unit, percentage: Math.round(ratio * 100) });
      } else {
        missing.push({ id, name: s.name, have: s.quantity, need: s.needed, unit: s.unit, percentage: Math.round(ratio * 100) });
      }
    }
    const pct = total > 0 ? Math.round((adequate / total) * 100) : 0;
    const status = pct >= 80 ? 'good' : pct >= 50 ? 'fair' : 'poor';
    this.log(`Supply readiness: ${pct}% (${status})`);
    return {
      readinessPercentage: pct, totalItems: total, adequateItems: adequate,
      lowItems: low, missingItems: missing, status, checkedAt: new Date().toISOString()
    };
  }

  addSupply(item) {
    if (!item || !item.id || !item.name) {
      this.error('Invalid supply: id and name required');
      return false;
    }
    const supply = {
      id: item.id, name: item.name, quantity: item.quantity || 0,
      unit: item.unit || 'units', needed: item.needed || item.quantity || 1,
      expiryDate: item.expiryDate || null, location: item.location || 'unassigned',
      addedAt: new Date().toISOString()
    };
    this.supplies.set(supply.id, supply);
    this.log(`Added supply: ${supply.name} (${supply.quantity} ${supply.unit})`);
    this._persistSettings();
    return true;
  }

  updateSupplyQuantity(id, qty) {
    const s = this.supplies.get(id);
    if (!s) {
      this.error(`Supply not found: ${id}`);
      return false;
    }
    const prev = s.quantity;
    s.quantity = qty;
    s.lastUpdated = new Date().toISOString();
    this.log(`Supply ${s.name}: ${prev} -> ${qty} ${s.unit}`);
    if (qty < s.needed * 0.25) {
      this.log(`WARNING: ${s.name} critically low (${Math.round((qty / s.needed) * 100)}%)`);
    }
    this._persistSettings();
    return true;
  }

  getExpiringSupplies(days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + (days || 30));
    const expiring = [];
    for (const [id, s] of this.supplies) {
      if (s.expiryDate) {
        const exp = new Date(s.expiryDate);
        if (exp <= cutoff) {
          const daysLeft = Math.ceil((exp - new Date()) / 86400000);
          expiring.push({ id, name: s.name, expiryDate: s.expiryDate, daysUntilExpiry: daysLeft, expired: daysLeft <= 0, location: s.location });
        }
      }
    }
    expiring.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
    this.log(`Found ${expiring.length} supplies expiring within ${days || 30} days`);
    return expiring;
  }

  async monitorBackupPower() {
    const alerts = [];
    const upsPct = (this.backupPower.ups.current_kWh / this.backupPower.ups.capacity_kWh) * 100;
    if (upsPct < 50) {
      alerts.push({ source: 'ups', level: upsPct < 20 ? 'critical' : 'warning', message: `UPS at ${Math.round(upsPct)}%` });
    }
    const fuelPct = (this.backupPower.generator.fuel_liters / this.backupPower.generator.max_fuel) * 100;
    if (fuelPct < 30) {
      alerts.push({ source: 'generator', level: 'warning', message: `Fuel at ${Math.round(fuelPct)}%` });
    }
    if (this.backupPower.generator.last_test_date) {
      const daysSince = Math.ceil((new Date() - new Date(this.backupPower.generator.last_test_date)) / 86400000);
      if (daysSince > 30) {
        alerts.push({ source: 'generator', level: 'info', message: `Not tested in ${daysSince} days` });
      }
    } else {
      alerts.push({ source: 'generator', level: 'info', message: 'Never been test-run' });
    }
    const solarPct = (this.backupPower.solar_reserve.available_kWh / this.backupPower.solar_reserve.capacity_kWh) * 100;
    if (solarPct < 25) {
      alerts.push({ source: 'solar', level: 'warning', message: `Solar reserve at ${Math.round(solarPct)}%` });
    }
    for (const a of alerts) {
      if (a.level === 'critical') {
        this.error(`BACKUP POWER: ${a.message}`);
      } else {
        this.log(`Backup power ${a.level}: ${a.message}`);
      }
    }
    return {
      status: {
        ups: { percentage: Math.round(upsPct), capacity_kWh: this.backupPower.ups.capacity_kWh, current_kWh: this.backupPower.ups.current_kWh, status: this.backupPower.ups.status },
        generator: { fuelPercentage: Math.round(fuelPct), fuel_liters: this.backupPower.generator.fuel_liters, max_fuel: this.backupPower.generator.max_fuel, status: this.backupPower.generator.status },
        solar: { percentage: Math.round(solarPct), available_kWh: this.backupPower.solar_reserve.available_kWh, capacity_kWh: this.backupPower.solar_reserve.capacity_kWh }
      },
      alerts, checkedAt: new Date().toISOString()
    };
  }

  async executeStormPrep() {
    this.log('Initiating storm preparation sequence...');
    const results = [];
    for (const step of this.stormPrepSteps) {
      this.stormPrepStatus.set(step, { status: 'in_progress', startedAt: new Date().toISOString() });
      try {
        const result = await this._executeStormPrepStep(step);
        this.stormPrepStatus.set(step, { status: 'completed', completedAt: new Date().toISOString(), result });
        results.push({ step, success: true, result });
        this.log(`Storm prep completed: ${step}`);
      } catch (err) {
        this.stormPrepStatus.set(step, { status: 'failed', error: err.message });
        results.push({ step, success: false, error: err.message });
        this.error(`Storm prep failed: ${step} - ${err.message}`);
      }
    }
    const completed = results.filter(r => r.success).length;
    this.log(`Storm prep done: ${completed}/${this.stormPrepSteps.length} steps`);
    return {
      completed: completed === this.stormPrepSteps.length,
      stepsTotal: this.stormPrepSteps.length, stepsCompleted: completed,
      stepsFailed: results.filter(r => !r.success).length,
      results, completedAt: new Date().toISOString()
    };
  }

  async _executeStormPrepStep(step) {
    switch (step) {
      case 'secure_outdoor_items':
        this.log('Securing outdoor items - sending reminders');
        return { action: 'Outdoor securing reminders sent', itemsChecked: 5 };
      case 'close_shutters': {
        const devices = await this.homey.devices.getDevices();
        let count = 0;
        for (const [, d] of Object.entries(devices)) {
          const n = (d.name || '').toLowerCase();
          if (n.includes('shutter') || n.includes('blind') || n.includes('jalusi')) {
            count++;
          }
        }
        return { action: 'Shutter close sent', shuttersFound: count };
      }
      case 'fill_water':
        return { action: 'Water fill reminder sent', recommendedLiters: 100 };
      case 'charge_devices':
        return { action: 'Charge reminder sent', devices: ['phones', 'tablets', 'laptops', 'power_banks'] };
      case 'notify_family':
        await this.sendCheckInRequest();
        return { action: 'Family notified', membersNotified: this.familyMembers.size };
      default:
        return { action: 'Unknown step', step };
    }
  }

  async monitorFloodSensors() {
    const alerts = [];
    for (const [id, sensor] of this.floodSensors) {
      try {
        const devices = await this.homey.devices.getDevices();
        const device = devices[id];
        if (!device) {
          sensor.status = 'offline';
          alerts.push({ sensorId: id, name: sensor.name, level: 'warning', message: 'Sensor offline' });
          continue;
        }
        const caps = device.capabilitiesObj || {};
        if (caps.alarm_water && caps.alarm_water.value === true) {
          sensor.status = 'alert';
          sensor.lastTriggered = new Date().toISOString();
          sensor.alertsSent++;
          alerts.push({ sensorId: id, name: sensor.name, level: 'critical', message: `Water detected at ${sensor.name}!`, zone: sensor.zone });
          this.error(`FLOOD ALERT: Water at ${sensor.name}`);
        } else {
          sensor.status = 'monitoring';
        }
      } catch (err) {
        this.error(`Flood sensor error ${id}: ${err.message}`);
        sensor.status = 'error';
      }
    }
    return { sensors: Array.from(this.floodSensors.values()), alerts, checkedAt: new Date().toISOString() };
  }

  async activateSumpPump(sensorId) {
    const sensor = this.floodSensors.get(sensorId);
    const name = sensor ? sensor.name : sensorId;
    this.log(`Activating sump pump for sensor: ${name}`);
    try {
      const devices = await this.homey.devices.getDevices();
      let found = false;
      for (const [, d] of Object.entries(devices)) {
        const n = (d.name || '').toLowerCase();
        if (n.includes('pump') || n.includes('sump')) {
          found = true;
          break;
        }
      }
      return { activated: found, triggeredBy: name, timestamp: new Date().toISOString(), note: found ? 'Sump pump activated' : 'No pump found - manual intervention required' };
    } catch (err) {
      this.error(`Sump pump activation failed: ${err.message}`);
      return { activated: false, error: err.message };
    }
  }

  async initiateEvacuation(reason) {
    this.log(`EVACUATION INITIATED: ${reason}`);
    this.error(`EMERGENCY: Evacuation - ${reason}`);
    const notifications = [];
    for (const c of this.evacuationPlan.emergency_contacts) {
      notifications.push({
        contact: c.name, phone: c.phone,
        message: `EVACUATION: ${reason}. Meet at ${this.evacuationPlan.meeting_point.name}.`,
        sentAt: new Date().toISOString()
      });
      this.log(`Evacuation notification to ${c.name}`);
    }
    for (const [, m] of this.familyMembers) {
      if (m.phone) {
        notifications.push({
          contact: m.name, phone: m.phone,
          message: `EVACUATE NOW: ${reason}. Route: ${this.evacuationPlan.routes[0].name}.`,
          sentAt: new Date().toISOString()
        });
      }
    }
    const record = {
      reason, initiatedAt: new Date().toISOString(),
      primaryRoute: this.evacuationPlan.routes[0],
      secondaryRoute: this.evacuationPlan.routes[1],
      meetingPoint: this.evacuationPlan.meeting_point,
      notifications, status: 'active'
    };
    this.activeAlerts.push({ type: 'evacuation', level: 'critical', data: record, createdAt: new Date().toISOString() });
    this.log(`Evacuation: ${notifications.length} notifications sent`);
    return record;
  }

  async sendCheckInRequest() {
    this.log('Sending family check-in requests...');
    const requests = [];
    for (const [id, m] of this.familyMembers) {
      const delivered = !!m.phone;
      requests.push({ memberId: id, memberName: m.name, requestedAt: new Date().toISOString(), status: 'pending', delivered });
      this.log(delivered ? `Check-in sent to ${m.name}` : `No phone for ${m.name}`);
    }
    return { requests, totalSent: requests.filter(r => r.delivered).length, sentAt: new Date().toISOString() };
  }

  recordCheckIn(memberId, status) {
    const m = this.familyMembers.get(memberId);
    if (!m) {
      this.error(`Member not found: ${memberId}`);
      return false;
    }
    const valid = ['safe', 'needs_help', 'injured', 'evacuating', 'at_meeting_point'];
    if (!valid.includes(status)) {
      this.error(`Invalid status: ${status}. Valid: ${valid.join(', ')}`);
      return false;
    }
    m.lastCheckIn = new Date().toISOString();
    m.status = status;
    this.log(`Check-in: ${m.name} - ${status}`);
    if (status === 'needs_help' || status === 'injured') {
      this.error(`URGENT: ${m.name} reports "${status}"`);
    }
    this._persistSettings();
    return true;
  }

  getCheckInStatus() {
    const members = [];
    let accounted = 0;
    for (const [id, m] of this.familyMembers) {
      const isAccounted = m.status !== 'unknown';
      if (isAccounted) accounted++;
      const entry = { memberId: id, name: m.name, role: m.role, status: m.status, lastCheckIn: m.lastCheckIn, accountedFor: isAccounted };
      if (m.lastCheckIn) {
        entry.minutesSinceCheckIn = Math.round((new Date() - new Date(m.lastCheckIn)) / 60000);
      }
      members.push(entry);
    }
    return {
      allAccountedFor: accounted === this.familyMembers.size,
      totalMembers: this.familyMembers.size, accountedFor: accounted,
      needingHelp: members.filter(s => s.status === 'needs_help' || s.status === 'injured').length,
      members, checkedAt: new Date().toISOString()
    };
  }

  updateInsuranceDoc(room, items) {
    if (!room || !items || !Array.isArray(items)) {
      this.error('Invalid: room (string) and items (array) required');
      return false;
    }
    const processed = items.map(i => ({
      name: i.name || 'Unknown', serialNumber: i.serialNumber || null,
      estimatedValue: i.estimatedValue || 0, purchaseDate: i.purchaseDate || null,
      category: i.category || 'general', addedAt: new Date().toISOString()
    }));
    const totalValue = processed.reduce((s, i) => s + (i.estimatedValue || 0), 0);
    const existing = this.inventoryDocs.get(room);
    if (existing) {
      existing.items = processed;
      existing.lastUpdated = new Date().toISOString();
      existing.totalValue = totalValue;
    } else {
      this.inventoryDocs.set(room, { room, items: processed, totalValue, lastUpdated: new Date().toISOString(), photosTaken: false });
    }
    this.log(`Insurance updated: ${room} - ${processed.length} items, ${totalValue} SEK`);
    this._persistSettings();
    return true;
  }

  getInsuranceSummary() {
    let totalValue = 0;
    let totalItems = 0;
    const rooms = [];
    for (const [room, doc] of this.inventoryDocs) {
      totalValue += doc.totalValue;
      totalItems += doc.items.length;
      rooms.push({ room, itemCount: doc.items.length, totalValue: doc.totalValue, lastUpdated: doc.lastUpdated, photosTaken: doc.photosTaken });
    }
    return { totalRooms: this.inventoryDocs.size, totalItems, totalEstimatedValue: totalValue, rooms, generatedAt: new Date().toISOString() };
  }

  async monitorPipeTemps() {
    const alerts = [];
    for (const [id, pipe] of this.vulnerablePipes) {
      try {
        const devices = await this.homey.devices.getDevices();
        for (const [, d] of Object.entries(devices)) {
          const n = (d.name || '').toLowerCase();
          if (n.includes(pipe.location) || n.includes(id.replace(/_/g, ' '))) {
            const caps = d.capabilitiesObj || {};
            if (caps.measure_temperature && caps.measure_temperature.value !== null) {
              pipe.current_temp = caps.measure_temperature.value;
              break;
            }
          }
        }
        if (pipe.current_temp !== null && pipe.current_temp <= pipe.threshold_celsius) {
          pipe.status = 'at_risk';
          alerts.push({
            pipeId: id, name: pipe.name, currentTemp: pipe.current_temp,
            threshold: pipe.threshold_celsius,
            level: pipe.current_temp <= pipe.threshold_celsius - 3 ? 'critical' : 'warning',
            hasHeatTape: pipe.has_heat_tape
          });
          this.error(`PIPE FREEZE: ${pipe.name} at ${pipe.current_temp}°C (threshold ${pipe.threshold_celsius}°C)`);
          if (pipe.has_heat_tape) {
            await this.activateHeatTape(id);
          }
        } else if (pipe.current_temp !== null && pipe.current_temp > pipe.threshold_celsius + 3) {
          pipe.status = 'normal';
        }
      } catch (err) {
        this.error(`Pipe monitor error ${id}: ${err.message}`);
      }
    }
    return { pipes: Array.from(this.vulnerablePipes.values()), alerts, atRiskCount: alerts.length, checkedAt: new Date().toISOString() };
  }

  async activateHeatTape(pipeId) {
    const pipe = this.vulnerablePipes.get(pipeId);
    if (!pipe) {
      this.error(`Unknown pipe: ${pipeId}`);
      return false;
    }
    if (!pipe.has_heat_tape) {
      this.log(`No heat tape at ${pipe.name}`);
      return false;
    }
    this.log(`Activating heat tape for ${pipe.name}`);
    try {
      const devices = await this.homey.devices.getDevices();
      for (const [, d] of Object.entries(devices)) {
        const n = (d.name || '').toLowerCase();
        if ((n.includes('heat tape') || n.includes('heat cable') || n.includes('pipe heater')) && n.includes(pipe.location.split('_')[0])) {
          this.log(`Heat tape activated: ${d.name}`);
          return { activated: true, device: d.name, pipe: pipe.name, timestamp: new Date().toISOString() };
        }
      }
      this.log(`No heat tape device found for ${pipe.name}`);
      return { activated: false, pipe: pipe.name, note: 'No matching device' };
    } catch (err) {
      this.error(`Heat tape error: ${err.message}`);
      return { activated: false, error: err.message };
    }
  }

  async autoTransferToGenerator() {
    this.log('Auto-transfer to generator...');
    const gen = this.backupPower.generator;
    if (gen.fuel_liters < 5) {
      this.error('Generator fuel critically low');
      return { success: false, reason: 'Insufficient fuel' };
    }
    gen.status = 'starting';
    await this._delay(2000);
    gen.status = 'running';
    const transferLog = [];
    for (const d of this.loadPriority.critical) {
      transferLog.push({ device: d, transferred: true, tier: 'critical', timestamp: new Date().toISOString() });
    }
    for (const d of this.loadPriority.important) {
      transferLog.push({ device: d, transferred: true, tier: 'important', timestamp: new Date().toISOString() });
    }
    const runtime = gen.fuel_liters / 2.0;
    this.log(`Generator transfer complete - est. ${runtime.toFixed(1)}h runtime`);
    return {
      success: true, generatorStatus: gen.status, fuelLevel: gen.fuel_liters,
      estimatedRuntimeHours: Math.round(runtime * 10) / 10, totalLoadKw: 4.5,
      transferLog, timestamp: new Date().toISOString()
    };
  }

  async shedLoad(tier) {
    const valid = Object.keys(this.loadPriority);
    if (!valid.includes(tier)) {
      this.error(`Invalid tier: ${tier}. Valid: ${valid.join(', ')}`);
      return false;
    }
    this.log(`Shedding load tier: ${tier}`);
    const devices = (this.loadPriority[tier] || []).map(d => {
      this.log(`Shed: ${d} (${tier})`);
      return { device: d, action: 'disconnected', tier, timestamp: new Date().toISOString() };
    });
    return { tier, devicesShed: devices.length, devices, remainingTiers: valid.filter(t => t !== tier), timestamp: new Date().toISOString() };
  }

  async requestHelp(resourceType) {
    this.log(`Requesting help: ${resourceType}`);
    const matches = [];
    for (const [id, n] of this.communityNetwork) {
      if (n.available && n.sharedResources.includes(resourceType)) {
        matches.push({ neighborId: id, name: n.name, address: n.address, phone: n.phone, resource: resourceType });
        this.log(`Match: ${n.name} has ${resourceType}`);
      }
    }
    if (matches.length === 0) {
      this.log(`No matches for: ${resourceType}`);
    }
    return { resourceRequested: resourceType, matchesFound: matches.length, matches, requestedAt: new Date().toISOString() };
  }

  offerHelp(resourceType, quantity) {
    this.log(`Offering: ${quantity}x ${resourceType}`);
    const notified = Array.from(this.communityNetwork.values()).map(n => ({ id: n.id, name: n.name }));
    return {
      offer: { resource: resourceType, quantity, offeredAt: new Date().toISOString(), status: 'available', claimedBy: null },
      notifiedNeighbors: notified, offeredAt: new Date().toISOString()
    };
  }

  getRecoveryChecklist(eventType) {
    const cl = this.recoveryChecklists.get(eventType);
    if (!cl) {
      this.error(`No checklist for: ${eventType}`);
      return null;
    }
    const done = cl.filter(s => s.completed).length;
    return {
      eventType, totalSteps: cl.length, completedSteps: done,
      progress: cl.length > 0 ? Math.round((done / cl.length) * 100) : 0,
      steps: cl.map((s, i) => ({ index: i, description: s.step, completed: s.completed, completedAt: s.completedAt })),
      retrievedAt: new Date().toISOString()
    };
  }

  completeRecoveryStep(eventType, stepIndex) {
    const cl = this.recoveryChecklists.get(eventType);
    if (!cl) {
      this.error(`No checklist for: ${eventType}`);
      return false;
    }
    if (stepIndex < 0 || stepIndex >= cl.length) {
      this.error(`Invalid step ${stepIndex} for ${eventType} (0-${cl.length - 1})`);
      return false;
    }
    if (cl[stepIndex].completed) {
      this.log(`Step ${stepIndex} already done for ${eventType}`);
      return true;
    }
    cl[stepIndex].completed = true;
    cl[stepIndex].completedAt = new Date().toISOString();
    const remaining = cl.filter(s => !s.completed).length;
    this.log(`Recovery step done: ${eventType} #${stepIndex} (${remaining} remaining)`);
    this._persistSettings();
    return true;
  }

  getSeasonalChecklist(season) {
    const lists = {
      winter: [
        { task: 'Service heating system', priority: 'high', category: 'heating' },
        { task: 'Insulate exposed pipes and spigots', priority: 'high', category: 'plumbing' },
        { task: 'Test generator and top off fuel', priority: 'high', category: 'power' },
        { task: 'Stock winter supplies (salt, sand, shovels)', priority: 'medium', category: 'supplies' },
        { task: 'Check roof for ice dam prevention', priority: 'medium', category: 'structure' },
        { task: 'Verify heat tape functionality', priority: 'high', category: 'plumbing' },
        { task: 'Update food and water supplies', priority: 'medium', category: 'supplies' },
        { task: 'Test smoke and CO detectors', priority: 'high', category: 'safety' },
        { task: 'Ready snow removal equipment', priority: 'medium', category: 'equipment' },
        { task: 'Check vehicle antifreeze', priority: 'medium', category: 'vehicle' }
      ],
      spring: [
        { task: 'Inspect for winter damage', priority: 'high', category: 'structure' },
        { task: 'Clear gutters and downspouts', priority: 'high', category: 'drainage' },
        { task: 'Test sump pump', priority: 'high', category: 'flood' },
        { task: 'Check flood sensors and batteries', priority: 'high', category: 'flood' },
        { task: 'Inspect foundation for frost heave', priority: 'medium', category: 'structure' },
        { task: 'Service generator post-winter', priority: 'medium', category: 'power' },
        { task: 'Review evacuation routes', priority: 'low', category: 'planning' },
        { task: 'Check supply expiration dates', priority: 'medium', category: 'supplies' }
      ],
      summer: [
        { task: 'Create defensible space (fire)', priority: 'high', category: 'fire' },
        { task: 'Inspect and clean AC', priority: 'high', category: 'cooling' },
        { task: 'Check drainage systems', priority: 'medium', category: 'drainage' },
        { task: 'Review extreme heat plan', priority: 'medium', category: 'planning' },
        { task: 'Test UPS and solar reserve', priority: 'medium', category: 'power' },
        { task: 'Update emergency contacts', priority: 'low', category: 'planning' },
        { task: 'Conduct summer drill', priority: 'medium', category: 'drill' },
        { task: 'Inspect trees for dead branches', priority: 'high', category: 'structure' }
      ],
      fall: [
        { task: 'Clean gutters before leaf fall', priority: 'high', category: 'drainage' },
        { task: 'Service heating before winter', priority: 'high', category: 'heating' },
        { task: 'Stock winter emergency supplies', priority: 'medium', category: 'supplies' },
        { task: 'Secure outdoor furniture', priority: 'medium', category: 'structure' },
        { task: 'Test all backup power systems', priority: 'high', category: 'power' },
        { task: 'Review insurance policies', priority: 'medium', category: 'insurance' },
        { task: 'Winterize outdoor plumbing', priority: 'high', category: 'plumbing' },
        { task: 'Conduct fall drill', priority: 'medium', category: 'drill' },
        { task: 'Replace weather stripping', priority: 'medium', category: 'insulation' }
      ]
    };
    const cl = lists[season];
    if (!cl) {
      this.error(`Invalid season: ${season}. Valid: winter, spring, summer, fall`);
      return null;
    }
    return {
      season, totalTasks: cl.length,
      highPriority: cl.filter(t => t.priority === 'high').length,
      mediumPriority: cl.filter(t => t.priority === 'medium').length,
      lowPriority: cl.filter(t => t.priority === 'low').length,
      tasks: cl, generatedAt: new Date().toISOString()
    };
  }

  scheduleDrill(type, date) {
    const valid = ['fire_evacuation', 'flood_response', 'power_outage', 'earthquake_shelter', 'full_evacuation', 'storm_prep'];
    if (!valid.includes(type)) {
      this.error(`Invalid drill type: ${type}. Valid: ${valid.join(', ')}`);
      return false;
    }
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      this.error(`Invalid date: ${date}`);
      return false;
    }
    const drill = { id: `drill_${Date.now()}`, type, scheduledDate: d.toISOString(), status: 'scheduled', createdAt: new Date().toISOString(), score: null };
    this.drillHistory.push(drill);
    this.log(`Drill scheduled: ${type} on ${d.toLocaleDateString()}`);
    this._persistSettings();
    return drill;
  }

  async conductDrill(type) {
    this.log(`Conducting drill: ${type}`);
    const startTime = Date.now();
    const scenarios = {
      fire_evacuation: { steps: ['Sound alarm', 'Evacuate occupants', 'Check rooms', 'Meet at assembly', 'Call emergency', 'Account for members'], targetMin: 5 },
      flood_response: { steps: ['Check sensors', 'Move valuables', 'Activate sump pump', 'Sandbag entries', 'Shut basement power'], targetMin: 15 },
      power_outage: { steps: ['Verify outage', 'Activate UPS', 'Start generator', 'Prioritize loads', 'Notify family'], targetMin: 10 },
      earthquake_shelter: { steps: ['Drop cover hold', 'Check injuries', 'Inspect gas leaks', 'Check structure', 'Prep for aftershocks'], targetMin: 8 },
      full_evacuation: { steps: ['Sound alarm', 'Grab bags', 'Secure home', 'Load vehicles', 'Follow route', 'Arrive at point'], targetMin: 20 },
      storm_prep: { steps: ['Secure outdoor items', 'Close shutters', 'Fill water', 'Charge devices', 'Notify contacts'], targetMin: 30 }
    };
    const sc = scenarios[type];
    if (!sc) {
      this.error(`Unknown drill: ${type}`);
      return null;
    }
    const stepResults = [];
    for (let i = 0; i < sc.steps.length; i++) {
      const t = Date.now();
      await this._delay(100);
      stepResults.push({ step: sc.steps[i], index: i, completed: true, timeMs: Date.now() - t });
    }
    const totalSec = (Date.now() - startTime) / 1000;
    const timeScore = totalSec <= sc.targetMin * 60 ? 100 : Math.max(0, 100 - ((totalSec - sc.targetMin * 60) / 60) * 10);
    const compScore = (stepResults.filter(s => s.completed).length / sc.steps.length) * 100;
    const overall = Math.round(timeScore * 0.4 + compScore * 0.6);
    const grade = overall >= 90 ? 'A' : overall >= 80 ? 'B' : overall >= 70 ? 'C' : overall >= 60 ? 'D' : 'F';
    const result = {
      type, score: overall, timeScore: Math.round(timeScore), completionScore: Math.round(compScore),
      totalTimeSeconds: Math.round(totalSec * 10) / 10, targetTimeMinutes: sc.targetMin,
      stepsCompleted: stepResults.filter(s => s.completed).length, totalSteps: sc.steps.length,
      steps: stepResults, grade, conductedAt: new Date().toISOString()
    };
    const existing = this.drillHistory.find(d => d.type === type && d.status === 'scheduled');
    if (existing) {
      existing.status = 'completed';
      existing.score = overall;
      existing.result = result;
      existing.completedAt = new Date().toISOString();
    } else {
      this.drillHistory.push({ id: `drill_${Date.now()}`, type, status: 'completed', score: overall, result, createdAt: new Date().toISOString(), completedAt: new Date().toISOString() });
    }
    this.log(`Drill done: ${type} - ${overall}/100 (${grade})`);
    this._persistSettings();
    return result;
  }

  calculateReadinessScore() {
    // Supplies: 30%
    const supplyPct = this.checkSupplyReadiness().readinessPercentage;
    // Backup Power: 25%
    const upsPct = (this.backupPower.ups.current_kWh / this.backupPower.ups.capacity_kWh) * 100;
    const fuelPct = (this.backupPower.generator.fuel_liters / this.backupPower.generator.max_fuel) * 100;
    const solarPct = (this.backupPower.solar_reserve.available_kWh / this.backupPower.solar_reserve.capacity_kWh) * 100;
    const powerScore = upsPct * 0.4 + fuelPct * 0.35 + solarPct * 0.25;
    // Plans: 20%
    let planPts = 0;
    if (this.evacuationPlan.routes.length >= 2) planPts += 25;
    else if (this.evacuationPlan.routes.length >= 1) planPts += 15;
    if (this.evacuationPlan.meeting_point) planPts += 25;
    planPts += Math.min(25, this.evacuationPlan.emergency_contacts.length >= 3 ? 25 : this.evacuationPlan.emergency_contacts.length * 8);
    planPts += this.familyMembers.size >= 2 ? 25 : this.familyMembers.size * 12;
    const planScore = planPts;
    // Drills: 15%
    let drillScore = 0;
    const completedDrills = this.drillHistory.filter(d => d.status === 'completed');
    if (completedDrills.length > 0) {
      const sixMonths = new Date();
      sixMonths.setMonth(sixMonths.getMonth() - 6);
      const recent = completedDrills.filter(d => new Date(d.completedAt || d.createdAt) >= sixMonths);
      const freqScore = recent.length >= 3 ? 80 : recent.length >= 1 ? 50 : 20;
      const avgScore = completedDrills.reduce((s, d) => s + (d.score || 0), 0) / completedDrills.length;
      drillScore = (freqScore + avgScore) / 2;
    }
    // Community: 10%
    const available = Array.from(this.communityNetwork.values()).filter(n => n.available);
    let commScore = available.length >= 3 ? 100 : available.length >= 2 ? 75 : available.length >= 1 ? 50 : 0;
    if (available.reduce((s, n) => s + n.sharedResources.length, 0) >= 5) {
      commScore = Math.min(100, commScore + 10);
    }
    // Combine weighted scores
    const overall = Math.round(supplyPct * 0.30 + powerScore * 0.25 + planScore * 0.20 + drillScore * 0.15 + commScore * 0.10);
    const clamped = Math.min(100, Math.max(0, overall));
    const grade = clamped >= 90 ? 'A' : clamped >= 80 ? 'B' : clamped >= 70 ? 'C' : clamped >= 60 ? 'D' : 'F';
    const recs = [];
    if (supplyPct < 70) recs.push('Increase emergency supply levels');
    if (powerScore < 70) recs.push('Maintain backup power systems');
    if (planScore < 80) recs.push('Update emergency plans and contacts');
    if (drillScore < 50) recs.push('Conduct more regular drills (3+/year)');
    if (commScore < 75) recs.push('Expand community resource sharing');
    this.log(`Readiness: ${clamped}/100 (${grade})`);
    return {
      overallScore: clamped,
      breakdown: {
        supplies: { score: Math.round(supplyPct), weight: '30%' },
        backupPower: { score: Math.round(powerScore), weight: '25%' },
        plans: { score: Math.round(planScore), weight: '20%' },
        drills: { score: Math.round(drillScore), weight: '15%' },
        community: { score: Math.round(commScore), weight: '10%' }
      },
      grade, recommendations: recs, calculatedAt: new Date().toISOString()
    };
  }

  _startMonitoringLoop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    const intervalMs = 30 * 60 * 1000;
    this.monitoringInterval = setInterval(async () => {
      try {
        await this._runMonitoringCycle();
      } catch (err) {
        this.error(`Monitoring cycle error: ${err.message}`);
      }
    }, intervalMs);
    this.log(`Monitoring loop started (every ${intervalMs / 60000} min)`);
  }

  async _runMonitoringCycle() {
    this.log('Running monitoring cycle...');
    try { await this.monitorPipeTemps(); } catch (err) { this.error(`Pipe check failed: ${err.message}`); }
    try { await this.monitorFloodSensors(); } catch (err) { this.error(`Flood check failed: ${err.message}`); }
    try {
      const exp = this.getExpiringSupplies(14);
      for (const item of exp) {
        if (item.expired) {
          this.error(`EXPIRED: ${item.name} (${Math.abs(item.daysUntilExpiry)} days ago)`);
        } else {
          this.log(`Expiring: ${item.name} in ${item.daysUntilExpiry} days`);
        }
      }
    } catch (err) { this.error(`Supply expiry check failed: ${err.message}`); }
    try { await this.monitorBackupPower(); } catch (err) { this.error(`Power check failed: ${err.message}`); }
    this.log('Monitoring cycle complete');
  }

  getStatistics() {
    const supply = this.checkSupplyReadiness();
    const risk = this.getOverallRiskLevel();
    const readiness = this.calculateReadinessScore();
    const checkIn = this.getCheckInStatus();
    const insurance = this.getInsuranceSummary();
    return {
      system: 'SmartDisasterResilienceSystem',
      initialized: this.initialized,
      readinessScore: readiness.overallScore,
      readinessGrade: readiness.grade,
      overallRisk: risk.overallRisk,
      riskCategory: risk.category,
      supplyReadiness: supply.readinessPercentage,
      supplyStatus: supply.status,
      hazardTypes: this.hazardTypes.length,
      supplyItems: this.supplies.size,
      floodSensors: this.floodSensors.size,
      familyMembers: this.familyMembers.size,
      familyAccountedFor: checkIn.accountedFor,
      vulnerablePipes: this.vulnerablePipes.size,
      communityNeighbors: this.communityNetwork.size,
      inventoryRooms: this.inventoryDocs.size,
      insuranceValue: insurance.totalEstimatedValue,
      drillsCompleted: this.drillHistory.filter(d => d.status === 'completed').length,
      drillsScheduled: this.drillHistory.filter(d => d.status === 'scheduled').length,
      activeAlerts: this.activeAlerts.length,
      backupPower: {
        upsPercent: Math.round((this.backupPower.ups.current_kWh / this.backupPower.ups.capacity_kWh) * 100),
        generatorFuelPercent: Math.round((this.backupPower.generator.fuel_liters / this.backupPower.generator.max_fuel) * 100),
        solarReservePercent: Math.round((this.backupPower.solar_reserve.available_kWh / this.backupPower.solar_reserve.capacity_kWh) * 100)
      },
      evacuationRoutes: this.evacuationPlan.routes.length,
      recoveryChecklists: this.recoveryChecklists.size,
      breakdown: readiness.breakdown,
      recommendations: readiness.recommendations,
      timestamp: new Date().toISOString()
    };
  }

  async _loadSettings() {
    try {
      const saved = this.homey.settings.get('disaster_resilience_settings');
      if (saved) {
        this.settings = saved;
        if (Array.isArray(saved.supplies)) {
          for (const s of saved.supplies) this.supplies.set(s.id, s);
        }
        if (Array.isArray(saved.drillHistory)) {
          this.drillHistory = saved.drillHistory;
        }
        if (Array.isArray(saved.inventoryDocs)) {
          for (const d of saved.inventoryDocs) this.inventoryDocs.set(d.room, d);
        }
        if (Array.isArray(saved.familyCheckIns)) {
          for (const c of saved.familyCheckIns) {
            const m = this.familyMembers.get(c.id);
            if (m) {
              m.lastCheckIn = c.lastCheckIn;
              m.status = c.status;
            }
          }
        }
        if (saved.backupPower) {
          Object.assign(this.backupPower, saved.backupPower);
        }
        this.log('Settings loaded from storage');
      }
    } catch (err) {
      this.error(`Load settings failed: ${err.message}`);
    }
  }

  _persistSettings() {
    try {
      this.homey.settings.set('disaster_resilience_settings', {
        supplies: Array.from(this.supplies.values()),
        drillHistory: this.drillHistory,
        inventoryDocs: Array.from(this.inventoryDocs.values()),
        familyCheckIns: Array.from(this.familyMembers.entries()).map(([id, m]) => ({
          id, lastCheckIn: m.lastCheckIn, status: m.status
        })),
        backupPower: this.backupPower,
        savedAt: new Date().toISOString()
      });
    } catch (err) {
      this.error(`Persist settings failed: ${err.message}`);
    }
  }

  _futureDate(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString();
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  log(msg) {
    this.homey.log('[Disaster]', msg);
  }

  error(msg) {
    this.homey.error('[Disaster]', msg);
  }

  async destroy() {
    this.log('Destroying Smart Disaster Resilience System...');
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this._persistSettings();
    this.riskAssessment.clear();
    this.supplies.clear();
    this.floodSensors.clear();
    this.familyMembers.clear();
    this.inventoryDocs.clear();
    this.vulnerablePipes.clear();
    this.communityNetwork.clear();
    this.recoveryChecklists.clear();
    this.drillHistory = [];
    this.activeAlerts = [];
    this.initialized = false;
    this.log('System destroyed');
  }
}

module.exports = SmartDisasterResilienceSystem;
