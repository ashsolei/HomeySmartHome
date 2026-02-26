'use strict';

/**
 * Package Delivery Manager
 * Smart package delivery tracking and management
 */
class PackageDeliveryManager {
  constructor(app) {
    this._intervals = [];
    this._timeouts = [];
    this.app = app;
    this.packages = new Map();
    this.deliveryZones = new Map();
    this.deliveryPeople = new Map();
    this.notifications = [];
  }

  async initialize() {
    await this.setupDeliveryZones();
    await this.setupPackages();
    
    this.startMonitoring();
  }

  // ============================================
  // PACKAGES
  // ============================================

  async setupPackages() {
    const packages = [
      {
        id: 'pkg_1',
        trackingNumber: 'SE123456789',
        carrier: 'PostNord',
        sender: 'Amazon',
        recipient: 'Anna',
        status: 'in_transit',
        estimatedDelivery: Date.now() + 2 * 24 * 60 * 60 * 1000,
        actualDelivery: null,
        location: 'delivery_center',
        requiresSignature: false,
        deliveryInstructions: 'Lämna vid dörren',
        weight: 2.5,  // kg
        dimensions: { length: 30, width: 20, height: 15 },  // cm
        value: 450  // SEK
      },
      {
        id: 'pkg_2',
        trackingNumber: 'DHL987654321',
        carrier: 'DHL',
        sender: 'Zalando',
        recipient: 'Emma',
        status: 'out_for_delivery',
        estimatedDelivery: Date.now() + 3 * 60 * 60 * 1000,
        actualDelivery: null,
        location: 'on_vehicle',
        requiresSignature: false,
        deliveryInstructions: 'Ring på dörren',
        weight: 1.2,
        dimensions: { length: 40, width: 30, height: 10 },
        value: 800
      },
      {
        id: 'pkg_3',
        trackingNumber: 'UPS456789123',
        carrier: 'UPS',
        sender: 'Apple',
        recipient: 'Erik',
        status: 'delivered',
        estimatedDelivery: Date.now() - 1 * 24 * 60 * 60 * 1000,
        actualDelivery: Date.now() - 1 * 24 * 60 * 60 * 1000,
        location: 'front_door',
        requiresSignature: true,
        deliveryInstructions: 'Signatur krävs',
        weight: 0.5,
        dimensions: { length: 20, width: 15, height: 5 },
        value: 12000
      }
    ];

    for (const pkg of packages) {
      this.packages.set(pkg.id, pkg);
    }
  }

  async trackPackage(trackingNumber) {
    const pkg = Array.from(this.packages.values()).find(p => p.trackingNumber === trackingNumber);
    
    if (!pkg) {
      return { success: false, error: 'Package not found' };
    }

    return {
      trackingNumber: pkg.trackingNumber,
      carrier: pkg.carrier,
      status: pkg.status,
      location: pkg.location,
      estimatedDelivery: new Date(pkg.estimatedDelivery).toLocaleString('sv-SE')
    };
  }

  async addPackage(data) {
    const pkgId = 'pkg_' + Date.now();

    const pkg = {
      id: pkgId,
      trackingNumber: data.trackingNumber,
      carrier: data.carrier,
      sender: data.sender || 'Unknown',
      recipient: data.recipient,
      status: 'pending',
      estimatedDelivery: data.estimatedDelivery,
      actualDelivery: null,
      location: 'origin',
      requiresSignature: data.requiresSignature || false,
      deliveryInstructions: data.deliveryInstructions || '',
      weight: data.weight || 0,
      dimensions: data.dimensions || { length: 0, width: 0, height: 0 },
      value: data.value || 0
    };

    this.packages.set(pkgId, pkg);

    console.log(`📦 Package added: ${pkg.trackingNumber} (${pkg.carrier})`);

    return { success: true, packageId: pkgId };
  }

  async updatePackageStatus(packageId, status, location = null) {
    const pkg = this.packages.get(packageId);
    
    if (!pkg) {
      return { success: false, error: 'Package not found' };
    }

    pkg.status = status;
    
    if (location) {
      pkg.location = location;
    }

    console.log(`📦 Package status updated: ${pkg.trackingNumber} → ${status}`);

    // Send notifications
    await this.sendDeliveryNotification(pkg);

    // If delivered, trigger home automation
    if (status === 'delivered') {
      pkg.actualDelivery = Date.now();
      await this.handleDelivery(pkg);
    }

    return { success: true };
  }

  // ============================================
  // DELIVERY ZONES
  // ============================================

  async setupDeliveryZones() {
    const zones = [
      {
        id: 'front_door',
        name: 'Ytterdörr',
        type: 'secure',
        camera: 'doorbell_camera',
        lockbox: null,
        weatherProtected: true,
        accessible: true
      },
      {
        id: 'garage',
        name: 'Garage',
        type: 'secure',
        camera: 'garage_camera',
        lockbox: 'garage_code_123',
        weatherProtected: true,
        accessible: false  // Requires code
      },
      {
        id: 'mailbox',
        name: 'Brevlåda',
        type: 'standard',
        camera: null,
        lockbox: 'mailbox_key',
        weatherProtected: true,
        accessible: true
      },
      {
        id: 'parcel_locker',
        name: 'Paketbox',
        type: 'secure',
        camera: 'outdoor_camera',
        lockbox: 'parcel_code_456',
        weatherProtected: true,
        accessible: true
      }
    ];

    for (const zone of zones) {
      this.deliveryZones.set(zone.id, zone);
    }
  }

  async getPreferredDeliveryZone(pkg) {
    // Determine best delivery zone based on package
    if (pkg.requiresSignature) {
      return 'front_door';  // Must hand to person
    }

    if (pkg.weight > 5 || pkg.value > 5000) {
      return 'garage';  // Secure location for large/valuable
    }

    if (pkg.weight < 2 && pkg.dimensions.length < 30) {
      return 'parcel_locker';  // Small packages in locker
    }

    return 'front_door';  // Default
  }

  // ============================================
  // DELIVERY HANDLING
  // ============================================

  async handleDelivery(pkg) {
    console.log(`📬 Handling delivery: ${pkg.trackingNumber}`);

    const zone = await this.getPreferredDeliveryZone(pkg);
    const zoneInfo = this.deliveryZones.get(zone);

    console.log(`   Delivery zone: ${zoneInfo.name}`);

    // Take photo if camera available
    if (zoneInfo.camera) {
      console.log(`   📸 Taking photo with ${zoneInfo.camera}`);
    }

    // Log delivery time
    console.log(`   ⏰ Delivered at ${new Date(pkg.actualDelivery).toLocaleTimeString('sv-SE')}`);

    // Notify recipient
    await this.sendDeliveryNotification(pkg);

    // Home automation
    if (zone === 'front_door') {
      console.log('   💡 Turning on porch light');
      console.log('   🔔 Playing doorbell chime');
    }

    return { success: true, zone: zoneInfo.name };
  }

  async sendDeliveryNotification(pkg) {
    const notification = {
      id: 'notif_' + Date.now(),
      packageId: pkg.id,
      type: pkg.status,
      timestamp: Date.now(),
      message: this.getStatusMessage(pkg)
    };

    this.notifications.push(notification);

    console.log(`📢 Notification: ${notification.message}`);

    return notification;
  }

  getStatusMessage(pkg) {
    switch (pkg.status) {
      case 'pending':
        return `Paket från ${pkg.sender} registrerat`;
      case 'in_transit':
        return `Paket från ${pkg.sender} på väg`;
      case 'out_for_delivery':
        return `Paket från ${pkg.sender} levereras idag!`;
      case 'delivered':
        return `Paket från ${pkg.sender} levererat!`;
      case 'failed':
        return `Leveransförsök misslyckades för paket från ${pkg.sender}`;
      case 'returned':
        return `Paket från ${pkg.sender} returnerat`;
      default:
        return `Paket från ${pkg.sender} status: ${pkg.status}`;
    }
  }

  // ============================================
  // DELIVERY PERSON RECOGNITION
  // ============================================

  async recognizeDeliveryPerson(_imageData) {
    // Simulated facial/uniform recognition
    const knownCarriers = ['PostNord', 'DHL', 'UPS', 'Bring', 'Budbee'];
    const recognizedCarrier = knownCarriers[Math.floor(Math.random() * knownCarriers.length)];

    console.log(`👤 Delivery person recognized: ${recognizedCarrier}`);

    // Automatically unlock parcel locker if recognized
    if (recognizedCarrier) {
      console.log('   🔓 Unlocking parcel locker');
      return { success: true, carrier: recognizedCarrier, access: 'granted' };
    }

    return { success: false, access: 'denied' };
  }

  async grantTempAccess(carrier, duration = 300) {
    // Grant temporary access code (5 minutes)
    const code = Math.floor(1000 + Math.random() * 9000);

    console.log(`🔑 Temporary access granted to ${carrier}`);
    console.log(`   Code: ${code}`);
    console.log(`   Valid for: ${duration} seconds`);

    this._timeouts.push(setTimeout(() => {
      console.log(`   🔒 Access code ${code} expired`);
    }, duration * 1000));

    return { success: true, code, expiresIn: duration };
  }

  // ============================================
  // SMART FEATURES
  // ============================================

  async scheduleSafeDeliveryTime() {
    // Determine best delivery time when someone is home
    const schedule = {
      weekdays: { start: '17:00', end: '20:00' },
      weekends: { start: '10:00', end: '20:00' }
    };

    console.log('📅 Safe delivery times configured:');
    console.log(`   Weekdays: ${schedule.weekdays.start} - ${schedule.weekdays.end}`);
    console.log(`   Weekends: ${schedule.weekends.start} - ${schedule.weekends.end}`);

    return schedule;
  }

  async coordinateMultipleDeliveries(date) {
    // Find all packages expected on a specific date
    const packages = Array.from(this.packages.values()).filter(pkg => {
      const deliveryDate = new Date(pkg.estimatedDelivery).toDateString();
      const targetDate = new Date(date).toDateString();
      return deliveryDate === targetDate && pkg.status !== 'delivered';
    });

    if (packages.length > 1) {
      console.log(`📦 ${packages.length} packages expected on ${new Date(date).toLocaleDateString('sv-SE')}`);
      console.log('   Coordinating deliveries to same time slot');
    }

    return packages;
  }

  async handleMissedDelivery(packageId) {
    const pkg = this.packages.get(packageId);
    
    if (!pkg) {
      return { success: false, error: 'Package not found' };
    }

    console.log(`❌ Missed delivery: ${pkg.trackingNumber}`);
    console.log('   Options:');
    console.log('   1. Reschedule delivery');
    console.log('   2. Collect at pickup point');
    console.log('   3. Deliver to neighbor');

    pkg.status = 'failed';

    return { success: true, options: ['reschedule', 'pickup', 'neighbor'] };
  }

  async requestRedelivery(packageId, preferredTime) {
    const pkg = this.packages.get(packageId);
    
    if (!pkg) {
      return { success: false, error: 'Package not found' };
    }

    pkg.status = 'rescheduled';
    pkg.estimatedDelivery = preferredTime;

    console.log(`🔄 Redelivery requested: ${pkg.trackingNumber}`);
    console.log(`   New time: ${new Date(preferredTime).toLocaleString('sv-SE')}`);

    return { success: true };
  }

  // ============================================
  // MONITORING
  // ============================================

  startMonitoring() {
    // Check for delivery updates every 15 minutes
    this._intervals.push(setInterval(() => {
      this.checkDeliveryUpdates();
    }, 15 * 60 * 1000));

    // Check for expected deliveries today
    this._intervals.push(setInterval(() => {
      this.checkTodaysDeliveries();
    }, 60 * 60 * 1000));

    console.log('📦 Package Manager active');
  }

  async checkDeliveryUpdates() {
    for (const [id, pkg] of this.packages) {
      if (pkg.status === 'in_transit' || pkg.status === 'out_for_delivery') {
        // Simulate status updates (would use real carrier APIs)
        if (Math.random() < 0.1) {
          const statuses = ['in_transit', 'out_for_delivery', 'delivered'];
          const currentIndex = statuses.indexOf(pkg.status);
          
          if (currentIndex < statuses.length - 1) {
            await this.updatePackageStatus(id, statuses[currentIndex + 1]);
          }
        }
      }
    }
  }

  async checkTodaysDeliveries() {
    const today = new Date().toDateString();
    const expected = Array.from(this.packages.values()).filter(pkg => {
      const deliveryDate = new Date(pkg.estimatedDelivery).toDateString();
      return deliveryDate === today && pkg.status !== 'delivered';
    });

    if (expected.length > 0) {
      console.log(`📦 ${expected.length} deliveries expected today`);
    }
  }

  // ============================================
  // REPORTING
  // ============================================

  getDeliveryOverview() {
    const packages = Array.from(this.packages.values());
    const pending = packages.filter(p => p.status !== 'delivered').length;
    const delivered = packages.filter(p => p.status === 'delivered').length;
    const today = packages.filter(p => {
      const deliveryDate = new Date(p.estimatedDelivery).toDateString();
      const todayDate = new Date().toDateString();
      return deliveryDate === todayDate && p.status !== 'delivered';
    }).length;

    return {
      total: packages.length,
      pending,
      delivered,
      expectedToday: today,
      deliveryZones: this.deliveryZones.size
    };
  }

  getActivePackages() {
    return Array.from(this.packages.values())
      .filter(p => p.status !== 'delivered')
      .map(p => ({
        tracking: p.trackingNumber,
        carrier: p.carrier,
        from: p.sender,
        to: p.recipient,
        status: p.status,
        eta: new Date(p.estimatedDelivery).toLocaleDateString('sv-SE')
      }));
  }

  getRecentDeliveries(days = 7) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    
    return Array.from(this.packages.values())
      .filter(p => p.actualDelivery && p.actualDelivery >= cutoff)
      .map(p => ({
        tracking: p.trackingNumber,
        from: p.sender,
        to: p.recipient,
        delivered: new Date(p.actualDelivery).toLocaleDateString('sv-SE'),
        location: p.location
      }));
  }

  getDeliveryZones() {
    return Array.from(this.deliveryZones.values()).map(z => ({
      name: z.name,
      type: z.type,
      camera: z.camera ? 'Yes' : 'No',
      lockbox: z.lockbox ? 'Yes' : 'No',
      weatherProtected: z.weatherProtected ? 'Yes' : 'No'
    }));
  }

  destroy() {
    if (this._intervals) {
      this._intervals.forEach(id => clearInterval(id));
      this._intervals = [];
    }
    if (this._timeouts) {
      this._timeouts.forEach(id => clearTimeout(id));
      this._timeouts = [];
    }
  }
}

module.exports = PackageDeliveryManager;
