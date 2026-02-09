'use strict';

const EventEmitter = require('events');

class SmartMirrorDashboardSystem extends EventEmitter {
  constructor(homey) {
    super();
    this.homey = homey;
    this.initialized = false;
    this.intervals = [];

    this.mirrors = new Map();
    this.widgets = new Map();
    this.userProfiles = new Map();
    this.mirrorLayouts = new Map();
    this.gestureHistory = [];
    this.voiceCommandLog = [];
    this.notificationQueue = new Map();
    this.contentSchedules = new Map();
    this.mirrorAnalytics = new Map();
    this.photoAlbum = [];
    this.transitData = {};
    this.weatherData = {};
    this.healthDashboards = new Map();
    this.activeUsers = new Map();
    this.smartHomeControls = [];
    this.maintenanceLog = new Map();

    this._initializeMirrors();
    this._initializeWidgets();
    this._initializeUserProfiles();
    this._initializeMirrorLayouts();
    this._initializeContentSchedules();
    this._initializePhotoAlbum();
    this._initializeTransitData();
    this._initializeWeatherData();
    this._initializeHealthDashboards();
    this._initializeSmartHomeControls();
    this._initializeMaintenanceRecords();
  }

  _initializeMirrors() {
    const mirrorDefs = [
      {
        id: 'bathroom-main', name: 'Bathroom Main Mirror', location: 'bathroom',
        screenSize: 32, resolution: '1920x1080', brightness: 70, status: 'standby',
        motionSensorActive: true, proximityRange: 2.0, autoOnOff: true, sleepTimeout: 300,
        orientation: 'portrait', touchEnabled: true, audioEnabled: true, cameraEnabled: true,
        lastInteraction: null, humiditySensor: true, humiditySensorValue: 55
      },
      {
        id: 'hallway', name: 'Hallway Mirror', location: 'hallway',
        screenSize: 24, resolution: '1280x720', brightness: 60, status: 'standby',
        motionSensorActive: true, proximityRange: 3.0, autoOnOff: true, sleepTimeout: 120,
        orientation: 'portrait', touchEnabled: true, audioEnabled: false, cameraEnabled: true,
        lastInteraction: null, motionSensor: true, motionDetected: false
      },
      {
        id: 'bedroom', name: 'Bedroom Mirror', location: 'bedroom',
        screenSize: 28, resolution: '1920x1080', brightness: 40, status: 'standby',
        motionSensorActive: true, proximityRange: 2.5, autoOnOff: true, sleepTimeout: 600,
        orientation: 'landscape', touchEnabled: true, audioEnabled: true, cameraEnabled: false,
        lastInteraction: null, ambientLightSensor: true, ambientLightLevel: 45
      },
      {
        id: 'gym', name: 'Gym Mirror', location: 'gym',
        screenSize: 40, resolution: '3840x2160', brightness: 85, status: 'standby',
        motionSensorActive: true, proximityRange: 4.0, autoOnOff: true, sleepTimeout: 900,
        orientation: 'landscape', touchEnabled: true, audioEnabled: true, cameraEnabled: true,
        lastInteraction: null, heartRateProximity: true, heartRateValue: null
      }
    ];
    for (const mirror of mirrorDefs) {
      this.mirrors.set(mirror.id, { ...mirror, poweredOn: false, currentTheme: 'auto', activeMode: 'normal' });
    }
  }

  _initializeWidgets() {
    const widgetDefs = [
      { id: 'clock', name: 'Clock', category: 'time', variants: ['analog', 'digital'], defaultVariant: 'digital', refreshInterval: 1, minWidth: 1, minHeight: 1 },
      { id: 'weather', name: 'Weather', category: 'info', variants: ['current', '5-day-forecast'], defaultVariant: 'current', refreshInterval: 600, minWidth: 2, minHeight: 2, location: 'Stockholm' },
      { id: 'calendar', name: 'Calendar', category: 'productivity', variants: ['today', '3-day'], defaultVariant: 'today', refreshInterval: 300, minWidth: 2, minHeight: 2 },
      { id: 'news-headlines', name: 'News Headlines', category: 'info', feeds: ['SVT', 'DN', 'TT', 'tech', 'world'], activeFeed: 'SVT', refreshInterval: 600, minWidth: 2, minHeight: 2 },
      { id: 'commute', name: 'Commute', category: 'transit', variants: ['sl-transit', 'driving-eta'], defaultVariant: 'sl-transit', refreshInterval: 120, minWidth: 2, minHeight: 1, city: 'Stockholm' },
      { id: 'smart-home-status', name: 'Smart Home Status', category: 'home', refreshInterval: 30, minWidth: 2, minHeight: 2 },
      { id: 'health-metrics', name: 'Health Metrics', category: 'health', metrics: ['steps', 'heartRate', 'weight', 'sleepScore'], refreshInterval: 60, minWidth: 2, minHeight: 2 },
      { id: 'todo-list', name: 'To-Do List', category: 'productivity', refreshInterval: 300, minWidth: 2, minHeight: 2 },
      { id: 'spotify-now-playing', name: 'Spotify Now Playing', category: 'media', refreshInterval: 5, minWidth: 2, minHeight: 1 },
      { id: 'email-count', name: 'Email Count', category: 'productivity', refreshInterval: 300, minWidth: 1, minHeight: 1 },
      { id: 'package-tracking', name: 'Package Tracking', category: 'info', refreshInterval: 1800, minWidth: 2, minHeight: 1 },
      { id: 'air-quality', name: 'Air Quality', category: 'environment', refreshInterval: 300, minWidth: 1, minHeight: 1 },
      { id: 'energy-usage', name: 'Energy Usage', category: 'home', refreshInterval: 60, minWidth: 2, minHeight: 1 },
      { id: 'motivational-quote', name: 'Motivational Quote', category: 'lifestyle', refreshInterval: 3600, minWidth: 2, minHeight: 1 },
      { id: 'photo-slideshow', name: 'Photo Slideshow', category: 'media', refreshInterval: 15, minWidth: 2, minHeight: 2, transitionEffect: 'fade', displayDuration: 10 },
      { id: 'room-temperature', name: 'Room Temperature', category: 'environment', refreshInterval: 60, minWidth: 1, minHeight: 1 },
      { id: 'workout-timer', name: 'Workout Timer', category: 'health', refreshInterval: 1, minWidth: 1, minHeight: 1 },
      { id: 'medication-reminders', name: 'Medication Reminders', category: 'health', refreshInterval: 60, minWidth: 2, minHeight: 1 },
      { id: 'birthday-reminders', name: 'Birthday Reminders', category: 'lifestyle', refreshInterval: 3600, minWidth: 1, minHeight: 1 },
      { id: 'grocery-list', name: 'Grocery List', category: 'productivity', refreshInterval: 300, minWidth: 2, minHeight: 2 },
      { id: 'outfit-suggestion', name: 'Outfit Suggestion', category: 'lifestyle', refreshInterval: 3600, minWidth: 2, minHeight: 2, basedOn: 'weather' }
    ];
    for (const widget of widgetDefs) {
      this.widgets.set(widget.id, { ...widget, data: null, lastUpdated: null, errorCount: 0 });
    }
  }

  _initializeUserProfiles() {
    const users = [
      {
        id: 'user-1', name: 'Erik', preferredWidgets: ['clock', 'weather', 'commute', 'calendar', 'news-headlines', 'spotify-now-playing'],
        personalCalendar: 'erik-cal', healthMetrics: { steps: 8500, heartRate: 68, weight: 78, sleepScore: 82 },
        commuteRoute: { from: 'Södermalm', to: 'Kista', mode: 'transit', stopId: 'sl-1001' },
        musicPreference: 'indie-rock', greetingMessage: 'God morgon, Erik!', avatar: 'erik-avatar.png',
        preferredLanguage: 'sv', faceSignature: 'face-sig-erik'
      },
      {
        id: 'user-2', name: 'Anna', preferredWidgets: ['clock', 'weather', 'calendar', 'health-metrics', 'todo-list', 'email-count'],
        personalCalendar: 'anna-cal', healthMetrics: { steps: 10200, heartRate: 62, weight: 64, sleepScore: 90 },
        commuteRoute: { from: 'Södermalm', to: 'Gamla Stan', mode: 'transit', stopId: 'sl-1002' },
        musicPreference: 'classical', greetingMessage: 'God morgon, Anna!', avatar: 'anna-avatar.png',
        preferredLanguage: 'sv', faceSignature: 'face-sig-anna'
      },
      {
        id: 'user-3', name: 'Oscar', preferredWidgets: ['clock', 'weather', 'workout-timer', 'health-metrics', 'spotify-now-playing', 'motivational-quote'],
        personalCalendar: 'oscar-cal', healthMetrics: { steps: 12000, heartRate: 58, weight: 82, sleepScore: 75 },
        commuteRoute: { from: 'Södermalm', to: 'Solna', mode: 'driving', stopId: null },
        musicPreference: 'hip-hop', greetingMessage: 'Tjena Oscar!', avatar: 'oscar-avatar.png',
        preferredLanguage: 'sv', faceSignature: 'face-sig-oscar'
      },
      {
        id: 'user-4', name: 'Maja', preferredWidgets: ['clock', 'weather', 'photo-slideshow', 'birthday-reminders', 'grocery-list', 'outfit-suggestion'],
        personalCalendar: 'maja-cal', healthMetrics: { steps: 6500, heartRate: 72, weight: 55, sleepScore: 88 },
        commuteRoute: { from: 'Södermalm', to: 'Östermalm', mode: 'transit', stopId: 'sl-1003' },
        musicPreference: 'pop', greetingMessage: 'Hej Maja!', avatar: 'maja-avatar.png',
        preferredLanguage: 'en', faceSignature: 'face-sig-maja'
      }
    ];
    for (const user of users) {
      this.userProfiles.set(user.id, { ...user, lastSeen: null, totalInteractions: 0, engagementMinutes: 0 });
    }
  }

  _initializeMirrorLayouts() {
    const layouts = {
      'bathroom-main': {
        columns: 3, rows: 5, theme: 'auto',
        widgets: [
          { widgetId: 'clock', col: 0, row: 0, width: 1, height: 1 },
          { widgetId: 'weather', col: 1, row: 0, width: 2, height: 2 },
          { widgetId: 'calendar', col: 0, row: 1, width: 1, height: 2 },
          { widgetId: 'health-metrics', col: 0, row: 3, width: 2, height: 2 },
          { widgetId: 'medication-reminders', col: 2, row: 2, width: 1, height: 1 },
          { widgetId: 'room-temperature', col: 2, row: 3, width: 1, height: 1 }
        ],
        enabledWidgets: ['clock', 'weather', 'calendar', 'health-metrics', 'medication-reminders', 'room-temperature']
      },
      'hallway': {
        columns: 2, rows: 4, theme: 'dark',
        widgets: [
          { widgetId: 'clock', col: 0, row: 0, width: 1, height: 1 },
          { widgetId: 'weather', col: 1, row: 0, width: 1, height: 1 },
          { widgetId: 'commute', col: 0, row: 1, width: 2, height: 1 },
          { widgetId: 'package-tracking', col: 0, row: 2, width: 2, height: 1 },
          { widgetId: 'smart-home-status', col: 0, row: 3, width: 2, height: 1 }
        ],
        enabledWidgets: ['clock', 'weather', 'commute', 'package-tracking', 'smart-home-status']
      },
      'bedroom': {
        columns: 4, rows: 3, theme: 'auto',
        widgets: [
          { widgetId: 'clock', col: 0, row: 0, width: 1, height: 1 },
          { widgetId: 'weather', col: 1, row: 0, width: 2, height: 1 },
          { widgetId: 'spotify-now-playing', col: 3, row: 0, width: 1, height: 1 },
          { widgetId: 'calendar', col: 0, row: 1, width: 2, height: 2 },
          { widgetId: 'news-headlines', col: 2, row: 1, width: 2, height: 1 },
          { widgetId: 'photo-slideshow', col: 2, row: 2, width: 2, height: 1 }
        ],
        enabledWidgets: ['clock', 'weather', 'spotify-now-playing', 'calendar', 'news-headlines', 'photo-slideshow']
      },
      'gym': {
        columns: 4, rows: 3, theme: 'dark',
        widgets: [
          { widgetId: 'clock', col: 0, row: 0, width: 1, height: 1 },
          { widgetId: 'workout-timer', col: 1, row: 0, width: 1, height: 1 },
          { widgetId: 'health-metrics', col: 2, row: 0, width: 2, height: 2 },
          { widgetId: 'spotify-now-playing', col: 0, row: 1, width: 2, height: 1 },
          { widgetId: 'motivational-quote', col: 0, row: 2, width: 2, height: 1 },
          { widgetId: 'energy-usage', col: 2, row: 2, width: 2, height: 1 }
        ],
        enabledWidgets: ['clock', 'workout-timer', 'health-metrics', 'spotify-now-playing', 'motivational-quote', 'energy-usage']
      }
    };
    for (const [mirrorId, layout] of Object.entries(layouts)) {
      this.mirrorLayouts.set(mirrorId, layout);
    }
  }

  _initializeContentSchedules() {
    const schedules = {
      morning: { start: 6, end: 11, widgets: ['weather', 'commute', 'calendar', 'clock', 'news-headlines', 'outfit-suggestion'], brightness: 70 },
      afternoon: { start: 11, end: 17, widgets: ['energy-usage', 'package-tracking', 'todo-list', 'clock', 'smart-home-status', 'grocery-list'], brightness: 80 },
      evening: { start: 17, end: 22, widgets: ['spotify-now-playing', 'health-metrics', 'photo-slideshow', 'clock', 'news-headlines', 'air-quality'], brightness: 55 },
      night: { start: 22, end: 6, widgets: ['clock'], brightness: 10 }
    };
    for (const [period, schedule] of Object.entries(schedules)) {
      this.contentSchedules.set(period, schedule);
    }
  }

  _initializePhotoAlbum() {
    for (let i = 1; i <= 50; i++) {
      this.photoAlbum.push({
        id: `photo-${i}`,
        filename: `family-photo-${String(i).padStart(3, '0')}.jpg`,
        album: i <= 15 ? 'vacations' : i <= 30 ? 'holidays' : i <= 40 ? 'everyday' : 'milestones',
        dateTaken: new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString(),
        tags: this._generatePhotoTags(i),
        favorite: i % 7 === 0,
        displayCount: 0,
        lastDisplayed: null
      });
    }
  }

  _generatePhotoTags(index) {
    const tagSets = [
      ['family', 'summer', 'outdoor'], ['birthday', 'celebration'], ['holiday', 'christmas'],
      ['vacation', 'beach'], ['kids', 'school'], ['pets', 'garden'], ['dinner', 'family'],
      ['sports', 'weekend'], ['nature', 'hiking'], ['cooking', 'kitchen']
    ];
    return tagSets[index % tagSets.length];
  }

  _initializeTransitData() {
    this.transitData = {
      provider: 'SL',
      city: 'Stockholm',
      stops: [
        { stopId: 'sl-1001', name: 'Södermalm T-bana', lines: ['T14', 'T17'], nextDepartures: [] },
        { stopId: 'sl-1002', name: 'Medborgarplatsen', lines: ['T17', 'T18', 'T19'], nextDepartures: [] },
        { stopId: 'sl-1003', name: 'Slussen', lines: ['T13', 'T14', 'Bus 2', 'Bus 3'], nextDepartures: [] }
      ],
      disruptions: [],
      lastUpdated: null
    };
  }

  _initializeWeatherData() {
    this.weatherData = {
      location: 'Stockholm',
      current: {
        temp: -2, feelsLike: -6, humidity: 78, windSpeed: 5.2, windDirection: 'SW',
        uvIndex: 1, condition: 'partly-cloudy', icon: 'cloud-sun',
        sunrise: '08:15', sunset: '16:45', pressure: 1013, visibility: 8
      },
      forecast: [
        { day: 'Monday', high: 0, low: -5, condition: 'snow', precipitation: 60, icon: 'snowflake' },
        { day: 'Tuesday', high: 1, low: -3, condition: 'cloudy', precipitation: 20, icon: 'cloud' },
        { day: 'Wednesday', high: 3, low: -1, condition: 'partly-cloudy', precipitation: 10, icon: 'cloud-sun' },
        { day: 'Thursday', high: -2, low: -8, condition: 'clear', precipitation: 0, icon: 'sun' },
        { day: 'Friday', high: -1, low: -6, condition: 'snow', precipitation: 70, icon: 'snowflake' }
      ],
      alerts: [],
      pollenCount: { tree: 'low', grass: 'none', weed: 'none', overall: 'low' },
      lastUpdated: null
    };
  }

  _initializeHealthDashboards() {
    for (const [userId, profile] of this.userProfiles) {
      this.healthDashboards.set(userId, {
        userId,
        dailySteps: profile.healthMetrics.steps,
        stepGoal: 10000,
        weightTrend: this._generateWeightTrend(profile.healthMetrics.weight),
        sleepScore: profile.healthMetrics.sleepScore,
        heartRate: profile.healthMetrics.heartRate,
        heartRateHistory: this._generateHeartRateHistory(profile.healthMetrics.heartRate),
        hydrationGlasses: Math.floor(Math.random() * 6) + 2,
        hydrationGoal: 8,
        hydrationReminders: true,
        medications: this._generateMedications(userId),
        lastUpdated: null
      });
    }
  }

  _generateWeightTrend(currentWeight) {
    const trend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      trend.push({ date: d.toISOString().split('T')[0], weight: currentWeight + (Math.random() * 2 - 1) });
    }
    return trend;
  }

  _generateHeartRateHistory(baseRate) {
    const history = [];
    for (let h = 0; h < 24; h++) {
      history.push({ hour: h, bpm: baseRate + Math.floor(Math.random() * 20 - 10) });
    }
    return history;
  }

  _generateMedications(userId) {
    const meds = {
      'user-1': [{ name: 'Vitamin D', time: '08:00', taken: false }, { name: 'Omega-3', time: '08:00', taken: false }],
      'user-2': [{ name: 'Iron supplement', time: '07:30', taken: false }],
      'user-3': [{ name: 'Protein shake', time: '07:00', taken: false }, { name: 'Creatine', time: '16:00', taken: false }],
      'user-4': [{ name: 'Multivitamin', time: '08:30', taken: false }]
    };
    return meds[userId] || [];
  }

  _initializeSmartHomeControls() {
    this.smartHomeControls = [
      { id: 'ctrl-lights-living', type: 'light', name: 'Living Room Lights', room: 'living-room', state: true, brightness: 80, color: '#FFF4E0' },
      { id: 'ctrl-lights-bedroom', type: 'light', name: 'Bedroom Lights', room: 'bedroom', state: false, brightness: 40, color: '#FFD700' },
      { id: 'ctrl-lights-kitchen', type: 'light', name: 'Kitchen Lights', room: 'kitchen', state: true, brightness: 100, color: '#FFFFFF' },
      { id: 'ctrl-thermo-main', type: 'thermostat', name: 'Main Thermostat', room: 'hallway', currentTemp: 21.5, targetTemp: 22, mode: 'auto' },
      { id: 'ctrl-thermo-bedroom', type: 'thermostat', name: 'Bedroom Thermostat', room: 'bedroom', currentTemp: 19.8, targetTemp: 20, mode: 'sleep' },
      { id: 'ctrl-lock-front', type: 'lock', name: 'Front Door', room: 'entrance', locked: true, lastChanged: null },
      { id: 'ctrl-lock-back', type: 'lock', name: 'Back Door', room: 'garden', locked: true, lastChanged: null },
      { id: 'ctrl-camera-front', type: 'camera', name: 'Front Camera', room: 'entrance', streaming: false, recording: true },
      { id: 'ctrl-camera-garden', type: 'camera', name: 'Garden Camera', room: 'garden', streaming: false, recording: true },
      { id: 'ctrl-scene-morning', type: 'scene', name: 'Morning Routine', active: false },
      { id: 'ctrl-scene-evening', type: 'scene', name: 'Evening Relax', active: false },
      { id: 'ctrl-scene-away', type: 'scene', name: 'Away Mode', active: false }
    ];
  }

  _initializeMaintenanceRecords() {
    for (const [mirrorId] of this.mirrors) {
      this.maintenanceLog.set(mirrorId, {
        firmwareVersion: '2.4.1',
        lastFirmwareCheck: null,
        screenCleaningReminder: false,
        lastCleaned: null,
        cleaningIntervalDays: 7,
        wifiSignalStrength: -45 + Math.floor(Math.random() * 20),
        memoryUsagePercent: 30 + Math.floor(Math.random() * 30),
        uptimeHours: 0,
        errorLog: [],
        lastReboot: null
      });
    }
  }

  async initialize() {
    try {
      this.homey.log('[SmartMirror] Initializing Smart Mirror Dashboard System...');

      this._initializeAnalytics();
      this._startPresenceDetectionLoop();
      this._startWidgetRefreshLoop();
      this._startContentScheduleLoop();
      this._startAmbientAdaptationLoop();
      this._startNotificationProcessingLoop();
      this._startTransitUpdateLoop();
      this._startWeatherUpdateLoop();
      this._startHealthReminderLoop();
      this._startMaintenanceCheckLoop();
      this._startPhotoRotationLoop();
      this._startAnalyticsAggregationLoop();

      this.initialized = true;
      this.homey.log('[SmartMirror] System initialized with ' + this.mirrors.size + ' mirrors and ' + this.widgets.size + ' widgets');
      this.homey.emit('smart-mirror-initialized', { mirrors: this.mirrors.size, widgets: this.widgets.size });
    } catch (err) {
      this.homey.error('[SmartMirror] Initialization failed:', err.message);
      throw err;
    }
  }

  _initializeAnalytics() {
    for (const [mirrorId] of this.mirrors) {
      this.mirrorAnalytics.set(mirrorId, {
        totalUsageMinutes: 0,
        sessionsToday: 0,
        widgetUsage: {},
        peakUsageHours: new Array(24).fill(0),
        gestureAccuracy: 100,
        totalGestures: 0,
        successfulGestures: 0,
        userEngagement: {},
        dailyStats: []
      });
    }
  }

  _startPresenceDetectionLoop() {
    const interval = setInterval(() => {
      this._runPresenceDetection();
    }, 5000);
    this.intervals.push(interval);
  }

  _runPresenceDetection() {
    for (const [mirrorId, mirror] of this.mirrors) {
      if (!mirror.motionSensorActive) continue;
      const detected = Math.random() > 0.6;
      if (detected) {
        const detectedUserId = this._identifyUser();
        if (detectedUserId) {
          this._activateMirrorForUser(mirrorId, detectedUserId);
        } else {
          this._activateMirrorForGuest(mirrorId);
        }
      } else if (mirror.poweredOn && mirror.lastInteraction) {
        const elapsed = Date.now() - new Date(mirror.lastInteraction).getTime();
        if (elapsed > mirror.sleepTimeout * 1000) {
          this._sleepMirror(mirrorId);
        }
      }
    }
  }

  _identifyUser() {
    const profileIds = Array.from(this.userProfiles.keys());
    const roll = Math.random();
    if (roll < 0.7) {
      return profileIds[Math.floor(Math.random() * profileIds.length)];
    }
    return null;
  }

  _activateMirrorForUser(mirrorId, userId) {
    const mirror = this.mirrors.get(mirrorId);
    const user = this.userProfiles.get(userId);
    if (!mirror || !user) return;

    mirror.poweredOn = true;
    mirror.status = 'active';
    mirror.lastInteraction = new Date().toISOString();
    this.activeUsers.set(mirrorId, userId);

    user.lastSeen = new Date().toISOString();
    user.totalInteractions += 1;

    this.homey.log('[SmartMirror] Mirror ' + mirrorId + ' activated for user ' + user.name);
    this.homey.emit('smart-mirror-user-detected', { mirrorId, userId, userName: user.name });

    this._applyUserLayout(mirrorId, userId);

    const analytics = this.mirrorAnalytics.get(mirrorId);
    if (analytics) {
      analytics.sessionsToday += 1;
      const hour = new Date().getHours();
      analytics.peakUsageHours[hour] += 1;
      if (!analytics.userEngagement[userId]) {
        analytics.userEngagement[userId] = { sessions: 0, totalMinutes: 0 };
      }
      analytics.userEngagement[userId].sessions += 1;
    }
  }

  _activateMirrorForGuest(mirrorId) {
    const mirror = this.mirrors.get(mirrorId);
    if (!mirror) return;

    mirror.poweredOn = true;
    mirror.status = 'active';
    mirror.lastInteraction = new Date().toISOString();
    this.activeUsers.set(mirrorId, 'guest');

    this.homey.log('[SmartMirror] Mirror ' + mirrorId + ' activated for guest');
    this.homey.emit('smart-mirror-guest-detected', { mirrorId });
  }

  _applyUserLayout(mirrorId, userId) {
    const user = this.userProfiles.get(userId);
    const layout = this.mirrorLayouts.get(mirrorId);
    if (!user || !layout) return;

    const personalizedWidgets = user.preferredWidgets.filter(wId => this.widgets.has(wId));
    this.homey.log('[SmartMirror] Applied ' + personalizedWidgets.length + ' preferred widgets for ' + user.name + ' on ' + mirrorId);
  }

  _sleepMirror(mirrorId) {
    const mirror = this.mirrors.get(mirrorId);
    if (!mirror || !mirror.poweredOn) return;

    mirror.poweredOn = false;
    mirror.status = 'standby';
    mirror.activeMode = 'sleep';
    this.activeUsers.delete(mirrorId);

    this.homey.log('[SmartMirror] Mirror ' + mirrorId + ' entered sleep mode');
    this.homey.emit('smart-mirror-sleep', { mirrorId });
  }

  _startWidgetRefreshLoop() {
    const interval = setInterval(() => {
      this._refreshActiveWidgets();
    }, 10000);
    this.intervals.push(interval);
  }

  _refreshActiveWidgets() {
    for (const [mirrorId, mirror] of this.mirrors) {
      if (!mirror.poweredOn) continue;
      const layout = this.mirrorLayouts.get(mirrorId);
      if (!layout) continue;

      for (const widgetId of layout.enabledWidgets) {
        const widget = this.widgets.get(widgetId);
        if (!widget) continue;

        const now = Date.now();
        const lastUpdate = widget.lastUpdated ? new Date(widget.lastUpdated).getTime() : 0;
        if (now - lastUpdate >= widget.refreshInterval * 1000) {
          this._refreshWidget(widgetId, mirrorId);
        }
      }
    }
  }

  _refreshWidget(widgetId, mirrorId) {
    const widget = this.widgets.get(widgetId);
    if (!widget) return;

    try {
      switch (widgetId) {
        case 'clock': widget.data = { time: new Date().toISOString(), variant: widget.defaultVariant }; break;
        case 'weather': widget.data = { ...this.weatherData }; break;
        case 'calendar': widget.data = this._getCalendarData(mirrorId); break;
        case 'news-headlines': widget.data = this._getNewsData(widget.activeFeed); break;
        case 'commute': widget.data = this._getCommuteData(mirrorId); break;
        case 'smart-home-status': widget.data = this._getSmartHomeStatusData(); break;
        case 'health-metrics': widget.data = this._getHealthData(mirrorId); break;
        case 'todo-list': widget.data = this._getTodoData(); break;
        case 'spotify-now-playing': widget.data = this._getSpotifyData(); break;
        case 'email-count': widget.data = { unread: Math.floor(Math.random() * 15), total: 142 }; break;
        case 'package-tracking': widget.data = this._getPackageData(); break;
        case 'air-quality': widget.data = { aqi: 42, level: 'good', pm25: 8, pm10: 15 }; break;
        case 'energy-usage': widget.data = { todayKwh: 12.4, monthKwh: 287, solarGenerated: 3.2, gridImport: 9.2 }; break;
        case 'motivational-quote': widget.data = this._getQuoteData(); break;
        case 'photo-slideshow': widget.data = this._getNextPhoto(); break;
        case 'room-temperature': widget.data = this._getRoomTempData(mirrorId); break;
        case 'workout-timer': widget.data = { active: false, elapsed: 0, sets: 0, restTime: 60 }; break;
        case 'medication-reminders': widget.data = this._getMedicationData(mirrorId); break;
        case 'birthday-reminders': widget.data = this._getBirthdayData(); break;
        case 'grocery-list': widget.data = this._getGroceryData(); break;
        case 'outfit-suggestion': widget.data = this._getOutfitSuggestion(); break;
        default: break;
      }
      widget.lastUpdated = new Date().toISOString();

      const analytics = this.mirrorAnalytics.get(mirrorId);
      if (analytics) {
        analytics.widgetUsage[widgetId] = (analytics.widgetUsage[widgetId] || 0) + 1;
      }
    } catch (err) {
      widget.errorCount += 1;
      this.homey.error('[SmartMirror] Widget refresh error for ' + widgetId + ': ' + err.message);
    }
  }

  _getCalendarData(mirrorId) {
    const userId = this.activeUsers.get(mirrorId);
    const events = [
      { title: 'Team standup', time: '09:00', duration: 15 },
      { title: 'Lunch med Anders', time: '12:00', duration: 60 },
      { title: 'Dentist appointment', time: '15:30', duration: 45 },
      { title: 'Grocery shopping', time: '17:00', duration: 30 }
    ];
    return { userId: userId || 'guest', today: events, upcoming: [{ date: 'tomorrow', title: 'Book club', time: '18:00' }] };
  }

  _getNewsData(feed) {
    const headlines = {
      SVT: ['Stockholm investerar i ny tunnelbanelinje', 'Vintern slår rekord i Norrland', 'Nya klimatmål presenterade'],
      DN: ['Bostadspriserna stabiliseras', 'Kulturhuset öppnar ny utställning', 'Sportens stora nyheter'],
      TT: ['Regeringen presenterar ny budget', 'EU-toppmöte i Bryssel', 'Vädret: Snö väntas i helgen'],
      tech: ['AI breakthrough in language models', 'New smart home standard launched', 'Stockholm tech hub growing'],
      world: ['Global climate summit results', 'Space exploration milestone', 'International trade update']
    };
    return { feed, headlines: headlines[feed] || [], lastUpdated: new Date().toISOString() };
  }

  _getCommuteData(mirrorId) {
    const userId = this.activeUsers.get(mirrorId);
    const user = userId ? this.userProfiles.get(userId) : null;
    if (!user || !user.commuteRoute) {
      return { available: false };
    }
    const route = user.commuteRoute;
    const stop = this.transitData.stops.find(s => s.stopId === route.stopId);
    return {
      available: true,
      from: route.from,
      to: route.to,
      mode: route.mode,
      stopName: stop ? stop.name : 'Unknown',
      nextDepartures: stop ? stop.nextDepartures : [],
      drivingEta: route.mode === 'driving' ? Math.floor(Math.random() * 15) + 20 + ' min' : null,
      disruptions: this.transitData.disruptions
    };
  }

  _getSmartHomeStatusData() {
    const lightsOn = this.smartHomeControls.filter(c => c.type === 'light' && c.state).length;
    const totalLights = this.smartHomeControls.filter(c => c.type === 'light').length;
    const doorsLocked = this.smartHomeControls.filter(c => c.type === 'lock' && c.locked).length;
    const totalLocks = this.smartHomeControls.filter(c => c.type === 'lock').length;
    const avgTemp = this.smartHomeControls.filter(c => c.type === 'thermostat')
      .reduce((sum, c) => sum + c.currentTemp, 0) / Math.max(1, this.smartHomeControls.filter(c => c.type === 'thermostat').length);
    return { lightsOn, totalLights, doorsLocked, totalLocks, avgTemp: Math.round(avgTemp * 10) / 10, camerasRecording: 2, activeScenes: 0 };
  }

  _getHealthData(mirrorId) {
    const userId = this.activeUsers.get(mirrorId);
    if (!userId || userId === 'guest') return { available: false };
    const health = this.healthDashboards.get(userId);
    if (!health) return { available: false };
    return {
      available: true,
      steps: health.dailySteps,
      stepGoal: health.stepGoal,
      stepProgress: Math.round((health.dailySteps / health.stepGoal) * 100),
      heartRate: health.heartRate,
      sleepScore: health.sleepScore,
      weight: health.weightTrend[health.weightTrend.length - 1].weight.toFixed(1),
      hydration: health.hydrationGlasses + '/' + health.hydrationGoal
    };
  }

  _getTodoData() {
    return {
      tasks: [
        { id: 1, text: 'Buy groceries', done: false, priority: 'high' },
        { id: 2, text: 'Fix bathroom light', done: true, priority: 'medium' },
        { id: 3, text: 'Call insurance company', done: false, priority: 'high' },
        { id: 4, text: 'Water plants', done: false, priority: 'low' },
        { id: 5, text: 'Prepare dinner', done: false, priority: 'medium' }
      ]
    };
  }

  _getSpotifyData() {
    const tracks = [
      { title: 'Blinding Lights', artist: 'The Weeknd', album: 'After Hours', progress: 65 },
      { title: 'Midnight Rain', artist: 'Taylor Swift', album: 'Midnights', progress: 30 },
      { title: 'As It Was', artist: 'Harry Styles', album: "Harry's House", progress: 80 }
    ];
    return { playing: Math.random() > 0.3, track: tracks[Math.floor(Math.random() * tracks.length)] };
  }

  _getPackageData() {
    return {
      packages: [
        { carrier: 'PostNord', trackingId: 'PN123456789SE', status: 'In transit', eta: 'Tomorrow' },
        { carrier: 'DHL', trackingId: 'DHL987654', status: 'Out for delivery', eta: 'Today' }
      ]
    };
  }

  _getQuoteData() {
    const quotes = [
      { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
      { text: 'Innovation distinguishes between a leader and a follower.', author: 'Steve Jobs' },
      { text: 'Stay hungry, stay foolish.', author: 'Stewart Brand' },
      { text: 'The future belongs to those who believe in the beauty of their dreams.', author: 'Eleanor Roosevelt' },
      { text: 'It does not matter how slowly you go as long as you do not stop.', author: 'Confucius' },
      { text: 'Believe you can and you are halfway there.', author: 'Theodore Roosevelt' }
    ];
    return quotes[Math.floor(Math.random() * quotes.length)];
  }

  _getNextPhoto() {
    if (this.photoAlbum.length === 0) return null;
    const leastShown = this.photoAlbum.reduce((min, p) => p.displayCount < min.displayCount ? p : min, this.photoAlbum[0]);
    leastShown.displayCount += 1;
    leastShown.lastDisplayed = new Date().toISOString();
    return { photo: leastShown, transitionEffect: 'fade', displayDuration: 10 };
  }

  _getRoomTempData(mirrorId) {
    const mirror = this.mirrors.get(mirrorId);
    if (!mirror) return { temp: 21, humidity: 50 };
    const thermostat = this.smartHomeControls.find(c => c.type === 'thermostat' && c.room === mirror.location);
    return {
      temp: thermostat ? thermostat.currentTemp : 21,
      targetTemp: thermostat ? thermostat.targetTemp : 22,
      humidity: mirror.humiditySensor ? mirror.humiditySensorValue : 50
    };
  }

  _getMedicationData(mirrorId) {
    const userId = this.activeUsers.get(mirrorId);
    if (!userId || userId === 'guest') return { reminders: [] };
    const health = this.healthDashboards.get(userId);
    return { reminders: health ? health.medications : [] };
  }

  _getBirthdayData() {
    return {
      upcoming: [
        { name: 'Farmor Lisa', date: 'Feb 14', daysUntil: 5 },
        { name: 'Cousin Marcus', date: 'Feb 22', daysUntil: 13 },
        { name: 'Colleague Sara', date: 'Mar 1', daysUntil: 20 }
      ]
    };
  }

  _getGroceryData() {
    return {
      items: [
        { name: 'Mjölk', quantity: '2L', category: 'dairy', checked: false },
        { name: 'Bröd', quantity: '1', category: 'bakery', checked: false },
        { name: 'Tomater', quantity: '500g', category: 'produce', checked: true },
        { name: 'Kyckling', quantity: '1kg', category: 'meat', checked: false },
        { name: 'Ris', quantity: '1kg', category: 'grains', checked: false },
        { name: 'Ägg', quantity: '12-pack', category: 'dairy', checked: false }
      ]
    };
  }

  _getOutfitSuggestion() {
    const temp = this.weatherData.current ? this.weatherData.current.temp : 5;
    const condition = this.weatherData.current ? this.weatherData.current.condition : 'cloudy';
    let suggestion;
    if (temp < -5) {
      suggestion = { top: 'Heavy winter jacket', bottom: 'Thermal pants', accessories: ['Warm hat', 'Thick gloves', 'Scarf'], footwear: 'Winter boots' };
    } else if (temp < 5) {
      suggestion = { top: 'Winter coat', bottom: 'Jeans with thermal layer', accessories: ['Beanie', 'Gloves'], footwear: 'Insulated boots' };
    } else if (temp < 15) {
      suggestion = { top: 'Light jacket', bottom: 'Jeans', accessories: ['Light scarf'], footwear: 'Sneakers' };
    } else {
      suggestion = { top: 'T-shirt', bottom: 'Shorts', accessories: ['Sunglasses'], footwear: 'Sandals' };
    }
    if (condition === 'snow' || condition === 'rain') {
      suggestion.accessories.push('Umbrella');
    }
    suggestion.basedOnTemp = temp;
    suggestion.basedOnCondition = condition;
    return suggestion;
  }

  _startContentScheduleLoop() {
    const interval = setInterval(() => {
      this._applyContentSchedule();
    }, 60000);
    this.intervals.push(interval);
  }

  _applyContentSchedule() {
    const hour = new Date().getHours();
    let activePeriod = null;
    for (const [period, schedule] of this.contentSchedules) {
      if (schedule.start < schedule.end) {
        if (hour >= schedule.start && hour < schedule.end) { activePeriod = period; break; }
      } else {
        if (hour >= schedule.start || hour < schedule.end) { activePeriod = period; break; }
      }
    }
    if (!activePeriod) return;

    const schedule = this.contentSchedules.get(activePeriod);
    for (const [mirrorId, mirror] of this.mirrors) {
      if (!mirror.poweredOn) continue;
      const userId = this.activeUsers.get(mirrorId);
      if (userId && userId !== 'guest') continue;

      mirror.brightness = schedule.brightness;
      this.homey.log('[SmartMirror] Applied ' + activePeriod + ' schedule to mirror ' + mirrorId);
    }
  }

  _startAmbientAdaptationLoop() {
    const interval = setInterval(() => {
      this._adaptAmbient();
    }, 30000);
    this.intervals.push(interval);
  }

  _adaptAmbient() {
    const hour = new Date().getHours();
    for (const [mirrorId, mirror] of this.mirrors) {
      if (!mirror.poweredOn) continue;

      if (mirror.ambientLightSensor) {
        const lightLevel = mirror.ambientLightLevel;
        const targetBrightness = Math.max(5, Math.min(100, Math.round(lightLevel * 1.2)));
        mirror.brightness = targetBrightness;
      }

      const layout = this.mirrorLayouts.get(mirrorId);
      if (layout && layout.theme === 'auto') {
        mirror.currentTheme = (hour >= 7 && hour < 19) ? 'light' : 'dark';
      }

      if (hour >= 23 || hour < 5) {
        if (mirror.activeMode !== 'night') {
          mirror.activeMode = 'night';
          mirror.brightness = Math.min(mirror.brightness, 10);
          this.homey.log('[SmartMirror] Night mode activated on ' + mirrorId);
          this.homey.emit('smart-mirror-night-mode', { mirrorId });
        }
      } else {
        if (mirror.activeMode === 'night') {
          mirror.activeMode = 'normal';
        }
      }
    }
  }

  _startNotificationProcessingLoop() {
    const interval = setInterval(() => {
      this._processNotifications();
    }, 5000);
    this.intervals.push(interval);
  }

  _processNotifications() {
    for (const [mirrorId, queue] of this.notificationQueue) {
      if (queue.length === 0) continue;
      const mirror = this.mirrors.get(mirrorId);
      if (!mirror || !mirror.poweredOn) continue;

      const notification = queue[0];
      const now = Date.now();
      if (notification.displayedAt && (now - notification.displayedAt > (notification.autoDismissMs || 10000))) {
        queue.shift();
        this.homey.log('[SmartMirror] Notification dismissed on ' + mirrorId + ': ' + notification.title);
      } else if (!notification.displayedAt) {
        notification.displayedAt = now;
        this.homey.emit('smart-mirror-notification-shown', { mirrorId, notification });
      }
    }
  }

  pushNotification(mirrorId, notification) {
    if (!this.notificationQueue.has(mirrorId)) {
      this.notificationQueue.set(mirrorId, []);
    }
    const queue = this.notificationQueue.get(mirrorId);
    const entry = {
      id: 'notif-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      title: notification.title || 'Alert',
      message: notification.message || '',
      priority: notification.priority || 'normal',
      icon: notification.icon || 'info',
      autoDismissMs: notification.autoDismissMs || 10000,
      createdAt: new Date().toISOString(),
      displayedAt: null
    };

    if (entry.priority === 'critical') {
      queue.unshift(entry);
    } else {
      queue.push(entry);
    }

    this.homey.log('[SmartMirror] Notification queued for ' + mirrorId + ': ' + entry.title);
    return entry.id;
  }

  pushNotificationToNearest(notification) {
    let nearest = null;
    let latestInteraction = 0;
    for (const [mirrorId, mirror] of this.mirrors) {
      if (mirror.poweredOn && mirror.lastInteraction) {
        const ts = new Date(mirror.lastInteraction).getTime();
        if (ts > latestInteraction) {
          latestInteraction = ts;
          nearest = mirrorId;
        }
      }
    }
    if (nearest) {
      return this.pushNotification(nearest, notification);
    }
    const firstMirror = Array.from(this.mirrors.keys())[0];
    return this.pushNotification(firstMirror, notification);
  }

  _startTransitUpdateLoop() {
    const interval = setInterval(() => {
      this._updateTransitData();
    }, 120000);
    this.intervals.push(interval);
  }

  _updateTransitData() {
    for (const stop of this.transitData.stops) {
      stop.nextDepartures = [];
      const now = new Date();
      for (let i = 0; i < 5; i++) {
        const depTime = new Date(now.getTime() + (i + 1) * (3 + Math.floor(Math.random() * 8)) * 60000);
        stop.nextDepartures.push({
          line: stop.lines[Math.floor(Math.random() * stop.lines.length)],
          destination: this._getRandomDestination(),
          departureTime: depTime.toTimeString().slice(0, 5),
          minutesUntil: Math.round((depTime.getTime() - now.getTime()) / 60000),
          delayed: Math.random() < 0.1,
          delayMinutes: Math.random() < 0.1 ? Math.floor(Math.random() * 10) + 1 : 0
        });
      }
    }
    this.transitData.disruptions = Math.random() < 0.15
      ? [{ line: 'T14', description: 'Signal problems between Slussen and Gamla Stan', severity: 'minor' }]
      : [];
    this.transitData.lastUpdated = new Date().toISOString();
    this.homey.log('[SmartMirror] Transit data updated for ' + this.transitData.stops.length + ' stops');
  }

  _getRandomDestination() {
    const destinations = ['Mörby centrum', 'Fruängen', 'Hässelby strand', 'Ropsten', 'Kungsträdgården', 'Skarpnäck', 'Farsta strand', 'Hjulsta'];
    return destinations[Math.floor(Math.random() * destinations.length)];
  }

  _startWeatherUpdateLoop() {
    const interval = setInterval(() => {
      this._updateWeatherData();
    }, 600000);
    this.intervals.push(interval);
  }

  _updateWeatherData() {
    const tempShift = (Math.random() * 2 - 1);
    this.weatherData.current.temp = Math.round((this.weatherData.current.temp + tempShift) * 10) / 10;
    this.weatherData.current.humidity = Math.max(30, Math.min(95, this.weatherData.current.humidity + Math.floor(Math.random() * 6 - 3)));
    this.weatherData.current.windSpeed = Math.max(0, Math.round((this.weatherData.current.windSpeed + (Math.random() * 2 - 1)) * 10) / 10);

    if (this.weatherData.current.temp < -10 || this.weatherData.current.windSpeed > 20) {
      this.weatherData.alerts = [{
        type: 'severe-weather',
        title: 'Varning: Extremt väder',
        description: 'Kallt och blåsigt väder förväntas. Klä dig varmt.',
        severity: 'warning',
        issuedAt: new Date().toISOString()
      }];
    } else {
      this.weatherData.alerts = [];
    }

    this.weatherData.lastUpdated = new Date().toISOString();
    this.homey.log('[SmartMirror] Weather updated: ' + this.weatherData.current.temp + '°C in Stockholm');
  }

  _startHealthReminderLoop() {
    const interval = setInterval(() => {
      this._checkHealthReminders();
    }, 60000);
    this.intervals.push(interval);
  }

  _checkHealthReminders() {
    const now = new Date();
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

    for (const [userId, health] of this.healthDashboards) {
      if (health.hydrationReminders && now.getMinutes() === 0 && now.getHours() >= 8 && now.getHours() <= 21) {
        this.homey.log('[SmartMirror] Hydration reminder for user ' + userId);
        this.homey.emit('smart-mirror-hydration-reminder', { userId });
      }

      for (const med of health.medications) {
        if (med.time === currentTime && !med.taken) {
          this.homey.log('[SmartMirror] Medication reminder: ' + med.name + ' for user ' + userId);
          this.homey.emit('smart-mirror-medication-reminder', { userId, medication: med.name });

          for (const [mirrorId, activeUserId] of this.activeUsers) {
            if (activeUserId === userId) {
              this.pushNotification(mirrorId, {
                title: 'Medication Reminder',
                message: 'Time to take ' + med.name,
                priority: 'high',
                icon: 'pill',
                autoDismissMs: 30000
              });
            }
          }
        }
      }
    }
  }

  _startMaintenanceCheckLoop() {
    const interval = setInterval(() => {
      this._checkMaintenance();
    }, 3600000);
    this.intervals.push(interval);
  }

  _checkMaintenance() {
    for (const [mirrorId, record] of this.maintenanceLog) {
      record.uptimeHours += 1;
      record.memoryUsagePercent = Math.min(95, record.memoryUsagePercent + Math.random() * 2);
      record.wifiSignalStrength = -45 + Math.floor(Math.random() * 20);

      if (record.lastCleaned) {
        const daysSinceCleaning = (Date.now() - new Date(record.lastCleaned).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceCleaning >= record.cleaningIntervalDays) {
          record.screenCleaningReminder = true;
          this.homey.log('[SmartMirror] Screen cleaning reminder for ' + mirrorId);
        }
      } else {
        record.screenCleaningReminder = true;
      }

      if (record.memoryUsagePercent > 85) {
        this.homey.log('[SmartMirror] High memory usage on ' + mirrorId + ': ' + Math.round(record.memoryUsagePercent) + '%');
        record.errorLog.push({ timestamp: new Date().toISOString(), type: 'high-memory', value: record.memoryUsagePercent });
      }

      if (record.wifiSignalStrength < -70) {
        this.homey.log('[SmartMirror] Weak WiFi signal on ' + mirrorId + ': ' + record.wifiSignalStrength + ' dBm');
      }
    }
  }

  _startPhotoRotationLoop() {
    const interval = setInterval(() => {
      this._rotatePhotos();
    }, 15000);
    this.intervals.push(interval);
  }

  _rotatePhotos() {
    for (const [mirrorId, mirror] of this.mirrors) {
      if (!mirror.poweredOn) continue;
      const layout = this.mirrorLayouts.get(mirrorId);
      if (!layout || !layout.enabledWidgets.includes('photo-slideshow')) continue;

      const widget = this.widgets.get('photo-slideshow');
      if (widget) {
        widget.data = this._getNextPhoto();
      }
    }
  }

  _startAnalyticsAggregationLoop() {
    const interval = setInterval(() => {
      this._aggregateAnalytics();
    }, 300000);
    this.intervals.push(interval);
  }

  _aggregateAnalytics() {
    for (const [mirrorId, analytics] of this.mirrorAnalytics) {
      const mirror = this.mirrors.get(mirrorId);
      if (mirror && mirror.poweredOn) {
        analytics.totalUsageMinutes += 5;
        const activeUserId = this.activeUsers.get(mirrorId);
        if (activeUserId && activeUserId !== 'guest' && analytics.userEngagement[activeUserId]) {
          analytics.userEngagement[activeUserId].totalMinutes += 5;
        }
      }
    }
  }

  handleGesture(mirrorId, gesture) {
    const mirror = this.mirrors.get(mirrorId);
    if (!mirror || !mirror.poweredOn || !mirror.touchEnabled) {
      this.homey.log('[SmartMirror] Gesture ignored on ' + mirrorId + ': mirror not active or touch disabled');
      return { success: false, reason: 'mirror-unavailable' };
    }

    const validGestures = ['swipe-left', 'swipe-right', 'swipe-up', 'tap', 'long-press'];
    if (!validGestures.includes(gesture)) {
      return { success: false, reason: 'invalid-gesture' };
    }

    mirror.lastInteraction = new Date().toISOString();
    const entry = { mirrorId, gesture, timestamp: new Date().toISOString(), userId: this.activeUsers.get(mirrorId) || 'unknown', success: true };
    this.gestureHistory.push(entry);

    if (this.gestureHistory.length > 500) {
      this.gestureHistory = this.gestureHistory.slice(-500);
    }

    const analytics = this.mirrorAnalytics.get(mirrorId);
    if (analytics) {
      analytics.totalGestures += 1;
      analytics.successfulGestures += 1;
      analytics.gestureAccuracy = Math.round((analytics.successfulGestures / analytics.totalGestures) * 100);
    }

    let result;
    switch (gesture) {
      case 'swipe-left':
        result = { action: 'next-page', success: true };
        this.homey.log('[SmartMirror] Swipe left on ' + mirrorId + ': next widget page');
        break;
      case 'swipe-right':
        result = { action: 'previous-page', success: true };
        this.homey.log('[SmartMirror] Swipe right on ' + mirrorId + ': previous widget page');
        break;
      case 'swipe-up':
        result = { action: 'dismiss', success: true };
        this.homey.log('[SmartMirror] Swipe up on ' + mirrorId + ': dismiss');
        break;
      case 'tap':
        result = { action: 'interact', success: true };
        this.homey.log('[SmartMirror] Tap on ' + mirrorId + ': interact');
        break;
      case 'long-press':
        result = { action: 'settings', success: true };
        this.homey.log('[SmartMirror] Long press on ' + mirrorId + ': open settings');
        break;
      default:
        result = { action: 'unknown', success: false };
    }

    this.homey.emit('smart-mirror-gesture', { mirrorId, gesture, result });
    return result;
  }

  handleVoiceCommand(mirrorId, command) {
    const mirror = this.mirrors.get(mirrorId);
    if (!mirror || !mirror.poweredOn) {
      return { success: false, reason: 'mirror-unavailable' };
    }

    mirror.lastInteraction = new Date().toISOString();
    const normalizedCmd = command.toLowerCase().trim();
    let result = { success: false, action: 'unknown', response: '' };

    if (normalizedCmd.includes('show weather')) {
      result = { success: true, action: 'show-widget', widget: 'weather', response: 'Showing weather for Stockholm' };
    } else if (normalizedCmd.includes('show calendar')) {
      result = { success: true, action: 'show-widget', widget: 'calendar', response: 'Showing your calendar' };
    } else if (normalizedCmd.includes('play music')) {
      result = { success: true, action: 'media-control', command: 'play', response: 'Playing music' };
    } else if (normalizedCmd.includes('turn off mirror') || normalizedCmd.includes('stäng av')) {
      this._sleepMirror(mirrorId);
      result = { success: true, action: 'turn-off', response: 'Mirror turning off' };
    } else if (normalizedCmd.includes('set brightness')) {
      const match = normalizedCmd.match(/set brightness\s+(\d+)/);
      if (match) {
        const level = Math.max(0, Math.min(100, parseInt(match[1], 10)));
        mirror.brightness = level;
        result = { success: true, action: 'set-brightness', level, response: 'Brightness set to ' + level };
      }
    } else if (normalizedCmd.includes('show news')) {
      result = { success: true, action: 'show-widget', widget: 'news-headlines', response: 'Showing news headlines' };
    } else if (normalizedCmd.includes('show commute') || normalizedCmd.includes('visa pendling')) {
      result = { success: true, action: 'show-widget', widget: 'commute', response: 'Showing commute info' };
    } else if (normalizedCmd.includes('show health') || normalizedCmd.includes('visa hälsa')) {
      result = { success: true, action: 'show-widget', widget: 'health-metrics', response: 'Showing health metrics' };
    } else if (normalizedCmd.includes('show photos') || normalizedCmd.includes('visa bilder')) {
      result = { success: true, action: 'show-widget', widget: 'photo-slideshow', response: 'Starting photo slideshow' };
    } else if (normalizedCmd.includes('party mode') || normalizedCmd.includes('festläge')) {
      mirror.activeMode = 'party';
      mirror.brightness = 100;
      result = { success: true, action: 'set-mode', mode: 'party', response: 'Party mode activated!' };
    } else {
      result = { success: false, action: 'unrecognized', response: 'Command not recognized: ' + command };
    }

    this.voiceCommandLog.push({
      mirrorId,
      command,
      result: result.success,
      action: result.action,
      timestamp: new Date().toISOString()
    });

    if (this.voiceCommandLog.length > 200) {
      this.voiceCommandLog = this.voiceCommandLog.slice(-200);
    }

    this.homey.log('[SmartMirror] Voice command on ' + mirrorId + ': "' + command + '" -> ' + result.action);
    this.homey.emit('smart-mirror-voice-command', { mirrorId, command, result });
    return result;
  }

  controlSmartHome(mirrorId, controlId, action, value) {
    const mirror = this.mirrors.get(mirrorId);
    if (!mirror || !mirror.poweredOn || !mirror.touchEnabled) {
      return { success: false, reason: 'mirror-unavailable' };
    }

    const control = this.smartHomeControls.find(c => c.id === controlId);
    if (!control) {
      return { success: false, reason: 'control-not-found' };
    }

    mirror.lastInteraction = new Date().toISOString();
    let result = { success: false, action: '' };

    switch (control.type) {
      case 'light':
        if (action === 'toggle') {
          control.state = !control.state;
          result = { success: true, action: 'light-toggled', state: control.state };
        } else if (action === 'brightness' && typeof value === 'number') {
          control.brightness = Math.max(0, Math.min(100, value));
          result = { success: true, action: 'brightness-set', brightness: control.brightness };
        }
        break;
      case 'thermostat':
        if (action === 'setTemp' && typeof value === 'number') {
          control.targetTemp = Math.max(15, Math.min(30, value));
          result = { success: true, action: 'temp-set', targetTemp: control.targetTemp };
        } else if (action === 'setMode' && typeof value === 'string') {
          control.mode = value;
          result = { success: true, action: 'mode-set', mode: control.mode };
        }
        break;
      case 'lock':
        if (action === 'toggle') {
          control.locked = !control.locked;
          control.lastChanged = new Date().toISOString();
          result = { success: true, action: control.locked ? 'locked' : 'unlocked' };
        }
        break;
      case 'camera':
        if (action === 'toggleStream') {
          control.streaming = !control.streaming;
          result = { success: true, action: control.streaming ? 'streaming-started' : 'streaming-stopped' };
        }
        break;
      case 'scene':
        if (action === 'activate') {
          control.active = true;
          result = { success: true, action: 'scene-activated', scene: control.name };
        } else if (action === 'deactivate') {
          control.active = false;
          result = { success: true, action: 'scene-deactivated', scene: control.name };
        }
        break;
      default:
        result = { success: false, reason: 'unsupported-type' };
    }

    this.homey.log('[SmartMirror] Smart home control via ' + mirrorId + ': ' + controlId + ' -> ' + action);
    this.homey.emit('smart-mirror-home-control', { mirrorId, controlId, action, result });
    return result;
  }

  setMirrorBrightness(mirrorId, brightness) {
    const mirror = this.mirrors.get(mirrorId);
    if (!mirror) return false;
    mirror.brightness = Math.max(0, Math.min(100, brightness));
    this.homey.log('[SmartMirror] Brightness set to ' + mirror.brightness + ' on ' + mirrorId);
    return true;
  }

  setMirrorTheme(mirrorId, theme) {
    const layout = this.mirrorLayouts.get(mirrorId);
    if (!layout) return false;
    if (!['dark', 'light', 'auto'].includes(theme)) return false;
    layout.theme = theme;
    this.homey.log('[SmartMirror] Theme set to ' + theme + ' on ' + mirrorId);
    return true;
  }

  setMirrorMode(mirrorId, mode) {
    const mirror = this.mirrors.get(mirrorId);
    if (!mirror) return false;
    const validModes = ['normal', 'night', 'away', 'party'];
    if (!validModes.includes(mode)) return false;

    mirror.activeMode = mode;
    switch (mode) {
      case 'night':
        mirror.brightness = 5;
        break;
      case 'away':
        mirror.brightness = 0;
        mirror.poweredOn = false;
        mirror.status = 'away';
        break;
      case 'party':
        mirror.brightness = 100;
        break;
      case 'normal':
        mirror.brightness = 70;
        break;
    }

    this.homey.log('[SmartMirror] Mode set to ' + mode + ' on ' + mirrorId);
    this.homey.emit('smart-mirror-mode-changed', { mirrorId, mode });
    return true;
  }

  enableWidget(mirrorId, widgetId) {
    const layout = this.mirrorLayouts.get(mirrorId);
    if (!layout || !this.widgets.has(widgetId)) return false;
    if (!layout.enabledWidgets.includes(widgetId)) {
      layout.enabledWidgets.push(widgetId);
      this.homey.log('[SmartMirror] Widget ' + widgetId + ' enabled on ' + mirrorId);
    }
    return true;
  }

  disableWidget(mirrorId, widgetId) {
    const layout = this.mirrorLayouts.get(mirrorId);
    if (!layout) return false;
    layout.enabledWidgets = layout.enabledWidgets.filter(w => w !== widgetId);
    this.homey.log('[SmartMirror] Widget ' + widgetId + ' disabled on ' + mirrorId);
    return true;
  }

  updateWidgetPosition(mirrorId, widgetId, col, row, width, height) {
    const layout = this.mirrorLayouts.get(mirrorId);
    if (!layout) return false;
    const widgetLayout = layout.widgets.find(w => w.widgetId === widgetId);
    if (widgetLayout) {
      widgetLayout.col = col;
      widgetLayout.row = row;
      if (typeof width === 'number') widgetLayout.width = width;
      if (typeof height === 'number') widgetLayout.height = height;
      this.homey.log('[SmartMirror] Widget ' + widgetId + ' repositioned on ' + mirrorId);
      return true;
    }
    layout.widgets.push({ widgetId, col, row, width: width || 1, height: height || 1 });
    this.homey.log('[SmartMirror] Widget ' + widgetId + ' added to layout on ' + mirrorId);
    return true;
  }

  markMedicationTaken(userId, medicationName) {
    const health = this.healthDashboards.get(userId);
    if (!health) return false;
    const med = health.medications.find(m => m.name === medicationName);
    if (!med) return false;
    med.taken = true;
    this.homey.log('[SmartMirror] Medication ' + medicationName + ' marked taken for ' + userId);
    this.homey.emit('smart-mirror-medication-taken', { userId, medication: medicationName });
    return true;
  }

  updateHealthMetric(userId, metric, value) {
    const health = this.healthDashboards.get(userId);
    if (!health) return false;
    const validMetrics = ['dailySteps', 'heartRate', 'sleepScore', 'hydrationGlasses'];
    if (!validMetrics.includes(metric)) return false;
    health[metric] = value;
    health.lastUpdated = new Date().toISOString();
    this.homey.log('[SmartMirror] Health metric ' + metric + ' updated to ' + value + ' for ' + userId);
    return true;
  }

  markScreenCleaned(mirrorId) {
    const record = this.maintenanceLog.get(mirrorId);
    if (!record) return false;
    record.lastCleaned = new Date().toISOString();
    record.screenCleaningReminder = false;
    this.homey.log('[SmartMirror] Screen cleaned for ' + mirrorId);
    return true;
  }

  getMirrorStatus(mirrorId) {
    const mirror = this.mirrors.get(mirrorId);
    if (!mirror) return null;
    const layout = this.mirrorLayouts.get(mirrorId);
    const analytics = this.mirrorAnalytics.get(mirrorId);
    const maintenance = this.maintenanceLog.get(mirrorId);
    const activeUser = this.activeUsers.get(mirrorId);
    return {
      mirror: { ...mirror },
      layout: layout ? { ...layout } : null,
      analytics: analytics ? { ...analytics } : null,
      maintenance: maintenance ? { ...maintenance } : null,
      activeUser: activeUser || null,
      notifications: (this.notificationQueue.get(mirrorId) || []).length
    };
  }

  getAllMirrorStatuses() {
    const statuses = {};
    for (const mirrorId of this.mirrors.keys()) {
      statuses[mirrorId] = this.getMirrorStatus(mirrorId);
    }
    return statuses;
  }

  getUserProfile(userId) {
    const profile = this.userProfiles.get(userId);
    if (!profile) return null;
    const health = this.healthDashboards.get(userId);
    return { profile: { ...profile }, health: health ? { ...health } : null };
  }

  getVoiceCommandStats() {
    const total = this.voiceCommandLog.length;
    const successful = this.voiceCommandLog.filter(l => l.result).length;
    const rate = total > 0 ? Math.round((successful / total) * 100) : 0;
    const recentCommands = this.voiceCommandLog.slice(-10);
    const commandBreakdown = {};
    for (const log of this.voiceCommandLog) {
      commandBreakdown[log.action] = (commandBreakdown[log.action] || 0) + 1;
    }
    return { total, successful, successRate: rate, recentCommands, commandBreakdown };
  }

  getGestureStats() {
    const total = this.gestureHistory.length;
    const gestureBreakdown = {};
    for (const g of this.gestureHistory) {
      gestureBreakdown[g.gesture] = (gestureBreakdown[g.gesture] || 0) + 1;
    }
    const recentGestures = this.gestureHistory.slice(-10);
    return { total, gestureBreakdown, recentGestures };
  }

  getWeatherSummary() {
    return { ...this.weatherData };
  }

  getTransitSummary() {
    return { ...this.transitData };
  }

  getPhotoAlbumInfo() {
    const totalPhotos = this.photoAlbum.length;
    const albums = {};
    for (const photo of this.photoAlbum) {
      albums[photo.album] = (albums[photo.album] || 0) + 1;
    }
    const favorites = this.photoAlbum.filter(p => p.favorite).length;
    const totalDisplays = this.photoAlbum.reduce((sum, p) => sum + p.displayCount, 0);
    return { totalPhotos, albums, favorites, totalDisplays };
  }

  getSmartHomeControlsList() {
    return this.smartHomeControls.map(c => ({ ...c }));
  }

  getMaintenanceReport() {
    const report = {};
    for (const [mirrorId, record] of this.maintenanceLog) {
      report[mirrorId] = {
        firmwareVersion: record.firmwareVersion,
        uptimeHours: record.uptimeHours,
        memoryUsage: Math.round(record.memoryUsagePercent) + '%',
        wifiSignal: record.wifiSignalStrength + ' dBm',
        needsCleaning: record.screenCleaningReminder,
        lastCleaned: record.lastCleaned,
        recentErrors: record.errorLog.slice(-5)
      };
    }
    return report;
  }

  getStatistics() {
    const totalMirrors = this.mirrors.size;
    const activeMirrors = Array.from(this.mirrors.values()).filter(m => m.poweredOn).length;
    const totalWidgets = this.widgets.size;
    const totalUsers = this.userProfiles.size;
    const totalNotifications = Array.from(this.notificationQueue.values()).reduce((sum, q) => sum + q.length, 0);
    const totalGestures = this.gestureHistory.length;
    const totalVoiceCommands = this.voiceCommandLog.length;
    const voiceSuccessRate = totalVoiceCommands > 0
      ? Math.round((this.voiceCommandLog.filter(l => l.result).length / totalVoiceCommands) * 100)
      : 0;
    const totalPhotos = this.photoAlbum.length;

    const mirrorStats = {};
    for (const [mirrorId, analytics] of this.mirrorAnalytics) {
      mirrorStats[mirrorId] = {
        usageMinutes: analytics.totalUsageMinutes,
        sessions: analytics.sessionsToday,
        topWidgets: Object.entries(analytics.widgetUsage).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([w, c]) => ({ widget: w, count: c })),
        gestureAccuracy: analytics.gestureAccuracy + '%'
      };
    }

    return {
      initialized: this.initialized,
      totalMirrors,
      activeMirrors,
      totalWidgets,
      totalUsers,
      totalNotifications,
      totalGestures,
      totalVoiceCommands,
      voiceSuccessRate: voiceSuccessRate + '%',
      totalPhotos,
      weatherLocation: this.weatherData.location,
      currentTemp: this.weatherData.current ? this.weatherData.current.temp + '°C' : 'N/A',
      transitProvider: this.transitData.provider,
      transitStops: this.transitData.stops.length,
      mirrorStats,
      intervals: this.intervals.length
    };
  }

  destroy() {
    for (const interval of this.intervals) {
      clearInterval(interval);
    }
    this.intervals = [];

    this.mirrors.clear();
    this.widgets.clear();
    this.userProfiles.clear();
    this.mirrorLayouts.clear();
    this.gestureHistory = [];
    this.voiceCommandLog = [];
    this.notificationQueue.clear();
    this.contentSchedules.clear();
    this.mirrorAnalytics.clear();
    this.photoAlbum = [];
    this.healthDashboards.clear();
    this.activeUsers.clear();
    this.maintenanceLog.clear();
    this.smartHomeControls = [];
    this.initialized = false;

    this.homey.log('[SmartMirror] destroyed');
  }
}

module.exports = SmartMirrorDashboardSystem;
