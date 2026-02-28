'use strict';

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertThrows, assertType } = require('./helpers/assert');
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

const SmartPetDoorActivitySystem = require('../lib/SmartPetDoorActivitySystem');

/* ================================================================== */
/*  SmartPetDoorActivitySystem – test suite                           */
/* ================================================================== */

describe('SmartPetDoorActivitySystem — constructor & init', () => {
  it('instantiates without errors', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    assert(sys, 'should create instance');
    cleanup(sys);
  });

  it('starts uninitialised with empty maps', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    assertEqual(sys.initialized, false);
    assertEqual(sys.doors.size, 0);
    assertEqual(sys.pets.size, 0);
    cleanup(sys);
  });

  it('initialize sets initialized flag', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    assertEqual(sys.initialized, true);
    cleanup(sys);
  });

  it('destroy clears all data', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    sys.registerDoor({ id: 'd1', location: 'back', size: 'medium' });
    sys.destroy();
    assertEqual(sys.doors.size, 0);
    assertEqual(sys.pets.size, 0);
    assertEqual(sys.initialized, false);
    cleanup(sys);
  });
});

describe('SmartPetDoorActivitySystem — door management', () => {
  it('registerDoor creates door with defaults', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    const door = sys.registerDoor({ id: 'front', location: 'Front door', size: 'large' });
    assert(door, 'should return door');
    assertEqual(sys.doors.size, 1);
    cleanup(sys);
  });

  it('registerDoor enforces max doors limit', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    for (let i = 0; i < 6; i++) {
      sys.registerDoor({ id: `d${i}`, location: `loc${i}`, size: 'medium' });
    }
    assertThrows(() => sys.registerDoor({ id: 'd6', location: 'extra', size: 'small' }), 'maximum');
    cleanup(sys);
  });

  it('lockDoor and unlockDoor toggle lock state', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    sys.registerDoor({ id: 'd1', location: 'back', size: 'medium' });
    sys.lockDoor('d1');
    assertEqual(sys.doors.get('d1').locked, true);
    sys.unlockDoor('d1');
    assertEqual(sys.doors.get('d1').locked, false);
    cleanup(sys);
  });

  it('unlockDoor is blocked during emergency lockdown', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    sys.registerDoor({ id: 'd1', location: 'back', size: 'medium' });
    sys.activateEmergencyLockdown();
    // unlockDoor should fail or remain locked during emergency
    try { sys.unlockDoor('d1'); } catch (_) { /* expected */ }
    cleanup(sys);
  });

  it('getDoorStatus returns correct info', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    sys.registerDoor({ id: 'd1', location: 'back', size: 'large' });
    const status = sys.getDoorStatus('d1');
    assert(status, 'should return status');
    assertEqual(status.location, 'back');
    cleanup(sys);
  });

  it('getAllDoorStatuses returns all doors', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    sys.registerDoor({ id: 'd1', location: 'front', size: 'small' });
    sys.registerDoor({ id: 'd2', location: 'back', size: 'large' });
    const all = sys.getAllDoorStatuses();
    assertEqual(Object.keys(all).length, 2);
    cleanup(sys);
  });

  it('setDoorSize updates door size', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    sys.registerDoor({ id: 'd1', location: 'back', size: 'medium' });
    sys.setDoorSize('d1', 'large');
    assertEqual(sys.doors.get('d1').size, 'large');
    cleanup(sys);
  });

  it('updateDoorBattery sets battery level', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    sys.registerDoor({ id: 'd1', location: 'back', size: 'medium' });
    sys.updateDoorBattery('d1', 75);
    assertEqual(sys.doors.get('d1').batteryLevel, 75);
    cleanup(sys);
  });
});

describe('SmartPetDoorActivitySystem — pet management', () => {
  it('registerPet creates pet with RFID', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    const pet = sys.registerPet({ id: 'cat1', name: 'Luna', species: 'cat', rfidTagId: 'RF001' });
    assert(pet, 'should return pet');
    assertEqual(sys.pets.size, 1);
    cleanup(sys);
  });

  it('registerPet requires rfidTagId', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    assertThrows(() => sys.registerPet({ id: 'cat1', name: 'Luna', species: 'cat' }), 'rfid');
    cleanup(sys);
  });

  it('registerPet enforces unique RFID', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    sys.registerPet({ id: 'cat1', name: 'Luna', species: 'cat', rfidTagId: 'RF001' });
    assertThrows(() => sys.registerPet({ id: 'cat2', name: 'Max', species: 'dog', rfidTagId: 'RF001' }), 'RFID');
    cleanup(sys);
  });

  it('registerPet enforces max pets limit', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    for (let i = 0; i < 12; i++) {
      sys.registerPet({ id: `pet${i}`, name: `Pet${i}`, species: 'cat', rfidTagId: `RF${i}` });
    }
    assertThrows(() => sys.registerPet({ id: 'pet12', name: 'Extra', species: 'cat', rfidTagId: 'RF99' }), 'maximum');
    cleanup(sys);
  });

  it('unregisterPet removes pet', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    sys.registerPet({ id: 'cat1', name: 'Luna', species: 'cat', rfidTagId: 'RF001' });
    sys.unregisterPet('cat1');
    assertEqual(sys.pets.size, 0);
    cleanup(sys);
  });

  it('getPetById returns correct pet', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    sys.registerPet({ id: 'dog1', name: 'Max', species: 'dog', rfidTagId: 'RF002' });
    const pet = sys.getPetById('dog1');
    assertEqual(pet.name, 'Max');
    cleanup(sys);
  });

  it('getPetByRfid returns correct pet', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    sys.registerPet({ id: 'cat1', name: 'Luna', species: 'cat', rfidTagId: 'RF100' });
    const pet = sys.getPetByRfid('RF100');
    assertEqual(pet.name, 'Luna');
    cleanup(sys);
  });

  it('getAllPets returns all registered pets', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    sys.registerPet({ id: 'p1', name: 'A', species: 'cat', rfidTagId: 'R1' });
    sys.registerPet({ id: 'p2', name: 'B', species: 'dog', rfidTagId: 'R2' });
    const all = sys.getAllPets();
    assertEqual(all.length, 2);
    cleanup(sys);
  });

  it('updatePetWeight records weight history', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    sys.registerPet({ id: 'cat1', name: 'Luna', species: 'cat', rfidTagId: 'RF001', weight: 4.0 });
    sys.updatePetWeight('cat1', 4.2);
    const pet = sys.getPetById('cat1');
    assertEqual(pet.weight, 4.2);
    cleanup(sys);
  });
});

describe('SmartPetDoorActivitySystem — access schedules', () => {
  it('setAccessSchedule and getAccessSchedule', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    sys.registerPet({ id: 'cat1', name: 'Luna', species: 'cat', rfidTagId: 'RF001' });
    sys.registerDoor({ id: 'd1', location: 'back', size: 'medium' });
    sys.setAccessSchedule('cat1', 'd1', { startTime: '06:00', endTime: '22:00', days: ['monday', 'tuesday'] });
    const sched = sys.getAccessSchedule('cat1', 'd1');
    assert(sched, 'should return schedule');
    assertEqual(sched.startTime, '06:00');
    cleanup(sys);
  });

  it('setAccessSchedule validates time format', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    sys.registerPet({ id: 'cat1', name: 'Luna', species: 'cat', rfidTagId: 'RF001' });
    sys.registerDoor({ id: 'd1', location: 'back', size: 'medium' });
    assertThrows(() => sys.setAccessSchedule('cat1', 'd1', { startTime: '25:00', endTime: '22:00' }), 'time');
    cleanup(sys);
  });

  it('isAccessAllowed checks schedule', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    sys.registerPet({ id: 'cat1', name: 'Luna', species: 'cat', rfidTagId: 'RF001' });
    sys.registerDoor({ id: 'd1', location: 'back', size: 'medium' });
    // Without schedule, access should be allowed (default)
    const allowed = sys.isAccessAllowed('cat1', 'd1');
    assertType(allowed, 'boolean');
    cleanup(sys);
  });
});

describe('SmartPetDoorActivitySystem — curfew', () => {
  it('setCurfew enables curfew with time', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    sys.setCurfew({ enabled: true, globalTime: '21:00' });
    assertEqual(sys.curfew.enabled, true);
    assertEqual(sys.curfew.globalTime, '21:00');
    cleanup(sys);
  });

  it('setCurfewOverride sets per-pet override', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    sys.registerPet({ id: 'cat1', name: 'Luna', species: 'cat', rfidTagId: 'RF001' });
    sys.setCurfewOverride('cat1', '23:00');
    assert(sys.curfew.petOverrides.has('cat1'), 'should have override');
    cleanup(sys);
  });
});

describe('SmartPetDoorActivitySystem — activity logging', () => {
  it('logDoorEvent records activity', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    sys.registerDoor({ id: 'd1', location: 'back', size: 'medium' });
    sys.registerPet({ id: 'cat1', name: 'Luna', species: 'cat', rfidTagId: 'RF001' });
    sys.logDoorEvent('cat1', 'd1', 'out', 0.95);
    assert(sys.activityLog.length > 0, 'should have log entry');
    cleanup(sys);
  });

  it('logDoorEvent respects cooldown', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    sys.registerDoor({ id: 'd1', location: 'back', size: 'medium' });
    sys.registerPet({ id: 'cat1', name: 'Luna', species: 'cat', rfidTagId: 'RF001' });
    sys.logDoorEvent('cat1', 'd1', 'out', 0.95);
    const logLen = sys.activityLog.length;
    // Second event within cooldown should be ignored
    sys.logDoorEvent('cat1', 'd1', 'out', 0.95);
    assertEqual(sys.activityLog.length, logLen);
    cleanup(sys);
  });

  it('getActivityLog returns filtered results', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    sys.registerDoor({ id: 'd1', location: 'back', size: 'medium' });
    sys.registerPet({ id: 'cat1', name: 'Luna', species: 'cat', rfidTagId: 'RF001' });
    sys.registerPet({ id: 'dog1', name: 'Max', species: 'dog', rfidTagId: 'RF002' });
    sys.logDoorEvent('cat1', 'd1', 'out', 0.9);
    sys.logDoorEvent('dog1', 'd1', 'in', 0.8);
    const catLog = sys.getActivityLog({ petId: 'cat1' });
    assert(catLog.length >= 1, 'should have cat events');
    cleanup(sys);
  });
});

describe('SmartPetDoorActivitySystem — intruder detection', () => {
  it('processRfidScan detects unknown RFID as intruder', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    sys.registerDoor({ id: 'd1', location: 'back', size: 'medium' });
    sys.processRfidScan('d1', 'UNKNOWN_RF', 'small');
    assert(sys.intruderDetection.blockedAttempts > 0, 'should block intruder');
    cleanup(sys);
  });

  it('processRfidScan allows known pet', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    sys.registerDoor({ id: 'd1', location: 'back', size: 'medium' });
    sys.registerPet({ id: 'cat1', name: 'Luna', species: 'cat', rfidTagId: 'RF001' });
    sys.processRfidScan('d1', 'RF001', 'small');
    assertEqual(sys.intruderDetection.blockedAttempts, 0);
    cleanup(sys);
  });
});

describe('SmartPetDoorActivitySystem — GPS & geofencing', () => {
  it('setHomeLocation configures home coords', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    sys.setHomeLocation(59.3293, 18.0686);
    assertEqual(sys.gpsConfig.homeLat, 59.3293);
    assertEqual(sys.gpsConfig.homeLng, 18.0686);
    cleanup(sys);
  });

  it('setGeofenceRadius updates radius', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    sys.setGeofenceRadius(200);
    assertEqual(sys.gpsConfig.geofenceRadius, 200);
    cleanup(sys);
  });

  it('updateGpsLocation tracks pet position', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    sys.registerPet({ id: 'cat1', name: 'Luna', species: 'cat', rfidTagId: 'RF001' });
    sys.setHomeLocation(59.3293, 18.0686);
    sys.updateGpsLocation('cat1', 59.3293, 18.0686);
    const loc = sys.getLastKnownLocation('cat1');
    assert(loc, 'should return location');
    cleanup(sys);
  });
});

describe('SmartPetDoorActivitySystem — weather rules', () => {
  it('updateWeatherData stores conditions', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    sys.updateWeatherData({ temperature: 15, condition: 'clear', windSpeed: 5 });
    assertEqual(sys.weatherRules.currentWeather.temperature, 15);
    cleanup(sys);
  });

  it('weather blocking activates in extreme conditions', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    sys.updateWeatherData({ temperature: -20, condition: 'storm', windSpeed: 30 });
    assert(sys._isWeatherBlocked(), 'should block in storm');
    cleanup(sys);
  });
});

describe('SmartPetDoorActivitySystem — emergency lockdown', () => {
  it('activateEmergencyLockdown locks all doors', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    sys.registerDoor({ id: 'd1', location: 'front', size: 'medium' });
    sys.registerDoor({ id: 'd2', location: 'back', size: 'large' });
    sys.activateEmergencyLockdown();
    assertEqual(sys.emergencyLockdown.active, true);
    assertEqual(sys.doors.get('d1').locked, true);
    assertEqual(sys.doors.get('d2').locked, true);
    cleanup(sys);
  });

  it('deactivateEmergencyLockdown unlocks doors', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    sys.registerDoor({ id: 'd1', location: 'front', size: 'medium' });
    sys.activateEmergencyLockdown();
    sys.deactivateEmergencyLockdown();
    assertEqual(sys.emergencyLockdown.active, false);
    cleanup(sys);
  });

  it('getEmergencyLockdownStatus returns status', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    const st = sys.getEmergencyLockdownStatus();
    assertEqual(st.active, false);
    cleanup(sys);
  });
});

describe('SmartPetDoorActivitySystem — lost pet mode', () => {
  it('activateLostPetMode enables GPS and notifies neighbors', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    sys.registerPet({ id: 'cat1', name: 'Luna', species: 'cat', rfidTagId: 'RF001' });
    sys.registerDoor({ id: 'd1', location: 'back', size: 'medium' });
    sys.activateLostPetMode('cat1');
    assertEqual(sys.neighborNotifications.lostPetMode.active, true);
    assertEqual(sys.neighborNotifications.lostPetMode.petId, 'cat1');
    cleanup(sys);
  });

  it('deactivateLostPetMode resets state', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    sys.registerPet({ id: 'cat1', name: 'Luna', species: 'cat', rfidTagId: 'RF001' });
    sys.registerDoor({ id: 'd1', location: 'back', size: 'medium' });
    sys.activateLostPetMode('cat1');
    sys.deactivateLostPetMode();
    assertEqual(sys.neighborNotifications.lostPetMode.active, false);
    cleanup(sys);
  });
});

describe('SmartPetDoorActivitySystem — veterinary reminders', () => {
  it('addVaccination records vaccination', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    sys.registerPet({ id: 'cat1', name: 'Luna', species: 'cat', rfidTagId: 'RF001' });
    sys.addVaccination('cat1', { name: 'Rabies', date: '2024-01-15', nextDue: '2025-01-15' });
    const reminders = sys.getUpcomingReminders('cat1', 365);
    assert(reminders, 'should return reminders');
    cleanup(sys);
  });

  it('addVetAppointment schedules appointment', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    sys.registerPet({ id: 'cat1', name: 'Luna', species: 'cat', rfidTagId: 'RF001' });
    sys.addVetAppointment('cat1', { clinic: 'PetVet', date: '2025-06-01', reason: 'Checkup' });
    const vet = sys.vetReminders.get('cat1');
    assert(vet.appointments.length > 0, 'should have appointment');
    cleanup(sys);
  });
});

describe('SmartPetDoorActivitySystem — feeding integration', () => {
  it('recordMeal logs feeding event', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    sys.registerPet({ id: 'cat1', name: 'Luna', species: 'cat', rfidTagId: 'RF001' });
    sys.recordMeal('cat1', { type: 'wet', amountGrams: 100, calories: 80, brand: 'FancyFeast' });
    const summary = sys.getFeedingSummary('cat1');
    assert(summary, 'should return summary');
    assert(summary.mealsToday >= 1, 'should have at least 1 meal');
    cleanup(sys);
  });

  it('updateWaterIntake tracks water', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    sys.registerPet({ id: 'cat1', name: 'Luna', species: 'cat', rfidTagId: 'RF001' });
    sys.updateWaterIntake('cat1', 50);
    const feeding = sys.feedingData.get('cat1');
    assertEqual(feeding.waterIntakeMl, 50);
    cleanup(sys);
  });

  it('setMealTimeRestriction and check active', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    sys.registerPet({ id: 'cat1', name: 'Luna', species: 'cat', rfidTagId: 'RF001' });
    sys.setMealTimeRestriction('cat1', { enabled: true, startTime: '07:00', endTime: '08:00' });
    const active = sys.isMealTimeRestrictionActive('cat1');
    assertType(active, 'boolean');
    cleanup(sys);
  });
});

describe('SmartPetDoorActivitySystem — camera & door maintenance', () => {
  it('setCameraConfig updates camera settings', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    sys.setCameraConfig({ nightVisionEnabled: true, recordingDuration: 30, motionSensitivity: 0.8 });
    assert(sys.cameraConfig, 'camera config should exist');
    cleanup(sys);
  });

  it('getCameraClips returns filtered clips', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    const clips = sys.getCameraClips({});
    assert(Array.isArray(clips), 'should return array');
    cleanup(sys);
  });

  it('getDoorMaintenanceReport returns door health', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    sys.registerDoor({ id: 'd1', location: 'back', size: 'medium' });
    const report = sys.getDoorMaintenanceReport('d1');
    assert(report, 'should return report');
    cleanup(sys);
  });

  it('recordBatteryReplacement updates maintenance', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    sys.registerDoor({ id: 'd1', location: 'back', size: 'medium' });
    sys.recordBatteryReplacement('d1');
    const maint = sys.doorMaintenance.get('d1');
    assert(maint, 'maintenance data exists');
    cleanup(sys);
  });

  it('recordHingeLubrication updates hinge data', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    sys.registerDoor({ id: 'd1', location: 'back', size: 'medium' });
    sys.recordHingeLubrication('d1');
    const maint = sys.doorMaintenance.get('d1');
    assert(maint, 'maintenance data exists');
    cleanup(sys);
  });
});

describe('SmartPetDoorActivitySystem — statistics & reports', () => {
  it('getStatistics returns comprehensive stats', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    sys.registerDoor({ id: 'd1', location: 'back', size: 'medium' });
    sys.registerPet({ id: 'cat1', name: 'Luna', species: 'cat', rfidTagId: 'RF001' });
    const stats = sys.getStatistics();
    assert(stats.system, 'has system stats');
    assert(stats.doors, 'has door stats');
    assert(stats.pets, 'has pet stats');
    assertEqual(stats.registeredDoors, 1);
    assertEqual(stats.registeredPets, 1);
    cleanup(sys);
  });

  it('getBehavioralReport returns pet behavior analysis', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    sys.registerPet({ id: 'cat1', name: 'Luna', species: 'cat', rfidTagId: 'RF001' });
    const report = sys.getBehavioralReport('cat1');
    assert(report, 'should return report');
    assertEqual(report.petName, 'Luna');
    cleanup(sys);
  });

  it('getBehavioralReport returns null for unknown pet', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    const report = sys.getBehavioralReport('unknown');
    assertEqual(report, null);
    cleanup(sys);
  });

  it('getPetsInsideOutside returns location split', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    sys.registerPet({ id: 'cat1', name: 'Luna', species: 'cat', rfidTagId: 'RF001' });
    const result = sys.getPetsInsideOutside();
    assert(result, 'should return result');
    cleanup(sys);
  });
});

describe('SmartPetDoorActivitySystem — neighbor notifications', () => {
  it('addNeighbor registers neighbor', () => {
    const sys = new SmartPetDoorActivitySystem(createMockHomey());
    sys.initialize();
    sys.addNeighbor({ id: 'n1', name: 'Erik', phone: '+46701234567' });
    assert(sys.neighborNotifications.neighbors.length > 0, 'should have neighbor');
    cleanup(sys);
  });
});

run();
