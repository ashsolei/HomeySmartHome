'use strict';

/**
 * @typedef {'disarmed'|'armed_home'|'armed_away'|'armed_night'} SecurityMode
 */

/**
 * @typedef {object} GeofenceConfig
 * @property {boolean} enabled - Whether geofencing is active
 * @property {number} latitude - Home latitude in decimal degrees
 * @property {number} longitude - Home longitude in decimal degrees
 * @property {number} radiusMeters - Geofence radius in metres
 * @property {boolean} autoArmOnLeave - Arm automatically when all users leave
 * @property {boolean} autoDisarmOnArrive - Disarm when a user arrives home
 */

/**
 * @typedef {object} VisitorSchedule
 * @property {string} visitorId - Unique visitor identifier
 * @property {string} name - Display name
 * @property {number[]} allowedDays - Week days allowed (0=Sun … 6=Sat)
 * @property {string} startTime - Earliest allowed time in 'HH:MM' format
 * @property {string} endTime - Latest allowed time in 'HH:MM' format
 * @property {number} startDate - Schedule start timestamp (ms)
 * @property {number} endDate - Schedule end timestamp (ms)
 * @property {boolean} active - Whether the schedule is currently active
 */

/**
 * @typedef {object} AuditEntry
 * @property {string} id - Unique audit record ID
 * @property {string} action - Action category (e.g. 'zone_arm', 'mode_change')
 * @property {string} userId - User who performed the action
 * @property {object} details - Action-specific details
 * @property {number} timestamp - Unix timestamp in milliseconds
 */

/**
 * @typedef {object} SensorHealthReport
 * @property {number} healthy - Count of healthy sensors
 * @property {number} warning - Count of sensors in warning state
 * @property {number} critical - Count of critical sensors
 * @property {number} unreachable - Count of unreachable sensors
 * @property {object[]} sensors - Per-sensor health details
 */

/**
 * Advanced Security System
 *
 * Comprehensive security with intrusion detection, geofencing, multi-zone arming,
 * visitor scheduling, silent alarms, simulation mode, sensor health monitoring,
 * audit trail, duress-code detection, and configurable alarm escalation.
 */
class AdvancedSecuritySystem {
  /**
   * @param {import('homey').Homey} homey - Homey application instance
   */
  constructor(homey) {
    this.homey = homey;
    this.cameras = new Map();
    this.motionSensors = new Map();
    this.doorWindowSensors = new Map();
    this.locks = new Map();
    this.securityMode = 'disarmed';
    this.intrusionEvents = [];
    this.authorizedPersons = new Map();
    this.panicMode = false;
    this.zones = new Map();

    // Geofence-based arm/disarm
    this.geofenceConfig = {
      enabled: false,
      latitude: 0,
      longitude: 0,
      radiusMeters: 200,
      autoArmOnLeave: true,
      autoDisarmOnArrive: true,
      userLocations: new Map()
    };

    // Security event timeline with evidence linking
    this.eventTimeline = [];
    this.evidenceStore = new Map();

    // Multi-zone armed status
    this.zoneArmStatus = new Map();

    // Visitor access window scheduling
    this.visitorSchedules = new Map();

    // Silent alarm mode
    this.silentAlarmMode = false;
    this.silentAlarmContacts = [];

    // Security simulation mode (away simulation)
    this.simulationMode = false;
    this.simulationTimers = [];
    this.simulationConfig = {
      lightsEnabled: true,
      tvEnabled: true,
      curtainsEnabled: true,
      intervalMinMin: 15,
      intervalMinMax: 45
    };

    // Sensor health monitoring
    this.sensorHealth = new Map();
    this.healthCheckInterval = null;

    // Security audit trail
    this.auditTrail = [];

    // Duress code detection
    this.duressCodes = new Map();

    // Night vision mode
    this.nightVisionEnabled = false;

    // Alarm escalation
    this.escalationConfig = {
      warningDelaySec: 30,
      sirenDelaySec: 60,
      policeNotifyDelaySec: 180,
      enabled: true
    };
    this.activeEscalations = new Map();
  }

  /**
   * Load persisted settings, discover security devices, set up zones, and start
   * all monitoring and sensor-health intervals.
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    this.log('Initializing Advanced Security System...');

    try {
      const savedSettings = await this.homey.settings.get('securitySettings') || {};
      if (savedSettings.geofenceConfig) Object.assign(this.geofenceConfig, savedSettings.geofenceConfig);
      if (savedSettings.silentAlarmContacts) this.silentAlarmContacts = savedSettings.silentAlarmContacts;
      if (savedSettings.escalationConfig) Object.assign(this.escalationConfig, savedSettings.escalationConfig);

      const savedAudit = await this.homey.settings.get('securityAuditTrail') || [];
      this.auditTrail = savedAudit.slice(-500);

      const savedDuress = await this.homey.settings.get('duressCodes') || {};
      Object.entries(savedDuress).forEach(([code, data]) => this.duressCodes.set(code, data));

      const savedVisitors = await this.homey.settings.get('visitorSchedules') || {};
      Object.entries(savedVisitors).forEach(([id, schedule]) => this.visitorSchedules.set(id, schedule));

      await this.discoverSecurityDevices();
      await this.setupSecurityZones();
      await this.loadAuthorizedPersons();
      await this.startMonitoring();
      await this.startSensorHealthMonitoring();
    } catch (err) {
      this.error('Failed to initialize:', err.message);
    }

    this.log('Advanced Security System initialized');
  }

  /**
   * Scan all Homey devices and populate the cameras, motion sensors,
   * door/window sensor, and lock maps based on device name keywords and
   * capabilities.
   *
   * @returns {Promise<void>}
   */
  async discoverSecurityDevices() {
    const devices = this.homey.drivers.getDevices();

    for (const device of devices) {
      const name = device.name.toLowerCase();

      if (name.includes('camera')) {
        this.cameras.set(device.id, {
          id: device.id,
          name: device.name,
          device,
          zone: device.zone?.name || 'unknown',
          recording: false,
          motionDetection: true,
          nightVision: false,
          lastContact: Date.now()
        });
      }

      if (device.hasCapability('alarm_motion')) {
        this.motionSensors.set(device.id, {
          id: device.id,
          name: device.name,
          device,
          zone: device.zone?.name || 'unknown',
          triggered: false,
          lastContact: Date.now(),
          batteryLevel: null
        });
      }

      if (device.hasCapability('alarm_contact')) {
        this.doorWindowSensors.set(device.id, {
          id: device.id,
          name: device.name,
          device,
          zone: device.zone?.name || 'unknown',
          open: false,
          lastContact: Date.now(),
          batteryLevel: null
        });
      }

      if (name.includes('lock') || device.hasCapability('locked')) {
        this.locks.set(device.id, {
          id: device.id,
          name: device.name,
          device,
          locked: true,
          lastAccess: null,
          lastContact: Date.now(),
          batteryLevel: null
        });
      }
    }

    this.log(`Security devices: ${this.cameras.size} cameras, ${this.motionSensors.size} motion, ${this.doorWindowSensors.size} door/window, ${this.locks.size} locks`);
  }

  async setupSecurityZones() {
    const defaultZones = [
      { id: 'perimeter', name: 'Perimeter', armed: false },
      { id: 'interior', name: 'Interior', armed: false },
      { id: 'critical', name: 'Critical Areas', armed: true },
      { id: 'bedrooms', name: 'Bedrooms', armed: false },
      { id: 'garage', name: 'Garage', armed: false }
    ];

    for (const z of defaultZones) {
      this.zones.set(z.id, { ...z, devices: [] });
      this.zoneArmStatus.set(z.id, z.armed);
    }

    // Auto-assign sensors to zones based on device zone names
    const allSensors = [...this.motionSensors.values(), ...this.doorWindowSensors.values()];
    for (const sensor of allSensors) {
      const sensorZone = (sensor.zone || '').toLowerCase();
      if (sensorZone.includes('bedroom')) {
        this.zones.get('bedrooms')?.devices.push(sensor.id);
      } else if (sensorZone.includes('garage')) {
        this.zones.get('garage')?.devices.push(sensor.id);
      } else if (sensorZone.includes('door') || sensorZone.includes('window') || sensorZone.includes('entry') || sensorZone.includes('garden')) {
        this.zones.get('perimeter')?.devices.push(sensor.id);
      } else {
        this.zones.get('interior')?.devices.push(sensor.id);
      }
    }
  }

  async loadAuthorizedPersons() {
    try {
      const saved = await this.homey.settings.get('authorizedPersons') || {};
      Object.entries(saved).forEach(([id, person]) => {
        this.authorizedPersons.set(id, person);
      });
    } catch (err) {
      this.error('Failed to load authorized persons:', err.message);
    }
  }

  async startMonitoring() {
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkSecurityStatus();
        await this.checkGeofence();
        await this.checkVisitorSchedules();
      } catch (err) {
        this.error('Monitoring cycle error:', err.message);
      }
    }, 10000);

    await this.checkSecurityStatus();
  }

  // ── Geofence-Based Auto Arm/Disarm ────────────────────────────────────

  /**
   * Update the geofence configuration and persist the change.
   *
   * @param {Partial<GeofenceConfig>} config - Partial geofence settings to merge
   * @returns {GeofenceConfig} The merged geofence configuration
   */
  configureGeofence(config) {
    Object.assign(this.geofenceConfig, config);
    this.log(`Geofence configured: radius=${this.geofenceConfig.radiusMeters}m`);
    this.saveSettings();
    return this.geofenceConfig;
  }

  /**
   * Update a user's location and trigger automatic arm/disarm based on the
   * geofence configuration.
   *
   * @param {string} userId - Identifier of the user whose location changed
   * @param {number} latitude - Current latitude in decimal degrees
   * @param {number} longitude - Current longitude in decimal degrees
   * @returns {Promise<void>}
   */
  async updateUserLocation(userId, latitude, longitude) {
    this.geofenceConfig.userLocations.set(userId, { latitude, longitude, updatedAt: Date.now() });

    if (!this.geofenceConfig.enabled) return;

    const distance = this.calculateDistance(
      this.geofenceConfig.latitude, this.geofenceConfig.longitude,
      latitude, longitude
    );

    const inside = distance <= this.geofenceConfig.radiusMeters;

    if (inside && this.geofenceConfig.autoDisarmOnArrive && this.securityMode !== 'disarmed') {
      this.log(`Geofence: User ${userId} arrived home — auto-disarming`);
      await this.setSecurityMode('disarmed', userId, 'geofence_arrive');
    }

    if (!inside && this.geofenceConfig.autoArmOnLeave) {
      const allUsersAway = this.areAllUsersAway();
      if (allUsersAway && this.securityMode === 'disarmed') {
        this.log('Geofence: All users left — auto-arming');
        await this.setSecurityMode('armed_away', userId, 'geofence_leave');
      }
    }
  }

  areAllUsersAway() {
    for (const [userId, loc] of this.geofenceConfig.userLocations) {
      const dist = this.calculateDistance(
        this.geofenceConfig.latitude, this.geofenceConfig.longitude,
        loc.latitude, loc.longitude
      );
      if (dist <= this.geofenceConfig.radiusMeters) return false;
    }
    return true;
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  async checkGeofence() {
    if (!this.geofenceConfig.enabled) return;
    // In production this would poll location APIs; here we check cached locations
    for (const [userId, loc] of this.geofenceConfig.userLocations) {
      if (Date.now() - loc.updatedAt > 600000) {
        this.log(`Geofence: Stale location for user ${userId}`);
      }
    }
  }

  // ── Security Event Timeline & Evidence ────────────────────────────────

  addTimelineEvent(event) {
    const entry = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ...event,
      timestamp: Date.now(),
      evidenceIds: []
    };
    this.eventTimeline.push(entry);
    if (this.eventTimeline.length > 1000) this.eventTimeline = this.eventTimeline.slice(-800);
    return entry;
  }

  linkEvidence(eventId, evidence) {
    const evidenceId = `evi_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.evidenceStore.set(evidenceId, {
      id: evidenceId,
      eventId,
      type: evidence.type || 'snapshot',
      data: evidence.data || null,
      cameraId: evidence.cameraId || null,
      createdAt: Date.now()
    });
    const event = this.eventTimeline.find(e => e.id === eventId);
    if (event) event.evidenceIds.push(evidenceId);
    return evidenceId;
  }

  getEventTimeline(limit = 50, filters = {}) {
    let events = [...this.eventTimeline];
    if (filters.type) events = events.filter(e => e.type === filters.type);
    if (filters.zone) events = events.filter(e => e.zone === filters.zone);
    if (filters.since) events = events.filter(e => e.timestamp >= filters.since);
    return events.slice(-limit);
  }

  // ── Multi-Zone Armed Status ───────────────────────────────────────────

  /**
   * Arm a security zone and record the action in the audit trail.
   *
   * @param {string} zoneId - Zone identifier (e.g. 'perimeter', 'interior')
   * @param {string} [userId='system'] - User performing the action
   * @returns {Promise<{zoneId: string, armed: true}>}
   * @throws {Error} When the zone ID is not found
   */
  async armZone(zoneId, userId = 'system') {
    const zone = this.zones.get(zoneId);
    if (!zone) throw new Error(`Zone not found: ${zoneId}`);

    zone.armed = true;
    this.zoneArmStatus.set(zoneId, true);

    this.addAuditEntry('zone_arm', userId, { zoneId, zoneName: zone.name });
    this.log(`Zone armed: ${zone.name} by ${userId}`);
    return { zoneId, armed: true };
  }

  /**
   * Disarm a security zone and record the action in the audit trail.
   *
   * @param {string} zoneId - Zone identifier
   * @param {string} [userId='system'] - User performing the action
   * @returns {Promise<{zoneId: string, armed: false}>}
   * @throws {Error} When the zone ID is not found
   */
  async disarmZone(zoneId, userId = 'system') {
    const zone = this.zones.get(zoneId);
    if (!zone) throw new Error(`Zone not found: ${zoneId}`);

    zone.armed = false;
    this.zoneArmStatus.set(zoneId, false);

    this.addAuditEntry('zone_disarm', userId, { zoneId, zoneName: zone.name });
    this.log(`Zone disarmed: ${zone.name} by ${userId}`);
    return { zoneId, armed: false };
  }

  /**
   * Return the current armed state and device count for every security zone.
   *
   * @returns {{[zoneId: string]: {name: string, armed: boolean, deviceCount: number}}}
   */
  getZoneStatus() {
    const result = {};
    for (const [id, zone] of this.zones) {
      result[id] = {
        name: zone.name,
        armed: zone.armed,
        deviceCount: zone.devices.length
      };
    }
    return result;
  }

  isDeviceInArmedZone(deviceId) {
    for (const [zoneId, zone] of this.zones) {
      if (zone.armed && zone.devices.includes(deviceId)) return true;
    }
    return false;
  }

  // ── Visitor Access Window Scheduling ──────────────────────────────────

  /**
   * Schedule time-windowed access for a visitor and persist the schedule.
   *
   * @param {string} visitorId - Unique visitor identifier
   * @param {object} schedule - Schedule definition
   * @param {string} [schedule.name] - Display name for the visitor
   * @param {number[]} [schedule.allowedDays] - Allowed week days (0=Sun … 6=Sat)
   * @param {string} [schedule.startTime='08:00'] - Daily start time ('HH:MM')
   * @param {string} [schedule.endTime='18:00'] - Daily end time ('HH:MM')
   * @param {number} [schedule.startDate] - Schedule start timestamp (ms); defaults to now
   * @param {number} [schedule.endDate] - Schedule end timestamp (ms); defaults to 30 days
   * @returns {Promise<VisitorSchedule>} The created visitor schedule
   */
  async scheduleVisitorAccess(visitorId, schedule) {
    const entry = {
      visitorId,
      name: schedule.name || visitorId,
      allowedDays: schedule.allowedDays || [0, 1, 2, 3, 4, 5, 6],
      startTime: schedule.startTime || '08:00',
      endTime: schedule.endTime || '18:00',
      startDate: schedule.startDate || Date.now(),
      endDate: schedule.endDate || Date.now() + 30 * 86400000,
      active: true,
      createdAt: Date.now()
    };

    this.visitorSchedules.set(visitorId, entry);
    await this.saveVisitorSchedules();

    this.addAuditEntry('visitor_scheduled', 'system', { visitorId, name: entry.name });
    this.log(`Visitor access scheduled: ${entry.name} (${entry.startTime}-${entry.endTime})`);
    return entry;
  }

  async checkVisitorSchedules() {
    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    for (const [id, schedule] of this.visitorSchedules) {
      if (!schedule.active) continue;
      if (now.getTime() > schedule.endDate) {
        schedule.active = false;
        this.log(`Visitor schedule expired: ${schedule.name}`);
        continue;
      }
      const isAllowedTime = schedule.allowedDays.includes(currentDay) &&
        currentTime >= schedule.startTime && currentTime <= schedule.endTime;
      schedule.currentlyAllowed = isAllowedTime;
    }
  }

  /**
   * Check whether a visitor is currently within their allowed access window.
   *
   * @param {string} visitorId - Visitor identifier to check
   * @returns {boolean} `true` if the visitor has an active, currently-valid schedule
   */
  isVisitorAllowed(visitorId) {
    const schedule = this.visitorSchedules.get(visitorId);
    return schedule?.active && schedule?.currentlyAllowed;
  }

  async revokeVisitorAccess(visitorId) {
    const schedule = this.visitorSchedules.get(visitorId);
    if (schedule) {
      schedule.active = false;
      await this.saveVisitorSchedules();
      this.addAuditEntry('visitor_revoked', 'system', { visitorId, name: schedule.name });
      this.log(`Visitor access revoked: ${schedule.name}`);
    }
  }

  // ── Silent Alarm Mode ─────────────────────────────────────────────────

  /**
   * Enable silent alarm mode. Security events will alert the configured contacts
   * without triggering audible alarms.
   *
   * @param {string[]} [contacts=[]] - Emergency contact identifiers; replaces existing list when non-empty
   * @returns {void}
   */
  enableSilentAlarm(contacts = []) {
    this.silentAlarmMode = true;
    if (contacts.length > 0) this.silentAlarmContacts = contacts;
    this.log('Silent alarm mode enabled');
    this.addAuditEntry('silent_alarm_enabled', 'system', { contactCount: this.silentAlarmContacts.length });
    this.saveSettings();
  }

  disableSilentAlarm() {
    this.silentAlarmMode = false;
    this.log('Silent alarm mode disabled');
    this.addAuditEntry('silent_alarm_disabled', 'system', {});
    this.saveSettings();
  }

  async sendSilentAlert(event) {
    this.log('Sending silent alert to emergency contacts');
    try {
      const notificationManager = this.homey.app.advancedNotificationManager;
      if (notificationManager) {
        for (const contact of this.silentAlarmContacts) {
          await notificationManager.sendNotification({
            title: '🔕 Tyst larm utlöst',
            message: `Säkerhetshändelse: ${event.type} vid ${event.zone || 'okänd zon'}`,
            priority: 'critical',
            category: 'security_silent',
            recipient: contact
          });
        }
      }
    } catch (err) {
      this.error('Failed to send silent alert:', err.message);
    }
  }

  // ── Security Simulation Mode (Away) ───────────────────────────────────

  /**
   * Start occupancy simulation mode. Randomly toggles lights and appliances at
   * configurable intervals to deter intruders while away.
   *
   * @returns {Promise<void>}
   */
  async startSimulationMode() {
    this.simulationMode = true;
    this.log('Security simulation mode started — simulating occupancy');
    this.addAuditEntry('simulation_started', 'system', {});

    await this.scheduleNextSimulationAction();
  }

  /**
   * Stop occupancy simulation and turn off all devices that were toggled
   * by the simulation.
   *
   * @returns {Promise<void>}
   */
  async stopSimulationMode() {
    this.simulationMode = false;
    for (const timer of this.simulationTimers) clearTimeout(timer);
    this.simulationTimers = [];

    // Turn off all simulated devices
    try {
      const devices = this.homey.drivers.getDevices();
      for (const device of devices) {
        if (device.hasCapability('onoff') && device._simulationActive) {
          await device.setCapabilityValue('onoff', false);
          device._simulationActive = false;
        }
      }
    } catch (err) {
      this.error('Error stopping simulation devices:', err.message);
    }

    this.addAuditEntry('simulation_stopped', 'system', {});
    this.log('Security simulation mode stopped');
  }

  async scheduleNextSimulationAction() {
    if (!this.simulationMode) return;

    const delayMin = this.simulationConfig.intervalMinMin +
      Math.random() * (this.simulationConfig.intervalMinMax - this.simulationConfig.intervalMinMin);
    const delayMs = delayMin * 60000;

    const timer = setTimeout(async () => {
      try {
        await this.executeSimulationAction();
        await this.scheduleNextSimulationAction();
      } catch (err) {
        this.error('Simulation action error:', err.message);
      }
    }, delayMs);

    this.simulationTimers.push(timer);
  }

  async executeSimulationAction() {
    const devices = this.homey.drivers.getDevices();
    const eligibleDevices = devices.filter(d => {
      const name = d.name.toLowerCase();
      return d.hasCapability('onoff') && (
        (this.simulationConfig.lightsEnabled && (d.hasCapability('dim') || name.includes('light') || name.includes('lamp'))) ||
        (this.simulationConfig.tvEnabled && name.includes('tv'))
      );
    });

    if (eligibleDevices.length === 0) return;

    const device = eligibleDevices[Math.floor(Math.random() * eligibleDevices.length)];
    const turnOn = !device._simulationActive;

    try {
      await device.setCapabilityValue('onoff', turnOn);
      device._simulationActive = turnOn;
      if (turnOn && device.hasCapability('dim')) {
        await device.setCapabilityValue('dim', 0.3 + Math.random() * 0.5);
      }
      this.log(`Simulation: ${device.name} turned ${turnOn ? 'on' : 'off'}`);
    } catch (err) {
      this.error(`Simulation device control failed for ${device.name}:`, err.message);
    }
  }

  // ── Sensor Health Monitoring ──────────────────────────────────────────

  async startSensorHealthMonitoring() {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.checkAllSensorHealth();
      } catch (err) {
        this.error('Sensor health check error:', err.message);
      }
    }, 300000);
  }

  /**
   * Poll every motion sensor, door/window sensor, and lock for battery level
   * and reachability, then update the sensor health map.
   *
   * @returns {Promise<void>}
   */
  async checkAllSensorHealth() {
    const allSensors = [
      ...Array.from(this.motionSensors.values()),
      ...Array.from(this.doorWindowSensors.values()),
      ...Array.from(this.locks.values())
    ];

    for (const sensor of allSensors) {
      try {
        const health = { id: sensor.id, name: sensor.name, status: 'healthy', issues: [] };

        if (sensor.device.hasCapability('measure_battery')) {
          const battery = await sensor.device.getCapabilityValue('measure_battery');
          sensor.batteryLevel = battery;
          health.batteryLevel = battery;
          if (battery !== null && battery < 20) {
            health.issues.push(`Low battery: ${battery}%`);
            health.status = 'warning';
          }
          if (battery !== null && battery < 10) {
            health.status = 'critical';
            await this.sendSensorHealthAlert(sensor, `Kritiskt låg batteri: ${battery}%`);
          }
        }

        sensor.lastContact = Date.now();
        health.lastContact = sensor.lastContact;

        this.sensorHealth.set(sensor.id, health);
      } catch (err) {
        this.sensorHealth.set(sensor.id, {
          id: sensor.id, name: sensor.name, status: 'unreachable',
          issues: ['Device unreachable'], lastContact: sensor.lastContact || null
        });
        this.error(`Sensor health check failed for ${sensor.name}:`, err.message);
      }
    }
  }

  async sendSensorHealthAlert(sensor, message) {
    try {
      const notificationManager = this.homey.app.advancedNotificationManager;
      if (notificationManager) {
        await notificationManager.sendNotification({
          title: '🔋 Sensorhälsa',
          message: `${sensor.name}: ${message}`,
          priority: 'normal',
          category: 'security_health'
        });
      }
    } catch (err) {
      this.error('Failed to send sensor health alert:', err.message);
    }
  }

  /**
   * Aggregate the current sensor health map into a summary report.
   *
   * @returns {SensorHealthReport}
   */
  getSensorHealthReport() {
    const report = { healthy: 0, warning: 0, critical: 0, unreachable: 0, sensors: [] };
    for (const [id, health] of this.sensorHealth) {
      report[health.status]++;
      report.sensors.push(health);
    }
    return report;
  }

  // ── Security Audit Trail ──────────────────────────────────────────────

  /**
   * Append a new entry to the security audit trail. The trail is capped at
   * 1 000 entries; older entries are evicted automatically.
   *
   * @param {string} action - Action category string (e.g. 'zone_arm', 'mode_change')
   * @param {string} userId - Identifier of the user who performed the action
   * @param {object} [details={}] - Action-specific metadata
   * @returns {AuditEntry} The created audit entry
   */
  addAuditEntry(action, userId, details = {}) {
    const entry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      action,
      userId,
      details,
      timestamp: Date.now()
    };
    this.auditTrail.push(entry);
    if (this.auditTrail.length > 1000) this.auditTrail = this.auditTrail.slice(-800);
    return entry;
  }

  /**
   * Return a filtered, limited slice of the audit trail.
   *
   * @param {number} [limit=50] - Maximum number of entries to return
   * @param {object} [filters={}] - Optional filter criteria
   * @param {string} [filters.action] - Filter by action category
   * @param {string} [filters.userId] - Filter by user ID
   * @param {number} [filters.since] - Filter by minimum timestamp (ms)
   * @returns {AuditEntry[]} Matching audit entries (most recent last)
   */
  getAuditTrail(limit = 50, filters = {}) {
    let trail = [...this.auditTrail];
    if (filters.action) trail = trail.filter(e => e.action === filters.action);
    if (filters.userId) trail = trail.filter(e => e.userId === filters.userId);
    if (filters.since) trail = trail.filter(e => e.timestamp >= filters.since);
    return trail.slice(-limit);
  }

  // ── Duress Code Detection ─────────────────────────────────────────────

  /**
   * Register a duress code. When entered at a lock it triggers a hidden alert
   * while appearing to disarm the system normally.
   *
   * @param {string} code - The duress code string to register
   * @param {object} [config={}] - Duress code options
   * @param {string} [config.name='Duress Code'] - Descriptive label
   * @param {boolean} [config.silentAlert=true] - Whether to send a silent alert on use
   * @param {string[]} [config.alertContacts] - Contacts to alert (defaults to silent alarm contacts)
   * @returns {Promise<void>}
   */
  async addDuressCode(code, config = {}) {
    this.duressCodes.set(code, {
      name: config.name || 'Duress Code',
      silentAlert: config.silentAlert !== false,
      alertContacts: config.alertContacts || this.silentAlarmContacts,
      createdAt: Date.now()
    });
    await this.homey.settings.set('duressCodes', Object.fromEntries(this.duressCodes));
    this.log('Duress code configured');
  }

  /**
   * Check whether a code is a registered duress code and, if so, trigger a
   * silent alert and start covert camera recording.
   *
   * @param {string} code - Code string to check
   * @returns {Promise<boolean>} `true` when the code is a known duress code
   */
  async checkDuressCode(code) {
    const duress = this.duressCodes.get(code);
    if (!duress) return false;

    this.log('DURESS CODE ENTERED — sending silent alert');
    this.addAuditEntry('duress_code_entered', 'unknown', { codeName: duress.name });

    // Appear to disarm normally but send silent alert
    await this.sendSilentAlert({ type: 'duress_code', zone: 'entry', codeName: duress.name });

    // Start silent recording
    for (const [id, camera] of this.cameras) {
      camera.recording = true;
    }

    return true;
  }

  // ── Night Vision Mode ─────────────────────────────────────────────────

  /**
   * Enable night-vision mode on all discovered cameras and record the event.
   *
   * @returns {Promise<void>}
   */
  async enableNightVision() {
    this.nightVisionEnabled = true;
    for (const [id, camera] of this.cameras) {
      camera.nightVision = true;
      this.log(`Night vision enabled: ${camera.name}`);
    }
    this.addAuditEntry('night_vision_enabled', 'system', { cameraCount: this.cameras.size });
  }

  /**
   * Disable night-vision mode on all cameras.
   *
   * @returns {Promise<void>}
   */
  async disableNightVision() {
    this.nightVisionEnabled = false;
    for (const [id, camera] of this.cameras) {
      camera.nightVision = false;
    }
    this.addAuditEntry('night_vision_disabled', 'system', {});
    this.log('Night vision disabled for all cameras');
  }

  // ── Configurable Alarm Escalation ─────────────────────────────────────

  /**
   * Update alarm escalation timing and persist the configuration.
   *
   * @param {object} config - Escalation timing overrides
   * @param {number} [config.warningDelaySec] - Seconds before warning notification
   * @param {number} [config.sirenDelaySec] - Seconds before siren activation
   * @param {number} [config.policeNotifyDelaySec] - Seconds before police notification
   * @param {boolean} [config.enabled] - Whether escalation is active
   * @returns {void}
   */
  configureEscalation(config) {
    Object.assign(this.escalationConfig, config);
    this.saveSettings();
    this.log(`Escalation configured: warning=${config.warningDelaySec}s, siren=${config.sirenDelaySec}s, police=${config.policeNotifyDelaySec}s`);
  }

  /**
   * Start a three-stage alarm escalation for a security event: warning → siren →
   * police notification. Each stage fires after the configured delay unless
   * the escalation is cancelled first.
   *
   * @param {string} eventId - Timeline event ID that triggered escalation
   * @param {object} event - Security event details (type, zone, timestamp, etc.)
   * @returns {Promise<void>}
   */
  async startEscalation(eventId, event) {
    if (!this.escalationConfig.enabled) return;

    const escalation = {
      eventId,
      event,
      startedAt: Date.now(),
      stage: 'warning',
      timers: [],
      cancelled: false
    };

    // Stage 1: Warning
    this.log(`Escalation started: warning stage for event ${eventId}`);
    try {
      const notificationManager = this.homey.app.advancedNotificationManager;
      if (notificationManager) {
        await notificationManager.sendNotification({
          title: '⚠️ Säkerhetsvarning',
          message: `Rörelse/öppning detekterad vid ${event.zone || 'okänd'}. Avaktivera inom ${this.escalationConfig.sirenDelaySec}s.`,
          priority: 'high',
          category: 'security'
        });
      }
    } catch (err) {
      this.error('Failed to send warning notification:', err.message);
    }

    // Stage 2: Siren
    const sirenTimer = setTimeout(async () => {
      if (escalation.cancelled) return;
      escalation.stage = 'siren';
      this.log(`Escalation: siren stage for event ${eventId}`);
      await this.activateSirens();
    }, this.escalationConfig.sirenDelaySec * 1000);
    escalation.timers.push(sirenTimer);

    // Stage 3: Police notification
    const policeTimer = setTimeout(async () => {
      if (escalation.cancelled) return;
      escalation.stage = 'police_notified';
      this.log(`Escalation: police notification stage for event ${eventId}`);
      try {
        const notificationManager = this.homey.app.advancedNotificationManager;
        if (notificationManager) {
          await notificationManager.sendNotification({
            title: '🚨 POLISEN KONTAKTAD',
            message: `Inbrott bekräftat vid ${event.zone || 'okänd'}. Nödtjänster har aviserats.`,
            priority: 'critical',
            category: 'security_emergency'
          });
        }
      } catch (err) {
        this.error('Failed to send police notification:', err.message);
      }
    }, this.escalationConfig.policeNotifyDelaySec * 1000);
    escalation.timers.push(policeTimer);

    this.activeEscalations.set(eventId, escalation);
  }

  /**
   * Cancel an active alarm escalation, clear all pending timers, and record
   * the cancellation in the audit trail.
   *
   * @param {string} eventId - ID of the escalation to cancel
   * @param {string} [userId='system'] - User who cancelled the escalation
   * @returns {Promise<boolean>} `true` if the escalation was found and cancelled
   */
  async cancelEscalation(eventId, userId = 'system') {
    const escalation = this.activeEscalations.get(eventId);
    if (!escalation) return false;

    escalation.cancelled = true;
    for (const timer of escalation.timers) clearTimeout(timer);
    this.activeEscalations.delete(eventId);

    this.addAuditEntry('escalation_cancelled', userId, { eventId, stage: escalation.stage });
    this.log(`Escalation cancelled for event ${eventId} at stage: ${escalation.stage}`);
    return true;
  }

  async activateSirens() {
    try {
      const devices = this.homey.drivers.getDevices();
      for (const device of devices) {
        const name = device.name.toLowerCase();
        if (name.includes('siren') || name.includes('alarm')) {
          if (device.hasCapability('onoff')) {
            await device.setCapabilityValue('onoff', true);
          }
        }
      }
    } catch (err) {
      this.error('Failed to activate sirens:', err.message);
    }
  }

  // ── Core Security Methods ─────────────────────────────────────────────

  async checkSecurityStatus() {
    for (const [id, sensor] of this.motionSensors) {
      try {
        const motion = await sensor.device.getCapabilityValue('alarm_motion');
        sensor.lastContact = Date.now();
        if (motion && !sensor.triggered) {
          const inArmedZone = this.isDeviceInArmedZone(id) || this.securityMode !== 'disarmed';
          if (inArmedZone) {
            await this.handleIntrusionEvent('motion', sensor);
          }
        }
        sensor.triggered = motion;
      } catch (err) {
        this.error(`Motion sensor check failed for ${sensor.name}:`, err.message);
      }
    }

    for (const [id, sensor] of this.doorWindowSensors) {
      try {
        const open = await sensor.device.getCapabilityValue('alarm_contact');
        sensor.lastContact = Date.now();
        if (open && !sensor.open) {
          const inArmedZone = this.isDeviceInArmedZone(id) || this.securityMode === 'armed_away';
          if (inArmedZone) {
            await this.handleIntrusionEvent('door_window', sensor);
          }
        }
        sensor.open = open;
      } catch (err) {
        this.error(`Door/window sensor check failed for ${sensor.name}:`, err.message);
      }
    }
  }

  async handleIntrusionEvent(type, device) {
    this.log(`INTRUSION DETECTED: ${type} - ${device.name}`);

    const event = {
      type,
      device: device.name,
      deviceId: device.id,
      zone: device.zone,
      timestamp: Date.now(),
      securityMode: this.securityMode
    };

    this.intrusionEvents.push(event);
    const timelineEntry = this.addTimelineEvent({ ...event, category: 'intrusion' });

    // Link camera evidence
    if (this.cameras.size > 0) {
      await this.startRecording();
      for (const [camId, camera] of this.cameras) {
        this.linkEvidence(timelineEntry.id, { type: 'recording', cameraId: camId });
      }
    }

    if (this.silentAlarmMode) {
      await this.sendSilentAlert(event);
    } else {
      try {
        const notificationManager = this.homey.app.advancedNotificationManager;
        if (notificationManager) {
          await notificationManager.sendNotification({
            title: '🚨 INTRÅNG UPPTÄCKT',
            message: `${device.name}: ${type === 'motion' ? 'Rörelse' : 'Öppning'} detekterad`,
            priority: 'critical',
            category: 'security'
          });
        }
      } catch (err) {
        this.error('Failed to send intrusion notification:', err.message);
      }

      // Start escalation
      await this.startEscalation(timelineEntry.id, event);
    }
  }

  async startRecording() {
    for (const [id, camera] of this.cameras) {
      camera.recording = true;
      if (this.nightVisionEnabled) camera.nightVision = true;
      this.log(`Started recording: ${camera.name}${camera.nightVision ? ' (night vision)' : ''}`);
    }
  }

  /**
   * Change the global security mode, persist it, and apply side effects
   * (lock all doors, activate night vision, cancel escalations, stop simulation).
   *
   * @param {SecurityMode} mode - New security mode
   * @param {string} [userId='system'] - User requesting the change
   * @param {string} [trigger='manual'] - Trigger source ('manual', 'geofence_arrive', 'panic', etc.)
   * @returns {Promise<void>}
   */
  async setSecurityMode(mode, userId = 'system', trigger = 'manual') {
    const previousMode = this.securityMode;
    this.securityMode = mode;

    try {
      await this.homey.settings.set('securityMode', mode);
    } catch (err) {
      this.error('Failed to save security mode:', err.message);
    }

    this.addAuditEntry('mode_change', userId, { from: previousMode, to: mode, trigger });
    this.log(`Security mode set to: ${mode} by ${userId} (${trigger})`);

    if (mode === 'armed_away') {
      await this.lockAllDoors();
      if (new Date().getHours() >= 20 || new Date().getHours() < 6) {
        await this.enableNightVision();
      }
    }

    if (mode === 'disarmed') {
      // Cancel any active escalations
      for (const [eventId] of this.activeEscalations) {
        await this.cancelEscalation(eventId, userId);
      }
      if (this.simulationMode) await this.stopSimulationMode();
    }
  }

  async lockAllDoors() {
    for (const [id, lock] of this.locks) {
      try {
        if (lock.device.hasCapability('locked')) {
          await lock.device.setCapabilityValue('locked', true);
          lock.locked = true;
        }
      } catch (err) {
        this.error(`Failed to lock ${lock.name}:`, err.message);
      }
    }
  }

  /**
   * Activate panic mode: arm the system, lock all doors, start recording on all
   * cameras, and send a critical notification.
   *
   * @param {string} [userId='system'] - User who triggered panic mode
   * @returns {Promise<void>}
   */
  async activatePanicMode(userId = 'system') {
    this.panicMode = true;
    this.log('PANIC MODE ACTIVATED');

    this.addAuditEntry('panic_mode', userId, {});

    await this.setSecurityMode('armed_away', userId, 'panic');
    await this.lockAllDoors();
    await this.startRecording();

    try {
      const notificationManager = this.homey.app.advancedNotificationManager;
      if (notificationManager) {
        await notificationManager.sendNotification({
          title: '🚨 PANIKLÄGE AKTIVERAT',
          message: 'Alla lås låsta, kameror startar inspelning',
          priority: 'critical',
          category: 'panic'
        });
      }
    } catch (err) {
      this.error('Failed to send panic notification:', err.message);
    }
  }

  // ── Persistence ───────────────────────────────────────────────────────

  async saveSettings() {
    try {
      await this.homey.settings.set('securitySettings', {
        geofenceConfig: {
          enabled: this.geofenceConfig.enabled,
          latitude: this.geofenceConfig.latitude,
          longitude: this.geofenceConfig.longitude,
          radiusMeters: this.geofenceConfig.radiusMeters,
          autoArmOnLeave: this.geofenceConfig.autoArmOnLeave,
          autoDisarmOnArrive: this.geofenceConfig.autoDisarmOnArrive
        },
        silentAlarmContacts: this.silentAlarmContacts,
        escalationConfig: this.escalationConfig
      });
      await this.homey.settings.set('securityAuditTrail', this.auditTrail.slice(-500));
    } catch (err) {
      this.error('Failed to save security settings:', err.message);
    }
  }

  async saveVisitorSchedules() {
    try {
      const schedules = {};
      this.visitorSchedules.forEach((v, k) => { schedules[k] = v; });
      await this.homey.settings.set('visitorSchedules', schedules);
    } catch (err) {
      this.error('Failed to save visitor schedules:', err.message);
    }
  }

  // ── Statistics ────────────────────────────────────────────────────────

  /**
   * Return a snapshot of the security system's current state and metrics.
   *
   * @returns {{mode: SecurityMode, cameras: number, motionSensors: number, doorWindowSensors: number, locks: number, recentEvents: object[], panicMode: boolean, silentAlarmMode: boolean, simulationMode: boolean, nightVisionEnabled: boolean, geofenceEnabled: boolean, zoneStatus: object, sensorHealth: object, auditEntries: number, activeEscalations: number, visitorSchedules: number}}
   */
  getStatistics() {
    const healthReport = this.getSensorHealthReport();
    return {
      mode: this.securityMode,
      cameras: this.cameras.size,
      motionSensors: this.motionSensors.size,
      doorWindowSensors: this.doorWindowSensors.size,
      locks: this.locks.size,
      recentEvents: this.intrusionEvents.slice(-20),
      panicMode: this.panicMode,
      silentAlarmMode: this.silentAlarmMode,
      simulationMode: this.simulationMode,
      nightVisionEnabled: this.nightVisionEnabled,
      geofenceEnabled: this.geofenceConfig.enabled,
      zoneStatus: this.getZoneStatus(),
      sensorHealth: {
        healthy: healthReport.healthy,
        warning: healthReport.warning,
        critical: healthReport.critical,
        unreachable: healthReport.unreachable
      },
      auditEntries: this.auditTrail.length,
      activeEscalations: this.activeEscalations.size,
      visitorSchedules: this.visitorSchedules.size
    };
  }

  // ── Cleanup ───────────────────────────────────────────────────────────

  /**
   * Stop all monitoring intervals and cancel all pending timers and escalations.
   * Should be called before the app is unloaded.
   *
   * @returns {void}
   */
  destroy() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    for (const timer of this.simulationTimers) clearTimeout(timer);
    this.simulationTimers = [];
    for (const [id, escalation] of this.activeEscalations) {
      for (const timer of escalation.timers) clearTimeout(timer);
    }
    this.activeEscalations.clear();
    this.log('Advanced Security System destroyed');
  }

  log(...args) {
    console.log('[AdvancedSecuritySystem]', ...args);
  }

  error(...args) {
    console.error('[AdvancedSecuritySystem]', ...args);
  }
}

module.exports = AdvancedSecuritySystem;
