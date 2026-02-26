'use strict';

/**
 * SmartFoodPantryManagementSystem
 * [FoodPantry] Comprehensive food inventory, expiry tracking,
 * meal suggestion, nutritional monitoring and waste reduction system.
 */
class SmartFoodPantryManagementSystem {

  constructor(homey) {
    this.homey = homey;

    /** @type {Map<string, object>} Food inventory keyed by item id */
    this.inventory = new Map();

    /** @type {Map<string, object>} Consumption rate tracking per item name */
    this.consumptionRates = new Map();

    /** @type {Array<object>} Food waste log entries */
    this.wasteLog = [];

    /** @type {Map<string, object>} Household member nutrition profiles */
    this.householdMembers = new Map();

    /** @type {object} Fridge / freezer temperature readings */
    this.temperatureReadings = {
      fridge: { current: 4.0, history: [], alertThreshold: 8.0 },
      freezer: { current: -18.0, history: [], alertThreshold: -12.0 },
    };

    /** @type {Array<object>} Recipe library */
    this.recipes = this._buildRecipeLibrary();

    /** @type {object} Zone configuration */
    this.zones = this._buildZones();

    /** @type {object} Settings blob persisted through homey */
    this.settings = {
      expiryWarningDays: 7,
      autoGroceryList: true,
      wasteTrackingEnabled: true,
      temperatureMonitoring: true,
      monitoringIntervalMs: 15 * 60 * 1000,
      preferredStore: 'ICA',
      currency: 'SEK',
    };

    this.monitoringTimer = null;
    this.initialized = false;
    this._itemIdCounter = 1;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async initialize() {
    try {
      this.log('Initializing SmartFoodPantryManagementSystem');
      await this._loadSettings();
      this._startMonitoringLoop();
      this.initialized = true;
      this.log('SmartFoodPantryManagementSystem initialized successfully');
    } catch (error) {
      this.homey.error(`[SmartFoodPantryManagementSystem] Failed to initialize:`, error.message);
    }
  }

  async destroy() {
    this.log('Shutting down SmartFoodPantryManagementSystem');
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }
    await this._saveSettings();
    this.initialized = false;
    this.log('SmartFoodPantryManagementSystem destroyed');
  }

  // ---------------------------------------------------------------------------
  // Zone helpers
  // ---------------------------------------------------------------------------

  _buildZones() {
    return {
      fridge: {
        id: 'fridge',
        label: 'Fridge',
        idealTempMin: 2,
        idealTempMax: 5,
        capacity: 50,
        currentItems: 0,
      },
      freezer: {
        id: 'freezer',
        label: 'Freezer',
        idealTempMin: -22,
        idealTempMax: -16,
        capacity: 40,
        currentItems: 0,
      },
      pantry: {
        id: 'pantry',
        label: 'Pantry',
        idealTempMin: 15,
        idealTempMax: 22,
        capacity: 100,
        currentItems: 0,
      },
      spice_rack: {
        id: 'spice_rack',
        label: 'Spice Rack',
        idealTempMin: 15,
        idealTempMax: 22,
        capacity: 30,
        currentItems: 0,
      },
      countertop: {
        id: 'countertop',
        label: 'Countertop',
        idealTempMin: 18,
        idealTempMax: 25,
        capacity: 20,
        currentItems: 0,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Inventory CRUD
  // ---------------------------------------------------------------------------

  addItem(details) {
    const id = `item_${this._itemIdCounter++}`;
    const now = new Date();

    const item = {
      id,
      name: details.name || 'Unknown Item',
      category: details.category || 'general',
      quantity: typeof details.quantity === 'number' ? details.quantity : 1,
      unit: details.unit || 'pcs',
      expiryDate: details.expiryDate ? new Date(details.expiryDate) : null,
      location: this._validateZone(details.location) ? details.location : 'pantry',
      barcode: details.barcode || null,
      addedDate: now,
      frozenSince: null,
      nutritionalInfo: details.nutritionalInfo || null,
      brand: details.brand || null,
      price: typeof details.price === 'number' ? details.price : 0,
      notes: details.notes || '',
      opened: false,
      openedDate: null,
    };

    if (item.location === 'freezer') {
      item.frozenSince = now;
    }

    this.inventory.set(id, item);
    this._incrementZoneCount(item.location);
    this.log(`Added item "${item.name}" (${id}) to ${item.location}`);
    return item;
  }

  removeItem(itemId, reason) {
    const item = this.inventory.get(itemId);
    if (!item) {
      this.error(`Cannot remove item: ${itemId} not found`);
      return null;
    }

    this.inventory.delete(itemId);
    this._decrementZoneCount(item.location);

    if (reason === 'waste' && this.settings.wasteTrackingEnabled) {
      this._logWaste(item);
    }

    if (reason === 'consumed') {
      this.learnConsumptionRate(item.name, item.quantity, item.unit);
    }

    this.log(`Removed item "${item.name}" (${itemId}), reason: ${reason || 'unspecified'}`);
    return item;
  }

  updateQuantity(itemId, newQuantity) {
    const item = this.inventory.get(itemId);
    if (!item) {
      this.error(`Cannot update quantity: ${itemId} not found`);
      return null;
    }

    const oldQty = item.quantity;
    item.quantity = Math.max(0, newQuantity);
    this.log(`Updated "${item.name}" quantity from ${oldQty} to ${item.quantity} ${item.unit}`);

    if (item.quantity === 0) {
      this.removeItem(itemId, 'consumed');
    }

    return item;
  }

  markOpened(itemId) {
    const item = this.inventory.get(itemId);
    if (!item) {
      this.error(`Cannot mark opened: ${itemId} not found`);
      return null;
    }
    item.opened = true;
    item.openedDate = new Date();
    this.log(`Marked "${item.name}" as opened`);
    return item;
  }

  getItemById(itemId) {
    return this.inventory.get(itemId) || null;
  }

  getItemsByZone(zone) {
    if (!this._validateZone(zone)) {
      this.error(`Invalid zone: ${zone}`);
      return [];
    }
    const items = [];
    for (const item of this.inventory.values()) {
      if (item.location === zone) {
        items.push(item);
      }
    }
    return items;
  }

  getItemsByCategory(category) {
    const items = [];
    for (const item of this.inventory.values()) {
      if (item.category === category) {
        items.push(item);
      }
    }
    return items;
  }

  searchItems(query) {
    const lower = (query || '').toLowerCase();
    const results = [];
    for (const item of this.inventory.values()) {
      const nameMatch = item.name.toLowerCase().includes(lower);
      const barcodeMatch = item.barcode && item.barcode.includes(lower);
      const categoryMatch = item.category.toLowerCase().includes(lower);
      const brandMatch = item.brand && item.brand.toLowerCase().includes(lower);
      if (nameMatch || barcodeMatch || categoryMatch || brandMatch) {
        results.push(item);
      }
    }
    return results;
  }

  moveItem(itemId, newZone) {
    if (!this._validateZone(newZone)) {
      this.error(`Invalid zone: ${newZone}`);
      return null;
    }
    const item = this.inventory.get(itemId);
    if (!item) {
      this.error(`Cannot move item: ${itemId} not found`);
      return null;
    }

    const oldZone = item.location;
    this._decrementZoneCount(oldZone);
    item.location = newZone;
    this._incrementZoneCount(newZone);

    if (newZone === 'freezer' && oldZone !== 'freezer') {
      item.frozenSince = new Date();
    } else if (newZone !== 'freezer') {
      item.frozenSince = null;
    }

    this.log(`Moved "${item.name}" from ${oldZone} to ${newZone}`);
    return item;
  }

  // ---------------------------------------------------------------------------
  // Expiry management
  // ---------------------------------------------------------------------------

  getExpiringSoon(days) {
    const warningDays = typeof days === 'number' ? days : this.settings.expiryWarningDays;
    const now = Date.now();
    const threshold = now + warningDays * 24 * 60 * 60 * 1000;
    const results = [];

    for (const item of this.inventory.values()) {
      if (!item.expiryDate) continue;

      const expiryMs = item.expiryDate.getTime();
      if (expiryMs > threshold) continue;

      const daysRemaining = Math.ceil((expiryMs - now) / (24 * 60 * 60 * 1000));
      let urgency = 'low';
      if (daysRemaining <= 0) {
        urgency = 'expired';
      } else if (daysRemaining <= 1) {
        urgency = 'critical';
      } else if (daysRemaining <= 3) {
        urgency = 'high';
      } else if (daysRemaining <= 5) {
        urgency = 'medium';
      }

      results.push({
        item,
        daysRemaining,
        urgency,
        expiryDate: item.expiryDate,
      });
    }

    results.sort((a, b) => a.daysRemaining - b.daysRemaining);
    return results;
  }

  getExpiredItems() {
    return this.getExpiringSoon(0).filter((r) => r.urgency === 'expired');
  }

  _calculateOpenedShelfLife(item) {
    const openedShelfLifeDays = {
      dairy: 5,
      meat: 3,
      prepared: 4,
      sauce: 14,
      juice: 7,
      general: 7,
    };
    if (!item.opened || !item.openedDate) return null;
    const shelfLife = openedShelfLifeDays[item.category] || openedShelfLifeDays.general;
    const openedMs = item.openedDate.getTime();
    const expiresMs = openedMs + shelfLife * 24 * 60 * 60 * 1000;
    const remaining = Math.ceil((expiresMs - Date.now()) / (24 * 60 * 60 * 1000));
    return { shelfLifeDays: shelfLife, daysRemaining: remaining, expired: remaining <= 0 };
  }

  // ---------------------------------------------------------------------------
  // Grocery list generation
  // ---------------------------------------------------------------------------

  generateGroceryList() {
    const list = [];
    const checked = new Set();

    for (const [name, rate] of this.consumptionRates.entries()) {
      if (checked.has(name)) continue;
      checked.add(name);

      let totalInStock = 0;
      for (const item of this.inventory.values()) {
        if (item.name.toLowerCase() === name.toLowerCase()) {
          totalInStock += item.quantity;
        }
      }

      const weeklyUsage = rate.weeklyAverage || 0;
      if (weeklyUsage <= 0) continue;

      const weeksRemaining = totalInStock / weeklyUsage;
      if (weeksRemaining < 1.5) {
        const needed = Math.ceil(weeklyUsage * 2 - totalInStock);
        if (needed > 0) {
          list.push({
            name,
            neededQuantity: needed,
            unit: rate.unit || 'pcs',
            priority: weeksRemaining < 0.5 ? 'high' : 'normal',
            estimatedPrice: rate.averagePrice || 0,
            preferredStore: this.settings.preferredStore,
            category: rate.category || 'general',
          });
        }
      }
    }

    list.sort((a, b) => {
      if (a.priority === 'high' && b.priority !== 'high') return -1;
      if (b.priority === 'high' && a.priority !== 'high') return 1;
      return a.name.localeCompare(b.name);
    });

    const totalEstimatedCost = list.reduce((sum, item) => {
      return sum + item.estimatedPrice * item.neededQuantity;
    }, 0);

    this.log(`Generated grocery list with ${list.length} items (est. ${totalEstimatedCost} ${this.settings.currency})`);
    return { items: list, totalEstimatedCost, currency: this.settings.currency };
  }

  // ---------------------------------------------------------------------------
  // Consumption rate learning
  // ---------------------------------------------------------------------------

  learnConsumptionRate(name, quantity, unit) {
    const key = name.toLowerCase();
    const now = Date.now();
    const existing = this.consumptionRates.get(key) || {
      name,
      unit: unit || 'pcs',
      category: 'general',
      totalConsumed: 0,
      events: [],
      weeklyAverage: 0,
      averagePrice: 0,
      lastConsumed: null,
    };

    existing.totalConsumed += quantity;
    existing.lastConsumed = new Date();
    existing.events.push({ quantity, timestamp: now });

    // keep last 60 events
    if (existing.events.length > 60) {
      existing.events = existing.events.slice(-60);
    }

    // recalculate weekly average
    if (existing.events.length >= 2) {
      const oldest = existing.events[0].timestamp;
      const weeks = Math.max((now - oldest) / (7 * 24 * 60 * 60 * 1000), 1);
      const totalQty = existing.events.reduce((s, e) => s + e.quantity, 0);
      existing.weeklyAverage = parseFloat((totalQty / weeks).toFixed(2));
    }

    // Update average price from inventory
    let priceSum = 0;
    let priceCount = 0;
    for (const item of this.inventory.values()) {
      if (item.name.toLowerCase() === key && item.price > 0) {
        priceSum += item.price;
        priceCount++;
      }
    }
    if (priceCount > 0) {
      existing.averagePrice = parseFloat((priceSum / priceCount).toFixed(2));
    }

    this.consumptionRates.set(key, existing);
    this.log(`Updated consumption rate for "${name}": ${existing.weeklyAverage} ${unit}/week`);
  }

  getConsumptionInsights() {
    const insights = [];
    for (const [_key, rate] of this.consumptionRates.entries()) {
      if (rate.events.length < 3) continue;
      const weeklyAvg = rate.weeklyAverage;
      const weeklyCost = weeklyAvg * rate.averagePrice;
      insights.push({
        name: rate.name,
        weeklyAverage: weeklyAvg,
        unit: rate.unit,
        weeklyCost: parseFloat(weeklyCost.toFixed(2)),
        monthlyCost: parseFloat((weeklyCost * 4.33).toFixed(2)),
        dataPoints: rate.events.length,
      });
    }
    insights.sort((a, b) => b.monthlyCost - a.monthlyCost);
    return insights;
  }

  // ---------------------------------------------------------------------------
  // Recipe library & meal suggestions
  // ---------------------------------------------------------------------------

  _buildRecipeLibrary() {
    return [
      {
        id: 'r1', name: 'Köttbullar (Swedish Meatballs)', servings: 4,
        ingredients: [
          { name: 'ground beef', quantity: 400, unit: 'g' },
          { name: 'breadcrumbs', quantity: 100, unit: 'g' },
          { name: 'egg', quantity: 1, unit: 'pcs' },
          { name: 'onion', quantity: 1, unit: 'pcs' },
          { name: 'milk', quantity: 100, unit: 'ml' },
          { name: 'cream', quantity: 200, unit: 'ml' },
          { name: 'butter', quantity: 30, unit: 'g' },
        ],
        allergens: ['gluten', 'dairy', 'egg'],
        prepTimeMin: 45, category: 'dinner',
        tags: ['swedish', 'traditional'],
      },
      {
        id: 'r2', name: 'Pannkakor (Swedish Pancakes)', servings: 4,
        ingredients: [
          { name: 'flour', quantity: 300, unit: 'g' },
          { name: 'milk', quantity: 600, unit: 'ml' },
          { name: 'egg', quantity: 3, unit: 'pcs' },
          { name: 'butter', quantity: 30, unit: 'g' },
          { name: 'sugar', quantity: 20, unit: 'g' },
        ],
        allergens: ['gluten', 'dairy', 'egg'],
        prepTimeMin: 25, category: 'breakfast',
        tags: ['swedish', 'easy'],
      },
      {
        id: 'r3', name: 'Laxpasta (Salmon Pasta)', servings: 4,
        ingredients: [
          { name: 'salmon fillet', quantity: 400, unit: 'g' },
          { name: 'pasta', quantity: 400, unit: 'g' },
          { name: 'cream', quantity: 200, unit: 'ml' },
          { name: 'lemon', quantity: 1, unit: 'pcs' },
          { name: 'dill', quantity: 10, unit: 'g' },
          { name: 'garlic', quantity: 2, unit: 'pcs' },
        ],
        allergens: ['gluten', 'dairy', 'fish'],
        prepTimeMin: 30, category: 'dinner',
        tags: ['swedish', 'fish'],
      },
      {
        id: 'r4', name: 'Ärtsoppa (Yellow Pea Soup)', servings: 6,
        ingredients: [
          { name: 'dried yellow peas', quantity: 500, unit: 'g' },
          { name: 'onion', quantity: 1, unit: 'pcs' },
          { name: 'carrot', quantity: 2, unit: 'pcs' },
          { name: 'pork belly', quantity: 300, unit: 'g' },
          { name: 'thyme', quantity: 5, unit: 'g' },
        ],
        allergens: [],
        prepTimeMin: 90, category: 'dinner',
        tags: ['swedish', 'traditional', 'thursday'],
      },
      {
        id: 'r5', name: 'Spaghetti Bolognese', servings: 4,
        ingredients: [
          { name: 'ground beef', quantity: 500, unit: 'g' },
          { name: 'pasta', quantity: 400, unit: 'g' },
          { name: 'tomato sauce', quantity: 400, unit: 'ml' },
          { name: 'onion', quantity: 1, unit: 'pcs' },
          { name: 'garlic', quantity: 3, unit: 'pcs' },
          { name: 'carrot', quantity: 1, unit: 'pcs' },
          { name: 'olive oil', quantity: 30, unit: 'ml' },
        ],
        allergens: ['gluten'],
        prepTimeMin: 40, category: 'dinner',
        tags: ['italian', 'classic'],
      },
      {
        id: 'r6', name: 'Overnight Oats', servings: 1,
        ingredients: [
          { name: 'oats', quantity: 80, unit: 'g' },
          { name: 'yogurt', quantity: 150, unit: 'g' },
          { name: 'milk', quantity: 100, unit: 'ml' },
          { name: 'honey', quantity: 15, unit: 'g' },
          { name: 'berries', quantity: 50, unit: 'g' },
        ],
        allergens: ['gluten', 'dairy'],
        prepTimeMin: 5, category: 'breakfast',
        tags: ['healthy', 'easy'],
      },
      {
        id: 'r7', name: 'Toast Skagen', servings: 4,
        ingredients: [
          { name: 'shrimp', quantity: 400, unit: 'g' },
          { name: 'bread', quantity: 4, unit: 'pcs' },
          { name: 'mayonnaise', quantity: 100, unit: 'g' },
          { name: 'dill', quantity: 10, unit: 'g' },
          { name: 'lemon', quantity: 1, unit: 'pcs' },
          { name: 'red onion', quantity: 0.5, unit: 'pcs' },
        ],
        allergens: ['gluten', 'shellfish', 'egg'],
        prepTimeMin: 20, category: 'lunch',
        tags: ['swedish', 'seafood'],
      },
      {
        id: 'r8', name: 'Chicken Stir Fry', servings: 4,
        ingredients: [
          { name: 'chicken breast', quantity: 500, unit: 'g' },
          { name: 'bell pepper', quantity: 2, unit: 'pcs' },
          { name: 'broccoli', quantity: 200, unit: 'g' },
          { name: 'soy sauce', quantity: 40, unit: 'ml' },
          { name: 'rice', quantity: 300, unit: 'g' },
          { name: 'garlic', quantity: 3, unit: 'pcs' },
          { name: 'ginger', quantity: 10, unit: 'g' },
        ],
        allergens: ['soy'],
        prepTimeMin: 25, category: 'dinner',
        tags: ['asian', 'quick'],
      },
      {
        id: 'r9', name: 'Vegetable Soup', servings: 6,
        ingredients: [
          { name: 'potato', quantity: 3, unit: 'pcs' },
          { name: 'carrot', quantity: 3, unit: 'pcs' },
          { name: 'onion', quantity: 1, unit: 'pcs' },
          { name: 'celery', quantity: 2, unit: 'pcs' },
          { name: 'vegetable broth', quantity: 1000, unit: 'ml' },
          { name: 'tomato', quantity: 2, unit: 'pcs' },
        ],
        allergens: [],
        prepTimeMin: 40, category: 'dinner',
        tags: ['vegan', 'healthy'],
      },
      {
        id: 'r10', name: 'Smörgåstårta (Sandwich Cake)', servings: 8,
        ingredients: [
          { name: 'bread', quantity: 12, unit: 'pcs' },
          { name: 'cream cheese', quantity: 400, unit: 'g' },
          { name: 'shrimp', quantity: 200, unit: 'g' },
          { name: 'smoked salmon', quantity: 200, unit: 'g' },
          { name: 'cucumber', quantity: 1, unit: 'pcs' },
          { name: 'egg', quantity: 4, unit: 'pcs' },
          { name: 'lemon', quantity: 1, unit: 'pcs' },
        ],
        allergens: ['gluten', 'dairy', 'fish', 'shellfish', 'egg'],
        prepTimeMin: 60, category: 'party',
        tags: ['swedish', 'celebration'],
      },
      {
        id: 'r11', name: 'Kanelbullar (Cinnamon Buns)', servings: 24,
        ingredients: [
          { name: 'flour', quantity: 800, unit: 'g' },
          { name: 'butter', quantity: 150, unit: 'g' },
          { name: 'milk', quantity: 300, unit: 'ml' },
          { name: 'sugar', quantity: 100, unit: 'g' },
          { name: 'yeast', quantity: 25, unit: 'g' },
          { name: 'cinnamon', quantity: 20, unit: 'g' },
          { name: 'cardamom', quantity: 10, unit: 'g' },
        ],
        allergens: ['gluten', 'dairy'],
        prepTimeMin: 120, category: 'baking',
        tags: ['swedish', 'fika'],
      },
      {
        id: 'r12', name: 'Greek Salad', servings: 2,
        ingredients: [
          { name: 'tomato', quantity: 3, unit: 'pcs' },
          { name: 'cucumber', quantity: 1, unit: 'pcs' },
          { name: 'red onion', quantity: 0.5, unit: 'pcs' },
          { name: 'feta cheese', quantity: 150, unit: 'g' },
          { name: 'olive oil', quantity: 30, unit: 'ml' },
          { name: 'olives', quantity: 50, unit: 'g' },
        ],
        allergens: ['dairy'],
        prepTimeMin: 10, category: 'lunch',
        tags: ['healthy', 'quick', 'vegetarian'],
      },
      {
        id: 'r13', name: 'Grillad Kyckling (Grilled Chicken)', servings: 4,
        ingredients: [
          { name: 'chicken thighs', quantity: 800, unit: 'g' },
          { name: 'olive oil', quantity: 30, unit: 'ml' },
          { name: 'lemon', quantity: 1, unit: 'pcs' },
          { name: 'garlic', quantity: 4, unit: 'pcs' },
          { name: 'rosemary', quantity: 5, unit: 'g' },
          { name: 'potato', quantity: 4, unit: 'pcs' },
        ],
        allergens: [],
        prepTimeMin: 50, category: 'dinner',
        tags: ['grilling', 'summer'],
      },
      {
        id: 'r14', name: 'Smoothie Bowl', servings: 1,
        ingredients: [
          { name: 'banana', quantity: 1, unit: 'pcs' },
          { name: 'berries', quantity: 100, unit: 'g' },
          { name: 'yogurt', quantity: 150, unit: 'g' },
          { name: 'granola', quantity: 40, unit: 'g' },
          { name: 'honey', quantity: 15, unit: 'g' },
        ],
        allergens: ['dairy', 'gluten'],
        prepTimeMin: 10, category: 'breakfast',
        tags: ['healthy', 'quick'],
      },
      {
        id: 'r15', name: 'Pytt i Panna (Swedish Hash)', servings: 4,
        ingredients: [
          { name: 'potato', quantity: 6, unit: 'pcs' },
          { name: 'onion', quantity: 1, unit: 'pcs' },
          { name: 'sausage', quantity: 300, unit: 'g' },
          { name: 'butter', quantity: 40, unit: 'g' },
          { name: 'egg', quantity: 4, unit: 'pcs' },
          { name: 'beetroot', quantity: 100, unit: 'g' },
        ],
        allergens: ['dairy', 'egg'],
        prepTimeMin: 35, category: 'dinner',
        tags: ['swedish', 'traditional', 'leftover'],
      },
      {
        id: 'r16', name: 'Janssons Frestelse (Jansson\'s Temptation)', servings: 6,
        ingredients: [
          { name: 'potato', quantity: 8, unit: 'pcs' },
          { name: 'onion', quantity: 2, unit: 'pcs' },
          { name: 'anchovies', quantity: 125, unit: 'g' },
          { name: 'cream', quantity: 300, unit: 'ml' },
          { name: 'breadcrumbs', quantity: 50, unit: 'g' },
          { name: 'butter', quantity: 30, unit: 'g' },
        ],
        allergens: ['fish', 'dairy', 'gluten'],
        prepTimeMin: 70, category: 'dinner',
        tags: ['swedish', 'christmas', 'traditional'],
      },
    ];
  }

  suggestMeals() {
    const available = new Map();
    for (const item of this.inventory.values()) {
      const key = item.name.toLowerCase();
      const current = available.get(key) || { quantity: 0, unit: item.unit };
      current.quantity += item.quantity;
      available.set(key, current);
    }

    const suggestions = [];
    for (const recipe of this.recipes) {
      let matchedCount = 0;
      const totalIngredients = recipe.ingredients.length;
      const missing = [];
      const available_ingredients = [];

      for (const ing of recipe.ingredients) {
        const inStock = available.get(ing.name.toLowerCase());
        if (inStock && inStock.quantity > 0) {
          matchedCount++;
          available_ingredients.push(ing.name);
        } else {
          missing.push(ing.name);
        }
      }

      const matchPercent = Math.round((matchedCount / totalIngredients) * 100);
      if (matchPercent >= 50) {
        suggestions.push({
          recipe: recipe.name,
          recipeId: recipe.id,
          matchPercent,
          servings: recipe.servings,
          prepTimeMin: recipe.prepTimeMin,
          missingIngredients: missing,
          availableIngredients: available_ingredients,
          category: recipe.category,
          tags: recipe.tags,
        });
      }
    }

    suggestions.sort((a, b) => b.matchPercent - a.matchPercent);
    this.log(`Found ${suggestions.length} meal suggestions based on current inventory`);
    return suggestions;
  }

  suggestMealsForExpiring() {
    const expiring = this.getExpiringSoon(3);
    if (expiring.length === 0) return [];

    const expiringNames = new Set(expiring.map((e) => e.item.name.toLowerCase()));
    const suggestions = [];

    for (const recipe of this.recipes) {
      const usesExpiring = recipe.ingredients.some((ing) =>
        expiringNames.has(ing.name.toLowerCase())
      );
      if (usesExpiring) {
        const usedExpiringItems = recipe.ingredients
          .filter((ing) => expiringNames.has(ing.name.toLowerCase()))
          .map((ing) => ing.name);
        suggestions.push({
          recipe: recipe.name,
          recipeId: recipe.id,
          usesExpiringItems: usedExpiringItems,
          category: recipe.category,
          prepTimeMin: recipe.prepTimeMin,
        });
      }
    }

    this.log(`Found ${suggestions.length} recipes using expiring items`);
    return suggestions;
  }

  scaleRecipe(recipeId, desiredServings) {
    const recipe = this.recipes.find((r) => r.id === recipeId);
    if (!recipe) {
      this.error(`Recipe not found: ${recipeId}`);
      return null;
    }

    const factor = desiredServings / recipe.servings;
    const scaled = {
      name: recipe.name,
      originalServings: recipe.servings,
      scaledServings: desiredServings,
      scaleFactor: parseFloat(factor.toFixed(2)),
      ingredients: recipe.ingredients.map((ing) => ({
        name: ing.name,
        quantity: parseFloat((ing.quantity * factor).toFixed(1)),
        unit: ing.unit,
      })),
      prepTimeMin: Math.round(recipe.prepTimeMin * Math.max(1, factor * 0.6)),
      allergens: recipe.allergens,
    };

    this.log(`Scaled "${recipe.name}" from ${recipe.servings} to ${desiredServings} servings`);
    return scaled;
  }

  // ---------------------------------------------------------------------------
  // Nutritional tracking & household
  // ---------------------------------------------------------------------------

  addHouseholdMember(name, profile) {
    const member = {
      name,
      age: profile.age || null,
      dietaryRestrictions: profile.dietaryRestrictions || [],
      allergies: profile.allergies || [],
      calorieTarget: profile.calorieTarget || 2000,
      dailyLog: [],
      preferences: profile.preferences || [],
    };
    this.householdMembers.set(name, member);
    this.log(`Added household member: ${name}`);
    return member;
  }

  removeHouseholdMember(name) {
    const removed = this.householdMembers.delete(name);
    if (removed) {
      this.log(`Removed household member: ${name}`);
    } else {
      this.error(`Household member not found: ${name}`);
    }
    return removed;
  }

  logMealForMember(memberName, meal) {
    const member = this.householdMembers.get(memberName);
    if (!member) {
      this.error(`Household member not found: ${memberName}`);
      return null;
    }

    const entry = {
      timestamp: new Date(),
      mealType: meal.mealType || 'other',
      items: meal.items || [],
      calories: meal.calories || 0,
      protein: meal.protein || 0,
      carbs: meal.carbs || 0,
      fat: meal.fat || 0,
      fiber: meal.fiber || 0,
      notes: meal.notes || '',
    };

    member.dailyLog.push(entry);

    // keep last 90 days of logs
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    member.dailyLog = member.dailyLog.filter((e) => e.timestamp.getTime() > cutoff);

    this.log(`Logged ${entry.mealType} for ${memberName}: ${entry.calories} kcal`);
    return entry;
  }

  getNutritionSummary(memberName, days) {
    const member = this.householdMembers.get(memberName);
    if (!member) {
      this.error(`Household member not found: ${memberName}`);
      return null;
    }

    const lookback = (days || 7) * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - lookback;
    const recentLogs = member.dailyLog.filter((e) => e.timestamp.getTime() > cutoff);

    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;
    let totalFiber = 0;

    for (const entry of recentLogs) {
      totalCalories += entry.calories;
      totalProtein += entry.protein;
      totalCarbs += entry.carbs;
      totalFat += entry.fat;
      totalFiber += entry.fiber;
    }

    const numDays = Math.max(days || 7, 1);
    return {
      member: memberName,
      periodDays: numDays,
      totalCalories,
      avgDailyCalories: Math.round(totalCalories / numDays),
      targetCalories: member.calorieTarget,
      calorieAdherence: member.calorieTarget > 0
        ? parseFloat(((totalCalories / numDays / member.calorieTarget) * 100).toFixed(1))
        : 0,
      totalProtein: parseFloat(totalProtein.toFixed(1)),
      totalCarbs: parseFloat(totalCarbs.toFixed(1)),
      totalFat: parseFloat(totalFat.toFixed(1)),
      totalFiber: parseFloat(totalFiber.toFixed(1)),
      mealsLogged: recentLogs.length,
      dietaryRestrictions: member.dietaryRestrictions,
    };
  }

  // ---------------------------------------------------------------------------
  // Allergen checks
  // ---------------------------------------------------------------------------

  checkAllergens(recipeId) {
    const recipe = this.recipes.find((r) => r.id === recipeId);
    if (!recipe) {
      this.error(`Recipe not found for allergen check: ${recipeId}`);
      return null;
    }

    const warnings = [];
    for (const [name, member] of this.householdMembers.entries()) {
      if (!member.allergies || member.allergies.length === 0) continue;

      const matchedAllergens = recipe.allergens.filter((a) =>
        member.allergies.some((ma) => ma.toLowerCase() === a.toLowerCase())
      );

      if (matchedAllergens.length > 0) {
        warnings.push({
          member: name,
          recipe: recipe.name,
          allergens: matchedAllergens,
          severity: matchedAllergens.length > 1 ? 'critical' : 'warning',
          message: `${name} is allergic to: ${matchedAllergens.join(', ')}`,
        });
      }
    }

    if (warnings.length > 0) {
      this.log(`Allergen warnings for "${recipe.name}": ${warnings.length} member(s) affected`);
    }
    return { recipe: recipe.name, warnings, safe: warnings.length === 0 };
  }

  checkItemAllergens(itemId) {
    const item = this.inventory.get(itemId);
    if (!item) {
      this.error(`Item not found for allergen check: ${itemId}`);
      return null;
    }

    const warnings = [];
    for (const [name, member] of this.householdMembers.entries()) {
      if (!member.allergies || member.allergies.length === 0) continue;

      const itemCategory = (item.category || '').toLowerCase();
      const itemName = (item.name || '').toLowerCase();
      const itemNotes = (item.notes || '').toLowerCase();

      for (const allergy of member.allergies) {
        const lower = allergy.toLowerCase();
        if (itemCategory.includes(lower) || itemName.includes(lower) || itemNotes.includes(lower)) {
          warnings.push({
            member: name,
            item: item.name,
            allergen: allergy,
            severity: 'warning',
          });
        }
      }
    }

    return { item: item.name, warnings, safe: warnings.length === 0 };
  }

  // ---------------------------------------------------------------------------
  // Food waste tracking
  // ---------------------------------------------------------------------------

  _logWaste(item) {
    const entry = {
      timestamp: new Date(),
      itemName: item.name,
      quantity: item.quantity,
      unit: item.unit,
      category: item.category,
      estimatedCost: item.price * item.quantity,
      reason: item.expiryDate && item.expiryDate < new Date() ? 'expired' : 'discarded',
      location: item.location,
      daysOwned: item.addedDate
        ? Math.round((Date.now() - item.addedDate.getTime()) / (24 * 60 * 60 * 1000))
        : 0,
    };
    this.wasteLog.push(entry);
    this.log(`Waste logged: ${item.name} (${entry.estimatedCost} ${this.settings.currency})`);
  }

  getWasteReport(period) {
    const now = Date.now();
    let cutoff;

    if (period === 'weekly') {
      cutoff = now - 7 * 24 * 60 * 60 * 1000;
    } else if (period === 'monthly') {
      cutoff = now - 30 * 24 * 60 * 60 * 1000;
    } else {
      cutoff = now - 7 * 24 * 60 * 60 * 1000;
    }

    const entries = this.wasteLog.filter((e) => e.timestamp.getTime() > cutoff);
    let totalCost = 0;
    const byCategory = {};
    const byReason = { expired: 0, discarded: 0 };
    const byZone = {};

    for (const entry of entries) {
      totalCost += entry.estimatedCost;
      byCategory[entry.category] = (byCategory[entry.category] || 0) + entry.estimatedCost;
      byReason[entry.reason] = (byReason[entry.reason] || 0) + 1;
      byZone[entry.location] = (byZone[entry.location] || 0) + 1;
    }

    const avgDaysOwned = entries.length > 0
      ? parseFloat((entries.reduce((s, e) => s + e.daysOwned, 0) / entries.length).toFixed(1))
      : 0;

    return {
      period: period || 'weekly',
      totalItems: entries.length,
      totalCost: parseFloat(totalCost.toFixed(2)),
      currency: this.settings.currency,
      byCategory,
      byReason,
      byZone,
      averageCostPerItem: entries.length > 0 ? parseFloat((totalCost / entries.length).toFixed(2)) : 0,
      averageDaysOwned: avgDaysOwned,
      topWastedItems: this._getTopWastedItems(entries, 5),
      annualizedCost: parseFloat((totalCost * (period === 'monthly' ? 12 : 52)).toFixed(2)),
    };
  }

  _getTopWastedItems(entries, count) {
    const counts = {};
    for (const e of entries) {
      counts[e.itemName] = (counts[e.itemName] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, count)
      .map(([name, qty]) => ({ name, wastedCount: qty }));
  }

  // ---------------------------------------------------------------------------
  // Seasonal suggestions (Nordic focus)
  // ---------------------------------------------------------------------------

  getSeasonalSuggestions(month) {
    const m = typeof month === 'number' ? month : new Date().getMonth() + 1;

    const seasonal = {
      1: { fruits: ['apple', 'pear'], vegetables: ['root vegetables', 'kale', 'cabbage', 'leek'], proteins: ['cod', 'herring'], tips: 'Great month for hearty soups and stews with root vegetables.' },
      2: { fruits: ['apple', 'citrus imports'], vegetables: ['cabbage', 'parsnip', 'beetroot'], proteins: ['pike-perch', 'venison'], tips: 'Semlor season — stock up on almond paste and cardamom.' },
      3: { fruits: ['rhubarb (late)', 'apple'], vegetables: ['leek', 'spinach'], proteins: ['lamb', 'perch'], tips: 'Transition month — early spring greens appearing.' },
      4: { fruits: ['rhubarb'], vegetables: ['asparagus', 'radish', 'nettles'], proteins: ['trout', 'chicken'], tips: 'Nettles are free and nutritious — great for soup.' },
      5: { fruits: ['strawberry (early)', 'rhubarb'], vegetables: ['asparagus', 'peas', 'lettuce'], proteins: ['salmon', 'new potatoes'], tips: 'Fresh local produce begins. New potatoes with dill!' },
      6: { fruits: ['strawberry', 'cherry', 'raspberry'], vegetables: ['peas', 'broad beans', 'cucumber'], proteins: ['salmon', 'herring'], tips: 'Midsommar — stock up on herring, strawberries and potatoes.' },
      7: { fruits: ['blueberry', 'raspberry', 'currant'], vegetables: ['beans', 'tomato', 'corn'], proteins: ['crayfish', 'mackerel'], tips: 'Berry season at its peak — freeze extras for winter.' },
      8: { fruits: ['plum', 'apple', 'lingonberry'], vegetables: ['chanterelles', 'beetroot', 'corn'], proteins: ['crayfish', 'elk'], tips: 'Kräftskiva time! Also prime chanterelle season.' },
      9: { fruits: ['apple', 'pear', 'lingonberry'], vegetables: ['pumpkin', 'mushrooms', 'root vegetables'], proteins: ['moose', 'venison'], tips: 'Harvest season — preserve and pickle for winter.' },
      10: { fruits: ['apple', 'cranberry'], vegetables: ['squash', 'kale', 'brussels sprouts'], proteins: ['game meats', 'herring'], tips: 'Autumn stews and roasts. Begin holiday baking preparations.' },
      11: { fruits: ['apple', 'pear'], vegetables: ['root vegetables', 'cabbage', 'kale'], proteins: ['pork', 'cod'], tips: 'Start preparing for julbord — cure salmon, make meatballs.' },
      12: { fruits: ['apple', 'clementine', 'dried fruits'], vegetables: ['red cabbage', 'root vegetables', 'kale'], proteins: ['ham', 'herring', 'salmon'], tips: 'Julbord season! Traditional Christmas table preparations.' },
    };

    const data = seasonal[m] || seasonal[1];
    return {
      month: m,
      inSeason: data,
      suggestedRecipes: this._matchSeasonalRecipes(m),
    };
  }

  _matchSeasonalRecipes(month) {
    const seasonMap = {
      12: ['christmas', 'traditional', 'swedish'],
      6: ['summer', 'grilling', 'swedish'],
      7: ['summer', 'grilling'],
      8: ['summer', 'swedish'],
      1: ['traditional', 'hearty'],
      2: ['fika', 'traditional'],
      10: ['traditional'],
      11: ['swedish', 'traditional'],
    };
    const tags = seasonMap[month] || [];
    if (tags.length === 0) return this.recipes.slice(0, 3).map((r) => r.name);

    return this.recipes
      .filter((r) => r.tags.some((t) => tags.includes(t)))
      .map((r) => r.name);
  }

  // ---------------------------------------------------------------------------
  // Freezer quality warnings
  // ---------------------------------------------------------------------------

  getFreezerQualityWarnings() {
    const warnings = [];
    const now = Date.now();
    const maxMonths = {
      meat: 6, fish: 3, bread: 3, vegetables: 8,
      fruit: 10, dairy: 3, prepared: 3, general: 6,
    };

    for (const item of this.inventory.values()) {
      if (item.location !== 'freezer' || !item.frozenSince) continue;

      const monthsFrozen = (now - item.frozenSince.getTime()) / (30 * 24 * 60 * 60 * 1000);
      const limit = maxMonths[item.category] || maxMonths.general;

      if (monthsFrozen > limit) {
        warnings.push({
          item: item.name, itemId: item.id,
          monthsFrozen: parseFloat(monthsFrozen.toFixed(1)),
          recommendedMaxMonths: limit,
          quality: 'degraded',
          recommendation: `Consider using or discarding "${item.name}" — frozen for ${monthsFrozen.toFixed(1)} months (max recommended: ${limit}).`,
        });
      } else if (monthsFrozen > limit * 0.75) {
        warnings.push({
          item: item.name, itemId: item.id,
          monthsFrozen: parseFloat(monthsFrozen.toFixed(1)),
          recommendedMaxMonths: limit,
          quality: 'approaching_limit',
          recommendation: `Plan to use "${item.name}" soon — approaching quality limit.`,
        });
      }
    }

    return warnings;
  }

  // ---------------------------------------------------------------------------
  // Temperature monitoring
  // ---------------------------------------------------------------------------

  recordTemperature(zone, tempCelsius) {
    if (!this.temperatureReadings[zone]) {
      this.error(`Unknown temperature zone: ${zone}`);
      return null;
    }

    const reading = { temp: tempCelsius, timestamp: new Date() };
    this.temperatureReadings[zone].current = tempCelsius;
    this.temperatureReadings[zone].history.push(reading);

    // keep 7 days of history
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    this.temperatureReadings[zone].history = this.temperatureReadings[zone].history.filter(
      (r) => r.timestamp.getTime() > cutoff
    );

    // alert check
    const alerts = [];
    if (zone === 'fridge' && tempCelsius > this.temperatureReadings.fridge.alertThreshold) {
      const alertMsg = `Fridge temperature too high: ${tempCelsius}°C (threshold: ${this.temperatureReadings.fridge.alertThreshold}°C)`;
      alerts.push({ zone: 'fridge', current: tempCelsius, threshold: this.temperatureReadings.fridge.alertThreshold, message: alertMsg });
      this.error(alertMsg);
    }

    if (zone === 'freezer' && tempCelsius > this.temperatureReadings.freezer.alertThreshold) {
      const alertMsg = `Freezer temperature too high: ${tempCelsius}°C (threshold: ${this.temperatureReadings.freezer.alertThreshold}°C)`;
      alerts.push({ zone: 'freezer', current: tempCelsius, threshold: this.temperatureReadings.freezer.alertThreshold, message: alertMsg });
      this.error(alertMsg);
    }

    return { zone, reading, alerts };
  }

  getTemperatureStatus() {
    const calcAvg = (history) => {
      if (history.length === 0) return null;
      const sum = history.reduce((s, r) => s + r.temp, 0);
      return parseFloat((sum / history.length).toFixed(1));
    };

    return {
      fridge: {
        current: this.temperatureReadings.fridge.current,
        alertThreshold: this.temperatureReadings.fridge.alertThreshold,
        status: this.temperatureReadings.fridge.current <= this.temperatureReadings.fridge.alertThreshold ? 'normal' : 'alert',
        average: calcAvg(this.temperatureReadings.fridge.history),
        historyCount: this.temperatureReadings.fridge.history.length,
      },
      freezer: {
        current: this.temperatureReadings.freezer.current,
        alertThreshold: this.temperatureReadings.freezer.alertThreshold,
        status: this.temperatureReadings.freezer.current <= this.temperatureReadings.freezer.alertThreshold ? 'normal' : 'alert',
        average: calcAvg(this.temperatureReadings.freezer.history),
        historyCount: this.temperatureReadings.freezer.history.length,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Monitoring loop
  // ---------------------------------------------------------------------------

  _startMonitoringLoop() {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
    }

    this.monitoringTimer = setInterval(() => {
      this._runMonitoringCycle();
    }, this.settings.monitoringIntervalMs);

    this.log(`Monitoring loop started (interval: ${this.settings.monitoringIntervalMs / 1000}s)`);
  }

  _runMonitoringCycle() {
    this.log('Running pantry monitoring cycle');

    // Check expiring items
    const expiring = this.getExpiringSoon(3);
    if (expiring.length > 0) {
      this.log(`Warning: ${expiring.length} item(s) expiring within 3 days`);
      for (const entry of expiring) {
        if (entry.urgency === 'expired') {
          this.log(`  EXPIRED: ${entry.item.name}`);
        } else if (entry.urgency === 'critical') {
          this.log(`  CRITICAL: ${entry.item.name} — expires tomorrow`);
        } else if (entry.urgency === 'high') {
          this.log(`  HIGH: ${entry.item.name} — ${entry.daysRemaining} days left`);
        }
      }
    }

    // Check opened items past shelf life
    for (const item of this.inventory.values()) {
      if (!item.opened) continue;
      const shelfInfo = this._calculateOpenedShelfLife(item);
      if (shelfInfo && shelfInfo.expired) {
        this.log(`  OPENED EXPIRED: ${item.name} — opened shelf life exceeded`);
      }
    }

    // Check freezer quality
    const freezerWarnings = this.getFreezerQualityWarnings();
    if (freezerWarnings.length > 0) {
      this.log(`Freezer: ${freezerWarnings.length} quality warning(s)`);
    }

    // Check temperature
    if (this.settings.temperatureMonitoring) {
      const tempStatus = this.getTemperatureStatus();
      if (tempStatus.fridge.status === 'alert') {
        this.error(`Fridge temperature alert: ${tempStatus.fridge.current}°C`);
      }
      if (tempStatus.freezer.status === 'alert') {
        this.error(`Freezer temperature alert: ${tempStatus.freezer.current}°C`);
      }
    }

    // Auto grocery list
    if (this.settings.autoGroceryList) {
      const groceries = this.generateGroceryList();
      if (groceries.items && groceries.items.length > 0) {
        this.log(`Grocery: ${groceries.items.length} item(s) on auto-generated list`);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Settings persistence
  // ---------------------------------------------------------------------------

  async _loadSettings() {
    try {
      const saved = await this.homey.settings.get('foodPantrySettings');
      if (saved) {
        const parsed = typeof saved === 'string' ? JSON.parse(saved) : saved;
        Object.assign(this.settings, parsed);
        this.log('Settings loaded from storage');
      }
    } catch (err) {
      this.error(`Failed to load settings: ${err.message}`);
    }

    try {
      const savedInventory = await this.homey.settings.get('foodPantryInventory');
      if (savedInventory) {
        const parsed = typeof savedInventory === 'string' ? JSON.parse(savedInventory) : savedInventory;
        for (const item of parsed) {
          if (item.expiryDate) item.expiryDate = new Date(item.expiryDate);
          if (item.addedDate) item.addedDate = new Date(item.addedDate);
          if (item.frozenSince) item.frozenSince = new Date(item.frozenSince);
          if (item.openedDate) item.openedDate = new Date(item.openedDate);
          this.inventory.set(item.id, item);
        }
        this.log(`Loaded ${this.inventory.size} items from storage`);
      }
    } catch (err) {
      this.error(`Failed to load inventory: ${err.message}`);
    }

    try {
      const savedRates = await this.homey.settings.get('foodPantryConsumptionRates');
      if (savedRates) {
        const parsed = typeof savedRates === 'string' ? JSON.parse(savedRates) : savedRates;
        for (const [key, value] of Object.entries(parsed)) {
          this.consumptionRates.set(key, value);
        }
        this.log(`Loaded ${this.consumptionRates.size} consumption rates`);
      }
    } catch (err) {
      this.error(`Failed to load consumption rates: ${err.message}`);
    }
  }

  async _saveSettings() {
    try {
      await this.homey.settings.set('foodPantrySettings', JSON.stringify(this.settings));

      const items = Array.from(this.inventory.values());
      await this.homey.settings.set('foodPantryInventory', JSON.stringify(items));

      const rates = {};
      for (const [key, value] of this.consumptionRates.entries()) {
        rates[key] = value;
      }
      await this.homey.settings.set('foodPantryConsumptionRates', JSON.stringify(rates));

      this.log('Settings, inventory and consumption rates saved to storage');
    } catch (err) {
      this.error(`Failed to save settings: ${err.message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Statistics
  // ---------------------------------------------------------------------------

  getStatistics() {
    const totalItems = this.inventory.size;
    const zoneBreakdown = {};
    const categoryBreakdown = {};
    let totalValue = 0;

    for (const item of this.inventory.values()) {
      zoneBreakdown[item.location] = (zoneBreakdown[item.location] || 0) + 1;
      categoryBreakdown[item.category] = (categoryBreakdown[item.category] || 0) + 1;
      totalValue += (item.price || 0) * item.quantity;
    }

    const expiringSoon = this.getExpiringSoon(7);
    const freezerWarnings = this.getFreezerQualityWarnings();
    const wasteReport = this.getWasteReport('monthly');

    return {
      system: 'SmartFoodPantryManagementSystem',
      initialized: this.initialized,
      totalItems,
      zoneBreakdown,
      categoryBreakdown,
      estimatedInventoryValue: parseFloat(totalValue.toFixed(2)),
      currency: this.settings.currency,
      expiringSoonCount: expiringSoon.length,
      expiredCount: expiringSoon.filter((e) => e.urgency === 'expired').length,
      freezerWarnings: freezerWarnings.length,
      householdMembers: this.householdMembers.size,
      trackedConsumptionRates: this.consumptionRates.size,
      recipesAvailable: this.recipes.length,
      wasteThisMonth: wasteReport.totalItems,
      wasteCostThisMonth: wasteReport.totalCost,
      temperatureStatus: this.getTemperatureStatus(),
      zoneCapacities: Object.entries(this.zones).map(([id, zone]) => ({
        zone: id,
        label: zone.label,
        used: zone.currentItems,
        capacity: zone.capacity,
        utilization: zone.capacity > 0 ? Math.round((zone.currentItems / zone.capacity) * 100) : 0,
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  _validateZone(zone) {
    return zone && Object.prototype.hasOwnProperty.call(this.zones, zone);
  }

  _incrementZoneCount(zone) {
    if (this.zones[zone]) {
      this.zones[zone].currentItems++;
    }
  }

  _decrementZoneCount(zone) {
    if (this.zones[zone]) {
      this.zones[zone].currentItems = Math.max(0, this.zones[zone].currentItems - 1);
    }
  }

  log(msg) {
    const ts = new Date().toISOString();
    if (this.homey && typeof this.homey.log === 'function') {
      this.homey.log(`[FoodPantry] ${msg}`);
    } else {
      console.log(`[${ts}] [FoodPantry] ${msg}`);
    }
  }

  error(msg) {
    const ts = new Date().toISOString();
    if (this.homey && typeof this.homey.error === 'function') {
      this.homey.error(`[FoodPantry] ${msg}`);
    } else {
      console.error(`[${ts}] [FoodPantry] ${msg}`);
    }
  }
}

module.exports = SmartFoodPantryManagementSystem;
