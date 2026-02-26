'use strict';

/**
 * HomeNutritionWellnessSystem
 * Comprehensive home nutrition, wellness, and health tracking system.
 * Wave 14 feature.
 */

const DIETARY_TYPES = ['omnivore', 'vegetarian', 'vegan', 'keto', 'paleo', 'gluten-free', 'lactose-free'];
const HEALTH_GOALS = ['weight-loss', 'weight-gain', 'maintain', 'muscle', 'endurance'];
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];
const ACTIVITY_TYPES = ['walk', 'run', 'cycle', 'swim', 'gym', 'yoga'];
const FASTING_PROTOCOLS = {
  '16:8': { fastHours: 16, eatHours: 8 },
  '18:6': { fastHours: 18, eatHours: 6 },
  '20:4': { fastHours: 20, eatHours: 4 },
  'OMAD': { fastHours: 23, eatHours: 1 }
};
const CUP_PRESETS = { small: 200, medium: 330, large: 500 };
const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const SUPPLEMENT_TIMINGS = ['morning', 'afternoon', 'evening', 'with-food', 'without-food'];
const NORDIC_CELEBRATIONS = ['Midsommar', 'Jul', 'Påsk', 'Lucia', 'Valborg', 'Kräftskiva'];
const MONITORING_INTERVAL_MS = 5 * 60 * 1000;
const MAX_HOUSEHOLD_MEMBERS = 8;
const HYDRATION_ML_PER_KG = 30;
const CAFFEINE_CUTOFF_HOUR = 14;
const EVENING_MEAL_HOURS_BEFORE_BED = 3;
const EXPIRY_WARNING_DAYS = 3;

const WELLNESS_WEIGHTS = {
  nutrition: 0.30,
  hydration: 0.20,
  sleep: 0.20,
  activity: 0.20,
  stress: 0.10
};

const NORDIC_RECIPES = [
  { id: 'r1', name: 'Swedish Meatballs (Köttbullar)', calories: 480, protein: 32, carbs: 28, fat: 26, fiber: 2, cookTime: 45, difficulty: 'medium', equipment: ['pan', 'oven'], servings: 4, dietaryType: 'omnivore', seasonal: 'all' },
  { id: 'r2', name: 'Gravlax', calories: 220, protein: 28, carbs: 4, fat: 10, fiber: 0, cookTime: 10, difficulty: 'easy', equipment: ['knife', 'cling-film'], servings: 6, dietaryType: 'omnivore', seasonal: 'all' },
  { id: 'r3', name: 'Janssons Frestelse', calories: 410, protein: 14, carbs: 38, fat: 24, fiber: 3, cookTime: 60, difficulty: 'medium', equipment: ['oven', 'baking-dish'], servings: 6, dietaryType: 'omnivore', seasonal: 'winter' },
  { id: 'r4', name: 'Ärtsoppa (Yellow Pea Soup)', calories: 320, protein: 22, carbs: 44, fat: 6, fiber: 12, cookTime: 90, difficulty: 'easy', equipment: ['pot'], servings: 6, dietaryType: 'vegan', seasonal: 'winter' },
  { id: 'r5', name: 'Toast Skagen', calories: 380, protein: 18, carbs: 22, fat: 26, fiber: 1, cookTime: 20, difficulty: 'easy', equipment: ['pan', 'bowl'], servings: 4, dietaryType: 'omnivore', seasonal: 'summer' },
  { id: 'r6', name: 'Smörgåstårta', calories: 520, protein: 24, carbs: 34, fat: 32, fiber: 2, cookTime: 60, difficulty: 'hard', equipment: ['knife', 'platter'], servings: 8, dietaryType: 'omnivore', seasonal: 'all' },
  { id: 'r7', name: 'Raggmunk (Potato Pancakes)', calories: 340, protein: 8, carbs: 42, fat: 16, fiber: 3, cookTime: 30, difficulty: 'easy', equipment: ['pan'], servings: 4, dietaryType: 'vegetarian', seasonal: 'autumn' },
  { id: 'r8', name: 'Pytt i Panna', calories: 440, protein: 26, carbs: 36, fat: 22, fiber: 4, cookTime: 35, difficulty: 'easy', equipment: ['pan'], servings: 4, dietaryType: 'omnivore', seasonal: 'all' },
  { id: 'r9', name: 'Räkmacka (Shrimp Sandwich)', calories: 290, protein: 18, carbs: 24, fat: 14, fiber: 2, cookTime: 15, difficulty: 'easy', equipment: ['knife'], servings: 2, dietaryType: 'omnivore', seasonal: 'summer' },
  { id: 'r10', name: 'Blåbärssoppa (Blueberry Soup)', calories: 180, protein: 2, carbs: 40, fat: 1, fiber: 4, cookTime: 20, difficulty: 'easy', equipment: ['pot'], servings: 4, dietaryType: 'vegan', seasonal: 'winter' },
  { id: 'r11', name: 'Knäckebröd', calories: 120, protein: 4, carbs: 22, fat: 2, fiber: 6, cookTime: 40, difficulty: 'medium', equipment: ['oven', 'rolling-pin'], servings: 12, dietaryType: 'vegan', seasonal: 'all' },
  { id: 'r12', name: 'Kanelbullar (Cinnamon Buns)', calories: 310, protein: 6, carbs: 46, fat: 12, fiber: 2, cookTime: 50, difficulty: 'medium', equipment: ['oven', 'bowl'], servings: 12, dietaryType: 'vegetarian', seasonal: 'all' },
  { id: 'r13', name: 'Laxpudding (Salmon Pudding)', calories: 360, protein: 26, carbs: 28, fat: 16, fiber: 2, cookTime: 55, difficulty: 'medium', equipment: ['oven', 'baking-dish'], servings: 4, dietaryType: 'omnivore', seasonal: 'all' },
  { id: 'r14', name: 'Kroppkakor (Potato Dumplings)', calories: 390, protein: 18, carbs: 48, fat: 14, fiber: 3, cookTime: 70, difficulty: 'hard', equipment: ['pot', 'bowl'], servings: 4, dietaryType: 'omnivore', seasonal: 'autumn' },
  { id: 'r15', name: 'Sill (Pickled Herring)', calories: 200, protein: 16, carbs: 12, fat: 10, fiber: 0, cookTime: 15, difficulty: 'easy', equipment: ['jar', 'knife'], servings: 6, dietaryType: 'omnivore', seasonal: 'summer' },
  { id: 'r16', name: 'Wallenbergare', calories: 520, protein: 30, carbs: 20, fat: 36, fiber: 1, cookTime: 40, difficulty: 'hard', equipment: ['pan', 'food-processor'], servings: 4, dietaryType: 'omnivore', seasonal: 'all' },
  { id: 'r17', name: 'Kåldolmar (Cabbage Rolls)', calories: 350, protein: 22, carbs: 30, fat: 16, fiber: 4, cookTime: 75, difficulty: 'medium', equipment: ['oven', 'pot'], servings: 4, dietaryType: 'omnivore', seasonal: 'autumn' },
  { id: 'r18', name: 'Västerbottensostpaj', calories: 460, protein: 18, carbs: 26, fat: 32, fiber: 1, cookTime: 50, difficulty: 'medium', equipment: ['oven', 'pie-dish'], servings: 6, dietaryType: 'vegetarian', seasonal: 'summer' },
  { id: 'r19', name: 'Semla', calories: 420, protein: 8, carbs: 52, fat: 20, fiber: 2, cookTime: 45, difficulty: 'medium', equipment: ['oven', 'bowl'], servings: 8, dietaryType: 'vegetarian', seasonal: 'winter' },
  { id: 'r20', name: 'Tunnbrödsrulle', calories: 480, protein: 20, carbs: 44, fat: 24, fiber: 3, cookTime: 20, difficulty: 'easy', equipment: ['grill'], servings: 4, dietaryType: 'omnivore', seasonal: 'summer' },
  { id: 'r21', name: 'Ostkaka (Cheesecake)', calories: 340, protein: 14, carbs: 38, fat: 14, fiber: 0, cookTime: 60, difficulty: 'medium', equipment: ['oven', 'baking-dish'], servings: 8, dietaryType: 'vegetarian', seasonal: 'all' },
  { id: 'r22', name: 'Rotmos (Root Mash)', calories: 180, protein: 3, carbs: 30, fat: 6, fiber: 5, cookTime: 35, difficulty: 'easy', equipment: ['pot', 'masher'], servings: 4, dietaryType: 'vegan', seasonal: 'winter' },
  { id: 'r23', name: 'Flygande Jakob', calories: 560, protein: 36, carbs: 32, fat: 32, fiber: 2, cookTime: 45, difficulty: 'medium', equipment: ['oven', 'baking-dish'], servings: 4, dietaryType: 'omnivore', seasonal: 'all' },
  { id: 'r24', name: 'Falukorv i ugn', calories: 420, protein: 18, carbs: 30, fat: 24, fiber: 2, cookTime: 40, difficulty: 'easy', equipment: ['oven'], servings: 4, dietaryType: 'omnivore', seasonal: 'all' },
  { id: 'r25', name: 'Lövbiff (Thinly Pounded Beef)', calories: 380, protein: 34, carbs: 14, fat: 20, fiber: 1, cookTime: 25, difficulty: 'easy', equipment: ['pan', 'mallet'], servings: 4, dietaryType: 'omnivore', seasonal: 'all' },
  { id: 'r26', name: 'Bruna Bönor (Brown Beans)', calories: 280, protein: 14, carbs: 46, fat: 4, fiber: 10, cookTime: 120, difficulty: 'easy', equipment: ['pot'], servings: 4, dietaryType: 'vegan', seasonal: 'winter' },
  { id: 'r27', name: 'Stekt Strömming (Fried Baltic Herring)', calories: 320, protein: 22, carbs: 18, fat: 18, fiber: 1, cookTime: 25, difficulty: 'easy', equipment: ['pan'], servings: 4, dietaryType: 'omnivore', seasonal: 'autumn' },
  { id: 'r28', name: 'Palt (Potato Dumplings Northern)', calories: 400, protein: 20, carbs: 52, fat: 12, fiber: 3, cookTime: 60, difficulty: 'medium', equipment: ['pot'], servings: 4, dietaryType: 'omnivore', seasonal: 'winter' },
  { id: 'r29', name: 'Rödbetssallad (Beetroot Salad)', calories: 160, protein: 4, carbs: 22, fat: 6, fiber: 4, cookTime: 15, difficulty: 'easy', equipment: ['bowl', 'knife'], servings: 4, dietaryType: 'vegan', seasonal: 'all' },
  { id: 'r30', name: 'Pepparkakor (Ginger Snaps)', calories: 140, protein: 2, carbs: 28, fat: 4, fiber: 1, cookTime: 40, difficulty: 'easy', equipment: ['oven', 'rolling-pin'], servings: 30, dietaryType: 'vegetarian', seasonal: 'winter' },
  { id: 'r31', name: 'Grönsakssoppa (Vegetable Soup)', calories: 190, protein: 6, carbs: 28, fat: 6, fiber: 7, cookTime: 40, difficulty: 'easy', equipment: ['pot'], servings: 4, dietaryType: 'vegan', seasonal: 'all' },
  { id: 'r32', name: 'Löksoppa (Onion Soup)', calories: 220, protein: 8, carbs: 24, fat: 10, fiber: 3, cookTime: 50, difficulty: 'easy', equipment: ['pot'], servings: 4, dietaryType: 'vegetarian', seasonal: 'winter' },
  { id: 'r33', name: 'Dillstuvade Potatis', calories: 240, protein: 5, carbs: 34, fat: 10, fiber: 3, cookTime: 30, difficulty: 'easy', equipment: ['pot'], servings: 4, dietaryType: 'vegetarian', seasonal: 'summer' },
  { id: 'r34', name: 'Smulpaj (Crumble Pie)', calories: 360, protein: 4, carbs: 50, fat: 16, fiber: 4, cookTime: 40, difficulty: 'easy', equipment: ['oven', 'pie-dish'], servings: 6, dietaryType: 'vegetarian', seasonal: 'summer' },
  { id: 'r35', name: 'Filmjölk Bowl', calories: 250, protein: 12, carbs: 38, fat: 6, fiber: 5, cookTime: 5, difficulty: 'easy', equipment: ['bowl'], servings: 1, dietaryType: 'vegetarian', seasonal: 'all' },
  { id: 'r36', name: 'Svampsoppa (Mushroom Soup)', calories: 210, protein: 6, carbs: 18, fat: 14, fiber: 3, cookTime: 35, difficulty: 'easy', equipment: ['pot'], servings: 4, dietaryType: 'vegan', seasonal: 'autumn' },
  { id: 'r37', name: 'Laxsoppa (Salmon Soup)', calories: 340, protein: 24, carbs: 22, fat: 18, fiber: 2, cookTime: 35, difficulty: 'easy', equipment: ['pot'], servings: 4, dietaryType: 'omnivore', seasonal: 'all' },
  { id: 'r38', name: 'Jordgubbstårta (Strawberry Cake)', calories: 380, protein: 6, carbs: 48, fat: 18, fiber: 2, cookTime: 50, difficulty: 'medium', equipment: ['oven', 'bowl', 'whisk'], servings: 8, dietaryType: 'vegetarian', seasonal: 'summer' },
  { id: 'r39', name: 'Prinskorv (Small Sausages)', calories: 300, protein: 14, carbs: 8, fat: 24, fiber: 0, cookTime: 15, difficulty: 'easy', equipment: ['pan'], servings: 4, dietaryType: 'omnivore', seasonal: 'winter' },
  { id: 'r40', name: 'Smörgås (Open Sandwich)', calories: 260, protein: 12, carbs: 28, fat: 12, fiber: 3, cookTime: 10, difficulty: 'easy', equipment: ['knife'], servings: 2, dietaryType: 'omnivore', seasonal: 'all' },
  { id: 'r41', name: 'Lingonsylt (Lingonberry Jam)', calories: 120, protein: 0, carbs: 30, fat: 0, fiber: 2, cookTime: 20, difficulty: 'easy', equipment: ['pot', 'jar'], servings: 20, dietaryType: 'vegan', seasonal: 'autumn' },
  { id: 'r42', name: 'Kryddor Lax (Spiced Salmon)', calories: 290, protein: 30, carbs: 4, fat: 16, fiber: 0, cookTime: 25, difficulty: 'easy', equipment: ['oven'], servings: 4, dietaryType: 'omnivore', seasonal: 'all' },
  { id: 'r43', name: 'Havregröt (Oat Porridge)', calories: 220, protein: 8, carbs: 38, fat: 4, fiber: 6, cookTime: 10, difficulty: 'easy', equipment: ['pot'], servings: 2, dietaryType: 'vegan', seasonal: 'winter' },
  { id: 'r44', name: 'Blodpudding (Blood Pudding)', calories: 380, protein: 16, carbs: 42, fat: 16, fiber: 2, cookTime: 20, difficulty: 'easy', equipment: ['pan'], servings: 4, dietaryType: 'omnivore', seasonal: 'all' },
  { id: 'r45', name: 'Inlagd Gurka (Pickled Cucumber)', calories: 60, protein: 1, carbs: 14, fat: 0, fiber: 1, cookTime: 15, difficulty: 'easy', equipment: ['jar', 'pot'], servings: 10, dietaryType: 'vegan', seasonal: 'summer' },
  { id: 'r46', name: 'Nyponsoppa (Rose Hip Soup)', calories: 150, protein: 2, carbs: 34, fat: 1, fiber: 6, cookTime: 25, difficulty: 'easy', equipment: ['pot'], servings: 4, dietaryType: 'vegan', seasonal: 'winter' },
  { id: 'r47', name: 'Köttfärssås (Meat Sauce)', calories: 380, protein: 26, carbs: 22, fat: 20, fiber: 4, cookTime: 40, difficulty: 'easy', equipment: ['pot'], servings: 4, dietaryType: 'omnivore', seasonal: 'all' },
  { id: 'r48', name: 'Pannkakor (Swedish Pancakes)', calories: 280, protein: 10, carbs: 36, fat: 10, fiber: 1, cookTime: 25, difficulty: 'easy', equipment: ['pan'], servings: 4, dietaryType: 'vegetarian', seasonal: 'all' },
  { id: 'r49', name: 'Saffransbullar (Saffron Buns)', calories: 340, protein: 8, carbs: 50, fat: 12, fiber: 2, cookTime: 55, difficulty: 'medium', equipment: ['oven', 'bowl'], servings: 12, dietaryType: 'vegetarian', seasonal: 'winter' },
  { id: 'r50', name: 'Linsgryta (Lentil Stew)', calories: 310, protein: 18, carbs: 44, fat: 6, fiber: 14, cookTime: 45, difficulty: 'easy', equipment: ['pot'], servings: 4, dietaryType: 'vegan', seasonal: 'all' }
];

const CALORIE_BURN_PER_HOUR = {
  walk: 280,
  run: 600,
  cycle: 500,
  swim: 550,
  gym: 400,
  yoga: 200
};

const TRYPTOPHAN_FOODS = ['turkey', 'chicken', 'milk', 'cheese', 'nuts', 'seeds', 'bananas', 'oats', 'tofu', 'eggs'];

class HomeNutritionWellnessSystem {
  constructor(homey) {
    this.homey = homey;

    this.householdMembers = new Map();
    this.mealPlans = new Map();
    this.mealLogs = [];
    this.hydrationLogs = [];
    this.supplementSchedules = new Map();
    this.supplementInventory = [];
    this.fastingTrackers = new Map();
    this.fridgeInventory = [];
    this.pantryInventory = [];
    this.shoppingList = [];
    this.customRecipes = [];
    this.activityLogs = [];
    this.sleepLogs = [];
    this.moodJournal = [];
    this.healthMetrics = new Map();
    this.wasteLog = [];
    this.cookingDuties = new Map();
    this.specialOccasions = [];
    this.groceryBudget = { monthly: 0, spent: 0 };
    this.storePreference = '';
    this.organicPreference = false;
    this.localPreference = false;
    this.waterFilterInstalled = null;
    this.waterFilterLifespanDays = 90;
    this.wellnessScores = new Map();
    this.scaleReadings = [];
    this.bloodPressureLogs = [];
    this.bloodSugarLogs = [];
    this.cholesterolLogs = [];
    this.doctorVisits = [];
    this.wasteReductionGoalKg = 2.0;
    this.monitoringInterval = null;
    this.initialized = false;
  }

  async initialize() {
    try {
      this.log('Initializing HomeNutritionWellnessSystem...');
      try {
        this._loadDefaults();
        this._startMonitoringCycle();
        this.initialized = true;
        this.log('HomeNutritionWellnessSystem initialized successfully');
      } catch (err) {
        this.error(`Initialization failed: ${err.message}`);
      }
    } catch (error) {
      this.homey.error(`[HomeNutritionWellnessSystem] Failed to initialize:`, error.message);
    }
  }

  _loadDefaults() {
    this.waterFilterInstalled = new Date();
    this.groceryBudget = { monthly: 6000, spent: 0, currency: 'SEK' };
    this.storePreference = 'ICA';
    this.organicPreference = true;
    this.localPreference = true;
  }

  // ─── Household Member Management ────────────────────────────────────

  addMember(memberData) {
    if (this.householdMembers.size >= MAX_HOUSEHOLD_MEMBERS) {
      this.error('Maximum household members reached (8)');
      return null;
    }
    const id = `member_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const bmi = this._calculateBMI(memberData.weight, memberData.height);
    const dailyCalorieTarget = memberData.dailyCalorieTarget || this._estimateCalorieTarget(memberData);
    const member = {
      id,
      name: memberData.name || 'Unknown',
      age: memberData.age || 30,
      weight: memberData.weight || 70,
      height: memberData.height || 170,
      bmi,
      dietaryType: DIETARY_TYPES.includes(memberData.dietaryType) ? memberData.dietaryType : 'omnivore',
      allergies: Array.isArray(memberData.allergies) ? memberData.allergies : [],
      healthGoal: HEALTH_GOALS.includes(memberData.healthGoal) ? memberData.healthGoal : 'maintain',
      dailyCalorieTarget,
      dailyHydrationTargetMl: Math.round(memberData.weight * HYDRATION_ML_PER_KG) || 2100,
      wakeUpHour: memberData.wakeUpHour || 7,
      bedtimeHour: memberData.bedtimeHour || 23,
      cookingSkillLevel: memberData.cookingSkillLevel || 1,
      fastingProtocol: null,
      createdAt: new Date().toISOString()
    };
    this.householdMembers.set(id, member);
    this.healthMetrics.set(id, { weightHistory: [{ date: new Date().toISOString(), weight: member.weight }], bmiHistory: [{ date: new Date().toISOString(), bmi }] });
    this.wellnessScores.set(id, []);
    this.log(`Added household member: ${member.name} (BMI: ${bmi})`);
    return member;
  }

  updateMember(memberId, updates) {
    const member = this.householdMembers.get(memberId);
    if (!member) {
      this.error(`Member not found: ${memberId}`);
      return null;
    }
    if (updates.weight !== undefined) {
      member.weight = updates.weight;
      member.bmi = this._calculateBMI(updates.weight, member.height);
      member.dailyHydrationTargetMl = Math.round(updates.weight * HYDRATION_ML_PER_KG);
      const metrics = this.healthMetrics.get(memberId);
      if (metrics) {
        metrics.weightHistory.push({ date: new Date().toISOString(), weight: updates.weight });
        metrics.bmiHistory.push({ date: new Date().toISOString(), bmi: member.bmi });
      }
    }
    if (updates.height !== undefined) {
      member.height = updates.height;
      member.bmi = this._calculateBMI(member.weight, updates.height);
    }
    if (updates.name !== undefined) member.name = updates.name;
    if (updates.age !== undefined) member.age = updates.age;
    if (updates.dietaryType && DIETARY_TYPES.includes(updates.dietaryType)) member.dietaryType = updates.dietaryType;
    if (updates.healthGoal && HEALTH_GOALS.includes(updates.healthGoal)) member.healthGoal = updates.healthGoal;
    if (updates.allergies) member.allergies = updates.allergies;
    if (updates.dailyCalorieTarget) member.dailyCalorieTarget = updates.dailyCalorieTarget;
    if (updates.cookingSkillLevel !== undefined) member.cookingSkillLevel = Math.min(10, Math.max(1, updates.cookingSkillLevel));
    this.log(`Updated member: ${member.name}`);
    return member;
  }

  removeMember(memberId) {
    const member = this.householdMembers.get(memberId);
    if (!member) return false;
    this.householdMembers.delete(memberId);
    this.healthMetrics.delete(memberId);
    this.wellnessScores.delete(memberId);
    this.supplementSchedules.delete(memberId);
    this.fastingTrackers.delete(memberId);
    this.log(`Removed member: ${member.name}`);
    return true;
  }

  getMember(memberId) {
    return this.householdMembers.get(memberId) || null;
  }

  getAllMembers() {
    return Array.from(this.householdMembers.values());
  }

  _calculateBMI(weightKg, heightCm) {
    if (!weightKg || !heightCm || heightCm === 0) return 0;
    const heightM = heightCm / 100;
    return parseFloat((weightKg / (heightM * heightM)).toFixed(1));
  }

  _estimateCalorieTarget(memberData) {
    const weight = memberData.weight || 70;
    const height = memberData.height || 170;
    const age = memberData.age || 30;
    // Mifflin-St Jeor baseline
    let bmr = 10 * weight + 6.25 * height - 5 * age + 5;
    let tdee = bmr * 1.55; // moderate activity
    const goal = memberData.healthGoal || 'maintain';
    if (goal === 'weight-loss') tdee -= 500;
    else if (goal === 'weight-gain' || goal === 'muscle') tdee += 400;
    return Math.round(tdee);
  }

  // ─── Meal Planning ──────────────────────────────────────────────────

  generateWeeklyMealPlan(memberId) {
    const member = this.householdMembers.get(memberId);
    if (!member) {
      this.error(`Member not found for meal plan: ${memberId}`);
      return null;
    }
    const targetCals = member.dailyCalorieTarget;
    const mealDistribution = {
      breakfast: 0.25,
      lunch: 0.35,
      dinner: 0.30,
      snack: 0.10
    };
    const compatibleRecipes = this._getCompatibleRecipes(member);
    const plan = {};
    for (const day of DAYS_OF_WEEK) {
      plan[day] = {};
      for (const mealType of MEAL_TYPES) {
        const targetForMeal = Math.round(targetCals * mealDistribution[mealType]);
        const recipe = this._selectRecipeForMeal(compatibleRecipes, targetForMeal, mealType);
        plan[day][mealType] = {
          recipe: recipe ? recipe.name : `Custom ${mealType}`,
          recipeId: recipe ? recipe.id : null,
          targetCalories: targetForMeal,
          targetProtein: Math.round(targetForMeal * 0.3 / 4),
          targetCarbs: Math.round(targetForMeal * 0.4 / 4),
          targetFat: Math.round(targetForMeal * 0.3 / 9)
        };
      }
    }
    const planEntry = {
      memberId,
      memberName: member.name,
      weekStart: this._getWeekStart(),
      plan,
      createdAt: new Date().toISOString()
    };
    this.mealPlans.set(`${memberId}_${planEntry.weekStart}`, planEntry);
    this.log(`Generated weekly meal plan for ${member.name}`);
    return planEntry;
  }

  _getCompatibleRecipes(member) {
    const allRecipes = [...NORDIC_RECIPES, ...this.customRecipes];
    return allRecipes.filter(recipe => {
      if (member.dietaryType === 'vegan' && recipe.dietaryType !== 'vegan') return false;
      if (member.dietaryType === 'vegetarian' && recipe.dietaryType === 'omnivore') return false;
      for (const allergy of member.allergies) {
        if (recipe.name.toLowerCase().includes(allergy.toLowerCase())) return false;
      }
      return true;
    });
  }

  _selectRecipeForMeal(recipes, targetCalories, _mealType) {
    if (recipes.length === 0) return null;
    const tolerance = 200;
    const suitable = recipes.filter(r => Math.abs(r.calories - targetCalories) <= tolerance);
    if (suitable.length > 0) {
      return suitable[Math.floor(Math.random() * suitable.length)];
    }
    return recipes[Math.floor(Math.random() * recipes.length)];
  }

  getBatchCookingSuggestions(memberId) {
    const planKey = Array.from(this.mealPlans.keys()).find(k => k.startsWith(memberId));
    if (!planKey) return [];
    const plan = this.mealPlans.get(planKey);
    const recipeCounts = {};
    for (const day of DAYS_OF_WEEK) {
      for (const mealType of MEAL_TYPES) {
        const meal = plan.plan[day][mealType];
        if (meal.recipeId) {
          recipeCounts[meal.recipe] = (recipeCounts[meal.recipe] || 0) + 1;
        }
      }
    }
    return Object.entries(recipeCounts)
      .filter(([, count]) => count >= 2)
      .map(([recipe, count]) => ({ recipe, occurrences: count, suggestion: `Batch cook ${recipe} for ${count} meals` }));
  }

  getSeasonalRecipes() {
    const month = new Date().getMonth();
    let season = 'all';
    if (month >= 2 && month <= 4) season = 'spring';
    else if (month >= 5 && month <= 7) season = 'summer';
    else if (month >= 8 && month <= 10) season = 'autumn';
    else season = 'winter';
    return NORDIC_RECIPES.filter(r => r.seasonal === season || r.seasonal === 'all');
  }

  _getWeekStart() {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(now.setDate(diff)).toISOString().split('T')[0];
  }

  // ─── Nutritional Tracking ──────────────────────────────────────────

  logMeal(memberId, mealData) {
    const member = this.householdMembers.get(memberId);
    if (!member) {
      this.error(`Member not found for meal log: ${memberId}`);
      return null;
    }
    const entry = {
      id: `meal_${Date.now()}`,
      memberId,
      memberName: member.name,
      mealType: MEAL_TYPES.includes(mealData.mealType) ? mealData.mealType : 'snack',
      description: mealData.description || '',
      calories: mealData.calories || 0,
      protein: mealData.protein || 0,
      carbs: mealData.carbs || 0,
      fat: mealData.fat || 0,
      fiber: mealData.fiber || 0,
      iron: mealData.iron || 0,
      calcium: mealData.calcium || 0,
      vitaminD: mealData.vitaminD || 0,
      timestamp: new Date().toISOString(),
      mood: mealData.mood || null
    };
    this.mealLogs.push(entry);
    if (entry.mood) {
      this.moodJournal.push({
        memberId,
        mealId: entry.id,
        mood: entry.mood,
        mealDescription: entry.description,
        timestamp: entry.timestamp
      });
    }
    this.log(`Logged meal for ${member.name}: ${entry.description} (${entry.calories} kcal)`);
    return entry;
  }

  getDailySummary(memberId, dateStr) {
    const date = dateStr || new Date().toISOString().split('T')[0];
    const meals = this.mealLogs.filter(m => m.memberId === memberId && m.timestamp.startsWith(date));
    const member = this.householdMembers.get(memberId);
    const totals = meals.reduce((acc, m) => {
      acc.calories += m.calories;
      acc.protein += m.protein;
      acc.carbs += m.carbs;
      acc.fat += m.fat;
      acc.fiber += m.fiber;
      acc.iron += m.iron;
      acc.calcium += m.calcium;
      acc.vitaminD += m.vitaminD;
      return acc;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, iron: 0, calcium: 0, vitaminD: 0 });

    const target = member ? member.dailyCalorieTarget : 2000;
    const deficiencies = this._checkDeficiencies(totals);

    return {
      date,
      memberId,
      memberName: member ? member.name : 'Unknown',
      mealCount: meals.length,
      totals,
      target,
      remaining: target - totals.calories,
      percentComplete: Math.round((totals.calories / target) * 100),
      deficiencies
    };
  }

  getWeeklySummary(memberId) {
    const summaries = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      summaries.push(this.getDailySummary(memberId, dateStr));
    }
    const avgCalories = summaries.reduce((s, d) => s + d.totals.calories, 0) / 7;
    const avgProtein = summaries.reduce((s, d) => s + d.totals.protein, 0) / 7;
    return {
      memberId,
      days: summaries,
      averages: {
        calories: Math.round(avgCalories),
        protein: Math.round(avgProtein)
      }
    };
  }

  _checkDeficiencies(totals) {
    const warnings = [];
    const month = new Date().getMonth();
    const isNordicWinter = month >= 9 || month <= 2;
    if (totals.vitaminD < 15 && isNordicWinter) {
      warnings.push({ nutrient: 'Vitamin D', message: 'Low vitamin D intake — critical during Nordic winter. Consider supplementation (2000 IU/day).' });
    }
    if (totals.iron < 8) {
      warnings.push({ nutrient: 'Iron', message: 'Iron intake below recommended daily value. Consider iron-rich foods (spinach, lentils, red meat).' });
    }
    if (totals.calcium < 800) {
      warnings.push({ nutrient: 'Calcium', message: 'Calcium intake below recommended. Include dairy or fortified plant milk.' });
    }
    if (totals.fiber < 25) {
      warnings.push({ nutrient: 'Fiber', message: 'Fiber intake below 25g target. Add whole grains, vegetables, and legumes.' });
    }
    return warnings;
  }

  // ─── Hydration Management ──────────────────────────────────────────

  logHydration(memberId, amountMl, cupSize) {
    const member = this.householdMembers.get(memberId);
    if (!member) return null;
    const ml = cupSize && CUP_PRESETS[cupSize] ? CUP_PRESETS[cupSize] : (amountMl || 200);
    const entry = {
      id: `hydration_${Date.now()}`,
      memberId,
      amountMl: ml,
      timestamp: new Date().toISOString()
    };
    this.hydrationLogs.push(entry);
    this.log(`Hydration logged for ${member.name}: ${ml}ml`);
    return entry;
  }

  getHydrationStatus(memberId, dateStr) {
    const date = dateStr || new Date().toISOString().split('T')[0];
    const member = this.householdMembers.get(memberId);
    if (!member) return null;
    const logs = this.hydrationLogs.filter(h => h.memberId === memberId && h.timestamp.startsWith(date));
    const totalMl = logs.reduce((s, h) => s + h.amountMl, 0);
    const target = this._getAdjustedHydrationTarget(member);
    return {
      memberId,
      memberName: member.name,
      date,
      totalMl,
      targetMl: target,
      remaining: Math.max(0, target - totalMl),
      percentComplete: Math.round((totalMl / target) * 100),
      glassesConsumed: logs.length,
      onTrack: totalMl >= target * 0.8
    };
  }

  _getAdjustedHydrationTarget(member) {
    let target = member.dailyHydrationTargetMl;
    // Temperature adjustment — assume we can check outdoor temp
    // For now, increase 20% in summer months
    const month = new Date().getMonth();
    if (month >= 5 && month <= 7) target = Math.round(target * 1.2);
    return target;
  }

  getHydrationReminder(memberId) {
    const member = this.householdMembers.get(memberId);
    if (!member) return null;
    const now = new Date();
    const hour = now.getHours();
    if (hour < member.wakeUpHour || hour >= member.bedtimeHour) return null;
    const status = this.getHydrationStatus(memberId);
    if (!status) return null;
    const hoursAwake = hour - member.wakeUpHour;
    const totalWakingHours = member.bedtimeHour - member.wakeUpHour;
    const expectedPercent = Math.round((hoursAwake / totalWakingHours) * 100);
    if (status.percentComplete < expectedPercent - 15) {
      return {
        memberId,
        memberName: member.name,
        message: `Time to drink water! You're at ${status.percentComplete}% of your daily goal (${status.totalMl}ml / ${status.targetMl}ml).`,
        behindByMl: Math.round((status.targetMl * expectedPercent / 100) - status.totalMl)
      };
    }
    return null;
  }

  getWaterFilterStatus() {
    if (!this.waterFilterInstalled) return { installed: false };
    const installed = new Date(this.waterFilterInstalled);
    const now = new Date();
    const daysSince = Math.floor((now - installed) / (1000 * 60 * 60 * 24));
    const daysRemaining = this.waterFilterLifespanDays - daysSince;
    return {
      installed: true,
      installedDate: installed.toISOString(),
      daysSinceInstall: daysSince,
      daysRemaining: Math.max(0, daysRemaining),
      replacementNeeded: daysRemaining <= 7,
      percentLifeUsed: Math.round((daysSince / this.waterFilterLifespanDays) * 100)
    };
  }

  // ─── Smart Kitchen Integration ─────────────────────────────────────

  addScaleReading(weightGrams, itemName) {
    const reading = {
      id: `scale_${Date.now()}`,
      weightGrams,
      itemName: itemName || 'unknown',
      timestamp: new Date().toISOString()
    };
    this.scaleReadings.push(reading);
    this.log(`Scale reading: ${itemName} - ${weightGrams}g`);
    return reading;
  }

  addFridgeItem(item) {
    const entry = {
      id: `fridge_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: item.name,
      quantity: item.quantity || 1,
      unit: item.unit || 'pcs',
      expiryDate: item.expiryDate || null,
      addedDate: new Date().toISOString(),
      category: item.category || 'other'
    };
    this.fridgeInventory.push(entry);
    this.log(`Added to fridge: ${entry.name} (expires: ${entry.expiryDate || 'N/A'})`);
    return entry;
  }

  removeFridgeItem(itemId) {
    const idx = this.fridgeInventory.findIndex(i => i.id === itemId);
    if (idx === -1) return false;
    this.fridgeInventory.splice(idx, 1);
    return true;
  }

  addPantryItem(item) {
    const entry = {
      id: `pantry_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: item.name,
      quantity: item.quantity || 1,
      unit: item.unit || 'pcs',
      expiryDate: item.expiryDate || null,
      addedDate: new Date().toISOString(),
      category: item.category || 'other'
    };
    this.pantryInventory.push(entry);
    return entry;
  }

  getExpiringItems(withinDays) {
    const days = withinDays || EXPIRY_WARNING_DAYS;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    const allItems = [...this.fridgeInventory, ...this.pantryInventory];
    return allItems
      .filter(i => i.expiryDate && i.expiryDate <= cutoffStr)
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))
      .map(i => ({
        ...i,
        daysUntilExpiry: Math.ceil((new Date(i.expiryDate) - new Date()) / (1000 * 60 * 60 * 24)),
        urgent: i.expiryDate <= new Date().toISOString().split('T')[0]
      }));
  }

  getUseFirstSuggestions() {
    const expiring = this.getExpiringItems(5);
    return expiring.map(item => {
      const recipes = NORDIC_RECIPES.filter(r => r.name.toLowerCase().includes(item.name.toLowerCase()));
      return {
        item: item.name,
        daysUntilExpiry: item.daysUntilExpiry,
        suggestedRecipes: recipes.length > 0 ? recipes.map(r => r.name) : ['Custom preparation recommended']
      };
    });
  }

  generateShoppingListFromMealPlan(memberId) {
    const planKey = Array.from(this.mealPlans.keys()).find(k => k.startsWith(memberId));
    if (!planKey) return [];
    const plan = this.mealPlans.get(planKey);
    const neededItems = [];
    for (const day of DAYS_OF_WEEK) {
      for (const mealType of MEAL_TYPES) {
        const meal = plan.plan[day][mealType];
        if (meal.recipe) {
          neededItems.push({ item: meal.recipe, forDay: day, forMeal: mealType });
        }
      }
    }
    this.shoppingList = neededItems;
    this.log(`Generated shopping list with ${neededItems.length} items for ${plan.memberName}`);
    return neededItems;
  }

  scaleRecipe(recipeId, targetServings) {
    const recipe = NORDIC_RECIPES.find(r => r.id === recipeId) || this.customRecipes.find(r => r.id === recipeId);
    if (!recipe) return null;
    const factor = targetServings / recipe.servings;
    return {
      ...recipe,
      servings: targetServings,
      calories: Math.round(recipe.calories * factor),
      protein: Math.round(recipe.protein * factor),
      carbs: Math.round(recipe.carbs * factor),
      fat: Math.round(recipe.fat * factor),
      fiber: Math.round(recipe.fiber * factor),
      scaleFactor: factor
    };
  }

  // ─── Supplement Management ─────────────────────────────────────────

  addSupplementSchedule(memberId, supplement) {
    const member = this.householdMembers.get(memberId);
    if (!member) return null;
    const schedule = {
      id: `supp_${Date.now()}`,
      memberId,
      name: supplement.name || 'Supplement',
      dosage: supplement.dosage || '1 tablet',
      amount: supplement.amount || '',
      timing: SUPPLEMENT_TIMINGS.includes(supplement.timing) ? supplement.timing : 'morning',
      withFood: supplement.withFood !== undefined ? supplement.withFood : true,
      inventoryCount: supplement.inventoryCount || 30,
      reorderThreshold: supplement.reorderThreshold || 7,
      createdAt: new Date().toISOString()
    };
    const existing = this.supplementSchedules.get(memberId) || [];
    existing.push(schedule);
    this.supplementSchedules.set(memberId, existing);
    this.log(`Added supplement for ${member.name}: ${schedule.name} (${schedule.dosage}) - ${schedule.timing}`);
    return schedule;
  }

  getSupplementReminders(memberId) {
    const schedules = this.supplementSchedules.get(memberId) || [];
    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? 'morning' : (hour < 17 ? 'afternoon' : 'evening');
    return schedules
      .filter(s => s.timing === timeOfDay || s.timing === 'with-food' || s.timing === 'without-food')
      .map(s => ({
        name: s.name,
        dosage: s.dosage,
        timing: s.timing,
        withFood: s.withFood,
        inventoryRemaining: s.inventoryCount,
        reorderNeeded: s.inventoryCount <= s.reorderThreshold
      }));
  }

  takeSupplementDose(memberId, supplementId) {
    const schedules = this.supplementSchedules.get(memberId) || [];
    const supp = schedules.find(s => s.id === supplementId);
    if (!supp) return null;
    supp.inventoryCount = Math.max(0, supp.inventoryCount - 1);
    this.log(`Supplement taken: ${supp.name}, remaining: ${supp.inventoryCount}`);
    return { name: supp.name, remaining: supp.inventoryCount, reorderNeeded: supp.inventoryCount <= supp.reorderThreshold };
  }

  // ─── Fasting Tracker ───────────────────────────────────────────────

  startFast(memberId, protocol) {
    const member = this.householdMembers.get(memberId);
    if (!member) return null;
    const proto = FASTING_PROTOCOLS[protocol];
    if (!proto) {
      this.error(`Unknown fasting protocol: ${protocol}`);
      return null;
    }
    const tracker = {
      memberId,
      protocol,
      fastHours: proto.fastHours,
      eatHours: proto.eatHours,
      startedAt: new Date().toISOString(),
      targetEndAt: new Date(Date.now() + proto.fastHours * 3600000).toISOString(),
      eatingWindowEnd: null,
      streak: (this.fastingTrackers.get(memberId) || {}).streak || 0,
      completedFasts: (this.fastingTrackers.get(memberId) || {}).completedFasts || 0,
      active: true
    };
    member.fastingProtocol = protocol;
    this.fastingTrackers.set(memberId, tracker);
    this.log(`Fasting started for ${member.name}: ${protocol}`);
    return tracker;
  }

  endFast(memberId) {
    const tracker = this.fastingTrackers.get(memberId);
    if (!tracker || !tracker.active) return null;
    const now = new Date();
    const fastStart = new Date(tracker.startedAt);
    const hoursElapsed = (now - fastStart) / 3600000;
    tracker.active = false;
    tracker.endedAt = now.toISOString();
    tracker.actualHours = parseFloat(hoursElapsed.toFixed(1));
    tracker.eatingWindowEnd = new Date(now.getTime() + tracker.eatHours * 3600000).toISOString();
    if (hoursElapsed >= tracker.fastHours * 0.9) {
      tracker.streak += 1;
      tracker.completedFasts += 1;
    } else {
      tracker.streak = 0;
    }
    this.log(`Fast ended for member ${memberId}: ${tracker.actualHours}h (target: ${tracker.fastHours}h), streak: ${tracker.streak}`);
    return tracker;
  }

  getFastingStatus(memberId) {
    const tracker = this.fastingTrackers.get(memberId);
    if (!tracker) return { active: false, message: 'No fasting protocol set' };
    if (!tracker.active) {
      return {
        active: false,
        protocol: tracker.protocol,
        lastFast: tracker.endedAt,
        streak: tracker.streak,
        completedFasts: tracker.completedFasts,
        eatingWindowEnd: tracker.eatingWindowEnd,
        inEatingWindow: tracker.eatingWindowEnd ? new Date() < new Date(tracker.eatingWindowEnd) : false
      };
    }
    const now = new Date();
    const fastStart = new Date(tracker.startedAt);
    const hoursElapsed = (now - fastStart) / 3600000;
    const hoursRemaining = Math.max(0, tracker.fastHours - hoursElapsed);
    return {
      active: true,
      protocol: tracker.protocol,
      hoursElapsed: parseFloat(hoursElapsed.toFixed(1)),
      hoursRemaining: parseFloat(hoursRemaining.toFixed(1)),
      percentComplete: Math.min(100, Math.round((hoursElapsed / tracker.fastHours) * 100)),
      streak: tracker.streak,
      targetEnd: tracker.targetEndAt
    };
  }

  // ─── Wellness Scores ───────────────────────────────────────────────

  calculateWellnessScore(memberId) {
    const member = this.householdMembers.get(memberId);
    if (!member) return null;
    const today = new Date().toISOString().split('T')[0];

    // Nutrition score (0-100)
    const dailySummary = this.getDailySummary(memberId, today);
    const nutritionRatio = dailySummary.totals.calories > 0
      ? Math.min(1, dailySummary.totals.calories / dailySummary.target)
      : 0;
    const nutritionScore = Math.round(nutritionRatio * 100);

    // Hydration score (0-100)
    const hydration = this.getHydrationStatus(memberId, today);
    const hydrationScore = hydration ? Math.min(100, hydration.percentComplete) : 0;

    // Sleep score (0-100) - from sleep logs
    const sleepLog = this.sleepLogs.find(s => s.memberId === memberId && s.date === today);
    const sleepScore = sleepLog ? Math.min(100, Math.round((sleepLog.hoursSlept / 8) * 100)) : 50;

    // Activity score (0-100)
    const todayActivities = this.activityLogs.filter(a => a.memberId === memberId && a.timestamp.startsWith(today));
    const totalActivityMin = todayActivities.reduce((s, a) => s + (a.durationMinutes || 0), 0);
    const activityScore = Math.min(100, Math.round((totalActivityMin / 30) * 100));

    // Stress score (0-100, inverted: lower stress = higher score)
    const moodEntries = this.moodJournal.filter(m => m.memberId === memberId && m.timestamp.startsWith(today));
    const stressScore = moodEntries.length > 0
      ? Math.round(moodEntries.reduce((s, m) => s + (m.mood === 'good' || m.mood === 'great' ? 80 : m.mood === 'ok' ? 50 : 20), 0) / moodEntries.length)
      : 50;

    const overall = Math.round(
      nutritionScore * WELLNESS_WEIGHTS.nutrition +
      hydrationScore * WELLNESS_WEIGHTS.hydration +
      sleepScore * WELLNESS_WEIGHTS.sleep +
      activityScore * WELLNESS_WEIGHTS.activity +
      stressScore * WELLNESS_WEIGHTS.stress
    );

    const suggestions = this._generateWellnessSuggestions(nutritionScore, hydrationScore, sleepScore, activityScore, stressScore);

    const scoreEntry = {
      date: today,
      overall,
      breakdown: { nutrition: nutritionScore, hydration: hydrationScore, sleep: sleepScore, activity: activityScore, stress: stressScore },
      suggestions
    };

    const history = this.wellnessScores.get(memberId) || [];
    history.push(scoreEntry);
    if (history.length > 90) history.shift();
    this.wellnessScores.set(memberId, history);

    return scoreEntry;
  }

  _generateWellnessSuggestions(nutrition, hydration, sleep, activity, stress) {
    const suggestions = [];
    if (nutrition < 60) suggestions.push('Try to eat more balanced meals throughout the day.');
    if (hydration < 50) suggestions.push('Increase water intake — set hourly reminders.');
    if (sleep < 60) suggestions.push('Aim for 7-8 hours of sleep. Avoid screens before bed.');
    if (activity < 40) suggestions.push('Try a 30-minute walk or light exercise today.');
    if (stress < 40) suggestions.push('Consider a relaxation activity: meditation, yoga, or a warm bath.');
    if (suggestions.length === 0) suggestions.push('Great job! Keep up your healthy habits.');
    return suggestions;
  }

  getWellnessTrend(memberId, days) {
    const history = this.wellnessScores.get(memberId) || [];
    const period = days || 7;
    const recent = history.slice(-period);
    if (recent.length === 0) return { trend: 'no-data', scores: [] };
    const avg = recent.reduce((s, e) => s + e.overall, 0) / recent.length;
    const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
    const secondHalf = recent.slice(Math.floor(recent.length / 2));
    const firstAvg = firstHalf.length > 0 ? firstHalf.reduce((s, e) => s + e.overall, 0) / firstHalf.length : 0;
    const secondAvg = secondHalf.length > 0 ? secondHalf.reduce((s, e) => s + e.overall, 0) / secondHalf.length : 0;
    const trend = secondAvg > firstAvg + 5 ? 'improving' : (secondAvg < firstAvg - 5 ? 'declining' : 'stable');
    return { trend, average: Math.round(avg), period, scores: recent };
  }

  // ─── Grocery Management ────────────────────────────────────────────

  addToShoppingList(item) {
    const entry = {
      id: `shop_${Date.now()}`,
      name: item.name,
      quantity: item.quantity || 1,
      unit: item.unit || 'pcs',
      category: item.category || 'other',
      organic: item.organic || this.organicPreference,
      local: item.local || this.localPreference,
      estimatedPrice: item.estimatedPrice || 0,
      purchased: false,
      addedAt: new Date().toISOString()
    };
    this.shoppingList.push(entry);
    return entry;
  }

  markPurchased(itemId, actualPrice) {
    const item = this.shoppingList.find(i => i.id === itemId);
    if (!item) return null;
    item.purchased = true;
    item.actualPrice = actualPrice || item.estimatedPrice;
    this.groceryBudget.spent += item.actualPrice;
    return item;
  }

  getShoppingList(onlyUnpurchased) {
    if (onlyUnpurchased) return this.shoppingList.filter(i => !i.purchased);
    return this.shoppingList;
  }

  getGroceryBudgetStatus() {
    return {
      monthlyBudget: this.groceryBudget.monthly,
      spent: this.groceryBudget.spent,
      remaining: this.groceryBudget.monthly - this.groceryBudget.spent,
      percentUsed: this.groceryBudget.monthly > 0 ? Math.round((this.groceryBudget.spent / this.groceryBudget.monthly) * 100) : 0,
      currency: this.groceryBudget.currency || 'SEK',
      store: this.storePreference
    };
  }

  // ─── Recipe Database ───────────────────────────────────────────────

  getBuiltInRecipes() {
    return NORDIC_RECIPES;
  }

  addCustomRecipe(recipeData) {
    const recipe = {
      id: `custom_${Date.now()}`,
      name: recipeData.name || 'Custom Recipe',
      calories: recipeData.calories || 0,
      protein: recipeData.protein || 0,
      carbs: recipeData.carbs || 0,
      fat: recipeData.fat || 0,
      fiber: recipeData.fiber || 0,
      cookTime: recipeData.cookTime || 30,
      difficulty: recipeData.difficulty || 'medium',
      equipment: recipeData.equipment || [],
      servings: recipeData.servings || 4,
      dietaryType: recipeData.dietaryType || 'omnivore',
      seasonal: recipeData.seasonal || 'all',
      instructions: recipeData.instructions || '',
      ingredients: recipeData.ingredients || [],
      custom: true,
      createdAt: new Date().toISOString()
    };
    this.customRecipes.push(recipe);
    this.log(`Added custom recipe: ${recipe.name}`);
    return recipe;
  }

  searchRecipes(query) {
    const q = (query || '').toLowerCase();
    const allRecipes = [...NORDIC_RECIPES, ...this.customRecipes];
    return allRecipes.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.dietaryType.toLowerCase().includes(q) ||
      r.seasonal.includes(q) ||
      r.difficulty.includes(q)
    );
  }

  getRecipeById(recipeId) {
    return NORDIC_RECIPES.find(r => r.id === recipeId) || this.customRecipes.find(r => r.id === recipeId) || null;
  }

  getRecipeNutritionPerServing(recipeId) {
    const recipe = this.getRecipeById(recipeId);
    if (!recipe) return null;
    return {
      name: recipe.name,
      perServing: {
        calories: Math.round(recipe.calories / recipe.servings),
        protein: Math.round(recipe.protein / recipe.servings),
        carbs: Math.round(recipe.carbs / recipe.servings),
        fat: Math.round(recipe.fat / recipe.servings),
        fiber: Math.round(recipe.fiber / recipe.servings)
      },
      totalServings: recipe.servings
    };
  }

  // ─── Food Waste Prevention ─────────────────────────────────────────

  logFoodWaste(wasteData) {
    const entry = {
      id: `waste_${Date.now()}`,
      itemName: wasteData.itemName || 'unknown',
      weightGrams: wasteData.weightGrams || 0,
      reason: wasteData.reason || 'expired',
      composted: wasteData.composted || false,
      timestamp: new Date().toISOString()
    };
    this.wasteLog.push(entry);
    this.log(`Food waste logged: ${entry.itemName} (${entry.weightGrams}g) — ${entry.reason}`);
    return entry;
  }

  getMonthlyWasteReport(yearMonth) {
    const month = yearMonth || new Date().toISOString().slice(0, 7);
    const monthWaste = this.wasteLog.filter(w => w.timestamp.startsWith(month));
    const totalGrams = monthWaste.reduce((s, w) => s + w.weightGrams, 0);
    const totalKg = parseFloat((totalGrams / 1000).toFixed(2));
    const byReason = {};
    monthWaste.forEach(w => {
      byReason[w.reason] = (byReason[w.reason] || 0) + w.weightGrams;
    });
    const compostedGrams = monthWaste.filter(w => w.composted).reduce((s, w) => s + w.weightGrams, 0);
    return {
      month,
      totalEntries: monthWaste.length,
      totalGrams,
      totalKg,
      goalKg: this.wasteReductionGoalKg,
      underGoal: totalKg <= this.wasteReductionGoalKg,
      byReason,
      compostedGrams,
      compostedPercent: totalGrams > 0 ? Math.round((compostedGrams / totalGrams) * 100) : 0
    };
  }

  getLeftoverRecipeSuggestions() {
    const expiring = this.getExpiringItems(3);
    if (expiring.length === 0) return { message: 'No items expiring soon!', suggestions: [] };
    return {
      message: `${expiring.length} item(s) expiring soon`,
      items: expiring.map(i => i.name),
      suggestions: [
        'Stir-fry with mixed expiring vegetables',
        'Soup or stew from leftover ingredients',
        'Smoothie with expiring fruits',
        'Fried rice with leftover proteins and vegetables'
      ]
    };
  }

  getCompostingReminder() {
    const recentWaste = this.wasteLog.filter(w => {
      const age = Date.now() - new Date(w.timestamp).getTime();
      return age < 7 * 24 * 3600000 && !w.composted;
    });
    if (recentWaste.length > 0) {
      return {
        reminder: true,
        message: `${recentWaste.length} food waste item(s) from this week not composted. Consider composting to reduce environmental impact.`,
        items: recentWaste.map(w => w.itemName)
      };
    }
    return { reminder: false, message: 'All recent waste composted. Great job!' };
  }

  // ─── Fitness Integration ───────────────────────────────────────────

  logActivity(memberId, activityData) {
    const member = this.householdMembers.get(memberId);
    if (!member) return null;
    const type = ACTIVITY_TYPES.includes(activityData.type) ? activityData.type : 'walk';
    const durationMinutes = activityData.durationMinutes || 30;
    const caloriesBurned = Math.round((CALORIE_BURN_PER_HOUR[type] || 300) * (durationMinutes / 60));
    const entry = {
      id: `activity_${Date.now()}`,
      memberId,
      type,
      durationMinutes,
      caloriesBurned,
      timestamp: new Date().toISOString()
    };
    this.activityLogs.push(entry);
    this.log(`Activity logged for ${member.name}: ${type} ${durationMinutes}min (${caloriesBurned} kcal burned)`);
    return entry;
  }

  getNetCalories(memberId, dateStr) {
    const date = dateStr || new Date().toISOString().split('T')[0];
    const dailySummary = this.getDailySummary(memberId, date);
    const activities = this.activityLogs.filter(a => a.memberId === memberId && a.timestamp.startsWith(date));
    const totalBurned = activities.reduce((s, a) => s + a.caloriesBurned, 0);
    return {
      date,
      caloriesConsumed: dailySummary.totals.calories,
      caloriesBurned: totalBurned,
      netCalories: dailySummary.totals.calories - totalBurned,
      target: dailySummary.target
    };
  }

  getExerciseNutritionTiming(memberId) {
    const member = this.householdMembers.get(memberId);
    if (!member) return null;
    return {
      preWorkout: {
        timing: '1-2 hours before',
        suggestion: 'Complex carbs + moderate protein (e.g., oatmeal with berries, whole grain toast with peanut butter)',
        calories: Math.round(member.dailyCalorieTarget * 0.15)
      },
      postWorkout: {
        timing: 'Within 30-60 minutes after',
        suggestion: 'Protein + simple carbs for recovery (e.g., protein shake, chicken with rice, filmjölk bowl)',
        calories: Math.round(member.dailyCalorieTarget * 0.20)
      },
      recoveryNutrition: {
        hydration: 'Drink 500ml water per 30 min exercise',
        protein: `Target ${Math.round(member.weight * 0.3)}g protein post-workout`,
        antiInflammatory: 'Include omega-3 rich foods (salmon, walnuts, flaxseed)'
      }
    };
  }

  // ─── Sleep-Nutrition Correlation ───────────────────────────────────

  logSleep(memberId, sleepData) {
    const entry = {
      id: `sleep_${Date.now()}`,
      memberId,
      date: sleepData.date || new Date().toISOString().split('T')[0],
      bedtime: sleepData.bedtime || '23:00',
      wakeTime: sleepData.wakeTime || '07:00',
      hoursSlept: sleepData.hoursSlept || 7,
      quality: sleepData.quality || 'ok',
      timestamp: new Date().toISOString()
    };
    this.sleepLogs.push(entry);
    return entry;
  }

  getSleepNutritionCorrelation(memberId) {
    const memberSleep = this.sleepLogs.filter(s => s.memberId === memberId);
    const memberMeals = this.mealLogs.filter(m => m.memberId === memberId);
    if (memberSleep.length < 3 || memberMeals.length < 3) {
      return { message: 'Not enough data for correlation analysis. Log at least 3 days of meals and sleep.' };
    }

    const lateMeals = memberMeals.filter(m => {
      const hour = new Date(m.timestamp).getHours();
      return hour >= 21;
    });

    const correlations = {
      lateMealImpact: lateMeals.length > 0 ? 'Late meals detected — may impact sleep quality' : 'Good meal timing — no late meals',
      caffeineReminder: `Avoid caffeine after ${CAFFEINE_CUTOFF_HOUR}:00 for better sleep`,
      eveningMealTiming: `Eat dinner at least ${EVENING_MEAL_HOURS_BEFORE_BED} hours before bedtime`,
      sleepPromotingFoods: TRYPTOPHAN_FOODS.slice(0, 5).join(', '),
      averageSleepHours: parseFloat((memberSleep.reduce((s, e) => s + e.hoursSlept, 0) / memberSleep.length).toFixed(1))
    };

    return correlations;
  }

  getCaffeineCutoffReminder(memberId) {
    const member = this.householdMembers.get(memberId);
    if (!member) return null;
    const now = new Date();
    const hour = now.getHours();
    if (hour >= CAFFEINE_CUTOFF_HOUR - 1 && hour <= CAFFEINE_CUTOFF_HOUR) {
      return {
        reminder: true,
        message: `Last call for caffeine! After ${CAFFEINE_CUTOFF_HOUR}:00, avoid coffee and caffeinated tea for better sleep.`,
        cutoffHour: CAFFEINE_CUTOFF_HOUR
      };
    }
    if (hour > CAFFEINE_CUTOFF_HOUR) {
      return {
        reminder: true,
        message: `Caffeine cutoff has passed (${CAFFEINE_CUTOFF_HOUR}:00). Choose herbal tea or water instead.`,
        cutoffHour: CAFFEINE_CUTOFF_HOUR
      };
    }
    return { reminder: false, message: 'Caffeine is fine at this time.' };
  }

  // ─── Mood-Food Journal ─────────────────────────────────────────────

  logMoodEntry(memberId, entry) {
    const record = {
      id: `mood_${Date.now()}`,
      memberId,
      mood: entry.mood || 'ok',
      energyLevel: entry.energyLevel || 5,
      recentMeal: entry.recentMeal || '',
      notes: entry.notes || '',
      timestamp: new Date().toISOString()
    };
    this.moodJournal.push(record);
    return record;
  }

  getMoodPatterns(memberId) {
    const entries = this.moodJournal.filter(m => m.memberId === memberId);
    if (entries.length < 5) return { message: 'Need more mood entries for pattern detection (at least 5).' };

    const moodCounts = {};
    entries.forEach(e => {
      moodCounts[e.mood] = (moodCounts[e.mood] || 0) + 1;
    });

    const avgEnergy = entries.reduce((s, e) => s + (e.energyLevel || 5), 0) / entries.length;

    const lowEnergyEntries = entries.filter(e => (e.energyLevel || 5) <= 3);
    const potentialTriggers = lowEnergyEntries.map(e => e.recentMeal).filter(Boolean);

    return {
      totalEntries: entries.length,
      moodDistribution: moodCounts,
      averageEnergyLevel: parseFloat(avgEnergy.toFixed(1)),
      potentialSugarCrashFoods: potentialTriggers.length > 0 ? potentialTriggers : ['No patterns detected yet'],
      recommendation: avgEnergy < 5
        ? 'Energy levels are low. Consider more complex carbs and protein-rich meals.'
        : 'Energy levels are good. Keep up balanced eating habits.'
    };
  }

  // ─── Special Occasions ─────────────────────────────────────────────

  addSpecialOccasion(occasionData) {
    const occasion = {
      id: `occasion_${Date.now()}`,
      name: occasionData.name || 'Event',
      date: occasionData.date || new Date().toISOString().split('T')[0],
      type: occasionData.type || 'celebration',
      guestCount: occasionData.guestCount || 0,
      isNordic: NORDIC_CELEBRATIONS.includes(occasionData.name),
      mealPlan: null,
      createdAt: new Date().toISOString()
    };
    this.specialOccasions.push(occasion);
    this.log(`Special occasion added: ${occasion.name} on ${occasion.date}`);
    return occasion;
  }

  getCateringCalculation(guestCount, portionsPerGuest) {
    const guests = guestCount || 10;
    const portions = portionsPerGuest || 3;
    const totalPortions = guests * portions;
    return {
      guests,
      portionsPerGuest: portions,
      totalPortions,
      estimatedMainDish: Math.ceil(totalPortions * 0.4),
      estimatedSideDishes: Math.ceil(totalPortions * 0.35),
      estimatedDessert: Math.ceil(totalPortions * 0.25),
      suggestedRecipes: {
        midsommar: ['Sill (Pickled Herring)', 'Dillstuvade Potatis', 'Jordgubbstårta'],
        jul: ['Janssons Frestelse', 'Köttbullar', 'Prinskorv', 'Pepparkakor', 'Saffransbullar'],
        påsk: ['Laxpudding', 'Ägg', 'Smörgåstårta']
      },
      drinkEstimate: {
        waterLiters: Math.ceil(guests * 0.5),
        otherDrinksLiters: Math.ceil(guests * 0.3)
      }
    };
  }

  getUpcomingOccasions(withinDays) {
    const days = withinDays || 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);
    return this.specialOccasions.filter(o => {
      const oDate = new Date(o.date);
      return oDate >= new Date() && oDate <= cutoff;
    }).sort((a, b) => a.date.localeCompare(b.date));
  }

  // ─── Health Metrics Dashboard ──────────────────────────────────────

  logBloodPressure(memberId, systolic, diastolic) {
    const entry = {
      id: `bp_${Date.now()}`,
      memberId,
      systolic,
      diastolic,
      category: this._classifyBP(systolic, diastolic),
      timestamp: new Date().toISOString()
    };
    this.bloodPressureLogs.push(entry);
    return entry;
  }

  _classifyBP(systolic, diastolic) {
    if (systolic < 120 && diastolic < 80) return 'normal';
    if (systolic < 130 && diastolic < 80) return 'elevated';
    if (systolic < 140 || diastolic < 90) return 'high-stage1';
    return 'high-stage2';
  }

  logBloodSugar(memberId, value, timing) {
    const entry = {
      id: `bs_${Date.now()}`,
      memberId,
      value,
      timing: timing || 'fasting',
      timestamp: new Date().toISOString()
    };
    this.bloodSugarLogs.push(entry);
    return entry;
  }

  logCholesterol(memberId, total, hdl, ldl, triglycerides) {
    const entry = {
      id: `chol_${Date.now()}`,
      memberId,
      total,
      hdl,
      ldl,
      triglycerides,
      ratio: hdl > 0 ? parseFloat((total / hdl).toFixed(1)) : 0,
      timestamp: new Date().toISOString()
    };
    this.cholesterolLogs.push(entry);
    return entry;
  }

  addDoctorVisit(memberId, visitData) {
    const visit = {
      id: `doctor_${Date.now()}`,
      memberId,
      date: visitData.date || new Date().toISOString().split('T')[0],
      doctor: visitData.doctor || '',
      reason: visitData.reason || 'checkup',
      notes: visitData.notes || '',
      nextVisit: visitData.nextVisit || null,
      createdAt: new Date().toISOString()
    };
    this.doctorVisits.push(visit);
    return visit;
  }

  getDoctorVisitReminders() {
    const upcoming = this.doctorVisits.filter(v => {
      if (!v.nextVisit) return false;
      const visitDate = new Date(v.nextVisit);
      const now = new Date();
      const daysUntil = (visitDate - now) / (1000 * 60 * 60 * 24);
      return daysUntil >= 0 && daysUntil <= 14;
    });
    return upcoming.map(v => ({
      memberId: v.memberId,
      doctor: v.doctor,
      date: v.nextVisit,
      reason: v.reason,
      daysUntil: Math.ceil((new Date(v.nextVisit) - new Date()) / (1000 * 60 * 60 * 24))
    }));
  }

  getHealthDashboard(memberId) {
    const member = this.householdMembers.get(memberId);
    if (!member) return null;
    const metrics = this.healthMetrics.get(memberId) || {};
    const recentBP = this.bloodPressureLogs.filter(b => b.memberId === memberId).slice(-5);
    const recentBS = this.bloodSugarLogs.filter(b => b.memberId === memberId).slice(-5);
    const recentChol = this.cholesterolLogs.filter(c => c.memberId === memberId).slice(-3);
    const visits = this.doctorVisits.filter(v => v.memberId === memberId);

    return {
      member: { name: member.name, age: member.age, bmi: member.bmi, weight: member.weight, height: member.height },
      weightTrend: (metrics.weightHistory || []).slice(-10),
      bmiHistory: (metrics.bmiHistory || []).slice(-10),
      bloodPressure: recentBP,
      bloodSugar: recentBS,
      cholesterol: recentChol,
      doctorVisits: visits.slice(-5),
      upcomingVisits: this.getDoctorVisitReminders().filter(v => v.memberId === memberId)
    };
  }

  // ─── Family Cooking ────────────────────────────────────────────────

  assignCookingDuty(memberId, day) {
    const member = this.householdMembers.get(memberId);
    if (!member) return null;
    const duties = this.cookingDuties.get(day) || [];
    duties.push({ memberId, memberName: member.name, assignedAt: new Date().toISOString() });
    this.cookingDuties.set(day, duties);
    this.log(`Cooking duty assigned: ${member.name} on ${day}`);
    return { day, assignedTo: member.name };
  }

  getCookingDutyRoster() {
    const roster = {};
    for (const day of DAYS_OF_WEEK) {
      roster[day] = this.cookingDuties.get(day) || [{ memberId: null, memberName: 'Unassigned' }];
    }
    return roster;
  }

  getKidFriendlyRecipes() {
    return NORDIC_RECIPES.filter(r =>
      r.difficulty === 'easy' &&
      r.cookTime <= 30 &&
      !r.name.toLowerCase().includes('herring') &&
      !r.name.toLowerCase().includes('blood')
    );
  }

  getCookingSkillProgression(memberId) {
    const member = this.householdMembers.get(memberId);
    if (!member) return null;
    const levels = [
      { level: 1, title: 'Beginner', skills: 'Boiling water, simple sandwiches' },
      { level: 2, title: 'Novice', skills: 'Pasta, scrambled eggs, salads' },
      { level: 3, title: 'Apprentice', skills: 'Pancakes, simple soups, basic baking' },
      { level: 4, title: 'Home Cook', skills: 'Stews, roasting, bread baking' },
      { level: 5, title: 'Skilled Cook', skills: 'Sauces, multi-course meals, pastries' },
      { level: 6, title: 'Advanced', skills: 'Complex dishes, fermentation, curing' },
      { level: 7, title: 'Expert', skills: 'Professional techniques, molecular gastronomy' },
      { level: 8, title: 'Master Cook', skills: 'Full menu design, catering' },
      { level: 9, title: 'Chef', skills: 'Restaurant-quality, international cuisines' },
      { level: 10, title: 'Master Chef', skills: 'Innovation, mentoring, recipe development' }
    ];
    const current = levels.find(l => l.level === member.cookingSkillLevel) || levels[0];
    const next = levels.find(l => l.level === member.cookingSkillLevel + 1);
    return {
      memberId,
      memberName: member.name,
      currentLevel: current,
      nextLevel: next || { level: 10, title: 'Maximum level reached', skills: 'N/A' },
      suggestedRecipes: NORDIC_RECIPES.filter(r => {
        if (member.cookingSkillLevel <= 3) return r.difficulty === 'easy';
        if (member.cookingSkillLevel <= 6) return r.difficulty === 'easy' || r.difficulty === 'medium';
        return true;
      }).slice(0, 5)
    };
  }

  estimateMealPrepTime(recipeId, memberCookingSkill) {
    const recipe = this.getRecipeById(recipeId);
    if (!recipe) return null;
    const skillFactor = Math.max(0.6, 1.5 - (memberCookingSkill || 1) * 0.1);
    const adjustedTime = Math.round(recipe.cookTime * skillFactor);
    return {
      recipe: recipe.name,
      baseCookTime: recipe.cookTime,
      adjustedTime,
      skillLevel: memberCookingSkill || 1,
      cleanupEstimate: Math.round(adjustedTime * 0.3),
      totalEstimate: adjustedTime + Math.round(adjustedTime * 0.3)
    };
  }

  getCleanupRoster(day) {
    const duties = this.cookingDuties.get(day) || [];
    const members = this.getAllMembers();
    const cookers = duties.map(d => d.memberId);
    const cleaners = members.filter(m => !cookers.includes(m.id));
    return {
      day,
      cooks: duties.map(d => d.memberName),
      cleanupCrew: cleaners.length > 0 ? cleaners.map(m => m.name) : ['Everyone helps!']
    };
  }

  // ─── Monitoring Cycle ──────────────────────────────────────────────

  _startMonitoringCycle() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    this.monitoringInterval = setInterval(() => {
      this._runMonitoringChecks();
    }, MONITORING_INTERVAL_MS);
    this.log('Monitoring cycle started (every 5 minutes)');
  }

  _runMonitoringChecks() {
    try {
      const alerts = [];

      // Check hydration reminders for all members
      for (const [memberId] of this.householdMembers) {
        const reminder = this.getHydrationReminder(memberId);
        if (reminder) alerts.push({ type: 'hydration', ...reminder });
      }

      // Check meal time reminders
      const hour = new Date().getHours();
      const mealTimeHours = { breakfast: 8, lunch: 12, dinner: 18, snack: 15 };
      for (const [mealType, mealHour] of Object.entries(mealTimeHours)) {
        if (hour === mealHour) {
          alerts.push({ type: 'meal-time', mealType, message: `Time for ${mealType}!` });
        }
      }

      // Check supplement schedules
      for (const [memberId] of this.supplementSchedules) {
        const reminders = this.getSupplementReminders(memberId);
        if (reminders.length > 0) {
          alerts.push({ type: 'supplement', memberId, supplements: reminders });
        }
      }

      // Check expiring items
      const expiring = this.getExpiringItems(EXPIRY_WARNING_DAYS);
      if (expiring.length > 0) {
        alerts.push({ type: 'expiry', count: expiring.length, items: expiring.map(i => ({ name: i.name, daysUntilExpiry: i.daysUntilExpiry })) });
      }

      // Water filter check
      const filterStatus = this.getWaterFilterStatus();
      if (filterStatus.replacementNeeded) {
        alerts.push({ type: 'water-filter', message: 'Water filter replacement needed', daysRemaining: filterStatus.daysRemaining });
      }

      // Caffeine cutoff
      if (hour >= CAFFEINE_CUTOFF_HOUR - 1 && hour <= CAFFEINE_CUTOFF_HOUR) {
        alerts.push({ type: 'caffeine', message: `Caffeine cutoff approaching at ${CAFFEINE_CUTOFF_HOUR}:00` });
      }

      if (alerts.length > 0) {
        this.log(`Monitoring check: ${alerts.length} alert(s) generated`);
      }

      return alerts;
    } catch (err) {
      this.error(`Monitoring check failed: ${err.message}`);
      return [];
    }
  }

  // ─── Statistics ────────────────────────────────────────────────────

  getStatistics() {
    const members = this.getAllMembers();
    const totalMeals = this.mealLogs.length;
    const totalHydrationLogs = this.hydrationLogs.length;
    const totalActivities = this.activityLogs.length;
    const totalWasteEntries = this.wasteLog.length;
    const totalWasteGrams = this.wasteLog.reduce((s, w) => s + w.weightGrams, 0);
    const totalRecipes = NORDIC_RECIPES.length + this.customRecipes.length;
    const fridgeItems = this.fridgeInventory.length;
    const pantryItems = this.pantryInventory.length;
    const expiringItems = this.getExpiringItems(EXPIRY_WARNING_DAYS).length;
    const shoppingListItems = this.shoppingList.filter(i => !i.purchased).length;
    const upcomingOccasions = this.getUpcomingOccasions(30).length;
    const doctorReminders = this.getDoctorVisitReminders().length;

    const memberStats = members.map(m => {
      const wellness = this.wellnessScores.get(m.id) || [];
      const lastScore = wellness.length > 0 ? wellness[wellness.length - 1] : null;
      return {
        name: m.name,
        bmi: m.bmi,
        dietaryType: m.dietaryType,
        healthGoal: m.healthGoal,
        lastWellnessScore: lastScore ? lastScore.overall : null,
        supplementCount: (this.supplementSchedules.get(m.id) || []).length,
        fastingProtocol: m.fastingProtocol
      };
    });

    return {
      initialized: this.initialized,
      householdMembers: members.length,
      maxMembers: MAX_HOUSEHOLD_MEMBERS,
      memberStats,
      nutrition: {
        totalMealsLogged: totalMeals,
        totalHydrationLogs,
        mealPlansGenerated: this.mealPlans.size
      },
      kitchen: {
        fridgeItems,
        pantryItems,
        expiringItems,
        shoppingListPending: shoppingListItems,
        totalRecipes,
        builtInRecipes: NORDIC_RECIPES.length,
        customRecipes: this.customRecipes.length
      },
      fitness: {
        totalActivities,
        sleepLogsCount: this.sleepLogs.length
      },
      wasteManagement: {
        totalEntries: totalWasteEntries,
        totalWasteGrams,
        totalWasteKg: parseFloat((totalWasteGrams / 1000).toFixed(2)),
        goalKg: this.wasteReductionGoalKg
      },
      wellness: {
        moodJournalEntries: this.moodJournal.length,
        specialOccasions: this.specialOccasions.length,
        upcomingOccasions
      },
      health: {
        bloodPressureLogs: this.bloodPressureLogs.length,
        bloodSugarLogs: this.bloodSugarLogs.length,
        cholesterolLogs: this.cholesterolLogs.length,
        doctorVisitReminders: doctorReminders
      },
      grocery: this.getGroceryBudgetStatus(),
      waterFilter: this.getWaterFilterStatus(),
      monitoringActive: this.monitoringInterval !== null,
      monitoringIntervalMs: MONITORING_INTERVAL_MS
    };
  }

  // ─── Logging ───────────────────────────────────────────────────────

  log(msg) {
    if (this.homey && typeof this.homey.log === 'function') {
      this.homey.log(`[Nutrition] ${msg}`);
    } else {
      console.log(`[Nutrition] ${msg}`);
    }
  }

  error(msg) {
    if (this.homey && typeof this.homey.error === 'function') {
      this.homey.error(`[Nutrition] ${msg}`);
    } else {
      console.error(`[Nutrition] ${msg}`);
    }
  }

  // ─── Cleanup ───────────────────────────────────────────────────────

  destroy() {
    this.log('Destroying HomeNutritionWellnessSystem...');
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.householdMembers.clear();
    this.mealPlans.clear();
    this.mealLogs = [];
    this.hydrationLogs = [];
    this.supplementSchedules.clear();
    this.supplementInventory = [];
    this.fastingTrackers.clear();
    this.fridgeInventory = [];
    this.pantryInventory = [];
    this.shoppingList = [];
    this.customRecipes = [];
    this.activityLogs = [];
    this.sleepLogs = [];
    this.moodJournal = [];
    this.healthMetrics.clear();
    this.wasteLog = [];
    this.cookingDuties.clear();
    this.specialOccasions = [];
    this.wellnessScores.clear();
    this.scaleReadings = [];
    this.bloodPressureLogs = [];
    this.bloodSugarLogs = [];
    this.cholesterolLogs = [];
    this.doctorVisits = [];
    this.initialized = false;
    this.log('HomeNutritionWellnessSystem destroyed');
  }
}

module.exports = HomeNutritionWellnessSystem;
