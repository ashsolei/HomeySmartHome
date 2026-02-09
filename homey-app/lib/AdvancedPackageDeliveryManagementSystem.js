'use strict';

const EventEmitter = require('events');

class AdvancedPackageDeliveryManagementSystem extends EventEmitter {
  constructor(homey) {
    super();
    this.homey = homey;
    this.initialized = false;
    this.intervals = [];

    // Multi-carrier configuration
    this.carriers = {
      'postnord': {
        name: 'PostNord',
        trackingUrlPattern: 'https://tracking.postnord.com/tracking?id={tracking}',
        averageDeliveryDays: 2,
        reliabilityScore: 0.87,
        supportedServices: ['standard', 'express', 'home-delivery', 'service-point', 'mailbox'],
        contactNumber: '+46 08-23 22 20',
        driverInstructions: 'Gate code 4521. Leave at front door if no answer.',
        returnDropoff: 'Nearest PostNord service point'
      },
      'dhl': {
        name: 'DHL',
        trackingUrlPattern: 'https://www.dhl.com/se-en/home/tracking.html?tracking-id={tracking}',
        averageDeliveryDays: 3,
        reliabilityScore: 0.91,
        supportedServices: ['express', 'economy', 'freight', 'parcel', 'international'],
        contactNumber: '+46 0771-345 345',
        driverInstructions: 'Ring doorbell twice. Porch box on left side.',
        returnDropoff: 'DHL Service Point or scheduled pickup'
      },
      'ups': {
        name: 'UPS',
        trackingUrlPattern: 'https://www.ups.com/track?tracknum={tracking}',
        averageDeliveryDays: 3,
        reliabilityScore: 0.93,
        supportedServices: ['next-day-air', 'ground', '2nd-day-air', 'worldwide-express', 'standard'],
        contactNumber: '+46 020-960 960',
        driverInstructions: 'Side entrance accessible. Leave with neighbor at #12 if absent.',
        returnDropoff: 'UPS Access Point or scheduled pickup'
      },
      'instabox': {
        name: 'Instabox',
        trackingUrlPattern: 'https://www.instabox.io/track/{tracking}',
        averageDeliveryDays: 1,
        reliabilityScore: 0.89,
        supportedServices: ['locker', 'home-delivery', 'same-day', 'next-day'],
        contactNumber: '+46 08-525 058 00',
        driverInstructions: 'Locker pickup preferred. Home delivery: use back entrance.',
        returnDropoff: 'Any Instabox locker location'
      },
      'budbee': {
        name: 'Budbee',
        trackingUrlPattern: 'https://app.budbee.com/tracking/{tracking}',
        averageDeliveryDays: 1,
        reliabilityScore: 0.86,
        supportedServices: ['home-delivery', 'box', 'evening-delivery', 'weekend'],
        contactNumber: '+46 08-410 898 00',
        driverInstructions: 'Evening delivery preferred. Gate code 4521.',
        returnDropoff: 'Budbee box or scheduled home pickup'
      },
      'amazon': {
        name: 'Amazon Logistics',
        trackingUrlPattern: 'https://www.amazon.se/gp/css/shiptrack/view.html?trackId={tracking}',
        averageDeliveryDays: 2,
        reliabilityScore: 0.84,
        supportedServices: ['standard', 'prime', 'same-day', 'scheduled', 'locker'],
        contactNumber: '+46 020-108 8000',
        driverInstructions: 'Photo verification required. Leave at porch box.',
        returnDropoff: 'Amazon locker or PostNord service point'
      },
      'fedex': {
        name: 'FedEx',
        trackingUrlPattern: 'https://www.fedex.com/fedextrack/?trknbr={tracking}',
        averageDeliveryDays: 4,
        reliabilityScore: 0.92,
        supportedServices: ['international-priority', 'international-economy', 'ground', 'freight', 'express-saver'],
        contactNumber: '+46 020-252 252',
        driverInstructions: 'Business entrance on weekdays. Side door on weekends.',
        returnDropoff: 'FedEx drop-off location or scheduled pickup'
      },
      'schenker': {
        name: 'DB Schenker',
        trackingUrlPattern: 'https://www.dbschenker.com/se-en/tracking/{tracking}',
        averageDeliveryDays: 4,
        reliabilityScore: 0.88,
        supportedServices: ['parcel', 'pallet', 'part-load', 'full-load', 'system-freight'],
        contactNumber: '+46 010-510 50 00',
        driverInstructions: 'Large deliveries: use garage entrance. Call 30 min before arrival.',
        returnDropoff: 'Schenker terminal or scheduled pickup'
      }
    };

    // Package lifecycle states
    this.packageStates = [
      'ordered', 'confirmed', 'shipped', 'in-transit', 'customs',
      'out-for-delivery', 'delivered', 'attempted', 'returned', 'lost'
    ];

    // State transition rules
    this.validTransitions = {
      'ordered': ['confirmed', 'cancelled'],
      'confirmed': ['shipped', 'cancelled'],
      'shipped': ['in-transit', 'customs'],
      'in-transit': ['out-for-delivery', 'customs', 'attempted', 'lost'],
      'customs': ['in-transit', 'returned'],
      'out-for-delivery': ['delivered', 'attempted'],
      'delivered': ['returned'],
      'attempted': ['out-for-delivery', 'returned', 'lost'],
      'returned': [],
      'lost': []
    };

    // Smart delivery points
    this.deliveryPoints = {
      'mailbox': {
        name: 'Smart Mailbox',
        type: 'mailbox',
        capacity: 5,
        maxPackageSize: 'small',
        secured: true,
        weatherproof: true,
        cameraEnabled: false,
        pinProtected: false,
        currentItems: 0,
        location: 'Front of house, street level'
      },
      'parcel-locker': {
        name: 'Parcel Locker',
        type: 'parcel-locker',
        capacity: 8,
        maxPackageSize: 'large',
        secured: true,
        weatherproof: true,
        cameraEnabled: true,
        pinProtected: true,
        currentPin: '7823',
        currentItems: 0,
        location: 'Garage entrance, right side'
      },
      'porch-box': {
        name: 'Porch Box',
        type: 'porch-box',
        capacity: 3,
        maxPackageSize: 'medium',
        secured: true,
        weatherproof: true,
        cameraEnabled: false,
        pinProtected: false,
        currentItems: 0,
        location: 'Front porch, covered area'
      },
      'smart-doorbell': {
        name: 'Smart Doorbell',
        type: 'smart-doorbell',
        capacity: 0,
        maxPackageSize: null,
        secured: false,
        weatherproof: false,
        cameraEnabled: true,
        pinProtected: false,
        currentItems: 0,
        location: 'Main entrance'
      }
    };

    // Package size categories
    this.sizeCategories = {
      'letter': { maxWeight: 0.5, maxDimensions: { l: 35, w: 25, h: 3 }, label: 'Letter' },
      'small': { maxWeight: 2, maxDimensions: { l: 40, w: 30, h: 10 }, label: 'Small Package' },
      'medium': { maxWeight: 10, maxDimensions: { l: 60, w: 40, h: 30 }, label: 'Medium Package' },
      'large': { maxWeight: 30, maxDimensions: { l: 120, w: 60, h: 60 }, label: 'Large Package' },
      'oversized': { maxWeight: 100, maxDimensions: { l: 250, w: 120, h: 120 }, label: 'Oversized' }
    };

    // Delivery time window preferences
    this.deliveryWindows = {
      'morning': { start: 8, end: 12, label: 'Morning (08:00-12:00)', preferred: false },
      'afternoon': { start: 12, end: 17, label: 'Afternoon (12:00-17:00)', preferred: true },
      'evening': { start: 17, end: 21, label: 'Evening (17:00-21:00)', preferred: true }
    };

    // Storage location preferences (ranked)
    this.storagePreferences = [
      { location: 'parcel-locker', priority: 1, reason: 'Most secure, PIN-protected' },
      { location: 'porch-box', priority: 2, reason: 'Weatherproof, easy access' },
      { location: 'mailbox', priority: 3, reason: 'Good for small items' },
      { location: 'smart-doorbell', priority: 4, reason: 'Camera-enabled, leave at door' }
    ];

    // Insurance configuration
    this.insuranceConfig = {
      valueThreshold: 500,
      currency: 'SEK',
      autoInsure: true,
      premiumRate: 0.02,
      maxCoverage: 50000,
      provider: 'Trygg-Hansa Home Insurance'
    };

    // Community package acceptance
    this.communityNetwork = {
      enabled: true,
      neighbors: [
        { id: 'neighbor-1', name: 'Erik Svensson', address: 'Storgatan 12', trustLevel: 'high', acceptingPackages: true },
        { id: 'neighbor-2', name: 'Anna Lindqvist', address: 'Storgatan 14', trustLevel: 'high', acceptingPackages: true },
        { id: 'neighbor-3', name: 'Lars Johansson', address: 'Storgatan 16', trustLevel: 'medium', acceptingPackages: false }
      ],
      acceptForNeighbors: true,
      maxHoldDays: 3,
      heldPackages: []
    };

    // Recurring deliveries / subscriptions
    this.recurringDeliveries = [];

    // Theft prevention configuration
    this.theftPrevention = {
      motionDetectionEnabled: true,
      cameraTriggerOnDelivery: true,
      suspiciousActivityAlerts: true,
      motionSensitivityThreshold: 0.7,
      alertCooldownMinutes: 15,
      lastAlertTime: null,
      incidentLog: []
    };

    // Customs tracking configuration
    this.customsConfig = {
      homeCountry: 'SE',
      euMember: true,
      vatRate: 0.25,
      dutyFreeThresholdEU: 0,
      dutyFreeThresholdNonEU: 1600,
      customsBroker: 'PostNord Customs Service'
    };

    // Package database
    this.packages = new Map();
    this.deliveryHistory = [];
    this.monthlyAnalytics = {};
  }

  async initialize() {
    try {
      this.homey.log('[PackageDelivery] Initializing Advanced Package Delivery Management System...');

      await this._loadSamplePackages();
      await this._loadRecurringDeliveries();
      await this._initializeMonthlyAnalytics();

      this._startTrackingInterval();
      this._startDeliveryNotificationInterval();
      this._startTemperatureMonitorInterval();
      this._startTheftPreventionInterval();
      this._startRecurringDeliveryCheckInterval();
      this._startAnalyticsAggregationInterval();

      this.initialized = true;
      this.homey.log('[PackageDelivery] System initialized successfully');
      this.homey.log('[PackageDelivery] Tracking ' + this.packages.size + ' active packages');
      this.homey.log('[PackageDelivery] ' + Object.keys(this.carriers).length + ' carriers configured');
      this.homey.log('[PackageDelivery] ' + this.recurringDeliveries.length + ' recurring deliveries active');
      this.homey.emit('package-delivery:initialized', { packageCount: this.packages.size });
    } catch (err) {
      this.homey.error('[PackageDelivery] Initialization failed:', err.message);
      this.initialized = false;
    }
  }

  async _loadSamplePackages() {
    var now = Date.now();
    var day = 86400000;

    var samplePackages = [
      {
        trackingNumber: 'PN-SE-2026-001482',
        carrier: 'postnord',
        sender: 'IKEA Online',
        description: 'KALLAX shelf unit, white',
        weight: 22.5,
        dimensions: { l: 112, w: 42, h: 39 },
        sizeCategory: 'large',
        value: 899,
        currency: 'SEK',
        insurance: true,
        requiresSignature: false,
        temperatureSensitive: false,
        fragile: false,
        status: 'in-transit',
        statusHistory: [
          { status: 'ordered', timestamp: now - 5 * day, note: 'Order placed on ikea.se' },
          { status: 'confirmed', timestamp: now - 4 * day, note: 'Order confirmed' },
          { status: 'shipped', timestamp: now - 3 * day, note: 'Shipped from warehouse' },
          { status: 'in-transit', timestamp: now - 1 * day, note: 'At PostNord sorting facility' }
        ],
        estimatedDelivery: new Date(now + 1 * day).toISOString(),
        actualDelivery: null,
        deliveryLocation: null,
        photoVerified: false,
        photoTimestamp: null,
        recipientName: 'Household',
        deliveryWindow: 'afternoon',
        origin: 'SE',
        isInternational: false
      },
      {
        trackingNumber: 'DHL-4829173650',
        carrier: 'dhl',
        sender: 'Zalando',
        description: 'Winter jacket and boots',
        weight: 3.2,
        dimensions: { l: 50, w: 35, h: 20 },
        sizeCategory: 'medium',
        value: 2450,
        currency: 'SEK',
        insurance: true,
        requiresSignature: false,
        temperatureSensitive: false,
        fragile: false,
        status: 'out-for-delivery',
        statusHistory: [
          { status: 'ordered', timestamp: now - 4 * day, note: 'Ordered from Zalando' },
          { status: 'confirmed', timestamp: now - 3 * day, note: 'Payment confirmed' },
          { status: 'shipped', timestamp: now - 2 * day, note: 'Shipped from Berlin warehouse' },
          { status: 'in-transit', timestamp: now - 1 * day, note: 'Arrived in Sweden' },
          { status: 'out-for-delivery', timestamp: now - 2 * 3600000, note: 'Out for delivery with DHL driver' }
        ],
        estimatedDelivery: new Date(now).toISOString(),
        actualDelivery: null,
        deliveryLocation: null,
        photoVerified: false,
        photoTimestamp: null,
        recipientName: 'Household',
        deliveryWindow: 'morning',
        origin: 'DE',
        isInternational: false
      },
      {
        trackingNumber: '1Z999AA10123456784',
        carrier: 'ups',
        sender: 'Amazon.com',
        description: 'Electronics: Raspberry Pi 5 starter kit',
        weight: 0.8,
        dimensions: { l: 25, w: 20, h: 10 },
        sizeCategory: 'small',
        value: 1200,
        currency: 'SEK',
        insurance: true,
        requiresSignature: true,
        temperatureSensitive: false,
        fragile: true,
        status: 'customs',
        statusHistory: [
          { status: 'ordered', timestamp: now - 7 * day, note: 'Ordered from Amazon.com' },
          { status: 'confirmed', timestamp: now - 6 * day, note: 'Shipped from US warehouse' },
          { status: 'shipped', timestamp: now - 5 * day, note: 'Left Los Angeles sorting center' },
          { status: 'in-transit', timestamp: now - 3 * day, note: 'Arrived at Cologne hub' },
          { status: 'customs', timestamp: now - 1 * day, note: 'Held at Swedish customs, Arlanda' }
        ],
        estimatedDelivery: new Date(now + 3 * day).toISOString(),
        actualDelivery: null,
        deliveryLocation: null,
        photoVerified: false,
        photoTimestamp: null,
        recipientName: 'Household',
        deliveryWindow: 'afternoon',
        origin: 'US',
        isInternational: true,
        customsInfo: {
          declarationType: 'personal',
          declaredValue: 95,
          declaredCurrency: 'USD',
          hsCode: '8471.41',
          estimatedDuty: 0,
          estimatedVAT: 300,
          customsStatus: 'under-review',
          customsReference: 'SE-CUST-2026-88321'
        }
      },
      {
        trackingNumber: 'IB-7291034',
        carrier: 'instabox',
        sender: 'Apotea',
        description: 'Vitamins and supplements',
        weight: 1.1,
        dimensions: { l: 30, w: 20, h: 15 },
        sizeCategory: 'small',
        value: 389,
        currency: 'SEK',
        insurance: false,
        requiresSignature: false,
        temperatureSensitive: true,
        fragile: false,
        status: 'delivered',
        statusHistory: [
          { status: 'ordered', timestamp: now - 3 * day, note: 'Ordered from Apotea' },
          { status: 'confirmed', timestamp: now - 3 * day, note: 'Order confirmed' },
          { status: 'shipped', timestamp: now - 2 * day, note: 'Shipped from Apotea warehouse' },
          { status: 'in-transit', timestamp: now - 1 * day, note: 'At Instabox sorting center' },
          { status: 'out-for-delivery', timestamp: now - 12 * 3600000, note: 'Loaded for delivery' },
          { status: 'delivered', timestamp: now - 8 * 3600000, note: 'Delivered to Instabox locker' }
        ],
        estimatedDelivery: new Date(now - 1 * day).toISOString(),
        actualDelivery: new Date(now - 8 * 3600000).toISOString(),
        deliveryLocation: 'parcel-locker',
        photoVerified: true,
        photoTimestamp: new Date(now - 8 * 3600000).toISOString(),
        recipientName: 'Household',
        deliveryWindow: 'morning',
        origin: 'SE',
        isInternational: false
      },
      {
        trackingNumber: 'BB-SE-993827',
        carrier: 'budbee',
        sender: 'MatHem',
        description: 'Weekly grocery delivery',
        weight: 12.5,
        dimensions: { l: 55, w: 40, h: 35 },
        sizeCategory: 'medium',
        value: 750,
        currency: 'SEK',
        insurance: true,
        requiresSignature: false,
        temperatureSensitive: true,
        fragile: true,
        status: 'shipped',
        statusHistory: [
          { status: 'ordered', timestamp: now - 1 * day, note: 'Weekly grocery order' },
          { status: 'confirmed', timestamp: now - 1 * day, note: 'Order packed' },
          { status: 'shipped', timestamp: now - 6 * 3600000, note: 'Out from MatHem warehouse' }
        ],
        estimatedDelivery: new Date(now + 4 * 3600000).toISOString(),
        actualDelivery: null,
        deliveryLocation: null,
        photoVerified: false,
        photoTimestamp: null,
        recipientName: 'Household',
        deliveryWindow: 'evening',
        origin: 'SE',
        isInternational: false
      },
      {
        trackingNumber: 'AMZ-SE-TBA930482917',
        carrier: 'amazon',
        sender: 'Amazon.se',
        description: 'Smart home sensors (3-pack)',
        weight: 0.4,
        dimensions: { l: 22, w: 15, h: 8 },
        sizeCategory: 'small',
        value: 499,
        currency: 'SEK',
        insurance: false,
        requiresSignature: false,
        temperatureSensitive: false,
        fragile: true,
        status: 'confirmed',
        statusHistory: [
          { status: 'ordered', timestamp: now - 1 * day, note: 'Ordered on Amazon.se' },
          { status: 'confirmed', timestamp: now - 12 * 3600000, note: 'Preparing for shipment' }
        ],
        estimatedDelivery: new Date(now + 2 * day).toISOString(),
        actualDelivery: null,
        deliveryLocation: null,
        photoVerified: false,
        photoTimestamp: null,
        recipientName: 'Household',
        deliveryWindow: 'afternoon',
        origin: 'SE',
        isInternational: false
      },
      {
        trackingNumber: 'FX-7483920156',
        carrier: 'fedex',
        sender: 'Thomann Music',
        description: 'Guitar strings and accessories',
        weight: 0.6,
        dimensions: { l: 30, w: 22, h: 5 },
        sizeCategory: 'small',
        value: 680,
        currency: 'SEK',
        insurance: true,
        requiresSignature: false,
        temperatureSensitive: false,
        fragile: false,
        status: 'in-transit',
        statusHistory: [
          { status: 'ordered', timestamp: now - 5 * day, note: 'Ordered from Thomann.de' },
          { status: 'confirmed', timestamp: now - 4 * day, note: 'Shipped from Germany' },
          { status: 'shipped', timestamp: now - 3 * day, note: 'Left Treppendorf warehouse' },
          { status: 'in-transit', timestamp: now - 1 * day, note: 'At FedEx hub, Copenhagen' }
        ],
        estimatedDelivery: new Date(now + 1 * day).toISOString(),
        actualDelivery: null,
        deliveryLocation: null,
        photoVerified: false,
        photoTimestamp: null,
        recipientName: 'Household',
        deliveryWindow: 'afternoon',
        origin: 'DE',
        isInternational: false
      },
      {
        trackingNumber: 'SCH-SE-20260145',
        carrier: 'schenker',
        sender: 'Jula',
        description: 'Garden tool set and storage box',
        weight: 18.0,
        dimensions: { l: 95, w: 50, h: 45 },
        sizeCategory: 'large',
        value: 1250,
        currency: 'SEK',
        insurance: true,
        requiresSignature: true,
        temperatureSensitive: false,
        fragile: false,
        status: 'shipped',
        statusHistory: [
          { status: 'ordered', timestamp: now - 3 * day, note: 'Ordered from Jula.se' },
          { status: 'confirmed', timestamp: now - 2 * day, note: 'Order confirmed' },
          { status: 'shipped', timestamp: now - 1 * day, note: 'Shipped from Jula warehouse, Skara' }
        ],
        estimatedDelivery: new Date(now + 2 * day).toISOString(),
        actualDelivery: null,
        deliveryLocation: null,
        photoVerified: false,
        photoTimestamp: null,
        recipientName: 'Household',
        deliveryWindow: 'morning',
        origin: 'SE',
        isInternational: false
      },
      {
        trackingNumber: 'PN-SE-2026-002910',
        carrier: 'postnord',
        sender: 'Wish.com',
        description: 'Phone accessories bundle',
        weight: 0.3,
        dimensions: { l: 20, w: 15, h: 5 },
        sizeCategory: 'letter',
        value: 180,
        currency: 'SEK',
        insurance: false,
        requiresSignature: false,
        temperatureSensitive: false,
        fragile: false,
        status: 'customs',
        statusHistory: [
          { status: 'ordered', timestamp: now - 20 * day, note: 'Ordered from Wish' },
          { status: 'confirmed', timestamp: now - 19 * day, note: 'Seller shipped' },
          { status: 'shipped', timestamp: now - 18 * day, note: 'Left origin country' },
          { status: 'in-transit', timestamp: now - 10 * day, note: 'In transit to Sweden' },
          { status: 'customs', timestamp: now - 3 * day, note: 'At Swedish customs' }
        ],
        estimatedDelivery: new Date(now + 5 * day).toISOString(),
        actualDelivery: null,
        deliveryLocation: null,
        photoVerified: false,
        photoTimestamp: null,
        recipientName: 'Household',
        deliveryWindow: 'afternoon',
        origin: 'CN',
        isInternational: true,
        customsInfo: {
          declarationType: 'personal',
          declaredValue: 15,
          declaredCurrency: 'USD',
          hsCode: '8517.79',
          estimatedDuty: 28,
          estimatedVAT: 45,
          customsStatus: 'processing',
          customsReference: 'SE-CUST-2026-91042'
        }
      },
      {
        trackingNumber: 'DHL-9381726450',
        carrier: 'dhl',
        sender: 'Adlibris',
        description: 'Book: Advanced Home Automation Guide',
        weight: 0.9,
        dimensions: { l: 28, w: 22, h: 4 },
        sizeCategory: 'small',
        value: 349,
        currency: 'SEK',
        insurance: false,
        requiresSignature: false,
        temperatureSensitive: false,
        fragile: false,
        status: 'attempted',
        statusHistory: [
          { status: 'ordered', timestamp: now - 4 * day, note: 'Ordered from Adlibris' },
          { status: 'confirmed', timestamp: now - 3 * day, note: 'Order confirmed' },
          { status: 'shipped', timestamp: now - 2 * day, note: 'Shipped from warehouse' },
          { status: 'in-transit', timestamp: now - 1 * day, note: 'At local DHL depot' },
          { status: 'out-for-delivery', timestamp: now - 6 * 3600000, note: 'Out for delivery' },
          { status: 'attempted', timestamp: now - 4 * 3600000, note: 'Delivery attempted, no one home' }
        ],
        estimatedDelivery: new Date(now - 1 * day).toISOString(),
        actualDelivery: null,
        deliveryLocation: null,
        photoVerified: false,
        photoTimestamp: null,
        recipientName: 'Household',
        deliveryWindow: 'morning',
        origin: 'SE',
        isInternational: false
      }
    ];

    for (var i = 0; i < samplePackages.length; i++) {
      var pkg = samplePackages[i];
      pkg.id = pkg.trackingNumber;
      pkg.createdAt = pkg.statusHistory[0].timestamp;
      pkg.updatedAt = pkg.statusHistory[pkg.statusHistory.length - 1].timestamp;
      this.packages.set(pkg.trackingNumber, pkg);

      if (pkg.status === 'delivered') {
        this.deliveryHistory.push(Object.assign({}, pkg));
      }
    }

    this.homey.log('[PackageDelivery] Loaded ' + samplePackages.length + ' sample packages');
  }

  async _loadRecurringDeliveries() {
    var now = Date.now();
    var day = 86400000;

    this.recurringDeliveries = [
      {
        id: 'recurring-1',
        name: 'HelloFresh Meal Kit',
        type: 'meal-kit',
        carrier: 'budbee',
        frequency: 'weekly',
        cost: 599,
        currency: 'SEK',
        nextDelivery: new Date(now + 3 * day).toISOString(),
        lastDelivery: new Date(now - 4 * day).toISOString(),
        active: true,
        temperatureSensitive: true,
        deliveryWindow: 'evening',
        totalDeliveries: 24,
        missedDeliveries: 1
      },
      {
        id: 'recurring-2',
        name: 'Apotea Pharmacy Monthly',
        type: 'pharmacy',
        carrier: 'postnord',
        frequency: 'monthly',
        cost: 245,
        currency: 'SEK',
        nextDelivery: new Date(now + 18 * day).toISOString(),
        lastDelivery: new Date(now - 12 * day).toISOString(),
        active: true,
        temperatureSensitive: true,
        deliveryWindow: 'morning',
        totalDeliveries: 8,
        missedDeliveries: 0
      },
      {
        id: 'recurring-3',
        name: 'ICA Weekly Groceries',
        type: 'weekly-groceries',
        carrier: 'instabox',
        frequency: 'weekly',
        cost: 850,
        currency: 'SEK',
        nextDelivery: new Date(now + 5 * day).toISOString(),
        lastDelivery: new Date(now - 2 * day).toISOString(),
        active: true,
        temperatureSensitive: true,
        deliveryWindow: 'afternoon',
        totalDeliveries: 42,
        missedDeliveries: 2
      },
      {
        id: 'recurring-4',
        name: 'Illustrerad Vetenskap Magazine',
        type: 'magazine',
        carrier: 'postnord',
        frequency: 'monthly',
        cost: 79,
        currency: 'SEK',
        nextDelivery: new Date(now + 22 * day).toISOString(),
        lastDelivery: new Date(now - 8 * day).toISOString(),
        active: true,
        temperatureSensitive: false,
        deliveryWindow: 'morning',
        totalDeliveries: 14,
        missedDeliveries: 0
      }
    ];

    this.homey.log('[PackageDelivery] Loaded ' + this.recurringDeliveries.length + ' recurring deliveries');
  }

  async _initializeMonthlyAnalytics() {
    var now = new Date();
    var monthKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

    this.monthlyAnalytics[monthKey] = {
      totalPackages: 0,
      deliveredPackages: 0,
      returnedPackages: 0,
      lostPackages: 0,
      totalValue: 0,
      totalInsurancePremiums: 0,
      carrierBreakdown: {},
      onTimeDeliveries: 0,
      lateDeliveries: 0,
      averageDeliveryDays: 0,
      deliveryDaysTotal: 0,
      customsDutiesPaid: 0,
      internationalPackages: 0,
      temperatureSensitiveCount: 0,
      signatureRequiredCount: 0
    };

    var allPkgs = Array.from(this.packages.values());
    for (var i = 0; i < allPkgs.length; i++) {
      this._updateAnalyticsForPackage(monthKey, allPkgs[i]);
    }

    this.homey.log('[PackageDelivery] Monthly analytics initialized for ' + monthKey);
  }

  _updateAnalyticsForPackage(monthKey, pkg) {
    if (!this.monthlyAnalytics[monthKey]) return;
    var analytics = this.monthlyAnalytics[monthKey];

    analytics.totalPackages += 1;
    analytics.totalValue += pkg.value || 0;

    if (pkg.insurance && pkg.value > this.insuranceConfig.valueThreshold) {
      analytics.totalInsurancePremiums += pkg.value * this.insuranceConfig.premiumRate;
    }

    if (pkg.status === 'delivered') {
      analytics.deliveredPackages += 1;
      if (pkg.estimatedDelivery && pkg.actualDelivery) {
        var est = new Date(pkg.estimatedDelivery).getTime();
        var act = new Date(pkg.actualDelivery).getTime();
        if (act <= est) {
          analytics.onTimeDeliveries += 1;
        } else {
          analytics.lateDeliveries += 1;
        }
        var deliveryDays = Math.ceil((act - pkg.createdAt) / 86400000);
        analytics.deliveryDaysTotal += deliveryDays;
      }
    }

    if (pkg.status === 'returned') analytics.returnedPackages += 1;
    if (pkg.status === 'lost') analytics.lostPackages += 1;
    if (pkg.isInternational) analytics.internationalPackages += 1;
    if (pkg.temperatureSensitive) analytics.temperatureSensitiveCount += 1;
    if (pkg.requiresSignature) analytics.signatureRequiredCount += 1;

    var carrierName = this.carriers[pkg.carrier] ? this.carriers[pkg.carrier].name : pkg.carrier;
    if (!analytics.carrierBreakdown[carrierName]) {
      analytics.carrierBreakdown[carrierName] = { count: 0, delivered: 0, onTime: 0 };
    }
    analytics.carrierBreakdown[carrierName].count += 1;
    if (pkg.status === 'delivered') {
      analytics.carrierBreakdown[carrierName].delivered += 1;
    }

    if (analytics.deliveredPackages > 0) {
      analytics.averageDeliveryDays = Math.round(
        (analytics.deliveryDaysTotal / analytics.deliveredPackages) * 10
      ) / 10;
    }
  }

  // ========================
  // Monitoring Intervals
  // ========================

  _startTrackingInterval() {
    var self = this;
    var interval = setInterval(function() {
      self._simulateTrackingUpdates();
    }, 300000);
    this.intervals.push(interval);
    this.homey.log('[PackageDelivery] Tracking update interval started (5 min)');
  }

  _startDeliveryNotificationInterval() {
    var self = this;
    var interval = setInterval(function() {
      self._checkDeliveryNotifications();
    }, 120000);
    this.intervals.push(interval);
    this.homey.log('[PackageDelivery] Delivery notification interval started (2 min)');
  }

  _startTemperatureMonitorInterval() {
    var self = this;
    var interval = setInterval(function() {
      self._checkTemperatureSensitivePackages();
    }, 600000);
    this.intervals.push(interval);
    this.homey.log('[PackageDelivery] Temperature monitor interval started (10 min)');
  }

  _startTheftPreventionInterval() {
    var self = this;
    var interval = setInterval(function() {
      self._runTheftPreventionCheck();
    }, 180000);
    this.intervals.push(interval);
    this.homey.log('[PackageDelivery] Theft prevention interval started (3 min)');
  }

  _startRecurringDeliveryCheckInterval() {
    var self = this;
    var interval = setInterval(function() {
      self._checkRecurringDeliveries();
    }, 3600000);
    this.intervals.push(interval);
    this.homey.log('[PackageDelivery] Recurring delivery check interval started (1 hr)');
  }

  _startAnalyticsAggregationInterval() {
    var self = this;
    var interval = setInterval(function() {
      self._aggregateAnalytics();
    }, 1800000);
    this.intervals.push(interval);
    this.homey.log('[PackageDelivery] Analytics aggregation interval started (30 min)');
  }

  // ========================
  // Tracking simulation
  // ========================

  _simulateTrackingUpdates() {
    var now = Date.now();
    var entries = Array.from(this.packages.entries());
    for (var i = 0; i < entries.length; i++) {
      var trackingNumber = entries[i][0];
      var pkg = entries[i][1];
      if (pkg.status === 'delivered' || pkg.status === 'returned' || pkg.status === 'lost') continue;

      var random = Math.random();
      if (random < 0.15) {
        var transitions = this.validTransitions[pkg.status] || [];
        if (transitions.length > 0) {
          var nextStatus = transitions[0];
          var previousStatus = pkg.status;
          pkg.status = nextStatus;
          pkg.updatedAt = now;
          pkg.statusHistory.push({
            status: nextStatus,
            timestamp: now,
            note: 'Status updated from ' + previousStatus + ' to ' + nextStatus
          });

          if (nextStatus === 'delivered') {
            pkg.actualDelivery = new Date(now).toISOString();
            pkg.deliveryLocation = this._selectDeliveryLocation(pkg);
            if (Math.random() > 0.3) {
              pkg.photoVerified = true;
              pkg.photoTimestamp = new Date(now).toISOString();
            }
            this.deliveryHistory.push(Object.assign({}, pkg));
            this._updateDeliveryPointOccupancy(pkg.deliveryLocation, 1);
          }

          this.homey.log('[PackageDelivery] ' + trackingNumber + ': ' + previousStatus + ' -> ' + nextStatus);
          this.homey.emit('package-delivery:status-changed', {
            trackingNumber: trackingNumber,
            previousStatus: previousStatus,
            newStatus: nextStatus,
            carrier: this.carriers[pkg.carrier] ? this.carriers[pkg.carrier].name : pkg.carrier,
            description: pkg.description
          });
        }
      }
    }
  }

  _selectDeliveryLocation(pkg) {
    var category = pkg.sizeCategory || this._categorizePackageSize(pkg);
    var sizeOrder = ['letter', 'small', 'medium', 'large', 'oversized'];
    for (var i = 0; i < this.storagePreferences.length; i++) {
      var pref = this.storagePreferences[i];
      var point = this.deliveryPoints[pref.location];
      if (!point) continue;
      if (point.currentItems >= point.capacity) continue;
      if (point.maxPackageSize) {
        var maxIdx = sizeOrder.indexOf(point.maxPackageSize);
        var pkgIdx = sizeOrder.indexOf(category);
        if (pkgIdx > maxIdx) continue;
      }
      return pref.location;
    }
    return 'smart-doorbell';
  }

  _categorizePackageSize(pkg) {
    if (!pkg.weight && !pkg.dimensions) return 'medium';
    var weight = pkg.weight || 0;
    var dim = pkg.dimensions || { l: 0, w: 0, h: 0 };
    var categories = Object.entries(this.sizeCategories);
    for (var i = 0; i < categories.length; i++) {
      var category = categories[i][0];
      var spec = categories[i][1];
      if (weight <= spec.maxWeight &&
          dim.l <= spec.maxDimensions.l &&
          dim.w <= spec.maxDimensions.w &&
          dim.h <= spec.maxDimensions.h) {
        return category;
      }
    }
    return 'oversized';
  }

  _updateDeliveryPointOccupancy(locationId, delta) {
    if (this.deliveryPoints[locationId]) {
      this.deliveryPoints[locationId].currentItems = Math.max(
        0,
        this.deliveryPoints[locationId].currentItems + delta
      );
    }
  }

  // ========================
  // Delivery Notifications
  // ========================

  _checkDeliveryNotifications() {
    var now = Date.now();
    var entries = Array.from(this.packages.entries());
    for (var i = 0; i < entries.length; i++) {
      var trackingNumber = entries[i][0];
      var pkg = entries[i][1];
      if (pkg.status === 'delivered' || pkg.status === 'returned' || pkg.status === 'lost') continue;

      if (pkg.estimatedDelivery) {
        var eta = new Date(pkg.estimatedDelivery).getTime();
        var hoursUntilDelivery = (eta - now) / 3600000;

        // ETA alert for imminent deliveries
        if (hoursUntilDelivery <= 2 && hoursUntilDelivery > 0 && pkg.status === 'out-for-delivery') {
          this.homey.emit('package-delivery:eta-alert', {
            trackingNumber: trackingNumber,
            description: pkg.description,
            carrier: this.carriers[pkg.carrier] ? this.carriers[pkg.carrier].name : pkg.carrier,
            etaHours: Math.round(hoursUntilDelivery * 10) / 10,
            message: 'Package from ' + pkg.sender + ' arriving in ~' + Math.round(hoursUntilDelivery) + ' hours'
          });
        }

        // Delayed notification
        if (now > eta && pkg.status !== 'delivered') {
          var delayHours = Math.round((now - eta) / 3600000);
          if (delayHours >= 24) {
            this.homey.emit('package-delivery:delayed', {
              trackingNumber: trackingNumber,
              description: pkg.description,
              carrier: this.carriers[pkg.carrier] ? this.carriers[pkg.carrier].name : pkg.carrier,
              delayHours: delayHours,
              message: 'Package "' + pkg.description + '" is delayed by ' + Math.round(delayHours / 24) + ' day(s)'
            });
          }
        }
      }

      // Shipped notification for recently shipped
      if (pkg.status === 'shipped') {
        var lastUpdate = pkg.statusHistory[pkg.statusHistory.length - 1];
        if (lastUpdate && (now - lastUpdate.timestamp) < 180000) {
          this.homey.emit('package-delivery:shipped', {
            trackingNumber: trackingNumber,
            description: pkg.description,
            carrier: this.carriers[pkg.carrier] ? this.carriers[pkg.carrier].name : pkg.carrier,
            estimatedDelivery: pkg.estimatedDelivery
          });
        }
      }
    }
  }

  // ========================
  // Temperature Monitoring
  // ========================

  _checkTemperatureSensitivePackages() {
    var simulatedOutdoorTemp = 15 + Math.random() * 20;
    var tempThreshold = 25;

    var entries = Array.from(this.packages.entries());
    for (var i = 0; i < entries.length; i++) {
      var trackingNumber = entries[i][0];
      var pkg = entries[i][1];
      if (!pkg.temperatureSensitive) continue;
      if (pkg.status === 'delivered' || pkg.status === 'returned' || pkg.status === 'lost') continue;

      if (pkg.status === 'out-for-delivery' && simulatedOutdoorTemp > tempThreshold) {
        this.homey.emit('package-delivery:temperature-alert', {
          trackingNumber: trackingNumber,
          description: pkg.description,
          currentTemperature: Math.round(simulatedOutdoorTemp * 10) / 10,
          threshold: tempThreshold,
          message: 'Temperature-sensitive package "' + pkg.description + '" may be affected - outdoor temp: ' + Math.round(simulatedOutdoorTemp) + ' C'
        });
        this.homey.log('[PackageDelivery] Temperature alert for ' + trackingNumber + ': ' + Math.round(simulatedOutdoorTemp) + ' C');
      }
    }
  }

  // ========================
  // Theft Prevention
  // ========================

  _runTheftPreventionCheck() {
    if (!this.theftPrevention.motionDetectionEnabled) return;

    var now = Date.now();
    var cooldown = this.theftPrevention.alertCooldownMinutes * 60000;

    if (this.theftPrevention.lastAlertTime && (now - this.theftPrevention.lastAlertTime) < cooldown) {
      return;
    }

    var unattendedPackages = [];
    var entries = Array.from(this.packages.entries());
    for (var i = 0; i < entries.length; i++) {
      var trackingNumber = entries[i][0];
      var pkg = entries[i][1];
      if (pkg.status !== 'delivered') continue;
      if (!pkg.actualDelivery) continue;
      var deliveredTime = new Date(pkg.actualDelivery).getTime();
      var hoursAgo = (now - deliveredTime) / 3600000;

      if (hoursAgo <= 4 && hoursAgo > 0.5) {
        var location = this.deliveryPoints[pkg.deliveryLocation];
        if (location && !location.secured) {
          unattendedPackages.push({
            trackingNumber: trackingNumber,
            description: pkg.description,
            location: pkg.deliveryLocation,
            hoursAgo: hoursAgo
          });
        }
      }
    }

    if (unattendedPackages.length > 0) {
      var simMotion = Math.random();
      if (simMotion > this.theftPrevention.motionSensitivityThreshold) {
        this.theftPrevention.lastAlertTime = now;

        var incident = {
          timestamp: now,
          type: 'suspicious-motion',
          packages: unattendedPackages.map(function(p) { return p.trackingNumber; }),
          resolved: false
        };
        this.theftPrevention.incidentLog.push(incident);

        if (this.theftPrevention.cameraTriggerOnDelivery) {
          this.homey.emit('package-delivery:camera-trigger', {
            reason: 'suspicious-motion',
            packages: unattendedPackages,
            timestamp: new Date(now).toISOString()
          });
        }

        if (this.theftPrevention.suspiciousActivityAlerts) {
          this.homey.emit('package-delivery:theft-alert', {
            message: 'Suspicious activity detected near ' + unattendedPackages.length + ' unattended package(s)',
            packages: unattendedPackages,
            timestamp: new Date(now).toISOString()
          });
          this.homey.log('[PackageDelivery] Theft prevention alert: suspicious activity near delivered packages');
        }
      }
    }
  }

  // ========================
  // Recurring Deliveries
  // ========================

  _checkRecurringDeliveries() {
    var now = Date.now();
    var day = 86400000;

    for (var i = 0; i < this.recurringDeliveries.length; i++) {
      var subscription = this.recurringDeliveries[i];
      if (!subscription.active) continue;

      var nextDel = new Date(subscription.nextDelivery).getTime();
      var hoursUntil = (nextDel - now) / 3600000;

      if (hoursUntil <= 24 && hoursUntil > 0) {
        this.homey.emit('package-delivery:recurring-reminder', {
          subscriptionId: subscription.id,
          name: subscription.name,
          nextDelivery: subscription.nextDelivery,
          carrier: this.carriers[subscription.carrier] ? this.carriers[subscription.carrier].name : subscription.carrier,
          message: 'Recurring delivery "' + subscription.name + '" expected tomorrow'
        });
      }

      if (hoursUntil <= 0) {
        var frequencyMap = { 'weekly': 7, 'biweekly': 14, 'monthly': 30 };
        var daysUntilNext = frequencyMap[subscription.frequency] || 7;
        subscription.lastDelivery = subscription.nextDelivery;
        subscription.nextDelivery = new Date(now + daysUntilNext * day).toISOString();
        subscription.totalDeliveries += 1;
        this.homey.log('[PackageDelivery] Recurring delivery "' + subscription.name + '" cycled, next: ' + subscription.nextDelivery);
      }
    }
  }

  // ========================
  // Analytics Aggregation
  // ========================

  _aggregateAnalytics() {
    var now = new Date();
    var monthKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

    if (!this.monthlyAnalytics[monthKey]) {
      this.monthlyAnalytics[monthKey] = {
        totalPackages: 0,
        deliveredPackages: 0,
        returnedPackages: 0,
        lostPackages: 0,
        totalValue: 0,
        totalInsurancePremiums: 0,
        carrierBreakdown: {},
        onTimeDeliveries: 0,
        lateDeliveries: 0,
        averageDeliveryDays: 0,
        deliveryDaysTotal: 0,
        customsDutiesPaid: 0,
        internationalPackages: 0,
        temperatureSensitiveCount: 0,
        signatureRequiredCount: 0
      };
    }

    var onTimePercent = 0;
    var analytics = this.monthlyAnalytics[monthKey];
    var totalDelivered = analytics.onTimeDeliveries + analytics.lateDeliveries;
    if (totalDelivered > 0) {
      onTimePercent = Math.round((analytics.onTimeDeliveries / totalDelivered) * 100);
    }

    this.homey.log('[PackageDelivery] Analytics: ' + analytics.totalPackages + ' packages, ' + onTimePercent + '% on-time');
  }

  // ========================
  // Public API Methods
  // ========================

  trackPackage(trackingNumber) {
    var pkg = this.packages.get(trackingNumber);
    if (!pkg) {
      this.homey.log('[PackageDelivery] Package not found: ' + trackingNumber);
      return null;
    }
    var carrier = this.carriers[pkg.carrier] || {};
    return {
      trackingNumber: pkg.trackingNumber,
      carrier: carrier.name || pkg.carrier,
      trackingUrl: carrier.trackingUrlPattern
        ? carrier.trackingUrlPattern.replace('{tracking}', trackingNumber)
        : null,
      sender: pkg.sender,
      description: pkg.description,
      status: pkg.status,
      statusHistory: pkg.statusHistory,
      estimatedDelivery: pkg.estimatedDelivery,
      actualDelivery: pkg.actualDelivery,
      deliveryLocation: pkg.deliveryLocation,
      photoVerified: pkg.photoVerified,
      weight: pkg.weight,
      sizeCategory: pkg.sizeCategory,
      value: pkg.value,
      currency: pkg.currency,
      insurance: pkg.insurance,
      isInternational: pkg.isInternational,
      customsInfo: pkg.customsInfo || null
    };
  }

  addPackage(packageData) {
    if (!packageData.trackingNumber || !packageData.carrier) {
      this.homey.error('[PackageDelivery] Cannot add package: missing trackingNumber or carrier');
      return null;
    }

    var now = Date.now();
    var autoInsure = packageData.value > this.insuranceConfig.valueThreshold ? true : (packageData.insurance || false);
    var isIntl = packageData.origin ? packageData.origin !== 'SE' : false;

    var pkg = {
      id: packageData.trackingNumber,
      trackingNumber: packageData.trackingNumber,
      carrier: packageData.carrier,
      sender: packageData.sender || 'Unknown',
      description: packageData.description || 'Package',
      weight: packageData.weight || 0,
      dimensions: packageData.dimensions || { l: 0, w: 0, h: 0 },
      sizeCategory: packageData.sizeCategory || this._categorizePackageSize(packageData),
      value: packageData.value || 0,
      currency: packageData.currency || 'SEK',
      insurance: autoInsure,
      requiresSignature: packageData.requiresSignature || false,
      temperatureSensitive: packageData.temperatureSensitive || false,
      fragile: packageData.fragile || false,
      status: 'ordered',
      statusHistory: [{ status: 'ordered', timestamp: now, note: 'Package registered' }],
      estimatedDelivery: packageData.estimatedDelivery || null,
      actualDelivery: null,
      deliveryLocation: null,
      photoVerified: false,
      photoTimestamp: null,
      recipientName: packageData.recipientName || 'Household',
      deliveryWindow: packageData.deliveryWindow || 'afternoon',
      origin: packageData.origin || 'SE',
      isInternational: isIntl,
      createdAt: now,
      updatedAt: now
    };

    if (pkg.isInternational && packageData.customsInfo) {
      pkg.customsInfo = packageData.customsInfo;
    }

    this.packages.set(pkg.trackingNumber, pkg);
    this.homey.log('[PackageDelivery] Added package: ' + pkg.trackingNumber + ' from ' + pkg.sender);
    this.homey.emit('package-delivery:package-added', {
      trackingNumber: pkg.trackingNumber,
      carrier: this.carriers[pkg.carrier] ? this.carriers[pkg.carrier].name : pkg.carrier,
      description: pkg.description
    });

    return pkg;
  }

  updatePackageStatus(trackingNumber, newStatus, note) {
    var pkg = this.packages.get(trackingNumber);
    if (!pkg) {
      this.homey.error('[PackageDelivery] Cannot update status: package ' + trackingNumber + ' not found');
      return false;
    }

    var allowed = this.validTransitions[pkg.status] || [];
    if (allowed.indexOf(newStatus) === -1) {
      this.homey.error('[PackageDelivery] Invalid transition: ' + pkg.status + ' -> ' + newStatus);
      return false;
    }

    var previousStatus = pkg.status;
    var now = Date.now();
    pkg.status = newStatus;
    pkg.updatedAt = now;
    pkg.statusHistory.push({
      status: newStatus,
      timestamp: now,
      note: note || ('Status changed to ' + newStatus)
    });

    if (newStatus === 'delivered') {
      pkg.actualDelivery = new Date(now).toISOString();
      pkg.deliveryLocation = this._selectDeliveryLocation(pkg);
      this.deliveryHistory.push(Object.assign({}, pkg));
      this._updateDeliveryPointOccupancy(pkg.deliveryLocation, 1);
    }

    this.homey.log('[PackageDelivery] ' + trackingNumber + ': ' + previousStatus + ' -> ' + newStatus);
    this.homey.emit('package-delivery:status-changed', {
      trackingNumber: trackingNumber,
      previousStatus: previousStatus,
      newStatus: newStatus,
      carrier: this.carriers[pkg.carrier] ? this.carriers[pkg.carrier].name : pkg.carrier,
      description: pkg.description
    });

    return true;
  }

  initiateReturn(trackingNumber, reason) {
    var pkg = this.packages.get(trackingNumber);
    if (!pkg) {
      this.homey.error('[PackageDelivery] Cannot initiate return: package ' + trackingNumber + ' not found');
      return null;
    }

    if (pkg.status !== 'delivered') {
      this.homey.error('[PackageDelivery] Cannot return package that is not delivered: ' + pkg.status);
      return null;
    }

    var now = Date.now();
    var returnTrackingNumber = 'RTN-' + trackingNumber + '-' + Date.now().toString(36).toUpperCase();
    var returnReason = reason || 'Not specified';

    var returnPkg = {
      id: returnTrackingNumber,
      trackingNumber: returnTrackingNumber,
      originalTrackingNumber: trackingNumber,
      carrier: pkg.carrier,
      sender: 'Household',
      description: 'RETURN: ' + pkg.description,
      weight: pkg.weight,
      dimensions: pkg.dimensions,
      sizeCategory: pkg.sizeCategory,
      value: pkg.value,
      currency: pkg.currency,
      insurance: pkg.insurance,
      requiresSignature: false,
      temperatureSensitive: false,
      fragile: pkg.fragile,
      status: 'confirmed',
      statusHistory: [
        { status: 'ordered', timestamp: now, note: 'Return initiated: ' + returnReason },
        { status: 'confirmed', timestamp: now, note: 'Return label generated' }
      ],
      estimatedDelivery: null,
      actualDelivery: null,
      deliveryLocation: null,
      photoVerified: false,
      photoTimestamp: null,
      recipientName: pkg.sender,
      deliveryWindow: 'morning',
      origin: 'SE',
      isInternational: pkg.isInternational,
      isReturn: true,
      returnReason: returnReason,
      returnDropoff: this.carriers[pkg.carrier] ? this.carriers[pkg.carrier].returnDropoff : 'Nearest service point',
      createdAt: now,
      updatedAt: now
    };

    this.packages.set(returnTrackingNumber, returnPkg);

    // Update original package
    pkg.status = 'returned';
    pkg.updatedAt = now;
    pkg.statusHistory.push({
      status: 'returned',
      timestamp: now,
      note: 'Return initiated, return tracking: ' + returnTrackingNumber
    });

    if (pkg.deliveryLocation) {
      this._updateDeliveryPointOccupancy(pkg.deliveryLocation, -1);
    }

    this.homey.log('[PackageDelivery] Return initiated: ' + returnTrackingNumber + ' for original ' + trackingNumber);
    this.homey.emit('package-delivery:return-initiated', {
      returnTrackingNumber: returnTrackingNumber,
      originalTrackingNumber: trackingNumber,
      carrier: this.carriers[pkg.carrier] ? this.carriers[pkg.carrier].name : pkg.carrier,
      reason: returnReason,
      dropoff: returnPkg.returnDropoff
    });

    return returnPkg;
  }

  getActivePackages() {
    var active = [];
    var allPkgs = Array.from(this.packages.values());
    for (var i = 0; i < allPkgs.length; i++) {
      var pkg = allPkgs[i];
      if (pkg.status !== 'delivered' && pkg.status !== 'returned' && pkg.status !== 'lost') {
        active.push(this.trackPackage(pkg.trackingNumber));
      }
    }
    return active.sort(function(a, b) {
      if (!a.estimatedDelivery) return 1;
      if (!b.estimatedDelivery) return -1;
      return new Date(a.estimatedDelivery).getTime() - new Date(b.estimatedDelivery).getTime();
    });
  }

  getDeliveryHistory(options) {
    options = options || {};
    var history = this.deliveryHistory.slice();

    if (options.carrier) {
      history = history.filter(function(pkg) { return pkg.carrier === options.carrier; });
    }
    if (options.sender) {
      var senderLower = options.sender.toLowerCase();
      history = history.filter(function(pkg) {
        return pkg.sender.toLowerCase().indexOf(senderLower) !== -1;
      });
    }
    if (options.search) {
      var term = options.search.toLowerCase();
      history = history.filter(function(pkg) {
        return pkg.description.toLowerCase().indexOf(term) !== -1 ||
          pkg.sender.toLowerCase().indexOf(term) !== -1 ||
          pkg.trackingNumber.toLowerCase().indexOf(term) !== -1;
      });
    }
    if (options.fromDate) {
      var from = new Date(options.fromDate).getTime();
      history = history.filter(function(pkg) { return pkg.createdAt >= from; });
    }
    if (options.toDate) {
      var to = new Date(options.toDate).getTime();
      history = history.filter(function(pkg) { return pkg.createdAt <= to; });
    }
    if (options.limit) {
      history = history.slice(0, options.limit);
    }

    return history;
  }

  getCarrierReliability() {
    var report = {};
    var carrierIds = Object.keys(this.carriers);
    for (var c = 0; c < carrierIds.length; c++) {
      var carrierId = carrierIds[c];
      var carrier = this.carriers[carrierId];
      var packages = [];
      var allPkgs = Array.from(this.packages.values());
      for (var i = 0; i < allPkgs.length; i++) {
        if (allPkgs[i].carrier === carrierId) packages.push(allPkgs[i]);
      }
      var delivered = packages.filter(function(p) { return p.status === 'delivered'; });
      var onTimeCount = 0;
      var totalDeliveryDays = 0;

      for (var d = 0; d < delivered.length; d++) {
        var dp = delivered[d];
        if (dp.estimatedDelivery && dp.actualDelivery) {
          var est = new Date(dp.estimatedDelivery).getTime();
          var act = new Date(dp.actualDelivery).getTime();
          if (act <= est) onTimeCount += 1;
          totalDeliveryDays += Math.ceil((act - dp.createdAt) / 86400000);
        }
      }

      report[carrier.name] = {
        totalPackages: packages.length,
        delivered: delivered.length,
        baseReliabilityScore: carrier.reliabilityScore,
        onTimePercentage: delivered.length > 0 ? Math.round((onTimeCount / delivered.length) * 100) : null,
        averageDeliveryDays: delivered.length > 0 ? Math.round((totalDeliveryDays / delivered.length) * 10) / 10 : carrier.averageDeliveryDays,
        supportedServices: carrier.supportedServices,
        contactNumber: carrier.contactNumber
      };
    }
    return report;
  }

  getCommunityStatus() {
    return {
      enabled: this.communityNetwork.enabled,
      acceptingForNeighbors: this.communityNetwork.acceptForNeighbors,
      neighbors: this.communityNetwork.neighbors.map(function(n) {
        return {
          name: n.name,
          address: n.address,
          trustLevel: n.trustLevel,
          acceptingPackages: n.acceptingPackages
        };
      }),
      heldPackages: this.communityNetwork.heldPackages,
      maxHoldDays: this.communityNetwork.maxHoldDays
    };
  }

  acceptNeighborPackage(neighborId, packageDescription) {
    var neighbor = null;
    for (var i = 0; i < this.communityNetwork.neighbors.length; i++) {
      if (this.communityNetwork.neighbors[i].id === neighborId) {
        neighbor = this.communityNetwork.neighbors[i];
        break;
      }
    }
    if (!neighbor) {
      this.homey.error('[PackageDelivery] Neighbor not found: ' + neighborId);
      return null;
    }

    var held = {
      id: 'held-' + Date.now().toString(36),
      neighborId: neighborId,
      neighborName: neighbor.name,
      description: packageDescription,
      acceptedAt: new Date().toISOString(),
      pickedUp: false,
      pickedUpAt: null
    };

    this.communityNetwork.heldPackages.push(held);
    this.homey.log('[PackageDelivery] Accepted package for neighbor ' + neighbor.name + ': ' + packageDescription);
    this.homey.emit('package-delivery:neighbor-package-accepted', {
      neighborName: neighbor.name,
      description: packageDescription
    });

    return held;
  }

  releaseNeighborPackage(heldId) {
    var idx = -1;
    for (var i = 0; i < this.communityNetwork.heldPackages.length; i++) {
      if (this.communityNetwork.heldPackages[i].id === heldId) {
        idx = i;
        break;
      }
    }
    if (idx === -1) {
      this.homey.error('[PackageDelivery] Held package not found: ' + heldId);
      return false;
    }

    this.communityNetwork.heldPackages[idx].pickedUp = true;
    this.communityNetwork.heldPackages[idx].pickedUpAt = new Date().toISOString();

    this.homey.log('[PackageDelivery] Neighbor package released: ' + heldId);
    this.homey.emit('package-delivery:neighbor-package-released', {
      heldId: heldId,
      neighborName: this.communityNetwork.heldPackages[idx].neighborName
    });

    return true;
  }

  getDeliveryPointStatus() {
    var status = {};
    var pointIds = Object.keys(this.deliveryPoints);
    for (var i = 0; i < pointIds.length; i++) {
      var id = pointIds[i];
      var point = this.deliveryPoints[id];
      status[id] = {
        name: point.name,
        type: point.type,
        capacity: point.capacity,
        currentItems: point.currentItems,
        availableSlots: point.capacity - point.currentItems,
        secured: point.secured,
        weatherproof: point.weatherproof,
        cameraEnabled: point.cameraEnabled,
        pinProtected: point.pinProtected,
        location: point.location
      };
    }
    return status;
  }

  getRecurringDeliveries() {
    var self = this;
    return this.recurringDeliveries.map(function(sub) {
      return {
        id: sub.id,
        name: sub.name,
        type: sub.type,
        carrier: self.carriers[sub.carrier] ? self.carriers[sub.carrier].name : sub.carrier,
        frequency: sub.frequency,
        cost: sub.cost,
        currency: sub.currency,
        nextDelivery: sub.nextDelivery,
        lastDelivery: sub.lastDelivery,
        active: sub.active,
        temperatureSensitive: sub.temperatureSensitive,
        deliveryWindow: sub.deliveryWindow,
        totalDeliveries: sub.totalDeliveries,
        missedDeliveries: sub.missedDeliveries
      };
    });
  }

  addRecurringDelivery(deliveryData) {
    var id = 'recurring-' + Date.now().toString(36);
    var subscription = {
      id: id,
      name: deliveryData.name || 'Recurring Delivery',
      type: deliveryData.type || 'other',
      carrier: deliveryData.carrier || 'postnord',
      frequency: deliveryData.frequency || 'weekly',
      cost: deliveryData.cost || 0,
      currency: deliveryData.currency || 'SEK',
      nextDelivery: deliveryData.nextDelivery || new Date(Date.now() + 7 * 86400000).toISOString(),
      lastDelivery: null,
      active: true,
      temperatureSensitive: deliveryData.temperatureSensitive || false,
      deliveryWindow: deliveryData.deliveryWindow || 'afternoon',
      totalDeliveries: 0,
      missedDeliveries: 0
    };

    this.recurringDeliveries.push(subscription);
    this.homey.log('[PackageDelivery] Added recurring delivery: ' + subscription.name);
    this.homey.emit('package-delivery:recurring-added', { id: id, name: subscription.name });

    return subscription;
  }

  cancelRecurringDelivery(subscriptionId) {
    var sub = null;
    for (var i = 0; i < this.recurringDeliveries.length; i++) {
      if (this.recurringDeliveries[i].id === subscriptionId) {
        sub = this.recurringDeliveries[i];
        break;
      }
    }
    if (!sub) {
      this.homey.error('[PackageDelivery] Recurring delivery not found: ' + subscriptionId);
      return false;
    }
    sub.active = false;
    this.homey.log('[PackageDelivery] Cancelled recurring delivery: ' + sub.name);
    this.homey.emit('package-delivery:recurring-cancelled', { id: subscriptionId, name: sub.name });
    return true;
  }

  getCustomsInfo(trackingNumber) {
    var pkg = this.packages.get(trackingNumber);
    if (!pkg || !pkg.isInternational) return null;

    var euCountries = ['DE', 'FR', 'NL', 'IT', 'ES', 'PL', 'DK', 'FI', 'NO', 'AT', 'BE', 'IE'];
    var isEU = euCountries.indexOf(pkg.origin) !== -1;
    return {
      trackingNumber: pkg.trackingNumber,
      origin: pkg.origin,
      isEU: isEU,
      customsInfo: pkg.customsInfo || null,
      vatRate: this.customsConfig.vatRate,
      dutyFreeThreshold: isEU ? this.customsConfig.dutyFreeThresholdEU : this.customsConfig.dutyFreeThresholdNonEU,
      customsBroker: this.customsConfig.customsBroker,
      estimatedCharges: pkg.customsInfo ? {
        duty: pkg.customsInfo.estimatedDuty || 0,
        vat: pkg.customsInfo.estimatedVAT || 0,
        total: (pkg.customsInfo.estimatedDuty || 0) + (pkg.customsInfo.estimatedVAT || 0)
      } : null
    };
  }

  getDeliveryWindows() {
    return Object.assign({}, this.deliveryWindows);
  }

  setPreferredDeliveryWindow(windowId, preferred) {
    if (this.deliveryWindows[windowId]) {
      this.deliveryWindows[windowId].preferred = preferred;
      this.homey.log('[PackageDelivery] Delivery window ' + windowId + ' preferred: ' + preferred);
      return true;
    }
    return false;
  }

  getInsuranceStatus() {
    var insuredPackages = [];
    var totalInsuredValue = 0;
    var totalPremium = 0;

    var allPkgs = Array.from(this.packages.values());
    for (var i = 0; i < allPkgs.length; i++) {
      var pkg = allPkgs[i];
      if (pkg.insurance) {
        var premium = pkg.value * this.insuranceConfig.premiumRate;
        insuredPackages.push({
          trackingNumber: pkg.trackingNumber,
          description: pkg.description,
          value: pkg.value,
          premium: Math.round(premium * 100) / 100,
          status: pkg.status
        });
        totalInsuredValue += pkg.value;
        totalPremium += premium;
      }
    }

    return {
      config: {
        valueThreshold: this.insuranceConfig.valueThreshold,
        premiumRate: this.insuranceConfig.premiumRate,
        maxCoverage: this.insuranceConfig.maxCoverage,
        autoInsure: this.insuranceConfig.autoInsure,
        provider: this.insuranceConfig.provider
      },
      insuredPackages: insuredPackages,
      totalInsuredValue: totalInsuredValue,
      totalPremium: Math.round(totalPremium * 100) / 100,
      currency: this.insuranceConfig.currency
    };
  }

  getTheftPreventionStatus() {
    return {
      motionDetectionEnabled: this.theftPrevention.motionDetectionEnabled,
      cameraTriggerOnDelivery: this.theftPrevention.cameraTriggerOnDelivery,
      suspiciousActivityAlerts: this.theftPrevention.suspiciousActivityAlerts,
      sensitivityThreshold: this.theftPrevention.motionSensitivityThreshold,
      recentIncidents: this.theftPrevention.incidentLog.slice(-10),
      totalIncidents: this.theftPrevention.incidentLog.length
    };
  }

  setTheftPreventionConfig(config) {
    if (config.motionDetectionEnabled !== undefined) {
      this.theftPrevention.motionDetectionEnabled = config.motionDetectionEnabled;
    }
    if (config.cameraTriggerOnDelivery !== undefined) {
      this.theftPrevention.cameraTriggerOnDelivery = config.cameraTriggerOnDelivery;
    }
    if (config.suspiciousActivityAlerts !== undefined) {
      this.theftPrevention.suspiciousActivityAlerts = config.suspiciousActivityAlerts;
    }
    if (config.sensitivityThreshold !== undefined) {
      this.theftPrevention.motionSensitivityThreshold = Math.max(0, Math.min(1, config.sensitivityThreshold));
    }
    this.homey.log('[PackageDelivery] Theft prevention config updated');
    return this.getTheftPreventionStatus();
  }

  getMonthlyAnalytics(monthKey) {
    if (!monthKey) {
      var now = new Date();
      monthKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    }

    var analytics = this.monthlyAnalytics[monthKey];
    if (!analytics) return null;

    var totalDelivered = analytics.onTimeDeliveries + analytics.lateDeliveries;
    return {
      month: monthKey,
      totalPackages: analytics.totalPackages,
      deliveredPackages: analytics.deliveredPackages,
      returnedPackages: analytics.returnedPackages,
      lostPackages: analytics.lostPackages,
      totalValue: Math.round(analytics.totalValue * 100) / 100,
      totalInsurancePremiums: Math.round(analytics.totalInsurancePremiums * 100) / 100,
      onTimePercentage: totalDelivered > 0 ? Math.round((analytics.onTimeDeliveries / totalDelivered) * 100) : 0,
      averageDeliveryDays: analytics.averageDeliveryDays,
      carrierBreakdown: analytics.carrierBreakdown,
      internationalPackages: analytics.internationalPackages,
      temperatureSensitiveCount: analytics.temperatureSensitiveCount,
      signatureRequiredCount: analytics.signatureRequiredCount,
      customsDutiesPaid: analytics.customsDutiesPaid,
      currency: 'SEK'
    };
  }

  getDriverInstructions(carrierId) {
    var carrier = this.carriers[carrierId];
    if (!carrier) return null;
    var pointIds = Object.keys(this.deliveryPoints);
    var deliveryPointsList = [];
    for (var i = 0; i < pointIds.length; i++) {
      var ptId = pointIds[i];
      var pt = this.deliveryPoints[ptId];
      deliveryPointsList.push({
        id: ptId,
        name: pt.name,
        location: pt.location,
        pinProtected: pt.pinProtected,
        currentPin: pt.pinProtected ? pt.currentPin : null
      });
    }
    var windowKeys = Object.keys(this.deliveryWindows);
    var preferredWindows = [];
    for (var w = 0; w < windowKeys.length; w++) {
      var wKey = windowKeys[w];
      var win = this.deliveryWindows[wKey];
      if (win.preferred) {
        preferredWindows.push({ id: wKey, label: win.label });
      }
    }
    return {
      carrier: carrier.name,
      instructions: carrier.driverInstructions,
      deliveryPoints: deliveryPointsList,
      gateCode: '4521',
      preferredWindows: preferredWindows
    };
  }

  setDriverInstructions(carrierId, instructions) {
    if (!this.carriers[carrierId]) {
      this.homey.error('[PackageDelivery] Carrier not found: ' + carrierId);
      return false;
    }
    this.carriers[carrierId].driverInstructions = instructions;
    this.homey.log('[PackageDelivery] Updated driver instructions for ' + this.carriers[carrierId].name);
    return true;
  }

  verifyDeliveryPhoto(trackingNumber) {
    var pkg = this.packages.get(trackingNumber);
    if (!pkg) return false;
    if (pkg.status !== 'delivered') return false;

    pkg.photoVerified = true;
    pkg.photoTimestamp = new Date().toISOString();
    pkg.updatedAt = Date.now();

    this.homey.log('[PackageDelivery] Delivery photo verified for ' + trackingNumber);
    this.homey.emit('package-delivery:photo-verified', {
      trackingNumber: trackingNumber,
      description: pkg.description,
      photoTimestamp: pkg.photoTimestamp
    });

    return true;
  }

  collectPackage(trackingNumber) {
    var pkg = this.packages.get(trackingNumber);
    if (!pkg || pkg.status !== 'delivered') return false;

    if (pkg.deliveryLocation) {
      this._updateDeliveryPointOccupancy(pkg.deliveryLocation, -1);
    }

    this.homey.log('[PackageDelivery] Package collected: ' + trackingNumber);
    this.homey.emit('package-delivery:package-collected', {
      trackingNumber: trackingNumber,
      description: pkg.description,
      deliveryLocation: pkg.deliveryLocation
    });

    return true;
  }

  // ========================
  // Statistics
  // ========================

  getStatistics() {
    var allPackages = Array.from(this.packages.values());
    var statusCounts = {};
    for (var s = 0; s < this.packageStates.length; s++) {
      statusCounts[this.packageStates[s]] = 0;
    }
    for (var i = 0; i < allPackages.length; i++) {
      var pkg = allPackages[i];
      if (statusCounts[pkg.status] !== undefined) {
        statusCounts[pkg.status] += 1;
      }
    }

    var activeCount = 0;
    var totalValue = 0;
    var insuredCount = 0;
    var internationalCount = 0;
    var tempSensitiveCount = 0;
    var fragileCount = 0;
    var signatureCount = 0;

    for (var j = 0; j < allPackages.length; j++) {
      var p = allPackages[j];
      if (p.status !== 'delivered' && p.status !== 'returned' && p.status !== 'lost') activeCount++;
      totalValue += p.value || 0;
      if (p.insurance) insuredCount++;
      if (p.isInternational) internationalCount++;
      if (p.temperatureSensitive) tempSensitiveCount++;
      if (p.fragile) fragileCount++;
      if (p.requiresSignature) signatureCount++;
    }

    var activeRecurring = 0;
    for (var r = 0; r < this.recurringDeliveries.length; r++) {
      if (this.recurringDeliveries[r].active) activeRecurring++;
    }

    var unclaimedHeld = 0;
    for (var h = 0; h < this.communityNetwork.heldPackages.length; h++) {
      if (!this.communityNetwork.heldPackages[h].pickedUp) unclaimedHeld++;
    }

    return {
      initialized: this.initialized,
      totalPackages: allPackages.length,
      activePackages: activeCount,
      statusBreakdown: statusCounts,
      totalValue: Math.round(totalValue * 100) / 100,
      currency: 'SEK',
      insuredPackages: insuredCount,
      internationalPackages: internationalCount,
      temperatureSensitivePackages: tempSensitiveCount,
      fragilePackages: fragileCount,
      signatureRequiredPackages: signatureCount,
      carriersConfigured: Object.keys(this.carriers).length,
      deliveryPoints: Object.keys(this.deliveryPoints).length,
      recurringDeliveries: activeRecurring,
      deliveryHistoryCount: this.deliveryHistory.length,
      communityNetworkEnabled: this.communityNetwork.enabled,
      heldNeighborPackages: unclaimedHeld,
      theftPreventionActive: this.theftPrevention.motionDetectionEnabled,
      theftIncidents: this.theftPrevention.incidentLog.length,
      intervalsRunning: this.intervals.length
    };
  }

  destroy() {
    for (var i = 0; i < this.intervals.length; i++) {
      clearInterval(this.intervals[i]);
    }
    this.intervals = [];
    this.homey.log('[PackageDelivery] destroyed');
  }
}

module.exports = AdvancedPackageDeliveryManagementSystem;
