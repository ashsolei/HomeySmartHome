'use strict';
const logger = require('./logger');

/**
 * Dynamic Energy Price Optimizer
 * Optimizes energy usage based on real-time electricity prices
 */
class EnergyPriceOptimizer {
  constructor() {
    this._intervals = [];
    this.priceData = {
      current: null,
      today: [],
      tomorrow: [],
      lastUpdate: 0
    };
    this.updateInterval = 60 * 60 * 1000; // 1 hour
    this.optimizationStrategies = new Map();
  }

  async initialize() {
    await this.updatePriceData();
    
    // Auto-refresh hourly
    this._intervals.push(setInterval(() => {
      this.updatePriceData();
    }, this.updateInterval));

    // Initialize optimization strategies
    this.initializeStrategies();
  }

  // ============================================
  // PRICE DATA FETCHING
  // ============================================

  async updatePriceData() {
    try {
      const prices = await this.fetchElectricityPrices();
      this.priceData = {
        current: this.getCurrentPrice(prices),
        today: prices.today || [],
        tomorrow: prices.tomorrow || [],
        lastUpdate: Date.now()
      };

      // Trigger optimization check
      await this.checkOptimizationOpportunities();

      return this.priceData;
    } catch (error) {
      logger.error('Price update error:', error);
      return this.getDefaultPrices();
    }
  }

  async fetchElectricityPrices() {
    // Integration with electricity price APIs (Nordpool, Tibber, etc.)
    // For demo, return realistic Swedish electricity prices
    
    const now = new Date();
    const todayPrices = this.generateRealisticPrices(now);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowPrices = this.generateRealisticPrices(tomorrow);

    return {
      today: todayPrices,
      tomorrow: tomorrowPrices,
      currency: 'SEK',
      unit: 'öre/kWh'
    };
  }

  generateRealisticPrices(date) {
    const prices = [];
    const basePrice = 150; // öre/kWh
    
    for (let hour = 0; hour < 24; hour++) {
      let price = basePrice;
      
      // Morning peak (6-9)
      if (hour >= 6 && hour <= 9) {
        price += 40 + Math.random() * 20;
      }
      // Evening peak (17-21)
      else if (hour >= 17 && hour <= 21) {
        price += 50 + Math.random() * 30;
      }
      // Night (22-6)
      else if (hour >= 22 || hour <= 6) {
        price -= 30 + Math.random() * 20;
      }
      // Day (10-16)
      else {
        price += Math.random() * 20 - 10;
      }

      const timestamp = new Date(date);
      timestamp.setHours(hour, 0, 0, 0);

      prices.push({
        hour,
        timestamp,
        price: Math.max(50, Math.round(price)), // Min 50 öre
        priceLevel: this.getPriceLevel(price, basePrice)
      });
    }

    return prices;
  }

  getCurrentPrice(prices) {
    const now = new Date();
    const currentHour = now.getHours();
    
    const priceData = prices.today.find(p => p.hour === currentHour);
    return priceData || { hour: currentHour, price: 150, priceLevel: 'normal' };
  }

  getPriceLevel(price, basePrice) {
    const diff = price - basePrice;
    
    if (diff > 50) return 'very_high';
    if (diff > 25) return 'high';
    if (diff < -25) return 'very_low';
    if (diff < -10) return 'low';
    return 'normal';
  }

  // ============================================
  // OPTIMIZATION STRATEGIES
  // ============================================

  initializeStrategies() {
    // Heating optimization
    this.optimizationStrategies.set('heating', {
      name: 'Smart Heating',
      description: 'Optimize heating based on electricity prices',
      priority: 'high',
      execute: async (context) => await this.optimizeHeating(context)
    });

    // Hot water optimization
    this.optimizationStrategies.set('hot_water', {
      name: 'Hot Water Scheduling',
      description: 'Heat water during low-price hours',
      priority: 'high',
      execute: async (context) => await this.optimizeHotWater(context)
    });

    // Charging optimization (EV, batteries)
    this.optimizationStrategies.set('charging', {
      name: 'Smart Charging',
      description: 'Charge devices during cheapest hours',
      priority: 'medium',
      execute: async (context) => await this.optimizeCharging(context)
    });

    // Load shifting
    this.optimizationStrategies.set('load_shift', {
      name: 'Load Shifting',
      description: 'Move flexible loads to cheaper hours',
      priority: 'medium',
      execute: async (context) => await this.optimizeLoadShifting(context)
    });

    // Appliance scheduling
    this.optimizationStrategies.set('appliances', {
      name: 'Appliance Scheduling',
      description: 'Run dishwasher, washing machine at optimal times',
      priority: 'low',
      execute: async (context) => await this.optimizeAppliances(context)
    });
  }

  async optimizeHeating(_context) {
    const recommendations = [];
    const prices = this.priceData.today;
    const currentPrice = this.priceData.current;

    // Find cheapest hours in next 12 hours
    const nextHours = prices.filter(p => 
      p.hour >= currentPrice.hour && p.hour < currentPrice.hour + 12
    );
    const cheapestHours = nextHours
      .sort((a, b) => a.price - b.price)
      .slice(0, 4);

    // If current price is high, consider pre-heating during cheap hours
    if (currentPrice.priceLevel === 'high' || currentPrice.priceLevel === 'very_high') {
      const nextCheapHour = cheapestHours[0];
      
      recommendations.push({
        action: 'preheat',
        description: 'Förvärm hemmet under billigare timmar',
        targetHours: cheapestHours.map(h => h.hour),
        currentPrice: currentPrice.price,
        targetPrice: nextCheapHour.price,
        savings: Math.round((currentPrice.price - nextCheapHour.price) * 2.5), // SEK/kWh estimate
        priority: 'high'
      });
    }

    // If next hours are expensive, heat extra now
    const nextExpensiveHours = nextHours.filter(p => 
      p.priceLevel === 'high' || p.priceLevel === 'very_high'
    );

    if (nextExpensiveHours.length > 3 && currentPrice.priceLevel !== 'high') {
      recommendations.push({
        action: 'heat_now',
        description: 'Höj temperaturen nu innan dyrare perioden',
        targetTemp: 22,
        expensiveHours: nextExpensiveHours.map(h => h.hour),
        savings: 35,
        priority: 'medium'
      });
    }

    return recommendations;
  }

  async optimizeHotWater(_context) {
    const recommendations = [];
    const prices = this.priceData.today.concat(this.priceData.tomorrow);
    
    // Find the 3 cheapest consecutive hours in next 24h
    let cheapestPeriod = { hours: [], avgPrice: Infinity };
    
    for (let i = 0; i < prices.length - 2; i++) {
      const period = prices.slice(i, i + 3);
      const avgPrice = period.reduce((sum, p) => sum + p.price, 0) / 3;
      
      if (avgPrice < cheapestPeriod.avgPrice) {
        cheapestPeriod = {
          hours: period.map(p => p.hour),
          avgPrice,
          startTime: period[0].timestamp
        };
      }
    }

    recommendations.push({
      action: 'schedule_heating',
      description: 'Värm vatten under billigaste timmarna',
      scheduledHours: cheapestPeriod.hours,
      startTime: cheapestPeriod.startTime,
      avgPrice: Math.round(cheapestPeriod.avgPrice),
      savings: 25, // SEK/day
      priority: 'high'
    });

    return recommendations;
  }

  async optimizeCharging(_context) {
    const recommendations = [];
    const allPrices = this.priceData.today.concat(this.priceData.tomorrow);
    
    // Find cheapest 6-hour period for overnight charging
    const nightHours = allPrices.filter(p => 
      p.hour >= 22 || p.hour <= 6
    );

    const cheapestNightHours = nightHours
      .sort((a, b) => a.price - b.price)
      .slice(0, 6);

    if (cheapestNightHours.length > 0) {
      recommendations.push({
        action: 'schedule_charging',
        description: 'Ladda fordon/batterier under billigaste nattetimmarna',
        scheduledHours: cheapestNightHours.map(h => h.hour).sort(),
        avgPrice: Math.round(
          cheapestNightHours.reduce((sum, h) => sum + h.price, 0) / cheapestNightHours.length
        ),
        savings: 45, // SEK/charge
        priority: 'high'
      });
    }

    return recommendations;
  }

  async optimizeLoadShifting(_context) {
    const recommendations = [];
    const currentPrice = this.priceData.current;
    const todayPrices = this.priceData.today;

    // Calculate price percentiles
    const sortedPrices = [...todayPrices].sort((a, b) => a.price - b.price);
    const p75 = sortedPrices[Math.floor(sortedPrices.length * 0.75)]?.price || 0;

    // If current price is in top 25%, suggest deferring loads
    if (currentPrice.price >= p75) {
      const cheaperHours = todayPrices.filter(p => 
        p.hour > currentPrice.hour && p.price < currentPrice.price * 0.8
      );

      if (cheaperHours.length > 0) {
        recommendations.push({
          action: 'defer_loads',
          description: 'Skjut upp flexibla laster till billigare timmar',
          currentPrice: currentPrice.price,
          betterHours: cheaperHours.slice(0, 3).map(h => ({
            hour: h.hour,
            price: h.price,
            savings: currentPrice.price - h.price
          })),
          priority: 'medium'
        });
      }
    }

    return recommendations;
  }

  async optimizeAppliances(_context) {
    const recommendations = [];
    const allPrices = this.priceData.today.concat(this.priceData.tomorrow);
    
    // Find cheapest 2-hour slots for appliances
    const cheapestSlots = [];
    
    for (let i = 0; i < allPrices.length - 1; i++) {
      const slot = allPrices.slice(i, i + 2);
      const avgPrice = slot.reduce((sum, p) => sum + p.price, 0) / 2;
      
      cheapestSlots.push({
        startHour: slot[0].hour,
        startTime: slot[0].timestamp,
        avgPrice
      });
    }

    cheapestSlots.sort((a, b) => a.avgPrice - b.avgPrice);

    recommendations.push({
      action: 'schedule_appliances',
      description: 'Kör vitvaror under billigaste timmarna',
      dishwasher: {
        bestTime: cheapestSlots[0].startTime,
        hour: cheapestSlots[0].startHour,
        price: Math.round(cheapestSlots[0].avgPrice),
        savings: 8
      },
      washingMachine: {
        bestTime: cheapestSlots[1].startTime,
        hour: cheapestSlots[1].startHour,
        price: Math.round(cheapestSlots[1].avgPrice),
        savings: 12
      },
      priority: 'low'
    });

    return recommendations;
  }

  // ============================================
  // OPTIMIZATION EXECUTION
  // ============================================

  async checkOptimizationOpportunities() {
    const opportunities = [];
    const context = {
      prices: this.priceData,
      timestamp: Date.now()
    };

    for (const [key, strategy] of this.optimizationStrategies) {
      try {
        const results = await strategy.execute(context);
        
        if (results && results.length > 0) {
          opportunities.push({
            strategy: key,
            name: strategy.name,
            description: strategy.description,
            priority: strategy.priority,
            recommendations: results
          });
        }
      } catch (error) {
        logger.error(`Strategy ${key} error:`, error);
      }
    }

    return opportunities;
  }

  async getOptimizationPlan(hours = 24) {
    const opportunities = await this.checkOptimizationOpportunities();
    const allPrices = this.priceData.today.concat(this.priceData.tomorrow);
    const relevantPrices = allPrices.slice(0, hours);

    // Calculate potential savings
    const totalSavings = opportunities.reduce((sum, opp) => {
      return sum + opp.recommendations.reduce((s, r) => s + (r.savings || 0), 0);
    }, 0);

    return {
      period: `${hours} timmar`,
      opportunities,
      totalSavings: Math.round(totalSavings),
      priceOverview: {
        current: this.priceData.current,
        highest: relevantPrices.reduce((max, p) => p.price > max.price ? p : max),
        lowest: relevantPrices.reduce((min, p) => p.price < min.price ? p : min),
        average: Math.round(
          relevantPrices.reduce((sum, p) => sum + p.price, 0) / relevantPrices.length
        )
      }
    };
  }

  // ============================================
  // AUTOMATION SUGGESTIONS
  // ============================================

  async generatePriceBasedAutomations() {
    const automations = [];

    // Auto-adjust heating based on price
    automations.push({
      name: 'Prisbaserad Värmereglering',
      description: 'Justera värme automatiskt baserat på elpris',
      trigger: {
        type: 'price',
        condition: 'below',
        threshold: 120 // öre/kWh
      },
      actions: [
        {
          type: 'heating',
          action: 'increase',
          value: 1 // +1°C
        }
      ],
      estimatedSavings: 150 // SEK/månad
    });

    automations.push({
      name: 'Undvik Topppriser',
      description: 'Sänk förbrukning under dyraste timmarna',
      trigger: {
        type: 'price',
        condition: 'above',
        threshold: 200 // öre/kWh
      },
      actions: [
        {
          type: 'heating',
          action: 'decrease',
          value: 1
        },
        {
          type: 'notification',
          message: 'Högt elpris - begränsar förbrukning'
        }
      ],
      estimatedSavings: 200
    });

    // Smart charging schedule
    automations.push({
      name: 'Smart Laddning',
      description: 'Ladda under billigaste timmarna',
      trigger: {
        type: 'schedule',
        time: 'cheapest_night_hours'
      },
      actions: [
        {
          type: 'charging',
          action: 'start'
        }
      ],
      estimatedSavings: 350
    });

    return automations;
  }

  // ============================================
  // ANALYTICS & REPORTING
  // ============================================

  async calculateSavings(actualConsumption, optimizedConsumption) {
    const savings = {
      energy: 0, // kWh
      cost: 0,   // SEK
      percentage: 0
    };

    for (let hour = 0; hour < 24; hour++) {
      const priceData = this.priceData.today[hour];
      if (!priceData) continue;

      const actual = actualConsumption[hour] || 0;
      const optimized = optimizedConsumption[hour] || 0;
      const energySaved = actual - optimized;

      savings.energy += energySaved;
      savings.cost += (energySaved * priceData.price) / 100; // Convert öre to SEK
    }

    const totalActual = actualConsumption.reduce((sum, val) => sum + val, 0);
    savings.percentage = totalActual > 0 
      ? (savings.energy / totalActual) * 100 
      : 0;

    return {
      energySaved: Math.round(savings.energy * 100) / 100,
      costSaved: Math.round(savings.cost),
      percentageSaved: Math.round(savings.percentage * 10) / 10
    };
  }

  async getPriceStatistics() {
    const today = this.priceData.today;
    
    if (today.length === 0) return null;

    const prices = today.map(p => p.price);
    
    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
      average: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
      median: this.getMedian(prices),
      variance: this.getVariance(prices),
      peakHours: today.filter(p => p.priceLevel === 'high' || p.priceLevel === 'very_high'),
      cheapHours: today.filter(p => p.priceLevel === 'low' || p.priceLevel === 'very_low')
    };
  }

  // ============================================
  // PUBLIC API
  // ============================================

  async getCurrentPriceInfo() {
    return {
      current: this.priceData.current,
      level: this.priceData.current.priceLevel,
      recommendation: this.getPriceRecommendation(this.priceData.current),
      nextCheapHour: this.getNextCheapHour(),
      statistics: await this.getPriceStatistics()
    };
  }

  getPriceRecommendation(priceData) {
    switch (priceData.priceLevel) {
      case 'very_low':
        return {
          action: 'use',
          message: 'Mycket lågt pris! Bra tid att använda energi',
          icon: '💚',
          priority: 'low'
        };
      case 'low':
        return {
          action: 'use',
          message: 'Lågt pris. Bra tillfälle för energikrävande aktiviteter',
          icon: '💚',
          priority: 'low'
        };
      case 'normal':
        return {
          action: 'normal',
          message: 'Normalt pris',
          icon: '💛',
          priority: 'normal'
        };
      case 'high':
        return {
          action: 'reduce',
          message: 'Högt pris. Överväg att skjuta upp energikrävande aktiviteter',
          icon: '🧡',
          priority: 'medium'
        };
      case 'very_high':
        return {
          action: 'avoid',
          message: 'Mycket högt pris! Minimera energiförbrukning',
          icon: '❤️',
          priority: 'high'
        };
      default:
        return {
          action: 'normal',
          message: 'Okänt pris',
          icon: '❓',
          priority: 'normal'
        };
    }
  }

  getNextCheapHour() {
    const currentHour = new Date().getHours();
    const upcomingHours = this.priceData.today.filter(p => p.hour > currentHour);
    
    if (upcomingHours.length === 0) return null;

    const cheapHours = upcomingHours.filter(p => 
      p.priceLevel === 'low' || p.priceLevel === 'very_low'
    );

    return cheapHours.length > 0 ? cheapHours[0] : null;
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  getMedian(arr) {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2 
      : sorted[mid];
  }

  getVariance(arr) {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance = arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
    return Math.round(variance);
  }

  getDefaultPrices() {
    const now = new Date();
    return {
      current: { hour: now.getHours(), price: 150, priceLevel: 'normal' },
      today: this.generateRealisticPrices(now),
      tomorrow: [],
      lastUpdate: Date.now()
    };
  }

  destroy() {
    if (this._intervals) {
      this._intervals.forEach(id => clearInterval(id));
      this._intervals = [];
    }
  }
}

module.exports = EnergyPriceOptimizer;
