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

const HomeBarManagementSystem = require('../lib/HomeBarManagementSystem');

describe('HomeBar — constructor & lifecycle', () => {
  it('instantiates without errors', () => {
    const sys = new HomeBarManagementSystem(createMockHomey());
    assert(sys, 'should create instance');
    cleanup(sys);
  });

  it('constructor sets empty collections', () => {
    const sys = new HomeBarManagementSystem(createMockHomey());
    assertEqual(sys.inventory.size, 0);
    assertEqual(sys.cocktails.size, 0);
    assertEqual(sys.drinkHistory.length, 0);
    assertEqual(sys.shoppingList.length, 0);
    cleanup(sys);
  });

  it('initialize populates inventory and cocktails', async () => {
    const sys = new HomeBarManagementSystem(createMockHomey());
    await sys.initialize();
    assert(sys.inventory.size > 0, 'should have inventory');
    assert(sys.cocktails.size > 0, 'should have cocktails');
    assert(sys.storage.size > 0, 'should have storage zones');
    cleanup(sys);
  });

  it('destroy clears monitoring', async () => {
    const sys = new HomeBarManagementSystem(createMockHomey());
    await sys.initialize();
    await sys.destroy();
    cleanup(sys);
  });
});

describe('HomeBar — inventory', () => {
  it('getInventory returns all items', async () => {
    const sys = new HomeBarManagementSystem(createMockHomey());
    await sys.initialize();
    const items = sys.getInventory();
    assert(Array.isArray(items), 'should be array');
    assert(items.length > 0, 'should have items');
    cleanup(sys);
  });

  it('getInventory filters by category', async () => {
    const sys = new HomeBarManagementSystem(createMockHomey());
    await sys.initialize();
    const spirits = sys.getInventory({ category: 'spirits' });
    assert(spirits.length > 0, 'should have spirits');
    for (const item of spirits) {
      assertEqual(item.category, 'spirits');
    }
    cleanup(sys);
  });

  it('getInventory filters by storageZone', async () => {
    const sys = new HomeBarManagementSystem(createMockHomey());
    await sys.initialize();
    const fridgeItems = sys.getInventory({ storageZone: 'fridge' });
    for (const item of fridgeItems) {
      assertEqual(item.storageZone, 'fridge');
    }
    cleanup(sys);
  });
});

describe('HomeBar — cocktails', () => {
  it('getCocktails returns all cocktails', async () => {
    const sys = new HomeBarManagementSystem(createMockHomey());
    await sys.initialize();
    const cocktails = sys.getCocktails();
    assert(Array.isArray(cocktails), 'should be array');
    assert(cocktails.length >= 5, 'should have cocktails');
    cleanup(sys);
  });

  it('getCocktails filters by difficulty', async () => {
    const sys = new HomeBarManagementSystem(createMockHomey());
    await sys.initialize();
    const easy = sys.getCocktails({ difficulty: 'easy' });
    for (const c of easy) {
      assertEqual(c.difficulty, 'easy');
    }
    cleanup(sys);
  });

  it('canMakeCocktail returns boolean', async () => {
    const sys = new HomeBarManagementSystem(createMockHomey());
    await sys.initialize();
    const result = sys.canMakeCocktail('gin-tonic');
    assertType(result, 'boolean');
    cleanup(sys);
  });

  it('canMakeCocktail returns false for unknown cocktail', async () => {
    const sys = new HomeBarManagementSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.canMakeCocktail('nonexistent'), false);
    cleanup(sys);
  });

  it('makeCocktail deducts ingredients and records history', async () => {
    const sys = new HomeBarManagementSystem(createMockHomey());
    await sys.initialize();
    const ginBefore = sys.inventory.get('spirit-001').volumeRemaining;
    const result = await sys.makeCocktail('gin-tonic');
    assert(result.cocktail, 'should have cocktail');
    assert(result.drinkRecord, 'should have drinkRecord');
    assert(result.drinkRecord.id, 'should have record id');
    const ginAfter = sys.inventory.get('spirit-001').volumeRemaining;
    assert(ginAfter < ginBefore, 'should deduct gin');
    assert(sys.drinkHistory.length >= 1, 'should record in history');
    cleanup(sys);
  });

  it('makeCocktail throws for unknown cocktail', async () => {
    const sys = new HomeBarManagementSystem(createMockHomey());
    await sys.initialize();
    let threw = false;
    try { await sys.makeCocktail('nonexistent'); } catch (_) { threw = true; }
    assertEqual(threw, true);
    cleanup(sys);
  });

  it('calculateCocktailCost returns number', async () => {
    const sys = new HomeBarManagementSystem(createMockHomey());
    await sys.initialize();
    const cost = sys.calculateCocktailCost('negroni');
    assertType(cost, 'number');
    assert(cost > 0, 'cost should be positive');
    cleanup(sys);
  });

  it('calculateCocktailCost returns 0 for unknown', async () => {
    const sys = new HomeBarManagementSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.calculateCocktailCost('nonexistent'), 0);
    cleanup(sys);
  });

  it('getCocktailRecommendations returns recommendations', async () => {
    const sys = new HomeBarManagementSystem(createMockHomey());
    await sys.initialize();
    const recs = await sys.getCocktailRecommendations();
    assert(Array.isArray(recs), 'should be array');
    cleanup(sys);
  });

  it('getCocktailRecommendations filters by strength', async () => {
    const sys = new HomeBarManagementSystem(createMockHomey());
    await sys.initialize();
    const recs = await sys.getCocktailRecommendations({ strength: 'strong', availableOnly: false });
    for (const c of recs) {
      assertEqual(c.strength, 'strong');
    }
    cleanup(sys);
  });
});

describe('HomeBar — tasting notes', () => {
  it('addTastingNote adds a note', async () => {
    const sys = new HomeBarManagementSystem(createMockHomey());
    await sys.initialize();
    const note = await sys.addTastingNote('spirit-001', {
      rating: 4, nose: 'Juniper', palate: 'Citrus', finish: 'Long', notes: 'Excellent'
    });
    assert(note.id, 'should have id');
    assertEqual(note.rating, 4);
    assertEqual(note.itemName, 'Tanqueray Gin');
    cleanup(sys);
  });

  it('addTastingNote throws for unknown item', async () => {
    const sys = new HomeBarManagementSystem(createMockHomey());
    await sys.initialize();
    let threw = false;
    try { await sys.addTastingNote('nonexistent', {}); } catch (_) { threw = true; }
    assertEqual(threw, true);
    cleanup(sys);
  });

  it('getTastingNotes returns all notes', async () => {
    const sys = new HomeBarManagementSystem(createMockHomey());
    await sys.initialize();
    await sys.addTastingNote('spirit-001', { rating: 5 });
    const notes = sys.getTastingNotes();
    assert(notes.length >= 1, 'should have notes');
    cleanup(sys);
  });

  it('getTastingNotes filters by item', async () => {
    const sys = new HomeBarManagementSystem(createMockHomey());
    await sys.initialize();
    await sys.addTastingNote('spirit-001', { rating: 4 });
    await sys.addTastingNote('spirit-002', { rating: 3 });
    const notes = sys.getTastingNotes('spirit-001');
    assertEqual(notes.length, 1);
    assertEqual(notes[0].itemId, 'spirit-001');
    cleanup(sys);
  });
});

describe('HomeBar — history & stats', () => {
  it('getDrinkHistory returns array', async () => {
    const sys = new HomeBarManagementSystem(createMockHomey());
    await sys.initialize();
    const history = sys.getDrinkHistory();
    assert(Array.isArray(history), 'should be array');
    cleanup(sys);
  });

  it('getShoppingList returns array', async () => {
    const sys = new HomeBarManagementSystem(createMockHomey());
    await sys.initialize();
    const list = sys.getShoppingList();
    assert(Array.isArray(list), 'should be array');
    cleanup(sys);
  });

  it('getStats returns comprehensive stats', async () => {
    const sys = new HomeBarManagementSystem(createMockHomey());
    await sys.initialize();
    const stats = sys.getStats();
    assertType(stats.totalItems, 'number');
    assert(stats.totalItems > 0, 'should have items');
    assert(stats.byCategory, 'should have byCategory');
    assertType(stats.totalCocktails, 'number');
    assertType(stats.totalDrinksMade, 'number');
    assertType(stats.totalInventoryValue, 'number');
    assertType(stats.lowStockItems, 'number');
    cleanup(sys);
  });
});

run();
