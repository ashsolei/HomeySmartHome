'use strict';

class SmartAquariumManagementSystem {
  constructor(homey) {
    this.homey = homey;
    this.tanks = new Map();
    this.diseaseDatabase = [];
    this.coralFrags = new Map();
    this.feedingSchedules = new Map();
    this.equipmentMaintenance = [];
    this.breedingPrograms = new Map();
    this.lightingProfiles = new Map();
    this.fishSpecies = new Map();
    this.compatibilityMatrix = {};
    this.waterChangeLog = [];
    this.sensorDevices = new Map();
    this.monitoringInterval = null;
    this.initialized = false;
  }

  async initialize() {
    this.log('Initializing Smart Aquarium Management System...');
    try {
      this._initializeTanks();
      this._initializeDiseaseDatabase();
      this._initializeFishSpecies();
      this._initializeCompatibilityMatrix();
      this._initializeCoralFrags();
      this._initializeFeedingSchedules();
      this._initializeEquipmentMaintenance();
      this._initializeBreedingPrograms();
      this._initializeLightingProfiles();
      await this._discoverDevices();
      this._startMonitoring();
      this.initialized = true;
      this.log('Smart Aquarium Management System initialized successfully');
    } catch (err) {
      this.error('Failed to initialize Aquarium Management System: ' + err.message);
      throw err;
    }
  }

  _initializeTanks() {
    this.tanks.set('reef_tank', {
      id: 'reef_tank',
      name: 'Reef Tank',
      type: 'saltwater',
      volumeLiters: 200,
      location: 'living_room',
      parameters: {
        pH: { current: 8.2, min: 8.0, max: 8.4, unit: '' },
        temperature: { current: 25.5, min: 24.0, max: 26.5, unit: '°C' },
        ammonia: { current: 0.0, min: 0, max: 0.02, unit: 'ppm' },
        nitrite: { current: 0.0, min: 0, max: 0.02, unit: 'ppm' },
        nitrate: { current: 5.0, min: 0, max: 20, unit: 'ppm' },
        salinity: { current: 35, min: 34, max: 36, unit: 'ppt' },
        tds: { current: 480, min: 400, max: 550, unit: 'ppm' },
        calcium: { current: 420, min: 380, max: 450, unit: 'ppm' },
        alkalinity: { current: 8.5, min: 7.5, max: 9.5, unit: 'dKH' },
        magnesium: { current: 1350, min: 1250, max: 1450, unit: 'ppm' }
      },
      inhabitants: [],
      bioLoad: 0.65,
      lastWaterChange: Date.now() - 5 * 86400000,
      waterChangeIntervalDays: 7,
      waterChangePercentage: 15,
      autoTopOff: { enabled: true, evaporationRateLPerDay: 0.8, reservoirLiters: 20, reservoirCurrent: 15 },
      parameterHistory: [],
      lastUpdated: Date.now()
    });

    this.tanks.set('planted_tank', {
      id: 'planted_tank',
      name: 'Planted Tank',
      type: 'freshwater',
      volumeLiters: 120,
      location: 'home_office',
      parameters: {
        pH: { current: 6.8, min: 6.5, max: 7.5, unit: '' },
        temperature: { current: 24.0, min: 22.0, max: 26.0, unit: '°C' },
        ammonia: { current: 0.0, min: 0, max: 0.05, unit: 'ppm' },
        nitrite: { current: 0.0, min: 0, max: 0.05, unit: 'ppm' },
        nitrate: { current: 15.0, min: 5, max: 40, unit: 'ppm' },
        salinity: { current: 0, min: 0, max: 0, unit: 'ppt' },
        tds: { current: 180, min: 100, max: 300, unit: 'ppm' },
        co2: { current: 25, min: 20, max: 35, unit: 'ppm' },
        iron: { current: 0.1, min: 0.05, max: 0.2, unit: 'ppm' },
        phosphate: { current: 0.5, min: 0.1, max: 1.0, unit: 'ppm' }
      },
      inhabitants: [],
      bioLoad: 0.45,
      lastWaterChange: Date.now() - 4 * 86400000,
      waterChangeIntervalDays: 7,
      waterChangePercentage: 25,
      autoTopOff: { enabled: true, evaporationRateLPerDay: 0.3, reservoirLiters: 10, reservoirCurrent: 8 },
      parameterHistory: [],
      lastUpdated: Date.now()
    });

    this.tanks.set('koi_pond', {
      id: 'koi_pond',
      name: 'Koi Pond',
      type: 'freshwater',
      volumeLiters: 5000,
      location: 'backyard',
      parameters: {
        pH: { current: 7.4, min: 7.0, max: 8.0, unit: '' },
        temperature: { current: 18.0, min: 4.0, max: 25.0, unit: '°C' },
        ammonia: { current: 0.01, min: 0, max: 0.1, unit: 'ppm' },
        nitrite: { current: 0.01, min: 0, max: 0.1, unit: 'ppm' },
        nitrate: { current: 25.0, min: 0, max: 50, unit: 'ppm' },
        salinity: { current: 0, min: 0, max: 0, unit: 'ppt' },
        tds: { current: 250, min: 100, max: 400, unit: 'ppm' },
        dissolved_oxygen: { current: 8.0, min: 6.0, max: 12.0, unit: 'mg/L' },
        kh: { current: 6, min: 4, max: 8, unit: 'dKH' },
        gh: { current: 8, min: 4, max: 12, unit: 'dGH' }
      },
      inhabitants: [],
      bioLoad: 0.55,
      lastWaterChange: Date.now() - 10 * 86400000,
      waterChangeIntervalDays: 14,
      waterChangePercentage: 10,
      autoTopOff: { enabled: true, evaporationRateLPerDay: 5.0, reservoirLiters: 200, reservoirCurrent: 150 },
      parameterHistory: [],
      lastUpdated: Date.now()
    });

    this.log('Tanks initialized: ' + this.tanks.size);
  }

  _initializeDiseaseDatabase() {
    this.diseaseDatabase = [
      {
        id: 'ich',
        name: 'Ich (White Spot Disease)',
        symptoms: ['white_spots', 'flashing', 'clamped_fins', 'lethargy', 'loss_of_appetite'],
        treatment: 'Raise temperature to 30°C gradually over 48h, add aquarium salt 1tsp per 5L, treat with malachite green',
        quarantineDays: 14,
        contagious: true,
        affectsSpecies: ['freshwater', 'saltwater'],
        severity: 'moderate'
      },
      {
        id: 'fin_rot',
        name: 'Fin Rot',
        symptoms: ['ragged_fins', 'discolored_fin_edges', 'inflammation', 'lethargy'],
        treatment: 'Improve water quality immediately, treat with antibiotics (erythromycin), daily 25% water changes',
        quarantineDays: 10,
        contagious: false,
        affectsSpecies: ['freshwater', 'saltwater'],
        severity: 'moderate'
      },
      {
        id: 'velvet',
        name: 'Velvet Disease',
        symptoms: ['gold_dust_appearance', 'scratching', 'rapid_breathing', 'clamped_fins', 'lethargy'],
        treatment: 'Dim lights completely, copper-based medication, raise temperature slightly',
        quarantineDays: 21,
        contagious: true,
        affectsSpecies: ['freshwater', 'saltwater'],
        severity: 'severe'
      },
      {
        id: 'dropsy',
        name: 'Dropsy',
        symptoms: ['bloated_body', 'pinecone_scales', 'bulging_eyes', 'lethargy', 'loss_of_appetite'],
        treatment: 'Epsom salt baths (1tsp per 5L), antibiotics, improve diet. Often fatal.',
        quarantineDays: 21,
        contagious: false,
        affectsSpecies: ['freshwater'],
        severity: 'severe'
      },
      {
        id: 'swim_bladder',
        name: 'Swim Bladder Disorder',
        symptoms: ['floating_upside_down', 'sinking_to_bottom', 'difficulty_swimming', 'bloated_belly'],
        treatment: 'Fast for 3 days, then feed deshelled peas. Check water quality. May be permanent.',
        quarantineDays: 7,
        contagious: false,
        affectsSpecies: ['freshwater'],
        severity: 'moderate'
      },
      {
        id: 'columnaris',
        name: 'Columnaris',
        symptoms: ['white_patches', 'frayed_fins', 'mouth_fungus', 'saddle_back_lesion', 'rapid_breathing'],
        treatment: 'Lower temperature, antibiotics (kanamycin), aquarium salt. Highly contagious.',
        quarantineDays: 14,
        contagious: true,
        affectsSpecies: ['freshwater'],
        severity: 'severe'
      },
      {
        id: 'anchor_worm',
        name: 'Anchor Worm',
        symptoms: ['visible_worms', 'inflammation_at_attachment', 'scratching', 'redness'],
        treatment: 'Manual removal with tweezers, treat wound with antiseptic, dimilin or potassium permanganate bath',
        quarantineDays: 14,
        contagious: true,
        affectsSpecies: ['freshwater'],
        severity: 'moderate'
      },
      {
        id: 'hole_in_head',
        name: 'Hole in Head Disease (HITH)',
        symptoms: ['pits_on_head', 'erosion_lateral_line', 'white_stringy_feces', 'loss_of_appetite', 'color_fading'],
        treatment: 'Improve water quality, supplement diet with vitamins, metronidazole treatment',
        quarantineDays: 21,
        contagious: false,
        affectsSpecies: ['freshwater', 'saltwater'],
        severity: 'severe'
      }
    ];

    this.log('Disease database initialized: ' + this.diseaseDatabase.length + ' diseases');
  }

  _initializeFishSpecies() {
    const species = [
      { id: 'clownfish', name: 'Clownfish', type: 'saltwater', tempRange: [24, 28], phRange: [8.0, 8.4], maxSize: 11, minTankLiters: 100, diet: 'omnivore', schooling: false, aggressiveness: 'semi-aggressive', lifespan: 6 },
      { id: 'blue_tang', name: 'Blue Tang', type: 'saltwater', tempRange: [24, 27], phRange: [8.1, 8.4], maxSize: 31, minTankLiters: 400, diet: 'herbivore', schooling: false, aggressiveness: 'semi-aggressive', lifespan: 20 },
      { id: 'neon_tetra', name: 'Neon Tetra', type: 'freshwater', tempRange: [20, 26], phRange: [6.0, 7.0], maxSize: 3, minTankLiters: 40, diet: 'omnivore', schooling: true, aggressiveness: 'peaceful', lifespan: 5 },
      { id: 'betta', name: 'Betta Fish', type: 'freshwater', tempRange: [24, 28], phRange: [6.5, 7.5], maxSize: 7, minTankLiters: 20, diet: 'carnivore', schooling: false, aggressiveness: 'aggressive', lifespan: 3 },
      { id: 'discus', name: 'Discus', type: 'freshwater', tempRange: [26, 30], phRange: [6.0, 7.0], maxSize: 20, minTankLiters: 200, diet: 'omnivore', schooling: true, aggressiveness: 'peaceful', lifespan: 10 },
      { id: 'koi', name: 'Koi Carp', type: 'freshwater', tempRange: [4, 24], phRange: [7.0, 8.0], maxSize: 90, minTankLiters: 1000, diet: 'omnivore', schooling: false, aggressiveness: 'peaceful', lifespan: 35 },
      { id: 'corydoras', name: 'Corydoras Catfish', type: 'freshwater', tempRange: [22, 26], phRange: [6.0, 7.5], maxSize: 7, minTankLiters: 40, diet: 'omnivore', schooling: true, aggressiveness: 'peaceful', lifespan: 5 },
      { id: 'angel_fish', name: 'Angelfish', type: 'freshwater', tempRange: [24, 28], phRange: [6.0, 7.5], maxSize: 15, minTankLiters: 120, diet: 'omnivore', schooling: false, aggressiveness: 'semi-aggressive', lifespan: 10 }
    ];

    for (const sp of species) {
      this.fishSpecies.set(sp.id, sp);
    }

    this.log('Fish species database initialized: ' + this.fishSpecies.size);
  }

  _initializeCompatibilityMatrix() {
    this.compatibilityMatrix = {
      clownfish: { blue_tang: 'good', neon_tetra: 'incompatible', betta: 'incompatible', discus: 'incompatible', koi: 'incompatible', corydoras: 'incompatible', angel_fish: 'incompatible' },
      blue_tang: { clownfish: 'good', neon_tetra: 'incompatible', betta: 'incompatible', discus: 'incompatible', koi: 'incompatible', corydoras: 'incompatible', angel_fish: 'incompatible' },
      neon_tetra: { clownfish: 'incompatible', blue_tang: 'incompatible', betta: 'caution', discus: 'good', koi: 'incompatible', corydoras: 'good', angel_fish: 'caution' },
      betta: { clownfish: 'incompatible', blue_tang: 'incompatible', neon_tetra: 'caution', discus: 'incompatible', koi: 'incompatible', corydoras: 'good', angel_fish: 'incompatible' },
      discus: { clownfish: 'incompatible', blue_tang: 'incompatible', neon_tetra: 'good', betta: 'incompatible', koi: 'incompatible', corydoras: 'good', angel_fish: 'caution' },
      koi: { clownfish: 'incompatible', blue_tang: 'incompatible', neon_tetra: 'incompatible', betta: 'incompatible', discus: 'incompatible', corydoras: 'incompatible', angel_fish: 'incompatible' },
      corydoras: { clownfish: 'incompatible', blue_tang: 'incompatible', neon_tetra: 'good', betta: 'good', discus: 'good', koi: 'incompatible', angel_fish: 'good' },
      angel_fish: { clownfish: 'incompatible', blue_tang: 'incompatible', neon_tetra: 'caution', betta: 'incompatible', discus: 'caution', koi: 'incompatible', corydoras: 'good' }
    };
    this.log('Compatibility matrix initialized');
  }

  _initializeCoralFrags() {
    this.coralFrags.set('acropora_01', {
      id: 'acropora_01',
      species: 'Acropora millepora',
      type: 'SPS',
      tankId: 'reef_tank',
      placementDate: Date.now() - 90 * 86400000,
      initialSizeMm: 15,
      currentSizeMm: 28,
      growthRateMmPerMonth: 4.3,
      color: 'green_with_purple_tips',
      healthStatus: 'thriving',
      measurements: [],
      lightRequirement: 'high',
      flowRequirement: 'high'
    });

    this.coralFrags.set('zoa_colony_01', {
      id: 'zoa_colony_01',
      species: 'Zoanthus sp.',
      type: 'soft_coral',
      tankId: 'reef_tank',
      placementDate: Date.now() - 120 * 86400000,
      initialSizeMm: 20,
      currentSizeMm: 45,
      growthRateMmPerMonth: 6.25,
      color: 'rainbow_mix',
      healthStatus: 'thriving',
      measurements: [],
      lightRequirement: 'medium',
      flowRequirement: 'low'
    });

    this.coralFrags.set('hammer_coral_01', {
      id: 'hammer_coral_01',
      species: 'Euphyllia ancora',
      type: 'LPS',
      tankId: 'reef_tank',
      placementDate: Date.now() - 60 * 86400000,
      initialSizeMm: 30,
      currentSizeMm: 38,
      growthRateMmPerMonth: 4.0,
      color: 'green_with_gold',
      healthStatus: 'healthy',
      measurements: [],
      lightRequirement: 'medium',
      flowRequirement: 'medium'
    });

    this.log('Coral frags initialized: ' + this.coralFrags.size);
  }

  _initializeFeedingSchedules() {
    this.feedingSchedules.set('reef_tank', {
      tankId: 'reef_tank',
      schedule: [
        { time: '08:00', foodType: 'marine_pellets', amountGrams: 2 },
        { time: '18:00', foodType: 'frozen_mysis', amountGrams: 3 }
      ],
      lastFed: Date.now() - 3600000,
      dailyFeedingCount: 2,
      fastingDay: 'sunday',
      autoFeederEnabled: true
    });

    this.feedingSchedules.set('planted_tank', {
      tankId: 'planted_tank',
      schedule: [
        { time: '09:00', foodType: 'tropical_flakes', amountGrams: 1 },
        { time: '17:00', foodType: 'frozen_bloodworms', amountGrams: 1.5 }
      ],
      lastFed: Date.now() - 7200000,
      dailyFeedingCount: 2,
      fastingDay: null,
      autoFeederEnabled: false
    });

    this.feedingSchedules.set('koi_pond', {
      tankId: 'koi_pond',
      schedule: [
        { time: '07:00', foodType: 'koi_pellets', amountGrams: 50 },
        { time: '12:00', foodType: 'koi_pellets', amountGrams: 30 },
        { time: '17:00', foodType: 'koi_pellets', amountGrams: 40 }
      ],
      lastFed: Date.now() - 14400000,
      dailyFeedingCount: 3,
      fastingDay: null,
      autoFeederEnabled: true,
      winterFasting: true,
      winterFastBelowTemp: 10
    });

    this.log('Feeding schedules initialized');
  }

  _initializeEquipmentMaintenance() {
    this.equipmentMaintenance = [
      { id: 'reef_protein_skimmer', tankId: 'reef_tank', equipment: 'Protein Skimmer', task: 'Clean cup and neck', intervalDays: 3, lastDone: Date.now() - 2 * 86400000, nextDue: Date.now() + 1 * 86400000 },
      { id: 'reef_return_pump', tankId: 'reef_tank', equipment: 'Return Pump', task: 'Clean impeller and housing', intervalDays: 90, lastDone: Date.now() - 45 * 86400000, nextDue: Date.now() + 45 * 86400000 },
      { id: 'reef_ro_membrane', tankId: 'reef_tank', equipment: 'RO Membrane', task: 'Replace membrane', intervalDays: 365, lastDone: Date.now() - 200 * 86400000, nextDue: Date.now() + 165 * 86400000 },
      { id: 'planted_filter_media', tankId: 'planted_tank', equipment: 'Canister Filter', task: 'Rinse filter media in tank water', intervalDays: 30, lastDone: Date.now() - 20 * 86400000, nextDue: Date.now() + 10 * 86400000 },
      { id: 'planted_co2_refill', tankId: 'planted_tank', equipment: 'CO2 System', task: 'Refill CO2 cylinder', intervalDays: 60, lastDone: Date.now() - 40 * 86400000, nextDue: Date.now() + 20 * 86400000 },
      { id: 'koi_pond_pump', tankId: 'koi_pond', equipment: 'Pond Pump', task: 'Clean pre-filter and check flow rate', intervalDays: 14, lastDone: Date.now() - 10 * 86400000, nextDue: Date.now() + 4 * 86400000 },
      { id: 'koi_uv_sterilizer', tankId: 'koi_pond', equipment: 'UV Sterilizer', task: 'Replace UV bulb', intervalDays: 365, lastDone: Date.now() - 300 * 86400000, nextDue: Date.now() + 65 * 86400000 },
      { id: 'reef_test_kits', tankId: 'reef_tank', equipment: 'Test Kits', task: 'Check reagent expiry dates', intervalDays: 180, lastDone: Date.now() - 100 * 86400000, nextDue: Date.now() + 80 * 86400000 }
    ];

    this.log('Equipment maintenance tasks initialized: ' + this.equipmentMaintenance.length);
  }

  _initializeBreedingPrograms() {
    this.breedingPrograms.set('clownfish_pair', {
      id: 'clownfish_pair',
      species: 'Clownfish',
      tankId: 'reef_tank',
      male: { name: 'Nemo', size: 8, age: 2 },
      female: { name: 'Coral', size: 11, age: 3 },
      stage: 'conditioning',
      stages: ['conditioning', 'spawning', 'hatching', 'larval_rearing', 'juvenile'],
      currentStageStarted: Date.now() - 7 * 86400000,
      spawningCount: 0,
      lastSpawn: null,
      hatchRate: 0,
      survivalRate: 0,
      notes: []
    });

    this.breedingPrograms.set('discus_pair', {
      id: 'discus_pair',
      species: 'Discus',
      tankId: 'planted_tank',
      male: { name: 'King', size: 16, age: 3 },
      female: { name: 'Queen', size: 14, age: 2.5 },
      stage: 'conditioning',
      stages: ['conditioning', 'spawning', 'hatching', 'larval_rearing', 'juvenile'],
      currentStageStarted: Date.now() - 14 * 86400000,
      spawningCount: 0,
      lastSpawn: null,
      hatchRate: 0,
      survivalRate: 0,
      notes: []
    });

    this.log('Breeding programs initialized: ' + this.breedingPrograms.size);
  }

  _initializeLightingProfiles() {
    this.lightingProfiles.set('reef', {
      tankId: 'reef_tank',
      type: 'reef',
      channels: {
        actinic: { startHour: 9, endHour: 21, maxIntensity: 100, color: 'blue_420nm' },
        daylight: { startHour: 10, endHour: 20, maxIntensity: 80, color: 'white_14000K' },
        moonlight: { startHour: 21, endHour: 9, maxIntensity: 5, color: 'blue_royal' }
      },
      phases: {
        sunrise: { startHour: 9, durationMinutes: 60, rampPercent: 30 },
        day: { startHour: 10, endHour: 19, intensity: 100 },
        sunset: { startHour: 19, durationMinutes: 90, rampPercent: 30 },
        moonlight: { startHour: 21, endHour: 8, intensity: 5 }
      },
      parTarget: 350,
      currentPar: 320,
      totalWatts: 200
    });

    this.lightingProfiles.set('planted', {
      tankId: 'planted_tank',
      type: 'planted',
      channels: {
        fullSpectrum: { startHour: 8, endHour: 20, maxIntensity: 85, color: 'full_spectrum_6500K' },
        red: { startHour: 8, endHour: 20, maxIntensity: 60, color: 'red_660nm' },
        moonlight: { startHour: 20, endHour: 8, maxIntensity: 3, color: 'blue_soft' }
      },
      phases: {
        sunrise: { startHour: 8, durationMinutes: 45, rampPercent: 40 },
        day: { startHour: 9, endHour: 19, intensity: 85 },
        sunset: { startHour: 19, durationMinutes: 60, rampPercent: 40 },
        moonlight: { startHour: 20, endHour: 7, intensity: 3 }
      },
      parTarget: 120,
      currentPar: 110,
      totalWatts: 80
    });

    this.lightingProfiles.set('pond', {
      tankId: 'koi_pond',
      type: 'natural',
      channels: {},
      phases: {
        sunrise: { startHour: 6, durationMinutes: 0, rampPercent: 0 },
        day: { startHour: 6, endHour: 20, intensity: 100 },
        sunset: { startHour: 20, durationMinutes: 0, rampPercent: 0 },
        moonlight: { startHour: 20, endHour: 6, intensity: 0 }
      },
      parTarget: 0,
      currentPar: 0,
      totalWatts: 0,
      naturalLighting: true
    });

    this.log('Lighting profiles initialized: ' + this.lightingProfiles.size);
  }

  async _discoverDevices() {
    try {
      const devices = await this.homey.devices.getDevices();
      let discovered = 0;

      for (const [deviceId, device] of Object.entries(devices)) {
        const name = (device.name || '').toLowerCase();
        if (name.includes('aquarium') || name.includes('fish') || name.includes('tank') ||
            name.includes('reef') || name.includes('pond') || name.includes('water')) {
          this.sensorDevices.set(deviceId, {
            deviceId: deviceId,
            name: device.name,
            type: 'aquarium_sensor',
            lastReading: null
          });
          discovered++;
        }
      }

      this.log('Device discovery complete: ' + discovered + ' aquarium sensors found');
    } catch (err) {
      this.error('Device discovery failed: ' + err.message);
    }
  }

  diagnoseDisease(tankId, symptoms) {
    if (!Array.isArray(symptoms) || symptoms.length === 0) {
      return { success: false, reason: 'no_symptoms_provided' };
    }

    const matches = [];

    for (const disease of this.diseaseDatabase) {
      const matchedSymptoms = symptoms.filter(s => disease.symptoms.includes(s));
      const matchScore = matchedSymptoms.length / disease.symptoms.length;

      if (matchedSymptoms.length >= 2 || matchScore >= 0.4) {
        matches.push({
          diseaseId: disease.id,
          name: disease.name,
          matchScore: Math.round(matchScore * 100),
          matchedSymptoms: matchedSymptoms,
          unmatchedSymptoms: symptoms.filter(s => !disease.symptoms.includes(s)),
          treatment: disease.treatment,
          quarantineDays: disease.quarantineDays,
          contagious: disease.contagious,
          severity: disease.severity
        });
      }
    }

    matches.sort((a, b) => b.matchScore - a.matchScore);

    this.log('Disease diagnosis for tank ' + tankId + ': ' + matches.length + ' potential matches from ' + symptoms.length + ' symptoms');

    return {
      success: true,
      tankId: tankId,
      symptomsProvided: symptoms,
      diagnoses: matches,
      recommendation: matches.length > 0
        ? 'Most likely: ' + matches[0].name + ' (' + matches[0].matchScore + '% match). ' + matches[0].treatment
        : 'No matching disease found. Consider consulting a veterinarian.'
    };
  }

  measureCoralGrowth(fragId, newSizeMm) {
    const frag = this.coralFrags.get(fragId);
    if (!frag) {
      this.error('Coral frag not found: ' + fragId);
      return null;
    }

    const previousSize = frag.currentSizeMm;
    frag.currentSizeMm = newSizeMm;

    const daysSincePlacement = (Date.now() - frag.placementDate) / 86400000;
    const monthsSincePlacement = daysSincePlacement / 30;
    frag.growthRateMmPerMonth = monthsSincePlacement > 0
      ? Math.round(((newSizeMm - frag.initialSizeMm) / monthsSincePlacement) * 100) / 100
      : 0;

    frag.measurements.push({
      timestamp: Date.now(),
      sizeMm: newSizeMm,
      growthSinceLastMm: newSizeMm - previousSize
    });

    if (frag.measurements.length > 100) {
      frag.measurements = frag.measurements.slice(-50);
    }

    this.log('Coral growth measured: ' + frag.species + ' now ' + newSizeMm + ' mm (rate: ' + frag.growthRateMmPerMonth + ' mm/month)');

    return {
      fragId: fragId,
      species: frag.species,
      previousSizeMm: previousSize,
      currentSizeMm: newSizeMm,
      growthMm: newSizeMm - previousSize,
      growthRateMmPerMonth: frag.growthRateMmPerMonth,
      totalGrowthMm: newSizeMm - frag.initialSizeMm,
      healthStatus: frag.healthStatus
    };
  }

  calculateWaterChange(tankId) {
    const tank = this.tanks.get(tankId);
    if (!tank) {
      this.error('Tank not found: ' + tankId);
      return null;
    }

    const daysSinceLastChange = (Date.now() - tank.lastWaterChange) / 86400000;
    const isOverdue = daysSinceLastChange > tank.waterChangeIntervalDays;
    const changeVolumeLiters = Math.round(tank.volumeLiters * (tank.waterChangePercentage / 100));

    const urgentParams = [];
    for (const [param, data] of Object.entries(tank.parameters)) {
      if (data.current > data.max) {
        urgentParams.push(param + ' HIGH (' + data.current + ' ' + data.unit + ', max ' + data.max + ')');
      }
      if (data.current < data.min && data.min > 0) {
        urgentParams.push(param + ' LOW (' + data.current + ' ' + data.unit + ', min ' + data.min + ')');
      }
    }

    return {
      tankId: tankId,
      tankName: tank.name,
      volumeLiters: tank.volumeLiters,
      changePercentage: tank.waterChangePercentage,
      changeVolumeLiters: changeVolumeLiters,
      daysSinceLastChange: Math.round(daysSinceLastChange * 10) / 10,
      isOverdue: isOverdue,
      urgentParameters: urgentParams,
      nextScheduled: new Date(tank.lastWaterChange + tank.waterChangeIntervalDays * 86400000).toISOString().substring(0, 10),
      isSaltwater: tank.type === 'saltwater',
      saltNeededKg: tank.type === 'saltwater' ? Math.round(changeVolumeLiters * 0.035 * 100) / 100 : 0
    };
  }

  performWaterChange(tankId) {
    const tank = this.tanks.get(tankId);
    if (!tank) return { success: false, reason: 'tank_not_found' };

    tank.lastWaterChange = Date.now();
    const changeVolume = tank.volumeLiters * (tank.waterChangePercentage / 100);

    if (tank.parameters.nitrate) {
      tank.parameters.nitrate.current *= (1 - tank.waterChangePercentage / 100);
    }
    if (tank.parameters.phosphate) {
      tank.parameters.phosphate.current *= (1 - tank.waterChangePercentage / 100);
    }

    this.waterChangeLog.push({
      tankId: tankId,
      timestamp: Date.now(),
      volumeLiters: changeVolume,
      percentage: tank.waterChangePercentage
    });

    if (this.waterChangeLog.length > 500) {
      this.waterChangeLog = this.waterChangeLog.slice(-250);
    }

    this.log('Water change performed: ' + tank.name + ' - ' + changeVolume.toFixed(1) + 'L (' + tank.waterChangePercentage + '%)');
    return { success: true, volumeChanged: changeVolume, tankName: tank.name };
  }

  getParameterHistory(tankId, param, days) {
    const tank = this.tanks.get(tankId);
    if (!tank) return null;

    const cutoff = Date.now() - (days || 7) * 86400000;
    const history = tank.parameterHistory.filter(h => h.timestamp >= cutoff && h.parameter === param);

    if (history.length === 0) {
      return { tankId: tankId, parameter: param, days: days, entries: [], trend: 'no_data' };
    }

    const values = history.map(h => h.value);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const trend = values.length > 1
      ? (values[values.length - 1] > values[0] ? 'increasing' : values[values.length - 1] < values[0] ? 'decreasing' : 'stable')
      : 'stable';

    return {
      tankId: tankId,
      parameter: param,
      days: days || 7,
      entries: history,
      average: Math.round(avg * 100) / 100,
      min: Math.min(...values),
      max: Math.max(...values),
      trend: trend
    };
  }

  calculatePortion(tankId) {
    const tank = this.tanks.get(tankId);
    if (!tank) return null;

    const schedule = this.feedingSchedules.get(tankId);
    if (!schedule) return null;

    const basePortionGrams = tank.volumeLiters * 0.01 * tank.bioLoad;

    const today = new Date();
    const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][today.getDay()];
    if (schedule.fastingDay === dayName) {
      return { tankId: tankId, portion: 0, reason: 'fasting_day' };
    }

    if (schedule.winterFasting && tank.parameters.temperature && tank.parameters.temperature.current < schedule.winterFastBelowTemp) {
      return { tankId: tankId, portion: 0, reason: 'winter_fasting_temp_too_low' };
    }

    const temp = tank.parameters.temperature ? tank.parameters.temperature.current : 25;
    let tempModifier = 1.0;
    if (temp < 15) tempModifier = 0.3;
    else if (temp < 20) tempModifier = 0.6;
    else if (temp > 28) tempModifier = 1.2;

    const adjustedPortion = basePortionGrams * tempModifier;

    return {
      tankId: tankId,
      tankName: tank.name,
      portionGrams: Math.round(adjustedPortion * 100) / 100,
      bioLoad: tank.bioLoad,
      tempModifier: tempModifier,
      feedingsPerDay: schedule.dailyFeedingCount,
      perFeedingGrams: Math.round((adjustedPortion / schedule.dailyFeedingCount) * 100) / 100
    };
  }

  checkAutoTopOff(tankId) {
    const tank = this.tanks.get(tankId);
    if (!tank || !tank.autoTopOff || !tank.autoTopOff.enabled) return null;

    const ato = tank.autoTopOff;
    const dailyEvaporation = ato.evaporationRateLPerDay;
    const daysUntilReservoirEmpty = ato.reservoirCurrent > 0
      ? Math.floor(ato.reservoirCurrent / dailyEvaporation)
      : 0;

    const reservoirPercent = Math.round((ato.reservoirCurrent / ato.reservoirLiters) * 100);

    return {
      tankId: tankId,
      enabled: true,
      evaporationRateLPerDay: dailyEvaporation,
      reservoirCapacity: ato.reservoirLiters,
      reservoirCurrent: Math.round(ato.reservoirCurrent * 10) / 10,
      reservoirPercent: reservoirPercent,
      daysUntilEmpty: daysUntilReservoirEmpty,
      needsRefill: reservoirPercent < 20,
      lowAlarm: reservoirPercent < 10
    };
  }

  checkCompatibility(species1, species2) {
    const compat = this.compatibilityMatrix[species1];
    if (!compat) return { compatible: 'unknown', reason: 'species_not_in_database' };

    const result = compat[species2];
    if (!result) return { compatible: 'unknown', reason: 'species_not_in_database' };

    const sp1 = this.fishSpecies.get(species1);
    const sp2 = this.fishSpecies.get(species2);

    const reasons = [];
    if (sp1 && sp2 && sp1.type !== sp2.type) {
      reasons.push('Different water types (' + sp1.type + ' vs ' + sp2.type + ')');
    }

    return {
      species1: species1,
      species2: species2,
      compatibility: result,
      reasons: reasons,
      species1Info: sp1 || null,
      species2Info: sp2 || null
    };
  }

  getEquipmentDue() {
    const now = Date.now();
    const due = this.equipmentMaintenance
      .filter(e => e.nextDue <= now + 7 * 86400000)
      .map(e => ({
        id: e.id,
        tankId: e.tankId,
        equipment: e.equipment,
        task: e.task,
        daysOverdue: Math.max(0, Math.floor((now - e.nextDue) / 86400000)),
        daysUntilDue: Math.ceil((e.nextDue - now) / 86400000),
        isOverdue: e.nextDue <= now
      }))
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue);

    return due;
  }

  completeMaintenanceTask(taskId) {
    const task = this.equipmentMaintenance.find(e => e.id === taskId);
    if (!task) return { success: false, reason: 'task_not_found' };

    task.lastDone = Date.now();
    task.nextDue = Date.now() + task.intervalDays * 86400000;

    this.log('Maintenance completed: ' + task.equipment + ' - ' + task.task);
    return { success: true, equipment: task.equipment, nextDue: new Date(task.nextDue).toISOString().substring(0, 10) };
  }

  _startMonitoring() {
    this.monitoringInterval = setInterval(() => {
      this._monitoringCycle();
    }, 300000);

    this.log('Monitoring started: 5-min aquarium parameter checks');
  }

  _monitoringCycle() {
    try {
      for (const [tankId, tank] of this.tanks) {
        this._simulateParameterChanges(tank);
        this._checkParameterAlerts(tankId, tank);
        this._simulateAutoTopOff(tank);
        this._recordParameterHistory(tankId, tank);
      }

      const dueTasks = this.getEquipmentDue();
      for (const task of dueTasks) {
        if (task.isOverdue) {
          this.log('MAINTENANCE OVERDUE: ' + task.equipment + ' (' + task.task + ') - ' + task.daysOverdue + ' days overdue');
        }
      }
    } catch (err) {
      this.error('Monitoring cycle error: ' + err.message);
    }
  }

  _simulateParameterChanges(tank) {
    for (const [param, data] of Object.entries(tank.parameters)) {
      const range = data.max - data.min;
      const drift = (Math.random() - 0.5) * range * 0.02;
      data.current = Math.round((data.current + drift) * 100) / 100;
      data.current = Math.max(data.min * 0.8, Math.min(data.max * 1.2, data.current));
    }
    tank.lastUpdated = Date.now();
  }

  _checkParameterAlerts(tankId, tank) {
    for (const [param, data] of Object.entries(tank.parameters)) {
      if (data.current > data.max) {
        this.log('ALERT: ' + tank.name + ' - ' + param + ' HIGH: ' + data.current + ' ' + data.unit + ' (max ' + data.max + ')');
      }
      if (data.current < data.min && data.min > 0) {
        this.log('ALERT: ' + tank.name + ' - ' + param + ' LOW: ' + data.current + ' ' + data.unit + ' (min ' + data.min + ')');
      }
    }
  }

  _simulateAutoTopOff(tank) {
    if (tank.autoTopOff && tank.autoTopOff.enabled) {
      const evapPerCycle = tank.autoTopOff.evaporationRateLPerDay / 288;
      tank.autoTopOff.reservoirCurrent = Math.max(0, tank.autoTopOff.reservoirCurrent - evapPerCycle);
    }
  }

  _recordParameterHistory(tankId, tank) {
    for (const [param, data] of Object.entries(tank.parameters)) {
      tank.parameterHistory.push({
        parameter: param,
        value: data.current,
        timestamp: Date.now()
      });
    }

    if (tank.parameterHistory.length > 5000) {
      tank.parameterHistory = tank.parameterHistory.slice(-2500);
    }
  }

  getStatistics() {
    const tankSummaries = {};
    for (const [id, tank] of this.tanks) {
      const params = {};
      for (const [param, data] of Object.entries(tank.parameters)) {
        params[param] = {
          current: data.current,
          min: data.min,
          max: data.max,
          unit: data.unit,
          inRange: data.current >= data.min && data.current <= data.max
        };
      }

      const waterChange = this.calculateWaterChange(id);
      const feeding = this.calculatePortion(id);
      const ato = this.checkAutoTopOff(id);

      tankSummaries[id] = {
        name: tank.name,
        type: tank.type,
        volumeLiters: tank.volumeLiters,
        parameters: params,
        bioLoad: tank.bioLoad,
        waterChange: waterChange,
        feeding: feeding,
        autoTopOff: ato,
        lastUpdated: tank.lastUpdated
      };
    }

    const coralSummary = {};
    for (const [id, frag] of this.coralFrags) {
      coralSummary[id] = {
        species: frag.species,
        type: frag.type,
        currentSizeMm: frag.currentSizeMm,
        growthRateMmPerMonth: frag.growthRateMmPerMonth,
        healthStatus: frag.healthStatus
      };
    }

    const breedingSummary = {};
    for (const [id, program] of this.breedingPrograms) {
      breedingSummary[id] = {
        species: program.species,
        stage: program.stage,
        spawningCount: program.spawningCount
      };
    }

    return {
      tanks: tankSummaries,
      corals: coralSummary,
      breeding: breedingSummary,
      equipmentDue: this.getEquipmentDue(),
      totalMaintenanceTasks: this.equipmentMaintenance.length,
      fishSpecies: this.fishSpecies.size,
      diseases: this.diseaseDatabase.length,
      waterChanges: this.waterChangeLog.length,
      sensorDevices: this.sensorDevices.size,
      lightingProfiles: Array.from(this.lightingProfiles.keys()),
      uptime: this.initialized ? 'active' : 'inactive'
    };
  }

  log(msg) {
    this.homey.log('[Aquarium]', msg);
  }

  error(msg) {
    this.homey.error('[Aquarium]', msg);
  }

  destroy() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.log('Smart Aquarium Management System destroyed');
  }
}

module.exports = SmartAquariumManagementSystem;
