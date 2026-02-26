const EventEmitter = require('events');

/**
 * Wine Cellar Management System
 * 
 * Provides comprehensive wine collection management with climate control,
 * inventory tracking, aging monitoring, and recommendation features.
 * 
 * Features:
 * - Temperature and humidity monitoring and control
 * - Wine inventory management with detailed metadata
 * - Aging tracking and optimal drinking window alerts
 * - Vibration monitoring for storage quality
 * - Wine recommendations based on occasion and meal
 * - Collection value tracking
 * - Tasting notes and ratings
 * - Integration with wine databases for information
 * - Storage location tracking (rack, shelf, position)
 * - Purchase history and cellar analytics
 */
class WineCellarManagementSystem extends EventEmitter {
  constructor(homey) {
    super();
    this.homey = homey;
    this.wines = new Map();
    this.cellars = new Map();
    this.tastingNotes = [];
    this.monitoringInterval = null;
  }

  async initialize() {
    try {
      this.homey.log('Initializing Wine Cellar Management System...');

      await this.loadSettings();
      this.initializeDefaultCellars();
      this.initializeSampleWines();

      this.startMonitoring();

      this.homey.log('Wine Cellar Management System initialized successfully');
      return true;
    } catch (error) {
      this.homey.error(`[WineCellarManagementSystem] Failed to initialize:`, error.message);
    }
  }

  async loadSettings() {
    const settings = await this.homey.settings.get('wineCellarManagement') || {};
    
    if (settings.wines) {
      settings.wines.forEach(wine => {
        this.wines.set(wine.id, wine);
      });
    }
    
    if (settings.cellars) {
      settings.cellars.forEach(cellar => {
        this.cellars.set(cellar.id, cellar);
      });
    }
    
    this.tastingNotes = settings.tastingNotes || [];
  }

  async saveSettings() {
    const settings = {
      wines: Array.from(this.wines.values()),
      cellars: Array.from(this.cellars.values()),
      tastingNotes: this.tastingNotes.slice(-200) // Keep last 200 notes
    };
    
    await this.homey.settings.set('wineCellarManagement', settings);
  }

  initializeDefaultCellars() {
    if (this.cellars.size === 0) {
      this.cellars.set('main-cellar', {
        id: 'main-cellar',
        name: 'Huvudkällare',
        type: 'climate-controlled',
        capacity: 200,
        occupied: 0,
        climate: {
          temperature: {
            current: 13,
            target: 13,
            optimal: { min: 12, max: 14 },
            unit: '°C'
          },
          humidity: {
            current: 70,
            target: 70,
            optimal: { min: 60, max: 80 },
            unit: '%'
          },
          vibration: {
            level: 'minimal',
            threshold: 'low'
          },
          light: {
            level: 'dark',
            uvProtection: true
          }
        },
        sections: [
          { id: 'red-wines', name: 'Röda viner', capacity: 100, occupied: 0 },
          { id: 'white-wines', name: 'Vita viner', capacity: 60, occupied: 0 },
          { id: 'sparkling', name: 'Mousserande', capacity: 40, occupied: 0 }
        ],
        devices: {
          coolingSystem: 'active',
          humidifier: 'active',
          ventilation: 'active',
          monitoring: 'active'
        }
      });

      this.cellars.set('display-rack', {
        id: 'display-rack',
        name: 'Displayställ',
        type: 'display',
        capacity: 24,
        occupied: 0,
        climate: {
          temperature: {
            current: 16,
            target: 16,
            optimal: { min: 15, max: 18 },
            unit: '°C'
          },
          humidity: {
            current: 65,
            target: 65,
            optimal: { min: 55, max: 75 },
            unit: '%'
          },
          vibration: {
            level: 'minimal',
            threshold: 'low'
          },
          light: {
            level: 'ambient',
            uvProtection: true
          }
        },
        sections: [
          { id: 'special-bottles', name: 'Specialflaskor', capacity: 12, occupied: 0 },
          { id: 'daily-selection', name: 'Dagligt urval', capacity: 12, occupied: 0 }
        ],
        devices: {
          coolingSystem: 'passive',
          lighting: 'led',
          monitoring: 'active'
        }
      });
    }
  }

  initializeSampleWines() {
    if (this.wines.size === 0) {
      this.wines.set('wine-001', {
        id: 'wine-001',
        name: 'Château Margaux 2015',
        producer: 'Château Margaux',
        country: 'Frankrike',
        region: 'Bordeaux, Margaux',
        vintage: 2015,
        type: 'red',
        varietal: ['Cabernet Sauvignon', 'Merlot', 'Cabernet Franc', 'Petit Verdot'],
        alcoholContent: 13.5,
        bottleSize: 750,
        quantity: 3,
        storage: {
          cellarId: 'main-cellar',
          section: 'red-wines',
          rack: 'A',
          shelf: 3,
          position: 5
        },
        purchase: {
          date: '2018-03-15',
          price: 450,
          supplier: 'Systembolaget',
          currency: 'SEK'
        },
        aging: {
          peakDrinkingStart: 2025,
          peakDrinkingEnd: 2045,
          status: 'aging-well',
          daysSincePurchase: Math.floor((Date.now() - new Date('2018-03-15').getTime()) / 86400000)
        },
        ratings: {
          personal: null,
          parkerPoints: 98,
          winespectator: 97
        },
        characteristics: {
          body: 'full',
          sweetness: 'dry',
          acidity: 'medium',
          tannins: 'high',
          flavor: ['blackcurrant', 'cedar', 'tobacco', 'truffle']
        },
        pairings: ['beef', 'lamb', 'game', 'aged-cheese'],
        notes: 'Exceptionell årgång, lagra minst till 2025'
      });

      this.wines.set('wine-002', {
        id: 'wine-002',
        name: 'Dom Pérignon 2010',
        producer: 'Moët & Chandon',
        country: 'Frankrike',
        region: 'Champagne',
        vintage: 2010,
        type: 'sparkling',
        varietal: ['Chardonnay', 'Pinot Noir'],
        alcoholContent: 12.5,
        bottleSize: 750,
        quantity: 2,
        storage: {
          cellarId: 'main-cellar',
          section: 'sparkling',
          rack: 'C',
          shelf: 1,
          position: 8
        },
        purchase: {
          date: '2020-06-10',
          price: 1800,
          supplier: 'Systembolaget',
          currency: 'SEK'
        },
        aging: {
          peakDrinkingStart: 2020,
          peakDrinkingEnd: 2035,
          status: 'ready-to-drink',
          daysSincePurchase: Math.floor((Date.now() - new Date('2020-06-10').getTime()) / 86400000)
        },
        ratings: {
          personal: 95,
          parkerPoints: 96,
          winespectator: 95
        },
        characteristics: {
          body: 'medium',
          sweetness: 'brut',
          acidity: 'high',
          bubbles: 'fine',
          flavor: ['citrus', 'brioche', 'almond', 'mineral']
        },
        pairings: ['seafood', 'caviar', 'soft-cheese', 'dessert'],
        notes: 'Perfekt för speciella tillfällen'
      });

      this.wines.set('wine-003', {
        id: 'wine-003',
        name: 'Cloudy Bay Sauvignon Blanc 2021',
        producer: 'Cloudy Bay',
        country: 'Nya Zeeland',
        region: 'Marlborough',
        vintage: 2021,
        type: 'white',
        varietal: ['Sauvignon Blanc'],
        alcoholContent: 13.0,
        bottleSize: 750,
        quantity: 6,
        storage: {
          cellarId: 'main-cellar',
          section: 'white-wines',
          rack: 'B',
          shelf: 2,
          position: 12
        },
        purchase: {
          date: '2022-04-20',
          price: 180,
          supplier: 'Systembolaget',
          currency: 'SEK'
        },
        aging: {
          peakDrinkingStart: 2022,
          peakDrinkingEnd: 2025,
          status: 'drink-soon',
          daysSincePurchase: Math.floor((Date.now() - new Date('2022-04-20').getTime()) / 86400000)
        },
        ratings: {
          personal: 88,
          parkerPoints: 90,
          winespectator: 89
        },
        characteristics: {
          body: 'light',
          sweetness: 'dry',
          acidity: 'high',
          flavor: ['passion-fruit', 'lime', 'grass', 'mineral']
        },
        pairings: ['fish', 'shellfish', 'salad', 'goat-cheese'],
        notes: 'Friskt sommarvin, drick inom 2 år'
      });
    }
  }

  startMonitoring() {
    // Monitor cellar conditions every 5 minutes
    this.monitoringInterval = setInterval(() => {
      this.monitorCellarConditions();
      this.checkAgingStatus();
    }, 300000);
  }

  async monitorCellarConditions() {
    for (const cellar of this.cellars.values()) {
      const climate = cellar.climate;
      
      // Simulate slight variations in temperature and humidity
      climate.temperature.current += (Math.random() - 0.5) * 0.5;
      climate.humidity.current += (Math.random() - 0.5) * 2;
      
      // Check if conditions are outside optimal range
      const tempOutOfRange = 
        climate.temperature.current < climate.temperature.optimal.min ||
        climate.temperature.current > climate.temperature.optimal.max;
      
      const humidityOutOfRange =
        climate.humidity.current < climate.humidity.optimal.min ||
        climate.humidity.current > climate.humidity.optimal.max;
      
      if (tempOutOfRange) {
        await this.adjustCellarTemperature(cellar.id);
        this.emit('notification', {
          title: 'Vinkällare temperatur',
          message: `${cellar.name}: Temperatur ${climate.temperature.current.toFixed(1)}°C justeras`,
          priority: 'normal',
          category: 'wine-cellar'
        });
      }
      
      if (humidityOutOfRange) {
        await this.adjustCellarHumidity(cellar.id);
        this.emit('notification', {
          title: 'Vinkällare luftfuktighet',
          message: `${cellar.name}: Luftfuktighet ${climate.humidity.current.toFixed(0)}% justeras`,
          priority: 'normal',
          category: 'wine-cellar'
        });
      }
    }
  }

  async adjustCellarTemperature(cellarId) {
    const cellar = this.cellars.get(cellarId);
    if (!cellar) return;
    
    const climate = cellar.climate;
    const target = climate.temperature.target;
    const current = climate.temperature.current;
    
    // Gradually adjust towards target
    if (current < target) {
      climate.temperature.current += 0.2;
    } else if (current > target) {
      climate.temperature.current -= 0.2;
    }
    
    await this.saveSettings();
  }

  async adjustCellarHumidity(cellarId) {
    const cellar = this.cellars.get(cellarId);
    if (!cellar) return;
    
    const climate = cellar.climate;
    const target = climate.humidity.target;
    const current = climate.humidity.current;
    
    // Gradually adjust towards target
    if (current < target) {
      climate.humidity.current += 1;
    } else if (current > target) {
      climate.humidity.current -= 1;
    }
    
    await this.saveSettings();
  }

  async checkAgingStatus() {
    const currentYear = new Date().getFullYear();
    
    for (const wine of this.wines.values()) {
      const aging = wine.aging;
      
      // Update aging status
      if (currentYear < aging.peakDrinkingStart) {
        aging.status = 'aging-well';
      } else if (currentYear >= aging.peakDrinkingStart && currentYear <= aging.peakDrinkingEnd) {
        aging.status = 'ready-to-drink';
        
        // Notify once when wine reaches peak
        if (!aging.peakNotificationSent && currentYear === aging.peakDrinkingStart) {
          aging.peakNotificationSent = true;
          this.emit('notification', {
            title: 'Vin redo att dricka',
            message: `${wine.name} (${wine.vintage}) har nått optimal dryckmognad!`,
            priority: 'normal',
            category: 'wine-aging'
          });
        }
      } else if (currentYear > aging.peakDrinkingEnd) {
        aging.status = 'drink-soon';
        
        // Alert if wine is past peak
        if (!aging.pastPeakNotificationSent) {
          aging.pastPeakNotificationSent = true;
          this.emit('notification', {
            title: 'Vin varning',
            message: `${wine.name} (${wine.vintage}) är förbi optimal dryckmognad`,
            priority: 'high',
            category: 'wine-aging'
          });
        }
      }
    }
    
    await this.saveSettings();
  }

  async addWine(wineData) {
    const wineId = `wine-${String(Date.now()).slice(-6)}`;
    
    const wine = {
      id: wineId,
      name: wineData.name,
      producer: wineData.producer,
      country: wineData.country,
      region: wineData.region,
      vintage: wineData.vintage,
      type: wineData.type,
      varietal: wineData.varietal,
      alcoholContent: wineData.alcoholContent,
      bottleSize: wineData.bottleSize || 750,
      quantity: wineData.quantity || 1,
      storage: wineData.storage,
      purchase: wineData.purchase,
      aging: {
        peakDrinkingStart: wineData.peakDrinkingStart,
        peakDrinkingEnd: wineData.peakDrinkingEnd,
        status: 'aging-well',
        daysSincePurchase: 0
      },
      ratings: wineData.ratings || {},
      characteristics: wineData.characteristics || {},
      pairings: wineData.pairings || [],
      notes: wineData.notes || ''
    };
    
    this.wines.set(wineId, wine);
    
    // Update cellar occupancy
    const cellar = this.cellars.get(wine.storage.cellarId);
    if (cellar) {
      cellar.occupied += wine.quantity;
      const section = cellar.sections.find(s => s.id === wine.storage.section);
      if (section) {
        section.occupied += wine.quantity;
      }
    }
    
    await this.saveSettings();
    
    this.emit('notification', {
      title: 'Vin tillagt',
      message: `${wine.name} (${wine.vintage}) har lagts till i samlingen`,
      priority: 'low',
      category: 'wine-collection'
    });
    
    return wine;
  }

  async removeWine(wineId, quantity = 1) {
    const wine = this.wines.get(wineId);
    if (!wine) {
      throw new Error('Vinet hittades inte');
    }
    
    if (quantity > wine.quantity) {
      throw new Error('Inte tillräckligt många flaskor');
    }
    
    wine.quantity -= quantity;
    
    // Update cellar occupancy
    const cellar = this.cellars.get(wine.storage.cellarId);
    if (cellar) {
      cellar.occupied -= quantity;
      const section = cellar.sections.find(s => s.id === wine.storage.section);
      if (section) {
        section.occupied -= quantity;
      }
    }
    
    if (wine.quantity === 0) {
      this.wines.delete(wineId);
    }
    
    await this.saveSettings();
    
    return { wine, removedQuantity: quantity };
  }

  async addTastingNote(wineId, note) {
    const wine = this.wines.get(wineId);
    if (!wine) {
      throw new Error('Vinet hittades inte');
    }
    
    const tastingNote = {
      id: `note-${Date.now()}`,
      wineId,
      wineName: wine.name,
      vintage: wine.vintage,
      date: new Date().toISOString(),
      rating: note.rating,
      appearance: note.appearance || '',
      nose: note.nose || '',
      palate: note.palate || '',
      finish: note.finish || '',
      overall: note.overall || '',
      occasion: note.occasion || '',
      pairings: note.pairings || []
    };
    
    this.tastingNotes.push(tastingNote);
    
    // Update personal rating
    if (note.rating) {
      wine.ratings.personal = note.rating;
    }
    
    await this.saveSettings();
    
    return tastingNote;
  }

  async getWineRecommendation(criteria) {
    let wines = Array.from(this.wines.values()).filter(w => w.quantity > 0);
    
    // Filter by type
    if (criteria.type) {
      wines = wines.filter(w => w.type === criteria.type);
    }
    
    // Filter by occasion
    if (criteria.occasion) {
      if (criteria.occasion === 'special') {
        wines = wines.filter(w => w.purchase.price > 300);
      } else if (criteria.occasion === 'casual') {
        wines = wines.filter(w => w.purchase.price <= 200);
      }
    }
    
    // Filter by pairing
    if (criteria.pairing) {
      wines = wines.filter(w => w.pairings.includes(criteria.pairing));
    }
    
    // Filter by readiness
    wines = wines.filter(w => 
      w.aging.status === 'ready-to-drink' || 
      w.aging.status === 'drink-soon'
    );
    
    if (wines.length === 0) {
      return null;
    }
    
    // Sort by rating and readiness
    wines.sort((a, b) => {
      const ratingA = a.ratings.personal || a.ratings.parkerPoints || 0;
      const ratingB = b.ratings.personal || b.ratings.parkerPoints || 0;
      return ratingB - ratingA;
    });
    
    return wines[0];
  }

  getWines(filters = {}) {
    let wines = Array.from(this.wines.values());
    
    if (filters.type) {
      wines = wines.filter(w => w.type === filters.type);
    }
    
    if (filters.country) {
      wines = wines.filter(w => w.country === filters.country);
    }
    
    if (filters.status) {
      wines = wines.filter(w => w.aging.status === filters.status);
    }
    
    if (filters.cellarId) {
      wines = wines.filter(w => w.storage.cellarId === filters.cellarId);
    }
    
    return wines;
  }

  getCellars() {
    return Array.from(this.cellars.values());
  }

  getCellar(cellarId) {
    return this.cellars.get(cellarId);
  }

  getTastingNotes(wineId = null, limit = 20) {
    let notes = this.tastingNotes;
    
    if (wineId) {
      notes = notes.filter(n => n.wineId === wineId);
    }
    
    return notes.slice(-limit).reverse();
  }

  getStats() {
    const wines = Array.from(this.wines.values());
    const totalBottles = wines.reduce((sum, w) => sum + w.quantity, 0);
    const totalValue = wines.reduce((sum, w) => sum + (w.purchase.price * w.quantity), 0);
    
    const byType = {
      red: wines.filter(w => w.type === 'red').reduce((sum, w) => sum + w.quantity, 0),
      white: wines.filter(w => w.type === 'white').reduce((sum, w) => sum + w.quantity, 0),
      sparkling: wines.filter(w => w.type === 'sparkling').reduce((sum, w) => sum + w.quantity, 0),
      rosé: wines.filter(w => w.type === 'rosé').reduce((sum, w) => sum + w.quantity, 0)
    };
    
    const byStatus = {
      aging: wines.filter(w => w.aging.status === 'aging-well').reduce((sum, w) => sum + w.quantity, 0),
      ready: wines.filter(w => w.aging.status === 'ready-to-drink').reduce((sum, w) => sum + w.quantity, 0),
      drinkSoon: wines.filter(w => w.aging.status === 'drink-soon').reduce((sum, w) => sum + w.quantity, 0)
    };
    
    return {
      totalWines: wines.length,
      totalBottles,
      totalValue,
      averageBottleValue: Math.round(totalValue / totalBottles),
      byType,
      byStatus,
      cellars: this.cellars.size,
      tastingNotes: this.tastingNotes.length
    };
  }

  async destroy() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    this.removeAllListeners();
  }
}

module.exports = WineCellarManagementSystem;
