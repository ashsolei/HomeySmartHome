'use strict';

class AdvancedIndoorPlantCareSystem {
  constructor(homey) {
    this.homey = homey;
    this.plantProfiles = new Map();
    this.growLightProfiles = new Map();
    this.humidityZones = new Map();
    this.roomMicroclimates = new Map();
    this.propagationTracker = new Map();
    this.growthJournal = [];
    this.pestDatabase = new Map();
    this.fertilizationSchedules = new Map();
    this.soilSensors = new Map();
    this.monitoringInterval = null;
    this.lightCompensationInterval = null;
    this.initialized = false;
  }

  async initialize() {
    try {
      this.log('Initializing Advanced Indoor Plant Care System...');
      try {
        this._initializePlantProfiles();
        this._initializeGrowLightProfiles();
        this._initializePestDatabase();
        this._initializeHumidityZones();
        this._initializeRoomMicroclimates();
        this._initializePropagationTracker();
        this._initializeFertilizationSchedules();
        await this._discoverSensors();
        this._startMonitoring();
        this._startLightCompensation();
        this.initialized = true;
        this.log('Advanced Indoor Plant Care System initialized successfully');
      } catch (err) {
        this.error('Failed to initialize Advanced Indoor Plant Care System: ' + err.message);
        throw err;
      }
    } catch (error) {
      this.homey.error(`[AdvancedIndoorPlantCareSystem] Failed to initialize:`, error.message);
    }
  }

  _initializePlantProfiles() {
    const species = [
      { id: 'monstera_deliciosa', name: 'Monstera Deliciosa', commonName: 'Swiss Cheese Plant', lightNeeds: 'bright_indirect', parTarget: 200, ppfdTarget: 150, waterFrequencyDays: 7, optimalMoisture: [40, 60], optimalTemp: [18, 27], optimalHumidity: [50, 70], toxicToPets: true, airPurifyScore: 7, repotIntervalMonths: 18, matureSize: 'large', growthRate: 'medium', nativeRegion: 'Central America', fertilizeFrequencyWeeks: 4, winterPause: true, propagation: ['stem_cutting', 'air_layering'] },
      { id: 'pothos', name: 'Epipremnum aureum', commonName: 'Golden Pothos', lightNeeds: 'low_to_bright_indirect', parTarget: 100, ppfdTarget: 80, waterFrequencyDays: 7, optimalMoisture: [30, 60], optimalTemp: [15, 29], optimalHumidity: [40, 60], toxicToPets: true, airPurifyScore: 9, repotIntervalMonths: 24, matureSize: 'trailing', growthRate: 'fast', nativeRegion: 'Southeast Asia', fertilizeFrequencyWeeks: 4, winterPause: true, propagation: ['stem_cutting', 'water_propagation'] },
      { id: 'snake_plant', name: 'Dracaena trifasciata', commonName: 'Snake Plant', lightNeeds: 'low_to_bright_indirect', parTarget: 80, ppfdTarget: 60, waterFrequencyDays: 14, optimalMoisture: [20, 40], optimalTemp: [15, 30], optimalHumidity: [30, 50], toxicToPets: true, airPurifyScore: 9, repotIntervalMonths: 36, matureSize: 'medium', growthRate: 'slow', nativeRegion: 'West Africa', fertilizeFrequencyWeeks: 8, winterPause: true, propagation: ['leaf_cutting', 'division'] },
      { id: 'fiddle_leaf_fig', name: 'Ficus lyrata', commonName: 'Fiddle Leaf Fig', lightNeeds: 'bright_indirect', parTarget: 300, ppfdTarget: 200, waterFrequencyDays: 10, optimalMoisture: [40, 60], optimalTemp: [18, 26], optimalHumidity: [50, 70], toxicToPets: true, airPurifyScore: 6, repotIntervalMonths: 24, matureSize: 'large', growthRate: 'medium', nativeRegion: 'West Africa', fertilizeFrequencyWeeks: 4, winterPause: true, propagation: ['stem_cutting', 'air_layering'] },
      { id: 'peace_lily', name: 'Spathiphyllum', commonName: 'Peace Lily', lightNeeds: 'low_to_medium', parTarget: 100, ppfdTarget: 75, waterFrequencyDays: 7, optimalMoisture: [50, 70], optimalTemp: [18, 26], optimalHumidity: [50, 70], toxicToPets: true, airPurifyScore: 10, repotIntervalMonths: 24, matureSize: 'medium', growthRate: 'medium', nativeRegion: 'Central America', fertilizeFrequencyWeeks: 6, winterPause: true, propagation: ['division'] },
      { id: 'rubber_plant', name: 'Ficus elastica', commonName: 'Rubber Plant', lightNeeds: 'bright_indirect', parTarget: 250, ppfdTarget: 180, waterFrequencyDays: 10, optimalMoisture: [40, 60], optimalTemp: [16, 27], optimalHumidity: [40, 60], toxicToPets: true, airPurifyScore: 8, repotIntervalMonths: 24, matureSize: 'large', growthRate: 'medium', nativeRegion: 'Southeast Asia', fertilizeFrequencyWeeks: 4, winterPause: true, propagation: ['stem_cutting', 'air_layering'] },
      { id: 'zz_plant', name: 'Zamioculcas zamiifolia', commonName: 'ZZ Plant', lightNeeds: 'low_to_bright_indirect', parTarget: 80, ppfdTarget: 50, waterFrequencyDays: 21, optimalMoisture: [15, 35], optimalTemp: [15, 28], optimalHumidity: [30, 50], toxicToPets: true, airPurifyScore: 7, repotIntervalMonths: 36, matureSize: 'medium', growthRate: 'slow', nativeRegion: 'East Africa', fertilizeFrequencyWeeks: 8, winterPause: true, propagation: ['division', 'leaf_cutting'] },
      { id: 'spider_plant', name: 'Chlorophytum comosum', commonName: 'Spider Plant', lightNeeds: 'medium_indirect', parTarget: 150, ppfdTarget: 100, waterFrequencyDays: 7, optimalMoisture: [40, 60], optimalTemp: [13, 27], optimalHumidity: [40, 60], toxicToPets: false, airPurifyScore: 9, repotIntervalMonths: 18, matureSize: 'medium', growthRate: 'fast', nativeRegion: 'Southern Africa', fertilizeFrequencyWeeks: 4, winterPause: true, propagation: ['offsets', 'division'] },
      { id: 'calathea', name: 'Calathea orbifolia', commonName: 'Calathea', lightNeeds: 'medium_indirect', parTarget: 120, ppfdTarget: 80, waterFrequencyDays: 5, optimalMoisture: [50, 70], optimalTemp: [18, 25], optimalHumidity: [60, 80], toxicToPets: false, airPurifyScore: 7, repotIntervalMonths: 18, matureSize: 'medium', growthRate: 'medium', nativeRegion: 'South America', fertilizeFrequencyWeeks: 4, winterPause: true, propagation: ['division'] },
      { id: 'philodendron_heart', name: 'Philodendron hederaceum', commonName: 'Heartleaf Philodendron', lightNeeds: 'medium_indirect', parTarget: 150, ppfdTarget: 100, waterFrequencyDays: 7, optimalMoisture: [40, 60], optimalTemp: [18, 28], optimalHumidity: [50, 70], toxicToPets: true, airPurifyScore: 8, repotIntervalMonths: 18, matureSize: 'trailing', growthRate: 'fast', nativeRegion: 'Central America', fertilizeFrequencyWeeks: 4, winterPause: true, propagation: ['stem_cutting', 'water_propagation'] },
      { id: 'aloe_vera', name: 'Aloe vera', commonName: 'Aloe Vera', lightNeeds: 'bright_indirect_to_direct', parTarget: 350, ppfdTarget: 250, waterFrequencyDays: 14, optimalMoisture: [15, 35], optimalTemp: [13, 27], optimalHumidity: [30, 50], toxicToPets: true, airPurifyScore: 6, repotIntervalMonths: 24, matureSize: 'medium', growthRate: 'slow', nativeRegion: 'Arabian Peninsula', fertilizeFrequencyWeeks: 8, winterPause: true, propagation: ['offsets', 'division'] },
      { id: 'boston_fern', name: 'Nephrolepis exaltata', commonName: 'Boston Fern', lightNeeds: 'medium_indirect', parTarget: 100, ppfdTarget: 75, waterFrequencyDays: 3, optimalMoisture: [60, 80], optimalTemp: [16, 24], optimalHumidity: [60, 80], toxicToPets: false, airPurifyScore: 10, repotIntervalMonths: 18, matureSize: 'medium', growthRate: 'medium', nativeRegion: 'Americas', fertilizeFrequencyWeeks: 4, winterPause: true, propagation: ['division', 'runners'] },
      { id: 'string_of_pearls', name: 'Senecio rowleyanus', commonName: 'String of Pearls', lightNeeds: 'bright_indirect', parTarget: 250, ppfdTarget: 180, waterFrequencyDays: 14, optimalMoisture: [15, 35], optimalTemp: [15, 25], optimalHumidity: [30, 50], toxicToPets: true, airPurifyScore: 4, repotIntervalMonths: 24, matureSize: 'trailing', growthRate: 'medium', nativeRegion: 'Southern Africa', fertilizeFrequencyWeeks: 6, winterPause: true, propagation: ['stem_cutting'] },
      { id: 'chinese_money', name: 'Pilea peperomioides', commonName: 'Chinese Money Plant', lightNeeds: 'bright_indirect', parTarget: 200, ppfdTarget: 150, waterFrequencyDays: 7, optimalMoisture: [40, 60], optimalTemp: [15, 26], optimalHumidity: [40, 60], toxicToPets: false, airPurifyScore: 6, repotIntervalMonths: 18, matureSize: 'small', growthRate: 'medium', nativeRegion: 'China', fertilizeFrequencyWeeks: 4, winterPause: true, propagation: ['offsets', 'stem_cutting'] },
      { id: 'bird_of_paradise', name: 'Strelitzia reginae', commonName: 'Bird of Paradise', lightNeeds: 'bright_direct', parTarget: 400, ppfdTarget: 300, waterFrequencyDays: 10, optimalMoisture: [40, 60], optimalTemp: [18, 30], optimalHumidity: [50, 70], toxicToPets: true, airPurifyScore: 6, repotIntervalMonths: 24, matureSize: 'large', growthRate: 'medium', nativeRegion: 'South Africa', fertilizeFrequencyWeeks: 4, winterPause: true, propagation: ['division'] },
      { id: 'string_of_hearts', name: 'Ceropegia woodii', commonName: 'String of Hearts', lightNeeds: 'bright_indirect', parTarget: 200, ppfdTarget: 150, waterFrequencyDays: 14, optimalMoisture: [15, 35], optimalTemp: [15, 25], optimalHumidity: [30, 50], toxicToPets: false, airPurifyScore: 4, repotIntervalMonths: 24, matureSize: 'trailing', growthRate: 'medium', nativeRegion: 'Southern Africa', fertilizeFrequencyWeeks: 6, winterPause: true, propagation: ['stem_cutting', 'tuber'] },
      { id: 'alocasia', name: 'Alocasia amazonica', commonName: 'Elephant Ear', lightNeeds: 'bright_indirect', parTarget: 250, ppfdTarget: 180, waterFrequencyDays: 7, optimalMoisture: [50, 70], optimalTemp: [18, 28], optimalHumidity: [60, 80], toxicToPets: true, airPurifyScore: 5, repotIntervalMonths: 18, matureSize: 'large', growthRate: 'medium', nativeRegion: 'Southeast Asia', fertilizeFrequencyWeeks: 4, winterPause: true, propagation: ['division', 'corms'] },
      { id: 'croton', name: 'Codiaeum variegatum', commonName: 'Croton', lightNeeds: 'bright_direct', parTarget: 350, ppfdTarget: 250, waterFrequencyDays: 7, optimalMoisture: [50, 70], optimalTemp: [18, 27], optimalHumidity: [50, 70], toxicToPets: true, airPurifyScore: 5, repotIntervalMonths: 24, matureSize: 'medium', growthRate: 'medium', nativeRegion: 'Southeast Asia', fertilizeFrequencyWeeks: 4, winterPause: true, propagation: ['stem_cutting', 'air_layering'] },
      { id: 'jade_plant', name: 'Crassula ovata', commonName: 'Jade Plant', lightNeeds: 'bright_indirect_to_direct', parTarget: 300, ppfdTarget: 200, waterFrequencyDays: 14, optimalMoisture: [15, 35], optimalTemp: [15, 26], optimalHumidity: [30, 50], toxicToPets: true, airPurifyScore: 5, repotIntervalMonths: 36, matureSize: 'medium', growthRate: 'slow', nativeRegion: 'South Africa', fertilizeFrequencyWeeks: 8, winterPause: true, propagation: ['leaf_cutting', 'stem_cutting'] },
      { id: 'orchid_phalaenopsis', name: 'Phalaenopsis', commonName: 'Moth Orchid', lightNeeds: 'medium_indirect', parTarget: 120, ppfdTarget: 80, waterFrequencyDays: 7, optimalMoisture: [30, 50], optimalTemp: [18, 27], optimalHumidity: [50, 70], toxicToPets: false, airPurifyScore: 5, repotIntervalMonths: 18, matureSize: 'small', growthRate: 'slow', nativeRegion: 'Southeast Asia', fertilizeFrequencyWeeks: 4, winterPause: false, propagation: ['keiki', 'division'] }
    ];

    for (const s of species) {
      this.plantProfiles.set(s.id, {
        ...s,
        instances: [],
        totalInstances: 0
      });
    }

    this._addDefaultInstances();
    this.log('Plant profiles initialized: ' + this.plantProfiles.size + ' species');
  }

  _addDefaultInstances() {
    const defaults = [
      { speciesId: 'monstera_deliciosa', instanceId: 'plant_001', nickname: 'Big Monty', room: 'living_room', lastWatered: Date.now() - 3 * 86400000, lastFertilized: Date.now() - 20 * 86400000, lastRepotted: Date.now() - 180 * 86400000, healthScore: 85, currentMoisture: 45, potSizeCm: 25 },
      { speciesId: 'pothos', instanceId: 'plant_002', nickname: 'Goldie', room: 'kitchen', lastWatered: Date.now() - 2 * 86400000, lastFertilized: Date.now() - 15 * 86400000, lastRepotted: Date.now() - 365 * 86400000, healthScore: 90, currentMoisture: 50, potSizeCm: 18 },
      { speciesId: 'snake_plant', instanceId: 'plant_003', nickname: 'Snakey', room: 'bedroom', lastWatered: Date.now() - 10 * 86400000, lastFertilized: Date.now() - 45 * 86400000, lastRepotted: Date.now() - 500 * 86400000, healthScore: 92, currentMoisture: 25, potSizeCm: 20 },
      { speciesId: 'calathea', instanceId: 'plant_004', nickname: 'Cali', room: 'bathroom', lastWatered: Date.now() - 1 * 86400000, lastFertilized: Date.now() - 10 * 86400000, lastRepotted: Date.now() - 200 * 86400000, healthScore: 78, currentMoisture: 60, potSizeCm: 18 },
      { speciesId: 'fiddle_leaf_fig', instanceId: 'plant_005', nickname: 'Figaro', room: 'living_room', lastWatered: Date.now() - 5 * 86400000, lastFertilized: Date.now() - 25 * 86400000, lastRepotted: Date.now() - 300 * 86400000, healthScore: 82, currentMoisture: 40, potSizeCm: 30 },
      { speciesId: 'spider_plant', instanceId: 'plant_006', nickname: 'Spidey', room: 'office', lastWatered: Date.now() - 4 * 86400000, lastFertilized: Date.now() - 18 * 86400000, lastRepotted: Date.now() - 150 * 86400000, healthScore: 88, currentMoisture: 42, potSizeCm: 18 },
      { speciesId: 'peace_lily', instanceId: 'plant_007', nickname: 'Lily', room: 'office', lastWatered: Date.now() - 3 * 86400000, lastFertilized: Date.now() - 30 * 86400000, lastRepotted: Date.now() - 250 * 86400000, healthScore: 86, currentMoisture: 55, potSizeCm: 22 },
      { speciesId: 'orchid_phalaenopsis', instanceId: 'plant_008', nickname: 'Orchie', room: 'living_room', lastWatered: Date.now() - 4 * 86400000, lastFertilized: Date.now() - 22 * 86400000, lastRepotted: Date.now() - 400 * 86400000, healthScore: 80, currentMoisture: 35, potSizeCm: 14 }
    ];

    for (const d of defaults) {
      const species = this.plantProfiles.get(d.speciesId);
      if (species) {
        species.instances.push({
          instanceId: d.instanceId,
          nickname: d.nickname,
          room: d.room,
          lastWatered: d.lastWatered,
          lastFertilized: d.lastFertilized,
          lastRepotted: d.lastRepotted,
          healthScore: d.healthScore,
          currentMoisture: d.currentMoisture,
          potSizeCm: d.potSizeCm,
          pestIssues: [],
          notes: [],
          growthLog: []
        });
        species.totalInstances++;
      }
    }
  }

  _initializeGrowLightProfiles() {
    const lights = [
      { id: 'full_spectrum_led', name: 'Full Spectrum LED Panel', wattage: 45, parOutput: 400, ppfdOutput: 300, colorTemp: 5000, uvComponent: true, duration14hSummer: 14, duration10hWinter: 10, suitableFor: ['bright_direct', 'bright_indirect', 'bright_indirect_to_direct'] },
      { id: 'warm_led_strip', name: 'Warm LED Grow Strip', wattage: 20, parOutput: 150, ppfdOutput: 100, colorTemp: 3000, uvComponent: false, duration14hSummer: 12, duration10hWinter: 10, suitableFor: ['medium_indirect', 'low_to_medium', 'low_to_bright_indirect'] },
      { id: 'desktop_grow_lamp', name: 'Desktop Grow Lamp', wattage: 15, parOutput: 200, ppfdOutput: 120, colorTemp: 4000, uvComponent: false, duration14hSummer: 12, duration10hWinter: 10, suitableFor: ['medium_indirect', 'bright_indirect'] },
      { id: 'high_power_cob', name: 'High Power COB LED', wattage: 100, parOutput: 800, ppfdOutput: 600, colorTemp: 5500, uvComponent: true, duration14hSummer: 14, duration10hWinter: 12, suitableFor: ['bright_direct', 'bright_indirect_to_direct'] },
      { id: 'supplemental_tube', name: 'Supplemental LED Tube', wattage: 12, parOutput: 100, ppfdOutput: 70, colorTemp: 6500, uvComponent: false, duration14hSummer: 14, duration10hWinter: 12, suitableFor: ['low_to_bright_indirect', 'low_to_medium', 'medium_indirect'] }
    ];

    for (const light of lights) {
      this.growLightProfiles.set(light.id, light);
    }

    this.log('Grow light profiles initialized: ' + this.growLightProfiles.size);
  }

  _initializePestDatabase() {
    const pests = [
      { id: 'fungus_gnats', name: 'Fungus Gnats', symptoms: ['tiny_flying_insects', 'root_damage', 'yellowing_lower_leaves'], treatment: 'Let soil dry between waterings. Yellow sticky traps. Neem oil drench.', riskFactors: ['overwatering', 'high_humidity', 'organic_soil'], severity: 'low' },
      { id: 'spider_mites', name: 'Spider Mites', symptoms: ['fine_webbing', 'stippled_leaves', 'leaf_drop', 'yellow_dots'], treatment: 'Spray with water. Neem oil. Increase humidity. Wipe leaves regularly.', riskFactors: ['dry_air', 'low_humidity', 'dusty_leaves'], severity: 'high' },
      { id: 'mealybugs', name: 'Mealybugs', symptoms: ['white_cottony_masses', 'sticky_residue', 'yellowing', 'stunted_growth'], treatment: 'Alcohol swab. Neem oil. Insecticidal soap. Isolate plant.', riskFactors: ['new_plants', 'warm_conditions', 'crowded_plants'], severity: 'moderate' },
      { id: 'scale', name: 'Scale Insects', symptoms: ['brown_bumps_on_stems', 'sticky_residue', 'sooty_mold', 'leaf_drop'], treatment: 'Scrape off. Horticultural oil. Neem oil. Systemic treatment.', riskFactors: ['poor_air_circulation', 'weak_plants', 'dust'], severity: 'moderate' },
      { id: 'thrips', name: 'Thrips', symptoms: ['silvery_streaks', 'distorted_growth', 'black_specks', 'scarring'], treatment: 'Blue sticky traps. Spinosad spray. Neem oil. Isolate.', riskFactors: ['open_windows', 'new_plants', 'flowers'], severity: 'moderate' },
      { id: 'whitefly', name: 'Whitefly', symptoms: ['tiny_white_flying_insects', 'sticky_leaves', 'yellowing', 'sooty_mold'], treatment: 'Yellow sticky traps. Insecticidal soap. Neem oil.', riskFactors: ['new_plants', 'warm_conditions', 'poor_ventilation'], severity: 'moderate' },
      { id: 'root_rot', name: 'Root Rot', symptoms: ['mushy_roots', 'wilting', 'yellow_leaves', 'foul_smell'], treatment: 'Remove affected roots. Repot in fresh dry mix. Reduce watering.', riskFactors: ['overwatering', 'poor_drainage', 'heavy_soil'], severity: 'high' },
      { id: 'powdery_mildew', name: 'Powdery Mildew', symptoms: ['white_powder_on_leaves', 'distorted_growth', 'leaf_drop'], treatment: 'Improve air circulation. Baking soda spray. Fungicide.', riskFactors: ['poor_air_circulation', 'high_humidity', 'crowded_plants'], severity: 'moderate' }
    ];

    for (const pest of pests) {
      this.pestDatabase.set(pest.id, pest);
    }

    this.log('Pest database initialized: ' + this.pestDatabase.size + ' pests');
  }

  _initializeHumidityZones() {
    this.humidityZones.set('living_room', {
      id: 'living_room',
      name: 'Living Room',
      currentHumidity: 45,
      targetHumidity: 55,
      humidifierDeviceId: null,
      humidifierActive: false,
      plantCount: 3,
      lastUpdated: Date.now()
    });

    this.humidityZones.set('bedroom', {
      id: 'bedroom',
      name: 'Bedroom',
      currentHumidity: 42,
      targetHumidity: 50,
      humidifierDeviceId: null,
      humidifierActive: false,
      plantCount: 1,
      lastUpdated: Date.now()
    });

    this.humidityZones.set('bathroom', {
      id: 'bathroom',
      name: 'Bathroom',
      currentHumidity: 65,
      targetHumidity: 65,
      humidifierDeviceId: null,
      humidifierActive: false,
      plantCount: 1,
      lastUpdated: Date.now()
    });

    this.humidityZones.set('kitchen', {
      id: 'kitchen',
      name: 'Kitchen',
      currentHumidity: 50,
      targetHumidity: 55,
      humidifierDeviceId: null,
      humidifierActive: false,
      plantCount: 1,
      lastUpdated: Date.now()
    });

    this.humidityZones.set('office', {
      id: 'office',
      name: 'Office',
      currentHumidity: 38,
      targetHumidity: 50,
      humidifierDeviceId: null,
      humidifierActive: false,
      plantCount: 2,
      lastUpdated: Date.now()
    });

    this.log('Humidity zones initialized: ' + this.humidityZones.size);
  }

  _initializeRoomMicroclimates() {
    this.roomMicroclimates.set('living_room', {
      room: 'living_room',
      temperature: 22,
      humidity: 45,
      lightLevel: 300,
      windowDirection: 'south',
      draftRisk: false,
      heatingVent: true,
      history: [],
      lastUpdated: Date.now()
    });

    this.roomMicroclimates.set('bedroom', {
      room: 'bedroom',
      temperature: 20,
      humidity: 42,
      lightLevel: 150,
      windowDirection: 'east',
      draftRisk: true,
      heatingVent: true,
      history: [],
      lastUpdated: Date.now()
    });

    this.roomMicroclimates.set('bathroom', {
      room: 'bathroom',
      temperature: 23,
      humidity: 65,
      lightLevel: 80,
      windowDirection: 'north',
      draftRisk: false,
      heatingVent: false,
      history: [],
      lastUpdated: Date.now()
    });

    this.roomMicroclimates.set('kitchen', {
      room: 'kitchen',
      temperature: 22,
      humidity: 50,
      lightLevel: 200,
      windowDirection: 'west',
      draftRisk: false,
      heatingVent: true,
      history: [],
      lastUpdated: Date.now()
    });

    this.roomMicroclimates.set('office', {
      room: 'office',
      temperature: 21,
      humidity: 38,
      lightLevel: 250,
      windowDirection: 'south',
      draftRisk: false,
      heatingVent: true,
      history: [],
      lastUpdated: Date.now()
    });

    this.log('Room microclimates initialized: ' + this.roomMicroclimates.size);
  }

  _initializePropagationTracker() {
    this.propagationTracker.set('prop_001', {
      id: 'prop_001',
      parentSpecies: 'pothos',
      parentInstanceId: 'plant_002',
      method: 'water_propagation',
      startDate: Date.now() - 14 * 86400000,
      status: 'rooting',
      rootLength: 2.5,
      medium: 'water',
      notes: ['Changed water on day 7', 'First roots visible day 10'],
      estimatedTransplantDate: Date.now() + 14 * 86400000
    });

    this.propagationTracker.set('prop_002', {
      id: 'prop_002',
      parentSpecies: 'spider_plant',
      parentInstanceId: 'plant_006',
      method: 'offsets',
      startDate: Date.now() - 7 * 86400000,
      status: 'developing',
      rootLength: 0.5,
      medium: 'soil',
      notes: ['Separated offset and planted in small pot'],
      estimatedTransplantDate: Date.now() + 21 * 86400000
    });

    this.log('Propagation tracker initialized: ' + this.propagationTracker.size + ' active propagations');
  }

  _initializeFertilizationSchedules() {
    for (const [speciesId, species] of this.plantProfiles) {
      for (const instance of species.instances) {
        this.fertilizationSchedules.set(instance.instanceId, {
          instanceId: instance.instanceId,
          speciesId: speciesId,
          nickname: instance.nickname,
          frequencyWeeks: species.fertilizeFrequencyWeeks,
          lastFertilized: instance.lastFertilized,
          winterPause: species.winterPause,
          fertiliserType: 'balanced_liquid',
          npkRatio: '10-10-10',
          dilution: 'half_strength',
          history: []
        });
      }
    }

    this.log('Fertilization schedules initialized: ' + this.fertilizationSchedules.size);
  }

  async _discoverSensors() {
    try {
      const devices = await this.homey.devices.getDevices();
      let discovered = 0;

      for (const [deviceId, device] of Object.entries(devices)) {
        const name = (device.name || '').toLowerCase();
        if (name.includes('soil') || name.includes('plant') || name.includes('moisture') ||
            name.includes('humidity') || name.includes('grow') || name.includes('light_sensor')) {
          this.soilSensors.set(deviceId, {
            deviceId: deviceId,
            name: device.name,
            room: null,
            lastReading: null,
            moisture: null,
            temperature: null,
            light: null
          });
          discovered++;
        }
      }

      this.log('Sensor discovery complete: ' + discovered + ' sensors found');
    } catch (err) {
      this.error('Sensor discovery failed: ' + err.message);
    }
  }

  shouldWater(instanceId) {
    let targetInstance = null;
    let targetSpecies = null;

    for (const [_speciesId, species] of this.plantProfiles) {
      const inst = species.instances.find(i => i.instanceId === instanceId);
      if (inst) {
        targetInstance = inst;
        targetSpecies = species;
        break;
      }
    }

    if (!targetInstance || !targetSpecies) {
      return { shouldWater: false, reason: 'instance_not_found' };
    }

    const daysSinceWatered = (Date.now() - targetInstance.lastWatered) / 86400000;
    const moistureLow = targetInstance.currentMoisture < targetSpecies.optimalMoisture[0];
    const _pastDue = daysSinceWatered >= targetSpecies.waterFrequencyDays;

    const room = this.roomMicroclimates.get(targetInstance.room);
    let tempAdjustment = 1.0;
    if (room) {
      if (room.temperature > 25) tempAdjustment = 1.3;
      else if (room.temperature < 16) tempAdjustment = 0.7;
    }

    const month = new Date().getMonth();
    const isWinter = month >= 10 || month <= 2;
    const seasonAdjustment = isWinter ? 0.7 : 1.0;

    const adjustedFrequency = targetSpecies.waterFrequencyDays / (tempAdjustment * seasonAdjustment);
    const adjustedPastDue = daysSinceWatered >= adjustedFrequency;

    const shouldWaterNow = moistureLow || adjustedPastDue;

    return {
      instanceId: instanceId,
      nickname: targetInstance.nickname,
      shouldWater: shouldWaterNow,
      daysSinceWatered: Math.round(daysSinceWatered * 10) / 10,
      normalFrequencyDays: targetSpecies.waterFrequencyDays,
      adjustedFrequencyDays: Math.round(adjustedFrequency * 10) / 10,
      currentMoisture: targetInstance.currentMoisture,
      optimalMoisture: targetSpecies.optimalMoisture,
      moistureLow: moistureLow,
      isWinter: isWinter,
      tempAdjustment: tempAdjustment,
      reason: moistureLow ? 'moisture_below_optimal' : adjustedPastDue ? 'past_watering_schedule' : 'not_needed_yet'
    };
  }

  waterPlant(instanceId, amountMl) {
    let targetInstance = null;
    let _targetSpecies = null;

    for (const [, species] of this.plantProfiles) {
      const inst = species.instances.find(i => i.instanceId === instanceId);
      if (inst) {
        targetInstance = inst;
        _targetSpecies = species;
        break;
      }
    }

    if (!targetInstance) {
      return { success: false, reason: 'instance_not_found' };
    }

    targetInstance.lastWatered = Date.now();
    targetInstance.currentMoisture = Math.min(100, targetInstance.currentMoisture + (amountMl / (targetInstance.potSizeCm * 2)));

    this.log('Watered ' + targetInstance.nickname + ': ' + amountMl + 'ml, moisture now ' + targetInstance.currentMoisture.toFixed(0) + '%');

    return {
      success: true,
      nickname: targetInstance.nickname,
      amountMl: amountMl,
      newMoisture: Math.round(targetInstance.currentMoisture)
    };
  }

  shouldFertilize(instanceId) {
    const schedule = this.fertilizationSchedules.get(instanceId);
    if (!schedule) return { shouldFertilize: false, reason: 'no_schedule' };

    const month = new Date().getMonth();
    const isWinter = month >= 10 || month <= 2;

    if (schedule.winterPause && isWinter) {
      return { shouldFertilize: false, reason: 'winter_pause', instanceId: instanceId };
    }

    const daysSinceFertilized = (Date.now() - schedule.lastFertilized) / 86400000;
    const dueInDays = (schedule.frequencyWeeks * 7) - daysSinceFertilized;
    const isDue = dueInDays <= 0;

    return {
      instanceId: instanceId,
      nickname: schedule.nickname,
      shouldFertilize: isDue,
      daysSinceLast: Math.round(daysSinceFertilized),
      frequencyWeeks: schedule.frequencyWeeks,
      dueInDays: Math.round(Math.max(0, dueInDays)),
      fertiliserType: schedule.fertiliserType,
      npkRatio: schedule.npkRatio,
      dilution: schedule.dilution,
      isWinter: isWinter,
      winterPause: schedule.winterPause
    };
  }

  fertilize(instanceId, npkRatio) {
    const schedule = this.fertilizationSchedules.get(instanceId);
    if (!schedule) return { success: false, reason: 'no_schedule' };

    const ratio = npkRatio || schedule.npkRatio;
    schedule.lastFertilized = Date.now();

    let _targetInstance = null;
    for (const [, species] of this.plantProfiles) {
      const inst = species.instances.find(i => i.instanceId === instanceId);
      if (inst) {
        _targetInstance = inst;
        inst.lastFertilized = Date.now();
        break;
      }
    }

    schedule.history.push({
      timestamp: Date.now(),
      npkRatio: ratio,
      dilution: schedule.dilution
    });

    if (schedule.history.length > 200) {
      schedule.history = schedule.history.slice(-100);
    }

    this.log('Fertilized ' + schedule.nickname + ' with NPK ' + ratio);
    return { success: true, nickname: schedule.nickname, npkRatio: ratio };
  }

  detectPestRisk(instanceId) {
    let targetInstance = null;
    let _targetSpecies = null;

    for (const [, species] of this.plantProfiles) {
      const inst = species.instances.find(i => i.instanceId === instanceId);
      if (inst) {
        targetInstance = inst;
        _targetSpecies = species;
        break;
      }
    }

    if (!targetInstance) return { risks: [] };

    const room = this.roomMicroclimates.get(targetInstance.room);
    const risks = [];

    for (const [, pest] of this.pestDatabase) {
      let riskScore = 0;

      if (room) {
        if (pest.riskFactors.includes('overwatering') && targetInstance.currentMoisture > 70) riskScore += 30;
        if (pest.riskFactors.includes('high_humidity') && room.humidity > 70) riskScore += 25;
        if (pest.riskFactors.includes('low_humidity') && room.humidity < 35) riskScore += 30;
        if (pest.riskFactors.includes('dry_air') && room.humidity < 40) riskScore += 25;
        if (pest.riskFactors.includes('poor_air_circulation') && !room.draftRisk) riskScore += 15;
        if (pest.riskFactors.includes('warm_conditions') && room.temperature > 25) riskScore += 20;
      }

      if (pest.riskFactors.includes('dusty_leaves')) riskScore += 10;
      if (pest.riskFactors.includes('crowded_plants')) {
        const zone = this.humidityZones.get(targetInstance.room);
        if (zone && zone.plantCount > 3) riskScore += 15;
      }

      if (riskScore > 20) {
        risks.push({
          pestId: pest.id,
          name: pest.name,
          riskScore: Math.min(100, riskScore),
          severity: pest.severity,
          symptoms: pest.symptoms,
          treatment: pest.treatment,
          prevention: pest.riskFactors.map(f => 'Address: ' + f.replace(/_/g, ' '))
        });
      }
    }

    risks.sort((a, b) => b.riskScore - a.riskScore);

    return {
      instanceId: instanceId,
      nickname: targetInstance.nickname,
      room: targetInstance.room,
      risks: risks,
      overallRisk: risks.length > 0 ? (risks[0].riskScore > 50 ? 'high' : 'moderate') : 'low'
    };
  }

  checkRepotting(instanceId) {
    let targetInstance = null;
    let targetSpecies = null;

    for (const [, species] of this.plantProfiles) {
      const inst = species.instances.find(i => i.instanceId === instanceId);
      if (inst) {
        targetInstance = inst;
        targetSpecies = species;
        break;
      }
    }

    if (!targetInstance || !targetSpecies) return null;

    const daysSinceRepotted = (Date.now() - targetInstance.lastRepotted) / 86400000;
    const monthsSinceRepotted = daysSinceRepotted / 30;
    const isDue = monthsSinceRepotted >= targetSpecies.repotIntervalMonths;

    const month = new Date().getMonth();
    const isGoodSeason = month >= 2 && month <= 5;

    return {
      instanceId: instanceId,
      nickname: targetInstance.nickname,
      needsRepotting: isDue,
      monthsSinceLastRepot: Math.round(monthsSinceRepotted),
      intervalMonths: targetSpecies.repotIntervalMonths,
      currentPotSizeCm: targetInstance.potSizeCm,
      suggestedNewPotCm: targetInstance.potSizeCm + 3,
      isGoodSeasonToRepot: isGoodSeason,
      recommendation: isDue
        ? (isGoodSeason ? 'Repot now - ideal season' : 'Repotting needed but wait until spring if possible')
        : 'No repotting needed yet'
    };
  }

  getPlantHealthScore(instanceId) {
    let targetInstance = null;
    let targetSpecies = null;

    for (const [, species] of this.plantProfiles) {
      const inst = species.instances.find(i => i.instanceId === instanceId);
      if (inst) {
        targetInstance = inst;
        targetSpecies = species;
        break;
      }
    }

    if (!targetInstance || !targetSpecies) return null;

    let score = 100;
    const issues = [];

    if (targetInstance.currentMoisture < targetSpecies.optimalMoisture[0]) {
      score -= 15;
      issues.push('Moisture too low: ' + targetInstance.currentMoisture + '% (optimal: ' + targetSpecies.optimalMoisture[0] + '-' + targetSpecies.optimalMoisture[1] + '%)');
    }
    if (targetInstance.currentMoisture > targetSpecies.optimalMoisture[1]) {
      score -= 10;
      issues.push('Moisture too high: ' + targetInstance.currentMoisture + '% (optimal: ' + targetSpecies.optimalMoisture[0] + '-' + targetSpecies.optimalMoisture[1] + '%)');
    }

    const room = this.roomMicroclimates.get(targetInstance.room);
    if (room) {
      if (room.temperature < targetSpecies.optimalTemp[0]) {
        score -= 10;
        issues.push('Temperature too low: ' + room.temperature + '°C (optimal: ' + targetSpecies.optimalTemp[0] + '-' + targetSpecies.optimalTemp[1] + '°C)');
      }
      if (room.temperature > targetSpecies.optimalTemp[1]) {
        score -= 10;
        issues.push('Temperature too high: ' + room.temperature + '°C');
      }
      if (room.humidity < targetSpecies.optimalHumidity[0]) {
        score -= 10;
        issues.push('Humidity too low: ' + room.humidity + '% (optimal: ' + targetSpecies.optimalHumidity[0] + '-' + targetSpecies.optimalHumidity[1] + '%)');
      }
    }

    if (targetInstance.pestIssues && targetInstance.pestIssues.length > 0) {
      score -= targetInstance.pestIssues.length * 15;
      issues.push('Active pest issues: ' + targetInstance.pestIssues.join(', '));
    }

    const fertCheck = this.shouldFertilize(instanceId);
    if (fertCheck && fertCheck.shouldFertilize) {
      score -= 5;
      issues.push('Fertilization overdue by ' + Math.abs(fertCheck.dueInDays) + ' days');
    }

    const repotCheck = this.checkRepotting(instanceId);
    if (repotCheck && repotCheck.needsRepotting) {
      score -= 5;
      issues.push('Repotting needed (' + repotCheck.monthsSinceLastRepot + ' months since last)');
    }

    score = Math.max(0, Math.min(100, score));
    targetInstance.healthScore = score;

    return {
      instanceId: instanceId,
      nickname: targetInstance.nickname,
      species: targetSpecies.commonName,
      healthScore: score,
      grade: score >= 90 ? 'Excellent' : score >= 75 ? 'Good' : score >= 60 ? 'Fair' : score >= 40 ? 'Poor' : 'Critical',
      issues: issues,
      issueCount: issues.length,
      toxicToPets: targetSpecies.toxicToPets,
      airPurifyScore: targetSpecies.airPurifyScore
    };
  }

  addGrowthJournalEntry(instanceId, entry) {
    let targetInstance = null;
    for (const [, species] of this.plantProfiles) {
      const inst = species.instances.find(i => i.instanceId === instanceId);
      if (inst) {
        targetInstance = inst;
        break;
      }
    }

    if (!targetInstance) return { success: false, reason: 'instance_not_found' };

    const journalEntry = {
      instanceId: instanceId,
      nickname: targetInstance.nickname,
      timestamp: Date.now(),
      type: entry.type || 'observation',
      note: entry.note || '',
      measurements: entry.measurements || {},
      photo: entry.photo || null
    };

    this.growthJournal.push(journalEntry);
    targetInstance.growthLog.push(journalEntry);

    if (this.growthJournal.length > 5000) {
      this.growthJournal = this.growthJournal.slice(-2500);
    }

    this.log('Growth journal entry added for ' + targetInstance.nickname);
    return { success: true, entry: journalEntry };
  }

  getSeasonalLightCompensation() {
    const month = new Date().getMonth();
    const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    const daylightHours = 12 + 6 * Math.sin((2 * Math.PI / 365) * (dayOfYear - 80));

    let supplementalHours = 0;
    if (daylightHours < 10) {
      supplementalHours = Math.round((14 - daylightHours) * 10) / 10;
    } else if (daylightHours < 12) {
      supplementalHours = Math.round((12 - daylightHours) * 10) / 10;
    }

    return {
      month: month + 1,
      dayOfYear: dayOfYear,
      estimatedDaylightHours: Math.round(daylightHours * 10) / 10,
      supplementalLightHours: supplementalHours,
      recommendation: supplementalHours > 0
        ? 'Add ' + supplementalHours + ' hours of grow light to compensate for short days'
        : 'Sufficient natural daylight available',
      growLightStartTime: supplementalHours > 0 ? '06:00' : null,
      growLightEndTime: supplementalHours > 0
        ? String(6 + Math.floor(supplementalHours)).padStart(2, '0') + ':' + String(Math.round((supplementalHours % 1) * 60)).padStart(2, '0')
        : null
    };
  }

  getPetSafePlants() {
    const safePlants = [];
    const toxicPlants = [];

    for (const [speciesId, species] of this.plantProfiles) {
      const entry = {
        speciesId: speciesId,
        commonName: species.commonName,
        scientificName: species.name,
        instances: species.instances.map(i => ({ instanceId: i.instanceId, nickname: i.nickname, room: i.room }))
      };

      if (species.toxicToPets) {
        toxicPlants.push(entry);
      } else {
        safePlants.push(entry);
      }
    }

    return { safe: safePlants, toxic: toxicPlants };
  }

  getAirPurificationRating() {
    const rooms = {};
    let totalScore = 0;
    let totalInstances = 0;

    for (const [, species] of this.plantProfiles) {
      for (const instance of species.instances) {
        if (!rooms[instance.room]) rooms[instance.room] = { score: 0, plants: [] };
        rooms[instance.room].score += species.airPurifyScore;
        rooms[instance.room].plants.push({
          nickname: instance.nickname,
          species: species.commonName,
          purifyScore: species.airPurifyScore
        });
        totalScore += species.airPurifyScore;
        totalInstances++;
      }
    }

    return {
      rooms: rooms,
      totalPurificationScore: totalScore,
      averageScore: totalInstances > 0 ? Math.round((totalScore / totalInstances) * 10) / 10 : 0,
      topPurifiers: Array.from(this.plantProfiles.values())
        .filter(s => s.airPurifyScore >= 8)
        .map(s => ({ name: s.commonName, score: s.airPurifyScore }))
        .sort((a, b) => b.score - a.score)
    };
  }

  _startMonitoring() {
    this.monitoringInterval = setInterval(() => {
      this._monitoringCycle();
    }, 600000);

    this.log('Monitoring started: 10-min indoor plant care cycle');
  }

  _startLightCompensation() {
    this.lightCompensationInterval = setInterval(() => {
      this._lightCompensationCycle();
    }, 3600000);

    this.log('Light compensation check: hourly cycle');
  }

  _monitoringCycle() {
    try {
      for (const [, species] of this.plantProfiles) {
        for (const instance of species.instances) {
          const hoursSinceWatered = (Date.now() - instance.lastWatered) / 3600000;
          const moistureLoss = hoursSinceWatered * 0.1;
          instance.currentMoisture = Math.max(0, instance.currentMoisture - moistureLoss * 0.01);

          if (instance.currentMoisture < species.optimalMoisture[0]) {
            this.log('LOW MOISTURE: ' + instance.nickname + ' at ' + instance.currentMoisture.toFixed(0) + '%');
          }

          const healthCheck = this.getPlantHealthScore(instance.instanceId);
          if (healthCheck && healthCheck.healthScore < 50) {
            this.log('LOW HEALTH: ' + instance.nickname + ' score ' + healthCheck.healthScore);
          }
        }
      }

      for (const [zoneId, zone] of this.humidityZones) {
        const microclimate = this.roomMicroclimates.get(zoneId);
        if (microclimate) {
          zone.currentHumidity = microclimate.humidity;
        }

        if (zone.currentHumidity < zone.targetHumidity - 10) {
          zone.humidifierActive = true;
        } else if (zone.currentHumidity >= zone.targetHumidity) {
          zone.humidifierActive = false;
        }
      }

      for (const [, prop] of this.propagationTracker) {
        const daysSinceStart = (Date.now() - prop.startDate) / 86400000;
        if (prop.status === 'rooting' && daysSinceStart > 28) {
          this.log('Propagation ' + prop.id + ' may be ready for transplant (' + Math.round(daysSinceStart) + ' days)');
        }
      }
    } catch (err) {
      this.error('Plant monitoring cycle error: ' + err.message);
    }
  }

  _lightCompensationCycle() {
    try {
      const compensation = this.getSeasonalLightCompensation();
      if (compensation.supplementalLightHours > 0) {
        this.log('Light compensation needed: ' + compensation.supplementalLightHours + 'h supplemental light');
      }
    } catch (err) {
      this.error('Light compensation cycle error: ' + err.message);
    }
  }

  getStatistics() {
    let totalPlants = 0;
    let totalHealthScore = 0;
    let healthScoreCount = 0;
    const speciesSummary = {};

    for (const [speciesId, species] of this.plantProfiles) {
      if (species.instances.length > 0) {
        speciesSummary[speciesId] = {
          commonName: species.commonName,
          instances: species.instances.map(i => ({
            instanceId: i.instanceId,
            nickname: i.nickname,
            room: i.room,
            healthScore: i.healthScore,
            currentMoisture: Math.round(i.currentMoisture),
            toxicToPets: species.toxicToPets
          })),
          instanceCount: species.instances.length,
          lightNeeds: species.lightNeeds,
          airPurifyScore: species.airPurifyScore,
          toxicToPets: species.toxicToPets
        };

        for (const inst of species.instances) {
          totalPlants++;
          totalHealthScore += inst.healthScore;
          healthScoreCount++;
        }
      }
    }

    const zoneSummary = {};
    for (const [zoneId, zone] of this.humidityZones) {
      zoneSummary[zoneId] = {
        name: zone.name,
        currentHumidity: zone.currentHumidity,
        targetHumidity: zone.targetHumidity,
        humidifierActive: zone.humidifierActive,
        plantCount: zone.plantCount
      };
    }

    const lightCompensation = this.getSeasonalLightCompensation();
    const petSafety = this.getPetSafePlants();
    const airPurification = this.getAirPurificationRating();

    return {
      plants: speciesSummary,
      totalPlantInstances: totalPlants,
      speciesInDatabase: this.plantProfiles.size,
      avgHealthScore: healthScoreCount > 0 ? Math.round(totalHealthScore / healthScoreCount) : 0,
      humidityZones: zoneSummary,
      roomMicroclimates: Object.fromEntries(
        Array.from(this.roomMicroclimates.entries()).map(([k, v]) => [k, { temperature: v.temperature, humidity: v.humidity, lightLevel: v.lightLevel }])
      ),
      growLightProfiles: this.growLightProfiles.size,
      activePropagations: this.propagationTracker.size,
      pestDatabaseEntries: this.pestDatabase.size,
      fertilizationSchedules: this.fertilizationSchedules.size,
      soilSensors: this.soilSensors.size,
      growthJournalEntries: this.growthJournal.length,
      lightCompensation: {
        daylightHours: lightCompensation.estimatedDaylightHours,
        supplementalHours: lightCompensation.supplementalLightHours
      },
      petSafety: {
        safePlantCount: petSafety.safe.length,
        toxicPlantCount: petSafety.toxic.length
      },
      airPurification: {
        totalScore: airPurification.totalPurificationScore,
        averageScore: airPurification.averageScore
      },
      uptime: this.initialized ? 'active' : 'inactive'
    };
  }

  log(msg) {
    this.homey.log('[IndoorPlants]', msg);
  }

  error(msg) {
    this.homey.error('[IndoorPlants]', msg);
  }

  destroy() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    if (this.lightCompensationInterval) {
      clearInterval(this.lightCompensationInterval);
      this.lightCompensationInterval = null;
    }
    this.log('Advanced Indoor Plant Care System destroyed');
  }
}

module.exports = AdvancedIndoorPlantCareSystem;
