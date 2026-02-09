'use strict';

/**
 * AdvancedAVAutomation - Comprehensive Audio/Video Home Automation System
 * 
 * Features:
 * - Multi-room audio with 8 zones, grouping, source routing, per-zone volume
 * - Video distribution via HDMI matrix (4×8), 4K/8K support
 * - 12 cinema presets (Movie Night, Sports, Gaming, Concert, etc.)
 * - Speaker configurations: Dolby Atmos 7.1.4, DTS:X, stereo
 * - Audio calibration with 10-band EQ, room correction, reference levels
 * - Smart volume with time-of-day awareness and quiet hours
 * - Projector management with lamp tracking, eco mode, screen control
 * - Background music scheduling per time slot
 * - Streaming sources: Spotify, Tidal, Apple Music, NAS, BT, AirPlay, etc.
 * - HDMI-CEC power chains, input switching, volume passthrough
 * - Lip-sync correction per source (0–500ms)
 * - Audio announcements with TTS routing, priority, ducking
 * - AV power sequencing (correct on/off order)
 * - Energy monitoring per device with standby detection
 * - Party mode: all zones linked, synchronized playback
 * - Equipment monitoring on a 5-min cycle
 */
class AdvancedAVAutomation {

  constructor(homey) {
    this.homey = homey;

    // --- Audio Zones ---
    this.zones = {};
    this.zoneGroups = {};

    // --- Video Distribution ---
    this.hdmiMatrix = {};

    // --- Cinema Presets ---
    this.cinemaPresets = {};
    this.activePreset = null;

    // --- Speaker Configurations ---
    this.speakerConfigs = {};

    // --- Audio Calibration ---
    this.calibration = {};

    // --- Smart Volume ---
    this.smartVolume = {};

    // --- Projector ---
    this.projector = {};

    // --- Background Music ---
    this.backgroundMusic = {};

    // --- Streaming Sources ---
    this.streamingSources = {};

    // --- HDMI-CEC ---
    this.hdmiCec = {};

    // --- Lip-Sync ---
    this.lipSync = {};

    // --- Announcements ---
    this.announcements = { queue: [], active: false };

    // --- Power Sequencing ---
    this.powerSequence = {};

    // --- Energy Monitoring ---
    this.energyMonitoring = {};

    // --- Party Mode ---
    this.partyMode = { active: false, masterZone: null, syncOffset: 0 };

    // --- Monitoring ---
    this.monitoringInterval = null;
    this.backgroundMusicInterval = null;
    this.smartVolumeInterval = null;
    this.energyInterval = null;

    // --- Statistics ---
    this.statistics = {
      totalPlaybackHours: 0,
      presetsActivated: 0,
      announcementsSent: 0,
      partyModeActivations: 0,
      powerCycles: 0,
      calibrationsRun: 0,
      energyTotalKwh: 0,
      errorsDetected: 0,
      uptimeStart: null
    };
  }

  // ─── Initialization ────────────────────────────────────────────────

  initialize() {
    this.log('Initializing Advanced AV Automation system...');
    this.statistics.uptimeStart = Date.now();

    this._initializeZones();
    this._initializeHdmiMatrix();
    this._initializeCinemaPresets();
    this._initializeSpeakerConfigs();
    this._initializeCalibration();
    this._initializeSmartVolume();
    this._initializeProjector();
    this._initializeBackgroundMusic();
    this._initializeStreamingSources();
    this._initializeHdmiCec();
    this._initializeLipSync();
    this._initializePowerSequence();
    this._initializeEnergyMonitoring();

    this._startMonitoringCycle();
    this._startBackgroundMusicScheduler();
    this._startSmartVolumeEnforcer();
    this._startEnergyTracking();

    this.log('AV Automation system initialized with ' + Object.keys(this.zones).length + ' zones, '
      + this.hdmiMatrix.inputs.length + ' HDMI inputs, '
      + Object.keys(this.cinemaPresets).length + ' cinema presets');
  }

  // ─── Zone Initialization ──────────────────────────────────────────

  _initializeZones() {
    const zoneDefinitions = [
      { id: 'living_room', name: 'Living Room', maxVolume: 100, defaultVolume: 35, speakers: 'atmos_7_1_4' },
      { id: 'kitchen', name: 'Kitchen', maxVolume: 80, defaultVolume: 30, speakers: 'stereo' },
      { id: 'bedroom', name: 'Bedroom', maxVolume: 70, defaultVolume: 25, speakers: 'stereo' },
      { id: 'bathroom', name: 'Bathroom', maxVolume: 60, defaultVolume: 20, speakers: 'mono' },
      { id: 'office', name: 'Office', maxVolume: 75, defaultVolume: 30, speakers: 'stereo' },
      { id: 'patio', name: 'Patio', maxVolume: 100, defaultVolume: 40, speakers: 'stereo_outdoor' },
      { id: 'garage', name: 'Garage', maxVolume: 90, defaultVolume: 35, speakers: 'mono' },
      { id: 'kids_room', name: 'Kids Room', maxVolume: 65, defaultVolume: 25, speakers: 'stereo' }
    ];

    for (const def of zoneDefinitions) {
      this.zones[def.id] = {
        id: def.id,
        name: def.name,
        power: false,
        volume: def.defaultVolume,
        defaultVolume: def.defaultVolume,
        maxVolume: def.maxVolume,
        muted: false,
        source: null,
        speakerConfig: def.speakers,
        bass: 0,
        treble: 0,
        balance: 0,
        playing: false,
        currentTrack: null,
        groupId: null,
        lastActivity: null,
        errorCount: 0
      };
    }

    this.zoneGroups = {
      downstairs: { id: 'downstairs', name: 'Downstairs', zones: ['living_room', 'kitchen'], active: false },
      upstairs: { id: 'upstairs', name: 'Upstairs', zones: ['bedroom', 'kids_room'], active: false },
      outdoor: { id: 'outdoor', name: 'Outdoor', zones: ['patio', 'garage'], active: false },
      whole_home: { id: 'whole_home', name: 'Whole Home', zones: Object.keys(this.zones), active: false }
    };

    this.log('Initialized ' + zoneDefinitions.length + ' audio zones and ' + Object.keys(this.zoneGroups).length + ' zone groups');
  }

  // ─── HDMI Matrix ──────────────────────────────────────────────────

  _initializeHdmiMatrix() {
    this.hdmiMatrix = {
      inputs: [
        { id: 1, name: 'Apple TV 4K', type: 'streaming', resolution: '4K', hdr: true, connected: true, signalPresent: true },
        { id: 2, name: 'Gaming Console', type: 'gaming', resolution: '4K', hdr: true, connected: true, signalPresent: true },
        { id: 3, name: 'Cable Box', type: 'cable', resolution: '1080p', hdr: false, connected: true, signalPresent: true },
        { id: 4, name: 'Blu-ray Player', type: 'disc', resolution: '4K', hdr: true, connected: true, signalPresent: false }
      ],
      outputs: [
        { id: 1, name: 'Living Room TV', assignedInput: 1, power: false, supports4K: true, supports8K: false },
        { id: 2, name: 'Bedroom TV', assignedInput: 1, power: false, supports4K: true, supports8K: false },
        { id: 3, name: 'Kitchen Display', assignedInput: 3, power: false, supports4K: false, supports8K: false },
        { id: 4, name: 'Office Monitor', assignedInput: 1, power: false, supports4K: true, supports8K: true },
        { id: 5, name: 'Projector', assignedInput: 1, power: false, supports4K: true, supports8K: false },
        { id: 6, name: 'Patio TV', assignedInput: 3, power: false, supports4K: true, supports8K: false },
        { id: 7, name: 'Garage Display', assignedInput: 3, power: false, supports4K: false, supports8K: false },
        { id: 8, name: 'Kids Room TV', assignedInput: 3, power: false, supports4K: true, supports8K: false }
      ],
      sourcePriority: [1, 2, 3, 4],
      edidMode: 'auto',
      hdcpVersion: '2.3',
      arcEnabled: true
    };

    this.log('HDMI matrix initialized: ' + this.hdmiMatrix.inputs.length + ' inputs × ' + this.hdmiMatrix.outputs.length + ' outputs');
  }

  // ─── Cinema Presets ───────────────────────────────────────────────

  _initializeCinemaPresets() {
    this.cinemaPresets = {
      movie_night: {
        id: 'movie_night', name: 'Movie Night',
        lighting: { level: 10, color: 'warm', zones: ['living_room'] },
        audio: { mode: 'surround', profile: 'dolby_atmos', volume: 45, subwoofer: 60, centerBoost: 3 },
        video: { source: 1, output: 5, aspectRatio: '21:9' },
        screen: 'down',
        extras: { curtains: 'closed', hvac: 'quiet' }
      },
      sports: {
        id: 'sports', name: 'Sports',
        lighting: { level: 60, color: 'daylight', zones: ['living_room', 'kitchen'] },
        audio: { mode: 'surround', profile: 'dts_x', volume: 55, subwoofer: 50, centerBoost: 6 },
        video: { source: 3, output: 1, aspectRatio: '16:9' },
        screen: 'up',
        extras: { curtains: 'open', hvac: 'normal' }
      },
      gaming: {
        id: 'gaming', name: 'Gaming',
        lighting: { level: 30, color: 'rgb_reactive', zones: ['living_room'] },
        audio: { mode: 'game', profile: 'stereo', volume: 50, subwoofer: 55, centerBoost: 0, lowLatency: true },
        video: { source: 2, output: 1, aspectRatio: '16:9', gameMode: true, vrr: true },
        screen: 'up',
        extras: { curtains: 'closed', hvac: 'normal' }
      },
      concert: {
        id: 'concert', name: 'Concert',
        lighting: { level: 20, color: 'party', zones: ['living_room', 'kitchen', 'patio'] },
        audio: { mode: 'surround', profile: 'dolby_atmos', volume: 70, subwoofer: 75, centerBoost: 0, fullRange: true },
        video: { source: 1, output: 1, aspectRatio: '16:9' },
        screen: 'up',
        extras: { curtains: 'closed', hvac: 'quiet' }
      },
      karaoke: {
        id: 'karaoke', name: 'Karaoke',
        lighting: { level: 40, color: 'party', zones: ['living_room'] },
        audio: { mode: 'karaoke', profile: 'stereo', volume: 60, subwoofer: 40, centerBoost: 0, micEcho: true, vocalReduction: true },
        video: { source: 1, output: 1, aspectRatio: '16:9' },
        screen: 'up',
        extras: { curtains: 'open', hvac: 'normal' }
      },
      ambient: {
        id: 'ambient', name: 'Ambient',
        lighting: { level: 25, color: 'warm', zones: ['living_room', 'bedroom'] },
        audio: { mode: 'stereo', profile: 'stereo', volume: 20, subwoofer: 30, centerBoost: 0 },
        video: { source: null, output: null, aspectRatio: null },
        screen: 'up',
        extras: { curtains: 'auto', hvac: 'normal' }
      },
      podcast: {
        id: 'podcast', name: 'Podcast',
        lighting: { level: 50, color: 'neutral', zones: ['office'] },
        audio: { mode: 'voice', profile: 'stereo', volume: 35, subwoofer: 10, centerBoost: 8 },
        video: { source: null, output: null, aspectRatio: null },
        screen: 'up',
        extras: { curtains: 'auto', hvac: 'quiet' }
      },
      classical: {
        id: 'classical', name: 'Classical',
        lighting: { level: 30, color: 'warm', zones: ['living_room'] },
        audio: { mode: 'surround', profile: 'dolby_atmos', volume: 40, subwoofer: 35, centerBoost: 2, dynamicRange: 'full' },
        video: { source: null, output: null, aspectRatio: null },
        screen: 'up',
        extras: { curtains: 'closed', hvac: 'quiet' }
      },
      jazz: {
        id: 'jazz', name: 'Jazz',
        lighting: { level: 20, color: 'warm_amber', zones: ['living_room', 'kitchen'] },
        audio: { mode: 'stereo', profile: 'stereo', volume: 35, subwoofer: 40, centerBoost: 0, warmth: 3 },
        video: { source: null, output: null, aspectRatio: null },
        screen: 'up',
        extras: { curtains: 'auto', hvac: 'normal' }
      },
      rock: {
        id: 'rock', name: 'Rock',
        lighting: { level: 40, color: 'cool', zones: ['living_room', 'garage'] },
        audio: { mode: 'surround', profile: 'dts_x', volume: 65, subwoofer: 80, centerBoost: 0, loudness: true },
        video: { source: 1, output: 1, aspectRatio: '16:9' },
        screen: 'up',
        extras: { curtains: 'auto', hvac: 'normal' }
      },
      kids_content: {
        id: 'kids_content', name: 'Kids Content',
        lighting: { level: 70, color: 'daylight', zones: ['kids_room'] },
        audio: { mode: 'stereo', profile: 'stereo', volume: 30, subwoofer: 20, centerBoost: 4, maxVolume: 50 },
        video: { source: 1, output: 8, aspectRatio: '16:9' },
        screen: 'up',
        extras: { curtains: 'open', hvac: 'normal', contentFilter: true }
      },
      news: {
        id: 'news', name: 'News',
        lighting: { level: 60, color: 'neutral', zones: ['living_room', 'kitchen'] },
        audio: { mode: 'voice', profile: 'stereo', volume: 40, subwoofer: 15, centerBoost: 8 },
        video: { source: 3, output: 1, aspectRatio: '16:9' },
        screen: 'up',
        extras: { curtains: 'auto', hvac: 'normal' }
      }
    };

    this.log('Initialized ' + Object.keys(this.cinemaPresets).length + ' cinema presets');
  }

  // ─── Speaker Configurations ───────────────────────────────────────

  _initializeSpeakerConfigs() {
    this.speakerConfigs = {
      atmos_7_1_4: {
        id: 'atmos_7_1_4', name: 'Dolby Atmos 7.1.4', format: 'dolby_atmos',
        channels: {
          front_left: { distance: 3.0, level: 0, delay: 0, enabled: true },
          center: { distance: 2.8, level: 2, delay: 0, enabled: true },
          front_right: { distance: 3.0, level: 0, delay: 0, enabled: true },
          surround_left: { distance: 2.5, level: -1, delay: 5, enabled: true },
          surround_right: { distance: 2.5, level: -1, delay: 5, enabled: true },
          surround_back_left: { distance: 2.0, level: -2, delay: 8, enabled: true },
          surround_back_right: { distance: 2.0, level: -2, delay: 8, enabled: true },
          subwoofer: { distance: 3.5, level: 3, delay: 0, enabled: true, crossover: 80 },
          height_front_left: { distance: 3.2, level: -3, delay: 2, enabled: true },
          height_front_right: { distance: 3.2, level: -3, delay: 2, enabled: true },
          height_rear_left: { distance: 2.8, level: -3, delay: 6, enabled: true },
          height_rear_right: { distance: 2.8, level: -3, delay: 6, enabled: true }
        },
        crossoverFrequency: 80,
        distanceUnit: 'meters',
        calibrated: false,
        lastCalibration: null
      },
      dts_x: {
        id: 'dts_x', name: 'DTS:X', format: 'dts_x',
        channels: {
          front_left: { distance: 3.0, level: 0, delay: 0, enabled: true },
          center: { distance: 2.8, level: 2, delay: 0, enabled: true },
          front_right: { distance: 3.0, level: 0, delay: 0, enabled: true },
          surround_left: { distance: 2.5, level: -1, delay: 5, enabled: true },
          surround_right: { distance: 2.5, level: -1, delay: 5, enabled: true },
          surround_back_left: { distance: 2.0, level: -2, delay: 8, enabled: true },
          surround_back_right: { distance: 2.0, level: -2, delay: 8, enabled: true },
          subwoofer: { distance: 3.5, level: 3, delay: 0, enabled: true, crossover: 80 },
          height_front_left: { distance: 3.2, level: -3, delay: 2, enabled: true },
          height_front_right: { distance: 3.2, level: -3, delay: 2, enabled: true },
          height_rear_left: { distance: 2.8, level: -3, delay: 6, enabled: true },
          height_rear_right: { distance: 2.8, level: -3, delay: 6, enabled: true }
        },
        crossoverFrequency: 80,
        distanceUnit: 'meters',
        objectBasedAudio: true,
        calibrated: false,
        lastCalibration: null
      },
      stereo: {
        id: 'stereo', name: 'Stereo', format: 'stereo',
        channels: {
          left: { distance: 2.0, level: 0, delay: 0, enabled: true },
          right: { distance: 2.0, level: 0, delay: 0, enabled: true }
        },
        crossoverFrequency: null,
        distanceUnit: 'meters',
        calibrated: false,
        lastCalibration: null
      },
      stereo_outdoor: {
        id: 'stereo_outdoor', name: 'Stereo Outdoor', format: 'stereo',
        channels: {
          left: { distance: 4.0, level: 3, delay: 0, enabled: true },
          right: { distance: 4.0, level: 3, delay: 0, enabled: true }
        },
        crossoverFrequency: null,
        distanceUnit: 'meters',
        weatherResistant: true,
        calibrated: false,
        lastCalibration: null
      },
      mono: {
        id: 'mono', name: 'Mono', format: 'mono',
        channels: {
          center: { distance: 2.0, level: 0, delay: 0, enabled: true }
        },
        crossoverFrequency: null,
        distanceUnit: 'meters',
        calibrated: false,
        lastCalibration: null
      }
    };

    this.log('Initialized ' + Object.keys(this.speakerConfigs).length + ' speaker configurations');
  }

  // ─── Audio Calibration ────────────────────────────────────────────

  _initializeCalibration() {
    const eqBands = [31, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

    this.calibration = {};
    for (const zoneId of Object.keys(this.zones)) {
      this.calibration[zoneId] = {
        eq: eqBands.map(freq => ({ frequency: freq, gain: 0, q: 1.0 })),
        roomCorrection: {
          enabled: false,
          curves: eqBands.map(freq => ({ frequency: freq, correction: 0 })),
          reverbTime: 0.4,
          roomMode: 'auto'
        },
        referenceLevel: 75,
        dynamicEQ: true,
        dynamicVolume: 'medium',
        multEQ: 'reference',
        distanceCorrection: true,
        lastMeasurement: null
      };
    }

    this.log('Audio calibration initialized for ' + Object.keys(this.calibration).length + ' zones with ' + eqBands.length + '-band EQ');
  }

  // ─── Smart Volume ─────────────────────────────────────────────────

  _initializeSmartVolume() {
    this.smartVolume = {
      enabled: true,
      quietHours: { start: 22, end: 7, maxVolumePercent: 40 },
      rampDuration: 3000,
      rampSteps: 15,
      perZoneMaxLimits: {
        living_room: 100,
        kitchen: 80,
        bedroom: 70,
        bathroom: 60,
        office: 75,
        patio: 100,
        garage: 90,
        kids_room: 50
      },
      currentAdjustment: 1.0,
      lastCheck: null
    };

    this.log('Smart volume initialized with quiet hours ' + this.smartVolume.quietHours.start + ':00 - ' + this.smartVolume.quietHours.end + ':00');
  }

  // ─── Projector Management ─────────────────────────────────────────

  _initializeProjector() {
    this.projector = {
      power: false,
      lampHours: 1247,
      lampLifeMax: 5000,
      ecoMode: false,
      screen: {
        position: 'up',
        transitioning: false,
        transitTime: 15000
      },
      aspectRatio: '16:9',
      availableAspectRatios: ['16:9', '21:9', '4:3'],
      brightness: 100,
      contrast: 50,
      inputSource: 1,
      resolution: '4K',
      hdrMode: 'auto',
      keystone: { horizontal: 0, vertical: 0 },
      autoOffNoSignal: true,
      autoOffDelay: 300000,
      noSignalTimer: null,
      fanSpeed: 'auto',
      temperature: 35,
      maxTemperature: 85,
      filterHours: 800,
      filterLifeMax: 2000,
      lastPowerOn: null,
      errorState: null
    };

    this.log('Projector initialized - Lamp hours: ' + this.projector.lampHours + '/' + this.projector.lampLifeMax);
  }

  // ─── Background Music ─────────────────────────────────────────────

  _initializeBackgroundMusic() {
    this.backgroundMusic = {
      enabled: false,
      schedule: {
        morning: { start: 7, end: 12, genre: 'energetic', playlist: 'Morning Energy', source: 'spotify', volume: 30 },
        afternoon: { start: 12, end: 17, genre: 'chill', playlist: 'Afternoon Chill', source: 'spotify', volume: 25 },
        evening: { start: 17, end: 22, genre: 'jazz', playlist: 'Evening Jazz', source: 'tidal', volume: 25 },
        night: { start: 22, end: 7, genre: 'ambient', playlist: 'Night Ambient', source: 'local_nas', volume: 15 }
      },
      activeSlot: null,
      targetZones: ['living_room', 'kitchen'],
      fadeInDuration: 5000,
      fadeOutDuration: 3000,
      pauseOnAnnouncement: true,
      pauseOnCall: true,
      currentPlaylist: null,
      shuffleEnabled: true,
      repeatMode: 'all'
    };

    this.log('Background music scheduler initialized with ' + Object.keys(this.backgroundMusic.schedule).length + ' time slots');
  }

  // ─── Streaming Sources ────────────────────────────────────────────

  _initializeStreamingSources() {
    this.streamingSources = {
      spotify: {
        id: 'spotify', name: 'Spotify', type: 'streaming',
        connected: false, authenticated: false,
        quality: 'very_high', bitrate: 320,
        supportsConnect: true, supportsCast: true,
        lastSync: null
      },
      tidal: {
        id: 'tidal', name: 'Tidal', type: 'streaming',
        connected: false, authenticated: false,
        quality: 'master', bitrate: 9216,
        supportsMQA: true, supportsAtmos: true,
        lastSync: null
      },
      apple_music: {
        id: 'apple_music', name: 'Apple Music', type: 'streaming',
        connected: false, authenticated: false,
        quality: 'lossless', bitrate: 1411,
        supportsSpatial: true, supportsLossless: true,
        lastSync: null
      },
      local_nas: {
        id: 'local_nas', name: 'Local NAS', type: 'local',
        connected: false, path: '//nas/music',
        formats: ['flac', 'wav', 'aiff', 'mp3', 'aac', 'ogg'],
        librarySize: 0, indexed: false,
        lastScan: null
      },
      bluetooth: {
        id: 'bluetooth', name: 'Bluetooth', type: 'wireless',
        connected: false, pairedDevices: [],
        codec: 'aptx_hd', version: '5.2',
        maxDevices: 2
      },
      airplay: {
        id: 'airplay', name: 'AirPlay', type: 'wireless',
        connected: false, version: 2,
        multiroom: true, lossless: true,
        discoverable: true
      },
      chromecast: {
        id: 'chromecast', name: 'Chromecast', type: 'cast',
        connected: false, version: 'ultra',
        groupCast: true, multiroom: true,
        highDynamic: true
      },
      optical: {
        id: 'optical', name: 'Optical (TOSLINK)', type: 'wired',
        connected: false, format: 'pcm',
        maxSampleRate: 96000, maxBitDepth: 24,
        signalPresent: false
      }
    };

    this.log('Initialized ' + Object.keys(this.streamingSources).length + ' streaming sources');
  }

  // ─── HDMI-CEC ─────────────────────────────────────────────────────

  _initializeHdmiCec() {
    this.hdmiCec = {
      enabled: true,
      devices: {
        tv: { address: '0.0.0.0', name: 'TV', power: false, vendor: 'Samsung', cecVersion: '1.4' },
        receiver: { address: '1.0.0.0', name: 'AV Receiver', power: false, vendor: 'Denon', cecVersion: '1.4' },
        player: { address: '4.0.0.0', name: 'Apple TV', power: false, vendor: 'Apple', cecVersion: '1.4' },
        console: { address: '8.0.0.0', name: 'Gaming Console', power: false, vendor: 'Sony', cecVersion: '1.4' }
      },
      powerOnChain: ['receiver', 'player', 'tv'],
      powerOffChain: ['tv', 'player', 'receiver'],
      volumePassthrough: true,
      volumeTarget: 'receiver',
      inputSwitching: true,
      autoStandby: true,
      standbyTimeout: 1800000,
      oneTouch: true,
      arcEnabled: true,
      lastCommand: null
    };

    this.log('HDMI-CEC initialized with ' + Object.keys(this.hdmiCec.devices).length + ' devices');
  }

  // ─── Lip-Sync Correction ──────────────────────────────────────────

  _initializeLipSync() {
    this.lipSync = {
      enabled: true,
      globalDelay: 0,
      perSourceDelay: {
        1: 45,
        2: 20,
        3: 60,
        4: 35
      },
      autoDetect: true,
      maxDelay: 500,
      minDelay: 0,
      lastAdjustment: null
    };

    this.log('Lip-sync correction initialized (range 0-500ms)');
  }

  // ─── Power Sequencing ─────────────────────────────────────────────

  _initializePowerSequence() {
    this.powerSequence = {
      onSequence: [
        { device: 'receiver', delay: 0, action: 'power_on' },
        { device: 'processor', delay: 2000, action: 'power_on' },
        { device: 'amplifier', delay: 4000, action: 'power_on' },
        { device: 'display', delay: 6000, action: 'power_on' }
      ],
      offSequence: [
        { device: 'display', delay: 0, action: 'power_off' },
        { device: 'amplifier', delay: 2000, action: 'power_off' },
        { device: 'processor', delay: 4000, action: 'power_off' },
        { device: 'receiver', delay: 6000, action: 'power_off' }
      ],
      deviceStates: {
        receiver: { power: false, ready: false, warmUpTime: 3000 },
        processor: { power: false, ready: false, warmUpTime: 2000 },
        amplifier: { power: false, ready: false, warmUpTime: 5000 },
        display: { power: false, ready: false, warmUpTime: 4000 }
      },
      sequencing: false,
      currentStep: -1,
      sequenceTimers: []
    };

    this.log('Power sequencing initialized: ' + this.powerSequence.onSequence.length + ' devices in chain');
  }

  // ─── Energy Monitoring ────────────────────────────────────────────

  _initializeEnergyMonitoring() {
    this.energyMonitoring = {
      devices: {
        receiver: { wattage: 0, standbyWattage: 0.5, maxWattage: 450, dailyKwh: 0, monthlyKwh: 0, isStandby: true, lastReading: null },
        processor: { wattage: 0, standbyWattage: 0.3, maxWattage: 80, dailyKwh: 0, monthlyKwh: 0, isStandby: true, lastReading: null },
        amplifier: { wattage: 0, standbyWattage: 1.0, maxWattage: 600, dailyKwh: 0, monthlyKwh: 0, isStandby: true, lastReading: null },
        display: { wattage: 0, standbyWattage: 0.5, maxWattage: 150, dailyKwh: 0, monthlyKwh: 0, isStandby: true, lastReading: null },
        projector: { wattage: 0, standbyWattage: 0.8, maxWattage: 350, dailyKwh: 0, monthlyKwh: 0, isStandby: true, lastReading: null },
        subwoofer: { wattage: 0, standbyWattage: 2.0, maxWattage: 250, dailyKwh: 0, monthlyKwh: 0, isStandby: true, lastReading: null },
        apple_tv: { wattage: 0, standbyWattage: 1.0, maxWattage: 6, dailyKwh: 0, monthlyKwh: 0, isStandby: true, lastReading: null },
        gaming_console: { wattage: 0, standbyWattage: 1.5, maxWattage: 200, dailyKwh: 0, monthlyKwh: 0, isStandby: true, lastReading: null }
      },
      totalDailyKwh: 0,
      totalMonthlyKwh: 0,
      standbyDetectionThreshold: 5,
      trackingStarted: null,
      lastReset: null
    };

    this.energyMonitoring.trackingStarted = Date.now();
    this.energyMonitoring.lastReset = Date.now();

    this.log('Energy monitoring initialized for ' + Object.keys(this.energyMonitoring.devices).length + ' devices');
  }

  // ─── Zone Control Methods ─────────────────────────────────────────

  setZoneVolume(zoneId, volume) {
    const zone = this.zones[zoneId];
    if (!zone) {
      this.error('Zone not found: ' + zoneId);
      return false;
    }

    const maxAllowed = this._getEffectiveMaxVolume(zoneId);
    const clampedVolume = Math.max(0, Math.min(volume, maxAllowed));
    zone.volume = clampedVolume;
    zone.lastActivity = Date.now();

    this.log('Zone ' + zone.name + ' volume set to ' + clampedVolume + ' (max allowed: ' + maxAllowed + ')');
    return true;
  }

  setZoneSource(zoneId, sourceId) {
    const zone = this.zones[zoneId];
    if (!zone) {
      this.error('Zone not found: ' + zoneId);
      return false;
    }

    const source = this.streamingSources[sourceId];
    if (!source) {
      this.error('Source not found: ' + sourceId);
      return false;
    }

    zone.source = sourceId;
    zone.lastActivity = Date.now();
    this.log('Zone ' + zone.name + ' source set to ' + source.name);
    return true;
  }

  toggleZonePower(zoneId) {
    const zone = this.zones[zoneId];
    if (!zone) return false;

    zone.power = !zone.power;
    zone.lastActivity = Date.now();
    if (!zone.power) {
      zone.playing = false;
      zone.currentTrack = null;
    }

    this.log('Zone ' + zone.name + ' power: ' + (zone.power ? 'ON' : 'OFF'));
    return true;
  }

  muteZone(zoneId, muted) {
    const zone = this.zones[zoneId];
    if (!zone) return false;

    zone.muted = muted;
    zone.lastActivity = Date.now();
    this.log('Zone ' + zone.name + ' mute: ' + (muted ? 'ON' : 'OFF'));
    return true;
  }

  // ─── Zone Grouping ────────────────────────────────────────────────

  activateGroup(groupId) {
    const group = this.zoneGroups[groupId];
    if (!group) {
      this.error('Group not found: ' + groupId);
      return false;
    }

    group.active = true;
    for (const zoneId of group.zones) {
      if (this.zones[zoneId]) {
        this.zones[zoneId].groupId = groupId;
        this.zones[zoneId].power = true;
        this.zones[zoneId].lastActivity = Date.now();
      }
    }

    this.log('Group ' + group.name + ' activated with ' + group.zones.length + ' zones');
    return true;
  }

  deactivateGroup(groupId) {
    const group = this.zoneGroups[groupId];
    if (!group) return false;

    group.active = false;
    for (const zoneId of group.zones) {
      if (this.zones[zoneId]) {
        this.zones[zoneId].groupId = null;
      }
    }

    this.log('Group ' + group.name + ' deactivated');
    return true;
  }

  setGroupVolume(groupId, volume) {
    const group = this.zoneGroups[groupId];
    if (!group || !group.active) return false;

    for (const zoneId of group.zones) {
      this.setZoneVolume(zoneId, volume);
    }
    return true;
  }

  // ─── HDMI Matrix Control ──────────────────────────────────────────

  switchHdmiInput(outputId, inputId) {
    const output = this.hdmiMatrix.outputs.find(o => o.id === outputId);
    const input = this.hdmiMatrix.inputs.find(i => i.id === inputId);
    if (!output || !input) {
      this.error('Invalid HDMI switch: output ' + outputId + ' → input ' + inputId);
      return false;
    }

    output.assignedInput = inputId;
    this.log('HDMI matrix: ' + output.name + ' → ' + input.name);
    return true;
  }

  getActiveHdmiRoute(outputId) {
    const output = this.hdmiMatrix.outputs.find(o => o.id === outputId);
    if (!output) return null;

    const input = this.hdmiMatrix.inputs.find(i => i.id === output.assignedInput);
    return { output: output, input: input };
  }

  // ─── Cinema Preset Activation ─────────────────────────────────────

  activatePreset(presetId) {
    const preset = this.cinemaPresets[presetId];
    if (!preset) {
      this.error('Preset not found: ' + presetId);
      return false;
    }

    this.log('Activating cinema preset: ' + preset.name);
    this.activePreset = presetId;

    // Apply audio settings
    if (preset.audio) {
      const targetZones = preset.lighting.zones || ['living_room'];
      for (const zoneId of targetZones) {
        if (this.zones[zoneId]) {
          this.zones[zoneId].power = true;
          this.setZoneVolume(zoneId, preset.audio.volume);
          this.zones[zoneId].lastActivity = Date.now();
        }
      }
    }

    // Apply video routing
    if (preset.video && preset.video.source && preset.video.output) {
      this.switchHdmiInput(preset.video.output, preset.video.source);
      if (preset.video.aspectRatio && preset.video.output === 5) {
        this.projector.aspectRatio = preset.video.aspectRatio;
      }
    }

    // Apply screen position
    if (preset.screen) {
      this._setScreenPosition(preset.screen);
    }

    this.statistics.presetsActivated++;
    this.log('Preset ' + preset.name + ' activated successfully');
    return true;
  }

  deactivatePreset() {
    if (!this.activePreset) return false;

    const preset = this.cinemaPresets[this.activePreset];
    this.log('Deactivating preset: ' + (preset ? preset.name : this.activePreset));
    this.activePreset = null;
    return true;
  }

  // ─── Projector Control ────────────────────────────────────────────

  projectorPower(on) {
    if (on && !this.projector.power) {
      this.projector.power = true;
      this.projector.lastPowerOn = Date.now();
      this.projector.temperature = 35;
      this.log('Projector powered ON (lamp hours: ' + this.projector.lampHours + ')');

      if (this.projector.lampHours > this.projector.lampLifeMax * 0.9) {
        this.log('WARNING: Projector lamp at ' + Math.round((this.projector.lampHours / this.projector.lampLifeMax) * 100) + '% of life');
      }
    } else if (!on && this.projector.power) {
      this.projector.power = false;
      const sessionMinutes = this.projector.lastPowerOn
        ? Math.round((Date.now() - this.projector.lastPowerOn) / 60000)
        : 0;
      this.projector.lampHours += sessionMinutes / 60;
      this.log('Projector powered OFF (session: ' + sessionMinutes + ' min)');
    }

    return true;
  }

  setProjectorEcoMode(enabled) {
    this.projector.ecoMode = enabled;
    this.projector.brightness = enabled ? 70 : 100;
    this.log('Projector eco mode: ' + (enabled ? 'ON (70% brightness)' : 'OFF (100% brightness)'));
    return true;
  }

  _setScreenPosition(position) {
    if (this.projector.screen.transitioning) {
      this.log('Screen already transitioning, ignoring command');
      return false;
    }

    if (this.projector.screen.position === position) return true;

    this.projector.screen.transitioning = true;
    this.log('Screen moving to: ' + position);

    setTimeout(() => {
      this.projector.screen.position = position;
      this.projector.screen.transitioning = false;
      this.log('Screen reached position: ' + position);
    }, this.projector.screen.transitTime);

    return true;
  }

  setAspectRatio(ratio) {
    if (!this.projector.availableAspectRatios.includes(ratio)) {
      this.error('Unsupported aspect ratio: ' + ratio);
      return false;
    }

    this.projector.aspectRatio = ratio;
    this.log('Aspect ratio set to ' + ratio);
    return true;
  }

  // ─── Audio Calibration ────────────────────────────────────────────

  runCalibration(zoneId) {
    const cal = this.calibration[zoneId];
    if (!cal) {
      this.error('No calibration data for zone: ' + zoneId);
      return false;
    }

    this.log('Running audio calibration for zone: ' + zoneId);

    // Simulate room measurement and correction
    cal.roomCorrection.enabled = true;
    for (const curve of cal.roomCorrection.curves) {
      curve.correction = Math.round((Math.random() * 6 - 3) * 10) / 10;
    }
    cal.lastMeasurement = Date.now();

    const speakerConfigId = this.zones[zoneId] ? this.zones[zoneId].speakerConfig : null;
    if (speakerConfigId && this.speakerConfigs[speakerConfigId]) {
      this.speakerConfigs[speakerConfigId].calibrated = true;
      this.speakerConfigs[speakerConfigId].lastCalibration = Date.now();
    }

    this.statistics.calibrationsRun++;
    this.log('Calibration complete for zone: ' + zoneId);
    return true;
  }

  setEQ(zoneId, bandIndex, gain) {
    const cal = this.calibration[zoneId];
    if (!cal || bandIndex < 0 || bandIndex >= cal.eq.length) return false;

    const clampedGain = Math.max(-12, Math.min(12, gain));
    cal.eq[bandIndex].gain = clampedGain;
    this.log('Zone ' + zoneId + ' EQ band ' + cal.eq[bandIndex].frequency + 'Hz set to ' + clampedGain + 'dB');
    return true;
  }

  // ─── Smart Volume Engine ──────────────────────────────────────────

  _getEffectiveMaxVolume(zoneId) {
    if (!this.smartVolume.enabled) {
      return this.zones[zoneId] ? this.zones[zoneId].maxVolume : 100;
    }

    const now = new Date();
    const hour = now.getHours();
    const quietStart = this.smartVolume.quietHours.start;
    const quietEnd = this.smartVolume.quietHours.end;

    let isQuietHour = false;
    if (quietStart > quietEnd) {
      isQuietHour = hour >= quietStart || hour < quietEnd;
    } else {
      isQuietHour = hour >= quietStart && hour < quietEnd;
    }

    const zoneMax = this.smartVolume.perZoneMaxLimits[zoneId] || 100;
    const baseMax = this.zones[zoneId] ? this.zones[zoneId].maxVolume : 100;
    const effectiveMax = Math.min(zoneMax, baseMax);

    if (isQuietHour) {
      return Math.round(effectiveMax * (this.smartVolume.quietHours.maxVolumePercent / 100));
    }

    return effectiveMax;
  }

  _enforceSmartVolume() {
    if (!this.smartVolume.enabled) return;

    for (const zoneId of Object.keys(this.zones)) {
      const zone = this.zones[zoneId];
      const maxAllowed = this._getEffectiveMaxVolume(zoneId);

      if (zone.volume > maxAllowed) {
        this.log('Smart volume enforcing: ' + zone.name + ' reduced from ' + zone.volume + ' to ' + maxAllowed);
        zone.volume = maxAllowed;
      }
    }

    this.smartVolume.lastCheck = Date.now();
  }

  gradualVolumeRamp(zoneId, targetVolume, durationMs) {
    const zone = this.zones[zoneId];
    if (!zone) return false;

    const duration = durationMs || this.smartVolume.rampDuration;
    const steps = this.smartVolume.rampSteps;
    const startVolume = zone.volume;
    const maxAllowed = this._getEffectiveMaxVolume(zoneId);
    const clampedTarget = Math.min(targetVolume, maxAllowed);
    const stepSize = (clampedTarget - startVolume) / steps;
    const stepDelay = duration / steps;

    let currentStep = 0;

    const rampInterval = setInterval(() => {
      currentStep++;
      zone.volume = Math.round(startVolume + stepSize * currentStep);

      if (currentStep >= steps) {
        zone.volume = clampedTarget;
        clearInterval(rampInterval);
        this.log('Volume ramp complete: ' + zone.name + ' → ' + clampedTarget);
      }
    }, stepDelay);

    this.log('Volume ramp started: ' + zone.name + ' ' + startVolume + ' → ' + clampedTarget + ' over ' + duration + 'ms');
    return true;
  }

  // ─── Background Music Scheduler ───────────────────────────────────

  _evaluateBackgroundMusic() {
    if (!this.backgroundMusic.enabled) return;

    const now = new Date();
    const hour = now.getHours();
    let activeSlot = null;

    for (const [slotName, slot] of Object.entries(this.backgroundMusic.schedule)) {
      if (slot.start <= slot.end) {
        if (hour >= slot.start && hour < slot.end) {
          activeSlot = slotName;
          break;
        }
      } else {
        if (hour >= slot.start || hour < slot.end) {
          activeSlot = slotName;
          break;
        }
      }
    }

    if (activeSlot !== this.backgroundMusic.activeSlot) {
      const prevSlot = this.backgroundMusic.activeSlot;
      this.backgroundMusic.activeSlot = activeSlot;

      if (activeSlot) {
        const slot = this.backgroundMusic.schedule[activeSlot];
        this.backgroundMusic.currentPlaylist = slot.playlist;

        for (const zoneId of this.backgroundMusic.targetZones) {
          if (this.zones[zoneId] && !this.zones[zoneId].playing) {
            this.zones[zoneId].source = slot.source;
            this.zones[zoneId].currentTrack = slot.playlist;
            this.gradualVolumeRamp(zoneId, slot.volume, this.backgroundMusic.fadeInDuration);
          }
        }

        this.log('Background music switched: ' + (prevSlot || 'none') + ' → ' + activeSlot + ' (' + slot.playlist + ')');
      } else {
        this.backgroundMusic.currentPlaylist = null;
        this.log('Background music slot ended');
      }
    }
  }

  enableBackgroundMusic(enabled) {
    this.backgroundMusic.enabled = enabled;
    if (!enabled) {
      this.backgroundMusic.activeSlot = null;
      this.backgroundMusic.currentPlaylist = null;
    }
    this.log('Background music: ' + (enabled ? 'enabled' : 'disabled'));
    return true;
  }

  // ─── Streaming Source Management ──────────────────────────────────

  connectSource(sourceId) {
    const source = this.streamingSources[sourceId];
    if (!source) {
      this.error('Unknown source: ' + sourceId);
      return false;
    }

    source.connected = true;
    source.lastSync = Date.now();
    this.log('Source connected: ' + source.name);
    return true;
  }

  disconnectSource(sourceId) {
    const source = this.streamingSources[sourceId];
    if (!source) return false;

    source.connected = false;
    this.log('Source disconnected: ' + source.name);
    return true;
  }

  getSourceStatus() {
    const status = {};
    for (const [id, source] of Object.entries(this.streamingSources)) {
      status[id] = {
        name: source.name,
        connected: source.connected,
        type: source.type
      };
    }
    return status;
  }

  // ─── HDMI-CEC Control ────────────────────────────────────────────

  cecPowerOn() {
    this.log('CEC power-on chain initiated');
    let delay = 0;

    for (const deviceId of this.hdmiCec.powerOnChain) {
      const device = this.hdmiCec.devices[deviceId];
      if (device) {
        setTimeout(() => {
          device.power = true;
          this.log('CEC power ON: ' + device.name);
        }, delay);
        delay += 2000;
      }
    }

    this.hdmiCec.lastCommand = { type: 'power_on', timestamp: Date.now() };
    return true;
  }

  cecPowerOff() {
    this.log('CEC power-off chain initiated');
    let delay = 0;

    for (const deviceId of this.hdmiCec.powerOffChain) {
      const device = this.hdmiCec.devices[deviceId];
      if (device) {
        setTimeout(() => {
          device.power = false;
          this.log('CEC power OFF: ' + device.name);
        }, delay);
        delay += 2000;
      }
    }

    this.hdmiCec.lastCommand = { type: 'power_off', timestamp: Date.now() };
    return true;
  }

  cecSwitchInput(deviceId) {
    const device = this.hdmiCec.devices[deviceId];
    if (!device) return false;

    this.log('CEC input switch to: ' + device.name);
    this.hdmiCec.lastCommand = { type: 'input_switch', device: deviceId, timestamp: Date.now() };
    return true;
  }

  cecVolumePassthrough(volume) {
    if (!this.hdmiCec.volumePassthrough) return false;

    const target = this.hdmiCec.devices[this.hdmiCec.volumeTarget];
    if (target) {
      this.log('CEC volume passthrough to ' + target.name + ': ' + volume);
    }
    return true;
  }

  // ─── Lip-Sync Correction ──────────────────────────────────────────

  setLipSyncDelay(sourceId, delayMs) {
    if (delayMs < this.lipSync.minDelay || delayMs > this.lipSync.maxDelay) {
      this.error('Lip-sync delay out of range (0-500ms): ' + delayMs);
      return false;
    }

    this.lipSync.perSourceDelay[sourceId] = delayMs;
    this.lipSync.lastAdjustment = Date.now();
    this.log('Lip-sync delay for source ' + sourceId + ' set to ' + delayMs + 'ms');
    return true;
  }

  getLipSyncDelay(sourceId) {
    return this.lipSync.perSourceDelay[sourceId] || this.lipSync.globalDelay;
  }

  // ─── Audio Announcements ──────────────────────────────────────────

  sendAnnouncement(message, targetZones, priority) {
    const announcement = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      message: message,
      targetZones: targetZones || Object.keys(this.zones),
      priority: priority || 'normal',
      timestamp: Date.now(),
      delivered: false,
      duckedZones: []
    };

    this.announcements.queue.push(announcement);
    this.log('Announcement queued (priority: ' + announcement.priority + '): "' + message + '" → ' + announcement.targetZones.length + ' zones');

    this._processAnnouncementQueue();
    return announcement.id;
  }

  _processAnnouncementQueue() {
    if (this.announcements.active || this.announcements.queue.length === 0) return;

    // Sort by priority
    const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
    this.announcements.queue.sort((a, b) => (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2));

    const announcement = this.announcements.queue.shift();
    this.announcements.active = true;

    // Duck existing audio in target zones
    for (const zoneId of announcement.targetZones) {
      const zone = this.zones[zoneId];
      if (zone && zone.playing) {
        announcement.duckedZones.push({ zoneId: zoneId, originalVolume: zone.volume });
        zone.volume = Math.round(zone.volume * 0.2);
      }
    }

    this.log('Playing announcement in ' + announcement.targetZones.length + ' zones');

    // Simulate TTS playback duration
    const estimatedDuration = Math.max(2000, announcement.message.length * 80);

    setTimeout(() => {
      // Restore ducked zones
      for (const ducked of announcement.duckedZones) {
        const zone = this.zones[ducked.zoneId];
        if (zone) {
          zone.volume = ducked.originalVolume;
        }
      }

      announcement.delivered = true;
      this.announcements.active = false;
      this.statistics.announcementsSent++;

      this.log('Announcement delivered: "' + announcement.message + '"');

      // Process next in queue
      if (this.announcements.queue.length > 0) {
        this._processAnnouncementQueue();
      }
    }, estimatedDuration);
  }

  // ─── AV Power Sequencing ──────────────────────────────────────────

  powerOnSequence() {
    if (this.powerSequence.sequencing) {
      this.log('Power sequence already in progress');
      return false;
    }

    this.powerSequence.sequencing = true;
    this.powerSequence.currentStep = 0;
    this.log('Starting power-on sequence...');

    for (const step of this.powerSequence.onSequence) {
      const timer = setTimeout(() => {
        const device = this.powerSequence.deviceStates[step.device];
        if (device) {
          device.power = true;
          this.log('Power ON: ' + step.device);

          setTimeout(() => {
            device.ready = true;
            this.log(step.device + ' ready');
          }, device.warmUpTime);
        }
        this.powerSequence.currentStep++;

        if (this.powerSequence.currentStep >= this.powerSequence.onSequence.length) {
          this.powerSequence.sequencing = false;
          this.statistics.powerCycles++;
          this.log('Power-on sequence complete');
        }
      }, step.delay);

      this.powerSequence.sequenceTimers.push(timer);
    }

    return true;
  }

  powerOffSequence() {
    if (this.powerSequence.sequencing) {
      this.log('Power sequence already in progress');
      return false;
    }

    this.powerSequence.sequencing = true;
    this.powerSequence.currentStep = 0;
    this.log('Starting power-off sequence...');

    for (const step of this.powerSequence.offSequence) {
      const timer = setTimeout(() => {
        const device = this.powerSequence.deviceStates[step.device];
        if (device) {
          device.power = false;
          device.ready = false;
          this.log('Power OFF: ' + step.device);
        }
        this.powerSequence.currentStep++;

        if (this.powerSequence.currentStep >= this.powerSequence.offSequence.length) {
          this.powerSequence.sequencing = false;
          this.statistics.powerCycles++;
          this.log('Power-off sequence complete');
        }
      }, step.delay);

      this.powerSequence.sequenceTimers.push(timer);
    }

    return true;
  }

  // ─── Energy Monitoring ────────────────────────────────────────────

  _updateEnergyReadings() {
    let totalWattage = 0;

    for (const [deviceId, device] of Object.entries(this.energyMonitoring.devices)) {
      const seqDevice = this.powerSequence.deviceStates[deviceId];
      const isOn = seqDevice ? seqDevice.power : false;

      if (isOn) {
        device.wattage = Math.round(device.maxWattage * (0.3 + Math.random() * 0.4));
        device.isStandby = false;
      } else {
        device.wattage = device.standbyWattage;
        device.isStandby = device.wattage <= this.energyMonitoring.standbyDetectionThreshold;
      }

      // Accumulate kWh (called every 60s → 1/60 of an hour)
      const hourlyKwh = device.wattage / 1000;
      const incrementKwh = hourlyKwh / 60;
      device.dailyKwh += incrementKwh;
      device.monthlyKwh += incrementKwh;
      device.lastReading = Date.now();

      totalWattage += device.wattage;
    }

    this.energyMonitoring.totalDailyKwh = Object.values(this.energyMonitoring.devices)
      .reduce((sum, d) => sum + d.dailyKwh, 0);
    this.energyMonitoring.totalMonthlyKwh = Object.values(this.energyMonitoring.devices)
      .reduce((sum, d) => sum + d.monthlyKwh, 0);

    this.statistics.energyTotalKwh = Math.round(this.energyMonitoring.totalMonthlyKwh * 100) / 100;
  }

  getEnergyReport() {
    const report = {
      timestamp: Date.now(),
      totalCurrentWattage: 0,
      dailyKwh: this.energyMonitoring.totalDailyKwh,
      monthlyKwh: this.energyMonitoring.totalMonthlyKwh,
      devices: {}
    };

    for (const [id, device] of Object.entries(this.energyMonitoring.devices)) {
      report.totalCurrentWattage += device.wattage;
      report.devices[id] = {
        wattage: device.wattage,
        dailyKwh: Math.round(device.dailyKwh * 1000) / 1000,
        monthlyKwh: Math.round(device.monthlyKwh * 1000) / 1000,
        isStandby: device.isStandby
      };
    }

    return report;
  }

  // ─── Party Mode ───────────────────────────────────────────────────

  activatePartyMode(masterZoneId) {
    const masterZone = this.zones[masterZoneId || 'living_room'];
    if (!masterZone) {
      this.error('Master zone not found for party mode');
      return false;
    }

    this.partyMode.active = true;
    this.partyMode.masterZone = masterZone.id;
    this.partyMode.syncOffset = 0;

    // Link all zones
    for (const zoneId of Object.keys(this.zones)) {
      const zone = this.zones[zoneId];
      zone.power = true;
      zone.source = masterZone.source;
      zone.playing = true;
      zone.groupId = 'party';
      zone.lastActivity = Date.now();
    }

    // Activate whole home group
    this.zoneGroups.whole_home.active = true;

    this.statistics.partyModeActivations++;
    this.log('Party mode activated! Master zone: ' + masterZone.name + ', all ' + Object.keys(this.zones).length + ' zones linked');
    return true;
  }

  deactivatePartyMode() {
    if (!this.partyMode.active) return false;

    this.partyMode.active = false;

    for (const zoneId of Object.keys(this.zones)) {
      const zone = this.zones[zoneId];
      zone.groupId = null;
      zone.volume = zone.defaultVolume;
    }

    this.zoneGroups.whole_home.active = false;
    this.log('Party mode deactivated');
    return true;
  }

  setPartyVolume(volume) {
    if (!this.partyMode.active) return false;

    for (const zoneId of Object.keys(this.zones)) {
      this.setZoneVolume(zoneId, volume);
    }

    this.log('Party mode volume set to ' + volume + ' across all zones');
    return true;
  }

  dynamicPartyVolume(energyLevel) {
    if (!this.partyMode.active) return false;

    const baseVolume = 40;
    const maxBoost = 35;
    const clampedEnergy = Math.max(0, Math.min(1, energyLevel));
    const targetVolume = Math.round(baseVolume + maxBoost * clampedEnergy);

    this.setPartyVolume(targetVolume);
    this.log('Dynamic party volume adjusted to ' + targetVolume + ' (energy: ' + Math.round(clampedEnergy * 100) + '%)');
    return true;
  }

  // ─── Equipment Monitoring (5-min cycle) ───────────────────────────

  _startMonitoringCycle() {
    this.monitoringInterval = setInterval(() => {
      this._monitorEquipment();
    }, 300000); // 5 minutes

    this.log('Equipment monitoring started (5-minute cycle)');
  }

  _monitorEquipment() {
    this.log('Running equipment monitoring cycle...');

    // Check zone health
    for (const [zoneId, zone] of Object.entries(this.zones)) {
      if (zone.power && zone.errorCount > 3) {
        this.error('Zone ' + zone.name + ' has ' + zone.errorCount + ' errors — flagging for attention');
        this.statistics.errorsDetected++;
      }
    }

    // Check HDMI inputs
    for (const input of this.hdmiMatrix.inputs) {
      if (input.connected && !input.signalPresent) {
        this.log('HDMI input ' + input.id + ' (' + input.name + '): connected but no signal');
      }
    }

    // Check projector
    if (this.projector.power) {
      if (this.projector.temperature > this.projector.maxTemperature * 0.85) {
        this.error('Projector temperature warning: ' + this.projector.temperature + '°C (max: ' + this.projector.maxTemperature + '°C)');
        this.statistics.errorsDetected++;
      }

      const lampPercent = Math.round((this.projector.lampHours / this.projector.lampLifeMax) * 100);
      if (lampPercent > 80) {
        this.log('Projector lamp at ' + lampPercent + '% — consider replacement soon');
      }

      const filterPercent = Math.round((this.projector.filterHours / this.projector.filterLifeMax) * 100);
      if (filterPercent > 80) {
        this.log('Projector filter at ' + filterPercent + '% — cleaning recommended');
      }
    }

    // Auto-off projector on no signal
    if (this.projector.power && this.projector.autoOffNoSignal) {
      const currentInput = this.hdmiMatrix.inputs.find(i => i.id === this.projector.inputSource);
      if (currentInput && !currentInput.signalPresent) {
        if (!this.projector.noSignalTimer) {
          this.projector.noSignalTimer = setTimeout(() => {
            this.log('Projector auto-off: no signal detected for ' + (this.projector.autoOffDelay / 60000) + ' minutes');
            this.projectorPower(false);
            this._setScreenPosition('up');
            this.projector.noSignalTimer = null;
          }, this.projector.autoOffDelay);
        }
      } else if (this.projector.noSignalTimer) {
        clearTimeout(this.projector.noSignalTimer);
        this.projector.noSignalTimer = null;
      }
    }

    // Check streaming sources
    for (const [sourceId, source] of Object.entries(this.streamingSources)) {
      if (source.connected && source.lastSync) {
        const sinceLast = Date.now() - source.lastSync;
        if (sinceLast > 3600000) {
          this.log('Source ' + source.name + ' last synced ' + Math.round(sinceLast / 60000) + ' min ago');
        }
      }
    }

    // Check power sequence devices
    for (const [deviceId, device] of Object.entries(this.powerSequence.deviceStates)) {
      if (device.power && !device.ready) {
        this.log('Device ' + deviceId + ' is powered but not ready — possible issue');
        this.statistics.errorsDetected++;
      }
    }

    // Check energy anomalies
    for (const [deviceId, device] of Object.entries(this.energyMonitoring.devices)) {
      if (device.wattage > device.maxWattage) {
        this.error('Energy anomaly: ' + deviceId + ' drawing ' + device.wattage + 'W (max: ' + device.maxWattage + 'W)');
        this.statistics.errorsDetected++;
      }
    }

    this.log('Equipment monitoring cycle complete');
  }

  // ─── Interval Starters ───────────────────────────────────────────

  _startBackgroundMusicScheduler() {
    this.backgroundMusicInterval = setInterval(() => {
      this._evaluateBackgroundMusic();
    }, 60000); // every 1 minute

    this.log('Background music scheduler started (1-minute interval)');
  }

  _startSmartVolumeEnforcer() {
    this.smartVolumeInterval = setInterval(() => {
      this._enforceSmartVolume();
    }, 30000); // every 30 seconds

    this.log('Smart volume enforcer started (30-second interval)');
  }

  _startEnergyTracking() {
    this.energyInterval = setInterval(() => {
      this._updateEnergyReadings();
    }, 60000); // every 1 minute

    this.log('Energy tracking started (1-minute interval)');
  }

  // ─── Statistics ───────────────────────────────────────────────────

  getStatistics() {
    const uptime = this.statistics.uptimeStart
      ? Math.round((Date.now() - this.statistics.uptimeStart) / 1000)
      : 0;

    const activeZones = Object.values(this.zones).filter(z => z.power).length;
    const playingZones = Object.values(this.zones).filter(z => z.playing).length;
    const connectedSources = Object.values(this.streamingSources).filter(s => s.connected).length;

    return {
      uptime: uptime,
      uptimeFormatted: this._formatUptime(uptime),
      zones: {
        total: Object.keys(this.zones).length,
        active: activeZones,
        playing: playingZones
      },
      sources: {
        total: Object.keys(this.streamingSources).length,
        connected: connectedSources
      },
      hdmiMatrix: {
        inputs: this.hdmiMatrix.inputs.length,
        outputs: this.hdmiMatrix.outputs.length,
        activeOutputs: this.hdmiMatrix.outputs.filter(o => o.power).length
      },
      projector: {
        power: this.projector.power,
        lampHoursUsed: Math.round(this.projector.lampHours),
        lampHoursRemaining: Math.round(this.projector.lampLifeMax - this.projector.lampHours),
        lampPercentUsed: Math.round((this.projector.lampHours / this.projector.lampLifeMax) * 100)
      },
      cinemaPresets: {
        total: Object.keys(this.cinemaPresets).length,
        activePreset: this.activePreset,
        timesActivated: this.statistics.presetsActivated
      },
      partyMode: {
        active: this.partyMode.active,
        activations: this.statistics.partyModeActivations
      },
      energy: {
        totalKwh: this.statistics.energyTotalKwh,
        dailyKwh: Math.round(this.energyMonitoring.totalDailyKwh * 1000) / 1000,
        monthlyKwh: Math.round(this.energyMonitoring.totalMonthlyKwh * 1000) / 1000
      },
      announcements: {
        sent: this.statistics.announcementsSent,
        queued: this.announcements.queue.length
      },
      calibrations: this.statistics.calibrationsRun,
      powerCycles: this.statistics.powerCycles,
      errorsDetected: this.statistics.errorsDetected,
      backgroundMusic: {
        enabled: this.backgroundMusic.enabled,
        activeSlot: this.backgroundMusic.activeSlot,
        currentPlaylist: this.backgroundMusic.currentPlaylist
      }
    };
  }

  _formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts = [];
    if (days > 0) parts.push(days + 'd');
    if (hours > 0) parts.push(hours + 'h');
    if (mins > 0) parts.push(mins + 'm');
    parts.push(secs + 's');

    return parts.join(' ');
  }

  // ─── Logging ──────────────────────────────────────────────────────

  log(msg) {
    if (this.homey && typeof this.homey.log === 'function') {
      this.homey.log('[AV]', msg);
    } else {
      console.log('[AV]', msg);
    }
  }

  error(msg) {
    if (this.homey && typeof this.homey.error === 'function') {
      this.homey.error('[AV]', msg);
    } else {
      console.error('[AV]', msg);
    }
  }

  // ─── Cleanup ──────────────────────────────────────────────────────

  destroy() {
    this.log('Shutting down AV Automation system...');

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.backgroundMusicInterval) {
      clearInterval(this.backgroundMusicInterval);
      this.backgroundMusicInterval = null;
    }

    if (this.smartVolumeInterval) {
      clearInterval(this.smartVolumeInterval);
      this.smartVolumeInterval = null;
    }

    if (this.energyInterval) {
      clearInterval(this.energyInterval);
      this.energyInterval = null;
    }

    // Clear power sequence timers
    if (this.powerSequence && this.powerSequence.sequenceTimers) {
      for (const timer of this.powerSequence.sequenceTimers) {
        clearTimeout(timer);
      }
      this.powerSequence.sequenceTimers = [];
    }

    // Clear projector no-signal timer
    if (this.projector && this.projector.noSignalTimer) {
      clearTimeout(this.projector.noSignalTimer);
      this.projector.noSignalTimer = null;
    }

    this.log('AV Automation system destroyed');
  }
}

module.exports = AdvancedAVAutomation;
