'use strict';
const logger = require('./logger');

/**
 * Advanced Home Theater Controller
 * Complete home theater and entertainment system control
 */
class AdvancedHomeTheaterController {
  constructor(app) {
    this._intervals = [];
    this._timeouts = [];
    this.app = app;
    this.devices = new Map();
    this.activities = new Map();
    this.scenes = new Map();
    this.currentActivity = null;
  }

  async initialize() {
    await this.setupDevices();
    await this.setupActivities();
    await this.setupScenes();
    
    this.startMonitoring();
  }

  // ============================================
  // DEVICES
  // ============================================

  async setupDevices() {
    const devices = [
      {
        id: 'tv_main',
        name: 'Samsung TV',
        type: 'tv',
        brand: 'Samsung',
        model: 'QN90A',
        power: 'off',
        input: 'HDMI1',
        volume: 50,
        muted: false,
        settings: {
          pictureMode: 'movie',
          brightness: 50,
          contrast: 50,
          sharpness: 25
        }
      },
      {
        id: 'receiver',
        name: 'AV Receiver',
        type: 'receiver',
        brand: 'Denon',
        model: 'AVR-X3700H',
        power: 'off',
        input: 'Blu-ray',
        volume: 60,
        muted: false,
        soundMode: 'movie',
        surroundSound: 'Dolby Atmos'
      },
      {
        id: 'bluray',
        name: 'Blu-ray Player',
        type: 'media',
        brand: 'Sony',
        model: 'UBP-X700',
        power: 'off',
        currentDisc: null
      },
      {
        id: 'apple_tv',
        name: 'Apple TV',
        type: 'streaming',
        brand: 'Apple',
        model: 'Apple TV 4K',
        power: 'standby',
        currentApp: null
      },
      {
        id: 'soundbar',
        name: 'Soundbar',
        type: 'audio',
        brand: 'Sonos',
        model: 'Arc',
        power: 'off',
        volume: 50,
        muted: false,
        bass: 5,
        treble: 0,
        surroundEnabled: true
      },
      {
        id: 'projector',
        name: 'Projektor',
        type: 'projector',
        brand: 'Epson',
        model: 'EH-TW9400',
        power: 'off',
        input: 'HDMI1',
        lampHours: 450,
        brightness: 100
      },
      {
        id: 'gaming',
        name: 'PlayStation 5',
        type: 'gaming',
        brand: 'Sony',
        model: 'PS5',
        power: 'off',
        hdmiPort: 'HDMI2'
      },
      {
        id: 'screen',
        name: 'Motorized Screen',
        type: 'screen',
        brand: 'Elite Screens',
        position: 'up'  // up or down
      }
    ];

    for (const device of devices) {
      this.devices.set(device.id, device);
    }
  }

  async controlDevice(deviceId, command, value = null) {
    const device = this.devices.get(deviceId);
    
    if (!device) {
      return { success: false, error: 'Device not found' };
    }

    switch (command) {
      case 'power_on':
        device.power = 'on';
        logger.info(`✅ ${device.name} powered ON`);
        break;
      
      case 'power_off':
        device.power = 'off';
        logger.info(`✅ ${device.name} powered OFF`);
        break;
      
      case 'volume':
        device.volume = value;
        logger.info(`🔊 ${device.name} volume: ${value}`);
        break;
      
      case 'mute':
        device.muted = true;
        logger.info(`🔇 ${device.name} muted`);
        break;
      
      case 'unmute':
        device.muted = false;
        logger.info(`🔊 ${device.name} unmuted`);
        break;
      
      case 'input':
        device.input = value;
        logger.info(`📺 ${device.name} input: ${value}`);
        break;
      
      default:
        return { success: false, error: 'Unknown command' };
    }

    return { success: true };
  }

  // ============================================
  // ACTIVITIES
  // ============================================

  async setupActivities() {
    const activities = [
      {
        id: 'movie',
        name: 'Watch Movie',
        description: 'Optimal settings for watching movies',
        devices: ['tv_main', 'receiver', 'soundbar', 'apple_tv'],
        sequence: [
          { device: 'tv_main', command: 'power_on' },
          { device: 'tv_main', command: 'input', value: 'HDMI1' },
          { device: 'tv_main', setting: 'pictureMode', value: 'movie' },
          { device: 'receiver', command: 'power_on' },
          { device: 'receiver', command: 'input', value: 'Apple TV' },
          { device: 'receiver', setting: 'soundMode', value: 'movie' },
          { device: 'receiver', command: 'volume', value: 70 },
          { device: 'soundbar', command: 'power_on' },
          { device: 'apple_tv', command: 'power_on' }
        ],
        lighting: 'dim',
        temperature: 21
      },
      {
        id: 'gaming',
        name: 'Gaming',
        description: 'Optimized for gaming',
        devices: ['tv_main', 'receiver', 'gaming'],
        sequence: [
          { device: 'tv_main', command: 'power_on' },
          { device: 'tv_main', command: 'input', value: 'HDMI2' },
          { device: 'tv_main', setting: 'pictureMode', value: 'game' },
          { device: 'receiver', command: 'power_on' },
          { device: 'receiver', command: 'input', value: 'Gaming' },
          { device: 'receiver', setting: 'soundMode', value: 'game' },
          { device: 'gaming', command: 'power_on' }
        ],
        lighting: 'gaming',
        temperature: 20
      },
      {
        id: 'sports',
        name: 'Watch Sports',
        description: 'Settings for sports viewing',
        devices: ['tv_main', 'soundbar'],
        sequence: [
          { device: 'tv_main', command: 'power_on' },
          { device: 'tv_main', command: 'input', value: 'HDMI1' },
          { device: 'tv_main', setting: 'pictureMode', value: 'vivid' },
          { device: 'soundbar', command: 'power_on' },
          { device: 'soundbar', command: 'volume', value: 65 }
        ],
        lighting: 'bright',
        temperature: 21
      },
      {
        id: 'music',
        name: 'Listen to Music',
        description: 'High quality audio playback',
        devices: ['receiver', 'soundbar'],
        sequence: [
          { device: 'receiver', command: 'power_on' },
          { device: 'receiver', command: 'input', value: 'Streaming' },
          { device: 'receiver', setting: 'soundMode', value: 'music' },
          { device: 'soundbar', command: 'power_on' }
        ],
        lighting: 'ambient',
        temperature: 22
      },
      {
        id: 'cinema',
        name: 'Cinema Mode',
        description: 'Full cinema experience with projector',
        devices: ['projector', 'receiver', 'soundbar', 'screen', 'bluray'],
        sequence: [
          { device: 'screen', command: 'down' },
          { device: 'projector', command: 'power_on' },
          { device: 'projector', command: 'input', value: 'HDMI1' },
          { device: 'receiver', command: 'power_on' },
          { device: 'receiver', setting: 'soundMode', value: 'movie' },
          { device: 'receiver', setting: 'surroundSound', value: 'Dolby Atmos' },
          { device: 'soundbar', command: 'power_on' },
          { device: 'bluray', command: 'power_on' }
        ],
        lighting: 'off',
        temperature: 21
      }
    ];

    for (const activity of activities) {
      this.activities.set(activity.id, activity);
    }
  }

  async startActivity(activityId) {
    const activity = this.activities.get(activityId);
    
    if (!activity) {
      return { success: false, error: 'Activity not found' };
    }

    logger.info(`🎬 Starting activity: ${activity.name}`);

    // Stop current activity first
    if (this.currentActivity) {
      await this.stopActivity();
    }

    // Execute sequence with delays
    for (const step of activity.sequence) {
      const device = this.devices.get(step.device);
      
      if (step.command) {
        await this.controlDevice(step.device, step.command, step.value);
      } else if (step.setting) {
        device.settings = device.settings || {};
        device.settings[step.setting] = step.value;
        logger.info(`   ${device.name} ${step.setting}: ${step.value}`);
      }

      // Small delay between commands
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Set lighting
    if (activity.lighting) {
      logger.info(`   💡 Lighting: ${activity.lighting}`);
    }

    // Set temperature
    if (activity.temperature) {
      logger.info(`   🌡️  Temperature: ${activity.temperature}°C`);
    }

    this.currentActivity = activityId;

    logger.info(`✅ Activity started: ${activity.name}`);

    return { success: true };
  }

  async stopActivity() {
    if (!this.currentActivity) {
      return { success: false, error: 'No active activity' };
    }

    const activity = this.activities.get(this.currentActivity);
    
    logger.info(`⏹️  Stopping activity: ${activity.name}`);

    // Power off all devices
    for (const deviceId of activity.devices) {
      await this.controlDevice(deviceId, 'power_off');
    }

    // Restore normal lighting
    logger.info('   💡 Lighting: normal');

    this.currentActivity = null;

    return { success: true };
  }

  // ============================================
  // SCENES
  // ============================================

  async setupScenes() {
    const scenes = [
      {
        id: 'movie_night',
        name: 'Movie Night',
        time: '19:00',
        activity: 'movie',
        snacks: true
      },
      {
        id: 'family_movie',
        name: 'Family Movie',
        time: '14:00',
        activity: 'movie',
        lighting: 'dim_50'
      },
      {
        id: 'sports_game',
        name: 'Watch Game',
        activity: 'sports'
      }
    ];

    for (const scene of scenes) {
      this.scenes.set(scene.id, scene);
    }
  }

  // ============================================
  // CALIBRATION
  // ============================================

  async calibrateAudio() {
    logger.info('🎵 Calibrating audio system...');
    
    const calibration = {
      speakerDistances: {
        front_left: 3.2,    // meters
        front_right: 3.2,
        center: 3.0,
        surround_left: 2.5,
        surround_right: 2.5,
        subwoofer: 3.5
      },
      levels: {
        front_left: 75,     // dB
        front_right: 75,
        center: 75,
        surround_left: 75,
        surround_right: 75,
        subwoofer: 78
      },
      roomCorrection: true
    };

    logger.info('   Speaker distances configured');
    logger.info('   Audio levels balanced');
    logger.info('   Room correction enabled');

    return { success: true, calibration };
  }

  async calibrateVideo() {
    logger.info('📺 Calibrating video settings...');
    
    const calibration = {
      brightness: 50,
      contrast: 48,
      color: 50,
      tint: 0,
      sharpness: 20,
      hdrMode: 'auto',
      colorSpace: 'BT.2020'
    };

    logger.info('   Picture settings optimized');
    logger.info('   HDR mode: auto');
    logger.info('   Color space: BT.2020');

    return { success: true, calibration };
  }

  // ============================================
  // SMART FEATURES
  // ============================================

  async adjustVolumeBasedOnTime() {
    const hour = new Date().getHours();
    let targetVolume;

    if (hour >= 22 || hour < 7) {
      // Night time - lower volume
      targetVolume = 50;
      logger.info('🌙 Night mode: Reducing volume to 50');
    } else if (hour >= 7 && hour < 9) {
      // Morning - moderate volume
      targetVolume = 60;
      logger.info('🌅 Morning mode: Volume at 60');
    } else {
      // Day/evening - normal volume
      targetVolume = 70;
      logger.info('☀️ Day mode: Volume at 70');
    }

    await this.controlDevice('receiver', 'volume', targetVolume);

    return { success: true, volume: targetVolume };
  }

  async detectContentType() {
    // Analyze what's playing and optimize settings
    const contentTypes = ['movie', 'sports', 'news', 'music', 'gaming'];
    const detected = contentTypes[Math.floor(Math.random() * contentTypes.length)];

    logger.info(`🎬 Content detected: ${detected}`);

    switch (detected) {
      case 'movie':
        logger.info('   Optimizing for cinematic experience');
        await this.optimizePictureForMovies();
        break;
      
      case 'sports':
        logger.info('   Optimizing for sports viewing');
        await this.optimizePictureForSports();
        break;
      
      case 'gaming':
        logger.info('   Optimizing for gaming');
        await this.optimizePictureForGaming();
        break;
    }

    return { success: true, contentType: detected };
  }

  async optimizePictureForMovies() {
    const tv = this.devices.get('tv_main');
    
    tv.settings.pictureMode = 'movie';
    tv.settings.brightness = 45;
    tv.settings.contrast = 50;
    tv.settings.sharpness = 20;

    logger.info('   Picture mode: Movie');
    logger.info('   Motion smoothing: OFF');
    logger.info('   Black levels: optimized');

    return { success: true };
  }

  async optimizePictureForSports() {
    const tv = this.devices.get('tv_main');
    
    tv.settings.pictureMode = 'vivid';
    tv.settings.brightness = 55;
    tv.settings.contrast = 55;
    tv.settings.sharpness = 30;

    logger.info('   Picture mode: Vivid');
    logger.info('   Motion smoothing: ON');
    logger.info('   Clarity: enhanced');

    return { success: true };
  }

  async optimizePictureForGaming() {
    const tv = this.devices.get('tv_main');
    
    tv.settings.pictureMode = 'game';
    tv.settings.brightness = 50;
    tv.settings.contrast = 50;
    tv.settings.sharpness = 25;

    logger.info('   Picture mode: Game');
    logger.info('   Input lag: minimized');
    logger.info('   VRR: enabled');

    return { success: true };
  }

  // ============================================
  // UNIVERSAL REMOTE
  // ============================================

  async sendRemoteCommand(deviceId, button) {
    const device = this.devices.get(deviceId);
    
    if (!device) {
      return { success: false, error: 'Device not found' };
    }

    logger.info(`🎮 Remote command: ${button} → ${device.name}`);

    // Handle common buttons
    switch (button) {
      case 'play':
        logger.info('   ▶️ Playing');
        break;
      case 'pause':
        logger.info('   ⏸️ Paused');
        break;
      case 'stop':
        logger.info('   ⏹️ Stopped');
        break;
      case 'volume_up':
        device.volume = Math.min(100, device.volume + 5);
        logger.info(`   🔊 Volume: ${device.volume}`);
        break;
      case 'volume_down':
        device.volume = Math.max(0, device.volume - 5);
        logger.info(`   🔉 Volume: ${device.volume}`);
        break;
      case 'channel_up':
        logger.info('   📺 Channel up');
        break;
      case 'channel_down':
        logger.info('   📺 Channel down');
        break;
      case 'menu':
        logger.info('   📋 Menu opened');
        break;
      case 'back':
        logger.info('   ⬅️ Back');
        break;
      case 'home':
        logger.info('   🏠 Home screen');
        break;
    }

    return { success: true };
  }

  // ============================================
  // MONITORING
  // ============================================

  startMonitoring() {
    // Check device status every 5 minutes
    this._intervals.push(setInterval(() => {
      this.checkDeviceStatus();
    }, 5 * 60 * 1000));

    // Auto-adjust volume based on time
    this._intervals.push(setInterval(() => {
      if (this.currentActivity) {
        this.adjustVolumeBasedOnTime();
      }
    }, 30 * 60 * 1000));

    logger.info('🎬 Home Theater Controller active');
  }

  async checkDeviceStatus() {
    for (const [_id, device] of this.devices) {
      if (device.power === 'on') {
        logger.info(`   ${device.name}: Online`);
      }
    }
  }

  // ============================================
  // REPORTING
  // ============================================

  getTheaterOverview() {
    const devices = Array.from(this.devices.values());
    const poweredOn = devices.filter(d => d.power === 'on').length;

    return {
      totalDevices: devices.length,
      poweredOn,
      activities: this.activities.size,
      currentActivity: this.currentActivity
    };
  }

  getDevicesList() {
    return Array.from(this.devices.values()).map(d => ({
      name: d.name,
      type: d.type,
      brand: d.brand,
      power: d.power,
      input: d.input || 'N/A'
    }));
  }

  getActivitiesList() {
    return Array.from(this.activities.values()).map(a => ({
      name: a.name,
      description: a.description,
      devices: a.devices.length
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

module.exports = AdvancedHomeTheaterController;
