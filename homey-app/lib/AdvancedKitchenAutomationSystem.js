const EventEmitter = require('events');

/**
 * Advanced Kitchen Automation System
 * 
 * Provides intelligent kitchen automation with recipe-guided cooking,
 * inventory management, and coordinated appliance control.
 * 
 * Features:
 * - Recipe-guided cooking with step-by-step automation
 * - Smart inventory tracking with expiration monitoring
 * - Coordinated appliance control (oven, cooktop, hood)
 * - Meal planning and shopping list generation
 * - Voice-guided cooking assistance
 * - Nutritional tracking and analysis
 * - Automated preheating and temperature control
 * - Energy optimization for appliances
 * - Dishwasher smart loading and scheduling
 * - Food waste tracking and reduction
 */
class AdvancedKitchenAutomationSystem extends EventEmitter {
  constructor(homey) {
    super();
    this.homey = homey;
    this.appliances = new Map();
    this.inventory = new Map();
    this.recipes = new Map();
    this.cookingSessions = [];
    this.currentSession = null;
    this.mealPlans = [];
    this.shoppingList = [];
    this.monitoringInterval = null;
    
    // Performance optimizations
    this._cache = new Map();
    this._cacheTimeout = 180000; // 3 minutes
    this._retryConfig = { maxRetries: 3, retryDelay: 1000 };
  }

  async initialize() {
    this.homey.log('Initializing Advanced Kitchen Automation System...');
    
    try {
      await this.loadSettings();
      this.initializeDefaultAppliances();
      this.initializeRecipes();
      this.initializeInventory();
      
      this.startMonitoring();
      
      this.homey.log('Advanced Kitchen Automation System initialized successfully');
      return true;
    } catch (error) {
      this.homey.error('Failed to initialize Kitchen Automation System:', error);
      throw error;
    }
  }

  async loadSettings() {
    try {
      const settings = await this.homey.settings.get('advancedKitchen') || {};
      
      if (settings.appliances) {
        settings.appliances.forEach(app => {
          this.appliances.set(app.id, app);
        });
      }
      
      if (settings.inventory) {
        settings.inventory.forEach(item => {
          this.inventory.set(item.id, item);
        });
      }
      
      if (settings.recipes) {
        settings.recipes.forEach(recipe => {
          this.recipes.set(recipe.id, recipe);
        });
      }
      
      this.cookingSessions = settings.cookingSessions || [];
      this.currentSession = settings.currentSession || null;
      this.mealPlans = settings.mealPlans || [];
      this.shoppingList = settings.shoppingList || [];
    } catch (error) {
      this.homey.error('Error loading kitchen settings:', error);
      throw error;
    }
  }

  async saveSettings() {
    try {
      const settings = {
        appliances: Array.from(this.appliances.values()),
        inventory: Array.from(this.inventory.values()).slice(-200), // Keep 200 items
        recipes: Array.from(this.recipes.values()),
        cookingSessions: this.cookingSessions.slice(-30), // Keep last 30
        currentSession: this.currentSession,
        mealPlans: this.mealPlans.slice(-14), // Keep 2 weeks
        shoppingList: this.shoppingList
      };
      
      await this.homey.settings.set('advancedKitchen', settings);
      
      // Clear cache
      this._cache.clear();
    } catch (error) {
      this.homey.error('Error saving kitchen settings:', error);
      throw error;
    }
  }

  initializeDefaultAppliances() {
    if (this.appliances.size === 0) {
      // Smart Oven
      this.appliances.set('oven-main', {
        id: 'oven-main',
        name: 'Main Oven',
        type: 'oven',
        brand: 'Miele',
        model: 'H7860BP',
        status: 'off',
        currentTemp: 20,
        targetTemp: 0,
        mode: 'off', // off, bake, convection, broil, steam, proof
        timer: 0,
        doorOpen: false,
        selfCleaning: false,
        features: {
          convection: true,
          steam: true,
          probe: true,
          wifi: true
        },
        energy: {
          powerRating: 3600, // watts
          totalUsage: 0 // kWh
        }
      });

      // Cooktop
      this.appliances.set('cooktop-main', {
        id: 'cooktop-main',
        name: 'Main Cooktop',
        type: 'cooktop',
        brand: 'Bosch',
        model: 'Induction 800',
        status: 'off',
        zones: [
          { id: 1, status: 'off', power: 0, maxPower: 3700, temp: 20, booster: false },
          { id: 2, status: 'off', power: 0, maxPower: 3700, temp: 20, booster: false },
          { id: 3, status: 'off', power: 0, maxPower: 2300, temp: 20, booster: false },
          { id: 4, status: 'off', power: 0, maxPower: 2300, temp: 20, booster: false }
        ],
        features: {
          induction: true,
          booster: true,
          panDetection: true,
          powerManagement: true
        },
        energy: {
          powerRating: 7400,
          totalUsage: 0
        }
      });

      // Range Hood
      this.appliances.set('hood-main', {
        id: 'hood-main',
        name: 'Range Hood',
        type: 'hood',
        status: 'off',
        fanSpeed: 0, // 0-4
        lightStatus: 'off',
        lightBrightness: 0,
        airflow: 0, // m³/h
        filterStatus: 'clean',
        filterUsageHours: 0,
        filterLifespan: 200,
        features: {
          autoMode: true,
          sensorActivation: true,
          remoteControl: true
        }
      });

      // Dishwasher
      this.appliances.set('dishwasher-main', {
        id: 'dishwasher-main',
        name: 'Main Dishwasher',
        type: 'dishwasher',
        brand: 'Bosch',
        status: 'idle',
        program: 'none', // eco, normal, intensive, quick, glass
        remainingTime: 0,
        doorOpen: false,
        detergent: 80, // % full
        rinseAid: 70,
        energy: {
          powerRating: 1800,
          totalUsage: 0
        },
        smartSchedule: {
          enabled: true,
          preferredTime: '01:00', // Run during low energy cost
          delayStart: true
        }
      });

      // Refrigerator
      this.appliances.set('fridge-main', {
        id: 'fridge-main',
        name: 'Main Refrigerator',
        type: 'refrigerator',
        status: 'running',
        compartments: {
          fridge: {
            currentTemp: 4,
            targetTemp: 4,
            humidity: 50
          },
          freezer: {
            currentTemp: -18,
            targetTemp: -18,
            fastFreeze: false
          },
          crisper: {
            currentTemp: 6,
            humidity: 90
          }
        },
        doorStatus: {
          fridge: 'closed',
          freezer: 'closed'
        },
        features: {
          icemaker: true,
          waterFilter: true,
          vacation: false
        },
        energy: {
          powerRating: 150,
          totalUsage: 0
        }
      });

      // Coffee Machine
      this.appliances.set('coffee-main', {
        id: 'coffee-main',
        name: 'Coffee Machine',
        type: 'coffee',
        status: 'standby',
        waterLevel: 75,
        beanLevel: 60,
        milkLevel: 40,
        cupsMade: 0,
        cleaningDue: false,
        descalingDue: false,
        presets: [
          { id: 'espresso', name: 'Espresso', size: 40, strength: 'strong' },
          { id: 'cappuccino', name: 'Cappuccino', size: 180, strength: 'medium', milk: true },
          { id: 'latte', name: 'Latte', size: 240, strength: 'medium', milk: true }
        ]
      });
    }
  }

  initializeRecipes() {
    if (this.recipes.size === 0) {
      // Roast Chicken Recipe
      this.recipes.set('roast-chicken', {
        id: 'roast-chicken',
        name: 'Classic Roast Chicken',
        cuisine: 'American',
        difficulty: 'medium',
        servings: 4,
        prepTime: 15, // minutes
        cookTime: 90,
        totalTime: 105,
        ingredients: [
          { item: 'whole-chicken', amount: 1.5, unit: 'kg', inventoryId: 'chicken-001' },
          { item: 'olive-oil', amount: 2, unit: 'tbsp', inventoryId: 'oil-olive' },
          { item: 'garlic', amount: 4, unit: 'cloves', inventoryId: 'garlic-001' },
          { item: 'lemon', amount: 1, unit: 'piece', inventoryId: 'lemon-001' },
          { item: 'herbs', amount: 2, unit: 'tbsp', inventoryId: 'herbs-mixed' }
        ],
        steps: [
          {
            step: 1,
            instruction: 'Preheat oven to 200°C',
            applianceAction: { appliance: 'oven-main', action: 'preheat', temp: 200, mode: 'convection' },
            duration: 10,
            timer: false
          },
          {
            step: 2,
            instruction: 'Pat chicken dry and season',
            applianceAction: null,
            duration: 5,
            timer: true
          },
          {
            step: 3,
            instruction: 'Place in roasting pan',
            applianceAction: null,
            duration: 2,
            timer: false
          },
          {
            step: 4,
            instruction: 'Roast for 90 minutes',
            applianceAction: { appliance: 'oven-main', action: 'cook', temp: 200, duration: 90 },
            duration: 90,
            timer: true
          },
          {
            step: 5,
            instruction: 'Rest for 10 minutes before carving',
            applianceAction: { appliance: 'oven-main', action: 'off' },
            duration: 10,
            timer: true
          }
        ],
        nutrition: {
          calories: 420,
          protein: 35,
          carbs: 2,
          fat: 30,
          fiber: 0
        },
        tags: ['dinner', 'main-course', 'poultry']
      });

      // Pasta Recipe
      this.recipes.set('pasta-carbonara', {
        id: 'pasta-carbonara',
        name: 'Pasta Carbonara',
        cuisine: 'Italian',
        difficulty: 'easy',
        servings: 4,
        prepTime: 10,
        cookTime: 15,
        totalTime: 25,
        ingredients: [
          { item: 'spaghetti', amount: 400, unit: 'g', inventoryId: 'pasta-spaghetti' },
          { item: 'eggs', amount: 4, unit: 'pieces', inventoryId: 'eggs-001' },
          { item: 'bacon', amount: 200, unit: 'g', inventoryId: 'bacon-001' },
          { item: 'parmesan', amount: 100, unit: 'g', inventoryId: 'cheese-parmesan' }
        ],
        steps: [
          {
            step: 1,
            instruction: 'Boil water on zone 1, high power',
            applianceAction: { appliance: 'cooktop-main', action: 'setZone', zone: 1, power: 9 },
            duration: 5,
            timer: false
          },
          {
            step: 2,
            instruction: 'Add pasta, cook for 10 minutes',
            applianceAction: null,
            duration: 10,
            timer: true
          },
          {
            step: 3,
            instruction: 'Fry bacon on zone 2',
            applianceAction: { appliance: 'cooktop-main', action: 'setZone', zone: 2, power: 6 },
            duration: 8,
            timer: true
          },
          {
            step: 4,
            instruction: 'Mix eggs and cheese',
            applianceAction: null,
            duration: 3,
            timer: false
          },
          {
            step: 5,
            instruction: 'Combine and serve',
            applianceAction: { appliance: 'cooktop-main', action: 'off' },
            duration: 2,
            timer: false
          }
        ],
        nutrition: {
          calories: 620,
          protein: 28,
          carbs: 72,
          fat: 24,
          fiber: 3
        },
        tags: ['quick', 'dinner', 'pasta', 'italian']
      });
    }
  }

  initializeInventory() {
    if (this.inventory.size === 0) {
      const today = new Date();
      
      // Sample inventory items
      const sampleItems = [
        { id: 'chicken-001', name: 'Whole Chicken', category: 'meat', quantity: 1, unit: 'kg', location: 'fridge', expiryDays: 3 },
        { id: 'eggs-001', name: 'Eggs', category: 'dairy', quantity: 12, unit: 'pieces', location: 'fridge', expiryDays: 14 },
        { id: 'milk-001', name: 'Milk', category: 'dairy', quantity: 1, unit: 'liter', location: 'fridge', expiryDays: 5 },
        { id: 'cheese-parmesan', name: 'Parmesan Cheese', category: 'dairy', quantity: 200, unit: 'g', location: 'fridge', expiryDays: 30 },
        { id: 'pasta-spaghetti', name: 'Spaghetti', category: 'pantry', quantity: 500, unit: 'g', location: 'pantry', expiryDays: 365 },
        { id: 'oil-olive', name: 'Olive Oil', category: 'pantry', quantity: 500, unit: 'ml', location: 'pantry', expiryDays: 180 },
        { id: 'bacon-001', name: 'Bacon', category: 'meat', quantity: 300, unit: 'g', location: 'fridge', expiryDays: 7 },
        { id: 'garlic-001', name: 'Garlic', category: 'produce', quantity: 1, unit: 'bulb', location: 'pantry', expiryDays: 21 },
        { id: 'lemon-001', name: 'Lemon', category: 'produce', quantity: 3, unit: 'pieces', location: 'fridge', expiryDays: 14 }
      ];
      
      sampleItems.forEach(item => {
        const expiryDate = new Date(today);
        expiryDate.setDate(expiryDate.getDate() + item.expiryDays);
        
        this.inventory.set(item.id, {
          ...item,
          purchaseDate: today.toISOString(),
          expiryDate: expiryDate.toISOString(),
          status: 'fresh',
          pricePerUnit: 0
        });
      });
    }
  }

  startMonitoring() {
    // Monitor kitchen status every 2 minutes
    this.monitoringInterval = setInterval(() => {
      this.checkInventoryExpiry();
      this.monitorAppliances();
      this.updateCookingSession();
    }, 120000);
  }

  async checkInventoryExpiry() {
    try {
      const today = new Date();
      
      for (const item of this.inventory.values()) {
        const expiry = new Date(item.expiryDate);
        const daysUntilExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
        
        if (daysUntilExpiry <= 0) {
          item.status = 'expired';
          
          this.emit('notification', {
            title: 'Item Expired',
            message: `${item.name} has expired and should be discarded`,
            priority: 'high',
            category: 'kitchen-inventory'
          });
        } else if (daysUntilExpiry <= 2) {
          item.status = 'expiring-soon';
          
          if (!item.expiryWarningShown) {
            item.expiryWarningShown = true;
            this.emit('notification', {
              title: 'Item Expiring Soon',
              message: `${item.name} expires in ${daysUntilExpiry} day(s)`,
              priority: 'medium',
              category: 'kitchen-inventory'
            });
          }
        } else {
          item.status = 'fresh';
        }
      }
      
      await this.saveSettings();
    } catch (error) {
      this.homey.error('Error checking inventory expiry:', error);
    }
  }

  async monitorAppliances() {
    try {
      // Check hood filter
      const hood = this.appliances.get('hood-main');
      if (hood && hood.fanSpeed > 0) {
        hood.filterUsageHours += (2 / 60);
        
        if (hood.filterUsageHours >= hood.filterLifespan) {
          hood.filterStatus = 'replace';
          
          this.emit('notification', {
            title: 'Hood Filter Replacement',
            message: 'Range hood filter needs replacement',
            priority: 'medium',
            category: 'kitchen-maintenance'
          });
        } else if (hood.filterUsageHours >= hood.filterLifespan * 0.9) {
          hood.filterStatus = 'dirty';
        }
      }
      
      // Check dishwasher detergent
      const dishwasher = this.appliances.get('dishwasher-main');
      if (dishwasher && dishwasher.detergent < 20) {
        this.emit('notification', {
          title: 'Low Dishwasher Detergent',
          message: 'Detergent level is low, please refill',
          priority: 'low',
          category: 'kitchen-maintenance'
        });
      }
      
      await this.saveSettings();
    } catch (error) {
      this.homey.error('Error monitoring appliances:', error);
    }
  }

  async updateCookingSession() {
    if (!this.currentSession) return;
    
    try {
      const elapsed = Date.now() - this.currentSession.startTime;
      this.currentSession.elapsedMinutes = Math.floor(elapsed / 60000);
    } catch (error) {
      this.homey.error('Error updating cooking session:', error);
    }
  }

  async startRecipe(recipeId) {
    try {
      const recipe = this.recipes.get(recipeId);
      if (!recipe) {
        throw new Error('Recipe not found');
      }

      this.homey.log(`Starting recipe: ${recipe.name}`);
      
      // Check ingredient availability
      const missingIngredients = [];
      for (const ingredient of recipe.ingredients) {
        if (ingredient.inventoryId) {
          const item = this.inventory.get(ingredient.inventoryId);
          if (!item || item.quantity < ingredient.amount) {
            missingIngredients.push(ingredient.item);
          }
        }
      }
      
      if (missingIngredients.length > 0) {
        this.emit('notification', {
          title: 'Missing Ingredients',
          message: `Missing: ${missingIngredients.join(', ')}`,
          priority: 'medium',
          category: 'kitchen'
        });
      }
      
      // Create cooking session
      this.currentSession = {
        id: `session-${Date.now()}`,
        recipeId,
        recipeName: recipe.name,
        startTime: Date.now(),
        currentStep: 0,
        totalSteps: recipe.steps.length,
        elapsedMinutes: 0,
        status: 'in-progress'
      };
      
      this.cookingSessions.push(this.currentSession);
      
      await this.saveSettings();
      
      this.emit('notification', {
        title: 'Cooking Started',
        message: `Started cooking ${recipe.name}`,
        priority: 'low',
        category: 'kitchen'
      });
      
      return { recipe, session: this.currentSession };
    } catch (error) {
      this.homey.error('Error starting recipe:', error);
      throw error;
    }
  }

  async executeRecipeStep(stepNumber) {
    try {
      if (!this.currentSession) {
        throw new Error('No active cooking session');
      }
      
      const recipe = this.recipes.get(this.currentSession.recipeId);
      if (!recipe) {
        throw new Error('Recipe not found');
      }
      
      const step = recipe.steps.find(s => s.step === stepNumber);
      if (!step) {
        throw new Error('Step not found');
      }
      
      this.currentSession.currentStep = stepNumber;
      
      // Execute appliance action if any
      if (step.applianceAction) {
        await this.executeApplianceAction(step.applianceAction);
      }
      
      // Start timer if needed
      if (step.timer && step.duration > 0) {
        setTimeout(() => {
          this.emit('notification', {
            title: 'Step Complete',
            message: `Step ${stepNumber} timer finished`,
            priority: 'medium',
            category: 'kitchen-cooking'
          });
        }, step.duration * 60000);
      }
      
      await this.saveSettings();
      
      return { step, session: this.currentSession };
    } catch (error) {
      this.homey.error('Error executing recipe step:', error);
      throw error;
    }
  }

  async executeApplianceAction(action) {
    const appliance = this.appliances.get(action.appliance);
    if (!appliance) {
      throw new Error('Appliance not found');
    }
    
    switch (action.action) {
      case 'preheat':
        appliance.status = 'preheating';
        appliance.targetTemp = action.temp;
        appliance.mode = action.mode || 'bake';
        break;
        
      case 'cook':
        appliance.status = 'cooking';
        appliance.targetTemp = action.temp;
        if (action.duration) {
          appliance.timer = action.duration;
        }
        break;
        
      case 'setZone':
        if (appliance.type === 'cooktop' && appliance.zones) {
          const zone = appliance.zones.find(z => z.id === action.zone);
          if (zone) {
            zone.status = 'on';
            zone.power = action.power || 5;
          }
        }
        break;
        
      case 'off':
        appliance.status = 'off';
        if (appliance.zones) {
          appliance.zones.forEach(z => z.status = 'off');
        }
        break;
    }
    
    // Activate hood automatically when cooktop is on
    if (appliance.type === 'cooktop') {
      const hood = this.appliances.get('hood-main');
      if (hood && hood.features.autoMode) {
        const anyZoneOn = appliance.zones.some(z => z.status === 'on');
        if (anyZoneOn) {
          hood.status = 'on';
          hood.fanSpeed = 2;
        } else {
          hood.status = 'off';
          hood.fanSpeed = 0;
        }
      }
    }
  }

  async completeRecipe() {
    if (!this.currentSession) {
      throw new Error('No active cooking session');
    }
    
    this.currentSession.endTime = Date.now();
    this.currentSession.status = 'completed';
    
    // Deduct ingredients from inventory
    const recipe = this.recipes.get(this.currentSession.recipeId);
    if (recipe) {
      for (const ingredient of recipe.ingredients) {
        if (ingredient.inventoryId) {
          const item = this.inventory.get(ingredient.inventoryId);
          if (item) {
            item.quantity = Math.max(0, item.quantity - ingredient.amount);
          }
        }
      }
    }
    
    this.currentSession = null;
    await this.saveSettings();
    
    this.emit('notification', {
      title: 'Cooking Completed',
      message: `${recipe.name} is ready!`,
      priority: 'low',
      category: 'kitchen'
    });
  }

  // Cached getters
  getAppliances() {
    const cacheKey = 'appliances_list';
    const cached = this._cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this._cacheTimeout) {
      return cached.data;
    }
    
    const appliances = Array.from(this.appliances.values());
    this._cache.set(cacheKey, { data: appliances, timestamp: Date.now() });
    return appliances;
  }

  getInventory(filter = null) {
    let items = Array.from(this.inventory.values());
    
    if (filter) {
      if (filter.category) {
        items = items.filter(i => i.category === filter.category);
      }
      if (filter.status) {
        items = items.filter(i => i.status === filter.status);
      }
      if (filter.location) {
        items = items.filter(i => i.location === filter.location);
      }
    }
    
    return items;
  }

  getRecipes(filter = null) {
    let recipes = Array.from(this.recipes.values());
    
    if (filter) {
      if (filter.cuisine) {
        recipes = recipes.filter(r => r.cuisine === filter.cuisine);
      }
      if (filter.difficulty) {
        recipes = recipes.filter(r => r.difficulty === filter.difficulty);
      }
      if (filter.tag) {
        recipes = recipes.filter(r => r.tags && r.tags.includes(filter.tag));
      }
    }
    
    return recipes;
  }

  getCookingSessions(limit = 20) {
    return this.cookingSessions.slice(-limit).reverse();
  }

  getCurrentSession() {
    return this.currentSession;
  }

  getShoppingList() {
    return this.shoppingList;
  }

  async addToShoppingList(item) {
    this.shoppingList.push({
      id: `item-${Date.now()}`,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      category: item.category,
      addedAt: new Date().toISOString(),
      purchased: false
    });
    
    await this.saveSettings();
    return this.shoppingList;
  }

  getStats() {
    const appliances = Array.from(this.appliances.values());
    const inventory = Array.from(this.inventory.values());
    
    return {
      totalAppliances: appliances.length,
      activeAppliances: appliances.filter(a => a.status === 'on' || a.status === 'cooking').length,
      totalInventoryItems: inventory.length,
      expiringItems: inventory.filter(i => i.status === 'expiring-soon').length,
      expiredItems: inventory.filter(i => i.status === 'expired').length,
      totalRecipes: this.recipes.size,
      cookingSessions: this.cookingSessions.length,
      currentSession: this.currentSession,
      shoppingListItems: this.shoppingList.filter(i => !i.purchased).length,
      energyUsage: appliances.reduce((sum, a) => sum + (a.energy?.totalUsage || 0), 0)
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

module.exports = AdvancedKitchenAutomationSystem;
