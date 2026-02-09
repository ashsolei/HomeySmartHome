'use strict';

const EventEmitter = require('events');

class HomeEnergyAuditSystem extends EventEmitter {
  constructor(homey) {
    super();
    this.homey = homey;
    this.initialized = false;
    this.intervals = [];

    // Room-by-room energy data
    this.rooms = {};
    // Appliance tracking
    this.appliances = {};
    // Insulation audit data
    this.insulationAudit = {};
    // Heating system data
    this.heatingSystem = {};
    // Tariff data
    this.tariffData = {};
    // Energy waste detections
    this.wasteDetections = [];
    // Seasonal profiles
    this.seasonalProfiles = {};
    // Renewable assessment
    this.renewableAssessment = {};
    // Recommendations
    this.recommendations = [];
    // Carbon footprint
    this.carbonFootprint = {};
    // Benchmark data
    this.benchmarkData = {};
    // Audit history
    this.auditHistory = [];
    // Smart meter readings
    this.smartMeterReadings = [];
    // Cost projections
    this.costProjections = {};
    // Audit reports
    this.auditReports = [];
    // Swedish electricity price SEK/kWh
    this.electricityPrice = 1.85;
    // Property info
    this.property = {
      totalArea: 145,
      buildYear: 1985,
      floors: 2,
      residents: 4,
      region: 'Stockholm',
      heatingDegreeDays: 3800,
      coolingDegreeDays: 120
    };
  }

  async initialize() {
    try {
      this.homey.log('[EnergyAudit] Initializing Home Energy Audit System...');
      this._initializeRooms();
      this._initializeAppliances();
      this._initializeInsulationAudit();
      this._initializeHeatingSystem();
      this._initializeTariffData();
      this._initializeSeasonalProfiles();
      this._initializeRenewableAssessment();
      this._generateRecommendations();
      this._calculateCarbonFootprint();
      this._initializeBenchmarks();
      this._initializeCostProjections();

      const auditInterval = setInterval(() => this._runPeriodicAudit(), 900000);
      this.intervals.push(auditInterval);

      const meterInterval = setInterval(() => this._recordSmartMeterReading(), 900000);
      this.intervals.push(meterInterval);

      const wasteInterval = setInterval(() => this._detectEnergyWaste(), 600000);
      this.intervals.push(wasteInterval);

      const reportInterval = setInterval(() => this._generateQuarterlySnapshot(), 3600000);
      this.intervals.push(reportInterval);

      this.initialized = true;
      this.homey.log('[EnergyAudit] System initialized successfully');
      this.homey.emit('energy-audit-initialized', { timestamp: new Date().toISOString() });
    } catch (err) {
      this.homey.error('[EnergyAudit] Initialization failed:', err.message);
    }
  }

  _initializeRooms() {
    const roomDefs = [
      { name: 'Kitchen', area: 18, windows: { count: 2, type: 'double' }, insulation: 'B', heatingSource: 'district', cooling: false, lightingType: 'LED', appliances: ['fridge', 'freezer', 'dishwasher', 'oven', 'microwave', 'kettle', 'coffee-maker'] },
      { name: 'Living Room', area: 28, windows: { count: 3, type: 'triple' }, insulation: 'A', heatingSource: 'district', cooling: false, lightingType: 'LED', appliances: ['TV', 'gaming-console', 'speakers', 'router'] },
      { name: 'Master Bedroom', area: 16, windows: { count: 2, type: 'double' }, insulation: 'B', heatingSource: 'district', cooling: false, lightingType: 'LED', appliances: ['TV', 'phone-charger', 'air-purifier'] },
      { name: 'Bedroom 2', area: 12, windows: { count: 1, type: 'double' }, insulation: 'B', heatingSource: 'district', cooling: false, lightingType: 'LED', appliances: ['computer', 'monitor', 'phone-charger'] },
      { name: 'Bedroom 3', area: 10, windows: { count: 1, type: 'double' }, insulation: 'C', heatingSource: 'district', cooling: false, lightingType: 'fluorescent', appliances: ['phone-charger', 'desk-lamp'] },
      { name: 'Bathroom 1', area: 8, windows: { count: 1, type: 'single' }, insulation: 'C', heatingSource: 'electric-floor', cooling: false, lightingType: 'LED', appliances: ['hair-dryer', 'towel-heater'] },
      { name: 'Bathroom 2', area: 5, windows: { count: 0, type: 'none' }, insulation: 'C', heatingSource: 'electric-floor', cooling: false, lightingType: 'incandescent', appliances: ['towel-heater'] },
      { name: 'Home Office', area: 12, windows: { count: 2, type: 'double' }, insulation: 'B', heatingSource: 'district', cooling: false, lightingType: 'LED', appliances: ['computer', 'monitor', 'monitor-2', 'printer', 'desk-lamp'] },
      { name: 'Laundry Room', area: 6, windows: { count: 1, type: 'single' }, insulation: 'D', heatingSource: 'none', cooling: false, lightingType: 'fluorescent', appliances: ['washer', 'dryer', 'iron'] },
      { name: 'Hallway', area: 10, windows: { count: 1, type: 'double' }, insulation: 'B', heatingSource: 'district', cooling: false, lightingType: 'LED', appliances: ['shoe-dryer'] },
      { name: 'Garage', area: 15, windows: { count: 1, type: 'single' }, insulation: 'E', heatingSource: 'space-heater', cooling: false, lightingType: 'fluorescent', appliances: ['EV-charger', 'workshop-tools', 'freezer-2'] },
      { name: 'Basement', area: 5, windows: { count: 0, type: 'none' }, insulation: 'D', heatingSource: 'none', cooling: false, lightingType: 'incandescent', appliances: ['dehumidifier'] }
    ];

    for (const def of roomDefs) {
      const consumptionKWh = this._calculateRoomConsumption(def);
      const efficiencyRating = this._calculateEfficiencyRating(consumptionKWh, def.area);
      const improvementPotential = this._calculateImprovementPotential(def);
      const estimatedSavingsSEK = improvementPotential * this.electricityPrice;
      this.rooms[def.name] = {
        ...def,
        consumptionKWh,
        efficiencyRating,
        improvementPotential,
        estimatedSavingsSEK: Math.round(estimatedSavingsSEK)
      };
    }
    this.homey.log(`[EnergyAudit] Initialized ${Object.keys(this.rooms).length} rooms`);
  }

  _calculateRoomConsumption(room) {
    let base = room.area * 22;
    if (room.lightingType === 'incandescent') base += room.area * 8;
    else if (room.lightingType === 'fluorescent') base += room.area * 4;
    else base += room.area * 1.5;
    if (room.heatingSource === 'electric-floor') base += room.area * 35;
    else if (room.heatingSource === 'space-heater') base += room.area * 45;
    base += room.appliances.length * 65;
    const windowLoss = room.windows.count * (room.windows.type === 'single' ? 1.3 : room.windows.type === 'double' ? 1.0 : 0.7);
    base *= windowLoss > 0 ? (1 + windowLoss * 0.02) : 1;
    return Math.round(base);
  }

  _calculateEfficiencyRating(kWh, area) {
    const kwhPerSqm = kWh / area;
    if (kwhPerSqm < 30) return 'A';
    if (kwhPerSqm < 50) return 'B';
    if (kwhPerSqm < 75) return 'C';
    if (kwhPerSqm < 100) return 'D';
    if (kwhPerSqm < 140) return 'E';
    if (kwhPerSqm < 200) return 'F';
    return 'G';
  }

  _calculateImprovementPotential(room) {
    let potential = 0;
    if (room.lightingType === 'incandescent') potential += room.area * 6;
    if (room.lightingType === 'fluorescent') potential += room.area * 2;
    if (room.insulation === 'D' || room.insulation === 'E') potential += room.area * 12;
    if (room.insulation === 'C') potential += room.area * 5;
    if (room.windows.type === 'single') potential += room.windows.count * 80;
    if (room.heatingSource === 'space-heater') potential += room.area * 20;
    return Math.round(potential);
  }

  _initializeAppliances() {
    const applianceDefs = [
      { id: 'fridge', name: 'Refrigerator', brand: 'Samsung', model: 'RB38T676DSA', category: 'kitchen', energyClass: 'D', annualKWh: 114, standbyWatts: 0, activeWatts: 65, hoursPerDay: 24, ageYears: 3, replacementRecommended: false },
      { id: 'freezer', name: 'Chest Freezer', brand: 'Electrolux', model: 'LCB3LF26W0', category: 'kitchen', energyClass: 'E', annualKWh: 198, standbyWatts: 0, activeWatts: 80, hoursPerDay: 24, ageYears: 8, replacementRecommended: true },
      { id: 'dishwasher', name: 'Dishwasher', brand: 'Bosch', model: 'SMV6ZCX49E', category: 'kitchen', energyClass: 'C', annualKWh: 75, standbyWatts: 1, activeWatts: 1800, hoursPerDay: 1.5, ageYears: 4, replacementRecommended: false },
      { id: 'oven', name: 'Electric Oven', brand: 'Siemens', model: 'HB578GBS0', category: 'kitchen', energyClass: 'A', annualKWh: 165, standbyWatts: 2, activeWatts: 3500, hoursPerDay: 1, ageYears: 5, replacementRecommended: false },
      { id: 'microwave', name: 'Microwave', brand: 'Whirlpool', model: 'MWP338SB', category: 'kitchen', energyClass: 'B', annualKWh: 56, standbyWatts: 2, activeWatts: 1200, hoursPerDay: 0.3, ageYears: 6, replacementRecommended: false },
      { id: 'kettle', name: 'Electric Kettle', brand: 'Philips', model: 'HD9350', category: 'kitchen', energyClass: 'A', annualKWh: 88, standbyWatts: 0, activeWatts: 2200, hoursPerDay: 0.25, ageYears: 2, replacementRecommended: false },
      { id: 'coffee-maker', name: 'Coffee Machine', brand: 'DeLonghi', model: 'Magnifica', category: 'kitchen', energyClass: 'B', annualKWh: 95, standbyWatts: 1, activeWatts: 1450, hoursPerDay: 0.5, ageYears: 3, replacementRecommended: false },
      { id: 'washer', name: 'Washing Machine', brand: 'LG', model: 'F4WV710P1E', category: 'laundry', energyClass: 'A', annualKWh: 67, standbyWatts: 1, activeWatts: 2100, hoursPerDay: 1, ageYears: 2, replacementRecommended: false },
      { id: 'dryer', name: 'Tumble Dryer', brand: 'Bosch', model: 'WTH85V09', category: 'laundry', energyClass: 'D', annualKWh: 315, standbyWatts: 1, activeWatts: 2500, hoursPerDay: 0.8, ageYears: 9, replacementRecommended: true },
      { id: 'iron', name: 'Steam Iron', brand: 'Philips', model: 'GC4541', category: 'laundry', energyClass: 'B', annualKWh: 42, standbyWatts: 0, activeWatts: 2400, hoursPerDay: 0.15, ageYears: 4, replacementRecommended: false },
      { id: 'tv-living', name: 'Living Room TV', brand: 'LG', model: 'OLED65C2', category: 'entertainment', energyClass: 'G', annualKWh: 152, standbyWatts: 0.5, activeWatts: 120, hoursPerDay: 4, ageYears: 2, replacementRecommended: false },
      { id: 'tv-bedroom', name: 'Bedroom TV', brand: 'Samsung', model: 'QE43Q60B', category: 'entertainment', energyClass: 'G', annualKWh: 78, standbyWatts: 0.5, activeWatts: 65, hoursPerDay: 2, ageYears: 3, replacementRecommended: false },
      { id: 'gaming-console', name: 'Gaming Console', brand: 'Sony', model: 'PlayStation 5', category: 'entertainment', energyClass: 'F', annualKWh: 120, standbyWatts: 1.5, activeWatts: 200, hoursPerDay: 2, ageYears: 3, replacementRecommended: false },
      { id: 'speakers', name: 'Sound System', brand: 'Sonos', model: 'Arc + Sub', category: 'entertainment', energyClass: 'C', annualKWh: 62, standbyWatts: 5, activeWatts: 50, hoursPerDay: 4, ageYears: 2, replacementRecommended: false },
      { id: 'computer-office', name: 'Desktop PC', brand: 'Custom', model: 'Ryzen 7 Build', category: 'entertainment', energyClass: 'E', annualKWh: 365, standbyWatts: 3, activeWatts: 250, hoursPerDay: 8, ageYears: 2, replacementRecommended: false },
      { id: 'computer-kid', name: 'Laptop', brand: 'Apple', model: 'MacBook Air M2', category: 'entertainment', energyClass: 'A', annualKWh: 22, standbyWatts: 0.5, activeWatts: 30, hoursPerDay: 4, ageYears: 1, replacementRecommended: false },
      { id: 'monitor-1', name: 'Monitor 27"', brand: 'Dell', model: 'U2723QE', category: 'entertainment', energyClass: 'D', annualKWh: 52, standbyWatts: 0.5, activeWatts: 28, hoursPerDay: 8, ageYears: 2, replacementRecommended: false },
      { id: 'monitor-2', name: 'Monitor 24"', brand: 'Dell', model: 'P2422H', category: 'entertainment', energyClass: 'D', annualKWh: 38, standbyWatts: 0.3, activeWatts: 20, hoursPerDay: 8, ageYears: 3, replacementRecommended: false },
      { id: 'router', name: 'Wi-Fi Router', brand: 'ASUS', model: 'RT-AX86U', category: 'entertainment', energyClass: 'C', annualKWh: 66, standbyWatts: 7.5, activeWatts: 7.5, hoursPerDay: 24, ageYears: 2, replacementRecommended: false },
      { id: 'heat-pump', name: 'Air-Source Heat Pump', brand: 'Nibe', model: 'F2120-12', category: 'climate', energyClass: 'A+++', annualKWh: 4200, standbyWatts: 5, activeWatts: 3800, hoursPerDay: 6, ageYears: 5, replacementRecommended: false },
      { id: 'ac-unit', name: 'Air Conditioner', brand: 'Mitsubishi', model: 'MSZ-AP35VG', category: 'climate', energyClass: 'A++', annualKWh: 180, standbyWatts: 1, activeWatts: 1050, hoursPerDay: 2, ageYears: 4, replacementRecommended: false },
      { id: 'space-heater', name: 'Garage Space Heater', brand: 'Mill', model: 'AB-H1500DN', category: 'climate', energyClass: 'F', annualKWh: 680, standbyWatts: 1, activeWatts: 1500, hoursPerDay: 3, ageYears: 7, replacementRecommended: true },
      { id: 'fan', name: 'Ceiling Fan', brand: 'Westinghouse', model: 'Bendan', category: 'climate', energyClass: 'A', annualKWh: 18, standbyWatts: 0, activeWatts: 40, hoursPerDay: 3, ageYears: 6, replacementRecommended: false },
      { id: 'vacuum', name: 'Robot Vacuum', brand: 'Roborock', model: 'S8 Pro Ultra', category: 'other', energyClass: 'A', annualKWh: 32, standbyWatts: 3.5, activeWatts: 68, hoursPerDay: 1.5, ageYears: 1, replacementRecommended: false },
      { id: 'hair-dryer', name: 'Hair Dryer', brand: 'Dyson', model: 'Supersonic', category: 'other', energyClass: 'B', annualKWh: 36, standbyWatts: 0, activeWatts: 1600, hoursPerDay: 0.15, ageYears: 3, replacementRecommended: false },
      { id: 'ev-charger', name: 'EV Wall Charger', brand: 'Easee', model: 'Home', category: 'other', energyClass: 'A', annualKWh: 3200, standbyWatts: 2, activeWatts: 7400, hoursPerDay: 3, ageYears: 2, replacementRecommended: false },
      { id: 'dehumidifier', name: 'Dehumidifier', brand: 'Wood\'s', model: 'MDK21', category: 'other', energyClass: 'C', annualKWh: 245, standbyWatts: 1, activeWatts: 420, hoursPerDay: 6, ageYears: 5, replacementRecommended: false },
      { id: 'air-purifier', name: 'Air Purifier', brand: 'Blueair', model: 'Classic 480i', category: 'other', energyClass: 'A', annualKWh: 58, standbyWatts: 0.5, activeWatts: 60, hoursPerDay: 12, ageYears: 2, replacementRecommended: false },
      { id: 'printer', name: 'Laser Printer', brand: 'HP', model: 'LaserJet Pro', category: 'other', energyClass: 'D', annualKWh: 48, standbyWatts: 4, activeWatts: 450, hoursPerDay: 0.5, ageYears: 4, replacementRecommended: false },
      { id: 'towel-heater-1', name: 'Towel Heater Bath 1', brand: 'Norrland', model: 'Comfort 500', category: 'climate', energyClass: 'F', annualKWh: 876, standbyWatts: 0, activeWatts: 500, hoursPerDay: 8, ageYears: 10, replacementRecommended: true },
      { id: 'towel-heater-2', name: 'Towel Heater Bath 2', brand: 'Norrland', model: 'Comfort 300', category: 'climate', energyClass: 'F', annualKWh: 525, standbyWatts: 0, activeWatts: 300, hoursPerDay: 8, ageYears: 10, replacementRecommended: true },
      { id: 'freezer-2', name: 'Garage Freezer', brand: 'Electrolux', model: 'EC2831AOW', category: 'kitchen', energyClass: 'F', annualKWh: 310, standbyWatts: 0, activeWatts: 95, hoursPerDay: 24, ageYears: 12, replacementRecommended: true }
    ];

    for (const def of applianceDefs) {
      const costPerYear = Math.round(def.annualKWh * this.electricityPrice);
      this.appliances[def.id] = { ...def, costPerYear };
    }
    this.homey.log(`[EnergyAudit] Tracked ${Object.keys(this.appliances).length} appliances`);
  }

  _initializeInsulationAudit() {
    this.insulationAudit = {
      walls: {
        currentUValue: 0.28,
        bbrStandard: 0.18,
        meetsStandard: false,
        heatLossKWh: 2800,
        material: 'Mineral wool 150mm',
        recommendedUpgrade: 'Add 100mm external insulation',
        upgradeCostSEK: 185000,
        savingsKWh: 1200,
        savingsSEK: Math.round(1200 * this.electricityPrice)
      },
      roof: {
        currentUValue: 0.15,
        bbrStandard: 0.13,
        meetsStandard: false,
        heatLossKWh: 1400,
        material: 'Blown-in cellulose 350mm',
        recommendedUpgrade: 'Top up to 500mm blown insulation',
        upgradeCostSEK: 42000,
        savingsKWh: 450,
        savingsSEK: Math.round(450 * this.electricityPrice)
      },
      floor: {
        currentUValue: 0.25,
        bbrStandard: 0.15,
        meetsStandard: false,
        heatLossKWh: 1800,
        material: 'EPS 100mm on slab',
        recommendedUpgrade: 'Add underfloor insulation boards',
        upgradeCostSEK: 95000,
        savingsKWh: 700,
        savingsSEK: Math.round(700 * this.electricityPrice)
      },
      windows: {
        currentUValue: 1.4,
        bbrStandard: 1.2,
        meetsStandard: false,
        heatLossKWh: 2200,
        types: { single: 3, double: 11, triple: 3 },
        recommendedUpgrade: 'Replace single/double with triple-glazed (U=0.8)',
        upgradeCostSEK: 165000,
        savingsKWh: 1100,
        savingsSEK: Math.round(1100 * this.electricityPrice)
      },
      doors: {
        currentUValue: 1.6,
        bbrStandard: 1.2,
        meetsStandard: false,
        heatLossKWh: 380,
        count: 3,
        recommendedUpgrade: 'Install insulated steel core doors with weather stripping',
        upgradeCostSEK: 45000,
        savingsKWh: 180,
        savingsSEK: Math.round(180 * this.electricityPrice)
      },
      totalHeatLossKWh: 8580,
      overallMeetsBBR: false
    };
    this.homey.log('[EnergyAudit] Insulation audit initialized');
  }

  _initializeHeatingSystem() {
    this.heatingSystem = {
      primary: {
        type: 'district-heating',
        provider: 'Stockholm Exergi',
        annualCostSEK: 28500,
        annualKWh: 18500,
        efficiency: 92,
        systemAge: 15,
        maintenanceCostSEK: 2500
      },
      secondary: {
        type: 'air-source-heat-pump',
        brand: 'Nibe',
        model: 'F2120-12',
        cop: 3.8,
        annualKWh: 4200,
        annualCostSEK: Math.round(4200 * this.electricityPrice),
        efficiency: 380,
        systemAge: 5
      },
      optimalSettings: {
        daytimeTemp: 21,
        nightTemp: 18,
        awayTemp: 16,
        hotWaterTemp: 55,
        floorHeatingTemp: 28
      },
      temperatureSetbackSavings: {
        oneDegreeLower: { savingsPercent: 5, savingsKWh: 925, savingsSEK: Math.round(925 * this.electricityPrice) },
        nightSetback: { savingsPercent: 8, savingsKWh: 1480, savingsSEK: Math.round(1480 * this.electricityPrice) },
        awaySetback: { savingsPercent: 12, savingsKWh: 2220, savingsSEK: Math.round(2220 * this.electricityPrice) }
      },
      smartThermostatSavings: {
        estimatedPercent: 15,
        estimatedKWh: 2775,
        estimatedSEK: Math.round(2775 * this.electricityPrice),
        implementationCostSEK: 8500
      }
    };
    this.homey.log('[EnergyAudit] Heating system audit initialized');
  }

  _initializeTariffData() {
    this.tariffData = {
      currentTariff: {
        type: 'variable',
        provider: 'Vattenfall',
        avgPriceKWh: 1.85,
        monthlyFixedFee: 49,
        gridFee: 0.42,
        energyTax: 0.392,
        vatPercent: 25
      },
      monthlyBreakdown: [
        { month: 'January', kWh: 2100, costSEK: 4285, avgSpotPrice: 1.42 },
        { month: 'February', kWh: 1950, costSEK: 3860, avgSpotPrice: 1.28 },
        { month: 'March', kWh: 1650, costSEK: 3180, avgSpotPrice: 1.05 },
        { month: 'April', kWh: 1200, costSEK: 2150, avgSpotPrice: 0.68 },
        { month: 'May', kWh: 900, costSEK: 1580, avgSpotPrice: 0.45 },
        { month: 'June', kWh: 750, costSEK: 1320, avgSpotPrice: 0.38 },
        { month: 'July', kWh: 700, costSEK: 1250, avgSpotPrice: 0.35 },
        { month: 'August', kWh: 780, costSEK: 1380, avgSpotPrice: 0.40 },
        { month: 'September', kWh: 950, costSEK: 1685, avgSpotPrice: 0.55 },
        { month: 'October', kWh: 1350, costSEK: 2520, avgSpotPrice: 0.85 },
        { month: 'November', kWh: 1750, costSEK: 3420, avgSpotPrice: 1.15 },
        { month: 'December', kWh: 2200, costSEK: 4520, avgSpotPrice: 1.55 }
      ],
      providerComparison: [
        { provider: 'Vattenfall', type: 'variable', avgMonthly: 2596, annualSEK: 31150, greenEnergy: true, rating: 4.1 },
        { provider: 'E.ON', type: 'variable', avgMonthly: 2485, annualSEK: 29820, greenEnergy: true, rating: 3.9 },
        { provider: 'Fortum', type: 'fixed-1yr', avgMonthly: 2710, annualSEK: 32520, greenEnergy: false, rating: 3.7 },
        { provider: 'Tibber', type: 'spot', avgMonthly: 2350, annualSEK: 28200, greenEnergy: true, rating: 4.5 },
        { provider: 'GodEl', type: 'variable', avgMonthly: 2620, annualSEK: 31440, greenEnergy: true, rating: 4.0 }
      ],
      optimalRecommendation: {
        provider: 'Tibber',
        type: 'spot',
        estimatedAnnualSavings: 2950,
        reason: 'Smart spot-price optimization with hourly rate shifting'
      },
      spotPriceHistory: this._generateSpotPriceHistory()
    };
    this.homey.log('[EnergyAudit] Tariff optimization initialized');
  }

  _generateSpotPriceHistory() {
    const history = [];
    for (let h = 0; h < 24; h++) {
      let price;
      if (h >= 0 && h < 6) price = 0.35 + Math.random() * 0.2;
      else if (h >= 6 && h < 9) price = 1.2 + Math.random() * 0.5;
      else if (h >= 9 && h < 17) price = 0.8 + Math.random() * 0.4;
      else if (h >= 17 && h < 21) price = 1.5 + Math.random() * 0.8;
      else price = 0.6 + Math.random() * 0.3;
      history.push({ hour: h, priceSEK: Math.round(price * 100) / 100, zone: 'SE3' });
    }
    return history;
  }

  _initializeSeasonalProfiles() {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthConsumption = [2100, 1950, 1650, 1200, 900, 750, 700, 780, 950, 1350, 1750, 2200];
    const heatingDD = [680, 590, 510, 320, 120, 20, 0, 0, 80, 280, 480, 620];
    const coolingDD = [0, 0, 0, 0, 5, 25, 45, 35, 10, 0, 0, 0];

    this.seasonalProfiles = {
      monthly: monthNames.map((name, i) => ({
        month: name,
        consumptionKWh: monthConsumption[i],
        heatingDegreeDays: heatingDD[i],
        coolingDegreeDays: coolingDD[i],
        efficiency: Math.round((1 - (monthConsumption[i] / 2200)) * 100),
        weatherCorrelation: heatingDD[i] > 0 ? Math.round((monthConsumption[i] / heatingDD[i]) * 100) / 100 : 0,
        avgTempC: [(-3), (-2), 2, 7, 13, 18, 21, 19, 14, 8, 3, (-1)][i],
        sunHours: [1.5, 3, 5, 7.5, 10, 12, 11.5, 9, 6.5, 4, 2, 1][i]
      })),
      annualTotal: monthConsumption.reduce((a, b) => a + b, 0),
      peakMonth: 'December',
      lowestMonth: 'July',
      heatingSeasonKWh: monthConsumption.slice(0, 4).concat(monthConsumption.slice(9)).reduce((a, b) => a + b, 0),
      coolingSeasonKWh: monthConsumption.slice(5, 8).reduce((a, b) => a + b, 0),
      baseloadKWh: 700 * 12
    };
    this.homey.log('[EnergyAudit] Seasonal profiles initialized');
  }

  _initializeRenewableAssessment() {
    this.renewableAssessment = {
      solar: {
        roofArea: 65,
        usableArea: 42,
        orientation: 'South-Southwest',
        tiltAngle: 30,
        shadingFactor: 0.92,
        panelCapacity: 7.8,
        estimatedAnnualKWh: 7200,
        selfConsumptionPercent: 45,
        gridExportKWh: 3960,
        investmentCostSEK: 125000,
        annualSavingsSEK: Math.round(3240 * this.electricityPrice + 3960 * 0.5),
        paybackYears: 12.5,
        co2SavedKg: 180,
        greenCertificateEligible: true
      },
      heatPump: {
        currentSystem: 'air-source',
        groundSourceSuitable: true,
        estimatedCOP: 4.5,
        boreholesRequired: 2,
        boreholeDepth: 180,
        investmentCostSEK: 285000,
        annualSavingsKWh: 5500,
        annualSavingsSEK: Math.round(5500 * this.electricityPrice),
        paybackYears: 18
      },
      districtHeating: {
        available: true,
        currentlyConnected: true,
        provider: 'Stockholm Exergi',
        renewableShare: 88,
        co2Factor: 0.045
      },
      greenCertificates: {
        type: 'Garanterade Ursprung',
        currentCoverage: 100,
        provider: 'Vattenfall',
        annualCostSEK: 600,
        sourceBreakdown: { wind: 55, hydro: 35, solar: 10 }
      }
    };
    this.homey.log('[EnergyAudit] Renewable assessment initialized');
  }

  _generateRecommendations() {
    this.recommendations = [
      { id: 1, description: 'Replace old garage freezer (12 years) with A-rated model', savingsKWh: 220, savingsSEK: 407, costSEK: 6500, paybackMonths: 16, difficulty: 'easy', category: 'upgrade' },
      { id: 2, description: 'Replace tumble dryer with heat pump dryer (A+++)', savingsKWh: 210, savingsSEK: 389, costSEK: 9500, paybackMonths: 24, difficulty: 'easy', category: 'upgrade' },
      { id: 3, description: 'Install smart power strips for standby elimination', savingsKWh: 175, savingsSEK: 324, costSEK: 2400, paybackMonths: 7, difficulty: 'easy', category: 'upgrade' },
      { id: 4, description: 'Switch to Tibber spot-price electricity tariff', savingsKWh: 0, savingsSEK: 2950, costSEK: 0, paybackMonths: 0, difficulty: 'easy', category: 'behavior' },
      { id: 5, description: 'Replace incandescent bulbs with LED (Bathroom 2, Basement)', savingsKWh: 85, savingsSEK: 157, costSEK: 400, paybackMonths: 3, difficulty: 'easy', category: 'upgrade' },
      { id: 6, description: 'Replace fluorescent tubes with LED (Bedroom 3, Laundry, Garage)', savingsKWh: 55, savingsSEK: 102, costSEK: 800, paybackMonths: 8, difficulty: 'easy', category: 'upgrade' },
      { id: 7, description: 'Install timer on towel heaters (reduce 8h to 4h daily)', savingsKWh: 700, savingsSEK: 1295, costSEK: 1200, paybackMonths: 1, difficulty: 'easy', category: 'behavior' },
      { id: 8, description: 'Night temperature setback (21°C to 18°C, 22:00-06:00)', savingsKWh: 1480, savingsSEK: 2738, costSEK: 0, paybackMonths: 0, difficulty: 'easy', category: 'behavior' },
      { id: 9, description: 'Lower daytime temperature by 1°C', savingsKWh: 925, savingsSEK: 1711, costSEK: 0, paybackMonths: 0, difficulty: 'easy', category: 'behavior' },
      { id: 10, description: 'Schedule EV charging during off-peak hours (00:00-06:00)', savingsKWh: 0, savingsSEK: 3200, costSEK: 0, paybackMonths: 0, difficulty: 'easy', category: 'behavior' },
      { id: 11, description: 'Install motion sensors in hallway and bathroom lighting', savingsKWh: 120, savingsSEK: 222, costSEK: 1800, paybackMonths: 8, difficulty: 'medium', category: 'upgrade' },
      { id: 12, description: 'Add weather-stripping to doors and single-glazed windows', savingsKWh: 280, savingsSEK: 518, costSEK: 3500, paybackMonths: 7, difficulty: 'medium', category: 'upgrade' },
      { id: 13, description: 'Replace garage space heater with infrared panel heater', savingsKWh: 340, savingsSEK: 629, costSEK: 4500, paybackMonths: 7, difficulty: 'medium', category: 'upgrade' },
      { id: 14, description: 'Install smart thermostatic radiator valves (all rooms)', savingsKWh: 2775, savingsSEK: 5134, costSEK: 8500, paybackMonths: 2, difficulty: 'medium', category: 'upgrade' },
      { id: 15, description: 'Run dishwasher and washing machine during off-peak only', savingsKWh: 0, savingsSEK: 850, costSEK: 0, paybackMonths: 0, difficulty: 'easy', category: 'behavior' },
      { id: 16, description: 'Install whole-house energy monitor (real-time feedback)', savingsKWh: 480, savingsSEK: 888, costSEK: 3200, paybackMonths: 4, difficulty: 'medium', category: 'upgrade' },
      { id: 17, description: 'Top up roof insulation to 500mm blown cellulose', savingsKWh: 450, savingsSEK: 833, costSEK: 42000, paybackMonths: 50, difficulty: 'hard', category: 'renovation' },
      { id: 18, description: 'Replace single-glazed windows (3x) with triple-glazed', savingsKWh: 620, savingsSEK: 1147, costSEK: 75000, paybackMonths: 65, difficulty: 'hard', category: 'renovation' },
      { id: 19, description: 'Add 100mm external wall insulation', savingsKWh: 1200, savingsSEK: 2220, costSEK: 185000, paybackMonths: 83, difficulty: 'hard', category: 'renovation' },
      { id: 20, description: 'Install 7.8 kWp rooftop solar PV system', savingsKWh: 3240, savingsSEK: 7974, costSEK: 125000, paybackMonths: 150, difficulty: 'hard', category: 'renovation' },
      { id: 21, description: 'Upgrade to ground-source heat pump', savingsKWh: 5500, savingsSEK: 10175, costSEK: 285000, paybackMonths: 216, difficulty: 'hard', category: 'renovation' },
      { id: 22, description: 'Reduce shower time by 2 minutes per person', savingsKWh: 520, savingsSEK: 962, costSEK: 0, paybackMonths: 0, difficulty: 'easy', category: 'behavior' },
      { id: 23, description: 'Install low-flow showerheads', savingsKWh: 380, savingsSEK: 703, costSEK: 1200, paybackMonths: 2, difficulty: 'easy', category: 'upgrade' },
      { id: 24, description: 'Enable eco-mode on dishwasher and washing machine', savingsKWh: 95, savingsSEK: 176, costSEK: 0, paybackMonths: 0, difficulty: 'easy', category: 'behavior' },
      { id: 25, description: 'Install home battery storage (13.5 kWh) for solar + arbitrage', savingsKWh: 800, savingsSEK: 4500, costSEK: 95000, paybackMonths: 253, difficulty: 'hard', category: 'renovation' },
      { id: 26, description: 'Replace old chest freezer (8 years, E-rated) with A-rated', savingsKWh: 130, savingsSEK: 241, costSEK: 5500, paybackMonths: 23, difficulty: 'easy', category: 'upgrade' },
      { id: 27, description: 'Use laptop instead of desktop when possible', savingsKWh: 180, savingsSEK: 333, costSEK: 0, paybackMonths: 0, difficulty: 'easy', category: 'behavior' }
    ];
    this.recommendations.sort((a, b) => a.paybackMonths - b.paybackMonths);
    this.homey.log(`[EnergyAudit] Generated ${this.recommendations.length} recommendations`);
  }

  _calculateCarbonFootprint() {
    const totalElectricityKWh = this.seasonalProfiles.annualTotal || 16280;
    const heatingKWh = this.heatingSystem.primary.annualKWh || 18500;
    const swedenElectricityCO2 = 0.025;
    const districtHeatingCO2 = 0.045;

    this.carbonFootprint = {
      electricity: {
        annualKWh: totalElectricityKWh,
        co2Factor: swedenElectricityCO2,
        co2Kg: Math.round(totalElectricityKWh * swedenElectricityCO2)
      },
      heating: {
        annualKWh: heatingKWh,
        co2Factor: districtHeatingCO2,
        co2Kg: Math.round(heatingKWh * districtHeatingCO2)
      },
      transport: {
        evAnnualKm: 15000,
        evKWhPer100km: 18,
        co2Kg: Math.round(15000 * 0.18 * swedenElectricityCO2)
      },
      waste: {
        estimatedCO2Kg: 180
      },
      total: 0,
      perPerson: 0,
      swedenAvgPerPerson: 4500,
      comparisonPercent: 0,
      reductionTargets: {
        year1: 0,
        year3: 0,
        year5: 0
      }
    };

    const totalCO2 = this.carbonFootprint.electricity.co2Kg +
      this.carbonFootprint.heating.co2Kg +
      this.carbonFootprint.transport.co2Kg +
      this.carbonFootprint.waste.estimatedCO2Kg;
    this.carbonFootprint.total = totalCO2;
    this.carbonFootprint.perPerson = Math.round(totalCO2 / this.property.residents);
    this.carbonFootprint.comparisonPercent = Math.round((this.carbonFootprint.perPerson / this.carbonFootprint.swedenAvgPerPerson) * 100);
    this.carbonFootprint.reductionTargets.year1 = Math.round(totalCO2 * 0.9);
    this.carbonFootprint.reductionTargets.year3 = Math.round(totalCO2 * 0.7);
    this.carbonFootprint.reductionTargets.year5 = Math.round(totalCO2 * 0.5);
    this.homey.log(`[EnergyAudit] Carbon footprint: ${totalCO2} kg CO2/year`);
  }

  _initializeBenchmarks() {
    const annualKWh = this.seasonalProfiles.annualTotal || 16280;
    const kwhPerSqm = Math.round(annualKWh / this.property.totalArea);

    this.benchmarkData = {
      property: {
        annualKWh,
        kwhPerSqm,
        epcRating: this._calculateEPCRating(kwhPerSqm)
      },
      similarHomes: {
        description: `${this.property.totalArea}m² house, built ${this.property.buildYear}, ${this.property.region}`,
        avgKwhPerSqm: 125,
        medianKwhPerSqm: 118,
        percentile: this._calculatePercentile(kwhPerSqm, 125, 40)
      },
      swedenAverage: {
        detachedHouseKwhPerSqm: 135,
        apartmentKwhPerSqm: 95,
        nationalAvgKwhPerSqm: 115
      },
      euAverage: {
        kwhPerSqm: 160,
        bestCountry: 'Denmark',
        bestKwhPerSqm: 90,
        worstCountry: 'Bulgaria',
        worstKwhPerSqm: 250
      },
      bestInClass: {
        passiveHouseKwhPerSqm: 15,
        nearlyZeroEnergyKwhPerSqm: 25,
        newBuildStandardKwhPerSqm: 55
      }
    };
    this.homey.log('[EnergyAudit] Benchmarks initialized');
  }

  _calculateEPCRating(kwhPerSqm) {
    if (kwhPerSqm <= 50) return 'A';
    if (kwhPerSqm <= 75) return 'B';
    if (kwhPerSqm <= 100) return 'C';
    if (kwhPerSqm <= 130) return 'D';
    if (kwhPerSqm <= 170) return 'E';
    if (kwhPerSqm <= 220) return 'F';
    return 'G';
  }

  _calculatePercentile(value, mean, stddev) {
    const z = (value - mean) / stddev;
    const pct = Math.round(50 * (1 + this._erf(z / Math.sqrt(2))));
    return Math.max(1, Math.min(99, pct));
  }

  _erf(x) {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    const absX = Math.abs(x);
    const t = 1.0 / (1.0 + p * absX);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
    return sign * y;
  }

  _initializeCostProjections() {
    const currentAnnualCost = this.tariffData.monthlyBreakdown
      ? this.tariffData.monthlyBreakdown.reduce((sum, m) => sum + m.costSEK, 0)
      : 31150;
    const inflationRate = 0.03;
    const energyPriceTrend = 0.04;

    this.costProjections = {
      currentAnnualCost,
      scenarios: {
        noChange: {
          year1: Math.round(currentAnnualCost * (1 + energyPriceTrend)),
          year5: Math.round(currentAnnualCost * Math.pow(1 + energyPriceTrend, 5)),
          year10: Math.round(currentAnnualCost * Math.pow(1 + energyPriceTrend, 10)),
          cumulative5Year: this._cumulativeCost(currentAnnualCost, energyPriceTrend, 5),
          cumulative10Year: this._cumulativeCost(currentAnnualCost, energyPriceTrend, 10)
        },
        easyImprovements: {
          investmentCostSEK: 0,
          annualSavings: 12019,
          year1: Math.round((currentAnnualCost - 12019) * (1 + energyPriceTrend)),
          year5: Math.round((currentAnnualCost - 12019) * Math.pow(1 + energyPriceTrend, 5)),
          year10: Math.round((currentAnnualCost - 12019) * Math.pow(1 + energyPriceTrend, 10)),
          cumulative5Year: this._cumulativeCost(currentAnnualCost - 12019, energyPriceTrend, 5),
          cumulative10Year: this._cumulativeCost(currentAnnualCost - 12019, energyPriceTrend, 10)
        },
        allUpgrades: {
          investmentCostSEK: 48400,
          annualSavings: 18200,
          year1: Math.round((currentAnnualCost - 18200) * (1 + energyPriceTrend)),
          year5: Math.round((currentAnnualCost - 18200) * Math.pow(1 + energyPriceTrend, 5)),
          year10: Math.round((currentAnnualCost - 18200) * Math.pow(1 + energyPriceTrend, 10)),
          cumulative5Year: this._cumulativeCost(currentAnnualCost - 18200, energyPriceTrend, 5),
          cumulative10Year: this._cumulativeCost(currentAnnualCost - 18200, energyPriceTrend, 10)
        },
        fullRenovation: {
          investmentCostSEK: 560000,
          annualSavings: 28500,
          year1: Math.round((currentAnnualCost - 28500) * (1 + energyPriceTrend)),
          year5: Math.round((currentAnnualCost - 28500) * Math.pow(1 + energyPriceTrend, 5)),
          year10: Math.round((currentAnnualCost - 28500) * Math.pow(1 + energyPriceTrend, 10)),
          cumulative5Year: this._cumulativeCost(currentAnnualCost - 28500, energyPriceTrend, 5),
          cumulative10Year: this._cumulativeCost(currentAnnualCost - 28500, energyPriceTrend, 10)
        }
      },
      inflationRate,
      energyPriceTrend
    };
    this.homey.log('[EnergyAudit] Cost projections initialized');
  }

  _cumulativeCost(annualCost, growthRate, years) {
    let total = 0;
    for (let y = 1; y <= years; y++) {
      total += annualCost * Math.pow(1 + growthRate, y);
    }
    return Math.round(total);
  }

  // --- Periodic tasks ---

  _runPeriodicAudit() {
    try {
      this._detectEnergyWaste();
      this._recordSmartMeterReading();
      this.homey.emit('energy-audit-periodic', {
        timestamp: new Date().toISOString(),
        wasteDetections: this.wasteDetections.length,
        meterReadings: this.smartMeterReadings.length
      });
      this.homey.log('[EnergyAudit] Periodic audit completed');
    } catch (err) {
      this.homey.error('[EnergyAudit] Periodic audit error:', err.message);
    }
  }

  _detectEnergyWaste() {
    const now = new Date();
    const hour = now.getHours();
    const detections = [];

    // Phantom/standby loads
    const standbyAppliances = Object.values(this.appliances).filter(a => a.standbyWatts >= 3);
    for (const app of standbyAppliances) {
      const annualStandbyKWh = Math.round((app.standbyWatts * (24 - app.hoursPerDay) * 365) / 1000);
      if (annualStandbyKWh > 15) {
        detections.push({
          type: 'phantom-load',
          appliance: app.name,
          standbyWatts: app.standbyWatts,
          annualWasteKWh: annualStandbyKWh,
          annualCostSEK: Math.round(annualStandbyKWh * this.electricityPrice),
          recommendation: `Use smart plug to cut standby power for ${app.name}`,
          detectedAt: now.toISOString()
        });
      }
    }

    // Inefficient appliances
    const inefficient = Object.values(this.appliances).filter(a =>
      ['E', 'F', 'G'].includes(a.energyClass) && a.annualKWh > 100
    );
    for (const app of inefficient) {
      detections.push({
        type: 'inefficient-appliance',
        appliance: app.name,
        energyClass: app.energyClass,
        ageYears: app.ageYears,
        annualKWh: app.annualKWh,
        recommendation: app.replacementRecommended
          ? `Replace ${app.name} (${app.ageYears} years, class ${app.energyClass}) with modern A-rated model`
          : `Monitor ${app.name} usage and consider upgrade when due`,
        detectedAt: now.toISOString()
      });
    }

    // Over-heating detection (simulated)
    if (hour >= 0 && hour < 6) {
      const nightTemp = 18 + Math.random() * 4;
      if (nightTemp > 20) {
        detections.push({
          type: 'over-heating',
          location: 'Whole house',
          currentTemp: Math.round(nightTemp * 10) / 10,
          recommendedTemp: 18,
          wasteKWhPerDay: Math.round((nightTemp - 18) * 1.5 * 10) / 10,
          recommendation: 'Enable night setback to 18°C between 22:00-06:00',
          detectedAt: now.toISOString()
        });
      }
    }

    // Lights left on (simulated)
    if (hour >= 23 || hour < 5) {
      const lightRooms = ['Hallway', 'Bathroom 2', 'Garage'];
      for (const room of lightRooms) {
        if (Math.random() > 0.5) {
          detections.push({
            type: 'lights-left-on',
            location: room,
            wasteWatts: room === 'Garage' ? 72 : 40,
            recommendation: `Install motion sensor or auto-off timer in ${room}`,
            detectedAt: now.toISOString()
          });
        }
      }
    }

    // Scheduling opportunities
    if (hour >= 17 && hour <= 20) {
      detections.push({
        type: 'scheduling-opportunity',
        appliance: 'Dishwasher',
        currentSchedule: 'Peak hours (17:00-20:00)',
        optimalSchedule: 'Off-peak (00:00-06:00)',
        potentialSavingsSEK: Math.round(75 * 0.8),
        recommendation: 'Use delay start to run dishwasher during off-peak hours',
        detectedAt: now.toISOString()
      });
    }

    this.wasteDetections = detections;
    if (detections.length > 0) {
      this.homey.emit('energy-waste-detected', { count: detections.length, detections: detections.slice(0, 5) });
    }
  }

  _recordSmartMeterReading() {
    const now = new Date();
    const hour = now.getHours();
    const month = now.getMonth();

    // Seasonal base load factor
    const seasonalFactors = [1.4, 1.3, 1.1, 0.85, 0.65, 0.55, 0.5, 0.56, 0.68, 0.92, 1.2, 1.45];
    const factor = seasonalFactors[month] || 1.0;

    // Time-of-day pattern
    let todFactor;
    if (hour >= 0 && hour < 6) todFactor = 0.4;
    else if (hour >= 6 && hour < 9) todFactor = 1.2;
    else if (hour >= 9 && hour < 12) todFactor = 0.8;
    else if (hour >= 12 && hour < 14) todFactor = 1.0;
    else if (hour >= 14 && hour < 17) todFactor = 0.7;
    else if (hour >= 17 && hour < 21) todFactor = 1.5;
    else todFactor = 0.6;

    const baseKWh = 1.8;
    const reading = Math.round((baseKWh * factor * todFactor + (Math.random() * 0.5 - 0.25)) * 100) / 100;
    const peakDemandW = Math.round(reading * 4000 + Math.random() * 500);

    const entry = {
      timestamp: now.toISOString(),
      intervalMinutes: 15,
      kWh: Math.max(0.1, reading),
      peakDemandW,
      cumulativeDayKWh: 0,
      spotPriceSEK: this._getCurrentSpotPrice(hour),
      costSEK: Math.round(reading * this._getCurrentSpotPrice(hour) * 100) / 100
    };

    this.smartMeterReadings.push(entry);
    if (this.smartMeterReadings.length > 96 * 7) {
      this.smartMeterReadings = this.smartMeterReadings.slice(-96 * 7);
    }

    // Calculate cumulative
    const today = now.toISOString().slice(0, 10);
    let cumulative = 0;
    for (const r of this.smartMeterReadings) {
      if (r.timestamp.startsWith(today)) {
        cumulative += r.kWh;
      }
    }
    entry.cumulativeDayKWh = Math.round(cumulative * 100) / 100;

    // Peak demand identification
    if (peakDemandW > 8000) {
      this.homey.emit('energy-peak-demand', {
        timestamp: now.toISOString(),
        demandW: peakDemandW,
        recommendation: 'Consider load shifting to reduce peak demand'
      });
    }
  }

  _getCurrentSpotPrice(hour) {
    if (this.tariffData.spotPriceHistory && this.tariffData.spotPriceHistory[hour]) {
      return this.tariffData.spotPriceHistory[hour].priceSEK;
    }
    if (hour >= 0 && hour < 6) return 0.42;
    if (hour >= 17 && hour < 21) return 1.85;
    return 0.95;
  }

  _generateQuarterlySnapshot() {
    const now = new Date();
    const totalRoomConsumption = Object.values(this.rooms).reduce((sum, r) => sum + r.consumptionKWh, 0);
    const totalApplianceCost = Object.values(this.appliances).reduce((sum, a) => sum + a.costPerYear, 0);

    const snapshot = {
      timestamp: now.toISOString(),
      quarter: `Q${Math.ceil((now.getMonth() + 1) / 3)} ${now.getFullYear()}`,
      summary: {
        totalAnnualKWh: this.seasonalProfiles.annualTotal || 16280,
        totalAnnualCostSEK: this.costProjections.currentAnnualCost || 31150,
        epcRating: this.benchmarkData.property ? this.benchmarkData.property.epcRating : 'D',
        carbonFootprintKg: this.carbonFootprint.total || 0,
        wasteDetections: this.wasteDetections.length,
        recommendationsCount: this.recommendations.length,
        topRecommendation: this.recommendations.length > 0 ? this.recommendations[0].description : 'N/A'
      },
      roomConsumption: totalRoomConsumption,
      applianceCost: totalApplianceCost,
      improvementsImplemented: this.auditHistory.length > 0
        ? this._trackImprovements()
        : [],
      goalProgress: this._calculateGoalProgress()
    };

    this.auditHistory.push(snapshot);
    if (this.auditHistory.length > 20) {
      this.auditHistory = this.auditHistory.slice(-20);
    }

    this.homey.emit('energy-audit-snapshot', snapshot);
    this.homey.log(`[EnergyAudit] Quarterly snapshot saved: ${snapshot.quarter}`);
  }

  _trackImprovements() {
    if (this.auditHistory.length < 2) return [];
    const prev = this.auditHistory[this.auditHistory.length - 1];
    const improvements = [];
    if (prev && prev.summary) {
      const currentKWh = this.seasonalProfiles.annualTotal || 16280;
      const prevKWh = prev.summary.totalAnnualKWh;
      if (currentKWh < prevKWh) {
        improvements.push({
          metric: 'annualKWh',
          previous: prevKWh,
          current: currentKWh,
          changePercent: Math.round(((prevKWh - currentKWh) / prevKWh) * 100)
        });
      }
    }
    return improvements;
  }

  _calculateGoalProgress() {
    const targets = this.carbonFootprint.reductionTargets || {};
    const currentCO2 = this.carbonFootprint.total || 1500;
    return {
      year1Target: targets.year1 || 0,
      year3Target: targets.year3 || 0,
      year5Target: targets.year5 || 0,
      currentCO2,
      progressPercent: targets.year1 ? Math.round((1 - currentCO2 / (currentCO2 * 1.1)) * 100) : 0
    };
  }

  // --- EPC Simulation ---

  getEPCSimulation() {
    const totalKWh = this.seasonalProfiles.annualTotal || 16280;
    const heatingKWh = this.heatingSystem.primary.annualKWh || 18500;
    const totalPrimaryEnergy = totalKWh + heatingKWh;
    const primaryEnergyIndicator = Math.round(totalPrimaryEnergy / this.property.totalArea);
    const currentRating = this._calculateEPCRating(primaryEnergyIndicator);

    const improvementSteps = [];
    let projectedKwhPerSqm = primaryEnergyIndicator;
    const stepActions = [
      { action: 'Install smart thermostatic valves', reductionKWh: 2775 },
      { action: 'Night temperature setback', reductionKWh: 1480 },
      { action: 'Top up roof insulation', reductionKWh: 450 },
      { action: 'Replace windows with triple-glazed', reductionKWh: 1100 },
      { action: 'Add external wall insulation', reductionKWh: 1200 },
      { action: 'Install solar PV system', reductionKWh: 3240 },
      { action: 'Upgrade to ground-source heat pump', reductionKWh: 5500 }
    ];

    for (const step of stepActions) {
      const newIndicator = Math.round(projectedKwhPerSqm - (step.reductionKWh / this.property.totalArea));
      const newRating = this._calculateEPCRating(newIndicator);
      improvementSteps.push({
        action: step.action,
        reductionKWh: step.reductionKWh,
        kwhPerSqmAfter: newIndicator,
        ratingAfter: newRating
      });
      projectedKwhPerSqm = newIndicator;
    }

    return {
      format: 'Swedish Energideklaration',
      propertyType: 'Detached house (Villa)',
      buildYear: this.property.buildYear,
      totalArea: this.property.totalArea,
      primaryEnergyIndicator,
      currentRating,
      targetRating: 'B',
      improvementSteps,
      potentialRating: this._calculateEPCRating(projectedKwhPerSqm),
      registeredDate: new Date().toISOString().slice(0, 10),
      validUntil: new Date(Date.now() + 10 * 365 * 86400000).toISOString().slice(0, 10)
    };
  }

  // --- Load Shifting Analysis ---

  getLoadShiftingOpportunities() {
    const opportunities = [];
    const shiftableAppliances = [
      { name: 'Dishwasher', currentHour: 19, optimalHour: 2, kWhPerCycle: 1.2 },
      { name: 'Washing Machine', currentHour: 10, optimalHour: 3, kWhPerCycle: 0.9 },
      { name: 'Tumble Dryer', currentHour: 11, optimalHour: 4, kWhPerCycle: 2.8 },
      { name: 'EV Charger', currentHour: 18, optimalHour: 1, kWhPerCycle: 22 }
    ];

    for (const app of shiftableAppliances) {
      const currentPrice = this._getCurrentSpotPrice(app.currentHour);
      const optimalPrice = this._getCurrentSpotPrice(app.optimalHour);
      const savingsPerCycle = Math.round((currentPrice - optimalPrice) * app.kWhPerCycle * 100) / 100;

      opportunities.push({
        appliance: app.name,
        currentSchedule: `${app.currentHour}:00`,
        optimalSchedule: `${String(app.optimalHour).padStart(2, '0')}:00`,
        kWhPerCycle: app.kWhPerCycle,
        currentPriceSEK: currentPrice,
        optimalPriceSEK: optimalPrice,
        savingsPerCycleSEK: Math.max(0, savingsPerCycle),
        annualSavingsSEK: Math.max(0, Math.round(savingsPerCycle * 365))
      });
    }

    return {
      opportunities,
      totalAnnualSavingsSEK: opportunities.reduce((sum, o) => sum + o.annualSavingsSEK, 0),
      peakHours: '17:00-21:00',
      offPeakHours: '00:00-06:00'
    };
  }

  // --- Audit Report ---

  generateAuditReport() {
    const report = {
      generatedAt: new Date().toISOString(),
      reportId: `EAR-${Date.now()}`,
      executiveSummary: {
        propertyAddress: `${this.property.region}, Sweden`,
        propertyType: 'Detached house (Villa)',
        buildYear: this.property.buildYear,
        totalArea: this.property.totalArea,
        residents: this.property.residents,
        epcRating: this.benchmarkData.property ? this.benchmarkData.property.epcRating : 'D',
        annualEnergyKWh: this.seasonalProfiles.annualTotal || 16280,
        annualEnergyCostSEK: this.costProjections.currentAnnualCost || 31150,
        annualCO2Kg: this.carbonFootprint.total || 0,
        estimatedTotalSavingsSEK: this.recommendations.reduce((sum, r) => sum + r.savingsSEK, 0),
        estimatedTotalSavingsKWh: this.recommendations.reduce((sum, r) => sum + r.savingsKWh, 0),
        topPriorityActions: this.recommendations.slice(0, 5).map(r => r.description)
      },
      roomAnalysis: Object.values(this.rooms).map(room => ({
        name: room.name,
        area: room.area,
        consumptionKWh: room.consumptionKWh,
        efficiencyRating: room.efficiencyRating,
        improvementPotentialKWh: room.improvementPotential,
        estimatedSavingsSEK: room.estimatedSavingsSEK,
        lightingType: room.lightingType,
        insulation: room.insulation
      })),
      applianceAnalysis: {
        totalAppliances: Object.keys(this.appliances).length,
        totalAnnualKWh: Object.values(this.appliances).reduce((sum, a) => sum + a.annualKWh, 0),
        totalAnnualCostSEK: Object.values(this.appliances).reduce((sum, a) => sum + a.costPerYear, 0),
        replacementRecommended: Object.values(this.appliances).filter(a => a.replacementRecommended).map(a => ({
          name: a.name,
          brand: a.brand,
          model: a.model,
          ageYears: a.ageYears,
          energyClass: a.energyClass,
          annualKWh: a.annualKWh,
          costPerYear: a.costPerYear
        })),
        byCategory: this._groupAppliancesByCategory()
      },
      insulationSummary: this.insulationAudit,
      heatingSummary: this.heatingSystem,
      tariffSummary: {
        currentProvider: this.tariffData.currentTariff ? this.tariffData.currentTariff.provider : 'Unknown',
        currentType: this.tariffData.currentTariff ? this.tariffData.currentTariff.type : 'Unknown',
        recommendation: this.tariffData.optimalRecommendation || {},
        monthlyBreakdown: this.tariffData.monthlyBreakdown || []
      },
      recommendationsRankedByROI: this.recommendations.map(r => ({
        rank: r.id,
        description: r.description,
        savingsKWh: r.savingsKWh,
        savingsSEK: r.savingsSEK,
        costSEK: r.costSEK,
        paybackMonths: r.paybackMonths,
        difficulty: r.difficulty,
        category: r.category,
        roi: r.costSEK > 0 ? Math.round((r.savingsSEK / r.costSEK) * 100) : 999
      })).sort((a, b) => b.roi - a.roi),
      carbonFootprintSummary: this.carbonFootprint,
      benchmarkSummary: this.benchmarkData,
      costProjectionSummary: this.costProjections,
      renewableEnergySummary: this.renewableAssessment
    };

    this.auditReports.push({ id: report.reportId, generatedAt: report.generatedAt });
    if (this.auditReports.length > 10) {
      this.auditReports = this.auditReports.slice(-10);
    }

    this.homey.emit('energy-audit-report-generated', {
      reportId: report.reportId,
      epcRating: report.executiveSummary.epcRating,
      annualCostSEK: report.executiveSummary.annualEnergyCostSEK,
      potentialSavingsSEK: report.executiveSummary.estimatedTotalSavingsSEK
    });

    this.homey.log(`[EnergyAudit] Audit report generated: ${report.reportId}`);
    return report;
  }

  _groupAppliancesByCategory() {
    const groups = {};
    for (const app of Object.values(this.appliances)) {
      if (!groups[app.category]) {
        groups[app.category] = { count: 0, totalKWh: 0, totalCostSEK: 0, appliances: [] };
      }
      groups[app.category].count += 1;
      groups[app.category].totalKWh += app.annualKWh;
      groups[app.category].totalCostSEK += app.costPerYear;
      groups[app.category].appliances.push(app.name);
    }
    return groups;
  }

  // --- Public API methods ---

  getRoomAnalysis(roomName) {
    if (roomName && this.rooms[roomName]) {
      return this.rooms[roomName];
    }
    return Object.values(this.rooms);
  }

  getApplianceReport(applianceId) {
    if (applianceId && this.appliances[applianceId]) {
      return this.appliances[applianceId];
    }
    return Object.values(this.appliances);
  }

  getInsulationAudit() {
    return this.insulationAudit;
  }

  getHeatingAudit() {
    return this.heatingSystem;
  }

  getTariffOptimization() {
    return this.tariffData;
  }

  getWasteDetections() {
    return this.wasteDetections;
  }

  getSeasonalProfile() {
    return this.seasonalProfiles;
  }

  getRenewableAssessment() {
    return this.renewableAssessment;
  }

  getRecommendations(filter) {
    if (!filter) return this.recommendations;
    if (filter.category) {
      return this.recommendations.filter(r => r.category === filter.category);
    }
    if (filter.difficulty) {
      return this.recommendations.filter(r => r.difficulty === filter.difficulty);
    }
    if (filter.maxPaybackMonths) {
      return this.recommendations.filter(r => r.paybackMonths <= filter.maxPaybackMonths);
    }
    return this.recommendations;
  }

  getCarbonFootprint() {
    return this.carbonFootprint;
  }

  getBenchmarks() {
    return this.benchmarkData;
  }

  getAuditHistory() {
    return this.auditHistory;
  }

  getSmartMeterData(hours) {
    if (!hours) return this.smartMeterReadings.slice(-96);
    const count = Math.min(hours * 4, this.smartMeterReadings.length);
    return this.smartMeterReadings.slice(-count);
  }

  getCostProjections() {
    return this.costProjections;
  }

  // --- Statistics ---

  getStatistics() {
    const totalApplianceKWh = Object.values(this.appliances).reduce((sum, a) => sum + a.annualKWh, 0);
    const totalApplianceCost = Object.values(this.appliances).reduce((sum, a) => sum + a.costPerYear, 0);
    const replacementCount = Object.values(this.appliances).filter(a => a.replacementRecommended).length;

    return {
      initialized: this.initialized,
      rooms: {
        count: Object.keys(this.rooms).length,
        totalAreaSqm: Object.values(this.rooms).reduce((sum, r) => sum + r.area, 0),
        totalConsumptionKWh: Object.values(this.rooms).reduce((sum, r) => sum + r.consumptionKWh, 0),
        totalSavingsPotentialSEK: Object.values(this.rooms).reduce((sum, r) => sum + r.estimatedSavingsSEK, 0)
      },
      appliances: {
        count: Object.keys(this.appliances).length,
        totalAnnualKWh: totalApplianceKWh,
        totalAnnualCostSEK: totalApplianceCost,
        replacementRecommended: replacementCount
      },
      insulation: {
        meetsBBR: this.insulationAudit.overallMeetsBBR || false,
        totalHeatLossKWh: this.insulationAudit.totalHeatLossKWh || 0
      },
      epcRating: this.benchmarkData.property ? this.benchmarkData.property.epcRating : 'N/A',
      carbonFootprint: {
        totalKg: this.carbonFootprint.total || 0,
        perPersonKg: this.carbonFootprint.perPerson || 0,
        vsSwedishAvgPercent: this.carbonFootprint.comparisonPercent || 0
      },
      recommendations: {
        count: this.recommendations.length,
        totalSavingsKWh: this.recommendations.reduce((sum, r) => sum + r.savingsKWh, 0),
        totalSavingsSEK: this.recommendations.reduce((sum, r) => sum + r.savingsSEK, 0),
        easyActions: this.recommendations.filter(r => r.difficulty === 'easy').length,
        mediumActions: this.recommendations.filter(r => r.difficulty === 'medium').length,
        hardActions: this.recommendations.filter(r => r.difficulty === 'hard').length
      },
      meterReadings: this.smartMeterReadings.length,
      auditSnapshots: this.auditHistory.length,
      auditReports: this.auditReports.length,
      wasteDetections: this.wasteDetections.length,
      annualEnergyCostSEK: this.costProjections.currentAnnualCost || 0,
      intervals: this.intervals.length
    };
  }

  destroy() {
    for (const i of this.intervals) clearInterval(i);
    this.intervals = [];
    this.homey.log('[EnergyAudit] destroyed');
  }
}

module.exports = HomeEnergyAuditSystem;
