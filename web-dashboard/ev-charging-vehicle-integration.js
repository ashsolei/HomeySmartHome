'use strict';
const logger = require('./logger');

/**
 * EV Charging & Vehicle Integration
 * Electric vehicle charging and smart garage management
 */
class EVChargingVehicleIntegration {
  constructor(app) {
    this._intervals = [];
    this.app = app;
    this.vehicles = new Map();
    this.chargingStations = new Map();
    this.chargingSessions = [];
    this.energyPrices = new Map();
    this.trips = [];
  }

  async initialize() {
    await this.setupVehicles();
    await this.setupChargingStations();
    await this.setupEnergyPrices();
    
    this.startMonitoring();
  }

  // ============================================
  // VEHICLES
  // ============================================

  async setupVehicles() {
    const vehicles = [
      {
        id: 'tesla_model3',
        name: 'Tesla Model 3',
        make: 'Tesla',
        model: 'Model 3',
        year: 2024,
        owner: 'anna',
        batteryCapacity: 60,  // kWh
        currentBattery: 75,   // %
        range: 225,           // km
        location: 'home',
        chargingStatus: 'idle',
        odometer: 15420,
        averageConsumption: 15.5,  // kWh/100km
        preconditioning: false,
        climate: {
          enabled: false,
          targetTemp: 21
        }
      },
      {
        id: 'volvo_xc40',
        name: 'Volvo XC40 Recharge',
        make: 'Volvo',
        model: 'XC40 Recharge',
        year: 2025,
        owner: 'erik',
        batteryCapacity: 78,
        currentBattery: 60,
        range: 280,
        location: 'work',
        chargingStatus: 'idle',
        odometer: 8950,
        averageConsumption: 19.2,
        preconditioning: false,
        climate: {
          enabled: false,
          targetTemp: 20
        }
      }
    ];

    for (const vehicle of vehicles) {
      this.vehicles.set(vehicle.id, vehicle);
    }
  }

  async getVehicleStatus(vehicleId) {
    const vehicle = this.vehicles.get(vehicleId);
    
    if (!vehicle) {
      return { success: false, error: 'Vehicle not found' };
    }

    return {
      name: vehicle.name,
      battery: vehicle.currentBattery + '%',
      range: vehicle.range + ' km',
      location: vehicle.location,
      charging: vehicle.chargingStatus,
      odometer: vehicle.odometer + ' km'
    };
  }

  async startPreconditioning(vehicleId, targetTemp = 21) {
    const vehicle = this.vehicles.get(vehicleId);
    
    if (!vehicle) {
      return { success: false, error: 'Vehicle not found' };
    }

    vehicle.preconditioning = true;
    vehicle.climate.enabled = true;
    vehicle.climate.targetTemp = targetTemp;

    logger.info(`🚗 ${vehicle.name}: Precondition started (${targetTemp}°C)`);

    return { success: true };
  }

  async lockVehicle(vehicleId) {
    const vehicle = this.vehicles.get(vehicleId);
    
    if (!vehicle) {
      return { success: false, error: 'Vehicle not found' };
    }

    logger.info(`🔒 ${vehicle.name}: Locked`);

    return { success: true };
  }

  async unlockVehicle(vehicleId) {
    const vehicle = this.vehicles.get(vehicleId);
    
    if (!vehicle) {
      return { success: false, error: 'Vehicle not found' };
    }

    logger.info(`🔓 ${vehicle.name}: Unlocked`);

    return { success: true };
  }

  // ============================================
  // CHARGING STATIONS
  // ============================================

  async setupChargingStations() {
    const stations = [
      {
        id: 'home_charger',
        name: 'Hemmaladdare',
        location: 'garage',
        type: 'wallbox',
        maxPower: 11,  // kW
        currentPower: 0,
        status: 'available',
        connectedVehicle: null,
        smartCharging: true,
        solarIntegration: true
      },
      {
        id: 'work_charger',
        name: 'Jobbets laddare',
        location: 'work_parking',
        type: 'public',
        maxPower: 22,
        currentPower: 0,
        status: 'available',
        connectedVehicle: null,
        smartCharging: false,
        solarIntegration: false
      }
    ];

    for (const station of stations) {
      this.chargingStations.set(station.id, station);
    }
  }

  async startCharging(stationId, vehicleId, targetBattery = 80) {
    const station = this.chargingStations.get(stationId);
    const vehicle = this.vehicles.get(vehicleId);
    
    if (!station || !vehicle) {
      return { success: false, error: 'Station or vehicle not found' };
    }

    if (station.status !== 'available') {
      return { success: false, error: 'Station not available' };
    }

    station.status = 'charging';
    station.connectedVehicle = vehicleId;
    vehicle.chargingStatus = 'charging';

    const session = {
      id: 'session_' + Date.now(),
      stationId,
      vehicleId,
      startTime: Date.now(),
      startBattery: vehicle.currentBattery,
      targetBattery,
      endTime: null,
      energyDelivered: 0,
      cost: 0
    };

    this.chargingSessions.push(session);

    logger.info(`⚡ Charging started: ${vehicle.name} at ${station.name}`);
    logger.info(`   Current: ${vehicle.currentBattery}% → Target: ${targetBattery}%`);

    // Calculate charging time
    const energyNeeded = (targetBattery - vehicle.currentBattery) / 100 * vehicle.batteryCapacity;
    const chargingTime = (energyNeeded / station.maxPower * 60).toFixed(0);
    logger.info(`   Estimated time: ${chargingTime} minutes`);

    return { success: true, sessionId: session.id, estimatedTime: chargingTime };
  }

  async stopCharging(sessionId) {
    const session = this.chargingSessions.find(s => s.id === sessionId && !s.endTime);
    
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    const station = this.chargingStations.get(session.stationId);
    const vehicle = this.vehicles.get(session.vehicleId);

    session.endTime = Date.now();
    
    // Simulate charging progress
    const chargingDuration = (session.endTime - session.startTime) / (60 * 1000);  // minutes
    const energyDelivered = (chargingDuration / 60) * station.maxPower;
    const batteryGain = (energyDelivered / vehicle.batteryCapacity) * 100;

    session.energyDelivered = energyDelivered;
    vehicle.currentBattery = Math.min(vehicle.currentBattery + batteryGain, 100);
    vehicle.range = (vehicle.currentBattery / 100) * (vehicle.batteryCapacity / vehicle.averageConsumption * 100);

    // Calculate cost
    const pricePerKWh = this.getCurrentEnergyPrice();
    session.cost = energyDelivered * pricePerKWh;

    station.status = 'available';
    station.connectedVehicle = null;
    station.currentPower = 0;
    vehicle.chargingStatus = 'idle';

    logger.info(`✅ Charging complete: ${vehicle.name}`);
    logger.info(`   Battery: ${vehicle.currentBattery.toFixed(0)}%`);
    logger.info(`   Energy: ${energyDelivered.toFixed(2)} kWh`);
    logger.info(`   Cost: ${session.cost.toFixed(2)} SEK`);

    return { success: true, finalBattery: vehicle.currentBattery, cost: session.cost };
  }

  // ============================================
  // SMART CHARGING
  // ============================================

  async scheduleSmartCharging(vehicleId, departureTime, targetBattery = 80) {
    const vehicle = this.vehicles.get(vehicleId);
    
    if (!vehicle) {
      return { success: false, error: 'Vehicle not found' };
    }

    const now = Date.now();
    const timeUntilDeparture = departureTime - now;

    if (timeUntilDeparture <= 0) {
      return { success: false, error: 'Departure time must be in the future' };
    }

    // Find cheapest charging periods
    const cheapestPeriods = await this.findCheapestChargingPeriods(timeUntilDeparture);

    logger.info(`🔌 Smart charging scheduled for ${vehicle.name}`);
    logger.info(`   Departure: ${new Date(departureTime).toLocaleString('sv-SE')}`);
    logger.info(`   Target: ${targetBattery}%`);
    logger.info(`   Will charge during cheapest periods`);

    return { success: true, chargingPeriods: cheapestPeriods };
  }

  async findCheapestChargingPeriods(timeWindow) {
    // Simulate hourly price data (would use real API like Nordpool)
    const hours = Math.ceil(timeWindow / (60 * 60 * 1000));
    const periods = [];

    for (let i = 0; i < hours; i++) {
      periods.push({
        hour: new Date(Date.now() + i * 60 * 60 * 1000).getHours(),
        price: 0.8 + Math.random() * 1.2  // 0.8-2.0 SEK/kWh
      });
    }

    // Sort by price and return cheapest 4 hours
    periods.sort((a, b) => a.price - b.price);
    return periods.slice(0, 4);
  }

  async chargeDuringSolarProduction(vehicleId) {
    const vehicle = this.vehicles.get(vehicleId);
    
    if (!vehicle) {
      return { success: false, error: 'Vehicle not found' };
    }

    logger.info(`☀️ Solar charging enabled for ${vehicle.name}`);
    logger.info(`   Will charge when solar production > 5 kW`);

    return { success: true };
  }

  // ============================================
  // ENERGY PRICES
  // ============================================

  async setupEnergyPrices() {
    // Simulate hourly prices (SEK/kWh)
    for (let hour = 0; hour < 24; hour++) {
      let price;
      
      if (hour >= 6 && hour < 9) {
        price = 1.8;  // Morning peak
      } else if (hour >= 17 && hour < 21) {
        price = 2.0;  // Evening peak
      } else if (hour >= 0 && hour < 6) {
        price = 0.8;  // Night (cheapest)
      } else {
        price = 1.2;  // Off-peak
      }

      this.energyPrices.set(hour, price);
    }
  }

  getCurrentEnergyPrice() {
    const hour = new Date().getHours();
    return this.energyPrices.get(hour) || 1.2;
  }

  // ============================================
  // TRIP PLANNING
  // ============================================

  async planTrip(vehicleId, destination, distance) {
    const vehicle = this.vehicles.get(vehicleId);
    
    if (!vehicle) {
      return { success: false, error: 'Vehicle not found' };
    }

    const consumption = distance * (vehicle.averageConsumption / 100);
    const batteryNeeded = (consumption / vehicle.batteryCapacity) * 100;
    const currentRange = vehicle.range;

    const plan = {
      destination,
      distance: distance + ' km',
      estimatedConsumption: consumption.toFixed(1) + ' kWh',
      batteryNeeded: batteryNeeded.toFixed(0) + '%',
      currentBattery: vehicle.currentBattery.toFixed(0) + '%',
      canReach: currentRange >= distance,
      chargingNeeded: currentRange < distance
    };

    if (plan.chargingNeeded) {
      const chargingStops = Math.ceil((distance - currentRange) / 200);  // Every 200 km
      plan.suggestedChargingStops = chargingStops;
      logger.info(`🗺️ Trip to ${destination} requires ${chargingStops} charging stop(s)`);
    } else {
      logger.info(`🗺️ Trip to ${destination} possible without charging`);
    }

    return plan;
  }

  async logTrip(vehicleId, distance, duration) {
    const vehicle = this.vehicles.get(vehicleId);
    
    if (!vehicle) {
      return { success: false, error: 'Vehicle not found' };
    }

    const trip = {
      vehicleId,
      timestamp: Date.now(),
      distance,
      duration,
      startBattery: vehicle.currentBattery,
      endBattery: vehicle.currentBattery - (distance * vehicle.averageConsumption / 100 / vehicle.batteryCapacity * 100),
      averageSpeed: distance / (duration / 60)
    };

    vehicle.currentBattery = Math.max(trip.endBattery, 0);
    vehicle.odometer += distance;
    vehicle.range = (vehicle.currentBattery / 100) * (vehicle.batteryCapacity / vehicle.averageConsumption * 100);

    this.trips.push(trip);

    logger.info(`🚗 Trip logged: ${distance} km in ${duration} min`);

    return { success: true };
  }

  // ============================================
  // GARAGE INTEGRATION
  // ============================================

  async openGarage() {
    logger.info('🚪 Opening garage door...');
    
    // Check if vehicles are approaching
    const approachingVehicles = Array.from(this.vehicles.values())
      .filter(v => v.location === 'approaching');

    if (approachingVehicles.length > 0) {
      logger.info(`   Vehicle detected: ${approachingVehicles[0].name}`);
    }

    return { success: true };
  }

  async closeGarage() {
    logger.info('🚪 Closing garage door...');
    return { success: true };
  }

  async activateGarageScene(scene) {
    logger.info(`🏠 Activating garage scene: ${scene}`);

    switch (scene) {
      case 'arrival':
        logger.info('   💡 Turning on garage lights');
        logger.info('   🚪 Opening garage door');
        logger.info('   🏠 Unlocking house door');
        break;

      case 'departure':
        logger.info('   ⚡ Stopping charging if complete');
        logger.info('   🚪 Opening garage door');
        logger.info('   🔒 Locking house');
        break;

      case 'charging':
        logger.info('   💡 Dimming lights to 30%');
        logger.info('   ⚡ Starting charging');
        logger.info('   🌡️ Setting garage temp to 15°C');
        break;
    }

    return { success: true };
  }

  // ============================================
  // MONITORING
  // ============================================

  startMonitoring() {
    // Check charging sessions every 5 minutes
    this._intervals.push(setInterval(() => {
      this.checkChargingSessions();
    }, 5 * 60 * 1000));

    // Update vehicle locations (simulated)
    this._intervals.push(setInterval(() => {
      this.updateVehicleLocations();
    }, 10 * 60 * 1000));

    logger.info('🚗 EV Integration active');
  }

  async checkChargingSessions() {
    const activeSessions = this.chargingSessions.filter(s => !s.endTime);

    for (const session of activeSessions) {
      const vehicle = this.vehicles.get(session.vehicleId);
      
      if (vehicle && vehicle.currentBattery >= session.targetBattery) {
        await this.stopCharging(session.id);
      }
    }
  }

  async updateVehicleLocations() {
    // Simulated location updates (would use real GPS/API)
    for (const [_id, vehicle] of this.vehicles) {
      // Random location updates for demonstration
      if (Math.random() > 0.8) {
        const locations = ['home', 'work', 'shopping', 'away'];
        vehicle.location = locations[Math.floor(Math.random() * locations.length)];
      }
    }
  }

  // ============================================
  // REPORTING
  // ============================================

  getEVIntegrationOverview() {
    const chargingSessions = this.chargingSessions.length;
    const totalEnergy = this.chargingSessions.reduce((sum, s) => sum + s.energyDelivered, 0);
    const totalCost = this.chargingSessions.reduce((sum, s) => sum + s.cost, 0);

    return {
      vehicles: this.vehicles.size,
      chargingStations: this.chargingStations.size,
      chargingSessions,
      totalEnergy: totalEnergy.toFixed(1) + ' kWh',
      totalCost: totalCost.toFixed(2) + ' SEK',
      trips: this.trips.length
    };
  }

  getVehiclesList() {
    return Array.from(this.vehicles.values()).map(v => ({
      name: v.name,
      battery: v.currentBattery.toFixed(0) + '%',
      range: v.range.toFixed(0) + ' km',
      location: v.location,
      charging: v.chargingStatus
    }));
  }

  getChargingHistory(days = 30) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const recent = this.chargingSessions.filter(s => s.startTime >= cutoff && s.endTime);

    return recent.map(s => {
      const vehicle = this.vehicles.get(s.vehicleId);
      const duration = ((s.endTime - s.startTime) / (60 * 1000)).toFixed(0);

      return {
        vehicle: vehicle?.name || s.vehicleId,
        date: new Date(s.startTime).toLocaleDateString('sv-SE'),
        energy: s.energyDelivered.toFixed(1) + ' kWh',
        duration: duration + ' min',
        cost: s.cost.toFixed(2) + ' SEK'
      };
    }).slice(-10);
  }

  getEnergyPriceSchedule() {
    return Array.from(this.energyPrices.entries()).map(([hour, price]) => ({
      hour: hour.toString().padStart(2, '0') + ':00',
      price: price.toFixed(2) + ' SEK/kWh'
    }));
  }

  destroy() {
    if (this._intervals) {
      this._intervals.forEach(id => clearInterval(id));
      this._intervals = [];
    }
  }
}

module.exports = EVChargingVehicleIntegration;
