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
  try { if (sys && typeof sys.destroy === 'function') sys.destroy(); } catch (_) { /* ignore */ }
  while (activeHandles.length > 0) {
    const h = activeHandles.pop();
    if (h.type === 'timeout') clearTimeout(h.id); else clearInterval(h.id);
  }
}

/* ── helpers ────────────────────────────────────────────────────────── */
const SmartEVChargingManagementSystem = require('../lib/SmartEVChargingManagementSystem');

function createInitialized() {
  const homey = createMockHomey();
  const sys = new SmartEVChargingManagementSystem(homey);
  sys.initialize();
  return sys;
}

function addTestVehicle(sys, overrides) {
  return sys.addVehicle({
    id: 'v1',
    name: 'Test EV',
    make: 'Tesla',
    model: 'Model 3',
    batteryCapacityKwh: 60,
    currentSoC: 50,
    maxChargeRateKw: 11,
    ...overrides,
  });
}

/* ════════════════════════════════════════════════════════════════════ */
/*  TESTS                                                              */
/* ════════════════════════════════════════════════════════════════════ */

describe('SmartEVChargingManagementSystem', () => {

  // ── constructor ──────────────────────────────────────────────────

  describe('constructor', () => {
    it('creates instance with expected defaults', () => {
      const sys = new SmartEVChargingManagementSystem(createMockHomey());
      try {
        assertEqual(sys.maxStations, 4);
        assertEqual(sys.maxVehicles, 6);
        assertEqual(sys.defaultTargetSoC, 80);
        assertEqual(sys.offPeakWindow.start, 22);
        assertEqual(sys.offPeakWindow.end, 6);
        assertEqual(sys.loadBalancing.circuitBreakerLimit, 32);
        assertEqual(sys.solarConfig.enabled, true);
      } finally { cleanup(sys); }
    });
  });

  // ── initialize / destroy ─────────────────────────────────────────

  describe('initialize', () => {
    it('sets up default charging stations', () => {
      const sys = createInitialized();
      try {
        assertEqual(sys.chargingStations.size, 4);
        assert(sys.chargingStations.has('garage'), 'garage station should exist');
        assert(sys.chargingStations.has('driveway'), 'driveway station should exist');
        assertEqual(sys.chargingStations.get('garage').enabled, true);
        assertEqual(sys.chargingStations.get('driveway').enabled, false);
      } finally { cleanup(sys); }
    });

    it('initializes maintenance records', () => {
      const sys = createInitialized();
      try {
        assertEqual(sys.maintenanceRecords.size, 4);
        const garageRec = sys.maintenanceRecords.get('garage');
        assertEqual(garageRec.cableCondition, 'good');
        assertEqual(garageRec.groundFaultTestPassed, true);
      } finally { cleanup(sys); }
    });

    it('starts monitoring timer', () => {
      const sys = createInitialized();
      try {
        assert(sys.monitoringTimer !== null, 'monitoring timer should run');
      } finally { cleanup(sys); }
    });
  });

  describe('destroy', () => {
    it('clears monitoring timer and data', () => {
      const sys = createInitialized();
      sys.destroy();
      try {
        assertEqual(sys.monitoringTimer, null);
        assertEqual(sys.activeSessions.size, 0);
        assertEqual(sys.chargingStations.size, 0);
      } finally { cleanup(sys); }
    });
  });

  // ── Station Management ───────────────────────────────────────────

  describe('configureStation', () => {
    it('updates station config', () => {
      const sys = createInitialized();
      try {
        const station = sys.configureStation('garage', { type: 'DC Fast', maxPowerKw: 22, phase: 'L2' });
        assertEqual(station.type, 'DC Fast');
        assertEqual(station.maxPowerKw, 22);
        assertEqual(station.phase, 'L2');
      } finally { cleanup(sys); }
    });

    it('returns null for unknown station', () => {
      const sys = createInitialized();
      try {
        assertEqual(sys.configureStation('nonexistent', {}), null);
      } finally { cleanup(sys); }
    });

    it('ignores invalid charger type', () => {
      const sys = createInitialized();
      try {
        const station = sys.configureStation('garage', { type: 'Level 99' });
        assertEqual(station.type, 'Level 2');
      } finally { cleanup(sys); }
    });
  });

  describe('getStationStatus', () => {
    it('returns station with maintenance info', () => {
      const sys = createInitialized();
      try {
        const status = sys.getStationStatus('garage');
        assertEqual(status.id, 'garage');
        assert(status.maintenance !== null, 'should include maintenance');
      } finally { cleanup(sys); }
    });

    it('returns null for unknown station', () => {
      const sys = createInitialized();
      try {
        assertEqual(sys.getStationStatus('phantom'), null);
      } finally { cleanup(sys); }
    });
  });

  describe('getAllStations', () => {
    it('returns array of all 4 stations', () => {
      const sys = createInitialized();
      try {
        const all = sys.getAllStations();
        assertEqual(all.length, 4);
        assert(all.some(s => s.id === 'garage'), 'should include garage');
      } finally { cleanup(sys); }
    });
  });

  // ── Vehicle Management ───────────────────────────────────────────

  describe('addVehicle', () => {
    it('adds a vehicle profile', () => {
      const sys = createInitialized();
      try {
        const v = addTestVehicle(sys);
        assertEqual(v.name, 'Test EV');
        assertEqual(v.batteryCapacityKwh, 60);
        assertEqual(sys.vehicleProfiles.size, 1);
        assert(sys.batteryHealth.has('v1'), 'battery health initialized');
      } finally { cleanup(sys); }
    });

    it('enforces max vehicle limit', () => {
      const sys = createInitialized();
      try {
        for (let i = 0; i < 6; i++) addTestVehicle(sys, { id: `v${i}` });
        const extra = addTestVehicle(sys, { id: 'v99' });
        assertEqual(extra, null);
        assertEqual(sys.vehicleProfiles.size, 6);
      } finally { cleanup(sys); }
    });
  });

  describe('updateVehicle', () => {
    it('updates allowed fields', () => {
      const sys = createInitialized();
      addTestVehicle(sys);
      try {
        const v = sys.updateVehicle('v1', { name: 'Updated EV', currentSoC: 75 });
        assertEqual(v.name, 'Updated EV');
        assertEqual(v.currentSoC, 75);
      } finally { cleanup(sys); }
    });

    it('returns null for unknown vehicle', () => {
      const sys = createInitialized();
      try {
        assertEqual(sys.updateVehicle('ghost', {}), null);
      } finally { cleanup(sys); }
    });
  });

  describe('removeVehicle', () => {
    it('removes vehicle and battery health', () => {
      const sys = createInitialized();
      addTestVehicle(sys);
      try {
        assertEqual(sys.removeVehicle('v1'), true);
        assertEqual(sys.vehicleProfiles.size, 0);
        assertEqual(sys.batteryHealth.has('v1'), false);
      } finally { cleanup(sys); }
    });

    it('returns false for unknown vehicle', () => {
      const sys = createInitialized();
      try {
        assertEqual(sys.removeVehicle('ghost'), false);
      } finally { cleanup(sys); }
    });
  });

  describe('getVehicle / getAllVehicles', () => {
    it('returns vehicle or null', () => {
      const sys = createInitialized();
      addTestVehicle(sys);
      try {
        assertEqual(sys.getVehicle('v1').name, 'Test EV');
        assertEqual(sys.getVehicle('ghost'), null);
      } finally { cleanup(sys); }
    });

    it('getAllVehicles lists all', () => {
      const sys = createInitialized();
      addTestVehicle(sys, { id: 'a' });
      addTestVehicle(sys, { id: 'b' });
      try {
        assertEqual(sys.getAllVehicles().length, 2);
      } finally { cleanup(sys); }
    });
  });

  // ── Charging Sessions ────────────────────────────────────────────

  describe('startChargingSession', () => {
    it('starts a charging session', () => {
      const sys = createInitialized();
      addTestVehicle(sys);
      try {
        const session = sys.startChargingSession('garage', 'v1', 80, 'grid');
        assert(session !== null, 'session should be created');
        assertEqual(session.status, 'charging');
        assertEqual(session.targetSoC, 80);
        assertEqual(sys.chargingStations.get('garage').status, 'charging');
        assertEqual(sys.chargingStations.get('garage').cableLocked, true);
      } finally { cleanup(sys); }
    });

    it('returns null if station not found', () => {
      const sys = createInitialized();
      addTestVehicle(sys);
      try {
        assertEqual(sys.startChargingSession('phantom', 'v1', 80), null);
      } finally { cleanup(sys); }
    });

    it('returns null if vehicle not found', () => {
      const sys = createInitialized();
      try {
        assertEqual(sys.startChargingSession('garage', 'ghost', 80), null);
      } finally { cleanup(sys); }
    });

    it('returns null if station already charging', () => {
      const sys = createInitialized();
      addTestVehicle(sys, { id: 'v1' });
      addTestVehicle(sys, { id: 'v2', currentSoC: 30 });
      try {
        sys.startChargingSession('garage', 'v1', 80, 'grid');
        assertEqual(sys.startChargingSession('garage', 'v2', 80, 'grid'), null);
      } finally { cleanup(sys); }
    });

    it('returns null if soc already at target', () => {
      const sys = createInitialized();
      addTestVehicle(sys, { currentSoC: 90 });
      try {
        assertEqual(sys.startChargingSession('garage', 'v1', 80), null);
      } finally { cleanup(sys); }
    });

    it('returns null during emergency stop', () => {
      const sys = createInitialized();
      addTestVehicle(sys);
      sys.emergencyState.emergencyStopActive = true;
      try {
        assertEqual(sys.startChargingSession('garage', 'v1', 80), null);
      } finally { cleanup(sys); }
    });

    it('increments contactor cycle count', () => {
      const sys = createInitialized();
      addTestVehicle(sys);
      try {
        sys.startChargingSession('garage', 'v1', 80, 'grid');
        assertEqual(sys.contactorCycles.get('garage'), 1);
      } finally { cleanup(sys); }
    });
  });

  describe('stopChargingSession', () => {
    it('stops active session', () => {
      const sys = createInitialized();
      addTestVehicle(sys);
      try {
        const session = sys.startChargingSession('garage', 'v1', 80, 'grid');
        const stopped = sys.stopChargingSession(session.sessionId);
        assertEqual(stopped.status, 'stopped');
        assertEqual(sys.chargingStations.get('garage').status, 'available');
        assertEqual(sys.chargingStations.get('garage').cableLocked, false);
      } finally { cleanup(sys); }
    });

    it('returns null for unknown session', () => {
      const sys = createInitialized();
      try {
        assertEqual(sys.stopChargingSession('fake'), null);
      } finally { cleanup(sys); }
    });
  });

  // ── Battery Health ───────────────────────────────────────────────

  describe('getBatteryHealth', () => {
    it('returns health data for known vehicle', () => {
      const sys = createInitialized();
      addTestVehicle(sys);
      try {
        const health = sys.getBatteryHealth('v1');
        assertEqual(health.healthScore, 100);
        assertEqual(health.chargeCycles, 0);
      } finally { cleanup(sys); }
    });

    it('returns null for unknown vehicle', () => {
      const sys = createInitialized();
      try {
        assertEqual(sys.getBatteryHealth('ghost'), null);
      } finally { cleanup(sys); }
    });
  });

  // ── Solar Charging ───────────────────────────────────────────────

  describe('evaluateSolarCharging', () => {
    it('returns solar evaluation', () => {
      const sys = createInitialized();
      try {
        sys.solarConfig.currentProductionKw = 8;
        sys.solarConfig.houseConsumptionKw = 2;
        const result = sys.evaluateSolarCharging();
        assertEqual(result.solarProductionKw, 8);
        assertEqual(result.houseConsumptionKw, 2);
        assertEqual(result.excessKw, 5); // 8 - 2 - 1 (threshold)
        assertEqual(result.canCharge, true);
      } finally { cleanup(sys); }
    });

    it('returns null when solar disabled', () => {
      const sys = createInitialized();
      sys.solarConfig.enabled = false;
      try {
        assertEqual(sys.evaluateSolarCharging(), null);
      } finally { cleanup(sys); }
    });
  });

  describe('updateSolarData', () => {
    it('updates solar production and consumption', () => {
      const sys = createInitialized();
      try {
        sys.updateSolarData(5.5, 1.2);
        assertEqual(sys.solarConfig.currentProductionKw, 5.5);
        assertEqual(sys.solarConfig.houseConsumptionKw, 1.2);
      } finally { cleanup(sys); }
    });
  });

  // ── Scheduling ───────────────────────────────────────────────────

  describe('createSchedule', () => {
    it('creates a schedule', () => {
      const sys = createInitialized();
      try {
        const sched = sys.createSchedule({ vehicleId: 'v1', departureTime: '08:00', targetSoC: 90 });
        assert(sched.id.startsWith('sched_'), 'id should be prefixed');
        assertEqual(sched.targetSoC, 90);
        assertEqual(sched.enabled, true);
        assertEqual(sched.active, false);
      } finally { cleanup(sys); }
    });
  });

  describe('updateSchedule', () => {
    it('updates allowed fields', () => {
      const sys = createInitialized();
      try {
        const sched = sys.createSchedule({ vehicleId: 'v1' });
        const updated = sys.updateSchedule(sched.id, { targetSoC: 95, departureTime: '06:30' });
        assertEqual(updated.targetSoC, 95);
        assertEqual(updated.departureTime, '06:30');
      } finally { cleanup(sys); }
    });

    it('returns null for unknown schedule', () => {
      const sys = createInitialized();
      try {
        assertEqual(sys.updateSchedule('ghost', {}), null);
      } finally { cleanup(sys); }
    });
  });

  describe('deleteSchedule', () => {
    it('deletes existing schedule', () => {
      const sys = createInitialized();
      try {
        const sched = sys.createSchedule({ vehicleId: 'v1' });
        assertEqual(sys.deleteSchedule(sched.id), true);
        assertEqual(sys.schedules.size, 0);
      } finally { cleanup(sys); }
    });
  });

  describe('getSchedules', () => {
    it('returns all schedules when no filter', () => {
      const sys = createInitialized();
      try {
        sys.createSchedule({ id: 'sA', vehicleId: 'v1' });
        sys.createSchedule({ id: 'sB', vehicleId: 'v2' });
        assertEqual(sys.getSchedules().length, 2);
      } finally { cleanup(sys); }
    });

    it('filters by vehicleId', () => {
      const sys = createInitialized();
      try {
        sys.createSchedule({ id: 'sX', vehicleId: 'v1' });
        sys.createSchedule({ id: 'sY', vehicleId: 'v2' });
        assertEqual(sys.getSchedules('v1').length, 1);
      } finally { cleanup(sys); }
    });
  });

  // ── Load Balancing ───────────────────────────────────────────────

  describe('setCircuitBreakerLimit', () => {
    it('accepts valid breaker limits', () => {
      const sys = createInitialized();
      try {
        assertEqual(sys.setCircuitBreakerLimit(63), true);
        assertEqual(sys.loadBalancing.circuitBreakerLimit, 63);
      } finally { cleanup(sys); }
    });

    it('rejects invalid limits', () => {
      const sys = createInitialized();
      try {
        assertEqual(sys.setCircuitBreakerLimit(50), false);
        assertEqual(sys.loadBalancing.circuitBreakerLimit, 32);
      } finally { cleanup(sys); }
    });
  });

  describe('registerHighPowerAppliance', () => {
    it('registers appliance with amperage', () => {
      const sys = createInitialized();
      try {
        sys.registerHighPowerAppliance('oven', 16);
        assertEqual(sys.loadBalancing.highPowerAppliances.get('oven'), 16);
      } finally { cleanup(sys); }
    });
  });

  describe('unregisterHighPowerAppliance', () => {
    it('removes appliance', () => {
      const sys = createInitialized();
      try {
        sys.registerHighPowerAppliance('oven', 16);
        sys.unregisterHighPowerAppliance('oven');
        assertEqual(sys.loadBalancing.highPowerAppliances.has('oven'), false);
      } finally { cleanup(sys); }
    });
  });

  describe('getLoadStatus', () => {
    it('returns current load status', () => {
      const sys = createInitialized();
      try {
        const status = sys.getLoadStatus();
        assertEqual(status.circuitBreakerLimitA, 32);
        assertType(status.totalChargingA, 'number');
        assertType(status.availableA, 'number');
      } finally { cleanup(sys); }
    });
  });

  describe('setPriorityMode', () => {
    it('sets valid mode', () => {
      const sys = createInitialized();
      try {
        assertEqual(sys.setPriorityMode('earliest_departure'), true);
        assertEqual(sys.loadBalancing.priorityMode, 'earliest_departure');
      } finally { cleanup(sys); }
    });

    it('rejects invalid mode', () => {
      const sys = createInitialized();
      try {
        assertEqual(sys.setPriorityMode('random'), false);
      } finally { cleanup(sys); }
    });
  });

  // ── Cost Optimization ────────────────────────────────────────────

  describe('setSpotPrices', () => {
    it('sets hourly spot prices', () => {
      const sys = createInitialized();
      try {
        const prices = [{ hour: 0, price: 0.05 }, { hour: 12, price: 0.30 }];
        sys.setSpotPrices(prices);
        assertEqual(sys.costConfig.spotPrices.length, 2);
      } finally { cleanup(sys); }
    });
  });

  describe('getCheapestHours', () => {
    it('returns cheapest hours sorted by price', () => {
      const sys = createInitialized();
      try {
        sys.setSpotPrices([
          { hour: 0, price: 0.05 }, { hour: 6, price: 0.15 },
          { hour: 12, price: 0.30 }, { hour: 18, price: 0.25 },
        ]);
        const cheapest = sys.getCheapestHours(2);
        assertEqual(cheapest.length, 2);
        assertEqual(cheapest[0].price, 0.05);
        assertEqual(cheapest[1].price, 0.15);
      } finally { cleanup(sys); }
    });
  });

  describe('getCostComparison', () => {
    it('compares home vs public vs petrol cost', () => {
      const sys = createInitialized();
      try {
        const cmp = sys.getCostComparison(30);
        assertType(cmp.homeChargingCost, 'number');
        assertType(cmp.publicChargingCost, 'number');
        assertType(cmp.petrolEquivalentCost, 'number');
        assertType(cmp.savingsVsPublic, 'number');
        assertType(cmp.savingsVsPetrol, 'number');
        assertEqual(cmp.currency, 'EUR');
      } finally { cleanup(sys); }
    });
  });

  describe('getDailyCost / getWeeklyCost / getMonthlyCost', () => {
    it('returns default zero cost objects', () => {
      const sys = createInitialized();
      try {
        assertEqual(sys.getDailyCost().totalCost, 0);
        assertEqual(sys.getWeeklyCost().totalCost, 0);
        assertEqual(sys.getMonthlyCost().totalCost, 0);
      } finally { cleanup(sys); }
    });
  });

  // ── Pre-conditioning ─────────────────────────────────────────────

  describe('schedulePreConditioning', () => {
    it('creates a pre-conditioning schedule', () => {
      const sys = createInitialized();
      addTestVehicle(sys);
      try {
        const sched = sys.schedulePreConditioning('v1', { mode: 'defrost', departureTime: '07:30' });
        assert(sched.id.startsWith('precond_'), 'should be prefixed');
        assertEqual(sched.mode, 'defrost');
        assertEqual(sched.departureTime, '07:30');
      } finally { cleanup(sys); }
    });

    it('returns null for unknown vehicle', () => {
      const sys = createInitialized();
      try {
        assertEqual(sys.schedulePreConditioning('ghost', {}), null);
      } finally { cleanup(sys); }
    });
  });

  describe('evaluatePreConditioningRecommendation', () => {
    it('recommends preheat in cold weather', () => {
      const sys = createInitialized();
      sys.weatherData.temperatureC = -5;
      try {
        const recs = sys.evaluatePreConditioningRecommendation('v1');
        assert(recs.length > 0, 'should have recommendations');
        assert(recs.some(r => r.mode === 'winter_preheat'), 'should recommend preheat');
        assert(recs.some(r => r.mode === 'defrost'), 'should recommend defrost');
      } finally { cleanup(sys); }
    });

    it('recommends precool in hot weather', () => {
      const sys = createInitialized();
      sys.weatherData.temperatureC = 35;
      try {
        const recs = sys.evaluatePreConditioningRecommendation('v1');
        assert(recs.some(r => r.mode === 'summer_precool'), 'should recommend precool');
      } finally { cleanup(sys); }
    });

    it('returns empty in mild weather', () => {
      const sys = createInitialized();
      sys.weatherData.temperatureC = 20;
      try {
        assertEqual(sys.evaluatePreConditioningRecommendation('v1').length, 0);
      } finally { cleanup(sys); }
    });
  });

  // ── Trip Planning ────────────────────────────────────────────────

  describe('planTrip', () => {
    it('creates a trip plan', () => {
      const sys = createInitialized();
      addTestVehicle(sys);
      try {
        const plan = sys.planTrip('v1', { distanceKm: 200, destination: 'Gothenburg' });
        assertEqual(plan.destination, 'Gothenburg');
        assertEqual(plan.distanceKm, 200);
        assertType(plan.kwhRequired, 'number');
        assertType(plan.targetSoC, 'number');
        assertType(plan.needsCharging, 'boolean');
        assert(plan.rangeAnxietyCheck === 'safe' || plan.rangeAnxietyCheck === 'charge_recommended');
      } finally { cleanup(sys); }
    });

    it('returns null for unknown vehicle', () => {
      const sys = createInitialized();
      try {
        assertEqual(sys.planTrip('ghost', { distanceKm: 100 }), null);
      } finally { cleanup(sys); }
    });
  });

  // ── Energy Statistics ────────────────────────────────────────────

  describe('getOverallEnergyStats', () => {
    it('returns initial zero stats', () => {
      const sys = createInitialized();
      try {
        const stats = sys.getOverallEnergyStats();
        assertEqual(stats.totalKwhCharged, 0);
        assertEqual(stats.solarKwhCharged, 0);
        assertEqual(stats.co2SavedKg, 0);
      } finally { cleanup(sys); }
    });
  });

  describe('getEnergyStatsSummary', () => {
    it('returns null for invalid period', () => {
      const sys = createInitialized();
      try {
        assertEqual(sys.getEnergyStatsSummary('hourly'), null);
      } finally { cleanup(sys); }
    });

    it('returns entries for daily period', () => {
      const sys = createInitialized();
      try {
        const entries = sys.getEnergyStatsSummary('daily');
        assertType(entries, 'object');
        assert(entries.length >= 1, 'should have at least today bucket');
      } finally { cleanup(sys); }
    });
  });

  // ── Guest Charging ───────────────────────────────────────────────

  describe('startGuestSession', () => {
    it('starts a guest session', () => {
      const sys = createInitialized();
      sys.configureStation('guest', { enabled: true });
      try {
        const session = sys.startGuestSession({ stationId: 'guest', guestName: 'Bob' });
        assert(session !== null, 'session should start');
        assertEqual(session.guestName, 'Bob');
        assertEqual(session.status, 'charging');
        assertEqual(sys.chargingStations.get('guest').status, 'charging');
      } finally { cleanup(sys); }
    });

    it('returns null if station not available', () => {
      const sys = createInitialized();
      sys.startGuestSession({ stationId: 'guest' });
      try {
        assertEqual(sys.startGuestSession({ stationId: 'guest' }), null);
      } finally { cleanup(sys); }
    });
  });

  describe('stopGuestSession', () => {
    it('stops a guest session and calculates cost', () => {
      const sys = createInitialized();
      try {
        const session = sys.startGuestSession({ stationId: 'guest' });
        const stopped = sys.stopGuestSession(session.sessionId);
        assertEqual(stopped.status, 'completed');
        assertType(stopped.kwhDelivered, 'number');
        assertType(stopped.cost, 'number');
        assertEqual(sys.chargingStations.get('guest').status, 'available');
      } finally { cleanup(sys); }
    });

    it('returns null for unknown session', () => {
      const sys = createInitialized();
      try {
        assertEqual(sys.stopGuestSession('fake'), null);
      } finally { cleanup(sys); }
    });
  });

  // ── Grid Services ────────────────────────────────────────────────

  describe('configureGridServices', () => {
    it('configures v2h and demand response', () => {
      const sys = createInitialized();
      try {
        const result = sys.configureGridServices({
          v2hEnabled: true,
          demandResponseParticipation: true,
          v2hMinSoC: 20,
        });
        assertEqual(result.v2hEnabled, true);
        assertEqual(result.demandResponseParticipation, true);
        assertEqual(result.v2hMinSoC, 20);
      } finally { cleanup(sys); }
    });
  });

  describe('activateV2H', () => {
    it('activates vehicle-to-home', () => {
      const sys = createInitialized();
      addTestVehicle(sys, { currentSoC: 80 });
      sys.configureGridServices({ v2hEnabled: true });
      try {
        const result = sys.activateV2H('v1', 5);
        assert(result !== null, 'v2h should activate');
        assertEqual(result.status, 'active');
        assertType(result.availableKwh, 'number');
      } finally { cleanup(sys); }
    });

    it('returns null when v2h disabled', () => {
      const sys = createInitialized();
      addTestVehicle(sys);
      try {
        assertEqual(sys.activateV2H('v1', 5), null);
      } finally { cleanup(sys); }
    });

    it('returns null when soc too low', () => {
      const sys = createInitialized();
      addTestVehicle(sys, { currentSoC: 20 });
      sys.configureGridServices({ v2hEnabled: true });
      try {
        assertEqual(sys.activateV2H('v1', 5), null);
      } finally { cleanup(sys); }
    });
  });

  describe('evaluateDemandResponse', () => {
    it('returns null when not participating', () => {
      const sys = createInitialized();
      try {
        assertEqual(sys.evaluateDemandResponse(), null);
      } finally { cleanup(sys); }
    });

    it('returns demand response evaluation', () => {
      const sys = createInitialized();
      sys.configureGridServices({ demandResponseParticipation: true });
      try {
        const result = sys.evaluateDemandResponse();
        assertType(result.isPeakHour, 'boolean');
        assertType(result.recommendation, 'string');
      } finally { cleanup(sys); }
    });
  });

  // ── Notifications ────────────────────────────────────────────────

  describe('getNotifications', () => {
    it('returns all notifications', () => {
      const sys = createInitialized();
      try {
        sys._sendNotification('chargeComplete', 'Test');
        assertEqual(sys.getNotifications().length, 1);
      } finally { cleanup(sys); }
    });

    it('filters unread only', () => {
      const sys = createInitialized();
      try {
        sys._sendNotification('chargeComplete', 'A');
        sys._sendNotification('chargeComplete', 'B');
        sys.notificationHistory[0].read = true;
        assertEqual(sys.getNotifications(true).length, 1);
      } finally { cleanup(sys); }
    });
  });

  describe('markNotificationRead / markAllNotificationsRead', () => {
    it('marks single notification read', () => {
      const sys = createInitialized();
      try {
        sys._sendNotification('chargeComplete', 'Test');
        const id = sys.notificationHistory[0].id;
        sys.markNotificationRead(id);
        assertEqual(sys.notificationHistory[0].read, true);
      } finally { cleanup(sys); }
    });

    it('marks all read', () => {
      const sys = createInitialized();
      try {
        sys._sendNotification('chargeComplete', 'A');
        sys._sendNotification('chargeComplete', 'B');
        sys.markAllNotificationsRead();
        assert(sys.notificationHistory.every(n => n.read), 'all should be read');
      } finally { cleanup(sys); }
    });
  });

  // ── Maintenance ──────────────────────────────────────────────────

  describe('recordInspection', () => {
    it('records inspection and sets next due date', () => {
      const sys = createInitialized();
      try {
        const rec = sys.recordInspection('garage', { cableCondition: 'worn', notes: 'OK' });
        assert(rec.lastInspection !== null, 'lastInspection should be set');
        assert(rec.nextInspection !== null, 'nextInspection should be set');
        assertEqual(rec.cableCondition, 'worn');
        assertEqual(rec.history.length, 1);
      } finally { cleanup(sys); }
    });

    it('returns null for unknown station', () => {
      const sys = createInitialized();
      try {
        assertEqual(sys.recordInspection('phantom', {}), null);
      } finally { cleanup(sys); }
    });
  });

  describe('updateFirmware', () => {
    it('updates firmware version', () => {
      const sys = createInitialized();
      try {
        const rec = sys.updateFirmware('garage', '2.0.0');
        assertEqual(rec.firmwareVersion, '2.0.0');
        assertEqual(sys.chargingStations.get('garage').firmwareVersion, '2.0.0');
      } finally { cleanup(sys); }
    });
  });

  describe('getMaintenanceStatus', () => {
    it('returns single station maintenance', () => {
      const sys = createInitialized();
      try {
        const status = sys.getMaintenanceStatus('garage');
        assertType(status, 'object');
        assertEqual(status.cableCondition, 'good');
      } finally { cleanup(sys); }
    });

    it('returns all stations when no id', () => {
      const sys = createInitialized();
      try {
        const all = sys.getMaintenanceStatus();
        assert(Object.keys(all).length === 4, 'should have 4 records');
      } finally { cleanup(sys); }
    });
  });

  // ── Emergency Features ───────────────────────────────────────────

  describe('triggerEmergencyStop', () => {
    it('activates emergency stop on all stations', () => {
      const sys = createInitialized();
      try {
        const result = sys.triggerEmergencyStop();
        assertEqual(result.emergencyStopActive, true);
        assertEqual(sys.emergencyState.emergencyStopActive, true);
        for (const [, station] of sys.chargingStations) {
          assertEqual(station.status, 'fault');
        }
      } finally { cleanup(sys); }
    });
  });

  describe('resetEmergencyStop', () => {
    it('resets emergency state', () => {
      const sys = createInitialized();
      sys.triggerEmergencyStop();
      try {
        const result = sys.resetEmergencyStop();
        assertEqual(result.emergencyStopActive, false);
        for (const [, station] of sys.chargingStations) {
          assertEqual(station.status, 'available');
        }
      } finally { cleanup(sys); }
    });
  });

  describe('reportFault', () => {
    it('handles ground fault', () => {
      const sys = createInitialized();
      try {
        sys.reportFault('garage', 'ground_fault', 'leak detected');
        assertEqual(sys.emergencyState.groundFaultDetected, true);
        assertEqual(sys.chargingStations.get('garage').status, 'fault');
      } finally { cleanup(sys); }
    });

    it('handles over_temperature', () => {
      const sys = createInitialized();
      try {
        sys.reportFault('garage', 'over_temperature');
        assertEqual(sys.emergencyState.overTemperature, true);
      } finally { cleanup(sys); }
    });
  });

  describe('setFireRiskLevel', () => {
    it('sets valid fire risk levels', () => {
      const sys = createInitialized();
      try {
        assertEqual(sys.setFireRiskLevel('low'), true);
        assertEqual(sys.emergencyState.fireRiskLevel, 'low');
      } finally { cleanup(sys); }
    });

    it('triggers emergency stop on high risk', () => {
      const sys = createInitialized();
      try {
        sys.setFireRiskLevel('high');
        assertEqual(sys.emergencyState.emergencyStopActive, true);
      } finally { cleanup(sys); }
    });

    it('rejects invalid risk level', () => {
      const sys = createInitialized();
      try {
        assertEqual(sys.setFireRiskLevel('extreme'), false);
      } finally { cleanup(sys); }
    });
  });

  describe('getEmergencyStatus', () => {
    it('returns emergency status with thresholds', () => {
      const sys = createInitialized();
      try {
        const status = sys.getEmergencyStatus();
        assertEqual(status.emergencyStopActive, false);
        assertType(status.thresholds, 'object');
        assertType(status.stationStatuses, 'object');
      } finally { cleanup(sys); }
    });
  });

  describe('getCableLockStatus', () => {
    it('returns cable lock info', () => {
      const sys = createInitialized();
      try {
        const lock = sys.getCableLockStatus('garage');
        assertEqual(lock.cableLocked, false);
        assertEqual(lock.status, 'available');
      } finally { cleanup(sys); }
    });

    it('returns null for unknown station', () => {
      const sys = createInitialized();
      try {
        assertEqual(sys.getCableLockStatus('phantom'), null);
      } finally { cleanup(sys); }
    });
  });

  // ── Weather Impact ───────────────────────────────────────────────

  describe('updateWeatherData', () => {
    it('updates weather and adjusts vehicle ranges', () => {
      const sys = createInitialized();
      addTestVehicle(sys);
      try {
        sys.updateWeatherData({ temperatureC: -15, condition: 'snow' });
        assertEqual(sys.weatherData.temperatureC, -15);
        assertEqual(sys.weatherData.condition, 'snow');
        const v = sys.getVehicle('v1');
        assert(v.adjustedRangePerKwh < v.estimatedRangePerKwh, 'range should decrease in cold');
      } finally { cleanup(sys); }
    });
  });

  describe('getWeatherImpactReport', () => {
    it('returns weather impact report', () => {
      const sys = createInitialized();
      addTestVehicle(sys);
      try {
        const report = sys.getWeatherImpactReport();
        assertType(report.temperature, 'number');
        assertType(report.rangeFactor, 'number');
        assertType(report.solarFactor, 'number');
      } finally { cleanup(sys); }
    });
  });

  // ── Fleet Management ─────────────────────────────────────────────

  describe('getFleetOverview', () => {
    it('returns fleet summary', () => {
      const sys = createInitialized();
      addTestVehicle(sys, { id: 'v1' });
      addTestVehicle(sys, { id: 'v2', currentSoC: 90 });
      try {
        const fleet = sys.getFleetOverview();
        assertEqual(fleet.totalVehicles, 2);
        assertEqual(fleet.chargingCount, 0);
        assertType(fleet.averageSoC, 'number');
        assertEqual(fleet.vehicles.length, 2);
      } finally { cleanup(sys); }
    });
  });

  describe('getChargePriorityQueue', () => {
    it('sorts by lowest SoC by default', () => {
      const sys = createInitialized();
      addTestVehicle(sys, { id: 'v1', currentSoC: 60 });
      addTestVehicle(sys, { id: 'v2', currentSoC: 30 });
      try {
        const queue = sys.getChargePriorityQueue();
        assertEqual(queue.length, 2);
        assertEqual(queue[0].vehicleId, 'v2');
        assertEqual(queue[0].priority, 1);
      } finally { cleanup(sys); }
    });
  });

  // ── Statistics ───────────────────────────────────────────────────

  describe('getStatistics', () => {
    it('returns comprehensive statistics', () => {
      const sys = createInitialized();
      try {
        const stats = sys.getStatistics();
        assertEqual(stats.system, 'SmartEVChargingManagementSystem');
        assertType(stats.stations, 'object');
        assertType(stats.fleet, 'object');
        assertType(stats.energy, 'object');
        assertType(stats.load, 'object');
        assertType(stats.emergency, 'object');
        assertType(stats.monitoring, 'object');
        assertEqual(stats.monitoring.running, true);
      } finally { cleanup(sys); }
    });
  });

  // ── Monthly Report ───────────────────────────────────────────────

  describe('generateMonthlyCostReport', () => {
    it('generates monthly cost report', () => {
      const sys = createInitialized();
      try {
        const report = sys.generateMonthlyCostReport();
        assertType(report.month, 'string');
        assertType(report.totalKwh, 'number');
        assertType(report.solarRatio, 'number');
        assertType(report.comparison, 'object');
        assertEqual(report.currency, 'EUR');
      } finally { cleanup(sys); }
    });
  });

  // ── Date helpers ─────────────────────────────────────────────────

  describe('date helpers', () => {
    it('_dayKey formats YYYY-MM-DD', () => {
      const sys = createInitialized();
      try {
        const key = sys._dayKey(new Date(2024, 0, 5));
        assertEqual(key, '2024-01-05');
      } finally { cleanup(sys); }
    });

    it('_monthKey formats YYYY-MM', () => {
      const sys = createInitialized();
      try {
        assertEqual(sys._monthKey(new Date(2024, 11, 1)), '2024-12');
      } finally { cleanup(sys); }
    });

    it('_weekKey contains W prefix', () => {
      const sys = createInitialized();
      try {
        const key = sys._weekKey(new Date(2024, 5, 15));
        assert(key.includes('-W'), 'should contain week prefix');
      } finally { cleanup(sys); }
    });
  });

  // ── _isOffPeakHour ───────────────────────────────────────────────

  describe('_isOffPeakHour', () => {
    it('returns true during off-peak (23:00)', () => {
      const sys = createInitialized();
      try {
        assertEqual(sys._isOffPeakHour(23), true);
      } finally { cleanup(sys); }
    });

    it('returns true during off-peak (3:00)', () => {
      const sys = createInitialized();
      try {
        assertEqual(sys._isOffPeakHour(3), true);
      } finally { cleanup(sys); }
    });

    it('returns false during peak (12:00)', () => {
      const sys = createInitialized();
      try {
        assertEqual(sys._isOffPeakHour(12), false);
      } finally { cleanup(sys); }
    });
  });

  // ── _temperatureRangeFactor ──────────────────────────────────────

  describe('_temperatureRangeFactor', () => {
    it('returns extreme cold factor', () => {
      const sys = createInitialized();
      try {
        assertEqual(sys._temperatureRangeFactor(-15), 0.6);
      } finally { cleanup(sys); }
    });

    it('returns optimal factor', () => {
      const sys = createInitialized();
      try {
        assertEqual(sys._temperatureRangeFactor(20), 1.0);
      } finally { cleanup(sys); }
    });

    it('returns hot factor', () => {
      const sys = createInitialized();
      try {
        assertEqual(sys._temperatureRangeFactor(30), 0.92);
      } finally { cleanup(sys); }
    });
  });
});

run();
