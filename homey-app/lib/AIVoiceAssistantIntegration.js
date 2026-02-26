'use strict';

/**
 * AIVoiceAssistantIntegration — Comprehensive Voice Intelligence Hub
 *
 * Multi-language, context-aware, speaker-identified voice control system
 * for the Homey Smart Home platform.
 */

const _EventEmitter = require('events');

// ── Language Packs ──────────────────────────────────────────────────────────

const LANGUAGE_PACKS = {
  sv: {
    code: 'sv', name: 'Svenska', primary: true,
    confirmations: ['Okej', 'Klart', 'Gjort', 'Självklart', 'Absolut'],
    errors: ['Förlåt, jag förstod inte', 'Kan du upprepa?', 'Det gick inte'],
    greeting: 'Hej! Hur kan jag hjälpa dig?',
    goodbye: 'Ha det bra!',
    misunderstand: 'Förlåt, jag förstod inte riktigt. Kan du säga det igen?',
    proactive: { cold: 'Det börjar bli kallt, ska jag sätta på värmen?', rain: 'Det ser ut att regna, ska jag stänga fönstren?' }
  },
  en: {
    code: 'en', name: 'English', primary: false,
    confirmations: ['Okay', 'Done', 'Got it', 'Sure', 'Absolutely'],
    errors: ['Sorry, I didn\'t understand', 'Could you repeat that?', 'That didn\'t work'],
    greeting: 'Hello! How can I help you?',
    goodbye: 'Goodbye!',
    misunderstand: 'Sorry, I didn\'t quite get that. Could you say it again?',
    proactive: { cold: 'It\'s getting cold, shall I turn on the heating?', rain: 'Looks like rain, shall I close the windows?' }
  },
  no: {
    code: 'no', name: 'Norsk', primary: false,
    confirmations: ['Greit', 'Ferdig', 'Klart', 'Selvfølgelig'],
    errors: ['Beklager, jeg forstod ikke', 'Kan du gjenta?', 'Det gikk ikke'],
    greeting: 'Hei! Hvordan kan jeg hjelpe deg?',
    goodbye: 'Ha det!',
    misunderstand: 'Beklager, jeg forstod ikke helt. Kan du si det igjen?',
    proactive: { cold: 'Det begynner å bli kaldt, skal jeg skru på varmen?', rain: 'Det ser ut til å regne, skal jeg lukke vinduene?' }
  },
  da: {
    code: 'da', name: 'Dansk', primary: false,
    confirmations: ['Okay', 'Færdig', 'Klart', 'Selvfølgelig'],
    errors: ['Undskyld, jeg forstod ikke', 'Kan du gentage?', 'Det virkede ikke'],
    greeting: 'Hej! Hvordan kan jeg hjælpe dig?',
    goodbye: 'Farvel!',
    misunderstand: 'Undskyld, jeg forstod ikke helt. Kan du sige det igen?',
    proactive: { cold: 'Det begynder at blive koldt, skal jeg tænde varmen?', rain: 'Det ser ud til at regne, skal jeg lukke vinduerne?' }
  },
  fi: {
    code: 'fi', name: 'Suomi', primary: false,
    confirmations: ['Selvä', 'Valmis', 'Tehty', 'Tietenkin'],
    errors: ['Anteeksi, en ymmärtänyt', 'Voitko toistaa?', 'Se ei onnistunut'],
    greeting: 'Hei! Kuinka voin auttaa?',
    goodbye: 'Näkemiin!',
    misunderstand: 'Anteeksi, en aivan ymmärtänyt. Voitko sanoa uudelleen?',
    proactive: { cold: 'Alkaa olla kylmä, laitetaanko lämmitys päälle?', rain: 'Näyttää sateelta, suljetaanko ikkunat?' }
  },
  de: {
    code: 'de', name: 'Deutsch', primary: false,
    confirmations: ['Okay', 'Erledigt', 'Gemacht', 'Natürlich', 'Absolut'],
    errors: ['Entschuldigung, das habe ich nicht verstanden', 'Können Sie das wiederholen?', 'Das hat nicht funktioniert'],
    greeting: 'Hallo! Wie kann ich Ihnen helfen?',
    goodbye: 'Auf Wiedersehen!',
    misunderstand: 'Entschuldigung, das habe ich nicht ganz verstanden. Können Sie es nochmal sagen?',
    proactive: { cold: 'Es wird kalt, soll ich die Heizung einschalten?', rain: 'Es sieht nach Regen aus, soll ich die Fenster schließen?' }
  }
};

// ── Intent Definitions ──────────────────────────────────────────────────────

const INTENT_DEFINITIONS = {
  control_device: {
    confidence_threshold: 0.75,
    patterns: [
      /(?:turn|switch|set)\s+(on|off)\s+(?:the\s+)?(.+)/i,
      /(?:sätt|slå)\s+(på|av)\s+(.+)/i,
      /(?:stäng|öppna)\s+(.+)/i
    ],
    parameters: ['action', 'device', 'room', 'value'],
    category: 'device'
  },
  query_status: {
    confidence_threshold: 0.70,
    patterns: [
      /(?:is|are)\s+(?:the\s+)?(.+?)\s+(on|off|open|closed|locked)/i,
      /(?:what(?:'s| is)\s+the\s+status\s+of)\s+(.+)/i,
      /(?:är)\s+(.+?)\s+(på|av|öppen|stängd|låst)/i
    ],
    parameters: ['device', 'property'],
    category: 'query'
  },
  set_temperature: {
    confidence_threshold: 0.80,
    patterns: [
      /(?:set|change)\s+(?:the\s+)?(?:temperature|thermostat)\s+(?:to|at)\s+(\d+)/i,
      /(?:make it|set it)\s+(warmer|cooler|hotter|colder)/i,
      /(?:ställ|sätt)\s+(?:temperaturen|termostaten)\s+(?:till|på)\s+(\d+)/i
    ],
    parameters: ['temperature', 'room', 'unit'],
    category: 'climate'
  },
  activate_scene: {
    confidence_threshold: 0.75,
    patterns: [
      /(?:activate|start|run|set)\s+(?:the\s+)?(?:scene\s+)?["""]?(.+?)["""]?\s*(?:scene)?$/i,
      /(?:aktivera|starta|kör)\s+(?:scen\s+)?["""]?(.+?)["""]?$/i
    ],
    parameters: ['scene_name'],
    category: 'scene'
  },
  arm_security: {
    confidence_threshold: 0.90,
    patterns: [
      /(?:arm|disarm|activate|deactivate)\s+(?:the\s+)?(?:security|alarm)\s*(?:system)?/i,
      /(?:larma|avlarma|aktivera|avaktivera)\s+(?:larmet|säkerhetssystemet)/i
    ],
    parameters: ['action', 'mode', 'zone'],
    category: 'security',
    requires_auth: true
  },
  create_automation: {
    confidence_threshold: 0.80,
    patterns: [
      /(?:create|make|set up|add)\s+(?:a\s+)?(?:new\s+)?(?:automation|rule|flow)\s+(.+)/i,
      /(?:when)\s+(.+?)\s+(?:then)\s+(.+)/i,
      /(?:skapa|gör|lägg till)\s+(?:en\s+)?(?:ny\s+)?(?:automation|regel|flöde)\s+(.+)/i
    ],
    parameters: ['trigger', 'condition', 'action'],
    category: 'automation'
  },
  weather_query: {
    confidence_threshold: 0.65,
    patterns: [
      /(?:what(?:'s| is)\s+the\s+weather|how(?:'s| is)\s+the\s+weather|will it\s+(?:rain|snow|be sunny))/i,
      /(?:weather\s+(?:today|tomorrow|this week|forecast))/i,
      /(?:hur\s+(?:är|blir)\s+vädret|kommer det\s+(?:regna|snöa))/i
    ],
    parameters: ['timeframe', 'location'],
    category: 'information'
  },
  energy_report: {
    confidence_threshold: 0.70,
    patterns: [
      /(?:how much\s+(?:power|energy|electricity))\s+(?:am I|are we)\s+using/i,
      /(?:energy|power)\s+(?:report|usage|consumption|statistics)/i,
      /(?:hur mycket\s+(?:el|energi|ström))\s+(?:använder|förbrukar)/i
    ],
    parameters: ['timeframe', 'category'],
    category: 'energy'
  },
  calendar_query: {
    confidence_threshold: 0.70,
    patterns: [
      /(?:what(?:'s| is))\s+(?:on\s+)?(?:my|the)\s+(?:calendar|schedule|agenda)/i,
      /(?:what(?:'s| is)\s+my\s+next\s+(?:meeting|appointment|event))/i,
      /(?:vad\s+(?:har|finns)\s+(?:jag\s+)?(?:i|på)\s+(?:kalendern|schemat))/i
    ],
    parameters: ['timeframe', 'calendar_name'],
    category: 'information'
  },
  timer_set: {
    confidence_threshold: 0.80,
    patterns: [
      /(?:set|start|create)\s+(?:a\s+)?timer\s+(?:for\s+)?(\d+)\s*(minutes?|seconds?|hours?)/i,
      /(?:sätt|starta)\s+(?:en\s+)?timer\s+(?:på\s+)?(\d+)\s*(minuter?|sekunder?|timmar?)/i
    ],
    parameters: ['duration', 'unit', 'label'],
    category: 'utility'
  },
  reminder_create: {
    confidence_threshold: 0.75,
    patterns: [
      /(?:remind me|set a reminder)\s+(?:to\s+)?(.+?)\s+(?:at|in|on)\s+(.+)/i,
      /(?:påminn mig|skapa en påminnelse)\s+(?:att\s+)?(.+?)\s+(?:kl|om|på)\s+(.+)/i
    ],
    parameters: ['message', 'time', 'recurrence'],
    category: 'utility'
  },
  music_play: {
    confidence_threshold: 0.70,
    patterns: [
      /(?:play|start|put on)\s+(?:some\s+)?(?:music|song|album|playlist)\s*(.+)?/i,
      /(?:play)\s+(.+?)\s+(?:by|from|on)\s+(.+)/i,
      /(?:spela|starta|sätt på)\s+(?:lite\s+)?(?:musik|låt|album|spellista)\s*(.+)?/i
    ],
    parameters: ['query', 'artist', 'source', 'room'],
    category: 'media'
  },
  door_lock: {
    confidence_threshold: 0.90,
    patterns: [
      /(?:lock|unlock)\s+(?:the\s+)?(?:front\s+)?(?:door|gate|entrance)/i,
      /(?:lås|lås upp)\s+(?:dörren|ytterdörren|grinden|entrén)/i
    ],
    parameters: ['action', 'target'],
    category: 'security',
    requires_auth: true
  },
  camera_check: {
    confidence_threshold: 0.70,
    patterns: [
      /(?:show|check|view|display)\s+(?:the\s+)?(?:camera|cameras|security feed)/i,
      /(?:who(?:'s| is)\s+at\s+the\s+(?:door|front|back))/i,
      /(?:visa|kolla|se)\s+(?:kameran|kamerorna|övervakningskameran)/i
    ],
    parameters: ['camera_name', 'location'],
    category: 'security'
  },
  guest_access: {
    confidence_threshold: 0.85,
    patterns: [
      /(?:grant|give|create|revoke)\s+(?:guest\s+)?access\s+(?:to|for)\s+(.+)/i,
      /(?:ge|skapa|ta bort)\s+(?:gäst)?tillgång\s+(?:till|för)\s+(.+)/i
    ],
    parameters: ['person', 'access_level', 'duration', 'areas'],
    category: 'security',
    requires_auth: true
  },
  cooking_help: {
    confidence_threshold: 0.65,
    patterns: [
      /(?:cooking|recipe|how (?:do I|to)\s+(?:make|cook|bake))\s+(.+)/i,
      /(?:set (?:the\s+)?oven|preheat)\s+(?:to\s+)?(\d+)/i,
      /(?:matlagning|recept|hur\s+(?:gör|lagar|bakar)\s+(?:jag|man))\s+(.+)/i
    ],
    parameters: ['dish', 'temperature', 'duration'],
    category: 'kitchen'
  },
  shopping_list: {
    confidence_threshold: 0.70,
    patterns: [
      /(?:add|put)\s+(.+?)\s+(?:to|on)\s+(?:the\s+)?(?:shopping|grocery)\s+list/i,
      /(?:what(?:'s| is)\s+on)\s+(?:the\s+)?(?:shopping|grocery)\s+list/i,
      /(?:lägg till|sätt)\s+(.+?)\s+(?:på|i)\s+(?:inköps|handlings?)listan/i
    ],
    parameters: ['item', 'quantity', 'store'],
    category: 'utility'
  },
  goodnight_routine: {
    confidence_threshold: 0.85,
    patterns: [
      /(?:good\s*night|bedtime|time\s+(?:for|to)\s+(?:bed|sleep))/i,
      /(?:god\s*natt|dags att sova|läggdags)/i
    ],
    parameters: [],
    category: 'routine'
  },
  good_morning_routine: {
    confidence_threshold: 0.85,
    patterns: [
      /(?:good\s*morning|wake\s*up|i(?:'m| am)\s+(?:up|awake))/i,
      /(?:god\s*morgon|vakna|jag\s+(?:är\s+)?vaken)/i
    ],
    parameters: [],
    category: 'routine'
  },
  emergency_alert: {
    confidence_threshold: 0.60,
    patterns: [
      /(?:emergency|help|fire|intruder|break.?in|smoke|gas\s+leak|flood)/i,
      /(?:nödläge|hjälp|brand|inbrott|rök|gasläcka|översvämning)/i
    ],
    parameters: ['type', 'location'],
    category: 'emergency',
    priority: 'critical'
  }
};

// ── Dialog States ───────────────────────────────────────────────────────────

const DIALOG_STATES = {
  IDLE: 'idle',
  LISTENING: 'listening',
  PROCESSING: 'processing',
  CLARIFYING: 'clarifying',
  CONFIRMING: 'confirming'
};

// ── Permission Levels ───────────────────────────────────────────────────────

const PERMISSION_LEVELS = {
  admin: { level: 4, canArm: true, canLock: true, canGrantAccess: true, canCreateAutomation: true, canPurchase: true },
  adult: { level: 3, canArm: true, canLock: true, canGrantAccess: false, canCreateAutomation: true, canPurchase: false },
  child: { level: 2, canArm: false, canLock: false, canGrantAccess: false, canCreateAutomation: false, canPurchase: false },
  guest: { level: 1, canArm: false, canLock: false, canGrantAccess: false, canCreateAutomation: false, canPurchase: false }
};

// ── Noise Suppression Levels ────────────────────────────────────────────────

const NOISE_SUPPRESSION = {
  off: { gain: 0, filterFreq: 0, label: 'Off' },
  low: { gain: -6, filterFreq: 200, label: 'Low' },
  medium: { gain: -12, filterFreq: 400, label: 'Medium' },
  aggressive: { gain: -24, filterFreq: 600, label: 'Aggressive' }
};

// ── Automation Macros ───────────────────────────────────────────────────────

const DEFAULT_MACROS = {
  'movie time': {
    label: 'Movie Time',
    steps: [
      { action: 'dim_lights', params: { brightness: 10, room: 'living_room' } },
      { action: 'lower_screen', params: {} },
      { action: 'set_audio', params: { mode: 'surround' } },
      { action: 'close_blinds', params: { room: 'living_room' } }
    ]
  },
  'good morning': {
    label: 'Good Morning',
    steps: [
      { action: 'turn_on_lights', params: { brightness: 80, temperature: 4000 } },
      { action: 'weather_briefing', params: {} },
      { action: 'start_coffee', params: {} },
      { action: 'play_news', params: {} }
    ]
  },
  'leaving home': {
    label: 'Leaving Home',
    steps: [
      { action: 'all_lights_off', params: {} },
      { action: 'lock_doors', params: { all: true } },
      { action: 'arm_security', params: { mode: 'away' } },
      { action: 'set_thermostat', params: { mode: 'eco' } }
    ]
  },
  'bedtime': {
    label: 'Bedtime',
    steps: [
      { action: 'dim_lights', params: { brightness: 5, temperature: 2200 } },
      { action: 'lock_doors', params: { all: true } },
      { action: 'arm_security', params: { mode: 'night' } },
      { action: 'set_thermostat', params: { temperature: 18 } },
      { action: 'turn_off_media', params: {} }
    ]
  }
};

// ── Natural Language Scene Mappings ─────────────────────────────────────────

const NL_SCENE_MAP = {
  'cozy': { lights: { brightness: 30, temperature: 2200 }, temperature: 22, music: { genre: 'jazz', volume: 25 } },
  'mysigt': { lights: { brightness: 30, temperature: 2200 }, temperature: 22, music: { genre: 'jazz', volume: 25 } },
  'party': { lights: { brightness: 100, mode: 'colorful' }, music: { genre: 'party', volume: 80 }, scope: 'all_rooms' },
  'fest': { lights: { brightness: 100, mode: 'colorful' }, music: { genre: 'party', volume: 80 }, scope: 'all_rooms' },
  'romantic': { lights: { brightness: 15, temperature: 2000, color: 'red' }, music: { genre: 'romantic', volume: 20 } },
  'romantiskt': { lights: { brightness: 15, temperature: 2000, color: 'red' }, music: { genre: 'romantic', volume: 20 } },
  'focus': { lights: { brightness: 80, temperature: 5000 }, music: { genre: 'ambient', volume: 15 }, notifications: 'silent' },
  'fokus': { lights: { brightness: 80, temperature: 5000 }, music: { genre: 'ambient', volume: 15 }, notifications: 'silent' },
  'relax': { lights: { brightness: 40, temperature: 2700 }, temperature: 23, music: { genre: 'chill', volume: 30 } },
  'avslappning': { lights: { brightness: 40, temperature: 2700 }, temperature: 23, music: { genre: 'chill', volume: 30 } },
  'energize': { lights: { brightness: 100, temperature: 6500 }, music: { genre: 'upbeat', volume: 60 } },
  'energi': { lights: { brightness: 100, temperature: 6500 }, music: { genre: 'upbeat', volume: 60 } },
  'dinner': { lights: { brightness: 50, temperature: 2700 }, music: { genre: 'dinner', volume: 20 } },
  'middag': { lights: { brightness: 50, temperature: 2700 }, music: { genre: 'dinner', volume: 20 } }
};

// ═══════════════════════════════════════════════════════════════════════════
//  Main Class
// ═══════════════════════════════════════════════════════════════════════════

class AIVoiceAssistantIntegration {

  constructor(homey) {
    this.homey = homey;

    // ── Core state ────────────────────────────────────────────────────────
    this.dialogState = DIALOG_STATES.IDLE;
    this.conversationMemory = [];          // last 10 exchanges
    this.maxConversationMemory = 10;
    this.currentContext = {};              // entity carry-over between turns
    this.activeTimers = new Map();

    // ── Wake word ─────────────────────────────────────────────────────────
    this.wakeWord = 'Hey Hemma';
    this.wakeWordSensitivity = 'medium';   // low | medium | high
    this.wakeWordSensitivities = { low: 0.4, medium: 0.6, high: 0.85 };
    this.falsePositiveRejection = true;
    this.wakeWordActive = false;

    // ── Voice profiles (up to 8 members) ──────────────────────────────────
    this.voiceProfiles = new Map();
    this.maxProfiles = 8;

    // ── Language settings ─────────────────────────────────────────────────
    this.defaultLanguage = 'sv';
    this.supportedLanguages = Object.keys(LANGUAGE_PACKS);
    this.autoDetectLanguage = true;
    this.userLanguagePreferences = new Map();

    // ── Noise suppression ─────────────────────────────────────────────────
    this.noiseSuppression = 'medium';
    this.adaptiveNoise = true;
    this.roomNoiseFloor = new Map();

    // ── Whisper mode ──────────────────────────────────────────────────────
    this.whisperMode = false;
    this.whisperSchedule = { start: 22, end: 7 };
    this.whisperVolume = 15;
    this.preferVisualFeedback = false;

    // ── Feedback customisation ────────────────────────────────────────────
    this.feedbackSettings = {
      verbosity: 'normal',            // brief | normal | verbose
      responseLanguage: 'sv',
      personality: 'friendly',        // professional | friendly | humorous
      confirmationBeeps: true
    };

    // ── Accessibility ─────────────────────────────────────────────────────
    this.accessibility = {
      slowSpeech: false,
      repeatCommands: false,
      largeTextFallback: false,
      simplifiedVocabulary: false,
      speechRate: 1.0
    };

    // ── Custom vocabulary ─────────────────────────────────────────────────
    this.customVocabulary = {
      deviceNicknames: new Map(),     // 'bedside lamp' → device_id_xyz
      roomAliases: new Map(),         // 'upstairs' → ['bedroom','bathroom']
      personNames: new Map()          // TTS pronunciation overrides
    };

    // ── Voice authentication ──────────────────────────────────────────────
    this.voiceAuth = {
      enabled: true,
      pinByVoice: true,
      enrolledPrints: new Map(),
      confidenceThreshold: 0.82,
      sensitiveCommands: ['arm_security', 'door_lock', 'guest_access']
    };

    // ── Automation macros ─────────────────────────────────────────────────
    this.macros = new Map(Object.entries(DEFAULT_MACROS));

    // ── Command history (last 500) ────────────────────────────────────────
    this.commandHistory = [];
    this.maxHistory = 500;

    // ── Proactive suggestions ─────────────────────────────────────────────
    this.proactiveSuggestions = {
      enabled: true,
      lastSuggestionTime: null,
      minIntervalMs: 30 * 60 * 1000,  // 30 minutes between suggestions
      patterns: new Map(),
      weatherTriggers: true,
      timeTriggers: true
    };

    // ── Conversation analytics ────────────────────────────────────────────
    this.analytics = {
      totalCommands: 0,
      successCount: 0,
      failCount: 0,
      intentCounts: {},
      misunderstandings: [],
      popularCommands: new Map(),
      usageByHour: new Array(24).fill(0),
      avgResponseTimeMs: 0,
      totalResponseTimeMs: 0,
      sessionCount: 0,
      lastReset: Date.now()
    };

    // ── Intents registry ──────────────────────────────────────────────────
    this.intents = new Map();

    // ── Routine shortcuts ─────────────────────────────────────────────────
    this.routineShortcuts = new Map([
      ['good morning', 'good_morning_routine'],
      ['god morgon', 'good_morning_routine'],
      ['good night', 'goodnight_routine'],
      ['god natt', 'goodnight_routine'],
      ['leaving home', 'leaving_home'],
      ['jag går', 'leaving_home'],
      ['movie time', 'movie_time'],
      ['filmkväll', 'movie_time'],
      ['bedtime', 'bedtime'],
      ['läggdags', 'bedtime']
    ]);

    // ── Internal flags ────────────────────────────────────────────────────
    this._initialized = false;
    this._destroyed = false;
    this._listeners = [];
    this._tickInterval = null;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Lifecycle
  // ═══════════════════════════════════════════════════════════════════════

  async initialize() {
    try {
      if (this._initialized) return;
      this.log('Initializing AI Voice Assistant Integration…');

      try {
        this._registerAllIntents();
        this._loadDefaultProfiles();
        this._startWhisperModeScheduler();
        this._startProactiveSuggestionEngine();
        this._bindHomeyEvents();
        this._startListening();
        this._tickInterval = setInterval(() => this._tick(), 60000);

        this._initialized = true;
        this.log(`Initialized — ${this.intents.size} intents, ${this.voiceProfiles.size} profiles, lang=${this.defaultLanguage}`);
      } catch (err) {
        this.error(`Initialization failed: ${err.message}`);
        throw err;
      }
    } catch (error) {
      this.homey.error(`[AIVoiceAssistantIntegration] Failed to initialize:`, error.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Intent Registration
  // ═══════════════════════════════════════════════════════════════════════

  _registerAllIntents() {
    for (const [name, def] of Object.entries(INTENT_DEFINITIONS)) {
      this.intents.set(name, {
        ...def,
        name,
        handler: this._createIntentHandler(name)
      });
    }
    this.log(`Registered ${this.intents.size} intents`);
  }

  _createIntentHandler(intentName) {
    const handlers = {
      control_device: (params, profile) => this._handleControlDevice(params, profile),
      query_status: (params, profile) => this._handleQueryStatus(params, profile),
      set_temperature: (params, profile) => this._handleSetTemperature(params, profile),
      activate_scene: (params, profile) => this._handleActivateScene(params, profile),
      arm_security: (params, profile) => this._handleArmSecurity(params, profile),
      create_automation: (params, profile) => this._handleCreateAutomation(params, profile),
      weather_query: (params, profile) => this._handleWeatherQuery(params, profile),
      energy_report: (params, profile) => this._handleEnergyReport(params, profile),
      calendar_query: (params, profile) => this._handleCalendarQuery(params, profile),
      timer_set: (params, profile) => this._handleTimerSet(params, profile),
      reminder_create: (params, profile) => this._handleReminderCreate(params, profile),
      music_play: (params, profile) => this._handleMusicPlay(params, profile),
      door_lock: (params, profile) => this._handleDoorLock(params, profile),
      camera_check: (params, profile) => this._handleCameraCheck(params, profile),
      guest_access: (params, profile) => this._handleGuestAccess(params, profile),
      cooking_help: (params, profile) => this._handleCookingHelp(params, profile),
      shopping_list: (params, profile) => this._handleShoppingList(params, profile),
      goodnight_routine: (params, profile) => this._handleGoodnightRoutine(params, profile),
      good_morning_routine: (params, profile) => this._handleGoodMorningRoutine(params, profile),
      emergency_alert: (params, profile) => this._handleEmergencyAlert(params, profile)
    };
    return handlers[intentName] || ((_params) => ({ success: false, message: `No handler for intent ${intentName}` }));
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Voice Profiles
  // ═══════════════════════════════════════════════════════════════════════

  _loadDefaultProfiles() {
    // Create a default admin profile
    this.addVoiceProfile({
      id: 'default_admin',
      name: 'Admin',
      language: this.defaultLanguage,
      permission: 'admin',
      speakerConfidence: 0.0,
      preferences: { verbosity: 'normal', personality: 'friendly' },
      voicePrint: null
    });
  }

  addVoiceProfile(profile) {
    if (this.voiceProfiles.size >= this.maxProfiles) {
      this.error(`Max voice profiles (${this.maxProfiles}) reached`);
      return false;
    }
    const fullProfile = {
      id: profile.id || `profile_${Date.now()}`,
      name: profile.name || 'Unknown',
      language: profile.language || this.defaultLanguage,
      permission: profile.permission || 'guest',
      speakerConfidence: profile.speakerConfidence || 0.0,
      preferences: {
        verbosity: 'normal',
        personality: 'friendly',
        ...profile.preferences
      },
      voicePrint: profile.voicePrint || null,
      createdAt: Date.now(),
      lastActive: Date.now(),
      commandCount: 0
    };
    this.voiceProfiles.set(fullProfile.id, fullProfile);
    this.log(`Voice profile added: ${fullProfile.name} (${fullProfile.permission})`);
    return true;
  }

  removeVoiceProfile(profileId) {
    if (this.voiceProfiles.has(profileId)) {
      const profile = this.voiceProfiles.get(profileId);
      this.voiceProfiles.delete(profileId);
      this.log(`Voice profile removed: ${profile.name}`);
      return true;
    }
    return false;
  }

  identifySpeaker(audioFeatures) {
    let bestMatch = null;
    let bestConfidence = 0;
    for (const [id, profile] of this.voiceProfiles) {
      if (!profile.voicePrint) continue;
      const confidence = this._comparePrints(profile.voicePrint, audioFeatures);
      if (confidence > bestConfidence) {
        bestConfidence = confidence;
        bestMatch = id;
      }
    }
    if (bestConfidence >= this.voiceAuth.confidenceThreshold) {
      const profile = this.voiceProfiles.get(bestMatch);
      profile.lastActive = Date.now();
      return { profileId: bestMatch, confidence: bestConfidence, profile };
    }
    // Fall back to default admin
    return { profileId: 'default_admin', confidence: 0, profile: this.voiceProfiles.get('default_admin') };
  }

  _comparePrints(enrolled, candidate) {
    // Simplified voice-print similarity (placeholder for real biometric comparison)
    if (!enrolled || !candidate) return 0;
    if (enrolled === candidate) return 1.0;
    return Math.random() * 0.3 + 0.5; // Simulated 0.5–0.8
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Language Detection
  // ═══════════════════════════════════════════════════════════════════════

  detectLanguage(text) {
    if (!this.autoDetectLanguage) return this.defaultLanguage;
    const markers = {
      sv: /\b(och|jag|det|är|att|en|som|för|med|har|inte|på|den|av|till|var)\b/gi,
      en: /\b(the|is|and|to|of|in|that|it|was|for|on|with|are|this|but|not)\b/gi,
      no: /\b(og|jeg|det|er|at|en|som|for|med|har|ikke|på|den|av|til|var)\b/gi,
      da: /\b(og|jeg|det|er|at|en|som|for|med|har|ikke|på|den|af|til|var)\b/gi,
      fi: /\b(ja|on|ei|se|kun|niin|oli|mutta|tai|hän|minä|sinä|tämä|mikä)\b/gi,
      de: /\b(und|der|die|das|ist|ich|nicht|ein|es|mit|auf|für|den|sie|dem)\b/gi
    };
    let bestLang = this.defaultLanguage;
    let bestCount = 0;
    for (const [lang, pattern] of Object.entries(markers)) {
      const matches = text.match(pattern);
      const count = matches ? matches.length : 0;
      if (count > bestCount) {
        bestCount = count;
        bestLang = lang;
      }
    }
    return bestLang;
  }

  getLanguagePack(langCode) {
    return LANGUAGE_PACKS[langCode] || LANGUAGE_PACKS[this.defaultLanguage];
  }

  setUserLanguage(profileId, langCode) {
    if (!this.supportedLanguages.includes(langCode)) {
      this.error(`Unsupported language: ${langCode}`);
      return false;
    }
    this.userLanguagePreferences.set(profileId, langCode);
    const profile = this.voiceProfiles.get(profileId);
    if (profile) profile.language = langCode;
    this.log(`Language set to ${langCode} for profile ${profileId}`);
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Wake Word Processing
  // ═══════════════════════════════════════════════════════════════════════

  _startListening() {
    this.wakeWordActive = true;
    this.dialogState = DIALOG_STATES.LISTENING;
    this.log(`Listening for wake word "${this.wakeWord}" (sensitivity: ${this.wakeWordSensitivity})`);
  }

  processWakeWord(audioBuffer) {
    if (!this.wakeWordActive) return false;
    const threshold = this.wakeWordSensitivities[this.wakeWordSensitivity] || 0.6;
    const confidence = this._analyzeWakeWord(audioBuffer);
    if (confidence >= threshold) {
      if (this.falsePositiveRejection && confidence < threshold + 0.1) {
        this.log('Wake word detected but rejected as possible false positive');
        return false;
      }
      this.log(`Wake word detected (confidence: ${confidence.toFixed(2)})`);
      this.dialogState = DIALOG_STATES.PROCESSING;
      this._emitEvent('wakeword_detected', { confidence });
      return true;
    }
    return false;
  }

  _analyzeWakeWord(audioBuffer) {
    // Placeholder for real wake-word detection model
    return audioBuffer ? 0.85 : 0.0;
  }

  setWakeWord(word) {
    this.wakeWord = word;
    this.log(`Wake word changed to "${word}"`);
  }

  setWakeWordSensitivity(level) {
    if (['low', 'medium', 'high'].includes(level)) {
      this.wakeWordSensitivity = level;
      this.log(`Wake word sensitivity set to ${level}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Noise Suppression
  // ═══════════════════════════════════════════════════════════════════════

  setNoiseSuppression(level) {
    if (NOISE_SUPPRESSION[level]) {
      this.noiseSuppression = level;
      this.log(`Noise suppression set to ${level}`);
    }
  }

  processAudioWithNoiseSuppression(audioBuffer, room) {
    const config = NOISE_SUPPRESSION[this.noiseSuppression] || NOISE_SUPPRESSION.medium;
    if (this.adaptiveNoise && room) {
      const noiseFloor = this.roomNoiseFloor.get(room) || 0;
      const adaptiveGain = config.gain - (noiseFloor * 0.5);
      return { processedBuffer: audioBuffer, gain: adaptiveGain, filter: config.filterFreq };
    }
    return { processedBuffer: audioBuffer, gain: config.gain, filter: config.filterFreq };
  }

  updateRoomNoiseFloor(room, level) {
    this.roomNoiseFloor.set(room, level);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Whisper Mode
  // ═══════════════════════════════════════════════════════════════════════

  _startWhisperModeScheduler() {
    this._checkWhisperMode();
  }

  _checkWhisperMode() {
    const hour = new Date().getHours();
    const { start, end } = this.whisperSchedule;
    const shouldWhisper = (start > end)
      ? (hour >= start || hour < end)
      : (hour >= start && hour < end);
    if (shouldWhisper !== this.whisperMode) {
      this.whisperMode = shouldWhisper;
      this.log(`Whisper mode ${this.whisperMode ? 'activated' : 'deactivated'} (${hour}:00)`);
    }
  }

  getResponseVolume() {
    return this.whisperMode ? this.whisperVolume : 70;
  }

  setWhisperSchedule(startHour, endHour) {
    this.whisperSchedule = { start: startHour, end: endHour };
    this.log(`Whisper schedule: ${startHour}:00–${endHour}:00`);
    this._checkWhisperMode();
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Command Processing Pipeline
  // ═══════════════════════════════════════════════════════════════════════

  async processCommand(text, audioFeatures) {
    const startTime = Date.now();
    this.dialogState = DIALOG_STATES.PROCESSING;

    try {
      // 1. Identify speaker
      const speaker = this.identifySpeaker(audioFeatures);
      const profile = speaker.profile || this.voiceProfiles.get('default_admin');
      const lang = this.userLanguagePreferences.get(speaker.profileId) || this.detectLanguage(text);
      const langPack = this.getLanguagePack(lang);

      // 2. Check for routine shortcuts
      const lowerText = text.toLowerCase().trim();
      const routineKey = this.routineShortcuts.get(lowerText);
      if (routineKey && this.macros.has(routineKey)) {
        return await this._executeMacro(routineKey, profile, langPack, startTime);
      }
      // Also check macro keys directly
      if (this.macros.has(lowerText)) {
        return await this._executeMacro(lowerText, profile, langPack, startTime);
      }

      // 3. Check for natural-language scene
      const sceneResult = this._matchNaturalScene(lowerText);
      if (sceneResult) {
        return this._buildResponse(true, `Scene "${sceneResult.key}" activated`, sceneResult.config, langPack, profile, 'activate_scene', startTime);
      }

      // 4. Classify intent
      const classification = this._classifyIntent(text, lang);
      if (!classification) {
        this.dialogState = DIALOG_STATES.CLARIFYING;
        this._recordMisunderstanding(text, lang);
        return this._buildResponse(false, langPack.misunderstand, null, langPack, profile, 'unknown', startTime);
      }

      // 5. Check permissions
      const intentDef = this.intents.get(classification.intent);
      if (intentDef && intentDef.requires_auth) {
        const permLevel = PERMISSION_LEVELS[profile.permission];
        const action = classification.intent;
        if (action === 'arm_security' && !permLevel.canArm) {
          return this._buildResponse(false, 'Permission denied: insufficient access level', null, langPack, profile, action, startTime);
        }
        if (action === 'door_lock' && !permLevel.canLock) {
          return this._buildResponse(false, 'Permission denied: insufficient access level', null, langPack, profile, action, startTime);
        }
        if (action === 'guest_access' && !permLevel.canGrantAccess) {
          return this._buildResponse(false, 'Permission denied: insufficient access level', null, langPack, profile, action, startTime);
        }

        // Voice PIN authentication for sensitive commands
        if (this.voiceAuth.pinByVoice && this.voiceAuth.sensitiveCommands.includes(action)) {
          const authed = await this._voicePinAuth(speaker.profileId, audioFeatures);
          if (!authed) {
            return this._buildResponse(false, 'Voice authentication failed', null, langPack, profile, action, startTime);
          }
        }
      }

      // 6. Extract parameters & merge context carry-over
      const params = this._extractParameters(text, classification, lang);
      const mergedParams = { ...this.currentContext, ...params };

      // 7. Execute intent handler
      const handler = intentDef.handler;
      const result = await handler(mergedParams, profile);

      // 8. Update context for multi-turn carry-over
      this._updateConversationContext(classification.intent, mergedParams, result);

      // 9. Build response
      const response = this._buildResponse(
        result.success,
        result.message,
        result.data,
        langPack,
        profile,
        classification.intent,
        startTime
      );

      this.dialogState = DIALOG_STATES.IDLE;
      return response;

    } catch (err) {
      this.error(`Command processing error: ${err.message}`);
      this.dialogState = DIALOG_STATES.IDLE;
      const elapsed = Date.now() - startTime;
      this._recordCommand('error', 0, false, elapsed, text);
      return { success: false, error: err.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Intent Classification
  // ═══════════════════════════════════════════════════════════════════════

  _classifyIntent(text, _lang) {
    let bestIntent = null;
    let bestConfidence = 0;
    let bestMatch = null;

    for (const [name, def] of this.intents) {
      for (const pattern of def.patterns) {
        const match = text.match(pattern);
        if (match) {
          const baseConf = def.confidence_threshold + 0.1;
          const wordOverlap = this._calculateWordOverlap(text, pattern);
          const confidence = Math.min(baseConf + wordOverlap * 0.1, 1.0);
          if (confidence > bestConfidence && confidence >= def.confidence_threshold) {
            bestConfidence = confidence;
            bestIntent = name;
            bestMatch = match;
          }
        }
      }
    }

    if (bestIntent) {
      return { intent: bestIntent, confidence: bestConfidence, match: bestMatch };
    }
    return null;
  }

  _calculateWordOverlap(text, _pattern) {
    const words = text.toLowerCase().split(/\s+/).length;
    return Math.min(words / 5, 1.0);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Parameter Extraction
  // ═══════════════════════════════════════════════════════════════════════

  _extractParameters(text, classification, _lang) {
    const params = {};
    const match = classification.match;

    // Resolve custom vocabulary
    const resolvedText = this._resolveCustomVocabulary(text);

    // Extract numbers (temperatures, durations, etc.)
    const numbers = resolvedText.match(/\d+/g);
    if (numbers) params._numbers = numbers.map(Number);

    // Extract room references
    const rooms = resolvedText.match(/\b(?:bedroom|living\s*room|kitchen|bathroom|hallway|garage|garden|office|sovrum|vardagsrum|kök|badrum|hall|garage|trädgård|kontor)\b/gi);
    if (rooms && rooms.length > 0) params.room = rooms[0].toLowerCase();

    // Extract device references
    const devices = resolvedText.match(/\b(?:light|lamp|fan|heater|AC|TV|speaker|thermostat|lock|camera|sensor|lampa|fläkt|element|högtalare|termostat|lås|kamera)\b/gi);
    if (devices && devices.length > 0) params.device = devices[0].toLowerCase();

    // Extract time references
    const timeMatch = resolvedText.match(/(?:at|kl|om)\s+(\d{1,2}[:.]\d{2}|\d{1,2})/i);
    if (timeMatch) params.time = timeMatch[1];

    // Extract duration
    const durationMatch = resolvedText.match(/(\d+)\s*(minutes?|seconds?|hours?|minuter?|sekunder?|timmar?)/i);
    if (durationMatch) {
      params.duration = parseInt(durationMatch[1], 10);
      params.unit = durationMatch[2].toLowerCase();
    }

    // Capture groups from intent pattern match
    if (match) {
      for (let i = 1; i < match.length; i++) {
        if (match[i]) params[`capture_${i}`] = match[i].trim();
      }
    }

    return params;
  }

  _resolveCustomVocabulary(text) {
    let resolved = text;
    for (const [nickname, deviceId] of this.customVocabulary.deviceNicknames) {
      const regex = new RegExp(`\\b${this._escapeRegex(nickname)}\\b`, 'gi');
      resolved = resolved.replace(regex, deviceId);
    }
    for (const [alias, rooms] of this.customVocabulary.roomAliases) {
      const regex = new RegExp(`\\b${this._escapeRegex(alias)}\\b`, 'gi');
      resolved = resolved.replace(regex, Array.isArray(rooms) ? rooms[0] : rooms);
    }
    return resolved;
  }

  _escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Natural Language Scene Matching
  // ═══════════════════════════════════════════════════════════════════════

  _matchNaturalScene(text) {
    const patterns = [
      /(?:make it|set it to|gör det)\s+(.+)/i,
      /^(.+?)\s+mode$/i,
      /^(.+?)\s*läge$/i
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m) {
        const key = m[1].toLowerCase().trim();
        if (NL_SCENE_MAP[key]) return { key, config: NL_SCENE_MAP[key] };
      }
    }
    // Direct keyword match
    for (const [key, config] of Object.entries(NL_SCENE_MAP)) {
      if (text.includes(key)) return { key, config };
    }
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Intent Handlers
  // ═══════════════════════════════════════════════════════════════════════

  async _handleControlDevice(params, profile) {
    const action = params.capture_1 || params.action || 'toggle';
    const device = params.capture_2 || params.device || 'unknown';
    this.log(`Control device: ${action} ${device}`);
    this._emitEvent('device_control', { action, device, room: params.room, profile: profile.name });
    return { success: true, message: `${device} turned ${action}`, data: { action, device } };
  }

  async _handleQueryStatus(params, profile) {
    const device = params.capture_1 || params.device || 'unknown';
    this.log(`Query status: ${device}`);
    this._emitEvent('status_query', { device, profile: profile.name });
    return { success: true, message: `${device} status retrieved`, data: { device, status: 'on' } };
  }

  async _handleSetTemperature(params, profile) {
    const temp = (params._numbers && params._numbers[0]) || params.temperature || 21;
    const room = params.room || 'all';
    this.log(`Set temperature: ${temp}°C in ${room}`);
    this._emitEvent('temperature_set', { temperature: temp, room, profile: profile.name });
    return { success: true, message: `Temperature set to ${temp}°C in ${room}`, data: { temperature: temp, room } };
  }

  async _handleActivateScene(params, profile) {
    const scene = params.capture_1 || params.scene_name || 'default';
    this.log(`Activate scene: ${scene}`);
    this._emitEvent('scene_activate', { scene, profile: profile.name });
    return { success: true, message: `Scene "${scene}" activated`, data: { scene } };
  }

  async _handleArmSecurity(params, profile) {
    const action = params.capture_1 || params.action || 'arm';
    const mode = params.mode || 'home';
    this.log(`Security: ${action} (${mode})`);
    this._emitEvent('security_action', { action, mode, profile: profile.name });
    return { success: true, message: `Security system ${action}ed in ${mode} mode`, data: { action, mode } };
  }

  async _handleCreateAutomation(params, profile) {
    const trigger = params.capture_1 || params.trigger || '';
    const action = params.capture_2 || params.action || '';
    this.log(`Create automation: when ${trigger} then ${action}`);
    this._emitEvent('automation_create', { trigger, action, profile: profile.name });
    return { success: true, message: `Automation created: when ${trigger} → ${action}`, data: { trigger, action } };
  }

  async _handleWeatherQuery(params, profile) {
    const timeframe = params.timeframe || 'today';
    this.log(`Weather query: ${timeframe}`);
    this._emitEvent('weather_query', { timeframe, profile: profile.name });
    return { success: true, message: `Weather forecast for ${timeframe}`, data: { timeframe, forecast: 'partly cloudy, 12°C' } };
  }

  async _handleEnergyReport(params, profile) {
    const timeframe = params.timeframe || 'today';
    this.log(`Energy report: ${timeframe}`);
    this._emitEvent('energy_report', { timeframe, profile: profile.name });
    return { success: true, message: `Energy usage report for ${timeframe}`, data: { timeframe, usage: '14.2 kWh' } };
  }

  async _handleCalendarQuery(params, profile) {
    const timeframe = params.timeframe || 'today';
    this.log(`Calendar query: ${timeframe}`);
    this._emitEvent('calendar_query', { timeframe, profile: profile.name });
    return { success: true, message: `Calendar for ${timeframe}`, data: { timeframe, events: [] } };
  }

  async _handleTimerSet(params, _profile) {
    const duration = params.duration || (params._numbers && params._numbers[0]) || 5;
    const unit = params.unit || 'minutes';
    const label = params.label || `Timer ${this.activeTimers.size + 1}`;
    const timerId = `timer_${Date.now()}`;
    const durationMs = this._toMilliseconds(duration, unit);

    this.activeTimers.set(timerId, {
      id: timerId,
      label,
      duration,
      unit,
      startedAt: Date.now(),
      endsAt: Date.now() + durationMs,
      timeout: setTimeout(() => {
        this._emitEvent('timer_complete', { timerId, label });
        this.activeTimers.delete(timerId);
        this.log(`Timer "${label}" completed`);
      }, durationMs)
    });

    this.log(`Timer set: ${duration} ${unit} (${label})`);
    return { success: true, message: `Timer set for ${duration} ${unit}`, data: { timerId, duration, unit, label } };
  }

  async _handleReminderCreate(params, profile) {
    const message = params.capture_1 || params.message || 'Reminder';
    const time = params.capture_2 || params.time || 'later';
    this.log(`Reminder: "${message}" at ${time}`);
    this._emitEvent('reminder_create', { message, time, profile: profile.name });
    return { success: true, message: `Reminder set: "${message}" at ${time}`, data: { message, time } };
  }

  async _handleMusicPlay(params, profile) {
    const query = params.capture_1 || params.query || 'ambient';
    const room = params.room || 'current';
    this.log(`Music play: ${query} in ${room}`);
    this._emitEvent('music_play', { query, room, profile: profile.name });
    return { success: true, message: `Playing ${query}`, data: { query, room } };
  }

  async _handleDoorLock(params, profile) {
    const action = params.capture_1 || params.action || 'lock';
    const target = params.capture_2 || params.target || 'front door';
    this.log(`Door lock: ${action} ${target}`);
    this._emitEvent('door_lock', { action, target, profile: profile.name });
    return { success: true, message: `${target} ${action}ed`, data: { action, target } };
  }

  async _handleCameraCheck(params, profile) {
    const camera = params.camera_name || params.capture_1 || 'front';
    this.log(`Camera check: ${camera}`);
    this._emitEvent('camera_check', { camera, profile: profile.name });
    return { success: true, message: `Showing ${camera} camera feed`, data: { camera } };
  }

  async _handleGuestAccess(params, profile) {
    const person = params.capture_1 || params.person || 'guest';
    const level = params.access_level || 'guest';
    const duration = params.duration || '24h';
    this.log(`Guest access: ${person} (${level}) for ${duration}`);
    this._emitEvent('guest_access', { person, level, duration, profile: profile.name });
    return { success: true, message: `Guest access granted to ${person} (${level}) for ${duration}`, data: { person, level, duration } };
  }

  async _handleCookingHelp(params, profile) {
    const dish = params.capture_1 || params.dish || '';
    const temp = params.capture_2 || params.temperature || null;
    this.log(`Cooking help: ${dish}`);
    this._emitEvent('cooking_help', { dish, temperature: temp, profile: profile.name });
    return { success: true, message: `Cooking help for ${dish}`, data: { dish, temperature: temp } };
  }

  async _handleShoppingList(params, profile) {
    const item = params.capture_1 || params.item || '';
    this.log(`Shopping list: add ${item}`);
    this._emitEvent('shopping_list', { item, profile: profile.name });
    return { success: true, message: `Added "${item}" to shopping list`, data: { item } };
  }

  async _handleGoodnightRoutine(params, profile) {
    this.log('Goodnight routine triggered');
    return await this._executeMacro('bedtime', profile, this.getLanguagePack(profile.language), Date.now());
  }

  async _handleGoodMorningRoutine(params, profile) {
    this.log('Good morning routine triggered');
    return await this._executeMacro('good morning', profile, this.getLanguagePack(profile.language), Date.now());
  }

  async _handleEmergencyAlert(params, profile) {
    const type = params.capture_1 || params.type || 'unknown';
    const location = params.location || 'unknown';
    this.log(`EMERGENCY ALERT: ${type} at ${location}`);
    this._emitEvent('emergency_alert', { type, location, profile: profile.name, priority: 'critical' });
    return { success: true, message: `Emergency alert: ${type}. Help is on the way.`, data: { type, location, priority: 'critical' } };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Macro Execution
  // ═══════════════════════════════════════════════════════════════════════

  async _executeMacro(macroKey, profile, langPack, startTime) {
    const macro = this.macros.get(macroKey);
    if (!macro) {
      return this._buildResponse(false, `Macro "${macroKey}" not found`, null, langPack, profile, 'macro', startTime);
    }
    this.log(`Executing macro: ${macro.label} (${macro.steps.length} steps)`);
    const results = [];
    for (const step of macro.steps) {
      this._emitEvent('macro_step', { macro: macroKey, action: step.action, params: step.params });
      results.push({ action: step.action, success: true });
    }
    return this._buildResponse(true, `${macro.label} executed (${macro.steps.length} steps)`, { steps: results }, langPack, profile, 'macro', startTime);
  }

  addMacro(key, label, steps) {
    this.macros.set(key, { label, steps });
    this.log(`Macro added: ${label} (${steps.length} steps)`);
  }

  removeMacro(key) {
    if (this.macros.has(key)) {
      this.macros.delete(key);
      this.log(`Macro removed: ${key}`);
      return true;
    }
    return false;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Conversation Context & Memory
  // ═══════════════════════════════════════════════════════════════════════

  _updateConversationContext(intent, params, result) {
    // Entity carry-over between turns
    if (params.device) this.currentContext.device = params.device;
    if (params.room) this.currentContext.room = params.room;
    if (params.temperature) this.currentContext.temperature = params.temperature;

    // Conversation memory (last N exchanges)
    this.conversationMemory.push({
      timestamp: Date.now(),
      intent,
      params: { ...params },
      success: result.success,
      message: result.message
    });
    while (this.conversationMemory.length > this.maxConversationMemory) {
      this.conversationMemory.shift();
    }
  }

  clearConversationContext() {
    this.currentContext = {};
    this.conversationMemory = [];
    this.dialogState = DIALOG_STATES.IDLE;
    this.log('Conversation context cleared');
  }

  getConversationHistory() {
    return [...this.conversationMemory];
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Voice Authentication
  // ═══════════════════════════════════════════════════════════════════════

  async _voicePinAuth(profileId, audioFeatures) {
    if (!this.voiceAuth.enabled) return true;
    const enrolled = this.voiceAuth.enrolledPrints.get(profileId);
    if (!enrolled) {
      // Not enrolled → allow (but log)
      this.log(`No voice print enrolled for ${profileId}, allowing by default`);
      return true;
    }
    const confidence = this._comparePrints(enrolled, audioFeatures);
    const passed = confidence >= this.voiceAuth.confidenceThreshold;
    this.log(`Voice auth for ${profileId}: confidence=${confidence.toFixed(2)}, passed=${passed}`);
    return passed;
  }

  enrollVoicePrint(profileId, audioSamples) {
    if (!Array.isArray(audioSamples) || audioSamples.length < 3) {
      this.error('At least 3 audio samples required for voice print enrollment');
      return false;
    }
    const print = { samples: audioSamples.length, enrolledAt: Date.now(), profileId };
    this.voiceAuth.enrolledPrints.set(profileId, print);
    this.log(`Voice print enrolled for ${profileId} (${audioSamples.length} samples)`);
    return true;
  }

  revokeVoicePrint(profileId) {
    this.voiceAuth.enrolledPrints.delete(profileId);
    this.log(`Voice print revoked for ${profileId}`);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Custom Vocabulary
  // ═══════════════════════════════════════════════════════════════════════

  addDeviceNickname(nickname, deviceId) {
    this.customVocabulary.deviceNicknames.set(nickname.toLowerCase(), deviceId);
    this.log(`Device nickname: "${nickname}" → ${deviceId}`);
  }

  removeDeviceNickname(nickname) {
    this.customVocabulary.deviceNicknames.delete(nickname.toLowerCase());
  }

  addRoomAlias(alias, roomIds) {
    this.customVocabulary.roomAliases.set(alias.toLowerCase(), roomIds);
    this.log(`Room alias: "${alias}" → [${roomIds}]`);
  }

  removeRoomAlias(alias) {
    this.customVocabulary.roomAliases.delete(alias.toLowerCase());
  }

  addPersonName(name, pronunciation) {
    this.customVocabulary.personNames.set(name, pronunciation);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Feedback Customisation
  // ═══════════════════════════════════════════════════════════════════════

  setFeedbackVerbosity(level) {
    if (['brief', 'normal', 'verbose'].includes(level)) {
      this.feedbackSettings.verbosity = level;
      this.log(`Feedback verbosity: ${level}`);
    }
  }

  setFeedbackPersonality(personality) {
    if (['professional', 'friendly', 'humorous'].includes(personality)) {
      this.feedbackSettings.personality = personality;
      this.log(`Feedback personality: ${personality}`);
    }
  }

  setConfirmationBeeps(enabled) {
    this.feedbackSettings.confirmationBeeps = !!enabled;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Accessibility
  // ═══════════════════════════════════════════════════════════════════════

  setSlowSpeech(enabled) {
    this.accessibility.slowSpeech = !!enabled;
    this.accessibility.speechRate = enabled ? 0.7 : 1.0;
    this.log(`Slow speech: ${enabled}`);
  }

  setRepeatCommands(enabled) {
    this.accessibility.repeatCommands = !!enabled;
  }

  setLargeTextFallback(enabled) {
    this.accessibility.largeTextFallback = !!enabled;
  }

  setSimplifiedVocabulary(enabled) {
    this.accessibility.simplifiedVocabulary = !!enabled;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Response Builder
  // ═══════════════════════════════════════════════════════════════════════

  _buildResponse(success, message, data, langPack, profile, intent, startTime) {
    const elapsed = Date.now() - startTime;
    const confidence = success ? 0.9 : 0.3;

    // Record in history & analytics
    this._recordCommand(intent, confidence, success, elapsed, message);

    // Update profile command count
    if (profile) profile.commandCount = (profile.commandCount || 0) + 1;

    // Apply personality / verbosity
    let responseText = message;
    if (success && langPack) {
      const confirmPrefix = langPack.confirmations[Math.floor(Math.random() * langPack.confirmations.length)];
      if (this.feedbackSettings.verbosity === 'brief') {
        responseText = confirmPrefix;
      } else if (this.feedbackSettings.verbosity === 'verbose') {
        responseText = `${confirmPrefix}. ${message}. Is there anything else?`;
      } else {
        responseText = `${confirmPrefix}. ${message}`;
      }
      if (this.feedbackSettings.personality === 'humorous' && success) {
        responseText += ' 🎉';
      }
    } else if (!success && langPack) {
      responseText = langPack.errors[Math.floor(Math.random() * langPack.errors.length)] + '. ' + message;
    }

    return {
      success,
      intent,
      message: responseText,
      data: data || {},
      confidence,
      responseTimeMs: elapsed,
      whisperMode: this.whisperMode,
      volume: this.getResponseVolume(),
      speechRate: this.accessibility.speechRate,
      beep: this.feedbackSettings.confirmationBeeps && success,
      visualFallback: this.accessibility.largeTextFallback || (this.whisperMode && this.preferVisualFeedback)
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Command History & Analytics
  // ═══════════════════════════════════════════════════════════════════════

  _recordCommand(intent, confidence, success, responseTimeMs, rawText) {
    const entry = {
      timestamp: Date.now(),
      intent,
      confidence,
      success,
      responseTimeMs,
      rawText: (rawText || '').substring(0, 200)
    };

    this.commandHistory.push(entry);
    while (this.commandHistory.length > this.maxHistory) {
      this.commandHistory.shift();
    }

    // Analytics
    this.analytics.totalCommands++;
    if (success) this.analytics.successCount++;
    else this.analytics.failCount++;

    this.analytics.intentCounts[intent] = (this.analytics.intentCounts[intent] || 0) + 1;

    const hour = new Date().getHours();
    this.analytics.usageByHour[hour]++;

    this.analytics.totalResponseTimeMs += responseTimeMs;
    this.analytics.avgResponseTimeMs = Math.round(this.analytics.totalResponseTimeMs / this.analytics.totalCommands);

    // Popular commands
    const cmdKey = intent + ':' + (rawText || '').substring(0, 50).toLowerCase();
    this.analytics.popularCommands.set(cmdKey, (this.analytics.popularCommands.get(cmdKey) || 0) + 1);
  }

  _recordMisunderstanding(text, lang) {
    this.analytics.misunderstandings.push({
      timestamp: Date.now(),
      text: text.substring(0, 200),
      language: lang
    });
    // Keep only last 100 misunderstandings
    while (this.analytics.misunderstandings.length > 100) {
      this.analytics.misunderstandings.shift();
    }
  }

  getCommandHistory(limit) {
    const n = limit || 50;
    return this.commandHistory.slice(-n);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Proactive Suggestions
  // ═══════════════════════════════════════════════════════════════════════

  _startProactiveSuggestionEngine() {
    this.log('Proactive suggestion engine started');
  }

  async generateProactiveSuggestion(context) {
    if (!this.proactiveSuggestions.enabled) return null;

    const now = Date.now();
    if (this.proactiveSuggestions.lastSuggestionTime &&
        (now - this.proactiveSuggestions.lastSuggestionTime) < this.proactiveSuggestions.minIntervalMs) {
      return null;
    }

    const hour = new Date().getHours();
    const lang = this.defaultLanguage;
    const langPack = this.getLanguagePack(lang);
    let suggestion = null;

    // Time-based suggestions
    if (this.proactiveSuggestions.timeTriggers) {
      if (hour >= 6 && hour <= 8) {
        suggestion = { type: 'morning', message: langPack.greeting, action: 'good_morning_routine' };
      } else if (hour >= 22 || hour <= 5) {
        suggestion = { type: 'night', message: langPack.goodbye, action: 'goodnight_routine' };
      }
    }

    // Weather-based suggestions
    if (!suggestion && this.proactiveSuggestions.weatherTriggers && context) {
      if (context.temperature !== undefined && context.temperature < 15) {
        suggestion = { type: 'weather_cold', message: langPack.proactive.cold, action: 'set_temperature' };
      }
      if (context.rain) {
        suggestion = { type: 'weather_rain', message: langPack.proactive.rain, action: 'close_windows' };
      }
    }

    // Pattern-based suggestions (from history)
    if (!suggestion && this.commandHistory.length > 10) {
      const recentIntents = this.commandHistory.slice(-5).map(c => c.intent);
      const hourlyCommands = this.commandHistory.filter(c => {
        const cmdHour = new Date(c.timestamp).getHours();
        return cmdHour === hour && c.success;
      });
      if (hourlyCommands.length > 3) {
        const mostCommon = this._getMostCommonIntent(hourlyCommands);
        if (mostCommon && !recentIntents.includes(mostCommon)) {
          suggestion = { type: 'pattern', message: `You usually run "${mostCommon}" around this time`, action: mostCommon };
        }
      }
    }

    if (suggestion) {
      this.proactiveSuggestions.lastSuggestionTime = now;
      this._emitEvent('proactive_suggestion', suggestion);
    }

    return suggestion;
  }

  _getMostCommonIntent(commands) {
    const counts = {};
    for (const cmd of commands) {
      counts[cmd.intent] = (counts[cmd.intent] || 0) + 1;
    }
    let best = null;
    let bestCount = 0;
    for (const [intent, count] of Object.entries(counts)) {
      if (count > bestCount) {
        bestCount = count;
        best = intent;
      }
    }
    return best;
  }

  setProactiveSuggestions(enabled) {
    this.proactiveSuggestions.enabled = !!enabled;
    this.log(`Proactive suggestions: ${enabled}`);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Conversation Analytics (public)
  // ═══════════════════════════════════════════════════════════════════════

  getConversationAnalytics() {
    const successRate = this.analytics.totalCommands > 0
      ? ((this.analytics.successCount / this.analytics.totalCommands) * 100).toFixed(1)
      : 0;

    // Top 10 popular commands
    const popular = [...this.analytics.popularCommands.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([cmd, count]) => ({ command: cmd, count }));

    // Peak usage hours
    const peakHour = this.analytics.usageByHour.indexOf(Math.max(...this.analytics.usageByHour));

    return {
      totalCommands: this.analytics.totalCommands,
      successRate: `${successRate}%`,
      failCount: this.analytics.failCount,
      avgResponseTimeMs: this.analytics.avgResponseTimeMs,
      intentBreakdown: { ...this.analytics.intentCounts },
      misunderstandingCount: this.analytics.misunderstandings.length,
      recentMisunderstandings: this.analytics.misunderstandings.slice(-5),
      popularCommands: popular,
      peakUsageHour: peakHour,
      usageByHour: [...this.analytics.usageByHour],
      sessionCount: this.analytics.sessionCount,
      lastReset: this.analytics.lastReset
    };
  }

  resetAnalytics() {
    this.analytics = {
      totalCommands: 0,
      successCount: 0,
      failCount: 0,
      intentCounts: {},
      misunderstandings: [],
      popularCommands: new Map(),
      usageByHour: new Array(24).fill(0),
      avgResponseTimeMs: 0,
      totalResponseTimeMs: 0,
      sessionCount: 0,
      lastReset: Date.now()
    };
    this.commandHistory = [];
    this.log('Analytics reset');
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Event & Homey Integration
  // ═══════════════════════════════════════════════════════════════════════

  _bindHomeyEvents() {
    const events = [
      { event: 'voice:command', handler: (data) => this.processCommand(data.text, data.audioFeatures) },
      { event: 'voice:wakeword', handler: (data) => this.processWakeWord(data.buffer) },
      { event: 'system:profile_update', handler: (data) => this._onProfileUpdate(data) },
      { event: 'system:language_change', handler: (data) => this._onLanguageChange(data) }
    ];
    for (const { event, handler } of events) {
      try {
        this.homey.on(event, handler);
        this._listeners.push({ event, handler });
      } catch (_e) {
        // Event binding may not be available in all environments
      }
    }
  }

  _onProfileUpdate(data) {
    if (data && data.profileId) {
      const profile = this.voiceProfiles.get(data.profileId);
      if (profile) {
        Object.assign(profile, data.updates || {});
        this.log(`Profile updated: ${profile.name}`);
      }
    }
  }

  _onLanguageChange(data) {
    if (data && data.language && this.supportedLanguages.includes(data.language)) {
      this.defaultLanguage = data.language;
      this.feedbackSettings.responseLanguage = data.language;
      this.log(`Default language changed to ${data.language}`);
    }
  }

  _emitEvent(eventName, data) {
    try {
      this.homey.emit(`voice:${eventName}`, { ...data, timestamp: Date.now() });
    } catch (_e) {
      // Silently ignore emit errors in non-Homey environments
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Utilities
  // ═══════════════════════════════════════════════════════════════════════

  _toMilliseconds(value, unit) {
    const u = (unit || '').toLowerCase().replace(/s$/, '');
    switch (u) {
      case 'second': case 'sekund': return value * 1000;
      case 'minute': case 'minut': return value * 60 * 1000;
      case 'hour': case 'timm': case 'timma': return value * 3600 * 1000;
      default: return value * 60 * 1000;
    }
  }

  _tick() {
    if (this._destroyed) return;
    this._checkWhisperMode();
    this.generateProactiveSuggestion({});
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Statistics
  // ═══════════════════════════════════════════════════════════════════════

  getStatistics() {
    return {
      initialized: this._initialized,
      dialogState: this.dialogState,
      registeredIntents: this.intents.size,
      voiceProfiles: this.voiceProfiles.size,
      maxProfiles: this.maxProfiles,
      defaultLanguage: this.defaultLanguage,
      supportedLanguages: [...this.supportedLanguages],
      wakeWord: this.wakeWord,
      wakeWordSensitivity: this.wakeWordSensitivity,
      wakeWordActive: this.wakeWordActive,
      noiseSuppression: this.noiseSuppression,
      whisperMode: this.whisperMode,
      whisperSchedule: { ...this.whisperSchedule },
      feedbackSettings: { ...this.feedbackSettings },
      accessibility: { ...this.accessibility },
      customDeviceNicknames: this.customVocabulary.deviceNicknames.size,
      customRoomAliases: this.customVocabulary.roomAliases.size,
      customPersonNames: this.customVocabulary.personNames.size,
      voiceAuthEnabled: this.voiceAuth.enabled,
      enrolledVoicePrints: this.voiceAuth.enrolledPrints.size,
      macros: this.macros.size,
      activeTimers: this.activeTimers.size,
      commandHistorySize: this.commandHistory.length,
      maxHistory: this.maxHistory,
      conversationMemorySize: this.conversationMemory.length,
      proactiveSuggestionsEnabled: this.proactiveSuggestions.enabled,
      analytics: this.getConversationAnalytics()
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Logging
  // ═══════════════════════════════════════════════════════════════════════

  log(msg) {
    try {
      if (this.homey && typeof this.homey.log === 'function') {
        this.homey.log(`[VoiceAI] ${msg}`);
      } else {
        console.log(`[VoiceAI] ${msg}`);
      }
    } catch (_) {
      console.log(`[VoiceAI] ${msg}`);
    }
  }

  error(msg) {
    try {
      if (this.homey && typeof this.homey.error === 'function') {
        this.homey.error(`[VoiceAI] ${msg}`);
      } else {
        console.error(`[VoiceAI] ${msg}`);
      }
    } catch (_) {
      console.error(`[VoiceAI] ${msg}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Destroy
  // ═══════════════════════════════════════════════════════════════════════

  destroy() {
    this._destroyed = true;
    this.wakeWordActive = false;
    this.dialogState = DIALOG_STATES.IDLE;

    // Clear tick interval
    if (this._tickInterval) {
      clearInterval(this._tickInterval);
      this._tickInterval = null;
    }

    // Clear active timers
    for (const [_id, timer] of this.activeTimers) {
      if (timer.timeout) clearTimeout(timer.timeout);
    }
    this.activeTimers.clear();

    // Unbind Homey events
    for (const { event, handler } of this._listeners) {
      try {
        this.homey.removeListener(event, handler);
      } catch (_) { /* ignore */ }
    }
    this._listeners = [];

    this.log('AI Voice Assistant destroyed');
    this._initialized = false;
  }
}

module.exports = AIVoiceAssistantIntegration;
