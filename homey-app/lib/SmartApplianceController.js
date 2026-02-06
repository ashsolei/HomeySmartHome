'use strict';

/**
 * Smart Appliance Controller
 * Unified control and optimization for all smart appliances with energy cost tracking,
 * peak pricing avoidance, usage pattern learning, diagnostics, interlock logic,
 * water tracking, consumable management, and notification escalation
 */
class SmartApplianceController {
  constructor(homey) {
    this.homey = homey;
    this.appliances = new Map();
    this.cycleHistory = [];
    this.energyOptimization = true;
    this.maintenanceAlerts = [];
    this.applianceTypes = {
      washingMachine: [],
      dryer: [],
      dishwasher: [],
      oven: [],
      refrigerator: [],
      coffeeMaker: [],
      vacuum: []
    };

    // Detailed appliance profiles
    this.applianceProfiles = new Map();
    this.defaultProfiles = {
      washingMachine: {
        brand: 'Generic', cycles: ['quick', 'normal', 'heavy', 'delicate', 'wool', 'eco'],
        avgPowerW: 500, avgCycleDurationMin: 60, avgWaterLiters: 50
      },
      dryer: {
        brand: 'Generic', cycles: ['low_heat', 'medium_heat', 'high_heat', 'eco', 'refresh'],
        avgPowerW: 2500, avgCycleDurationMin: 45, avgWaterLiters: 0
      },
      dishwasher: {
        brand: 'Generic', cycles: ['quick', 'normal', 'intensive', 'eco', 'glass'],
        avgPowerW: 1800, avgCycleDurationMin: 90, avgWaterLiters: 12
      },
      oven: {
        brand: 'Generic', cycles: ['bake', 'broil', 'convection', 'self_clean'],
        avgPowerW: 2400, avgCycleDurationMin: 40, avgWaterLiters: 0
      },
      refrigerator: {
        brand: 'Generic', cycles: ['always_on'],
        avgPowerW: 150, avgCycleDurationMin: 0, avgWaterLiters: 0
      },
      coffeeMaker: {
        brand: 'Generic', cycles: ['espresso', 'lungo', 'cappuccino', 'hot_water'],
        avgPowerW: 1200, avgCycleDurationMin: 3, avgWaterLiters: 0.25
      },
      vacuum: {
        brand: 'Generic', cycles: ['auto', 'spot', 'edge', 'turbo', 'quiet'],
        avgPowerW: 40, avgCycleDurationMin: 60, avgWaterLiters: 0
      }
    };

    // Energy cost tracking
    this.energyCostPerKwh = 1.5; // SEK
    this.energyCostHistory = [];
    this.peakPricingHours = { start: 7, end: 19 };
    this.peakPriceMultiplier = 1.5;

    // Usage pattern learning
    this.usagePatterns = new Map();

    // Remote diagnostics
    this.diagnosticLog = new Map();
    this.faultCodes = {
      E01: 'Water inlet error', E02: 'Drain pump failure', E03: 'Door lock malfunction',
      E04: 'Temperature sensor fault', E05: 'Motor overload', E06: 'Communication error',
      E07: 'Power supply issue', E08: 'Filter clogged', E09: 'Water leak detected',
      E10: 'Overheating detected', E11: 'Unbalanced load', E12: 'Detergent dispenser jam'
    };

    // Multi-step cycle programming
    this.programmedCycles = new Map();

    // Appliance interlock
    this.interlockEnabled = true;
    this.maxConcurrentPowerW = 7000;
    this.interlockGroups = new Map();

    // Water usage tracking
    this.waterUsageHistory = [];
    this.waterCostPerLiter = 0.05; // SEK

    // Consumable tracking
    this.consumables = new Map();

    // Notification escalation
    this.pendingNotifications = new Map();
    this.escalationTimers = new Map();
    this.escalationStages = [
      { delayMin: 0, priority: 'low', prefix: '✅' },
      { delayMin: 15, priority: 'normal', prefix: '⏰' },
      { delayMin: 30, priority: 'high', prefix: '⚠️' },
      { delayMin: 60, priority: 'critical', prefix: '🚨' }
    ];
  }

  async initialize() {
    this.log('Initializing Smart Appliance Controller...');

    try {
      await this.discoverAppliances();
      await this.loadCycleHistory();
      await this.loadEnergyCostHistory();
      await this.loadConsumables();
      await this.loadUsagePatterns();
      await this.startMonitoring();
    } catch (err) {
      this.error('Initialization failed:', err.message);
    }

    this.log('Smart Appliance Controller initialized');
  }

  async discoverAppliances() {
    const devices = this.homey.drivers.getDevices();

    for (const device of devices) {
      const name = device.name.toLowerCase();
      const type = this.identifyApplianceType(name);

      if (!type) continue;

      const appliance = {
        id: device.id,
        name: device.name,
        device,
        type,
        status: 'idle',
        currentCycle: null,
        energyUsage: 0,
        totalEnergyKwh: 0,
        totalWaterLiters: 0,
        maintenanceNeeded: false,
        lastMaintenance: null,
        cycleCount: 0,
        lastFaultCode: null
      };

      this.appliances.set(device.id, appliance);
      if (this.applianceTypes[type]) this.applianceTypes[type].push(appliance);

      // Create profile
      const defaultProfile = this.defaultProfiles[type] || {};
      this.applianceProfiles.set(device.id, {
        applianceId: device.id,
        type,
        ...defaultProfile,
        customName: device.name
      });
    }

    this.log(`Discovered ${this.appliances.size} appliances`);
  }

  identifyApplianceType(name) {
    if (name.includes('washing') || name.includes('tvättmaskin')) return 'washingMachine';
    if (name.includes('dryer') || name.includes('tork')) return 'dryer';
    if (name.includes('dishwasher') || name.includes('diskmaskin')) return 'dishwasher';
    if (name.includes('oven') || name.includes('ugn')) return 'oven';
    if (name.includes('fridge') || name.includes('refrigerator') || name.includes('kyl')) return 'refrigerator';
    if (name.includes('coffee') || name.includes('kaffe')) return 'coffeeMaker';
    if (name.includes('vacuum') || name.includes('dammsugare')) return 'vacuum';
    return null;
  }

  async startMonitoring() {
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkApplianceStatus();
        await this.checkMaintenanceNeeds();
        await this.trackEnergyCosts();
        await this.checkConsumableLevels();
        await this.checkInterlockConditions();
      } catch (err) {
        this.error('Monitoring cycle error:', err.message);
      }
    }, 60000);
  }

  // ── Detailed Appliance Profiles ───────────────────────────────────────

  updateApplianceProfile(applianceId, profileData) {
    const profile = this.applianceProfiles.get(applianceId);
    if (!profile) return null;
    Object.assign(profile, profileData);
    this.applianceProfiles.set(applianceId, profile);
    this.log(`Profile updated for ${applianceId}: brand=${profile.brand}`);
    return profile;
  }

  getApplianceProfile(applianceId) {
    return this.applianceProfiles.get(applianceId) || null;
  }

  getAvailableCycles(applianceId) {
    const profile = this.applianceProfiles.get(applianceId);
    return profile?.cycles || [];
  }

  // ── Energy Cost Tracking ──────────────────────────────────────────────

  async trackEnergyCosts() {
    const now = new Date();
    const hour = now.getHours();
    const isPeak = hour >= this.peakPricingHours.start && hour < this.peakPricingHours.end;
    const currentRate = isPeak ? this.energyCostPerKwh * this.peakPriceMultiplier : this.energyCostPerKwh;

    for (const [id, appliance] of this.appliances) {
      if (appliance.status !== 'running') continue;

      try {
        const power = appliance.device.hasCapability('measure_power')
          ? await appliance.device.getCapabilityValue('measure_power') || 0
          : (this.applianceProfiles.get(id)?.avgPowerW || 0);

        const energyKwh = (power / 1000) * (1 / 60); // energy for 1 minute
        const cost = energyKwh * currentRate;

        appliance.totalEnergyKwh += energyKwh;

        this.energyCostHistory.push({
          applianceId: id,
          applianceName: appliance.name,
          timestamp: Date.now(),
          powerW: power,
          energyKwh,
          cost,
          isPeak,
          rate: currentRate
        });
      } catch (err) {
        this.error(`Energy tracking failed for ${appliance.name}:`, err.message);
      }
    }

    // Trim history
    if (this.energyCostHistory.length > 10000) {
      this.energyCostHistory = this.energyCostHistory.slice(-8000);
    }
  }

  getEnergyCostSummary(applianceId = null, period = 'daily') {
    const now = Date.now();
    const periodMs = period === 'monthly' ? 30 * 86400000 : period === 'weekly' ? 7 * 86400000 : 86400000;
    const since = now - periodMs;

    let records = this.energyCostHistory.filter(r => r.timestamp >= since);
    if (applianceId) records = records.filter(r => r.applianceId === applianceId);

    const totalEnergy = records.reduce((s, r) => s + r.energyKwh, 0);
    const totalCost = records.reduce((s, r) => s + r.cost, 0);
    const peakCost = records.filter(r => r.isPeak).reduce((s, r) => s + r.cost, 0);
    const offPeakCost = totalCost - peakCost;

    // Per-appliance breakdown
    const byAppliance = {};
    for (const r of records) {
      if (!byAppliance[r.applianceId]) {
        byAppliance[r.applianceId] = { name: r.applianceName, energyKwh: 0, cost: 0 };
      }
      byAppliance[r.applianceId].energyKwh += r.energyKwh;
      byAppliance[r.applianceId].cost += r.cost;
    }

    return {
      period,
      totalEnergyKwh: Math.round(totalEnergy * 100) / 100,
      totalCostSEK: Math.round(totalCost * 100) / 100,
      peakCostSEK: Math.round(peakCost * 100) / 100,
      offPeakCostSEK: Math.round(offPeakCost * 100) / 100,
      byAppliance
    };
  }

  // ── Smart Scheduling (Peak Pricing Avoidance) ─────────────────────────

  async findOptimalStartTime(applianceId = null) {
    // Check external energy forecasting first
    try {
      const energyForecasting = this.homey.app.energyForecastingEngine;
      if (energyForecasting) {
        const forecast = await energyForecasting.getOptimalTimeSlot();
        if (forecast?.timestamp) return forecast.timestamp;
      }
    } catch (err) {
      this.error('Energy forecast unavailable:', err.message);
    }

    // Fallback: schedule for off-peak
    const now = new Date();
    const hour = now.getHours();
    if (hour >= this.peakPricingHours.start && hour < this.peakPricingHours.end) {
      const offPeakStart = new Date(now);
      offPeakStart.setHours(this.peakPricingHours.end, 0, 0, 0);
      this.log(`Optimal start time: ${offPeakStart.toLocaleTimeString()} (off-peak)`);
      return offPeakStart.getTime();
    }

    return Date.now();
  }

  isPeakPricing() {
    const hour = new Date().getHours();
    return hour >= this.peakPricingHours.start && hour < this.peakPricingHours.end;
  }

  // ── Usage Pattern Learning ────────────────────────────────────────────

  recordUsageEvent(applianceId, cycleType) {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const hour = now.getHours();

    const key = `${applianceId}_${dayOfWeek}_${hour}`;
    const current = this.usagePatterns.get(key) || { count: 0, cycleTypes: {} };
    current.count++;
    current.cycleTypes[cycleType] = (current.cycleTypes[cycleType] || 0) + 1;
    this.usagePatterns.set(key, current);
  }

  getUsageSuggestions(applianceId) {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const suggestions = [];

    for (let hour = 0; hour < 24; hour++) {
      const key = `${applianceId}_${dayOfWeek}_${hour}`;
      const pattern = this.usagePatterns.get(key);
      if (pattern && pattern.count >= 3) {
        const topCycle = Object.entries(pattern.cycleTypes)
          .sort((a, b) => b[1] - a[1])[0];
        suggestions.push({
          hour,
          frequency: pattern.count,
          suggestedCycle: topCycle ? topCycle[0] : 'normal',
          isPeak: hour >= this.peakPricingHours.start && hour < this.peakPricingHours.end
        });
      }
    }

    // Add savings suggestions
    const peakUsages = suggestions.filter(s => s.isPeak);
    if (peakUsages.length > 0) {
      suggestions.push({
        type: 'saving_tip',
        message: `You typically run this appliance during peak hours (${peakUsages.map(s => `${s.hour}:00`).join(', ')}). Shifting to off-peak could save ~${Math.round(peakUsages.length * 0.5 * this.energyCostPerKwh * 100) / 100} SEK/week.`
      });
    }

    return suggestions;
  }

  // ── Remote Diagnostics & Fault Code Interpretation ────────────────────

  async runDiagnostics(applianceId) {
    const appliance = this.appliances.get(applianceId);
    if (!appliance) return null;

    const diagnostic = {
      applianceId,
      applianceName: appliance.name,
      timestamp: Date.now(),
      status: 'healthy',
      checks: [],
      faultCodes: []
    };

    // Check power consumption anomalies
    try {
      if (appliance.device.hasCapability('measure_power')) {
        const power = await appliance.device.getCapabilityValue('measure_power') || 0;
        const profile = this.applianceProfiles.get(applianceId);
        const expectedPower = profile?.avgPowerW || 0;

        if (appliance.status === 'running' && power < expectedPower * 0.3) {
          diagnostic.checks.push({ check: 'power_consumption', status: 'warning', message: 'Unusually low power draw — possible malfunction' });
          diagnostic.faultCodes.push('E05');
          diagnostic.status = 'warning';
        } else if (appliance.status === 'running' && power > expectedPower * 1.5) {
          diagnostic.checks.push({ check: 'power_consumption', status: 'warning', message: 'Unusually high power draw — possible overload' });
          diagnostic.faultCodes.push('E10');
          diagnostic.status = 'warning';
        } else {
          diagnostic.checks.push({ check: 'power_consumption', status: 'ok', message: 'Power consumption normal' });
        }
      }
    } catch (err) {
      diagnostic.checks.push({ check: 'power_consumption', status: 'error', message: err.message });
    }

    // Check connectivity
    try {
      const isOn = appliance.device.hasCapability('onoff')
        ? await appliance.device.getCapabilityValue('onoff')
        : null;
      diagnostic.checks.push({ check: 'connectivity', status: 'ok', message: 'Device responsive' });
    } catch (err) {
      diagnostic.checks.push({ check: 'connectivity', status: 'error', message: 'Device not responding' });
      diagnostic.faultCodes.push('E06');
      diagnostic.status = 'critical';
    }

    // Interpret fault codes
    diagnostic.faultCodeDescriptions = diagnostic.faultCodes.map(code => ({
      code,
      description: this.faultCodes[code] || 'Unknown fault'
    }));

    this.diagnosticLog.set(applianceId, diagnostic);
    return diagnostic;
  }

  interpretFaultCode(code) {
    return this.faultCodes[code] || `Unknown fault code: ${code}`;
  }

  // ── Multi-Step Cycle Programming ──────────────────────────────────────

  async programMultiStepCycle(applianceId, steps) {
    const appliance = this.appliances.get(applianceId);
    if (!appliance) throw new Error('Appliance not found');

    const program = {
      applianceId,
      steps: steps.map((step, i) => ({
        order: i + 1,
        cycleType: step.cycleType,
        durationMin: step.durationMin || 30,
        temperature: step.temperature || null,
        spinSpeed: step.spinSpeed || null,
        status: 'pending'
      })),
      currentStep: 0,
      status: 'ready',
      createdAt: Date.now()
    };

    this.programmedCycles.set(applianceId, program);
    this.log(`Multi-step cycle programmed for ${appliance.name}: ${steps.length} steps`);
    return program;
  }

  async executeMultiStepCycle(applianceId) {
    const program = this.programmedCycles.get(applianceId);
    if (!program || program.status === 'running') return null;

    program.status = 'running';

    const executeStep = async (stepIndex) => {
      if (stepIndex >= program.steps.length) {
        program.status = 'completed';
        this.log(`Multi-step cycle completed for ${applianceId}`);
        await this.sendNotification(`✅ Flerstegs-cykel klar`, `Alla ${program.steps.length} steg slutförda`);
        return;
      }

      const step = program.steps[stepIndex];
      step.status = 'running';
      program.currentStep = stepIndex;
      this.log(`Executing step ${step.order}: ${step.cycleType} for ${step.durationMin} min`);

      const appliance = this.appliances.get(applianceId);
      try {
        if (appliance?.device.hasCapability('onoff')) {
          await appliance.device.setCapabilityValue('onoff', true);
        }
      } catch (err) {
        this.error(`Failed to start step ${step.order}:`, err.message);
      }

      setTimeout(async () => {
        step.status = 'completed';
        await executeStep(stepIndex + 1);
      }, step.durationMin * 60000);
    };

    await executeStep(0);
    return program;
  }

  // ── Appliance Interlock Logic ─────────────────────────────────────────

  async checkInterlockConditions() {
    if (!this.interlockEnabled) return;

    let totalRunningPower = 0;
    const runningAppliances = [];

    for (const [id, appliance] of this.appliances) {
      if (appliance.status !== 'running') continue;
      const profile = this.applianceProfiles.get(id);
      const power = appliance.energyUsage || profile?.avgPowerW || 0;
      totalRunningPower += power;
      runningAppliances.push({ id, name: appliance.name, power });
    }

    if (totalRunningPower > this.maxConcurrentPowerW) {
      this.log(`Interlock warning: Total power ${totalRunningPower}W exceeds limit ${this.maxConcurrentPowerW}W`);
      await this.sendNotification(
        '⚡ Effektvarning',
        `Totalt ${Math.round(totalRunningPower)}W — överskrider gräns på ${this.maxConcurrentPowerW}W. Överväg att stänga av en apparat.`
      );
    }
  }

  canStartAppliance(applianceId) {
    if (!this.interlockEnabled) return { allowed: true };

    const profile = this.applianceProfiles.get(applianceId);
    const newPower = profile?.avgPowerW || 0;

    let currentPower = 0;
    for (const [id, appliance] of this.appliances) {
      if (appliance.status === 'running') {
        currentPower += appliance.energyUsage || this.applianceProfiles.get(id)?.avgPowerW || 0;
      }
    }

    const totalAfterStart = currentPower + newPower;
    if (totalAfterStart > this.maxConcurrentPowerW) {
      return {
        allowed: false,
        reason: `Would exceed power limit (${Math.round(totalAfterStart)}W > ${this.maxConcurrentPowerW}W)`,
        currentPowerW: Math.round(currentPower),
        requestedPowerW: Math.round(newPower)
      };
    }

    return { allowed: true, totalPowerAfterW: Math.round(totalAfterStart) };
  }

  // ── Water Usage Tracking ──────────────────────────────────────────────

  recordWaterUsage(applianceId, liters) {
    const appliance = this.appliances.get(applianceId);
    if (!appliance) return;

    appliance.totalWaterLiters += liters;

    this.waterUsageHistory.push({
      applianceId,
      applianceName: appliance.name,
      liters,
      cost: liters * this.waterCostPerLiter,
      timestamp: Date.now()
    });

    if (this.waterUsageHistory.length > 5000) {
      this.waterUsageHistory = this.waterUsageHistory.slice(-4000);
    }
  }

  getWaterUsageSummary(period = 'daily') {
    const periodMs = period === 'monthly' ? 30 * 86400000 : period === 'weekly' ? 7 * 86400000 : 86400000;
    const since = Date.now() - periodMs;
    const records = this.waterUsageHistory.filter(r => r.timestamp >= since);

    const totalLiters = records.reduce((s, r) => s + r.liters, 0);
    const totalCost = records.reduce((s, r) => s + r.cost, 0);

    const byAppliance = {};
    for (const r of records) {
      if (!byAppliance[r.applianceId]) {
        byAppliance[r.applianceId] = { name: r.applianceName, liters: 0, cost: 0 };
      }
      byAppliance[r.applianceId].liters += r.liters;
      byAppliance[r.applianceId].cost += r.cost;
    }

    return {
      period,
      totalLiters: Math.round(totalLiters * 10) / 10,
      totalCostSEK: Math.round(totalCost * 100) / 100,
      byAppliance
    };
  }

  // ── Consumable Tracking ───────────────────────────────────────────────

  async addConsumable(applianceId, consumable) {
    const key = `${applianceId}_${consumable.type}`;
    this.consumables.set(key, {
      applianceId,
      type: consumable.type,
      name: consumable.name || consumable.type,
      level: consumable.level ?? 100,
      unit: consumable.unit || '%',
      replacementDate: consumable.replacementDate || null,
      replacementIntervalDays: consumable.replacementIntervalDays || 90,
      lastReplaced: Date.now(),
      usagePerCycle: consumable.usagePerCycle || 1
    });

    await this.saveConsumables();
    this.log(`Consumable added: ${consumable.name || consumable.type} for ${applianceId}`);
  }

  async updateConsumableAfterCycle(applianceId) {
    for (const [key, consumable] of this.consumables) {
      if (consumable.applianceId !== applianceId) continue;
      consumable.level = Math.max(0, consumable.level - consumable.usagePerCycle);

      if (consumable.level <= 10) {
        await this.sendNotification(
          '📦 Förbrukningsmaterial snart slut',
          `${consumable.name} för ${this.appliances.get(applianceId)?.name || applianceId}: ${consumable.level}${consumable.unit} kvar`
        );
      }
    }
    await this.saveConsumables();
  }

  async checkConsumableLevels() {
    const now = Date.now();
    for (const [key, consumable] of this.consumables) {
      if (consumable.replacementDate && now > consumable.replacementDate) {
        await this.sendNotification(
          '🔄 Filterbyte förfallet',
          `${consumable.name} för ${this.appliances.get(consumable.applianceId)?.name || 'okänd'} behöver bytas`
        );
      }

      if (consumable.lastReplaced && consumable.replacementIntervalDays) {
        const daysSinceReplaced = (now - consumable.lastReplaced) / 86400000;
        if (daysSinceReplaced >= consumable.replacementIntervalDays) {
          await this.sendNotification(
            '🔄 Schemalagt byte',
            `${consumable.name} — det har gått ${Math.round(daysSinceReplaced)} dagar sedan senaste bytet`
          );
        }
      }
    }
  }

  getConsumableStatus(applianceId = null) {
    const result = [];
    for (const [key, consumable] of this.consumables) {
      if (applianceId && consumable.applianceId !== applianceId) continue;
      result.push({
        applianceId: consumable.applianceId,
        type: consumable.type,
        name: consumable.name,
        level: consumable.level,
        unit: consumable.unit,
        daysSinceReplaced: Math.round((Date.now() - consumable.lastReplaced) / 86400000)
      });
    }
    return result;
  }

  // ── Notification Escalation ───────────────────────────────────────────

  async startNotificationEscalation(applianceId, baseMessage) {
    const appliance = this.appliances.get(applianceId);
    if (!appliance) return;

    const escalationId = `esc_${applianceId}_${Date.now()}`;
    const escalation = {
      id: escalationId,
      applianceId,
      applianceName: appliance.name,
      baseMessage,
      currentStage: 0,
      startedAt: Date.now(),
      acknowledged: false
    };

    this.pendingNotifications.set(escalationId, escalation);

    // Send first notification immediately
    await this.sendEscalatedNotification(escalation);

    // Schedule further escalations
    for (let i = 1; i < this.escalationStages.length; i++) {
      const stage = this.escalationStages[i];
      const timer = setTimeout(async () => {
        if (escalation.acknowledged) return;
        escalation.currentStage = i;
        await this.sendEscalatedNotification(escalation);
      }, stage.delayMin * 60000);
      this.escalationTimers.set(`${escalationId}_${i}`, timer);
    }
  }

  async sendEscalatedNotification(escalation) {
    const stage = this.escalationStages[escalation.currentStage];
    try {
      const notificationManager = this.homey.app.advancedNotificationManager;
      if (notificationManager) {
        await notificationManager.sendNotification({
          title: `${stage.prefix} ${escalation.applianceName}`,
          message: escalation.baseMessage,
          priority: stage.priority,
          category: 'appliance'
        });
      }
    } catch (err) {
      this.error('Escalation notification failed:', err.message);
    }
  }

  acknowledgeNotification(escalationId) {
    const escalation = this.pendingNotifications.get(escalationId);
    if (!escalation) return false;
    escalation.acknowledged = true;

    // Clear pending timers
    for (let i = 0; i < this.escalationStages.length; i++) {
      const timerKey = `${escalationId}_${i}`;
      if (this.escalationTimers.has(timerKey)) {
        clearTimeout(this.escalationTimers.get(timerKey));
        this.escalationTimers.delete(timerKey);
      }
    }

    this.log(`Notification acknowledged: ${escalationId}`);
    return true;
  }

  // ── Core Appliance Methods ────────────────────────────────────────────

  async checkApplianceStatus() {
    for (const [id, appliance] of this.appliances) {
      try {
        if (appliance.device.hasCapability('onoff')) {
          const isOn = await appliance.device.getCapabilityValue('onoff');
          const previousStatus = appliance.status;
          appliance.status = isOn ? 'running' : 'idle';

          if (previousStatus === 'running' && appliance.status === 'idle') {
            await this.handleCycleComplete(appliance);
          }
        }

        if (appliance.device.hasCapability('measure_power')) {
          appliance.energyUsage = await appliance.device.getCapabilityValue('measure_power') || 0;
        }
      } catch (err) {
        this.error(`Status check failed for ${appliance.name}:`, err.message);
      }
    }
  }

  async handleCycleComplete(appliance) {
    this.log(`Cycle completed: ${appliance.name}`);
    appliance.cycleCount++;

    const cycle = {
      applianceId: appliance.id,
      applianceName: appliance.name,
      type: appliance.type,
      cycleType: appliance.currentCycle?.type || 'unknown',
      startTime: appliance.currentCycle?.startTime || Date.now() - 3600000,
      endTime: Date.now(),
      duration: null,
      energyUsed: appliance.currentCycle?.energyUsed || 0,
      waterUsed: 0
    };

    cycle.duration = (cycle.endTime - cycle.startTime) / 60000;

    // Estimate water usage
    const profile = this.applianceProfiles.get(appliance.id);
    if (profile?.avgWaterLiters > 0) {
      cycle.waterUsed = profile.avgWaterLiters;
      this.recordWaterUsage(appliance.id, cycle.waterUsed);
    }

    this.cycleHistory.push(cycle);
    this.recordUsageEvent(appliance.id, cycle.cycleType);
    await this.updateConsumableAfterCycle(appliance.id);

    // Start escalating notification for forgotten laundry
    if (appliance.type === 'washingMachine' || appliance.type === 'dryer') {
      await this.startNotificationEscalation(
        appliance.id,
        `${appliance.name} har avslutat sin cykel — glöm inte tvätten!`
      );
    } else {
      await this.sendNotification(`✅ Apparat klar`, `${appliance.name} har avslutat sin cykel`);
    }

    appliance.currentCycle = null;
  }

  async startCycle(applianceId, cycleType, options = {}) {
    const appliance = this.appliances.get(applianceId);
    if (!appliance) throw new Error('Appliance not found');

    // Check interlock
    const interlockCheck = this.canStartAppliance(applianceId);
    if (!interlockCheck.allowed && !options.overrideInterlock) {
      this.log(`Interlock prevented start of ${appliance.name}: ${interlockCheck.reason}`);
      await this.sendNotification('⚡ Interlock aktiv', `${appliance.name} kunde inte startas: ${interlockCheck.reason}`);
      return { started: false, reason: interlockCheck.reason };
    }

    if (this.energyOptimization && !options.immediate && this.isPeakPricing()) {
      const optimalTime = await this.findOptimalStartTime(applianceId);
      if (optimalTime > Date.now()) {
        this.log(`Energy optimization: Delaying ${appliance.name} start to ${new Date(optimalTime).toLocaleTimeString()}`);
        setTimeout(async () => {
          await this.executeStartCycle(appliance, cycleType);
        }, optimalTime - Date.now());
        return { started: false, scheduled: true, scheduledTime: new Date(optimalTime).toISOString() };
      }
    }

    await this.executeStartCycle(appliance, cycleType);
    return { started: true };
  }

  async executeStartCycle(appliance, cycleType) {
    try {
      if (appliance.device.hasCapability('onoff')) {
        await appliance.device.setCapabilityValue('onoff', true);
      }

      appliance.currentCycle = {
        type: cycleType,
        startTime: Date.now(),
        energyUsed: 0
      };

      appliance.status = 'running';
      this.log(`Started ${cycleType} cycle on ${appliance.name}`);
    } catch (err) {
      this.error(`Failed to start cycle on ${appliance.name}: ${err.message}`);
    }
  }

  async checkMaintenanceNeeds() {
    for (const [id, appliance] of this.appliances) {
      try {
        const needsMaintenance = await this.calculateMaintenanceNeed(appliance);
        if (needsMaintenance && !appliance.maintenanceNeeded) {
          appliance.maintenanceNeeded = true;
          await this.sendMaintenanceAlert(appliance);
        }
      } catch (err) {
        this.error(`Maintenance check failed for ${appliance.name}:`, err.message);
      }
    }
  }

  async calculateMaintenanceNeed(appliance) {
    const cyclesForAppliance = this.cycleHistory.filter(c => c.applianceId === appliance.id);
    const thresholds = {
      washingMachine: 50, dryer: 40, dishwasher: 60, coffeeMaker: 100, vacuum: 30
    };
    const threshold = thresholds[appliance.type] || 50;

    if (appliance.lastMaintenance) {
      const cyclesSince = cyclesForAppliance.filter(c => c.endTime > appliance.lastMaintenance).length;
      return cyclesSince >= threshold;
    }
    return cyclesForAppliance.length >= threshold;
  }

  async sendMaintenanceAlert(appliance) {
    this.maintenanceAlerts.push({
      applianceId: appliance.id,
      applianceName: appliance.name,
      timestamp: Date.now(),
      type: 'maintenance_needed'
    });

    await this.sendNotification('🔧 Underhåll behövs', `${appliance.name} behöver underhåll`);
  }

  async performMaintenance(applianceId) {
    const appliance = this.appliances.get(applianceId);
    if (!appliance) return;

    appliance.maintenanceNeeded = false;
    appliance.lastMaintenance = Date.now();

    try {
      await this.homey.settings.set(`maintenance_${applianceId}`, appliance.lastMaintenance);
    } catch (err) {
      this.error(`Failed to save maintenance record: ${err.message}`);
    }

    this.log(`Maintenance recorded for ${appliance.name}`);
  }

  // ── Utility / Notifications ───────────────────────────────────────────

  async sendNotification(title, message, priority = 'normal') {
    try {
      const notificationManager = this.homey.app.advancedNotificationManager;
      if (notificationManager) {
        await notificationManager.sendNotification({
          title, message, priority, category: 'appliance'
        });
      }
    } catch (err) {
      this.error('Notification failed:', err.message);
    }
  }

  // ── Persistence ───────────────────────────────────────────────────────

  async loadCycleHistory() {
    try {
      const saved = await this.homey.settings.get('applianceCycleHistory') || [];
      this.cycleHistory = saved.slice(-500);
    } catch (err) {
      this.error('Failed to load cycle history:', err.message);
    }
  }

  async saveCycleHistory() {
    try {
      await this.homey.settings.set('applianceCycleHistory', this.cycleHistory.slice(-500));
    } catch (err) {
      this.error('Failed to save cycle history:', err.message);
    }
  }

  async loadEnergyCostHistory() {
    try {
      const saved = await this.homey.settings.get('energyCostHistory') || [];
      this.energyCostHistory = saved.slice(-5000);
    } catch (err) {
      this.error('Failed to load energy cost history:', err.message);
    }
  }

  async loadConsumables() {
    try {
      const saved = await this.homey.settings.get('applianceConsumables') || {};
      Object.entries(saved).forEach(([key, data]) => this.consumables.set(key, data));
    } catch (err) {
      this.error('Failed to load consumables:', err.message);
    }
  }

  async saveConsumables() {
    try {
      const obj = {};
      this.consumables.forEach((v, k) => { obj[k] = v; });
      await this.homey.settings.set('applianceConsumables', obj);
    } catch (err) {
      this.error('Failed to save consumables:', err.message);
    }
  }

  async loadUsagePatterns() {
    try {
      const saved = await this.homey.settings.get('applianceUsagePatterns') || {};
      Object.entries(saved).forEach(([key, data]) => this.usagePatterns.set(key, data));
    } catch (err) {
      this.error('Failed to load usage patterns:', err.message);
    }
  }

  // ── Statistics ────────────────────────────────────────────────────────

  getStatistics() {
    const stats = {
      totalAppliances: this.appliances.size,
      appliancesByType: {},
      totalCycles: this.cycleHistory.length,
      maintenanceAlerts: this.maintenanceAlerts.length,
      energyOptimization: this.energyOptimization,
      interlockEnabled: this.interlockEnabled,
      maxConcurrentPowerW: this.maxConcurrentPowerW,
      consumablesTracked: this.consumables.size,
      pendingEscalations: this.pendingNotifications.size,
      energySummary: this.getEnergyCostSummary(null, 'daily'),
      waterSummary: this.getWaterUsageSummary('daily')
    };

    for (const [type, appliances] of Object.entries(this.applianceTypes)) {
      stats.appliancesByType[type] = appliances.length;
    }

    return stats;
  }

  // ── Cleanup ───────────────────────────────────────────────────────────

  destroy() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    for (const [key, timer] of this.escalationTimers) {
      clearTimeout(timer);
    }
    this.escalationTimers.clear();
    this.log('Smart Appliance Controller destroyed');
  }

  log(...args) {
    console.log('[SmartApplianceController]', ...args);
  }

  error(...args) {
    console.error('[SmartApplianceController]', ...args);
  }
}

module.exports = SmartApplianceController;
