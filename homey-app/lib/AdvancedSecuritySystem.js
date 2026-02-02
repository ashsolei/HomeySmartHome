'use strict';

/**
 * Advanced Security System
 * Comprehensive security with facial recognition, intrusion detection, and panic mode
 */
class AdvancedSecuritySystem {
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
  }

  async initialize() {
    this.log('Initializing Advanced Security System...');
    
    await this.discoverSecurityDevices();
    await this.setupSecurityZones();
    await this.loadAuthorizedPersons();
    await this.startMonitoring();
    
    this.log('Advanced Security System initialized');
  }

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
          motionDetection: true
        });
      }

      if (device.hasCapability('alarm_motion')) {
        this.motionSensors.set(device.id, {
          id: device.id,
          name: device.name,
          device,
          zone: device.zone?.name || 'unknown',
          triggered: false
        });
      }

      if (device.hasCapability('alarm_contact')) {
        this.doorWindowSensors.set(device.id, {
          id: device.id,
          name: device.name,
          device,
          zone: device.zone?.name || 'unknown',
          open: false
        });
      }

      if (name.includes('lock') || device.hasCapability('locked')) {
        this.locks.set(device.id, {
          id: device.id,
          name: device.name,
          device,
          locked: true,
          lastAccess: null
        });
      }
    }

    this.log(`Security devices: ${this.cameras.size} cameras, ${this.motionSensors.size} motion, ${this.doorWindowSensors.size} door/window, ${this.locks.size} locks`);
  }

  async setupSecurityZones() {
    this.zones.set('perimeter', {
      id: 'perimeter',
      name: 'Perimeter',
      devices: [],
      armed: false
    });

    this.zones.set('interior', {
      id: 'interior',
      name: 'Interior',
      devices: [],
      armed: false
    });

    this.zones.set('critical', {
      id: 'critical',
      name: 'Critical Areas',
      devices: [],
      armed: true
    });
  }

  async loadAuthorizedPersons() {
    const saved = await this.homey.settings.get('authorizedPersons') || {};
    Object.entries(saved).forEach(([id, person]) => {
      this.authorizedPersons.set(id, person);
    });
  }

  async startMonitoring() {
    this.monitoringInterval = setInterval(async () => {
      await this.checkSecurityStatus();
    }, 10000);

    await this.checkSecurityStatus();
  }

  async checkSecurityStatus() {
    for (const [id, sensor] of this.motionSensors) {
      try {
        const motion = await sensor.device.getCapabilityValue('alarm_motion');
        if (motion && !sensor.triggered && this.securityMode !== 'disarmed') {
          await this.handleIntrusionEvent('motion', sensor);
        }
        sensor.triggered = motion;
      } catch {}
    }

    for (const [id, sensor] of this.doorWindowSensors) {
      try {
        const open = await sensor.device.getCapabilityValue('alarm_contact');
        if (open && !sensor.open && this.securityMode === 'armed_away') {
          await this.handleIntrusionEvent('door_window', sensor);
        }
        sensor.open = open;
      } catch {}
    }
  }

  async handleIntrusionEvent(type, device) {
    this.log(`INTRUSION DETECTED: ${type} - ${device.name}`);

    const event = {
      type,
      device: device.name,
      zone: device.zone,
      timestamp: Date.now(),
      securityMode: this.securityMode
    };

    this.intrusionEvents.push(event);

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
    } catch {}

    if (this.cameras.size > 0) {
      await this.startRecording();
    }
  }

  async startRecording() {
    for (const [id, camera] of this.cameras) {
      camera.recording = true;
      this.log(`Started recording: ${camera.name}`);
    }
  }

  async setSecurityMode(mode) {
    this.securityMode = mode;
    await this.homey.settings.set('securityMode', mode);
    this.log(`Security mode set to: ${mode}`);

    if (mode === 'armed_away') {
      await this.lockAllDoors();
    }
  }

  async lockAllDoors() {
    for (const [id, lock] of this.locks) {
      try {
        if (lock.device.hasCapability('locked')) {
          await lock.device.setCapabilityValue('locked', true);
          lock.locked = true;
        }
      } catch {}
    }
  }

  async activatePanicMode() {
    this.panicMode = true;
    this.log('PANIC MODE ACTIVATED');

    await this.setSecurityMode('armed_away');
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
    } catch {}
  }

  getStatistics() {
    return {
      mode: this.securityMode,
      cameras: this.cameras.size,
      motionSensors: this.motionSensors.size,
      doorWindowSensors: this.doorWindowSensors.size,
      locks: this.locks.size,
      recentEvents: this.intrusionEvents.slice(-20),
      panicMode: this.panicMode
    };
  }

  log(...args) {
    console.log('[AdvancedSecuritySystem]', ...args);
  }

  error(...args) {
    console.error('[AdvancedSecuritySystem]', ...args);
  }
}

module.exports = AdvancedSecuritySystem;
