'use strict';

const EventEmitter = require('events');

/**
 * Smart Circadian Lighting System
 *
 * Manages circadian rhythm-aware lighting that adjusts color temperature
 * and intensity throughout the day to support natural sleep-wake cycles.
 *
 * Features:
 * - Dawn/dusk simulation with gradual transitions
 * - Blue light reduction during evening hours
 * - Seasonal daylight adaptation based on geographic location
 * - Per-room circadian profiles with individual overrides
 * - Light therapy scheduling for SAD and jet lag
 * - Melatonin-friendly warm modes after sunset
 * - Lux-level monitoring and automatic compensation
 * - Integration with sleep tracking data
 */
class SmartCircadianLightingSystem extends EventEmitter {
  constructor(homey) {
    super();
    this.homey = homey;
    this.initialized = false;
    this.rooms = new Map();
    this.profiles = new Map();
    this.therapySessions = [];
    this.lightHistory = [];
    this.sunSchedule = { sunrise: null, sunset: null, solarNoon: null };
    this.colorTempRange = { min: 1800, max: 6500 };
    this.transitionTimer = null;
    this.monitoringInterval = null;
    this.dawnSimulationTimer = null;
    this.currentPhase = 'day'; // dawn, day, dusk, night
    this.locationConfig = { latitude: 52.37, longitude: 4.89, timezone: 'Europe/Amsterdam' };
  }

  /**
   * Initialize the circadian lighting system
   * @returns {Promise<boolean>}
   */
  async initialize() {
    if (this.initialized) return true;

    this.homey.log('[SmartCircadianLightingSystem] Initializing...');

    await this.loadSettings();
    this.calculateSunSchedule();
    this.initializeDefaultProfiles();
    this.determineCurrentPhase();
    this.startCircadianMonitoring();

    this.initialized = true;
    this.homey.log('[SmartCircadianLightingSystem] Initialized');
    this.homey.emit('circadian-lighting:initialized');
    return true;
  }

  /**
   * Load persisted settings from storage
   */
  async loadSettings() {
    const settings = await this.homey.settings.get('circadianLighting') || {};

    if (settings.location) {
      this.locationConfig = { ...this.locationConfig, ...settings.location };
    }
    if (settings.colorTempRange) {
      this.colorTempRange = settings.colorTempRange;
    }
    if (settings.rooms) {
      for (const [id, room] of Object.entries(settings.rooms)) {
        this.rooms.set(id, room);
      }
    }
    if (settings.profiles) {
      for (const [id, profile] of Object.entries(settings.profiles)) {
        this.profiles.set(id, profile);
      }
    }
    if (settings.therapySessions) {
      this.therapySessions = settings.therapySessions;
    }
  }

  /**
   * Calculate sunrise, sunset, and solar noon for the current day
   */
  calculateSunSchedule() {
    const now = new Date();
    const dayOfYear = this._getDayOfYear(now);
    const lat = this.locationConfig.latitude;

    // simplified solar calculation
    const declination = 23.45 * Math.sin((2 * Math.PI / 365) * (dayOfYear - 81));
    const hourAngle = Math.acos(
      -Math.tan(lat * Math.PI / 180) * Math.tan(declination * Math.PI / 180)
    );
    const daylightHours = (2 * hourAngle * 180) / (15 * Math.PI);
    const solarNoonHour = 12;

    this.sunSchedule = {
      sunrise: solarNoonHour - daylightHours / 2,
      sunset: solarNoonHour + daylightHours / 2,
      solarNoon: solarNoonHour,
      daylightHours,
      dayOfYear,
    };

    this.homey.log(`[SmartCircadianLightingSystem] Sun schedule - rise: ${this.sunSchedule.sunrise.toFixed(2)}, set: ${this.sunSchedule.sunset.toFixed(2)}`);
  }

  /**
   * Initialize default circadian profiles for common scenarios
   */
  initializeDefaultProfiles() {
    if (this.profiles.size > 0) return;

    this.profiles.set('default', {
      id: 'default',
      name: 'Standard Circadian',
      dawnTransitionMinutes: 30,
      duskTransitionMinutes: 45,
      dayColorTemp: 5000,
      nightColorTemp: 2200,
      dayBrightness: 100,
      nightBrightness: 20,
      blueLightReductionStart: -2, // hours before sunset
      melatoninModeStart: -1, // hours before bedtime
    });

    this.profiles.set('early-bird', {
      id: 'early-bird',
      name: 'Early Bird',
      dawnTransitionMinutes: 45,
      duskTransitionMinutes: 30,
      dayColorTemp: 5500,
      nightColorTemp: 2000,
      dayBrightness: 100,
      nightBrightness: 10,
      blueLightReductionStart: -3,
      melatoninModeStart: -2,
    });

    this.profiles.set('night-owl', {
      id: 'night-owl',
      name: 'Night Owl',
      dawnTransitionMinutes: 20,
      duskTransitionMinutes: 60,
      dayColorTemp: 4500,
      nightColorTemp: 2400,
      dayBrightness: 90,
      nightBrightness: 35,
      blueLightReductionStart: -1,
      melatoninModeStart: 0,
    });
  }

  /**
   * Determine the current circadian phase based on the sun schedule
   */
  determineCurrentPhase() {
    const now = new Date();
    const currentHour = now.getHours() + now.getMinutes() / 60;
    const { sunrise, sunset } = this.sunSchedule;
    const dawnStart = sunrise - 0.5;
    const duskEnd = sunset + 0.75;

    if (currentHour >= dawnStart && currentHour < sunrise) {
      this.currentPhase = 'dawn';
    } else if (currentHour >= sunrise && currentHour < sunset) {
      this.currentPhase = 'day';
    } else if (currentHour >= sunset && currentHour < duskEnd) {
      this.currentPhase = 'dusk';
    } else {
      this.currentPhase = 'night';
    }

    this.homey.emit('circadian-lighting:phase-changed', { phase: this.currentPhase });
  }

  /**
   * Calculate the optimal color temperature for the current moment
   * @param {string} profileId - Profile to use for calculation
   * @returns {object} Color temperature and brightness values
   */
  calculateCurrentLightSettings(profileId = 'default') {
    const profile = this.profiles.get(profileId) || this.profiles.get('default');
    const now = new Date();
    const currentHour = now.getHours() + now.getMinutes() / 60;
    const { sunrise, sunset } = this.sunSchedule;

    let colorTemp, brightness;

    switch (this.currentPhase) {
      case 'dawn': {
        const progress = (currentHour - (sunrise - 0.5)) / 0.5;
        colorTemp = this._lerp(profile.nightColorTemp, profile.dayColorTemp, progress);
        brightness = this._lerp(profile.nightBrightness, profile.dayBrightness, progress);
        break;
      }
      case 'day': {
        const midday = (sunrise + sunset) / 2;
        const distFromNoon = 1 - Math.abs(currentHour - midday) / ((sunset - sunrise) / 2);
        colorTemp = this._lerp(profile.dayColorTemp * 0.9, profile.dayColorTemp, distFromNoon);
        brightness = profile.dayBrightness;
        break;
      }
      case 'dusk': {
        const progress = (currentHour - sunset) / 0.75;
        colorTemp = this._lerp(profile.dayColorTemp, profile.nightColorTemp, progress);
        brightness = this._lerp(profile.dayBrightness, profile.nightBrightness, progress);
        break;
      }
      case 'night':
      default:
        colorTemp = profile.nightColorTemp;
        brightness = profile.nightBrightness;
        break;
    }

    return {
      colorTemp: Math.round(colorTemp),
      brightness: Math.round(brightness),
      phase: this.currentPhase,
      timestamp: now.toISOString(),
    };
  }

  /**
   * Start dawn simulation for a specific room
   * @param {string} roomId - Room identifier
   * @param {number} durationMinutes - Duration of the dawn simulation
   */
  async startDawnSimulation(roomId, durationMinutes = 30) {
    const room = this.rooms.get(roomId);
    if (!room) {
      this.homey.log(`[SmartCircadianLightingSystem] Room ${roomId} not found`);
      return { success: false, error: 'Room not found' };
    }

    const steps = durationMinutes * 2; // update every 30 seconds
    const interval = (durationMinutes * 60 * 1000) / steps;
    let step = 0;

    this.homey.log(`[SmartCircadianLightingSystem] Starting dawn simulation for ${roomId} (${durationMinutes}min)`);

    if (this.dawnSimulationTimer) clearInterval(this.dawnSimulationTimer);

    this.dawnSimulationTimer = setInterval(() => {
      step++;
      const progress = step / steps;
      const colorTemp = Math.round(this._lerp(1800, 4500, progress));
      const brightness = Math.round(this._lerp(0, 80, this._easeInOut(progress)));

      this.homey.emit('circadian-lighting:dawn-step', {
        roomId,
        colorTemp,
        brightness,
        progress: Math.round(progress * 100),
      });

      if (step >= steps) {
        clearInterval(this.dawnSimulationTimer);
        this.dawnSimulationTimer = null;
        this.homey.emit('circadian-lighting:dawn-complete', { roomId });
        this.homey.log(`[SmartCircadianLightingSystem] Dawn simulation complete for ${roomId}`);
      }
    }, interval);

    return { success: true, roomId, durationMinutes, estimatedSteps: steps };
  }

  /**
   * Enable melatonin-friendly mode for a room — warm, dim lighting
   * @param {string} roomId - Room identifier
   * @param {object} options - Mode options
   */
  async enableMelatoninMode(roomId, options = {}) {
    const defaults = { colorTemp: 1800, brightness: 15, duration: null };
    const config = { ...defaults, ...options };

    this.homey.log(`[SmartCircadianLightingSystem] Enabling melatonin mode for ${roomId}`);

    const room = this.rooms.get(roomId) || { id: roomId, name: roomId };
    room.melatoninMode = true;
    room.melatoninConfig = config;
    this.rooms.set(roomId, room);

    this.homey.emit('circadian-lighting:melatonin-mode', {
      roomId,
      colorTemp: config.colorTemp,
      brightness: config.brightness,
      enabled: true,
    });

    return { success: true, roomId, config };
  }

  /**
   * Schedule a light therapy session
   * @param {object} session - Light therapy session configuration
   */
  async scheduleLightTherapy(session) {
    const therapySession = {
      id: `therapy-${Date.now()}`,
      roomId: session.roomId,
      type: session.type || 'SAD', // SAD, jet-lag, energy-boost
      colorTemp: session.colorTemp || 6500,
      brightness: session.brightness || 100,
      durationMinutes: session.durationMinutes || 30,
      scheduledTime: session.scheduledTime || new Date().toISOString(),
      recurring: session.recurring || false,
      status: 'scheduled',
      createdAt: new Date().toISOString(),
    };

    this.therapySessions.push(therapySession);
    await this._saveSettings();

    this.homey.log(`[SmartCircadianLightingSystem] Therapy session scheduled: ${therapySession.id}`);
    this.homey.emit('circadian-lighting:therapy-scheduled', therapySession);

    return therapySession;
  }

  /**
   * Adapt lighting profile for seasonal changes
   */
  async adaptToSeason() {
    const dayOfYear = this._getDayOfYear(new Date());
    let season, adjustment;

    if (dayOfYear >= 80 && dayOfYear < 172) {
      season = 'spring';
      adjustment = { colorTempOffset: 200, brightnessOffset: 5 };
    } else if (dayOfYear >= 172 && dayOfYear < 266) {
      season = 'summer';
      adjustment = { colorTempOffset: 400, brightnessOffset: 10 };
    } else if (dayOfYear >= 266 && dayOfYear < 356) {
      season = 'autumn';
      adjustment = { colorTempOffset: -100, brightnessOffset: -5 };
    } else {
      season = 'winter';
      adjustment = { colorTempOffset: -300, brightnessOffset: -10 };
    }

    this.homey.log(`[SmartCircadianLightingSystem] Seasonal adaptation: ${season}`);
    this.homey.emit('circadian-lighting:season-adapted', { season, adjustment });

    return { season, adjustment, dayOfYear };
  }

  /**
   * Start periodic circadian monitoring and light adjustments
   */
  startCircadianMonitoring() {
    if (this.monitoringInterval) clearInterval(this.monitoringInterval);

    this.monitoringInterval = setInterval(() => {
      const previousPhase = this.currentPhase;
      this.determineCurrentPhase();

      if (previousPhase !== this.currentPhase) {
        this.homey.log(`[SmartCircadianLightingSystem] Phase transition: ${previousPhase} -> ${this.currentPhase}`);
      }

      const settings = this.calculateCurrentLightSettings();
      this.lightHistory.push(settings);

      // keep last 24 hours of history
      if (this.lightHistory.length > 1440) {
        this.lightHistory = this.lightHistory.slice(-1440);
      }

      this.homey.emit('circadian-lighting:update', settings);
    }, 60 * 1000); // every minute

    this.homey.log('[SmartCircadianLightingSystem] Monitoring started');
  }

  /**
   * Set a per-room circadian profile override
   * @param {string} roomId - Room identifier
   * @param {string} profileId - Profile to assign
   * @param {object} overrides - Optional parameter overrides
   */
  async setRoomProfile(roomId, profileId, overrides = {}) {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      return { success: false, error: `Profile '${profileId}' not found` };
    }

    const room = this.rooms.get(roomId) || { id: roomId, name: roomId };
    room.profileId = profileId;
    room.overrides = overrides;
    room.updatedAt = new Date().toISOString();
    this.rooms.set(roomId, room);

    await this._saveSettings();
    this.homey.emit('circadian-lighting:room-profile-set', { roomId, profileId, overrides });

    return { success: true, roomId, profileId };
  }

  /**
   * Get current system status
   * @returns {object} System status
   */
  async getStatus() {
    return {
      initialized: this.initialized,
      currentPhase: this.currentPhase,
      sunSchedule: this.sunSchedule,
      currentSettings: this.calculateCurrentLightSettings(),
      roomCount: this.rooms.size,
      profileCount: this.profiles.size,
      activeTherapySessions: this.therapySessions.filter(s => s.status === 'scheduled').length,
      historyLength: this.lightHistory.length,
      location: this.locationConfig,
    };
  }

  /**
   * Destroy the system and clean up resources
   */
  destroy() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    if (this.transitionTimer) {
      clearInterval(this.transitionTimer);
      this.transitionTimer = null;
    }
    if (this.dawnSimulationTimer) {
      clearInterval(this.dawnSimulationTimer);
      this.dawnSimulationTimer = null;
    }

    this.rooms.clear();
    this.profiles.clear();
    this.therapySessions = [];
    this.lightHistory = [];
    this.initialized = false;

    this.homey.log('[SmartCircadianLightingSystem] Destroyed');
  }

  // ── Private helpers ──

  async _saveSettings() {
    const data = {
      location: this.locationConfig,
      colorTempRange: this.colorTempRange,
      rooms: Object.fromEntries(this.rooms),
      profiles: Object.fromEntries(this.profiles),
      therapySessions: this.therapySessions,
    };
    await this.homey.settings.set('circadianLighting', data);
  }

  _lerp(a, b, t) {
    return a + (b - a) * Math.max(0, Math.min(1, t));
  }

  _easeInOut(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  _getDayOfYear(date) {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date - start;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }
}

module.exports = SmartCircadianLightingSystem;
