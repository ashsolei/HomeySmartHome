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
  try {
    if (sys) {
      if (sys._phantomGuardTimer) { clearInterval(sys._phantomGuardTimer); sys._phantomGuardTimer = null; }
      if (sys._snapshotTimer) { clearInterval(sys._snapshotTimer); sys._snapshotTimer = null; }
      if (sys._patternLearnTimer) { clearInterval(sys._patternLearnTimer); sys._patternLearnTimer = null; }
    }
  } catch (_) {}
  while (activeHandles.length > 0) {
    const h = activeHandles.pop();
    if (h.type === 'timeout') clearTimeout(h.id); else clearInterval(h.id);
  }
}

const RoomOccupancyMappingSystem = require('../lib/RoomOccupancyMappingSystem');

describe('RoomOccupancyMappingSystem — constructor', () => {
  it('instantiates without errors', () => {
    const sys = new RoomOccupancyMappingSystem(createMockHomey());
    assert(sys, 'should create instance');
    cleanup(sys);
  });

  it('starts uninitialized with empty maps', () => {
    const sys = new RoomOccupancyMappingSystem(createMockHomey());
    assertEqual(sys.initialized, false);
    assertEqual(sys.rooms.size, 0);
    assertEqual(sys.occupancyState.size, 0);
    cleanup(sys);
  });
});

describe('RoomOccupancyMappingSystem — initialize', () => {
  it('creates default rooms and occupancy state', async () => {
    const sys = new RoomOccupancyMappingSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.initialized, true);
    assert(sys.rooms.size > 0, 'should have rooms');
    assert(sys.rooms.has('living_room'), 'should have living room');
    assert(sys.rooms.has('kitchen'), 'should have kitchen');
    assert(sys.occupancyState.size > 0, 'should have occupancy states');
    assert(sys.heatmap.size > 0, 'should have heatmap');
    cleanup(sys);
  });
});

describe('RoomOccupancyMappingSystem — addRoom', () => {
  it('adds a custom room', async () => {
    const sys = new RoomOccupancyMappingSystem(createMockHomey());
    await sys.initialize();
    const room = sys.addRoom({ name: 'Media Room', floor: 0, width: 5, length: 4, capacity: 6 });
    assert(room, 'should return room');
    assertEqual(room.areaSqm, 20);
    assert(sys.rooms.has('media_room'), 'should be in rooms map');
    assert(sys.occupancyState.has('media_room'), 'should have occupancy state');
    cleanup(sys);
  });

  it('uses defaults for missing values', async () => {
    const sys = new RoomOccupancyMappingSystem(createMockHomey());
    await sys.initialize();
    const room = sys.addRoom({ name: 'Small Room' });
    assert(room, 'should return room');
    assertEqual(room.capacity, 4);
    assertEqual(room.areaSqm, 9);
    cleanup(sys);
  });
});

describe('RoomOccupancyMappingSystem — sensor updates', () => {
  it('processes motion sensor update', async () => {
    const sys = new RoomOccupancyMappingSystem(createMockHomey());
    await sys.initialize();
    sys.processSensorUpdate('living_room', 'motion', true);
    const state = sys.occupancyState.get('living_room');
    assert(state.sensorVotes.motion, 'motion should be true');
    assert(state.lastMotion > 0, 'should record last motion');
    cleanup(sys);
  });

  it('processes CO2 sensor update', async () => {
    const sys = new RoomOccupancyMappingSystem(createMockHomey());
    await sys.initialize();
    sys.processSensorUpdate('kitchen', 'co2', 800);
    const readings = sys.sensorReadings.get('kitchen');
    assertEqual(readings.co2, 800);
    const state = sys.occupancyState.get('kitchen');
    assertEqual(state.sensorVotes.co2, true);
    cleanup(sys);
  });

  it('processes door sensor update', async () => {
    const sys = new RoomOccupancyMappingSystem(createMockHomey());
    await sys.initialize();
    sys.processSensorUpdate('hallway', 'door', 'open');
    const state = sys.occupancyState.get('hallway');
    assertEqual(state.sensorVotes.door, true);
    cleanup(sys);
  });

  it('processes power sensor update', async () => {
    const sys = new RoomOccupancyMappingSystem(createMockHomey());
    await sys.initialize();
    sys.processSensorUpdate('office', 'power', 100);
    const state = sys.occupancyState.get('office');
    assertEqual(state.sensorVotes.power, true);
    cleanup(sys);
  });

  it('filters pet motion when configured', async () => {
    const sys = new RoomOccupancyMappingSystem(createMockHomey());
    await sys.initialize();
    sys.processSensorUpdate('hallway', 'motion', true, { sensorHeight: 0.3 });
    const state = sys.occupancyState.get('hallway');
    // Pet filter should prevent updating motion
    assertEqual(state.sensorVotes.motion, false);
    cleanup(sys);
  });

  it('ignores updates for unknown rooms', async () => {
    const sys = new RoomOccupancyMappingSystem(createMockHomey());
    await sys.initialize();
    // Should not throw
    sys.processSensorUpdate('nonexistent', 'motion', true);
    cleanup(sys);
  });
});

describe('RoomOccupancyMappingSystem — occupancy evaluation', () => {
  it('marks room occupied with sufficient sensor votes', async () => {
    const sys = new RoomOccupancyMappingSystem(createMockHomey());
    await sys.initialize();
    sys.processSensorUpdate('living_room', 'motion', true);
    sys.processSensorUpdate('living_room', 'co2', 700);
    const state = sys.occupancyState.get('living_room');
    assertEqual(state.occupied, true);
    assert(state.confidence > 0, 'should have confidence');
    cleanup(sys);
  });

  it('marks room vacant when sensors clear', async () => {
    const sys = new RoomOccupancyMappingSystem(createMockHomey());
    await sys.initialize();
    sys.processSensorUpdate('living_room', 'motion', true);
    sys.processSensorUpdate('living_room', 'co2', 700);
    // Clear all sensors
    sys.processSensorUpdate('living_room', 'motion', false);
    sys.processSensorUpdate('living_room', 'co2', 400);
    const state = sys.occupancyState.get('living_room');
    assertEqual(state.occupied, false);
    cleanup(sys);
  });
});

describe('RoomOccupancyMappingSystem — person counting', () => {
  it('getPersonCount returns count for occupied room', async () => {
    const sys = new RoomOccupancyMappingSystem(createMockHomey());
    await sys.initialize();
    sys.processSensorUpdate('kitchen', 'motion', true);
    sys.processSensorUpdate('kitchen', 'co2', 850); // ~3 people based on CO2
    const count = sys.getPersonCount('kitchen');
    assert(count >= 1, 'should have at least 1 person');
    cleanup(sys);
  });

  it('getTotalOccupants sums across rooms', async () => {
    const sys = new RoomOccupancyMappingSystem(createMockHomey());
    await sys.initialize();
    sys.processSensorUpdate('kitchen', 'motion', true);
    sys.processSensorUpdate('kitchen', 'co2', 700);
    sys.processSensorUpdate('office', 'motion', true);
    sys.processSensorUpdate('office', 'co2', 600);
    const total = sys.getTotalOccupants();
    assert(total >= 2, 'should count people in multiple rooms');
    cleanup(sys);
  });

  it('getPersonCount returns 0 for unknown room', async () => {
    const sys = new RoomOccupancyMappingSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.getPersonCount('nonexistent'), 0);
    cleanup(sys);
  });
});

describe('RoomOccupancyMappingSystem — heatmap', () => {
  it('getHeatmap returns all rooms when no id given', async () => {
    const sys = new RoomOccupancyMappingSystem(createMockHomey());
    await sys.initialize();
    const heatmap = sys.getHeatmap();
    assertType(heatmap, 'object');
    assert(Object.keys(heatmap).length > 0, 'should have rooms');
    cleanup(sys);
  });

  it('getHeatmap returns single room data', async () => {
    const sys = new RoomOccupancyMappingSystem(createMockHomey());
    await sys.initialize();
    const data = sys.getHeatmap('living_room');
    assert(Array.isArray(data), 'should be array');
    assertEqual(data.length, 24);
    cleanup(sys);
  });

  it('getMostUsedRooms returns sorted list', async () => {
    const sys = new RoomOccupancyMappingSystem(createMockHomey());
    await sys.initialize();
    // Add some heatmap events
    sys.processSensorUpdate('living_room', 'motion', true);
    sys.processSensorUpdate('living_room', 'motion', true);
    const rooms = sys.getMostUsedRooms(3);
    assert(rooms.length <= 3, 'should respect topN');
    assert(rooms[0].total >= 0, 'should have totals');
    cleanup(sys);
  });
});

describe('RoomOccupancyMappingSystem — transitions', () => {
  it('getRecentTransitions returns transition history', async () => {
    const sys = new RoomOccupancyMappingSystem(createMockHomey());
    await sys.initialize();
    sys.processSensorUpdate('living_room', 'motion', true);
    const transitions = sys.getRecentTransitions();
    assert(Array.isArray(transitions), 'should be array');
    cleanup(sys);
  });
});

describe('RoomOccupancyMappingSystem — vacancy', () => {
  it('getVacantRooms returns unoccupied rooms', async () => {
    const sys = new RoomOccupancyMappingSystem(createMockHomey());
    await sys.initialize();
    const vacant = sys.getVacantRooms();
    assert(vacant.length > 0, 'all rooms should be vacant initially');
    cleanup(sys);
  });

  it('getVacancyRecommendations provides automation suggestions', async () => {
    const sys = new RoomOccupancyMappingSystem(createMockHomey());
    await sys.initialize();
    const recs = sys.getVacancyRecommendations();
    assert(recs.length > 0, 'should have recommendations for vacant rooms');
    assert(recs[0].actions.length > 0, 'should have actions');
    cleanup(sys);
  });
});

describe('RoomOccupancyMappingSystem — pet filter', () => {
  it('setPetFilterEnabled toggles filter', async () => {
    const sys = new RoomOccupancyMappingSystem(createMockHomey());
    await sys.initialize();
    sys.setPetFilterEnabled(false);
    assertEqual(sys.config.petFilterEnabled, false);
    cleanup(sys);
  });

  it('setPetMotionThreshold updates threshold', async () => {
    const sys = new RoomOccupancyMappingSystem(createMockHomey());
    await sys.initialize();
    sys.setPetMotionThreshold(0.8);
    assertEqual(sys.config.petMotionMaxHeight, 0.8);
    cleanup(sys);
  });

  it('getPetFilterStatus returns configuration', async () => {
    const sys = new RoomOccupancyMappingSystem(createMockHomey());
    await sys.initialize();
    const status = sys.getPetFilterStatus();
    assertType(status.enabled, 'boolean');
    assertType(status.maxHeight, 'number');
    cleanup(sys);
  });
});

describe('RoomOccupancyMappingSystem — room status', () => {
  it('getRoomStatus returns status for valid room', async () => {
    const sys = new RoomOccupancyMappingSystem(createMockHomey());
    await sys.initialize();
    const status = sys.getRoomStatus('living_room');
    assert(status, 'should return status');
    assertType(status.occupied, 'boolean');
    assertType(status.personCount, 'number');
    cleanup(sys);
  });

  it('getAllRoomStatuses returns all rooms', async () => {
    const sys = new RoomOccupancyMappingSystem(createMockHomey());
    await sys.initialize();
    const statuses = sys.getAllRoomStatuses();
    assert(statuses.length > 0, 'should have statuses');
    cleanup(sys);
  });

  it('getOccupiedRooms returns only occupied rooms', async () => {
    const sys = new RoomOccupancyMappingSystem(createMockHomey());
    await sys.initialize();
    const occupied = sys.getOccupiedRooms();
    assertEqual(occupied.length, 0); // initially all vacant
    cleanup(sys);
  });

  it('getRoomSummary returns summary object', async () => {
    const sys = new RoomOccupancyMappingSystem(createMockHomey());
    await sys.initialize();
    const summary = sys.getRoomSummary();
    assertType(summary.totalRooms, 'number');
    assertType(summary.occupiedRooms, 'number');
    assertType(summary.totalOccupants, 'number');
    cleanup(sys);
  });
});

describe('RoomOccupancyMappingSystem — statistics', () => {
  it('getStatistics returns comprehensive stats', async () => {
    const sys = new RoomOccupancyMappingSystem(createMockHomey());
    await sys.initialize();
    const stats = sys.getStatistics();
    assertType(stats.totalRooms, 'number');
    assert(stats.totalRooms > 0, 'should have rooms');
    cleanup(sys);
  });
});

describe('RoomOccupancyMappingSystem — floor map', () => {
  it('getFloorMap returns floor data', async () => {
    const sys = new RoomOccupancyMappingSystem(createMockHomey());
    await sys.initialize();
    const floorMap = sys.getFloorMap();
    assertType(floorMap, 'object');
    assert(Object.keys(floorMap).length > 0, 'should have floors');
    assert(floorMap['0'], 'should have ground floor');
    assert(floorMap['0'].rooms.length > 0, 'ground floor should have rooms');
    cleanup(sys);
  });
});

run();
