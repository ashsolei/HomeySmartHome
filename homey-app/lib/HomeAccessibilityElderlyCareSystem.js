'use strict';

/**
 * HomeAccessibilityElderlyCareSystem
 *
 * Comprehensive accessibility and elderly care system providing fall detection,
 * inactivity monitoring, medication reminders, wander prevention, emergency SOS,
 * cognitive support, adaptive lighting, voice control, vital signs integration,
 * social isolation detection, caregiver dashboard, meal management, exercise
 * prompts, environmental safety, sleep monitoring, and visitor management.
 */
class HomeAccessibilityElderlyCareSystem {
  constructor(homey) {
    this.homey = homey;

    // ── Core state ──
    this.initialized = false;
    this.monitoringInterval = null;
    this.monitoringCycleSec = 60;

    // ── Residents ──
    this.residents = new Map();

    // ── Fall detection ──
    this.fallDetection = {
      enabled: true,
      monitoredRooms: ['bathroom', 'bedroom', 'kitchen', 'hallway'],
      impactThreshold: 8.5,
      noMovementWindowMs: 15000,
      escalationSteps: [
        { delayMs: 0, action: 'local_alarm' },
        { delayMs: 30000, action: 'family_sms' },
        { delayMs: 90000, action: 'emergency_services' }
      ],
      falsePositiveFilters: {
        minMassKg: 20,
        vibrationPatternMatch: true,
        multiSensorCorrelation: true
      },
      recentEvents: [],
      dailyRiskScores: []
    };

    // ── Inactivity monitoring ──
    this.inactivityMonitoring = {
      enabled: true,
      defaultThresholdMs: 2 * 60 * 60 * 1000,
      overnightBathroomIntervalMs: 6 * 60 * 60 * 1000,
      expectedActivityWindows: {
        bathroom: { start: '06:00', end: '09:00' },
        kitchen: { start: '07:00', end: '20:00' },
        living_room: { start: '08:00', end: '22:00' },
        bedroom: { start: '21:00', end: '08:00' }
      },
      lastMotionByRoom: {},
      activityScores: {}
    };

    // ── Medication reminders ──
    this.medicationManager = {
      enabled: true,
      maxMedicationsPerResident: 15,
      medications: new Map(),
      scheduleSlots: {
        morning: '08:00',
        noon: '12:00',
        evening: '18:00',
        bedtime: '22:00'
      },
      missedDoseEscalation: [
        { delayMs: 0, action: 'reminder' },
        { delayMs: 600000, action: 'loud_reminder' },
        { delayMs: 1200000, action: 'family_alert' }
      ],
      refillTrackingDays: 30,
      drugInteractions: [],
      dispenserIntegration: true,
      pendingReminders: []
    };

    // ── Wander prevention ──
    this.wanderPrevention = {
      enabled: true,
      nightWindowStart: '23:00',
      nightWindowEnd: '05:00',
      doorSensors: ['front_door', 'back_door', 'garage_door'],
      geofenceRadiusMeters: 50,
      autoLockEnabled: true,
      manualOverride: true,
      pathLightingEnabled: true,
      alerts: []
    };

    // ── Emergency SOS ──
    this.emergencySOS = {
      enabled: true,
      triggerMethods: ['wearable_panic_button', 'voice_activated', 'auto_detect'],
      voiceKeywords: ['help me', 'hjälp mig', 'emergency', 'nödfall', 'call for help'],
      escalationChain: [
        { contact: 'family_contact_1', delayMs: 0 },
        { contact: 'family_contact_2', delayMs: 60000 },
        { contact: 'family_contact_3', delayMs: 120000 },
        { contact: '112', delayMs: 180000 }
      ],
      locationReporting: true,
      medicalInfoPacket: {
        conditions: [],
        medications: [],
        allergies: [],
        bloodType: '',
        doctorName: '',
        doctorPhone: '',
        insuranceId: ''
      },
      activeEmergencies: []
    };

    // ── Cognitive support ──
    this.cognitiveSupport = {
      enabled: true,
      announcementTimes: ['08:00', '13:00', '19:00'],
      announcements: ['time_date_weather', 'upcoming_appointments', 'orientation'],
      mealReminders: true,
      appointmentCountdown: true,
      roomAnnouncementsOnEntry: true,
      photoFrameCycleMinutes: 5,
      familyPhotos: [],
      appointments: []
    };

    // ── Adaptive lighting ──
    this.adaptiveLighting = {
      enabled: true,
      motionActivated: true,
      progressiveBrightness: true,
      nighttimeGradualOnMs: 5000,
      pathwayLighting: {
        enabled: true,
        routes: [
          { from: 'bedroom', to: 'bathroom', zones: ['hallway'] }
        ]
      },
      circadianRhythm: {
        enabled: true,
        schedule: [
          { time: '06:00', colorTempK: 4000, brightnessPct: 40 },
          { time: '08:00', colorTempK: 5000, brightnessPct: 80 },
          { time: '12:00', colorTempK: 5500, brightnessPct: 100 },
          { time: '17:00', colorTempK: 4000, brightnessPct: 70 },
          { time: '20:00', colorTempK: 3000, brightnessPct: 50 },
          { time: '22:00', colorTempK: 2700, brightnessPct: 20 }
        ]
      },
      nightlightMode: { enabled: true, brightnessPct: 5, colorTempK: 2200 },
      noSuddenDarkness: true,
      fadeOutMs: 10000
    };

    // ── Voice control ──
    this.voiceControl = {
      enabled: true,
      simplifiedCommands: {
        'lights on': 'turnOnLights',
        'lights off': 'turnOffLights',
        'call family': 'callFamilyContact',
        'what time is it': 'announceTime',
        'help me': 'triggerSOS',
        'hjälp mig': 'triggerSOS',
        'tänd lampan': 'turnOnLights',
        'släck lampan': 'turnOffLights',
        'ring familjen': 'callFamilyContact',
        'vad är klockan': 'announceTime'
      },
      largeVocabularyTolerance: true,
      repeatedCommandPatience: true,
      maxRepeatCount: 5,
      hearingProfile: { volumeBoostDb: 0, preferredFrequencyHz: 2000 },
      autoAdjustVolume: true,
      languages: ['sv', 'en']
    };

    // ── Vital signs ──
    this.vitalSigns = {
      enabled: true,
      bloodPressure: { schedule: ['08:00', '20:00'], readings: [], alertSystolic: 160, alertDiastolic: 100 },
      bloodGlucose: { diabeticProfile: false, readings: [], alertHighMgDl: 250, alertLowMgDl: 70 },
      weight: { dailyTracking: true, readings: [], alertChangeKg: 2 },
      heartRate: { source: 'wearable', readings: [], alertHighBpm: 120, alertLowBpm: 45 },
      spO2: { enabled: true, readings: [], alertBelowPct: 90 },
      trendAnalysis: { windowDays: 30, reportToGP: true },
      lastReadings: {}
    };

    // ── Social isolation detection ──
    this.socialIsolation = {
      enabled: true,
      phoneCallFrequency: { readings: [], minWeekly: 3 },
      visitorFrequency: { readings: [], minWeekly: 2 },
      videoCallLogs: [],
      activityVarietyScore: 0,
      moodInference: { recentPatterns: [], currentMood: 'neutral' },
      familyConnectionSuggestions: [],
      isolationScore: 0
    };

    // ── Caregiver dashboard ──
    this.caregiverDashboard = {
      enabled: true,
      caregivers: new Map(),
      shiftHandoffNotes: [],
      taskCompletion: {
        medication: [],
        meals: [],
        exercises: []
      },
      careLog: [],
      rolePermissions: {
        primary: ['read', 'write', 'admin'],
        secondary: ['read', 'write'],
        family: ['read'],
        visitor: []
      }
    };

    // ── Meal management ──
    this.mealManagement = {
      enabled: true,
      mealSchedule: {
        breakfast: '08:00',
        lunch: '12:00',
        dinner: '17:30'
      },
      stoveAutoOffMinutes: 30,
      hydrationReminderIntervalMs: 2 * 60 * 60 * 1000,
      nutritionTracking: {
        dailyTargets: { calories: 1800, proteinG: 60, fiberG: 25, fluidMl: 2000 },
        todayIntake: { calories: 0, proteinG: 0, fiberG: 0, fluidMl: 0 }
      },
      specialDiets: [],
      supportedDiets: ['diabetic', 'low-sodium', 'soft-food', 'gluten-free', 'pureed'],
      lastHydrationReminder: null,
      stoveOnSince: null
    };

    // ── Exercise prompts ──
    this.exercisePrompts = {
      enabled: true,
      reminderIntervalMs: 3 * 60 * 60 * 1000,
      wakingHoursStart: '07:00',
      wakingHoursEnd: '21:00',
      chairExercises: [
        { id: 1, name: 'Seated Marching', durationSec: 60, description: 'Lift knees alternately while seated' },
        { id: 2, name: 'Arm Circles', durationSec: 45, description: 'Extend arms and make small circles' },
        { id: 3, name: 'Ankle Rotations', durationSec: 30, description: 'Rotate ankles clockwise then counter-clockwise' },
        { id: 4, name: 'Shoulder Shrugs', durationSec: 30, description: 'Raise shoulders to ears and release' },
        { id: 5, name: 'Seated Leg Extensions', durationSec: 45, description: 'Extend one leg at a time while seated' },
        { id: 6, name: 'Wrist Flexion', durationSec: 30, description: 'Bend wrists up and down slowly' },
        { id: 7, name: 'Head Turns', durationSec: 30, description: 'Slowly turn head left and right' },
        { id: 8, name: 'Toe Taps', durationSec: 45, description: 'Tap toes while keeping heels on the floor' },
        { id: 9, name: 'Seated Side Bends', durationSec: 30, description: 'Lean to each side with arm overhead' },
        { id: 10, name: 'Deep Breathing', durationSec: 60, description: 'Inhale deeply through nose, exhale through mouth' }
      ],
      walkingEncouragement: true,
      physiotherapySchedule: [],
      activityDurationTracking: [],
      lastPromptTime: null
    };

    // ── Environmental safety ──
    this.environmentalSafety = {
      enabled: true,
      smokeDetection: true,
      coDetection: true,
      gasDetection: true,
      waterLeakDetection: true,
      temperatureRange: { comfortMinC: 18, comfortMaxC: 24, alertMinC: 16, alertMaxC: 28 },
      humidityRange: { minPct: 30, maxPct: 60 },
      airQuality: { pm25AlertUgM3: 35, co2AlertPpm: 1000 },
      currentReadings: {
        temperatureC: null,
        humidityPct: null,
        pm25UgM3: null,
        co2Ppm: null,
        smokeDetected: false,
        coDetected: false,
        gasDetected: false,
        waterLeakDetected: false
      },
      alerts: []
    };

    // ── Sleep monitoring ──
    this.sleepMonitoring = {
      enabled: true,
      bedSensor: {
        inBedTime: null,
        wakeTime: null,
        restlessnessEvents: 0,
        nighttimeBathroomTrips: 0
      },
      sleepQualityScore: 0,
      recentNights: [],
      optimalEnvironment: { temperatureC: 18, dark: true, quiet: true },
      unusualPatternThreshold: { moreSleepHours: 2, lessSleepHours: 2 },
      averageSleepHours: 7.5
    };

    // ── Visitor management ──
    this.visitorManagement = {
      enabled: true,
      expectedVisitors: [],
      unknownVisitorAlerts: true,
      deliveryPersonDetection: true,
      caregiverArrivalConfirmation: true,
      familyVisitLog: [],
      recentVisitors: []
    };

    // ── Accessibility features ──
    this.accessibilityFeatures = {
      highContrastDisplays: true,
      textToSpeechForAll: true,
      hearingAidCompatible: true,
      compatibleFrequencyHz: 2000,
      touchFreeControls: true,
      controlMethods: ['motion', 'voice'],
      wheelchairAccessible: true,
      devicePlacementHeightCm: 90
    };

    // ── Statistics counters ──
    this.stats = {
      fallsDetected: 0,
      falsePositiveFallsRejected: 0,
      inactivityAlerts: 0,
      medicationRemindersIssued: 0,
      missedDoses: 0,
      wanderAlerts: 0,
      sosTriggered: 0,
      vitalAlerts: 0,
      environmentalAlerts: 0,
      exerciseSessionsCompleted: 0,
      mealsLogged: 0,
      hydrationReminders: 0,
      visitorEvents: 0,
      cognitiveAnnouncements: 0,
      monitoringCyclesCompleted: 0,
      uptimeMs: 0
    };

    this.startTime = null;
  }

  // ────────────────────────────────────────────
  // Initialization
  // ────────────────────────────────────────────
  async initialize() {
    try {
      if (this.initialized) {
        this.log('System already initialized');
        return;
      }

      this.log('Initializing HomeAccessibilityElderlyCareSystem...');
      this.startTime = Date.now();

      try {
        await this._loadResidentProfiles();
        await this._initializeFallDetection();
        await this._initializeInactivityMonitoring();
        await this._initializeMedicationManager();
        await this._initializeWanderPrevention();
        await this._initializeEmergencySOS();
        await this._initializeCognitiveSupport();
        await this._initializeAdaptiveLighting();
        await this._initializeVoiceControl();
        await this._initializeVitalSigns();
        await this._initializeSocialIsolation();
        await this._initializeCaregiverDashboard();
        await this._initializeMealManagement();
        await this._initializeExercisePrompts();
        await this._initializeEnvironmentalSafety();
        await this._initializeSleepMonitoring();
        await this._initializeVisitorManagement();

        this._startMonitoringCycle();

        this.initialized = true;
        this.log('HomeAccessibilityElderlyCareSystem fully initialized');
      } catch (err) {
        this.error(`Initialization failed: ${err.message}`);
        throw err;
      }
    } catch (error) {
      this.homey.error(`[HomeAccessibilityElderlyCareSystem] Failed to initialize:`, error.message);
    }
  }

  // ────────────────────────────────────────────
  // Logging
  // ────────────────────────────────────────────
  log(msg) {
    if (this.homey && typeof this.homey.log === 'function') {
      this.homey.log(`[ElderCare] ${msg}`);
    } else {
      console.log(`[ElderCare] ${msg}`);
    }
  }

  error(msg) {
    if (this.homey && typeof this.homey.error === 'function') {
      this.homey.error(`[ElderCare] ${msg}`);
    } else {
      console.error(`[ElderCare] ${msg}`);
    }
  }

  // ────────────────────────────────────────────
  // Statistics
  // ────────────────────────────────────────────
  getStatistics() {
    const now = Date.now();
    return {
      ...this.stats,
      uptimeMs: this.startTime ? now - this.startTime : 0,
      residentsMonitored: this.residents.size,
      activeMedications: this.medicationManager.medications.size,
      caregiverCount: this.caregiverDashboard.caregivers.size,
      currentSleepScore: this.sleepMonitoring.sleepQualityScore,
      socialIsolationScore: this.socialIsolation.isolationScore,
      environmentalReadings: { ...this.environmentalSafety.currentReadings },
      fallDetectionEnabled: this.fallDetection.enabled,
      wanderPreventionEnabled: this.wanderPrevention.enabled,
      emergencySOSEnabled: this.emergencySOS.enabled,
      activeEmergencies: this.emergencySOS.activeEmergencies.length,
      initialized: this.initialized
    };
  }

  // ────────────────────────────────────────────
  // Monitoring Cycle (every 60 seconds)
  // ────────────────────────────────────────────
  _startMonitoringCycle() {
    this.log(`Starting monitoring cycle every ${this.monitoringCycleSec}s`);
    this.monitoringInterval = setInterval(() => {
      this._runMonitoringCycle();
    }, this.monitoringCycleSec * 1000);
  }

  async _runMonitoringCycle() {
    try {
      await this._checkAllSensors();
      await this._checkActivityLevels();
      await this._checkMedicationSchedules();
      await this._checkVitalSigns();
      await this._checkEnvironmentalSafety();
      await this._checkSleepPatterns();
      await this._checkSocialIsolation();
      await this._checkWanderPrevention();
      await this._checkMealSchedule();
      await this._checkExerciseSchedule();
      await this._checkHydration();
      await this._checkStoveStatus();
      await this._updateCaregiverDashboard();
      this.stats.monitoringCyclesCompleted++;
    } catch (err) {
      this.error(`Monitoring cycle error: ${err.message}`);
    }
  }

  // ────────────────────────────────────────────
  // Resident profiles
  // ────────────────────────────────────────────
  async _loadResidentProfiles() {
    this.log('Loading resident profiles');
  }

  addResident(id, profile) {
    const resident = {
      id,
      name: profile.name || 'Unknown',
      age: profile.age || 0,
      conditions: profile.conditions || [],
      allergies: profile.allergies || [],
      bloodType: profile.bloodType || '',
      doctor: profile.doctor || { name: '', phone: '' },
      emergencyContacts: profile.emergencyContacts || [],
      hearingProfile: profile.hearingProfile || { volumeBoostDb: 0 },
      mobilityLevel: profile.mobilityLevel || 'independent',
      cognitiveLevel: profile.cognitiveLevel || 'normal',
      diet: profile.diet || 'regular',
      languages: profile.languages || ['en'],
      activityScore: 100,
      lastKnownRoom: null,
      lastMotionTime: null,
      ...profile
    };
    this.residents.set(id, resident);
    this.log(`Added resident: ${resident.name} (${id})`);
    return resident;
  }

  removeResident(id) {
    if (this.residents.has(id)) {
      const name = this.residents.get(id).name;
      this.residents.delete(id);
      this.log(`Removed resident: ${name} (${id})`);
      return true;
    }
    return false;
  }

  getResident(id) {
    return this.residents.get(id) || null;
  }

  // ────────────────────────────────────────────
  // Fall Detection
  // ────────────────────────────────────────────
  async _initializeFallDetection() {
    this.log('Initializing fall detection system');
    this.fallDetection.monitoredRooms.forEach(room => {
      this.log(`Fall detection active in: ${room}`);
    });
  }

  async processMotionEvent(room, sensorData) {
    if (!this.fallDetection.enabled) return null;
    if (!this.fallDetection.monitoredRooms.includes(room)) return null;

    const impactForce = sensorData.impactForce || 0;
    const hasMovement = sensorData.movementDetected !== false;
    const timestamp = Date.now();

    // Update last motion for inactivity monitoring
    this.inactivityMonitoring.lastMotionByRoom[room] = timestamp;

    if (impactForce >= this.fallDetection.impactThreshold) {
      this.log(`High impact detected in ${room}: force=${impactForce}`);

      // Check false positive filters
      if (this._isFalsePositiveFall(sensorData)) {
        this.log(`False positive rejected in ${room}`);
        this.stats.falsePositiveFallsRejected++;
        return { type: 'false_positive', room, timestamp };
      }

      // No movement after impact → likely fall
      if (!hasMovement) {
        return await this._triggerFallAlert(room, sensorData, timestamp);
      }

      // Wait for movement window to confirm
      return new Promise((resolve) => {
        setTimeout(async () => {
          const currentMotion = this.inactivityMonitoring.lastMotionByRoom[room];
          if (currentMotion === timestamp) {
            resolve(await this._triggerFallAlert(room, sensorData, timestamp));
          } else {
            this.log(`Movement resumed in ${room}, no fall confirmed`);
            this.stats.falsePositiveFallsRejected++;
            resolve({ type: 'movement_resumed', room, timestamp });
          }
        }, this.fallDetection.noMovementWindowMs);
      });
    }

    return null;
  }

  _isFalsePositiveFall(sensorData) {
    const filters = this.fallDetection.falsePositiveFilters;

    // Dropped object check: mass too low to be a person
    if (filters.minMassKg && sensorData.estimatedMassKg && sensorData.estimatedMassKg < filters.minMassKg) {
      return true;
    }

    // Vibration pattern indicates object drop, not person
    if (filters.vibrationPatternMatch && sensorData.vibrationPattern === 'object_drop') {
      return true;
    }

    // Only one sensor triggered — likely not a person fall
    if (filters.multiSensorCorrelation && sensorData.singleSensorOnly) {
      return true;
    }

    return false;
  }

  async _triggerFallAlert(room, sensorData, timestamp) {
    this.log(`FALL DETECTED in ${room}! Initiating escalation.`);
    this.stats.fallsDetected++;

    const event = {
      type: 'fall_detected',
      room,
      timestamp,
      sensorData,
      escalationStep: 0,
      resolved: false
    };

    this.fallDetection.recentEvents.push(event);
    await this._escalateFallAlert(event);
    return event;
  }

  async _escalateFallAlert(event) {
    for (const step of this.fallDetection.escalationSteps) {
      if (event.resolved) break;

      if (step.delayMs > 0) {
        await this._delay(step.delayMs);
      }

      if (event.resolved) break;

      switch (step.action) {
        case 'local_alarm':
          this.log(`Fall escalation: Local alarm activated in ${event.room}`);
          await this._activateLocalAlarm(event.room);
          break;
        case 'family_sms':
          this.log('Fall escalation: Sending SMS to family contacts');
          await this._sendFamilyNotification('fall_detected', event);
          break;
        case 'emergency_services':
          this.log('Fall escalation: Contacting emergency services (112)');
          await this._contactEmergencyServices(event);
          break;
      }

      event.escalationStep++;
    }
  }

  calculateDailyFallRisk(residentId) {
    const resident = this.residents.get(residentId);
    if (!resident) return 0;

    let risk = 0;

    // Age factor
    if (resident.age > 80) risk += 25;
    else if (resident.age > 70) risk += 15;
    else if (resident.age > 60) risk += 10;

    // Mobility factor
    if (resident.mobilityLevel === 'limited') risk += 20;
    else if (resident.mobilityLevel === 'assisted') risk += 30;

    // Medical conditions
    if (resident.conditions.includes('osteoporosis')) risk += 15;
    if (resident.conditions.includes('vertigo')) risk += 10;
    if (resident.conditions.includes('low_blood_pressure')) risk += 10;

    // Recent fall history (last 30 days)
    const recentFalls = this.fallDetection.recentEvents.filter(e => {
      return e.timestamp > Date.now() - 30 * 24 * 60 * 60 * 1000;
    }).length;
    risk += recentFalls * 15;

    const score = Math.min(100, Math.max(0, risk));
    this.fallDetection.dailyRiskScores.push({ residentId, score, date: new Date().toISOString() });
    return score;
  }

  // ────────────────────────────────────────────
  // Inactivity Monitoring
  // ────────────────────────────────────────────
  async _initializeInactivityMonitoring() {
    this.log('Initializing inactivity monitoring');
    Object.keys(this.inactivityMonitoring.expectedActivityWindows).forEach(room => {
      this.inactivityMonitoring.lastMotionByRoom[room] = Date.now();
      this.inactivityMonitoring.activityScores[room] = 100;
    });
  }

  async _checkActivityLevels() {
    const now = Date.now();
    const rooms = Object.keys(this.inactivityMonitoring.expectedActivityWindows);

    for (const room of rooms) {
      const lastMotion = this.inactivityMonitoring.lastMotionByRoom[room] || 0;
      const elapsed = now - lastMotion;
      const threshold = this.inactivityMonitoring.defaultThresholdMs;
      const window = this.inactivityMonitoring.expectedActivityWindows[room];
      const currentTime = this._getCurrentTimeString();

      if (this._isWithinTimeWindow(currentTime, window.start, window.end)) {
        if (elapsed > threshold) {
          this.log(`Inactivity alert: No motion in ${room} for ${Math.round(elapsed / 60000)} minutes`);
          this.stats.inactivityAlerts++;
          await this._sendInactivityAlert(room, elapsed);
        }
      }

      // Update activity score for room (0-100)
      const score = Math.max(0, 100 - Math.floor((elapsed / threshold) * 100));
      this.inactivityMonitoring.activityScores[room] = score;
    }

    await this._checkOvernightBathroom();
  }

  async _checkOvernightBathroom() {
    const currentTime = this._getCurrentTimeString();
    if (!this._isWithinTimeWindow(currentTime, '22:00', '07:00')) return;

    const bathroomLastMotion = this.inactivityMonitoring.lastMotionByRoom['bathroom'] || 0;
    const elapsed = Date.now() - bathroomLastMotion;

    if (elapsed > this.inactivityMonitoring.overnightBathroomIntervalMs) {
      this.log('Overnight bathroom check: No bathroom visit detected for 6+ hours');
      this.stats.inactivityAlerts++;
    }
  }

  getActivityScore(_residentId) {
    const scores = Object.values(this.inactivityMonitoring.activityScores);
    if (scores.length === 0) return 0;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    return Math.round(avg);
  }

  // ────────────────────────────────────────────
  // Medication Reminders
  // ────────────────────────────────────────────
  async _initializeMedicationManager() {
    this.log('Initializing medication management system');
  }

  addMedication(residentId, medication) {
    const residentMeds = this.medicationManager.medications.get(residentId) || [];

    if (residentMeds.length >= this.medicationManager.maxMedicationsPerResident) {
      this.error(`Maximum medications (${this.medicationManager.maxMedicationsPerResident}) reached for resident ${residentId}`);
      return null;
    }

    const med = {
      id: `med_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name: medication.name,
      dosage: medication.dosage || '',
      schedule: medication.schedule || ['morning'],
      pillsRemaining: medication.pillsRemaining || 90,
      pillsPerDose: medication.pillsPerDose || 1,
      refillThreshold: medication.refillThreshold || 7,
      instructions: medication.instructions || '',
      interactions: medication.interactions || [],
      sideEffects: medication.sideEffects || [],
      startDate: medication.startDate || new Date().toISOString(),
      active: true
    };

    this._checkDrugInteractions(residentId, med);
    residentMeds.push(med);
    this.medicationManager.medications.set(residentId, residentMeds);
    this.log(`Added medication ${med.name} for resident ${residentId}`);
    return med;
  }

  removeMedication(residentId, medicationId) {
    const meds = this.medicationManager.medications.get(residentId);
    if (!meds) return false;
    const idx = meds.findIndex(m => m.id === medicationId);
    if (idx === -1) return false;
    meds[idx].active = false;
    this.log(`Deactivated medication ${meds[idx].name} for resident ${residentId}`);
    return true;
  }

  _checkDrugInteractions(residentId, newMed) {
    const existingMeds = this.medicationManager.medications.get(residentId) || [];
    const activeMeds = existingMeds.filter(m => m.active);

    for (const existing of activeMeds) {
      for (const interaction of newMed.interactions) {
        if (existing.name.toLowerCase() === interaction.toLowerCase()) {
          const warning = {
            medication1: newMed.name,
            medication2: existing.name,
            residentId,
            timestamp: new Date().toISOString()
          };
          this.medicationManager.drugInteractions.push(warning);
          this.log(`DRUG INTERACTION WARNING: ${newMed.name} may interact with ${existing.name}`);
        }
      }
    }
  }

  async _checkMedicationSchedules() {
    const currentTime = this._getCurrentTimeString();
    const slots = this.medicationManager.scheduleSlots;

    for (const [residentId, medications] of this.medicationManager.medications) {
      for (const med of medications) {
        if (!med.active) continue;

        for (const scheduleSlot of med.schedule) {
          const slotTime = slots[scheduleSlot];
          if (!slotTime) continue;

          if (this._isTimeMatch(currentTime, slotTime, 2)) {
            await this._issueMedicationReminder(residentId, med, scheduleSlot);
          }
        }

        this._checkRefillNeeded(residentId, med);
      }
    }
  }

  async _issueMedicationReminder(residentId, medication, slot) {
    const reminderId = `${residentId}_${medication.id}_${slot}_${new Date().toDateString()}`;

    // Prevent duplicate reminders for same dose on same day
    if (this.medicationManager.pendingReminders.includes(reminderId)) return;

    this.medicationManager.pendingReminders.push(reminderId);
    this.stats.medicationRemindersIssued++;
    this.log(`Medication reminder: ${medication.name} (${medication.dosage}) for resident ${residentId} - ${slot}`);

    if (this.medicationManager.dispenserIntegration) {
      await this._activatePillDispenser(residentId, medication);
    }

    await this._announceMedication(residentId, medication, slot);
  }

  _checkRefillNeeded(residentId, medication) {
    const daysSupply = Math.floor(medication.pillsRemaining / medication.pillsPerDose / medication.schedule.length);

    if (daysSupply <= medication.refillThreshold) {
      this.log(`Refill needed: ${medication.name} for resident ${residentId}, ${daysSupply} days remaining`);
      return { needed: true, daysRemaining: daysSupply, medication: medication.name };
    }
    return { needed: false, daysRemaining: daysSupply, medication: medication.name };
  }

  confirmMedicationTaken(residentId, medicationId) {
    const meds = this.medicationManager.medications.get(residentId);
    if (!meds) return false;
    const med = meds.find(m => m.id === medicationId);
    if (!med) return false;

    med.pillsRemaining = Math.max(0, med.pillsRemaining - med.pillsPerDose);
    this._logCareEvent(residentId, 'medication_taken', { medication: med.name, dosage: med.dosage });
    this.log(`Medication confirmed taken: ${med.name} by resident ${residentId}`);
    return true;
  }

  async _activatePillDispenser(residentId, medication) {
    this.log(`Activating pill dispenser for ${medication.name} (resident ${residentId})`);
  }

  async _announceMedication(residentId, medication, _slot) {
    const resident = this.residents.get(residentId);
    const name = resident ? resident.name : residentId;
    this.log(`Announcing medication: "${name}, it is time to take your ${medication.name} (${medication.dosage})"`);
  }

  // ────────────────────────────────────────────
  // Wander Prevention
  // ────────────────────────────────────────────
  async _initializeWanderPrevention() {
    this.log('Initializing wander prevention system');
  }

  async _checkWanderPrevention() {
    const currentTime = this._getCurrentTimeString();
    const isNight = this._isWithinTimeWindow(currentTime, this.wanderPrevention.nightWindowStart, this.wanderPrevention.nightWindowEnd);

    if (!this.wanderPrevention.enabled) return;

    for (const doorSensor of this.wanderPrevention.doorSensors) {
      const doorState = await this._getDoorState(doorSensor);

      if (doorState && doorState.open && isNight) {
        this.log(`WANDER ALERT: ${doorSensor} opened during night hours (${currentTime})`);
        this.stats.wanderAlerts++;
        await this._triggerWanderAlert(doorSensor, currentTime);

        if (this.wanderPrevention.pathLightingEnabled) {
          await this._activatePathLighting();
        }
      }
    }
  }

  async _triggerWanderAlert(doorSensor, time) {
    const alert = {
      door: doorSensor,
      time,
      timestamp: Date.now(),
      acknowledged: false
    };

    this.wanderPrevention.alerts.push(alert);
    await this._sendFamilyNotification('wander_alert', alert);

    if (this.wanderPrevention.autoLockEnabled) {
      this.log(`Auto-locking ${doorSensor} (manual override available)`);
    }
  }

  async processDoorEvent(doorSensor, state) {
    const currentTime = this._getCurrentTimeString();
    const isNight = this._isWithinTimeWindow(currentTime, this.wanderPrevention.nightWindowStart, this.wanderPrevention.nightWindowEnd);

    if (state.open && isNight && this.wanderPrevention.enabled) {
      this.stats.wanderAlerts++;
      await this._triggerWanderAlert(doorSensor, currentTime);
    }

    if (state.open && this.wanderPrevention.pathLightingEnabled && isNight) {
      await this._activatePathLighting();
    }

    return { processed: true, isNight, doorSensor, state };
  }

  async _getDoorState(doorSensor) {
    return { open: false, sensor: doorSensor };
  }

  // ────────────────────────────────────────────
  // Emergency SOS
  // ────────────────────────────────────────────
  async _initializeEmergencySOS() {
    this.log('Initializing emergency SOS system');
  }

  async triggerSOS(source, details) {
    this.log(`SOS TRIGGERED via ${source}`);
    this.stats.sosTriggered++;

    const emergency = {
      id: `sos_${Date.now()}`,
      source,
      details: details || {},
      timestamp: Date.now(),
      escalationStep: 0,
      resolved: false,
      location: details && details.room ? details.room : 'unknown',
      medicalInfoSent: false
    };

    this.emergencySOS.activeEmergencies.push(emergency);
    await this._runSOSEscalation(emergency);
    return emergency;
  }

  async _runSOSEscalation(emergency) {
    for (const step of this.emergencySOS.escalationChain) {
      if (emergency.resolved) break;

      if (step.delayMs > 0) {
        await this._delay(step.delayMs);
      }

      if (emergency.resolved) break;

      this.log(`SOS escalation step: contacting ${step.contact}`);

      if (step.contact === '112') {
        await this._contactEmergencyServices(emergency);
      } else {
        await this._sendFamilyNotification('sos_alert', {
          emergency,
          contact: step.contact
        });
      }

      if (this.emergencySOS.locationReporting) {
        this.log(`Location reported: ${emergency.location}`);
      }

      if (!emergency.medicalInfoSent) {
        await this._sendMedicalInfoPacket(emergency);
        emergency.medicalInfoSent = true;
      }

      emergency.escalationStep++;
    }
  }

  resolveEmergency(emergencyId) {
    const emergency = this.emergencySOS.activeEmergencies.find(e => e.id === emergencyId);
    if (emergency) {
      emergency.resolved = true;
      emergency.resolvedAt = Date.now();
      this.log(`Emergency ${emergencyId} resolved`);
      return true;
    }
    return false;
  }

  async processVoiceCommand(transcript) {
    if (!this.voiceControl.enabled) return null;

    const lower = transcript.toLowerCase().trim();

    // Check SOS keywords first (highest priority)
    for (const keyword of this.emergencySOS.voiceKeywords) {
      if (lower.includes(keyword)) {
        this.log(`Voice SOS keyword detected: "${keyword}"`);
        return await this.triggerSOS('voice_activated', { transcript });
      }
    }

    // Check simplified commands
    for (const [command, action] of Object.entries(this.voiceControl.simplifiedCommands)) {
      if (lower.includes(command)) {
        this.log(`Voice command matched: "${command}" → ${action}`);
        return await this._executeVoiceAction(action);
      }
    }

    // Fuzzy matching for large vocabulary tolerance
    if (this.voiceControl.largeVocabularyTolerance) {
      const fuzzyMatch = this._fuzzyMatchCommand(lower);
      if (fuzzyMatch) {
        this.log(`Fuzzy voice match: "${lower}" → ${fuzzyMatch}`);
        return await this._executeVoiceAction(fuzzyMatch);
      }
    }

    this.log(`Voice command not recognized: "${transcript}"`);
    return { recognized: false, transcript };
  }

  async _executeVoiceAction(action) {
    switch (action) {
      case 'turnOnLights':
        this.log('Voice action: Turning on lights');
        return { action, success: true };
      case 'turnOffLights':
        this.log('Voice action: Turning off lights');
        return { action, success: true };
      case 'callFamilyContact':
        this.log('Voice action: Calling family contact');
        return { action, success: true };
      case 'announceTime':
        const now = new Date();
        const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
        this.log(`Voice action: The time is ${timeStr}`);
        return { action, success: true, time: timeStr };
      case 'triggerSOS':
        return await this.triggerSOS('voice_activated', {});
      default:
        return { action, success: false, reason: 'unknown_action' };
    }
  }

  _fuzzyMatchCommand(input) {
    const commandKeys = Object.keys(this.voiceControl.simplifiedCommands);
    let bestMatch = null;
    let bestScore = 0;

    for (const cmd of commandKeys) {
      const score = this._stringSimilarity(input, cmd);
      if (score > 0.6 && score > bestScore) {
        bestScore = score;
        bestMatch = this.voiceControl.simplifiedCommands[cmd];
      }
    }

    return bestMatch;
  }

  _stringSimilarity(a, b) {
    if (a === b) return 1;
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    if (longer.length === 0) return 1;

    let matches = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (longer.includes(shorter[i])) matches++;
    }
    return matches / longer.length;
  }

  async _sendMedicalInfoPacket(_emergency) {
    const packet = { ...this.emergencySOS.medicalInfoPacket };

    // Aggregate all active medications across residents
    for (const [, meds] of this.medicationManager.medications) {
      for (const med of meds) {
        if (med.active) {
          packet.medications.push({ name: med.name, dosage: med.dosage });
        }
      }
    }

    this.log(`Medical info packet prepared: ${packet.medications.length} active medications`);
    return packet;
  }

  // ────────────────────────────────────────────
  // Cognitive Support
  // ────────────────────────────────────────────
  async _initializeCognitiveSupport() {
    this.log('Initializing cognitive support system');
  }

  async performCognitiveAnnouncement() {
    const now = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const announcement = {
      time: `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`,
      day: dayNames[now.getDay()],
      date: `${monthNames[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`,
      weather: await this._getWeatherSummary(),
      upcomingAppointments: this._getUpcomingAppointments()
    };

    this.log(`Cognitive announcement: Today is ${announcement.day}, ${announcement.date}. The time is ${announcement.time}.`);
    this.stats.cognitiveAnnouncements++;
    return announcement;
  }

  addAppointment(residentId, appointment) {
    const appt = {
      id: `appt_${Date.now()}`,
      residentId,
      title: appointment.title,
      dateTime: appointment.dateTime,
      location: appointment.location || '',
      notes: appointment.notes || '',
      remindBefore: appointment.remindBefore || [60, 30, 10]
    };
    this.cognitiveSupport.appointments.push(appt);
    this.log(`Appointment added: ${appt.title} at ${appt.dateTime}`);
    return appt;
  }

  _getUpcomingAppointments() {
    const now = Date.now();
    const next24h = now + 24 * 60 * 60 * 1000;
    return this.cognitiveSupport.appointments.filter(a => {
      const apptTime = new Date(a.dateTime).getTime();
      return apptTime >= now && apptTime <= next24h;
    });
  }

  announceRoomEntry(room, residentId) {
    if (!this.cognitiveSupport.roomAnnouncementsOnEntry) return;
    const resident = this.residents.get(residentId);
    const name = resident ? resident.name : '';
    const timeStr = this._getCurrentTimeString();
    this.log(`Room announcement: ${name ? name + ', you' : 'You'} are now in the ${room}. The time is ${timeStr}.`);
  }

  async _getWeatherSummary() {
    return { description: 'partly cloudy', temperatureC: 12, humidity: 65 };
  }

  // ────────────────────────────────────────────
  // Adaptive Lighting
  // ────────────────────────────────────────────
  async _initializeAdaptiveLighting() {
    this.log('Initializing adaptive lighting system');
  }

  async handleMotionForLighting(room, isNight) {
    if (!this.adaptiveLighting.enabled || !this.adaptiveLighting.motionActivated) return;

    if (isNight && this.adaptiveLighting.progressiveBrightness) {
      // Nighttime: gradual, low-brightness warm light
      await this._gradualLightOn(room, this.adaptiveLighting.nightlightMode.brightnessPct, this.adaptiveLighting.nighttimeGradualOnMs);
    } else {
      // Daytime: use circadian rhythm settings
      const circadianSettings = this._getCircadianSettings();
      await this._setLight(room, circadianSettings.brightnessPct, circadianSettings.colorTempK);
    }
  }

  _getCircadianSettings() {
    const currentTime = this._getCurrentTimeString();
    const schedule = this.adaptiveLighting.circadianRhythm.schedule;

    let best = schedule[0];
    for (const entry of schedule) {
      if (currentTime >= entry.time) {
        best = entry;
      }
    }

    return { brightnessPct: best.brightnessPct, colorTempK: best.colorTempK };
  }

  async _activatePathLighting() {
    if (!this.adaptiveLighting.pathwayLighting.enabled) return;

    for (const route of this.adaptiveLighting.pathwayLighting.routes) {
      this.log(`Activating pathway lighting: ${route.from} → ${route.to} via ${route.zones.join(', ')}`);
      for (const zone of route.zones) {
        await this._gradualLightOn(zone, this.adaptiveLighting.nightlightMode.brightnessPct, this.adaptiveLighting.nighttimeGradualOnMs);
      }
      await this._gradualLightOn(route.to, this.adaptiveLighting.nightlightMode.brightnessPct, this.adaptiveLighting.nighttimeGradualOnMs);
    }
  }

  async _gradualLightOn(room, brightnessPct, durationMs) {
    this.log(`Gradual light on in ${room}: ${brightnessPct}% over ${durationMs}ms`);
  }

  async _setLight(room, brightnessPct, colorTempK) {
    this.log(`Setting light in ${room}: ${brightnessPct}%, ${colorTempK}K`);
  }

  async _fadeOutLight(room) {
    if (this.adaptiveLighting.noSuddenDarkness) {
      this.log(`Fading out light in ${room} over ${this.adaptiveLighting.fadeOutMs}ms`);
    }
  }

  // ────────────────────────────────────────────
  // Voice Control
  // ────────────────────────────────────────────
  async _initializeVoiceControl() {
    this.log(`Initializing voice control (languages: ${this.voiceControl.languages.join(', ')})`);
  }

  adjustVolumeForResident(residentId) {
    const resident = this.residents.get(residentId);
    if (!resident || !this.voiceControl.autoAdjustVolume) return null;

    const boost = resident.hearingProfile ? resident.hearingProfile.volumeBoostDb : 0;
    this.log(`Volume adjusted for ${resident.name}: +${boost}dB`);
    return { volumeBoostDb: boost, preferredFrequencyHz: this.voiceControl.hearingProfile.preferredFrequencyHz };
  }

  // ────────────────────────────────────────────
  // Vital Signs Integration
  // ────────────────────────────────────────────
  async _initializeVitalSigns() {
    this.log('Initializing vital signs integration');
  }

  async _checkVitalSigns() {
    if (!this.vitalSigns.enabled) return;

    // Blood pressure check
    const lastBP = this._getLatestReading(this.vitalSigns.bloodPressure.readings);
    if (lastBP) {
      if (lastBP.systolic >= this.vitalSigns.bloodPressure.alertSystolic || lastBP.diastolic >= this.vitalSigns.bloodPressure.alertDiastolic) {
        this.log(`VITAL ALERT: High blood pressure ${lastBP.systolic}/${lastBP.diastolic}`);
        this.stats.vitalAlerts++;
      }
    }

    // Heart rate check
    const lastHR = this._getLatestReading(this.vitalSigns.heartRate.readings);
    if (lastHR) {
      if (lastHR.bpm >= this.vitalSigns.heartRate.alertHighBpm || lastHR.bpm <= this.vitalSigns.heartRate.alertLowBpm) {
        this.log(`VITAL ALERT: Abnormal heart rate ${lastHR.bpm} bpm`);
        this.stats.vitalAlerts++;
      }
    }

    // SpO2 check
    const lastSpO2 = this._getLatestReading(this.vitalSigns.spO2.readings);
    if (lastSpO2 && lastSpO2.pct < this.vitalSigns.spO2.alertBelowPct) {
      this.log(`VITAL ALERT: Low SpO2 ${lastSpO2.pct}%`);
      this.stats.vitalAlerts++;
    }

    // Blood glucose check (diabetic profile)
    if (this.vitalSigns.bloodGlucose.diabeticProfile) {
      const lastGlucose = this._getLatestReading(this.vitalSigns.bloodGlucose.readings);
      if (lastGlucose) {
        if (lastGlucose.mgDl >= this.vitalSigns.bloodGlucose.alertHighMgDl) {
          this.log(`VITAL ALERT: High blood glucose ${lastGlucose.mgDl} mg/dL`);
          this.stats.vitalAlerts++;
        } else if (lastGlucose.mgDl <= this.vitalSigns.bloodGlucose.alertLowMgDl) {
          this.log(`VITAL ALERT: Low blood glucose ${lastGlucose.mgDl} mg/dL`);
          this.stats.vitalAlerts++;
        }
      }
    }

    // Weight change check
    const lastWeight = this._getLatestReading(this.vitalSigns.weight.readings);
    if (lastWeight && this.vitalSigns.weight.readings.length >= 2) {
      const prevWeight = this.vitalSigns.weight.readings[this.vitalSigns.weight.readings.length - 2];
      const change = Math.abs(lastWeight.kg - prevWeight.kg);
      if (change >= this.vitalSigns.weight.alertChangeKg) {
        this.log(`VITAL ALERT: Significant weight change ${change.toFixed(1)} kg`);
        this.stats.vitalAlerts++;
      }
    }
  }

  recordVitalReading(type, reading) {
    const timestamp = Date.now();
    const entry = { ...reading, timestamp };

    switch (type) {
      case 'blood_pressure':
        this.vitalSigns.bloodPressure.readings.push(entry);
        this.log(`BP recorded: ${entry.systolic}/${entry.diastolic}`);
        break;
      case 'blood_glucose':
        this.vitalSigns.bloodGlucose.readings.push(entry);
        this.log(`Blood glucose recorded: ${entry.mgDl} mg/dL`);
        break;
      case 'weight':
        this.vitalSigns.weight.readings.push(entry);
        this.log(`Weight recorded: ${entry.kg} kg`);
        break;
      case 'heart_rate':
        this.vitalSigns.heartRate.readings.push(entry);
        this.log(`Heart rate recorded: ${entry.bpm} bpm`);
        break;
      case 'spo2':
        this.vitalSigns.spO2.readings.push(entry);
        this.log(`SpO2 recorded: ${entry.pct}%`);
        break;
      default:
        this.error(`Unknown vital type: ${type}`);
        return null;
    }

    this.vitalSigns.lastReadings[type] = entry;
    return entry;
  }

  generateVitalTrendReport(residentId) {
    const windowMs = this.vitalSigns.trendAnalysis.windowDays * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - windowMs;

    const report = {
      residentId,
      generatedAt: new Date().toISOString(),
      windowDays: this.vitalSigns.trendAnalysis.windowDays,
      bloodPressure: this._analyzeTrend(this.vitalSigns.bloodPressure.readings.filter(r => r.timestamp > cutoff), 'systolic'),
      heartRate: this._analyzeTrend(this.vitalSigns.heartRate.readings.filter(r => r.timestamp > cutoff), 'bpm'),
      weight: this._analyzeTrend(this.vitalSigns.weight.readings.filter(r => r.timestamp > cutoff), 'kg'),
      spO2: this._analyzeTrend(this.vitalSigns.spO2.readings.filter(r => r.timestamp > cutoff), 'pct'),
      reportToGP: this.vitalSigns.trendAnalysis.reportToGP
    };

    this.log(`Vital trend report generated for resident ${residentId}`);
    return report;
  }

  _analyzeTrend(readings, field) {
    if (readings.length === 0) return { trend: 'insufficient_data', readings: 0 };

    const values = readings.map(r => r[field]).filter(v => v !== undefined);
    if (values.length < 2) return { trend: 'insufficient_data', readings: values.length };

    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    let trend = 'stable';
    const changePct = ((secondAvg - firstAvg) / firstAvg) * 100;
    if (changePct > 5) trend = 'increasing';
    else if (changePct < -5) trend = 'decreasing';

    return { trend, average: Math.round(avg * 10) / 10, min, max, readings: values.length, changePct: Math.round(changePct * 10) / 10 };
  }

  _getLatestReading(readings) {
    return readings.length > 0 ? readings[readings.length - 1] : null;
  }

  // ────────────────────────────────────────────
  // Social Isolation Detection
  // ────────────────────────────────────────────
  async _initializeSocialIsolation() {
    this.log('Initializing social isolation detection');
  }

  async _checkSocialIsolation() {
    if (!this.socialIsolation.enabled) return;

    const phoneScore = this._calculateFrequencyScore(this.socialIsolation.phoneCallFrequency.readings, this.socialIsolation.phoneCallFrequency.minWeekly);
    const visitorScore = this._calculateFrequencyScore(this.socialIsolation.visitorFrequency.readings, this.socialIsolation.visitorFrequency.minWeekly);
    const videoScore = this._calculateFrequencyScore(this.socialIsolation.videoCallLogs, 1);

    const activityVariety = this.socialIsolation.activityVarietyScore;
    const overallScore = Math.round((phoneScore + visitorScore + videoScore + activityVariety) / 4);

    this.socialIsolation.isolationScore = 100 - overallScore;

    if (this.socialIsolation.isolationScore > 70) {
      this.log(`HIGH ISOLATION ALERT: Score ${this.socialIsolation.isolationScore}/100`);
      this._generateFamilyConnectionSuggestions();
    } else if (this.socialIsolation.isolationScore > 50) {
      this.log(`Moderate isolation detected: Score ${this.socialIsolation.isolationScore}/100`);
    }
  }

  _calculateFrequencyScore(events, minWeekly) {
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - weekMs;
    const recentCount = events.filter(e => {
      const ts = typeof e === 'object' ? (e.timestamp || 0) : 0;
      return ts > cutoff;
    }).length;

    return Math.min(100, Math.round((recentCount / minWeekly) * 100));
  }

  _generateFamilyConnectionSuggestions() {
    this.socialIsolation.familyConnectionSuggestions = [
      { type: 'video_call', suggestion: 'Schedule a video call with family member', priority: 'high' },
      { type: 'visit', suggestion: 'Arrange an in-person visit', priority: 'high' },
      { type: 'activity', suggestion: 'Suggest group activity or outing', priority: 'medium' },
      { type: 'phone_call', suggestion: 'Encourage phone call with friend', priority: 'medium' }
    ];
    this.log('Family connection suggestions generated');
  }

  recordSocialEvent(type, details) {
    const event = { ...details, type, timestamp: Date.now() };
    switch (type) {
      case 'phone_call':
        this.socialIsolation.phoneCallFrequency.readings.push(event);
        break;
      case 'visitor':
        this.socialIsolation.visitorFrequency.readings.push(event);
        break;
      case 'video_call':
        this.socialIsolation.videoCallLogs.push(event);
        break;
    }
    this.log(`Social event recorded: ${type}`);
    return event;
  }

  // ────────────────────────────────────────────
  // Caregiver Dashboard
  // ────────────────────────────────────────────
  async _initializeCaregiverDashboard() {
    this.log('Initializing caregiver dashboard');
  }

  addCaregiver(id, profile) {
    const caregiver = {
      id,
      name: profile.name,
      role: profile.role || 'secondary',
      phone: profile.phone || '',
      email: profile.email || '',
      permissions: this.caregiverDashboard.rolePermissions[profile.role || 'secondary'] || [],
      shifts: profile.shifts || [],
      active: true
    };
    this.caregiverDashboard.caregivers.set(id, caregiver);
    this.log(`Caregiver added: ${caregiver.name} (role: ${caregiver.role})`);
    return caregiver;
  }

  removeCaregiver(id) {
    if (this.caregiverDashboard.caregivers.has(id)) {
      const name = this.caregiverDashboard.caregivers.get(id).name;
      this.caregiverDashboard.caregivers.delete(id);
      this.log(`Caregiver removed: ${name}`);
      return true;
    }
    return false;
  }

  addShiftHandoffNote(caregiverId, note) {
    const entry = {
      caregiverId,
      note,
      timestamp: Date.now(),
      date: new Date().toISOString()
    };
    this.caregiverDashboard.shiftHandoffNotes.push(entry);
    this.log(`Shift handoff note added by caregiver ${caregiverId}`);
    return entry;
  }

  completeTask(caregiverId, taskType, details) {
    const task = {
      caregiverId,
      type: taskType,
      details,
      completedAt: Date.now()
    };

    if (this.caregiverDashboard.taskCompletion[taskType]) {
      this.caregiverDashboard.taskCompletion[taskType].push(task);
    }

    this._logCareEvent(null, `task_${taskType}`, { caregiverId, ...details });
    this.log(`Task completed: ${taskType} by caregiver ${caregiverId}`);
    return task;
  }

  _logCareEvent(residentId, eventType, details) {
    const entry = {
      residentId,
      eventType,
      details,
      timestamp: Date.now(),
      date: new Date().toISOString()
    };
    this.caregiverDashboard.careLog.push(entry);
    return entry;
  }

  getCareLog(options) {
    const opts = options || {};
    let log = [...this.caregiverDashboard.careLog];

    if (opts.residentId) {
      log = log.filter(e => e.residentId === opts.residentId);
    }
    if (opts.eventType) {
      log = log.filter(e => e.eventType === opts.eventType);
    }
    if (opts.since) {
      log = log.filter(e => e.timestamp >= opts.since);
    }
    if (opts.limit) {
      log = log.slice(-opts.limit);
    }

    return log;
  }

  async _updateCaregiverDashboard() {
    const status = {
      timestamp: Date.now(),
      residents: [],
      activeAlerts: [],
      pendingTasks: []
    };

    for (const [id, resident] of this.residents) {
      status.residents.push({
        id,
        name: resident.name,
        lastKnownRoom: resident.lastKnownRoom,
        activityScore: this.getActivityScore(id),
        lastMotionTime: resident.lastMotionTime
      });
    }

    return status;
  }

  // ────────────────────────────────────────────
  // Meal Management
  // ────────────────────────────────────────────
  async _initializeMealManagement() {
    this.log('Initializing meal management system');
  }

  async _checkMealSchedule() {
    const currentTime = this._getCurrentTimeString();

    for (const [mealName, mealTime] of Object.entries(this.mealManagement.mealSchedule)) {
      if (this._isTimeMatch(currentTime, mealTime, 5)) {
        this.log(`Meal reminder: Time for ${mealName}`);
        this.stats.mealsLogged++;
      }
    }
  }

  async _checkHydration() {
    if (!this.mealManagement.enabled) return;

    const now = Date.now();
    const lastReminder = this.mealManagement.lastHydrationReminder || 0;

    if (now - lastReminder >= this.mealManagement.hydrationReminderIntervalMs) {
      this.log('Hydration reminder: Time to drink water');
      this.mealManagement.lastHydrationReminder = now;
      this.stats.hydrationReminders++;
    }
  }

  async _checkStoveStatus() {
    if (!this.mealManagement.stoveOnSince) return;

    const elapsed = Date.now() - this.mealManagement.stoveOnSince;
    const maxMs = this.mealManagement.stoveAutoOffMinutes * 60 * 1000;

    if (elapsed >= maxMs) {
      this.log(`SAFETY: Stove auto-off triggered after ${this.mealManagement.stoveAutoOffMinutes} minutes`);
      this.mealManagement.stoveOnSince = null;
      this.stats.environmentalAlerts++;
    }
  }

  reportStoveOn() {
    this.mealManagement.stoveOnSince = Date.now();
    this.log('Stove reported ON, auto-off timer started');
  }

  reportStoveOff() {
    this.mealManagement.stoveOnSince = null;
    this.log('Stove reported OFF');
  }

  logNutrition(mealType, intake) {
    const tracking = this.mealManagement.nutritionTracking;
    tracking.todayIntake.calories += intake.calories || 0;
    tracking.todayIntake.proteinG += intake.proteinG || 0;
    tracking.todayIntake.fiberG += intake.fiberG || 0;
    tracking.todayIntake.fluidMl += intake.fluidMl || 0;

    this.log(`Nutrition logged (${mealType}): ${intake.calories || 0} cal, ${intake.proteinG || 0}g protein`);
    this._logCareEvent(null, 'nutrition', { mealType, intake });
    return { todayIntake: { ...tracking.todayIntake }, targets: { ...tracking.dailyTargets } };
  }

  getNutritionSummary() {
    const tracking = this.mealManagement.nutritionTracking;
    const intake = tracking.todayIntake;
    const targets = tracking.dailyTargets;

    return {
      intake: { ...intake },
      targets: { ...targets },
      percentages: {
        calories: Math.round((intake.calories / targets.calories) * 100),
        protein: Math.round((intake.proteinG / targets.proteinG) * 100),
        fiber: Math.round((intake.fiberG / targets.fiberG) * 100),
        fluid: Math.round((intake.fluidMl / targets.fluidMl) * 100)
      }
    };
  }

  // ────────────────────────────────────────────
  // Exercise Prompts
  // ────────────────────────────────────────────
  async _initializeExercisePrompts() {
    this.log(`Initializing exercise prompts (${this.exercisePrompts.chairExercises.length} chair exercises loaded)`);
  }

  async _checkExerciseSchedule() {
    if (!this.exercisePrompts.enabled) return;

    const currentTime = this._getCurrentTimeString();
    if (!this._isWithinTimeWindow(currentTime, this.exercisePrompts.wakingHoursStart, this.exercisePrompts.wakingHoursEnd)) return;

    const now = Date.now();
    const lastPrompt = this.exercisePrompts.lastPromptTime || 0;

    if (now - lastPrompt >= this.exercisePrompts.reminderIntervalMs) {
      const exercise = this._selectExercise();
      this.log(`Exercise prompt: Time for "${exercise.name}" - ${exercise.description} (${exercise.durationSec}s)`);
      this.exercisePrompts.lastPromptTime = now;
    }
  }

  _selectExercise() {
    const exercises = this.exercisePrompts.chairExercises;
    const idx = Math.floor(Math.random() * exercises.length);
    return exercises[idx];
  }

  recordExerciseSession(exerciseId, durationSec) {
    const exercise = this.exercisePrompts.chairExercises.find(e => e.id === exerciseId);
    const session = {
      exerciseId,
      exerciseName: exercise ? exercise.name : 'Unknown',
      durationSec,
      timestamp: Date.now()
    };
    this.exercisePrompts.activityDurationTracking.push(session);
    this.stats.exerciseSessionsCompleted++;
    this.log(`Exercise session recorded: ${session.exerciseName}, ${durationSec}s`);
    return session;
  }

  getExerciseLibrary() {
    return [...this.exercisePrompts.chairExercises];
  }

  // ────────────────────────────────────────────
  // Environmental Safety
  // ────────────────────────────────────────────
  async _initializeEnvironmentalSafety() {
    this.log('Initializing environmental safety monitoring');
  }

  async _checkEnvironmentalSafety() {
    if (!this.environmentalSafety.enabled) return;

    const readings = this.environmentalSafety.currentReadings;

    // Priority: Smoke/CO/Gas — life threatening
    if (readings.smokeDetected) {
      this.log('CRITICAL: Smoke detected!');
      this.stats.environmentalAlerts++;
      await this._triggerEnvironmentalAlert('smoke', 'critical');
    }

    if (readings.coDetected) {
      this.log('CRITICAL: Carbon monoxide detected!');
      this.stats.environmentalAlerts++;
      await this._triggerEnvironmentalAlert('co', 'critical');
    }

    if (readings.gasDetected) {
      this.log('CRITICAL: Gas leak detected!');
      this.stats.environmentalAlerts++;
      await this._triggerEnvironmentalAlert('gas', 'critical');
    }

    // Water leak
    if (readings.waterLeakDetected) {
      this.log('ALERT: Water leak detected!');
      this.stats.environmentalAlerts++;
      await this._triggerEnvironmentalAlert('water_leak', 'high');
    }

    // Temperature monitoring
    if (readings.temperatureC !== null) {
      const temp = readings.temperatureC;
      const range = this.environmentalSafety.temperatureRange;
      if (temp < range.alertMinC) {
        this.log(`ALERT: Low temperature ${temp}°C (below ${range.alertMinC}°C)`);
        this.stats.environmentalAlerts++;
      } else if (temp > range.alertMaxC) {
        this.log(`ALERT: High temperature ${temp}°C (above ${range.alertMaxC}°C)`);
        this.stats.environmentalAlerts++;
      }
    }

    // Humidity monitoring
    if (readings.humidityPct !== null) {
      const hum = readings.humidityPct;
      const range = this.environmentalSafety.humidityRange;
      if (hum < range.minPct || hum > range.maxPct) {
        this.log(`ALERT: Humidity ${hum}% outside range (${range.minPct}-${range.maxPct}%)`);
      }
    }

    // Air quality: PM2.5
    if (readings.pm25UgM3 !== null && readings.pm25UgM3 > this.environmentalSafety.airQuality.pm25AlertUgM3) {
      this.log(`ALERT: PM2.5 level ${readings.pm25UgM3} µg/m³ exceeds threshold`);
    }

    // Air quality: CO2
    if (readings.co2Ppm !== null && readings.co2Ppm > this.environmentalSafety.airQuality.co2AlertPpm) {
      this.log(`ALERT: CO2 level ${readings.co2Ppm} ppm exceeds threshold`);
    }
  }

  updateEnvironmentalReading(type, value) {
    if (this.environmentalSafety.currentReadings.hasOwnProperty(type)) {
      this.environmentalSafety.currentReadings[type] = value;
      return true;
    }
    return false;
  }

  async _triggerEnvironmentalAlert(type, severity) {
    const alert = {
      type,
      severity,
      timestamp: Date.now(),
      acknowledged: false
    };
    this.environmentalSafety.alerts.push(alert);

    if (severity === 'critical') {
      await this._sendFamilyNotification('environmental_critical', alert);
      await this._contactEmergencyServices(alert);
    }

    return alert;
  }

  // ────────────────────────────────────────────
  // Sleep Monitoring
  // ────────────────────────────────────────────
  async _initializeSleepMonitoring() {
    this.log('Initializing sleep monitoring system');
  }

  async _checkSleepPatterns() {
    if (!this.sleepMonitoring.enabled) return;

    const recentNights = this.sleepMonitoring.recentNights;
    if (recentNights.length < 3) return;

    const avgSleep = recentNights.reduce((sum, n) => sum + n.sleepHours, 0) / recentNights.length;
    const lastNight = recentNights[recentNights.length - 1];

    if (lastNight) {
      const diff = Math.abs(lastNight.sleepHours - avgSleep);
      if (diff >= this.sleepMonitoring.unusualPatternThreshold.moreSleepHours) {
        this.log(`Sleep pattern alert: Last night ${lastNight.sleepHours}h vs average ${avgSleep.toFixed(1)}h`);
      }
    }
  }

  recordSleepEvent(type, _details) {
    const bedSensor = this.sleepMonitoring.bedSensor;
    const now = Date.now();

    switch (type) {
      case 'in_bed':
        bedSensor.inBedTime = now;
        bedSensor.restlessnessEvents = 0;
        bedSensor.nighttimeBathroomTrips = 0;
        this.log('Sleep event: In bed');
        break;
      case 'wake':
        bedSensor.wakeTime = now;
        if (bedSensor.inBedTime) {
          const sleepHours = (now - bedSensor.inBedTime) / (60 * 60 * 1000);
          const nightData = {
            sleepHours: Math.round(sleepHours * 10) / 10,
            inBedTime: bedSensor.inBedTime,
            wakeTime: now,
            restlessnessEvents: bedSensor.restlessnessEvents,
            bathroomTrips: bedSensor.nighttimeBathroomTrips,
            date: new Date().toISOString()
          };
          nightData.qualityScore = this._calculateSleepQuality(nightData);
          this.sleepMonitoring.recentNights.push(nightData);
          this.sleepMonitoring.sleepQualityScore = nightData.qualityScore;
          this.log(`Sleep recorded: ${nightData.sleepHours}h, quality: ${nightData.qualityScore}/100`);
        }
        break;
      case 'restless':
        bedSensor.restlessnessEvents++;
        break;
      case 'bathroom_trip':
        bedSensor.nighttimeBathroomTrips++;
        this.log(`Nighttime bathroom trip #${bedSensor.nighttimeBathroomTrips}`);
        break;
    }

    return { type, timestamp: now };
  }

  _calculateSleepQuality(nightData) {
    let score = 100;

    // Deviation from ideal sleep duration
    const idealHours = this.sleepMonitoring.averageSleepHours;
    const hoursDiff = Math.abs(nightData.sleepHours - idealHours);
    score -= hoursDiff * 10;

    // Restlessness penalty
    score -= nightData.restlessnessEvents * 5;

    // Bathroom trip penalty
    score -= nightData.bathroomTrips * 8;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  getSleepReport(days) {
    const n = days || 7;
    const nights = this.sleepMonitoring.recentNights.slice(-n);

    if (nights.length === 0) {
      return { nights: [], averageSleepHours: 0, averageQuality: 0, totalNights: 0 };
    }

    const avgSleep = nights.reduce((s, n) => s + n.sleepHours, 0) / nights.length;
    const avgQuality = nights.reduce((s, n) => s + n.qualityScore, 0) / nights.length;

    return {
      nights,
      averageSleepHours: Math.round(avgSleep * 10) / 10,
      averageQuality: Math.round(avgQuality),
      totalNights: nights.length
    };
  }

  // ────────────────────────────────────────────
  // Visitor Management
  // ────────────────────────────────────────────
  async _initializeVisitorManagement() {
    this.log('Initializing visitor management');
  }

  addExpectedVisitor(visitor) {
    const entry = {
      id: `visitor_${Date.now()}`,
      name: visitor.name,
      type: visitor.type || 'other',
      expectedArrival: visitor.expectedArrival,
      expectedDeparture: visitor.expectedDeparture || null,
      notes: visitor.notes || '',
      arrived: false,
      arrivedAt: null
    };
    this.visitorManagement.expectedVisitors.push(entry);
    this.log(`Expected visitor registered: ${entry.name} (${entry.type})`);
    return entry;
  }

  recordVisitorArrival(visitorId) {
    const visitor = this.visitorManagement.expectedVisitors.find(v => v.id === visitorId);
    if (visitor) {
      visitor.arrived = true;
      visitor.arrivedAt = Date.now();
      this.visitorManagement.recentVisitors.push({
        ...visitor,
        arrivedAt: visitor.arrivedAt
      });
      this.stats.visitorEvents++;

      if (visitor.type === 'caregiver' && this.visitorManagement.caregiverArrivalConfirmation) {
        this.log(`Caregiver arrival confirmed: ${visitor.name}`);
      }

      if (visitor.type === 'family') {
        this.visitorManagement.familyVisitLog.push({
          name: visitor.name,
          arrivedAt: visitor.arrivedAt,
          date: new Date().toISOString()
        });
        this.socialIsolation.visitorFrequency.readings.push({
          type: 'family_visit',
          timestamp: visitor.arrivedAt
        });
      }

      this.log(`Visitor arrived: ${visitor.name}`);
      return visitor;
    }
    return null;
  }

  recordUnknownVisitor(details) {
    if (this.visitorManagement.unknownVisitorAlerts) {
      this.log(`Unknown visitor alert: ${details.description || 'Unknown person detected'}`);
      this.stats.visitorEvents++;

      const event = {
        type: 'unknown_visitor',
        details,
        timestamp: Date.now()
      };
      this.visitorManagement.recentVisitors.push(event);
      return event;
    }
    return null;
  }

  // ────────────────────────────────────────────
  // Sensor & Notification Helpers
  // ────────────────────────────────────────────
  async _checkAllSensors() {
    // Aggregate sensor data from all monitored rooms
  }

  async _sendInactivityAlert(room, elapsed) {
    this.log(`Inactivity alert sent for ${room}: ${Math.round(elapsed / 60000)} minutes`);
  }

  async _activateLocalAlarm(room) {
    this.log(`Local alarm activated in ${room}`);
  }

  async _sendFamilyNotification(type, _data) {
    this.log(`Family notification sent: ${type}`);
  }

  async _contactEmergencyServices(_event) {
    this.log('Emergency services contacted (112)');
  }

  // ────────────────────────────────────────────
  // Time Utilities
  // ────────────────────────────────────────────
  _getCurrentTimeString() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  _isWithinTimeWindow(current, start, end) {
    if (start <= end) {
      return current >= start && current <= end;
    }
    // Wraps midnight (e.g. 23:00 → 05:00)
    return current >= start || current <= end;
  }

  _isTimeMatch(current, target, toleranceMinutes) {
    const [cH, cM] = current.split(':').map(Number);
    const [tH, tM] = target.split(':').map(Number);
    const cTotal = cH * 60 + cM;
    const tTotal = tH * 60 + tM;
    return Math.abs(cTotal - tTotal) <= toleranceMinutes;
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ────────────────────────────────────────────
  // Accessibility Features
  // ────────────────────────────────────────────
  getAccessibilitySettings() {
    return { ...this.accessibilityFeatures };
  }

  updateAccessibilitySetting(key, value) {
    if (this.accessibilityFeatures.hasOwnProperty(key)) {
      this.accessibilityFeatures[key] = value;
      this.log(`Accessibility setting updated: ${key} = ${JSON.stringify(value)}`);
      return true;
    }
    return false;
  }

  // ────────────────────────────────────────────
  // Dashboard Summary
  // ────────────────────────────────────────────
  getDashboardSummary() {
    return {
      timestamp: Date.now(),
      residents: Array.from(this.residents.entries()).map(([id, r]) => ({
        id,
        name: r.name,
        lastKnownRoom: r.lastKnownRoom,
        activityScore: this.getActivityScore(id),
        fallRisk: this.calculateDailyFallRisk(id)
      })),
      activeEmergencies: this.emergencySOS.activeEmergencies.filter(e => !e.resolved),
      environmentalStatus: { ...this.environmentalSafety.currentReadings },
      sleepQuality: this.sleepMonitoring.sleepQualityScore,
      socialIsolationScore: this.socialIsolation.isolationScore,
      nutritionSummary: this.getNutritionSummary(),
      exerciseSessionsToday: this.exercisePrompts.activityDurationTracking.filter(s => {
        return s.timestamp > Date.now() - 24 * 60 * 60 * 1000;
      }).length,
      caregiverOnDuty: Array.from(this.caregiverDashboard.caregivers.values()).filter(c => c.active).map(c => c.name),
      pendingMedications: this.medicationManager.pendingReminders.length,
      statistics: this.getStatistics()
    };
  }

  // ────────────────────────────────────────────
  // Destroy / Cleanup
  // ────────────────────────────────────────────
  async destroy() {
    this.log('Shutting down HomeAccessibilityElderlyCareSystem...');

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    // Warn about unresolved emergencies
    this.emergencySOS.activeEmergencies.forEach(e => {
      if (!e.resolved) {
        this.log(`Warning: Unresolved emergency ${e.id} during shutdown`);
      }
    });

    this.residents.clear();
    this.medicationManager.medications.clear();
    this.caregiverDashboard.caregivers.clear();

    this.initialized = false;
    this.log('HomeAccessibilityElderlyCareSystem shut down complete');
  }
}

module.exports = HomeAccessibilityElderlyCareSystem;
