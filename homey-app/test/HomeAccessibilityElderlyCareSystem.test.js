'use strict';

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertType, assertInstanceOf } = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');

/* ── Timer-leak prevention ── */
const _origSetTimeout = global.setTimeout;
const _origSetInterval = global.setInterval;
const activeHandles = [];
global.setTimeout = (...a) => { const id = _origSetTimeout(...a); activeHandles.push({ type: 'timeout', id }); return id; };
global.setInterval = (...a) => { const id = _origSetInterval(...a); activeHandles.push({ type: 'interval', id }); return id; };
function cleanup(sys) {
  try { if (sys && typeof sys.destroy === 'function') sys.destroy(); } catch (_) {}
  while (activeHandles.length > 0) {
    const h = activeHandles.pop();
    if (h.type === 'timeout') clearTimeout(h.id);
    else clearInterval(h.id);
  }
}

const HomeAccessibilityElderlyCareSystem = require('../lib/HomeAccessibilityElderlyCareSystem');

/* ════════════════════════════════════════════════
   constructor
   ════════════════════════════════════════════════ */
describe('HomeAccessibilityElderlyCareSystem › constructor', () => {
  it('creates instance with homey ref', () => {
    const h = createMockHomey();
    const sys = new HomeAccessibilityElderlyCareSystem(h);
    assertEqual(sys.homey, h);
    cleanup(sys);
  });

  it('starts uninitialized', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    assertEqual(sys.initialized, false);
    cleanup(sys);
  });

  it('residents is an empty Map', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    assertInstanceOf(sys.residents, Map);
    assertEqual(sys.residents.size, 0);
    cleanup(sys);
  });

  it('fallDetection default config', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    assertEqual(sys.fallDetection.enabled, true);
    assertEqual(sys.fallDetection.impactThreshold, 8.5);
    assertEqual(sys.fallDetection.monitoredRooms.length, 4);
    cleanup(sys);
  });

  it('medicationManager has empty medications Map', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    assertInstanceOf(sys.medicationManager.medications, Map);
    assertEqual(sys.medicationManager.maxMedicationsPerResident, 15);
    cleanup(sys);
  });

  it('emergencySOS defaults enabled with voiceKeywords', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    assertEqual(sys.emergencySOS.enabled, true);
    assert(sys.emergencySOS.voiceKeywords.length >= 5);
    cleanup(sys);
  });

  it('exercisePrompts has 10 chair exercises', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    assertEqual(sys.exercisePrompts.chairExercises.length, 10);
    cleanup(sys);
  });

  it('environmentalSafety default readings all null/false', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    const r = sys.environmentalSafety.currentReadings;
    assertEqual(r.temperatureC, null);
    assertEqual(r.smokeDetected, false);
    assertEqual(r.coDetected, false);
    cleanup(sys);
  });

  it('stats counters all start at zero', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    assertEqual(sys.stats.fallsDetected, 0);
    assertEqual(sys.stats.sosTriggered, 0);
    assertEqual(sys.stats.medicationRemindersIssued, 0);
    assertEqual(sys.stats.monitoringCyclesCompleted, 0);
    cleanup(sys);
  });

  it('caregiverDashboard has rolePermissions', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    assert(sys.caregiverDashboard.rolePermissions.primary.includes('admin'));
    assert(sys.caregiverDashboard.rolePermissions.family.includes('read'));
    assertEqual(sys.caregiverDashboard.rolePermissions.visitor.length, 0);
    cleanup(sys);
  });

  it('sleepMonitoring defaults', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    assertEqual(sys.sleepMonitoring.averageSleepHours, 7.5);
    assertEqual(sys.sleepMonitoring.sleepQualityScore, 0);
    cleanup(sys);
  });

  it('voiceControl has Swedish and English languages', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    assert(sys.voiceControl.languages.includes('sv'));
    assert(sys.voiceControl.languages.includes('en'));
    cleanup(sys);
  });

  it('mealManagement has schedule and nutrition targets', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    assertEqual(sys.mealManagement.mealSchedule.breakfast, '08:00');
    assertEqual(sys.mealManagement.nutritionTracking.dailyTargets.calories, 1800);
    cleanup(sys);
  });

  it('accessibilityFeatures defaults', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    assertEqual(sys.accessibilityFeatures.highContrastDisplays, true);
    assertEqual(sys.accessibilityFeatures.wheelchairAccessible, true);
    assertEqual(sys.accessibilityFeatures.devicePlacementHeightCm, 90);
    cleanup(sys);
  });
});

/* ════════════════════════════════════════════════
   initialize
   ════════════════════════════════════════════════ */
describe('HomeAccessibilityElderlyCareSystem › initialize', () => {
  it('sets initialized to true and starts monitoring', async () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.initialized, true);
    assert(sys.monitoringInterval !== null);
    assert(sys.startTime !== null);
    cleanup(sys);
  });

  it('idempotent — second call is no-op', async () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    await sys.initialize();
    const startTime = sys.startTime;
    await sys.initialize();
    assertEqual(sys.startTime, startTime);
    cleanup(sys);
  });
});

/* ════════════════════════════════════════════════
   resident management
   ════════════════════════════════════════════════ */
describe('HomeAccessibilityElderlyCareSystem › residents', () => {
  it('addResident creates resident with defaults', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    const r = sys.addResident('r1', { name: 'Anna', age: 78 });
    assertEqual(r.name, 'Anna');
    assertEqual(r.age, 78);
    assertEqual(r.mobilityLevel, 'independent');
    assertEqual(r.cognitiveLevel, 'normal');
    assertEqual(sys.residents.size, 1);
    cleanup(sys);
  });

  it('addResident with full profile', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    const r = sys.addResident('r1', {
      name: 'Erik',
      age: 82,
      conditions: ['osteoporosis'],
      bloodType: 'A+',
      mobilityLevel: 'limited',
      diet: 'diabetic'
    });
    assertEqual(r.conditions.length, 1);
    assertEqual(r.bloodType, 'A+');
    assertEqual(r.mobilityLevel, 'limited');
    assertEqual(r.diet, 'diabetic');
    cleanup(sys);
  });

  it('getResident returns resident or null', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    sys.addResident('r1', { name: 'Anna' });
    const r = sys.getResident('r1');
    assertEqual(r.name, 'Anna');
    assertEqual(sys.getResident('unknown'), null);
    cleanup(sys);
  });

  it('removeResident deletes resident', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    sys.addResident('r1', { name: 'Anna' });
    assertEqual(sys.removeResident('r1'), true);
    assertEqual(sys.residents.size, 0);
    cleanup(sys);
  });

  it('removeResident returns false for unknown', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    assertEqual(sys.removeResident('nope'), false);
    cleanup(sys);
  });
});

/* ════════════════════════════════════════════════
   fall detection — processMotionEvent
   ════════════════════════════════════════════════ */
describe('HomeAccessibilityElderlyCareSystem › processMotionEvent', () => {
  it('returns null when fall detection disabled', async () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    sys.fallDetection.enabled = false;
    const res = await sys.processMotionEvent('bathroom', { impactForce: 10 });
    assertEqual(res, null);
    cleanup(sys);
  });

  it('returns null for unmonitored room', async () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    const res = await sys.processMotionEvent('garage', { impactForce: 10 });
    assertEqual(res, null);
    cleanup(sys);
  });

  it('returns null for low impact force', async () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    const res = await sys.processMotionEvent('bathroom', { impactForce: 3 });
    assertEqual(res, null);
    cleanup(sys);
  });

  it('rejects false positive (object drop)', async () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    const res = await sys.processMotionEvent('bathroom', {
      impactForce: 10,
      vibrationPattern: 'object_drop',
      movementDetected: true
    });
    assertType(res, 'object');
    assertEqual(res.type, 'false_positive');
    assertEqual(sys.stats.falsePositiveFallsRejected, 1);
    cleanup(sys);
  });

  it('rejects false positive (low mass)', async () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    const res = await sys.processMotionEvent('kitchen', {
      impactForce: 9,
      estimatedMassKg: 5,
      movementDetected: true
    });
    assertEqual(res.type, 'false_positive');
    cleanup(sys);
  });

  it('triggers fall alert when no movement after impact', async () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    // Shorten escalation delays to 0 for testing
    sys.fallDetection.escalationSteps = sys.fallDetection.escalationSteps.map(s => ({ ...s, delayMs: 0 }));
    const res = await sys.processMotionEvent('bathroom', {
      impactForce: 10,
      movementDetected: false
    });
    assertType(res, 'object');
    assertEqual(res.type, 'fall_detected');
    assertEqual(res.room, 'bathroom');
    assertEqual(sys.stats.fallsDetected, 1);
    cleanup(sys);
  });
});

/* ════════════════════════════════════════════════
   calculateDailyFallRisk
   ════════════════════════════════════════════════ */
describe('HomeAccessibilityElderlyCareSystem › calculateDailyFallRisk', () => {
  it('returns 0 for unknown resident', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    assertEqual(sys.calculateDailyFallRisk('nope'), 0);
    cleanup(sys);
  });

  it('calculates risk based on age', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    sys.addResident('r1', { name: 'Anna', age: 85 });
    const risk = sys.calculateDailyFallRisk('r1');
    assert(risk >= 25); // age>80 = +25
    cleanup(sys);
  });

  it('adds mobility and condition factors', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    sys.addResident('r1', {
      name: 'Erik',
      age: 82,
      mobilityLevel: 'assisted',
      conditions: ['osteoporosis', 'vertigo']
    });
    const risk = sys.calculateDailyFallRisk('r1');
    // 25 (age>80) + 30 (assisted) + 15 (osteo) + 10 (vertigo) = 80
    assert(risk >= 80);
    cleanup(sys);
  });

  it('caps risk at 100', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    sys.addResident('r1', {
      name: 'Erik',
      age: 85,
      mobilityLevel: 'assisted',
      conditions: ['osteoporosis', 'vertigo', 'low_blood_pressure']
    });
    // push recent falls to max out score
    sys.fallDetection.recentEvents.push(
      { timestamp: Date.now() },
      { timestamp: Date.now() },
      { timestamp: Date.now() }
    );
    const risk = sys.calculateDailyFallRisk('r1');
    assert(risk <= 100);
    cleanup(sys);
  });
});

/* ════════════════════════════════════════════════
   getActivityScore
   ════════════════════════════════════════════════ */
describe('HomeAccessibilityElderlyCareSystem › getActivityScore', () => {
  it('returns 0 when no activity scores exist', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    sys.inactivityMonitoring.activityScores = {};
    assertEqual(sys.getActivityScore('r1'), 0);
    cleanup(sys);
  });

  it('returns average of room scores', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    sys.inactivityMonitoring.activityScores = { bathroom: 80, kitchen: 60 };
    assertEqual(sys.getActivityScore('r1'), 70);
    cleanup(sys);
  });
});

/* ════════════════════════════════════════════════
   medication management
   ════════════════════════════════════════════════ */
describe('HomeAccessibilityElderlyCareSystem › medications', () => {
  it('addMedication adds and returns med object', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    const med = sys.addMedication('r1', { name: 'Aspirin', dosage: '100mg' });
    assertType(med, 'object');
    assertEqual(med.name, 'Aspirin');
    assertEqual(med.dosage, '100mg');
    assertEqual(med.active, true);
    assert(med.id.startsWith('med_'));
    cleanup(sys);
  });

  it('addMedication defaults pillsRemaining to 90', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    const med = sys.addMedication('r1', { name: 'Metformin' });
    assertEqual(med.pillsRemaining, 90);
    assertEqual(med.pillsPerDose, 1);
    cleanup(sys);
  });

  it('returns null when max medications reached', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    for (let i = 0; i < 15; i++) {
      sys.addMedication('r1', { name: `Med${i}` });
    }
    const extra = sys.addMedication('r1', { name: 'TooMany' });
    assertEqual(extra, null);
    cleanup(sys);
  });

  it('removeMedication deactivates med', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    const med = sys.addMedication('r1', { name: 'Aspirin' });
    assertEqual(sys.removeMedication('r1', med.id), true);
    const meds = sys.medicationManager.medications.get('r1');
    assertEqual(meds[0].active, false);
    cleanup(sys);
  });

  it('removeMedication returns false for unknown', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    assertEqual(sys.removeMedication('r1', 'nope'), false);
    cleanup(sys);
  });

  it('confirmMedicationTaken decrements pills', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    const med = sys.addMedication('r1', { name: 'Aspirin', pillsRemaining: 10, pillsPerDose: 2 });
    assertEqual(sys.confirmMedicationTaken('r1', med.id), true);
    const meds = sys.medicationManager.medications.get('r1');
    assertEqual(meds[0].pillsRemaining, 8);
    cleanup(sys);
  });

  it('confirmMedicationTaken returns false for unknown', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    assertEqual(sys.confirmMedicationTaken('r1', 'nope'), false);
    cleanup(sys);
  });

  it('detects drug interactions', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    sys.addMedication('r1', { name: 'Warfarin' });
    sys.addMedication('r1', { name: 'Aspirin', interactions: ['Warfarin'] });
    assertEqual(sys.medicationManager.drugInteractions.length, 1);
    assertEqual(sys.medicationManager.drugInteractions[0].medication1, 'Aspirin');
    assertEqual(sys.medicationManager.drugInteractions[0].medication2, 'Warfarin');
    cleanup(sys);
  });
});

/* ════════════════════════════════════════════════
   triggerSOS / resolveEmergency
   ════════════════════════════════════════════════ */
describe('HomeAccessibilityElderlyCareSystem › emergencySOS', () => {
  it('triggerSOS creates active emergency', async () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    // Zero out escalation delays
    sys.emergencySOS.escalationChain = sys.emergencySOS.escalationChain.map(s => ({ ...s, delayMs: 0 }));
    const em = await sys.triggerSOS('wearable_panic_button', { room: 'bathroom' });
    assertType(em, 'object');
    assert(em.id.startsWith('sos_'));
    assertEqual(em.source, 'wearable_panic_button');
    assertEqual(em.location, 'bathroom');
    assertEqual(sys.stats.sosTriggered, 1);
    assertEqual(sys.emergencySOS.activeEmergencies.length, 1);
    cleanup(sys);
  });

  it('resolveEmergency marks emergency resolved', async () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    sys.emergencySOS.escalationChain = sys.emergencySOS.escalationChain.map(s => ({ ...s, delayMs: 0 }));
    const em = await sys.triggerSOS('voice_activated', {});
    assertEqual(sys.resolveEmergency(em.id), true);
    assertEqual(em.resolved, true);
    assert(em.resolvedAt > 0);
    cleanup(sys);
  });

  it('resolveEmergency returns false for unknown id', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    assertEqual(sys.resolveEmergency('nope'), false);
    cleanup(sys);
  });
});

/* ════════════════════════════════════════════════
   processVoiceCommand
   ════════════════════════════════════════════════ */
describe('HomeAccessibilityElderlyCareSystem › processVoiceCommand', () => {
  it('returns null when voice control disabled', async () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    sys.voiceControl.enabled = false;
    assertEqual(await sys.processVoiceCommand('lights on'), null);
    cleanup(sys);
  });

  it('triggers SOS on emergency keyword', async () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    sys.emergencySOS.escalationChain = sys.emergencySOS.escalationChain.map(s => ({ ...s, delayMs: 0 }));
    const res = await sys.processVoiceCommand('help me please');
    assertType(res, 'object');
    assert(res.id.startsWith('sos_'));
    assertEqual(sys.stats.sosTriggered, 1);
    cleanup(sys);
  });

  it('triggers SOS on Swedish keyword', async () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    sys.emergencySOS.escalationChain = sys.emergencySOS.escalationChain.map(s => ({ ...s, delayMs: 0 }));
    const res = await sys.processVoiceCommand('hjälp mig');
    assertType(res, 'object');
    assert(res.id.startsWith('sos_'));
    cleanup(sys);
  });

  it('matches simplified commands', async () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    const res = await sys.processVoiceCommand('lights on');
    assertEqual(res.action, 'turnOnLights');
    assertEqual(res.success, true);
    cleanup(sys);
  });

  it('matches Swedish voice commands', async () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    const res = await sys.processVoiceCommand('tänd lampan');
    assertEqual(res.action, 'turnOnLights');
    cleanup(sys);
  });

  it('announceTime returns time string', async () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    const res = await sys.processVoiceCommand('what time is it');
    assertEqual(res.action, 'announceTime');
    assertType(res.time, 'string');
    cleanup(sys);
  });

  it('unrecognized command returns recognized=false', async () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    // Disable fuzzy matching so test is deterministic
    sys.voiceControl.largeVocabularyTolerance = false;
    const res = await sys.processVoiceCommand('xyzzy gibberish');
    assertEqual(res.recognized, false);
    cleanup(sys);
  });
});

/* ════════════════════════════════════════════════
   cognitive support
   ════════════════════════════════════════════════ */
describe('HomeAccessibilityElderlyCareSystem › cognitiveSupport', () => {
  it('performCognitiveAnnouncement returns announcement', async () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    const a = await sys.performCognitiveAnnouncement();
    assertType(a.time, 'string');
    assertType(a.day, 'string');
    assertType(a.date, 'string');
    assertType(a.weather, 'object');
    assertEqual(sys.stats.cognitiveAnnouncements, 1);
    cleanup(sys);
  });

  it('addAppointment stores and returns appointment', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    const ap = sys.addAppointment('r1', {
      title: 'Doctor visit',
      dateTime: new Date(Date.now() + 3600000).toISOString(),
      location: 'Hospital'
    });
    assert(ap.id.startsWith('appt_'));
    assertEqual(ap.title, 'Doctor visit');
    assertEqual(ap.location, 'Hospital');
    assertEqual(sys.cognitiveSupport.appointments.length, 1);
    cleanup(sys);
  });

  it('announceRoomEntry runs without error', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    sys.addResident('r1', { name: 'Anna' });
    sys.announceRoomEntry('kitchen', 'r1');
    // No throw = success
    assert(true);
    cleanup(sys);
  });

  it('announceRoomEntry does nothing when disabled', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    sys.cognitiveSupport.roomAnnouncementsOnEntry = false;
    sys.announceRoomEntry('kitchen', 'r1');
    assert(true);
    cleanup(sys);
  });
});

/* ════════════════════════════════════════════════
   adaptive lighting
   ════════════════════════════════════════════════ */
describe('HomeAccessibilityElderlyCareSystem › adaptiveLighting', () => {
  it('handleMotionForLighting runs for day', async () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    await sys.handleMotionForLighting('bedroom', false);
    assert(true);
    cleanup(sys);
  });

  it('handleMotionForLighting runs for night', async () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    await sys.handleMotionForLighting('hallway', true);
    assert(true);
    cleanup(sys);
  });

  it('does nothing when disabled', async () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    sys.adaptiveLighting.enabled = false;
    await sys.handleMotionForLighting('bedroom', true);
    assert(true);
    cleanup(sys);
  });
});

/* ════════════════════════════════════════════════
   adjustVolumeForResident
   ════════════════════════════════════════════════ */
describe('HomeAccessibilityElderlyCareSystem › adjustVolumeForResident', () => {
  it('returns volume settings for resident', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    sys.addResident('r1', { name: 'Anna', hearingProfile: { volumeBoostDb: 10 } });
    const vol = sys.adjustVolumeForResident('r1');
    assertType(vol, 'object');
    assertEqual(vol.volumeBoostDb, 10);
    assertType(vol.preferredFrequencyHz, 'number');
    cleanup(sys);
  });

  it('returns null for unknown resident', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    assertEqual(sys.adjustVolumeForResident('unknown'), null);
    cleanup(sys);
  });

  it('returns null when autoAdjust disabled', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    sys.addResident('r1', { name: 'Anna' });
    sys.voiceControl.autoAdjustVolume = false;
    assertEqual(sys.adjustVolumeForResident('r1'), null);
    cleanup(sys);
  });
});

/* ════════════════════════════════════════════════
   vital signs
   ════════════════════════════════════════════════ */
describe('HomeAccessibilityElderlyCareSystem › vitalSigns', () => {
  it('recordVitalReading stores blood_pressure', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    const r = sys.recordVitalReading('blood_pressure', { systolic: 130, diastolic: 85 });
    assertType(r, 'object');
    assertEqual(r.systolic, 130);
    assert(r.timestamp > 0);
    assertEqual(sys.vitalSigns.bloodPressure.readings.length, 1);
    cleanup(sys);
  });

  it('recordVitalReading stores heart_rate', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    const r = sys.recordVitalReading('heart_rate', { bpm: 72 });
    assertEqual(r.bpm, 72);
    assertEqual(sys.vitalSigns.heartRate.readings.length, 1);
    cleanup(sys);
  });

  it('recordVitalReading stores spo2', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    const r = sys.recordVitalReading('spo2', { pct: 97 });
    assertEqual(r.pct, 97);
    cleanup(sys);
  });

  it('recordVitalReading stores weight', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    const r = sys.recordVitalReading('weight', { kg: 70 });
    assertEqual(r.kg, 70);
    cleanup(sys);
  });

  it('recordVitalReading stores blood_glucose', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    const r = sys.recordVitalReading('blood_glucose', { mgDl: 110 });
    assertEqual(r.mgDl, 110);
    cleanup(sys);
  });

  it('recordVitalReading returns null for unknown type', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    assertEqual(sys.recordVitalReading('unknown_type', {}), null);
    cleanup(sys);
  });

  it('generateVitalTrendReport returns report', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    // Add some readings
    sys.recordVitalReading('blood_pressure', { systolic: 120, diastolic: 80 });
    sys.recordVitalReading('blood_pressure', { systolic: 130, diastolic: 85 });
    sys.recordVitalReading('heart_rate', { bpm: 72 });
    sys.recordVitalReading('heart_rate', { bpm: 75 });

    const report = sys.generateVitalTrendReport('r1');
    assertType(report, 'object');
    assertEqual(report.residentId, 'r1');
    assertType(report.generatedAt, 'string');
    assertEqual(report.windowDays, 30);
    assertType(report.bloodPressure, 'object');
    assertType(report.heartRate, 'object');
    cleanup(sys);
  });

  it('trend analysis returns insufficient_data with no readings', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    const report = sys.generateVitalTrendReport('r1');
    assertEqual(report.bloodPressure.trend, 'insufficient_data');
    cleanup(sys);
  });
});

/* ════════════════════════════════════════════════
   social isolation
   ════════════════════════════════════════════════ */
describe('HomeAccessibilityElderlyCareSystem › socialIsolation', () => {
  it('recordSocialEvent stores phone call', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    const ev = sys.recordSocialEvent('phone_call', { contact: 'Son' });
    assertEqual(ev.type, 'phone_call');
    assert(ev.timestamp > 0);
    assertEqual(sys.socialIsolation.phoneCallFrequency.readings.length, 1);
    cleanup(sys);
  });

  it('recordSocialEvent stores visitor', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    sys.recordSocialEvent('visitor', { name: 'Friend' });
    assertEqual(sys.socialIsolation.visitorFrequency.readings.length, 1);
    cleanup(sys);
  });

  it('recordSocialEvent stores video_call', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    sys.recordSocialEvent('video_call', { platform: 'zoom' });
    assertEqual(sys.socialIsolation.videoCallLogs.length, 1);
    cleanup(sys);
  });
});

/* ════════════════════════════════════════════════
   caregiver management
   ════════════════════════════════════════════════ */
describe('HomeAccessibilityElderlyCareSystem › caregivers', () => {
  it('addCaregiver creates and returns caregiver', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    const cg = sys.addCaregiver('cg1', { name: 'Nurse Lisa', role: 'primary', phone: '+46700000' });
    assertEqual(cg.name, 'Nurse Lisa');
    assertEqual(cg.role, 'primary');
    assert(cg.permissions.includes('admin'));
    assertEqual(sys.caregiverDashboard.caregivers.size, 1);
    cleanup(sys);
  });

  it('addCaregiver defaults to secondary role', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    const cg = sys.addCaregiver('cg1', { name: 'Helper' });
    assertEqual(cg.role, 'secondary');
    assert(cg.permissions.includes('write'));
    assert(!cg.permissions.includes('admin'));
    cleanup(sys);
  });

  it('removeCaregiver deletes caregiver', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    sys.addCaregiver('cg1', { name: 'Helper' });
    assertEqual(sys.removeCaregiver('cg1'), true);
    assertEqual(sys.caregiverDashboard.caregivers.size, 0);
    cleanup(sys);
  });

  it('removeCaregiver returns false for unknown', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    assertEqual(sys.removeCaregiver('nope'), false);
    cleanup(sys);
  });

  it('addShiftHandoffNote records note', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    const note = sys.addShiftHandoffNote('cg1', 'Patient was restless tonight');
    assertEqual(note.caregiverId, 'cg1');
    assertEqual(note.note, 'Patient was restless tonight');
    assert(note.timestamp > 0);
    assertEqual(sys.caregiverDashboard.shiftHandoffNotes.length, 1);
    cleanup(sys);
  });

  it('completeTask records task completion', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    const task = sys.completeTask('cg1', 'medication', { med: 'Aspirin' });
    assertEqual(task.caregiverId, 'cg1');
    assertEqual(task.type, 'medication');
    assertEqual(sys.caregiverDashboard.taskCompletion.medication.length, 1);
    cleanup(sys);
  });
});

/* ════════════════════════════════════════════════
   getCareLog
   ════════════════════════════════════════════════ */
describe('HomeAccessibilityElderlyCareSystem › getCareLog', () => {
  it('returns empty array with no events', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    const log = sys.getCareLog();
    assertEqual(log.length, 0);
    cleanup(sys);
  });

  it('filters by eventType', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    sys.completeTask('cg1', 'medication', {});
    sys.completeTask('cg1', 'meals', {});
    const log = sys.getCareLog({ eventType: 'task_medication' });
    assertEqual(log.length, 1);
    cleanup(sys);
  });

  it('respects limit option', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    sys.completeTask('cg1', 'medication', {});
    sys.completeTask('cg1', 'medication', {});
    sys.completeTask('cg1', 'medication', {});
    const log = sys.getCareLog({ limit: 2 });
    assertEqual(log.length, 2);
    cleanup(sys);
  });
});

/* ════════════════════════════════════════════════
   meal management & nutrition
   ════════════════════════════════════════════════ */
describe('HomeAccessibilityElderlyCareSystem › mealManagement', () => {
  it('reportStoveOn sets stoveOnSince', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    sys.reportStoveOn();
    assert(sys.mealManagement.stoveOnSince > 0);
    cleanup(sys);
  });

  it('reportStoveOff clears stoveOnSince', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    sys.reportStoveOn();
    sys.reportStoveOff();
    assertEqual(sys.mealManagement.stoveOnSince, null);
    cleanup(sys);
  });

  it('logNutrition accumulates intake', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    const r1 = sys.logNutrition('breakfast', { calories: 400, proteinG: 15, fiberG: 5, fluidMl: 300 });
    assertEqual(r1.todayIntake.calories, 400);
    const r2 = sys.logNutrition('lunch', { calories: 600, proteinG: 25, fiberG: 8, fluidMl: 400 });
    assertEqual(r2.todayIntake.calories, 1000);
    assertEqual(r2.todayIntake.proteinG, 40);
    cleanup(sys);
  });

  it('getNutritionSummary returns percentages', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    sys.logNutrition('breakfast', { calories: 900, proteinG: 30, fiberG: 12.5, fluidMl: 1000 });
    const summary = sys.getNutritionSummary();
    assertEqual(summary.percentages.calories, 50); // 900/1800
    assertEqual(summary.percentages.protein, 50); // 30/60
    assertEqual(summary.percentages.fiber, 50);    // 12.5/25
    assertEqual(summary.percentages.fluid, 50);    // 1000/2000
    cleanup(sys);
  });
});

/* ════════════════════════════════════════════════
   exercise
   ════════════════════════════════════════════════ */
describe('HomeAccessibilityElderlyCareSystem › exercise', () => {
  it('getExerciseLibrary returns array copy', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    const lib = sys.getExerciseLibrary();
    assertEqual(lib.length, 10);
    // mutation shouldn't affect original
    lib.pop();
    assertEqual(sys.exercisePrompts.chairExercises.length, 10);
    cleanup(sys);
  });

  it('recordExerciseSession records session', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    const session = sys.recordExerciseSession(1, 60);
    assertEqual(session.exerciseName, 'Seated Marching');
    assertEqual(session.durationSec, 60);
    assert(session.timestamp > 0);
    assertEqual(sys.stats.exerciseSessionsCompleted, 1);
    cleanup(sys);
  });

  it('recordExerciseSession with unknown exercise id', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    const session = sys.recordExerciseSession(999, 30);
    assertEqual(session.exerciseName, 'Unknown');
    cleanup(sys);
  });
});

/* ════════════════════════════════════════════════
   environmental safety
   ════════════════════════════════════════════════ */
describe('HomeAccessibilityElderlyCareSystem › environmentalSafety', () => {
  it('updateEnvironmentalReading sets valid reading', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    assertEqual(sys.updateEnvironmentalReading('temperatureC', 22), true);
    assertEqual(sys.environmentalSafety.currentReadings.temperatureC, 22);
    cleanup(sys);
  });

  it('updateEnvironmentalReading returns false for unknown type', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    assertEqual(sys.updateEnvironmentalReading('unknownSensor', 42), false);
    cleanup(sys);
  });

  it('updateEnvironmentalReading sets boolean values', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    assertEqual(sys.updateEnvironmentalReading('smokeDetected', true), true);
    assertEqual(sys.environmentalSafety.currentReadings.smokeDetected, true);
    cleanup(sys);
  });
});

/* ════════════════════════════════════════════════
   sleep monitoring
   ════════════════════════════════════════════════ */
describe('HomeAccessibilityElderlyCareSystem › sleepMonitoring', () => {
  it('recordSleepEvent in_bed sets inBedTime', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    const ev = sys.recordSleepEvent('in_bed');
    assertEqual(ev.type, 'in_bed');
    assert(sys.sleepMonitoring.bedSensor.inBedTime > 0);
    cleanup(sys);
  });

  it('recordSleepEvent wake records sleep data', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    sys.sleepMonitoring.bedSensor.inBedTime = Date.now() - 8 * 3600000; // 8 hours ago
    const ev = sys.recordSleepEvent('wake');
    assertEqual(ev.type, 'wake');
    assertEqual(sys.sleepMonitoring.recentNights.length, 1);
    const night = sys.sleepMonitoring.recentNights[0];
    assert(night.sleepHours >= 7 && night.sleepHours <= 9);
    assertType(night.qualityScore, 'number');
    cleanup(sys);
  });

  it('recordSleepEvent restless increments counter', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    sys.recordSleepEvent('in_bed');
    sys.recordSleepEvent('restless');
    sys.recordSleepEvent('restless');
    assertEqual(sys.sleepMonitoring.bedSensor.restlessnessEvents, 2);
    cleanup(sys);
  });

  it('recordSleepEvent bathroom_trip increments counter', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    sys.recordSleepEvent('in_bed');
    sys.recordSleepEvent('bathroom_trip');
    assertEqual(sys.sleepMonitoring.bedSensor.nighttimeBathroomTrips, 1);
    cleanup(sys);
  });

  it('getSleepReport with no data', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    const report = sys.getSleepReport(7);
    assertEqual(report.totalNights, 0);
    assertEqual(report.averageSleepHours, 0);
    cleanup(sys);
  });

  it('getSleepReport computes averages', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    sys.sleepMonitoring.recentNights = [
      { sleepHours: 7, qualityScore: 80, date: '' },
      { sleepHours: 8, qualityScore: 90, date: '' },
      { sleepHours: 6, qualityScore: 60, date: '' }
    ];
    const report = sys.getSleepReport(7);
    assertEqual(report.totalNights, 3);
    assertEqual(report.averageSleepHours, 7);
    assertEqual(report.averageQuality, 77); // (80+90+60)/3 = 76.67 → 77
    cleanup(sys);
  });
});

/* ════════════════════════════════════════════════
   visitor management
   ════════════════════════════════════════════════ */
describe('HomeAccessibilityElderlyCareSystem › visitorManagement', () => {
  it('addExpectedVisitor creates entry', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    const v = sys.addExpectedVisitor({
      name: 'Dr. Svensson',
      type: 'caregiver',
      expectedArrival: '14:00'
    });
    assert(v.id.startsWith('visitor_'));
    assertEqual(v.name, 'Dr. Svensson');
    assertEqual(v.type, 'caregiver');
    assertEqual(v.arrived, false);
    cleanup(sys);
  });

  it('recordVisitorArrival marks arrival', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    const v = sys.addExpectedVisitor({ name: 'Nurse', type: 'caregiver' });
    const result = sys.recordVisitorArrival(v.id);
    assertType(result, 'object');
    assertEqual(result.arrived, true);
    assert(result.arrivedAt > 0);
    assertEqual(sys.stats.visitorEvents, 1);
    cleanup(sys);
  });

  it('recordVisitorArrival for family adds to isolation tracking', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    const v = sys.addExpectedVisitor({ name: 'Son', type: 'family' });
    sys.recordVisitorArrival(v.id);
    assertEqual(sys.visitorManagement.familyVisitLog.length, 1);
    assertEqual(sys.socialIsolation.visitorFrequency.readings.length, 1);
    cleanup(sys);
  });

  it('recordVisitorArrival returns null for unknown id', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    assertEqual(sys.recordVisitorArrival('nope'), null);
    cleanup(sys);
  });

  it('recordUnknownVisitor creates alert when enabled', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    const ev = sys.recordUnknownVisitor({ description: 'Unknown person at door' });
    assertType(ev, 'object');
    assertEqual(ev.type, 'unknown_visitor');
    assertEqual(sys.stats.visitorEvents, 1);
    cleanup(sys);
  });

  it('recordUnknownVisitor returns null when disabled', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    sys.visitorManagement.unknownVisitorAlerts = false;
    assertEqual(sys.recordUnknownVisitor({ description: 'Someone' }), null);
    cleanup(sys);
  });
});

/* ════════════════════════════════════════════════
   accessibility settings
   ════════════════════════════════════════════════ */
describe('HomeAccessibilityElderlyCareSystem › accessibility', () => {
  it('getAccessibilitySettings returns copy', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    const settings = sys.getAccessibilitySettings();
    assertEqual(settings.highContrastDisplays, true);
    settings.highContrastDisplays = false;
    // Original unaffected
    assertEqual(sys.accessibilityFeatures.highContrastDisplays, true);
    cleanup(sys);
  });

  it('updateAccessibilitySetting updates valid key', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    assertEqual(sys.updateAccessibilitySetting('devicePlacementHeightCm', 110), true);
    assertEqual(sys.accessibilityFeatures.devicePlacementHeightCm, 110);
    cleanup(sys);
  });

  it('updateAccessibilitySetting returns false for unknown key', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    assertEqual(sys.updateAccessibilitySetting('nonexistentProp', true), false);
    cleanup(sys);
  });
});

/* ════════════════════════════════════════════════
   processDoorEvent
   ════════════════════════════════════════════════ */
describe('HomeAccessibilityElderlyCareSystem › processDoorEvent', () => {
  it('returns processed result', async () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    const res = await sys.processDoorEvent('front_door', { open: false });
    assertEqual(res.processed, true);
    assertEqual(res.doorSensor, 'front_door');
    cleanup(sys);
  });
});

/* ════════════════════════════════════════════════
   getStatistics
   ════════════════════════════════════════════════ */
describe('HomeAccessibilityElderlyCareSystem › getStatistics', () => {
  it('returns stats with all expected fields', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    const s = sys.getStatistics();
    assertType(s, 'object');
    assertType(s.fallsDetected, 'number');
    assertType(s.sosTriggered, 'number');
    assertType(s.residentsMonitored, 'number');
    assertType(s.activeMedications, 'number');
    assertType(s.caregiverCount, 'number');
    assertType(s.currentSleepScore, 'number');
    assertType(s.socialIsolationScore, 'number');
    assertType(s.environmentalReadings, 'object');
    assertEqual(s.initialized, false);
    cleanup(sys);
  });

  it('uptimeMs is 0 before initialization', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    assertEqual(sys.getStatistics().uptimeMs, 0);
    cleanup(sys);
  });

  it('reflects resident and caregiver counts', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    sys.addResident('r1', { name: 'Anna' });
    sys.addCaregiver('cg1', { name: 'Lisa' });
    const s = sys.getStatistics();
    assertEqual(s.residentsMonitored, 1);
    assertEqual(s.caregiverCount, 1);
    cleanup(sys);
  });
});

/* ════════════════════════════════════════════════
   getDashboardSummary
   ════════════════════════════════════════════════ */
describe('HomeAccessibilityElderlyCareSystem › getDashboardSummary', () => {
  it('returns comprehensive summary', () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    sys.addResident('r1', { name: 'Anna', age: 75 });
    sys.addCaregiver('cg1', { name: 'Lisa', role: 'primary' });
    const d = sys.getDashboardSummary();
    assertType(d, 'object');
    assert(d.timestamp > 0);
    assertEqual(d.residents.length, 1);
    assertEqual(d.residents[0].name, 'Anna');
    assertType(d.residents[0].fallRisk, 'number');
    assertType(d.nutritionSummary, 'object');
    assertType(d.statistics, 'object');
    assert(d.caregiverOnDuty.includes('Lisa'));
    cleanup(sys);
  });
});

/* ════════════════════════════════════════════════
   destroy
   ════════════════════════════════════════════════ */
describe('HomeAccessibilityElderlyCareSystem › destroy', () => {
  it('clears monitoring interval', async () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    await sys.initialize();
    assert(sys.monitoringInterval !== null);
    await sys.destroy();
    assertEqual(sys.monitoringInterval, null);
    cleanup(sys);
  });

  it('clears residents, medications, caregivers', async () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    sys.addResident('r1', { name: 'Anna' });
    sys.addMedication('r1', { name: 'Aspirin' });
    sys.addCaregiver('cg1', { name: 'Lisa' });
    await sys.destroy();
    assertEqual(sys.residents.size, 0);
    assertEqual(sys.medicationManager.medications.size, 0);
    assertEqual(sys.caregiverDashboard.caregivers.size, 0);
    assertEqual(sys.initialized, false);
    cleanup(sys);
  });
});

/* ════════════════════════════════════════════════
   lifecycle
   ════════════════════════════════════════════════ */
describe('HomeAccessibilityElderlyCareSystem › lifecycle', () => {
  it('full lifecycle: init → operate → destroy', async () => {
    const sys = new HomeAccessibilityElderlyCareSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.initialized, true);

    sys.addResident('r1', { name: 'Anna', age: 80 });
    sys.addCaregiver('cg1', { name: 'Lisa', role: 'primary' });
    sys.addMedication('r1', { name: 'Metformin', dosage: '500mg' });
    sys.recordVitalReading('blood_pressure', { systolic: 130, diastolic: 85 });
    sys.logNutrition('breakfast', { calories: 400 });
    sys.recordExerciseSession(1, 60);
    sys.recordSleepEvent('in_bed');

    const stats = sys.getStatistics();
    assertEqual(stats.residentsMonitored, 1);
    assertEqual(stats.caregiverCount, 1);
    assertEqual(stats.exerciseSessionsCompleted, 1);

    await sys.destroy();
    assertEqual(sys.initialized, false);
    assertEqual(sys.residents.size, 0);
    cleanup(sys);
  });
});

run();
