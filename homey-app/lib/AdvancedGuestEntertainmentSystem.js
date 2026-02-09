'use strict';

/**
 * AdvancedGuestEntertainmentSystem
 * Wave 14 — Comprehensive guest entertainment, hospitality, and visitor management.
 *
 * Covers guest profiles, Wi-Fi provisioning, welcome automation, entertainment
 * library, streaming access, house rules, room preparation, music/ambiance,
 * meal/dining, activity planning, sauna management, departure routines, party
 * mode, Airbnb/rental mode, kid entertainment, guest communication, monitoring
 * and analytics.
 */

const crypto = require('crypto');

class AdvancedGuestEntertainmentSystem {
  constructor(homey) {
    this.homey = homey;

    // ── Guest profiles (max 20) ──────────────────────────────────────────
    this.maxGuests = 20;
    this.guests = new Map();

    // ── Wi-Fi provisioning ───────────────────────────────────────────────
    this.wifiSessions = new Map();
    this.wifiDefaults = {
      ssidPrefix: 'Guest-',
      durations: { '4h': 4, '12h': 12, '24h': 24, 'weekend': 48, 'week': 168 },
      bandwidthOptions: [10, 25, 50],
      defaultBandwidth: 25,
      networkIsolation: true,
      rotationIntervalHours: 168
    };

    // ── Welcome automation ───────────────────────────────────────────────
    this.welcomeScenes = new Map();
    this.welcomeDefaults = {
      unlockDoor: true,
      pathwayLights: true,
      welcomeMessageDisplay: true,
      adjustThermostat: true,
      greetingTemplate: 'Welcome, {name}!',
      returnGreetingTemplate: 'Welcome back, {name}!'
    };

    // ── Entertainment library ────────────────────────────────────────────
    this.entertainmentCatalog = {
      streamingServices: [
        { id: 'netflix', name: 'Netflix', type: 'video', available: true },
        { id: 'svt_play', name: 'SVT Play', type: 'video', available: true },
        { id: 'disney_plus', name: 'Disney+', type: 'video', available: true },
        { id: 'spotify', name: 'Spotify', type: 'music', available: true },
        { id: 'youtube', name: 'YouTube', type: 'video', available: true }
      ],
      smartTVChannels: [],
      bluetoothSpeakers: [],
      physicalMedia: { vinyl: [], cds: [] },
      boardGames: [],
      videoGames: [],
      outdoorActivities: [
        { id: 'bbq', name: 'BBQ / Grilling', available: true },
        { id: 'pool', name: 'Pool', available: true },
        { id: 'sauna', name: 'Sauna', available: true }
      ]
    };

    // ── Streaming access ─────────────────────────────────────────────────
    this.streamingProfiles = new Map();

    // ── House rules ──────────────────────────────────────────────────────
    this.houseRules = [];
    this.houseRulesLanguages = ['sv', 'en', 'de', 'no'];
    this.houseRulesDefaults = [
      { key: 'shoes', text: { sv: 'Vänligen ta av skorna inomhus.', en: 'Please remove shoes indoors.', de: 'Bitte Schuhe drinnen ausziehen.', no: 'Vennligst ta av skoene innendørs.' } },
      { key: 'recycling', text: { sv: 'Sopsortera enligt skyltarna i köket.', en: 'Recycle according to kitchen signage.', de: 'Bitte nach Küchenschildern recyceln.', no: 'Resirkuler i henhold til skilt på kjøkkenet.' } },
      { key: 'wifi', text: { sv: 'Wi-Fi: se QR-kod på kylskåpet.', en: 'Wi-Fi: see QR code on the fridge.', de: 'WLAN: QR-Code am Kühlschrank.', no: 'Wi-Fi: se QR-kode på kjøleskapet.' } },
      { key: 'emergency', text: { sv: 'Nödnummer: 112', en: 'Emergency: 112', de: 'Notruf: 112', no: 'Nødnummer: 112' } },
      { key: 'sauna', text: { sv: 'Max 20 min per bastuomgång. Stäng av bastun efter användning.', en: 'Max 20 min per sauna session. Turn off sauna after use.', de: 'Max 20 Min pro Saunagang. Sauna nach Gebrauch ausschalten.', no: 'Maks 20 min per bastuøkt. Slå av bastuen etter bruk.' } },
      { key: 'pool', text: { sv: 'Ingen löpning vid poolen. Barn under tillsyn.', en: 'No running near the pool. Children must be supervised.', de: 'Nicht am Pool rennen. Kinder beaufsichtigen.', no: 'Ikke løp ved bassenget. Barn under tilsyn.' } }
    ];

    // ── Room preparation ─────────────────────────────────────────────────
    this.roomChecklist = new Map();
    this.roomChecklistDefaults = [
      { item: 'fresh_linens', label: 'Fresh linens', done: false },
      { item: 'towels', label: 'Towels', done: false },
      { item: 'toiletries', label: 'Toiletries', done: false },
      { item: 'water_bottles', label: 'Water bottles', done: false },
      { item: 'phone_charger', label: 'Phone charger', done: false },
      { item: 'reading_light', label: 'Reading light tested', done: false },
      { item: 'alarm_clock', label: 'Alarm clock set', done: false },
      { item: 'closet_space', label: 'Closet space cleared', done: false },
      { item: 'ambient_scent', label: 'Ambient scent activated', done: false }
    ];

    // ── Music / ambiance ─────────────────────────────────────────────────
    this.ambianceProfiles = new Map();
    this.volumeSchedule = {
      daytime: { start: 8, end: 18, volumePercent: 60 },
      evening: { start: 18, end: 22, volumePercent: 40 },
      night: { start: 22, end: 8, volumePercent: 20 }
    };

    // ── Meal / dining ────────────────────────────────────────────────────
    this.mealPlans = new Map();
    this.dietaryOptions = ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'nut-free', 'halal', 'kosher', 'pescatarian', 'keto', 'none'];

    // ── Activity planning ────────────────────────────────────────────────
    this.activities = [];
    this.localEvents = [];
    this.seasonalActivities = {
      spring: ['berry picking', 'hiking', 'cycling'],
      summer: ['Midsommar celebration', 'swimming', 'BBQ', 'kayaking', 'fishing'],
      autumn: ['mushroom foraging', 'leaf watching', 'cosy movie nights'],
      winter: ['ice skating', 'skiing', 'sauna evenings', 'board game marathon']
    };

    // ── Sauna management ─────────────────────────────────────────────────
    this.saunaState = {
      active: false,
      targetTemp: 80,
      mode: 'traditional',
      humidity: 'steam',
      preheatMinutes: 45,
      maxSessionMinutes: 20,
      currentTemp: 20,
      towelWarmer: false,
      scheduledSessions: [],
      safetyTimerActive: false,
      safetyTimerEnd: null
    };

    // ── Departure routine ────────────────────────────────────────────────
    this.departureDefaults = {
      checkoutReminderMinutes: 60,
      thankYouMessage: true,
      revokeWifi: true,
      resetRoom: true,
      collectKeyCode: true,
      feedbackPrompt: true,
      autoCleanup: true,
      cleanupActions: ['open_windows', 'start_robot_vacuum']
    };

    // ── Party mode ───────────────────────────────────────────────────────
    this.partyMode = {
      active: false,
      outdoorLighting: true,
      musicZones: [],
      drinkStationLighting: true,
      bathroomQueueManagement: false,
      noiseMonitoring: true,
      noiseThresholdDb: 70,
      autoDimHour: 23,
      snackRefillReminder: true,
      guestCount: 0,
      maxGuestCount: 0,
      neighborAware: true,
      lateHourVolumePct: 25
    };

    // ── Airbnb / rental mode ─────────────────────────────────────────────
    this.rentalMode = {
      active: false,
      currentBooking: null,
      bookings: [],
      keypadCodeLength: 6,
      cleaningCrewNotification: true,
      inventoryChecklist: [],
      reviewPromptEnabled: true,
      turnoverScheduleHours: 4,
      quietHoursStart: 22,
      quietHoursEnd: 7
    };

    // ── Kid entertainment ────────────────────────────────────────────────
    this.kidProfiles = new Map();
    this.kidSafeZones = [];
    this.kidContentRatings = ['G', 'PG'];
    this.kidDefaults = {
      snackSchedule: ['10:00', '14:00', '16:30'],
      mealSchedule: ['08:00', '12:00', '18:00'],
      napRoomAvailable: false,
      outdoorPlayMonitoring: true
    };

    // ── Guest communication ──────────────────────────────────────────────
    this.messages = [];
    this.wakeUpCalls = new Map();

    // ── Monitoring ───────────────────────────────────────────────────────
    this.monitoringIntervalMs = 3 * 60 * 1000; // 3 minutes
    this.monitoringTimer = null;

    // ── Analytics ────────────────────────────────────────────────────────
    this.analytics = {
      totalVisits: 0,
      totalStayDurationHours: 0,
      entertainmentUsage: {},
      guestSatisfaction: [],
      visitsByMonth: {},
      costPerVisit: [],
      annualBudget: 0,
      annualSpent: 0,
      peakMonth: null
    };

    // ── Internal state ───────────────────────────────────────────────────
    this.initialized = false;
    this.lastMonitoringCycle = null;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Lifecycle
  // ════════════════════════════════════════════════════════════════════════

  async initialize() {
    if (this.initialized) return;
    this.log('Initializing AdvancedGuestEntertainmentSystem …');

    this._loadDefaultHouseRules();
    this._loadDefaultEntertainment();
    this._startMonitoringCycle();

    this.initialized = true;
    this.log('System initialized successfully.');
  }

  destroy() {
    this.log('Destroying AdvancedGuestEntertainmentSystem …');
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }
    this.guests.clear();
    this.wifiSessions.clear();
    this.streamingProfiles.clear();
    this.roomChecklist.clear();
    this.ambianceProfiles.clear();
    this.mealPlans.clear();
    this.kidProfiles.clear();
    this.wakeUpCalls.clear();
    this.messages = [];
    this.initialized = false;
    this.log('System destroyed.');
  }

  // ════════════════════════════════════════════════════════════════════════
  //  1. Guest Profiles
  // ════════════════════════════════════════════════════════════════════════

  addGuest(guestData) {
    if (this.guests.size >= this.maxGuests) {
      this.error(`Cannot add guest – max ${this.maxGuests} reached.`);
      return null;
    }
    const id = this._generateId('guest');
    const guest = {
      id,
      name: guestData.name || 'Unknown Guest',
      relationship: this._validateRelationship(guestData.relationship),
      preferences: {
        dietary: guestData.dietary || 'none',
        musicGenre: guestData.musicGenre || 'pop',
        temperaturePreference: guestData.temperaturePreference || 22,
        language: guestData.language || 'en'
      },
      visitHistory: [],
      specialDates: {
        birthday: guestData.birthday || null
      },
      vip: guestData.vip === true,
      lastVisitDate: null,
      createdAt: new Date().toISOString()
    };
    this.guests.set(id, guest);
    this.log(`Guest added: ${guest.name} (${guest.relationship}), VIP=${guest.vip}`);
    return guest;
  }

  updateGuest(guestId, updates) {
    const guest = this.guests.get(guestId);
    if (!guest) {
      this.error(`Guest ${guestId} not found.`);
      return null;
    }
    if (updates.name) guest.name = updates.name;
    if (updates.relationship) guest.relationship = this._validateRelationship(updates.relationship);
    if (updates.dietary) guest.preferences.dietary = updates.dietary;
    if (updates.musicGenre) guest.preferences.musicGenre = updates.musicGenre;
    if (updates.temperaturePreference !== undefined) guest.preferences.temperaturePreference = updates.temperaturePreference;
    if (updates.language) guest.preferences.language = updates.language;
    if (updates.birthday) guest.specialDates.birthday = updates.birthday;
    if (updates.vip !== undefined) guest.vip = updates.vip;
    this.log(`Guest updated: ${guest.name}`);
    return guest;
  }

  removeGuest(guestId) {
    const guest = this.guests.get(guestId);
    if (!guest) return false;
    this.guests.delete(guestId);
    this.log(`Guest removed: ${guest.name}`);
    return true;
  }

  getGuest(guestId) {
    return this.guests.get(guestId) || null;
  }

  getAllGuests() {
    return Array.from(this.guests.values());
  }

  _validateRelationship(rel) {
    const valid = ['family', 'friend', 'colleague', 'service', 'airbnb'];
    return valid.includes(rel) ? rel : 'friend';
  }

  // ════════════════════════════════════════════════════════════════════════
  //  2. Wi-Fi Provisioning
  // ════════════════════════════════════════════════════════════════════════

  provisionWifi(guestId, options = {}) {
    const guest = this.guests.get(guestId);
    if (!guest) {
      this.error(`Cannot provision Wi-Fi – guest ${guestId} not found.`);
      return null;
    }
    const duration = options.duration || '24h';
    const bandwidth = options.bandwidth || this.wifiDefaults.defaultBandwidth;
    if (!this.wifiDefaults.bandwidthOptions.includes(bandwidth)) {
      this.error(`Invalid bandwidth: ${bandwidth} Mbps`);
      return null;
    }
    const durationHours = this.wifiDefaults.durations[duration];
    if (!durationHours) {
      this.error(`Invalid duration key: ${duration}`);
      return null;
    }

    const ssid = `${this.wifiDefaults.ssidPrefix}${guest.name.replace(/\s+/g, '')}`;
    const password = this._generateWifiPassword();
    const expiresAt = new Date(Date.now() + durationHours * 3600000).toISOString();

    const session = {
      id: this._generateId('wifi'),
      guestId,
      guestName: guest.name,
      ssid,
      password,
      bandwidth,
      duration,
      durationHours,
      expiresAt,
      networkIsolation: this.wifiDefaults.networkIsolation,
      active: true,
      qrCode: this._generateWifiQRPayload(ssid, password),
      createdAt: new Date().toISOString()
    };

    this.wifiSessions.set(session.id, session);
    this.log(`Wi-Fi provisioned for ${guest.name}: SSID=${ssid}, ${bandwidth}Mbps, expires ${expiresAt}`);
    return session;
  }

  revokeWifi(sessionId) {
    const session = this.wifiSessions.get(sessionId);
    if (!session) return false;
    session.active = false;
    this.log(`Wi-Fi revoked: ${session.ssid} (${session.guestName})`);
    return true;
  }

  revokeAllWifiForGuest(guestId) {
    let count = 0;
    for (const [id, session] of this.wifiSessions) {
      if (session.guestId === guestId && session.active) {
        session.active = false;
        count++;
      }
    }
    this.log(`Revoked ${count} Wi-Fi session(s) for guest ${guestId}`);
    return count;
  }

  getActiveWifiSessions() {
    return Array.from(this.wifiSessions.values()).filter(s => s.active);
  }

  _checkWifiExpiry() {
    const now = Date.now();
    for (const [id, session] of this.wifiSessions) {
      if (session.active && new Date(session.expiresAt).getTime() <= now) {
        session.active = false;
        this.log(`Wi-Fi auto-expired: ${session.ssid}`);
      }
    }
  }

  _generateWifiPassword(length = 12) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let pw = '';
    for (let i = 0; i < length; i++) {
      pw += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pw;
  }

  _generateWifiQRPayload(ssid, password) {
    return `WIFI:T:WPA;S:${ssid};P:${password};;`;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  3. Welcome Automation
  // ════════════════════════════════════════════════════════════════════════

  triggerWelcome(guestId) {
    const guest = this.guests.get(guestId);
    if (!guest) {
      this.error(`Welcome trigger failed – guest ${guestId} not found.`);
      return null;
    }

    const isReturn = guest.visitHistory.length > 0;
    const template = isReturn
      ? this.welcomeDefaults.returnGreetingTemplate
      : this.welcomeDefaults.greetingTemplate;
    const greeting = template.replace('{name}', guest.name);

    const actions = [];
    if (this.welcomeDefaults.unlockDoor) actions.push('unlock_front_door');
    if (this.welcomeDefaults.pathwayLights) actions.push('pathway_lights_on');
    if (this.welcomeDefaults.welcomeMessageDisplay) actions.push(`display_message:${greeting}`);
    if (this.welcomeDefaults.adjustThermostat) actions.push(`set_thermostat:${guest.preferences.temperaturePreference}`);

    const visit = {
      arrivalDate: new Date().toISOString(),
      departureDate: null,
      greeting,
      actions
    };
    guest.visitHistory.push(visit);
    guest.lastVisitDate = visit.arrivalDate;

    this.analytics.totalVisits++;
    const month = new Date().toISOString().slice(0, 7);
    this.analytics.visitsByMonth[month] = (this.analytics.visitsByMonth[month] || 0) + 1;

    const scene = {
      guestId,
      guestName: guest.name,
      greeting,
      actions,
      isReturn,
      triggeredAt: visit.arrivalDate
    };
    this.welcomeScenes.set(guestId, scene);

    this.log(`Welcome triggered for ${guest.name}: "${greeting}" – ${actions.length} action(s)`);
    return scene;
  }

  getWelcomeScene(guestId) {
    return this.welcomeScenes.get(guestId) || null;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  4. Entertainment Library
  // ════════════════════════════════════════════════════════════════════════

  addBoardGame(name, minPlayers, maxPlayers, ageRating) {
    const game = { id: this._generateId('bg'), name, minPlayers, maxPlayers, ageRating: ageRating || 8, available: true };
    this.entertainmentCatalog.boardGames.push(game);
    this.log(`Board game added: ${name}`);
    return game;
  }

  addVideoGame(name, platform, ageRating) {
    const game = { id: this._generateId('vg'), name, platform, ageRating: ageRating || 12, available: true };
    this.entertainmentCatalog.videoGames.push(game);
    this.log(`Video game added: ${name} (${platform})`);
    return game;
  }

  addBluetoothSpeaker(name, room) {
    const speaker = { id: this._generateId('spk'), name, room, connected: false };
    this.entertainmentCatalog.bluetoothSpeakers.push(speaker);
    this.log(`Speaker registered: ${name} in ${room}`);
    return speaker;
  }

  addPhysicalMedia(type, title, artist) {
    if (type !== 'vinyl' && type !== 'cds') {
      this.error(`Invalid media type: ${type}`);
      return null;
    }
    const item = { id: this._generateId('media'), title, artist };
    this.entertainmentCatalog.physicalMedia[type].push(item);
    this.log(`Physical media added: ${title} by ${artist} (${type})`);
    return item;
  }

  getEntertainmentCatalog() {
    return { ...this.entertainmentCatalog };
  }

  searchEntertainment(query) {
    const q = (query || '').toLowerCase();
    const results = [];
    for (const svc of this.entertainmentCatalog.streamingServices) {
      if (svc.name.toLowerCase().includes(q)) results.push({ category: 'streaming', ...svc });
    }
    for (const bg of this.entertainmentCatalog.boardGames) {
      if (bg.name.toLowerCase().includes(q)) results.push({ category: 'boardGame', ...bg });
    }
    for (const vg of this.entertainmentCatalog.videoGames) {
      if (vg.name.toLowerCase().includes(q)) results.push({ category: 'videoGame', ...vg });
    }
    for (const act of this.entertainmentCatalog.outdoorActivities) {
      if (act.name.toLowerCase().includes(q)) results.push({ category: 'outdoor', ...act });
    }
    return results;
  }

  _loadDefaultEntertainment() {
    this.addBoardGame('Settlers of Catan', 3, 4, 10);
    this.addBoardGame('Ticket to Ride', 2, 5, 8);
    this.addBoardGame('Codenames', 4, 8, 14);
    this.addBoardGame('Dixit', 3, 6, 8);
    this.addVideoGame('Mario Kart 8', 'Nintendo Switch', 3);
    this.addVideoGame('Just Dance 2025', 'Nintendo Switch', 3);
    this.addBluetoothSpeaker('Living Room Sonos', 'living_room');
    this.addBluetoothSpeaker('Patio Speaker', 'patio');
    this.addBluetoothSpeaker('Guest Room Speaker', 'guest_room');
  }

  // ════════════════════════════════════════════════════════════════════════
  //  5. Streaming Access
  // ════════════════════════════════════════════════════════════════════════

  createStreamingProfile(guestId, services = []) {
    const guest = this.guests.get(guestId);
    if (!guest) {
      this.error(`Streaming profile failed – guest ${guestId} not found.`);
      return null;
    }
    const profile = {
      id: this._generateId('stream'),
      guestId,
      guestName: guest.name,
      services: services.length > 0 ? services : this.entertainmentCatalog.streamingServices.map(s => s.id),
      parentalControls: false,
      multiRoomCasting: true,
      recommendations: this._generateContentRecommendations(guest),
      active: true,
      createdAt: new Date().toISOString(),
      autoLogoutOnDeparture: true
    };
    this.streamingProfiles.set(profile.id, profile);
    this.log(`Streaming profile created for ${guest.name}: ${profile.services.join(', ')}`);
    return profile;
  }

  enableParentalControls(profileId) {
    const profile = this.streamingProfiles.get(profileId);
    if (!profile) return false;
    profile.parentalControls = true;
    this.log(`Parental controls enabled for profile ${profileId}`);
    return true;
  }

  deactivateStreamingProfile(profileId) {
    const profile = this.streamingProfiles.get(profileId);
    if (!profile) return false;
    profile.active = false;
    this.log(`Streaming profile deactivated: ${profileId}`);
    return true;
  }

  deactivateAllStreamingForGuest(guestId) {
    let count = 0;
    for (const [id, profile] of this.streamingProfiles) {
      if (profile.guestId === guestId && profile.active) {
        profile.active = false;
        count++;
      }
    }
    this.log(`Deactivated ${count} streaming profile(s) for guest ${guestId}`);
    return count;
  }

  _generateContentRecommendations(guest) {
    const genreMap = {
      pop: ['Top 40 Hits', 'Pop Playlist'],
      rock: ['Classic Rock', 'Indie Rock Essentials'],
      jazz: ['Jazz Lounge', 'Smooth Jazz'],
      classical: ['Classical Masters', 'Piano Relaxation'],
      electronic: ['EDM Party', 'Chill Electronic'],
      hiphop: ['Hip Hop Hits', 'R&B Vibes'],
      country: ['Country Roads', 'Nashville Nights'],
      reggae: ['Reggae Vibes', 'Island Chill']
    };
    const musicRecs = genreMap[guest.preferences.musicGenre] || ['Discover Weekly'];
    const videoRecs = ['Trending Now', 'Family Favorites', 'Swedish Originals'];
    return { music: musicRecs, video: videoRecs };
  }

  // ════════════════════════════════════════════════════════════════════════
  //  6. House Rules Display
  // ════════════════════════════════════════════════════════════════════════

  _loadDefaultHouseRules() {
    this.houseRules = [...this.houseRulesDefaults];
    this.log(`Loaded ${this.houseRules.length} default house rules.`);
  }

  addHouseRule(key, textMap) {
    if (!key || !textMap) return null;
    const rule = { key, text: {} };
    for (const lang of this.houseRulesLanguages) {
      rule.text[lang] = textMap[lang] || textMap['en'] || '';
    }
    this.houseRules.push(rule);
    this.log(`House rule added: ${key}`);
    return rule;
  }

  removeHouseRule(key) {
    const idx = this.houseRules.findIndex(r => r.key === key);
    if (idx === -1) return false;
    this.houseRules.splice(idx, 1);
    this.log(`House rule removed: ${key}`);
    return true;
  }

  getHouseRules(language = 'en') {
    const lang = this.houseRulesLanguages.includes(language) ? language : 'en';
    return this.houseRules.map(r => ({ key: r.key, text: r.text[lang] || r.text['en'] }));
  }

  getHouseRulesForDisplay(language = 'en') {
    const rules = this.getHouseRules(language);
    return {
      language,
      rules,
      qrCodePayload: this._generateHouseGuideQR(language),
      displayRotation: true,
      printable: true
    };
  }

  _generateHouseGuideQR(language) {
    return `HOUSEGUIDE:lang=${language};rules=${this.houseRules.length};v=1`;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  7. Room Preparation
  // ════════════════════════════════════════════════════════════════════════

  createRoomChecklist(roomId, guestId = null) {
    const checklist = {
      roomId,
      guestId,
      items: this.roomChecklistDefaults.map(i => ({ ...i, done: false })),
      temperaturePreConditioned: false,
      targetTemperature: 22,
      createdAt: new Date().toISOString(),
      completedAt: null
    };

    if (guestId) {
      const guest = this.guests.get(guestId);
      if (guest) {
        checklist.targetTemperature = guest.preferences.temperaturePreference;
      }
    }

    this.roomChecklist.set(roomId, checklist);
    this.log(`Room checklist created for ${roomId} (guest: ${guestId || 'none'})`);
    return checklist;
  }

  markChecklistItem(roomId, itemKey, done = true) {
    const checklist = this.roomChecklist.get(roomId);
    if (!checklist) return false;
    const item = checklist.items.find(i => i.item === itemKey);
    if (!item) return false;
    item.done = done;
    this.log(`Checklist item '${itemKey}' in ${roomId}: ${done ? 'done' : 'undone'}`);

    if (checklist.items.every(i => i.done)) {
      checklist.completedAt = new Date().toISOString();
      this.log(`Room ${roomId} checklist fully completed.`);
    }
    return true;
  }

  getRoomChecklist(roomId) {
    return this.roomChecklist.get(roomId) || null;
  }

  isRoomReady(roomId) {
    const checklist = this.roomChecklist.get(roomId);
    if (!checklist) return false;
    return checklist.items.every(i => i.done);
  }

  preConditionRoom(roomId) {
    const checklist = this.roomChecklist.get(roomId);
    if (!checklist) return false;
    checklist.temperaturePreConditioned = true;
    this.log(`Room ${roomId} temperature pre-conditioned to ${checklist.targetTemperature}°C`);
    return true;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  8. Music / Ambiance
  // ════════════════════════════════════════════════════════════════════════

  setAmbianceForGuest(guestId, room = 'living_room') {
    const guest = this.guests.get(guestId);
    if (!guest) return null;

    const hour = new Date().getHours();
    let volumePercent = this.volumeSchedule.daytime.volumePercent;
    if (hour >= this.volumeSchedule.evening.start && hour < this.volumeSchedule.night.start) {
      volumePercent = this.volumeSchedule.evening.volumePercent;
    } else if (hour >= this.volumeSchedule.night.start || hour < this.volumeSchedule.daytime.start) {
      volumePercent = this.volumeSchedule.night.volumePercent;
    }

    const profile = {
      guestId,
      guestName: guest.name,
      room,
      musicGenre: guest.preferences.musicGenre,
      volumePercent,
      lightingPreference: this._guestLightingPreference(guest),
      active: true,
      startedAt: new Date().toISOString()
    };
    this.ambianceProfiles.set(`${guestId}_${room}`, profile);
    this.log(`Ambiance set for ${guest.name} in ${room}: ${profile.musicGenre} at ${volumePercent}% vol`);
    return profile;
  }

  setPartyMusic(rooms, genre = 'pop') {
    const profiles = [];
    for (const room of rooms) {
      const profile = {
        guestId: null,
        guestName: 'Party',
        room,
        musicGenre: genre,
        volumePercent: 70,
        lightingPreference: 'party',
        active: true,
        startedAt: new Date().toISOString()
      };
      this.ambianceProfiles.set(`party_${room}`, profile);
      profiles.push(profile);
    }
    this.log(`Party music set in ${rooms.length} room(s): ${genre}`);
    return profiles;
  }

  setDinnerMusic(room = 'dining_room', genre = 'jazz') {
    const profile = {
      guestId: null,
      guestName: 'Dinner',
      room,
      musicGenre: genre,
      volumePercent: 30,
      lightingPreference: 'warm_dim',
      active: true,
      startedAt: new Date().toISOString()
    };
    this.ambianceProfiles.set(`dinner_${room}`, profile);
    this.log(`Dinner music set in ${room}: ${genre} at 30% vol`);
    return profile;
  }

  stopAmbiance(key) {
    const profile = this.ambianceProfiles.get(key);
    if (!profile) return false;
    profile.active = false;
    this.log(`Ambiance stopped: ${key}`);
    return true;
  }

  _guestLightingPreference(guest) {
    const hour = new Date().getHours();
    if (hour >= 20 || hour < 7) return 'warm_dim';
    return 'bright_neutral';
  }

  getCurrentVolume() {
    const hour = new Date().getHours();
    if (hour >= this.volumeSchedule.evening.start && hour < this.volumeSchedule.night.start) {
      return this.volumeSchedule.evening.volumePercent;
    } else if (hour >= this.volumeSchedule.night.start || hour < this.volumeSchedule.daytime.start) {
      return this.volumeSchedule.night.volumePercent;
    }
    return this.volumeSchedule.daytime.volumePercent;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  9. Meal / Dining
  // ════════════════════════════════════════════════════════════════════════

  createMealPlan(guestIds, mealType = 'dinner') {
    const plan = {
      id: this._generateId('meal'),
      mealType,
      guests: [],
      dietaryRestrictions: new Set(),
      recipeSuggestions: [],
      winePairing: null,
      coffeeTeaPrefs: [],
      tableSettingReminder: true,
      breakfastAutoReminder: mealType === 'breakfast',
      createdAt: new Date().toISOString()
    };

    for (const gid of guestIds) {
      const guest = this.guests.get(gid);
      if (!guest) continue;
      plan.guests.push({ id: gid, name: guest.name, dietary: guest.preferences.dietary });
      if (guest.preferences.dietary !== 'none') {
        plan.dietaryRestrictions.add(guest.preferences.dietary);
      }
    }

    plan.dietaryRestrictions = Array.from(plan.dietaryRestrictions);
    plan.recipeSuggestions = this._suggestRecipes(plan.dietaryRestrictions, mealType);
    plan.winePairing = this._suggestWinePairing(mealType, plan.dietaryRestrictions);

    this.mealPlans.set(plan.id, plan);
    this.log(`Meal plan created: ${mealType} for ${plan.guests.length} guest(s), restrictions: ${plan.dietaryRestrictions.join(', ') || 'none'}`);
    return plan;
  }

  getMealPlan(planId) {
    return this.mealPlans.get(planId) || null;
  }

  addCoffeeTeaPreference(planId, guestId, preference) {
    const plan = this.mealPlans.get(planId);
    if (!plan) return false;
    plan.coffeeTeaPrefs.push({ guestId, preference });
    this.log(`Coffee/tea pref added to plan ${planId}: ${preference}`);
    return true;
  }

  _suggestRecipes(restrictions, mealType) {
    const recipes = [];
    const isVeg = restrictions.includes('vegetarian') || restrictions.includes('vegan');
    const isGF = restrictions.includes('gluten-free');

    if (mealType === 'dinner') {
      if (isVeg && isGF) {
        recipes.push('Stuffed bell peppers with quinoa', 'Thai coconut curry with rice', 'Grilled vegetable platter');
      } else if (isVeg) {
        recipes.push('Mushroom risotto', 'Pasta primavera', 'Vegetable lasagna');
      } else if (isGF) {
        recipes.push('Grilled salmon with roasted potatoes', 'Chicken with root vegetables', 'Swedish meatballs (GF version)');
      } else {
        recipes.push('Swedish meatballs with lingonberry', 'Grilled salmon with dill sauce', 'Beef tenderloin with hasselback potatoes');
      }
    } else if (mealType === 'breakfast') {
      if (isVeg) {
        recipes.push('Overnight oats with berries', 'Avocado toast', 'Smoothie bowl');
      } else {
        recipes.push('Scrambled eggs with smoked salmon', 'Full Swedish breakfast', 'Pancakes with syrup');
      }
    } else if (mealType === 'lunch') {
      if (isVeg) {
        recipes.push('Mediterranean salad', 'Veggie wrap', 'Soup of the day');
      } else {
        recipes.push('Open-faced shrimp sandwich', 'Caesar salad with chicken', 'Soup and sandwich combo');
      }
    }
    return recipes;
  }

  _suggestWinePairing(mealType, restrictions) {
    if (mealType === 'breakfast') return null;
    const isVeg = restrictions.includes('vegetarian') || restrictions.includes('vegan');
    if (isVeg) {
      return { type: 'white', suggestion: 'Sauvignon Blanc or Pinot Grigio' };
    }
    return { type: 'red', suggestion: 'Pinot Noir or Cabernet Sauvignon' };
  }

  // ════════════════════════════════════════════════════════════════════════
  //  10. Activity Planning
  // ════════════════════════════════════════════════════════════════════════

  suggestActivities(guestId, weather = 'sunny') {
    const guest = this.guests.get(guestId);
    const season = this._getCurrentSeason();
    const seasonal = this.seasonalActivities[season] || [];

    const weatherActivities = {
      sunny: ['outdoor walk', 'picnic', 'cycling', 'BBQ'],
      rainy: ['board games', 'movie marathon', 'cooking class', 'spa day'],
      snowy: ['ice skating', 'snowman building', 'hot chocolate tasting'],
      cloudy: ['museum visit', 'shopping', 'indoor games', 'baking']
    };

    const suggestions = [
      ...(weatherActivities[weather] || weatherActivities['cloudy']),
      ...seasonal
    ];

    const uniqueSuggestions = [...new Set(suggestions)];

    const result = {
      guestId: guestId || null,
      guestName: guest ? guest.name : 'All guests',
      weather,
      season,
      suggestions: uniqueSuggestions,
      localEvents: this.localEvents.slice(0, 5),
      generatedAt: new Date().toISOString()
    };

    this.log(`Activity suggestions for ${result.guestName}: ${uniqueSuggestions.length} idea(s)`);
    return result;
  }

  addLocalEvent(event) {
    const evt = {
      id: this._generateId('evt'),
      name: event.name || 'Unnamed Event',
      date: event.date || null,
      location: event.location || '',
      type: event.type || 'general',
      description: event.description || '',
      transportInfo: event.transportInfo || '',
      reservationLink: event.reservationLink || null
    };
    this.localEvents.push(evt);
    this.log(`Local event added: ${evt.name}`);
    return evt;
  }

  getTransportInfo(destination) {
    return {
      destination,
      options: [
        { mode: 'bus', info: 'Check local transit schedules at sl.se' },
        { mode: 'taxi', info: 'Uber / Bolt available in the area' },
        { mode: 'car', info: 'Approx driving directions via Google Maps' },
        { mode: 'bike', info: 'Rental bikes available nearby' }
      ],
      generatedAt: new Date().toISOString()
    };
  }

  _getCurrentSeason() {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'autumn';
    return 'winter';
  }

  // ════════════════════════════════════════════════════════════════════════
  //  11. Sauna Management
  // ════════════════════════════════════════════════════════════════════════

  scheduleSaunaSession(time, options = {}) {
    const target = options.temperature || 80;
    const mode = options.mode === 'gentle' ? 'gentle' : 'traditional';
    const humidity = options.humidity === 'dry' ? 'dry' : 'steam';
    const preheatMin = options.preheatMinutes || this.saunaState.preheatMinutes;

    const session = {
      id: this._generateId('sauna'),
      scheduledTime: time,
      preheatTime: this._subtractMinutes(time, preheatMin),
      targetTemp: mode === 'gentle' ? Math.min(target, 60) : target,
      mode,
      humidity,
      maxSessionMinutes: this.saunaState.maxSessionMinutes,
      towelWarmer: true,
      postSaunaShower: true,
      cooldownProtocol: true,
      status: 'scheduled',
      createdAt: new Date().toISOString()
    };

    this.saunaState.scheduledSessions.push(session);
    this.log(`Sauna session scheduled: ${time}, ${mode} mode, ${session.targetTemp}°C, ${humidity}`);
    return session;
  }

  startSaunaPreHeat(sessionId) {
    const session = this.saunaState.scheduledSessions.find(s => s.id === sessionId);
    if (!session) return false;
    session.status = 'preheating';
    this.saunaState.active = true;
    this.saunaState.targetTemp = session.targetTemp;
    this.saunaState.mode = session.mode;
    this.saunaState.humidity = session.humidity;
    this.saunaState.towelWarmer = session.towelWarmer;
    this.log(`Sauna pre-heat started for session ${sessionId}: target ${session.targetTemp}°C`);
    return true;
  }

  startSaunaSession(sessionId) {
    const session = this.saunaState.scheduledSessions.find(s => s.id === sessionId);
    if (!session) return false;
    session.status = 'active';
    this.saunaState.safetyTimerActive = true;
    this.saunaState.safetyTimerEnd = new Date(Date.now() + session.maxSessionMinutes * 60000).toISOString();
    this.log(`Sauna session started: ${sessionId}, safety timer ${session.maxSessionMinutes}min`);
    return true;
  }

  endSaunaSession(sessionId) {
    const session = this.saunaState.scheduledSessions.find(s => s.id === sessionId);
    if (!session) return false;
    session.status = 'cooldown';
    this.saunaState.safetyTimerActive = false;
    this.saunaState.active = false;
    this.saunaState.towelWarmer = false;
    this.log(`Sauna session ended: ${sessionId} – cooldown initiated`);
    return true;
  }

  getSaunaState() {
    return { ...this.saunaState, scheduledSessions: [...this.saunaState.scheduledSessions] };
  }

  _subtractMinutes(isoTime, minutes) {
    try {
      const d = new Date(isoTime);
      d.setMinutes(d.getMinutes() - minutes);
      return d.toISOString();
    } catch {
      return new Date(Date.now() - minutes * 60000).toISOString();
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  12. Departure Routine
  // ════════════════════════════════════════════════════════════════════════

  triggerDeparture(guestId, options = {}) {
    const guest = this.guests.get(guestId);
    if (!guest) {
      this.error(`Departure failed – guest ${guestId} not found.`);
      return null;
    }

    const actions = [];

    // Revoke Wi-Fi
    if (this.departureDefaults.revokeWifi) {
      const revoked = this.revokeAllWifiForGuest(guestId);
      actions.push(`wifi_revoked:${revoked}`);
    }

    // Deactivate streaming
    const streamRevoked = this.deactivateAllStreamingForGuest(guestId);
    actions.push(`streaming_deactivated:${streamRevoked}`);

    // Thank-you message
    if (this.departureDefaults.thankYouMessage) {
      const msg = `Thank you for visiting, ${guest.name}! We hope to see you again soon.`;
      actions.push(`thank_you_message:${msg}`);
    }

    // Reset room
    if (this.departureDefaults.resetRoom) {
      actions.push('reset_room_to_default');
    }

    // Collect key/code
    if (this.departureDefaults.collectKeyCode) {
      actions.push('collect_key_code');
    }

    // Feedback prompt
    let feedback = null;
    if (this.departureDefaults.feedbackPrompt) {
      feedback = {
        guestId,
        guestName: guest.name,
        prompt: 'How was your stay? (Rate 1-5)',
        rating: options.rating || null,
        comments: options.comments || '',
        submittedAt: options.rating ? new Date().toISOString() : null
      };
      if (options.rating) {
        this.analytics.guestSatisfaction.push({
          guestId,
          rating: options.rating,
          date: new Date().toISOString()
        });
      }
      actions.push('feedback_prompt');
    }

    // Auto clean-up
    if (this.departureDefaults.autoCleanup) {
      for (const act of this.departureDefaults.cleanupActions) {
        actions.push(`cleanup:${act}`);
      }
    }

    // Update visit history
    const lastVisit = guest.visitHistory[guest.visitHistory.length - 1];
    if (lastVisit && !lastVisit.departureDate) {
      lastVisit.departureDate = new Date().toISOString();
      const arrival = new Date(lastVisit.arrivalDate).getTime();
      const departure = new Date(lastVisit.departureDate).getTime();
      const durationHours = (departure - arrival) / 3600000;
      this.analytics.totalStayDurationHours += durationHours;
    }

    const result = {
      guestId,
      guestName: guest.name,
      actions,
      feedback,
      triggeredAt: new Date().toISOString()
    };

    this.log(`Departure triggered for ${guest.name}: ${actions.length} action(s)`);
    return result;
  }

  submitFeedback(guestId, rating, comments = '') {
    if (rating < 1 || rating > 5) {
      this.error('Rating must be between 1 and 5.');
      return false;
    }
    this.analytics.guestSatisfaction.push({
      guestId,
      rating,
      comments,
      date: new Date().toISOString()
    });
    this.log(`Feedback received from guest ${guestId}: ${rating}/5`);
    return true;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  13. Party Mode
  // ════════════════════════════════════════════════════════════════════════

  activatePartyMode(options = {}) {
    this.partyMode.active = true;
    this.partyMode.outdoorLighting = options.outdoorLighting !== false;
    this.partyMode.musicZones = options.musicZones || ['living_room', 'patio', 'kitchen'];
    this.partyMode.drinkStationLighting = options.drinkStationLighting !== false;
    this.partyMode.bathroomQueueManagement = options.bathroomQueueManagement === true;
    this.partyMode.noiseMonitoring = options.noiseMonitoring !== false;
    this.partyMode.noiseThresholdDb = options.noiseThresholdDb || 70;
    this.partyMode.autoDimHour = options.autoDimHour || 23;
    this.partyMode.snackRefillReminder = options.snackRefillReminder !== false;
    this.partyMode.guestCount = options.initialGuestCount || 0;
    this.partyMode.maxGuestCount = this.partyMode.guestCount;
    this.partyMode.neighborAware = options.neighborAware !== false;
    this.partyMode.lateHourVolumePct = options.lateHourVolumePct || 25;

    // Set party music in all zones
    this.setPartyMusic(this.partyMode.musicZones, options.genre || 'pop');

    this.log(`Party mode ACTIVATED: ${this.partyMode.musicZones.length} zone(s), noise limit ${this.partyMode.noiseThresholdDb}dB`);
    return { ...this.partyMode };
  }

  deactivatePartyMode() {
    this.partyMode.active = false;
    // Stop all party ambiance
    for (const room of this.partyMode.musicZones) {
      this.stopAmbiance(`party_${room}`);
    }
    this.log('Party mode DEACTIVATED');
    return true;
  }

  updatePartyGuestCount(count) {
    this.partyMode.guestCount = count;
    if (count > this.partyMode.maxGuestCount) {
      this.partyMode.maxGuestCount = count;
    }
    this.log(`Party guest count updated: ${count} (peak: ${this.partyMode.maxGuestCount})`);
    return this.partyMode.guestCount;
  }

  checkPartyNoise(currentDb) {
    if (!this.partyMode.active) return null;
    const exceeded = currentDb > this.partyMode.noiseThresholdDb;
    if (exceeded) {
      this.log(`NOISE ALERT: ${currentDb}dB exceeds threshold ${this.partyMode.noiseThresholdDb}dB`);
    }
    return {
      currentDb,
      threshold: this.partyMode.noiseThresholdDb,
      exceeded,
      neighborAware: this.partyMode.neighborAware,
      recommendation: exceeded ? 'Lower music volume immediately' : 'Noise levels OK'
    };
  }

  checkPartyLateDim() {
    if (!this.partyMode.active) return false;
    const hour = new Date().getHours();
    if (hour >= this.partyMode.autoDimHour || hour < 6) {
      this.log('Late-hour auto-dim triggered for party mode');
      return {
        dimmed: true,
        volumeReduced: this.partyMode.lateHourVolumePct,
        message: 'Late hour – lights dimmed and volume reduced for neighbors'
      };
    }
    return { dimmed: false };
  }

  getPartyStatus() {
    return { ...this.partyMode };
  }

  // ════════════════════════════════════════════════════════════════════════
  //  14. Airbnb / Rental Mode
  // ════════════════════════════════════════════════════════════════════════

  activateRentalMode(options = {}) {
    this.rentalMode.active = true;
    this.rentalMode.quietHoursStart = options.quietHoursStart || 22;
    this.rentalMode.quietHoursEnd = options.quietHoursEnd || 7;
    this.rentalMode.turnoverScheduleHours = options.turnoverHours || 4;
    this.rentalMode.keypadCodeLength = options.keypadCodeLength || 6;
    this.rentalMode.cleaningCrewNotification = options.cleaningNotification !== false;
    this.rentalMode.reviewPromptEnabled = options.reviewPrompt !== false;
    this.log('Rental mode ACTIVATED');
    return { ...this.rentalMode };
  }

  deactivateRentalMode() {
    this.rentalMode.active = false;
    this.rentalMode.currentBooking = null;
    this.log('Rental mode DEACTIVATED');
    return true;
  }

  createBooking(bookingData) {
    const code = this._generateKeypadCode(this.rentalMode.keypadCodeLength);
    const booking = {
      id: this._generateId('booking'),
      guestName: bookingData.guestName || 'Guest',
      checkIn: bookingData.checkIn || new Date().toISOString(),
      checkOut: bookingData.checkOut || null,
      keypadCode: code,
      guests: bookingData.guests || 1,
      status: 'confirmed',
      checkInInstructions: this._generateCheckInInstructions(code),
      cleaningScheduled: false,
      inventoryChecked: false,
      reviewRequested: false,
      createdAt: new Date().toISOString()
    };

    this.rentalMode.bookings.push(booking);
    this.rentalMode.currentBooking = booking;
    this.log(`Booking created: ${booking.guestName}, code ${code}, check-in ${booking.checkIn}`);
    return booking;
  }

  completeBooking(bookingId) {
    const booking = this.rentalMode.bookings.find(b => b.id === bookingId);
    if (!booking) return null;

    booking.status = 'completed';
    booking.checkOut = new Date().toISOString();

    // Schedule cleaning
    if (this.rentalMode.cleaningCrewNotification) {
      booking.cleaningScheduled = true;
      this.log(`Cleaning crew notified for booking ${bookingId}`);
    }

    // Review prompt
    if (this.rentalMode.reviewPromptEnabled) {
      booking.reviewRequested = true;
    }

    if (this.rentalMode.currentBooking && this.rentalMode.currentBooking.id === bookingId) {
      this.rentalMode.currentBooking = null;
    }

    this.log(`Booking completed: ${bookingId}`);
    return booking;
  }

  checkInventory(items = []) {
    const defaults = [
      { item: 'toilet_paper', minQuantity: 4, currentQuantity: 0 },
      { item: 'hand_soap', minQuantity: 2, currentQuantity: 0 },
      { item: 'shampoo', minQuantity: 2, currentQuantity: 0 },
      { item: 'coffee_pods', minQuantity: 10, currentQuantity: 0 },
      { item: 'tea_bags', minQuantity: 10, currentQuantity: 0 },
      { item: 'trash_bags', minQuantity: 5, currentQuantity: 0 },
      { item: 'dish_soap', minQuantity: 1, currentQuantity: 0 },
      { item: 'paper_towels', minQuantity: 2, currentQuantity: 0 }
    ];

    const checklist = items.length > 0 ? items : defaults;
    this.rentalMode.inventoryChecklist = checklist;

    const needsRestock = checklist.filter(i => i.currentQuantity < i.minQuantity);
    this.log(`Inventory check: ${needsRestock.length} item(s) need restocking`);
    return { checklist, needsRestock };
  }

  isQuietHours() {
    const hour = new Date().getHours();
    if (this.rentalMode.quietHoursStart > this.rentalMode.quietHoursEnd) {
      return hour >= this.rentalMode.quietHoursStart || hour < this.rentalMode.quietHoursEnd;
    }
    return hour >= this.rentalMode.quietHoursStart && hour < this.rentalMode.quietHoursEnd;
  }

  _generateCheckInInstructions(code) {
    return [
      `Welcome! Your keypad code is: ${code}`,
      'Enter the code on the front door keypad to unlock.',
      'Wi-Fi details are on the fridge.',
      'House rules are displayed on the smart display in the hallway.',
      'Check-out time is 11:00. Please leave the key on the kitchen counter.',
      'For emergencies, call 112.'
    ];
  }

  _generateKeypadCode(length = 6) {
    let code = '';
    for (let i = 0; i < length; i++) {
      code += Math.floor(Math.random() * 10).toString();
    }
    return code;
  }

  getRentalStatus() {
    return {
      active: this.rentalMode.active,
      currentBooking: this.rentalMode.currentBooking,
      totalBookings: this.rentalMode.bookings.length,
      quietHours: this.isQuietHours(),
      quietHoursRange: `${this.rentalMode.quietHoursStart}:00–${this.rentalMode.quietHoursEnd}:00`
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  //  15. Kid Entertainment
  // ════════════════════════════════════════════════════════════════════════

  registerKid(kidData) {
    const id = this._generateId('kid');
    const kid = {
      id,
      name: kidData.name || 'Child',
      age: kidData.age || 5,
      parentGuestId: kidData.parentGuestId || null,
      contentRating: kidData.age < 7 ? 'G' : 'PG',
      snackSchedule: [...this.kidDefaults.snackSchedule],
      mealSchedule: [...this.kidDefaults.mealSchedule],
      outdoorPlayMonitoring: this.kidDefaults.outdoorPlayMonitoring,
      createdAt: new Date().toISOString()
    };
    this.kidProfiles.set(id, kid);
    this.log(`Kid registered: ${kid.name}, age ${kid.age}`);
    return kid;
  }

  removeKid(kidId) {
    const kid = this.kidProfiles.get(kidId);
    if (!kid) return false;
    this.kidProfiles.delete(kidId);
    this.log(`Kid removed: ${kid.name}`);
    return true;
  }

  getKidFriendlyContent(kidId) {
    const kid = this.kidProfiles.get(kidId);
    if (!kid) return null;

    const content = {
      streaming: this.entertainmentCatalog.streamingServices
        .filter(s => s.type === 'video')
        .map(s => ({ ...s, note: 'Kids profile / parental controls enabled' })),
      boardGames: this.entertainmentCatalog.boardGames
        .filter(g => g.ageRating <= kid.age + 2),
      videoGames: this.entertainmentCatalog.videoGames
        .filter(g => g.ageRating <= kid.age + 2),
      outdoorActivities: kid.age >= 3
        ? this.entertainmentCatalog.outdoorActivities.filter(a => a.id !== 'sauna')
        : [{ id: 'sandbox', name: 'Sandbox play', available: true }]
    };

    this.log(`Kid-friendly content for ${kid.name}: ${content.boardGames.length} games, ${content.videoGames.length} video games`);
    return content;
  }

  suggestKidActivities(kidId) {
    const kid = this.kidProfiles.get(kidId);
    if (!kid) return [];

    const byAge = [];
    if (kid.age <= 3) {
      byAge.push('Coloring books', 'Building blocks', 'Sandbox play', 'Cartoon time');
    } else if (kid.age <= 7) {
      byAge.push('Board games (simple)', 'Drawing', 'Outdoor play', 'Kids movies', 'Hide and seek');
    } else if (kid.age <= 12) {
      byAge.push('Board games', 'Video games', 'Cycling', 'Swimming', 'Treasure hunt');
    } else {
      byAge.push('Video games', 'Movies', 'Sports', 'Board games (strategy)', 'Music');
    }

    this.log(`Kid activity suggestions for ${kid.name} (age ${kid.age}): ${byAge.length} ideas`);
    return byAge;
  }

  addKidSafeZone(zone) {
    const z = {
      id: this._generateId('zone'),
      name: zone.name || 'Safe Zone',
      room: zone.room || 'playroom',
      monitoring: true,
      alerts: true,
      createdAt: new Date().toISOString()
    };
    this.kidSafeZones.push(z);
    this.log(`Kid safe zone added: ${z.name} (${z.room})`);
    return z;
  }

  setNapRoomAvailability(available) {
    this.kidDefaults.napRoomAvailable = available;
    this.log(`Nap room availability: ${available}`);
    return available;
  }

  getKidSchedule(kidId) {
    const kid = this.kidProfiles.get(kidId);
    if (!kid) return null;
    return {
      name: kid.name,
      snackSchedule: kid.snackSchedule,
      mealSchedule: kid.mealSchedule,
      napRoomAvailable: this.kidDefaults.napRoomAvailable
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  //  16. Guest Communication
  // ════════════════════════════════════════════════════════════════════════

  sendInHomeMessage(guestId, message, display = 'hallway_display') {
    const guest = this.guests.get(guestId);
    const msg = {
      id: this._generateId('msg'),
      guestId,
      guestName: guest ? guest.name : 'All',
      message,
      display,
      sentAt: new Date().toISOString(),
      read: false
    };
    this.messages.push(msg);
    this.log(`Message sent to ${msg.guestName} on ${display}: "${message}"`);
    return msg;
  }

  broadcastMessage(message, displays = ['hallway_display', 'living_room_display', 'kitchen_display']) {
    const msgs = [];
    for (const display of displays) {
      const msg = this.sendInHomeMessage(null, message, display);
      msgs.push(msg);
    }
    this.log(`Broadcast message to ${displays.length} display(s)`);
    return msgs;
  }

  scheduleWakeUpCall(guestId, time, method = 'smart_display') {
    const guest = this.guests.get(guestId);
    if (!guest) return null;

    const call = {
      id: this._generateId('wake'),
      guestId,
      guestName: guest.name,
      time,
      method,
      triggered: false,
      createdAt: new Date().toISOString()
    };
    this.wakeUpCalls.set(call.id, call);
    this.log(`Wake-up call scheduled for ${guest.name} at ${time} via ${method}`);
    return call;
  }

  cancelWakeUpCall(callId) {
    const call = this.wakeUpCalls.get(callId);
    if (!call) return false;
    this.wakeUpCalls.delete(callId);
    this.log(`Wake-up call cancelled: ${callId}`);
    return true;
  }

  getWeatherForDeparture(guestId) {
    const guest = this.guests.get(guestId);
    // Simulated weather — in production, integrate real weather API
    const forecast = {
      guestId,
      guestName: guest ? guest.name : 'Guest',
      date: new Date().toISOString().slice(0, 10),
      temperature: Math.round(5 + Math.random() * 20),
      condition: ['sunny', 'cloudy', 'rainy', 'partly cloudy'][Math.floor(Math.random() * 4)],
      recommendation: 'Check the weather before you leave!',
      generatedAt: new Date().toISOString()
    };
    this.log(`Weather forecast for ${forecast.guestName}'s departure: ${forecast.temperature}°C, ${forecast.condition}`);
    return forecast;
  }

  getLocalTransitInfo() {
    return {
      nearestBusStop: 'Hemvägen (250m, 3 min walk)',
      busLines: ['Bus 42 → City Center', 'Bus 15 → Train Station'],
      trainStation: 'Centralstation (15 min by bus)',
      taxiBooking: { uber: true, bolt: true, localTaxi: '+46 8 123 4567' },
      updatedAt: new Date().toISOString()
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  //  17. Monitoring Cycle
  // ════════════════════════════════════════════════════════════════════════

  _startMonitoringCycle() {
    if (this.monitoringTimer) clearInterval(this.monitoringTimer);
    this.monitoringTimer = setInterval(() => {
      this._runMonitoringCycle();
    }, this.monitoringIntervalMs);
    this.log(`Monitoring cycle started: every ${this.monitoringIntervalMs / 1000}s`);
  }

  _runMonitoringCycle() {
    const now = new Date();
    this.lastMonitoringCycle = now.toISOString();

    // 1. Check Wi-Fi expiry
    this._checkWifiExpiry();

    // 2. Check guest presence (simulated)
    this._checkGuestPresence();

    // 3. Check sauna safety
    this._checkSaunaSafety();

    // 4. Check party late-dim
    if (this.partyMode.active) {
      this.checkPartyLateDim();
    }

    // 5. Check rental quiet hours
    if (this.rentalMode.active) {
      this._enforceQuietHours();
    }

    // 6. Check schedule reminders
    this._checkScheduleReminders();

    // 7. Check kid schedules
    this._checkKidSchedules();

    this.log(`Monitoring cycle completed at ${this.lastMonitoringCycle}`);
  }

  _checkGuestPresence() {
    const activeGuests = this.getAllGuests().filter(g => {
      const lastVisit = g.visitHistory[g.visitHistory.length - 1];
      return lastVisit && !lastVisit.departureDate;
    });
    if (activeGuests.length > 0) {
      this.log(`Active guests: ${activeGuests.map(g => g.name).join(', ')}`);
    }
  }

  _checkSaunaSafety() {
    if (!this.saunaState.safetyTimerActive) return;
    const end = new Date(this.saunaState.safetyTimerEnd).getTime();
    if (Date.now() >= end) {
      this.log('SAUNA SAFETY: Max session time reached – shutting down');
      this.saunaState.active = false;
      this.saunaState.safetyTimerActive = false;
      const activeSession = this.saunaState.scheduledSessions.find(s => s.status === 'active');
      if (activeSession) {
        activeSession.status = 'safety_stopped';
      }
    }
  }

  _enforceQuietHours() {
    if (this.isQuietHours()) {
      // During quiet hours, ensure lower volume and limited noise
      this.log('Quiet hours active – enforcing noise restrictions');
    }
  }

  _checkScheduleReminders() {
    const now = new Date();
    // Check wake-up calls
    for (const [id, call] of this.wakeUpCalls) {
      if (call.triggered) continue;
      try {
        const callTime = new Date(call.time);
        const diff = callTime.getTime() - now.getTime();
        if (diff <= 0 && diff > -this.monitoringIntervalMs) {
          call.triggered = true;
          this.log(`Wake-up call triggered for ${call.guestName}`);
        }
      } catch {
        // Invalid date, skip
      }
    }

    // Check sauna preheat
    for (const session of this.saunaState.scheduledSessions) {
      if (session.status !== 'scheduled') continue;
      try {
        const preheatTime = new Date(session.preheatTime);
        const diff = preheatTime.getTime() - now.getTime();
        if (diff <= 0 && diff > -this.monitoringIntervalMs) {
          this.startSaunaPreHeat(session.id);
        }
      } catch {
        // Invalid date, skip
      }
    }
  }

  _checkKidSchedules() {
    if (this.kidProfiles.size === 0) return;
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    for (const [id, kid] of this.kidProfiles) {
      if (kid.snackSchedule.includes(currentTime)) {
        this.log(`Snack time reminder for ${kid.name}`);
      }
      if (kid.mealSchedule.includes(currentTime)) {
        this.log(`Meal time reminder for ${kid.name}`);
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  18. Analytics & Statistics
  // ════════════════════════════════════════════════════════════════════════

  recordEntertainmentUsage(type, item) {
    const key = `${type}:${item}`;
    this.analytics.entertainmentUsage[key] = (this.analytics.entertainmentUsage[key] || 0) + 1;
    this.log(`Entertainment usage recorded: ${key}`);
  }

  recordCost(amount, description = '') {
    this.analytics.costPerVisit.push({
      amount,
      description,
      date: new Date().toISOString()
    });
    this.analytics.annualSpent += amount;
    this.log(`Cost recorded: ${amount} SEK – ${description}`);
  }

  setAnnualBudget(budget) {
    this.analytics.annualBudget = budget;
    this.log(`Annual entertainment budget set: ${budget} SEK`);
  }

  getBudgetStatus() {
    const remaining = this.analytics.annualBudget - this.analytics.annualSpent;
    return {
      budget: this.analytics.annualBudget,
      spent: this.analytics.annualSpent,
      remaining,
      percentUsed: this.analytics.annualBudget > 0
        ? Math.round((this.analytics.annualSpent / this.analytics.annualBudget) * 100)
        : 0
    };
  }

  _calculatePeakMonth() {
    let maxVisits = 0;
    let peak = null;
    for (const [month, count] of Object.entries(this.analytics.visitsByMonth)) {
      if (count > maxVisits) {
        maxVisits = count;
        peak = month;
      }
    }
    this.analytics.peakMonth = peak;
    return peak;
  }

  _calculateAverageSatisfaction() {
    if (this.analytics.guestSatisfaction.length === 0) return 0;
    const sum = this.analytics.guestSatisfaction.reduce((acc, s) => acc + s.rating, 0);
    return Math.round((sum / this.analytics.guestSatisfaction.length) * 10) / 10;
  }

  _getMostPopularEntertainment() {
    let maxUsage = 0;
    let popular = null;
    for (const [key, count] of Object.entries(this.analytics.entertainmentUsage)) {
      if (count > maxUsage) {
        maxUsage = count;
        popular = key;
      }
    }
    return popular ? { item: popular, usageCount: maxUsage } : null;
  }

  _calculateAverageStayDuration() {
    if (this.analytics.totalVisits === 0) return 0;
    return Math.round((this.analytics.totalStayDurationHours / this.analytics.totalVisits) * 10) / 10;
  }

  _calculateAverageCostPerVisit() {
    if (this.analytics.costPerVisit.length === 0) return 0;
    const total = this.analytics.costPerVisit.reduce((acc, c) => acc + c.amount, 0);
    return Math.round((total / this.analytics.costPerVisit.length) * 10) / 10;
  }

  getStatistics() {
    return {
      system: 'AdvancedGuestEntertainmentSystem',
      initialized: this.initialized,
      lastMonitoringCycle: this.lastMonitoringCycle,
      guests: {
        total: this.guests.size,
        max: this.maxGuests,
        vipCount: Array.from(this.guests.values()).filter(g => g.vip).length,
        activeVisitors: Array.from(this.guests.values()).filter(g => {
          const last = g.visitHistory[g.visitHistory.length - 1];
          return last && !last.departureDate;
        }).length
      },
      wifi: {
        activeSessions: this.getActiveWifiSessions().length,
        totalProvisioned: this.wifiSessions.size
      },
      entertainment: {
        streamingServices: this.entertainmentCatalog.streamingServices.length,
        boardGames: this.entertainmentCatalog.boardGames.length,
        videoGames: this.entertainmentCatalog.videoGames.length,
        speakers: this.entertainmentCatalog.bluetoothSpeakers.length,
        activeStreamingProfiles: Array.from(this.streamingProfiles.values()).filter(p => p.active).length,
        mostPopular: this._getMostPopularEntertainment()
      },
      rooms: {
        checklistsActive: this.roomChecklist.size,
        roomsReady: Array.from(this.roomChecklist.keys()).filter(k => this.isRoomReady(k)).length
      },
      sauna: {
        active: this.saunaState.active,
        scheduledSessions: this.saunaState.scheduledSessions.length,
        currentTemp: this.saunaState.currentTemp,
        targetTemp: this.saunaState.targetTemp
      },
      partyMode: {
        active: this.partyMode.active,
        guestCount: this.partyMode.guestCount,
        peakGuestCount: this.partyMode.maxGuestCount,
        musicZones: this.partyMode.musicZones.length
      },
      rental: {
        active: this.rentalMode.active,
        totalBookings: this.rentalMode.bookings.length,
        currentBooking: this.rentalMode.currentBooking ? this.rentalMode.currentBooking.id : null,
        quietHours: this.isQuietHours()
      },
      kids: {
        registeredKids: this.kidProfiles.size,
        safeZones: this.kidSafeZones.length,
        napRoomAvailable: this.kidDefaults.napRoomAvailable
      },
      communication: {
        messagesSent: this.messages.length,
        pendingWakeUpCalls: Array.from(this.wakeUpCalls.values()).filter(c => !c.triggered).length
      },
      analytics: {
        totalVisits: this.analytics.totalVisits,
        averageStayDurationHours: this._calculateAverageStayDuration(),
        averageSatisfaction: this._calculateAverageSatisfaction(),
        peakMonth: this._calculatePeakMonth(),
        visitsByMonth: { ...this.analytics.visitsByMonth },
        budget: this.getBudgetStatus(),
        averageCostPerVisit: this._calculateAverageCostPerVisit(),
        totalSatisfactionResponses: this.analytics.guestSatisfaction.length
      },
      houseRules: {
        totalRules: this.houseRules.length,
        languages: this.houseRulesLanguages
      }
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Utility helpers
  // ════════════════════════════════════════════════════════════════════════

  _generateId(prefix = 'id') {
    return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Logging
  // ════════════════════════════════════════════════════════════════════════

  log(msg) {
    const ts = new Date().toISOString();
    if (this.homey && typeof this.homey.log === 'function') {
      this.homey.log(`[GuestEnt] ${msg}`);
    } else {
      console.log(`[${ts}] [GuestEnt] ${msg}`);
    }
  }

  error(msg) {
    const ts = new Date().toISOString();
    if (this.homey && typeof this.homey.error === 'function') {
      this.homey.error(`[GuestEnt] ${msg}`);
    } else {
      console.error(`[${ts}] [GuestEnt] ERROR: ${msg}`);
    }
  }
}

module.exports = AdvancedGuestEntertainmentSystem;
