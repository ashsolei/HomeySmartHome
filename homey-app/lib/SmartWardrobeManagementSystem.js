'use strict';

/**
 * SmartWardrobeManagementSystem
 * Comprehensive smart wardrobe, clothing, and outfit management system.
 * Features: clothing inventory, AI outfit recommendations, weather-based suggestions,
 * laundry tracking, seasonal rotation, outfit history, style profiles, capsule wardrobe,
 * shopping suggestions, packing assistant, color analysis, closet organization,
 * donation suggestions, fashion trends, ironing/steaming, shoe management,
 * environmental impact scoring, and more.
 */
class SmartWardrobeManagementSystem {
  constructor(homey) {
    this.homey = homey;

    // Clothing inventory (up to 200 items)
    this.inventory = [];
    this.maxInventorySize = 200;

    // Outfit history (last 60 outfits)
    this.outfitHistory = [];
    this.maxOutfitHistory = 60;
    this.repeatPreventionDays = 7;

    // Style profiles (up to 6 household members)
    this.styleProfiles = [];
    this.maxProfiles = 6;

    // Shopping & budget
    this.wishlist = [];
    this.shoppingBudget = { monthly: 200, annual: 2000, spentMonthly: 0, spentAnnual: 0 };

    // Packing lists
    this.packingLists = [];

    // Shoe management (12 slots)
    this.shoeSlots = 12;

    // Closet environment
    this.closetEnvironment = {
      humidity: 50,
      temperature: 20,
      lightOn: false,
      cedarBlockAge: 0,
      lastMothCheck: null,
      idealHumidityMin: 45,
      idealHumidityMax: 55
    };

    // Laundry settings (auto-dirty after N wears)
    this.wearThresholds = {
      shirt: 1,
      pants: 3,
      jacket: 5,
      jeans: 7,
      underwear: 1,
      dress: 2,
      skirt: 2,
      suit: 3,
      coat: 10,
      sweater: 3,
      shorts: 2,
      shoes: 15,
      accessory: 20
    };

    // Wash care instructions per material
    this.washCareInstructions = {
      cotton: { temp: 40, cycle: 'normal', dryer: true, iron: 'medium', notes: 'Machine washable, may shrink in hot water' },
      wool: { temp: 30, cycle: 'delicate', dryer: false, iron: 'low', notes: 'Hand wash preferred, lay flat to dry' },
      silk: { temp: 30, cycle: 'delicate', dryer: false, iron: 'low', notes: 'Hand wash or dry clean, avoid direct sunlight' },
      polyester: { temp: 40, cycle: 'normal', dryer: true, iron: 'low', notes: 'Quick drying, resistant to wrinkles' },
      leather: { temp: null, cycle: null, dryer: false, iron: false, notes: 'Professional cleaning only, condition regularly' },
      denim: { temp: 30, cycle: 'normal', dryer: true, iron: 'high', notes: 'Wash inside out, cold water preserves color' },
      linen: { temp: 40, cycle: 'gentle', dryer: false, iron: 'high', notes: 'Wrinkles easily, hang dry recommended' }
    };

    // Color coordination rules
    this.colorWheel = {
      red: { complementary: 'green', analogous: ['red-orange', 'red-violet'], triadic: ['blue', 'yellow'] },
      blue: { complementary: 'orange', analogous: ['blue-green', 'blue-violet'], triadic: ['red', 'yellow'] },
      yellow: { complementary: 'purple', analogous: ['yellow-green', 'yellow-orange'], triadic: ['red', 'blue'] },
      green: { complementary: 'red', analogous: ['yellow-green', 'blue-green'], triadic: ['orange', 'purple'] },
      orange: { complementary: 'blue', analogous: ['yellow-orange', 'red-orange'], triadic: ['green', 'purple'] },
      purple: { complementary: 'yellow', analogous: ['red-violet', 'blue-violet'], triadic: ['orange', 'green'] },
      black: { complementary: 'white', analogous: ['grey', 'charcoal'], triadic: ['white', 'grey'] },
      white: { complementary: 'black', analogous: ['cream', 'ivory'], triadic: ['black', 'grey'] },
      grey: { complementary: 'grey', analogous: ['charcoal', 'silver'], triadic: ['black', 'white'] },
      navy: { complementary: 'tan', analogous: ['blue', 'indigo'], triadic: ['burgundy', 'forest-green'] },
      brown: { complementary: 'teal', analogous: ['tan', 'beige'], triadic: ['navy', 'burgundy'] },
      beige: { complementary: 'navy', analogous: ['cream', 'tan'], triadic: ['grey', 'brown'] },
      pink: { complementary: 'mint', analogous: ['rose', 'coral'], triadic: ['light-blue', 'light-yellow'] }
    };

    // Neutral colors that pair with anything
    this.neutralColors = ['black', 'white', 'grey', 'navy', 'beige', 'brown', 'cream', 'tan', 'charcoal'];

    // Seasonal rotation months
    this.seasonalMonths = {
      spring: [3, 4, 5],
      summer: [6, 7, 8],
      autumn: [9, 10, 11],
      winter: [12, 1, 2]
    };

    // Fashion trends (seasonal)
    this.fashionTrends = {
      spring: ['pastels', 'floral prints', 'light layers', 'trench coats', 'white sneakers'],
      summer: ['linen', 'bright colors', 'wide-brim hats', 'sandals', 'lightweight fabrics'],
      autumn: ['earth tones', 'layering', 'boots', 'scarves', 'corduroy'],
      winter: ['dark colors', 'heavy knits', 'wool coats', 'leather boots', 'cashmere']
    };

    // Personal color seasons
    this.colorSeasons = {
      spring: { best: ['coral', 'peach', 'warm-yellow', 'light-green', 'aqua'], avoid: ['black', 'dark-grey', 'cool-blue'] },
      summer: { best: ['lavender', 'soft-pink', 'powder-blue', 'mauve', 'slate'], avoid: ['orange', 'warm-yellow', 'bright-red'] },
      autumn: { best: ['rust', 'olive', 'mustard', 'burgundy', 'teal'], avoid: ['neon', 'cool-pink', 'icy-blue'] },
      winter: { best: ['black', 'white', 'red', 'royal-blue', 'emerald'], avoid: ['orange', 'gold', 'warm-beige'] }
    };

    // Environmental impact scores per material (1-10, lower is better)
    this.materialSustainability = {
      cotton: { score: 5, note: 'Water intensive, choose organic when possible' },
      wool: { score: 4, note: 'Renewable, biodegradable, long-lasting' },
      silk: { score: 6, note: 'Resource intensive production' },
      polyester: { score: 8, note: 'Petroleum-based, microplastic shedding' },
      leather: { score: 7, note: 'High environmental impact, very durable' },
      denim: { score: 6, note: 'Water and chemical intensive production' },
      linen: { score: 3, note: 'Low water usage, biodegradable, eco-friendly' }
    };

    // Capsule wardrobe target
    this.capsuleTarget = 33;

    // Essential items for capsule wardrobe
    this.capsuleEssentials = [
      { type: 'shirt', color: 'white', formality: 'business', count: 2 },
      { type: 'shirt', color: 'blue', formality: 'business', count: 1 },
      { type: 'pants', color: 'navy', formality: 'business', count: 1 },
      { type: 'pants', color: 'black', formality: 'business', count: 1 },
      { type: 'pants', color: 'blue', formality: 'casual', count: 1 },
      { type: 'jacket', color: 'navy', formality: 'business', count: 1 },
      { type: 'coat', color: 'black', formality: 'smart-casual', count: 1 },
      { type: 'sweater', color: 'grey', formality: 'smart-casual', count: 1 },
      { type: 'shoes', color: 'black', formality: 'formal', count: 1 },
      { type: 'shoes', color: 'brown', formality: 'smart-casual', count: 1 },
      { type: 'shoes', color: 'white', formality: 'casual', count: 1 }
    ];

    // Current weather cache
    this.currentWeather = { temperature: 20, rainProbability: 0, windSpeed: 10, condition: 'clear' };

    // Calendar events cache
    this.calendarEvents = [];

    // Monitoring interval
    this.monitoringInterval = null;
    this.monitoringCycleMs = 5 * 60 * 1000; // 5 minutes

    // Outfit of the day
    this.outfitOfTheDay = null;
    this.outfitOfTheDayDate = null;

    // Ironing/steaming queue
    this.ironingQueue = [];

    // Donation suggestions cache
    this.donationSuggestions = [];
  }

  /**
   * Initialize the wardrobe management system
   */
  async initialize() {
    this.log('Initializing SmartWardrobeManagementSystem...');

    try {
      await this._loadPersistedData();
      this._startMonitoringCycle();
      await this._generateOutfitOfTheDay();
      this._updateDonationSuggestions();
      this._checkSeasonalRotation();
      this._updateIroningQueue();

      this.log('SmartWardrobeManagementSystem initialized successfully');
      this.log(`Inventory: ${this.inventory.length} items, Profiles: ${this.styleProfiles.length}, History: ${this.outfitHistory.length} outfits`);
    } catch (err) {
      this.error(`Initialization failed: ${err.message}`);
    }
  }

  // ─── CLOTHING INVENTORY ──────────────────────────────────────────────

  /**
   * Add clothing item to inventory
   */
  addClothingItem(item) {
    if (this.inventory.length >= this.maxInventorySize) {
      this.error(`Inventory full (max ${this.maxInventorySize} items)`);
      return null;
    }

    const validTypes = ['shirt', 'pants', 'jacket', 'shoes', 'accessory', 'underwear', 'dress', 'skirt', 'suit', 'coat', 'sweater', 'shorts'];
    const validMaterials = ['cotton', 'wool', 'silk', 'polyester', 'leather', 'denim', 'linen'];
    const validSeasons = ['spring', 'summer', 'autumn', 'winter', 'all'];
    const validFormalities = ['casual', 'smart-casual', 'business', 'formal', 'athletic'];
    const validConditions = ['new', 'good', 'fair', 'worn'];

    if (!validTypes.includes(item.type)) {
      this.error(`Invalid type: ${item.type}. Valid: ${validTypes.join(', ')}`);
      return null;
    }
    if (item.material && !validMaterials.includes(item.material)) {
      this.error(`Invalid material: ${item.material}. Valid: ${validMaterials.join(', ')}`);
      return null;
    }
    if (item.season && !validSeasons.includes(item.season)) {
      this.error(`Invalid season: ${item.season}. Valid: ${validSeasons.join(', ')}`);
      return null;
    }
    if (item.formality && !validFormalities.includes(item.formality)) {
      this.error(`Invalid formality: ${item.formality}. Valid: ${validFormalities.join(', ')}`);
      return null;
    }
    if (item.condition && !validConditions.includes(item.condition)) {
      this.error(`Invalid condition: ${item.condition}. Valid: ${validConditions.join(', ')}`);
      return null;
    }

    const clothingItem = {
      id: this._generateId(),
      name: item.name || `${item.color || 'Unknown'} ${item.type}`,
      type: item.type,
      color: item.color || 'black',
      brand: item.brand || 'Unknown',
      size: item.size || 'M',
      material: item.material || 'cotton',
      season: item.season || 'all',
      formality: item.formality || 'casual',
      purchaseDate: item.purchaseDate || new Date().toISOString(),
      cost: item.cost || 0,
      condition: item.condition || 'new',
      photoUrl: item.photoUrl || null,
      laundryStatus: 'clean',
      wearCount: 0,
      totalWearCount: 0,
      lastWorn: null,
      addedAt: new Date().toISOString(),
      needsIroning: false,
      profileId: item.profileId || null
    };

    this.inventory.push(clothingItem);
    this.log(`Added item: ${clothingItem.name} (${clothingItem.type}, ${clothingItem.color})`);
    this._persistData();
    return clothingItem;
  }

  /**
   * Remove clothing item from inventory
   */
  removeClothingItem(itemId) {
    const index = this.inventory.findIndex(i => i.id === itemId);
    if (index === -1) {
      this.error(`Item not found: ${itemId}`);
      return false;
    }
    const item = this.inventory.splice(index, 1)[0];
    this.log(`Removed item: ${item.name}`);
    this._persistData();
    return true;
  }

  /**
   * Update clothing item properties
   */
  updateClothingItem(itemId, updates) {
    const item = this.inventory.find(i => i.id === itemId);
    if (!item) {
      this.error(`Item not found: ${itemId}`);
      return null;
    }
    const protectedKeys = ['id', 'addedAt'];
    for (const [key, value] of Object.entries(updates)) {
      if (!protectedKeys.includes(key) && key in item) {
        item[key] = value;
      }
    }
    this._persistData();
    return item;
  }

  /**
   * Get inventory filtered by criteria
   */
  getInventory(filters = {}) {
    let items = [...this.inventory];
    if (filters.type) items = items.filter(i => i.type === filters.type);
    if (filters.color) items = items.filter(i => i.color === filters.color);
    if (filters.season) items = items.filter(i => i.season === filters.season || i.season === 'all');
    if (filters.formality) items = items.filter(i => i.formality === filters.formality);
    if (filters.laundryStatus) items = items.filter(i => i.laundryStatus === filters.laundryStatus);
    if (filters.material) items = items.filter(i => i.material === filters.material);
    if (filters.condition) items = items.filter(i => i.condition === filters.condition);
    if (filters.profileId) items = items.filter(i => i.profileId === filters.profileId);
    if (filters.brand) items = items.filter(i => i.brand === filters.brand);
    return items;
  }

  /**
   * Get item by ID
   */
  getItemById(itemId) {
    return this.inventory.find(i => i.id === itemId) || null;
  }

  // ─── AI OUTFIT RECOMMENDATIONS ───────────────────────────────────────

  /**
   * Generate AI outfit recommendation
   */
  async generateOutfitRecommendation(options = {}) {
    const profileId = options.profileId || null;
    const occasion = options.occasion || this._detectOccasion();
    const weather = options.weather || this.currentWeather;
    const date = options.date || new Date();

    const availableItems = this.inventory.filter(i =>
      i.laundryStatus === 'clean' &&
      (i.profileId === profileId || i.profileId === null) &&
      this._isSeasonAppropriate(i, date) &&
      i.condition !== 'worn'
    );

    if (availableItems.length === 0) {
      this.log('No clean, season-appropriate items available');
      return null;
    }

    const formalityNeeded = this._mapOccasionToFormality(occasion);
    const weatherLayer = this._getWeatherLayering(weather);
    const recentOutfits = this._getRecentOutfitItems();

    // Score each potential item
    const scoredItems = availableItems.map(item => {
      let score = 50; // base score

      // Formality match
      if (item.formality === formalityNeeded) score += 25;
      else if (this._formalityDistance(item.formality, formalityNeeded) === 1) score += 10;

      // Weather appropriateness
      score += this._weatherItemScore(item, weather);

      // Avoid recent repeats
      if (recentOutfits.includes(item.id)) score -= 30;

      // Condition bonus
      if (item.condition === 'new') score += 5;
      else if (item.condition === 'good') score += 3;

      // Profile preference bonus
      if (profileId) {
        const profile = this.styleProfiles.find(p => p.id === profileId);
        if (profile) {
          if (profile.preferredColors.includes(item.color)) score += 15;
          if (profile.avoidedColors.includes(item.color)) score -= 25;
          if (profile.preferredStyles.includes(item.formality)) score += 10;
          if (profile.brandPreferences.includes(item.brand)) score += 5;
        }
      }

      return { item, score };
    });

    // Build outfit by selecting best items per category
    const outfit = this._buildOutfit(scoredItems, weatherLayer, formalityNeeded);

    if (outfit.items.length > 0) {
      // Check color coordination
      outfit.colorScore = this._scoreColorCoordination(outfit.items);
      outfit.occasion = occasion;
      outfit.weather = weather;
      outfit.date = date.toISOString();
      outfit.formality = formalityNeeded;

      this.log(`Generated outfit recommendation: ${outfit.items.length} items, color score: ${outfit.colorScore}/100`);
    }

    return outfit;
  }

  /**
   * Build a complete outfit from scored items
   */
  _buildOutfit(scoredItems, weatherLayer, formality) {
    const outfit = { items: [], score: 0 };
    const needed = this._getOutfitSlots(weatherLayer);

    for (const slot of needed) {
      const candidates = scoredItems
        .filter(s => s.item.type === slot || (slot === 'top' && ['shirt', 'sweater'].includes(s.item.type)))
        .sort((a, b) => b.score - a.score);

      if (candidates.length > 0) {
        // Check color coordination with already-selected items
        let bestCandidate = candidates[0];
        for (const candidate of candidates) {
          if (outfit.items.length > 0) {
            const coordScore = this._pairColorScore(candidate.item.color, outfit.items[outfit.items.length - 1].color);
            if (coordScore > this._pairColorScore(bestCandidate.item.color, outfit.items[outfit.items.length - 1].color)) {
              bestCandidate = candidate;
            }
          }
        }
        outfit.items.push(bestCandidate.item);
        outfit.score += bestCandidate.score;
      }
    }

    if (outfit.items.length > 0) {
      outfit.score = Math.round(outfit.score / outfit.items.length);
    }

    return outfit;
  }

  /**
   * Determine outfit slots needed based on weather
   */
  _getOutfitSlots(weatherLayer) {
    const slots = ['shirt', 'pants', 'shoes'];
    if (weatherLayer === 'heavy') {
      slots.push('coat', 'sweater', 'accessory');
    } else if (weatherLayer === 'medium') {
      slots.push('jacket');
    } else if (weatherLayer === 'light') {
      slots.push('accessory');
    }
    return slots;
  }

  /**
   * Detect occasion from calendar events
   */
  _detectOccasion() {
    if (this.calendarEvents.length === 0) return 'casual';
    const todayEvents = this.calendarEvents.filter(e => {
      const eventDate = new Date(e.date);
      const today = new Date();
      return eventDate.toDateString() === today.toDateString();
    });
    if (todayEvents.length === 0) return 'casual';

    for (const event of todayEvents) {
      const title = (event.title || '').toLowerCase();
      if (title.includes('meeting') || title.includes('presentation') || title.includes('interview')) return 'business';
      if (title.includes('gym') || title.includes('workout') || title.includes('run')) return 'athletic';
      if (title.includes('date') || title.includes('dinner') || title.includes('party')) return 'smart-casual';
      if (title.includes('wedding') || title.includes('gala') || title.includes('ceremony')) return 'formal';
    }
    return 'casual';
  }

  /**
   * Map occasion to formality level
   */
  _mapOccasionToFormality(occasion) {
    const map = {
      casual: 'casual',
      business: 'business',
      athletic: 'athletic',
      'smart-casual': 'smart-casual',
      formal: 'formal',
      date: 'smart-casual',
      party: 'smart-casual',
      wedding: 'formal'
    };
    return map[occasion] || 'casual';
  }

  /**
   * Calculate formality distance between two levels
   */
  _formalityDistance(a, b) {
    const levels = ['athletic', 'casual', 'smart-casual', 'business', 'formal'];
    const idxA = levels.indexOf(a);
    const idxB = levels.indexOf(b);
    if (idxA === -1 || idxB === -1) return 3;
    return Math.abs(idxA - idxB);
  }

  // ─── WEATHER-BASED SUGGESTIONS ───────────────────────────────────────

  /**
   * Get weather-based clothing suggestions
   */
  getWeatherSuggestions(weather = null) {
    const w = weather || this.currentWeather;
    const suggestions = { layers: [], accessories: [], reminders: [] };

    // Temperature-based layers
    if (w.temperature < 5) {
      suggestions.layers.push('Heavy coat', 'Warm sweater or fleece', 'Thermal undershirt', 'Warm boots', 'Thick socks');
      suggestions.reminders.push('Bundle up! Freezing temperatures expected.');
    } else if (w.temperature >= 5 && w.temperature < 15) {
      suggestions.layers.push('Medium jacket or blazer', 'Sweater or cardigan', 'Long pants');
      suggestions.reminders.push('Cool weather - layer up for comfort.');
    } else if (w.temperature >= 15 && w.temperature < 22) {
      suggestions.layers.push('Light jacket or cardigan', 'Long or short sleeves', 'Light pants or chinos');
      suggestions.reminders.push('Mild weather - light layers recommended.');
    } else if (w.temperature >= 22 && w.temperature < 30) {
      suggestions.layers.push('Light shirt or t-shirt', 'Shorts or light pants', 'Breathable shoes');
      suggestions.accessories.push('Hat or cap for sun protection');
      suggestions.reminders.push('Warm weather - stay cool and hydrated.');
    } else if (w.temperature >= 30) {
      suggestions.layers.push('Minimal lightweight clothing', 'Loose-fitting breathable fabrics', 'Sandals or open shoes');
      suggestions.accessories.push('Wide-brim hat', 'Sunglasses');
      suggestions.reminders.push('Hot weather! Apply sunscreen and stay hydrated.', 'Sunscreen reminder: reapply every 2 hours.');
    }

    // Rain-based suggestions
    if (w.rainProbability > 50) {
      suggestions.layers.push('Waterproof jacket or raincoat');
      suggestions.accessories.push('Umbrella');
      suggestions.reminders.push('High chance of rain - bring waterproof layer and umbrella.');
    } else if (w.rainProbability > 25) {
      suggestions.reminders.push('Possible rain - consider bringing an umbrella.');
    }

    // Wind-based suggestions
    if (w.windSpeed > 40) {
      suggestions.reminders.push('High winds expected - secure loose clothing and accessories.');
      suggestions.layers.push('Windbreaker');
    } else if (w.windSpeed > 25) {
      suggestions.reminders.push('Breezy conditions - a light windbreaker may help.');
    }

    return suggestions;
  }

  /**
   * Get weather layering level
   */
  _getWeatherLayering(weather) {
    if (weather.temperature < 5) return 'heavy';
    if (weather.temperature < 15) return 'medium';
    if (weather.temperature < 22) return 'light';
    return 'minimal';
  }

  /**
   * Score item weather appropriateness
   */
  _weatherItemScore(item, weather) {
    let score = 0;
    const temp = weather.temperature;

    if (temp < 5) {
      if (['coat', 'sweater', 'jacket'].includes(item.type)) score += 15;
      if (item.material === 'wool') score += 10;
      if (item.type === 'shorts') score -= 20;
    } else if (temp >= 5 && temp < 15) {
      if (['jacket', 'sweater'].includes(item.type)) score += 10;
      if (item.type === 'coat') score += 5;
    } else if (temp >= 22 && temp < 30) {
      if (['shorts', 'dress', 'skirt'].includes(item.type)) score += 10;
      if (item.material === 'linen' || item.material === 'cotton') score += 8;
      if (item.material === 'wool') score -= 15;
      if (item.type === 'coat') score -= 20;
    } else if (temp >= 30) {
      if (['shorts', 'dress', 'skirt'].includes(item.type)) score += 15;
      if (item.material === 'linen') score += 12;
      if (item.material === 'wool' || item.material === 'leather') score -= 25;
      if (['coat', 'sweater', 'jacket'].includes(item.type)) score -= 20;
    }

    if (weather.rainProbability > 50) {
      if (item.material === 'leather' || item.material === 'polyester') score += 5;
      if (item.material === 'silk' || item.material === 'linen') score -= 5;
    }

    return score;
  }

  // ─── LAUNDRY TRACKING ────────────────────────────────────────────────

  /**
   * Record wearing an item
   */
  wearItem(itemId) {
    const item = this.inventory.find(i => i.id === itemId);
    if (!item) {
      this.error(`Item not found: ${itemId}`);
      return null;
    }

    if (item.laundryStatus === 'dirty' || item.laundryStatus === 'washing') {
      this.log(`Cannot wear item ${item.name}: currently ${item.laundryStatus}`);
      return null;
    }

    item.wearCount += 1;
    item.totalWearCount += 1;
    item.lastWorn = new Date().toISOString();
    item.laundryStatus = 'worn';

    // Check if item should be marked dirty based on wear thresholds
    const threshold = this.wearThresholds[item.type] || 3;
    if (item.wearCount >= threshold) {
      item.laundryStatus = 'dirty';
      this.log(`${item.name} marked as dirty after ${item.wearCount} wear(s)`);
    }

    // Check if item needs ironing (wrinkle-prone materials)
    if (['linen', 'cotton', 'silk'].includes(item.material)) {
      item.needsIroning = true;
    }

    this._persistData();
    return item;
  }

  /**
   * Start washing items (put in laundry)
   */
  startWashing(itemIds) {
    const results = [];
    for (const id of itemIds) {
      const item = this.inventory.find(i => i.id === id);
      if (item && (item.laundryStatus === 'dirty' || item.laundryStatus === 'worn')) {
        item.laundryStatus = 'washing';
        item.washStarted = new Date().toISOString();
        results.push({ id: item.id, name: item.name, status: 'washing' });
      }
    }
    this.log(`Started washing ${results.length} items`);
    this._persistData();
    return results;
  }

  /**
   * Mark items as clean (finished washing)
   */
  finishWashing(itemIds) {
    const results = [];
    for (const id of itemIds) {
      const item = this.inventory.find(i => i.id === id);
      if (item && item.laundryStatus === 'washing') {
        item.laundryStatus = 'clean';
        item.wearCount = 0;
        item.washStarted = null;

        // Check if needs ironing after wash
        if (['linen', 'cotton', 'silk', 'denim'].includes(item.material)) {
          item.needsIroning = true;
          if (!this.ironingQueue.find(q => q.id === item.id)) {
            this.ironingQueue.push({ id: item.id, name: item.name, material: item.material });
          }
        }

        results.push({ id: item.id, name: item.name, status: 'clean', needsIroning: item.needsIroning });
      }
    }
    this.log(`Finished washing ${results.length} items`);
    this._persistData();
    return results;
  }

  /**
   * Get optimized laundry loads sorted by color and material
   */
  getLaundryLoads() {
    const dirtyItems = this.inventory.filter(i => i.laundryStatus === 'dirty' || i.laundryStatus === 'worn');

    if (dirtyItems.length === 0) return [];

    // Sort by color groups
    const colorGroups = { whites: [], lights: [], darks: [], colors: [] };
    const whiteColors = ['white', 'cream', 'ivory'];
    const lightColors = ['beige', 'light-blue', 'light-pink', 'light-grey', 'yellow', 'light-green', 'pastel'];
    const darkColors = ['black', 'navy', 'charcoal', 'dark-grey', 'dark-blue', 'dark-green', 'dark-brown'];

    for (const item of dirtyItems) {
      const color = (item.color || '').toLowerCase();
      if (whiteColors.includes(color)) colorGroups.whites.push(item);
      else if (lightColors.includes(color)) colorGroups.lights.push(item);
      else if (darkColors.includes(color)) colorGroups.darks.push(item);
      else colorGroups.colors.push(item);
    }

    // Build loads with material-specific temperature considerations
    const loads = [];
    for (const [group, items] of Object.entries(colorGroups)) {
      if (items.length === 0) continue;

      // Sub-sort by wash temperature
      const delicates = items.filter(i => ['silk', 'wool'].includes(i.material));
      const normals = items.filter(i => !['silk', 'wool', 'leather'].includes(i.material));
      const dryCleanOnly = items.filter(i => i.material === 'leather');

      if (normals.length > 0) {
        const temps = normals.map(i => (this.washCareInstructions[i.material] || { temp: 40 }).temp).filter(t => t !== null);
        const maxTemp = temps.length > 0 ? Math.max(...temps) : 40;
        loads.push({
          name: `${group} - normal wash`,
          items: normals.map(i => ({ id: i.id, name: i.name, material: i.material })),
          temperature: maxTemp,
          cycle: 'normal',
          count: normals.length
        });
      }

      if (delicates.length > 0) {
        loads.push({
          name: `${group} - delicate wash`,
          items: delicates.map(i => ({ id: i.id, name: i.name, material: i.material })),
          temperature: 30,
          cycle: 'delicate',
          count: delicates.length
        });
      }

      if (dryCleanOnly.length > 0) {
        loads.push({
          name: `${group} - dry clean only`,
          items: dryCleanOnly.map(i => ({ id: i.id, name: i.name, material: i.material })),
          temperature: null,
          cycle: 'dry-clean',
          count: dryCleanOnly.length
        });
      }
    }

    return loads;
  }

  /**
   * Get wash care instructions for an item
   */
  getWashCare(itemId) {
    const item = this.inventory.find(i => i.id === itemId);
    if (!item) return null;
    return {
      item: item.name,
      material: item.material,
      care: this.washCareInstructions[item.material] || { notes: 'Check garment label for care instructions' }
    };
  }

  /**
   * Get all items currently in a given laundry state
   */
  getItemsByLaundryStatus(status) {
    const validStatuses = ['clean', 'worn', 'dirty', 'washing'];
    if (!validStatuses.includes(status)) {
      this.error(`Invalid laundry status: ${status}. Valid: ${validStatuses.join(', ')}`);
      return [];
    }
    return this.inventory.filter(i => i.laundryStatus === status);
  }

  // ─── SEASONAL ROTATION ───────────────────────────────────────────────

  /**
   * Check and suggest seasonal rotation
   */
  _checkSeasonalRotation() {
    const now = new Date();
    const month = now.getMonth() + 1;
    let currentSeason = 'spring';

    for (const [season, months] of Object.entries(this.seasonalMonths)) {
      if (months.includes(month)) {
        currentSeason = season;
        break;
      }
    }

    const rotationSuggestions = {
      currentSeason,
      bringOut: [],
      storeAway: [],
      storageTips: [],
      mothProtection: []
    };

    // Items to bring out for current season
    const inSeason = this.inventory.filter(i => i.season === currentSeason || i.season === 'all');
    const offSeason = this.inventory.filter(i => i.season !== currentSeason && i.season !== 'all');

    rotationSuggestions.bringOut = inSeason.map(i => ({ id: i.id, name: i.name, type: i.type }));
    rotationSuggestions.storeAway = offSeason.map(i => ({ id: i.id, name: i.name, type: i.type, season: i.season }));

    // Storage tips for off-season items
    rotationSuggestions.storageTips = [
      'Clean all items before storing to prevent stains setting',
      'Use breathable garment bags, not plastic',
      'Store in a cool, dry place away from direct sunlight',
      'Fold heavy knits to prevent stretching on hangers',
      'Use acid-free tissue paper for delicate items'
    ];

    // Moth protection for wool/cashmere items
    const woolItems = offSeason.filter(i => i.material === 'wool');
    if (woolItems.length > 0) {
      rotationSuggestions.mothProtection = [
        `${woolItems.length} wool item(s) need moth protection`,
        'Use cedar blocks or lavender sachets in storage',
        'Consider moth-proof garment bags for valuable items',
        'Replace cedar blocks every 6 months for effectiveness'
      ];
    }

    return rotationSuggestions;
  }

  /**
   * Get seasonal rotation suggestions (public API)
   */
  getSeasonalRotation() {
    return this._checkSeasonalRotation();
  }

  /**
   * Check if item is season-appropriate for a given date
   */
  _isSeasonAppropriate(item, date = new Date()) {
    if (item.season === 'all') return true;
    const month = date.getMonth() + 1;
    const seasonMonths = this.seasonalMonths[item.season] || [];
    return seasonMonths.includes(month);
  }

  /**
   * Get the current season based on date
   */
  getCurrentSeason(date = new Date()) {
    const month = date.getMonth() + 1;
    for (const [season, months] of Object.entries(this.seasonalMonths)) {
      if (months.includes(month)) return season;
    }
    return 'spring';
  }

  // ─── OUTFIT HISTORY ──────────────────────────────────────────────────

  /**
   * Record an outfit worn
   */
  recordOutfit(itemIds, rating = null) {
    const items = itemIds.map(id => this.inventory.find(i => i.id === id)).filter(Boolean);
    if (items.length === 0) return null;

    const outfitEntry = {
      id: this._generateId(),
      date: new Date().toISOString(),
      items: items.map(i => ({ id: i.id, name: i.name, type: i.type, color: i.color })),
      rating: rating ? Math.min(5, Math.max(1, rating)) : null,
      weather: { ...this.currentWeather },
      isFavorite: false
    };

    this.outfitHistory.unshift(outfitEntry);
    if (this.outfitHistory.length > this.maxOutfitHistory) {
      this.outfitHistory = this.outfitHistory.slice(0, this.maxOutfitHistory);
    }

    // Record wear for each item
    for (const id of itemIds) {
      this.wearItem(id);
    }

    this.log(`Recorded outfit: ${items.length} items`);
    this._persistData();
    return outfitEntry;
  }

  /**
   * Toggle favorite status for an outfit
   */
  toggleFavoriteOutfit(outfitId) {
    const outfit = this.outfitHistory.find(o => o.id === outfitId);
    if (!outfit) return null;
    outfit.isFavorite = !outfit.isFavorite;
    this._persistData();
    return outfit;
  }

  /**
   * Rate an outfit (1-5 stars)
   */
  rateOutfit(outfitId, rating) {
    const outfit = this.outfitHistory.find(o => o.id === outfitId);
    if (!outfit) return null;
    outfit.rating = Math.min(5, Math.max(1, rating));
    this._persistData();
    return outfit;
  }

  /**
   * Get favorite outfits
   */
  getFavoriteOutfits() {
    return this.outfitHistory.filter(o => o.isFavorite);
  }

  /**
   * Get outfit history
   */
  getOutfitHistory(limit = null) {
    if (limit) return this.outfitHistory.slice(0, limit);
    return this.outfitHistory;
  }

  /**
   * Get most-worn combinations
   */
  getMostWornCombinations() {
    const combos = {};
    for (const outfit of this.outfitHistory) {
      const key = outfit.items.map(i => i.id).sort().join('|');
      if (!combos[key]) {
        combos[key] = { items: outfit.items, count: 0, totalRating: 0, ratingCount: 0 };
      }
      combos[key].count += 1;
      if (outfit.rating) {
        combos[key].totalRating += outfit.rating;
        combos[key].ratingCount += 1;
      }
    }

    return Object.values(combos)
      .map(c => ({
        ...c,
        avgRating: c.ratingCount > 0 ? Math.round((c.totalRating / c.ratingCount) * 10) / 10 : null
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * Get recently worn item IDs to prevent outfit repeats
   */
  _getRecentOutfitItems() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.repeatPreventionDays);
    const recentItemIds = [];
    for (const outfit of this.outfitHistory) {
      if (new Date(outfit.date) >= cutoff) {
        for (const item of outfit.items) {
          if (!recentItemIds.includes(item.id)) {
            recentItemIds.push(item.id);
          }
        }
      }
    }
    return recentItemIds;
  }

  // ─── STYLE PROFILES ──────────────────────────────────────────────────

  /**
   * Create a style profile for a household member
   */
  createStyleProfile(profileData) {
    if (this.styleProfiles.length >= this.maxProfiles) {
      this.error(`Maximum profiles reached (${this.maxProfiles})`);
      return null;
    }

    const profile = {
      id: this._generateId(),
      name: profileData.name || 'Member',
      preferredColors: profileData.preferredColors || [],
      avoidedColors: profileData.avoidedColors || [],
      preferredStyles: profileData.preferredStyles || ['casual'],
      bodyType: profileData.bodyType || null,
      brandPreferences: profileData.brandPreferences || [],
      budgetTier: profileData.budgetTier || 'mid', // 'budget', 'mid', 'premium', 'luxury'
      colorSeason: profileData.colorSeason || null, // spring/summer/autumn/winter
      createdAt: new Date().toISOString()
    };

    this.styleProfiles.push(profile);
    this.log(`Created style profile: ${profile.name}`);
    this._persistData();
    return profile;
  }

  /**
   * Update a style profile
   */
  updateStyleProfile(profileId, updates) {
    const profile = this.styleProfiles.find(p => p.id === profileId);
    if (!profile) return null;
    const protectedKeys = ['id', 'createdAt'];
    for (const [key, value] of Object.entries(updates)) {
      if (!protectedKeys.includes(key) && key in profile) {
        profile[key] = value;
      }
    }
    this._persistData();
    return profile;
  }

  /**
   * Remove a style profile
   */
  removeStyleProfile(profileId) {
    const index = this.styleProfiles.findIndex(p => p.id === profileId);
    if (index === -1) return false;
    this.styleProfiles.splice(index, 1);
    this._persistData();
    return true;
  }

  /**
   * Get a style profile by ID
   */
  getStyleProfile(profileId) {
    return this.styleProfiles.find(p => p.id === profileId) || null;
  }

  /**
   * Get all style profiles
   */
  getAllStyleProfiles() {
    return this.styleProfiles;
  }

  // ─── CAPSULE WARDROBE ────────────────────────────────────────────────

  /**
   * Analyze wardrobe for capsule wardrobe potential
   */
  analyzeCapsuleWardrobe(profileId = null) {
    const items = profileId
      ? this.inventory.filter(i => i.profileId === profileId)
      : this.inventory;

    const analysis = {
      totalItems: items.length,
      capsuleTarget: this.capsuleTarget,
      overTarget: items.length > this.capsuleTarget,
      coreItems: [],
      gapAnalysis: [],
      versatilityScores: [],
      costPerWear: [],
      suggestion: ''
    };

    // Identify core pieces (high versatility, neutral colors, good condition)
    analysis.coreItems = items
      .filter(i => this.neutralColors.includes(i.color) && ['new', 'good'].includes(i.condition))
      .map(i => ({ id: i.id, name: i.name, type: i.type, color: i.color }));

    // Gap analysis - check against essential capsule items
    for (const essential of this.capsuleEssentials) {
      const matches = items.filter(i =>
        i.type === essential.type &&
        (i.color === essential.color || !essential.color) &&
        (i.formality === essential.formality || !essential.formality)
      );
      if (matches.length < (essential.count || 1)) {
        analysis.gapAnalysis.push({
          type: essential.type,
          color: essential.color,
          formality: essential.formality,
          needed: (essential.count || 1) - matches.length,
          description: `Need ${(essential.count || 1) - matches.length} more ${essential.color || ''} ${essential.formality || ''} ${essential.type}(s)`
        });
      }
    }

    // Versatility scoring per item (how many outfits each enables)
    analysis.versatilityScores = items.map(item => {
      let versatility = 0;

      // Neutral colors are more versatile
      if (this.neutralColors.includes(item.color)) versatility += 3;

      // Items that work in multiple formalities
      if (['casual', 'smart-casual'].includes(item.formality)) versatility += 2;

      // All-season items are more versatile
      if (item.season === 'all') versatility += 3;

      // Base items (shirt, pants) are more versatile than accessories
      if (['shirt', 'pants'].includes(item.type)) versatility += 2;
      if (item.type === 'accessory') versatility += 1;

      // Durable materials are more versatile
      if (['denim', 'cotton', 'wool'].includes(item.material)) versatility += 1;

      return {
        id: item.id,
        name: item.name,
        versatilityScore: versatility,
        maxScore: 12
      };
    }).sort((a, b) => b.versatilityScore - a.versatilityScore);

    // Cost per wear calculation
    analysis.costPerWear = items
      .filter(i => i.cost > 0 && i.totalWearCount > 0)
      .map(i => ({
        id: i.id,
        name: i.name,
        cost: i.cost,
        totalWears: i.totalWearCount,
        costPerWear: Math.round((i.cost / i.totalWearCount) * 100) / 100
      }))
      .sort((a, b) => a.costPerWear - b.costPerWear);

    // Overall suggestion
    if (analysis.overTarget) {
      analysis.suggestion = `Your wardrobe has ${items.length} items, ${items.length - this.capsuleTarget} over the capsule target of ${this.capsuleTarget}. Consider donating rarely-worn items.`;
    } else {
      analysis.suggestion = `Your wardrobe has ${items.length} items, within the capsule target of ${this.capsuleTarget}. Focus on filling gaps in essentials.`;
    }

    if (analysis.gapAnalysis.length > 0) {
      analysis.suggestion += ` You have ${analysis.gapAnalysis.length} gap(s) in essential items.`;
    }

    return analysis;
  }

  // ─── SHOPPING SUGGESTIONS ────────────────────────────────────────────

  /**
   * Generate shopping suggestions based on wardrobe gaps and needs
   */
  getShoppingSuggestions(profileId = null) {
    const items = profileId
      ? this.inventory.filter(i => i.profileId === profileId)
      : this.inventory;

    const suggestions = {
      gapItems: [],
      replacements: [],
      seasonalNeeds: [],
      budgetStatus: { ...this.shoppingBudget },
      wishlistItems: this.wishlist
    };

    // Gap analysis from capsule wardrobe
    const capsule = this.analyzeCapsuleWardrobe(profileId);
    suggestions.gapItems = capsule.gapAnalysis.map(g => ({
      ...g,
      priority: 'high',
      estimatedCost: this._estimateItemCost(g.type, g.formality)
    }));

    // Worn-out items needing replacement
    suggestions.replacements = items
      .filter(i => i.condition === 'worn')
      .map(i => ({
        replacing: i.name,
        type: i.type,
        color: i.color,
        material: i.material,
        priority: 'medium',
        estimatedCost: this._estimateItemCost(i.type, i.formality)
      }));

    // Upcoming seasonal needs
    const now = new Date();
    const nextMonth = now.getMonth() + 2;
    let upcomingSeason = 'spring';
    for (const [season, months] of Object.entries(this.seasonalMonths)) {
      if (months.includes(nextMonth > 12 ? nextMonth - 12 : nextMonth)) {
        upcomingSeason = season;
        break;
      }
    }

    const seasonalItems = items.filter(i => i.season === upcomingSeason);
    if (seasonalItems.length < 5) {
      suggestions.seasonalNeeds.push({
        season: upcomingSeason,
        currentCount: seasonalItems.length,
        message: `Only ${seasonalItems.length} items for upcoming ${upcomingSeason} season. Consider adding more.`,
        priority: 'low'
      });
    }

    return suggestions;
  }

  /**
   * Add item to wishlist with price tracking
   */
  addToWishlist(item) {
    const wishlistItem = {
      id: this._generateId(),
      name: item.name || 'Unknown item',
      type: item.type || 'shirt',
      estimatedPrice: item.estimatedPrice || 0,
      url: item.url || null,
      priority: item.priority || 'medium',
      addedAt: new Date().toISOString()
    };
    this.wishlist.push(wishlistItem);
    this._persistData();
    return wishlistItem;
  }

  /**
   * Remove item from wishlist
   */
  removeFromWishlist(itemId) {
    const index = this.wishlist.findIndex(i => i.id === itemId);
    if (index === -1) return false;
    this.wishlist.splice(index, 1);
    this._persistData();
    return true;
  }

  /**
   * Update shopping budget
   */
  updateBudget(budgetUpdate) {
    if (budgetUpdate.monthly !== undefined) this.shoppingBudget.monthly = budgetUpdate.monthly;
    if (budgetUpdate.annual !== undefined) this.shoppingBudget.annual = budgetUpdate.annual;
    if (budgetUpdate.spentMonthly !== undefined) this.shoppingBudget.spentMonthly = budgetUpdate.spentMonthly;
    if (budgetUpdate.spentAnnual !== undefined) this.shoppingBudget.spentAnnual = budgetUpdate.spentAnnual;
    this._persistData();
    return this.shoppingBudget;
  }

  /**
   * Record a clothing purchase against budget
   */
  recordPurchase(amount) {
    this.shoppingBudget.spentMonthly += amount;
    this.shoppingBudget.spentAnnual += amount;
    this._persistData();
    const remaining = this.shoppingBudget.monthly - this.shoppingBudget.spentMonthly;
    this.log(`Purchase recorded: $${amount}. Monthly remaining: $${remaining}`);
    return {
      budget: this.shoppingBudget,
      monthlyRemaining: remaining,
      annualRemaining: this.shoppingBudget.annual - this.shoppingBudget.spentAnnual
    };
  }

  /**
   * Estimate item cost by type and formality
   */
  _estimateItemCost(type, formality) {
    const baseCosts = {
      shirt: 30, pants: 50, jacket: 80, shoes: 70, accessory: 20,
      underwear: 10, dress: 60, skirt: 40, suit: 200, coat: 150,
      sweater: 45, shorts: 30
    };
    const formalityMultipliers = {
      casual: 1, 'smart-casual': 1.3, business: 1.6, formal: 2.2, athletic: 1.1
    };
    const base = baseCosts[type] || 50;
    const mult = formalityMultipliers[formality] || 1;
    return Math.round(base * mult);
  }

  // ─── PACKING ASSISTANT ───────────────────────────────────────────────

  /**
   * Generate a packing list for a trip
   */
  generatePackingList(tripDetails) {
    const {
      destination = 'Unknown',
      duration = 3,
      activities = ['casual'],
      dressCode = 'casual',
      weather: destWeather = { temperature: 20, rainProbability: 20 }
    } = tripDetails;

    const packingList = {
      id: this._generateId(),
      destination,
      duration,
      activities,
      dressCode,
      weather: destWeather,
      items: [],
      checklist: [],
      createdAt: new Date().toISOString()
    };

    // Calculate needed quantities with mix-and-match optimization
    const tops = Math.min(Math.ceil(duration * 0.8), 7);
    const bottoms = Math.min(Math.ceil(duration * 0.5), 4);
    const underwearCount = duration + 1;
    const shoePairs = Math.min(Math.ceil(activities.length * 0.7), 3);

    // Select items from clean inventory
    const cleanItems = this.inventory.filter(i => i.laundryStatus === 'clean' && i.condition !== 'worn');

    // Select tops
    const topTypes = ['shirt', 'sweater'];
    const selectedTops = this._selectPackingItems(cleanItems, topTypes, tops, destWeather, dressCode);
    packingList.items.push(...selectedTops.map(i => ({ ...this._itemSummary(i), category: 'tops', packed: false })));

    // Select bottoms
    const bottomTypes = ['pants', 'shorts', 'skirt'];
    const selectedBottoms = this._selectPackingItems(cleanItems, bottomTypes, bottoms, destWeather, dressCode);
    packingList.items.push(...selectedBottoms.map(i => ({ ...this._itemSummary(i), category: 'bottoms', packed: false })));

    // Select underwear
    const selectedUnderwear = this._selectPackingItems(cleanItems, ['underwear'], underwearCount, destWeather, dressCode);
    packingList.items.push(...selectedUnderwear.map(i => ({ ...this._itemSummary(i), category: 'underwear', packed: false })));

    // Select shoes
    const selectedShoes = this._selectPackingItems(cleanItems, ['shoes'], shoePairs, destWeather, dressCode);
    packingList.items.push(...selectedShoes.map(i => ({ ...this._itemSummary(i), category: 'shoes', packed: false })));

    // Outerwear if needed for cold or rainy destinations
    if (destWeather.temperature < 15 || destWeather.rainProbability > 40) {
      const outerTypes = ['jacket', 'coat'];
      const selectedOuter = this._selectPackingItems(cleanItems, outerTypes, 1, destWeather, dressCode);
      packingList.items.push(...selectedOuter.map(i => ({ ...this._itemSummary(i), category: 'outerwear', packed: false })));
    }

    // Accessories based on weather and activities
    const accessories = [];
    if (destWeather.rainProbability > 30) accessories.push({ name: 'Umbrella', category: 'accessories', packed: false, fromInventory: false });
    if (destWeather.temperature > 25) accessories.push({ name: 'Sunhat', category: 'accessories', packed: false, fromInventory: false });
    if (destWeather.temperature > 22) accessories.push({ name: 'Sunglasses', category: 'accessories', packed: false, fromInventory: false });
    if (activities.includes('formal') || activities.includes('business')) {
      const selectedAccessories = this._selectPackingItems(cleanItems, ['accessory'], 2, destWeather, dressCode);
      accessories.push(...selectedAccessories.map(i => ({ ...this._itemSummary(i), category: 'accessories', packed: false })));
    }
    if (activities.includes('athletic')) {
      const athleticItems = this._selectPackingItems(cleanItems, ['shirt', 'shorts', 'shoes'], 2, destWeather, 'athletic');
      accessories.push(...athleticItems.map(i => ({ ...this._itemSummary(i), category: 'athletic', packed: false })));
    }
    packingList.items.push(...accessories);

    // Build checklist with confirmation tracking
    packingList.checklist = packingList.items.map((item, idx) => ({
      index: idx,
      item: item.name,
      category: item.category,
      confirmed: false
    }));

    this.packingLists.push(packingList);
    this._persistData();

    this.log(`Generated packing list for ${destination}: ${packingList.items.length} items for ${duration} days`);
    return packingList;
  }

  /**
   * Select optimal items for packing based on weather and dress code
   */
  _selectPackingItems(availableItems, types, count, weather, dressCode) {
    const candidates = availableItems
      .filter(i => types.includes(i.type))
      .map(i => ({
        item: i,
        score: this._weatherItemScore(i, weather) + (i.formality === dressCode ? 10 : 0) + (this.neutralColors.includes(i.color) ? 5 : 0)
      }))
      .sort((a, b) => b.score - a.score);

    return candidates.slice(0, count).map(c => c.item);
  }

  /**
   * Confirm a packing checklist item
   */
  confirmPackingItem(packingListId, itemIndex) {
    const list = this.packingLists.find(l => l.id === packingListId);
    if (!list || itemIndex < 0 || itemIndex >= list.checklist.length) return false;
    list.checklist[itemIndex].confirmed = true;
    if (list.items[itemIndex]) list.items[itemIndex].packed = true;
    this._persistData();
    return true;
  }

  /**
   * Get packing progress for a list
   */
  getPackingProgress(packingListId) {
    const list = this.packingLists.find(l => l.id === packingListId);
    if (!list) return null;
    const confirmed = list.checklist.filter(c => c.confirmed).length;
    const total = list.checklist.length;
    return {
      id: list.id,
      destination: list.destination,
      totalItems: total,
      packedItems: confirmed,
      remainingItems: total - confirmed,
      percentComplete: total > 0 ? Math.round((confirmed / total) * 100) : 0,
      unpacked: list.checklist.filter(c => !c.confirmed)
    };
  }

  /**
   * Get all packing lists
   */
  getPackingLists() {
    return this.packingLists;
  }

  // ─── COLOR ANALYSIS ──────────────────────────────────────────────────

  /**
   * Get color analysis for a profile
   */
  getColorAnalysis(profileId) {
    const profile = this.styleProfiles.find(p => p.id === profileId);
    if (!profile || !profile.colorSeason) {
      return { error: 'Profile not found or color season not set' };
    }

    const seasonData = this.colorSeasons[profile.colorSeason] || {};

    return {
      profile: profile.name,
      colorSeason: profile.colorSeason,
      bestColors: seasonData.best || [],
      avoidColors: seasonData.avoid || [],
      wardrobeColors: this._analyzeWardrobeColors(profile.id),
      recommendations: this._getColorRecommendations(profile)
    };
  }

  /**
   * Analyze wardrobe color distribution
   */
  _analyzeWardrobeColors(profileId) {
    const items = this.inventory.filter(i => i.profileId === profileId || !profileId);
    if (items.length === 0) return [];
    const colorCounts = {};
    for (const item of items) {
      colorCounts[item.color] = (colorCounts[item.color] || 0) + 1;
    }
    return Object.entries(colorCounts)
      .map(([color, count]) => ({ color, count, percentage: Math.round((count / items.length) * 100) }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get color coordination recommendations based on profile
   */
  _getColorRecommendations(profile) {
    const recommendations = [];
    const items = this.inventory.filter(i => i.profileId === profile.id);
    const colors = [...new Set(items.map(i => i.color))];

    for (const color of colors) {
      const wheelEntry = this.colorWheel[color];
      if (wheelEntry) {
        const hasComplement = colors.includes(wheelEntry.complementary);
        if (!hasComplement) {
          recommendations.push(`Consider adding ${wheelEntry.complementary} items to complement your ${color} pieces`);
        }
      }
    }

    // Check for color season alignment
    if (profile.colorSeason) {
      const seasonData = this.colorSeasons[profile.colorSeason];
      if (seasonData) {
        const avoidInWardrobe = colors.filter(c => seasonData.avoid.includes(c));
        if (avoidInWardrobe.length > 0) {
          recommendations.push(`Based on your ${profile.colorSeason} color season, consider phasing out: ${avoidInWardrobe.join(', ')}`);
        }
      }
    }

    return recommendations;
  }

  /**
   * Score color coordination between outfit items
   */
  _scoreColorCoordination(items) {
    if (items.length < 2) return 100;
    let totalScore = 0;
    let pairs = 0;

    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        totalScore += this._pairColorScore(items[i].color, items[j].color);
        pairs++;
      }
    }

    return pairs > 0 ? Math.round(totalScore / pairs) : 50;
  }

  /**
   * Score color pair compatibility (complementary, analogous, monochromatic)
   */
  _pairColorScore(color1, color2) {
    if (color1 === color2) return 70; // monochromatic
    if (this.neutralColors.includes(color1) || this.neutralColors.includes(color2)) return 85; // neutrals match everything
    const entry = this.colorWheel[color1];
    if (!entry) return 50;
    if (entry.complementary === color2) return 90;
    if (entry.analogous && entry.analogous.includes(color2)) return 80;
    if (entry.triadic && entry.triadic.includes(color2)) return 75;
    return 50;
  }

  // ─── CLOSET ORGANIZATION ─────────────────────────────────────────────

  /**
   * Get closet organization suggestions with physical layout
   */
  getClosetOrganization() {
    const organization = {
      layout: [],
      environment: { ...this.closetEnvironment },
      alerts: [],
      lightingSuggestion: null
    };

    // Organize by type, then color, then season
    const typeGroups = {};
    for (const item of this.inventory) {
      if (!typeGroups[item.type]) typeGroups[item.type] = [];
      typeGroups[item.type].push(item);
    }

    for (const [type, items] of Object.entries(typeGroups)) {
      const sorted = items.sort((a, b) => {
        if (a.color < b.color) return -1;
        if (a.color > b.color) return 1;
        if (a.season < b.season) return -1;
        if (a.season > b.season) return 1;
        return 0;
      });

      organization.layout.push({
        section: type,
        items: sorted.map(i => ({ id: i.id, name: i.name, color: i.color, season: i.season })),
        count: sorted.length
      });
    }

    // Environment alerts based on humidity monitoring (45-55% ideal)
    if (this.closetEnvironment.humidity < this.closetEnvironment.idealHumidityMin) {
      organization.alerts.push({
        type: 'humidity_low',
        message: `Closet humidity (${this.closetEnvironment.humidity}%) is below ideal range (${this.closetEnvironment.idealHumidityMin}-${this.closetEnvironment.idealHumidityMax}%). Add a humidifier.`,
        severity: 'warning'
      });
    } else if (this.closetEnvironment.humidity > this.closetEnvironment.idealHumidityMax) {
      organization.alerts.push({
        type: 'humidity_high',
        message: `Closet humidity (${this.closetEnvironment.humidity}%) is above ideal range. Risk of mold. Add a dehumidifier or improve ventilation.`,
        severity: 'critical'
      });
    }

    // Cedar block / moth prevention reminders
    if (this.closetEnvironment.cedarBlockAge > 180) {
      organization.alerts.push({
        type: 'cedar_replacement',
        message: 'Cedar blocks are over 6 months old. Replace or sand them to refresh the scent and moth repellent.',
        severity: 'info'
      });
    }

    // Moth check reminder
    if (this.closetEnvironment.lastMothCheck) {
      const daysSinceCheck = Math.floor((Date.now() - new Date(this.closetEnvironment.lastMothCheck).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceCheck > 30) {
        organization.alerts.push({
          type: 'moth_check',
          message: `It has been ${daysSinceCheck} days since last moth check. Inspect wool and cashmere items.`,
          severity: 'warning'
        });
      }
    } else {
      organization.alerts.push({
        type: 'moth_check',
        message: 'No moth check recorded. Inspect wool and cashmere items for damage.',
        severity: 'warning'
      });
    }

    // Smart lighting suggestion (auto-on, highlight outfit area)
    organization.lightingSuggestion = {
      autoOn: true,
      highlightArea: this.outfitOfTheDay ? 'Highlight area near outfit-of-the-day items' : null,
      brightness: 80,
      colorTemp: 4000 // neutral white for accurate color viewing
    };

    return organization;
  }

  /**
   * Update closet environment sensor readings
   */
  updateClosetEnvironment(readings) {
    if (readings.humidity !== undefined) this.closetEnvironment.humidity = readings.humidity;
    if (readings.temperature !== undefined) this.closetEnvironment.temperature = readings.temperature;
    if (readings.lightOn !== undefined) this.closetEnvironment.lightOn = readings.lightOn;
    if (readings.cedarBlockAge !== undefined) this.closetEnvironment.cedarBlockAge = readings.cedarBlockAge;
    if (readings.lastMothCheck !== undefined) this.closetEnvironment.lastMothCheck = readings.lastMothCheck;
    this._persistData();
  }

  /**
   * Record a moth check inspection
   */
  recordMothCheck() {
    this.closetEnvironment.lastMothCheck = new Date().toISOString();
    this._persistData();
    this.log('Moth check recorded');
  }

  // ─── DONATION SUGGESTIONS ────────────────────────────────────────────

  /**
   * Update donation suggestions for items not worn in 12 months
   */
  _updateDonationSuggestions() {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - 12);

    this.donationSuggestions = this.inventory
      .filter(i => {
        const lastWorn = i.lastWorn ? new Date(i.lastWorn) : new Date(i.addedAt);
        return lastWorn < cutoffDate;
      })
      .map(item => {
        const conditionValues = { 'new': 0.8, 'good': 0.5, 'fair': 0.3, 'worn': 0.1 };
        const estimatedValue = Math.round(item.cost * (conditionValues[item.condition] || 0.3));

        return {
          id: item.id,
          name: item.name,
          type: item.type,
          condition: item.condition,
          lastWorn: item.lastWorn,
          daysSinceWorn: Math.floor((Date.now() - new Date(item.lastWorn || item.addedAt).getTime()) / (1000 * 60 * 60 * 24)),
          originalCost: item.cost,
          estimatedDonationValue: estimatedValue,
          reason: 'Not worn in over 12 months'
        };
      })
      .sort((a, b) => b.daysSinceWorn - a.daysSinceWorn);

    if (this.donationSuggestions.length > 0) {
      this.log(`${this.donationSuggestions.length} items suggested for donation`);
    }
  }

  /**
   * Get donation suggestions with value estimates and pickup info
   */
  getDonationSuggestions() {
    this._updateDonationSuggestions();
    const totalValue = this.donationSuggestions.reduce((sum, i) => sum + i.estimatedDonationValue, 0);
    return {
      items: this.donationSuggestions,
      totalItems: this.donationSuggestions.length,
      totalEstimatedValue: totalValue,
      charityPickupTip: 'Schedule a charity pickup through local organizations. Many offer free home pickup for clothing donations.',
      taxDeductionNote: 'Keep receipts of donated items for potential tax deductions. Document condition and estimated value.'
    };
  }

  /**
   * Mark items as donated and remove from inventory
   */
  donateItems(itemIds) {
    const donated = [];
    for (const id of itemIds) {
      const index = this.inventory.findIndex(i => i.id === id);
      if (index !== -1) {
        const item = this.inventory.splice(index, 1)[0];
        donated.push({ name: item.name, type: item.type, condition: item.condition });
      }
    }
    this._updateDonationSuggestions();
    this._persistData();
    this.log(`Donated ${donated.length} items`);
    return donated;
  }

  // ─── FASHION TRENDS ──────────────────────────────────────────────────

  /**
   * Get current fashion trends with wardrobe compatibility scores
   */
  getFashionTrends(profileId = null) {
    const now = new Date();
    const month = now.getMonth() + 1;
    let currentSeason = 'spring';
    for (const [season, months] of Object.entries(this.seasonalMonths)) {
      if (months.includes(month)) {
        currentSeason = season;
        break;
      }
    }

    const trends = this.fashionTrends[currentSeason] || [];
    const items = profileId
      ? this.inventory.filter(i => i.profileId === profileId)
      : this.inventory;

    const trendAnalysis = trends.map(trend => {
      const trendLower = trend.toLowerCase();
      let compatibleItems = 0;

      for (const item of items) {
        const itemString = `${item.color} ${item.material} ${item.type} ${item.brand}`.toLowerCase();
        if (itemString.includes(trendLower) || trendLower.includes(item.material) || trendLower.includes(item.type)) {
          compatibleItems++;
        }
      }

      return {
        trend,
        season: currentSeason,
        compatibleItems,
        compatibilityScore: items.length > 0 ? Math.round((compatibleItems / items.length) * 100) : 0,
        suggestion: compatibleItems > 0
          ? `You have ${compatibleItems} item(s) matching this trend`
          : `Consider adding items that match the "${trend}" trend`
      };
    });

    return {
      season: currentSeason,
      trends: trendAnalysis,
      overallTrendScore: trendAnalysis.length > 0
        ? Math.round(trendAnalysis.reduce((sum, t) => sum + t.compatibilityScore, 0) / trendAnalysis.length)
        : 0
    };
  }

  // ─── IRONING / STEAMING ──────────────────────────────────────────────

  /**
   * Update ironing queue based on items needing ironing
   */
  _updateIroningQueue() {
    this.ironingQueue = this.inventory
      .filter(i => i.needsIroning)
      .map(i => ({
        id: i.id,
        name: i.name,
        material: i.material,
        ironSetting: (this.washCareInstructions[i.material] || {}).iron || 'medium',
        wrinkleProne: ['linen', 'cotton', 'silk'].includes(i.material)
      }));
  }

  /**
   * Get ironing queue with care instructions
   */
  getIroningQueue() {
    this._updateIroningQueue();
    return {
      items: this.ironingQueue,
      totalItems: this.ironingQueue.length,
      wrinkleProneCount: this.ironingQueue.filter(i => i.wrinkleProne).length,
      tip: 'Iron delicate fabrics (silk) first at low heat, then increase for cotton and linen.',
      steamingAlternative: 'For hanging items, consider a garment steamer as a quicker wrinkle-removal option.'
    };
  }

  /**
   * Mark item as ironed / steamed
   */
  markIroned(itemId) {
    const item = this.inventory.find(i => i.id === itemId);
    if (!item) return false;
    item.needsIroning = false;
    this.ironingQueue = this.ironingQueue.filter(i => i.id !== itemId);
    this._persistData();
    this.log(`Marked ${item.name} as ironed`);
    return true;
  }

  /**
   * Get wrinkle-prone material alerts for items in inventory
   */
  getWrinkleAlerts() {
    const wrinkleProneItems = this.inventory.filter(i =>
      ['linen', 'cotton', 'silk'].includes(i.material) && i.laundryStatus === 'clean' && !i.needsIroning
    );
    return wrinkleProneItems.map(i => ({
      id: i.id,
      name: i.name,
      material: i.material,
      alert: `${i.name} (${i.material}) is wrinkle-prone. Consider steaming before wearing if hung for a long time.`
    }));
  }

  // ─── SHOE MANAGEMENT ─────────────────────────────────────────────────

  /**
   * Get comprehensive shoe management data
   */
  getShoeManagement() {
    const shoes = this.inventory.filter(i => i.type === 'shoes');

    const management = {
      totalPairs: shoes.length,
      maxSlots: this.shoeSlots,
      slotsAvailable: Math.max(0, this.shoeSlots - shoes.length),
      shoes: shoes.map(shoe => ({
        id: shoe.id,
        name: shoe.name,
        color: shoe.color,
        material: shoe.material,
        condition: shoe.condition,
        totalWears: shoe.totalWearCount,
        lastWorn: shoe.lastWorn,
        laundryStatus: shoe.laundryStatus,
        weatherAppropriate: this._isShoeWeatherAppropriate(shoe),
        needsCleaning: shoe.totalWearCount > 0 && shoe.totalWearCount % 10 === 0,
        needsResoling: shoe.totalWearCount > 100 && shoe.material === 'leather',
        cleaningSchedule: this._getShoeCleaningSchedule(shoe)
      })),
      rotationSuggestion: this._getShoeRotation(shoes),
      weatherRecommendation: this._getWeatherShoeRecommendation()
    };

    return management;
  }

  /**
   * Check if shoe is weather-appropriate
   */
  _isShoeWeatherAppropriate(shoe) {
    const temp = this.currentWeather.temperature;
    const rain = this.currentWeather.rainProbability;
    const name = (shoe.name || '').toLowerCase();

    if (rain > 50 && shoe.material === 'leather' && !name.includes('boot')) return false;
    if (rain > 50 && (name.includes('rain boot') || name.includes('wellington'))) return true;
    if (temp < 5 && (name.includes('sandal') || name.includes('open'))) return false;
    if (temp < 0 && name.includes('snow boot')) return true;
    if (temp > 28 && name.includes('boot') && !name.includes('rain')) return false;
    if (temp > 25 && (name.includes('sandal') || name.includes('open'))) return true;
    return true;
  }

  /**
   * Get shoe cleaning schedule based on material
   */
  _getShoeCleaningSchedule(shoe) {
    const materialCare = {
      leather: { frequency: 'Every 2 weeks', method: 'Wipe with damp cloth, apply leather conditioner monthly', products: ['leather cleaner', 'conditioner', 'shoe polish'] },
      cotton: { frequency: 'As needed', method: 'Machine wash on gentle cycle, air dry', products: ['gentle detergent'] },
      polyester: { frequency: 'As needed', method: 'Wipe clean with damp cloth', products: ['mild soap'] },
      denim: { frequency: 'Monthly', method: 'Spot clean, machine wash occasionally', products: ['gentle detergent', 'stain remover'] },
      wool: { frequency: 'Seasonally', method: 'Brush and spot clean, professional cleaning for deep clean', products: ['suede brush', 'fabric cleaner'] },
      silk: { frequency: 'After each wear', method: 'Wipe gently, store with tissue paper', products: ['silk cleaner'] }
    };
    return materialCare[shoe.material] || { frequency: 'As needed', method: 'Follow manufacturer instructions', products: [] };
  }

  /**
   * Get shoe rotation suggestion to extend lifespan
   */
  _getShoeRotation(shoes) {
    if (shoes.length <= 1) return 'Add more shoes for proper rotation. Rotating shoes extends their lifespan by allowing them to dry between wears.';
    const cleanShoes = shoes.filter(s => s.laundryStatus === 'clean' && s.condition !== 'worn');
    if (cleanShoes.length === 0) return 'No clean shoes available for rotation. Clean your shoes for proper rotation.';

    // Find least recently worn pair
    const sorted = cleanShoes.sort((a, b) => {
      const dateA = a.lastWorn ? new Date(a.lastWorn).getTime() : 0;
      const dateB = b.lastWorn ? new Date(b.lastWorn).getTime() : 0;
      return dateA - dateB;
    });

    return `Wear "${sorted[0].name}" next. Rotating shoes allows them to fully dry and recover their shape between wears.`;
  }

  /**
   * Get weather-appropriate shoe recommendation
   */
  _getWeatherShoeRecommendation() {
    const shoes = this.inventory.filter(i => i.type === 'shoes' && i.laundryStatus === 'clean');
    const appropriate = shoes.filter(s => this._isShoeWeatherAppropriate(s));
    if (appropriate.length === 0) return 'No weather-appropriate clean shoes available. Check your shoe inventory.';
    return `Recommended: ${appropriate[0].name} (best match for current weather: ${this.currentWeather.temperature}°C, ${this.currentWeather.rainProbability}% rain chance)`;
  }

  // ─── ENVIRONMENTAL IMPACT ────────────────────────────────────────────

  /**
   * Get environmental impact analysis of the entire wardrobe
   */
  getEnvironmentalImpact() {
    const impact = {
      totalItems: this.inventory.length,
      sustainabilityScore: 0,
      carbonFootprint: 'low',
      materialBreakdown: [],
      ecoTips: [],
      recyclingOpportunities: []
    };

    // Material breakdown with sustainability scores
    const materialCounts = {};
    for (const item of this.inventory) {
      materialCounts[item.material] = (materialCounts[item.material] || 0) + 1;
    }

    let totalSustainabilityScore = 0;
    for (const [material, count] of Object.entries(materialCounts)) {
      const sustainData = this.materialSustainability[material] || { score: 5, note: 'Unknown material' };
      totalSustainabilityScore += sustainData.score * count;
      impact.materialBreakdown.push({
        material,
        count,
        percentage: this.inventory.length > 0 ? Math.round((count / this.inventory.length) * 100) : 0,
        sustainabilityScore: sustainData.score,
        scoreLabel: sustainData.score <= 3 ? 'Eco-friendly' : sustainData.score <= 5 ? 'Moderate' : sustainData.score <= 7 ? 'High impact' : 'Very high impact',
        note: sustainData.note
      });
    }

    // Overall sustainability score (inverted: lower material score = better sustainability)
    if (this.inventory.length > 0) {
      const avgMaterialScore = totalSustainabilityScore / this.inventory.length;
      impact.sustainabilityScore = Math.round((10 - avgMaterialScore) * 10); // Convert to 0-100 scale
    }

    // Carbon footprint estimation
    const polyesterCount = materialCounts['polyester'] || 0;
    const leatherCount = materialCounts['leather'] || 0;
    const syntheticRatio = this.inventory.length > 0 ? (polyesterCount + leatherCount) / this.inventory.length : 0;
    if (syntheticRatio > 0.5) impact.carbonFootprint = 'high';
    else if (syntheticRatio > 0.25) impact.carbonFootprint = 'medium';
    else impact.carbonFootprint = 'low';

    // Eco-friendly care tips
    impact.ecoTips = [
      'Wash clothes in cold water to save energy and preserve colors',
      'Air dry when possible instead of using a dryer (saves ~2.5 kg CO₂ per load)',
      'Use eco-friendly and biodegradable detergents',
      'Wash full loads only to conserve water and energy',
      'Repair items instead of replacing when possible (extend lifespan 2-3x)',
      'Choose natural fibers (linen, organic cotton) for new purchases',
      'Avoid fast fashion - invest in quality pieces that last 5+ years',
      'Use a microfiber filter bag when washing synthetics to catch microplastics',
      'Donate or recycle old clothing instead of sending to landfill'
    ];

    // Recycling suggestions for worn items
    impact.recyclingOpportunities = this.inventory
      .filter(i => i.condition === 'worn')
      .map(i => ({
        id: i.id,
        name: i.name,
        material: i.material,
        recyclable: ['cotton', 'polyester', 'denim', 'wool'].includes(i.material),
        suggestion: this._getRecyclingSuggestion(i.material)
      }));

    return impact;
  }

  /**
   * Get recycling suggestion based on material
   */
  _getRecyclingSuggestion(material) {
    const suggestions = {
      cotton: 'Can be recycled into cleaning cloths, insulation, or new cotton products',
      polyester: 'Can be recycled into new polyester products or plastic lumber',
      denim: 'Many programs accept old denim for building insulation (e.g., Blue Jeans Go Green)',
      wool: 'Can be composted or recycled into new wool products',
      silk: 'Donate to textile recyclers, can be repurposed into accessories',
      leather: 'Can be repurposed into smaller leather goods by craftspeople',
      linen: 'Compostable natural fiber, can also be recycled into paper products'
    };
    return suggestions[material] || 'Check local textile recycling programs for disposal options';
  }

  // ─── MONITORING CYCLE ────────────────────────────────────────────────

  /**
   * Start the 5-minute monitoring cycle
   */
  _startMonitoringCycle() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(async () => {
      try {
        await this._monitoringTick();
      } catch (err) {
        this.error(`Monitoring cycle error: ${err.message}`);
      }
    }, this.monitoringCycleMs);

    this.log('Monitoring cycle started (every 5 minutes)');
  }

  /**
   * Single monitoring tick - runs every 5 minutes
   */
  async _monitoringTick() {
    // Update weather-based recommendations
    await this._refreshWeather();

    // Update laundry status (check washing timeouts)
    this._updateLaundryStatus();

    // Regenerate outfit of the day if date changed
    const today = new Date().toDateString();
    if (this.outfitOfTheDayDate !== today) {
      await this._generateOutfitOfTheDay();
    }

    // Check closet environment conditions
    this._checkClosetEnvironment();

    // Update ironing queue
    this._updateIroningQueue();

    this.log('Monitoring tick completed');
  }

  /**
   * Refresh weather data (emits event for external API integration)
   */
  async _refreshWeather() {
    try {
      if (this.homey && typeof this.homey.emit === 'function') {
        this.homey.emit('wardrobe:weatherRequest');
      }
    } catch (err) {
      // Weather refresh is non-critical, continue silently
    }
  }

  /**
   * Update weather data from external source
   */
  updateWeather(weatherData) {
    if (weatherData.temperature !== undefined) this.currentWeather.temperature = weatherData.temperature;
    if (weatherData.rainProbability !== undefined) this.currentWeather.rainProbability = weatherData.rainProbability;
    if (weatherData.windSpeed !== undefined) this.currentWeather.windSpeed = weatherData.windSpeed;
    if (weatherData.condition !== undefined) this.currentWeather.condition = weatherData.condition;
    this.log(`Weather updated: ${this.currentWeather.temperature}°C, rain: ${this.currentWeather.rainProbability}%, wind: ${this.currentWeather.windSpeed} km/h`);
  }

  /**
   * Update calendar events for occasion detection
   */
  updateCalendarEvents(events) {
    this.calendarEvents = Array.isArray(events) ? events : [];
    this.log(`Calendar updated: ${this.calendarEvents.length} events`);
  }

  /**
   * Update laundry status (auto-transition checks)
   */
  _updateLaundryStatus() {
    const now = Date.now();
    for (const item of this.inventory) {
      // Alert if washing has been running for over 2 hours
      if (item.laundryStatus === 'washing' && item.washStarted) {
        const elapsed = now - new Date(item.washStarted).getTime();
        if (elapsed > 2 * 60 * 60 * 1000) {
          this.log(`${item.name}: wash cycle likely complete (${Math.round(elapsed / 60000)} min). Mark as clean when confirmed.`);
        }
      }
    }
  }

  /**
   * Generate outfit of the day
   */
  async _generateOutfitOfTheDay() {
    try {
      const recommendation = await this.generateOutfitRecommendation();
      if (recommendation && recommendation.items.length > 0) {
        this.outfitOfTheDay = recommendation;
        this.outfitOfTheDayDate = new Date().toDateString();
        this.log(`Outfit of the day: ${recommendation.items.map(i => i.name).join(', ')}`);
      }
    } catch (err) {
      this.error(`Failed to generate outfit of the day: ${err.message}`);
    }
  }

  /**
   * Get outfit of the day
   */
  getOutfitOfTheDay() {
    return this.outfitOfTheDay;
  }

  /**
   * Check closet environment conditions and emit alerts
   */
  _checkClosetEnvironment() {
    const alerts = [];
    if (this.closetEnvironment.humidity > this.closetEnvironment.idealHumidityMax) {
      alerts.push({ type: 'humidity_high', message: 'Closet humidity too high - risk of mold and mildew on clothing' });
    }
    if (this.closetEnvironment.humidity < this.closetEnvironment.idealHumidityMin) {
      alerts.push({ type: 'humidity_low', message: 'Closet humidity too low - may cause fabric drying and brittleness' });
    }
    if (this.closetEnvironment.temperature > 30) {
      alerts.push({ type: 'temperature_high', message: 'Closet temperature too high - may damage delicate fabrics and accelerate deterioration' });
    }

    if (alerts.length > 0 && this.homey && typeof this.homey.emit === 'function') {
      try {
        this.homey.emit('wardrobe:environmentAlert', alerts);
      } catch (err) {
        // Non-critical alert emission
      }
    }
  }

  // ─── STATISTICS ──────────────────────────────────────────────────────

  /**
   * Get comprehensive wardrobe statistics
   */
  getStatistics() {
    const items = this.inventory;
    const totalItems = items.length;

    // Type distribution
    const typeDistribution = {};
    for (const item of items) {
      typeDistribution[item.type] = (typeDistribution[item.type] || 0) + 1;
    }

    // Color distribution
    const colorDistribution = {};
    for (const item of items) {
      colorDistribution[item.color] = (colorDistribution[item.color] || 0) + 1;
    }

    // Material distribution
    const materialDistribution = {};
    for (const item of items) {
      materialDistribution[item.material] = (materialDistribution[item.material] || 0) + 1;
    }

    // Season distribution
    const seasonDistribution = {};
    for (const item of items) {
      seasonDistribution[item.season] = (seasonDistribution[item.season] || 0) + 1;
    }

    // Laundry status
    const laundryStatus = { clean: 0, worn: 0, dirty: 0, washing: 0 };
    for (const item of items) {
      laundryStatus[item.laundryStatus] = (laundryStatus[item.laundryStatus] || 0) + 1;
    }

    // Condition breakdown
    const conditionBreakdown = {};
    for (const item of items) {
      conditionBreakdown[item.condition] = (conditionBreakdown[item.condition] || 0) + 1;
    }

    // Cost analysis
    const totalCost = items.reduce((sum, i) => sum + (i.cost || 0), 0);
    const avgCost = totalItems > 0 ? Math.round(totalCost / totalItems) : 0;
    const totalWears = items.reduce((sum, i) => sum + (i.totalWearCount || 0), 0);
    const avgCostPerWear = totalWears > 0 ? Math.round((totalCost / totalWears) * 100) / 100 : 0;
    const mostExpensive = [...items].sort((a, b) => (b.cost || 0) - (a.cost || 0)).slice(0, 5).map(i => ({ name: i.name, cost: i.cost }));

    // Most and least worn
    const sortedByWear = [...items].sort((a, b) => b.totalWearCount - a.totalWearCount);
    const mostWorn = sortedByWear.slice(0, 5).map(i => ({ name: i.name, wears: i.totalWearCount }));
    const leastWorn = sortedByWear.filter(i => i.totalWearCount > 0).slice(-5).reverse().map(i => ({ name: i.name, wears: i.totalWearCount }));
    const neverWorn = items.filter(i => i.totalWearCount === 0).map(i => ({ name: i.name, addedAt: i.addedAt }));

    return {
      totalItems,
      maxCapacity: this.maxInventorySize,
      capacityUsed: Math.round((totalItems / this.maxInventorySize) * 100),
      typeDistribution,
      colorDistribution,
      materialDistribution,
      seasonDistribution,
      laundryStatus,
      conditionBreakdown,
      costAnalysis: {
        totalWardrobeValue: totalCost,
        averageItemCost: avgCost,
        totalWears,
        averageCostPerWear: avgCostPerWear,
        mostExpensive
      },
      mostWorn,
      leastWorn,
      neverWorn: neverWorn.length,
      outfitHistoryCount: this.outfitHistory.length,
      favoriteOutfits: this.outfitHistory.filter(o => o.isFavorite).length,
      profileCount: this.styleProfiles.length,
      donationCandidates: this.donationSuggestions.length,
      ironingQueueSize: this.ironingQueue.length,
      shoeCount: items.filter(i => i.type === 'shoes').length,
      shoeSlots: this.shoeSlots,
      wishlistCount: this.wishlist.length,
      packingListCount: this.packingLists.length,
      environmentalScore: this.getEnvironmentalImpact().sustainabilityScore,
      budgetStatus: {
        monthlyBudget: this.shoppingBudget.monthly,
        monthlySpent: this.shoppingBudget.spentMonthly,
        monthlyRemaining: this.shoppingBudget.monthly - this.shoppingBudget.spentMonthly,
        annualBudget: this.shoppingBudget.annual,
        annualSpent: this.shoppingBudget.spentAnnual,
        annualRemaining: this.shoppingBudget.annual - this.shoppingBudget.spentAnnual
      }
    };
  }

  // ─── DATA PERSISTENCE ────────────────────────────────────────────────

  /**
   * Load persisted data from Homey settings
   */
  async _loadPersistedData() {
    try {
      if (this.homey && typeof this.homey.settings === 'object') {
        const data = this.homey.settings.get('wardrobe_data');
        if (data) {
          const parsed = typeof data === 'string' ? JSON.parse(data) : data;
          this.inventory = parsed.inventory || [];
          this.outfitHistory = parsed.outfitHistory || [];
          this.styleProfiles = parsed.styleProfiles || [];
          this.wishlist = parsed.wishlist || [];
          this.packingLists = parsed.packingLists || [];
          this.shoppingBudget = parsed.shoppingBudget || this.shoppingBudget;
          this.closetEnvironment = parsed.closetEnvironment || this.closetEnvironment;
          this.currentWeather = parsed.currentWeather || this.currentWeather;
          this.repeatPreventionDays = parsed.repeatPreventionDays || this.repeatPreventionDays;
          this.log(`Loaded persisted data: ${this.inventory.length} items, ${this.styleProfiles.length} profiles`);
        }
      }
    } catch (err) {
      this.error(`Failed to load persisted data: ${err.message}`);
    }
  }

  /**
   * Persist data to Homey settings storage
   */
  _persistData() {
    try {
      if (this.homey && typeof this.homey.settings === 'object') {
        const data = {
          inventory: this.inventory,
          outfitHistory: this.outfitHistory,
          styleProfiles: this.styleProfiles,
          wishlist: this.wishlist,
          packingLists: this.packingLists,
          shoppingBudget: this.shoppingBudget,
          closetEnvironment: this.closetEnvironment,
          currentWeather: this.currentWeather,
          repeatPreventionDays: this.repeatPreventionDays
        };
        this.homey.settings.set('wardrobe_data', JSON.stringify(data));
      }
    } catch (err) {
      this.error(`Failed to persist data: ${err.message}`);
    }
  }

  // ─── UTILITY METHODS ─────────────────────────────────────────────────

  /**
   * Generate a unique ID
   */
  _generateId() {
    return `wrd_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Create a concise item summary for display
   */
  _itemSummary(item) {
    return {
      id: item.id,
      name: item.name,
      type: item.type,
      color: item.color,
      material: item.material,
      formality: item.formality
    };
  }

  /**
   * Log a message with [Wardrobe] tag prefix
   */
  log(msg) {
    if (this.homey && typeof this.homey.log === 'function') {
      this.homey.log(`[Wardrobe] ${msg}`);
    } else {
      console.log(`[Wardrobe] ${msg}`);
    }
  }

  /**
   * Log an error with [Wardrobe] tag prefix
   */
  error(msg) {
    if (this.homey && typeof this.homey.error === 'function') {
      this.homey.error(`[Wardrobe] ${msg}`);
    } else {
      console.error(`[Wardrobe] ${msg}`);
    }
  }

  /**
   * Destroy the system and clean up all resources
   */
  destroy() {
    this.log('Destroying SmartWardrobeManagementSystem...');

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this._persistData();

    this.inventory = [];
    this.outfitHistory = [];
    this.styleProfiles = [];
    this.wishlist = [];
    this.packingLists = [];
    this.ironingQueue = [];
    this.donationSuggestions = [];
    this.outfitOfTheDay = null;
    this.calendarEvents = [];

    this.log('SmartWardrobeManagementSystem destroyed');
  }
}

module.exports = SmartWardrobeManagementSystem;
