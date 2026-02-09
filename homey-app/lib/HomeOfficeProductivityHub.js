'use strict';

/**
 * HomeOfficeProductivityHub
 * Comprehensive home office productivity and environment management system.
 * Pomodoro, standing desk, ergonomics, meetings, focus modes, analytics, and more.
 */

class HomeOfficeProductivityHub {
  constructor(homey) {
    this.homey = homey;

    // --- Pomodoro Engine ---
    this.pomodoro = {
      enabled: false,
      phase: 'idle', // idle, work, shortBreak, longBreak
      workDuration: 25 * 60 * 1000,
      shortBreakDuration: 5 * 60 * 1000,
      longBreakDuration: 15 * 60 * 1000,
      cyclesBeforeLongBreak: 4,
      currentCycle: 0,
      totalCyclesToday: 0,
      autoStartNext: true,
      soundNotifications: true,
      phaseStartTime: null,
      phaseTimer: null,
      history: []
    };

    // --- Standing Desk Integration ---
    this.standingDesk = {
      enabled: false,
      currentPosition: 'sitting',
      alternateInterval: 45 * 60 * 1000,
      heightPresets: {
        default: { sitting: 72, standing: 105 },
        users: {}
      },
      currentHeight: 72,
      dailyLog: [],
      sittingTime: 0,
      standingTime: 0,
      lastPositionChange: null,
      nudgeTimer: null,
      motorSpeed: 2.5 // cm per second simulation
    };

    // --- Ergonomic Monitoring ---
    this.ergonomics = {
      enabled: false,
      postureReminderInterval: 30 * 60 * 1000,
      eyeBreakInterval: 20 * 60 * 1000,
      eyeBreakDuration: 20 * 1000,
      eyeBreakDistance: 20, // feet
      hydrationInterval: 60 * 60 * 1000,
      stretchInterval: 90 * 60 * 1000,
      wristRestInterval: 45 * 60 * 1000,
      lastPostureReminder: null,
      lastEyeBreak: null,
      lastHydration: null,
      lastStretch: null,
      lastWristRest: null,
      waterIntakeToday: 0,
      stretchesCompleted: 0,
      timers: {}
    };

    // --- Meeting Detection ---
    this.meetings = {
      enabled: false,
      calendarSources: ['google', 'outlook'],
      upcoming: [],
      current: null,
      prepCountdownMinutes: 5,
      autoEnvironmentAdjust: true,
      meetingLighting: { colorTemp: 4500, brightness: 85 },
      muteNotifications: true,
      dndActive: false,
      lastCalendarSync: null,
      syncInterval: 5 * 60 * 1000,
      syncTimer: null
    };

    // --- Focus Mode ---
    this.focusMode = {
      enabled: false,
      currentMode: 'none', // none, deep, shallow, creative
      modes: {
        deep: {
          label: 'Deep Work',
          lighting: { colorTemp: 5000, brightness: 80 },
          whiteNoise: true,
          noiseType: 'white',
          blockDistractions: true,
          doorIndicator: 'red',
          notifications: false
        },
        shallow: {
          label: 'Shallow Work',
          lighting: { colorTemp: 4500, brightness: 75 },
          whiteNoise: false,
          noiseType: null,
          blockDistractions: false,
          doorIndicator: 'green',
          notifications: true
        },
        creative: {
          label: 'Creative Mode',
          lighting: { colorTemp: 3500, brightness: 70 },
          whiteNoise: false,
          noiseType: 'ambient',
          blockDistractions: false,
          doorIndicator: 'yellow',
          notifications: false,
          music: true,
          ambientSounds: true
        }
      },
      focusStartTime: null,
      totalFocusToday: 0,
      sessions: []
    };

    // --- Multi-Workspace ---
    this.workspaces = {
      maxStations: 3,
      stations: {
        office: {
          label: 'Home Office',
          active: false,
          profile: {
            lighting: { colorTemp: 5000, brightness: 80 },
            temperature: 21,
            humidity: 50,
            devices: ['pc', 'monitor1', 'monitor2', 'desk_lamp']
          }
        },
        livingRoom: {
          label: 'Living Room Desk',
          active: false,
          profile: {
            lighting: { colorTemp: 4500, brightness: 75 },
            temperature: 22,
            humidity: 50,
            devices: ['laptop', 'desk_lamp']
          }
        },
        bedroom: {
          label: 'Bedroom Desk',
          active: false,
          profile: {
            lighting: { colorTemp: 4000, brightness: 65 },
            temperature: 21,
            humidity: 50,
            devices: ['laptop']
          }
        }
      },
      currentStation: null
    };

    // --- Ambient Intelligence ---
    this.ambient = {
      enabled: false,
      lightingSchedule: {
        morning: { colorTemp: 6500, brightness: 90, startHour: 6, endHour: 10 },
        midday: { colorTemp: 5500, brightness: 85, startHour: 10, endHour: 14 },
        afternoon: { colorTemp: 5000, brightness: 80, startHour: 14, endHour: 17 },
        evening: { colorTemp: 3000, brightness: 50, startHour: 17, endHour: 22 }
      },
      temperatureTargets: { focus: 21, meetings: 22, break: 22 },
      humidity: { min: 40, max: 60, current: null },
      co2: { current: null, threshold: 1000, ventilationTriggered: false },
      currentTemperature: null,
      currentLighting: null,
      sensorTimer: null
    };

    // --- Noise Management ---
    this.noise = {
      enabled: false,
      currentLevel: null,
      backgroundNoiseDb: 0,
      activeNoise: null, // white, pink, brown
      noiseVolume: 30,
      quietHours: { start: 22, end: 7 },
      autoCloseDoorsOnCall: true,
      isInQuietHours: false,
      generators: {
        white: { frequency: 'all', label: 'White Noise' },
        pink: { frequency: 'low-emphasis', label: 'Pink Noise' },
        brown: { frequency: 'deep-emphasis', label: 'Brown Noise' }
      }
    };

    // --- Task Tracking ---
    this.tasks = {
      items: [],
      nextId: 1,
      completedToday: 0,
      dailyProductivityScore: 0,
      weeklyScores: [],
      weeklyTrend: 'stable' // improving, declining, stable
    };

    // --- Energy Tracking ---
    this.energy = {
      enabled: false,
      devices: {
        pc: { watts: 250, active: false, dailyKwh: 0 },
        monitor1: { watts: 45, active: false, dailyKwh: 0 },
        monitor2: { watts: 45, active: false, dailyKwh: 0 },
        printer: { watts: 30, active: false, dailyKwh: 0 },
        deskLamp: { watts: 12, active: false, dailyKwh: 0 },
        chargers: { watts: 65, active: false, dailyKwh: 0 }
      },
      dailyTotal: 0,
      weeklyTotal: 0,
      monthlyTotal: 0,
      autoPowerOff: { enabled: true, afterMinutes: 30 },
      standbyElimination: true,
      trackingTimer: null,
      history: []
    };

    // --- Break Activities ---
    this.breakActivities = {
      stretches: {
        neck: { label: 'Neck Rolls', duration: 60, instructions: 'Slowly roll your head in circles, 5 each direction' },
        back: { label: 'Back Stretch', duration: 90, instructions: 'Stand and reach for the ceiling, then touch your toes' },
        wrists: { label: 'Wrist Circles', duration: 45, instructions: 'Rotate wrists clockwise and counterclockwise, 10 each' },
        legs: { label: 'Leg Stretches', duration: 120, instructions: 'Standing quad stretch, calf raises, 10 each leg' }
      },
      mindfulness: {
        breathing2: { label: '2-Minute Breathing', duration: 120, pattern: '4-7-8' },
        breathing5: { label: '5-Minute Breathing', duration: 300, pattern: '4-4-4-4' }
      },
      walkReminders: { interval: 60 * 60 * 1000, stepTarget: 250, stepsToday: 0 },
      suggestions: ['Drink a glass of water', 'Have a healthy snack', 'Look out the window', 'Do 10 squats']
    };

    // --- Circadian Support ---
    this.circadian = {
      enabled: false,
      schedule: {
        morning: { startHour: 6, endHour: 10, colorTemp: 6500, brightness: 95, alarm: true },
        midday: { startHour: 10, endHour: 14, colorTemp: 5500, brightness: 85, alertness: true },
        afternoon: { startHour: 14, endHour: 17, colorTemp: 5000, brightness: 80, alertness: true },
        evening: { startHour: 17, endHour: 22, colorTemp: 3000, brightness: 40, blueFilter: true }
      },
      currentPhase: null,
      alarmSet: false,
      blueFilterActive: false
    };

    // --- Commute Simulation ---
    this.commute = {
      enabled: false,
      morningRoutine: {
        triggerTime: '08:00',
        actions: ['brew_coffee', 'news_briefing', 'desk_lights_on', 'pc_boot'],
        completed: false
      },
      endOfDayRitual: {
        triggerTime: '18:00',
        actions: ['desk_lamp_off', 'status_away', 'equipment_standby', 'transition_lighting'],
        completed: false
      },
      isActive: false
    };

    // --- Collaboration Tools ---
    this.collaboration = {
      sharedCalendar: false,
      coWorkingMode: { enabled: false, partnerId: null, syncBreaks: false },
      meetingRoomBooking: [],
      presenceIndicator: 'available', // available, busy, away, dnd
      presenceLedColor: { available: 'green', busy: 'red', away: 'yellow', dnd: 'purple' }
    };

    // --- Productivity Analytics ---
    this.analytics = {
      daily: {
        hoursWorked: 0,
        focusTime: 0,
        meetingTime: 0,
        breakTime: 0,
        breakCompliance: 0,
        tasksCompleted: 0,
        date: null
      },
      weekly: {
        totalHours: 0,
        bestFocusDay: null,
        bestFocusHours: 0,
        trends: [],
        days: []
      },
      monthly: {
        burnoutRisk: 'low', // low, medium, high
        workLifeBalance: 80,
        totalHours: 0,
        avgDailyHours: 0
      },
      history: []
    };

    // --- Document/Print Management ---
    this.printing = {
      jobQueue: [],
      nextJobId: 1,
      inkLevel: { cyan: 85, magenta: 90, yellow: 88, black: 70 },
      tonerLevel: 75,
      paperUsage: { today: 0, week: 0, month: 0 },
      scanToCloud: { enabled: true, provider: 'google-drive', folder: '/scans' },
      ecoPrintMode: true,
      totalJobsToday: 0
    };

    // --- Work-Life Boundary ---
    this.workLifeBoundary = {
      hardStopTime: '18:00',
      windDownMinutes: 30,
      windDownActive: false,
      weekendRules: { workAllowed: false, notificationsOff: true },
      vacationMode: false,
      workStartTime: '09:00',
      isWorkDay: true,
      isWithinWorkHours: false
    };

    // --- Monitoring Cycle ---
    this.monitoringInterval = 2 * 60 * 1000; // 2 minutes
    this.monitoringTimer = null;
    this.initialized = false;
    this.startTime = null;
  }

  // ========================================================
  // Initialization
  // ========================================================
  async initialize() {
    this.log('Initializing Home Office Productivity Hub...');
    this.startTime = Date.now();

    try {
      this._initializeDailyAnalytics();
      this._detectWorkDay();
      this._updateCircadianPhase();
      this._updateAmbientLighting();
      this._checkWorkHours();
      this._startMonitoringCycle();
      this._startErgonomicTimers();
      this._startEnergyTracking();
      this._initializeMeetingSync();

      this.initialized = true;
      this.log('Home Office Productivity Hub initialized successfully');
      this.log(`Active workspace: ${this.workspaces.currentStation || 'none'}`);
      this.log(`Work hours: ${this.workLifeBoundary.workStartTime} - ${this.workLifeBoundary.hardStopTime}`);
      this.log(`Pomodoro: ${this.pomodoro.workDuration / 60000}min work / ${this.pomodoro.shortBreakDuration / 60000}min break`);
    } catch (err) {
      this.error(`Initialization failed: ${err.message}`);
      throw err;
    }
  }

  // ========================================================
  // Pomodoro Engine
  // ========================================================
  startPomodoro() {
    if (this.pomodoro.phase !== 'idle') {
      this.log('Pomodoro already in progress, resetting...');
      this.stopPomodoro();
    }
    this.pomodoro.enabled = true;
    this.pomodoro.currentCycle = 0;
    this._startPomodoroWork();
    this.log('Pomodoro session started');
  }

  _startPomodoroWork() {
    this.pomodoro.phase = 'work';
    this.pomodoro.phaseStartTime = Date.now();
    this._applyPomodoroEnvironment('work');

    if (this.pomodoro.soundNotifications) {
      this._playNotificationSound('work_start');
    }

    this.log(`Pomodoro WORK phase started (${this.pomodoro.workDuration / 60000} min)`);

    this.pomodoro.phaseTimer = setTimeout(() => {
      this._onPomodoroWorkComplete();
    }, this.pomodoro.workDuration);
  }

  _onPomodoroWorkComplete() {
    this.pomodoro.currentCycle++;
    this.pomodoro.totalCyclesToday++;

    this.pomodoro.history.push({
      phase: 'work',
      duration: this.pomodoro.workDuration,
      completedAt: Date.now(),
      cycle: this.pomodoro.currentCycle
    });

    this.analytics.daily.focusTime += this.pomodoro.workDuration / 3600000;

    if (this.pomodoro.soundNotifications) {
      this._playNotificationSound('work_complete');
    }

    this.log(`Pomodoro work cycle ${this.pomodoro.currentCycle} complete`);

    if (this.pomodoro.currentCycle >= this.pomodoro.cyclesBeforeLongBreak) {
      this._startPomodoroLongBreak();
    } else {
      this._startPomodoroShortBreak();
    }
  }

  _startPomodoroShortBreak() {
    this.pomodoro.phase = 'shortBreak';
    this.pomodoro.phaseStartTime = Date.now();
    this._applyPomodoroEnvironment('shortBreak');

    this.log(`Pomodoro SHORT BREAK started (${this.pomodoro.shortBreakDuration / 60000} min)`);

    this.pomodoro.phaseTimer = setTimeout(() => {
      this._onPomodoroBreakComplete();
    }, this.pomodoro.shortBreakDuration);
  }

  _startPomodoroLongBreak() {
    this.pomodoro.phase = 'longBreak';
    this.pomodoro.phaseStartTime = Date.now();
    this._applyPomodoroEnvironment('longBreak');

    this.log(`Pomodoro LONG BREAK started (${this.pomodoro.longBreakDuration / 60000} min)`);

    this.pomodoro.phaseTimer = setTimeout(() => {
      this.pomodoro.currentCycle = 0;
      this._onPomodoroBreakComplete();
    }, this.pomodoro.longBreakDuration);
  }

  _onPomodoroBreakComplete() {
    const breakType = this.pomodoro.phase;
    const breakDuration = breakType === 'longBreak'
      ? this.pomodoro.longBreakDuration
      : this.pomodoro.shortBreakDuration;

    this.pomodoro.history.push({
      phase: breakType,
      duration: breakDuration,
      completedAt: Date.now(),
      cycle: this.pomodoro.currentCycle
    });

    this.analytics.daily.breakTime += breakDuration / 3600000;

    if (this.pomodoro.soundNotifications) {
      this._playNotificationSound('break_complete');
    }

    this.log(`Pomodoro ${breakType} complete`);

    if (this.pomodoro.autoStartNext) {
      this._startPomodoroWork();
    } else {
      this.pomodoro.phase = 'idle';
      this.log('Pomodoro paused — waiting to start next cycle');
    }
  }

  stopPomodoro() {
    if (this.pomodoro.phaseTimer) {
      clearTimeout(this.pomodoro.phaseTimer);
      this.pomodoro.phaseTimer = null;
    }
    this.pomodoro.phase = 'idle';
    this.pomodoro.enabled = false;
    this.log('Pomodoro session stopped');
  }

  _applyPomodoroEnvironment(phase) {
    const station = this._getActiveStation();
    if (!station) return;

    switch (phase) {
      case 'work':
        station.profile.lighting = { colorTemp: 5000, brightness: 80 };
        this.log('Environment set to focus mode for work phase');
        break;
      case 'shortBreak':
        station.profile.lighting = { colorTemp: 4000, brightness: 60 };
        this.log('Environment set to relaxing mode for short break');
        break;
      case 'longBreak':
        station.profile.lighting = { colorTemp: 3500, brightness: 50 };
        this.log('Environment set to relaxing mode for long break');
        break;
    }
  }

  _playNotificationSound(type) {
    this.log(`Playing notification sound: ${type}`);
  }

  getPomodoroStatus() {
    const elapsed = this.pomodoro.phaseStartTime
      ? Date.now() - this.pomodoro.phaseStartTime
      : 0;
    let totalDuration = 0;
    if (this.pomodoro.phase === 'work') totalDuration = this.pomodoro.workDuration;
    else if (this.pomodoro.phase === 'shortBreak') totalDuration = this.pomodoro.shortBreakDuration;
    else if (this.pomodoro.phase === 'longBreak') totalDuration = this.pomodoro.longBreakDuration;

    return {
      phase: this.pomodoro.phase,
      cycle: this.pomodoro.currentCycle,
      totalCyclesToday: this.pomodoro.totalCyclesToday,
      elapsed,
      remaining: Math.max(0, totalDuration - elapsed),
      autoStartNext: this.pomodoro.autoStartNext
    };
  }

  // ========================================================
  // Standing Desk Integration
  // ========================================================
  enableStandingDesk(userId) {
    this.standingDesk.enabled = true;
    this.standingDesk.lastPositionChange = Date.now();

    const userPresets = this.standingDesk.heightPresets.users[userId]
      || this.standingDesk.heightPresets.default;
    this.standingDesk.currentHeight = userPresets.sitting;
    this.standingDesk.currentPosition = 'sitting';

    this.standingDesk.nudgeTimer = setInterval(() => {
      this._nudgeDeskPosition();
    }, this.standingDesk.alternateInterval);

    this.log(`Standing desk enabled for user ${userId || 'default'} at ${this.standingDesk.currentHeight}cm`);
  }

  _nudgeDeskPosition() {
    const now = Date.now();
    const elapsed = now - (this.standingDesk.lastPositionChange || now);

    if (this.standingDesk.currentPosition === 'sitting') {
      this.standingDesk.sittingTime += elapsed;
      this.log('Time to stand! Raising desk...');
      this._transitionDesk('standing');
    } else {
      this.standingDesk.standingTime += elapsed;
      this.log('Time to sit! Lowering desk...');
      this._transitionDesk('sitting');
    }
  }

  _transitionDesk(targetPosition) {
    const userId = 'default';
    const presets = this.standingDesk.heightPresets.users[userId]
      || this.standingDesk.heightPresets.default;
    const targetHeight = presets[targetPosition];
    const currentHeight = this.standingDesk.currentHeight;
    const distance = Math.abs(targetHeight - currentHeight);
    const transitionTime = (distance / this.standingDesk.motorSpeed) * 1000;

    this.log(`Desk moving from ${currentHeight}cm to ${targetHeight}cm (${(transitionTime / 1000).toFixed(1)}s)`);

    this.standingDesk.currentHeight = targetHeight;
    this.standingDesk.currentPosition = targetPosition;
    this.standingDesk.lastPositionChange = Date.now();

    this.standingDesk.dailyLog.push({
      position: targetPosition,
      height: targetHeight,
      timestamp: Date.now()
    });
  }

  setDeskUserPreset(userId, sittingHeight, standingHeight) {
    this.standingDesk.heightPresets.users[userId] = {
      sitting: sittingHeight || 72,
      standing: standingHeight || 105
    };
    this.log(`Desk presets updated for user ${userId}: sit=${sittingHeight}cm, stand=${standingHeight}cm`);
  }

  getDeskStats() {
    const totalTime = this.standingDesk.sittingTime + this.standingDesk.standingTime;
    return {
      currentPosition: this.standingDesk.currentPosition,
      currentHeight: this.standingDesk.currentHeight,
      sittingTime: this.standingDesk.sittingTime,
      standingTime: this.standingDesk.standingTime,
      ratio: totalTime > 0
        ? (this.standingDesk.standingTime / totalTime * 100).toFixed(1) + '%'
        : '0%',
      transitions: this.standingDesk.dailyLog.length
    };
  }

  // ========================================================
  // Ergonomic Monitoring
  // ========================================================
  _startErgonomicTimers() {
    this.ergonomics.enabled = true;
    const now = Date.now();
    this.ergonomics.lastPostureReminder = now;
    this.ergonomics.lastEyeBreak = now;
    this.ergonomics.lastHydration = now;
    this.ergonomics.lastStretch = now;
    this.ergonomics.lastWristRest = now;

    this.ergonomics.timers.posture = setInterval(() => {
      this._postureReminder();
    }, this.ergonomics.postureReminderInterval);

    this.ergonomics.timers.eyeBreak = setInterval(() => {
      this._eyeBreakReminder();
    }, this.ergonomics.eyeBreakInterval);

    this.ergonomics.timers.hydration = setInterval(() => {
      this._hydrationReminder();
    }, this.ergonomics.hydrationInterval);

    this.ergonomics.timers.stretch = setInterval(() => {
      this._stretchReminder();
    }, this.ergonomics.stretchInterval);

    this.ergonomics.timers.wristRest = setInterval(() => {
      this._wristRestReminder();
    }, this.ergonomics.wristRestInterval);

    this.log('Ergonomic monitoring timers started');
  }

  _postureReminder() {
    this.ergonomics.lastPostureReminder = Date.now();
    this.log('Posture check: Sit up straight, feet flat on floor, monitor at eye level');
    this._sendNotification('posture', 'Time for a posture check! Straighten your back.');
  }

  _eyeBreakReminder() {
    this.ergonomics.lastEyeBreak = Date.now();
    this.log('Eye break (20-20-20): Look 20ft away for 20 seconds');
    this._sendNotification('eyeBreak', '20-20-20 Rule: Look at something 20 feet away for 20 seconds.');
  }

  _hydrationReminder() {
    this.ergonomics.lastHydration = Date.now();
    this.ergonomics.waterIntakeToday++;
    this.log(`Hydration reminder #${this.ergonomics.waterIntakeToday}: Drink a glass of water`);
    this._sendNotification('hydration', 'Stay hydrated! Drink a glass of water.');
  }

  _stretchReminder() {
    this.ergonomics.lastStretch = Date.now();
    this.ergonomics.stretchesCompleted++;
    const stretches = Object.values(this.breakActivities.stretches);
    const suggestion = stretches[this.ergonomics.stretchesCompleted % stretches.length];
    this.log(`Stretch reminder: ${suggestion.label} — ${suggestion.instructions}`);
    this._sendNotification('stretch', `Time to stretch! Try: ${suggestion.label}`);
  }

  _wristRestReminder() {
    this.ergonomics.lastWristRest = Date.now();
    this.log('Wrist rest reminder: Shake out your hands and rotate your wrists');
    this._sendNotification('wristRest', 'Rest your wrists! Shake your hands and do wrist circles.');
  }

  _sendNotification(type, message) {
    if (this.meetings.dndActive && type !== 'urgent') return;
    if (this.focusMode.currentMode === 'deep' && type !== 'urgent') return;
    this.log(`Notification [${type}]: ${message}`);
  }

  // ========================================================
  // Meeting Detection & Calendar Integration
  // ========================================================
  _initializeMeetingSync() {
    this.meetings.lastCalendarSync = Date.now();
    this.meetings.syncTimer = setInterval(() => {
      this._syncCalendar();
    }, this.meetings.syncInterval);
    this.log('Meeting calendar sync initialized');
  }

  _syncCalendar() {
    this.meetings.lastCalendarSync = Date.now();
    this.log('Syncing calendar from sources: ' + this.meetings.calendarSources.join(', '));
    this._checkUpcomingMeetings();
  }

  addMeeting(meeting) {
    const entry = {
      id: Date.now().toString(36),
      title: meeting.title || 'Untitled Meeting',
      startTime: meeting.startTime,
      endTime: meeting.endTime,
      attendees: meeting.attendees || [],
      isVideo: meeting.isVideo || false,
      room: meeting.room || null,
      source: meeting.source || 'manual'
    };
    this.meetings.upcoming.push(entry);
    this.meetings.upcoming.sort((a, b) => a.startTime - b.startTime);
    this.log(`Meeting added: "${entry.title}" at ${new Date(entry.startTime).toLocaleTimeString()}`);
    return entry.id;
  }

  _checkUpcomingMeetings() {
    const now = Date.now();
    const prepWindow = this.meetings.prepCountdownMinutes * 60 * 1000;

    for (const meeting of this.meetings.upcoming) {
      const timeUntil = meeting.startTime - now;

      if (timeUntil > 0 && timeUntil <= prepWindow && !meeting._prepNotified) {
        meeting._prepNotified = true;
        this.log(`Meeting prep: "${meeting.title}" starts in ${Math.ceil(timeUntil / 60000)} minutes`);
        this._prepareMeetingEnvironment(meeting);
      }

      if (now >= meeting.startTime && now <= meeting.endTime && !this.meetings.current) {
        this.meetings.current = meeting;
        this._startMeeting(meeting);
      }

      if (this.meetings.current && this.meetings.current.id === meeting.id && now > meeting.endTime) {
        this._endMeeting(meeting);
      }
    }

    this.meetings.upcoming = this.meetings.upcoming.filter(m => m.endTime > now);
  }

  _prepareMeetingEnvironment(meeting) {
    if (!this.meetings.autoEnvironmentAdjust) return;
    this.log(`Preparing environment for meeting: "${meeting.title}"`);

    const station = this._getActiveStation();
    if (station) {
      station.profile.lighting = { ...this.meetings.meetingLighting };
      station.profile.temperature = this.ambient.temperatureTargets.meetings;
    }
  }

  _startMeeting(meeting) {
    this.log(`Meeting started: "${meeting.title}"`);
    this.meetings.dndActive = true;
    this.collaboration.presenceIndicator = 'busy';
    this.analytics.daily.meetingTime += (meeting.endTime - meeting.startTime) / 3600000;

    if (this.noise.autoCloseDoorsOnCall && meeting.isVideo) {
      this.log('Auto-closing doors/windows for video call');
    }
  }

  _endMeeting(meeting) {
    this.log(`Meeting ended: "${meeting.title}"`);
    this.meetings.current = null;
    this.meetings.dndActive = false;
    this.collaboration.presenceIndicator = 'available';
    this._restoreWorkEnvironment();
  }

  _restoreWorkEnvironment() {
    if (this.focusMode.currentMode !== 'none') {
      this.setFocusMode(this.focusMode.currentMode);
    } else {
      this._updateAmbientLighting();
    }
    this.log('Work environment restored');
  }

  // ========================================================
  // Focus Mode Management
  // ========================================================
  setFocusMode(mode) {
    if (!this.focusMode.modes[mode]) {
      this.error(`Unknown focus mode: ${mode}`);
      return;
    }

    const config = this.focusMode.modes[mode];
    this.focusMode.currentMode = mode;
    this.focusMode.enabled = true;
    this.focusMode.focusStartTime = Date.now();

    const station = this._getActiveStation();
    if (station) {
      station.profile.lighting = { ...config.lighting };
    }

    this.collaboration.presenceIndicator = config.blockDistractions ? 'dnd' : 'available';

    if (config.whiteNoise || config.noiseType) {
      this.noise.activeNoise = config.noiseType;
      this.log(`Noise generator: ${config.noiseType || 'off'}`);
    }

    if (config.doorIndicator) {
      this.log(`Door indicator set to: ${config.doorIndicator}`);
    }

    this.log(`Focus mode activated: ${config.label} — Lighting ${config.lighting.colorTemp}K @ ${config.lighting.brightness}%`);
    return config;
  }

  exitFocusMode() {
    if (this.focusMode.focusStartTime) {
      const duration = Date.now() - this.focusMode.focusStartTime;
      this.focusMode.totalFocusToday += duration;
      this.focusMode.sessions.push({
        mode: this.focusMode.currentMode,
        duration,
        endedAt: Date.now()
      });
    }

    this.focusMode.currentMode = 'none';
    this.focusMode.enabled = false;
    this.focusMode.focusStartTime = null;
    this.noise.activeNoise = null;
    this.collaboration.presenceIndicator = 'available';
    this._restoreWorkEnvironment();
    this.log('Focus mode deactivated');
  }

  // ========================================================
  // Multi-Workspace Management
  // ========================================================
  switchWorkspace(stationKey) {
    if (!this.workspaces.stations[stationKey]) {
      this.error(`Unknown workspace station: ${stationKey}`);
      return null;
    }

    if (this.workspaces.currentStation) {
      this.workspaces.stations[this.workspaces.currentStation].active = false;
      this.log(`Deactivated workspace: ${this.workspaces.stations[this.workspaces.currentStation].label}`);
    }

    this.workspaces.currentStation = stationKey;
    this.workspaces.stations[stationKey].active = true;

    this._applyWorkspaceProfile(stationKey);
    this.log(`Switched to workspace: ${this.workspaces.stations[stationKey].label}`);
    return this.workspaces.stations[stationKey];
  }

  _applyWorkspaceProfile(stationKey) {
    const station = this.workspaces.stations[stationKey];
    if (!station) return;
    this.log(`Applying profile for ${station.label}: ` +
      `${station.profile.lighting.colorTemp}K, ` +
      `${station.profile.temperature}°C, ` +
      `devices: ${station.profile.devices.join(', ')}`);
  }

  _getActiveStation() {
    if (!this.workspaces.currentStation) return null;
    return this.workspaces.stations[this.workspaces.currentStation] || null;
  }

  addWorkspace(key, label, profile) {
    if (Object.keys(this.workspaces.stations).length >= this.workspaces.maxStations) {
      this.error(`Maximum of ${this.workspaces.maxStations} workstations supported`);
      return false;
    }
    this.workspaces.stations[key] = {
      label: label || key,
      active: false,
      profile: {
        lighting: profile.lighting || { colorTemp: 5000, brightness: 75 },
        temperature: profile.temperature || 21,
        humidity: profile.humidity || 50,
        devices: profile.devices || []
      }
    };
    this.log(`Workspace added: ${label}`);
    return true;
  }

  // ========================================================
  // Ambient Intelligence
  // ========================================================
  _updateAmbientLighting() {
    const hour = new Date().getHours();
    let phase = null;

    for (const [name, config] of Object.entries(this.ambient.lightingSchedule)) {
      if (hour >= config.startHour && hour < config.endHour) {
        phase = { name, ...config };
        break;
      }
    }

    if (!phase) {
      phase = { name: 'night', colorTemp: 2700, brightness: 20 };
    }

    this.ambient.currentLighting = phase;

    const station = this._getActiveStation();
    if (station && !this.focusMode.enabled && !this.meetings.current) {
      station.profile.lighting = { colorTemp: phase.colorTemp, brightness: phase.brightness };
    }
  }

  updateEnvironmentSensors(data) {
    if (data.temperature !== undefined) {
      this.ambient.currentTemperature = data.temperature;
    }
    if (data.humidity !== undefined) {
      this.ambient.humidity.current = data.humidity;
      if (data.humidity < this.ambient.humidity.min || data.humidity > this.ambient.humidity.max) {
        this.log(`Humidity out of range: ${data.humidity}% (ideal: ${this.ambient.humidity.min}-${this.ambient.humidity.max}%)`);
      }
    }
    if (data.co2 !== undefined) {
      this.ambient.co2.current = data.co2;
      if (data.co2 > this.ambient.co2.threshold && !this.ambient.co2.ventilationTriggered) {
        this.ambient.co2.ventilationTriggered = true;
        this.log(`CO2 level high (${data.co2}ppm > ${this.ambient.co2.threshold}ppm) — triggering ventilation`);
        this._triggerVentilation();
      } else if (data.co2 <= this.ambient.co2.threshold * 0.8) {
        this.ambient.co2.ventilationTriggered = false;
      }
    }
  }

  _triggerVentilation() {
    this.log('Ventilation system activated to reduce CO2 levels');
  }

  // ========================================================
  // Noise Management
  // ========================================================
  startNoiseGenerator(type) {
    if (!this.noise.generators[type]) {
      this.error(`Unknown noise type: ${type}. Available: ${Object.keys(this.noise.generators).join(', ')}`);
      return;
    }
    this.noise.activeNoise = type;
    this.noise.enabled = true;
    this.log(`${this.noise.generators[type].label} generator started at volume ${this.noise.noiseVolume}%`);
  }

  stopNoiseGenerator() {
    if (this.noise.activeNoise) {
      this.log(`${this.noise.generators[this.noise.activeNoise].label} generator stopped`);
    }
    this.noise.activeNoise = null;
  }

  setNoiseVolume(volume) {
    this.noise.noiseVolume = Math.max(0, Math.min(100, volume));
    this.log(`Noise volume set to ${this.noise.noiseVolume}%`);
  }

  _checkQuietHours() {
    const hour = new Date().getHours();
    const inQuiet = hour >= this.noise.quietHours.start || hour < this.noise.quietHours.end;
    if (inQuiet && !this.noise.isInQuietHours) {
      this.noise.isInQuietHours = true;
      this.log('Quiet hours activated');
    } else if (!inQuiet && this.noise.isInQuietHours) {
      this.noise.isInQuietHours = false;
      this.log('Quiet hours ended');
    }
  }

  updateBackgroundNoise(db) {
    this.noise.backgroundNoiseDb = db;
    if (db > 60) {
      this.log(`Background noise elevated: ${db}dB — consider noise cancellation`);
    }
  }

  // ========================================================
  // Task Tracking
  // ========================================================
  addTask(task) {
    const entry = {
      id: this.tasks.nextId++,
      title: task.title || 'Untitled Task',
      priority: task.priority || 'medium', // high, medium, low
      estimatedMinutes: task.estimatedMinutes || 30,
      actualMinutes: 0,
      completed: false,
      createdAt: Date.now(),
      completedAt: null,
      startedAt: null
    };
    this.tasks.items.push(entry);
    this.log(`Task added: [${entry.priority.toUpperCase()}] "${entry.title}" (est. ${entry.estimatedMinutes}min)`);
    return entry.id;
  }

  startTask(taskId) {
    const task = this.tasks.items.find(t => t.id === taskId);
    if (!task) { this.error(`Task ${taskId} not found`); return; }
    task.startedAt = Date.now();
    this.log(`Task started: "${task.title}"`);
  }

  completeTask(taskId) {
    const task = this.tasks.items.find(t => t.id === taskId);
    if (!task) { this.error(`Task ${taskId} not found`); return; }
    task.completed = true;
    task.completedAt = Date.now();
    if (task.startedAt) {
      task.actualMinutes = (task.completedAt - task.startedAt) / 60000;
    }
    this.tasks.completedToday++;
    this.analytics.daily.tasksCompleted++;
    this._updateProductivityScore();
    this.log(`Task completed: "${task.title}" (actual: ${task.actualMinutes.toFixed(1)}min, est: ${task.estimatedMinutes}min)`);
  }

  removeTask(taskId) {
    const idx = this.tasks.items.findIndex(t => t.id === taskId);
    if (idx === -1) { this.error(`Task ${taskId} not found`); return; }
    const removed = this.tasks.items.splice(idx, 1)[0];
    this.log(`Task removed: "${removed.title}"`);
  }

  getTaskList() {
    return this.tasks.items
      .sort((a, b) => {
        const p = { high: 0, medium: 1, low: 2 };
        return (p[a.priority] || 1) - (p[b.priority] || 1);
      })
      .map(t => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        completed: t.completed,
        estimatedMinutes: t.estimatedMinutes,
        actualMinutes: t.actualMinutes
      }));
  }

  _updateProductivityScore() {
    const totalTasks = this.tasks.items.length || 1;
    const completedTasks = this.tasks.completedToday;
    const focusHours = this.analytics.daily.focusTime;
    const breakCompliance = this.analytics.daily.breakCompliance;

    const taskScore = Math.min(40, (completedTasks / Math.max(totalTasks, 1)) * 40);
    const focusScore = Math.min(35, focusHours * 7);
    const breakScore = Math.min(25, breakCompliance * 25);

    this.tasks.dailyProductivityScore = Math.round(taskScore + focusScore + breakScore);
    this.log(`Productivity score updated: ${this.tasks.dailyProductivityScore}/100`);
  }

  // ========================================================
  // Energy Tracking
  // ========================================================
  _startEnergyTracking() {
    this.energy.enabled = true;
    this.energy.trackingTimer = setInterval(() => {
      this._trackEnergyConsumption();
    }, 60000); // every minute
    this.log('Energy tracking started');
  }

  _trackEnergyConsumption() {
    let totalWatts = 0;
    for (const [name, device] of Object.entries(this.energy.devices)) {
      if (device.active) {
        const kwh = (device.watts / 1000) / 60; // 1 minute in hours
        device.dailyKwh += kwh;
        totalWatts += device.watts;
      }
    }
    this.energy.dailyTotal = Object.values(this.energy.devices)
      .reduce((sum, d) => sum + d.dailyKwh, 0);
    this.energy.weeklyTotal += this.energy.dailyTotal;
    this.energy.monthlyTotal += this.energy.dailyTotal;
  }

  setDevicePower(deviceName, active) {
    if (!this.energy.devices[deviceName]) {
      this.error(`Unknown device: ${deviceName}`);
      return;
    }
    this.energy.devices[deviceName].active = active;
    this.log(`Device ${deviceName}: ${active ? 'ON' : 'OFF'} (${this.energy.devices[deviceName].watts}W)`);
  }

  getEnergyReport() {
    const devices = {};
    for (const [name, device] of Object.entries(this.energy.devices)) {
      devices[name] = {
        active: device.active,
        watts: device.watts,
        dailyKwh: device.dailyKwh.toFixed(3)
      };
    }
    return {
      devices,
      dailyTotal: this.energy.dailyTotal.toFixed(3) + ' kWh',
      weeklyTotal: this.energy.weeklyTotal.toFixed(3) + ' kWh',
      monthlyTotal: this.energy.monthlyTotal.toFixed(3) + ' kWh',
      standbyElimination: this.energy.standbyElimination,
      autoPowerOff: this.energy.autoPowerOff
    };
  }

  _autoPowerOffCheck() {
    if (!this.energy.autoPowerOff.enabled) return;
    if (!this.workLifeBoundary.isWithinWorkHours) {
      for (const [name, device] of Object.entries(this.energy.devices)) {
        if (device.active && name !== 'chargers') {
          this.setDevicePower(name, false);
          this.log(`Auto power-off: ${name}`);
        }
      }
    }
  }

  // ========================================================
  // Break Activities
  // ========================================================
  getSuggestedBreakActivity() {
    const activities = [];
    const stretches = Object.entries(this.breakActivities.stretches);
    const [key, stretch] = stretches[Math.floor(Math.random() * stretches.length)];
    activities.push({ type: 'stretch', ...stretch });

    if (this.ergonomics.waterIntakeToday < 8) {
      activities.push({ type: 'hydration', label: 'Drink Water', instructions: 'Have a glass of water' });
    }

    const mindfulness = Object.values(this.breakActivities.mindfulness);
    activities.push({ type: 'mindfulness', ...mindfulness[Math.floor(Math.random() * mindfulness.length)] });

    const suggestion = this.breakActivities.suggestions[
      Math.floor(Math.random() * this.breakActivities.suggestions.length)
    ];
    activities.push({ type: 'suggestion', label: suggestion });

    return activities;
  }

  logSteps(steps) {
    this.breakActivities.walkReminders.stepsToday += steps;
    this.log(`Steps logged: +${steps} (total today: ${this.breakActivities.walkReminders.stepsToday})`);
  }

  // ========================================================
  // Circadian Support
  // ========================================================
  _updateCircadianPhase() {
    const hour = new Date().getHours();
    let activePhase = null;

    for (const [name, config] of Object.entries(this.circadian.schedule)) {
      if (hour >= config.startHour && hour < config.endHour) {
        activePhase = name;
        break;
      }
    }

    if (activePhase !== this.circadian.currentPhase) {
      this.circadian.currentPhase = activePhase;
      if (activePhase) {
        const config = this.circadian.schedule[activePhase];
        this.log(`Circadian phase: ${activePhase} — ${config.colorTemp}K @ ${config.brightness}%`);

        if (config.blueFilter && !this.circadian.blueFilterActive) {
          this.circadian.blueFilterActive = true;
          this.log('Blue light filter activated for evening');
        } else if (!config.blueFilter && this.circadian.blueFilterActive) {
          this.circadian.blueFilterActive = false;
        }

        if (config.alarm && !this.circadian.alarmSet) {
          this.log('Morning circadian alarm triggered — bright cool light');
          this.circadian.alarmSet = true;
        }
      }
    }
  }

  // ========================================================
  // Commute Simulation
  // ========================================================
  triggerMorningRoutine() {
    if (this.commute.morningRoutine.completed) {
      this.log('Morning routine already completed today');
      return;
    }

    this.commute.isActive = true;
    this.log('Starting morning commute simulation...');

    for (const action of this.commute.morningRoutine.actions) {
      switch (action) {
        case 'brew_coffee':
          this.log('Triggering coffee machine...');
          break;
        case 'news_briefing':
          this.log('Starting news briefing audio...');
          break;
        case 'desk_lights_on':
          this.log('Turning on desk lights...');
          this.setDevicePower('deskLamp', true);
          break;
        case 'pc_boot':
          this.log('Booting workstation...');
          this.setDevicePower('pc', true);
          this.setDevicePower('monitor1', true);
          break;
        default:
          this.log(`Executing morning action: ${action}`);
      }
    }

    this.commute.morningRoutine.completed = true;
    this.collaboration.presenceIndicator = 'available';
    this.log('Morning routine complete — ready to work');
  }

  triggerEndOfDayRitual() {
    if (this.commute.endOfDayRitual.completed) {
      this.log('End-of-day ritual already completed today');
      return;
    }

    this.log('Starting end-of-day ritual...');
    this.exitFocusMode();
    this.stopPomodoro();

    for (const action of this.commute.endOfDayRitual.actions) {
      switch (action) {
        case 'desk_lamp_off':
          this.log('Turning off desk lamp...');
          this.setDevicePower('deskLamp', false);
          break;
        case 'status_away':
          this.collaboration.presenceIndicator = 'away';
          this.log('Status set to away');
          break;
        case 'equipment_standby':
          this.log('Setting equipment to standby...');
          for (const name of Object.keys(this.energy.devices)) {
            this.setDevicePower(name, false);
          }
          break;
        case 'transition_lighting':
          this.log('Transitioning lighting to living areas...');
          break;
        default:
          this.log(`Executing end-of-day action: ${action}`);
      }
    }

    this.commute.endOfDayRitual.completed = true;
    this.commute.isActive = false;
    this.log('End-of-day ritual complete — enjoy your evening');
  }

  // ========================================================
  // Collaboration Tools
  // ========================================================
  setPresence(status) {
    const valid = ['available', 'busy', 'away', 'dnd'];
    if (!valid.includes(status)) {
      this.error(`Invalid presence status: ${status}. Use: ${valid.join(', ')}`);
      return;
    }
    this.collaboration.presenceIndicator = status;
    const color = this.collaboration.presenceLedColor[status];
    this.log(`Presence set to ${status} (LED: ${color})`);
  }

  enableCoWorkingMode(partnerId) {
    this.collaboration.coWorkingMode = {
      enabled: true,
      partnerId,
      syncBreaks: true
    };
    this.log(`Co-working mode enabled with partner: ${partnerId}`);
  }

  disableCoWorkingMode() {
    this.collaboration.coWorkingMode = { enabled: false, partnerId: null, syncBreaks: false };
    this.log('Co-working mode disabled');
  }

  bookMeetingRoom(room, startTime, endTime) {
    const booking = {
      id: Date.now().toString(36),
      room,
      startTime,
      endTime,
      bookedAt: Date.now()
    };
    this.collaboration.meetingRoomBooking.push(booking);
    this.log(`Meeting room "${room}" booked: ${new Date(startTime).toLocaleTimeString()} - ${new Date(endTime).toLocaleTimeString()}`);
    return booking.id;
  }

  // ========================================================
  // Productivity Analytics
  // ========================================================
  _initializeDailyAnalytics() {
    const today = new Date().toISOString().split('T')[0];
    if (this.analytics.daily.date !== today) {
      if (this.analytics.daily.date) {
        this.analytics.history.push({ ...this.analytics.daily });
        this._updateWeeklyAnalytics();
      }
      this.analytics.daily = {
        hoursWorked: 0,
        focusTime: 0,
        meetingTime: 0,
        breakTime: 0,
        breakCompliance: 0,
        tasksCompleted: 0,
        date: today
      };
      this._resetDailyCounters();
    }
  }

  _resetDailyCounters() {
    this.pomodoro.totalCyclesToday = 0;
    this.pomodoro.history = [];
    this.tasks.completedToday = 0;
    this.tasks.dailyProductivityScore = 0;
    this.ergonomics.waterIntakeToday = 0;
    this.ergonomics.stretchesCompleted = 0;
    this.standingDesk.dailyLog = [];
    this.standingDesk.sittingTime = 0;
    this.standingDesk.standingTime = 0;
    this.focusMode.totalFocusToday = 0;
    this.focusMode.sessions = [];
    this.breakActivities.walkReminders.stepsToday = 0;
    this.printing.totalJobsToday = 0;
    this.printing.paperUsage.today = 0;
    this.commute.morningRoutine.completed = false;
    this.commute.endOfDayRitual.completed = false;

    for (const device of Object.values(this.energy.devices)) {
      device.dailyKwh = 0;
    }
    this.energy.dailyTotal = 0;
  }

  _updateWeeklyAnalytics() {
    this.analytics.weekly.days.push({ ...this.analytics.daily });

    if (this.analytics.weekly.days.length > 7) {
      this.analytics.weekly.days = this.analytics.weekly.days.slice(-7);
    }

    this.analytics.weekly.totalHours = this.analytics.weekly.days
      .reduce((sum, d) => sum + d.hoursWorked, 0);

    let bestDay = null;
    let bestFocus = 0;
    for (const day of this.analytics.weekly.days) {
      if (day.focusTime > bestFocus) {
        bestFocus = day.focusTime;
        bestDay = day.date;
      }
    }
    this.analytics.weekly.bestFocusDay = bestDay;
    this.analytics.weekly.bestFocusHours = bestFocus;

    this._updateMonthlyAnalytics();
  }

  _updateMonthlyAnalytics() {
    const recentDays = this.analytics.history.slice(-30);
    if (recentDays.length === 0) return;

    this.analytics.monthly.totalHours = recentDays.reduce((s, d) => s + d.hoursWorked, 0);
    this.analytics.monthly.avgDailyHours = this.analytics.monthly.totalHours / recentDays.length;

    // Burnout risk assessment
    if (this.analytics.monthly.avgDailyHours > 10) {
      this.analytics.monthly.burnoutRisk = 'high';
    } else if (this.analytics.monthly.avgDailyHours > 8) {
      this.analytics.monthly.burnoutRisk = 'medium';
    } else {
      this.analytics.monthly.burnoutRisk = 'low';
    }

    // Work-life balance score (100 = perfect)
    const idealHours = 8;
    const deviation = Math.abs(this.analytics.monthly.avgDailyHours - idealHours);
    this.analytics.monthly.workLifeBalance = Math.max(0, Math.round(100 - deviation * 15));
  }

  getProductivityReport(period) {
    switch (period) {
      case 'daily':
        return {
          ...this.analytics.daily,
          productivityScore: this.tasks.dailyProductivityScore,
          pomodorosCycles: this.pomodoro.totalCyclesToday,
          waterIntake: this.ergonomics.waterIntakeToday,
          steps: this.breakActivities.walkReminders.stepsToday
        };
      case 'weekly':
        return { ...this.analytics.weekly };
      case 'monthly':
        return { ...this.analytics.monthly };
      default:
        return {
          daily: this.getProductivityReport('daily'),
          weekly: this.getProductivityReport('weekly'),
          monthly: this.getProductivityReport('monthly')
        };
    }
  }

  // ========================================================
  // Document / Print Management
  // ========================================================
  addPrintJob(job) {
    const entry = {
      id: this.printing.nextJobId++,
      document: job.document || 'Unknown',
      pages: job.pages || 1,
      copies: job.copies || 1,
      color: job.color || false,
      duplex: job.duplex || this.printing.ecoPrintMode,
      status: 'queued',
      createdAt: Date.now()
    };
    this.printing.jobQueue.push(entry);
    this.printing.totalJobsToday++;
    this.printing.paperUsage.today += entry.pages * entry.copies * (entry.duplex ? 0.5 : 1);
    this.printing.paperUsage.week += this.printing.paperUsage.today;
    this.printing.paperUsage.month += this.printing.paperUsage.today;

    this._updateInkLevels(entry);
    this.log(`Print job #${entry.id}: "${entry.document}" — ${entry.pages}pg x${entry.copies} ${entry.color ? 'color' : 'B&W'} ${entry.duplex ? 'duplex' : 'simplex'}`);

    if (this.printing.ecoPrintMode && !entry.duplex) {
      this.log('Eco-print suggestion: Enable duplex printing to save paper');
    }

    return entry.id;
  }

  _updateInkLevels(job) {
    const usage = job.pages * job.copies * 0.5;
    this.printing.inkLevel.black = Math.max(0, this.printing.inkLevel.black - usage);
    if (job.color) {
      this.printing.inkLevel.cyan = Math.max(0, this.printing.inkLevel.cyan - usage * 0.3);
      this.printing.inkLevel.magenta = Math.max(0, this.printing.inkLevel.magenta - usage * 0.3);
      this.printing.inkLevel.yellow = Math.max(0, this.printing.inkLevel.yellow - usage * 0.3);
    }
    this.printing.tonerLevel = Math.max(0, this.printing.tonerLevel - usage * 0.2);

    for (const [color, level] of Object.entries(this.printing.inkLevel)) {
      if (level < 15) {
        this.log(`Low ink warning: ${color} at ${level.toFixed(0)}%`);
      }
    }
    if (this.printing.tonerLevel < 15) {
      this.log(`Low toner warning: ${this.printing.tonerLevel.toFixed(0)}%`);
    }
  }

  scanDocument(destination) {
    const target = destination || this.printing.scanToCloud.folder;
    this.log(`Scanning document to ${this.printing.scanToCloud.provider}:${target}`);
    return {
      status: 'scanned',
      destination: `${this.printing.scanToCloud.provider}:${target}`,
      timestamp: Date.now()
    };
  }

  getPrintStatus() {
    return {
      queue: this.printing.jobQueue.filter(j => j.status === 'queued').length,
      inkLevels: { ...this.printing.inkLevel },
      tonerLevel: this.printing.tonerLevel,
      paperUsage: { ...this.printing.paperUsage },
      ecoPrintMode: this.printing.ecoPrintMode,
      totalJobsToday: this.printing.totalJobsToday
    };
  }

  // ========================================================
  // Work-Life Boundary
  // ========================================================
  _checkWorkHours() {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const currentMinutes = hour * 60 + minute;

    const [startH, startM] = this.workLifeBoundary.workStartTime.split(':').map(Number);
    const [stopH, stopM] = this.workLifeBoundary.hardStopTime.split(':').map(Number);
    const startMinutes = startH * 60 + (startM || 0);
    const stopMinutes = stopH * 60 + (stopM || 0);
    const windDownStart = stopMinutes - this.workLifeBoundary.windDownMinutes;

    this.workLifeBoundary.isWithinWorkHours = currentMinutes >= startMinutes && currentMinutes < stopMinutes;

    if (this.workLifeBoundary.vacationMode) {
      this.workLifeBoundary.isWithinWorkHours = false;
      return;
    }

    if (!this.workLifeBoundary.isWorkDay) {
      if (this.workLifeBoundary.weekendRules.workAllowed) {
        this.log('Weekend work mode — relaxed rules');
      } else {
        this.workLifeBoundary.isWithinWorkHours = false;
        return;
      }
    }

    if (currentMinutes >= windDownStart && currentMinutes < stopMinutes && !this.workLifeBoundary.windDownActive) {
      this.workLifeBoundary.windDownActive = true;
      this._startWindDown(stopMinutes - currentMinutes);
    }

    if (currentMinutes >= stopMinutes && this.workLifeBoundary.isWithinWorkHours) {
      this._enforceHardStop();
    }
  }

  _startWindDown(minutesRemaining) {
    this.log(`Wind-down mode activated — ${minutesRemaining} minutes until hard stop`);

    const station = this._getActiveStation();
    if (station) {
      station.profile.lighting.brightness = Math.max(40, station.profile.lighting.brightness - 15);
      station.profile.lighting.colorTemp = Math.max(3000, station.profile.lighting.colorTemp - 500);
    }

    this._sendNotification('urgent', `Work day ends in ${minutesRemaining} minutes. Time to wrap up!`);
  }

  _enforceHardStop() {
    this.log('Hard stop time reached — triggering end-of-day ritual');
    this.triggerEndOfDayRitual();
    this.workLifeBoundary.windDownActive = false;
  }

  _detectWorkDay() {
    const day = new Date().getDay(); // 0=Sunday, 6=Saturday
    this.workLifeBoundary.isWorkDay = day >= 1 && day <= 5;
    if (!this.workLifeBoundary.isWorkDay) {
      this.log('Weekend detected — applying weekend rules');
    }
  }

  setVacationMode(enabled) {
    this.workLifeBoundary.vacationMode = enabled;
    if (enabled) {
      this.log('Vacation mode enabled — all work features suspended');
      this.collaboration.presenceIndicator = 'away';
      this.stopPomodoro();
      this.exitFocusMode();
    } else {
      this.log('Vacation mode disabled — welcome back!');
      this.collaboration.presenceIndicator = 'available';
    }
  }

  setWorkHours(start, end) {
    this.workLifeBoundary.workStartTime = start;
    this.workLifeBoundary.hardStopTime = end;
    this.log(`Work hours set: ${start} - ${end}`);
  }

  // ========================================================
  // Monitoring Cycle (every 2 minutes)
  // ========================================================
  _startMonitoringCycle() {
    this.monitoringTimer = setInterval(() => {
      this._runMonitoringCycle();
    }, this.monitoringInterval);
    this.log(`Monitoring cycle started (every ${this.monitoringInterval / 60000} minutes)`);
  }

  _runMonitoringCycle() {
    try {
      this._initializeDailyAnalytics();
      this._detectWorkDay();
      this._checkWorkHours();
      this._updateCircadianPhase();
      this._updateAmbientLighting();
      this._checkUpcomingMeetings();
      this._checkQuietHours();
      this._autoPowerOffCheck();
      this._updateWorkHoursTracking();
      this._updateProductivityScore();
      this._calculateBreakCompliance();
    } catch (err) {
      this.error(`Monitoring cycle error: ${err.message}`);
    }
  }

  _updateWorkHoursTracking() {
    if (this.workLifeBoundary.isWithinWorkHours) {
      this.analytics.daily.hoursWorked += this.monitoringInterval / 3600000;
    }
  }

  _calculateBreakCompliance() {
    const expectedBreaks = Math.floor(this.analytics.daily.hoursWorked * 2); // ~2 breaks per hour
    const actualBreaks = this.ergonomics.stretchesCompleted + this.ergonomics.waterIntakeToday;
    this.analytics.daily.breakCompliance = expectedBreaks > 0
      ? Math.min(1, actualBreaks / expectedBreaks)
      : 1;
  }

  // ========================================================
  // Statistics
  // ========================================================
  getStatistics() {
    const uptime = this.startTime ? Date.now() - this.startTime : 0;

    return {
      system: {
        initialized: this.initialized,
        uptime: `${(uptime / 3600000).toFixed(1)} hours`,
        monitoringInterval: `${this.monitoringInterval / 60000} minutes`,
        currentStation: this.workspaces.currentStation || 'none',
        isWorkDay: this.workLifeBoundary.isWorkDay,
        isWithinWorkHours: this.workLifeBoundary.isWithinWorkHours,
        vacationMode: this.workLifeBoundary.vacationMode
      },
      pomodoro: this.getPomodoroStatus(),
      desk: this.getDeskStats(),
      ergonomics: {
        waterIntake: this.ergonomics.waterIntakeToday,
        stretchesCompleted: this.ergonomics.stretchesCompleted,
        enabled: this.ergonomics.enabled
      },
      focusMode: {
        currentMode: this.focusMode.currentMode,
        totalFocusToday: `${(this.focusMode.totalFocusToday / 3600000).toFixed(1)} hours`,
        sessions: this.focusMode.sessions.length
      },
      ambient: {
        phase: this.circadian.currentPhase,
        temperature: this.ambient.currentTemperature,
        humidity: this.ambient.humidity.current,
        co2: this.ambient.co2.current,
        blueFilter: this.circadian.blueFilterActive
      },
      collaboration: {
        presence: this.collaboration.presenceIndicator,
        coWorking: this.collaboration.coWorkingMode.enabled,
        activeMeeting: this.meetings.current ? this.meetings.current.title : 'none'
      },
      productivity: {
        score: this.tasks.dailyProductivityScore,
        hoursWorked: this.analytics.daily.hoursWorked.toFixed(1),
        focusTime: this.analytics.daily.focusTime.toFixed(1),
        meetingTime: this.analytics.daily.meetingTime.toFixed(1),
        tasksCompleted: this.analytics.daily.tasksCompleted,
        breakCompliance: `${(this.analytics.daily.breakCompliance * 100).toFixed(0)}%`
      },
      energy: {
        dailyTotal: this.energy.dailyTotal.toFixed(3) + ' kWh',
        activeDevices: Object.entries(this.energy.devices)
          .filter(([, d]) => d.active).map(([n]) => n).join(', ') || 'none'
      },
      printing: {
        jobsToday: this.printing.totalJobsToday,
        paperToday: this.printing.paperUsage.today,
        tonerLevel: `${this.printing.tonerLevel.toFixed(0)}%`
      },
      steps: this.breakActivities.walkReminders.stepsToday,
      noise: {
        activeGenerator: this.noise.activeNoise || 'none',
        quietHours: this.noise.isInQuietHours,
        backgroundDb: this.noise.backgroundNoiseDb
      },
      burnoutRisk: this.analytics.monthly.burnoutRisk,
      workLifeBalance: this.analytics.monthly.workLifeBalance
    };
  }

  // ========================================================
  // Logging
  // ========================================================
  log(msg) {
    const ts = new Date().toISOString();
    if (this.homey && typeof this.homey.log === 'function') {
      this.homey.log(`[Office] ${msg}`);
    } else {
      console.log(`${ts} [Office] ${msg}`);
    }
  }

  error(msg) {
    const ts = new Date().toISOString();
    if (this.homey && typeof this.homey.error === 'function') {
      this.homey.error(`[Office] ${msg}`);
    } else {
      console.error(`${ts} [Office] ERROR: ${msg}`);
    }
  }

  // ========================================================
  // Cleanup
  // ========================================================
  destroy() {
    this.log('Shutting down Home Office Productivity Hub...');

    if (this.pomodoro.phaseTimer) {
      clearTimeout(this.pomodoro.phaseTimer);
      this.pomodoro.phaseTimer = null;
    }

    if (this.standingDesk.nudgeTimer) {
      clearInterval(this.standingDesk.nudgeTimer);
      this.standingDesk.nudgeTimer = null;
    }

    for (const timer of Object.values(this.ergonomics.timers)) {
      clearInterval(timer);
    }
    this.ergonomics.timers = {};

    if (this.meetings.syncTimer) {
      clearInterval(this.meetings.syncTimer);
      this.meetings.syncTimer = null;
    }

    if (this.energy.trackingTimer) {
      clearInterval(this.energy.trackingTimer);
      this.energy.trackingTimer = null;
    }

    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }

    if (this.ambient.sensorTimer) {
      clearInterval(this.ambient.sensorTimer);
      this.ambient.sensorTimer = null;
    }

    this.initialized = false;
    this.log('Home Office Productivity Hub shut down complete');
  }
}

module.exports = HomeOfficeProductivityHub;
