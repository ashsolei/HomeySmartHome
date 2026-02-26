const EventEmitter = require('events');

/**
 * Mailbox & Package Tracking System
 * 
 * Provides comprehensive mail and package delivery monitoring with notifications,
 * security features, and delivery management.
 * 
 * Features:
 * - Mail arrival detection with notifications
 * - Package delivery tracking and notifications
 * - Secure delivery instructions and codes
 * - Video doorbell integration for delivery verification
 * - Expected delivery scheduling
 * - Mailbox full detection
 * - Temperature monitoring for sensitive packages
 * - Theft detection and alerts
 * - Delivery history and analytics
 * - Integration with carrier tracking systems
 */
class MailboxPackageTrackingSystem extends EventEmitter {
  constructor(homey) {
    super();
    this.homey = homey;
    this.mailboxes = new Map();
    this.packages = new Map();
    this.deliveries = [];
    this.monitoringInterval = null;
  }

  async initialize() {
    try {
      this.homey.log('Initializing Mailbox & Package Tracking System...');

      await this.loadSettings();
      this.initializeDefaultMailboxes();

      this.startMonitoring();

      this.homey.log('Mailbox & Package Tracking System initialized successfully');
      return true;
    } catch (error) {
      this.homey.error(`[MailboxPackageTrackingSystem] Failed to initialize:`, error.message);
    }
  }

  async loadSettings() {
    const settings = await this.homey.settings.get('mailboxPackageTracking') || {};
    
    if (settings.mailboxes) {
      settings.mailboxes.forEach(mailbox => {
        this.mailboxes.set(mailbox.id, mailbox);
      });
    }
    
    if (settings.packages) {
      settings.packages.forEach(pkg => {
        this.packages.set(pkg.id, pkg);
      });
    }
    
    this.deliveries = settings.deliveries || [];
  }

  async saveSettings() {
    const settings = {
      mailboxes: Array.from(this.mailboxes.values()),
      packages: Array.from(this.packages.values()),
      deliveries: this.deliveries.slice(-100) // Keep last 100 deliveries
    };
    
    await this.homey.settings.set('mailboxPackageTracking', settings);
  }

  initializeDefaultMailboxes() {
    if (this.mailboxes.size === 0) {
      this.mailboxes.set('main-mailbox', {
        id: 'main-mailbox',
        name: 'Huvudbrevlåda',
        type: 'traditional',
        location: 'front-door',
        sensors: {
          door: 'closed',
          motion: false,
          weight: 0,
          temperature: 18,
          camera: true,
          fullnessLevel: 0
        },
        capabilities: {
          smart: true,
          temperatureControlled: false,
          locked: true,
          videoVerification: true,
          sizeDetection: true
        },
        status: {
          hasNewMail: false,
          isFull: false,
          lastChecked: null,
          lastDelivery: null
        },
        settings: {
          fullThreshold: 80, // %
          notifyOnDelivery: true,
          videoRecordOnOpen: true,
          expectedDeliveryWindow: { from: '08:00', to: '18:00' }
        },
        accessCodes: []
      });

      this.mailboxes.set('package-box', {
        id: 'package-box',
        name: 'Paketbox',
        type: 'package-box',
        location: 'garage',
        sensors: {
          door: 'closed',
          motion: false,
          weight: 0,
          temperature: 15,
          camera: true,
          fullnessLevel: 0
        },
        capabilities: {
          smart: true,
          temperatureControlled: true,
          locked: true,
          videoVerification: true,
          sizeDetection: true,
          remoteUnlock: true
        },
        status: {
          hasPackages: false,
          isFull: false,
          lastChecked: null,
          lastDelivery: null,
          lockStatus: 'locked'
        },
        settings: {
          fullThreshold: 70,
          notifyOnDelivery: true,
          videoRecordOnOpen: true,
          expectedDeliveryWindow: { from: '06:00', to: '21:00' },
          temperatureAlert: { min: 0, max: 30 }
        },
        accessCodes: [
          { code: '1234', carrier: 'PostNord', expiresAt: null, singleUse: false },
          { code: '5678', carrier: 'DHL', expiresAt: null, singleUse: false }
        ]
      });
    }
  }

  startMonitoring() {
    // Check mailbox status and expected deliveries every 2 minutes
    this.monitoringInterval = setInterval(() => {
      this.checkMailboxStatus();
      this.checkExpectedDeliveries();
      this.checkPackageConditions();
    }, 120000);
  }

  async checkMailboxStatus() {
    for (const mailbox of this.mailboxes.values()) {
      const sensors = mailbox.sensors;
      
      // Check if mailbox is full
      if (sensors.fullnessLevel >= mailbox.settings.fullThreshold && !mailbox.status.isFull) {
        mailbox.status.isFull = true;
        await this.notifyMailboxFull(mailbox);
      }
      
      // Check for suspicious activity (door opened outside delivery window)
      if (sensors.door === 'open') {
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const { from, to } = mailbox.settings.expectedDeliveryWindow;
        
        if (currentTime < from || currentTime > to) {
          await this.notifySuspiciousActivity(mailbox);
        }
      }
    }
  }

  async checkExpectedDeliveries() {
    const now = Date.now();
    
    for (const pkg of this.packages.values()) {
      if (pkg.status === 'expected' && pkg.expectedDelivery) {
        const expectedTime = new Date(pkg.expectedDelivery).getTime();
        const timeDiff = expectedTime - now;
        
        // Notify 1 hour before expected delivery
        if (timeDiff > 0 && timeDiff <= 3600000 && !pkg.notificationSent) {
          pkg.notificationSent = true;
          await this.notifyExpectedDelivery(pkg);
        }
        
        // Check if delivery is overdue
        if (timeDiff < -86400000 && !pkg.overdueNotificationSent) { // 24 hours late
          pkg.overdueNotificationSent = true;
          await this.notifyOverdueDelivery(pkg);
        }
      }
    }
    
    await this.saveSettings();
  }

  async checkPackageConditions() {
    for (const mailbox of this.mailboxes.values()) {
      if (!mailbox.capabilities.temperatureControlled) continue;
      
      const temp = mailbox.sensors.temperature;
      const alerts = mailbox.settings.temperatureAlert;
      
      if (alerts && (temp < alerts.min || temp > alerts.max)) {
        await this.notifyTemperatureAlert(mailbox, temp);
      }
    }
  }

  async notifyMailboxFull(mailbox) {
    this.emit('notification', {
      title: 'Brevlåda full',
      message: `${mailbox.name} är ${mailbox.sensors.fullnessLevel}% full`,
      priority: 'normal',
      category: 'mailbox'
    });
  }

  async notifySuspiciousActivity(mailbox) {
    this.emit('notification', {
      title: 'Misstänkt aktivitet',
      message: `${mailbox.name} öppnad utanför leveranstid`,
      priority: 'high',
      category: 'security'
    });
    
    // Record video if camera available
    if (mailbox.sensors.camera && mailbox.settings.videoRecordOnOpen) {
      this.emit('recordVideo', {
        camera: `${mailbox.id}-camera`,
        duration: 30,
        reason: 'suspicious-activity'
      });
    }
  }

  async notifyExpectedDelivery(pkg) {
    this.emit('notification', {
      title: 'Paket förväntas snart',
      message: `${pkg.description} från ${pkg.carrier} levereras inom 1 timme`,
      priority: 'normal',
      category: 'delivery'
    });
  }

  async notifyOverdueDelivery(pkg) {
    this.emit('notification', {
      title: 'Försenad leverans',
      message: `${pkg.description} från ${pkg.carrier} är försenat`,
      priority: 'normal',
      category: 'delivery'
    });
  }

  async notifyTemperatureAlert(mailbox, temperature) {
    this.emit('notification', {
      title: 'Temperaturvarning',
      message: `${mailbox.name}: Temperatur ${temperature}°C`,
      priority: 'high',
      category: 'package-condition'
    });
  }

  async detectDelivery(mailboxId, detectionData) {
    const mailbox = this.mailboxes.get(mailboxId);
    if (!mailbox) {
      throw new Error('Brevlåda hittades inte');
    }
    
    const delivery = {
      id: `delivery-${Date.now()}`,
      mailboxId,
      timestamp: Date.now(),
      type: detectionData.type || 'mail', // mail, package, unknown
      weight: detectionData.weight || 0,
      size: detectionData.size || 'small',
      verified: false,
      photoUrl: null,
      carrier: null,
      packageId: null
    };
    
    // Update mailbox status
    mailbox.status.hasNewMail = true;
    mailbox.status.lastDelivery = delivery.timestamp;
    mailbox.sensors.fullnessLevel += detectionData.fillIncrease || 10;
    
    if (detectionData.weight) {
      mailbox.sensors.weight += detectionData.weight;
    }
    
    // Record video if available
    if (mailbox.sensors.camera && mailbox.settings.videoRecordOnOpen) {
      this.emit('recordVideo', {
        camera: `${mailboxId}-camera`,
        duration: 30,
        reason: 'delivery-detected'
      });
      delivery.photoUrl = `${mailboxId}-delivery-${delivery.id}.jpg`;
    }
    
    // Try to match with expected package
    if (delivery.type === 'package') {
      const matchedPackage = await this.matchDeliveryToPackage(delivery);
      if (matchedPackage) {
        delivery.packageId = matchedPackage.id;
        delivery.carrier = matchedPackage.carrier;
        matchedPackage.status = 'delivered';
        matchedPackage.deliveredAt = delivery.timestamp;
      }
    }
    
    this.deliveries.push(delivery);
    await this.saveSettings();
    
    // Send notification
    if (mailbox.settings.notifyOnDelivery) {
      this.emit('notification', {
        title: 'Ny leverans!',
        message: `${delivery.type === 'package' ? 'Paket' : 'Post'} levererat till ${mailbox.name}`,
        priority: 'normal',
        category: 'delivery',
        data: { deliveryId: delivery.id }
      });
    }
    
    this.emit('deliveryDetected', { delivery, mailbox });
    
    return delivery;
  }

  async matchDeliveryToPackage(delivery) {
    // Find expected packages for this mailbox
    const candidates = Array.from(this.packages.values()).filter(pkg => 
      pkg.status === 'expected' &&
      pkg.deliveryLocation === delivery.mailboxId &&
      pkg.expectedDelivery
    );
    
    if (candidates.length === 0) return null;
    
    // Sort by expected delivery time
    candidates.sort((a, b) => 
      new Date(a.expectedDelivery).getTime() - new Date(b.expectedDelivery).getTime()
    );
    
    // Return the package expected soonest
    return candidates[0];
  }

  async addExpectedPackage(packageData) {
    const packageId = `pkg-${Date.now()}`;
    
    const pkg = {
      id: packageId,
      trackingNumber: packageData.trackingNumber,
      carrier: packageData.carrier,
      description: packageData.description || 'Paket',
      sender: packageData.sender || 'Okänd',
      expectedDelivery: packageData.expectedDelivery,
      deliveryLocation: packageData.deliveryLocation || 'package-box',
      status: 'expected', // expected, out-for-delivery, delivered, failed
      requiresSignature: packageData.requiresSignature || false,
      temperatureSensitive: packageData.temperatureSensitive || false,
      value: packageData.value || 0,
      weight: packageData.weight || 0,
      size: packageData.size || 'medium',
      specialInstructions: packageData.specialInstructions || '',
      notificationSent: false,
      overdueNotificationSent: false,
      deliveredAt: null
    };
    
    this.packages.set(packageId, pkg);
    await this.saveSettings();
    
    this.emit('notification', {
      title: 'Paket förväntas',
      message: `${pkg.description} från ${pkg.carrier} levereras ${new Date(pkg.expectedDelivery).toLocaleDateString()}`,
      priority: 'low',
      category: 'delivery'
    });
    
    return pkg;
  }

  async generateDeliveryCode(mailboxId, carrier, options = {}) {
    const mailbox = this.mailboxes.get(mailboxId);
    if (!mailbox) {
      throw new Error('Brevlåda hittades inte');
    }
    
    if (!mailbox.capabilities.remoteUnlock) {
      throw new Error('Brevlådan stöder inte fjärrlåsning');
    }
    
    // Generate random 4-6 digit code
    const code = String(Math.floor(1000 + Math.random() * 9000));
    
    const accessCode = {
      code,
      carrier,
      createdAt: Date.now(),
      expiresAt: options.expiresAt || null,
      singleUse: options.singleUse !== undefined ? options.singleUse : true,
      used: false,
      usedAt: null
    };
    
    mailbox.accessCodes.push(accessCode);
    await this.saveSettings();
    
    this.emit('notification', {
      title: 'Leveranskod genererad',
      message: `Kod ${code} för ${carrier} på ${mailbox.name}`,
      priority: 'normal',
      category: 'delivery'
    });
    
    return accessCode;
  }

  async verifyDeliveryCode(mailboxId, code) {
    const mailbox = this.mailboxes.get(mailboxId);
    if (!mailbox) {
      throw new Error('Brevlåda hittades inte');
    }
    
    const accessCode = mailbox.accessCodes.find(ac => ac.code === code && !ac.used);
    
    if (!accessCode) {
      this.emit('notification', {
        title: 'Ogiltig kod',
        message: `Försök att använda ogiltig kod på ${mailbox.name}`,
        priority: 'high',
        category: 'security'
      });
      return false;
    }
    
    // Check if code has expired
    if (accessCode.expiresAt && Date.now() > accessCode.expiresAt) {
      return false;
    }
    
    // Mark as used if single-use
    if (accessCode.singleUse) {
      accessCode.used = true;
      accessCode.usedAt = Date.now();
    }
    
    // Unlock mailbox
    mailbox.status.lockStatus = 'unlocked';
    mailbox.sensors.door = 'open';
    
    await this.saveSettings();
    
    // Auto-lock after 2 minutes
    setTimeout(async () => {
      if (mailbox.sensors.door === 'closed') {
        mailbox.status.lockStatus = 'locked';
        await this.saveSettings();
      }
    }, 120000);
    
    return true;
  }

  async markMailboxChecked(mailboxId) {
    const mailbox = this.mailboxes.get(mailboxId);
    if (!mailbox) {
      throw new Error('Brevlåda hittades inte');
    }
    
    mailbox.status.hasNewMail = false;
    mailbox.status.lastChecked = Date.now();
    mailbox.sensors.fullnessLevel = 0;
    mailbox.sensors.weight = 0;
    
    await this.saveSettings();
    
    return mailbox;
  }

  async unlockMailbox(mailboxId, duration = 2) {
    const mailbox = this.mailboxes.get(mailboxId);
    if (!mailbox) {
      throw new Error('Brevlåda hittades inte');
    }
    
    if (!mailbox.capabilities.remoteUnlock) {
      throw new Error('Brevlådan stöder inte fjärrlåsning');
    }
    
    mailbox.status.lockStatus = 'unlocked';
    await this.saveSettings();
    
    this.emit('notification', {
      title: 'Brevlåda upplåst',
      message: `${mailbox.name} upplåst i ${duration} minuter`,
      priority: 'normal',
      category: 'mailbox'
    });
    
    // Auto-lock after duration
    setTimeout(async () => {
      mailbox.status.lockStatus = 'locked';
      await this.saveSettings();
      
      this.emit('notification', {
        title: 'Brevlåda låst',
        message: `${mailbox.name} har låsts automatiskt`,
        priority: 'low',
        category: 'mailbox'
      });
    }, duration * 60000);
    
    return mailbox;
  }

  getMailboxes() {
    return Array.from(this.mailboxes.values());
  }

  getMailbox(mailboxId) {
    return this.mailboxes.get(mailboxId);
  }

  getPackages(status = null) {
    let packages = Array.from(this.packages.values());
    
    if (status) {
      packages = packages.filter(p => p.status === status);
    }
    
    return packages;
  }

  getPackage(packageId) {
    return this.packages.get(packageId);
  }

  getDeliveries(mailboxId = null, limit = 20) {
    let deliveries = this.deliveries;
    
    if (mailboxId) {
      deliveries = deliveries.filter(d => d.mailboxId === mailboxId);
    }
    
    return deliveries.slice(-limit).reverse();
  }

  getStats() {
    const mailboxes = Array.from(this.mailboxes.values());
    const packages = Array.from(this.packages.values());
    const last30Days = this.deliveries.filter(d => 
      Date.now() - d.timestamp < 30 * 24 * 60 * 60 * 1000
    );
    
    return {
      totalMailboxes: mailboxes.length,
      mailboxesWithNewMail: mailboxes.filter(m => m.status.hasNewMail).length,
      expectedPackages: packages.filter(p => p.status === 'expected').length,
      deliveredPackages: packages.filter(p => p.status === 'delivered').length,
      last30Days: {
        totalDeliveries: last30Days.length,
        packages: last30Days.filter(d => d.type === 'package').length,
        mail: last30Days.filter(d => d.type === 'mail').length,
        averagePerDay: Math.round(last30Days.length / 30)
      }
    };
  }

  async destroy() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    this.removeAllListeners();
  }
}

module.exports = MailboxPackageTrackingSystem;
