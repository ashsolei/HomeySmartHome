'use strict';

const { describe, it, run } = require('./helpers/runner');
const {
  assert, assertEqual, assertType
} = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');

const GardenPlantCareSystem = require('../lib/GardenPlantCareSystem');

/* ──── timer tracking ────
 * _startMonitoring() creates a 15-min setInterval.
 */
const _origSetTimeout = global.setTimeout;
const _origSetInterval = global.setInterval;
const activeHandles = [];

global.setTimeout = (...args) => {
  const id = _origSetTimeout(...args);
  activeHandles.push({ type: 'timeout', id });
  return id;
};
global.setInterval = (...args) => {
  const id = _origSetInterval(...args);
  activeHandles.push({ type: 'interval', id });
  return id;
};

/* ──── helpers ──── */
function createSystem() {
  const homey = createMockHomey();
  // _discoverSoilSensors calls homey.devices.getDevices() — add mock
  homey.devices = Object.assign({}, homey.devices, {
    async getDevices() { return {}; }
  });
  const sys = new GardenPlantCareSystem(homey);
  return { homey, sys };
}

function cleanup(sys) {
  try { sys.destroy(); } catch (_e) { /* ignore */ }
  while (activeHandles.length > 0) {
    const h = activeHandles.pop();
    if (h.type === 'timeout') clearTimeout(h.id);
    else clearInterval(h.id);
  }
}

/* ================================================================
   TESTS
   ================================================================ */

describe('GardenPlantCareSystem — constructor', () => {
  it('creates instance with empty data structures', () => {
    const { sys } = createSystem();
    assertType(sys.plantDatabase, 'object');
    assertType(sys.gardenPlants, 'object');
    assertEqual(sys.initialized, false);
    assertEqual(sys.weatherData, null);
    cleanup(sys);
  });
});

describe('GardenPlantCareSystem — initialize()', () => {
  it('populates plant database and sets initialized=true', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.initialized, true);
    assert(sys.plantDatabase.size > 0, 'plantDatabase should have entries');
    assert(sys.gardenPlants.size > 0, 'gardenPlants should have entries');
    assert(sys.gardenZones.size > 0, 'gardenZones should have entries');
    assert(sys.pestDatabase.size > 0, 'pestDatabase should have entries');
    cleanup(sys);
  });

  it('starts monitoring interval', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assert(sys.monitoringInterval !== null, 'monitoring should be running');
    cleanup(sys);
  });

  it('initializes 10 default plants', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.gardenPlants.size, 10);
    cleanup(sys);
  });

  it('initializes 4 garden zones', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.gardenZones.size, 4);
    assert(sys.gardenZones.has('front_yard'), 'should have front_yard');
    assert(sys.gardenZones.has('greenhouse'), 'should have greenhouse');
    cleanup(sys);
  });
});

describe('GardenPlantCareSystem — waterPlant()', () => {
  it('increases moisture and returns success', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const plantId = Array.from(sys.gardenPlants.keys())[0];
    const plant = sys.gardenPlants.get(plantId);
    const oldMoisture = plant.currentMoisture;
    const result = sys.waterPlant(plantId, 2);
    assertEqual(result.success, true);
    assert(plant.currentMoisture > oldMoisture, 'moisture should increase');
    assert(plant.currentMoisture <= 100, 'moisture capped at 100');
    cleanup(sys);
  });

  it('caps moisture at 100', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const plantId = Array.from(sys.gardenPlants.keys())[0];
    sys.waterPlant(plantId, 20); // 20 * 10 = +200, should cap
    assertEqual(sys.gardenPlants.get(plantId).currentMoisture, 100);
    cleanup(sys);
  });

  it('tracks water usage', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const plantId = Array.from(sys.gardenPlants.keys())[0];
    const before = sys.waterUsage.totalLiters;
    sys.waterPlant(plantId, 3);
    assertEqual(sys.waterUsage.totalLiters, before + 3);
    cleanup(sys);
  });

  it('returns failure for unknown plant', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const result = sys.waterPlant('nonexistent', 1);
    assertEqual(result.success, false);
    assertEqual(result.reason, 'plant_not_found');
    cleanup(sys);
  });
});

describe('GardenPlantCareSystem — skipIfRainForecast()', () => {
  it('recommends skip when precipitation is high', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    sys.setWeatherData({
      precipitation: 5,
      forecast: [{ precipitation: 10 }]
    });
    const result = sys.skipIfRainForecast();
    assertEqual(result.skip, true);
    cleanup(sys);
  });

  it('does not skip when dry weather', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    sys.setWeatherData({
      precipitation: 0,
      forecast: [{ precipitation: 0 }]
    });
    const result = sys.skipIfRainForecast();
    assertEqual(result.skip, false);
    cleanup(sys);
  });

  it('does not skip without weather data', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const result = sys.skipIfRainForecast();
    assertEqual(result.skip, false);
    cleanup(sys);
  });
});

describe('GardenPlantCareSystem — adjustForHeat()', () => {
  it('returns 1.5x multiplier in extreme heat', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const plantId = Array.from(sys.gardenPlants.keys())[0];
    const plant = sys.gardenPlants.get(plantId);
    const species = sys.plantDatabase.get(plant.speciesId);
    // Set temp well above optimal max + 5
    sys.setWeatherData({ temperature: species.optimalTemp[1] + 10 });
    const result = sys.adjustForHeat(plantId);
    assertEqual(result.wateringMultiplier, 1.5);
    cleanup(sys);
  });

  it('returns 0.75x multiplier in cold weather', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const plantId = Array.from(sys.gardenPlants.keys())[0];
    const plant = sys.gardenPlants.get(plantId);
    const species = sys.plantDatabase.get(plant.speciesId);
    sys.setWeatherData({ temperature: species.optimalTemp[0] - 5 });
    const result = sys.adjustForHeat(plantId);
    assertEqual(result.wateringMultiplier, 0.75);
    cleanup(sys);
  });
});

describe('GardenPlantCareSystem — getGrowthStage() / advanceStage()', () => {
  it('returns current growth stage', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const plantId = Array.from(sys.gardenPlants.keys())[0];
    const stage = sys.getGrowthStage(plantId);
    assertType(stage.currentStage, 'string');
    assertType(stage.stageIndex, 'number');
    assert(stage.stageIndex >= 0, 'stageIndex should be non-negative');
    cleanup(sys);
  });

  it('advances to next stage', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const plantId = Array.from(sys.gardenPlants.keys())[0];
    const before = sys.getGrowthStage(plantId);
    const result = sys.advanceStage(plantId);
    assertEqual(result.success, true);
    assertEqual(result.previousStage, before.currentStage);
    // growthLog should have an entry
    assert(sys.gardenPlants.get(plantId).growthLog.length > 0, 'should log growth');
    cleanup(sys);
  });

  it('returns failure for unknown plant', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const result = sys.advanceStage('unknown');
    assertEqual(result.success, false);
    cleanup(sys);
  });
});

describe('GardenPlantCareSystem — getCompanionSuggestions()', () => {
  it('returns suggestions with good/bad/neutral arrays', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const result = sys.getCompanionSuggestions('tomato');
    assertEqual(result.speciesId, 'tomato');
    assert(Array.isArray(result.good), 'good should be array');
    assert(Array.isArray(result.bad), 'bad should be array');
    assert(Array.isArray(result.neutral), 'neutral should be array');
    cleanup(sys);
  });

  it('returns empty arrays for unknown species', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const result = sys.getCompanionSuggestions('alien_plant');
    assertEqual(result.good.length, 0);
    assertEqual(result.bad.length, 0);
    cleanup(sys);
  });
});

describe('GardenPlantCareSystem — estimateHarvestDate()', () => {
  it('returns harvest estimate for known plant', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const plantId = Array.from(sys.gardenPlants.keys())[0];
    const result = sys.estimateHarvestDate(plantId);
    assertType(result.daysRemaining, 'number');
    assertType(result.progressPercent, 'number');
    assertType(result.isReadyToHarvest, 'boolean');
    assertType(result.estimatedHarvestDate, 'string');
    cleanup(sys);
  });

  it('returns null for unknown plant', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const result = sys.estimateHarvestDate('unknown');
    assertEqual(result, null);
    cleanup(sys);
  });
});

describe('GardenPlantCareSystem — checkFrostRisk()', () => {
  it('detects frost when temp < 3', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    sys.setWeatherData({ temperature: 1 });
    const result = sys.checkFrostRisk();
    assertEqual(result.frostRisk, true);
    assert(result.affectedPlants.length > 0, 'should have affected plants');
    cleanup(sys);
  });

  it('detects severe frost when temp < -5', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    sys.setWeatherData({ temperature: -10 });
    const result = sys.checkFrostRisk();
    assertEqual(result.frostRisk, true);
    assertEqual(result.severeFrost, true);
    cleanup(sys);
  });

  it('no frost risk in warm weather', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    sys.setWeatherData({ temperature: 20 });
    const result = sys.checkFrostRisk();
    assertEqual(result.frostRisk, false);
    cleanup(sys);
  });

  it('excludes greenhouse plants from affected list', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    sys.setWeatherData({ temperature: 1 });
    const result = sys.checkFrostRisk();
    const ghPlants = result.affectedPlants.filter(p => p.zone === 'greenhouse');
    assertEqual(ghPlants.length, 0);
    cleanup(sys);
  });
});

describe('GardenPlantCareSystem — fertilizePlant()', () => {
  it('updates lastFertilized and logs entry', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const plantId = Array.from(sys.gardenPlants.keys())[0];
    const before = sys.fertilizationLog.length;
    const result = sys.fertilizePlant(plantId);
    assertEqual(result.success, true);
    assertEqual(sys.fertilizationLog.length, before + 1);
    assert(sys.gardenPlants.get(plantId).lastFertilized !== null, 'lastFertilized updated');
    cleanup(sys);
  });

  it('returns failure for unknown plant', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const result = sys.fertilizePlant('unknown');
    assertEqual(result.success, false);
    cleanup(sys);
  });
});

describe('GardenPlantCareSystem — getFertilizationRecommendations()', () => {
  it('returns stage-based NPK recommendation', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const plantId = Array.from(sys.gardenPlants.keys())[0];
    const rec = sys.getFertilizationRecommendations(plantId);
    assertType(rec.recommendedNPK, 'string');
    assertType(rec.currentStage, 'string');
    cleanup(sys);
  });
});

describe('GardenPlantCareSystem — identifyPest()', () => {
  it('identifies pests from symptoms', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const result = sys.identifyPest(['yellow_leaves', 'sticky_residue']);
    assert(Array.isArray(result.matches), 'matches should be array');
    assert(result.matches.length > 0, 'should match at least one pest');
    assertType(result.matches[0].pestId, 'string');
    assertType(result.matches[0].matchScore, 'number');
    cleanup(sys);
  });

  it('returns empty matches for unmatched symptoms', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const result = sys.identifyPest(['alien_invasion']);
    assertEqual(result.matches.length, 0);
    cleanup(sys);
  });
});

describe('GardenPlantCareSystem — getStatistics()', () => {
  it('returns comprehensive statistics', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const stats = sys.getStatistics();
    assertEqual(stats.totalPlantEntries, 10);
    assertType(stats.totalPlantCount, 'number');
    assertType(stats.avgHealthScore, 'number');
    assertType(stats.waterUsage, 'object');
    cleanup(sys);
  });
});

describe('GardenPlantCareSystem — destroy()', () => {
  it('clears monitoring interval', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assert(sys.monitoringInterval !== null, 'should have interval');
    sys.destroy();
    assertEqual(sys.monitoringInterval, null);
    cleanup(sys);
  });
});

run();
