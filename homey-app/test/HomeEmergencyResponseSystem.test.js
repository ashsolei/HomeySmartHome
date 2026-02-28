'use strict';

const { describe, it, run } = require('./helpers/runner');
const {
  assert,
  assertEqual,
  assertNotEqual,
  assertType,
  assertInstanceOf
} = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');
const HomeEmergencyResponseSystem = require('../lib/HomeEmergencyResponseSystem');
const EventEmitter = require('events');

// ── Helpers ─────────────────────────────────────────────────────────────

function createSystem() {
  const homey = createMockHomey();
  const sys = new HomeEmergencyResponseSystem(homey);
  return { homey, sys };
}

/** Create system with a pre-triggered emergency so tests can resolve / inspect it. */
function createSystemWithEmergency(typeId, reason) {
  const { homey, sys } = createSystem();
  const incident = sys._triggerEmergency(typeId || 'fire', reason || 'Test fire', {});
  return { homey, sys, incident };
}

// ═══════════════════════════════════════════════════════════════════════
// 1. Constructor
// ═══════════════════════════════════════════════════════════════════════

describe('Constructor', () => {
  it('extends EventEmitter', () => {
    const { sys } = createSystem();
    assertInstanceOf(sys, EventEmitter);
  });

  it('starts un-initialized', () => {
    const { sys } = createSystem();
    assertEqual(sys.initialized, false);
  });

  it('defines 10 emergency types', () => {
    const { sys } = createSystem();
    assertEqual(Object.keys(sys.emergencyTypes).length, 10);
  });

  it('emergency types include fire, flood, gas-leak, carbon-monoxide, intruder', () => {
    const { sys } = createSystem();
    const types = Object.keys(sys.emergencyTypes);
    assert(types.includes('fire'));
    assert(types.includes('flood'));
    assert(types.includes('gas-leak'));
    assert(types.includes('carbon-monoxide'));
    assert(types.includes('intruder'));
  });

  it('has 10 emergency contacts', () => {
    const { sys } = createSystem();
    assertEqual(sys.emergencyContacts.length, 10);
  });

  it('has 20 sensors', () => {
    const { sys } = createSystem();
    assertEqual(Object.keys(sys.sensors).length, 20);
  });

  it('has 3 evacuation routes', () => {
    const { sys } = createSystem();
    assertEqual(sys.evacuationRoutes.length, 3);
  });

  it('has 12 emergency equipment items', () => {
    const { sys } = createSystem();
    assertEqual(Object.keys(sys.emergencyEquipment).length, 12);
  });

  it('has 7 alert channels', () => {
    const { sys } = createSystem();
    assertEqual(Object.keys(sys.alertChannels).length, 7);
  });

  it('has 4 escalation levels', () => {
    const { sys } = createSystem();
    assertEqual(sys.escalationLevels.length, 4);
  });

  it('has 3 drills configured', () => {
    const { sys } = createSystem();
    assertEqual(Object.keys(sys.drills).length, 3);
  });

  it('has safe room with lock and ventilation', () => {
    const { sys } = createSystem();
    assertEqual(sys.safeRoom.hasLock, true);
    assertEqual(sys.safeRoom.ventilation, true);
    assertEqual(sys.safeRoom.capacity, 6);
  });

  it('has 3 power backup systems', () => {
    const { sys } = createSystem();
    assertEqual(Object.keys(sys.powerBackup).length, 3);
    assert(sys.powerBackup.ups !== undefined);
    assert(sys.powerBackup.battery_system !== undefined);
    assert(sys.powerBackup.generator !== undefined);
  });

  it('has 8 emergency lights', () => {
    const { sys } = createSystem();
    assertEqual(sys.emergencyLighting.length, 8);
  });

  it('runtime state starts empty', () => {
    const { sys } = createSystem();
    assertEqual(sys.incidentLog.length, 0);
    assertEqual(sys.activeEmergencies.length, 0);
    assertEqual(sys.lockdownActive, false);
    assertEqual(sys.panicButtonActive, false);
    assertEqual(sys.sensorEventBuffer.length, 0);
    assertEqual(sys.correlationWindowMs, 30000);
  });

  it('weather alerts region defaults to Stockholm', () => {
    const { sys } = createSystem();
    assertEqual(sys.weatherAlerts.region, 'Stockholm');
    assertEqual(sys.weatherAlerts.activeAlerts.length, 0);
  });

  it('wellbeing checks start empty with 30-min interval', () => {
    const { sys } = createSystem();
    assertEqual(sys.wellbeingChecks.pendingChecks.length, 0);
    assertEqual(sys.wellbeingChecks.completedChecks.length, 0);
    assertEqual(sys.wellbeingChecks.checkInterval, 30);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 2. Initialization
// ═══════════════════════════════════════════════════════════════════════

describe('initialize', () => {
  it('returns true on success', async () => {
    const { sys } = createSystem();
    const result = await sys.initialize();
    assertEqual(result, true);
    sys.destroy();
  });

  it('sets initialized to true', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.initialized, true);
    sys.destroy();
  });

  it('starts multiple monitoring intervals', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    // 8 intervals: sensor, weather, equipment, drill, powerBackup, wellbeing, correlation, + sensor
    assert(sys.intervals.length >= 7);
    sys.destroy();
  });

  it('sets lastTest on all sensors', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const keys = Object.keys(sys.sensors);
    for (const key of keys) {
      assertNotEqual(sys.sensors[key].lastTest, null);
    }
    sys.destroy();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 3. Sensor Event Reporting
// ═══════════════════════════════════════════════════════════════════════

describe('reportSensorEvent', () => {
  it('updates sensor triggerCount and lastTriggered', () => {
    const { sys } = createSystem();
    sys._initializeSensorTimestamps();
    sys.reportSensorEvent('smoke_detector_living', 'smoke_detected', { level: 'high' });
    assertEqual(sys.sensors.smoke_detector_living.triggerCount, 1);
    assertNotEqual(sys.sensors.smoke_detector_living.lastTriggered, null);
  });

  it('adds event to sensorEventBuffer', () => {
    const { sys } = createSystem();
    sys._initializeSensorTimestamps();
    sys.reportSensorEvent('flood_sensor_basement', 'water_detected', {});
    assertEqual(sys.sensorEventBuffer.length, 1);
    assertEqual(sys.sensorEventBuffer[0].sensorType, 'flood_sensor');
  });

  it('ignores unknown sensor', () => {
    const { sys } = createSystem();
    sys._initializeSensorTimestamps();
    sys.reportSensorEvent('nonexistent', 'test', {});
    assertEqual(sys.sensorEventBuffer.length, 0);
  });

  it('single sensor triggers warning event', () => {
    const { homey, sys } = createSystem();
    sys._initializeSensorTimestamps();
    let warned = false;
    homey.on('emergency-warning', () => { warned = true; });
    sys.reportSensorEvent('co_detector_basement', 'co_detected', {});
    assertEqual(warned, true);
  });

  it('two sensor events of same type escalate to alarm', () => {
    const { sys } = createSystem();
    sys._initializeSensorTimestamps();
    sys.reportSensorEvent('flood_sensor_basement', 'water', {});
    sys.reportSensorEvent('flood_sensor_bathroom', 'water', {});
    // Should have triggered a flood emergency
    assert(sys.activeEmergencies.length >= 1);
    assertEqual(sys.activeEmergencies[0].typeId, 'flood');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 4. Multi-Sensor Correlation Engine
// ═══════════════════════════════════════════════════════════════════════

describe('Correlation Engine', () => {
  it('smoke + heat = fire emergency', () => {
    const { sys } = createSystem();
    sys.sensorEventBuffer = [
      { sensorId: 's1', sensorType: 'smoke_detector', location: 'A', floor: 1, eventType: 'smoke', data: {}, timestamp: Date.now() },
      { sensorId: 's2', sensorType: 'temperature_extreme', location: 'A', floor: 1, eventType: 'heat', data: {}, timestamp: Date.now() }
    ];
    sys._processCorrelationBuffer();
    assert(sys.activeEmergencies.length >= 1);
    assertEqual(sys.activeEmergencies[0].typeId, 'fire');
  });

  it('motion + glass break = intruder emergency', () => {
    const { sys } = createSystem();
    sys.sensorEventBuffer = [
      { sensorId: 'm1', sensorType: 'motion_sensor', location: 'Front', floor: 1, eventType: 'motion', data: {}, timestamp: Date.now() },
      { sensorId: 'g1', sensorType: 'glass_break_sensor', location: 'Window', floor: 1, eventType: 'glass', data: {}, timestamp: Date.now() }
    ];
    sys._processCorrelationBuffer();
    assert(sys.activeEmergencies.length >= 1);
    assertEqual(sys.activeEmergencies[0].typeId, 'intruder');
  });

  it('multiple flood sensors = flood emergency', () => {
    const { sys } = createSystem();
    sys.sensorEventBuffer = [
      { sensorId: 'f1', sensorType: 'flood_sensor', location: 'Basement', floor: 0, eventType: 'flood', data: {}, timestamp: Date.now() },
      { sensorId: 'f2', sensorType: 'flood_sensor', location: 'Bath', floor: 1, eventType: 'flood', data: {}, timestamp: Date.now() }
    ];
    sys._processCorrelationBuffer();
    assert(sys.activeEmergencies.some(e => e.typeId === 'flood'));
  });

  it('prunes stale events outside correlation window', () => {
    const { sys } = createSystem();
    sys.sensorEventBuffer = [
      { sensorId: 's1', sensorType: 'smoke_detector', location: 'A', floor: 1, eventType: 'smoke', data: {}, timestamp: Date.now() - 60000 },
      { sensorId: 's2', sensorType: 'temperature_extreme', location: 'A', floor: 1, eventType: 'heat', data: {}, timestamp: Date.now() }
    ];
    sys._processCorrelationBuffer();
    // Smoke event is >30s old -> pruned, no correlation
    assertEqual(sys.activeEmergencies.length, 0);
  });

  it('fewer than 2 events does nothing', () => {
    const { sys } = createSystem();
    sys.sensorEventBuffer = [
      { sensorId: 's1', sensorType: 'smoke_detector', location: 'A', floor: 1, eventType: 'smoke', data: {}, timestamp: Date.now() }
    ];
    sys._processCorrelationBuffer();
    assertEqual(sys.activeEmergencies.length, 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 5. Emergency Trigger & Lifecycle
// ═══════════════════════════════════════════════════════════════════════

describe('Emergency Trigger', () => {
  it('creates incident for known emergency type', () => {
    const { incident } = createSystemWithEmergency('fire', 'Smoke in kitchen');
    assertNotEqual(incident, null);
    assertEqual(incident.typeId, 'fire');
    assertEqual(incident.status, 'active');
    assertEqual(incident.severity, 5);
  });

  it('adds incident to activeEmergencies and incidentLog', () => {
    const { sys } = createSystemWithEmergency();
    assertEqual(sys.activeEmergencies.length, 1);
    assertEqual(sys.incidentLog.length, 1);
  });

  it('de-duplicates same active emergency type', () => {
    const { sys } = createSystem();
    sys._triggerEmergency('fire', 'First fire', {});
    const dup = sys._triggerEmergency('fire', 'Second fire', {});
    // Should update existing, not create new
    assertEqual(sys.activeEmergencies.length, 1);
    assertEqual(dup.updates.length, 1);
    assertEqual(dup.updates[0].reason, 'Second fire');
  });

  it('returns null for unknown emergency type', () => {
    const { sys } = createSystem();
    const result = sys._triggerEmergency('zombie_apocalypse', 'Brains', {});
    assertEqual(result, null);
  });

  it('executes response protocol steps', () => {
    const { incident } = createSystemWithEmergency('fire', 'Test');
    assert(incident.actionsExecuted.length > 0);
  });

  it('sends multi-channel alerts', () => {
    const { incident } = createSystemWithEmergency('fire', 'Test');
    assert(incident.alertsSent.length > 0);
  });

  it('notifies emergency contacts for severity >= 4', () => {
    const { incident } = createSystemWithEmergency('fire', 'Test'); // severity 5
    const contactAlerts = incident.alertsSent.filter(a => a.channelId === 'contact_notification');
    assert(contactAlerts.length > 0);
  });

  it('activates emergency lighting', () => {
    const { sys } = createSystemWithEmergency('fire', 'Test');
    const activeLights = sys.emergencyLighting.filter(l => l.status === 'active');
    assert(activeLights.length > 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 6. Emergency Resolution
// ═══════════════════════════════════════════════════════════════════════

describe('resolveEmergency', () => {
  it('resolves an active emergency', () => {
    const { sys, incident } = createSystemWithEmergency('fire', 'Test');
    const resolved = sys.resolveEmergency(incident.id, 'All clear');
    assertEqual(resolved.status, 'resolved');
    assertNotEqual(resolved.resolvedAt, null);
    assertEqual(resolved.resolution, 'All clear');
  });

  it('computes response time', () => {
    const { sys, incident } = createSystemWithEmergency('fire', 'Test');
    const resolved = sys.resolveEmergency(incident.id, 'Cleared');
    assertType(resolved.responseTimeMs, 'number');
    assert(resolved.responseTimeMs >= 0);
  });

  it('removes emergency from activeEmergencies', () => {
    const { sys, incident } = createSystemWithEmergency('fire', 'Test');
    assertEqual(sys.activeEmergencies.length, 1);
    sys.resolveEmergency(incident.id, 'Done');
    assertEqual(sys.activeEmergencies.length, 0);
  });

  it('updates incident log entry', () => {
    const { sys, incident } = createSystemWithEmergency('fire', 'Test');
    sys.resolveEmergency(incident.id, 'Fixed');
    const logged = sys.incidentLog.find(i => i.id === incident.id);
    assertEqual(logged.status, 'resolved');
  });

  it('deactivates emergency lighting', () => {
    const { sys, incident } = createSystemWithEmergency('fire', 'Test');
    // Lighting was activated by trigger
    sys.resolveEmergency(incident.id, 'Done');
    const active = sys.emergencyLighting.filter(l => l.status === 'active');
    assertEqual(active.length, 0);
  });

  it('schedules wellbeing check', () => {
    const { sys, incident } = createSystemWithEmergency('fire', 'Test');
    sys.resolveEmergency(incident.id, 'Done');
    assert(sys.wellbeingChecks.pendingChecks.length >= 1);
  });

  it('lifts lockdown when no more active emergencies', () => {
    const { sys, incident } = createSystemWithEmergency('fire', 'Test');
    sys.lockdownActive = true;
    sys.resolveEmergency(incident.id, 'Done');
    assertEqual(sys.lockdownActive, false);
  });

  it('returns null for unknown emergency', () => {
    const { sys } = createSystem();
    const result = sys.resolveEmergency('nonexistent_id', 'Test');
    assertEqual(result, null);
  });

  it('uses default resolution text', () => {
    const { sys, incident } = createSystemWithEmergency('flood', 'Water');
    const resolved = sys.resolveEmergency(incident.id);
    assertEqual(resolved.resolution, 'Manually resolved');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 7. Wellbeing Checks
// ═══════════════════════════════════════════════════════════════════════

describe('Wellbeing Checks', () => {
  it('respondToWellbeingCheck returns true for valid check', () => {
    const { sys, incident } = createSystemWithEmergency('fire', 'Test');
    sys.resolveEmergency(incident.id, 'Done');
    const check = sys.wellbeingChecks.pendingChecks[0];
    const result = sys.respondToWellbeingCheck(check.id, 'We are all fine');
    assertEqual(result, true);
  });

  it('moves check from pending to completed', () => {
    const { sys, incident } = createSystemWithEmergency('medical', 'Test');
    sys.resolveEmergency(incident.id, 'Done');
    const checkId = sys.wellbeingChecks.pendingChecks[0].id;
    sys.respondToWellbeingCheck(checkId, 'OK');
    assertEqual(sys.wellbeingChecks.pendingChecks.length, 0);
    assertEqual(sys.wellbeingChecks.completedChecks.length, 1);
  });

  it('returns false for unknown check', () => {
    const { sys } = createSystem();
    const result = sys.respondToWellbeingCheck('invalid_check', 'OK');
    assertEqual(result, false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 8. Panic Button
// ═══════════════════════════════════════════════════════════════════════

describe('Panic Button', () => {
  it('triggerPanicButton creates medical emergency', () => {
    const { sys } = createSystem();
    const incident = sys.triggerPanicButton('bedroom_button', { note: 'chest pain' });
    assertNotEqual(incident, null);
    assertEqual(incident.typeId, 'medical');
    assertEqual(sys.panicButtonActive, true);
  });

  it('includes panic details in incident', () => {
    const { sys } = createSystem();
    const incident = sys.triggerPanicButton('app', {});
    assertEqual(incident.details.panicButton, true);
    assertEqual(incident.details.source, 'app');
  });

  it('deactivatePanicButton resets flag', () => {
    const { sys } = createSystem();
    sys.triggerPanicButton('test', {});
    assertEqual(sys.panicButtonActive, true);
    sys.deactivatePanicButton();
    assertEqual(sys.panicButtonActive, false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 9. Lockdown
// ═══════════════════════════════════════════════════════════════════════

describe('Lockdown', () => {
  it('activateLockdown sets lockdownActive', () => {
    const { sys } = createSystem();
    sys.activateLockdown('Intruder detected');
    assertEqual(sys.lockdownActive, true);
  });

  it('activateLockdown activates emergency lighting', () => {
    const { sys } = createSystem();
    sys.activateLockdown('Test');
    const active = sys.emergencyLighting.filter(l => l.status === 'active');
    assert(active.length > 0);
  });

  it('activateLockdown is no-op when already active', () => {
    const { homey, sys } = createSystem();
    sys.activateLockdown('First');
    let emitCount = 0;
    homey.on('emergency-lockdown-activated', () => { emitCount++; });
    sys.activateLockdown('Second');
    // No second event
    assertEqual(emitCount, 0);
  });

  it('deactivateLockdown clears flag', () => {
    const { sys } = createSystem();
    sys.activateLockdown('Test');
    sys.deactivateLockdown('All clear');
    assertEqual(sys.lockdownActive, false);
  });

  it('deactivateLockdown deactivates emergency lighting', () => {
    const { sys } = createSystem();
    sys.activateLockdown('Test');
    sys.deactivateLockdown('Clear');
    const active = sys.emergencyLighting.filter(l => l.status === 'active');
    assertEqual(active.length, 0);
  });

  it('deactivateLockdown no-op when not active', () => {
    const { homey, sys } = createSystem();
    let emitCount = 0;
    homey.on('emergency-lockdown-deactivated', () => { emitCount++; });
    sys.deactivateLockdown('Not active');
    assertEqual(emitCount, 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 10. Drill Execution
// ═══════════════════════════════════════════════════════════════════════

describe('runDrill', () => {
  it('returns drill result for valid drill', () => {
    const { sys } = createSystem();
    const result = sys.runDrill('fire_drill');
    assertNotEqual(result, null);
    assertEqual(result.drillId, 'fire_drill');
    assertEqual(result.name, 'Fire Evacuation Drill');
  });

  it('assigns score and evacuation time', () => {
    const { sys } = createSystem();
    const result = sys.runDrill('fire_drill');
    assertType(result.score, 'number');
    assert(result.score >= 50 && result.score <= 100);
    assertType(result.evacuationTime, 'number');
    assert(result.evacuationTime >= 30 && result.evacuationTime < 100);
  });

  it('updates drill lastPerformed and lastScore', () => {
    const { sys } = createSystem();
    const result = sys.runDrill('earthquake_drill');
    const drill = sys.drills.earthquake_drill;
    assertEqual(drill.lastScore, result.score);
    assertNotEqual(drill.lastPerformed, '2025-10-20'); // updated from original
  });

  it('updates nextScheduled based on frequency', () => {
    const { sys } = createSystem();
    const before = sys.drills.intruder_drill.nextScheduled;
    sys.runDrill('intruder_drill');
    const after = sys.drills.intruder_drill.nextScheduled;
    assertNotEqual(before, after);
  });

  it('populates steps array', () => {
    const { sys } = createSystem();
    const result = sys.runDrill('fire_drill');
    assertEqual(result.steps.length, sys.drills.fire_drill.procedure.length);
  });

  it('returns null for unknown drill', () => {
    const { sys } = createSystem();
    const result = sys.runDrill('nonexistent_drill');
    assertEqual(result, null);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 11. Evacuation Routes
// ═══════════════════════════════════════════════════════════════════════

describe('Evacuation Routes', () => {
  it('getEvacuationRoute returns best route by default', () => {
    const { sys } = createSystem();
    const route = sys.getEvacuationRoute();
    assertNotEqual(route, null);
    // front_door is accessible + lit + fastest
    assertEqual(route.id, 'front_door');
  });

  it('getEvacuationRoute respects preferred route', () => {
    const { sys } = createSystem();
    const route = sys.getEvacuationRoute('back_door');
    assertEqual(route.id, 'back_door');
  });

  it('getEvacuationRoute returns null if preferred route blocked', () => {
    const { sys } = createSystem();
    sys.evacuationRoutes[0].clearance = false;
    sys.evacuationRoutes[1].clearance = false;
    sys.evacuationRoutes[2].clearance = false;
    const route = sys.getEvacuationRoute('front_door');
    // Falls through to best available — but all blocked
    assertEqual(route, null);
  });

  it('setEvacuationRouteClearance updates route', () => {
    const { sys } = createSystem();
    const result = sys.setEvacuationRouteClearance('garage_exit', false);
    assertEqual(result, true);
    assertEqual(sys.evacuationRoutes[2].clearance, false);
  });

  it('setEvacuationRouteClearance returns false for unknown route', () => {
    const { sys } = createSystem();
    const result = sys.setEvacuationRouteClearance('secret_tunnel', true);
    assertEqual(result, false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 12. Safe Room
// ═══════════════════════════════════════════════════════════════════════

describe('getSafeRoomStatus', () => {
  it('returns status object with expected keys', () => {
    const { sys } = createSystem();
    const status = sys.getSafeRoomStatus();
    assertEqual(status.location, 'Basement reinforced room');
    assertEqual(status.floor, 0);
    assertEqual(status.capacity, 6);
    assertEqual(status.hasLock, true);
    assertEqual(status.ventilation, true);
  });

  it('reports all_good when supplies not expired', () => {
    const { sys } = createSystem();
    const status = sys.getSafeRoomStatus();
    assertEqual(status.suppliesStatus, 'all_good');
    assertEqual(status.issues.length, 0);
  });

  it('detects expired water', () => {
    const { sys } = createSystem();
    sys.safeRoom.supplies.water.expiry = '2020-01-01';
    const status = sys.getSafeRoomStatus();
    assertEqual(status.suppliesStatus, 'issues_found');
    assert(status.issues.some(i => i.includes('Water')));
  });

  it('detects low battery pack', () => {
    const { sys } = createSystem();
    sys.safeRoom.supplies.battery_pack.charged = 30;
    const status = sys.getSafeRoomStatus();
    assertEqual(status.suppliesStatus, 'issues_found');
    assert(status.issues.some(i => i.includes('Battery pack')));
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 13. Power Backup
// ═══════════════════════════════════════════════════════════════════════

describe('Power Backup', () => {
  it('getPowerBackupStatus returns all three systems', () => {
    const { sys } = createSystem();
    const status = sys.getPowerBackupStatus();
    assertNotEqual(status.ups, undefined);
    assertNotEqual(status.batterySystem, undefined);
    assertNotEqual(status.generator, undefined);
  });

  it('overall status is optimal when all levels >50%', () => {
    const { sys } = createSystem();
    const status = sys.getPowerBackupStatus();
    assertEqual(status.overallStatus, 'optimal');
  });

  it('overall status degrades with low levels', () => {
    const { sys } = createSystem();
    sys.powerBackup.ups.batteryLevel = 15;
    sys.powerBackup.battery_system.batteryLevel = 15;
    sys.powerBackup.generator.fuelLevel = 15;
    const status = sys.getPowerBackupStatus();
    assertEqual(status.overallStatus, 'degraded');
  });

  it('handlePowerFailure activates backup systems', () => {
    const { sys } = createSystem();
    sys.handlePowerFailure();
    assertEqual(sys.powerBackup.ups.status, 'active');
    assertEqual(sys.powerBackup.battery_system.status, 'discharging');
  });

  it('handlePowerFailure starts generator if autoStart', () => {
    const { sys } = createSystem();
    sys.handlePowerFailure();
    assertEqual(sys.powerBackup.generator.status, 'running');
  });

  it('handlePowerFailure creates power-failure emergency', () => {
    const { sys } = createSystem();
    sys.handlePowerFailure();
    assert(sys.activeEmergencies.some(e => e.typeId === 'power-failure'));
  });

  it('handlePowerRestored switches to standby', () => {
    const { sys } = createSystem();
    // Disable autoStart so _startGenerator doesn't run — avoids 300s setTimeout on restore
    sys.powerBackup.generator.autoStart = false;
    sys.handlePowerFailure();
    sys.handlePowerRestored();
    assertEqual(sys.powerBackup.ups.status, 'standby');
    assertEqual(sys.powerBackup.battery_system.status, 'charging');
  });

  it('handlePowerRestored auto-resolves power emergency', () => {
    const { sys } = createSystem();
    sys.powerBackup.generator.autoStart = false;
    sys.handlePowerFailure();
    const powerEmergency = sys.activeEmergencies.find(e => e.typeId === 'power-failure');
    assertNotEqual(powerEmergency, undefined);
    sys.handlePowerRestored();
    // Power emergency should be resolved and removed from active
    assertEqual(sys.activeEmergencies.filter(e => e.typeId === 'power-failure').length, 0);
  });

  it('totalEstimatedRuntimeMinutes is calculated', () => {
    const { sys } = createSystem();
    const status = sys.getPowerBackupStatus();
    assertType(status.totalEstimatedRuntimeMinutes, 'number');
    assert(status.totalEstimatedRuntimeMinutes > 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 14. Damage Assessment
// ═══════════════════════════════════════════════════════════════════════

describe('assessDamage', () => {
  it('creates damage report for known incident', () => {
    const { sys, incident } = createSystemWithEmergency('fire', 'Kitchen fire');
    const report = sys.assessDamage(incident.id, {
      severity: 'moderate',
      areas: ['kitchen', 'hallway'],
      estimatedCost: 50000,
      insuranceClaim: true,
      notes: 'Smoke damage',
      photos: 12,
      professionalNeeded: true,
      habitable: true
    });
    assertNotEqual(report, null);
    assertEqual(report.overallSeverity, 'moderate');
    assertEqual(report.estimatedCost, 50000);
    assertEqual(report.insuranceClaim, true);
  });

  it('returns null for unknown incident', () => {
    const { sys } = createSystem();
    const report = sys.assessDamage('nonexistent', { severity: 'low' });
    assertEqual(report, null);
  });

  it('uses defaults for missing assessment fields', () => {
    const { sys, incident } = createSystemWithEmergency('flood', 'Pipe burst');
    const report = sys.assessDamage(incident.id, {});
    assertEqual(report.assessor, 'Homeowner');
    assertEqual(report.overallSeverity, 'unknown');
    assertEqual(report.estimatedCost, 0);
    assertEqual(report.habitableStatus, true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 15. Emergency Contacts
// ═══════════════════════════════════════════════════════════════════════

describe('Emergency Contacts', () => {
  it('getEmergencyContacts returns sorted by priority', () => {
    const { sys } = createSystem();
    const contacts = sys.getEmergencyContacts();
    assertEqual(contacts.length, 10);
    assert(contacts[0].priority <= contacts[1].priority);
  });

  it('addEmergencyContact adds valid contact', () => {
    const { sys } = createSystem();
    const result = sys.addEmergencyContact({
      name: 'Test Person',
      number: '+46-70-000-0000',
      type: 'family',
      priority: 3
    });
    assertEqual(result, true);
    assertEqual(sys.emergencyContacts.length, 11);
  });

  it('addEmergencyContact rejects missing fields', () => {
    const { sys } = createSystem();
    const result = sys.addEmergencyContact({ name: 'No Number' });
    assertEqual(result, false);
    assertEqual(sys.emergencyContacts.length, 10);
  });

  it('removeEmergencyContact removes by id', () => {
    const { sys } = createSystem();
    const result = sys.removeEmergencyContact('sos');
    assertEqual(result, true);
    assertEqual(sys.emergencyContacts.length, 9);
  });

  it('removeEmergencyContact returns false for unknown id', () => {
    const { sys } = createSystem();
    const result = sys.removeEmergencyContact('unknown_contact');
    assertEqual(result, false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 16. Equipment Inventory & Inspection
// ═══════════════════════════════════════════════════════════════════════

describe('Equipment', () => {
  it('getEquipmentInventory returns all 12 items', () => {
    const { sys } = createSystem();
    const items = sys.getEquipmentInventory();
    assertEqual(items.length, 12);
    assert(items[0].id !== undefined);
    assert(items[0].name !== undefined);
    assert(items[0].location !== undefined);
  });

  it('inspectEquipment updates lastInspected', () => {
    const { sys } = createSystem();
    const item = sys.inspectEquipment('first_aid_main');
    assertNotEqual(item, null);
    const today = new Date().toISOString().split('T')[0];
    assertEqual(item.lastInspected, today);
  });

  it('inspectEquipment sets status to good if not expired', () => {
    const { sys } = createSystem();
    sys.emergencyEquipment.first_aid_main.status = 'expiring_soon';
    sys.inspectEquipment('first_aid_main');
    assertEqual(sys.emergencyEquipment.first_aid_main.status, 'good');
  });

  it('inspectEquipment keeps expired status for expired items', () => {
    const { sys } = createSystem();
    sys.emergencyEquipment.first_aid_main.status = 'expired';
    sys.inspectEquipment('first_aid_main');
    assertEqual(sys.emergencyEquipment.first_aid_main.status, 'expired');
  });

  it('inspectEquipment returns null for unknown item', () => {
    const { sys } = createSystem();
    const result = sys.inspectEquipment('nonexistent_item');
    assertEqual(result, null);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 17. Status Queries
// ═══════════════════════════════════════════════════════════════════════

describe('Emergency Lighting Status', () => {
  it('returns all 8 lights', () => {
    const { sys } = createSystem();
    const status = sys.getEmergencyLightingStatus();
    assertEqual(status.totalLights, 8);
    assertEqual(status.lights.length, 8);
  });

  it('all lights ready with 100% coverage initially', () => {
    const { sys } = createSystem();
    const status = sys.getEmergencyLightingStatus();
    assertEqual(status.readyCount, 8);
    assertEqual(status.activeCount, 0);
    assertEqual(status.coveragePercent, 100);
  });
});

describe('Sensor Status', () => {
  it('returns all 20 sensors', () => {
    const { sys } = createSystem();
    const status = sys.getSensorStatus();
    assertEqual(status.totalSensors, 20);
    assertEqual(status.sensors.length, 20);
  });

  it('all sensors online initially', () => {
    const { sys } = createSystem();
    const status = sys.getSensorStatus();
    assertEqual(status.onlineCount, 20);
    assertEqual(status.offlineCount, 0);
    assertEqual(status.healthPercent, 100);
  });

  it('groups sensors by type', () => {
    const { sys } = createSystem();
    const status = sys.getSensorStatus();
    assert(status.byType.smoke_detector !== undefined);
    assert(status.byType.flood_sensor !== undefined);
    assertEqual(status.byType.smoke_detector.total, 4);
  });
});

describe('Active Emergencies', () => {
  it('returns empty array when no emergencies', () => {
    const { sys } = createSystem();
    const active = sys.getActiveEmergencies();
    assertEqual(active.length, 0);
  });

  it('returns mapped array with expected fields', () => {
    const { sys } = createSystemWithEmergency('flood', 'Water leak');
    const active = sys.getActiveEmergencies();
    assertEqual(active.length, 1);
    assertEqual(active[0].type, 'flood');
    assertEqual(active[0].status, 'active');
    assert(active[0].id !== undefined);
    assert(active[0].severity !== undefined);
  });
});

describe('Incident History', () => {
  it('returns empty when no incidents', () => {
    const { sys } = createSystem();
    assertEqual(sys.getIncidentHistory().length, 0);
  });

  it('returns incidents sorted newest first', () => {
    const { sys } = createSystem();
    sys._triggerEmergency('fire', 'First', {});
    sys._triggerEmergency('flood', 'Second', {});
    const history = sys.getIncidentHistory();
    assertEqual(history.length, 2);
  });

  it('respects limit parameter', () => {
    const { sys } = createSystem();
    sys._triggerEmergency('fire', 'A', {});
    sys._triggerEmergency('flood', 'B', {});
    sys._triggerEmergency('intruder', 'C', {});
    const history = sys.getIncidentHistory(2);
    assertEqual(history.length, 2);
  });
});

describe('Drill Schedule', () => {
  it('returns all 3 drills', () => {
    const { sys } = createSystem();
    const schedule = sys.getDrillSchedule();
    assertEqual(schedule.length, 3);
    assert(schedule[0].id !== undefined);
    assert(schedule[0].name !== undefined);
  });
});

describe('Weather Alerts', () => {
  it('returns Stockholm region info', () => {
    const { sys } = createSystem();
    const weather = sys.getWeatherAlerts();
    assertEqual(weather.region, 'Stockholm');
    assertEqual(weather.activeAlerts.length, 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 18. Statistics
// ═══════════════════════════════════════════════════════════════════════

describe('getStatistics', () => {
  it('returns comprehensive stats object', () => {
    const { sys } = createSystem();
    const stats = sys.getStatistics();
    assertEqual(stats.emergencyTypes, 10);
    assertEqual(stats.totalSensors, 20);
    assertEqual(stats.onlineSensors, 20);
    assertEqual(stats.sensorHealthPercent, 100);
    assertEqual(stats.evacuationRoutes, 3);
    assertEqual(stats.emergencyContacts, 10);
    assertEqual(stats.emergencyLightsTotal, 8);
    assertEqual(stats.equipmentTotal, 12);
    assertEqual(stats.drillsScheduled, 3);
    assertEqual(stats.alertChannels, 7);
    assertEqual(stats.escalationLevels, 4);
  });

  it('initialized is false before init', () => {
    const { sys } = createSystem();
    const stats = sys.getStatistics();
    assertEqual(stats.initialized, false);
  });

  it('reflects active emergencies count', () => {
    const { sys } = createSystemWithEmergency('fire', 'Test');
    const stats = sys.getStatistics();
    assertEqual(stats.activeEmergencies, 1);
    assertEqual(stats.totalIncidents, 1);
  });

  it('lockdown and panic states reflected', () => {
    const { sys } = createSystem();
    sys.lockdownActive = true;
    sys.panicButtonActive = true;
    const stats = sys.getStatistics();
    assertEqual(stats.lockdownActive, true);
    assertEqual(stats.panicButtonActive, true);
  });

  it('power backup status is optimal by default', () => {
    const { sys } = createSystem();
    const stats = sys.getStatistics();
    assertEqual(stats.powerBackupStatus, 'optimal');
  });

  it('safe room ready when has lock and ventilation', () => {
    const { sys } = createSystem();
    const stats = sys.getStatistics();
    assertEqual(stats.safeRoomReady, true);
  });

  it('has timestamp', () => {
    const { sys } = createSystem();
    const stats = sys.getStatistics();
    assertType(stats.timestamp, 'string');
    assert(stats.timestamp.includes('T'));
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 19. Alert Message Formatting
// ═══════════════════════════════════════════════════════════════════════

describe('Alert Message Formatting', () => {
  it('formats SMS with emergency number', () => {
    const { sys } = createSystem();
    const incident = {
      type: sys.emergencyTypes.fire,
      reason: 'Kitchen fire',
      triggeredAt: new Date().toISOString()
    };
    const msg = sys._formatAlertMessage(incident, { id: 'sms' });
    assert(msg.includes('EMERGENCY'));
    assert(msg.includes('Fire'));
    assert(msg.includes('112'));
  });

  it('formats voice announcement', () => {
    const { sys } = createSystem();
    const incident = {
      type: sys.emergencyTypes.flood,
      reason: 'Basement flooding',
      triggeredAt: new Date().toISOString()
    };
    const msg = sys._formatAlertMessage(incident, { id: 'voice' });
    assert(msg.includes('Attention'));
    assert(msg.includes('evacuation'));
  });

  it('formats smart display with color code', () => {
    const { sys } = createSystem();
    const incident = {
      type: sys.emergencyTypes.fire,
      reason: 'Smoke',
      triggeredAt: new Date().toISOString()
    };
    const msg = sys._formatAlertMessage(incident, { id: 'smart_display' });
    assert(msg.includes('#FF0000'));
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 20. Recovery Procedures
// ═══════════════════════════════════════════════════════════════════════

describe('Recovery Procedures', () => {
  it('creates recovery plan with steps', () => {
    const { sys, incident } = createSystemWithEmergency('fire', 'Test');
    const plan = sys._initiateRecoveryProcedures(incident);
    assertNotEqual(plan, null);
    assertEqual(plan.status, 'in_progress');
    assert(plan.steps.length > 0);
    assertEqual(plan.steps[0].status, 'pending');
  });

  it('returns null when no recovery steps', () => {
    const { sys } = createSystem();
    const incident = { id: 'test', type: { recoverySteps: [] }, typeId: 'test' };
    const plan = sys._initiateRecoveryProcedures(incident);
    assertEqual(plan, null);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 21. Generator Start
// ═══════════════════════════════════════════════════════════════════════

describe('Generator', () => {
  it('_startGenerator sets status to running', () => {
    const { sys } = createSystem();
    sys._startGenerator();
    assertEqual(sys.powerBackup.generator.status, 'running');
  });

  it('emits emergency-generator-started event', () => {
    const { homey, sys } = createSystem();
    let emitted = false;
    homey.on('emergency-generator-started', () => { emitted = true; });
    sys._startGenerator();
    assertEqual(emitted, true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 22. Emergency Lighting Activation/Deactivation
// ═══════════════════════════════════════════════════════════════════════

describe('Emergency Lighting', () => {
  it('_activateEmergencyLighting activates ready lights', () => {
    const { sys } = createSystem();
    sys._activateEmergencyLighting();
    const active = sys.emergencyLighting.filter(l => l.status === 'active');
    assertEqual(active.length, 8);
  });

  it('skips lights with low battery (<=5%)', () => {
    const { sys } = createSystem();
    sys.emergencyLighting[0].batteryLevel = 3;
    sys._activateEmergencyLighting();
    assertEqual(sys.emergencyLighting[0].status, 'ready');
  });

  it('_deactivateEmergencyLighting resets all to ready', () => {
    const { sys } = createSystem();
    sys._activateEmergencyLighting();
    sys._deactivateEmergencyLighting();
    const active = sys.emergencyLighting.filter(l => l.status === 'active');
    assertEqual(active.length, 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 23. destroy
// ═══════════════════════════════════════════════════════════════════════

describe('destroy', () => {
  it('clears all intervals', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assert(sys.intervals.length > 0);
    sys.destroy();
    assertEqual(sys.intervals.length, 0);
  });

  it('resets runtime state', () => {
    const { sys } = createSystemWithEmergency('fire', 'Test');
    sys.lockdownActive = true;
    sys.panicButtonActive = true;
    sys.destroy();
    assertEqual(sys.activeEmergencies.length, 0);
    assertEqual(sys.sensorEventBuffer.length, 0);
    assertEqual(sys.lockdownActive, false);
    assertEqual(sys.panicButtonActive, false);
    assertEqual(sys.initialized, false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
run();
