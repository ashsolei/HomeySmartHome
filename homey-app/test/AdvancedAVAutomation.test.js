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
  while (activeHandles.length > 0) {
    const h = activeHandles.pop();
    if (h.type === 'timeout') clearTimeout(h.id); else clearInterval(h.id);
  }
}

const AdvancedAVAutomation = require('../lib/AdvancedAVAutomation');

/* ================================================================== */
/*  AdvancedAVAutomation – test suite                                 */
/* ================================================================== */

describe('AdvancedAVAutomation — constructor & lifecycle', () => {
  it('instantiates without errors', () => {
    const sys = new AdvancedAVAutomation(createMockHomey());
    assert(sys, 'should create instance');
    cleanup(sys);
  });

  it('constructor initializes empty structures', () => {
    const sys = new AdvancedAVAutomation(createMockHomey());
    assertEqual(typeof sys.zones, 'object');
    assertEqual(sys.activePreset, null);
    assertEqual(sys.partyMode.active, false);
    assertEqual(sys.statistics.totalPlaybackHours, 0);
    cleanup(sys);
  });

  it('initialize sets up zones, HDMI, presets', () => {
    const sys = new AdvancedAVAutomation(createMockHomey());
    sys.initialize();
    assert(Object.keys(sys.zones).length === 8, 'should have 8 zones');
    assert(sys.hdmiMatrix.inputs.length === 4, 'should have 4 HDMI inputs');
    assert(sys.hdmiMatrix.outputs.length === 8, 'should have 8 HDMI outputs');
    assert(Object.keys(sys.cinemaPresets).length > 0, 'should have cinema presets');
    cleanup(sys);
  });

  it('destroy clears intervals', () => {
    const sys = new AdvancedAVAutomation(createMockHomey());
    sys.initialize();
    sys.destroy();
    assertEqual(sys.monitoringInterval, null);
    assertEqual(sys.backgroundMusicInterval, null);
    assertEqual(sys.smartVolumeInterval, null);
    assertEqual(sys.energyInterval, null);
    cleanup(sys);
  });
});

describe('AdvancedAVAutomation — zone control', () => {
  it('setZoneVolume clamps and sets volume', () => {
    const sys = new AdvancedAVAutomation(createMockHomey());
    sys.initialize();
    sys.smartVolume.enabled = false;
    const result = sys.setZoneVolume('living_room', 50);
    assertEqual(result, true);
    assertEqual(sys.zones.living_room.volume, 50);
    cleanup(sys);
  });

  it('setZoneVolume returns false for unknown zone', () => {
    const sys = new AdvancedAVAutomation(createMockHomey());
    sys.initialize();
    assertEqual(sys.setZoneVolume('nonexistent', 50), false);
    cleanup(sys);
  });

  it('setZoneVolume clamps to maxVolume', () => {
    const sys = new AdvancedAVAutomation(createMockHomey());
    sys.initialize();
    sys.setZoneVolume('bathroom', 200);
    assert(sys.zones.bathroom.volume <= 60, 'should clamp to max');
    cleanup(sys);
  });

  it('setZoneSource sets source on zone', () => {
    const sys = new AdvancedAVAutomation(createMockHomey());
    sys.initialize();
    const result = sys.setZoneSource('living_room', 'spotify');
    assertEqual(result, true);
    assertEqual(sys.zones.living_room.source, 'spotify');
    cleanup(sys);
  });

  it('setZoneSource returns false for unknown source', () => {
    const sys = new AdvancedAVAutomation(createMockHomey());
    sys.initialize();
    assertEqual(sys.setZoneSource('living_room', 'nonexistent'), false);
    cleanup(sys);
  });

  it('toggleZonePower toggles power on and off', () => {
    const sys = new AdvancedAVAutomation(createMockHomey());
    sys.initialize();
    sys.toggleZonePower('kitchen');
    assertEqual(sys.zones.kitchen.power, true);
    sys.toggleZonePower('kitchen');
    assertEqual(sys.zones.kitchen.power, false);
    cleanup(sys);
  });

  it('muteZone mutes and unmutes', () => {
    const sys = new AdvancedAVAutomation(createMockHomey());
    sys.initialize();
    sys.muteZone('bedroom', true);
    assertEqual(sys.zones.bedroom.muted, true);
    sys.muteZone('bedroom', false);
    assertEqual(sys.zones.bedroom.muted, false);
    cleanup(sys);
  });
});

describe('AdvancedAVAutomation — zone groups', () => {
  it('activateGroup powers on all zones in group', () => {
    const sys = new AdvancedAVAutomation(createMockHomey());
    sys.initialize();
    const result = sys.activateGroup('downstairs');
    assertEqual(result, true);
    assertEqual(sys.zones.living_room.power, true);
    assertEqual(sys.zones.kitchen.power, true);
    cleanup(sys);
  });

  it('activateGroup returns false for unknown group', () => {
    const sys = new AdvancedAVAutomation(createMockHomey());
    sys.initialize();
    assertEqual(sys.activateGroup('nonexistent'), false);
    cleanup(sys);
  });

  it('deactivateGroup clears group assignments', () => {
    const sys = new AdvancedAVAutomation(createMockHomey());
    sys.initialize();
    sys.activateGroup('downstairs');
    sys.deactivateGroup('downstairs');
    assertEqual(sys.zones.living_room.groupId, null);
    cleanup(sys);
  });

  it('setGroupVolume sets volume for active group', () => {
    const sys = new AdvancedAVAutomation(createMockHomey());
    sys.initialize();
    sys.smartVolume.enabled = false;
    sys.activateGroup('downstairs');
    const result = sys.setGroupVolume('downstairs', 40);
    assertEqual(result, true);
    assertEqual(sys.zones.living_room.volume, 40);
    assertEqual(sys.zones.kitchen.volume, 40);
    cleanup(sys);
  });

  it('setGroupVolume returns false for inactive group', () => {
    const sys = new AdvancedAVAutomation(createMockHomey());
    sys.initialize();
    assertEqual(sys.setGroupVolume('downstairs', 40), false);
    cleanup(sys);
  });
});

describe('AdvancedAVAutomation — HDMI matrix', () => {
  it('switchHdmiInput routes input to output', () => {
    const sys = new AdvancedAVAutomation(createMockHomey());
    sys.initialize();
    const result = sys.switchHdmiInput(1, 2);
    assertEqual(result, true);
    const route = sys.getActiveHdmiRoute(1);
    assertEqual(route.input.id, 2);
    cleanup(sys);
  });

  it('switchHdmiInput returns false for invalid IDs', () => {
    const sys = new AdvancedAVAutomation(createMockHomey());
    sys.initialize();
    assertEqual(sys.switchHdmiInput(99, 1), false);
    cleanup(sys);
  });

  it('getActiveHdmiRoute returns null for unknown output', () => {
    const sys = new AdvancedAVAutomation(createMockHomey());
    sys.initialize();
    assertEqual(sys.getActiveHdmiRoute(99), null);
    cleanup(sys);
  });
});

describe('AdvancedAVAutomation — cinema presets', () => {
  it('activatePreset applies audio and video settings', () => {
    const sys = new AdvancedAVAutomation(createMockHomey());
    sys.initialize();
    const result = sys.activatePreset('movie_night');
    assertEqual(result, true);
    assertEqual(sys.activePreset, 'movie_night');
    assert(sys.statistics.presetsActivated >= 1, 'should increment preset count');
    cleanup(sys);
  });

  it('activatePreset returns false for unknown preset', () => {
    const sys = new AdvancedAVAutomation(createMockHomey());
    sys.initialize();
    assertEqual(sys.activatePreset('nonexistent'), false);
    cleanup(sys);
  });

  it('deactivatePreset clears active preset', () => {
    const sys = new AdvancedAVAutomation(createMockHomey());
    sys.initialize();
    sys.activatePreset('sports');
    const result = sys.deactivatePreset();
    assertEqual(result, true);
    assertEqual(sys.activePreset, null);
    cleanup(sys);
  });

  it('deactivatePreset returns false when none active', () => {
    const sys = new AdvancedAVAutomation(createMockHomey());
    sys.initialize();
    assertEqual(sys.deactivatePreset(), false);
    cleanup(sys);
  });
});

describe('AdvancedAVAutomation — projector', () => {
  it('projectorPower turns on and off', () => {
    const sys = new AdvancedAVAutomation(createMockHomey());
    sys.initialize();
    sys.projectorPower(true);
    assertEqual(sys.projector.power, true);
    sys.projectorPower(false);
    assertEqual(sys.projector.power, false);
    cleanup(sys);
  });

  it('setProjectorEcoMode toggles eco mode', () => {
    const sys = new AdvancedAVAutomation(createMockHomey());
    sys.initialize();
    sys.setProjectorEcoMode(true);
    assertEqual(sys.projector.ecoMode, true);
    cleanup(sys);
  });

  it('setAspectRatio updates valid ratio', () => {
    const sys = new AdvancedAVAutomation(createMockHomey());
    sys.initialize();
    const result = sys.setAspectRatio('16:9');
    assertEqual(result, true);
    assertEqual(sys.projector.aspectRatio, '16:9');
    cleanup(sys);
  });

  it('setAspectRatio rejects invalid ratio', () => {
    const sys = new AdvancedAVAutomation(createMockHomey());
    sys.initialize();
    assertEqual(sys.setAspectRatio('99:1'), false);
    cleanup(sys);
  });
});

describe('AdvancedAVAutomation — calibration & EQ', () => {
  it('runCalibration runs for a known zone', () => {
    const sys = new AdvancedAVAutomation(createMockHomey());
    sys.initialize();
    const result = sys.runCalibration('living_room');
    assertEqual(result, true);
    assert(sys.statistics.calibrationsRun >= 1, 'should increment calibration count');
    cleanup(sys);
  });

  it('runCalibration returns false for unknown zone', () => {
    const sys = new AdvancedAVAutomation(createMockHomey());
    sys.initialize();
    assertEqual(sys.runCalibration('nonexistent'), false);
    cleanup(sys);
  });

  it('setEQ adjusts band gain for a zone', () => {
    const sys = new AdvancedAVAutomation(createMockHomey());
    sys.initialize();
    const result = sys.setEQ('living_room', 0, 3);
    assertEqual(result, true);
    cleanup(sys);
  });

  it('setEQ returns false for invalid band index', () => {
    const sys = new AdvancedAVAutomation(createMockHomey());
    sys.initialize();
    assertEqual(sys.setEQ('living_room', 99, 3), false);
    cleanup(sys);
  });
});

describe('AdvancedAVAutomation — streaming sources', () => {
  it('connectSource connects a known source', () => {
    const sys = new AdvancedAVAutomation(createMockHomey());
    sys.initialize();
    const result = sys.connectSource('spotify');
    assertEqual(result, true);
    cleanup(sys);
  });

  it('connectSource returns false for unknown source', () => {
    const sys = new AdvancedAVAutomation(createMockHomey());
    sys.initialize();
    assertEqual(sys.connectSource('nonexistent'), false);
    cleanup(sys);
  });

  it('disconnectSource disconnects connected source', () => {
    const sys = new AdvancedAVAutomation(createMockHomey());
    sys.initialize();
    sys.connectSource('spotify');
    assertEqual(sys.disconnectSource('spotify'), true);
    cleanup(sys);
  });

  it('getSourceStatus returns status object', () => {
    const sys = new AdvancedAVAutomation(createMockHomey());
    sys.initialize();
    const status = sys.getSourceStatus();
    assertType(status, 'object');
    assert(Object.keys(status).length > 0, 'should have sources');
    cleanup(sys);
  });
});

describe('AdvancedAVAutomation — lip sync & announcements', () => {
  it('setLipSyncDelay sets valid delay', () => {
    const sys = new AdvancedAVAutomation(createMockHomey());
    sys.initialize();
    const result = sys.setLipSyncDelay('apple_tv', 50);
    assertEqual(result, true);
    cleanup(sys);
  });

  it('setLipSyncDelay rejects out-of-range delay', () => {
    const sys = new AdvancedAVAutomation(createMockHomey());
    sys.initialize();
    assertEqual(sys.setLipSyncDelay('apple_tv', 9999), false);
    cleanup(sys);
  });

  it('getLipSyncDelay returns delay for known source', () => {
    const sys = new AdvancedAVAutomation(createMockHomey());
    sys.initialize();
    sys.setLipSyncDelay('apple_tv', 30);
    const delay = sys.getLipSyncDelay('apple_tv');
    assertType(delay, 'number');
    cleanup(sys);
  });

  it('sendAnnouncement queues and returns announcement id', () => {
    const sys = new AdvancedAVAutomation(createMockHomey());
    sys.initialize();
    const id = sys.sendAnnouncement('Test announcement', ['living_room'], 'normal');
    assertType(id, 'string');
    assert(id.length > 0, 'should return non-empty id');
    cleanup(sys);
  });
});

describe('AdvancedAVAutomation — party mode', () => {
  it('activatePartyMode links all zones', () => {
    const sys = new AdvancedAVAutomation(createMockHomey());
    sys.initialize();
    const result = sys.activatePartyMode('living_room');
    assertEqual(result, true);
    assertEqual(sys.partyMode.active, true);
    assertEqual(sys.partyMode.masterZone, 'living_room');
    cleanup(sys);
  });

  it('activatePartyMode returns false for unknown zone', () => {
    const sys = new AdvancedAVAutomation(createMockHomey());
    sys.initialize();
    assertEqual(sys.activatePartyMode('nonexistent'), false);
    cleanup(sys);
  });

  it('deactivatePartyMode resets party state', () => {
    const sys = new AdvancedAVAutomation(createMockHomey());
    sys.initialize();
    sys.activatePartyMode('living_room');
    const result = sys.deactivatePartyMode();
    assertEqual(result, true);
    assertEqual(sys.partyMode.active, false);
    cleanup(sys);
  });

  it('setPartyVolume sets volume when party active', () => {
    const sys = new AdvancedAVAutomation(createMockHomey());
    sys.initialize();
    sys.activatePartyMode('living_room');
    const result = sys.setPartyVolume(60);
    assertEqual(result, true);
    cleanup(sys);
  });

  it('setPartyVolume returns false when party inactive', () => {
    const sys = new AdvancedAVAutomation(createMockHomey());
    sys.initialize();
    assertEqual(sys.setPartyVolume(60), false);
    cleanup(sys);
  });
});

describe('AdvancedAVAutomation — energy & statistics', () => {
  it('getEnergyReport returns report object', () => {
    const sys = new AdvancedAVAutomation(createMockHomey());
    sys.initialize();
    const report = sys.getEnergyReport();
    assert(report, 'should return report');
    assertType(report.dailyKwh, 'number');
    assertType(report.totalCurrentWattage, 'number');
    assert(typeof report.devices === 'object', 'should have devices object');
    cleanup(sys);
  });

  it('getStatistics returns comprehensive stats', () => {
    const sys = new AdvancedAVAutomation(createMockHomey());
    sys.initialize();
    const stats = sys.getStatistics();
    assertEqual(stats.zones.total, 8);
    assert(stats.hdmiMatrix.inputs === 4, 'should have 4 inputs');
    assert(stats.hdmiMatrix.outputs === 8, 'should have 8 outputs');
    assertType(stats.uptime, 'number');
    assertType(stats.uptimeFormatted, 'string');
    cleanup(sys);
  });

  it('enableBackgroundMusic toggles background music', () => {
    const sys = new AdvancedAVAutomation(createMockHomey());
    sys.initialize();
    sys.enableBackgroundMusic(false);
    assertEqual(sys.backgroundMusic.enabled, false);
    cleanup(sys);
  });
});

run();
