'use strict';

/**
 * SmartPerimeterManagementSystem
 * [Perimeter] Gate/fence/driveway security management with intrusion detection,
 * vehicle classification, visitor pre-auth, weather awareness, and patrol scheduling.
 */
class SmartPerimeterManagementSystem {

  constructor(homey) {
    this.homey = homey;

    /** @type {Map<string, object>} Entrance configurations */
    this.entrances = this._buildEntrances();

    /** @type {Map<string, object>} Detection zones */
    this.detectionZones = this._buildDetectionZones();

    /** @type {Map<string, object>} Known vehicle plates */
    this.knownVehicles = new Map();

    /** @type {Map<string, object>} Active temporary access codes */
    this.accessCodes = new Map();

    /** @type {Array<object>} Visitor pre-authorisations */
    this.preAuthorizations = [];

    /** @type {Array<object>} Security escalation chain */
    this.escalationChain = this._buildEscalationChain();

    /** @type {object} Fence health data */
    this.fenceHealth = {
      sections: this._buildFenceSections(),
      lastInspection: null,
      overallCondition: 'good',
    };

    /** @type {object} Driveway conditions */
    this.drivewayConditions = {
      surfaceTemp: null,
      snowDetected: false,
      iceDetected: false,
      lastSalted: null,
      heatingActive: false,
      lastPlowed: null,
      snowDepthCm: 0,
    };

    /** @type {object} Approach lighting config */
    this.approachLighting = {
      enabled: true,
      zones: {
        front_gate: { lightIds: [], brightness: 100, duration: 120 },
        side_gate: { lightIds: [], brightness: 80, duration: 90 },
        back_fence: { lightIds: [], brightness: 100, duration: 120 },
        garage: { lightIds: [], brightness: 100, duration: 180 },
        driveway: { lightIds: [], brightness: 70, duration: 150 },
      },
      activeTimers: new Map(),
    };

    /** @type {Array<object>} Patrol schedule */
    this.patrolSchedule = [];

    /** @type {Array<object>} License plate log */
    this.plateLog = [];

    /** @type {Array<object>} Full audit trail */
    this.auditTrail = [];

    /** @type {object} Settings */
    this.settings = {
      monitoringIntervalMs: 5 * 60 * 1000,
      autoLockAfterMinutes: 5,
      intrusionSensitivity: 'medium',
      wildlifeDiscrimination: true,
      snowAlertEnabled: true,
      patrolEnabled: false,
      silentHoursStart: 23,
      silentHoursEnd: 6,
      maxAuditTrailSize: 1000,
      maxPlateLogSize: 500,
    };

    /** @type {number} Current escalation level (0 = normal) */
    this.currentEscalationLevel = 0;

    this.monitoringTimer = null;
    this.initialized = false;
    this._codeIdCounter = 1;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async initialize() {
    try {
      this.log('Initializing SmartPerimeterManagementSystem');
      await this._loadSettings();
      this._startMonitoringLoop();
      this.initialized = true;
      this.log('SmartPerimeterManagementSystem initialized successfully');
    } catch (error) {
      this.homey.error(`[SmartPerimeterManagementSystem] Failed to initialize:`, error.message);
    }
  }

  async destroy() {
    this.log('Shutting down SmartPerimeterManagementSystem');
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }
    for (const timer of this.approachLighting.activeTimers.values()) {
      clearTimeout(timer);
    }
    this.approachLighting.activeTimers.clear();
    await this._saveSettings();
    this.initialized = false;
    this.log('SmartPerimeterManagementSystem destroyed');
  }

  // ---------------------------------------------------------------------------
  // Entrance definitions (4 entrances)
  // ---------------------------------------------------------------------------

  _buildEntrances() {
    const map = new Map();

    map.set('front_gate', {
      id: 'front_gate',
      label: 'Front Gate',
      type: 'motorised_gate',
      state: 'closed',
      locked: true,
      lastStateChange: null,
      operationCount: 0,
      hasCamera: true,
      hasIntercom: true,
      maintenanceDue: null,
    });

    map.set('side_gate', {
      id: 'side_gate',
      label: 'Side Gate',
      type: 'manual_gate',
      state: 'closed',
      locked: true,
      lastStateChange: null,
      operationCount: 0,
      hasCamera: false,
      hasIntercom: false,
      maintenanceDue: null,
    });

    map.set('back_fence', {
      id: 'back_fence',
      label: 'Back Fence Gate',
      type: 'manual_gate',
      state: 'closed',
      locked: true,
      lastStateChange: null,
      operationCount: 0,
      hasCamera: true,
      hasIntercom: false,
      maintenanceDue: null,
    });

    map.set('garage', {
      id: 'garage',
      label: 'Garage Entrance',
      type: 'motorised_door',
      state: 'closed',
      locked: true,
      lastStateChange: null,
      operationCount: 0,
      hasCamera: true,
      hasIntercom: true,
      maintenanceDue: null,
    });

    return map;
  }

  // ---------------------------------------------------------------------------
  // Gate control: open / close / lock
  // ---------------------------------------------------------------------------

  openGate(entranceId) {
    const entrance = this.entrances.get(entranceId);
    if (!entrance) {
      this.error(`Entrance not found: ${entranceId}`);
      return null;
    }

    if (entrance.state === 'open') {
      this.log(`${entrance.label} is already open`);
      return entrance;
    }

    entrance.state = 'open';
    entrance.locked = false;
    entrance.lastStateChange = new Date();
    entrance.operationCount++;

    this._addAuditEntry('gate_open', entranceId, `${entrance.label} opened`);
    this.log(`Opened ${entrance.label}`);

    // Trigger approach lighting
    if (this.approachLighting.enabled) {
      this._activateApproachLighting(entranceId);
    }

    // Schedule auto-lock
    if (this.settings.autoLockAfterMinutes > 0) {
      this._scheduleAutoLock(entranceId);
    }

    return entrance;
  }

  closeGate(entranceId) {
    const entrance = this.entrances.get(entranceId);
    if (!entrance) {
      this.error(`Entrance not found: ${entranceId}`);
      return null;
    }

    if (entrance.state === 'closed') {
      this.log(`${entrance.label} is already closed`);
      return entrance;
    }

    entrance.state = 'closed';
    entrance.lastStateChange = new Date();
    entrance.operationCount++;

    this._addAuditEntry('gate_close', entranceId, `${entrance.label} closed`);
    this.log(`Closed ${entrance.label}`);
    return entrance;
  }

  lockGate(entranceId) {
    const entrance = this.entrances.get(entranceId);
    if (!entrance) {
      this.error(`Entrance not found: ${entranceId}`);
      return null;
    }

    if (entrance.state === 'open') {
      this.closeGate(entranceId);
    }

    entrance.locked = true;
    entrance.lastStateChange = new Date();

    this._addAuditEntry('gate_lock', entranceId, `${entrance.label} locked`);
    this.log(`Locked ${entrance.label}`);
    return entrance;
  }

  lockAllGates() {
    const results = [];
    for (const [id] of this.entrances) {
      results.push(this.lockGate(id));
    }
    this._addAuditEntry('lockdown', 'all', 'All entrances locked');
    this.log('All entrances locked');
    return results;
  }

  unlockGate(entranceId) {
    const entrance = this.entrances.get(entranceId);
    if (!entrance) {
      this.error(`Entrance not found: ${entranceId}`);
      return null;
    }

    entrance.locked = false;
    entrance.lastStateChange = new Date();

    this._addAuditEntry('gate_unlock', entranceId, `${entrance.label} unlocked`);
    this.log(`Unlocked ${entrance.label}`);
    return entrance;
  }

  getEntranceStatus(entranceId) {
    return this.entrances.get(entranceId) || null;
  }

  getAllEntranceStatuses() {
    const statuses = [];
    for (const entrance of this.entrances.values()) {
      statuses.push({
        id: entrance.id,
        label: entrance.label,
        state: entrance.state,
        locked: entrance.locked,
        type: entrance.type,
        hasCamera: entrance.hasCamera,
        hasIntercom: entrance.hasIntercom,
        lastStateChange: entrance.lastStateChange,
        operationCount: entrance.operationCount,
      });
    }
    return statuses;
  }

  _scheduleAutoLock(entranceId) {
    const timerKey = `autolock_${entranceId}`;
    const timeoutMs = this.settings.autoLockAfterMinutes * 60 * 1000;
    const existingTimer = this.approachLighting.activeTimers.get(timerKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      const entrance = this.entrances.get(entranceId);
      if (entrance && entrance.state === 'open') {
        this.closeGate(entranceId);
        this.lockGate(entranceId);
        this.log(`Auto-locked ${entrance.label} after ${this.settings.autoLockAfterMinutes} minutes`);
      }
      this.approachLighting.activeTimers.delete(timerKey);
    }, timeoutMs);

    this.approachLighting.activeTimers.set(timerKey, timer);
  }

  // ---------------------------------------------------------------------------
  // Detection zones (6 zones) & intrusion detection
  // ---------------------------------------------------------------------------

  _buildDetectionZones() {
    const map = new Map();

    const zoneConfigs = [
      { id: 'zone_front', label: 'Front Perimeter', entrance: 'front_gate', sensors: ['motion', 'beam_break'], active: true },
      { id: 'zone_left', label: 'Left Side', entrance: 'side_gate', sensors: ['motion', 'vibration'], active: true },
      { id: 'zone_right', label: 'Right Side', entrance: null, sensors: ['motion', 'vibration'], active: true },
      { id: 'zone_back', label: 'Back Perimeter', entrance: 'back_fence', sensors: ['motion', 'beam_break'], active: true },
      { id: 'zone_driveway', label: 'Driveway', entrance: 'garage', sensors: ['motion', 'beam_break'], active: true },
      { id: 'zone_garden', label: 'Garden Area', entrance: null, sensors: ['motion'], active: true },
    ];

    for (const cfg of zoneConfigs) {
      map.set(cfg.id, {
        id: cfg.id,
        label: cfg.label,
        entrance: cfg.entrance,
        sensors: cfg.sensors,
        active: cfg.active,
        lastTriggered: null,
        triggerCount: 0,
        lastEventType: null,
        recentEvents: [],
      });
    }

    return map;
  }

  triggerDetection(zoneId, eventType, details) {
    const zone = this.detectionZones.get(zoneId);
    if (!zone) {
      this.error(`Unknown detection zone: ${zoneId}`);
      return null;
    }

    if (!zone.active) {
      this.log(`Detection zone ${zone.label} is inactive — ignoring trigger`);
      return null;
    }

    const eventDetails = details || {};

    // Wildlife discrimination
    if (this.settings.wildlifeDiscrimination) {
      const classification = this._classifyDetection(eventDetails);
      if (classification.isWildlife) {
        this.log(`Wildlife detected in ${zone.label}: ${classification.type} — ignoring`);
        this._addAuditEntry('wildlife_detection', zoneId, `Wildlife: ${classification.type}`);
        return { zone: zoneId, ignored: true, reason: 'wildlife', classification };
      }
    }

    zone.lastTriggered = new Date();
    zone.triggerCount++;
    zone.lastEventType = eventType;

    const event = {
      zone: zoneId,
      zoneLabel: zone.label,
      eventType,
      timestamp: new Date(),
      details: eventDetails,
      ignored: false,
    };

    zone.recentEvents.push(event);
    if (zone.recentEvents.length > 50) {
      zone.recentEvents = zone.recentEvents.slice(-50);
    }

    this._addAuditEntry('intrusion_detection', zoneId, `${eventType} detected in ${zone.label}`);
    this.log(`Intrusion detection: ${eventType} in ${zone.label}`);

    // Trigger approach lighting for the associated entrance
    if (this.approachLighting.enabled && zone.entrance) {
      this._activateApproachLighting(zone.entrance);
    }

    // Escalate
    this._escalate(event);

    return event;
  }

  _classifyDetection(details) {
    const size = details.size || 'medium';
    const speed = details.speed || 'normal';
    const pattern = details.pattern || 'unknown';
    const height = details.height || 'medium';

    const isWildlife = (
      size === 'small' ||
      (size === 'medium' && pattern === 'erratic' && height === 'low') ||
      (size === 'medium' && speed === 'fast' && pattern === 'ground_level')
    );

    let type = 'unknown';
    let confidence = 0.5;

    if (isWildlife) {
      if (size === 'small') {
        type = 'small_animal';
        confidence = 0.85;
      } else if (pattern === 'erratic') {
        type = 'bird';
        confidence = 0.70;
      } else {
        type = 'medium_animal';
        confidence = 0.65;
      }
    } else {
      if (size === 'large') {
        type = 'vehicle';
        confidence = 0.90;
      } else {
        type = 'human';
        confidence = 0.80;
      }
    }

    return { isWildlife, type, confidence };
  }

  getDetectionZoneStatus(zoneId) {
    return this.detectionZones.get(zoneId) || null;
  }

  getAllDetectionZones() {
    const zones = [];
    for (const zone of this.detectionZones.values()) {
      zones.push({
        id: zone.id,
        label: zone.label,
        active: zone.active,
        sensors: zone.sensors,
        entrance: zone.entrance,
        lastTriggered: zone.lastTriggered,
        triggerCount: zone.triggerCount,
        recentEventCount: zone.recentEvents.length,
      });
    }
    return zones;
  }

  setZoneActive(zoneId, active) {
    const zone = this.detectionZones.get(zoneId);
    if (!zone) {
      this.error(`Unknown detection zone: ${zoneId}`);
      return false;
    }
    zone.active = active;
    this._addAuditEntry('zone_toggle', zoneId, `${zone.label} ${active ? 'activated' : 'deactivated'}`);
    this.log(`Detection zone ${zone.label} ${active ? 'activated' : 'deactivated'}`);
    return true;
  }

  getZoneEventHistory(zoneId, count) {
    const zone = this.detectionZones.get(zoneId);
    if (!zone) {
      this.error(`Unknown detection zone: ${zoneId}`);
      return [];
    }
    const n = count || 20;
    return zone.recentEvents.slice(-n).reverse();
  }

  // ---------------------------------------------------------------------------
  // Vehicle classification (family / delivery / unknown)
  // ---------------------------------------------------------------------------

  registerKnownVehicle(plateNumber, details) {
    const cleanPlate = plateNumber.toUpperCase().replace(/\s/g, '');

    const vehicle = {
      plateNumber: cleanPlate,
      type: details.type || 'car',
      owner: details.owner || 'Unknown',
      classification: details.classification || 'family',
      registeredAt: new Date(),
      lastSeen: null,
      sightCount: 0,
      accessGranted: details.accessGranted !== false,
      notes: details.notes || '',
    };

    this.knownVehicles.set(cleanPlate, vehicle);
    this._addAuditEntry('vehicle_register', cleanPlate, `Registered: ${vehicle.owner} (${vehicle.classification})`);
    this.log(`Registered vehicle: ${cleanPlate} (${vehicle.classification})`);
    return vehicle;
  }

  removeKnownVehicle(plateNumber) {
    const cleanPlate = plateNumber.toUpperCase().replace(/\s/g, '');
    const removed = this.knownVehicles.delete(cleanPlate);
    if (removed) {
      this._addAuditEntry('vehicle_remove', cleanPlate, `Vehicle removed: ${cleanPlate}`);
      this.log(`Removed vehicle: ${cleanPlate}`);
    } else {
      this.error(`Vehicle not found: ${cleanPlate}`);
    }
    return removed;
  }

  classifyVehicle(plateNumber) {
    const cleanPlate = plateNumber.toUpperCase().replace(/\s/g, '');
    const known = this.knownVehicles.get(cleanPlate);

    if (known) {
      known.lastSeen = new Date();
      known.sightCount++;
      this._logPlate(cleanPlate, known.classification, known.owner);

      if (known.accessGranted && known.classification === 'family') {
        this.log(`Family vehicle recognised: ${cleanPlate} (${known.owner}) — auto-opening gate`);
      }

      return {
        plateNumber: cleanPlate,
        classification: known.classification,
        owner: known.owner,
        accessGranted: known.accessGranted,
        isKnown: true,
        sightCount: known.sightCount,
      };
    }

    // Unknown vehicle — try to classify by pattern
    const deliveryPatterns = [/^[A-Z]{2,3}\d{3,4}$/, /^DHL/, /^POST/];
    let guessedClassification = 'unknown';
    for (const pattern of deliveryPatterns) {
      if (pattern.test(cleanPlate)) {
        guessedClassification = 'delivery';
        break;
      }
    }

    this._logPlate(cleanPlate, guessedClassification, null);
    this._addAuditEntry('unknown_vehicle', cleanPlate, `Unknown vehicle detected: ${cleanPlate} (guessed: ${guessedClassification})`);
    this.log(`Unknown vehicle detected: ${cleanPlate}`);

    return {
      plateNumber: cleanPlate,
      classification: guessedClassification,
      owner: null,
      accessGranted: false,
      isKnown: false,
      sightCount: 0,
    };
  }

  getKnownVehicles() {
    const vehicles = [];
    for (const v of this.knownVehicles.values()) {
      vehicles.push({
        plateNumber: v.plateNumber,
        type: v.type,
        owner: v.owner,
        classification: v.classification,
        lastSeen: v.lastSeen,
        sightCount: v.sightCount,
        accessGranted: v.accessGranted,
      });
    }
    return vehicles;
  }

  _logPlate(plate, classification, owner) {
    this.plateLog.push({
      plateNumber: plate,
      classification,
      owner,
      timestamp: new Date(),
    });

    if (this.plateLog.length > this.settings.maxPlateLogSize) {
      this.plateLog = this.plateLog.slice(-this.settings.maxPlateLogSize);
    }
  }

  getPlateLog(count) {
    const n = count || 50;
    return this.plateLog.slice(-n).reverse();
  }

  // ---------------------------------------------------------------------------
  // Temporary delivery access codes with time limits
  // ---------------------------------------------------------------------------

  generateAccessCode(details) {
    const id = `code_${this._codeIdCounter++}`;
    const now = Date.now();
    const timeLimitMinutes = details.timeLimitMinutes || 30;

    const code = {
      id,
      code: this._randomCode(6),
      purpose: details.purpose || 'delivery',
      grantedTo: details.grantedTo || 'Unknown',
      entrance: details.entrance || 'front_gate',
      createdAt: new Date(),
      expiresAt: new Date(now + timeLimitMinutes * 60 * 1000),
      timeLimitMinutes,
      used: false,
      usedAt: null,
      revoked: false,
      maxUses: details.maxUses || 1,
      useCount: 0,
    };

    this.accessCodes.set(id, code);
    this._addAuditEntry('access_code_created', id, `Code for ${code.grantedTo}: ${code.code} (expires in ${timeLimitMinutes}min)`);
    this.log(`Access code generated for ${code.grantedTo}: ${code.code} (valid ${timeLimitMinutes}min)`);
    return code;
  }

  validateAccessCode(inputCode) {
    for (const [id, code] of this.accessCodes.entries()) {
      if (code.code !== inputCode) continue;

      if (code.revoked) {
        this._addAuditEntry('access_code_rejected', id, 'Code has been revoked');
        return { valid: false, reason: 'revoked', codeId: id };
      }

      if (code.useCount >= code.maxUses) {
        this._addAuditEntry('access_code_rejected', id, 'Code max uses exceeded');
        return { valid: false, reason: 'max_uses_exceeded', codeId: id };
      }

      if (new Date() > code.expiresAt) {
        this._addAuditEntry('access_code_rejected', id, 'Code has expired');
        return { valid: false, reason: 'expired', codeId: id };
      }

      // Valid — mark as used and open gate
      code.useCount++;
      if (code.useCount >= code.maxUses) {
        code.used = true;
      }
      code.usedAt = new Date();

      this._addAuditEntry('access_code_used', id, `Code used by ${code.grantedTo} (use ${code.useCount}/${code.maxUses})`);
      this.log(`Access code used: ${code.code} by ${code.grantedTo}`);

      // Open the assigned entrance
      this.openGate(code.entrance);

      return {
        valid: true,
        entrance: code.entrance,
        grantedTo: code.grantedTo,
        purpose: code.purpose,
        usesRemaining: code.maxUses - code.useCount,
      };
    }

    this._addAuditEntry('access_code_rejected', inputCode, 'Invalid code');
    this.log(`Invalid access code attempt: ${inputCode}`);
    return { valid: false, reason: 'invalid' };
  }

  revokeAccessCode(codeId) {
    const code = this.accessCodes.get(codeId);
    if (!code) {
      this.error(`Access code not found: ${codeId}`);
      return false;
    }
    code.revoked = true;
    this._addAuditEntry('access_code_revoked', codeId, `Code revoked: ${code.code}`);
    this.log(`Access code revoked: ${code.code}`);
    return true;
  }

  _randomCode(length) {
    const chars = '0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  getActiveAccessCodes() {
    const now = new Date();
    const active = [];
    for (const code of this.accessCodes.values()) {
      if (!code.revoked && code.useCount < code.maxUses && code.expiresAt > now) {
        active.push({
          id: code.id,
          code: code.code,
          grantedTo: code.grantedTo,
          entrance: code.entrance,
          expiresAt: code.expiresAt,
          purpose: code.purpose,
          usesRemaining: code.maxUses - code.useCount,
        });
      }
    }
    return active;
  }

  // ---------------------------------------------------------------------------
  // Visitor pre-authorisation
  // ---------------------------------------------------------------------------

  preAuthorizeVisitor(details) {
    const auth = {
      id: `preauth_${Date.now()}`,
      name: details.name || 'Unknown Visitor',
      expectedArrival: details.expectedArrival ? new Date(details.expectedArrival) : null,
      expectedDeparture: details.expectedDeparture ? new Date(details.expectedDeparture) : null,
      vehiclePlate: details.vehiclePlate || null,
      entrance: details.entrance || 'front_gate',
      accessCode: null,
      createdAt: new Date(),
      arrived: false,
      arrivedAt: null,
      departed: false,
      departedAt: null,
      notes: details.notes || '',
    };

    // Auto-generate access code if arrival time set
    if (auth.expectedArrival) {
      const timeUntilArrival = auth.expectedArrival.getTime() - Date.now();
      const minutesValid = Math.max(30, Math.ceil(timeUntilArrival / (60 * 1000)) + 60);
      const generatedCode = this.generateAccessCode({
        purpose: 'visitor',
        grantedTo: auth.name,
        entrance: auth.entrance,
        timeLimitMinutes: minutesValid,
      });
      auth.accessCode = generatedCode.code;
    }

    // Auto-register vehicle plate if provided
    if (auth.vehiclePlate) {
      this.registerKnownVehicle(auth.vehiclePlate, {
        type: 'visitor',
        owner: auth.name,
        classification: 'visitor',
        accessGranted: true,
        notes: `Pre-auth visitor: ${auth.name}`,
      });
    }

    this.preAuthorizations.push(auth);
    this._addAuditEntry('visitor_preauth', auth.id, `Pre-authorized: ${auth.name}`);
    this.log(`Visitor pre-authorized: ${auth.name}`);
    return auth;
  }

  markVisitorArrived(preauthId) {
    const auth = this.preAuthorizations.find((a) => a.id === preauthId);
    if (!auth) {
      this.error(`Pre-authorization not found: ${preauthId}`);
      return null;
    }

    auth.arrived = true;
    auth.arrivedAt = new Date();
    this._addAuditEntry('visitor_arrived', preauthId, `${auth.name} arrived`);
    this.log(`Visitor arrived: ${auth.name}`);
    return auth;
  }

  markVisitorDeparted(preauthId) {
    const auth = this.preAuthorizations.find((a) => a.id === preauthId);
    if (!auth) {
      this.error(`Pre-authorization not found: ${preauthId}`);
      return null;
    }

    auth.departed = true;
    auth.departedAt = new Date();

    // Remove temporary vehicle registration
    if (auth.vehiclePlate) {
      this.removeKnownVehicle(auth.vehiclePlate);
    }

    this._addAuditEntry('visitor_departed', preauthId, `${auth.name} departed`);
    this.log(`Visitor departed: ${auth.name}`);
    return auth;
  }

  getPendingVisitors() {
    return this.preAuthorizations
      .filter((a) => !a.arrived)
      .map((a) => ({
        id: a.id,
        name: a.name,
        expectedArrival: a.expectedArrival,
        entrance: a.entrance,
        vehiclePlate: a.vehiclePlate,
        accessCode: a.accessCode,
        notes: a.notes,
      }));
  }

  getCurrentVisitors() {
    return this.preAuthorizations
      .filter((a) => a.arrived && !a.departed)
      .map((a) => ({
        id: a.id,
        name: a.name,
        arrivedAt: a.arrivedAt,
        expectedDeparture: a.expectedDeparture,
        entrance: a.entrance,
      }));
  }

  // ---------------------------------------------------------------------------
  // 6-step security escalation chain
  // ---------------------------------------------------------------------------

  _buildEscalationChain() {
    return [
      { level: 0, name: 'Normal', description: 'No active threats', actions: [] },
      { level: 1, name: 'Awareness', description: 'Unusual activity detected', actions: ['log_event', 'activate_cameras'] },
      { level: 2, name: 'Caution', description: 'Repeated or suspicious activity', actions: ['log_event', 'activate_cameras', 'enable_lights', 'send_notification'] },
      { level: 3, name: 'Alert', description: 'Confirmed intrusion attempt', actions: ['log_event', 'activate_cameras', 'enable_lights', 'send_notification', 'sound_warning', 'lock_all_gates'] },
      { level: 4, name: 'High Alert', description: 'Active breach detected', actions: ['log_event', 'activate_cameras', 'enable_lights', 'send_notification', 'sound_alarm', 'lock_all_gates', 'record_video'] },
      { level: 5, name: 'Emergency', description: 'Critical security breach', actions: ['log_event', 'activate_cameras', 'enable_lights', 'send_notification', 'sound_alarm', 'lock_all_gates', 'record_video', 'contact_authorities'] },
    ];
  }

  _escalate(event) {
    const zone = this.detectionZones.get(event.zone);
    if (!zone) return;

    // Count recent triggers (last 15 minutes)
    const cutoff = Date.now() - 15 * 60 * 1000;
    const recentCount = zone.recentEvents.filter(
      (e) => e.timestamp.getTime() > cutoff
    ).length;

    let targetLevel = 1;

    if (event.eventType === 'beam_break') {
      targetLevel = Math.min(targetLevel + 1, 5);
    }
    if (event.eventType === 'vibration') {
      targetLevel = Math.min(targetLevel + 1, 5);
    }
    if (recentCount > 3) {
      targetLevel = Math.min(targetLevel + 1, 5);
    }
    if (recentCount > 8) {
      targetLevel = Math.min(targetLevel + 2, 5);
    }

    // Sensitivity adjustment
    if (this.settings.intrusionSensitivity === 'high') {
      targetLevel = Math.min(targetLevel + 1, 5);
    } else if (this.settings.intrusionSensitivity === 'low') {
      targetLevel = Math.max(targetLevel - 1, 0);
    }

    if (targetLevel > this.currentEscalationLevel) {
      this.setEscalationLevel(targetLevel, `Auto-escalated from ${event.eventType} in ${zone.label}`);
    }
  }

  setEscalationLevel(level, reason) {
    const validLevel = Math.max(0, Math.min(5, level));
    const previous = this.currentEscalationLevel;
    this.currentEscalationLevel = validLevel;

    const step = this.escalationChain[validLevel];
    this._addAuditEntry('escalation_change', `level_${validLevel}`, `${step.name}: ${reason || 'Manual change'}`);
    this.log(`Security escalation: Level ${previous} -> ${validLevel} (${step.name}): ${reason || 'Manual'}`);

    // Execute escalation actions
    this._executeEscalationActions(step);

    return {
      previousLevel: previous,
      currentLevel: validLevel,
      name: step.name,
      description: step.description,
      actions: step.actions,
    };
  }

  _executeEscalationActions(step) {
    for (const action of step.actions) {
      switch (action) {
        case 'lock_all_gates':
          this.lockAllGates();
          break;
        case 'enable_lights':
          this._activateAllPerimeterLighting();
          break;
        case 'log_event':
          this.log(`Escalation action executed: ${action}`);
          break;
        case 'send_notification':
          this.log(`Notification sent: Security level ${step.level} — ${step.name}`);
          break;
        case 'sound_warning':
          this.log('Warning tone activated on perimeter speakers');
          break;
        case 'sound_alarm':
          this.log('Full alarm siren activated');
          break;
        case 'activate_cameras':
          this.log('All perimeter cameras activated and recording');
          break;
        case 'record_video':
          this.log('Extended video recording started on all cameras');
          break;
        case 'contact_authorities':
          this.log('Emergency services contacted automatically');
          break;
        default:
          this.log(`Unknown escalation action: ${action}`);
          break;
      }
    }
  }

  getEscalationStatus() {
    const step = this.escalationChain[this.currentEscalationLevel];
    return {
      currentLevel: this.currentEscalationLevel,
      name: step.name,
      description: step.description,
      actions: step.actions,
    };
  }

  // ---------------------------------------------------------------------------
  // Fence health monitoring
  // ---------------------------------------------------------------------------

  _buildFenceSections() {
    return [
      { id: 'fence_front', label: 'Front Fence', lengthM: 20, material: 'wood', condition: 'good', lastCheck: null, issues: [] },
      { id: 'fence_left', label: 'Left Side Fence', lengthM: 30, material: 'wood', condition: 'good', lastCheck: null, issues: [] },
      { id: 'fence_right', label: 'Right Side Fence', lengthM: 30, material: 'metal', condition: 'good', lastCheck: null, issues: [] },
      { id: 'fence_back', label: 'Back Fence', lengthM: 25, material: 'wood', condition: 'good', lastCheck: null, issues: [] },
    ];
  }

  reportFenceIssue(sectionId, issue) {
    const section = this.fenceHealth.sections.find((s) => s.id === sectionId);
    if (!section) {
      this.error(`Fence section not found: ${sectionId}`);
      return null;
    }

    const report = {
      id: `fence_issue_${Date.now()}`,
      timestamp: new Date(),
      type: issue.type || 'damage',
      description: issue.description || 'Unspecified issue',
      severity: issue.severity || 'low',
      positionM: issue.positionM || null,
      resolved: false,
      resolvedAt: null,
    };

    section.issues.push(report);
    section.condition = this._calculateFenceCondition(section);
    section.lastCheck = new Date();

    this._updateOverallFenceCondition();
    this._addAuditEntry('fence_issue', sectionId, `${section.label}: ${report.description} (${report.severity})`);
    this.log(`Fence issue reported: ${section.label} — ${report.description}`);
    return report;
  }

  _calculateFenceCondition(section) {
    const unresolved = section.issues.filter((i) => !i.resolved);
    if (unresolved.some((i) => i.severity === 'critical')) return 'critical';
    if (unresolved.some((i) => i.severity === 'high')) return 'poor';
    if (unresolved.length > 2) return 'fair';
    if (unresolved.length > 0) return 'fair';
    return 'good';
  }

  _updateOverallFenceCondition() {
    const conditions = this.fenceHealth.sections.map((s) => s.condition);
    if (conditions.includes('critical')) {
      this.fenceHealth.overallCondition = 'critical';
    } else if (conditions.includes('poor')) {
      this.fenceHealth.overallCondition = 'poor';
    } else if (conditions.includes('fair')) {
      this.fenceHealth.overallCondition = 'fair';
    } else {
      this.fenceHealth.overallCondition = 'good';
    }
  }

  resolveFenceIssue(sectionId, issueId) {
    const section = this.fenceHealth.sections.find((s) => s.id === sectionId);
    if (!section) {
      this.error(`Fence section not found: ${sectionId}`);
      return false;
    }

    const issue = section.issues.find((i) => i.id === issueId);
    if (!issue) {
      this.error(`Fence issue not found: ${issueId}`);
      return false;
    }

    issue.resolved = true;
    issue.resolvedAt = new Date();
    section.condition = this._calculateFenceCondition(section);
    this._updateOverallFenceCondition();
    this._addAuditEntry('fence_issue_resolved', sectionId, `Issue resolved: ${issue.description}`);
    this.log(`Fence issue resolved: ${section.label} — ${issue.description}`);
    return true;
  }

  recordFenceInspection() {
    this.fenceHealth.lastInspection = new Date();
    for (const section of this.fenceHealth.sections) {
      section.lastCheck = new Date();
    }
    this._addAuditEntry('fence_inspection', 'all', 'Full fence inspection completed');
    this.log('Fence inspection recorded for all sections');
  }

  getFenceHealthReport() {
    return {
      overallCondition: this.fenceHealth.overallCondition,
      lastInspection: this.fenceHealth.lastInspection,
      sections: this.fenceHealth.sections.map((s) => ({
        id: s.id,
        label: s.label,
        lengthM: s.lengthM,
        material: s.material,
        condition: s.condition,
        unresolvedIssues: s.issues.filter((i) => !i.resolved).length,
        totalIssues: s.issues.length,
        lastCheck: s.lastCheck,
      })),
      totalUnresolvedIssues: this.fenceHealth.sections.reduce(
        (sum, s) => sum + s.issues.filter((i) => !i.resolved).length, 0
      ),
    };
  }

  // ---------------------------------------------------------------------------
  // Snow / ice detection for driveway
  // ---------------------------------------------------------------------------

  updateDrivewayConditions(conditions) {
    if (conditions.surfaceTemp !== undefined) {
      this.drivewayConditions.surfaceTemp = conditions.surfaceTemp;
    }
    if (conditions.snowDetected !== undefined) {
      this.drivewayConditions.snowDetected = conditions.snowDetected;
    }
    if (conditions.iceDetected !== undefined) {
      this.drivewayConditions.iceDetected = conditions.iceDetected;
    }
    if (conditions.snowDepthCm !== undefined) {
      this.drivewayConditions.snowDepthCm = conditions.snowDepthCm;
    }

    // Auto-activate heating if ice or snow and temp below 2 degrees C
    if (
      (this.drivewayConditions.iceDetected || this.drivewayConditions.snowDetected) &&
      this.drivewayConditions.surfaceTemp !== null &&
      this.drivewayConditions.surfaceTemp < 2
    ) {
      if (!this.drivewayConditions.heatingActive) {
        this.drivewayConditions.heatingActive = true;
        this.log('Driveway heating activated (ice/snow detected, temp < 2 degrees C)');
        this._addAuditEntry('driveway_heating', 'on', 'Heating auto-activated');
      }
    } else if (
      !this.drivewayConditions.iceDetected &&
      !this.drivewayConditions.snowDetected
    ) {
      if (this.drivewayConditions.heatingActive) {
        this.drivewayConditions.heatingActive = false;
        this.log('Driveway heating deactivated (no ice/snow)');
        this._addAuditEntry('driveway_heating', 'off', 'Heating auto-deactivated');
      }
    }

    if (this.settings.snowAlertEnabled && this.drivewayConditions.snowDetected) {
      this._addAuditEntry('snow_alert', 'driveway', `Snow detected (depth: ${this.drivewayConditions.snowDepthCm}cm)`);
      this.log(`Snow detected on driveway (depth: ${this.drivewayConditions.snowDepthCm}cm)`);
    }

    if (this.drivewayConditions.iceDetected) {
      this._addAuditEntry('ice_alert', 'driveway', 'Ice detected on driveway');
      this.log('Ice detected on driveway — caution');
    }

    return this.drivewayConditions;
  }

  markDrivewaySalted() {
    this.drivewayConditions.lastSalted = new Date();
    this._addAuditEntry('driveway_salted', 'driveway', 'Driveway salted');
    this.log('Driveway marked as salted');
  }

  markDrivewayPlowed() {
    this.drivewayConditions.lastPlowed = new Date();
    this.drivewayConditions.snowDepthCm = 0;
    this.drivewayConditions.snowDetected = false;
    this._addAuditEntry('driveway_plowed', 'driveway', 'Driveway plowed');
    this.log('Driveway marked as plowed');
  }

  getDrivewayStatus() {
    return {
      surfaceTemp: this.drivewayConditions.surfaceTemp,
      snowDetected: this.drivewayConditions.snowDetected,
      snowDepthCm: this.drivewayConditions.snowDepthCm,
      iceDetected: this.drivewayConditions.iceDetected,
      heatingActive: this.drivewayConditions.heatingActive,
      lastSalted: this.drivewayConditions.lastSalted,
      lastPlowed: this.drivewayConditions.lastPlowed,
    };
  }

  // ---------------------------------------------------------------------------
  // Approach lighting triggers
  // ---------------------------------------------------------------------------

  _activateApproachLighting(entranceOrZoneId) {
    // Check silent hours
    const hour = new Date().getHours();
    const inSilentHours = (
      this.settings.silentHoursStart <= this.settings.silentHoursEnd
        ? hour >= this.settings.silentHoursStart && hour < this.settings.silentHoursEnd
        : hour >= this.settings.silentHoursStart || hour < this.settings.silentHoursEnd
    );

    // Map detection zone to entrance
    let entranceId = entranceOrZoneId;
    const zone = this.detectionZones.get(entranceOrZoneId);
    if (zone && zone.entrance) {
      entranceId = zone.entrance;
    }

    const lightConfig = this.approachLighting.zones[entranceId];
    if (!lightConfig) return;

    const brightness = inSilentHours ? Math.round(lightConfig.brightness * 0.3) : lightConfig.brightness;
    this.log(`Approach lighting activated for ${entranceId} (brightness: ${brightness}%)`);

    // Set auto-off timer
    const timerKey = `light_${entranceId}`;
    const existingTimer = this.approachLighting.activeTimers.get(timerKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.log(`Approach lighting deactivated for ${entranceId}`);
      this.approachLighting.activeTimers.delete(timerKey);
    }, lightConfig.duration * 1000);

    this.approachLighting.activeTimers.set(timerKey, timer);
  }

  _activateAllPerimeterLighting() {
    for (const zoneKey of Object.keys(this.approachLighting.zones)) {
      this._activateApproachLighting(zoneKey);
    }
    this.log('All perimeter lights activated');
  }

  setApproachLightingEnabled(enabled) {
    this.approachLighting.enabled = enabled;
    this.log(`Approach lighting ${enabled ? 'enabled' : 'disabled'}`);
    if (!enabled) {
      for (const timer of this.approachLighting.activeTimers.values()) {
        clearTimeout(timer);
      }
      this.approachLighting.activeTimers.clear();
    }
  }

  // ---------------------------------------------------------------------------
  // Patrol scheduling
  // ---------------------------------------------------------------------------

  addPatrolSchedule(details) {
    const patrol = {
      id: `patrol_${Date.now()}`,
      name: details.name || 'Scheduled Patrol',
      zones: details.zones || Array.from(this.detectionZones.keys()),
      intervalMinutes: details.intervalMinutes || 60,
      startHour: details.startHour || 22,
      endHour: details.endHour || 6,
      enabled: details.enabled !== false,
      lastRun: null,
      runCount: 0,
      issuesFound: 0,
    };

    this.patrolSchedule.push(patrol);
    this._addAuditEntry('patrol_created', patrol.id, `Patrol created: ${patrol.name}`);
    this.log(`Patrol schedule added: ${patrol.name} (every ${patrol.intervalMinutes}min)`);
    return patrol;
  }

  removePatrolSchedule(patrolId) {
    const idx = this.patrolSchedule.findIndex((p) => p.id === patrolId);
    if (idx === -1) {
      this.error(`Patrol not found: ${patrolId}`);
      return false;
    }
    const patrol = this.patrolSchedule[idx];
    this.patrolSchedule.splice(idx, 1);
    this._addAuditEntry('patrol_removed', patrolId, `Patrol removed: ${patrol.name}`);
    this.log(`Patrol schedule removed: ${patrol.name}`);
    return true;
  }

  runPatrol(patrolId) {
    const patrol = this.patrolSchedule.find((p) => p.id === patrolId);
    if (!patrol) {
      this.error(`Patrol not found: ${patrolId}`);
      return null;
    }

    const results = [];
    let issuesFound = 0;
    for (const zoneId of patrol.zones) {
      const zone = this.detectionZones.get(zoneId);
      if (zone) {
        const recentActivity = zone.lastTriggered
          ? (Date.now() - zone.lastTriggered.getTime()) < 30 * 60 * 1000
          : false;
        if (recentActivity) issuesFound++;
        results.push({
          zone: zoneId,
          label: zone.label,
          active: zone.active,
          lastTriggered: zone.lastTriggered,
          recentActivity,
          status: recentActivity ? 'activity_detected' : 'clear',
        });
      }
    }

    patrol.lastRun = new Date();
    patrol.runCount++;
    patrol.issuesFound += issuesFound;

    const allClear = issuesFound === 0;
    this._addAuditEntry('patrol_run', patrolId, `Patrol "${patrol.name}": ${results.length} zones checked, ${issuesFound} with activity`);
    this.log(`Patrol completed: ${patrol.name} — ${results.length} zones checked, ${allClear ? 'all clear' : `${issuesFound} zone(s) with activity`}`);

    return {
      patrol: patrol.name,
      patrolId: patrol.id,
      timestamp: patrol.lastRun,
      zonesChecked: results,
      allClear,
      issuesFound,
    };
  }

  getPatrolSchedules() {
    return this.patrolSchedule.map((p) => ({
      id: p.id,
      name: p.name,
      zones: p.zones,
      intervalMinutes: p.intervalMinutes,
      startHour: p.startHour,
      endHour: p.endHour,
      enabled: p.enabled,
      lastRun: p.lastRun,
      runCount: p.runCount,
      issuesFound: p.issuesFound,
    }));
  }

  // ---------------------------------------------------------------------------
  // Full audit trail
  // ---------------------------------------------------------------------------

  _addAuditEntry(type, target, description) {
    const entry = {
      timestamp: new Date(),
      type,
      target,
      description,
      escalationLevel: this.currentEscalationLevel,
    };

    this.auditTrail.push(entry);

    if (this.auditTrail.length > this.settings.maxAuditTrailSize) {
      this.auditTrail = this.auditTrail.slice(-this.settings.maxAuditTrailSize);
    }
  }

  getAuditTrail(count, filterType) {
    let entries = this.auditTrail;
    if (filterType) {
      entries = entries.filter((e) => e.type === filterType);
    }
    const n = count || 50;
    return entries.slice(-n).reverse();
  }

  getAuditSummary(hours) {
    const cutoff = Date.now() - (hours || 24) * 60 * 60 * 1000;
    const recent = this.auditTrail.filter((e) => e.timestamp.getTime() > cutoff);

    const byType = {};
    for (const entry of recent) {
      byType[entry.type] = (byType[entry.type] || 0) + 1;
    }

    return {
      periodHours: hours || 24,
      totalEvents: recent.length,
      byType,
      highestEscalation: recent.length > 0 ? Math.max(...recent.map((e) => e.escalationLevel)) : 0,
    };
  }

  // ---------------------------------------------------------------------------
  // Monitoring loop (5-minute interval)
  // ---------------------------------------------------------------------------

  _startMonitoringLoop() {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
    }

    this.monitoringTimer = setInterval(() => {
      this._runMonitoringCycle();
    }, this.settings.monitoringIntervalMs);

    this.log(`Monitoring loop started (interval: ${this.settings.monitoringIntervalMs / 1000}s)`);
  }

  _runMonitoringCycle() {
    this.log('Running perimeter monitoring cycle');

    // Check for expired access codes
    const now = new Date();
    let expiredCount = 0;
    for (const code of this.accessCodes.values()) {
      if (!code.revoked && code.useCount < code.maxUses && code.expiresAt <= now) {
        code.revoked = true;
        expiredCount++;
      }
    }
    if (expiredCount > 0) {
      this.log(`Expired ${expiredCount} access code(s)`);
    }

    // Check driveway conditions for ice risk
    if (this.drivewayConditions.surfaceTemp !== null && this.drivewayConditions.surfaceTemp < 0) {
      if (!this.drivewayConditions.iceDetected) {
        this.updateDrivewayConditions({ iceDetected: true });
      }
    }

    // Check fence health
    const fenceReport = this.getFenceHealthReport();
    if (fenceReport.overallCondition === 'critical') {
      this.log(`CRITICAL: Fence condition is critical — ${fenceReport.totalUnresolvedIssues} unresolved issues`);
    } else if (fenceReport.overallCondition === 'poor') {
      this.log(`Warning: Fence condition is poor — ${fenceReport.totalUnresolvedIssues} unresolved issues`);
    }

    // Check for overdue visitors
    for (const auth of this.preAuthorizations) {
      if (!auth.arrived && auth.expectedArrival) {
        const overdue = now.getTime() - auth.expectedArrival.getTime();
        if (overdue > 60 * 60 * 1000) {
          this.log(`Visitor overdue: ${auth.name} (expected ${auth.expectedArrival.toISOString()})`);
        }
      }
    }

    // Auto-run patrols if within scheduled hours
    if (this.settings.patrolEnabled) {
      const hour = now.getHours();
      for (const patrol of this.patrolSchedule) {
        if (!patrol.enabled) continue;
        const inWindow = patrol.startHour <= patrol.endHour
          ? hour >= patrol.startHour && hour < patrol.endHour
          : hour >= patrol.startHour || hour < patrol.endHour;
        if (inWindow) {
          const lastRunMs = patrol.lastRun ? now.getTime() - patrol.lastRun.getTime() : Infinity;
          if (lastRunMs >= patrol.intervalMinutes * 60 * 1000) {
            this.runPatrol(patrol.id);
          }
        }
      }
    }

    // Auto de-escalate if no recent triggers
    if (this.currentEscalationLevel > 0) {
      let recentActivity = false;
      for (const zone of this.detectionZones.values()) {
        if (zone.lastTriggered && (now.getTime() - zone.lastTriggered.getTime()) < 30 * 60 * 1000) {
          recentActivity = true;
          break;
        }
      }
      if (!recentActivity) {
        const newLevel = Math.max(0, this.currentEscalationLevel - 1);
        if (newLevel !== this.currentEscalationLevel) {
          this.setEscalationLevel(newLevel, 'Auto-deescalation — no recent activity');
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  async _loadSettings() {
    try {
      const saved = await this.homey.settings.get('perimeterSettings');
      if (saved) {
        const parsed = typeof saved === 'string' ? JSON.parse(saved) : saved;
        Object.assign(this.settings, parsed);
        this.log('Settings loaded');
      }
    } catch (err) {
      this.error(`Failed to load settings: ${err.message}`);
    }

    try {
      const savedAudit = await this.homey.settings.get('perimeterAuditTrail');
      if (savedAudit) {
        const parsed = typeof savedAudit === 'string' ? JSON.parse(savedAudit) : savedAudit;
        this.auditTrail = parsed.map((e) => {
          e.timestamp = new Date(e.timestamp);
          return e;
        });
        this.log(`Loaded ${this.auditTrail.length} audit trail entries`);
      }
    } catch (err) {
      this.error(`Failed to load audit trail: ${err.message}`);
    }

    try {
      const savedVehicles = await this.homey.settings.get('perimeterKnownVehicles');
      if (savedVehicles) {
        const parsed = typeof savedVehicles === 'string' ? JSON.parse(savedVehicles) : savedVehicles;
        for (const v of parsed) {
          v.registeredAt = new Date(v.registeredAt);
          if (v.lastSeen) v.lastSeen = new Date(v.lastSeen);
          this.knownVehicles.set(v.plateNumber, v);
        }
        this.log(`Loaded ${this.knownVehicles.size} known vehicles`);
      }
    } catch (err) {
      this.error(`Failed to load known vehicles: ${err.message}`);
    }
  }

  async _saveSettings() {
    try {
      await this.homey.settings.set('perimeterSettings', JSON.stringify(this.settings));
      await this.homey.settings.set('perimeterAuditTrail', JSON.stringify(this.auditTrail.slice(-500)));
      const vehicles = Array.from(this.knownVehicles.values());
      await this.homey.settings.set('perimeterKnownVehicles', JSON.stringify(vehicles));
      this.log('Settings, audit trail and vehicles saved');
    } catch (err) {
      this.error(`Failed to save settings: ${err.message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Statistics
  // ---------------------------------------------------------------------------

  getStatistics() {
    const allEntrances = this.getAllEntranceStatuses();
    const allZones = this.getAllDetectionZones();
    const fenceReport = this.getFenceHealthReport();
    const auditSummary = this.getAuditSummary(24);
    const escalation = this.getEscalationStatus();
    const activeCodes = this.getActiveAccessCodes();
    const pendingVisitors = this.getPendingVisitors();
    const currentVisitors = this.getCurrentVisitors();
    const driveway = this.getDrivewayStatus();

    return {
      system: 'SmartPerimeterManagementSystem',
      initialized: this.initialized,
      entrances: {
        total: allEntrances.length,
        open: allEntrances.filter((e) => e.state === 'open').length,
        locked: allEntrances.filter((e) => e.locked).length,
      },
      detectionZones: {
        total: allZones.length,
        active: allZones.filter((z) => z.active).length,
        totalTriggers: allZones.reduce((s, z) => s + z.triggerCount, 0),
      },
      escalation: {
        currentLevel: escalation.currentLevel,
        name: escalation.name,
      },
      knownVehicles: this.knownVehicles.size,
      plateLogEntries: this.plateLog.length,
      activeAccessCodes: activeCodes.length,
      pendingVisitors: pendingVisitors.length,
      currentVisitors: currentVisitors.length,
      fenceCondition: fenceReport.overallCondition,
      fenceUnresolvedIssues: fenceReport.totalUnresolvedIssues,
      driveway: {
        snowDetected: driveway.snowDetected,
        snowDepthCm: driveway.snowDepthCm,
        iceDetected: driveway.iceDetected,
        heatingActive: driveway.heatingActive,
      },
      patrolSchedules: this.patrolSchedule.length,
      auditTrailSize: this.auditTrail.length,
      last24hEvents: auditSummary.totalEvents,
    };
  }

  // ---------------------------------------------------------------------------
  // Logging
  // ---------------------------------------------------------------------------

  log(msg) {
    const ts = new Date().toISOString();
    if (this.homey && typeof this.homey.log === 'function') {
      this.homey.log(`[Perimeter] ${msg}`);
    } else {
      console.log(`[${ts}] [Perimeter] ${msg}`);
    }
  }

  error(msg) {
    const ts = new Date().toISOString();
    if (this.homey && typeof this.homey.error === 'function') {
      this.homey.error(`[Perimeter] ${msg}`);
    } else {
      console.error(`[${ts}] [Perimeter] ${msg}`);
    }
  }
}

module.exports = SmartPerimeterManagementSystem;
