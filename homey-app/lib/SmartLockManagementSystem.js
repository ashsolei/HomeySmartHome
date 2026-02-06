'use strict';

/**
 * Smart Lock Management System
 * Advanced lock control with temporary access codes, auto-lock timers, tamper detection,
 * key management, lock synchronization, analytics, battery monitoring, and security integration
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

    // Temporary access codes with expiration
    this.tempCodeSchedules = new Map();

    // Lock usage analytics
    this.usageAnalytics = {
      doorUsageCounts: new Map(),
      hourlyUsage: new Array(24).fill(0),
      dailyUsage: new Array(7).fill(0)
    };

    // Tamper detection
    this.tamperEvents = [];
    this.tamperDetectionEnabled = true;

    // Key management (physical + digital)
    this.keyRegistry = new Map();

    // Lock-behind-me mode
    this.lockBehindMeEnabled = false;
    this.occupancyTracker = new Map();

    // Emergency unlock
    this.emergencyUnlockEnabled = true;
    this.emergencyLog = [];

    // Battery monitoring
    this.batteryLevels = new Map();
    this.lowBatteryThreshold = 20;
    this.criticalBatteryThreshold = 10;

    // Lock synchronization
    this.syncGroupsEnabled = false;
    this.syncGroups = new Map();

    // Access schedule restrictions
    this.accessSchedules = new Map();

    // Security system integration
    this.securityIntegrationEnabled = true;
  }

  async initialize() {
    this.log('Initializing Smart Lock Management System...');

    try {
      const savedSettings = await this.homey.settings.get('lockSettings') || {};
      this.autoLockEnabled = savedSettings.autoLockEnabled !== false;
      this.autoLockDelay = savedSettings.autoLockDelay || 300000;
      this.lockBehindMeEnabled = savedSettings.lockBehindMeEnabled || false;
      this.syncGroupsEnabled = savedSettings.syncGroupsEnabled || false;
      this.lowBatteryThreshold = savedSettings.lowBatteryThreshold || 20;

      await this.discoverLocks();
      await this.loadAccessCodes();
      await this.loadKeyRegistry();
      await this.loadSyncGroups();
      await this.loadAccessSchedules();
      await this.loadAnalytics();
      await this.startMonitoring();
    } catch (err) {
      this.error('Initialization failed:', err.message);
    }

    this.log('Smart Lock Management System initialized');
  }

  async discoverLocks() {
    const devices = this.homey.drivers.getDevices();

    for (const device of devices) {
      const name = device.name.toLowerCase();

      if (name.includes('lock') || name.includes('lås') || device.hasCapability('locked')) {
        const lockData = {
          id: device.id,
          name: device.name,
          device,
          zone: device.zone?.name || 'unknown',
          locked: true,
          lastAccess: null,
          autoLock: true,
          autoLockDelayMs: this.autoLockDelay,
          batteryLevel: null,
          lastBatteryCheck: null,
          tamperAlerted: false,
          doorOpen: false,
          doorOpenedAt: null
        };

        this.locks.set(device.id, lockData);
        this.usageAnalytics.doorUsageCounts.set(device.id, 0);
      }
    }

    this.log(`Discovered ${this.locks.size} smart locks`);
  }

  async loadAccessCodes() {
    try {
      const saved = await this.homey.settings.get('accessCodes') || {};
      Object.entries(saved).forEach(([code, data]) => {
        this.accessCodes.set(code, data);
      });

      if (this.accessCodes.size === 0) {
        await this.addDefaultAccessCodes();
      }
    } catch (err) {
      this.error('Failed to load access codes:', err.message);
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
      try {
        await this.checkAutoLock();
        await this.checkTemporaryAccessExpiry();
        await this.checkBatteryLevels();
        await this.checkTamperStatus();
        await this.checkLockBehindMe();
        await this.checkAccessScheduleViolations();
      } catch (err) {
        this.error('Monitoring cycle error:', err.message);
      }
    }, 60000);
  }

  // ── Temporary Access Codes with Expiration ────────────────────────────

  async createTemporaryCode(options) {
    const code = options.code || this.generateRandomCode();
    const tempCode = {
      code,
      name: options.name || 'Temporary Access',
      type: 'temporary',
      enabled: true,
      createdAt: Date.now(),
      expiresAt: options.expiresAt || Date.now() + (options.durationHours || 24) * 3600000,
      maxUses: options.maxUses || null,
      usesRemaining: options.maxUses || null,
      allowedLocks: options.allowedLocks || null,
      purpose: options.purpose || 'general',
      createdBy: options.createdBy || 'system'
    };

    this.accessCodes.set(code, tempCode);
    await this.saveAccessCodes();

    this.log(`Temporary code created: ${tempCode.name}, expires ${new Date(tempCode.expiresAt).toLocaleString()}`);

    try {
      const notificationManager = this.homey.app.advancedNotificationManager;
      if (notificationManager) {
        await notificationManager.sendNotification({
          title: '🔑 Tillfällig kod skapad',
          message: `${tempCode.name}: Giltig till ${new Date(tempCode.expiresAt).toLocaleString()}`,
          priority: 'low',
          category: 'security'
        });
      }
    } catch (err) {
      this.error('Failed to send temp code notification:', err.message);
    }

    return { code, ...tempCode };
  }

  generateRandomCode(length = 6) {
    let code = '';
    for (let i = 0; i < length; i++) {
      code += Math.floor(Math.random() * 10).toString();
    }
    return code;
  }

  async validateAndUseCode(code, lockId) {
    const codeData = this.accessCodes.get(code);
    if (!codeData) return { valid: false, reason: 'code_not_found' };
    if (!codeData.enabled) return { valid: false, reason: 'code_disabled' };

    if (codeData.expiresAt && Date.now() > codeData.expiresAt) {
      codeData.enabled = false;
      await this.saveAccessCodes();
      return { valid: false, reason: 'code_expired' };
    }

    if (codeData.allowedLocks && !codeData.allowedLocks.includes(lockId)) {
      return { valid: false, reason: 'lock_not_allowed' };
    }

    if (codeData.usesRemaining !== null) {
      if (codeData.usesRemaining <= 0) {
        codeData.enabled = false;
        await this.saveAccessCodes();
        return { valid: false, reason: 'max_uses_reached' };
      }
      codeData.usesRemaining--;
    }

    codeData.lastUsed = Date.now();
    await this.saveAccessCodes();
    return { valid: true, codeName: codeData.name };
  }

  // ── Auto-Lock Timer ───────────────────────────────────────────────────

  async checkAutoLock() {
    if (!this.autoLockEnabled) return;

    for (const [id, lock] of this.locks) {
      if (!lock.autoLock || lock.locked) continue;

      const delay = lock.autoLockDelayMs || this.autoLockDelay;
      if (lock.lastAccess && Date.now() - lock.lastAccess > delay) {
        this.log(`Auto-locking ${lock.name} after ${delay / 1000}s`);
        await this.lockDoor(id, 'auto_timer');
      }
    }
  }

  setAutoLockDelay(lockId, delayMs) {
    const lock = this.locks.get(lockId);
    if (!lock) return null;
    lock.autoLockDelayMs = delayMs;
    this.log(`Auto-lock delay for ${lock.name} set to ${delayMs / 1000}s`);
    return { lockId, autoLockDelayMs: delayMs };
  }

  // ── Lock Usage Analytics ──────────────────────────────────────────────

  recordUsageEvent(lockId, action) {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();

    this.usageAnalytics.hourlyUsage[hour]++;
    this.usageAnalytics.dailyUsage[day]++;

    const count = this.usageAnalytics.doorUsageCounts.get(lockId) || 0;
    this.usageAnalytics.doorUsageCounts.set(lockId, count + 1);
  }

  getUsageAnalytics() {
    const mostUsedDoor = { id: null, name: null, count: 0 };
    for (const [lockId, count] of this.usageAnalytics.doorUsageCounts) {
      if (count > mostUsedDoor.count) {
        const lock = this.locks.get(lockId);
        mostUsedDoor.id = lockId;
        mostUsedDoor.name = lock?.name || 'Unknown';
        mostUsedDoor.count = count;
      }
    }

    const busiestHour = this.usageAnalytics.hourlyUsage.indexOf(
      Math.max(...this.usageAnalytics.hourlyUsage)
    );
    const busiestDay = this.usageAnalytics.dailyUsage.indexOf(
      Math.max(...this.usageAnalytics.dailyUsage)
    );
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    return {
      mostUsedDoor,
      busiestHour: `${String(busiestHour).padStart(2, '0')}:00`,
      busiestDay: dayNames[busiestDay],
      hourlyDistribution: [...this.usageAnalytics.hourlyUsage],
      dailyDistribution: [...this.usageAnalytics.dailyUsage],
      totalEvents: this.accessLog.length
    };
  }

  // ── Tamper Detection ──────────────────────────────────────────────────

  async checkTamperStatus() {
    if (!this.tamperDetectionEnabled) return;

    for (const [id, lock] of this.locks) {
      try {
        if (lock.device.hasCapability('alarm_tamper')) {
          const tamper = await lock.device.getCapabilityValue('alarm_tamper');
          if (tamper && !lock.tamperAlerted) {
            lock.tamperAlerted = true;
            await this.handleTamperEvent(lock);
          } else if (!tamper) {
            lock.tamperAlerted = false;
          }
        }

        // Also detect rapid failed attempts as potential tampering
        const recentFails = this.accessLog
          .filter(e => e.lockId === id && e.action === 'failed_unlock' && Date.now() - e.timestamp < 300000)
          .length;
        if (recentFails >= 3 && !lock.tamperAlerted) {
          lock.tamperAlerted = true;
          await this.handleTamperEvent(lock, 'multiple_failed_attempts');
        }
      } catch (err) {
        this.error(`Tamper check failed for ${lock.name}:`, err.message);
      }
    }
  }

  async handleTamperEvent(lock, type = 'physical_tamper') {
    const event = {
      lockId: lock.id,
      lockName: lock.name,
      type,
      timestamp: Date.now()
    };
    this.tamperEvents.push(event);

    this.log(`TAMPER DETECTED: ${lock.name} (${type})`);

    try {
      const notificationManager = this.homey.app.advancedNotificationManager;
      if (notificationManager) {
        await notificationManager.sendNotification({
          title: '🚨 Manipuleringsförsök!',
          message: `${lock.name}: ${type === 'physical_tamper' ? 'Fysisk manipulation' : 'Flera misslyckade försök'} detekterad`,
          priority: 'critical',
          category: 'security'
        });
      }
    } catch (err) {
      this.error('Failed to send tamper notification:', err.message);
    }

    // Integrate with security system
    if (this.securityIntegrationEnabled) {
      await this.notifySecuritySystem('tamper', event);
    }
  }

  // ── Key Management ────────────────────────────────────────────────────

  async registerKey(keyId, keyData) {
    const entry = {
      keyId,
      type: keyData.type || 'physical',
      assignedTo: keyData.assignedTo || 'unassigned',
      label: keyData.label || keyId,
      issuedAt: Date.now(),
      expiresAt: keyData.expiresAt || null,
      active: true,
      allowedLocks: keyData.allowedLocks || null,
      notes: keyData.notes || ''
    };

    this.keyRegistry.set(keyId, entry);
    await this.saveKeyRegistry();
    this.log(`Key registered: ${entry.label} (${entry.type}) assigned to ${entry.assignedTo}`);
    return entry;
  }

  async revokeKey(keyId, reason = '') {
    const key = this.keyRegistry.get(keyId);
    if (!key) return null;

    key.active = false;
    key.revokedAt = Date.now();
    key.revokeReason = reason;

    await this.saveKeyRegistry();
    this.log(`Key revoked: ${key.label} — ${reason}`);

    try {
      const notificationManager = this.homey.app.advancedNotificationManager;
      if (notificationManager) {
        await notificationManager.sendNotification({
          title: '🔑 Nyckel återkallad',
          message: `${key.label} tilldelad ${key.assignedTo} har återkallats`,
          priority: 'normal',
          category: 'security'
        });
      }
    } catch (err) {
      this.error('Failed to send key revocation notification:', err.message);
    }

    return key;
  }

  getKeyInventory() {
    const physical = [];
    const digital = [];
    for (const [id, key] of this.keyRegistry) {
      const entry = { ...key };
      if (key.type === 'physical') physical.push(entry);
      else digital.push(entry);
    }
    return { physical, digital, totalActive: [...this.keyRegistry.values()].filter(k => k.active).length };
  }

  // ── Lock-Behind-Me Mode ───────────────────────────────────────────────

  async checkLockBehindMe() {
    if (!this.lockBehindMeEnabled) return;

    for (const [lockId, lock] of this.locks) {
      if (lock.locked) continue;

      // Check if the associated zone has any motion sensors showing activity
      try {
        const zoneDevices = this.homey.drivers.getDevices().filter(
          d => d.zone?.name === lock.zone && d.hasCapability('alarm_motion')
        );

        let anyMotion = false;
        for (const device of zoneDevices) {
          try {
            const motion = await device.getCapabilityValue('alarm_motion');
            if (motion) { anyMotion = true; break; }
          } catch (err) {
            this.error(`Motion check failed for ${device.name}:`, err.message);
          }
        }

        if (!anyMotion && lock.lastAccess && Date.now() - lock.lastAccess > 120000) {
          this.log(`Lock-behind-me: No presence detected near ${lock.name}, auto-locking`);
          await this.lockDoor(lockId, 'lock_behind_me');
        }
      } catch (err) {
        this.error(`Lock-behind-me check failed for ${lock.name}:`, err.message);
      }
    }
  }

  // ── Emergency Unlock All ──────────────────────────────────────────────

  async emergencyUnlockAll(triggeredBy = 'system', reason = 'emergency') {
    if (!this.emergencyUnlockEnabled) {
      this.log('Emergency unlock is disabled');
      return { success: false, reason: 'disabled' };
    }

    this.log(`EMERGENCY UNLOCK ALL triggered by ${triggeredBy}: ${reason}`);
    const results = [];

    for (const [id, lock] of this.locks) {
      try {
        if (lock.device.hasCapability('locked')) {
          await lock.device.setCapabilityValue('locked', false);
        } else if (lock.device.hasCapability('onoff')) {
          await lock.device.setCapabilityValue('onoff', true);
        }
        lock.locked = false;
        lock.lastAccess = Date.now();
        results.push({ lock: lock.name, success: true });
      } catch (err) {
        results.push({ lock: lock.name, success: false, error: err.message });
        this.error(`Emergency unlock failed for ${lock.name}:`, err.message);
      }
    }

    this.emergencyLog.push({
      triggeredBy,
      reason,
      timestamp: Date.now(),
      results
    });

    this.accessLog.push({
      lockId: 'ALL',
      lockName: 'ALL LOCKS',
      action: 'emergency_unlock',
      triggeredBy,
      reason,
      timestamp: Date.now()
    });

    try {
      const notificationManager = this.homey.app.advancedNotificationManager;
      if (notificationManager) {
        await notificationManager.sendNotification({
          title: '🚨 Nödupplåsning!',
          message: `Alla lås har öppnats av ${triggeredBy}: ${reason}`,
          priority: 'critical',
          category: 'emergency'
        });
      }
    } catch (err) {
      this.error('Failed to send emergency notification:', err.message);
    }

    return { success: true, results };
  }

  // ── Battery Monitoring ────────────────────────────────────────────────

  async checkBatteryLevels() {
    for (const [id, lock] of this.locks) {
      try {
        if (lock.device.hasCapability('measure_battery')) {
          const battery = await lock.device.getCapabilityValue('measure_battery');
          const previousLevel = lock.batteryLevel;
          lock.batteryLevel = battery;
          lock.lastBatteryCheck = Date.now();
          this.batteryLevels.set(id, { level: battery, lastChecked: Date.now() });

          if (battery !== null && battery <= this.criticalBatteryThreshold && (previousLevel === null || previousLevel > this.criticalBatteryThreshold)) {
            await this.sendBatteryAlert(lock, battery, 'critical');
          } else if (battery !== null && battery <= this.lowBatteryThreshold && (previousLevel === null || previousLevel > this.lowBatteryThreshold)) {
            await this.sendBatteryAlert(lock, battery, 'low');
          }
        }
      } catch (err) {
        this.error(`Battery check failed for ${lock.name}:`, err.message);
      }
    }
  }

  async sendBatteryAlert(lock, level, severity) {
    this.log(`Battery ${severity}: ${lock.name} at ${level}%`);
    try {
      const notificationManager = this.homey.app.advancedNotificationManager;
      if (notificationManager) {
        await notificationManager.sendNotification({
          title: severity === 'critical' ? '🔴 Kritiskt låg batteri' : '🟡 Låg batteri',
          message: `${lock.name}: ${level}% batteri kvar${severity === 'critical' ? ' — byt batteri omedelbart!' : ''}`,
          priority: severity === 'critical' ? 'critical' : 'normal',
          category: 'lock_battery'
        });
      }
    } catch (err) {
      this.error('Failed to send battery alert:', err.message);
    }
  }

  getBatteryReport() {
    const report = [];
    for (const [id, lock] of this.locks) {
      report.push({
        lockId: id,
        lockName: lock.name,
        batteryLevel: lock.batteryLevel,
        lastChecked: lock.lastBatteryCheck,
        status: lock.batteryLevel === null ? 'unknown'
          : lock.batteryLevel <= this.criticalBatteryThreshold ? 'critical'
          : lock.batteryLevel <= this.lowBatteryThreshold ? 'low' : 'healthy'
      });
    }
    return report;
  }

  // ── Lock Synchronization ──────────────────────────────────────────────

  async createSyncGroup(groupName, lockIds) {
    const validLocks = lockIds.filter(id => this.locks.has(id));
    if (validLocks.length < 2) throw new Error('Sync group requires at least 2 locks');

    const group = {
      name: groupName,
      lockIds: validLocks,
      createdAt: Date.now(),
      enabled: true
    };

    this.syncGroups.set(groupName, group);
    this.syncGroupsEnabled = true;
    await this.saveSyncGroups();
    this.log(`Sync group created: ${groupName} with ${validLocks.length} locks`);
    return group;
  }

  async synchronizeLockAction(triggerLockId, action) {
    if (!this.syncGroupsEnabled) return;

    for (const [name, group] of this.syncGroups) {
      if (!group.enabled || !group.lockIds.includes(triggerLockId)) continue;

      this.log(`Sync group '${name}': ${action} triggered by ${triggerLockId}`);
      for (const lockId of group.lockIds) {
        if (lockId === triggerLockId) continue;
        try {
          if (action === 'lock') {
            await this.lockDoor(lockId, `sync_${name}`);
          } else if (action === 'unlock') {
            await this.unlockDoor(lockId, null, null, `sync_${name}`);
          }
        } catch (err) {
          this.error(`Sync failed for lock ${lockId} in group ${name}:`, err.message);
        }
      }
    }
  }

  // ── Access Schedule Restrictions ──────────────────────────────────────

  async setAccessSchedule(userId, schedule) {
    const entry = {
      userId,
      name: schedule.name || userId,
      allowedDays: schedule.allowedDays || [0, 1, 2, 3, 4, 5, 6],
      allowedStartTime: schedule.startTime || '00:00',
      allowedEndTime: schedule.endTime || '23:59',
      allowedLocks: schedule.allowedLocks || null,
      active: true,
      createdAt: Date.now()
    };

    this.accessSchedules.set(userId, entry);
    await this.saveAccessSchedules();
    this.log(`Access schedule set for ${userId}: ${entry.allowedStartTime}-${entry.allowedEndTime}`);
    return entry;
  }

  isAccessAllowed(userId, lockId = null) {
    const schedule = this.accessSchedules.get(userId);
    if (!schedule || !schedule.active) return true; // No restriction means allowed

    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    if (!schedule.allowedDays.includes(currentDay)) return false;
    if (currentTime < schedule.allowedStartTime || currentTime > schedule.allowedEndTime) return false;
    if (lockId && schedule.allowedLocks && !schedule.allowedLocks.includes(lockId)) return false;

    return true;
  }

  async checkAccessScheduleViolations() {
    // Check if any lock was recently opened outside allowed schedules
    const recentEvents = this.accessLog.filter(e => Date.now() - e.timestamp < 120000 && e.action === 'unlock');
    for (const event of recentEvents) {
      if (event.userId && !this.isAccessAllowed(event.userId, event.lockId)) {
        this.log(`Schedule violation: ${event.userId} accessed ${event.lockName} outside allowed hours`);
        try {
          const notificationManager = this.homey.app.advancedNotificationManager;
          if (notificationManager) {
            await notificationManager.sendNotification({
              title: '⚠️ Schemaöverträdelse',
              message: `${event.userId} öppnade ${event.lockName} utanför tillåtna tider`,
              priority: 'high',
              category: 'security'
            });
          }
        } catch (err) {
          this.error('Failed to send schedule violation notification:', err.message);
        }
      }
    }
  }

  // ── Security System Integration ───────────────────────────────────────

  async notifySecuritySystem(eventType, eventData) {
    try {
      const securitySystem = this.homey.app.advancedSecuritySystem;
      if (securitySystem) {
        if (eventType === 'tamper') {
          await securitySystem.handleIntrusionEvent('lock_tamper', {
            name: eventData.lockName,
            zone: this.locks.get(eventData.lockId)?.zone || 'unknown',
            id: eventData.lockId
          });
        }
      }
    } catch (err) {
      this.error('Security system integration error:', err.message);
    }
  }

  async onSecurityModeChange(mode) {
    if (!this.securityIntegrationEnabled) return;

    this.log(`Security mode changed to: ${mode}`);
    if (mode === 'armed_away' || mode === 'armed_night') {
      await this.lockAllDoors('security_mode');
    }
  }

  // ── Core Lock/Unlock Methods ──────────────────────────────────────────

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

      this.recordUsageEvent(lockId, 'lock');
      this.log(`Locked: ${lock.name} (triggered by: ${triggeredBy})`);

      // Sync with group
      if (this.syncGroupsEnabled) {
        await this.synchronizeLockAction(lockId, 'lock');
      }

      return { success: true, message: `${lock.name} låst` };
    } catch (err) {
      this.error(`Failed to lock ${lock.name}: ${err.message}`);
      throw err;
    }
  }

  async unlockDoor(lockId, accessCode = null, userId = null, triggeredBy = 'manual') {
    const lock = this.locks.get(lockId);
    if (!lock) throw new Error('Lock not found');

    // Check access schedule
    if (userId && !this.isAccessAllowed(userId, lockId)) {
      await this.logFailedAccess(lockId, 'schedule_restricted', userId);
      throw new Error('Access not allowed at this time');
    }

    // Validate access code
    if (accessCode) {
      const validation = await this.validateAndUseCode(accessCode, lockId);
      if (!validation.valid) {
        await this.logFailedAccess(lockId, validation.reason);
        throw new Error(`Invalid access: ${validation.reason}`);
      }
    }

    // Check temporary user access
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
        triggeredBy,
        timestamp: Date.now()
      });

      this.recordUsageEvent(lockId, 'unlock');
      this.log(`Unlocked: ${lock.name} (${triggeredBy})`);

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
      } catch (err) {
        this.error('Failed to send unlock notification:', err.message);
      }

      // Sync with group
      if (this.syncGroupsEnabled) {
        await this.synchronizeLockAction(lockId, 'unlock');
      }

      return { success: true, message: `${lock.name} upplåst` };
    } catch (err) {
      this.error(`Failed to unlock ${lock.name}: ${err.message}`);
      throw err;
    }
  }

  async addAccessCode(code, options = {}) {
    const codeData = {
      name: options.name || 'Unnamed',
      type: options.type || 'permanent',
      enabled: options.enabled !== false,
      createdAt: Date.now(),
      expiresAt: options.expiresAt || null,
      allowedLocks: options.allowedLocks || null,
      maxUses: options.maxUses || null,
      usesRemaining: options.maxUses || null
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

  async checkTemporaryAccessExpiry() {
    const now = Date.now();

    for (const [code, data] of this.accessCodes) {
      if (data.type === 'temporary' && data.expiresAt && now > data.expiresAt && data.enabled) {
        data.enabled = false;
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

  async grantTemporaryAccess(userId, durationHours = 24, allowedLocks = null) {
    const access = {
      userId,
      grantedAt: Date.now(),
      expiresAt: Date.now() + durationHours * 3600000,
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
    } catch (err) {
      this.error('Failed to send temporary access notification:', err.message);
    }

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
    } catch (err) {
      this.error('Failed to send failed-access notification:', err.message);
    }
  }

  async lockAllDoors(triggeredBy = 'manual') {
    const results = [];

    for (const [id, lock] of this.locks) {
      try {
        await this.lockDoor(id, triggeredBy);
        results.push({ lock: lock.name, success: true });
      } catch (err) {
        results.push({ lock: lock.name, success: false, error: err.message });
      }
    }

    return results;
  }

  // ── Persistence ───────────────────────────────────────────────────────

  async saveAccessCodes() {
    try {
      const codes = {};
      this.accessCodes.forEach((data, code) => { codes[code] = data; });
      await this.homey.settings.set('accessCodes', codes);
    } catch (err) {
      this.error('Failed to save access codes:', err.message);
    }
  }

  async loadKeyRegistry() {
    try {
      const saved = await this.homey.settings.get('keyRegistry') || {};
      Object.entries(saved).forEach(([id, data]) => this.keyRegistry.set(id, data));
    } catch (err) {
      this.error('Failed to load key registry:', err.message);
    }
  }

  async saveKeyRegistry() {
    try {
      const obj = {};
      this.keyRegistry.forEach((v, k) => { obj[k] = v; });
      await this.homey.settings.set('keyRegistry', obj);
    } catch (err) {
      this.error('Failed to save key registry:', err.message);
    }
  }

  async loadSyncGroups() {
    try {
      const saved = await this.homey.settings.get('lockSyncGroups') || {};
      Object.entries(saved).forEach(([name, group]) => this.syncGroups.set(name, group));
    } catch (err) {
      this.error('Failed to load sync groups:', err.message);
    }
  }

  async saveSyncGroups() {
    try {
      const obj = {};
      this.syncGroups.forEach((v, k) => { obj[k] = v; });
      await this.homey.settings.set('lockSyncGroups', obj);
    } catch (err) {
      this.error('Failed to save sync groups:', err.message);
    }
  }

  async loadAccessSchedules() {
    try {
      const saved = await this.homey.settings.get('accessSchedules') || {};
      Object.entries(saved).forEach(([userId, schedule]) => this.accessSchedules.set(userId, schedule));
    } catch (err) {
      this.error('Failed to load access schedules:', err.message);
    }
  }

  async saveAccessSchedules() {
    try {
      const obj = {};
      this.accessSchedules.forEach((v, k) => { obj[k] = v; });
      await this.homey.settings.set('accessSchedules', obj);
    } catch (err) {
      this.error('Failed to save access schedules:', err.message);
    }
  }

  async loadAnalytics() {
    try {
      const saved = await this.homey.settings.get('lockUsageAnalytics') || null;
      if (saved) {
        this.usageAnalytics.hourlyUsage = saved.hourlyUsage || new Array(24).fill(0);
        this.usageAnalytics.dailyUsage = saved.dailyUsage || new Array(7).fill(0);
      }
    } catch (err) {
      this.error('Failed to load analytics:', err.message);
    }
  }

  // ── Statistics ────────────────────────────────────────────────────────

  getAccessLog(limit = 50) {
    return this.accessLog.slice(-limit);
  }

  getStatistics() {
    const recentLog = this.accessLog.slice(-100);
    const unlocks = recentLog.filter(entry => entry.action === 'unlock').length;
    const failedAttempts = recentLog.filter(entry => entry.action === 'failed_unlock').length;
    const analytics = this.getUsageAnalytics();
    const batteryReport = this.getBatteryReport();

    return {
      totalLocks: this.locks.size,
      accessCodes: this.accessCodes.size,
      temporaryAccess: this.temporaryAccess.size,
      totalAccessEvents: this.accessLog.length,
      recentUnlocks: unlocks,
      recentFailedAttempts: failedAttempts,
      autoLockEnabled: this.autoLockEnabled,
      autoLockDelay: this.autoLockDelay / 1000,
      tamperEvents: this.tamperEvents.length,
      emergencyEvents: this.emergencyLog.length,
      syncGroupsEnabled: this.syncGroupsEnabled,
      syncGroups: this.syncGroups.size,
      keysRegistered: this.keyRegistry.size,
      accessSchedules: this.accessSchedules.size,
      lockBehindMeEnabled: this.lockBehindMeEnabled,
      mostUsedDoor: analytics.mostUsedDoor,
      busiestHour: analytics.busiestHour,
      batteryStatus: batteryReport.map(b => ({ name: b.lockName, level: b.batteryLevel, status: b.status }))
    };
  }

  // ── Cleanup ───────────────────────────────────────────────────────────

  destroy() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.log('Smart Lock Management System destroyed');
  }

  log(...args) {
    console.log('[SmartLockManagementSystem]', ...args);
  }

  error(...args) {
    console.error('[SmartLockManagementSystem]', ...args);
  }
}

module.exports = SmartLockManagementSystem;
