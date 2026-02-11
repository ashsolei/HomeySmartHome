'use strict';

var EventEmitter = require('events');

/**
 * HomeWaterLeakProtectionSystem
 *
 * Comprehensive water leak detection, prevention, and protection system for smart homes.
 * Manages leak sensors across all rooms, controls smart shutoff valves, monitors water flow
 * and pressure, tracks water usage analytics, and provides freeze protection.
 *
 * Features:
 * - Multi-sensor leak detection (floor pads, pipe-mount flow, moisture, humidity anomaly)
 * - Main + per-zone smart water valve control with emergency shutoff
 * - Whole-house flow monitoring with anomaly-based leak detection
 * - Water pressure tracking with burst/high-pressure alerts
 * - Multi-tier alert system with escalation chains
 * - Water usage analytics with cost tracking in SEK
 * - Freeze protection with pipe temperature monitoring
 * - Zone-based protection policies
 * - Sensor maintenance and insurance documentation
 *
 * Swedish defaults: water cost ~50 SEK/m³, Stockholm location.
 *
 * @class HomeWaterLeakProtectionSystem
 * @extends EventEmitter
 */
class HomeWaterLeakProtectionSystem extends EventEmitter {

  /**
   * Create a new HomeWaterLeakProtectionSystem instance.
   * @param {object} homey - The Homey app instance.
   */
  constructor(homey) {
    super();
    this.homey = homey;
    this.initialized = false;
    this.intervals = [];

    /** @type {Object.<string, object>} Leak sensors indexed by sensor ID */
    this.sensors = this._buildSensors();

    /** @type {Object.<string, object>} Smart water shutoff valves */
    this.valves = this._buildValves();

    /** @type {Object.<string, object>} Protection zones */
    this.zones = this._buildZones();

    /** @type {object} Flow monitoring state */
    this.flowMonitoring = {
      currentFlowRate: 0,
      dailyUsageLiters: 0,
      weeklyUsageLiters: 0,
      monthlyUsageLiters: 0,
      avgDailyUsageLiters: 420,
      continuousFlowStart: null,
      continuousFlowThresholdMinutes: 120,
      nightFlowThreshold: 2.0,
      microLeakThreshold: 0.3,
      lastFlowReading: null,
      flowHistory: [],
      fixturePatterns: {
        shower: { minFlow: 8, maxFlow: 14, typicalDuration: 8 },
        toilet: { minFlow: 5, maxFlow: 9, typicalDuration: 1.5 },
        dishwasher: { minFlow: 3, maxFlow: 6, typicalDuration: 90 },
        washingMachine: { minFlow: 6, maxFlow: 12, typicalDuration: 60 },
        faucet: { minFlow: 2, maxFlow: 8, typicalDuration: 2 },
        garden: { minFlow: 10, maxFlow: 20, typicalDuration: 30 }
      }
    };

    /** @type {object} Pressure monitoring state */
    this.pressureMonitoring = {
      currentPressure: 3.8,
      normalRange: { min: 2.5, max: 5.0 },
      highPressureThreshold: 6.0,
      lowPressureThreshold: 1.5,
      pressureDropAlertRate: 0.5,
      pressureHistory: [],
      reliefValve: { installed: true, ratingBar: 7.0, lastTestedDate: null, status: 'ok' },
      lastReading: null
    };

    /** @type {object} Alert system configuration */
    this.alertSystem = {
      levels: {
        moisture_warning: { priority: 1, label: 'Moisture Warning', color: 'yellow', autoShutoff: false, escalateAfterMinutes: 30 },
        active_leak: { priority: 2, label: 'Active Leak', color: 'orange', autoShutoff: false, escalateAfterMinutes: 5 },
        flood_emergency: { priority: 3, label: 'Flood Emergency', color: 'red', autoShutoff: true, escalateAfterMinutes: 0 }
      },
      escalationChain: [
        { step: 1, action: 'notification', target: 'app', delaySeconds: 0 },
        { step: 2, action: 'alarm', target: 'siren', delaySeconds: 30 },
        { step: 3, action: 'auto_shutoff', target: 'main_valve', delaySeconds: 60 },
        { step: 4, action: 'emergency_contact', target: 'phone', delaySeconds: 120 }
      ],
      emergencyContacts: [
        { name: 'Homeowner', phone: '+46701234567', sms: true, call: true },
        { name: 'Neighbor', phone: '+46709876543', sms: true, call: false },
        { name: 'Plumber', phone: '+46731112233', sms: true, call: true }
      ],
      activeAlerts: [],
      alertHistory: [],
      smsEnabled: true,
      callEnabled: true,
      sirenEnabled: true
    };

    /** @type {object} Water usage analytics */
    this.usageAnalytics = {
      costPerCubicMeter: 50,
      currency: 'SEK',
      dailyLog: [],
      weeklyLog: [],
      monthlyLog: [],
      yearlyLog: [],
      currentDay: { date: null, liters: 0, costSEK: 0 },
      currentWeek: { weekNumber: null, liters: 0, costSEK: 0 },
      currentMonth: { month: null, liters: 0, costSEK: 0 },
      averages: { dailyLiters: 420, weeklyLiters: 2940, monthlyLiters: 12600 },
      leakWaste: { totalLitersWasted: 0, totalCostSEK: 0, incidents: [] }
    };

    /** @type {object} Freeze protection configuration */
    this.freezeProtection = {
      enabled: true,
      warningThreshold: 5,
      alertThreshold: 2,
      criticalThreshold: 0,
      heatTapeZones: [
        { id: 'ht-attic', zone: 'attic', status: 'off', currentTemp: 12.0, lastReading: null },
        { id: 'ht-crawlspace', zone: 'crawlspace', status: 'off', currentTemp: 10.0, lastReading: null },
        { id: 'ht-garage', zone: 'garage', status: 'off', currentTemp: 8.5, lastReading: null },
        { id: 'ht-exterior-north', zone: 'exterior-north', status: 'off', currentTemp: 3.0, lastReading: null }
      ],
      keepDrippingMode: false,
      keepDrippingFaucets: ['kitchen-main', 'bathroom-main', 'laundry'],
      pipeTemperatureSensors: [],
      lastFreezeEvent: null,
      seasonalActive: false
    };

    /** @type {object} Maintenance tracking */
    this.maintenance = {
      sensorBatteryAlerts: [],
      annualTestDue: null,
      lastAnnualTest: null,
      valveExerciseSchedule: { intervalDays: 30, lastExercise: null, nextDue: null },
      insuranceDocumentation: {
        systemInstallDate: null,
        installedSensors: [],
        testHistory: [],
        incidentHistory: [],
        coverageDetails: null
      },
      replacementReminders: []
    };

    /** @type {object} System configuration */
    this.config = {
      location: 'Stockholm',
      autoShutoffEnabled: true,
      notifyFirstMode: false,
      occupancyAware: true,
      currentlyOccupied: true,
      nightModeStart: '23:00',
      nightModeEnd: '06:00',
      sensitivityProfiles: {
        bathroom: 'normal',
        kitchen: 'normal',
        basement: 'high',
        laundry: 'normal',
        utility: 'high',
        server_room: 'critical'
      }
    };

    this.homey.log('[WaterLeak] HomeWaterLeakProtectionSystem constructed');
  }

  /**
   * Build all leak sensors with default configuration.
   * @returns {Object.<string, object>} Sensor map indexed by sensor ID.
   * @private
   */
  _buildSensors() {
    var sensors = {};
    var defs = [
      // Kitchen sensors
      ['wls-kitchen-sink', 'Kitchen Sink', 'kitchen', 'floor_pad', 'Under kitchen sink cabinet'],
      ['wls-kitchen-dishwasher', 'Kitchen Dishwasher', 'kitchen', 'floor_pad', 'Behind dishwasher on floor'],
      ['wls-kitchen-fridge', 'Kitchen Fridge', 'kitchen', 'moisture', 'Behind refrigerator water line'],
      ['wls-kitchen-pipe', 'Kitchen Supply Pipe', 'kitchen', 'pipe_mount_flow', 'On kitchen cold water supply pipe'],
      // Bathroom main sensors
      ['wls-bath1-toilet', 'Main Bathroom Toilet', 'bathroom-main', 'floor_pad', 'Behind toilet base'],
      ['wls-bath1-sink', 'Main Bathroom Sink', 'bathroom-main', 'floor_pad', 'Under bathroom vanity'],
      ['wls-bath1-shower', 'Main Bathroom Shower', 'bathroom-main', 'moisture', 'Shower floor drain area'],
      ['wls-bath1-humidity', 'Main Bathroom Humidity', 'bathroom-main', 'humidity_anomaly', 'Wall-mounted near ceiling'],
      // Bathroom 2 sensors
      ['wls-bath2-toilet', 'Bathroom 2 Toilet', 'bathroom-2', 'floor_pad', 'Behind toilet base'],
      ['wls-bath2-sink', 'Bathroom 2 Sink', 'bathroom-2', 'floor_pad', 'Under vanity cabinet'],
      ['wls-bath2-humidity', 'Bathroom 2 Humidity', 'bathroom-2', 'humidity_anomaly', 'Wall-mounted near ceiling'],
      // Laundry room sensors
      ['wls-laundry-washer', 'Laundry Washer', 'laundry', 'floor_pad', 'Behind washing machine'],
      ['wls-laundry-dryer', 'Laundry Dryer', 'laundry', 'moisture', 'Under dryer condensate area'],
      ['wls-laundry-sink', 'Laundry Sink', 'laundry', 'floor_pad', 'Under laundry utility sink'],
      ['wls-laundry-pipe', 'Laundry Supply Pipe', 'laundry', 'pipe_mount_flow', 'On laundry branch supply pipe'],
      // Utility room sensors
      ['wls-util-waterheater', 'Water Heater', 'utility', 'floor_pad', 'Under water heater tank'],
      ['wls-util-softener', 'Water Softener', 'utility', 'floor_pad', 'Under water softener unit'],
      ['wls-util-hvac', 'HVAC Condensate', 'utility', 'moisture', 'Near HVAC condensate drain pan'],
      ['wls-util-pipe-main', 'Main Supply Pipe', 'utility', 'pipe_mount_flow', 'On main water supply after meter'],
      // Basement sensors
      ['wls-basement-floor1', 'Basement Floor NW', 'basement', 'floor_pad', 'Northwest corner near sump'],
      ['wls-basement-floor2', 'Basement Floor SE', 'basement', 'floor_pad', 'Southeast corner near wall'],
      ['wls-basement-humidity', 'Basement Humidity', 'basement', 'humidity_anomaly', 'Central basement ceiling mount'],
      ['wls-basement-sump', 'Basement Sump Pump', 'basement', 'moisture', 'Inside sump pump well'],
      // Attic / crawlspace sensors
      ['wls-attic-pipe', 'Attic Pipe Run', 'attic', 'pipe_mount_flow', 'On attic water pipe run'],
      ['wls-attic-humidity', 'Attic Humidity', 'attic', 'humidity_anomaly', 'Central attic area'],
      // Garage sensor
      ['wls-garage-heater', 'Garage Water Heater Backup', 'garage', 'floor_pad', 'Near garage water spigot']
    ];
    for (var i = 0; i < defs.length; i++) {
      var d = defs[i];
      sensors[d[0]] = {
        id: d[0],
        name: d[1],
        zone: d[2],
        type: d[3],
        locationDescription: d[4],
        status: 'dry',
        batteryLevel: 85 + Math.floor(Math.random() * 16),
        signalStrength: -40 - Math.floor(Math.random() * 30),
        lastChecked: null,
        lastTriggered: null,
        sensitivity: 'normal',
        enabled: true,
        installed: true,
        installDate: null,
        firmware: '2.1.0',
        triggerCount: 0,
        falsePositives: 0,
        temperatureC: 20 + Math.floor(Math.random() * 5)
      };
    }
    return sensors;
  }

  /**
   * Build smart shutoff valve definitions.
   * @returns {Object.<string, object>} Valve map indexed by valve ID.
   * @private
   */
  _buildValves() {
    return {
      'valve-main': {
        id: 'valve-main', name: 'Main Water Shutoff', zone: 'whole-house',
        state: 'open', type: 'motorized-ball', brand: 'Grohe Sense Guard',
        size: 'DN25', lastStateChange: null, lastExercise: null,
        manualOverride: false, batteryBackup: true, healthStatus: 'good',
        responseTimeMs: 3000, firmware: '3.5.2', operationCount: 0,
        installed: true, installDate: null
      },
      'valve-kitchen': {
        id: 'valve-kitchen', name: 'Kitchen Zone Valve', zone: 'kitchen',
        state: 'open', type: 'motorized-ball', brand: 'Fibaro Flood Sensor Valve',
        size: 'DN20', lastStateChange: null, lastExercise: null,
        manualOverride: false, batteryBackup: false, healthStatus: 'good',
        responseTimeMs: 2500, firmware: '2.1.0', operationCount: 0,
        installed: true, installDate: null
      },
      'valve-bathroom-main': {
        id: 'valve-bathroom-main', name: 'Main Bathroom Valve', zone: 'bathroom-main',
        state: 'open', type: 'motorized-ball', brand: 'Fibaro Flood Sensor Valve',
        size: 'DN20', lastStateChange: null, lastExercise: null,
        manualOverride: false, batteryBackup: false, healthStatus: 'good',
        responseTimeMs: 2500, firmware: '2.1.0', operationCount: 0,
        installed: true, installDate: null
      },
      'valve-bathroom-2': {
        id: 'valve-bathroom-2', name: 'Bathroom 2 Valve', zone: 'bathroom-2',
        state: 'open', type: 'motorized-ball', brand: 'Fibaro Flood Sensor Valve',
        size: 'DN20', lastStateChange: null, lastExercise: null,
        manualOverride: false, batteryBackup: false, healthStatus: 'good',
        responseTimeMs: 2500, firmware: '2.1.0', operationCount: 0,
        installed: true, installDate: null
      },
      'valve-laundry': {
        id: 'valve-laundry', name: 'Laundry Zone Valve', zone: 'laundry',
        state: 'open', type: 'motorized-ball', brand: 'Grohe Sense Guard',
        size: 'DN20', lastStateChange: null, lastExercise: null,
        manualOverride: false, batteryBackup: true, healthStatus: 'good',
        responseTimeMs: 2800, firmware: '3.5.2', operationCount: 0,
        installed: true, installDate: null
      },
      'valve-basement': {
        id: 'valve-basement', name: 'Basement Zone Valve', zone: 'basement',
        state: 'open', type: 'motorized-ball', brand: 'Grohe Sense Guard',
        size: 'DN25', lastStateChange: null, lastExercise: null,
        manualOverride: false, batteryBackup: true, healthStatus: 'good',
        responseTimeMs: 3000, firmware: '3.5.2', operationCount: 0,
        installed: true, installDate: null
      }
    };
  }

  /**
   * Build zone-based protection policies.
   * @returns {Object.<string, object>} Zone map indexed by zone ID.
   * @private
   */
  _buildZones() {
    return {
      'kitchen': {
        id: 'kitchen', name: 'Kitchen', priority: 2,
        responsePolicy: 'alert_then_shutoff', shutoffDelay: 60,
        associatedValve: 'valve-kitchen', sensors: ['wls-kitchen-sink', 'wls-kitchen-dishwasher', 'wls-kitchen-fridge', 'wls-kitchen-pipe'],
        floodRisk: 'medium', lastIncident: null, incidentCount: 0
      },
      'bathroom-main': {
        id: 'bathroom-main', name: 'Main Bathroom', priority: 3,
        responsePolicy: 'alert_only', shutoffDelay: 120,
        associatedValve: 'valve-bathroom-main', sensors: ['wls-bath1-toilet', 'wls-bath1-sink', 'wls-bath1-shower', 'wls-bath1-humidity'],
        floodRisk: 'medium', lastIncident: null, incidentCount: 0
      },
      'bathroom-2': {
        id: 'bathroom-2', name: 'Bathroom 2', priority: 3,
        responsePolicy: 'alert_only', shutoffDelay: 120,
        associatedValve: 'valve-bathroom-2', sensors: ['wls-bath2-toilet', 'wls-bath2-sink', 'wls-bath2-humidity'],
        floodRisk: 'medium', lastIncident: null, incidentCount: 0
      },
      'laundry': {
        id: 'laundry', name: 'Laundry Room', priority: 1,
        responsePolicy: 'auto_shutoff', shutoffDelay: 30,
        associatedValve: 'valve-laundry', sensors: ['wls-laundry-washer', 'wls-laundry-dryer', 'wls-laundry-sink', 'wls-laundry-pipe'],
        floodRisk: 'high', lastIncident: null, incidentCount: 0
      },
      'utility': {
        id: 'utility', name: 'Utility Room', priority: 1,
        responsePolicy: 'auto_shutoff', shutoffDelay: 15,
        associatedValve: 'valve-main', sensors: ['wls-util-waterheater', 'wls-util-softener', 'wls-util-hvac', 'wls-util-pipe-main'],
        floodRisk: 'high', lastIncident: null, incidentCount: 0
      },
      'basement': {
        id: 'basement', name: 'Basement', priority: 1,
        responsePolicy: 'auto_shutoff', shutoffDelay: 10,
        associatedValve: 'valve-basement', sensors: ['wls-basement-floor1', 'wls-basement-floor2', 'wls-basement-humidity', 'wls-basement-sump'],
        floodRisk: 'high', lastIncident: null, incidentCount: 0
      },
      'attic': {
        id: 'attic', name: 'Attic', priority: 1,
        responsePolicy: 'auto_shutoff', shutoffDelay: 5,
        associatedValve: 'valve-main', sensors: ['wls-attic-pipe', 'wls-attic-humidity'],
        floodRisk: 'critical', lastIncident: null, incidentCount: 0
      },
      'garage': {
        id: 'garage', name: 'Garage', priority: 2,
        responsePolicy: 'alert_then_shutoff', shutoffDelay: 60,
        associatedValve: 'valve-main', sensors: ['wls-garage-heater'],
        floodRisk: 'low', lastIncident: null, incidentCount: 0
      }
    };
  }

  /**
   * Initialize the water leak protection system, start monitoring intervals.
   * @returns {Promise<void>}
   */
  async initialize() {
    this.homey.log('[WaterLeak] Initializing water leak protection system...');
    var now = new Date().toISOString();
    var sensorKeys = Object.keys(this.sensors);
    for (var i = 0; i < sensorKeys.length; i++) {
      this.sensors[sensorKeys[i]].lastChecked = now;
      this.sensors[sensorKeys[i]].installDate = now;
    }
    var valveKeys = Object.keys(this.valves);
    for (var j = 0; j < valveKeys.length; j++) {
      this.valves[valveKeys[j]].lastStateChange = now;
      this.valves[valveKeys[j]].lastExercise = now;
      this.valves[valveKeys[j]].installDate = now;
    }
    for (var k = 0; k < this.freezeProtection.heatTapeZones.length; k++) {
      this.freezeProtection.heatTapeZones[k].lastReading = now;
    }
    this.maintenance.annualTestDue = this._addDays(now, 365);
    this.maintenance.lastAnnualTest = now;
    this.maintenance.valveExerciseSchedule.lastExercise = now;
    this.maintenance.valveExerciseSchedule.nextDue = this._addDays(now, 30);
    this.maintenance.insuranceDocumentation.systemInstallDate = now;
    this.maintenance.insuranceDocumentation.installedSensors = sensorKeys.slice();
    this.usageAnalytics.currentDay.date = now.slice(0, 10);
    this.pressureMonitoring.lastReading = now;
    this.flowMonitoring.lastFlowReading = now;

    // Sensor polling interval (every 30 seconds)
    this.intervals.push(setInterval(this._pollSensors.bind(this), 30000));
    // Flow monitoring interval (every 60 seconds)
    this.intervals.push(setInterval(this._monitorFlow.bind(this), 60000));
    // Pressure monitoring interval (every 5 minutes)
    this.intervals.push(setInterval(this._monitorPressure.bind(this), 300000));
    // Freeze protection check (every 10 minutes)
    this.intervals.push(setInterval(this._checkFreezeProtection.bind(this), 600000));
    // Battery check (every hour)
    this.intervals.push(setInterval(this._checkBatteries.bind(this), 3600000));
    // Usage analytics rollup (every 15 minutes)
    this.intervals.push(setInterval(this._rollupUsageAnalytics.bind(this), 900000));
    // Valve exercise check (daily)
    this.intervals.push(setInterval(this._checkValveExercise.bind(this), 86400000));
    // Maintenance reminder check (daily)
    this.intervals.push(setInterval(this._checkMaintenanceReminders.bind(this), 86400000));

    this.initialized = true;
    this.homey.log('[WaterLeak] System initialized with ' + sensorKeys.length + ' sensors and ' + valveKeys.length + ' valves');
    this.homey.emit('waterleak-initialized', { sensors: sensorKeys.length, valves: valveKeys.length, timestamp: now });
  }

  /**
   * Poll all sensors and check for status changes.
   * @private
   */
  _pollSensors() {
    var now = new Date().toISOString();
    var keys = Object.keys(this.sensors);
    for (var i = 0; i < keys.length; i++) {
      var sensor = this.sensors[keys[i]];
      if (!sensor.enabled) continue;
      sensor.lastChecked = now;
      // Simulate slight temperature variation
      sensor.temperatureC = sensor.temperatureC + (Math.random() - 0.5) * 0.3;
      // Simulate signal strength fluctuation
      sensor.signalStrength = Math.max(-90, Math.min(-30, sensor.signalStrength + Math.floor((Math.random() - 0.5) * 4)));
      // Battery drain simulation (very slow)
      if (Math.random() < 0.001) {
        sensor.batteryLevel = Math.max(0, sensor.batteryLevel - 1);
      }
    }
    this.homey.emit('waterleak-sensors-polled', { count: keys.length, timestamp: now });
  }

  /**
   * Monitor water flow rate and detect anomalies.
   * @private
   */
  _monitorFlow() {
    var now = new Date();
    var hour = now.getHours();
    var isNight = hour >= 23 || hour < 6;
    var flow = this.flowMonitoring;
    // Simulate flow reading
    var baseFlow = this.config.currentlyOccupied ? (1.0 + Math.random() * 4.0) : (Math.random() * 0.5);
    if (isNight && this.config.currentlyOccupied) baseFlow = Math.random() * 0.8;
    flow.currentFlowRate = Math.round(baseFlow * 100) / 100;
    flow.lastFlowReading = now.toISOString();
    flow.flowHistory.push({ timestamp: now.toISOString(), rate: flow.currentFlowRate });
    if (flow.flowHistory.length > 1440) flow.flowHistory.shift();

    // Add usage
    var litersThisMinute = flow.currentFlowRate;
    flow.dailyUsageLiters += litersThisMinute;
    this.usageAnalytics.currentDay.liters += litersThisMinute;
    this.usageAnalytics.currentDay.costSEK = Math.round((this.usageAnalytics.currentDay.liters / 1000) * this.usageAnalytics.costPerCubicMeter * 100) / 100;

    // Continuous flow detection (nobody home)
    if (!this.config.currentlyOccupied && flow.currentFlowRate > 0.5) {
      if (!flow.continuousFlowStart) {
        flow.continuousFlowStart = now.toISOString();
      } else {
        var startTime = new Date(flow.continuousFlowStart).getTime();
        var elapsed = (now.getTime() - startTime) / 60000;
        if (elapsed >= flow.continuousFlowThresholdMinutes) {
          this._triggerAlert('flow_anomaly_away', null, 'active_leak',
            'Continuous water flow detected for ' + Math.round(elapsed) + ' minutes while nobody is home');
        }
      }
    } else {
      flow.continuousFlowStart = null;
    }

    // Night flow anomaly
    if (isNight && flow.currentFlowRate > flow.nightFlowThreshold) {
      this._triggerAlert('flow_anomaly_night', null, 'moisture_warning',
        'Unusual water flow of ' + flow.currentFlowRate + ' L/min detected during night hours');
    }

    // Micro-leak detection
    if (flow.currentFlowRate > 0 && flow.currentFlowRate <= flow.microLeakThreshold && !this.config.currentlyOccupied) {
      this._triggerAlert('micro_leak_suspected', null, 'moisture_warning',
        'Possible micro-leak: constant trickle of ' + flow.currentFlowRate + ' L/min detected');
    }

    this.homey.emit('waterleak-flow-updated', { rate: flow.currentFlowRate, dailyTotal: Math.round(flow.dailyUsageLiters), timestamp: now.toISOString() });
  }

  /**
   * Monitor water pressure and detect anomalies.
   * @private
   */
  _monitorPressure() {
    var now = new Date().toISOString();
    var pm = this.pressureMonitoring;
    // Simulate pressure with slight variation
    var prevPressure = pm.currentPressure;
    pm.currentPressure = Math.round((pm.currentPressure + (Math.random() - 0.5) * 0.2) * 100) / 100;
    pm.currentPressure = Math.max(1.0, Math.min(8.0, pm.currentPressure));
    pm.lastReading = now;
    pm.pressureHistory.push({ timestamp: now, pressure: pm.currentPressure });
    if (pm.pressureHistory.length > 288) pm.pressureHistory.shift();

    // High pressure alert
    if (pm.currentPressure >= pm.highPressureThreshold) {
      this._triggerAlert('high_pressure', null, 'active_leak',
        'Water pressure dangerously high at ' + pm.currentPressure + ' bar (threshold: ' + pm.highPressureThreshold + ' bar). Risk of pipe/fitting damage.');
    }

    // Low pressure alert (possible burst)
    if (pm.currentPressure <= pm.lowPressureThreshold) {
      this._triggerAlert('low_pressure', null, 'active_leak',
        'Water pressure critically low at ' + pm.currentPressure + ' bar. Possible pipe burst or supply issue.');
    }

    // Rapid pressure drop
    var drop = prevPressure - pm.currentPressure;
    if (drop >= pm.pressureDropAlertRate) {
      this._triggerAlert('pressure_drop', null, 'flood_emergency',
        'Rapid pressure drop detected: ' + prevPressure + ' → ' + pm.currentPressure + ' bar. Possible pipe burst!');
    }

    this.homey.emit('waterleak-pressure-updated', { pressure: pm.currentPressure, timestamp: now });
  }

  /**
   * Check freeze protection conditions and activate heat tapes if needed.
   * @private
   */
  _checkFreezeProtection() {
    if (!this.freezeProtection.enabled) return;
    var now = new Date().toISOString();
    var fp = this.freezeProtection;
    for (var i = 0; i < fp.heatTapeZones.length; i++) {
      var zone = fp.heatTapeZones[i];
      // Simulate temperature change
      zone.currentTemp = Math.round((zone.currentTemp + (Math.random() - 0.5) * 1.0) * 10) / 10;
      zone.lastReading = now;

      if (zone.currentTemp <= fp.criticalThreshold && zone.status !== 'on') {
        zone.status = 'on';
        fp.keepDrippingMode = true;
        this._triggerAlert('freeze_critical_' + zone.id, null, 'flood_emergency',
          'CRITICAL: Pipe temperature at ' + zone.currentTemp + '°C in ' + zone.zone + '. Heat tape activated. Keep-dripping mode ON.');
        this.homey.emit('waterleak-heattape-activated', { zone: zone.zone, temp: zone.currentTemp, timestamp: now });
      } else if (zone.currentTemp <= fp.alertThreshold && zone.status !== 'on') {
        zone.status = 'on';
        this._triggerAlert('freeze_alert_' + zone.id, null, 'active_leak',
          'Freeze danger: Pipe temperature at ' + zone.currentTemp + '°C in ' + zone.zone + '. Heat tape activated.');
        this.homey.emit('waterleak-heattape-activated', { zone: zone.zone, temp: zone.currentTemp, timestamp: now });
      } else if (zone.currentTemp <= fp.warningThreshold && zone.currentTemp > fp.alertThreshold) {
        this._triggerAlert('freeze_warning_' + zone.id, null, 'moisture_warning',
          'Freeze warning: Pipe temperature at ' + zone.currentTemp + '°C in ' + zone.zone + '. Monitoring closely.');
      } else if (zone.currentTemp > fp.warningThreshold + 3 && zone.status === 'on') {
        zone.status = 'off';
        fp.keepDrippingMode = false;
        this.homey.emit('waterleak-heattape-deactivated', { zone: zone.zone, temp: zone.currentTemp, timestamp: now });
      }
    }
  }

  /**
   * Check sensor batteries and generate replacement reminders.
   * @private
   */
  _checkBatteries() {
    var now = new Date().toISOString();
    var keys = Object.keys(this.sensors);
    this.maintenance.sensorBatteryAlerts = [];
    for (var i = 0; i < keys.length; i++) {
      var sensor = this.sensors[keys[i]];
      if (sensor.batteryLevel <= 10) {
        this.maintenance.sensorBatteryAlerts.push({
          sensorId: sensor.id, name: sensor.name, zone: sensor.zone,
          batteryLevel: sensor.batteryLevel, severity: 'critical', timestamp: now
        });
        this._triggerAlert('battery_critical_' + sensor.id, null, 'moisture_warning',
          'CRITICAL: Sensor ' + sensor.name + ' battery at ' + sensor.batteryLevel + '%. Replace immediately!');
      } else if (sensor.batteryLevel <= 25) {
        this.maintenance.sensorBatteryAlerts.push({
          sensorId: sensor.id, name: sensor.name, zone: sensor.zone,
          batteryLevel: sensor.batteryLevel, severity: 'warning', timestamp: now
        });
      }
    }
    if (this.maintenance.sensorBatteryAlerts.length > 0) {
      this.homey.emit('waterleak-battery-alerts', { alerts: this.maintenance.sensorBatteryAlerts, timestamp: now });
    }
  }

  /**
   * Roll up water usage analytics into daily/weekly/monthly logs.
   * @private
   */
  _rollupUsageAnalytics() {
    var now = new Date();
    var today = now.toISOString().slice(0, 10);
    var ua = this.usageAnalytics;
    if (ua.currentDay.date !== today) {
      // Day rolled over — archive previous day
      ua.dailyLog.push({
        date: ua.currentDay.date, liters: Math.round(ua.currentDay.liters),
        costSEK: Math.round(ua.currentDay.costSEK * 100) / 100
      });
      if (ua.dailyLog.length > 365) ua.dailyLog.shift();
      ua.currentDay = { date: today, liters: 0, costSEK: 0 };
      this.flowMonitoring.dailyUsageLiters = 0;
    }
    // Weekly rollup
    var weekNum = this._getWeekNumber(now);
    if (ua.currentWeek.weekNumber !== weekNum) {
      if (ua.currentWeek.weekNumber !== null) {
        ua.weeklyLog.push({
          weekNumber: ua.currentWeek.weekNumber, liters: Math.round(ua.currentWeek.liters),
          costSEK: Math.round(ua.currentWeek.costSEK * 100) / 100
        });
        if (ua.weeklyLog.length > 52) ua.weeklyLog.shift();
      }
      ua.currentWeek = { weekNumber: weekNum, liters: 0, costSEK: 0 };
    }
    ua.currentWeek.liters += ua.currentDay.liters;
    ua.currentWeek.costSEK = Math.round((ua.currentWeek.liters / 1000) * ua.costPerCubicMeter * 100) / 100;
    // Monthly rollup
    var monthKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    if (ua.currentMonth.month !== monthKey) {
      if (ua.currentMonth.month !== null) {
        ua.monthlyLog.push({
          month: ua.currentMonth.month, liters: Math.round(ua.currentMonth.liters),
          costSEK: Math.round(ua.currentMonth.costSEK * 100) / 100
        });
        if (ua.monthlyLog.length > 24) ua.monthlyLog.shift();
      }
      ua.currentMonth = { month: monthKey, liters: 0, costSEK: 0 };
    }
    ua.currentMonth.liters += ua.currentDay.liters;
    ua.currentMonth.costSEK = Math.round((ua.currentMonth.liters / 1000) * ua.costPerCubicMeter * 100) / 100;
  }

  /**
   * Check if valve exercise is due and perform it.
   * @private
   */
  _checkValveExercise() {
    var now = new Date();
    var schedule = this.maintenance.valveExerciseSchedule;
    if (schedule.nextDue && new Date(schedule.nextDue).getTime() <= now.getTime()) {
      this._exerciseAllValves();
    }
  }

  /**
   * Check maintenance reminders (annual test, replacements).
   * @private
   */
  _checkMaintenanceReminders() {
    var now = new Date();
    if (this.maintenance.annualTestDue && new Date(this.maintenance.annualTestDue).getTime() <= now.getTime()) {
      this.homey.emit('waterleak-maintenance-due', {
        type: 'annual_test', message: 'Annual water leak protection system test is due.',
        timestamp: now.toISOString()
      });
    }
    // Check replacement reminders
    for (var i = 0; i < this.maintenance.replacementReminders.length; i++) {
      var reminder = this.maintenance.replacementReminders[i];
      if (!reminder.acknowledged && new Date(reminder.dueDate).getTime() <= now.getTime()) {
        this.homey.emit('waterleak-replacement-due', {
          sensorId: reminder.sensorId, part: reminder.part,
          message: reminder.message, timestamp: now.toISOString()
        });
      }
    }
  }

  /**
   * Trigger an alert at the specified level and run escalation chain.
   * @param {string} alertId - Unique identifier for this alert type.
   * @param {string|null} sensorId - The sensor that triggered the alert, or null for flow/pressure alerts.
   * @param {string} level - Alert level: 'moisture_warning', 'active_leak', or 'flood_emergency'.
   * @param {string} message - Human-readable alert message.
   * @private
   */
  _triggerAlert(alertId, sensorId, level, message) {
    var now = new Date().toISOString();
    var levelConfig = this.alertSystem.levels[level];
    if (!levelConfig) return;

    // Check for duplicate active alerts
    for (var i = 0; i < this.alertSystem.activeAlerts.length; i++) {
      if (this.alertSystem.activeAlerts[i].alertId === alertId && !this.alertSystem.activeAlerts[i].resolved) {
        return; // Already active
      }
    }

    var alert = {
      alertId: alertId,
      sensorId: sensorId,
      level: level,
      priority: levelConfig.priority,
      label: levelConfig.label,
      message: message,
      timestamp: now,
      resolved: false,
      resolvedAt: null,
      escalationStep: 1,
      autoShutoffTriggered: false,
      acknowledgedBy: null
    };

    this.alertSystem.activeAlerts.push(alert);
    this.alertSystem.alertHistory.push(Object.assign({}, alert));
    if (this.alertSystem.alertHistory.length > 500) this.alertSystem.alertHistory.shift();

    this.homey.log('[WaterLeak] ALERT [' + level + ']: ' + message);
    this.homey.emit('waterleak-alert', { alertId: alertId, level: level, message: message, sensorId: sensorId, timestamp: now });

    // Run escalation chain
    this._runEscalation(alert, levelConfig);

    // Update zone incident tracking
    if (sensorId && this.sensors[sensorId]) {
      var sensorZone = this.sensors[sensorId].zone;
      if (this.zones[sensorZone]) {
        this.zones[sensorZone].lastIncident = now;
        this.zones[sensorZone].incidentCount++;
      }
    }

    // Auto-shutoff for flood emergency level
    if (levelConfig.autoShutoff && this.config.autoShutoffEnabled) {
      this._emergencyShutoff(sensorId, alertId);
    }
  }

  /**
   * Run the escalation chain for a given alert.
   * @param {object} alert - The alert object.
   * @param {object} levelConfig - The alert level configuration.
   * @private
   */
  _runEscalation(alert, levelConfig) {
    var chain = this.alertSystem.escalationChain;
    for (var i = 0; i < chain.length; i++) {
      var step = chain[i];
      if (step.action === 'notification') {
        this.homey.emit('waterleak-notification', {
          level: alert.level, message: alert.message, timestamp: alert.timestamp
        });
      } else if (step.action === 'alarm' && this.alertSystem.sirenEnabled && alert.priority >= 2) {
        this.homey.emit('waterleak-alarm-siren', {
          level: alert.level, message: alert.message, timestamp: alert.timestamp
        });
      } else if (step.action === 'auto_shutoff' && alert.priority >= 3) {
        if (!alert.autoShutoffTriggered) {
          alert.autoShutoffTriggered = true;
        }
      } else if (step.action === 'emergency_contact' && alert.priority >= 3) {
        this._notifyEmergencyContacts(alert);
      }
      alert.escalationStep = i + 1;
    }
  }

  /**
   * Notify emergency contacts via SMS/call for critical alerts.
   * @param {object} alert - The alert object.
   * @private
   */
  _notifyEmergencyContacts(alert) {
    var contacts = this.alertSystem.emergencyContacts;
    for (var i = 0; i < contacts.length; i++) {
      var contact = contacts[i];
      if (contact.sms && this.alertSystem.smsEnabled) {
        this.homey.log('[WaterLeak] SMS sent to ' + contact.name + ' (' + contact.phone + '): ' + alert.message);
        this.homey.emit('waterleak-sms-sent', {
          contact: contact.name, phone: contact.phone, message: alert.message, timestamp: new Date().toISOString()
        });
      }
      if (contact.call && this.alertSystem.callEnabled && alert.priority >= 3) {
        this.homey.log('[WaterLeak] Emergency call to ' + contact.name + ' (' + contact.phone + ')');
        this.homey.emit('waterleak-call-initiated', {
          contact: contact.name, phone: contact.phone, timestamp: new Date().toISOString()
        });
      }
    }
  }

  /**
   * Perform emergency shutoff — close the relevant zone valve and optionally the main valve.
   * @param {string|null} sensorId - The sensor that triggered the emergency.
   * @param {string} alertId - The alert ID.
   * @private
   */
  _emergencyShutoff(sensorId, alertId) {
    var now = new Date().toISOString();
    // Determine which valve to close
    var valveId = 'valve-main';
    if (sensorId && this.sensors[sensorId]) {
      var zone = this.sensors[sensorId].zone;
      if (this.zones[zone] && this.zones[zone].associatedValve) {
        valveId = this.zones[zone].associatedValve;
      }
    }
    // Close zone valve
    if (this.valves[valveId] && !this.valves[valveId].manualOverride) {
      this.valves[valveId].state = 'closed';
      this.valves[valveId].lastStateChange = now;
      this.valves[valveId].operationCount++;
      this.homey.log('[WaterLeak] EMERGENCY SHUTOFF: Valve ' + valveId + ' closed due to ' + alertId);
      this.homey.emit('waterleak-valve-closed', { valveId: valveId, reason: alertId, emergency: true, timestamp: now });
    }
    // For flood emergency, also close main if zone valve is different
    if (valveId !== 'valve-main' && this.valves['valve-main'] && !this.valves['valve-main'].manualOverride) {
      this.valves['valve-main'].state = 'closed';
      this.valves['valve-main'].lastStateChange = now;
      this.valves['valve-main'].operationCount++;
      this.homey.log('[WaterLeak] EMERGENCY SHUTOFF: Main valve also closed');
      this.homey.emit('waterleak-valve-closed', { valveId: 'valve-main', reason: alertId, emergency: true, timestamp: now });
    }
    // Log to insurance documentation
    this.maintenance.insuranceDocumentation.incidentHistory.push({
      alertId: alertId, sensorId: sensorId, valveClosed: valveId,
      mainValveClosed: true, timestamp: now
    });
  }

  /**
   * Exercise all valves to prevent seizing (close then re-open).
   * @returns {{ success: boolean, exercised: string[] }}
   */
  _exerciseAllValves() {
    var now = new Date().toISOString();
    var exercised = [];
    var keys = Object.keys(this.valves);
    for (var i = 0; i < keys.length; i++) {
      var valve = this.valves[keys[i]];
      if (valve.manualOverride) continue;
      valve.lastExercise = now;
      valve.operationCount += 2; // close + open
      exercised.push(valve.id);
      this.homey.log('[WaterLeak] Valve exercised: ' + valve.name);
    }
    this.maintenance.valveExerciseSchedule.lastExercise = now;
    this.maintenance.valveExerciseSchedule.nextDue = this._addDays(now, this.maintenance.valveExerciseSchedule.intervalDays);
    this.maintenance.insuranceDocumentation.testHistory.push({
      type: 'valve_exercise', valves: exercised, timestamp: now
    });
    this.homey.emit('waterleak-valves-exercised', { valves: exercised, timestamp: now });
    return { success: true, exercised: exercised };
  }

  // ─── API Methods ──────────────────────────────────────────────

  /**
   * Get the current status of all sensors or a specific sensor.
   * @param {string} [sensorId] - Optional sensor ID. If omitted, returns all sensors.
   * @returns {{ success: boolean, sensors?: object[], sensor?: object, error?: string }}
   */
  getSensorStatus(sensorId) {
    if (sensorId) {
      var sensor = this.sensors[sensorId];
      if (!sensor) return { success: false, error: 'Unknown sensor: ' + sensorId };
      return { success: true, sensor: Object.assign({}, sensor) };
    }
    var all = [];
    var keys = Object.keys(this.sensors);
    for (var i = 0; i < keys.length; i++) {
      all.push(Object.assign({}, this.sensors[keys[i]]));
    }
    return { success: true, sensors: all, total: all.length };
  }

  /**
   * Get current flow monitoring data.
   * @returns {{ success: boolean, flowData: object }}
   */
  getFlowData() {
    var fm = this.flowMonitoring;
    return {
      success: true,
      flowData: {
        currentFlowRate: fm.currentFlowRate,
        dailyUsageLiters: Math.round(fm.dailyUsageLiters),
        weeklyUsageLiters: Math.round(fm.weeklyUsageLiters),
        monthlyUsageLiters: Math.round(fm.monthlyUsageLiters),
        avgDailyUsageLiters: fm.avgDailyUsageLiters,
        continuousFlowActive: fm.continuousFlowStart !== null,
        lastReading: fm.lastFlowReading,
        recentHistory: fm.flowHistory.slice(-60)
      }
    };
  }

  /**
   * Manually shut off a specific valve or the main valve.
   * @param {string} [valveId='valve-main'] - The valve to close.
   * @param {string} [reason='manual'] - Reason for shutoff.
   * @returns {{ success: boolean, valveId?: string, state?: string, error?: string }}
   */
  shutoffValve(valveId, reason) {
    valveId = valveId || 'valve-main';
    reason = reason || 'manual';
    var valve = this.valves[valveId];
    if (!valve) return { success: false, error: 'Unknown valve: ' + valveId };
    if (valve.state === 'closed') return { success: false, error: 'Valve already closed' };
    if (valve.manualOverride) return { success: false, error: 'Valve is in manual override mode' };
    var now = new Date().toISOString();
    valve.state = 'closed';
    valve.lastStateChange = now;
    valve.operationCount++;
    this.homey.log('[WaterLeak] Valve ' + valveId + ' closed. Reason: ' + reason);
    this.homey.emit('waterleak-valve-closed', { valveId: valveId, reason: reason, emergency: false, timestamp: now });
    return { success: true, valveId: valveId, state: 'closed', reason: reason, timestamp: now };
  }

  /**
   * Open a specific valve or the main valve.
   * @param {string} [valveId='valve-main'] - The valve to open.
   * @param {string} [reason='manual'] - Reason for opening.
   * @returns {{ success: boolean, valveId?: string, state?: string, error?: string }}
   */
  openValve(valveId, reason) {
    valveId = valveId || 'valve-main';
    reason = reason || 'manual';
    var valve = this.valves[valveId];
    if (!valve) return { success: false, error: 'Unknown valve: ' + valveId };
    if (valve.state === 'open') return { success: false, error: 'Valve already open' };
    if (valve.manualOverride) return { success: false, error: 'Valve is in manual override mode' };
    // Safety check: only allow opening if no active flood emergency alerts
    var activeFloods = this.alertSystem.activeAlerts.filter(function(a) {
      return a.level === 'flood_emergency' && !a.resolved;
    });
    if (activeFloods.length > 0 && reason !== 'override') {
      return { success: false, error: 'Cannot open valve while flood emergency is active. Use reason "override" to force.' };
    }
    var now = new Date().toISOString();
    valve.state = 'open';
    valve.lastStateChange = now;
    valve.operationCount++;
    this.homey.log('[WaterLeak] Valve ' + valveId + ' opened. Reason: ' + reason);
    this.homey.emit('waterleak-valve-opened', { valveId: valveId, reason: reason, timestamp: now });
    return { success: true, valveId: valveId, state: 'open', reason: reason, timestamp: now };
  }

  /**
   * Get a water usage report for a specified period.
   * @param {string} [period='daily'] - Period: 'daily', 'weekly', 'monthly', or 'yearly'.
   * @returns {{ success: boolean, report: object }}
   */
  getUsageReport(period) {
    period = period || 'daily';
    var ua = this.usageAnalytics;
    var report = {
      period: period,
      costPerCubicMeter: ua.costPerCubicMeter,
      currency: ua.currency,
      generatedAt: new Date().toISOString()
    };
    if (period === 'daily') {
      report.current = Object.assign({}, ua.currentDay);
      report.history = ua.dailyLog.slice(-30);
      report.averageLiters = ua.averages.dailyLiters;
      report.comparisonToAverage = ua.currentDay.liters > 0
        ? Math.round(((ua.currentDay.liters - ua.averages.dailyLiters) / ua.averages.dailyLiters) * 100)
        : 0;
    } else if (period === 'weekly') {
      report.current = Object.assign({}, ua.currentWeek);
      report.history = ua.weeklyLog.slice(-12);
      report.averageLiters = ua.averages.weeklyLiters;
      report.comparisonToAverage = ua.currentWeek.liters > 0
        ? Math.round(((ua.currentWeek.liters - ua.averages.weeklyLiters) / ua.averages.weeklyLiters) * 100)
        : 0;
    } else if (period === 'monthly') {
      report.current = Object.assign({}, ua.currentMonth);
      report.history = ua.monthlyLog.slice(-12);
      report.averageLiters = ua.averages.monthlyLiters;
      report.comparisonToAverage = ua.currentMonth.liters > 0
        ? Math.round(((ua.currentMonth.liters - ua.averages.monthlyLiters) / ua.averages.monthlyLiters) * 100)
        : 0;
    } else if (period === 'yearly') {
      report.history = ua.yearlyLog.slice();
      report.averageLiters = ua.averages.monthlyLiters * 12;
    }
    report.leakWaste = Object.assign({}, ua.leakWaste);
    return { success: true, report: report };
  }

  /**
   * Add a new leak sensor to the system.
   * @param {object} sensorDef - Sensor definition.
   * @param {string} sensorDef.id - Unique sensor ID.
   * @param {string} sensorDef.name - Human-readable name.
   * @param {string} sensorDef.zone - Zone the sensor belongs to.
   * @param {string} sensorDef.type - Sensor type: 'floor_pad', 'pipe_mount_flow', 'moisture', 'humidity_anomaly'.
   * @param {string} sensorDef.locationDescription - Description of install location.
   * @returns {{ success: boolean, sensorId?: string, error?: string }}
   */
  addSensor(sensorDef) {
    if (!sensorDef || !sensorDef.id || !sensorDef.name || !sensorDef.zone || !sensorDef.type) {
      return { success: false, error: 'Missing required fields: id, name, zone, type' };
    }
    if (this.sensors[sensorDef.id]) {
      return { success: false, error: 'Sensor ID already exists: ' + sensorDef.id };
    }
    var validTypes = ['floor_pad', 'pipe_mount_flow', 'moisture', 'humidity_anomaly'];
    if (validTypes.indexOf(sensorDef.type) === -1) {
      return { success: false, error: 'Invalid sensor type. Must be one of: ' + validTypes.join(', ') };
    }
    var now = new Date().toISOString();
    this.sensors[sensorDef.id] = {
      id: sensorDef.id,
      name: sensorDef.name,
      zone: sensorDef.zone,
      type: sensorDef.type,
      locationDescription: sensorDef.locationDescription || '',
      status: 'dry',
      batteryLevel: 100,
      signalStrength: -45,
      lastChecked: now,
      lastTriggered: null,
      sensitivity: sensorDef.sensitivity || 'normal',
      enabled: true,
      installed: true,
      installDate: now,
      firmware: '2.1.0',
      triggerCount: 0,
      falsePositives: 0,
      temperatureC: 20
    };
    // Add to zone if it exists
    if (this.zones[sensorDef.zone]) {
      this.zones[sensorDef.zone].sensors.push(sensorDef.id);
    }
    // Add to insurance documentation
    this.maintenance.insuranceDocumentation.installedSensors.push(sensorDef.id);
    this.homey.log('[WaterLeak] Sensor added: ' + sensorDef.name + ' in ' + sensorDef.zone);
    this.homey.emit('waterleak-sensor-added', { sensorId: sensorDef.id, zone: sensorDef.zone, timestamp: now });
    return { success: true, sensorId: sensorDef.id, timestamp: now };
  }

  /**
   * Remove a sensor from the system.
   * @param {string} sensorId - The sensor ID to remove.
   * @returns {{ success: boolean, sensorId?: string, error?: string }}
   */
  removeSensor(sensorId) {
    if (!this.sensors[sensorId]) {
      return { success: false, error: 'Unknown sensor: ' + sensorId };
    }
    var sensor = this.sensors[sensorId];
    var zone = sensor.zone;
    delete this.sensors[sensorId];
    // Remove from zone
    if (this.zones[zone]) {
      var idx = this.zones[zone].sensors.indexOf(sensorId);
      if (idx !== -1) this.zones[zone].sensors.splice(idx, 1);
    }
    // Remove from insurance documentation
    var insIdx = this.maintenance.insuranceDocumentation.installedSensors.indexOf(sensorId);
    if (insIdx !== -1) this.maintenance.insuranceDocumentation.installedSensors.splice(insIdx, 1);
    this.homey.log('[WaterLeak] Sensor removed: ' + sensorId);
    this.homey.emit('waterleak-sensor-removed', { sensorId: sensorId, zone: zone, timestamp: new Date().toISOString() });
    return { success: true, sensorId: sensorId };
  }

  /**
   * Run a full system test: check all sensors, exercise all valves, test alerts.
   * @returns {Promise<{ success: boolean, results: object }>}
   */
  async testSystem() {
    this.homey.log('[WaterLeak] Running full system test...');
    var now = new Date().toISOString();
    var results = {
      timestamp: now,
      sensorTest: { total: 0, passed: 0, failed: 0, details: [] },
      valveTest: { total: 0, passed: 0, failed: 0, details: [] },
      flowTest: { passed: false, details: '' },
      pressureTest: { passed: false, details: '' },
      alertTest: { passed: false, details: '' },
      freezeProtectionTest: { passed: false, details: '' },
      overallResult: 'pending'
    };

    // Test sensors
    var sensorKeys = Object.keys(this.sensors);
    results.sensorTest.total = sensorKeys.length;
    for (var i = 0; i < sensorKeys.length; i++) {
      var sensor = this.sensors[sensorKeys[i]];
      var sensorOk = sensor.enabled && sensor.batteryLevel > 5 && sensor.signalStrength > -85;
      if (sensorOk) {
        results.sensorTest.passed++;
        results.sensorTest.details.push({ id: sensor.id, status: 'pass', battery: sensor.batteryLevel, signal: sensor.signalStrength });
      } else {
        results.sensorTest.failed++;
        var reason = [];
        if (!sensor.enabled) reason.push('disabled');
        if (sensor.batteryLevel <= 5) reason.push('low battery (' + sensor.batteryLevel + '%)');
        if (sensor.signalStrength <= -85) reason.push('weak signal (' + sensor.signalStrength + ' dBm)');
        results.sensorTest.details.push({ id: sensor.id, status: 'fail', reasons: reason });
      }
    }

    // Test valves
    var valveKeys = Object.keys(this.valves);
    results.valveTest.total = valveKeys.length;
    for (var j = 0; j < valveKeys.length; j++) {
      var valve = this.valves[valveKeys[j]];
      var valveOk = valve.installed && valve.healthStatus === 'good';
      if (valveOk) {
        results.valveTest.passed++;
        results.valveTest.details.push({ id: valve.id, status: 'pass', health: valve.healthStatus });
      } else {
        results.valveTest.failed++;
        results.valveTest.details.push({ id: valve.id, status: 'fail', health: valve.healthStatus });
      }
    }

    // Test flow monitoring
    results.flowTest.passed = this.flowMonitoring.lastFlowReading !== null;
    results.flowTest.details = results.flowTest.passed ? 'Flow monitoring active, last reading: ' + this.flowMonitoring.lastFlowReading : 'Flow monitoring not active';

    // Test pressure monitoring
    results.pressureTest.passed = this.pressureMonitoring.lastReading !== null && this.pressureMonitoring.currentPressure > 0;
    results.pressureTest.details = results.pressureTest.passed
      ? 'Pressure monitoring active at ' + this.pressureMonitoring.currentPressure + ' bar'
      : 'Pressure monitoring not active';

    // Test alert system
    results.alertTest.passed = this.alertSystem.emergencyContacts.length > 0;
    results.alertTest.details = 'Emergency contacts configured: ' + this.alertSystem.emergencyContacts.length +
      ', SMS: ' + (this.alertSystem.smsEnabled ? 'enabled' : 'disabled') +
      ', Calls: ' + (this.alertSystem.callEnabled ? 'enabled' : 'disabled');

    // Test freeze protection
    results.freezeProtectionTest.passed = this.freezeProtection.enabled && this.freezeProtection.heatTapeZones.length > 0;
    results.freezeProtectionTest.details = results.freezeProtectionTest.passed
      ? 'Freeze protection active, ' + this.freezeProtection.heatTapeZones.length + ' heat tape zones monitored'
      : 'Freeze protection not configured';

    // Overall result
    var allPassed = results.sensorTest.failed === 0 && results.valveTest.failed === 0 &&
      results.flowTest.passed && results.pressureTest.passed &&
      results.alertTest.passed && results.freezeProtectionTest.passed;
    results.overallResult = allPassed ? 'PASS' : 'FAIL';

    // Log test to insurance documentation
    this.maintenance.insuranceDocumentation.testHistory.push({
      type: 'full_system_test', result: results.overallResult,
      sensorsPassed: results.sensorTest.passed, sensorsFailed: results.sensorTest.failed,
      valvesPassed: results.valveTest.passed, valvesFailed: results.valveTest.failed,
      timestamp: now
    });
    this.maintenance.lastAnnualTest = now;
    this.maintenance.annualTestDue = this._addDays(now, 365);

    this.homey.log('[WaterLeak] System test complete: ' + results.overallResult);
    this.homey.emit('waterleak-system-tested', { result: results.overallResult, timestamp: now });
    return { success: true, results: results };
  }

  /**
   * Get alert history, optionally filtered by level or date range.
   * @param {object} [filter] - Optional filter.
   * @param {string} [filter.level] - Filter by alert level.
   * @param {number} [filter.limit=50] - Max number of alerts to return.
   * @returns {{ success: boolean, alerts: object[], total: number }}
   */
  getAlertHistory(filter) {
    filter = filter || {};
    var alerts = this.alertSystem.alertHistory.slice();
    if (filter.level) {
      alerts = alerts.filter(function(a) { return a.level === filter.level; });
    }
    var limit = filter.limit || 50;
    alerts = alerts.slice(-limit);
    return { success: true, alerts: alerts, total: alerts.length };
  }

  // ─── Additional Methods ───────────────────────────────────────

  /**
   * Simulate a sensor detecting a leak (for testing or actual detection).
   * @param {string} sensorId - The sensor ID that detected the leak.
   * @param {string} [severity='wet'] - Severity: 'damp' or 'wet'.
   * @returns {{ success: boolean, response?: object, error?: string }}
   */
  reportLeak(sensorId, severity) {
    severity = severity || 'wet';
    var sensor = this.sensors[sensorId];
    if (!sensor) return { success: false, error: 'Unknown sensor: ' + sensorId };
    if (!sensor.enabled) return { success: false, error: 'Sensor is disabled: ' + sensorId };

    var now = new Date().toISOString();
    var prevStatus = sensor.status;
    sensor.status = severity;
    sensor.lastTriggered = now;
    sensor.triggerCount++;

    // Determine alert level based on severity and zone policy
    var alertLevel = 'moisture_warning';
    if (severity === 'wet') {
      var zone = this.zones[sensor.zone];
      if (zone && zone.responsePolicy === 'auto_shutoff') {
        alertLevel = 'flood_emergency';
      } else {
        alertLevel = 'active_leak';
      }
    }

    this._triggerAlert('leak_' + sensorId, sensorId, alertLevel,
      'Leak detected by ' + sensor.name + ' (' + sensor.type + ') in ' + sensor.zone + '. Status: ' + severity);

    // Track leak waste
    if (severity === 'wet') {
      this.usageAnalytics.leakWaste.incidents.push({
        sensorId: sensorId, zone: sensor.zone, startTime: now,
        estimatedLitersPerMinute: 5, totalLiters: 0, costSEK: 0
      });
    }

    var response = {
      sensorId: sensorId, previousStatus: prevStatus, currentStatus: severity,
      alertLevel: alertLevel, zone: sensor.zone, timestamp: now
    };
    this.homey.log('[WaterLeak] Leak reported: ' + sensorId + ' -> ' + severity);
    this.homey.emit('waterleak-leak-detected', response);
    return { success: true, response: response };
  }

  /**
   * Clear a leak alert and mark sensor as dry.
   * @param {string} sensorId - The sensor ID to clear.
   * @returns {{ success: boolean, sensorId?: string, error?: string }}
   */
  clearLeak(sensorId) {
    var sensor = this.sensors[sensorId];
    if (!sensor) return { success: false, error: 'Unknown sensor: ' + sensorId };
    var now = new Date().toISOString();
    sensor.status = 'dry';

    // Resolve active alerts for this sensor
    for (var i = 0; i < this.alertSystem.activeAlerts.length; i++) {
      var alert = this.alertSystem.activeAlerts[i];
      if (alert.sensorId === sensorId && !alert.resolved) {
        alert.resolved = true;
        alert.resolvedAt = now;
      }
    }

    // Update leak waste tracking
    var incidents = this.usageAnalytics.leakWaste.incidents;
    for (var j = 0; j < incidents.length; j++) {
      if (incidents[j].sensorId === sensorId && !incidents[j].endTime) {
        incidents[j].endTime = now;
        var durationMinutes = (new Date(now).getTime() - new Date(incidents[j].startTime).getTime()) / 60000;
        incidents[j].totalLiters = Math.round(durationMinutes * incidents[j].estimatedLitersPerMinute);
        incidents[j].costSEK = Math.round((incidents[j].totalLiters / 1000) * this.usageAnalytics.costPerCubicMeter * 100) / 100;
        this.usageAnalytics.leakWaste.totalLitersWasted += incidents[j].totalLiters;
        this.usageAnalytics.leakWaste.totalCostSEK += incidents[j].costSEK;
      }
    }

    this.homey.log('[WaterLeak] Leak cleared: ' + sensorId);
    this.homey.emit('waterleak-leak-cleared', { sensorId: sensorId, timestamp: now });
    return { success: true, sensorId: sensorId, timestamp: now };
  }

  /**
   * Get comprehensive system status summary.
   * @returns {{ success: boolean, status: object }}
   */
  getSystemStatus() {
    var sensorKeys = Object.keys(this.sensors);
    var activeSensors = 0;
    var wetSensors = 0;
    var dampSensors = 0;
    var lowBattery = 0;
    for (var i = 0; i < sensorKeys.length; i++) {
      var s = this.sensors[sensorKeys[i]];
      if (s.enabled) activeSensors++;
      if (s.status === 'wet') wetSensors++;
      if (s.status === 'damp') dampSensors++;
      if (s.batteryLevel <= 25) lowBattery++;
    }
    var valveKeys = Object.keys(this.valves);
    var closedValves = 0;
    for (var j = 0; j < valveKeys.length; j++) {
      if (this.valves[valveKeys[j]].state === 'closed') closedValves++;
    }
    var activeAlerts = this.alertSystem.activeAlerts.filter(function(a) { return !a.resolved; });
    var heatTapeActive = this.freezeProtection.heatTapeZones.filter(function(z) { return z.status === 'on'; });
    return {
      success: true,
      status: {
        systemInitialized: this.initialized,
        totalSensors: sensorKeys.length,
        activeSensors: activeSensors,
        wetSensors: wetSensors,
        dampSensors: dampSensors,
        lowBatterySensors: lowBattery,
        totalValves: valveKeys.length,
        closedValves: closedValves,
        currentFlowRate: this.flowMonitoring.currentFlowRate,
        dailyUsageLiters: Math.round(this.flowMonitoring.dailyUsageLiters),
        currentPressure: this.pressureMonitoring.currentPressure,
        activeAlerts: activeAlerts.length,
        freezeProtectionActive: this.freezeProtection.enabled,
        heatTapeZonesActive: heatTapeActive.length,
        keepDrippingMode: this.freezeProtection.keepDrippingMode,
        autoShutoffEnabled: this.config.autoShutoffEnabled,
        currentlyOccupied: this.config.currentlyOccupied,
        todayUsageSEK: this.usageAnalytics.currentDay.costSEK,
        totalLeakWasteLiters: this.usageAnalytics.leakWaste.totalLitersWasted,
        totalLeakWasteSEK: this.usageAnalytics.leakWaste.totalCostSEK,
        nextValveExercise: this.maintenance.valveExerciseSchedule.nextDue,
        annualTestDue: this.maintenance.annualTestDue,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Set the occupancy state (affects flow anomaly detection).
   * @param {boolean} occupied - Whether the home is currently occupied.
   * @returns {{ success: boolean, occupied: boolean }}
   */
  setOccupancy(occupied) {
    this.config.currentlyOccupied = !!occupied;
    this.homey.log('[WaterLeak] Occupancy set to: ' + (occupied ? 'home' : 'away'));
    this.homey.emit('waterleak-occupancy-changed', { occupied: this.config.currentlyOccupied, timestamp: new Date().toISOString() });
    return { success: true, occupied: this.config.currentlyOccupied };
  }

  /**
   * Set manual override on a valve (prevents automated open/close).
   * @param {string} valveId - The valve ID.
   * @param {boolean} override - Whether to enable manual override.
   * @returns {{ success: boolean, valveId?: string, manualOverride?: boolean, error?: string }}
   */
  setValveManualOverride(valveId, override) {
    var valve = this.valves[valveId];
    if (!valve) return { success: false, error: 'Unknown valve: ' + valveId };
    valve.manualOverride = !!override;
    this.homey.log('[WaterLeak] Manual override ' + (override ? 'enabled' : 'disabled') + ' for ' + valve.name);
    this.homey.emit('waterleak-valve-override', { valveId: valveId, manualOverride: valve.manualOverride, timestamp: new Date().toISOString() });
    return { success: true, valveId: valveId, manualOverride: valve.manualOverride };
  }

  /**
   * Update a sensor's sensitivity setting.
   * @param {string} sensorId - The sensor ID.
   * @param {string} sensitivity - Sensitivity: 'low', 'normal', 'high', 'critical'.
   * @returns {{ success: boolean, sensorId?: string, sensitivity?: string, error?: string }}
   */
  setSensorSensitivity(sensorId, sensitivity) {
    var sensor = this.sensors[sensorId];
    if (!sensor) return { success: false, error: 'Unknown sensor: ' + sensorId };
    var validLevels = ['low', 'normal', 'high', 'critical'];
    if (validLevels.indexOf(sensitivity) === -1) {
      return { success: false, error: 'Invalid sensitivity. Must be one of: ' + validLevels.join(', ') };
    }
    sensor.sensitivity = sensitivity;
    this.homey.log('[WaterLeak] Sensor ' + sensorId + ' sensitivity set to: ' + sensitivity);
    return { success: true, sensorId: sensorId, sensitivity: sensitivity };
  }

  /**
   * Update zone response policy.
   * @param {string} zoneId - The zone ID.
   * @param {string} policy - Policy: 'alert_only', 'alert_then_shutoff', 'auto_shutoff'.
   * @param {number} [shutoffDelay] - Delay in seconds before shutoff (for alert_then_shutoff).
   * @returns {{ success: boolean, zoneId?: string, policy?: string, error?: string }}
   */
  setZonePolicy(zoneId, policy, shutoffDelay) {
    var zone = this.zones[zoneId];
    if (!zone) return { success: false, error: 'Unknown zone: ' + zoneId };
    var validPolicies = ['alert_only', 'alert_then_shutoff', 'auto_shutoff'];
    if (validPolicies.indexOf(policy) === -1) {
      return { success: false, error: 'Invalid policy. Must be one of: ' + validPolicies.join(', ') };
    }
    zone.responsePolicy = policy;
    if (typeof shutoffDelay === 'number') zone.shutoffDelay = shutoffDelay;
    this.homey.log('[WaterLeak] Zone ' + zoneId + ' policy set to: ' + policy);
    this.homey.emit('waterleak-zone-policy-updated', { zoneId: zoneId, policy: policy, shutoffDelay: zone.shutoffDelay, timestamp: new Date().toISOString() });
    return { success: true, zoneId: zoneId, policy: policy, shutoffDelay: zone.shutoffDelay };
  }

  /**
   * Get pressure monitoring data.
   * @returns {{ success: boolean, pressureData: object }}
   */
  getPressureData() {
    var pm = this.pressureMonitoring;
    return {
      success: true,
      pressureData: {
        currentPressure: pm.currentPressure,
        normalRange: pm.normalRange,
        highPressureThreshold: pm.highPressureThreshold,
        lowPressureThreshold: pm.lowPressureThreshold,
        reliefValve: Object.assign({}, pm.reliefValve),
        lastReading: pm.lastReading,
        recentHistory: pm.pressureHistory.slice(-60)
      }
    };
  }

  /**
   * Get freeze protection status.
   * @returns {{ success: boolean, freezeStatus: object }}
   */
  getFreezeStatus() {
    var fp = this.freezeProtection;
    return {
      success: true,
      freezeStatus: {
        enabled: fp.enabled,
        keepDrippingMode: fp.keepDrippingMode,
        warningThreshold: fp.warningThreshold,
        alertThreshold: fp.alertThreshold,
        criticalThreshold: fp.criticalThreshold,
        heatTapeZones: fp.heatTapeZones.map(function(z) { return Object.assign({}, z); }),
        seasonalActive: fp.seasonalActive,
        lastFreezeEvent: fp.lastFreezeEvent
      }
    };
  }

  /**
   * Get zone details including sensor list and incident history.
   * @param {string} [zoneId] - Optional zone ID. If omitted, returns all zones.
   * @returns {{ success: boolean, zones?: object[], zone?: object, error?: string }}
   */
  getZoneStatus(zoneId) {
    if (zoneId) {
      var zone = this.zones[zoneId];
      if (!zone) return { success: false, error: 'Unknown zone: ' + zoneId };
      var zoneCopy = Object.assign({}, zone);
      zoneCopy.sensorDetails = [];
      for (var i = 0; i < zone.sensors.length; i++) {
        var s = this.sensors[zone.sensors[i]];
        if (s) zoneCopy.sensorDetails.push({ id: s.id, name: s.name, status: s.status, battery: s.batteryLevel });
      }
      return { success: true, zone: zoneCopy };
    }
    var allZones = [];
    var keys = Object.keys(this.zones);
    for (var j = 0; j < keys.length; j++) {
      var z = this.zones[keys[j]];
      var copy = Object.assign({}, z);
      copy.sensorCount = z.sensors.length;
      allZones.push(copy);
    }
    return { success: true, zones: allZones };
  }

  /**
   * Get valve status for all valves or a specific valve.
   * @param {string} [valveId] - Optional valve ID.
   * @returns {{ success: boolean, valves?: object[], valve?: object, error?: string }}
   */
  getValveStatus(valveId) {
    if (valveId) {
      var v = this.valves[valveId];
      if (!v) return { success: false, error: 'Unknown valve: ' + valveId };
      return { success: true, valve: Object.assign({}, v) };
    }
    var all = [];
    var keys = Object.keys(this.valves);
    for (var i = 0; i < keys.length; i++) {
      all.push(Object.assign({}, this.valves[keys[i]]));
    }
    return { success: true, valves: all };
  }

  /**
   * Enable or disable auto-shutoff system-wide.
   * @param {boolean} enabled - Whether auto-shutoff is enabled.
   * @returns {{ success: boolean, autoShutoffEnabled: boolean }}
   */
  setAutoShutoff(enabled) {
    this.config.autoShutoffEnabled = !!enabled;
    this.homey.log('[WaterLeak] Auto-shutoff ' + (enabled ? 'enabled' : 'disabled'));
    return { success: true, autoShutoffEnabled: this.config.autoShutoffEnabled };
  }

  /**
   * Get maintenance and insurance documentation.
   * @returns {{ success: boolean, maintenance: object }}
   */
  getMaintenanceReport() {
    return {
      success: true,
      maintenance: {
        sensorBatteryAlerts: this.maintenance.sensorBatteryAlerts.slice(),
        annualTestDue: this.maintenance.annualTestDue,
        lastAnnualTest: this.maintenance.lastAnnualTest,
        valveExercise: Object.assign({}, this.maintenance.valveExerciseSchedule),
        insuranceDocumentation: {
          systemInstallDate: this.maintenance.insuranceDocumentation.systemInstallDate,
          installedSensorCount: this.maintenance.insuranceDocumentation.installedSensors.length,
          testHistoryCount: this.maintenance.insuranceDocumentation.testHistory.length,
          incidentHistoryCount: this.maintenance.insuranceDocumentation.incidentHistory.length,
          recentTests: this.maintenance.insuranceDocumentation.testHistory.slice(-5),
          recentIncidents: this.maintenance.insuranceDocumentation.incidentHistory.slice(-5)
        },
        replacementReminders: this.maintenance.replacementReminders.slice()
      }
    };
  }

  /**
   * Update water cost per cubic meter.
   * @param {number} costPerM3 - Cost in SEK per cubic meter.
   * @returns {{ success: boolean, costPerCubicMeter?: number, error?: string }}
   */
  setWaterCost(costPerM3) {
    if (typeof costPerM3 !== 'number' || costPerM3 <= 0) {
      return { success: false, error: 'Cost must be a positive number' };
    }
    this.usageAnalytics.costPerCubicMeter = costPerM3;
    this.homey.log('[WaterLeak] Water cost updated to ' + costPerM3 + ' SEK/m³');
    return { success: true, costPerCubicMeter: costPerM3 };
  }

  /**
   * Acknowledge an active alert.
   * @param {string} alertId - The alert ID to acknowledge.
   * @param {string} [acknowledgedBy='user'] - Who acknowledged the alert.
   * @returns {{ success: boolean, alertId?: string, error?: string }}
   */
  acknowledgeAlert(alertId, acknowledgedBy) {
    acknowledgedBy = acknowledgedBy || 'user';
    for (var i = 0; i < this.alertSystem.activeAlerts.length; i++) {
      var alert = this.alertSystem.activeAlerts[i];
      if (alert.alertId === alertId && !alert.resolved) {
        alert.acknowledgedBy = acknowledgedBy;
        this.homey.log('[WaterLeak] Alert acknowledged: ' + alertId + ' by ' + acknowledgedBy);
        return { success: true, alertId: alertId, acknowledgedBy: acknowledgedBy };
      }
    }
    return { success: false, error: 'Alert not found or already resolved: ' + alertId };
  }

  /**
   * Get estimated water usage by fixture type based on flow patterns.
   * @returns {{ success: boolean, estimates: object }}
   */
  getFixtureUsageEstimates() {
    var patterns = this.flowMonitoring.fixturePatterns;
    var keys = Object.keys(patterns);
    var estimates = {};
    for (var i = 0; i < keys.length; i++) {
      var p = patterns[keys[i]];
      var avgFlow = (p.minFlow + p.maxFlow) / 2;
      var litersPerUse = avgFlow * p.typicalDuration;
      estimates[keys[i]] = {
        avgFlowRate: avgFlow,
        typicalDurationMinutes: p.typicalDuration,
        litersPerUse: Math.round(litersPerUse),
        costPerUseSEK: Math.round((litersPerUse / 1000) * this.usageAnalytics.costPerCubicMeter * 100) / 100
      };
    }
    return { success: true, estimates: estimates };
  }

  /**
   * Enable or disable freeze protection.
   * @param {boolean} enabled - Whether freeze protection is enabled.
   * @returns {{ success: boolean, enabled: boolean }}
   */
  setFreezeProtection(enabled) {
    this.freezeProtection.enabled = !!enabled;
    this.homey.log('[WaterLeak] Freeze protection ' + (enabled ? 'enabled' : 'disabled'));
    if (!enabled) {
      for (var i = 0; i < this.freezeProtection.heatTapeZones.length; i++) {
        this.freezeProtection.heatTapeZones[i].status = 'off';
      }
      this.freezeProtection.keepDrippingMode = false;
    }
    return { success: true, enabled: this.freezeProtection.enabled };
  }

  /**
   * Add an emergency contact.
   * @param {object} contact - Contact definition.
   * @param {string} contact.name - Contact name.
   * @param {string} contact.phone - Phone number.
   * @param {boolean} [contact.sms=true] - Enable SMS alerts.
   * @param {boolean} [contact.call=false] - Enable call alerts.
   * @returns {{ success: boolean, contacts?: number, error?: string }}
   */
  addEmergencyContact(contact) {
    if (!contact || !contact.name || !contact.phone) {
      return { success: false, error: 'Missing required fields: name, phone' };
    }
    this.alertSystem.emergencyContacts.push({
      name: contact.name,
      phone: contact.phone,
      sms: contact.sms !== false,
      call: contact.call === true
    });
    this.homey.log('[WaterLeak] Emergency contact added: ' + contact.name);
    return { success: true, contacts: this.alertSystem.emergencyContacts.length };
  }

  /**
   * Remove an emergency contact by index.
   * @param {number} index - Index of the contact to remove.
   * @returns {{ success: boolean, error?: string }}
   */
  removeEmergencyContact(index) {
    if (index < 0 || index >= this.alertSystem.emergencyContacts.length) {
      return { success: false, error: 'Invalid contact index' };
    }
    var removed = this.alertSystem.emergencyContacts.splice(index, 1);
    this.homey.log('[WaterLeak] Emergency contact removed: ' + removed[0].name);
    return { success: true, removed: removed[0].name, remaining: this.alertSystem.emergencyContacts.length };
  }

  // ─── Utility Methods ──────────────────────────────────────────

  /**
   * Add days to an ISO date string.
   * @param {string} isoDate - ISO date string.
   * @param {number} days - Number of days to add.
   * @returns {string} New ISO date string.
   * @private
   */
  _addDays(isoDate, days) {
    var d = new Date(isoDate);
    d.setDate(d.getDate() + days);
    return d.toISOString();
  }

  /**
   * Get ISO week number for a date.
   * @param {Date} date - The date.
   * @returns {number} Week number (1-53).
   * @private
   */
  _getWeekNumber(date) {
    var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    var dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  /**
   * Destroy the system, clear all intervals and reset state.
   */
  destroy() {
    this.homey.log('[WaterLeak] Destroying water leak protection system...');
    for (var i = 0; i < this.intervals.length; i++) {
      clearInterval(this.intervals[i]);
    }
    this.intervals = [];
    // Close no valves on destroy — leave them in their current state for safety
    this.alertSystem.activeAlerts = [];
    this.flowMonitoring.flowHistory = [];
    this.pressureMonitoring.pressureHistory = [];
    this.initialized = false;
    this.homey.log('[WaterLeak] destroyed');
  }
}

module.exports = HomeWaterLeakProtectionSystem;
