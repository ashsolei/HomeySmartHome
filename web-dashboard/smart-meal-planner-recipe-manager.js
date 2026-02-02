'use strict';

/**
 * Smart Meal Planner & Recipe Manager
 * Intelligent meal planning and recipe management
 */
class SmartMealPlannerRecipeManager {
  constructor(app) {
    this.app = app;
    this.recipes = new Map();
    this.mealPlans = new Map();
    this.inventory = new Map();
    this.shoppingList = [];
    this.dietaryProfiles = new Map();
    this.mealHistory = [];
    this.nutritionGoals = new Map();
  }

  async initialize() {
    await this.setupRecipes();
    await this.setupDietaryProfiles();
    await this.setupInventory();
    await this.setupNutritionGoals();
    await this.generateWeeklyPlan();
    
    this.startMonitoring();
  }

  // ============================================
  // RECIPES
  // ============================================

  async setupRecipes() {
    const recipes = [
      {
        id: 'recipe_1',
        name: 'Köttbullar med gräddsås',
        category: 'huvudrätt',
        cuisine: 'swedish',
        difficulty: 'medium',
        prepTime: 20,  // minutes
        cookTime: 30,
        servings: 4,
        ingredients: [
          { name: 'nötfärs', amount: 500, unit: 'g' },
          { name: 'ägg', amount: 1, unit: 'st' },
          { name: 'ströbröd', amount: 100, unit: 'ml' },
          { name: 'mjölk', amount: 100, unit: 'ml' },
          { name: 'lök', amount: 1, unit: 'st' },
          { name: 'grädde', amount: 300, unit: 'ml' },
          { name: 'potatis', amount: 800, unit: 'g' }
        ],
        nutrition: {
          calories: 650,
          protein: 32,
          carbs: 48,
          fat: 35,
          fiber: 4
        },
        tags: ['swedish', 'classic', 'family'],
        rating: 4.8,
        timesCooked: 12
      },
      {
        id: 'recipe_2',
        name: 'Laxpasta med spenat',
        category: 'huvudrätt',
        cuisine: 'italian',
        difficulty: 'easy',
        prepTime: 10,
        cookTime: 20,
        servings: 4,
        ingredients: [
          { name: 'pasta', amount: 400, unit: 'g' },
          { name: 'lax', amount: 400, unit: 'g' },
          { name: 'spenat', amount: 200, unit: 'g' },
          { name: 'grädde', amount: 200, unit: 'ml' },
          { name: 'vitlök', amount: 2, unit: 'klyftor' },
          { name: 'citron', amount: 1, unit: 'st' }
        ],
        nutrition: {
          calories: 580,
          protein: 38,
          carbs: 52,
          fat: 22,
          fiber: 5
        },
        tags: ['quick', 'healthy', 'omega3'],
        rating: 4.6,
        timesCooked: 8
      },
      {
        id: 'recipe_3',
        name: 'Kycklingwok med grönsaker',
        category: 'huvudrätt',
        cuisine: 'asian',
        difficulty: 'easy',
        prepTime: 15,
        cookTime: 15,
        servings: 4,
        ingredients: [
          { name: 'kycklingfilé', amount: 600, unit: 'g' },
          { name: 'broccoli', amount: 300, unit: 'g' },
          { name: 'paprika', amount: 2, unit: 'st' },
          { name: 'morot', amount: 2, unit: 'st' },
          { name: 'sojasås', amount: 60, unit: 'ml' },
          { name: 'ingefära', amount: 20, unit: 'g' },
          { name: 'ris', amount: 300, unit: 'g' }
        ],
        nutrition: {
          calories: 520,
          protein: 42,
          carbs: 58,
          fat: 12,
          fiber: 6
        },
        tags: ['quick', 'healthy', 'asian'],
        rating: 4.7,
        timesCooked: 15
      },
      {
        id: 'recipe_4',
        name: 'Vegetarisk lasagne',
        category: 'huvudrätt',
        cuisine: 'italian',
        difficulty: 'medium',
        prepTime: 30,
        cookTime: 45,
        servings: 6,
        ingredients: [
          { name: 'lasagneplattor', amount: 12, unit: 'st' },
          { name: 'linser', amount: 300, unit: 'g' },
          { name: 'tomatsås', amount: 500, unit: 'ml' },
          { name: 'spenat', amount: 300, unit: 'g' },
          { name: 'ricotta', amount: 250, unit: 'g' },
          { name: 'mozzarella', amount: 200, unit: 'g' },
          { name: 'parmesanost', amount: 100, unit: 'g' }
        ],
        nutrition: {
          calories: 480,
          protein: 24,
          carbs: 54,
          fat: 18,
          fiber: 8
        },
        tags: ['vegetarian', 'protein', 'family'],
        rating: 4.5,
        timesCooked: 6
      },
      {
        id: 'recipe_5',
        name: 'Overnight oats med bär',
        category: 'frukost',
        cuisine: 'scandinavian',
        difficulty: 'easy',
        prepTime: 5,
        cookTime: 0,
        servings: 2,
        ingredients: [
          { name: 'havregryn', amount: 200, unit: 'ml' },
          { name: 'yoghurt', amount: 300, unit: 'ml' },
          { name: 'mjölk', amount: 200, unit: 'ml' },
          { name: 'bär', amount: 200, unit: 'g' },
          { name: 'honung', amount: 30, unit: 'ml' },
          { name: 'chiafron', amount: 20, unit: 'g' }
        ],
        nutrition: {
          calories: 380,
          protein: 14,
          carbs: 62,
          fat: 8,
          fiber: 10
        },
        tags: ['breakfast', 'healthy', 'quick'],
        rating: 4.9,
        timesCooked: 20
      },
      {
        id: 'recipe_6',
        name: 'Tacos med köttfärs',
        category: 'huvudrätt',
        cuisine: 'mexican',
        difficulty: 'easy',
        prepTime: 10,
        cookTime: 15,
        servings: 4,
        ingredients: [
          { name: 'nötfärs', amount: 500, unit: 'g' },
          { name: 'tacoskal', amount: 8, unit: 'st' },
          { name: 'tomat', amount: 3, unit: 'st' },
          { name: 'sallad', amount: 200, unit: 'g' },
          { name: 'rödlök', amount: 1, unit: 'st' },
          { name: 'gräddfil', amount: 200, unit: 'ml' },
          { name: 'ost', amount: 150, unit: 'g' }
        ],
        nutrition: {
          calories: 550,
          protein: 36,
          carbs: 42,
          fat: 26,
          fiber: 6
        },
        tags: ['quick', 'family', 'favorite'],
        rating: 4.8,
        timesCooked: 18
      }
    ];

    for (const recipe of recipes) {
      this.recipes.set(recipe.id, {
        ...recipe,
        lastCooked: null,
        favoriteOf: []
      });
    }
  }

  async searchRecipes(query) {
    const results = [];

    for (const [recipeId, recipe] of this.recipes) {
      let score = 0;

      // Match name
      if (recipe.name.toLowerCase().includes(query.toLowerCase())) {
        score += 10;
      }

      // Match tags
      for (const tag of recipe.tags) {
        if (tag.toLowerCase().includes(query.toLowerCase())) {
          score += 5;
        }
      }

      // Match cuisine
      if (recipe.cuisine.toLowerCase().includes(query.toLowerCase())) {
        score += 7;
      }

      // Match ingredients
      for (const ingredient of recipe.ingredients) {
        if (ingredient.name.toLowerCase().includes(query.toLowerCase())) {
          score += 3;
        }
      }

      if (score > 0) {
        results.push({
          recipe,
          score
        });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(r => r.recipe);
  }

  // ============================================
  // MEAL PLANNING
  // ============================================

  async generateWeeklyPlan() {
    console.log('📅 Generating weekly meal plan...');

    const weekStart = Date.now();
    const plan = {
      id: `plan_${weekStart}`,
      startDate: weekStart,
      endDate: weekStart + 7 * 24 * 60 * 60 * 1000,
      meals: []
    };

    const days = ['måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag', 'söndag'];
    const usedRecipes = new Set();

    for (let day = 0; day < 7; day++) {
      const date = weekStart + day * 24 * 60 * 60 * 1000;

      // Select recipe for dinner (avoid repeating)
      const availableRecipes = Array.from(this.recipes.values())
        .filter(r => !usedRecipes.has(r.id) && r.category === 'huvudrätt');

      if (availableRecipes.length > 0) {
        // Prioritize by rating and variety
        const selected = availableRecipes.sort((a, b) => {
          const aScore = a.rating - (a.timesCooked * 0.01); // Slight penalty for frequently cooked
          const bScore = b.rating - (b.timesCooked * 0.01);
          return bScore - aScore;
        })[0];

        plan.meals.push({
          day: days[day],
          date,
          mealType: 'dinner',
          recipeId: selected.id,
          recipeName: selected.name,
          servings: 4
        });

        usedRecipes.add(selected.id);

        console.log(`  ${days[day]}: ${selected.name}`);
      }
    }

    this.mealPlans.set(plan.id, plan);

    // Generate shopping list
    await this.generateShoppingList(plan.id);

    return plan;
  }

  async generateShoppingList(planId) {
    console.log('🛒 Generating shopping list...');

    const plan = this.mealPlans.get(planId);
    
    if (!plan) {
      return { success: false, error: 'Plan not found' };
    }

    const neededIngredients = new Map();

    // Collect all ingredients
    for (const meal of plan.meals) {
      const recipe = this.recipes.get(meal.recipeId);
      
      if (recipe) {
        for (const ingredient of recipe.ingredients) {
          const key = ingredient.name;
          const amount = ingredient.amount * (meal.servings / recipe.servings);

          if (neededIngredients.has(key)) {
            neededIngredients.get(key).amount += amount;
          } else {
            neededIngredients.set(key, {
              name: ingredient.name,
              amount,
              unit: ingredient.unit,
              category: this.categorizeIngredient(ingredient.name)
            });
          }
        }
      }
    }

    // Check inventory and subtract what we have
    const shoppingList = [];

    for (const [name, needed] of neededIngredients) {
      const inInventory = this.inventory.get(name);
      
      let amountToBuy = needed.amount;
      
      if (inInventory) {
        amountToBuy -= inInventory.amount;
      }

      if (amountToBuy > 0) {
        shoppingList.push({
          name: needed.name,
          amount: Math.ceil(amountToBuy),
          unit: needed.unit,
          category: needed.category,
          purchased: false
        });

        console.log(`  ${needed.name}: ${Math.ceil(amountToBuy)} ${needed.unit}`);
      }
    }

    this.shoppingList = shoppingList;

    return shoppingList;
  }

  categorizeIngredient(name) {
    const categories = {
      'Kött & Fisk': ['nötfärs', 'lax', 'kycklingfilé', 'köttfärs'],
      'Mejeri': ['mjölk', 'grädde', 'yoghurt', 'ost', 'ricotta', 'mozzarella', 'parmesanost', 'gräddfil'],
      'Grönsaker': ['spenat', 'broccoli', 'paprika', 'morot', 'tomat', 'sallad', 'rödlök', 'lök'],
      'Torrvaror': ['pasta', 'ris', 'linser', 'havregryn', 'ströbröd', 'lasagneplattor'],
      'Kryddor': ['vitlök', 'ingefära', 'sojasås'],
      'Frukt & Bär': ['bär', 'citron'],
      'Övrigt': []
    };

    for (const [category, items] of Object.entries(categories)) {
      if (items.includes(name)) {
        return category;
      }
    }

    return 'Övrigt';
  }

  // ============================================
  // INVENTORY
  // ============================================

  async setupInventory() {
    const items = [
      { name: 'mjölk', amount: 2000, unit: 'ml', expiryDate: Date.now() + 7 * 24 * 60 * 60 * 1000 },
      { name: 'ägg', amount: 12, unit: 'st', expiryDate: Date.now() + 14 * 24 * 60 * 60 * 1000 },
      { name: 'potatis', amount: 2000, unit: 'g', expiryDate: Date.now() + 21 * 24 * 60 * 60 * 1000 },
      { name: 'ris', amount: 1000, unit: 'g', expiryDate: Date.now() + 365 * 24 * 60 * 60 * 1000 },
      { name: 'pasta', amount: 500, unit: 'g', expiryDate: Date.now() + 365 * 24 * 60 * 60 * 1000 }
    ];

    for (const item of items) {
      this.inventory.set(item.name, item);
    }
  }

  async addToInventory(name, amount, unit, expiryDate) {
    const existing = this.inventory.get(name);

    if (existing) {
      existing.amount += amount;
      existing.expiryDate = expiryDate || existing.expiryDate;
    } else {
      this.inventory.set(name, {
        name,
        amount,
        unit,
        expiryDate: expiryDate || Date.now() + 30 * 24 * 60 * 60 * 1000,
        addedDate: Date.now()
      });
    }

    console.log(`✅ Added to inventory: ${name} (${amount} ${unit})`);
  }

  async checkExpiringItems() {
    const expiringItems = [];
    const threeDays = 3 * 24 * 60 * 60 * 1000;

    for (const [name, item] of this.inventory) {
      if (item.expiryDate - Date.now() <= threeDays) {
        expiringItems.push({
          name: item.name,
          daysUntilExpiry: Math.ceil((item.expiryDate - Date.now()) / (24 * 60 * 60 * 1000)),
          amount: item.amount,
          unit: item.unit
        });
      }
    }

    return expiringItems;
  }

  // ============================================
  // DIETARY PROFILES
  // ============================================

  async setupDietaryProfiles() {
    const profiles = [
      {
        id: 'anna',
        name: 'Anna',
        restrictions: [],
        preferences: ['healthy', 'omega3'],
        dislikes: [],
        calories: 2000
      },
      {
        id: 'erik',
        name: 'Erik',
        restrictions: [],
        preferences: ['protein', 'classic'],
        dislikes: ['vegetarian'],
        calories: 2500
      },
      {
        id: 'emma',
        name: 'Emma',
        restrictions: [],
        preferences: ['quick', 'favorite'],
        dislikes: ['spicy'],
        calories: 1600
      },
      {
        id: 'oscar',
        name: 'Oscar',
        restrictions: [],
        preferences: ['asian', 'quick'],
        dislikes: [],
        calories: 1800
      }
    ];

    for (const profile of profiles) {
      this.dietaryProfiles.set(profile.id, profile);
    }
  }

  async recommendRecipe(userId) {
    const profile = this.dietaryProfiles.get(userId);
    
    if (!profile) {
      return null;
    }

    const candidates = Array.from(this.recipes.values()).map(recipe => {
      let score = recipe.rating * 10;

      // Match preferences
      for (const pref of profile.preferences) {
        if (recipe.tags.includes(pref)) {
          score += 20;
        }
      }

      // Avoid dislikes
      for (const dislike of profile.dislikes) {
        if (recipe.tags.includes(dislike)) {
          score -= 50;
        }
      }

      // Calorie match
      const calorieDiff = Math.abs(recipe.nutrition.calories - profile.calories / 3);
      score -= calorieDiff * 0.1;

      return { recipe, score };
    });

    candidates.sort((a, b) => b.score - a.score);

    return candidates[0]?.recipe || null;
  }

  // ============================================
  // NUTRITION TRACKING
  // ============================================

  async setupNutritionGoals() {
    const goals = [
      {
        id: 'family_daily',
        name: 'Familj dagligt',
        targetCalories: 7900,  // 4 persons
        targetProtein: 280,    // grams
        targetCarbs: 950,
        targetFat: 260,
        targetFiber: 100
      }
    ];

    for (const goal of goals) {
      this.nutritionGoals.set(goal.id, {
        ...goal,
        currentCalories: 0,
        currentProtein: 0,
        currentCarbs: 0,
        currentFat: 0,
        currentFiber: 0
      });
    }
  }

  async trackMeal(recipeId, servings) {
    const recipe = this.recipes.get(recipeId);
    
    if (!recipe) {
      return { success: false, error: 'Recipe not found' };
    }

    const multiplier = servings / recipe.servings;

    this.mealHistory.push({
      timestamp: Date.now(),
      recipeId,
      recipeName: recipe.name,
      servings,
      nutrition: {
        calories: recipe.nutrition.calories * multiplier,
        protein: recipe.nutrition.protein * multiplier,
        carbs: recipe.nutrition.carbs * multiplier,
        fat: recipe.nutrition.fat * multiplier,
        fiber: recipe.nutrition.fiber * multiplier
      }
    });

    // Update goals
    const goal = this.nutritionGoals.get('family_daily');
    
    if (goal) {
      goal.currentCalories += recipe.nutrition.calories * multiplier;
      goal.currentProtein += recipe.nutrition.protein * multiplier;
      goal.currentCarbs += recipe.nutrition.carbs * multiplier;
      goal.currentFat += recipe.nutrition.fat * multiplier;
      goal.currentFiber += recipe.nutrition.fiber * multiplier;
    }

    console.log(`📊 Tracked: ${recipe.name} (${Math.round(recipe.nutrition.calories * multiplier)} kcal)`);

    return { success: true };
  }

  async getNutritionSummary(days = 7) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const recentMeals = this.mealHistory.filter(m => m.timestamp >= cutoff);

    const summary = {
      totalCalories: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0,
      totalFiber: 0,
      meals: recentMeals.length
    };

    for (const meal of recentMeals) {
      summary.totalCalories += meal.nutrition.calories;
      summary.totalProtein += meal.nutrition.protein;
      summary.totalCarbs += meal.nutrition.carbs;
      summary.totalFat += meal.nutrition.fat;
      summary.totalFiber += meal.nutrition.fiber;
    }

    // Daily averages
    summary.avgCaloriesPerDay = (summary.totalCalories / days).toFixed(0);
    summary.avgProteinPerDay = (summary.totalProtein / days).toFixed(0);

    return summary;
  }

  // ============================================
  // MONITORING
  // ============================================

  startMonitoring() {
    // Check expiring items daily
    setInterval(() => {
      this.checkExpiringItems().then(items => {
        if (items.length > 0) {
          console.log(`⚠️ ${items.length} items expiring soon`);
        }
      });
    }, 24 * 60 * 60 * 1000);

    // Generate new weekly plan on Sundays
    setInterval(() => {
      const day = new Date().getDay();
      if (day === 0) { // Sunday
        this.generateWeeklyPlan();
      }
    }, 24 * 60 * 60 * 1000);

    console.log('🍽️ Meal Planner active');
  }

  // ============================================
  // REPORTING
  // ============================================

  getMealPlannerOverview() {
    const currentPlan = Array.from(this.mealPlans.values())
      .sort((a, b) => b.startDate - a.startDate)[0];

    return {
      recipes: this.recipes.size,
      currentPlan: currentPlan ? currentPlan.meals.length + ' meals' : 'None',
      shoppingList: this.shoppingList.length + ' items',
      inventory: this.inventory.size + ' items',
      dietaryProfiles: this.dietaryProfiles.size,
      mealHistory: this.mealHistory.length
    };
  }

  getCurrentWeekPlan() {
    const currentPlan = Array.from(this.mealPlans.values())
      .sort((a, b) => b.startDate - a.startDate)[0];

    if (!currentPlan) {
      return [];
    }

    return currentPlan.meals.map(m => ({
      day: m.day,
      meal: m.recipeName,
      servings: m.servings
    }));
  }

  getShoppingList() {
    return this.shoppingList.map(item => ({
      name: item.name,
      amount: item.amount + ' ' + item.unit,
      category: item.category,
      purchased: item.purchased ? '✅' : '⬜'
    }));
  }

  getTopRecipes(limit = 5) {
    return Array.from(this.recipes.values())
      .sort((a, b) => b.timesCooked - a.timesCooked)
      .slice(0, limit)
      .map(r => ({
        name: r.name,
        rating: r.rating + '⭐',
        timesCooked: r.timesCooked,
        prepTime: r.prepTime + r.cookTime + ' min'
      }));
  }

  getExpiringItems() {
    return this.checkExpiringItems().then(items => 
      items.map(i => ({
        name: i.name,
        amount: i.amount + ' ' + i.unit,
        expiresIn: i.daysUntilExpiry + ' days'
      }))
    );
  }
}

module.exports = SmartMealPlannerRecipeManager;
