'use strict';

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertType } = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');

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

const SmartFoodPantryManagementSystem = require('../lib/SmartFoodPantryManagementSystem');

describe('SmartFoodPantryManagementSystem — constructor', () => {
  it('instantiates without errors', () => {
    const sys = new SmartFoodPantryManagementSystem(createMockHomey());
    assert(sys, 'should create instance');
    assertEqual(sys.initialized, false);
    assertEqual(sys.inventory.size, 0);
    cleanup(sys);
  });

  it('has recipe library and zones', () => {
    const sys = new SmartFoodPantryManagementSystem(createMockHomey());
    assert(sys.recipes.length > 0, 'should have recipes');
    assert(sys.zones, 'should have zones');
    cleanup(sys);
  });
});

describe('SmartFoodPantryManagementSystem — initialize', () => {
  it('initializes successfully', async () => {
    const sys = new SmartFoodPantryManagementSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.initialized, true);
    cleanup(sys);
  });
});

describe('SmartFoodPantryManagementSystem — addItem', () => {
  it('adds a food item to inventory', async () => {
    const sys = new SmartFoodPantryManagementSystem(createMockHomey());
    await sys.initialize();
    const item = sys.addItem({
      name: 'Milk', category: 'dairy', location: 'fridge',
      quantity: 1, unit: 'liter',
      expiryDate: new Date(Date.now() + 7 * 86400000).toISOString()
    });
    assert(item, 'should return item');
    assertEqual(item.name, 'Milk');
    assertEqual(item.location, 'fridge');
    assertEqual(sys.inventory.size, 1);
    cleanup(sys);
  });
});

describe('SmartFoodPantryManagementSystem — removeItem', () => {
  it('removes an item from inventory', async () => {
    const sys = new SmartFoodPantryManagementSystem(createMockHomey());
    await sys.initialize();
    const item = sys.addItem({ name: 'Butter', category: 'dairy', location: 'fridge', quantity: 1 });
    const result = sys.removeItem(item.id, 'consumed');
    assert(result, 'should return removed item');
    assertEqual(result.name, 'Butter');
    assertEqual(sys.inventory.size, 0);
    cleanup(sys);
  });

  it('returns null for unknown item', async () => {
    const sys = new SmartFoodPantryManagementSystem(createMockHomey());
    await sys.initialize();
    const result = sys.removeItem('nonexistent', 'consumed');
    assertEqual(result, null);
    cleanup(sys);
  });
});

describe('SmartFoodPantryManagementSystem — updateQuantity', () => {
  it('updates item quantity', async () => {
    const sys = new SmartFoodPantryManagementSystem(createMockHomey());
    await sys.initialize();
    const item = sys.addItem({ name: 'Eggs', category: 'dairy', location: 'fridge', quantity: 12 });
    const result = sys.updateQuantity(item.id, 6);
    assert(result, 'should return updated item');
    assertEqual(result.quantity, 6);
    cleanup(sys);
  });
});

describe('SmartFoodPantryManagementSystem — markOpened', () => {
  it('marks item as opened', async () => {
    const sys = new SmartFoodPantryManagementSystem(createMockHomey());
    await sys.initialize();
    const item = sys.addItem({ name: 'Juice', category: 'beverage', location: 'fridge', quantity: 1 });
    const result = sys.markOpened(item.id);
    assert(result, 'should return item');
    assertEqual(result.opened, true);
    cleanup(sys);
  });
});

describe('SmartFoodPantryManagementSystem — search and filter', () => {
  it('getItemsByZone returns items in zone', async () => {
    const sys = new SmartFoodPantryManagementSystem(createMockHomey());
    await sys.initialize();
    sys.addItem({ name: 'Cheese', category: 'dairy', location: 'fridge', quantity: 1 });
    sys.addItem({ name: 'Pasta', category: 'grains', location: 'pantry', quantity: 2 });
    const fridgeItems = sys.getItemsByZone('fridge');
    assertEqual(fridgeItems.length, 1);
    assertEqual(fridgeItems[0].name, 'Cheese');
    cleanup(sys);
  });

  it('getItemsByCategory returns items by category', async () => {
    const sys = new SmartFoodPantryManagementSystem(createMockHomey());
    await sys.initialize();
    sys.addItem({ name: 'Yogurt', category: 'dairy', location: 'fridge', quantity: 1 });
    sys.addItem({ name: 'Rice', category: 'grains', location: 'pantry', quantity: 1 });
    const dairy = sys.getItemsByCategory('dairy');
    assertEqual(dairy.length, 1);
    assertEqual(dairy[0].name, 'Yogurt');
    cleanup(sys);
  });

  it('searchItems finds items by name', async () => {
    const sys = new SmartFoodPantryManagementSystem(createMockHomey());
    await sys.initialize();
    sys.addItem({ name: 'Cheddar Cheese', category: 'dairy', location: 'fridge', quantity: 1 });
    sys.addItem({ name: 'Cream Cheese', category: 'dairy', location: 'fridge', quantity: 1 });
    const results = sys.searchItems('cheese');
    assertEqual(results.length, 2);
    cleanup(sys);
  });
});

describe('SmartFoodPantryManagementSystem — moveItem', () => {
  it('moves item to a new zone', async () => {
    const sys = new SmartFoodPantryManagementSystem(createMockHomey());
    await sys.initialize();
    const item = sys.addItem({ name: 'Bread', category: 'grains', location: 'pantry', quantity: 1 });
    const result = sys.moveItem(item.id, 'freezer');
    assert(result, 'should return item');
    assertEqual(result.location, 'freezer');
    cleanup(sys);
  });
});

describe('SmartFoodPantryManagementSystem — expiry tracking', () => {
  it('getExpiringSoon returns items near expiry', async () => {
    const sys = new SmartFoodPantryManagementSystem(createMockHomey());
    await sys.initialize();
    sys.addItem({
      name: 'Yogurt', category: 'dairy', location: 'fridge', quantity: 1,
      expiryDate: new Date(Date.now() + 2 * 86400000).toISOString()
    });
    sys.addItem({
      name: 'Canned Beans', category: 'canned', location: 'pantry', quantity: 3,
      expiryDate: new Date(Date.now() + 365 * 86400000).toISOString()
    });
    const expiring = sys.getExpiringSoon(7);
    assert(expiring.length >= 1, 'should find expiring items');
    cleanup(sys);
  });
});

describe('SmartFoodPantryManagementSystem — grocery list', () => {
  it('generateGroceryList returns list', async () => {
    const sys = new SmartFoodPantryManagementSystem(createMockHomey());
    await sys.initialize();
    const list = sys.generateGroceryList();
    assert(list, 'should return list');
    assert(Array.isArray(list.items), 'should have items array');
    cleanup(sys);
  });
});

describe('SmartFoodPantryManagementSystem — consumption rates', () => {
  it('learnConsumptionRate tracks consumption', async () => {
    const sys = new SmartFoodPantryManagementSystem(createMockHomey());
    await sys.initialize();
    sys.learnConsumptionRate('Milk', 1, 'liter');
    assert(sys.consumptionRates.has('milk'), 'should track rate');
    cleanup(sys);
  });
});

describe('SmartFoodPantryManagementSystem — meal suggestions', () => {
  it('suggestMeals returns suggestions', async () => {
    const sys = new SmartFoodPantryManagementSystem(createMockHomey());
    await sys.initialize();
    const suggestions = sys.suggestMeals();
    assert(Array.isArray(suggestions), 'should be array');
    cleanup(sys);
  });
});

describe('SmartFoodPantryManagementSystem — household members', () => {
  it('addHouseholdMember adds a member', async () => {
    const sys = new SmartFoodPantryManagementSystem(createMockHomey());
    await sys.initialize();
    const member = sys.addHouseholdMember('Alice', { allergies: ['nuts'], preferences: ['vegetarian'] });
    assert(member, 'should return member');
    assert(sys.householdMembers.has('Alice'), 'should be in map');
    cleanup(sys);
  });

  it('removeHouseholdMember removes a member', async () => {
    const sys = new SmartFoodPantryManagementSystem(createMockHomey());
    await sys.initialize();
    sys.addHouseholdMember('Bob', {});
    const result = sys.removeHouseholdMember('Bob');
    assertEqual(result, true);
    assertEqual(sys.householdMembers.has('Bob'), false);
    cleanup(sys);
  });
});

describe('SmartFoodPantryManagementSystem — temperature monitoring', () => {
  it('recordTemperature logs temperature', async () => {
    const sys = new SmartFoodPantryManagementSystem(createMockHomey());
    await sys.initialize();
    const result = sys.recordTemperature('fridge', 5.5);
    assert(result, 'should return result');
    assertEqual(result.zone, 'fridge');
    assertEqual(result.reading.temp, 5.5);
    cleanup(sys);
  });

  it('getTemperatureStatus returns status', async () => {
    const sys = new SmartFoodPantryManagementSystem(createMockHomey());
    await sys.initialize();
    const status = sys.getTemperatureStatus();
    assert(status, 'should return status');
    assert(status.fridge, 'should have fridge status');
    assert(status.freezer, 'should have freezer status');
    cleanup(sys);
  });
});

describe('SmartFoodPantryManagementSystem — waste tracking', () => {
  it('getWasteReport returns report', async () => {
    const sys = new SmartFoodPantryManagementSystem(createMockHomey());
    await sys.initialize();
    const report = sys.getWasteReport('monthly');
    assert(report, 'should return report');
    assertType(report.totalItems, 'number');
    assertType(report.totalCost, 'number');
    cleanup(sys);
  });
});

describe('SmartFoodPantryManagementSystem — getStatistics', () => {
  it('returns comprehensive statistics', async () => {
    const sys = new SmartFoodPantryManagementSystem(createMockHomey());
    await sys.initialize();
    sys.addItem({ name: 'Apples', category: 'fruit', location: 'pantry', quantity: 5 });
    const stats = sys.getStatistics();
    assertType(stats.totalItems, 'number');
    assert(stats.totalItems > 0, 'should have items');
    assert(stats.zoneBreakdown, 'should have zone breakdown');
    assert(stats.categoryBreakdown, 'should have category breakdown');
    cleanup(sys);
  });
});

describe('SmartFoodPantryManagementSystem — destroy', () => {
  it('cleans up monitoring timer', async () => {
    const sys = new SmartFoodPantryManagementSystem(createMockHomey());
    await sys.initialize();
    sys.destroy();
    assertEqual(sys.monitoringTimer, null);
    cleanup(sys);
  });
});

run();
