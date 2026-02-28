'use strict';

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertType, assertInstanceOf } = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');

/* ── timer-leak prevention ─────────────────────────────────── */
const _origSetTimeout = global.setTimeout;
const _origSetInterval = global.setInterval;
const activeHandles = [];
global.setTimeout = (...a) => { const id = _origSetTimeout(...a); activeHandles.push({ type: 'timeout', id }); return id; };
global.setInterval = (...a) => { const id = _origSetInterval(...a); activeHandles.push({ type: 'interval', id }); return id; };
function cleanup(sys) {
  try { sys.destroy(); } catch (_) { /* ignore */ }
  while (activeHandles.length > 0) {
    const h = activeHandles.pop();
    if (h.type === 'timeout') clearTimeout(h.id);
    else clearInterval(h.id);
  }
}

const SmartBlindsShutterControlSystem = require('../lib/SmartBlindsShutterControlSystem');

/* ═══════════════════════════════════════════════════════════════
   CONSTRUCTOR
   ═══════════════════════════════════════════════════════════════ */
describe('SmartBlindsShutterControlSystem – constructor', () => {
  it('sets initialized to false', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      assertEqual(sys.initialized, false);
    } finally { cleanup(sys); }
  });

  it('creates intervals as empty array', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      assertInstanceOf(sys.intervals, Array);
      assertEqual(sys.intervals.length, 0);
    } finally { cleanup(sys); }
  });

  it('sets default Stockholm location', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      assertEqual(sys.location.latitude, 59.33);
      assertEqual(sys.location.longitude, 18.07);
      assertEqual(sys.location.timezone, 'Europe/Stockholm');
    } finally { cleanup(sys); }
  });

  it('populates 7 device types', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      assertEqual(sys.deviceTypes.length, 7);
      assert(sys.deviceTypes.indexOf('roller_blind') !== -1);
      assert(sys.deviceTypes.indexOf('venetian_blind') !== -1);
      assert(sys.deviceTypes.indexOf('external_shutter') !== -1);
      assert(sys.deviceTypes.indexOf('skylight_blind') !== -1);
    } finally { cleanup(sys); }
  });

  it('builds 16 default devices', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      assertEqual(sys.devices.size, 16);
      assert(sys.devices.has('vr-blind-1'));
      assert(sys.devices.has('skylight-1'));
    } finally { cleanup(sys); }
  });

  it('builds 5 default zones', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      assertEqual(sys.zones.size, 5);
      assert(sys.zones.has('vardagsrum'));
      assert(sys.zones.has('sovrum'));
      assert(sys.zones.has('kok'));
      assert(sys.zones.has('kontor'));
      assert(sys.zones.has('badrum'));
    } finally { cleanup(sys); }
  });

  it('creates 6 zone presets', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const names = Object.keys(sys.zonePresets);
      assertEqual(names.length, 6);
      assert(names.indexOf('open_all') !== -1);
      assert(names.indexOf('privacy') !== -1);
      assert(names.indexOf('movie_mode') !== -1);
    } finally { cleanup(sys); }
  });

  it('initializes solar state with defaults', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      assertEqual(sys.solarState.azimuth, 0);
      assertEqual(sys.solarState.elevation, 0);
      assertEqual(sys.solarState.isDaylight, false);
      assertEqual(sys.solarState.sunrise, null);
    } finally { cleanup(sys); }
  });

  it('sets energy config with seasonal strategies', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      assertType(sys.energyConfig, 'object');
      assertEqual(sys.energyConfig.currentSeason, 'winter');
      const seasons = Object.keys(sys.energyConfig.seasonalConfig);
      assertEqual(seasons.length, 4);
    } finally { cleanup(sys); }
  });

  it('creates privacy config with street-facing rooms', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      assertEqual(sys.privacyConfig.autoCloseAtSunset, true);
      assertEqual(sys.privacyConfig.streetFacingRooms.length, 2);
    } finally { cleanup(sys); }
  });

  it('builds 5 privacy schedules', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      assertEqual(sys.privacySchedules.size, 5);
      const badrum = sys.privacySchedules.get('badrum');
      assertEqual(badrum.alwaysPrivate, true);
    } finally { cleanup(sys); }
  });

  it('builds 6 default scenes', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      assertEqual(sys.scenes.size, 6);
      assert(sys.scenes.has('morning'));
      assert(sys.scenes.has('goodnight'));
      assert(sys.scenes.has('movie'));
      assert(sys.scenes.has('away'));
      assert(sys.scenes.has('wakeup_light'));
      assert(sys.scenes.has('work_from_home'));
    } finally { cleanup(sys); }
  });

  it('builds 4 default schedules', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      assertEqual(sys.schedules.size, 4);
      assert(sys.schedules.has('weekday-morning'));
      assert(sys.schedules.has('holiday-mode'));
    } finally { cleanup(sys); }
  });

  it('builds 6 automation rules', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      assertEqual(sys.automationRules.size, 6);
      assert(sys.automationRules.has('temp-high-close'));
      assert(sys.automationRules.has('room-occupied-restore'));
    } finally { cleanup(sys); }
  });

  it('initializes per-device statistics', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      assertEqual(sys.statistics.size, 16);
      const stat = sys.statistics.get('vr-blind-1');
      assertType(stat, 'object');
      assertEqual(stat.totalCycles, 0);
    } finally { cleanup(sys); }
  });

  it('sets weather state with default values', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      assertEqual(sys.weatherState.temperature, 5.0);
      assertEqual(sys.weatherState.windSpeed, 3.0);
      assertEqual(sys.weatherState.snowfall, false);
    } finally { cleanup(sys); }
  });

  it('sets weather thresholds', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      assertEqual(sys.weatherThresholds.highWindRetractSpeed, 15.0);
      assertEqual(sys.weatherThresholds.stormRetractSpeed, 20.0);
      assertEqual(sys.weatherThresholds.frostProtectionTemp, -5.0);
    } finally { cleanup(sys); }
  });

  it('is an EventEmitter instance', () => {
    const EventEmitter = require('events');
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      assertInstanceOf(sys, EventEmitter);
    } finally { cleanup(sys); }
  });
});

/* ═══════════════════════════════════════════════════════════════
   INITIALIZE
   ═══════════════════════════════════════════════════════════════ */
describe('SmartBlindsShutterControlSystem – initialize', () => {
  it('sets initialized to true and creates 10 intervals', async () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      await sys.initialize();
      assertEqual(sys.initialized, true);
      assertEqual(sys.intervals.length, 10);
    } finally { cleanup(sys); }
  });

  it('emits system_initialized event', async () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    let evt = null;
    sys.on('system_initialized', (e) => { evt = e; });
    try {
      await sys.initialize();
      assertType(evt, 'object');
      assertEqual(evt.deviceCount, 16);
      assertEqual(evt.zoneCount, 5);
    } finally { cleanup(sys); }
  });

  it('does not re-initialize when already initialized', async () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      await sys.initialize();
      const countAfterFirst = sys.intervals.length;
      await sys.initialize();
      assertEqual(sys.intervals.length, countAfterFirst);
    } finally { cleanup(sys); }
  });

  it('calculates sun position during init', async () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      await sys.initialize();
      assertType(sys.solarState.azimuth, 'number');
      assertType(sys.solarState.lastCalculated, 'string');
    } finally { cleanup(sys); }
  });
});

/* ═══════════════════════════════════════════════════════════════
   SCENE METHODS
   ═══════════════════════════════════════════════════════════════ */
describe('SmartBlindsShutterControlSystem – scenes', () => {
  it('activateScene returns success for valid scene', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const r = sys.activateScene('movie');
      assertEqual(r.success, true);
      assertEqual(r.sceneId, 'movie');
      assertType(r.actionsApplied, 'number');
      assert(r.actionsApplied > 0);
    } finally { cleanup(sys); }
  });

  it('activateScene returns error for unknown scene', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const r = sys.activateScene('nonexistent');
      assertEqual(r.success, false);
      assertType(r.error, 'string');
    } finally { cleanup(sys); }
  });

  it('activateScene deactivates other scenes', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      sys.activateScene('movie');
      assertEqual(sys.scenes.get('movie').isActive, true);
      sys.activateScene('morning');
      assertEqual(sys.scenes.get('movie').isActive, false);
      assertEqual(sys.scenes.get('morning').isActive, true);
    } finally { cleanup(sys); }
  });

  it('activateScene goodnight applies to all zones', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const r = sys.activateScene('goodnight');
      assertEqual(r.success, true);
      // 'all' zone expands to 5 zones
      assertEqual(r.actionsApplied, 5);
    } finally { cleanup(sys); }
  });

  it('activateScene emits scene_activated event', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    let evt = null;
    sys.on('scene_activated', (e) => { evt = e; });
    try {
      sys.activateScene('movie');
      assertType(evt, 'object');
      assertEqual(evt.sceneId, 'movie');
    } finally { cleanup(sys); }
  });

  it('activateScene wakeup_light emits wakeup_sync_request', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    let evt = null;
    sys.on('wakeup_sync_request', (e) => { evt = e; });
    try {
      sys.activateScene('wakeup_light');
      assertType(evt, 'object');
      assertEqual(evt.sceneId, 'wakeup_light');
    } finally { cleanup(sys); }
  });

  it('deactivateScene clears active scene', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      sys.activateScene('movie');
      const r = sys.deactivateScene();
      assertEqual(r.success, true);
      assertEqual(r.deactivated, 'Bioläge');
      assertEqual(sys.scenes.get('movie').isActive, false);
    } finally { cleanup(sys); }
  });

  it('deactivateScene with no active scene returns null deactivated', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const r = sys.deactivateScene();
      assertEqual(r.success, true);
      assertEqual(r.deactivated, null);
    } finally { cleanup(sys); }
  });

  it('getScenes returns array with 6 scenes', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const scenes = sys.getScenes();
      assertEqual(scenes.length, 6);
      const ids = scenes.map(s => s.id);
      assert(ids.indexOf('morning') !== -1);
      assert(ids.indexOf('away') !== -1);
    } finally { cleanup(sys); }
  });
});

/* ═══════════════════════════════════════════════════════════════
   DEVICE POSITION CONTROL
   ═══════════════════════════════════════════════════════════════ */
describe('SmartBlindsShutterControlSystem – setPosition', () => {
  it('sets position on valid device', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const r = sys.setPosition('vr-blind-1', 75);
      assertEqual(r.success, true);
      assertEqual(r.position, 75);
      assertEqual(r.deviceId, 'vr-blind-1');
    } finally { cleanup(sys); }
  });

  it('returns error for unknown device', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const r = sys.setPosition('xxx', 50);
      assertEqual(r.success, false);
      assert(r.error.indexOf('not found') !== -1);
    } finally { cleanup(sys); }
  });

  it('returns error for offline device', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      sys.devices.get('vr-blind-1').isOnline = false;
      const r = sys.setPosition('vr-blind-1', 50);
      assertEqual(r.success, false);
      assert(r.error.indexOf('offline') !== -1);
    } finally { cleanup(sys); }
  });

  it('rejects position outside 0-100', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      assertEqual(sys.setPosition('vr-blind-1', -5).success, false);
      assertEqual(sys.setPosition('vr-blind-1', 150).success, false);
    } finally { cleanup(sys); }
  });

  it('rejects tilt outside 0-90', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const r = sys.setPosition('vr-blind-1', 50, { tilt: 100 });
      assertEqual(r.success, false);
      assert(r.error.indexOf('Tilt') !== -1);
    } finally { cleanup(sys); }
  });

  it('accepts tilt option', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const r = sys.setPosition('vr-venetian-1', 50, { tilt: 45 });
      assertEqual(r.success, true);
      assertEqual(r.tilt, 45);
    } finally { cleanup(sys); }
  });
});

/* ═══════════════════════════════════════════════════════════════
   TILT CONTROL
   ═══════════════════════════════════════════════════════════════ */
describe('SmartBlindsShutterControlSystem – setTilt', () => {
  it('sets tilt on venetian blind', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const r = sys.setTilt('vr-venetian-1', 60);
      assertEqual(r.success, true);
      assertEqual(r.tilt, 60);
      assertType(r.oldTilt, 'number');
    } finally { cleanup(sys); }
  });

  it('rejects tilt on non-tiltable device type', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const r = sys.setTilt('vr-blind-1', 30);
      assertEqual(r.success, false);
      assert(r.error.indexOf('not supported') !== -1);
    } finally { cleanup(sys); }
  });

  it('returns error for unknown device', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const r = sys.setTilt('xxx', 30);
      assertEqual(r.success, false);
    } finally { cleanup(sys); }
  });

  it('rejects tilt outside 0-90', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const r = sys.setTilt('vr-venetian-1', 100);
      assertEqual(r.success, false);
    } finally { cleanup(sys); }
  });

  it('updates statistics on tilt change', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const before = sys.statistics.get('vr-venetian-1').totalTiltChanges;
      sys.setTilt('vr-venetian-1', 45);
      const after = sys.statistics.get('vr-venetian-1').totalTiltChanges;
      assertEqual(after, before + 1);
    } finally { cleanup(sys); }
  });
});

/* ═══════════════════════════════════════════════════════════════
   GROUP POSITION
   ═══════════════════════════════════════════════════════════════ */
describe('SmartBlindsShutterControlSystem – setGroupPosition', () => {
  it('sets position for all devices in zone', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const r = sys.setGroupPosition('kok', 80);
      assertEqual(r.success, true);
      assertEqual(r.zoneId, 'kok');
      assertEqual(r.devicesAffected, 2);
    } finally { cleanup(sys); }
  });

  it('returns error for unknown zone', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const r = sys.setGroupPosition('garage', 50);
      assertEqual(r.success, false);
    } finally { cleanup(sys); }
  });

  it('applies preset by name', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const r = sys.setGroupPosition('vardagsrum', 0, { preset: 'privacy' });
      assertEqual(r.success, true);
      assertEqual(r.position, 15);
      assertEqual(r.tilt, 45);
    } finally { cleanup(sys); }
  });

  it('returns error for unknown preset', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const r = sys.setGroupPosition('vardagsrum', 50, { preset: 'bogus' });
      assertEqual(r.success, false);
      assert(r.error.indexOf('Unknown preset') !== -1);
    } finally { cleanup(sys); }
  });

  it('rejects position outside 0-100', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const r = sys.setGroupPosition('kok', 200);
      assertEqual(r.success, false);
    } finally { cleanup(sys); }
  });
});

/* ═══════════════════════════════════════════════════════════════
   WEATHER
   ═══════════════════════════════════════════════════════════════ */
describe('SmartBlindsShutterControlSystem – weather', () => {
  it('updateWeather changes state', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      sys.updateWeather({ temperature: 25, windSpeed: 10, humidity: 80 });
      assertEqual(sys.weatherState.temperature, 25);
      assertEqual(sys.weatherState.windSpeed, 10);
      assertEqual(sys.weatherState.humidity, 80);
    } finally { cleanup(sys); }
  });

  it('high wind emits weather_alert_retract', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    let evt = null;
    sys.on('weather_alert_retract', (e) => { evt = e; });
    try {
      sys.updateWeather({ windSpeed: 20, windGust: 25 });
      assertType(evt, 'object');
      assert(evt.alerts.indexOf('high_wind') !== -1);
    } finally { cleanup(sys); }
  });

  it('storm wind triggers storm alert', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    let evt = null;
    sys.on('weather_alert_retract', (e) => { evt = e; });
    try {
      sys.updateWeather({ windSpeed: 22, windGust: 22 });
      assert(evt.alerts.indexOf('storm') !== -1);
    } finally { cleanup(sys); }
  });

  it('heavy rain triggers rain alert and closes skylights', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    let evt = null;
    sys.on('weather_alert_retract', (e) => { evt = e; });
    try {
      // Ensure skylight is open first
      sys.devices.get('skylight-1').position = 50;
      sys.updateWeather({ rainIntensity: 10 });
      assert(evt.alerts.indexOf('heavy_rain') !== -1);
    } finally { cleanup(sys); }
  });

  it('frost triggers frost alert', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    let evt = null;
    sys.on('weather_alert_retract', (e) => { evt = e; });
    try {
      sys.updateWeather({ temperature: -10 });
      assert(evt.alerts.indexOf('frost') !== -1);
    } finally { cleanup(sys); }
  });

  it('getWeatherStatus returns current and thresholds', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const ws = sys.getWeatherStatus();
      assertType(ws.current, 'object');
      assertType(ws.thresholds, 'object');
      assertType(ws.timestamp, 'string');
    } finally { cleanup(sys); }
  });
});

/* ═══════════════════════════════════════════════════════════════
   SCHEDULES
   ═══════════════════════════════════════════════════════════════ */
describe('SmartBlindsShutterControlSystem – schedules', () => {
  it('addSchedule succeeds with valid data', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const r = sys.addSchedule({
        name: 'Test Schedule',
        triggerType: 'time',
        triggerValue: '12:00',
        actions: [{ deviceId: 'vr-blind-1', position: 50, tilt: 0 }]
      });
      assertEqual(r.success, true);
      assertType(r.scheduleId, 'string');
    } finally { cleanup(sys); }
  });

  it('addSchedule fails without name', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const r = sys.addSchedule({ actions: [{ deviceId: 'vr-blind-1', position: 50, tilt: 0 }] });
      assertEqual(r.success, false);
      assert(r.error.indexOf('name') !== -1);
    } finally { cleanup(sys); }
  });

  it('addSchedule fails without actions', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const r = sys.addSchedule({ name: 'No actions' });
      assertEqual(r.success, false);
    } finally { cleanup(sys); }
  });

  it('removeSchedule succeeds for existing', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const r = sys.removeSchedule('weekday-morning');
      assertEqual(r.success, true);
      assertEqual(r.removed, 'Vardag morgon');
      assertEqual(sys.schedules.has('weekday-morning'), false);
    } finally { cleanup(sys); }
  });

  it('removeSchedule fails for nonexistent', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const r = sys.removeSchedule('nope');
      assertEqual(r.success, false);
    } finally { cleanup(sys); }
  });

  it('getSchedules returns array of 4 defaults', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const scheds = sys.getSchedules();
      assertEqual(scheds.length, 4);
      const ids = scheds.map(s => s.id);
      assert(ids.indexOf('weekday-morning') !== -1);
      assert(ids.indexOf('holiday-mode') !== -1);
    } finally { cleanup(sys); }
  });
});

/* ═══════════════════════════════════════════════════════════════
   DEVICE MANAGEMENT
   ═══════════════════════════════════════════════════════════════ */
describe('SmartBlindsShutterControlSystem – device management', () => {
  it('addDevice succeeds with valid data', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const r = sys.addDevice({
        id: 'new-blind-1',
        name: 'New Blind',
        type: 'roller_blind',
        room: 'vardagsrum'
      });
      assertEqual(r.success, true);
      assertEqual(r.deviceId, 'new-blind-1');
      assertEqual(sys.devices.size, 17);
      // Also added to zone
      assert(sys.zones.get('vardagsrum').devices.indexOf('new-blind-1') !== -1);
    } finally { cleanup(sys); }
  });

  it('addDevice fails without id', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const r = sys.addDevice({ name: 'No ID', type: 'roller_blind' });
      assertEqual(r.success, false);
    } finally { cleanup(sys); }
  });

  it('addDevice fails without name', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const r = sys.addDevice({ id: 'x', type: 'roller_blind' });
      assertEqual(r.success, false);
    } finally { cleanup(sys); }
  });

  it('addDevice fails with invalid type', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const r = sys.addDevice({ id: 'x', name: 'X', type: 'hologram' });
      assertEqual(r.success, false);
      assert(r.error.indexOf('Invalid type') !== -1);
    } finally { cleanup(sys); }
  });

  it('addDevice initializes statistics for new device', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      sys.addDevice({ id: 'new-2', name: 'New 2', type: 'curtain' });
      const stat = sys.statistics.get('new-2');
      assertType(stat, 'object');
      assertEqual(stat.totalCycles, 0);
    } finally { cleanup(sys); }
  });

  it('removeDevice succeeds and cleans up', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const r = sys.removeDevice('vr-blind-1');
      assertEqual(r.success, true);
      assertEqual(sys.devices.has('vr-blind-1'), false);
      assertEqual(sys.statistics.has('vr-blind-1'), false);
      // Removed from zone
      assertEqual(sys.zones.get('vardagsrum').devices.indexOf('vr-blind-1'), -1);
    } finally { cleanup(sys); }
  });

  it('removeDevice fails for unknown device', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const r = sys.removeDevice('nonexistent');
      assertEqual(r.success, false);
    } finally { cleanup(sys); }
  });
});

/* ═══════════════════════════════════════════════════════════════
   SET ALL POSITIONS
   ═══════════════════════════════════════════════════════════════ */
describe('SmartBlindsShutterControlSystem – setAllPositions', () => {
  it('sets position on all online devices', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const r = sys.setAllPositions(50);
      assertEqual(r.success, true);
      assertEqual(r.affected, 16);
      assertEqual(r.position, 50);
    } finally { cleanup(sys); }
  });

  it('filters by device type', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const r = sys.setAllPositions(100, { type: 'venetian_blind' });
      assertEqual(r.success, true);
      // vr-venetian-1, kok-venetian-1, kontor-venetian-1 = 3
      assertEqual(r.affected, 3);
    } finally { cleanup(sys); }
  });

  it('filters by facing direction', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const r = sys.setAllPositions(0, { facing: 'north' });
      assertEqual(r.success, true);
      // kok-venetian-1 (north) + bad-blind-1 (north) = 2
      assertEqual(r.affected, 2);
    } finally { cleanup(sys); }
  });

  it('filters exterior only', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const r = sys.setAllPositions(0, { exteriorOnly: true });
      assertEqual(r.success, true);
      // ext-shutter-vr + ext-shutter-sr = 2
      assertEqual(r.affected, 2);
    } finally { cleanup(sys); }
  });

  it('rejects invalid position', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const r = sys.setAllPositions(-10);
      assertEqual(r.success, false);
    } finally { cleanup(sys); }
  });
});

/* ═══════════════════════════════════════════════════════════════
   CALIBRATION
   ═══════════════════════════════════════════════════════════════ */
describe('SmartBlindsShutterControlSystem – calibrate', () => {
  it('starts calibration on valid device', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const r = sys.calibrate('vr-blind-1');
      assertEqual(r.success, true);
      assertEqual(r.status, 'calibrating');
      assertEqual(r.estimatedTimeSeconds, 10);
      const d = sys.devices.get('vr-blind-1');
      assertEqual(d.motorStatus, 'calibrating');
      assertEqual(d.isMoving, true);
    } finally { cleanup(sys); }
  });

  it('returns error for unknown device', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const r = sys.calibrate('xxx');
      assertEqual(r.success, false);
    } finally { cleanup(sys); }
  });

  it('returns error for offline device', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      sys.devices.get('vr-blind-1').isOnline = false;
      const r = sys.calibrate('vr-blind-1');
      assertEqual(r.success, false);
    } finally { cleanup(sys); }
  });
});

/* ═══════════════════════════════════════════════════════════════
   OCCUPANCY
   ═══════════════════════════════════════════════════════════════ */
describe('SmartBlindsShutterControlSystem – occupancy', () => {
  it('updateOccupancy sets room state', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      sys.updateOccupancy('vardagsrum', true);
      const occ = sys.roomOccupancy.get('vardagsrum');
      assertEqual(occ.occupied, true);
      assertType(occ.lastSeen, 'string');
      assertType(occ.updatedAt, 'string');
    } finally { cleanup(sys); }
  });

  it('updateOccupancy with false preserves lastSeen', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      sys.updateOccupancy('sovrum', true);
      const firstSeen = sys.roomOccupancy.get('sovrum').lastSeen;
      sys.updateOccupancy('sovrum', false);
      const occ = sys.roomOccupancy.get('sovrum');
      assertEqual(occ.occupied, false);
      assertEqual(occ.lastSeen, firstSeen);
    } finally { cleanup(sys); }
  });
});

/* ═══════════════════════════════════════════════════════════════
   POSITION LOG
   ═══════════════════════════════════════════════════════════════ */
describe('SmartBlindsShutterControlSystem – positionLog', () => {
  it('getPositionLog returns empty array initially', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const log = sys.getPositionLog();
      assertInstanceOf(log, Array);
      assertEqual(log.length, 0);
    } finally { cleanup(sys); }
  });

  it('setPosition creates log entries', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      sys.setPosition('vr-blind-1', 80);
      const log = sys.getPositionLog();
      assert(log.length > 0);
      assertEqual(log[0].deviceId, 'vr-blind-1');
      assertEqual(log[0].position, 80);
    } finally { cleanup(sys); }
  });

  it('filters by deviceId', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      sys.setPosition('vr-blind-1', 80);
      sys.setPosition('sr-blind-1', 60);
      const log = sys.getPositionLog({ deviceId: 'sr-blind-1' });
      assertEqual(log.length, 1);
      assertEqual(log[0].deviceId, 'sr-blind-1');
    } finally { cleanup(sys); }
  });

  it('filters by room', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      sys.setPosition('vr-blind-1', 80);
      sys.setPosition('kok-venetian-1', 50);
      const log = sys.getPositionLog({ room: 'kok' });
      assert(log.length >= 1);
      assertEqual(log[0].room, 'kok');
    } finally { cleanup(sys); }
  });

  it('filters by limit', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      sys.setPosition('vr-blind-1', 80);
      sys.setPosition('sr-blind-1', 60);
      sys.setPosition('kok-venetian-1', 40);
      const log = sys.getPositionLog({ limit: 1 });
      assertEqual(log.length, 1);
    } finally { cleanup(sys); }
  });
});

/* ═══════════════════════════════════════════════════════════════
   ENERGY REPORT
   ═══════════════════════════════════════════════════════════════ */
describe('SmartBlindsShutterControlSystem – energy', () => {
  it('getEnergyReport returns summary and perDevice', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const report = sys.getEnergyReport();
      assertType(report.summary, 'object');
      assertType(report.summary.dailySavingsSEK, 'number');
      assertType(report.summary.currentSeason, 'string');
      assertType(report.summary.strategy, 'string');
      assertInstanceOf(report.perDevice, Array);
      assertEqual(report.perDevice.length, 16);
      assertType(report.timestamp, 'string');
    } finally { cleanup(sys); }
  });

  it('perDevice entries have expected fields', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const d = sys.getEnergyReport().perDevice[0];
      assertType(d.id, 'string');
      assertType(d.name, 'string');
      assertType(d.energySavedSEK, 'number');
      assertType(d.totalCycles, 'number');
    } finally { cleanup(sys); }
  });
});

/* ═══════════════════════════════════════════════════════════════
   STATISTICS
   ═══════════════════════════════════════════════════════════════ */
describe('SmartBlindsShutterControlSystem – statistics', () => {
  it('getStatistics returns all devices when no filter', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const stats = sys.getStatistics();
      assertEqual(stats.devices.length, 16);
      assertType(stats.totals.totalCycles, 'number');
      assertType(stats.totals.avgPosition, 'number');
      assertType(stats.timestamp, 'string');
    } finally { cleanup(sys); }
  });

  it('getStatistics filters by room', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const stats = sys.getStatistics('kok');
      assertEqual(stats.devices.length, 2);
      stats.devices.forEach(d => assertEqual(d.room, 'kok'));
    } finally { cleanup(sys); }
  });

  it('tracks cycles after setPosition', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      sys.setPosition('vr-blind-1', 80);
      const stats = sys.getStatistics();
      assert(stats.totals.totalCycles > 0);
    } finally { cleanup(sys); }
  });
});

/* ═══════════════════════════════════════════════════════════════
   SOLAR DATA
   ═══════════════════════════════════════════════════════════════ */
describe('SmartBlindsShutterControlSystem – solar', () => {
  it('getSolarData returns sun position and window exposure', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const data = sys.getSolarData();
      assertType(data.sun, 'object');
      assertType(data.sun.azimuth, 'number');
      assertType(data.sun.elevation, 'number');
      assertInstanceOf(data.windowExposure, Array);
      assertEqual(data.windowExposure.length, 4);
      assertType(data.season, 'string');
      assertType(data.timestamp, 'string');
    } finally { cleanup(sys); }
  });

  it('window exposure covers 4 cardinal directions', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const exp = sys.getSolarData().windowExposure;
      const dirs = exp.map(e => e.facing);
      assert(dirs.indexOf('north') !== -1);
      assert(dirs.indexOf('east') !== -1);
      assert(dirs.indexOf('south') !== -1);
      assert(dirs.indexOf('west') !== -1);
    } finally { cleanup(sys); }
  });
});

/* ═══════════════════════════════════════════════════════════════
   LOCATION
   ═══════════════════════════════════════════════════════════════ */
describe('SmartBlindsShutterControlSystem – location', () => {
  it('setLocation updates coordinates', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const r = sys.setLocation(57.7089, 11.9746);
      assertEqual(r.success, true);
      assertEqual(r.latitude, 57.7089);
      assertEqual(r.longitude, 11.9746);
      assertEqual(sys.location.latitude, 57.7089);
    } finally { cleanup(sys); }
  });

  it('setLocation recalculates sun position', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      sys.setLocation(0, 0);
      assertType(sys.solarState.lastCalculated, 'string');
    } finally { cleanup(sys); }
  });
});

/* ═══════════════════════════════════════════════════════════════
   STATUS
   ═══════════════════════════════════════════════════════════════ */
describe('SmartBlindsShutterControlSystem – getStatus', () => {
  it('returns comprehensive status object', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const s = sys.getStatus();
      assertEqual(s.initialized, false);
      assertEqual(s.devices.length, 16);
      assertEqual(s.zones.length, 5);
      assertType(s.solar, 'object');
      assertType(s.weather, 'object');
      assertEqual(s.activeScene, null);
      assertType(s.currentSeason, 'string');
      assertType(s.energySavings, 'object');
      assertType(s.timestamp, 'string');
    } finally { cleanup(sys); }
  });

  it('reflects active scene', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      sys.activateScene('movie');
      const s = sys.getStatus();
      assertEqual(s.activeScene, 'movie');
    } finally { cleanup(sys); }
  });

  it('device entries have expected fields', () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      const d = sys.getStatus().devices[0];
      assertType(d.id, 'string');
      assertType(d.name, 'string');
      assertType(d.position, 'number');
      assertType(d.batteryLevel, 'number');
      assertType(d.isOnline, 'boolean');
    } finally { cleanup(sys); }
  });
});

/* ═══════════════════════════════════════════════════════════════
   DESTROY
   ═══════════════════════════════════════════════════════════════ */
describe('SmartBlindsShutterControlSystem – destroy', () => {
  it('clears intervals and sets initialized to false', async () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      await sys.initialize();
      assertEqual(sys.initialized, true);
      sys.destroy();
      assertEqual(sys.initialized, false);
      assertEqual(sys.intervals.length, 0);
    } finally { cleanup(sys); }
  });

  it('clears position log', async () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      await sys.initialize();
      sys.setPosition('vr-blind-1', 50);
      assert(sys.positionLog.length > 0);
      sys.destroy();
      assertEqual(sys.positionLog.length, 0);
    } finally { cleanup(sys); }
  });

  it('stops moving devices', async () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      await sys.initialize();
      sys.setPosition('vr-blind-1', 80);
      // Device may be in moving state due to setTimeout
      sys.destroy();
      const d = sys.devices.get('vr-blind-1');
      assertEqual(d.isMoving, false);
      assertEqual(d.motorStatus, 'idle');
    } finally { cleanup(sys); }
  });
});

/* ═══════════════════════════════════════════════════════════════
   LIFECYCLE
   ═══════════════════════════════════════════════════════════════ */
describe('SmartBlindsShutterControlSystem – lifecycle', () => {
  it('full init-use-destroy cycle', async () => {
    const sys = new SmartBlindsShutterControlSystem(createMockHomey());
    try {
      await sys.initialize();
      assertEqual(sys.initialized, true);
      sys.setPosition('vr-blind-1', 75);
      sys.activateScene('movie');
      sys.updateWeather({ temperature: 30 });
      const status = sys.getStatus();
      assertEqual(status.activeScene, 'movie');
      sys.destroy();
      assertEqual(sys.initialized, false);
    } finally { cleanup(sys); }
  });
});

run();
