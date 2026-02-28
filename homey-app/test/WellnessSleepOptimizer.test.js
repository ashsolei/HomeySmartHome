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

const WellnessSleepOptimizer = require('../lib/WellnessSleepOptimizer');

function mockHomeyWithDrivers() {
  return createMockHomey({ drivers: { getDevices() { return []; } } });
}

describe('Sleep — constructor & lifecycle', () => {
  it('instantiates without errors', () => {
    const sys = new WellnessSleepOptimizer(mockHomeyWithDrivers());
    assert(sys, 'should create instance');
    assertEqual(sys.optimalBedtime, '22:30');
    assertEqual(sys.optimalWakeTime, '07:00');
    assertEqual(sys.idealSleepHours, 8);
    cleanup(sys);
  });

  it('initialize loads settings and starts monitoring', async () => {
    const sys = new WellnessSleepOptimizer(mockHomeyWithDrivers());
    await sys.initialize();
    assert(sys.windDownStages.length > 0, 'should have wind-down stages');
    assert(sys.morningRoutineStages.length > 0, 'should have morning routine stages');
    cleanup(sys);
  });

  it('destroy clears timers and intervals', async () => {
    const sys = new WellnessSleepOptimizer(mockHomeyWithDrivers());
    await sys.initialize();
    sys.destroy();
    assertEqual(sys.monitoringInterval, null);
    assertEqual(sys.activeRoutineTimers.length, 0);
    cleanup(sys);
  });
});

describe('Sleep — sleep cycle estimation', () => {
  it('estimateSleepPhases returns cycle data for 8 hours', () => {
    const sys = new WellnessSleepOptimizer(mockHomeyWithDrivers());
    const result = sys.estimateSleepPhases(8);
    assertType(result.totalCycles, 'number');
    assert(result.totalCycles >= 4, 'should have at least 4 cycles for 8h');
    assert(Array.isArray(result.phases), 'should have phases array');
    assertType(result.totalDeepMin, 'number');
    assertType(result.totalRemMin, 'number');
    assertType(result.totalLightMin, 'number');
    cleanup(sys);
  });

  it('estimateSleepPhases returns fewer cycles for short sleep', () => {
    const sys = new WellnessSleepOptimizer(mockHomeyWithDrivers());
    const result = sys.estimateSleepPhases(3);
    assert(result.totalCycles <= 2, 'should have 2 or fewer cycles for 3h');
    cleanup(sys);
  });

  it('findLightSleepWindow returns optimal wake time', () => {
    const sys = new WellnessSleepOptimizer(mockHomeyWithDrivers());
    const tomorrow7am = new Date();
    tomorrow7am.setDate(tomorrow7am.getDate() + 1);
    tomorrow7am.setHours(7, 0, 0, 0);
    const result = sys.findLightSleepWindow(tomorrow7am.toISOString());
    assert(result, 'should return result');
    assert(result.optimalWakeTime, 'should have optimalWakeTime');
    assert(result.phase, 'should have phase');
    cleanup(sys);
  });
});

describe('Sleep — circadian rhythm', () => {
  it('analyzeCircadianRhythm returns insufficient_data with no sessions', () => {
    const sys = new WellnessSleepOptimizer(mockHomeyWithDrivers());
    const result = sys.analyzeCircadianRhythm();
    assertEqual(result.status, 'insufficient_data');
    assert(result.recommendations.length > 0, 'should have recommendations');
    cleanup(sys);
  });

  it('analyzeCircadianRhythm returns analysis with enough data', () => {
    const sys = new WellnessSleepOptimizer(mockHomeyWithDrivers());
    for (let i = 0; i < 5; i++) {
      sys.sleepQualityData.push({
        date: `2026-02-${20 + i}`,
        duration: 7.5,
        quality: 75,
        bedtime: '22:30',
        wakeTime: '06:00'
      });
    }
    const result = sys.analyzeCircadianRhythm();
    assert(result.chronotype, 'should have chronotype');
    assert(result.averageBedtime, 'should have averageBedtime');
    assertType(result.consistency, 'number');
    assertType(result.averageQuality, 'number');
    cleanup(sys);
  });
});

describe('Sleep — smart alarm', () => {
  it('setSmartAlarm creates an alarm', async () => {
    const sys = new WellnessSleepOptimizer(mockHomeyWithDrivers());
    const tomorrow7am = new Date();
    tomorrow7am.setDate(tomorrow7am.getDate() + 1);
    tomorrow7am.setHours(7, 0, 0, 0);
    const alarm = await sys.setSmartAlarm('user-1', tomorrow7am.toISOString());
    assert(alarm, 'should return alarm');
    assert(alarm.id, 'should have id');
    assertEqual(alarm.userId, 'user-1');
    assertEqual(alarm.enabled, true);
    assertEqual(alarm.snoozeCount, 0);
    cleanup(sys);
  });

  it('snoozeAlarm returns null for unknown alarm', async () => {
    const sys = new WellnessSleepOptimizer(mockHomeyWithDrivers());
    const result = await sys.snoozeAlarm('nonexistent');
    assertEqual(result, null);
    cleanup(sys);
  });

  it('snoozeAlarm snoozes within limit', async () => {
    const sys = new WellnessSleepOptimizer(mockHomeyWithDrivers());
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(7, 0, 0, 0);
    const alarm = await sys.setSmartAlarm('user-1', tomorrow.toISOString(), { maxSnooze: 2 });
    const result = await sys.snoozeAlarm(alarm.id);
    assert(result, 'should return result');
    assertEqual(result.snoozed, true);
    assertEqual(result.snoozeCount, 1);
    cleanup(sys);
  });
});

describe('Sleep — sleep debt', () => {
  it('calculateSleepDebt returns healthy message with no data', () => {
    const sys = new WellnessSleepOptimizer(mockHomeyWithDrivers());
    const result = sys.calculateSleepDebt(7);
    assertEqual(result.totalDebtHours, 0);
    assert(result.recoveryRecommendations.length > 0, 'should have recommendations');
    cleanup(sys);
  });

  it('calculateSleepDebt detects debt with short sleep', () => {
    const sys = new WellnessSleepOptimizer(mockHomeyWithDrivers());
    for (let i = 0; i < 7; i++) {
      sys.sleepQualityData.push({ date: `2026-02-${20 + i}`, duration: 5, quality: 50 });
    }
    const result = sys.calculateSleepDebt(7);
    assert(result.totalDebtHours > 0, 'should have debt');
    assertEqual(result.dailyDebts.length, 7);
    cleanup(sys);
  });
});

describe('Sleep — reports', () => {
  it('generateSleepReport returns no_data without sessions', () => {
    const sys = new WellnessSleepOptimizer(mockHomeyWithDrivers());
    const report = sys.generateSleepReport('weekly');
    assertEqual(report.status, 'no_data');
    cleanup(sys);
  });

  it('generateSleepReport returns report with data', () => {
    const sys = new WellnessSleepOptimizer(mockHomeyWithDrivers());
    for (let i = 0; i < 7; i++) {
      sys.sleepQualityData.push({
        date: `2026-02-${20 + i}`,
        duration: 7 + Math.random(),
        quality: 60 + Math.floor(Math.random() * 30),
        bedtime: '22:30',
        wakeTime: '06:00'
      });
    }
    const report = sys.generateSleepReport('weekly');
    assertEqual(report.period, 'weekly');
    assertType(report.averageQuality, 'number');
    assertType(report.averageDuration, 'number');
    assert(report.bestNight, 'should have bestNight');
    assert(report.worstNight, 'should have worstNight');
    assert(report.recommendations.length > 0, 'should have recommendations');
    cleanup(sys);
  });
});

describe('Sleep — partner mode', () => {
  it('configurePartnerProfile creates a profile', async () => {
    const sys = new WellnessSleepOptimizer(mockHomeyWithDrivers());
    const profile = await sys.configurePartnerProfile('partner-1', {
      name: 'Anna',
      bedtime: '23:00',
      wakeTime: '07:00'
    });
    assert(profile, 'should return profile');
    assertEqual(profile.name, 'Anna');
    assertEqual(profile.bedtime, '23:00');
    cleanup(sys);
  });

  it('partner mode activates with 2+ profiles', async () => {
    const sys = new WellnessSleepOptimizer(mockHomeyWithDrivers());
    await sys.configurePartnerProfile('p1', { name: 'Erik' });
    await sys.configurePartnerProfile('p2', { name: 'Anna' });
    assertEqual(sys.partnerMode, true);
    cleanup(sys);
  });
});

describe('Sleep — wearable data', () => {
  it('simulateWearableData returns data with expected fields', () => {
    const sys = new WellnessSleepOptimizer(mockHomeyWithDrivers());
    const data = sys.simulateWearableData();
    assertType(data.heartRate, 'number');
    assertType(data.hrv, 'number');
    assertType(data.spo2, 'number');
    assertType(data.movement, 'number');
    assertEqual(sys.heartRateHistory.length, 1);
    cleanup(sys);
  });

  it('getRestingHeartRate returns null with no data', () => {
    const sys = new WellnessSleepOptimizer(mockHomeyWithDrivers());
    assertEqual(sys.getRestingHeartRate(), null);
    cleanup(sys);
  });
});

describe('Sleep — statistics', () => {
  it('getStatistics returns comprehensive stats', () => {
    const sys = new WellnessSleepOptimizer(mockHomeyWithDrivers());
    const stats = sys.getStatistics();
    assertEqual(stats.optimalBedtime, '22:30');
    assertEqual(stats.optimalWakeTime, '07:00');
    assertType(stats.sleepSessions, 'number');
    assertType(stats.sleepDebtHours, 'number');
    assertEqual(stats.partnerMode, false);
    assertEqual(stats.whiteNoiseActive, false);
    cleanup(sys);
  });
});

describe('Sleep — helper methods', () => {
  it('calculateAverageTime computes average', () => {
    const sys = new WellnessSleepOptimizer(mockHomeyWithDrivers());
    const avg = sys.calculateAverageTime(['22:00', '23:00']);
    assert(avg, 'should return a time string');
    assert(avg.includes(':'), 'should be in HH:MM format');
    cleanup(sys);
  });

  it('calculateTrend returns 0 for single value', () => {
    const sys = new WellnessSleepOptimizer(mockHomeyWithDrivers());
    assertEqual(sys.calculateTrend([5]), 0);
    cleanup(sys);
  });

  it('kelvinToHomey converts within bounds', () => {
    const sys = new WellnessSleepOptimizer(mockHomeyWithDrivers());
    assertEqual(sys.kelvinToHomey(2000), 0);
    const mid = sys.kelvinToHomey(4250);
    assert(mid > 0 && mid < 1, 'mid value should be between 0 and 1');
    cleanup(sys);
  });
});

run();
