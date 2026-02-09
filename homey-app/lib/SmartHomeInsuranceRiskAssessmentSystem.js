'use strict';

const EventEmitter = require('events');

class SmartHomeInsuranceRiskAssessmentSystem extends EventEmitter {
  constructor(homey) {
    super();
    this.homey = homey;
    this.initialized = false;
    this.intervals = [];

    // Risk categories - 10 types
    this.riskCategories = {
      fire: {
        probability: 0.02,
        potentialCostSEK: 2500000,
        mitigationFactors: ['smoke_detectors', 'fire_extinguishers', 'sprinkler_system', 'chimney_sweep'],
        currentRiskLevel: 'medium',
        lastAssessed: null,
        trend: 'stable'
      },
      'water-damage': {
        probability: 0.08,
        potentialCostSEK: 800000,
        mitigationFactors: ['leak_sensors', 'auto_shutoff', 'plumbing_maintenance', 'drainage_inspection'],
        currentRiskLevel: 'medium',
        lastAssessed: null,
        trend: 'stable'
      },
      burglary: {
        probability: 0.04,
        potentialCostSEK: 350000,
        mitigationFactors: ['burglar_alarm', 'smart_locks', 'camera_system', 'motion_sensors'],
        currentRiskLevel: 'medium',
        lastAssessed: null,
        trend: 'stable'
      },
      'electrical-fault': {
        probability: 0.03,
        potentialCostSEK: 600000,
        mitigationFactors: ['electrical_inspection', 'surge_protection', 'modern_wiring', 'circuit_breakers'],
        currentRiskLevel: 'medium',
        lastAssessed: null,
        trend: 'stable'
      },
      storm: {
        probability: 0.06,
        potentialCostSEK: 450000,
        mitigationFactors: ['roof_maintenance', 'tree_trimming', 'storm_shutters', 'gutter_cleaning'],
        currentRiskLevel: 'medium',
        lastAssessed: null,
        trend: 'stable'
      },
      liability: {
        probability: 0.01,
        potentialCostSEK: 1000000,
        mitigationFactors: ['pathway_maintenance', 'lighting', 'handrails', 'insurance_coverage'],
        currentRiskLevel: 'low',
        lastAssessed: null,
        trend: 'stable'
      },
      'appliance-failure': {
        probability: 0.10,
        potentialCostSEK: 150000,
        mitigationFactors: ['regular_servicing', 'age_monitoring', 'surge_protection', 'warranty_tracking'],
        currentRiskLevel: 'medium',
        lastAssessed: null,
        trend: 'stable'
      },
      mold: {
        probability: 0.05,
        potentialCostSEK: 500000,
        mitigationFactors: ['ventilation', 'humidity_control', 'moisture_barriers', 'regular_inspection'],
        currentRiskLevel: 'low',
        lastAssessed: null,
        trend: 'stable'
      },
      pest: {
        probability: 0.03,
        potentialCostSEK: 100000,
        mitigationFactors: ['sealed_entry_points', 'regular_inspection', 'cleanliness', 'pest_control_service'],
        currentRiskLevel: 'low',
        lastAssessed: null,
        trend: 'stable'
      },
      vandalism: {
        probability: 0.02,
        potentialCostSEK: 200000,
        mitigationFactors: ['camera_system', 'motion_lights', 'fencing', 'neighborhood_watch'],
        currentRiskLevel: 'low',
        lastAssessed: null,
        trend: 'stable'
      }
    };

    // Insurance policies - 3 Swedish policies
    this.insurancePolicies = {
      hemforsakring: {
        name: 'Hemf\u00f6rs\u00e4kring',
        provider: 'Folksam',
        policyNumber: 'FS-2024-HEM-78234',
        premiumSEKMonth: 485,
        coverageSEK: 1500000,
        deductibleSEK: 1500,
        startDate: '2024-01-01',
        endDate: '2025-12-31',
        coverageTypes: ['personal_property', 'liability', 'legal_expenses', 'travel', 'assault', 'identity_theft'],
        discounts: [
          { type: 'smart_home', percentOff: 8, applied: true },
          { type: 'claims_free_5yr', percentOff: 10, applied: true },
          { type: 'bundled_policy', percentOff: 5, applied: true }
        ],
        claimsHistory: []
      },
      villaforsakring: {
        name: 'Villaf\u00f6rs\u00e4kring',
        provider: 'Trygg-Hansa',
        policyNumber: 'TH-2024-VIL-45912',
        premiumSEKMonth: 1250,
        coverageSEK: 6500000,
        deductibleSEK: 3000,
        startDate: '2024-03-01',
        endDate: '2026-02-28',
        coverageTypes: ['building', 'water_damage', 'fire', 'storm', 'theft', 'electrical', 'glass', 'pest'],
        discounts: [
          { type: 'smart_home', percentOff: 12, applied: true },
          { type: 'security_alarm', percentOff: 5, applied: true }
        ],
        claimsHistory: []
      },
      tillaggsforsakring: {
        name: 'Till\u00e4ggsf\u00f6rs\u00e4kring',
        provider: 'IF Skadef\u00f6rs\u00e4kring',
        policyNumber: 'IF-2024-TIL-33087',
        premiumSEKMonth: 320,
        coverageSEK: 2000000,
        deductibleSEK: 2000,
        startDate: '2024-06-01',
        endDate: '2025-05-31',
        coverageTypes: ['high_value_items', 'extended_water', 'allrisk', 'temporary_housing', 'garden_structures'],
        discounts: [
          { type: 'smart_home', percentOff: 6, applied: true },
          { type: 'multi_policy', percentOff: 3, applied: true }
        ],
        claimsHistory: []
      }
    };

    // Smart home discount tracking
    this.smartHomeDiscounts = {
      smokeDetectors: { installed: true, count: 6, discountPercent: 3, verified: true, lastVerified: '2024-11-15' },
      waterLeakSensors: { installed: true, count: 8, discountPercent: 4, verified: true, lastVerified: '2024-11-15' },
      burglarAlarm: { installed: true, provider: 'Securitas', discountPercent: 5, verified: true, lastVerified: '2024-10-01' },
      smartLocks: { installed: true, count: 3, discountPercent: 2, verified: true, lastVerified: '2024-11-15' },
      cameraSystem: { installed: true, count: 4, discountPercent: 3, verified: true, lastVerified: '2024-11-15' },
      autoShutoff: { installed: true, types: ['water', 'gas'], discountPercent: 2, verified: true, lastVerified: '2024-11-15' }
    };

    // Property details for risk scoring
    this.propertyDetails = {
      buildingAge: 35,
      constructionType: 'brick_and_wood',
      location: 'Stockholm',
      district: 'S\u00f6dermalm',
      floor: 2,
      totalFloors: 4,
      heatingSystem: 'district_heating',
      electricalAge: 12,
      plumbingAge: 15,
      roofCondition: 'good',
      roofAge: 8,
      treeProximity: 5,
      neighborhoodCrimeIndex: 3.2,
      floodZone: false,
      fireDepartmentDistanceKm: 1.8,
      hospitalDistanceKm: 2.5,
      buildingSqm: 145,
      plotSqm: 320
    };

    // Property valuation
    this.propertyValuation = {
      buildingValueSEK: 5800000,
      contentsValueSEK: 950000,
      gardenStructuresValueSEK: 185000,
      totalInsuredValueSEK: 6935000,
      lastValuationDate: '2024-09-15',
      valuationMethod: 'professional_appraisal',
      highValueItems: [
        { name: 'MacBook Pro 16"', category: 'electronics', valueSEK: 35000, purchaseDate: '2024-03-15', serialNumber: 'MBP-2024-X1', insured: true, receiptStored: true },
        { name: 'Samsung 75" QLED TV', category: 'electronics', valueSEK: 28000, purchaseDate: '2023-11-20', serialNumber: 'QN75-2023', insured: true, receiptStored: true },
        { name: 'Engagement Ring', category: 'jewelry', valueSEK: 45000, purchaseDate: '2020-06-10', appraisalValue: 48000, insured: true, receiptStored: true },
        { name: 'Gold Necklace Collection', category: 'jewelry', valueSEK: 22000, purchaseDate: '2019-12-25', insured: true, receiptStored: false },
        { name: 'Oil Painting - Nordic Landscape', category: 'art', valueSEK: 65000, purchaseDate: '2021-05-08', artist: 'Erik Lindstr\u00f6m', insured: true, receiptStored: true },
        { name: 'Watercolor Collection (3 pieces)', category: 'art', valueSEK: 18000, purchaseDate: '2022-09-12', insured: false, receiptStored: false },
        { name: 'Yamaha Grand Piano', category: 'instruments', valueSEK: 95000, purchaseDate: '2018-01-20', model: 'C3X', insured: true, receiptStored: true },
        { name: 'Fender Stratocaster', category: 'instruments', valueSEK: 15000, purchaseDate: '2022-07-04', insured: true, receiptStored: true },
        { name: 'Trek Domane SL7', category: 'bicycles', valueSEK: 42000, purchaseDate: '2024-04-01', frameNumber: 'WTU-345-SL7', insured: true, receiptStored: true },
        { name: 'Cargo Bike Butchers & Bicycles', category: 'bicycles', valueSEK: 55000, purchaseDate: '2023-06-15', insured: true, receiptStored: true },
        { name: 'Fritz Hansen Egg Chair', category: 'designer_furniture', valueSEK: 38000, purchaseDate: '2021-03-10', insured: true, receiptStored: true },
        { name: 'Carl Hansen CH24 Wishbone Set (6)', category: 'designer_furniture', valueSEK: 54000, purchaseDate: '2022-01-20', insured: true, receiptStored: true },
        { name: 'Sony A7IV Camera Kit', category: 'electronics', valueSEK: 32000, purchaseDate: '2023-08-05', serialNumber: 'A7IV-2023-K', insured: true, receiptStored: true }
      ],
      replacementCostMultiplier: 1.15
    };

    // Claims history - 3 historical claims
    this.claimsHistory = [
      {
        claimId: 'CLM-2022-001',
        date: '2022-03-15',
        type: 'water-damage',
        description: 'Dishwasher hose burst causing kitchen floor water damage',
        policy: 'villaforsakring',
        status: 'paid',
        estimatedCostSEK: 85000,
        approvedAmountSEK: 78500,
        paidAmountSEK: 75500,
        deductibleSEK: 3000,
        adjusterVisits: 2,
        documentationComplete: true,
        resolutionDate: '2022-05-20',
        timeline: [
          { date: '2022-03-15', event: 'Incident occurred' },
          { date: '2022-03-16', event: 'Claim submitted' },
          { date: '2022-03-22', event: 'Adjuster first visit' },
          { date: '2022-04-05', event: 'Adjuster second visit' },
          { date: '2022-04-15', event: 'Claim approved' },
          { date: '2022-05-20', event: 'Payment received' }
        ]
      },
      {
        claimId: 'CLM-2023-001',
        date: '2023-01-08',
        type: 'storm',
        description: 'Storm damage to roof tiles and garden fence',
        policy: 'villaforsakring',
        status: 'paid',
        estimatedCostSEK: 42000,
        approvedAmountSEK: 40000,
        paidAmountSEK: 37000,
        deductibleSEK: 3000,
        adjusterVisits: 1,
        documentationComplete: true,
        resolutionDate: '2023-03-10',
        timeline: [
          { date: '2023-01-08', event: 'Storm damage occurred' },
          { date: '2023-01-09', event: 'Claim submitted with photos' },
          { date: '2023-01-18', event: 'Adjuster visit' },
          { date: '2023-02-01', event: 'Claim approved' },
          { date: '2023-03-10', event: 'Payment received' }
        ]
      },
      {
        claimId: 'CLM-2024-001',
        date: '2024-07-22',
        type: 'burglary',
        description: 'Bicycle stolen from shared storage area',
        policy: 'hemforsakring',
        status: 'paid',
        estimatedCostSEK: 28000,
        approvedAmountSEK: 25000,
        paidAmountSEK: 23500,
        deductibleSEK: 1500,
        adjusterVisits: 0,
        documentationComplete: true,
        resolutionDate: '2024-08-30',
        timeline: [
          { date: '2024-07-22', event: 'Theft discovered' },
          { date: '2024-07-22', event: 'Police report filed' },
          { date: '2024-07-23', event: 'Claim submitted' },
          { date: '2024-08-10', event: 'Claim approved' },
          { date: '2024-08-30', event: 'Payment received' }
        ]
      }
    ];

    this.activeClaims = [];

    // Maintenance scheduling
    this.maintenanceSchedule = {
      electricalInspection: {
        name: 'Electrical Inspection (Elbesiktning)',
        intervalYears: 5,
        lastCompleted: '2022-04-10',
        nextDue: '2027-04-10',
        estimatedCostSEK: 8500,
        mandatory: false,
        riskReduction: { 'electrical-fault': 0.3, fire: 0.1 },
        provider: 'Stockholms Elservice AB',
        notes: 'Full inspection of wiring, outlets, and panel'
      },
      plumbingCheck: {
        name: 'Plumbing Inspection (VVS-kontroll)',
        intervalYears: 3,
        lastCompleted: '2023-09-05',
        nextDue: '2026-09-05',
        estimatedCostSEK: 5500,
        mandatory: false,
        riskReduction: { 'water-damage': 0.25, mold: 0.15 },
        provider: 'R\u00f6rmokare Stockholm',
        notes: 'Check pipes, joints, water heater, and drainage'
      },
      roofInspection: {
        name: 'Roof Inspection (Takinspektion)',
        intervalYears: 1,
        lastCompleted: '2025-05-20',
        nextDue: '2026-05-20',
        estimatedCostSEK: 3500,
        mandatory: false,
        riskReduction: { storm: 0.2, 'water-damage': 0.1 },
        provider: 'Tak & Fasad Stockholm',
        notes: 'Annual inspection of tiles, flashing, and gutters'
      },
      chimneySweep: {
        name: 'Chimney Sweep (Sotning)',
        intervalYears: 1,
        lastCompleted: '2025-09-12',
        nextDue: '2026-09-12',
        estimatedCostSEK: 1800,
        mandatory: true,
        riskReduction: { fire: 0.15 },
        provider: 'Kommunal sotare',
        notes: 'Mandatory in Sweden per MSB regulations'
      },
      fireExtinguisherService: {
        name: 'Fire Extinguisher Service',
        intervalYears: 1,
        lastCompleted: '2025-06-01',
        nextDue: '2026-06-01',
        estimatedCostSEK: 800,
        mandatory: false,
        riskReduction: { fire: 0.05 },
        provider: 'Brandskydd Sverige',
        notes: 'Inspect and service all extinguishers'
      },
      smokeDetectorBattery: {
        name: 'Smoke Detector Battery Replacement',
        intervalYears: 1,
        lastCompleted: '2025-11-01',
        nextDue: '2026-11-01',
        estimatedCostSEK: 300,
        mandatory: false,
        riskReduction: { fire: 0.05 },
        provider: 'Self',
        notes: 'Replace batteries in all 6 smoke detectors'
      },
      gutterCleaning: {
        name: 'Gutter Cleaning (R\u00e4nnrensning)',
        intervalMonths: 6,
        lastCompleted: '2025-10-15',
        nextDue: '2026-04-15',
        estimatedCostSEK: 2500,
        mandatory: false,
        riskReduction: { 'water-damage': 0.08, storm: 0.05 },
        provider: 'Fastighetssk\u00f6tsel AB',
        notes: 'Biannual cleaning, spring and autumn'
      }
    };

    // Sensor integration state
    this.sensorReadings = {
      smoke: { detected: false, lastReading: null, sensorCount: 6, activeCount: 6 },
      heat: { detected: false, lastReading: null, temperatureC: 21, threshold: 55 },
      waterLeak: { detected: false, lastReading: null, sensorCount: 8, activeCount: 8 },
      humidity: { levelPercent: 45, lastReading: null, threshold: 70 },
      motion: { detected: false, lastReading: null, sensorCount: 5, activeCount: 5 },
      doorContact: { allClosed: true, lastReading: null, sensorCount: 4, activeCount: 4 },
      powerConsumption: { currentWatts: 1250, lastReading: null, anomalyDetected: false, threshold: 5000 },
      weather: { stormWarning: false, lastReading: null, windSpeedMs: 5, tempC: 3, precipitationMm: 0 }
    };

    // Document vault
    this.documentVault = [
      { id: 'DOC-001', type: 'insurance_policy', filename: 'hemforsakring_2024.pdf', uploadDate: '2024-01-15', expiryDate: '2025-12-31', category: 'policies', sizeMB: 2.4 },
      { id: 'DOC-002', type: 'insurance_policy', filename: 'villaforsakring_2024.pdf', uploadDate: '2024-03-05', expiryDate: '2026-02-28', category: 'policies', sizeMB: 3.1 },
      { id: 'DOC-003', type: 'insurance_policy', filename: 'tillaggsforsakring_2024.pdf', uploadDate: '2024-06-10', expiryDate: '2025-05-31', category: 'policies', sizeMB: 1.8 },
      { id: 'DOC-004', type: 'property_deed', filename: 'lagfart_sodermalm.pdf', uploadDate: '2020-08-20', expiryDate: null, category: 'property', sizeMB: 5.6 },
      { id: 'DOC-005', type: 'property_appraisal', filename: 'vardering_2024.pdf', uploadDate: '2024-09-15', expiryDate: '2025-09-15', category: 'property', sizeMB: 8.2 },
      { id: 'DOC-006', type: 'inventory_list', filename: 'hemforsakring_inventering.xlsx', uploadDate: '2024-11-01', expiryDate: null, category: 'inventory', sizeMB: 1.1 },
      { id: 'DOC-007', type: 'receipt', filename: 'piano_kvitto.pdf', uploadDate: '2018-01-25', expiryDate: null, category: 'receipts', sizeMB: 0.3 },
      { id: 'DOC-008', type: 'receipt', filename: 'trek_domane_kvitto.pdf', uploadDate: '2024-04-05', expiryDate: null, category: 'receipts', sizeMB: 0.5 },
      { id: 'DOC-009', type: 'inspection_report', filename: 'elbesiktning_2022.pdf', uploadDate: '2022-04-15', expiryDate: '2027-04-10', category: 'maintenance', sizeMB: 4.2 },
      { id: 'DOC-010', type: 'claim_documentation', filename: 'vattenskada_2022_foton.zip', uploadDate: '2022-03-16', expiryDate: null, category: 'claims', sizeMB: 45.0 },
      { id: 'DOC-011', type: 'photo_inventory', filename: 'rum_inventering_foton.zip', uploadDate: '2024-11-01', expiryDate: null, category: 'inventory', sizeMB: 120.0 },
      { id: 'DOC-012', type: 'video_walkthrough', filename: 'hem_genomgang_2024.mp4', uploadDate: '2024-11-01', expiryDate: null, category: 'inventory', sizeMB: 850.0 }
    ];

    // Seasonal risk adjustments
    this.seasonalAdjustments = {
      winter: { 'water-damage': 0.20, storm: 0.15, fire: 0.05, 'electrical-fault': 0.05 },
      spring: { 'water-damage': 0.10, mold: 0.05, pest: 0.05 },
      summer: { fire: 0.10, storm: 0.05, vandalism: 0.05, liability: 0.03 },
      autumn: { storm: 0.10, 'water-damage': 0.05, mold: 0.05 }
    };

    // Emergency cost estimations
    this.emergencyCostEstimates = {
      fire: { immediateSEK: 50000, repairSEK: 1500000, temporaryHousingSEK: 180000, personalPropertySEK: 500000, totalEstimateSEK: 2230000 },
      'water-damage': { immediateSEK: 15000, repairSEK: 250000, temporaryHousingSEK: 60000, personalPropertySEK: 80000, totalEstimateSEK: 405000 },
      burglary: { immediateSEK: 5000, repairSEK: 15000, temporaryHousingSEK: 0, personalPropertySEK: 200000, totalEstimateSEK: 220000 },
      'electrical-fault': { immediateSEK: 10000, repairSEK: 120000, temporaryHousingSEK: 30000, personalPropertySEK: 50000, totalEstimateSEK: 210000 },
      storm: { immediateSEK: 20000, repairSEK: 200000, temporaryHousingSEK: 45000, personalPropertySEK: 30000, totalEstimateSEK: 295000 },
      mold: { immediateSEK: 5000, repairSEK: 350000, temporaryHousingSEK: 120000, personalPropertySEK: 20000, totalEstimateSEK: 495000 }
    };

    // Compliance tracking
    this.complianceRequirements = {
      fireSafety: {
        name: 'Fire Safety (Brandskydd)',
        authority: 'MSB (Myndigheten f\u00f6r samh\u00e4llsskydd och beredskap)',
        requirements: ['smoke_detectors_all_floors', 'fire_extinguisher', 'fire_blanket_kitchen', 'escape_routes_clear', 'chimney_swept_annually'],
        compliant: true,
        lastAudit: '2025-06-15',
        nextAudit: '2026-06-15'
      },
      electricalStandards: {
        name: 'Electrical Safety (Els\u00e4kerhet)',
        authority: 'Els\u00e4kerhetsverket',
        requirements: ['grounded_outlets', 'rcb_protection', 'proper_wiring', 'no_overloaded_circuits', 'periodic_inspection'],
        compliant: true,
        lastAudit: '2022-04-10',
        nextAudit: '2027-04-10'
      },
      buildingCodes: {
        name: 'Building Codes (BBR)',
        authority: 'Boverket',
        requirements: ['structural_integrity', 'energy_efficiency', 'accessibility', 'moisture_protection', 'ventilation'],
        compliant: true,
        lastAudit: '2024-01-20',
        nextAudit: '2029-01-20'
      },
      insuranceRequirements: {
        name: 'Insurance Requirements',
        authority: 'Insurance Provider',
        requirements: ['working_locks', 'smoke_detectors', 'water_shutoff_accessible', 'address_registration', 'occupancy_declared'],
        compliant: true,
        lastAudit: '2024-11-15',
        nextAudit: '2025-11-15'
      }
    };

    // Neighborhood risk factors
    this.neighborhoodRisk = {
      crimeStatistics: {
        burglaryPer1000: 4.2,
        vandalismPer1000: 6.8,
        vehicleTheftPer1000: 3.1,
        trend: 'improving',
        dataSource: 'BR\u00c5 (Brottsf\u00f6rebyggande r\u00e5det)',
        lastUpdated: '2025-12-01'
      },
      floodZone: { inFloodZone: false, floodRiskCategory: 'low', nearestWaterbodyM: 800, lastFloodEvent: null },
      fireDepartment: { distanceKm: 1.8, estimatedResponseMin: 6, stationName: 'S\u00f6dermalm Brandstation' },
      hospital: { distanceKm: 2.5, name: 'S\u00f6dersjukhuset', emergencyAvailable: true },
      policeStation: { distanceKm: 1.2, name: 'S\u00f6dermalms Polisstation', estimatedResponseMin: 8 }
    };

    // Cost-benefit mitigation investments
    this.mitigationInvestments = [
      {
        name: 'Water Auto-Shutoff Valves',
        costSEK: 5000,
        installationSEK: 3000,
        annualSavingsSEK: 15000,
        riskReduction: { 'water-damage': 0.35 },
        paybackMonths: 7,
        implemented: true,
        implementedDate: '2024-02-15'
      },
      {
        name: 'Smart Smoke Detection System',
        costSEK: 8000,
        installationSEK: 2000,
        annualSavingsSEK: 12000,
        riskReduction: { fire: 0.25 },
        paybackMonths: 10,
        implemented: true,
        implementedDate: '2024-01-10'
      },
      {
        name: 'Security Camera System',
        costSEK: 12000,
        installationSEK: 4000,
        annualSavingsSEK: 8000,
        riskReduction: { burglary: 0.30, vandalism: 0.25 },
        paybackMonths: 24,
        implemented: true,
        implementedDate: '2024-03-20'
      },
      {
        name: 'Smart Lock System',
        costSEK: 9000,
        installationSEK: 2500,
        annualSavingsSEK: 5000,
        riskReduction: { burglary: 0.15 },
        paybackMonths: 28,
        implemented: true,
        implementedDate: '2024-04-05'
      },
      {
        name: 'Whole-Home Surge Protection',
        costSEK: 4500,
        installationSEK: 3500,
        annualSavingsSEK: 6000,
        riskReduction: { 'electrical-fault': 0.20, 'appliance-failure': 0.15 },
        paybackMonths: 16,
        implemented: false,
        recommendedDate: '2026-06-01'
      },
      {
        name: 'Humidity Monitoring System',
        costSEK: 3500,
        installationSEK: 1000,
        annualSavingsSEK: 7000,
        riskReduction: { mold: 0.30 },
        paybackMonths: 8,
        implemented: false,
        recommendedDate: '2026-03-01'
      },
      {
        name: 'Reinforced Entry Doors',
        costSEK: 25000,
        installationSEK: 5000,
        annualSavingsSEK: 4000,
        riskReduction: { burglary: 0.20 },
        paybackMonths: 90,
        implemented: false,
        recommendedDate: '2027-01-01'
      }
    ];

    // Composite risk score state
    this.compositeRiskScore = 0;
    this.lastRiskAssessment = null;
    this.riskHistory = [];
    this.annualReports = [];
  }

  async initialize() {
    try {
      this.homey.log('[InsuranceRisk] Initializing Smart Home Insurance Risk Assessment System...');

      this._performInitialRiskAssessment();
      this._calculateCompositeRiskScore();
      this._assessSmartHomeDiscounts();
      this._checkMaintenanceSchedule();
      this._validateComplianceStatus();
      this._calculatePropertyValuation();
      this._performSeasonalAdjustment();

      this._startRiskMonitoringInterval();
      this._startSensorPollingInterval();
      this._startMaintenanceCheckInterval();
      this._startPremiumOptimizationInterval();
      this._startComplianceCheckInterval();
      this._startDocumentExpiryCheckInterval();

      this.initialized = true;
      this.homey.log('[InsuranceRisk] System initialized successfully');
      this.homey.log('[InsuranceRisk] Composite risk score: ' + this.compositeRiskScore + '/100');
      this.homey.log('[InsuranceRisk] Total insured value: ' + this.propertyValuation.totalInsuredValueSEK + ' SEK');
      this.homey.log('[InsuranceRisk] Active policies: ' + Object.keys(this.insurancePolicies).length);
      this.homey.log('[InsuranceRisk] Smart home discount: ' + this._calculateTotalDiscount() + '%');

      this.homey.emit('insurance-risk:initialized', {
        compositeScore: this.compositeRiskScore,
        totalInsuredValue: this.propertyValuation.totalInsuredValueSEK,
        activePolicies: Object.keys(this.insurancePolicies).length
      });
    } catch (err) {
      this.homey.error('[InsuranceRisk] Initialization failed:', err.message);
    }
  }

  _performInitialRiskAssessment() {
    const now = new Date().toISOString();
    for (const [category, risk] of Object.entries(this.riskCategories)) {
      risk.lastAssessed = now;
      const baseRisk = risk.probability * risk.potentialCostSEK;
      const mitigationCount = risk.mitigationFactors.length;
      const implementedMitigations = this._countImplementedMitigations(category);
      const mitigationRatio = mitigationCount > 0 ? implementedMitigations / mitigationCount : 0;
      const adjustedRisk = baseRisk * (1 - mitigationRatio * 0.6);

      if (adjustedRisk > 100000) {
        risk.currentRiskLevel = 'critical';
      } else if (adjustedRisk > 50000) {
        risk.currentRiskLevel = 'high';
      } else if (adjustedRisk > 15000) {
        risk.currentRiskLevel = 'medium';
      } else {
        risk.currentRiskLevel = 'low';
      }

      this.homey.log('[InsuranceRisk] ' + category + ': level=' + risk.currentRiskLevel + ', probability=' + risk.probability + ', cost=' + risk.potentialCostSEK);
    }
  }

  _countImplementedMitigations(category) {
    let count = 0;
    const mitigationMap = {
      smoke_detectors: this.smartHomeDiscounts.smokeDetectors.installed,
      fire_extinguishers: true,
      sprinkler_system: false,
      chimney_sweep: this._isMaintenanceCurrent('chimneySweep'),
      leak_sensors: this.smartHomeDiscounts.waterLeakSensors.installed,
      auto_shutoff: this.smartHomeDiscounts.autoShutoff.installed,
      plumbing_maintenance: this._isMaintenanceCurrent('plumbingCheck'),
      drainage_inspection: true,
      burglar_alarm: this.smartHomeDiscounts.burglarAlarm.installed,
      smart_locks: this.smartHomeDiscounts.smartLocks.installed,
      camera_system: this.smartHomeDiscounts.cameraSystem.installed,
      motion_sensors: true,
      electrical_inspection: this._isMaintenanceCurrent('electricalInspection'),
      surge_protection: false,
      modern_wiring: this.propertyDetails.electricalAge < 20,
      circuit_breakers: true,
      roof_maintenance: this._isMaintenanceCurrent('roofInspection'),
      tree_trimming: true,
      storm_shutters: false,
      gutter_cleaning: this._isMaintenanceCurrent('gutterCleaning'),
      pathway_maintenance: true,
      lighting: true,
      handrails: true,
      insurance_coverage: true,
      regular_servicing: true,
      age_monitoring: true,
      warranty_tracking: true,
      ventilation: true,
      humidity_control: false,
      moisture_barriers: true,
      regular_inspection: true,
      sealed_entry_points: true,
      cleanliness: true,
      pest_control_service: false,
      motion_lights: true,
      fencing: true,
      neighborhood_watch: false
    };
    const risk = this.riskCategories[category];
    if (risk) {
      for (const factor of risk.mitigationFactors) {
        if (mitigationMap[factor]) {
          count++;
        }
      }
    }
    return count;
  }

  _isMaintenanceCurrent(taskKey) {
    const task = this.maintenanceSchedule[taskKey];
    if (!task) return false;
    const now = new Date();
    const nextDue = new Date(task.nextDue);
    return nextDue > now;
  }

  _calculateCompositeRiskScore() {
    const weights = {
      fire: 0.20,
      'water-damage': 0.18,
      burglary: 0.12,
      'electrical-fault': 0.12,
      storm: 0.10,
      liability: 0.05,
      'appliance-failure': 0.08,
      mold: 0.06,
      pest: 0.04,
      vandalism: 0.05
    };

    let weightedScore = 0;
    for (const [category, risk] of Object.entries(this.riskCategories)) {
      const weight = weights[category] || 0.05;
      const riskValue = risk.probability * (risk.potentialCostSEK / 100000);
      const normalizedValue = Math.min(riskValue * 10, 100);
      weightedScore += normalizedValue * weight;
    }

    // Property age factor
    const ageFactor = Math.min(this.propertyDetails.buildingAge / 100, 0.5);
    weightedScore *= (1 + ageFactor);

    // Maintenance factor
    const maintenanceRatio = this._getMaintenanceComplianceRatio();
    weightedScore *= (1 - maintenanceRatio * 0.2);

    // Smart home factor
    const discountTotal = this._calculateTotalDiscount();
    weightedScore *= (1 - discountTotal / 100);

    // Neighborhood factor
    const crimeIndex = this.propertyDetails.neighborhoodCrimeIndex;
    weightedScore *= (1 + (crimeIndex - 3) * 0.05);

    this.compositeRiskScore = Math.round(Math.max(0, Math.min(100, weightedScore)));
    this.lastRiskAssessment = new Date().toISOString();

    this.riskHistory.push({
      timestamp: this.lastRiskAssessment,
      score: this.compositeRiskScore,
      breakdown: this._getRiskBreakdown()
    });

    if (this.riskHistory.length > 365) {
      this.riskHistory = this.riskHistory.slice(-365);
    }
  }

  _getRiskBreakdown() {
    const breakdown = {};
    for (const [category, risk] of Object.entries(this.riskCategories)) {
      breakdown[category] = {
        level: risk.currentRiskLevel,
        probability: risk.probability,
        potentialCost: risk.potentialCostSEK,
        expectedLoss: Math.round(risk.probability * risk.potentialCostSEK)
      };
    }
    return breakdown;
  }

  _getMaintenanceComplianceRatio() {
    const tasks = Object.values(this.maintenanceSchedule);
    if (tasks.length === 0) return 0;
    let current = 0;
    const now = new Date();
    for (const task of tasks) {
      if (new Date(task.nextDue) > now) {
        current++;
      }
    }
    return current / tasks.length;
  }

  _assessSmartHomeDiscounts() {
    const totalDiscount = this._calculateTotalDiscount();
    const maxPotentialDiscount = Object.values(this.smartHomeDiscounts)
      .reduce((sum, d) => sum + d.discountPercent, 0);

    this.homey.log('[InsuranceRisk] Smart home discount: ' + totalDiscount + '% of max ' + maxPotentialDiscount + '%');

    const unverified = Object.entries(this.smartHomeDiscounts)
      .filter(([, d]) => d.installed && !d.verified);

    if (unverified.length > 0) {
      this.homey.log('[InsuranceRisk] ' + unverified.length + ' devices need verification for discount');
      this.homey.emit('insurance-risk:verification-needed', {
        devices: unverified.map(([name]) => name),
        potentialSavings: this._calculatePotentialSavingsFromVerification(unverified)
      });
    }
  }

  _calculateTotalDiscount() {
    return Object.values(this.smartHomeDiscounts)
      .filter(d => d.installed && d.verified)
      .reduce((sum, d) => sum + d.discountPercent, 0);
  }

  _calculatePotentialSavingsFromVerification(unverifiedDevices) {
    const monthlyPremium = Object.values(this.insurancePolicies)
      .reduce((sum, p) => sum + p.premiumSEKMonth, 0);
    const additionalDiscount = unverifiedDevices
      .reduce((sum, entry) => sum + entry[1].discountPercent, 0);
    return Math.round(monthlyPremium * (additionalDiscount / 100) * 12);
  }

  _checkMaintenanceSchedule() {
    const now = new Date();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;

    for (const [key, task] of Object.entries(this.maintenanceSchedule)) {
      const nextDue = new Date(task.nextDue);
      const daysUntilDue = Math.round((nextDue - now) / (24 * 60 * 60 * 1000));

      if (daysUntilDue < 0) {
        this.homey.log('[InsuranceRisk] OVERDUE: ' + task.name + ' was due ' + Math.abs(daysUntilDue) + ' days ago');
        this.homey.emit('insurance-risk:maintenance-overdue', {
          task: key,
          name: task.name,
          dueDate: task.nextDue,
          daysOverdue: Math.abs(daysUntilDue),
          estimatedCost: task.estimatedCostSEK,
          mandatory: task.mandatory
        });
      } else if (nextDue - now < thirtyDays) {
        this.homey.log('[InsuranceRisk] Upcoming: ' + task.name + ' due in ' + daysUntilDue + ' days');
        this.homey.emit('insurance-risk:maintenance-upcoming', {
          task: key,
          name: task.name,
          dueDate: task.nextDue,
          daysUntilDue: daysUntilDue,
          estimatedCost: task.estimatedCostSEK,
          provider: task.provider
        });
      }
    }
  }

  _validateComplianceStatus() {
    for (const [key, compliance] of Object.entries(this.complianceRequirements)) {
      const nextAudit = new Date(compliance.nextAudit);
      const now = new Date();
      if (nextAudit < now) {
        compliance.compliant = false;
        this.homey.log('[InsuranceRisk] Compliance expired: ' + compliance.name);
        this.homey.emit('insurance-risk:compliance-expired', {
          requirement: key,
          name: compliance.name,
          authority: compliance.authority,
          expiredDate: compliance.nextAudit
        });
      }
    }
  }

  _calculatePropertyValuation() {
    const itemsTotal = this.propertyValuation.highValueItems
      .reduce((sum, item) => sum + item.valueSEK, 0);

    const uninsuredItems = this.propertyValuation.highValueItems
      .filter(item => !item.insured);

    const missingReceipts = this.propertyValuation.highValueItems
      .filter(item => !item.receiptStored);

    this.propertyValuation.totalInsuredValueSEK =
      this.propertyValuation.buildingValueSEK +
      this.propertyValuation.contentsValueSEK +
      this.propertyValuation.gardenStructuresValueSEK;

    const replacementCost = Math.round(
      this.propertyValuation.totalInsuredValueSEK * this.propertyValuation.replacementCostMultiplier
    );

    this.homey.log('[InsuranceRisk] High-value items total: ' + itemsTotal + ' SEK');
    this.homey.log('[InsuranceRisk] Replacement cost estimate: ' + replacementCost + ' SEK');

    if (uninsuredItems.length > 0) {
      this.homey.log('[InsuranceRisk] WARNING: ' + uninsuredItems.length + ' high-value items not insured');
      this.homey.emit('insurance-risk:uninsured-items', {
        items: uninsuredItems.map(function(i) { return { name: i.name, value: i.valueSEK }; }),
        totalUninsuredValue: uninsuredItems.reduce(function(s, i) { return s + i.valueSEK; }, 0)
      });
    }

    if (missingReceipts.length > 0) {
      this.homey.emit('insurance-risk:missing-receipts', {
        items: missingReceipts.map(function(i) { return { name: i.name, value: i.valueSEK }; }),
        count: missingReceipts.length
      });
    }
  }

  _performSeasonalAdjustment() {
    const month = new Date().getMonth();
    let season;
    if (month >= 11 || month <= 1) season = 'winter';
    else if (month >= 2 && month <= 4) season = 'spring';
    else if (month >= 5 && month <= 7) season = 'summer';
    else season = 'autumn';

    const adjustments = this.seasonalAdjustments[season] || {};
    for (const [category, increase] of Object.entries(adjustments)) {
      if (this.riskCategories[category]) {
        const baseProbability = this.riskCategories[category].probability;
        this.riskCategories[category].probability = Math.min(1, baseProbability + increase);
      }
    }
    this.homey.log('[InsuranceRisk] Seasonal adjustment applied for ' + season);
    this.homey.emit('insurance-risk:seasonal-adjustment', { season: season, adjustments: adjustments });
  }

  _startRiskMonitoringInterval() {
    const self = this;
    const interval = setInterval(function() {
      try {
        self._calculateCompositeRiskScore();
        const previousScore = self.riskHistory.length >= 2
          ? self.riskHistory[self.riskHistory.length - 2].score
          : self.compositeRiskScore;
        const scoreDelta = self.compositeRiskScore - previousScore;
        if (Math.abs(scoreDelta) >= 5) {
          self.homey.log('[InsuranceRisk] Risk score changed: ' + previousScore + ' -> ' + self.compositeRiskScore);
          self.homey.emit('insurance-risk:score-changed', {
            previousScore: previousScore,
            currentScore: self.compositeRiskScore,
            delta: scoreDelta,
            direction: scoreDelta > 0 ? 'increased' : 'decreased'
          });
        }
        if (self.compositeRiskScore >= 75) {
          self.homey.emit('insurance-risk:high-risk-alert', {
            score: self.compositeRiskScore,
            criticalCategories: self._getCriticalCategories(),
            recommendations: self._generateRiskRecommendations()
          });
        }
      } catch (err) {
        self.homey.error('[InsuranceRisk] Risk monitoring error:', err.message);
      }
    }, 300000);
    this.intervals.push(interval);
  }

  _startSensorPollingInterval() {
    const self = this;
    const interval = setInterval(function() {
      try {
        self._processSensorReadings();
      } catch (err) {
        self.homey.error('[InsuranceRisk] Sensor polling error:', err.message);
      }
    }, 60000);
    this.intervals.push(interval);
  }

  _startMaintenanceCheckInterval() {
    const self = this;
    const interval = setInterval(function() {
      try {
        self._checkMaintenanceSchedule();
      } catch (err) {
        self.homey.error('[InsuranceRisk] Maintenance check error:', err.message);
      }
    }, 86400000);
    this.intervals.push(interval);
  }

  _startPremiumOptimizationInterval() {
    const self = this;
    const interval = setInterval(function() {
      try {
        self._analyzePremiumOptimization();
      } catch (err) {
        self.homey.error('[InsuranceRisk] Premium optimization error:', err.message);
      }
    }, 604800000);
    this.intervals.push(interval);
  }

  _startComplianceCheckInterval() {
    const self = this;
    const interval = setInterval(function() {
      try {
        self._validateComplianceStatus();
      } catch (err) {
        self.homey.error('[InsuranceRisk] Compliance check error:', err.message);
      }
    }, 604800000);
    this.intervals.push(interval);
  }

  _startDocumentExpiryCheckInterval() {
    const self = this;
    const interval = setInterval(function() {
      try {
        self._checkDocumentExpiry();
      } catch (err) {
        self.homey.error('[InsuranceRisk] Document expiry check error:', err.message);
      }
    }, 86400000);
    this.intervals.push(interval);
  }

  _processSensorReadings() {
    const now = new Date().toISOString();
    this.sensorReadings.smoke.lastReading = now;
    this.sensorReadings.heat.lastReading = now;
    this.sensorReadings.waterLeak.lastReading = now;
    this.sensorReadings.humidity.lastReading = now;
    this.sensorReadings.motion.lastReading = now;
    this.sensorReadings.doorContact.lastReading = now;
    this.sensorReadings.powerConsumption.lastReading = now;
    this.sensorReadings.weather.lastReading = now;

    // Fire risk from smoke/heat
    if (this.sensorReadings.smoke.detected) {
      this.riskCategories.fire.currentRiskLevel = 'critical';
      this.riskCategories.fire.probability = Math.min(1, this.riskCategories.fire.probability + 0.3);
      this.homey.emit('insurance-risk:fire-alert', {
        source: 'smoke_detector',
        riskLevel: 'critical',
        timestamp: now
      });
      this.homey.log('[InsuranceRisk] CRITICAL: Smoke detected - fire risk elevated');
    }

    if (this.sensorReadings.heat.temperatureC > this.sensorReadings.heat.threshold) {
      this.riskCategories.fire.currentRiskLevel = 'high';
      this.homey.emit('insurance-risk:heat-alert', {
        temperature: this.sensorReadings.heat.temperatureC,
        threshold: this.sensorReadings.heat.threshold,
        timestamp: now
      });
    }

    // Water damage risk
    if (this.sensorReadings.waterLeak.detected) {
      this.riskCategories['water-damage'].currentRiskLevel = 'critical';
      this.riskCategories['water-damage'].probability = Math.min(1, this.riskCategories['water-damage'].probability + 0.4);
      this.homey.emit('insurance-risk:water-leak-alert', {
        riskLevel: 'critical',
        timestamp: now,
        estimatedCost: this.emergencyCostEstimates['water-damage']
      });
      this.homey.log('[InsuranceRisk] CRITICAL: Water leak detected');
    }

    // Humidity/mold risk
    if (this.sensorReadings.humidity.levelPercent > this.sensorReadings.humidity.threshold) {
      this.riskCategories.mold.currentRiskLevel = 'high';
      this.riskCategories.mold.probability = Math.min(1, this.riskCategories.mold.probability + 0.1);
      this.homey.emit('insurance-risk:humidity-alert', {
        humidity: this.sensorReadings.humidity.levelPercent,
        threshold: this.sensorReadings.humidity.threshold,
        timestamp: now
      });
    }

    // Security risk from door/motion sensors
    if (!this.sensorReadings.doorContact.allClosed && this.sensorReadings.motion.detected) {
      const hour = new Date().getHours();
      if (hour >= 23 || hour <= 5) {
        this.riskCategories.burglary.currentRiskLevel = 'high';
        this.homey.emit('insurance-risk:security-alert', {
          type: 'unusual_activity',
          doorOpen: true,
          motionDetected: true,
          timestamp: now
        });
        this.homey.log('[InsuranceRisk] WARNING: Unusual nighttime activity detected');
      }
    }

    // Electrical risk from power monitoring
    if (this.sensorReadings.powerConsumption.anomalyDetected ||
        this.sensorReadings.powerConsumption.currentWatts > this.sensorReadings.powerConsumption.threshold) {
      this.riskCategories['electrical-fault'].currentRiskLevel = 'high';
      this.homey.emit('insurance-risk:electrical-alert', {
        currentWatts: this.sensorReadings.powerConsumption.currentWatts,
        threshold: this.sensorReadings.powerConsumption.threshold,
        anomaly: this.sensorReadings.powerConsumption.anomalyDetected,
        timestamp: now
      });
    }

    // Storm risk from weather
    if (this.sensorReadings.weather.stormWarning || this.sensorReadings.weather.windSpeedMs > 20) {
      this.riskCategories.storm.currentRiskLevel = 'high';
      this.riskCategories.storm.probability = Math.min(1, this.riskCategories.storm.probability + 0.15);
      this.homey.emit('insurance-risk:storm-alert', {
        windSpeed: this.sensorReadings.weather.windSpeedMs,
        stormWarning: this.sensorReadings.weather.stormWarning,
        timestamp: now
      });
    }

    // Check sensor health
    const inactiveSensors = [];
    if (this.sensorReadings.smoke.activeCount < this.sensorReadings.smoke.sensorCount) {
      inactiveSensors.push({ type: 'smoke', active: this.sensorReadings.smoke.activeCount, total: this.sensorReadings.smoke.sensorCount });
    }
    if (this.sensorReadings.waterLeak.activeCount < this.sensorReadings.waterLeak.sensorCount) {
      inactiveSensors.push({ type: 'waterLeak', active: this.sensorReadings.waterLeak.activeCount, total: this.sensorReadings.waterLeak.sensorCount });
    }
    if (this.sensorReadings.motion.activeCount < this.sensorReadings.motion.sensorCount) {
      inactiveSensors.push({ type: 'motion', active: this.sensorReadings.motion.activeCount, total: this.sensorReadings.motion.sensorCount });
    }
    if (this.sensorReadings.doorContact.activeCount < this.sensorReadings.doorContact.sensorCount) {
      inactiveSensors.push({ type: 'doorContact', active: this.sensorReadings.doorContact.activeCount, total: this.sensorReadings.doorContact.sensorCount });
    }
    if (inactiveSensors.length > 0) {
      this.homey.emit('insurance-risk:sensor-offline', { sensors: inactiveSensors, timestamp: now });
      this.homey.log('[InsuranceRisk] WARNING: ' + inactiveSensors.length + ' sensor group(s) have offline devices');
    }
  }

  _checkDocumentExpiry() {
    const now = new Date();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    const expiringDocs = [];
    const expiredDocs = [];

    for (const doc of this.documentVault) {
      if (!doc.expiryDate) continue;
      const expiry = new Date(doc.expiryDate);
      if (expiry < now) {
        expiredDocs.push(doc);
      } else if (expiry - now < thirtyDays) {
        expiringDocs.push(doc);
      }
    }

    if (expiredDocs.length > 0) {
      this.homey.log('[InsuranceRisk] ' + expiredDocs.length + ' document(s) have expired');
      this.homey.emit('insurance-risk:documents-expired', {
        documents: expiredDocs.map(function(d) { return { id: d.id, type: d.type, filename: d.filename, expiryDate: d.expiryDate }; })
      });
    }

    if (expiringDocs.length > 0) {
      this.homey.log('[InsuranceRisk] ' + expiringDocs.length + ' document(s) expiring within 30 days');
      this.homey.emit('insurance-risk:documents-expiring', {
        documents: expiringDocs.map(function(d) { return { id: d.id, type: d.type, filename: d.filename, expiryDate: d.expiryDate }; })
      });
    }
  }

  _getCriticalCategories() {
    const result = [];
    for (const [category, risk] of Object.entries(this.riskCategories)) {
      if (risk.currentRiskLevel === 'critical' || risk.currentRiskLevel === 'high') {
        result.push({
          category: category,
          level: risk.currentRiskLevel,
          probability: risk.probability,
          potentialCost: risk.potentialCostSEK
        });
      }
    }
    return result;
  }

  _generateRiskRecommendations() {
    const recommendations = [];

    for (const [category, risk] of Object.entries(this.riskCategories)) {
      if (risk.currentRiskLevel === 'critical' || risk.currentRiskLevel === 'high') {
        const mitigations = this._getUnimplementedMitigations(category);
        if (mitigations.length > 0) {
          recommendations.push({
            category: category,
            riskLevel: risk.currentRiskLevel,
            action: 'Implement ' + mitigations[0] + ' to reduce ' + category + ' risk',
            priority: risk.currentRiskLevel === 'critical' ? 'immediate' : 'high',
            estimatedCostReduction: Math.round(risk.potentialCostSEK * 0.15)
          });
        }
      }
    }

    // Maintenance-based recommendations
    for (const [key, task] of Object.entries(this.maintenanceSchedule)) {
      if (!this._isMaintenanceCurrent(key)) {
        recommendations.push({
          category: 'maintenance',
          riskLevel: task.mandatory ? 'high' : 'medium',
          action: 'Complete ' + task.name + ' (overdue)',
          priority: task.mandatory ? 'immediate' : 'medium',
          estimatedCost: task.estimatedCostSEK
        });
      }
    }

    // Unimplemented investment recommendations
    const unimplemented = this.mitigationInvestments.filter(function(inv) { return !inv.implemented; });
    for (let idx = 0; idx < Math.min(unimplemented.length, 3); idx++) {
      const inv = unimplemented[idx];
      recommendations.push({
        category: 'investment',
        riskLevel: 'medium',
        action: 'Install ' + inv.name + ' (payback in ' + inv.paybackMonths + ' months)',
        priority: inv.paybackMonths <= 12 ? 'high' : 'medium',
        estimatedCost: inv.costSEK + inv.installationSEK,
        annualSavings: inv.annualSavingsSEK
      });
    }

    return recommendations;
  }

  _getUnimplementedMitigations(category) {
    const risk = this.riskCategories[category];
    if (!risk) return [];
    const result = [];
    for (const factor of risk.mitigationFactors) {
      const investmentMatch = this.mitigationInvestments.find(
        function(inv) { return inv.name.toLowerCase().indexOf(factor.replace(/_/g, ' ')) !== -1; }
      );
      if (investmentMatch && !investmentMatch.implemented) {
        result.push(factor);
      }
    }
    return result;
  }

  _analyzePremiumOptimization() {
    const totalMonthlyPremium = Object.values(this.insurancePolicies)
      .reduce(function(sum, p) { return sum + p.premiumSEKMonth; }, 0);
    const totalAnnualPremium = totalMonthlyPremium * 12;

    const currentDiscount = this._calculateTotalDiscount();
    const maxDiscount = Object.values(this.smartHomeDiscounts)
      .reduce(function(sum, d) { return sum + d.discountPercent; }, 0);

    const potentialAdditionalSavings = Math.round(
      totalAnnualPremium * ((maxDiscount - currentDiscount) / 100)
    );

    const totalCoverage = Object.values(this.insurancePolicies)
      .reduce(function(sum, p) { return sum + p.coverageSEK; }, 0);

    const coverageRatio = totalCoverage / this.propertyValuation.totalInsuredValueSEK;

    const optimizationResult = {
      totalMonthlyPremium: totalMonthlyPremium,
      totalAnnualPremium: totalAnnualPremium,
      currentDiscount: currentDiscount,
      maxDiscount: maxDiscount,
      potentialAdditionalSavings: potentialAdditionalSavings,
      totalCoverage: totalCoverage,
      totalInsuredValue: this.propertyValuation.totalInsuredValueSEK,
      coverageRatio: Math.round(coverageRatio * 100),
      recommendations: []
    };

    // Check for under-insurance
    if (coverageRatio < 1.0) {
      optimizationResult.recommendations.push({
        type: 'under-insured',
        severity: 'high',
        message: 'Total coverage (' + totalCoverage + ' SEK) is less than insured value (' + this.propertyValuation.totalInsuredValueSEK + ' SEK)',
        suggestedAction: 'Increase coverage to match property value',
        gapSEK: this.propertyValuation.totalInsuredValueSEK - totalCoverage
      });
    }

    // Check for over-insurance
    if (coverageRatio > 1.5) {
      optimizationResult.recommendations.push({
        type: 'over-insured',
        severity: 'low',
        message: 'Coverage significantly exceeds insured value',
        suggestedAction: 'Review coverage levels to reduce premiums',
        excessSEK: totalCoverage - this.propertyValuation.totalInsuredValueSEK
      });
    }

    // Check for unverified discounts
    if (currentDiscount < maxDiscount) {
      optimizationResult.recommendations.push({
        type: 'unclaimed-discount',
        severity: 'medium',
        message: (maxDiscount - currentDiscount) + '% additional smart home discount available',
        suggestedAction: 'Verify remaining smart home devices to claim full discount',
        annualSavingsSEK: potentialAdditionalSavings
      });
    }

    // Check policy expiry
    const now = new Date();
    for (const [key, policy] of Object.entries(this.insurancePolicies)) {
      const endDate = new Date(policy.endDate);
      const daysUntilExpiry = Math.round((endDate - now) / (24 * 60 * 60 * 1000));
      if (daysUntilExpiry < 90) {
        optimizationResult.recommendations.push({
          type: 'policy-renewal',
          severity: daysUntilExpiry < 30 ? 'high' : 'medium',
          message: policy.name + ' (' + policy.provider + ') expires in ' + daysUntilExpiry + ' days',
          suggestedAction: 'Compare quotes from multiple providers before renewal',
          policy: key
        });
      }
    }

    // Provider comparison suggestion
    const providers = [];
    for (const pol of Object.values(this.insurancePolicies)) {
      if (providers.indexOf(pol.provider) === -1) providers.push(pol.provider);
    }
    optimizationResult.recommendations.push({
      type: 'provider-comparison',
      severity: 'info',
      message: 'Annual premium comparison recommended',
      suggestedAction: 'Compare quotes from Folksam, Trygg-Hansa, IF, Lansforsakringar, and Moderna',
      currentProviders: providers
    });

    // High-value items coverage check
    const uninsuredHighValue = this.propertyValuation.highValueItems.filter(function(i) { return !i.insured; });
    if (uninsuredHighValue.length > 0) {
      const uninsuredTotal = uninsuredHighValue.reduce(function(s, i) { return s + i.valueSEK; }, 0);
      optimizationResult.recommendations.push({
        type: 'uninsured-items',
        severity: 'medium',
        message: uninsuredHighValue.length + ' high-value items worth ' + uninsuredTotal + ' SEK are not insured',
        suggestedAction: 'Add items to supplementary insurance or increase coverage',
        items: uninsuredHighValue.map(function(i) { return i.name; })
      });
    }

    if (optimizationResult.recommendations.length > 0) {
      this.homey.log('[InsuranceRisk] Premium optimization: ' + optimizationResult.recommendations.length + ' recommendations');
      this.homey.emit('insurance-risk:premium-optimization', optimizationResult);
    }

    return optimizationResult;
  }

  // Claims management methods
  createClaim(type, description, estimatedCostSEK) {
    const claimId = 'CLM-' + new Date().getFullYear() + '-' + String(this.claimsHistory.length + this.activeClaims.length + 1).padStart(3, '0');
    const now = new Date().toISOString();

    const suitablePolicy = this._findSuitablePolicy(type);
    if (!suitablePolicy) {
      this.homey.error('[InsuranceRisk] No suitable policy found for claim type: ' + type);
      return null;
    }

    const claim = {
      claimId: claimId,
      date: now,
      type: type,
      description: description,
      policy: suitablePolicy,
      status: 'draft',
      estimatedCostSEK: estimatedCostSEK,
      approvedAmountSEK: 0,
      paidAmountSEK: 0,
      deductibleSEK: this.insurancePolicies[suitablePolicy].deductibleSEK,
      adjusterVisits: 0,
      documentationComplete: false,
      resolutionDate: null,
      timeline: [
        { date: now, event: 'Claim created as draft' }
      ],
      requiredDocuments: this._getRequiredDocuments(type),
      submittedDocuments: []
    };

    this.activeClaims.push(claim);
    this.homey.log('[InsuranceRisk] Claim ' + claimId + ' created for ' + type + ': ' + estimatedCostSEK + ' SEK');
    this.homey.emit('insurance-risk:claim-created', { claimId: claimId, type: type, estimatedCostSEK: estimatedCostSEK, policy: suitablePolicy });

    return claim;
  }

  submitClaim(claimId) {
    const claim = this.activeClaims.find(function(c) { return c.claimId === claimId; });
    if (!claim) {
      this.homey.error('[InsuranceRisk] Claim ' + claimId + ' not found');
      return false;
    }
    if (claim.status !== 'draft') {
      this.homey.error('[InsuranceRisk] Claim ' + claimId + ' cannot be submitted (status: ' + claim.status + ')');
      return false;
    }
    claim.status = 'submitted';
    claim.timeline.push({ date: new Date().toISOString(), event: 'Claim submitted to insurance provider' });
    this.homey.log('[InsuranceRisk] Claim ' + claimId + ' submitted');
    this.homey.emit('insurance-risk:claim-submitted', { claimId: claimId });
    return true;
  }

  updateClaimStatus(claimId, newStatus, details) {
    const claim = this.activeClaims.find(function(c) { return c.claimId === claimId; });
    if (!claim) {
      this.homey.error('[InsuranceRisk] Claim ' + claimId + ' not found');
      return false;
    }

    const validTransitions = {
      draft: ['submitted'],
      submitted: ['under-review'],
      'under-review': ['approved', 'denied'],
      approved: ['paid'],
      paid: [],
      denied: []
    };

    if (!validTransitions[claim.status] || validTransitions[claim.status].indexOf(newStatus) === -1) {
      this.homey.error('[InsuranceRisk] Invalid status transition: ' + claim.status + ' -> ' + newStatus);
      return false;
    }

    claim.status = newStatus;
    claim.timeline.push({
      date: new Date().toISOString(),
      event: 'Status changed to ' + newStatus + (details ? ': ' + details : '')
    });

    if (newStatus === 'approved' && details && details.approvedAmount) {
      claim.approvedAmountSEK = details.approvedAmount;
    }

    if (newStatus === 'paid' && details && details.paidAmount) {
      claim.paidAmountSEK = details.paidAmount;
      claim.resolutionDate = new Date().toISOString();
      this.claimsHistory.push(claim);
      this.activeClaims = this.activeClaims.filter(function(c) { return c.claimId !== claimId; });
    }

    if (newStatus === 'denied') {
      claim.resolutionDate = new Date().toISOString();
      this.claimsHistory.push(claim);
      this.activeClaims = this.activeClaims.filter(function(c) { return c.claimId !== claimId; });
    }

    this.homey.log('[InsuranceRisk] Claim ' + claimId + ' status: ' + newStatus);
    this.homey.emit('insurance-risk:claim-updated', { claimId: claimId, status: newStatus });
    return true;
  }

  _findSuitablePolicy(claimType) {
    const typeMapping = {
      fire: 'villaforsakring',
      'water-damage': 'villaforsakring',
      storm: 'villaforsakring',
      'electrical-fault': 'villaforsakring',
      burglary: 'hemforsakring',
      vandalism: 'hemforsakring',
      liability: 'hemforsakring',
      'appliance-failure': 'hemforsakring',
      mold: 'villaforsakring',
      pest: 'villaforsakring',
      'high-value-item': 'tillaggsforsakring'
    };
    return typeMapping[claimType] || 'hemforsakring';
  }

  _getRequiredDocuments(claimType) {
    const baseDocuments = ['claim_form', 'id_verification', 'incident_description'];
    const typeSpecific = {
      fire: ['fire_department_report', 'photos', 'damage_estimate'],
      'water-damage': ['photos', 'plumber_report', 'damage_estimate', 'drying_report'],
      burglary: ['police_report', 'stolen_items_list', 'photos', 'receipts'],
      storm: ['weather_report', 'photos', 'damage_estimate'],
      'electrical-fault': ['electrician_report', 'photos', 'damage_estimate'],
      vandalism: ['police_report', 'photos', 'damage_estimate'],
      mold: ['inspection_report', 'photos', 'remediation_estimate'],
      pest: ['pest_control_report', 'photos', 'treatment_estimate'],
      'appliance-failure': ['service_report', 'purchase_receipt', 'photos'],
      liability: ['incident_report', 'medical_records', 'witness_statements']
    };
    const specific = typeSpecific[claimType] || ['photos', 'damage_estimate'];
    return baseDocuments.concat(specific);
  }

  // Cost-benefit analysis
  analyzeMitigationROI() {
    const analysis = [];

    for (const inv of this.mitigationInvestments) {
      const totalCost = inv.costSEK + inv.installationSEK;
      const fiveYearSavings = inv.annualSavingsSEK * 5;
      const fiveYearROI = ((fiveYearSavings - totalCost) / totalCost) * 100;
      const breakEvenMonths = inv.paybackMonths;

      const riskReductionSummary = [];
      for (const [cat, reduction] of Object.entries(inv.riskReduction)) {
        const currentCost = this.riskCategories[cat]
          ? this.riskCategories[cat].probability * this.riskCategories[cat].potentialCostSEK
          : 0;
        const newCost = currentCost * (1 - reduction);
        riskReductionSummary.push({
          category: cat,
          reductionPercent: Math.round(reduction * 100),
          expectedSavingSEK: Math.round(currentCost - newCost)
        });
      }

      analysis.push({
        name: inv.name,
        implemented: inv.implemented,
        totalCostSEK: totalCost,
        annualSavingsSEK: inv.annualSavingsSEK,
        paybackMonths: breakEvenMonths,
        fiveYearROIPercent: Math.round(fiveYearROI),
        fiveYearNetSavingsSEK: fiveYearSavings - totalCost,
        riskReduction: riskReductionSummary,
        recommendation: fiveYearROI > 200 ? 'strongly_recommended' :
                         fiveYearROI > 100 ? 'recommended' :
                         fiveYearROI > 0 ? 'consider' : 'low_priority'
      });
    }

    analysis.sort(function(a, b) { return b.fiveYearROIPercent - a.fiveYearROIPercent; });
    this.homey.log('[InsuranceRisk] Mitigation ROI analysis: ' + analysis.length + ' investments analyzed');
    this.homey.emit('insurance-risk:roi-analysis', { investments: analysis });
    return analysis;
  }

  // Annual risk report generation
  generateAnnualReport() {
    const now = new Date();
    const year = now.getFullYear();

    const totalPremiums = Object.values(this.insurancePolicies)
      .reduce(function(sum, p) { return sum + p.premiumSEKMonth * 12; }, 0);

    const yearStr = String(year);
    const prevYearStr = String(year - 1);
    const totalClaimsPaid = this.claimsHistory
      .filter(function(c) { return c.date.indexOf(yearStr) === 0 || c.date.indexOf(prevYearStr) === 0; })
      .reduce(function(sum, c) { return sum + (c.paidAmountSEK || 0); }, 0);

    const maintenanceCompliance = this._getMaintenanceComplianceRatio();

    const riskTrends = {};
    for (const [category, risk] of Object.entries(this.riskCategories)) {
      riskTrends[category] = {
        currentLevel: risk.currentRiskLevel,
        probability: risk.probability,
        trend: risk.trend,
        potentialCost: risk.potentialCostSEK,
        expectedAnnualLoss: Math.round(risk.probability * risk.potentialCostSEK)
      };
    }

    const self = this;
    const maintenanceKeys = Object.keys(this.maintenanceSchedule);
    const completedTaskCount = maintenanceKeys.filter(function(k) { return self._isMaintenanceCurrent(k); }).length;
    const totalMaintenanceCost = Object.values(this.maintenanceSchedule).reduce(function(sum, t) { return sum + t.estimatedCostSEK; }, 0);

    const claimsThisYear = this.claimsHistory.filter(function(c) { return c.date.indexOf(yearStr) === 0; }).length;
    const totalPaidAllTime = this.claimsHistory.reduce(function(sum, c) { return sum + (c.paidAmountSEK || 0); }, 0);

    const expiredDocCount = this.documentVault.filter(function(d) { return d.expiryDate && new Date(d.expiryDate) < now; }).length;
    const totalDocSize = Math.round(this.documentVault.reduce(function(sum, d) { return sum + d.sizeMB; }, 0) * 10) / 10;

    const report = {
      reportId: 'RPT-' + year + '-ANNUAL',
      generatedDate: now.toISOString(),
      reportYear: year,
      propertyAddress: this.propertyDetails.district + ', ' + this.propertyDetails.location,
      compositeRiskScore: this.compositeRiskScore,
      riskScoreTrend: this.riskHistory.length >= 2
        ? (this.compositeRiskScore <= this.riskHistory[0].score ? 'improving' : 'worsening')
        : 'stable',
      financialSummary: {
        totalAnnualPremiumsSEK: totalPremiums,
        totalClaimsPaidSEK: totalClaimsPaid,
        claimsToPremiumRatio: totalPremiums > 0 ? Math.round((totalClaimsPaid / totalPremiums) * 100) : 0,
        smartHomeDiscountPercent: this._calculateTotalDiscount(),
        estimatedAnnualSavingsSEK: Math.round(totalPremiums * (this._calculateTotalDiscount() / 100)),
        totalInsuredValueSEK: this.propertyValuation.totalInsuredValueSEK
      },
      riskTrends: riskTrends,
      maintenanceSummary: {
        complianceRate: Math.round(maintenanceCompliance * 100),
        completedTasks: completedTaskCount,
        totalTasks: maintenanceKeys.length,
        totalMaintenanceCostSEK: totalMaintenanceCost
      },
      claimsSummary: {
        totalClaimsAllTime: this.claimsHistory.length,
        claimsThisYear: claimsThisYear,
        activeClaims: this.activeClaims.length,
        totalPaidAllTimeSEK: totalPaidAllTime
      },
      complianceStatus: Object.entries(this.complianceRequirements).map(function(entry) {
        return {
          requirement: entry[0],
          name: entry[1].name,
          compliant: entry[1].compliant,
          nextAudit: entry[1].nextAudit
        };
      }),
      recommendations: this._generateRiskRecommendations(),
      topMitigationInvestments: this.mitigationInvestments
        .filter(function(inv) { return !inv.implemented; })
        .slice(0, 3)
        .map(function(inv) {
          return {
            name: inv.name,
            costSEK: inv.costSEK + inv.installationSEK,
            annualSavingsSEK: inv.annualSavingsSEK,
            paybackMonths: inv.paybackMonths
          };
        }),
      documentVaultStatus: {
        totalDocuments: this.documentVault.length,
        expiredDocuments: expiredDocCount,
        totalSizeMB: totalDocSize
      }
    };

    this.annualReports.push(report);
    this.homey.log('[InsuranceRisk] Annual report generated for ' + year);
    this.homey.emit('insurance-risk:annual-report', report);
    return report;
  }

  // Update sensor reading
  updateSensorReading(sensorType, data) {
    if (!this.sensorReadings[sensorType]) {
      this.homey.error('[InsuranceRisk] Unknown sensor type: ' + sensorType);
      return false;
    }
    Object.assign(this.sensorReadings[sensorType], data, { lastReading: new Date().toISOString() });
    this.homey.log('[InsuranceRisk] Sensor updated: ' + sensorType);
    return true;
  }

  // Record maintenance completion
  recordMaintenance(taskKey, completionDate, notes) {
    const task = this.maintenanceSchedule[taskKey];
    if (!task) {
      this.homey.error('[InsuranceRisk] Unknown maintenance task: ' + taskKey);
      return false;
    }

    task.lastCompleted = completionDate || new Date().toISOString();

    if (task.intervalYears) {
      const next = new Date(task.lastCompleted);
      next.setFullYear(next.getFullYear() + task.intervalYears);
      task.nextDue = next.toISOString().split('T')[0];
    } else if (task.intervalMonths) {
      const next = new Date(task.lastCompleted);
      next.setMonth(next.getMonth() + task.intervalMonths);
      task.nextDue = next.toISOString().split('T')[0];
    }

    if (notes) {
      task.notes = notes;
    }

    this._performInitialRiskAssessment();
    this._calculateCompositeRiskScore();

    this.homey.log('[InsuranceRisk] Maintenance completed: ' + task.name + ', next due: ' + task.nextDue);
    this.homey.emit('insurance-risk:maintenance-completed', {
      task: taskKey,
      name: task.name,
      completedDate: task.lastCompleted,
      nextDue: task.nextDue
    });
    return true;
  }

  // Add document to vault
  addDocument(document) {
    const id = 'DOC-' + String(this.documentVault.length + 1).padStart(3, '0');
    const doc = {
      id: id,
      type: document.type || 'other',
      filename: document.filename,
      uploadDate: new Date().toISOString(),
      expiryDate: document.expiryDate || null,
      category: document.category || 'general',
      sizeMB: document.sizeMB || 0
    };
    this.documentVault.push(doc);
    this.homey.log('[InsuranceRisk] Document added: ' + doc.filename + ' (' + doc.type + ')');
    this.homey.emit('insurance-risk:document-added', doc);
    return doc;
  }

  // Get emergency cost estimate
  getEmergencyCostEstimate(emergencyType) {
    const estimate = this.emergencyCostEstimates[emergencyType];
    if (!estimate) {
      return null;
    }
    const policy = this._findSuitablePolicy(emergencyType);
    const policyDetails = this.insurancePolicies[policy];
    return {
      emergencyType: emergencyType,
      costs: estimate,
      insuranceCoverage: {
        policy: policyDetails ? policyDetails.name : 'Unknown',
        provider: policyDetails ? policyDetails.provider : 'Unknown',
        maxCoverage: policyDetails ? policyDetails.coverageSEK : 0,
        deductible: policyDetails ? policyDetails.deductibleSEK : 0,
        estimatedOutOfPocket: policyDetails
          ? Math.max(0, estimate.totalEstimateSEK - policyDetails.coverageSEK) + policyDetails.deductibleSEK
          : estimate.totalEstimateSEK
      }
    };
  }

  // Get risk category details
  getRiskCategory(category) {
    const risk = this.riskCategories[category];
    if (!risk) return null;
    const implemented = this._countImplementedMitigations(category);
    const total = risk.mitigationFactors.length;
    return {
      probability: risk.probability,
      potentialCostSEK: risk.potentialCostSEK,
      mitigationFactors: risk.mitigationFactors,
      currentRiskLevel: risk.currentRiskLevel,
      lastAssessed: risk.lastAssessed,
      trend: risk.trend,
      expectedAnnualLoss: Math.round(risk.probability * risk.potentialCostSEK),
      implementedMitigations: implemented,
      totalMitigations: total,
      mitigationRatio: total > 0 ? Math.round((implemented / total) * 100) : 0
    };
  }

  // Get policy summary
  getPolicySummary() {
    const now = new Date();
    const self = this;
    const policies = Object.entries(this.insurancePolicies).map(function(entry) {
      const key = entry[0];
      const policy = entry[1];
      const endDate = new Date(policy.endDate);
      const daysRemaining = Math.round((endDate - now) / (24 * 60 * 60 * 1000));
      const totalDiscountPercent = policy.discounts
        .filter(function(d) { return d.applied; })
        .reduce(function(sum, d) { return sum + d.percentOff; }, 0);
      return {
        key: key,
        name: policy.name,
        provider: policy.provider,
        policyNumber: policy.policyNumber,
        monthlyPremium: policy.premiumSEKMonth,
        annualPremium: policy.premiumSEKMonth * 12,
        coverage: policy.coverageSEK,
        deductible: policy.deductibleSEK,
        daysRemaining: daysRemaining,
        status: daysRemaining > 0 ? 'active' : 'expired',
        totalDiscount: totalDiscountPercent,
        claimsCount: self.claimsHistory.filter(function(c) { return c.policy === key; }).length
      };
    });

    return {
      policies: policies,
      totalMonthlyPremium: policies.reduce(function(sum, p) { return sum + p.monthlyPremium; }, 0),
      totalAnnualPremium: policies.reduce(function(sum, p) { return sum + p.annualPremium; }, 0),
      totalCoverage: policies.reduce(function(sum, p) { return sum + p.coverage; }, 0)
    };
  }

  getStatistics() {
    const riskCats = {};
    for (const [k, v] of Object.entries(this.riskCategories)) {
      riskCats[k] = {
        level: v.currentRiskLevel,
        probability: v.probability,
        trend: v.trend
      };
    }
    const complianceMap = {};
    for (const [k, v] of Object.entries(this.complianceRequirements)) {
      complianceMap[k] = v.compliant;
    }
    const implementedInv = this.mitigationInvestments.filter(function(i) { return i.implemented; });
    const totalInvested = implementedInv.reduce(function(sum, i) { return sum + i.costSEK + i.installationSEK; }, 0);
    const highValueTotal = this.propertyValuation.highValueItems.reduce(function(sum, i) { return sum + i.valueSEK; }, 0);

    return {
      initialized: this.initialized,
      compositeRiskScore: this.compositeRiskScore,
      lastRiskAssessment: this.lastRiskAssessment,
      riskCategories: riskCats,
      activePolicies: Object.keys(this.insurancePolicies).length,
      totalMonthlyPremiumSEK: Object.values(this.insurancePolicies)
        .reduce(function(sum, p) { return sum + p.premiumSEKMonth; }, 0),
      smartHomeDiscountPercent: this._calculateTotalDiscount(),
      totalInsuredValueSEK: this.propertyValuation.totalInsuredValueSEK,
      highValueItemsCount: this.propertyValuation.highValueItems.length,
      highValueItemsTotalSEK: highValueTotal,
      activeClaimsCount: this.activeClaims.length,
      historicalClaimsCount: this.claimsHistory.length,
      maintenanceCompliancePercent: Math.round(this._getMaintenanceComplianceRatio() * 100),
      documentsCount: this.documentVault.length,
      complianceStatus: complianceMap,
      mitigationInvestments: {
        implemented: implementedInv.length,
        total: this.mitigationInvestments.length,
        totalInvestedSEK: totalInvested
      },
      neighborhoodRisk: {
        crimeIndex: this.propertyDetails.neighborhoodCrimeIndex,
        floodZone: this.propertyDetails.floodZone,
        fireDeptDistanceKm: this.neighborhoodRisk.fireDepartment.distanceKm,
        hospitalDistanceKm: this.neighborhoodRisk.hospital.distanceKm
      },
      riskHistoryLength: this.riskHistory.length,
      annualReportsCount: this.annualReports.length,
      intervalsActive: this.intervals.length
    };
  }

  destroy() {
    for (const i of this.intervals) {
      clearInterval(i);
    }
    this.intervals = [];
    this.homey.log('[InsuranceRisk] destroyed');
  }
}

module.exports = SmartHomeInsuranceRiskAssessmentSystem;
