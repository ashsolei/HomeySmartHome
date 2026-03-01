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
const DeviceFirmwareOTASystem = require('../lib/DeviceFirmwareOTASystem');

function createSystem() {
  const homey = createMockHomey();
  const sys = new DeviceFirmwareOTASystem(homey);
  return sys;
}

async function createInitialized() {
  const sys = createSystem();
  await sys.initialize();
  return sys;
}

/* ════════════════════════════════════════════════════════════════════ */
/*  TESTS                                                              */
/* ════════════════════════════════════════════════════════════════════ */

describe('DeviceFirmwareOTASystem', () => {

  // ── constructor ──────────────────────────────────────────────────

  describe('constructor', () => {
    it('creates instance with expected defaults', () => {
      const sys = createSystem();
      try {
        assertEqual(sys.devices.size, 0);
        assertEqual(sys.updateHistory.length, 0);
        assertEqual(sys.scheduledUpdates.size, 0);
        assertType(sys.firmwareRegistry, 'object');
        assert(Object.keys(sys.firmwareRegistry).length > 0, 'should have firmware entries');
      } finally { cleanup(sys); }
    });
  });

  // ── initialize ───────────────────────────────────────────────────

  describe('initialize', () => {
    it('initializes without error', async () => {
      const sys = await createInitialized();
      try {
        assert(sys._checkTimer !== null, 'check timer should be set');
      } finally { cleanup(sys); }
    });
  });

  // ── registerDevice ───────────────────────────────────────────────

  describe('registerDevice', () => {
    it('registers a device', async () => {
      const sys = await createInitialized();
      try {
        const device = sys.registerDevice('dev-1', '2.0.0', 'zigbee');
        assertEqual(device.deviceId, 'dev-1');
        assertEqual(device.currentVersion, '2.0.0');
        assertEqual(device.protocol, 'zigbee');
        assertEqual(device.updateStatus, 'idle');
        assertEqual(sys.devices.size, 1);
      } finally { cleanup(sys); }
    });

    it('throws for missing parameters', async () => {
      const sys = await createInitialized();
      try {
        let threw = false;
        try { sys.registerDevice(null, '1.0.0', 'zigbee'); } catch (_) { threw = true; }
        assert(threw, 'should throw for missing deviceId');

        threw = false;
        try { sys.registerDevice('dev-1', null, 'zigbee'); } catch (_) { threw = true; }
        assert(threw, 'should throw for missing version');

        threw = false;
        try { sys.registerDevice('dev-1', '1.0.0', null); } catch (_) { threw = true; }
        assert(threw, 'should throw for missing protocol');
      } finally { cleanup(sys); }
    });

    it('throws for unsupported protocol', async () => {
      const sys = await createInitialized();
      try {
        let threw = false;
        try { sys.registerDevice('dev-1', '1.0.0', 'bluetooth'); } catch (_) { threw = true; }
        assert(threw, 'should throw for unsupported protocol');
      } finally { cleanup(sys); }
    });
  });

  // ── checkForUpdates ──────────────────────────────────────────────

  describe('checkForUpdates', () => {
    it('returns update status for all devices', async () => {
      const sys = await createInitialized();
      try {
        sys.registerDevice('dev-1', '1.0.0', 'zigbee');
        sys.registerDevice('dev-2', '7.18.3', 'zwave');

        const updates = sys.checkForUpdates();
        assertEqual(updates.length, 2);

        const dev1 = updates.find(u => u.deviceId === 'dev-1');
        assertEqual(dev1.updateAvailable, true);
        assertEqual(dev1.latestVersion, '3.2.1');

        const dev2 = updates.find(u => u.deviceId === 'dev-2');
        assertEqual(dev2.updateAvailable, false);
      } finally { cleanup(sys); }
    });

    it('returns empty array when no devices', async () => {
      const sys = await createInitialized();
      try {
        const updates = sys.checkForUpdates();
        assertEqual(updates.length, 0);
      } finally { cleanup(sys); }
    });
  });

  // ── scheduleUpdate ───────────────────────────────────────────────

  describe('scheduleUpdate', () => {
    it('schedules a firmware update', async () => {
      const sys = await createInitialized();
      try {
        sys.registerDevice('dev-1', '1.0.0', 'zigbee');
        const schedule = sys.scheduleUpdate('dev-1', '3.2.1');
        assertEqual(schedule.deviceId, 'dev-1');
        assertEqual(schedule.targetVersion, '3.2.1');
        assertEqual(schedule.status, 'scheduled');
        assertType(schedule.scheduledAt, 'string');
        assertType(schedule.createdAt, 'string');
      } finally { cleanup(sys); }
    });

    it('throws for non-existent device', async () => {
      const sys = await createInitialized();
      try {
        let threw = false;
        try { sys.scheduleUpdate('bad-id', '1.0.0'); } catch (_) { threw = true; }
        assert(threw, 'should throw for non-existent device');
      } finally { cleanup(sys); }
    });

    it('throws when version is missing', async () => {
      const sys = await createInitialized();
      try {
        sys.registerDevice('dev-1', '1.0.0', 'zigbee');
        let threw = false;
        try { sys.scheduleUpdate('dev-1', null); } catch (_) { threw = true; }
        assert(threw, 'should throw for missing version');
      } finally { cleanup(sys); }
    });
  });

  // ── getUpdateStatus ──────────────────────────────────────────────

  describe('getUpdateStatus', () => {
    it('returns status for a registered device', async () => {
      const sys = await createInitialized();
      try {
        sys.registerDevice('dev-1', '1.0.0', 'zigbee');
        const status = sys.getUpdateStatus('dev-1');
        assertEqual(status.deviceId, 'dev-1');
        assertEqual(status.currentVersion, '1.0.0');
        assertEqual(status.latestVersion, '3.2.1');
        assertEqual(status.updateStatus, 'idle');
      } finally { cleanup(sys); }
    });

    it('includes scheduled update info', async () => {
      const sys = await createInitialized();
      try {
        sys.registerDevice('dev-1', '1.0.0', 'zigbee');
        sys.scheduleUpdate('dev-1', '3.2.1');
        const status = sys.getUpdateStatus('dev-1');
        assertEqual(status.updateStatus, 'scheduled');
        assert(status.scheduledUpdate !== null, 'should have scheduled update');
      } finally { cleanup(sys); }
    });

    it('throws for non-existent device', async () => {
      const sys = await createInitialized();
      try {
        let threw = false;
        try { sys.getUpdateStatus('bad-id'); } catch (_) { threw = true; }
        assert(threw, 'should throw for non-existent device');
      } finally { cleanup(sys); }
    });
  });

  // ── getPendingUpdates ────────────────────────────────────────────

  describe('getPendingUpdates', () => {
    it('returns pending updates', async () => {
      const sys = await createInitialized();
      try {
        sys.registerDevice('dev-1', '1.0.0', 'zigbee');
        sys.registerDevice('dev-2', '1.0.0', 'wifi');
        sys.scheduleUpdate('dev-1', '3.2.1');
        sys.scheduleUpdate('dev-2', '2.5.0');
        const pending = sys.getPendingUpdates();
        assertEqual(pending.length, 2);
      } finally { cleanup(sys); }
    });

    it('returns empty when no pending', async () => {
      const sys = await createInitialized();
      try {
        const pending = sys.getPendingUpdates();
        assertEqual(pending.length, 0);
      } finally { cleanup(sys); }
    });
  });

  // ── getUpdateHistory ─────────────────────────────────────────────

  describe('getUpdateHistory', () => {
    it('returns empty array initially', async () => {
      const sys = await createInitialized();
      try {
        const history = sys.getUpdateHistory();
        assertEqual(history.length, 0);
      } finally { cleanup(sys); }
    });
  });

  // ── getStatistics ────────────────────────────────────────────────

  describe('getStatistics', () => {
    it('returns statistics', async () => {
      const sys = await createInitialized();
      try {
        sys.registerDevice('dev-1', '1.0.0', 'zigbee');
        const stats = sys.getStatistics();
        assertEqual(stats.totalDevices, 1);
        assertType(stats.pendingUpdates, 'number');
        assertType(stats.completedUpdates, 'number');
        assertType(stats.outdatedDevices, 'number');
        assert(Array.isArray(stats.supportedProtocols), 'supportedProtocols should be array');
      } finally { cleanup(sys); }
    });
  });

  // ── _compareVersions ─────────────────────────────────────────────

  describe('_compareVersions', () => {
    it('correctly compares versions', () => {
      const sys = createSystem();
      try {
        assertEqual(sys._compareVersions('1.0.0', '2.0.0'), -1);
        assertEqual(sys._compareVersions('2.0.0', '1.0.0'), 1);
        assertEqual(sys._compareVersions('1.0.0', '1.0.0'), 0);
        assertEqual(sys._compareVersions('1.2.3', '1.2.4'), -1);
        assertEqual(sys._compareVersions('1.2.3', '1.3.0'), -1);
        assertEqual(sys._compareVersions('3.2.1', '3.2.1'), 0);
      } finally { cleanup(sys); }
    });
  });

  // ── destroy ──────────────────────────────────────────────────────

  describe('destroy', () => {
    it('clears all state', async () => {
      const sys = await createInitialized();
      sys.registerDevice('dev-1', '1.0.0', 'zigbee');
      sys.destroy();
      assertEqual(sys.devices.size, 0);
      assertEqual(sys.scheduledUpdates.size, 0);
      assertEqual(sys.updateHistory.length, 0);
      assertEqual(sys._checkTimer, null);
    });
  });
});

run();
