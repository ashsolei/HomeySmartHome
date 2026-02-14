'use strict';

/**
 * @fileoverview Smart Home Ventilation Heat Recovery System
 * Manages HRV/ERV units with heat recovery efficiency monitoring, CO2-based
 * demand-controlled ventilation, seasonal mode switching, humidity management,
 * zone-based airflow balancing, and energy savings tracking.
 * @module SmartHomeVentilationHeatRecoverySystem
 */

/** @typedef {'off'|'low'|'medium'|'high'|'boost'} FanSpeed */
/** @typedef {'winter'|'summer'|'auto'} SeasonalMode */
/** @typedef {'idle'|'active'|'defrosting'|'bypass'|'boost'} UnitState */

/**
 * @typedef {Object} HRVUnit
 * @property {string} id - Unique unit identifier
 * @property {string} name - Display name
 * @property {UnitState} state - Current operating state
 * @property {FanSpeed} fanSpeed - Current fan speed setting
 * @property {number} fanSpeedPercent - Fan speed as percentage (0-100)
 * @property {boolean} bypassOpen - Whether the bypass valve is open
 * @property {boolean} defrostActive - Whether the defrost cycle is running
 * @property {number} supplyTemp - Supply air temperature (°C)
 * @property {number} extractTemp - Extract air temperature (°C)
 * @property {number} outdoorTemp - Outdoor air temperature (°C)
 * @property {number} exhaustTemp - Exhaust air temperature (°C)
 * @property {number} recoveryEfficiency - Current heat recovery efficiency (0-100%)
 * @property {number} supplyFlowRate - Supply airflow rate (m³/h)
 * @property {number} extractFlowRate - Extract airflow rate (m³/h)
 * @property {number} powerConsumption - Current power draw (W)
 * @property {string[]} zones - Associated zone IDs
 * @property {number} registeredAt - Registration timestamp
 */

/**
 * @typedef {Object} FilterStatus
 * @property {string} unitId - Associated HRV unit ID
 * @property {string} type - Filter type ('supply'|'extract')
 * @property {number} installedAt - Installation timestamp
 * @property {number} lifespanDays - Expected filter lifespan in days
 * @property {number} pressureDrop - Current pressure drop across filter (Pa)
 * @property {number} baselinePressureDrop - Pressure drop when new (Pa)
 * @property {number} efficiencyPercent - Current filtration efficiency (0-100%)
 * @property {boolean} replacementDue - Whether replacement is recommended
 */

/**
 * @typedef {Object} VentilationZone
 * @property {string} id - Zone identifier
 * @property {string} name - Zone display name
 * @property {number} targetFlowRate - Target airflow rate (m³/h)
 * @property {number} actualFlowRate - Measured airflow rate (m³/h)
 * @property {number} damperPosition - Damper position (0-100%)
 * @property {number} co2Level - Current CO2 level (ppm)
 * @property {number} humidity - Current relative humidity (%)
 * @property {boolean} occupied - Occupancy status
 * @property {number} occupantCount - Number of detected occupants
 */

/**
 * @typedef {Object} EnergySavings
 * @property {number} recoveredHeatKwh - Total recovered heat energy (kWh)
 * @property {number} costSavings - Estimated cost savings (currency units)
 * @property {number} co2Avoided - Avoided CO2 emissions (kg)
 * @property {number} periodStart - Start of tracking period
 * @property {number} periodEnd - End of tracking period
 */

const FAN_SPEED_MAP = { off: 0, low: 25, medium: 50, high: 75, boost: 100 };
const CO2_THRESHOLDS = { excellent: 400, good: 600, acceptable: 800, poor: 1000, critical: 1500 };
const HUMIDITY_LIMITS = { condensationRisk: 70, comfortHigh: 60, comfortLow: 35, dryAir: 25 };
const DEFROST_TRIGGER_TEMP = -5;
const BYPASS_TEMP_DIFFERENTIAL = 2;
const DEFAULT_FILTER_LIFESPAN_DAYS = 180;
const ENERGY_COST_PER_KWH = 0.12;
const CO2_FACTOR_PER_KWH = 0.233;

class SmartHomeVentilationHeatRecoverySystem {
  /**
   * @param {Object} homey - Homey instance for logging and settings
   */
  constructor(homey) {
    this.homey = homey;

    /** @type {Map<string, HRVUnit>} */
    this.units = new Map();

    /** @type {Map<string, FilterStatus[]>} */
    this.filters = new Map();

    /** @type {Map<string, VentilationZone>} */
    this.zones = new Map();

    /** @type {SeasonalMode} */
    this.seasonalMode = 'auto';

    /** @type {EnergySavings} */
    this.energySavings = {
      recoveredHeatKwh: 0,
      costSavings: 0,
      co2Avoided: 0,
      periodStart: Date.now(),
      periodEnd: Date.now(),
    };

    /** @type {number} */
    this.co2Setpoint = 800;

    /** @type {number} */
    this.humiditySetpoint = 50;

    /** @type {Map<string, number>} */
    this._outdoorReadings = new Map();

    /** @type {number|null} */
    this._monitorInterval = null;

    /** @type {number|null} */
    this._filterCheckInterval = null;

    /** @type {number|null} */
    this._energyCalcInterval = null;

    /** @type {number|null} */
    this._defrostCheckInterval = null;

    /** @type {number|null} */
    this._zoneBalanceInterval = null;

    /** @type {boolean} */
    this._initialized = false;

    /** @type {Function[]} */
    this._eventListeners = [];
  }

  // ──────────────────────────────────────────────
  // Lifecycle
  // ──────────────────────────────────────────────

  /**
   * Initialize the system, restore persisted state, and start background tasks.
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this._initialized) return;
    this.homey.log('[VentHR] Initializing Smart Home Ventilation Heat Recovery System');

    await this._restoreState();
    this._startMonitoringLoop();
    this._startFilterCheckLoop();
    this._startEnergyCalculationLoop();
    this._startDefrostCheckLoop();
    this._startZoneBalancingLoop();

    this._initialized = true;
    this.homey.log(`[VentHR] Initialized — ${this.units.size} unit(s), ${this.zones.size} zone(s)`);
  }

  /**
   * Destroy the system and clean up all intervals, timers, and listeners.
   */
  destroy() {
    this.homey.log('[VentHR] Destroying Ventilation Heat Recovery System');

    if (this._monitorInterval) { clearInterval(this._monitorInterval); this._monitorInterval = null; }
    if (this._filterCheckInterval) { clearInterval(this._filterCheckInterval); this._filterCheckInterval = null; }
    if (this._energyCalcInterval) { clearInterval(this._energyCalcInterval); this._energyCalcInterval = null; }
    if (this._defrostCheckInterval) { clearInterval(this._defrostCheckInterval); this._defrostCheckInterval = null; }
    if (this._zoneBalanceInterval) { clearInterval(this._zoneBalanceInterval); this._zoneBalanceInterval = null; }

    for (const removeFn of this._eventListeners) {
      try { removeFn(); } catch (_) { /* ignore */ }
    }
    this._eventListeners = [];

    this._persistState();
    this._initialized = false;
    this.homey.log('[VentHR] Destroyed');
  }

  // ──────────────────────────────────────────────
  // 1. HRV / ERV Unit Management
  // ──────────────────────────────────────────────

  /**
   * Register a new HRV/ERV unit.
   * @param {string} id - Unique identifier
   * @param {string} name - Display name
   * @param {string[]} [zones=[]] - Associated zone IDs
   * @returns {HRVUnit}
   */
  registerUnit(id, name, zones = []) {
    if (this.units.has(id)) {
      this.homey.log(`[VentHR] Unit '${id}' already registered`);
      return this.units.get(id);
    }

    /** @type {HRVUnit} */
    const unit = {
      id,
      name,
      state: 'idle',
      fanSpeed: 'low',
      fanSpeedPercent: FAN_SPEED_MAP.low,
      bypassOpen: false,
      defrostActive: false,
      supplyTemp: 20,
      extractTemp: 22,
      outdoorTemp: 10,
      exhaustTemp: 12,
      recoveryEfficiency: 0,
      supplyFlowRate: 0,
      extractFlowRate: 0,
      powerConsumption: 0,
      zones: [...zones],
      registeredAt: Date.now(),
    };

    this.units.set(id, unit);
    this._initFiltersForUnit(id);
    this.homey.log(`[VentHR] Registered unit '${name}' (${id}), zones: [${zones.join(', ')}]`);
    this._persistState();
    return unit;
  }

  /**
   * Remove an HRV/ERV unit.
   * @param {string} unitId
   * @returns {boolean} Whether the unit was removed
   */
  removeUnit(unitId) {
    const removed = this.units.delete(unitId);
    if (removed) {
      this.filters.delete(unitId);
      this.homey.log(`[VentHR] Removed unit '${unitId}'`);
      this._persistState();
    }
    return removed;
  }

  /**
   * Set fan speed for a unit.
   * @param {string} unitId
   * @param {FanSpeed} speed
   * @returns {boolean}
   */
  setFanSpeed(unitId, speed) {
    const unit = this.units.get(unitId);
    if (!unit) return false;
    if (!(speed in FAN_SPEED_MAP)) {
      this.homey.log(`[VentHR] Invalid fan speed '${speed}'`);
      return false;
    }

    unit.fanSpeed = speed;
    unit.fanSpeedPercent = FAN_SPEED_MAP[speed];
    unit.state = speed === 'off' ? 'idle' : (speed === 'boost' ? 'boost' : 'active');
    unit.powerConsumption = this._estimatePower(unit.fanSpeedPercent);

    this.homey.log(`[VentHR] Unit '${unitId}' fan speed → ${speed} (${unit.fanSpeedPercent}%)`);
    this._persistState();
    return true;
  }

  /**
   * Set the bypass valve state for a unit.
   * @param {string} unitId
   * @param {boolean} open
   * @returns {boolean}
   */
  setBypass(unitId, open) {
    const unit = this.units.get(unitId);
    if (!unit) return false;

    unit.bypassOpen = open;
    unit.state = open ? 'bypass' : (unit.fanSpeedPercent > 0 ? 'active' : 'idle');
    this.homey.log(`[VentHR] Unit '${unitId}' bypass valve → ${open ? 'OPEN' : 'CLOSED'}`);
    this._persistState();
    return true;
  }

  /**
   * Trigger a defrost cycle on a unit.
   * @param {string} unitId
   * @returns {boolean}
   */
  triggerDefrost(unitId) {
    const unit = this.units.get(unitId);
    if (!unit) return false;
    if (unit.defrostActive) return true;

    unit.defrostActive = true;
    unit.state = 'defrosting';
    this.homey.log(`[VentHR] Unit '${unitId}' defrost cycle STARTED`);

    setTimeout(() => {
      if (this.units.has(unitId)) {
        unit.defrostActive = false;
        unit.state = unit.fanSpeedPercent > 0 ? 'active' : 'idle';
        this.homey.log(`[VentHR] Unit '${unitId}' defrost cycle COMPLETE`);
        this._persistState();
      }
    }, 5 * 60 * 1000);

    this._persistState();
    return true;
  }

  /**
   * Get current status of a unit.
   * @param {string} unitId
   * @returns {HRVUnit|null}
   */
  getUnitStatus(unitId) {
    return this.units.get(unitId) || null;
  }

  /**
   * List all registered units.
   * @returns {HRVUnit[]}
   */
  listUnits() {
    return Array.from(this.units.values());
  }

  // ──────────────────────────────────────────────
  // 2. Heat Recovery Efficiency Monitoring
  // ──────────────────────────────────────────────

  /**
   * Update temperature readings for a unit and recalculate efficiency.
   * @param {string} unitId
   * @param {Object} temps
   * @param {number} temps.supplyTemp - Supply air temperature (°C)
   * @param {number} temps.extractTemp - Extract air temperature (°C)
   * @param {number} temps.outdoorTemp - Outdoor air temperature (°C)
   * @param {number} temps.exhaustTemp - Exhaust air temperature (°C)
   * @returns {number} Updated recovery efficiency (0-100)
   */
  updateTemperatures(unitId, { supplyTemp, extractTemp, outdoorTemp, exhaustTemp }) {
    const unit = this.units.get(unitId);
    if (!unit) return -1;

    unit.supplyTemp = supplyTemp;
    unit.extractTemp = extractTemp;
    unit.outdoorTemp = outdoorTemp;
    unit.exhaustTemp = exhaustTemp;
    unit.recoveryEfficiency = this._calculateRecoveryEfficiency(unit);

    this._outdoorReadings.set(unitId, outdoorTemp);
    this._persistState();
    return unit.recoveryEfficiency;
  }

  /**
   * Calculate heat recovery efficiency using temperature differential.
   * Efficiency = (supplyTemp - outdoorTemp) / (extractTemp - outdoorTemp) * 100
   * @param {HRVUnit} unit
   * @returns {number} Efficiency percentage (0-100)
   * @private
   */
  _calculateRecoveryEfficiency(unit) {
    const denominator = unit.extractTemp - unit.outdoorTemp;
    if (Math.abs(denominator) < 0.5) return 0;
    const efficiency = ((unit.supplyTemp - unit.outdoorTemp) / denominator) * 100;
    return Math.max(0, Math.min(100, Math.round(efficiency * 10) / 10));
  }

  /**
   * Get the efficiency report for all units.
   * @returns {Object[]} Array of { unitId, name, efficiency, rating }
   */
  getEfficiencyReport() {
    const report = [];
    for (const unit of this.units.values()) {
      const eff = unit.recoveryEfficiency;
      let rating = 'poor';
      if (eff >= 85) rating = 'excellent';
      else if (eff >= 70) rating = 'good';
      else if (eff >= 50) rating = 'fair';

      report.push({ unitId: unit.id, name: unit.name, efficiency: eff, rating });
    }
    return report;
  }

  // ──────────────────────────────────────────────
  // 3. Indoor/Outdoor Air Quality & Auto Adjust
  // ──────────────────────────────────────────────

  /**
   * Update indoor air quality reading for a zone.
   * @param {string} zoneId
   * @param {Object} reading
   * @param {number} reading.co2 - CO2 level (ppm)
   * @param {number} reading.humidity - Relative humidity (%)
   * @param {number} [reading.pm25] - PM2.5 (µg/m³)
   * @param {number} [reading.voc] - VOC index
   */
  updateIndoorAirQuality(zoneId, { co2, humidity, pm25 = 0, voc = 0 }) {
    const zone = this.zones.get(zoneId);
    if (!zone) return;

    zone.co2Level = co2;
    zone.humidity = humidity;

    this._evaluateVentilationNeed(zone, { pm25, voc });
    this._persistState();
  }

  /**
   * Update outdoor air quality data.
   * @param {Object} data
   * @param {number} data.co2 - Outdoor CO2 (ppm)
   * @param {number} data.pm25 - Outdoor PM2.5 (µg/m³)
   * @param {number} data.temperature - Outdoor temperature (°C)
   * @param {number} data.humidity - Outdoor humidity (%)
   */
  updateOutdoorAirQuality({ co2 = 420, pm25 = 10, temperature = 15, humidity = 50 }) {
    this._outdoorAirQuality = { co2, pm25, temperature, humidity, updatedAt: Date.now() };
    this.homey.log(`[VentHR] Outdoor AQ updated — CO2: ${co2}ppm, PM2.5: ${pm25}µg/m³, ${temperature}°C`);
  }

  /**
   * Evaluate whether ventilation should be adjusted for a zone.
   * @param {VentilationZone} zone
   * @param {Object} extras - Additional air quality metrics
   * @private
   */
  _evaluateVentilationNeed(zone, { pm25, voc }) {
    const outdoor = this._outdoorAirQuality || { co2: 420, pm25: 10 };

    // Only increase ventilation if outdoor air is better than indoor
    const outdoorBetter = outdoor.pm25 < pm25 && outdoor.co2 < zone.co2Level;

    if (zone.co2Level > CO2_THRESHOLDS.poor && outdoorBetter) {
      this._increaseZoneVentilation(zone.id, 'high_co2');
    } else if (zone.co2Level > CO2_THRESHOLDS.acceptable && outdoorBetter) {
      this._increaseZoneVentilation(zone.id, 'moderate_co2');
    } else if (zone.co2Level < CO2_THRESHOLDS.good && zone.actualFlowRate > zone.targetFlowRate) {
      this._decreaseZoneVentilation(zone.id, 'low_co2');
    }
  }

  // ──────────────────────────────────────────────
  // 4. CO2-Based Demand-Controlled Ventilation
  // ──────────────────────────────────────────────

  /**
   * Set the CO2 setpoint for demand-controlled ventilation.
   * @param {number} ppm - Target CO2 level (400-1500 ppm)
   * @returns {boolean}
   */
  setCO2Setpoint(ppm) {
    if (ppm < 400 || ppm > 1500) return false;
    this.co2Setpoint = ppm;
    this.homey.log(`[VentHR] CO2 setpoint → ${ppm} ppm`);
    this._persistState();
    return true;
  }

  /**
   * Update occupancy for a zone. Adjusts ventilation demand accordingly.
   * @param {string} zoneId
   * @param {boolean} occupied
   * @param {number} [occupantCount=1]
   */
  updateOccupancy(zoneId, occupied, occupantCount = 1) {
    const zone = this.zones.get(zoneId);
    if (!zone) return;

    zone.occupied = occupied;
    zone.occupantCount = occupied ? Math.max(1, occupantCount) : 0;

    // Adjust target flow rate based on occupancy (30 m³/h per person baseline)
    const baseFlow = 30;
    const occupancyFlow = zone.occupantCount * baseFlow;
    const minFlow = 15; // Minimum background ventilation
    zone.targetFlowRate = occupied ? Math.max(minFlow, occupancyFlow) : minFlow;

    this.homey.log(`[VentHR] Zone '${zoneId}' occupancy: ${occupied} (${zone.occupantCount}), target: ${zone.targetFlowRate} m³/h`);
    this._persistState();
  }

  /**
   * Run demand-controlled ventilation logic for all zones.
   * @private
   */
  _runDemandControlledVentilation() {
    for (const zone of this.zones.values()) {
      const co2Error = zone.co2Level - this.co2Setpoint;
      const proportionalGain = 0.05;
      let adjustment = co2Error * proportionalGain;

      // Clamp damper adjustment
      const newDamper = Math.max(10, Math.min(100, zone.damperPosition + adjustment));
      if (Math.abs(newDamper - zone.damperPosition) > 2) {
        zone.damperPosition = Math.round(newDamper);
        zone.actualFlowRate = Math.round(zone.targetFlowRate * (zone.damperPosition / 100));
        this.homey.log(`[VentHR] DCV zone '${zone.id}' damper → ${zone.damperPosition}%, flow: ${zone.actualFlowRate} m³/h`);
      }
    }
  }

  // ──────────────────────────────────────────────
  // 5. Filter Status Monitoring
  // ──────────────────────────────────────────────

  /**
   * Initialize supply and extract filters for a unit.
   * @param {string} unitId
   * @private
   */
  _initFiltersForUnit(unitId) {
    const now = Date.now();
    /** @type {FilterStatus[]} */
    const unitFilters = [
      {
        unitId, type: 'supply', installedAt: now,
        lifespanDays: DEFAULT_FILTER_LIFESPAN_DAYS,
        pressureDrop: 30, baselinePressureDrop: 30,
        efficiencyPercent: 100, replacementDue: false,
      },
      {
        unitId, type: 'extract', installedAt: now,
        lifespanDays: DEFAULT_FILTER_LIFESPAN_DAYS,
        pressureDrop: 25, baselinePressureDrop: 25,
        efficiencyPercent: 100, replacementDue: false,
      },
    ];
    this.filters.set(unitId, unitFilters);
  }

  /**
   * Update filter pressure drop reading.
   * @param {string} unitId
   * @param {string} filterType - 'supply' or 'extract'
   * @param {number} pressureDrop - Current pressure drop (Pa)
   * @returns {FilterStatus|null}
   */
  updateFilterPressure(unitId, filterType, pressureDrop) {
    const unitFilters = this.filters.get(unitId);
    if (!unitFilters) return null;

    const filter = unitFilters.find(f => f.type === filterType);
    if (!filter) return null;

    filter.pressureDrop = pressureDrop;
    const degradation = (pressureDrop - filter.baselinePressureDrop) / filter.baselinePressureDrop;
    filter.efficiencyPercent = Math.max(0, Math.round((1 - degradation * 0.5) * 100));

    // Flag replacement if pressure drop exceeds 2x baseline or age exceeds lifespan
    const ageDays = (Date.now() - filter.installedAt) / (1000 * 60 * 60 * 24);
    filter.replacementDue = pressureDrop > filter.baselinePressureDrop * 2 || ageDays > filter.lifespanDays;

    if (filter.replacementDue) {
      this.homey.log(`[VentHR] ⚠ Filter replacement due: unit '${unitId}' ${filterType} filter (efficiency: ${filter.efficiencyPercent}%)`);
    }

    this._persistState();
    return filter;
  }

  /**
   * Record a filter replacement.
   * @param {string} unitId
   * @param {string} filterType - 'supply' or 'extract'
   * @returns {boolean}
   */
  replaceFilter(unitId, filterType) {
    const unitFilters = this.filters.get(unitId);
    if (!unitFilters) return false;

    const filter = unitFilters.find(f => f.type === filterType);
    if (!filter) return false;

    filter.installedAt = Date.now();
    filter.pressureDrop = filter.baselinePressureDrop;
    filter.efficiencyPercent = 100;
    filter.replacementDue = false;

    this.homey.log(`[VentHR] Filter replaced: unit '${unitId}' ${filterType} filter`);
    this._persistState();
    return true;
  }

  /**
   * Get filter status for a unit.
   * @param {string} unitId
   * @returns {FilterStatus[]|null}
   */
  getFilterStatus(unitId) {
    return this.filters.get(unitId) || null;
  }

  /**
   * Get all filters requiring replacement.
   * @returns {FilterStatus[]}
   */
  getFiltersNeedingReplacement() {
    const result = [];
    for (const unitFilters of this.filters.values()) {
      for (const filter of unitFilters) {
        if (filter.replacementDue) result.push(filter);
      }
    }
    return result;
  }

  /**
   * Check all filters and flag those needing replacement.
   * @private
   */
  _checkFilters() {
    for (const [unitId, unitFilters] of this.filters.entries()) {
      for (const filter of unitFilters) {
        const ageDays = (Date.now() - filter.installedAt) / (1000 * 60 * 60 * 24);
        const remainingDays = Math.max(0, filter.lifespanDays - ageDays);

        if (remainingDays <= 14 && !filter.replacementDue) {
          filter.replacementDue = true;
          this.homey.log(`[VentHR] Filter nearing end of life: unit '${unitId}' ${filter.type} — ${Math.round(remainingDays)} days remaining`);
        }
      }
    }
  }

  // ──────────────────────────────────────────────
  // 6. Energy Savings Calculation
  // ──────────────────────────────────────────────

  /**
   * Calculate and accumulate energy savings from heat recovery.
   * @private
   */
  _calculateEnergySavings() {
    const intervalHours = 5 / 60; // 5-minute interval in hours
    let totalRecoveredWh = 0;

    for (const unit of this.units.values()) {
      if (unit.state === 'idle' || unit.bypassOpen) continue;

      // Q = ρ * cp * V̇ * ΔT
      // ρ ≈ 1.2 kg/m³, cp ≈ 1005 J/(kg·K)
      const airDensity = 1.2;
      const specificHeat = 1005;
      const flowRateM3s = unit.supplyFlowRate / 3600;
      const tempDiff = Math.abs(unit.supplyTemp - unit.outdoorTemp);

      // Recovered heat power in watts
      const recoveredPowerW = airDensity * specificHeat * flowRateM3s * tempDiff;
      const recoveredWh = recoveredPowerW * intervalHours;

      totalRecoveredWh += recoveredWh;
    }

    const recoveredKwh = totalRecoveredWh / 1000;
    this.energySavings.recoveredHeatKwh += recoveredKwh;
    this.energySavings.costSavings = Math.round(this.energySavings.recoveredHeatKwh * ENERGY_COST_PER_KWH * 100) / 100;
    this.energySavings.co2Avoided = Math.round(this.energySavings.recoveredHeatKwh * CO2_FACTOR_PER_KWH * 100) / 100;
    this.energySavings.periodEnd = Date.now();
  }

  /**
   * Get the current energy savings report.
   * @returns {EnergySavings}
   */
  getEnergySavings() {
    return { ...this.energySavings };
  }

  /**
   * Reset energy savings tracking for a new period.
   * @returns {EnergySavings} The final savings for the previous period
   */
  resetEnergySavings() {
    const previous = { ...this.energySavings };
    this.energySavings = {
      recoveredHeatKwh: 0,
      costSavings: 0,
      co2Avoided: 0,
      periodStart: Date.now(),
      periodEnd: Date.now(),
    };
    this.homey.log(`[VentHR] Energy savings reset — previous period: ${previous.recoveredHeatKwh.toFixed(1)} kWh recovered`);
    this._persistState();
    return previous;
  }

  // ──────────────────────────────────────────────
  // 7. Seasonal Mode Switching
  // ──────────────────────────────────────────────

  /**
   * Set the seasonal operating mode.
   * @param {SeasonalMode} mode - 'winter', 'summer', or 'auto'
   * @returns {boolean}
   */
  setSeasonalMode(mode) {
    if (!['winter', 'summer', 'auto'].includes(mode)) return false;
    this.seasonalMode = mode;
    this.homey.log(`[VentHR] Seasonal mode → ${mode}`);
    this._applySeasonalStrategy();
    this._persistState();
    return true;
  }

  /**
   * Get the current seasonal mode.
   * @returns {SeasonalMode}
   */
  getSeasonalMode() {
    return this.seasonalMode;
  }

  /**
   * Apply seasonal strategy to all units.
   * @private
   */
  _applySeasonalStrategy() {
    const mode = this._resolveSeasonalMode();

    for (const unit of this.units.values()) {
      if (mode === 'winter') {
        this._applyWinterMode(unit);
      } else {
        this._applySummerMode(unit);
      }
    }
  }

  /**
   * Resolve the effective seasonal mode (handles 'auto' detection).
   * @returns {'winter'|'summer'}
   * @private
   */
  _resolveSeasonalMode() {
    if (this.seasonalMode !== 'auto') return this.seasonalMode;

    // Auto-detect based on average outdoor temperature across units
    const outdoorTemps = Array.from(this._outdoorReadings.values());
    if (outdoorTemps.length === 0) return 'winter';

    const avgOutdoor = outdoorTemps.reduce((a, b) => a + b, 0) / outdoorTemps.length;
    return avgOutdoor < 15 ? 'winter' : 'summer';
  }

  /**
   * Apply winter mode — maximize heat recovery, close bypass.
   * @param {HRVUnit} unit
   * @private
   */
  _applyWinterMode(unit) {
    if (unit.bypassOpen) {
      unit.bypassOpen = false;
      this.homey.log(`[VentHR] Winter mode: closing bypass on unit '${unit.id}'`);
    }
  }

  /**
   * Apply summer mode — enable bypass for free cooling when outdoor is cooler.
   * @param {HRVUnit} unit
   * @private
   */
  _applySummerMode(unit) {
    const outdoorCooler = unit.outdoorTemp < unit.extractTemp - BYPASS_TEMP_DIFFERENTIAL;
    if (outdoorCooler && !unit.bypassOpen) {
      unit.bypassOpen = true;
      unit.state = 'bypass';
      this.homey.log(`[VentHR] Summer mode: opening bypass on unit '${unit.id}' for free cooling`);
    } else if (!outdoorCooler && unit.bypassOpen) {
      unit.bypassOpen = false;
      unit.state = unit.fanSpeedPercent > 0 ? 'active' : 'idle';
      this.homey.log(`[VentHR] Summer mode: closing bypass on unit '${unit.id}' — outdoor not cooler`);
    }
  }

  // ──────────────────────────────────────────────
  // 8. Humidity Management
  // ──────────────────────────────────────────────

  /**
   * Set the target humidity setpoint.
   * @param {number} percent - Target relative humidity (20-70%)
   * @returns {boolean}
   */
  setHumiditySetpoint(percent) {
    if (percent < 20 || percent > 70) return false;
    this.humiditySetpoint = percent;
    this.homey.log(`[VentHR] Humidity setpoint → ${percent}%`);
    this._persistState();
    return true;
  }

  /**
   * Evaluate condensation risk for a zone and take preventative action.
   * @param {string} zoneId
   * @returns {{ risk: string, dewPoint: number, action: string|null }}
   */
  evaluateCondensationRisk(zoneId) {
    const zone = this.zones.get(zoneId);
    if (!zone) return { risk: 'unknown', dewPoint: 0, action: null };

    // Approximate dew point using Magnus formula
    const a = 17.27;
    const b = 237.7;
    const rh = zone.humidity / 100;
    const outdoorTemp = this._outdoorAirQuality?.temperature ?? 10;
    const gamma = (a * outdoorTemp) / (b + outdoorTemp) + Math.log(rh || 0.01);
    const dewPoint = Math.round(((b * gamma) / (a - gamma)) * 10) / 10;

    let risk = 'low';
    let action = null;

    if (zone.humidity >= HUMIDITY_LIMITS.condensationRisk) {
      risk = 'high';
      action = 'increase_ventilation';
      this._increaseZoneVentilation(zoneId, 'condensation_risk');
    } else if (zone.humidity >= HUMIDITY_LIMITS.comfortHigh) {
      risk = 'moderate';
      action = 'monitor';
    } else if (zone.humidity <= HUMIDITY_LIMITS.dryAir) {
      risk = 'dry';
      action = 'reduce_ventilation';
      this._decreaseZoneVentilation(zoneId, 'dry_air');
    }

    return { risk, dewPoint, action };
  }

  /**
   * Run humidity management across all zones.
   * @private
   */
  _runHumidityManagement() {
    for (const zone of this.zones.values()) {
      if (zone.humidity > HUMIDITY_LIMITS.condensationRisk) {
        this._increaseZoneVentilation(zone.id, 'high_humidity');
      } else if (zone.humidity < HUMIDITY_LIMITS.dryAir) {
        this._decreaseZoneVentilation(zone.id, 'dry_condition');
      }
    }
  }

  // ──────────────────────────────────────────────
  // 9. Zone-Based Ventilation Balancing
  // ──────────────────────────────────────────────

  /**
   * Register a ventilation zone.
   * @param {string} id - Zone identifier
   * @param {string} name - Display name
   * @param {number} [targetFlowRate=60] - Target airflow (m³/h)
   * @returns {VentilationZone}
   */
  registerZone(id, name, targetFlowRate = 60) {
    if (this.zones.has(id)) {
      this.homey.log(`[VentHR] Zone '${id}' already registered`);
      return this.zones.get(id);
    }

    /** @type {VentilationZone} */
    const zone = {
      id,
      name,
      targetFlowRate,
      actualFlowRate: 0,
      damperPosition: 50,
      co2Level: 420,
      humidity: 45,
      occupied: false,
      occupantCount: 0,
    };

    this.zones.set(id, zone);
    this.homey.log(`[VentHR] Registered zone '${name}' (${id}), target: ${targetFlowRate} m³/h`);
    this._persistState();
    return zone;
  }

  /**
   * Remove a ventilation zone.
   * @param {string} zoneId
   * @returns {boolean}
   */
  removeZone(zoneId) {
    const removed = this.zones.delete(zoneId);
    if (removed) {
      this.homey.log(`[VentHR] Removed zone '${zoneId}'`);
      this._persistState();
    }
    return removed;
  }

  /**
   * Get status of a specific zone.
   * @param {string} zoneId
   * @returns {VentilationZone|null}
   */
  getZoneStatus(zoneId) {
    return this.zones.get(zoneId) || null;
  }

  /**
   * List all ventilation zones.
   * @returns {VentilationZone[]}
   */
  listZones() {
    return Array.from(this.zones.values());
  }

  /**
   * Balance airflow across all zones to meet their targets.
   * @private
   */
  _balanceZones() {
    const totalTarget = Array.from(this.zones.values()).reduce((sum, z) => sum + z.targetFlowRate, 0);
    if (totalTarget === 0) return;

    // Calculate total available supply from all active units
    let totalSupply = 0;
    for (const unit of this.units.values()) {
      if (unit.state !== 'idle') totalSupply += unit.supplyFlowRate;
    }

    for (const zone of this.zones.values()) {
      const proportion = zone.targetFlowRate / totalTarget;
      const allocatedFlow = totalSupply * proportion;
      const errorPercent = zone.targetFlowRate > 0
        ? ((allocatedFlow - zone.targetFlowRate) / zone.targetFlowRate) * 100
        : 0;

      // Adjust damper proportionally to error
      if (Math.abs(errorPercent) > 5) {
        const correction = errorPercent > 0 ? -2 : 2;
        zone.damperPosition = Math.max(10, Math.min(100, zone.damperPosition + correction));
        zone.actualFlowRate = Math.round(allocatedFlow * (zone.damperPosition / 100));
      }
    }
  }

  /**
   * Increase ventilation for a zone.
   * @param {string} zoneId
   * @param {string} reason
   * @private
   */
  _increaseZoneVentilation(zoneId, reason) {
    const zone = this.zones.get(zoneId);
    if (!zone) return;

    const newDamper = Math.min(100, zone.damperPosition + 10);
    if (newDamper !== zone.damperPosition) {
      zone.damperPosition = newDamper;
      zone.actualFlowRate = Math.round(zone.targetFlowRate * (zone.damperPosition / 100));
      this.homey.log(`[VentHR] Zone '${zoneId}' ventilation ↑ (${reason}), damper: ${zone.damperPosition}%`);
    }
  }

  /**
   * Decrease ventilation for a zone.
   * @param {string} zoneId
   * @param {string} reason
   * @private
   */
  _decreaseZoneVentilation(zoneId, reason) {
    const zone = this.zones.get(zoneId);
    if (!zone) return;

    const newDamper = Math.max(10, zone.damperPosition - 10);
    if (newDamper !== zone.damperPosition) {
      zone.damperPosition = newDamper;
      zone.actualFlowRate = Math.round(zone.targetFlowRate * (zone.damperPosition / 100));
      this.homey.log(`[VentHR] Zone '${zoneId}' ventilation ↓ (${reason}), damper: ${zone.damperPosition}%`);
    }
  }

  // ──────────────────────────────────────────────
  // 10. Integration Hooks
  // ──────────────────────────────────────────────

  /**
   * Get integration data for HVAC systems.
   * @returns {Object} HVAC integration payload
   */
  getHVACIntegrationData() {
    const units = this.listUnits().map(u => ({
      id: u.id,
      state: u.state,
      supplyTemp: u.supplyTemp,
      extractTemp: u.extractTemp,
      supplyFlowRate: u.supplyFlowRate,
      bypassOpen: u.bypassOpen,
      fanSpeedPercent: u.fanSpeedPercent,
    }));
    return { type: 'ventilation_heat_recovery', units, seasonalMode: this.getSeasonalMode() };
  }

  /**
   * Get integration data for air quality systems.
   * @returns {Object} Air quality integration payload
   */
  getAirQualityIntegrationData() {
    const zones = this.listZones().map(z => ({
      id: z.id,
      co2Level: z.co2Level,
      humidity: z.humidity,
      damperPosition: z.damperPosition,
      occupied: z.occupied,
    }));
    return { type: 'ventilation_air_quality', zones, co2Setpoint: this.co2Setpoint };
  }

  /**
   * Get integration data for energy management systems.
   * @returns {Object} Energy integration payload
   */
  getEnergyIntegrationData() {
    let totalPower = 0;
    for (const unit of this.units.values()) totalPower += unit.powerConsumption;

    return {
      type: 'ventilation_energy',
      totalPowerConsumption: totalPower,
      energySavings: this.getEnergySavings(),
      efficiencyReport: this.getEfficiencyReport(),
    };
  }

  /**
   * Process an external event from another home automation system.
   * @param {string} source - Source system identifier
   * @param {string} event - Event type
   * @param {Object} data - Event payload
   */
  handleExternalEvent(source, event, data) {
    this.homey.log(`[VentHR] External event from '${source}': ${event}`);

    switch (event) {
      case 'temperature_update':
        if (data.unitId) this.updateTemperatures(data.unitId, data);
        break;
      case 'occupancy_change':
        if (data.zoneId) this.updateOccupancy(data.zoneId, data.occupied, data.count);
        break;
      case 'air_quality_update':
        if (data.zoneId) this.updateIndoorAirQuality(data.zoneId, data);
        break;
      case 'outdoor_conditions':
        this.updateOutdoorAirQuality(data);
        break;
      case 'hvac_mode_change':
        if (data.mode === 'cooling') this.setSeasonalMode('summer');
        else if (data.mode === 'heating') this.setSeasonalMode('winter');
        break;
      default:
        this.homey.log(`[VentHR] Unhandled event type: ${event}`);
    }
  }

  /**
   * Get a comprehensive system summary for dashboards.
   * @returns {Object} Full system status
   */
  getSystemSummary() {
    const filtersNeeding = this.getFiltersNeedingReplacement();
    const effReport = this.getEfficiencyReport();
    const avgEfficiency = effReport.length > 0
      ? Math.round(effReport.reduce((s, r) => s + r.efficiency, 0) / effReport.length * 10) / 10
      : 0;

    let totalPower = 0;
    for (const unit of this.units.values()) totalPower += unit.powerConsumption;

    return {
      unitCount: this.units.size,
      zoneCount: this.zones.size,
      seasonalMode: this.getSeasonalMode(),
      resolvedMode: this._resolveSeasonalMode(),
      averageEfficiency: avgEfficiency,
      totalPowerConsumption: totalPower,
      co2Setpoint: this.co2Setpoint,
      humiditySetpoint: this.humiditySetpoint,
      filtersNeedingReplacement: filtersNeeding.length,
      energySavings: this.getEnergySavings(),
      units: this.listUnits(),
      zones: this.listZones(),
    };
  }

  // ──────────────────────────────────────────────
  // Background Loops
  // ──────────────────────────────────────────────

  /**
   * Start the main monitoring loop (every 5 minutes).
   * @private
   */
  _startMonitoringLoop() {
    this._monitorInterval = setInterval(() => {
      try {
        this._applySeasonalStrategy();
        this._runDemandControlledVentilation();
        this._runHumidityManagement();
        this._persistState();
      } catch (err) {
        this.homey.log(`[VentHR] Monitoring error: ${err.message}`);
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Start the filter check loop (every 24 hours).
   * @private
   */
  _startFilterCheckLoop() {
    this._filterCheckInterval = setInterval(() => {
      try {
        this._checkFilters();
        this._persistState();
      } catch (err) {
        this.homey.log(`[VentHR] Filter check error: ${err.message}`);
      }
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * Start the energy calculation loop (every 5 minutes).
   * @private
   */
  _startEnergyCalculationLoop() {
    this._energyCalcInterval = setInterval(() => {
      try {
        this._calculateEnergySavings();
        this._persistState();
      } catch (err) {
        this.homey.log(`[VentHR] Energy calc error: ${err.message}`);
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Start the defrost check loop (every 2 minutes).
   * @private
   */
  _startDefrostCheckLoop() {
    this._defrostCheckInterval = setInterval(() => {
      try {
        for (const unit of this.units.values()) {
          if (unit.outdoorTemp <= DEFROST_TRIGGER_TEMP && !unit.defrostActive && unit.state !== 'idle') {
            this.homey.log(`[VentHR] Auto-defrost triggered for unit '${unit.id}' (outdoor: ${unit.outdoorTemp}°C)`);
            this.triggerDefrost(unit.id);
          }
        }
      } catch (err) {
        this.homey.log(`[VentHR] Defrost check error: ${err.message}`);
      }
    }, 2 * 60 * 1000);
  }

  /**
   * Start the zone balancing loop (every 3 minutes).
   * @private
   */
  _startZoneBalancingLoop() {
    this._zoneBalanceInterval = setInterval(() => {
      try {
        this._balanceZones();
      } catch (err) {
        this.homey.log(`[VentHR] Zone balance error: ${err.message}`);
      }
    }, 3 * 60 * 1000);
  }

  // ──────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────

  /**
   * Estimate fan power consumption based on speed percentage.
   * @param {number} speedPercent - Fan speed (0-100)
   * @returns {number} Estimated power in watts
   * @private
   */
  _estimatePower(speedPercent) {
    // Cubic relationship: power ∝ speed³ (fan affinity law)
    const maxPower = 150; // Typical HRV max power in watts
    const fraction = speedPercent / 100;
    return Math.round(maxPower * Math.pow(fraction, 3));
  }

  /**
   * Persist the current system state to Homey settings.
   * @private
   */
  _persistState() {
    try {
      const state = {
        units: Array.from(this.units.entries()),
        filters: Array.from(this.filters.entries()),
        zones: Array.from(this.zones.entries()),
        seasonalMode: this.seasonalMode,
        energySavings: this.energySavings,
        co2Setpoint: this.co2Setpoint,
        humiditySetpoint: this.humiditySetpoint,
        outdoorAirQuality: this._outdoorAirQuality || null,
        savedAt: Date.now(),
      };
      this.homey.settings.set('ventilation_heat_recovery_state', JSON.stringify(state));
    } catch (err) {
      this.homey.log(`[VentHR] Persist error: ${err.message}`);
    }
  }

  /**
   * Restore system state from Homey settings.
   * @returns {Promise<void>}
   * @private
   */
  async _restoreState() {
    try {
      const raw = this.homey.settings.get('ventilation_heat_recovery_state');
      if (!raw) {
        this.homey.log('[VentHR] No saved state found, starting fresh');
        return;
      }

      const state = JSON.parse(raw);

      if (state.units) this.units = new Map(state.units);
      if (state.filters) this.filters = new Map(state.filters);
      if (state.zones) this.zones = new Map(state.zones);
      if (state.seasonalMode) this.seasonalMode = state.seasonalMode;
      if (state.energySavings) this.energySavings = state.energySavings;
      if (state.co2Setpoint) this.co2Setpoint = state.co2Setpoint;
      if (state.humiditySetpoint) this.humiditySetpoint = state.humiditySetpoint;
      if (state.outdoorAirQuality) this._outdoorAirQuality = state.outdoorAirQuality;

      // Rebuild outdoor readings cache from units
      for (const unit of this.units.values()) {
        this._outdoorReadings.set(unit.id, unit.outdoorTemp);
      }

      this.homey.log(`[VentHR] Restored state from ${new Date(state.savedAt).toISOString()}`);
    } catch (err) {
      this.homey.log(`[VentHR] Restore error: ${err.message} — starting fresh`);
    }
  }
}

module.exports = SmartHomeVentilationHeatRecoverySystem;
