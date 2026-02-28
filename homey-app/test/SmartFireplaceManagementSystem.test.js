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

const SmartFireplaceManagementSystem = require('../lib/SmartFireplaceManagementSystem');

describe('SmartFireplaceManagementSystem — constructor', () => {
  it('instantiates without errors', () => {
    const sys = new SmartFireplaceManagementSystem(createMockHomey());
    assert(sys, 'should create instance');
    assertEqual(sys.initialized, false);
    assert(sys.fireplaces, 'should have fireplaces');
    assertEqual(Object.keys(sys.fireplaces).length, 4);
    cleanup(sys);
  });

  it('has correct fireplace types', () => {
    const sys = new SmartFireplaceManagementSystem(createMockHomey());
    assertEqual(sys.fireplaces['living-room-wood'].type, 'wood');
    assertEqual(sys.fireplaces['bedroom-pellet'].type, 'pellet');
    assertEqual(sys.fireplaces['outdoor-patio'].type, 'gas');
    assertEqual(sys.fireplaces['sauna-wood'].type, 'wood');
    cleanup(sys);
  });
});

describe('SmartFireplaceManagementSystem — initialize', () => {
  it('initializes and sets up intervals', async () => {
    const sys = new SmartFireplaceManagementSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.initialized, true);
    assert(sys.intervals.length > 0, 'should have intervals');
    cleanup(sys);
  });
});

describe('SmartFireplaceManagementSystem — startFireplace', () => {
  it('starts a wood fireplace', async () => {
    const sys = new SmartFireplaceManagementSystem(createMockHomey());
    await sys.initialize();
    const result = await sys.startFireplace('living-room-wood');
    assertEqual(result.success, true);
    assertEqual(result.fireplaceId, 'living-room-wood');
    cleanup(sys);
  });

  it('fails for unknown fireplace', async () => {
    const sys = new SmartFireplaceManagementSystem(createMockHomey());
    await sys.initialize();
    const result = await sys.startFireplace('nonexistent');
    assertEqual(result.success, false);
    assertEqual(result.reason, 'unknown_fireplace');
    cleanup(sys);
  });

  it('fails when already running', async () => {
    const sys = new SmartFireplaceManagementSystem(createMockHomey());
    await sys.initialize();
    await sys.startFireplace('living-room-wood');
    const result = await sys.startFireplace('living-room-wood');
    assertEqual(result.success, false);
    assertEqual(result.reason, 'already_active');
    cleanup(sys);
  });

  it('fails when child lock engaged', async () => {
    const sys = new SmartFireplaceManagementSystem(createMockHomey());
    await sys.initialize();
    sys.fireplaces['living-room-wood'].childLockEngaged = true;
    const result = await sys.startFireplace('living-room-wood');
    assertEqual(result.success, false);
    assertEqual(result.reason, 'child_lock_engaged');
    cleanup(sys);
  });

  it('blocks non-gas fireplaces during burn ban', async () => {
    const sys = new SmartFireplaceManagementSystem(createMockHomey());
    await sys.initialize();
    sys.regulations.eldningsförbud = true;
    const result = await sys.startFireplace('living-room-wood');
    assertEqual(result.success, false);
    assertEqual(result.reason, 'burn_ban_active');
    cleanup(sys);
  });
});

describe('SmartFireplaceManagementSystem — stopFireplace', () => {
  it('stops a running fireplace', async () => {
    const sys = new SmartFireplaceManagementSystem(createMockHomey());
    await sys.initialize();
    await sys.startFireplace('living-room-wood');
    const result = await sys.stopFireplace('living-room-wood');
    assertEqual(result.success, true);
    cleanup(sys);
  });

  it('fails for unknown fireplace', async () => {
    const sys = new SmartFireplaceManagementSystem(createMockHomey());
    await sys.initialize();
    const result = await sys.stopFireplace('nonexistent');
    assertEqual(result.success, false);
    cleanup(sys);
  });
});

describe('SmartFireplaceManagementSystem — setFlameHeight', () => {
  it('sets flame height for running gas fireplace', async () => {
    const sys = new SmartFireplaceManagementSystem(createMockHomey());
    await sys.initialize();
    sys.fireplaces['outdoor-patio'].status = 'running';
    const result = sys.setFlameHeight('outdoor-patio', 80);
    assertEqual(result.success, true);
    assertEqual(sys.fireplaces['outdoor-patio'].flameHeight, 80);
    cleanup(sys);
  });

  it('rejects flame height when not running', async () => {
    const sys = new SmartFireplaceManagementSystem(createMockHomey());
    await sys.initialize();
    const result = sys.setFlameHeight('outdoor-patio', 80);
    assertEqual(result.success, false);
    cleanup(sys);
  });
});

describe('SmartFireplaceManagementSystem — setFanSpeed', () => {
  it('sets fan speed for running fireplace', async () => {
    const sys = new SmartFireplaceManagementSystem(createMockHomey());
    await sys.initialize();
    sys.fireplaces['living-room-wood'].status = 'running';
    const result = sys.setFanSpeed('living-room-wood', 3);
    assertEqual(result.success, true);
    assertEqual(sys.fireplaces['living-room-wood'].fanSpeed, 3);
    cleanup(sys);
  });
});

describe('SmartFireplaceManagementSystem — setDamperPosition', () => {
  it('sets damper position', async () => {
    const sys = new SmartFireplaceManagementSystem(createMockHomey());
    await sys.initialize();
    const result = sys.setDamperPosition('living-room-wood', 60);
    assertEqual(result.success, true);
    assertEqual(sys.fireplaces['living-room-wood'].damperPosition, 60);
    cleanup(sys);
  });
});

describe('SmartFireplaceManagementSystem — toggleChildLock', () => {
  it('engages child lock', async () => {
    const sys = new SmartFireplaceManagementSystem(createMockHomey());
    await sys.initialize();
    const result = sys.toggleChildLock('living-room-wood', true);
    assertEqual(result.success, true);
    assertEqual(sys.fireplaces['living-room-wood'].childLockEngaged, true);
    cleanup(sys);
  });
});

describe('SmartFireplaceManagementSystem — setBurnBanStatus', () => {
  it('activates burn ban', async () => {
    const sys = new SmartFireplaceManagementSystem(createMockHomey());
    await sys.initialize();
    sys.setBurnBanStatus(true);
    assertEqual(sys.regulations.eldningsförbud, true);
    cleanup(sys);
  });
});

describe('SmartFireplaceManagementSystem — recordCleaning', () => {
  it('records cleaning for a fireplace', async () => {
    const sys = new SmartFireplaceManagementSystem(createMockHomey());
    await sys.initialize();
    const result = sys.recordCleaning('living-room-wood');
    assertEqual(result.success, true);
    assert(sys.fireplaces['living-room-wood'].lastCleaned, 'should record date');
    cleanup(sys);
  });
});

describe('SmartFireplaceManagementSystem — updateFireplaceReading', () => {
  it('updates readings for a fireplace', async () => {
    const sys = new SmartFireplaceManagementSystem(createMockHomey());
    await sys.initialize();
    const result = sys.updateFireplaceReading('living-room-wood', {
      currentTemp: 65, flueTemp: 180, carbonMonoxidePPM: 5
    });
    assertEqual(result.success, true);
    assertEqual(sys.fireplaces['living-room-wood'].currentTemp, 65);
    assertEqual(sys.fireplaces['living-room-wood'].flueTemp, 180);
    cleanup(sys);
  });
});

describe('SmartFireplaceManagementSystem — getFireplaceStatus', () => {
  it('returns status for known fireplace', async () => {
    const sys = new SmartFireplaceManagementSystem(createMockHomey());
    await sys.initialize();
    const status = sys.getFireplaceStatus('living-room-wood');
    assert(status, 'should return status');
    assertEqual(status.id, 'living-room-wood');
    assertEqual(status.type, 'wood');
    cleanup(sys);
  });

  it('returns null for unknown fireplace', async () => {
    const sys = new SmartFireplaceManagementSystem(createMockHomey());
    assertEqual(sys.getFireplaceStatus('nonexistent'), null);
    cleanup(sys);
  });
});

describe('SmartFireplaceManagementSystem — getAllFireplaceStatuses', () => {
  it('returns all fireplace statuses', async () => {
    const sys = new SmartFireplaceManagementSystem(createMockHomey());
    await sys.initialize();
    const statuses = sys.getAllFireplaceStatuses();
    assert(Object.keys(statuses).length === 4, 'should have 4 fireplaces');
    cleanup(sys);
  });
});

describe('SmartFireplaceManagementSystem — getStatistics', () => {
  it('returns comprehensive statistics', async () => {
    const sys = new SmartFireplaceManagementSystem(createMockHomey());
    await sys.initialize();
    const stats = sys.getStatistics();
    assertType(stats.fireplaceCount, 'number');
    assertEqual(stats.fireplaceCount, 4);
    assertEqual(stats.initialized, true);
    assert(stats.safetyStatus, 'should have safetyStatus');
    cleanup(sys);
  });
});

describe('SmartFireplaceManagementSystem — getEnergyReport', () => {
  it('returns energy report', async () => {
    const sys = new SmartFireplaceManagementSystem(createMockHomey());
    await sys.initialize();
    const report = sys.getEnergyReport();
    assert(report, 'should return report');
    assertType(report.totalKwhThisSeason, 'number');
    cleanup(sys);
  });
});

describe('SmartFireplaceManagementSystem — getLoadingInstructions', () => {
  it('returns instructions for wood fireplace', async () => {
    const sys = new SmartFireplaceManagementSystem(createMockHomey());
    await sys.initialize();
    const result = sys.getLoadingInstructions('living-room-wood');
    assert(result, 'should return result');
    assertEqual(result.success, true);
    assert(result.instructions, 'should have instructions');
    cleanup(sys);
  });
});

describe('SmartFireplaceManagementSystem — destroy', () => {
  it('clears all intervals', async () => {
    const sys = new SmartFireplaceManagementSystem(createMockHomey());
    await sys.initialize();
    sys.destroy();
    assertEqual(sys.intervals.length, 0);
    cleanup(sys);
  });
});

run();
