'use strict';

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertType, assertRejects } = require('./helpers/assert');
const { createMockHomey: _createMockHomey } = require('./helpers/mockHomey');

/* ── timer-leak prevention ─────────────────────────────────────────── */
const _origSetTimeout = global.setTimeout;
const _origSetInterval = global.setInterval;
const activeHandles = [];
global.setTimeout = (...a) => { const id = _origSetTimeout(...a); activeHandles.push({ type: 'timeout', id }); return id; };
global.setInterval = (...a) => { const id = _origSetInterval(...a); activeHandles.push({ type: 'interval', id }); return id; };
function cleanup(sys) {
  try { if (sys && typeof sys.destroy === 'function') sys.destroy(); } catch (_) {}
  // LaundryManagementSystem has monitoring.interval instead of destroy
  try { if (sys && sys.monitoring && sys.monitoring.interval) { clearInterval(sys.monitoring.interval); sys.monitoring.interval = null; } } catch (_e) {}
  while (activeHandles.length > 0) {
    const h = activeHandles.pop();
    if (h.type === 'timeout') clearTimeout(h.id); else clearInterval(h.id);
  }
}

const SmartLaundryManagementSystem = require('../lib/SmartLaundryManagementSystem');

/* ================================================================== */
/*  SmartLaundryManagementSystem – test suite                         */
/* ================================================================== */

describe('Laundry — constructor & initialization', () => {
  it('instantiates without errors', () => {
    const sys = new SmartLaundryManagementSystem();
    assert(sys, 'should create instance');
    cleanup(sys);
  });

  it('creates default appliances on construction', () => {
    const sys = new SmartLaundryManagementSystem();
    assert(sys.laundryAppliances.size >= 2, 'should have at least 2 appliances');
    assert(sys.laundryAppliances.has('washer-001'), 'should have main washer');
    assert(sys.laundryAppliances.has('dryer-001'), 'should have main dryer');
    cleanup(sys);
  });

  it('creates default detergent inventory', () => {
    const sys = new SmartLaundryManagementSystem();
    assert(sys.detergentInventory.size > 0, 'should have detergent inventory');
    cleanup(sys);
  });

  it('creates default fabric care profiles', () => {
    const sys = new SmartLaundryManagementSystem();
    assert(sys.fabricCareProfiles.size > 0, 'should have fabric care profiles');
    cleanup(sys);
  });

  it('initialize returns success', async () => {
    const sys = new SmartLaundryManagementSystem();
    const result = await sys.initialize();
    assert(result.success, 'should succeed');
    assertEqual(result.appliances, sys.laundryAppliances.size);
    cleanup(sys);
  });
});

describe('Laundry — appliance getters', () => {
  it('getLaundryAppliances returns all appliances', () => {
    const sys = new SmartLaundryManagementSystem();
    const appliances = sys.getLaundryAppliances();
    assert(Array.isArray(appliances), 'should be array');
    assert(appliances.length >= 2, 'should have at least 2 appliances');
    cleanup(sys);
  });

  it('appliance has expected properties', () => {
    const sys = new SmartLaundryManagementSystem();
    const washer = sys.laundryAppliances.get('washer-001');
    assertEqual(washer.type, 'washer');
    assertEqual(washer.status, 'idle');
    assert(washer.programs.length > 0, 'should have programs');
    assertType(washer.capacity, 'number');
    cleanup(sys);
  });

  it('getRecentLoads returns array with limit', () => {
    const sys = new SmartLaundryManagementSystem();
    const loads = sys.getRecentLoads(5);
    assert(Array.isArray(loads), 'should be array');
    cleanup(sys);
  });

  it('getDetergentInventory returns array', () => {
    const sys = new SmartLaundryManagementSystem();
    const inv = sys.getDetergentInventory();
    assert(Array.isArray(inv), 'should be array');
    assert(inv.length > 0, 'should have items');
    cleanup(sys);
  });
});

describe('Laundry — wash cycle', () => {
  it('startLaundryLoad throws for unknown appliance', async () => {
    const sys = new SmartLaundryManagementSystem();
    await assertRejects(
      () => sys.startLaundryLoad('nonexistent', { programId: 'cottons' }),
      'not found'
    );
    cleanup(sys);
  });

  it('startLaundryLoad throws for unknown program', async () => {
    const sys = new SmartLaundryManagementSystem();
    await assertRejects(
      () => sys.startLaundryLoad('washer-001', { programId: 'nonexistent' }),
      'not found'
    );
    cleanup(sys);
  });

  it('startLaundryLoad starts a wash cycle', async () => {
    const sys = new SmartLaundryManagementSystem();
    const result = await sys.startLaundryLoad('washer-001', { programId: 'cottons' });
    assert(result.success, 'should succeed');
    const washer = sys.laundryAppliances.get('washer-001');
    assertEqual(washer.status, 'running');
    assertEqual(washer.doorLocked, true);
    cleanup(sys);
  });

  it('startLaundryLoad rejects when already running', async () => {
    const sys = new SmartLaundryManagementSystem();
    await sys.startLaundryLoad('washer-001', { programId: 'cottons' });
    await assertRejects(
      () => sys.startLaundryLoad('washer-001', { programId: 'quick' }),
      'currently'
    );
    cleanup(sys);
  });
});

describe('Laundry — fabric care', () => {
  it('getFabricCareRecommendation returns for known fabric', () => {
    const sys = new SmartLaundryManagementSystem();
    const rec = sys.getFabricCareRecommendation('cotton');
    assert(rec, 'should return recommendation');
    assert(rec.washer, 'should have washer section');
    assert(rec.dryer, 'should have dryer section');
    cleanup(sys);
  });

  it('getFabricCareRecommendation returns default for unknown fabric', () => {
    const sys = new SmartLaundryManagementSystem();
    const rec = sys.getFabricCareRecommendation('kevlar');
    assert(rec, 'should return result');
    assertEqual(rec.success, false);
    assert(rec.defaultRecommendation, 'should have default recommendation');
    cleanup(sys);
  });
});

describe('Laundry — detergent dosage', () => {
  it('calculateDetergentDosage returns correct dose for light load', () => {
    const sys = new SmartLaundryManagementSystem();
    const dose = sys.calculateDetergentDosage(2, { waterLevel: 'medium' });
    assertEqual(dose, 40);
    cleanup(sys);
  });

  it('calculateDetergentDosage returns higher dose for heavy load', () => {
    const sys = new SmartLaundryManagementSystem();
    const dose = sys.calculateDetergentDosage(8, { waterLevel: 'medium' });
    assertEqual(dose, 100);
    cleanup(sys);
  });

  it('calculateDetergentDosage adjusts for water level', () => {
    const sys = new SmartLaundryManagementSystem();
    const doseHigh = sys.calculateDetergentDosage(5, { waterLevel: 'high' });
    const doseLow = sys.calculateDetergentDosage(5, { waterLevel: 'low' });
    assert(doseHigh > doseLow, 'high water level should use more');
    cleanup(sys);
  });

  it('updateDetergentInventory reduces volume', async () => {
    const sys = new SmartLaundryManagementSystem();
    const det = sys.detergentInventory.get('detergent-001');
    const initialVolume = det.volume;
    await sys.updateDetergentInventory('detergent-001', 60);
    assertEqual(det.volume, initialVolume - 60);
    cleanup(sys);
  });
});

describe('Laundry — maintenance', () => {
  it('checkMaintenanceRequirements returns array', () => {
    const sys = new SmartLaundryManagementSystem();
    const reqs = sys.checkMaintenanceRequirements();
    assert(Array.isArray(reqs), 'should be array');
    cleanup(sys);
  });

  it('performMaintenance records lint-filter cleaning', async () => {
    const sys = new SmartLaundryManagementSystem();
    const result = await sys.performMaintenance('dryer-001', 'lint-filter');
    assertEqual(result.success, true);
    const dryer = sys.laundryAppliances.get('dryer-001');
    assertEqual(dryer.maintenance.lintFilterDue, false);
    cleanup(sys);
  });

  it('performMaintenance throws for unknown appliance', async () => {
    const sys = new SmartLaundryManagementSystem();
    await assertRejects(
      () => sys.performMaintenance('nope', 'lint-filter'),
      'not found'
    );
    cleanup(sys);
  });

  it('performMaintenance throws for unknown type', async () => {
    const sys = new SmartLaundryManagementSystem();
    await assertRejects(
      () => sys.performMaintenance('washer-001', 'unknown-type'),
      'Unknown maintenance type'
    );
    cleanup(sys);
  });
});

describe('Laundry — statistics & cache', () => {
  it('getLaundryStatistics returns comprehensive stats', () => {
    const sys = new SmartLaundryManagementSystem();
    const stats = sys.getLaundryStatistics();
    assert(stats, 'should return stats');
    assertType(stats.totalLoads, 'number');
    assert(stats.appliances, 'should have appliances section');
    assert(stats.detergent, 'should have detergent section');
    cleanup(sys);
  });

  it('cache stores and retrieves values', () => {
    const sys = new SmartLaundryManagementSystem();
    sys.setCached('test-key', { value: 42 });
    const cached = sys.getCached('test-key');
    assertEqual(cached.value, 42);
    cleanup(sys);
  });

  it('getCached returns null for missing key', () => {
    const sys = new SmartLaundryManagementSystem();
    assertEqual(sys.getCached('missing'), null);
    cleanup(sys);
  });

  it('calculateOffPeakDelay returns non-negative number', () => {
    const sys = new SmartLaundryManagementSystem();
    const delay = sys.calculateOffPeakDelay();
    assertType(delay, 'number');
    assert(delay >= 0, 'delay should be non-negative');
    cleanup(sys);
  });
});

run();
