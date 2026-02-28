'use strict';

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertType } = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');

/* ── timer-leak prevention ─────────────────────────────────────────── */
const _origSetTimeout = global.setTimeout;
const _origSetInterval = global.setInterval;
const activeHandles = [];
global.setTimeout = (...a) => { const id = _origSetTimeout(...a); activeHandles.push({ type: 'timeout', id }); return id; };
global.setInterval = (...a) => { const id = _origSetInterval(...a); activeHandles.push({ type: 'interval', id }); return id; };
function cleanup(sys) {
  try { if (sys && typeof sys.destroy === 'function') sys.destroy(); } catch (_) {}
  while (activeHandles.length > 0) {
    const h = activeHandles.pop();
    if (h.type === 'timeout') clearTimeout(h.id); else clearInterval(h.id);
  }
}

const HomeNutritionWellnessSystem = require('../lib/HomeNutritionWellnessSystem');

/* ================================================================== */
/*  HomeNutritionWellnessSystem – test suite                          */
/* ================================================================== */

describe('HomeNutritionWellnessSystem — constructor & init', () => {
  it('instantiates without errors', () => {
    const sys = new HomeNutritionWellnessSystem(createMockHomey());
    assert(sys, 'should create instance');
    cleanup(sys);
  });

  it('starts uninitialised', () => {
    const sys = new HomeNutritionWellnessSystem(createMockHomey());
    assertEqual(sys.initialized, false);
    assertEqual(sys.householdMembers.size, 0);
    cleanup(sys);
  });

  it('initialize sets flag and loads defaults', async () => {
    const sys = new HomeNutritionWellnessSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.initialized, true);
    assertEqual(sys.groceryBudget.monthly, 6000);
    cleanup(sys);
  });

  it('destroy clears all data', async () => {
    const sys = new HomeNutritionWellnessSystem(createMockHomey());
    await sys.initialize();
    sys.addMember({ name: 'Test', weight: 70, height: 170 });
    sys.destroy();
    assertEqual(sys.householdMembers.size, 0);
    assertEqual(sys.mealLogs.length, 0);
    cleanup(sys);
  });
});

describe('HomeNutritionWellnessSystem — member management', () => {
  it('addMember creates member with BMI', async () => {
    const sys = new HomeNutritionWellnessSystem(createMockHomey());
    await sys.initialize();
    const member = sys.addMember({ name: 'Erik', weight: 80, height: 180, age: 35 });
    assert(member, 'should return member');
    assertEqual(member.name, 'Erik');
    assertType(member.bmi, 'number');
    assert(member.bmi > 0, 'BMI should be positive');
    cleanup(sys);
  });

  it('addMember respects max limit', async () => {
    const sys = new HomeNutritionWellnessSystem(createMockHomey());
    await sys.initialize();
    for (let i = 0; i < 8; i++) {
      sys.addMember({ name: `M${i}`, weight: 70, height: 170 });
    }
    assertEqual(sys.addMember({ name: 'Extra', weight: 70, height: 170 }), null);
    cleanup(sys);
  });

  it('updateMember modifies fields', async () => {
    const sys = new HomeNutritionWellnessSystem(createMockHomey());
    await sys.initialize();
    const member = sys.addMember({ name: 'Erik', weight: 80, height: 180 });
    const updated = sys.updateMember(member.id, { weight: 78, name: 'Erik S' });
    assertEqual(updated.weight, 78);
    assertEqual(updated.name, 'Erik S');
    cleanup(sys);
  });

  it('updateMember returns null for unknown id', async () => {
    const sys = new HomeNutritionWellnessSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.updateMember('nonexistent', { name: 'X' }), null);
    cleanup(sys);
  });

  it('removeMember removes and cleans up', async () => {
    const sys = new HomeNutritionWellnessSystem(createMockHomey());
    await sys.initialize();
    const member = sys.addMember({ name: 'Erik', weight: 80, height: 180 });
    const result = sys.removeMember(member.id);
    assertEqual(result, true);
    assertEqual(sys.householdMembers.size, 0);
    cleanup(sys);
  });

  it('getMember and getAllMembers work', async () => {
    const sys = new HomeNutritionWellnessSystem(createMockHomey());
    await sys.initialize();
    const m = sys.addMember({ name: 'A', weight: 70, height: 170 });
    sys.addMember({ name: 'B', weight: 65, height: 160 });
    assertEqual(sys.getMember(m.id).name, 'A');
    assertEqual(sys.getAllMembers().length, 2);
    cleanup(sys);
  });
});

describe('HomeNutritionWellnessSystem — meal plans & logging', () => {
  it('generateWeeklyMealPlan creates a plan', async () => {
    const sys = new HomeNutritionWellnessSystem(createMockHomey());
    await sys.initialize();
    const member = sys.addMember({ name: 'Erik', weight: 80, height: 180, dietaryType: 'omnivore' });
    const planEntry = sys.generateWeeklyMealPlan(member.id);
    assert(planEntry, 'should return plan entry');
    assert(planEntry.plan.monday, 'should have monday in plan');
    cleanup(sys);
  });

  it('logMeal records a meal', async () => {
    const sys = new HomeNutritionWellnessSystem(createMockHomey());
    await sys.initialize();
    const member = sys.addMember({ name: 'Erik', weight: 80, height: 180 });
    const meal = sys.logMeal(member.id, {
      type: 'lunch',
      description: 'Salmon salad',
      calories: 450,
      protein: 30,
      carbs: 25,
      fat: 20
    });
    assert(meal, 'should return meal entry');
    assertEqual(meal.calories, 450);
    assert(sys.mealLogs.length >= 1, 'should have logged meal');
    cleanup(sys);
  });

  it('getDailySummary returns nutrition data', async () => {
    const sys = new HomeNutritionWellnessSystem(createMockHomey());
    await sys.initialize();
    const member = sys.addMember({ name: 'Erik', weight: 80, height: 180 });
    sys.logMeal(member.id, { type: 'breakfast', calories: 400, protein: 20, carbs: 50, fat: 15 });
    const today = new Date().toISOString().split('T')[0];
    const summary = sys.getDailySummary(member.id, today);
    assert(summary, 'should return summary');
    assertType(summary.totals.calories, 'number');
    cleanup(sys);
  });
});

describe('HomeNutritionWellnessSystem — hydration', () => {
  it('logHydration records water intake', async () => {
    const sys = new HomeNutritionWellnessSystem(createMockHomey());
    await sys.initialize();
    const member = sys.addMember({ name: 'Erik', weight: 80, height: 180 });
    const log = sys.logHydration(member.id, 330);
    assert(log, 'should return log entry');
    cleanup(sys);
  });

  it('logHydration works with cup size preset', async () => {
    const sys = new HomeNutritionWellnessSystem(createMockHomey());
    await sys.initialize();
    const member = sys.addMember({ name: 'Erik', weight: 80, height: 180 });
    const log = sys.logHydration(member.id, null, 'large');
    assert(log, 'should return log entry');
    cleanup(sys);
  });

  it('getHydrationStatus returns status', async () => {
    const sys = new HomeNutritionWellnessSystem(createMockHomey());
    await sys.initialize();
    const member = sys.addMember({ name: 'Erik', weight: 80, height: 180 });
    sys.logHydration(member.id, 500);
    const today = new Date().toISOString().split('T')[0];
    const status = sys.getHydrationStatus(member.id, today);
    assert(status, 'should return status');
    assertType(status.percentComplete, 'number');
    cleanup(sys);
  });

  it('getWaterFilterStatus returns filter info', async () => {
    const sys = new HomeNutritionWellnessSystem(createMockHomey());
    await sys.initialize();
    const status = sys.getWaterFilterStatus();
    assertEqual(status.installed, true);
    assertType(status.daysRemaining, 'number');
    cleanup(sys);
  });
});

describe('HomeNutritionWellnessSystem — fridge & pantry', () => {
  it('addFridgeItem and removeFridgeItem work', async () => {
    const sys = new HomeNutritionWellnessSystem(createMockHomey());
    await sys.initialize();
    const item = sys.addFridgeItem({ name: 'Milk', quantity: 1, unit: 'L', expiryDate: '2026-03-10' });
    assert(item, 'should return item');
    assert(sys.fridgeInventory.length >= 1, 'should have item in fridge');
    const result = sys.removeFridgeItem(item.id);
    assertEqual(result, true);
    cleanup(sys);
  });

  it('addPantryItem stores pantry items', async () => {
    const sys = new HomeNutritionWellnessSystem(createMockHomey());
    await sys.initialize();
    const item = sys.addPantryItem({ name: 'Rice', quantity: 2, unit: 'kg' });
    assert(item, 'should return item');
    assert(sys.pantryInventory.length >= 1, 'should have pantry item');
    cleanup(sys);
  });

  it('getExpiringItems returns soon-to-expire items', async () => {
    const sys = new HomeNutritionWellnessSystem(createMockHomey());
    await sys.initialize();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    sys.addFridgeItem({ name: 'Yogurt', quantity: 1, unit: 'pc', expiryDate: tomorrow.toISOString().split('T')[0] });
    const expiring = sys.getExpiringItems(3);
    assert(expiring.length >= 1, 'should find expiring item');
    cleanup(sys);
  });
});

describe('HomeNutritionWellnessSystem — supplements & fasting', () => {
  it('addSupplementSchedule creates schedule', async () => {
    const sys = new HomeNutritionWellnessSystem(createMockHomey());
    await sys.initialize();
    const member = sys.addMember({ name: 'Erik', weight: 80, height: 180 });
    const supp = sys.addSupplementSchedule(member.id, {
      name: 'Vitamin D',
      dosage: '1000 IU',
      timing: 'morning',
      frequency: 'daily'
    });
    assert(supp, 'should return supplement');
    cleanup(sys);
  });

  it('startFast and endFast work', async () => {
    const sys = new HomeNutritionWellnessSystem(createMockHomey());
    await sys.initialize();
    const member = sys.addMember({ name: 'Erik', weight: 80, height: 180 });
    const fast = sys.startFast(member.id, '16:8');
    assert(fast, 'should start fast');
    assertEqual(fast.active, true);
    const ended = sys.endFast(member.id);
    assert(ended, 'should end fast');
    cleanup(sys);
  });

  it('getFastingStatus returns status', async () => {
    const sys = new HomeNutritionWellnessSystem(createMockHomey());
    await sys.initialize();
    const member = sys.addMember({ name: 'Erik', weight: 80, height: 180 });
    sys.startFast(member.id, '18:6');
    const status = sys.getFastingStatus(member.id);
    assertEqual(status.active, true);
    cleanup(sys);
  });

  it('startFast rejects invalid protocol', async () => {
    const sys = new HomeNutritionWellnessSystem(createMockHomey());
    await sys.initialize();
    const member = sys.addMember({ name: 'Erik', weight: 80, height: 180 });
    assertEqual(sys.startFast(member.id, 'invalid'), null);
    cleanup(sys);
  });
});

describe('HomeNutritionWellnessSystem — wellness & health', () => {
  it('calculateWellnessScore returns score', async () => {
    const sys = new HomeNutritionWellnessSystem(createMockHomey());
    await sys.initialize();
    const member = sys.addMember({ name: 'Erik', weight: 80, height: 180 });
    sys.logMeal(member.id, { type: 'lunch', calories: 600, protein: 30, carbs: 60, fat: 20 });
    sys.logHydration(member.id, 1000);
    const score = sys.calculateWellnessScore(member.id);
    assert(score, 'should return score');
    assertType(score.overall, 'number');
    cleanup(sys);
  });

  it('logBloodPressure records reading', async () => {
    const sys = new HomeNutritionWellnessSystem(createMockHomey());
    await sys.initialize();
    const member = sys.addMember({ name: 'Erik', weight: 80, height: 180 });
    const bp = sys.logBloodPressure(member.id, 120, 80);
    assert(bp, 'should return reading');
    assertType(bp.category, 'string');
    cleanup(sys);
  });

  it('logBloodSugar records reading', async () => {
    const sys = new HomeNutritionWellnessSystem(createMockHomey());
    await sys.initialize();
    const member = sys.addMember({ name: 'Erik', weight: 80, height: 180 });
    const bs = sys.logBloodSugar(member.id, 95, 'fasting');
    assert(bs, 'should return reading');
    cleanup(sys);
  });

  it('getHealthDashboard returns dashboard', async () => {
    const sys = new HomeNutritionWellnessSystem(createMockHomey());
    await sys.initialize();
    const member = sys.addMember({ name: 'Erik', weight: 80, height: 180 });
    const dashboard = sys.getHealthDashboard(member.id);
    assert(dashboard, 'should return dashboard');
    assertEqual(dashboard.member.name, 'Erik');
    cleanup(sys);
  });
});

describe('HomeNutritionWellnessSystem — recipes & shopping', () => {
  it('getBuiltInRecipes returns recipes', async () => {
    const sys = new HomeNutritionWellnessSystem(createMockHomey());
    await sys.initialize();
    const recipes = sys.getBuiltInRecipes();
    assert(Array.isArray(recipes), 'should be array');
    assert(recipes.length > 0, 'should have recipes');
    cleanup(sys);
  });

  it('addCustomRecipe creates recipe', async () => {
    const sys = new HomeNutritionWellnessSystem(createMockHomey());
    await sys.initialize();
    const recipe = sys.addCustomRecipe({
      name: 'Test Soup',
      calories: 200,
      protein: 10,
      carbs: 25,
      fat: 5,
      servings: 4,
      cookTime: 30,
      difficulty: 'easy'
    });
    assert(recipe, 'should return recipe');
    assertEqual(recipe.name, 'Test Soup');
    cleanup(sys);
  });

  it('searchRecipes finds by query', async () => {
    const sys = new HomeNutritionWellnessSystem(createMockHomey());
    await sys.initialize();
    const results = sys.searchRecipes('meatball');
    assert(Array.isArray(results), 'should be array');
    cleanup(sys);
  });

  it('addToShoppingList and markPurchased work', async () => {
    const sys = new HomeNutritionWellnessSystem(createMockHomey());
    await sys.initialize();
    const item = sys.addToShoppingList({ name: 'Butter', quantity: 1, unit: 'pc', category: 'dairy' });
    assert(item, 'should return item');
    const purchased = sys.markPurchased(item.id, 35);
    assert(purchased, 'should mark purchased');
    assertEqual(purchased.purchased, true);
    cleanup(sys);
  });

  it('getShoppingList filters unpurchased', async () => {
    const sys = new HomeNutritionWellnessSystem(createMockHomey());
    await sys.initialize();
    sys.addToShoppingList({ name: 'Milk', quantity: 1 });
    const item2 = sys.addToShoppingList({ name: 'Bread', quantity: 1 });
    sys.markPurchased(item2.id, 30);
    const unpurchased = sys.getShoppingList(true);
    assertEqual(unpurchased.length, 1);
    cleanup(sys);
  });
});

describe('HomeNutritionWellnessSystem — activity, sleep, waste', () => {
  it('logActivity records activity', async () => {
    const sys = new HomeNutritionWellnessSystem(createMockHomey());
    await sys.initialize();
    const member = sys.addMember({ name: 'Erik', weight: 80, height: 180 });
    const activity = sys.logActivity(member.id, { type: 'run', durationMinutes: 30, caloriesBurned: 300 });
    assert(activity, 'should return activity');
    cleanup(sys);
  });

  it('logSleep records sleep data', async () => {
    const sys = new HomeNutritionWellnessSystem(createMockHomey());
    await sys.initialize();
    const member = sys.addMember({ name: 'Erik', weight: 80, height: 180 });
    const sleep = sys.logSleep(member.id, { duration: 7.5, quality: 'good', bedtime: '23:00', wakeTime: '06:30' });
    assert(sleep, 'should return sleep log');
    cleanup(sys);
  });

  it('logFoodWaste records waste', async () => {
    const sys = new HomeNutritionWellnessSystem(createMockHomey());
    await sys.initialize();
    const waste = sys.logFoodWaste({ item: 'Expired bread', weightGrams: 200, reason: 'expired' });
    assert(waste, 'should return waste log');
    assert(sys.wasteLog.length >= 1, 'should have waste log');
    cleanup(sys);
  });

  it('getStatistics returns comprehensive stats', async () => {
    const sys = new HomeNutritionWellnessSystem(createMockHomey());
    await sys.initialize();
    const stats = sys.getStatistics();
    assertEqual(stats.initialized, true);
    assertType(stats.householdMembers, 'number');
    assertType(stats.nutrition.totalMealsLogged, 'number');
    cleanup(sys);
  });
});

describe('HomeNutritionWellnessSystem — special occasions & cooking', () => {
  it('addSpecialOccasion records occasion', async () => {
    const sys = new HomeNutritionWellnessSystem(createMockHomey());
    await sys.initialize();
    const occasion = sys.addSpecialOccasion({ name: 'Midsommar', date: '2026-06-20', guestCount: 12 });
    assert(occasion, 'should return occasion');
    cleanup(sys);
  });

  it('getCateringCalculation estimates food for guests', async () => {
    const sys = new HomeNutritionWellnessSystem(createMockHomey());
    await sys.initialize();
    const calc = sys.getCateringCalculation(10, 3);
    assert(calc, 'should return calculation');
    assertType(calc.totalPortions, 'number');
    assertEqual(calc.totalPortions, 30);
    cleanup(sys);
  });

  it('assignCookingDuty and getCookingDutyRoster work', async () => {
    const sys = new HomeNutritionWellnessSystem(createMockHomey());
    await sys.initialize();
    const member = sys.addMember({ name: 'Erik', weight: 80, height: 180 });
    const result = sys.assignCookingDuty(member.id, 'monday');
    assert(result, 'should return assignment');
    const roster = sys.getCookingDutyRoster();
    assert(roster, 'should return roster');
    cleanup(sys);
  });
});

run();
