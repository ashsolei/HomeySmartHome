'use strict';

const EventEmitter = require('events');

/**
 * SmartRoofSolarMonitoringSystem
 *
 * Comprehensive roof and solar-panel monitoring module for the Homey
 * smart-home platform.  Tracks panel health, roof condition, power
 * output, shading, weather-related risk, energy ROI and cleaning
 * schedules.  Designed to integrate with existing energy-trading and
 * grid systems in the HomeySmartHome project.
 *
 * @module SmartRoofSolarMonitoringSystem
 */
class SmartRoofSolarMonitoringSystem extends EventEmitter {

  /**
   * @param {object} homey - Homey app instance
   */
  constructor(homey) {
    super();
    this.homey = homey;
    this.initialized = false;

    /** @type {number[]} Active interval IDs for cleanup */
    this.intervals = [];

    // ── Solar-panel fleet ────────────────────────────────────────────
    /** @type {Map<string,object>} Individual panel records keyed by id */
    this.panels = new Map();

    /** @type {object} Aggregate power-output snapshot */
    this.powerOutput = {
      currentWatts: 0,
      todayKwh: 0,
      monthKwh: 0,
      yearKwh: 0,
      lifetimeKwh: 0,
      peakWatts: 0,
      peakTimestamp: null
    };

    /** @type {object[]} Rolling 48-hour trend data (5-min resolution) */
    this.outputTrend = [];

    // ── Roof condition ──────────────────────────────────────────────
    /** @type {object} Roof-health data */
    this.roofCondition = {
      overallScore: 100,
      gutterStatus: 'clear',
      gutterBlockagePercent: 0,
      iceDamRisk: 'none',
      snowLoadKgM2: 0,
      snowLoadLimit: 200,
      lastInspection: null,
      surfaceTemp: null,
      moistureDetected: false,
      tiles: { total: 0, damaged: 0, missing: 0 }
    };

    // ── Cleaning ────────────────────────────────────────────────────
    /** @type {object} Cleaning-schedule state */
    this.cleaning = {
      lastClean: null,
      nextRecommended: null,
      soilingIndex: 0,          // 0-100
      soilingHistory: [],
      autoScheduleEnabled: true,
      cleaningCostSEK: 1500,
      efficiencyGainPercent: 0
    };

    // ── Storm / wind-damage risk ────────────────────────────────────
    /** @type {object} Weather-risk model */
    this.stormRisk = {
      currentRisk: 'low',
      windSpeedMs: 0,
      gustSpeedMs: 0,
      hailProbability: 0,
      historicalDamageEvents: [],
      riskScore: 0                // 0-100
    };

    // ── Energy ROI ──────────────────────────────────────────────────
    /** @type {object} Financial tracking */
    this.roi = {
      installationCostSEK: 185000,
      totalSavingsSEK: 0,
      electricityPriceSEK: 1.85,  // per kWh
      feedInTariffSEK: 0.60,
      paybackYears: 0,
      paybackPercent: 0,
      annualReturnPercent: 0,
      co2OffsetKg: 0
    };

    // ── Shading analysis ────────────────────────────────────────────
    /** @type {object} Sun-position / shading model */
    this.shading = {
      latitude: 59.33,            // Stockholm default
      longitude: 18.07,
      azimuthDeg: 180,            // south-facing default
      tiltDeg: 30,
      hourlyShading: [],          // 24-slot array
      obstructions: [],
      effectiveSunHours: 0
    };

    // ── Alerts ───────────────────────────────────────────────────────
    /** @type {object[]} Active alerts */
    this.alerts = [];

    /** @type {object} Alert thresholds */
    this.thresholds = {
      panelTempHigh: 75,          // °C
      panelTempLow: -25,
      efficiencyDropPercent: 15,
      soilingTrigger: 40,
      windSpeedWarning: 17,
      windSpeedCritical: 25,
      snowLoadWarning: 120,
      snowLoadCritical: 180,
      gutterBlockageWarning: 50
    };
  }

  // ====================================================================
  //  LIFECYCLE
  // ====================================================================

  /**
   * Boot the system – discover panels, restore state, start timers.
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      this.homey.log('[RoofSolar] Initializing Smart Roof & Solar Monitoring System...');

      await this._restoreState();
      this._discoverPanels();
      this._initializeRoofCondition();
      this._initializeShadingModel();
      this._calculateROI();
      this._assessStormRisk();
      this._evaluateCleaningSchedule();

      // ── Periodic tasks ──────────────────────────────────────────
      this.intervals.push(
        setInterval(() => this._samplePowerOutput(), 60000)          // 1 min
      );
      this.intervals.push(
        setInterval(() => this._updatePanelHealth(), 300000)         // 5 min
      );
      this.intervals.push(
        setInterval(() => this._updateRoofCondition(), 600000)       // 10 min
      );
      this.intervals.push(
        setInterval(() => this._assessStormRisk(), 900000)           // 15 min
      );
      this.intervals.push(
        setInterval(() => this._evaluateCleaningSchedule(), 3600000) // 1 h
      );
      this.intervals.push(
        setInterval(() => this._updateShadingModel(), 1800000)       // 30 min
      );
      this.intervals.push(
        setInterval(() => this._calculateROI(), 3600000)             // 1 h
      );
      this.intervals.push(
        setInterval(() => this._persistState(), 1800000)             // 30 min
      );
      this.intervals.push(
        setInterval(() => this._pruneOldTrendData(), 7200000)        // 2 h
      );

      this.initialized = true;
      this.homey.log('[RoofSolar] System initialized – tracking',
        this.panels.size, 'panels');
      this.emit('initialized');
    } catch (err) {
      this.homey.log('[RoofSolar] Initialization error:', err.message);
      this.emit('error', err);
    }
  }

  /**
   * Tear down all intervals and release resources.
   */
  destroy() {
    this.homey.log('[RoofSolar] Destroying Smart Roof & Solar Monitoring System...');
    for (const id of this.intervals) {
      clearInterval(id);
    }
    this.intervals = [];
    this.removeAllListeners();
    this.initialized = false;
    this.homey.log('[RoofSolar] System destroyed.');
  }

  // ====================================================================
  //  STATE PERSISTENCE
  // ====================================================================

  /**
   * Persist critical state to homey.settings.
   * @private
   * @returns {Promise<void>}
   */
  async _persistState() {
    try {
      const snapshot = {
        powerOutput: this.powerOutput,
        roofCondition: this.roofCondition,
        cleaning: this.cleaning,
        stormRisk: { historicalDamageEvents: this.stormRisk.historicalDamageEvents },
        roi: this.roi,
        shading: {
          latitude: this.shading.latitude,
          longitude: this.shading.longitude,
          azimuthDeg: this.shading.azimuthDeg,
          tiltDeg: this.shading.tiltDeg,
          obstructions: this.shading.obstructions
        },
        panels: Array.from(this.panels.entries()),
        savedAt: new Date().toISOString()
      };
      await this.homey.settings.set('roofSolarState', JSON.stringify(snapshot));
      this.homey.log('[RoofSolar] State persisted.');
    } catch (err) {
      this.homey.log('[RoofSolar] Persist error:', err.message);
    }
  }

  /**
   * Restore previously saved state.
   * @private
   * @returns {Promise<void>}
   */
  async _restoreState() {
    try {
      const raw = await this.homey.settings.get('roofSolarState');
      if (!raw) return;
      const data = JSON.parse(raw);

      if (data.powerOutput) Object.assign(this.powerOutput, data.powerOutput);
      if (data.roofCondition) Object.assign(this.roofCondition, data.roofCondition);
      if (data.cleaning) Object.assign(this.cleaning, data.cleaning);
      if (data.stormRisk && data.stormRisk.historicalDamageEvents) {
        this.stormRisk.historicalDamageEvents = data.stormRisk.historicalDamageEvents;
      }
      if (data.roi) Object.assign(this.roi, data.roi);
      if (data.shading) {
        this.shading.latitude = data.shading.latitude ?? this.shading.latitude;
        this.shading.longitude = data.shading.longitude ?? this.shading.longitude;
        this.shading.azimuthDeg = data.shading.azimuthDeg ?? this.shading.azimuthDeg;
        this.shading.tiltDeg = data.shading.tiltDeg ?? this.shading.tiltDeg;
        this.shading.obstructions = data.shading.obstructions ?? [];
      }
      if (Array.isArray(data.panels)) {
        for (const [id, record] of data.panels) {
          this.panels.set(id, record);
        }
      }

      this.homey.log('[RoofSolar] State restored from', data.savedAt || 'unknown time');
    } catch (err) {
      this.homey.log('[RoofSolar] Restore error (starting fresh):', err.message);
    }
  }

  // ====================================================================
  //  PANEL DISCOVERY & HEALTH
  // ====================================================================

  /**
   * Discover or create simulated solar panels.
   * @private
   */
  _discoverPanels() {
    try {
      if (this.panels.size > 0) {
        this.homey.log('[RoofSolar] Restored', this.panels.size, 'panels from state');
        return;
      }

      const defaultPanelCount = 24;
      for (let i = 1; i <= defaultPanelCount; i++) {
        const id = `panel-${String(i).padStart(3, '0')}`;
        this.panels.set(id, this._createPanelRecord(id, i));
      }
      this.homey.log('[RoofSolar] Discovered', this.panels.size, 'solar panels');
    } catch (err) {
      this.homey.log('[RoofSolar] Panel discovery error:', err.message);
    }
  }

  /**
   * Build a fresh panel data record.
   * @private
   * @param {string} id   - Unique panel identifier
   * @param {number} index - 1-based position index
   * @returns {object} Panel record
   */
  _createPanelRecord(id, index) {
    const row = Math.ceil(index / 6);
    const col = ((index - 1) % 6) + 1;
    return {
      id,
      index,
      row,
      col,
      nominalWatts: 420,
      currentWatts: 0,
      temperature: 25,
      efficiency: 100,
      baselineEfficiency: 100,
      degradationPercent: 0,
      soilingPercent: 0,
      age: 0,
      installDate: new Date().toISOString(),
      lastMaintenance: null,
      status: 'nominal',
      faults: [],
      voltageV: 0,
      currentA: 0,
      energyTodayWh: 0,
      energyLifetimeKwh: 0,
      peakWatts: 0,
      peakTimestamp: null,
      shadingFactor: 1.0,
      tiltDeg: 30,
      azimuthDeg: 180,
      microInverterId: `inv-${String(index).padStart(3, '0')}`,
      microInverterStatus: 'online'
    };
  }

  /**
   * Periodic panel-health update – temperature, degradation, soiling.
   * @private
   */
  _updatePanelHealth() {
    try {
      const now = new Date();
      const hour = now.getHours();
      const isDaylight = hour >= 6 && hour <= 20;

      for (const [id, panel] of this.panels) {
        // ── Temperature simulation --------------------------------
        const ambient = this._estimateAmbientTemp(now);
        const irradianceContrib = isDaylight
          ? Math.sin(((hour - 6) / 14) * Math.PI) * 30
          : 0;
        panel.temperature = Math.round(
          (ambient + irradianceContrib + (Math.random() * 4 - 2)) * 10
        ) / 10;

        // ── Efficiency degradation (age-based) --------------------
        const ageDays = (Date.now() - new Date(panel.installDate).getTime())
          / 86400000;
        panel.age = Math.round(ageDays);
        // ~0.5 % per year linear degradation
        panel.degradationPercent = Math.min(
          25,
          Math.round((ageDays / 365) * 0.5 * 100) / 100
        );

        // ── Soiling simulation ------------------------------------
        const daysSinceClean = this.cleaning.lastClean
          ? (Date.now() - new Date(this.cleaning.lastClean).getTime()) / 86400000
          : 60;
        panel.soilingPercent = Math.min(
          30,
          Math.round(daysSinceClean * 0.15 * 100) / 100
        );

        // ── Effective efficiency ----------------------------------
        panel.efficiency = Math.max(
          0,
          Math.round(
            (panel.baselineEfficiency
              - panel.degradationPercent
              - panel.soilingPercent) * 100
          ) / 100
        );

        // ── Fault detection ---------------------------------------
        panel.faults = [];
        if (panel.temperature > this.thresholds.panelTempHigh) {
          panel.faults.push('overtemp');
          panel.status = 'warning';
        } else if (panel.temperature < this.thresholds.panelTempLow) {
          panel.faults.push('undertemp');
          panel.status = 'warning';
        }
        if (panel.baselineEfficiency - panel.efficiency
            > this.thresholds.efficiencyDropPercent) {
          panel.faults.push('efficiency_drop');
          panel.status = 'degraded';
        }
        if (panel.faults.length === 0) {
          panel.status = 'nominal';
        }

        // ── Alerts ------------------------------------------------
        this._checkPanelAlerts(panel);
      }

      // Aggregate soiling index
      const avgSoiling = this._averageField('soilingPercent');
      this.cleaning.soilingIndex = Math.round(avgSoiling * 100) / 100;

      this.emit('panelHealthUpdated');
    } catch (err) {
      this.homey.log('[RoofSolar] Panel health error:', err.message);
    }
  }

  /**
   * Raise or clear alerts for an individual panel.
   * @private
   * @param {object} panel
   */
  _checkPanelAlerts(panel) {
    for (const fault of panel.faults) {
      const exists = this.alerts.find(
        a => a.panelId === panel.id && a.type === fault && !a.resolved
      );
      if (!exists) {
        const alert = {
          id: `${panel.id}-${fault}-${Date.now()}`,
          panelId: panel.id,
          type: fault,
          message: this._faultMessage(fault, panel),
          severity: fault === 'overtemp' ? 'critical' : 'warning',
          timestamp: new Date().toISOString(),
          resolved: false
        };
        this.alerts.push(alert);
        this.emit('alert', alert);
        this.homey.log('[RoofSolar] ALERT:', alert.message);
      }
    }
    // Auto-resolve cleared faults
    this.alerts
      .filter(a => a.panelId === panel.id && !a.resolved)
      .forEach(a => {
        if (!panel.faults.includes(a.type)) {
          a.resolved = true;
          a.resolvedAt = new Date().toISOString();
        }
      });
  }

  /**
   * Human-friendly fault description.
   * @private
   * @param {string} fault
   * @param {object} panel
   * @returns {string}
   */
  _faultMessage(fault, panel) {
    switch (fault) {
      case 'overtemp':
        return `Panel ${panel.id} temperature ${panel.temperature}°C exceeds ${this.thresholds.panelTempHigh}°C limit`;
      case 'undertemp':
        return `Panel ${panel.id} temperature ${panel.temperature}°C below ${this.thresholds.panelTempLow}°C limit`;
      case 'efficiency_drop':
        return `Panel ${panel.id} efficiency dropped to ${panel.efficiency}% (baseline ${panel.baselineEfficiency}%)`;
      default:
        return `Panel ${panel.id}: ${fault}`;
    }
  }

  // ====================================================================
  //  POWER OUTPUT TRACKING
  // ====================================================================

  /**
   * Sample instantaneous power from all panels (called every 60 s).
   * @private
   */
  _samplePowerOutput() {
    try {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      const isDaylight = hour >= 5 && hour <= 21;

      let totalWatts = 0;

      for (const [, panel] of this.panels) {
        if (!isDaylight) {
          panel.currentWatts = 0;
          panel.voltageV = 0;
          panel.currentA = 0;
        } else {
          // Bell-curve around solar noon (hour 12)
          const solarFraction = Math.max(
            0,
            Math.sin(((hour + minute / 60 - 5) / 16) * Math.PI)
          );
          const cloudFactor = 0.7 + Math.random() * 0.3;
          const effFactor = panel.efficiency / 100;

          panel.currentWatts = Math.round(
            panel.nominalWatts * solarFraction * cloudFactor
            * effFactor * panel.shadingFactor
          );
          panel.voltageV = Math.round((32 + Math.random() * 6) * 10) / 10;
          panel.currentA = panel.voltageV > 0
            ? Math.round((panel.currentWatts / panel.voltageV) * 100) / 100
            : 0;
        }

        // Peak tracking per panel
        if (panel.currentWatts > panel.peakWatts) {
          panel.peakWatts = panel.currentWatts;
          panel.peakTimestamp = now.toISOString();
        }

        // Accumulate energy (Wh) – 1-min sample
        panel.energyTodayWh += panel.currentWatts / 60;
        panel.energyLifetimeKwh += panel.currentWatts / 60000;

        totalWatts += panel.currentWatts;
      }

      // ── Aggregate output ──────────────────────────────────────────
      this.powerOutput.currentWatts = totalWatts;
      this.powerOutput.todayKwh += totalWatts / 60000;
      this.powerOutput.monthKwh += totalWatts / 60000;
      this.powerOutput.yearKwh += totalWatts / 60000;
      this.powerOutput.lifetimeKwh += totalWatts / 60000;

      if (totalWatts > this.powerOutput.peakWatts) {
        this.powerOutput.peakWatts = totalWatts;
        this.powerOutput.peakTimestamp = now.toISOString();
      }

      // ── Trend entry (kept 48 h at 5-min resolution) ───────────────
      if (minute % 5 === 0) {
        this.outputTrend.push({
          ts: now.toISOString(),
          watts: totalWatts,
          kwh: Math.round(this.powerOutput.todayKwh * 1000) / 1000
        });
      }

      this.emit('powerSampled', { totalWatts, todayKwh: this.powerOutput.todayKwh });
    } catch (err) {
      this.homey.log('[RoofSolar] Power sample error:', err.message);
    }
  }

  /**
   * Remove trend data older than 48 hours.
   * @private
   */
  _pruneOldTrendData() {
    try {
      const cutoff = Date.now() - 48 * 3600000;
      const before = this.outputTrend.length;
      this.outputTrend = this.outputTrend.filter(
        t => new Date(t.ts).getTime() > cutoff
      );
      if (this.outputTrend.length < before) {
        this.homey.log('[RoofSolar] Pruned', before - this.outputTrend.length,
          'old trend entries');
      }
    } catch (err) {
      this.homey.log('[RoofSolar] Prune error:', err.message);
    }
  }

  /**
   * Compute short-term trend (rising / falling / stable) over
   * the last N minutes of output samples.
   * @param {number} [windowMinutes=30]
   * @returns {{ direction: string, changePercent: number }}
   */
  getTrend(windowMinutes = 30) {
    const cutoff = Date.now() - windowMinutes * 60000;
    const recent = this.outputTrend.filter(
      t => new Date(t.ts).getTime() > cutoff
    );
    if (recent.length < 2) return { direction: 'insufficient_data', changePercent: 0 };

    const first = recent[0].watts;
    const last = recent[recent.length - 1].watts;
    const delta = first === 0 ? 0 : ((last - first) / first) * 100;
    let direction = 'stable';
    if (delta > 5) direction = 'rising';
    else if (delta < -5) direction = 'falling';

    return {
      direction,
      changePercent: Math.round(delta * 100) / 100
    };
  }

  // ====================================================================
  //  ROOF CONDITION ASSESSMENT
  // ====================================================================

  /**
   * Bootstrap roof-condition data.
   * @private
   */
  _initializeRoofCondition() {
    try {
      this.roofCondition.tiles.total = 450;
      this.roofCondition.tiles.damaged = Math.floor(Math.random() * 5);
      this.roofCondition.tiles.missing = Math.floor(Math.random() * 2);
      this.roofCondition.lastInspection = new Date().toISOString();
      this._recalcRoofScore();
      this.homey.log('[RoofSolar] Roof condition initialized, score:',
        this.roofCondition.overallScore);
    } catch (err) {
      this.homey.log('[RoofSolar] Roof init error:', err.message);
    }
  }

  /**
   * Periodic roof-condition update – gutter, snow, ice, temperature.
   * @private
   */
  _updateRoofCondition() {
    try {
      const now = new Date();
      const month = now.getMonth(); // 0-based
      const ambient = this._estimateAmbientTemp(now);

      // ── Gutter simulation ─────────────────────────────────────────
      // Blockage increases in autumn (Sep-Nov)
      if (month >= 8 && month <= 10) {
        this.roofCondition.gutterBlockagePercent = Math.min(
          100,
          this.roofCondition.gutterBlockagePercent + Math.random() * 2
        );
      } else {
        this.roofCondition.gutterBlockagePercent = Math.max(
          0,
          this.roofCondition.gutterBlockagePercent - Math.random() * 0.5
        );
      }
      this.roofCondition.gutterBlockagePercent =
        Math.round(this.roofCondition.gutterBlockagePercent * 10) / 10;
      this.roofCondition.gutterStatus =
        this.roofCondition.gutterBlockagePercent > this.thresholds.gutterBlockageWarning
          ? 'blocked'
          : this.roofCondition.gutterBlockagePercent > 20
            ? 'partial'
            : 'clear';

      // ── Ice dam detection ─────────────────────────────────────────
      if (ambient < 0 && this.roofCondition.snowLoadKgM2 > 30) {
        this.roofCondition.iceDamRisk = ambient < -10 ? 'high' : 'moderate';
      } else {
        this.roofCondition.iceDamRisk = 'none';
      }

      // ── Snow load estimation ──────────────────────────────────────
      if (month >= 10 || month <= 2) {
        // Winter accumulation
        if (ambient < 1) {
          this.roofCondition.snowLoadKgM2 = Math.min(
            this.roofCondition.snowLoadLimit,
            this.roofCondition.snowLoadKgM2 + Math.random() * 3
          );
        } else {
          // Melting
          this.roofCondition.snowLoadKgM2 = Math.max(
            0,
            this.roofCondition.snowLoadKgM2 - Math.random() * 5
          );
        }
      } else {
        this.roofCondition.snowLoadKgM2 = Math.max(
          0,
          this.roofCondition.snowLoadKgM2 - Math.random() * 8
        );
      }
      this.roofCondition.snowLoadKgM2 =
        Math.round(this.roofCondition.snowLoadKgM2 * 10) / 10;

      // ── Surface temp ──────────────────────────────────────────────
      this.roofCondition.surfaceTemp =
        Math.round((ambient + (Math.random() * 6 - 1)) * 10) / 10;

      // ── Moisture ──────────────────────────────────────────────────
      this.roofCondition.moistureDetected = ambient > 0 && Math.random() < 0.05;

      // ── Snow-load alerts ──────────────────────────────────────────
      if (this.roofCondition.snowLoadKgM2 > this.thresholds.snowLoadCritical) {
        this._addSystemAlert('snow_critical',
          `Snow load ${this.roofCondition.snowLoadKgM2} kg/m² exceeds critical threshold`,
          'critical');
      } else if (this.roofCondition.snowLoadKgM2 > this.thresholds.snowLoadWarning) {
        this._addSystemAlert('snow_warning',
          `Snow load ${this.roofCondition.snowLoadKgM2} kg/m² is high`, 'warning');
      }

      // ── Gutter alert ──────────────────────────────────────────────
      if (this.roofCondition.gutterStatus === 'blocked') {
        this._addSystemAlert('gutter_blocked',
          `Gutter blockage at ${this.roofCondition.gutterBlockagePercent}%`, 'warning');
      }

      this._recalcRoofScore();
      this.emit('roofConditionUpdated', this.roofCondition);
    } catch (err) {
      this.homey.log('[RoofSolar] Roof update error:', err.message);
    }
  }

  /**
   * Recalculate the overall roof health score (0-100).
   * @private
   */
  _recalcRoofScore() {
    let score = 100;
    const r = this.roofCondition;
    score -= r.gutterBlockagePercent * 0.2;
    score -= (r.iceDamRisk === 'high' ? 15 : r.iceDamRisk === 'moderate' ? 7 : 0);
    score -= Math.min(20, (r.snowLoadKgM2 / r.snowLoadLimit) * 20);
    score -= r.tiles.damaged * 2;
    score -= r.tiles.missing * 5;
    score -= r.moistureDetected ? 5 : 0;
    this.roofCondition.overallScore = Math.max(0, Math.round(score));
  }

  // ====================================================================
  //  CLEANING SCHEDULE
  // ====================================================================

  /**
   * Evaluate whether a cleaning session should be recommended.
   * @private
   */
  _evaluateCleaningSchedule() {
    try {
      const soiling = this.cleaning.soilingIndex;

      // Record soiling history (daily resolution)
      const today = new Date().toISOString().slice(0, 10);
      const lastEntry = this.cleaning.soilingHistory[
        this.cleaning.soilingHistory.length - 1
      ];
      if (!lastEntry || lastEntry.date !== today) {
        this.cleaning.soilingHistory.push({ date: today, soiling });
        if (this.cleaning.soilingHistory.length > 365) {
          this.cleaning.soilingHistory.shift();
        }
      }

      // Compute efficiency gain from cleaning
      this.cleaning.efficiencyGainPercent =
        Math.round(soiling * 0.85 * 100) / 100;

      // Estimated revenue gain from cleaning
      const avgDailyKwh = this.powerOutput.todayKwh || 15;
      const gainKwh = avgDailyKwh * (this.cleaning.efficiencyGainPercent / 100);
      const dailySavingSEK = gainKwh * this.roi.electricityPriceSEK;

      // Recommend cleaning when net benefit turns positive within 30 days
      const daysToPayback = dailySavingSEK > 0
        ? this.cleaning.cleaningCostSEK / dailySavingSEK
        : Infinity;

      if (soiling >= this.thresholds.soilingTrigger || daysToPayback < 60) {
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + Math.max(1, Math.round(daysToPayback / 4)));
        this.cleaning.nextRecommended = nextDate.toISOString();

        if (soiling >= this.thresholds.soilingTrigger) {
          this._addSystemAlert('cleaning_recommended',
            `Soiling index ${soiling}% – cleaning recommended (payback in ${Math.round(daysToPayback)} days)`,
            'info');
        }
      } else {
        this.cleaning.nextRecommended = null;
      }

      this.emit('cleaningEvaluated', this.cleaning);
    } catch (err) {
      this.homey.log('[RoofSolar] Cleaning schedule error:', err.message);
    }
  }

  /**
   * Record a manual cleaning event.
   * @param {string} [notes] - Optional notes
   * @returns {object} Updated cleaning state
   */
  recordCleaning(notes) {
    this.cleaning.lastClean = new Date().toISOString();
    this.cleaning.soilingIndex = 0;
    this.cleaning.nextRecommended = null;

    // Reset panel soiling
    for (const [, panel] of this.panels) {
      panel.soilingPercent = 0;
    }

    this.homey.log('[RoofSolar] Cleaning recorded.', notes || '');
    this.emit('cleaningRecorded');
    return { ...this.cleaning };
  }

  // ====================================================================
  //  STORM / WIND-DAMAGE RISK
  // ====================================================================

  /**
   * Assess storm and wind damage risk.
   * @private
   */
  _assessStormRisk() {
    try {
      const now = new Date();
      const month = now.getMonth();

      // Simulated weather conditions
      const baseWind = month >= 9 || month <= 2 ? 10 : 5;
      this.stormRisk.windSpeedMs =
        Math.round((baseWind + Math.random() * 12) * 10) / 10;
      this.stormRisk.gustSpeedMs =
        Math.round((this.stormRisk.windSpeedMs * (1.3 + Math.random() * 0.4)) * 10) / 10;
      this.stormRisk.hailProbability =
        Math.round(Math.random() * (month >= 3 && month <= 5 ? 15 : 3) * 10) / 10;

      // ── Risk score calculation ────────────────────────────────────
      let score = 0;
      score += Math.min(40, (this.stormRisk.windSpeedMs / 30) * 40);
      score += Math.min(30, (this.stormRisk.gustSpeedMs / 40) * 30);
      score += Math.min(20, this.stormRisk.hailProbability);
      score += Math.min(10,
        this.stormRisk.historicalDamageEvents.length * 2);
      this.stormRisk.riskScore = Math.round(Math.min(100, score));

      // ── Risk level mapping ────────────────────────────────────────
      if (this.stormRisk.riskScore >= 70) {
        this.stormRisk.currentRisk = 'critical';
      } else if (this.stormRisk.riskScore >= 45) {
        this.stormRisk.currentRisk = 'high';
      } else if (this.stormRisk.riskScore >= 20) {
        this.stormRisk.currentRisk = 'moderate';
      } else {
        this.stormRisk.currentRisk = 'low';
      }

      // ── Alerts ────────────────────────────────────────────────────
      if (this.stormRisk.windSpeedMs > this.thresholds.windSpeedCritical) {
        this._addSystemAlert('wind_critical',
          `Wind speed ${this.stormRisk.windSpeedMs} m/s – critical threshold exceeded`,
          'critical');
      } else if (this.stormRisk.windSpeedMs > this.thresholds.windSpeedWarning) {
        this._addSystemAlert('wind_warning',
          `Wind speed ${this.stormRisk.windSpeedMs} m/s – elevated`, 'warning');
      }

      this.emit('stormRiskUpdated', this.stormRisk);
    } catch (err) {
      this.homey.log('[RoofSolar] Storm risk error:', err.message);
    }
  }

  /**
   * Log a historical damage event for correlation.
   * @param {object} event
   * @param {string} event.date      - ISO date string
   * @param {string} event.type      - e.g. 'hail', 'wind', 'debris'
   * @param {string} [event.description]
   * @param {number} [event.costSEK]
   */
  recordDamageEvent(event) {
    this.stormRisk.historicalDamageEvents.push({
      ...event,
      recordedAt: new Date().toISOString()
    });
    this.homey.log('[RoofSolar] Damage event recorded:', event.type);
    this.emit('damageEventRecorded', event);
  }

  // ====================================================================
  //  ENERGY ROI CALCULATIONS
  // ====================================================================

  /**
   * Recalculate financial ROI and payback tracking.
   * @private
   */
  _calculateROI() {
    try {
      const totalKwh = this.powerOutput.lifetimeKwh;

      // Revenue from self-consumed + feed-in
      const selfConsumptionRatio = 0.65;
      const selfConsumedKwh = totalKwh * selfConsumptionRatio;
      const exportedKwh = totalKwh * (1 - selfConsumptionRatio);

      this.roi.totalSavingsSEK = Math.round(
        (selfConsumedKwh * this.roi.electricityPriceSEK
          + exportedKwh * this.roi.feedInTariffSEK) * 100
      ) / 100;

      // Payback
      this.roi.paybackPercent = this.roi.installationCostSEK > 0
        ? Math.round(
          (this.roi.totalSavingsSEK / this.roi.installationCostSEK) * 10000
        ) / 100
        : 0;

      // Annualised estimate
      const panelAge = this._averageField('age') || 1; // days
      const dailySaving = this.roi.totalSavingsSEK / Math.max(1, panelAge);
      const annualSaving = dailySaving * 365;
      this.roi.paybackYears = annualSaving > 0
        ? Math.round((this.roi.installationCostSEK / annualSaving) * 100) / 100
        : 0;
      this.roi.annualReturnPercent = this.roi.installationCostSEK > 0
        ? Math.round((annualSaving / this.roi.installationCostSEK) * 10000) / 100
        : 0;

      // CO₂ offset (Swedish mix ~47 g CO₂/kWh, but marginal is higher ~400 g)
      this.roi.co2OffsetKg = Math.round(totalKwh * 0.4 * 100) / 100;

      this.emit('roiUpdated', this.roi);
    } catch (err) {
      this.homey.log('[RoofSolar] ROI calc error:', err.message);
    }
  }

  /**
   * Update financial configuration.
   * @param {object} config
   * @param {number} [config.installationCostSEK]
   * @param {number} [config.electricityPriceSEK]
   * @param {number} [config.feedInTariffSEK]
   */
  updateROIConfig(config) {
    if (config.installationCostSEK != null) {
      this.roi.installationCostSEK = config.installationCostSEK;
    }
    if (config.electricityPriceSEK != null) {
      this.roi.electricityPriceSEK = config.electricityPriceSEK;
    }
    if (config.feedInTariffSEK != null) {
      this.roi.feedInTariffSEK = config.feedInTariffSEK;
    }
    this._calculateROI();
    this.homey.log('[RoofSolar] ROI config updated');
  }

  // ====================================================================
  //  SHADING ANALYSIS
  // ====================================================================

  /**
   * Bootstrap the shading model with default obstructions.
   * @private
   */
  _initializeShadingModel() {
    try {
      this.shading.obstructions = this.shading.obstructions.length
        ? this.shading.obstructions
        : [
          { name: 'chimney', azimuth: 210, elevation: 35, widthDeg: 10 },
          { name: 'tree_east', azimuth: 95, elevation: 25, widthDeg: 20 },
          { name: 'neighbour_ridge', azimuth: 240, elevation: 15, widthDeg: 30 }
        ];

      this._updateShadingModel();
      this.homey.log('[RoofSolar] Shading model initialized with',
        this.shading.obstructions.length, 'obstructions');
    } catch (err) {
      this.homey.log('[RoofSolar] Shading init error:', err.message);
    }
  }

  /**
   * Recalculate hour-by-hour shading factors based on simplified sun
   * position and defined obstructions.
   * @private
   */
  _updateShadingModel() {
    try {
      const now = new Date();
      const dayOfYear = this._dayOfYear(now);
      const hourlyShading = [];

      for (let hour = 0; hour < 24; hour++) {
        const sun = this._sunPosition(hour, dayOfYear);

        if (sun.elevation <= 0) {
          hourlyShading.push({
            hour,
            sunAzimuth: null,
            sunElevation: null,
            shadingFactor: 0,
            obstructed: false
          });
          continue;
        }

        let obstructed = false;
        let shadingLoss = 0;

        for (const obs of this.shading.obstructions) {
          const azDiff = Math.abs(sun.azimuth - obs.azimuth);
          if (azDiff < obs.widthDeg / 2 && sun.elevation < obs.elevation) {
            obstructed = true;
            shadingLoss = Math.max(shadingLoss, 0.7);
          } else if (azDiff < obs.widthDeg && sun.elevation < obs.elevation + 5) {
            shadingLoss = Math.max(shadingLoss, 0.3);
          }
        }

        const factor = Math.round((1 - shadingLoss) * 1000) / 1000;
        hourlyShading.push({
          hour,
          sunAzimuth: Math.round(sun.azimuth * 10) / 10,
          sunElevation: Math.round(sun.elevation * 10) / 10,
          shadingFactor: factor,
          obstructed
        });
      }

      this.shading.hourlyShading = hourlyShading;
      this.shading.effectiveSunHours = hourlyShading
        .filter(h => h.shadingFactor > 0)
        .reduce((sum, h) => sum + h.shadingFactor, 0);
      this.shading.effectiveSunHours =
        Math.round(this.shading.effectiveSunHours * 100) / 100;

      // Apply average shading to panels
      const avgFactor = hourlyShading.reduce(
        (s, h) => s + h.shadingFactor, 0
      ) / 24;
      for (const [, panel] of this.panels) {
        // Add per-panel variation ±5 %
        panel.shadingFactor = Math.min(
          1,
          Math.max(0, avgFactor + (Math.random() * 0.1 - 0.05))
        );
        panel.shadingFactor = Math.round(panel.shadingFactor * 1000) / 1000;
      }

      this.emit('shadingUpdated', this.shading);
    } catch (err) {
      this.homey.log('[RoofSolar] Shading model error:', err.message);
    }
  }

  /**
   * Simplified sun-position calculation (adequate for shading model).
   * @private
   * @param {number} hour      - Hour of day (0-23)
   * @param {number} dayOfYear - Day of year (1-366)
   * @returns {{ azimuth: number, elevation: number }}
   */
  _sunPosition(hour, dayOfYear) {
    const lat = this.shading.latitude * (Math.PI / 180);
    const declination = 23.45 * Math.sin(
      (2 * Math.PI / 365) * (dayOfYear - 81)
    ) * (Math.PI / 180);
    const hourAngle = (hour - 12) * 15 * (Math.PI / 180);

    const sinElev = Math.sin(lat) * Math.sin(declination)
      + Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle);
    const elevation = Math.asin(
      Math.max(-1, Math.min(1, sinElev))
    ) * (180 / Math.PI);

    const cosAz = (Math.sin(declination) - Math.sin(lat) * sinElev)
      / (Math.cos(lat) * Math.cos(elevation * Math.PI / 180) + 1e-10);
    let azimuth = Math.acos(
      Math.max(-1, Math.min(1, cosAz))
    ) * (180 / Math.PI);
    if (hourAngle > 0) azimuth = 360 - azimuth;

    return { azimuth, elevation };
  }

  /**
   * Day-of-year helper.
   * @private
   * @param {Date} date
   * @returns {number}
   */
  _dayOfYear(date) {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date - start;
    return Math.floor(diff / 86400000);
  }

  /**
   * Add or update an obstruction in the shading model.
   * @param {object} obstruction
   * @param {string} obstruction.name
   * @param {number} obstruction.azimuth     - Compass bearing (°)
   * @param {number} obstruction.elevation   - Height angle (°)
   * @param {number} obstruction.widthDeg    - Angular width (°)
   */
  addObstruction(obstruction) {
    const existing = this.shading.obstructions.findIndex(
      o => o.name === obstruction.name
    );
    if (existing >= 0) {
      this.shading.obstructions[existing] = obstruction;
    } else {
      this.shading.obstructions.push(obstruction);
    }
    this._updateShadingModel();
    this.homey.log('[RoofSolar] Obstruction updated:', obstruction.name);
  }

  /**
   * Remove an obstruction by name.
   * @param {string} name
   */
  removeObstruction(name) {
    this.shading.obstructions = this.shading.obstructions.filter(
      o => o.name !== name
    );
    this._updateShadingModel();
    this.homey.log('[RoofSolar] Obstruction removed:', name);
  }

  // ====================================================================
  //  INTEGRATION POINTS
  // ====================================================================

  /**
   * Data payload for energy-trading / grid systems.
   * @returns {object}
   */
  getGridIntegrationData() {
    return {
      currentProductionWatts: this.powerOutput.currentWatts,
      todayProductionKwh: Math.round(this.powerOutput.todayKwh * 1000) / 1000,
      forecastRemainingKwh: this._forecastRemainingToday(),
      panelCount: this.panels.size,
      averageEfficiency: this._averageField('efficiency'),
      shadingEffectiveSunHours: this.shading.effectiveSunHours,
      stormRisk: this.stormRisk.currentRisk,
      roofHealthScore: this.roofCondition.overallScore,
      feedInTariffSEK: this.roi.feedInTariffSEK,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Rough forecast of remaining production today.
   * @private
   * @returns {number} kWh
   */
  _forecastRemainingToday() {
    const now = new Date();
    const hour = now.getHours();
    const sunsetHour = 21;
    if (hour >= sunsetHour) return 0;
    const remainingHours = sunsetHour - hour;
    const avgHourlyKwh = this.powerOutput.todayKwh / Math.max(1, hour - 5);
    return Math.round(avgHourlyKwh * remainingHours * 0.8 * 1000) / 1000;
  }

  /**
   * Subscribe to production events for external systems.
   * @param {Function} callback - Receives { totalWatts, todayKwh }
   * @returns {Function} Unsubscribe function
   */
  onProductionUpdate(callback) {
    this.on('powerSampled', callback);
    return () => this.off('powerSampled', callback);
  }

  // ====================================================================
  //  SYSTEM ALERTS (non-panel)
  // ====================================================================

  /**
   * Add a system-level alert (deduped on type while unresolved).
   * @private
   * @param {string} type
   * @param {string} message
   * @param {string} severity
   */
  _addSystemAlert(type, message, severity) {
    const existing = this.alerts.find(
      a => a.type === type && !a.resolved
    );
    if (existing) return; // already active

    const alert = {
      id: `sys-${type}-${Date.now()}`,
      panelId: null,
      type,
      message,
      severity,
      timestamp: new Date().toISOString(),
      resolved: false
    };
    this.alerts.push(alert);
    this.emit('alert', alert);
    this.homey.log(`[RoofSolar] ALERT [${severity}]: ${message}`);
  }

  /**
   * Resolve an alert by id.
   * @param {string} alertId
   */
  resolveAlert(alertId) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = new Date().toISOString();
      this.homey.log('[RoofSolar] Alert resolved:', alertId);
    }
  }

  /**
   * Return active (unresolved) alerts.
   * @returns {object[]}
   */
  getActiveAlerts() {
    return this.alerts.filter(a => !a.resolved);
  }

  // ====================================================================
  //  PUBLIC API – getStatus / getAnalytics / getHealth
  // ====================================================================

  /**
   * High-level system status snapshot.
   * @returns {object}
   */
  getStatus() {
    return {
      initialized: this.initialized,
      panelCount: this.panels.size,
      power: { ...this.powerOutput },
      trend: this.getTrend(),
      roofCondition: { ...this.roofCondition },
      cleaning: {
        soilingIndex: this.cleaning.soilingIndex,
        lastClean: this.cleaning.lastClean,
        nextRecommended: this.cleaning.nextRecommended,
        efficiencyGainPercent: this.cleaning.efficiencyGainPercent
      },
      stormRisk: {
        currentRisk: this.stormRisk.currentRisk,
        riskScore: this.stormRisk.riskScore,
        windSpeedMs: this.stormRisk.windSpeedMs,
        gustSpeedMs: this.stormRisk.gustSpeedMs
      },
      roi: { ...this.roi },
      shading: {
        effectiveSunHours: this.shading.effectiveSunHours,
        obstructionCount: this.shading.obstructions.length
      },
      activeAlerts: this.getActiveAlerts().length,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Detailed analytics payload for dashboards / reports.
   * @returns {object}
   */
  getAnalytics() {
    const panelData = [];
    for (const [, p] of this.panels) {
      panelData.push({
        id: p.id,
        row: p.row,
        col: p.col,
        currentWatts: p.currentWatts,
        efficiency: p.efficiency,
        temperature: p.temperature,
        soilingPercent: p.soilingPercent,
        degradationPercent: p.degradationPercent,
        shadingFactor: p.shadingFactor,
        status: p.status,
        energyTodayWh: Math.round(p.energyTodayWh),
        energyLifetimeKwh: Math.round(p.energyLifetimeKwh * 100) / 100,
        peakWatts: p.peakWatts,
        peakTimestamp: p.peakTimestamp,
        microInverterStatus: p.microInverterStatus
      });
    }

    return {
      panels: panelData,
      fleet: {
        averageEfficiency: this._averageField('efficiency'),
        averageTemperature: this._averageField('temperature'),
        totalCurrentWatts: this.powerOutput.currentWatts,
        totalTodayKwh: Math.round(this.powerOutput.todayKwh * 1000) / 1000,
        totalLifetimeKwh: Math.round(this.powerOutput.lifetimeKwh * 100) / 100,
        worstPanel: this._worstPanel(),
        bestPanel: this._bestPanel()
      },
      outputTrend: this.outputTrend.slice(-50),
      soilingHistory: this.cleaning.soilingHistory.slice(-30),
      shadingProfile: this.shading.hourlyShading,
      stormHistory: this.stormRisk.historicalDamageEvents,
      roi: { ...this.roi },
      gridIntegration: this.getGridIntegrationData(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Health-check summary suitable for monitoring / alerting dashboards.
   * @returns {object}
   */
  getHealth() {
    const activeAlerts = this.getActiveAlerts();
    const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical');
    const warningAlerts = activeAlerts.filter(a => a.severity === 'warning');

    const faultyPanels = [];
    const degradedPanels = [];
    for (const [, p] of this.panels) {
      if (p.faults.length > 0) faultyPanels.push(p.id);
      if (p.status === 'degraded') degradedPanels.push(p.id);
    }

    let overallHealth = 'healthy';
    if (criticalAlerts.length > 0 || faultyPanels.length > 3) {
      overallHealth = 'critical';
    } else if (warningAlerts.length > 0 || degradedPanels.length > 2) {
      overallHealth = 'degraded';
    }

    return {
      overall: overallHealth,
      initialized: this.initialized,
      panels: {
        total: this.panels.size,
        nominal: this.panels.size - faultyPanels.length - degradedPanels.length,
        faulty: faultyPanels,
        degraded: degradedPanels
      },
      roofScore: this.roofCondition.overallScore,
      soilingIndex: this.cleaning.soilingIndex,
      stormRisk: this.stormRisk.currentRisk,
      alerts: {
        critical: criticalAlerts.length,
        warning: warningAlerts.length,
        info: activeAlerts.filter(a => a.severity === 'info').length,
        details: activeAlerts.slice(0, 10) // most recent 10
      },
      uptime: {
        intervalsActive: this.intervals.length,
        trendDataPoints: this.outputTrend.length
      },
      timestamp: new Date().toISOString()
    };
  }

  // ====================================================================
  //  PANEL QUERIES
  // ====================================================================

  /**
   * Get detailed data for a single panel.
   * @param {string} panelId
   * @returns {object|null}
   */
  getPanelDetail(panelId) {
    const p = this.panels.get(panelId);
    if (!p) return null;
    return { ...p };
  }

  /**
   * Return list of all panel IDs.
   * @returns {string[]}
   */
  listPanels() {
    return Array.from(this.panels.keys());
  }

  /**
   * Find the worst-performing panel by current efficiency.
   * @private
   * @returns {{ id: string, efficiency: number }|null}
   */
  _worstPanel() {
    let worst = null;
    for (const [, p] of this.panels) {
      if (!worst || p.efficiency < worst.efficiency) {
        worst = { id: p.id, efficiency: p.efficiency };
      }
    }
    return worst;
  }

  /**
   * Find the best-performing panel by current watts.
   * @private
   * @returns {{ id: string, currentWatts: number }|null}
   */
  _bestPanel() {
    let best = null;
    for (const [, p] of this.panels) {
      if (!best || p.currentWatts > best.currentWatts) {
        best = { id: p.id, currentWatts: p.currentWatts };
      }
    }
    return best;
  }

  // ====================================================================
  //  CONFIGURATION
  // ====================================================================

  /**
   * Update geographic / installation parameters.
   * @param {object} config
   * @param {number} [config.latitude]
   * @param {number} [config.longitude]
   * @param {number} [config.azimuthDeg]
   * @param {number} [config.tiltDeg]
   * @param {number} [config.panelCount]
   * @param {number} [config.nominalWattsPerPanel]
   */
  configure(config) {
    if (config.latitude != null) this.shading.latitude = config.latitude;
    if (config.longitude != null) this.shading.longitude = config.longitude;
    if (config.azimuthDeg != null) this.shading.azimuthDeg = config.azimuthDeg;
    if (config.tiltDeg != null) this.shading.tiltDeg = config.tiltDeg;

    if (config.nominalWattsPerPanel != null) {
      for (const [, panel] of this.panels) {
        panel.nominalWatts = config.nominalWattsPerPanel;
      }
    }

    if (config.panelCount != null && config.panelCount !== this.panels.size) {
      this.panels.clear();
      for (let i = 1; i <= config.panelCount; i++) {
        const id = `panel-${String(i).padStart(3, '0')}`;
        this.panels.set(id, this._createPanelRecord(id, i));
      }
      this.homey.log('[RoofSolar] Panel count changed to', config.panelCount);
    }

    this._updateShadingModel();
    this._calculateROI();
    this.homey.log('[RoofSolar] Configuration updated');
  }

  /**
   * Update alert thresholds.
   * @param {object} newThresholds - Partial threshold overrides
   */
  setThresholds(newThresholds) {
    Object.assign(this.thresholds, newThresholds);
    this.homey.log('[RoofSolar] Thresholds updated');
  }

  // ====================================================================
  //  UTILITY HELPERS
  // ====================================================================

  /**
   * Average a numeric field across all panels.
   * @private
   * @param {string} field
   * @returns {number}
   */
  _averageField(field) {
    if (this.panels.size === 0) return 0;
    let sum = 0;
    for (const [, p] of this.panels) {
      sum += (p[field] || 0);
    }
    return Math.round((sum / this.panels.size) * 100) / 100;
  }

  /**
   * Estimate ambient temperature based on month and time-of-day.
   * Uses a rough Stockholm climate model.
   * @private
   * @param {Date} date
   * @returns {number} °C
   */
  _estimateAmbientTemp(date) {
    const month = date.getMonth();
    const hour = date.getHours();

    // Monthly average temps (Stockholm)
    const monthlyAvg = [
      -3, -3, 1, 6, 12, 17, 20, 19, 14, 8, 3, -1
    ];
    const base = monthlyAvg[month] || 10;

    // Diurnal variation ±5 °C
    const diurnal = Math.sin(((hour - 6) / 24) * 2 * Math.PI) * 5;

    return Math.round((base + diurnal + (Math.random() * 2 - 1)) * 10) / 10;
  }

  /**
   * Generate a human-readable report string.
   * @returns {string}
   */
  generateReport() {
    const s = this.getStatus();
    const h = this.getHealth();

    const lines = [
      '═══════════════════════════════════════════════════',
      '  SMART ROOF & SOLAR MONITORING – STATUS REPORT',
      '═══════════════════════════════════════════════════',
      '',
      `  Overall Health: ${h.overall.toUpperCase()}`,
      `  Panels: ${s.panelCount} (${h.panels.nominal} nominal, ${h.panels.faulty.length} faulty)`,
      `  Current Output: ${s.power.currentWatts} W`,
      `  Today: ${s.power.todayKwh.toFixed(2)} kWh | Lifetime: ${s.power.lifetimeKwh.toFixed(1)} kWh`,
      `  Trend: ${s.trend.direction} (${s.trend.changePercent}%)`,
      '',
      '  ── Roof ──────────────────────────────────────',
      `  Score: ${s.roofCondition.overallScore}/100`,
      `  Gutters: ${s.roofCondition.gutterStatus} (${s.roofCondition.gutterBlockagePercent}%)`,
      `  Snow Load: ${s.roofCondition.snowLoadKgM2} kg/m²`,
      `  Ice Dam Risk: ${s.roofCondition.iceDamRisk}`,
      '',
      '  ── Cleaning ──────────────────────────────────',
      `  Soiling Index: ${s.cleaning.soilingIndex}%`,
      `  Next Recommended: ${s.cleaning.nextRecommended || 'N/A'}`,
      `  Efficiency Gain if Cleaned: ${s.cleaning.efficiencyGainPercent}%`,
      '',
      '  ── Storm Risk ────────────────────────────────',
      `  Risk: ${s.stormRisk.currentRisk} (score ${s.stormRisk.riskScore})`,
      `  Wind: ${s.stormRisk.windSpeedMs} m/s | Gust: ${s.stormRisk.gustSpeedMs} m/s`,
      '',
      '  ── Financial ─────────────────────────────────',
      `  Total Savings: ${s.roi.totalSavingsSEK.toFixed(0)} SEK`,
      `  Payback: ${s.roi.paybackYears} years (${s.roi.paybackPercent}%)`,
      `  Annual Return: ${s.roi.annualReturnPercent}%`,
      `  CO₂ Offset: ${s.roi.co2OffsetKg} kg`,
      '',
      '  ── Shading ───────────────────────────────────',
      `  Effective Sun Hours: ${s.shading.effectiveSunHours}`,
      `  Obstructions: ${s.shading.obstructionCount}`,
      '',
      `  Active Alerts: ${s.activeAlerts}`,
      `  Timestamp: ${s.timestamp}`,
      '═══════════════════════════════════════════════════'
    ];

    return lines.join('\n');
  }
}

module.exports = SmartRoofSolarMonitoringSystem;
