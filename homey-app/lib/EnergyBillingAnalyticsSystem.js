'use strict';

/**
 * Energy Billing Analytics System
 * Utility bill tracking, cost analytics, budget management, and savings recommendations
 */
class EnergyBillingAnalyticsSystem {
  constructor(homey) {
    this.homey = homey;
    this.billingHistory = [];
    this.maxHistoryMonths = 24;
    this.devicePowerReadings = new Map();
    this.monthlyBudget = { electricity: 0, gas: 0, water: 0, total: 0 };
    this.budgetAlerts = { enabled: true, thresholds: [50, 75, 90, 100] };
    this.notifiedThresholds = new Set();
    this.ratePlans = new Map();
    this.activeRatePlan = 'flat';
    this.solarGeneration = { totalKwh: 0, dailyReadings: [] };
    this.carbonFactorKwhKg = 0.045;
    this.carbonFactorGasKg = 2.0;
    this.anomalyThreshold = 1.5;
    this.anomalies = [];
    this.seasonalData = { winter: [], spring: [], summer: [], autumn: [] };
    this.investments = [];
    this._intervals = [];
  }

  async initialize() {
    this.log('Initierar Energy Billing Analytics System...');
    try {
      await this.loadBillingHistory();
      await this.loadBudgetSettings();
      await this.loadRatePlans();
      await this.loadInvestments();
      await this.loadSolarData();
      await this.initializeDefaultRatePlans();
      this._startPeriodicTasks();
      this.log('Energy Billing Analytics System initierat');
    } catch (error) {
      this.error(`Initiering misslyckades: ${error.message}`);
    }
  }

  _startPeriodicTasks() {
    const schedule = (fn, ms) => { this._intervals.push(setInterval(fn, ms)); };
    schedule(() => this.collectDevicePowerReadings().catch(e => this.error(`Enhetsdata: ${e.message}`)), 300000);
    schedule(() => this.evaluateBudget().catch(e => this.error(`Budget: ${e.message}`)), 1800000);
    schedule(() => this.detectAnomalies().catch(e => this.error(`Anomali: ${e.message}`)), 3600000);
    schedule(() => { this.recordDailySolarReading(); this.updateSeasonalData(); }, 86400000);
  }

  // -- Persistence --

  async loadBillingHistory() {
    this.billingHistory = await this.homey.settings.get('billingHistory') || [];
    this.log(`Laddade ${this.billingHistory.length} fakturaposter`);
  }

  async saveBillingHistory() {
    const cutoff = Date.now() - this.maxHistoryMonths * 30 * 86400000;
    this.billingHistory = this.billingHistory.filter(b => b.timestamp >= cutoff);
    await this.homey.settings.set('billingHistory', this.billingHistory);
  }

  async loadBudgetSettings() {
    const s = await this.homey.settings.get('energyBudgetSettings') || {};
    if (s.budget) this.monthlyBudget = s.budget;
    if (s.alerts) this.budgetAlerts = s.alerts;
  }

  async saveBudgetSettings() {
    await this.homey.settings.set('energyBudgetSettings', { budget: this.monthlyBudget, alerts: this.budgetAlerts });
  }

  async loadRatePlans() {
    const s = await this.homey.settings.get('energyRatePlans') || {};
    if (s.plans) this.ratePlans = new Map(Object.entries(s.plans));
    this.activeRatePlan = s.active || 'flat';
  }

  async saveRatePlans() {
    await this.homey.settings.set('energyRatePlans', { plans: Object.fromEntries(this.ratePlans), active: this.activeRatePlan });
  }

  async loadInvestments() { this.investments = await this.homey.settings.get('energyInvestments') || []; }
  async saveInvestments() { await this.homey.settings.set('energyInvestments', this.investments); }
  async loadSolarData() { this.solarGeneration = await this.homey.settings.get('solarGenerationData') || this.solarGeneration; }
  async saveSolarData() { await this.homey.settings.set('solarGenerationData', this.solarGeneration); }

  // -- 1. Bill Tracking --

  async recordBill(type, amount, kwh, period, metadata = {}) {
    try {
      if (!['electricity', 'gas', 'water'].includes(type)) throw new Error(`Okänd fakturatyp: ${type}`);
      const bill = {
        id: `bill_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type, amount: parseFloat(amount), kwh: parseFloat(kwh) || 0, period,
        timestamp: Date.now(),
        month: parseInt(period.split('-')[1], 10),
        year: parseInt(period.split('-')[0], 10),
        ...metadata
      };
      this.billingHistory.push(bill);
      await this.saveBillingHistory();
      this.log(`Faktura registrerad: ${type} ${amount} SEK för ${period}`);
      const label = type === 'electricity' ? 'el' : type === 'gas' ? 'gas' : 'vatten';
      await this.homey.notifications.createNotification({ excerpt: `Ny ${label}faktura registrerad: ${amount} SEK (${period})` }).catch(() => {});
      return bill;
    } catch (error) {
      this.error(`Kunde inte registrera faktura: ${error.message}`);
      throw error;
    }
  }

  getBillsByPeriod(period) { return this.billingHistory.filter(b => b.period === period); }
  getBillsByType(type) { return this.billingHistory.filter(b => b.type === type); }

  // -- 2. Per-device Cost Breakdown --

  async collectDevicePowerReadings() {
    try {
      const devices = await this.homey.devices.getDevices();
      const now = Date.now();
      const weekAgo = now - 7 * 86400000;
      for (const [id, device] of Object.entries(devices)) {
        const power = device.capabilitiesObj?.measure_power?.value;
        if (power == null) continue;
        if (!this.devicePowerReadings.has(id)) this.devicePowerReadings.set(id, []);
        const readings = this.devicePowerReadings.get(id);
        readings.push({ timestamp: now, watts: power });
        this.devicePowerReadings.set(id, readings.filter(r => r.timestamp >= weekAgo));
      }
    } catch (error) {
      this.error(`Enhetsavläsning misslyckades: ${error.message}`);
    }
  }

  calculateDeviceCost(deviceId, hoursBack = 720) {
    const readings = this.devicePowerReadings.get(deviceId) || [];
    const cutoff = Date.now() - hoursBack * 3600000;
    const rel = readings.filter(r => r.timestamp >= cutoff);
    if (rel.length < 2) return { kwh: 0, cost: 0 };
    let totalKwh = 0;
    for (let i = 1; i < rel.length; i++) {
      const dt = (rel[i].timestamp - rel[i - 1].timestamp) / 3600000;
      totalKwh += ((rel[i].watts + rel[i - 1].watts) / 2 / 1000) * dt;
    }
    const cost = totalKwh * this.getCurrentRate();
    return { kwh: parseFloat(totalKwh.toFixed(3)), cost: parseFloat(cost.toFixed(2)) };
  }

  async getDeviceCostBreakdown() {
    const breakdown = [];
    const devices = await this.homey.devices.getDevices();
    for (const [id, device] of Object.entries(devices)) {
      const c = this.calculateDeviceCost(id);
      if (c.kwh > 0) breakdown.push({ deviceId: id, name: device.name || id, kwh: c.kwh, cost: c.cost });
    }
    return breakdown.sort((a, b) => b.cost - a.cost);
  }

  // -- 3. Budget Management --

  async setBudget(electricity, gas = 0, water = 0) {
    const el = parseFloat(electricity), g = parseFloat(gas), w = parseFloat(water);
    this.monthlyBudget = { electricity: el, gas: g, water: w, total: el + g + w };
    this.notifiedThresholds.clear();
    await this.saveBudgetSettings();
    this.log(`Budget uppdaterat: El ${el} SEK, Gas ${g} SEK, Vatten ${w} SEK`);
  }

  getCurrentMonthSpending() {
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const spending = { electricity: 0, gas: 0, water: 0, total: 0 };
    for (const bill of this.getBillsByPeriod(period)) {
      spending[bill.type] = (spending[bill.type] || 0) + bill.amount;
      spending.total += bill.amount;
    }
    return spending;
  }

  async evaluateBudget() {
    if (!this.budgetAlerts.enabled || this.monthlyBudget.total <= 0) return;
    const spending = this.getCurrentMonthSpending();
    const pct = (spending.total / this.monthlyBudget.total) * 100;
    for (const t of this.budgetAlerts.thresholds) {
      if (pct >= t && !this.notifiedThresholds.has(t)) {
        this.notifiedThresholds.add(t);
        const msg = t >= 100
          ? `⚠️ Energibudgeten har överskridits! ${spending.total.toFixed(0)} / ${this.monthlyBudget.total.toFixed(0)} SEK (${pct.toFixed(0)}%)`
          : `Energibudget: ${pct.toFixed(0)}% förbrukad (${spending.total.toFixed(0)} / ${this.monthlyBudget.total.toFixed(0)} SEK)`;
        this.log(msg);
        await this.homey.notifications.createNotification({ excerpt: msg }).catch(() => {});
      }
    }
  }

  // -- 4. Rate Plans & Multi-tariff --

  async initializeDefaultRatePlans() {
    if (this.ratePlans.size > 0) return;
    this.ratePlans.set('flat', { name: 'Fast pris', type: 'flat', rate: 1.5 });
    this.ratePlans.set('tiered', { name: 'Stegvis tariff', type: 'tiered', tiers: [
      { upToKwh: 500, rate: 1.2 }, { upToKwh: 1000, rate: 1.6 }, { upToKwh: Infinity, rate: 2.0 }
    ]});
    this.ratePlans.set('time-of-use', { name: 'Tid-baserad tariff', type: 'time-of-use',
      peakHours: { start: 7, end: 19, rate: 2.2 }, offPeakRate: 0.9, weekendRate: 0.8
    });
    this.ratePlans.set('dynamic', { name: 'Dynamiskt elpris', type: 'dynamic',
      baseRate: 1.0, multipliers: { peak: 2.0, shoulder: 1.3, offPeak: 0.6 }
    });
    this.ratePlans.set('day-night', { name: 'Dag/Natt-tariff', type: 'day-night',
      dayHours: { start: 6, end: 22, rate: 1.8 }, nightRate: 0.7, holidayRate: 0.6
    });
    await this.saveRatePlans();
    this.log('Standard-tariffplaner skapade');
  }

  async setActiveRatePlan(planId) {
    if (!this.ratePlans.has(planId)) throw new Error(`Tariffplan "${planId}" finns inte`);
    this.activeRatePlan = planId;
    await this.saveRatePlans();
    this.log(`Aktiv tariffplan ändrad till: ${planId}`);
  }

  async addRatePlan(id, plan) {
    this.ratePlans.set(id, plan);
    await this.saveRatePlans();
    return plan;
  }

  getCurrentRate(date = new Date()) {
    const plan = this.ratePlans.get(this.activeRatePlan);
    if (!plan) return 1.5;
    const hour = date.getHours();
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    switch (plan.type) {
      case 'flat': return plan.rate;
      case 'tiered': return plan.tiers[1]?.rate || plan.tiers[0].rate;
      case 'time-of-use':
        if (isWeekend) return plan.weekendRate;
        return (hour >= plan.peakHours.start && hour < plan.peakHours.end) ? plan.peakHours.rate : plan.offPeakRate;
      case 'dynamic':
        if ((hour >= 7 && hour < 10) || (hour >= 17 && hour < 21)) return plan.baseRate * plan.multipliers.peak;
        if (hour >= 10 && hour < 17) return plan.baseRate * plan.multipliers.shoulder;
        return plan.baseRate * plan.multipliers.offPeak;
      case 'day-night':
        if (isWeekend) return plan.holidayRate || plan.nightRate;
        return (hour >= plan.dayHours.start && hour < plan.dayHours.end) ? plan.dayHours.rate : plan.nightRate;
      default: return 1.5;
    }
  }

  calculateTieredCost(kwh) {
    const plan = this.ratePlans.get('tiered');
    if (!plan) return kwh * 1.5;
    let remaining = kwh, cost = 0, prev = 0;
    for (const tier of plan.tiers) {
      const chunk = Math.min(remaining, (tier.upToKwh === Infinity ? remaining : tier.upToKwh - prev));
      cost += chunk * tier.rate;
      remaining -= chunk;
      prev = tier.upToKwh;
      if (remaining <= 0) break;
    }
    return parseFloat(cost.toFixed(2));
  }

  // -- 5. Cost Forecasting --

  forecastEndOfMonth() {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const fraction = now.getDate() / daysInMonth;
    if (fraction < 0.05) return { estimated: 0, confidence: 0, note: 'Inte tillräckligt med data' };
    const spending = this.getCurrentMonthSpending();
    const projected = spending.total / fraction;
    const confidence = Math.min(fraction * 1.2, 0.95);
    return {
      currentSpending: parseFloat(spending.total.toFixed(2)),
      estimated: parseFloat(projected.toFixed(2)),
      remaining: parseFloat((projected - spending.total).toFixed(2)),
      daysLeft: daysInMonth - now.getDate(),
      confidence: parseFloat(confidence.toFixed(2)),
      overBudget: this.monthlyBudget.total > 0 ? projected > this.monthlyBudget.total : null,
      budgetDiff: this.monthlyBudget.total > 0 ? parseFloat((projected - this.monthlyBudget.total).toFixed(2)) : null
    };
  }

  // -- 6. Comparison Analytics --

  comparePeriods(periodA, periodB) {
    const sum = bills => bills.reduce((s, b) => s + b.amount, 0);
    const kwh = bills => bills.reduce((s, b) => s + b.kwh, 0);
    const bA = this.getBillsByPeriod(periodA), bB = this.getBillsByPeriod(periodB);
    const sA = sum(bA), sB = sum(bB), diff = sA - sB;
    return {
      periodA: { period: periodA, total: sA, kwh: kwh(bA) },
      periodB: { period: periodB, total: sB, kwh: kwh(bB) },
      difference: parseFloat(diff.toFixed(2)),
      percentChange: sB !== 0 ? parseFloat(((diff / sB) * 100).toFixed(1)) : 0,
      direction: diff > 0 ? 'ökning' : diff < 0 ? 'minskning' : 'oförändrad'
    };
  }

  compareMonthOverMonth() {
    const now = new Date();
    const cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return this.comparePeriods(cur, `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`);
  }

  compareYearOverYear() {
    const now = new Date();
    const cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return this.comparePeriods(cur, `${now.getFullYear() - 1}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  }

  // -- 7. Savings Recommendations --

  async getSavingsRecommendations() {
    const recs = [];
    try {
      const breakdown = await this.getDeviceCostBreakdown();
      for (const dev of breakdown.slice(0, 5)) {
        recs.push({ type: 'device', priority: 'high', device: dev.name, monthlyCost: dev.cost,
          suggestion: `"${dev.name}" kostar ~${dev.cost} SEK/mån. Schemalägga eller byt till effektivare alternativ.` });
      }
      const forecast = this.forecastEndOfMonth();
      if (forecast.overBudget) {
        recs.push({ type: 'budget', priority: 'high',
          suggestion: `Prognos ${forecast.estimated} SEK överskrider budget med ${forecast.budgetDiff} SEK.` });
      }
      const peak = this.analyzePeakHours();
      if (peak.peakPercentage > 40) {
        recs.push({ type: 'peak_shift', priority: 'medium',
          suggestion: `${peak.peakPercentage.toFixed(0)}% förbrukas under rusningstid. Flytta last till nätter/helger.` });
      }
      const seasonal = this.getSeasonalComparison();
      if (seasonal.winterAvg > 0 && seasonal.summerAvg > 0 && seasonal.winterAvg > seasonal.summerAvg * 1.8) {
        recs.push({ type: 'seasonal', priority: 'medium',
          suggestion: `Vinterkostnader ${((seasonal.winterAvg / seasonal.summerAvg - 1) * 100).toFixed(0)}% högre. Överväg bättre isolering.` });
      }
    } catch (error) {
      this.error(`Besparingsrekommendationer misslyckades: ${error.message}`);
    }
    return recs;
  }

  // -- 8. Peak Hour Tracking --

  analyzePeakHours() {
    const hourly = new Array(24).fill(0);
    let total = 0;
    for (const [, readings] of this.devicePowerReadings) {
      for (const r of readings) {
        const h = new Date(r.timestamp).getHours();
        hourly[h] += r.watts;
        total += r.watts;
      }
    }
    let peakUsage = 0;
    for (let h = 7; h < 21; h++) peakUsage += hourly[h];
    const most = hourly.indexOf(Math.max(...hourly));
    return {
      hourlyUsage: hourly,
      peakPercentage: total > 0 ? parseFloat(((peakUsage / total) * 100).toFixed(1)) : 0,
      mostExpensiveHour: most,
      mostExpensiveHourRate: this.getCurrentRate(new Date(2026, 0, 1, most))
    };
  }

  // -- 9. Solar Offset --

  async recordSolarGeneration(kwh) {
    try {
      this.solarGeneration.totalKwh += parseFloat(kwh);
      this.solarGeneration.dailyReadings.push({ date: new Date().toISOString().slice(0, 10), kwh: parseFloat(kwh), timestamp: Date.now() });
      if (this.solarGeneration.dailyReadings.length > 365) this.solarGeneration.dailyReadings = this.solarGeneration.dailyReadings.slice(-365);
      await this.saveSolarData();
      this.log(`Solproduktion registrerad: ${kwh} kWh`);
    } catch (error) {
      this.error(`Kunde inte registrera solproduktion: ${error.message}`);
    }
  }

  async recordDailySolarReading() {
    const devices = await this.homey.devices.getDevices();
    for (const device of Object.values(devices)) {
      if (device.name?.toLowerCase().includes('solar') && device.capabilitiesObj?.meter_power?.value != null) {
        await this.recordSolarGeneration(device.capabilitiesObj.meter_power.value);
        break;
      }
    }
  }

  calculateSolarOffset(months = 1) {
    const cutoff = Date.now() - months * 30 * 86400000;
    const solarKwh = this.solarGeneration.dailyReadings.filter(r => r.timestamp >= cutoff).reduce((s, r) => s + r.kwh, 0);
    const gridKwh = this.billingHistory.filter(b => b.type === 'electricity' && b.timestamp >= cutoff).reduce((s, b) => s + b.kwh, 0);
    const total = gridKwh + solarKwh;
    return {
      solarKwh: parseFloat(solarKwh.toFixed(2)),
      gridKwh: parseFloat(gridKwh.toFixed(2)),
      totalConsumptionKwh: parseFloat(total.toFixed(2)),
      offsetPercentage: total > 0 ? parseFloat(((solarKwh / total) * 100).toFixed(1)) : 0,
      estimatedSavings: parseFloat((solarKwh * this.getCurrentRate()).toFixed(2)),
      periodMonths: months
    };
  }

  // -- 10. Carbon Footprint --

  calculateCarbonFootprint(months = 1) {
    const cutoff = Date.now() - months * 30 * 86400000;
    const elKwh = this.billingHistory.filter(b => b.type === 'electricity' && b.timestamp >= cutoff).reduce((s, b) => s + b.kwh, 0);
    const gasKwh = this.billingHistory.filter(b => b.type === 'gas' && b.timestamp >= cutoff).reduce((s, b) => s + b.kwh, 0);
    const solarSaved = this.calculateSolarOffset(months).solarKwh * this.carbonFactorKwhKg;
    const total = Math.max(0, elKwh * this.carbonFactorKwhKg + gasKwh * this.carbonFactorGasKg - solarSaved);
    return {
      electricityCO2kg: parseFloat((elKwh * this.carbonFactorKwhKg).toFixed(2)),
      gasCO2kg: parseFloat((gasKwh * this.carbonFactorGasKg).toFixed(2)),
      solarOffsetCO2kg: parseFloat(solarSaved.toFixed(2)),
      totalCO2kg: parseFloat(total.toFixed(2)),
      treesEquivalent: parseFloat((total / 21).toFixed(1)),
      periodMonths: months
    };
  }

  // -- 11. Export Functionality --

  generateBillSummary(period) {
    const bills = this.getBillsByPeriod(period);
    const byType = { electricity: [], gas: [], water: [] };
    for (const b of bills) if (byType[b.type]) byType[b.type].push(b);
    const totals = {};
    for (const [type, items] of Object.entries(byType)) {
      totals[type] = {
        count: items.length,
        totalAmount: parseFloat(items.reduce((s, b) => s + b.amount, 0).toFixed(2)),
        totalKwh: parseFloat(items.reduce((s, b) => s + b.kwh, 0).toFixed(2))
      };
    }
    const grand = Object.values(totals).reduce((s, t) => s + t.totalAmount, 0);
    return {
      period, generatedAt: new Date().toISOString(), bills: byType, totals,
      grandTotal: parseFloat(grand.toFixed(2)),
      carbon: this.calculateCarbonFootprint(1),
      solar: this.calculateSolarOffset(1),
      budget: { limit: this.monthlyBudget.total, spent: grand,
        remaining: parseFloat((this.monthlyBudget.total - grand).toFixed(2)),
        status: grand > this.monthlyBudget.total ? 'överskriden' : 'inom budget' }
    };
  }

  exportHistoryAsJSON(months = 12) {
    const cutoff = Date.now() - months * 30 * 86400000;
    const records = this.billingHistory.filter(b => b.timestamp >= cutoff);
    const totalSpent = records.reduce((s, b) => s + b.amount, 0);
    return {
      exportedAt: new Date().toISOString(), months, recordCount: records.length, records,
      summary: {
        totalSpent: parseFloat(totalSpent.toFixed(2)),
        totalKwh: parseFloat(records.reduce((s, b) => s + b.kwh, 0).toFixed(2)),
        averageMonthly: records.length > 0 ? parseFloat((totalSpent / months).toFixed(2)) : 0
      }
    };
  }

  // -- 12. Anomaly Detection --

  async detectAnomalies() {
    try {
      const elBills = this.billingHistory.filter(b => b.type === 'electricity');
      if (elBills.length < 3) return;
      const amounts = elBills.map(b => b.amount);
      const mean = amounts.reduce((s, v) => s + v, 0) / amounts.length;
      const stdDev = Math.sqrt(amounts.reduce((s, v) => s + (v - mean) ** 2, 0) / amounts.length);
      const latest = elBills[elBills.length - 1];
      const z = stdDev > 0 ? (latest.amount - mean) / stdDev : 0;
      if (Math.abs(z) > this.anomalyThreshold) {
        this.anomalies.push({ timestamp: Date.now(), billId: latest.id, amount: latest.amount,
          mean: parseFloat(mean.toFixed(2)), zScore: parseFloat(z.toFixed(2)), direction: z > 0 ? 'hög' : 'låg' });
        if (this.anomalies.length > 100) this.anomalies = this.anomalies.slice(-100);
        const msg = z > 0
          ? `⚠️ Ovanligt hög förbrukning: ${latest.amount} SEK (snitt ${mean.toFixed(0)} SEK)`
          : `ℹ️ Ovanligt låg förbrukning: ${latest.amount} SEK (snitt ${mean.toFixed(0)} SEK)`;
        this.log(msg);
        await this.homey.notifications.createNotification({ excerpt: msg }).catch(() => {});
      }
      await this.detectDeviceAnomalies();
    } catch (error) {
      this.error(`Anomalidetektering misslyckades: ${error.message}`);
    }
  }

  async detectDeviceAnomalies() {
    for (const [deviceId, readings] of this.devicePowerReadings) {
      if (readings.length < 10) continue;
      const watts = readings.map(r => r.watts);
      const mean = watts.reduce((s, v) => s + v, 0) / watts.length;
      const stdDev = Math.sqrt(watts.reduce((s, v) => s + (v - mean) ** 2, 0) / watts.length);
      const latest = watts[watts.length - 1];
      if (stdDev > 0 && (latest - mean) / stdDev > this.anomalyThreshold) {
        this.log(`Enhetsanomali: ${deviceId} — ${latest}W (snitt ${mean.toFixed(0)}W)`);
      }
    }
  }

  // -- 13. Appliance Cost Ranking --

  async getApplianceCostRanking(limit = 10) {
    const breakdown = await this.getDeviceCostBreakdown();
    const total = breakdown.reduce((s, d) => s + d.cost, 0);
    return breakdown.slice(0, limit).map((d, i) => ({
      rank: i + 1, name: d.name, deviceId: d.deviceId, kwh: d.kwh, cost: d.cost,
      percentage: total > 0 ? parseFloat(((d.cost / total) * 100).toFixed(1)) : 0
    }));
  }

  // -- 14. Seasonal Analysis --

  getSeason(month) {
    if (month >= 3 && month <= 5) return 'spring';
    if (month >= 6 && month <= 8) return 'summer';
    if (month >= 9 && month <= 11) return 'autumn';
    return 'winter';
  }

  async updateSeasonalData() {
    const now = new Date();
    const season = this.getSeason(now.getMonth() + 1);
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const total = this.getBillsByPeriod(period).reduce((s, b) => s + b.amount, 0);
    if (total > 0) {
      this.seasonalData[season].push({ period, total: parseFloat(total.toFixed(2)), timestamp: Date.now() });
      for (const key of Object.keys(this.seasonalData)) {
        if (this.seasonalData[key].length > 36) this.seasonalData[key] = this.seasonalData[key].slice(-36);
      }
    }
  }

  getSeasonalComparison() {
    const avg = season => {
      const d = this.seasonalData[season];
      return d.length === 0 ? 0 : d.reduce((s, x) => s + x.total, 0) / d.length;
    };
    const seasons = ['winter', 'spring', 'summer', 'autumn'];
    return {
      winterAvg: parseFloat(avg('winter').toFixed(2)),
      springAvg: parseFloat(avg('spring').toFixed(2)),
      summerAvg: parseFloat(avg('summer').toFixed(2)),
      autumnAvg: parseFloat(avg('autumn').toFixed(2)),
      mostExpensive: seasons.sort((a, b) => avg(b) - avg(a))[0],
      leastExpensive: seasons.sort((a, b) => avg(a) - avg(b))[0]
    };
  }

  // -- 15. ROI Calculator --

  async addInvestment(name, cost, monthlySavings, lifespanYears = 20) {
    const c = parseFloat(cost), ms = parseFloat(monthlySavings);
    const inv = {
      id: `inv_${Date.now()}`, name, cost: c, estimatedMonthlySavings: ms, lifespanYears,
      createdAt: Date.now(),
      paybackMonths: parseFloat((c / ms).toFixed(1)),
      totalLifetimeSavings: parseFloat((ms * lifespanYears * 12 - c).toFixed(2)),
      roi: parseFloat(((ms * lifespanYears * 12 - c) / c * 100).toFixed(1))
    };
    this.investments.push(inv);
    await this.saveInvestments();
    this.log(`Investering tillagd: ${name} — återbetalningstid ${inv.paybackMonths} mån`);
    await this.homey.notifications.createNotification({
      excerpt: `Ny investering "${name}": återbetalningstid ${inv.paybackMonths} mån, ROI ${inv.roi}%`
    }).catch(() => {});
    return inv;
  }

  calculateROI(investmentId) {
    const inv = this.investments.find(i => i.id === investmentId);
    if (!inv) return null;
    const monthsOwned = (Date.now() - inv.createdAt) / (30 * 86400000);
    const saved = inv.estimatedMonthlySavings * monthsOwned;
    const net = saved - inv.cost;
    return {
      name: inv.name, initialCost: inv.cost,
      monthsOwned: parseFloat(monthsOwned.toFixed(1)),
      savedSoFar: parseFloat(saved.toFixed(2)),
      netSoFar: parseFloat(net.toFixed(2)),
      paybackMonths: inv.paybackMonths, paidOff: net >= 0,
      remainingPaybackMonths: net >= 0 ? 0 : parseFloat(((-net) / inv.estimatedMonthlySavings).toFixed(1)),
      totalLifetimeSavings: inv.totalLifetimeSavings, roi: inv.roi
    };
  }

  getAllInvestmentROI() {
    return this.investments.map(inv => this.calculateROI(inv.id)).filter(Boolean);
  }

  // -- 16. Statistics --

  getStatistics() {
    const spending = this.getCurrentMonthSpending();
    const forecast = this.forecastEndOfMonth();
    const carbon = this.calculateCarbonFootprint(1);
    const solar = this.calculateSolarOffset(1);
    const seasonal = this.getSeasonalComparison();
    const peak = this.analyzePeakHours();
    return {
      currentMonth: { spending: spending.total, electricity: spending.electricity, gas: spending.gas, water: spending.water },
      budget: { limit: this.monthlyBudget.total, spent: spending.total,
        remaining: parseFloat((this.monthlyBudget.total - spending.total).toFixed(2)),
        percentUsed: this.monthlyBudget.total > 0 ? parseFloat(((spending.total / this.monthlyBudget.total) * 100).toFixed(1)) : 0 },
      forecast: { estimatedTotal: forecast.estimated, overBudget: forecast.overBudget, confidence: forecast.confidence },
      rates: { activePlan: this.activeRatePlan, currentRate: this.getCurrentRate() },
      carbon: { totalCO2kg: carbon.totalCO2kg, treesEquivalent: carbon.treesEquivalent },
      solar: { offsetPercentage: solar.offsetPercentage, estimatedSavings: solar.estimatedSavings },
      seasonal: { mostExpensive: seasonal.mostExpensive, leastExpensive: seasonal.leastExpensive },
      peakHours: { peakPercentage: peak.peakPercentage, mostExpensiveHour: peak.mostExpensiveHour },
      anomalies: this.anomalies.length,
      investments: this.investments.length,
      billingRecords: this.billingHistory.length,
      trackedDevices: this.devicePowerReadings.size
    };
  }

  // -- Cleanup --

  destroy() {
    for (const i of this._intervals) clearInterval(i);
    this._intervals = [];
    this.log('Energy Billing Analytics System stoppat');
  }

  log(...args) { console.log('[EnergyBillingAnalyticsSystem]', ...args); }
  error(...args) { console.error('[EnergyBillingAnalyticsSystem]', ...args); }
}

module.exports = EnergyBillingAnalyticsSystem;
