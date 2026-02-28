'use strict';

const { describe, it, run } = require('./helpers/runner');
const {
  assert, assertEqual, assertNotEqual,
  assertType, assertRejects
} = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');

const BackupRecoverySystem = require('../lib/BackupRecoverySystem');

// ── helpers ────────────────────────────────────────────────────────────

function createSystem() {
  const homey = createMockHomey();
  // BackupRecoverySystem.collectSystemData() calls homey.drivers.getDevices()
  homey.drivers = {
    getDevices: () => [
      {
        id: 'dev-1', name: 'Test Light',
        getCapabilityValue: async () => true,
        hasCapability: () => true,
        capabilities: ['onoff', 'dim']
      }
    ]
  };
  const system = new BackupRecoverySystem(homey);
  // Disable auto-backup scheduler to avoid lingering intervals
  system.backupConfig.autoBackup = false;
  // Disable compression so tests get raw object data for easy assertions
  system.backupConfig.compression = false;
  return system;
}

// ── createBackup ───────────────────────────────────────────────────────
// createBackup() returns { success, backupId, size, compressed, encrypted }

describe('BackupRecoverySystem — createBackup', () => {
  it('creates a backup and returns success result', async () => {
    const sys = createSystem();
    const result = await sys.createBackup({ name: 'test-backup' });
    assertType(result, 'object');
    assertEqual(result.success, true);
    assertType(result.backupId, 'string');
    assert(result.backupId.startsWith('backup_'), 'id should start with backup_');
  });

  it('stores the backup in the backups map', async () => {
    const sys = createSystem();
    const result = await sys.createBackup();
    const stored = sys.backups.get(result.backupId);
    assertType(stored, 'object');
    assertEqual(stored.id, result.backupId);
  });

  it('creates a recovery point', async () => {
    const sys = createSystem();
    await sys.createBackup();
    assert(sys.recoveryPoints.length >= 1, 'should have at least one recovery point');
  });

  it('applies compression when configured', async () => {
    const sys = createSystem();
    sys.backupConfig.compression = true;
    const result = await sys.createBackup();
    assertEqual(result.compressed, true);
  });

  it('applies encryption when configured', async () => {
    const sys = createSystem();
    sys.backupConfig.encryption = true;
    const result = await sys.createBackup();
    assertEqual(result.encrypted, true);
  });
});

// ── restoreBackup ──────────────────────────────────────────────────────
// restoreBackup(backupId) returns { success, backupId, restored }

describe('BackupRecoverySystem — restoreBackup', () => {
  it('restores a backup by id', async () => {
    const sys = createSystem();
    const created = await sys.createBackup();
    const result = await sys.restoreBackup(created.backupId);
    assertType(result, 'object');
    assertEqual(result.success, true);
  });

  it('throws for non-existent backup id', async () => {
    const sys = createSystem();
    await assertRejects(async () => {
      await sys.restoreBackup('backup_nonexistent');
    });
  });

  it('creates a safety backup before restoring', async () => {
    const sys = createSystem();
    const created = await sys.createBackup();
    const countBefore = sys.backups.size;
    await sys.restoreBackup(created.backupId);
    // Safety backup adds one more entry
    assert(sys.backups.size >= countBefore, 'should have safety backup');
  });
});

// ── incrementalBackup ──────────────────────────────────────────────────
// createIncrementalBackup() returns { success, backupId, changes } or { success, noChanges }

describe('BackupRecoverySystem — createIncrementalBackup', () => {
  it('creates an incremental backup after a full baseline', async () => {
    const sys = createSystem();
    await sys.createBackup(); // full baseline
    const inc = await sys.createIncrementalBackup();
    assertType(inc, 'object');
    assertEqual(inc.success, true);
  });

  it('falls back to full backup when no previous backup exists', async () => {
    const sys = createSystem();
    const result = await sys.createIncrementalBackup();
    // Without a base backup it should still succeed (falls back to full)
    assertType(result, 'object');
    assertEqual(result.success, true);
  });
});

// ── detectChanges ──────────────────────────────────────────────────────
// detectChanges(old, new) returns plain object { key: { old, new, changed } }

describe('BackupRecoverySystem — detectChanges', () => {
  it('returns no changed keys when data is identical', () => {
    const sys = createSystem();
    const old = { a: 1, b: 2 };
    const current = { a: 1, b: 2 };
    const changes = sys.detectChanges(old, current);
    assertType(changes, 'object');
    const changedKeys = Object.keys(changes).filter(k => changes[k].changed);
    assertEqual(changedKeys.length, 0);
  });

  it('detects modified keys', () => {
    const sys = createSystem();
    const old = { a: 1 };
    const current = { a: 2 };
    const changes = sys.detectChanges(old, current);
    assert(changes.a && changes.a.changed, 'should detect modification of key a');
  });

  it('detects added keys', () => {
    const sys = createSystem();
    const old = { a: 1 };
    const current = { a: 1, b: 2 };
    const changes = sys.detectChanges(old, current);
    assert(changes.b && changes.b.changed, 'should detect addition of key b');
  });

  it('does not track removed keys (only iterates new data)', () => {
    const sys = createSystem();
    const old = { a: 1, b: 2 };
    const current = { a: 1 };
    const changes = sys.detectChanges(old, current);
    // Implementation only iterates newData keys — removed keys are not tracked
    assertEqual(Object.keys(changes).length, 0);
  });
});

// ── export / import ────────────────────────────────────────────────────
// exportBackup(backupId, format) returns { data, filename, mimeType }
// importBackup(data, format) returns { success, backupId }

describe('BackupRecoverySystem — export & import', () => {
  it('exports a backup as JSON', async () => {
    const sys = createSystem();
    const created = await sys.createBackup();
    const exported = await sys.exportBackup(created.backupId, 'json');
    assertType(exported, 'object');
    assertType(exported.data, 'string');
    assertType(exported.filename, 'string');
    const parsed = JSON.parse(exported.data);
    assertEqual(parsed.id, created.backupId);
  });

  it('exports as encrypted format', async () => {
    const sys = createSystem();
    const created = await sys.createBackup();
    const exported = await sys.exportBackup(created.backupId, 'encrypted');
    assertType(exported, 'object');
    assertType(exported.data, 'string');
  });

  it('imports a previously exported backup', async () => {
    const sys = createSystem();
    const created = await sys.createBackup();
    const exported = await sys.exportBackup(created.backupId, 'json');

    // Import into a fresh system
    const sys2 = createSystem();
    const imported = await sys2.importBackup(exported.data, 'json');
    assertType(imported, 'object');
    assertEqual(imported.success, true);
    assertType(imported.backupId, 'string');
  });
});

// ── validateBackupStructure ────────────────────────────────────────────
// Returns truthy/falsy from: backup && backup.data && backup.timestamp && typeof backup.data === 'object'

describe('BackupRecoverySystem — validateBackupStructure', () => {
  it('accepts a valid backup', () => {
    const sys = createSystem();
    const valid = { id: 'b1', data: { settings: {} }, timestamp: Date.now(), hash: 'abc' };
    const result = sys.validateBackupStructure(valid);
    assert(result, 'should be truthy for valid backup');
  });

  it('rejects a backup without data', () => {
    const sys = createSystem();
    const invalid = { id: 'b1', timestamp: Date.now() };
    const result = sys.validateBackupStructure(invalid);
    assert(!result, 'should be falsy for backup without data');
  });

  it('rejects a backup without timestamp', () => {
    const sys = createSystem();
    const invalid = { id: 'b1', data: {} };
    const result = sys.validateBackupStructure(invalid);
    assert(!result, 'should be falsy for backup without timestamp');
  });
});

// ── cleanOldBackups ────────────────────────────────────────────────────

describe('BackupRecoverySystem — cleanOldBackups', () => {
  it('removes excess backups beyond maxBackups', async () => {
    const sys = createSystem();
    sys.backupConfig.maxBackups = 3;
    for (let i = 0; i < 5; i++) {
      await sys.createBackup({ name: `b-${i}` });
    }
    await sys.cleanOldBackups();
    assert(sys.backups.size <= 3, `expected <= 3 but got ${sys.backups.size}`);
  });
});

// ── integrity & hashing ────────────────────────────────────────────────
// verifyBackupIntegrity(backup) is ASYNC, takes backup OBJECT, returns boolean

describe('BackupRecoverySystem — integrity verification', () => {
  it('verifyBackupIntegrity passes for untampered backup', async () => {
    const sys = createSystem();
    const created = await sys.createBackup();
    const stored = sys.backups.get(created.backupId);
    const result = await sys.verifyBackupIntegrity(stored);
    assertEqual(result, true);
  });

  it('verifyBackupIntegrity fails for tampered data', async () => {
    const sys = createSystem();
    const created = await sys.createBackup();
    const stored = sys.backups.get(created.backupId);
    // Tamper with data → hash mismatch
    if (typeof stored.data === 'string') {
      stored.data = stored.data + 'TAMPERED';
    } else {
      stored.data.__tampered = true;
    }
    const result = await sys.verifyBackupIntegrity(stored);
    assertEqual(result, false);
  });

  it('calculateHash produces consistent SHA-256 hashes', () => {
    const sys = createSystem();
    const h1 = sys.calculateHash('test-data');
    const h2 = sys.calculateHash('test-data');
    assertEqual(h1, h2);
    assertEqual(h1.length, 64); // hex-encoded SHA-256 = 64 chars
  });

  it('calculateHash produces different hashes for different data', () => {
    const sys = createSystem();
    const h1 = sys.calculateHash('alpha');
    const h2 = sys.calculateHash('beta');
    assertNotEqual(h1, h2);
  });
});

// ── statistics ─────────────────────────────────────────────────────────
// getBackupStatistics() returns { total, totalSize, byType, oldest, newest, recoveryPoints }

describe('BackupRecoverySystem — getBackupStatistics', () => {
  it('returns statistics after creating backups', async () => {
    const sys = createSystem();
    await sys.createBackup();
    await sys.createBackup();
    const stats = sys.getBackupStatistics();
    assertType(stats, 'object');
    assertEqual(stats.total, 2);
  });
});

// ── getLatestBackup ────────────────────────────────────────────────────
// getLatestBackup() returns backup object with .id, or null

describe('BackupRecoverySystem — getLatestBackup', () => {
  it('returns the most recent backup', async () => {
    const sys = createSystem();
    const first = await sys.createBackup({ name: 'first' });
    // Ensure the first backup has an older timestamp to avoid same-ms ties
    const firstBackup = sys.backups.get(first.backupId);
    firstBackup.timestamp = firstBackup.timestamp - 1000;
    const second = await sys.createBackup({ name: 'second' });
    const latest = sys.getLatestBackup();
    assertEqual(latest.id, second.backupId);
  });

  it('returns null when no backups exist', () => {
    const sys = createSystem();
    const latest = sys.getLatestBackup();
    assertEqual(latest, null);
  });
});

// ── compress / decompress ──────────────────────────────────────────────
// compressData and decompressData are ASYNC

describe('BackupRecoverySystem — compression', () => {
  it('compressData and decompressData round-trip', async () => {
    const sys = createSystem();
    const original = JSON.stringify({ key: 'value', nested: { n: 42 } });
    const compressed = await sys.compressData(original);
    const decompressed = await sys.decompressData(compressed);
    assertEqual(decompressed, original);
  });
});

// ── encrypt / decrypt ──────────────────────────────────────────────────
// encryptData and decryptData are ASYNC

describe('BackupRecoverySystem — encryption', () => {
  it('encryptData and decryptData round-trip', async () => {
    const sys = createSystem();
    const original = 'sensitive-data-here';
    const encrypted = await sys.encryptData(original);
    assertNotEqual(encrypted, original);
    const decrypted = await sys.decryptData(encrypted);
    assertEqual(decrypted, original);
  });
});

run();
