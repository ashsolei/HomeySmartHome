'use strict';

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertThrows, assertType } = require('./helpers/assert');
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

const AdvancedPackageDeliveryManagementSystem = require('../lib/AdvancedPackageDeliveryManagementSystem');

/* ================================================================== */
/*  AdvancedPackageDeliveryManagementSystem – test suite               */
/* ================================================================== */

describe('AdvancedPackageDeliveryManagementSystem — constructor & init', () => {
  it('instantiates without errors', () => {
    const homey = createMockHomey();
    const sys = new AdvancedPackageDeliveryManagementSystem(homey);
    assert(sys, 'should create instance');
    cleanup(sys);
  });

  it('has 8 Swedish carriers configured', () => {
    const sys = new AdvancedPackageDeliveryManagementSystem(createMockHomey());
    const carriers = Object.keys(sys.carriers);
    assertEqual(carriers.length, 8);
    assert(carriers.includes('postnord'), 'postnord');
    assert(carriers.includes('dhl'), 'dhl');
    assert(carriers.includes('instabox'), 'instabox');
    assert(carriers.includes('budbee'), 'budbee');
    cleanup(sys);
  });

  it('has 10 package states with valid transitions', () => {
    const sys = new AdvancedPackageDeliveryManagementSystem(createMockHomey());
    assertEqual(sys.packageStates.length, 10);
    assert(sys.validTransitions, 'should have transitions');
    cleanup(sys);
  });

  it('has 4 delivery points', () => {
    const sys = new AdvancedPackageDeliveryManagementSystem(createMockHomey());
    const points = Object.keys(sys.deliveryPoints);
    assertEqual(points.length, 4);
    cleanup(sys);
  });

  it('initialize loads sample packages and starts intervals', () => {
    const sys = new AdvancedPackageDeliveryManagementSystem(createMockHomey());
    sys.initialize();
    assert(sys.initialized, 'should be initialized');
    assert(sys.packages.size > 0, 'should have sample packages');
    cleanup(sys);
  });

  it('destroy clears all intervals', () => {
    const sys = new AdvancedPackageDeliveryManagementSystem(createMockHomey());
    sys.initialize();
    sys.destroy();
    assertEqual(sys.intervals.length, 0);
    cleanup(sys);
  });
});

describe('AdvancedPackageDeliveryManagementSystem — package management', () => {
  it('addPackage creates a new package', () => {
    const sys = new AdvancedPackageDeliveryManagementSystem(createMockHomey());
    sys.initialize();
    const pkg = sys.addPackage({
      trackingNumber: 'TEST-001',
      carrier: 'postnord',
      description: 'Test package',
      sender: 'TestSender',
      value: 100
    });
    assert(pkg, 'should return package');
    assertEqual(pkg.trackingNumber, 'TEST-001');
    assertEqual(pkg.carrier, 'postnord');
    cleanup(sys);
  });

  it('addPackage requires tracking number and carrier', () => {
    const sys = new AdvancedPackageDeliveryManagementSystem(createMockHomey());
    sys.initialize();
    assertThrows(() => sys.addPackage({ description: 'No tracking' }), 'tracking');
    cleanup(sys);
  });

  it('addPackage auto-insures high-value packages', () => {
    const sys = new AdvancedPackageDeliveryManagementSystem(createMockHomey());
    sys.initialize();
    const pkg = sys.addPackage({
      trackingNumber: 'TEST-HV',
      carrier: 'dhl',
      description: 'Expensive item',
      sender: 'Premium',
      value: 5000
    });
    assertEqual(pkg.insurance, true);
    cleanup(sys);
  });

  it('addPackage handles international packages with customs', () => {
    const sys = new AdvancedPackageDeliveryManagementSystem(createMockHomey());
    sys.initialize();
    const pkg = sys.addPackage({
      trackingNumber: 'TEST-INT',
      carrier: 'fedex',
      description: 'Import from China',
      sender: 'AliExpress',
      value: 200,
      origin: 'CN'
    });
    assertEqual(pkg.isInternational, true);
    cleanup(sys);
  });

  it('trackPackage returns enriched package info', () => {
    const sys = new AdvancedPackageDeliveryManagementSystem(createMockHomey());
    sys.initialize();
    sys.addPackage({ trackingNumber: 'TRK-001', carrier: 'postnord', description: 'Test', sender: 'A', value: 50 });
    const info = sys.trackPackage('TRK-001');
    assert(info, 'should return info');
    assertEqual(info.trackingNumber, 'TRK-001');
    cleanup(sys);
  });

  it('trackPackage returns null for unknown package', () => {
    const sys = new AdvancedPackageDeliveryManagementSystem(createMockHomey());
    sys.initialize();
    const info = sys.trackPackage('NONEXISTENT');
    assertEqual(info, null);
    cleanup(sys);
  });
});

describe('AdvancedPackageDeliveryManagementSystem — status transitions', () => {
  it('updatePackageStatus follows valid FSM transitions', () => {
    const sys = new AdvancedPackageDeliveryManagementSystem(createMockHomey());
    sys.initialize();
    sys.addPackage({ trackingNumber: 'FSM-001', carrier: 'dhl', description: 'FSM test', sender: 'B', value: 100 });
    // Default status is 'confirmed', valid transition to 'shipped'
    const result = sys.updatePackageStatus('FSM-001', 'shipped');
    assert(result, 'should succeed');
    const pkg = sys.packages.get('FSM-001');
    assertEqual(pkg.status, 'shipped');
    cleanup(sys);
  });

  it('updatePackageStatus rejects invalid transitions', () => {
    const sys = new AdvancedPackageDeliveryManagementSystem(createMockHomey());
    sys.initialize();
    sys.addPackage({ trackingNumber: 'FSM-002', carrier: 'ups', description: 'FSM test', sender: 'C', value: 50 });
    // confirmed → delivered is not a valid direct transition
    assertThrows(() => sys.updatePackageStatus('FSM-002', 'delivered'), 'transition');
    cleanup(sys);
  });

  it('updatePackageStatus throws for unknown package', () => {
    const sys = new AdvancedPackageDeliveryManagementSystem(createMockHomey());
    sys.initialize();
    assertThrows(() => sys.updatePackageStatus('UNKNOWN', 'shipped'), 'not found');
    cleanup(sys);
  });
});

describe('AdvancedPackageDeliveryManagementSystem — returns', () => {
  it('initiateReturn creates return package', () => {
    const sys = new AdvancedPackageDeliveryManagementSystem(createMockHomey());
    sys.initialize();
    sys.addPackage({ trackingNumber: 'RET-001', carrier: 'postnord', description: 'Return test', sender: 'D', value: 200 });
    // Move through states to delivered
    sys.updatePackageStatus('RET-001', 'shipped');
    sys.updatePackageStatus('RET-001', 'in-transit');
    sys.updatePackageStatus('RET-001', 'out-for-delivery');
    sys.updatePackageStatus('RET-001', 'delivered');
    const ret = sys.initiateReturn('RET-001', 'Wrong size');
    assert(ret, 'should create return');
    cleanup(sys);
  });
});

describe('AdvancedPackageDeliveryManagementSystem — queries', () => {
  it('getActivePackages returns non-terminal packages', () => {
    const sys = new AdvancedPackageDeliveryManagementSystem(createMockHomey());
    sys.initialize();
    const active = sys.getActivePackages();
    assert(Array.isArray(active), 'should be array');
    cleanup(sys);
  });

  it('getDeliveryHistory returns filtered history', () => {
    const sys = new AdvancedPackageDeliveryManagementSystem(createMockHomey());
    sys.initialize();
    const history = sys.getDeliveryHistory({});
    assert(Array.isArray(history), 'should be array');
    cleanup(sys);
  });

  it('getDeliveryHistory filters by carrier', () => {
    const sys = new AdvancedPackageDeliveryManagementSystem(createMockHomey());
    sys.initialize();
    const history = sys.getDeliveryHistory({ carrier: 'postnord' });
    for (const h of history) {
      assertEqual(h.carrier, 'postnord');
    }
    cleanup(sys);
  });

  it('getCarrierReliability returns per-carrier stats', () => {
    const sys = new AdvancedPackageDeliveryManagementSystem(createMockHomey());
    sys.initialize();
    const reliability = sys.getCarrierReliability();
    assert(reliability, 'should return reliability data');
    cleanup(sys);
  });
});

describe('AdvancedPackageDeliveryManagementSystem — community network', () => {
  it('getCommunityStatus returns network state', () => {
    const sys = new AdvancedPackageDeliveryManagementSystem(createMockHomey());
    sys.initialize();
    const status = sys.getCommunityStatus();
    assert(status, 'should return status');
    cleanup(sys);
  });

  it('acceptNeighborPackage holds package for neighbor', () => {
    const sys = new AdvancedPackageDeliveryManagementSystem(createMockHomey());
    sys.initialize();
    const result = sys.acceptNeighborPackage({ neighborId: 'n1', trackingNumber: 'NBR-001', description: 'Neighbor pkg' });
    assert(result, 'should accept package');
    cleanup(sys);
  });

  it('releaseNeighborPackage marks as picked up', () => {
    const sys = new AdvancedPackageDeliveryManagementSystem(createMockHomey());
    sys.initialize();
    sys.acceptNeighborPackage({ neighborId: 'n1', trackingNumber: 'NBR-002', description: 'Neighbor pkg' });
    const result = sys.releaseNeighborPackage('NBR-002');
    assert(result, 'should release package');
    cleanup(sys);
  });
});

describe('AdvancedPackageDeliveryManagementSystem — delivery points', () => {
  it('getDeliveryPointStatus returns all points', () => {
    const sys = new AdvancedPackageDeliveryManagementSystem(createMockHomey());
    sys.initialize();
    const status = sys.getDeliveryPointStatus();
    assert(status, 'should return status');
    assertEqual(Object.keys(status).length, 4);
    cleanup(sys);
  });

  it('getDeliveryWindows returns configured windows', () => {
    const sys = new AdvancedPackageDeliveryManagementSystem(createMockHomey());
    sys.initialize();
    const windows = sys.getDeliveryWindows();
    assert(windows, 'should return windows');
    cleanup(sys);
  });

  it('setPreferredDeliveryWindow updates preference', () => {
    const sys = new AdvancedPackageDeliveryManagementSystem(createMockHomey());
    sys.initialize();
    const windowIds = Object.keys(sys.deliveryWindows);
    if (windowIds.length > 0) {
      const result = sys.setPreferredDeliveryWindow(windowIds[0], true);
      assertEqual(result, true);
    }
    cleanup(sys);
  });
});

describe('AdvancedPackageDeliveryManagementSystem — recurring deliveries', () => {
  it('getRecurringDeliveries returns subscription list', () => {
    const sys = new AdvancedPackageDeliveryManagementSystem(createMockHomey());
    sys.initialize();
    const recurring = sys.getRecurringDeliveries();
    assert(Array.isArray(recurring), 'should be array');
    assert(recurring.length >= 4, 'should have sample subscriptions');
    cleanup(sys);
  });

  it('addRecurringDelivery creates subscription', () => {
    const sys = new AdvancedPackageDeliveryManagementSystem(createMockHomey());
    sys.initialize();
    const sub = sys.addRecurringDelivery({
      name: 'Coffee subscription',
      carrier: 'postnord',
      sender: 'CoffeeCo',
      interval: 'monthly',
      nextDelivery: '2025-07-01'
    });
    assert(sub, 'should return subscription');
    assert(sub.id, 'should have id');
    cleanup(sys);
  });

  it('cancelRecurringDelivery deactivates subscription', () => {
    const sys = new AdvancedPackageDeliveryManagementSystem(createMockHomey());
    sys.initialize();
    const sub = sys.addRecurringDelivery({
      name: 'Test sub',
      carrier: 'dhl',
      sender: 'TestCo',
      interval: 'weekly',
      nextDelivery: '2025-07-01'
    });
    const result = sys.cancelRecurringDelivery(sub.id);
    assertEqual(result, true);
    cleanup(sys);
  });

  it('cancelRecurringDelivery returns false for unknown', () => {
    const sys = new AdvancedPackageDeliveryManagementSystem(createMockHomey());
    sys.initialize();
    const result = sys.cancelRecurringDelivery('non-existent');
    assertEqual(result, false);
    cleanup(sys);
  });
});

describe('AdvancedPackageDeliveryManagementSystem — customs', () => {
  it('getCustomsInfo returns customs data for international package', () => {
    const sys = new AdvancedPackageDeliveryManagementSystem(createMockHomey());
    sys.initialize();
    sys.addPackage({
      trackingNumber: 'CUST-001', carrier: 'fedex', description: 'Import',
      sender: 'Overseas', value: 300, origin: 'CN'
    });
    const customs = sys.getCustomsInfo('CUST-001');
    assert(customs, 'should return customs info');
    assertEqual(customs.origin, 'CN');
    assertEqual(customs.isEU, false);
    assertEqual(customs.vatRate, 0.25);
    cleanup(sys);
  });

  it('getCustomsInfo returns null for domestic package', () => {
    const sys = new AdvancedPackageDeliveryManagementSystem(createMockHomey());
    sys.initialize();
    sys.addPackage({ trackingNumber: 'DOM-001', carrier: 'postnord', description: 'Local', sender: 'A', value: 50 });
    const customs = sys.getCustomsInfo('DOM-001');
    assertEqual(customs, null);
    cleanup(sys);
  });

  it('getCustomsInfo identifies EU origin', () => {
    const sys = new AdvancedPackageDeliveryManagementSystem(createMockHomey());
    sys.initialize();
    sys.addPackage({
      trackingNumber: 'EU-001', carrier: 'dhl', description: 'From Germany',
      sender: 'DE Shop', value: 200, origin: 'DE'
    });
    const customs = sys.getCustomsInfo('EU-001');
    assert(customs, 'should return customs');
    assertEqual(customs.isEU, true);
    cleanup(sys);
  });
});

describe('AdvancedPackageDeliveryManagementSystem — insurance', () => {
  it('getInsuranceStatus returns insured packages', () => {
    const sys = new AdvancedPackageDeliveryManagementSystem(createMockHomey());
    sys.initialize();
    const status = sys.getInsuranceStatus();
    assert(status, 'should return status');
    assert(status.config, 'has config');
    assert(Array.isArray(status.insuredPackages), 'has insured list');
    cleanup(sys);
  });
});

describe('AdvancedPackageDeliveryManagementSystem — theft prevention', () => {
  it('getTheftPreventionStatus returns current config', () => {
    const sys = new AdvancedPackageDeliveryManagementSystem(createMockHomey());
    sys.initialize();
    const status = sys.getTheftPreventionStatus();
    assertType(status.motionDetectionEnabled, 'boolean');
    assert(Array.isArray(status.recentIncidents), 'has incidents');
    cleanup(sys);
  });

  it('setTheftPreventionConfig updates settings', () => {
    const sys = new AdvancedPackageDeliveryManagementSystem(createMockHomey());
    sys.initialize();
    const result = sys.setTheftPreventionConfig({
      motionDetectionEnabled: true,
      sensitivityThreshold: 0.9
    });
    assertEqual(result.motionDetectionEnabled, true);
    cleanup(sys);
  });

  it('setTheftPreventionConfig clamps sensitivity 0-1', () => {
    const sys = new AdvancedPackageDeliveryManagementSystem(createMockHomey());
    sys.initialize();
    sys.setTheftPreventionConfig({ sensitivityThreshold: 5 });
    assertEqual(sys.theftPrevention.motionSensitivityThreshold, 1);
    sys.setTheftPreventionConfig({ sensitivityThreshold: -1 });
    assertEqual(sys.theftPrevention.motionSensitivityThreshold, 0);
    cleanup(sys);
  });
});

describe('AdvancedPackageDeliveryManagementSystem — analytics & statistics', () => {
  it('getStatistics returns comprehensive summary', () => {
    const sys = new AdvancedPackageDeliveryManagementSystem(createMockHomey());
    sys.initialize();
    const stats = sys.getStatistics();
    assert(stats, 'should return stats');
    assertType(stats.totalPackages, 'number');
    assertType(stats.activePackages, 'number');
    assert(stats.statusBreakdown, 'has status breakdown');
    assertEqual(stats.carriersConfigured, 8);
    assertEqual(stats.deliveryPoints, 4);
    cleanup(sys);
  });

  it('getMonthlyAnalytics returns null for empty month', () => {
    const sys = new AdvancedPackageDeliveryManagementSystem(createMockHomey());
    sys.initialize();
    const analytics = sys.getMonthlyAnalytics('2020-01');
    assertEqual(analytics, null);
    cleanup(sys);
  });
});

describe('AdvancedPackageDeliveryManagementSystem — driver instructions', () => {
  it('getDriverInstructions returns carrier instructions', () => {
    const sys = new AdvancedPackageDeliveryManagementSystem(createMockHomey());
    sys.initialize();
    const instructions = sys.getDriverInstructions('postnord');
    assert(instructions, 'should return instructions');
    assertEqual(instructions.carrier, 'PostNord');
    assert(Array.isArray(instructions.deliveryPoints), 'has delivery points');
    cleanup(sys);
  });

  it('getDriverInstructions returns null for unknown carrier', () => {
    const sys = new AdvancedPackageDeliveryManagementSystem(createMockHomey());
    sys.initialize();
    const instructions = sys.getDriverInstructions('nonexistent');
    assertEqual(instructions, null);
    cleanup(sys);
  });

  it('setDriverInstructions updates instructions', () => {
    const sys = new AdvancedPackageDeliveryManagementSystem(createMockHomey());
    sys.initialize();
    const result = sys.setDriverInstructions('postnord', 'Leave at front door');
    assertEqual(result, true);
    cleanup(sys);
  });

  it('setDriverInstructions returns false for unknown carrier', () => {
    const sys = new AdvancedPackageDeliveryManagementSystem(createMockHomey());
    sys.initialize();
    const result = sys.setDriverInstructions('fake', 'Instructions');
    assertEqual(result, false);
    cleanup(sys);
  });
});

describe('AdvancedPackageDeliveryManagementSystem — photo & collection', () => {
  it('verifyDeliveryPhoto marks photo verified', () => {
    const sys = new AdvancedPackageDeliveryManagementSystem(createMockHomey());
    sys.initialize();
    sys.addPackage({ trackingNumber: 'PHO-001', carrier: 'postnord', description: 'Photo test', sender: 'E', value: 50 });
    sys.updatePackageStatus('PHO-001', 'shipped');
    sys.updatePackageStatus('PHO-001', 'in-transit');
    sys.updatePackageStatus('PHO-001', 'out-for-delivery');
    sys.updatePackageStatus('PHO-001', 'delivered');
    const result = sys.verifyDeliveryPhoto('PHO-001');
    assertEqual(result, true);
    cleanup(sys);
  });

  it('verifyDeliveryPhoto returns false for non-delivered', () => {
    const sys = new AdvancedPackageDeliveryManagementSystem(createMockHomey());
    sys.initialize();
    sys.addPackage({ trackingNumber: 'PHO-002', carrier: 'dhl', description: 'Not delivered', sender: 'F', value: 50 });
    const result = sys.verifyDeliveryPhoto('PHO-002');
    assertEqual(result, false);
    cleanup(sys);
  });

  it('collectPackage collected a delivered package', () => {
    const sys = new AdvancedPackageDeliveryManagementSystem(createMockHomey());
    sys.initialize();
    sys.addPackage({ trackingNumber: 'COL-001', carrier: 'postnord', description: 'Collect test', sender: 'G', value: 100 });
    sys.updatePackageStatus('COL-001', 'shipped');
    sys.updatePackageStatus('COL-001', 'in-transit');
    sys.updatePackageStatus('COL-001', 'out-for-delivery');
    sys.updatePackageStatus('COL-001', 'delivered');
    const result = sys.collectPackage('COL-001');
    assertEqual(result, true);
    cleanup(sys);
  });

  it('collectPackage returns false for non-delivered', () => {
    const sys = new AdvancedPackageDeliveryManagementSystem(createMockHomey());
    sys.initialize();
    sys.addPackage({ trackingNumber: 'COL-002', carrier: 'dhl', description: 'Not delivered', sender: 'H', value: 50 });
    const result = sys.collectPackage('COL-002');
    assertEqual(result, false);
    cleanup(sys);
  });
});

run();
