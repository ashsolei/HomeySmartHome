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
  try { if (sys && sys.monitoringTimer) { clearInterval(sys.monitoringTimer); sys.monitoringTimer = null; } } catch (_) {}
  while (activeHandles.length > 0) {
    const h = activeHandles.pop();
    if (h.type === 'timeout') clearTimeout(h.id); else clearInterval(h.id);
  }
}

const PoolSpaManagementSystem = require('../lib/PoolSpaManagementSystem');

/* ================================================================== */
/*  PoolSpaManagementSystem – test suite                               */
/* ================================================================== */

describe('PoolSpaManagementSystem — constructor & init', () => {
  it('instantiates without errors', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    assert(sys, 'should create instance');
    cleanup(sys);
  });

  it('starts uninitialized with empty maps', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    assertEqual(sys.initialized, false);
    assertEqual(sys.waterBodies.size, 0);
    assertEqual(sys.pumpState.running, false);
    cleanup(sys);
  });

  it('initialize sets up default water bodies and pump schedule', async () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.initialized, true);
    assertEqual(sys.waterBodies.size, 2);
    assert(sys.waterBodies.has('main_pool'), 'should have main_pool');
    assert(sys.waterBodies.has('hot_tub'), 'should have hot_tub');
    assert(sys.pumpState.scheduledSpeeds.length > 0, 'should have pump schedule');
    cleanup(sys);
  });
});

describe('PoolSpaManagementSystem — water body management', () => {
  it('addWaterBody adds a new body', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    const wb = sys.addWaterBody('children_pool');
    assert(wb, 'should return water body');
    assertEqual(sys.waterBodies.size, 1);
    assertEqual(wb.label, "Children's Pool");
    cleanup(sys);
  });

  it('addWaterBody returns null for unknown type', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    const wb = sys.addWaterBody('unknown_type');
    assertEqual(wb, null);
    cleanup(sys);
  });

  it('addWaterBody enforces max limit', async () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    sys.addWaterBody('main_pool');
    sys.addWaterBody('hot_tub');
    sys.addWaterBody('children_pool');
    sys.addWaterBody('infinity_edge');
    const extra = sys.addWaterBody('main_pool'); // should fail - already exists + at max
    assertEqual(extra, null);
    cleanup(sys);
  });

  it('addWaterBody rejects duplicates', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    sys.addWaterBody('main_pool');
    const dup = sys.addWaterBody('main_pool');
    assertEqual(dup, null);
    assertEqual(sys.waterBodies.size, 1);
    cleanup(sys);
  });

  it('removeWaterBody removes existing body', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    sys.addWaterBody('main_pool');
    const removed = sys.removeWaterBody('main_pool');
    assertEqual(removed, true);
    assertEqual(sys.waterBodies.size, 0);
    cleanup(sys);
  });

  it('removeWaterBody returns false for missing body', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    assertEqual(sys.removeWaterBody('nonexistent'), false);
    cleanup(sys);
  });
});

describe('PoolSpaManagementSystem — pump management', () => {
  it('setPumpSpeed changes speed', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    const result = sys.setPumpSpeed('high');
    assertEqual(result, true);
    assertEqual(sys.pumpState.currentSpeed, 'high');
    cleanup(sys);
  });

  it('setPumpSpeed rejects invalid speed', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    assertEqual(sys.setPumpSpeed('turbo'), false);
    cleanup(sys);
  });

  it('startPump starts pump and sets running state', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    sys.startPump('eco');
    assertEqual(sys.pumpState.running, true);
    assertEqual(sys.pumpState.currentSpeed, 'eco');
    assert(sys.pumpState.lastStartTime > 0, 'should record start time');
    cleanup(sys);
  });

  it('stopPump stops running pump and tracks energy', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    sys.startPump('normal');
    sys.stopPump();
    assertEqual(sys.pumpState.running, false);
    assertEqual(sys.pumpState.lastStartTime, null);
    cleanup(sys);
  });

  it('stopPump does nothing if pump not running', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    sys.stopPump(); // no error expected
    assertEqual(sys.pumpState.running, false);
    cleanup(sys);
  });
});

describe('PoolSpaManagementSystem — chemistry', () => {
  it('updateChemistry updates readings and records history', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    sys.addWaterBody('main_pool');
    sys.updateChemistry('main_pool', { ph: 7.5, freeChlorine: 3.0 });
    const wb = sys.waterBodies.get('main_pool');
    assertEqual(wb.chemistry.ph, 7.5);
    assertEqual(wb.chemistry.freeChlorine, 3.0);
    assert(wb.lastChemistryTest > 0, 'should record test time');
    assert(sys.chemistryHistory.length > 0, 'should have history entry');
    cleanup(sys);
  });

  it('updateChemistry generates alerts for out-of-range values', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    sys.addWaterBody('main_pool');
    sys.updateChemistry('main_pool', { ph: 6.5 }); // below min of 6.8
    const wb = sys.waterBodies.get('main_pool');
    assert(wb.alerts.length > 0, 'should have alert');
    assertEqual(wb.alerts[0].level, 'critical');
    cleanup(sys);
  });

  it('updateChemistry ignores unknown water body', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    sys.updateChemistry('nonexistent', { ph: 7.0 }); // should not throw
    cleanup(sys);
  });
});

describe('PoolSpaManagementSystem — auto-dosing', () => {
  it('enableAutoDosing enables dosing for chemical', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    const result = sys.enableAutoDosing('chlorine', 'pump-1');
    assertEqual(result, true);
    assertEqual(sys.dosingConfig.chlorine.enabled, true);
    assertEqual(sys.dosingConfig.chlorine.pumpId, 'pump-1');
    cleanup(sys);
  });

  it('enableAutoDosing rejects unknown chemical', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    assertEqual(sys.enableAutoDosing('bleach'), false);
    cleanup(sys);
  });

  it('disableAutoDosing disables dosing', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    sys.enableAutoDosing('chlorine');
    sys.disableAutoDosing('chlorine');
    assertEqual(sys.dosingConfig.chlorine.enabled, false);
    cleanup(sys);
  });

  it('_canDose returns true when enough time has passed', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    sys.enableAutoDosing('chlorine');
    assertEqual(sys._canDose('chlorine'), true);
    cleanup(sys);
  });

  it('_canDose returns false when disabled', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    assertEqual(sys._canDose('chlorine'), false);
    cleanup(sys);
  });
});

describe('PoolSpaManagementSystem — solar heating', () => {
  it('updateSolarReadings stores panel and roof temps', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    sys.updateSolarReadings(45, 40);
    assertEqual(sys.solarHeating.panelTemperature, 45);
    assertEqual(sys.solarHeating.roofSensorTemperature, 40);
    assert(sys.solarHeating.lastSolarCheckTime > 0, 'should update check time');
    cleanup(sys);
  });
});

describe('PoolSpaManagementSystem — freeze protection', () => {
  it('updateAirTemperature stores temperature', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    sys.updateAirTemperature(5);
    assertEqual(sys.freezeProtection.airTemperature, 5);
    cleanup(sys);
  });

  it('updatePipeSensorTemperature stores temperature', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    sys.updatePipeSensorTemperature(2);
    assertEqual(sys.freezeProtection.pipeSensorTemperature, 2);
    cleanup(sys);
  });

  it('freeze protection activates below threshold', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    sys.freezeProtection.airTemperature = 1;
    sys._evaluateFreezeProtection();
    assertEqual(sys.freezeProtection.isActive, true);
    assertEqual(sys.freezeProtection.activationCount, 1);
    cleanup(sys);
  });

  it('freeze protection deactivates above threshold + hysteresis', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    sys.freezeProtection.airTemperature = 1;
    sys._evaluateFreezeProtection();
    sys.freezeProtection.airTemperature = 6; // above 3 + 2
    sys._evaluateFreezeProtection();
    assertEqual(sys.freezeProtection.isActive, false);
    cleanup(sys);
  });
});

describe('PoolSpaManagementSystem — salt chlorinator', () => {
  it('setSaltChlorinatorOutput sets valid percentage', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    assertEqual(sys.setSaltChlorinatorOutput(75), true);
    assertEqual(sys.saltChlorinator.outputPercentage, 75);
    cleanup(sys);
  });

  it('setSaltChlorinatorOutput rejects out-of-range', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    assertEqual(sys.setSaltChlorinatorOutput(101), false);
    assertEqual(sys.setSaltChlorinatorOutput(-1), false);
    cleanup(sys);
  });
});

describe('PoolSpaManagementSystem — cover management', () => {
  it('openCover opens cover', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    const result = sys.openCover();
    assertEqual(result, true);
    assertEqual(sys.coverState.isOpen, true);
    cleanup(sys);
  });

  it('openCover is blocked by safety lock', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    sys.toggleChildSafetyLock(true);
    assertEqual(sys.openCover(), false);
    assertEqual(sys.coverState.isOpen, false);
    cleanup(sys);
  });

  it('closeCover closes cover', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    sys.openCover();
    assertEqual(sys.closeCover(), true);
    assertEqual(sys.coverState.isOpen, false);
    cleanup(sys);
  });

  it('toggleChildSafetyLock toggles lock', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    sys.toggleChildSafetyLock(true);
    assertEqual(sys.coverState.safetyLockChildren, true);
    sys.toggleChildSafetyLock(false);
    assertEqual(sys.coverState.safetyLockChildren, false);
    cleanup(sys);
  });
});

describe('PoolSpaManagementSystem — lighting', () => {
  it('setLightingPreset sets valid preset', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    assertEqual(sys.setLightingPreset('underwater', 'blue'), true);
    assertEqual(sys.lightingZones.underwater.preset, 'blue');
    cleanup(sys);
  });

  it('setLightingPreset rejects invalid zone', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    assertEqual(sys.setLightingPreset('nonexistent', 'blue'), false);
    cleanup(sys);
  });

  it('setLightingPreset rejects invalid preset', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    assertEqual(sys.setLightingPreset('underwater', 'neon'), false);
    cleanup(sys);
  });

  it('setLightingBrightness clamps value', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    sys.setLightingBrightness('underwater', 150);
    assertEqual(sys.lightingZones.underwater.brightness, 100);
    sys.setLightingBrightness('underwater', -10);
    assertEqual(sys.lightingZones.underwater.brightness, 0);
    cleanup(sys);
  });

  it('turnOnLighting and turnOffLighting toggle state', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    sys.turnOnLighting('underwater');
    assertEqual(sys.lightingZones.underwater.on, true);
    sys.turnOffLighting('underwater');
    assertEqual(sys.lightingZones.underwater.on, false);
    cleanup(sys);
  });

  it('setAllLightingPreset sets all zones', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    sys.setAllLightingPreset('cyan');
    for (const zone of Object.values(sys.lightingZones)) {
      assertEqual(zone.preset, 'cyan');
      assertEqual(zone.on, true);
    }
    cleanup(sys);
  });
});

describe('PoolSpaManagementSystem — water level', () => {
  it('updateWaterLevel sets level', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    sys.addWaterBody('main_pool');
    sys.updateWaterLevel(14);
    assertEqual(sys.waterLevel.currentLevelCm, 14);
    cleanup(sys);
  });

  it('auto-fill activates when level drops below threshold', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    sys.addWaterBody('main_pool');
    sys.updateWaterLevel(10); // below target (15) - 2
    assertEqual(sys.waterLevel.autoFillValveOpen, true);
    cleanup(sys);
  });

  it('overflow prevention closes valve', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    sys.addWaterBody('main_pool');
    sys.updateWaterLevel(21); // above overflow level 20
    assertEqual(sys.waterLevel.autoFillValveOpen, false);
    cleanup(sys);
  });
});

describe('PoolSpaManagementSystem — filtration', () => {
  it('updateFilterPressure sets reminder on high pressure', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    sys.updateFilterPressure(26);
    assertEqual(sys.filtration.backwashReminder, true);
    cleanup(sys);
  });

  it('recordBackwash clears reminder', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    sys.filtration.backwashReminder = true;
    sys.recordBackwash();
    assertEqual(sys.filtration.backwashReminder, false);
    assert(sys.filtration.lastBackwashDate > 0, 'should record date');
    cleanup(sys);
  });

  it('setFilterType validates types', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    assertEqual(sys.setFilterType('sand'), true);
    assertEqual(sys.filtration.filterType, 'sand');
    assertEqual(sys.setFilterType('invalid'), false);
    cleanup(sys);
  });
});

describe('PoolSpaManagementSystem — maintenance', () => {
  it('completeMaintenanceTask marks task complete', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    const result = sys.completeMaintenanceTask('daily', 'skim');
    assertEqual(result, true);
    assert(sys.maintenanceHistory.length > 0, 'should have history');
    cleanup(sys);
  });

  it('completeMaintenanceTask rejects invalid frequency', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    assertEqual(sys.completeMaintenanceTask('yearly', 'skim'), false);
    cleanup(sys);
  });

  it('getOutstandingMaintenance lists incomplete tasks', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    const outstanding = sys.getOutstandingMaintenance();
    assert(outstanding.daily, 'should have daily tasks');
    assert(outstanding.daily.length > 0, 'should have outstanding daily tasks');
    cleanup(sys);
  });
});

describe('PoolSpaManagementSystem — spa jets', () => {
  it('startJets starts jets on hot tub', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    sys.addWaterBody('hot_tub');
    const result = sys.startJets({ intensity: 'high', timerMinutes: 30 });
    assertEqual(result, true);
    assertEqual(sys.spaJets.running, true);
    assertEqual(sys.spaJets.intensity, 'high');
    cleanup(sys);
  });

  it('startJets fails without hot tub', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    assertEqual(sys.startJets(), false);
    cleanup(sys);
  });

  it('stopJets resets jet state', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    sys.addWaterBody('hot_tub');
    sys.startJets();
    sys.stopJets();
    assertEqual(sys.spaJets.running, false);
    assertEqual(sys.spaJets.autoOffTime, null);
    cleanup(sys);
  });

  it('startHydrotherapySequence starts sequence', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    sys.addWaterBody('hot_tub');
    const result = sys.startHydrotherapySequence('relax');
    assertEqual(result, true);
    assertEqual(sys.spaJets.activeSequence, 'relax');
    assertEqual(sys.spaJets.running, true);
    cleanup(sys);
  });

  it('startHydrotherapySequence rejects invalid sequence', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    assertEqual(sys.startHydrotherapySequence('nonexistent'), false);
    cleanup(sys);
  });
});

describe('PoolSpaManagementSystem — party mode', () => {
  it('activatePartyMode activates with saved settings', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    sys.addWaterBody('hot_tub');
    sys.activatePartyMode();
    assertEqual(sys.partyMode.active, true);
    assert(sys.partyMode.savedSettings, 'should save settings');
    assert(sys.partyMode.activationTime > 0, 'should record activation time');
    cleanup(sys);
  });

  it('deactivatePartyMode restores settings', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    sys.addWaterBody('hot_tub');
    const origSpeed = sys.pumpState.currentSpeed;
    sys.activatePartyMode();
    sys.deactivatePartyMode();
    assertEqual(sys.partyMode.active, false);
    assertEqual(sys.pumpState.currentSpeed, origSpeed);
    cleanup(sys);
  });
});

describe('PoolSpaManagementSystem — weather', () => {
  it('updateWeather stores weather data', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    sys.updateWeather({ temperature: 25, uvIndex: 6, isRaining: false });
    assertEqual(sys.weather.currentTemp, 25);
    assertEqual(sys.weather.uvIndex, 6);
    assertEqual(sys.weather.isRaining, false);
    cleanup(sys);
  });
});

describe('PoolSpaManagementSystem — statistics', () => {
  it('getStatistics returns comprehensive stats', async () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    await sys.initialize();
    const stats = sys.getStatistics();
    assertEqual(stats.initialized, true);
    assertEqual(stats.waterBodyCount, 2);
    assert(stats.pump, 'should have pump stats');
    assert(stats.solarHeating, 'should have solar stats');
    assert(stats.freezeProtection, 'should have freeze stats');
    assert(stats.saltChlorinator, 'should have salt stats');
    assert(stats.cover, 'should have cover stats');
    assert(stats.waterLevel, 'should have water level stats');
    cleanup(sys);
  });
});

describe('PoolSpaManagementSystem — history', () => {
  it('getChemistryHistory filters by body and days', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    sys.addWaterBody('main_pool');
    sys.updateChemistry('main_pool', { ph: 7.3 });
    const history = sys.getChemistryHistory('main_pool', 7);
    assertEqual(history.length, 1);
    cleanup(sys);
  });

  it('getPumpRunHistory returns filtered history', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    sys.pumpRunHistory.push({ timestamp: Date.now(), speed: 'normal', rpm: 2400, watts: 1100 });
    const history = sys.getPumpRunHistory(7);
    assertEqual(history.length, 1);
    cleanup(sys);
  });

  it('_pruneHistory removes old entries', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    const oldTimestamp = Date.now() - (60 * 86400000); // 60 days ago
    sys.chemistryHistory.push({ timestamp: oldTimestamp, waterBody: 'main_pool', readings: {} });
    sys.chemistryHistory.push({ timestamp: Date.now(), waterBody: 'main_pool', readings: {} });
    sys._pruneHistory(sys.chemistryHistory);
    assertEqual(sys.chemistryHistory.length, 1);
    cleanup(sys);
  });
});

describe('PoolSpaManagementSystem — rainbow cycle', () => {
  it('_advanceRainbowCycle returns RGB values', () => {
    const sys = new PoolSpaManagementSystem(createMockHomey());
    const rgb = sys._advanceRainbowCycle();
    assertType(rgb.r, 'number');
    assertType(rgb.g, 'number');
    assertType(rgb.b, 'number');
    assert(rgb.r >= 0 && rgb.r <= 255, 'r in range');
    assert(rgb.g >= 0 && rgb.g <= 255, 'g in range');
    assert(rgb.b >= 0 && rgb.b <= 255, 'b in range');
    cleanup(sys);
  });
});

run();
