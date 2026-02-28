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

const SmartHomeDigitalTwinSystem = require('../lib/SmartHomeDigitalTwinSystem');

describe('SmartHomeDigitalTwinSystem — constructor', () => {
  it('instantiates without errors', () => {
    const sys = new SmartHomeDigitalTwinSystem(createMockHomey());
    assert(sys, 'should create instance');
    assert(sys.properties.size >= 3, 'should have default properties');
    assert(sys.rooms.size >= 8, 'should have default rooms');
    cleanup(sys);
  });
});

describe('SmartHomeDigitalTwinSystem — initialize', () => {
  it('initializes and starts monitoring', async () => {
    const sys = new SmartHomeDigitalTwinSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys._initialized, true);
    cleanup(sys);
  });
});

describe('SmartHomeDigitalTwinSystem — room management', () => {
  it('addRoom creates a new room', async () => {
    const sys = new SmartHomeDigitalTwinSystem(createMockHomey());
    await sys.initialize();
    const room = sys.addRoom('attic', 'Attic', 2, 15);
    assert(room, 'should return room');
    assertEqual(room.id, 'attic');
    assertEqual(room.label, 'Attic');
    assertEqual(room.floor, 2);
    assertEqual(room.area_m2, 15);
    assert(sys.rooms.has('attic'), 'should be in rooms map');
    cleanup(sys);
  });

  it('addRoom returns existing room if duplicate', async () => {
    const sys = new SmartHomeDigitalTwinSystem(createMockHomey());
    await sys.initialize();
    const room = sys.addRoom('living_room', 'Duplicate');
    assertEqual(room.id, 'living_room');
    assertEqual(room.label, 'Living Room');
    cleanup(sys);
  });

  it('removeRoom removes existing room', async () => {
    const sys = new SmartHomeDigitalTwinSystem(createMockHomey());
    await sys.initialize();
    sys.addRoom('temp_room', 'Temp', 0, 5);
    assertEqual(sys.removeRoom('temp_room'), true);
    assertEqual(sys.rooms.has('temp_room'), false);
    cleanup(sys);
  });

  it('removeRoom returns false for unknown room', async () => {
    const sys = new SmartHomeDigitalTwinSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.removeRoom('nonexistent'), false);
    cleanup(sys);
  });

  it('getRoom returns room or null', async () => {
    const sys = new SmartHomeDigitalTwinSystem(createMockHomey());
    await sys.initialize();
    assert(sys.getRoom('living_room'), 'should find living room');
    assertEqual(sys.getRoom('nonexistent'), null);
    cleanup(sys);
  });

  it('listRooms returns all rooms', async () => {
    const sys = new SmartHomeDigitalTwinSystem(createMockHomey());
    await sys.initialize();
    const rooms = sys.listRooms();
    assert(rooms.length >= 8, 'should have rooms');
    assert(rooms[0].id, 'should have id field');
    cleanup(sys);
  });

  it('listRooms filters by property', async () => {
    const sys = new SmartHomeDigitalTwinSystem(createMockHomey());
    await sys.initialize();
    const homeRooms = sys.listRooms('home');
    assert(homeRooms.length > 0, 'should have home rooms');
    assert(homeRooms.every(r => r.propertyId === 'home'), 'all should be home');
    cleanup(sys);
  });
});

describe('SmartHomeDigitalTwinSystem — sensor data', () => {
  it('updateSensorData records sensor value', async () => {
    const sys = new SmartHomeDigitalTwinSystem(createMockHomey());
    await sys.initialize();
    const result = sys.updateSensorData('living_room', 'temp', 22.5);
    assert(result, 'should return result');
    assertEqual(result.roomId, 'living_room');
    assertEqual(result.newValue, 22.5);
    assertType(result.previousValue, 'number');
    cleanup(sys);
  });

  it('updateSensorData returns null for unknown room', async () => {
    const sys = new SmartHomeDigitalTwinSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.updateSensorData('nonexistent', 'temp', 22), null);
    cleanup(sys);
  });

  it('updateSensorData returns null for unknown sensor type', async () => {
    const sys = new SmartHomeDigitalTwinSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.updateSensorData('living_room', 'nonexistent', 42), null);
    cleanup(sys);
  });

  it('getSensorOverlay returns sensor overview', async () => {
    const sys = new SmartHomeDigitalTwinSystem(createMockHomey());
    await sys.initialize();
    sys.updateSensorData('kitchen', 'temp', 21.0);
    const overlay = sys.getSensorOverlay('kitchen');
    assert(overlay, 'should return overlay');
    assertEqual(overlay.roomId, 'kitchen');
    assert(overlay.sensors, 'should have sensors');
    cleanup(sys);
  });
});

describe('SmartHomeDigitalTwinSystem — device management', () => {
  it('registerDevice adds a device', async () => {
    const sys = new SmartHomeDigitalTwinSystem(createMockHomey());
    await sys.initialize();
    const device = sys.registerDevice('lamp-01', 'light', 'living_room');
    assert(device, 'should return device');
    assertEqual(device.id, 'lamp-01');
    assertEqual(device.type, 'light');
    assertEqual(device.roomId, 'living_room');
    cleanup(sys);
  });

  it('updateDeviceState updates device', async () => {
    const sys = new SmartHomeDigitalTwinSystem(createMockHomey());
    await sys.initialize();
    sys.registerDevice('therm-01', 'thermostat', 'bedroom');
    const result = sys.updateDeviceState('therm-01', { temperature: 21, mode: 'heat' });
    assert(result, 'should return result');
    assertEqual(result.deviceId, 'therm-01');
    assertEqual(result.newState.temperature, 21);
    assertEqual(result.newState.mode, 'heat');
    assert(result.timestamp, 'should have timestamp');
    cleanup(sys);
  });

  it('updateDeviceState creates entry for unknown device', async () => {
    const sys = new SmartHomeDigitalTwinSystem(createMockHomey());
    await sys.initialize();
    const result = sys.updateDeviceState('nonexistent', { val: 1 });
    assert(result, 'should return result');
    assertEqual(result.deviceId, 'nonexistent');
    assertEqual(result.newState.val, 1);
    cleanup(sys);
  });

  it('getDeviceStateSummary returns summary', async () => {
    const sys = new SmartHomeDigitalTwinSystem(createMockHomey());
    await sys.initialize();
    sys.registerDevice('dev-01', 'light', 'kitchen');
    const summary = sys.getDeviceStateSummary();
    assert(summary, 'should return summary');
    assertType(summary.totalDevices, 'number');
    cleanup(sys);
  });
});

describe('SmartHomeDigitalTwinSystem — occupancy', () => {
  it('recordOccupancy records count', async () => {
    const sys = new SmartHomeDigitalTwinSystem(createMockHomey());
    await sys.initialize();
    const result = sys.recordOccupancy('living_room', 3);
    assert(result, 'should return result');
    assertEqual(result.count, 3);
    cleanup(sys);
  });

  it('recordOccupancy returns null for unknown room', async () => {
    const sys = new SmartHomeDigitalTwinSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.recordOccupancy('nonexistent', 1), null);
    cleanup(sys);
  });

  it('generateHeatmap returns heatmap data', async () => {
    const sys = new SmartHomeDigitalTwinSystem(createMockHomey());
    await sys.initialize();
    sys.recordOccupancy('kitchen', 2);
    const heatmap = sys.generateHeatmap('day');
    assert(heatmap, 'should return heatmap');
    assert(heatmap.rooms, 'should have rooms');
    cleanup(sys);
  });
});

describe('SmartHomeDigitalTwinSystem — simulation', () => {
  it('simulateChange handles add_insulation', async () => {
    const sys = new SmartHomeDigitalTwinSystem(createMockHomey());
    await sys.initialize();
    const result = sys.simulateChange('add_insulation', { currentHeatingKwh: 5000, quality: 'standard' });
    assert(result, 'should return result');
    assert(result.result, 'should have result');
    assertEqual(result.result.reductionPercent, 25);
    assertType(result.result.savedKwhPerYear, 'number');
    assertType(result.result.estimatedSavingsEuro, 'number');
    cleanup(sys);
  });

  it('simulateChange handles change_thermostat', async () => {
    const sys = new SmartHomeDigitalTwinSystem(createMockHomey());
    await sys.initialize();
    const result = sys.simulateChange('change_thermostat', { currentTemp: 22, newTemp: 20, area_m2: 100 });
    assert(result, 'should return result');
    assertType(result.result.temperatureChange, 'number');
    assertType(result.result.savedKwhPerYear, 'number');
    cleanup(sys);
  });

  it('simulateChange returns error for unknown type', async () => {
    const sys = new SmartHomeDigitalTwinSystem(createMockHomey());
    await sys.initialize();
    const result = sys.simulateChange('nonexistent_type', {});
    assert(result.result.error, 'should have error');
    cleanup(sys);
  });
});

describe('SmartHomeDigitalTwinSystem — anomaly detection', () => {
  it('detectAnomalies returns anomaly report for room', async () => {
    const sys = new SmartHomeDigitalTwinSystem(createMockHomey());
    await sys.initialize();
    const result = sys.detectAnomalies('living_room');
    assert(result, 'should return result');
    assertEqual(result.roomId, 'living_room');
    assert(Array.isArray(result.anomalies), 'should have anomalies array');
    assert(Array.isArray(result.checked), 'should have checked array');
    assert(result.detectedAt, 'should have timestamp');
    cleanup(sys);
  });

  it('detectAllAnomalies scans all rooms', async () => {
    const sys = new SmartHomeDigitalTwinSystem(createMockHomey());
    await sys.initialize();
    const anomalies = sys.detectAllAnomalies();
    assert(anomalies, 'should return result');
    cleanup(sys);
  });
});

describe('SmartHomeDigitalTwinSystem — snapshots', () => {
  it('captureSnapshot records state', async () => {
    const sys = new SmartHomeDigitalTwinSystem(createMockHomey());
    await sys.initialize();
    const snapshot = sys.captureSnapshot();
    assert(snapshot, 'should return snapshot');
    assert(snapshot.timestamp, 'should have timestamp');
    assert(snapshot.rooms, 'should have rooms');
    cleanup(sys);
  });
});

describe('SmartHomeDigitalTwinSystem — comfort & efficiency', () => {
  it('calculateComfortScore returns score for room', async () => {
    const sys = new SmartHomeDigitalTwinSystem(createMockHomey());
    await sys.initialize();
    const score = sys.calculateComfortScore('bedroom');
    assert(score, 'should return score');
    assertType(score.overall, 'number');
    assert(score.overall >= 0 && score.overall <= 100, 'score in range');
    cleanup(sys);
  });

  it('calculateRoomEfficiency returns efficiency', async () => {
    const sys = new SmartHomeDigitalTwinSystem(createMockHomey());
    await sys.initialize();
    const efficiency = sys.calculateRoomEfficiency('kitchen');
    assert(efficiency, 'should return efficiency');
    assertEqual(efficiency.roomId, 'kitchen');
    assertType(efficiency.kwhPerM2, 'number');
    assert(efficiency.rating, 'should have rating');
    cleanup(sys);
  });

  it('calculateOverallEfficiency returns system efficiency', async () => {
    const sys = new SmartHomeDigitalTwinSystem(createMockHomey());
    await sys.initialize();
    const efficiency = sys.calculateOverallEfficiency();
    assert(efficiency, 'should return efficiency');
    assert(efficiency.rooms, 'should have rooms breakdown');
    assertType(efficiency.overallKwhPerM2, 'number');
    assertType(efficiency.totalArea, 'number');
    cleanup(sys);
  });
});

describe('SmartHomeDigitalTwinSystem — device groups', () => {
  it('createGroup creates a group', async () => {
    const sys = new SmartHomeDigitalTwinSystem(createMockHomey());
    await sys.initialize();
    sys.registerDevice('l1', 'light', 'living_room');
    sys.registerDevice('l2', 'light', 'living_room');
    const group = sys.createGroup('Living Lights', ['l1', 'l2']);
    assert(group, 'should return group');
    assertEqual(group.name, 'Living Lights');
    assertEqual(group.deviceIds.length, 2);
    cleanup(sys);
  });

  it('addToGroup adds device to group', async () => {
    const sys = new SmartHomeDigitalTwinSystem(createMockHomey());
    await sys.initialize();
    sys.registerDevice('l1', 'light', 'living_room');
    sys.registerDevice('l3', 'light', 'living_room');
    sys.createGroup('Lights', ['l1']);
    assertEqual(sys.addToGroup('Lights', 'l3'), true);
    cleanup(sys);
  });

  it('removeFromGroup removes device from group', async () => {
    const sys = new SmartHomeDigitalTwinSystem(createMockHomey());
    await sys.initialize();
    sys.registerDevice('l1', 'light', 'living_room');
    sys.registerDevice('l2', 'light', 'living_room');
    sys.createGroup('Lights', ['l1', 'l2']);
    assertEqual(sys.removeFromGroup('Lights', 'l2'), true);
    cleanup(sys);
  });

  it('deleteGroup deletes a group', async () => {
    const sys = new SmartHomeDigitalTwinSystem(createMockHomey());
    await sys.initialize();
    sys.createGroup('Test', []);
    assertEqual(sys.deleteGroup('Test'), true);
    assertEqual(sys.deleteGroup('Test'), false);
    cleanup(sys);
  });

  it('listGroups returns all groups', async () => {
    const sys = new SmartHomeDigitalTwinSystem(createMockHomey());
    await sys.initialize();
    sys.createGroup('A', []);
    sys.createGroup('B', []);
    const groups = sys.listGroups();
    assert(groups.length >= 2, 'should have groups');
    cleanup(sys);
  });
});

describe('SmartHomeDigitalTwinSystem — device health', () => {
  it('getDeviceHealthMap returns health info', async () => {
    const sys = new SmartHomeDigitalTwinSystem(createMockHomey());
    await sys.initialize();
    sys.registerDevice('sensor-01', 'sensor', 'bathroom');
    const health = sys.getDeviceHealthMap();
    assert(health, 'should return health map');
    cleanup(sys);
  });

  it('reportDeviceError records error', async () => {
    const sys = new SmartHomeDigitalTwinSystem(createMockHomey());
    await sys.initialize();
    sys.registerDevice('dev-err', 'sensor', 'hallway');
    const result = sys.reportDeviceError('dev-err', 'Connection lost');
    assertEqual(result, true);
    cleanup(sys);
  });

  it('clearDeviceErrors clears errors', async () => {
    const sys = new SmartHomeDigitalTwinSystem(createMockHomey());
    await sys.initialize();
    sys.registerDevice('dev-err2', 'sensor', 'hallway');
    sys.reportDeviceError('dev-err2', 'Timeout');
    const result = sys.clearDeviceErrors('dev-err2');
    assertEqual(result, true);
    cleanup(sys);
  });
});

describe('SmartHomeDigitalTwinSystem — properties', () => {
  it('addProperty adds a new property', async () => {
    const sys = new SmartHomeDigitalTwinSystem(createMockHomey());
    await sys.initialize();
    const result = sys.addProperty('cabin', 'Mountain Cabin', 'vacation');
    assert(result, 'should return property');
    assertEqual(result.id, 'cabin');
    assert(sys.properties.has('cabin'), 'should be in map');
    cleanup(sys);
  });

  it('removeProperty removes a property', async () => {
    const sys = new SmartHomeDigitalTwinSystem(createMockHomey());
    await sys.initialize();
    sys.addProperty('temp_prop', 'Temp', 'other');
    assertEqual(sys.removeProperty('temp_prop'), true);
    cleanup(sys);
  });

  it('listProperties returns all properties', async () => {
    const sys = new SmartHomeDigitalTwinSystem(createMockHomey());
    await sys.initialize();
    const props = sys.listProperties();
    assert(props.length >= 3, 'should have properties');
    cleanup(sys);
  });
});

describe('SmartHomeDigitalTwinSystem — settings', () => {
  it('updateSettings merges new settings', async () => {
    const sys = new SmartHomeDigitalTwinSystem(createMockHomey());
    await sys.initialize();
    const result = sys.updateSettings({ historyRetentionDays: 14 });
    assert(result, 'should return settings');
    assertEqual(result.historyRetentionDays, 14);
    cleanup(sys);
  });

  it('getSettings returns current settings', async () => {
    const sys = new SmartHomeDigitalTwinSystem(createMockHomey());
    await sys.initialize();
    const settings = sys.getSettings();
    assert(settings, 'should return settings');
    assertType(settings.historyRetentionDays, 'number');
    cleanup(sys);
  });
});

describe('SmartHomeDigitalTwinSystem — export', () => {
  it('exportTwinModel returns full model', async () => {
    const sys = new SmartHomeDigitalTwinSystem(createMockHomey());
    await sys.initialize();
    const model = sys.exportTwinModel();
    assert(model, 'should return model');
    assert(model.version, 'should have version');
    assert(model.properties, 'should have properties');
    assert(model.rooms, 'should have rooms');
    assert(model.deviceStates, 'should have deviceStates');
    assert(model.deviceGroups, 'should have deviceGroups');
    assert(model.exportedAt, 'should have exportedAt');
    cleanup(sys);
  });
});

describe('SmartHomeDigitalTwinSystem — getStatistics', () => {
  it('returns comprehensive statistics', async () => {
    const sys = new SmartHomeDigitalTwinSystem(createMockHomey());
    await sys.initialize();
    const stats = sys.getStatistics();
    assertType(stats.rooms, 'number');
    assertType(stats.devices, 'number');
    assertType(stats.properties, 'number');
    assert(stats.rooms >= 8, 'should have rooms');
    assert(stats.properties >= 3, 'should have properties');
    assertEqual(stats.initialized, true);
    assertType(stats.averageComfortScore, 'number');
    cleanup(sys);
  });
});

describe('SmartHomeDigitalTwinSystem — destroy', () => {
  it('cleans up monitoring interval', async () => {
    const sys = new SmartHomeDigitalTwinSystem(createMockHomey());
    await sys.initialize();
    await sys.destroy();
    assertEqual(sys._monitoringInterval, null);
    cleanup(sys);
  });
});

run();
