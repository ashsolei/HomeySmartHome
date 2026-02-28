'use strict';

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertType } = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');

/* ── timer-leak prevention ─────────────────────────────── */
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

const SmartNoiseManagementSystem = require('../lib/SmartNoiseManagementSystem');

function makeHomey() {
  return createMockHomey();
}

/* ═══════════════════════════════════════════════════════════
   SmartNoiseManagementSystem – Test Suite
   ═══════════════════════════════════════════════════════════ */

describe('SmartNoiseManagement — constructor', () => {
  it('creates instance with default state', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    assertEqual(sys._initialized, false);
    assertType(sys.roomProfiles, 'object');
    assertEqual(sys.roomProfiles.size, 0);
    assertEqual(sys.noiseSchedules.length, 0);
    assertEqual(sys.partyMode.active, false);
    assertEqual(sys.neighborAwareness.buildingType, 'detached');
    assertEqual(sys.workFromHome.meetingMode, false);
    assertEqual(sys.monitoringCycleMs, 30000);
    cleanup(sys);
  });
});

describe('SmartNoiseManagement — initialize', () => {
  it('sets up defaults and starts monitoring', async () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    await sys.initialize();
    assertEqual(sys._initialized, true);
    // _setupDefaultSchedules adds 2 schedules
    assertEqual(sys.noiseSchedules.length, 2);
    assertEqual(sys.noiseSchedules[0].name, 'Default Quiet Hours');
    assertEqual(sys.noiseSchedules[1].name, 'Work Hours - Office Quiet');
    // _setupGenreVolumeLimits populates genre limits
    assert(sys.musicManagement.genreVolumeLimits.size > 0);
    assertEqual(sys.musicManagement.genreVolumeLimits.get('classical'), 70);
    assertEqual(sys.musicManagement.genreVolumeLimits.get('ambient'), 50);
    cleanup(sys);
  });
});

describe('SmartNoiseManagement — room profiles', () => {
  it('registers and retrieves a room profile', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    const p = sys.registerRoomProfile('bedroom1', {
      name: 'Master Bedroom',
      primaryUse: 'bedroom',
      acousticType: 'soft',
      roomVolumeM3: 50
    });
    assertType(p, 'object');
    assertEqual(p.id, 'bedroom1');
    assertEqual(p.name, 'Master Bedroom');
    assertEqual(p.primaryUse, 'bedroom');
    assertEqual(p.acousticType, 'soft');
    assertEqual(p.roomVolumeM3, 50);
    assertEqual(sys.roomProfiles.size, 1);
    const fetched = sys.getRoomProfile('bedroom1');
    assertEqual(fetched.id, 'bedroom1');
    cleanup(sys);
  });

  it('returns null when max 12 rooms reached', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    for (let i = 0; i < 12; i++) {
      sys.registerRoomProfile(`room${i}`, { name: `Room ${i}` });
    }
    assertEqual(sys.roomProfiles.size, 12);
    const extra = sys.registerRoomProfile('room99', { name: 'Extra' });
    assertEqual(extra, null);
    assertEqual(sys.roomProfiles.size, 12);
    cleanup(sys);
  });

  it('updates room profile properties', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    sys.registerRoomProfile('office1', { name: 'Office', primaryUse: 'office' });
    const updated = sys.updateRoomProfile('office1', { name: 'Home Office', acousticType: 'hard' });
    assertEqual(updated.name, 'Home Office');
    assertEqual(updated.acousticType, 'hard');
    cleanup(sys);
  });

  it('removes room and associated data', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    sys.registerRoomProfile('rm1', { name: 'Room' });
    assertEqual(sys.realtimeNoise.has('rm1'), true);
    const removed = sys.removeRoomProfile('rm1');
    assertEqual(removed, true);
    assertEqual(sys.roomProfiles.has('rm1'), false);
    assertEqual(sys.realtimeNoise.has('rm1'), false);
    cleanup(sys);
  });

  it('getAllRoomProfiles returns array', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    sys.registerRoomProfile('r1', { name: 'R1' });
    sys.registerRoomProfile('r2', { name: 'R2' });
    const all = sys.getAllRoomProfiles();
    assertEqual(all.length, 2);
    cleanup(sys);
  });
});

describe('SmartNoiseManagement — noise samples', () => {
  it('processes noise sample and updates real-time data', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    sys.registerRoomProfile('room1', { name: 'Test Room' });
    sys.processNoiseSample('room1', 65, 'speech');
    const data = sys.getRoomNoiseData('room1');
    assertEqual(data.currentDb, 65);
    assertEqual(data.lastClassification, 'speech');
    assert(data.peakDb >= 65);
    cleanup(sys);
  });

  it('ignores samples for unregistered rooms', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    // Should not throw
    sys.processNoiseSample('unknown', 50, 'speech');
    const data = sys.getRoomNoiseData('unknown');
    assertEqual(data, null);
    cleanup(sys);
  });

  it('tracks peak levels', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    sys.registerRoomProfile('r1', { name: 'R' });
    sys.processNoiseSample('r1', 40, 'unknown');
    sys.processNoiseSample('r1', 90, 'music');
    sys.processNoiseSample('r1', 50, 'speech');
    const data = sys.getRoomNoiseData('r1');
    assertEqual(data.peakDb, 90);
    assertEqual(data.currentDb, 50);
    cleanup(sys);
  });

  it('resetPeak resets peak to current level', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    sys.registerRoomProfile('r1', { name: 'R' });
    sys.processNoiseSample('r1', 80, 'music');
    sys.processNoiseSample('r1', 40, 'unknown');
    sys.resetPeak('r1');
    const data = sys.getRoomNoiseData('r1');
    assertEqual(data.peakDb, 40);
    cleanup(sys);
  });
});

describe('SmartNoiseManagement — quiet zones', () => {
  it('defines and retrieves a quiet zone', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    sys.registerRoomProfile('nursery', { name: 'Nursery', primaryUse: 'nursery' });
    const zone = sys.defineQuietZone('nursery', { maxDbThreshold: 35 });
    assertType(zone, 'object');
    assertEqual(zone.roomId, 'nursery');
    assertEqual(zone.maxDbThreshold, 35);
    assertEqual(zone.enabled, true);
    assertEqual(zone.violationCount, 0);
    cleanup(sys);
  });

  it('returns null for unknown room', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    const zone = sys.defineQuietZone('unknown', {});
    assertEqual(zone, null);
    cleanup(sys);
  });

  it('updates quiet zone settings', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    sys.registerRoomProfile('rm', { name: 'R' });
    sys.defineQuietZone('rm', { maxDbThreshold: 45 });
    const updated = sys.updateQuietZone('rm', { maxDbThreshold: 30, enabled: false });
    assertEqual(updated.maxDbThreshold, 30);
    assertEqual(updated.enabled, false);
    cleanup(sys);
  });

  it('removes quiet zone', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    sys.registerRoomProfile('rm', { name: 'R' });
    sys.defineQuietZone('rm', {});
    assertEqual(sys.removeQuietZone('rm'), true);
    assertEqual(sys.removeQuietZone('rm'), false);
    cleanup(sys);
  });
});

describe('SmartNoiseManagement — sound masking', () => {
  it('configures sound masking for a room', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    sys.registerRoomProfile('office', { name: 'Office' });
    const m = sys.configureSoundMasking('office', {
      soundType: 'pink_noise',
      volumePercent: 40
    });
    assertEqual(m.soundType, 'pink_noise');
    assertEqual(m.volumePercent, 40);
    assertEqual(m.active, false);
    cleanup(sys);
  });

  it('returns null for unknown room', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    const m = sys.configureSoundMasking('unknown', { soundType: 'rain' });
    assertEqual(m, null);
    cleanup(sys);
  });

  it('activates and deactivates masking', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    sys.registerRoomProfile('r1', { name: 'R' });
    sys.configureSoundMasking('r1', { soundType: 'rain' });
    assertEqual(sys.activateSoundMasking('r1'), true);
    assertEqual(sys.soundMaskingConfigs.get('r1').active, true);
    assertEqual(sys.deactivateSoundMasking('r1'), true);
    assertEqual(sys.soundMaskingConfigs.get('r1').active, false);
    cleanup(sys);
  });

  it('sets volume and type', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    sys.registerRoomProfile('r1', { name: 'R' });
    sys.configureSoundMasking('r1', { soundType: 'ocean', volumePercent: 50 });
    sys.setSoundMaskingVolume('r1', 75);
    assertEqual(sys.soundMaskingConfigs.get('r1').volumePercent, 75);
    sys.setSoundMaskingType('r1', 'forest');
    assertEqual(sys.soundMaskingConfigs.get('r1').soundType, 'forest');
    // Invalid type should return false
    assertEqual(sys.setSoundMaskingType('r1', 'invalid_type'), false);
    cleanup(sys);
  });

  it('clamps volume to 0-100', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    sys.registerRoomProfile('r1', { name: 'R' });
    sys.configureSoundMasking('r1', { soundType: 'rain', volumePercent: 200 });
    assertEqual(sys.soundMaskingConfigs.get('r1').volumePercent, 100);
    sys.setSoundMaskingVolume('r1', -10);
    assertEqual(sys.soundMaskingConfigs.get('r1').volumePercent, 0);
    cleanup(sys);
  });
});

describe('SmartNoiseManagement — sleep environments', () => {
  it('configures and activates sleep mode', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    sys.registerRoomProfile('bed', { name: 'Bedroom', primaryUse: 'bedroom' });
    const se = sys.configureSleepEnvironment('bed', {
      targetDb: 28,
      autoMaskingEnabled: true,
      maskingSoundType: 'rain'
    });
    assertEqual(se.targetDb, 28);
    assertEqual(se.autoMaskingEnabled, true);
    assertEqual(se.active, false);

    const activated = sys.activateSleepMode('bed');
    assertEqual(activated, true);
    assertEqual(sys.sleepEnvironments.get('bed').active, true);
    // Sleep activation defines a quiet zone
    assert(sys.quietZones.has('bed'));
    cleanup(sys);
  });

  it('deactivates sleep mode', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    sys.registerRoomProfile('bed', { name: 'Bedroom' });
    sys.configureSleepEnvironment('bed', {});
    sys.activateSleepMode('bed');
    assertEqual(sys.deactivateSleepMode('bed'), true);
    assertEqual(sys.sleepEnvironments.get('bed').active, false);
    cleanup(sys);
  });

  it('wakeup ramp returns false if not enabled', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    sys.registerRoomProfile('bed', { name: 'Bedroom' });
    sys.configureSleepEnvironment('bed', { wakeUpSoundEnabled: false });
    assertEqual(sys.triggerWakeUpRamp('bed'), false);
    cleanup(sys);
  });
});

describe('SmartNoiseManagement — noise schedules', () => {
  it('adds and removes schedules', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    const s = sys.addNoiseSchedule({ name: 'Custom', startTime: '08:00', endTime: '18:00', maxDb: 50 });
    assertType(s.id, 'string');
    assertEqual(s.name, 'Custom');
    assertEqual(s.maxDb, 50);
    assert(sys.noiseSchedules.length >= 1);
    assertEqual(sys.removeNoiseSchedule(s.id), true);
    assertEqual(sys.removeNoiseSchedule(s.id), false);
    cleanup(sys);
  });

  it('updates a schedule', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    const s = sys.addNoiseSchedule({ name: 'Test', maxDb: 40 });
    const updated = sys.updateNoiseSchedule(s.id, { maxDb: 50, name: 'Updated' });
    assertEqual(updated.maxDb, 50);
    assertEqual(updated.name, 'Updated');
    cleanup(sys);
  });
});

describe('SmartNoiseManagement — noisy appliances', () => {
  it('registers and starts/stops an appliance', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    const a = sys.registerNoisyAppliance('washer', { name: 'Washing Machine', typicalNoiseDb: 60 });
    assertEqual(a.name, 'Washing Machine');
    assertEqual(a.isRunning, false);
    sys.startAppliance('washer');
    assertEqual(sys.noisyAppliances.get('washer').isRunning, true);
    sys.stopAppliance('washer');
    assertEqual(sys.noisyAppliances.get('washer').isRunning, false);
    cleanup(sys);
  });

  it('isGoodTimeForAppliance returns structured result', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    // Unregistered appliance
    const r1 = sys.isGoodTimeForAppliance('unknown');
    assertEqual(r1.ok, false);
    assertEqual(r1.reason, 'Appliance not found');

    sys.registerNoisyAppliance('dryer', { name: 'Dryer', typicalNoiseDb: 55 });
    const r2 = sys.isGoodTimeForAppliance('dryer');
    assertType(r2.ok, 'boolean');
    assertType(r2.reason, 'string');
    cleanup(sys);
  });

  it('getSuggestedRunTime returns timing info', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    assertEqual(sys.getSuggestedRunTime('unknown'), null);
    sys.registerNoisyAppliance('a1', { name: 'A', preferredRunHoursStart: '10:00', preferredRunHoursEnd: '18:00' });
    const timing = sys.getSuggestedRunTime('a1');
    assertEqual(timing.suggestedStart, '10:00');
    assertEqual(timing.suggestedEnd, '18:00');
    cleanup(sys);
  });
});

describe('SmartNoiseManagement — party mode', () => {
  it('activates and deactivates party mode', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    const pm = sys.activatePartyMode({ indoorLimitDb: 90, outdoorLimitDb: 75 });
    assertEqual(pm.active, true);
    assertEqual(pm.indoorLimitDb, 90);
    assertEqual(pm.outdoorLimitDb, 75);
    assertEqual(sys.deactivatePartyMode(), true);
    assertEqual(sys.partyMode.active, false);
    cleanup(sys);
  });

  it('getPartyModeStatus shows duration', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    sys.activatePartyMode({});
    const status = sys.getPartyModeStatus();
    assertEqual(status.active, true);
    assert(status.durationMs >= 0);
    assertEqual(status.neighborTimerHandle, 'active');
    cleanup(sys);
  });
});

describe('SmartNoiseManagement — neighbor awareness', () => {
  it('configures settings and auto-clamps for apartment', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    const cfg = sys.configureNeighborAwareness({
      buildingType: 'apartment',
      enabled: true,
      bassFrequencyLimit: 80,
      impactNoiseThreshold: 70
    });
    assertEqual(cfg.buildingType, 'apartment');
    assertEqual(cfg.enabled, true);
    // Auto-clamped for apartment: bass max 50, impact max 45
    assert(cfg.bassFrequencyLimit <= 50);
    assert(cfg.impactNoiseThreshold <= 45);
    cleanup(sys);
  });

  it('assessNeighborNoiseRisk returns structured result', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    sys.registerRoomProfile('r1', { name: 'R' });
    sys.processNoiseSample('r1', 70, 'music');
    sys.configureNeighborAwareness({ buildingType: 'apartment', thinWallRooms: ['r1'] });
    const risk = sys.assessNeighborNoiseRisk('r1');
    assertType(risk.riskScore, 'number');
    assert(risk.riskScore >= 0 && risk.riskScore <= 100);
    assertEqual(risk.isThinWall, true);
    assertEqual(risk.buildingType, 'apartment');
    assert(risk.mitigations.length > 0);
    cleanup(sys);
  });

  it('returns null for unknown room', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    assertEqual(sys.assessNeighborNoiseRisk('nowhere'), null);
    cleanup(sys);
  });
});

describe('SmartNoiseManagement — child monitoring', () => {
  it('configures child monitoring', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    sys.registerRoomProfile('nursery', { name: 'Nursery', primaryUse: 'nursery' });
    const mon = sys.configureChildMonitoring('nursery', { childName: 'Baby', childAge: 'infant' });
    assertEqual(mon.childName, 'Baby');
    assertEqual(mon.childAge, 'infant');
    assertEqual(mon.cryDetectionEnabled, true);
    assertEqual(mon.active, true);
    // Auto-creates quiet zone
    assert(sys.quietZones.has('nursery'));
    cleanup(sys);
  });

  it('processes cry detection above confidence threshold', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    sys.registerRoomProfile('nursery', { name: 'Nursery' });
    sys.configureChildMonitoring('nursery', { childName: 'Test' });
    sys.processCryDetection('nursery', 'hungry', 0.8);
    const mon = sys.childMonitoring.get('nursery');
    assertEqual(mon.cryEventCount, 1);
    assertEqual(mon.lastCryType, 'hungry');
    cleanup(sys);
  });

  it('ignores low confidence cry detections', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    sys.registerRoomProfile('nursery', { name: 'Nursery' });
    sys.configureChildMonitoring('nursery', { childName: 'Test' });
    sys.processCryDetection('nursery', 'tired', 0.3);
    const mon = sys.childMonitoring.get('nursery');
    assertEqual(mon.cryEventCount, 0);
    cleanup(sys);
  });

  it('activates and deactivates nap time', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    sys.registerRoomProfile('nursery', { name: 'Nursery' });
    sys.configureChildMonitoring('nursery', { childName: 'Test' });
    assertEqual(sys.activateNapTime('nursery'), true);
    // Nap time creates a stricter quiet zone (30 dB all day)
    const zone = sys.quietZones.get('nursery');
    assertEqual(zone.maxDbThreshold, 30);
    assertEqual(sys.deactivateNapTime('nursery'), true);
    cleanup(sys);
  });
});

describe('SmartNoiseManagement — work from home', () => {
  it('configures work-from-home settings', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    sys.registerRoomProfile('office', { name: 'Office', primaryUse: 'office' });
    const cfg = sys.configureWorkFromHome({ officeRoomId: 'office', adjacentRooms: ['hallway', 'living'] });
    assertEqual(cfg.officeRoomId, 'office');
    assertEqual(cfg.adjacentRooms.length, 2);
    cleanup(sys);
  });

  it('activates and deactivates meeting mode', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    sys.registerRoomProfile('office', { name: 'Office' });
    sys.configureWorkFromHome({ officeRoomId: 'office' });
    assertEqual(sys.activateMeetingMode(), true);
    assertEqual(sys.workFromHome.meetingMode, true);
    assertEqual(sys.workFromHome.callActive, true);
    assertEqual(sys.deactivateMeetingMode(), true);
    assertEqual(sys.workFromHome.meetingMode, false);
    cleanup(sys);
  });

  it('activates and deactivates focus mode', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    sys.registerRoomProfile('office', { name: 'Office' });
    sys.configureWorkFromHome({ officeRoomId: 'office' });
    assertEqual(sys.activateFocusMode(), true);
    assertEqual(sys.workFromHome.focusMode, true);
    // Focus mode adds quiet zone and sound masking
    assert(sys.quietZones.has('office'));
    assert(sys.soundMaskingConfigs.has('office'));
    assertEqual(sys.deactivateFocusMode(), true);
    assertEqual(sys.workFromHome.focusMode, false);
    cleanup(sys);
  });

  it('optimizeCallQuality returns actions', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    sys.registerRoomProfile('office', { name: 'Office' });
    sys.configureWorkFromHome({ officeRoomId: 'office', adjacentRooms: ['hall'] });
    const result = sys.optimizeCallQuality();
    assertEqual(result.optimized, true);
    assert(result.actions.length > 0);
    cleanup(sys);
  });
});

describe('SmartNoiseManagement — environmental noise', () => {
  it('updates and retrieves environmental noise', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    sys.updateEnvironmentalNoise({ trafficLevel: 70, constructionDetected: true });
    const status = sys.getEnvironmentalNoiseStatus();
    assertEqual(status.trafficLevel, 70);
    assertEqual(status.constructionDetected, true);
    // High traffic + construction → recommend closed
    assertEqual(status.windowsOpenRecommendation, false);
    cleanup(sys);
  });

  it('getAirQualityNoiseTradeoff returns assessment', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    sys.updateEnvironmentalNoise({ trafficLevel: 80 });
    const tradeoff = sys.getAirQualityNoiseTradeoff();
    assertEqual(tradeoff.outdoorNoiseImpact, 'high');
    assertEqual(tradeoff.windowRecommendation, 'closed');
    assertType(tradeoff.tradeoffNote, 'string');
    cleanup(sys);
  });
});

describe('SmartNoiseManagement — acoustics analysis', () => {
  it('generates suggestions for a room', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    sys.registerRoomProfile('media', { name: 'Media Room', primaryUse: 'media', acousticType: 'hard', reverberationTimeEstimate: 1.5 });
    const result = sys.analyzeRoomAcoustics('media');
    assertType(result, 'object');
    assertEqual(result.roomId, 'media');
    assert(result.suggestions.length > 0);
    // Should have echo reduction suggestion (reverb > 1.0)
    assert(result.suggestions.some(s => s.type === 'echo_reduction'));
    // Should have surface treatment suggestion (hard surface)
    assert(result.suggestions.some(s => s.type === 'surface_treatment'));
    // Should have bass trap (media room)
    assert(result.suggestions.some(s => s.type === 'bass_trap'));
    cleanup(sys);
  });

  it('returns null for unknown room', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    assertEqual(sys.analyzeRoomAcoustics('unknown'), null);
    cleanup(sys);
  });

  it('stores and retrieves suggestions', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    sys.registerRoomProfile('r1', { name: 'R', primaryUse: 'bedroom' });
    sys.analyzeRoomAcoustics('r1');
    const stored = sys.getAcousticSuggestions('r1');
    assertType(stored, 'object');
    assertEqual(stored.roomId, 'r1');
    cleanup(sys);
  });
});

describe('SmartNoiseManagement — health tracking', () => {
  it('getDailyExposure returns null without data', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    assertEqual(sys.getDailyExposure('r1'), null);
    cleanup(sys);
  });

  it('tracks exposure via processNoiseSample', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    sys.registerRoomProfile('r1', { name: 'R' });
    sys.processNoiseSample('r1', 60, 'speech');
    sys.processNoiseSample('r1', 75, 'music');
    const exp = sys.getDailyExposure('r1');
    assertType(exp, 'object');
    assertType(exp.averageDb, 'number');
    assert(exp.averageDb > 0);
    assertType(exp.isWithinWhoLimit, 'boolean');
    cleanup(sys);
  });

  it('calculateHearingHealthScore returns score', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    sys.registerRoomProfile('r1', { name: 'R' });
    // No data → score 100
    const noData = sys.calculateHearingHealthScore('r1');
    assertEqual(noData.score, 100);
    assertEqual(noData.rating, 'excellent');
    // Add loud samples
    for (let i = 0; i < 10; i++) {
      sys.processNoiseSample('r1', 90, 'music');
    }
    const loud = sys.calculateHearingHealthScore('r1');
    assert(loud.score < 100);
    cleanup(sys);
  });

  it('configureTinnitusProfile sets stricter limits', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    sys.registerRoomProfile('r1', { name: 'R' });
    sys.defineQuietZone('r1', { maxDbThreshold: 55 });
    sys.configureTinnitusProfile('r1', true);
    assert(sys.healthTracking.tinnitusProfiles.has('r1'));
    const zone = sys.quietZones.get('r1');
    assert(zone.maxDbThreshold <= 40);
    // Disable
    sys.configureTinnitusProfile('r1', false);
    assertEqual(sys.healthTracking.tinnitusProfiles.has('r1'), false);
    cleanup(sys);
  });
});

describe('SmartNoiseManagement — music management', () => {
  it('registers and unregisters music source', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    sys.registerRoomProfile('living', { name: 'Living' });
    const src = sys.registerMusicSource('living', { genre: 'jazz', volumePercent: 50 });
    assertEqual(src.genre, 'jazz');
    assertEqual(src.active, true);
    assertEqual(sys.unregisterMusicSource('living'), true);
    assertEqual(sys.musicManagement.activeSources.size, 0);
    cleanup(sys);
  });

  it('applies genre volume limits', async () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    await sys.initialize();
    sys.registerRoomProfile('r1', { name: 'R' });
    // Ambient limit is 50, so 80 should get capped
    const src = sys.registerMusicSource('r1', { genre: 'ambient', volumePercent: 80 });
    assertEqual(src.volumePercent, 50);
    cleanup(sys);
  });

  it('manages transition zones', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    sys.addTransitionZone('hallway');
    assert(sys.musicManagement.transitionZones.has('hallway'));
    assertEqual(sys.removeTransitionZone('hallway'), true);
    assertEqual(sys.musicManagement.transitionZones.has('hallway'), false);
    cleanup(sys);
  });

  it('getVolumeNormalization returns source info', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    // No sources
    const empty = sys.getVolumeNormalization();
    assertEqual(empty.sources.length, 0);
    assertEqual(empty.normalized, true);
    sys.registerRoomProfile('r1', { name: 'R' });
    sys.registerMusicSource('r1', { genre: 'pop', volumePercent: 60 });
    const norm = sys.getVolumeNormalization();
    assertEqual(norm.sources.length, 1);
    assertType(norm.averageVolume, 'number');
    cleanup(sys);
  });
});

describe('SmartNoiseManagement — vibration monitoring', () => {
  it('registers sensor and processes readings', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    const sensor = sys.registerVibrationSensor('vib1', { roomId: 'r1', type: 'appliance', thresholdLevel: 40 });
    assertEqual(sensor.type, 'appliance');
    assertEqual(sensor.active, true);
    sys.processVibrationReading('vib1', 30);
    assertEqual(sys.vibrationMonitoring.sensors.get('vib1').currentLevel, 30);
    cleanup(sys);
  });

  it('setHvacVibrationBaseline and setHeavyTrafficHours', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    sys.setHvacVibrationBaseline(25);
    assertEqual(sys.vibrationMonitoring.hvacBaseline, 25);
    sys.setHeavyTrafficHours([7, 8, 17, 18]);
    assertEqual(sys.vibrationMonitoring.heavyTrafficHours.length, 4);
    cleanup(sys);
  });

  it('getVibrationIsolationRecommendations with high HVAC', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    sys.setHvacVibrationBaseline(40);
    const recs = sys.getVibrationIsolationRecommendations();
    assert(recs.length > 0);
    assert(recs.some(r => r.sensorId === 'hvac_system'));
    cleanup(sys);
  });
});

describe('SmartNoiseManagement — reports', () => {
  it('generates daily report', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    sys.registerRoomProfile('r1', { name: 'Room 1' });
    const report = sys.generateDailyReport();
    assertType(report, 'object');
    assertEqual(report.totalRooms, 1);
    assertEqual(report.rooms.length, 1);
    assertType(report.quietHoursCompliance, 'number');
    cleanup(sys);
  });

  it('generates weekly and monthly reports', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    const weekly = sys.generateWeeklyReport();
    assertType(weekly, 'object');
    assertType(weekly.totalEvents, 'number');
    const monthly = sys.generateMonthlyReport();
    assertType(monthly, 'object');
    assertType(monthly.totalEvents, 'number');
    cleanup(sys);
  });

  it('getPeakEvents returns filtered log', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    sys.registerRoomProfile('r1', { name: 'R' });
    // Process loud noise to generate peak events
    sys.processNoiseSample('r1', 85, 'music');
    sys.processNoiseSample('r1', 95, 'unknown');
    const peaks = sys.getPeakEvents(5);
    assert(peaks.length > 0);
    assert(peaks[0].dbLevel >= peaks[peaks.length - 1].dbLevel);
    cleanup(sys);
  });
});

describe('SmartNoiseManagement — getStatistics', () => {
  it('returns comprehensive statistics object', () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    sys.registerRoomProfile('r1', { name: 'Test Room' });
    const stats = sys.getStatistics();
    assertEqual(stats.initialized, false);
    assertEqual(stats.totalRooms, 1);
    assertType(stats.roomNoiseLevels, 'object');
    assertType(stats.quietZones, 'object');
    assertType(stats.soundMasking, 'object');
    assertType(stats.partyMode, 'object');
    assertEqual(stats.partyMode.active, false);
    assertType(stats.reporting, 'object');
    assertEqual(stats.monitoringCycleMs, 30000);
    cleanup(sys);
  });
});

describe('SmartNoiseManagement — destroy', () => {
  it('clears all data and timers', async () => {
    const sys = new SmartNoiseManagementSystem(makeHomey());
    await sys.initialize();
    sys.registerRoomProfile('r1', { name: 'R' });
    sys.activatePartyMode({});
    sys.destroy();
    assertEqual(sys._initialized, false);
    assertEqual(sys.roomProfiles.size, 0);
    assertEqual(sys.realtimeNoise.size, 0);
    assertEqual(sys.noiseSchedules.length, 0);
    assertEqual(sys.partyMode.neighborTimerHandle, null);
    assertEqual(sys.musicManagement.genreVolumeLimits.size, 0);
    cleanup(sys);
  });
});

run();
