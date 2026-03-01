'use strict';
const logger = require('./logger');

/**
 * Home Security System
 * Comprehensive security monitoring and automation
 */
class HomeSecuritySystem {
  constructor(app) {
    this._intervals = [];
    this._timeouts = [];
    this.app = app;
    this.zones = new Map();
    this.sensors = new Map();
    this.cameras = new Map();
    this.events = [];
    this.alerts = [];
    this.modes = new Map();
    this.currentMode = 'disarmed';
    this.users = new Map();
  }

  async initialize() {
    await this.setupZones();
    await this.setupSensors();
    await this.setupCameras();
    await this.setupModes();
    await this.setupUsers();
    
    this.startMonitoring();
  }

  // ============================================
  // ZONES & AREAS
  // ============================================

  async setupZones() {
    const zoneData = [
      {
        id: 'entry',
        name: 'Entré',
        type: 'entry',
        criticalLevel: 'high',
        delayEntry: 30, // seconds to disarm
        delayExit: 60 // seconds to arm
      },
      {
        id: 'living_room',
        name: 'Vardagsrum',
        type: 'interior',
        criticalLevel: 'medium',
        delayEntry: 0,
        delayExit: 0
      },
      {
        id: 'kitchen',
        name: 'Kök',
        type: 'interior',
        criticalLevel: 'medium',
        delayEntry: 0,
        delayExit: 0
      },
      {
        id: 'bedroom',
        name: 'Sovrum',
        type: 'interior',
        criticalLevel: 'high',
        delayEntry: 0,
        delayExit: 0
      },
      {
        id: 'hallway',
        name: 'Hall',
        type: 'interior',
        criticalLevel: 'medium',
        delayEntry: 0,
        delayExit: 0
      },
      {
        id: 'basement',
        name: 'Källare',
        type: 'perimeter',
        criticalLevel: 'medium',
        delayEntry: 0,
        delayExit: 0
      },
      {
        id: 'garage',
        name: 'Garage',
        type: 'perimeter',
        criticalLevel: 'medium',
        delayEntry: 0,
        delayExit: 0
      },
      {
        id: 'garden',
        name: 'Trädgård',
        type: 'outdoor',
        criticalLevel: 'low',
        delayEntry: 0,
        delayExit: 0
      }
    ];

    for (const zone of zoneData) {
      this.zones.set(zone.id, {
        ...zone,
        armed: false,
        triggered: false,
        lastActivity: null
      });
    }
  }

  // ============================================
  // SENSORS
  // ============================================

  async setupSensors() {
    const sensorData = [
      // Door/Window Sensors
      { id: 'door_front', name: 'Ytterdörr', type: 'door', zone: 'entry', state: 'closed' },
      { id: 'door_back', name: 'Altandörr', type: 'door', zone: 'living_room', state: 'closed' },
      { id: 'door_basement', name: 'Källardörr', type: 'door', zone: 'basement', state: 'closed' },
      { id: 'door_garage', name: 'Garageport', type: 'door', zone: 'garage', state: 'closed' },
      
      { id: 'window_living_1', name: 'Vardagsrum fönster 1', type: 'window', zone: 'living_room', state: 'closed' },
      { id: 'window_living_2', name: 'Vardagsrum fönster 2', type: 'window', zone: 'living_room', state: 'closed' },
      { id: 'window_bedroom_1', name: 'Sovrum fönster', type: 'window', zone: 'bedroom', state: 'closed' },
      { id: 'window_kitchen', name: 'Kök fönster', type: 'window', zone: 'kitchen', state: 'closed' },
      { id: 'window_basement', name: 'Källare fönster', type: 'window', zone: 'basement', state: 'closed' },
      
      // Motion Sensors
      { id: 'motion_entry', name: 'Rörelse entré', type: 'motion', zone: 'entry', state: 'clear', petImmune: false },
      { id: 'motion_living', name: 'Rörelse vardagsrum', type: 'motion', zone: 'living_room', state: 'clear', petImmune: true },
      { id: 'motion_hallway', name: 'Rörelse hall', type: 'motion', zone: 'hallway', state: 'clear', petImmune: true },
      { id: 'motion_basement', name: 'Rörelse källare', type: 'motion', zone: 'basement', state: 'clear', petImmune: false },
      { id: 'motion_garage', name: 'Rörelse garage', type: 'motion', zone: 'garage', state: 'clear', petImmune: false },
      { id: 'motion_garden_front', name: 'Rörelse framsida', type: 'motion', zone: 'garden', state: 'clear', petImmune: false },
      { id: 'motion_garden_back', name: 'Rörelse baksida', type: 'motion', zone: 'garden', state: 'clear', petImmune: false },
      
      // Glass Break Sensors
      { id: 'glass_living', name: 'Glasdetektor vardagsrum', type: 'glass_break', zone: 'living_room', state: 'ok' },
      { id: 'glass_bedroom', name: 'Glasdetektor sovrum', type: 'glass_break', zone: 'bedroom', state: 'ok' },
      
      // Smoke/CO Sensors
      { id: 'smoke_kitchen', name: 'Rökdetektor kök', type: 'smoke', zone: 'kitchen', state: 'ok' },
      { id: 'smoke_bedroom', name: 'Rökdetektor sovrum', type: 'smoke', zone: 'bedroom', state: 'ok' },
      { id: 'smoke_hallway', name: 'Rökdetektor hall', type: 'smoke', zone: 'hallway', state: 'ok' },
      { id: 'co_basement', name: 'CO-detektor källare', type: 'co', zone: 'basement', state: 'ok' },
      
      // Water Leak Sensors
      { id: 'water_kitchen', name: 'Vattenläckage kök', type: 'water', zone: 'kitchen', state: 'dry' },
      { id: 'water_bathroom', name: 'Vattenläckage badrum', type: 'water', zone: 'hallway', state: 'dry' },
      { id: 'water_basement', name: 'Vattenläckage källare', type: 'water', zone: 'basement', state: 'dry' }
    ];

    for (const sensor of sensorData) {
      this.sensors.set(sensor.id, {
        ...sensor,
        batteryLevel: 100,
        lastUpdate: Date.now(),
        triggered: false,
        enabled: true
      });
    }
  }

  async updateSensorState(sensorId, newState) {
    const sensor = this.sensors.get(sensorId);
    
    if (!sensor) {
      return { success: false, error: 'Sensor not found' };
    }

    const oldState = sensor.state;
    sensor.state = newState;
    sensor.lastUpdate = Date.now();

    // Log event
    this.logEvent({
      type: 'sensor_change',
      sensorId,
      sensorName: sensor.name,
      oldState,
      newState,
      zone: sensor.zone
    });

    // Check if this triggers an alarm
    await this.checkSensorTrigger(sensor, oldState, newState);

    return { success: true, sensor };
  }

  async checkSensorTrigger(sensor, oldState, newState) {
    const zone = this.zones.get(sensor.zone);
    
    // Skip if zone not armed
    if (!zone || !zone.armed) return;

    // Skip if sensor disabled
    if (!sensor.enabled) return;

    let triggered = false;
    let severity = 'low';

    switch (sensor.type) {
      case 'door':
      case 'window':
        if (newState === 'open') {
          triggered = true;
          severity = zone.criticalLevel;
        }
        break;

      case 'motion':
        if (newState === 'detected') {
          triggered = true;
          severity = zone.criticalLevel;
        }
        break;

      case 'glass_break':
        if (newState === 'detected') {
          triggered = true;
          severity = 'high';
        }
        break;

      case 'smoke':
      case 'co':
        if (newState === 'alarm') {
          triggered = true;
          severity = 'critical';
        }
        break;

      case 'water':
        if (newState === 'wet') {
          triggered = true;
          severity = 'high';
        }
        break;
    }

    if (triggered) {
      await this.triggerAlarm({
        sensor: sensor.id,
        sensorName: sensor.name,
        zone: sensor.zone,
        type: sensor.type,
        severity
      });
    }
  }

  // ============================================
  // CAMERAS
  // ============================================

  async setupCameras() {
    const cameraData = [
      {
        id: 'cam_front',
        name: 'Kamera framsida',
        location: 'garden',
        type: 'outdoor',
        resolution: '2K',
        features: ['night_vision', 'motion_detection', 'two_way_audio'],
        status: 'online',
        recording: false
      },
      {
        id: 'cam_back',
        name: 'Kamera baksida',
        location: 'garden',
        type: 'outdoor',
        resolution: '2K',
        features: ['night_vision', 'motion_detection'],
        status: 'online',
        recording: false
      },
      {
        id: 'cam_garage',
        name: 'Kamera garage',
        location: 'garage',
        type: 'indoor',
        resolution: '1080p',
        features: ['motion_detection', 'sound_detection'],
        status: 'online',
        recording: false
      },
      {
        id: 'doorbell',
        name: 'Dörrklocka',
        location: 'entry',
        type: 'doorbell',
        resolution: '1080p',
        features: ['motion_detection', 'two_way_audio', 'person_detection'],
        status: 'online',
        recording: false
      }
    ];

    for (const camera of cameraData) {
      this.cameras.set(camera.id, {
        ...camera,
        lastMotion: null,
        recordings: []
      });
    }
  }

  async startRecording(cameraId, duration = 60) {
    const camera = this.cameras.get(cameraId);
    
    if (!camera) {
      return { success: false, error: 'Camera not found' };
    }

    camera.recording = true;

    const recording = {
      id: `rec_${Date.now()}`,
      cameraId,
      startTime: Date.now(),
      duration,
      reason: 'manual',
      status: 'recording'
    };

    camera.recordings.push(recording);

    logger.info(`📹 Started recording on ${camera.name} for ${duration}s`);

    // Stop recording after duration
    this._timeouts.push(setTimeout(() => {
      this.stopRecording(cameraId, recording.id);
    }, duration * 1000));

    return { success: true, recording };
  }

  async stopRecording(cameraId, recordingId) {
    const camera = this.cameras.get(cameraId);
    
    if (!camera) return;

    const recording = camera.recordings.find(r => r.id === recordingId);
    if (!recording) return;

    recording.status = 'completed';
    recording.endTime = Date.now();
    camera.recording = camera.recordings.some(r => r.status === 'recording');

    logger.info(`⏹️ Stopped recording on ${camera.name}`);
  }

  async detectMotionOnCamera(cameraId) {
    const camera = this.cameras.get(cameraId);
    
    if (!camera) return;

    camera.lastMotion = Date.now();

    this.logEvent({
      type: 'camera_motion',
      cameraId,
      cameraName: camera.name,
      location: camera.location
    });

    // Start recording if armed
    if (this.currentMode === 'armed_away' || this.currentMode === 'armed_night') {
      await this.startRecording(cameraId, 60);
    }

    logger.info(`📸 Motion detected on ${camera.name}`);
  }

  // ============================================
  // SECURITY MODES
  // ============================================

  async setupModes() {
    this.modes.set('disarmed', {
      id: 'disarmed',
      name: 'Avlarmad',
      description: 'Alla sensorer inaktiverade',
      armedZones: [],
      enabledSensors: []
    });

    this.modes.set('armed_home', {
      id: 'armed_home',
      name: 'Hemma',
      description: 'Perimeter och yttre sensorer aktiverade',
      armedZones: ['entry', 'basement', 'garage', 'garden'],
      enabledSensors: ['door', 'window', 'glass_break', 'smoke', 'co', 'water'],
      disableMotion: ['motion_living', 'motion_hallway'] // Pet-immune kept active
    });

    this.modes.set('armed_night', {
      id: 'armed_night',
      name: 'Natt',
      description: 'Alla sensorer utom sovrum',
      armedZones: ['entry', 'living_room', 'kitchen', 'hallway', 'basement', 'garage', 'garden'],
      enabledSensors: ['door', 'window', 'motion', 'glass_break', 'smoke', 'co', 'water'],
      disableMotion: ['motion_bedroom']
    });

    this.modes.set('armed_away', {
      id: 'armed_away',
      name: 'Borta',
      description: 'Alla sensorer aktiverade',
      armedZones: ['entry', 'living_room', 'kitchen', 'bedroom', 'hallway', 'basement', 'garage', 'garden'],
      enabledSensors: ['door', 'window', 'motion', 'glass_break', 'smoke', 'co', 'water']
    });

    this.modes.set('vacation', {
      id: 'vacation',
      name: 'Semester',
      description: 'Maximal säkerhet + simulera närvaro',
      armedZones: ['entry', 'living_room', 'kitchen', 'bedroom', 'hallway', 'basement', 'garage', 'garden'],
      enabledSensors: ['door', 'window', 'motion', 'glass_break', 'smoke', 'co', 'water'],
      simulatePresence: true
    });
  }

  async setMode(modeId, userId = null) {
    const mode = this.modes.get(modeId);
    
    if (!mode) {
      return { success: false, error: 'Mode not found' };
    }

    const previousMode = this.currentMode;

    // Apply entry delay for armed modes if coming from disarmed
    if (previousMode === 'disarmed' && modeId !== 'disarmed') {
      const entryZone = this.zones.get('entry');
      if (entryZone && entryZone.delayExit > 0) {
        logger.info(`⏳ Arming in ${entryZone.delayExit} seconds...`);
        
        this._timeouts.push(setTimeout(() => {
          this.applyMode(mode, userId);
        }, entryZone.delayExit * 1000));

        return { success: true, mode, delaySeconds: entryZone.delayExit };
      }
    }

    await this.applyMode(mode, userId);

    return { success: true, mode };
  }

  async applyMode(mode, userId) {
    // Disarm all zones first
    for (const [_zoneId, zone] of this.zones) {
      zone.armed = false;
    }

    // Arm specified zones
    for (const zoneId of mode.armedZones) {
      const zone = this.zones.get(zoneId);
      if (zone) {
        zone.armed = true;
      }
    }

    // Enable/disable sensors
    for (const [sensorId, sensor] of this.sensors) {
      sensor.enabled = mode.enabledSensors.includes(sensor.type);

      // Disable specific motion sensors if specified
      if (mode.disableMotion && mode.disableMotion.includes(sensorId)) {
        sensor.enabled = false;
      }
    }

    this.currentMode = mode.id;

    this.logEvent({
      type: 'mode_change',
      mode: mode.name,
      userId,
      armedZones: mode.armedZones.length
    });

    logger.info(`🔒 Security mode: ${mode.name}`);

    // Start presence simulation if vacation mode
    if (mode.simulatePresence) {
      this.startPresenceSimulation();
    }
  }

  // ============================================
  // ALARM MANAGEMENT
  // ============================================

  async triggerAlarm(data) {
    const alert = {
      id: `alert_${Date.now()}`,
      timestamp: Date.now(),
      type: data.type,
      severity: data.severity,
      sensor: data.sensor,
      sensorName: data.sensorName,
      zone: data.zone,
      status: 'active',
      acknowledged: false
    };

    this.alerts.push(alert);

    // Mark zone as triggered
    const zone = this.zones.get(data.zone);
    if (zone) {
      zone.triggered = true;
      zone.lastActivity = Date.now();
    }

    // Log event
    this.logEvent({
      type: 'alarm_triggered',
      ...data
    });

    logger.info(`🚨 ALARM! ${data.sensorName} (${data.severity})`);

    // Take actions based on severity
    await this.handleAlarm(alert);

    return alert;
  }

  async handleAlarm(alert) {
    switch (alert.severity) {
      case 'critical':
        // Life-threatening situations
        await this.callEmergencyServices(alert);
        await this.notifyAllUsers(alert);
        await this.activateSirens();
        await this.recordAllCameras();
        break;

      case 'high':
        await this.notifyAllUsers(alert);
        await this.activateSirens();
        await this.recordAllCameras();
        await this.sendAlertToNeighbors(alert);
        break;

      case 'medium':
        await this.notifyAllUsers(alert);
        await this.activateSirens();
        await this.recordNearbyCamera(alert.zone);
        break;

      case 'low':
        await this.notifyAllUsers(alert);
        await this.recordNearbyCamera(alert.zone);
        break;
    }
  }

  async callEmergencyServices(alert) {
    logger.info(`📞 Calling emergency services for: ${alert.sensorName}`);
    
    // In real implementation, this would call actual emergency services
    this.logEvent({
      type: 'emergency_call',
      alert: alert.id,
      reason: alert.type
    });
  }

  async notifyAllUsers(alert) {
    const users = Array.from(this.users.values());
    
    for (const user of users) {
      if (user.notifications) {
        logger.info(`📱 Notifying ${user.name}: ${alert.sensorName} ${alert.severity}`);
      }
    }
  }

  async activateSirens() {
    logger.info(`🔊 Sirens activated`);
    
    this.logEvent({
      type: 'siren_activated'
    });
  }

  async recordAllCameras() {
    logger.info(`📹 Recording all cameras`);
    
    for (const [cameraId, camera] of this.cameras) {
      if (camera.status === 'online') {
        await this.startRecording(cameraId, 120);
      }
    }
  }

  async recordNearbyCamera(zoneId) {
    // Find camera in or near zone
    for (const [cameraId, camera] of this.cameras) {
      if (camera.location === zoneId && camera.status === 'online') {
        await this.startRecording(cameraId, 60);
        break;
      }
    }
  }

  async sendAlertToNeighbors(alert) {
    logger.info(`👨‍👩‍👧‍👦 Alert sent to neighbors: ${alert.sensorName}`);
  }

  async acknowledgeAlert(alertId, userId) {
    const alert = this.alerts.find(a => a.id === alertId);
    
    if (!alert) {
      return { success: false, error: 'Alert not found' };
    }

    alert.acknowledged = true;
    alert.acknowledgedBy = userId;
    alert.acknowledgedAt = Date.now();

    logger.info(`✓ Alert acknowledged by user ${userId}`);

    return { success: true, alert };
  }

  async resolveAlert(alertId, resolution) {
    const alert = this.alerts.find(a => a.id === alertId);
    
    if (!alert) {
      return { success: false, error: 'Alert not found' };
    }

    alert.status = 'resolved';
    alert.resolution = resolution;
    alert.resolvedAt = Date.now();

    // Clear zone triggered status
    const zone = this.zones.get(alert.zone);
    if (zone) {
      zone.triggered = false;
    }

    logger.info(`✅ Alert resolved: ${resolution}`);

    return { success: true, alert };
  }

  // ============================================
  // USER MANAGEMENT
  // ============================================

  async setupUsers() {
    const userData = [
      {
        id: 'user_primary',
        name: 'Huvudanvändare',
        type: 'admin',
        pin: '1234',
        accessLevel: 'full',
        notifications: true,
        canDisarm: true
      },
      {
        id: 'user_family',
        name: 'Familjemedlem',
        type: 'user',
        pin: '5678',
        accessLevel: 'standard',
        notifications: true,
        canDisarm: true
      },
      {
        id: 'user_guest',
        name: 'Gäst',
        type: 'guest',
        pin: '9999',
        accessLevel: 'limited',
        notifications: false,
        canDisarm: false,
        validUntil: Date.now() + 7 * 24 * 60 * 60 * 1000
      }
    ];

    for (const user of userData) {
      this.users.set(user.id, {
        ...user,
        lastSeen: null,
        totalAccesses: 0
      });
    }
  }

  async authenticateUser(pin) {
    for (const [_userId, user] of this.users) {
      if (user.pin === pin) {
        // Check if guest access expired
        if (user.type === 'guest' && user.validUntil < Date.now()) {
          return { success: false, error: 'Access expired' };
        }

        user.lastSeen = Date.now();
        user.totalAccesses += 1;

        logger.info(`✓ User authenticated: ${user.name}`);

        return { success: true, user };
      }
    }

    this.logEvent({
      type: 'authentication_failed',
      timestamp: Date.now()
    });

    return { success: false, error: 'Invalid PIN' };
  }

  // ============================================
  // MONITORING & AUTOMATION
  // ============================================

  startMonitoring() {
    // Simulate random sensor activity
    this._intervals.push(setInterval(() => {
      this.simulateActivity();
    }, 5 * 60 * 1000)); // Every 5 minutes

    // Check sensor batteries weekly
    this._intervals.push(setInterval(() => {
      this.checkSensorBatteries();
    }, 7 * 24 * 60 * 60 * 1000));

    // Check alerts
    this._intervals.push(setInterval(() => {
      this.checkUnacknowledgedAlerts();
    }, 60 * 1000)); // Every minute
  }

  async simulateActivity() {
    // Only simulate if disarmed
    if (this.currentMode !== 'disarmed') return;

    const motionSensors = Array.from(this.sensors.values())
      .filter(s => s.type === 'motion' && s.enabled);

    if (motionSensors.length > 0) {
      const randomSensor = motionSensors[Math.floor(Math.random() * motionSensors.length)];
      
      await this.updateSensorState(randomSensor.id, 'detected');

      this._timeouts.push(setTimeout(async () => {
        await this.updateSensorState(randomSensor.id, 'clear');
      }, 30000));
    }
  }

  async checkSensorBatteries() {
    logger.info('🔋 Checking sensor batteries...');

    for (const [sensorId, sensor] of this.sensors) {
      // Simulate battery drain
      sensor.batteryLevel -= Math.random() * 5;

      if (sensor.batteryLevel < 20) {
        logger.info(`⚠️ Low battery: ${sensor.name} (${Math.round(sensor.batteryLevel)}%)`);
        
        this.logEvent({
          type: 'low_battery',
          sensorId,
          sensorName: sensor.name,
          batteryLevel: sensor.batteryLevel
        });
      }
    }
  }

  async checkUnacknowledgedAlerts() {
    const unacknowledged = this.alerts.filter(a => 
      a.status === 'active' && !a.acknowledged
    );

    if (unacknowledged.length > 0) {
      logger.info(`⚠️ ${unacknowledged.length} unacknowledged alert(s)`);
    }
  }

  async startPresenceSimulation() {
    logger.info('🏠 Starting presence simulation...');

    // Simulate someone being home
    const interval = setInterval(() => {
      if (this.currentMode !== 'vacation') {
        clearInterval(interval);
        return;
      }

      // Random light actions, etc
      const hour = new Date().getHours();

      if (hour >= 18 && hour <= 23) {
        // Evening activities
        logger.info('  💡 Simulating evening presence');
      }
    }, 30 * 60 * 1000); // Every 30 minutes

    this._intervals.push(interval);
  }

  // ============================================
  // EVENT LOGGING
  // ============================================

  logEvent(event) {
    this.events.push({
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      ...event
    });

    // Keep last 1000 events
    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000);
    }
  }

  // ============================================
  // REPORTING & ANALYTICS
  // ============================================

  getSecurityStatus() {
    const armedZones = Array.from(this.zones.values()).filter(z => z.armed);
    const triggeredZones = Array.from(this.zones.values()).filter(z => z.triggered);
    const activeAlerts = this.alerts.filter(a => a.status === 'active');
    const onlineCameras = Array.from(this.cameras.values()).filter(c => c.status === 'online');

    return {
      mode: this.currentMode,
      modeName: this.modes.get(this.currentMode)?.name,
      armedZones: armedZones.length,
      triggeredZones: triggeredZones.length,
      activeAlerts: activeAlerts.length,
      cameras: {
        total: this.cameras.size,
        online: onlineCameras.length,
        recording: onlineCameras.filter(c => c.recording).length
      },
      sensors: {
        total: this.sensors.size,
        enabled: Array.from(this.sensors.values()).filter(s => s.enabled).length,
        lowBattery: Array.from(this.sensors.values()).filter(s => s.batteryLevel < 20).length
      }
    };
  }

  getZoneStatus(zoneId) {
    const zone = this.zones.get(zoneId);
    if (!zone) return null;

    const zoneSensors = Array.from(this.sensors.values())
      .filter(s => s.zone === zoneId);

    return {
      ...zone,
      sensors: zoneSensors.map(s => ({
        id: s.id,
        name: s.name,
        type: s.type,
        state: s.state,
        enabled: s.enabled
      }))
    };
  }

  getRecentEvents(limit = 50) {
    return this.events
      .slice(-limit)
      .reverse()
      .map(e => ({
        id: e.id,
        timestamp: e.timestamp,
        type: e.type,
        description: this.formatEventDescription(e)
      }));
  }

  formatEventDescription(event) {
    switch (event.type) {
      case 'sensor_change':
        return `${event.sensorName}: ${event.oldState} → ${event.newState}`;
      case 'mode_change':
        return `Läge ändrat till: ${event.mode}`;
      case 'alarm_triggered':
        return `🚨 ${event.sensorName} (${event.severity})`;
      case 'camera_motion':
        return `📸 ${event.cameraName}`;
      case 'low_battery':
        return `🔋 ${event.sensorName} (${Math.round(event.batteryLevel)}%)`;
      default:
        return JSON.stringify(event);
    }
  }

  getSecurityReport(days = 7) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const recentEvents = this.events.filter(e => e.timestamp >= cutoff);
    const recentAlerts = this.alerts.filter(a => a.timestamp >= cutoff);

    const eventsByType = {};
    for (const event of recentEvents) {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
    }

    const alertsBySeverity = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    for (const alert of recentAlerts) {
      alertsBySeverity[alert.severity] += 1;
    }

    return {
      period: `${days} days`,
      totalEvents: recentEvents.length,
      totalAlerts: recentAlerts.length,
      eventsByType,
      alertsBySeverity,
      averageAlertsPerDay: (recentAlerts.length / days).toFixed(1)
    };
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

module.exports = HomeSecuritySystem;
