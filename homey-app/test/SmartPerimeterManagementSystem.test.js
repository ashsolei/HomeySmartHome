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

const SmartPerimeterManagementSystem = require('../lib/SmartPerimeterManagementSystem');

describe('Perimeter — constructor & lifecycle', () => {
  it('instantiates with default entrances and zones', () => {
    const sys = new SmartPerimeterManagementSystem(createMockHomey());
    assert(sys.entrances.size > 0, 'should have entrances');
    assert(sys.detectionZones.size > 0, 'should have detection zones');
    assertEqual(sys.initialized, false);
    cleanup(sys);
  });

  it('initialize sets initialized flag', async () => {
    const sys = new SmartPerimeterManagementSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.initialized, true);
    cleanup(sys);
  });

  it('destroy clears monitoring timer', async () => {
    const sys = new SmartPerimeterManagementSystem(createMockHomey());
    await sys.initialize();
    await sys.destroy();
    cleanup(sys);
  });
});

describe('Perimeter — gate control', () => {
  it('openGate opens a closed gate', async () => {
    const sys = new SmartPerimeterManagementSystem(createMockHomey());
    await sys.initialize();
    const result = sys.openGate('front_gate');
    assert(result, 'should return entrance');
    assertEqual(result.state, 'open');
    assertEqual(result.locked, false);
    cleanup(sys);
  });

  it('openGate returns null for unknown entrance', async () => {
    const sys = new SmartPerimeterManagementSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.openGate('nonexistent'), null);
    cleanup(sys);
  });

  it('closeGate closes an open gate', async () => {
    const sys = new SmartPerimeterManagementSystem(createMockHomey());
    await sys.initialize();
    sys.openGate('front_gate');
    const result = sys.closeGate('front_gate');
    assertEqual(result.state, 'closed');
    cleanup(sys);
  });

  it('lockGate locks and closes a gate', async () => {
    const sys = new SmartPerimeterManagementSystem(createMockHomey());
    await sys.initialize();
    sys.openGate('front_gate');
    const result = sys.lockGate('front_gate');
    assertEqual(result.locked, true);
    assertEqual(result.state, 'closed');
    cleanup(sys);
  });

  it('unlockGate unlocks a gate', async () => {
    const sys = new SmartPerimeterManagementSystem(createMockHomey());
    await sys.initialize();
    sys.lockGate('front_gate');
    const result = sys.unlockGate('front_gate');
    assertEqual(result.locked, false);
    cleanup(sys);
  });

  it('lockAllGates locks every entrance', async () => {
    const sys = new SmartPerimeterManagementSystem(createMockHomey());
    await sys.initialize();
    const results = sys.lockAllGates();
    assert(results.length > 0, 'should return results');
    for (const r of results) {
      assertEqual(r.locked, true);
    }
    cleanup(sys);
  });

  it('getEntranceStatus returns null for unknown', async () => {
    const sys = new SmartPerimeterManagementSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.getEntranceStatus('nope'), null);
    cleanup(sys);
  });

  it('getAllEntranceStatuses returns array of all entrances', async () => {
    const sys = new SmartPerimeterManagementSystem(createMockHomey());
    await sys.initialize();
    const statuses = sys.getAllEntranceStatuses();
    assert(Array.isArray(statuses), 'should be array');
    assert(statuses.length > 0, 'should have entries');
    assert(statuses[0].id, 'should have id');
    cleanup(sys);
  });
});

describe('Perimeter — detection zones', () => {
  it('triggerDetection returns event for active zone', async () => {
    const sys = new SmartPerimeterManagementSystem(createMockHomey());
    await sys.initialize();
    const result = sys.triggerDetection('zone_front', 'motion', { size: 'large', speed: 'slow' });
    assert(result, 'should return result');
    cleanup(sys);
  });

  it('triggerDetection returns null for unknown zone', async () => {
    const sys = new SmartPerimeterManagementSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.triggerDetection('nope', 'motion'), null);
    cleanup(sys);
  });

  it('setZoneActive enables/disables detection zone', async () => {
    const sys = new SmartPerimeterManagementSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.setZoneActive('zone_garden', false), true);
    const zone = sys.getDetectionZoneStatus('zone_garden');
    assertEqual(zone.active, false);
    cleanup(sys);
  });

  it('getAllDetectionZones returns all zones', async () => {
    const sys = new SmartPerimeterManagementSystem(createMockHomey());
    await sys.initialize();
    const zones = sys.getAllDetectionZones();
    assert(Array.isArray(zones), 'should be array');
    assertEqual(zones.length, 6);
    cleanup(sys);
  });
});

describe('Perimeter — access codes', () => {
  it('generateAccessCode creates a code', async () => {
    const sys = new SmartPerimeterManagementSystem(createMockHomey());
    await sys.initialize();
    const code = sys.generateAccessCode({ purpose: 'delivery', grantedTo: 'PostNord' });
    assert(code, 'should return code');
    assert(code.code, 'should have code string');
    assertEqual(code.code.length, 6);
    assertEqual(code.revoked, false);
    cleanup(sys);
  });

  it('validateAccessCode validates a valid code', async () => {
    const sys = new SmartPerimeterManagementSystem(createMockHomey());
    await sys.initialize();
    const code = sys.generateAccessCode({ purpose: 'delivery', grantedTo: 'DHL' });
    const result = sys.validateAccessCode(code.code);
    assertEqual(result.valid, true);
    assertEqual(result.grantedTo, 'DHL');
    cleanup(sys);
  });

  it('validateAccessCode rejects invalid code', async () => {
    const sys = new SmartPerimeterManagementSystem(createMockHomey());
    await sys.initialize();
    const result = sys.validateAccessCode('000000');
    assertEqual(result.valid, false);
    assertEqual(result.reason, 'invalid');
    cleanup(sys);
  });

  it('revokeAccessCode revokes a code', async () => {
    const sys = new SmartPerimeterManagementSystem(createMockHomey());
    await sys.initialize();
    const code = sys.generateAccessCode({ purpose: 'test', grantedTo: 'Test' });
    assertEqual(sys.revokeAccessCode(code.id), true);
    const result = sys.validateAccessCode(code.code);
    assertEqual(result.valid, false);
    assertEqual(result.reason, 'revoked');
    cleanup(sys);
  });

  it('getActiveAccessCodes returns non-revoked codes', async () => {
    const sys = new SmartPerimeterManagementSystem(createMockHomey());
    await sys.initialize();
    sys.generateAccessCode({ purpose: 'test1', grantedTo: 'A' });
    sys.generateAccessCode({ purpose: 'test2', grantedTo: 'B' });
    const active = sys.getActiveAccessCodes();
    assert(active.length >= 2, 'should have at least 2 active codes');
    cleanup(sys);
  });
});

describe('Perimeter — visitor pre-auth', () => {
  it('preAuthorizeVisitor creates authorization', async () => {
    const sys = new SmartPerimeterManagementSystem(createMockHomey());
    await sys.initialize();
    const auth = sys.preAuthorizeVisitor({
      name: 'Test Visitor',
      expectedArrival: new Date(Date.now() + 3600000).toISOString(),
      entrance: 'front_gate'
    });
    assert(auth, 'should return auth');
    assertEqual(auth.name, 'Test Visitor');
    assertEqual(auth.arrived, false);
    assert(auth.accessCode, 'should have access code');
    cleanup(sys);
  });

  it('markVisitorArrived returns updated auth', async () => {
    const sys = new SmartPerimeterManagementSystem(createMockHomey());
    await sys.initialize();
    const auth = sys.preAuthorizeVisitor({ name: 'Visitor' });
    const result = sys.markVisitorArrived(auth.id);
    assert(result, 'should return auth object');
    assertEqual(result.arrived, true);
    assert(result.arrivedAt, 'should have arrivedAt timestamp');
    cleanup(sys);
  });

  it('markVisitorDeparted returns updated auth', async () => {
    const sys = new SmartPerimeterManagementSystem(createMockHomey());
    await sys.initialize();
    const auth = sys.preAuthorizeVisitor({ name: 'Visitor' });
    sys.markVisitorArrived(auth.id);
    const result = sys.markVisitorDeparted(auth.id);
    assert(result, 'should return auth object');
    assertEqual(result.departed, true);
    assert(result.departedAt, 'should have departedAt timestamp');
    cleanup(sys);
  });

  it('getPendingVisitors returns expected visitors', async () => {
    const sys = new SmartPerimeterManagementSystem(createMockHomey());
    await sys.initialize();
    sys.preAuthorizeVisitor({ name: 'Expected Guest' });
    const pending = sys.getPendingVisitors();
    assert(Array.isArray(pending), 'should be array');
    assert(pending.length > 0, 'should have pending visitors');
    cleanup(sys);
  });
});

describe('Perimeter — vehicles', () => {
  it('registerKnownVehicle adds vehicle', async () => {
    const sys = new SmartPerimeterManagementSystem(createMockHomey());
    await sys.initialize();
    const v = sys.registerKnownVehicle('ABC123', { owner: 'Erik', type: 'sedan' });
    assert(v, 'should return vehicle');
    assertEqual(v.plateNumber, 'ABC123');
    cleanup(sys);
  });

  it('classifyVehicle identifies known vehicle as family', async () => {
    const sys = new SmartPerimeterManagementSystem(createMockHomey());
    await sys.initialize();
    sys.registerKnownVehicle('XYZ789', { owner: 'Anna', type: 'suv' });
    const result = sys.classifyVehicle('XYZ789');
    assertEqual(result.isKnown, true);
    assertEqual(result.classification, 'family');
    assertEqual(result.owner, 'Anna');
    cleanup(sys);
  });

  it('classifyVehicle guesses classification for unregistered', async () => {
    const sys = new SmartPerimeterManagementSystem(createMockHomey());
    await sys.initialize();
    const result = sys.classifyVehicle('ABCDEFGHIJK');
    assertEqual(result.isKnown, false);
    assertEqual(result.classification, 'unknown');
    cleanup(sys);
  });

  it('removeKnownVehicle removes vehicle', async () => {
    const sys = new SmartPerimeterManagementSystem(createMockHomey());
    await sys.initialize();
    sys.registerKnownVehicle('DEL001', { owner: 'Test' });
    assertEqual(sys.removeKnownVehicle('DEL001'), true);
    assertEqual(sys.removeKnownVehicle('DEL001'), false);
    cleanup(sys);
  });
});

run();
