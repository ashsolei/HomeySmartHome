'use strict';
const EventEmitter = require('events');

class AdvancedSleepEnvironmentSystem extends EventEmitter {
  constructor(homey) {
    super();
    this.homey = homey;
    this.initialized = false;
    this.intervals = [];
    this._initState();
  }

  _initState() {
    const mkZone = (id, name, type, mattress) => ({
      id, name, bedType: type, smartMattress: mattress,
      bedSensors: type === 'double' ? { left: false, right: false, pressure: 0 } : { center: false, pressure: 0 },
      blackoutBlinds: 0, windowOpen: false, doorOpen: false,
      temperature: 20.0, targetTemperature: 17.0, humidity: 50, co2: 450,
      lightLevel: 0, soundLevel: 0, vocLevel: 0, pollenLevel: 0, occupants: [],
      heatedBlanket: type === 'double'
        ? { left: { enabled: false, temp: 22, autoOff: true }, right: { enabled: false, temp: 22, autoOff: true } }
        : { center: { enabled: false, temp: 22, autoOff: true } },
      coolingPad: type === 'double' ? { left: false, right: false } : { center: false }
    });
    this.sleepZones = {
      'master-bedroom': mkZone('master-bedroom', 'Master Bedroom', 'double', true),
      'bedroom-2': mkZone('bedroom-2', 'Bedroom 2', 'single', false),
      'guest-room': mkZone('guest-room', 'Guest Room', 'double', false)
    };
    this.soundTypes = {
      'white-noise': { name: 'White Noise', frequency: 'all-equal', maskingPower: 0.9, category: 'noise', loopable: true },
      'pink-noise': { name: 'Pink Noise', frequency: 'low-emphasis', maskingPower: 0.85, category: 'noise', loopable: true },
      'brown-noise': { name: 'Brown Noise', frequency: 'deep-low', maskingPower: 0.8, category: 'noise', loopable: true },
      'rain': { name: 'Rain', frequency: 'natural-variable', maskingPower: 0.75, category: 'nature', loopable: true },
      'ocean': { name: 'Ocean Waves', frequency: 'rhythmic-wash', maskingPower: 0.7, category: 'nature', loopable: true },
      'forest': { name: 'Forest Ambience', frequency: 'natural-sparse', maskingPower: 0.6, category: 'nature', loopable: true },
      'wind': { name: 'Wind', frequency: 'variable-whoosh', maskingPower: 0.65, category: 'nature', loopable: true },
      'thunder': { name: 'Distant Thunder', frequency: 'low-rumble', maskingPower: 0.7, category: 'nature', loopable: true },
      'heartbeat': { name: 'Heartbeat', frequency: 'rhythmic-low', maskingPower: 0.5, category: 'biological', loopable: true },
      'fan': { name: 'Fan', frequency: 'steady-mechanical', maskingPower: 0.8, category: 'mechanical', loopable: true }
    };
    // Sound volume reduction schedule (gradual fade during sleep)
    this.soundReductionConfig = {
      enabled: true,
      startAfterMinutes: 30,
      reductionPercent: 5,
      intervalMinutes: 15,
      minimumVolume: 5
    };
    this.activeSounds = {};
    this.sleepPhases = ['awake', 'light-sleep', 'deep-sleep', 'REM'];
    this.cycleDurationMinutes = 90;
    this.userProfiles = {};
    this.maxProfiles = 4;
    this.activeSessions = {};
    this.hygieneTracking = {};
    this.napTracking = {};
    this.monthlyReports = {};
    this.sessionLogs = [];
    this.alarms = {};
    this.snoringState = {};
    this.preSleepRoutines = {};
    this.sleepDebtData = {};
    this.seasonalConfig = {
      latitude: 59.33, sadTherapyEnabled: false, sadLightIntensity: 10000,
      sadSessionMinutes: 30, midnightSunBlocking: true, winterDarkCompensation: true,
      currentSeason: 'winter'
    };
    this.airQuality = {
      co2Max: 800, humidityMin: 40, humidityMax: 60, vocMax: 500,
      pollenAlertLevel: 3, hepaFilterHours: 0, hepaFilterMaxHours: 2000,
      ventilationSchedule: []
    };
    this.tempProfiles = {
      preBed: { startOffset: -60, startTemp: 22, endTemp: 18, curve: 'gradual' },
      sleep: { targetMin: 16, targetMax: 18, footWarming: true, footWarmTemp: 24 },
      wake: { warmingOffset: -15, targetTemp: 20 }
    };
    this.lightConfig = {
      blueLightStart: 120, sunriseDuration: 30, moonlightBrightness: 2,
      moonlightColor: '#1a1a3e', circadianEnabled: true
    };
  }

  async initialize() {
    try {
      this.homey.log('[SleepEnvironment] Initializing...');
      this._initProfiles();
      this._initZoneSensors();
      this._startPhaseMonitor();
      this._startAirMonitor();
      this._startTempControl();
      this._startOccupancy();
      this._startNapDetection();
      this._startSnoringDetection();
      this._startSeasonalAdj();
      this._startPreSleepChecker();
      this._startDebtCalc();
      this._startBeddingSafety();
      this.initialized = true;
      this.homey.log('[SleepEnvironment] System initialized');
      this.homey.emit('sleep-environment-initialized', { zones: Object.keys(this.sleepZones).length });
    } catch (error) {
      this.homey.error('[SleepEnvironment] Init failed:', error.message);
      throw error;
    }
  }

  _initProfiles() {
    const defs = [
      { id: 'user-1', name: 'Primary User', zone: 'master-bedroom', side: 'left', chrono: 'intermediate', target: 8, temp: 17, sound: 'rain', vol: 30 },
      { id: 'user-2', name: 'Partner', zone: 'master-bedroom', side: 'right', chrono: 'evening', target: 7.5, temp: 18, sound: 'white-noise', vol: 25 },
      { id: 'user-3', name: 'Child', zone: 'bedroom-2', side: 'center', chrono: 'morning', target: 9, temp: 18, sound: 'ocean', vol: 20 },
      { id: 'user-4', name: 'Guest', zone: 'guest-room', side: 'left', chrono: 'intermediate', target: 8, temp: 18, sound: 'forest', vol: 20 }
    ];
    for (const d of defs) {
      const bed = d.chrono === 'morning' ? '21:30' : d.chrono === 'evening' ? '23:30' : '22:30';
      const wake = d.chrono === 'morning' ? '06:00' : d.chrono === 'evening' ? '08:00' : '07:00';
      this.userProfiles[d.id] = {
        id: d.id, name: d.name, zone: d.zone, side: d.side, chronotype: d.chrono,
        targetHours: d.target, preferredTemp: d.temp, preferredSound: d.sound, preferredVolume: d.vol,
        sleepDebt: 0, weeklyAverages: { duration: 0, efficiency: 0, score: 0 },
        monthlyTrends: [], sleepScore: 75, bedtime: bed, wakeTime: wake,
        totalSessionsLogged: 0, lastSleepDate: null
      };
      this.hygieneTracking[d.id] = {
        caffeine: { lastIntake: null, dailyCount: 0, cutoffHour: 14 },
        screenTime: { lastUsage: null, eveningMinutes: 0 },
        exercise: { lastSession: null, intensity: 'none', timingOk: true },
        alcohol: { lastIntake: null, units: 0 },
        mealTiming: { lastMeal: null, tooCloseToSleep: false },
        phonePresence: { inBedroom: false, onSilent: false },
        stress: { level: 0, breathingExerciseDone: false }
      };
      this.sleepDebtData[d.id] = { optimal: d.target, actualWeekly: [], weeklyDeficit: 0, recoveryPlan: null };
    }
    this.homey.log('[SleepEnvironment] User profiles initialized');
  }

  _initZoneSensors() {
    for (const zoneId of Object.keys(this.sleepZones)) {
      this.activeSounds[zoneId] = { playing: false, type: null, volume: 0, fadingOut: false };
      this.snoringState[zoneId] = { detected: false, intensity: 0, interventionActive: false, occurrences: 0 };
      this.preSleepRoutines[zoneId] = { active: false, startedAt: null, stepsCompleted: [] };
    }
  }

  _addInterval(fn, ms) {
    const id = setInterval(fn, ms);
    this.intervals.push(id);
    return id;
  }

  _startPhaseMonitor() {
    this._addInterval(() => {
      try {
        for (const [sid, s] of Object.entries(this.activeSessions)) {
          if (!s.active) continue;
          this._updatePhase(sid, s);
          this._updateEfficiency(sid, s);
          this._checkSmartWake(sid, s);
        }
      } catch (e) { this.homey.error('[SleepEnvironment] Phase monitor error:', e.message); }
    }, 60000);
    this.homey.log('[SleepEnvironment] Phase monitoring started');
  }

  _updatePhase(sid, session) {
    const now = Date.now();
    const elapsed = (now - session.startTime) / 60000;
    const lat = session.latency || 15;
    if (elapsed < lat) { session.currentPhase = 'awake'; return; }
    const sleepEl = elapsed - lat;
    const pos = sleepEl % this.cycleDurationMinutes;
    const cycle = Math.floor(sleepEl / this.cycleDurationMinutes) + 1;
    if (pos < 20) session.currentPhase = 'light-sleep';
    else if (pos < 50) session.currentPhase = 'deep-sleep';
    else if (pos < 75) session.currentPhase = 'REM';
    else session.currentPhase = 'light-sleep';
    session.currentCycle = cycle;
    session.phaseHistory.push({ phase: session.currentPhase, timestamp: now, cycle });
    if (session.currentPhase !== session.previousPhase) {
      this.homey.emit('sleep-phase-changed', { sessionId: sid, userId: session.userId, zone: session.zoneId, phase: session.currentPhase, cycle });
      session.previousPhase = session.currentPhase;
    }
  }

  _updateEfficiency(sid, session) {
    const total = (Date.now() - session.startTime) / 60000;
    if (total <= 0) return;
    const awake = session.phaseHistory.filter(p => p.phase === 'awake').length;
    const sleep = total - awake - (session.latency || 15);
    session.efficiency = Math.max(0, Math.min(100, Math.round((sleep / total) * 100)));
    session.totalSleepMinutes = Math.max(0, sleep);
    session.wakeUps = session.wakeUpEvents ? session.wakeUpEvents.length : 0;
  }

  _checkSmartWake(sid, session) {
    const alarm = this.alarms[session.userId];
    if (!alarm || !alarm.enabled) return;
    const now = new Date();
    const at = this._parseTime(alarm.time);
    const ws = new Date(at.getTime() - 30 * 60000);
    if (now >= ws && now <= at && session.currentPhase === 'light-sleep' && !session.smartWakeTriggered) {
      session.smartWakeTriggered = true;
      this.homey.log(`[SleepEnvironment] Smart wake for ${session.userId} in light sleep`);
      this._triggerSmartWake(sid, session);
    }
  }

  _triggerSmartWake(sid, session) {
    const zone = this.sleepZones[session.zoneId];
    if (!zone) return;
    const alarm = this.alarms[session.userId];
    this._startSunrise(session.zoneId, this.lightConfig.sunriseDuration);
    zone.targetTemperature = this.tempProfiles.wake.targetTemp;
    if (alarm && alarm.soundWake) this._setZoneSound(session.zoneId, alarm.wakeSound || 'forest', 10);
    if (zone.smartMattress && alarm && alarm.vibrationWake) {
      this.homey.log(`[SleepEnvironment] Vibration wake in ${session.zoneId}`);
    }
    const methods = ['light', 'temperature'];
    if (alarm.soundWake) methods.push('sound');
    if (alarm.vibrationWake) methods.push('vibration');
    this.homey.emit('smart-wake-triggered', { sessionId: sid, userId: session.userId, zone: session.zoneId, phase: session.currentPhase, methods });
  }

  _startSunrise(zoneId, dur) {
    const zone = this.sleepZones[zoneId];
    if (!zone) return;
    const steps = dur * 2;
    let step = 0;
    const iv = setInterval(() => {
      step++;
      const p = step / steps;
      zone.lightLevel = Math.round(p * 100);
      zone.blackoutBlinds = Math.round(p * 60);
      this.homey.emit('sunrise-progress', { zoneId, brightness: zone.lightLevel, progress: Math.round(p * 100) });
      if (step >= steps) {
        clearInterval(iv);
        this.intervals.splice(this.intervals.indexOf(iv), 1);
        this.homey.log(`[SleepEnvironment] Sunrise complete in ${zoneId}`);
      }
    }, (dur * 60000) / steps);
    this.intervals.push(iv);
    this.homey.log(`[SleepEnvironment] Sunrise started in ${zoneId} (${dur}min)`);
  }

  _startAirMonitor() {
    this._addInterval(() => {
      try {
        for (const [zid, z] of Object.entries(this.sleepZones)) {
          if (z.co2 > this.airQuality.co2Max) {
            this.homey.log(`[SleepEnvironment] CO2 high in ${zid}: ${z.co2}ppm`);
            this.homey.emit('air-quality-alert', { zoneId: zid, type: 'co2', value: z.co2, threshold: this.airQuality.co2Max });
          }
          if (z.humidity < this.airQuality.humidityMin || z.humidity > this.airQuality.humidityMax) {
            this.homey.emit('air-quality-alert', { zoneId: zid, type: 'humidity', value: z.humidity, status: z.humidity < this.airQuality.humidityMin ? 'too-low' : 'too-high' });
          }
          if ((z.vocLevel || 0) > this.airQuality.vocMax) {
            this.homey.emit('air-quality-alert', { zoneId: zid, type: 'voc', value: z.vocLevel });
          }
          if ((z.pollenLevel || 0) >= this.airQuality.pollenAlertLevel && z.windowOpen) {
            this.homey.emit('pollen-window-alert', { zoneId: zid, pollenLevel: z.pollenLevel });
          }
          this.airQuality.hepaFilterHours += 1 / 30;
          if (this.airQuality.hepaFilterHours >= this.airQuality.hepaFilterMaxHours * 0.9) {
            this.homey.emit('hepa-filter-warning', { zoneId: zid, hoursUsed: Math.round(this.airQuality.hepaFilterHours) });
          }
        }
      } catch (e) { this.homey.error('[SleepEnvironment] Air monitor error:', e.message); }
    }, 120000);
    this.homey.log('[SleepEnvironment] Air quality monitoring started');
  }

  _startTempControl() {
    this._addInterval(() => {
      try {
        for (const [zid, z] of Object.entries(this.sleepZones)) {
          const diff = z.temperature - z.targetTemperature;
          if (Math.abs(diff) > 0.5) {
            this.homey.emit('temperature-adjustment', { zoneId: zid, current: z.temperature, target: z.targetTemperature, action: diff > 0 ? 'cooling' : 'heating' });
          }
          // Foot warming during sleep
          if (this.tempProfiles.sleep.footWarming) {
            const sess = Object.values(this.activeSessions).find(s => s.zoneId === zid && s.active);
            if (sess && (sess.currentPhase === 'light-sleep' || sess.currentPhase === 'deep-sleep')) {
              this.homey.emit('foot-warming-active', { zoneId: zid, temperature: this.tempProfiles.sleep.footWarmTemp });
            }
          }
          // Pre-bed cooling curve
          const users = Object.values(this.userProfiles).filter(u => u.zone === zid);
          for (const u of users) {
            const bt = this._parseTime(u.bedtime);
            const now = new Date();
            const cs = new Date(bt.getTime() + this.tempProfiles.preBed.startOffset * 60000);
            if (now >= cs && now <= bt) {
              const p = (now.getTime() - cs.getTime()) / (bt.getTime() - cs.getTime());
              z.targetTemperature = Math.round((this.tempProfiles.preBed.startTemp - (this.tempProfiles.preBed.startTemp - this.tempProfiles.preBed.endTemp) * p) * 10) / 10;
            }
          }
        }
      } catch (e) { this.homey.error('[SleepEnvironment] Temp control error:', e.message); }
    }, 90000);
    this.homey.log('[SleepEnvironment] Temperature control started');
  }

  _startOccupancy() {
    this._addInterval(() => {
      try {
        for (const [zid, z] of Object.entries(this.sleepZones)) {
          const prev = [...z.occupants];
          z.occupants = [];
          if (z.bedType === 'double') {
            if (z.bedSensors.left) z.occupants.push('left');
            if (z.bedSensors.right) z.occupants.push('right');
          } else {
            if (z.bedSensors.center) z.occupants.push('center');
          }
          const pet = z.bedSensors.pressure > 0 && z.bedSensors.pressure < 15;
          if (pet) z.occupants.push('pet');
          if (JSON.stringify(prev) !== JSON.stringify(z.occupants)) {
            this.homey.emit('bed-occupancy-changed', { zoneId: zid, occupants: z.occupants, petDetected: pet, pressure: z.bedSensors.pressure });
            if (z.occupants.length > prev.length && !z.occupants.includes('pet')) {
              this.homey.log(`[SleepEnvironment] Bed entry in ${zid}`);
              const users = Object.values(this.userProfiles).filter(u => u.zone === zid);
              for (const u of users) { if (!this.activeSessions[u.id]) this._beginSession(u.id, zid); }
            }
            if (z.occupants.length < prev.length) {
              this.homey.log(`[SleepEnvironment] Bed exit in ${zid}`);
              const sess = Object.entries(this.activeSessions).filter(([_, s]) => s.zoneId === zid && s.active);
              for (const [, s] of sess) { if (s.wakeUpEvents) s.wakeUpEvents.push({ timestamp: Date.now() }); }
            }
          }
        }
      } catch (e) { this.homey.error('[SleepEnvironment] Occupancy error:', e.message); }
    }, 30000);
    this.homey.log('[SleepEnvironment] Occupancy detection started');
  }

  _startNapDetection() {
    this._addInterval(() => {
      try {
        const h = new Date().getHours();
        if (h < 12 || h > 16) return;
        for (const [zid, z] of Object.entries(this.sleepZones)) {
          if (z.occupants.length === 0) continue;
          const users = Object.values(this.userProfiles).filter(u => u.zone === zid);
          for (const u of users) {
            if (!this.napTracking[u.id]) {
              this.napTracking[u.id] = { active: false, startTime: null, duration: 0, maxDuration: 20, history: [] };
            }
            const nap = this.napTracking[u.id];
            if (!nap.active) {
              nap.active = true;
              nap.startTime = Date.now();
              this.homey.log(`[SleepEnvironment] Nap detected for ${u.name}`);
              this.homey.emit('nap-started', { userId: u.id, zone: zid });
            } else {
              nap.duration = (Date.now() - nap.startTime) / 60000;
              if (nap.duration >= nap.maxDuration) {
                this.homey.emit('nap-limit-reached', { userId: u.id, duration: nap.duration });
                nap.active = false;
                nap.history.push({ date: new Date().toISOString(), duration: nap.duration, impact: nap.duration > 30 ? 'negative' : 'neutral' });
                nap.startTime = null;
                nap.duration = 0;
              }
            }
          }
        }
      } catch (e) { this.homey.error('[SleepEnvironment] Nap detection error:', e.message); }
    }, 60000);
    this.homey.log('[SleepEnvironment] Nap detection started');
  }

  _startSnoringDetection() {
    this._addInterval(() => {
      try {
        for (const [zid, sn] of Object.entries(this.snoringState)) {
          if (!sn.detected || sn.interventionActive) continue;
          sn.occurrences++;
          sn.interventionActive = true;
          const z = this.sleepZones[zid];
          if (z && z.smartMattress) {
            this.homey.log(`[SleepEnvironment] Snoring intervention ${zid}: mattress elevation`);
            this.homey.emit('snoring-intervention', { zoneId: zid, action: 'mattress-elevation', intensity: sn.intensity });
          }
          if (sn.intensity > 5) {
            const partners = Object.values(this.activeSessions).filter(s => s.zoneId === zid && s.active);
            if (partners.length > 1) {
              this._setZoneSound(zid, 'white-noise', 20);
              this.homey.log(`[SleepEnvironment] Noise masking for partner in ${zid}`);
            }
          }
          setTimeout(() => { sn.interventionActive = false; }, 300000);
        }
      } catch (e) { this.homey.error('[SleepEnvironment] Snoring detection error:', e.message); }
    }, 45000);
    this.homey.log('[SleepEnvironment] Snoring detection started');
  }

  _startSeasonalAdj() {
    this._addInterval(() => {
      try {
        const m = new Date().getMonth();
        this.seasonalConfig.currentSeason = m >= 10 || m <= 1 ? 'winter' : m <= 4 ? 'spring' : m <= 7 ? 'summer' : 'autumn';
        if (this.seasonalConfig.currentSeason === 'winter' && this.seasonalConfig.sadTherapyEnabled) {
          this.homey.log('[SleepEnvironment] SAD therapy session recommended');
          this.homey.emit('sad-therapy-scheduled', { intensity: this.seasonalConfig.sadLightIntensity, durationMinutes: this.seasonalConfig.sadSessionMinutes });
        }
        if (this.seasonalConfig.currentSeason === 'summer' && this.seasonalConfig.midnightSunBlocking) {
          const h = new Date().getHours();
          if (h >= 22 || h <= 4) {
            for (const [zid, z] of Object.entries(this.sleepZones)) {
              if (z.blackoutBlinds < 100) {
                z.blackoutBlinds = 100;
                this.homey.log(`[SleepEnvironment] Midnight sun blocking ${zid}: blinds 100%`);
                this.homey.emit('midnight-sun-blocked', { zoneId: zid });
              }
            }
          }
        }
      } catch (e) { this.homey.error('[SleepEnvironment] Seasonal adj error:', e.message); }
    }, 3600000);
    this.homey.log('[SleepEnvironment] Seasonal adjustment started');
  }

  _startPreSleepChecker() {
    this._addInterval(() => {
      try {
        const now = new Date();
        for (const [uid, p] of Object.entries(this.userProfiles)) {
          const bt = this._parseTime(p.bedtime);
          const rs = new Date(bt.getTime() - 60 * 60000);
          if (now >= rs && now <= bt && !this.preSleepRoutines[p.zone]?.active) {
            this._triggerPreSleep(uid, p);
          }
        }
      } catch (e) { this.homey.error('[SleepEnvironment] Pre-sleep check error:', e.message); }
    }, 300000);
    this.homey.log('[SleepEnvironment] Pre-sleep routine checker started');
  }

  _triggerPreSleep(uid, profile) {
    const r = this.preSleepRoutines[profile.zone];
    if (!r) return;
    r.active = true;
    r.startedAt = Date.now();
    r.stepsCompleted = [];
    const steps = [
      { name: 'blue-light-reduction', fn: () => this.homey.emit('blue-light-reduction', { zoneId: profile.zone, colorTemp: 2200 }) },
      { name: 'temperature-adjustment', fn: () => { const z = this.sleepZones[profile.zone]; if (z) z.targetTemperature = this.tempProfiles.preBed.endTemp; } },
      { name: 'ambient-sound', fn: () => this._setZoneSound(profile.zone, profile.preferredSound, Math.max(10, profile.preferredVolume - 10)) },
      { name: 'blackout-blinds', fn: () => { const z = this.sleepZones[profile.zone]; if (z) z.blackoutBlinds = 60; this.homey.emit('blinds-adjusted', { zoneId: profile.zone, level: 60 }); } },
      { name: 'smart-bedding', fn: () => { const z = this.sleepZones[profile.zone]; if (z && z.heatedBlanket[profile.side]) { z.heatedBlanket[profile.side].enabled = true; z.heatedBlanket[profile.side].temp = profile.preferredTemp || 22; } } },
      { name: 'hygiene-reminder', fn: () => this._sendHygieneReminder(uid) }
    ];
    for (const s of steps) {
      try { s.fn(); r.stepsCompleted.push(s.name); } catch (err) { this.homey.error(`[SleepEnvironment] Pre-sleep step ${s.name} failed:`, err.message); }
    }
    this.homey.log(`[SleepEnvironment] Pre-sleep routine for ${profile.name} in ${profile.zone}`);
    this.homey.emit('pre-sleep-routine-started', { userId: uid, zone: profile.zone, stepsCompleted: r.stepsCompleted });
  }

  _sendHygieneReminder(uid) {
    const h = this.hygieneTracking[uid];
    if (!h) return;
    const warns = [];
    if (h.caffeine.dailyCount > 0 && new Date().getHours() >= h.caffeine.cutoffHour) warns.push('Late caffeine intake');
    if (h.screenTime.eveningMinutes > 60) warns.push('High evening screen time');
    if (h.mealTiming.tooCloseToSleep) warns.push('Meal too close to bedtime');
    if (h.phonePresence.inBedroom && !h.phonePresence.onSilent) warns.push('Phone not on silent');
    if (h.alcohol.units > 0) warns.push('Alcohol may affect sleep');
    if (h.stress.level > 7) warns.push('High stress - try breathing exercises');
    if (warns.length > 0) this.homey.emit('hygiene-reminder', { userId: uid, warnings: warns });
  }

  _startDebtCalc() {
    this._addInterval(() => {
      try {
        for (const [uid, p] of Object.entries(this.userProfiles)) {
          const d = this.sleepDebtData[uid];
          if (!d) continue;
          const optW = d.optimal * 7;
          const actW = d.actualWeekly.reduce((s, h) => s + h, 0);
          d.weeklyDeficit = Math.max(0, optW - actW);
          p.sleepDebt = d.weeklyDeficit;
          if (d.weeklyDeficit > 5) {
            d.recoveryPlan = {
              deficit: Math.round(d.weeklyDeficit * 10) / 10, strategy: 'gradual', extraPerNight: 1,
              daysToRecover: Math.ceil(d.weeklyDeficit),
              recommendations: ['Go to bed 30min earlier', 'No caffeine after noon', 'Consider 20min nap', 'Consistent wake time']
            };
            this.homey.emit('sleep-debt-alert', { userId: uid, deficit: d.weeklyDeficit, plan: d.recoveryPlan });
          }
        }
      } catch (e) { this.homey.error('[SleepEnvironment] Debt calc error:', e.message); }
    }, 3600000);
    this.homey.log('[SleepEnvironment] Sleep debt calculator started');
  }

  _startBeddingSafety() {
    this._addInterval(() => {
      try {
        for (const [zid, z] of Object.entries(this.sleepZones)) {
          for (const [side, bl] of Object.entries(z.heatedBlanket)) {
            if (!bl.enabled || !bl.autoOff) continue;
            const sess = Object.values(this.activeSessions).find(s => s.zoneId === zid && s.active);
            if (!sess) {
              bl.enabled = false;
              this.homey.log(`[SleepEnvironment] Auto-off: blanket ${side} in ${zid}`);
              this.homey.emit('bedding-auto-off', { zoneId: zid, side, reason: 'no-session' });
            }
            if (bl.temp > 30) {
              bl.temp = 25;
              this.homey.emit('bedding-safety-limit', { zoneId: zid, side, cappedTemp: 25 });
            }
          }
        }
      } catch (e) { this.homey.error('[SleepEnvironment] Bedding safety error:', e.message); }
    }, 180000);
    this.homey.log('[SleepEnvironment] Bedding safety monitor started');
  }

  // === Session Management ===

  async startSleepSession(userId, zoneId) {
    if (!this.userProfiles[userId]) { this.homey.error(`[SleepEnvironment] Unknown user: ${userId}`); return null; }
    if (!this.sleepZones[zoneId]) { this.homey.error(`[SleepEnvironment] Unknown zone: ${zoneId}`); return null; }
    return this._beginSession(userId, zoneId);
  }

  _beginSession(userId, zoneId) {
    const p = this.userProfiles[userId];
    const sid = `${userId}-${Date.now()}`;
    this.activeSessions[sid] = {
      sessionId: sid, userId, zoneId, active: true, startTime: Date.now(), endTime: null,
      currentPhase: 'awake', previousPhase: null, currentCycle: 0, latency: 15,
      efficiency: 0, totalSleepMinutes: 0, wakeUps: 0, wakeUpEvents: [], phaseHistory: [],
      smartWakeTriggered: false, sleepScore: 0, soundPlayed: null,
      metrics: { avgHeartRate: 0, avgBreathRate: 0, movementCount: 0, snoringMinutes: 0 }
    };
    const z = this.sleepZones[zoneId];
    if (z) { z.blackoutBlinds = 100; z.lightLevel = this.lightConfig.moonlightBrightness; }
    if (p.preferredSound) {
      this._setZoneSound(zoneId, p.preferredSound, p.preferredVolume || 25);
      this.activeSessions[sid].soundPlayed = p.preferredSound;
    }
    this.homey.log(`[SleepEnvironment] Session started: ${sid} (${p.name} in ${zoneId})`);
    this.homey.emit('sleep-session-started', { sessionId: sid, userId, zone: zoneId });
    return sid;
  }

  async endSleepSession(sessionId) {
    const s = this.activeSessions[sessionId];
    if (!s || !s.active) { this.homey.error(`[SleepEnvironment] No active session: ${sessionId}`); return null; }
    s.active = false;
    s.endTime = Date.now();
    s.totalSleepMinutes = Math.round((s.endTime - s.startTime) / 60000);
    s.sleepScore = this._calcScore(s);
    const p = this.userProfiles[s.userId];
    if (p) {
      p.totalSessionsLogged++;
      p.lastSleepDate = new Date().toISOString().split('T')[0];
      p.sleepScore = s.sleepScore;
      const d = this.sleepDebtData[s.userId];
      if (d) { d.actualWeekly.push(s.totalSleepMinutes / 60); if (d.actualWeekly.length > 7) d.actualWeekly.shift(); }
      this._updateWeeklyAvg(s.userId);
    }
    this._logSession(s);
    this._resetZone(s.zoneId);
    this._fadeOutSound(s.zoneId);
    this.homey.log(`[SleepEnvironment] Session ended: ${sessionId}, score: ${s.sleepScore}`);
    this.homey.emit('sleep-session-ended', { sessionId, userId: s.userId, zone: s.zoneId, duration: s.totalSleepMinutes, score: s.sleepScore, efficiency: s.efficiency, cycles: s.currentCycle, wakeUps: s.wakeUps });
    return s;
  }

  _calcScore(s) {
    let score = 50;
    const hrs = s.totalSleepMinutes / 60;
    const p = this.userProfiles[s.userId];
    const target = p ? p.targetHours : 8;
    const ratio = Math.min(hrs / target, 1.2);
    score += ratio >= 0.9 && ratio <= 1.1 ? 25 : ratio >= 0.75 ? 15 : Math.round(ratio * 10);
    score += s.efficiency >= 85 ? 20 : s.efficiency >= 75 ? 15 : s.efficiency >= 60 ? 10 : 5;
    score -= Math.min(s.wakeUps * 5, 15);
    score += s.currentCycle >= 4 ? 10 : s.currentCycle >= 3 ? 7 : 3;
    if (s.latency > 30) score -= 5;
    const h = this.hygieneTracking[s.userId];
    if (h) {
      if (h.caffeine.dailyCount === 0) score += 2;
      if (h.screenTime.eveningMinutes < 30) score += 2;
      if (h.stress.breathingExerciseDone) score += 1;
    }
    return Math.max(0, Math.min(100, score));
  }

  _updateWeeklyAvg(uid) {
    const p = this.userProfiles[uid];
    if (!p) return;
    const recent = this.sessionLogs.filter(s => s.userId === uid).slice(-7);
    if (recent.length === 0) return;
    p.weeklyAverages = {
      duration: Math.round(recent.reduce((a, s) => a + s.duration, 0) / recent.length),
      efficiency: Math.round(recent.reduce((a, s) => a + s.efficiency, 0) / recent.length),
      score: Math.round(recent.reduce((a, s) => a + s.sleepScore, 0) / recent.length)
    };
  }

  _logSession(s) {
    const entry = {
      sessionId: s.sessionId, userId: s.userId, zoneId: s.zoneId,
      date: new Date(s.startTime).toISOString().split('T')[0],
      startTime: new Date(s.startTime).toISOString(), endTime: new Date(s.endTime).toISOString(),
      duration: s.totalSleepMinutes, efficiency: s.efficiency, sleepScore: s.sleepScore,
      cycles: s.currentCycle, wakeUps: s.wakeUps, latency: s.latency,
      phases: {
        awake: s.phaseHistory.filter(p => p.phase === 'awake').length,
        lightSleep: s.phaseHistory.filter(p => p.phase === 'light-sleep').length,
        deepSleep: s.phaseHistory.filter(p => p.phase === 'deep-sleep').length,
        rem: s.phaseHistory.filter(p => p.phase === 'REM').length
      },
      soundUsed: s.soundPlayed, metrics: s.metrics,
      hygiene: this.hygieneTracking[s.userId] ? { ...this.hygieneTracking[s.userId] } : null
    };
    this.sessionLogs.push(entry);
    if (this.sessionLogs.length > 365) this.sessionLogs = this.sessionLogs.slice(-365);
    this.homey.log(`[SleepEnvironment] Session logged: ${entry.sessionId}`);
  }

  _resetZone(zoneId) {
    const z = this.sleepZones[zoneId];
    if (!z) return;
    z.blackoutBlinds = 30;
    z.lightLevel = 50;
    for (const bl of Object.values(z.heatedBlanket)) bl.enabled = false;
    for (const k of Object.keys(z.coolingPad)) z.coolingPad[k] = false;
  }

  _setZoneSound(zoneId, type, vol) {
    const s = this.activeSounds[zoneId];
    if (!s) return;
    s.playing = true;
    s.type = type;
    s.volume = Math.max(0, Math.min(100, vol));
    s.fadingOut = false;
  }

  _fadeOutSound(zoneId) {
    const s = this.activeSounds[zoneId];
    if (!s || !s.playing) return;
    s.fadingOut = true;
    let vol = s.volume;
    const iv = setInterval(() => {
      vol -= 2;
      if (vol <= 0) { s.playing = false; s.volume = 0; s.type = null; s.fadingOut = false; clearInterval(iv); this.intervals.splice(this.intervals.indexOf(iv), 1); }
      else s.volume = vol;
    }, 3000);
    this.intervals.push(iv);
  }

  // === Alarm Management ===

  setAlarm(userId, cfg) {
    if (!this.userProfiles[userId]) { this.homey.error(`[SleepEnvironment] Unknown user for alarm: ${userId}`); return false; }
    this.alarms[userId] = {
      enabled: true, time: cfg.time || '07:00', workdayOnly: cfg.workdayOnly || false,
      weekendTime: cfg.weekendTime || null, smartWakeWindow: cfg.smartWakeWindow ?? 30,
      soundWake: cfg.soundWake ?? true, wakeSound: cfg.wakeSound || 'forest',
      lightWake: cfg.lightWake ?? true, temperatureWake: cfg.temperatureWake ?? true,
      vibrationWake: cfg.vibrationWake || false,
      snoozeCount: 0, snoozeMax: 2, snoozeDuration: 9, lastTriggered: null
    };
    this.homey.log(`[SleepEnvironment] Alarm set for ${userId}: ${cfg.time}`);
    this.homey.emit('alarm-configured', { userId, time: cfg.time });
    return true;
  }

  snoozeAlarm(userId) {
    const a = this.alarms[userId];
    if (!a || !a.enabled) return false;
    if (a.snoozeCount >= a.snoozeMax) {
      this.homey.log(`[SleepEnvironment] Max snoozes reached for ${userId}`);
      this.homey.emit('snooze-limit-reached', { userId, max: a.snoozeMax });
      return false;
    }
    a.snoozeCount++;
    this.homey.log(`[SleepEnvironment] Alarm snoozed for ${userId} (${a.snoozeCount}/${a.snoozeMax})`);
    this.homey.emit('alarm-snoozed', { userId, count: a.snoozeCount });
    return true;
  }

  getAlarmForToday(userId) {
    const a = this.alarms[userId];
    if (!a || !a.enabled) return null;
    const d = new Date().getDay();
    const weekend = d === 0 || d === 6;
    if (a.workdayOnly && weekend) return a.weekendTime ? { ...a, time: a.weekendTime } : null;
    return a;
  }

  dismissAlarm(userId) {
    const a = this.alarms[userId];
    if (!a) return false;
    a.snoozeCount = 0;
    a.lastTriggered = new Date().toISOString();
    this.homey.log(`[SleepEnvironment] Alarm dismissed for ${userId}`);
    this.homey.emit('alarm-dismissed', { userId, time: new Date().toISOString() });
    // End any active sessions for this user
    for (const [sid, s] of Object.entries(this.activeSessions)) {
      if (s.userId === userId && s.active) {
        this.endSleepSession(sid);
      }
    }
    return true;
  }

  resetAlarmSnooze(userId) {
    const a = this.alarms[userId];
    if (!a) return false;
    a.snoozeCount = 0;
    this.homey.log(`[SleepEnvironment] Snooze count reset for ${userId}`);
    return true;
  }

  getAlarmStatus(userId) {
    const a = this.alarms[userId];
    if (!a) return null;
    return {
      enabled: a.enabled,
      time: a.time,
      weekendTime: a.weekendTime,
      snoozeCount: a.snoozeCount,
      snoozeMax: a.snoozeMax,
      smartWakeWindow: a.smartWakeWindow,
      methods: {
        light: a.lightWake,
        sound: a.soundWake,
        temperature: a.temperatureWake,
        vibration: a.vibrationWake
      },
      lastTriggered: a.lastTriggered
    };
  }

  // === Profile Management ===

  updateUserProfile(userId, updates) {
    const p = this.userProfiles[userId];
    if (!p) { this.homey.error(`[SleepEnvironment] Profile not found: ${userId}`); return false; }
    for (const k of ['name', 'preferredTemp', 'preferredSound', 'preferredVolume', 'targetHours', 'chronotype', 'bedtime', 'wakeTime']) {
      if (updates[k] !== undefined) p[k] = updates[k];
    }
    this.homey.log(`[SleepEnvironment] Profile updated: ${userId}`);
    this.homey.emit('profile-updated', { userId });
    return true;
  }

  getUserProfile(userId) { return this.userProfiles[userId] || null; }
  getAllProfiles() { return { ...this.userProfiles }; }

  // === Hygiene Tracking ===

  recordCaffeineIntake(userId) {
    const h = this.hygieneTracking[userId];
    if (!h) return;
    h.caffeine.lastIntake = new Date().toISOString();
    h.caffeine.dailyCount++;
    if (new Date().getHours() >= h.caffeine.cutoffHour) this.homey.emit('hygiene-warning', { userId, type: 'late-caffeine' });
  }

  recordScreenTime(userId, mins) {
    const h = this.hygieneTracking[userId];
    if (!h) return;
    h.screenTime.lastUsage = new Date().toISOString();
    h.screenTime.eveningMinutes += mins;
  }

  recordExercise(userId, intensity, hour) {
    const h = this.hygieneTracking[userId];
    if (!h) return;
    h.exercise = { lastSession: new Date().toISOString(), intensity, timingOk: hour < 18 };
  }

  recordAlcoholIntake(userId, units) {
    const h = this.hygieneTracking[userId];
    if (!h) return;
    h.alcohol.lastIntake = new Date().toISOString();
    h.alcohol.units += units;
  }

  recordMealTiming(userId) {
    const h = this.hygieneTracking[userId];
    if (!h) return;
    h.mealTiming.lastMeal = new Date().toISOString();
    const p = this.userProfiles[userId];
    if (p) { h.mealTiming.tooCloseToSleep = (this._parseTime(p.bedtime).getTime() - Date.now()) < 2 * 3600000; }
  }

  recordPhonePresence(userId, inBedroom, onSilent) {
    const h = this.hygieneTracking[userId];
    if (h) { h.phonePresence.inBedroom = inBedroom; h.phonePresence.onSilent = onSilent; }
  }

  recordStressLevel(userId, level, breathingDone) {
    const h = this.hygieneTracking[userId];
    if (h) { h.stress.level = Math.max(0, Math.min(10, level)); h.stress.breathingExerciseDone = breathingDone || false; }
  }

  resetDailyHygiene(userId) {
    const h = this.hygieneTracking[userId];
    if (!h) return;
    h.caffeine.dailyCount = 0; h.screenTime.eveningMinutes = 0; h.alcohol.units = 0;
    h.mealTiming.tooCloseToSleep = false; h.stress = { level: 0, breathingExerciseDone: false };
    h.exercise.intensity = 'none';
    this.homey.log(`[SleepEnvironment] Daily hygiene reset for ${userId}`);
  }

  // === Sound Management ===

  playSound(zoneId, soundType, volume) {
    if (!this.soundTypes[soundType]) { this.homey.error(`[SleepEnvironment] Unknown sound: ${soundType}`); return false; }
    if (!this.sleepZones[zoneId]) { this.homey.error(`[SleepEnvironment] Unknown zone: ${zoneId}`); return false; }
    this._setZoneSound(zoneId, soundType, volume);
    this.homey.log(`[SleepEnvironment] Sound playing in ${zoneId}: ${soundType} at ${volume}`);
    this.homey.emit('sound-started', { zoneId, type: soundType, volume, maskingPower: this.soundTypes[soundType].maskingPower });
    // Start gradual volume reduction if configured
    if (this.soundReductionConfig.enabled) {
      this._scheduleVolumeReduction(zoneId);
    }
    return true;
  }

  _scheduleVolumeReduction(zoneId) {
    const cfg = this.soundReductionConfig;
    const startDelay = cfg.startAfterMinutes * 60000;
    const reductionTimer = setTimeout(() => {
      const reduceInterval = setInterval(() => {
        const sound = this.activeSounds[zoneId];
        if (!sound || !sound.playing || sound.fadingOut) {
          clearInterval(reduceInterval);
          const idx = this.intervals.indexOf(reduceInterval);
          if (idx > -1) this.intervals.splice(idx, 1);
          return;
        }
        const reduction = Math.round(sound.volume * (cfg.reductionPercent / 100));
        const newVol = Math.max(cfg.minimumVolume, sound.volume - Math.max(1, reduction));
        if (newVol !== sound.volume) {
          sound.volume = newVol;
          this.homey.emit('sound-volume-reduced', { zoneId, volume: newVol });
        }
        if (newVol <= cfg.minimumVolume) {
          clearInterval(reduceInterval);
          const idx = this.intervals.indexOf(reduceInterval);
          if (idx > -1) this.intervals.splice(idx, 1);
          this.homey.log(`[SleepEnvironment] Sound reduction complete in ${zoneId}: min volume ${cfg.minimumVolume}`);
        }
      }, cfg.intervalMinutes * 60000);
      this.intervals.push(reduceInterval);
    }, startDelay);
    // Store timeout for cleanup (not an interval but needs tracking)
    this.intervals.push(reductionTimer);
  }

  stopSound(zoneId) { this._fadeOutSound(zoneId); return true; }

  getSoundTypes() { return { ...this.soundTypes }; }

  getSoundStatus(zoneId) {
    const s = this.activeSounds[zoneId];
    if (!s) return null;
    return {
      playing: s.playing,
      type: s.type,
      typeName: s.type ? this.soundTypes[s.type]?.name : null,
      volume: s.volume,
      fadingOut: s.fadingOut,
      maskingPower: s.type ? this.soundTypes[s.type]?.maskingPower : 0
    };
  }

  setVolume(zoneId, volume) {
    const s = this.activeSounds[zoneId];
    if (!s || !s.playing) return false;
    s.volume = Math.max(0, Math.min(100, volume));
    this.homey.emit('sound-volume-changed', { zoneId, volume: s.volume });
    return true;
  }

  // === Sensor Updates ===

  updateBedSensor(zoneId, side, occupied, pressure) {
    const z = this.sleepZones[zoneId];
    if (!z) return;
    if (z.bedSensors[side] !== undefined) z.bedSensors[side] = occupied;
    if (pressure !== undefined) z.bedSensors.pressure = pressure;
  }

  updateZoneEnvironment(zoneId, data) {
    const z = this.sleepZones[zoneId];
    if (!z) return;
    for (const k of ['temperature', 'humidity', 'co2', 'vocLevel', 'pollenLevel', 'soundLevel', 'windowOpen', 'doorOpen']) {
      if (data[k] !== undefined) z[k] = data[k];
    }
  }

  updateSnoringDetection(zoneId, detected, intensity) {
    const s = this.snoringState[zoneId];
    if (s) { s.detected = detected; s.intensity = intensity || 0; }
  }

  // === Monthly Reports ===

  generateMonthlyReport(userId) {
    const p = this.userProfiles[userId];
    if (!p) return null;
    const now = new Date();
    const mk = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const ms = this.sessionLogs.filter(s => s.userId === userId && s.date && s.date.startsWith(mk));
    if (ms.length === 0) return { userId, month: mk, message: 'No sessions recorded' };
    const avg = (arr, fn) => arr.reduce((s, x) => s + fn(x), 0) / arr.length;
    const avgDur = avg(ms, s => s.duration);
    const avgEff = avg(ms, s => s.efficiency);
    const avgScr = avg(ms, s => s.sleepScore);
    const avgWk = avg(ms, s => s.wakeUps);
    const avgLat = avg(ms, s => s.latency);
    const best = ms.reduce((b, s) => s.sleepScore > b.sleepScore ? s : b, ms[0]);
    const worst = ms.reduce((w, s) => s.sleepScore < w.sleepScore ? s : w, ms[0]);
    const wkday = ms.filter(s => { const d = new Date(s.date).getDay(); return d !== 0 && d !== 6; });
    const wkend = ms.filter(s => { const d = new Date(s.date).getDay(); return d === 0 || d === 6; });
    const corr = this._correlations(ms);
    const recs = this._recommendations(avgScr, avgDur, avgLat, avgWk, p);
    const trends = this._trends(ms);
    const report = {
      userId, userName: p.name, month: mk, generatedAt: now.toISOString(), totalNights: ms.length,
      averages: { duration: Math.round(avgDur), efficiency: Math.round(avgEff), score: Math.round(avgScr), wakeUps: Math.round(avgWk * 10) / 10, latency: Math.round(avgLat) },
      bestNight: { date: best.date, score: best.sleepScore }, worstNight: { date: worst.date, score: worst.sleepScore },
      weekdayAvgDuration: wkday.length > 0 ? Math.round(avg(wkday, s => s.duration)) : 0,
      weekendAvgDuration: wkend.length > 0 ? Math.round(avg(wkend, s => s.duration)) : 0,
      sleepDebt: p.sleepDebt, correlations: corr, recommendations: recs, trends
    };
    this.monthlyReports[`${userId}-${mk}`] = report;
    p.monthlyTrends.push({ month: mk, avgScore: Math.round(avgScr), avgDuration: Math.round(avgDur) });
    if (p.monthlyTrends.length > 12) p.monthlyTrends.shift();
    this.homey.log(`[SleepEnvironment] Monthly report for ${p.name}: ${mk}`);
    this.homey.emit('monthly-report-generated', { userId, month: mk, score: Math.round(avgScr) });
    return report;
  }

  _correlations(sessions) {
    const corr = [];
    const compare = (filterHigh, filterLow, factor) => {
      const hi = sessions.filter(filterHigh);
      const lo = sessions.filter(filterLow);
      if (hi.length > 0 && lo.length > 0) {
        const hAvg = hi.reduce((s, x) => s + x.sleepScore, 0) / hi.length;
        const lAvg = lo.reduce((s, x) => s + x.sleepScore, 0) / lo.length;
        if (Math.abs(lAvg - hAvg) > 3) corr.push({ factor, impact: lAvg > hAvg ? 'negative' : 'positive', scoreDiff: Math.round(Math.abs(lAvg - hAvg)) });
      }
    };
    compare(s => s.hygiene?.caffeine?.dailyCount > 2, s => s.hygiene?.caffeine?.dailyCount <= 2, 'caffeine');
    compare(s => s.hygiene?.screenTime?.eveningMinutes > 60, s => s.hygiene?.screenTime?.eveningMinutes <= 60, 'screen-time');
    compare(s => s.hygiene?.exercise?.intensity === 'none', s => s.hygiene?.exercise?.intensity !== 'none', 'exercise');
    return corr;
  }

  _recommendations(avgScore, avgDur, avgLat, avgWk, profile) {
    const r = [];
    const tgt = profile.targetHours * 60;
    if (avgDur < tgt * 0.85) r.push({ priority: 'high', category: 'duration', text: `Avg sleep ${Math.round(avgDur)}min below ${tgt}min target. Go to bed 30min earlier.` });
    if (avgLat > 20) r.push({ priority: 'medium', category: 'latency', text: 'Sleep onset >20min. Try relaxation or cooler temperature.' });
    if (avgWk > 2) r.push({ priority: 'medium', category: 'continuity', text: 'Frequent awakenings. Ensure darkness and quiet.' });
    if (avgScore < 60) r.push({ priority: 'high', category: 'overall', text: 'Below optimal quality. Review caffeine, screens, stress.' });
    if (profile.sleepDebt > 7) r.push({ priority: 'high', category: 'debt', text: `${Math.round(profile.sleepDebt)}h sleep debt. Prioritize rest.` });
    if (this.seasonalConfig.currentSeason === 'winter') r.push({ priority: 'low', category: 'seasonal', text: 'Consider SAD therapy and vitamin D.' });
    return r;
  }

  _trends(sessions) {
    if (sessions.length < 7) return { trend: 'insufficient-data', weeklyScores: [] };
    const weeks = [];
    for (let i = 0; i < sessions.length; i += 7) {
      const w = sessions.slice(i, i + 7);
      weeks.push(Math.round(w.reduce((s, x) => s + x.sleepScore, 0) / w.length));
    }
    const trend = weeks.length >= 2 ? (weeks[weeks.length - 1] - weeks[0] > 5 ? 'improving' : weeks[0] - weeks[weeks.length - 1] > 5 ? 'declining' : 'stable') : 'stable';
    return { trend, weeklyScores: weeks };
  }

  // === Partner Compatibility ===

  getPartnerCompatibility(zoneId) {
    const z = this.sleepZones[zoneId];
    if (!z || z.bedType !== 'double') return null;
    const users = Object.values(this.userProfiles).filter(u => u.zone === zoneId);
    if (users.length < 2) return { compatible: true, message: 'Single occupant' };
    const [u1, u2] = users;
    const tempDiff = Math.abs(u1.preferredTemp - u2.preferredTemp);
    const bedDiff = this._timeDiffMin(u1.bedtime, u2.bedtime);
    const wakeDiff = this._timeDiffMin(u1.wakeTime, u2.wakeTime);
    const snoring = this.snoringState[zoneId]?.occurrences > 3;
    const soundConflict = u1.preferredSound !== u2.preferredSound;
    const recs = [];
    if (tempDiff > 1) recs.push('Use split temperature zones');
    if (u1.wakeTime !== u2.wakeTime) recs.push('Configure separate vibration alarms');
    if (snoring) recs.push('Enable mattress elevation for snoring');
    if (soundConflict) recs.push('Consider individual sleep headphones');
    return {
      zoneId, users: [u1.name, u2.name], tempDifference: tempDiff,
      splitTempZones: tempDiff > 1, bedtimeDifference: bedDiff, wakeTimeDifference: wakeDiff,
      differentAlarms: u1.wakeTime !== u2.wakeTime, snoringIssue: snoring,
      soundConflict, recommendations: recs,
      overallScore: Math.max(0, 100 - tempDiff * 10 - bedDiff / 3 - (snoring ? 15 : 0) - (soundConflict ? 5 : 0))
    };
  }

  _timeDiffMin(t1, t2) {
    return Math.abs(this._parseTime(t1).getTime() - this._parseTime(t2).getTime()) / 60000;
  }

  // === Zone & Config Queries ===

  getZoneStatus(zoneId) {
    const z = this.sleepZones[zoneId];
    if (!z) return null;
    return { ...z, sound: this.activeSounds[zoneId], snoring: this.snoringState[zoneId], preSleepRoutine: this.preSleepRoutines[zoneId], activeSessions: Object.values(this.activeSessions).filter(s => s.zoneId === zoneId && s.active).length };
  }

  getAllZoneStatuses() {
    const st = {};
    for (const zid of Object.keys(this.sleepZones)) st[zid] = this.getZoneStatus(zid);
    return st;
  }

  updateSeasonalConfig(u) {
    for (const k of ['latitude', 'sadTherapyEnabled', 'sadLightIntensity', 'sadSessionMinutes', 'midnightSunBlocking', 'winterDarkCompensation']) {
      if (u[k] !== undefined) this.seasonalConfig[k] = u[k];
    }
    this.homey.log('[SleepEnvironment] Seasonal config updated');
  }

  getSeasonalConfig() { return { ...this.seasonalConfig }; }

  // === Smart Bedding Controls ===

  setHeatedBlanket(zoneId, side, enabled, temp) {
    const z = this.sleepZones[zoneId];
    if (!z || !z.heatedBlanket[side]) return false;
    z.heatedBlanket[side].enabled = enabled;
    if (temp !== undefined) z.heatedBlanket[side].temp = Math.min(30, Math.max(18, temp));
    this.homey.log(`[SleepEnvironment] Blanket ${side} in ${zoneId}: ${enabled ? 'on' : 'off'} ${z.heatedBlanket[side].temp}°C`);
    this.homey.emit('heated-blanket-changed', { zoneId, side, enabled, temperature: z.heatedBlanket[side].temp });
    return true;
  }

  setCoolingPad(zoneId, side, enabled) {
    const z = this.sleepZones[zoneId];
    if (!z || z.coolingPad[side] === undefined) return false;
    z.coolingPad[side] = enabled;
    this.homey.log(`[SleepEnvironment] Cooling pad ${side} in ${zoneId}: ${enabled ? 'on' : 'off'}`);
    this.homey.emit('cooling-pad-changed', { zoneId, side, enabled });
    return true;
  }

  // === Ventilation ===

  addVentilationSchedule(startHour, endHour, zoneId) {
    this.airQuality.ventilationSchedule.push({ start: startHour, end: endHour, zone: zoneId || 'all', enabled: true });
    this.homey.log(`[SleepEnvironment] Ventilation schedule: ${startHour}:00-${endHour}:00 for ${zoneId || 'all'}`);
  }

  getVentilationSchedule() { return [...this.airQuality.ventilationSchedule]; }

  // === Environment Assessment ===

  assessSleepEnvironment(zoneId) {
    const z = this.sleepZones[zoneId];
    if (!z) return null;
    const issues = [];
    const score = { total: 100, breakdown: {} };

    // Temperature assessment (optimal 16-18°C)
    if (z.temperature < 16) {
      issues.push({ category: 'temperature', severity: 'medium', message: `Room too cold: ${z.temperature}°C (optimal 16-18°C)` });
      score.total -= 10;
    } else if (z.temperature > 18) {
      issues.push({ category: 'temperature', severity: z.temperature > 22 ? 'high' : 'medium', message: `Room too warm: ${z.temperature}°C (optimal 16-18°C)` });
      score.total -= z.temperature > 22 ? 20 : 10;
    }
    score.breakdown.temperature = z.temperature >= 16 && z.temperature <= 18 ? 100 : Math.max(0, 100 - Math.abs(z.temperature - 17) * 15);

    // CO2 assessment
    if (z.co2 > this.airQuality.co2Max) {
      issues.push({ category: 'air', severity: 'high', message: `CO2 elevated: ${z.co2}ppm (max ${this.airQuality.co2Max}ppm)` });
      score.total -= 15;
    }
    score.breakdown.co2 = z.co2 <= this.airQuality.co2Max ? 100 : Math.max(0, 100 - (z.co2 - this.airQuality.co2Max) / 5);

    // Humidity assessment
    if (z.humidity < this.airQuality.humidityMin || z.humidity > this.airQuality.humidityMax) {
      issues.push({ category: 'humidity', severity: 'medium', message: `Humidity out of range: ${z.humidity}% (optimal ${this.airQuality.humidityMin}-${this.airQuality.humidityMax}%)` });
      score.total -= 10;
    }
    score.breakdown.humidity = (z.humidity >= this.airQuality.humidityMin && z.humidity <= this.airQuality.humidityMax) ? 100 : 60;

    // Light assessment
    if (z.lightLevel > 5) {
      issues.push({ category: 'light', severity: z.lightLevel > 30 ? 'high' : 'low', message: `Light detected: ${z.lightLevel}% (should be <5%)` });
      score.total -= Math.min(20, z.lightLevel / 2);
    }
    score.breakdown.light = z.lightLevel <= 5 ? 100 : Math.max(0, 100 - z.lightLevel * 2);

    // Noise assessment
    if (z.soundLevel > 35) {
      issues.push({ category: 'noise', severity: z.soundLevel > 55 ? 'high' : 'medium', message: `Ambient noise: ${z.soundLevel}dB (optimal <35dB)` });
      score.total -= Math.min(15, (z.soundLevel - 35) / 2);
    }
    score.breakdown.noise = z.soundLevel <= 35 ? 100 : Math.max(0, 100 - (z.soundLevel - 35) * 3);

    // Blackout blinds
    if (z.blackoutBlinds < 90) {
      issues.push({ category: 'blinds', severity: 'low', message: `Blinds at ${z.blackoutBlinds}% (recommend 100%)` });
    }
    score.breakdown.blinds = z.blackoutBlinds >= 90 ? 100 : z.blackoutBlinds;

    // Window/door status
    if (z.doorOpen) {
      issues.push({ category: 'door', severity: 'low', message: 'Door is open - may allow noise/light' });
      score.total -= 5;
    }

    score.total = Math.max(0, Math.min(100, Math.round(score.total)));
    return { zoneId, score, issues, timestamp: new Date().toISOString(), recommendation: score.total >= 80 ? 'Environment is good for sleep' : score.total >= 60 ? 'Some adjustments recommended' : 'Significant improvements needed' };
  }

  // === Circadian ===

  getCircadianStatus(userId) {
    const p = this.userProfiles[userId];
    if (!p) return null;
    const h = new Date().getHours();
    const bh = parseInt(p.bedtime.split(':')[0]);
    const wh = parseInt(p.wakeTime.split(':')[0]);
    let phase = 'active';
    if (h >= 20) phase = 'wind-down';
    if (h >= bh || h < wh) phase = 'sleep';
    if (h >= wh && h < wh + 2) phase = 'wake-up';
    const mh = (bh - 2 + 24) % 24;
    return {
      userId, currentPhase: phase, chronotype: p.chronotype,
      melatoninOnset: `${String(mh).padStart(2, '0')}:${p.bedtime.split(':')[1]}`,
      optimalBedtime: p.bedtime, optimalWakeTime: p.wakeTime,
      blueLightSensitivity: h >= 20 ? 'high' : 'low',
      lightRecommendation: phase === 'wake-up' ? 'bright-light' : phase === 'wind-down' ? 'dim-warm' : 'normal'
    };
  }

  // === Utility ===

  _parseTime(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  }

  // === Queries ===

  getSessionHistory(userId, limit) {
    let s = this.sessionLogs;
    if (userId) s = s.filter(x => x.userId === userId);
    if (limit) s = s.slice(-limit);
    return s;
  }

  getActiveSessions() { return Object.values(this.activeSessions).filter(s => s.active); }

  getStatistics() {
    return {
      initialized: this.initialized,
      zones: Object.keys(this.sleepZones).length,
      zoneIds: Object.keys(this.sleepZones),
      userProfiles: Object.keys(this.userProfiles).length,
      activeSessions: Object.values(this.activeSessions).filter(s => s.active).length,
      totalSessionsLogged: this.sessionLogs.length,
      activeAlarms: Object.keys(this.alarms).length,
      soundTypes: Object.keys(this.soundTypes).length,
      activeSounds: Object.values(this.activeSounds).filter(s => s.playing).length,
      activeNaps: Object.values(this.napTracking).filter(n => n.active).length,
      snoringDetections: Object.values(this.snoringState).filter(s => s.detected).length,
      seasonalMode: this.seasonalConfig.currentSeason,
      sadTherapyEnabled: this.seasonalConfig.sadTherapyEnabled,
      airQuality: { hepaFilterHours: Math.round(this.airQuality.hepaFilterHours), ventilationSchedules: this.airQuality.ventilationSchedule.length },
      sleepDebtUsers: Object.entries(this.sleepDebtData).filter(([_, d]) => d.weeklyDeficit > 0).map(([uid, d]) => ({ userId: uid, deficit: Math.round(d.weeklyDeficit * 10) / 10 })),
      monitoringIntervals: this.intervals.length,
      monthlyReportsCached: Object.keys(this.monthlyReports).length
    };
  }

  getSleepDebtSummary(userId) {
    const d = this.sleepDebtData[userId];
    const p = this.userProfiles[userId];
    if (!d || !p) return null;
    return {
      userId,
      userName: p.name,
      optimalHoursPerNight: d.optimal,
      actualThisWeek: d.actualWeekly,
      avgThisWeek: d.actualWeekly.length > 0 ? Math.round((d.actualWeekly.reduce((s, h) => s + h, 0) / d.actualWeekly.length) * 10) / 10 : 0,
      weeklyDeficit: Math.round(d.weeklyDeficit * 10) / 10,
      status: d.weeklyDeficit <= 2 ? 'healthy' : d.weeklyDeficit <= 5 ? 'moderate-debt' : 'significant-debt',
      recoveryPlan: d.recoveryPlan,
      daysTracked: d.actualWeekly.length
    };
  }

  getNapHistory(userId) {
    const n = this.napTracking[userId];
    if (!n) return { userId, naps: [], totalNaps: 0, avgDuration: 0 };
    const avgDur = n.history.length > 0
      ? Math.round(n.history.reduce((s, x) => s + x.duration, 0) / n.history.length)
      : 0;
    return {
      userId,
      currentlyNapping: n.active,
      currentDuration: n.active ? Math.round(n.duration) : 0,
      maxDuration: n.maxDuration,
      history: n.history.slice(-30),
      totalNaps: n.history.length,
      avgDuration: avgDur,
      negativeImpactCount: n.history.filter(x => x.impact === 'negative').length
    };
  }

  getHygieneReport(userId) {
    const h = this.hygieneTracking[userId];
    if (!h) return null;
    let hygieneScore = 100;
    const factors = [];
    if (h.caffeine.dailyCount > 2) { hygieneScore -= 15; factors.push('excessive-caffeine'); }
    else if (h.caffeine.dailyCount > 0) { hygieneScore -= 5; factors.push('caffeine'); }
    if (h.screenTime.eveningMinutes > 60) { hygieneScore -= 15; factors.push('high-screen-time'); }
    else if (h.screenTime.eveningMinutes > 30) { hygieneScore -= 5; factors.push('moderate-screen-time'); }
    if (h.alcohol.units > 2) { hygieneScore -= 20; factors.push('high-alcohol'); }
    else if (h.alcohol.units > 0) { hygieneScore -= 10; factors.push('alcohol'); }
    if (h.mealTiming.tooCloseToSleep) { hygieneScore -= 10; factors.push('late-meal'); }
    if (h.phonePresence.inBedroom && !h.phonePresence.onSilent) { hygieneScore -= 10; factors.push('phone-active'); }
    if (h.stress.level > 7) { hygieneScore -= 15; factors.push('high-stress'); }
    else if (h.stress.level > 4) { hygieneScore -= 5; factors.push('moderate-stress'); }
    if (h.exercise.intensity !== 'none' && h.exercise.timingOk) hygieneScore += 5;
    if (h.stress.breathingExerciseDone) hygieneScore += 5;
    return {
      userId,
      hygieneScore: Math.max(0, Math.min(100, hygieneScore)),
      negativeFactors: factors,
      details: { ...h },
      grade: hygieneScore >= 80 ? 'A' : hygieneScore >= 60 ? 'B' : hygieneScore >= 40 ? 'C' : 'D'
    };
  }

  destroy() {
    for (const i of this.intervals) clearInterval(i);
    this.intervals = [];
    for (const [, s] of Object.entries(this.activeSessions)) {
      if (s.active) { s.active = false; s.endTime = Date.now(); }
    }
    for (const zid of Object.keys(this.activeSounds)) {
      this.activeSounds[zid] = { playing: false, type: null, volume: 0, fadingOut: false };
    }
    for (const z of Object.values(this.sleepZones)) {
      for (const bl of Object.values(z.heatedBlanket)) bl.enabled = false;
    }
    this.initialized = false;
    this.homey.log('[SleepEnvironment] destroyed');
  }
}

module.exports = AdvancedSleepEnvironmentSystem;
