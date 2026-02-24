'use strict';

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * Backup & Recovery System
 *
 * Automated backups, incremental saves, and disaster recovery.
 * Supports full and incremental backups with optional compression
 * and encryption, automatic scheduling, and selective restore.
 */
class BackupRecoverySystem {
  /**
   * @param {import('homey').Homey} homey - Homey app instance
   */
  constructor(homey) {
    this.homey = homey;
    this.backups = new Map();
    this.backupSchedule = null;
    this.recoveryPoints = [];
    this.backupConfig = {
      autoBackup: true,
      interval: 86400000, // 24 hours
      maxBackups: 30,
      compression: true,
      encryption: false
    };
  }

  async initialize() {
    this.log('Initializing Backup & Recovery System...');
    
    // Load backup configuration
    const savedConfig = await this.homey.settings.get('backupConfig');
    if (savedConfig) {
      this.backupConfig = { ...this.backupConfig, ...savedConfig };
    }

    // Load backup history
    const savedBackups = await this.homey.settings.get('backupHistory') || {};
    Object.entries(savedBackups).forEach(([id, backup]) => {
      this.backups.set(id, backup);
    });

    // Start automatic backup scheduler
    if (this.backupConfig.autoBackup) {
      await this.startBackupScheduler();
    }

    // Create initial backup if none exists
    if (this.backups.size === 0) {
      await this.createBackup({ type: 'initial', description: 'Initial system backup' });
    }

    this.log('Backup & Recovery System initialized');
  }

  /**
   * Start automatic backup scheduler
   */
  async startBackupScheduler() {
    this.backupSchedule = setInterval(async () => {
      await this.createBackup({ type: 'automatic', description: 'Scheduled backup' });
    }, this.backupConfig.interval);

    this.log('Automatic backup scheduler started');
  }

  /**
   * Create a full system backup.
   *
   * Collects all system data, optionally compresses/encrypts it,
   * stores it in memory, prunes old backups, and creates a recovery point.
   *
   * @param {{type?: string, description?: string}} [options] - Backup options
   * @returns {Promise<{success: boolean, backupId: string, size: number, compressed: boolean, encrypted: boolean}>}
   * @throws {Error} When data collection or storage fails
   */
  async createBackup(options = {}) {
    this.log('Creating system backup...');

    const backupId = this.generateBackupId();
    const timestamp = Date.now();

    try {
      // Collect all system data
      const backupData = {
        id: backupId,
        timestamp,
        version: await this.getSystemVersion(),
        type: options.type || 'manual',
        description: options.description || 'Manual backup',
        data: await this.collectSystemData(),
        metadata: {
          size: 0,
          compressed: this.backupConfig.compression,
          encrypted: this.backupConfig.encryption,
          integrity: null
        }
      };

      // Calculate size
      const dataSize = JSON.stringify(backupData.data).length;
      backupData.metadata.size = dataSize;

      // Compress if enabled
      if (this.backupConfig.compression) {
        backupData.data = await this.compressData(backupData.data);
      }

      // Encrypt if enabled
      if (this.backupConfig.encryption) {
        backupData.data = await this.encryptData(backupData.data);
      }

      // Calculate integrity hash
      backupData.metadata.integrity = this.calculateHash(JSON.stringify(backupData.data));

      // Store backup
      this.backups.set(backupId, backupData);
      await this.saveBackupHistory();

      // Clean old backups
      await this.cleanOldBackups();

      // Create recovery point
      await this.createRecoveryPoint(backupId);

      this.log(`Backup created successfully: ${backupId} (${this.formatSize(dataSize)})`);

      // Notify user
      await this.notifyBackupComplete(backupData);

      return {
        success: true,
        backupId,
        size: dataSize,
        compressed: this.backupConfig.compression,
        encrypted: this.backupConfig.encryption
      };

    } catch (error) {
      this.error('Backup creation failed:', error);
      
      await this.homey.notifications.createNotification({
        excerpt: `Backup misslyckades: ${error.message}`
      });

      throw error;
    }
  }

  /**
   * Collect all system data for backup
   */
  async collectSystemData() {
    const data = {
      timestamp: Date.now(),
      settings: {},
      devices: {},
      scenes: {},
      automations: {},
      users: {},
      history: {},
      analytics: {}
    };

    try {
      // Core settings
      data.settings = {
        securityMode: await this.homey.settings.get('securityMode'),
        scenes: await this.homey.settings.get('scenes'),
        routines: await this.homey.settings.get('routines'),
        notificationPreferences: await this.homey.settings.get('notificationPreferences')
      };

      // Device configurations
      const devices = this.homey.drivers.getDevices();
      for (const device of devices) {
        data.devices[device.id] = {
          id: device.id,
          name: device.name,
          driverClass: device.driver?.id,
          zone: device.zone?.name,
          capabilities: device.capabilities,
          settings: device.settings
        };
      }

      // Advanced system data
      data.automations = {
        automationEngine: await this.homey.settings.get('automations'),
        scheduledTasks: await this.homey.settings.get('scheduledTasks'),
        learnedScenes: await this.homey.settings.get('learnedScenes'),
        geofences: await this.homey.settings.get('geofences')
      };

      // User data
      data.users = {
        users: await this.homey.settings.get('users'),
        userPreferences: await this.homey.settings.get('userPreferences'),
        userProfiles: await this.homey.settings.get('userProfiles')
      };

      // Integrations
      data.integrations = {
        webhooks: await this.homey.settings.get('webhooks'),
        apiConnectors: await this.homey.settings.get('apiConnectors'),
        integrations: await this.homey.settings.get('integrations')
      };

      // Historical data (limited)
      data.history = {
        deviceHealth: await this.homey.settings.get('deviceHealth'),
        notificationHistory: (await this.homey.settings.get('notificationHistory') || []).slice(-100),
        executionHistory: (await this.homey.settings.get('executionHistory') || []).slice(-100)
      };

      // Analytics (last 7 days)
      data.analytics = {
        energyData: (await this.homey.settings.get('energyHistoricalData') || []).slice(-2000)
      };

    } catch (error) {
      this.error('Error collecting system data:', error);
    }

    return data;
  }

  /**
   * Restore the system from a previously created backup.
   *
   * Verifies integrity, creates a safety backup (unless skipped),
   * decrypts/decompresses as needed, and selectively restores data
   * categories (settings, devices, automations, users, integrations, history).
   *
   * @param {string} backupId - ID of the backup to restore
   * @param {{skipIntegrityCheck?: boolean, skipSafetyBackup?: boolean, settings?: boolean, devices?: boolean, automations?: boolean, users?: boolean, integrations?: boolean, history?: boolean, reinitialize?: boolean}} [options] - Restore options
   * @returns {Promise<{success: boolean, backupId: string, restored: number}>}
   * @throws {Error} When backup is not found or integrity check fails
   */
  async restoreBackup(backupId, options = {}) {
    this.log(`Restoring from backup: ${backupId}`);

    const backup = this.backups.get(backupId);
    if (!backup) {
      throw new Error('Backup not found');
    }

    try {
      // Verify integrity
      if (!options.skipIntegrityCheck) {
        const valid = await this.verifyBackupIntegrity(backup);
        if (!valid) {
          throw new Error('Backup integrity check failed');
        }
      }

      // Create safety backup before restore
      if (!options.skipSafetyBackup) {
        await this.createBackup({
          type: 'pre_restore',
          description: `Safety backup before restoring ${backupId}`
        });
      }

      let data = backup.data;

      // Decrypt if needed
      if (backup.metadata.encrypted) {
        data = await this.decryptData(data);
      }

      // Decompress if needed
      if (backup.metadata.compressed) {
        data = await this.decompressData(data);
      }

      // Restore data selectively
      const restoreOptions = {
        settings: options.settings !== false,
        devices: options.devices !== false,
        automations: options.automations !== false,
        users: options.users !== false,
        integrations: options.integrations !== false,
        history: options.history || false
      };

      await this.restoreSystemData(data, restoreOptions);

      // Reinitialize systems
      if (options.reinitialize !== false) {
        await this.reinitializeSystems();
      }

      this.log('Backup restored successfully');

      await this.homey.notifications.createNotification({
        excerpt: `System återställt från backup: ${backup.description}`
      });

      return { success: true, backupId, restored: Date.now() };

    } catch (error) {
      this.error('Restore failed:', error);
      
      await this.homey.notifications.createNotification({
        excerpt: `Återställning misslyckades: ${error.message}`
      });

      throw error;
    }
  }

  /**
   * Restore system data
   */
  async restoreSystemData(data, options) {
    // Restore settings
    if (options.settings && data.settings) {
      for (const [key, value] of Object.entries(data.settings)) {
        await this.homey.settings.set(key, value);
      }
    }

    // Restore automations
    if (options.automations && data.automations) {
      for (const [key, value] of Object.entries(data.automations)) {
        await this.homey.settings.set(key, value);
      }
    }

    // Restore users
    if (options.users && data.users) {
      for (const [key, value] of Object.entries(data.users)) {
        await this.homey.settings.set(key, value);
      }
    }

    // Restore integrations
    if (options.integrations && data.integrations) {
      for (const [key, value] of Object.entries(data.integrations)) {
        await this.homey.settings.set(key, value);
      }
    }

    // Restore history (optional)
    if (options.history && data.history) {
      for (const [key, value] of Object.entries(data.history)) {
        await this.homey.settings.set(key, value);
      }
    }
  }

  /**
   * Create an incremental backup containing only the differences
   * since the last full or incremental backup.
   *
   * @returns {Promise<{success: boolean, backupId?: string, changes?: number, noChanges?: boolean}>}
   */
  async createIncrementalBackup() {
    const lastBackup = this.getLatestBackup();
    if (!lastBackup) {
      return await this.createBackup({ type: 'full' });
    }

    const currentData = await this.collectSystemData();
    const changes = this.detectChanges(lastBackup.data, currentData);

    if (Object.keys(changes).length === 0) {
      this.log('No changes detected, skipping incremental backup');
      return { success: true, noChanges: true };
    }

    const backupId = this.generateBackupId();
    const backup = {
      id: backupId,
      timestamp: Date.now(),
      type: 'incremental',
      baseBackupId: lastBackup.id,
      changes,
      metadata: {
        changeCount: Object.keys(changes).length,
        size: JSON.stringify(changes).length
      }
    };

    this.backups.set(backupId, backup);
    await this.saveBackupHistory();

    this.log(`Incremental backup created: ${backupId} (${backup.metadata.changeCount} changes)`);

    return { success: true, backupId, changes: backup.metadata.changeCount };
  }

  /**
   * Detect changes between two datasets
   */
  detectChanges(oldData, newData) {
    const changes = {};

    for (const [key, newValue] of Object.entries(newData)) {
      const oldValue = oldData[key];
      
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes[key] = {
          old: oldValue,
          new: newValue,
          changed: Date.now()
        };
      }
    }

    return changes;
  }

  /**
   * Create recovery point
   */
  async createRecoveryPoint(backupId) {
    const recoveryPoint = {
      id: this.generateRecoveryPointId(),
      backupId,
      timestamp: Date.now(),
      systemState: await this.captureSystemState()
    };

    this.recoveryPoints.push(recoveryPoint);

    // Keep only last 10 recovery points
    if (this.recoveryPoints.length > 10) {
      this.recoveryPoints.shift();
    }

    await this.homey.settings.set('recoveryPoints', this.recoveryPoints);
  }

  /**
   * Capture current system state
   */
  async captureSystemState() {
    return {
      timestamp: Date.now(),
      activeDevices: this.homey.drivers.getDevices().length,
      activeAutomations: (await this.homey.settings.get('automations') || []).length,
      users: (await this.homey.settings.get('users') || {}).size || 0,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    };
  }

  /**
   * Verify backup data integrity using SHA-256 hash comparison.
   *
   * @param {object} backup - Backup entry with `metadata.integrity` hash
   * @returns {Promise<boolean>} `true` if integrity matches or no hash is stored
   */
  async verifyBackupIntegrity(backup) {
    if (!backup.metadata.integrity) {
      return true; // No integrity check available
    }

    const calculatedHash = this.calculateHash(JSON.stringify(backup.data));
    return calculatedHash === backup.metadata.integrity;
  }

  /**
   * Export a backup to a downloadable format.
   *
   * @param {string} backupId - ID of the backup to export
   * @param {'json'|'encrypted'} [format='json'] - Export format
   * @returns {Promise<{data: string, filename: string, mimeType: string}>}
   * @throws {Error} When backup is not found or format is unsupported
   */
  async exportBackup(backupId, format = 'json') {
    const backup = this.backups.get(backupId);
    if (!backup) {
      throw new Error('Backup not found');
    }

    switch (format) {
      case 'json':
        return {
          data: JSON.stringify(backup, null, 2),
          filename: `homey_backup_${backupId}.json`,
          mimeType: 'application/json'
        };

      case 'encrypted':
        const encrypted = await this.encryptData(backup);
        return {
          data: encrypted,
          filename: `homey_backup_${backupId}.enc`,
          mimeType: 'application/octet-stream'
        };

      default:
        throw new Error('Unsupported export format');
    }
  }

  /**
   * Import a backup from an external source.
   *
   * @param {string} data - Raw backup data (JSON string or base64-encoded)
   * @param {'json'|'encrypted'} [format='json'] - Import format
   * @returns {Promise<{success: boolean, backupId: string}>}
   * @throws {Error} When format is unsupported or structure is invalid
   */
  async importBackup(data, format = 'json') {
    let backup;

    switch (format) {
      case 'json':
        backup = JSON.parse(data);
        break;

      case 'encrypted':
        backup = await this.decryptData(data);
        break;

      default:
        throw new Error('Unsupported import format');
    }

    // Validate backup structure
    if (!this.validateBackupStructure(backup)) {
      throw new Error('Invalid backup structure');
    }

    // Store imported backup
    const backupId = backup.id || this.generateBackupId();
    backup.imported = true;
    backup.importedAt = Date.now();

    this.backups.set(backupId, backup);
    await this.saveBackupHistory();

    return { success: true, backupId };
  }

  /**
   * Validate backup structure
   */
  validateBackupStructure(backup) {
    return backup && 
           backup.data && 
           backup.timestamp && 
           typeof backup.data === 'object';
  }

  /**
   * Clean old backups
   */
  async cleanOldBackups() {
    const backupArray = Array.from(this.backups.values())
      .sort((a, b) => b.timestamp - a.timestamp);

    // Remove backups beyond max limit
    if (backupArray.length > this.backupConfig.maxBackups) {
      const toRemove = backupArray.slice(this.backupConfig.maxBackups);
      
      for (const backup of toRemove) {
        this.backups.delete(backup.id);
        this.log(`Removed old backup: ${backup.id}`);
      }

      await this.saveBackupHistory();
    }
  }

  /**
   * Get aggregate statistics about stored backups.
   *
   * @returns {{total: number, totalSize: string, byType: object, oldest: number|null, newest: number|null, recoveryPoints: number}}
   */
  getBackupStatistics() {
    const backups = Array.from(this.backups.values());
    
    const totalSize = backups.reduce((sum, b) => sum + (b.metadata?.size || 0), 0);
    const byType = {};
    
    backups.forEach(b => {
      byType[b.type] = (byType[b.type] || 0) + 1;
    });

    return {
      total: backups.length,
      totalSize: this.formatSize(totalSize),
      byType,
      oldest: backups.length > 0 ? Math.min(...backups.map(b => b.timestamp)) : null,
      newest: backups.length > 0 ? Math.max(...backups.map(b => b.timestamp)) : null,
      recoveryPoints: this.recoveryPoints.length
    };
  }

  /**
   * Get the most recent backup by timestamp.
   *
   * @returns {object|null} The latest backup entry, or null if none exist
   */
  getLatestBackup() {
    const backups = Array.from(this.backups.values())
      .sort((a, b) => b.timestamp - a.timestamp);
    
    return backups[0] || null;
  }

  /**
   * Reinitialize all systems after restore
   */
  async reinitializeSystems() {
    this.log('Reinitializing systems...');

    const systems = [
      'automationEngine',
      'intelligentDashboard',
      'intelligenceManager',
      'voiceControlSystem',
      'geofencingEngine',
      'sceneLearningSystem',
      'deviceHealthMonitor',
      'energyForecastingEngine',
      'smartSchedulingSystem',
      'integrationHub',
      'multiUserPreferenceSystem'
    ];

    for (const system of systems) {
      try {
        if (this.homey.app[system]?.initialize) {
          await this.homey.app[system].initialize();
          this.log(`Reinitialized: ${system}`);
        }
      } catch (error) {
        this.error(`Failed to reinitialize ${system}:`, error);
      }
    }
  }

  /**
   * Notify backup complete
   */
  async notifyBackupComplete(backup) {
    if (backup.type === 'automatic') {
      // Only notify for automatic backups if configured
      return;
    }

    await this.homey.notifications.createNotification({
      excerpt: `Backup skapad: ${backup.description} (${this.formatSize(backup.metadata.size)})`
    });
  }

  // ============================================
  // COMPRESSION & ENCRYPTION
  // ============================================

  async compressData(data) {
    // Simplified compression (in production, use zlib)
    return JSON.stringify(data);
  }

  async decompressData(data) {
    return typeof data === 'string' ? JSON.parse(data) : data;
  }

  async encryptData(data) {
    // Simplified encryption (in production, use proper crypto)
    const encrypted = Buffer.from(JSON.stringify(data)).toString('base64');
    return encrypted;
  }

  async decryptData(data) {
    const decrypted = Buffer.from(data, 'base64').toString('utf-8');
    return JSON.parse(decrypted);
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  calculateHash(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  formatSize(bytes) {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  generateBackupId() {
    return `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateRecoveryPointId() {
    return `recovery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async getSystemVersion() {
    try {
      const manifest = require('../app.json');
      return manifest.version || '1.0.0';
    } catch {
      return '1.0.0';
    }
  }

  async saveBackupHistory() {
    const data = {};
    this.backups.forEach((backup, id) => {
      // Store metadata only, not full data
      data[id] = {
        ...backup,
        data: undefined // Don't store in settings (too large)
      };
    });
    await this.homey.settings.set('backupHistory', data);
  }

  log(...args) {
    console.log('[BackupRecoverySystem]', ...args);
  }

  error(...args) {
    console.error('[BackupRecoverySystem]', ...args);
  }
}

module.exports = BackupRecoverySystem;
