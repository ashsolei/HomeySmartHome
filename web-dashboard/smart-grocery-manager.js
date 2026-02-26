'use strict';

/**
 * Smart Grocery Manager
 * AI-powered grocery management with inventory tracking and smart shopping
 */
class SmartGroceryManager {
  constructor(app) {
    this.app = app;
    this.inventory = new Map();
    this.shoppingLists = new Map();
    this.recipes = new Map();
    this.consumptionPatterns = new Map();
    this.stores = new Map();
    this.purchases = [];
  }

  async initialize() {
    await this.loadInventory();
    await this.loadRecipes();
    await this.loadStores();
    await this.createDefaultShoppingList();
    
    this.startMonitoring();
  }

  // ============================================
  // INVENTORY MANAGEMENT
  // ============================================

  async loadInventory() {
    // Initial inventory items
    const items = [
      // Dairy
      { name: 'Mjölk', category: 'dairy', quantity: 2, unit: 'liter', location: 'Kylskåp', expiryDate: Date.now() + 5 * 24 * 60 * 60 * 1000, barcode: '7310865002013' },
      { name: 'Yoghurt', category: 'dairy', quantity: 4, unit: 'st', location: 'Kylskåp', expiryDate: Date.now() + 10 * 24 * 60 * 60 * 1000 },
      { name: 'Ost (Herrgård)', category: 'dairy', quantity: 400, unit: 'gram', location: 'Kylskåp', expiryDate: Date.now() + 14 * 24 * 60 * 60 * 1000 },
      { name: 'Smör', category: 'dairy', quantity: 250, unit: 'gram', location: 'Kylskåp', expiryDate: Date.now() + 30 * 24 * 60 * 60 * 1000 },
      
      // Produce
      { name: 'Äpplen', category: 'produce', quantity: 6, unit: 'st', location: 'Fruktskål', expiryDate: Date.now() + 7 * 24 * 60 * 60 * 1000 },
      { name: 'Bananer', category: 'produce', quantity: 5, unit: 'st', location: 'Fruktskål', expiryDate: Date.now() + 4 * 24 * 60 * 60 * 1000 },
      { name: 'Tomater', category: 'produce', quantity: 8, unit: 'st', location: 'Kylskåp', expiryDate: Date.now() + 5 * 24 * 60 * 60 * 1000 },
      { name: 'Gurka', category: 'produce', quantity: 2, unit: 'st', location: 'Kylskåp', expiryDate: Date.now() + 6 * 24 * 60 * 60 * 1000 },
      { name: 'Sallad', category: 'produce', quantity: 1, unit: 'st', location: 'Kylskåp', expiryDate: Date.now() + 3 * 24 * 60 * 60 * 1000 },
      
      // Meat & Fish
      { name: 'Kycklingfilé', category: 'meat', quantity: 600, unit: 'gram', location: 'Kylskåp', expiryDate: Date.now() + 3 * 24 * 60 * 60 * 1000 },
      { name: 'Köttfärs', category: 'meat', quantity: 500, unit: 'gram', location: 'Kylskåp', expiryDate: Date.now() + 2 * 24 * 60 * 60 * 1000 },
      { name: 'Lax', category: 'fish', quantity: 400, unit: 'gram', location: 'Frys', expiryDate: Date.now() + 90 * 24 * 60 * 60 * 1000 },
      
      // Pantry
      { name: 'Pasta', category: 'pantry', quantity: 1000, unit: 'gram', location: 'Skafferi', expiryDate: Date.now() + 365 * 24 * 60 * 60 * 1000 },
      { name: 'Ris', category: 'pantry', quantity: 2000, unit: 'gram', location: 'Skafferi', expiryDate: Date.now() + 365 * 24 * 60 * 60 * 1000 },
      { name: 'Bröd', category: 'bakery', quantity: 1, unit: 'st', location: 'Brödlåda', expiryDate: Date.now() + 3 * 24 * 60 * 60 * 1000 },
      { name: 'Ägg', category: 'dairy', quantity: 12, unit: 'st', location: 'Kylskåp', expiryDate: Date.now() + 14 * 24 * 60 * 60 * 1000 },
      { name: 'Kaffe', category: 'beverages', quantity: 500, unit: 'gram', location: 'Skafferi', expiryDate: Date.now() + 180 * 24 * 60 * 60 * 1000 },
      { name: 'Olivolja', category: 'pantry', quantity: 500, unit: 'ml', location: 'Skafferi', expiryDate: Date.now() + 365 * 24 * 60 * 60 * 1000 }
    ];

    for (const item of items) {
      const id = `item_${item.name.toLowerCase().replace(/\s+/g, '_')}`;
      this.inventory.set(id, {
        id,
        ...item,
        addedDate: Date.now(),
        lastUsed: null,
        averageConsumption: null, // Will be calculated
        reorderPoint: this.calculateReorderPoint(item)
      });
    }
  }

  calculateReorderPoint(item) {
    // Default reorder points
    const defaults = {
      dairy: { quantity: 1, unit: item.unit },
      produce: { quantity: 2, unit: 'st' },
      meat: { quantity: 200, unit: 'gram' },
      fish: { quantity: 200, unit: 'gram' },
      pantry: { quantity: 200, unit: item.unit },
      beverages: { quantity: 100, unit: item.unit },
      bakery: { quantity: 0, unit: 'st' }
    };

    return defaults[item.category] || { quantity: 1, unit: item.unit };
  }

  async addItem(itemData) {
    const id = `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const item = {
      id,
      name: itemData.name,
      category: itemData.category,
      quantity: itemData.quantity,
      unit: itemData.unit,
      location: itemData.location || 'Skafferi',
      expiryDate: itemData.expiryDate,
      barcode: itemData.barcode || null,
      addedDate: Date.now(),
      lastUsed: null,
      reorderPoint: this.calculateReorderPoint(itemData)
    };

    this.inventory.set(id, item);

    console.log(`➕ Added: ${item.name} (${item.quantity} ${item.unit})`);

    return { success: true, item };
  }

  async consumeItem(itemId, amount) {
    const item = this.inventory.get(itemId);
    
    if (!item) {
      return { success: false, error: 'Item not found' };
    }

    item.quantity -= amount;
    item.lastUsed = Date.now();

    console.log(`📉 Consumed: ${item.name} -${amount} ${item.unit} (${item.quantity} remaining)`);

    // Track consumption pattern
    this.trackConsumption(itemId, amount);

    // Check if reorder needed
    if (item.quantity <= item.reorderPoint.quantity) {
      await this.addToShoppingList(item.name, item.category);
      console.log(`  → Added to shopping list (below reorder point)`);
    }

    // Remove if depleted
    if (item.quantity <= 0) {
      this.inventory.delete(itemId);
    }

    return { success: true, remaining: item.quantity };
  }

  trackConsumption(itemId, amount) {
    if (!this.consumptionPatterns.has(itemId)) {
      this.consumptionPatterns.set(itemId, {
        history: [],
        averageDaily: 0
      });
    }

    const pattern = this.consumptionPatterns.get(itemId);
    pattern.history.push({
      timestamp: Date.now(),
      amount
    });

    // Keep last 30 days
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    pattern.history = pattern.history.filter(h => h.timestamp >= cutoff);

    // Calculate average daily consumption
    if (pattern.history.length > 0) {
      const totalDays = (Date.now() - pattern.history[0].timestamp) / (24 * 60 * 60 * 1000);
      const totalAmount = pattern.history.reduce((sum, h) => sum + h.amount, 0);
      pattern.averageDaily = totalAmount / totalDays;
    }
  }

  // ============================================
  // SHOPPING LIST
  // ============================================

  async createDefaultShoppingList() {
    await this.createShoppingList({
      id: 'weekly',
      name: 'Veckohandling',
      type: 'recurring',
      items: []
    });

    await this.createShoppingList({
      id: 'quick',
      name: 'Snabbköp',
      type: 'immediate',
      items: []
    });
  }

  async createShoppingList(config) {
    this.shoppingLists.set(config.id, {
      ...config,
      created: Date.now(),
      lastModified: Date.now(),
      completed: false
    });

    return { success: true, list: this.shoppingLists.get(config.id) };
  }

  async addToShoppingList(itemName, category, quantity = null, listId = 'weekly') {
    const list = this.shoppingLists.get(listId);
    
    if (!list) {
      return { success: false, error: 'List not found' };
    }

    // Check if item already on list
    const existing = list.items.find(i => i.name.toLowerCase() === itemName.toLowerCase());
    
    if (existing) {
      if (quantity) existing.quantity += quantity;
      return { success: true, item: existing, added: false };
    }

    // Add new item
    const item = {
      id: `listitem_${Date.now()}`,
      name: itemName,
      category,
      quantity: quantity || this.getDefaultQuantity(category),
      unit: this.getDefaultUnit(category),
      checked: false,
      addedDate: Date.now(),
      estimatedPrice: this.estimatePrice(itemName, category)
    };

    list.items.push(item);
    list.lastModified = Date.now();

    return { success: true, item, added: true };
  }

  getDefaultQuantity(category) {
    const defaults = {
      dairy: 1,
      produce: 4,
      meat: 500,
      fish: 400,
      pantry: 1,
      beverages: 1,
      bakery: 1
    };
    return defaults[category] || 1;
  }

  getDefaultUnit(category) {
    const units = {
      dairy: 'liter',
      produce: 'st',
      meat: 'gram',
      fish: 'gram',
      pantry: 'förp',
      beverages: 'liter',
      bakery: 'st'
    };
    return units[category] || 'st';
  }

  estimatePrice(itemName, category) {
    // Simplified price estimation (SEK)
    const avgPrices = {
      dairy: 15,
      produce: 8,
      meat: 80,
      fish: 120,
      pantry: 25,
      beverages: 30,
      bakery: 35
    };
    return avgPrices[category] || 20;
  }

  async removeFromShoppingList(listId, itemId) {
    const list = this.shoppingLists.get(listId);
    
    if (!list) {
      return { success: false, error: 'List not found' };
    }

    list.items = list.items.filter(i => i.id !== itemId);
    list.lastModified = Date.now();

    return { success: true };
  }

  async checkItem(listId, itemId, checked = true) {
    const list = this.shoppingLists.get(listId);
    
    if (!list) {
      return { success: false, error: 'List not found' };
    }

    const item = list.items.find(i => i.id === itemId);
    
    if (!item) {
      return { success: false, error: 'Item not found' };
    }

    item.checked = checked;

    return { success: true, item };
  }

  // ============================================
  // RECIPE MANAGEMENT
  // ============================================

  async loadRecipes() {
    const recipeData = [
      {
        id: 'recipe_pasta_carbonara',
        name: 'Pasta Carbonara',
        servings: 4,
        difficulty: 'easy',
        cookingTime: 20,
        ingredients: [
          { name: 'Pasta', amount: 400, unit: 'gram' },
          { name: 'Bacon', amount: 200, unit: 'gram' },
          { name: 'Ägg', amount: 3, unit: 'st' },
          { name: 'Ost (Herrgård)', amount: 100, unit: 'gram' },
          { name: 'Grädde', amount: 200, unit: 'ml' }
        ],
        instructions: [
          'Koka pastan enligt anvisning',
          'Stek bacon krasigt',
          'Blanda ägg, grädde och ost',
          'Vänd ner bacon och äggblandning i pastan'
        ]
      },
      {
        id: 'recipe_chicken_stir_fry',
        name: 'Kycklingwok',
        servings: 4,
        difficulty: 'easy',
        cookingTime: 25,
        ingredients: [
          { name: 'Kycklingfilé', amount: 600, unit: 'gram' },
          { name: 'Ris', amount: 300, unit: 'gram' },
          { name: 'Paprika', amount: 2, unit: 'st' },
          { name: 'Lök', amount: 1, unit: 'st' },
          { name: 'Soja', amount: 50, unit: 'ml' },
          { name: 'Ingefära', amount: 20, unit: 'gram' }
        ],
        instructions: [
          'Koka ris',
          'Skär kyckling i bitar',
          'Woка kyckling och grönsaker',
          'Tillsätt soja och ingefära'
        ]
      },
      {
        id: 'recipe_salmon_potatoes',
        name: 'Ugnsbakad lax med potatis',
        servings: 4,
        difficulty: 'medium',
        cookingTime: 40,
        ingredients: [
          { name: 'Lax', amount: 800, unit: 'gram' },
          { name: 'Potatis', amount: 1000, unit: 'gram' },
          { name: 'Citron', amount: 1, unit: 'st' },
          { name: 'Dill', amount: 20, unit: 'gram' },
          { name: 'Smör', amount: 50, unit: 'gram' }
        ],
        instructions: [
          'Skala och koka potatis',
          'Marinera lax med citron och dill',
          'Baka lax i ugn 200°C i 15 min',
          'Servera med smörkokt potatis'
        ]
      }
    ];

    for (const recipe of recipeData) {
      this.recipes.set(recipe.id, {
        ...recipe,
        created: Date.now(),
        lastCooked: null,
        timesCooked: 0,
        rating: null
      });
    }
  }

  async addRecipeToShoppingList(recipeId, servings = null) {
    const recipe = this.recipes.get(recipeId);
    
    if (!recipe) {
      return { success: false, error: 'Recipe not found' };
    }

    const scaleFactor = servings ? servings / recipe.servings : 1;

    for (const ingredient of recipe.ingredients) {
      // Check if we have enough in inventory
      const inventoryItem = Array.from(this.inventory.values()).find(
        i => i.name.toLowerCase() === ingredient.name.toLowerCase()
      );

      const needed = ingredient.amount * scaleFactor;
      const have = inventoryItem ? inventoryItem.quantity : 0;

      if (have < needed) {
        // Add to shopping list
        await this.addToShoppingList(
          ingredient.name,
          this.categorizeIngredient(ingredient.name),
          needed - have
        );
      }
    }

    console.log(`📝 Added ingredients for ${recipe.name} to shopping list`);

    return { success: true, recipe, itemsAdded: recipe.ingredients.length };
  }

  categorizeIngredient(name) {
    // Simple categorization
    const categories = {
      'mjölk': 'dairy', 'yoghurt': 'dairy', 'ost': 'dairy', 'ägg': 'dairy', 'smör': 'dairy', 'grädde': 'dairy',
      'äpple': 'produce', 'banan': 'produce', 'tomat': 'produce', 'gurka': 'produce', 'sallad': 'produce', 'paprika': 'produce', 'lök': 'produce', 'potatis': 'produce',
      'kyckling': 'meat', 'köttfärs': 'meat', 'bacon': 'meat',
      'lax': 'fish',
      'pasta': 'pantry', 'ris': 'pantry', 'bröd': 'bakery'
    };

    for (const [key, category] of Object.entries(categories)) {
      if (name.toLowerCase().includes(key)) {
        return category;
      }
    }

    return 'pantry';
  }

  // ============================================
  // STORES & PRICING
  // ============================================

  async loadStores() {
    const storeData = [
      {
        id: 'ica_maxi',
        name: 'ICA Maxi',
        type: 'supermarket',
        distance: 2.5,
        priceLevel: 'medium',
        openingHours: { weekday: '07:00-22:00', weekend: '08:00-21:00' }
      },
      {
        id: 'coop',
        name: 'Coop',
        type: 'supermarket',
        distance: 1.8,
        priceLevel: 'medium',
        openingHours: { weekday: '07:00-21:00', weekend: '08:00-20:00' }
      },
      {
        id: 'willys',
        name: 'Willys',
        type: 'discount',
        distance: 3.2,
        priceLevel: 'low',
        openingHours: { weekday: '08:00-21:00', weekend: '09:00-20:00' }
      },
      {
        id: 'hemkop',
        name: 'Hemköp',
        type: 'convenience',
        distance: 0.5,
        priceLevel: 'high',
        openingHours: { weekday: '07:00-23:00', weekend: '08:00-23:00' }
      }
    ];

    for (const store of storeData) {
      this.stores.set(store.id, {
        ...store,
        lastVisit: null,
        totalSpent: 0
      });
    }
  }

  async optimizeShoppingRoute(listId) {
    const list = this.shoppingLists.get(listId);
    
    if (!list) {
      return { success: false, error: 'List not found' };
    }

    // Calculate which store(s) would be most efficient
    const stores = Array.from(this.stores.values());
    const totalEstimatedCost = list.items.reduce((sum, i) => sum + i.estimatedPrice, 0);

    const recommendations = stores.map(store => {
      const priceMultiplier = {
        low: 0.85,
        medium: 1.0,
        high: 1.15
      }[store.priceLevel];

      const estimatedCost = totalEstimatedCost * priceMultiplier;
      const travelCost = store.distance * 2 * 2; // 2 km * 2 SEK/km * round trip

      return {
        store: store.name,
        distance: store.distance,
        estimatedCost: Math.round(estimatedCost),
        travelCost,
        totalCost: Math.round(estimatedCost + travelCost),
        savings: Math.round(totalEstimatedCost - estimatedCost - travelCost)
      };
    }).sort((a, b) => b.savings - a.savings);

    return {
      success: true,
      recommendations,
      bestChoice: recommendations[0]
    };
  }

  async recordPurchase(data) {
    const purchase = {
      id: `purchase_${Date.now()}`,
      timestamp: Date.now(),
      store: data.store,
      items: data.items,
      total: data.total,
      listId: data.listId || null
    };

    this.purchases.push(purchase);

    // Add purchased items to inventory
    for (const item of data.items) {
      await this.addItem({
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        expiryDate: Date.now() + this.getDefaultExpiry(item.category)
      });
    }

    // Update store stats
    const store = this.stores.get(data.store);
    if (store) {
      store.lastVisit = Date.now();
      store.totalSpent += data.total;
    }

    // Mark list items as purchased
    if (data.listId) {
      const list = this.shoppingLists.get(data.listId);
      if (list) {
        for (const item of data.items) {
          const listItem = list.items.find(li => 
            li.name.toLowerCase() === item.name.toLowerCase()
          );
          if (listItem) {
            listItem.checked = true;
          }
        }
      }
    }

    console.log(`🛒 Purchase recorded: ${data.total} SEK at ${data.store}`);

    return { success: true, purchase };
  }

  getDefaultExpiry(category) {
    // Days until expiry
    const expiry = {
      dairy: 7,
      produce: 7,
      meat: 3,
      fish: 2,
      pantry: 365,
      beverages: 180,
      bakery: 5
    };
    return (expiry[category] || 30) * 24 * 60 * 60 * 1000;
  }

  // ============================================
  // MONITORING & ALERTS
  // ============================================

  startMonitoring() {
    // Check expiry dates daily
    setInterval(() => {
      this.checkExpiryDates();
    }, 24 * 60 * 60 * 1000);

    // Analyze consumption patterns weekly
    setInterval(() => {
      this.analyzeConsumptionPatterns();
    }, 7 * 24 * 60 * 60 * 1000);

    // Initial checks
    this.checkExpiryDates();
  }

  async checkExpiryDates() {
    const now = Date.now();
    const threeDays = 3 * 24 * 60 * 60 * 1000;

    for (const [itemId, item] of this.inventory) {
      const timeToExpiry = item.expiryDate - now;

      if (timeToExpiry < 0) {
        console.log(`⚠️ EXPIRED: ${item.name} - remove from inventory`);
        this.inventory.delete(itemId);
      } else if (timeToExpiry < threeDays) {
        const daysLeft = Math.ceil(timeToExpiry / (24 * 60 * 60 * 1000));
        console.log(`⏰ EXPIRING SOON: ${item.name} - ${daysLeft} day(s) left`);
        
        // Suggest recipe using this ingredient
        await this.suggestRecipeWithIngredient(item.name);
      }
    }
  }

  async suggestRecipeWithIngredient(ingredientName) {
    const matchingRecipes = Array.from(this.recipes.values()).filter(recipe =>
      recipe.ingredients.some(ing => 
        ing.name.toLowerCase().includes(ingredientName.toLowerCase())
      )
    );

    if (matchingRecipes.length > 0) {
      console.log(`  💡 Suggestion: Make ${matchingRecipes[0].name}`);
    }
  }

  async analyzeConsumptionPatterns() {
    console.log('📊 Analyzing consumption patterns...');

    for (const [itemId, pattern] of this.consumptionPatterns) {
      if (pattern.history.length < 3) continue; // Need more data

      const item = this.inventory.get(itemId);
      if (!item) continue;

      // Predict when item will run out
      if (pattern.averageDaily > 0) {
        const daysUntilEmpty = item.quantity / pattern.averageDaily;
        
        if (daysUntilEmpty < 7 && daysUntilEmpty > 0) {
          console.log(`  📉 ${item.name} will run out in ~${Math.round(daysUntilEmpty)} days`);
          
          // Add to shopping list if not already there
          const weeklyList = this.shoppingLists.get('weekly');
          const alreadyOnList = weeklyList.items.some(li => 
            li.name.toLowerCase() === item.name.toLowerCase()
          );
          
          if (!alreadyOnList) {
            await this.addToShoppingList(item.name, item.category);
          }
        }
      }
    }
  }

  // ============================================
  // REPORTING & ANALYTICS
  // ============================================

  getInventorySummary() {
    const items = Array.from(this.inventory.values());
    
    const byCategory = {};
    const expiringInWeek = [];
    let totalValue = 0;

    for (const item of items) {
      // Group by category
      if (!byCategory[item.category]) {
        byCategory[item.category] = { count: 0, items: [] };
      }
      byCategory[item.category].count++;
      byCategory[item.category].items.push(item.name);

      // Check expiry
      const daysToExpiry = (item.expiryDate - Date.now()) / (24 * 60 * 60 * 1000);
      if (daysToExpiry < 7) {
        expiringInWeek.push({
          name: item.name,
          daysLeft: Math.ceil(daysToExpiry)
        });
      }

      // Estimate value
      totalValue += this.estimatePrice(item.name, item.category);
    }

    return {
      totalItems: items.length,
      byCategory,
      expiringInWeek,
      estimatedValue: Math.round(totalValue)
    };
  }

  getShoppingList(listId) {
    const list = this.shoppingLists.get(listId);
    
    if (!list) return null;

    const totalEstimated = list.items.reduce((sum, i) => sum + i.estimatedPrice, 0);
    const completedItems = list.items.filter(i => i.checked).length;

    return {
      ...list,
      totalItems: list.items.length,
      completedItems,
      totalEstimated: Math.round(totalEstimated),
      progress: list.items.length > 0 
        ? Math.round((completedItems / list.items.length) * 100)
        : 0
    };
  }

  getAllShoppingLists() {
    return Array.from(this.shoppingLists.values()).map(list => ({
      id: list.id,
      name: list.name,
      itemCount: list.items.length,
      unchecked: list.items.filter(i => !i.checked).length
    }));
  }

  getSpendingReport(days = 30) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const recentPurchases = this.purchases.filter(p => p.timestamp >= cutoff);

    const totalSpent = recentPurchases.reduce((sum, p) => sum + p.total, 0);
    const byStore = {};
    const byCategory = {};

    for (const purchase of recentPurchases) {
      // By store
      if (!byStore[purchase.store]) {
        byStore[purchase.store] = 0;
      }
      byStore[purchase.store] += purchase.total;

      // By category
      for (const item of purchase.items) {
        if (!byCategory[item.category]) {
          byCategory[item.category] = 0;
        }
        byCategory[item.category] += item.price || this.estimatePrice(item.name, item.category);
      }
    }

    return {
      period: `${days} days`,
      totalSpent: Math.round(totalSpent),
      averagePerWeek: Math.round(totalSpent / (days / 7)),
      purchaseCount: recentPurchases.length,
      byStore,
      byCategory
    };
  }

  getRecipeSuggestions() {
    // Suggest recipes based on available ingredients
    const suggestions = [];

    for (const [_recipeId, recipe] of this.recipes) {
      let availableIngredients = 0;
      const missingIngredients = [];

      for (const ingredient of recipe.ingredients) {
        const inventoryItem = Array.from(this.inventory.values()).find(
          i => i.name.toLowerCase() === ingredient.name.toLowerCase()
        );

        if (inventoryItem && inventoryItem.quantity >= ingredient.amount) {
          availableIngredients++;
        } else {
          missingIngredients.push(ingredient.name);
        }
      }

      const matchPercentage = (availableIngredients / recipe.ingredients.length) * 100;

      if (matchPercentage >= 50) {
        suggestions.push({
          recipe: recipe.name,
          servings: recipe.servings,
          cookingTime: recipe.cookingTime,
          matchPercentage: Math.round(matchPercentage),
          availableIngredients,
          totalIngredients: recipe.ingredients.length,
          missingIngredients
        });
      }
    }

    return suggestions.sort((a, b) => b.matchPercentage - a.matchPercentage);
  }

  getWastePrevention() {
    // Calculate potential waste prevention
    const expiringItems = Array.from(this.inventory.values()).filter(item => {
      const daysToExpiry = (item.expiryDate - Date.now()) / (24 * 60 * 60 * 1000);
      return daysToExpiry > 0 && daysToExpiry < 7;
    });

    const suggestions = expiringItems.map(item => {
      const recipes = Array.from(this.recipes.values()).filter(recipe =>
        recipe.ingredients.some(ing =>
          ing.name.toLowerCase().includes(item.name.toLowerCase())
        )
      );

      return {
        item: item.name,
        daysLeft: Math.ceil((item.expiryDate - Date.now()) / (24 * 60 * 60 * 1000)),
        quantity: `${item.quantity} ${item.unit}`,
        suggestions: recipes.length > 0 
          ? [`Laga ${recipes[0].name}`, 'Frys in', 'Ge bort']
          : ['Frys in', 'Ge bort']
      };
    });

    const potentialWasteValue = expiringItems.reduce((sum, item) => 
      sum + this.estimatePrice(item.name, item.category), 0
    );

    return {
      itemsExpiringSoon: expiringItems.length,
      potentialWasteValue: Math.round(potentialWasteValue),
      suggestions
    };
  }
}

module.exports = SmartGroceryManager;
