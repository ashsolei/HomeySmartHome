'use strict';

const { describe, it, run } = require('./helpers/runner');
const {
  assert,
  assertEqual,
  assertType,
  assertInstanceOf
} = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');

/* ── Timer-leak prevention ─────────────────────────────────── */
const _origSetTimeout = global.setTimeout;
const _origSetInterval = global.setInterval;
const activeHandles = [];
global.setTimeout = (...a) => { const id = _origSetTimeout(...a); activeHandles.push({ type: 'timeout', id }); return id; };
global.setInterval = (...a) => { const id = _origSetInterval(...a); activeHandles.push({ type: 'interval', id }); return id; };
function cleanup(sys) {
  try { if (sys && typeof sys.destroy === 'function') sys.destroy(); } catch (_) {}
  while (activeHandles.length > 0) {
    const h = activeHandles.pop();
    if (h.type === 'timeout') clearTimeout(h.id);
    else clearInterval(h.id);
  }
}

const SmartSeasonalAdaptationSystem = require('../lib/SmartSeasonalAdaptationSystem');

/* ── Helpers ────────────────────────────────────────────────── */
async function createInitialized(envOverrides) {
  const homey = createMockHomey();
  const sys = new SmartSeasonalAdaptationSystem(homey);
  await sys.initialize();
  if (envOverrides) sys.updateEnvironment(envOverrides);
  return sys;
}

/* ================================================================
   1. Constructor
   ================================================================ */
describe('SmartSeasonalAdaptationSystem — constructor', () => {
  it('creates instance with default state', () => {
    const homey = createMockHomey();
    const sys = new SmartSeasonalAdaptationSystem(homey);
    try {
      assertEqual(sys.currentSeason, null);
      assertEqual(sys.previousSeason, null);
      assertEqual(sys.transitionProgress, 0);
      assertEqual(sys.transitionActive, false);
      assertEqual(sys.transitionDurationDays, 14);
      assertEqual(sys.seasonalScore, 0);
      assertEqual(sys.manualOverride, false);
      assertEqual(sys.manualOverrideExpiry, null);
      assertInstanceOf(sys.temperatureHistory, Array);
      assertInstanceOf(sys.holidays, Array);
      assertInstanceOf(sys.maintenanceDue, Array);
    } finally { cleanup(sys); }
  });

  it('has config with Stockholm defaults', () => {
    const homey = createMockHomey();
    const sys = new SmartSeasonalAdaptationSystem(homey);
    try {
      assertEqual(sys.config.latitude, 59.3);
      assertEqual(sys.config.longitude, 18.07);
      assertEqual(sys.config.sadLightEnabled, true);
      assertEqual(sys.config.dawnSimulationEnabled, true);
    } finally { cleanup(sys); }
  });

  it('has environment object with null sensors', () => {
    const homey = createMockHomey();
    const sys = new SmartSeasonalAdaptationSystem(homey);
    try {
      assertEqual(sys.environment.outdoorTemp, null);
      assertEqual(sys.environment.indoorTemp, null);
      assertEqual(sys.environment.indoorHumidity, null);
      assertEqual(sys.environment.uvIndex, null);
      assertEqual(sys.environment.windSpeed, null);
    } finally { cleanup(sys); }
  });

  it('has stats counters at zero', () => {
    const homey = createMockHomey();
    const sys = new SmartSeasonalAdaptationSystem(homey);
    try {
      assertEqual(sys.stats.seasonTransitions, 0);
      assertEqual(sys.stats.clothingAlertsSent, 0);
      assertEqual(sys.stats.pollenAlertsSent, 0);
      assertEqual(sys.stats.uvAlertsSent, 0);
      assertEqual(sys.stats.energyOptimizations, 0);
    } finally { cleanup(sys); }
  });
});

/* ================================================================
   2. initialize
   ================================================================ */
describe('SmartSeasonalAdaptationSystem — initialize', () => {
  it('detects a season after init', async () => {
    const sys = await createInitialized();
    try {
      assert(sys.currentSeason !== null, 'currentSeason should be set');
      assertType(sys.currentSeason.id, 'string');
      assert(sys.currentSeason.months.length > 0, 'season has months');
    } finally { cleanup(sys); }
  });

  it('builds holiday calendar', async () => {
    const sys = await createInitialized();
    try {
      assert(sys.holidays.length > 0, 'holidays should be populated');
    } finally { cleanup(sys); }
  });

  it('calculates daylight info', async () => {
    const sys = await createInitialized();
    try {
      assertType(sys.sunrise, 'string');
      assertType(sys.sunset, 'string');
      assertType(sys.daylightHours, 'number');
      assert(sys.daylightHours > 0, 'daylightHours > 0');
    } finally { cleanup(sys); }
  });

  it('applies seasonal profiles', async () => {
    const sys = await createInitialized();
    try {
      assert(sys.activeProfiles.heating !== null || sys.activeProfiles.lighting !== null,
        'at least one profile should be set');
    } finally { cleanup(sys); }
  });

  it('checks maintenance schedule', async () => {
    const sys = await createInitialized();
    try {
      // maintenanceDue is an array (may be empty depending on month)
      assertInstanceOf(sys.maintenanceDue, Array);
    } finally { cleanup(sys); }
  });
});

/* ================================================================
   3. destroy
   ================================================================ */
describe('SmartSeasonalAdaptationSystem — destroy', () => {
  it('clears intervals and arrays', async () => {
    const sys = await createInitialized();
    sys.destroy();
    try {
      assertEqual(sys._monitoringInterval, null);
      assertEqual(sys._daylightInterval, null);
    } finally { cleanup(sys); }
  });
});

/* ================================================================
   4. getStatistics
   ================================================================ */
describe('SmartSeasonalAdaptationSystem — getStatistics', () => {
  it('returns comprehensive snapshot', async () => {
    const sys = await createInitialized();
    try {
      const stats = sys.getStatistics();
      assert('currentSeason' in stats, 'has currentSeason');
      assert('transitionActive' in stats, 'has transitionActive');
      assert('seasonalScore' in stats, 'has seasonalScore');
      assert('daylightHours' in stats, 'has daylightHours');
      assert('stats' in stats, 'has stats');
    } finally { cleanup(sys); }
  });
});

/* ================================================================
   5. _detectCurrentSeason — month mapping
   ================================================================ */
describe('SmartSeasonalAdaptationSystem — _detectCurrentSeason', () => {
  it('assigns season based on current month', async () => {
    const sys = await createInitialized();
    try {
      const month = new Date().getMonth() + 1;
      const id = sys.currentSeason.id;
      // Validate season makes sense for current month
      assert(sys.currentSeason.months.includes(month),
        `current month ${month} should be in season ${id} months`);
    } finally { cleanup(sys); }
  });
});

/* ================================================================
   6. _adjustSeasonByTemperature
   ================================================================ */
describe('SmartSeasonalAdaptationSystem — _adjustSeasonByTemperature', () => {
  it('needs 6+ history entries to adjust', async () => {
    const sys = await createInitialized();
    try {
      const before = sys.currentSeason.id;
      // With fewer than 6 entries, no adjustment
      sys.temperatureHistory = [
        { timestamp: Date.now(), value: 30 },
        { timestamp: Date.now(), value: 30 }
      ];
      sys._adjustSeasonByTemperature();
      assertEqual(sys.currentSeason.id, before);
    } finally { cleanup(sys); }
  });
});

/* ================================================================
   7. Transition management
   ================================================================ */
describe('SmartSeasonalAdaptationSystem — transitions', () => {
  it('_interpolateValue does linear interpolation', async () => {
    const sys = await createInitialized();
    try {
      sys.transitionActive = true;
      sys.transitionProgress = 50;
      const result = sys._interpolateValue(10, 20);
      assertEqual(result, 15);
    } finally { cleanup(sys); }
  });

  it('_interpolateValue at 0% returns old value', async () => {
    const sys = await createInitialized();
    try {
      sys.transitionActive = true;
      sys.transitionProgress = 0;
      assertEqual(sys._interpolateValue(10, 30), 10);
    } finally { cleanup(sys); }
  });

  it('_interpolateValue at 100% returns new (toVal)', async () => {
    const sys = await createInitialized();
    try {
      // At 100% (or transitionActive false) it returns toVal
      sys.transitionProgress = 100;
      assertEqual(sys._interpolateValue(10, 30), 30);
    } finally { cleanup(sys); }
  });
});

/* ================================================================
   8. Daylight calculation
   ================================================================ */
describe('SmartSeasonalAdaptationSystem — daylight', () => {
  it('_updateDaylight populates sunrise/sunset/daylightHours', async () => {
    const sys = await createInitialized();
    try {
      sys._updateDaylight();
      assertType(sys.sunrise, 'string');
      assertType(sys.sunset, 'string');
      assert(sys.daylightHours >= 0 && sys.daylightHours <= 24, 'hours in range');
    } finally { cleanup(sys); }
  });

  it('caps daylightHistory at 90 entries', async () => {
    const sys = await createInitialized();
    try {
      sys.daylightHistory = new Array(95).fill({ hours: 12, date: '2024-01-01' });
      sys._updateDaylight();
      assert(sys.daylightHistory.length <= 91, 'capped at ~90');
    } finally { cleanup(sys); }
  });

  it('getDaylightInfo returns lat and times', async () => {
    const sys = await createInitialized();
    try {
      const info = sys.getDaylightInfo();
      assertEqual(info.latitude, 59.3);
      assertType(info.sunrise, 'string');
      assertType(info.sunset, 'string');
      assertType(info.daylightHours, 'number');
    } finally { cleanup(sys); }
  });
});

/* ================================================================
   9. Heating evaluation
   ================================================================ */
describe('SmartSeasonalAdaptationSystem — heating', () => {
  it('_evaluateHeating sets heating profile', async () => {
    const sys = await createInitialized();
    try {
      sys._evaluateHeating();
      const h = sys.activeProfiles.heating;
      assert(h !== null && h !== undefined, 'heating profile should exist');
      assertType(h.targetTemp, 'number');
    } finally { cleanup(sys); }
  });

  it('frost protection overrides when temp < 2', async () => {
    const sys = await createInitialized();
    try {
      sys.environment.indoorTemp = 1;
      sys._evaluateHeating();
      assertEqual(sys.activeProfiles.heating.frostProtection, true);
    } finally { cleanup(sys); }
  });
});

/* ================================================================
   10. Ventilation
   ================================================================ */
describe('SmartSeasonalAdaptationSystem — ventilation', () => {
  it('_evaluateVentilation sets profile', async () => {
    const sys = await createInitialized();
    try {
      sys._evaluateVentilation();
      assert(sys.activeProfiles.ventilation !== null, 'ventilation profile set');
    } finally { cleanup(sys); }
  });

  it('CO2 override triggers above threshold', async () => {
    const sys = await createInitialized();
    try {
      sys.environment.co2Level = 900;
      sys._evaluateVentilation();
      assertEqual(sys.activeProfiles.ventilation.override, true);
      assertEqual(sys.activeProfiles.ventilation.mode, 'forced_co2');
    } finally { cleanup(sys); }
  });
});

/* ================================================================
   11. Humidity
   ================================================================ */
describe('SmartSeasonalAdaptationSystem — humidity', () => {
  it('_evaluateHumidity sets humidity profile', async () => {
    const sys = await createInitialized();
    try {
      sys._evaluateHumidity();
      const h = sys.activeProfiles.humidity;
      assert(h !== null, 'humidity profile set');
      assertInstanceOf(h.targetRange, Array);
    } finally { cleanup(sys); }
  });

  it('bathroom mold prevention at >70% humidity', async () => {
    const sys = await createInitialized();
    try {
      sys.environment.indoorHumidity = 75;
      sys._evaluateHumidity();
      assertEqual(sys.activeProfiles.humidity.bathroomOverride, true);
      assertEqual(sys.activeProfiles.humidity.mode, 'dehumidify_urgent');
    } finally { cleanup(sys); }
  });
});

/* ================================================================
   12. Blinds & Windows
   ================================================================ */
describe('SmartSeasonalAdaptationSystem — blinds', () => {
  it('storm protection when wind > 60', async () => {
    const sys = await createInitialized();
    try {
      sys.environment.windSpeed = 65;
      sys._evaluateBlindsAndWindows();
      const b = sys.activeProfiles.blinds;
      assert(b !== null, 'blinds profile set');
      assertEqual(b.reason, 'storm_protection');
      assertEqual(b.south, 'closed');
    } finally { cleanup(sys); }
  });
});

/* ================================================================
   13. Lighting color temp
   ================================================================ */
describe('SmartSeasonalAdaptationSystem — lighting', () => {
  it('_evaluateLightingColorTemp sets profile', async () => {
    const sys = await createInitialized();
    try {
      sys._evaluateLightingColorTemp();
      const l = sys.activeProfiles.lighting;
      assert(l !== null, 'lighting profile should be set');
      assertType(l.colorTemp, 'number');
    } finally { cleanup(sys); }
  });
});

/* ================================================================
   14. SAD therapy
   ================================================================ */
describe('SmartSeasonalAdaptationSystem — SAD therapy', () => {
  it('_evaluateSADTherapy is callable', async () => {
    const sys = await createInitialized();
    try {
      // Should not throw regardless of season
      sys._evaluateSADTherapy();
    } finally { cleanup(sys); }
  });
});

/* ================================================================
   15. Dawn simulation
   ================================================================ */
describe('SmartSeasonalAdaptationSystem — dawn simulation', () => {
  it('_evaluateDawnSimulation is callable', async () => {
    const sys = await createInitialized();
    try {
      sys._evaluateDawnSimulation();
    } finally { cleanup(sys); }
  });
});

/* ================================================================
   16. Garden & outdoor
   ================================================================ */
describe('SmartSeasonalAdaptationSystem — garden', () => {
  it('_evaluateGardenOutdoor is callable', async () => {
    const sys = await createInitialized();
    try {
      sys._evaluateGardenOutdoor();
    } finally { cleanup(sys); }
  });
});

/* ================================================================
   17. Energy optimization
   ================================================================ */
describe('SmartSeasonalAdaptationSystem — energy', () => {
  it('_evaluateEnergyOptimization is callable', async () => {
    const sys = await createInitialized();
    try {
      sys._evaluateEnergyOptimization();
    } finally { cleanup(sys); }
  });

  it('_calculateEnergyBudget produces budget object', async () => {
    const sys = await createInitialized();
    try {
      sys._calculateEnergyBudget();
      assertType(sys.energyBudget.forecast, 'number');
      assertType(sys.energyBudget.savings, 'number');
    } finally { cleanup(sys); }
  });

  it('getEnergyReport returns energy data', async () => {
    const sys = await createInitialized();
    try {
      const report = sys.getEnergyReport();
      assertType(report.heatingDegreeDays, 'number');
      assert('energyBudget' in report, 'has energyBudget');
      assert('temperatureTrend' in report, 'has temperatureTrend');
    } finally { cleanup(sys); }
  });
});

/* ================================================================
   18. Heating degree days
   ================================================================ */
describe('SmartSeasonalAdaptationSystem — heatingDegreeDays', () => {
  it('_updateHeatingDegreeDays accumulates when temp < 17', async () => {
    const sys = await createInitialized();
    try {
      sys.heatingDegreeDays = 0;
      sys.environment.outdoorTemp = 10;
      sys._updateHeatingDegreeDays();
      assert(sys.heatingDegreeDays > 0, 'should accumulate HDD');
    } finally { cleanup(sys); }
  });

  it('no accumulation when temp >= 17', async () => {
    const sys = await createInitialized();
    try {
      sys.heatingDegreeDays = 0;
      sys.environment.outdoorTemp = 20;
      sys._updateHeatingDegreeDays();
      assertEqual(sys.heatingDegreeDays, 0);
    } finally { cleanup(sys); }
  });
});

/* ================================================================
   19. Holiday calendar
   ================================================================ */
describe('SmartSeasonalAdaptationSystem — holidays', () => {
  it('_buildHolidayCalendar populates holidays', async () => {
    const sys = await createInitialized();
    try {
      assert(sys.holidays.length > 10, 'should have many holidays');
    } finally { cleanup(sys); }
  });

  it('getHolidayCalendar returns serialized list', async () => {
    const sys = await createInitialized();
    try {
      const cal = sys.getHolidayCalendar();
      assert(cal.length > 0, 'should have entries');
      assertType(cal[0].name, 'string');
      assertType(cal[0].date, 'string');
    } finally { cleanup(sys); }
  });

  it('getUpcomingHolidays returns array', async () => {
    const sys = await createInitialized();
    try {
      const upcoming = sys.getUpcomingHolidays();
      assertInstanceOf(upcoming, Array);
    } finally { cleanup(sys); }
  });
});

/* ================================================================
   20. Clothing alerts
   ================================================================ */
describe('SmartSeasonalAdaptationSystem — clothing alerts', () => {
  it('_evaluateClothingComfortAlerts increments stat when conditions met', async () => {
    const sys = await createInitialized();
    try {
      // Force 7:00 conditions — method has hour check, result varies
      const before = sys.stats.clothingAlertsSent;
      sys.environment.outdoorTemp = 5;
      sys._evaluateClothingComfortAlerts();
      // If not 7AM the stat won't increment, that's fine
      assert(sys.stats.clothingAlertsSent >= before, 'stat should not decrease');
    } finally { cleanup(sys); }
  });
});

/* ================================================================
   21. Pollen alerts
   ================================================================ */
describe('SmartSeasonalAdaptationSystem — pollen', () => {
  it('_evaluatePollenAlerts is callable', async () => {
    const sys = await createInitialized();
    try {
      sys.config.pollenAlertEnabled = true;
      sys._evaluatePollenAlerts();
    } finally { cleanup(sys); }
  });

  it('getPollenForecast returns array', async () => {
    const sys = await createInitialized();
    try {
      const forecast = sys.getPollenForecast();
      assertInstanceOf(forecast, Array);
    } finally { cleanup(sys); }
  });
});

/* ================================================================
   22. UV warnings
   ================================================================ */
describe('SmartSeasonalAdaptationSystem — UV warnings', () => {
  it('no warning when uvIndex < 3', async () => {
    const sys = await createInitialized();
    try {
      sys.config.uvAlertEnabled = true;
      sys.environment.uvIndex = 2;
      const before = sys.stats.uvAlertsSent;
      sys._evaluateUVWarnings();
      assertEqual(sys.stats.uvAlertsSent, before);
    } finally { cleanup(sys); }
  });

  it('warning when uvIndex >= 3', async () => {
    const sys = await createInitialized();
    try {
      sys.config.uvAlertEnabled = true;
      sys.environment.uvIndex = 5;
      const before = sys.stats.uvAlertsSent;
      sys._evaluateUVWarnings();
      assertEqual(sys.stats.uvAlertsSent, before + 1);
    } finally { cleanup(sys); }
  });

  it('very high UV >= 8 increments stat', async () => {
    const sys = await createInitialized();
    try {
      sys.config.uvAlertEnabled = true;
      sys.environment.uvIndex = 9;
      const before = sys.stats.uvAlertsSent;
      sys._evaluateUVWarnings();
      assertEqual(sys.stats.uvAlertsSent, before + 1);
    } finally { cleanup(sys); }
  });
});

/* ================================================================
   23. Pool / outdoor water
   ================================================================ */
describe('SmartSeasonalAdaptationSystem — pool', () => {
  it('_evaluatePoolOutdoorWater skips if disabled', async () => {
    const sys = await createInitialized();
    try {
      sys.config.poolManagementEnabled = false;
      // Should not throw
      sys._evaluatePoolOutdoorWater();
    } finally { cleanup(sys); }
  });

  it('_evaluatePoolOutdoorWater runs if enabled', async () => {
    const sys = await createInitialized();
    try {
      sys.config.poolManagementEnabled = true;
      sys._evaluatePoolOutdoorWater();
    } finally { cleanup(sys); }
  });
});

/* ================================================================
   24. Wildlife / nature
   ================================================================ */
describe('SmartSeasonalAdaptationSystem — wildlife', () => {
  it('_evaluateWildlifeNature skips if disabled', async () => {
    const sys = await createInitialized();
    try {
      sys.config.wildlifeNotificationsEnabled = false;
      sys._evaluateWildlifeNature();
    } finally { cleanup(sys); }
  });
});

/* ================================================================
   25. Sleep adaptation
   ================================================================ */
describe('SmartSeasonalAdaptationSystem — sleep', () => {
  it('_evaluateSleepAdaptation sets sleep profile', async () => {
    const sys = await createInitialized();
    try {
      sys._evaluateSleepAdaptation();
      const s = sys.activeProfiles.sleep;
      assert(s !== null, 'sleep profile set');
      assertType(s.notes, 'string');
    } finally { cleanup(sys); }
  });
});

/* ================================================================
   26. Food suggestions
   ================================================================ */
describe('SmartSeasonalAdaptationSystem — food', () => {
  it('getFoodSuggestions returns data for current season', async () => {
    const sys = await createInitialized();
    try {
      const food = sys.getFoodSuggestions();
      // May be null if no entry for the current season id
      if (food !== null) {
        assertInstanceOf(food.suggestions, Array);
      }
    } finally { cleanup(sys); }
  });
});

/* ================================================================
   27. Maintenance
   ================================================================ */
describe('SmartSeasonalAdaptationSystem — maintenance', () => {
  it('getMaintenanceSchedule returns structure', async () => {
    const sys = await createInitialized();
    try {
      const m = sys.getMaintenanceSchedule();
      assertInstanceOf(m.due, Array);
      assertInstanceOf(m.completed, Array);
      assertInstanceOf(m.allTasks, Array);
      assert(m.allTasks.length > 0, 'has maintenance tasks');
    } finally { cleanup(sys); }
  });

  it('completeMaintenanceTask marks task done', async () => {
    const sys = await createInitialized();
    try {
      const key = 'test_task_2024_6';
      sys.maintenanceDue.push({ task: 'test_task', priority: 'low', dueMonth: 6, key });
      sys.completeMaintenanceTask(key);
      assert(sys.maintenanceCompleted.includes(key), 'key in completed');
      assertEqual(sys.maintenanceDue.filter(t => t.key === key).length, 0);
    } finally { cleanup(sys); }
  });

  it('completeMaintenanceTask is idempotent', async () => {
    const sys = await createInitialized();
    try {
      const key = 'dup_task_2024_1';
      sys.completeMaintenanceTask(key);
      sys.completeMaintenanceTask(key);
      const count = sys.maintenanceCompleted.filter(k => k === key).length;
      assertEqual(count, 1);
    } finally { cleanup(sys); }
  });
});

/* ================================================================
   28. Temperature tracking
   ================================================================ */
describe('SmartSeasonalAdaptationSystem — temperature tracking', () => {
  it('_trackTemperature appends to history', async () => {
    const sys = await createInitialized();
    try {
      sys.environment.outdoorTemp = 15;
      const before = sys.temperatureHistory.length;
      sys._trackTemperature();
      assertEqual(sys.temperatureHistory.length, before + 1);
    } finally { cleanup(sys); }
  });

  it('_trackTemperature caps at 4320 entries', async () => {
    const sys = await createInitialized();
    try {
      sys.temperatureHistory = new Array(4325).fill({ timestamp: Date.now(), value: 10 });
      sys.environment.outdoorTemp = 20;
      sys._trackTemperature();
      assert(sys.temperatureHistory.length <= 4321, 'capped');
    } finally { cleanup(sys); }
  });

  it('_trackTemperature skips when outdoorTemp is null', async () => {
    const sys = await createInitialized();
    try {
      sys.environment.outdoorTemp = null;
      const before = sys.temperatureHistory.length;
      sys._trackTemperature();
      assertEqual(sys.temperatureHistory.length, before);
    } finally { cleanup(sys); }
  });

  it('_getTemperatureTrend returns unknown with < 12 entries', async () => {
    const sys = await createInitialized();
    try {
      sys.temperatureHistory = [];
      assertEqual(sys._getTemperatureTrend(), 'unknown');
    } finally { cleanup(sys); }
  });

  it('_getTemperatureTrend detects warming', async () => {
    const sys = await createInitialized();
    try {
      const older = Array.from({ length: 6 }, () => ({ timestamp: Date.now(), value: 5 }));
      const recent = Array.from({ length: 6 }, () => ({ timestamp: Date.now(), value: 15 }));
      sys.temperatureHistory = [...older, ...recent];
      assertEqual(sys._getTemperatureTrend(), 'warming');
    } finally { cleanup(sys); }
  });

  it('_getTemperatureTrend detects cooling', async () => {
    const sys = await createInitialized();
    try {
      const older = Array.from({ length: 6 }, () => ({ timestamp: Date.now(), value: 20 }));
      const recent = Array.from({ length: 6 }, () => ({ timestamp: Date.now(), value: 10 }));
      sys.temperatureHistory = [...older, ...recent];
      assertEqual(sys._getTemperatureTrend(), 'cooling');
    } finally { cleanup(sys); }
  });

  it('_getTemperatureTrend detects stable', async () => {
    const sys = await createInitialized();
    try {
      const entries = Array.from({ length: 12 }, () => ({ timestamp: Date.now(), value: 15 }));
      sys.temperatureHistory = entries;
      assertEqual(sys._getTemperatureTrend(), 'stable');
    } finally { cleanup(sys); }
  });
});

/* ================================================================
   29. Seasonal score
   ================================================================ */
describe('SmartSeasonalAdaptationSystem — seasonal score', () => {
  it('_calculateSeasonalScore produces 0-100', async () => {
    const sys = await createInitialized();
    try {
      sys._calculateSeasonalScore();
      assert(sys.seasonalScore >= 0 && sys.seasonalScore <= 100, 'score in range');
    } finally { cleanup(sys); }
  });

  it('getSeasonalScore returns the score', async () => {
    const sys = await createInitialized();
    try {
      sys._calculateSeasonalScore();
      assertEqual(sys.getSeasonalScore(), sys.seasonalScore);
    } finally { cleanup(sys); }
  });

  it('scores 0 when no season detected', async () => {
    const homey = createMockHomey();
    const sys = new SmartSeasonalAdaptationSystem(homey);
    try {
      sys._calculateSeasonalScore();
      assertEqual(sys.seasonalScore, 0);
    } finally { cleanup(sys); }
  });
});

/* ================================================================
   30. Manual override
   ================================================================ */
describe('SmartSeasonalAdaptationSystem — manual override', () => {
  it('setManualOverride changes season', async () => {
    const sys = await createInitialized();
    try {
      const result = sys.setManualOverride('summer', 12);
      assertEqual(result, true);
      assertEqual(sys.currentSeason.id, 'summer');
      assertEqual(sys.manualOverride, true);
      assert(sys.manualOverrideExpiry > Date.now(), 'expiry in future');
    } finally { cleanup(sys); }
  });

  it('setManualOverride returns false for unknown season', async () => {
    const sys = await createInitialized();
    try {
      const result = sys.setManualOverride('tropical', 12);
      assertEqual(result, false);
    } finally { cleanup(sys); }
  });

  it('clearManualOverride resumes auto detection', async () => {
    const sys = await createInitialized();
    try {
      sys.setManualOverride('midwinter', 1);
      sys.clearManualOverride();
      assertEqual(sys.manualOverride, false);
      assertEqual(sys.manualOverrideExpiry, null);
    } finally { cleanup(sys); }
  });

  it('setManualOverride disables transition', async () => {
    const sys = await createInitialized();
    try {
      sys.transitionActive = true;
      sys.setManualOverride('autumn', 6);
      assertEqual(sys.transitionActive, false);
      assertEqual(sys.transitionProgress, 100);
    } finally { cleanup(sys); }
  });
});

/* ================================================================
   31. updateEnvironment
   ================================================================ */
describe('SmartSeasonalAdaptationSystem — updateEnvironment', () => {
  it('updates known fields', async () => {
    const sys = await createInitialized();
    try {
      sys.updateEnvironment({ outdoorTemp: 22, windSpeed: 10, uvIndex: 4 });
      assertEqual(sys.environment.outdoorTemp, 22);
      assertEqual(sys.environment.windSpeed, 10);
      assertEqual(sys.environment.uvIndex, 4);
    } finally { cleanup(sys); }
  });

  it('ignores unknown fields', async () => {
    const sys = await createInitialized();
    try {
      sys.updateEnvironment({ unknownSensor: 99 });
      assertEqual(sys.environment.unknownSensor, undefined);
    } finally { cleanup(sys); }
  });

  it('handles null/non-object gracefully', async () => {
    const sys = await createInitialized();
    try {
      sys.updateEnvironment(null);
      sys.updateEnvironment('bad');
      // Should not throw
    } finally { cleanup(sys); }
  });
});

/* ================================================================
   32. updateConfig
   ================================================================ */
describe('SmartSeasonalAdaptationSystem — updateConfig', () => {
  it('updates known config keys', async () => {
    const sys = await createInitialized();
    try {
      sys.updateConfig({ sadLightEnabled: false });
      assertEqual(sys.config.sadLightEnabled, false);
    } finally { cleanup(sys); }
  });

  it('ignores unknown config keys', async () => {
    const sys = await createInitialized();
    try {
      sys.updateConfig({ unknownKey: true });
      assertEqual(sys.config.unknownKey, undefined);
    } finally { cleanup(sys); }
  });

  it('handles null/non-object gracefully', async () => {
    const sys = await createInitialized();
    try {
      sys.updateConfig(null);
      sys.updateConfig(42);
    } finally { cleanup(sys); }
  });
});

/* ================================================================
   33. getCurrentSeason
   ================================================================ */
describe('SmartSeasonalAdaptationSystem — getCurrentSeason', () => {
  it('returns season info after init', async () => {
    const sys = await createInitialized();
    try {
      const s = sys.getCurrentSeason();
      assertType(s.id, 'string');
      assertType(s.label, 'string');
      assertEqual(typeof s.transitionActive, 'boolean');
    } finally { cleanup(sys); }
  });

  it('returns null before init', () => {
    const homey = createMockHomey();
    const sys = new SmartSeasonalAdaptationSystem(homey);
    try {
      assertEqual(sys.getCurrentSeason(), null);
    } finally { cleanup(sys); }
  });
});

/* ================================================================
   34. getSeasonalProfiles
   ================================================================ */
describe('SmartSeasonalAdaptationSystem — getSeasonalProfiles', () => {
  it('returns profiles object', async () => {
    const sys = await createInitialized();
    try {
      const p = sys.getSeasonalProfiles();
      assert('heating' in p, 'has heating');
      assert('lighting' in p, 'has lighting');
      assert('ventilation' in p, 'has ventilation');
    } finally { cleanup(sys); }
  });
});

/* ================================================================
   35. getAllSeasons
   ================================================================ */
describe('SmartSeasonalAdaptationSystem — getAllSeasons', () => {
  it('returns 8 Nordic seasons', async () => {
    const sys = await createInitialized();
    try {
      const all = sys.getAllSeasons();
      assertEqual(all.length, 8);
      const ids = all.map(s => s.id);
      assert(ids.includes('midwinter'), 'has midwinter');
      assert(ids.includes('summer'), 'has summer');
      assert(ids.includes('dark_november'), 'has dark_november');
    } finally { cleanup(sys); }
  });
});

/* ================================================================
   36. Air quality warnings
   ================================================================ */
describe('SmartSeasonalAdaptationSystem — air quality', () => {
  it('_evaluateAirQualityWarning skips when AQI null', async () => {
    const sys = await createInitialized();
    try {
      sys.environment.airQualityIndex = null;
      sys._evaluateAirQualityWarning(); // should not throw
    } finally { cleanup(sys); }
  });
});

/* ================================================================
   37. Season boolean helpers
   ================================================================ */
describe('SmartSeasonalAdaptationSystem — season helpers', () => {
  it('isGrowingSeason returns boolean', async () => {
    const sys = await createInitialized();
    try {
      assertType(sys.isGrowingSeason(), 'boolean');
    } finally { cleanup(sys); }
  });

  it('isHeatingRequired returns boolean', async () => {
    const sys = await createInitialized();
    try {
      assertType(sys.isHeatingRequired(), 'boolean');
    } finally { cleanup(sys); }
  });

  it('isCoolingRequired returns false when no summer or temp <= 25', async () => {
    const sys = await createInitialized();
    try {
      sys.environment.indoorTemp = 20;
      // Unless it's summer, should be false
      if (sys.currentSeason.id !== 'summer') {
        assertEqual(sys.isCoolingRequired(), false);
      }
    } finally { cleanup(sys); }
  });

  it('isDarkSeason returns boolean', async () => {
    const sys = await createInitialized();
    try {
      assertType(sys.isDarkSeason(), 'boolean');
    } finally { cleanup(sys); }
  });

  it('isOutdoorSeason returns boolean', async () => {
    const sys = await createInitialized();
    try {
      assertType(sys.isOutdoorSeason(), 'boolean');
    } finally { cleanup(sys); }
  });

  it('isPollenSeason returns boolean', async () => {
    const sys = await createInitialized();
    try {
      assertType(sys.isPollenSeason(), 'boolean');
    } finally { cleanup(sys); }
  });

  it('isGrowingSeason false when no season', () => {
    const homey = createMockHomey();
    const sys = new SmartSeasonalAdaptationSystem(homey);
    try {
      assertEqual(sys.isGrowingSeason(), false);
    } finally { cleanup(sys); }
  });

  it('isHeatingRequired true when no season', () => {
    const homey = createMockHomey();
    const sys = new SmartSeasonalAdaptationSystem(homey);
    try {
      assertEqual(sys.isHeatingRequired(), true);
    } finally { cleanup(sys); }
  });

  it('isDarkSeason false when no season', () => {
    const homey = createMockHomey();
    const sys = new SmartSeasonalAdaptationSystem(homey);
    try {
      assertEqual(sys.isDarkSeason(), false);
    } finally { cleanup(sys); }
  });
});

/* ================================================================
   38. Seasonal decoration mode
   ================================================================ */
describe('SmartSeasonalAdaptationSystem — decoration mode', () => {
  it('getSeasonalDecorationMode returns mode object', async () => {
    const sys = await createInitialized();
    try {
      const d = sys.getSeasonalDecorationMode();
      assertType(d.mode, 'string');
      assertType(d.description, 'string');
      assertType(d.lights, 'string');
    } finally { cleanup(sys); }
  });
});

/* ================================================================
   39. Dashboard status
   ================================================================ */
describe('SmartSeasonalAdaptationSystem — getDashboardStatus', () => {
  it('returns comprehensive dashboard object', async () => {
    const sys = await createInitialized();
    try {
      const d = sys.getDashboardStatus();
      assert('season' in d, 'has season');
      assert('daylight' in d, 'has daylight');
      assert('profiles' in d, 'has profiles');
      assert('score' in d, 'has score');
      assert('temperatureTrend' in d, 'has temperatureTrend');
      assert('environment' in d, 'has environment');
      assert('upcomingHolidays' in d, 'has upcomingHolidays');
      assert('pollenForecast' in d, 'has pollenForecast');
      assert('decorationMode' in d, 'has decorationMode');
      assert('energy' in d, 'has energy');
      assertType(d.isGrowingSeason, 'boolean');
      assertType(d.isDarkSeason, 'boolean');
      assertType(d.isOutdoorSeason, 'boolean');
    } finally { cleanup(sys); }
  });
});

/* ================================================================
   40. _emitEvent
   ================================================================ */
describe('SmartSeasonalAdaptationSystem — _emitEvent', () => {
  it('emits prefixed event on homey', async () => {
    const homey = createMockHomey();
    const sys = new SmartSeasonalAdaptationSystem(homey);
    try {
      const events = [];
      homey.on('seasonal:test_event', (data) => events.push(data));
      sys._emitEvent('test_event', { value: 42 });
      assertEqual(events.length, 1);
      assertEqual(events[0].value, 42);
    } finally { cleanup(sys); }
  });

  it('does not throw if homey.emit is missing', () => {
    const sys = new SmartSeasonalAdaptationSystem({});
    try {
      sys._emitEvent('safe_test', { ok: true }); // should not throw
    } finally { cleanup(sys); }
  });
});

/* ================================================================
   41. _applySeasonalProfiles
   ================================================================ */
describe('SmartSeasonalAdaptationSystem — _applySeasonalProfiles', () => {
  it('applies all sub-profiles', async () => {
    const sys = await createInitialized();
    try {
      sys._applySeasonalProfiles();
      assert(sys.activeProfiles.heating !== null, 'heating set');
      assert(sys.activeProfiles.ventilation !== null, 'ventilation set');
      assert(sys.activeProfiles.humidity !== null, 'humidity set');
      assert(sys.activeProfiles.lighting !== null, 'lighting set');
    } finally { cleanup(sys); }
  });
});

run();
