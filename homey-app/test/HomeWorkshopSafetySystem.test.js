'use strict';

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertType } = require('./helpers/assert');

/* Timer leak prevention */
const _origSetTimeout = global.setTimeout;
const _origSetInterval = global.setInterval;
const activeHandles = [];
global.setTimeout = (...args) => { const id = _origSetTimeout(...args); activeHandles.push({ type: 'timeout', id }); return id; };
global.setInterval = (...args) => { const id = _origSetInterval(...args); activeHandles.push({ type: 'interval', id }); return id; };
function cleanup(sys) {
  try { if (sys.monitoring && sys.monitoring.interval) clearInterval(sys.monitoring.interval); } catch (_) {}
  try { sys.removeAllListeners(); } catch (_) {}
  while (activeHandles.length > 0) { const h = activeHandles.pop(); if (h.type === 'timeout') clearTimeout(h.id); else clearInterval(h.id); }
}

const HomeWorkshopSafetySystem = require('../lib/HomeWorkshopSafetySystem');

function createSystem() {
  const sys = new HomeWorkshopSafetySystem();
  sys.saveSettings = async () => {};
  sys.loadSettings = async () => {};
  return sys;
}

describe('HomeWorkshopSafetySystem', () => {

  describe('Constructor', () => {
    it('creates instance with default data', () => {
      const sys = createSystem();
      assertEqual(sys.powerTools.size, 4);
      assertEqual(sys.safetyEquipment.size, 4);
      assertEqual(sys.safetyZones.size, 3);
      assertEqual(sys.projectSafetyPlans.size, 1);
      assertType(sys.settings, 'object');
      assertType(sys.environment, 'object');
      assertType(sys.emergencyStatus, 'object');
      cleanup(sys);
    });

    it('initializes environment defaults', () => {
      const sys = createSystem();
      assertEqual(sys.environment.temperature, 18);
      assertEqual(sys.environment.humidity, 45);
      assertEqual(sys.environment.dustLevel, 15);
      assertEqual(sys.environment.coLevel, 0);
      assertEqual(sys.environment.noiseLevel, 35);
      assertEqual(sys.environment.ventilationActive, false);
      cleanup(sys);
    });

    it('initializes emergency status as inactive', () => {
      const sys = createSystem();
      assertEqual(sys.emergencyStatus.emergencyStopActivated, false);
      assertEqual(sys.emergencyStatus.powerCutOff, false);
      assertEqual(sys.emergencyStatus.fireDetected, false);
      assertEqual(sys.emergencyStatus.gasLeakDetected, false);
      cleanup(sys);
    });
  });

  describe('Power Tools', () => {
    it('has Table Saw as tool-001', () => {
      const sys = createSystem();
      const saw = sys.powerTools.get('tool-001');
      assertEqual(saw.name, 'Table Saw');
      assertEqual(saw.type, 'table-saw');
      assertEqual(saw.powerRating, 1850);
      assertEqual(saw.status, 'off');
      cleanup(sys);
    });

    it('getPowerTools returns array of all tools', () => {
      const sys = createSystem();
      const tools = sys.getPowerTools();
      assertEqual(tools.length, 4);
      assert(tools.some(t => t.name === 'Table Saw'), 'has table saw');
      assert(tools.some(t => t.name === 'Dust Collector'), 'has dust collector');
      cleanup(sys);
    });
  });

  describe('Safety Equipment', () => {
    it('getSafetyEquipment returns all items', () => {
      const sys = createSystem();
      const equip = sys.getSafetyEquipment();
      assertEqual(equip.length, 4);
      assert(equip.some(e => e.id === 'safety-glasses'), 'safety glasses');
      assert(equip.some(e => e.id === 'hearing-protection'), 'hearing protection');
      assert(equip.some(e => e.id === 'dust-mask'), 'dust mask');
      assert(equip.some(e => e.id === 'work-gloves'), 'work gloves');
      cleanup(sys);
    });

    it('getSafetyEquipmentStatus counts correctly', () => {
      const sys = createSystem();
      const status = sys.getSafetyEquipmentStatus();
      assertEqual(status.total, 4);
      assertEqual(status.available, 4);
      assertEqual(status.inUse, 0);
      assertEqual(status.needsReplacement, 0);
      cleanup(sys);
    });
  });

  describe('Safety Zones', () => {
    it('getSafetyZones returns all zones', () => {
      const sys = createSystem();
      const zones = sys.getSafetyZones();
      assertEqual(zones.length, 3);
      assert(zones.some(z => z.name === 'Power Tool Zone'), 'power tool zone');
      assert(zones.some(z => z.name === 'Hand Tool Zone'), 'hand tool zone');
      assert(zones.some(z => z.name === 'Finishing Zone'), 'finishing zone');
      cleanup(sys);
    });
  });

  describe('verifySafetyEquipment', () => {
    it('reports all present when equipment exists', () => {
      const sys = createSystem();
      const result = sys.verifySafetyEquipment(['safety-glasses', 'hearing-protection']);
      assertEqual(result.allPresent, true);
      assertEqual(result.present.length, 2);
      assertEqual(result.missing.length, 0);
      cleanup(sys);
    });

    it('reports missing equipment', () => {
      const sys = createSystem();
      const result = sys.verifySafetyEquipment(['safety-glasses', 'welding-mask']);
      assertEqual(result.allPresent, false);
      assertEqual(result.present.length, 1);
      assertEqual(result.missing.length, 1);
      assertEqual(result.missing[0], 'welding-mask');
      cleanup(sys);
    });
  });

  describe('performSafetyCheck', () => {
    it('returns safe when no issues', () => {
      const sys = createSystem();
      const result = sys.performSafetyCheck();
      assertEqual(result.safe, true);
      assertEqual(result.issues.length, 0);
      assertType(result.timestamp, 'number');
      cleanup(sys);
    });

    it('detects fire', () => {
      const sys = createSystem();
      sys.emergencyStatus.fireDetected = true;
      const result = sys.performSafetyCheck();
      assertEqual(result.safe, false);
      assert(result.issues.some(i => i.toLowerCase().includes('fire')), 'fire issue');
      cleanup(sys);
    });

    it('detects gas leak', () => {
      const sys = createSystem();
      sys.emergencyStatus.gasLeakDetected = true;
      const result = sys.performSafetyCheck();
      assertEqual(result.safe, false);
      assert(result.issues.some(i => i.toLowerCase().includes('gas')), 'gas issue');
      cleanup(sys);
    });

    it('detects high dust level', () => {
      const sys = createSystem();
      sys.environment.dustLevel = 150;
      const result = sys.performSafetyCheck();
      assertEqual(result.safe, false);
      assert(result.issues.some(i => i.toLowerCase().includes('dust')), 'dust issue');
      cleanup(sys);
    });

    it('detects high CO level', () => {
      const sys = createSystem();
      sys.environment.coLevel = 60;
      const result = sys.performSafetyCheck();
      assertEqual(result.safe, false);
      assert(result.issues.some(i => i.toLowerCase().includes('co')), 'CO issue');
      cleanup(sys);
    });
  });

  describe('requestToolActivation', () => {
    it('throws for unknown tool', async () => {
      const sys = createSystem();
      let threw = false;
      try {
        await sys.requestToolActivation('nonexistent');
      } catch (e) {
        threw = true;
        assert(e.message.toLowerCase().includes('not found'), 'mentions not found');
      }
      assert(threw, 'should throw');
      cleanup(sys);
    });

    it('throws during emergency stop', async () => {
      const sys = createSystem();
      sys.emergencyStatus.emergencyStopActivated = true;
      let threw = false;
      try {
        await sys.requestToolActivation('tool-001');
      } catch (e) {
        threw = true;
        assert(e.message.toLowerCase().includes('emergency'), 'mentions emergency');
      }
      assert(threw, 'should throw');
      cleanup(sys);
    });

    it('throws when power is cut off', async () => {
      const sys = createSystem();
      sys.emergencyStatus.powerCutOff = true;
      let threw = false;
      try {
        await sys.requestToolActivation('tool-001');
      } catch (e) {
        threw = true;
        assert(e.message.toLowerCase().includes('power'), 'mentions power');
      }
      assert(threw, 'should throw');
      cleanup(sys);
    });

    it('activates tool with safety checks relaxed', async () => {
      const sys = createSystem();
      sys.isQuietHours = () => false;
      sys.settings.requireSafetyEquipment = false;
      sys.settings.dustCollectionRequired = false;
      const result = await sys.requestToolActivation('tool-001');
      assertEqual(result.success, true);
      assertEqual(result.tool, 'Table Saw');
      assertEqual(sys.powerTools.get('tool-001').status, 'running');
      cleanup(sys);
    });
  });

  describe('deactivateTool', () => {
    it('deactivates running tool', async () => {
      const sys = createSystem();
      sys.isQuietHours = () => false;
      sys.settings.requireSafetyEquipment = false;
      sys.settings.dustCollectionRequired = false;
      await sys.requestToolActivation('tool-001');
      const result = await sys.deactivateTool('tool-001');
      assertEqual(result.success, true);
      assertEqual(result.tool, 'Table Saw');
      assertEqual(sys.powerTools.get('tool-001').status, 'off');
      cleanup(sys);
    });

    it('throws for unknown tool', async () => {
      const sys = createSystem();
      let threw = false;
      try {
        await sys.deactivateTool('nonexistent');
      } catch (e) {
        threw = true;
        assert(e.message.toLowerCase().includes('not found'), 'mentions not found');
      }
      assert(threw, 'should throw');
      cleanup(sys);
    });
  });

  describe('triggerEmergencyStop', () => {
    it('stops all tools and sets emergency status', async () => {
      const sys = createSystem();
      sys.isQuietHours = () => false;
      sys.settings.requireSafetyEquipment = false;
      sys.settings.dustCollectionRequired = false;
      await sys.requestToolActivation('tool-001');
      const result = await sys.triggerEmergencyStop('Test emergency');
      assertEqual(result.success, true);
      assertEqual(result.reason, 'Test emergency');
      assertEqual(sys.emergencyStatus.emergencyStopActivated, true);
      assertEqual(sys.emergencyStatus.powerCutOff, true);
      assertEqual(sys.powerTools.get('tool-001').status, 'emergency-stopped');
      assert(sys.safetyIncidents.length > 0, 'incident recorded');
      cleanup(sys);
    });
  });

  describe('resetEmergencyStop', () => {
    it('returns success when no emergency active', async () => {
      const sys = createSystem();
      const result = await sys.resetEmergencyStop();
      assertEqual(result.success, true);
      assert(result.message.includes('No emergency stop'), 'correct message');
      cleanup(sys);
    });
  });

  describe('getWorkshopStatus', () => {
    it('returns comprehensive workshop status', () => {
      const sys = createSystem();
      const status = sys.getWorkshopStatus();
      assertEqual(status.safe, true);
      assertEqual(status.emergencyStop, false);
      assertEqual(status.activeTools, 0);
      assertType(status.environment, 'object');
      assertType(status.safetyEquipmentStatus, 'object');
      assertType(status.recentIncidents, 'object');
      cleanup(sys);
    });
  });

  describe('checkMaintenanceRequired', () => {
    it('returns maintenance items array', () => {
      const sys = createSystem();
      const maint = sys.checkMaintenanceRequired();
      assertType(maint, 'object');
      cleanup(sys);
    });
  });

  describe('getWorkshopStatistics', () => {
    it('returns statistics with all sections', () => {
      const sys = createSystem();
      const stats = sys.getWorkshopStatistics();
      assertType(stats.tools, 'object');
      assertEqual(stats.tools.total, 4);
      assertEqual(stats.tools.active, 0);
      assertType(stats.usage, 'object');
      assertType(stats.safety, 'object');
      assertType(stats.environment, 'object');
      assertType(stats.projects, 'object');
      cleanup(sys);
    });
  });

  describe('Cache', () => {
    it('setCached and getCached round-trip', () => {
      const sys = createSystem();
      sys.setCached('test-key', { value: 42 });
      const cached = sys.getCached('test-key');
      assertEqual(cached.value, 42);
      cleanup(sys);
    });

    it('clearCache removes all entries', () => {
      const sys = createSystem();
      sys.setCached('k1', 'v1');
      sys.setCached('k2', 'v2');
      sys.clearCache();
      assertEqual(sys.getCached('k1'), null);
      assertEqual(sys.getCached('k2'), null);
      cleanup(sys);
    });
  });

  describe('isQuietHours', () => {
    it('returns a boolean', () => {
      const sys = createSystem();
      assertType(sys.isQuietHours(), 'boolean');
      cleanup(sys);
    });
  });

});

run();
