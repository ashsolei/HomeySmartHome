'use strict';

/**
 * SmartNoiseManagementSystem - Wave 14
 *
 * Comprehensive smart noise monitoring, management, and acoustic optimization.
 * Handles room acoustic profiles, real-time dB monitoring, quiet zone enforcement,
 * sound masking, sleep environments, appliance noise tracking, party mode,
 * neighbor awareness, baby/child monitoring, work-from-home audio, environmental
 * noise, acoustic optimization, health impact tracking, music management,
 * vibration monitoring, and detailed reporting.
 */

class SmartNoiseManagementSystem {
  constructor(homey) {
    this.homey = homey;

    // Room acoustic profiles (up to 12)
    this.roomProfiles = new Map();

    // Real-time noise data per room
    this.realtimeNoise = new Map();

    // Quiet zone definitions
    this.quietZones = new Map();

    // Sound masking configurations
    this.soundMaskingConfigs = new Map();

    // Sleep sound environments
    this.sleepEnvironments = new Map();

    // Noise schedule rules
    this.noiseSchedules = [];

    // Registered noisy appliances
    this.noisyAppliances = new Map();

    // Party mode state
    this.partyMode = {
      active: false,
      startedAt: null,
      autoReduceTime: '22:00',
      indoorLimitDb: 85,
      outdoorLimitDb: 70,
      neighborTimerHandle: null
    };

    // Neighbor awareness config
    this.neighborAwareness = {
      enabled: false,
      buildingType: 'detached', // detached, semi-detached, townhouse, apartment
      thinWallRooms: [],
      bassFrequencyLimit: 60,
      impactNoiseThreshold: 50
    };

    // Baby/child monitoring
    this.childMonitoring = new Map();

    // Work-from-home state
    this.workFromHome = {
      meetingMode: false,
      focusMode: false,
      officeRoomId: null,
      adjacentRooms: [],
      callActive: false
    };

    // Environmental noise tracking
    this.environmentalNoise = {
      trafficLevel: 0,
      constructionDetected: false,
      stormDetected: false,
      seasonalPattern: 'normal',
      windowsOpenRecommendation: true
    };

    // Acoustic optimization suggestions
    this.acousticSuggestions = new Map();

    // Health impact tracking
    this.healthTracking = {
      dailyExposure: new Map(),
      hearingHealthScores: new Map(),
      childrenExposure: new Map(),
      tinnitusProfiles: new Set(),
      whoLimitDb: 70
    };

    // Music management
    this.musicManagement = {
      activeSources: new Map(),
      volumeNormalization: true,
      transitionZones: new Set(),
      genreVolumeLimits: new Map()
    };

    // Vibration monitoring
    this.vibrationMonitoring = {
      sensors: new Map(),
      hvacBaseline: 0,
      heavyTrafficHours: [],
      isolationRecommendations: []
    };

    // Noise event log
    this.noiseEventLog = [];
    this.maxLogEntries = 5000;

    // Reporting data
    this.reportingData = {
      daily: [],
      weekly: [],
      monthly: [],
      peakEvents: [],
      quietHoursCompliance: 100,
      neighborComplaintPreventionScore: 100
    };

    // Monitoring interval handle
    this.monitoringInterval = null;
    this.monitoringCycleMs = 30000; // 30 seconds

    // Noise source classifications
    this.noiseClassifications = [
      'speech', 'music', 'appliance', 'traffic',
      'construction', 'pet', 'baby_cry', 'impact',
      'hvac', 'weather', 'unknown'
    ];

    // Sound masking types
    this.maskingSoundTypes = [
      'white_noise', 'pink_noise', 'brown_noise',
      'rain', 'forest', 'ocean', 'birds', 'fireplace'
    ];

    // Acoustic surface types
    this.acousticSurfaceTypes = ['soft', 'medium', 'hard'];

    // Room primary use types
    this.roomUseTypes = ['bedroom', 'office', 'living', 'kitchen', 'nursery', 'media'];

    // Default thresholds per room use
    this.defaultThresholds = {
      bedroom: 40,
      office: 45,
      living: 55,
      kitchen: 60,
      nursery: 35,
      media: 70
    };

    // Quiet hours default
    this.quietHoursDefault = {
      start: '22:00',
      end: '07:00',
      maxDb: 35
    };

    this._initialized = false;
  }

  /**
   * Initialize the SmartNoiseManagementSystem
   */
  async initialize() {
    try {
      this.log('Initializing SmartNoiseManagementSystem...');

      await this._loadSavedState();
      this._setupDefaultSchedules();
      this._setupGenreVolumeLimits();
      this._startMonitoringCycle();

      this._initialized = true;
      this.log('SmartNoiseManagementSystem initialized successfully');
    } catch (err) {
      this.error(`Initialization failed: ${err.message}`);
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // 1. Room Acoustic Profiles
  // ---------------------------------------------------------------------------

  /**
   * Register a room acoustic profile
   */
  registerRoomProfile(roomId, config) {
    if (this.roomProfiles.size >= 12) {
      this.error('Maximum of 12 room profiles reached');
      return null;
    }

    const profile = {
      id: roomId,
      name: config.name || roomId,
      microphoneSensorId: config.microphoneSensorId || null,
      baselineNoiseFloorDb: config.baselineNoiseFloorDb || 30,
      acousticType: this.acousticSurfaceTypes.includes(config.acousticType)
        ? config.acousticType : 'medium',
      reverberationTimeEstimate: config.reverberationTimeEstimate || 0.5,
      roomVolumeM3: config.roomVolumeM3 || 40,
      primaryUse: this.roomUseTypes.includes(config.primaryUse)
        ? config.primaryUse : 'living',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.roomProfiles.set(roomId, profile);

    // Initialize real-time noise data for this room
    this.realtimeNoise.set(roomId, {
      currentDb: profile.baselineNoiseFloorDb,
      peakDb: profile.baselineNoiseFloorDb,
      peakTimestamp: null,
      avg1min: profile.baselineNoiseFloorDb,
      avg5min: profile.baselineNoiseFloorDb,
      avg15min: profile.baselineNoiseFloorDb,
      avg60min: profile.baselineNoiseFloorDb,
      samples1min: [],
      samples5min: [],
      samples15min: [],
      samples60min: [],
      lastClassification: 'unknown',
      classificationHistory: []
    });

    this.log(`Room profile registered: ${profile.name} (${roomId}), use: ${profile.primaryUse}, acoustic: ${profile.acousticType}`);
    return profile;
  }

  /**
   * Update a room acoustic profile
   */
  updateRoomProfile(roomId, updates) {
    const profile = this.roomProfiles.get(roomId);
    if (!profile) {
      this.error(`Room profile not found: ${roomId}`);
      return null;
    }

    if (updates.acousticType && this.acousticSurfaceTypes.includes(updates.acousticType)) {
      profile.acousticType = updates.acousticType;
    }
    if (updates.primaryUse && this.roomUseTypes.includes(updates.primaryUse)) {
      profile.primaryUse = updates.primaryUse;
    }
    if (typeof updates.baselineNoiseFloorDb === 'number') {
      profile.baselineNoiseFloorDb = updates.baselineNoiseFloorDb;
    }
    if (typeof updates.reverberationTimeEstimate === 'number') {
      profile.reverberationTimeEstimate = updates.reverberationTimeEstimate;
    }
    if (typeof updates.roomVolumeM3 === 'number') {
      profile.roomVolumeM3 = updates.roomVolumeM3;
    }
    if (updates.name) {
      profile.name = updates.name;
    }
    if (updates.microphoneSensorId) {
      profile.microphoneSensorId = updates.microphoneSensorId;
    }

    profile.updatedAt = Date.now();
    this.roomProfiles.set(roomId, profile);
    this.log(`Room profile updated: ${roomId}`);
    return profile;
  }

  /**
   * Remove a room profile
   */
  removeRoomProfile(roomId) {
    const existed = this.roomProfiles.delete(roomId);
    if (existed) {
      this.realtimeNoise.delete(roomId);
      this.quietZones.delete(roomId);
      this.soundMaskingConfigs.delete(roomId);
      this.sleepEnvironments.delete(roomId);
      this.log(`Room profile removed: ${roomId}`);
    }
    return existed;
  }

  /**
   * Get a room profile
   */
  getRoomProfile(roomId) {
    return this.roomProfiles.get(roomId) || null;
  }

  /**
   * Get all room profiles
   */
  getAllRoomProfiles() {
    return Array.from(this.roomProfiles.values());
  }

  // ---------------------------------------------------------------------------
  // 2. Real-time Noise Monitoring
  // ---------------------------------------------------------------------------

  /**
   * Process a noise sample from a room microphone
   */
  processNoiseSample(roomId, dbLevel, sourceClassification) {
    const noiseData = this.realtimeNoise.get(roomId);
    if (!noiseData) {
      return;
    }

    const now = Date.now();
    const sample = { db: dbLevel, timestamp: now };

    noiseData.currentDb = dbLevel;

    // Peak detection
    if (dbLevel > noiseData.peakDb) {
      noiseData.peakDb = dbLevel;
      noiseData.peakTimestamp = now;
    }

    // Add to sample windows
    noiseData.samples1min.push(sample);
    noiseData.samples5min.push(sample);
    noiseData.samples15min.push(sample);
    noiseData.samples60min.push(sample);

    // Trim samples to their window
    const oneMinAgo = now - 60000;
    const fiveMinAgo = now - 300000;
    const fifteenMinAgo = now - 900000;
    const sixtyMinAgo = now - 3600000;

    noiseData.samples1min = noiseData.samples1min.filter(s => s.timestamp >= oneMinAgo);
    noiseData.samples5min = noiseData.samples5min.filter(s => s.timestamp >= fiveMinAgo);
    noiseData.samples15min = noiseData.samples15min.filter(s => s.timestamp >= fifteenMinAgo);
    noiseData.samples60min = noiseData.samples60min.filter(s => s.timestamp >= sixtyMinAgo);

    // Update averages
    noiseData.avg1min = this._calculateAverage(noiseData.samples1min);
    noiseData.avg5min = this._calculateAverage(noiseData.samples5min);
    noiseData.avg15min = this._calculateAverage(noiseData.samples15min);
    noiseData.avg60min = this._calculateAverage(noiseData.samples60min);

    // Source classification
    const classification = this.noiseClassifications.includes(sourceClassification)
      ? sourceClassification : 'unknown';
    noiseData.lastClassification = classification;
    noiseData.classificationHistory.push({ classification, timestamp: now, db: dbLevel });
    if (noiseData.classificationHistory.length > 200) {
      noiseData.classificationHistory = noiseData.classificationHistory.slice(-100);
    }

    this.realtimeNoise.set(roomId, noiseData);

    // Check quiet zone thresholds
    this._checkQuietZoneViolation(roomId, dbLevel);

    // Update health tracking
    this._updateHealthExposure(roomId, dbLevel);

    // Log peak events
    if (dbLevel > 80) {
      this._logNoiseEvent(roomId, 'peak', dbLevel, classification);
    }
  }

  /**
   * Get current noise data for a room
   */
  getRoomNoiseData(roomId) {
    return this.realtimeNoise.get(roomId) || null;
  }

  /**
   * Get noise data for all rooms
   */
  getAllRoomNoiseData() {
    const result = {};
    for (const [roomId, data] of this.realtimeNoise) {
      result[roomId] = { ...data };
    }
    return result;
  }

  /**
   * Reset peak for a room
   */
  resetPeak(roomId) {
    const noiseData = this.realtimeNoise.get(roomId);
    if (noiseData) {
      noiseData.peakDb = noiseData.currentDb;
      noiseData.peakTimestamp = Date.now();
      this.log(`Peak reset for room ${roomId}`);
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Quiet Zone Enforcement
  // ---------------------------------------------------------------------------

  /**
   * Define a quiet zone
   */
  defineQuietZone(roomId, config) {
    const profile = this.roomProfiles.get(roomId);
    if (!profile) {
      this.error(`Cannot define quiet zone: room ${roomId} not found`);
      return null;
    }

    const zone = {
      roomId,
      maxDbThreshold: config.maxDbThreshold || this.defaultThresholds[profile.primaryUse] || 45,
      activeHoursStart: config.activeHoursStart || '00:00',
      activeHoursEnd: config.activeHoursEnd || '23:59',
      violationAlerts: config.violationAlerts !== false,
      autoCloseWindowsOnBreach: config.autoCloseWindowsOnBreach || false,
      autoCloseDoorsOnBreach: config.autoCloseDoorsOnBreach || false,
      enabled: config.enabled !== false,
      violationCount: 0,
      lastViolation: null,
      createdAt: Date.now()
    };

    this.quietZones.set(roomId, zone);
    this.log(`Quiet zone defined: ${roomId}, threshold: ${zone.maxDbThreshold}dB, hours: ${zone.activeHoursStart}-${zone.activeHoursEnd}`);
    return zone;
  }

  /**
   * Update quiet zone settings
   */
  updateQuietZone(roomId, updates) {
    const zone = this.quietZones.get(roomId);
    if (!zone) {
      this.error(`Quiet zone not found: ${roomId}`);
      return null;
    }

    if (typeof updates.maxDbThreshold === 'number') zone.maxDbThreshold = updates.maxDbThreshold;
    if (updates.activeHoursStart) zone.activeHoursStart = updates.activeHoursStart;
    if (updates.activeHoursEnd) zone.activeHoursEnd = updates.activeHoursEnd;
    if (typeof updates.violationAlerts === 'boolean') zone.violationAlerts = updates.violationAlerts;
    if (typeof updates.autoCloseWindowsOnBreach === 'boolean') zone.autoCloseWindowsOnBreach = updates.autoCloseWindowsOnBreach;
    if (typeof updates.autoCloseDoorsOnBreach === 'boolean') zone.autoCloseDoorsOnBreach = updates.autoCloseDoorsOnBreach;
    if (typeof updates.enabled === 'boolean') zone.enabled = updates.enabled;

    this.quietZones.set(roomId, zone);
    this.log(`Quiet zone updated: ${roomId}`);
    return zone;
  }

  /**
   * Remove a quiet zone
   */
  removeQuietZone(roomId) {
    return this.quietZones.delete(roomId);
  }

  /**
   * Check if a noise level violates a quiet zone
   */
  _checkQuietZoneViolation(roomId, dbLevel) {
    const zone = this.quietZones.get(roomId);
    if (!zone || !zone.enabled) return;

    // Check if within active hours
    if (!this._isWithinTimeRange(zone.activeHoursStart, zone.activeHoursEnd)) return;

    // Party mode overrides quiet zones for non-nursery rooms
    const profile = this.roomProfiles.get(roomId);
    if (this.partyMode.active && profile && profile.primaryUse !== 'nursery') return;

    if (dbLevel > zone.maxDbThreshold) {
      zone.violationCount++;
      zone.lastViolation = Date.now();

      if (zone.violationAlerts) {
        this.log(`QUIET ZONE VIOLATION: ${roomId} at ${dbLevel}dB (threshold: ${zone.maxDbThreshold}dB)`);
        this._emitEvent('quiet_zone_violation', {
          roomId,
          currentDb: dbLevel,
          threshold: zone.maxDbThreshold,
          violationCount: zone.violationCount
        });
      }

      if (zone.autoCloseWindowsOnBreach) {
        this._triggerAutoCloseWindows(roomId);
      }
      if (zone.autoCloseDoorsOnBreach) {
        this._triggerAutoCloseDoors(roomId);
      }

      this._logNoiseEvent(roomId, 'quiet_zone_violation', dbLevel, 'threshold_breach');
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Sound Masking
  // ---------------------------------------------------------------------------

  /**
   * Configure sound masking for a room
   */
  configureSoundMasking(roomId, config) {
    if (!this.roomProfiles.has(roomId)) {
      this.error(`Room not found for sound masking: ${roomId}`);
      return null;
    }

    const masking = {
      roomId,
      soundType: this.maskingSoundTypes.includes(config.soundType)
        ? config.soundType : 'white_noise',
      volumePercent: Math.min(100, Math.max(0, config.volumePercent || 30)),
      autoActivateInQuietZone: config.autoActivateInQuietZone || false,
      fadeInDurationMs: config.fadeInDurationMs || 5000,
      fadeOutDurationMs: config.fadeOutDurationMs || 5000,
      active: false,
      speakerDeviceId: config.speakerDeviceId || null,
      scheduledStart: config.scheduledStart || null,
      scheduledEnd: config.scheduledEnd || null,
      createdAt: Date.now()
    };

    this.soundMaskingConfigs.set(roomId, masking);
    this.log(`Sound masking configured: ${roomId}, type: ${masking.soundType}, volume: ${masking.volumePercent}%`);
    return masking;
  }

  /**
   * Activate sound masking in a room
   */
  activateSoundMasking(roomId) {
    const masking = this.soundMaskingConfigs.get(roomId);
    if (!masking) {
      this.error(`No sound masking config for room: ${roomId}`);
      return false;
    }

    masking.active = true;
    this.log(`Sound masking activated: ${roomId} (${masking.soundType} at ${masking.volumePercent}%)`);
    this._emitEvent('sound_masking_activated', {
      roomId,
      soundType: masking.soundType,
      volume: masking.volumePercent,
      fadeInMs: masking.fadeInDurationMs
    });
    return true;
  }

  /**
   * Deactivate sound masking in a room
   */
  deactivateSoundMasking(roomId) {
    const masking = this.soundMaskingConfigs.get(roomId);
    if (!masking) return false;

    masking.active = false;
    this.log(`Sound masking deactivated: ${roomId} (fade out ${masking.fadeOutDurationMs}ms)`);
    this._emitEvent('sound_masking_deactivated', {
      roomId,
      fadeOutMs: masking.fadeOutDurationMs
    });
    return true;
  }

  /**
   * Update sound masking volume
   */
  setSoundMaskingVolume(roomId, volumePercent) {
    const masking = this.soundMaskingConfigs.get(roomId);
    if (!masking) return false;

    masking.volumePercent = Math.min(100, Math.max(0, volumePercent));
    this.log(`Sound masking volume set: ${roomId} -> ${masking.volumePercent}%`);
    return true;
  }

  /**
   * Change sound masking type
   */
  setSoundMaskingType(roomId, soundType) {
    const masking = this.soundMaskingConfigs.get(roomId);
    if (!masking) return false;

    if (this.maskingSoundTypes.includes(soundType)) {
      masking.soundType = soundType;
      this.log(`Sound masking type changed: ${roomId} -> ${soundType}`);
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // 5. Sleep Sound Environment
  // ---------------------------------------------------------------------------

  /**
   * Configure sleep sound environment for a bedroom
   */
  configureSleepEnvironment(roomId, config) {
    const profile = this.roomProfiles.get(roomId);
    if (!profile) {
      this.error(`Room not found for sleep environment: ${roomId}`);
      return null;
    }

    const sleepEnv = {
      roomId,
      targetDb: config.targetDb || 30,
      autoMaskingEnabled: config.autoMaskingEnabled !== false,
      maskingThresholdDb: config.maskingThresholdDb || 35,
      maskingSoundType: this.maskingSoundTypes.includes(config.maskingSoundType)
        ? config.maskingSoundType : 'pink_noise',
      maskingVolume: config.maskingVolume || 25,
      fadeOutDurationMin: config.fadeOutDurationMin || 30,
      wakeUpSoundEnabled: config.wakeUpSoundEnabled || false,
      wakeUpSoundType: config.wakeUpSoundType || 'birds',
      wakeUpRampDurationMin: config.wakeUpRampDurationMin || 10,
      wakeUpTime: config.wakeUpTime || '07:00',
      partnerCompatible: config.partnerCompatible || false,
      partnerZoneSpeakerId: config.partnerZoneSpeakerId || null,
      partnerSoundType: config.partnerSoundType || 'white_noise',
      partnerVolume: config.partnerVolume || 20,
      babyMonitorIntegration: config.babyMonitorIntegration || false,
      babyMonitorDeviceId: config.babyMonitorDeviceId || null,
      active: false,
      bedtimeStart: config.bedtimeStart || '22:00',
      bedtimeEnd: config.bedtimeEnd || '07:00',
      createdAt: Date.now()
    };

    this.sleepEnvironments.set(roomId, sleepEnv);
    this.log(`Sleep environment configured: ${roomId}, target: ${sleepEnv.targetDb}dB, masking: ${sleepEnv.maskingSoundType}`);
    return sleepEnv;
  }

  /**
   * Activate sleep mode for a room
   */
  activateSleepMode(roomId) {
    const sleepEnv = this.sleepEnvironments.get(roomId);
    if (!sleepEnv) {
      this.error(`No sleep environment for room: ${roomId}`);
      return false;
    }

    sleepEnv.active = true;

    // Auto-define quiet zone for sleep
    this.defineQuietZone(roomId, {
      maxDbThreshold: sleepEnv.targetDb,
      activeHoursStart: sleepEnv.bedtimeStart,
      activeHoursEnd: sleepEnv.bedtimeEnd,
      violationAlerts: true,
      autoCloseWindowsOnBreach: true,
      autoCloseDoorsOnBreach: true
    });

    // Activate sound masking if enabled
    if (sleepEnv.autoMaskingEnabled) {
      this.configureSoundMasking(roomId, {
        soundType: sleepEnv.maskingSoundType,
        volumePercent: sleepEnv.maskingVolume,
        fadeInDurationMs: 10000,
        fadeOutDurationMs: sleepEnv.fadeOutDurationMin * 60 * 1000
      });
      this.activateSoundMasking(roomId);
    }

    this.log(`Sleep mode activated: ${roomId}`);
    this._emitEvent('sleep_mode_activated', { roomId, targetDb: sleepEnv.targetDb });
    return true;
  }

  /**
   * Deactivate sleep mode
   */
  deactivateSleepMode(roomId) {
    const sleepEnv = this.sleepEnvironments.get(roomId);
    if (!sleepEnv) return false;

    sleepEnv.active = false;
    this.deactivateSoundMasking(roomId);
    this.log(`Sleep mode deactivated: ${roomId}`);
    this._emitEvent('sleep_mode_deactivated', { roomId });
    return true;
  }

  /**
   * Trigger wake-up sound ramp
   */
  triggerWakeUpRamp(roomId) {
    const sleepEnv = this.sleepEnvironments.get(roomId);
    if (!sleepEnv || !sleepEnv.wakeUpSoundEnabled) return false;

    this.log(`Wake-up ramp triggered: ${roomId}, sound: ${sleepEnv.wakeUpSoundType}, duration: ${sleepEnv.wakeUpRampDurationMin}min`);
    this._emitEvent('wakeup_ramp_started', {
      roomId,
      soundType: sleepEnv.wakeUpSoundType,
      durationMin: sleepEnv.wakeUpRampDurationMin
    });

    // Gradually fade out sleep masking and fade in wake-up sound
    this.deactivateSoundMasking(roomId);
    return true;
  }

  // ---------------------------------------------------------------------------
  // 6. Noise Schedule
  // ---------------------------------------------------------------------------

  /**
   * Add a noise schedule rule
   */
  addNoiseSchedule(rule) {
    const schedule = {
      id: `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name: rule.name || 'Unnamed Schedule',
      type: rule.type || 'quiet_hours', // quiet_hours, work_hours, custom
      startTime: rule.startTime || '22:00',
      endTime: rule.endTime || '07:00',
      maxDb: rule.maxDb || 35,
      daysOfWeek: rule.daysOfWeek || [0, 1, 2, 3, 4, 5, 6], // 0=Sunday
      affectedRooms: rule.affectedRooms || [], // empty = all rooms
      isHolidayOverride: rule.isHolidayOverride || false,
      seasonalAdjustment: rule.seasonalAdjustment || null, // { summer: +5, winter: 0 }
      enabled: rule.enabled !== false,
      createdAt: Date.now()
    };

    this.noiseSchedules.push(schedule);
    this.log(`Noise schedule added: ${schedule.name} (${schedule.startTime}-${schedule.endTime}, max ${schedule.maxDb}dB)`);
    return schedule;
  }

  /**
   * Remove a noise schedule
   */
  removeNoiseSchedule(scheduleId) {
    const idx = this.noiseSchedules.findIndex(s => s.id === scheduleId);
    if (idx >= 0) {
      const removed = this.noiseSchedules.splice(idx, 1)[0];
      this.log(`Noise schedule removed: ${removed.name}`);
      return true;
    }
    return false;
  }

  /**
   * Update a noise schedule
   */
  updateNoiseSchedule(scheduleId, updates) {
    const schedule = this.noiseSchedules.find(s => s.id === scheduleId);
    if (!schedule) return null;

    if (updates.name) schedule.name = updates.name;
    if (updates.startTime) schedule.startTime = updates.startTime;
    if (updates.endTime) schedule.endTime = updates.endTime;
    if (typeof updates.maxDb === 'number') schedule.maxDb = updates.maxDb;
    if (updates.daysOfWeek) schedule.daysOfWeek = updates.daysOfWeek;
    if (updates.affectedRooms) schedule.affectedRooms = updates.affectedRooms;
    if (typeof updates.isHolidayOverride === 'boolean') schedule.isHolidayOverride = updates.isHolidayOverride;
    if (updates.seasonalAdjustment !== undefined) schedule.seasonalAdjustment = updates.seasonalAdjustment;
    if (typeof updates.enabled === 'boolean') schedule.enabled = updates.enabled;

    this.log(`Noise schedule updated: ${schedule.name}`);
    return schedule;
  }

  /**
   * Get active schedules for current time
   */
  getActiveSchedules() {
    const now = new Date();
    const dayOfWeek = now.getDay();

    return this.noiseSchedules.filter(schedule => {
      if (!schedule.enabled) return false;
      if (!schedule.daysOfWeek.includes(dayOfWeek)) return false;
      return this._isWithinTimeRange(schedule.startTime, schedule.endTime);
    });
  }

  /**
   * Get effective max dB for a room right now
   */
  getEffectiveMaxDb(roomId) {
    let effectiveMax = 100; // No limit by default

    // Check quiet zones
    const zone = this.quietZones.get(roomId);
    if (zone && zone.enabled && this._isWithinTimeRange(zone.activeHoursStart, zone.activeHoursEnd)) {
      effectiveMax = Math.min(effectiveMax, zone.maxDbThreshold);
    }

    // Check schedules
    const activeSchedules = this.getActiveSchedules();
    for (const schedule of activeSchedules) {
      if (schedule.affectedRooms.length === 0 || schedule.affectedRooms.includes(roomId)) {
        let maxDb = schedule.maxDb;

        // Apply seasonal adjustment
        if (schedule.seasonalAdjustment) {
          const month = new Date().getMonth();
          if (month >= 5 && month <= 8 && schedule.seasonalAdjustment.summer) {
            maxDb += schedule.seasonalAdjustment.summer;
          } else if ((month <= 1 || month >= 11) && schedule.seasonalAdjustment.winter) {
            maxDb += schedule.seasonalAdjustment.winter;
          }
        }

        effectiveMax = Math.min(effectiveMax, maxDb);
      }
    }

    // Party mode overrides (except nursery)
    const profile = this.roomProfiles.get(roomId);
    if (this.partyMode.active && profile && profile.primaryUse !== 'nursery') {
      effectiveMax = this.partyMode.indoorLimitDb;
    }

    return effectiveMax;
  }

  // ---------------------------------------------------------------------------
  // 7. Appliance Noise Tracking
  // ---------------------------------------------------------------------------

  /**
   * Register a noisy appliance
   */
  registerNoisyAppliance(applianceId, config) {
    const appliance = {
      id: applianceId,
      name: config.name || applianceId,
      typicalNoiseDb: config.typicalNoiseDb || 55,
      roomId: config.roomId || null,
      preferredRunHoursStart: config.preferredRunHoursStart || '09:00',
      preferredRunHoursEnd: config.preferredRunHoursEnd || '20:00',
      warnDuringQuietHours: config.warnDuringQuietHours !== false,
      isRunning: false,
      lastRunAt: null,
      totalRunTimeMs: 0,
      createdAt: Date.now()
    };

    this.noisyAppliances.set(applianceId, appliance);
    this.log(`Noisy appliance registered: ${appliance.name} (${appliance.typicalNoiseDb}dB)`);
    return appliance;
  }

  /**
   * Mark appliance as running
   */
  startAppliance(applianceId) {
    const appliance = this.noisyAppliances.get(applianceId);
    if (!appliance) return null;

    // Check if during quiet hours and warn
    if (appliance.warnDuringQuietHours) {
      const activeSchedules = this.getActiveSchedules();
      const inQuietHours = activeSchedules.some(s => s.type === 'quiet_hours');
      if (inQuietHours) {
        this.log(`WARNING: Appliance ${appliance.name} starting during quiet hours (${appliance.typicalNoiseDb}dB)`);
        this._emitEvent('appliance_quiet_hours_warning', {
          applianceId,
          name: appliance.name,
          noiseDb: appliance.typicalNoiseDb
        });
      }
    }

    appliance.isRunning = true;
    appliance.lastRunAt = Date.now();
    this.log(`Appliance started: ${appliance.name}`);
    return appliance;
  }

  /**
   * Mark appliance as stopped
   */
  stopAppliance(applianceId) {
    const appliance = this.noisyAppliances.get(applianceId);
    if (!appliance || !appliance.isRunning) return null;

    appliance.isRunning = false;
    if (appliance.lastRunAt) {
      appliance.totalRunTimeMs += Date.now() - appliance.lastRunAt;
    }
    this.log(`Appliance stopped: ${appliance.name}`);
    return appliance;
  }

  /**
   * Check if it's a good time to run a noisy appliance
   */
  isGoodTimeForAppliance(applianceId) {
    const appliance = this.noisyAppliances.get(applianceId);
    if (!appliance) return { ok: false, reason: 'Appliance not found' };

    // Check quiet hours
    const activeSchedules = this.getActiveSchedules();
    const inQuietHours = activeSchedules.some(s => s.type === 'quiet_hours');
    if (inQuietHours) {
      return { ok: false, reason: 'Currently in quiet hours' };
    }

    // Check preferred run hours
    if (!this._isWithinTimeRange(appliance.preferredRunHoursStart, appliance.preferredRunHoursEnd)) {
      return { ok: false, reason: 'Outside preferred run hours' };
    }

    // Check sleep modes
    for (const [, sleepEnv] of this.sleepEnvironments) {
      if (sleepEnv.active) {
        return { ok: false, reason: 'Sleep mode active in a room' };
      }
    }

    // Check if someone is in a meeting
    if (this.workFromHome.meetingMode || this.workFromHome.callActive) {
      return { ok: false, reason: 'Meeting or call active' };
    }

    return { ok: true, reason: 'Good time to run' };
  }

  /**
   * Get suggested best time to run an appliance
   */
  getSuggestedRunTime(applianceId) {
    const appliance = this.noisyAppliances.get(applianceId);
    if (!appliance) return null;

    return {
      suggestedStart: appliance.preferredRunHoursStart,
      suggestedEnd: appliance.preferredRunHoursEnd,
      avoidQuietHours: true,
      avoidSleepMode: true,
      avoidMeetings: this.workFromHome.officeRoomId !== null
    };
  }

  // ---------------------------------------------------------------------------
  // 8. Party Mode
  // ---------------------------------------------------------------------------

  /**
   * Activate party mode
   */
  activatePartyMode(config) {
    this.partyMode.active = true;
    this.partyMode.startedAt = Date.now();

    if (typeof config.indoorLimitDb === 'number') this.partyMode.indoorLimitDb = config.indoorLimitDb;
    if (typeof config.outdoorLimitDb === 'number') this.partyMode.outdoorLimitDb = config.outdoorLimitDb;
    if (config.autoReduceTime) this.partyMode.autoReduceTime = config.autoReduceTime;

    // Set up neighbor consideration timer
    this._setupPartyAutoReduce();

    this.log(`Party mode activated! Indoor limit: ${this.partyMode.indoorLimitDb}dB, outdoor: ${this.partyMode.outdoorLimitDb}dB, auto-reduce at ${this.partyMode.autoReduceTime}`);
    this._emitEvent('party_mode_activated', {
      indoorLimit: this.partyMode.indoorLimitDb,
      outdoorLimit: this.partyMode.outdoorLimitDb,
      autoReduceTime: this.partyMode.autoReduceTime
    });
    return this.partyMode;
  }

  /**
   * Deactivate party mode
   */
  deactivatePartyMode() {
    this.partyMode.active = false;
    this.partyMode.startedAt = null;
    if (this.partyMode.neighborTimerHandle) {
      clearTimeout(this.partyMode.neighborTimerHandle);
      this.partyMode.neighborTimerHandle = null;
    }

    this.log('Party mode deactivated');
    this._emitEvent('party_mode_deactivated', {});
    return true;
  }

  /**
   * Set up auto-reduce for party mode
   */
  _setupPartyAutoReduce() {
    if (this.partyMode.neighborTimerHandle) {
      clearTimeout(this.partyMode.neighborTimerHandle);
    }

    const now = new Date();
    const [hours, minutes] = this.partyMode.autoReduceTime.split(':').map(Number);
    const reduceTime = new Date();
    reduceTime.setHours(hours, minutes, 0, 0);

    if (reduceTime <= now) {
      reduceTime.setDate(reduceTime.getDate() + 1);
    }

    const msUntilReduce = reduceTime.getTime() - now.getTime();

    this.partyMode.neighborTimerHandle = setTimeout(() => {
      if (this.partyMode.active) {
        this.log(`Auto-reducing party mode volumes at ${this.partyMode.autoReduceTime}`);
        this.partyMode.indoorLimitDb = Math.min(this.partyMode.indoorLimitDb, 65);
        this.partyMode.outdoorLimitDb = Math.min(this.partyMode.outdoorLimitDb, 55);
        this._emitEvent('party_mode_auto_reduced', {
          indoorLimit: this.partyMode.indoorLimitDb,
          outdoorLimit: this.partyMode.outdoorLimitDb
        });
      }
    }, msUntilReduce);
  }

  /**
   * Get party mode status
   */
  getPartyModeStatus() {
    return {
      ...this.partyMode,
      neighborTimerHandle: this.partyMode.neighborTimerHandle ? 'active' : null,
      durationMs: this.partyMode.startedAt ? Date.now() - this.partyMode.startedAt : 0
    };
  }

  // ---------------------------------------------------------------------------
  // 9. Neighbor Awareness
  // ---------------------------------------------------------------------------

  /**
   * Configure neighbor awareness
   */
  configureNeighborAwareness(config) {
    if (config.buildingType) {
      const types = ['detached', 'semi-detached', 'townhouse', 'apartment'];
      if (types.includes(config.buildingType)) {
        this.neighborAwareness.buildingType = config.buildingType;
      }
    }
    if (Array.isArray(config.thinWallRooms)) {
      this.neighborAwareness.thinWallRooms = config.thinWallRooms;
    }
    if (typeof config.bassFrequencyLimit === 'number') {
      this.neighborAwareness.bassFrequencyLimit = config.bassFrequencyLimit;
    }
    if (typeof config.impactNoiseThreshold === 'number') {
      this.neighborAwareness.impactNoiseThreshold = config.impactNoiseThreshold;
    }
    if (typeof config.enabled === 'boolean') {
      this.neighborAwareness.enabled = config.enabled;
    }

    // Apply stricter limits for apartments/townhouses
    if (this.neighborAwareness.buildingType === 'apartment' || this.neighborAwareness.buildingType === 'townhouse') {
      this.neighborAwareness.bassFrequencyLimit = Math.min(this.neighborAwareness.bassFrequencyLimit, 50);
      this.neighborAwareness.impactNoiseThreshold = Math.min(this.neighborAwareness.impactNoiseThreshold, 45);
    }

    this.log(`Neighbor awareness configured: type=${this.neighborAwareness.buildingType}, enabled=${this.neighborAwareness.enabled}`);
    return this.neighborAwareness;
  }

  /**
   * Assess neighbor noise risk for a room
   */
  assessNeighborNoiseRisk(roomId) {
    const noiseData = this.realtimeNoise.get(roomId);
    if (!noiseData) return null;

    const isThinWall = this.neighborAwareness.thinWallRooms.includes(roomId);
    const currentDb = noiseData.currentDb;
    const buildingFactor = this._getBuildingTypeFactor();

    const riskScore = Math.min(100, Math.max(0,
      (currentDb / 100) * 50 +
      (isThinWall ? 20 : 0) +
      (buildingFactor * 30)
    ));

    const mitigations = [];
    if (currentDb > 60) mitigations.push('Reduce volume');
    if (isThinWall) mitigations.push('Use sound masking in shared wall rooms');
    if (noiseData.lastClassification === 'music') mitigations.push('Reduce bass frequencies');
    if (this.neighborAwareness.buildingType === 'apartment') mitigations.push('Use headphones after 22:00');

    return {
      roomId,
      riskScore,
      riskLevel: riskScore < 30 ? 'low' : riskScore < 60 ? 'medium' : 'high',
      currentDb,
      isThinWall,
      buildingType: this.neighborAwareness.buildingType,
      mitigations
    };
  }

  _getBuildingTypeFactor() {
    switch (this.neighborAwareness.buildingType) {
      case 'apartment': return 1.0;
      case 'townhouse': return 0.7;
      case 'semi-detached': return 0.4;
      case 'detached': return 0.1;
      default: return 0.5;
    }
  }

  // ---------------------------------------------------------------------------
  // 10. Baby/Child Monitoring
  // ---------------------------------------------------------------------------

  /**
   * Configure child monitoring for a room
   */
  configureChildMonitoring(roomId, config) {
    const monitoring = {
      roomId,
      childName: config.childName || 'Child',
      childAge: config.childAge || 'infant', // infant, toddler, child
      cryDetectionEnabled: config.cryDetectionEnabled !== false,
      cryTypes: ['hungry', 'tired', 'pain'],
      alertParents: config.alertParents !== false,
      parentDevices: config.parentDevices || [],
      napTimeAutoQuietZone: config.napTimeAutoQuietZone !== false,
      napTimeStart: config.napTimeStart || '13:00',
      napTimeEnd: config.napTimeEnd || '15:00',
      toddlerNoiseTolerance: config.toddlerNoiseTolerance || 65,
      nightMonitorEnabled: config.nightMonitorEnabled !== false,
      nightStart: config.nightStart || '19:00',
      nightEnd: config.nightEnd || '07:00',
      lastCryDetected: null,
      lastCryType: null,
      cryEventCount: 0,
      active: true,
      createdAt: Date.now()
    };

    this.childMonitoring.set(roomId, monitoring);

    // Auto-configure quiet zone for nursery
    if (monitoring.napTimeAutoQuietZone) {
      this.defineQuietZone(roomId, {
        maxDbThreshold: 35,
        activeHoursStart: monitoring.napTimeStart,
        activeHoursEnd: monitoring.napTimeEnd,
        violationAlerts: true,
        autoCloseDoorsOnBreach: true
      });
    }

    this.log(`Child monitoring configured: ${monitoring.childName} in ${roomId}, age: ${monitoring.childAge}`);
    return monitoring;
  }

  /**
   * Process a potential cry detection event
   */
  processCryDetection(roomId, cryType, confidence) {
    const monitoring = this.childMonitoring.get(roomId);
    if (!monitoring || !monitoring.cryDetectionEnabled || !monitoring.active) return;

    if (confidence < 0.6) return; // Ignore low-confidence detections

    const validCryTypes = ['hungry', 'tired', 'pain'];
    const detectedType = validCryTypes.includes(cryType) ? cryType : 'unknown';

    monitoring.lastCryDetected = Date.now();
    monitoring.lastCryType = detectedType;
    monitoring.cryEventCount++;

    this.log(`Cry detected in ${roomId}: ${detectedType} (confidence: ${(confidence * 100).toFixed(0)}%) - ${monitoring.childName}`);

    if (monitoring.alertParents) {
      this._emitEvent('baby_cry_detected', {
        roomId,
        childName: monitoring.childName,
        cryType: detectedType,
        confidence,
        timestamp: Date.now()
      });
    }

    this._logNoiseEvent(roomId, 'baby_cry', 0, detectedType);
  }

  /**
   * Activate nap time for a child's room
   */
  activateNapTime(roomId) {
    const monitoring = this.childMonitoring.get(roomId);
    if (!monitoring) return false;

    this.defineQuietZone(roomId, {
      maxDbThreshold: 30,
      activeHoursStart: '00:00',
      activeHoursEnd: '23:59',
      violationAlerts: true,
      autoCloseDoorsOnBreach: true,
      autoCloseWindowsOnBreach: true
    });

    this.log(`Nap time activated for ${monitoring.childName} in ${roomId}`);
    this._emitEvent('nap_time_activated', { roomId, childName: monitoring.childName });
    return true;
  }

  /**
   * Deactivate nap time
   */
  deactivateNapTime(roomId) {
    const monitoring = this.childMonitoring.get(roomId);
    if (!monitoring) return false;

    // Restore normal quiet zone
    if (monitoring.napTimeAutoQuietZone) {
      this.defineQuietZone(roomId, {
        maxDbThreshold: 35,
        activeHoursStart: monitoring.napTimeStart,
        activeHoursEnd: monitoring.napTimeEnd,
        violationAlerts: true,
        autoCloseDoorsOnBreach: true
      });
    }

    this.log(`Nap time deactivated for ${monitoring.childName} in ${roomId}`);
    return true;
  }

  // ---------------------------------------------------------------------------
  // 11. Work-from-Home
  // ---------------------------------------------------------------------------

  /**
   * Configure work-from-home settings
   */
  configureWorkFromHome(config) {
    if (config.officeRoomId) this.workFromHome.officeRoomId = config.officeRoomId;
    if (Array.isArray(config.adjacentRooms)) this.workFromHome.adjacentRooms = config.adjacentRooms;

    this.log(`Work-from-home configured: office=${this.workFromHome.officeRoomId}, adjacent rooms: ${this.workFromHome.adjacentRooms.length}`);
    return this.workFromHome;
  }

  /**
   * Activate meeting mode
   */
  activateMeetingMode() {
    this.workFromHome.meetingMode = true;
    this.workFromHome.callActive = true;

    const officeId = this.workFromHome.officeRoomId;
    if (officeId) {
      // Activate office sound masking for privacy
      this.configureSoundMasking(officeId, {
        soundType: 'white_noise',
        volumePercent: 15,
        fadeInDurationMs: 3000,
        fadeOutDurationMs: 3000
      });
    }

    // Suppress household noise notifications for adjacent rooms
    this.log('Meeting mode activated: suppressing household noise notifications');
    this._emitEvent('meeting_mode_activated', {
      officeRoom: officeId,
      adjacentRooms: this.workFromHome.adjacentRooms,
      actions: ['close_windows', 'mute_adjacent_speakers', 'suppress_alerts']
    });
    return true;
  }

  /**
   * Deactivate meeting mode
   */
  deactivateMeetingMode() {
    this.workFromHome.meetingMode = false;
    this.workFromHome.callActive = false;

    const officeId = this.workFromHome.officeRoomId;
    if (officeId) {
      this.deactivateSoundMasking(officeId);
    }

    this.log('Meeting mode deactivated');
    this._emitEvent('meeting_mode_deactivated', {});
    return true;
  }

  /**
   * Activate focus mode
   */
  activateFocusMode() {
    this.workFromHome.focusMode = true;

    const officeId = this.workFromHome.officeRoomId;
    if (officeId) {
      this.configureSoundMasking(officeId, {
        soundType: 'brown_noise',
        volumePercent: 25,
        fadeInDurationMs: 5000,
        fadeOutDurationMs: 5000
      });
      this.activateSoundMasking(officeId);

      this.defineQuietZone(officeId, {
        maxDbThreshold: 45,
        violationAlerts: true,
        autoCloseDoorsOnBreach: true
      });
    }

    this.log('Focus mode activated with brown noise');
    this._emitEvent('focus_mode_activated', { officeRoom: officeId });
    return true;
  }

  /**
   * Deactivate focus mode
   */
  deactivateFocusMode() {
    this.workFromHome.focusMode = false;

    const officeId = this.workFromHome.officeRoomId;
    if (officeId) {
      this.deactivateSoundMasking(officeId);
      this.removeQuietZone(officeId);
    }

    this.log('Focus mode deactivated');
    this._emitEvent('focus_mode_deactivated', {});
    return true;
  }

  /**
   * Optimize call quality
   */
  optimizeCallQuality() {
    const actions = [];
    const officeId = this.workFromHome.officeRoomId;

    // Close windows in office
    if (officeId) {
      this._triggerAutoCloseWindows(officeId);
      actions.push('close_office_windows');
    }

    // Mute speakers in adjacent rooms
    for (const adjRoom of this.workFromHome.adjacentRooms) {
      this._emitEvent('mute_speakers', { roomId: adjRoom });
      actions.push(`mute_speakers_${adjRoom}`);
    }

    this.log(`Call quality optimized: ${actions.length} actions taken`);
    return { optimized: true, actions };
  }

  // ---------------------------------------------------------------------------
  // 12. Environmental Noise
  // ---------------------------------------------------------------------------

  /**
   * Update environmental noise data
   */
  updateEnvironmentalNoise(data) {
    if (typeof data.trafficLevel === 'number') {
      this.environmentalNoise.trafficLevel = Math.min(100, Math.max(0, data.trafficLevel));
    }
    if (typeof data.constructionDetected === 'boolean') {
      this.environmentalNoise.constructionDetected = data.constructionDetected;
    }
    if (typeof data.stormDetected === 'boolean') {
      this.environmentalNoise.stormDetected = data.stormDetected;
    }
    if (data.seasonalPattern) {
      const patterns = ['normal', 'summer_high', 'winter_low', 'holiday'];
      if (patterns.includes(data.seasonalPattern)) {
        this.environmentalNoise.seasonalPattern = data.seasonalPattern;
      }
    }

    // Generate window recommendation
    this._updateWindowRecommendation();

    return this.environmentalNoise;
  }

  /**
   * Update window open/close recommendation based on noise vs air quality
   */
  _updateWindowRecommendation() {
    const env = this.environmentalNoise;

    // Default: recommend open
    let recommend = true;
    const reasons = [];

    if (env.trafficLevel > 60) {
      recommend = false;
      reasons.push('High traffic noise');
    }
    if (env.constructionDetected) {
      recommend = false;
      reasons.push('Construction noise detected');
    }
    if (env.stormDetected) {
      recommend = false;
      reasons.push('Storm detected');
    }
    if (env.seasonalPattern === 'summer_high') {
      reasons.push('Summer: higher outdoor noise expected');
    }

    env.windowsOpenRecommendation = recommend;

    if (!recommend) {
      this.log(`Window recommendation: CLOSE (${reasons.join(', ')})`);
    }
  }

  /**
   * Get environmental noise status
   */
  getEnvironmentalNoiseStatus() {
    return { ...this.environmentalNoise };
  }

  /**
   * Get air quality vs noise trade-off assessment
   */
  getAirQualityNoiseTradeoff() {
    const env = this.environmentalNoise;
    const outdoorNoiseImpact = env.trafficLevel > 50 ? 'high' : env.trafficLevel > 25 ? 'medium' : 'low';

    return {
      outdoorNoiseImpact,
      windowRecommendation: env.windowsOpenRecommendation ? 'open' : 'closed',
      tradeoffNote: env.windowsOpenRecommendation
        ? 'Outdoor noise is acceptable, windows can be opened for ventilation'
        : 'Outdoor noise is high, consider mechanical ventilation instead of opening windows',
      trafficLevel: env.trafficLevel,
      constructionActive: env.constructionDetected,
      season: env.seasonalPattern
    };
  }

  // ---------------------------------------------------------------------------
  // 13. Acoustic Optimization
  // ---------------------------------------------------------------------------

  /**
   * Analyze room acoustics and generate suggestions
   */
  analyzeRoomAcoustics(roomId) {
    const profile = this.roomProfiles.get(roomId);
    if (!profile) return null;

    const suggestions = [];

    // Echo problems based on reverb time and surface type
    if (profile.reverberationTimeEstimate > 1.0) {
      suggestions.push({
        type: 'echo_reduction',
        priority: 'high',
        suggestion: 'Room has high reverberation. Add soft furnishings, rugs, or curtains to reduce echo.',
        estimatedImprovement: '30-50% echo reduction'
      });
    }

    if (profile.acousticType === 'hard') {
      suggestions.push({
        type: 'surface_treatment',
        priority: 'high',
        suggestion: 'Hard surfaces cause sound reflection. Consider acoustic panels on walls or ceiling.',
        estimatedImprovement: '40-60% noise reduction'
      });

      suggestions.push({
        type: 'furniture_placement',
        priority: 'medium',
        suggestion: 'Place bookshelves against shared walls for natural sound absorption.',
        estimatedImprovement: '15-25% sound transmission reduction'
      });
    }

    // Media room specific
    if (profile.primaryUse === 'media') {
      suggestions.push({
        type: 'bass_trap',
        priority: 'medium',
        suggestion: 'Install bass traps in room corners for cleaner low-frequency response.',
        estimatedImprovement: 'Significant bass clarity improvement'
      });

      suggestions.push({
        type: 'acoustic_panel',
        priority: 'medium',
        suggestion: 'Place acoustic panels at first reflection points (side walls, ceiling).',
        estimatedImprovement: 'Improved clarity and reduced flutter echo'
      });

      if (profile.roomVolumeM3 < 30) {
        suggestions.push({
          type: 'room_size_warning',
          priority: 'low',
          suggestion: 'Small media room may cause standing wave issues. Consider room correction software.',
          estimatedImprovement: 'Better frequency response'
        });
      }
    }

    // Bedroom specific
    if (profile.primaryUse === 'bedroom') {
      suggestions.push({
        type: 'sleep_optimization',
        priority: 'medium',
        suggestion: 'Heavy curtains on windows reduce external noise significantly.',
        estimatedImprovement: '10-15 dB reduction from outside noise'
      });
    }

    // Office specific
    if (profile.primaryUse === 'office') {
      suggestions.push({
        type: 'speech_privacy',
        priority: 'medium',
        suggestion: 'Use sound masking to improve speech privacy during calls.',
        estimatedImprovement: 'Improved speech privacy index'
      });
    }

    // Large volume rooms
    if (profile.roomVolumeM3 > 100) {
      suggestions.push({
        type: 'large_room',
        priority: 'low',
        suggestion: 'Large room may benefit from zone-based speaker placement for even coverage.',
        estimatedImprovement: 'More uniform sound distribution'
      });
    }

    // Nursery specific
    if (profile.primaryUse === 'nursery') {
      suggestions.push({
        type: 'nursery_isolation',
        priority: 'high',
        suggestion: 'Seal door gaps and use weather stripping to isolate nursery from hallway noise.',
        estimatedImprovement: '5-10 dB reduction from adjacent rooms'
      });
    }

    this.acousticSuggestions.set(roomId, {
      roomId,
      suggestions,
      analyzedAt: Date.now(),
      roomProfile: { ...profile }
    });

    this.log(`Acoustic analysis for ${roomId}: ${suggestions.length} suggestions generated`);
    return { roomId, suggestions };
  }

  /**
   * Get acoustic suggestions for a room
   */
  getAcousticSuggestions(roomId) {
    return this.acousticSuggestions.get(roomId) || null;
  }

  // ---------------------------------------------------------------------------
  // 14. Health Impact Tracking
  // ---------------------------------------------------------------------------

  /**
   * Update health exposure for a room
   */
  _updateHealthExposure(roomId, dbLevel) {
    const today = new Date().toISOString().split('T')[0];
    const key = `${roomId}_${today}`;

    if (!this.healthTracking.dailyExposure.has(key)) {
      this.healthTracking.dailyExposure.set(key, {
        roomId,
        date: today,
        totalSamples: 0,
        totalDbWeighted: 0,
        maxDb: 0,
        timeAbove70db: 0,
        timeAbove85db: 0
      });
    }

    const exposure = this.healthTracking.dailyExposure.get(key);
    exposure.totalSamples++;
    exposure.totalDbWeighted += dbLevel;
    exposure.maxDb = Math.max(exposure.maxDb, dbLevel);
    if (dbLevel > 70) exposure.timeAbove70db++;
    if (dbLevel > 85) exposure.timeAbove85db++;
  }

  /**
   * Get daily noise exposure for a room
   */
  getDailyExposure(roomId, date) {
    const dateStr = date || new Date().toISOString().split('T')[0];
    const key = `${roomId}_${dateStr}`;
    const exposure = this.healthTracking.dailyExposure.get(key);

    if (!exposure) return null;

    const averageDb = exposure.totalSamples > 0
      ? exposure.totalDbWeighted / exposure.totalSamples : 0;
    const isWithinWhoLimit = averageDb <= this.healthTracking.whoLimitDb;

    return {
      ...exposure,
      averageDb: Math.round(averageDb * 10) / 10,
      isWithinWhoLimit,
      whoLimitDb: this.healthTracking.whoLimitDb,
      dosePercent: Math.min(100, Math.round((averageDb / this.healthTracking.whoLimitDb) * 100))
    };
  }

  /**
   * Calculate hearing health score for a room
   */
  calculateHearingHealthScore(roomId) {
    const today = new Date().toISOString().split('T')[0];
    const key = `${roomId}_${today}`;
    const exposure = this.healthTracking.dailyExposure.get(key);

    if (!exposure || exposure.totalSamples === 0) {
      return { roomId, score: 100, rating: 'excellent' };
    }

    const averageDb = exposure.totalDbWeighted / exposure.totalSamples;
    let score = 100;

    // Deductions
    if (averageDb > 70) score -= (averageDb - 70) * 3;
    if (averageDb > 85) score -= (averageDb - 85) * 5;
    if (exposure.timeAbove85db > 10) score -= exposure.timeAbove85db * 2;

    score = Math.max(0, Math.min(100, Math.round(score)));

    const rating = score >= 90 ? 'excellent'
      : score >= 70 ? 'good'
      : score >= 50 ? 'fair'
      : score >= 30 ? 'poor'
      : 'critical';

    this.healthTracking.hearingHealthScores.set(roomId, { score, rating, date: today });

    return { roomId, score, rating, averageDb: Math.round(averageDb * 10) / 10 };
  }

  /**
   * Configure tinnitus-aware profile for a room
   */
  configureTinnitusProfile(roomId, enabled) {
    if (enabled) {
      this.healthTracking.tinnitusProfiles.add(roomId);
      // Set stricter limits
      const zone = this.quietZones.get(roomId);
      if (zone) {
        zone.maxDbThreshold = Math.min(zone.maxDbThreshold, 40);
      }
      this.log(`Tinnitus-aware profile enabled for ${roomId}`);
    } else {
      this.healthTracking.tinnitusProfiles.delete(roomId);
      this.log(`Tinnitus-aware profile disabled for ${roomId}`);
    }
  }

  /**
   * Get children's exposure monitoring data
   */
  getChildrenExposure() {
    const results = [];
    for (const [roomId, monitoring] of this.childMonitoring) {
      const exposure = this.getDailyExposure(roomId);
      results.push({
        roomId,
        childName: monitoring.childName,
        childAge: monitoring.childAge,
        exposure,
        stricterLimit: monitoring.childAge === 'infant' ? 55 : 65,
        isWithinChildLimit: exposure
          ? exposure.averageDb <= (monitoring.childAge === 'infant' ? 55 : 65)
          : true
      });
    }
    return results;
  }

  // ---------------------------------------------------------------------------
  // 15. Music Management
  // ---------------------------------------------------------------------------

  /**
   * Register active music source
   */
  registerMusicSource(roomId, config) {
    const source = {
      roomId,
      sourceId: config.sourceId || `source_${Date.now()}`,
      genre: config.genre || 'unknown',
      volumePercent: config.volumePercent || 50,
      speakerDeviceId: config.speakerDeviceId || null,
      active: true,
      startedAt: Date.now()
    };

    this.musicManagement.activeSources.set(roomId, source);

    // Check for competing sources in adjacent rooms
    this._checkCompetingAudioSources(roomId);

    // Apply genre volume limit
    this._applyGenreVolumeLimit(roomId);

    this.log(`Music source registered: ${roomId}, genre: ${source.genre}, volume: ${source.volumePercent}%`);
    return source;
  }

  /**
   * Unregister music source
   */
  unregisterMusicSource(roomId) {
    const removed = this.musicManagement.activeSources.delete(roomId);
    if (removed) {
      this.log(`Music source unregistered: ${roomId}`);
    }
    return removed;
  }

  /**
   * Check for competing audio sources in nearby rooms
   */
  _checkCompetingAudioSources(roomId) {
    const activeSources = Array.from(this.musicManagement.activeSources.values())
      .filter(s => s.active && s.roomId !== roomId);

    if (activeSources.length > 0) {
      this.log(`Warning: ${activeSources.length + 1} competing audio sources active`);
      this._emitEvent('competing_audio_sources', {
        sources: [roomId, ...activeSources.map(s => s.roomId)]
      });
    }
  }

  /**
   * Set up genre volume limits
   */
  _setupGenreVolumeLimits() {
    this.musicManagement.genreVolumeLimits.set('classical', 70);
    this.musicManagement.genreVolumeLimits.set('jazz', 65);
    this.musicManagement.genreVolumeLimits.set('pop', 75);
    this.musicManagement.genreVolumeLimits.set('rock', 80);
    this.musicManagement.genreVolumeLimits.set('electronic', 80);
    this.musicManagement.genreVolumeLimits.set('ambient', 50);
    this.musicManagement.genreVolumeLimits.set('podcast', 55);
    this.musicManagement.genreVolumeLimits.set('unknown', 70);
  }

  /**
   * Apply genre-appropriate volume limit
   */
  _applyGenreVolumeLimit(roomId) {
    const source = this.musicManagement.activeSources.get(roomId);
    if (!source) return;

    const genreLimit = this.musicManagement.genreVolumeLimits.get(source.genre)
      || this.musicManagement.genreVolumeLimits.get('unknown');

    if (source.volumePercent > genreLimit) {
      source.volumePercent = genreLimit;
      this.log(`Genre volume limit applied: ${roomId} capped at ${genreLimit}% for ${source.genre}`);
    }
  }

  /**
   * Set transition zone (hallway/corridor with lower volume)
   */
  addTransitionZone(roomId) {
    this.musicManagement.transitionZones.add(roomId);
    this.log(`Transition zone added: ${roomId}`);
  }

  /**
   * Remove transition zone
   */
  removeTransitionZone(roomId) {
    return this.musicManagement.transitionZones.delete(roomId);
  }

  /**
   * Get volume normalization info for all active sources
   */
  getVolumeNormalization() {
    const sources = Array.from(this.musicManagement.activeSources.values()).filter(s => s.active);
    if (sources.length === 0) return { sources: [], normalized: true };

    const avgVolume = sources.reduce((sum, s) => sum + s.volumePercent, 0) / sources.length;

    return {
      sources: sources.map(s => ({
        roomId: s.roomId,
        genre: s.genre,
        currentVolume: s.volumePercent,
        normalizedVolume: Math.round(avgVolume),
        isTransitionZone: this.musicManagement.transitionZones.has(s.roomId),
        adjustedVolume: this.musicManagement.transitionZones.has(s.roomId)
          ? Math.round(avgVolume * 0.6) : Math.round(avgVolume)
      })),
      averageVolume: Math.round(avgVolume),
      normalized: this.musicManagement.volumeNormalization
    };
  }

  // ---------------------------------------------------------------------------
  // 16. Vibration Monitoring
  // ---------------------------------------------------------------------------

  /**
   * Register a vibration sensor
   */
  registerVibrationSensor(sensorId, config) {
    const sensor = {
      id: sensorId,
      roomId: config.roomId || null,
      type: config.type || 'structural', // structural, appliance, floor
      baselineLevel: config.baselineLevel || 0,
      currentLevel: 0,
      thresholdLevel: config.thresholdLevel || 50,
      lastAlertAt: null,
      active: true,
      createdAt: Date.now()
    };

    this.vibrationMonitoring.sensors.set(sensorId, sensor);
    this.log(`Vibration sensor registered: ${sensorId} in ${sensor.roomId}`);
    return sensor;
  }

  /**
   * Process vibration reading
   */
  processVibrationReading(sensorId, level) {
    const sensor = this.vibrationMonitoring.sensors.get(sensorId);
    if (!sensor || !sensor.active) return;

    sensor.currentLevel = level;

    if (level > sensor.thresholdLevel) {
      sensor.lastAlertAt = Date.now();
      this.log(`Vibration alert: sensor ${sensorId} at level ${level} (threshold: ${sensor.thresholdLevel})`);
      this._emitEvent('vibration_alert', {
        sensorId,
        roomId: sensor.roomId,
        level,
        threshold: sensor.thresholdLevel
      });
    }
  }

  /**
   * Set HVAC vibration baseline
   */
  setHvacVibrationBaseline(level) {
    this.vibrationMonitoring.hvacBaseline = level;
    this.log(`HVAC vibration baseline set: ${level}`);
  }

  /**
   * Set heavy traffic hours correlation
   */
  setHeavyTrafficHours(hours) {
    this.vibrationMonitoring.heavyTrafficHours = hours;
    this.log(`Heavy traffic hours set: ${JSON.stringify(hours)}`);
  }

  /**
   * Get vibration isolation recommendations
   */
  getVibrationIsolationRecommendations() {
    const recommendations = [];

    for (const [sensorId, sensor] of this.vibrationMonitoring.sensors) {
      if (sensor.currentLevel > sensor.baselineLevel * 1.5) {
        recommendations.push({
          sensorId,
          roomId: sensor.roomId,
          type: sensor.type,
          currentLevel: sensor.currentLevel,
          baseline: sensor.baselineLevel,
          recommendation: sensor.type === 'appliance'
            ? 'Install anti-vibration pads under the appliance'
            : sensor.type === 'floor'
            ? 'Consider impact-absorbing underlay or rubber mats'
            : 'Check structural mounting and add damping material'
        });
      }
    }

    if (this.vibrationMonitoring.hvacBaseline > 30) {
      recommendations.push({
        sensorId: 'hvac_system',
        type: 'hvac',
        currentLevel: this.vibrationMonitoring.hvacBaseline,
        recommendation: 'HVAC vibration above optimal. Check mounting bolts and flexible connectors.'
      });
    }

    this.vibrationMonitoring.isolationRecommendations = recommendations;
    return recommendations;
  }

  // ---------------------------------------------------------------------------
  // 17. Monitoring Cycle
  // ---------------------------------------------------------------------------

  /**
   * Start the monitoring cycle (every 30 seconds)
   */
  _startMonitoringCycle() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(() => {
      this._runMonitoringCycle();
    }, this.monitoringCycleMs);

    this.log(`Monitoring cycle started: every ${this.monitoringCycleMs / 1000}s`);
  }

  /**
   * Run a single monitoring cycle
   */
  _runMonitoringCycle() {
    for (const [roomId, profile] of this.roomProfiles) {
      // Simulate sampling microphone (in production, read from actual sensor)
      const noiseData = this.realtimeNoise.get(roomId);
      if (!noiseData) continue;

      // Check thresholds
      const effectiveMax = this.getEffectiveMaxDb(roomId);
      if (noiseData.currentDb > effectiveMax) {
        this._logNoiseEvent(roomId, 'threshold_exceeded', noiseData.currentDb, noiseData.lastClassification);
      }

      // Check sound masking auto-activate
      const masking = this.soundMaskingConfigs.get(roomId);
      if (masking && masking.autoActivateInQuietZone && !masking.active) {
        const zone = this.quietZones.get(roomId);
        if (zone && zone.enabled && this._isWithinTimeRange(zone.activeHoursStart, zone.activeHoursEnd)) {
          if (noiseData.currentDb > zone.maxDbThreshold) {
            this.activateSoundMasking(roomId);
          }
        }
      }

      // Check sleep environment auto-masking
      const sleepEnv = this.sleepEnvironments.get(roomId);
      if (sleepEnv && sleepEnv.active && sleepEnv.autoMaskingEnabled) {
        if (noiseData.currentDb > sleepEnv.maskingThresholdDb) {
          const currentMasking = this.soundMaskingConfigs.get(roomId);
          if (!currentMasking || !currentMasking.active) {
            this.configureSoundMasking(roomId, {
              soundType: sleepEnv.maskingSoundType,
              volumePercent: sleepEnv.maskingVolume,
              fadeInDurationMs: 5000,
              fadeOutDurationMs: sleepEnv.fadeOutDurationMin * 60 * 1000
            });
            this.activateSoundMasking(roomId);
          }
        }
      }

      // Update neighbor complaint prevention score
      if (this.neighborAwareness.enabled) {
        this._updateNeighborScore(roomId);
      }
    }

    // Check wake-up times
    this._checkWakeUpTimes();

    // Clean up old health tracking data (keep 30 days)
    this._cleanupOldData();
  }

  /**
   * Check if any wake-up ramp needs to trigger
   */
  _checkWakeUpTimes() {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    for (const [roomId, sleepEnv] of this.sleepEnvironments) {
      if (!sleepEnv.active || !sleepEnv.wakeUpSoundEnabled) continue;

      // Calculate pre-ramp time
      const [wakeHour, wakeMin] = sleepEnv.wakeUpTime.split(':').map(Number);
      const wakeDate = new Date();
      wakeDate.setHours(wakeHour, wakeMin, 0, 0);
      const preRampDate = new Date(wakeDate.getTime() - sleepEnv.wakeUpRampDurationMin * 60000);
      const preRampTime = `${String(preRampDate.getHours()).padStart(2, '0')}:${String(preRampDate.getMinutes()).padStart(2, '0')}`;

      if (currentTime === preRampTime) {
        this.triggerWakeUpRamp(roomId);
      }
    }
  }

  /**
   * Clean up old data
   */
  _cleanupOldData() {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    // Clean health tracking data
    for (const [key, data] of this.healthTracking.dailyExposure) {
      const dateParts = key.split('_');
      const dateStr = dateParts[dateParts.length - 1];
      if (new Date(dateStr).getTime() < thirtyDaysAgo) {
        this.healthTracking.dailyExposure.delete(key);
      }
    }

    // Trim noise event log
    if (this.noiseEventLog.length > this.maxLogEntries) {
      this.noiseEventLog = this.noiseEventLog.slice(-this.maxLogEntries);
    }
  }

  // ---------------------------------------------------------------------------
  // 18. Reporting
  // ---------------------------------------------------------------------------

  /**
   * Generate daily noise report
   */
  generateDailyReport(date) {
    const dateStr = date || new Date().toISOString().split('T')[0];
    const roomReports = [];

    for (const [roomId, profile] of this.roomProfiles) {
      const noiseData = this.realtimeNoise.get(roomId);
      const exposure = this.getDailyExposure(roomId, dateStr);
      const healthScore = this.calculateHearingHealthScore(roomId);

      roomReports.push({
        roomId,
        roomName: profile.name,
        primaryUse: profile.primaryUse,
        currentDb: noiseData ? noiseData.currentDb : 0,
        avg1min: noiseData ? noiseData.avg1min : 0,
        avg60min: noiseData ? noiseData.avg60min : 0,
        peakDb: noiseData ? noiseData.peakDb : 0,
        exposure,
        healthScore: healthScore.score,
        healthRating: healthScore.rating
      });
    }

    // Find quietest and noisiest rooms
    const sortedByNoise = [...roomReports].sort((a, b) => a.avg60min - b.avg60min);
    const quietestRoom = sortedByNoise[0] || null;
    const noisiestRoom = sortedByNoise[sortedByNoise.length - 1] || null;

    // Count violations
    let totalViolations = 0;
    for (const [, zone] of this.quietZones) {
      totalViolations += zone.violationCount;
    }

    // Count events for the day
    const dayEvents = this.noiseEventLog.filter(e => {
      const eventDate = new Date(e.timestamp).toISOString().split('T')[0];
      return eventDate === dateStr;
    });

    const report = {
      date: dateStr,
      generatedAt: Date.now(),
      totalRooms: this.roomProfiles.size,
      rooms: roomReports,
      quietestRoom: quietestRoom ? { name: quietestRoom.roomName, avgDb: quietestRoom.avg60min } : null,
      noisiestRoom: noisiestRoom ? { name: noisiestRoom.roomName, avgDb: noisiestRoom.avg60min } : null,
      totalQuietZoneViolations: totalViolations,
      peakNoiseEvents: dayEvents.filter(e => e.type === 'peak').length,
      quietHoursCompliance: this.reportingData.quietHoursCompliance,
      neighborComplaintPreventionScore: this.reportingData.neighborComplaintPreventionScore,
      partyModeUsed: this.partyMode.startedAt
        ? new Date(this.partyMode.startedAt).toISOString().split('T')[0] === dateStr
        : false,
      sleepModesActive: Array.from(this.sleepEnvironments.values()).filter(s => s.active).length,
      childMonitoringActive: Array.from(this.childMonitoring.values()).filter(m => m.active).length
    };

    this.reportingData.daily.push(report);
    if (this.reportingData.daily.length > 90) {
      this.reportingData.daily = this.reportingData.daily.slice(-90);
    }

    this.log(`Daily report generated for ${dateStr}: ${roomReports.length} rooms analyzed`);
    return report;
  }

  /**
   * Generate weekly noise report
   */
  generateWeeklyReport() {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);

    const weeklyEvents = this.noiseEventLog.filter(e => e.timestamp >= weekStart.getTime());

    const eventsByType = {};
    for (const event of weeklyEvents) {
      if (!eventsByType[event.type]) eventsByType[event.type] = 0;
      eventsByType[event.type]++;
    }

    const eventsByRoom = {};
    for (const event of weeklyEvents) {
      if (!eventsByRoom[event.roomId]) eventsByRoom[event.roomId] = 0;
      eventsByRoom[event.roomId]++;
    }

    const report = {
      weekStarting: weekStart.toISOString().split('T')[0],
      weekEnding: now.toISOString().split('T')[0],
      generatedAt: Date.now(),
      totalEvents: weeklyEvents.length,
      eventsByType,
      eventsByRoom,
      averageQuietHoursCompliance: this.reportingData.quietHoursCompliance,
      neighborScore: this.reportingData.neighborComplaintPreventionScore,
      dailyReports: this.reportingData.daily.filter(r => {
        const rDate = new Date(r.date);
        return rDate >= weekStart && rDate <= now;
      })
    };

    this.reportingData.weekly.push(report);
    if (this.reportingData.weekly.length > 12) {
      this.reportingData.weekly = this.reportingData.weekly.slice(-12);
    }

    this.log('Weekly report generated');
    return report;
  }

  /**
   * Generate monthly noise report
   */
  generateMonthlyReport() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthlyEvents = this.noiseEventLog.filter(e => e.timestamp >= monthStart.getTime());

    const peakEvents = monthlyEvents
      .filter(e => e.type === 'peak')
      .sort((a, b) => b.dbLevel - a.dbLevel)
      .slice(0, 10);

    const report = {
      month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      generatedAt: Date.now(),
      totalEvents: monthlyEvents.length,
      topPeakEvents: peakEvents,
      roomSummaries: this._generateRoomSummaries(monthStart.getTime()),
      overallComplianceScore: this.reportingData.quietHoursCompliance,
      neighborScore: this.reportingData.neighborComplaintPreventionScore,
      recommendations: this._generateMonthlyRecommendations()
    };

    this.reportingData.monthly.push(report);
    if (this.reportingData.monthly.length > 12) {
      this.reportingData.monthly = this.reportingData.monthly.slice(-12);
    }

    this.log('Monthly report generated');
    return report;
  }

  /**
   * Generate room summaries for a period
   */
  _generateRoomSummaries(sinceTimestamp) {
    const summaries = [];
    for (const [roomId, profile] of this.roomProfiles) {
      const events = this.noiseEventLog.filter(e => e.roomId === roomId && e.timestamp >= sinceTimestamp);
      const violations = events.filter(e => e.type === 'quiet_zone_violation').length;
      const peaks = events.filter(e => e.type === 'peak').length;

      summaries.push({
        roomId,
        roomName: profile.name,
        primaryUse: profile.primaryUse,
        totalEvents: events.length,
        violations,
        peaks,
        healthScore: this.calculateHearingHealthScore(roomId).score
      });
    }
    return summaries;
  }

  /**
   * Generate monthly recommendations
   */
  _generateMonthlyRecommendations() {
    const recommendations = [];

    // Check rooms with high violation counts
    for (const [roomId, zone] of this.quietZones) {
      if (zone.violationCount > 20) {
        recommendations.push(`Room ${roomId}: High quiet zone violations (${zone.violationCount}). Consider acoustic improvements or adjusting threshold.`);
      }
    }

    // Check health scores
    for (const [roomId] of this.roomProfiles) {
      const health = this.calculateHearingHealthScore(roomId);
      if (health.score < 50) {
        recommendations.push(`Room ${roomId}: Poor hearing health score (${health.score}). Reduce average noise levels.`);
      }
    }

    // Neighbor score
    if (this.reportingData.neighborComplaintPreventionScore < 70) {
      recommendations.push('Neighbor complaint prevention score is low. Review noise levels in shared-wall rooms.');
    }

    return recommendations;
  }

  /**
   * Get peak noise events log
   */
  getPeakEvents(limit) {
    const count = limit || 20;
    return this.noiseEventLog
      .filter(e => e.type === 'peak')
      .sort((a, b) => b.dbLevel - a.dbLevel)
      .slice(0, count);
  }

  // ---------------------------------------------------------------------------
  // Statistics & Utilities
  // ---------------------------------------------------------------------------

  /**
   * Get comprehensive system statistics
   */
  getStatistics() {
    const activeQuietZones = Array.from(this.quietZones.values()).filter(z => z.enabled).length;
    const activeMasking = Array.from(this.soundMaskingConfigs.values()).filter(m => m.active).length;
    const activeSleepModes = Array.from(this.sleepEnvironments.values()).filter(s => s.active).length;
    const runningAppliances = Array.from(this.noisyAppliances.values()).filter(a => a.isRunning).length;
    const activeChildMonitors = Array.from(this.childMonitoring.values()).filter(m => m.active).length;
    const activeMusicSources = Array.from(this.musicManagement.activeSources.values()).filter(s => s.active).length;
    const activeVibrationSensors = Array.from(this.vibrationMonitoring.sensors.values()).filter(s => s.active).length;

    const roomNoiseLevels = {};
    for (const [roomId, data] of this.realtimeNoise) {
      roomNoiseLevels[roomId] = {
        currentDb: data.currentDb,
        avg5min: data.avg5min,
        peakDb: data.peakDb,
        classification: data.lastClassification
      };
    }

    return {
      initialized: this._initialized,
      totalRooms: this.roomProfiles.size,
      roomNoiseLevels,
      quietZones: {
        total: this.quietZones.size,
        active: activeQuietZones,
        totalViolations: Array.from(this.quietZones.values()).reduce((sum, z) => sum + z.violationCount, 0)
      },
      soundMasking: {
        configured: this.soundMaskingConfigs.size,
        active: activeMasking
      },
      sleepEnvironments: {
        configured: this.sleepEnvironments.size,
        active: activeSleepModes
      },
      noiseSchedules: {
        total: this.noiseSchedules.length,
        active: this.getActiveSchedules().length
      },
      appliances: {
        registered: this.noisyAppliances.size,
        running: runningAppliances
      },
      partyMode: {
        active: this.partyMode.active,
        indoorLimitDb: this.partyMode.indoorLimitDb,
        outdoorLimitDb: this.partyMode.outdoorLimitDb
      },
      neighborAwareness: {
        enabled: this.neighborAwareness.enabled,
        buildingType: this.neighborAwareness.buildingType
      },
      childMonitoring: {
        configured: this.childMonitoring.size,
        active: activeChildMonitors
      },
      workFromHome: {
        meetingMode: this.workFromHome.meetingMode,
        focusMode: this.workFromHome.focusMode,
        callActive: this.workFromHome.callActive
      },
      environmentalNoise: { ...this.environmentalNoise },
      musicManagement: {
        activeSources: activeMusicSources,
        volumeNormalization: this.musicManagement.volumeNormalization,
        transitionZones: this.musicManagement.transitionZones.size
      },
      vibrationMonitoring: {
        sensors: this.vibrationMonitoring.sensors.size,
        activeSensors: activeVibrationSensors,
        hvacBaseline: this.vibrationMonitoring.hvacBaseline
      },
      healthTracking: {
        tinnitusProfiles: this.healthTracking.tinnitusProfiles.size,
        childrenMonitored: this.childMonitoring.size
      },
      reporting: {
        dailyReports: this.reportingData.daily.length,
        weeklyReports: this.reportingData.weekly.length,
        monthlyReports: this.reportingData.monthly.length,
        quietHoursCompliance: this.reportingData.quietHoursCompliance,
        neighborScore: this.reportingData.neighborComplaintPreventionScore
      },
      noiseEventLog: {
        totalEvents: this.noiseEventLog.length,
        maxEntries: this.maxLogEntries
      },
      monitoringCycleMs: this.monitoringCycleMs
    };
  }

  // ---------------------------------------------------------------------------
  // Internal Helpers
  // ---------------------------------------------------------------------------

  /**
   * Calculate average dB from samples
   */
  _calculateAverage(samples) {
    if (samples.length === 0) return 0;
    const sum = samples.reduce((acc, s) => acc + s.db, 0);
    return Math.round((sum / samples.length) * 10) / 10;
  }

  /**
   * Check if current time is within a time range
   */
  _isWithinTimeRange(startStr, endStr) {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [startH, startM] = startStr.split(':').map(Number);
    const [endH, endM] = endStr.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (startMinutes <= endMinutes) {
      // Same day range (e.g., 09:00-17:00)
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    } else {
      // Overnight range (e.g., 22:00-07:00)
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }
  }

  /**
   * Log a noise event
   */
  _logNoiseEvent(roomId, type, dbLevel, classification) {
    const event = {
      roomId,
      type,
      dbLevel,
      classification,
      timestamp: Date.now()
    };

    this.noiseEventLog.push(event);

    if (this.noiseEventLog.length > this.maxLogEntries) {
      this.noiseEventLog = this.noiseEventLog.slice(-this.maxLogEntries);
    }

    // Track peak events in reporting
    if (type === 'peak') {
      this.reportingData.peakEvents.push(event);
      if (this.reportingData.peakEvents.length > 500) {
        this.reportingData.peakEvents = this.reportingData.peakEvents.slice(-500);
      }
    }
  }

  /**
   * Update neighbor complaint prevention score
   */
  _updateNeighborScore(roomId) {
    if (!this.neighborAwareness.enabled) return;

    const noiseData = this.realtimeNoise.get(roomId);
    if (!noiseData) return;

    const isThinWall = this.neighborAwareness.thinWallRooms.includes(roomId);
    const buildingFactor = this._getBuildingTypeFactor();
    const threshold = isThinWall ? 50 : 60;

    if (noiseData.currentDb > threshold) {
      const penalty = (noiseData.currentDb - threshold) * buildingFactor * 0.5;
      this.reportingData.neighborComplaintPreventionScore = Math.max(0,
        this.reportingData.neighborComplaintPreventionScore - penalty
      );
    } else {
      // Slowly recover score
      this.reportingData.neighborComplaintPreventionScore = Math.min(100,
        this.reportingData.neighborComplaintPreventionScore + 0.1
      );
    }
  }

  /**
   * Emit an event (integration point)
   */
  _emitEvent(eventName, data) {
    try {
      if (this.homey && typeof this.homey.emit === 'function') {
        this.homey.emit(`noise:${eventName}`, data);
      }
    } catch (err) {
      this.error(`Failed to emit event ${eventName}: ${err.message}`);
    }
  }

  /**
   * Trigger auto-close windows for a room
   */
  _triggerAutoCloseWindows(roomId) {
    this.log(`Auto-closing windows in room: ${roomId}`);
    this._emitEvent('auto_close_windows', { roomId });
  }

  /**
   * Trigger auto-close doors for a room
   */
  _triggerAutoCloseDoors(roomId) {
    this.log(`Auto-closing doors in room: ${roomId}`);
    this._emitEvent('auto_close_doors', { roomId });
  }

  /**
   * Load saved state from storage
   */
  async _loadSavedState() {
    try {
      if (this.homey && typeof this.homey.settings === 'object' && typeof this.homey.settings.get === 'function') {
        const saved = this.homey.settings.get('noise_management_state');
        if (saved) {
          this.log('Restoring saved noise management state');
          if (saved.neighborAwareness) {
            Object.assign(this.neighborAwareness, saved.neighborAwareness);
          }
          if (saved.quietHoursCompliance != null) {
            this.reportingData.quietHoursCompliance = saved.quietHoursCompliance;
          }
          if (saved.neighborScore != null) {
            this.reportingData.neighborComplaintPreventionScore = saved.neighborScore;
          }
        }
      }
    } catch (err) {
      this.log(`No saved state found or error loading: ${err.message}`);
    }
  }

  /**
   * Set up default noise schedules
   */
  _setupDefaultSchedules() {
    // Default quiet hours
    this.addNoiseSchedule({
      name: 'Default Quiet Hours',
      type: 'quiet_hours',
      startTime: '22:00',
      endTime: '07:00',
      maxDb: 35,
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      enabled: true
    });

    // Default work hours (weekdays)
    this.addNoiseSchedule({
      name: 'Work Hours - Office Quiet',
      type: 'work_hours',
      startTime: '09:00',
      endTime: '17:00',
      maxDb: 45,
      daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
      enabled: false // Disabled by default, user must enable
    });
  }

  // ---------------------------------------------------------------------------
  // Logging
  // ---------------------------------------------------------------------------

  /**
   * Log an informational message
   */
  log(msg) {
    if (this.homey && typeof this.homey.log === 'function') {
      this.homey.log(`[Noise] ${msg}`);
    } else {
      console.log(`[Noise] ${msg}`);
    }
  }

  /**
   * Log an error message
   */
  error(msg) {
    if (this.homey && typeof this.homey.error === 'function') {
      this.homey.error(`[Noise] ${msg}`);
    } else {
      console.error(`[Noise] ${msg}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  /**
   * Destroy the system and clean up resources
   */
  destroy() {
    this.log('Destroying SmartNoiseManagementSystem...');

    // Stop monitoring cycle
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    // Clear party mode timer
    if (this.partyMode.neighborTimerHandle) {
      clearTimeout(this.partyMode.neighborTimerHandle);
      this.partyMode.neighborTimerHandle = null;
    }

    // Save state
    try {
      if (this.homey && typeof this.homey.settings === 'object' && typeof this.homey.settings.set === 'function') {
        this.homey.settings.set('noise_management_state', {
          neighborAwareness: this.neighborAwareness,
          quietHoursCompliance: this.reportingData.quietHoursCompliance,
          neighborScore: this.reportingData.neighborComplaintPreventionScore
        });
      }
    } catch (err) {
      this.error(`Failed to save state on destroy: ${err.message}`);
    }

    // Clear all data structures
    this.roomProfiles.clear();
    this.realtimeNoise.clear();
    this.quietZones.clear();
    this.soundMaskingConfigs.clear();
    this.sleepEnvironments.clear();
    this.noiseSchedules.length = 0;
    this.noisyAppliances.clear();
    this.childMonitoring.clear();
    this.acousticSuggestions.clear();
    this.healthTracking.dailyExposure.clear();
    this.healthTracking.hearingHealthScores.clear();
    this.healthTracking.childrenExposure.clear();
    this.healthTracking.tinnitusProfiles.clear();
    this.musicManagement.activeSources.clear();
    this.musicManagement.transitionZones.clear();
    this.musicManagement.genreVolumeLimits.clear();
    this.vibrationMonitoring.sensors.clear();
    this.noiseEventLog.length = 0;

    this._initialized = false;
    this.log('SmartNoiseManagementSystem destroyed');
  }
}

module.exports = SmartNoiseManagementSystem;
