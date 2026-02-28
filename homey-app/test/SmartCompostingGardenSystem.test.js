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

const SmartCompostingGardenSystem = require('../lib/SmartCompostingGardenSystem');

describe('SmartCompostingGardenSystem — constructor', () => {
  it('instantiates without errors', () => {
    const sys = new SmartCompostingGardenSystem(createMockHomey());
    assert(sys, 'should create instance');
    assertEqual(sys.initialized, false);
    assertEqual(sys.compostBins.size, 0);
    assertEqual(sys.gardenZones.size, 0);
    assertEqual(sys.crops.size, 0);
    cleanup(sys);
  });
});

describe('SmartCompostingGardenSystem — initialize', () => {
  it('sets up default compost bin', async () => {
    const sys = new SmartCompostingGardenSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.initialized, true);
    assertEqual(sys.compostBins.size, 1);
    assert(sys.compostBins.has('bin-1'), 'should have default bin');
    const bin = sys.compostBins.get('bin-1');
    assertEqual(bin.type, 'hot-compost');
    assertEqual(bin.capacity, 400);
    cleanup(sys);
  });

  it('does not re-initialize', async () => {
    const sys = new SmartCompostingGardenSystem(createMockHomey());
    await sys.initialize();
    const result = await sys.initialize();
    assertEqual(result, true);
    cleanup(sys);
  });
});

describe('SmartCompostingGardenSystem — addCompostMaterial', () => {
  it('adds green material and updates nutrients', async () => {
    const sys = new SmartCompostingGardenSystem(createMockHomey());
    await sys.initialize();
    const result = await sys.addCompostMaterial('bin-1', {
      type: 'green', name: 'Grass clippings', volumeLiters: 20
    });
    assertEqual(result.success, true);
    assertEqual(result.bin.currentVolume, 20);
    assert(result.bin.nutrients.nitrogen > 0, 'should add nitrogen');
    assertEqual(result.bin.layers.length, 1);
    cleanup(sys);
  });

  it('adds brown material and updates nutrients', async () => {
    const sys = new SmartCompostingGardenSystem(createMockHomey());
    await sys.initialize();
    const result = await sys.addCompostMaterial('bin-1', {
      type: 'brown', name: 'Dry leaves', volumeLiters: 15
    });
    assertEqual(result.success, true);
    assert(result.bin.nutrients.potassium > 0, 'should add potassium');
    assert(result.bin.nutrients.phosphorus > 0, 'should add phosphorus');
    cleanup(sys);
  });

  it('fails for unknown bin', async () => {
    const sys = new SmartCompostingGardenSystem(createMockHomey());
    await sys.initialize();
    const result = await sys.addCompostMaterial('nonexistent', { type: 'green', name: 'Test' });
    assertEqual(result.success, false);
    cleanup(sys);
  });
});

describe('SmartCompostingGardenSystem — recordCompostReading', () => {
  it('records sensor reading', async () => {
    const sys = new SmartCompostingGardenSystem(createMockHomey());
    await sys.initialize();
    const result = await sys.recordCompostReading('bin-1', { temperature: 58, moisture: 55 });
    assertEqual(result.success, true);
    assertEqual(sys.compostBins.get('bin-1').temperature, 58);
    assertEqual(sys.compostBins.get('bin-1').moisture, 55);
    assertEqual(sys.soilReadings.length, 1);
    cleanup(sys);
  });

  it('fails for unknown bin', async () => {
    const sys = new SmartCompostingGardenSystem(createMockHomey());
    await sys.initialize();
    const result = await sys.recordCompostReading('nonexistent', { temperature: 40, moisture: 50 });
    assertEqual(result.success, false);
    cleanup(sys);
  });
});

describe('SmartCompostingGardenSystem — registerGardenZone', () => {
  it('registers a zone with defaults', async () => {
    const sys = new SmartCompostingGardenSystem(createMockHomey());
    await sys.initialize();
    const zone = await sys.registerGardenZone({ name: 'Herb Garden' });
    assert(zone, 'should return zone');
    assertEqual(zone.name, 'Herb Garden');
    assertEqual(zone.soilType, 'loam');
    assertEqual(zone.sunExposure, 'full');
    assertEqual(zone.soilHealth.ph, 6.5);
    assert(sys.gardenZones.size > 0, 'should be in map');
    cleanup(sys);
  });
});

describe('SmartCompostingGardenSystem — setWateringSchedule', () => {
  it('creates a watering schedule', async () => {
    const sys = new SmartCompostingGardenSystem(createMockHomey());
    await sys.initialize();
    const zone = await sys.registerGardenZone({ name: 'Veggie Patch' });
    const schedule = await sys.setWateringSchedule(zone.id, { mode: 'fixed', moistureThreshold: 30 });
    assertEqual(schedule.mode, 'fixed');
    assertEqual(schedule.moistureThreshold, 30);
    assertEqual(schedule.enabled, true);
    assert(sys.wateringSchedules.size > 0, 'should store schedule');
    cleanup(sys);
  });

  it('fails for unknown zone', async () => {
    const sys = new SmartCompostingGardenSystem(createMockHomey());
    await sys.initialize();
    const result = await sys.setWateringSchedule('nonexistent', {});
    assertEqual(result.success, false);
    cleanup(sys);
  });
});

describe('SmartCompostingGardenSystem — planCropRotation', () => {
  it('creates crop rotation plan', async () => {
    const sys = new SmartCompostingGardenSystem(createMockHomey());
    await sys.initialize();
    const zone = await sys.registerGardenZone({ name: 'Main Bed' });
    const result = await sys.planCropRotation(zone.id, [
      { name: 'Tomatoes', family: 'solanaceae', plantDate: '2026-05-01' },
      { name: 'Peas', family: 'legume', plantDate: '2026-04-01' }
    ]);
    assertEqual(result.success, true);
    assertEqual(result.plan.length, 2);
    assertEqual(sys.crops.size, 2);
    assertEqual(sys.rotationPlan.length, 2);
    cleanup(sys);
  });

  it('fails for unknown zone', async () => {
    const sys = new SmartCompostingGardenSystem(createMockHomey());
    await sys.initialize();
    const result = await sys.planCropRotation('nonexistent', []);
    assertEqual(result.success, false);
    cleanup(sys);
  });
});

describe('SmartCompostingGardenSystem — predictHarvest', () => {
  it('predicts harvest date for a crop', async () => {
    const sys = new SmartCompostingGardenSystem(createMockHomey());
    await sys.initialize();
    const zone = await sys.registerGardenZone({ name: 'Plot' });
    await sys.planCropRotation(zone.id, [
      { name: 'Carrots', family: 'root', plantDate: '2025-06-01' }
    ]);
    const cropId = [...sys.crops.keys()][0];
    const prediction = await sys.predictHarvest(cropId);
    assertEqual(prediction.cropName, 'Carrots');
    assertType(prediction.daysGrown, 'number');
    assertType(prediction.estimatedTotalDays, 'number');
    assertType(prediction.progress, 'number');
    assert(prediction.estimatedHarvestDate, 'should have date');
    cleanup(sys);
  });

  it('fails for unknown crop', async () => {
    const sys = new SmartCompostingGardenSystem(createMockHomey());
    await sys.initialize();
    const result = await sys.predictHarvest('nonexistent');
    assertEqual(result.success, false);
    cleanup(sys);
  });
});

describe('SmartCompostingGardenSystem — recordHarvest', () => {
  it('records a harvest and updates crop status', async () => {
    const sys = new SmartCompostingGardenSystem(createMockHomey());
    await sys.initialize();
    const zone = await sys.registerGardenZone({ name: 'Plot' });
    await sys.planCropRotation(zone.id, [
      { name: 'Lettuce', family: 'unknown', plantDate: '2025-06-01' }
    ]);
    const cropId = [...sys.crops.keys()][0];
    const result = await sys.recordHarvest(cropId, { yieldKg: 2.5, quality: 'excellent' });
    assertEqual(result.success, true);
    assertEqual(result.entry.yieldKg, 2.5);
    assertEqual(sys.crops.get(cropId).status, 'harvested');
    assertEqual(sys.harvestLog.length, 1);
    cleanup(sys);
  });

  it('fails for unknown crop', async () => {
    const sys = new SmartCompostingGardenSystem(createMockHomey());
    await sys.initialize();
    const result = await sys.recordHarvest('nonexistent', {});
    assertEqual(result.success, false);
    cleanup(sys);
  });
});

describe('SmartCompostingGardenSystem — getStatus', () => {
  it('returns comprehensive status', async () => {
    const sys = new SmartCompostingGardenSystem(createMockHomey());
    await sys.initialize();
    const status = await sys.getStatus();
    assertEqual(status.initialized, true);
    assertEqual(status.compostBinCount, 1);
    assertType(status.gardenZoneCount, 'number');
    assertType(status.activeCrops, 'number');
    assertType(status.soilReadingsCount, 'number');
    cleanup(sys);
  });
});

describe('SmartCompostingGardenSystem — _getCurrentSeason', () => {
  it('returns a valid season', () => {
    const sys = new SmartCompostingGardenSystem(createMockHomey());
    const season = sys._getCurrentSeason();
    assert(['spring', 'summer', 'autumn', 'winter'].includes(season), 'should be valid season');
    cleanup(sys);
  });
});

describe('SmartCompostingGardenSystem — destroy', () => {
  it('cleans up timers and data', async () => {
    const sys = new SmartCompostingGardenSystem(createMockHomey());
    await sys.initialize();
    sys.destroy();
    assertEqual(sys.initialized, false);
    assertEqual(sys.sensorPollingInterval, null);
    assertEqual(sys.wateringCheckInterval, null);
    assertEqual(sys.compostBins.size, 0);
    cleanup(sys);
  });
});

run();
