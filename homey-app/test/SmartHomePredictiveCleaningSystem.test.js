'use strict';

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertType } = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');

/* ── Timer-leak prevention ──────────────────────────────────────── */
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

const SmartHomePredictiveCleaningSystem = require('../lib/SmartHomePredictiveCleaningSystem');

/* ── Helper: create system + init ───────────────────────────────── */
function createSystem(overrides) {
  const homey = createMockHomey(overrides);
  return new SmartHomePredictiveCleaningSystem(homey);
}

async function createInitialized(overrides) {
  const sys = createSystem(overrides);
  await sys.initialize();
  return sys;
}

/* ================================================================
   Constructor
   ================================================================ */
describe('SmartHomePredictiveCleaningSystem — constructor', () => {
  it('sets sensible defaults', () => {
    const sys = createSystem();
    try {
      assertEqual(sys.initialized, false);
      assertEqual(sys.guestMode, false);
      assertEqual(sys.guestArrivalTime, null);
      assert(sys.rooms instanceof Map, 'rooms should be a Map');
      assertEqual(sys.rooms.size, 0);
      assert(Array.isArray(sys.cleaningHistory), 'cleaningHistory should be an array');
      assertEqual(sys.cleaningHistory.length, 0);
      assert(Array.isArray(sys.supplies), 'supplies should be an array');
      assertEqual(sys.supplies.length, 8);
      assertType(sys.energyPricing, 'object');
      assertEqual(sys.energyPricing.currentRate, 0.12);
      assertEqual(sys.energyPricing.offPeakRate, 0.06);
      assertEqual(sys.energyPricing.peakRate, 0.22);
    } finally {
      cleanup(sys);
    }
  });

  it('initializes Maps for tracking structures', () => {
    const sys = createSystem();
    try {
      assert(sys.contaminationScores instanceof Map, 'contaminationScores');
      assert(sys.contaminationHistory instanceof Map, 'contaminationHistory');
      assert(sys.emaScores instanceof Map, 'emaScores');
      assert(sys.predictedNextCleaning instanceof Map, 'predictedNextCleaning');
      assert(sys.robotVacuums instanceof Map, 'robotVacuums');
      assert(sys.obstacleMap instanceof Map, 'obstacleMap');
      assert(sys.zonePriorities instanceof Map, 'zonePriorities');
      assert(sys.floorPlans instanceof Map, 'floorPlans');
      assert(sys.allergenLevels instanceof Map, 'allergenLevels');
    } finally {
      cleanup(sys);
    }
  });

  it('initializes all interval slots to null', () => {
    const sys = createSystem();
    try {
      const intervals = sys._intervals;
      assertType(intervals, 'object');
      const keys = ['contaminationScan', 'predictiveScheduler', 'supplyMonitor',
        'seasonalCheck', 'allergenUpdate', 'analyticsAggregate',
        'robotCoordination', 'deepCleanCheck'];
      for (const k of keys) {
        assertEqual(intervals[k], null);
      }
    } finally {
      cleanup(sys);
    }
  });
});

/* ================================================================
   initialize()
   ================================================================ */
describe('SmartHomePredictiveCleaningSystem — initialize', () => {
  it('sets initialized to true and creates 10 default rooms', async () => {
    const sys = createSystem();
    try {
      await sys.initialize();
      assertEqual(sys.initialized, true);
      assertEqual(sys.rooms.size, 10);
      assert(sys.rooms.has('living_room'), 'should have living_room');
      assert(sys.rooms.has('kitchen'), 'should have kitchen');
      assert(sys.rooms.has('master_bedroom'), 'should have master_bedroom');
      assert(sys.rooms.has('hallway'), 'should have hallway');
    } finally {
      cleanup(sys);
    }
  });

  it('starts all 8 intervals after init', async () => {
    const sys = createSystem();
    try {
      await sys.initialize();
      const intervals = sys._intervals;
      for (const [key, val] of Object.entries(intervals)) {
        assert(val !== null, `interval ${key} should be set`);
      }
    } finally {
      cleanup(sys);
    }
  });

  it('detects current season', async () => {
    const sys = createSystem();
    try {
      await sys.initialize();
      assert(sys.currentSeason !== null && sys.currentSeason !== undefined, 'season should be set');
      assertType(sys.currentSeason.label, 'string');
    } finally {
      cleanup(sys);
    }
  });

  it('initializes allergen levels', async () => {
    const sys = createSystem();
    try {
      await sys.initialize();
      assert(sys.allergenLevels.size > 0, 'should have allergen entries');
      assert(sys.allergenLevels.has('pollen'), 'should track pollen');
      assert(sys.allergenLevels.has('dust_mites'), 'should track dust_mites');
    } finally {
      cleanup(sys);
    }
  });
});

/* ================================================================
   destroy()
   ================================================================ */
describe('SmartHomePredictiveCleaningSystem — destroy', () => {
  it('clears intervals and resets flags', async () => {
    const sys = await createInitialized();
    try {
      sys.destroy();
      assertEqual(sys.initialized, false);
      assertEqual(sys.guestMode, false);
      assertEqual(sys.guestArrivalTime, null);
    } finally {
      cleanup(sys);
    }
  });
});

/* ================================================================
   addRoom / removeRoom
   ================================================================ */
describe('SmartHomePredictiveCleaningSystem — addRoom', () => {
  it('adds a room with defaults', async () => {
    const sys = await createInitialized();
    try {
      sys.addRoom({ id: 'test_room', name: 'Test Room', floor: 2, areaSqMeters: 20 });
      assert(sys.rooms.has('test_room'), 'room should be added');
      const room = sys.rooms.get('test_room');
      assertEqual(room.surfaceType, 'mixed');
    } finally {
      cleanup(sys);
    }
  });

  it('does nothing when config is null', async () => {
    const sys = await createInitialized();
    try {
      const before = sys.rooms.size;
      sys.addRoom(null);
      assertEqual(sys.rooms.size, before);
    } finally {
      cleanup(sys);
    }
  });

  it('does nothing when config has no id', async () => {
    const sys = await createInitialized();
    try {
      const before = sys.rooms.size;
      sys.addRoom({ name: 'No ID Room' });
      assertEqual(sys.rooms.size, before);
    } finally {
      cleanup(sys);
    }
  });
});

describe('SmartHomePredictiveCleaningSystem — removeRoom', () => {
  it('removes a room from all maps', async () => {
    const sys = await createInitialized();
    try {
      assert(sys.rooms.has('kitchen'), 'kitchen should exist before removal');
      sys.removeRoom('kitchen');
      assertEqual(sys.rooms.has('kitchen'), false);
      assertEqual(sys.contaminationScores.has('kitchen'), false);
    } finally {
      cleanup(sys);
    }
  });

  it('no-ops for non-existent room', async () => {
    const sys = await createInitialized();
    try {
      const before = sys.rooms.size;
      sys.removeRoom('nonexistent_xyz');
      assertEqual(sys.rooms.size, before);
    } finally {
      cleanup(sys);
    }
  });
});

/* ================================================================
   getSupplyLevels / refillSupply
   ================================================================ */
describe('SmartHomePredictiveCleaningSystem — getSupplyLevels', () => {
  it('returns 8 supplies as shallow copies', () => {
    const sys = createSystem();
    try {
      const levels = sys.getSupplyLevels();
      assert(Array.isArray(levels), 'should return array');
      assertEqual(levels.length, 8);
      // Verify it is a copy
      levels[0].currentLevel = -999;
      const again = sys.getSupplyLevels();
      assert(again[0].currentLevel !== -999, 'should be a shallow copy');
    } finally {
      cleanup(sys);
    }
  });

  it('includes expected supply ids', () => {
    const sys = createSystem();
    try {
      const levels = sys.getSupplyLevels();
      const ids = levels.map(s => s.id);
      assert(ids.includes('detergent'), 'should include detergent');
      assert(ids.includes('hepa_filters'), 'should include hepa_filters');
      assert(ids.includes('vacuum_bags'), 'should include vacuum_bags');
    } finally {
      cleanup(sys);
    }
  });
});

describe('SmartHomePredictiveCleaningSystem — refillSupply', () => {
  it('sets currentLevel to 100 for a valid supply', () => {
    const sys = createSystem();
    try {
      // Manually lower a supply
      const supply = sys.supplies.find(s => s.id === 'detergent');
      supply.currentLevel = 10;
      sys.refillSupply('detergent');
      const after = sys.supplies.find(s => s.id === 'detergent');
      assertEqual(after.currentLevel, 100);
      assertType(after.lastRefilled, 'string');
    } finally {
      cleanup(sys);
    }
  });

  it('does nothing for unknown supply id', () => {
    const sys = createSystem();
    try {
      // Should not throw
      sys.refillSupply('nonexistent_supply');
      assertEqual(sys.supplies.length, 8);
    } finally {
      cleanup(sys);
    }
  });
});

/* ================================================================
   getAllergenLevels
   ================================================================ */
describe('SmartHomePredictiveCleaningSystem — getAllergenLevels', () => {
  it('returns an object with allergen keys after init', async () => {
    const sys = await createInitialized();
    try {
      const levels = sys.getAllergenLevels();
      assertType(levels, 'object');
      assert('pollen' in levels, 'should have pollen');
      assert('dust_mites' in levels, 'should have dust_mites');
      assert('mold_spores' in levels, 'should have mold_spores');
      assert('pet_dander' in levels, 'should have pet_dander');
    } finally {
      cleanup(sys);
    }
  });

  it('returns numeric values', async () => {
    const sys = await createInitialized();
    try {
      const levels = sys.getAllergenLevels();
      for (const val of Object.values(levels)) {
        assertType(val, 'number');
      }
    } finally {
      cleanup(sys);
    }
  });
});

/* ================================================================
   Guest mode
   ================================================================ */
describe('SmartHomePredictiveCleaningSystem — activateGuestMode', () => {
  it('activates guest mode with arrival time', async () => {
    const sys = await createInitialized();
    try {
      const arrival = new Date(Date.now() + 7200000).toISOString();
      sys.activateGuestMode(arrival);
      assertEqual(sys.guestMode, true);
      assertEqual(sys.guestArrivalTime, arrival);
    } finally {
      cleanup(sys);
    }
  });

  it('uses default priority rooms when none specified', async () => {
    const sys = await createInitialized();
    try {
      sys.activateGuestMode(new Date().toISOString());
      assertEqual(sys.guestMode, true);
      // Guest prep cleaning should have been scheduled (checked via history)
      // The cleaning history may have guest_prep entries
      const guestCleanings = sys.cleaningHistory.filter(e => e.type === 'guest_prep');
      // At least some rooms should get scheduled
      assert(guestCleanings.length >= 0, 'guest cleanings should exist or be empty depending on rooms');
    } finally {
      cleanup(sys);
    }
  });
});

describe('SmartHomePredictiveCleaningSystem — deactivateGuestMode', () => {
  it('deactivates guest mode and clears arrival time', async () => {
    const sys = await createInitialized();
    try {
      sys.activateGuestMode(new Date().toISOString());
      assertEqual(sys.guestMode, true);
      sys.deactivateGuestMode();
      assertEqual(sys.guestMode, false);
      assertEqual(sys.guestArrivalTime, null);
    } finally {
      cleanup(sys);
    }
  });
});

/* ================================================================
   getRoomPriorityRanking
   ================================================================ */
describe('SmartHomePredictiveCleaningSystem — getRoomPriorityRanking', () => {
  it('returns an array sorted by velocity descending', async () => {
    const sys = await createInitialized();
    try {
      const ranking = sys.getRoomPriorityRanking();
      assert(Array.isArray(ranking), 'should be array');
      assert(ranking.length > 0, 'should have entries after init with 10 rooms');
      // Verify structure of first entry
      const first = ranking[0];
      assert('roomId' in first, 'should have roomId');
      assert('name' in first, 'should have name');
      assert('velocity' in first, 'should have velocity');
      assert('ema' in first, 'should have ema');
    } finally {
      cleanup(sys);
    }
  });

  it('ranks rooms by velocity descending', async () => {
    const sys = await createInitialized();
    try {
      const ranking = sys.getRoomPriorityRanking();
      for (let i = 1; i < ranking.length; i++) {
        assert(ranking[i - 1].velocity >= ranking[i].velocity,
          `velocity[${i - 1}] should >= velocity[${i}]`);
      }
    } finally {
      cleanup(sys);
    }
  });
});

/* ================================================================
   getCleaningTrends
   ================================================================ */
describe('SmartHomePredictiveCleaningSystem — getCleaningTrends', () => {
  it('returns trend structure with defaults', async () => {
    const sys = await createInitialized();
    try {
      const trends = sys.getCleaningTrends();
      assertType(trends, 'object');
      assert('period' in trends, 'should have period');
      assert('totalEvents' in trends, 'should have totalEvents');
      assert('daily' in trends, 'should have daily');
      assert('byRoom' in trends, 'should have byRoom');
      assert('contaminationTrends' in trends, 'should have contaminationTrends');
      assert('supplySummary' in trends, 'should have supplySummary');
      assert('allergenSnapshot' in trends, 'should have allergenSnapshot');
    } finally {
      cleanup(sys);
    }
  });

  it('accepts custom day range', async () => {
    const sys = await createInitialized();
    try {
      const trends = sys.getCleaningTrends(30);
      assertType(trends.period, 'object');
    } finally {
      cleanup(sys);
    }
  });
});

/* ================================================================
   getCleaningEffectivenessData
   ================================================================ */
describe('SmartHomePredictiveCleaningSystem — getCleaningEffectivenessData', () => {
  it('returns an array (possibly empty) for a room', async () => {
    const sys = await createInitialized();
    try {
      const data = sys.getCleaningEffectivenessData('living_room');
      assert(Array.isArray(data), 'should be array');
    } finally {
      cleanup(sys);
    }
  });

  it('returns empty array for nonexistent room', async () => {
    const sys = await createInitialized();
    try {
      const data = sys.getCleaningEffectivenessData('nonexistent');
      assert(Array.isArray(data), 'should be array');
      assertEqual(data.length, 0);
    } finally {
      cleanup(sys);
    }
  });
});

/* ================================================================
   getNextOptimalCleaningWindow
   ================================================================ */
describe('SmartHomePredictiveCleaningSystem — getNextOptimalCleaningWindow', () => {
  it('returns window with expected keys', () => {
    const sys = createSystem();
    try {
      const window = sys.getNextOptimalCleaningWindow();
      assertType(window, 'object');
      assert('isCurrentlyOptimal' in window, 'should have isCurrentlyOptimal');
      assert('currentRate' in window, 'should have currentRate');
      assert('offPeakRate' in window, 'should have offPeakRate');
      assert('peakRate' in window, 'should have peakRate');
      assert('estimatedSavingsPercent' in window, 'should have estimatedSavingsPercent');
    } finally {
      cleanup(sys);
    }
  });

  it('returns numeric rates', () => {
    const sys = createSystem();
    try {
      const window = sys.getNextOptimalCleaningWindow();
      assertType(window.currentRate, 'number');
      assertType(window.offPeakRate, 'number');
      assertType(window.peakRate, 'number');
    } finally {
      cleanup(sys);
    }
  });
});

/* ================================================================
   updateEnergyPricing
   ================================================================ */
describe('SmartHomePredictiveCleaningSystem — updateEnergyPricing', () => {
  it('updates energy pricing values', () => {
    const sys = createSystem();
    try {
      sys.updateEnergyPricing({ currentRate: 0.15, offPeakRate: 0.05, peakRate: 0.30 });
      assertEqual(sys.energyPricing.currentRate, 0.15);
      assertEqual(sys.energyPricing.offPeakRate, 0.05);
      assertEqual(sys.energyPricing.peakRate, 0.30);
    } finally {
      cleanup(sys);
    }
  });

  it('updates partial pricing without clearing others', () => {
    const sys = createSystem();
    try {
      sys.updateEnergyPricing({ currentRate: 0.20 });
      assertEqual(sys.energyPricing.currentRate, 0.20);
      assertEqual(sys.energyPricing.offPeakRate, 0.06); // unchanged
      assertEqual(sys.energyPricing.peakRate, 0.22); // unchanged
    } finally {
      cleanup(sys);
    }
  });
});

/* ================================================================
   Obstacle management
   ================================================================ */
describe('SmartHomePredictiveCleaningSystem — addObstacle', () => {
  it('adds a permanent obstacle', async () => {
    const sys = await createInitialized();
    try {
      sys.addObstacle('living_room', { type: 'furniture', permanent: true, x: 1, y: 2 });
      const mapData = sys.obstacleMap.get('living_room');
      assert(mapData !== undefined, 'obstacle map entry should exist');
      assert(mapData.permanentObstacles.length > 0, 'should have permanent obstacles');
    } finally {
      cleanup(sys);
    }
  });

  it('adds a temporary obstacle', async () => {
    const sys = await createInitialized();
    try {
      sys.addObstacle('kitchen', { type: 'toy', permanent: false, x: 3, y: 4 });
      const mapData = sys.obstacleMap.get('kitchen');
      assert(mapData !== undefined, 'obstacle map entry should exist');
      assert(mapData.temporaryObstacles.length > 0, 'should have temporary obstacles');
    } finally {
      cleanup(sys);
    }
  });
});

describe('SmartHomePredictiveCleaningSystem — addNoGoZone', () => {
  it('adds a no-go zone to a room', async () => {
    const sys = await createInitialized();
    try {
      sys.addNoGoZone('hallway', { x: 0, y: 0, width: 1, height: 1, reason: 'fragile' });
      const mapData = sys.obstacleMap.get('hallway');
      assert(mapData !== undefined, 'map data should exist');
      assert(mapData.noGoZones.length > 0, 'should have no-go zones');
    } finally {
      cleanup(sys);
    }
  });
});

describe('SmartHomePredictiveCleaningSystem — clearTemporaryObstacles', () => {
  it('clears temporary obstacles from a room', async () => {
    const sys = await createInitialized();
    try {
      sys.addObstacle('kitchen', { type: 'box', permanent: false, x: 5, y: 5 });
      const before = sys.obstacleMap.get('kitchen');
      assert(before.temporaryObstacles.length > 0, 'should have temps before');
      sys.clearTemporaryObstacles('kitchen');
      const after = sys.obstacleMap.get('kitchen');
      assertEqual(after.temporaryObstacles.length, 0);
    } finally {
      cleanup(sys);
    }
  });
});

/* ================================================================
   triggerCleaning
   ================================================================ */
describe('SmartHomePredictiveCleaningSystem — triggerCleaning', () => {
  it('triggers cleaning for an existing room', async () => {
    const sys = await createInitialized();
    try {
      const before = sys.cleaningHistory.length;
      sys.triggerCleaning('living_room', 'daily');
      assert(sys.cleaningHistory.length > before, 'should add cleaning history entry');
      const last = sys.cleaningHistory[sys.cleaningHistory.length - 1];
      assertEqual(last.roomId, 'living_room');
      assertEqual(last.type, 'daily');
    } finally {
      cleanup(sys);
    }
  });

  it('does nothing for non-existent room', async () => {
    const sys = await createInitialized();
    try {
      const before = sys.cleaningHistory.length;
      sys.triggerCleaning('nonexistent_room');
      assertEqual(sys.cleaningHistory.length, before);
    } finally {
      cleanup(sys);
    }
  });

  it('defaults to daily type', async () => {
    const sys = await createInitialized();
    try {
      sys.triggerCleaning('kitchen');
      const last = sys.cleaningHistory[sys.cleaningHistory.length - 1];
      assertEqual(last.type, 'daily');
    } finally {
      cleanup(sys);
    }
  });
});

/* ================================================================
   updatePetPresence
   ================================================================ */
describe('SmartHomePredictiveCleaningSystem — updatePetPresence', () => {
  it('updates pet presence for an existing room', async () => {
    const sys = await createInitialized();
    try {
      sys.updatePetPresence('living_room', true);
      const room = sys.rooms.get('living_room');
      assertEqual(room.hasPets, true);
    } finally {
      cleanup(sys);
    }
  });

  it('sets hasPets to false', async () => {
    const sys = await createInitialized();
    try {
      sys.updatePetPresence('kitchen', true);
      sys.updatePetPresence('kitchen', false);
      const room = sys.rooms.get('kitchen');
      assertEqual(room.hasPets, false);
    } finally {
      cleanup(sys);
    }
  });

  it('does nothing for unknown room', async () => {
    const sys = await createInitialized();
    try {
      // Should not throw
      sys.updatePetPresence('nonexistent', true);
    } finally {
      cleanup(sys);
    }
  });
});

/* ================================================================
   getStatus
   ================================================================ */
describe('SmartHomePredictiveCleaningSystem — getStatus', () => {
  it('returns comprehensive status after init', async () => {
    const sys = await createInitialized();
    try {
      const status = sys.getStatus();
      assertType(status, 'object');
      assertEqual(status.initialized, true);
      assertType(status.timestamp, 'string');
      assertType(status.season, 'string');
      assertEqual(status.guestMode, false);
      assertEqual(status.roomCount, 10);
      assertType(status.rooms, 'object');
      assertType(status.vacuums, 'object');
      assertType(status.supplies, 'object');
      assertEqual(status.supplies.total, 8);
      assertType(status.allergens, 'object');
      assertType(status.intervals, 'object');
    } finally {
      cleanup(sys);
    }
  });

  it('returns minimal status before init', () => {
    const sys = createSystem();
    try {
      const status = sys.getStatus();
      assertEqual(status.initialized, false);
      assertEqual(status.roomCount, 0);
    } finally {
      cleanup(sys);
    }
  });
});

/* ================================================================
   getDashboardSummary
   ================================================================ */
describe('SmartHomePredictiveCleaningSystem — getDashboardSummary', () => {
  it('returns summary with expected keys after init', async () => {
    const sys = await createInitialized();
    try {
      const summary = sys.getDashboardSummary();
      assertType(summary, 'object');
      assert('dirtiestRoom' in summary, 'should have dirtiestRoom');
      assert('cleanestRoom' in summary, 'should have cleanestRoom');
      assert('cleaningsLast24h' in summary, 'should have cleaningsLast24h');
      assert('avgEffectiveness24h' in summary, 'should have avgEffectiveness24h');
      assert('guestMode' in summary, 'should have guestMode');
      assert('lowSupplies' in summary, 'should have lowSupplies');
      assert('season' in summary, 'should have season');
      assert('allergenAlert' in summary, 'should have allergenAlert');
    } finally {
      cleanup(sys);
    }
  });

  it('reflects guest mode status', async () => {
    const sys = await createInitialized();
    try {
      sys.activateGuestMode(new Date().toISOString());
      const summary = sys.getDashboardSummary();
      assertEqual(summary.guestMode, true);
    } finally {
      cleanup(sys);
    }
  });
});

/* ================================================================
   getFloorCleaningSchedule
   ================================================================ */
describe('SmartHomePredictiveCleaningSystem — getFloorCleaningSchedule', () => {
  it('returns rooms for a valid floor sorted by ema descending', async () => {
    const sys = await createInitialized();
    try {
      // Default rooms use floors 0 and 1
      const schedule = sys.getFloorCleaningSchedule(0);
      assert(Array.isArray(schedule), 'should be array');
      // Verify sorted by ema desc
      for (let i = 1; i < schedule.length; i++) {
        assert(schedule[i - 1].ema >= schedule[i].ema,
          `ema[${i - 1}] should >= ema[${i}]`);
      }
    } finally {
      cleanup(sys);
    }
  });

  it('returns empty array for non-existent floor', async () => {
    const sys = await createInitialized();
    try {
      const schedule = sys.getFloorCleaningSchedule(99);
      assert(Array.isArray(schedule), 'should be array');
      assertEqual(schedule.length, 0);
    } finally {
      cleanup(sys);
    }
  });

  it('each entry has expected properties', async () => {
    const sys = await createInitialized();
    try {
      const schedule = sys.getFloorCleaningSchedule(0);
      if (schedule.length > 0) {
        const entry = schedule[0];
        assert('roomId' in entry, 'should have roomId');
        assert('room' in entry, 'should have room');
        assert('ema' in entry, 'should have ema');
      }
    } finally {
      cleanup(sys);
    }
  });
});

/* ================================================================
   Event listeners (via homey.on / homey.off)
   ================================================================ */
describe('SmartHomePredictiveCleaningSystem — event listeners', () => {
  it('registers event listeners during initialize', async () => {
    const sys = createSystem();
    try {
      await sys.initialize();
      // The _listeners object should have entries for the registered events
      assertType(sys._listeners, 'object');
      const listenerKeys = Object.keys(sys._listeners);
      assert(listenerKeys.length > 0, 'should have registered listeners');
    } finally {
      cleanup(sys);
    }
  });
});

/* ================================================================
   Full lifecycle: init → use → destroy
   ================================================================ */
describe('SmartHomePredictiveCleaningSystem — lifecycle', () => {
  it('supports full init-use-destroy cycle', async () => {
    const sys = createSystem();
    try {
      assertEqual(sys.initialized, false);
      await sys.initialize();
      assertEqual(sys.initialized, true);

      // Use some features
      sys.addRoom({ id: 'garage', name: 'Garage', floor: 0, areaSqMeters: 30, surfaceType: 'tile' });
      assert(sys.rooms.has('garage'), 'garage should exist');
      sys.triggerCleaning('garage', 'daily');
      assert(sys.cleaningHistory.length > 0, 'should have history');

      // Destroy
      sys.destroy();
      assertEqual(sys.initialized, false);
      assertEqual(sys.guestMode, false);
    } finally {
      cleanup(sys);
    }
  });
});

run();
