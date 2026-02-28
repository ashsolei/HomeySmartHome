'use strict';

const { describe, it, run } = require('./helpers/runner');
const {
  assert, assertEqual, assertType, assertInstanceOf
} = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');
const AdvancedIndoorPlantCareSystem = require('../lib/AdvancedIndoorPlantCareSystem');

/* ──── helpers ──── */

function createSystem() {
  const homey = createMockHomey();
  // _discoverSensors calls homey.devices.getDevices() which returns an OBJECT
  if (!homey.devices) homey.devices = {};
  homey.devices.getDevices = () => ({});
  const sys = new AdvancedIndoorPlantCareSystem(homey);
  return { sys, homey };
}

async function createInitialisedSystem() {
  const { sys, homey } = createSystem();
  await sys.initialize();
  return { sys, homey };
}

function cleanup(sys) {
  if (sys.monitoringInterval) {
    clearInterval(sys.monitoringInterval);
    sys.monitoringInterval = null;
  }
  if (sys.lightCompensationInterval) {
    clearInterval(sys.lightCompensationInterval);
    sys.lightCompensationInterval = null;
  }
}

/** instances is an ARRAY of objects, not a Map. Collect all instanceIds across species. */
function getAllInstanceIds(sys) {
  const ids = [];
  for (const [, profile] of sys.plantProfiles) {
    if (Array.isArray(profile.instances)) {
      for (const inst of profile.instances) {
        ids.push(inst.instanceId);
      }
    }
  }
  return ids;
}

/** Finds an instance object by instanceId across all species. */
function findInstance(sys, instanceId) {
  for (const [, profile] of sys.plantProfiles) {
    if (Array.isArray(profile.instances)) {
      const found = profile.instances.find(i => i.instanceId === instanceId);
      if (found) return found;
    }
  }
  return null;
}

/* ================================================================
   TESTS
   ================================================================ */

// ── Constructor ──
describe('AdvancedIndoorPlantCareSystem — constructor', () => {
  it('creates instance with homey reference', () => {
    const { sys, homey } = createSystem();
    assertEqual(sys.homey, homey);
    cleanup(sys);
  });

  it('has empty Maps before initialization', () => {
    const { sys } = createSystem();
    assertInstanceOf(sys.plantProfiles, Map);
    assertInstanceOf(sys.growLightProfiles, Map);
    assertInstanceOf(sys.humidityZones, Map);
    assertInstanceOf(sys.roomMicroclimates, Map);
    cleanup(sys);
  });

  it('initializes growthJournal as empty array', () => {
    const { sys } = createSystem();
    assert(Array.isArray(sys.growthJournal));
    assertEqual(sys.growthJournal.length, 0);
    cleanup(sys);
  });

  it('is not initialized before initialize()', () => {
    const { sys } = createSystem();
    assertEqual(sys.initialized, false);
    cleanup(sys);
  });
});

// ── initialize() ──
describe('AdvancedIndoorPlantCareSystem — initialize', () => {
  it('sets initialized to true', async () => {
    const { sys } = await createInitialisedSystem();
    assertEqual(sys.initialized, true);
    cleanup(sys);
  });

  it('populates 20 plant species profiles', async () => {
    const { sys } = await createInitialisedSystem();
    assertEqual(sys.plantProfiles.size, 20);
    cleanup(sys);
  });

  it('creates 8 plant instances', async () => {
    const { sys } = await createInitialisedSystem();
    const ids = getAllInstanceIds(sys);
    assertEqual(ids.length, 8);
    cleanup(sys);
  });

  it('populates 5 grow light profiles', async () => {
    const { sys } = await createInitialisedSystem();
    assertEqual(sys.growLightProfiles.size, 5);
    cleanup(sys);
  });

  it('populates 5 humidity zones', async () => {
    const { sys } = await createInitialisedSystem();
    assertEqual(sys.humidityZones.size, 5);
    cleanup(sys);
  });

  it('populates 5 room microclimates', async () => {
    const { sys } = await createInitialisedSystem();
    assertEqual(sys.roomMicroclimates.size, 5);
    cleanup(sys);
  });

  it('populates 8 pests in pestDatabase', async () => {
    const { sys } = await createInitialisedSystem();
    assertEqual(sys.pestDatabase.size, 8);
    cleanup(sys);
  });

  it('starts monitoring interval', async () => {
    const { sys } = await createInitialisedSystem();
    assert(sys.monitoringInterval !== null);
    cleanup(sys);
  });

  it('starts light compensation interval', async () => {
    const { sys } = await createInitialisedSystem();
    assert(sys.lightCompensationInterval !== null);
    cleanup(sys);
  });
});

// ── Plant instance details (instances is an ARRAY of objects) ──
describe('AdvancedIndoorPlantCareSystem — plant instances', () => {
  it('Big Monty is a monstera instance', async () => {
    const { sys } = await createInitialisedSystem();
    const monstera = sys.plantProfiles.get('monstera_deliciosa');
    assert(monstera !== undefined);
    const bigMonty = monstera.instances.find(i => i.nickname === 'Big Monty');
    assert(bigMonty !== undefined, 'Big Monty should exist');
    assertEqual(bigMonty.instanceId, 'plant_001');
    assertEqual(bigMonty.room, 'living_room');
    cleanup(sys);
  });

  it('instances have watering and health data', async () => {
    const { sys } = await createInitialisedSystem();
    const inst = findInstance(sys, 'plant_001');
    assert(inst !== null);
    assertType(inst.lastWatered, 'number');
    assertType(inst.room, 'string');
    assertType(inst.currentMoisture, 'number');
    assertType(inst.healthScore, 'number');
    cleanup(sys);
  });

  it('each instance has a unique ID', async () => {
    const { sys } = await createInitialisedSystem();
    const ids = getAllInstanceIds(sys);
    const unique = new Set(ids);
    assertEqual(unique.size, ids.length);
    cleanup(sys);
  });
});

// ── shouldWater (returns object, NOT boolean; does NOT throw for unknown) ──
describe('AdvancedIndoorPlantCareSystem — shouldWater', () => {
  it('returns object with shouldWater boolean', async () => {
    const { sys } = await createInitialisedSystem();
    const result = sys.shouldWater('plant_001');
    assertType(result, 'object');
    assertType(result.shouldWater, 'boolean');
    assertType(result.daysSinceWatered, 'number');
    cleanup(sys);
  });

  it('indicates watering needed when overdue', async () => {
    const { sys } = await createInitialisedSystem();
    const inst = findInstance(sys, 'plant_001');
    inst.lastWatered = Date.now() - 30 * 86400000; // 30 days ago
    inst.currentMoisture = 10; // way below optimal
    const result = sys.shouldWater('plant_001');
    assertEqual(result.shouldWater, true);
    cleanup(sys);
  });

  it('returns instance_not_found for unknown instance', async () => {
    const { sys } = await createInitialisedSystem();
    const result = sys.shouldWater('nonexistent-001');
    assertEqual(result.shouldWater, false);
    assertEqual(result.reason, 'instance_not_found');
    cleanup(sys);
  });

  it('includes season and temperature adjustments', async () => {
    const { sys } = await createInitialisedSystem();
    const result = sys.shouldWater('plant_001');
    assertType(result.adjustedFrequencyDays, 'number');
    assertType(result.isWinter, 'boolean');
    assertType(result.tempAdjustment, 'number');
    cleanup(sys);
  });
});

// ── waterPlant (returns result object, NOT throw for unknown) ──
describe('AdvancedIndoorPlantCareSystem — waterPlant', () => {
  it('updates lastWatered timestamp', async () => {
    const { sys } = await createInitialisedSystem();
    const inst = findInstance(sys, 'plant_001');
    const before = inst.lastWatered;
    await new Promise(r => setTimeout(r, 5));
    sys.waterPlant('plant_001', 200);
    assert(inst.lastWatered > before, 'lastWatered should be updated');
    cleanup(sys);
  });

  it('updates moisture level', async () => {
    const { sys } = await createInitialisedSystem();
    const inst = findInstance(sys, 'plant_001');
    inst.currentMoisture = 20;
    sys.waterPlant('plant_001', 300);
    assert(inst.currentMoisture > 20, 'moisture should increase after watering');
    cleanup(sys);
  });

  it('returns success result with details', async () => {
    const { sys } = await createInitialisedSystem();
    const result = sys.waterPlant('plant_001', 250);
    assertType(result, 'object');
    assertEqual(result.success, true);
    assertEqual(result.amountMl, 250);
    assertType(result.newMoisture, 'number');
    cleanup(sys);
  });

  it('returns failure for unknown instance', async () => {
    const { sys } = await createInitialisedSystem();
    const result = sys.waterPlant('nonexistent-001', 100);
    assertEqual(result.success, false);
    assertEqual(result.reason, 'instance_not_found');
    cleanup(sys);
  });
});

// ── shouldFertilize ──
describe('AdvancedIndoorPlantCareSystem — shouldFertilize', () => {
  it('returns object with fertilization info', async () => {
    const { sys } = await createInitialisedSystem();
    const result = sys.shouldFertilize('plant_001');
    assertType(result, 'object');
    assertType(result.shouldFertilize, 'boolean');
    cleanup(sys);
  });

  it('recommends fertilization when overdue', async () => {
    const { sys } = await createInitialisedSystem();
    const schedule = sys.fertilizationSchedules.get('plant_001');
    assert(schedule !== undefined, 'plant_001 should have a fertilization schedule');
    schedule.lastFertilized = Date.now() - 180 * 86400000; // 6 months ago
    const result = sys.shouldFertilize('plant_001');
    // During growing season (month 3-9) this should be true
    const month = new Date().getMonth();
    const isWinter = month >= 10 || month <= 2;
    if (!isWinter) {
      assertEqual(result.shouldFertilize, true);
    }
    cleanup(sys);
  });

  it('returns no_schedule for unknown instance', async () => {
    const { sys } = await createInitialisedSystem();
    const result = sys.shouldFertilize('nonexistent-001');
    assertEqual(result.shouldFertilize, false);
    assertEqual(result.reason, 'no_schedule');
    cleanup(sys);
  });
});

// ── fertilize ──
describe('AdvancedIndoorPlantCareSystem — fertilize', () => {
  it('updates fertilization schedule and adds to history', async () => {
    const { sys } = await createInitialisedSystem();
    const before = sys.fertilizationSchedules.get('plant_001').history.length;
    const result = sys.fertilize('plant_001', '10-10-10');
    assertEqual(result.success, true);
    assertType(result.nickname, 'string');
    const after = sys.fertilizationSchedules.get('plant_001').history.length;
    assertEqual(after, before + 1);
    cleanup(sys);
  });

  it('trims history at >200 to last 100 entries', async () => {
    const { sys } = await createInitialisedSystem();
    const schedule = sys.fertilizationSchedules.get('plant_001');
    // Pre-fill with 201 entries
    for (let i = 0; i < 201; i++) {
      schedule.history.push({ timestamp: Date.now(), npkRatio: '10-10-10', dilution: 'half_strength' });
    }
    sys.fertilize('plant_001', '5-5-5');
    // After fertilize, history > 200, so it trims to last 100
    assert(schedule.history.length <= 101, 'history should be trimmed');
    cleanup(sys);
  });

  it('returns failure for unknown instance', async () => {
    const { sys } = await createInitialisedSystem();
    const result = sys.fertilize('nonexistent-001', '10-10-10');
    assertEqual(result.success, false);
    assertEqual(result.reason, 'no_schedule');
    cleanup(sys);
  });
});

// ── detectPestRisk ──
describe('AdvancedIndoorPlantCareSystem — detectPestRisk', () => {
  it('returns risk assessment with risks array', async () => {
    const { sys } = await createInitialisedSystem();
    const result = sys.detectPestRisk('plant_001');
    assertType(result, 'object');
    assertEqual(result.instanceId, 'plant_001');
    assert(Array.isArray(result.risks));
    assertType(result.overallRisk, 'string');
    cleanup(sys);
  });

  it('risk scores are between 0 and 100', async () => {
    const { sys } = await createInitialisedSystem();
    const ids = getAllInstanceIds(sys);
    for (const id of ids.slice(0, 3)) {
      const result = sys.detectPestRisk(id);
      for (const risk of result.risks) {
        assert(risk.riskScore >= 0 && risk.riskScore <= 100,
          'riskScore should be 0-100');
      }
    }
    cleanup(sys);
  });

  it('returns empty risks for unknown instance', async () => {
    const { sys } = await createInitialisedSystem();
    const result = sys.detectPestRisk('nonexistent');
    assert(Array.isArray(result.risks));
    assertEqual(result.risks.length, 0);
    cleanup(sys);
  });
});

// ── checkRepotting ──
describe('AdvancedIndoorPlantCareSystem — checkRepotting', () => {
  it('returns repotting assessment', async () => {
    const { sys } = await createInitialisedSystem();
    const result = sys.checkRepotting('plant_001');
    assert(result !== null);
    assertType(result.needsRepotting, 'boolean');
    assertType(result.monthsSinceLastRepot, 'number');
    cleanup(sys);
  });

  it('recommends repotting when overdue', async () => {
    const { sys } = await createInitialisedSystem();
    const inst = findInstance(sys, 'plant_001');
    // Set last repotted 3 years ago (monstera interval is 18 months)
    inst.lastRepotted = Date.now() - 3 * 365 * 86400000;
    const result = sys.checkRepotting('plant_001');
    assertEqual(result.needsRepotting, true);
    cleanup(sys);
  });

  it('includes season recommendation', async () => {
    const { sys } = await createInitialisedSystem();
    const result = sys.checkRepotting('plant_001');
    assertType(result.isGoodSeasonToRepot, 'boolean');
    assertType(result.recommendation, 'string');
    cleanup(sys);
  });
});

// ── getPlantHealthScore ──
describe('AdvancedIndoorPlantCareSystem — getPlantHealthScore', () => {
  it('returns health score with grade', async () => {
    const { sys } = await createInitialisedSystem();
    const result = sys.getPlantHealthScore('plant_001');
    assert(result !== null);
    assertType(result.healthScore, 'number');
    assertType(result.grade, 'string');
    assert(['Excellent', 'Good', 'Fair', 'Poor', 'Critical'].includes(result.grade));
    cleanup(sys);
  });

  it('score is between 0 and 100', async () => {
    const { sys } = await createInitialisedSystem();
    const ids = getAllInstanceIds(sys);
    for (const id of ids) {
      const result = sys.getPlantHealthScore(id);
      assert(result !== null, 'health score should not be null for ' + id);
      assert(result.healthScore >= 0 && result.healthScore <= 100,
        'score should be 0-100, got ' + result.healthScore);
    }
    cleanup(sys);
  });

  it('includes issues array', async () => {
    const { sys } = await createInitialisedSystem();
    const result = sys.getPlantHealthScore('plant_001');
    assert(Array.isArray(result.issues));
    assertType(result.issueCount, 'number');
    cleanup(sys);
  });

  it('healthy plant scores Good or better', async () => {
    const { sys } = await createInitialisedSystem();
    // plant_001 monstera — set optimal conditions
    const inst = findInstance(sys, 'plant_001');
    inst.currentMoisture = 50; // within optimal [40,60]
    inst.lastWatered = Date.now(); // just watered
    inst.lastFertilized = Date.now(); // just fertilized
    inst.lastRepotted = Date.now(); // just repotted
    inst.pestIssues = [];
    const result = sys.getPlantHealthScore('plant_001');
    assert(result.healthScore >= 75, 'healthy plant should score >= 75, got ' + result.healthScore);
    cleanup(sys);
  });
});

// ── addGrowthJournalEntry ──
describe('AdvancedIndoorPlantCareSystem — addGrowthJournalEntry', () => {
  it('adds entry to growth journal', async () => {
    const { sys } = await createInitialisedSystem();
    const before = sys.growthJournal.length;
    const result = sys.addGrowthJournalEntry('plant_001', { type: 'new_leaf', note: 'Unfurled a new leaf' });
    assertEqual(result.success, true);
    assertEqual(sys.growthJournal.length, before + 1);
    cleanup(sys);
  });

  it('adds to instance growthLog', async () => {
    const { sys } = await createInitialisedSystem();
    const inst = findInstance(sys, 'plant_001');
    const before = inst.growthLog.length;
    sys.addGrowthJournalEntry('plant_001', { type: 'measurement', note: 'Growing well' });
    assertEqual(inst.growthLog.length, before + 1);
    cleanup(sys);
  });

  it('trims journal at >5000 to 2500 entries', async () => {
    const { sys } = await createInitialisedSystem();
    // Pre-fill to 5001 entries
    for (let i = 0; i < 5001; i++) {
      sys.growthJournal.push({ instanceId: 'plant_001', timestamp: Date.now(), type: 'test' });
    }
    sys.addGrowthJournalEntry('plant_001', { type: 'overflow', note: 'Should trim' });
    assert(sys.growthJournal.length <= 2501, 'journal should be trimmed');
    cleanup(sys);
  });

  it('entry has timestamp and instanceId', async () => {
    const { sys } = await createInitialisedSystem();
    sys.addGrowthJournalEntry('plant_001', { type: 'note', note: 'Looks happy' });
    const entry = sys.growthJournal[sys.growthJournal.length - 1];
    assertEqual(entry.instanceId, 'plant_001');
    assertType(entry.timestamp, 'number');
    cleanup(sys);
  });
});

// ── getSeasonalLightCompensation ──
describe('AdvancedIndoorPlantCareSystem — getSeasonalLightCompensation', () => {
  it('returns light compensation data', async () => {
    const { sys } = await createInitialisedSystem();
    const result = sys.getSeasonalLightCompensation();
    assertType(result, 'object');
    assertType(result.estimatedDaylightHours, 'number');
    assertType(result.supplementalLightHours, 'number');
    cleanup(sys);
  });

  it('daylight hours between 6 and 18', async () => {
    const { sys } = await createInitialisedSystem();
    const result = sys.getSeasonalLightCompensation();
    // Formula: 12 + 6*sin(...) → range [6, 18]
    assert(result.estimatedDaylightHours >= 5 && result.estimatedDaylightHours <= 19,
      'daylight hours should be 5-19, got ' + result.estimatedDaylightHours);
    cleanup(sys);
  });

  it('supplemental hours non-negative', async () => {
    const { sys } = await createInitialisedSystem();
    const result = sys.getSeasonalLightCompensation();
    assert(result.supplementalLightHours >= 0,
      'supplemental hours should be >= 0');
    cleanup(sys);
  });
});

// ── getPetSafePlants ──
describe('AdvancedIndoorPlantCareSystem — getPetSafePlants', () => {
  it('returns safe and toxic arrays', async () => {
    const { sys } = await createInitialisedSystem();
    const result = sys.getPetSafePlants();
    assertType(result, 'object');
    assert(Array.isArray(result.safe));
    assert(Array.isArray(result.toxic));
    cleanup(sys);
  });

  it('total safe+toxic equals total species', async () => {
    const { sys } = await createInitialisedSystem();
    const result = sys.getPetSafePlants();
    assertEqual(result.safe.length + result.toxic.length, sys.plantProfiles.size);
    cleanup(sys);
  });

  it('spider_plant is pet-safe', async () => {
    const { sys } = await createInitialisedSystem();
    const result = sys.getPetSafePlants();
    const spiderSafe = result.safe.find(p => p.speciesId === 'spider_plant');
    assert(spiderSafe !== undefined, 'spider_plant should be pet-safe');
    cleanup(sys);
  });
});

// ── getAirPurificationRating (rooms is an OBJECT keyed by room name) ──
describe('AdvancedIndoorPlantCareSystem — getAirPurificationRating', () => {
  it('returns room-by-room ratings as object', async () => {
    const { sys } = await createInitialisedSystem();
    const result = sys.getAirPurificationRating();
    assertType(result, 'object');
    assertType(result.rooms, 'object');
    assert(Object.keys(result.rooms).length > 0, 'should have room entries');
    cleanup(sys);
  });

  it('scores are numeric and topPurifiers is array', async () => {
    const { sys } = await createInitialisedSystem();
    const result = sys.getAirPurificationRating();
    assertType(result.totalPurificationScore, 'number');
    assertType(result.averageScore, 'number');
    assert(Array.isArray(result.topPurifiers));
    cleanup(sys);
  });
});

// ── getStatistics ──
describe('AdvancedIndoorPlantCareSystem — getStatistics', () => {
  it('returns comprehensive stats', async () => {
    const { sys } = await createInitialisedSystem();
    const stats = sys.getStatistics();
    assertType(stats, 'object');
    assertEqual(stats.speciesInDatabase, 20);
    assertEqual(stats.totalPlantInstances, 8);
    assertEqual(stats.growLightProfiles, 5);
    assertType(stats.avgHealthScore, 'number');
    cleanup(sys);
  });

  it('includes pet safety stats', async () => {
    const { sys } = await createInitialisedSystem();
    const stats = sys.getStatistics();
    assertType(stats.petSafety, 'object');
    assertType(stats.petSafety.safePlantCount, 'number');
    assertType(stats.petSafety.toxicPlantCount, 'number');
    cleanup(sys);
  });

  it('includes air purification stats', async () => {
    const { sys } = await createInitialisedSystem();
    const stats = sys.getStatistics();
    assertType(stats.airPurification, 'object');
    assertType(stats.airPurification.totalScore, 'number');
    assertType(stats.airPurification.averageScore, 'number');
    cleanup(sys);
  });

  it('includes light compensation info', async () => {
    const { sys } = await createInitialisedSystem();
    const stats = sys.getStatistics();
    assertType(stats.lightCompensation, 'object');
    assertType(stats.lightCompensation.daylightHours, 'number');
    assertType(stats.lightCompensation.supplementalHours, 'number');
    cleanup(sys);
  });
});

// ── log / error methods ──
describe('AdvancedIndoorPlantCareSystem — logging', () => {
  it('log delegates to homey.log with prefix', () => {
    const { sys, homey } = createSystem();
    const calls = [];
    homey.log = (...args) => calls.push(args);
    sys.log('test message');
    assertEqual(calls.length, 1);
    assert(calls[0].join(' ').includes('[IndoorPlants]'));
    assert(calls[0].join(' ').includes('test message'));
    cleanup(sys);
  });

  it('error delegates to homey.error with prefix', () => {
    const { sys, homey } = createSystem();
    const calls = [];
    homey.error = (...args) => calls.push(args);
    sys.error('oops');
    assertEqual(calls.length, 1);
    assert(calls[0].join(' ').includes('[IndoorPlants]'));
    assert(calls[0].join(' ').includes('oops'));
    cleanup(sys);
  });
});

// ── destroy ──
describe('AdvancedIndoorPlantCareSystem — destroy', () => {
  it('clears monitoring interval', async () => {
    const { sys } = await createInitialisedSystem();
    assert(sys.monitoringInterval !== null);
    sys.destroy();
    assertEqual(sys.monitoringInterval, null);
    cleanup(sys);
  });

  it('clears light compensation interval', async () => {
    const { sys } = await createInitialisedSystem();
    assert(sys.lightCompensationInterval !== null);
    sys.destroy();
    assertEqual(sys.lightCompensationInterval, null);
    cleanup(sys);
  });

  it('can be called multiple times safely', async () => {
    const { sys } = await createInitialisedSystem();
    sys.destroy();
    sys.destroy(); // should not throw
    cleanup(sys);
  });
});

run();
