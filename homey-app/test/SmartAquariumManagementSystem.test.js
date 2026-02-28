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

const SmartAquariumManagementSystem = require('../lib/SmartAquariumManagementSystem');

describe('SmartAquariumManagementSystem — constructor & init', () => {
  it('instantiates without errors', () => {
    const sys = new SmartAquariumManagementSystem(createMockHomey());
    assert(sys, 'should create instance');
    assertEqual(sys.initialized, false);
    cleanup(sys);
  });

  it('initialize sets up tanks and species', async () => {
    const sys = new SmartAquariumManagementSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.initialized, true);
    assert(sys.tanks.size >= 3, 'should have 3 tanks');
    assert(sys.fishSpecies.size > 0, 'should have fish species');
    assert(sys.diseaseDatabase.length > 0, 'should have diseases');
    assert(sys.feedingSchedules.size > 0, 'should have feeding schedules');
    cleanup(sys);
  });
});

describe('SmartAquariumManagementSystem — water changes', () => {
  it('calculateWaterChange returns change info', async () => {
    const sys = new SmartAquariumManagementSystem(createMockHomey());
    await sys.initialize();
    const info = sys.calculateWaterChange('reef_tank');
    assert(info, 'should return info');
    assertEqual(info.tankId, 'reef_tank');
    assertType(info.changeVolumeLiters, 'number');
    assertType(info.daysSinceLastChange, 'number');
    assertType(info.isOverdue, 'boolean');
    cleanup(sys);
  });

  it('calculateWaterChange returns null for unknown tank', async () => {
    const sys = new SmartAquariumManagementSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.calculateWaterChange('nonexistent'), null);
    cleanup(sys);
  });

  it('performWaterChange updates last change time', async () => {
    const sys = new SmartAquariumManagementSystem(createMockHomey());
    await sys.initialize();
    const before = sys.tanks.get('reef_tank').lastWaterChange;
    const result = sys.performWaterChange('reef_tank');
    assertEqual(result.success, true);
    assert(sys.tanks.get('reef_tank').lastWaterChange > before, 'should update timestamp');
    assert(sys.waterChangeLog.length > 0, 'should log water change');
    cleanup(sys);
  });

  it('performWaterChange fails for unknown tank', async () => {
    const sys = new SmartAquariumManagementSystem(createMockHomey());
    const result = sys.performWaterChange('nonexistent');
    assertEqual(result.success, false);
    cleanup(sys);
  });
});

describe('SmartAquariumManagementSystem — parameter history', () => {
  it('getParameterHistory returns history with trend', async () => {
    const sys = new SmartAquariumManagementSystem(createMockHomey());
    await sys.initialize();
    // Add some history
    const tank = sys.tanks.get('reef_tank');
    tank.parameterHistory.push(
      { parameter: 'pH', value: 8.1, timestamp: Date.now() - 3600000 },
      { parameter: 'pH', value: 8.3, timestamp: Date.now() }
    );
    const history = sys.getParameterHistory('reef_tank', 'pH', 7);
    assert(history, 'should return history');
    assertEqual(history.entries.length, 2);
    assertEqual(history.trend, 'increasing');
    cleanup(sys);
  });

  it('getParameterHistory returns no_data for empty history', async () => {
    const sys = new SmartAquariumManagementSystem(createMockHomey());
    await sys.initialize();
    const history = sys.getParameterHistory('reef_tank', 'nonexistent', 7);
    assertEqual(history.trend, 'no_data');
    cleanup(sys);
  });
});

describe('SmartAquariumManagementSystem — feeding', () => {
  it('calculatePortion returns portion info', async () => {
    const sys = new SmartAquariumManagementSystem(createMockHomey());
    await sys.initialize();
    // Use planted_tank to avoid fasting-day edge case
    const portion = sys.calculatePortion('planted_tank');
    assert(portion, 'should return portion');
    assertType(portion.portionGrams, 'number');
    assert(portion.portionGrams > 0, 'should have positive portion');
    cleanup(sys);
  });

  it('calculatePortion returns null for unknown tank', async () => {
    const sys = new SmartAquariumManagementSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.calculatePortion('nonexistent'), null);
    cleanup(sys);
  });
});

describe('SmartAquariumManagementSystem — auto top off', () => {
  it('checkAutoTopOff returns reservoir status', async () => {
    const sys = new SmartAquariumManagementSystem(createMockHomey());
    await sys.initialize();
    const ato = sys.checkAutoTopOff('reef_tank');
    assert(ato, 'should return ATO status');
    assertEqual(ato.enabled, true);
    assertType(ato.reservoirPercent, 'number');
    assertType(ato.daysUntilEmpty, 'number');
    cleanup(sys);
  });

  it('checkAutoTopOff returns null for unknown tank', async () => {
    const sys = new SmartAquariumManagementSystem(createMockHomey());
    assertEqual(sys.checkAutoTopOff('nonexistent'), null);
    cleanup(sys);
  });
});

describe('SmartAquariumManagementSystem — compatibility', () => {
  it('checkCompatibility returns result for known species', async () => {
    const sys = new SmartAquariumManagementSystem(createMockHomey());
    await sys.initialize();
    const result = sys.checkCompatibility('clownfish', 'royal_gramma');
    assert(result, 'should return result');
    cleanup(sys);
  });

  it('checkCompatibility returns unknown for missing species', async () => {
    const sys = new SmartAquariumManagementSystem(createMockHomey());
    await sys.initialize();
    const result = sys.checkCompatibility('unknown_fish', 'clownfish');
    assertEqual(result.compatible, 'unknown');
    cleanup(sys);
  });
});

describe('SmartAquariumManagementSystem — equipment maintenance', () => {
  it('getEquipmentDue returns due tasks', async () => {
    const sys = new SmartAquariumManagementSystem(createMockHomey());
    await sys.initialize();
    const due = sys.getEquipmentDue();
    assert(Array.isArray(due), 'should be array');
    cleanup(sys);
  });

  it('completeMaintenanceTask marks task done', async () => {
    const sys = new SmartAquariumManagementSystem(createMockHomey());
    await sys.initialize();
    if (sys.equipmentMaintenance.length > 0) {
      const taskId = sys.equipmentMaintenance[0].id;
      const result = sys.completeMaintenanceTask(taskId);
      assertEqual(result.success, true);
    }
    cleanup(sys);
  });

  it('completeMaintenanceTask fails for unknown task', async () => {
    const sys = new SmartAquariumManagementSystem(createMockHomey());
    const result = sys.completeMaintenanceTask('nonexistent');
    assertEqual(result.success, false);
    cleanup(sys);
  });
});

describe('SmartAquariumManagementSystem — statistics', () => {
  it('getStatistics returns comprehensive stats', async () => {
    const sys = new SmartAquariumManagementSystem(createMockHomey());
    await sys.initialize();
    const stats = sys.getStatistics();
    assert(stats.tanks, 'should have tanks');
    assert(stats.corals, 'should have corals');
    assertType(stats.fishSpecies, 'number');
    assertType(stats.diseases, 'number');
    assertEqual(stats.uptime, 'active');
    cleanup(sys);
  });
});

describe('SmartAquariumManagementSystem — destroy', () => {
  it('clears monitoring interval', async () => {
    const sys = new SmartAquariumManagementSystem(createMockHomey());
    await sys.initialize();
    sys.destroy();
    assertEqual(sys.monitoringInterval, null);
    cleanup(sys);
  });
});

run();
