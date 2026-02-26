'use strict';

/**
 * Waste Management Tracker
 * Tracks waste, recycling, compost, and collection schedules
 */
class WasteManagementTracker {
  constructor(app) {
    this.app = app;
    this.bins = new Map();
    this.collectionSchedule = new Map();
    this.wasteLog = [];
    this.stats = {
      recyclingRate: 0,
      wasteReduction: 0
    };
  }

  async initialize() {
    await this.loadBins();
    await this.loadCollectionSchedule();
    
    this.startMonitoring();
  }

  // ============================================
  // WASTE BINS
  // ============================================

  async loadBins() {
    const binConfigs = [
      {
        id: 'bin_general',
        name: 'Restavfall',
        type: 'general',
        color: 'green',
        capacity: 240, // liters
        currentLevel: 0,
        location: 'Sopskjul',
        collectionDay: 'tuesday'
      },
      {
        id: 'bin_paper',
        name: 'Papper',
        type: 'paper',
        color: 'blue',
        capacity: 240,
        currentLevel: 0,
        location: 'Sopskjul',
        collectionDay: 'tuesday',
        recyclable: true
      },
      {
        id: 'bin_plastic',
        name: 'Plast',
        type: 'plastic',
        color: 'yellow',
        capacity: 240,
        currentLevel: 0,
        location: 'Sopskjul',
        collectionDay: 'friday',
        recyclable: true
      },
      {
        id: 'bin_glass',
        name: 'Glas',
        type: 'glass',
        color: 'white',
        capacity: 120,
        currentLevel: 0,
        location: 'Sopskjul',
        collectionDay: 'friday',
        recyclable: true
      },
      {
        id: 'bin_metal',
        name: 'Metall',
        type: 'metal',
        color: 'gray',
        capacity: 120,
        currentLevel: 0,
        location: 'Sopskjul',
        collectionDay: 'friday',
        recyclable: true
      },
      {
        id: 'bin_organic',
        name: 'Matavfall',
        type: 'organic',
        color: 'brown',
        capacity: 140,
        currentLevel: 0,
        location: 'Kök',
        collectionDay: 'monday',
        compostable: true
      },
      {
        id: 'bin_compost',
        name: 'Kompost',
        type: 'compost',
        color: 'black',
        capacity: 300,
        currentLevel: 0,
        location: 'Trädgård',
        collectionDay: null, // No collection, on-site composting
        compostable: true
      },
      {
        id: 'bin_electronics',
        name: 'Elektronik',
        type: 'electronics',
        color: 'red',
        capacity: 60,
        currentLevel: 0,
        location: 'Förråd',
        collectionDay: null, // Take to recycling center
        recyclable: true,
        specialHandling: true
      },
      {
        id: 'bin_batteries',
        name: 'Batterier',
        type: 'batteries',
        color: 'red',
        capacity: 10,
        currentLevel: 0,
        location: 'Kök',
        collectionDay: null,
        recyclable: true,
        specialHandling: true
      }
    ];

    for (const config of binConfigs) {
      this.bins.set(config.id, {
        ...config,
        lastEmptied: Date.now(),
        totalWaste: 0, // kg over time
        emptyCount: 0,
        sensor: config.capacity > 100 // Only larger bins have sensors
      });
    }
  }

  // ============================================
  // COLLECTION SCHEDULE
  // ============================================

  async loadCollectionSchedule() {
    // Swedish waste collection schedule
    this.collectionSchedule.set('monday', {
      day: 'monday',
      dayName: 'Måndag',
      bins: ['bin_organic'],
      time: '07:00'
    });

    this.collectionSchedule.set('tuesday', {
      day: 'tuesday',
      dayName: 'Tisdag',
      bins: ['bin_general', 'bin_paper'],
      time: '07:00'
    });

    this.collectionSchedule.set('friday', {
      day: 'friday',
      dayName: 'Fredag',
      bins: ['bin_plastic', 'bin_glass', 'bin_metal'],
      time: '07:00'
    });
  }

  // ============================================
  // MONITORING
  // ============================================

  startMonitoring() {
    // Check bin levels every hour
    setInterval(() => {
      this.updateBinLevels();
    }, 60 * 60 * 1000);

    // Check collection schedule every hour
    setInterval(() => {
      this.checkCollectionReminders();
    }, 60 * 60 * 1000);

    // Calculate stats daily
    setInterval(() => {
      this.calculateStats();
    }, 24 * 60 * 60 * 1000);

    // Initial updates
    this.updateBinLevels();
    this.calculateStats();
  }

  async updateBinLevels() {
    for (const [_binId, bin] of this.bins) {
      if (!bin.sensor) continue;

      // Simulate level increase
      const hoursSinceEmpty = (Date.now() - bin.lastEmptied) / (1000 * 60 * 60);
      
      let fillRate; // % per day
      switch (bin.type) {
        case 'general':
          fillRate = 15; // Fills ~7 days
          break;
        case 'organic':
          fillRate = 25; // Fills ~4 days
          break;
        case 'paper':
          fillRate = 10; // Fills ~10 days
          break;
        case 'plastic':
          fillRate = 12;
          break;
        default:
          fillRate = 8;
      }

      bin.currentLevel = Math.min(100, (hoursSinceEmpty / 24) * fillRate);

      // Alert if nearly full
      if (bin.currentLevel >= 80 && bin.currentLevel < 90) {
        console.log(`⚠️ ${bin.name} nästan full (${Math.round(bin.currentLevel)}%)`);
      } else if (bin.currentLevel >= 90) {
        console.log(`🚨 ${bin.name} full (${Math.round(bin.currentLevel)}%) - töm snarast!`);
      }
    }
  }

  async checkCollectionReminders() {
    const now = new Date();
    const today = now.getDay();
    const tomorrow = (today + 1) % 7;
    const hour = now.getHours();

    // Map day numbers to schedule keys
    const dayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    // Evening reminder for tomorrow's collection
    if (hour === 20) {
      const tomorrowSchedule = this.collectionSchedule.get(dayMap[tomorrow]);
      
      if (tomorrowSchedule) {
        const bins = tomorrowSchedule.bins.map(binId => this.bins.get(binId).name);
        console.log(`🔔 Påminnelse: Ställ ut ${bins.join(', ')} ikväll för hämtning imorgon (${tomorrowSchedule.dayName})`);
        
        // await this.app.notifications.send({
        //   title: 'Sophämtning imorgon',
        //   message: `Glöm inte ställa ut: ${bins.join(', ')}`,
        //   priority: 'medium'
        // });
      }
    }

    // Morning notification on collection day
    if (hour === 6) {
      const todaySchedule = this.collectionSchedule.get(dayMap[today]);
      
      if (todaySchedule) {
        const bins = todaySchedule.bins.map(binId => this.bins.get(binId).name);
        console.log(`🚛 Sophämtning idag kl ${todaySchedule.time}: ${bins.join(', ')}`);
      }
    }
  }

  async recordWaste(binId, amount, details) {
    const bin = this.bins.get(binId);
    
    if (!bin) {
      return { success: false, error: 'Bin not found' };
    }

    const wasteEntry = {
      id: `waste_${Date.now()}`,
      timestamp: Date.now(),
      binId,
      binType: bin.type,
      amount, // kg
      category: details.category || bin.type,
      recyclable: bin.recyclable || false,
      compostable: bin.compostable || false,
      description: details.description || '',
      avoidable: details.avoidable || false // Could this waste be avoided?
    };

    this.wasteLog.push(wasteEntry);

    // Keep last 90 days
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    this.wasteLog = this.wasteLog.filter(w => w.timestamp >= cutoff);

    // Update bin
    bin.currentLevel = Math.min(100, bin.currentLevel + (amount / bin.capacity) * 100);
    bin.totalWaste += amount;

    console.log(`🗑️ Logged waste: ${amount}kg ${bin.name}`);

    return { success: true, entry: wasteEntry };
  }

  async emptyBin(binId) {
    const bin = this.bins.get(binId);
    
    if (!bin) {
      return { success: false, error: 'Bin not found' };
    }

    const wasteAmount = (bin.currentLevel / 100) * bin.capacity * 0.2; // Rough kg estimate

    console.log(`🚛 Emptying ${bin.name} (${Math.round(bin.currentLevel)}%)`);

    bin.currentLevel = 0;
    bin.lastEmptied = Date.now();
    bin.emptyCount++;

    // Log the collection
    await this.recordWaste(binId, wasteAmount, {
      category: 'collected',
      description: 'Bin collected and emptied'
    });

    return { success: true, bin };
  }

  // ============================================
  // STATISTICS
  // ============================================

  async calculateStats() {
    const last30Days = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentWaste = this.wasteLog.filter(w => w.timestamp >= last30Days);

    if (recentWaste.length === 0) return;

    // Total waste
    const totalWaste = recentWaste.reduce((sum, w) => sum + w.amount, 0);

    // Recycled waste
    const recycledWaste = recentWaste
      .filter(w => w.recyclable)
      .reduce((sum, w) => sum + w.amount, 0);

    // Composted waste
    const compostedWaste = recentWaste
      .filter(w => w.compostable)
      .reduce((sum, w) => sum + w.amount, 0);

    // Recycling rate
    this.stats.recyclingRate = totalWaste > 0 
      ? ((recycledWaste + compostedWaste) / totalWaste) * 100 
      : 0;

    // Avoidable waste
    const avoidableWaste = recentWaste
      .filter(w => w.avoidable)
      .reduce((sum, w) => sum + w.amount, 0);

    this.stats.avoidableWaste = avoidableWaste;
    this.stats.totalWaste = totalWaste;
    this.stats.recycledWaste = recycledWaste;
    this.stats.compostedWaste = compostedWaste;

    console.log(`📊 Waste stats: ${Math.round(this.stats.recyclingRate)}% recycling rate, ${totalWaste.toFixed(1)}kg total`);
  }

  // ============================================
  // ANALYTICS & REPORTING
  // ============================================

  getWasteSummary(days = 30) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const waste = this.wasteLog.filter(w => w.timestamp >= cutoff);

    const byType = {};
    
    for (const entry of waste) {
      if (!byType[entry.binType]) {
        byType[entry.binType] = {
          amount: 0,
          count: 0,
          recyclable: entry.recyclable,
          compostable: entry.compostable
        };
      }
      
      byType[entry.binType].amount += entry.amount;
      byType[entry.binType].count++;
    }

    const totalWaste = waste.reduce((sum, w) => sum + w.amount, 0);
    const recycled = waste.filter(w => w.recyclable || w.compostable)
      .reduce((sum, w) => sum + w.amount, 0);

    return {
      period: `${days} days`,
      totalWaste: totalWaste.toFixed(1),
      dailyAverage: (totalWaste / days).toFixed(1),
      recyclingRate: totalWaste > 0 ? Math.round((recycled / totalWaste) * 100) : 0,
      byType,
      avoidableWaste: waste.filter(w => w.avoidable).reduce((sum, w) => sum + w.amount, 0).toFixed(1)
    };
  }

  getBinStatus(binId) {
    const bin = this.bins.get(binId);
    
    if (!bin) return null;

    const schedule = Array.from(this.collectionSchedule.values())
      .find(s => s.bins.includes(binId));

    return {
      id: bin.id,
      name: bin.name,
      type: bin.type,
      currentLevel: Math.round(bin.currentLevel),
      capacity: bin.capacity,
      status: bin.currentLevel >= 90 ? 'full' : bin.currentLevel >= 70 ? 'nearly_full' : 'ok',
      nextCollection: schedule ? this.getNextCollectionDate(schedule.day) : null,
      lastEmptied: bin.lastEmptied,
      emptyCount: bin.emptyCount,
      totalWaste: bin.totalWaste.toFixed(1)
    };
  }

  getNextCollectionDate(day) {
    const dayMap = {
      'monday': 1,
      'tuesday': 2,
      'wednesday': 3,
      'thursday': 4,
      'friday': 5,
      'saturday': 6,
      'sunday': 0
    };

    const today = new Date();
    const currentDay = today.getDay();
    const targetDay = dayMap[day];

    let daysUntil = targetDay - currentDay;
    if (daysUntil <= 0) daysUntil += 7;

    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + daysUntil);

    return {
      date: nextDate.toLocaleDateString('sv-SE'),
      daysUntil
    };
  }

  getAllBins() {
    return Array.from(this.bins.values()).map(b => ({
      id: b.id,
      name: b.name,
      type: b.type,
      color: b.color,
      currentLevel: Math.round(b.currentLevel),
      status: b.currentLevel >= 90 ? 'full' : b.currentLevel >= 70 ? 'nearly_full' : 'ok',
      recyclable: b.recyclable || false
    }));
  }

  getCollectionSchedule() {
    return Array.from(this.collectionSchedule.values()).map(s => ({
      day: s.dayName,
      bins: s.bins.map(binId => this.bins.get(binId).name),
      time: s.time,
      nextCollection: this.getNextCollectionDate(s.day)
    }));
  }

  getUpcomingCollections(days = 7) {
    const upcoming = [];
    const today = new Date();

    for (let i = 0; i < days; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() + i);
      const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][checkDate.getDay()];
      
      const schedule = this.collectionSchedule.get(dayName);
      
      if (schedule) {
        upcoming.push({
          date: checkDate.toLocaleDateString('sv-SE'),
          day: schedule.dayName,
          bins: schedule.bins.map(binId => ({
            name: this.bins.get(binId).name,
            level: Math.round(this.bins.get(binId).currentLevel)
          })),
          time: schedule.time,
          daysUntil: i
        });
      }
    }

    return upcoming;
  }

  getWasteReductionTips() {
    return [
      {
        category: 'Matavfall',
        tips: [
          'Planera måltider för att undvika matsvinn',
          'Förvara mat korrekt för längre hållbarhet',
          'Använd rester kreativt i nya rätter',
          'Kompostera allt matavfall',
          'Frys in mat som snart går ut'
        ],
        potentialReduction: '30-40%'
      },
      {
        category: 'Förpackningar',
        tips: [
          'Välj produkter med minimal förpackning',
          'Köp i bulk när möjligt',
          'Använd återanvändbara kassar och behållare',
          'Välj återfyllbara produkter',
          'Undvik engångsartiklar'
        ],
        potentialReduction: '40-50%'
      },
      {
        category: 'Återvinning',
        tips: [
          'Sortera allt sopor korrekt',
          'Skölj förpackningar före återvinning',
          'Ta elektronik till återvinningsstation',
          'Donera fungerande prylar',
          'Reparera istället för att slänga'
        ],
        potentialReduction: '60-70% recycling rate'
      },
      {
        category: 'Allmänt',
        tips: [
          'Köp begagnat när möjligt',
          'Låna eller hyr istället för att köpa',
          'Välj hållbara produkter',
          'Undvik impulsköp',
          'Tänk "refuse, reduce, reuse, recycle"'
        ],
        potentialReduction: '20-30%'
      }
    ];
  }

  getRecyclingGuide() {
    return {
      'Papper': {
        accepted: [
          'Tidningar och tidskrifter',
          'Kontorstpapper',
          'Kartonger (platta)',
          'Papperspåsar'
        ],
        notAccepted: [
          'Smutsigt papper',
          'Papper med plast/metallbeläggning',
          'Tapeter',
          'Kvitton (termopapper)'
        ]
      },
      'Plast': {
        accepted: [
          'Plastflaskor och -dunkar',
          'Plastförpackningar med symboler',
          'Plastpåsar',
          'Plastfilm'
        ],
        notAccepted: [
          'Leksaker',
          'Plast utan återvinningssymbol',
          'Hushållsplast',
          'CD-skivor'
        ]
      },
      'Glas': {
        accepted: [
          'Glasförpackningar',
          'Glasflaskor',
          'Glasburkar'
        ],
        notAccepted: [
          'Fönsterglas',
          'Keramik/porslin',
          'Kristall',
          'Glödlampor (till återvinningsstation)'
        ]
      },
      'Metall': {
        accepted: [
          'Konservburkar',
          'Metalllock',
          'Aluminiumfolie',
          'Metallförpackningar'
        ],
        notAccepted: [
          'Batteri (separat insamling)',
          'Elektronik (återvinningsstation)',
          'Stora metallföremål'
        ]
      },
      'Matavfall': {
        accepted: [
          'Frukt och grönsaker',
          'Matrester',
          'Kaffefilter',
          'Äggsskal'
        ],
        notAccepted: [
          'Kött och fisk (endast kommersiell kompost)',
          'Förpackningar',
          'Plastpåsar',
          'Glas och metall'
        ]
      }
    };
  }

  getEnvironmentalImpact() {
    const summary = this.getWasteSummary(365); // Yearly

    // Estimates based on Swedish averages
    const co2Saved = (summary.recyclingRate / 100) * parseFloat(summary.totalWaste) * 2.5; // kg CO2
    const landfillAvoided = parseFloat(summary.totalWaste) * (summary.recyclingRate / 100);

    return {
      period: 'year',
      recyclingRate: summary.recyclingRate,
      co2Saved: Math.round(co2Saved),
      landfillAvoided: Math.round(landfillAvoided),
      treesEquivalent: Math.round(co2Saved / 20), // Rough estimate: 1 tree absorbs ~20kg CO2/year
      costSavings: Math.round(parseFloat(summary.avoidableWaste) * 30) // Estimate 30 SEK/kg for avoidable waste
    };
  }

  getMonthlyComparison() {
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const lastMonth = new Date(thisMonth);
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    const thisMonthWaste = this.wasteLog
      .filter(w => w.timestamp >= thisMonth.getTime())
      .reduce((sum, w) => sum + w.amount, 0);

    const lastMonthWaste = this.wasteLog
      .filter(w => w.timestamp >= lastMonth.getTime() && w.timestamp < thisMonth.getTime())
      .reduce((sum, w) => sum + w.amount, 0);

    const change = lastMonthWaste > 0 
      ? ((thisMonthWaste - lastMonthWaste) / lastMonthWaste) * 100 
      : 0;

    return {
      thisMonth: thisMonthWaste.toFixed(1),
      lastMonth: lastMonthWaste.toFixed(1),
      change: change.toFixed(1),
      trend: change < -5 ? 'improving' : change > 5 ? 'worsening' : 'stable'
    };
  }
}

module.exports = WasteManagementTracker;
