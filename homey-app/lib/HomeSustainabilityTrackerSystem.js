'use strict';

/**
 * HomeSustainabilityTrackerSystem
 * [Sustainability] Carbon footprint tracking, energy source attribution,
 * water usage, transport emissions, goals, badges, and reporting.
 */
class HomeSustainabilityTrackerSystem {

  constructor(homey) {
    this.homey = homey;

    /** @type {Map<string, object>} Per-device CO2 emissions tracking */
    this.deviceEmissions = new Map();

    /** @type {Map<string, object>} Per-room aggregated emissions */
    this.roomEmissions = new Map();

    /** @type {object} Whole-home emissions summary */
    this.homeEmissions = {
      totalKgCO2: 0,
      dailyLog: [],
      monthlyTotals: {},
    };

    /** @type {object} Energy source configuration (Sweden grid default) */
    this.energySources = {
      grid: { label: 'Grid Electricity', kgCO2PerKWh: 0.045, currentSharePercent: 60 },
      solar: { label: 'Solar Panels', kgCO2PerKWh: 0, currentSharePercent: 30 },
      battery: { label: 'Battery Storage', kgCO2PerKWh: 0, currentSharePercent: 10 },
      wind: { label: 'Wind (if applicable)', kgCO2PerKWh: 0, currentSharePercent: 0 },
    };

    /** @type {object} Water tracking */
    this.waterTracking = {
      dailyUsageLiters: [],
      avgPerPersonPerDaySweden: 150,
      householdSize: 2,
      monthlyTarget: 0,
    };

    /** @type {Map<string, object>} Transport emission profiles */
    this.transportProfiles = new Map();

    /** @type {Array<object>} Goals and streaks */
    this.goals = [];

    /** @type {Array<object>} Achievement badges */
    this.badges = this._buildBadges();

    /** @type {Array<string>} Earned badge IDs */
    this.earnedBadges = [];

    /** @type {Map<string, object>} Appliance efficiency scores */
    this.applianceEfficiency = new Map();

    /** @type {object} Neighbourhood benchmark data */
    this.neighbourhoodBenchmark = {
      averageKgCO2PerMonth: 120,
      averageKWhPerMonth: 850,
      averageWaterLPerDay: 300,
      lastUpdated: null,
    };

    /** @type {object} Seasonal baselines (Sweden) */
    this.seasonalBaselines = this._buildSeasonalBaselines();

    /** @type {Array<object>} Context-aware tips */
    this.tips = this._buildTips();

    /** @type {Array<object>} Carbon offsets */
    this.carbonOffsets = [];

    /** @type {object} EPC tracking */
    this.epcRating = {
      currentRating: null,
      targetRating: null,
      assessmentDate: null,
      recommendations: [],
      improvementHistory: [],
    };

    /** @type {object} Settings */
    this.settings = {
      monitoringIntervalMs: 30 * 60 * 1000,
      currency: 'SEK',
      electricityPricePerKWh: 1.5,
      waterPricePerLiter: 0.04,
      country: 'Sweden',
      reportDay: 1,
    };

    this.monitoringTimer = null;
    this.initialized = false;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async initialize() {
    try {
      this.log('Initializing HomeSustainabilityTrackerSystem');
      await this._loadSettings();
      this._recalculateMonthlyTarget();
      this._startMonitoringLoop();
      this.initialized = true;
      this.log('HomeSustainabilityTrackerSystem initialized successfully');
    } catch (error) {
      this.homey.error(`[HomeSustainabilityTrackerSystem] Failed to initialize:`, error.message);
    }
  }

  async destroy() {
    this.log('Shutting down HomeSustainabilityTrackerSystem');
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }
    await this._saveSettings();
    this.initialized = false;
    this.log('HomeSustainabilityTrackerSystem destroyed');
  }

  // ---------------------------------------------------------------------------
  // CO2 tracking — device level
  // ---------------------------------------------------------------------------

  registerDevice(deviceId, details) {
    const device = {
      deviceId,
      name: details.name || deviceId,
      room: details.room || 'unknown',
      category: details.category || 'other',
      wattage: details.wattage || 0,
      euEnergyLabel: details.euEnergyLabel || null,
      totalKWhConsumed: 0,
      totalKgCO2: 0,
      dailyLog: [],
      registeredAt: new Date(),
    };

    this.deviceEmissions.set(deviceId, device);
    this.log(`Registered device for sustainability tracking: ${device.name} (${deviceId})`);
    return device;
  }

  unregisterDevice(deviceId) {
    const removed = this.deviceEmissions.delete(deviceId);
    if (removed) {
      this.log(`Unregistered device: ${deviceId}`);
    } else {
      this.error(`Device not found for unregistration: ${deviceId}`);
    }
    return removed;
  }

  recordDeviceConsumption(deviceId, kWh, durationHours) {
    const device = this.deviceEmissions.get(deviceId);
    if (!device) {
      this.error(`Device not registered for tracking: ${deviceId}`);
      return null;
    }

    const blendedCO2PerKWh = this._getBlendedCO2Factor();
    const kgCO2 = kWh * blendedCO2PerKWh;

    device.totalKWhConsumed += kWh;
    device.totalKgCO2 += kgCO2;

    const entry = {
      timestamp: new Date(),
      kWh,
      kgCO2: parseFloat(kgCO2.toFixed(4)),
      durationHours: durationHours || 0,
      energyMix: this._getCurrentEnergyMix(),
    };
    device.dailyLog.push(entry);

    // Trim to last 90 days
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    device.dailyLog = device.dailyLog.filter((e) => e.timestamp.getTime() > cutoff);

    // Propagate to room and home
    this._addToRoomEmissions(device.room, kWh, kgCO2);
    this._addToHomeEmissions(kWh, kgCO2);

    return entry;
  }

  getDeviceEmissions(deviceId) {
    return this.deviceEmissions.get(deviceId) || null;
  }

  getTopEmittingDevices(count) {
    const devices = Array.from(this.deviceEmissions.values());
    devices.sort((a, b) => b.totalKgCO2 - a.totalKgCO2);
    return devices.slice(0, count || 10).map((d) => ({
      deviceId: d.deviceId,
      name: d.name,
      room: d.room,
      totalKWh: parseFloat(d.totalKWhConsumed.toFixed(2)),
      totalKgCO2: parseFloat(d.totalKgCO2.toFixed(4)),
    }));
  }

  // ---------------------------------------------------------------------------
  // CO2 tracking — room level
  // ---------------------------------------------------------------------------

  _addToRoomEmissions(room, kWh, kgCO2) {
    let roomData = this.roomEmissions.get(room);
    if (!roomData) {
      roomData = { room, totalKWh: 0, totalKgCO2: 0, deviceCount: 0 };
      this.roomEmissions.set(room, roomData);
    }
    roomData.totalKWh += kWh;
    roomData.totalKgCO2 += kgCO2;
  }

  getRoomEmissions(room) {
    return this.roomEmissions.get(room) || null;
  }

  getAllRoomEmissions() {
    const result = [];
    for (const data of this.roomEmissions.values()) {
      result.push({
        room: data.room,
        totalKWh: parseFloat(data.totalKWh.toFixed(2)),
        totalKgCO2: parseFloat(data.totalKgCO2.toFixed(4)),
      });
    }
    result.sort((a, b) => b.totalKgCO2 - a.totalKgCO2);
    return result;
  }

  // ---------------------------------------------------------------------------
  // CO2 tracking — home level
  // ---------------------------------------------------------------------------

  _addToHomeEmissions(kWh, kgCO2) {
    this.homeEmissions.totalKgCO2 += kgCO2;
    const today = new Date().toISOString().slice(0, 10);
    const existing = this.homeEmissions.dailyLog.find((e) => e.date === today);
    if (existing) {
      existing.kWh += kWh;
      existing.kgCO2 += kgCO2;
    } else {
      this.homeEmissions.dailyLog.push({ date: today, kWh, kgCO2 });
    }

    // Trim to last 365 days
    const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000;
    this.homeEmissions.dailyLog = this.homeEmissions.dailyLog.filter(
      (e) => new Date(e.date).getTime() > cutoff
    );

    // Monthly totals
    const monthKey = today.slice(0, 7);
    if (!this.homeEmissions.monthlyTotals[monthKey]) {
      this.homeEmissions.monthlyTotals[monthKey] = { kWh: 0, kgCO2: 0 };
    }
    this.homeEmissions.monthlyTotals[monthKey].kWh += kWh;
    this.homeEmissions.monthlyTotals[monthKey].kgCO2 += kgCO2;
  }

  getHomeEmissionsSummary() {
    return {
      totalKgCO2: parseFloat(this.homeEmissions.totalKgCO2.toFixed(2)),
      dailyLogLength: this.homeEmissions.dailyLog.length,
      monthlyTotals: this.homeEmissions.monthlyTotals,
    };
  }

  // ---------------------------------------------------------------------------
  // Energy source attribution
  // ---------------------------------------------------------------------------

  _getBlendedCO2Factor() {
    let factor = 0;
    for (const source of Object.values(this.energySources)) {
      factor += (source.currentSharePercent / 100) * source.kgCO2PerKWh;
    }
    return factor;
  }

  _getCurrentEnergyMix() {
    const mix = {};
    for (const [key, source] of Object.entries(this.energySources)) {
      mix[key] = source.currentSharePercent;
    }
    return mix;
  }

  updateEnergySourceShare(sourceKey, percent) {
    if (!this.energySources[sourceKey]) {
      this.error(`Unknown energy source: ${sourceKey}`);
      return false;
    }
    this.energySources[sourceKey].currentSharePercent = Math.max(0, Math.min(100, percent));
    this.log(`Updated ${sourceKey} share to ${percent}%`);
    return true;
  }

  getGreenEnergyPercentage() {
    let greenPercent = 0;
    for (const source of Object.values(this.energySources)) {
      if (source.kgCO2PerKWh === 0) {
        greenPercent += source.currentSharePercent;
      }
    }
    return parseFloat(Math.min(greenPercent, 100).toFixed(1));
  }

  getEnergySourceBreakdown() {
    const breakdown = [];
    for (const [key, source] of Object.entries(this.energySources)) {
      breakdown.push({
        source: key,
        label: source.label,
        sharePercent: source.currentSharePercent,
        kgCO2PerKWh: source.kgCO2PerKWh,
        isGreen: source.kgCO2PerKWh === 0,
      });
    }
    return breakdown;
  }

  // ---------------------------------------------------------------------------
  // Water footprint
  // ---------------------------------------------------------------------------

  recordWaterUsage(liters, date) {
    const day = date || new Date().toISOString().slice(0, 10);
    const existing = this.waterTracking.dailyUsageLiters.find((e) => e.date === day);
    if (existing) {
      existing.liters += liters;
    } else {
      this.waterTracking.dailyUsageLiters.push({ date: day, liters });
    }

    // Trim to last 365 days
    const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000;
    this.waterTracking.dailyUsageLiters = this.waterTracking.dailyUsageLiters.filter(
      (e) => new Date(e.date).getTime() > cutoff
    );

    this.log(`Recorded ${liters}L water usage for ${day}`);
  }

  getWaterFootprint(days) {
    const period = days || 30;
    const cutoff = Date.now() - period * 24 * 60 * 60 * 1000;
    const recent = this.waterTracking.dailyUsageLiters.filter(
      (e) => new Date(e.date).getTime() > cutoff
    );

    const totalLiters = recent.reduce((s, e) => s + e.liters, 0);
    const avgPerDay = recent.length > 0 ? totalLiters / recent.length : 0;
    const avgPerPerson = this.waterTracking.householdSize > 0
      ? avgPerDay / this.waterTracking.householdSize
      : avgPerDay;
    const swedenAvg = this.waterTracking.avgPerPersonPerDaySweden;
    const comparison = swedenAvg > 0 ? ((avgPerPerson / swedenAvg) * 100).toFixed(1) : 0;
    const savings = avgPerPerson < swedenAvg
      ? parseFloat(((swedenAvg - avgPerPerson) * this.waterTracking.householdSize * 30 * this.settings.waterPricePerLiter).toFixed(2))
      : 0;

    return {
      periodDays: period,
      totalLiters: parseFloat(totalLiters.toFixed(1)),
      avgPerDay: parseFloat(avgPerDay.toFixed(1)),
      avgPerPerson: parseFloat(avgPerPerson.toFixed(1)),
      swedenAvgPerPerson: swedenAvg,
      comparisonPercent: parseFloat(comparison),
      status: avgPerPerson <= swedenAvg ? 'below_average' : 'above_average',
      monthlyCostEstimate: parseFloat((avgPerDay * 30 * this.settings.waterPricePerLiter).toFixed(2)),
      monthlySavings: savings,
      currency: this.settings.currency,
    };
  }

  _recalculateMonthlyTarget() {
    this.waterTracking.monthlyTarget =
      this.waterTracking.avgPerPersonPerDaySweden *
      this.waterTracking.householdSize *
      30;
  }

  setHouseholdSize(size) {
    this.waterTracking.householdSize = Math.max(1, size);
    this._recalculateMonthlyTarget();
    this.log(`Household size set to ${this.waterTracking.householdSize}`);
  }

  // ---------------------------------------------------------------------------
  // Transport emissions
  // ---------------------------------------------------------------------------

  addTransportProfile(name, details) {
    const emissionFactors = {
      petrol_car: 0.21,
      diesel_car: 0.17,
      hybrid_car: 0.10,
      electric_car: 0.02,
      bus: 0.089,
      train: 0.041,
      bicycle: 0,
      walking: 0,
      motorcycle: 0.113,
      electric_scooter: 0.005,
    };

    const profile = {
      name,
      vehicleType: details.vehicleType || 'petrol_car',
      kgCO2PerKm: emissionFactors[details.vehicleType] || 0.21,
      trips: [],
      totalKm: 0,
      totalKgCO2: 0,
    };

    this.transportProfiles.set(name, profile);
    this.log(`Added transport profile: ${name} (${profile.vehicleType})`);
    return profile;
  }

  removeTransportProfile(name) {
    const removed = this.transportProfiles.delete(name);
    if (removed) {
      this.log(`Removed transport profile: ${name}`);
    } else {
      this.error(`Transport profile not found: ${name}`);
    }
    return removed;
  }

  logTrip(profileName, distanceKm, purpose) {
    const profile = this.transportProfiles.get(profileName);
    if (!profile) {
      this.error(`Transport profile not found: ${profileName}`);
      return null;
    }

    const kgCO2 = distanceKm * profile.kgCO2PerKm;
    const trip = {
      timestamp: new Date(),
      distanceKm,
      kgCO2: parseFloat(kgCO2.toFixed(4)),
      purpose: purpose || 'general',
    };

    profile.trips.push(trip);
    profile.totalKm += distanceKm;
    profile.totalKgCO2 += kgCO2;

    // Trim to last 365 trips
    if (profile.trips.length > 365) {
      profile.trips = profile.trips.slice(-365);
    }

    this.log(`Logged trip: ${distanceKm}km via ${profile.vehicleType} (${kgCO2.toFixed(3)} kgCO2)`);
    return trip;
  }

  getTransportSummary() {
    const profiles = [];
    let totalKgCO2 = 0;
    let totalKm = 0;

    for (const [name, profile] of this.transportProfiles.entries()) {
      const avgTripKm = profile.trips.length > 0
        ? parseFloat((profile.totalKm / profile.trips.length).toFixed(1))
        : 0;
      profiles.push({
        name,
        vehicleType: profile.vehicleType,
        totalKm: parseFloat(profile.totalKm.toFixed(1)),
        totalKgCO2: parseFloat(profile.totalKgCO2.toFixed(3)),
        tripCount: profile.trips.length,
        avgTripKm,
      });
      totalKgCO2 += profile.totalKgCO2;
      totalKm += profile.totalKm;
    }

    return {
      profiles,
      totalKm: parseFloat(totalKm.toFixed(1)),
      totalKgCO2: parseFloat(totalKgCO2.toFixed(3)),
    };
  }

  getTransportAlternatives(profileName, distanceKm) {
    const profile = this.transportProfiles.get(profileName);
    if (!profile) {
      this.error(`Transport profile not found: ${profileName}`);
      return null;
    }

    const currentCO2 = distanceKm * profile.kgCO2PerKm;
    const alternatives = [
      { mode: 'electric_car', kgCO2PerKm: 0.02 },
      { mode: 'bus', kgCO2PerKm: 0.089 },
      { mode: 'train', kgCO2PerKm: 0.041 },
      { mode: 'bicycle', kgCO2PerKm: 0 },
    ];

    return alternatives
      .filter((a) => a.kgCO2PerKm < profile.kgCO2PerKm)
      .map((a) => ({
        mode: a.mode,
        kgCO2: parseFloat((distanceKm * a.kgCO2PerKm).toFixed(4)),
        savings: parseFloat((currentCO2 - distanceKm * a.kgCO2PerKm).toFixed(4)),
        savingsPercent: parseFloat((((currentCO2 - distanceKm * a.kgCO2PerKm) / currentCO2) * 100).toFixed(1)),
      }));
  }

  // ---------------------------------------------------------------------------
  // Goals and streaks
  // ---------------------------------------------------------------------------

  addGoal(details) {
    const goal = {
      id: `goal_${Date.now()}`,
      name: details.name || 'Unnamed Goal',
      type: details.type || 'energy',
      target: details.target || 0,
      unit: details.unit || 'kWh',
      period: details.period || 'monthly',
      current: 0,
      streak: 0,
      longestStreak: 0,
      createdAt: new Date(),
      lastChecked: null,
      achieved: false,
      history: [],
    };

    this.goals.push(goal);
    this.log(`Added sustainability goal: "${goal.name}"`);
    this._checkBadgeEligibility();
    return goal;
  }

  removeGoal(goalId) {
    const idx = this.goals.findIndex((g) => g.id === goalId);
    if (idx === -1) {
      this.error(`Goal not found: ${goalId}`);
      return false;
    }
    this.goals.splice(idx, 1);
    this.log(`Removed goal: ${goalId}`);
    return true;
  }

  updateGoalProgress(goalId, currentValue) {
    const goal = this.goals.find((g) => g.id === goalId);
    if (!goal) {
      this.error(`Goal not found: ${goalId}`);
      return null;
    }

    goal.current = currentValue;
    goal.lastChecked = new Date();

    const previouslyAchieved = goal.achieved;
    goal.achieved = goal.type === 'reduction'
      ? currentValue <= goal.target
      : currentValue >= goal.target;

    if (goal.achieved && !previouslyAchieved) {
      goal.streak++;
      goal.longestStreak = Math.max(goal.longestStreak, goal.streak);
      this.log(`Goal achieved: "${goal.name}" — streak: ${goal.streak}`);
      this._checkBadgeEligibility();
    } else if (!goal.achieved && previouslyAchieved) {
      goal.streak = 0;
    }

    goal.history.push({
      timestamp: new Date(),
      value: currentValue,
      achieved: goal.achieved,
    });

    // Keep last 52 entries
    if (goal.history.length > 52) {
      goal.history = goal.history.slice(-52);
    }

    return goal;
  }

  getGoalsSummary() {
    return this.goals.map((g) => ({
      id: g.id,
      name: g.name,
      type: g.type,
      target: g.target,
      current: g.current,
      unit: g.unit,
      period: g.period,
      achieved: g.achieved,
      streak: g.streak,
      longestStreak: g.longestStreak,
      progressPercent: g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0,
    }));
  }

  // ---------------------------------------------------------------------------
  // Achievement badges (8 badges)
  // ---------------------------------------------------------------------------

  _buildBadges() {
    return [
      { id: 'first_step', name: 'First Step', description: 'Set your first sustainability goal', icon: '🌱', condition: 'goal_created', earned: false },
      { id: 'green_week', name: 'Green Week', description: 'Stay under energy target for 7 days', icon: '🌿', condition: 'energy_streak_7', earned: false },
      { id: 'solar_champion', name: 'Solar Champion', description: 'Generate more solar than grid usage', icon: '☀️', condition: 'solar_majority', earned: false },
      { id: 'water_saver', name: 'Water Saver', description: 'Stay below Swedish average water usage for 30 days', icon: '💧', condition: 'water_below_avg_30', earned: false },
      { id: 'carbon_neutral_day', name: 'Carbon Neutral Day', description: 'Achieve a zero-emission day', icon: '🌍', condition: 'zero_emission_day', earned: false },
      { id: 'streak_master', name: 'Streak Master', description: 'Maintain any goal streak for 30 periods', icon: '🔥', condition: 'streak_30', earned: false },
      { id: 'efficiency_expert', name: 'Efficiency Expert', description: 'All appliances rated A or better', icon: '⚡', condition: 'all_a_rated', earned: false },
      { id: 'eco_warrior', name: 'Eco Warrior', description: 'Reduce carbon footprint by 50% from baseline', icon: '🏆', condition: 'co2_reduction_50', earned: false },
    ];
  }

  _checkBadgeEligibility() {
    for (const badge of this.badges) {
      if (badge.earned) continue;

      let eligible = false;
      switch (badge.condition) {
        case 'goal_created':
          eligible = this.goals.length >= 1;
          break;
        case 'energy_streak_7':
          eligible = this.goals.some((g) => g.type === 'reduction' && g.streak >= 7);
          break;
        case 'solar_majority':
          eligible = this.getGreenEnergyPercentage() > 50;
          break;
        case 'water_below_avg_30': {
          const wf = this.getWaterFootprint(30);
          eligible = wf.status === 'below_average' && this.waterTracking.dailyUsageLiters.length >= 30;
          break;
        }
        case 'zero_emission_day': {
          const todayLog = this.homeEmissions.dailyLog.find(
            (e) => e.date === new Date().toISOString().slice(0, 10)
          );
          eligible = todayLog && todayLog.kgCO2 === 0;
          break;
        }
        case 'streak_30':
          eligible = this.goals.some((g) => g.longestStreak >= 30);
          break;
        case 'all_a_rated': {
          if (this.applianceEfficiency.size > 0) {
            eligible = true;
            for (const app of this.applianceEfficiency.values()) {
              const goodLabels = ['A', 'A+', 'A++', 'A+++'];
              if (!goodLabels.includes(app.euLabel)) {
                eligible = false;
                break;
              }
            }
          }
          break;
        }
        case 'co2_reduction_50': {
          const baselines = Object.values(this.homeEmissions.monthlyTotals);
          if (baselines.length >= 3) {
            const firstMonth = baselines[0].kgCO2;
            const lastMonth = baselines[baselines.length - 1].kgCO2;
            eligible = firstMonth > 0 && lastMonth <= firstMonth * 0.5;
          }
          break;
        }
        default:
          break;
      }

      if (eligible) {
        badge.earned = true;
        this.earnedBadges.push(badge.id);
        this.log(`Badge earned: "${badge.name}" — ${badge.description}`);
      }
    }
  }

  getBadges() {
    return this.badges.map((b) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      icon: b.icon,
      earned: b.earned,
    }));
  }

  // ---------------------------------------------------------------------------
  // Appliance efficiency scoring (EU A-G labels)
  // ---------------------------------------------------------------------------

  registerAppliance(applianceId, details) {
    const euLabels = ['A+++', 'A++', 'A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G'];
    const labelScores = {
      'A+++': 100, 'A++': 95, 'A+': 90, 'A': 85, 'B': 70,
      'C': 55, 'D': 40, 'E': 30, 'F': 20, 'G': 10,
    };

    const label = euLabels.includes(details.euLabel) ? details.euLabel : 'G';
    const appliance = {
      applianceId,
      name: details.name || applianceId,
      category: details.category || 'other',
      euLabel: label,
      efficiencyScore: labelScores[label] || 10,
      annualKWh: details.annualKWh || 0,
      purchaseYear: details.purchaseYear || null,
      estimatedLifeYears: details.estimatedLifeYears || 10,
      replacementCost: details.replacementCost || 0,
      upgradeSavingsPerYear: 0,
    };

    // Estimate upgrade savings if not already top-rated
    if (label !== 'A+++' && appliance.annualKWh > 0) {
      const bestCaseKWh = appliance.annualKWh * 0.4;
      const savingsKWh = appliance.annualKWh - bestCaseKWh;
      appliance.upgradeSavingsPerYear = parseFloat(
        (savingsKWh * this.settings.electricityPricePerKWh).toFixed(2)
      );
    }

    this.applianceEfficiency.set(applianceId, appliance);
    this.log(`Registered appliance: ${appliance.name} (EU label: ${label})`);
    return appliance;
  }

  getApplianceUpgradeROI(applianceId) {
    const appliance = this.applianceEfficiency.get(applianceId);
    if (!appliance) {
      this.error(`Appliance not found: ${applianceId}`);
      return null;
    }

    if (appliance.upgradeSavingsPerYear <= 0 || appliance.replacementCost <= 0) {
      return {
        appliance: appliance.name,
        currentLabel: appliance.euLabel,
        roiYears: null,
        recommendation: 'Insufficient data for ROI calculation',
      };
    }

    const roiYears = appliance.replacementCost / appliance.upgradeSavingsPerYear;
    const remainingLife = appliance.purchaseYear
      ? appliance.estimatedLifeYears - (new Date().getFullYear() - appliance.purchaseYear)
      : null;

    let recommendation;
    if (roiYears <= 3) {
      recommendation = 'Strongly recommend upgrading — excellent ROI';
    } else if (roiYears <= 5) {
      recommendation = 'Upgrade recommended — good ROI';
    } else if (roiYears <= 8) {
      recommendation = 'Consider upgrading when current appliance needs replacement';
    } else {
      recommendation = 'Keep current appliance — upgrade ROI is too long';
    }

    return {
      appliance: appliance.name,
      currentLabel: appliance.euLabel,
      annualSavings: appliance.upgradeSavingsPerYear,
      replacementCost: appliance.replacementCost,
      roiYears: parseFloat(roiYears.toFixed(1)),
      remainingLife,
      recommendation,
      currency: this.settings.currency,
    };
  }

  getEfficiencyOverview() {
    const appliances = [];
    for (const app of this.applianceEfficiency.values()) {
      appliances.push({
        name: app.name,
        euLabel: app.euLabel,
        efficiencyScore: app.efficiencyScore,
        annualKWh: app.annualKWh,
        upgradeSavingsPerYear: app.upgradeSavingsPerYear,
      });
    }
    appliances.sort((a, b) => a.efficiencyScore - b.efficiencyScore);

    const avgScore = appliances.length > 0
      ? Math.round(appliances.reduce((s, a) => s + a.efficiencyScore, 0) / appliances.length)
      : 0;

    return {
      appliances,
      averageEfficiencyScore: avgScore,
      totalAnnualKWh: appliances.reduce((s, a) => s + a.annualKWh, 0),
      totalUpgradeSavings: parseFloat(
        appliances.reduce((s, a) => s + a.upgradeSavingsPerYear, 0).toFixed(2)
      ),
      worstRated: appliances.length > 0 ? appliances[0] : null,
    };
  }

  // ---------------------------------------------------------------------------
  // EU EPC alignment tracking
  // ---------------------------------------------------------------------------

  setEPCRating(rating, details) {
    this.epcRating.currentRating = rating;
    this.epcRating.targetRating = details.targetRating || null;
    this.epcRating.assessmentDate = details.assessmentDate || new Date();
    this.epcRating.recommendations = details.recommendations || [];
    this.epcRating.improvementHistory.push({
      date: new Date(),
      rating,
      notes: details.notes || '',
    });
    this.log(`EPC rating set to ${rating}`);
    return this.epcRating;
  }

  getEPCProgress() {
    const ratingOrder = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    const currentIdx = ratingOrder.indexOf(this.epcRating.currentRating);
    const targetIdx = ratingOrder.indexOf(this.epcRating.targetRating);

    return {
      currentRating: this.epcRating.currentRating,
      targetRating: this.epcRating.targetRating,
      stepsToTarget: currentIdx >= 0 && targetIdx >= 0 ? currentIdx - targetIdx : null,
      assessmentDate: this.epcRating.assessmentDate,
      recommendations: this.epcRating.recommendations,
      improvementHistory: this.epcRating.improvementHistory,
    };
  }

  // ---------------------------------------------------------------------------
  // Neighbourhood benchmarking
  // ---------------------------------------------------------------------------

  updateNeighbourhoodBenchmark(data) {
    if (data.averageKgCO2PerMonth !== undefined) {
      this.neighbourhoodBenchmark.averageKgCO2PerMonth = data.averageKgCO2PerMonth;
    }
    if (data.averageKWhPerMonth !== undefined) {
      this.neighbourhoodBenchmark.averageKWhPerMonth = data.averageKWhPerMonth;
    }
    if (data.averageWaterLPerDay !== undefined) {
      this.neighbourhoodBenchmark.averageWaterLPerDay = data.averageWaterLPerDay;
    }
    this.neighbourhoodBenchmark.lastUpdated = new Date();
    this.log('Neighbourhood benchmark data updated');
  }

  getNeighbourhoodComparison() {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const myMonthly = this.homeEmissions.monthlyTotals[currentMonth] || { kWh: 0, kgCO2: 0 };
    const waterFP = this.getWaterFootprint(30);

    const co2Comparison = this.neighbourhoodBenchmark.averageKgCO2PerMonth > 0
      ? parseFloat(((myMonthly.kgCO2 / this.neighbourhoodBenchmark.averageKgCO2PerMonth) * 100).toFixed(1))
      : 0;

    const energyComparison = this.neighbourhoodBenchmark.averageKWhPerMonth > 0
      ? parseFloat(((myMonthly.kWh / this.neighbourhoodBenchmark.averageKWhPerMonth) * 100).toFixed(1))
      : 0;

    const waterComparison = this.neighbourhoodBenchmark.averageWaterLPerDay > 0
      ? parseFloat(((waterFP.avgPerDay / this.neighbourhoodBenchmark.averageWaterLPerDay) * 100).toFixed(1))
      : 0;

    return {
      co2: {
        yours: parseFloat(myMonthly.kgCO2.toFixed(2)),
        neighbourhoodAvg: this.neighbourhoodBenchmark.averageKgCO2PerMonth,
        percentOfAvg: co2Comparison,
        status: co2Comparison <= 100 ? 'better' : 'worse',
      },
      energy: {
        yours: parseFloat(myMonthly.kWh.toFixed(2)),
        neighbourhoodAvg: this.neighbourhoodBenchmark.averageKWhPerMonth,
        percentOfAvg: energyComparison,
        status: energyComparison <= 100 ? 'better' : 'worse',
      },
      water: {
        yours: waterFP.avgPerDay,
        neighbourhoodAvg: this.neighbourhoodBenchmark.averageWaterLPerDay,
        percentOfAvg: waterComparison,
        status: waterComparison <= 100 ? 'better' : 'worse',
      },
      lastUpdated: this.neighbourhoodBenchmark.lastUpdated,
    };
  }

  // ---------------------------------------------------------------------------
  // Seasonal baselines (Sweden)
  // ---------------------------------------------------------------------------

  _buildSeasonalBaselines() {
    return {
      1: { avgKWhPerDay: 35, avgWaterLPerDay: 280, label: 'January — Peak heating' },
      2: { avgKWhPerDay: 33, avgWaterLPerDay: 275, label: 'February — Cold, dark' },
      3: { avgKWhPerDay: 28, avgWaterLPerDay: 270, label: 'March — Transitional' },
      4: { avgKWhPerDay: 22, avgWaterLPerDay: 260, label: 'April — Spring beginning' },
      5: { avgKWhPerDay: 18, avgWaterLPerDay: 250, label: 'May — Warming up' },
      6: { avgKWhPerDay: 14, avgWaterLPerDay: 260, label: 'June — Summer, long days' },
      7: { avgKWhPerDay: 12, avgWaterLPerDay: 270, label: 'July — Peak summer' },
      8: { avgKWhPerDay: 13, avgWaterLPerDay: 265, label: 'August — Late summer' },
      9: { avgKWhPerDay: 18, avgWaterLPerDay: 255, label: 'September — Autumn start' },
      10: { avgKWhPerDay: 25, avgWaterLPerDay: 265, label: 'October — Getting colder' },
      11: { avgKWhPerDay: 30, avgWaterLPerDay: 275, label: 'November — Dark, cold' },
      12: { avgKWhPerDay: 36, avgWaterLPerDay: 280, label: 'December — Peak winter + holidays' },
    };
  }

  getSeasonalBaseline(month) {
    const m = typeof month === 'number' ? month : new Date().getMonth() + 1;
    return this.seasonalBaselines[m] || this.seasonalBaselines[1];
  }

  getSeasonalComparison() {
    const month = new Date().getMonth() + 1;
    const baseline = this.getSeasonalBaseline(month);
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayLog = this.homeEmissions.dailyLog.find((e) => e.date === todayStr);
    const todayKWh = todayLog ? todayLog.kWh : 0;
    const waterFP = this.getWaterFootprint(1);

    return {
      month,
      baseline,
      actual: {
        kWh: parseFloat(todayKWh.toFixed(2)),
        waterL: waterFP.avgPerDay,
      },
      comparison: {
        energyVsBaseline: baseline.avgKWhPerDay > 0
          ? parseFloat(((todayKWh / baseline.avgKWhPerDay) * 100).toFixed(1))
          : 0,
        waterVsBaseline: baseline.avgWaterLPerDay > 0
          ? parseFloat(((waterFP.avgPerDay / baseline.avgWaterLPerDay) * 100).toFixed(1))
          : 0,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Context-aware tips (15+)
  // ---------------------------------------------------------------------------

  _buildTips() {
    return [
      { id: 't1', text: 'Switch off standby devices — they can account for up to 10% of household energy.', category: 'energy', season: null },
      { id: 't2', text: 'Run dishwasher and washing machine during off-peak hours to reduce grid load.', category: 'energy', season: null },
      { id: 't3', text: 'Lower indoor temperature by 1°C to save approximately 5% on heating.', category: 'energy', season: 'winter' },
      { id: 't4', text: 'Use natural ventilation instead of AC on mild summer evenings.', category: 'energy', season: 'summer' },
      { id: 't5', text: 'Take shorter showers — reducing by 2 minutes saves ~20 liters per shower.', category: 'water', season: null },
      { id: 't6', text: 'Fix dripping taps — a single drip can waste 5,000 liters per year.', category: 'water', season: null },
      { id: 't7', text: 'Collect rainwater for garden irrigation during summer months.', category: 'water', season: 'summer' },
      { id: 't8', text: 'Consider cycling or public transport for trips under 5 km.', category: 'transport', season: null },
      { id: 't9', text: 'Plan errands to combine multiple stops in one trip.', category: 'transport', season: null },
      { id: 't10', text: 'Switch to LED bulbs — they use 75% less energy than incandescent.', category: 'energy', season: null },
      { id: 't11', text: 'During dark Swedish winters, use smart lighting schedules to minimise waste.', category: 'energy', season: 'winter' },
      { id: 't12', text: 'Use a programmable thermostat to reduce heating when you are away.', category: 'energy', season: 'winter' },
      { id: 't13', text: 'Air-dry laundry in summer instead of using a tumble dryer.', category: 'energy', season: 'summer' },
      { id: 't14', text: 'Seal windows and doors before winter to reduce heat loss.', category: 'energy', season: 'autumn' },
      { id: 't15', text: 'Install a water-efficient showerhead to reduce consumption by up to 40%.', category: 'water', season: null },
      { id: 't16', text: 'Use the eco-mode on your dishwasher and washing machine for daily loads.', category: 'energy', season: null },
    ];
  }

  getContextualTips(count) {
    const maxTips = count || 5;
    const month = new Date().getMonth() + 1;
    let currentSeason;
    if (month >= 3 && month <= 5) currentSeason = 'spring';
    else if (month >= 6 && month <= 8) currentSeason = 'summer';
    else if (month >= 9 && month <= 11) currentSeason = 'autumn';
    else currentSeason = 'winter';

    const relevant = this.tips.filter(
      (t) => t.season === null || t.season === currentSeason
    );

    // Shuffle with Fisher-Yates and pick
    const shuffled = relevant.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = tmp;
    }

    return shuffled.slice(0, maxTips).map((t) => ({
      id: t.id,
      tip: t.text,
      category: t.category,
    }));
  }

  // ---------------------------------------------------------------------------
  // Trends (daily / weekly / monthly / yearly)
  // ---------------------------------------------------------------------------

  getTrends(period) {
    const now = Date.now();
    let cutoff;
    let groupBy;

    switch (period) {
      case 'daily':
        cutoff = now - 7 * 24 * 60 * 60 * 1000;
        groupBy = 'day';
        break;
      case 'weekly':
        cutoff = now - 30 * 24 * 60 * 60 * 1000;
        groupBy = 'week';
        break;
      case 'monthly':
        cutoff = now - 365 * 24 * 60 * 60 * 1000;
        groupBy = 'month';
        break;
      case 'yearly':
        cutoff = 0;
        groupBy = 'year';
        break;
      default:
        cutoff = now - 30 * 24 * 60 * 60 * 1000;
        groupBy = 'day';
        break;
    }

    const filtered = this.homeEmissions.dailyLog.filter(
      (e) => new Date(e.date).getTime() > cutoff
    );

    const groups = {};
    for (const entry of filtered) {
      let key;
      if (groupBy === 'day') {
        key = entry.date;
      } else if (groupBy === 'week') {
        const d = new Date(entry.date);
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        key = weekStart.toISOString().slice(0, 10);
      } else if (groupBy === 'month') {
        key = entry.date.slice(0, 7);
      } else {
        key = entry.date.slice(0, 4);
      }

      if (!groups[key]) groups[key] = { kWh: 0, kgCO2: 0, count: 0 };
      groups[key].kWh += entry.kWh;
      groups[key].kgCO2 += entry.kgCO2;
      groups[key].count++;
    }

    const trendData = Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, data]) => ({
        period: key,
        kWh: parseFloat(data.kWh.toFixed(2)),
        kgCO2: parseFloat(data.kgCO2.toFixed(4)),
        dataPoints: data.count,
      }));

    // Calculate trend direction
    let trendDirection = 'stable';
    if (trendData.length >= 2) {
      const firstHalf = trendData.slice(0, Math.floor(trendData.length / 2));
      const secondHalf = trendData.slice(Math.floor(trendData.length / 2));
      const avgFirst = firstHalf.reduce((s, e) => s + e.kgCO2, 0) / firstHalf.length;
      const avgSecond = secondHalf.reduce((s, e) => s + e.kgCO2, 0) / secondHalf.length;
      if (avgSecond < avgFirst * 0.95) trendDirection = 'improving';
      else if (avgSecond > avgFirst * 1.05) trendDirection = 'worsening';
    }

    return {
      period: period || 'monthly',
      groupBy,
      data: trendData,
      trendDirection,
      dataPoints: trendData.length,
    };
  }

  // ---------------------------------------------------------------------------
  // Carbon offsets tracking
  // ---------------------------------------------------------------------------

  addCarbonOffset(details) {
    const offset = {
      id: `offset_${Date.now()}`,
      provider: details.provider || 'Unknown',
      kgCO2Offset: details.kgCO2Offset || 0,
      cost: details.cost || 0,
      currency: this.settings.currency,
      date: new Date(),
      project: details.project || 'General',
      verified: details.verified || false,
      certificateRef: details.certificateRef || null,
    };

    this.carbonOffsets.push(offset);
    this.log(`Carbon offset added: ${offset.kgCO2Offset} kgCO2 via ${offset.provider}`);
    return offset;
  }

  getCarbonOffsetSummary() {
    let totalOffset = 0;
    let totalCost = 0;
    let verifiedOffset = 0;

    for (const o of this.carbonOffsets) {
      totalOffset += o.kgCO2Offset;
      totalCost += o.cost;
      if (o.verified) verifiedOffset += o.kgCO2Offset;
    }

    const netEmissions = this.homeEmissions.totalKgCO2 - totalOffset;

    return {
      totalOffsetKgCO2: parseFloat(totalOffset.toFixed(2)),
      verifiedOffsetKgCO2: parseFloat(verifiedOffset.toFixed(2)),
      totalCost: parseFloat(totalCost.toFixed(2)),
      currency: this.settings.currency,
      totalEmissionsKgCO2: parseFloat(this.homeEmissions.totalKgCO2.toFixed(2)),
      netEmissionsKgCO2: parseFloat(Math.max(0, netEmissions).toFixed(2)),
      offsetPercentage: this.homeEmissions.totalKgCO2 > 0
        ? parseFloat(((totalOffset / this.homeEmissions.totalKgCO2) * 100).toFixed(1))
        : 0,
      purchaseCount: this.carbonOffsets.length,
      costPerKgCO2: totalOffset > 0 ? parseFloat((totalCost / totalOffset).toFixed(2)) : 0,
    };
  }

  // ---------------------------------------------------------------------------
  // Monthly report generation
  // ---------------------------------------------------------------------------

  generateMonthlyReport(month, year) {
    const now = new Date();
    const m = month || now.getMonth() + 1;
    const y = year || now.getFullYear();
    const monthKey = `${y}-${String(m).padStart(2, '0')}`;

    const monthlyData = this.homeEmissions.monthlyTotals[monthKey] || { kWh: 0, kgCO2: 0 };
    const waterFP = this.getWaterFootprint(30);
    const transportSum = this.getTransportSummary();
    const efficiency = this.getEfficiencyOverview();
    const greenPercent = this.getGreenEnergyPercentage();
    const offsetSum = this.getCarbonOffsetSummary();
    const neighbour = this.getNeighbourhoodComparison();
    const goals = this.getGoalsSummary();
    const badges = this.getBadges();
    const tips = this.getContextualTips(3);

    const report = {
      title: `Sustainability Report — ${monthKey}`,
      generatedAt: new Date(),
      energy: {
        totalKWh: parseFloat(monthlyData.kWh.toFixed(2)),
        totalKgCO2: parseFloat(monthlyData.kgCO2.toFixed(4)),
        greenEnergyPercent: greenPercent,
        estimatedCost: parseFloat((monthlyData.kWh * this.settings.electricityPricePerKWh).toFixed(2)),
        currency: this.settings.currency,
      },
      water: waterFP,
      transport: transportSum,
      applianceEfficiency: efficiency,
      carbonOffsets: offsetSum,
      neighbourhoodComparison: neighbour,
      goals,
      badgesEarned: badges.filter((b) => b.earned),
      tips,
      summary: this._generateReportSummary(monthlyData, waterFP, greenPercent),
    };

    this.log(`Generated monthly report for ${monthKey}`);
    return report;
  }

  _generateReportSummary(monthlyData, waterFP, greenPercent) {
    const lines = [];
    lines.push(`Total energy consumption: ${monthlyData.kWh.toFixed(1)} kWh`);
    lines.push(`Carbon emissions: ${monthlyData.kgCO2.toFixed(2)} kgCO2`);
    lines.push(`Green energy share: ${greenPercent}%`);
    lines.push(`Average daily water usage: ${waterFP.avgPerDay} L`);

    if (waterFP.status === 'below_average') {
      lines.push('Water usage is below the Swedish average — great job!');
    } else {
      lines.push('Water usage is above the Swedish average — consider reducing.');
    }

    if (greenPercent >= 80) {
      lines.push('Excellent green energy usage!');
    } else if (greenPercent >= 50) {
      lines.push('Good progress on green energy — keep increasing solar share.');
    } else {
      lines.push('Consider increasing renewable energy sources.');
    }

    return lines.join('\n');
  }

  // ---------------------------------------------------------------------------
  // Monitoring loop (30-minute interval)
  // ---------------------------------------------------------------------------

  _startMonitoringLoop() {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
    }

    this.monitoringTimer = setInterval(() => {
      this._runMonitoringCycle();
    }, this.settings.monitoringIntervalMs);

    this.log(`Monitoring loop started (interval: ${this.settings.monitoringIntervalMs / 1000}s)`);
  }

  _runMonitoringCycle() {
    this.log('Running sustainability monitoring cycle');

    // Check green energy percentage
    const greenPercent = this.getGreenEnergyPercentage();
    this.log(`Current green energy: ${greenPercent}%`);

    // Check seasonal comparison
    const seasonal = this.getSeasonalComparison();
    if (seasonal.comparison.energyVsBaseline > 120) {
      this.log(`Warning: Energy usage 20%+ above seasonal baseline`);
    }

    // Check water status
    const waterFP = this.getWaterFootprint(7);
    if (waterFP.status === 'above_average') {
      this.log(`Warning: Water usage above Swedish average (${waterFP.avgPerPerson}L vs ${waterFP.swedenAvgPerPerson}L)`);
    }

    // Check badge eligibility
    this._checkBadgeEligibility();

    // Auto-report on configured day
    const today = new Date();
    if (today.getDate() === this.settings.reportDay) {
      const lastMonth = today.getMonth() === 0 ? 12 : today.getMonth();
      const lastYear = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear();
      this.generateMonthlyReport(lastMonth, lastYear);
    }
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  async _loadSettings() {
    try {
      const saved = await this.homey.settings.get('sustainabilitySettings');
      if (saved) {
        const parsed = typeof saved === 'string' ? JSON.parse(saved) : saved;
        Object.assign(this.settings, parsed);
        this.log('Settings loaded');
      }
    } catch (err) {
      this.error(`Failed to load settings: ${err.message}`);
    }

    try {
      const savedEmissions = await this.homey.settings.get('sustainabilityEmissions');
      if (savedEmissions) {
        const parsed = typeof savedEmissions === 'string' ? JSON.parse(savedEmissions) : savedEmissions;
        if (parsed.homeEmissions) {
          Object.assign(this.homeEmissions, parsed.homeEmissions);
        }
        if (parsed.earnedBadges) {
          this.earnedBadges = parsed.earnedBadges;
          for (const badgeId of this.earnedBadges) {
            const badge = this.badges.find((b) => b.id === badgeId);
            if (badge) badge.earned = true;
          }
        }
        this.log('Emission data loaded');
      }
    } catch (err) {
      this.error(`Failed to load emissions data: ${err.message}`);
    }
  }

  async _saveSettings() {
    try {
      await this.homey.settings.set('sustainabilitySettings', JSON.stringify(this.settings));
      await this.homey.settings.set('sustainabilityEmissions', JSON.stringify({
        homeEmissions: this.homeEmissions,
        earnedBadges: this.earnedBadges,
      }));
      this.log('Settings and data saved');
    } catch (err) {
      this.error(`Failed to save settings: ${err.message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Statistics
  // ---------------------------------------------------------------------------

  getStatistics() {
    const greenPercent = this.getGreenEnergyPercentage();
    const waterFP = this.getWaterFootprint(30);
    const transportSum = this.getTransportSummary();
    const efficiency = this.getEfficiencyOverview();
    const offsetSum = this.getCarbonOffsetSummary();

    return {
      system: 'HomeSustainabilityTrackerSystem',
      initialized: this.initialized,
      totalKgCO2: parseFloat(this.homeEmissions.totalKgCO2.toFixed(2)),
      greenEnergyPercent: greenPercent,
      trackedDevices: this.deviceEmissions.size,
      trackedRooms: this.roomEmissions.size,
      waterAvgPerDay: waterFP.avgPerDay,
      waterStatus: waterFP.status,
      transportProfiles: transportSum.profiles.length,
      transportTotalKgCO2: transportSum.totalKgCO2,
      activeGoals: this.goals.length,
      achievedGoals: this.goals.filter((g) => g.achieved).length,
      earnedBadges: this.earnedBadges.length,
      totalBadges: this.badges.length,
      applianceCount: this.applianceEfficiency.size,
      avgEfficiencyScore: efficiency.averageEfficiencyScore,
      carbonOffsetsKgCO2: offsetSum.totalOffsetKgCO2,
      netEmissionsKgCO2: offsetSum.netEmissionsKgCO2,
      epcRating: this.epcRating.currentRating,
      monthlyReportDay: this.settings.reportDay,
    };
  }

  // ---------------------------------------------------------------------------
  // Logging
  // ---------------------------------------------------------------------------

  log(msg) {
    const ts = new Date().toISOString();
    if (this.homey && typeof this.homey.log === 'function') {
      this.homey.log(`[Sustainability] ${msg}`);
    } else {
      console.log(`[${ts}] [Sustainability] ${msg}`);
    }
  }

  error(msg) {
    const ts = new Date().toISOString();
    if (this.homey && typeof this.homey.error === 'function') {
      this.homey.error(`[Sustainability] ${msg}`);
    } else {
      console.error(`[${ts}] [Sustainability] ${msg}`);
    }
  }
}

module.exports = HomeSustainabilityTrackerSystem;
