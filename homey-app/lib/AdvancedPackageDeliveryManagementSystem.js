'use strict';

const EventEmitter = require('events');
const Homey = require('homey');

/**
 * Advanced Package Delivery Management System
 * 
 * Smart package tracking, delivery coordination, secure storage, and integrated logistics management.
 * 
 * @extends EventEmitter
 */
class AdvancedPackageDeliveryManagementSystem extends EventEmitter {
  constructor() {
    super();
    
    this.packages = new Map();
    this.deliveryZones = new Map();
    this.deliveryInstructions = new Map();
    this.carriers = new Map();
    this.storageLocations = new Map();
    
    this.settings = {
      autoNotificationEnabled: true,
      signatureRequired: false,
      leaveAtDoor: true,
      secureStorageRequired: false,
      photoConfirmationEnabled: true,
      neighborDeliveryAllowed: false,
      deliveryTimePreference: 'anytime', // morning, afternoon, evening, anytime
      cameraRecordingEnabled: true
    };
    
    this.statistics = {
      totalDeliveries: 142,
      successfulDeliveries: 138,
      missedDeliveries: 3,
      returnedPackages: 1,
      averageDeliveryTime: 2.5 // days
    };
    
    this.cache = { data: new Map(), timestamps: new Map(), ttl: 5 * 60 * 1000 };
    this.monitoring = { interval: null, checkInterval: 5 * 60 * 1000, lastCheck: null };
    
    this.initializeDefaultData();
  }
  
  initializeDefaultData() {
    // Active packages
    this.packages.set('pkg-001', {
      id: 'pkg-001',
      trackingNumber: 'SE123456789',
      carrier: 'postnord',
      sender: 'Amazon',
      status: 'out-for-delivery',
      estimatedDelivery: Date.now() + 4 * 60 * 60 * 1000, // 4 hours
      description: 'Electronics - Smart Speaker',
      weight: 0.8, // kg
      dimensions: { length: 25, width: 20, height: 15 }, // cm
      requiresSignature: false,
      insured: true,
      value: 1200, // SEK
      deliveryAttempts: 0,
      lastUpdate: Date.now() - 30 * 60 * 1000,
      trackingHistory: [
        { timestamp: Date.now() - 48 * 60 * 60 * 1000, status: 'picked-up', location: 'Amazon Warehouse' },
        { timestamp: Date.now() - 24 * 60 * 60 * 1000, status: 'in-transit', location: 'Stockholm Hub' },
        { timestamp: Date.now() - 2 * 60 * 60 * 1000, status: 'out-for-delivery', location: 'Local Depot' }
      ]
    });
    
    this.packages.set('pkg-002', {
      id: 'pkg-002',
      trackingNumber: 'DHL987654321',
      carrier: 'dhl',
      sender: 'Elgiganten',
      status: 'delivered',
      estimatedDelivery: Date.now() - 24 * 60 * 60 * 1000,
      actualDelivery: Date.now() - 20 * 60 * 60 * 1000,
      description: 'Home Appliance - Vacuum Cleaner',
      weight: 5.2,
      dimensions: { length: 50, width: 40, height: 30 },
      requiresSignature: true,
      signedBy: 'John Homeowner',
      insured: true,
      value: 3500,
      deliveryAttempts: 1,
      storageLocation: 'storage-002',
      photoConfirmation: 'photo-url-123',
      lastUpdate: Date.now() - 20 * 60 * 60 * 1000,
      trackingHistory: [
        { timestamp: Date.now() - 72 * 60 * 60 * 1000, status: 'picked-up', location: 'Elgiganten Warehouse' },
        { timestamp: Date.now() - 36 * 60 * 60 * 1000, status: 'in-transit', location: 'Regional Hub' },
        { timestamp: Date.now() - 20 * 60 * 60 * 1000, status: 'delivered', location: 'Front Door' }
      ]
    });
    
    this.packages.set('pkg-003', {
      id: 'pkg-003',
      trackingNumber: 'UPS456789123',
      carrier: 'ups',
      sender: 'IKEA',
      status: 'awaiting-pickup',
      estimatedDelivery: Date.now() + 24 * 60 * 60 * 1000,
      description: 'Furniture Parts - Bookshelf',
      weight: 18.5,
      dimensions: { length: 120, width: 40, height: 15 },
      requiresSignature: false,
      insured: false,
      value: 899,
      deliveryAttempts: 1,
      lastUpdate: Date.now() - 6 * 60 * 60 * 1000,
      notes: 'First delivery attempt failed - no one home',
      trackingHistory: [
        { timestamp: Date.now() - 48 * 60 * 60 * 1000, status: 'picked-up', location: 'IKEA Warehouse' },
        { timestamp: Date.now() - 12 * 60 * 60 * 1000, status: 'delivery-failed', location: 'Front Door', reason: 'No one home' },
        { timestamp: Date.now() - 6 * 60 * 60 * 1000, status: 'awaiting-pickup', location: 'UPS Service Point' }
      ]
    });
    
    // Delivery zones
    this.deliveryZones.set('zone-001', {
      id: 'zone-001',
      name: 'Front Door',
      type: 'primary',
      description: 'Main entrance',
      camera: 'camera-001',
      doorbell: 'doorbell-001',
      lockbox: null,
      weatherProtected: true,
      lightingAvailable: true,
      defaultZone: true
    });
    
    this.deliveryZones.set('zone-002', {
      id: 'zone-002',
      name: 'Garage',
      type: 'secure',
      description: 'Inside garage via smart lock',
      camera: 'camera-002',
      doorbell: null,
      lockbox: 'lockbox-001',
      accessCode: '1234',
      weatherProtected: true,
      lightingAvailable: true,
      defaultZone: false
    });
    
    this.deliveryZones.set('zone-003', {
      id: 'zone-003',
      name: 'Back Porch',
      type: 'alternative',
      description: 'Covered back entrance',
      camera: 'camera-003',
      doorbell: null,
      lockbox: null,
      weatherProtected: true,
      lightingAvailable: false,
      defaultZone: false
    });
    
    // Carriers
    this.carriers.set('postnord', {
      id: 'postnord',
      name: 'PostNord',
      website: 'https://www.postnord.se',
      trackingUrl: 'https://www.postnord.se/track',
      contactPhone: '+4677188000',
      serviceLevel: 'standard',
      averageRating: 3.5
    });
    
    this.carriers.set('dhl', {
      id: 'dhl',
      name: 'DHL Express',
      website: 'https://www.dhl.se',
      trackingUrl: 'https://www.dhl.com/track',
      contactPhone: '+46771345345',
      serviceLevel: 'express',
      averageRating: 4.2
    });
    
    this.carriers.set('ups', {
      id: 'ups',
      name: 'UPS',
      website: 'https://www.ups.com',
      trackingUrl: 'https://www.ups.com/track',
      contactPhone: '+46207810020',
      serviceLevel: 'standard',
      averageRating: 4.0
    });
    
    // Storage locations
    this.storageLocations.set('storage-001', {
      id: 'storage-001',
      name: 'Parcel Locker',
      type: 'lockbox',
      location: 'garage',
      capacity: 3,
      occupied: 1,
      smartLock: 'lock-001',
      temperature: 18,
      humidity: 45,
      status: 'available'
    });
    
    this.storageLocations.set('storage-002', {
      id: 'storage-002',
      name: 'Front Door Storage',
      type: 'open',
      location: 'front-door',
      capacity: 5,
      occupied: 1,
      smartLock: null,
      weatherProtected: true,
      status: 'available'
    });
    
    // Delivery instructions
    this.deliveryInstructions.set('default', {
      id: 'default',
      carrier: 'all',
      instructions: 'Please leave packages at front door. Ring doorbell if signature required.',
      preferredZone: 'zone-001',
      accessCode: null,
      specialInstructions: 'Beware of friendly dog'
    });
    
    this.deliveryInstructions.set('heavy-items', {
      id: 'heavy-items',
      carrier: 'all',
      instructions: 'Heavy items should be placed in garage. Access code provided separately.',
      preferredZone: 'zone-002',
      accessCode: '1234',
      specialInstructions: 'Call before delivery'
    });
  }
  
  async initialize() {
    try {
      await this.loadSettings();
      this.startMonitoring();
      
      this.emit('notification', {
        type: 'info',
        priority: 'low',
        title: 'Package Delivery System',
        message: `Tracking ${this.packages.size} package(s)`
      });
      
      return { success: true, packages: this.packages.size };
    } catch (error) {
      this.emit('notification', {
        type: 'error',
        priority: 'high',
        title: 'Delivery System Error',
        message: `Failed to initialize: ${error.message}`
      });
      throw error;
    }
  }
  
  async addPackage(trackingNumber, carrier, details = {}) {
    const packageId = `pkg-${Date.now()}`;
    
    const newPackage = {
      id: packageId,
      trackingNumber,
      carrier,
      sender: details.sender || 'Unknown',
      status: 'in-transit',
      estimatedDelivery: details.estimatedDelivery || Date.now() + 3 * 24 * 60 * 60 * 1000,
      description: details.description || 'Package',
      weight: details.weight || 0,
      dimensions: details.dimensions || { length: 0, width: 0, height: 0 },
      requiresSignature: details.requiresSignature || false,
      insured: details.insured || false,
      value: details.value || 0,
      deliveryAttempts: 0,
      lastUpdate: Date.now(),
      trackingHistory: [
        { timestamp: Date.now(), status: 'registered', location: 'System' }
      ]
    };
    
    this.packages.set(packageId, newPackage);
    
    this.emit('notification', {
      type: 'info',
      priority: 'medium',
      title: '📦 New Package Added',
      message: `Tracking: ${trackingNumber} from ${newPackage.sender}`
    });
    
    await this.saveSettings();
    this.clearCache();
    
    return { success: true, packageId, package: newPackage };
  }
  
  async updatePackageStatus(packageId, status, location = null) {
    const pkg = this.packages.get(packageId);
    if (!pkg) throw new Error(`Package ${packageId} not found`);
    
    const oldStatus = pkg.status;
    pkg.status = status;
    pkg.lastUpdate = Date.now();
    
    pkg.trackingHistory.push({
      timestamp: Date.now(),
      status,
      location: location || 'Unknown'
    });
    
    // Handle delivery
    if (status === 'delivered') {
      pkg.actualDelivery = Date.now();
      this.statistics.successfulDeliveries++;
      
      // Assign to default storage
      pkg.storageLocation = 'storage-002';
      
      this.emit('notification', {
        type: 'success',
        priority: 'high',
        title: '✅ Package Delivered',
        message: `${pkg.description} from ${pkg.sender} has been delivered`
      });
      
      // Trigger camera recording if enabled
      if (this.settings.cameraRecordingEnabled) {
        // Would integrate with camera system here
      }
    } else if (status === 'delivery-failed') {
      pkg.deliveryAttempts++;
      this.statistics.missedDeliveries++;
      
      this.emit('notification', {
        type: 'warning',
        priority: 'high',
        title: '⚠️ Delivery Failed',
        message: `Failed to deliver ${pkg.description}. Attempt ${pkg.deliveryAttempts}`
      });
    } else if (status === 'out-for-delivery') {
      this.emit('notification', {
        type: 'info',
        priority: 'high',
        title: '🚚 Out for Delivery',
        message: `${pkg.description} from ${pkg.sender} is out for delivery`
      });
    }
    
    await this.saveSettings();
    this.clearCache();
    
    return { success: true, oldStatus, newStatus: status };
  }
  
  async schedulePickup(packageId, pickupTime) {
    const pkg = this.packages.get(packageId);
    if (!pkg) throw new Error(`Package ${packageId} not found`);
    
    if (pkg.status !== 'awaiting-pickup') {
      throw new Error('Package is not awaiting pickup');
    }
    
    pkg.scheduledPickup = pickupTime;
    
    this.emit('notification', {
      type: 'info',
      priority: 'medium',
      title: 'Pickup Scheduled',
      message: `Pickup scheduled for ${new Date(pickupTime).toLocaleString()}`
    });
    
    await this.saveSettings();
    return { success: true, pickupTime };
  }
  
  getDeliveryStatistics() {
    const cached = this.getCached('delivery-stats');
    if (cached) return cached;
    
    const packages = Array.from(this.packages.values());
    const activePackages = packages.filter(p => 
      !['delivered', 'cancelled', 'returned'].includes(p.status)
    );
    
    const deliveredToday = packages.filter(p => 
      p.status === 'delivered' && 
      p.actualDelivery && 
      Date.now() - p.actualDelivery < 24 * 60 * 60 * 1000
    ).length;
    
    const expectedToday = packages.filter(p => 
      p.estimatedDelivery && 
      p.estimatedDelivery < Date.now() + 24 * 60 * 60 * 1000 &&
      p.estimatedDelivery > Date.now()
    ).length;
    
    const stats = {
      active: {
        total: activePackages.length,
        inTransit: activePackages.filter(p => p.status === 'in-transit').length,
        outForDelivery: activePackages.filter(p => p.status === 'out-for-delivery').length,
        awaitingPickup: activePackages.filter(p => p.status === 'awaiting-pickup').length
      },
      today: {
        delivered: deliveredToday,
        expected: expectedToday
      },
      lifetime: {
        ...this.statistics,
        successRate: this.statistics.totalDeliveries > 0 
          ? Math.round((this.statistics.successfulDeliveries / this.statistics.totalDeliveries) * 100)
          : 0
      },
      storage: {
        locations: this.storageLocations.size,
        available: Array.from(this.storageLocations.values())
          .filter(s => s.status === 'available').length,
        occupied: Array.from(this.storageLocations.values())
          .reduce((sum, s) => sum + (s.occupied || 0), 0)
      },
      carriers: {
        total: this.carriers.size,
        activeCarriers: [...new Set(packages.map(p => p.carrier))].length
      }
    };
    
    this.setCached('delivery-stats', stats);
    return stats;
  }
  
  getPackagesByStatus(status) {
    return Array.from(this.packages.values()).filter(p => p.status === status);
  }
  
  getExpectedDeliveries(timeframe = 24) {
    const cutoff = Date.now() + timeframe * 60 * 60 * 1000;
    return Array.from(this.packages.values()).filter(p => 
      p.estimatedDelivery && 
      p.estimatedDelivery < cutoff &&
      !['delivered', 'cancelled', 'returned'].includes(p.status)
    );
  }
  
  startMonitoring() {
    if (this.monitoring.interval) clearInterval(this.monitoring.interval);
    this.monitoring.interval = setInterval(() => this.monitorDeliveries(), this.monitoring.checkInterval);
  }
  
  monitorDeliveries() {
    this.monitoring.lastCheck = Date.now();
    
    // Check for packages expected today
    const expectedToday = this.getExpectedDeliveries(24);
    
    for (const pkg of expectedToday) {
      const hoursUntilDelivery = (pkg.estimatedDelivery - Date.now()) / (60 * 60 * 1000);
      
      if (hoursUntilDelivery < 2 && pkg.status !== 'out-for-delivery') {
        this.emit('notification', {
          type: 'info',
          priority: 'medium',
          title: 'Package Arriving Soon',
          message: `${pkg.description} expected within 2 hours`
        });
      }
    }
    
    // Check for overdue packages
    for (const [id, pkg] of this.packages) {
      if (pkg.status === 'in-transit' && pkg.estimatedDelivery < Date.now()) {
        const daysOverdue = (Date.now() - pkg.estimatedDelivery) / (24 * 60 * 60 * 1000);
        
        if (daysOverdue > 1) {
          this.emit('notification', {
            type: 'warning',
            priority: 'medium',
            title: 'Package Delayed',
            message: `${pkg.description} is ${Math.floor(daysOverdue)} day(s) overdue`
          });
        }
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
      const settings = Homey.ManagerSettings.get('advancedPackageDeliveryManagementSystem');
      if (settings) {
        this.packages = new Map(settings.packages || []);
        this.deliveryZones = new Map(settings.deliveryZones || []);
        this.deliveryInstructions = new Map(settings.deliveryInstructions || []);
        this.carriers = new Map(settings.carriers || []);
        this.storageLocations = new Map(settings.storageLocations || []);
        Object.assign(this.settings, settings.settings || {});
        Object.assign(this.statistics, settings.statistics || {});
      }
    } catch (error) {
      console.error('Failed to load package delivery settings:', error);
    }
  }
  
  async saveSettings() {
    try {
      const settings = {
        packages: Array.from(this.packages.entries()),
        deliveryZones: Array.from(this.deliveryZones.entries()),
        deliveryInstructions: Array.from(this.deliveryInstructions.entries()),
        carriers: Array.from(this.carriers.entries()),
        storageLocations: Array.from(this.storageLocations.entries()),
        settings: this.settings,
        statistics: this.statistics
      };
      Homey.ManagerSettings.set('advancedPackageDeliveryManagementSystem', settings);
    } catch (error) {
      console.error('Failed to save package delivery settings:', error);
      throw error;
    }
  }
  
  getPackages() { return Array.from(this.packages.values()); }
  getDeliveryZones() { return Array.from(this.deliveryZones.values()); }
  getCarriers() { return Array.from(this.carriers.values()); }
  getStorageLocations() { return Array.from(this.storageLocations.values()); }
}

module.exports = AdvancedPackageDeliveryManagementSystem;
