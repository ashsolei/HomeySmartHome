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

const MailboxPackageTrackingSystem = require('../lib/MailboxPackageTrackingSystem');

describe('MailboxPackageTrackingSystem — constructor & init', () => {
  it('instantiates without errors', () => {
    const sys = new MailboxPackageTrackingSystem(createMockHomey());
    assert(sys, 'should create instance');
    assertEqual(sys.mailboxes.size, 0);
    assertEqual(sys.packages.size, 0);
    assertEqual(sys.deliveries.length, 0);
    cleanup(sys);
  });

  it('initialize sets up default mailboxes', async () => {
    const sys = new MailboxPackageTrackingSystem(createMockHomey());
    await sys.initialize();
    assert(sys.mailboxes.size > 0, 'should have mailboxes');
    assert(sys.mailboxes.has('main-mailbox'), 'should have main-mailbox');
    assert(sys.mailboxes.has('package-box'), 'should have package-box');
    cleanup(sys);
  });

  it('initialize starts monitoring', async () => {
    const sys = new MailboxPackageTrackingSystem(createMockHomey());
    await sys.initialize();
    assert(sys.monitoringInterval, 'should have monitoring interval');
    cleanup(sys);
  });

  it('destroy clears interval', async () => {
    const sys = new MailboxPackageTrackingSystem(createMockHomey());
    await sys.initialize();
    await sys.destroy();
    cleanup(sys);
  });
});

describe('MailboxPackageTrackingSystem — mailbox operations', () => {
  it('getMailboxes returns all mailboxes', async () => {
    const sys = new MailboxPackageTrackingSystem(createMockHomey());
    await sys.initialize();
    const mailboxes = sys.getMailboxes();
    assert(Array.isArray(mailboxes), 'should be array');
    assert(mailboxes.length >= 2, 'should have at least 2 mailboxes');
    cleanup(sys);
  });

  it('getMailbox returns specific mailbox', async () => {
    const sys = new MailboxPackageTrackingSystem(createMockHomey());
    await sys.initialize();
    const mailbox = sys.getMailbox('main-mailbox');
    assert(mailbox, 'should return mailbox');
    assertEqual(mailbox.id, 'main-mailbox');
    cleanup(sys);
  });

  it('getMailbox returns undefined for unknown id', async () => {
    const sys = new MailboxPackageTrackingSystem(createMockHomey());
    await sys.initialize();
    const mailbox = sys.getMailbox('nonexistent');
    assertEqual(mailbox, undefined);
    cleanup(sys);
  });

  it('markMailboxChecked resets status', async () => {
    const sys = new MailboxPackageTrackingSystem(createMockHomey());
    await sys.initialize();
    const mailbox = await sys.markMailboxChecked('main-mailbox');
    assertEqual(mailbox.status.hasNewMail, false);
    assert(mailbox.status.lastChecked, 'should have lastChecked');
    assertEqual(mailbox.sensors.fullnessLevel, 0);
    cleanup(sys);
  });

  it('markMailboxChecked throws for unknown mailbox', async () => {
    const sys = new MailboxPackageTrackingSystem(createMockHomey());
    await sys.initialize();
    try {
      await sys.markMailboxChecked('nonexistent');
      assert(false, 'should have thrown');
    } catch (e) {
      assert(e.message, 'should have error message');
    }
    cleanup(sys);
  });

  it('unlockMailbox unlocks package-box', async () => {
    const sys = new MailboxPackageTrackingSystem(createMockHomey());
    await sys.initialize();
    const mailbox = await sys.unlockMailbox('package-box');
    assertEqual(mailbox.status.lockStatus, 'unlocked');
    cleanup(sys);
  });

  it('unlockMailbox throws for non-remote-unlock mailbox', async () => {
    const sys = new MailboxPackageTrackingSystem(createMockHomey());
    await sys.initialize();
    try {
      await sys.unlockMailbox('main-mailbox');
      assert(false, 'should have thrown');
    } catch (e) {
      assert(e.message, 'should have error message');
    }
    cleanup(sys);
  });
});

describe('MailboxPackageTrackingSystem — deliveries', () => {
  it('detectDelivery records delivery', async () => {
    const sys = new MailboxPackageTrackingSystem(createMockHomey());
    await sys.initialize();
    const delivery = await sys.detectDelivery('main-mailbox', { type: 'mail', weight: 50 });
    assert(delivery, 'should return delivery');
    assert(delivery.id, 'should have id');
    assertEqual(delivery.type, 'mail');
    assertEqual(delivery.mailboxId, 'main-mailbox');
    assert(sys.deliveries.length >= 1, 'should have at least 1 delivery');
    cleanup(sys);
  });

  it('detectDelivery updates mailbox status', async () => {
    const sys = new MailboxPackageTrackingSystem(createMockHomey());
    await sys.initialize();
    await sys.detectDelivery('main-mailbox', { type: 'mail', weight: 100 });
    const mailbox = sys.getMailbox('main-mailbox');
    assertEqual(mailbox.status.hasNewMail, true);
    assert(mailbox.status.lastDelivery, 'should have lastDelivery');
    cleanup(sys);
  });

  it('detectDelivery throws for unknown mailbox', async () => {
    const sys = new MailboxPackageTrackingSystem(createMockHomey());
    await sys.initialize();
    try {
      await sys.detectDelivery('nonexistent', { type: 'mail' });
      assert(false, 'should have thrown');
    } catch (e) {
      assert(e.message, 'should have error message');
    }
    cleanup(sys);
  });

  it('getDeliveries returns deliveries', async () => {
    const sys = new MailboxPackageTrackingSystem(createMockHomey());
    await sys.initialize();
    await sys.detectDelivery('main-mailbox', { type: 'mail' });
    const deliveries = sys.getDeliveries();
    assert(Array.isArray(deliveries), 'should be array');
    assert(deliveries.length >= 1, 'should have at least 1');
    cleanup(sys);
  });

  it('getDeliveries filters by mailboxId', async () => {
    const sys = new MailboxPackageTrackingSystem(createMockHomey());
    await sys.initialize();
    await sys.detectDelivery('main-mailbox', { type: 'mail' });
    const deliveries = sys.getDeliveries('package-box');
    assertEqual(deliveries.length, 0);
    cleanup(sys);
  });
});

describe('MailboxPackageTrackingSystem — packages', () => {
  it('addExpectedPackage adds package', async () => {
    const sys = new MailboxPackageTrackingSystem(createMockHomey());
    await sys.initialize();
    const pkg = await sys.addExpectedPackage({
      trackingNumber: 'TRK123',
      carrier: 'PostNord',
      description: 'Test Package',
      expectedDelivery: new Date(Date.now() + 86400000).toISOString()
    });
    assert(pkg, 'should return package');
    assert(pkg.id, 'should have id');
    assertEqual(pkg.carrier, 'PostNord');
    assertEqual(pkg.status, 'expected');
    assert(sys.packages.has(pkg.id), 'should be stored');
    cleanup(sys);
  });

  it('getPackages returns all packages', async () => {
    const sys = new MailboxPackageTrackingSystem(createMockHomey());
    await sys.initialize();
    await sys.addExpectedPackage({ trackingNumber: 'T1', carrier: 'DHL', expectedDelivery: new Date().toISOString() });
    const packages = sys.getPackages();
    assert(Array.isArray(packages), 'should be array');
    assert(packages.length >= 1, 'should have at least 1');
    cleanup(sys);
  });

  it('getPackages filters by status', async () => {
    const sys = new MailboxPackageTrackingSystem(createMockHomey());
    await sys.initialize();
    await sys.addExpectedPackage({ trackingNumber: 'T1', carrier: 'DHL', expectedDelivery: new Date().toISOString() });
    const expected = sys.getPackages('expected');
    assert(expected.length >= 1, 'should have expected packages');
    const delivered = sys.getPackages('delivered');
    assertEqual(delivered.length, 0);
    cleanup(sys);
  });

  it('getPackage returns specific package', async () => {
    const sys = new MailboxPackageTrackingSystem(createMockHomey());
    await sys.initialize();
    const pkg = await sys.addExpectedPackage({ trackingNumber: 'T1', carrier: 'DHL', expectedDelivery: new Date().toISOString() });
    const found = sys.getPackage(pkg.id);
    assert(found, 'should return package');
    assertEqual(found.trackingNumber, 'T1');
    cleanup(sys);
  });
});

describe('MailboxPackageTrackingSystem — delivery codes', () => {
  it('generateDeliveryCode creates code', async () => {
    const sys = new MailboxPackageTrackingSystem(createMockHomey());
    await sys.initialize();
    const accessCode = await sys.generateDeliveryCode('package-box', 'PostNord');
    assert(accessCode, 'should return access code');
    assert(accessCode.code, 'should have code');
    assertEqual(accessCode.carrier, 'PostNord');
    assertEqual(accessCode.singleUse, true);
    cleanup(sys);
  });

  it('generateDeliveryCode throws for non-remote-unlock', async () => {
    const sys = new MailboxPackageTrackingSystem(createMockHomey());
    await sys.initialize();
    try {
      await sys.generateDeliveryCode('main-mailbox', 'PostNord');
      assert(false, 'should have thrown');
    } catch (e) {
      assert(e.message, 'should have error message');
    }
    cleanup(sys);
  });

  it('verifyDeliveryCode verifies existing code', async () => {
    const sys = new MailboxPackageTrackingSystem(createMockHomey());
    await sys.initialize();
    const accessCode = await sys.generateDeliveryCode('package-box', 'TestCarrier');
    const result = await sys.verifyDeliveryCode('package-box', accessCode.code);
    assertEqual(result, true);
    cleanup(sys);
  });

  it('verifyDeliveryCode rejects invalid code', async () => {
    const sys = new MailboxPackageTrackingSystem(createMockHomey());
    await sys.initialize();
    const result = await sys.verifyDeliveryCode('package-box', '0000');
    assertEqual(result, false);
    cleanup(sys);
  });
});

describe('MailboxPackageTrackingSystem — stats', () => {
  it('getStats returns statistics', async () => {
    const sys = new MailboxPackageTrackingSystem(createMockHomey());
    await sys.initialize();
    const stats = sys.getStats();
    assert(stats, 'should return stats');
    assertType(stats.totalMailboxes, 'number');
    assert(stats.totalMailboxes >= 2, 'should have at least 2 mailboxes');
    assertType(stats.expectedPackages, 'number');
    assertType(stats.deliveredPackages, 'number');
    assert(stats.last30Days, 'should have last30Days');
    assertType(stats.last30Days.totalDeliveries, 'number');
    cleanup(sys);
  });
});

run();
