'use strict';

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertNotEqual, assertType } = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');

/* Timer leak prevention */
const _origSetTimeout = global.setTimeout;
const _origSetInterval = global.setInterval;
const activeHandles = [];
global.setTimeout = (...args) => { const id = _origSetTimeout(...args); activeHandles.push({ type: 'timeout', id }); return id; };
global.setInterval = (...args) => { const id = _origSetInterval(...args); activeHandles.push({ type: 'interval', id }); return id; };
function cleanup(sys) {
  try { sys.destroy(); } catch (_) {}
  while (activeHandles.length > 0) { const h = activeHandles.pop(); if (h.type === 'timeout') clearTimeout(h.id); else clearInterval(h.id); }
}

const SmartDisasterResilienceSystem = require('../lib/SmartDisasterResilienceSystem');

function createSystem() {
  const homey = createMockHomey({
    devices: {
      getDevice: async () => null,
      getDevices: async () => ({})
    }
  });
  const sys = new SmartDisasterResilienceSystem(homey);
  sys._delay = async () => {};
  return sys;
}

async function initSystem() {
  const sys = createSystem();
  await sys.initialize();
  return sys;
}

describe('SmartDisasterResilienceSystem', () => {

  describe('Constructor', () => {
    it('creates instance with default state', () => {
      const sys = createSystem();
      assertEqual(sys.initialized, false);
      assertEqual(sys.hazardTypes.length, 8);
      assertEqual(sys.supplies.size, 0);
      assertEqual(sys.familyMembers.size, 0);
      assertType(sys.backupPower, 'object');
      assertType(sys.evacuationPlan, 'object');
      assertType(sys.loadPriority, 'object');
      cleanup(sys);
    });
  });

  describe('initialize', () => {
    it('populates all data structures', async () => {
      const sys = await initSystem();
      assertEqual(sys.initialized, true);
      assert(sys.supplies.size > 0, 'supplies populated');
      assert(sys.familyMembers.size > 0, 'family populated');
      assert(sys.riskAssessment.size > 0, 'risks populated');
      assert(sys.vulnerablePipes.size > 0, 'pipes populated');
      assert(sys.communityNetwork.size > 0, 'community populated');
      assert(sys.recoveryChecklists.size > 0, 'checklists populated');
      cleanup(sys);
    });
  });

  describe('assessRisk', () => {
    it('returns null for unknown hazard type', async () => {
      const sys = await initSystem();
      const result = sys.assessRisk('alien_invasion');
      assertEqual(result, null);
      cleanup(sys);
    });

    it('returns risk assessment for valid hazard', async () => {
      const sys = await initSystem();
      const result = sys.assessRisk('flood');
      assertNotEqual(result, null);
      assertEqual(result.hazardType, 'flood');
      assertType(result.adjustedRisk, 'number');
      assert(['low', 'moderate', 'high', 'critical'].includes(result.riskCategory), 'valid category');
      assertType(result.assessedAt, 'string');
      cleanup(sys);
    });
  });

  describe('getOverallRiskLevel', () => {
    it('returns aggregated risk across all hazards', async () => {
      const sys = await initSystem();
      const result = sys.getOverallRiskLevel();
      assertType(result.overallRisk, 'number');
      assertEqual(result.hazardCount, 8);
      assert(['low', 'moderate', 'high', 'critical'].includes(result.category), 'valid category');
      assertType(result.highestRisk, 'object');
      assertType(result.lowestRisk, 'object');
      assertEqual(result.details.length, 8);
      cleanup(sys);
    });
  });

  describe('checkSupplyReadiness', () => {
    it('returns readiness percentage and status', async () => {
      const sys = await initSystem();
      const result = sys.checkSupplyReadiness();
      assertType(result.readinessPercentage, 'number');
      assertType(result.totalItems, 'number');
      assert(result.totalItems > 0, 'has items');
      assert(['good', 'fair', 'poor'].includes(result.status), 'valid status');
      assertType(result.checkedAt, 'string');
      cleanup(sys);
    });
  });

  describe('addSupply', () => {
    it('adds valid supply item', async () => {
      const sys = await initSystem();
      const result = sys.addSupply({ id: 'test-supply', name: 'Test Item', quantity: 5, unit: 'pcs', needed: 10 });
      assertEqual(result, true);
      assert(sys.supplies.has('test-supply'), 'supply in map');
      assertEqual(sys.supplies.get('test-supply').quantity, 5);
      cleanup(sys);
    });

    it('rejects supply without id', async () => {
      const sys = await initSystem();
      assertEqual(sys.addSupply({ name: 'No ID' }), false);
      cleanup(sys);
    });

    it('rejects supply without name', async () => {
      const sys = await initSystem();
      assertEqual(sys.addSupply({ id: 'no-name' }), false);
      cleanup(sys);
    });

    it('rejects null supply', async () => {
      const sys = await initSystem();
      assertEqual(sys.addSupply(null), false);
      cleanup(sys);
    });
  });

  describe('updateSupplyQuantity', () => {
    it('updates existing supply', async () => {
      const sys = await initSystem();
      const firstKey = [...sys.supplies.keys()][0];
      assertEqual(sys.updateSupplyQuantity(firstKey, 99), true);
      assertEqual(sys.supplies.get(firstKey).quantity, 99);
      cleanup(sys);
    });

    it('returns false for unknown supply', async () => {
      const sys = await initSystem();
      assertEqual(sys.updateSupplyQuantity('nonexistent', 5), false);
      cleanup(sys);
    });
  });

  describe('getExpiringSupplies', () => {
    it('finds expiring items', async () => {
      const sys = await initSystem();
      const firstKey = [...sys.supplies.keys()][0];
      const supply = sys.supplies.get(firstKey);
      supply.expiryDate = new Date(Date.now() + 5 * 86400000).toISOString();
      const result = sys.getExpiringSupplies(30);
      assert(result.length > 0, 'found expiring items');
      assertEqual(result[0].id, firstKey);
      assertType(result[0].daysUntilExpiry, 'number');
      cleanup(sys);
    });
  });

  describe('monitorBackupPower', () => {
    it('returns backup power status', async () => {
      const sys = await initSystem();
      const result = await sys.monitorBackupPower();
      assertType(result.status, 'object');
      assertType(result.status.ups, 'object');
      assertType(result.status.generator, 'object');
      assertType(result.status.solar, 'object');
      assertType(result.alerts, 'object');
      assertType(result.checkedAt, 'string');
      cleanup(sys);
    });
  });

  describe('initiateEvacuation', () => {
    it('sends evacuation notifications', async () => {
      const sys = await initSystem();
      const result = await sys.initiateEvacuation('Test emergency');
      assertEqual(result.reason, 'Test emergency');
      assertEqual(result.status, 'active');
      assert(result.notifications.length > 0, 'notifications sent');
      assertType(result.primaryRoute, 'object');
      assertType(result.meetingPoint, 'object');
      assert(sys.activeAlerts.length > 0, 'alert recorded');
      cleanup(sys);
    });
  });

  describe('sendCheckInRequest', () => {
    it('sends requests to family members', async () => {
      const sys = await initSystem();
      const result = await sys.sendCheckInRequest();
      assert(result.requests.length > 0, 'has requests');
      assertType(result.totalSent, 'number');
      assertType(result.sentAt, 'string');
      cleanup(sys);
    });
  });

  describe('recordCheckIn', () => {
    it('records valid check-in for known member', async () => {
      const sys = await initSystem();
      const firstMember = [...sys.familyMembers.keys()][0];
      assertEqual(sys.recordCheckIn(firstMember, 'safe'), true);
      assertEqual(sys.familyMembers.get(firstMember).status, 'safe');
      cleanup(sys);
    });

    it('returns false for unknown member', async () => {
      const sys = await initSystem();
      assertEqual(sys.recordCheckIn('nonexistent', 'safe'), false);
      cleanup(sys);
    });

    it('returns false for invalid status', async () => {
      const sys = await initSystem();
      const firstMember = [...sys.familyMembers.keys()][0];
      assertEqual(sys.recordCheckIn(firstMember, 'unknown_status'), false);
      cleanup(sys);
    });
  });

  describe('getCheckInStatus', () => {
    it('returns family check-in summary', async () => {
      const sys = await initSystem();
      const result = sys.getCheckInStatus();
      assertEqual(result.totalMembers, sys.familyMembers.size);
      assertType(result.allAccountedFor, 'boolean');
      assertType(result.accountedFor, 'number');
      assert(result.members.length > 0, 'has member entries');
      cleanup(sys);
    });
  });

  describe('updateInsuranceDoc', () => {
    it('adds room inventory', async () => {
      const sys = await initSystem();
      const items = [
        { name: 'TV', estimatedValue: 5000, category: 'electronics' },
        { name: 'Sofa', estimatedValue: 8000, category: 'furniture' }
      ];
      assertEqual(sys.updateInsuranceDoc('living_room', items), true);
      assert(sys.inventoryDocs.has('living_room'), 'doc added');
      assertEqual(sys.inventoryDocs.get('living_room').items.length, 2);
      cleanup(sys);
    });

    it('rejects invalid input', async () => {
      const sys = await initSystem();
      assertEqual(sys.updateInsuranceDoc(null, []), false);
      assertEqual(sys.updateInsuranceDoc('room', null), false);
      assertEqual(sys.updateInsuranceDoc('room', 'not-array'), false);
      cleanup(sys);
    });
  });

  describe('getInsuranceSummary', () => {
    it('returns totals after adding docs', async () => {
      const sys = await initSystem();
      sys.updateInsuranceDoc('room1', [{ name: 'Item1', estimatedValue: 1000 }]);
      sys.updateInsuranceDoc('room2', [{ name: 'Item2', estimatedValue: 2000 }]);
      const result = sys.getInsuranceSummary();
      assertEqual(result.totalRooms, 2);
      assertEqual(result.totalItems, 2);
      assertEqual(result.totalEstimatedValue, 3000);
      cleanup(sys);
    });
  });

  describe('autoTransferToGenerator', () => {
    it('transfers power to generator', async () => {
      const sys = await initSystem();
      const result = await sys.autoTransferToGenerator();
      assertEqual(result.success, true);
      assertEqual(result.generatorStatus, 'running');
      assertType(result.estimatedRuntimeHours, 'number');
      assert(result.transferLog.length > 0, 'has transfer log');
      cleanup(sys);
    });

    it('fails with insufficient fuel', async () => {
      const sys = await initSystem();
      sys.backupPower.generator.fuel_liters = 2;
      const result = await sys.autoTransferToGenerator();
      assertEqual(result.success, false);
      assertEqual(result.reason, 'Insufficient fuel');
      cleanup(sys);
    });
  });

  describe('shedLoad', () => {
    it('sheds valid tier', async () => {
      const sys = await initSystem();
      const result = await sys.shedLoad('non_essential');
      assertEqual(result.tier, 'non_essential');
      assertType(result.devicesShed, 'number');
      assert(result.devices.length > 0, 'has shed devices');
      cleanup(sys);
    });

    it('returns false for invalid tier', async () => {
      const sys = await initSystem();
      assertEqual(await sys.shedLoad('invalid_tier'), false);
      cleanup(sys);
    });
  });

  describe('requestHelp', () => {
    it('finds community matches for resource', async () => {
      const sys = await initSystem();
      const result = await sys.requestHelp('generator');
      assertEqual(result.resourceRequested, 'generator');
      assertType(result.matchesFound, 'number');
      assertType(result.requestedAt, 'string');
      cleanup(sys);
    });
  });

  describe('offerHelp', () => {
    it('creates help offer', async () => {
      const sys = await initSystem();
      const result = sys.offerHelp('water', 10);
      assertEqual(result.offer.resource, 'water');
      assertEqual(result.offer.quantity, 10);
      assertEqual(result.offer.status, 'available');
      assert(result.notifiedNeighbors.length > 0, 'neighbors notified');
      cleanup(sys);
    });
  });

  describe('getRecoveryChecklist', () => {
    it('returns checklist for valid event type', async () => {
      const sys = await initSystem();
      const result = sys.getRecoveryChecklist('flood');
      assertNotEqual(result, null);
      assertEqual(result.eventType, 'flood');
      assert(result.totalSteps > 0, 'has steps');
      assertEqual(result.completedSteps, 0);
      cleanup(sys);
    });

    it('returns null for unknown event type', async () => {
      const sys = await initSystem();
      assertEqual(sys.getRecoveryChecklist('alien_attack'), null);
      cleanup(sys);
    });
  });

  describe('completeRecoveryStep', () => {
    it('marks step as completed', async () => {
      const sys = await initSystem();
      assertEqual(sys.completeRecoveryStep('flood', 0), true);
      const cl = sys.getRecoveryChecklist('flood');
      assertEqual(cl.completedSteps, 1);
      cleanup(sys);
    });

    it('returns false for invalid event type', async () => {
      const sys = await initSystem();
      assertEqual(sys.completeRecoveryStep('unknown', 0), false);
      cleanup(sys);
    });

    it('returns false for out-of-range step', async () => {
      const sys = await initSystem();
      assertEqual(sys.completeRecoveryStep('flood', 999), false);
      cleanup(sys);
    });
  });

  describe('getSeasonalChecklist', () => {
    it('returns winter checklist', async () => {
      const sys = await initSystem();
      const result = sys.getSeasonalChecklist('winter');
      assertNotEqual(result, null);
      assertEqual(result.season, 'winter');
      assert(result.totalTasks > 0, 'has tasks');
      assert(result.highPriority > 0, 'has high priority');
      cleanup(sys);
    });

    it('returns null for invalid season', async () => {
      const sys = await initSystem();
      assertEqual(sys.getSeasonalChecklist('monsoon'), null);
      cleanup(sys);
    });
  });

  describe('scheduleDrill', () => {
    it('creates scheduled drill', async () => {
      const sys = await initSystem();
      const date = new Date(Date.now() + 7 * 86400000).toISOString();
      const result = sys.scheduleDrill('fire_evacuation', date);
      assertNotEqual(result, false);
      assertEqual(result.type, 'fire_evacuation');
      assertEqual(result.status, 'scheduled');
      assertType(result.id, 'string');
      cleanup(sys);
    });

    it('rejects invalid drill type', async () => {
      const sys = await initSystem();
      assertEqual(sys.scheduleDrill('invalid_drill', new Date().toISOString()), false);
      cleanup(sys);
    });

    it('rejects invalid date', async () => {
      const sys = await initSystem();
      assertEqual(sys.scheduleDrill('fire_evacuation', 'not-a-date'), false);
      cleanup(sys);
    });
  });

  describe('conductDrill', () => {
    it('executes drill and returns result', async () => {
      const sys = await initSystem();
      const result = await sys.conductDrill('fire_evacuation');
      assertNotEqual(result, null);
      assertEqual(result.type, 'fire_evacuation');
      assertType(result.score, 'number');
      assert(result.score >= 0 && result.score <= 100, 'score in range');
      assert(['A', 'B', 'C', 'D', 'F'].includes(result.grade), 'valid grade');
      assert(result.stepsCompleted > 0, 'steps completed');
      cleanup(sys);
    });

    it('returns null for unknown drill type', async () => {
      const sys = await initSystem();
      assertEqual(await sys.conductDrill('unknown_drill'), null);
      cleanup(sys);
    });
  });

  describe('calculateReadinessScore', () => {
    it('returns readiness with breakdown', async () => {
      const sys = await initSystem();
      const result = sys.calculateReadinessScore();
      assertType(result.overallScore, 'number');
      assert(result.overallScore >= 0 && result.overallScore <= 100, 'in range');
      assert(['A', 'B', 'C', 'D', 'F'].includes(result.grade), 'valid grade');
      assertType(result.breakdown, 'object');
      assertType(result.breakdown.supplies, 'object');
      assertType(result.breakdown.backupPower, 'object');
      assertType(result.breakdown.plans, 'object');
      assertType(result.recommendations, 'object');
      cleanup(sys);
    });
  });

  describe('getStatistics', () => {
    it('returns comprehensive statistics', async () => {
      const sys = await initSystem();
      const stats = sys.getStatistics();
      assertEqual(stats.system, 'SmartDisasterResilienceSystem');
      assertEqual(stats.initialized, true);
      assertType(stats.readinessScore, 'number');
      assertType(stats.readinessGrade, 'string');
      assertType(stats.overallRisk, 'number');
      assertEqual(stats.hazardTypes, 8);
      assert(stats.supplyItems > 0, 'has supply items');
      assert(stats.familyMembers > 0, 'has family members');
      assertType(stats.backupPower, 'object');
      assertType(stats.timestamp, 'string');
      cleanup(sys);
    });
  });

  describe('destroy', () => {
    it('clears all state', async () => {
      const sys = await initSystem();
      await sys.destroy();
      assertEqual(sys.initialized, false);
      assertEqual(sys.supplies.size, 0);
      assertEqual(sys.familyMembers.size, 0);
      assertEqual(sys.riskAssessment.size, 0);
      assertEqual(sys.drillHistory.length, 0);
      assertEqual(sys.activeAlerts.length, 0);
      cleanup(sys);
    });
  });

});

run();
