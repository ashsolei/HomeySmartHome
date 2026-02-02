const EventEmitter = require('events');

/**
 * Smart Wardrobe Management System
 * 
 * Provides intelligent clothing inventory management, outfit recommendations,
 * seasonal storage, and wardrobe optimization with AI-powered styling.
 * 
 * Features:
 * - Complete clothing inventory with photos
 * - AI-powered outfit recommendations
 * - Weather-based clothing suggestions
 * - Occasion-specific outfit planning
 * - Seasonal wardrobe rotation
 * - Laundry tracking and care instructions
 * - Wear frequency analysis
 * - Shopping recommendations (fill gaps)
 * - Color coordination and style matching
 * - Virtual closet visualization
 */
class SmartWardrobeManagementSystem extends EventEmitter {
  constructor(homey) {
    super();
    this.homey = homey;
    this.garments = new Map();
    this.outfits = new Map();
    this.wearHistory = [];
    this.laundry = [];
    this.wishlist = [];
    this.monitoringInterval = null;
    
    // Performance optimizations
    this._cache = new Map();
    this._cacheTimeout = 300000; // 5 minutes
  }

  async initialize() {
    this.homey.log('Initializing Smart Wardrobe Management System...');
    
    try {
      await this.loadSettings();
      this.initializeSampleWardrobe();
      this.initializeDefaultOutfits();
      
      this.startMonitoring();
      
      this.homey.log('Smart Wardrobe Management System initialized successfully');
      return true;
    } catch (error) {
      this.homey.error('Failed to initialize Wardrobe Management:', error);
      throw error;
    }
  }

  async loadSettings() {
    try {
      const settings = await this.homey.settings.get('smartWardrobe') || {};
      
      if (settings.garments) {
        settings.garments.forEach(garment => {
          this.garments.set(garment.id, garment);
        });
      }
      
      if (settings.outfits) {
        settings.outfits.forEach(outfit => {
          this.outfits.set(outfit.id, outfit);
        });
      }
      
      this.wearHistory = settings.wearHistory || [];
      this.laundry = settings.laundry || [];
      this.wishlist = settings.wishlist || [];
    } catch (error) {
      this.homey.error('Error loading wardrobe settings:', error);
      throw error;
    }
  }

  async saveSettings() {
    try {
      const settings = {
        garments: Array.from(this.garments.values()),
        outfits: Array.from(this.outfits.values()),
        wearHistory: this.wearHistory.slice(-200), // Keep last 200
        laundry: this.laundry,
        wishlist: this.wishlist
      };
      
      await this.homey.settings.set('smartWardrobe', settings);
      this._cache.clear();
    } catch (error) {
      this.homey.error('Error saving wardrobe settings:', error);
      throw error;
    }
  }

  initializeSampleWardrobe() {
    if (this.garments.size === 0) {
      const sampleGarments = [
        // Tops
        { id: 'top-001', name: 'White Oxford Shirt', category: 'tops', type: 'shirt', color: 'white', brand: 'Brooks Brothers', season: ['spring', 'summer', 'fall', 'winter'], occasion: ['work', 'casual', 'formal'], wearCount: 15, lastWorn: null, status: 'clean', care: 'machine-wash-cold', material: 'cotton', size: 'M' },
        { id: 'top-002', name: 'Navy Polo', category: 'tops', type: 'polo', color: 'navy', brand: 'Lacoste', season: ['spring', 'summer'], occasion: ['casual', 'smart-casual'], wearCount: 8, lastWorn: null, status: 'clean', care: 'machine-wash-warm', material: 'cotton', size: 'M' },
        { id: 'top-003', name: 'Gray T-Shirt', category: 'tops', type: 't-shirt', color: 'gray', brand: 'Uniqlo', season: ['spring', 'summer', 'fall'], occasion: ['casual'], wearCount: 22, lastWorn: null, status: 'clean', care: 'machine-wash-warm', material: 'cotton', size: 'M' },
        
        // Bottoms
        { id: 'bottom-001', name: 'Dark Jeans', category: 'bottoms', type: 'jeans', color: 'dark-blue', brand: 'Levis', season: ['fall', 'winter', 'spring'], occasion: ['casual', 'smart-casual'], wearCount: 18, lastWorn: null, status: 'clean', care: 'machine-wash-cold', material: 'denim', size: '32/32' },
        { id: 'bottom-002', name: 'Chinos Khaki', category: 'bottoms', type: 'chinos', color: 'khaki', brand: 'J.Crew', season: ['spring', 'summer', 'fall'], occasion: ['work', 'smart-casual'], wearCount: 12, lastWorn: null, status: 'clean', care: 'machine-wash-warm', material: 'cotton', size: '32/32' },
        { id: 'bottom-003', name: 'Black Dress Pants', category: 'bottoms', type: 'dress-pants', color: 'black', brand: 'Hugo Boss', season: ['fall', 'winter', 'spring'], occasion: ['work', 'formal'], wearCount: 6, lastWorn: null, status: 'clean', care: 'dry-clean-only', material: 'wool', size: '32/32' },
        
        // Outerwear
        { id: 'outer-001', name: 'Navy Blazer', category: 'outerwear', type: 'blazer', color: 'navy', brand: 'Zara', season: ['fall', 'winter', 'spring'], occasion: ['work', 'formal', 'smart-casual'], wearCount: 10, lastWorn: null, status: 'clean', care: 'dry-clean-only', material: 'wool-blend', size: 'M' },
        { id: 'outer-002', name: 'Leather Jacket', category: 'outerwear', type: 'jacket', color: 'black', brand: 'AllSaints', season: ['fall', 'spring'], occasion: ['casual'], wearCount: 7, lastWorn: null, status: 'clean', care: 'professional-leather-care', material: 'leather', size: 'M' },
        
        // Shoes
        { id: 'shoes-001', name: 'Brown Oxfords', category: 'shoes', type: 'oxfords', color: 'brown', brand: 'Allen Edmonds', season: ['fall', 'winter', 'spring'], occasion: ['work', 'formal'], wearCount: 9, lastWorn: null, status: 'clean', care: 'polish-regularly', material: 'leather', size: '10' },
        { id: 'shoes-002', name: 'White Sneakers', category: 'shoes', type: 'sneakers', color: 'white', brand: 'Common Projects', season: ['spring', 'summer', 'fall'], occasion: ['casual'], wearCount: 25, lastWorn: null, status: 'clean', care: 'spot-clean', material: 'leather', size: '10' },
        
        // Accessories
        { id: 'acc-001', name: 'Navy Silk Tie', category: 'accessories', type: 'tie', color: 'navy', brand: 'Hermes', season: ['fall', 'winter', 'spring'], occasion: ['work', 'formal'], wearCount: 4, lastWorn: null, status: 'clean', care: 'dry-clean-only', material: 'silk', size: 'one-size' },
        { id: 'acc-002', name: 'Brown Leather Belt', category: 'accessories', type: 'belt', color: 'brown', brand: 'Coach', season: ['spring', 'summer', 'fall', 'winter'], occasion: ['work', 'casual', 'formal'], wearCount: 20, lastWorn: null, status: 'clean', care: 'condition-regularly', material: 'leather', size: '32' }
      ];
      
      sampleGarments.forEach(garment => {
        garment.addedDate = new Date().toISOString();
        garment.purchasePrice = 0;
        garment.photoUrl = null;
        garment.notes = '';
        this.garments.set(garment.id, garment);
      });
    }
  }

  initializeDefaultOutfits() {
    if (this.outfits.size === 0) {
      this.outfits.set('outfit-work-1', {
        id: 'outfit-work-1',
        name: 'Office Professional',
        occasion: 'work',
        season: ['fall', 'winter', 'spring'],
        garments: ['top-001', 'bottom-003', 'outer-001', 'shoes-001', 'acc-001', 'acc-002'],
        rating: 5,
        wearCount: 3,
        lastWorn: null,
        favorite: true
      });
      
      this.outfits.set('outfit-casual-1', {
        id: 'outfit-casual-1',
        name: 'Weekend Casual',
        occasion: 'casual',
        season: ['spring', 'summer', 'fall'],
        garments: ['top-003', 'bottom-001', 'shoes-002'],
        rating: 4,
        wearCount: 8,
        lastWorn: null,
        favorite: false
      });
      
      this.outfits.set('outfit-smart-casual-1', {
        id: 'outfit-smart-casual-1',
        name: 'Smart Casual',
        occasion: 'smart-casual',
        season: ['spring', 'summer', 'fall'],
        garments: ['top-002', 'bottom-002', 'shoes-002', 'acc-002'],
        rating: 4,
        wearCount: 5,
        lastWorn: null,
        favorite: false
      });
    }
  }

  startMonitoring() {
    // Check wardrobe status daily
    this.monitoringInterval = setInterval(() => {
      this.analyzeWardrobeUsage();
      this.checkLaundryStatus();
    }, 86400000); // 24 hours
  }

  async analyzeWardrobeUsage() {
    try {
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      
      for (const garment of this.garments.values()) {
        const lastWorn = garment.lastWorn ? new Date(garment.lastWorn).getTime() : 0;
        
        if (lastWorn > 0 && lastWorn < thirtyDaysAgo) {
          garment.usageStatus = 'underutilized';
        } else if (garment.wearCount > 50) {
          garment.usageStatus = 'frequently-worn';
        } else {
          garment.usageStatus = 'normal';
        }
      }
      
      await this.saveSettings();
    } catch (error) {
      this.homey.error('Error analyzing wardrobe usage:', error);
    }
  }

  async checkLaundryStatus() {
    try {
      const overdueItems = this.laundry.filter(item => {
        const addedDate = new Date(item.addedDate).getTime();
        const daysInLaundry = (Date.now() - addedDate) / (1000 * 60 * 60 * 24);
        return daysInLaundry > 7; // Over a week in laundry
      });
      
      if (overdueItems.length > 0) {
        this.emit('notification', {
          title: 'Laundry Reminder',
          message: `${overdueItems.length} item(s) have been in laundry for over a week`,
          priority: 'low',
          category: 'wardrobe'
        });
      }
    } catch (error) {
      this.homey.error('Error checking laundry status:', error);
    }
  }

  async getOutfitRecommendation(criteria = {}) {
    try {
      const {
        occasion = 'casual',
        season = this.getCurrentSeason(),
        weather = null,
        temperature = null
      } = criteria;
      
      // Filter available (clean) garments
      const availableGarments = Array.from(this.garments.values()).filter(g => 
        g.status === 'clean' &&
        g.occasion.includes(occasion) &&
        g.season.includes(season)
      );
      
      if (availableGarments.length === 0) {
        return {
          recommendation: null,
          message: 'No suitable clean garments found. Consider doing laundry.'
        };
      }
      
      // Weather-based filtering
      if (temperature !== null) {
        if (temperature < 10) {
          // Cold weather - prioritize warm materials
          availableGarments.sort((a, b) => {
            const warmMaterials = ['wool', 'cashmere', 'fleece'];
            const aWarm = warmMaterials.includes(a.material) ? 1 : 0;
            const bWarm = warmMaterials.includes(b.material) ? 1 : 0;
            return bWarm - aWarm;
          });
        }
      }
      
      // Build outfit
      const outfit = {
        top: availableGarments.find(g => g.category === 'tops'),
        bottom: availableGarments.find(g => g.category === 'bottoms'),
        shoes: availableGarments.find(g => g.category === 'shoes'),
        outerwear: temperature < 15 ? availableGarments.find(g => g.category === 'outerwear') : null,
        accessories: []
      };
      
      // Add coordinating accessories
      const accessories = availableGarments.filter(g => g.category === 'accessories');
      if (occasion === 'work' || occasion === 'formal') {
        const tie = accessories.find(a => a.type === 'tie');
        const belt = accessories.find(a => a.type === 'belt');
        if (tie) outfit.accessories.push(tie);
        if (belt) outfit.accessories.push(belt);
      }
      
      // Color coordination check
      const coordinated = this.checkColorCoordination(outfit);
      
      return {
        recommendation: outfit,
        coordinated,
        occasion,
        season,
        weather: { temperature },
        confidence: coordinated ? 0.9 : 0.7
      };
    } catch (error) {
      this.homey.error('Error getting outfit recommendation:', error);
      throw error;
    }
  }

  checkColorCoordination(outfit) {
    // Simple color coordination logic
    const colors = [];
    
    Object.values(outfit).forEach(item => {
      if (item && !Array.isArray(item)) {
        colors.push(item.color);
      } else if (Array.isArray(item)) {
        item.forEach(i => colors.push(i.color));
      }
    });
    
    // Basic rules: max 3 colors, neutral colors always work
    const neutrals = ['white', 'black', 'gray', 'navy', 'beige', 'brown', 'khaki'];
    const nonNeutralColors = colors.filter(c => !neutrals.includes(c));
    
    return nonNeutralColors.length <= 2;
  }

  getCurrentSeason() {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'fall';
    return 'winter';
  }

  async recordWear(garmentIds) {
    try {
      const wearRecord = {
        id: `wear-${Date.now()}`,
        date: new Date().toISOString(),
        garments: garmentIds,
        occasion: null,
        weather: null
      };
      
      this.wearHistory.push(wearRecord);
      
      // Update garment wear stats
      garmentIds.forEach(id => {
        const garment = this.garments.get(id);
        if (garment) {
          garment.wearCount++;
          garment.lastWorn = wearRecord.date;
        }
      });
      
      await this.saveSettings();
      
      return wearRecord;
    } catch (error) {
      this.homey.error('Error recording wear:', error);
      throw error;
    }
  }

  async moveToLaundry(garmentIds) {
    try {
      garmentIds.forEach(id => {
        const garment = this.garments.get(id);
        if (garment) {
          garment.status = 'in-laundry';
          
          this.laundry.push({
            garmentId: id,
            addedDate: new Date().toISOString(),
            careInstructions: garment.care
          });
        }
      });
      
      await this.saveSettings();
      
      this.emit('notification', {
        title: 'Laundry Updated',
        message: `${garmentIds.length} item(s) added to laundry`,
        priority: 'low',
        category: 'wardrobe'
      });
      
      return this.laundry;
    } catch (error) {
      this.homey.error('Error moving to laundry:', error);
      throw error;
    }
  }

  async markAsClean(garmentIds) {
    try {
      garmentIds.forEach(id => {
        const garment = this.garments.get(id);
        if (garment) {
          garment.status = 'clean';
          
          // Remove from laundry list
          this.laundry = this.laundry.filter(item => item.garmentId !== id);
        }
      });
      
      await this.saveSettings();
      
      return garmentIds.length;
    } catch (error) {
      this.homey.error('Error marking as clean:', error);
      throw error;
    }
  }

  async addGarment(garmentData) {
    try {
      const garment = {
        id: `garment-${Date.now()}`,
        ...garmentData,
        addedDate: new Date().toISOString(),
        wearCount: 0,
        lastWorn: null,
        status: 'clean'
      };
      
      this.garments.set(garment.id, garment);
      await this.saveSettings();
      
      return garment;
    } catch (error) {
      this.homey.error('Error adding garment:', error);
      throw error;
    }
  }

  async createOutfit(outfitData) {
    try {
      const outfit = {
        id: `outfit-${Date.now()}`,
        ...outfitData,
        wearCount: 0,
        lastWorn: null,
        rating: 0,
        favorite: false
      };
      
      this.outfits.set(outfit.id, outfit);
      await this.saveSettings();
      
      return outfit;
    } catch (error) {
      this.homey.error('Error creating outfit:', error);
      throw error;
    }
  }

  getGarments(filter = null) {
    let garments = Array.from(this.garments.values());
    
    if (filter) {
      if (filter.category) garments = garments.filter(g => g.category === filter.category);
      if (filter.status) garments = garments.filter(g => g.status === filter.status);
      if (filter.season) garments = garments.filter(g => g.season.includes(filter.season));
      if (filter.occasion) garments = garments.filter(g => g.occasion.includes(filter.occasion));
      if (filter.color) garments = garments.filter(g => g.color === filter.color);
    }
    
    return garments;
  }

  getOutfits(filter = null) {
    let outfits = Array.from(this.outfits.values());
    
    if (filter) {
      if (filter.occasion) outfits = outfits.filter(o => o.occasion === filter.occasion);
      if (filter.season) outfits = outfits.filter(o => o.season.includes(filter.season));
      if (filter.favorite) outfits = outfits.filter(o => o.favorite === true);
    }
    
    return outfits;
  }

  getLaundry() {
    return this.laundry;
  }

  getWearHistory(limit = 50) {
    return this.wearHistory.slice(-limit).reverse();
  }

  getStats() {
    const garments = Array.from(this.garments.values());
    
    return {
      totalGarments: garments.length,
      byCategory: {
        tops: garments.filter(g => g.category === 'tops').length,
        bottoms: garments.filter(g => g.category === 'bottoms').length,
        outerwear: garments.filter(g => g.category === 'outerwear').length,
        shoes: garments.filter(g => g.category === 'shoes').length,
        accessories: garments.filter(g => g.category === 'accessories').length
      },
      cleanGarments: garments.filter(g => g.status === 'clean').length,
      inLaundry: this.laundry.length,
      totalOutfits: this.outfits.size,
      favoriteOutfits: Array.from(this.outfits.values()).filter(o => o.favorite).length,
      mostWornGarment: garments.sort((a, b) => b.wearCount - a.wearCount)[0],
      leastWornGarments: garments.filter(g => g.wearCount === 0).length
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

module.exports = SmartWardrobeManagementSystem;
