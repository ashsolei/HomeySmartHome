'use strict';

class GardenPlantCareSystem {
  constructor(homey) {
    this.homey = homey;
    this.plantDatabase = new Map();
    this.gardenPlants = new Map();
    this.gardenZones = new Map();
    this.pestDatabase = new Map();
    this.companionMatrix = {};
    this.soilSensors = new Map();
    this.waterUsage = {};
    this.fertilizationLog = [];
    this.harvestLog = [];
    this.weatherData = null;
    this.monitoringInterval = null;
    this.initialized = false;
  }

  async initialize() {
    try {
      this.log('Initializing Garden Plant Care System...');
      try {
        this._initializePlantDatabase();
        this._initializePestDatabase();
        this._initializeCompanionMatrix();
        this._initializeGardenZones();
        this._initializeDefaultPlants();
        this._initializeWaterUsage();
        await this._discoverSoilSensors();
        this._startMonitoring();
        this.initialized = true;
        this.log('Garden Plant Care System initialized successfully');
      } catch (err) {
        this.error('Failed to initialize Garden Plant Care System: ' + err.message);
        throw err;
      }
    } catch (error) {
      this.homey.error(`[GardenPlantCareSystem] Failed to initialize:`, error.message);
    }
  }

  _initializePlantDatabase() {
    const plants = [
      { id: 'tomato', name: 'Tomato', category: 'vegetable', wateringFrequency: 2, optimalMoisture: [60, 80], optimalTemp: [18, 28], optimalLight: 'full_sun', fertilizeInterval: 14, growingSeason: [4, 5, 6, 7, 8, 9], daysToHarvest: 80, spacing: 60, depth: 1, perennial: false, edible: true, nordicZone: [5, 6, 7] },
      { id: 'rose', name: 'Rose', category: 'flower', wateringFrequency: 3, optimalMoisture: [50, 70], optimalTemp: [15, 25], optimalLight: 'full_sun', fertilizeInterval: 21, growingSeason: [4, 5, 6, 7, 8, 9], daysToHarvest: null, spacing: 90, depth: 5, perennial: true, edible: false, nordicZone: [4, 5, 6, 7] },
      { id: 'basil', name: 'Basil', category: 'herb', wateringFrequency: 1, optimalMoisture: [50, 70], optimalTemp: [20, 30], optimalLight: 'full_sun', fertilizeInterval: 28, growingSeason: [5, 6, 7, 8], daysToHarvest: 45, spacing: 25, depth: 0.5, perennial: false, edible: true, nordicZone: [6, 7] },
      { id: 'lavender', name: 'Lavender', category: 'herb', wateringFrequency: 7, optimalMoisture: [30, 50], optimalTemp: [15, 30], optimalLight: 'full_sun', fertilizeInterval: 60, growingSeason: [5, 6, 7, 8, 9], daysToHarvest: null, spacing: 45, depth: 1, perennial: true, edible: true, nordicZone: [5, 6, 7] },
      { id: 'potato', name: 'Potato', category: 'vegetable', wateringFrequency: 3, optimalMoisture: [60, 80], optimalTemp: [14, 22], optimalLight: 'full_sun', fertilizeInterval: 21, growingSeason: [4, 5, 6, 7, 8], daysToHarvest: 90, spacing: 30, depth: 10, perennial: false, edible: true, nordicZone: [3, 4, 5, 6, 7] },
      { id: 'carrot', name: 'Carrot', category: 'vegetable', wateringFrequency: 3, optimalMoisture: [50, 70], optimalTemp: [12, 24], optimalLight: 'full_sun', fertilizeInterval: 30, growingSeason: [4, 5, 6, 7, 8], daysToHarvest: 75, spacing: 5, depth: 1, perennial: false, edible: true, nordicZone: [3, 4, 5, 6, 7] },
      { id: 'strawberry', name: 'Strawberry', category: 'fruit', wateringFrequency: 2, optimalMoisture: [60, 75], optimalTemp: [15, 26], optimalLight: 'full_sun', fertilizeInterval: 21, growingSeason: [4, 5, 6, 7, 8], daysToHarvest: 60, spacing: 30, depth: 0, perennial: true, edible: true, nordicZone: [3, 4, 5, 6, 7] },
      { id: 'sunflower', name: 'Sunflower', category: 'flower', wateringFrequency: 3, optimalMoisture: [50, 70], optimalTemp: [18, 30], optimalLight: 'full_sun', fertilizeInterval: 21, growingSeason: [5, 6, 7, 8], daysToHarvest: 80, spacing: 45, depth: 2.5, perennial: false, edible: true, nordicZone: [4, 5, 6, 7] },
      { id: 'cucumber', name: 'Cucumber', category: 'vegetable', wateringFrequency: 1, optimalMoisture: [65, 85], optimalTemp: [18, 30], optimalLight: 'full_sun', fertilizeInterval: 14, growingSeason: [5, 6, 7, 8], daysToHarvest: 60, spacing: 60, depth: 2, perennial: false, edible: true, nordicZone: [5, 6, 7] },
      { id: 'pepper', name: 'Pepper', category: 'vegetable', wateringFrequency: 2, optimalMoisture: [55, 75], optimalTemp: [20, 30], optimalLight: 'full_sun', fertilizeInterval: 14, growingSeason: [5, 6, 7, 8, 9], daysToHarvest: 75, spacing: 45, depth: 1, perennial: false, edible: true, nordicZone: [6, 7] },
      { id: 'mint', name: 'Mint', category: 'herb', wateringFrequency: 2, optimalMoisture: [60, 80], optimalTemp: [15, 25], optimalLight: 'partial_shade', fertilizeInterval: 30, growingSeason: [4, 5, 6, 7, 8, 9], daysToHarvest: 30, spacing: 30, depth: 0.5, perennial: true, edible: true, nordicZone: [3, 4, 5, 6, 7] },
      { id: 'oregano', name: 'Oregano', category: 'herb', wateringFrequency: 4, optimalMoisture: [40, 60], optimalTemp: [15, 28], optimalLight: 'full_sun', fertilizeInterval: 45, growingSeason: [4, 5, 6, 7, 8, 9], daysToHarvest: 45, spacing: 25, depth: 0.5, perennial: true, edible: true, nordicZone: [4, 5, 6, 7] },
      { id: 'thyme', name: 'Thyme', category: 'herb', wateringFrequency: 5, optimalMoisture: [30, 50], optimalTemp: [15, 28], optimalLight: 'full_sun', fertilizeInterval: 60, growingSeason: [4, 5, 6, 7, 8, 9], daysToHarvest: 40, spacing: 20, depth: 0.5, perennial: true, edible: true, nordicZone: [3, 4, 5, 6, 7] },
      { id: 'dill', name: 'Dill', category: 'herb', wateringFrequency: 3, optimalMoisture: [50, 70], optimalTemp: [15, 25], optimalLight: 'full_sun', fertilizeInterval: 30, growingSeason: [4, 5, 6, 7, 8], daysToHarvest: 40, spacing: 20, depth: 0.5, perennial: false, edible: true, nordicZone: [3, 4, 5, 6, 7] },
      { id: 'parsley', name: 'Parsley', category: 'herb', wateringFrequency: 3, optimalMoisture: [50, 70], optimalTemp: [12, 22], optimalLight: 'partial_shade', fertilizeInterval: 30, growingSeason: [3, 4, 5, 6, 7, 8, 9], daysToHarvest: 60, spacing: 15, depth: 0.5, perennial: true, edible: true, nordicZone: [3, 4, 5, 6, 7] },
      { id: 'lettuce', name: 'Lettuce', category: 'vegetable', wateringFrequency: 2, optimalMoisture: [60, 80], optimalTemp: [10, 20], optimalLight: 'partial_shade', fertilizeInterval: 21, growingSeason: [3, 4, 5, 6, 7, 8, 9], daysToHarvest: 45, spacing: 25, depth: 0.5, perennial: false, edible: true, nordicZone: [3, 4, 5, 6, 7] },
      { id: 'spinach', name: 'Spinach', category: 'vegetable', wateringFrequency: 2, optimalMoisture: [60, 75], optimalTemp: [8, 20], optimalLight: 'partial_shade', fertilizeInterval: 21, growingSeason: [3, 4, 5, 6, 7, 8, 9, 10], daysToHarvest: 40, spacing: 15, depth: 1, perennial: false, edible: true, nordicZone: [3, 4, 5, 6, 7] },
      { id: 'peas', name: 'Peas', category: 'vegetable', wateringFrequency: 3, optimalMoisture: [55, 75], optimalTemp: [10, 22], optimalLight: 'full_sun', fertilizeInterval: 21, growingSeason: [3, 4, 5, 6, 7], daysToHarvest: 65, spacing: 8, depth: 3, perennial: false, edible: true, nordicZone: [3, 4, 5, 6, 7] },
      { id: 'beans', name: 'Beans', category: 'vegetable', wateringFrequency: 3, optimalMoisture: [55, 75], optimalTemp: [15, 28], optimalLight: 'full_sun', fertilizeInterval: 21, growingSeason: [5, 6, 7, 8], daysToHarvest: 55, spacing: 15, depth: 3, perennial: false, edible: true, nordicZone: [4, 5, 6, 7] },
      { id: 'pumpkin', name: 'Pumpkin', category: 'vegetable', wateringFrequency: 3, optimalMoisture: [60, 80], optimalTemp: [18, 30], optimalLight: 'full_sun', fertilizeInterval: 14, growingSeason: [5, 6, 7, 8, 9], daysToHarvest: 100, spacing: 150, depth: 3, perennial: false, edible: true, nordicZone: [5, 6, 7] },
      { id: 'apple_tree', name: 'Apple Tree', category: 'fruit_tree', wateringFrequency: 7, optimalMoisture: [50, 70], optimalTemp: [10, 25], optimalLight: 'full_sun', fertilizeInterval: 60, growingSeason: [3, 4, 5, 6, 7, 8, 9, 10], daysToHarvest: 180, spacing: 400, depth: 50, perennial: true, edible: true, nordicZone: [3, 4, 5, 6, 7] },
      { id: 'cherry_tree', name: 'Cherry Tree', category: 'fruit_tree', wateringFrequency: 7, optimalMoisture: [50, 70], optimalTemp: [12, 25], optimalLight: 'full_sun', fertilizeInterval: 60, growingSeason: [3, 4, 5, 6, 7, 8], daysToHarvest: 120, spacing: 500, depth: 50, perennial: true, edible: true, nordicZone: [4, 5, 6, 7] },
      { id: 'blueberry', name: 'Blueberry', category: 'fruit', wateringFrequency: 3, optimalMoisture: [55, 75], optimalTemp: [12, 25], optimalLight: 'full_sun', fertilizeInterval: 30, growingSeason: [4, 5, 6, 7, 8], daysToHarvest: 90, spacing: 120, depth: 5, perennial: true, edible: true, nordicZone: [3, 4, 5, 6, 7] },
      { id: 'raspberry', name: 'Raspberry', category: 'fruit', wateringFrequency: 3, optimalMoisture: [55, 75], optimalTemp: [14, 24], optimalLight: 'full_sun', fertilizeInterval: 30, growingSeason: [4, 5, 6, 7, 8], daysToHarvest: 75, spacing: 60, depth: 5, perennial: true, edible: true, nordicZone: [3, 4, 5, 6, 7] },
      { id: 'rhubarb', name: 'Rhubarb', category: 'vegetable', wateringFrequency: 4, optimalMoisture: [50, 70], optimalTemp: [10, 22], optimalLight: 'partial_shade', fertilizeInterval: 30, growingSeason: [3, 4, 5, 6, 7], daysToHarvest: 90, spacing: 90, depth: 5, perennial: true, edible: true, nordicZone: [3, 4, 5, 6, 7] }
    ];

    for (const plant of plants) {
      this.plantDatabase.set(plant.id, plant);
    }

    this.log('Plant database initialized: ' + this.plantDatabase.size + ' species');
  }

  _initializePestDatabase() {
    const pests = [
      { id: 'aphids', name: 'Aphids', type: 'insect', symptoms: ['curled_leaves', 'sticky_residue', 'yellow_spots', 'stunted_growth'], treatment: 'Spray with neem oil or insecticidal soap. Introduce ladybugs.', preventionTips: ['Encourage beneficial insects', 'Avoid over-fertilizing nitrogen'], severity: 'moderate', seasonPeak: [5, 6, 7] },
      { id: 'slugs', name: 'Slugs & Snails', type: 'mollusk', symptoms: ['holes_in_leaves', 'slime_trails', 'seedling_damage', 'night_damage'], treatment: 'Beer traps, copper barriers, iron phosphate bait. Hand pick at dusk.', preventionTips: ['Remove hiding spots', 'Water in morning not evening'], severity: 'moderate', seasonPeak: [4, 5, 6, 7, 8] },
      { id: 'spider_mites', name: 'Spider Mites', type: 'arachnid', symptoms: ['fine_webbing', 'speckled_leaves', 'leaf_drop', 'yellow_dots'], treatment: 'Spray with water to dislodge. Neem oil or miticide. Increase humidity.', preventionTips: ['Mist plants regularly', 'Keep area clean'], severity: 'high', seasonPeak: [6, 7, 8] },
      { id: 'whitefly', name: 'Whitefly', type: 'insect', symptoms: ['white_flying_insects', 'sticky_leaves', 'sooty_mold', 'yellowing'], treatment: 'Yellow sticky traps. Insecticidal soap. Neem oil spray.', preventionTips: ['Inspect new plants', 'Good air circulation'], severity: 'moderate', seasonPeak: [5, 6, 7, 8] },
      { id: 'caterpillars', name: 'Caterpillars', type: 'insect', symptoms: ['large_holes_in_leaves', 'frass_droppings', 'defoliation', 'chewed_edges'], treatment: 'Hand pick. BT (Bacillus thuringiensis) spray. Row covers.', preventionTips: ['Inspect leaves regularly', 'Encourage birds'], severity: 'moderate', seasonPeak: [5, 6, 7, 8] },
      { id: 'fungus_gnats', name: 'Fungus Gnats', type: 'insect', symptoms: ['tiny_flying_gnats', 'root_damage', 'wilting_seedlings', 'larvae_in_soil'], treatment: 'Let soil dry between waterings. Yellow sticky traps. Nematodes.', preventionTips: ['Avoid overwatering', 'Use well-draining soil'], severity: 'low', seasonPeak: [4, 5, 6, 7, 8, 9] },
      { id: 'mealybugs', name: 'Mealybugs', type: 'insect', symptoms: ['white_cottony_masses', 'sticky_residue', 'yellowing', 'stunted_growth'], treatment: 'Alcohol swab. Neem oil. Insecticidal soap. Remove heavily infested parts.', preventionTips: ['Quarantine new plants', 'Inspect regularly'], severity: 'moderate', seasonPeak: [5, 6, 7, 8] },
      { id: 'scale', name: 'Scale Insects', type: 'insect', symptoms: ['bumps_on_stems', 'sticky_residue', 'sooty_mold', 'leaf_drop'], treatment: 'Scrape off manually. Horticultural oil. Systemic insecticide.', preventionTips: ['Regular inspection', 'Prune affected branches'], severity: 'moderate', seasonPeak: [5, 6, 7, 8] },
      { id: 'thrips', name: 'Thrips', type: 'insect', symptoms: ['silvery_streaks', 'distorted_growth', 'black_specks', 'flower_damage'], treatment: 'Blue sticky traps. Spinosad spray. Neem oil.', preventionTips: ['Remove spent flowers', 'Use reflective mulch'], severity: 'moderate', seasonPeak: [5, 6, 7] },
      { id: 'root_rot', name: 'Root Rot', type: 'fungal', symptoms: ['wilting', 'yellow_leaves', 'mushy_roots', 'foul_smell', 'stunted_growth'], treatment: 'Remove affected roots. Improve drainage. Repot in fresh soil. Fungicide.', preventionTips: ['Avoid overwatering', 'Ensure good drainage'], severity: 'high', seasonPeak: [3, 4, 5, 6, 7, 8, 9, 10] },
      { id: 'powdery_mildew', name: 'Powdery Mildew', type: 'fungal', symptoms: ['white_powder_on_leaves', 'distorted_leaves', 'premature_leaf_drop'], treatment: 'Baking soda spray (1tsp per liter). Sulfur fungicide. Remove affected leaves.', preventionTips: ['Good air circulation', 'Avoid overhead watering'], severity: 'moderate', seasonPeak: [6, 7, 8] }
    ];

    for (const pest of pests) {
      this.pestDatabase.set(pest.id, pest);
    }

    this.log('Pest database initialized: ' + this.pestDatabase.size + ' pests');
  }

  _initializeCompanionMatrix() {
    this.companionMatrix = {
      tomato: { basil: 'good', carrot: 'good', parsley: 'good', pepper: 'neutral', mint: 'neutral', cucumber: 'neutral', potato: 'bad', dill: 'bad', beans: 'neutral' },
      basil: { tomato: 'good', pepper: 'good', oregano: 'good', lettuce: 'neutral', cucumber: 'neutral', beans: 'neutral' },
      carrot: { tomato: 'good', peas: 'good', lettuce: 'good', dill: 'bad', parsley: 'neutral', beans: 'good' },
      strawberry: { lettuce: 'good', spinach: 'good', beans: 'good', thyme: 'good', mint: 'neutral' },
      potato: { beans: 'good', peas: 'good', spinach: 'good', tomato: 'bad', cucumber: 'bad', pumpkin: 'bad' },
      cucumber: { beans: 'good', peas: 'good', lettuce: 'good', sunflower: 'good', potato: 'bad', mint: 'neutral' },
      lettuce: { carrot: 'good', strawberry: 'good', cucumber: 'good', spinach: 'good', mint: 'good' },
      rose: { lavender: 'good', thyme: 'good', parsley: 'good', mint: 'neutral' },
      peas: { carrot: 'good', cucumber: 'good', lettuce: 'good', potato: 'good', beans: 'neutral' },
      beans: { cucumber: 'good', potato: 'good', carrot: 'good', strawberry: 'good', peas: 'neutral' },
      pumpkin: { beans: 'good', sunflower: 'neutral', potato: 'bad', cucumber: 'neutral' },
      sunflower: { cucumber: 'good', pumpkin: 'neutral', lettuce: 'good', beans: 'good' },
      mint: { tomato: 'neutral', lettuce: 'good', peas: 'good', parsley: 'neutral' },
      dill: { lettuce: 'good', cucumber: 'good', carrot: 'bad', tomato: 'bad' }
    };

    this.log('Companion planting matrix initialized');
  }

  _initializeGardenZones() {
    this.gardenZones.set('front_yard', {
      id: 'front_yard',
      name: 'Front Yard',
      areaSqM: 40,
      soilType: 'loam',
      sunExposure: 'full_sun',
      irrigationSystem: true,
      irrigationZoneId: 'zone_1',
      plants: [],
      waterUsageLitersTotal: 0,
      lastWatered: null
    });

    this.gardenZones.set('backyard', {
      id: 'backyard',
      name: 'Backyard',
      areaSqM: 80,
      soilType: 'clay_loam',
      sunExposure: 'full_sun',
      irrigationSystem: true,
      irrigationZoneId: 'zone_2',
      plants: [],
      waterUsageLitersTotal: 0,
      lastWatered: null
    });

    this.gardenZones.set('greenhouse', {
      id: 'greenhouse',
      name: 'Greenhouse',
      areaSqM: 15,
      soilType: 'potting_mix',
      sunExposure: 'full_sun',
      irrigationSystem: true,
      irrigationZoneId: 'zone_3',
      heated: true,
      minTempSetting: 12,
      plants: [],
      waterUsageLitersTotal: 0,
      lastWatered: null
    });

    this.gardenZones.set('balcony', {
      id: 'balcony',
      name: 'Balcony',
      areaSqM: 8,
      soilType: 'potting_mix',
      sunExposure: 'partial_shade',
      irrigationSystem: false,
      irrigationZoneId: null,
      plants: [],
      waterUsageLitersTotal: 0,
      lastWatered: null
    });

    this.log('Garden zones initialized: ' + this.gardenZones.size);
  }

  _initializeDefaultPlants() {
    const defaultPlants = [
      { plantId: 'plant_001', speciesId: 'tomato', zone: 'greenhouse', plantedDate: Date.now() - 45 * 86400000, stage: 'vegetative', quantity: 6 },
      { plantId: 'plant_002', speciesId: 'basil', zone: 'greenhouse', plantedDate: Date.now() - 30 * 86400000, stage: 'vegetative', quantity: 4 },
      { plantId: 'plant_003', speciesId: 'rose', zone: 'front_yard', plantedDate: Date.now() - 365 * 86400000, stage: 'flowering', quantity: 3 },
      { plantId: 'plant_004', speciesId: 'strawberry', zone: 'backyard', plantedDate: Date.now() - 90 * 86400000, stage: 'fruiting', quantity: 20 },
      { plantId: 'plant_005', speciesId: 'potato', zone: 'backyard', plantedDate: Date.now() - 40 * 86400000, stage: 'vegetative', quantity: 10 },
      { plantId: 'plant_006', speciesId: 'mint', zone: 'balcony', plantedDate: Date.now() - 60 * 86400000, stage: 'vegetative', quantity: 2 },
      { plantId: 'plant_007', speciesId: 'lavender', zone: 'front_yard', plantedDate: Date.now() - 180 * 86400000, stage: 'flowering', quantity: 5 },
      { plantId: 'plant_008', speciesId: 'cucumber', zone: 'greenhouse', plantedDate: Date.now() - 20 * 86400000, stage: 'seedling', quantity: 4 },
      { plantId: 'plant_009', speciesId: 'apple_tree', zone: 'backyard', plantedDate: Date.now() - 730 * 86400000, stage: 'fruiting', quantity: 1 },
      { plantId: 'plant_010', speciesId: 'blueberry', zone: 'backyard', plantedDate: Date.now() - 365 * 86400000, stage: 'flowering', quantity: 3 }
    ];

    for (const plant of defaultPlants) {
      const species = this.plantDatabase.get(plant.speciesId);
      this.gardenPlants.set(plant.plantId, {
        id: plant.plantId,
        speciesId: plant.speciesId,
        name: species ? species.name : plant.speciesId,
        zone: plant.zone,
        plantedDate: plant.plantedDate,
        stage: plant.stage,
        quantity: plant.quantity,
        lastWatered: Date.now() - Math.random() * 2 * 86400000,
        lastFertilized: Date.now() - Math.random() * 14 * 86400000,
        currentMoisture: 50 + Math.random() * 30,
        healthScore: 70 + Math.floor(Math.random() * 25),
        pestIssues: [],
        notes: [],
        waterUsageLiters: 0,
        growthLog: []
      });

      const zone = this.gardenZones.get(plant.zone);
      if (zone) {
        zone.plants.push(plant.plantId);
      }
    }

    this.log('Default plants added: ' + this.gardenPlants.size);
  }

  _initializeWaterUsage() {
    this.waterUsage = {
      totalLiters: 0,
      dailyHistory: [],
      weeklyHistory: [],
      byZone: {},
      byPlant: {},
      savingsFromRainSkip: 0,
      savingsFromMoistureSkip: 0
    };

    for (const [zoneId] of this.gardenZones) {
      this.waterUsage.byZone[zoneId] = { totalLiters: 0, lastWeekLiters: 0 };
    }
  }

  async _discoverSoilSensors() {
    try {
      const devices = await this.homey.devices.getDevices();
      let discovered = 0;

      for (const [deviceId, device] of Object.entries(devices)) {
        const name = (device.name || '').toLowerCase();
        if (name.includes('soil') || name.includes('moisture') || name.includes('garden') || name.includes('plant')) {
          this.soilSensors.set(deviceId, {
            deviceId: deviceId,
            name: device.name,
            zone: null,
            lastReading: null,
            moisture: null,
            temperature: null
          });
          discovered++;
        }
      }

      this.log('Soil sensor discovery complete: ' + discovered + ' sensors found');
    } catch (err) {
      this.error('Soil sensor discovery failed: ' + err.message);
    }
  }

  waterPlant(plantId, liters) {
    const plant = this.gardenPlants.get(plantId);
    if (!plant) {
      this.error('Plant not found: ' + plantId);
      return { success: false, reason: 'plant_not_found' };
    }

    plant.lastWatered = Date.now();
    plant.currentMoisture = Math.min(100, plant.currentMoisture + liters * 10);
    plant.waterUsageLiters += liters;

    this.waterUsage.totalLiters += liters;
    if (this.waterUsage.byZone[plant.zone]) {
      this.waterUsage.byZone[plant.zone].totalLiters += liters;
    }
    if (!this.waterUsage.byPlant[plantId]) {
      this.waterUsage.byPlant[plantId] = 0;
    }
    this.waterUsage.byPlant[plantId] += liters;

    this.waterUsage.dailyHistory.push({
      timestamp: Date.now(),
      plantId: plantId,
      liters: liters,
      zone: plant.zone
    });
    if (this.waterUsage.dailyHistory.length > 2000) {
      this.waterUsage.dailyHistory = this.waterUsage.dailyHistory.slice(-1000);
    }

    this.log('Watered ' + plant.name + ' (' + plantId + '): ' + liters + 'L, moisture now ' + plant.currentMoisture.toFixed(0) + '%');
    return {
      success: true,
      plantName: plant.name,
      liters: liters,
      newMoisture: Math.round(plant.currentMoisture)
    };
  }

  skipIfRainForecast() {
    if (!this.weatherData) {
      return { skip: false, reason: 'no_weather_data' };
    }

    const rainExpected = this.weatherData.precipitation > 0 ||
      (this.weatherData.forecast && this.weatherData.forecast.some(f => f.precipitation > 2));

    if (rainExpected) {
      this.waterUsage.savingsFromRainSkip += 5;
      this.log('Watering skipped - rain in forecast');
      return { skip: true, reason: 'rain_forecast', savedLiters: 5 };
    }

    return { skip: false, reason: 'no_rain_forecast' };
  }

  adjustForHeat(plantId) {
    const plant = this.gardenPlants.get(plantId);
    if (!plant) return null;

    const species = this.plantDatabase.get(plant.speciesId);
    if (!species) return null;

    const currentTemp = this.weatherData ? this.weatherData.temperature : 20;
    const maxOptimal = species.optimalTemp[1];

    let adjustment = 1.0;
    if (currentTemp > maxOptimal + 5) {
      adjustment = 1.5;
    } else if (currentTemp > maxOptimal) {
      adjustment = 1.25;
    } else if (currentTemp < species.optimalTemp[0]) {
      adjustment = 0.75;
    }

    return {
      plantId: plantId,
      currentTemp: currentTemp,
      optimalRange: species.optimalTemp,
      wateringMultiplier: adjustment,
      recommendation: adjustment > 1
        ? 'Increase watering by ' + ((adjustment - 1) * 100).toFixed(0) + '% due to heat'
        : adjustment < 1
          ? 'Reduce watering by ' + ((1 - adjustment) * 100).toFixed(0) + '% due to cool temps'
          : 'Normal watering'
    };
  }

  getGrowthStage(plantId) {
    const plant = this.gardenPlants.get(plantId);
    if (!plant) return null;

    const stages = ['seed', 'germination', 'seedling', 'vegetative', 'flowering', 'fruiting', 'harvest'];
    const currentIndex = stages.indexOf(plant.stage);
    const species = this.plantDatabase.get(plant.speciesId);
    const daysSincePlanting = (Date.now() - plant.plantedDate) / 86400000;

    let expectedStage = 'vegetative';
    if (species && species.daysToHarvest) {
      const progress = daysSincePlanting / species.daysToHarvest;
      if (progress < 0.05) expectedStage = 'seed';
      else if (progress < 0.1) expectedStage = 'germination';
      else if (progress < 0.25) expectedStage = 'seedling';
      else if (progress < 0.5) expectedStage = 'vegetative';
      else if (progress < 0.7) expectedStage = 'flowering';
      else if (progress < 0.9) expectedStage = 'fruiting';
      else expectedStage = 'harvest';
    }

    return {
      plantId: plantId,
      plantName: plant.name,
      currentStage: plant.stage,
      stageIndex: currentIndex,
      totalStages: stages.length,
      expectedStage: expectedStage,
      daysSincePlanting: Math.round(daysSincePlanting),
      daysToHarvest: species && species.daysToHarvest ? Math.max(0, species.daysToHarvest - Math.round(daysSincePlanting)) : null,
      nextStage: currentIndex < stages.length - 1 ? stages[currentIndex + 1] : null
    };
  }

  advanceStage(plantId) {
    const plant = this.gardenPlants.get(plantId);
    if (!plant) return { success: false, reason: 'plant_not_found' };

    const stages = ['seed', 'germination', 'seedling', 'vegetative', 'flowering', 'fruiting', 'harvest'];
    const currentIndex = stages.indexOf(plant.stage);

    if (currentIndex >= stages.length - 1) {
      return { success: false, reason: 'already_at_final_stage' };
    }

    const previousStage = plant.stage;
    plant.stage = stages[currentIndex + 1];

    plant.growthLog.push({
      timestamp: Date.now(),
      fromStage: previousStage,
      toStage: plant.stage
    });

    this.log(plant.name + ' advanced from ' + previousStage + ' to ' + plant.stage);
    return { success: true, previousStage: previousStage, newStage: plant.stage };
  }

  getCompanionSuggestions(speciesId) {
    const companions = this.companionMatrix[speciesId];
    if (!companions) return { good: [], bad: [], neutral: [] };

    const good = [];
    const bad = [];
    const neutral = [];

    for (const [partner, relation] of Object.entries(companions)) {
      const species = this.plantDatabase.get(partner);
      const entry = { speciesId: partner, name: species ? species.name : partner };
      if (relation === 'good') good.push(entry);
      else if (relation === 'bad') bad.push(entry);
      else neutral.push(entry);
    }

    return { speciesId: speciesId, good: good, bad: bad, neutral: neutral };
  }

  estimateHarvestDate(plantId) {
    const plant = this.gardenPlants.get(plantId);
    if (!plant) return null;

    const species = this.plantDatabase.get(plant.speciesId);
    if (!species || !species.daysToHarvest) {
      return { plantId: plantId, harvestable: false, reason: 'no_harvest_data_or_perennial' };
    }

    const daysSincePlanting = (Date.now() - plant.plantedDate) / 86400000;
    const daysRemaining = Math.max(0, species.daysToHarvest - daysSincePlanting);
    const estimatedDate = new Date(Date.now() + daysRemaining * 86400000);

    return {
      plantId: plantId,
      plantName: plant.name,
      plantedDate: new Date(plant.plantedDate).toISOString().substring(0, 10),
      daysToHarvest: species.daysToHarvest,
      daysSincePlanting: Math.round(daysSincePlanting),
      daysRemaining: Math.round(daysRemaining),
      estimatedHarvestDate: estimatedDate.toISOString().substring(0, 10),
      isReadyToHarvest: daysRemaining <= 0,
      progressPercent: Math.min(100, Math.round((daysSincePlanting / species.daysToHarvest) * 100))
    };
  }

  checkFrostRisk() {
    const currentTemp = this.weatherData ? this.weatherData.temperature : 10;
    const frostRisk = currentTemp < 3;
    const severeFrost = currentTemp < -5;
    const affectedPlants = [];

    if (frostRisk) {
      for (const [plantId, plant] of this.gardenPlants) {
        const species = this.plantDatabase.get(plant.speciesId);
        if (species && species.optimalTemp[0] > currentTemp) {
          const zone = this.gardenZones.get(plant.zone);
          const isProtected = zone && zone.id === 'greenhouse';
          if (!isProtected) {
            affectedPlants.push({
              plantId: plantId,
              name: plant.name,
              zone: plant.zone,
              minTemp: species.optimalTemp[0],
              risk: severeFrost ? 'severe' : 'moderate'
            });
          }
        }
      }
    }

    return {
      frostRisk: frostRisk,
      severeFrost: severeFrost,
      currentTemp: currentTemp,
      affectedPlants: affectedPlants,
      recommendation: frostRisk
        ? 'Cover sensitive plants. Move containers indoors. Run greenhouse heater.'
        : 'No frost risk detected.'
    };
  }

  activateProtection() {
    const frost = this.checkFrostRisk();
    if (!frost.frostRisk) {
      return { activated: false, reason: 'no_frost_risk' };
    }

    const actions = [];

    const greenhouse = this.gardenZones.get('greenhouse');
    if (greenhouse && greenhouse.heated) {
      actions.push('Greenhouse heater activated to maintain ' + greenhouse.minTempSetting + '°C');
    }

    if (frost.affectedPlants.length > 0) {
      actions.push('Alert: ' + frost.affectedPlants.length + ' plants need protection');
      for (const plant of frost.affectedPlants) {
        actions.push('Cover/protect: ' + plant.name + ' in ' + plant.zone);
      }
    }

    this.log('Frost protection activated: ' + actions.length + ' actions');
    return { activated: true, actions: actions, affectedPlants: frost.affectedPlants.length };
  }

  getNordicPlantingCalendar(zone) {
    const nordicZone = zone || 5;
    const calendar = {};
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (const [speciesId, species] of this.plantDatabase) {
      if (species.nordicZone && species.nordicZone.includes(nordicZone)) {
        const sowIndoor = Math.max(0, species.growingSeason[0] - 2);
        const sowOutdoor = species.growingSeason[0];
        const harvestStart = species.daysToHarvest
          ? Math.min(11, sowOutdoor + Math.floor(species.daysToHarvest / 30))
          : null;

        calendar[speciesId] = {
          name: species.name,
          category: species.category,
          sowIndoors: months[sowIndoor],
          sowOutdoors: months[sowOutdoor],
          harvestStart: harvestStart !== null ? months[harvestStart] : 'N/A',
          growingSeason: species.growingSeason.map(m => months[m]),
          perennial: species.perennial
        };
      }
    }

    return { zone: nordicZone, plants: calendar };
  }

  fertilizePlant(plantId, npkRatio) {
    const plant = this.gardenPlants.get(plantId);
    if (!plant) return { success: false, reason: 'plant_not_found' };

    const ratio = npkRatio || '10-10-10';
    plant.lastFertilized = Date.now();

    this.fertilizationLog.push({
      plantId: plantId,
      plantName: plant.name,
      npkRatio: ratio,
      timestamp: Date.now(),
      zone: plant.zone
    });

    if (this.fertilizationLog.length > 1000) {
      this.fertilizationLog = this.fertilizationLog.slice(-500);
    }

    this.log('Fertilized ' + plant.name + ' with NPK ' + ratio);
    return { success: true, plantName: plant.name, npkRatio: ratio };
  }

  getFertilizationRecommendations(plantId) {
    const plant = this.gardenPlants.get(plantId);
    if (!plant) return null;

    const species = this.plantDatabase.get(plant.speciesId);
    if (!species) return null;

    const daysSinceLastFertilized = plant.lastFertilized
      ? (Date.now() - plant.lastFertilized) / 86400000
      : Infinity;

    const needsFertilizer = daysSinceLastFertilized >= species.fertilizeInterval;
    const month = new Date().getMonth();
    const isWinter = month >= 10 || month <= 1;

    let recommendedNPK = '10-10-10';
    if (plant.stage === 'vegetative') recommendedNPK = '20-10-10';
    else if (plant.stage === 'flowering') recommendedNPK = '10-20-10';
    else if (plant.stage === 'fruiting') recommendedNPK = '10-10-20';

    return {
      plantId: plantId,
      plantName: plant.name,
      needsFertilizer: needsFertilizer && !isWinter,
      daysSinceLastFertilized: Math.round(daysSinceLastFertilized),
      fertilizeInterval: species.fertilizeInterval,
      daysUntilNext: Math.max(0, Math.round(species.fertilizeInterval - daysSinceLastFertilized)),
      recommendedNPK: recommendedNPK,
      currentStage: plant.stage,
      isWinterPause: isWinter,
      winterNote: isWinter ? 'No fertilization during winter months (Nov-Feb)' : null
    };
  }

  identifyPest(symptoms) {
    if (!Array.isArray(symptoms) || symptoms.length === 0) {
      return { matches: [] };
    }

    const matches = [];
    for (const [pestId, pest] of this.pestDatabase) {
      const matched = symptoms.filter(s => pest.symptoms.includes(s));
      if (matched.length > 0) {
        matches.push({
          pestId: pestId,
          name: pest.name,
          type: pest.type,
          matchScore: Math.round((matched.length / pest.symptoms.length) * 100),
          matchedSymptoms: matched,
          treatment: pest.treatment,
          severity: pest.severity,
          seasonPeak: pest.seasonPeak
        });
      }
    }

    matches.sort((a, b) => b.matchScore - a.matchScore);
    return { symptomsProvided: symptoms, matches: matches };
  }

  _startMonitoring() {
    this.monitoringInterval = setInterval(() => {
      this._monitoringCycle();
    }, 900000);

    this.log('Monitoring started: 15-min garden check cycle');
  }

  _monitoringCycle() {
    try {
      for (const [_plantId, plant] of this.gardenPlants) {
        const species = this.plantDatabase.get(plant.speciesId);
        if (!species) continue;

        const hoursSinceWatered = (Date.now() - plant.lastWatered) / 3600000;
        const moistureLoss = hoursSinceWatered * 0.5;
        plant.currentMoisture = Math.max(0, plant.currentMoisture - moistureLoss * 0.01);

        if (plant.currentMoisture < species.optimalMoisture[0]) {
          this.log('LOW MOISTURE: ' + plant.name + ' at ' + plant.currentMoisture.toFixed(0) + '% (optimal ' + species.optimalMoisture[0] + '-' + species.optimalMoisture[1] + '%)');
        }

        const hoursSinceFertilized = plant.lastFertilized ? (Date.now() - plant.lastFertilized) / 3600000 : Infinity;
        if (hoursSinceFertilized > species.fertilizeInterval * 24) {
          const month = new Date().getMonth();
          if (month >= 2 && month <= 9) {
            this.log('FERTILIZE DUE: ' + plant.name + ' (' + Math.round(hoursSinceFertilized / 24) + ' days since last)');
          }
        }

        let healthScore = 100;
        if (plant.currentMoisture < species.optimalMoisture[0]) healthScore -= 15;
        if (plant.currentMoisture > species.optimalMoisture[1]) healthScore -= 10;
        if (plant.pestIssues.length > 0) healthScore -= plant.pestIssues.length * 10;
        plant.healthScore = Math.max(0, Math.min(100, healthScore));
      }

      const frostCheck = this.checkFrostRisk();
      if (frostCheck.frostRisk) {
        this.log('FROST RISK: ' + frostCheck.affectedPlants.length + ' plants at risk');
      }
    } catch (err) {
      this.error('Garden monitoring cycle error: ' + err.message);
    }
  }

  setWeatherData(data) {
    this.weatherData = data;
  }

  getStatistics() {
    const plantSummary = {};
    let totalPlants = 0;
    let totalHealthScore = 0;
    const stageDistribution = {};

    for (const [plantId, plant] of this.gardenPlants) {
      const _species = this.plantDatabase.get(plant.speciesId);
      const harvest = this.estimateHarvestDate(plantId);
      plantSummary[plantId] = {
        name: plant.name,
        species: plant.speciesId,
        zone: plant.zone,
        stage: plant.stage,
        healthScore: plant.healthScore,
        moisture: Math.round(plant.currentMoisture),
        daysToHarvest: harvest ? harvest.daysRemaining : null,
        quantity: plant.quantity
      };
      totalPlants += plant.quantity;
      totalHealthScore += plant.healthScore;

      if (!stageDistribution[plant.stage]) stageDistribution[plant.stage] = 0;
      stageDistribution[plant.stage] += 1;
    }

    const zoneSummary = {};
    for (const [zoneId, zone] of this.gardenZones) {
      zoneSummary[zoneId] = {
        name: zone.name,
        areaSqM: zone.areaSqM,
        plantCount: zone.plants.length,
        irrigationSystem: zone.irrigationSystem,
        waterUsageLiters: this.waterUsage.byZone[zoneId] ? this.waterUsage.byZone[zoneId].totalLiters : 0
      };
    }

    const avgHealth = this.gardenPlants.size > 0
      ? Math.round(totalHealthScore / this.gardenPlants.size)
      : 0;

    return {
      plants: plantSummary,
      totalPlantEntries: this.gardenPlants.size,
      totalPlantCount: totalPlants,
      avgHealthScore: avgHealth,
      stageDistribution: stageDistribution,
      zones: zoneSummary,
      waterUsage: {
        totalLiters: Math.round(this.waterUsage.totalLiters * 100) / 100,
        savedFromRainSkip: this.waterUsage.savingsFromRainSkip,
        savedFromMoistureSkip: this.waterUsage.savingsFromMoistureSkip
      },
      frostRisk: this.checkFrostRisk(),
      speciesInDatabase: this.plantDatabase.size,
      pestsInDatabase: this.pestDatabase.size,
      fertilizationLogEntries: this.fertilizationLog.length,
      soilSensors: this.soilSensors.size,
      uptime: this.initialized ? 'active' : 'inactive'
    };
  }

  log(msg) {
    this.homey.log('[GardenCare]', msg);
  }

  error(msg) {
    this.homey.error('[GardenCare]', msg);
  }

  destroy() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.log('Garden Plant Care System destroyed');
  }
}

module.exports = GardenPlantCareSystem;
