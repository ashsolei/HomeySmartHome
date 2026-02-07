'use strict';

class PetCareAutomationSystem {
  constructor(homey) {
    this.homey = homey;
    this.petProfiles = new Map();
    this.breedDatabase = new Map();
    this.feedingSchedules = new Map();
    this.mealLog = [];
    this.vetRecords = new Map();
    this.weightHistory = new Map();
    this.behaviorLog = [];
    this.petDoorSchedules = new Map();
    this.medicationReminders = [];
    this.emergencyContacts = [];
    this.activityAnalytics = {};
    this.petSitterMode = false;
    this.petSitterConfig = null;
    this.monitoringInterval = null;
    this.medicationInterval = null;
    this.initialized = false;
  }

  async initialize() {
    this.log('Initializing Pet Care Automation System...');
    try {
      this._initializeBreedDatabase();
      this._initializeDefaultPets();
      this._initializeFeedingSchedules();
      this._initializeVetRecords();
      this._initializeEmergencyContacts();
      this._initializeActivityAnalytics();
      this._startMonitoring();
      this._startMedicationReminders();
      this.initialized = true;
      this.log('Pet Care Automation System initialized successfully');
    } catch (err) {
      this.error('Failed to initialize Pet Care Automation System: ' + err.message);
      throw err;
    }
  }

  _initializeBreedDatabase() {
    const breeds = [
      { id: 'labrador', name: 'Labrador Retriever', species: 'dog', size: 'large', avgWeight: [25, 36], lifespan: [10, 14], comfortTemp: [15, 24], exerciseNeeds: 'high', groomingNeeds: 'moderate', commonIssues: ['hip_dysplasia', 'obesity', 'ear_infections'], feedingPerDay: 2, dailyCalories: [1400, 1700] },
      { id: 'german_shepherd', name: 'German Shepherd', species: 'dog', size: 'large', avgWeight: [22, 40], lifespan: [9, 13], comfortTemp: [12, 24], exerciseNeeds: 'high', groomingNeeds: 'high', commonIssues: ['hip_dysplasia', 'degenerative_myelopathy', 'bloat'], feedingPerDay: 2, dailyCalories: [1500, 1900] },
      { id: 'golden_retriever', name: 'Golden Retriever', species: 'dog', size: 'large', avgWeight: [25, 34], lifespan: [10, 12], comfortTemp: [14, 24], exerciseNeeds: 'high', groomingNeeds: 'high', commonIssues: ['cancer', 'hip_dysplasia', 'skin_allergies'], feedingPerDay: 2, dailyCalories: [1300, 1700] },
      { id: 'french_bulldog', name: 'French Bulldog', species: 'dog', size: 'small', avgWeight: [8, 14], lifespan: [10, 14], comfortTemp: [18, 26], exerciseNeeds: 'low', groomingNeeds: 'low', commonIssues: ['brachycephalic_syndrome', 'skin_fold_dermatitis', 'spinal_disorders'], feedingPerDay: 2, dailyCalories: [500, 750] },
      { id: 'poodle', name: 'Poodle (Standard)', species: 'dog', size: 'medium', avgWeight: [18, 32], lifespan: [12, 15], comfortTemp: [15, 25], exerciseNeeds: 'moderate', groomingNeeds: 'high', commonIssues: ['progressive_retinal_atrophy', 'hip_dysplasia', 'bloat'], feedingPerDay: 2, dailyCalories: [1000, 1400] },
      { id: 'chihuahua', name: 'Chihuahua', species: 'dog', size: 'tiny', avgWeight: [1.5, 3], lifespan: [12, 20], comfortTemp: [20, 28], exerciseNeeds: 'low', groomingNeeds: 'low', commonIssues: ['patellar_luxation', 'heart_disease', 'hydrocephalus'], feedingPerDay: 3, dailyCalories: [150, 300] },
      { id: 'beagle', name: 'Beagle', species: 'dog', size: 'medium', avgWeight: [9, 11], lifespan: [12, 15], comfortTemp: [15, 25], exerciseNeeds: 'high', groomingNeeds: 'low', commonIssues: ['epilepsy', 'hypothyroidism', 'intervertebral_disc_disease'], feedingPerDay: 2, dailyCalories: [600, 900] },
      { id: 'border_collie', name: 'Border Collie', species: 'dog', size: 'medium', avgWeight: [12, 20], lifespan: [12, 15], comfortTemp: [10, 24], exerciseNeeds: 'very_high', groomingNeeds: 'moderate', commonIssues: ['collie_eye_anomaly', 'epilepsy', 'hip_dysplasia'], feedingPerDay: 2, dailyCalories: [900, 1200] },
      { id: 'persian_cat', name: 'Persian', species: 'cat', size: 'medium', avgWeight: [3.5, 7], lifespan: [12, 17], comfortTemp: [20, 26], exerciseNeeds: 'low', groomingNeeds: 'very_high', commonIssues: ['polycystic_kidney_disease', 'respiratory_issues', 'eye_conditions'], feedingPerDay: 3, dailyCalories: [200, 350] },
      { id: 'maine_coon', name: 'Maine Coon', species: 'cat', size: 'large', avgWeight: [5, 11], lifespan: [12, 15], comfortTemp: [15, 24], exerciseNeeds: 'moderate', groomingNeeds: 'high', commonIssues: ['hypertrophic_cardiomyopathy', 'hip_dysplasia', 'spinal_muscular_atrophy'], feedingPerDay: 2, dailyCalories: [250, 400] },
      { id: 'siamese', name: 'Siamese', species: 'cat', size: 'medium', avgWeight: [3, 5], lifespan: [15, 20], comfortTemp: [20, 27], exerciseNeeds: 'moderate', groomingNeeds: 'low', commonIssues: ['amyloidosis', 'asthma', 'progressive_retinal_atrophy'], feedingPerDay: 2, dailyCalories: [200, 300] },
      { id: 'british_shorthair', name: 'British Shorthair', species: 'cat', size: 'medium', avgWeight: [4, 8], lifespan: [12, 20], comfortTemp: [18, 25], exerciseNeeds: 'low', groomingNeeds: 'moderate', commonIssues: ['hypertrophic_cardiomyopathy', 'obesity', 'dental_issues'], feedingPerDay: 2, dailyCalories: [200, 350] },
      { id: 'ragdoll', name: 'Ragdoll', species: 'cat', size: 'large', avgWeight: [4.5, 9], lifespan: [12, 17], comfortTemp: [18, 26], exerciseNeeds: 'low', groomingNeeds: 'moderate', commonIssues: ['hypertrophic_cardiomyopathy', 'bladder_stones', 'feline_infectious_peritonitis'], feedingPerDay: 2, dailyCalories: [250, 400] },
      { id: 'bengal', name: 'Bengal', species: 'cat', size: 'medium', avgWeight: [3.5, 7], lifespan: [12, 16], comfortTemp: [18, 26], exerciseNeeds: 'high', groomingNeeds: 'low', commonIssues: ['progressive_retinal_atrophy', 'hypertrophic_cardiomyopathy', 'patellar_luxation'], feedingPerDay: 2, dailyCalories: [250, 400] },
      { id: 'rabbit_holland_lop', name: 'Holland Lop Rabbit', species: 'rabbit', size: 'small', avgWeight: [1.5, 2.5], lifespan: [7, 12], comfortTemp: [15, 22], exerciseNeeds: 'moderate', groomingNeeds: 'moderate', commonIssues: ['gi_stasis', 'dental_malocclusion', 'ear_infections'], feedingPerDay: 2, dailyCalories: [100, 200] }
    ];

    for (const breed of breeds) {
      this.breedDatabase.set(breed.id, breed);
    }

    this.log('Breed database initialized: ' + this.breedDatabase.size + ' breeds');
  }

  _initializeDefaultPets() {
    const pets = [
      {
        id: 'pet_001',
        name: 'Max',
        species: 'dog',
        breedId: 'labrador',
        birthDate: Date.now() - 3 * 365 * 86400000,
        weight: 32,
        gender: 'male',
        neutered: true,
        microchipId: 'SE-1234567890',
        allergies: ['chicken'],
        dietaryRestrictions: ['grain_free'],
        personality: 'friendly',
        activityLevel: 'high',
        indoorOutdoor: 'both',
        lastVetVisit: Date.now() - 90 * 86400000
      },
      {
        id: 'pet_002',
        name: 'Luna',
        species: 'cat',
        breedId: 'maine_coon',
        birthDate: Date.now() - 5 * 365 * 86400000,
        weight: 6.5,
        gender: 'female',
        neutered: true,
        microchipId: 'SE-0987654321',
        allergies: [],
        dietaryRestrictions: [],
        personality: 'independent',
        activityLevel: 'moderate',
        indoorOutdoor: 'indoor_only',
        lastVetVisit: Date.now() - 180 * 86400000
      },
      {
        id: 'pet_003',
        name: 'Buddy',
        species: 'dog',
        breedId: 'golden_retriever',
        birthDate: Date.now() - 7 * 365 * 86400000,
        weight: 30,
        gender: 'male',
        neutered: true,
        microchipId: 'SE-1122334455',
        allergies: [],
        dietaryRestrictions: ['low_fat'],
        personality: 'gentle',
        activityLevel: 'moderate',
        indoorOutdoor: 'both',
        lastVetVisit: Date.now() - 60 * 86400000
      }
    ];

    for (const pet of pets) {
      this.petProfiles.set(pet.id, pet);
    }

    this.log('Default pets added: ' + this.petProfiles.size);
  }

  _initializeFeedingSchedules() {
    for (const [petId, pet] of this.petProfiles) {
      const breed = this.breedDatabase.get(pet.breedId);
      if (!breed) continue;

      const meals = [];
      if (breed.feedingPerDay >= 2) {
        meals.push({ time: '07:30', type: 'morning', portionGrams: 0, completed: false });
        meals.push({ time: '18:00', type: 'evening', portionGrams: 0, completed: false });
      }
      if (breed.feedingPerDay >= 3) {
        meals.push({ time: '12:30', type: 'midday', portionGrams: 0, completed: false });
      }

      for (const meal of meals) {
        meal.portionGrams = this.calculatePortion(petId, meal.type);
      }

      this.feedingSchedules.set(petId, {
        petId: petId,
        petName: pet.name,
        meals: meals,
        autoFeeder: false,
        feedingType: pet.species === 'dog' ? 'dry_kibble' : 'wet_food',
        specialDiet: pet.dietaryRestrictions.length > 0 ? pet.dietaryRestrictions.join(', ') : 'none',
        treatsAllowed: 3,
        treatsGivenToday: 0,
        lastFed: null,
        dailyCalorieTarget: breed.dailyCalories ? (breed.dailyCalories[0] + breed.dailyCalories[1]) / 2 : 500
      });
    }

    this.log('Feeding schedules initialized: ' + this.feedingSchedules.size);
  }

  calculatePortion(petId, mealType) {
    const pet = this.petProfiles.get(petId);
    if (!pet) return 0;

    const breed = this.breedDatabase.get(pet.breedId);
    if (!breed) return 100;

    const avgCalories = breed.dailyCalories
      ? (breed.dailyCalories[0] + breed.dailyCalories[1]) / 2
      : 500;

    const caloriesPerGram = pet.species === 'dog' ? 3.5 : 4.0;
    const totalGrams = avgCalories / caloriesPerGram;
    let portionGrams = totalGrams / breed.feedingPerDay;

    const ageYears = (Date.now() - pet.birthDate) / (365 * 86400000);
    if (ageYears < 1) {
      portionGrams *= 1.3;
    } else if (ageYears > 7 && pet.species === 'dog') {
      portionGrams *= 0.85;
    } else if (ageYears > 10 && pet.species === 'cat') {
      portionGrams *= 0.9;
    }

    if (pet.activityLevel === 'high' || pet.activityLevel === 'very_high') {
      portionGrams *= 1.15;
    } else if (pet.activityLevel === 'low') {
      portionGrams *= 0.85;
    }

    if (breed.avgWeight) {
      const idealWeight = (breed.avgWeight[0] + breed.avgWeight[1]) / 2;
      if (pet.weight > idealWeight * 1.1) {
        portionGrams *= 0.9;
      } else if (pet.weight < idealWeight * 0.9) {
        portionGrams *= 1.1;
      }
    }

    return Math.round(portionGrams);
  }

  trackMeal(petId, mealType, portionGrams, notes) {
    const pet = this.petProfiles.get(petId);
    if (!pet) return { success: false, reason: 'pet_not_found' };

    const schedule = this.feedingSchedules.get(petId);
    if (schedule) {
      const meal = schedule.meals.find(m => m.type === mealType);
      if (meal) {
        meal.completed = true;
      }
      schedule.lastFed = Date.now();
    }

    const entry = {
      petId: petId,
      petName: pet.name,
      mealType: mealType,
      portionGrams: portionGrams,
      timestamp: Date.now(),
      notes: notes || null,
      caloriesEstimate: Math.round(portionGrams * (pet.species === 'dog' ? 3.5 : 4.0))
    };

    this.mealLog.push(entry);
    if (this.mealLog.length > 5000) {
      this.mealLog = this.mealLog.slice(-2500);
    }

    this.log('Meal tracked: ' + pet.name + ' - ' + mealType + ' (' + portionGrams + 'g)');
    return { success: true, entry: entry };
  }

  checkAllergens(petId, ingredients) {
    const pet = this.petProfiles.get(petId);
    if (!pet) return { safe: false, reason: 'pet_not_found' };

    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      return { safe: true, allergens: [], warnings: [] };
    }

    const allergenMatches = [];
    const warnings = [];

    for (const ingredient of ingredients) {
      const lower = ingredient.toLowerCase();
      for (const allergy of pet.allergies) {
        if (lower.includes(allergy.toLowerCase())) {
          allergenMatches.push({ ingredient: ingredient, allergen: allergy });
        }
      }

      if (pet.species === 'dog') {
        const toxicForDogs = ['chocolate', 'grape', 'raisin', 'onion', 'garlic', 'xylitol', 'avocado', 'macadamia'];
        for (const toxic of toxicForDogs) {
          if (lower.includes(toxic)) {
            warnings.push({ ingredient: ingredient, reason: toxic + ' is toxic to dogs', severity: 'critical' });
          }
        }
      } else if (pet.species === 'cat') {
        const toxicForCats = ['chocolate', 'onion', 'garlic', 'grape', 'raisin', 'lily', 'caffeine', 'alcohol'];
        for (const toxic of toxicForCats) {
          if (lower.includes(toxic)) {
            warnings.push({ ingredient: ingredient, reason: toxic + ' is toxic to cats', severity: 'critical' });
          }
        }
      }
    }

    return {
      petName: pet.name,
      safe: allergenMatches.length === 0 && warnings.length === 0,
      allergens: allergenMatches,
      warnings: warnings
    };
  }

  _initializeVetRecords() {
    this.vetRecords.set('pet_001', {
      petId: 'pet_001',
      vaccinations: [
        { name: 'Rabies', date: Date.now() - 180 * 86400000, nextDue: Date.now() + 185 * 86400000 },
        { name: 'DHPP', date: Date.now() - 300 * 86400000, nextDue: Date.now() + 65 * 86400000 },
        { name: 'Bordetella', date: Date.now() - 150 * 86400000, nextDue: Date.now() + 215 * 86400000 }
      ],
      medications: [
        { name: 'Heartgard', dosage: '1 chewable', frequency: 'monthly', nextDue: Date.now() + 15 * 86400000 }
      ],
      appointments: [
        { type: 'checkup', date: Date.now() + 90 * 86400000, vet: 'Dr. Lindström', clinic: 'Stockholm Djurklinik', notes: 'Annual wellness check' }
      ],
      conditions: ['mild_hip_dysplasia'],
      surgeries: [],
      labResults: []
    });

    this.vetRecords.set('pet_002', {
      petId: 'pet_002',
      vaccinations: [
        { name: 'FVRCP', date: Date.now() - 250 * 86400000, nextDue: Date.now() + 115 * 86400000 },
        { name: 'Rabies', date: Date.now() - 200 * 86400000, nextDue: Date.now() + 165 * 86400000 }
      ],
      medications: [],
      appointments: [
        { type: 'dental', date: Date.now() + 60 * 86400000, vet: 'Dr. Eriksson', clinic: 'Stockholm Djurklinik', notes: 'Dental cleaning and check' }
      ],
      conditions: [],
      surgeries: [
        { name: 'Spay', date: Date.now() - 4 * 365 * 86400000, vet: 'Dr. Eriksson', notes: 'Routine procedure, no complications' }
      ],
      labResults: []
    });

    this.vetRecords.set('pet_003', {
      petId: 'pet_003',
      vaccinations: [
        { name: 'Rabies', date: Date.now() - 100 * 86400000, nextDue: Date.now() + 265 * 86400000 },
        { name: 'DHPP', date: Date.now() - 100 * 86400000, nextDue: Date.now() + 265 * 86400000 },
        { name: 'Leptospirosis', date: Date.now() - 100 * 86400000, nextDue: Date.now() + 265 * 86400000 }
      ],
      medications: [
        { name: 'Joint Supplement', dosage: '2 tablets', frequency: 'daily', nextDue: Date.now() },
        { name: 'NexGard', dosage: '1 chewable', frequency: 'monthly', nextDue: Date.now() + 20 * 86400000 }
      ],
      appointments: [],
      conditions: ['arthritis', 'mild_obesity'],
      surgeries: [],
      labResults: [
        { type: 'blood_panel', date: Date.now() - 60 * 86400000, results: 'Within normal ranges, slightly elevated lipids', vet: 'Dr. Lindström' }
      ]
    });

    this.log('Vet records initialized: ' + this.vetRecords.size + ' pets');
  }

  trackWeight(petId, weightKg) {
    const pet = this.petProfiles.get(petId);
    if (!pet) return { success: false, reason: 'pet_not_found' };

    const previousWeight = pet.weight;
    pet.weight = weightKg;

    if (!this.weightHistory.has(petId)) {
      this.weightHistory.set(petId, []);
    }

    const history = this.weightHistory.get(petId);
    history.push({
      weight: weightKg,
      timestamp: Date.now(),
      change: weightKg - previousWeight
    });

    if (history.length > 500) {
      this.weightHistory.set(petId, history.slice(-250));
    }

    const breed = this.breedDatabase.get(pet.breedId);
    let trend = 'stable';
    let alert = null;

    if (history.length >= 3) {
      const recent = history.slice(-3);
      const avgChange = recent.reduce((sum, e) => sum + e.change, 0) / recent.length;
      if (avgChange > 0.3) trend = 'gaining';
      else if (avgChange < -0.3) trend = 'losing';
    }

    if (breed && breed.avgWeight) {
      const idealMax = breed.avgWeight[1];
      const idealMin = breed.avgWeight[0];
      if (weightKg > idealMax * 1.15) {
        alert = { type: 'overweight', message: pet.name + ' is significantly above ideal weight (' + idealMin + '-' + idealMax + ' kg)' };
      } else if (weightKg < idealMin * 0.85) {
        alert = { type: 'underweight', message: pet.name + ' is significantly below ideal weight (' + idealMin + '-' + idealMax + ' kg)' };
      }
    }

    this.log('Weight tracked: ' + pet.name + ' = ' + weightKg + ' kg (trend: ' + trend + ')');

    return {
      success: true,
      petName: pet.name,
      currentWeight: weightKg,
      previousWeight: previousWeight,
      change: Math.round((weightKg - previousWeight) * 100) / 100,
      trend: trend,
      alert: alert,
      historyEntries: history.length
    };
  }

  detectBehaviorAnomaly(petId, behavior) {
    const pet = this.petProfiles.get(petId);
    if (!pet) return null;

    const entry = {
      petId: petId,
      petName: pet.name,
      behavior: behavior,
      timestamp: Date.now()
    };

    this.behaviorLog.push(entry);
    if (this.behaviorLog.length > 5000) {
      this.behaviorLog = this.behaviorLog.slice(-2500);
    }

    const anomalies = [];
    const recentBehaviors = this.behaviorLog
      .filter(b => b.petId === petId && Date.now() - b.timestamp < 7 * 86400000);

    const behaviorCounts = {};
    for (const b of recentBehaviors) {
      if (!behaviorCounts[b.behavior]) behaviorCounts[b.behavior] = 0;
      behaviorCounts[b.behavior]++;
    }

    const concerningBehaviors = {
      excessive_scratching: { threshold: 5, concern: 'Possible skin issues or allergies' },
      vomiting: { threshold: 3, concern: 'May indicate illness - consult vet' },
      lethargy: { threshold: 4, concern: 'Reduced activity may indicate health issue' },
      excessive_drinking: { threshold: 3, concern: 'May indicate kidney or diabetes issues' },
      loss_of_appetite: { threshold: 3, concern: 'Persistent loss of appetite needs vet attention' },
      aggression: { threshold: 2, concern: 'Unusual aggression may indicate pain' },
      hiding: { threshold: 4, concern: 'Hiding behavior in cats may indicate stress or illness' },
      pacing: { threshold: 5, concern: 'Pacing may indicate anxiety or pain' },
      limping: { threshold: 1, concern: 'Limping needs immediate vet check' },
      excessive_barking: { threshold: 7, concern: 'May indicate anxiety or discomfort' }
    };

    for (const [beh, config] of Object.entries(concerningBehaviors)) {
      if (behaviorCounts[beh] && behaviorCounts[beh] >= config.threshold) {
        anomalies.push({
          behavior: beh,
          occurrences: behaviorCounts[beh],
          threshold: config.threshold,
          concern: config.concern,
          severity: behaviorCounts[beh] >= config.threshold * 2 ? 'high' : 'moderate'
        });
      }
    }

    return {
      petId: petId,
      petName: pet.name,
      loggedBehavior: behavior,
      anomaliesDetected: anomalies.length > 0,
      anomalies: anomalies,
      recentBehaviorCount: recentBehaviors.length
    };
  }

  getPetDoorSchedule(petId) {
    const pet = this.petProfiles.get(petId);
    if (!pet) return null;

    if (!this.petDoorSchedules.has(petId)) {
      const isCat = pet.species === 'cat';
      this.petDoorSchedules.set(petId, {
        petId: petId,
        petName: pet.name,
        enabled: pet.indoorOutdoor !== 'indoor_only',
        schedule: {
          weekday: { unlockTime: '06:00', lockTime: isCat ? '21:00' : '22:00' },
          weekend: { unlockTime: '07:00', lockTime: isCat ? '21:00' : '22:30' }
        },
        curfew: {
          enabled: true,
          winterLockTime: isCat ? '16:30' : '20:00',
          summerLockTime: isCat ? '22:00' : '23:00'
        },
        useCount: 0,
        lastUsed: null,
        lockOverride: false,
        direction: 'bidirectional'
      });
    }

    return this.petDoorSchedules.get(petId);
  }

  setPetDoorCurfew(petId, lockTime) {
    const schedule = this.getPetDoorSchedule(petId);
    if (!schedule) return { success: false, reason: 'pet_not_found' };

    schedule.curfew.winterLockTime = lockTime;
    schedule.curfew.summerLockTime = lockTime;

    this.log('Pet door curfew set for ' + schedule.petName + ': lock at ' + lockTime);
    return { success: true, petName: schedule.petName, lockTime: lockTime };
  }

  checkDoorAccess(petId) {
    const schedule = this.getPetDoorSchedule(petId);
    if (!schedule || !schedule.enabled) {
      return { allowed: false, reason: 'door_disabled' };
    }

    if (schedule.lockOverride) {
      return { allowed: false, reason: 'manual_lock_override' };
    }

    const now = new Date();
    const dayOfWeek = now.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const currentTime = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    const daySchedule = isWeekend ? schedule.schedule.weekend : schedule.schedule.weekday;

    const month = now.getMonth();
    const isWinter = month >= 10 || month <= 2;
    const curfewTime = isWinter ? schedule.curfew.winterLockTime : schedule.curfew.summerLockTime;

    const effectiveLockTime = schedule.curfew.enabled
      ? (curfewTime < daySchedule.lockTime ? curfewTime : daySchedule.lockTime)
      : daySchedule.lockTime;

    const isAllowed = currentTime >= daySchedule.unlockTime && currentTime < effectiveLockTime;

    return {
      petId: petId,
      petName: schedule.petName,
      allowed: isAllowed,
      currentTime: currentTime,
      unlockTime: daySchedule.unlockTime,
      lockTime: effectiveLockTime,
      isWeekend: isWeekend,
      curfewApplied: schedule.curfew.enabled
    };
  }

  getComfortTemperature(petId) {
    const pet = this.petProfiles.get(petId);
    if (!pet) return null;

    const breed = this.breedDatabase.get(pet.breedId);
    if (!breed) return null;

    let tempRange = [...breed.comfortTemp];

    const ageYears = (Date.now() - pet.birthDate) / (365 * 86400000);
    if (ageYears < 1) {
      tempRange[0] += 2;
      tempRange[1] -= 1;
    } else if (ageYears > 8) {
      tempRange[0] += 2;
    }

    return {
      petId: petId,
      petName: pet.name,
      breed: breed.name,
      comfortRange: tempRange,
      idealTemp: Math.round((tempRange[0] + tempRange[1]) / 2),
      ageAdjusted: true,
      ageYears: Math.round(ageYears * 10) / 10
    };
  }

  getOptimalHomeTemp() {
    const ranges = [];

    for (const [petId] of this.petProfiles) {
      const comfort = this.getComfortTemperature(petId);
      if (comfort) {
        ranges.push(comfort);
      }
    }

    if (ranges.length === 0) return { temp: 21, reason: 'no_pet_data' };

    let overlapMin = Math.max(...ranges.map(r => r.comfortRange[0]));
    let overlapMax = Math.min(...ranges.map(r => r.comfortRange[1]));

    if (overlapMin > overlapMax) {
      const allMidpoints = ranges.map(r => (r.comfortRange[0] + r.comfortRange[1]) / 2);
      const avgMidpoint = allMidpoints.reduce((a, b) => a + b, 0) / allMidpoints.length;
      return {
        temp: Math.round(avgMidpoint),
        ranges: ranges,
        overlap: null,
        note: 'No perfect overlap - using average of comfort midpoints'
      };
    }

    return {
      temp: Math.round((overlapMin + overlapMax) / 2),
      ranges: ranges,
      overlap: [overlapMin, overlapMax]
    };
  }

  enablePetSitterMode(config) {
    this.petSitterMode = true;
    this.petSitterConfig = {
      sitterName: config.sitterName || 'Pet Sitter',
      sitterPhone: config.sitterPhone || null,
      startDate: config.startDate || Date.now(),
      endDate: config.endDate || Date.now() + 7 * 86400000,
      accessCode: config.accessCode || Math.floor(1000 + Math.random() * 9000).toString(),
      notifications: config.notifications || true,
      cameraAccess: config.cameraAccess || false,
      feedingInstructions: {},
      medicationInstructions: {},
      emergencyInstructions: 'Call emergency contacts in order listed. Nearest 24h vet: Stockholm Djurakuten, +46 8 123 4567'
    };

    for (const [petId, schedule] of this.feedingSchedules) {
      const pet = this.petProfiles.get(petId);
      this.petSitterConfig.feedingInstructions[petId] = {
        petName: pet ? pet.name : petId,
        meals: schedule.meals.map(m => ({
          time: m.time,
          type: m.type,
          portionGrams: m.portionGrams,
          foodType: schedule.feedingType
        })),
        specialDiet: schedule.specialDiet,
        treatsAllowed: schedule.treatsAllowed,
        allergies: pet ? pet.allergies : []
      };
    }

    for (const [petId, records] of this.vetRecords) {
      if (records.medications && records.medications.length > 0) {
        this.petSitterConfig.medicationInstructions[petId] = {
          petName: this.petProfiles.get(petId) ? this.petProfiles.get(petId).name : petId,
          medications: records.medications
        };
      }
    }

    this.log('Pet sitter mode enabled for ' + this.petSitterConfig.sitterName);

    return {
      enabled: true,
      sitterName: this.petSitterConfig.sitterName,
      accessCode: this.petSitterConfig.accessCode,
      startDate: new Date(this.petSitterConfig.startDate).toISOString().substring(0, 10),
      endDate: new Date(this.petSitterConfig.endDate).toISOString().substring(0, 10),
      petsInCare: this.petProfiles.size
    };
  }

  disablePetSitterMode() {
    this.petSitterMode = false;
    this.petSitterConfig = null;
    this.log('Pet sitter mode disabled');
    return { enabled: false };
  }

  _initializeEmergencyContacts() {
    this.emergencyContacts = [
      { name: 'Stockholm Djurakuten', type: '24h_emergency_vet', phone: '+46-8-123-4567', address: 'Storgatan 10, Stockholm', available: '24/7' },
      { name: 'Dr. Lindström', type: 'primary_vet', phone: '+46-8-234-5678', address: 'Veterinärgatan 5, Stockholm', available: 'Mon-Fri 08:00-17:00' },
      { name: 'Dr. Eriksson', type: 'vet_specialist', phone: '+46-8-345-6789', address: 'Djurvägen 12, Stockholm', available: 'Mon-Fri 09:00-16:00' },
      { name: 'Swedish Poison Control (Animals)', type: 'poison_control', phone: '+46-10-456-7890', address: null, available: '24/7' }
    ];

    this.log('Emergency contacts initialized: ' + this.emergencyContacts.length);
  }

  getEmergencyContacts() {
    return {
      contacts: this.emergencyContacts,
      nearestEmergencyVet: this.emergencyContacts.find(c => c.type === '24h_emergency_vet') || null
    };
  }

  _initializeActivityAnalytics() {
    this.activityAnalytics = {};

    for (const [petId, pet] of this.petProfiles) {
      this.activityAnalytics[petId] = {
        petName: pet.name,
        dailySteps: pet.species === 'dog' ? 5000 + Math.floor(Math.random() * 10000) : 500 + Math.floor(Math.random() * 3000),
        dailyActiveMinutes: pet.species === 'dog' ? 60 + Math.floor(Math.random() * 120) : 30 + Math.floor(Math.random() * 60),
        dailyRestHours: pet.species === 'dog' ? 12 + Math.random() * 4 : 14 + Math.random() * 4,
        lastWalk: pet.species === 'dog' ? Date.now() - Math.random() * 8 * 3600000 : null,
        walkHistory: [],
        playTimeMinutes: 0,
        outdoorTimeMinutes: pet.indoorOutdoor === 'indoor_only' ? 0 : 60 + Math.floor(Math.random() * 120)
      };
    }

    this.log('Activity analytics initialized');
  }

  logWalk(petId, durationMinutes, distanceKm) {
    const pet = this.petProfiles.get(petId);
    if (!pet || pet.species !== 'dog') return { success: false, reason: 'not_a_dog_or_not_found' };

    const analytics = this.activityAnalytics[petId];
    if (!analytics) return { success: false, reason: 'no_analytics' };

    const walk = {
      timestamp: Date.now(),
      durationMinutes: durationMinutes,
      distanceKm: distanceKm,
      caloriesBurned: Math.round(durationMinutes * (pet.weight * 0.5))
    };

    analytics.walkHistory.push(walk);
    if (analytics.walkHistory.length > 500) {
      analytics.walkHistory = analytics.walkHistory.slice(-250);
    }
    analytics.lastWalk = Date.now();
    analytics.dailyActiveMinutes += durationMinutes;

    this.log('Walk logged: ' + pet.name + ' - ' + durationMinutes + ' min, ' + distanceKm + ' km');
    return { success: true, walk: walk };
  }

  getUpcomingMedications() {
    const upcoming = [];

    for (const [petId, records] of this.vetRecords) {
      const pet = this.petProfiles.get(petId);
      if (!records.medications) continue;

      for (const med of records.medications) {
        if (med.nextDue && med.nextDue <= Date.now() + 7 * 86400000) {
          upcoming.push({
            petId: petId,
            petName: pet ? pet.name : petId,
            medication: med.name,
            dosage: med.dosage,
            frequency: med.frequency,
            dueDate: new Date(med.nextDue).toISOString().substring(0, 10),
            overdue: med.nextDue < Date.now()
          });
        }
      }
    }

    upcoming.sort((a, b) => {
      const dateA = new Date(a.dueDate).getTime();
      const dateB = new Date(b.dueDate).getTime();
      return dateA - dateB;
    });

    return { medications: upcoming, count: upcoming.length };
  }

  getUpcomingVaccinations() {
    const upcoming = [];

    for (const [petId, records] of this.vetRecords) {
      const pet = this.petProfiles.get(petId);
      if (!records.vaccinations) continue;

      for (const vacc of records.vaccinations) {
        if (vacc.nextDue && vacc.nextDue <= Date.now() + 60 * 86400000) {
          upcoming.push({
            petId: petId,
            petName: pet ? pet.name : petId,
            vaccine: vacc.name,
            lastGiven: new Date(vacc.date).toISOString().substring(0, 10),
            dueDate: new Date(vacc.nextDue).toISOString().substring(0, 10),
            overdue: vacc.nextDue < Date.now()
          });
        }
      }
    }

    upcoming.sort((a, b) => {
      const dateA = new Date(a.dueDate).getTime();
      const dateB = new Date(b.dueDate).getTime();
      return dateA - dateB;
    });

    return { vaccinations: upcoming, count: upcoming.length };
  }

  _startMonitoring() {
    this.monitoringInterval = setInterval(() => {
      this._monitoringCycle();
    }, 600000);

    this.log('Monitoring started: 10-min pet care cycle');
  }

  _startMedicationReminders() {
    this.medicationInterval = setInterval(() => {
      this._checkMedications();
    }, 3600000);

    this.log('Medication reminders started: hourly check');
  }

  _monitoringCycle() {
    try {
      for (const [petId, pet] of this.petProfiles) {
        const schedule = this.feedingSchedules.get(petId);
        if (schedule) {
          const now = new Date();
          const currentTime = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

          for (const meal of schedule.meals) {
            if (!meal.completed && currentTime >= meal.time) {
              const mealMinutes = parseInt(meal.time.split(':')[0]) * 60 + parseInt(meal.time.split(':')[1]);
              const currentMinutes = now.getHours() * 60 + now.getMinutes();
              if (currentMinutes - mealMinutes > 30 && currentMinutes - mealMinutes < 40) {
                this.log('FEEDING REMINDER: ' + pet.name + ' ' + meal.type + ' meal is overdue');
              }
            }
          }
        }

        const doorAccess = this.checkDoorAccess(petId);
        if (doorAccess && !doorAccess.allowed && pet.indoorOutdoor === 'both') {
          const doorSchedule = this.petDoorSchedules.get(petId);
          if (doorSchedule) {
            doorSchedule.useCount = doorSchedule.useCount || 0;
          }
        }
      }

      if (this.petSitterMode && this.petSitterConfig) {
        if (Date.now() > this.petSitterConfig.endDate) {
          this.log('Pet sitter period ended - disabling pet sitter mode');
          this.disablePetSitterMode();
        }
      }

      for (const [petId, analytics] of Object.entries(this.activityAnalytics)) {
        const pet = this.petProfiles.get(petId);
        if (pet && pet.species === 'dog' && analytics.lastWalk) {
          const hoursSinceWalk = (Date.now() - analytics.lastWalk) / 3600000;
          if (hoursSinceWalk > 8) {
            this.log('WALK REMINDER: ' + pet.name + ' hasn\'t been walked in ' + Math.round(hoursSinceWalk) + ' hours');
          }
        }
      }
    } catch (err) {
      this.error('Pet monitoring cycle error: ' + err.message);
    }
  }

  _checkMedications() {
    try {
      const upcoming = this.getUpcomingMedications();
      for (const med of upcoming.medications) {
        if (med.overdue) {
          this.log('MEDICATION OVERDUE: ' + med.petName + ' - ' + med.medication + ' (' + med.dosage + ')');
        } else {
          const dueDate = new Date(med.dueDate);
          const daysUntil = Math.round((dueDate.getTime() - Date.now()) / 86400000);
          if (daysUntil <= 1) {
            this.log('MEDICATION DUE SOON: ' + med.petName + ' - ' + med.medication + ' in ' + daysUntil + ' day(s)');
          }
        }
      }
    } catch (err) {
      this.error('Medication check error: ' + err.message);
    }
  }

  getStatistics() {
    const petSummary = {};
    for (const [petId, pet] of this.petProfiles) {
      const breed = this.breedDatabase.get(pet.breedId);
      const schedule = this.feedingSchedules.get(petId);
      const vetRecord = this.vetRecords.get(petId);
      const analytics = this.activityAnalytics[petId];
      const comfort = this.getComfortTemperature(petId);
      const ageYears = Math.round(((Date.now() - pet.birthDate) / (365 * 86400000)) * 10) / 10;

      petSummary[petId] = {
        name: pet.name,
        species: pet.species,
        breed: breed ? breed.name : pet.breedId,
        ageYears: ageYears,
        weight: pet.weight,
        gender: pet.gender,
        neutered: pet.neutered,
        allergies: pet.allergies,
        conditions: vetRecord ? vetRecord.conditions : [],
        comfortTemp: comfort ? comfort.comfortRange : null,
        feedingSchedule: schedule ? {
          mealsPerDay: schedule.meals.length,
          feedingType: schedule.feedingType,
          dailyCalorieTarget: schedule.dailyCalorieTarget
        } : null,
        activity: analytics ? {
          dailySteps: analytics.dailySteps,
          dailyActiveMinutes: analytics.dailyActiveMinutes,
          lastWalk: analytics.lastWalk
        } : null,
        upcomingVaccinations: vetRecord ? vetRecord.vaccinations.filter(v => v.nextDue <= Date.now() + 60 * 86400000).length : 0,
        activeMedications: vetRecord ? vetRecord.medications.length : 0
      };
    }

    const upcomingMeds = this.getUpcomingMedications();
    const upcomingVacc = this.getUpcomingVaccinations();
    const optimalTemp = this.getOptimalHomeTemp();

    return {
      pets: petSummary,
      totalPets: this.petProfiles.size,
      breedsInDatabase: this.breedDatabase.size,
      optimalHomeTemp: optimalTemp.temp,
      petSitterMode: this.petSitterMode,
      petSitterName: this.petSitterConfig ? this.petSitterConfig.sitterName : null,
      upcomingMedications: upcomingMeds.count,
      upcomingVaccinations: upcomingVacc.count,
      mealLogEntries: this.mealLog.length,
      behaviorLogEntries: this.behaviorLog.length,
      emergencyContacts: this.emergencyContacts.length,
      uptime: this.initialized ? 'active' : 'inactive'
    };
  }

  log(msg) {
    this.homey.log('[PetCare]', msg);
  }

  error(msg) {
    this.homey.error('[PetCare]', msg);
  }

  destroy() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    if (this.medicationInterval) {
      clearInterval(this.medicationInterval);
      this.medicationInterval = null;
    }
    this.log('Pet Care Automation System destroyed');
  }
}

module.exports = PetCareAutomationSystem;
