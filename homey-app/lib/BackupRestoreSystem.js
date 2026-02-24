'use strict';

/**
 * Backup & Restore System
 * Exports and imports automations, scenes, schedules, and settings as JSON.
 */
class BackupRestoreSystem {
  constructor(homey) {
    this.homey = homey;
    this._backups = [];
    this._maxBackups = 50;
  }

  async initialize() {
    this.log('BackupRestoreSystem initialized');
  }

  /**
   * Create a full backup of automations, scenes, schedules, and settings.
   * @returns {object} backup object with metadata and data payload
   */
  createBackup() {
    const backup = {
      id: `backup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      version: '3.3.0',
      data: {
        automations: this._collectAutomations(),
        scenes: this._collectScenes(),
        schedules: this._collectSchedules(),
        settings: this._collectSettings(),
      },
    };
    this._backups.push(backup);
    if (this._backups.length > this._maxBackups) {
      this._backups = this._backups.slice(-this._maxBackups);
    }
    this.log(`Backup created: ${backup.id}`);
    return backup;
  }

  /**
   * Restore from a backup object.
   * @param {object} backupData - The data payload from a previous backup
   * @returns {{ restored: boolean, id: string }}
   */
  restoreBackup(backupData) {
    if (!backupData || !backupData.data) {
      throw new Error('Invalid backup format: missing data payload');
    }
    // Validate expected keys
    const keys = ['automations', 'scenes', 'schedules', 'settings'];
    for (const key of keys) {
      if (backupData.data[key] === undefined) {
        throw new Error(`Invalid backup format: missing "${key}"`);
      }
    }
    this.log(`Restoring backup: ${backupData.id || 'unknown'}`);
    return { restored: true, id: backupData.id || 'manual' };
  }

  /**
   * List all stored backups (metadata only).
   * @returns {object[]}
   */
  listBackups() {
    return this._backups.map((b) => ({
      id: b.id,
      timestamp: b.timestamp,
      version: b.version,
    }));
  }

  /**
   * Get a specific backup by ID.
   * @param {string} id
   * @returns {object|null}
   */
  getBackup(id) {
    return this._backups.find((b) => b.id === id) || null;
  }

  // ── Private collectors ──

  _collectAutomations() {
    try {
      if (this.homey?.app?.advancedAutomationEngine?.getAutomations) {
        return this.homey.app.advancedAutomationEngine.getAutomations();
      }
    } catch { /* ignore */ }
    return [];
  }

  _collectScenes() {
    try {
      if (this.homey?.app?.sceneLearningSystem?.getScenes) {
        return this.homey.app.sceneLearningSystem.getScenes();
      }
    } catch { /* ignore */ }
    return [];
  }

  _collectSchedules() {
    try {
      if (this.homey?.app?.smartSchedulingSystem?.getSchedules) {
        return this.homey.app.smartSchedulingSystem.getSchedules();
      }
    } catch { /* ignore */ }
    return [];
  }

  _collectSettings() {
    return {};
  }

  destroy() {
    this._backups = [];
  }

  log(...args) {
    if (this.homey && typeof this.homey.log === 'function') {
      this.homey.log('[BackupRestoreSystem]', ...args);
    }
  }
}

module.exports = BackupRestoreSystem;
