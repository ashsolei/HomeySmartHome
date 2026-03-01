'use strict';

class DeviceFirmwareOTASystem {
  constructor(homey) {
    this.homey = homey;
    this.devices = new Map();
    this.updateHistory = [];
    this.scheduledUpdates = new Map();
    this._checkTimer = null;

    // Static firmware registry (simulated latest versions per protocol)
    this.firmwareRegistry = {
      zigbee: { latest: '3.2.1', releaseDate: '2026-02-15' },
      zwave: { latest: '7.18.3', releaseDate: '2026-02-20' },
      wifi: { latest: '2.5.0', releaseDate: '2026-02-25' },
      thread: { latest: '1.3.0', releaseDate: '2026-02-10' },
      matter: { latest: '1.2.0', releaseDate: '2026-02-18' }
    };
  }

  async initialize() {
    // Start periodic update check every 30 minutes
    this._checkTimer = setInterval(() => {
      this._processScheduledUpdates();
    }, 30 * 60 * 1000);
  }

  registerDevice(deviceId, currentVersion, protocol) {
    if (!deviceId || !currentVersion || !protocol) {
      throw Object.assign(
        new Error('deviceId, currentVersion, and protocol are required'),
        { statusCode: 400 }
      );
    }
    const normalizedProtocol = protocol.toLowerCase();
    if (!this.firmwareRegistry[normalizedProtocol]) {
      throw Object.assign(
        new Error(`Unsupported protocol: ${protocol}. Supported: ${Object.keys(this.firmwareRegistry).join(', ')}`),
        { statusCode: 400 }
      );
    }
    const device = {
      deviceId,
      currentVersion,
      protocol: normalizedProtocol,
      registeredAt: new Date().toISOString(),
      lastChecked: null,
      updateStatus: 'idle'
    };
    this.devices.set(deviceId, device);
    return device;
  }

  checkForUpdates() {
    const results = [];
    for (const [deviceId, device] of this.devices) {
      const registry = this.firmwareRegistry[device.protocol];
      if (!registry) continue;
      const needsUpdate = this._compareVersions(device.currentVersion, registry.latest) < 0;
      device.lastChecked = new Date().toISOString();
      results.push({
        deviceId,
        protocol: device.protocol,
        currentVersion: device.currentVersion,
        latestVersion: registry.latest,
        releaseDate: registry.releaseDate,
        updateAvailable: needsUpdate
      });
    }
    return results;
  }

  scheduleUpdate(deviceId, version, scheduledAt) {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw Object.assign(new Error(`Device not found: ${deviceId}`), { statusCode: 404 });
    }
    if (!version) {
      throw Object.assign(new Error('Version is required'), { statusCode: 400 });
    }

    const schedule = {
      deviceId,
      targetVersion: version,
      scheduledAt: scheduledAt || new Date(Date.now() + 3600000).toISOString(),
      status: 'scheduled',
      createdAt: new Date().toISOString()
    };

    this.scheduledUpdates.set(deviceId, schedule);
    device.updateStatus = 'scheduled';
    return schedule;
  }

  getUpdateStatus(deviceId) {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw Object.assign(new Error(`Device not found: ${deviceId}`), { statusCode: 404 });
    }
    const scheduled = this.scheduledUpdates.get(deviceId);
    const registry = this.firmwareRegistry[device.protocol];
    return {
      deviceId,
      protocol: device.protocol,
      currentVersion: device.currentVersion,
      latestVersion: registry ? registry.latest : null,
      updateStatus: device.updateStatus,
      scheduledUpdate: scheduled || null,
      lastChecked: device.lastChecked
    };
  }

  getPendingUpdates() {
    return Array.from(this.scheduledUpdates.values())
      .filter(u => u.status === 'scheduled');
  }

  getUpdateHistory() {
    return this.updateHistory;
  }

  getStatistics() {
    const total = this.devices.size;
    const pending = this.getPendingUpdates().length;
    const completed = this.updateHistory.filter(h => h.status === 'completed').length;
    const outdated = this.checkForUpdates().filter(u => u.updateAvailable).length;

    return {
      totalDevices: total,
      pendingUpdates: pending,
      completedUpdates: completed,
      outdatedDevices: outdated,
      supportedProtocols: Object.keys(this.firmwareRegistry)
    };
  }

  _processScheduledUpdates() {
    const now = new Date().toISOString();
    for (const [deviceId, schedule] of this.scheduledUpdates) {
      if (schedule.status !== 'scheduled') continue;
      if (schedule.scheduledAt <= now) {
        const device = this.devices.get(deviceId);
        if (device) {
          // Simulate the update
          schedule.status = 'completed';
          schedule.completedAt = now;
          device.currentVersion = schedule.targetVersion;
          device.updateStatus = 'idle';
          this.updateHistory.push({ ...schedule });
          this.scheduledUpdates.delete(deviceId);
        }
      }
    }
  }

  _compareVersions(a, b) {
    const partsA = a.split('.').map(Number);
    const partsB = b.split('.').map(Number);
    const len = Math.max(partsA.length, partsB.length);
    for (let i = 0; i < len; i++) {
      const numA = partsA[i] || 0;
      const numB = partsB[i] || 0;
      if (numA < numB) return -1;
      if (numA > numB) return 1;
    }
    return 0;
  }

  destroy() {
    if (this._checkTimer) {
      clearInterval(this._checkTimer);
      this._checkTimer = null;
    }
    this.devices.clear();
    this.scheduledUpdates.clear();
    this.updateHistory = [];
  }
}

module.exports = DeviceFirmwareOTASystem;
