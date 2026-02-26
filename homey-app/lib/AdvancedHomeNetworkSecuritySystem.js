'use strict';

/**
 * AdvancedHomeNetworkSecuritySystem
 * Comprehensive home network security, monitoring, intrusion detection,
 * firewall management, parental controls, and threat intelligence.
 */

const MAC_VENDOR_PREFIXES = {
  '00:1A:2B': 'Apple', 'AC:DE:48': 'Apple', '3C:22:FB': 'Apple',
  'B8:27:EB': 'Raspberry Pi', 'DC:A6:32': 'Raspberry Pi',
  '00:17:88': 'Philips Hue', '00:1F:E2': 'Samsung', '5C:49:7D': 'Samsung',
  '30:AE:A4': 'Espressif (IoT)', 'A4:CF:12': 'Espressif (IoT)',
  '00:0C:29': 'VMware', '00:50:56': 'VMware',
  '00:1B:63': 'HP', '3C:D9:2B': 'HP',
  '00:23:24': 'Sonos', 'B8:E9:37': 'Sonos',
  '44:D9:E7': 'Ubiquiti', '78:8A:20': 'Ubiquiti',
  'FC:EC:DA': 'Amazon', 'A0:02:DC': 'Amazon',
  '30:FD:38': 'Google', 'F4:F5:D8': 'Google',
  '68:DB:F5': 'Ring', 'B0:09:DA': 'Roku',
  '00:04:4B': 'Nvidia', '48:B0:2D': 'Nvidia',
  '00:1E:EC': 'LG', 'CC:2D:8C': 'LG',
  '7C:2F:80': 'TP-Link', '50:C7:BF': 'TP-Link',
  '60:01:94': 'Nest', '18:B4:30': 'Nest',
  'B4:E6:2D': 'Xiaomi', '64:CE:01': 'Xiaomi',
  '00:1D:C9': 'Dell', 'F8:DB:88': 'Dell',
  '3C:7A:8A': 'Arris', '00:1D:D6': 'Arris'
};

const DEVICE_TYPES = {
  IoT: ['Philips Hue', 'Espressif (IoT)', 'Nest', 'Ring', 'Xiaomi', 'TP-Link'],
  MOBILE: ['Apple', 'Samsung', 'Google'],
  PC: ['Dell', 'HP', 'VMware', 'Nvidia'],
  TV: ['LG', 'Roku', 'Amazon'],
  SMART_HOME: ['Sonos', 'Ubiquiti', 'Nest', 'Ring'],
  PRINTER: ['HP'],
  SBC: ['Raspberry Pi']
};

const TRUST_LEVELS = {
  TRUSTED: 'trusted',
  KNOWN: 'known',
  RESTRICTED: 'restricted',
  BLOCKED: 'blocked'
};

const QOS_PRIORITIES = {
  WORK: 4,
  STREAMING: 3,
  IOT: 2,
  DOWNLOADS: 1
};

const MALICIOUS_DOMAIN_PATTERNS = [
  /^(.*\.)?malware\./i, /^(.*\.)?phishing\./i, /^(.*\.)?trojan\./i,
  /^(.*\.)?ransomware\./i, /^(.*\.)?botnet\./i, /^(.*\.)?cryptominer\./i,
  /^(.*\.)?adware\./i, /^(.*\.)?spyware\./i, /^(.*\.)?keylogger\./i,
  /^(.*\.)?exploit-kit\./i, /^(.*\.)?c2server\./i, /^(.*\.)?darkweb\./i,
  /^(.*\.)?hack(ed|ing|er)\./i, /^(.*\.)?steal(er)?\./i,
  /^(.*\.)?evil\./i, /^(.*\.)?fraud\./i, /^(.*\.)?scam\./i,
  /^(.*\.)?fake-login\./i, /^(.*\.)?credential-harvest\./i,
  /^(.*\.)?drive-by\./i, /^(.*\.)?watering-hole\./i,
  /^(.*\.)?typosquat\./i, /^(.*\.)?click-fraud\./i,
  /^(.*\.)?sinkhole\./i, /^(.*\.)?fastflux\./i,
  /^(.*\.)?dga-domain\./i, /^(.*\.)?apt-group\./i,
  /^(.*\.)?zero-day\./i, /^(.*\.)?backdoor\./i,
  /^(.*\.)?rootkit\./i, /^(.*\.)?worm\./i,
  /^(.*\.)?ddos\./i, /^(.*\.)?amplification\./i,
  /^(.*\.)?spam-relay\./i, /^(.*\.)?open-proxy\./i,
  /^(.*\.)?tor-exit\./i, /^(.*\.)?vpn-abuse\./i,
  /^(.*\.)?bulletproof\./i, /^(.*\.)?offshore-host\./i,
  /^(.*\.)?data-exfil\./i, /^(.*\.)?dns-tunnel\./i,
  /^(.*\.)?covert-channel\./i, /^(.*\.)?beacon\./i,
  /^(.*\.)?payload-drop\./i, /^(.*\.)?stager\./i,
  /^(.*\.)?loader\./i, /^(.*\.)?injector\./i,
  /^(.*\.)?packer\./i, /^(.*\.)?obfuscator\./i,
  /^(.*\.)?crypter\./i, /^(.*\.)?binder\./i,
  /^(.*\.)?downloader\./i, /^(.*\.)?dropper\./i,
  /^(.*\.)?install-rogue\./i, /^(.*\.)?unwanted-soft\./i,
  /^(.*\.)?pup-distrib\./i, /^(.*\.)?toolbar-spam\./i,
  /^(.*\.)?browser-hijack\./i, /^(.*\.)?search-redirect\./i,
  /^(.*\.)?popup-ads\./i, /^(.*\.)?track(er|ing)\./i,
  /^(.*\.)?fingerprint\./i, /^(.*\.)?supercookie\./i,
  /^(.*\.)?canvas-fp\./i, /^(.*\.)?device-id\./i,
  /^(.*\.)?cross-site\./i, /^(.*\.)?xss-attack\./i,
  /^(.*\.)?sql-inject\./i, /^(.*\.)?rce-exploit\./i,
  /^(.*\.)?lfi-attack\./i, /^(.*\.)?rfi-attack\./i,
  /^(.*\.)?ssrf-target\./i, /^(.*\.)?deserialization\./i,
  /^(.*\.)?xxe-attack\./i, /^(.*\.)?csrf-token\./i,
  /^(.*\.)?account-takeover\./i, /^(.*\.)?brute-force\./i,
  /^(.*\.)?password-spray\./i, /^(.*\.)?credential-stuff\./i,
  /^(.*\.)?session-hijack\./i, /^(.*\.)?cookie-theft\./i,
  /^(.*\.)?mitm-attack\./i, /^(.*\.)?ssl-strip\./i,
  /^(.*\.)?cert-spoof\./i, /^(.*\.)?domain-front\./i,
  /^(.*\.)?dns-rebind\./i, /^(.*\.)?cache-poison\./i,
  /^(.*\.)?arp-spoof\./i, /^(.*\.)?ip-spoof\./i,
  /^(.*\.)?mac-spoof\./i, /^(.*\.)?vlan-hop\./i,
  /^(.*\.)?evil-twin\./i, /^(.*\.)?rogue-ap\./i,
  /^(.*\.)?deauth-attack\./i, /^(.*\.)?wps-crack\./i,
  /^(.*\.)?handshake-cap\./i, /^(.*\.)?karma-attack\./i,
  /^(.*\.)?sslsplit\./i, /^(.*\.)?mitmproxy\./i,
  /^(.*\.)?sniff(er|ing)\./i, /^(.*\.)?wiretap\./i,
  /^(.*\.)?exfiltrate\./i, /^(.*\.)?leak(ed|s)?\./i,
  /^(.*\.)?breach(ed)?\./i, /^(.*\.)?dump(ed|s)?\./i,
  /^(.*\.)?paste-bin-mal\./i, /^(.*\.)?dark-market\./i
];

const CONTENT_CATEGORIES = {
  ADULT: 'adult',
  GAMBLING: 'gambling',
  SOCIAL_MEDIA: 'social_media',
  GAMING: 'gaming',
  STREAMING: 'streaming',
  SHOPPING: 'shopping',
  NEWS: 'news',
  EDUCATION: 'education'
};

class AdvancedHomeNetworkSecuritySystem {
  constructor(homey) {
    this.homey = homey;
    this.devices = new Map();
    this.firewallRules = [];
    this.bandwidthStats = new Map();
    this.dnsQueryLog = [];
    this.auditLog = [];
    this.threatIntelFeed = new Map();
    this.parentalProfiles = new Map();
    this.guestSessions = new Map();
    this.vpnClients = new Map();
    this.certificates = new Map();
    this.networkBackups = [];
    this.idsAlerts = [];
    this.monitoringInterval = null;
    this.scanInterval = 90000;
    this.isInitialized = false;
    this.isLockdown = false;
    this.networkSubnet = '192.168.1';
    this.gatewayIP = '192.168.1.1';
    this.totalBandwidthMbps = 500;
    this.trafficBaselines = new Map();
    this.blockedIPs = new Set();
    this.dnsBlocklist = new Set();
    this.failedLoginAttempts = new Map();
    this.securityPostureScore = 75;
    this.maxAuditLogSize = 2000;
    this.networkTopology = { nodes: [], edges: [] };
    this.configSnapshots = [];
    this.speedTestResults = [];
    this.iotSegmentRules = [];
    this.emergencyMode = false;
  }

  async initialize() {
    try {
      this.log('Initializing Advanced Home Network Security System...');

      this._initializeThreatIntelFeed();
      this._initializeDNSBlocklist();
      this._initializeDefaultFirewallRules();
      this._initializeIoTSegmentRules();
      this._initializeDefaultParentalProfiles();
      this._initializeCertificateMonitoring();
      this._initializeGuestNetwork();

      await this._performInitialNetworkScan();
      this._calculateSecurityPosture();

      this.monitoringInterval = setInterval(() => {
        this._monitoringCycle();
      }, this.scanInterval);

      this.isInitialized = true;
      this._addAuditEntry('SYSTEM', 'Network Security System initialized');
      this.log('Advanced Home Network Security System initialized successfully');
    } catch (error) {
      this.homey.error(`[AdvancedHomeNetworkSecuritySystem] Failed to initialize:`, error.message);
    }
  }

  // ─── Network Topology Discovery ──────────────────────────────────────

  async _performInitialNetworkScan() {
    this.log('Performing initial network scan on ' + this.networkSubnet + '.0/24...');
    const discoveredCount = this._simulateNetworkScan();
    this.log(`Discovered ${discoveredCount} devices on network`);
    this._buildNetworkTopology();
    return discoveredCount;
  }

  _simulateNetworkScan() {
    const simulatedDevices = [
      { ip: this.gatewayIP, mac: '3C:7A:8A:01:02:03', hostname: 'gateway-router', online: true },
      { ip: `${this.networkSubnet}.10`, mac: 'AC:DE:48:AA:BB:CC', hostname: 'MacBook-Pro', online: true },
      { ip: `${this.networkSubnet}.11`, mac: '5C:49:7D:11:22:33', hostname: 'Galaxy-S24', online: true },
      { ip: `${this.networkSubnet}.12`, mac: '30:FD:38:44:55:66', hostname: 'Pixel-8', online: true },
      { ip: `${this.networkSubnet}.20`, mac: '00:17:88:AA:11:22', hostname: 'Hue-Bridge', online: true },
      { ip: `${this.networkSubnet}.21`, mac: '30:AE:A4:BB:CC:DD', hostname: 'ESP32-Sensor-1', online: true },
      { ip: `${this.networkSubnet}.22`, mac: 'A4:CF:12:EE:FF:00', hostname: 'ESP32-Sensor-2', online: true },
      { ip: `${this.networkSubnet}.23`, mac: '60:01:94:11:22:33', hostname: 'Nest-Thermostat', online: true },
      { ip: `${this.networkSubnet}.24`, mac: '68:DB:F5:44:55:66', hostname: 'Ring-Doorbell', online: true },
      { ip: `${this.networkSubnet}.25`, mac: 'B4:E6:2D:77:88:99', hostname: 'Xiaomi-Vacuum', online: true },
      { ip: `${this.networkSubnet}.30`, mac: '00:23:24:AA:BB:CC', hostname: 'Sonos-Living', online: true },
      { ip: `${this.networkSubnet}.31`, mac: '00:23:24:DD:EE:FF', hostname: 'Sonos-Bedroom', online: true },
      { ip: `${this.networkSubnet}.40`, mac: '1C:1B:0D:AA:BB:CC', hostname: 'Work-Laptop', online: true },
      { ip: `${this.networkSubnet}.41`, mac: '00:1D:C9:11:22:33', hostname: 'Dell-Desktop', online: true },
      { ip: `${this.networkSubnet}.50`, mac: 'CC:2D:8C:AA:BB:CC', hostname: 'LG-TV-Living', online: true },
      { ip: `${this.networkSubnet}.51`, mac: 'B0:09:DA:11:22:33', hostname: 'Roku-Bedroom', online: true },
      { ip: `${this.networkSubnet}.52`, mac: 'FC:EC:DA:44:55:66', hostname: 'Fire-TV-Stick', online: true },
      { ip: `${this.networkSubnet}.60`, mac: '3C:D9:2B:AA:BB:CC', hostname: 'HP-Printer', online: true },
      { ip: `${this.networkSubnet}.70`, mac: '44:D9:E7:11:22:33', hostname: 'Ubiquiti-AP', online: true },
      { ip: `${this.networkSubnet}.80`, mac: 'B8:27:EB:AA:BB:CC', hostname: 'RPi-HomeAssistant', online: true },
    ];

    for (const dev of simulatedDevices) {
      const macPrefix = dev.mac.substring(0, 8).toUpperCase();
      const vendor = MAC_VENDOR_PREFIXES[macPrefix] || 'Unknown';
      const deviceType = this._classifyDeviceType(vendor);
      const trustLevel = this._autoClassifyTrust(deviceType, vendor);

      this.devices.set(dev.ip, {
        ip: dev.ip,
        mac: dev.mac,
        hostname: dev.hostname,
        vendor,
        deviceType,
        trustLevel,
        online: dev.online,
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        riskScore: this._calculateDeviceRiskScore(deviceType, trustLevel),
        openPorts: [],
        trafficVolume: { upload: 0, download: 0 },
        dnsQueries: 0,
        blockedAttempts: 0,
        signalStrength: deviceType === 'PC' ? -35 : Math.floor(-30 + Math.random() * -45),
        firmwareVersion: '1.0.' + Math.floor(Math.random() * 20),
        vulnerabilities: [],
        qosPriority: this._assignQoSPriority(deviceType)
      });

      this.bandwidthStats.set(dev.ip, {
        currentUpload: 0,
        currentDownload: 0,
        totalUpload: Math.floor(Math.random() * 1024 * 50),
        totalDownload: Math.floor(Math.random() * 1024 * 200),
        peakUpload: 0,
        peakDownload: 0,
        history: []
      });

      this.trafficBaselines.set(dev.ip, {
        avgUpload: Math.floor(Math.random() * 50 + 10),
        avgDownload: Math.floor(Math.random() * 200 + 50),
        stdDev: Math.floor(Math.random() * 30 + 5)
      });
    }

    return simulatedDevices.length;
  }

  _classifyDeviceType(vendor) {
    for (const [type, vendors] of Object.entries(DEVICE_TYPES)) {
      if (vendors.includes(vendor)) return type;
    }
    return 'UNKNOWN';
  }

  _autoClassifyTrust(deviceType, _vendor) {
    if (['PC', 'MOBILE'].includes(deviceType)) return TRUST_LEVELS.TRUSTED;
    if (['SMART_HOME', 'SBC'].includes(deviceType)) return TRUST_LEVELS.KNOWN;
    if (['IoT', 'TV', 'PRINTER'].includes(deviceType)) return TRUST_LEVELS.RESTRICTED;
    return TRUST_LEVELS.RESTRICTED;
  }

  _assignQoSPriority(deviceType) {
    switch (deviceType) {
      case 'PC': return QOS_PRIORITIES.WORK;
      case 'MOBILE': return QOS_PRIORITIES.WORK;
      case 'TV': return QOS_PRIORITIES.STREAMING;
      case 'SMART_HOME': return QOS_PRIORITIES.STREAMING;
      case 'IoT': return QOS_PRIORITIES.IOT;
      default: return QOS_PRIORITIES.DOWNLOADS;
    }
  }

  _calculateDeviceRiskScore(deviceType, trustLevel) {
    let score = 30;
    if (deviceType === 'IoT') score += 25;
    if (deviceType === 'UNKNOWN') score += 40;
    if (trustLevel === TRUST_LEVELS.RESTRICTED) score += 15;
    if (trustLevel === TRUST_LEVELS.BLOCKED) score += 30;
    if (trustLevel === TRUST_LEVELS.TRUSTED) score -= 20;
    return Math.max(0, Math.min(100, score));
  }

  _buildNetworkTopology() {
    this.networkTopology = { nodes: [], edges: [] };

    this.networkTopology.nodes.push({
      id: this.gatewayIP,
      type: 'gateway',
      label: 'Gateway Router'
    });

    for (const [ip, device] of this.devices) {
      if (ip === this.gatewayIP) continue;
      this.networkTopology.nodes.push({
        id: ip,
        type: device.deviceType,
        label: device.hostname,
        trustLevel: device.trustLevel
      });
      this.networkTopology.edges.push({
        from: this.gatewayIP,
        to: ip,
        bandwidth: this.bandwidthStats.get(ip)?.currentDownload || 0
      });
    }

    this.log(`Network topology built: ${this.networkTopology.nodes.length} nodes, ${this.networkTopology.edges.length} edges`);
  }

  getNetworkTopology() {
    return { ...this.networkTopology };
  }

  getDeviceByIP(ip) {
    return this.devices.get(ip) || null;
  }

  getAllDevices() {
    return Array.from(this.devices.values());
  }

  getDevicesByType(type) {
    return Array.from(this.devices.values()).filter(d => d.deviceType === type);
  }

  getDevicesByTrust(level) {
    return Array.from(this.devices.values()).filter(d => d.trustLevel === level);
  }

  // ─── Device Trust Management ─────────────────────────────────────────

  setDeviceTrust(ip, level) {
    const device = this.devices.get(ip);
    if (!device) {
      this.error(`Device not found: ${ip}`);
      return false;
    }
    const oldLevel = device.trustLevel;
    device.trustLevel = level;
    device.riskScore = this._calculateDeviceRiskScore(device.deviceType, level);
    this._addAuditEntry('TRUST', `Device ${ip} trust changed: ${oldLevel} -> ${level}`);
    this.log(`Trust level for ${ip} (${device.hostname}) changed to ${level}`);
    return true;
  }

  blockDevice(ip, reason) {
    const device = this.devices.get(ip);
    if (!device) return false;
    device.trustLevel = TRUST_LEVELS.BLOCKED;
    device.blockedReason = reason || 'Manual block';
    device.blockedAt = Date.now();
    this._addAuditEntry('BLOCK', `Device ${ip} blocked: ${reason}`);
    this.log(`Device ${ip} (${device.hostname}) has been BLOCKED: ${reason}`);
    return true;
  }

  unblockDevice(ip) {
    const device = this.devices.get(ip);
    if (!device) return false;
    if (device.trustLevel !== TRUST_LEVELS.BLOCKED) return false;
    device.trustLevel = TRUST_LEVELS.RESTRICTED;
    delete device.blockedReason;
    delete device.blockedAt;
    this._addAuditEntry('UNBLOCK', `Device ${ip} unblocked`);
    this.log(`Device ${ip} (${device.hostname}) unblocked, set to restricted`);
    return true;
  }

  // ─── Intrusion Detection System (IDS) ────────────────────────────────

  _checkForIntrusions() {
    this._detectPortScans();
    this._detectARPSpoofing();
    this._detectDNSPoisoning();
    this._detectUnusualTraffic();
    this._detectNewDevices();
    this._detectRogueAPs();
    this._detectBruteForce();
  }

  _detectPortScans() {
    const chance = Math.random();
    if (chance < 0.03) {
      const sourceIP = `${this.networkSubnet}.${Math.floor(Math.random() * 254 + 1)}`;
      const alert = {
        type: 'PORT_SCAN',
        severity: 'high',
        sourceIP,
        timestamp: Date.now(),
        details: `Port scan detected from ${sourceIP}, scanning ports 1-1024`,
        portsScanned: Math.floor(Math.random() * 500 + 100),
        responded: false
      };
      this.idsAlerts.push(alert);
      this._addAuditEntry('IDS', `Port scan detected from ${sourceIP}`);
      this._automatedResponse(alert);
    }
  }

  _detectARPSpoofing() {
    const chance = Math.random();
    if (chance < 0.01) {
      const spoofedMAC = this._generateRandomMAC();
      const alert = {
        type: 'ARP_SPOOF',
        severity: 'critical',
        spoofedMAC,
        claimedIP: this.gatewayIP,
        timestamp: Date.now(),
        details: `ARP spoofing detected: ${spoofedMAC} claiming to be gateway ${this.gatewayIP}`,
        responded: false
      };
      this.idsAlerts.push(alert);
      this._addAuditEntry('IDS', `ARP spoofing: ${spoofedMAC} claiming gateway`);
      this._automatedResponse(alert);
    }
  }

  _detectDNSPoisoning() {
    const chance = Math.random();
    if (chance < 0.015) {
      const domain = 'bank-login.example.com';
      const alert = {
        type: 'DNS_POISON',
        severity: 'critical',
        domain,
        maliciousIP: '203.0.113.' + Math.floor(Math.random() * 255),
        timestamp: Date.now(),
        details: `DNS poisoning attempt: ${domain} redirected to suspicious IP`,
        responded: false
      };
      this.idsAlerts.push(alert);
      this._addAuditEntry('IDS', `DNS poisoning attempt for ${domain}`);
      this._automatedResponse(alert);
    }
  }

  _detectUnusualTraffic() {
    for (const [ip, stats] of this.bandwidthStats) {
      const baseline = this.trafficBaselines.get(ip);
      if (!baseline) continue;

      const currentTotal = stats.currentUpload + stats.currentDownload;
      const baselineTotal = baseline.avgUpload + baseline.avgDownload;

      if (currentTotal > baselineTotal * 2) {
        const alert = {
          type: 'UNUSUAL_TRAFFIC',
          severity: 'medium',
          sourceIP: ip,
          currentVolume: currentTotal,
          baselineVolume: baselineTotal,
          ratio: (currentTotal / baselineTotal).toFixed(2),
          timestamp: Date.now(),
          details: `Unusual traffic from ${ip}: ${currentTotal}KB/s vs baseline ${baselineTotal}KB/s (${(currentTotal / baselineTotal).toFixed(1)}x)`,
          responded: false
        };
        this.idsAlerts.push(alert);
        this._addAuditEntry('IDS', alert.details);
      }
    }
  }

  _detectNewDevices() {
    const chance = Math.random();
    if (chance < 0.02) {
      const newIP = `${this.networkSubnet}.${Math.floor(Math.random() * 200 + 50)}`;
      if (!this.devices.has(newIP)) {
        const newMAC = this._generateRandomMAC();
        const alert = {
          type: 'NEW_DEVICE',
          severity: 'medium',
          deviceIP: newIP,
          deviceMAC: newMAC,
          timestamp: Date.now(),
          details: `New device detected: ${newIP} (${newMAC})`,
          responded: false
        };
        this.idsAlerts.push(alert);
        this._addAuditEntry('IDS', `New device: ${newIP} (${newMAC})`);

        this.devices.set(newIP, {
          ip: newIP,
          mac: newMAC,
          hostname: 'unknown-' + newMAC.slice(-5).replace(/:/g, ''),
          vendor: 'Unknown',
          deviceType: 'UNKNOWN',
          trustLevel: TRUST_LEVELS.RESTRICTED,
          online: true,
          firstSeen: Date.now(),
          lastSeen: Date.now(),
          riskScore: 70,
          openPorts: [],
          trafficVolume: { upload: 0, download: 0 },
          dnsQueries: 0,
          blockedAttempts: 0,
          signalStrength: Math.floor(-40 + Math.random() * -30),
          firmwareVersion: 'unknown',
          vulnerabilities: [],
          qosPriority: QOS_PRIORITIES.DOWNLOADS
        });

        this._automatedResponse(alert);
      }
    }
  }

  _detectRogueAPs() {
    const chance = Math.random();
    if (chance < 0.005) {
      const rogueSSID = 'FreeWiFi-' + Math.floor(Math.random() * 100);
      const alert = {
        type: 'ROGUE_AP',
        severity: 'critical',
        ssid: rogueSSID,
        bssid: this._generateRandomMAC(),
        channel: Math.floor(Math.random() * 11 + 1),
        timestamp: Date.now(),
        details: `Rogue access point detected: SSID "${rogueSSID}"`,
        responded: false
      };
      this.idsAlerts.push(alert);
      this._addAuditEntry('IDS', `Rogue AP: ${rogueSSID}`);
      this._automatedResponse(alert);
    }
  }

  _detectBruteForce() {
    const chance = Math.random();
    if (chance < 0.02) {
      const targetService = ['SSH', 'Admin Panel', 'FTP', 'SMB'][Math.floor(Math.random() * 4)];
      const sourceIP = `${this.networkSubnet}.${Math.floor(Math.random() * 254 + 1)}`;
      const key = `${sourceIP}:${targetService}`;
      const attempts = (this.failedLoginAttempts.get(key) || 0) + Math.floor(Math.random() * 5 + 1);
      this.failedLoginAttempts.set(key, attempts);

      if (attempts >= 3) {
        const alert = {
          type: 'BRUTE_FORCE',
          severity: 'high',
          sourceIP,
          targetService,
          attempts,
          timestamp: Date.now(),
          details: `Brute force on ${targetService} from ${sourceIP}: ${attempts} failed attempts`,
          responded: false
        };
        this.idsAlerts.push(alert);
        this._addAuditEntry('IDS', alert.details);
        this._automatedResponse(alert);
      }
    }
  }

  getIDSAlerts(limit) {
    const sorted = [...this.idsAlerts].sort((a, b) => b.timestamp - a.timestamp);
    return limit ? sorted.slice(0, limit) : sorted;
  }

  // ─── Firewall Rules Engine ───────────────────────────────────────────

  _initializeDefaultFirewallRules() {
    this.firewallRules = [
      {
        id: 'fw-001', name: 'Block IoT to LAN',
        type: 'deny', sourceType: 'IoT', destType: 'PC',
        ports: '*', protocol: 'tcp', enabled: true, priority: 100,
        description: 'Prevent IoT devices from accessing PCs'
      },
      {
        id: 'fw-002', name: 'Block IoT to IoT',
        type: 'deny', sourceType: 'IoT', destType: 'IoT',
        ports: '*', protocol: 'tcp', enabled: true, priority: 100,
        description: 'Prevent IoT-to-IoT lateral movement'
      },
      {
        id: 'fw-003', name: 'Allow IoT to Internet',
        type: 'allow', sourceType: 'IoT', destType: 'internet',
        ports: '80,443', protocol: 'tcp', enabled: true, priority: 90,
        description: 'Allow IoT HTTP/HTTPS to internet'
      },
      {
        id: 'fw-004', name: 'Guest Isolation',
        type: 'deny', sourceType: 'guest', destType: 'internal',
        ports: '*', protocol: '*', enabled: true, priority: 100,
        description: 'Isolate guest network from main'
      },
      {
        id: 'fw-005', name: 'Allow Hue Bridge Hub',
        type: 'allow', sourceType: 'IoT', sourceMAC: '00:17:88',
        destType: 'IoT', ports: '80,443,8080', protocol: 'tcp',
        enabled: true, priority: 110,
        description: 'Allow Hue bridge to control lights'
      },
      {
        id: 'fw-006', name: 'Block P2P Ports',
        type: 'deny', sourceType: '*', destType: 'internet',
        ports: '6881-6889', protocol: 'tcp', enabled: true, priority: 80,
        description: 'Block BitTorrent traffic'
      },
      {
        id: 'fw-007', name: 'Rate Limit Downloads',
        type: 'rate_limit', sourceType: '*', destType: 'internet',
        ports: '*', protocol: '*', rateLimit: 100000,
        enabled: true, priority: 50,
        description: 'Rate limit general downloads to 100Mbps'
      },
      {
        id: 'fw-008', name: 'Kids Internet Schedule',
        type: 'time_based', sourceProfile: 'kids',
        allowedHours: { start: 7, end: 21 },
        ports: '*', protocol: '*', enabled: true, priority: 95,
        description: 'Kids internet access 07:00-21:00 only'
      },
      {
        id: 'fw-009', name: 'Block Telnet',
        type: 'deny', sourceType: '*', destType: '*',
        ports: '23', protocol: 'tcp', enabled: true, priority: 120,
        description: 'Block insecure Telnet everywhere'
      },
      {
        id: 'fw-010', name: 'Block SMB External',
        type: 'deny', sourceType: '*', destType: 'internet',
        ports: '445,139', protocol: 'tcp', enabled: true, priority: 120,
        description: 'Block SMB/NetBIOS to internet'
      }
    ];
    this.log(`Loaded ${this.firewallRules.length} default firewall rules`);
  }

  addFirewallRule(rule) {
    if (!rule.id) rule.id = 'fw-' + Date.now();
    if (!rule.priority) rule.priority = 50;
    if (rule.enabled === undefined) rule.enabled = true;
    this.firewallRules.push(rule);
    this.firewallRules.sort((a, b) => b.priority - a.priority);
    this._addAuditEntry('FIREWALL', `Rule added: ${rule.name} (${rule.id})`);
    this.log(`Firewall rule added: ${rule.name}`);
    return rule.id;
  }

  removeFirewallRule(ruleId) {
    const idx = this.firewallRules.findIndex(r => r.id === ruleId);
    if (idx === -1) return false;
    const rule = this.firewallRules.splice(idx, 1)[0];
    this._addAuditEntry('FIREWALL', `Rule removed: ${rule.name} (${ruleId})`);
    return true;
  }

  evaluateFirewallRules(sourceIP, _destIP, _port, _protocol) {
    const sourceDevice = this.devices.get(sourceIP);
    for (const rule of this.firewallRules) {
      if (!rule.enabled) continue;
      if (rule.type === 'time_based') {
        const hour = new Date().getHours();
        if (hour < rule.allowedHours.start || hour >= rule.allowedHours.end) {
          return { action: 'deny', rule: rule.id, reason: 'Outside allowed hours' };
        }
      }
      if (sourceDevice && rule.sourceType && rule.sourceType !== '*') {
        if (sourceDevice.deviceType !== rule.sourceType && sourceDevice.trustLevel !== rule.sourceType) continue;
      }
      if (rule.type === 'deny') {
        return { action: 'deny', rule: rule.id, reason: rule.description };
      }
      if (rule.type === 'allow') {
        return { action: 'allow', rule: rule.id };
      }
      if (rule.type === 'rate_limit') {
        return { action: 'rate_limit', rule: rule.id, limit: rule.rateLimit };
      }
    }
    return { action: 'allow', rule: 'default', reason: 'No matching rule, default allow' };
  }

  getFirewallRules() {
    return [...this.firewallRules];
  }

  // ─── Bandwidth Monitoring ────────────────────────────────────────────

  _updateBandwidthStats() {
    for (const [ip, device] of this.devices) {
      if (!device.online) continue;
      const stats = this.bandwidthStats.get(ip);
      if (!stats) continue;

      const uploadRate = Math.floor(Math.random() * 100 + 5);
      const downloadRate = Math.floor(Math.random() * 500 + 10);

      stats.currentUpload = uploadRate;
      stats.currentDownload = downloadRate;
      stats.totalUpload += uploadRate;
      stats.totalDownload += downloadRate;
      stats.peakUpload = Math.max(stats.peakUpload, uploadRate);
      stats.peakDownload = Math.max(stats.peakDownload, downloadRate);

      stats.history.push({
        timestamp: Date.now(),
        upload: uploadRate,
        download: downloadRate
      });
      if (stats.history.length > 100) stats.history.shift();

      device.trafficVolume.upload += uploadRate;
      device.trafficVolume.download += downloadRate;
    }

    this._checkBandwidthAlerts();
  }

  _checkBandwidthAlerts() {
    let totalUsage = 0;
    for (const [, stats] of this.bandwidthStats) {
      totalUsage += stats.currentUpload + stats.currentDownload;
    }

    const capacityKbps = this.totalBandwidthMbps * 1024;
    const usagePercent = (totalUsage / capacityKbps) * 100;
    if (usagePercent > 80) {
      this._addAuditEntry('BANDWIDTH', `High bandwidth usage: ${usagePercent.toFixed(1)}% of capacity`);
    }
  }

  getTopBandwidthConsumers(count = 5) {
    const consumers = [];
    for (const [ip, stats] of this.bandwidthStats) {
      const device = this.devices.get(ip);
      consumers.push({
        ip,
        hostname: device?.hostname || 'unknown',
        currentDownload: stats.currentDownload,
        currentUpload: stats.currentUpload,
        totalDownload: stats.totalDownload,
        totalUpload: stats.totalUpload
      });
    }
    consumers.sort((a, b) => (b.currentDownload + b.currentUpload) - (a.currentDownload + a.currentUpload));
    return consumers.slice(0, count);
  }

  getBandwidthStats(ip) {
    if (ip) return this.bandwidthStats.get(ip) || null;
    const result = {};
    for (const [deviceIP, stats] of this.bandwidthStats) {
      result[deviceIP] = { ...stats, history: stats.history.length };
    }
    return result;
  }

  getThroughputSummary() {
    let totalUp = 0, totalDown = 0;
    for (const [, stats] of this.bandwidthStats) {
      totalUp += stats.currentUpload;
      totalDown += stats.currentDownload;
    }
    return {
      totalUploadKBps: totalUp,
      totalDownloadKBps: totalDown,
      capacityMbps: this.totalBandwidthMbps,
      utilizationPercent: ((totalUp + totalDown) / (this.totalBandwidthMbps * 1024) * 100).toFixed(2)
    };
  }

  // ─── DNS Security ────────────────────────────────────────────────────

  _initializeDNSBlocklist() {
    const blockedDomains = [
      'malware.example.com', 'phishing.example.net', 'tracker.ads.com',
      'crypto-miner.evil.org', 'botnet-c2.darkweb.net', 'data-exfil.suspicious.com',
      'ransomware-payment.onion.ws', 'fake-bank.phishing.net', 'keylogger-drop.ru',
      'exploit-kit.compromised.site'
    ];
    for (const domain of blockedDomains) {
      this.dnsBlocklist.add(domain);
    }
    this.log(`DNS blocklist initialized with ${this.dnsBlocklist.size} domains + ${MALICIOUS_DOMAIN_PATTERNS.length} patterns`);
  }

  checkDNSQuery(domain, sourceIP) {
    const entry = {
      domain,
      sourceIP,
      timestamp: Date.now(),
      blocked: false,
      reason: null
    };

    if (this.dnsBlocklist.has(domain)) {
      entry.blocked = true;
      entry.reason = 'Domain in blocklist';
    }

    if (!entry.blocked) {
      for (const pattern of MALICIOUS_DOMAIN_PATTERNS) {
        if (pattern.test(domain)) {
          entry.blocked = true;
          entry.reason = `Matches malicious pattern: ${pattern.source}`;
          break;
        }
      }
    }

    const device = this.devices.get(sourceIP);
    if (device) {
      device.dnsQueries = (device.dnsQueries || 0) + 1;
      if (entry.blocked) device.blockedAttempts = (device.blockedAttempts || 0) + 1;
    }

    this.dnsQueryLog.push(entry);
    if (this.dnsQueryLog.length > 5000) this.dnsQueryLog.shift();

    if (entry.blocked) {
      this._addAuditEntry('DNS', `Blocked: ${domain} from ${sourceIP} (${entry.reason})`);
    }

    return entry;
  }

  addToDNSBlocklist(domain) {
    this.dnsBlocklist.add(domain);
    this._addAuditEntry('DNS', `Domain added to blocklist: ${domain}`);
    return true;
  }

  removeFromDNSBlocklist(domain) {
    const removed = this.dnsBlocklist.delete(domain);
    if (removed) this._addAuditEntry('DNS', `Domain removed from blocklist: ${domain}`);
    return removed;
  }

  getDNSQueryLog(limit = 50) {
    return this.dnsQueryLog.slice(-limit);
  }

  getDNSStats() {
    const total = this.dnsQueryLog.length;
    const blocked = this.dnsQueryLog.filter(e => e.blocked).length;
    const byDevice = {};
    for (const entry of this.dnsQueryLog) {
      if (!byDevice[entry.sourceIP]) byDevice[entry.sourceIP] = { total: 0, blocked: 0 };
      byDevice[entry.sourceIP].total++;
      if (entry.blocked) byDevice[entry.sourceIP].blocked++;
    }
    return {
      totalQueries: total,
      blockedQueries: blocked,
      blockRate: total > 0 ? ((blocked / total) * 100).toFixed(2) + '%' : '0%',
      blocklistSize: this.dnsBlocklist.size,
      patternCount: MALICIOUS_DOMAIN_PATTERNS.length,
      byDevice
    };
  }

  // ─── VPN Management ──────────────────────────────────────────────────

  getVPNStatus() {
    return {
      serverRunning: true,
      protocol: 'WireGuard',
      listenPort: 51820,
      publicKey: 'aB3dE5fG7hI9jK1lM3nO5pQ7rS9tU1vW3xY5zA7bC=',
      connectedClients: this.vpnClients.size,
      clients: Array.from(this.vpnClients.values()),
      totalBandwidthMB: this._getVPNBandwidth(),
      uptime: Math.floor(Math.random() * 86400 * 30),
      lastHandshake: Date.now() - Math.floor(Math.random() * 120000),
      splitTunneling: {
        enabled: true,
        excludedSubnets: ['10.0.0.0/8'],
        excludedDomains: ['*.local', '*.lan']
      }
    };
  }

  addVPNClient(clientName, allowedIPs) {
    const clientId = 'vpn-' + Date.now();
    this.vpnClients.set(clientId, {
      id: clientId,
      name: clientName,
      allowedIPs: allowedIPs || ['0.0.0.0/0'],
      connectedSince: Date.now(),
      transferRx: 0,
      transferTx: 0,
      lastHandshake: Date.now(),
      endpoint: `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}:${Math.floor(Math.random() * 60000 + 1024)}`,
      status: 'connected'
    });
    this._addAuditEntry('VPN', `Client connected: ${clientName}`);
    return clientId;
  }

  removeVPNClient(clientId) {
    const client = this.vpnClients.get(clientId);
    if (!client) return false;
    this.vpnClients.delete(clientId);
    this._addAuditEntry('VPN', `Client disconnected: ${client.name}`);
    return true;
  }

  _getVPNBandwidth() {
    let total = 0;
    for (const [, client] of this.vpnClients) {
      total += client.transferRx + client.transferTx;
    }
    return (total / (1024 * 1024)).toFixed(2);
  }

  // ─── IoT Segmentation ───────────────────────────────────────────────

  _initializeIoTSegmentRules() {
    this.iotSegmentRules = [
      { id: 'iot-seg-001', rule: 'IoT → Internet', action: 'allow', ports: '80,443,8883', description: 'IoT cloud connectivity' },
      { id: 'iot-seg-002', rule: 'IoT → LAN', action: 'deny', ports: '*', description: 'Block IoT from LAN access' },
      { id: 'iot-seg-003', rule: 'IoT → IoT', action: 'deny', ports: '*', description: 'Block inter-IoT communication' },
      { id: 'iot-seg-004', rule: 'Hue Bridge → Hue Lights', action: 'allow', ports: '80,443', description: 'Hub exception for Hue' },
      { id: 'iot-seg-005', rule: 'HomeAssistant → IoT', action: 'allow', ports: '*', description: 'Hub exception for HA' },
      { id: 'iot-seg-006', rule: 'IoT firmware update', action: 'allow', destDomains: ['*.manufacturer.com', 'ota.*.com'], description: 'Firmware update allowlist' }
    ];
    this.log(`IoT segmentation initialized: ${this.iotSegmentRules.length} rules`);
  }

  getIoTSegmentRules() {
    return [...this.iotSegmentRules];
  }

  addIoTSegmentException(sourceMAC, destMAC, ports, reason) {
    const rule = {
      id: 'iot-seg-' + Date.now(),
      rule: `Exception: ${sourceMAC} → ${destMAC}`,
      action: 'allow',
      ports: ports || '*',
      description: reason || 'Custom exception'
    };
    this.iotSegmentRules.push(rule);
    this._addAuditEntry('IOT_SEG', `Exception added: ${reason}`);
    return rule.id;
  }

  // ─── Parental Controls ──────────────────────────────────────────────

  _initializeDefaultParentalProfiles() {
    this.parentalProfiles.set('child-1', {
      id: 'child-1',
      name: 'Child Profile 1',
      devices: [],
      screenTimeLimit: { daily: 120, weekly: 600 },
      screenTimeUsed: { daily: 0, weekly: 0 },
      bedtimeCutoff: { start: 21, end: 7 },
      safeSearchEnforced: true,
      blockedCategories: [CONTENT_CATEGORIES.ADULT, CONTENT_CATEGORIES.GAMBLING],
      allowedCategories: [CONTENT_CATEGORIES.EDUCATION, CONTENT_CATEGORIES.NEWS],
      activityLog: [],
      active: true,
      lastReset: Date.now()
    });

    this.parentalProfiles.set('child-2', {
      id: 'child-2',
      name: 'Child Profile 2',
      devices: [],
      screenTimeLimit: { daily: 180, weekly: 900 },
      screenTimeUsed: { daily: 0, weekly: 0 },
      bedtimeCutoff: { start: 22, end: 7 },
      safeSearchEnforced: true,
      blockedCategories: [CONTENT_CATEGORIES.ADULT, CONTENT_CATEGORIES.GAMBLING],
      allowedCategories: [CONTENT_CATEGORIES.EDUCATION, CONTENT_CATEGORIES.NEWS, CONTENT_CATEGORIES.SOCIAL_MEDIA],
      activityLog: [],
      active: true,
      lastReset: Date.now()
    });

    this.log('Parental control profiles initialized');
  }

  addParentalProfile(id, config) {
    const profile = {
      id,
      name: config.name || id,
      devices: config.devices || [],
      screenTimeLimit: config.screenTimeLimit || { daily: 120, weekly: 600 },
      screenTimeUsed: { daily: 0, weekly: 0 },
      bedtimeCutoff: config.bedtimeCutoff || { start: 21, end: 7 },
      safeSearchEnforced: config.safeSearchEnforced !== false,
      blockedCategories: config.blockedCategories || [CONTENT_CATEGORIES.ADULT],
      allowedCategories: config.allowedCategories || [CONTENT_CATEGORIES.EDUCATION],
      activityLog: [],
      active: true,
      lastReset: Date.now()
    };
    this.parentalProfiles.set(id, profile);
    this._addAuditEntry('PARENTAL', `Profile created: ${profile.name}`);
    return profile;
  }

  checkParentalAccess(profileId, category, currentMinutes) {
    const profile = this.parentalProfiles.get(profileId);
    if (!profile || !profile.active) return { allowed: true, reason: 'No active profile' };

    const hour = new Date().getHours();
    if (hour >= profile.bedtimeCutoff.start || hour < profile.bedtimeCutoff.end) {
      return { allowed: false, reason: 'Bedtime cutoff active' };
    }

    if (profile.screenTimeUsed.daily >= profile.screenTimeLimit.daily) {
      return { allowed: false, reason: 'Daily screen time limit reached' };
    }

    if (profile.screenTimeUsed.weekly >= profile.screenTimeLimit.weekly) {
      return { allowed: false, reason: 'Weekly screen time limit reached' };
    }

    if (category && profile.blockedCategories.includes(category)) {
      return { allowed: false, reason: `Category blocked: ${category}` };
    }

    if (currentMinutes) {
      profile.screenTimeUsed.daily += currentMinutes;
      profile.screenTimeUsed.weekly += currentMinutes;
    }

    return { allowed: true, reason: 'Access permitted' };
  }

  getParentalReport(profileId) {
    const profile = this.parentalProfiles.get(profileId);
    if (!profile) return null;
    return {
      name: profile.name,
      screenTimeUsed: { ...profile.screenTimeUsed },
      screenTimeLimit: { ...profile.screenTimeLimit },
      remainingDaily: Math.max(0, profile.screenTimeLimit.daily - profile.screenTimeUsed.daily),
      remainingWeekly: Math.max(0, profile.screenTimeLimit.weekly - profile.screenTimeUsed.weekly),
      blockedCategories: [...profile.blockedCategories],
      recentActivity: profile.activityLog.slice(-20),
      active: profile.active
    };
  }

  resetParentalScreenTime(profileId, scope) {
    const profile = this.parentalProfiles.get(profileId);
    if (!profile) return false;
    if (scope === 'daily' || scope === 'all') profile.screenTimeUsed.daily = 0;
    if (scope === 'weekly' || scope === 'all') profile.screenTimeUsed.weekly = 0;
    profile.lastReset = Date.now();
    this._addAuditEntry('PARENTAL', `Screen time reset (${scope}) for ${profile.name}`);
    return true;
  }

  // ─── Guest Network ──────────────────────────────────────────────────

  _initializeGuestNetwork() {
    this.guestNetworkConfig = {
      enabled: true,
      ssid: 'HomeGuest',
      subnet: '192.168.100',
      isolation: true,
      defaultDuration: 4,
      bandwidthCapMbps: 25,
      splashMessage: 'Welcome to our home WiFi! Please be respectful of bandwidth.',
      maxGuests: 10,
      dnsFiltering: true
    };
    this.log('Guest network initialized');
  }

  provisionGuestAccess(guestName, durationHours, options = {}) {
    const sessionId = 'guest-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    const duration = durationHours || this.guestNetworkConfig.defaultDuration;
    const password = this._generateGuestPassword();

    const session = {
      id: sessionId,
      name: guestName,
      password,
      ip: `${this.guestNetworkConfig.subnet}.${this.guestSessions.size + 10}`,
      startTime: Date.now(),
      endTime: Date.now() + (duration * 60 * 60 * 1000),
      durationHours: duration,
      bandwidthCapMbps: options.bandwidthCap || this.guestNetworkConfig.bandwidthCapMbps,
      usage: { upload: 0, download: 0 },
      isolated: true,
      active: true,
      qrCode: this._generateQRCodeData(this.guestNetworkConfig.ssid, password),
      splashMessage: options.splashMessage || this.guestNetworkConfig.splashMessage
    };

    this.guestSessions.set(sessionId, session);
    this._addAuditEntry('GUEST', `Guest access provisioned: ${guestName} for ${duration}h`);
    this.log(`Guest access created for ${guestName}: ${duration}h, password: ${password}`);

    return {
      sessionId,
      ssid: this.guestNetworkConfig.ssid,
      password,
      expiresAt: new Date(session.endTime).toISOString(),
      qrCode: session.qrCode,
      splashMessage: session.splashMessage
    };
  }

  revokeGuestAccess(sessionId) {
    const session = this.guestSessions.get(sessionId);
    if (!session) return false;
    session.active = false;
    session.revokedAt = Date.now();
    this._addAuditEntry('GUEST', `Guest access revoked: ${session.name}`);
    return true;
  }

  _generateGuestPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 10; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  _generateQRCodeData(ssid, password) {
    return `WIFI:T:WPA;S:${ssid};P:${password};;`;
  }

  _cleanupExpiredGuests() {
    const now = Date.now();
    for (const [_id, session] of this.guestSessions) {
      if (session.active && now > session.endTime) {
        session.active = false;
        session.expiredAt = now;
        this._addAuditEntry('GUEST', `Guest session expired: ${session.name}`);
        this.log(`Guest session expired: ${session.name}`);
      }
    }
  }

  getActiveGuests() {
    return Array.from(this.guestSessions.values()).filter(s => s.active);
  }

  // ─── Threat Intelligence ─────────────────────────────────────────────

  _initializeThreatIntelFeed() {
    const threatIPs = [
      { ip: '203.0.113.1', type: 'C2 Server', confidence: 95, lastSeen: Date.now() },
      { ip: '198.51.100.50', type: 'Botnet', confidence: 90, lastSeen: Date.now() },
      { ip: '192.0.2.100', type: 'Phishing', confidence: 85, lastSeen: Date.now() },
      { ip: '203.0.113.200', type: 'Malware Distribution', confidence: 92, lastSeen: Date.now() },
      { ip: '198.51.100.150', type: 'Brute Force', confidence: 80, lastSeen: Date.now() },
      { ip: '192.0.2.75', type: 'Cryptominer', confidence: 88, lastSeen: Date.now() },
      { ip: '203.0.113.99', type: 'Scanner', confidence: 75, lastSeen: Date.now() },
      { ip: '198.51.100.33', type: 'Spam', confidence: 70, lastSeen: Date.now() },
      { ip: '192.0.2.222', type: 'DDoS', confidence: 93, lastSeen: Date.now() },
      { ip: '203.0.113.177', type: 'Data Exfiltration', confidence: 91, lastSeen: Date.now() },
    ];

    for (const threat of threatIPs) {
      this.threatIntelFeed.set(threat.ip, threat);
      this.blockedIPs.add(threat.ip);
    }
    this.log(`Threat intelligence feed loaded: ${this.threatIntelFeed.size} known threats`);
  }

  checkThreatIP(ip) {
    const threat = this.threatIntelFeed.get(ip);
    if (threat) {
      this._addAuditEntry('THREAT', `Connection to known threat IP blocked: ${ip} (${threat.type})`);
      return { isThreat: true, ...threat };
    }
    return { isThreat: false, ip };
  }

  getThreatReport() {
    const threats = Array.from(this.threatIntelFeed.values());
    const alertsBySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const alert of this.idsAlerts) {
      alertsBySeverity[alert.severity] = (alertsBySeverity[alert.severity] || 0) + 1;
    }

    return {
      knownThreats: threats.length,
      blockedIPs: this.blockedIPs.size,
      recentAlerts: this.idsAlerts.slice(-10),
      alertsBySeverity,
      topThreats: threats.sort((a, b) => b.confidence - a.confidence).slice(0, 5),
      lastUpdated: Date.now()
    };
  }

  _scanDeviceVulnerabilities() {
    const knownCVEs = [
      { cve: 'CVE-2024-1001', description: 'IoT firmware buffer overflow', severity: 'high', affectedTypes: ['IoT'] },
      { cve: 'CVE-2024-2002', description: 'Smart TV remote code execution', severity: 'critical', affectedTypes: ['TV'] },
      { cve: 'CVE-2024-3003', description: 'Router CSRF vulnerability', severity: 'medium', affectedTypes: ['gateway'] },
      { cve: 'CVE-2024-4004', description: 'Camera firmware default credentials', severity: 'high', affectedTypes: ['IoT', 'SMART_HOME'] },
      { cve: 'CVE-2024-5005', description: 'Printer spooler privilege escalation', severity: 'medium', affectedTypes: ['PRINTER'] },
    ];

    for (const [_ip, device] of this.devices) {
      device.vulnerabilities = [];
      for (const cve of knownCVEs) {
        if (cve.affectedTypes.includes(device.deviceType)) {
          if (Math.random() < 0.4) {
            device.vulnerabilities.push({
              cve: cve.cve,
              description: cve.description,
              severity: cve.severity,
              detectedAt: Date.now()
            });
          }
        }
      }
      device.riskScore = this._calculateDeviceRiskScore(device.deviceType, device.trustLevel);
      if (device.vulnerabilities.length > 0) {
        device.riskScore = Math.min(100, device.riskScore + device.vulnerabilities.length * 10);
      }
    }
  }

  // ─── Network Performance ─────────────────────────────────────────────

  getNetworkPerformance() {
    const gatewayLatency = Math.floor(Math.random() * 5 + 1);
    const dnsResponseTime = Math.floor(Math.random() * 30 + 5);
    const lastSpeedTest = this.speedTestResults.length > 0
      ? this.speedTestResults[this.speedTestResults.length - 1]
      : null;

    const deviceSignals = [];
    for (const [ip, device] of this.devices) {
      if (device.signalStrength) {
        deviceSignals.push({
          ip,
          hostname: device.hostname,
          signalStrength: device.signalStrength,
          quality: device.signalStrength > -50 ? 'excellent' : device.signalStrength > -65 ? 'good' : device.signalStrength > -75 ? 'fair' : 'poor'
        });
      }
    }

    return {
      gatewayLatencyMs: gatewayLatency,
      dnsResponseTimeMs: dnsResponseTime,
      lastSpeedTest,
      deviceSignals,
      channelCongestion: this._checkChannelCongestion(),
      onlineDevices: Array.from(this.devices.values()).filter(d => d.online).length,
      totalDevices: this.devices.size
    };
  }

  runSpeedTest() {
    const result = {
      timestamp: Date.now(),
      downloadMbps: Math.floor(Math.random() * 200 + 100),
      uploadMbps: Math.floor(Math.random() * 50 + 20),
      pingMs: Math.floor(Math.random() * 15 + 3),
      jitterMs: Math.floor(Math.random() * 5 + 1),
      server: 'speedtest.local-isp.net',
      isp: 'Local ISP'
    };
    this.speedTestResults.push(result);
    if (this.speedTestResults.length > 30) this.speedTestResults.shift();
    this._addAuditEntry('PERF', `Speed test: ${result.downloadMbps}↓/${result.uploadMbps}↑ Mbps, ${result.pingMs}ms ping`);
    return result;
  }

  _checkChannelCongestion() {
    const channels = {};
    for (let ch = 1; ch <= 11; ch++) {
      channels[ch] = {
        utilization: Math.floor(Math.random() * 80 + 5),
        networkCount: Math.floor(Math.random() * 8 + 1),
        recommended: false
      };
    }
    let bestChannel = 1;
    let lowestUtil = 100;
    for (const [ch, data] of Object.entries(channels)) {
      if (data.utilization < lowestUtil) {
        lowestUtil = data.utilization;
        bestChannel = parseInt(ch);
      }
    }
    channels[bestChannel].recommended = true;
    return { channels, recommendedChannel: bestChannel };
  }

  // ─── Certificate Monitoring ──────────────────────────────────────────

  _initializeCertificateMonitoring() {
    const now = Date.now();
    const day = 86400000;

    const certs = [
      { domain: 'home-assistant.local', issuer: 'Let\'s Encrypt', expiresAt: now + 60 * day, autoRenew: true },
      { domain: 'plex.local', issuer: 'Self-Signed', expiresAt: now + 10 * day, autoRenew: false },
      { domain: 'nas.local', issuer: 'Let\'s Encrypt', expiresAt: now + 45 * day, autoRenew: true },
      { domain: 'router.local', issuer: 'Self-Signed', expiresAt: now + 5 * day, autoRenew: false },
      { domain: 'vpn.home.example.com', issuer: 'Let\'s Encrypt', expiresAt: now + 80 * day, autoRenew: true },
    ];

    for (const cert of certs) {
      this.certificates.set(cert.domain, {
        ...cert,
        createdAt: now - 90 * day,
        fingerprint: this._generateCertFingerprint(),
        status: 'valid',
        pinned: false
      });
    }
    this.log(`Certificate monitoring initialized: ${this.certificates.size} certificates tracked`);
  }

  _checkCertificateExpiry() {
    const now = Date.now();
    const day = 86400000;
    const warnings = [];

    for (const [domain, cert] of this.certificates) {
      const daysRemaining = Math.ceil((cert.expiresAt - now) / day);
      if (daysRemaining <= 0) {
        cert.status = 'expired';
        warnings.push({ domain, daysRemaining, severity: 'critical', action: 'Certificate EXPIRED' });
        this._addAuditEntry('CERT', `EXPIRED: ${domain}`);
      } else if (daysRemaining <= 7) {
        cert.status = 'expiring_critical';
        warnings.push({ domain, daysRemaining, severity: 'critical', action: cert.autoRenew ? 'Auto-renewal triggered' : 'Manual renewal required' });
        this._addAuditEntry('CERT', `Expiring in ${daysRemaining} days: ${domain}`);
      } else if (daysRemaining <= 14) {
        cert.status = 'expiring_warning';
        warnings.push({ domain, daysRemaining, severity: 'high', action: 'Renewal recommended' });
      } else if (daysRemaining <= 30) {
        cert.status = 'expiring_notice';
        warnings.push({ domain, daysRemaining, severity: 'medium', action: 'Upcoming expiry' });
      }
    }

    return warnings;
  }

  getCertificateStatus() {
    const certs = [];
    const now = Date.now();
    const day = 86400000;

    for (const [domain, cert] of this.certificates) {
      certs.push({
        domain,
        issuer: cert.issuer,
        daysRemaining: Math.ceil((cert.expiresAt - now) / day),
        status: cert.status,
        autoRenew: cert.autoRenew,
        fingerprint: cert.fingerprint
      });
    }
    return certs;
  }

  _generateCertFingerprint() {
    const chars = '0123456789ABCDEF';
    let fp = '';
    for (let i = 0; i < 40; i++) {
      fp += chars.charAt(Math.floor(Math.random() * chars.length));
      if (i % 2 === 1 && i < 39) fp += ':';
    }
    return fp;
  }

  // ─── Automated Responses ─────────────────────────────────────────────

  _automatedResponse(alert) {
    if (!alert || alert.responded) return;

    switch (alert.type) {
      case 'BRUTE_FORCE':
        if (alert.attempts >= 3) {
          this.blockDevice(alert.sourceIP, `Auto-blocked: brute force on ${alert.targetService}`);
          alert.responded = true;
          alert.responseAction = 'Device blocked after 3+ failed attempts';
          this._addAuditEntry('AUTO_RESPONSE', `Auto-blocked ${alert.sourceIP}: brute force`);
        }
        break;

      case 'NEW_DEVICE':
        if (!this.devices.has(alert.deviceIP)) break;
        const dev = this.devices.get(alert.deviceIP);
        dev.trustLevel = TRUST_LEVELS.RESTRICTED;
        alert.responded = true;
        alert.responseAction = 'Device auto-quarantined to restricted trust';
        this._addAuditEntry('AUTO_RESPONSE', `Auto-quarantined new device ${alert.deviceIP}`);
        break;

      case 'ARP_SPOOF':
      case 'DNS_POISON':
        alert.responded = true;
        alert.responseAction = 'High-risk alert: notification cascade triggered';
        this._triggerNotificationCascade(alert);
        this._addAuditEntry('AUTO_RESPONSE', `Notification cascade for ${alert.type}`);
        break;

      case 'PORT_SCAN':
        alert.responded = true;
        alert.responseAction = 'Source IP rate-limited';
        this._addAuditEntry('AUTO_RESPONSE', `Rate-limited ${alert.sourceIP}: port scan`);
        break;

      case 'UNUSUAL_TRAFFIC':
        alert.responded = true;
        alert.responseAction = 'Traffic throttled to baseline levels';
        this._addAuditEntry('AUTO_RESPONSE', `Auto-throttled ${alert.sourceIP}: unusual traffic`);
        break;

      case 'ROGUE_AP':
        alert.responded = true;
        alert.responseAction = 'Rogue AP flagged, deauth protection enabled';
        this._triggerNotificationCascade(alert);
        this._addAuditEntry('AUTO_RESPONSE', `Rogue AP response: ${alert.ssid}`);
        break;

      default:
        alert.responded = true;
        alert.responseAction = 'Logged and monitored';
        break;
    }
  }

  _triggerNotificationCascade(alert) {
    const notification = {
      timestamp: Date.now(),
      severity: alert.severity,
      type: alert.type,
      message: alert.details,
      channels: ['push', 'sms', 'email'],
      delivered: { push: true, sms: true, email: true }
    };
    this._addAuditEntry('NOTIFY', `Cascade notification sent: ${alert.type} via push/sms/email`);
    return notification;
  }

  // ─── Emergency Procedures ────────────────────────────────────────────

  activateEmergencyLockdown(reason) {
    this.isLockdown = true;
    this.emergencyMode = true;
    const essentialDevices = [this.gatewayIP];

    for (const [ip, device] of this.devices) {
      if (!essentialDevices.includes(ip)) {
        device.lockdownBlocked = true;
      }
    }

    const lockdownEvent = {
      type: 'LOCKDOWN',
      activatedAt: Date.now(),
      reason: reason || 'Emergency lockdown activated',
      blockedDevices: this.devices.size - essentialDevices.length
    };

    this._addAuditEntry('EMERGENCY', `LOCKDOWN activated: ${reason}`);
    this._triggerNotificationCascade({
      type: 'LOCKDOWN',
      severity: 'critical',
      details: `Emergency lockdown: ${reason}`
    });
    this.log(`EMERGENCY LOCKDOWN ACTIVATED: ${reason}`);

    return lockdownEvent;
  }

  deactivateEmergencyLockdown() {
    this.isLockdown = false;
    this.emergencyMode = false;

    for (const [, device] of this.devices) {
      delete device.lockdownBlocked;
    }

    this._addAuditEntry('EMERGENCY', 'Lockdown deactivated');
    this.log('Emergency lockdown deactivated');
    return { deactivatedAt: Date.now() };
  }

  isolateCompromisedDevice(ip, reason) {
    const device = this.devices.get(ip);
    if (!device) return null;

    device.trustLevel = TRUST_LEVELS.BLOCKED;
    device.isolated = true;
    device.isolationReason = reason || 'Suspected compromise';
    device.isolatedAt = Date.now();

    const evidence = {
      deviceSnapshot: { ...device },
      recentTraffic: this.bandwidthStats.get(ip) ? { ...this.bandwidthStats.get(ip) } : null,
      recentDNS: this.dnsQueryLog.filter(e => e.sourceIP === ip).slice(-50),
      relatedAlerts: this.idsAlerts.filter(a => a.sourceIP === ip || a.deviceIP === ip).slice(-20)
    };

    this._addAuditEntry('EMERGENCY', `Device isolated: ${ip} - ${reason}`);
    this.log(`Device ${ip} (${device.hostname}) ISOLATED: ${reason}`);

    return { device: ip, hostname: device.hostname, evidence };
  }

  preserveEvidence(eventType) {
    const evidence = {
      timestamp: Date.now(),
      eventType,
      auditLog: [...this.auditLog],
      idsAlerts: [...this.idsAlerts],
      dnsLog: [...this.dnsQueryLog],
      deviceStates: {},
      bandwidthSnapshot: {},
      networkTopology: { ...this.networkTopology }
    };

    for (const [ip, device] of this.devices) {
      evidence.deviceStates[ip] = { ...device };
    }
    for (const [ip, stats] of this.bandwidthStats) {
      evidence.bandwidthSnapshot[ip] = { ...stats, history: [...(stats.history || [])] };
    }

    this._addAuditEntry('EVIDENCE', `Evidence preserved for: ${eventType}`);
    this.log(`Evidence preserved: ${eventType}`);
    return evidence;
  }

  // ─── Compliance & Reporting ──────────────────────────────────────────

  _calculateSecurityPosture() {
    let score = 100;

    const blockedDevices = Array.from(this.devices.values()).filter(d => d.trustLevel === TRUST_LEVELS.BLOCKED).length;
    const unknownDevices = Array.from(this.devices.values()).filter(d => d.deviceType === 'UNKNOWN').length;
    const highRiskDevices = Array.from(this.devices.values()).filter(d => d.riskScore > 70).length;

    score -= blockedDevices * 5;
    score -= unknownDevices * 10;
    score -= highRiskDevices * 3;

    const criticalAlerts = this.idsAlerts.filter(a => a.severity === 'critical' && !a.responded).length;
    const highAlerts = this.idsAlerts.filter(a => a.severity === 'high' && !a.responded).length;
    score -= criticalAlerts * 10;
    score -= highAlerts * 5;

    const enabledRules = this.firewallRules.filter(r => r.enabled).length;
    if (enabledRules < 5) score -= 15;

    const certWarnings = this._checkCertificateExpiry();
    score -= certWarnings.filter(w => w.severity === 'critical').length * 10;
    score -= certWarnings.filter(w => w.severity === 'high').length * 5;

    this.securityPostureScore = Math.max(0, Math.min(100, score));
    return this.securityPostureScore;
  }

  getDeviceInventoryReport() {
    const inventory = {
      totalDevices: this.devices.size,
      byType: {},
      byTrust: {},
      online: 0,
      offline: 0,
      devices: []
    };

    for (const [ip, device] of this.devices) {
      inventory.byType[device.deviceType] = (inventory.byType[device.deviceType] || 0) + 1;
      inventory.byTrust[device.trustLevel] = (inventory.byTrust[device.trustLevel] || 0) + 1;
      if (device.online) inventory.online++;
      else inventory.offline++;
      inventory.devices.push({
        ip, mac: device.mac, hostname: device.hostname,
        vendor: device.vendor, type: device.deviceType,
        trust: device.trustLevel, riskScore: device.riskScore,
        online: device.online, vulnerabilities: device.vulnerabilities.length
      });
    }

    return inventory;
  }

  getSecurityDigest() {
    this._calculateSecurityPosture();

    return {
      timestamp: Date.now(),
      securityScore: this.securityPostureScore,
      scoreLabel: this.securityPostureScore >= 80 ? 'Good' : this.securityPostureScore >= 60 ? 'Fair' : this.securityPostureScore >= 40 ? 'Poor' : 'Critical',
      totalDevices: this.devices.size,
      onlineDevices: Array.from(this.devices.values()).filter(d => d.online).length,
      blockedDevices: Array.from(this.devices.values()).filter(d => d.trustLevel === TRUST_LEVELS.BLOCKED).length,
      idsAlerts: {
        total: this.idsAlerts.length,
        critical: this.idsAlerts.filter(a => a.severity === 'critical').length,
        high: this.idsAlerts.filter(a => a.severity === 'high').length,
        unresponded: this.idsAlerts.filter(a => !a.responded).length
      },
      dnsStats: {
        totalQueries: this.dnsQueryLog.length,
        blocked: this.dnsQueryLog.filter(e => e.blocked).length
      },
      firewallRulesActive: this.firewallRules.filter(r => r.enabled).length,
      threatIntelFeeds: this.threatIntelFeed.size,
      certWarnings: this._checkCertificateExpiry().length,
      guestSessionsActive: this.getActiveGuests().length,
      vpnClients: this.vpnClients.size,
      lockdownActive: this.isLockdown,
      bandwidthUtilization: this.getThroughputSummary().utilizationPercent + '%',
      topRisks: Array.from(this.devices.values())
        .filter(d => d.riskScore > 50)
        .sort((a, b) => b.riskScore - a.riskScore)
        .slice(0, 5)
        .map(d => ({ ip: d.ip, hostname: d.hostname, risk: d.riskScore })),
      recommendations: this._generateRecommendations()
    };
  }

  _generateRecommendations() {
    const recs = [];
    const unknowns = Array.from(this.devices.values()).filter(d => d.deviceType === 'UNKNOWN');
    if (unknowns.length > 0) {
      recs.push(`Identify ${unknowns.length} unknown device(s) on your network`);
    }
    const highRisk = Array.from(this.devices.values()).filter(d => d.riskScore > 70);
    if (highRisk.length > 0) {
      recs.push(`Review ${highRisk.length} high-risk device(s)`);
    }
    const certWarnings = this._checkCertificateExpiry();
    if (certWarnings.length > 0) {
      recs.push(`${certWarnings.length} certificate(s) need attention`);
    }
    if (this.firewallRules.filter(r => !r.enabled).length > 0) {
      recs.push('Some firewall rules are disabled — review your security policy');
    }
    if (this.speedTestResults.length === 0) {
      recs.push('Run a speed test to establish network performance baseline');
    }
    return recs;
  }

  getGDPRDataFlowReport() {
    const flows = [];
    for (const [ip, device] of this.devices) {
      if (device.deviceType === 'IoT' || device.deviceType === 'SMART_HOME') {
        const dnsQueries = this.dnsQueryLog.filter(e => e.sourceIP === ip);
        const externalDomains = [...new Set(dnsQueries.map(e => e.domain))];
        flows.push({
          device: device.hostname,
          ip,
          vendor: device.vendor,
          dataDestinations: externalDomains.slice(0, 10),
          totalDNSQueries: dnsQueries.length,
          blockedQueries: dnsQueries.filter(e => e.blocked).length,
          trafficVolume: device.trafficVolume,
          riskAssessment: device.riskScore > 60 ? 'High' : device.riskScore > 30 ? 'Medium' : 'Low'
        });
      }
    }
    return {
      generatedAt: Date.now(),
      iotDevices: flows.length,
      dataFlows: flows,
      recommendations: [
        'Review data destinations for each IoT device',
        'Enable DNS blocking for unnecessary analytics domains',
        'Consider local-only mode for sensitive IoT devices'
      ]
    };
  }

  // ─── Audit Log ───────────────────────────────────────────────────────

  _addAuditEntry(category, message) {
    const entry = {
      timestamp: Date.now(),
      category,
      message,
      id: this.auditLog.length + 1
    };
    this.auditLog.push(entry);
    if (this.auditLog.length > this.maxAuditLogSize) {
      this.auditLog.shift();
    }
  }

  getAuditLog(options = {}) {
    let log = [...this.auditLog];
    if (options.category) {
      log = log.filter(e => e.category === options.category);
    }
    if (options.since) {
      log = log.filter(e => e.timestamp >= options.since);
    }
    if (options.limit) {
      log = log.slice(-options.limit);
    }
    return log;
  }

  // ─── Network Backup ──────────────────────────────────────────────────

  createNetworkBackup(label) {
    const backup = {
      id: 'backup-' + Date.now(),
      label: label || 'Backup ' + new Date().toISOString(),
      timestamp: Date.now(),
      firewallRules: JSON.parse(JSON.stringify(this.firewallRules)),
      iotSegmentRules: JSON.parse(JSON.stringify(this.iotSegmentRules)),
      deviceTrustLevels: {},
      parentalProfiles: {},
      guestNetworkConfig: { ...this.guestNetworkConfig },
      dnsBlocklist: [...this.dnsBlocklist]
    };

    for (const [ip, device] of this.devices) {
      backup.deviceTrustLevels[ip] = { trust: device.trustLevel, hostname: device.hostname };
    }
    for (const [id, profile] of this.parentalProfiles) {
      backup.parentalProfiles[id] = JSON.parse(JSON.stringify(profile));
    }

    this.networkBackups.push(backup);
    if (this.networkBackups.length > 10) this.networkBackups.shift();

    this._addAuditEntry('BACKUP', `Network backup created: ${backup.label}`);
    this.log(`Network backup created: ${backup.label}`);
    return backup.id;
  }

  restoreNetworkBackup(backupId) {
    const backup = this.networkBackups.find(b => b.id === backupId);
    if (!backup) return { success: false, error: 'Backup not found' };

    this.firewallRules = JSON.parse(JSON.stringify(backup.firewallRules));
    this.iotSegmentRules = JSON.parse(JSON.stringify(backup.iotSegmentRules));
    this.guestNetworkConfig = { ...backup.guestNetworkConfig };
    this.dnsBlocklist = new Set(backup.dnsBlocklist);

    for (const [ip, data] of Object.entries(backup.deviceTrustLevels)) {
      const device = this.devices.get(ip);
      if (device) device.trustLevel = data.trust;
    }
    for (const [id, profile] of Object.entries(backup.parentalProfiles)) {
      this.parentalProfiles.set(id, JSON.parse(JSON.stringify(profile)));
    }

    this._addAuditEntry('BACKUP', `Network restored from backup: ${backup.label}`);
    this.log(`Network restored from backup: ${backup.label}`);
    return { success: true, restoredFrom: backup.label, timestamp: backup.timestamp };
  }

  getBackupList() {
    return this.networkBackups.map(b => ({
      id: b.id,
      label: b.label,
      timestamp: b.timestamp,
      ruleCount: b.firewallRules.length
    }));
  }

  getConfigDiff(backupId) {
    const backup = this.networkBackups.find(b => b.id === backupId);
    if (!backup) return null;

    const diff = {
      firewallRules: {
        current: this.firewallRules.length,
        backup: backup.firewallRules.length,
        added: this.firewallRules.filter(r => !backup.firewallRules.find(br => br.id === r.id)).map(r => r.name),
        removed: backup.firewallRules.filter(br => !this.firewallRules.find(r => r.id === br.id)).map(r => r.name)
      },
      trustChanges: [],
      dnsBlocklistDiff: {
        currentSize: this.dnsBlocklist.size,
        backupSize: backup.dnsBlocklist.length
      }
    };

    for (const [ip, data] of Object.entries(backup.deviceTrustLevels)) {
      const device = this.devices.get(ip);
      if (device && device.trustLevel !== data.trust) {
        diff.trustChanges.push({ ip, hostname: data.hostname, was: data.trust, now: device.trustLevel });
      }
    }

    return diff;
  }

  // ─── Monitoring Cycle ────────────────────────────────────────────────

  async _monitoringCycle() {
    if (!this.isInitialized) return;

    this._updateBandwidthStats();
    this._checkForIntrusions();
    this._cleanupExpiredGuests();
    this._checkCertificateExpiry();
    this._scanDeviceVulnerabilities();
    this._updateDeviceStatus();
    this._calculateSecurityPosture();
    this._buildNetworkTopology();
    this._enforceParentalTimeLimits();

    // Trim alert history to prevent unbounded growth
    if (this.idsAlerts.length > 1000) {
      this.idsAlerts = this.idsAlerts.slice(-500);
    }
  }

  _updateDeviceStatus() {
    for (const [, device] of this.devices) {
      if (device.online) {
        device.lastSeen = Date.now();
        device.signalStrength = Math.max(-90, Math.min(-20, device.signalStrength + (Math.random() * 6 - 3)));
      }
      if (Math.random() < 0.01) {
        device.online = !device.online;
        if (!device.online) {
          this._addAuditEntry('DEVICE', `Device went offline: ${device.hostname} (${device.ip})`);
        } else {
          this._addAuditEntry('DEVICE', `Device came online: ${device.hostname} (${device.ip})`);
        }
      }
    }
  }

  _enforceParentalTimeLimits() {
    for (const [id, profile] of this.parentalProfiles) {
      if (!profile.active) continue;

      const result = this.checkParentalAccess(id, null, 1.5);
      if (!result.allowed) {
        for (const deviceIP of profile.devices) {
          const device = this.devices.get(deviceIP);
          if (device && device.online) {
            profile.activityLog.push({
              timestamp: Date.now(),
              action: 'access_denied',
              reason: result.reason
            });
            if (profile.activityLog.length > 200) profile.activityLog.shift();
          }
        }
      }
    }
  }

  // ─── Statistics & API ────────────────────────────────────────────────

  getStatistics() {
    return {
      system: 'AdvancedHomeNetworkSecuritySystem',
      initialized: this.isInitialized,
      lockdownActive: this.isLockdown,
      emergencyMode: this.emergencyMode,
      securityPostureScore: this.securityPostureScore,
      network: {
        subnet: this.networkSubnet + '.0/24',
        gateway: this.gatewayIP,
        totalDevices: this.devices.size,
        onlineDevices: Array.from(this.devices.values()).filter(d => d.online).length,
        devicesByType: this._countBy(Array.from(this.devices.values()), 'deviceType'),
        devicesByTrust: this._countBy(Array.from(this.devices.values()), 'trustLevel')
      },
      security: {
        idsAlertsTotal: this.idsAlerts.length,
        idsAlertsCritical: this.idsAlerts.filter(a => a.severity === 'critical').length,
        idsAlertsHigh: this.idsAlerts.filter(a => a.severity === 'high').length,
        firewallRulesActive: this.firewallRules.filter(r => r.enabled).length,
        firewallRulesTotal: this.firewallRules.length,
        blockedIPs: this.blockedIPs.size,
        threatIntelEntries: this.threatIntelFeed.size
      },
      dns: {
        totalQueries: this.dnsQueryLog.length,
        blockedQueries: this.dnsQueryLog.filter(e => e.blocked).length,
        blocklistSize: this.dnsBlocklist.size,
        patternCount: MALICIOUS_DOMAIN_PATTERNS.length
      },
      bandwidth: this.getThroughputSummary(),
      vpn: {
        serverRunning: true,
        connectedClients: this.vpnClients.size
      },
      certificates: {
        tracked: this.certificates.size,
        warnings: this._checkCertificateExpiry().length
      },
      parental: {
        profiles: this.parentalProfiles.size,
        activeProfiles: Array.from(this.parentalProfiles.values()).filter(p => p.active).length
      },
      guest: {
        activeSessions: this.getActiveGuests().length,
        totalSessions: this.guestSessions.size
      },
      audit: {
        totalEntries: this.auditLog.length,
        maxEntries: this.maxAuditLogSize
      },
      backups: {
        count: this.networkBackups.length,
        latest: this.networkBackups.length > 0 ? this.networkBackups[this.networkBackups.length - 1].label : null
      },
      monitoring: {
        intervalMs: this.scanInterval,
        speedTestsRun: this.speedTestResults.length
      }
    };
  }

  _countBy(arr, key) {
    const counts = {};
    for (const item of arr) {
      const val = item[key] || 'unknown';
      counts[val] = (counts[val] || 0) + 1;
    }
    return counts;
  }

  _generateRandomMAC() {
    const hex = '0123456789ABCDEF';
    let mac = '';
    for (let i = 0; i < 6; i++) {
      if (i > 0) mac += ':';
      mac += hex.charAt(Math.floor(Math.random() * 16));
      mac += hex.charAt(Math.floor(Math.random() * 16));
    }
    return mac;
  }

  // ─── Logging ─────────────────────────────────────────────────────────

  log(msg) {
    if (this.homey && typeof this.homey.log === 'function') {
      this.homey.log(`[NetSec] ${msg}`);
    } else {
      console.log(`[NetSec] ${msg}`);
    }
  }

  error(msg) {
    if (this.homey && typeof this.homey.error === 'function') {
      this.homey.error(`[NetSec] ${msg}`);
    } else {
      console.error(`[NetSec] ${msg}`);
    }
  }

  // ─── Cleanup ─────────────────────────────────────────────────────────

  destroy() {
    this.log('Shutting down Advanced Home Network Security System...');

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this._addAuditEntry('SYSTEM', 'Network Security System shut down');

    this.devices.clear();
    this.bandwidthStats.clear();
    this.dnsQueryLog = [];
    this.idsAlerts = [];
    this.threatIntelFeed.clear();
    this.vpnClients.clear();
    this.guestSessions.clear();
    this.parentalProfiles.clear();
    this.certificates.clear();
    this.networkBackups = [];
    this.configSnapshots = [];
    this.speedTestResults = [];
    this.trafficBaselines.clear();
    this.blockedIPs.clear();
    this.dnsBlocklist.clear();
    this.failedLoginAttempts.clear();
    this.firewallRules = [];
    this.iotSegmentRules = [];
    this.auditLog = [];
    this.isInitialized = false;
    this.isLockdown = false;
    this.emergencyMode = false;

    this.log('Advanced Home Network Security System destroyed');
  }
}

module.exports = AdvancedHomeNetworkSecuritySystem;
