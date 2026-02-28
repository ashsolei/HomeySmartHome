'use strict';

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertType } = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');

const _origSetTimeout = global.setTimeout;
const _origSetInterval = global.setInterval;
const activeHandles = [];
global.setTimeout = (...a) => { const id = _origSetTimeout(...a); activeHandles.push({ type: 'timeout', id }); return id; };
global.setInterval = (...a) => { const id = _origSetInterval(...a); activeHandles.push({ type: 'interval', id }); return id; };
function cleanup(sys) {
  try { if (sys && typeof sys.destroy === 'function') sys.destroy(); } catch (_) {}
  while (activeHandles.length > 0) {
    const h = activeHandles.pop();
    if (h.type === 'timeout') clearTimeout(h.id); else clearInterval(h.id);
  }
}

const SmartCircadianLightingSystem = require('../lib/SmartCircadianLightingSystem');

describe('SmartCircadianLightingSystem — constructor', () => {
  it('instantiates without errors', () => {
    const sys = new SmartCircadianLightingSystem(createMockHomey());
    assert(sys, 'should create instance');
    assertEqual(sys.initialized, false);
    assertEqual(sys.currentPhase, 'day');
    cleanup(sys);
  });
});

describe('SmartCircadianLightingSystem — initialize', () => {
  it('initializes profiles and sun schedule', async () => {
    const sys = new SmartCircadianLightingSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.initialized, true);
    assert(sys.profiles.size >= 3, 'should have at least 3 profiles');
    assert(sys.profiles.has('default'), 'should have default profile');
    assert(sys.sunSchedule.sunrise > 0, 'should calculate sunrise');
    assert(sys.sunSchedule.sunset > 0, 'should calculate sunset');
    cleanup(sys);
  });

  it('does not re-initialize', async () => {
    const sys = new SmartCircadianLightingSystem(createMockHomey());
    await sys.initialize();
    const result = await sys.initialize();
    assertEqual(result, true);
    cleanup(sys);
  });
});

describe('SmartCircadianLightingSystem — calculateSunSchedule', () => {
  it('calculates valid sunrise and sunset', () => {
    const sys = new SmartCircadianLightingSystem(createMockHomey());
    sys.calculateSunSchedule();
    assert(sys.sunSchedule.sunrise > 0, 'sunrise should be positive');
    assert(sys.sunSchedule.sunset > sys.sunSchedule.sunrise, 'sunset should be after sunrise');
    assertType(sys.sunSchedule.daylightHours, 'number');
    cleanup(sys);
  });
});

describe('SmartCircadianLightingSystem — calculateCurrentLightSettings', () => {
  it('returns color temp and brightness', async () => {
    const sys = new SmartCircadianLightingSystem(createMockHomey());
    await sys.initialize();
    const settings = sys.calculateCurrentLightSettings();
    assertType(settings.colorTemp, 'number');
    assertType(settings.brightness, 'number');
    assert(settings.colorTemp >= 1800 && settings.colorTemp <= 6500, 'color temp in range');
    assert(settings.brightness >= 0 && settings.brightness <= 100, 'brightness in range');
    assert(settings.phase, 'should have phase');
    cleanup(sys);
  });

  it('uses specific profile when requested', async () => {
    const sys = new SmartCircadianLightingSystem(createMockHomey());
    await sys.initialize();
    const defaultSettings = sys.calculateCurrentLightSettings('default');
    const nightOwlSettings = sys.calculateCurrentLightSettings('night-owl');
    assertType(defaultSettings.colorTemp, 'number');
    assertType(nightOwlSettings.colorTemp, 'number');
    cleanup(sys);
  });
});

describe('SmartCircadianLightingSystem — determineCurrentPhase', () => {
  it('sets a valid phase', async () => {
    const sys = new SmartCircadianLightingSystem(createMockHomey());
    await sys.initialize();
    sys.determineCurrentPhase();
    assert(['dawn', 'day', 'dusk', 'night'].includes(sys.currentPhase), 'should be valid phase');
    cleanup(sys);
  });
});

describe('SmartCircadianLightingSystem — startDawnSimulation', () => {
  it('starts simulation for existing room', async () => {
    const sys = new SmartCircadianLightingSystem(createMockHomey());
    await sys.initialize();
    sys.rooms.set('bedroom', { id: 'bedroom', name: 'Bedroom' });
    const result = await sys.startDawnSimulation('bedroom', 5);
    assertEqual(result.success, true);
    assertEqual(result.roomId, 'bedroom');
    assert(result.estimatedSteps > 0, 'should have steps');
    cleanup(sys);
  });

  it('fails for unknown room', async () => {
    const sys = new SmartCircadianLightingSystem(createMockHomey());
    await sys.initialize();
    const result = await sys.startDawnSimulation('nonexistent');
    assertEqual(result.success, false);
    cleanup(sys);
  });
});

describe('SmartCircadianLightingSystem — enableMelatoninMode', () => {
  it('enables melatonin mode for a room', async () => {
    const sys = new SmartCircadianLightingSystem(createMockHomey());
    await sys.initialize();
    const result = await sys.enableMelatoninMode('bedroom', { brightness: 10 });
    assertEqual(result.success, true);
    const room = sys.rooms.get('bedroom');
    assertEqual(room.melatoninMode, true);
    assertEqual(room.melatoninConfig.brightness, 10);
    cleanup(sys);
  });
});

describe('SmartCircadianLightingSystem — scheduleLightTherapy', () => {
  it('schedules a therapy session', async () => {
    const sys = new SmartCircadianLightingSystem(createMockHomey());
    await sys.initialize();
    const session = await sys.scheduleLightTherapy({
      roomId: 'office', type: 'SAD', durationMinutes: 30
    });
    assert(session.id, 'should have id');
    assertEqual(session.type, 'SAD');
    assertEqual(session.status, 'scheduled');
    assertEqual(sys.therapySessions.length, 1);
    cleanup(sys);
  });
});

describe('SmartCircadianLightingSystem — adaptToSeason', () => {
  it('returns seasonal adjustment', async () => {
    const sys = new SmartCircadianLightingSystem(createMockHomey());
    await sys.initialize();
    const result = await sys.adaptToSeason();
    assert(['spring', 'summer', 'autumn', 'winter'].includes(result.season), 'should have valid season');
    assertType(result.adjustment.colorTempOffset, 'number');
    assertType(result.adjustment.brightnessOffset, 'number');
    cleanup(sys);
  });
});

describe('SmartCircadianLightingSystem — setRoomProfile', () => {
  it('sets profile for a room', async () => {
    const sys = new SmartCircadianLightingSystem(createMockHomey());
    await sys.initialize();
    const result = await sys.setRoomProfile('bedroom', 'early-bird');
    assertEqual(result.success, true);
    const room = sys.rooms.get('bedroom');
    assertEqual(room.profileId, 'early-bird');
    cleanup(sys);
  });

  it('fails for unknown profile', async () => {
    const sys = new SmartCircadianLightingSystem(createMockHomey());
    await sys.initialize();
    const result = await sys.setRoomProfile('bedroom', 'nonexistent');
    assertEqual(result.success, false);
    cleanup(sys);
  });
});

describe('SmartCircadianLightingSystem — getStatus', () => {
  it('returns comprehensive status', async () => {
    const sys = new SmartCircadianLightingSystem(createMockHomey());
    await sys.initialize();
    const status = await sys.getStatus();
    assertEqual(status.initialized, true);
    assert(status.currentPhase, 'should have phase');
    assert(status.sunSchedule, 'should have sun schedule');
    assert(status.currentSettings, 'should have settings');
    cleanup(sys);
  });
});

describe('SmartCircadianLightingSystem — helpers', () => {
  it('_lerp interpolates correctly', () => {
    const sys = new SmartCircadianLightingSystem(createMockHomey());
    assertEqual(sys._lerp(0, 100, 0), 0);
    assertEqual(sys._lerp(0, 100, 1), 100);
    assertEqual(sys._lerp(0, 100, 0.5), 50);
    // Clamps t to 0-1
    assertEqual(sys._lerp(0, 100, -1), 0);
    assertEqual(sys._lerp(0, 100, 2), 100);
    cleanup(sys);
  });

  it('_easeInOut produces smooth curve', () => {
    const sys = new SmartCircadianLightingSystem(createMockHomey());
    const start = sys._easeInOut(0);
    const mid = sys._easeInOut(0.5);
    const end = sys._easeInOut(1);
    assertEqual(start, 0);
    assertEqual(mid, 0.5);
    assertEqual(end, 1);
    cleanup(sys);
  });

  it('_getDayOfYear returns valid day', () => {
    const sys = new SmartCircadianLightingSystem(createMockHomey());
    const day = sys._getDayOfYear(new Date());
    assert(day >= 1 && day <= 366, 'should be valid day');
    cleanup(sys);
  });
});

describe('SmartCircadianLightingSystem — destroy', () => {
  it('cleans up all timers', async () => {
    const sys = new SmartCircadianLightingSystem(createMockHomey());
    await sys.initialize();
    sys.destroy();
    assertEqual(sys.monitoringInterval, null);
    assertEqual(sys.initialized, false);
    cleanup(sys);
  });
});

run();
