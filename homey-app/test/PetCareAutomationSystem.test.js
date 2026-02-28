'use strict';

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertType } = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');

const PetCareAutomationSystem = require('../lib/PetCareAutomationSystem');

/* ---- Timer-leak prevention ---- */
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

describe('PetCareAutomationSystem', () => {

  describe('constructor', () => {
    it('initializes with empty data structures', () => {
      const homey = createMockHomey();
      const sys = new PetCareAutomationSystem(homey);
      assert(sys.petProfiles instanceof Map, 'petProfiles is Map');
      assert(sys.breedDatabase instanceof Map, 'breedDatabase is Map');
      assertEqual(sys.initialized, false);
      cleanup(sys);
    });
  });

  describe('initialize', () => {
    it('populates breed database, pets, schedules, vet records, and contacts', async () => {
      const homey = createMockHomey();
      const sys = new PetCareAutomationSystem(homey);
      await sys.initialize();
      assertEqual(sys.breedDatabase.size, 15);
      assertEqual(sys.petProfiles.size, 3);
      assertEqual(sys.feedingSchedules.size, 3);
      assertEqual(sys.vetRecords.size, 3);
      assertEqual(sys.emergencyContacts.length, 4);
      assertEqual(sys.initialized, true);
      cleanup(sys);
    });
  });

  describe('calculatePortion', () => {
    it('returns a positive number for a known pet', async () => {
      const homey = createMockHomey();
      const sys = new PetCareAutomationSystem(homey);
      await sys.initialize();
      const portion = sys.calculatePortion('pet_001', 'morning');
      assertType(portion, 'number');
      assert(portion > 0, 'portion is positive');
      cleanup(sys);
    });

    it('returns 0 for unknown pet', async () => {
      const homey = createMockHomey();
      const sys = new PetCareAutomationSystem(homey);
      await sys.initialize();
      assertEqual(sys.calculatePortion('unknown', 'morning'), 0);
      cleanup(sys);
    });
  });

  describe('trackMeal', () => {
    it('tracks a meal and returns entry', async () => {
      const homey = createMockHomey();
      const sys = new PetCareAutomationSystem(homey);
      await sys.initialize();
      const result = sys.trackMeal('pet_001', 'morning', 200, 'ate well');
      assertEqual(result.success, true);
      assertEqual(result.entry.petName, 'Max');
      assertEqual(result.entry.portionGrams, 200);
      assertType(result.entry.caloriesEstimate, 'number');
      cleanup(sys);
    });

    it('returns failure for unknown pet', async () => {
      const homey = createMockHomey();
      const sys = new PetCareAutomationSystem(homey);
      await sys.initialize();
      const result = sys.trackMeal('unknown', 'morning', 200);
      assertEqual(result.success, false);
      assertEqual(result.reason, 'pet_not_found');
      cleanup(sys);
    });
  });

  describe('checkAllergens', () => {
    it('reports safe for non-allergenic ingredients', async () => {
      const homey = createMockHomey();
      const sys = new PetCareAutomationSystem(homey);
      await sys.initialize();
      const result = sys.checkAllergens('pet_001', ['beef', 'rice']);
      assertEqual(result.safe, true);
      assertEqual(result.allergens.length, 0);
      cleanup(sys);
    });

    it('detects allergen match for pet with allergies', async () => {
      const homey = createMockHomey();
      const sys = new PetCareAutomationSystem(homey);
      await sys.initialize();
      // pet_001 (Max) is allergic to chicken
      const result = sys.checkAllergens('pet_001', ['chicken breast', 'rice']);
      assertEqual(result.safe, false);
      assert(result.allergens.length > 0, 'has allergen matches');
      assertEqual(result.allergens[0].allergen, 'chicken');
      cleanup(sys);
    });

    it('detects toxic ingredients for dogs', async () => {
      const homey = createMockHomey();
      const sys = new PetCareAutomationSystem(homey);
      await sys.initialize();
      const result = sys.checkAllergens('pet_001', ['chocolate cake']);
      assertEqual(result.safe, false);
      assert(result.warnings.length > 0, 'has warnings');
      assertEqual(result.warnings[0].severity, 'critical');
      cleanup(sys);
    });
  });

  describe('trackWeight', () => {
    it('tracks weight and returns change info', async () => {
      const homey = createMockHomey();
      const sys = new PetCareAutomationSystem(homey);
      await sys.initialize();
      const result = sys.trackWeight('pet_001', 33);
      assertEqual(result.success, true);
      assertEqual(result.petName, 'Max');
      assertEqual(result.currentWeight, 33);
      assertEqual(result.previousWeight, 32);
      assertType(result.change, 'number');
      assertEqual(result.trend, 'stable');
      cleanup(sys);
    });

    it('detects overweight alert', async () => {
      const homey = createMockHomey();
      const sys = new PetCareAutomationSystem(homey);
      await sys.initialize();
      // Labrador avgWeight [25, 36]; 36 * 1.15 = 41.4 → 42 triggers overweight
      const result = sys.trackWeight('pet_001', 42);
      assertEqual(result.success, true);
      assert(result.alert !== null, 'has alert');
      assertEqual(result.alert.type, 'overweight');
      cleanup(sys);
    });

    it('returns failure for unknown pet', async () => {
      const homey = createMockHomey();
      const sys = new PetCareAutomationSystem(homey);
      await sys.initialize();
      const result = sys.trackWeight('unknown', 10);
      assertEqual(result.success, false);
      cleanup(sys);
    });
  });

  describe('detectBehaviorAnomaly', () => {
    it('logs normal behavior with no anomaly', async () => {
      const homey = createMockHomey();
      const sys = new PetCareAutomationSystem(homey);
      await sys.initialize();
      const result = sys.detectBehaviorAnomaly('pet_001', 'playing');
      assertEqual(result.petName, 'Max');
      assertEqual(result.loggedBehavior, 'playing');
      assertEqual(result.anomaliesDetected, false);
      cleanup(sys);
    });

    it('detects anomaly when concerning behavior reaches threshold', async () => {
      const homey = createMockHomey();
      const sys = new PetCareAutomationSystem(homey);
      await sys.initialize();
      // limping has threshold of 1 — first occurrence triggers anomaly
      const result = sys.detectBehaviorAnomaly('pet_001', 'limping');
      assertEqual(result.anomaliesDetected, true);
      assert(result.anomalies.length > 0, 'has anomalies');
      assertEqual(result.anomalies[0].behavior, 'limping');
      assertEqual(result.anomalies[0].concern, 'Limping needs immediate vet check');
      cleanup(sys);
    });

    it('returns null for unknown pet', async () => {
      const homey = createMockHomey();
      const sys = new PetCareAutomationSystem(homey);
      await sys.initialize();
      assertEqual(sys.detectBehaviorAnomaly('unknown', 'playing'), null);
      cleanup(sys);
    });
  });

  describe('getPetDoorSchedule', () => {
    it('creates default schedule for outdoor pet', async () => {
      const homey = createMockHomey();
      const sys = new PetCareAutomationSystem(homey);
      await sys.initialize();
      // pet_001 (Max) is indoorOutdoor: 'both'
      const schedule = sys.getPetDoorSchedule('pet_001');
      assert(schedule !== null, 'schedule exists');
      assertEqual(schedule.petName, 'Max');
      assertEqual(schedule.enabled, true);
      assert(schedule.schedule.weekday !== undefined, 'has weekday schedule');
      cleanup(sys);
    });

    it('returns null for unknown pet', async () => {
      const homey = createMockHomey();
      const sys = new PetCareAutomationSystem(homey);
      await sys.initialize();
      assertEqual(sys.getPetDoorSchedule('unknown'), null);
      cleanup(sys);
    });
  });

  describe('setPetDoorCurfew', () => {
    it('sets curfew time for pet', async () => {
      const homey = createMockHomey();
      const sys = new PetCareAutomationSystem(homey);
      await sys.initialize();
      sys.getPetDoorSchedule('pet_001'); // ensure schedule exists
      const result = sys.setPetDoorCurfew('pet_001', '20:00');
      assertEqual(result.success, true);
      assertEqual(result.lockTime, '20:00');
      cleanup(sys);
    });
  });

  describe('checkDoorAccess', () => {
    it('returns access status for outdoor pet', async () => {
      const homey = createMockHomey();
      const sys = new PetCareAutomationSystem(homey);
      await sys.initialize();
      const result = sys.checkDoorAccess('pet_001');
      assertType(result.allowed, 'boolean');
      assertEqual(result.petName, 'Max');
      assertType(result.currentTime, 'string');
      cleanup(sys);
    });

    it('returns disabled for indoor-only pet', async () => {
      const homey = createMockHomey();
      const sys = new PetCareAutomationSystem(homey);
      await sys.initialize();
      // pet_002 (Luna) is indoor_only → door disabled
      const result = sys.checkDoorAccess('pet_002');
      assertEqual(result.allowed, false);
      assertEqual(result.reason, 'door_disabled');
      cleanup(sys);
    });
  });

  describe('getComfortTemperature', () => {
    it('returns comfort range for known pet', async () => {
      const homey = createMockHomey();
      const sys = new PetCareAutomationSystem(homey);
      await sys.initialize();
      const result = sys.getComfortTemperature('pet_001');
      assert(result !== null, 'result exists');
      assertEqual(result.petName, 'Max');
      assert(Array.isArray(result.comfortRange), 'has comfort range array');
      assertType(result.idealTemp, 'number');
      cleanup(sys);
    });

    it('returns null for unknown pet', async () => {
      const homey = createMockHomey();
      const sys = new PetCareAutomationSystem(homey);
      await sys.initialize();
      assertEqual(sys.getComfortTemperature('unknown'), null);
      cleanup(sys);
    });
  });

  describe('getOptimalHomeTemp', () => {
    it('calculates optimal home temperature from all pets', async () => {
      const homey = createMockHomey();
      const sys = new PetCareAutomationSystem(homey);
      await sys.initialize();
      const result = sys.getOptimalHomeTemp();
      assertType(result.temp, 'number');
      assert(result.temp >= 10 && result.temp <= 30, 'temp in reasonable range');
      cleanup(sys);
    });
  });

  describe('enablePetSitterMode', () => {
    it('enables pet sitter mode with instructions', async () => {
      const homey = createMockHomey();
      const sys = new PetCareAutomationSystem(homey);
      await sys.initialize();
      const result = sys.enablePetSitterMode({ sitterName: 'Anna' });
      assertEqual(result.enabled, true);
      assertEqual(result.sitterName, 'Anna');
      assertEqual(result.petsInCare, 3);
      assertType(result.accessCode, 'string');
      assertEqual(sys.petSitterMode, true);
      cleanup(sys);
    });
  });

  describe('disablePetSitterMode', () => {
    it('disables pet sitter mode', async () => {
      const homey = createMockHomey();
      const sys = new PetCareAutomationSystem(homey);
      await sys.initialize();
      sys.enablePetSitterMode({ sitterName: 'Anna' });
      const result = sys.disablePetSitterMode();
      assertEqual(result.enabled, false);
      assertEqual(sys.petSitterMode, false);
      cleanup(sys);
    });
  });

  describe('getEmergencyContacts', () => {
    it('returns contacts with nearest emergency vet', async () => {
      const homey = createMockHomey();
      const sys = new PetCareAutomationSystem(homey);
      await sys.initialize();
      const result = sys.getEmergencyContacts();
      assertEqual(result.contacts.length, 4);
      assert(result.nearestEmergencyVet !== null, 'has nearest vet');
      assertEqual(result.nearestEmergencyVet.type, '24h_emergency_vet');
      cleanup(sys);
    });
  });

  describe('logWalk', () => {
    it('logs walk for a dog', async () => {
      const homey = createMockHomey();
      const sys = new PetCareAutomationSystem(homey);
      await sys.initialize();
      const result = sys.logWalk('pet_001', 30, 2.5);
      assertEqual(result.success, true);
      assertEqual(result.walk.durationMinutes, 30);
      assertEqual(result.walk.distanceKm, 2.5);
      assertType(result.walk.caloriesBurned, 'number');
      cleanup(sys);
    });

    it('rejects for cat or unknown pet', async () => {
      const homey = createMockHomey();
      const sys = new PetCareAutomationSystem(homey);
      await sys.initialize();
      // pet_002 (Luna) is a cat
      const result = sys.logWalk('pet_002', 30, 2.5);
      assertEqual(result.success, false);
      cleanup(sys);
    });
  });

  describe('getUpcomingMedications', () => {
    it('returns medications due within 7 days', async () => {
      const homey = createMockHomey();
      const sys = new PetCareAutomationSystem(homey);
      await sys.initialize();
      const result = sys.getUpcomingMedications();
      assertType(result.count, 'number');
      assert(Array.isArray(result.medications), 'medications is array');
      cleanup(sys);
    });
  });

  describe('getUpcomingVaccinations', () => {
    it('returns vaccinations due within 60 days', async () => {
      const homey = createMockHomey();
      const sys = new PetCareAutomationSystem(homey);
      await sys.initialize();
      const result = sys.getUpcomingVaccinations();
      assertType(result.count, 'number');
      assert(Array.isArray(result.vaccinations), 'vaccinations is array');
      cleanup(sys);
    });
  });

  describe('getStatistics', () => {
    it('returns comprehensive statistics', async () => {
      const homey = createMockHomey();
      const sys = new PetCareAutomationSystem(homey);
      await sys.initialize();
      const stats = sys.getStatistics();
      assertEqual(stats.totalPets, 3);
      assertEqual(stats.breedsInDatabase, 15);
      assertEqual(stats.uptime, 'active');
      assertEqual(stats.emergencyContacts, 4);
      assertType(stats.optimalHomeTemp, 'number');
      assert(stats.pets !== undefined, 'has pet summary');
      cleanup(sys);
    });
  });

  describe('destroy', () => {
    it('clears monitoring and medication intervals', async () => {
      const homey = createMockHomey();
      const sys = new PetCareAutomationSystem(homey);
      await sys.initialize();
      assert(sys.monitoringInterval !== null, 'monitoring interval exists');
      sys.destroy();
      assertEqual(sys.monitoringInterval, null);
      assertEqual(sys.medicationInterval, null);
      cleanup(sys);
    });
  });

});

run();
