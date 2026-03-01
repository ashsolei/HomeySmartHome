'use strict';
const logger = require('./logger');
const MAX_ENTRIES = 1000;

/**
 * Sustainability & Carbon Tracker
 * Household environmental impact tracking
 */
class SustainabilityCarbonTracker {
  constructor(app) {
    this._intervals = [];
    this.app = app;
    this.energyData = [];
    this.waterData = [];
    this.wasteData = [];
    this.transportData = [];
    this.carbonFootprint = {
      daily: 0,
      monthly: 0,
      yearly: 0
    };
    this.goals = new Map();
    this.achievements = [];
    this.recommendations = [];
  }

  async initialize() {
    await this.setupGoals();
    await this.loadHistoricalData();
    
    this.startMonitoring();
  }

  // ============================================
  // CARBON CALCULATIONS
  // ============================================

  calculateElectricityCarbon(kwh, source = 'grid') {
    // Carbon intensity (kg CO2e per kWh)
    const carbonIntensity = {
      grid: 0.041,      // Swedish grid (very clean)
      solar: 0.005,     // Solar production
      wind: 0.003,      // Wind production
      hydro: 0.002,     // Hydro production
      battery: 0.041    // Assumes grid charged
    };

    return kwh * carbonIntensity[source];
  }

  calculateHeatingCarbon(kwh, source = 'district') {
    // Carbon intensity for heating
    const heatingIntensity = {
      district: 0.050,   // District heating (Swedish average)
      electric: 0.041,   // Electric heating
      heatpump: 0.015,   // Heat pump (COP 3)
      gas: 0.200,        // Natural gas
      oil: 0.280         // Heating oil
    };

    return kwh * (heatingIntensity[source] || 0.050);
  }

  calculateWaterCarbon(liters) {
    // Water treatment and delivery: ~0.3 kg CO2e per m³
    const m3 = liters / 1000;
    return m3 * 0.3;
  }

  calculateWasteCarbon(kg, type = 'mixed') {
    // Carbon impact per kg of waste
    const wasteIntensity = {
      mixed: 0.5,       // Mixed waste to incineration
      recycling: -0.2,  // Recycling saves emissions
      compost: -0.1,    // Composting saves emissions
      electronic: 0.8,  // E-waste
      hazardous: 1.0    // Hazardous waste
    };

    return kg * (wasteIntensity[type] || 0.5);
  }

  calculateTransportCarbon(km, vehicle = 'ev') {
    // Carbon per km
    const transportIntensity = {
      ev: 0.005,        // Electric vehicle (Swedish grid)
      phev: 0.050,      // Plug-in hybrid (mixed)
      ice: 0.120,       // Petrol car
      diesel: 0.110,    // Diesel car
      bus: 0.080,       // Public bus
      train: 0.004,     // Train (electric)
      bike: 0.000,      // Bicycle
      walk: 0.000       // Walking
    };

    return km * (transportIntensity[vehicle] || 0.120);
  }

  calculateFoodCarbon(category, kg) {
    // Carbon intensity per kg of food
    const foodIntensity = {
      beef: 27.0,
      lamb: 24.0,
      pork: 7.0,
      chicken: 5.7,
      fish: 5.0,
      dairy: 3.2,
      eggs: 4.5,
      vegetables: 0.4,
      fruits: 0.5,
      grains: 0.9,
      legumes: 0.4
    };

    return kg * (foodIntensity[category] || 2.0);
  }

  // ============================================
  // DATA TRACKING
  // ============================================

  async loadHistoricalData() {
    // Simulate 30 days of data
    const now = Date.now();

    for (let day = 30; day >= 0; day--) {
      const date = now - day * 24 * 60 * 60 * 1000;

      // Energy data
      this.energyData.push({
        timestamp: date,
        electricity: {
          grid: 15 + Math.random() * 10,        // kWh
          solar: 8 + Math.random() * 12,        // kWh
          battery: 3 + Math.random() * 5,       // kWh
          total: 26 + Math.random() * 15
        },
        heating: {
          source: 'district',
          kwh: 30 + Math.random() * 20
        },
        carbon: 0 // Will be calculated
      });
      if (this.energyData.length > MAX_ENTRIES) this.energyData.shift();

      // Water data
      this.waterData.push({
        timestamp: date,
        consumption: 300 + Math.random() * 150,  // liters
        hotWater: 100 + Math.random() * 50,
        carbon: 0
      });
      if (this.waterData.length > MAX_ENTRIES) this.waterData.shift();

      // Waste data
      this.wasteData.push({
        timestamp: date,
        mixed: 0.5 + Math.random() * 1.5,        // kg
        recycling: 0.3 + Math.random() * 1.0,
        compost: 0.4 + Math.random() * 0.8,
        carbon: 0
      });
      if (this.wasteData.length > MAX_ENTRIES) this.wasteData.shift();

      // Transport data
      this.transportData.push({
        timestamp: date,
        trips: [
          { distance: 25 + Math.random() * 15, vehicle: 'ev' },
          { distance: 5 + Math.random() * 5, vehicle: 'walk' },
          { distance: 3 + Math.random() * 3, vehicle: 'bike' }
        ],
        carbon: 0
      });
      if (this.transportData.length > MAX_ENTRIES) this.transportData.shift();
    }

    // Calculate carbon for all historical data
    this.recalculateCarbon();
  }

  recalculateCarbon() {
    // Energy carbon
    for (const entry of this.energyData) {
      let carbon = 0;
      carbon += this.calculateElectricityCarbon(entry.electricity.grid, 'grid');
      carbon += this.calculateElectricityCarbon(entry.electricity.solar, 'solar');
      carbon += this.calculateElectricityCarbon(entry.electricity.battery, 'battery');
      carbon += this.calculateHeatingCarbon(entry.heating.kwh, entry.heating.source);
      entry.carbon = carbon;
    }

    // Water carbon
    for (const entry of this.waterData) {
      entry.carbon = this.calculateWaterCarbon(entry.consumption);
    }

    // Waste carbon
    for (const entry of this.wasteData) {
      let carbon = 0;
      carbon += this.calculateWasteCarbon(entry.mixed, 'mixed');
      carbon += this.calculateWasteCarbon(entry.recycling, 'recycling');
      carbon += this.calculateWasteCarbon(entry.compost, 'compost');
      entry.carbon = carbon;
    }

    // Transport carbon
    for (const entry of this.transportData) {
      let carbon = 0;
      for (const trip of entry.trips) {
        carbon += this.calculateTransportCarbon(trip.distance, trip.vehicle);
      }
      entry.carbon = carbon;
    }
  }

  async addEnergyData(data) {
    const entry = {
      timestamp: Date.now(),
      electricity: data.electricity,
      heating: data.heating,
      carbon: 0
    };

    // Calculate carbon
    entry.carbon += this.calculateElectricityCarbon(data.electricity.grid, 'grid');
    entry.carbon += this.calculateElectricityCarbon(data.electricity.solar, 'solar');
    entry.carbon += this.calculateElectricityCarbon(data.electricity.battery, 'battery');
    entry.carbon += this.calculateHeatingCarbon(data.heating.kwh, data.heating.source);

    this.energyData.push(entry);
    if (this.energyData.length > MAX_ENTRIES) this.energyData.shift();

    return entry;
  }

  async addTransportTrip(distance, vehicle) {
    const today = this.transportData[this.transportData.length - 1];
    
    if (today && this.isToday(today.timestamp)) {
      today.trips.push({ distance, vehicle });
      today.carbon += this.calculateTransportCarbon(distance, vehicle);
    } else {
      const entry = {
        timestamp: Date.now(),
        trips: [{ distance, vehicle }],
        carbon: this.calculateTransportCarbon(distance, vehicle)
      };
      this.transportData.push(entry);
    if (this.transportData.length > MAX_ENTRIES) this.transportData.shift();
    }

    logger.info(`🚗 Trip: ${distance} km by ${vehicle} (${this.calculateTransportCarbon(distance, vehicle).toFixed(2)} kg CO2e)`);
  }

  isToday(timestamp) {
    const date = new Date(timestamp);
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  }

  // ============================================
  // CARBON FOOTPRINT ANALYSIS
  // ============================================

  async calculateFootprint(period = 'daily') {
    const now = Date.now();
    let startDate;

    if (period === 'daily') {
      startDate = now - 24 * 60 * 60 * 1000;
    } else if (period === 'monthly') {
      startDate = now - 30 * 24 * 60 * 60 * 1000;
    } else if (period === 'yearly') {
      startDate = now - 365 * 24 * 60 * 60 * 1000;
    }

    const energy = this.energyData
      .filter(e => e.timestamp >= startDate)
      .reduce((sum, e) => sum + e.carbon, 0);

    const water = this.waterData
      .filter(w => w.timestamp >= startDate)
      .reduce((sum, w) => sum + w.carbon, 0);

    const waste = this.wasteData
      .filter(w => w.timestamp >= startDate)
      .reduce((sum, w) => sum + w.carbon, 0);

    const transport = this.transportData
      .filter(t => t.timestamp >= startDate)
      .reduce((sum, t) => sum + t.carbon, 0);

    const total = energy + water + waste + transport;

    return {
      period,
      total: total.toFixed(2),
      breakdown: {
        energy: energy.toFixed(2),
        water: water.toFixed(2),
        waste: waste.toFixed(2),
        transport: transport.toFixed(2)
      },
      percentages: {
        energy: ((energy / total) * 100).toFixed(1),
        water: ((water / total) * 100).toFixed(1),
        waste: ((waste / total) * 100).toFixed(1),
        transport: ((transport / total) * 100).toFixed(1)
      }
    };
  }

  async calculateDailyAverage() {
    const daily = await this.calculateFootprint('daily');
    return parseFloat(daily.total);
  }

  async getYearlyProjection() {
    const dailyAvg = await this.calculateDailyAverage();
    const yearlyProjection = dailyAvg * 365;

    // Swedish average household: ~6000 kg CO2e/year
    const swedishAverage = 6000;
    const comparison = ((yearlyProjection / swedishAverage) * 100).toFixed(0);

    return {
      projection: yearlyProjection.toFixed(0),
      dailyAverage: dailyAvg.toFixed(2),
      swedishAverage,
      comparisonPercent: comparison,
      status: comparison < 80 ? 'excellent' :
              comparison < 100 ? 'good' :
              comparison < 120 ? 'average' : 'above average'
    };
  }

  // ============================================
  // RENEWABLE ENERGY TRACKING
  // ============================================

  async getRenewableEnergyStats(days = 30) {
    const startDate = Date.now() - days * 24 * 60 * 60 * 1000;
    const relevantData = this.energyData.filter(e => e.timestamp >= startDate);

    let totalConsumption = 0;
    let renewableProduction = 0;
    let gridConsumption = 0;

    for (const entry of relevantData) {
      totalConsumption += entry.electricity.total;
      renewableProduction += entry.electricity.solar;
      gridConsumption += entry.electricity.grid;
    }

    const selfSufficiency = (renewableProduction / totalConsumption) * 100;
    const gridDependency = (gridConsumption / totalConsumption) * 100;

    return {
      period: `${days} days`,
      totalConsumption: totalConsumption.toFixed(1),
      renewableProduction: renewableProduction.toFixed(1),
      gridConsumption: gridConsumption.toFixed(1),
      selfSufficiency: selfSufficiency.toFixed(1),
      gridDependency: gridDependency.toFixed(1),
      status: selfSufficiency > 60 ? 'excellent' :
              selfSufficiency > 40 ? 'good' :
              selfSufficiency > 20 ? 'fair' : 'poor'
    };
  }

  // ============================================
  // SUSTAINABILITY GOALS
  // ============================================

  async setupGoals() {
    const goalsData = [
      {
        id: 'carbon_reduction',
        name: 'Minska CO2-utsläpp',
        category: 'carbon',
        target: 5000,           // kg CO2e per year
        currentValue: 6500,
        unit: 'kg CO2e/year',
        deadline: Date.now() + 365 * 24 * 60 * 60 * 1000,
        priority: 'high'
      },
      {
        id: 'renewable_energy',
        name: 'Förnybar energi',
        category: 'energy',
        target: 70,             // % self-sufficiency
        currentValue: 35,
        unit: '%',
        deadline: Date.now() + 365 * 24 * 60 * 60 * 1000,
        priority: 'high'
      },
      {
        id: 'water_reduction',
        name: 'Minska vattenförbrukning',
        category: 'water',
        target: 250,            // liters per day
        currentValue: 400,
        unit: 'liters/day',
        deadline: Date.now() + 180 * 24 * 60 * 60 * 1000,
        priority: 'medium'
      },
      {
        id: 'waste_reduction',
        name: 'Minska restavfall',
        category: 'waste',
        target: 0.5,            // kg per day
        currentValue: 1.2,
        unit: 'kg/day',
        deadline: Date.now() + 180 * 24 * 60 * 60 * 1000,
        priority: 'medium'
      },
      {
        id: 'recycling_rate',
        name: 'Öka återvinning',
        category: 'waste',
        target: 80,             // %
        currentValue: 45,
        unit: '%',
        deadline: Date.now() + 180 * 24 * 60 * 60 * 1000,
        priority: 'low'
      }
    ];

    for (const goal of goalsData) {
      this.goals.set(goal.id, {
        ...goal,
        progress: ((goal.currentValue / goal.target) * 100).toFixed(1),
        daysRemaining: Math.ceil((goal.deadline - Date.now()) / (24 * 60 * 60 * 1000))
      });
    }
  }

  async updateGoalProgress(goalId, newValue) {
    const goal = this.goals.get(goalId);
    
    if (!goal) {
      return { success: false, error: 'Goal not found' };
    }

    const oldValue = goal.currentValue;
    goal.currentValue = newValue;
    goal.progress = ((newValue / goal.target) * 100).toFixed(1);

    // Check if goal achieved
    if (newValue >= goal.target && oldValue < goal.target) {
      this.achievements.push({
        id: `achievement_${Date.now()}`,
        goalId,
        goalName: goal.name,
        achievedDate: Date.now(),
        value: newValue
      });
      if (this.achievements.length > MAX_ENTRIES) this.achievements.shift();

      logger.info(`🎉 Goal achieved: ${goal.name}!`);
    }

    return { success: true, goal };
  }

  // ============================================
  // RECOMMENDATIONS
  // ============================================

  async generateRecommendations() {
    const recommendations = [];

    // Analyze energy
    const renewableStats = await this.getRenewableEnergyStats(30);
    if (parseFloat(renewableStats.selfSufficiency) < 50) {
      recommendations.push({
        category: 'energy',
        priority: 'high',
        title: 'Öka solenergianvändning',
        description: 'Din solenergiproduktion täcker bara ' + renewableStats.selfSufficiency + '% av förbrukningen',
        potentialImpact: '500 kg CO2e/år',
        actions: [
          'Installera fler solpaneler',
          'Optimera batterilagring',
          'Flytta energikrävande aktiviteter till dagtid'
        ]
      });
    }

    // Analyze water
    const avgWater = this.waterData.slice(-30).reduce((sum, w) => sum + w.consumption, 0) / 30;
    if (avgWater > 350) {
      recommendations.push({
        category: 'water',
        priority: 'medium',
        title: 'Minska vattenförbrukning',
        description: `Förbrukning: ${avgWater.toFixed(0)} liter/dag (mål: 250 liter)`,
        potentialImpact: '50 kg CO2e/år',
        actions: [
          'Installera spardusch',
          'Fixa eventuella läckor',
          'Kortare duschar',
          'Använd diskmaskin effektivt'
        ]
      });
    }

    // Analyze waste
    const recentWaste = this.wasteData.slice(-30);
    const avgMixed = recentWaste.reduce((sum, w) => sum + w.mixed, 0) / 30;
    const avgRecycling = recentWaste.reduce((sum, w) => sum + w.recycling, 0) / 30;
    const recyclingRate = (avgRecycling / (avgMixed + avgRecycling)) * 100;

    if (recyclingRate < 60) {
      recommendations.push({
        category: 'waste',
        priority: 'medium',
        title: 'Förbättra återvinning',
        description: `Återvinningsgrad: ${recyclingRate.toFixed(0)}% (mål: 80%)`,
        potentialImpact: '100 kg CO2e/år',
        actions: [
          'Sortera mer noggrant',
          'Kompostera matavfall',
          'Minska förpackningar',
          'Återanvänd mer'
        ]
      });
    }

    // Analyze transport
    const recentTransport = this.transportData.slice(-30);
    let evKm = 0;
    let iceKm = 0;

    for (const day of recentTransport) {
      for (const trip of day.trips) {
        if (trip.vehicle === 'ev') evKm += trip.distance;
        else if (trip.vehicle === 'ice' || trip.vehicle === 'diesel') iceKm += trip.distance;
      }
    }

    if (iceKm > evKm * 0.2) {
      recommendations.push({
        category: 'transport',
        priority: 'high',
        title: 'Elektrifiera transport',
        description: `${iceKm.toFixed(0)} km med fossila bränslen senaste månaden`,
        potentialImpact: '800 kg CO2e/år',
        actions: [
          'Använd elbil mer',
          'Cykla kortare sträckor',
          'Samåk när möjligt',
          'Använd kollektivtrafik'
        ]
      });
    }

    this.recommendations = recommendations;

    return recommendations;
  }

  // ============================================
  // MONITORING
  // ============================================

  startMonitoring() {
    // Daily carbon calculation
    this._intervals.push(setInterval(async () => {
      this.carbonFootprint.daily = await this.calculateDailyAverage();
    }, 24 * 60 * 60 * 1000));

    // Weekly analysis
    this._intervals.push(setInterval(async () => {
      const day = new Date().getDay();
      if (day === 1) { // Monday
        await this.generateWeeklyReport();
      }
    }, 24 * 60 * 60 * 1000));

    // Monthly goals update
    this._intervals.push(setInterval(async () => {
      const date = new Date().getDate();
      if (date === 1) {
        await this.updateMonthlyGoals();
      }
    }, 24 * 60 * 60 * 1000));

    // Initial calculation
    this.calculateFootprint('daily');
  }

  async generateWeeklyReport() {
    logger.info('📊 Generating weekly sustainability report...');

    const footprint = await this.calculateFootprint('daily');
    const renewable = await this.getRenewableEnergyStats(7);
    const recommendations = await this.generateRecommendations();

    logger.info('\n=== SUSTAINABILITY REPORT ===');
    logger.info(`Total CO2: ${footprint.total} kg/day`);
    logger.info(`Renewable energy: ${renewable.selfSufficiency}%`);
    logger.info(`Recommendations: ${recommendations.length}`);
    logger.info('===========================\n');

    return {
      footprint,
      renewable,
      recommendations
    };
  }

  async updateMonthlyGoals() {
    logger.info('🎯 Updating monthly sustainability goals...');

    // Update carbon reduction goal
    const yearlyProjection = await this.getYearlyProjection();
    await this.updateGoalProgress('carbon_reduction', parseFloat(yearlyProjection.projection));

    // Update renewable energy goal
    const renewableStats = await this.getRenewableEnergyStats(30);
    await this.updateGoalProgress('renewable_energy', parseFloat(renewableStats.selfSufficiency));

    // Update water goal
    const avgWater = this.waterData.slice(-30).reduce((sum, w) => sum + w.consumption, 0) / 30;
    await this.updateGoalProgress('water_reduction', avgWater);

    // Update waste goals
    const recentWaste = this.wasteData.slice(-30);
    const avgMixed = recentWaste.reduce((sum, w) => sum + w.mixed, 0) / 30;
    await this.updateGoalProgress('waste_reduction', avgMixed);

    const avgRecycling = recentWaste.reduce((sum, w) => sum + w.recycling, 0) / 30;
    const recyclingRate = (avgRecycling / (avgMixed + avgRecycling)) * 100;
    await this.updateGoalProgress('recycling_rate', recyclingRate);
  }

  // ============================================
  // REPORTING
  // ============================================

  getSustainabilityScore() {
    let score = 100;

    // Carbon footprint (40 points)
    const dailyAvg = this.carbonFootprint.daily || 17.8; // Average
    const swedishDailyAvg = 16.4; // 6000 kg / 365 days
    
    if (dailyAvg > swedishDailyAvg * 1.3) score -= 40;
    else if (dailyAvg > swedishDailyAvg * 1.1) score -= 30;
    else if (dailyAvg > swedishDailyAvg) score -= 20;
    else if (dailyAvg > swedishDailyAvg * 0.8) score -= 10;
    else if (dailyAvg > swedishDailyAvg * 0.6) score -= 5;

    // Renewable energy (30 points)
    const renewableAvg = this.energyData.slice(-30).reduce((sum, e) => {
      return sum + (e.electricity.solar / e.electricity.total);
    }, 0) / 30;

    if (renewableAvg < 0.2) score -= 30;
    else if (renewableAvg < 0.3) score -= 20;
    else if (renewableAvg < 0.4) score -= 10;
    else if (renewableAvg < 0.5) score -= 5;

    // Recycling rate (20 points)
    const recentWaste = this.wasteData.slice(-30);
    const totalMixed = recentWaste.reduce((sum, w) => sum + w.mixed, 0);
    const totalRecycling = recentWaste.reduce((sum, w) => sum + w.recycling, 0);
    const recyclingRate = totalRecycling / (totalMixed + totalRecycling);

    if (recyclingRate < 0.3) score -= 20;
    else if (recyclingRate < 0.5) score -= 15;
    else if (recyclingRate < 0.7) score -= 10;
    else if (recyclingRate < 0.8) score -= 5;

    // Water conservation (10 points)
    const avgWater = this.waterData.slice(-30).reduce((sum, w) => sum + w.consumption, 0) / 30;
    
    if (avgWater > 450) score -= 10;
    else if (avgWater > 400) score -= 8;
    else if (avgWater > 350) score -= 5;
    else if (avgWater > 300) score -= 3;

    return {
      score: Math.max(0, Math.min(100, score)),
      rating: score >= 90 ? 'Excellent' :
              score >= 75 ? 'Good' :
              score >= 60 ? 'Average' :
              score >= 40 ? 'Below Average' : 'Poor',
      factors: {
        carbon: dailyAvg.toFixed(1),
        renewable: (renewableAvg * 100).toFixed(1),
        recycling: (recyclingRate * 100).toFixed(1),
        water: avgWater.toFixed(0)
      }
    };
  }

  getGoalsReport() {
    const goals = Array.from(this.goals.values());

    return goals.map(goal => ({
      name: goal.name,
      current: goal.currentValue,
      target: goal.target,
      unit: goal.unit,
      progress: goal.progress + '%',
      daysRemaining: goal.daysRemaining,
      status: parseFloat(goal.progress) >= 100 ? 'achieved' :
              parseFloat(goal.progress) >= 75 ? 'on-track' :
              parseFloat(goal.progress) >= 50 ? 'progressing' : 'behind'
    }));
  }

  getAchievements() {
    return this.achievements.map(a => ({
      name: a.goalName,
      date: new Date(a.achievedDate).toLocaleDateString('sv-SE'),
      value: a.value
    }));
  }

  destroy() {
    if (this._intervals) {
      this._intervals.forEach(id => clearInterval(id));
      this._intervals = [];
    }
  }
}

module.exports = SustainabilityCarbonTracker;
