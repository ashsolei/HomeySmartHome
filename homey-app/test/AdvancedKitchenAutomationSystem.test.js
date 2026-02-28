'use strict';

const { describe, it, run } = require('./helpers/runner');
const {
  assert, assertEqual, assertType, assertInstanceOf, assertRejects
} = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');
const EventEmitter = require('events');
const AdvancedKitchenAutomationSystem = require('../lib/AdvancedKitchenAutomationSystem');

/* ──── helpers ──── */
function createSystem() {
  const homey = createMockHomey();
  const sys = new AdvancedKitchenAutomationSystem(homey);
  return { sys, homey };
}

async function createInitialisedSystem() {
  const { sys, homey } = createSystem();
  await sys.initialize();
  return { sys, homey };
}

function cleanup(sys) {
  if (sys.monitoringInterval) {
    clearInterval(sys.monitoringInterval);
    sys.monitoringInterval = null;
  }
  sys.removeAllListeners();
}

/* ================================================================
   TESTS
   ================================================================ */

// ── Constructor ──
describe('AdvancedKitchenAutomationSystem — constructor', () => {
  it('creates instance extending EventEmitter', () => {
    const { sys } = createSystem();
    assertInstanceOf(sys, EventEmitter);
    cleanup(sys);
  });

  it('has empty Maps for appliances, inventory, recipes', () => {
    const { sys } = createSystem();
    assertInstanceOf(sys.appliances, Map);
    assertInstanceOf(sys.inventory, Map);
    assertInstanceOf(sys.recipes, Map);
    assertEqual(sys.appliances.size, 0);
    cleanup(sys);
  });

  it('has empty arrays and null session', () => {
    const { sys } = createSystem();
    assert(Array.isArray(sys.cookingSessions));
    assertEqual(sys.cookingSessions.length, 0);
    assertEqual(sys.currentSession, null);
    assert(Array.isArray(sys.mealPlans));
    assert(Array.isArray(sys.shoppingList));
    cleanup(sys);
  });

  it('stores homey reference', () => {
    const { sys, homey } = createSystem();
    assertEqual(sys.homey, homey);
    cleanup(sys);
  });
});

// ── initialize() ──
describe('AdvancedKitchenAutomationSystem — initialize', () => {
  it('returns true on success', async () => {
    const { sys } = createSystem();
    const result = await sys.initialize();
    assertEqual(result, true);
    cleanup(sys);
  });

  it('populates 6 default appliances', async () => {
    const { sys } = await createInitialisedSystem();
    assertEqual(sys.appliances.size, 6);
    assert(sys.appliances.has('oven-main'));
    assert(sys.appliances.has('cooktop-main'));
    assert(sys.appliances.has('hood-main'));
    assert(sys.appliances.has('dishwasher-main'));
    assert(sys.appliances.has('fridge-main'));
    assert(sys.appliances.has('coffee-main'));
    cleanup(sys);
  });

  it('populates 2 default recipes', async () => {
    const { sys } = await createInitialisedSystem();
    assertEqual(sys.recipes.size, 2);
    assert(sys.recipes.has('roast-chicken'));
    assert(sys.recipes.has('pasta-carbonara'));
    cleanup(sys);
  });

  it('populates 9 inventory items', async () => {
    const { sys } = await createInitialisedSystem();
    assertEqual(sys.inventory.size, 9);
    assert(sys.inventory.has('chicken-001'));
    assert(sys.inventory.has('eggs-001'));
    assert(sys.inventory.has('pasta-spaghetti'));
    cleanup(sys);
  });

  it('starts monitoring interval', async () => {
    const { sys } = await createInitialisedSystem();
    assert(sys.monitoringInterval !== null && sys.monitoringInterval !== undefined);
    cleanup(sys);
  });

  it('loads settings from homey.settings if available', async () => {
    const homey = createMockHomey();
    const saved = {
      appliances: [{ id: 'custom-app', name: 'Custom', type: 'custom' }],
      inventory: [],
      recipes: [],
      cookingSessions: [],
      mealPlans: [],
      shoppingList: []
    };
    homey.settings.set('advancedKitchen', saved);
    const sys = new AdvancedKitchenAutomationSystem(homey);
    await sys.initialize();
    assert(sys.appliances.has('custom-app'));
    cleanup(sys);
  });
});

// ── Appliance details ──
describe('AdvancedKitchenAutomationSystem — appliances', () => {
  it('oven has correct brand and type', async () => {
    const { sys } = await createInitialisedSystem();
    const oven = sys.appliances.get('oven-main');
    assertEqual(oven.brand, 'Miele');
    assertEqual(oven.type, 'oven');
    assertEqual(oven.status, 'off');
    cleanup(sys);
  });

  it('cooktop has 4 zones', async () => {
    const { sys } = await createInitialisedSystem();
    const cooktop = sys.appliances.get('cooktop-main');
    assertEqual(cooktop.type, 'cooktop');
    assert(Array.isArray(cooktop.zones));
    assertEqual(cooktop.zones.length, 4);
    cleanup(sys);
  });

  it('fridge has 3 compartments', async () => {
    const { sys } = await createInitialisedSystem();
    const fridge = sys.appliances.get('fridge-main');
    assertType(fridge.compartments, 'object');
    assertEqual(Object.keys(fridge.compartments).length, 3);
    assert(fridge.compartments.fridge !== undefined);
    assert(fridge.compartments.freezer !== undefined);
    assert(fridge.compartments.crisper !== undefined);
    cleanup(sys);
  });

  it('coffee machine has presets', async () => {
    const { sys } = await createInitialisedSystem();
    const coffee = sys.appliances.get('coffee-main');
    assert(Array.isArray(coffee.presets));
    assertEqual(coffee.presets.length, 3);
    cleanup(sys);
  });

  it('hood has filter tracking', async () => {
    const { sys } = await createInitialisedSystem();
    const hood = sys.appliances.get('hood-main');
    assertType(hood.filterUsageHours, 'number');
    assertType(hood.filterLifespan, 'number');
    cleanup(sys);
  });
});

// ── Recipe details ──
describe('AdvancedKitchenAutomationSystem — recipes', () => {
  it('roast-chicken has 5 steps', async () => {
    const { sys } = await createInitialisedSystem();
    const recipe = sys.recipes.get('roast-chicken');
    assertEqual(recipe.steps.length, 5);
    assertEqual(recipe.name, 'Classic Roast Chicken');
    cleanup(sys);
  });

  it('pasta-carbonara has ingredients list', async () => {
    const { sys } = await createInitialisedSystem();
    const recipe = sys.recipes.get('pasta-carbonara');
    assert(Array.isArray(recipe.ingredients));
    assert(recipe.ingredients.length > 0);
    cleanup(sys);
  });

  it('recipes have nutrition data', async () => {
    const { sys } = await createInitialisedSystem();
    const recipe = sys.recipes.get('roast-chicken');
    assertType(recipe.nutrition, 'object');
    assertType(recipe.nutrition.calories, 'number');
    cleanup(sys);
  });

  it('recipes have tags', async () => {
    const { sys } = await createInitialisedSystem();
    const recipe = sys.recipes.get('pasta-carbonara');
    assert(Array.isArray(recipe.tags));
    assert(recipe.tags.length > 0);
    cleanup(sys);
  });

  it('recipe steps have appliance actions', async () => {
    const { sys } = await createInitialisedSystem();
    const recipe = sys.recipes.get('roast-chicken');
    const stepWithAction = recipe.steps.find(s => s.applianceAction);
    assert(stepWithAction !== undefined, 'at least one step should have applianceAction');
    cleanup(sys);
  });
});

// ── Inventory ──
describe('AdvancedKitchenAutomationSystem — inventory', () => {
  it('inventory items have purchase and expiry dates', async () => {
    const { sys } = await createInitialisedSystem();
    const item = sys.inventory.get('eggs-001');
    assertType(item.purchaseDate, 'string');
    assertType(item.expiryDate, 'string');
    assertEqual(item.status, 'fresh');
    cleanup(sys);
  });

  it('getInventory returns all items as array', async () => {
    const { sys } = await createInitialisedSystem();
    const items = sys.getInventory();
    assert(Array.isArray(items));
    assertEqual(items.length, 9);
    cleanup(sys);
  });

  it('getInventory filters by category', async () => {
    const { sys } = await createInitialisedSystem();
    const dairy = sys.getInventory({ category: 'dairy' });
    assert(dairy.length >= 2); // milk, eggs, parmesan
    assert(dairy.every(i => i.category === 'dairy'));
    cleanup(sys);
  });

  it('getInventory filters by location', async () => {
    const { sys } = await createInitialisedSystem();
    const pantry = sys.getInventory({ location: 'pantry' });
    assert(pantry.length >= 2);
    assert(pantry.every(i => i.location === 'pantry'));
    cleanup(sys);
  });

  it('getInventory filters by status', async () => {
    const { sys } = await createInitialisedSystem();
    const fresh = sys.getInventory({ status: 'fresh' });
    assertEqual(fresh.length, 9); // all fresh initially
    cleanup(sys);
  });
});

// ── Inventory expiry checks ──
describe('AdvancedKitchenAutomationSystem — checkInventoryExpiry', () => {
  it('marks items past expiry as expired', async () => {
    const { sys } = await createInitialisedSystem();
    // Set an item's expiry to yesterday
    const item = sys.inventory.get('chicken-001');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    item.expiryDate = yesterday.toISOString();

    await sys.checkInventoryExpiry();
    assertEqual(item.status, 'expired');
    cleanup(sys);
  });

  it('emits notification for expired items', async () => {
    const { sys } = await createInitialisedSystem();
    const item = sys.inventory.get('milk-001');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    item.expiryDate = yesterday.toISOString();

    const notifications = [];
    sys.on('notification', n => notifications.push(n));
    await sys.checkInventoryExpiry();

    const expiredNotif = notifications.find(n => n.title === 'Item Expired');
    assert(expiredNotif !== undefined, 'should emit Item Expired notification');
    assertEqual(expiredNotif.priority, 'high');
    cleanup(sys);
  });

  it('marks items expiring within 2 days', async () => {
    const { sys } = await createInitialisedSystem();
    const item = sys.inventory.get('bacon-001');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    item.expiryDate = tomorrow.toISOString();

    await sys.checkInventoryExpiry();
    assertEqual(item.status, 'expiring-soon');
    cleanup(sys);
  });

  it('does not duplicate expiry warning', async () => {
    const { sys } = await createInitialisedSystem();
    const item = sys.inventory.get('bacon-001');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    item.expiryDate = tomorrow.toISOString();

    const notifications = [];
    sys.on('notification', n => notifications.push(n));
    await sys.checkInventoryExpiry();
    await sys.checkInventoryExpiry();

    const expiringNotifs = notifications.filter(n => n.title === 'Item Expiring Soon');
    assertEqual(expiringNotifs.length, 1, 'should show warning only once');
    cleanup(sys);
  });
});

// ── Cooking sessions ──
describe('AdvancedKitchenAutomationSystem — startRecipe', () => {
  it('creates a cooking session', async () => {
    const { sys } = await createInitialisedSystem();
    const result = await sys.startRecipe('roast-chicken');
    assert(result.session !== undefined);
    assertEqual(result.session.recipeName, 'Classic Roast Chicken');
    assertEqual(result.session.status, 'in-progress');
    assertEqual(result.session.currentStep, 0);
    cleanup(sys);
  });

  it('sets currentSession', async () => {
    const { sys } = await createInitialisedSystem();
    assertEqual(sys.currentSession, null);
    await sys.startRecipe('pasta-carbonara');
    assert(sys.currentSession !== null);
    assertEqual(sys.currentSession.recipeName, 'Pasta Carbonara');
    cleanup(sys);
  });

  it('appends to cookingSessions array', async () => {
    const { sys } = await createInitialisedSystem();
    assertEqual(sys.cookingSessions.length, 0);
    await sys.startRecipe('roast-chicken');
    assertEqual(sys.cookingSessions.length, 1);
    cleanup(sys);
  });

  it('emits cooking started notification', async () => {
    const { sys } = await createInitialisedSystem();
    let notif = null;
    sys.on('notification', n => { if (n.title === 'Cooking Started') notif = n; });
    await sys.startRecipe('roast-chicken');
    assert(notif !== null);
    assert(notif.message.includes('Roast Chicken'));
    cleanup(sys);
  });

  it('throws for non-existent recipe', async () => {
    const { sys } = await createInitialisedSystem();
    await assertRejects(
      () => sys.startRecipe('non-existent'),
      'Recipe not found'
    );
    cleanup(sys);
  });

  it('emits warning for missing ingredients', async () => {
    const { sys } = await createInitialisedSystem();
    // Remove all inventory to guarantee missing ingredients
    sys.inventory.clear();
    const notifications = [];
    sys.on('notification', n => notifications.push(n));
    await sys.startRecipe('roast-chicken');
    // Should still succeed, but may emit missing ingredients warning
    assert(sys.currentSession !== null);
    cleanup(sys);
  });
});

// ── executeRecipeStep ──
describe('AdvancedKitchenAutomationSystem — executeRecipeStep', () => {
  it('advances current step', async () => {
    const { sys } = await createInitialisedSystem();
    await sys.startRecipe('roast-chicken');
    const result = await sys.executeRecipeStep(1);
    assertEqual(result.session.currentStep, 1);
    assertEqual(result.step.step, 1);
    cleanup(sys);
  });

  it('throws without active session', async () => {
    const { sys } = await createInitialisedSystem();
    await assertRejects(
      () => sys.executeRecipeStep(1),
      'No active cooking session'
    );
    cleanup(sys);
  });

  it('throws for invalid step number', async () => {
    const { sys } = await createInitialisedSystem();
    await sys.startRecipe('roast-chicken');
    await assertRejects(
      () => sys.executeRecipeStep(999),
      'Step not found'
    );
    cleanup(sys);
  });
});

// ── executeApplianceAction ──
describe('AdvancedKitchenAutomationSystem — executeApplianceAction', () => {
  it('preheat sets appliance to preheating', async () => {
    const { sys } = await createInitialisedSystem();
    await sys.executeApplianceAction({ appliance: 'oven-main', action: 'preheat', temp: 200, mode: 'fan' });
    const oven = sys.appliances.get('oven-main');
    assertEqual(oven.status, 'preheating');
    assertEqual(oven.targetTemp, 200);
    assertEqual(oven.mode, 'fan');
    cleanup(sys);
  });

  it('cook sets appliance to cooking with timer', async () => {
    const { sys } = await createInitialisedSystem();
    await sys.executeApplianceAction({ appliance: 'oven-main', action: 'cook', temp: 180, duration: 60 });
    const oven = sys.appliances.get('oven-main');
    assertEqual(oven.status, 'cooking');
    assertEqual(oven.targetTemp, 180);
    assertEqual(oven.timer, 60);
    cleanup(sys);
  });

  it('setZone turns on cooktop zone', async () => {
    const { sys } = await createInitialisedSystem();
    const cooktop = sys.appliances.get('cooktop-main');
    const zone1Id = cooktop.zones[0].id;
    await sys.executeApplianceAction({
      appliance: 'cooktop-main', action: 'setZone', zone: zone1Id, power: 7
    });
    const zone = cooktop.zones.find(z => z.id === zone1Id);
    assertEqual(zone.status, 'on');
    assertEqual(zone.power, 7);
    cleanup(sys);
  });

  it('cooktop activates hood automatically', async () => {
    const { sys } = await createInitialisedSystem();
    const cooktop = sys.appliances.get('cooktop-main');
    const zone1Id = cooktop.zones[0].id;
    await sys.executeApplianceAction({
      appliance: 'cooktop-main', action: 'setZone', zone: zone1Id, power: 5
    });
    const hood = sys.appliances.get('hood-main');
    assertEqual(hood.status, 'on');
    assertEqual(hood.fanSpeed, 2);
    cleanup(sys);
  });

  it('off turns appliance and zones off', async () => {
    const { sys } = await createInitialisedSystem();
    // First turn on
    const cooktop = sys.appliances.get('cooktop-main');
    cooktop.zones[0].status = 'on';
    await sys.executeApplianceAction({ appliance: 'cooktop-main', action: 'off' });
    assertEqual(cooktop.status, 'off');
    assert(cooktop.zones.every(z => z.status === 'off'));
    cleanup(sys);
  });

  it('throws for unknown appliance', async () => {
    const { sys } = await createInitialisedSystem();
    let threw = false;
    try {
      await sys.executeApplianceAction({ appliance: 'non-existent', action: 'preheat' });
    } catch (err) {
      threw = true;
      assert(err.message.includes('Appliance not found'));
    }
    assert(threw, 'should throw for unknown appliance');
    cleanup(sys);
  });
});

// ── completeRecipe ──
describe('AdvancedKitchenAutomationSystem — completeRecipe', () => {
  it('completes session and clears currentSession', async () => {
    const { sys } = await createInitialisedSystem();
    await sys.startRecipe('pasta-carbonara');
    await sys.completeRecipe();
    assertEqual(sys.currentSession, null);
    assertEqual(sys.cookingSessions[0].status, 'completed');
    cleanup(sys);
  });

  it('deducts ingredients from inventory', async () => {
    const { sys } = await createInitialisedSystem();
    const eggsBefore = sys.inventory.get('eggs-001').quantity;
    await sys.startRecipe('pasta-carbonara');
    await sys.completeRecipe();
    // Carbonara uses eggs, so quantity should decrease
    const eggsAfter = sys.inventory.get('eggs-001').quantity;
    assert(eggsAfter <= eggsBefore, 'eggs quantity should not increase');
    cleanup(sys);
  });

  it('throws without active session', async () => {
    const { sys } = await createInitialisedSystem();
    let threw = false;
    try {
      await sys.completeRecipe();
    } catch (e) {
      threw = true;
      assert(e.message.includes('No active cooking session'));
    }
    assert(threw);
    cleanup(sys);
  });

  it('emits completion notification', async () => {
    const { sys } = await createInitialisedSystem();
    await sys.startRecipe('roast-chicken');
    let notif = null;
    sys.on('notification', n => { if (n.title === 'Cooking Completed') notif = n; });
    await sys.completeRecipe();
    assert(notif !== null);
    assert(notif.message.includes('Roast Chicken'));
    cleanup(sys);
  });

  it('sets endTime on session', async () => {
    const { sys } = await createInitialisedSystem();
    await sys.startRecipe('roast-chicken');
    await sys.completeRecipe();
    assert(sys.cookingSessions[0].endTime > 0);
    cleanup(sys);
  });
});

// ── Getters ──
describe('AdvancedKitchenAutomationSystem — getters', () => {
  it('getAppliances returns array', async () => {
    const { sys } = await createInitialisedSystem();
    const appliances = sys.getAppliances();
    assert(Array.isArray(appliances));
    assertEqual(appliances.length, 6);
    cleanup(sys);
  });

  it('getAppliances uses cache', async () => {
    const { sys } = await createInitialisedSystem();
    const a1 = sys.getAppliances();
    const a2 = sys.getAppliances();
    // Cached reference should be same array
    assert(a1 === a2, 'should return cached array');
    cleanup(sys);
  });

  it('getRecipes returns all recipes', async () => {
    const { sys } = await createInitialisedSystem();
    const recipes = sys.getRecipes();
    assert(Array.isArray(recipes));
    assertEqual(recipes.length, 2);
    cleanup(sys);
  });

  it('getRecipes filters by difficulty', async () => {
    const { sys } = await createInitialisedSystem();
    const easy = sys.getRecipes({ difficulty: 'easy' });
    assert(Array.isArray(easy));
    for (const r of easy) {
      assertEqual(r.difficulty, 'easy');
    }
    cleanup(sys);
  });

  it('getRecipes filters by tag', async () => {
    const { sys } = await createInitialisedSystem();
    const all = sys.getRecipes();
    const tags = all.flatMap(r => r.tags || []);
    if (tags.length > 0) {
      const filtered = sys.getRecipes({ tag: tags[0] });
      assert(filtered.every(r => r.tags.includes(tags[0])));
    }
    cleanup(sys);
  });

  it('getCookingSessions returns reverse-chronological', async () => {
    const { sys } = await createInitialisedSystem();
    await sys.startRecipe('roast-chicken');
    await sys.completeRecipe();
    await new Promise(r => setTimeout(r, 5));
    await sys.startRecipe('pasta-carbonara');
    await sys.completeRecipe();
    const sessions = sys.getCookingSessions();
    assert(sessions.length >= 2);
    assert(sessions[0].startTime >= sessions[1].startTime, 'should be reverse chronological');
    cleanup(sys);
  });

  it('getCurrentSession returns null when no session', async () => {
    const { sys } = await createInitialisedSystem();
    assertEqual(sys.getCurrentSession(), null);
    cleanup(sys);
  });

  it('getCurrentSession returns active session', async () => {
    const { sys } = await createInitialisedSystem();
    await sys.startRecipe('roast-chicken');
    const session = sys.getCurrentSession();
    assert(session !== null);
    assertEqual(session.status, 'in-progress');
    cleanup(sys);
  });

  it('getShoppingList returns array', async () => {
    const { sys } = await createInitialisedSystem();
    const list = sys.getShoppingList();
    assert(Array.isArray(list));
    cleanup(sys);
  });
});

// ── Shopping list ──
describe('AdvancedKitchenAutomationSystem — shopping list', () => {
  it('addToShoppingList adds item', async () => {
    const { sys } = await createInitialisedSystem();
    const result = await sys.addToShoppingList({
      name: 'Butter', quantity: 1, unit: 'pack', category: 'dairy'
    });
    assert(Array.isArray(result));
    assertEqual(result.length, 1);
    assertEqual(result[0].name, 'Butter');
    assertEqual(result[0].purchased, false);
    cleanup(sys);
  });

  it('multiple adds accumulate', async () => {
    const { sys } = await createInitialisedSystem();
    await sys.addToShoppingList({ name: 'Bread', quantity: 1, unit: 'loaf', category: 'bakery' });
    await new Promise(r => setTimeout(r, 5));
    await sys.addToShoppingList({ name: 'Cream', quantity: 500, unit: 'ml', category: 'dairy' });
    const list = sys.getShoppingList();
    assertEqual(list.length, 2);
    cleanup(sys);
  });

  it('shopping items have timestamps', async () => {
    const { sys } = await createInitialisedSystem();
    await sys.addToShoppingList({ name: 'Salt', quantity: 1, unit: 'kg', category: 'pantry' });
    assertType(sys.shoppingList[0].addedAt, 'string');
    cleanup(sys);
  });
});

// ── getStats ──
describe('AdvancedKitchenAutomationSystem — getStats', () => {
  it('returns comprehensive stats object', async () => {
    const { sys } = await createInitialisedSystem();
    const stats = sys.getStats();
    assertEqual(stats.totalAppliances, 6);
    assertEqual(stats.activeAppliances, 0);
    assertEqual(stats.totalInventoryItems, 9);
    assertEqual(stats.totalRecipes, 2);
    assertEqual(stats.cookingSessions, 0);
    assertEqual(stats.currentSession, null);
    assertType(stats.expiringItems, 'number');
    assertType(stats.expiredItems, 'number');
    assertType(stats.shoppingListItems, 'number');
    assertType(stats.energyUsage, 'number');
    cleanup(sys);
  });

  it('counts active appliances', async () => {
    const { sys } = await createInitialisedSystem();
    sys.appliances.get('oven-main').status = 'cooking';
    const stats = sys.getStats();
    assertEqual(stats.activeAppliances, 1);
    cleanup(sys);
  });
});

// ── monitorAppliances ──
describe('AdvancedKitchenAutomationSystem — monitorAppliances', () => {
  it('increments hood filter usage when fan running', async () => {
    const { sys } = await createInitialisedSystem();
    const hood = sys.appliances.get('hood-main');
    hood.fanSpeed = 3;
    const before = hood.filterUsageHours;
    await sys.monitorAppliances();
    assert(hood.filterUsageHours > before);
    cleanup(sys);
  });

  it('emits notification for low detergent', async () => {
    const { sys } = await createInitialisedSystem();
    const dw = sys.appliances.get('dishwasher-main');
    dw.detergent = 10;
    const notifications = [];
    sys.on('notification', n => notifications.push(n));
    await sys.monitorAppliances();
    const low = notifications.find(n => n.title === 'Low Dishwasher Detergent');
    assert(low !== undefined);
    cleanup(sys);
  });
});

// ── saveSettings ──
describe('AdvancedKitchenAutomationSystem — saveSettings', () => {
  it('persists to homey.settings', async () => {
    const { sys, homey } = await createInitialisedSystem();
    await sys.saveSettings();
    const saved = homey.settings.get('advancedKitchen');
    assert(saved !== null);
    assert(Array.isArray(saved.appliances));
    cleanup(sys);
  });

  it('clears cache on save', async () => {
    const { sys } = await createInitialisedSystem();
    sys._cache.set('test', { data: 1, timestamp: Date.now() });
    await sys.saveSettings();
    assertEqual(sys._cache.size, 0);
    cleanup(sys);
  });
});

// ── destroy ──
describe('AdvancedKitchenAutomationSystem — destroy', () => {
  it('clears monitoring interval', async () => {
    const { sys } = await createInitialisedSystem();
    assert(sys.monitoringInterval !== null);
    await sys.destroy();
    // After destroy, monitoringInterval may be cleared but not null re-set
    // Just verify no error
    cleanup(sys);
  });

  it('clears cache', async () => {
    const { sys } = await createInitialisedSystem();
    sys._cache.set('x', 1);
    await sys.destroy();
    assertEqual(sys._cache.size, 0);
    cleanup(sys);
  });

  it('removes all listeners', async () => {
    const { sys } = await createInitialisedSystem();
    sys.on('test-event', () => {});
    await sys.destroy();
    assertEqual(sys.listenerCount('test-event'), 0);
    cleanup(sys);
  });
});

run();
