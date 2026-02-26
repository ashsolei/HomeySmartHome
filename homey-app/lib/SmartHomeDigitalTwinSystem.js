'use strict';

class SmartHomeDigitalTwinSystem {

  constructor(homey) {
    this.homey = homey;

    // Multi-property support
    this.properties = new Map();
    this.properties.set('home', {
      id: 'home',
      label: 'Primary Home',
      type: 'primary',
      address: '',
      timezone: 'Europe/Amsterdam',
      createdAt: Date.now()
    });
    this.properties.set('vacation_house', {
      id: 'vacation_house',
      label: 'Vacation House',
      type: 'vacation',
      address: '',
      timezone: 'Europe/Amsterdam',
      createdAt: Date.now()
    });
    this.properties.set('rental', {
      id: 'rental',
      label: 'Rental Property',
      type: 'rental',
      address: '',
      timezone: 'Europe/Amsterdam',
      createdAt: Date.now()
    });

    // Rooms with defaults
    this.rooms = new Map();
    const defaultRooms = [
      { id: 'living_room', label: 'Living Room', floor: 0, area_m2: 25 },
      { id: 'kitchen', label: 'Kitchen', floor: 0, area_m2: 15 },
      { id: 'bedroom', label: 'Bedroom', floor: 1, area_m2: 18 },
      { id: 'bathroom', label: 'Bathroom', floor: 1, area_m2: 8 },
      { id: 'hallway', label: 'Hallway', floor: 0, area_m2: 10 },
      { id: 'office', label: 'Office', floor: 1, area_m2: 12 },
      { id: 'garage', label: 'Garage', floor: 0, area_m2: 20 },
      { id: 'garden', label: 'Garden', floor: 0, area_m2: 100 }
    ];

    for (const room of defaultRooms) {
      this.rooms.set(room.id, {
        id: room.id,
        label: room.label,
        floor: room.floor,
        area_m2: room.area_m2,
        devices: [],
        sensors: {
          temp: { value: 20.0, unit: '°C', lastUpdated: null, history: [] },
          humidity: { value: 50.0, unit: '%', lastUpdated: null, history: [] },
          light: { value: 300, unit: 'lux', lastUpdated: null, history: [] },
          motion: { value: false, unit: 'boolean', lastUpdated: null, history: [] },
          co2: { value: 400, unit: 'ppm', lastUpdated: null, history: [] }
        },
        propertyId: 'home'
      });
    }

    // Device state tracking
    this.deviceStates = new Map();

    // Energy flow tracking
    this.energyFlow = {
      solar_production: 0,
      battery_charge: 0,
      grid_import: 0,
      grid_export: 0,
      consumption: 0,
      history: [],
      lastUpdated: null
    };

    // Occupancy data per room with hourly buckets
    this.occupancyData = new Map();
    for (const roomId of this.rooms.keys()) {
      this.occupancyData.set(roomId, {
        hourlyBuckets: this._createEmptyHourlyBuckets(),
        currentCount: 0,
        lastUpdated: null,
        dailyHistory: []
      });
    }

    // State history for snapshots
    this.stateHistory = [];

    // Device groups
    this.deviceGroups = new Map();

    // Monitoring interval reference
    this._monitoringInterval = null;

    // Settings
    this._settings = {
      snapshotIntervalMinutes: 15,
      anomalyStdDevMultiplier: 2,
      historyRetentionDays: 7,
      maxHistoryEntries: 672,
      comfortWeights: {
        temp: 0.40,
        humidity: 0.25,
        light: 0.20,
        airQuality: 0.15
      },
      idealRanges: {
        temp: { min: 19, max: 23 },
        humidity: { min: 40, max: 60 },
        light: { min: 200, max: 500 },
        co2: { min: 350, max: 800 }
      }
    };

    this._initialized = false;
  }

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------

  async initialize() {
    try {
      if (this._initialized) {
        this.log('Already initialized');
        return;
      }

      this.log('Initializing Smart Home Digital Twin System...');

      try {
        await this._loadSettings();
        await this._restoreState();
        this._startMonitoringLoop();
        this._initialized = true;
        this.log('Initialization complete');
      } catch (err) {
        this.error('Initialization failed: ' + err.message);
        throw err;
      }
    } catch (error) {
      this.homey.error(`[SmartHomeDigitalTwinSystem] Failed to initialize:`, error.message);
    }
  }

  // ---------------------------------------------------------------------------
  // Room Management
  // ---------------------------------------------------------------------------

  addRoom(roomId, label, floor, area_m2, propertyId) {
    if (this.rooms.has(roomId)) {
      this.log('Room already exists: ' + roomId);
      return this.rooms.get(roomId);
    }

    const room = {
      id: roomId,
      label: label || roomId,
      floor: floor || 0,
      area_m2: area_m2 || 10,
      devices: [],
      sensors: {
        temp: { value: 20.0, unit: '°C', lastUpdated: null, history: [] },
        humidity: { value: 50.0, unit: '%', lastUpdated: null, history: [] },
        light: { value: 300, unit: 'lux', lastUpdated: null, history: [] },
        motion: { value: false, unit: 'boolean', lastUpdated: null, history: [] },
        co2: { value: 400, unit: 'ppm', lastUpdated: null, history: [] }
      },
      propertyId: propertyId || 'home'
    };

    this.rooms.set(roomId, room);

    this.occupancyData.set(roomId, {
      hourlyBuckets: this._createEmptyHourlyBuckets(),
      currentCount: 0,
      lastUpdated: null,
      dailyHistory: []
    });

    this.log('Added room: ' + roomId + ' (' + area_m2 + 'm²)');
    return room;
  }

  removeRoom(roomId) {
    if (!this.rooms.has(roomId)) {
      this.log('Room not found: ' + roomId);
      return false;
    }
    this.rooms.delete(roomId);
    this.occupancyData.delete(roomId);
    this.log('Removed room: ' + roomId);
    return true;
  }

  getRoom(roomId) {
    return this.rooms.get(roomId) || null;
  }

  listRooms(propertyId) {
    const result = [];
    for (const [id, room] of this.rooms) {
      if (!propertyId || room.propertyId === propertyId) {
        result.push({
          id: id,
          label: room.label,
          floor: room.floor,
          area_m2: room.area_m2,
          deviceCount: room.devices.length,
          propertyId: room.propertyId
        });
      }
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // Sensor Data
  // ---------------------------------------------------------------------------

  updateSensorData(roomId, sensorType, value) {
    const room = this.rooms.get(roomId);
    if (!room) {
      this.error('Room not found for sensor update: ' + roomId);
      return null;
    }

    const sensor = room.sensors[sensorType];
    if (!sensor) {
      this.error('Unknown sensor type: ' + sensorType);
      return null;
    }

    const now = Date.now();
    const previousValue = sensor.value;

    sensor.value = value;
    sensor.lastUpdated = now;

    // Store in history for anomaly detection (keep 7 days of data)
    sensor.history.push({ value: value, timestamp: now });
    const retentionMs = this._settings.historyRetentionDays * 24 * 60 * 60 * 1000;
    while (sensor.history.length > 0 && sensor.history[0].timestamp < now - retentionMs) {
      sensor.history.shift();
    }

    this.log('Sensor updated: ' + roomId + '/' + sensorType + ' = ' + value + ' (was ' + previousValue + ')');
    return {
      roomId: roomId,
      sensorType: sensorType,
      previousValue: previousValue,
      newValue: value,
      timestamp: now
    };
  }

  getSensorOverlay(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      this.error('Room not found for sensor overlay: ' + roomId);
      return null;
    }

    const overlay = {
      roomId: roomId,
      label: room.label,
      area_m2: room.area_m2,
      sensors: {}
    };

    for (const [type, sensor] of Object.entries(room.sensors)) {
      const status = this._evaluateSensorStatus(type, sensor.value);
      overlay.sensors[type] = {
        value: sensor.value,
        unit: sensor.unit,
        status: status,
        lastUpdated: sensor.lastUpdated,
        historyCount: sensor.history.length
      };
    }

    return overlay;
  }

  _evaluateSensorStatus(sensorType, value) {
    const ranges = this._settings.idealRanges;
    if (sensorType === 'temp') {
      if (value >= ranges.temp.min && value <= ranges.temp.max) return 'optimal';
      if (value >= ranges.temp.min - 3 && value <= ranges.temp.max + 3) return 'acceptable';
      return 'warning';
    }
    if (sensorType === 'humidity') {
      if (value >= ranges.humidity.min && value <= ranges.humidity.max) return 'optimal';
      if (value >= ranges.humidity.min - 10 && value <= ranges.humidity.max + 10) return 'acceptable';
      return 'warning';
    }
    if (sensorType === 'light') {
      if (value >= ranges.light.min && value <= ranges.light.max) return 'optimal';
      if (value >= 50 && value <= 1000) return 'acceptable';
      return 'warning';
    }
    if (sensorType === 'co2') {
      if (value >= ranges.co2.min && value <= ranges.co2.max) return 'optimal';
      if (value < 1000) return 'acceptable';
      return 'warning';
    }
    if (sensorType === 'motion') {
      return value ? 'detected' : 'clear';
    }
    return 'unknown';
  }

  // ---------------------------------------------------------------------------
  // Device State Tracking
  // ---------------------------------------------------------------------------

  registerDevice(deviceId, type, roomId) {
    this.deviceStates.set(deviceId, {
      id: deviceId,
      type: type,
      roomId: roomId,
      state: {},
      lastSeen: Date.now(),
      errorCount: 0,
      lastError: null
    });

    const room = this.rooms.get(roomId);
    if (room && !room.devices.includes(deviceId)) {
      room.devices.push(deviceId);
    }

    this.log('Registered device: ' + deviceId + ' (' + type + ') in ' + roomId);
    return this.deviceStates.get(deviceId);
  }

  updateDeviceState(deviceId, state) {
    let device = this.deviceStates.get(deviceId);
    if (!device) {
      device = {
        id: deviceId,
        type: 'unknown',
        roomId: 'unknown',
        state: {},
        lastSeen: Date.now(),
        errorCount: 0,
        lastError: null
      };
      this.deviceStates.set(deviceId, device);
    }

    const previousState = Object.assign({}, device.state);
    Object.assign(device.state, state);
    device.lastSeen = Date.now();

    this.log('Device state updated: ' + deviceId + ' -> ' + JSON.stringify(state));
    return {
      deviceId: deviceId,
      previousState: previousState,
      newState: device.state,
      timestamp: device.lastSeen
    };
  }

  getDeviceStateSummary() {
    const summary = {
      lights: { on: 0, off: 0, total: 0 },
      doors: { locked: 0, unlocked: 0, total: 0 },
      blinds: { open: 0, closed: 0, total: 0 },
      totalDevices: this.deviceStates.size,
      lastUpdated: Date.now()
    };

    for (const [, device] of this.deviceStates) {
      const type = (device.type || '').toLowerCase();
      const state = device.state || {};

      if (type === 'light' || type === 'lamp' || type === 'bulb') {
        summary.lights.total++;
        if (state.on === true || state.onoff === true) {
          summary.lights.on++;
        } else {
          summary.lights.off++;
        }
      }

      if (type === 'door' || type === 'lock' || type === 'door_lock') {
        summary.doors.total++;
        if (state.locked === true || state.lock === true) {
          summary.doors.locked++;
        } else {
          summary.doors.unlocked++;
        }
      }

      if (type === 'blind' || type === 'shade' || type === 'curtain') {
        summary.blinds.total++;
        if (state.open === true || state.position > 50) {
          summary.blinds.open++;
        } else {
          summary.blinds.closed++;
        }
      }
    }

    return summary;
  }

  // ---------------------------------------------------------------------------
  // Energy Flow
  // ---------------------------------------------------------------------------

  updateEnergyFlow(data) {
    const now = Date.now();

    if (data.solar_production !== undefined) {
      this.energyFlow.solar_production = data.solar_production;
    }
    if (data.battery_charge !== undefined) {
      this.energyFlow.battery_charge = data.battery_charge;
    }
    if (data.grid_import !== undefined) {
      this.energyFlow.grid_import = data.grid_import;
    }
    if (data.grid_export !== undefined) {
      this.energyFlow.grid_export = data.grid_export;
    }
    if (data.consumption !== undefined) {
      this.energyFlow.consumption = data.consumption;
    }

    this.energyFlow.lastUpdated = now;

    // Record in history
    this.energyFlow.history.push({
      solar_production: this.energyFlow.solar_production,
      battery_charge: this.energyFlow.battery_charge,
      grid_import: this.energyFlow.grid_import,
      grid_export: this.energyFlow.grid_export,
      consumption: this.energyFlow.consumption,
      timestamp: now
    });

    // Retain only last 24 hours of 5-min samples (288 entries)
    while (this.energyFlow.history.length > 288) {
      this.energyFlow.history.shift();
    }

    return this.energyFlow;
  }

  modelEnergyFlow() {
    const flow = {
      nodes: [],
      edges: [],
      timestamp: Date.now()
    };

    // Source nodes
    flow.nodes.push({ id: 'solar', type: 'source', label: 'Solar Panels', value: this.energyFlow.solar_production });
    flow.nodes.push({ id: 'grid_in', type: 'source', label: 'Grid Import', value: this.energyFlow.grid_import });
    flow.nodes.push({ id: 'battery', type: 'storage', label: 'Battery', value: this.energyFlow.battery_charge });

    // Consumption node
    flow.nodes.push({ id: 'consumption', type: 'sink', label: 'Home Consumption', value: this.energyFlow.consumption });
    flow.nodes.push({ id: 'grid_out', type: 'sink', label: 'Grid Export', value: this.energyFlow.grid_export });

    // Room consumption breakdown
    for (const [roomId, room] of this.rooms) {
      const deviceCount = room.devices.length;
      const estimatedConsumption = deviceCount > 0
        ? (this.energyFlow.consumption / Math.max(this.rooms.size, 1)) * (deviceCount / Math.max(this._getTotalDeviceCount(), 1)) * this.rooms.size
        : 0;

      flow.nodes.push({
        id: 'room_' + roomId,
        type: 'room',
        label: room.label,
        value: Math.round(estimatedConsumption * 100) / 100
      });

      flow.edges.push({
        from: 'consumption',
        to: 'room_' + roomId,
        value: Math.round(estimatedConsumption * 100) / 100,
        label: 'Consumption'
      });
    }

    // Edges from sources to consumption
    if (this.energyFlow.solar_production > 0) {
      const solarToHome = Math.min(this.energyFlow.solar_production, this.energyFlow.consumption);
      flow.edges.push({ from: 'solar', to: 'consumption', value: solarToHome, label: 'Solar → Home' });

      const solarToBattery = Math.max(0, this.energyFlow.solar_production - solarToHome - this.energyFlow.grid_export);
      if (solarToBattery > 0) {
        flow.edges.push({ from: 'solar', to: 'battery', value: solarToBattery, label: 'Solar → Battery' });
      }

      if (this.energyFlow.grid_export > 0) {
        flow.edges.push({ from: 'solar', to: 'grid_out', value: this.energyFlow.grid_export, label: 'Solar → Grid' });
      }
    }

    if (this.energyFlow.grid_import > 0) {
      flow.edges.push({ from: 'grid_in', to: 'consumption', value: this.energyFlow.grid_import, label: 'Grid → Home' });
    }

    const batteryDischarge = Math.max(0, this.energyFlow.consumption - this.energyFlow.solar_production - this.energyFlow.grid_import);
    if (batteryDischarge > 0 && this.energyFlow.battery_charge > 0) {
      flow.edges.push({ from: 'battery', to: 'consumption', value: batteryDischarge, label: 'Battery → Home' });
    }

    flow.summary = {
      selfConsumptionRate: this.energyFlow.solar_production > 0
        ? Math.round((1 - this.energyFlow.grid_export / this.energyFlow.solar_production) * 100)
        : 0,
      selfSufficiencyRate: this.energyFlow.consumption > 0
        ? Math.round(((this.energyFlow.consumption - this.energyFlow.grid_import) / this.energyFlow.consumption) * 100)
        : 0,
      netGridFlow: this.energyFlow.grid_export - this.energyFlow.grid_import
    };

    this.log('Energy flow model generated with ' + flow.nodes.length + ' nodes and ' + flow.edges.length + ' edges');
    return flow;
  }

  _getTotalDeviceCount() {
    let total = 0;
    for (const [, room] of this.rooms) {
      total += room.devices.length;
    }
    return total;
  }

  // ---------------------------------------------------------------------------
  // Occupancy Heatmap
  // ---------------------------------------------------------------------------

  recordOccupancy(roomId, count) {
    const data = this.occupancyData.get(roomId);
    if (!data) {
      this.error('Room not found for occupancy: ' + roomId);
      return null;
    }

    const now = new Date();
    const hour = now.getHours();

    data.hourlyBuckets[hour].count += count;
    data.hourlyBuckets[hour].samples++;
    data.currentCount = count;
    data.lastUpdated = Date.now();

    this.log('Occupancy recorded: ' + roomId + ' = ' + count + ' (hour ' + hour + ')');
    return {
      roomId: roomId,
      count: count,
      hour: hour,
      averageForHour: data.hourlyBuckets[hour].samples > 0
        ? Math.round((data.hourlyBuckets[hour].count / data.hourlyBuckets[hour].samples) * 100) / 100
        : 0
    };
  }

  generateHeatmap(period) {
    const heatmap = {
      period: period || '24h',
      rooms: {},
      generatedAt: Date.now()
    };

    for (const [roomId, data] of this.occupancyData) {
      const room = this.rooms.get(roomId);
      if (!room) continue;

      const hourlyAverages = [];
      let peakHour = 0;
      let peakValue = 0;

      for (let h = 0; h < 24; h++) {
        const bucket = data.hourlyBuckets[h];
        const avg = bucket.samples > 0
          ? Math.round((bucket.count / bucket.samples) * 100) / 100
          : 0;

        hourlyAverages.push(avg);

        if (avg > peakValue) {
          peakValue = avg;
          peakHour = h;
        }
      }

      const totalOccupancy = hourlyAverages.reduce((sum, v) => sum + v, 0);
      const occupancyDensity = room.area_m2 > 0
        ? Math.round((totalOccupancy / room.area_m2) * 100) / 100
        : 0;

      heatmap.rooms[roomId] = {
        label: room.label,
        area_m2: room.area_m2,
        hourlyAverages: hourlyAverages,
        currentCount: data.currentCount,
        peakHour: peakHour,
        peakValue: peakValue,
        occupancyDensity: occupancyDensity,
        intensity: this._mapOccupancyIntensity(peakValue)
      };
    }

    this.log('Heatmap generated for ' + Object.keys(heatmap.rooms).length + ' rooms');
    return heatmap;
  }

  _mapOccupancyIntensity(peakValue) {
    if (peakValue <= 0) return 'none';
    if (peakValue <= 1) return 'low';
    if (peakValue <= 3) return 'medium';
    if (peakValue <= 5) return 'high';
    return 'very_high';
  }

  _createEmptyHourlyBuckets() {
    const buckets = [];
    for (let h = 0; h < 24; h++) {
      buckets.push({ hour: h, count: 0, samples: 0 });
    }
    return buckets;
  }

  // ---------------------------------------------------------------------------
  // What-if Simulation
  // ---------------------------------------------------------------------------

  simulateChange(type, params) {
    const simulation = {
      type: type,
      params: params,
      timestamp: Date.now(),
      result: null
    };

    switch (type) {
      case 'add_insulation': {
        const currentHeating = params.currentHeatingKwh || 5000;
        const insulationQuality = params.quality || 'standard';
        let reductionPercent = 0;

        if (insulationQuality === 'basic') {
          reductionPercent = 15;
        } else if (insulationQuality === 'standard') {
          reductionPercent = 25;
        } else if (insulationQuality === 'premium') {
          reductionPercent = 40;
        }

        const savedKwh = Math.round(currentHeating * (reductionPercent / 100));
        const savingsEuro = Math.round(savedKwh * 0.25 * 100) / 100;

        simulation.result = {
          reductionPercent: reductionPercent,
          savedKwhPerYear: savedKwh,
          newHeatingKwh: currentHeating - savedKwh,
          estimatedSavingsEuro: savingsEuro,
          paybackYears: params.cost ? Math.round((params.cost / savingsEuro) * 10) / 10 : null,
          co2ReductionKg: Math.round(savedKwh * 0.4)
        };
        break;
      }

      case 'change_thermostat': {
        const currentTemp = params.currentTemp || 21;
        const newTemp = params.newTemp || 20;
        const diff = currentTemp - newTemp;
        const impactPerDegree = 7;
        const energyImpactPercent = Math.round(diff * impactPerDegree);
        const currentConsumption = params.currentConsumptionKwh || 4000;
        const savedKwh = Math.round(currentConsumption * (energyImpactPercent / 100));

        simulation.result = {
          temperatureChange: diff,
          energyImpactPercent: energyImpactPercent,
          savedKwhPerYear: savedKwh,
          newConsumptionKwh: currentConsumption - savedKwh,
          estimatedSavingsEuro: Math.round(savedKwh * 0.25 * 100) / 100,
          comfortImpact: Math.abs(diff) <= 1 ? 'minimal' : Math.abs(diff) <= 2 ? 'moderate' : 'significant',
          co2ReductionKg: Math.round(savedKwh * 0.4)
        };
        break;
      }

      case 'add_solar': {
        const panelCount = params.panels || 10;
        const panelWattPeak = params.wattPeakPerPanel || 400;
        const totalWp = panelCount * panelWattPeak;
        const roofOrientation = params.orientation || 'south';
        let efficiencyFactor = 0.85;

        if (roofOrientation === 'south') {
          efficiencyFactor = 1.0;
        } else if (roofOrientation === 'east' || roofOrientation === 'west') {
          efficiencyFactor = 0.8;
        } else if (roofOrientation === 'southeast' || roofOrientation === 'southwest') {
          efficiencyFactor = 0.95;
        } else {
          efficiencyFactor = 0.6;
        }

        const kWhPerYear = Math.round(totalWp * 0.9 * efficiencyFactor);
        const revenuePerYear = Math.round(kWhPerYear * 0.25 * 100) / 100;
        const installCost = params.installCost || (panelCount * 450);

        simulation.result = {
          totalWattPeak: totalWp,
          estimatedProductionKwhYear: kWhPerYear,
          efficiencyFactor: efficiencyFactor,
          estimatedRevenueEuroYear: revenuePerYear,
          installationCost: installCost,
          paybackYears: Math.round((installCost / revenuePerYear) * 10) / 10,
          co2SavingKgYear: Math.round(kWhPerYear * 0.4),
          lifetimeSavingsEuro25yr: Math.round(revenuePerYear * 25)
        };
        break;
      }

      case 'switch_to_led': {
        const bulbCount = params.bulbs || 20;
        const oldWattage = params.oldWattPerBulb || 60;
        const ledWattage = params.ledWattPerBulb || 9;
        const hoursPerDay = params.avgHoursPerDay || 5;

        const oldConsumptionYear = Math.round(bulbCount * oldWattage * hoursPerDay * 365 / 1000);
        const newConsumptionYear = Math.round(bulbCount * ledWattage * hoursPerDay * 365 / 1000);
        const savings = oldConsumptionYear - newConsumptionYear;
        const savingsEuro = Math.round(savings * 0.25 * 100) / 100;
        const ledBulbCost = params.costPerBulb || 5;

        simulation.result = {
          oldConsumptionKwhYear: oldConsumptionYear,
          newConsumptionKwhYear: newConsumptionYear,
          savingsKwhYear: savings,
          savingsPercent: Math.round((savings / oldConsumptionYear) * 100),
          estimatedSavingsEuro: savingsEuro,
          totalBulbCost: bulbCount * ledBulbCost,
          paybackMonths: Math.round((bulbCount * ledBulbCost) / (savingsEuro / 12)),
          co2ReductionKg: Math.round(savings * 0.4)
        };
        break;
      }

      default:
        this.error('Unknown simulation type: ' + type);
        simulation.result = { error: 'Unknown simulation type: ' + type };
    }

    this.log('Simulation completed: ' + type);
    return simulation;
  }

  // ---------------------------------------------------------------------------
  // Anomaly Detection
  // ---------------------------------------------------------------------------

  detectAnomalies(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      this.error('Room not found for anomaly detection: ' + roomId);
      return null;
    }

    const anomalies = {
      roomId: roomId,
      label: room.label,
      detectedAt: Date.now(),
      anomalies: [],
      checked: []
    };

    const multiplier = this._settings.anomalyStdDevMultiplier;

    for (const [sensorType, sensor] of Object.entries(room.sensors)) {
      if (sensorType === 'motion') {
        anomalies.checked.push(sensorType);
        continue;
      }

      const history = sensor.history || [];
      if (history.length < 10) {
        anomalies.checked.push(sensorType);
        continue;
      }

      const values = history.map(entry => entry.value);
      const mean = this._calculateMean(values);
      const stddev = this._calculateStdDev(values, mean);

      const currentValue = sensor.value;
      const upperBound = mean + multiplier * stddev;
      const lowerBound = mean - multiplier * stddev;

      anomalies.checked.push(sensorType);

      if (currentValue > upperBound || currentValue < lowerBound) {
        anomalies.anomalies.push({
          sensorType: sensorType,
          currentValue: currentValue,
          mean: Math.round(mean * 100) / 100,
          stddev: Math.round(stddev * 100) / 100,
          upperBound: Math.round(upperBound * 100) / 100,
          lowerBound: Math.round(lowerBound * 100) / 100,
          deviation: Math.round(Math.abs(currentValue - mean) / (stddev || 1) * 100) / 100,
          direction: currentValue > upperBound ? 'above' : 'below',
          severity: Math.abs(currentValue - mean) > 3 * stddev ? 'critical' : 'warning'
        });
      }
    }

    if (anomalies.anomalies.length > 0) {
      this.log('Anomalies detected in ' + roomId + ': ' + anomalies.anomalies.length);
    }

    return anomalies;
  }

  detectAllAnomalies() {
    const results = {};
    for (const roomId of this.rooms.keys()) {
      const roomAnomalies = this.detectAnomalies(roomId);
      if (roomAnomalies && roomAnomalies.anomalies.length > 0) {
        results[roomId] = roomAnomalies;
      }
    }
    return results;
  }

  _calculateMean(values) {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  _calculateStdDev(values, mean) {
    if (values.length < 2) return 0;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }

  // ---------------------------------------------------------------------------
  // State History & Snapshots
  // ---------------------------------------------------------------------------

  captureSnapshot() {
    const snapshot = {
      timestamp: Date.now(),
      rooms: {},
      deviceSummary: this.getDeviceStateSummary(),
      energyFlow: {
        solar_production: this.energyFlow.solar_production,
        battery_charge: this.energyFlow.battery_charge,
        grid_import: this.energyFlow.grid_import,
        grid_export: this.energyFlow.grid_export,
        consumption: this.energyFlow.consumption
      },
      occupancy: {}
    };

    for (const [roomId, room] of this.rooms) {
      snapshot.rooms[roomId] = {
        label: room.label,
        sensors: {}
      };
      for (const [sensorType, sensor] of Object.entries(room.sensors)) {
        snapshot.rooms[roomId].sensors[sensorType] = {
          value: sensor.value,
          lastUpdated: sensor.lastUpdated
        };
      }

      const occData = this.occupancyData.get(roomId);
      if (occData) {
        snapshot.occupancy[roomId] = occData.currentCount;
      }
    }

    this.stateHistory.push(snapshot);

    // Limit history length
    while (this.stateHistory.length > this._settings.maxHistoryEntries) {
      this.stateHistory.shift();
    }

    this.log('Snapshot captured (total: ' + this.stateHistory.length + ')');
    return snapshot;
  }

  getStateAtTime(timestamp) {
    if (this.stateHistory.length === 0) {
      return null;
    }

    // Find the closest snapshot at or before the requested time
    let closest = null;
    let closestDiff = Infinity;

    for (const snapshot of this.stateHistory) {
      const diff = Math.abs(snapshot.timestamp - timestamp);
      if (diff < closestDiff) {
        closestDiff = diff;
        closest = snapshot;
      }
    }

    if (closest) {
      return {
        requested: timestamp,
        actual: closest.timestamp,
        diffMs: closestDiff,
        snapshot: closest
      };
    }

    return null;
  }

  getHistoryRange(startTime, endTime) {
    return this.stateHistory.filter(
      snapshot => snapshot.timestamp >= startTime && snapshot.timestamp <= endTime
    );
  }

  // ---------------------------------------------------------------------------
  // Comfort Score
  // ---------------------------------------------------------------------------

  calculateComfortScore(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      this.error('Room not found for comfort score: ' + roomId);
      return null;
    }

    const weights = this._settings.comfortWeights;
    const ranges = this._settings.idealRanges;

    // Temperature score (0-100)
    const tempScore = this._rangeScore(
      room.sensors.temp.value,
      ranges.temp.min,
      ranges.temp.max,
      5
    );

    // Humidity score (0-100)
    const humidityScore = this._rangeScore(
      room.sensors.humidity.value,
      ranges.humidity.min,
      ranges.humidity.max,
      20
    );

    // Light score (0-100)
    const lightScore = this._rangeScore(
      room.sensors.light.value,
      ranges.light.min,
      ranges.light.max,
      300
    );

    // Air quality score (0-100) based on CO2
    const airQualityScore = this._inverseScore(
      room.sensors.co2.value,
      ranges.co2.min,
      ranges.co2.max,
      1500
    );

    const weightedScore = Math.round(
      tempScore * weights.temp +
      humidityScore * weights.humidity +
      lightScore * weights.light +
      airQualityScore * weights.airQuality
    );

    const overall = Math.max(0, Math.min(100, weightedScore));

    return {
      roomId: roomId,
      label: room.label,
      overall: overall,
      breakdown: {
        temperature: { score: tempScore, value: room.sensors.temp.value, weight: weights.temp },
        humidity: { score: humidityScore, value: room.sensors.humidity.value, weight: weights.humidity },
        light: { score: lightScore, value: room.sensors.light.value, weight: weights.light },
        airQuality: { score: airQualityScore, value: room.sensors.co2.value, weight: weights.airQuality }
      },
      rating: overall >= 80 ? 'excellent' : overall >= 60 ? 'good' : overall >= 40 ? 'fair' : 'poor',
      timestamp: Date.now()
    };
  }

  _rangeScore(value, min, max, tolerance) {
    if (value >= min && value <= max) {
      return 100;
    }
    const distance = value < min ? min - value : value - max;
    const score = Math.max(0, 100 - (distance / tolerance) * 100);
    return Math.round(score);
  }

  _inverseScore(value, min, max, ceiling) {
    if (value <= max) {
      return 100;
    }
    const excess = value - max;
    const range = ceiling - max;
    if (range <= 0) return 0;
    const score = Math.max(0, 100 - (excess / range) * 100);
    return Math.round(score);
  }

  // ---------------------------------------------------------------------------
  // Energy Efficiency per Room
  // ---------------------------------------------------------------------------

  calculateRoomEfficiency(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      this.error('Room not found for efficiency: ' + roomId);
      return null;
    }

    const deviceCount = room.devices.length;
    if (deviceCount === 0) {
      return {
        roomId: roomId,
        label: room.label,
        area_m2: room.area_m2,
        kwhPerM2: 0,
        estimatedConsumption: 0,
        rating: 'no_data',
        timestamp: Date.now()
      };
    }

    // Estimate per-room consumption as proportional share
    const totalDevices = this._getTotalDeviceCount();
    const roomShare = totalDevices > 0 ? deviceCount / totalDevices : 0;
    const estimatedConsumption = this.energyFlow.consumption * roomShare;
    const kwhPerM2 = room.area_m2 > 0
      ? Math.round((estimatedConsumption / room.area_m2) * 1000) / 1000
      : 0;

    let rating = 'efficient';
    if (kwhPerM2 > 0.5) rating = 'high';
    else if (kwhPerM2 > 0.2) rating = 'moderate';
    else if (kwhPerM2 > 0.05) rating = 'efficient';
    else rating = 'minimal';

    return {
      roomId: roomId,
      label: room.label,
      area_m2: room.area_m2,
      deviceCount: deviceCount,
      estimatedConsumptionW: Math.round(estimatedConsumption * 100) / 100,
      kwhPerM2: kwhPerM2,
      rating: rating,
      timestamp: Date.now()
    };
  }

  calculateOverallEfficiency() {
    const results = {};
    let totalConsumption = 0;
    let totalArea = 0;

    for (const roomId of this.rooms.keys()) {
      const eff = this.calculateRoomEfficiency(roomId);
      if (eff) {
        results[roomId] = eff;
        totalConsumption += eff.estimatedConsumptionW;
        totalArea += eff.area_m2;
      }
    }

    return {
      rooms: results,
      totalConsumptionW: Math.round(totalConsumption * 100) / 100,
      totalArea: totalArea,
      overallKwhPerM2: totalArea > 0
        ? Math.round((totalConsumption / totalArea) * 1000) / 1000
        : 0,
      timestamp: Date.now()
    };
  }

  // ---------------------------------------------------------------------------
  // Device Groups
  // ---------------------------------------------------------------------------

  createGroup(name, deviceIds) {
    if (this.deviceGroups.has(name)) {
      this.log('Group already exists, updating: ' + name);
    }

    const validDeviceIds = deviceIds.filter(id => {
      if (!this.deviceStates.has(id)) {
        this.log('Warning: device not registered: ' + id);
      }
      return true;
    });

    this.deviceGroups.set(name, {
      name: name,
      deviceIds: validDeviceIds,
      createdAt: Date.now(),
      lastUpdated: Date.now()
    });

    this.log('Device group created: ' + name + ' with ' + validDeviceIds.length + ' devices');
    return this.deviceGroups.get(name);
  }

  addToGroup(groupName, deviceId) {
    const group = this.deviceGroups.get(groupName);
    if (!group) {
      this.error('Group not found: ' + groupName);
      return false;
    }

    if (!group.deviceIds.includes(deviceId)) {
      group.deviceIds.push(deviceId);
      group.lastUpdated = Date.now();
      this.log('Added ' + deviceId + ' to group ' + groupName);
    }

    return true;
  }

  removeFromGroup(groupName, deviceId) {
    const group = this.deviceGroups.get(groupName);
    if (!group) {
      this.error('Group not found: ' + groupName);
      return false;
    }

    const idx = group.deviceIds.indexOf(deviceId);
    if (idx >= 0) {
      group.deviceIds.splice(idx, 1);
      group.lastUpdated = Date.now();
      this.log('Removed ' + deviceId + ' from group ' + groupName);
    }

    return true;
  }

  deleteGroup(groupName) {
    if (!this.deviceGroups.has(groupName)) {
      return false;
    }
    this.deviceGroups.delete(groupName);
    this.log('Deleted group: ' + groupName);
    return true;
  }

  getGroupState(groupName) {
    const group = this.deviceGroups.get(groupName);
    if (!group) {
      this.error('Group not found: ' + groupName);
      return null;
    }

    const states = [];
    let onlineCount = 0;
    let offlineCount = 0;

    for (const deviceId of group.deviceIds) {
      const device = this.deviceStates.get(deviceId);
      if (device) {
        const staleThreshold = 30 * 60 * 1000; // 30 minutes
        const isOnline = device.lastSeen && (Date.now() - device.lastSeen) < staleThreshold;

        states.push({
          deviceId: deviceId,
          type: device.type,
          state: device.state,
          online: isOnline,
          lastSeen: device.lastSeen
        });

        if (isOnline) {
          onlineCount++;
        } else {
          offlineCount++;
        }
      } else {
        states.push({
          deviceId: deviceId,
          type: 'unknown',
          state: {},
          online: false,
          lastSeen: null
        });
        offlineCount++;
      }
    }

    return {
      groupName: groupName,
      deviceCount: group.deviceIds.length,
      onlineCount: onlineCount,
      offlineCount: offlineCount,
      devices: states,
      lastUpdated: group.lastUpdated
    };
  }

  listGroups() {
    const groups = [];
    for (const [name, group] of this.deviceGroups) {
      groups.push({
        name: name,
        deviceCount: group.deviceIds.length,
        createdAt: group.createdAt
      });
    }
    return groups;
  }

  // ---------------------------------------------------------------------------
  // Device Health Map
  // ---------------------------------------------------------------------------

  getDeviceHealthMap() {
    const healthMap = {
      devices: {},
      summary: { green: 0, yellow: 0, red: 0, total: 0 },
      timestamp: Date.now()
    };

    const staleThresholdYellow = 15 * 60 * 1000; // 15 minutes
    const staleThresholdRed = 60 * 60 * 1000; // 1 hour

    for (const [deviceId, device] of this.deviceStates) {
      const now = Date.now();
      const timeSinceLastSeen = device.lastSeen ? now - device.lastSeen : Infinity;
      let color = 'green';
      let status = 'healthy';
      const issues = [];

      if (timeSinceLastSeen > staleThresholdRed) {
        color = 'red';
        status = 'offline';
        issues.push('Not seen for over 1 hour');
      } else if (timeSinceLastSeen > staleThresholdYellow) {
        color = 'yellow';
        status = 'stale';
        issues.push('Not seen for over 15 minutes');
      }

      if (device.errorCount > 5) {
        color = 'red';
        status = 'error';
        issues.push('High error count: ' + device.errorCount);
      } else if (device.errorCount > 2) {
        if (color !== 'red') {
          color = 'yellow';
          status = 'warning';
        }
        issues.push('Moderate error count: ' + device.errorCount);
      }

      if (device.lastError && device.lastSeen) {
        const errorAge = now - device.lastError;
        if (errorAge < 5 * 60 * 1000) {
          if (color !== 'red') {
            color = 'yellow';
          }
          issues.push('Recent error detected');
        }
      }

      healthMap.devices[deviceId] = {
        deviceId: deviceId,
        type: device.type,
        roomId: device.roomId,
        color: color,
        status: status,
        issues: issues,
        lastSeen: device.lastSeen,
        errorCount: device.errorCount
      };

      healthMap.summary[color]++;
      healthMap.summary.total++;
    }

    this.log('Device health map: ' + healthMap.summary.green + ' green, ' +
      healthMap.summary.yellow + ' yellow, ' + healthMap.summary.red + ' red');

    return healthMap;
  }

  reportDeviceError(deviceId, errorMessage) {
    const device = this.deviceStates.get(deviceId);
    if (!device) {
      this.error('Device not found for error report: ' + deviceId);
      return false;
    }

    device.errorCount++;
    device.lastError = Date.now();
    this.log('Device error reported for ' + deviceId + ': ' + errorMessage);
    return true;
  }

  clearDeviceErrors(deviceId) {
    const device = this.deviceStates.get(deviceId);
    if (!device) {
      return false;
    }
    device.errorCount = 0;
    device.lastError = null;
    this.log('Cleared errors for device: ' + deviceId);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Monitoring Loop
  // ---------------------------------------------------------------------------

  _startMonitoringLoop() {
    const intervalMs = this._settings.snapshotIntervalMinutes * 60 * 1000;

    if (this._monitoringInterval) {
      clearInterval(this._monitoringInterval);
    }

    this._monitoringInterval = setInterval(() => {
      try {
        this.captureSnapshot();
        this._archiveDailyOccupancy();
      } catch (err) {
        this.error('Monitoring loop error: ' + err.message);
      }
    }, intervalMs);

    this.log('Monitoring loop started (' + this._settings.snapshotIntervalMinutes + ' min interval)');
  }

  _archiveDailyOccupancy() {
    const now = new Date();
    if (now.getHours() === 0 && now.getMinutes() < this._settings.snapshotIntervalMinutes) {
      for (const [_roomId, data] of this.occupancyData) {
        const dailySummary = {
          date: new Date(now.getTime() - 86400000).toISOString().split('T')[0],
          buckets: data.hourlyBuckets.map(b => ({
            hour: b.hour,
            average: b.samples > 0 ? Math.round((b.count / b.samples) * 100) / 100 : 0
          }))
        };

        data.dailyHistory.push(dailySummary);

        // Keep 30 days of daily history
        while (data.dailyHistory.length > 30) {
          data.dailyHistory.shift();
        }

        // Reset hourly buckets
        data.hourlyBuckets = this._createEmptyHourlyBuckets();
      }

      this.log('Daily occupancy archived');
    }
  }

  // ---------------------------------------------------------------------------
  // Settings Persistence
  // ---------------------------------------------------------------------------

  async _loadSettings() {
    try {
      const stored = this.homey.settings && typeof this.homey.settings.get === 'function'
        ? this.homey.settings.get('digitalTwinSettings')
        : null;

      if (stored) {
        const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored;
        Object.assign(this._settings, parsed);
        this.log('Settings loaded from storage');
      } else {
        this.log('No stored settings found, using defaults');
      }
    } catch (err) {
      this.error('Failed to load settings: ' + err.message);
    }
  }

  async _saveSettings() {
    try {
      if (this.homey.settings && typeof this.homey.settings.set === 'function') {
        this.homey.settings.set('digitalTwinSettings', JSON.stringify(this._settings));
        this.log('Settings saved');
      }
    } catch (err) {
      this.error('Failed to save settings: ' + err.message);
    }
  }

  async _restoreState() {
    try {
      const stored = this.homey.settings && typeof this.homey.settings.get === 'function'
        ? this.homey.settings.get('digitalTwinState')
        : null;

      if (stored) {
        const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored;

        if (parsed.deviceStates && Array.isArray(parsed.deviceStates)) {
          for (const entry of parsed.deviceStates) {
            this.deviceStates.set(entry.id, entry);
          }
          this.log('Restored ' + parsed.deviceStates.length + ' device states');
        }

        if (parsed.deviceGroups && Array.isArray(parsed.deviceGroups)) {
          for (const entry of parsed.deviceGroups) {
            this.deviceGroups.set(entry.name, entry);
          }
          this.log('Restored ' + parsed.deviceGroups.length + ' device groups');
        }

        if (parsed.energyFlow) {
          Object.assign(this.energyFlow, parsed.energyFlow);
          this.log('Restored energy flow data');
        }
      } else {
        this.log('No stored state found');
      }
    } catch (err) {
      this.error('Failed to restore state: ' + err.message);
    }
  }

  async _persistState() {
    try {
      const state = {
        deviceStates: Array.from(this.deviceStates.values()),
        deviceGroups: Array.from(this.deviceGroups.values()),
        energyFlow: {
          solar_production: this.energyFlow.solar_production,
          battery_charge: this.energyFlow.battery_charge,
          grid_import: this.energyFlow.grid_import,
          grid_export: this.energyFlow.grid_export,
          consumption: this.energyFlow.consumption
        },
        savedAt: Date.now()
      };

      if (this.homey.settings && typeof this.homey.settings.set === 'function') {
        this.homey.settings.set('digitalTwinState', JSON.stringify(state));
        this.log('State persisted');
      }
    } catch (err) {
      this.error('Failed to persist state: ' + err.message);
    }
  }

  updateSettings(newSettings) {
    const allowedKeys = [
      'snapshotIntervalMinutes',
      'anomalyStdDevMultiplier',
      'historyRetentionDays',
      'maxHistoryEntries'
    ];

    let changed = false;
    for (const key of allowedKeys) {
      if (newSettings[key] !== undefined) {
        this._settings[key] = newSettings[key];
        changed = true;
      }
    }

    if (newSettings.comfortWeights) {
      Object.assign(this._settings.comfortWeights, newSettings.comfortWeights);
      changed = true;
    }

    if (newSettings.idealRanges) {
      for (const [key, range] of Object.entries(newSettings.idealRanges)) {
        if (this._settings.idealRanges[key]) {
          Object.assign(this._settings.idealRanges[key], range);
        }
      }
      changed = true;
    }

    if (changed) {
      this._saveSettings();

      // Restart monitoring loop if interval changed
      if (newSettings.snapshotIntervalMinutes !== undefined) {
        this._startMonitoringLoop();
      }
    }

    return this._settings;
  }

  getSettings() {
    return Object.assign({}, this._settings);
  }

  // ---------------------------------------------------------------------------
  // Property Management
  // ---------------------------------------------------------------------------

  addProperty(id, label, type) {
    if (this.properties.has(id)) {
      this.log('Property already exists: ' + id);
      return this.properties.get(id);
    }

    const property = {
      id: id,
      label: label || id,
      type: type || 'secondary',
      address: '',
      timezone: 'Europe/Amsterdam',
      createdAt: Date.now()
    };

    this.properties.set(id, property);
    this.log('Property added: ' + id);
    return property;
  }

  removeProperty(id) {
    if (id === 'home') {
      this.error('Cannot remove primary home property');
      return false;
    }

    if (!this.properties.has(id)) {
      return false;
    }

    // Remove rooms assigned to this property
    for (const [roomId, room] of this.rooms) {
      if (room.propertyId === id) {
        this.removeRoom(roomId);
      }
    }

    this.properties.delete(id);
    this.log('Property removed: ' + id);
    return true;
  }

  listProperties() {
    const result = [];
    for (const [id, prop] of this.properties) {
      const roomCount = this.listRooms(id).length;
      result.push({
        id: id,
        label: prop.label,
        type: prop.type,
        roomCount: roomCount,
        createdAt: prop.createdAt
      });
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // Full Twin Model Export
  // ---------------------------------------------------------------------------

  exportTwinModel() {
    const model = {
      version: '1.0.0',
      exportedAt: Date.now(),
      properties: Array.from(this.properties.values()),
      rooms: {},
      deviceStates: {},
      deviceGroups: {},
      energyFlow: this.energyFlow,
      occupancy: {},
      stateHistoryCount: this.stateHistory.length
    };

    for (const [roomId, room] of this.rooms) {
      model.rooms[roomId] = {
        id: room.id,
        label: room.label,
        floor: room.floor,
        area_m2: room.area_m2,
        devices: room.devices,
        sensorValues: {}
      };

      for (const [sensorType, sensor] of Object.entries(room.sensors)) {
        model.rooms[roomId].sensorValues[sensorType] = {
          value: sensor.value,
          unit: sensor.unit,
          lastUpdated: sensor.lastUpdated
        };
      }
    }

    for (const [deviceId, device] of this.deviceStates) {
      model.deviceStates[deviceId] = {
        id: device.id,
        type: device.type,
        roomId: device.roomId,
        state: device.state,
        lastSeen: device.lastSeen
      };
    }

    for (const [groupName, group] of this.deviceGroups) {
      model.deviceGroups[groupName] = {
        name: group.name,
        deviceIds: group.deviceIds,
        createdAt: group.createdAt
      };
    }

    for (const [roomId, data] of this.occupancyData) {
      model.occupancy[roomId] = {
        currentCount: data.currentCount,
        lastUpdated: data.lastUpdated
      };
    }

    this.log('Twin model exported');
    return model;
  }

  // ---------------------------------------------------------------------------
  // Statistics
  // ---------------------------------------------------------------------------

  getStatistics() {
    const comfortScores = {};
    let totalComfort = 0;
    let comfortCount = 0;

    for (const roomId of this.rooms.keys()) {
      const comfort = this.calculateComfortScore(roomId);
      if (comfort) {
        comfortScores[roomId] = comfort.overall;
        totalComfort += comfort.overall;
        comfortCount++;
      }
    }

    const deviceHealth = this.getDeviceHealthMap();
    const anomalies = this.detectAllAnomalies();
    const totalAnomalies = Object.values(anomalies).reduce(
      (sum, room) => sum + room.anomalies.length, 0
    );

    return {
      properties: this.properties.size,
      rooms: this.rooms.size,
      devices: this.deviceStates.size,
      deviceGroups: this.deviceGroups.size,
      snapshotCount: this.stateHistory.length,
      energyFlow: {
        solar_production: this.energyFlow.solar_production,
        consumption: this.energyFlow.consumption,
        netGrid: this.energyFlow.grid_import - this.energyFlow.grid_export
      },
      averageComfortScore: comfortCount > 0
        ? Math.round(totalComfort / comfortCount)
        : 0,
      comfortPerRoom: comfortScores,
      deviceHealth: deviceHealth.summary,
      anomalyCount: totalAnomalies,
      initialized: this._initialized,
      uptime: this._initialized ? Date.now() : 0,
      settings: {
        snapshotInterval: this._settings.snapshotIntervalMinutes,
        historyRetention: this._settings.historyRetentionDays
      }
    };
  }

  // ---------------------------------------------------------------------------
  // Logging
  // ---------------------------------------------------------------------------

  log(msg) {
    this.homey.log('[DigitalTwin]', msg);
  }

  error(msg) {
    this.homey.error('[DigitalTwin]', msg);
  }

  // ---------------------------------------------------------------------------
  // Destroy
  // ---------------------------------------------------------------------------

  async destroy() {
    this.log('Destroying Smart Home Digital Twin System...');

    if (this._monitoringInterval) {
      clearInterval(this._monitoringInterval);
      this._monitoringInterval = null;
    }

    try {
      await this._persistState();
      await this._saveSettings();
    } catch (err) {
      this.error('Error during destroy persistence: ' + err.message);
    }

    this.properties.clear();
    this.rooms.clear();
    this.deviceStates.clear();
    this.occupancyData.clear();
    this.deviceGroups.clear();
    this.stateHistory.length = 0;

    this._initialized = false;
    this.log('Destroyed');
  }
}

module.exports = SmartHomeDigitalTwinSystem;
