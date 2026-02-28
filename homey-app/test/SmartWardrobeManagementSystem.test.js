'use strict';

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertType } = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');

/* ── timer-leak prevention ─────────────────────────────── */
const _origSetTimeout = global.setTimeout;
const _origSetInterval = global.setInterval;
const activeHandles = [];
global.setTimeout = (...a) => { const id = _origSetTimeout(...a); activeHandles.push({ type: 'timeout', id }); return id; };
global.setInterval = (...a) => { const id = _origSetInterval(...a); activeHandles.push({ type: 'interval', id }); return id; };
function cleanup(sys) {
  try { sys.destroy(); } catch (_) { /* ignore */ }
  while (activeHandles.length > 0) {
    const h = activeHandles.pop();
    if (h.type === 'timeout') clearTimeout(h.id); else clearInterval(h.id);
  }
}

const SmartWardrobeManagementSystem = require('../lib/SmartWardrobeManagementSystem');

/* ═══════════════ Constructor ═══════════════ */
describe('SmartWardrobeManagementSystem – constructor', () => {
  it('creates instance with default properties', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      assert(Array.isArray(sys.inventory), 'inventory is array');
      assertEqual(sys.inventory.length, 0);
      assertEqual(sys.maxInventorySize, 200);
      assert(Array.isArray(sys.outfitHistory), 'outfitHistory is array');
      assert(Array.isArray(sys.styleProfiles), 'styleProfiles is array');
      assert(Array.isArray(sys.wishlist), 'wishlist is array');
      assertType(sys.shoppingBudget, 'object');
      assertEqual(sys.shoppingBudget.monthly, 200);
      assertEqual(sys.shoppingBudget.annual, 2000);
      assertEqual(sys.shoppingBudget.spentMonthly, 0);
      assertEqual(sys.shoppingBudget.spentAnnual, 0);
      assertEqual(sys.shoeSlots, 12);
      assertType(sys.closetEnvironment, 'object');
      assertEqual(sys.closetEnvironment.humidity, 50);
      assertEqual(sys.closetEnvironment.temperature, 20);
    } finally { cleanup(sys); }
  });
});

/* ═══════════════ initialize ═══════════════ */
describe('SmartWardrobeManagementSystem – initialize', () => {
  it('runs without error', async () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      await sys.initialize();
    } finally { cleanup(sys); }
  });
});

/* ═══════════════ addClothingItem ═══════════════ */
describe('SmartWardrobeManagementSystem – addClothingItem', () => {
  it('adds a valid item and returns it', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      const item = sys.addClothingItem({ type: 'shirt', color: 'blue', name: 'Blue Oxford' });
      assert(item !== null, 'returned item');
      assertEqual(item.type, 'shirt');
      assertEqual(item.color, 'blue');
      assertEqual(item.name, 'Blue Oxford');
      assert(item.id.startsWith('wrd_'), 'id prefix');
      assertEqual(item.laundryStatus, 'clean');
      assertEqual(item.wearCount, 0);
      assertEqual(sys.inventory.length, 1);
    } finally { cleanup(sys); }
  });

  it('applies defaults for optional fields', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      const item = sys.addClothingItem({ type: 'pants' });
      assertEqual(item.color, 'black');
      assertEqual(item.brand, 'Unknown');
      assertEqual(item.size, 'M');
      assertEqual(item.material, 'cotton');
      assertEqual(item.season, 'all');
      assertEqual(item.formality, 'casual');
      assertEqual(item.condition, 'new');
      assertEqual(item.cost, 0);
    } finally { cleanup(sys); }
  });

  it('returns null for invalid type', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      const result = sys.addClothingItem({ type: 'jetpack' });
      assertEqual(result, null);
    } finally { cleanup(sys); }
  });

  it('returns null for invalid material', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      const result = sys.addClothingItem({ type: 'shirt', material: 'kryptonite' });
      assertEqual(result, null);
    } finally { cleanup(sys); }
  });

  it('returns null when inventory full', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      sys.maxInventorySize = 1;
      sys.addClothingItem({ type: 'shirt' });
      const result = sys.addClothingItem({ type: 'pants' });
      assertEqual(result, null);
    } finally { cleanup(sys); }
  });
});

/* ═══════════════ removeClothingItem ═══════════════ */
describe('SmartWardrobeManagementSystem – removeClothingItem', () => {
  it('removes existing item', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      const item = sys.addClothingItem({ type: 'shirt' });
      assertEqual(sys.removeClothingItem(item.id), true);
      assertEqual(sys.inventory.length, 0);
    } finally { cleanup(sys); }
  });

  it('returns false for unknown id', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      assertEqual(sys.removeClothingItem('nope'), false);
    } finally { cleanup(sys); }
  });
});

/* ═══════════════ updateClothingItem ═══════════════ */
describe('SmartWardrobeManagementSystem – updateClothingItem', () => {
  it('updates allowed fields', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      const item = sys.addClothingItem({ type: 'shirt', color: 'blue' });
      const updated = sys.updateClothingItem(item.id, { color: 'red' });
      assertEqual(updated.color, 'red');
    } finally { cleanup(sys); }
  });

  it('protects id and addedAt', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      const item = sys.addClothingItem({ type: 'shirt' });
      const origId = item.id;
      const origAdded = item.addedAt;
      sys.updateClothingItem(item.id, { id: 'x', addedAt: 'x' });
      assertEqual(item.id, origId);
      assertEqual(item.addedAt, origAdded);
    } finally { cleanup(sys); }
  });

  it('returns null for unknown id', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      assertEqual(sys.updateClothingItem('nope', { color: 'red' }), null);
    } finally { cleanup(sys); }
  });
});

/* ═══════════════ getInventory ═══════════════ */
describe('SmartWardrobeManagementSystem – getInventory', () => {
  it('returns all items with no filter', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      sys.addClothingItem({ type: 'shirt' });
      sys.addClothingItem({ type: 'pants' });
      assertEqual(sys.getInventory().length, 2);
    } finally { cleanup(sys); }
  });

  it('filters by type', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      sys.addClothingItem({ type: 'shirt' });
      sys.addClothingItem({ type: 'pants' });
      const shirts = sys.getInventory({ type: 'shirt' });
      assertEqual(shirts.length, 1);
      assertEqual(shirts[0].type, 'shirt');
    } finally { cleanup(sys); }
  });

  it('season filter includes all-season items', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      sys.addClothingItem({ type: 'shirt', season: 'all' });
      sys.addClothingItem({ type: 'jacket', season: 'winter' });
      const spring = sys.getInventory({ season: 'spring' });
      assertEqual(spring.length, 1);
      assertEqual(spring[0].season, 'all');
    } finally { cleanup(sys); }
  });
});

/* ═══════════════ getItemById ═══════════════ */
describe('SmartWardrobeManagementSystem – getItemById', () => {
  it('returns item by id', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      const item = sys.addClothingItem({ type: 'shirt', name: 'Test' });
      const found = sys.getItemById(item.id);
      assertEqual(found.name, 'Test');
    } finally { cleanup(sys); }
  });

  it('returns null for unknown id', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      assertEqual(sys.getItemById('nope'), null);
    } finally { cleanup(sys); }
  });
});

/* ═══════════════ wearItem ═══════════════ */
describe('SmartWardrobeManagementSystem – wearItem', () => {
  it('increments wear counts and sets lastWorn', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      const item = sys.addClothingItem({ type: 'shirt' });
      const worn = sys.wearItem(item.id);
      assertEqual(worn.wearCount, 1);
      assertEqual(worn.totalWearCount, 1);
      assert(worn.lastWorn !== null, 'lastWorn set');
    } finally { cleanup(sys); }
  });

  it('returns null for unknown id', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      assertEqual(sys.wearItem('nope'), null);
    } finally { cleanup(sys); }
  });

  it('returns null for dirty item', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      const item = sys.addClothingItem({ type: 'shirt' });
      item.laundryStatus = 'dirty';
      assertEqual(sys.wearItem(item.id), null);
    } finally { cleanup(sys); }
  });
});

/* ═══════════════ laundry cycle ═══════════════ */
describe('SmartWardrobeManagementSystem – laundry cycle', () => {
  it('startWashing transitions dirty items to washing', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      const item = sys.addClothingItem({ type: 'shirt' });
      item.laundryStatus = 'dirty';
      const result = sys.startWashing([item.id]);
      assertEqual(result.length, 1);
      assertEqual(result[0].status, 'washing');
      assertEqual(item.laundryStatus, 'washing');
    } finally { cleanup(sys); }
  });

  it('finishWashing resets wearCount and sets clean', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      const item = sys.addClothingItem({ type: 'shirt' });
      item.laundryStatus = 'washing';
      item.wearCount = 3;
      const result = sys.finishWashing([item.id]);
      assertEqual(result.length, 1);
      assertEqual(result[0].status, 'clean');
      assertEqual(item.wearCount, 0);
    } finally { cleanup(sys); }
  });

  it('finishWashing sets needsIroning for linen', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      const item = sys.addClothingItem({ type: 'shirt', material: 'linen' });
      item.laundryStatus = 'washing';
      const result = sys.finishWashing([item.id]);
      assertEqual(result[0].needsIroning, true);
      assertEqual(item.needsIroning, true);
    } finally { cleanup(sys); }
  });
});

/* ═══════════════ getLaundryLoads ═══════════════ */
describe('SmartWardrobeManagementSystem – getLaundryLoads', () => {
  it('returns empty when all clean', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      sys.addClothingItem({ type: 'shirt' });
      const loads = sys.getLaundryLoads();
      assertEqual(loads.length, 0);
    } finally { cleanup(sys); }
  });

  it('groups dirty items into loads', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      const a = sys.addClothingItem({ type: 'shirt', color: 'white', material: 'cotton' });
      a.laundryStatus = 'dirty';
      const loads = sys.getLaundryLoads();
      assert(loads.length > 0, 'has loads');
      assert(loads[0].items.length > 0, 'load has items');
    } finally { cleanup(sys); }
  });
});

/* ═══════════════ getWashCare ═══════════════ */
describe('SmartWardrobeManagementSystem – getWashCare', () => {
  it('returns care info for known item', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      const item = sys.addClothingItem({ type: 'shirt', material: 'cotton' });
      const care = sys.getWashCare(item.id);
      assertType(care, 'object');
      assertEqual(care.material, 'cotton');
      assertType(care.care, 'object');
    } finally { cleanup(sys); }
  });

  it('returns null for unknown item', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      assertEqual(sys.getWashCare('nope'), null);
    } finally { cleanup(sys); }
  });
});

/* ═══════════════ getItemsByLaundryStatus ═══════════════ */
describe('SmartWardrobeManagementSystem – getItemsByLaundryStatus', () => {
  it('filters by status', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      const a = sys.addClothingItem({ type: 'shirt' });
      const _b = sys.addClothingItem({ type: 'pants' });
      a.laundryStatus = 'dirty';
      assertEqual(sys.getItemsByLaundryStatus('dirty').length, 1);
      assertEqual(sys.getItemsByLaundryStatus('clean').length, 1);
    } finally { cleanup(sys); }
  });

  it('returns empty for invalid status', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      assertEqual(sys.getItemsByLaundryStatus('teleported').length, 0);
    } finally { cleanup(sys); }
  });
});

/* ═══════════════ getSeasonalRotation ═══════════════ */
describe('SmartWardrobeManagementSystem – getSeasonalRotation', () => {
  it('returns rotation object with expected keys', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      sys.addClothingItem({ type: 'jacket', season: 'winter' });
      sys.addClothingItem({ type: 'shorts', season: 'summer' });
      const rot = sys.getSeasonalRotation();
      assertType(rot.currentSeason, 'string');
      assert(Array.isArray(rot.bringOut), 'bringOut');
      assert(Array.isArray(rot.storeAway), 'storeAway');
      assert(Array.isArray(rot.storageTips), 'storageTips');
    } finally { cleanup(sys); }
  });
});

/* ═══════════════ getCurrentSeason ═══════════════ */
describe('SmartWardrobeManagementSystem – getCurrentSeason', () => {
  it('returns correct season for July', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      assertEqual(sys.getCurrentSeason(new Date(2024, 6, 15)), 'summer');
    } finally { cleanup(sys); }
  });

  it('returns correct season for January', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      assertEqual(sys.getCurrentSeason(new Date(2024, 0, 15)), 'winter');
    } finally { cleanup(sys); }
  });
});

/* ═══════════════ recordOutfit ═══════════════ */
describe('SmartWardrobeManagementSystem – recordOutfit', () => {
  it('records outfit with valid items', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      const item = sys.addClothingItem({ type: 'shirt', name: 'A' });
      const outfit = sys.recordOutfit([item.id], 4);
      assert(outfit !== null, 'outfit recorded');
      assertEqual(outfit.items.length, 1);
      assertEqual(outfit.rating, 4);
      assertEqual(outfit.isFavorite, false);
      assertEqual(sys.outfitHistory.length, 1);
    } finally { cleanup(sys); }
  });

  it('returns null for no valid items', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      assertEqual(sys.recordOutfit(['nonexistent']), null);
    } finally { cleanup(sys); }
  });

  it('clamps rating to 1-5', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      const item = sys.addClothingItem({ type: 'shirt' });
      const outfit = sys.recordOutfit([item.id], 10);
      assertEqual(outfit.rating, 5);
    } finally { cleanup(sys); }
  });
});

/* ═══════════════ toggleFavoriteOutfit ═══════════════ */
describe('SmartWardrobeManagementSystem – toggleFavoriteOutfit', () => {
  it('toggles favorite status', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      const item = sys.addClothingItem({ type: 'shirt' });
      const outfit = sys.recordOutfit([item.id]);
      const toggled = sys.toggleFavoriteOutfit(outfit.id);
      assertEqual(toggled.isFavorite, true);
      sys.toggleFavoriteOutfit(outfit.id);
      assertEqual(outfit.isFavorite, false);
    } finally { cleanup(sys); }
  });

  it('returns null for unknown outfit', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      assertEqual(sys.toggleFavoriteOutfit('nope'), null);
    } finally { cleanup(sys); }
  });
});

/* ═══════════════ rateOutfit ═══════════════ */
describe('SmartWardrobeManagementSystem – rateOutfit', () => {
  it('sets rating clamped 1-5', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      const item = sys.addClothingItem({ type: 'shirt' });
      const outfit = sys.recordOutfit([item.id]);
      sys.rateOutfit(outfit.id, 0);
      assertEqual(outfit.rating, 1);
      sys.rateOutfit(outfit.id, 99);
      assertEqual(outfit.rating, 5);
    } finally { cleanup(sys); }
  });
});

/* ═══════════════ getFavoriteOutfits ═══════════════ */
describe('SmartWardrobeManagementSystem – getFavoriteOutfits', () => {
  it('returns only favorites', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      const item = sys.addClothingItem({ type: 'shirt' });
      const o1 = sys.recordOutfit([item.id]);
      sys.recordOutfit([item.id]);
      sys.toggleFavoriteOutfit(o1.id);
      assertEqual(sys.getFavoriteOutfits().length, 1);
    } finally { cleanup(sys); }
  });
});

/* ═══════════════ getOutfitHistory ═══════════════ */
describe('SmartWardrobeManagementSystem – getOutfitHistory', () => {
  it('returns all if no limit', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      const item = sys.addClothingItem({ type: 'shirt' });
      sys.recordOutfit([item.id]);
      sys.recordOutfit([item.id]);
      assertEqual(sys.getOutfitHistory().length, 2);
    } finally { cleanup(sys); }
  });

  it('respects limit parameter', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      const item = sys.addClothingItem({ type: 'shirt' });
      sys.recordOutfit([item.id]);
      sys.recordOutfit([item.id]);
      sys.recordOutfit([item.id]);
      assertEqual(sys.getOutfitHistory(2).length, 2);
    } finally { cleanup(sys); }
  });
});

/* ═══════════════ Style Profiles ═══════════════ */
describe('SmartWardrobeManagementSystem – style profiles', () => {
  it('creates profile with defaults', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      const p = sys.createStyleProfile({ name: 'Alice' });
      assertEqual(p.name, 'Alice');
      assertType(p.id, 'string');
      assert(Array.isArray(p.preferredColors), 'preferredColors');
      assertEqual(p.budgetTier, 'mid');
      assertEqual(sys.styleProfiles.length, 1);
    } finally { cleanup(sys); }
  });

  it('returns null when at max profiles', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      for (let i = 0; i < 6; i++) sys.createStyleProfile({ name: `P${i}` });
      assertEqual(sys.createStyleProfile({ name: 'Extra' }), null);
    } finally { cleanup(sys); }
  });

  it('updates profile preserving id', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      const p = sys.createStyleProfile({ name: 'Bob' });
      const updated = sys.updateStyleProfile(p.id, { name: 'Bobby', id: 'hack' });
      assertEqual(updated.name, 'Bobby');
      assertEqual(updated.id, p.id);
    } finally { cleanup(sys); }
  });

  it('removes profile', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      const p = sys.createStyleProfile({ name: 'Bob' });
      assertEqual(sys.removeStyleProfile(p.id), true);
      assertEqual(sys.styleProfiles.length, 0);
      assertEqual(sys.removeStyleProfile('nope'), false);
    } finally { cleanup(sys); }
  });

  it('getStyleProfile returns null for unknown', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      assertEqual(sys.getStyleProfile('nope'), null);
    } finally { cleanup(sys); }
  });

  it('getAllStyleProfiles returns all', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      sys.createStyleProfile({ name: 'A' });
      sys.createStyleProfile({ name: 'B' });
      assertEqual(sys.getAllStyleProfiles().length, 2);
    } finally { cleanup(sys); }
  });
});

/* ═══════════════ Capsule Wardrobe ═══════════════ */
describe('SmartWardrobeManagementSystem – analyzeCapsuleWardrobe', () => {
  it('returns analysis object', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      sys.addClothingItem({ type: 'shirt', color: 'white', formality: 'casual' });
      const result = sys.analyzeCapsuleWardrobe();
      assertType(result.totalItems, 'number');
      assertEqual(result.capsuleTarget, 33);
      assert(Array.isArray(result.gapAnalysis), 'gapAnalysis');
      assert(Array.isArray(result.versatilityScores), 'versatilityScores');
      assert(Array.isArray(result.costPerWear), 'costPerWear');
    } finally { cleanup(sys); }
  });
});

/* ═══════════════ Wishlist ═══════════════ */
describe('SmartWardrobeManagementSystem – wishlist', () => {
  it('adds and removes wishlist items', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      const w = sys.addToWishlist({ name: 'Red Scarf', type: 'accessory' });
      assertType(w.id, 'string');
      assertEqual(w.name, 'Red Scarf');
      assertEqual(sys.wishlist.length, 1);
      assertEqual(sys.removeFromWishlist(w.id), true);
      assertEqual(sys.wishlist.length, 0);
      assertEqual(sys.removeFromWishlist('nope'), false);
    } finally { cleanup(sys); }
  });
});

/* ═══════════════ Budget ═══════════════ */
describe('SmartWardrobeManagementSystem – budget', () => {
  it('updates budget fields', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      const b = sys.updateBudget({ monthly: 500 });
      assertEqual(b.monthly, 500);
    } finally { cleanup(sys); }
  });

  it('records purchase and computes remaining', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      const result = sys.recordPurchase(50);
      assertEqual(result.budget.spentMonthly, 50);
      assertEqual(result.monthlyRemaining, 150);
      assertEqual(result.annualRemaining, 1950);
    } finally { cleanup(sys); }
  });
});

/* ═══════════════ Packing Lists ═══════════════ */
describe('SmartWardrobeManagementSystem – packing lists', () => {
  it('generates packing list with defaults', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      const pl = sys.generatePackingList({ destination: 'Paris', duration: 5 });
      assertEqual(pl.destination, 'Paris');
      assertEqual(pl.duration, 5);
      assert(Array.isArray(pl.items), 'items');
      assert(Array.isArray(pl.checklist), 'checklist');
      assertEqual(sys.packingLists.length, 1);
    } finally { cleanup(sys); }
  });

  it('confirmPackingItem confirms checklist entry', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      const pl = sys.generatePackingList({ destination: 'Rome' });
      if (pl.checklist.length > 0) {
        assertEqual(sys.confirmPackingItem(pl.id, 0), true);
        assertEqual(pl.checklist[0].confirmed, true);
      }
    } finally { cleanup(sys); }
  });

  it('getPackingProgress returns progress', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      const pl = sys.generatePackingList({ destination: 'Tokyo' });
      const progress = sys.getPackingProgress(pl.id);
      assert(progress !== null, 'progress returned');
      assertEqual(progress.destination, 'Tokyo');
      assertType(progress.percentComplete, 'number');
    } finally { cleanup(sys); }
  });

  it('getPackingProgress returns null for unknown', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      assertEqual(sys.getPackingProgress('nope'), null);
    } finally { cleanup(sys); }
  });
});

/* ═══════════════ getColorAnalysis ═══════════════ */
describe('SmartWardrobeManagementSystem – getColorAnalysis', () => {
  it('returns error when profile not found', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      const result = sys.getColorAnalysis('nope');
      assertType(result.error, 'string');
    } finally { cleanup(sys); }
  });

  it('returns analysis for profile with colorSeason', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      const p = sys.createStyleProfile({ name: 'Tester', colorSeason: 'spring' });
      sys.addClothingItem({ type: 'shirt', color: 'blue', profileId: p.id });
      const result = sys.getColorAnalysis(p.id);
      assertEqual(result.colorSeason, 'spring');
      assert(Array.isArray(result.bestColors), 'bestColors');
    } finally { cleanup(sys); }
  });
});

/* ═══════════════ Closet Organization ═══════════════ */
describe('SmartWardrobeManagementSystem – closet organization', () => {
  it('returns organization with layout and alerts', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      sys.addClothingItem({ type: 'shirt' });
      const org = sys.getClosetOrganization();
      assert(Array.isArray(org.layout), 'layout');
      assertType(org.environment, 'object');
      assert(Array.isArray(org.alerts), 'alerts');
    } finally { cleanup(sys); }
  });

  it('updateClosetEnvironment updates readings', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      sys.updateClosetEnvironment({ humidity: 70, temperature: 25 });
      assertEqual(sys.closetEnvironment.humidity, 70);
      assertEqual(sys.closetEnvironment.temperature, 25);
    } finally { cleanup(sys); }
  });

  it('recordMothCheck sets lastMothCheck', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      sys.recordMothCheck();
      assert(sys.closetEnvironment.lastMothCheck !== null, 'lastMothCheck set');
    } finally { cleanup(sys); }
  });
});

/* ═══════════════ Donation ═══════════════ */
describe('SmartWardrobeManagementSystem – donations', () => {
  it('getDonationSuggestions returns expected structure', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      const ds = sys.getDonationSuggestions();
      assert(Array.isArray(ds.items), 'items');
      assertType(ds.totalItems, 'number');
      assertType(ds.totalEstimatedValue, 'number');
    } finally { cleanup(sys); }
  });

  it('donateItems removes items from inventory', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      const item = sys.addClothingItem({ type: 'shirt' });
      const donated = sys.donateItems([item.id]);
      assertEqual(donated.length, 1);
      assertEqual(sys.inventory.length, 0);
    } finally { cleanup(sys); }
  });
});

/* ═══════════════ getFashionTrends ═══════════════ */
describe('SmartWardrobeManagementSystem – getFashionTrends', () => {
  it('returns trends object', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      sys.addClothingItem({ type: 'shirt' });
      const trends = sys.getFashionTrends();
      assertType(trends.season, 'string');
      assert(Array.isArray(trends.trends), 'trends array');
      assertType(trends.overallTrendScore, 'number');
    } finally { cleanup(sys); }
  });
});

/* ═══════════════ Ironing ═══════════════ */
describe('SmartWardrobeManagementSystem – ironing', () => {
  it('getIroningQueue returns queue structure', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      const q = sys.getIroningQueue();
      assert(Array.isArray(q.items), 'items');
      assertType(q.totalItems, 'number');
      assertType(q.tip, 'string');
    } finally { cleanup(sys); }
  });

  it('markIroned clears ironing flag', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      const item = sys.addClothingItem({ type: 'shirt', material: 'linen' });
      item.needsIroning = true;
      sys.ironingQueue.push(item);
      assertEqual(sys.markIroned(item.id), true);
      assertEqual(item.needsIroning, false);
    } finally { cleanup(sys); }
  });

  it('markIroned returns false for unknown', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      assertEqual(sys.markIroned('nope'), false);
    } finally { cleanup(sys); }
  });
});

/* ═══════════════ Shoe Management ═══════════════ */
describe('SmartWardrobeManagementSystem – getShoeManagement', () => {
  it('returns shoe data', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      sys.addClothingItem({ type: 'shoes', name: 'Loafers', material: 'leather' });
      const shoes = sys.getShoeManagement();
      assertEqual(shoes.totalPairs, 1);
      assertEqual(shoes.maxSlots, 12);
      assertEqual(shoes.slotsAvailable, 11);
      assert(Array.isArray(shoes.shoes), 'shoes array');
    } finally { cleanup(sys); }
  });
});

/* ═══════════════ Environmental Impact ═══════════════ */
describe('SmartWardrobeManagementSystem – getEnvironmentalImpact', () => {
  it('returns impact data', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      sys.addClothingItem({ type: 'shirt', material: 'cotton' });
      const impact = sys.getEnvironmentalImpact();
      assertEqual(impact.totalItems, 1);
      assertType(impact.sustainabilityScore, 'number');
      assertType(impact.carbonFootprint, 'string');
      assert(Array.isArray(impact.materialBreakdown), 'materialBreakdown');
      assert(Array.isArray(impact.ecoTips), 'ecoTips');
    } finally { cleanup(sys); }
  });
});

/* ═══════════════ Weather ═══════════════ */
describe('SmartWardrobeManagementSystem – weather', () => {
  it('updateWeather changes current weather', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      sys.updateWeather({ temperature: -5, rainProbability: 80 });
      assertEqual(sys.currentWeather.temperature, -5);
      assertEqual(sys.currentWeather.rainProbability, 80);
    } finally { cleanup(sys); }
  });

  it('getWeatherSuggestions returns suggestions', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      const s = sys.getWeatherSuggestions({ temperature: -10, rainProbability: 90, windSpeed: 30 });
      assert(Array.isArray(s.layers), 'layers');
      assert(Array.isArray(s.accessories), 'accessories');
      assert(Array.isArray(s.reminders), 'reminders');
    } finally { cleanup(sys); }
  });
});

/* ═══════════════ Calendar ═══════════════ */
describe('SmartWardrobeManagementSystem – updateCalendarEvents', () => {
  it('sets calendar events', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      sys.updateCalendarEvents([{ name: 'Meeting' }]);
      assertEqual(sys.calendarEvents.length, 1);
    } finally { cleanup(sys); }
  });

  it('resets to empty for non-array', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      sys.updateCalendarEvents('not an array');
      assertEqual(sys.calendarEvents.length, 0);
    } finally { cleanup(sys); }
  });
});

/* ═══════════════ getOutfitOfTheDay ═══════════════ */
describe('SmartWardrobeManagementSystem – getOutfitOfTheDay', () => {
  it('returns null before initialize', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      assertEqual(sys.getOutfitOfTheDay(), null);
    } finally { cleanup(sys); }
  });
});

/* ═══════════════ getStatistics ═══════════════ */
describe('SmartWardrobeManagementSystem – getStatistics', () => {
  it('returns comprehensive stats', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      sys.addClothingItem({ type: 'shirt', cost: 100 });
      const stats = sys.getStatistics();
      assertEqual(stats.totalItems, 1);
      assertEqual(stats.maxCapacity, 200);
      assertType(stats.capacityUsed, 'number');
      assertType(stats.typeDistribution, 'object');
      assertType(stats.laundryStatus, 'object');
      assertType(stats.costAnalysis, 'object');
      assertEqual(stats.costAnalysis.totalWardrobeValue, 100);
      assertType(stats.budgetStatus, 'object');
      assertEqual(stats.shoeSlots, 12);
    } finally { cleanup(sys); }
  });
});

/* ═══════════════ getShoppingSuggestions ═══════════════ */
describe('SmartWardrobeManagementSystem – getShoppingSuggestions', () => {
  it('returns suggestions structure', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      const s = sys.getShoppingSuggestions();
      assert(Array.isArray(s.gapItems), 'gapItems');
      assert(Array.isArray(s.replacements), 'replacements');
      assert(Array.isArray(s.seasonalNeeds), 'seasonalNeeds');
      assertType(s.budgetStatus, 'object');
    } finally { cleanup(sys); }
  });
});

/* ═══════════════ getMostWornCombinations ═══════════════ */
describe('SmartWardrobeManagementSystem – getMostWornCombinations', () => {
  it('returns empty for no outfit history', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      assertEqual(sys.getMostWornCombinations().length, 0);
    } finally { cleanup(sys); }
  });
});

/* ═══════════════ generateOutfitRecommendation ═══════════════ */
describe('SmartWardrobeManagementSystem – generateOutfitRecommendation', () => {
  it('returns null with no inventory', async () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      const rec = await sys.generateOutfitRecommendation();
      assertEqual(rec, null);
    } finally { cleanup(sys); }
  });

  it('recommends outfit from available items', async () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      sys.addClothingItem({ type: 'shirt', season: 'all', formality: 'casual' });
      sys.addClothingItem({ type: 'pants', season: 'all', formality: 'casual' });
      sys.addClothingItem({ type: 'shoes', season: 'all', formality: 'casual' });
      const rec = await sys.generateOutfitRecommendation({ occasion: 'casual' });
      if (rec) {
        assert(Array.isArray(rec.items), 'items');
        assertType(rec.score, 'number');
      }
    } finally { cleanup(sys); }
  });
});

/* ═══════════════ getWrinkleAlerts ═══════════════ */
describe('SmartWardrobeManagementSystem – getWrinkleAlerts', () => {
  it('returns alerts for wrinkle-prone materials', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      sys.addClothingItem({ type: 'shirt', material: 'linen' });
      const alerts = sys.getWrinkleAlerts();
      assert(Array.isArray(alerts), 'is array');
    } finally { cleanup(sys); }
  });
});

/* ═══════════════ destroy ═══════════════ */
describe('SmartWardrobeManagementSystem – destroy', () => {
  it('clears all data', () => {
    const sys = new SmartWardrobeManagementSystem(createMockHomey());
    try {
      sys.addClothingItem({ type: 'shirt' });
      sys.createStyleProfile({ name: 'X' });
      sys.destroy();
      assertEqual(sys.inventory.length, 0);
      assertEqual(sys.outfitHistory.length, 0);
      assertEqual(sys.styleProfiles.length, 0);
      assertEqual(sys.wishlist.length, 0);
      assertEqual(sys.outfitOfTheDay, null);
    } finally { cleanup(sys); }
  });
});

run();
