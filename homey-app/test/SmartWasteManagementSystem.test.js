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

const SmartWasteManagementSystem = require('../lib/SmartWasteManagementSystem');

function makeHomey() {
  return createMockHomey({
    devices: { getDevices: async () => ({}) }
  });
}

/* ═══════════════════════════════════════════════════════════
   SmartWasteManagementSystem – Test Suite
   ═══════════════════════════════════════════════════════════ */

describe('SmartWasteManagementSystem — constructor', () => {
  it('creates instance with default state', () => {
    const sys = new SmartWasteManagementSystem(makeHomey());
    assertType(sys.bins, 'object');
    assertType(sys.categories, 'object');
    assertEqual(sys.initialized, false);
    assertEqual(sys.wasteLog.length, 0);
    cleanup(sys);
  });
});

describe('SmartWasteManagementSystem — initialize', () => {
  it('initializes all subsystems', async () => {
    const sys = new SmartWasteManagementSystem(makeHomey());
    await sys.initialize();
    assertEqual(sys.initialized, true);
    assertEqual(sys.categories.size, 8);
    assertEqual(sys.bins.size, 8);
    assertEqual(sys.collectionCalendar.size, 8);
    assert(sys.gamification.members.size >= 3, 'should have household members');
    cleanup(sys);
  });

  it('does not throw when device discovery fails', async () => {
    const homey = createMockHomey({
      devices: { getDevices: async () => { throw new Error('no devices'); } }
    });
    const sys = new SmartWasteManagementSystem(homey);
    await sys.initialize();
    assertEqual(sys.initialized, true);
    cleanup(sys);
  });
});

describe('SmartWasteManagementSystem — categories', () => {
  it('has 8 waste categories', async () => {
    const sys = new SmartWasteManagementSystem(makeHomey());
    await sys.initialize();
    assertEqual(sys.categories.size, 8);
    const keys = Array.from(sys.categories.keys());
    assert(keys.includes('paper'), 'should have paper');
    assert(keys.includes('plastic'), 'should have plastic');
    assert(keys.includes('glass'), 'should have glass');
    assert(keys.includes('metal'), 'should have metal');
    assert(keys.includes('organic'), 'should have organic');
    assert(keys.includes('electronics'), 'should have electronics');
    assert(keys.includes('hazardous'), 'should have hazardous');
    assert(keys.includes('general'), 'should have general');
    cleanup(sys);
  });

  it('each category has required fields', async () => {
    const sys = new SmartWasteManagementSystem(makeHomey());
    await sys.initialize();
    for (const [, cat] of sys.categories) {
      assertType(cat.id, 'string');
      assertType(cat.name, 'string');
      assertType(cat.color, 'string');
      assertType(cat.avgDensityKgPerLiter, 'number');
      assert(Array.isArray(cat.tips), 'should have tips array');
    }
    cleanup(sys);
  });
});

describe('SmartWasteManagementSystem — addWaste', () => {
  it('adds waste to correct bin', async () => {
    const sys = new SmartWasteManagementSystem(makeHomey());
    await sys.initialize();
    const result = sys.addWaste('paper', 10, 'parent1');
    assertEqual(result.success, true);
    assertEqual(result.category, 'paper');
    assert(result.volumeAdded > 0, 'should have added volume');
    assert(result.weightKg > 0, 'should have weight');
    assertType(result.binFillPercentage, 'number');
    assertType(result.carbonImpactKg, 'number');
    cleanup(sys);
  });

  it('returns failure for unknown category', async () => {
    const sys = new SmartWasteManagementSystem(makeHomey());
    await sys.initialize();
    const result = sys.addWaste('banana_peels', 5);
    assertEqual(result.success, false);
    assertEqual(result.reason, 'unknown_category');
    cleanup(sys);
  });

  it('returns failure when bin is full', async () => {
    const sys = new SmartWasteManagementSystem(makeHomey());
    await sys.initialize();
    const bin = sys.bins.get('bin_paper');
    bin.currentFillLiters = bin.capacityLiters;
    const result = sys.addWaste('paper', 10);
    assertEqual(result.success, false);
    assertEqual(result.reason, 'bin_full');
    cleanup(sys);
  });

  it('logs waste entry', async () => {
    const sys = new SmartWasteManagementSystem(makeHomey());
    await sys.initialize();
    const logBefore = sys.wasteLog.length;
    sys.addWaste('glass', 5);
    assertEqual(sys.wasteLog.length, logBefore + 1);
    assertEqual(sys.wasteLog[sys.wasteLog.length - 1].category, 'glass');
    cleanup(sys);
  });

  it('updates member score when memberId provided', async () => {
    const sys = new SmartWasteManagementSystem(makeHomey());
    await sys.initialize();
    const memberBefore = sys.gamification.members.get('parent1').points;
    sys.addWaste('paper', 10, 'parent1');
    const memberAfter = sys.gamification.members.get('parent1').points;
    assert(memberAfter > memberBefore, 'points should increase');
    cleanup(sys);
  });
});

describe('SmartWasteManagementSystem — emptyBin', () => {
  it('empties bin successfully', async () => {
    const sys = new SmartWasteManagementSystem(makeHomey());
    await sys.initialize();
    sys.addWaste('paper', 20);
    const result = sys.emptyBin('bin_paper');
    assertEqual(result.success, true);
    assertEqual(result.binId, 'bin_paper');
    assert(result.previousFillLiters > 0, 'should record previous fill');
    const bin = sys.bins.get('bin_paper');
    assertEqual(bin.currentFillLiters, 0);
    assertEqual(bin.fillPercentage, 0);
    cleanup(sys);
  });

  it('returns failure for unknown bin', async () => {
    const sys = new SmartWasteManagementSystem(makeHomey());
    await sys.initialize();
    const result = sys.emptyBin('bin_unknown');
    assertEqual(result.success, false);
    assertEqual(result.reason, 'bin_not_found');
    cleanup(sys);
  });

  it('resets collection reminder state', async () => {
    const sys = new SmartWasteManagementSystem(makeHomey());
    await sys.initialize();
    const schedule = sys.collectionCalendar.get('paper');
    schedule.reminderSent24h = true;
    schedule.reminderSent2h = true;
    sys.emptyBin('bin_paper');
    assertEqual(schedule.reminderSent24h, false);
    assertEqual(schedule.reminderSent2h, false);
    cleanup(sys);
  });
});

describe('SmartWasteManagementSystem — compost', () => {
  it('adds green material to compost', async () => {
    const sys = new SmartWasteManagementSystem(makeHomey());
    await sys.initialize();
    const result = sys.addToCompost('food_scraps', 10);
    assertEqual(result.success, true);
    assertEqual(result.material, 'food_scraps');
    assert(result.volumeAdded > 0, 'should have volume added');
    assertType(result.fillPercentage, 'number');
    assertType(result.greenBrownRatio, 'number');
    cleanup(sys);
  });

  it('adds brown material to compost', async () => {
    const sys = new SmartWasteManagementSystem(makeHomey());
    await sys.initialize();
    const result = sys.addToCompost('leaves', 15);
    assertEqual(result.success, true);
    assertEqual(result.material, 'leaves');
    cleanup(sys);
  });

  it('rejects invalid compost material', async () => {
    const sys = new SmartWasteManagementSystem(makeHomey());
    await sys.initialize();
    const result = sys.addToCompost('plastic_bag', 5);
    assertEqual(result.success, false);
    assertEqual(result.reason, 'invalid_material');
    cleanup(sys);
  });

  it('rejects when compost is full', async () => {
    const sys = new SmartWasteManagementSystem(makeHomey());
    await sys.initialize();
    sys.compostBin.currentFillLiters = sys.compostBin.capacityLiters;
    const result = sys.addToCompost('food_scraps', 10);
    assertEqual(result.success, false);
    assertEqual(result.reason, 'compost_full');
    cleanup(sys);
  });

  it('turnCompost resets daysSinceTurning and raises temperature', async () => {
    const sys = new SmartWasteManagementSystem(makeHomey());
    await sys.initialize();
    sys.compostBin.daysSinceTurning = 10;
    const tempBefore = sys.compostBin.temperatureCelsius;
    const result = sys.turnCompost();
    assertEqual(result.success, true);
    assertEqual(sys.compostBin.daysSinceTurning, 0);
    assert(result.temperature > tempBefore, 'temperature should increase');
    cleanup(sys);
  });

  it('getCompostStatus returns health info', async () => {
    const sys = new SmartWasteManagementSystem(makeHomey());
    await sys.initialize();
    const status = sys.getCompostStatus();
    assertType(status.fillPercentage, 'number');
    assertType(status.temperatureCelsius, 'number');
    assertType(status.moisturePercent, 'number');
    assertType(status.ph, 'number');
    assertType(status.needsTurning, 'boolean');
    assertType(status.healthy, 'boolean');
    assert(Array.isArray(status.issues), 'should have issues array');
    cleanup(sys);
  });
});

describe('SmartWasteManagementSystem — hazardous waste', () => {
  it('logs hazardous waste entry', async () => {
    const sys = new SmartWasteManagementSystem(makeHomey());
    await sys.initialize();
    const entry = sys.logHazardousWaste('Old paint', 'chemicals', 2.5, 'White paint');
    assertType(entry.id, 'string');
    assertEqual(entry.itemName, 'Old paint');
    assertEqual(entry.subCategory, 'chemicals');
    assertEqual(entry.weightKg, 2.5);
    assertEqual(entry.notes, 'White paint');
    assertEqual(entry.disposedAt, null);
    cleanup(sys);
  });

  it('getHazardousDisposalReminders returns overdue items', async () => {
    const sys = new SmartWasteManagementSystem(makeHomey());
    await sys.initialize();
    sys.hazardousWasteLog.push({
      id: 'haz_old',
      itemName: 'Old batteries',
      subCategory: 'batteries',
      weightKg: 1,
      loggedAt: Date.now() - 60 * 86400000,
      disposedAt: null,
      reminderSent: false
    });
    const reminders = sys.getHazardousDisposalReminders();
    assert(reminders.length >= 1, 'should have reminders');
    assertEqual(reminders[0].itemName, 'Old batteries');
    cleanup(sys);
  });
});

describe('SmartWasteManagementSystem — recycling & cost', () => {
  it('getRecyclingRate returns rate info', async () => {
    const sys = new SmartWasteManagementSystem(makeHomey());
    await sys.initialize();
    sys.addWaste('paper', 10);
    sys.addWaste('plastic', 5);
    const rate = sys.getRecyclingRate();
    assertType(rate.rate, 'number');
    assertType(rate.target, 'number');
    assertEqual(rate.period, '30 days');
    assertType(rate.recyclableKg, 'number');
    assertType(rate.totalKg, 'number');
    cleanup(sys);
  });

  it('getCostEstimate returns cost for known category', async () => {
    const sys = new SmartWasteManagementSystem(makeHomey());
    await sys.initialize();
    const cost = sys.getCostEstimate('paper', 5);
    assertType(cost.estimatedCostSEK, 'number');
    assertEqual(cost.category, 'paper');
    assertEqual(cost.weightKg, 5);
    cleanup(sys);
  });

  it('getCostEstimate returns null for unknown category', async () => {
    const sys = new SmartWasteManagementSystem(makeHomey());
    await sys.initialize();
    const cost = sys.getCostEstimate('unknown', 5);
    assertEqual(cost, null);
    cleanup(sys);
  });

  it('getTotalMonthlyCost returns cost summary', async () => {
    const sys = new SmartWasteManagementSystem(makeHomey());
    await sys.initialize();
    sys.addWaste('paper', 10);
    sys.addWaste('plastic', 5);
    const cost = sys.getTotalMonthlyCost();
    assertType(cost.totalCostSEK, 'number');
    assertType(cost.byCategory, 'object');
    assertEqual(cost.period, '30 days');
    cleanup(sys);
  });
});

describe('SmartWasteManagementSystem — trend & reporting', () => {
  it('wastePerWeek returns weekly data', async () => {
    const sys = new SmartWasteManagementSystem(makeHomey());
    await sys.initialize();
    const weeks = sys.wastePerWeek(4);
    assertEqual(weeks.length, 4);
    assertType(weeks[0].totalKg, 'number');
    assertType(weeks[0].weekNumber, 'number');
    cleanup(sys);
  });

  it('wastePerMonth returns monthly data', async () => {
    const sys = new SmartWasteManagementSystem(makeHomey());
    await sys.initialize();
    const months = sys.wastePerMonth(3);
    assertEqual(months.length, 3);
    assertType(months[0].totalKg, 'number');
    cleanup(sys);
  });

  it('trendDirection returns a valid trend string', async () => {
    const sys = new SmartWasteManagementSystem(makeHomey());
    await sys.initialize();
    const trend = sys.trendDirection();
    assert(
      ['increasing', 'decreasing', 'stable', 'insufficient_data'].includes(trend),
      'should be a valid trend'
    );
    cleanup(sys);
  });
});

describe('SmartWasteManagementSystem — gamification', () => {
  it('initializes 3 household members', async () => {
    const sys = new SmartWasteManagementSystem(makeHomey());
    await sys.initialize();
    assertEqual(sys.gamification.members.size, 3);
    assert(sys.gamification.members.has('parent1'), 'should have parent1');
    assert(sys.gamification.members.has('parent2'), 'should have parent2');
    assert(sys.gamification.members.has('child1'), 'should have child1');
    cleanup(sys);
  });

  it('has 5 active challenges', async () => {
    const sys = new SmartWasteManagementSystem(makeHomey());
    await sys.initialize();
    const active = sys.gamification.challenges.filter(c => c.active);
    assertEqual(active.length, 5);
    cleanup(sys);
  });
});

describe('SmartWasteManagementSystem — collection calendar', () => {
  it('has 8 scheduled categories', async () => {
    const sys = new SmartWasteManagementSystem(makeHomey());
    await sys.initialize();
    assertEqual(sys.collectionCalendar.size, 8);
    cleanup(sys);
  });

  it('each schedule has nextCollection date', async () => {
    const sys = new SmartWasteManagementSystem(makeHomey());
    await sys.initialize();
    for (const [, schedule] of sys.collectionCalendar) {
      assert(schedule.nextCollection instanceof Date, 'nextCollection should be Date');
      assertType(schedule.intervalDays, 'number');
    }
    cleanup(sys);
  });
});

describe('SmartWasteManagementSystem — getStatistics', () => {
  it('returns comprehensive statistics object', async () => {
    const sys = new SmartWasteManagementSystem(makeHomey());
    await sys.initialize();
    sys.addWaste('paper', 10, 'parent1');
    const stats = sys.getStatistics();
    assertType(stats.bins, 'object');
    assertType(stats.upcomingCollections, 'object');
    assertType(stats.recyclingRate, 'object');
    assertType(stats.monthlyCost, 'object');
    assertType(stats.compost, 'object');
    assertType(stats.carbonSavedKg, 'number');
    assertType(stats.gamification, 'object');
    assertEqual(stats.categories, 8);
    assertEqual(stats.uptime, 'active');
    cleanup(sys);
  });
});

describe('SmartWasteManagementSystem — destroy', () => {
  it('clears monitoring intervals', async () => {
    const sys = new SmartWasteManagementSystem(makeHomey());
    await sys.initialize();
    sys.destroy();
    assertEqual(sys.monitoringInterval, null);
    assertEqual(sys.reminderInterval, null);
    cleanup(sys);
  });
});

run();
