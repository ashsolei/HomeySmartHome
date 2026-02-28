'use strict';

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertType } = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');

/* ── timer-leak prevention ─────────────────────────────────────────── */
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

const AdvancedWeatherIntegration = require('../lib/AdvancedWeatherIntegration');

describe('Weather — constructor & lifecycle', () => {
  it('instantiates without errors', () => {
    const sys = new AdvancedWeatherIntegration(createMockHomey());
    assert(sys, 'should create instance');
    cleanup(sys);
  });

  it('initialize generates weather data', async () => {
    const sys = new AdvancedWeatherIntegration(createMockHomey());
    await sys.initialize();
    assertEqual(sys.initialized, true);
    assert(sys.currentWeather.temperature !== undefined, 'should have temperature');
    assert(sys.forecast.length > 0, 'should have forecast');
    cleanup(sys);
  });

  it('destroy clears intervals', async () => {
    const sys = new AdvancedWeatherIntegration(createMockHomey());
    await sys.initialize();
    sys.destroy();
    assertEqual(sys.updateInterval, null);
    assertEqual(sys.alertCheckInterval, null);
    cleanup(sys);
  });
});

describe('Weather — sun calculations', () => {
  it('calculateSunPosition returns altitude and azimuth', async () => {
    const sys = new AdvancedWeatherIntegration(createMockHomey());
    await sys.initialize();
    const pos = sys.calculateSunPosition(new Date());
    assertType(pos.altitude, 'number');
    assertType(pos.azimuth, 'number');
    assertType(pos.declination, 'number');
    cleanup(sys);
  });

  it('calculateDaylightHours returns hours object', async () => {
    const sys = new AdvancedWeatherIntegration(createMockHomey());
    await sys.initialize();
    const result = sys.calculateDaylightHours(new Date());
    assertType(result, 'number');
    assert(result >= 0 && result <= 24, 'should be 0-24');
    cleanup(sys);
  });

  it('getSunrise returns time object', async () => {
    const sys = new AdvancedWeatherIntegration(createMockHomey());
    await sys.initialize();
    const sunrise = sys.getSunrise(new Date());
    assertType(sunrise.hours, 'number');
    assertType(sunrise.minutes, 'number');
    cleanup(sys);
  });

  it('getSunset returns time object', async () => {
    const sys = new AdvancedWeatherIntegration(createMockHomey());
    await sys.initialize();
    const sunset = sys.getSunset(new Date());
    assertType(sunset.hours, 'number');
    assertType(sunset.minutes, 'number');
    cleanup(sys);
  });

  it('getCivilTwilight returns dawn and dusk', async () => {
    const sys = new AdvancedWeatherIntegration(createMockHomey());
    await sys.initialize();
    const twilight = sys.getCivilTwilight(new Date());
    assert(twilight.dawn, 'should have dawn');
    assert(twilight.dusk, 'should have dusk');
    cleanup(sys);
  });

  it('getNauticalTwilight returns dawn and dusk', async () => {
    const sys = new AdvancedWeatherIntegration(createMockHomey());
    await sys.initialize();
    const twilight = sys.getNauticalTwilight(new Date());
    assert(twilight.dawn, 'should have dawn');
    assert(twilight.dusk, 'should have dusk');
    cleanup(sys);
  });
});

describe('Weather — frost & severe weather', () => {
  it('checkFrostRisk returns frost report', async () => {
    const sys = new AdvancedWeatherIntegration(createMockHomey());
    await sys.initialize();
    const report = sys.checkFrostRisk();
    assertType(report.riskLevel, 'string');
    assertType(report.riskScore, 'number');
    assertType(report.currentTemp, 'number');
    assert(Array.isArray(report.warnings), 'should have warnings array');
    cleanup(sys);
  });

  it('detectSevereWeather returns alerts array', async () => {
    const sys = new AdvancedWeatherIntegration(createMockHomey());
    await sys.initialize();
    const alerts = sys.detectSevereWeather();
    assert(Array.isArray(alerts), 'should be array');
    cleanup(sys);
  });
});

describe('Weather — calculations', () => {
  it('calculateWindChill returns number', async () => {
    const sys = new AdvancedWeatherIntegration(createMockHomey());
    await sys.initialize();
    const wc = sys.calculateWindChill(5, 20);
    assertType(wc, 'number');
    cleanup(sys);
  });

  it('calculateHeatIndex returns number', async () => {
    const sys = new AdvancedWeatherIntegration(createMockHomey());
    await sys.initialize();
    const hi = sys.calculateHeatIndex(35, 70);
    assertType(hi, 'number');
    cleanup(sys);
  });

  it('getSeasonProfile returns season data', async () => {
    const sys = new AdvancedWeatherIntegration(createMockHomey());
    await sys.initialize();
    const profile = sys.getSeasonProfile();
    assert(profile, 'should return profile');
    assertType(profile.avgTemp, 'number');
    assertType(profile.daylightHours, 'number');
    cleanup(sys);
  });
});

describe('Weather — automation & analytics', () => {
  it('evaluateAutomationRules returns triggered rules', async () => {
    const sys = new AdvancedWeatherIntegration(createMockHomey());
    await sys.initialize();
    const triggered = sys.evaluateAutomationRules();
    assert(Array.isArray(triggered), 'should be array');
    cleanup(sys);
  });

  it('trackIndoorCorrelation records correlation data', async () => {
    const sys = new AdvancedWeatherIntegration(createMockHomey());
    await sys.initialize();
    const result = sys.trackIndoorCorrelation('living_room', 22, 45);
    assert(result, 'should return result');
    cleanup(sys);
  });

  it('getHistoricalAnalysis returns analysis', async () => {
    const sys = new AdvancedWeatherIntegration(createMockHomey());
    await sys.initialize();
    const analysis = sys.getHistoricalAnalysis(7);
    assert(analysis, 'should return analysis');
    assertType(analysis.period, 'number');
    cleanup(sys);
  });

  it('getEnergyRecommendations returns recommendations', async () => {
    const sys = new AdvancedWeatherIntegration(createMockHomey());
    await sys.initialize();
    const recs = sys.getEnergyRecommendations();
    assert(Array.isArray(recs), 'should return recommendations array');
    cleanup(sys);
  });

  it('getStatistics returns comprehensive stats', async () => {
    const sys = new AdvancedWeatherIntegration(createMockHomey());
    await sys.initialize();
    const stats = sys.getStatistics();
    assert(stats, 'should return stats');
    assert(stats.currentWeather, 'should have current weather');
    assertType(stats.currentWeather.temperature, 'number');
    assertType(stats.daylightHours, 'number');
    cleanup(sys);
  });
});

run();
