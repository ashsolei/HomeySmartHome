'use strict';
const logger = require('./logger');

/**
 * Smart Shopping List
 * AI-powered shopping list that learns household consumption patterns
 */
class SmartShoppingList {
  constructor(app) {
    this._intervals = [];
    this.app = app;
    this.items = new Map();
    this.categories = new Map();
    this.consumptionPatterns = new Map();
    this.suggestions = [];
    this.purchaseHistory = [];
    this.stores = new Map();
  }

  async initialize() {
    // Load categories
    await this.loadCategories();
    
    // Load stores
    await this.loadStores();
    
    // Load consumption patterns
    await this.loadConsumptionPatterns();
    
    // Start monitoring
    this.startMonitoring();
  }

  // ============================================
  // ITEM MANAGEMENT
  // ============================================

  async addItem(config) {
    const item = {
      id: config.id || `item_${Date.now()}`,
      name: config.name,
      category: config.category,
      quantity: config.quantity || 1,
      unit: config.unit || 'st',
      priority: config.priority || 'normal', // 'urgent', 'high', 'normal', 'low'
      
      // Optional details
      brand: config.brand,
      size: config.size,
      notes: config.notes,
      
      // Store preferences
      preferredStore: config.preferredStore,
      estimatedPrice: config.estimatedPrice,
      
      // Status
      checked: false,
      purchased: false,
      
      // Timestamps
      addedAt: Date.now(),
      addedBy: config.addedBy || 'system',
      purchasedAt: null
    };

    this.items.set(item.id, item);

    return {
      success: true,
      item
    };
  }

  async updateItem(itemId, updates) {
    const item = this.items.get(itemId);
    
    if (!item) {
      return { success: false, error: 'Item not found' };
    }

    Object.assign(item, updates);

    return {
      success: true,
      item
    };
  }

  async removeItem(itemId) {
    const item = this.items.get(itemId);
    
    if (!item) {
      return { success: false, error: 'Item not found' };
    }

    this.items.delete(itemId);

    return { success: true };
  }

  async checkItem(itemId, checked = true) {
    const item = this.items.get(itemId);
    
    if (!item) {
      return { success: false, error: 'Item not found' };
    }

    item.checked = checked;

    return { success: true, item };
  }

  async markPurchased(itemId) {
    const item = this.items.get(itemId);
    
    if (!item) {
      return { success: false, error: 'Item not found' };
    }

    item.purchased = true;
    item.purchasedAt = Date.now();

    // Log purchase for pattern learning
    this.logPurchase(item);

    // Remove from active list
    this.items.delete(itemId);

    return { success: true };
  }

  // ============================================
  // SMART SUGGESTIONS
  // ============================================

  startMonitoring() {
    // Check for suggestions every day at 8 AM
    this._intervals.push(setInterval(() => {
      const hour = new Date().getHours();
      if (hour === 8) {
        this.generateSuggestions();
      }
    }, 60 * 60 * 1000));

    // Initial suggestions
    this.generateSuggestions();
  }

  async generateSuggestions() {
    this.suggestions = [];

    // Check consumption-based suggestions
    this.checkConsumptionPatterns();
    
    // Check frequency-based suggestions
    this.checkFrequencyPatterns();
    
    // Check seasonal suggestions
    this.checkSeasonalSuggestions();
    
    // Check recipe-based suggestions
    this.checkRecipeSuggestions();

    logger.info(`Generated ${this.suggestions.length} shopping suggestions`);

    return this.suggestions;
  }

  checkConsumptionPatterns() {
    for (const [itemName, pattern] of this.consumptionPatterns) {
      const daysSinceLastPurchase = pattern.lastPurchase 
        ? (Date.now() - pattern.lastPurchase) / (1000 * 60 * 60 * 24)
        : pattern.averageInterval + 1;

      // Suggest if approaching restock time
      if (daysSinceLastPurchase >= pattern.averageInterval * 0.8) {
        const urgency = daysSinceLastPurchase >= pattern.averageInterval ? 'high' : 'normal';
        
        this.suggestions.push({
          id: `suggestion_${Date.now()}_${itemName}`,
          type: 'consumption',
          item: itemName,
          category: pattern.category,
          quantity: pattern.typicalQuantity,
          reason: `Brukar köpas varje ${Math.round(pattern.averageInterval)} dag`,
          confidence: 0.85,
          urgency,
          daysSinceLastPurchase: Math.round(daysSinceLastPurchase)
        });
      }
    }
  }

  checkFrequencyPatterns() {
    const dayOfWeek = new Date().getDay();
    const dayName = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'][dayOfWeek];

    // Suggest items typically bought on this day
    for (const [itemName, pattern] of this.consumptionPatterns) {
      if (pattern.preferredDays && pattern.preferredDays.includes(dayOfWeek)) {
        this.suggestions.push({
          id: `suggestion_freq_${itemName}`,
          type: 'frequency',
          item: itemName,
          category: pattern.category,
          reason: `Brukar köpas på ${dayName}`,
          confidence: 0.70
        });
      }
    }
  }

  checkSeasonalSuggestions() {
    const month = new Date().getMonth();
    const season = this.getSeason(month);

    const seasonalItems = {
      winter: ['Apelsiner', 'Klementin', 'Rotfrukter', 'Kålrot', 'Grönkål'],
      spring: ['Sparris', 'Rabarber', 'Jordgubbar', 'Färskpotatis'],
      summer: ['Tomat', 'Gurka', 'Paprika', 'Vattenmelon', 'Blåbär'],
      autumn: ['Äpple', 'Päron', 'Pumpa', 'Svamp', 'Lingon']
    };

    const items = seasonalItems[season] || [];
    
    items.forEach(item => {
      // Only suggest if not already on list
      const alreadyOnList = Array.from(this.items.values())
        .some(i => i.name.toLowerCase() === item.toLowerCase());

      if (!alreadyOnList) {
        this.suggestions.push({
          id: `suggestion_seasonal_${item}`,
          type: 'seasonal',
          item,
          category: 'Frukt & Grönt',
          reason: `Säsongsvara för ${season}`,
          confidence: 0.60
        });
      }
    });
  }

  checkRecipeSuggestions() {
    // Placeholder for recipe-based suggestions
    // In production: Integrate with recipe database or meal planning
  }

  getSeason(month) {
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'autumn';
    return 'winter';
  }

  // ============================================
  // CONSUMPTION PATTERNS
  // ============================================

  async loadConsumptionPatterns() {
    // Load learned patterns (integrate with storage)
    // For demo, create example patterns
    
    const patterns = [
      { item: 'Mjölk', category: 'Mejeri', interval: 4, quantity: 2, preferredDays: [1, 5] },
      { item: 'Bröd', category: 'Bröd & Spannmål', interval: 3, quantity: 1, preferredDays: [3, 6] },
      { item: 'Ägg', category: 'Mejeri', interval: 7, quantity: 12, preferredDays: [0] },
      { item: 'Kaffe', category: 'Drycker', interval: 14, quantity: 500, preferredDays: [0] },
      { item: 'Pasta', category: 'Bröd & Spannmål', interval: 21, quantity: 2, preferredDays: [0] },
      { item: 'Ris', category: 'Bröd & Spannmål', interval: 30, quantity: 1, preferredDays: [0] },
      { item: 'Toalettpapper', category: 'Hushåll', interval: 21, quantity: 6, preferredDays: [0] },
      { item: 'Diskmedel', category: 'Hushåll', interval: 30, quantity: 1, preferredDays: [0] },
      { item: 'Tvättmedel', category: 'Hushåll', interval: 45, quantity: 1, preferredDays: [0] }
    ];

    for (const pattern of patterns) {
      this.consumptionPatterns.set(pattern.item, {
        category: pattern.category,
        averageInterval: pattern.interval,
        typicalQuantity: pattern.quantity,
        preferredDays: pattern.preferredDays,
        lastPurchase: Date.now() - (pattern.interval * 0.6 * 24 * 60 * 60 * 1000), // 60% through cycle
        purchaseCount: 10
      });
    }
  }

  logPurchase(item) {
    // Update consumption pattern
    const pattern = this.consumptionPatterns.get(item.name);
    
    if (pattern) {
      // Calculate new interval
      if (pattern.lastPurchase) {
        const interval = (Date.now() - pattern.lastPurchase) / (1000 * 60 * 60 * 24);
        pattern.averageInterval = (pattern.averageInterval * pattern.purchaseCount + interval) / (pattern.purchaseCount + 1);
      }
      
      pattern.lastPurchase = Date.now();
      pattern.purchaseCount++;
      
      // Update preferred day
      const dayOfWeek = new Date().getDay();
      if (!pattern.preferredDays) {
        pattern.preferredDays = [];
      }
      if (!pattern.preferredDays.includes(dayOfWeek)) {
        pattern.preferredDays.push(dayOfWeek);
      }
    } else {
      // Create new pattern
      this.consumptionPatterns.set(item.name, {
        category: item.category,
        averageInterval: 7, // Default weekly
        typicalQuantity: item.quantity,
        preferredDays: [new Date().getDay()],
        lastPurchase: Date.now(),
        purchaseCount: 1
      });
    }

    // Add to purchase history
    this.purchaseHistory.push({
      item: item.name,
      category: item.category,
      quantity: item.quantity,
      timestamp: Date.now(),
      store: item.preferredStore,
      price: item.estimatedPrice
    });

    // Trim history
    if (this.purchaseHistory.length > 1000) {
      this.purchaseHistory = this.purchaseHistory.slice(-1000);
    }
  }

  // ============================================
  // CATEGORIES
  // ============================================

  async loadCategories() {
    const categories = [
      { id: 'frukt_gront', name: 'Frukt & Grönt', icon: '🥕', color: '#4CAF50' },
      { id: 'mejeri', name: 'Mejeri', icon: '🥛', color: '#2196F3' },
      { id: 'kott_fisk', name: 'Kött & Fisk', icon: '🥩', color: '#F44336' },
      { id: 'brod_spannmal', name: 'Bröd & Spannmål', icon: '🍞', color: '#FF9800' },
      { id: 'fryst', name: 'Fryst', icon: '❄️', color: '#00BCD4' },
      { id: 'drycker', name: 'Drycker', icon: '☕', color: '#795548' },
      { id: 'snacks', name: 'Snacks & Godis', icon: '🍿', color: '#E91E63' },
      { id: 'hushall', name: 'Hushåll', icon: '🧹', color: '#9C27B0' },
      { id: 'hygien', name: 'Hygien', icon: '🧼', color: '#3F51B5' },
      { id: 'husdjur', name: 'Husdjur', icon: '🐾', color: '#607D8B' },
      { id: 'ovrigt', name: 'Övrigt', icon: '📦', color: '#757575' }
    ];

    for (const category of categories) {
      this.categories.set(category.id, category);
    }
  }

  // ============================================
  // STORES
  // ============================================

  async loadStores() {
    const stores = [
      { 
        id: 'ica', 
        name: 'ICA', 
        type: 'supermarket',
        location: { lat: 59.3293, lng: 18.0686 },
        distance: 1.2,
        priceLevel: 'medium'
      },
      { 
        id: 'coop', 
        name: 'Coop', 
        type: 'supermarket',
        location: { lat: 59.3303, lng: 18.0696 },
        distance: 0.8,
        priceLevel: 'medium'
      },
      { 
        id: 'willys', 
        name: 'Willys', 
        type: 'discount',
        location: { lat: 59.3313, lng: 18.0706 },
        distance: 2.5,
        priceLevel: 'low'
      },
      { 
        id: 'hemkop', 
        name: 'Hemköp', 
        type: 'supermarket',
        location: { lat: 59.3323, lng: 18.0716 },
        distance: 1.5,
        priceLevel: 'medium-high'
      },
      { 
        id: 'citygross', 
        name: 'City Gross', 
        type: 'hypermarket',
        location: { lat: 59.3333, lng: 18.0726 },
        distance: 3.0,
        priceLevel: 'low'
      }
    ];

    for (const store of stores) {
      this.stores.set(store.id, store);
    }
  }

  // ============================================
  // SHOPPING OPTIMIZATION
  // ============================================

  async optimizeShoppingTrip() {
    const items = Array.from(this.items.values()).filter(i => !i.purchased);
    
    if (items.length === 0) {
      return { success: false, error: 'No items on list' };
    }

    // Group by preferred store
    const storeGroups = new Map();
    
    for (const item of items) {
      const store = item.preferredStore || 'ica';
      
      if (!storeGroups.has(store)) {
        storeGroups.set(store, []);
      }
      
      storeGroups.get(store).push(item);
    }

    // Calculate optimal route
    const suggestions = [];
    
    for (const [storeId, storeItems] of storeGroups) {
      const store = this.stores.get(storeId);
      const totalEstimatedCost = storeItems.reduce((sum, item) => 
        sum + (item.estimatedPrice || 0), 0
      );

      suggestions.push({
        store: store.name,
        storeId,
        distance: store.distance,
        itemCount: storeItems.length,
        estimatedCost: totalEstimatedCost,
        items: storeItems.map(i => ({
          name: i.name,
          quantity: i.quantity,
          unit: i.unit,
          category: i.category
        }))
      });
    }

    // Sort by distance (or could optimize by cost, item availability, etc.)
    suggestions.sort((a, b) => a.distance - b.distance);

    return {
      success: true,
      totalItems: items.length,
      totalStores: suggestions.length,
      suggestions,
      estimatedTotalCost: suggestions.reduce((sum, s) => sum + s.estimatedCost, 0)
    };
  }

  async sortByStore(storeId) {
    const store = this.stores.get(storeId);
    
    if (!store) {
      return { success: false, error: 'Store not found' };
    }

    const items = Array.from(this.items.values())
      .filter(i => !i.purchased);

    // Group by category and sort within each category
    const categorized = new Map();
    
    for (const item of items) {
      const category = item.category || 'ovrigt';
      
      if (!categorized.has(category)) {
        categorized.set(category, []);
      }
      
      categorized.get(category).push(item);
    }

    // Convert to array and sort categories by store layout
    const sorted = Array.from(categorized.entries()).map(([category, items]) => ({
      category: this.categories.get(category)?.name || category,
      items: items.sort((a, b) => a.name.localeCompare(b.name, 'sv'))
    }));

    return {
      success: true,
      store: store.name,
      categories: sorted,
      totalItems: items.length
    };
  }

  // ============================================
  // VOICE & INTEGRATION
  // ============================================

  async addItemByVoice(voiceInput) {
    // Parse natural language input
    // Example: "lägg till två liter mjölk"
    
    const parsed = this.parseVoiceInput(voiceInput);
    
    if (!parsed) {
      return { 
        success: false, 
        error: 'Could not understand input',
        suggestion: 'Försök med format: "lägg till [antal] [vara]"'
      };
    }

    return await this.addItem({
      name: parsed.item,
      quantity: parsed.quantity,
      unit: parsed.unit,
      category: this.guessCategoryByName(parsed.item),
      addedBy: 'voice'
    });
  }

  parseVoiceInput(input) {
    input = input.toLowerCase();
    
    // Simple parsing (in production: use NLP)
    const match = input.match(/(lägg till|köp|behöver)\s+(\d+)?\s*(\w+)?\s+(.+)/);
    
    if (match) {
      return {
        quantity: parseInt(match[2]) || 1,
        unit: match[3] || 'st',
        item: match[4].charAt(0).toUpperCase() + match[4].slice(1)
      };
    }
    
    return null;
  }

  guessCategoryByName(itemName) {
    const categoryKeywords = {
      frukt_gront: ['äpple', 'banan', 'tomat', 'gurka', 'sallad', 'morot', 'paprika'],
      mejeri: ['mjölk', 'ost', 'yoghurt', 'fil', 'grädde', 'smör', 'ägg'],
      kott_fisk: ['kött', 'fisk', 'kyckling', 'korv', 'bacon', 'lax'],
      brod_spannmal: ['bröd', 'pasta', 'ris', 'flingor', 'mjöl'],
      drycker: ['kaffe', 'te', 'juice', 'läsk', 'vatten', 'vin', 'öl'],
      hushall: ['diskmedel', 'tvättmedel', 'toalettpapper', 'rengöring']
    };

    itemName = itemName.toLowerCase();
    
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => itemName.includes(keyword))) {
        return category;
      }
    }
    
    return 'ovrigt';
  }

  // ============================================
  // API & REPORTING
  // ============================================

  getActiveList() {
    const items = Array.from(this.items.values())
      .filter(i => !i.purchased)
      .sort((a, b) => {
        // Sort by priority, then category
        const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        return priorityDiff !== 0 ? priorityDiff : a.category.localeCompare(b.category, 'sv');
      });

    return {
      items,
      total: items.length,
      byPriority: {
        urgent: items.filter(i => i.priority === 'urgent').length,
        high: items.filter(i => i.priority === 'high').length,
        normal: items.filter(i => i.priority === 'normal').length,
        low: items.filter(i => i.priority === 'low').length
      },
      byCategory: this.groupByCategory(items)
    };
  }

  groupByCategory(items) {
    const grouped = new Map();
    
    for (const item of items) {
      const category = item.category || 'ovrigt';
      
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      
      grouped.get(category).push(item);
    }

    return Array.from(grouped.entries()).map(([category, items]) => ({
      category: this.categories.get(category)?.name || category,
      categoryId: category,
      count: items.length,
      items
    }));
  }

  getSuggestions() {
    return this.suggestions.sort((a, b) => {
      // Sort by urgency, then confidence
      const urgencyOrder = { high: 0, normal: 1, low: 2 };
      const urgencyDiff = (urgencyOrder[a.urgency] || 1) - (urgencyOrder[b.urgency] || 1);
      return urgencyDiff !== 0 ? urgencyDiff : b.confidence - a.confidence;
    });
  }

  async acceptSuggestion(suggestionId) {
    const suggestion = this.suggestions.find(s => s.id === suggestionId);
    
    if (!suggestion) {
      return { success: false, error: 'Suggestion not found' };
    }

    // Add to list
    const result = await this.addItem({
      name: suggestion.item,
      category: suggestion.category,
      quantity: suggestion.quantity || 1,
      addedBy: 'suggestion'
    });

    // Remove suggestion
    this.suggestions = this.suggestions.filter(s => s.id !== suggestionId);

    return result;
  }

  getStats() {
    const items = Array.from(this.items.values());
    
    return {
      activeItems: items.filter(i => !i.purchased).length,
      totalItems: items.length,
      suggestions: this.suggestions.length,
      categories: this.categories.size,
      stores: this.stores.size,
      recentPurchases: this.purchaseHistory.slice(-10),
      topCategories: this.getTopCategories(),
      monthlySpending: this.calculateMonthlySpending()
    };
  }

  getTopCategories() {
    const categoryCount = new Map();
    
    for (const purchase of this.purchaseHistory) {
      const count = categoryCount.get(purchase.category) || 0;
      categoryCount.set(purchase.category, count + 1);
    }

    return Array.from(categoryCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, count]) => ({
        category: this.categories.get(category)?.name || category,
        count
      }));
  }

  calculateMonthlySpending() {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    
    const recentPurchases = this.purchaseHistory.filter(p => 
      p.timestamp >= thirtyDaysAgo && p.price
    );

    const total = recentPurchases.reduce((sum, p) => sum + p.price, 0);

    return {
      total,
      itemCount: recentPurchases.length,
      averagePerItem: recentPurchases.length > 0 ? total / recentPurchases.length : 0
    };
  }

  destroy() {
    if (this._intervals) {
      this._intervals.forEach(id => clearInterval(id));
      this._intervals = [];
    }
  }
}

module.exports = SmartShoppingList;
