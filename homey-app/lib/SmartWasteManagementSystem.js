'use strict';

class SmartWasteManagementSystem {
  constructor(homey) {
    this.homey = homey;
    this.bins = new Map();
    this.categories = new Map();
    this.collectionCalendar = new Map();
    this.wasteLog = [];
    this.compostBin = {};
    this.hazardousWasteLog = [];
    this.gamification = {};
    this.carbonFootprint = {};
    this.costEstimates = {};
    this.recyclingTargets = {};
    this.trendData = {};
    this.monitoringInterval = null;
    this.reminderInterval = null;
    this.initialized = false;
  }

  async initialize() {
    this.log('Initializing Smart Waste Management System...');
    try {
      this._initializeCategories();
      this._initializeBins();
      this._initializeCollectionCalendar();
      this._initializeCarbonFootprint();
      this._initializeCostEstimates();
      this._initializeRecyclingTargets();
      this._initializeCompostBin();
      this._initializeGamification();
      this._initializeTrendData();
      await this._discoverDevices();
      this._startMonitoring();
      this.initialized = true;
      this.log('Smart Waste Management System initialized successfully');
    } catch (err) {
      this.error('Failed to initialize Waste Management System: ' + err.message);
      throw err;
    }
  }

  _initializeCategories() {
    this.categories.set('paper', {
      id: 'paper',
      name: 'Paper & Cardboard',
      color: '#2196F3',
      icon: 'paper',
      recyclable: true,
      avgDensityKgPerLiter: 0.08,
      decompositionMonths: 2,
      tips: ['Flatten cardboard boxes', 'Remove plastic windows from envelopes', 'No greasy or soiled paper']
    });

    this.categories.set('plastic', {
      id: 'plastic',
      name: 'Plastic',
      color: '#FF9800',
      icon: 'plastic',
      recyclable: true,
      avgDensityKgPerLiter: 0.04,
      decompositionMonths: 5000,
      tips: ['Rinse containers', 'Check recycling number', 'Remove caps if different material']
    });

    this.categories.set('glass', {
      id: 'glass',
      name: 'Glass',
      color: '#4CAF50',
      icon: 'glass',
      recyclable: true,
      avgDensityKgPerLiter: 0.5,
      decompositionMonths: 12000,
      tips: ['Separate by color if required', 'Remove lids and caps', 'No ceramics or porcelain']
    });

    this.categories.set('metal', {
      id: 'metal',
      name: 'Metal',
      color: '#9E9E9E',
      icon: 'metal',
      recyclable: true,
      avgDensityKgPerLiter: 0.15,
      decompositionMonths: 6000,
      tips: ['Crush cans to save space', 'Clean food residue', 'Include aluminum foil']
    });

    this.categories.set('organic', {
      id: 'organic',
      name: 'Organic / Food Waste',
      color: '#795548',
      icon: 'organic',
      recyclable: false,
      compostable: true,
      avgDensityKgPerLiter: 0.4,
      decompositionMonths: 6,
      tips: ['Use compostable bags', 'No meat in home compost', 'Drain liquids first']
    });

    this.categories.set('electronics', {
      id: 'electronics',
      name: 'Electronics / E-Waste',
      color: '#F44336',
      icon: 'electronics',
      recyclable: true,
      hazardous: true,
      avgDensityKgPerLiter: 0.3,
      decompositionMonths: 12000,
      tips: ['Remove batteries first', 'Bring to recycling center', 'Do not put in regular bins']
    });

    this.categories.set('hazardous', {
      id: 'hazardous',
      name: 'Hazardous Waste',
      color: '#E91E63',
      icon: 'hazardous',
      recyclable: false,
      hazardous: true,
      avgDensityKgPerLiter: 0.6,
      decompositionMonths: Infinity,
      tips: ['Paint, chemicals, batteries', 'Store safely until disposal', 'Never pour down drain']
    });

    this.categories.set('general', {
      id: 'general',
      name: 'General / Residual',
      color: '#607D8B',
      icon: 'general',
      recyclable: false,
      avgDensityKgPerLiter: 0.12,
      decompositionMonths: 1200,
      tips: ['Last resort category', 'Ensure nothing recyclable is included', 'Compact waste to save space']
    });

    this.log('Waste categories initialized: ' + this.categories.size);
  }

  _initializeBins() {
    const defaultBins = [
      { id: 'bin_paper', category: 'paper', capacityLiters: 240, location: 'garage' },
      { id: 'bin_plastic', category: 'plastic', capacityLiters: 240, location: 'garage' },
      { id: 'bin_glass', category: 'glass', capacityLiters: 180, location: 'driveway' },
      { id: 'bin_metal', category: 'metal', capacityLiters: 60, location: 'garage' },
      { id: 'bin_organic', category: 'organic', capacityLiters: 140, location: 'kitchen_side' },
      { id: 'bin_electronics', category: 'electronics', capacityLiters: 60, location: 'garage' },
      { id: 'bin_hazardous', category: 'hazardous', capacityLiters: 30, location: 'garage_locked' },
      { id: 'bin_general', category: 'general', capacityLiters: 370, location: 'driveway' }
    ];

    for (const binConfig of defaultBins) {
      const category = this.categories.get(binConfig.category);
      this.bins.set(binConfig.id, {
        id: binConfig.id,
        category: binConfig.category,
        name: category ? category.name + ' Bin' : binConfig.category + ' Bin',
        capacityLiters: binConfig.capacityLiters,
        currentFillLiters: Math.random() * binConfig.capacityLiters * 0.5,
        fillPercentage: 0,
        estimatedWeightKg: 0,
        location: binConfig.location,
        sensorDeviceId: null,
        lastEmptied: Date.now() - Math.floor(Math.random() * 7 * 86400000),
        lastUpdated: Date.now(),
        fillHistory: []
      });

      const bin = this.bins.get(binConfig.id);
      bin.fillPercentage = Math.round((bin.currentFillLiters / bin.capacityLiters) * 100);
      bin.estimatedWeightKg = Math.round(bin.currentFillLiters * (category ? category.avgDensityKgPerLiter : 0.1) * 100) / 100;
    }

    this.log('Waste bins initialized: ' + this.bins.size);
  }

  _initializeCollectionCalendar() {
    const now = new Date();
    const schedules = {
      paper: { intervalDays: 14, dayOfWeek: 2 },
      plastic: { intervalDays: 14, dayOfWeek: 2 },
      glass: { intervalDays: 28, dayOfWeek: 3 },
      metal: { intervalDays: 28, dayOfWeek: 3 },
      organic: { intervalDays: 7, dayOfWeek: 1 },
      general: { intervalDays: 14, dayOfWeek: 4 },
      electronics: { intervalDays: 90, dayOfWeek: 5 },
      hazardous: { intervalDays: 180, dayOfWeek: 5 }
    };

    for (const [category, schedule] of Object.entries(schedules)) {
      const nextCollection = this._calculateNextCollection(now, schedule.intervalDays, schedule.dayOfWeek);
      this.collectionCalendar.set(category, {
        category: category,
        intervalDays: schedule.intervalDays,
        preferredDayOfWeek: schedule.dayOfWeek,
        nextCollection: nextCollection,
        lastCollection: new Date(nextCollection.getTime() - schedule.intervalDays * 86400000),
        reminderSent24h: false,
        reminderSent2h: false,
        collectionHistory: []
      });
    }

    this.log('Collection calendar initialized for ' + this.collectionCalendar.size + ' categories');
  }

  _calculateNextCollection(from, intervalDays, preferredDay) {
    const next = new Date(from);
    next.setDate(next.getDate() + intervalDays);
    while (next.getDay() !== preferredDay) {
      next.setDate(next.getDate() + 1);
    }
    next.setHours(7, 0, 0, 0);
    return next;
  }

  _initializeCarbonFootprint() {
    this.carbonFootprint = {
      paper: { kgCO2PerKg: 1.1, recycledReduction: 0.7 },
      plastic: { kgCO2PerKg: 6.0, recycledReduction: 0.8 },
      glass: { kgCO2PerKg: 0.8, recycledReduction: 0.5 },
      metal: { kgCO2PerKg: 4.0, recycledReduction: 0.9 },
      organic: { kgCO2PerKg: 0.5, compostedReduction: 0.6 },
      electronics: { kgCO2PerKg: 20.0, recycledReduction: 0.85 },
      hazardous: { kgCO2PerKg: 10.0, recycledReduction: 0.3 },
      general: { kgCO2PerKg: 2.5, recycledReduction: 0.0 }
    };
    this.log('Carbon footprint data initialized');
  }

  _initializeCostEstimates() {
    this.costEstimates = {
      paper: { perKgSEK: 0.50 },
      plastic: { perKgSEK: 1.20 },
      glass: { perKgSEK: 0.30 },
      metal: { perKgSEK: 0.80 },
      organic: { perKgSEK: 0.60 },
      electronics: { perKgSEK: 5.00 },
      hazardous: { perKgSEK: 15.00 },
      general: { perKgSEK: 2.00 }
    };
    this.log('Cost estimates initialized');
  }

  _initializeRecyclingTargets() {
    this.recyclingTargets = {
      overallRecyclingRate: 0.65,
      paperRecyclingRate: 0.80,
      plasticRecyclingRate: 0.50,
      glassRecyclingRate: 0.85,
      metalRecyclingRate: 0.75,
      organicCompostRate: 0.70,
      wasteReductionGoalPercent: 10,
      monthlyWasteTargetKg: 30
    };
    this.log('Recycling targets set');
  }

  _initializeCompostBin() {
    this.compostBin = {
      active: true,
      capacityLiters: 300,
      currentFillLiters: 120,
      temperatureCelsius: 45,
      moisturePercent: 55,
      daysSinceTurning: 5,
      turningIntervalDays: 7,
      maturityWeeks: 0,
      targetMaturityWeeks: 12,
      ph: 6.5,
      stage: 'active_decomposition',
      lastTurned: Date.now() - 5 * 86400000,
      addedMaterials: [],
      greenBrownRatio: 0.6,
      history: []
    };
    this.log('Compost bin initialized');
  }

  _initializeGamification() {
    this.gamification = {
      household: {
        totalPoints: 0,
        level: 1,
        currentStreak: 0,
        longestStreak: 0,
        lastActivity: null,
        badges: [],
        weeklyRecyclingRate: 0
      },
      members: new Map(),
      challenges: [
        {
          id: 'zero_waste_day',
          name: 'Zero Waste Day',
          description: 'No general waste for a full day',
          points: 50,
          active: true,
          completedCount: 0
        },
        {
          id: 'recycling_streak_7',
          name: 'Week Warrior',
          description: 'Properly sort all waste for 7 consecutive days',
          points: 100,
          active: true,
          completedCount: 0
        },
        {
          id: 'compost_champion',
          name: 'Compost Champion',
          description: 'Add organic waste to compost every day for 14 days',
          points: 75,
          active: true,
          completedCount: 0
        },
        {
          id: 'reduce_waste_10',
          name: 'Waste Reducer',
          description: 'Reduce total waste by 10% compared to previous month',
          points: 200,
          active: true,
          completedCount: 0
        },
        {
          id: 'electronics_recycler',
          name: 'E-Waste Hero',
          description: 'Properly dispose of 5 electronic items',
          points: 150,
          active: true,
          completedCount: 0
        }
      ],
      leaderboard: []
    };

    this._addHouseholdMember('parent1', 'Parent 1');
    this._addHouseholdMember('parent2', 'Parent 2');
    this._addHouseholdMember('child1', 'Child 1');

    this.log('Gamification system initialized');
  }

  _addHouseholdMember(id, name) {
    this.gamification.members.set(id, {
      id: id,
      name: name,
      points: 0,
      recycledItems: 0,
      streak: 0,
      longestStreak: 0,
      lastActivity: null,
      badges: []
    });
  }

  _initializeTrendData() {
    this.trendData = {
      weeklyTotals: [],
      monthlyTotals: [],
      categoryBreakdown: {},
      lastCalculated: null
    };

    for (const [catId] of this.categories) {
      this.trendData.categoryBreakdown[catId] = {
        weeklyKg: [],
        monthlyKg: [],
        trend: 'stable'
      };
    }

    this._seedTrendData();
    this.log('Trend data initialized');
  }

  _seedTrendData() {
    for (let week = 11; week >= 0; week--) {
      const weekTotal = 5 + Math.random() * 15;
      this.trendData.weeklyTotals.push({
        weekStart: Date.now() - week * 7 * 86400000,
        totalKg: Math.round(weekTotal * 100) / 100
      });

      for (const [catId] of this.categories) {
        const catShare = weekTotal * (0.05 + Math.random() * 0.2);
        if (!this.trendData.categoryBreakdown[catId]) {
          this.trendData.categoryBreakdown[catId] = { weeklyKg: [], monthlyKg: [], trend: 'stable' };
        }
        this.trendData.categoryBreakdown[catId].weeklyKg.push(Math.round(catShare * 100) / 100);
      }
    }

    for (let month = 5; month >= 0; month--) {
      this.trendData.monthlyTotals.push({
        monthStart: Date.now() - month * 30 * 86400000,
        totalKg: Math.round((20 + Math.random() * 40) * 100) / 100
      });
    }
  }

  async _discoverDevices() {
    try {
      const devices = await this.homey.devices.getDevices();
      let discovered = 0;

      for (const [deviceId, device] of Object.entries(devices)) {
        const name = (device.name || '').toLowerCase();
        if (name.includes('waste') || name.includes('bin') || name.includes('sopkärl') || name.includes('avfall')) {
          for (const [binId, bin] of this.bins) {
            if (name.includes(bin.category) || name.includes(binId)) {
              bin.sensorDeviceId = deviceId;
              discovered++;
              this.log('Discovered waste sensor: ' + device.name + ' → ' + binId);
              break;
            }
          }
        }
      }

      this.log('Device discovery complete: ' + discovered + ' waste sensors found');
    } catch (err) {
      this.error('Device discovery failed: ' + err.message);
    }
  }

  addWaste(category, volumeLiters, memberId) {
    const cat = this.categories.get(category);
    if (!cat) {
      this.error('Unknown waste category: ' + category);
      return { success: false, reason: 'unknown_category' };
    }

    const binId = 'bin_' + category;
    const bin = this.bins.get(binId);
    if (!bin) {
      this.error('No bin found for category: ' + category);
      return { success: false, reason: 'no_bin' };
    }

    const availableSpace = bin.capacityLiters - bin.currentFillLiters;
    const actualVolume = Math.min(volumeLiters, availableSpace);

    if (actualVolume <= 0) {
      return { success: false, reason: 'bin_full' };
    }

    const weightKg = actualVolume * cat.avgDensityKgPerLiter;
    bin.currentFillLiters += actualVolume;
    bin.fillPercentage = Math.round((bin.currentFillLiters / bin.capacityLiters) * 100);
    bin.estimatedWeightKg = Math.round(bin.currentFillLiters * cat.avgDensityKgPerLiter * 100) / 100;
    bin.lastUpdated = Date.now();

    bin.fillHistory.push({
      timestamp: Date.now(),
      fillPercentage: bin.fillPercentage,
      addedLiters: actualVolume,
      addedKg: weightKg
    });
    if (bin.fillHistory.length > 500) {
      bin.fillHistory = bin.fillHistory.slice(-250);
    }

    const logEntry = {
      id: 'waste_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      category: category,
      volumeLiters: actualVolume,
      weightKg: Math.round(weightKg * 1000) / 1000,
      memberId: memberId || null,
      binId: binId,
      timestamp: Date.now(),
      carbonImpactKg: this._calculateCarbonImpact(category, weightKg)
    };
    this.wasteLog.push(logEntry);
    if (this.wasteLog.length > 5000) {
      this.wasteLog = this.wasteLog.slice(-2500);
    }

    if (memberId) {
      this._updateMemberScore(memberId, category, weightKg);
    }

    this.log('Waste added: ' + actualVolume.toFixed(1) + 'L of ' + category + ' (' + weightKg.toFixed(2) + ' kg)');

    return {
      success: true,
      category: category,
      volumeAdded: actualVolume,
      weightKg: Math.round(weightKg * 1000) / 1000,
      binFillPercentage: bin.fillPercentage,
      carbonImpactKg: logEntry.carbonImpactKg
    };
  }

  _calculateCarbonImpact(category, weightKg) {
    const footprint = this.carbonFootprint[category];
    if (!footprint) return 0;
    const cat = this.categories.get(category);
    const baseImpact = weightKg * footprint.kgCO2PerKg;

    if (cat && cat.recyclable && footprint.recycledReduction) {
      return Math.round((baseImpact * (1 - footprint.recycledReduction)) * 1000) / 1000;
    }
    if (cat && cat.compostable && footprint.compostedReduction) {
      return Math.round((baseImpact * (1 - footprint.compostedReduction)) * 1000) / 1000;
    }
    return Math.round(baseImpact * 1000) / 1000;
  }

  emptyBin(binId) {
    const bin = this.bins.get(binId);
    if (!bin) {
      this.error('Bin not found: ' + binId);
      return { success: false, reason: 'bin_not_found' };
    }

    const previousFill = bin.currentFillLiters;
    const previousWeight = bin.estimatedWeightKg;

    bin.currentFillLiters = 0;
    bin.fillPercentage = 0;
    bin.estimatedWeightKg = 0;
    bin.lastEmptied = Date.now();
    bin.lastUpdated = Date.now();

    const schedule = this.collectionCalendar.get(bin.category);
    if (schedule) {
      schedule.lastCollection = new Date();
      schedule.nextCollection = this._calculateNextCollection(new Date(), schedule.intervalDays, schedule.preferredDayOfWeek);
      schedule.reminderSent24h = false;
      schedule.reminderSent2h = false;
      schedule.collectionHistory.push({
        timestamp: Date.now(),
        volumeLiters: previousFill,
        weightKg: previousWeight
      });
      if (schedule.collectionHistory.length > 100) {
        schedule.collectionHistory = schedule.collectionHistory.slice(-50);
      }
    }

    this.log('Bin emptied: ' + binId + ' (' + previousFill.toFixed(1) + 'L / ' + previousWeight.toFixed(2) + ' kg)');
    return {
      success: true,
      binId: binId,
      previousFillLiters: previousFill,
      previousWeightKg: previousWeight,
      nextCollection: schedule ? schedule.nextCollection : null
    };
  }

  _updateMemberScore(memberId, category, weightKg) {
    const member = this.gamification.members.get(memberId);
    if (!member) return;

    const cat = this.categories.get(category);
    let points = 5;

    if (cat && cat.recyclable) points += 10;
    if (cat && cat.compostable) points += 8;
    if (category === 'electronics' || category === 'hazardous') points += 15;

    member.points += points;
    member.recycledItems += 1;
    member.lastActivity = Date.now();

    const lastDate = member.lastActivity ? new Date(member.lastActivity).toDateString() : '';
    const today = new Date().toDateString();
    if (lastDate !== today) {
      member.streak += 1;
      if (member.streak > member.longestStreak) {
        member.longestStreak = member.streak;
      }
    }

    this.gamification.household.totalPoints += points;
    this.gamification.household.lastActivity = Date.now();
  }

  wastePerWeek(weeksBack) {
    const weeks = weeksBack || 4;
    const results = [];
    const now = Date.now();

    for (let w = 0; w < weeks; w++) {
      const weekStart = now - (w + 1) * 7 * 86400000;
      const weekEnd = now - w * 7 * 86400000;
      const weekLogs = this.wasteLog.filter(l => l.timestamp >= weekStart && l.timestamp < weekEnd);

      const totalKg = weekLogs.reduce((s, l) => s + l.weightKg, 0);
      const byCategory = {};
      for (const log of weekLogs) {
        if (!byCategory[log.category]) byCategory[log.category] = 0;
        byCategory[log.category] += log.weightKg;
      }

      results.push({
        weekNumber: w + 1,
        weekStart: new Date(weekStart).toISOString().substring(0, 10),
        totalKg: Math.round(totalKg * 100) / 100,
        itemCount: weekLogs.length,
        byCategory: byCategory
      });
    }

    return results;
  }

  wastePerMonth(monthsBack) {
    const months = monthsBack || 6;
    const results = [];
    const now = Date.now();

    for (let m = 0; m < months; m++) {
      const monthStart = now - (m + 1) * 30 * 86400000;
      const monthEnd = now - m * 30 * 86400000;
      const monthLogs = this.wasteLog.filter(l => l.timestamp >= monthStart && l.timestamp < monthEnd);

      const totalKg = monthLogs.reduce((s, l) => s + l.weightKg, 0);
      const byCategory = {};
      for (const log of monthLogs) {
        if (!byCategory[log.category]) byCategory[log.category] = 0;
        byCategory[log.category] += log.weightKg;
      }

      results.push({
        monthNumber: m + 1,
        monthStart: new Date(monthStart).toISOString().substring(0, 10),
        totalKg: Math.round(totalKg * 100) / 100,
        itemCount: monthLogs.length,
        byCategory: byCategory
      });
    }

    return results;
  }

  trendDirection(category) {
    const weeklyData = this.wastePerWeek(8);
    if (weeklyData.length < 2) return 'insufficient_data';

    const recentWeeks = weeklyData.slice(0, 4);
    const olderWeeks = weeklyData.slice(4, 8);

    let recentTotal = 0;
    let olderTotal = 0;

    for (const w of recentWeeks) {
      if (category) {
        recentTotal += (w.byCategory[category] || 0);
      } else {
        recentTotal += w.totalKg;
      }
    }

    for (const w of olderWeeks) {
      if (category) {
        olderTotal += (w.byCategory[category] || 0);
      } else {
        olderTotal += w.totalKg;
      }
    }

    const recentAvg = recentTotal / recentWeeks.length;
    const olderAvg = olderWeeks.length > 0 ? olderTotal / olderWeeks.length : recentAvg;

    if (olderAvg === 0) return 'stable';

    const changePercent = ((recentAvg - olderAvg) / olderAvg) * 100;

    if (changePercent > 10) return 'increasing';
    if (changePercent < -10) return 'decreasing';
    return 'stable';
  }

  getRecyclingRate() {
    const recentLogs = this.wasteLog.filter(l => l.timestamp > Date.now() - 30 * 86400000);
    if (recentLogs.length === 0) return { rate: 0, target: this.recyclingTargets.overallRecyclingRate };

    let recyclableKg = 0;
    let totalKg = 0;

    for (const log of recentLogs) {
      totalKg += log.weightKg;
      const cat = this.categories.get(log.category);
      if (cat && (cat.recyclable || cat.compostable)) {
        recyclableKg += log.weightKg;
      }
    }

    const rate = totalKg > 0 ? recyclableKg / totalKg : 0;
    const target = this.recyclingTargets.overallRecyclingRate;

    return {
      rate: Math.round(rate * 100),
      target: Math.round(target * 100),
      meetsTarget: rate >= target,
      recyclableKg: Math.round(recyclableKg * 100) / 100,
      totalKg: Math.round(totalKg * 100) / 100,
      period: '30 days'
    };
  }

  addToCompost(materialType, volumeLiters) {
    const isGreen = ['food_scraps', 'grass', 'coffee_grounds', 'vegetables'].includes(materialType);
    const isBrown = ['leaves', 'cardboard', 'straw', 'wood_chips', 'newspaper'].includes(materialType);

    if (!isGreen && !isBrown) {
      return { success: false, reason: 'invalid_material' };
    }

    const availableSpace = this.compostBin.capacityLiters - this.compostBin.currentFillLiters;
    const actualVolume = Math.min(volumeLiters, availableSpace);

    if (actualVolume <= 0) {
      return { success: false, reason: 'compost_full' };
    }

    this.compostBin.currentFillLiters += actualVolume;
    this.compostBin.addedMaterials.push({
      type: materialType,
      volumeLiters: actualVolume,
      isGreen: isGreen,
      timestamp: Date.now()
    });

    if (this.compostBin.addedMaterials.length > 200) {
      this.compostBin.addedMaterials = this.compostBin.addedMaterials.slice(-100);
    }

    const greens = this.compostBin.addedMaterials.filter(m => m.isGreen);
    const totalMaterials = this.compostBin.addedMaterials.length;
    this.compostBin.greenBrownRatio = totalMaterials > 0 ? greens.length / totalMaterials : 0.5;

    this.log('Added to compost: ' + actualVolume.toFixed(1) + 'L of ' + materialType);
    return {
      success: true,
      material: materialType,
      volumeAdded: actualVolume,
      fillPercentage: Math.round((this.compostBin.currentFillLiters / this.compostBin.capacityLiters) * 100),
      greenBrownRatio: Math.round(this.compostBin.greenBrownRatio * 100) / 100
    };
  }

  turnCompost() {
    this.compostBin.daysSinceTurning = 0;
    this.compostBin.lastTurned = Date.now();
    this.compostBin.temperatureCelsius = Math.min(65, this.compostBin.temperatureCelsius + 5);
    this.log('Compost turned');
    return { success: true, temperature: this.compostBin.temperatureCelsius };
  }

  getCompostStatus() {
    const needsTurning = this.compostBin.daysSinceTurning >= this.compostBin.turningIntervalDays;
    const idealGreenBrown = this.compostBin.greenBrownRatio >= 0.3 && this.compostBin.greenBrownRatio <= 0.5;
    const idealMoisture = this.compostBin.moisturePercent >= 40 && this.compostBin.moisturePercent <= 60;
    const idealTemp = this.compostBin.temperatureCelsius >= 40 && this.compostBin.temperatureCelsius <= 65;

    const issues = [];
    if (needsTurning) issues.push('Needs turning (overdue by ' + (this.compostBin.daysSinceTurning - this.compostBin.turningIntervalDays) + ' days)');
    if (!idealGreenBrown) issues.push('Green/brown ratio out of range');
    if (!idealMoisture) issues.push('Moisture ' + (this.compostBin.moisturePercent < 40 ? 'too low' : 'too high'));
    if (!idealTemp) issues.push('Temperature ' + (this.compostBin.temperatureCelsius < 40 ? 'too low' : 'too high'));

    return {
      fillPercentage: Math.round((this.compostBin.currentFillLiters / this.compostBin.capacityLiters) * 100),
      temperatureCelsius: this.compostBin.temperatureCelsius,
      moisturePercent: this.compostBin.moisturePercent,
      ph: this.compostBin.ph,
      daysSinceTurning: this.compostBin.daysSinceTurning,
      needsTurning: needsTurning,
      greenBrownRatio: Math.round(this.compostBin.greenBrownRatio * 100) / 100,
      stage: this.compostBin.stage,
      maturityWeeks: this.compostBin.maturityWeeks,
      targetMaturityWeeks: this.compostBin.targetMaturityWeeks,
      healthy: issues.length === 0,
      issues: issues
    };
  }

  logHazardousWaste(itemName, category, weightKg, notes) {
    const entry = {
      id: 'haz_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      itemName: itemName,
      subCategory: category,
      weightKg: weightKg,
      notes: notes || '',
      loggedAt: Date.now(),
      disposedAt: null,
      disposalMethod: null,
      reminderSent: false
    };

    this.hazardousWasteLog.push(entry);
    if (this.hazardousWasteLog.length > 500) {
      this.hazardousWasteLog = this.hazardousWasteLog.slice(-250);
    }

    this.log('Hazardous waste logged: ' + itemName + ' (' + weightKg + ' kg)');
    return entry;
  }

  getHazardousDisposalReminders() {
    const reminders = [];
    const thirtyDaysAgo = Date.now() - 30 * 86400000;

    for (const item of this.hazardousWasteLog) {
      if (!item.disposedAt && item.loggedAt < thirtyDaysAgo) {
        reminders.push({
          itemId: item.id,
          itemName: item.itemName,
          subCategory: item.subCategory,
          loggedDaysAgo: Math.floor((Date.now() - item.loggedAt) / 86400000),
          urgency: item.loggedAt < Date.now() - 90 * 86400000 ? 'high' : 'medium'
        });
      }
    }

    return reminders;
  }

  getCostEstimate(category, weightKg) {
    const cost = this.costEstimates[category];
    if (!cost) return null;
    return {
      category: category,
      weightKg: weightKg,
      estimatedCostSEK: Math.round(weightKg * cost.perKgSEK * 100) / 100,
      ratePerKg: cost.perKgSEK
    };
  }

  getTotalMonthlyCost() {
    const monthLogs = this.wasteLog.filter(l => l.timestamp > Date.now() - 30 * 86400000);
    let totalCost = 0;
    const byCat = {};

    for (const log of monthLogs) {
      const cost = this.costEstimates[log.category];
      if (cost) {
        const itemCost = log.weightKg * cost.perKgSEK;
        totalCost += itemCost;
        if (!byCat[log.category]) byCat[log.category] = 0;
        byCat[log.category] += itemCost;
      }
    }

    return {
      totalCostSEK: Math.round(totalCost * 100) / 100,
      byCategory: byCat,
      period: '30 days'
    };
  }

  _checkCollectionReminders() {
    const now = Date.now();

    for (const [category, schedule] of this.collectionCalendar) {
      const timeUntilCollection = schedule.nextCollection.getTime() - now;

      if (timeUntilCollection <= 24 * 3600000 && timeUntilCollection > 2 * 3600000 && !schedule.reminderSent24h) {
        schedule.reminderSent24h = true;
        this.log('COLLECTION REMINDER (24h): ' + category + ' collection tomorrow at ' + schedule.nextCollection.toISOString().substring(0, 16));
        try {
          this.homey.emit('waste_collection_reminder', {
            category: category,
            timeframe: '24h',
            collectionDate: schedule.nextCollection.toISOString()
          });
        } catch (err) {
          this.error('Failed to emit 24h reminder event: ' + err.message);
        }
      }

      if (timeUntilCollection <= 2 * 3600000 && timeUntilCollection > 0 && !schedule.reminderSent2h) {
        schedule.reminderSent2h = true;
        this.log('COLLECTION REMINDER (2h): ' + category + ' collection in 2 hours!');
        try {
          this.homey.emit('waste_collection_reminder', {
            category: category,
            timeframe: '2h',
            collectionDate: schedule.nextCollection.toISOString()
          });
        } catch (err) {
          this.error('Failed to emit 2h reminder event: ' + err.message);
        }
      }

      if (timeUntilCollection < 0) {
        schedule.nextCollection = this._calculateNextCollection(new Date(), schedule.intervalDays, schedule.preferredDayOfWeek);
        schedule.reminderSent24h = false;
        schedule.reminderSent2h = false;
      }
    }
  }

  _startMonitoring() {
    this.monitoringInterval = setInterval(() => {
      this._monitoringCycle();
    }, 1800000);

    this.reminderInterval = setInterval(() => {
      this._checkCollectionReminders();
    }, 600000);

    this.log('Monitoring started: 30-min bin updates, 10-min collection reminders');
  }

  _monitoringCycle() {
    try {
      for (const [, bin] of this.bins) {
        const addedVolume = Math.random() * 2;
        if (addedVolume > 1.5) {
          const cat = this.categories.get(bin.category);
          bin.currentFillLiters = Math.min(bin.capacityLiters, bin.currentFillLiters + addedVolume);
          bin.fillPercentage = Math.round((bin.currentFillLiters / bin.capacityLiters) * 100);
          bin.estimatedWeightKg = Math.round(bin.currentFillLiters * (cat ? cat.avgDensityKgPerLiter : 0.1) * 100) / 100;
          bin.lastUpdated = Date.now();

          if (bin.fillPercentage >= 90) {
            this.log('BIN ALMOST FULL: ' + bin.name + ' at ' + bin.fillPercentage + '%');
          }
        }
      }

      this.compostBin.daysSinceTurning += 1 / 48;
      this.compostBin.temperatureCelsius = Math.max(20, this.compostBin.temperatureCelsius - 0.1);
      this.compostBin.moisturePercent = Math.max(30, Math.min(70, this.compostBin.moisturePercent + (Math.random() - 0.5) * 2));

      this._checkCollectionReminders();
    } catch (err) {
      this.error('Monitoring cycle error: ' + err.message);
    }
  }

  getStatistics() {
    const binStatuses = {};
    for (const [id, bin] of this.bins) {
      binStatuses[id] = {
        category: bin.category,
        fillPercentage: bin.fillPercentage,
        estimatedWeightKg: bin.estimatedWeightKg,
        capacityLiters: bin.capacityLiters,
        lastEmptied: bin.lastEmptied,
        hasSensor: !!bin.sensorDeviceId
      };
    }

    const upcomingCollections = {};
    for (const [category, schedule] of this.collectionCalendar) {
      upcomingCollections[category] = {
        nextCollection: schedule.nextCollection.toISOString().substring(0, 10),
        daysUntil: Math.ceil((schedule.nextCollection.getTime() - Date.now()) / 86400000),
        intervalDays: schedule.intervalDays
      };
    }

    const recyclingRate = this.getRecyclingRate();
    const monthlyCost = this.getTotalMonthlyCost();
    const compostStatus = this.getCompostStatus();
    const hazardousReminders = this.getHazardousDisposalReminders();

    const totalCarbonSavedKg = this.wasteLog
      .filter(l => {
        const cat = this.categories.get(l.category);
        return cat && (cat.recyclable || cat.compostable);
      })
      .reduce((s, l) => {
        const fp = this.carbonFootprint[l.category];
        if (!fp) return s;
        return s + l.weightKg * fp.kgCO2PerKg * (fp.recycledReduction || fp.compostedReduction || 0);
      }, 0);

    const memberScores = {};
    for (const [id, member] of this.gamification.members) {
      memberScores[id] = {
        name: member.name,
        points: member.points,
        recycledItems: member.recycledItems,
        streak: member.streak,
        longestStreak: member.longestStreak
      };
    }

    return {
      bins: binStatuses,
      upcomingCollections: upcomingCollections,
      recyclingRate: recyclingRate,
      monthlyCost: monthlyCost,
      compost: compostStatus,
      hazardousReminders: hazardousReminders,
      carbonSavedKg: Math.round(totalCarbonSavedKg * 100) / 100,
      wasteLogEntries: this.wasteLog.length,
      trendDirection: this.trendDirection(),
      weeklyReport: this.wastePerWeek(4),
      gamification: {
        householdPoints: this.gamification.household.totalPoints,
        householdLevel: this.gamification.household.level,
        members: memberScores,
        activeChallenges: this.gamification.challenges.filter(c => c.active).length
      },
      categories: this.categories.size,
      uptime: this.initialized ? 'active' : 'inactive'
    };
  }

  log(msg) {
    this.homey.log('[WasteManagement]', msg);
  }

  error(msg) {
    this.homey.error('[WasteManagement]', msg);
  }

  destroy() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    if (this.reminderInterval) {
      clearInterval(this.reminderInterval);
      this.reminderInterval = null;
    }
    this.log('Smart Waste Management System destroyed');
  }
}

module.exports = SmartWasteManagementSystem;
