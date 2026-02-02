'use strict';

const EventEmitter = require('events');
const Homey = require('homey');

/**
 * Advanced Home Network Security System
 * 
 * Network monitoring, intrusion detection, device security, and threat prevention.
 * 
 * @extends EventEmitter
 */
class AdvancedHomeNetworkSecuritySystem extends EventEmitter {
  constructor() {
    super();
    
    this.networkDevices = new Map();
    this.securityRules = new Map();
    this.securityEvents = [];
    this.blockedDevices = new Set();
    this.firewallRules = [];
    
    this.settings = {
      intrusionDetectionEnabled: true,
      autoBlockSuspiciousDevices: true,
      unknownDeviceAlertsEnabled: true,
      vpnRequired: false,
      securityLevel: 'high', // low, medium, high
      bandwidthMonitoring: true
    };
    
    this.networkStats = {
      totalDevices: 0,
      onlineDevices: 0,
      suspiciousActivity: 0,
      blockedAttempts: 0,
      totalBandwidthUsage: 0 // MB
    };
    
    this.cache = { data: new Map(), timestamps: new Map(), ttl: 3 * 60 * 1000 };
    this.monitoring = { interval: null, checkInterval: 1 * 60 * 1000, lastCheck: null };
    
    this.initializeDefaultData();
  }
  
  initializeDefaultData() {
    // Trusted devices
    this.networkDevices.set('device-001', {
      id: 'device-001',
      name: 'John iPhone',
      macAddress: 'AA:BB:CC:DD:EE:01',
      ipAddress: '192.168.1.10',
      type: 'smartphone',
      manufacturer: 'Apple',
      status: 'online',
      trusted: true,
      firstSeen: Date.now() - 365 * 24 * 60 * 60 * 1000,
      lastSeen: Date.now() - 5 * 60 * 1000,
      bandwidthUsage: 125, // MB today
      securityScore: 95
    });
    
    this.networkDevices.set('device-002', {
      id: 'device-002',
      name: 'Smart TV Living Room',
      macAddress: 'AA:BB:CC:DD:EE:02',
      ipAddress: '192.168.1.20',
      type: 'smart-tv',
      manufacturer: 'Samsung',
      status: 'online',
      trusted: true,
      firstSeen: Date.now() - 200 * 24 * 60 * 60 * 1000,
      lastSeen: Date.now() - 2 * 60 * 1000,
      bandwidthUsage: 3420, // MB today (streaming)
      securityScore: 75,
      vulnerabilities: ['Outdated firmware']
    });
    
    this.networkDevices.set('device-003', {
      id: 'device-003',
      name: 'Home NAS Server',
      macAddress: 'AA:BB:CC:DD:EE:03',
      ipAddress: '192.168.1.50',
      type: 'nas',
      manufacturer: 'Synology',
      status: 'online',
      trusted: true,
      firstSeen: Date.now() - 400 * 24 * 60 * 60 * 1000,
      lastSeen: Date.now() - 1 * 60 * 1000,
      bandwidthUsage: 850,
      securityScore: 98,
      openPorts: [5000, 5001, 22],
      encrypted: true
    });
    
    this.networkDevices.set('device-004', {
      id: 'device-004',
      name: 'Unknown Device',
      macAddress: 'AA:BB:CC:DD:EE:99',
      ipAddress: '192.168.1.105',
      type: 'unknown',
      manufacturer: 'Unknown',
      status: 'online',
      trusted: false,
      firstSeen: Date.now() - 2 * 60 * 60 * 1000,
      lastSeen: Date.now() - 30 * 1000,
      bandwidthUsage: 45,
      securityScore: 20,
      suspiciousActivity: true
    });
    
    // Security rules
    this.securityRules.set('rule-001', {
      id: 'rule-001',
      name: 'Block Untrusted Devices',
      type: 'access-control',
      enabled: true,
      action: 'block',
      condition: 'trusted === false',
      priority: 1
    });
    
    this.securityRules.set('rule-002', {
      id: 'rule-002',
      name: 'Alert on New Device',
      type: 'detection',
      enabled: true,
      action: 'alert',
      condition: 'firstSeen < 24h',
      priority: 2
    });
    
    this.securityRules.set('rule-003', {
      id: 'rule-003',
      name: 'Monitor High Bandwidth',
      type: 'monitoring',
      enabled: true,
      action: 'alert',
      condition: 'bandwidthUsage > 5GB',
      priority: 3
    });
    
    // Firewall rules
    this.firewallRules = [
      { port: 22, protocol: 'tcp', action: 'block', description: 'Block external SSH' },
      { port: 80, protocol: 'tcp', action: 'allow', description: 'Allow HTTP' },
      { port: 443, protocol: 'tcp', action: 'allow', description: 'Allow HTTPS' },
      { port: 5000, protocol: 'tcp', action: 'allow-local', description: 'NAS web interface (local only)' }
    ];
    
    // Recent security events
    this.securityEvents.push({
      id: 'event-001',
      timestamp: Date.now() - 3 * 60 * 60 * 1000,
      type: 'new-device-detected',
      severity: 'medium',
      deviceId: 'device-004',
      description: 'Unknown device connected to network',
      handled: false
    });
  }
  
  async initialize() {
    try {
      await this.loadSettings();
      this.startMonitoring();
      
      this.emit('notification', {
        type: 'info',
        priority: 'low',
        title: 'Network Security System',
        message: `Network security initialized with ${this.networkDevices.size} devices`
      });
      
      return { success: true, devices: this.networkDevices.size };
    } catch (error) {
      this.emit('notification', {
        type: 'error',
        priority: 'high',
        title: 'Network Security Error',
        message: `Failed to initialize: ${error.message}`
      });
      throw error;
    }
  }
  
  async scanNetwork() {
    // Simulate network scan
    const devices = Array.from(this.networkDevices.values());
    
    // Update device statuses
    for (const device of devices) {
      const minutesSinceLastSeen = (Date.now() - device.lastSeen) / 60000;
      device.status = minutesSinceLastSeen < 5 ? 'online' : 'offline';
    }
    
    this.networkStats.onlineDevices = devices.filter(d => d.status === 'online').length;
    this.networkStats.totalDevices = devices.length;
    
    await this.saveSettings();
    this.clearCache();
    
    return {
      success: true,
      devicesFound: devices.length,
      online: this.networkStats.onlineDevices,
      suspicious: devices.filter(d => d.suspiciousActivity).length
    };
  }
  
  async trustDevice(deviceId) {
    const device = this.networkDevices.get(deviceId);
    if (!device) throw new Error(`Device ${deviceId} not found`);
    
    device.trusted = true;
    device.suspiciousActivity = false;
    
    if (this.blockedDevices.has(deviceId)) {
      this.blockedDevices.delete(deviceId);
    }
    
    this.emit('notification', {
      type: 'success',
      priority: 'low',
      title: 'Device Trusted',
      message: `${device.name} added to trusted devices`
    });
    
    await this.saveSettings();
    return { success: true, device: device.name };
  }
  
  async blockDevice(deviceId, reason = 'Manual block') {
    const device = this.networkDevices.get(deviceId);
    if (!device) throw new Error(`Device ${deviceId} not found`);
    
    device.trusted = false;
    this.blockedDevices.add(deviceId);
    
    this.securityEvents.unshift({
      id: `event-${Date.now()}`,
      timestamp: Date.now(),
      type: 'device-blocked',
      severity: 'high',
      deviceId,
      description: `${device.name} blocked: ${reason}`,
      handled: true
    });
    
    this.emit('notification', {
      type: 'warning',
      priority: 'high',
      title: 'Device Blocked',
      message: `${device.name} has been blocked from network`
    });
    
    await this.saveSettings();
    return { success: true, device: device.name, reason };
  }
  
  async detectIntrusionAttempt(deviceId) {
    const device = this.networkDevices.get(deviceId);
    if (!device) return;
    
    device.suspiciousActivity = true;
    device.securityScore = Math.max(0, device.securityScore - 30);
    
    this.securityEvents.unshift({
      id: `event-${Date.now()}`,
      timestamp: Date.now(),
      type: 'intrusion-attempt',
      severity: 'critical',
      deviceId,
      description: `Intrusion attempt detected from ${device.name}`,
      handled: false
    });
    
    this.networkStats.suspiciousActivity++;
    
    if (this.settings.autoBlockSuspiciousDevices) {
      await this.blockDevice(deviceId, 'Intrusion attempt detected');
    }
    
    this.emit('notification', {
      type: 'error',
      priority: 'critical',
      title: '🚨 Intrusion Attempt Detected',
      message: `Suspicious activity from ${device.name} (${device.ipAddress})`
    });
    
    await this.saveSettings();
  }
  
  getNetworkSecurityStatus() {
    const cached = this.getCached('network-security-status');
    if (cached) return cached;
    
    const devices = Array.from(this.networkDevices.values());
    const onlineDevices = devices.filter(d => d.status === 'online');
    const trustedDevices = devices.filter(d => d.trusted);
    const untrustedDevices = devices.filter(d => !d.trusted);
    const suspiciousDevices = devices.filter(d => d.suspiciousActivity);
    
    // Calculate network health score
    let healthScore = 100;
    healthScore -= untrustedDevices.length * 10;
    healthScore -= suspiciousDevices.length * 20;
    healthScore -= devices.filter(d => d.vulnerabilities && d.vulnerabilities.length > 0).length * 5;
    healthScore = Math.max(0, Math.min(100, healthScore));
    
    const status = {
      overall: {
        healthScore,
        securityLevel: this.settings.securityLevel,
        status: healthScore > 80 ? 'secure' : healthScore > 50 ? 'warning' : 'critical'
      },
      devices: {
        total: this.networkStats.totalDevices,
        online: this.networkStats.onlineDevices,
        trusted: trustedDevices.length,
        untrusted: untrustedDevices.length,
        suspicious: suspiciousDevices.length,
        blocked: this.blockedDevices.size
      },
      activity: {
        suspiciousEvents: this.networkStats.suspiciousActivity,
        blockedAttempts: this.networkStats.blockedAttempts,
        recentEvents: this.securityEvents.slice(0, 10),
        unhandledEvents: this.securityEvents.filter(e => !e.handled).length
      },
      bandwidth: {
        totalUsage: Math.round(devices.reduce((sum, d) => sum + d.bandwidthUsage, 0)),
        topConsumer: devices.sort((a, b) => b.bandwidthUsage - a.bandwidthUsage)[0]?.name || 'N/A'
      },
      vulnerabilities: {
        total: devices.filter(d => d.vulnerabilities && d.vulnerabilities.length > 0).length,
        details: devices
          .filter(d => d.vulnerabilities && d.vulnerabilities.length > 0)
          .map(d => ({ device: d.name, vulnerabilities: d.vulnerabilities }))
      }
    };
    
    this.setCached('network-security-status', status);
    return status;
  }
  
  startMonitoring() {
    if (this.monitoring.interval) clearInterval(this.monitoring.interval);
    this.monitoring.interval = setInterval(() => this.monitorNetwork(), this.monitoring.checkInterval);
  }
  
  monitorNetwork() {
    this.monitoring.lastCheck = Date.now();
    
    // Check for unknown devices
    if (this.settings.unknownDeviceAlertsEnabled) {
      for (const [id, device] of this.networkDevices) {
        if (!device.trusted && !this.blockedDevices.has(id)) {
          const hoursSinceFirstSeen = (Date.now() - device.firstSeen) / (60 * 60 * 1000);
          
          if (hoursSinceFirstSeen < 1) {
            this.emit('notification', {
              type: 'warning',
              priority: 'high',
              title: 'New Device Detected',
              message: `Unknown device connected: ${device.name || device.macAddress}`
            });
          }
        }
      }
    }
    
    // Check bandwidth usage
    if (this.settings.bandwidthMonitoring) {
      for (const [id, device] of this.networkDevices) {
        if (device.bandwidthUsage > 5000) { // > 5GB
          this.emit('notification', {
            type: 'info',
            priority: 'low',
            title: 'High Bandwidth Usage',
            message: `${device.name} has used ${Math.round(device.bandwidthUsage / 1024)} GB today`
          });
        }
      }
    }
    
    // Check device vulnerabilities
    for (const [id, device] of this.networkDevices) {
      if (device.vulnerabilities && device.vulnerabilities.length > 0) {
        this.emit('notification', {
          type: 'warning',
          priority: 'medium',
          title: 'Device Vulnerability',
          message: `${device.name}: ${device.vulnerabilities[0]}`
        });
      }
    }
  }
  
  getCached(key) {
    const cached = this.cache.data.get(key);
    const timestamp = this.cache.timestamps.get(key);
    if (cached && timestamp && (Date.now() - timestamp < this.cache.ttl)) return cached;
    return null;
  }
  
  setCached(key, value) {
    this.cache.data.set(key, value);
    this.cache.timestamps.set(key, Date.now());
  }
  
  clearCache() {
    this.cache.data.clear();
    this.cache.timestamps.clear();
  }
  
  async loadSettings() {
    try {
      const settings = Homey.ManagerSettings.get('advancedHomeNetworkSecuritySystem');
      if (settings) {
        this.networkDevices = new Map(settings.networkDevices || []);
        this.securityRules = new Map(settings.securityRules || []);
        this.securityEvents = settings.securityEvents || [];
        this.blockedDevices = new Set(settings.blockedDevices || []);
        this.firewallRules = settings.firewallRules || [];
        Object.assign(this.settings, settings.settings || {});
        Object.assign(this.networkStats, settings.networkStats || {});
      }
    } catch (error) {
      console.error('Failed to load network security settings:', error);
    }
  }
  
  async saveSettings() {
    try {
      const settings = {
        networkDevices: Array.from(this.networkDevices.entries()),
        securityRules: Array.from(this.securityRules.entries()),
        securityEvents: this.securityEvents.slice(0, 100), // Keep last 100
        blockedDevices: Array.from(this.blockedDevices),
        firewallRules: this.firewallRules,
        settings: this.settings,
        networkStats: this.networkStats
      };
      Homey.ManagerSettings.set('advancedHomeNetworkSecuritySystem', settings);
    } catch (error) {
      console.error('Failed to save network security settings:', error);
      throw error;
    }
  }
  
  getNetworkDevices() { return Array.from(this.networkDevices.values()); }
  getSecurityRules() { return Array.from(this.securityRules.values()); }
  getSecurityEvents(limit = 50) { return this.securityEvents.slice(0, limit); }
  getBlockedDevices() { return Array.from(this.blockedDevices); }
  getFirewallRules() { return this.firewallRules; }
}

module.exports = AdvancedHomeNetworkSecuritySystem;
