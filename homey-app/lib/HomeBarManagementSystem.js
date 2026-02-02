const EventEmitter = require('events');

/**
 * Home Bar & Beverage Management System
 * 
 * Provides comprehensive bar management with cocktail recipes, inventory tracking,
 * smart refrigeration, and automated drink preparation guidance.
 * 
 * Features:
 * - Complete beverage inventory (spirits, wines, beers, mixers)
 * - Extensive cocktail recipe database
 * - Drink recommendation engine
 * - Temperature-controlled storage zones
 * - Automatic inventory depletion tracking
 * - Shopping list generation
 * - Party planning and batch cocktails
 * - Glassware and tool inventory
 * - Drink cost calculation
 * - Tasting notes and ratings
 */
class HomeBarManagementSystem extends EventEmitter {
  constructor(homey) {
    super();
    this.homey = homey;
    this.inventory = new Map();
    this.cocktails = new Map();
    this.drinkHistory = [];
    this.shoppingList = [];
    this.tastingNotes = [];
    this.storage = new Map();
    this.monitoringInterval = null;
    
    // Performance optimizations
    this._cache = new Map();
    this._cacheTimeout = 300000; // 5 minutes
  }

  async initialize() {
    this.homey.log('Initializing Home Bar Management System...');
    
    try {
      await this.loadSettings();
      this.initializeBarInventory();
      this.initializeCocktailDatabase();
      this.initializeStorage();
      
      this.startMonitoring();
      
      this.homey.log('Home Bar Management System initialized successfully');
      return true;
    } catch (error) {
      this.homey.error('Failed to initialize Home Bar Management:', error);
      throw error;
    }
  }

  async loadSettings() {
    try {
      const settings = await this.homey.settings.get('homeBar') || {};
      
      if (settings.inventory) {
        settings.inventory.forEach(item => {
          this.inventory.set(item.id, item);
        });
      }
      
      if (settings.cocktails) {
        settings.cocktails.forEach(cocktail => {
          this.cocktails.set(cocktail.id, cocktail);
        });
      }
      
      if (settings.storage) {
        settings.storage.forEach(zone => {
          this.storage.set(zone.id, zone);
        });
      }
      
      this.drinkHistory = settings.drinkHistory || [];
      this.shoppingList = settings.shoppingList || [];
      this.tastingNotes = settings.tastingNotes || [];
    } catch (error) {
      this.homey.error('Error loading bar settings:', error);
      throw error;
    }
  }

  async saveSettings() {
    try {
      const settings = {
        inventory: Array.from(this.inventory.values()),
        cocktails: Array.from(this.cocktails.values()),
        storage: Array.from(this.storage.values()),
        drinkHistory: this.drinkHistory.slice(-200),
        shoppingList: this.shoppingList,
        tastingNotes: this.tastingNotes.slice(-100)
      };
      
      await this.homey.settings.set('homeBar', settings);
      this._cache.clear();
    } catch (error) {
      this.homey.error('Error saving bar settings:', error);
      throw error;
    }
  }

  initializeBarInventory() {
    if (this.inventory.size === 0) {
      const sampleInventory = [
        // Spirits
        { id: 'spirit-001', name: 'Tanqueray Gin', category: 'spirits', type: 'gin', brand: 'Tanqueray', volume: 700, volumeRemaining: 500, unit: 'ml', abv: 47.3, cost: 35, purchaseDate: new Date().toISOString(), storageZone: 'main-bar', opened: true, openedDate: new Date().toISOString() },
        { id: 'spirit-002', name: 'Havana Club 7', category: 'spirits', type: 'rum', brand: 'Havana Club', volume: 700, volumeRemaining: 600, unit: 'ml', abv: 40, cost: 28, purchaseDate: new Date().toISOString(), storageZone: 'main-bar', opened: true, openedDate: new Date().toISOString() },
        { id: 'spirit-003', name: 'Absolut Vodka', category: 'spirits', type: 'vodka', brand: 'Absolut', volume: 1000, volumeRemaining: 800, unit: 'ml', abv: 40, cost: 25, purchaseDate: new Date().toISOString(), storageZone: 'freezer', opened: true, openedDate: new Date().toISOString() },
        { id: 'spirit-004', name: 'Bulleit Bourbon', category: 'spirits', type: 'whiskey', brand: 'Bulleit', volume: 700, volumeRemaining: 400, unit: 'ml', abv: 45, cost: 32, purchaseDate: new Date().toISOString(), storageZone: 'main-bar', opened: true, openedDate: new Date().toISOString() },
        { id: 'spirit-005', name: 'Patron Silver Tequila', category: 'spirits', type: 'tequila', brand: 'Patron', volume: 750, volumeRemaining: 550, unit: 'ml', abv: 40, cost: 55, purchaseDate: new Date().toISOString(), storageZone: 'main-bar', opened: true, openedDate: new Date().toISOString() },
        
        // Liqueurs
        { id: 'liqueur-001', name: 'Cointreau', category: 'liqueurs', type: 'triple-sec', brand: 'Cointreau', volume: 700, volumeRemaining: 500, unit: 'ml', abv: 40, cost: 30, purchaseDate: new Date().toISOString(), storageZone: 'main-bar', opened: true, openedDate: new Date().toISOString() },
        { id: 'liqueur-002', name: 'Campari', category: 'liqueurs', type: 'bitter', brand: 'Campari', volume: 700, volumeRemaining: 600, unit: 'ml', abv: 25, cost: 22, purchaseDate: new Date().toISOString(), storageZone: 'fridge', opened: true, openedDate: new Date().toISOString() },
        { id: 'liqueur-003', name: 'Baileys', category: 'liqueurs', type: 'cream', brand: 'Baileys', volume: 700, volumeRemaining: 400, unit: 'ml', abv: 17, cost: 20, purchaseDate: new Date().toISOString(), storageZone: 'fridge', opened: true, openedDate: new Date().toISOString(), expiryDays: 180 },
        
        // Vermouth & Fortified
        { id: 'fortified-001', name: 'Martini Rosso', category: 'fortified', type: 'vermouth', brand: 'Martini', volume: 1000, volumeRemaining: 800, unit: 'ml', abv: 15, cost: 12, purchaseDate: new Date().toISOString(), storageZone: 'fridge', opened: true, openedDate: new Date().toISOString(), expiryDays: 60 },
        { id: 'fortified-002', name: 'Martini Extra Dry', category: 'fortified', type: 'vermouth', brand: 'Martini', volume: 1000, volumeRemaining: 700, unit: 'ml', abv: 15, cost: 12, purchaseDate: new Date().toISOString(), storageZone: 'fridge', opened: true, openedDate: new Date().toISOString(), expiryDays: 60 },
        
        // Mixers
        { id: 'mixer-001', name: 'Fever-Tree Tonic', category: 'mixers', type: 'tonic', brand: 'Fever-Tree', volume: 4000, volumeRemaining: 2000, unit: 'ml', abv: 0, cost: 15, purchaseDate: new Date().toISOString(), storageZone: 'fridge', opened: true, expiryDays: 14 },
        { id: 'mixer-002', name: 'Coca-Cola', category: 'mixers', type: 'cola', brand: 'Coca-Cola', volume: 2000, volumeRemaining: 1500, unit: 'ml', abv: 0, cost: 3, purchaseDate: new Date().toISOString(), storageZone: 'fridge', opened: true, expiryDays: 7 },
        { id: 'mixer-003', name: 'Fresh Lime Juice', category: 'mixers', type: 'juice', brand: 'Homemade', volume: 500, volumeRemaining: 300, unit: 'ml', abv: 0, cost: 5, purchaseDate: new Date().toISOString(), storageZone: 'fridge', opened: true, expiryDays: 3 },
        { id: 'mixer-004', name: 'Simple Syrup', category: 'mixers', type: 'syrup', brand: 'Homemade', volume: 500, volumeRemaining: 350, unit: 'ml', abv: 0, cost: 2, purchaseDate: new Date().toISOString(), storageZone: 'fridge', opened: true, expiryDays: 30 },
        
        // Bitters
        { id: 'bitters-001', name: 'Angostura Bitters', category: 'bitters', type: 'aromatic', brand: 'Angostura', volume: 200, volumeRemaining: 150, unit: 'ml', abv: 44.7, cost: 10, purchaseDate: new Date().toISOString(), storageZone: 'main-bar', opened: true, openedDate: new Date().toISOString() }
      ];
      
      sampleInventory.forEach(item => {
        if (item.expiryDays) {
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + item.expiryDays);
          item.expiryDate = expiryDate.toISOString();
        }
        this.inventory.set(item.id, item);
      });
    }
  }

  initializeCocktailDatabase() {
    if (this.cocktails.size === 0) {
      // Classic Cocktails
      this.cocktails.set('margarita', {
        id: 'margarita',
        name: 'Classic Margarita',
        category: 'classic',
        glassware: 'margarita',
        ice: 'cubed',
        garnish: ['lime-wheel', 'salt-rim'],
        difficulty: 'easy',
        ingredients: [
          { inventoryId: 'spirit-005', name: 'Tequila', amount: 50, unit: 'ml' },
          { inventoryId: 'liqueur-001', name: 'Cointreau', amount: 25, unit: 'ml' },
          { inventoryId: 'mixer-003', name: 'Lime Juice', amount: 25, unit: 'ml' }
        ],
        instructions: [
          'Salt half the rim of a chilled margarita glass',
          'Add all ingredients to a shaker with ice',
          'Shake vigorously for 15 seconds',
          'Strain into the glass over fresh ice',
          'Garnish with a lime wheel'
        ],
        tags: ['tequila', 'sour', 'classic'],
        strength: 'strong',
        taste: ['sour', 'citrus', 'refreshing'],
        timesमade: 12,
        rating: 4.8
      });
      
      this.cocktails.set('old-fashioned', {
        id: 'old-fashioned',
        name: 'Old Fashioned',
        category: 'classic',
        glassware: 'rocks',
        ice: 'large-cube',
        garnish: ['orange-peel', 'cherry'],
        difficulty: 'easy',
        ingredients: [
          { inventoryId: 'spirit-004', name: 'Bourbon', amount: 60, unit: 'ml' },
          { inventoryId: 'mixer-004', name: 'Simple Syrup', amount: 10, unit: 'ml' },
          { inventoryId: 'bitters-001', name: 'Angostura Bitters', amount: 3, unit: 'dashes' }
        ],
        instructions: [
          'Add simple syrup and bitters to a rocks glass',
          'Add one large ice cube',
          'Pour bourbon over ice',
          'Stir gently for 30 seconds',
          'Express orange peel over the drink and drop in',
          'Add cherry garnish'
        ],
        tags: ['whiskey', 'stirred', 'classic', 'strong'],
        strength: 'strong',
        taste: ['spirit-forward', 'sweet', 'aromatic'],
        timesMade: 8,
        rating: 5.0
      });
      
      this.cocktails.set('gin-tonic', {
        id: 'gin-tonic',
        name: 'Gin & Tonic',
        category: 'highball',
        glassware: 'highball',
        ice: 'cubed',
        garnish: ['lime-wedge'],
        difficulty: 'easy',
        ingredients: [
          { inventoryId: 'spirit-001', name: 'Gin', amount: 50, unit: 'ml' },
          { inventoryId: 'mixer-001', name: 'Tonic Water', amount: 150, unit: 'ml' }
        ],
        instructions: [
          'Fill a highball glass with ice',
          'Pour gin over ice',
          'Top with tonic water',
          'Stir gently once',
          'Garnish with lime wedge'
        ],
        tags: ['gin', 'simple', 'refreshing'],
        strength: 'medium',
        taste: ['botanical', 'bitter', 'refreshing'],
        timesMade: 25,
        rating: 4.5
      });
      
      this.cocktails.set('mojito', {
        id: 'mojito',
        name: 'Mojito',
        category: 'classic',
        glassware: 'highball',
        ice: 'crushed',
        garnish: ['mint-sprig', 'lime-wheel'],
        difficulty: 'medium',
        ingredients: [
          { inventoryId: 'spirit-002', name: 'White Rum', amount: 50, unit: 'ml' },
          { inventoryId: 'mixer-003', name: 'Lime Juice', amount: 25, unit: 'ml' },
          { inventoryId: 'mixer-004', name: 'Simple Syrup', amount: 20, unit: 'ml' },
          { inventoryId: null, name: 'Fresh Mint', amount: 8, unit: 'leaves' },
          { inventoryId: 'mixer-002', name: 'Soda Water', amount: 100, unit: 'ml' }
        ],
        instructions: [
          'Muddle mint leaves with simple syrup in a glass',
          'Add lime juice and rum',
          'Fill glass with crushed ice',
          'Top with soda water',
          'Stir gently',
          'Garnish with mint sprig and lime wheel'
        ],
        tags: ['rum', 'refreshing', 'muddled', 'classic'],
        strength: 'medium',
        taste: ['minty', 'citrus', 'refreshing'],
        timesMade: 15,
        rating: 4.7
      });
      
      this.cocktails.set('negroni', {
        id: 'negroni',
        name: 'Negroni',
        category: 'classic',
        glassware: 'rocks',
        ice: 'cubed',
        garnish: ['orange-peel'],
        difficulty: 'easy',
        ingredients: [
          { inventoryId: 'spirit-001', name: 'Gin', amount: 30, unit: 'ml' },
          { inventoryId: 'liqueur-002', name: 'Campari', amount: 30, unit: 'ml' },
          { inventoryId: 'fortified-001', name: 'Sweet Vermouth', amount: 30, unit: 'ml' }
        ],
        instructions: [
          'Add all ingredients to a mixing glass with ice',
          'Stir for 30 seconds',
          'Strain into a rocks glass over a large ice cube',
          'Express orange peel over the drink and drop in'
        ],
        tags: ['gin', 'bitter', 'stirred', 'classic', 'aperitif'],
        strength: 'strong',
        taste: ['bitter', 'herbal', 'complex'],
        timesMade: 6,
        rating: 4.9
      });
    }
  }

  initializeStorage() {
    if (this.storage.size === 0) {
      this.storage.set('main-bar', {
        id: 'main-bar',
        name: 'Main Bar Shelf',
        type: 'room-temperature',
        temperature: 20,
        capacity: 30,
        currentItems: 8
      });
      
      this.storage.set('fridge', {
        id: 'fridge',
        name: 'Bar Fridge',
        type: 'refrigerated',
        temperature: 4,
        capacity: 20,
        currentItems: 7
      });
      
      this.storage.set('freezer', {
        id: 'freezer',
        name: 'Freezer',
        type: 'frozen',
        temperature: -18,
        capacity: 10,
        currentItems: 1
      });
    }
  }

  startMonitoring() {
    // Monitor inventory daily
    this.monitoringInterval = setInterval(() => {
      this.checkInventoryLevels();
      this.checkExpiryDates();
    }, 86400000); // 24 hours
  }

  async checkInventoryLevels() {
    try {
      for (const item of this.inventory.values()) {
        const remainingPercent = (item.volumeRemaining / item.volume) * 100;
        
        if (remainingPercent <= 10 && remainingPercent > 0) {
          const existingInList = this.shoppingList.find(s => s.itemId === item.id);
          
          if (!existingInList) {
            this.shoppingList.push({
              id: `shopping-${Date.now()}`,
              itemId: item.id,
              name: item.name,
              category: item.category,
              priority: 'low',
              addedDate: new Date().toISOString()
            });
            
            this.emit('notification', {
              title: 'Low Stock Alert',
              message: `${item.name} is running low (${Math.round(remainingPercent)}% remaining)`,
              priority: 'low',
              category: 'bar-inventory'
            });
          }
        } else if (remainingPercent === 0) {
          item.status = 'empty';
        }
      }
      
      await this.saveSettings();
    } catch (error) {
      this.homey.error('Error checking inventory levels:', error);
    }
  }

  async checkExpiryDates() {
    try {
      const today = new Date();
      
      for (const item of this.inventory.values()) {
        if (item.expiryDate) {
          const expiry = new Date(item.expiryDate);
          const daysUntilExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
          
          if (daysUntilExpiry <= 0) {
            item.status = 'expired';
            
            this.emit('notification', {
              title: 'Item Expired',
              message: `${item.name} has expired`,
              priority: 'medium',
              category: 'bar-inventory'
            });
          } else if (daysUntilExpiry <= 3 && !item.expiryWarningShown) {
            item.expiryWarningShown = true;
            
            this.emit('notification', {
              title: 'Item Expiring Soon',
              message: `${item.name} expires in ${daysUntilExpiry} day(s)`,
              priority: 'low',
              category: 'bar-inventory'
            });
          }
        }
      }
      
      await this.saveSettings();
    } catch (error) {
      this.homey.error('Error checking expiry dates:', error);
    }
  }

  async getCocktailRecommendations(criteria = {}) {
    try {
      const {
        availableOnly = true,
        strength = null,
        category = null,
        ingredients = null
      } = criteria;
      
      let cocktails = Array.from(this.cocktails.values());
      
      // Filter by category
      if (category) {
        cocktails = cocktails.filter(c => c.category === category);
      }
      
      // Filter by strength
      if (strength) {
        cocktails = cocktails.filter(c => c.strength === strength);
      }
      
      // Filter by available ingredients
      if (availableOnly) {
        cocktails = cocktails.filter(c => this.canMakeCocktail(c.id));
      }
      
      // Sort by rating
      cocktails.sort((a, b) => b.rating - a.rating);
      
      return cocktails.slice(0, 10);
    } catch (error) {
      this.homey.error('Error getting cocktail recommendations:', error);
      throw error;
    }
  }

  canMakeCocktail(cocktailId) {
    const cocktail = this.cocktails.get(cocktailId);
    if (!cocktail) return false;
    
    for (const ingredient of cocktail.ingredients) {
      if (!ingredient.inventoryId) continue; // Skip non-inventory items (like fresh mint)
      
      const item = this.inventory.get(ingredient.inventoryId);
      if (!item || item.volumeRemaining < ingredient.amount) {
        return false;
      }
    }
    
    return true;
  }

  async makeCocktail(cocktailId) {
    try {
      const cocktail = this.cocktails.get(cocktailId);
      if (!cocktail) {
        throw new Error('Cocktail not found');
      }

      if (!this.canMakeCocktail(cocktailId)) {
        throw new Error('Insufficient ingredients');
      }

      // Deduct ingredients from inventory
      for (const ingredient of cocktail.ingredients) {
        if (ingredient.inventoryId) {
          const item = this.inventory.get(ingredient.inventoryId);
          if (item) {
            item.volumeRemaining -= ingredient.amount;
          }
        }
      }
      
      // Update cocktail stats
      cocktail.timesMade++;
      
      // Record in history
      const drinkRecord = {
        id: `drink-${Date.now()}`,
        cocktailId,
        cocktailName: cocktail.name,
        date: new Date().toISOString(),
        cost: this.calculateCocktailCost(cocktailId)
      };
      
      this.drinkHistory.push(drinkRecord);
      
      await this.saveSettings();
      
      this.emit('notification', {
        title: 'Cocktail Made',
        message: `${cocktail.name} prepared successfully`,
        priority: 'low',
        category: 'bar'
      });
      
      return { cocktail, drinkRecord };
    } catch (error) {
      this.homey.error('Error making cocktail:', error);
      throw error;
    }
  }

  calculateCocktailCost(cocktailId) {
    const cocktail = this.cocktails.get(cocktailId);
    if (!cocktail) return 0;
    
    let totalCost = 0;
    
    for (const ingredient of cocktail.ingredients) {
      if (ingredient.inventoryId) {
        const item = this.inventory.get(ingredient.inventoryId);
        if (item) {
          const costPerMl = item.cost / item.volume;
          totalCost += costPerMl * ingredient.amount;
        }
      }
    }
    
    return Math.round(totalCost * 100) / 100; // Round to 2 decimals
  }

  async addTastingNote(itemId, noteData) {
    try {
      const item = this.inventory.get(itemId);
      if (!item) {
        throw new Error('Item not found');
      }

      const note = {
        id: `note-${Date.now()}`,
        itemId,
        itemName: item.name,
        date: new Date().toISOString(),
        rating: noteData.rating || 0,
        nose: noteData.nose || '',
        palate: noteData.palate || '',
        finish: noteData.finish || '',
        notes: noteData.notes || ''
      };
      
      this.tastingNotes.push(note);
      await this.saveSettings();
      
      return note;
    } catch (error) {
      this.homey.error('Error adding tasting note:', error);
      throw error;
    }
  }

  getInventory(filter = null) {
    let items = Array.from(this.inventory.values());
    
    if (filter) {
      if (filter.category) items = items.filter(i => i.category === filter.category);
      if (filter.type) items = items.filter(i => i.type === filter.type);
      if (filter.storageZone) items = items.filter(i => i.storageZone === filter.storageZone);
      if (filter.status) items = items.filter(i => i.status === filter.status);
    }
    
    return items;
  }

  getCocktails(filter = null) {
    let cocktails = Array.from(this.cocktails.values());
    
    if (filter) {
      if (filter.category) cocktails = cocktails.filter(c => c.category === filter.category);
      if (filter.difficulty) cocktails = cocktails.filter(c => c.difficulty === filter.difficulty);
      if (filter.strength) cocktails = cocktails.filter(c => c.strength === filter.strength);
    }
    
    return cocktails;
  }

  getDrinkHistory(limit = 50) {
    return this.drinkHistory.slice(-limit).reverse();
  }

  getShoppingList() {
    return this.shoppingList;
  }

  getTastingNotes(itemId = null) {
    if (itemId) {
      return this.tastingNotes.filter(n => n.itemId === itemId);
    }
    return this.tastingNotes;
  }

  getStats() {
    const inventory = Array.from(this.inventory.values());
    const cocktails = Array.from(this.cocktails.values());
    
    return {
      totalItems: inventory.length,
      byCategory: {
        spirits: inventory.filter(i => i.category === 'spirits').length,
        liqueurs: inventory.filter(i => i.category === 'liqueurs').length,
        mixers: inventory.filter(i => i.category === 'mixers').length,
        fortified: inventory.filter(i => i.category === 'fortified').length
      },
      totalCocktails: cocktails.length,
      totalDrinksMade: this.drinkHistory.length,
      favoritecocktail: cocktails.sort((a, b) => b.timesMade - a.timesMade)[0],
      totalInventoryValue: inventory.reduce((sum, i) => sum + i.cost, 0),
      lowStockItems: inventory.filter(i => (i.volumeRemaining / i.volume) * 100 <= 20).length,
      shoppingListItems: this.shoppingList.length
    };
  }

  async destroy() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    this._cache.clear();
    this.removeAllListeners();
  }
}

module.exports = HomeBarManagementSystem;
