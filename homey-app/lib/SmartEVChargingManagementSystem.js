'use strict';

/**
 * SmartEVChargingManagementSystem — Wave 14
 *
 * Comprehensive EV charging station management including multi-charger support,
 * vehicle profiles, smart scheduling, solar-aware charging, load balancing,
 * cost optimization, battery health, pre-conditioning, trip planning,
 * energy statistics, guest charging, grid services, notifications,
 * maintenance tracking, fleet management, weather impact, and emergency features.
 */
class SmartEVChargingManagementSystem {

  constructor(homey) {
    this.homey = homey;

    // ── Charging Stations (up to 4) ──
    this.chargingStations = new Map();
    this.maxStations = 4;
    this.stationTemplates = {
      garage:   { id: 'garage',   label: 'Garage Charger',   location: 'garage' },
      driveway: { id: 'driveway', label: 'Driveway Charger', location: 'driveway' },
      carport:  { id: 'carport',  label: 'Carport Charger',  location: 'carport' },
      guest:    { id: 'guest',    label: 'Guest Charger',    location: 'guest' },
    };

    this.chargerTypes = ['Level 1', 'Level 2', 'DC Fast'];
    this.maxPowerOptions = [3.7, 7.4, 11, 22]; // kW
    this.connectorTypes = ['Type 2', 'CCS', 'CHAdeMO'];
    this.stationStatuses = ['available', 'charging', 'scheduled', 'fault', 'offline'];

    // ── Vehicle Profiles (up to 6) ──
    this.vehicleProfiles = new Map();
    this.maxVehicles = 6;

    // ── Scheduling ──
    this.schedules = new Map();
    this.offPeakWindow = { start: 22, end: 6 }; // 22:00–06:00
    this.defaultDepartureTime = '07:00';
    this.defaultTargetSoC = 80;
    this.tripTargetSoC = 100;

    // ── Solar-aware charging ──
    this.solarConfig = {
      enabled: true,
      gridThresholdKw: 1.0,
      currentProductionKw: 0,
      houseConsumptionKw: 0,
      seasonalCurve: { winter: 0.4, spring: 0.75, summer: 1.0, autumn: 0.6 },
    };

    // ── Load balancing ──
    this.loadBalancing = {
      circuitBreakerLimit: 32, // Amps — configurable 25/32/63
      voltage: 230,
      phases: { L1: 0, L2: 0, L3: 0 },
      highPowerAppliances: new Map(),
      priorityMode: 'lowest_soc', // lowest_soc | earliest_departure
    };

    // ── Cost optimization ──
    this.costConfig = {
      spotPrices: [],          // Array of { hour, price }
      currency: 'EUR',
      publicChargingAvgCost: 0.55, // EUR/kWh
      petrolPricePerLitre: 1.95,
      petrolConsumptionPer100km: 7.5,
    };
    this.costTracking = {
      daily: new Map(),
      weekly: new Map(),
      monthly: new Map(),
    };

    // ── Battery Health ──
    this.batteryHealth = new Map(); // vehicleId → health data

    // ── Pre-conditioning ──
    this.preConditioningSchedules = new Map();
    this.preConditionModes = ['winter_preheat', 'summer_precool', 'defrost', 'seat_heating'];

    // ── Trip planning ──
    this.plannedTrips = new Map();

    // ── Energy statistics ──
    this.energyStats = {
      totalKwhCharged: 0,
      solarKwhCharged: 0,
      gridKwhCharged: 0,
      co2SavedKg: 0,
      totalDistanceKm: 0,
      daily: new Map(),
      weekly: new Map(),
      monthly: new Map(),
      yearly: new Map(),
    };

    // ── Guest charging ──
    this.guestSessions = new Map();
    this.guestConfig = {
      maxPowerKw: 7.4,
      maxSessionDurationMinutes: 480,
      requireAuth: true,
      authMethods: ['rfid', 'app'],
    };

    // ── Grid services ──
    this.gridServices = {
      v2hEnabled: false,
      demandResponseParticipation: false,
      frequencyRegulation: false,
      gridExportLimitKw: 0,
      v2hMinSoC: 30,
    };

    // ── Notifications ──
    this.notificationHistory = [];
    this.notificationConfig = {
      chargeComplete: true,
      targetSoCReached: true,
      unexpectedDisconnect: true,
      faultAlert: true,
      scheduledChargeStarting: true,
      chargeInterrupted: true,
      monthlyCostReport: true,
    };

    // ── Maintenance tracking ──
    this.maintenanceRecords = new Map();
    this.maintenanceIntervals = {
      inspectionMonths: 12,
      cableCheckMonths: 6,
      firmwareCheckDays: 30,
    };

    // ── Weather impact ──
    this.weatherData = {
      temperatureC: 20,
      condition: 'clear',
      forecast: [],
      rangeFactors: {
        extremeCold: 0.6,   // below -10°C
        cold: 0.75,         // -10 to 5°C
        mild: 0.9,          // 5 to 15°C
        optimal: 1.0,       // 15 to 25°C
        hot: 0.92,          // above 25°C
      },
    };

    // ── Emergency features ──
    this.emergencyState = {
      groundFaultDetected: false,
      overTemperature: false,
      overCurrent: false,
      emergencyStopActive: false,
      fireRiskLevel: 'none', // none | low | medium | high
    };
    this.emergencyThresholds = {
      maxTemperatureC: 70,
      maxCurrentA: 35,
      groundFaultThresholdMa: 30,
    };

    // ── Monitoring ──
    this.monitoringIntervalMs = 2 * 60 * 1000; // 2 minutes
    this.monitoringTimer = null;

    // ── Active charging sessions ──
    this.activeSessions = new Map();

    // ── Contactor cycle tracking ──
    this.contactorCycles = new Map();
  }

  // ════════════════════════════════════════════════════════════
  // Lifecycle
  // ════════════════════════════════════════════════════════════

  initialize() {
    this.log('Initializing SmartEVChargingManagementSystem');
    this._initializeDefaultStations();
    this._initializeMaintenanceRecords();
    this._initializeEnergyStatsBuckets();
    this._startMonitoringCycle();
    this.log('SmartEVChargingManagementSystem initialized successfully');
  }

  destroy() {
    this.log('Shutting down SmartEVChargingManagementSystem');
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }
    this.activeSessions.clear();
    this.chargingStations.clear();
    this.vehicleProfiles.clear();
    this.log('SmartEVChargingManagementSystem destroyed');
  }

  // ════════════════════════════════════════════════════════════
  // Initialization helpers
  // ════════════════════════════════════════════════════════════

  _initializeDefaultStations() {
    for (const [key, template] of Object.entries(this.stationTemplates)) {
      this.chargingStations.set(key, {
        ...template,
        type: 'Level 2',
        maxPowerKw: 11,
        connectorType: 'Type 2',
        status: 'available',
        currentPowerKw: 0,
        currentA: 0,
        phase: 'L1',
        totalKwhDelivered: 0,
        sessionCount: 0,
        cableLocked: false,
        firmwareVersion: '1.0.0',
        lastInspection: null,
        installDate: new Date().toISOString(),
        enabled: key === 'garage',
      });
    }
    this.log(`Initialized ${this.chargingStations.size} charging stations`);
  }

  _initializeMaintenanceRecords() {
    for (const [id] of this.chargingStations) {
      this.maintenanceRecords.set(id, {
        lastInspection: null,
        nextInspection: null,
        cableCondition: 'good',
        connectorWear: 0,
        firmwareVersion: '1.0.0',
        lastFirmwareCheck: null,
        groundFaultTestPassed: true,
        contactorCycleCount: 0,
        history: [],
      });
      this.contactorCycles.set(id, 0);
    }
  }

  _initializeEnergyStatsBuckets() {
    const now = new Date();
    const dayKey = this._dayKey(now);
    const weekKey = this._weekKey(now);
    const monthKey = this._monthKey(now);
    const yearKey = now.getFullYear().toString();
    if (!this.energyStats.daily.has(dayKey)) {
      this.energyStats.daily.set(dayKey, { kwh: 0, solarKwh: 0, gridKwh: 0, cost: 0 });
    }
    if (!this.energyStats.weekly.has(weekKey)) {
      this.energyStats.weekly.set(weekKey, { kwh: 0, solarKwh: 0, gridKwh: 0, cost: 0 });
    }
    if (!this.energyStats.monthly.has(monthKey)) {
      this.energyStats.monthly.set(monthKey, { kwh: 0, solarKwh: 0, gridKwh: 0, cost: 0 });
    }
    if (!this.energyStats.yearly.has(yearKey)) {
      this.energyStats.yearly.set(yearKey, { kwh: 0, solarKwh: 0, gridKwh: 0, cost: 0 });
    }
  }

  // ════════════════════════════════════════════════════════════
  // Monitoring Cycle (every 2 minutes)
  // ════════════════════════════════════════════════════════════

  _startMonitoringCycle() {
    this.monitoringTimer = setInterval(() => {
      this._runMonitoringCycle();
    }, this.monitoringIntervalMs);
    this.log('Monitoring cycle started (every 2 minutes)');
  }

  _runMonitoringCycle() {
    try {
      this._checkChargeStatus();
      this._checkSoCLevels();
      this._updateSolarProduction();
      this._checkElectricityPrices();
      this._performLoadBalancing();
      this._checkEmergencyConditions();
      this._evaluateScheduledCharges();
      this._checkMaintenanceDue();
      this._updateWeatherImpact();
    } catch (err) {
      this.error(`Monitoring cycle error: ${err.message}`);
    }
  }

  _checkChargeStatus() {
    for (const [sessionId, session] of this.activeSessions) {
      if (session.status !== 'charging') continue;

      const vehicle = this.vehicleProfiles.get(session.vehicleId);
      const station = this.chargingStations.get(session.stationId);
      if (!vehicle || !station) continue;

      const elapsedHours = (Date.now() - session.lastUpdateTime) / 3600000;
      const kwhAdded = station.currentPowerKw * elapsedHours;

      session.kwhDelivered += kwhAdded;
      session.lastUpdateTime = Date.now();

      const socIncrease = (kwhAdded / vehicle.batteryCapacityKwh) * 100;
      vehicle.currentSoC = Math.min(100, vehicle.currentSoC + socIncrease);

      station.totalKwhDelivered += kwhAdded;
      this._recordEnergy(kwhAdded, session.source || 'grid');

      if (vehicle.currentSoC >= session.targetSoC) {
        this._completeChargingSession(sessionId);
      }
    }
  }

  _checkSoCLevels() {
    for (const [id, vehicle] of this.vehicleProfiles) {
      if (vehicle.currentSoC < 20) {
        this.log(`Vehicle "${vehicle.name}" SoC critically low: ${vehicle.currentSoC.toFixed(1)}%`);
      }
    }
  }

  _updateSolarProduction() {
    const hour = new Date().getHours();
    const season = this._getCurrentSeason();
    const seasonFactor = this.solarConfig.seasonalCurve[season] || 0.75;
    const hourFactor = this._solarHourFactor(hour);
    const peakKw = 10;
    this.solarConfig.currentProductionKw = peakKw * seasonFactor * hourFactor;
  }

  _solarHourFactor(hour) {
    if (hour < 6 || hour > 20) return 0;
    if (hour < 9) return (hour - 6) / 6;
    if (hour <= 15) return 1.0;
    return (20 - hour) / 5;
  }

  _getCurrentSeason() {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'autumn';
    return 'winter';
  }

  _checkElectricityPrices() {
    const hour = new Date().getHours();
    const isOffPeak = this._isOffPeakHour(hour);
    if (isOffPeak) {
      this._tryStartScheduledOffPeakCharges();
    }
  }

  _isOffPeakHour(hour) {
    if (this.offPeakWindow.start > this.offPeakWindow.end) {
      return hour >= this.offPeakWindow.start || hour < this.offPeakWindow.end;
    }
    return hour >= this.offPeakWindow.start && hour < this.offPeakWindow.end;
  }

  _tryStartScheduledOffPeakCharges() {
    for (const [schedId, sched] of this.schedules) {
      if (sched.mode !== 'off_peak' || sched.active) continue;
      const vehicle = this.vehicleProfiles.get(sched.vehicleId);
      if (!vehicle || vehicle.currentSoC >= sched.targetSoC) continue;
      this.log(`Starting off-peak charge for "${vehicle.name}"`);
      this.startChargingSession(sched.stationId, sched.vehicleId, sched.targetSoC, 'grid');
      sched.active = true;
    }
  }

  _performLoadBalancing() {
    const totalAvailableA = this.loadBalancing.circuitBreakerLimit;
    let totalApplianceA = 0;
    for (const [, amps] of this.loadBalancing.highPowerAppliances) {
      totalApplianceA += amps;
    }
    const availableForChargingA = Math.max(0, totalAvailableA - totalApplianceA);
    const activeSorted = this._getSortedActiveChargeSessions();

    if (activeSorted.length === 0) return;

    const perChargerA = Math.floor(availableForChargingA / activeSorted.length);

    for (const session of activeSorted) {
      const station = this.chargingStations.get(session.stationId);
      if (!station) continue;
      const maxStationA = (station.maxPowerKw * 1000) / this.loadBalancing.voltage;
      const allocatedA = Math.min(perChargerA, maxStationA);
      station.currentA = allocatedA;
      station.currentPowerKw = (allocatedA * this.loadBalancing.voltage) / 1000;

      const phase = station.phase || 'L1';
      this.loadBalancing.phases[phase] = (this.loadBalancing.phases[phase] || 0) + allocatedA;
    }
  }

  _getSortedActiveChargeSessions() {
    const sessions = [];
    for (const [, session] of this.activeSessions) {
      if (session.status === 'charging') sessions.push(session);
    }
    if (this.loadBalancing.priorityMode === 'lowest_soc') {
      sessions.sort((a, b) => {
        const va = this.vehicleProfiles.get(a.vehicleId);
        const vb = this.vehicleProfiles.get(b.vehicleId);
        return (va ? va.currentSoC : 100) - (vb ? vb.currentSoC : 100);
      });
    } else {
      sessions.sort((a, b) => {
        const sa = this.schedules.get(a.vehicleId);
        const sb = this.schedules.get(b.vehicleId);
        const ta = sa ? sa.departureTime : '23:59';
        const tb = sb ? sb.departureTime : '23:59';
        return ta.localeCompare(tb);
      });
    }
    return sessions;
  }

  _checkEmergencyConditions() {
    for (const [stationId, station] of this.chargingStations) {
      if (station.status === 'offline') continue;

      if (station.currentA > this.emergencyThresholds.maxCurrentA) {
        this.emergencyState.overCurrent = true;
        this._handleEmergency(stationId, 'over_current',
          `Station "${stationId}" current ${station.currentA}A exceeds limit ${this.emergencyThresholds.maxCurrentA}A`);
      }
    }

    if (this.emergencyState.groundFaultDetected) {
      this._handleEmergency(null, 'ground_fault', 'Ground fault detected — all charging stopped');
    }

    if (this.emergencyState.overTemperature) {
      this._handleEmergency(null, 'over_temperature', 'Over-temperature condition detected');
    }
  }

  _handleEmergency(stationId, type, message) {
    this.error(`EMERGENCY [${type}]: ${message}`);
    this._sendNotification('faultAlert', message);

    if (stationId) {
      this._emergencyStopStation(stationId);
    } else {
      for (const [id] of this.chargingStations) {
        this._emergencyStopStation(id);
      }
    }
  }

  _emergencyStopStation(stationId) {
    const station = this.chargingStations.get(stationId);
    if (!station) return;
    station.status = 'fault';
    station.currentPowerKw = 0;
    station.currentA = 0;
    this.log(`Emergency stop activated for station "${stationId}"`);

    for (const [sessionId, session] of this.activeSessions) {
      if (session.stationId === stationId && session.status === 'charging') {
        session.status = 'interrupted';
        session.endTime = Date.now();
        this._sendNotification('chargeInterrupted',
          `Charging interrupted on station "${stationId}" due to emergency`);
      }
    }
  }

  _evaluateScheduledCharges() {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    for (const [schedId, sched] of this.schedules) {
      if (sched.active) continue;
      if (!sched.enabled) continue;

      const isWeekday = now.getDay() >= 1 && now.getDay() <= 5;
      if (sched.daysType === 'weekday' && !isWeekday) continue;
      if (sched.daysType === 'weekend' && isWeekday) continue;

      const vehicle = this.vehicleProfiles.get(sched.vehicleId);
      if (!vehicle) continue;
      if (vehicle.currentSoC >= sched.targetSoC) continue;

      const depParts = (sched.departureTime || this.defaultDepartureTime).split(':');
      const depMinutes = parseInt(depParts[0]) * 60 + parseInt(depParts[1]);

      const kwhNeeded = ((sched.targetSoC - vehicle.currentSoC) / 100) * vehicle.batteryCapacityKwh;
      const station = this.chargingStations.get(sched.stationId);
      if (!station || station.status !== 'available') continue;

      const chargePowerKw = Math.min(vehicle.maxChargeRateKw || station.maxPowerKw, station.maxPowerKw);
      const hoursNeeded = kwhNeeded / chargePowerKw;
      const minutesNeeded = Math.ceil(hoursNeeded * 60);

      let startMinutes = depMinutes - minutesNeeded;
      if (startMinutes < 0) startMinutes += 1440;

      if (Math.abs(currentMinutes - startMinutes) <= 2) {
        this.log(`Auto-starting scheduled charge for "${vehicle.name}" — departure at ${sched.departureTime}`);
        this.startChargingSession(sched.stationId, sched.vehicleId, sched.targetSoC, 'grid');
        sched.active = true;
        this._sendNotification('scheduledChargeStarting',
          `Scheduled charge starting for "${vehicle.name}" on station "${sched.stationId}"`);
      }
    }
  }

  _checkMaintenanceDue() {
    const now = Date.now();
    for (const [stationId, record] of this.maintenanceRecords) {
      if (record.nextInspection && now >= new Date(record.nextInspection).getTime()) {
        this.log(`Maintenance due for station "${stationId}"`);
        this._sendNotification('faultAlert', `Maintenance inspection due for charger "${stationId}"`);
      }

      if (record.lastFirmwareCheck) {
        const daysSinceCheck = (now - new Date(record.lastFirmwareCheck).getTime()) / 86400000;
        if (daysSinceCheck >= this.maintenanceIntervals.firmwareCheckDays) {
          this.log(`Firmware check recommended for station "${stationId}"`);
        }
      }
    }
  }

  _updateWeatherImpact() {
    const temp = this.weatherData.temperatureC;
    for (const [id, vehicle] of this.vehicleProfiles) {
      const factor = this._temperatureRangeFactor(temp);
      vehicle.adjustedRangePerKwh = (vehicle.estimatedRangePerKwh || 6) * factor;
    }
  }

  _temperatureRangeFactor(tempC) {
    if (tempC < -10) return this.weatherData.rangeFactors.extremeCold;
    if (tempC < 5) return this.weatherData.rangeFactors.cold;
    if (tempC < 15) return this.weatherData.rangeFactors.mild;
    if (tempC <= 25) return this.weatherData.rangeFactors.optimal;
    return this.weatherData.rangeFactors.hot;
  }

  // ════════════════════════════════════════════════════════════
  // Charging Station Management
  // ════════════════════════════════════════════════════════════

  configureStation(stationId, config) {
    const station = this.chargingStations.get(stationId);
    if (!station) {
      this.error(`Station "${stationId}" not found`);
      return null;
    }

    if (config.type && this.chargerTypes.includes(config.type)) {
      station.type = config.type;
    }
    if (config.maxPowerKw && this.maxPowerOptions.includes(config.maxPowerKw)) {
      station.maxPowerKw = config.maxPowerKw;
    }
    if (config.connectorType && this.connectorTypes.includes(config.connectorType)) {
      station.connectorType = config.connectorType;
    }
    if (typeof config.enabled === 'boolean') {
      station.enabled = config.enabled;
    }
    if (config.phase && ['L1', 'L2', 'L3'].includes(config.phase)) {
      station.phase = config.phase;
    }

    this.log(`Station "${stationId}" configured: type=${station.type}, power=${station.maxPowerKw}kW, connector=${station.connectorType}`);
    return station;
  }

  getStationStatus(stationId) {
    const station = this.chargingStations.get(stationId);
    if (!station) return null;
    return {
      ...station,
      activeSession: this._getSessionForStation(stationId),
      maintenance: this.maintenanceRecords.get(stationId) || null,
    };
  }

  getAllStations() {
    const result = [];
    for (const [id, station] of this.chargingStations) {
      result.push({ id, ...station });
    }
    return result;
  }

  _getSessionForStation(stationId) {
    for (const [sessionId, session] of this.activeSessions) {
      if (session.stationId === stationId && session.status === 'charging') {
        return { sessionId, ...session };
      }
    }
    return null;
  }

  // ════════════════════════════════════════════════════════════
  // Vehicle Profile Management
  // ════════════════════════════════════════════════════════════

  addVehicle(vehicleConfig) {
    if (this.vehicleProfiles.size >= this.maxVehicles) {
      this.error(`Maximum vehicle limit (${this.maxVehicles}) reached`);
      return null;
    }

    const id = vehicleConfig.id || `vehicle_${Date.now()}`;
    const vehicle = {
      id,
      name: vehicleConfig.name || 'Unknown EV',
      make: vehicleConfig.make || '',
      model: vehicleConfig.model || '',
      batteryCapacityKwh: vehicleConfig.batteryCapacityKwh || 60,
      currentSoC: vehicleConfig.currentSoC || 50,
      maxChargeRateKw: vehicleConfig.maxChargeRateKw || 11,
      preferredChargeLevel: vehicleConfig.preferredChargeLevel || 80,
      tripChargeLevel: vehicleConfig.tripChargeLevel || 100,
      estimatedRangePerKwh: vehicleConfig.estimatedRangePerKwh || 6,
      adjustedRangePerKwh: vehicleConfig.estimatedRangePerKwh || 6,
      licensePlate: vehicleConfig.licensePlate || '',
      totalChargeCycles: 0,
      totalKwhCharged: 0,
      degradationEstimate: 0,
      addedDate: new Date().toISOString(),
    };

    this.vehicleProfiles.set(id, vehicle);
    this._initializeBatteryHealth(id, vehicle);
    this.log(`Vehicle added: "${vehicle.name}" (${vehicle.make} ${vehicle.model}) — ${vehicle.batteryCapacityKwh} kWh`);
    return vehicle;
  }

  updateVehicle(vehicleId, updates) {
    const vehicle = this.vehicleProfiles.get(vehicleId);
    if (!vehicle) {
      this.error(`Vehicle "${vehicleId}" not found`);
      return null;
    }

    const allowedFields = [
      'name', 'make', 'model', 'batteryCapacityKwh', 'currentSoC',
      'maxChargeRateKw', 'preferredChargeLevel', 'tripChargeLevel',
      'estimatedRangePerKwh', 'licensePlate',
    ];
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        vehicle[field] = updates[field];
      }
    }

    this.log(`Vehicle "${vehicleId}" updated`);
    return vehicle;
  }

  removeVehicle(vehicleId) {
    if (!this.vehicleProfiles.has(vehicleId)) return false;
    this.vehicleProfiles.delete(vehicleId);
    this.batteryHealth.delete(vehicleId);
    this.log(`Vehicle "${vehicleId}" removed`);
    return true;
  }

  getVehicle(vehicleId) {
    return this.vehicleProfiles.get(vehicleId) || null;
  }

  getAllVehicles() {
    const result = [];
    for (const [id, vehicle] of this.vehicleProfiles) {
      result.push({ id, ...vehicle });
    }
    return result;
  }

  // ════════════════════════════════════════════════════════════
  // Battery Health
  // ════════════════════════════════════════════════════════════

  _initializeBatteryHealth(vehicleId, vehicle) {
    this.batteryHealth.set(vehicleId, {
      chargeCycles: 0,
      averageChargeRateKw: 0,
      timeAt100Pct: 0,          // minutes spent at 100%
      maxTempRecordedC: 0,
      degradationPct: 0,
      healthScore: 100,
      history: [],
    });
  }

  _updateBatteryHealth(vehicleId, kwhCharged, chargeRateKw, durationMin) {
    const health = this.batteryHealth.get(vehicleId);
    const vehicle = this.vehicleProfiles.get(vehicleId);
    if (!health || !vehicle) return;

    const cycleFraction = kwhCharged / vehicle.batteryCapacityKwh;
    health.chargeCycles += cycleFraction;
    vehicle.totalChargeCycles += cycleFraction;

    const rateCount = health.history.length || 1;
    health.averageChargeRateKw =
      (health.averageChargeRateKw * (rateCount - 1) + chargeRateKw) / rateCount;

    // Estimate degradation: faster charging = slightly more degradation
    const rateFactor = chargeRateKw > 50 ? 1.5 : chargeRateKw > 22 ? 1.2 : 1.0;
    const cycleDegradation = cycleFraction * 0.02 * rateFactor;
    health.degradationPct += cycleDegradation;
    vehicle.degradationEstimate = health.degradationPct;

    health.healthScore = Math.max(0, 100 - health.degradationPct);

    health.history.push({
      timestamp: new Date().toISOString(),
      kwhCharged,
      chargeRateKw,
      durationMin,
      socAfter: vehicle.currentSoC,
    });

    if (health.history.length > 500) {
      health.history = health.history.slice(-500);
    }
  }

  getBatteryHealth(vehicleId) {
    return this.batteryHealth.get(vehicleId) || null;
  }

  // ════════════════════════════════════════════════════════════
  // Charging Sessions
  // ════════════════════════════════════════════════════════════

  startChargingSession(stationId, vehicleId, targetSoC, source) {
    const station = this.chargingStations.get(stationId);
    const vehicle = this.vehicleProfiles.get(vehicleId);
    if (!station) { this.error(`Station "${stationId}" not found`); return null; }
    if (!vehicle) { this.error(`Vehicle "${vehicleId}" not found`); return null; }
    if (station.status === 'charging') { this.error(`Station "${stationId}" already in use`); return null; }
    if (station.status === 'fault' || station.status === 'offline') {
      this.error(`Station "${stationId}" is ${station.status}`);
      return null;
    }
    if (this.emergencyState.emergencyStopActive) {
      this.error('Emergency stop is active — cannot start charging');
      return null;
    }

    const sessionId = `session_${Date.now()}_${stationId}`;
    const effectiveTarget = targetSoC || vehicle.preferredChargeLevel || this.defaultTargetSoC;

    if (vehicle.currentSoC >= effectiveTarget) {
      this.log(`Vehicle "${vehicle.name}" already at ${vehicle.currentSoC.toFixed(1)}%, target ${effectiveTarget}%`);
      return null;
    }

    const chargePowerKw = Math.min(vehicle.maxChargeRateKw, station.maxPowerKw);
    const kwhNeeded = ((effectiveTarget - vehicle.currentSoC) / 100) * vehicle.batteryCapacityKwh;
    const estimatedHours = kwhNeeded / chargePowerKw;

    const session = {
      sessionId,
      stationId,
      vehicleId,
      targetSoC: effectiveTarget,
      startSoC: vehicle.currentSoC,
      currentSoC: vehicle.currentSoC,
      kwhDelivered: 0,
      chargePowerKw,
      estimatedDurationHours: estimatedHours,
      startTime: Date.now(),
      lastUpdateTime: Date.now(),
      endTime: null,
      status: 'charging',
      source: source || 'grid',
      cost: 0,
      isGuestSession: false,
    };

    this.activeSessions.set(sessionId, session);
    station.status = 'charging';
    station.currentPowerKw = chargePowerKw;
    station.currentA = (chargePowerKw * 1000) / this.loadBalancing.voltage;
    station.cableLocked = true;
    station.sessionCount += 1;

    this._incrementContactorCycle(stationId);

    this.log(`Charging started: "${vehicle.name}" on "${stationId}" — target ${effectiveTarget}%, est. ${estimatedHours.toFixed(1)}h, ${chargePowerKw}kW`);
    return session;
  }

  stopChargingSession(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) { this.error(`Session "${sessionId}" not found`); return null; }

    return this._completeChargingSession(sessionId, 'stopped');
  }

  _completeChargingSession(sessionId, reason) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return null;

    session.status = reason || 'completed';
    session.endTime = Date.now();

    const vehicle = this.vehicleProfiles.get(session.vehicleId);
    const station = this.chargingStations.get(session.stationId);

    if (station) {
      station.status = 'available';
      station.currentPowerKw = 0;
      station.currentA = 0;
      station.cableLocked = false;
    }

    if (vehicle) {
      vehicle.totalKwhCharged += session.kwhDelivered;
      const durationMin = (session.endTime - session.startTime) / 60000;
      this._updateBatteryHealth(session.vehicleId, session.kwhDelivered, session.chargePowerKw, durationMin);
    }

    session.cost = this._calculateSessionCost(session);

    const notifType = reason === 'stopped' ? 'chargeInterrupted' : 'chargeComplete';
    const notifMsg = reason === 'stopped'
      ? `Charging stopped for "${vehicle ? vehicle.name : session.vehicleId}" — ${session.kwhDelivered.toFixed(1)} kWh delivered`
      : `Charging complete for "${vehicle ? vehicle.name : session.vehicleId}" — ${session.kwhDelivered.toFixed(1)} kWh, SoC ${vehicle ? vehicle.currentSoC.toFixed(1) : '?'}%`;
    this._sendNotification(notifType, notifMsg);

    this.log(notifMsg);
    return session;
  }

  _calculateSessionCost(session) {
    const currentPrice = this._getCurrentSpotPrice();
    return session.kwhDelivered * currentPrice;
  }

  _getCurrentSpotPrice() {
    const hour = new Date().getHours();
    const spot = this.costConfig.spotPrices.find(p => p.hour === hour);
    if (spot) return spot.price;
    return this._isOffPeakHour(hour) ? 0.08 : 0.25;
  }

  // ════════════════════════════════════════════════════════════
  // Solar-aware charging
  // ════════════════════════════════════════════════════════════

  evaluateSolarCharging() {
    if (!this.solarConfig.enabled) return null;

    const excess = this.solarConfig.currentProductionKw
      - this.solarConfig.houseConsumptionKw
      - this.solarConfig.gridThresholdKw;

    const result = {
      solarProductionKw: this.solarConfig.currentProductionKw,
      houseConsumptionKw: this.solarConfig.houseConsumptionKw,
      excessKw: Math.max(0, excess),
      canCharge: excess > 0,
      recommendedPowerKw: Math.max(0, excess),
    };

    if (result.canCharge) {
      this._applySolarCharging(result.recommendedPowerKw);
    }

    return result;
  }

  _applySolarCharging(availablePowerKw) {
    for (const [sessionId, session] of this.activeSessions) {
      if (session.status !== 'charging') continue;
      if (session.source !== 'solar') continue;

      const station = this.chargingStations.get(session.stationId);
      if (!station) continue;

      const solarPower = Math.min(availablePowerKw, station.maxPowerKw);
      station.currentPowerKw = solarPower;
      station.currentA = (solarPower * 1000) / this.loadBalancing.voltage;
      availablePowerKw -= solarPower;

      if (availablePowerKw <= 0) break;
    }
  }

  updateSolarData(productionKw, consumptionKw) {
    this.solarConfig.currentProductionKw = productionKw;
    this.solarConfig.houseConsumptionKw = consumptionKw;
  }

  // ════════════════════════════════════════════════════════════
  // Scheduling
  // ════════════════════════════════════════════════════════════

  createSchedule(config) {
    const id = config.id || `sched_${Date.now()}`;
    const schedule = {
      id,
      vehicleId: config.vehicleId,
      stationId: config.stationId || 'garage',
      departureTime: config.departureTime || this.defaultDepartureTime,
      targetSoC: config.targetSoC || this.defaultTargetSoC,
      mode: config.mode || 'departure_time', // departure_time | off_peak | solar_only | immediate
      daysType: config.daysType || 'all',     // all | weekday | weekend
      enabled: config.enabled !== false,
      active: false,
      createdAt: new Date().toISOString(),
    };

    this.schedules.set(id, schedule);
    this.log(`Schedule created: id=${id}, vehicle=${config.vehicleId}, departure=${schedule.departureTime}, target=${schedule.targetSoC}%`);
    return schedule;
  }

  updateSchedule(scheduleId, updates) {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) { this.error(`Schedule "${scheduleId}" not found`); return null; }

    const allowed = ['departureTime', 'targetSoC', 'mode', 'daysType', 'enabled', 'stationId'];
    for (const key of allowed) {
      if (updates[key] !== undefined) schedule[key] = updates[key];
    }
    this.log(`Schedule "${scheduleId}" updated`);
    return schedule;
  }

  deleteSchedule(scheduleId) {
    return this.schedules.delete(scheduleId);
  }

  getSchedules(vehicleId) {
    const result = [];
    for (const [id, sched] of this.schedules) {
      if (!vehicleId || sched.vehicleId === vehicleId) {
        result.push({ id, ...sched });
      }
    }
    return result;
  }

  // ════════════════════════════════════════════════════════════
  // Load Balancing Configuration
  // ════════════════════════════════════════════════════════════

  setCircuitBreakerLimit(amps) {
    const valid = [25, 32, 63];
    if (!valid.includes(amps)) {
      this.error(`Invalid breaker limit: ${amps}A. Valid: ${valid.join(', ')}`);
      return false;
    }
    this.loadBalancing.circuitBreakerLimit = amps;
    this.log(`Circuit breaker limit set to ${amps}A`);
    return true;
  }

  registerHighPowerAppliance(name, amps) {
    this.loadBalancing.highPowerAppliances.set(name, amps);
    this.log(`High-power appliance registered: "${name}" at ${amps}A`);
    this._performLoadBalancing();
  }

  unregisterHighPowerAppliance(name) {
    this.loadBalancing.highPowerAppliances.delete(name);
    this.log(`High-power appliance unregistered: "${name}"`);
    this._performLoadBalancing();
  }

  getLoadStatus() {
    let totalChargingA = 0;
    for (const [, station] of this.chargingStations) {
      if (station.status === 'charging') totalChargingA += station.currentA;
    }
    let totalApplianceA = 0;
    for (const [, a] of this.loadBalancing.highPowerAppliances) {
      totalApplianceA += a;
    }
    return {
      circuitBreakerLimitA: this.loadBalancing.circuitBreakerLimit,
      totalChargingA,
      totalApplianceA,
      totalLoadA: totalChargingA + totalApplianceA,
      availableA: Math.max(0, this.loadBalancing.circuitBreakerLimit - totalChargingA - totalApplianceA),
      phases: { ...this.loadBalancing.phases },
      priorityMode: this.loadBalancing.priorityMode,
    };
  }

  setPriorityMode(mode) {
    if (!['lowest_soc', 'earliest_departure'].includes(mode)) {
      this.error(`Invalid priority mode: ${mode}`);
      return false;
    }
    this.loadBalancing.priorityMode = mode;
    this.log(`Priority mode set to "${mode}"`);
    return true;
  }

  // ════════════════════════════════════════════════════════════
  // Cost Optimization
  // ════════════════════════════════════════════════════════════

  setSpotPrices(prices) {
    this.costConfig.spotPrices = prices; // [{ hour: 0, price: 0.05 }, ...]
    this.log(`Spot prices updated: ${prices.length} hourly entries`);
  }

  getCheapestHours(count) {
    const sorted = [...this.costConfig.spotPrices].sort((a, b) => a.price - b.price);
    return sorted.slice(0, count || 4);
  }

  getDailyCost(dateStr) {
    const key = dateStr || this._dayKey(new Date());
    return this.costTracking.daily.get(key) || { totalCost: 0, kwhCharged: 0, sessions: 0 };
  }

  getWeeklyCost(weekStr) {
    const key = weekStr || this._weekKey(new Date());
    return this.costTracking.weekly.get(key) || { totalCost: 0, kwhCharged: 0 };
  }

  getMonthlyCost(monthStr) {
    const key = monthStr || this._monthKey(new Date());
    return this.costTracking.monthly.get(key) || { totalCost: 0, kwhCharged: 0 };
  }

  getCostComparison(kwhCharged) {
    const homeCost = kwhCharged * this._getCurrentSpotPrice();
    const publicCost = kwhCharged * this.costConfig.publicChargingAvgCost;
    const equivalentKm = kwhCharged * 6;
    const petrolLitres = (equivalentKm / 100) * this.costConfig.petrolConsumptionPer100km;
    const petrolCost = petrolLitres * this.costConfig.petrolPricePerLitre;

    return {
      homeChargingCost: Math.round(homeCost * 100) / 100,
      publicChargingCost: Math.round(publicCost * 100) / 100,
      petrolEquivalentCost: Math.round(petrolCost * 100) / 100,
      savingsVsPublic: Math.round((publicCost - homeCost) * 100) / 100,
      savingsVsPetrol: Math.round((petrolCost - homeCost) * 100) / 100,
      currency: this.costConfig.currency,
    };
  }

  _recordCost(cost, kwh) {
    const now = new Date();
    const dayKey = this._dayKey(now);
    const weekKey = this._weekKey(now);
    const monthKey = this._monthKey(now);

    const ensureBucket = (map, key) => {
      if (!map.has(key)) map.set(key, { totalCost: 0, kwhCharged: 0, sessions: 0 });
      return map.get(key);
    };

    const daily = ensureBucket(this.costTracking.daily, dayKey);
    daily.totalCost += cost;
    daily.kwhCharged += kwh;
    daily.sessions = (daily.sessions || 0) + 1;

    const weekly = ensureBucket(this.costTracking.weekly, weekKey);
    weekly.totalCost += cost;
    weekly.kwhCharged += kwh;

    const monthly = ensureBucket(this.costTracking.monthly, monthKey);
    monthly.totalCost += cost;
    monthly.kwhCharged += kwh;
  }

  // ════════════════════════════════════════════════════════════
  // Pre-conditioning
  // ════════════════════════════════════════════════════════════

  schedulePreConditioning(vehicleId, config) {
    const vehicle = this.vehicleProfiles.get(vehicleId);
    if (!vehicle) { this.error(`Vehicle "${vehicleId}" not found`); return null; }

    const id = `precond_${Date.now()}`;
    const schedule = {
      id,
      vehicleId,
      mode: config.mode || 'winter_preheat',
      targetTempC: config.targetTempC || 21,
      departureTime: config.departureTime || this.defaultDepartureTime,
      preCondMinutes: config.preCondMinutes || 15,
      seatHeating: config.seatHeating || false,
      defrost: config.defrost || false,
      enabled: config.enabled !== false,
      daysType: config.daysType || 'weekday',
      powerSource: 'grid',
    };

    this.preConditioningSchedules.set(id, schedule);
    this.log(`Pre-conditioning scheduled for "${vehicle.name}": mode=${schedule.mode}, departure=${schedule.departureTime}`);
    return schedule;
  }

  getPreConditioningSchedules(vehicleId) {
    const result = [];
    for (const [id, sched] of this.preConditioningSchedules) {
      if (!vehicleId || sched.vehicleId === vehicleId) {
        result.push({ id, ...sched });
      }
    }
    return result;
  }

  evaluatePreConditioningRecommendation(vehicleId) {
    const temp = this.weatherData.temperatureC;
    const recommendations = [];

    if (temp < 5) {
      recommendations.push({
        mode: 'winter_preheat',
        reason: `Temperature is ${temp}°C — cabin pre-heating recommended`,
        targetTempC: 21,
        preCondMinutes: temp < -5 ? 25 : 15,
      });
    }
    if (temp < 0) {
      recommendations.push({
        mode: 'defrost',
        reason: `Temperature is ${temp}°C — windshield defrost recommended`,
        preCondMinutes: 10,
      });
    }
    if (temp > 30) {
      recommendations.push({
        mode: 'summer_precool',
        reason: `Temperature is ${temp}°C — cabin pre-cooling recommended`,
        targetTempC: 22,
        preCondMinutes: 10,
      });
    }
    if (temp < 3) {
      recommendations.push({
        mode: 'seat_heating',
        reason: `Temperature is ${temp}°C — seat heating recommended`,
        preCondMinutes: 10,
      });
    }

    return recommendations;
  }

  // ════════════════════════════════════════════════════════════
  // Trip Planning
  // ════════════════════════════════════════════════════════════

  planTrip(vehicleId, tripConfig) {
    const vehicle = this.vehicleProfiles.get(vehicleId);
    if (!vehicle) { this.error(`Vehicle "${vehicleId}" not found`); return null; }

    const distanceKm = tripConfig.distanceKm || 0;
    const rangePerKwh = vehicle.adjustedRangePerKwh || vehicle.estimatedRangePerKwh || 6;
    const kwhRequired = distanceKm / rangePerKwh;
    const socRequired = (kwhRequired / vehicle.batteryCapacityKwh) * 100;
    const bufferPct = tripConfig.bufferPct || 15;
    const targetSoC = Math.min(100, Math.ceil(socRequired + bufferPct));
    const currentRange = vehicle.currentSoC / 100 * vehicle.batteryCapacityKwh * rangePerKwh;

    const needsCharging = vehicle.currentSoC < targetSoC;
    const additionalKwh = needsCharging
      ? ((targetSoC - vehicle.currentSoC) / 100) * vehicle.batteryCapacityKwh
      : 0;

    const enRouteStops = [];
    if (targetSoC > 100) {
      const maxRange = vehicle.batteryCapacityKwh * rangePerKwh;
      const stopsNeeded = Math.ceil(distanceKm / (maxRange * 0.7)) - 1;
      for (let i = 0; i < stopsNeeded; i++) {
        enRouteStops.push({
          stopNumber: i + 1,
          approximateKm: Math.round((maxRange * 0.7) * (i + 1)),
          chargeToSoC: 80,
          estimatedChargeTimeMin: 25,
          suggestedChargerType: 'DC Fast',
        });
      }
    }

    const plan = {
      id: `trip_${Date.now()}`,
      vehicleId,
      destination: tripConfig.destination || 'Unknown',
      distanceKm,
      kwhRequired: Math.round(kwhRequired * 10) / 10,
      socRequired: Math.round(socRequired * 10) / 10,
      targetSoC,
      bufferPct,
      currentSoC: vehicle.currentSoC,
      currentRangeKm: Math.round(currentRange),
      needsCharging,
      additionalKwh: Math.round(additionalKwh * 10) / 10,
      rangeAnxietyCheck: currentRange >= distanceKm * 1.1 ? 'safe' : 'charge_recommended',
      enRouteStops,
      weatherFactor: this._temperatureRangeFactor(this.weatherData.temperatureC),
      createdAt: new Date().toISOString(),
    };

    this.plannedTrips.set(plan.id, plan);
    this.log(`Trip planned: "${plan.destination}" ${distanceKm}km — need ${targetSoC}% SoC, currently ${vehicle.currentSoC.toFixed(1)}%`);
    return plan;
  }

  getPlannedTrips(vehicleId) {
    const result = [];
    for (const [id, trip] of this.plannedTrips) {
      if (!vehicleId || trip.vehicleId === vehicleId) {
        result.push(trip);
      }
    }
    return result;
  }

  // ════════════════════════════════════════════════════════════
  // Energy Statistics
  // ════════════════════════════════════════════════════════════

  _recordEnergy(kwh, source) {
    this.energyStats.totalKwhCharged += kwh;
    if (source === 'solar') {
      this.energyStats.solarKwhCharged += kwh;
    } else {
      this.energyStats.gridKwhCharged += kwh;
    }

    // CO2 saved vs petrol: ~0.12 kg CO2/km for petrol; EV charged from grid emits ~0.05 kg CO2/km
    const kmEnabled = kwh * 6;
    const co2Petrol = kmEnabled * 0.12;
    const co2Ev = source === 'solar' ? 0 : kmEnabled * 0.05;
    this.energyStats.co2SavedKg += co2Petrol - co2Ev;
    this.energyStats.totalDistanceKm += kmEnabled;

    const now = new Date();
    const dayKey = this._dayKey(now);
    const weekKey = this._weekKey(now);
    const monthKey = this._monthKey(now);
    const yearKey = now.getFullYear().toString();

    const ensureBucket = (map, key) => {
      if (!map.has(key)) map.set(key, { kwh: 0, solarKwh: 0, gridKwh: 0, cost: 0 });
      return map.get(key);
    };

    const price = this._getCurrentSpotPrice();
    const cost = kwh * price;

    for (const [map, key] of [
      [this.energyStats.daily, dayKey],
      [this.energyStats.weekly, weekKey],
      [this.energyStats.monthly, monthKey],
      [this.energyStats.yearly, yearKey],
    ]) {
      const bucket = ensureBucket(map, key);
      bucket.kwh += kwh;
      if (source === 'solar') bucket.solarKwh += kwh;
      else bucket.gridKwh += kwh;
      bucket.cost += cost;
    }

    this._recordCost(cost, kwh);
  }

  getEnergyStatsSummary(period, key) {
    const mapForPeriod = {
      daily: this.energyStats.daily,
      weekly: this.energyStats.weekly,
      monthly: this.energyStats.monthly,
      yearly: this.energyStats.yearly,
    };
    const map = mapForPeriod[period];
    if (!map) return null;

    if (key) {
      return map.get(key) || null;
    }

    const entries = [];
    for (const [k, v] of map) {
      entries.push({ period: k, ...v });
    }
    return entries;
  }

  getOverallEnergyStats() {
    const costPerKm = this.energyStats.totalDistanceKm > 0
      ? this.energyStats.totalKwhCharged * this._getCurrentSpotPrice() / this.energyStats.totalDistanceKm
      : 0;
    const solarRatio = this.energyStats.totalKwhCharged > 0
      ? this.energyStats.solarKwhCharged / this.energyStats.totalKwhCharged
      : 0;

    return {
      totalKwhCharged: Math.round(this.energyStats.totalKwhCharged * 10) / 10,
      solarKwhCharged: Math.round(this.energyStats.solarKwhCharged * 10) / 10,
      gridKwhCharged: Math.round(this.energyStats.gridKwhCharged * 10) / 10,
      solarRatio: Math.round(solarRatio * 1000) / 10,
      co2SavedKg: Math.round(this.energyStats.co2SavedKg * 10) / 10,
      totalDistanceKm: Math.round(this.energyStats.totalDistanceKm),
      costPerKm: Math.round(costPerKm * 1000) / 1000,
    };
  }

  // ════════════════════════════════════════════════════════════
  // Guest Charging
  // ════════════════════════════════════════════════════════════

  startGuestSession(guestConfig) {
    const stationId = guestConfig.stationId || 'guest';
    const station = this.chargingStations.get(stationId);
    if (!station) { this.error(`Station "${stationId}" not found`); return null; }
    if (station.status !== 'available') {
      this.error(`Station "${stationId}" not available for guest charging`);
      return null;
    }

    const sessionId = `guest_${Date.now()}`;
    const guestPowerKw = Math.min(this.guestConfig.maxPowerKw, station.maxPowerKw);

    const session = {
      sessionId,
      stationId,
      guestName: guestConfig.guestName || 'Guest',
      guestAuth: guestConfig.authMethod || 'app',
      authToken: guestConfig.authToken || null,
      maxPowerKw: guestPowerKw,
      maxDurationMin: this.guestConfig.maxSessionDurationMinutes,
      kwhDelivered: 0,
      startTime: Date.now(),
      endTime: null,
      status: 'charging',
      cost: 0,
    };

    station.status = 'charging';
    station.currentPowerKw = guestPowerKw;
    station.currentA = (guestPowerKw * 1000) / this.loadBalancing.voltage;
    station.cableLocked = true;

    this.guestSessions.set(sessionId, session);

    const timeoutMs = this.guestConfig.maxSessionDurationMinutes * 60 * 1000;
    setTimeout(() => {
      this._autoStopGuestSession(sessionId);
    }, timeoutMs);

    this.log(`Guest charging started: "${session.guestName}" on station "${stationId}" (max ${guestPowerKw}kW, ${this.guestConfig.maxSessionDurationMinutes}min)`);
    return session;
  }

  stopGuestSession(sessionId) {
    const session = this.guestSessions.get(sessionId);
    if (!session) { this.error(`Guest session "${sessionId}" not found`); return null; }

    session.status = 'completed';
    session.endTime = Date.now();
    const durationHours = (session.endTime - session.startTime) / 3600000;
    session.kwhDelivered = session.maxPowerKw * durationHours * 0.9; // approximate
    session.cost = session.kwhDelivered * this._getCurrentSpotPrice();

    const station = this.chargingStations.get(session.stationId);
    if (station) {
      station.status = 'available';
      station.currentPowerKw = 0;
      station.currentA = 0;
      station.cableLocked = false;
    }

    this.log(`Guest session ended: "${session.guestName}" — ${session.kwhDelivered.toFixed(1)} kWh, cost ${session.cost.toFixed(2)} ${this.costConfig.currency}`);
    return session;
  }

  _autoStopGuestSession(sessionId) {
    const session = this.guestSessions.get(sessionId);
    if (!session || session.status !== 'charging') return;
    this.log(`Auto-stopping guest session "${sessionId}" (time limit reached)`);
    this.stopGuestSession(sessionId);
  }

  getGuestSessionHistory() {
    const result = [];
    for (const [id, session] of this.guestSessions) {
      result.push({ id, ...session });
    }
    return result;
  }

  // ════════════════════════════════════════════════════════════
  // Grid Services
  // ════════════════════════════════════════════════════════════

  configureGridServices(config) {
    if (typeof config.v2hEnabled === 'boolean') this.gridServices.v2hEnabled = config.v2hEnabled;
    if (typeof config.demandResponseParticipation === 'boolean') {
      this.gridServices.demandResponseParticipation = config.demandResponseParticipation;
    }
    if (typeof config.frequencyRegulation === 'boolean') {
      this.gridServices.frequencyRegulation = config.frequencyRegulation;
    }
    if (config.gridExportLimitKw !== undefined) {
      this.gridServices.gridExportLimitKw = config.gridExportLimitKw;
    }
    if (config.v2hMinSoC !== undefined) {
      this.gridServices.v2hMinSoC = config.v2hMinSoC;
    }
    this.log(`Grid services configured: V2H=${this.gridServices.v2hEnabled}, DR=${this.gridServices.demandResponseParticipation}, FR=${this.gridServices.frequencyRegulation}`);
    return this.gridServices;
  }

  activateV2H(vehicleId, dischargeKw) {
    if (!this.gridServices.v2hEnabled) {
      this.error('Vehicle-to-Home is not enabled');
      return null;
    }

    const vehicle = this.vehicleProfiles.get(vehicleId);
    if (!vehicle) { this.error(`Vehicle "${vehicleId}" not found`); return null; }

    if (vehicle.currentSoC <= this.gridServices.v2hMinSoC) {
      this.error(`Vehicle SoC (${vehicle.currentSoC.toFixed(1)}%) is at or below V2H minimum (${this.gridServices.v2hMinSoC}%)`);
      return null;
    }

    const maxDischargeKw = Math.min(dischargeKw || 5, vehicle.maxChargeRateKw);
    const availableKwh = ((vehicle.currentSoC - this.gridServices.v2hMinSoC) / 100) * vehicle.batteryCapacityKwh;
    const estimatedHours = availableKwh / maxDischargeKw;

    const v2hSession = {
      id: `v2h_${Date.now()}`,
      vehicleId,
      dischargeKw: maxDischargeKw,
      availableKwh: Math.round(availableKwh * 10) / 10,
      estimatedHours: Math.round(estimatedHours * 10) / 10,
      startTime: Date.now(),
      status: 'active',
    };

    this.log(`V2H activated: "${vehicle.name}" discharging at ${maxDischargeKw}kW — est. ${estimatedHours.toFixed(1)}h available`);
    return v2hSession;
  }

  evaluateDemandResponse() {
    if (!this.gridServices.demandResponseParticipation) return null;

    const hour = new Date().getHours();
    const isPeakHour = hour >= 17 && hour <= 21;

    return {
      isPeakHour,
      recommendation: isPeakHour ? 'reduce_charging' : 'charge_normally',
      v2hAvailable: this.gridServices.v2hEnabled,
      participatingVehicles: this._getV2HCapableVehicles(),
    };
  }

  _getV2HCapableVehicles() {
    const capable = [];
    for (const [id, vehicle] of this.vehicleProfiles) {
      if (vehicle.currentSoC > this.gridServices.v2hMinSoC) {
        capable.push({
          id,
          name: vehicle.name,
          currentSoC: vehicle.currentSoC,
          availableKwh: ((vehicle.currentSoC - this.gridServices.v2hMinSoC) / 100) * vehicle.batteryCapacityKwh,
        });
      }
    }
    return capable;
  }

  // ════════════════════════════════════════════════════════════
  // Notifications
  // ════════════════════════════════════════════════════════════

  _sendNotification(type, message) {
    if (!this.notificationConfig[type]) return;

    const notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type,
      message,
      timestamp: new Date().toISOString(),
      read: false,
    };

    this.notificationHistory.push(notification);

    if (this.notificationHistory.length > 200) {
      this.notificationHistory = this.notificationHistory.slice(-200);
    }

    this.log(`Notification [${type}]: ${message}`);
  }

  getNotifications(unreadOnly) {
    if (unreadOnly) {
      return this.notificationHistory.filter(n => !n.read);
    }
    return [...this.notificationHistory];
  }

  markNotificationRead(notifId) {
    const notif = this.notificationHistory.find(n => n.id === notifId);
    if (notif) notif.read = true;
  }

  markAllNotificationsRead() {
    for (const notif of this.notificationHistory) {
      notif.read = true;
    }
  }

  configureNotifications(config) {
    for (const key of Object.keys(this.notificationConfig)) {
      if (typeof config[key] === 'boolean') {
        this.notificationConfig[key] = config[key];
      }
    }
    this.log('Notification preferences updated');
    return this.notificationConfig;
  }

  generateMonthlyCostReport() {
    const monthKey = this._monthKey(new Date());
    const stats = this.energyStats.monthly.get(monthKey) || { kwh: 0, solarKwh: 0, gridKwh: 0, cost: 0 };
    const costData = this.costTracking.monthly.get(monthKey) || { totalCost: 0, kwhCharged: 0 };

    const report = {
      month: monthKey,
      totalKwh: Math.round(stats.kwh * 10) / 10,
      solarKwh: Math.round(stats.solarKwh * 10) / 10,
      gridKwh: Math.round(stats.gridKwh * 10) / 10,
      totalCost: Math.round(costData.totalCost * 100) / 100,
      solarRatio: stats.kwh > 0 ? Math.round((stats.solarKwh / stats.kwh) * 100) : 0,
      co2SavedKg: Math.round(stats.kwh * 0.07 * 10) / 10,
      comparison: this.getCostComparison(stats.kwh),
      currency: this.costConfig.currency,
    };

    this._sendNotification('monthlyCostReport',
      `Monthly EV charging report for ${monthKey}: ${report.totalKwh} kWh, ${report.totalCost} ${report.currency}`);

    return report;
  }

  // ════════════════════════════════════════════════════════════
  // Maintenance Tracking
  // ════════════════════════════════════════════════════════════

  recordInspection(stationId, inspectionData) {
    const record = this.maintenanceRecords.get(stationId);
    if (!record) { this.error(`No maintenance record for station "${stationId}"`); return null; }

    record.lastInspection = new Date().toISOString();
    const nextDate = new Date();
    nextDate.setMonth(nextDate.getMonth() + this.maintenanceIntervals.inspectionMonths);
    record.nextInspection = nextDate.toISOString();

    if (inspectionData.cableCondition) record.cableCondition = inspectionData.cableCondition;
    if (inspectionData.connectorWear !== undefined) record.connectorWear = inspectionData.connectorWear;
    if (inspectionData.groundFaultTestPassed !== undefined) {
      record.groundFaultTestPassed = inspectionData.groundFaultTestPassed;
    }

    record.history.push({
      date: record.lastInspection,
      type: 'inspection',
      notes: inspectionData.notes || '',
      ...inspectionData,
    });

    this.log(`Inspection recorded for station "${stationId}" — next due: ${record.nextInspection}`);
    return record;
  }

  updateFirmware(stationId, version) {
    const record = this.maintenanceRecords.get(stationId);
    const station = this.chargingStations.get(stationId);
    if (!record || !station) return null;

    record.firmwareVersion = version;
    record.lastFirmwareCheck = new Date().toISOString();
    station.firmwareVersion = version;

    record.history.push({
      date: new Date().toISOString(),
      type: 'firmware_update',
      version,
    });

    this.log(`Firmware updated for station "${stationId}": v${version}`);
    return record;
  }

  _incrementContactorCycle(stationId) {
    const current = this.contactorCycles.get(stationId) || 0;
    this.contactorCycles.set(stationId, current + 1);
    const record = this.maintenanceRecords.get(stationId);
    if (record) record.contactorCycleCount = current + 1;
  }

  getMaintenanceStatus(stationId) {
    if (stationId) {
      return this.maintenanceRecords.get(stationId) || null;
    }
    const all = {};
    for (const [id, record] of this.maintenanceRecords) {
      all[id] = record;
    }
    return all;
  }

  // ════════════════════════════════════════════════════════════
  // Fleet Management
  // ════════════════════════════════════════════════════════════

  getFleetOverview() {
    const vehicles = this.getAllVehicles();
    const fleet = vehicles.map(v => ({
      id: v.id,
      name: v.name,
      make: v.make,
      model: v.model,
      currentSoC: Math.round(v.currentSoC * 10) / 10,
      batteryCapacityKwh: v.batteryCapacityKwh,
      totalKwhCharged: Math.round((v.totalKwhCharged || 0) * 10) / 10,
      chargeCycles: Math.round((v.totalChargeCycles || 0) * 10) / 10,
      healthScore: this.batteryHealth.has(v.id)
        ? this.batteryHealth.get(v.id).healthScore
        : 100,
      isCharging: this._isVehicleCharging(v.id),
      estimatedRangeKm: Math.round(
        (v.currentSoC / 100) * v.batteryCapacityKwh * (v.adjustedRangePerKwh || v.estimatedRangePerKwh || 6)
      ),
    }));

    return {
      totalVehicles: fleet.length,
      chargingCount: fleet.filter(v => v.isCharging).length,
      averageSoC: fleet.length > 0
        ? Math.round(fleet.reduce((s, v) => s + v.currentSoC, 0) / fleet.length * 10) / 10
        : 0,
      totalKwhCharged: Math.round(fleet.reduce((s, v) => s + v.totalKwhCharged, 0) * 10) / 10,
      vehicles: fleet,
    };
  }

  _isVehicleCharging(vehicleId) {
    for (const [, session] of this.activeSessions) {
      if (session.vehicleId === vehicleId && session.status === 'charging') return true;
    }
    return false;
  }

  getChargePriorityQueue() {
    const vehicles = this.getAllVehicles()
      .filter(v => v.currentSoC < (v.preferredChargeLevel || 80));

    if (this.loadBalancing.priorityMode === 'lowest_soc') {
      vehicles.sort((a, b) => a.currentSoC - b.currentSoC);
    } else {
      vehicles.sort((a, b) => {
        const sa = this._getVehicleSchedule(a.id);
        const sb = this._getVehicleSchedule(b.id);
        const ta = sa ? sa.departureTime : '23:59';
        const tb = sb ? sb.departureTime : '23:59';
        return ta.localeCompare(tb);
      });
    }

    return vehicles.map((v, idx) => ({
      priority: idx + 1,
      vehicleId: v.id,
      name: v.name,
      currentSoC: v.currentSoC,
      targetSoC: v.preferredChargeLevel || 80,
      kwhNeeded: ((v.preferredChargeLevel || 80) - v.currentSoC) / 100 * v.batteryCapacityKwh,
      isCharging: this._isVehicleCharging(v.id),
    }));
  }

  _getVehicleSchedule(vehicleId) {
    for (const [, sched] of this.schedules) {
      if (sched.vehicleId === vehicleId && sched.enabled) return sched;
    }
    return null;
  }

  // ════════════════════════════════════════════════════════════
  // Weather Impact
  // ════════════════════════════════════════════════════════════

  updateWeatherData(data) {
    if (data.temperatureC !== undefined) this.weatherData.temperatureC = data.temperatureC;
    if (data.condition) this.weatherData.condition = data.condition;
    if (data.forecast) this.weatherData.forecast = data.forecast;
    this._updateWeatherImpact();
    this.log(`Weather updated: ${this.weatherData.temperatureC}°C, ${this.weatherData.condition}`);
  }

  getWeatherImpactReport() {
    const temp = this.weatherData.temperatureC;
    const factor = this._temperatureRangeFactor(temp);
    const rainImpactOnSolar = ['rain', 'heavy_rain', 'snow'].includes(this.weatherData.condition)
      ? 0.3
      : this.weatherData.condition === 'cloudy' ? 0.6 : 1.0;

    const vehicleImpacts = [];
    for (const [id, vehicle] of this.vehicleProfiles) {
      const nominalRange = vehicle.batteryCapacityKwh * (vehicle.estimatedRangePerKwh || 6);
      const adjustedRange = nominalRange * factor;
      vehicleImpacts.push({
        vehicleId: id,
        name: vehicle.name,
        nominalRangeKm: Math.round(nominalRange),
        adjustedRangeKm: Math.round(adjustedRange),
        rangeLossPct: Math.round((1 - factor) * 100),
      });
    }

    return {
      temperature: temp,
      condition: this.weatherData.condition,
      rangeFactor: factor,
      solarFactor: rainImpactOnSolar,
      preCondRecommendations: this.evaluatePreConditioningRecommendation(),
      vehicleImpacts,
    };
  }

  // ════════════════════════════════════════════════════════════
  // Emergency Features
  // ════════════════════════════════════════════════════════════

  triggerEmergencyStop() {
    this.emergencyState.emergencyStopActive = true;
    this.log('EMERGENCY STOP ACTIVATED — all charging halted');

    for (const [id] of this.chargingStations) {
      this._emergencyStopStation(id);
    }

    this._sendNotification('faultAlert', 'Emergency stop activated — all charging halted');
    return { emergencyStopActive: true, timestamp: new Date().toISOString() };
  }

  resetEmergencyStop() {
    this.emergencyState.emergencyStopActive = false;
    this.emergencyState.groundFaultDetected = false;
    this.emergencyState.overTemperature = false;
    this.emergencyState.overCurrent = false;
    this.emergencyState.fireRiskLevel = 'none';

    for (const [id, station] of this.chargingStations) {
      if (station.status === 'fault') {
        station.status = 'available';
      }
    }

    this.log('Emergency stop reset — stations returned to available');
    return { emergencyStopActive: false, timestamp: new Date().toISOString() };
  }

  reportFault(stationId, faultType, details) {
    this.log(`Fault reported on station "${stationId}": ${faultType} — ${details || ''}`);

    switch (faultType) {
      case 'ground_fault':
        this.emergencyState.groundFaultDetected = true;
        break;
      case 'over_temperature':
        this.emergencyState.overTemperature = true;
        break;
      case 'over_current':
        this.emergencyState.overCurrent = true;
        break;
      case 'fire_risk':
        this.emergencyState.fireRiskLevel = details || 'high';
        break;
      default:
        break;
    }

    this._handleEmergency(stationId, faultType, `${faultType}: ${details || 'no details'}`);

    const record = this.maintenanceRecords.get(stationId);
    if (record) {
      record.history.push({
        date: new Date().toISOString(),
        type: 'fault',
        faultType,
        details,
      });
    }
  }

  getEmergencyStatus() {
    return {
      ...this.emergencyState,
      thresholds: { ...this.emergencyThresholds },
      stationStatuses: this.getAllStations().map(s => ({
        id: s.id,
        status: s.status,
        cableLocked: s.cableLocked,
      })),
    };
  }

  getCableLockStatus(stationId) {
    const station = this.chargingStations.get(stationId);
    if (!station) return null;
    return { stationId, cableLocked: station.cableLocked, status: station.status };
  }

  setFireRiskLevel(level) {
    const valid = ['none', 'low', 'medium', 'high'];
    if (!valid.includes(level)) return false;
    this.emergencyState.fireRiskLevel = level;
    if (level === 'high') {
      this.triggerEmergencyStop();
    } else if (level === 'medium') {
      this._sendNotification('faultAlert', `Fire risk level elevated to "${level}" — monitoring closely`);
    }
    this.log(`Fire risk level set to "${level}"`);
    return true;
  }

  // ════════════════════════════════════════════════════════════
  // Comprehensive Statistics
  // ════════════════════════════════════════════════════════════

  getStatistics() {
    const fleet = this.getFleetOverview();
    const energy = this.getOverallEnergyStats();
    const load = this.getLoadStatus();
    const solar = this.evaluateSolarCharging();
    const emergency = this.getEmergencyStatus();

    const activeSessionCount = Array.from(this.activeSessions.values())
      .filter(s => s.status === 'charging').length;
    const guestActiveCount = Array.from(this.guestSessions.values())
      .filter(s => s.status === 'charging').length;
    const scheduledCount = Array.from(this.schedules.values())
      .filter(s => s.enabled).length;
    const preCondCount = Array.from(this.preConditioningSchedules.values())
      .filter(s => s.enabled).length;

    const maintenanceDueCount = this._countMaintenanceDue();
    const unreadNotifications = this.notificationHistory.filter(n => !n.read).length;

    return {
      system: 'SmartEVChargingManagementSystem',
      timestamp: new Date().toISOString(),
      stations: {
        total: this.chargingStations.size,
        enabled: Array.from(this.chargingStations.values()).filter(s => s.enabled).length,
        charging: Array.from(this.chargingStations.values()).filter(s => s.status === 'charging').length,
        available: Array.from(this.chargingStations.values()).filter(s => s.status === 'available').length,
        fault: Array.from(this.chargingStations.values()).filter(s => s.status === 'fault').length,
      },
      fleet,
      energy,
      load,
      solar,
      emergency,
      sessions: {
        active: activeSessionCount,
        guestActive: guestActiveCount,
        totalCompleted: Array.from(this.activeSessions.values()).filter(s => s.status === 'completed').length,
      },
      schedules: { enabled: scheduledCount, total: this.schedules.size },
      preConditioning: { enabled: preCondCount, total: this.preConditioningSchedules.size },
      gridServices: { ...this.gridServices },
      maintenance: { dueCount: maintenanceDueCount },
      weather: {
        temperatureC: this.weatherData.temperatureC,
        condition: this.weatherData.condition,
        rangeFactor: this._temperatureRangeFactor(this.weatherData.temperatureC),
      },
      notifications: { unread: unreadNotifications, total: this.notificationHistory.length },
      monitoring: {
        intervalMs: this.monitoringIntervalMs,
        running: this.monitoringTimer !== null,
      },
    };
  }

  _countMaintenanceDue() {
    const now = Date.now();
    let count = 0;
    for (const [, record] of this.maintenanceRecords) {
      if (record.nextInspection && now >= new Date(record.nextInspection).getTime()) {
        count++;
      }
    }
    return count;
  }

  // ════════════════════════════════════════════════════════════
  // Utility / Date helpers
  // ════════════════════════════════════════════════════════════

  _dayKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  _weekKey(d) {
    const startOfYear = new Date(d.getFullYear(), 0, 1);
    const days = Math.floor((d - startOfYear) / 86400000);
    const week = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
  }

  _monthKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  // ════════════════════════════════════════════════════════════
  // Logging
  // ════════════════════════════════════════════════════════════

  log(msg) {
    const ts = new Date().toISOString();
    const line = `[EVCharging] ${msg}`;
    if (this.homey && typeof this.homey.log === 'function') {
      this.homey.log(line);
    } else {
      console.log(`${ts} ${line}`);
    }
  }

  error(msg) {
    const ts = new Date().toISOString();
    const line = `[EVCharging] ERROR: ${msg}`;
    if (this.homey && typeof this.homey.error === 'function') {
      this.homey.error(line);
    } else {
      console.error(`${ts} ${line}`);
    }
  }
}

module.exports = SmartEVChargingManagementSystem;
