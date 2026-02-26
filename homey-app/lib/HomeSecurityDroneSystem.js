'use strict';
const EventEmitter = require('events');
class HomeSecurityDroneSystem extends EventEmitter {
  constructor(homey) {
    super();
    this.homey = homey;
    this.initialized = false;
    this.intervals = [];
    this.drones = new Map();
    this.patrolRoutes = new Map();
    this.landingPads = new Map();
    this.noFlyZones = [];
    this.fixedCameras = [];
    this.eventLog = [];
    this.liveFeeds = new Map();
    this.privacySettings = {};
    this.weatherState = { windSpeedMs: 0, temperature: 10, raining: false, snowing: false, visibility: 'clear', lastUpdated: null };
    this.commState = { primaryLink: 'wifi', backupLink: '4g', latencyMs: 12, signalStrength: 95, encryptionEnabled: true };
    this.analytics = { totalFlightHours: 0, totalAreaCoveredKm2: 0, anomaliesDetectedMonth: 0, avgResponseTimeSec: 0, falsePositiveRate: 0.05, monthStartDate: null };
    this.manualControl = { active: false, droneId: null, mode: null, operator: null };
    this.schedulingConfig = { dayIntervalHours: 2, nightIntervalHours: 1, nightStartHour: 22, nightEndHour: 6, randomPatrolEnabled: true, randomMinIntervalMin: 30, randomMaxIntervalMin: 120, lastRandomPatrol: null };
    this.maintenanceRecords = new Map();
    this.footageStorage = { retentionDays: 30, totalStoredClips: 0, storageUsedGB: 0, maxStorageGB: 500, accessLog: [] };
  }

  async initialize() {
    try {
      if (this.initialized) { this.homey.log('[SecurityDrone] Already initialized'); return; }
      this.homey.log('[SecurityDrone] Initializing Home Security Drone Patrol System...');
      this._initializeDroneFleet();
      this._initializePatrolRoutes();
      this._initializeLandingPads();
      this._initializeNoFlyZones();
      this._initializeFixedCameras();
      this._initializePrivacySettings();
      this._initializeMaintenanceRecords();
      this.analytics.monthStartDate = new Date().toISOString();
      const timers = [
        [() => this._runScheduledPatrols(), 60000],
        [() => this._updateWeatherConditions(), 120000],
        [() => this._manageBatteryCharging(), 30000],
        [() => this._checkCommunicationHealth(), 45000],
        [() => this._runAnomalyDetection(), 20000],
        [() => this._checkMaintenanceSchedule(), 3600000],
        [() => this._aggregateAnalytics(), 300000],
        [() => this._scheduleRandomPatrol(), 60000],
        [() => this._cleanupOldFootage(), 3600000],
        [() => this._auditPrivacyCompliance(), 1800000]
      ];
      for (const [fn, ms] of timers) this.intervals.push(setInterval(fn, ms));
      this.initialized = true;
      this._logEvent('system', 'info', 'Home Security Drone System initialized');
      this.homey.log('[SecurityDrone] Initialization complete with ' + this.drones.size + ' drones, ' + this.patrolRoutes.size + ' routes');
      this.homey.emit('security-drone-initialized', { droneCount: this.drones.size, routeCount: this.patrolRoutes.size });
    } catch (error) {
      this.homey.error(`[HomeSecurityDroneSystem] Failed to initialize:`, error.message);
    }
  }

  _makeDrone(id, name, type, model, bat, batWh, maxFlight, pos, maxSpd, camRes, nv, thermal, mic, spk, wt, maxWind, fw, maintDays, hours, cycles, health, motorH, propDays, calDays, padId) {
    return {
      id, name, type, model, status: 'docked', batteryLevel: bat, batteryCapacityWh: batWh,
      flightTimeRemainingMin: maxFlight, maxFlightTimeMin: maxFlight,
      currentPosition: { lat: pos.lat, lng: pos.lng, altitude: 0 }, homeBase: { lat: pos.lat, lng: pos.lng },
      speed: 0, maxSpeed: maxSpd, cameraResolution: camRes, nightVision: nv, thermalImaging: thermal,
      microphone: mic, speaker: spk, weightG: wt, maxWindSpeedMs: maxWind, firmware: fw,
      lastMaintenance: new Date(Date.now() - maintDays * 86400000).toISOString(),
      totalFlightHours: hours, currentRoute: null, currentWaypointIndex: -1,
      chargeCycles: cycles, batteryHealthPct: health, motorHours: motorH,
      propellerInspectionDue: new Date(Date.now() + propDays * 86400000).toISOString(),
      cameraCalibrated: true, lastCalibration: new Date(Date.now() - calDays * 86400000).toISOString(),
      assignedPadId: padId, objectsDetected: [], recording: false
    };
  }

  _initializeDroneFleet() {
    const fleet = [
      this._makeDrone('patrol-alpha', 'Patrol Alpha', 'outdoor', 'QuadRotor-X4 Pro', 100, 77.4, 38, { lat: 59.3293, lng: 18.0686 }, 15, '4K', true, true, true, true, 1450, 15, '3.8.2', 7, 342.5, 287, 92, 410, 14, 3, 'pad-roof'),
      this._makeDrone('patrol-beta', 'Patrol Beta', 'outdoor', 'FixedWing-LR200', 85, 120, 65, { lat: 59.3295, lng: 18.0690 }, 22, '1080p', true, false, false, true, 2200, 18, '2.5.1', 14, 198.3, 156, 96, 230, 7, 10, 'pad-shed'),
      this._makeDrone('indoor-scout', 'Indoor Scout', 'indoor', 'MiniQuad-S1', 100, 22, 15, { lat: 59.3293, lng: 18.0686 }, 5, '1080p', true, false, true, true, 280, 0, '1.4.0', 5, 87.1, 420, 84, 105, 3, 1, 'pad-hallway')
    ];
    for (const d of fleet) this.drones.set(d.id, d);
    this.homey.log('[SecurityDrone] Fleet initialized: ' + fleet.length + ' drones');
  }

  _initializePatrolRoutes() {
    const wp = (lat, lng, alt, action, pause) => ({ lat, lng, altitude: alt, action, pauseSec: pause });
    const routes = [
      { id: 'perimeter-full', name: 'Full Perimeter Patrol', waypoints: [
          wp(59.3290, 18.0680, 15, 'scan', 5), wp(59.3290, 18.0695, 15, 'scan', 3),
          wp(59.3298, 18.0695, 15, 'hover-scan', 10), wp(59.3298, 18.0680, 15, 'scan', 3),
          wp(59.3294, 18.0678, 12, 'thermal-scan', 8), wp(59.3290, 18.0680, 15, 'final-check', 5)
        ], distanceMeters: 620, estimatedMinutes: 12, droneAssignment: 'patrol-alpha', frequency: 'every-2h', lastCompleted: null, timesCompleted: 0, enabled: true, priority: 1 },
      { id: 'front-yard', name: 'Front Yard & Street Patrol', waypoints: [
          wp(59.3290, 18.0683, 10, 'scan', 5), wp(59.3289, 18.0686, 12, 'license-plate-scan', 8),
          wp(59.3289, 18.0690, 10, 'scan', 5), wp(59.3291, 18.0686, 8, 'face-scan', 10)
        ], distanceMeters: 210, estimatedMinutes: 6, droneAssignment: 'patrol-alpha', frequency: 'hourly', lastCompleted: null, timesCompleted: 0, enabled: true, priority: 2 },
      { id: 'backyard', name: 'Backyard & Garden Patrol', waypoints: [
          wp(59.3296, 18.0683, 8, 'scan', 4), wp(59.3298, 18.0686, 10, 'thermal-scan', 8),
          wp(59.3297, 18.0690, 8, 'scan', 4), wp(59.3295, 18.0688, 6, 'low-sweep', 6)
        ], distanceMeters: 180, estimatedMinutes: 5, droneAssignment: 'patrol-beta', frequency: 'every-2h', lastCompleted: null, timesCompleted: 0, enabled: true, priority: 3 },
      { id: 'driveway-check', name: 'Driveway & Vehicle Check', waypoints: [
          wp(59.3291, 18.0684, 6, 'vehicle-scan', 10), wp(59.3290, 18.0685, 4, 'license-plate-scan', 12),
          wp(59.3290, 18.0687, 6, 'perimeter-check', 5)
        ], distanceMeters: 90, estimatedMinutes: 4, droneAssignment: 'patrol-alpha', frequency: 'custom', lastCompleted: null, timesCompleted: 0, enabled: true, priority: 4 },
      { id: 'indoor-sweep', name: 'Indoor Room-by-Room Sweep', waypoints: [
          wp(59.3293, 18.0686, 1.5, 'room-scan', 15), wp(59.3293, 18.0687, 1.5, 'room-scan', 15),
          wp(59.3294, 18.0686, 1.5, 'room-scan', 15), wp(59.3294, 18.0687, 1.5, 'room-scan', 15),
          wp(59.3293, 18.0688, 1.2, 'window-check', 10)
        ], distanceMeters: 45, estimatedMinutes: 8, droneAssignment: 'indoor-scout', frequency: 'every-2h', lastCompleted: null, timesCompleted: 0, enabled: true, priority: 5 }
    ];
    for (const r of routes) this.patrolRoutes.set(r.id, r);
    this.homey.log('[SecurityDrone] Patrol routes initialized: ' + routes.length);
  }

  _initializeLandingPads() {
    const pads = [
      { id: 'pad-roof', name: 'Roof Charging Dock', location: 'Roof-mounted platform', type: 'outdoor', status: 'occupied', weatherProtected: true, chargeRateW: 65, currentDrone: 'patrol-alpha', lat: 59.3293, lng: 18.0686, snowIceDetected: false },
      { id: 'pad-shed', name: 'Garden Shed Dock', location: 'Garden shed roof', type: 'outdoor', status: 'occupied', weatherProtected: true, chargeRateW: 45, currentDrone: 'patrol-beta', lat: 59.3295, lng: 18.0690, snowIceDetected: false },
      { id: 'pad-hallway', name: 'Hallway Alcove Dock', location: 'Hallway alcove, ground floor', type: 'indoor', status: 'occupied', weatherProtected: true, chargeRateW: 25, currentDrone: 'indoor-scout', lat: 59.3293, lng: 18.0686, snowIceDetected: false }
    ];
    for (const p of pads) this.landingPads.set(p.id, p);
    this.homey.log('[SecurityDrone] Landing pads initialized: ' + pads.length);
  }

  _initializeNoFlyZones() {
    this.noFlyZones = [
      { id: 'nfz-neighbor', name: "Neighbor's Property", type: 'polygon', boundary: [{ lat: 59.3285, lng: 18.0678 }, { lat: 59.3285, lng: 18.0695 }, { lat: 59.3289, lng: 18.0695 }, { lat: 59.3289, lng: 18.0678 }], altitudeMaxM: 0, reason: 'Privacy - neighboring property', enforced: true },
      { id: 'nfz-road', name: 'Public Road Airspace', type: 'corridor', boundary: [{ lat: 59.3288, lng: 18.0675 }, { lat: 59.3288, lng: 18.0700 }, { lat: 59.3287, lng: 18.0700 }, { lat: 59.3287, lng: 18.0675 }], altitudeMaxM: 0, reason: 'Public road - Swedish regulations', enforced: true },
      { id: 'nfz-powerlines', name: 'Power Line Corridor', type: 'corridor', boundary: [{ lat: 59.3299, lng: 18.0680 }, { lat: 59.3299, lng: 18.0695 }, { lat: 59.3300, lng: 18.0695 }, { lat: 59.3300, lng: 18.0680 }], altitudeMaxM: 25, reason: 'Power lines - safety hazard', enforced: true }
    ];
    this.homey.log('[SecurityDrone] No-fly zones configured: ' + this.noFlyZones.length);
  }

  _initializeFixedCameras() {
    this.fixedCameras = [
      { id: 'cam-front-door', name: 'Front Door Camera', location: 'front', resolution: '4K', nightVision: true, motionDetection: true, online: true },
      { id: 'cam-backyard', name: 'Backyard Camera', location: 'back', resolution: '1080p', nightVision: true, motionDetection: true, online: true },
      { id: 'cam-garage', name: 'Garage Camera', location: 'garage', resolution: '1080p', nightVision: true, motionDetection: true, online: true },
      { id: 'cam-driveway', name: 'Driveway Camera', location: 'driveway', resolution: '4K', nightVision: true, motionDetection: true, online: true },
      { id: 'cam-side-east', name: 'Side East Camera', location: 'side-east', resolution: '720p', nightVision: false, motionDetection: true, online: true },
      { id: 'cam-side-west', name: 'Side West Camera', location: 'side-west', resolution: '720p', nightVision: false, motionDetection: true, online: true }
    ];
    this.homey.log('[SecurityDrone] Fixed cameras registered: ' + this.fixedCameras.length);
  }

  _initializePrivacySettings() {
    this.privacySettings = {
      gdprCompliant: true, neighborPrivacyZones: true, blurNeighborProperty: true,
      recordingRetentionDays: 30, footageAccessLog: true, transportstyreisenCompliant: true,
      maxOperatingAltitudeM: 50, visualLineOfSight: true, operatorCertification: 'A1/A3',
      droneRegistrationId: 'SE-DRONE-2025-04821', insuranceValid: true, insuranceExpiry: '2026-12-31',
      consentNoticesPosted: true, dataProcessorAgreement: true,
      lastComplianceAudit: new Date(Date.now() - 30 * 86400000).toISOString()
    };
    this.homey.log('[SecurityDrone] Privacy and compliance settings configured');
  }

  _initializeMaintenanceRecords() {
    for (const [droneId, drone] of this.drones) {
      this.maintenanceRecords.set(droneId, {
        lastFullInspection: drone.lastMaintenance,
        propellerReplacements: droneId === 'patrol-alpha' ? 3 : droneId === 'patrol-beta' ? 1 : 5,
        motorReplacements: 0, cameraReplacements: 0,
        batteryReplacements: droneId === 'indoor-scout' ? 1 : 0,
        firmwareUpdates: [{ version: drone.firmware, date: new Date(Date.now() - 60 * 86400000).toISOString() }],
        spareParts: { propellers: droneId === 'indoor-scout' ? 8 : 4, batteries: 1, motors: 0, cameraModules: 0 },
        nextScheduledMaintenance: new Date(Date.now() + 30 * 86400000).toISOString(),
        issues: []
      });
    }
    this.homey.log('[SecurityDrone] Maintenance records initialized');
  }

  // --- Patrol Scheduling ---

  _runScheduledPatrols() {
    if (!this.initialized) return;
    const now = new Date();
    const hour = now.getHours();
    const isNight = hour >= this.schedulingConfig.nightStartHour || hour < this.schedulingConfig.nightEndHour;
    const intervalHours = isNight ? this.schedulingConfig.nightIntervalHours : this.schedulingConfig.dayIntervalHours;
    for (const [routeId, route] of this.patrolRoutes) {
      if (!route.enabled) continue;
      if (this._shouldRunPatrol(route, intervalHours, now)) {
        const drone = this.drones.get(route.droneAssignment);
        if (drone && drone.status === 'docked' && drone.batteryLevel >= 25) {
          if (this._isWeatherSafe(drone)) {
            this._launchPatrol(drone.id, routeId);
          } else {
            this.homey.log('[SecurityDrone] Weather unsafe, skipping patrol: ' + routeId);
            this._logEvent('weather', 'info', 'Patrol skipped due to weather: ' + routeId);
          }
        }
      }
    }
  }

  _shouldRunPatrol(route, intervalHours, now) {
    if (!route.lastCompleted) return true;
    const elapsed = (now.getTime() - new Date(route.lastCompleted).getTime()) / 3600000;
    if (route.frequency === 'hourly') return elapsed >= 1;
    if (route.frequency === 'every-2h') return elapsed >= 2;
    return elapsed >= intervalHours;
  }

  _scheduleRandomPatrol() {
    if (!this.initialized || !this.schedulingConfig.randomPatrolEnabled) return;
    const now = Date.now();
    const lastRandom = this.schedulingConfig.lastRandomPatrol ? new Date(this.schedulingConfig.lastRandomPatrol).getTime() : 0;
    const min = this.schedulingConfig.randomMinIntervalMin * 60000;
    const max = this.schedulingConfig.randomMaxIntervalMin * 60000;
    if (now - lastRandom < min + Math.random() * (max - min)) return;
    const routes = Array.from(this.patrolRoutes.values()).filter(r => r.enabled);
    if (!routes.length) return;
    const route = routes[Math.floor(Math.random() * routes.length)];
    const drone = this.drones.get(route.droneAssignment);
    if (drone && drone.status === 'docked' && drone.batteryLevel >= 30 && this._isWeatherSafe(drone)) {
      this.homey.log('[SecurityDrone] Random deterrence patrol triggered: ' + route.id);
      this._launchPatrol(drone.id, route.id);
      this.schedulingConfig.lastRandomPatrol = new Date().toISOString();
    }
  }

  // --- Patrol Execution ---

  async _launchPatrol(droneId, routeId) {
    const drone = this.drones.get(droneId);
    const route = this.patrolRoutes.get(routeId);
    if (!drone || !route) return;
    if (this._isInNoFlyZone(drone.homeBase.lat, drone.homeBase.lng, 15)) {
      this.homey.error('[SecurityDrone] Home base is in no-fly zone, aborting');
      return;
    }
    drone.status = 'launching';
    drone.currentRoute = routeId;
    drone.currentWaypointIndex = 0;
    drone.recording = true;
    const pad = this.landingPads.get(drone.assignedPadId);
    if (pad) { pad.status = 'available'; pad.currentDrone = null; }
    this._logEvent('patrol', 'info', 'Drone ' + droneId + ' launching for route ' + routeId);
    this.homey.emit('drone-launched', { droneId, routeId });
    this.homey.log('[SecurityDrone] Drone ' + droneId + ' launching on route ' + routeId);
    setTimeout(() => {
      if (drone.status === 'launching') {
        drone.status = 'patrolling';
        this._simulatePatrolProgress(droneId, routeId);
      }
    }, 3000);
  }

  _simulatePatrolProgress(droneId, routeId) {
    const drone = this.drones.get(droneId);
    const route = this.patrolRoutes.get(routeId);
    if (!drone || !route || drone.status !== 'patrolling') return;
    const wpInterval = setInterval(() => {
      if (drone.status !== 'patrolling' || drone.currentWaypointIndex >= route.waypoints.length) {
        clearInterval(wpInterval);
        this._completePatrol(droneId, routeId);
        return;
      }
      const wp = route.waypoints[drone.currentWaypointIndex];
      if (!wp) { clearInterval(wpInterval); this._completePatrol(droneId, routeId); return; }
      if (this._isInNoFlyZone(wp.lat, wp.lng, wp.altitude)) {
        this.homey.log('[SecurityDrone] Waypoint in no-fly zone, skipping');
        this._logEvent('geofence', 'warning', 'Waypoint skipped - NFZ for drone ' + droneId);
        drone.currentWaypointIndex++;
        return;
      }
      drone.currentPosition = { lat: wp.lat, lng: wp.lng, altitude: wp.altitude };
      drone.speed = drone.maxSpeed * 0.6;
      drone.batteryLevel = Math.max(0, drone.batteryLevel - 0.8);
      drone.flightTimeRemainingMin = Math.max(0, drone.flightTimeRemainingMin - 0.5);
      this._performVisionDetection(droneId, wp);
      drone.currentWaypointIndex++;
      if (drone.batteryLevel < 15) {
        this.homey.log('[SecurityDrone] Low battery on ' + droneId + ', returning');
        clearInterval(wpInterval);
        this._returnToBase(droneId, 'low-battery');
      }
    }, 5000);
    this.intervals.push(wpInterval);
  }

  _completePatrol(droneId, routeId) {
    const drone = this.drones.get(droneId);
    const route = this.patrolRoutes.get(routeId);
    if (!drone) return;
    drone.recording = false;
    this._returnToBase(droneId, 'patrol-complete');
    if (route) { route.lastCompleted = new Date().toISOString(); route.timesCompleted++; }
    this.analytics.totalFlightHours += (route ? route.estimatedMinutes : 5) / 60;
    this.analytics.totalAreaCoveredKm2 += (route ? route.distanceMeters : 100) * 0.02 / 1000;
    this._logEvent('patrol', 'info', 'Patrol completed: ' + routeId + ' by ' + droneId);
    this.homey.emit('patrol-completed', { droneId, routeId, timesCompleted: route ? route.timesCompleted : 0 });
    this.homey.log('[SecurityDrone] Patrol completed: ' + routeId);
  }

  _returnToBase(droneId, reason) {
    const drone = this.drones.get(droneId);
    if (!drone) return;
    drone.status = 'returning';
    drone.currentRoute = null;
    drone.currentWaypointIndex = -1;
    drone.speed = drone.maxSpeed * 0.8;
    this.homey.log('[SecurityDrone] Drone ' + droneId + ' returning: ' + reason);
    setTimeout(() => {
      if (drone.status === 'returning') {
        drone.status = 'docked';
        drone.speed = 0;
        drone.currentPosition = { lat: drone.homeBase.lat, lng: drone.homeBase.lng, altitude: 0 };
        const pad = this.landingPads.get(drone.assignedPadId);
        if (pad) { pad.status = 'occupied'; pad.currentDrone = droneId; }
        this.homey.emit('drone-docked', { droneId, reason });
        this._logEvent('patrol', 'info', 'Drone docked: ' + droneId + ' reason: ' + reason);
        if (drone.batteryLevel < 90) this._startCharging(droneId);
      }
    }, 5000);
  }

  // --- Vision & Detection ---

  _performVisionDetection(droneId, waypoint) {
    const drone = this.drones.get(droneId);
    if (!drone || Math.random() >= 0.15) return;
    const types = ['person', 'vehicle', 'animal', 'package', 'unknown'];
    const detectedType = types[Math.floor(Math.random() * types.length)];
    const detection = {
      id: 'det-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      type: detectedType, confidence: 0.7 + Math.random() * 0.3,
      timestamp: new Date().toISOString(), position: { lat: waypoint.lat, lng: waypoint.lng, altitude: waypoint.altitude },
      droneId, snapshotId: 'snap-' + Date.now(), action: waypoint.action
    };
    drone.objectsDetected.push(detection);
    if (drone.objectsDetected.length > 50) drone.objectsDetected = drone.objectsDetected.slice(-50);
    this._classifyAnomaly(detection, droneId);
  }

  _classifyAnomaly(detection, droneId) {
    const hour = new Date().getHours();
    const isNight = hour >= 22 || hour < 6;
    let severity = 'low';
    let isAnomaly = false;
    if (detection.type === 'person' && isNight) { severity = 'high'; isAnomaly = true; }
    else if (detection.type === 'person' && detection.confidence > 0.85) { severity = 'medium'; isAnomaly = true; }
    else if (detection.type === 'vehicle' && isNight) { severity = 'medium'; isAnomaly = true; }
    else if (detection.type === 'unknown') { severity = 'high'; isAnomaly = true; }
    if (!isAnomaly) return;
    this.analytics.anomaliesDetectedMonth++;
    const anomalyEvent = {
      detectionId: detection.id, type: detection.type, severity, droneId,
      position: detection.position, timestamp: detection.timestamp, responses: []
    };
    this._executeAnomalyResponse(anomalyEvent, severity);
    this._logEvent('anomaly', severity, 'Anomaly by ' + droneId + ': ' + detection.type + ' (' + severity + ')');
    this.homey.emit('security-anomaly-detected', anomalyEvent);
    this.homey.log('[SecurityDrone] Anomaly detected: ' + detection.type + ' severity=' + severity);
  }

  _executeAnomalyResponse(anomalyEvent, severity) {
    const responses = ['record-video'];
    this._captureVideoClip(anomalyEvent.droneId, anomalyEvent.detectionId, 30);
    if (severity === 'medium' || severity === 'high' || severity === 'critical') {
      responses.push('spotlight-on', 'send-alert');
      this.homey.emit('security-alert', { type: 'drone-detection', severity, details: anomalyEvent });
    }
    if (severity === 'high' || severity === 'critical') {
      responses.push('siren-activate', 'notify-security-company');
      this._notifySecurityCompany(anomalyEvent);
    }
    if (severity === 'critical') {
      responses.push('call-security', 'lock-all-doors');
      this.homey.emit('emergency-lockdown', { trigger: 'drone-detection', event: anomalyEvent });
    }
    anomalyEvent.responses = responses;
    this.homey.log('[SecurityDrone] Anomaly response: ' + responses.join(', '));
  }

  _notifySecurityCompany(anomalyEvent) {
    const notification = { company: 'Securitas', timestamp: new Date().toISOString(), event: anomalyEvent, address: 'Configured property address', contactMethod: 'API', status: 'sent' };
    this._logEvent('notification', 'high', 'Security company notified: Securitas');
    this.homey.emit('security-company-notified', notification);
    this.homey.log('[SecurityDrone] Securitas notified: ' + anomalyEvent.detectionId);
  }

  performFaceRecognition(droneId) {
    const result = { droneId, timestamp: new Date().toISOString(), facesDetected: Math.floor(Math.random() * 3), knownFaces: [], unknownFaces: 0, confidence: 0 };
    if (result.facesDetected > 0) {
      if (Math.random() > 0.5) {
        result.knownFaces.push({ label: 'household-member', confidence: 0.92 });
        result.confidence = 0.92;
      } else {
        result.unknownFaces = result.facesDetected;
        result.confidence = 0.88;
        this._logEvent('recognition', 'medium', 'Unknown face detected by ' + droneId);
        this.homey.emit('unknown-face-detected', result);
      }
    }
    return result;
  }

  performLicensePlateRecognition(droneId) {
    const result = { droneId, timestamp: new Date().toISOString(), platesDetected: Math.random() > 0.6 ? 1 : 0, plates: [], confidence: 0 };
    if (result.platesDetected > 0) {
      const isKnown = Math.random() > 0.4;
      const plate = { text: 'ABC' + Math.floor(100 + Math.random() * 900), known: isKnown, confidence: 0.85 + Math.random() * 0.14, country: 'SE' };
      result.plates.push(plate);
      result.confidence = plate.confidence;
      if (!isKnown) {
        this._logEvent('recognition', 'medium', 'Unknown plate: ' + plate.text);
        this.homey.emit('unknown-vehicle-detected', result);
      }
    }
    return result;
  }

  // --- Live Feed Management ---

  startLiveFeed(droneId, viewerId) {
    const drone = this.drones.get(droneId);
    if (!drone) { this.homey.error('[SecurityDrone] Feed failed, drone not found: ' + droneId); return null; }
    const feedId = 'feed-' + droneId + '-' + Date.now();
    const hour = new Date().getHours();
    const feed = {
      id: feedId, droneId, viewerId, startedAt: new Date().toISOString(),
      resolution: drone.cameraResolution, fps: drone.cameraResolution === '4K' ? 30 : 60,
      nightVisionActive: drone.nightVision && (hour >= 20 || hour < 6),
      encrypted: true, latencyMs: this.commState.latencyMs, status: 'streaming',
      viewers: [viewerId], thumbnailInterval: 10
    };
    this.liveFeeds.set(feedId, feed);
    this.footageStorage.accessLog.push({ feedId, viewerId, accessTime: new Date().toISOString(), action: 'start-stream' });
    this._logEvent('feed', 'info', 'Live feed started: ' + feedId);
    this.homey.emit('live-feed-started', feed);
    this.homey.log('[SecurityDrone] Live feed started: ' + feedId);
    return feed;
  }

  addViewerToFeed(feedId, viewerId) {
    const feed = this.liveFeeds.get(feedId);
    if (!feed) return false;
    if (!feed.viewers.includes(viewerId)) {
      feed.viewers.push(viewerId);
      this.footageStorage.accessLog.push({ feedId, viewerId, accessTime: new Date().toISOString(), action: 'join-stream' });
      this.homey.log('[SecurityDrone] Viewer ' + viewerId + ' joined feed ' + feedId);
    }
    return true;
  }

  stopLiveFeed(feedId) {
    const feed = this.liveFeeds.get(feedId);
    if (!feed) return false;
    feed.status = 'stopped';
    this.liveFeeds.delete(feedId);
    this._logEvent('feed', 'info', 'Live feed stopped: ' + feedId);
    this.homey.log('[SecurityDrone] Live feed stopped: ' + feedId);
    return true;
  }

  _captureVideoClip(droneId, eventId, durationSec) {
    const clip = {
      id: 'clip-' + Date.now(), droneId, eventId, startTime: new Date().toISOString(),
      durationSec, resolution: this.drones.get(droneId)?.cameraResolution || '1080p',
      sizeEstimateMB: durationSec * 3.5, tags: [eventId],
      retainUntil: new Date(Date.now() + this.privacySettings.recordingRetentionDays * 86400000).toISOString(),
      privacyProcessed: this.privacySettings.blurNeighborProperty
    };
    this.footageStorage.totalStoredClips++;
    this.footageStorage.storageUsedGB += clip.sizeEstimateMB / 1024;
    this._logEvent('recording', 'info', 'Video clip captured: ' + clip.id);
    this.homey.emit('video-clip-captured', clip);
    return clip;
  }

  // --- Battery & Charging ---

  _manageBatteryCharging() {
    if (!this.initialized) return;
    for (const [droneId, drone] of this.drones) {
      if (drone.status === 'docked' && drone.batteryLevel < 95) this._startCharging(droneId);
      if (drone.status === 'charging') {
        const pad = this.landingPads.get(drone.assignedPadId);
        const chargeRate = pad ? pad.chargeRateW : 30;
        const increment = (chargeRate / drone.batteryCapacityWh) * (30 / 3600) * 100;
        drone.batteryLevel = Math.min(100, drone.batteryLevel + increment);
        drone.flightTimeRemainingMin = (drone.batteryLevel / 100) * drone.maxFlightTimeMin;
        if (drone.batteryLevel >= 100) {
          drone.status = 'docked';
          drone.batteryLevel = 100;
          drone.flightTimeRemainingMin = drone.maxFlightTimeMin;
          if (pad) pad.status = 'occupied';
          this.homey.log('[SecurityDrone] Drone ' + droneId + ' fully charged');
          this.homey.emit('drone-charged', { droneId, batteryLevel: 100 });
        }
      }
    }
  }

  _startCharging(droneId) {
    const drone = this.drones.get(droneId);
    if (!drone || drone.status === 'charging' || drone.status !== 'docked') return;
    drone.status = 'charging';
    drone.chargeCycles++;
    const pad = this.landingPads.get(drone.assignedPadId);
    if (pad) pad.status = 'charging';
    if (drone.chargeCycles > 200 && drone.chargeCycles % 50 === 0) {
      drone.batteryHealthPct = Math.max(70, drone.batteryHealthPct - 1);
    }
    this.homey.log('[SecurityDrone] Charging started: ' + droneId + ' cycle=' + drone.chargeCycles);
  }

  // --- Weather Management ---

  _updateWeatherConditions() {
    if (!this.initialized) return;
    const temp = -5 + Math.random() * 25;
    const wind = Math.random() * 20;
    const rainChance = Math.random();
    this.weatherState = {
      windSpeedMs: Math.round(wind * 10) / 10, temperature: Math.round(temp * 10) / 10,
      raining: rainChance < 0.15, snowing: temp < 2 && Math.random() < 0.1,
      visibility: rainChance > 0.3 ? 'reduced' : (wind > 12 ? 'moderate' : 'clear'),
      lastUpdated: new Date().toISOString()
    };
    for (const [, pad] of this.landingPads) {
      if (pad.type === 'outdoor') pad.snowIceDetected = this.weatherState.temperature < 0 && (this.weatherState.snowing || Math.random() < 0.2);
    }
    if (!this._isWeatherSafeGlobal()) this._groundAllDrones('unsafe-weather');
    if (this.weatherState.temperature < -20 || this.weatherState.temperature > 45) {
      this._groundAllDrones('temperature-extreme');
      this._logEvent('weather', 'high', 'Extreme temp: ' + this.weatherState.temperature + 'C');
    }
  }

  _isWeatherSafe(drone) {
    if (drone.type === 'indoor') return true;
    return this.weatherState.windSpeedMs <= drone.maxWindSpeedMs &&
      !this.weatherState.raining && !this.weatherState.snowing &&
      this.weatherState.temperature >= -20 && this.weatherState.temperature <= 45 &&
      !(this.weatherState.visibility === 'reduced' && !drone.nightVision);
  }

  _isWeatherSafeGlobal() {
    return this.weatherState.windSpeedMs <= 15 && !this.weatherState.raining &&
      !this.weatherState.snowing && this.weatherState.temperature >= -20 &&
      this.weatherState.temperature <= 45;
  }

  _groundAllDrones(reason) {
    for (const [droneId, drone] of this.drones) {
      if (drone.status === 'patrolling' || drone.status === 'launching') {
        this.homey.log('[SecurityDrone] Grounding ' + droneId + ': ' + reason);
        this._returnToBase(droneId, reason);
        this._logEvent('weather', 'warning', 'Grounded ' + droneId + ': ' + reason);
      }
    }
  }

  // --- No-Fly Zone Enforcement ---

  _isInNoFlyZone(lat, lng, altitude) {
    for (const zone of this.noFlyZones) {
      if (!zone.enforced) continue;
      if (zone.altitudeMaxM > 0 && altitude <= zone.altitudeMaxM) continue;
      if (this._isPointInPolygon(lat, lng, zone.boundary)) return true;
    }
    return false;
  }

  _isPointInPolygon(lat, lng, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].lat, yi = polygon[i].lng;
      const xj = polygon[j].lat, yj = polygon[j].lng;
      if (((yi > lng) !== (yj > lng)) && (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }

  // --- Communication Health ---

  _checkCommunicationHealth() {
    if (!this.initialized) return;
    const wifiStrength = 70 + Math.floor(Math.random() * 30);
    const latency = 5 + Math.floor(Math.random() * 40);
    this.commState.signalStrength = wifiStrength;
    this.commState.latencyMs = latency;
    if (wifiStrength < 30) {
      this.commState.primaryLink = '4g';
      this.homey.log('[SecurityDrone] WiFi weak, switching to 4G');
      this._logEvent('communication', 'warning', 'Switched to 4G backup');
    } else {
      this.commState.primaryLink = 'wifi';
    }
    if (latency > 500) {
      this._logEvent('communication', 'high', 'High latency: ' + latency + 'ms');
      for (const [droneId, drone] of this.drones) {
        if (drone.status === 'patrolling') {
          this.homey.log('[SecurityDrone] Lost connection protocol: ' + droneId);
          this._returnToBase(droneId, 'connection-lost');
        }
      }
    }
    for (const [droneId, drone] of this.drones) {
      if (drone.status === 'patrolling') {
        const sig = this._estimateSignalAtPosition(drone.currentPosition);
        if (sig < 20) {
          this.homey.log('[SecurityDrone] Dead zone for ' + droneId);
          this._logEvent('communication', 'warning', 'Dead zone: ' + droneId);
        }
      }
    }
  }

  _estimateSignalAtPosition(position) {
    const dist = Math.sqrt(Math.pow(position.lat - 59.3293, 2) + Math.pow(position.lng - 18.0686, 2)) * 111000;
    return Math.max(0, 100 - dist * 0.3);
  }

  // --- Maintenance ---

  _checkMaintenanceSchedule() {
    if (!this.initialized) return;
    const now = Date.now();
    for (const [droneId, drone] of this.drones) {
      const record = this.maintenanceRecords.get(droneId);
      if (!record) continue;
      if (drone.propellerInspectionDue && new Date(drone.propellerInspectionDue).getTime() < now) {
        this._logEvent('maintenance', 'warning', 'Propeller inspection overdue: ' + droneId);
        this.homey.emit('maintenance-required', { droneId, type: 'propeller-inspection' });
      }
      if (drone.motorHours > 500) {
        this._logEvent('maintenance', 'warning', 'Motor hours high: ' + droneId + ' (' + drone.motorHours + 'h)');
      }
      if (drone.batteryHealthPct < 80) {
        this._logEvent('maintenance', 'high', 'Battery degraded: ' + droneId + ' (' + drone.batteryHealthPct + '%)');
        this.homey.emit('maintenance-required', { droneId, type: 'battery-replacement' });
      }
      if (drone.lastCalibration && (now - new Date(drone.lastCalibration).getTime()) / 86400000 > 30) {
        drone.cameraCalibrated = false;
        this._logEvent('maintenance', 'info', 'Camera recalibration needed: ' + droneId);
      }
      if (record.nextScheduledMaintenance && new Date(record.nextScheduledMaintenance).getTime() < now) {
        drone.status = 'maintenance';
        this._logEvent('maintenance', 'warning', 'Scheduled maintenance due: ' + droneId);
        this.homey.emit('maintenance-due', { droneId, scheduled: record.nextScheduledMaintenance });
      }
      if (record.spareParts.propellers < 2) this._logEvent('maintenance', 'info', 'Low propellers: ' + droneId);
      if (record.spareParts.batteries < 1) this._logEvent('maintenance', 'warning', 'No spare batteries: ' + droneId);
    }
  }

  performMaintenance(droneId, maintenanceType) {
    const drone = this.drones.get(droneId);
    const record = this.maintenanceRecords.get(droneId);
    if (!drone || !record) { this.homey.error('[SecurityDrone] Maintenance failed, not found: ' + droneId); return null; }
    if (drone.status !== 'docked' && drone.status !== 'maintenance') {
      this.homey.error('[SecurityDrone] Drone must be docked: ' + droneId);
      return null;
    }
    drone.status = 'maintenance';
    const result = { droneId, type: maintenanceType, timestamp: new Date().toISOString(), success: true, notes: '' };
    switch (maintenanceType) {
      case 'propeller-inspection':
        drone.propellerInspectionDue = new Date(Date.now() + 30 * 86400000).toISOString();
        result.notes = 'Propellers inspected'; break;
      case 'propeller-replacement':
        if (record.spareParts.propellers >= 1) {
          record.spareParts.propellers--; record.propellerReplacements++;
          drone.propellerInspectionDue = new Date(Date.now() + 60 * 86400000).toISOString();
          result.notes = 'Replaced, ' + record.spareParts.propellers + ' spares left';
        } else { result.success = false; result.notes = 'No spare propellers'; }
        break;
      case 'camera-calibration':
        drone.cameraCalibrated = true;
        drone.lastCalibration = new Date().toISOString();
        result.notes = 'Camera calibrated'; break;
      case 'firmware-update':
        const parts = drone.firmware.split('.');
        parts[2] = String(parseInt(parts[2], 10) + 1);
        drone.firmware = parts.join('.');
        record.firmwareUpdates.push({ version: drone.firmware, date: new Date().toISOString() });
        result.notes = 'Firmware updated to ' + drone.firmware; break;
      case 'battery-replacement':
        if (record.spareParts.batteries >= 1) {
          record.spareParts.batteries--; record.batteryReplacements++;
          drone.batteryHealthPct = 100; drone.chargeCycles = 0; drone.batteryLevel = 100;
          result.notes = 'Battery replaced, health 100%';
        } else { result.success = false; result.notes = 'No spare batteries'; }
        break;
      case 'full-inspection':
        record.lastFullInspection = new Date().toISOString();
        record.nextScheduledMaintenance = new Date(Date.now() + 90 * 86400000).toISOString();
        drone.lastMaintenance = new Date().toISOString();
        result.notes = 'Full inspection completed'; break;
      default:
        result.success = false; result.notes = 'Unknown type: ' + maintenanceType;
    }
    if (result.success) record.issues = record.issues.filter(i => i.type !== maintenanceType);
    drone.status = 'docked';
    this._logEvent('maintenance', 'info', 'Maintenance: ' + droneId + ' ' + maintenanceType);
    this.homey.log('[SecurityDrone] Maintenance ' + droneId + ': ' + maintenanceType + ' - ' + result.notes);
    this.homey.emit('maintenance-completed', result);
    return result;
  }

  // --- Event-Triggered Patrols ---

  triggerEventPatrol(eventType, sourceData) {
    if (!this.initialized) { this.homey.log('[SecurityDrone] Not initialized'); return null; }
    this.homey.log('[SecurityDrone] Event-triggered patrol: ' + eventType);
    this._logEvent('trigger', 'info', 'Event patrol: ' + eventType);
    const routeMap = {
      'motion-sensor': sourceData?.zone === 'backyard' ? 'backyard' : 'front-yard',
      'alarm-activation': 'perimeter-full', 'doorbell-ring': 'front-yard',
      'fence-breach': sourceData?.zone === 'back' ? 'backyard' : 'perimeter-full',
      'vehicle-detected': 'driveway-check', 'indoor-alarm': 'indoor-sweep'
    };
    const priorityMap = { 'motion-sensor': 'high', 'alarm-activation': 'critical', 'doorbell-ring': 'normal', 'fence-breach': 'critical', 'vehicle-detected': 'high', 'indoor-alarm': 'critical' };
    const targetRoute = routeMap[eventType] || 'perimeter-full';
    const priority = priorityMap[eventType] || 'normal';
    const route = this.patrolRoutes.get(targetRoute);
    if (!route) return null;
    const candidates = [route.droneAssignment, ...Array.from(this.drones.keys()).filter(id => id !== route.droneAssignment)];
    for (const cId of candidates) {
      const d = this.drones.get(cId);
      if (!d || (d.status !== 'docked' && d.status !== 'charging') || d.batteryLevel < 15) continue;
      if (d.type !== 'indoor' && !this._isWeatherSafe(d)) continue;
      if (d.status === 'charging') { d.status = 'docked'; const pad = this.landingPads.get(d.assignedPadId); if (pad) pad.status = 'occupied'; }
      this._launchPatrol(cId, targetRoute);
      this.homey.emit('event-patrol-launched', { eventType, routeId: targetRoute, droneId: cId, priority });
      return { droneId: cId, routeId: targetRoute, priority };
    }
    this.homey.log('[SecurityDrone] No drone available for: ' + eventType);
    return null;
  }

  // --- Manual Control ---

  activateManualControl(droneId, operatorId, mode) {
    const drone = this.drones.get(droneId);
    if (!drone) { this.homey.error('[SecurityDrone] Drone not found: ' + droneId); return false; }
    if (drone.status === 'patrolling') this._returnToBase(droneId, 'manual-override');
    this.manualControl = { active: true, droneId, mode: mode || 'waypoint', operator: operatorId };
    this._logEvent('manual', 'info', 'Manual control: ' + droneId + ' by ' + operatorId);
    this.homey.emit('manual-control-activated', this.manualControl);
    this.homey.log('[SecurityDrone] Manual control activated: ' + droneId);
    return true;
  }

  deactivateManualControl() {
    if (!this.manualControl.active) return false;
    const droneId = this.manualControl.droneId;
    this.manualControl = { active: false, droneId: null, mode: null, operator: null };
    const drone = this.drones.get(droneId);
    if (drone && drone.status === 'patrolling') this._returnToBase(droneId, 'manual-ended');
    this._logEvent('manual', 'info', 'Manual control deactivated: ' + droneId);
    this.homey.emit('manual-control-deactivated', { droneId });
    this.homey.log('[SecurityDrone] Manual control deactivated');
    return true;
  }

  manualNavigateToWaypoint(lat, lng, altitude) {
    if (!this.manualControl.active) { this.homey.error('[SecurityDrone] Manual control not active'); return false; }
    const drone = this.drones.get(this.manualControl.droneId);
    if (!drone) return false;
    if (this._isInNoFlyZone(lat, lng, altitude)) {
      this.homey.log('[SecurityDrone] Waypoint rejected: no-fly zone');
      this._logEvent('geofence', 'warning', 'Manual waypoint rejected - NFZ');
      return false;
    }
    if (altitude > this.privacySettings.maxOperatingAltitudeM) {
      this.homey.log('[SecurityDrone] Altitude exceeds limit: ' + altitude + 'm');
      return false;
    }
    drone.currentPosition = { lat, lng, altitude };
    drone.status = 'patrolling';
    drone.speed = drone.maxSpeed * 0.5;
    this.homey.log('[SecurityDrone] Manual nav to: ' + lat + ',' + lng + ' alt=' + altitude);
    return true;
  }

  activateFollowMeMode(droneId, targetDeviceId) {
    if (!this.manualControl.active || this.manualControl.droneId !== droneId) {
      this.activateManualControl(droneId, targetDeviceId, 'follow-me');
    }
    this.manualControl.mode = 'follow-me';
    this._logEvent('manual', 'info', 'Follow-me mode: ' + droneId);
    this.homey.emit('follow-me-activated', { droneId, targetDeviceId });
    this.homey.log('[SecurityDrone] Follow-me activated: ' + droneId);
    return true;
  }

  commandReturnToHome(droneId) {
    const drone = this.drones.get(droneId);
    if (!drone) return false;
    if (this.manualControl.active && this.manualControl.droneId === droneId) this.deactivateManualControl();
    this.homey.log('[SecurityDrone] Return-to-home: ' + droneId);
    this._returnToBase(droneId, 'manual-return-home');
    return true;
  }

  commandEmergencyLand(droneId) {
    const drone = this.drones.get(droneId);
    if (!drone) return false;
    this.homey.log('[SecurityDrone] EMERGENCY LAND: ' + droneId);
    drone.status = 'docked';
    drone.speed = 0;
    drone.recording = false;
    drone.currentRoute = null;
    drone.currentWaypointIndex = -1;
    if (this.manualControl.active && this.manualControl.droneId === droneId) {
      this.manualControl = { active: false, droneId: null, mode: null, operator: null };
    }
    this._logEvent('emergency', 'critical', 'Emergency landing: ' + droneId);
    this.homey.emit('emergency-landing', { droneId, position: drone.currentPosition });
    return true;
  }

  // --- Ground Security Integration ---

  getGroundSecurityStatus() {
    const hour = new Date().getHours();
    return {
      fixedCameras: this.fixedCameras.map(c => ({ id: c.id, name: c.name, online: c.online, motionDetection: c.motionDetection })),
      motionSensors: {
        frontYard: { active: true, lastTriggered: null },
        backyard: { active: true, lastTriggered: null },
        driveway: { active: true, lastTriggered: null },
        sidePassage: { active: true, lastTriggered: null }
      },
      doorWindowSensors: {
        frontDoor: { closed: true, locked: true },
        backDoor: { closed: true, locked: true },
        garageDoor: { closed: true, locked: true },
        windowsSecured: 12, windowsTotal: 14
      },
      perimeterLights: {
        active: true,
        mode: (hour >= 18 || hour < 6) ? 'on' : 'motion-activated',
        zones: ['front', 'back', 'sides', 'driveway']
      },
      alarmSystem: { armed: true, mode: 'perimeter', lastTriggered: null },
      securityCompany: { name: 'Securitas', connected: true, responseTimeMin: 8, lastContact: new Date().toISOString() }
    };
  }

  coordinateWithGroundSecurity(event) {
    const coordination = {
      timestamp: new Date().toISOString(), event,
      groundStatus: this.getGroundSecurityStatus(),
      droneResponse: null, actions: []
    };
    if (event.type === 'camera-motion' && event.cameraId) {
      const cam = this.fixedCameras.find(c => c.id === event.cameraId);
      if (cam) {
        coordination.actions.push('verify-with-drone');
        coordination.droneResponse = this.triggerEventPatrol('motion-sensor', { zone: cam.location });
      }
    }
    if (event.type === 'perimeter-breach') {
      coordination.actions.push('activate-lights', 'arm-alarm', 'deploy-drone', 'notify-securitas');
      this.triggerEventPatrol('fence-breach', event);
    }
    this._logEvent('coordination', 'info', 'Ground coordination: ' + event.type);
    this.homey.emit('ground-security-coordinated', coordination);
    return coordination;
  }

  // --- Anomaly Detection ---

  _runAnomalyDetection() {
    if (!this.initialized) return;
    for (const cam of this.fixedCameras) {
      if (!cam.online) {
        this._logEvent('anomaly', 'warning', 'Camera offline: ' + cam.id);
        this.homey.emit('camera-offline', { cameraId: cam.id });
      }
    }
    if (Math.random() < 0.02) {
      const types = [
        { type: 'open-gate', severity: 'medium', description: 'Gate detected open' },
        { type: 'broken-window', severity: 'high', description: 'Broken window detected' },
        { type: 'unknown-object', severity: 'medium', description: 'Unknown object on property' },
        { type: 'open-door', severity: 'high', description: 'External door open' }
      ];
      const anomaly = types[Math.floor(Math.random() * types.length)];
      this._logEvent('anomaly', anomaly.severity, anomaly.description);
      this.homey.emit('property-anomaly', anomaly);
    }
  }

  // --- Privacy Compliance ---

  _auditPrivacyCompliance() {
    if (!this.initialized) return;
    const issues = [];
    for (const [droneId, drone] of this.drones) {
      if (drone.status !== 'patrolling') continue;
      if (drone.currentPosition.altitude > this.privacySettings.maxOperatingAltitudeM) {
        issues.push({ type: 'altitude-violation', droneId, altitude: drone.currentPosition.altitude });
        this._returnToBase(droneId, 'altitude-violation');
      }
      if (this._isInNoFlyZone(drone.currentPosition.lat, drone.currentPosition.lng, drone.currentPosition.altitude)) {
        issues.push({ type: 'nfz-violation', droneId });
        this._returnToBase(droneId, 'nfz-violation');
      }
    }
    if (!this.privacySettings.gdprCompliant) issues.push({ type: 'gdpr-noncompliant' });
    if (issues.length > 0) {
      this._logEvent('privacy', 'high', 'Privacy issues: ' + issues.length);
      this.homey.emit('privacy-issues', issues);
    }
    this.privacySettings.lastComplianceAudit = new Date().toISOString();
  }

  _cleanupOldFootage() {
    if (!this.initialized) return;
    const clipsToRemove = Math.floor(this.footageStorage.totalStoredClips * 0.05);
    if (clipsToRemove > 0) {
      this.footageStorage.totalStoredClips = Math.max(0, this.footageStorage.totalStoredClips - clipsToRemove);
      this.footageStorage.storageUsedGB = Math.max(0, this.footageStorage.storageUsedGB - clipsToRemove * 0.1);
      this.homey.log('[SecurityDrone] Cleaned ' + clipsToRemove + ' expired clips');
    }
  }

  // --- Analytics ---

  _aggregateAnalytics() {
    if (!this.initialized) return;
    this.analytics.avgResponseTimeSec = 15 + Math.random() * 30;
    this.analytics.falsePositiveRate = Math.max(0.01, 0.05 + (Math.random() - 0.5) * 0.03);
    const monthStart = this.analytics.monthStartDate ? new Date(this.analytics.monthStartDate) : new Date();
    if (new Date().getMonth() !== monthStart.getMonth()) {
      this.homey.log('[SecurityDrone] Monthly analytics reset');
      this.analytics.anomaliesDetectedMonth = 0;
      this.analytics.monthStartDate = new Date().toISOString();
    }
  }

  getDroneAnalytics() {
    const droneStats = Array.from(this.drones.values()).map(d => ({
      droneId: d.id, name: d.name, totalFlightHours: d.totalFlightHours,
      batteryChargeCycles: d.chargeCycles, batteryHealthPct: d.batteryHealthPct,
      motorHours: d.motorHours, currentStatus: d.status, batteryLevel: d.batteryLevel,
      firmware: d.firmware, detectionCount: d.objectsDetected.length
    }));
    const routeStats = Array.from(this.patrolRoutes.values()).map(r => ({
      routeId: r.id, name: r.name, timesCompleted: r.timesCompleted,
      lastCompleted: r.lastCompleted, distanceMeters: r.distanceMeters, enabled: r.enabled
    }));
    return {
      drones: droneStats, routes: routeStats,
      totals: {
        totalFlightHours: this.analytics.totalFlightHours,
        totalAreaCoveredKm2: Math.round(this.analytics.totalAreaCoveredKm2 * 100) / 100,
        anomaliesDetectedThisMonth: this.analytics.anomaliesDetectedMonth,
        avgResponseTimeSec: Math.round(this.analytics.avgResponseTimeSec * 10) / 10,
        falsePositiveRate: Math.round(this.analytics.falsePositiveRate * 1000) / 10 + '%',
        totalPatrolsCompleted: routeStats.reduce((s, r) => s + r.timesCompleted, 0)
      },
      weather: this.weatherState, communication: this.commState,
      footageStorage: {
        clipsStored: this.footageStorage.totalStoredClips,
        storageUsedGB: Math.round(this.footageStorage.storageUsedGB * 100) / 100,
        maxStorageGB: this.footageStorage.maxStorageGB,
        retentionDays: this.footageStorage.retentionDays
      }
    };
  }

  // --- Event Log ---

  _logEvent(category, severity, message) {
    this.eventLog.push({
      id: 'evt-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(), category, severity, message
    });
    if (this.eventLog.length > 2000) this.eventLog = this.eventLog.slice(-1500);
  }

  getEventLog(filters) {
    let log = [...this.eventLog];
    if (filters) {
      if (filters.severity) log = log.filter(e => e.severity === filters.severity);
      if (filters.category) log = log.filter(e => e.category === filters.category);
      if (filters.droneId) log = log.filter(e => e.message.includes(filters.droneId));
      if (filters.startDate) { const s = new Date(filters.startDate).getTime(); log = log.filter(e => new Date(e.timestamp).getTime() >= s); }
      if (filters.endDate) { const end = new Date(filters.endDate).getTime(); log = log.filter(e => new Date(e.timestamp).getTime() <= end); }
      if (filters.limit) log = log.slice(-filters.limit);
    }
    return log;
  }

  // --- Route Management ---

  enableRoute(routeId) {
    const r = this.patrolRoutes.get(routeId);
    if (!r) return false;
    r.enabled = true;
    this.homey.log('[SecurityDrone] Route enabled: ' + routeId);
    return true;
  }

  disableRoute(routeId) {
    const r = this.patrolRoutes.get(routeId);
    if (!r) return false;
    r.enabled = false;
    this.homey.log('[SecurityDrone] Route disabled: ' + routeId);
    return true;
  }

  updateRouteFrequency(routeId, frequency) {
    const r = this.patrolRoutes.get(routeId);
    if (!r) return false;
    r.frequency = frequency;
    this.homey.log('[SecurityDrone] Route frequency: ' + routeId + ' -> ' + frequency);
    return true;
  }

  addWaypointToRoute(routeId, waypoint) {
    const route = this.patrolRoutes.get(routeId);
    if (!route) return false;
    if (this._isInNoFlyZone(waypoint.lat, waypoint.lng, waypoint.altitude)) {
      this.homey.error('[SecurityDrone] Waypoint in NFZ, rejected');
      return false;
    }
    route.waypoints.push(waypoint);
    this.homey.log('[SecurityDrone] Waypoint added to ' + routeId);
    return true;
  }

  // --- Scheduling Configuration ---

  updateSchedulingConfig(config) {
    const keys = ['dayIntervalHours', 'nightIntervalHours', 'nightStartHour', 'nightEndHour', 'randomPatrolEnabled', 'randomMinIntervalMin', 'randomMaxIntervalMin'];
    for (const k of keys) { if (config[k] !== undefined) this.schedulingConfig[k] = config[k]; }
    this.homey.log('[SecurityDrone] Scheduling config updated');
    this.homey.emit('scheduling-config-updated', this.schedulingConfig);
    return this.schedulingConfig;
  }

  // --- Drone Status ---

  getDroneStatus(droneId) {
    const d = this.drones.get(droneId);
    if (!d) return null;
    return {
      id: d.id, name: d.name, type: d.type, model: d.model, status: d.status,
      batteryLevel: d.batteryLevel, batteryHealthPct: d.batteryHealthPct,
      flightTimeRemainingMin: Math.round(d.flightTimeRemainingMin * 10) / 10,
      currentPosition: d.currentPosition, speed: d.speed,
      currentRoute: d.currentRoute, recording: d.recording,
      nightVision: d.nightVision, thermalImaging: d.thermalImaging,
      firmware: d.firmware, totalFlightHours: d.totalFlightHours,
      chargeCycles: d.chargeCycles, motorHours: d.motorHours,
      cameraCalibrated: d.cameraCalibrated, assignedPad: d.assignedPadId,
      recentDetections: d.objectsDetected.slice(-5)
    };
  }

  getAllDroneStatuses() {
    return Array.from(this.drones.keys()).map(id => this.getDroneStatus(id));
  }

  // --- Statistics ---

  getStatistics() {
    const droneStatuses = {};
    for (const [id, d] of this.drones) {
      droneStatuses[id] = { status: d.status, battery: d.batteryLevel, flightHours: d.totalFlightHours };
    }
    const routeStats = {};
    for (const [id, r] of this.patrolRoutes) {
      routeStats[id] = { enabled: r.enabled, timesCompleted: r.timesCompleted, lastCompleted: r.lastCompleted };
    }
    return {
      initialized: this.initialized,
      droneCount: this.drones.size,
      drones: droneStatuses,
      patrolRoutes: routeStats,
      routeCount: this.patrolRoutes.size,
      landingPadCount: this.landingPads.size,
      noFlyZoneCount: this.noFlyZones.length,
      fixedCameraCount: this.fixedCameras.length,
      eventLogEntries: this.eventLog.length,
      activeLiveFeeds: this.liveFeeds.size,
      manualControlActive: this.manualControl.active,
      weather: this.weatherState,
      communication: this.commState,
      analytics: {
        totalFlightHours: this.analytics.totalFlightHours,
        totalAreaCoveredKm2: Math.round(this.analytics.totalAreaCoveredKm2 * 100) / 100,
        anomaliesThisMonth: this.analytics.anomaliesDetectedMonth,
        avgResponseTimeSec: Math.round(this.analytics.avgResponseTimeSec * 10) / 10,
        falsePositiveRate: Math.round(this.analytics.falsePositiveRate * 1000) / 10
      },
      footageStorage: {
        clipsStored: this.footageStorage.totalStoredClips,
        storageUsedGB: Math.round(this.footageStorage.storageUsedGB * 100) / 100
      },
      privacy: {
        gdprCompliant: this.privacySettings.gdprCompliant,
        lastAudit: this.privacySettings.lastComplianceAudit,
        retentionDays: this.privacySettings.recordingRetentionDays
      },
      intervalCount: this.intervals.length
    };
  }

  // --- Coverage Map & Zone Analysis ---

  getCoverageMap() {
    const zones = [
      { id: 'zone-front', name: 'Front Yard', bounds: { north: 59.3292, south: 59.3289, east: 18.0692, west: 18.0680 }, coveredByRoutes: ['front-yard', 'perimeter-full', 'driveway-check'], coveredByDrones: ['patrol-alpha'], coveredByCameras: ['cam-front-door', 'cam-driveway'], coverageScore: 95 },
      { id: 'zone-back', name: 'Backyard', bounds: { north: 59.3298, south: 59.3294, east: 18.0692, west: 18.0682 }, coveredByRoutes: ['backyard', 'perimeter-full'], coveredByDrones: ['patrol-beta'], coveredByCameras: ['cam-backyard'], coverageScore: 88 },
      { id: 'zone-sides', name: 'Side Passages', bounds: { north: 59.3294, south: 59.3290, east: 18.0695, west: 18.0678 }, coveredByRoutes: ['perimeter-full'], coveredByDrones: ['patrol-alpha'], coveredByCameras: ['cam-side-east', 'cam-side-west'], coverageScore: 72 },
      { id: 'zone-driveway', name: 'Driveway', bounds: { north: 59.3292, south: 59.3289, east: 18.0688, west: 18.0683 }, coveredByRoutes: ['driveway-check', 'front-yard'], coveredByDrones: ['patrol-alpha'], coveredByCameras: ['cam-driveway', 'cam-garage'], coverageScore: 98 },
      { id: 'zone-indoor', name: 'Indoor', bounds: { north: 59.3295, south: 59.3292, east: 18.0689, west: 18.0684 }, coveredByRoutes: ['indoor-sweep'], coveredByDrones: ['indoor-scout'], coveredByCameras: [], coverageScore: 65 }
    ];
    const totalScore = zones.reduce((sum, z) => sum + z.coverageScore, 0) / zones.length;
    return {
      zones,
      overallCoverageScore: Math.round(totalScore),
      blindSpots: zones.filter(z => z.coverageScore < 75).map(z => z.name),
      recommendations: totalScore < 80 ? ['Consider adding patrol routes for weak zones', 'Add fixed cameras to side passages'] : ['Coverage is adequate'],
      lastCalculated: new Date().toISOString()
    };
  }

  // --- Drone Health Report ---

  getDroneHealthReport(droneId) {
    const drone = this.drones.get(droneId);
    const record = this.maintenanceRecords.get(droneId);
    if (!drone || !record) return null;
    const now = Date.now();
    const daysSinceMaintenance = (now - new Date(drone.lastMaintenance).getTime()) / 86400000;
    const propellerDaysRemaining = drone.propellerInspectionDue ? Math.max(0, (new Date(drone.propellerInspectionDue).getTime() - now) / 86400000) : 0;
    const calDaysAgo = drone.lastCalibration ? (now - new Date(drone.lastCalibration).getTime()) / 86400000 : 999;
    let overallHealth = 100;
    const issues = [];
    if (drone.batteryHealthPct < 85) { overallHealth -= 15; issues.push('Battery degradation (' + drone.batteryHealthPct + '%)'); }
    if (drone.motorHours > 400) { overallHealth -= 10; issues.push('High motor hours (' + drone.motorHours + ')'); }
    if (propellerDaysRemaining < 7) { overallHealth -= 10; issues.push('Propeller inspection soon'); }
    if (calDaysAgo > 25) { overallHealth -= 5; issues.push('Camera calibration aging'); }
    if (daysSinceMaintenance > 60) { overallHealth -= 10; issues.push('Overdue for maintenance check'); }
    if (record.spareParts.propellers < 2) { overallHealth -= 5; issues.push('Low spare propellers'); }
    if (record.spareParts.batteries < 1) { overallHealth -= 10; issues.push('No spare batteries'); }
    return {
      droneId, name: drone.name, model: drone.model,
      overallHealth: Math.max(0, overallHealth),
      batteryHealth: { healthPct: drone.batteryHealthPct, chargeCycles: drone.chargeCycles, currentLevel: drone.batteryLevel, capacityWh: drone.batteryCapacityWh },
      motors: { hours: drone.motorHours, status: drone.motorHours > 500 ? 'worn' : drone.motorHours > 300 ? 'aging' : 'good' },
      propellers: { inspectionDue: drone.propellerInspectionDue, daysRemaining: Math.round(propellerDaysRemaining), replacements: record.propellerReplacements },
      camera: { calibrated: drone.cameraCalibrated, lastCalibration: drone.lastCalibration, daysSinceCalibration: Math.round(calDaysAgo), resolution: drone.cameraResolution },
      firmware: { version: drone.firmware, updates: record.firmwareUpdates.length },
      spareParts: record.spareParts,
      lastMaintenance: drone.lastMaintenance,
      nextScheduled: record.nextScheduledMaintenance,
      daysSinceLastMaintenance: Math.round(daysSinceMaintenance),
      issues,
      recommendation: overallHealth < 60 ? 'Immediate maintenance required' : overallHealth < 80 ? 'Schedule maintenance soon' : 'Drone is in good condition'
    };
  }

  getAllDroneHealthReports() {
    return Array.from(this.drones.keys()).map(id => this.getDroneHealthReport(id));
  }

  // --- Footage Search ---

  searchFootage(query) {
    const results = {
      query, timestamp: new Date().toISOString(),
      clips: [], totalResults: 0
    };
    // Simulated footage search based on event log
    let relevantEvents = this.eventLog.filter(e => e.category === 'recording' || e.category === 'anomaly');
    if (query.droneId) relevantEvents = relevantEvents.filter(e => e.message.includes(query.droneId));
    if (query.severity) relevantEvents = relevantEvents.filter(e => e.severity === query.severity);
    if (query.startDate) {
      const start = new Date(query.startDate).getTime();
      relevantEvents = relevantEvents.filter(e => new Date(e.timestamp).getTime() >= start);
    }
    if (query.endDate) {
      const end = new Date(query.endDate).getTime();
      relevantEvents = relevantEvents.filter(e => new Date(e.timestamp).getTime() <= end);
    }
    if (query.type) relevantEvents = relevantEvents.filter(e => e.message.toLowerCase().includes(query.type.toLowerCase()));
    results.clips = relevantEvents.slice(0, query.limit || 50).map(e => ({
      eventId: e.id, timestamp: e.timestamp, category: e.category,
      severity: e.severity, description: e.message,
      thumbnailAvailable: true, downloadable: true
    }));
    results.totalResults = relevantEvents.length;
    this.footageStorage.accessLog.push({ action: 'search', query: JSON.stringify(query), accessTime: new Date().toISOString(), resultsCount: results.totalResults });
    return results;
  }

  // --- Patrol History ---

  getPatrolHistory(routeId, limit) {
    const route = this.patrolRoutes.get(routeId);
    if (!route) return null;
    const history = this.eventLog.filter(e => e.category === 'patrol' && e.message.includes(routeId));
    return {
      routeId, routeName: route.name,
      totalCompletions: route.timesCompleted,
      lastCompleted: route.lastCompleted,
      assignedDrone: route.droneAssignment,
      frequency: route.frequency,
      enabled: route.enabled,
      recentHistory: history.slice(-(limit || 20)).map(e => ({
        timestamp: e.timestamp, message: e.message, severity: e.severity
      })),
      averageCompletionRate: route.timesCompleted > 0 ? Math.round(route.timesCompleted / Math.max(1, (Date.now() - (route.lastCompleted ? new Date(route.lastCompleted).getTime() : Date.now())) / 3600000) * 100) / 100 : 0
    };
  }

  // --- System Configuration Export/Import ---

  exportConfiguration() {
    return {
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
      scheduling: { ...this.schedulingConfig },
      privacy: { ...this.privacySettings },
      routes: Array.from(this.patrolRoutes.values()).map(r => ({
        id: r.id, name: r.name, frequency: r.frequency, enabled: r.enabled,
        droneAssignment: r.droneAssignment, waypoints: r.waypoints
      })),
      noFlyZones: this.noFlyZones.map(z => ({ id: z.id, name: z.name, enforced: z.enforced, boundary: z.boundary, altitudeMaxM: z.altitudeMaxM })),
      landingPads: Array.from(this.landingPads.values()).map(p => ({ id: p.id, name: p.name, location: p.location, chargeRateW: p.chargeRateW }))
    };
  }

  importSchedulingConfig(config) {
    if (!config || typeof config !== 'object') {
      this.homey.error('[SecurityDrone] Invalid config import');
      return false;
    }
    if (config.scheduling) this.updateSchedulingConfig(config.scheduling);
    if (config.routes) {
      for (const routeConfig of config.routes) {
        const route = this.patrolRoutes.get(routeConfig.id);
        if (route) {
          if (routeConfig.frequency) route.frequency = routeConfig.frequency;
          if (routeConfig.enabled !== undefined) route.enabled = routeConfig.enabled;
        }
      }
    }
    this._logEvent('config', 'info', 'Configuration imported');
    this.homey.log('[SecurityDrone] Configuration imported');
    return true;
  }

  // --- Landing Pad Status ---

  getLandingPadStatus(padId) {
    const pad = this.landingPads.get(padId);
    if (!pad) return null;
    return {
      id: pad.id, name: pad.name, location: pad.location, type: pad.type,
      status: pad.status, weatherProtected: pad.weatherProtected,
      chargeRateW: pad.chargeRateW, currentDrone: pad.currentDrone,
      snowIceDetected: pad.snowIceDetected,
      coordinates: { lat: pad.lat, lng: pad.lng },
      operational: pad.status !== 'error' && (!pad.snowIceDetected || pad.weatherProtected)
    };
  }

  getAllLandingPadStatuses() {
    return Array.from(this.landingPads.keys()).map(id => this.getLandingPadStatus(id));
  }

  // --- No-Fly Zone Management ---

  getNoFlyZones() {
    return this.noFlyZones.map(z => ({
      id: z.id, name: z.name, type: z.type,
      enforced: z.enforced, reason: z.reason,
      altitudeMaxM: z.altitudeMaxM,
      boundaryPointCount: z.boundary.length
    }));
  }

  toggleNoFlyZone(zoneId, enforced) {
    const zone = this.noFlyZones.find(z => z.id === zoneId);
    if (!zone) return false;
    zone.enforced = enforced;
    this._logEvent('geofence', 'info', 'NFZ ' + zoneId + ' enforced=' + enforced);
    this.homey.log('[SecurityDrone] NFZ toggled: ' + zoneId + ' enforced=' + enforced);
    this.homey.emit('nfz-updated', { zoneId, enforced });
    return true;
  }

  // --- System Reset ---

  resetAnalytics() {
    this.analytics = {
      totalFlightHours: 0, totalAreaCoveredKm2: 0,
      anomaliesDetectedMonth: 0, avgResponseTimeSec: 0,
      falsePositiveRate: 0.05, monthStartDate: new Date().toISOString()
    };
    this._logEvent('system', 'info', 'Analytics reset');
    this.homey.log('[SecurityDrone] Analytics reset');
    return true;
  }

  clearEventLog() {
    const count = this.eventLog.length;
    this.eventLog = [];
    this.homey.log('[SecurityDrone] Event log cleared (' + count + ' entries)');
    return { cleared: count };
  }

  // --- Destroy ---

  destroy() {
    for (const i of this.intervals) clearInterval(i);
    this.intervals = [];
    for (const [feedId] of this.liveFeeds) this.stopLiveFeed(feedId);
    for (const [, drone] of this.drones) {
      if (drone.status === 'patrolling' || drone.status === 'launching' || drone.status === 'returning') {
        drone.status = 'docked';
        drone.speed = 0;
        drone.recording = false;
        drone.currentRoute = null;
      }
    }
    if (this.manualControl.active) {
      this.manualControl = { active: false, droneId: null, mode: null, operator: null };
    }
    this.initialized = false;
    this.homey.log('[SecurityDrone] destroyed');
  }
}

module.exports = HomeSecurityDroneSystem;
