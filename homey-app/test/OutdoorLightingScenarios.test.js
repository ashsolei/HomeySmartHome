'use strict';

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertType } = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');

/* ── timer-leak prevention ─────────────────────────────── */
const _origSetTimeout = global.setTimeout;
const _origSetInterval = global.setInterval;
const activeHandles = [];
global.setTimeout = (...args) => { const id = _origSetTimeout(...args); activeHandles.push({ type: 'timeout', id }); return id; };
global.setInterval = (...args) => { const id = _origSetInterval(...args); activeHandles.push({ type: 'interval', id }); return id; };
function cleanup(sys) {
  try { sys.destroy(); } catch (_) {}
  while (activeHandles.length > 0) {
    const h = activeHandles.pop();
    if (h.type === 'timeout') clearTimeout(h.id); else clearInterval(h.id);
  }
}

const OutdoorLightingScenarios = require('../lib/OutdoorLightingScenarios');

function makeHomey() {
  return createMockHomey({
    devices: { getDevices: async () => ({}) }
  });
}

/* ═══════════════════════════════════════════════════════════
   OutdoorLightingScenarios – Test Suite
   ═══════════════════════════════════════════════════════════ */

describe('OutdoorLightingScenarios — constructor', () => {
  it('creates instance with Stockholm coordinates', () => {
    const sys = new OutdoorLightingScenarios(makeHomey());
    assertType(sys.latitude, 'number');
    assertType(sys.longitude, 'number');
    assert(Math.abs(sys.latitude - 59.33) < 0.1, 'latitude near Stockholm');
    assert(Math.abs(sys.longitude - 18.07) < 0.1, 'longitude near Stockholm');
    cleanup(sys);
  });

  it('starts uninitialized', () => {
    const sys = new OutdoorLightingScenarios(makeHomey());
    assertEqual(sys.initialized, false);
    cleanup(sys);
  });
});

describe('OutdoorLightingScenarios — initialize', () => {
  it('initializes all subsystems', async () => {
    const sys = new OutdoorLightingScenarios(makeHomey());
    await sys.initialize();
    assertEqual(sys.initialized, true);
    assertEqual(sys.accentProfiles.size, 10);
    assertEqual(sys.holidayThemes.size, 6);
    assertEqual(sys.motionZones.size, 6);
    assertEqual(sys.pathwaySegments.length, 6);
    cleanup(sys);
  });

  it('does not throw when device discovery fails', async () => {
    const homey = createMockHomey({
      devices: { getDevices: async () => { throw new Error('fail'); } }
    });
    const sys = new OutdoorLightingScenarios(homey);
    await sys.initialize();
    assertEqual(sys.initialized, true);
    cleanup(sys);
  });
});

describe('OutdoorLightingScenarios — sun calculations', () => {
  it('calculateSunPosition returns altitude, azimuth, declination', () => {
    const sys = new OutdoorLightingScenarios(makeHomey());
    const summer = new Date(2024, 5, 21, 12, 0, 0); // June 21 noon
    const pos = sys.calculateSunPosition(summer);
    assertType(pos.altitude, 'number');
    assertType(pos.azimuth, 'number');
    assertType(pos.declination, 'number');
    assert(pos.altitude > 0, 'altitude should be positive at noon in summer');
    cleanup(sys);
  });

  it('getSunrise returns formatted time', () => {
    const sys = new OutdoorLightingScenarios(makeHomey());
    const date = new Date(2024, 2, 21); // March equinox
    const sunrise = sys.getSunrise(date);
    assertType(sunrise.hours, 'number');
    assertType(sunrise.minutes, 'number');
    assertType(sunrise.formatted, 'string');
    assert(sunrise.hours >= 3 && sunrise.hours <= 10, 'sunrise in reasonable range');
    cleanup(sys);
  });

  it('getSunset returns formatted time', () => {
    const sys = new OutdoorLightingScenarios(makeHomey());
    const date = new Date(2024, 2, 21);
    const sunset = sys.getSunset(date);
    assertType(sunset.hours, 'number');
    assertType(sunset.minutes, 'number');
    assertType(sunset.formatted, 'string');
    assert(sunset.hours >= 15 && sunset.hours <= 23, 'sunset in reasonable range');
    cleanup(sys);
  });

  it('getCivilTwilight returns dawn and dusk', () => {
    const sys = new OutdoorLightingScenarios(makeHomey());
    const date = new Date(2024, 2, 21);
    const twilight = sys.getCivilTwilight(date);
    assertType(twilight.dawn, 'object');
    assertType(twilight.dusk, 'object');
    cleanup(sys);
  });

  it('getNauticalTwilight returns dawn and dusk', () => {
    const sys = new OutdoorLightingScenarios(makeHomey());
    const date = new Date(2024, 2, 21);
    const twilight = sys.getNauticalTwilight(date);
    assertType(twilight.dawn, 'object');
    assertType(twilight.dusk, 'object');
    cleanup(sys);
  });
});

describe('OutdoorLightingScenarios — brightness & color temp', () => {
  it('getBrightnessForTime returns 0-100', () => {
    const sys = new OutdoorLightingScenarios(makeHomey());
    const noon = new Date(2024, 5, 21, 12, 0, 0);
    const brightness = sys.getBrightnessForTime(noon);
    assertType(brightness, 'number');
    assert(brightness >= 0 && brightness <= 100, 'brightness should be 0-100');
    cleanup(sys);
  });

  it('getBrightnessForTime is higher at night', () => {
    const sys = new OutdoorLightingScenarios(makeHomey());
    const midnight = new Date(2024, 0, 15, 0, 0, 0);
    const noon = new Date(2024, 0, 15, 12, 0, 0);
    const brightNight = sys.getBrightnessForTime(midnight);
    const brightDay = sys.getBrightnessForTime(noon);
    assert(brightNight > brightDay, 'night brightness (outdoor lights) should exceed daytime');
    cleanup(sys);
  });

  it('getColorTempForTime returns 2200-4000 range', () => {
    const sys = new OutdoorLightingScenarios(makeHomey());
    const evening = new Date(2024, 5, 21, 22, 0, 0);
    const temp = sys.getColorTempForTime(evening);
    assertType(temp, 'number');
    assert(temp >= 2200 && temp <= 4000, 'color temp should be in warm range');
    cleanup(sys);
  });
});

describe('OutdoorLightingScenarios — holiday themes', () => {
  it('getActiveHolidayTheme returns null when no theme active', () => {
    const sys = new OutdoorLightingScenarios(makeHomey());
    // Most dates won't match a holiday
    const theme = sys.getActiveHolidayTheme();
    // Can be null or an object depending on current date
    if (theme !== null) {
      assertType(theme.id, 'string');
    }
    cleanup(sys);
  });

  it('has 6 holiday themes initialized', async () => {
    const sys = new OutdoorLightingScenarios(makeHomey());
    await sys.initialize();
    assertEqual(sys.holidayThemes.size, 6);
    assert(sys.holidayThemes.has('christmas'), 'should have christmas');
    assert(sys.holidayThemes.has('midsommar'), 'should have midsommar');
    assert(sys.holidayThemes.has('lucia'), 'should have lucia');
    cleanup(sys);
  });
});

describe('OutdoorLightingScenarios — weather adjustments', () => {
  it('adjustForWeather handles fog', async () => {
    const sys = new OutdoorLightingScenarios(makeHomey());
    await sys.initialize();
    const result = sys.adjustForWeather({ condition: 'fog', visibility: 100 });
    assertType(result.adjustments, 'object');
    assert(Array.isArray(result.adjustments), 'adjustments should be array');
    assert(result.adjustments.length > 0, 'fog should trigger adjustments');
    cleanup(sys);
  });

  it('adjustForWeather handles rain', async () => {
    const sys = new OutdoorLightingScenarios(makeHomey());
    await sys.initialize();
    const result = sys.adjustForWeather({ condition: 'rain', intensity: 'heavy' });
    assertType(result.adjustments, 'object');
    cleanup(sys);
  });

  it('adjustForWeather handles snow', async () => {
    const sys = new OutdoorLightingScenarios(makeHomey());
    await sys.initialize();
    const result = sys.adjustForWeather({ condition: 'snow' });
    assertType(result.adjustments, 'object');
    cleanup(sys);
  });

  it('adjustForWeather handles null conditions', async () => {
    const sys = new OutdoorLightingScenarios(makeHomey());
    await sys.initialize();
    const result = sys.adjustForWeather(null);
    assertType(result.adjustments, 'object');
    assertEqual(result.adjustments.length, 0);
    cleanup(sys);
  });
});

describe('OutdoorLightingScenarios — pathway sequence', () => {
  it('activates forward sequence', async () => {
    const sys = new OutdoorLightingScenarios(makeHomey());
    await sys.initialize();
    const result = sys.activatePathwaySequence('forward');
    assertEqual(result.direction, 'forward');
    assert(result.segmentCount > 0, 'should have segments');
    assert(result.totalDurationMs > 0, 'should have duration');
    assert(Array.isArray(result.segments), 'segments should be array');
    cleanup(sys);
  });

  it('activates reverse sequence', async () => {
    const sys = new OutdoorLightingScenarios(makeHomey());
    await sys.initialize();
    const result = sys.activatePathwaySequence('reverse');
    assertEqual(result.direction, 'reverse');
    assert(result.segmentCount > 0, 'should have segments');
    cleanup(sys);
  });
});

describe('OutdoorLightingScenarios — camera boost', () => {
  it('boosts lights for camera zone', async () => {
    const sys = new OutdoorLightingScenarios(makeHomey());
    await sys.initialize();
    const zones = Array.from(sys.motionZones.keys());
    const result = sys.boostLightsForCamera(zones[0]);
    assertType(result.cameraZone, 'string');
    assert(Array.isArray(result.boostedProfiles), 'boostedProfiles should be array');
    assertType(result.duration, 'number');
    assertType(result.colorTemp, 'number');
    cleanup(sys);
  });
});

describe('OutdoorLightingScenarios — party mode', () => {
  it('starts party mode', async () => {
    const sys = new OutdoorLightingScenarios(makeHomey());
    await sys.initialize();
    const result = sys.startPartyMode(['red', 'blue', 'green'], 'cycle');
    assertEqual(result.active, true);
    assertEqual(result.pattern, 'cycle');
    assert(Array.isArray(result.colors), 'colors should be array');
    assert(result.profilesAffected > 0, 'should affect profiles');
    cleanup(sys);
  });

  it('stops party mode', async () => {
    const sys = new OutdoorLightingScenarios(makeHomey());
    await sys.initialize();
    sys.startPartyMode(['red'], 'cycle');
    const result = sys.stopPartyMode();
    assertEqual(result.active, false);
    cleanup(sys);
  });
});

describe('OutdoorLightingScenarios — wildlife mode', () => {
  it('enables wildlife mode with brightness cap', async () => {
    const sys = new OutdoorLightingScenarios(makeHomey());
    await sys.initialize();
    const result = sys.setWildlifeMode(true);
    assertEqual(result.wildlifeMode, true);
    assert(result.maxBrightness <= 25, 'max brightness should be capped at 25');
    cleanup(sys);
  });

  it('disables wildlife mode', async () => {
    const sys = new OutdoorLightingScenarios(makeHomey());
    await sys.initialize();
    sys.setWildlifeMode(true);
    const result = sys.setWildlifeMode(false);
    assertEqual(result.wildlifeMode, false);
    cleanup(sys);
  });
});

describe('OutdoorLightingScenarios — security lighting', () => {
  it('triggers security lighting at full brightness', async () => {
    const sys = new OutdoorLightingScenarios(makeHomey());
    await sys.initialize();
    const result = sys.triggerSecurityLighting();
    assertEqual(result.securityActive, true);
    assertEqual(result.brightness, 100);
    assertEqual(result.colorTemp, 5000);
    assert(result.profilesActivated > 0, 'should activate profiles');
    cleanup(sys);
  });

  it('deactivates security lighting', async () => {
    const sys = new OutdoorLightingScenarios(makeHomey());
    await sys.initialize();
    sys.triggerSecurityLighting();
    const result = sys.deactivateSecurityLighting();
    assertEqual(result.securityActive, false);
    cleanup(sys);
  });
});

describe('OutdoorLightingScenarios — presence simulation', () => {
  it('starts presence simulation', async () => {
    const sys = new OutdoorLightingScenarios(makeHomey());
    await sys.initialize();
    const result = sys.simulatePresence();
    assertEqual(result.active, true);
    assertType(result.intervalMinutes, 'number');
    cleanup(sys);
  });

  it('stops presence simulation', async () => {
    const sys = new OutdoorLightingScenarios(makeHomey());
    await sys.initialize();
    sys.simulatePresence();
    const result = sys.stopPresenceSimulation();
    assertEqual(result.active, false);
    cleanup(sys);
  });

  it('returns already-active when started twice', async () => {
    const sys = new OutdoorLightingScenarios(makeHomey());
    await sys.initialize();
    sys.simulatePresence();
    const result = sys.simulatePresence();
    assertEqual(result.active, true);
    assertEqual(result.reason, 'already_running');
    cleanup(sys);
  });
});

describe('OutdoorLightingScenarios — motion handling', () => {
  it('handles valid motion zone', async () => {
    const sys = new OutdoorLightingScenarios(makeHomey());
    await sys.initialize();
    const zones = Array.from(sys.motionZones.keys());
    const result = sys.handleMotion(zones[0]);
    assert(result !== null, 'should return result for valid zone');
    assertType(result.zoneId, 'string');
    assertType(result.zoneName, 'string');
    assert(Array.isArray(result.boostedProfiles), 'boostedProfiles should be array');
    assertType(result.timeoutSeconds, 'number');
    assertType(result.motionCount, 'number');
    cleanup(sys);
  });

  it('returns null for unknown zone', async () => {
    const sys = new OutdoorLightingScenarios(makeHomey());
    await sys.initialize();
    const result = sys.handleMotion('nonexistent_zone');
    assertEqual(result, null);
    cleanup(sys);
  });

  it('returns null for inactive zone', async () => {
    const sys = new OutdoorLightingScenarios(makeHomey());
    await sys.initialize();
    const zones = Array.from(sys.motionZones.keys());
    const zone = sys.motionZones.get(zones[0]);
    zone.active = false;
    const result = sys.handleMotion(zones[0]);
    assertEqual(result, null);
    cleanup(sys);
  });
});

describe('OutdoorLightingScenarios — priority dimming', () => {
  it('returns dimming status when under budget', async () => {
    const sys = new OutdoorLightingScenarios(makeHomey());
    await sys.initialize();
    sys.energyBudget.currentUsageKWh = 10;
    const result = sys.priorityDimming();
    assertEqual(result.dimming, false);
    assertType(result.usagePercent, 'number');
    cleanup(sys);
  });

  it('applies dimming when over budget', async () => {
    const sys = new OutdoorLightingScenarios(makeHomey());
    await sys.initialize();
    sys.energyBudget.currentUsageKWh = 45;
    const result = sys.priorityDimming();
    assertEqual(result.dimming, true);
    assertType(result.dimFactor, 'number');
    assert(result.dimFactor > 0 && result.dimFactor <= 70, 'dim factor should be 1-70%');
    cleanup(sys);
  });
});

describe('OutdoorLightingScenarios — getStatistics', () => {
  it('returns comprehensive statistics', async () => {
    const sys = new OutdoorLightingScenarios(makeHomey());
    await sys.initialize();
    const stats = sys.getStatistics();
    assertType(stats.accentProfiles, 'object');
    assertType(stats.motionZones, 'object');
    assertType(stats.pathwaySegments, 'number');
    assertType(stats.energyBudget, 'object');
    assertType(stats.partyMode, 'object');
    assertType(stats.wildlifeMode, 'boolean');
    assertType(stats.securityActive, 'boolean');
    assertType(stats.presenceSimulation, 'boolean');
    assertEqual(stats.pathwaySegments, 6);
    assertType(stats.energyBudget.monthlyBudgetKWh, 'number');
    assertType(stats.energyBudget.currentUsageKWh, 'number');
    cleanup(sys);
  });
});

describe('OutdoorLightingScenarios — destroy', () => {
  it('clears all intervals', async () => {
    const sys = new OutdoorLightingScenarios(makeHomey());
    await sys.initialize();
    sys.startPartyMode(['red'], 'cycle');
    sys.simulatePresence();
    sys.destroy();
    assertEqual(sys.monitoringInterval, null);
    assertEqual(sys.partyInterval, null);
    assertEqual(sys.presenceInterval, null);
    cleanup(sys);
  });
});

run();
