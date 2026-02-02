'use strict';

/**
 * Smart Lock Management System
 * Advanced lock control with access codes and visitor management
 */
class SmartLockManagementSystem {
  constructor(homey) {
    this.homey = homey;
    this.locks = new Map();
    this.accessCodes = new Map();
    this.accessLog = [];
    this.temporaryAccess = new Map();
    this.autoLockEnabled = true;
    this.autoLockDelay = 300000;
  }

  async initialize() {
    this.log('Initializing Smart Lock Management System...');
    
    await this.discoverLocks();
    await this.loadAccessCodes();
    await this.startMonitoring();
    
    this.log('Smart Lock Management System initialized');
  }

  async discoverLocks() {
    const devices = this.homey.drivers.getDevices();
    
    for (const device of devices) {
      const name = device.name.toLowerCase();
      
      if (name.includes('lock') || name.includes('lås') || device.hasCapability('locked')) {
        this.locks.set(device.id, {
          id: device.id,
          name: device.name,
          device,
          zone: device.zone?.name || 'unknown',
          locked: true,
          lastAccess: null,
          autoLock: true
        });
      }
    }

    this.log(`Discovered ${this.locks.size} smart locks`);
  }

  async loadAccessCodes() {
    const saved = await this.homey.settings.get('accessCodes') || {};
    Object.entries(saved).forEach(([code, data]) => {
      this.accessCodes.set(code, data);
    });

    if (this.accessCodes.size === 0) {
      await this.addDefaultAccessCodes();
    }
  }

  async addDefaultAccessCodes() {
    await this.addAccessCode('1234', {
      name: 'Family',
      type: 'permanent',
      enabled: true
    });

    await this.addAccessCode('5678', {
      name: 'Guest',
      type: 'temporary',
      enabled: true,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000
    });
  }

  async startMonitoring() {
    this.monitoringInterval = setInterval(async () => {
      await this.checkAutoLock();
      await this.checkTemporaryAccessExpiry();
    }, 60000);
  }

  async checkAutoLock() {
    if (!this.autoLockEnabled) return;

    for (const [id, lock] of this.locks) {
      if (!lock.autoLock || lock.locked) continue;

      if (lock.lastAccess && Date.now() - lock.lastAccess > this.autoLockDelay) {
        await this.lockDoor(id, 'auto');
      }
    }
  }

  async checkTemporaryAccessExpiry() {
    const now = Date.now();

    for (const [code, data] of this.accessCodes) {
      if (data.type === 'temporary' && data.expiresAt && now > data.expiresAt) {
        await this.removeAccessCode(code);
        this.log(`Temporary access code expired: ${data.name}`);
      }
    }

    for (const [userId, access] of this.temporaryAccess) {
      if (now > access.expiresAt) {
        this.temporaryAccess.delete(userId);
        this.log(`Temporary access expired for user: ${userId}`);
      }
    }
  }

  async lockDoor(lockId, triggeredBy = 'manual') {
    const lock = this.locks.get(lockId);
    if (!lock) throw new Error('Lock not found');

    try {
      if (lock.device.hasCapability('locked')) {
        await lock.device.setCapabilityValue('locked', true);
      } else if (lock.device.hasCapability('onoff')) {
        await lock.device.setCapabilityValue('onoff', false);
      }

      lock.locked = true;
      
      this.accessLog.push({
        lockId,
        lockName: lock.name,
        action: 'lock',
        triggeredBy,
        timestamp: Date.now()
      });

      this.log(`Locked: ${lock.name} (triggered by: ${triggeredBy})`);

      return { success: true, message: `${lock.name} låst` };
    } catch (error) {
      this.error(`Failed to lock ${lock.name}: ${error.message}`);
      throw error;
    }
  }

  async unlockDoor(lockId, accessCode = null, userId = null) {
    const lock = this.locks.get(lockId);
    if (!lock) throw new Error('Lock not found');

    if (accessCode) {
      const codeData = this.accessCodes.get(accessCode);
      if (!codeData || !codeData.enabled) {
        await this.logFailedAccess(lockId, 'invalid_code');
        throw new Error('Invalid or disabled access code');
      }
    }

    if (userId) {
      const tempAccess = this.temporaryAccess.get(userId);
      if (tempAccess && Date.now() > tempAccess.expiresAt) {
        await this.logFailedAccess(lockId, 'expired_access', userId);
        throw new Error('Temporary access has expired');
      }
    }

    try {
      if (lock.device.hasCapability('locked')) {
        await lock.device.setCapabilityValue('locked', false);
      } else if (lock.device.hasCapability('onoff')) {
        await lock.device.setCapabilityValue('onoff', true);
      }

      lock.locked = false;
      lock.lastAccess = Date.now();
      
      this.accessLog.push({
        lockId,
        lockName: lock.name,
        action: 'unlock',
        accessCode: accessCode ? '****' : null,
        userId,
        timestamp: Date.now()
      });

      this.log(`Unlocked: ${lock.name} (code: ${accessCode ? 'provided' : 'none'})`);

      try {
        const notificationManager = this.homey.app.advancedNotificationManager;
        if (notificationManager) {
          await notificationManager.sendNotification({
            title: '🔓 Dörr upplåst',
            message: `${lock.name} har låsts upp`,
            priority: 'normal',
            category: 'security'
          });
        }
      } catch {}

      return { success: true, message: `${lock.name} upplåst` };
    } catch (error) {
      this.error(`Failed to unlock ${lock.name}: ${error.message}`);
      throw error;
    }
  }

  async addAccessCode(code, options = {}) {
    const codeData = {
      name: options.name || 'Unnamed',
      type: options.type || 'permanent',
      enabled: options.enabled !== false,
      createdAt: Date.now(),
      expiresAt: options.expiresAt || null,
      allowedLocks: options.allowedLocks || null
    };

    this.accessCodes.set(code, codeData);
    await this.saveAccessCodes();

    this.log(`Access code added: ${codeData.name} (${codeData.type})`);

    return codeData;
  }

  async removeAccessCode(code) {
    const codeData = this.accessCodes.get(code);
    if (!codeData) return false;

    this.accessCodes.delete(code);
    await this.saveAccessCodes();

    this.log(`Access code removed: ${codeData.name}`);

    return true;
  }

  async grantTemporaryAccess(userId, durationHours = 24, allowedLocks = null) {
    const access = {
      userId,
      grantedAt: Date.now(),
      expiresAt: Date.now() + durationHours * 60 * 60 * 1000,
      allowedLocks
    };

    this.temporaryAccess.set(userId, access);

    this.log(`Temporary access granted to ${userId} for ${durationHours} hours`);

    try {
      const notificationManager = this.homey.app.advancedNotificationManager;
      if (notificationManager) {
        await notificationManager.sendNotification({
          title: '🔑 Tillfällig åtkomst beviljad',
          message: `Användare ${userId} har tillgång i ${durationHours} timmar`,
          priority: 'low',
          category: 'security'
        });
      }
    } catch {}

    return access;
  }

  async logFailedAccess(lockId, reason, userId = null) {
    const lock = this.locks.get(lockId);
    
    this.accessLog.push({
      lockId,
      lockName: lock?.name || 'unknown',
      action: 'failed_unlock',
      reason,
      userId,
      timestamp: Date.now()
    });

    this.log(`Failed access attempt on ${lock?.name}: ${reason}`);

    try {
      const notificationManager = this.homey.app.advancedNotificationManager;
      if (notificationManager) {
        await notificationManager.sendNotification({
          title: '🚨 Misslyckad upplåsning',
          message: `Misslyckad upplåsning av ${lock?.name}: ${reason}`,
          priority: 'high',
          category: 'security'
        });
      }
    } catch {}
  }

  async lockAllDoors() {
    const results = [];
    
    for (const [id, lock] of this.locks) {
      try {
        await this.lockDoor(id, 'lock_all');
        results.push({ lock: lock.name, success: true });
      } catch (error) {
        results.push({ lock: lock.name, success: false, error: error.message });
      }
    }

    return results;
  }

  async saveAccessCodes() {
    const codes = {};
    this.accessCodes.forEach((data, code) => {
      codes[code] = data;
    });
    await this.homey.settings.set('accessCodes', codes);
  }

  getAccessLog(limit = 50) {
    return this.accessLog.slice(-limit);
  }

  getStatistics() {
    const recentLog = this.accessLog.slice(-100);
    const unlocks = recentLog.filter(entry => entry.action === 'unlock').length;
    const failedAttempts = recentLog.filter(entry => entry.action === 'failed_unlock').length;

    return {
      totalLocks: this.locks.size,
      accessCodes: this.accessCodes.size,
      temporaryAccess: this.temporaryAccess.size,
      totalAccessEvents: this.accessLog.length,
      recentUnlocks: unlocks,
      recentFailedAttempts: failedAttempts,
      autoLockEnabled: this.autoLockEnabled,
      autoLockDelay: this.autoLockDelay / 1000
    };
  }

  log(...args) {
    console.log('[SmartLockManagementSystem]', ...args);
  }

  error(...args) {
    console.error('[SmartLockManagementSystem]', ...args);
  }
}

module.exports = SmartLockManagementSystem;
