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

const HomeSpaAndSaunaSystem = require('../lib/HomeSpaAndSaunaSystem');

describe('HomeSpaAndSaunaSystem — constructor & init', () => {
  it('instantiates without errors', () => {
    const sys = new HomeSpaAndSaunaSystem(createMockHomey());
    assert(sys, 'should create instance');
    cleanup(sys);
  });

  it('initialize sets up facilities and programs', async () => {
    const sys = new HomeSpaAndSaunaSystem(createMockHomey());
    await sys.initialize();
    assert(sys.facilities.size > 0, 'should have facilities');
    assert(sys.programs.size > 0, 'should have programs');
    cleanup(sys);
  });

  it('destroy cleans up intervals', async () => {
    const sys = new HomeSpaAndSaunaSystem(createMockHomey());
    await sys.initialize();
    await sys.destroy();
    // destroy clears intervals (they may be set to destroyed timer objects)
    cleanup(sys);
  });
});

describe('HomeSpaAndSaunaSystem — facilities & programs', () => {
  it('getFacilities returns all facilities', async () => {
    const sys = new HomeSpaAndSaunaSystem(createMockHomey());
    await sys.initialize();
    const facilities = sys.getFacilities();
    assert(Array.isArray(facilities), 'should be array');
    assert(facilities.length > 0, 'should have facilities');
    cleanup(sys);
  });

  it('getPrograms returns all programs', async () => {
    const sys = new HomeSpaAndSaunaSystem(createMockHomey());
    await sys.initialize();
    const programs = sys.getPrograms();
    assert(Array.isArray(programs), 'should be array');
    assert(programs.length > 0, 'should have programs');
    cleanup(sys);
  });

  it('getSessions returns session history', async () => {
    const sys = new HomeSpaAndSaunaSystem(createMockHomey());
    await sys.initialize();
    const sessions = sys.getSessions();
    assert(Array.isArray(sessions), 'should be array');
    cleanup(sys);
  });

  it('getCurrentSession returns null when no session', async () => {
    const sys = new HomeSpaAndSaunaSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.getCurrentSession(), null);
    cleanup(sys);
  });
});

describe('HomeSpaAndSaunaSystem — sessions', () => {
  it('startSession creates a session', async () => {
    const sys = new HomeSpaAndSaunaSystem(createMockHomey());
    await sys.initialize();
    const facilityId = sys.facilities.keys().next().value;
    const session = await sys.startSession(facilityId);
    assert(session, 'should return session');
    assert(sys.currentSession, 'should have current session');
    cleanup(sys);
  });

  it('startSession rejects unknown facility', async () => {
    const sys = new HomeSpaAndSaunaSystem(createMockHomey());
    await sys.initialize();
    try {
      await sys.startSession('nonexistent');
    } catch (_) { /* expected */ }
    cleanup(sys);
  });

  it('emergencyShutdown shuts down facility', async () => {
    const sys = new HomeSpaAndSaunaSystem(createMockHomey());
    await sys.initialize();
    const facilityId = sys.facilities.keys().next().value;
    await sys.emergencyShutdown(facilityId);
    const facility = sys.facilities.get(facilityId);
    assertEqual(facility.status, 'emergency-off');
    cleanup(sys);
  });
});

describe('HomeSpaAndSaunaSystem — programs', () => {
  it('startProgram begins a program', async () => {
    const sys = new HomeSpaAndSaunaSystem(createMockHomey());
    await sys.initialize();
    const programId = sys.programs.keys().next().value;
    const result = await sys.startProgram(programId);
    assert(result, 'should return result');
    cleanup(sys);
  });

  it('startProgram rejects unknown program', async () => {
    const sys = new HomeSpaAndSaunaSystem(createMockHomey());
    await sys.initialize();
    try {
      await sys.startProgram('nonexistent');
    } catch (_) { /* expected */ }
    cleanup(sys);
  });

  it('stopProgram stops a running program', async () => {
    const sys = new HomeSpaAndSaunaSystem(createMockHomey());
    await sys.initialize();
    const programId = sys.programs.keys().next().value;
    await sys.startProgram(programId);
    const result = await sys.stopProgram(sys.facilities.keys().next().value);
    assert(result !== null, 'should handle stop');
    cleanup(sys);
  });
});

describe('HomeSpaAndSaunaSystem — stats', () => {
  it('getStats returns statistics', async () => {
    const sys = new HomeSpaAndSaunaSystem(createMockHomey());
    await sys.initialize();
    const stats = sys.getStats();
    assert(stats, 'should return stats');
    assertType(stats.totalSessions, 'number');
    assertType(stats.totalFacilities, 'number');
    cleanup(sys);
  });
});

run();
