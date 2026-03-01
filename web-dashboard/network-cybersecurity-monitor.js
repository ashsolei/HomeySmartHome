'use strict';
const logger = require('./logger');
const MAX_ENTRIES = 1000;

/**
 * Network & Cybersecurity Monitor
 * Home network security and monitoring
 */
class NetworkCybersecurityMonitor {
  constructor(app) {
    this._intervals = [];
    this.app = app;
    this.devices = new Map();
    this.threats = [];
    this.firewallRules = new Map();
    this.networkTraffic = [];
    this.vulnerabilities = [];
    this.securityAlerts = [];
  }

  async initialize() {
    await this.setupDevices();
    await this.setupFirewallRules();
    await this.scanNetwork();
    
    this.startMonitoring();
  }

  // ============================================
  // DEVICE MANAGEMENT
  // ============================================

  async setupDevices() {
    const devices = [
      {
        id: 'router_main',
        name: 'Huvudrouter',
        type: 'router',
        ip: '192.168.1.1',
        mac: '00:11:22:33:44:55',
        manufacturer: 'Asus',
        status: 'online',
        lastSeen: Date.now(),
        trustLevel: 'trusted',
        vulnerabilities: []
      },
      {
        id: 'laptop_anna',
        name: 'Anna Laptop',
        type: 'computer',
        ip: '192.168.1.10',
        mac: 'AA:BB:CC:DD:EE:01',
        manufacturer: 'Apple',
        status: 'online',
        lastSeen: Date.now(),
        trustLevel: 'trusted',
        vulnerabilities: []
      },
      {
        id: 'phone_erik',
        name: 'Erik Telefon',
        type: 'mobile',
        ip: '192.168.1.11',
        mac: 'AA:BB:CC:DD:EE:02',
        manufacturer: 'Samsung',
        status: 'online',
        lastSeen: Date.now(),
        trustLevel: 'trusted',
        vulnerabilities: []
      },
      {
        id: 'tv_living',
        name: 'Smart TV Vardagsrum',
        type: 'smart_tv',
        ip: '192.168.1.20',
        mac: 'AA:BB:CC:DD:EE:03',
        manufacturer: 'Samsung',
        status: 'online',
        lastSeen: Date.now(),
        trustLevel: 'monitored',
        vulnerabilities: ['outdated_firmware']
      },
      {
        id: 'homey',
        name: 'Homey Pro',
        type: 'hub',
        ip: '192.168.1.30',
        mac: 'AA:BB:CC:DD:EE:04',
        manufacturer: 'Athom',
        status: 'online',
        lastSeen: Date.now(),
        trustLevel: 'trusted',
        vulnerabilities: []
      },
      {
        id: 'nas',
        name: 'NAS Server',
        type: 'storage',
        ip: '192.168.1.40',
        mac: 'AA:BB:CC:DD:EE:05',
        manufacturer: 'Synology',
        status: 'online',
        lastSeen: Date.now(),
        trustLevel: 'trusted',
        vulnerabilities: []
      },
      {
        id: 'guest_phone',
        name: 'Okänd enhet',
        type: 'mobile',
        ip: '192.168.1.99',
        mac: 'FF:FF:FF:FF:FF:FF',
        manufacturer: 'Unknown',
        status: 'online',
        lastSeen: Date.now(),
        trustLevel: 'untrusted',
        vulnerabilities: []
      }
    ];

    for (const device of devices) {
      this.devices.set(device.id, device);
    }
  }

  async scanNetwork() {
    logger.info('🔍 Scanning network...');

    let found = 0;
    let new_devices = 0;

    for (const [_id, device] of this.devices) {
      device.status = 'online';
      device.lastSeen = Date.now();
      found++;

      if (device.trustLevel === 'untrusted') {
        new_devices++;
        await this.createSecurityAlert('new_device', device);
      }
    }

    logger.info(`   Found ${found} devices (${new_devices} new)`);

    return { found, new_devices };
  }

  async trustDevice(deviceId) {
    const device = this.devices.get(deviceId);
    
    if (!device) {
      return { success: false, error: 'Device not found' };
    }

    device.trustLevel = 'trusted';
    logger.info(`✅ Device trusted: ${device.name}`);

    return { success: true };
  }

  async blockDevice(deviceId) {
    const device = this.devices.get(deviceId);
    
    if (!device) {
      return { success: false, error: 'Device not found' };
    }

    device.trustLevel = 'blocked';
    device.status = 'blocked';

    logger.info(`🚫 Device blocked: ${device.name} (${device.ip})`);

    return { success: true };
  }

  // ============================================
  // FIREWALL
  // ============================================

  async setupFirewallRules() {
    const rules = [
      {
        id: 'block_incoming',
        name: 'Blockera inkommande',
        type: 'incoming',
        action: 'block',
        ports: 'all',
        exceptions: [80, 443, 22],
        enabled: true
      },
      {
        id: 'allow_outgoing',
        name: 'Tillåt utgående',
        type: 'outgoing',
        action: 'allow',
        ports: 'all',
        exceptions: [],
        enabled: true
      },
      {
        id: 'block_suspicious',
        name: 'Blockera misstänkta IP',
        type: 'blacklist',
        action: 'block',
        ips: ['192.0.2.1', '198.51.100.1'],
        enabled: true
      },
      {
        id: 'rate_limit',
        name: 'Begränsa hastighet',
        type: 'rate_limit',
        action: 'limit',
        maxConnections: 100,
        timeWindow: 60,  // seconds
        enabled: true
      },
      {
        id: 'block_malicious',
        name: 'Blockera skadliga domäner',
        type: 'dns_filter',
        action: 'block',
        domains: ['malware.com', 'phishing.net'],
        enabled: true
      }
    ];

    for (const rule of rules) {
      this.firewallRules.set(rule.id, rule);
    }
  }

  async addFirewallRule(rule) {
    const ruleId = 'rule_' + Date.now();

    this.firewallRules.set(ruleId, {
      id: ruleId,
      ...rule,
      enabled: true
    });

    logger.info(`🛡️ Firewall rule added: ${rule.name}`);

    return { success: true, ruleId };
  }

  async enableFirewallRule(ruleId) {
    const rule = this.firewallRules.get(ruleId);
    
    if (!rule) {
      return { success: false, error: 'Rule not found' };
    }

    rule.enabled = true;
    logger.info(`✅ Firewall rule enabled: ${rule.name}`);

    return { success: true };
  }

  async disableFirewallRule(ruleId) {
    const rule = this.firewallRules.get(ruleId);
    
    if (!rule) {
      return { success: false, error: 'Rule not found' };
    }

    rule.enabled = false;
    logger.info(`⏸️ Firewall rule disabled: ${rule.name}`);

    return { success: true };
  }

  // ============================================
  // THREAT DETECTION
  // ============================================

  async detectThreats() {
    logger.info('🔎 Scanning for threats...');

    const threats = [];

    // Check for port scans
    const portScans = this.detectPortScans();
    if (portScans.length > 0) {
      threats.push(...portScans);
    }

    // Check for brute force attempts
    const bruteForce = this.detectBruteForce();
    if (bruteForce.length > 0) {
      threats.push(...bruteForce);
    }

    // Check for malware communication
    const malware = this.detectMalwareCommunication();
    if (malware.length > 0) {
      threats.push(...malware);
    }

    // Check for data exfiltration
    const dataLeaks = this.detectDataExfiltration();
    if (dataLeaks.length > 0) {
      threats.push(...dataLeaks);
    }

    if (threats.length > 0) {
      logger.info(`⚠️ ${threats.length} threats detected`);
      
      for (const threat of threats) {
        this.threats.push(threat);
    if (this.threats.length > MAX_ENTRIES) this.threats.shift();
        await this.createSecurityAlert('threat', threat);
      }
    } else {
      logger.info('✅ No threats detected');
    }

    return threats;
  }

  detectPortScans() {
    // Simulated port scan detection
    if (Math.random() < 0.1) {
      return [{
        type: 'port_scan',
        severity: 'medium',
        source: '203.0.113.42',
        target: '192.168.1.1',
        timestamp: Date.now(),
        details: 'Multiple port connection attempts detected'
      }];
    }
    return [];
  }

  detectBruteForce() {
    // Simulated brute force detection
    if (Math.random() < 0.05) {
      return [{
        type: 'brute_force',
        severity: 'high',
        source: '198.51.100.23',
        target: '192.168.1.1:22',
        timestamp: Date.now(),
        details: 'Multiple failed SSH login attempts'
      }];
    }
    return [];
  }

  detectMalwareCommunication() {
    // Check if any device is communicating with known malicious IPs
    for (const [_id, device] of this.devices) {
      if (device.trustLevel === 'untrusted' && Math.random() < 0.03) {
        return [{
          type: 'malware_communication',
          severity: 'critical',
          source: device.ip,
          target: 'malicious-server.com',
          timestamp: Date.now(),
          details: `Device ${device.name} communicating with known malware server`
        }];
      }
    }
    return [];
  }

  detectDataExfiltration() {
    // Detect unusual data transfer patterns
    if (Math.random() < 0.02) {
      return [{
        type: 'data_exfiltration',
        severity: 'critical',
        source: '192.168.1.40',
        target: 'unknown-server.com',
        timestamp: Date.now(),
        details: 'Unusual large data transfer detected'
      }];
    }
    return [];
  }

  // ============================================
  // VULNERABILITY SCANNING
  // ============================================

  async scanVulnerabilities() {
    logger.info('🔍 Scanning for vulnerabilities...');

    this.vulnerabilities = [];

    for (const [id, device] of this.devices) {
      const vulns = [];

      // Check for outdated firmware (simulated)
      if (device.type === 'smart_tv' || device.type === 'hub') {
        if (Math.random() < 0.3) {
          vulns.push({
            type: 'outdated_firmware',
            severity: 'medium',
            description: 'Firmware update available',
            cvss: 5.5
          });
        }
      }

      // Check for weak passwords (simulated)
      if (device.type === 'router' || device.type === 'storage') {
        if (Math.random() < 0.1) {
          vulns.push({
            type: 'weak_password',
            severity: 'high',
            description: 'Default or weak password detected',
            cvss: 7.5
          });
        }
      }

      // Check for open ports (simulated)
      if (Math.random() < 0.15) {
        vulns.push({
          type: 'open_ports',
          severity: 'low',
          description: 'Unnecessary ports are open',
          cvss: 3.0
        });
      }

      if (vulns.length > 0) {
        device.vulnerabilities = vulns;
        
        for (const vuln of vulns) {
          this.vulnerabilities.push({
            device: device.name,
            deviceId: id,
            ...vuln,
            timestamp: Date.now()
          });
          if (this.vulnerabilities.length > MAX_ENTRIES) this.vulnerabilities.shift();

          logger.info(`   ⚠️ ${device.name}: ${vuln.type} (${vuln.severity})`);
        }
      }
    }

    logger.info(`   Found ${this.vulnerabilities.length} vulnerabilities`);

    return this.vulnerabilities;
  }

  // ============================================
  // SECURITY ALERTS
  // ============================================

  async createSecurityAlert(type, data) {
    const alert = {
      id: 'alert_' + Date.now(),
      type,
      timestamp: Date.now(),
      severity: data.severity || 'info',
      data,
      acknowledged: false
    };

    this.securityAlerts.push(alert);
    if (this.securityAlerts.length > MAX_ENTRIES) this.securityAlerts.shift();

    logger.info(`🚨 Security alert: ${type} (${alert.severity})`);

    // Take automatic action for critical alerts
    if (alert.severity === 'critical') {
      await this.respondToThreat(alert);
    }

    return alert;
  }

  async respondToThreat(alert) {
    logger.info(`🛡️ Responding to threat: ${alert.type}`);

    switch (alert.type) {
      case 'new_device':
        if (alert.data.trustLevel === 'untrusted') {
          logger.info('   Isolating untrusted device');
          await this.blockDevice(alert.data.id);
        }
        break;

      case 'threat':
        if (alert.data.type === 'malware_communication') {
          logger.info('   Blocking malicious IP');
          logger.info('   Quarantining device');
        }
        break;

      case 'brute_force':
        logger.info('   Enabling rate limiting');
        logger.info('   Blocking source IP');
        break;
    }

    return { success: true };
  }

  async acknowledgeAlert(alertId) {
    const alert = this.securityAlerts.find(a => a.id === alertId);
    
    if (!alert) {
      return { success: false, error: 'Alert not found' };
    }

    alert.acknowledged = true;
    logger.info(`✅ Alert acknowledged: ${alertId}`);

    return { success: true };
  }

  // ============================================
  // NETWORK TRAFFIC
  // ============================================

  async monitorTraffic() {
    // Simulated traffic monitoring
    const traffic = {
      timestamp: Date.now(),
      totalDownload: 15.2,  // MB
      totalUpload: 3.4,
      connections: 42,
      bandwidth: {
        download: 45.2,  // Mbps
        upload: 12.8
      }
    };

    this.networkTraffic.push(traffic);
    if (this.networkTraffic.length > MAX_ENTRIES) this.networkTraffic.shift();

    // Check for unusual patterns
    if (traffic.totalUpload > 50) {  // MB
      await this.createSecurityAlert('unusual_traffic', {
        severity: 'medium',
        details: 'Unusually high upload detected'
      });
    }

    return traffic;
  }

  async getTrafficStats(hours = 24) {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    const recent = this.networkTraffic.filter(t => t.timestamp >= cutoff);

    if (recent.length === 0) {
      return { success: false, error: 'No data' };
    }

    const totalDownload = recent.reduce((sum, t) => sum + t.totalDownload, 0);
    const totalUpload = recent.reduce((sum, t) => sum + t.totalUpload, 0);
    const avgBandwidth = recent.reduce((sum, t) => sum + t.bandwidth.download, 0) / recent.length;

    return {
      totalDownload: totalDownload.toFixed(1) + ' MB',
      totalUpload: totalUpload.toFixed(1) + ' MB',
      avgBandwidth: avgBandwidth.toFixed(1) + ' Mbps',
      dataPoints: recent.length
    };
  }

  // ============================================
  // PARENTAL CONTROLS
  // ============================================

  async enableParentalControl(deviceId, profile) {
    const device = this.devices.get(deviceId);
    
    if (!device) {
      return { success: false, error: 'Device not found' };
    }

    logger.info(`👨‍👩‍👧‍👦 Parental control enabled for ${device.name}`);

    switch (profile) {
      case 'child':
        logger.info('   Blocking adult content');
        logger.info('   Setting time limits: 21:00-07:00');
        logger.info('   Monitoring activity');
        break;

      case 'teen':
        logger.info('   Filtering inappropriate content');
        logger.info('   Setting time limits: 23:00-06:00');
        break;
    }

    return { success: true };
  }

  // ============================================
  // MONITORING
  // ============================================

  startMonitoring() {
    // Scan network every 5 minutes
    this._intervals.push(setInterval(() => {
      this.scanNetwork();
    }, 5 * 60 * 1000));

    // Detect threats every minute
    this._intervals.push(setInterval(() => {
      this.detectThreats();
    }, 60 * 1000));

    // Scan vulnerabilities daily
    this._intervals.push(setInterval(() => {
      this.scanVulnerabilities();
    }, 24 * 60 * 60 * 1000));

    // Monitor traffic every 5 minutes
    this._intervals.push(setInterval(() => {
      this.monitorTraffic();
    }, 5 * 60 * 1000));

    logger.info('🔒 Network Security Monitor active');
  }

  // ============================================
  // REPORTING
  // ============================================

  getSecurityOverview() {
    const activeDevices = Array.from(this.devices.values()).filter(d => d.status === 'online').length;
    const untrustedDevices = Array.from(this.devices.values()).filter(d => d.trustLevel === 'untrusted').length;
    const activeAlerts = this.securityAlerts.filter(a => !a.acknowledged).length;

    return {
      devices: this.devices.size,
      activeDevices,
      untrustedDevices,
      threats: this.threats.length,
      vulnerabilities: this.vulnerabilities.length,
      activeAlerts,
      firewallRules: this.firewallRules.size
    };
  }

  getDevicesList() {
    return Array.from(this.devices.values()).map(d => ({
      name: d.name,
      type: d.type,
      ip: d.ip,
      status: d.status,
      trust: d.trustLevel,
      vulnerabilities: d.vulnerabilities.length
    }));
  }

  getSecurityAlerts(limit = 10) {
    return this.securityAlerts
      .slice(-limit)
      .reverse()
      .map(a => ({
        time: new Date(a.timestamp).toLocaleString('sv-SE'),
        type: a.type,
        severity: a.severity.toUpperCase(),
        acknowledged: a.acknowledged ? '✅' : '⚠️'
      }));
  }

  getThreatsSummary() {
    const byType = {};
    const bySeverity = { low: 0, medium: 0, high: 0, critical: 0 };

    for (const threat of this.threats) {
      byType[threat.type] = (byType[threat.type] || 0) + 1;
      bySeverity[threat.severity]++;
    }

    return {
      total: this.threats.length,
      byType,
      bySeverity
    };
  }

  getVulnerabilitiesList() {
    return this.vulnerabilities.map(v => ({
      device: v.device,
      type: v.type,
      severity: v.severity.toUpperCase(),
      cvss: v.cvss,
      description: v.description
    }));
  }

  destroy() {
    if (this._intervals) {
      this._intervals.forEach(id => clearInterval(id));
      this._intervals = [];
    }
  }
}

module.exports = NetworkCybersecurityMonitor;
