'use strict';

/**
 * Vehicle Integration System
 * Multi-vehicle support with EV charging optimization, trip history, fuel/charge cost tracking,
 * pre-conditioning, departure learning, garage automation, maintenance reminders,
 * range management, calendar integration, and location-based triggers
 */
class VehicleIntegrationSystem {
  constructor(homey) {
    this.homey = homey;
    this.vehicles = new Map();
    this.chargers = new Map();
    this.garageDoors = new Map();
    this.chargingSessions = [];
    this.chargingSchedule = new Map();
    this.smartChargingEnabled = true;

    // Multi-vehicle profiles
    this.vehicleProfiles = new Map();

    // Trip history and driving patterns
    this.tripHistory = [];
    this.drivingPatterns = {
      departuresByDay: new Array(7).fill(null).map(() => []),
      avgTripDistanceKm: 0,
      totalTrips: 0
    };

    // Fuel/charge cost tracking
    this.fuelCostHistory = [];
    this.electricityCostPerKwh = 1.5;
    this.fuelCostPerLiter = 18.5;

    // Pre-conditioning
    this.preconditioningSchedules = new Map();
    this.preconditioningTimers = new Map();

    // Departure time learning
    this.departureLearning = new Map();
    this.predictedDepartures = new Map();

    // Garage door automation
    this.garageAutomationEnabled = true;
    this.vehicleProximity = new Map();
    this.garageAutoCloseDelayMs = 120000;

    // Maintenance reminders
    this.maintenanceSchedules = new Map();
    this.maintenanceHistory = [];

    // Range anxiety management
    this.rangeAlertThresholdKm = 50;
    this.plannedTrips = new Map();

    // Calendar integration
    this.calendarEvents = [];

    // Speed/location-based triggers
    this.locationTriggers = new Map();
    this.speedTriggers = [];
  }

  async initialize() {
    this.log('Initializing Vehicle Integration System...');

    try {
      const savedSettings = await this.homey.settings.get('vehicleSettings') || {};
      this.smartChargingEnabled = savedSettings.smartChargingEnabled !== false;
      this.garageAutomationEnabled = savedSettings.garageAutomationEnabled !== false;
      this.electricityCostPerKwh = savedSettings.electricityCostPerKwh || 1.5;
      this.fuelCostPerLiter = savedSettings.fuelCostPerLiter || 18.5;
      this.rangeAlertThresholdKm = savedSettings.rangeAlertThresholdKm || 50;

      await this.discoverVehicleDevices();
      await this.loadVehicleProfiles();
      await this.loadTripHistory();
      await this.loadMaintenanceSchedules();
      await this.loadDepartureLearning();
      await this.startMonitoring();
    } catch (err) {
      this.error('Initialization failed:', err.message);
    }

    this.log('Vehicle Integration System initialized');
  }

  async discoverVehicleDevices() {
    const devices = this.homey.drivers.getDevices();

    for (const device of devices) {
      const name = device.name.toLowerCase();

      if (name.includes('charger') || name.includes('laddare')) {
        this.chargers.set(device.id, {
          id: device.id,
          name: device.name,
          device,
          charging: false,
          power: 0,
          maxPower: 11000,
          assignedVehicle: null
        });
      }

      if (name.includes('garage') && (name.includes('door') || name.includes('dörr') || name.includes('port'))) {
        this.garageDoors.set(device.id, {
          id: device.id,
          name: device.name,
          device,
          open: false,
          openedAt: null,
          autoCloseScheduled: false
        });
      }
    }

    this.log(`Vehicle devices: ${this.chargers.size} chargers, ${this.garageDoors.size} garage doors`);
  }

  async loadVehicleProfiles() {
    try {
      const saved = await this.homey.settings.get('vehicleProfiles') || {};
      Object.entries(saved).forEach(([id, vehicle]) => {
        this.vehicles.set(id, vehicle);
        this.vehicleProfiles.set(id, vehicle);
      });

      if (this.vehicles.size === 0) {
        await this.addDefaultVehicles();
      }
    } catch (err) {
      this.error('Failed to load vehicle profiles:', err.message);
    }
  }

  async addDefaultVehicles() {
    const defaultVehicles = [
      {
        id: 'vehicle_1',
        name: 'Tesla Model 3',
        type: 'electric',
        batteryCapacity: 75,
        currentCharge: 60,
        targetCharge: 80,
        range: 450,
        currentRangeKm: 270,
        chargingSpeed: 11,
        preferredChargingTime: '22:00',
        odometer: 25000,
        licensePlate: 'ABC 123',
        year: 2023,
        fuelType: 'electric',
        avgConsumptionPer100km: 15, // kWh
        lastKnownLocation: null,
        lastKnownSpeed: 0
      }
    ];

    for (const vehicle of defaultVehicles) {
      this.vehicles.set(vehicle.id, vehicle);
      this.vehicleProfiles.set(vehicle.id, vehicle);
    }

    await this.saveVehicleProfiles();
  }

  // ── Multi-Vehicle Support ─────────────────────────────────────────────

  async addVehicle(vehicleData) {
    const id = vehicleData.id || `vehicle_${Date.now()}`;
    const vehicle = {
      id,
      name: vehicleData.name || 'New Vehicle',
      type: vehicleData.type || 'electric',
      batteryCapacity: vehicleData.batteryCapacity || 0,
      currentCharge: vehicleData.currentCharge || 0,
      targetCharge: vehicleData.targetCharge || 80,
      fuelCapacity: vehicleData.fuelCapacity || 0,
      currentFuel: vehicleData.currentFuel || 0,
      range: vehicleData.range || 0,
      currentRangeKm: vehicleData.currentRangeKm || 0,
      chargingSpeed: vehicleData.chargingSpeed || 11,
      preferredChargingTime: vehicleData.preferredChargingTime || '22:00',
      odometer: vehicleData.odometer || 0,
      licensePlate: vehicleData.licensePlate || '',
      year: vehicleData.year || new Date().getFullYear(),
      fuelType: vehicleData.fuelType || vehicleData.type,
      avgConsumptionPer100km: vehicleData.avgConsumptionPer100km || 15,
      lastKnownLocation: null,
      lastKnownSpeed: 0,
      charging: false,
      preconditioningActive: false,
      createdAt: Date.now()
    };

    this.vehicles.set(id, vehicle);
    this.vehicleProfiles.set(id, vehicle);
    await this.saveVehicleProfiles();

    this.log(`Vehicle added: ${vehicle.name} (${vehicle.type})`);
    return vehicle;
  }

  async removeVehicle(vehicleId) {
    const vehicle = this.vehicles.get(vehicleId);
    if (!vehicle) return false;

    this.vehicles.delete(vehicleId);
    this.vehicleProfiles.delete(vehicleId);
    await this.saveVehicleProfiles();

    this.log(`Vehicle removed: ${vehicle.name}`);
    return true;
  }

  getVehicleStatus(vehicleId) {
    const vehicle = this.vehicles.get(vehicleId);
    if (!vehicle) return null;

    return {
      id: vehicle.id,
      name: vehicle.name,
      type: vehicle.type,
      charge: vehicle.type === 'electric' ? `${vehicle.currentCharge}%` : null,
      fuel: vehicle.fuelType !== 'electric' ? `${vehicle.currentFuel}L` : null,
      range: `${vehicle.currentRangeKm} km`,
      charging: vehicle.charging || false,
      preconditioning: vehicle.preconditioningActive || false,
      odometer: vehicle.odometer,
      lastLocation: vehicle.lastKnownLocation
    };
  }

  // ── Trip History & Driving Pattern Analysis ───────────────────────────

  async recordTrip(vehicleId, tripData) {
    const vehicle = this.vehicles.get(vehicleId);
    if (!vehicle) return null;

    const trip = {
      id: `trip_${Date.now()}`,
      vehicleId,
      vehicleName: vehicle.name,
      startTime: tripData.startTime || Date.now() - (tripData.durationMin || 30) * 60000,
      endTime: tripData.endTime || Date.now(),
      distanceKm: tripData.distanceKm || 0,
      startLocation: tripData.startLocation || null,
      endLocation: tripData.endLocation || null,
      avgSpeedKmh: tripData.avgSpeedKmh || 0,
      maxSpeedKmh: tripData.maxSpeedKmh || 0,
      energyUsedKwh: tripData.energyUsedKwh || null,
      fuelUsedLiters: tripData.fuelUsedLiters || null,
      cost: 0
    };

    trip.durationMin = (trip.endTime - trip.startTime) / 60000;

    // Calculate cost
    if (vehicle.type === 'electric' && trip.energyUsedKwh) {
      trip.cost = trip.energyUsedKwh * this.electricityCostPerKwh;
    } else if (trip.fuelUsedLiters) {
      trip.cost = trip.fuelUsedLiters * this.fuelCostPerLiter;
    } else if (trip.distanceKm > 0) {
      if (vehicle.type === 'electric') {
        trip.energyUsedKwh = (trip.distanceKm * vehicle.avgConsumptionPer100km) / 100;
        trip.cost = trip.energyUsedKwh * this.electricityCostPerKwh;
      } else {
        trip.fuelUsedLiters = (trip.distanceKm * vehicle.avgConsumptionPer100km) / 100;
        trip.cost = trip.fuelUsedLiters * this.fuelCostPerLiter;
      }
    }

    // Update vehicle state
    vehicle.odometer += trip.distanceKm;
    if (vehicle.type === 'electric' && trip.energyUsedKwh) {
      vehicle.currentCharge = Math.max(0, vehicle.currentCharge - (trip.energyUsedKwh / vehicle.batteryCapacity) * 100);
      vehicle.currentRangeKm = Math.max(0, vehicle.currentRangeKm - trip.distanceKm);
    }

    this.tripHistory.push(trip);
    if (this.tripHistory.length > 1000) this.tripHistory = this.tripHistory.slice(-800);

    // Record departure pattern
    const departureDay = new Date(trip.startTime).getDay();
    const departureHour = new Date(trip.startTime).getHours();
    this.drivingPatterns.departuresByDay[departureDay].push(departureHour);
    this.drivingPatterns.totalTrips++;
    this.drivingPatterns.avgTripDistanceKm = this.tripHistory.reduce((s, t) => s + t.distanceKm, 0) / this.tripHistory.length;

    await this.saveTripHistory();
    await this.saveVehicleProfiles();

    this.log(`Trip recorded: ${vehicle.name} — ${trip.distanceKm}km, ${trip.cost.toFixed(2)} SEK`);
    return trip;
  }

  getTripHistory(vehicleId = null, limit = 50) {
    let trips = [...this.tripHistory];
    if (vehicleId) trips = trips.filter(t => t.vehicleId === vehicleId);
    return trips.slice(-limit);
  }

  getDrivingAnalysis(vehicleId = null) {
    let trips = vehicleId ? this.tripHistory.filter(t => t.vehicleId === vehicleId) : this.tripHistory;
    if (trips.length === 0) return { status: 'no_data' };

    const totalDistance = trips.reduce((s, t) => s + t.distanceKm, 0);
    const totalCost = trips.reduce((s, t) => s + t.cost, 0);
    const avgSpeed = trips.reduce((s, t) => s + (t.avgSpeedKmh || 0), 0) / trips.length;
    const avgDistance = totalDistance / trips.length;

    // Find peak departure times
    const hourCounts = new Array(24).fill(0);
    for (const trip of trips) {
      const h = new Date(trip.startTime).getHours();
      hourCounts[h]++;
    }
    const peakHour = hourCounts.indexOf(Math.max(...hourCounts));

    return {
      totalTrips: trips.length,
      totalDistanceKm: Math.round(totalDistance),
      totalCostSEK: Math.round(totalCost * 100) / 100,
      avgDistanceKm: Math.round(avgDistance * 10) / 10,
      avgSpeedKmh: Math.round(avgSpeed),
      peakDepartureHour: `${String(peakHour).padStart(2, '0')}:00`,
      avgCostPerTrip: Math.round((totalCost / trips.length) * 100) / 100
    };
  }

  // ── Fuel/Charge Cost Tracking ─────────────────────────────────────────

  getFuelCostSummary(vehicleId = null, period = 'monthly') {
    const periodMs = period === 'yearly' ? 365 * 86400000 : period === 'monthly' ? 30 * 86400000 : 7 * 86400000;
    const since = Date.now() - periodMs;

    let trips = this.tripHistory.filter(t => t.startTime >= since);
    if (vehicleId) trips = trips.filter(t => t.vehicleId === vehicleId);

    const totalCost = trips.reduce((s, t) => s + t.cost, 0);
    const totalEnergy = trips.reduce((s, t) => s + (t.energyUsedKwh || 0), 0);
    const totalFuel = trips.reduce((s, t) => s + (t.fuelUsedLiters || 0), 0);

    // Cost from charging sessions
    const chargeCost = this.chargingSessions
      .filter(s => s.startTime >= since)
      .reduce((sum, s) => sum + (s.cost || 0), 0);

    return {
      period,
      tripCostSEK: Math.round(totalCost * 100) / 100,
      chargingCostSEK: Math.round(chargeCost * 100) / 100,
      totalCostSEK: Math.round((totalCost + chargeCost) * 100) / 100,
      totalEnergyKwh: Math.round(totalEnergy * 10) / 10,
      totalFuelLiters: Math.round(totalFuel * 10) / 10,
      tripCount: trips.length
    };
  }

  // ── Pre-Conditioning Scheduling ───────────────────────────────────────

  async schedulePrecondition(vehicleId, options) {
    const vehicle = this.vehicles.get(vehicleId);
    if (!vehicle) return null;

    const schedule = {
      vehicleId,
      targetTemp: options.targetTemp || 21,
      departureTime: options.departureTime,
      recurringDays: options.recurringDays || null,
      preconditionMinBefore: options.preconditionMinBefore || 15,
      active: true,
      createdAt: Date.now()
    };

    this.preconditioningSchedules.set(vehicleId, schedule);

    // Set timer for next pre-conditioning
    await this.scheduleNextPreconditioning(vehicleId, schedule);

    this.log(`Pre-conditioning scheduled for ${vehicle.name}: ${schedule.preconditionMinBefore}min before ${schedule.departureTime}`);
    return schedule;
  }

  async scheduleNextPreconditioning(vehicleId, schedule) {
    if (!schedule.active) return;

    const [depH, depM] = schedule.departureTime.split(':').map(Number);
    const now = new Date();
    const departure = new Date(now);
    departure.setHours(depH, depM, 0, 0);

    if (departure <= now) departure.setDate(departure.getDate() + 1);

    // Check if the day matches recurring schedule
    if (schedule.recurringDays && !schedule.recurringDays.includes(departure.getDay())) {
      return;
    }

    const startTime = departure.getTime() - schedule.preconditionMinBefore * 60000;
    const msUntilStart = startTime - Date.now();

    if (msUntilStart > 0) {
      const timer = setTimeout(async () => {
        await this.startPreconditioning(vehicleId, schedule.targetTemp);
      }, msUntilStart);
      this.preconditioningTimers.set(vehicleId, timer);
    }
  }

  async startPreconditioning(vehicleId, targetTemp = 21) {
    const vehicle = this.vehicles.get(vehicleId);
    if (!vehicle) return;

    vehicle.preconditioningActive = true;
    this.log(`Pre-conditioning started: ${vehicle.name} → ${targetTemp}°C`);

    try {
      const notificationManager = this.homey.app.advancedNotificationManager;
      if (notificationManager) {
        await notificationManager.sendNotification({
          title: '🌡️ Förvärmning startad',
          message: `${vehicle.name} värms till ${targetTemp}°C`,
          priority: 'low',
          category: 'vehicle'
        });
      }
    } catch (err) {
      this.error('Failed to send preconditioning notification:', err.message);
    }

    // Auto-stop after the scheduled duration
    setTimeout(() => {
      vehicle.preconditioningActive = false;
      this.log(`Pre-conditioning completed: ${vehicle.name}`);
    }, 15 * 60000);
  }

  // ── Departure Time Learning ───────────────────────────────────────────

  learnDeparturePattern(vehicleId) {
    const dayOfWeek = new Date().getDay();
    const departures = this.drivingPatterns.departuresByDay[dayOfWeek];

    if (departures.length < 3) {
      return { predicted: false, reason: 'insufficient_data' };
    }

    const avgHour = departures.reduce((s, h) => s + h, 0) / departures.length;
    const predictedHour = Math.round(avgHour);
    const predictedMin = Math.round((avgHour - Math.floor(avgHour)) * 60);
    const predictedTime = `${String(predictedHour).padStart(2, '0')}:${String(predictedMin).padStart(2, '0')}`;

    this.predictedDepartures.set(`${vehicleId}_${dayOfWeek}`, {
      vehicleId,
      dayOfWeek,
      predictedTime,
      confidence: Math.min(1, departures.length / 10),
      sampleSize: departures.length
    });

    return {
      predicted: true,
      vehicleId,
      dayOfWeek,
      predictedDepartureTime: predictedTime,
      confidence: Math.min(100, Math.round(departures.length / 10 * 100))
    };
  }

  getPredictedDepartureTime(vehicleId) {
    const dayOfWeek = new Date().getDay();
    const key = `${vehicleId}_${dayOfWeek}`;
    return this.predictedDepartures.get(key) || this.learnDeparturePattern(vehicleId);
  }

  // ── Garage Door Automation ────────────────────────────────────────────

  async updateVehicleProximity(vehicleId, distanceMeters) {
    const previous = this.vehicleProximity.get(vehicleId) || { distance: Infinity };
    this.vehicleProximity.set(vehicleId, { distance: distanceMeters, updatedAt: Date.now() });

    if (!this.garageAutomationEnabled) return;

    // Vehicle approaching — open garage
    if (distanceMeters < 100 && previous.distance >= 100) {
      this.log(`Vehicle ${vehicleId} approaching — opening garage`);
      for (const [doorId] of this.garageDoors) {
        await this.openGarageDoor(doorId);
      }
    }

    // Vehicle leaving — close garage after delay
    if (distanceMeters > 200 && previous.distance <= 200) {
      this.log(`Vehicle ${vehicleId} departing — scheduling garage close in ${this.garageAutoCloseDelayMs / 1000}s`);
      setTimeout(async () => {
        for (const [doorId, door] of this.garageDoors) {
          if (door.open) {
            await this.closeGarageDoor(doorId);
          }
        }
      }, this.garageAutoCloseDelayMs);
    }
  }

  // ── Vehicle Maintenance Reminders ─────────────────────────────────────

  async setMaintenanceReminder(vehicleId, maintenance) {
    const vehicle = this.vehicles.get(vehicleId);
    if (!vehicle) return null;

    const key = `${vehicleId}_${maintenance.type}`;
    const reminder = {
      vehicleId,
      vehicleName: vehicle.name,
      type: maintenance.type,
      description: maintenance.description || maintenance.type,
      dueDate: maintenance.dueDate || null,
      dueOdometer: maintenance.dueOdometer || null,
      intervalKm: maintenance.intervalKm || null,
      intervalDays: maintenance.intervalDays || null,
      lastPerformed: maintenance.lastPerformed || null,
      lastOdometer: maintenance.lastOdometer || null,
      active: true,
      createdAt: Date.now()
    };

    this.maintenanceSchedules.set(key, reminder);
    await this.saveMaintenanceSchedules();
    this.log(`Maintenance reminder set: ${vehicle.name} — ${reminder.description}`);
    return reminder;
  }

  async checkMaintenanceReminders() {
    const now = Date.now();
    const alerts = [];

    for (const [key, reminder] of this.maintenanceSchedules) {
      if (!reminder.active) continue;
      const vehicle = this.vehicles.get(reminder.vehicleId);
      if (!vehicle) continue;

      let isDue = false;
      let reason = '';

      if (reminder.dueDate && now >= reminder.dueDate) {
        isDue = true;
        reason = 'Förfallodatum passerat';
      }

      if (reminder.dueOdometer && vehicle.odometer >= reminder.dueOdometer) {
        isDue = true;
        reason = `Miltal uppnått (${vehicle.odometer} km)`;
      }

      if (reminder.intervalKm && reminder.lastOdometer) {
        const kmSince = vehicle.odometer - reminder.lastOdometer;
        if (kmSince >= reminder.intervalKm) {
          isDue = true;
          reason = `${kmSince} km sedan senaste ${reminder.description}`;
        }
      }

      if (reminder.intervalDays && reminder.lastPerformed) {
        const daysSince = (now - reminder.lastPerformed) / 86400000;
        if (daysSince >= reminder.intervalDays) {
          isDue = true;
          reason = `${Math.round(daysSince)} dagar sedan senaste ${reminder.description}`;
        }
      }

      if (isDue) {
        alerts.push({ ...reminder, reason });
        try {
          const notificationManager = this.homey.app.advancedNotificationManager;
          if (notificationManager) {
            await notificationManager.sendNotification({
              title: '🔧 Underhåll för fordon',
              message: `${vehicle.name}: ${reminder.description} — ${reason}`,
              priority: 'normal',
              category: 'vehicle_maintenance'
            });
          }
        } catch (err) {
          this.error('Failed to send maintenance notification:', err.message);
        }
      }
    }

    return alerts;
  }

  async recordMaintenancePerformed(vehicleId, type) {
    const key = `${vehicleId}_${type}`;
    const reminder = this.maintenanceSchedules.get(key);
    if (!reminder) return null;

    const vehicle = this.vehicles.get(vehicleId);
    reminder.lastPerformed = Date.now();
    reminder.lastOdometer = vehicle?.odometer || 0;

    // Recalculate due dates
    if (reminder.intervalDays) {
      reminder.dueDate = Date.now() + reminder.intervalDays * 86400000;
    }
    if (reminder.intervalKm && vehicle) {
      reminder.dueOdometer = vehicle.odometer + reminder.intervalKm;
    }

    this.maintenanceHistory.push({
      vehicleId,
      type,
      performedAt: Date.now(),
      odometer: vehicle?.odometer || 0
    });

    await this.saveMaintenanceSchedules();
    this.log(`Maintenance recorded: ${vehicle?.name} — ${type}`);
    return reminder;
  }

  getMaintenanceStatus(vehicleId = null) {
    const result = [];
    for (const [key, reminder] of this.maintenanceSchedules) {
      if (vehicleId && reminder.vehicleId !== vehicleId) continue;
      const vehicle = this.vehicles.get(reminder.vehicleId);
      result.push({
        type: reminder.type,
        description: reminder.description,
        vehicleName: vehicle?.name || 'Unknown',
        dueDate: reminder.dueDate ? new Date(reminder.dueDate).toISOString().split('T')[0] : null,
        dueOdometer: reminder.dueOdometer,
        currentOdometer: vehicle?.odometer || 0,
        lastPerformed: reminder.lastPerformed ? new Date(reminder.lastPerformed).toISOString().split('T')[0] : null
      });
    }
    return result;
  }

  // ── Range Anxiety Management ──────────────────────────────────────────

  async checkRangeForPlannedTrips(vehicleId) {
    const vehicle = this.vehicles.get(vehicleId);
    if (!vehicle || vehicle.type !== 'electric') return null;

    const alerts = [];
    for (const [tripId, trip] of this.plannedTrips) {
      if (trip.vehicleId !== vehicleId) continue;

      const safetyMarginKm = 30;
      const neededRange = trip.distanceKm + safetyMarginKm;

      if (vehicle.currentRangeKm < neededRange) {
        const deficit = neededRange - vehicle.currentRangeKm;
        const kwhNeeded = (deficit / vehicle.range) * vehicle.batteryCapacity;
        const chargeTimeHours = kwhNeeded / vehicle.chargingSpeed;

        alerts.push({
          tripId,
          tripName: trip.name || 'Planned trip',
          distanceKm: trip.distanceKm,
          currentRangeKm: vehicle.currentRangeKm,
          deficitKm: Math.round(deficit),
          kwhNeeded: Math.round(kwhNeeded * 10) / 10,
          chargeTimeNeededHours: Math.round(chargeTimeHours * 10) / 10,
          status: 'insufficient_range'
        });

        try {
          const notificationManager = this.homey.app.advancedNotificationManager;
          if (notificationManager) {
            await notificationManager.sendNotification({
              title: '⚡ Räckviddsvarning',
              message: `${vehicle.name}: ${vehicle.currentRangeKm}km räckvidd, men ${trip.name || 'planerad resa'} kräver ${neededRange}km. Ladda ~${Math.round(chargeTimeHours * 10) / 10}h.`,
              priority: 'high',
              category: 'vehicle_range'
            });
          }
        } catch (err) {
          this.error('Failed to send range alert:', err.message);
        }
      } else {
        alerts.push({
          tripId,
          tripName: trip.name || 'Planned trip',
          distanceKm: trip.distanceKm,
          currentRangeKm: vehicle.currentRangeKm,
          status: 'sufficient_range'
        });
      }
    }

    return alerts;
  }

  addPlannedTrip(vehicleId, tripData) {
    const tripId = `planned_${Date.now()}`;
    this.plannedTrips.set(tripId, {
      tripId,
      vehicleId,
      name: tripData.name || 'Trip',
      distanceKm: tripData.distanceKm || 0,
      departureTime: tripData.departureTime || null,
      destination: tripData.destination || null,
      createdAt: Date.now()
    });
    this.log(`Planned trip added: ${tripData.name || 'Trip'} — ${tripData.distanceKm}km`);
    return tripId;
  }

  // ── Calendar Integration ──────────────────────────────────────────────

  async syncCalendarEvents(events) {
    this.calendarEvents = events.map(e => ({
      title: e.title,
      startTime: e.startTime,
      endTime: e.endTime,
      location: e.location || null,
      distanceKm: e.distanceKm || null
    }));

    // Check if any upcoming event requires range attention
    for (const vehicle of this.vehicles.values()) {
      if (vehicle.type !== 'electric') continue;
      for (const event of this.calendarEvents) {
        if (!event.distanceKm) continue;
        const safetyMargin = 30;
        if (vehicle.currentRangeKm < event.distanceKm + safetyMargin) {
          try {
            const notificationManager = this.homey.app.advancedNotificationManager;
            if (notificationManager) {
              await notificationManager.sendNotification({
                title: '📅 Kalendervarning',
                message: `"${event.title}" kräver ${event.distanceKm}km. ${vehicle.name} har ${vehicle.currentRangeKm}km — ladda innan!`,
                priority: 'normal',
                category: 'vehicle_calendar'
              });
            }
          } catch (err) {
            this.error('Calendar range alert failed:', err.message);
          }
        }
      }
    }

    this.log(`Calendar synced: ${events.length} events`);
  }

  // ── Speed/Location-Based Triggers ─────────────────────────────────────

  addLocationTrigger(triggerId, config) {
    this.locationTriggers.set(triggerId, {
      id: triggerId,
      name: config.name || triggerId,
      latitude: config.latitude,
      longitude: config.longitude,
      radiusMeters: config.radiusMeters || 200,
      onEnter: config.onEnter || null,
      onExit: config.onExit || null,
      active: true,
      lastTriggered: null
    });
    this.log(`Location trigger added: ${config.name || triggerId}`);
    return this.locationTriggers.get(triggerId);
  }

  async checkLocationTriggers(vehicleId, latitude, longitude) {
    const vehicle = this.vehicles.get(vehicleId);
    if (!vehicle) return;

    vehicle.lastKnownLocation = { latitude, longitude, updatedAt: Date.now() };

    for (const [id, trigger] of this.locationTriggers) {
      if (!trigger.active) continue;

      const distance = this.calculateDistance(
        trigger.latitude, trigger.longitude,
        latitude, longitude
      );

      const wasInside = trigger._wasInside || false;
      const isInside = distance <= trigger.radiusMeters;

      if (isInside && !wasInside && trigger.onEnter) {
        this.log(`Location trigger '${trigger.name}': vehicle entered zone`);
        trigger.lastTriggered = Date.now();
        await this.executeLocationAction(trigger.onEnter, vehicleId);
      }

      if (!isInside && wasInside && trigger.onExit) {
        this.log(`Location trigger '${trigger.name}': vehicle exited zone`);
        trigger.lastTriggered = Date.now();
        await this.executeLocationAction(trigger.onExit, vehicleId);
      }

      trigger._wasInside = isInside;
    }
  }

  async executeLocationAction(action, vehicleId) {
    try {
      if (action.type === 'scene' && action.sceneName) {
        this.log(`Executing scene: ${action.sceneName}`);
      }
      if (action.type === 'notification') {
        const notificationManager = this.homey.app.advancedNotificationManager;
        if (notificationManager) {
          await notificationManager.sendNotification({
            title: action.title || '🚗 Fordonsutlösare',
            message: action.message || 'Location trigger activated',
            priority: action.priority || 'low',
            category: 'vehicle_trigger'
          });
        }
      }
      if (action.type === 'garage_open') {
        for (const [doorId] of this.garageDoors) {
          await this.openGarageDoor(doorId);
        }
      }
      if (action.type === 'garage_close') {
        for (const [doorId] of this.garageDoors) {
          await this.closeGarageDoor(doorId);
        }
      }
    } catch (err) {
      this.error('Location action execution failed:', err.message);
    }
  }

  addSpeedTrigger(config) {
    const trigger = {
      id: `speed_${Date.now()}`,
      vehicleId: config.vehicleId || null,
      speedThresholdKmh: config.speedThresholdKmh,
      condition: config.condition || 'above',
      action: config.action,
      active: true,
      lastTriggered: null
    };
    this.speedTriggers.push(trigger);
    this.log(`Speed trigger added: ${trigger.condition} ${trigger.speedThresholdKmh} km/h`);
    return trigger;
  }

  async checkSpeedTriggers(vehicleId, speedKmh) {
    const vehicle = this.vehicles.get(vehicleId);
    if (vehicle) vehicle.lastKnownSpeed = speedKmh;

    for (const trigger of this.speedTriggers) {
      if (!trigger.active) continue;
      if (trigger.vehicleId && trigger.vehicleId !== vehicleId) continue;

      const triggered = trigger.condition === 'above'
        ? speedKmh > trigger.speedThresholdKmh
        : speedKmh < trigger.speedThresholdKmh;

      if (triggered && (!trigger.lastTriggered || Date.now() - trigger.lastTriggered > 300000)) {
        trigger.lastTriggered = Date.now();
        await this.executeLocationAction(trigger.action, vehicleId);
      }
    }
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // ── Core Monitoring & Charging ────────────────────────────────────────

  async startMonitoring() {
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkChargingStatus();
        await this.checkChargingSchedule();
        await this.checkGarageDoors();
        await this.checkMaintenanceReminders();
      } catch (err) {
        this.error('Monitoring cycle error:', err.message);
      }
    }, 60000);

    await this.checkChargingSchedule();
  }

  async checkChargingStatus() {
    for (const [id, charger] of this.chargers) {
      try {
        if (charger.device.hasCapability('onoff')) {
          charger.charging = await charger.device.getCapabilityValue('onoff');
        }
        if (charger.device.hasCapability('measure_power')) {
          charger.power = await charger.device.getCapabilityValue('measure_power') || 0;
        }
        if (charger.charging) {
          await this.updateChargingSession(charger);
        }
      } catch (err) {
        this.error(`Charger status check failed for ${charger.name}:`, err.message);
      }
    }
  }

  async updateChargingSession(charger) {
    const activeSession = this.chargingSessions.find(s => s.chargerId === charger.id && !s.endTime);

    if (!activeSession) {
      this.chargingSessions.push({
        id: `session_${Date.now()}`,
        chargerId: charger.id,
        vehicleId: charger.assignedVehicle || null,
        startTime: Date.now(),
        endTime: null,
        energyDelivered: 0,
        cost: 0
      });
    } else {
      const duration = (Date.now() - activeSession.startTime) / 3600000;
      activeSession.energyDelivered = (charger.power / 1000) * duration;
      activeSession.cost = activeSession.energyDelivered * this.electricityCostPerKwh;
    }
  }

  async checkChargingSchedule() {
    if (!this.smartChargingEnabled) return;

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    for (const [id, vehicle] of this.vehicles) {
      if (vehicle.type !== 'electric') continue;

      if (vehicle.currentCharge < vehicle.targetCharge && currentTime === vehicle.preferredChargingTime) {
        await this.startCharging(id);
      }

      if (vehicle.currentCharge >= vehicle.targetCharge) {
        await this.stopCharging(id);
      }
    }
  }

  async startCharging(vehicleId, immediate = false) {
    const vehicle = this.vehicles.get(vehicleId);
    if (!vehicle) return;

    const charger = Array.from(this.chargers.values())[0];
    if (!charger) {
      this.log('No charger available');
      return;
    }

    if (!immediate && this.smartChargingEnabled) {
      const optimalTime = await this.findOptimalChargingTime(vehicle);
      if (optimalTime > Date.now()) {
        this.log(`Smart charging: Delaying start to ${new Date(optimalTime).toLocaleTimeString()}`);
        setTimeout(() => this.executeCharging(vehicle, charger), optimalTime - Date.now());
        return;
      }
    }

    await this.executeCharging(vehicle, charger);
  }

  async executeCharging(vehicle, charger) {
    try {
      if (charger.device.hasCapability('onoff')) {
        await charger.device.setCapabilityValue('onoff', true);
      }

      charger.charging = true;
      charger.assignedVehicle = vehicle.id;
      vehicle.charging = true;

      this.log(`Charging started for ${vehicle.name}`);

      try {
        const notificationManager = this.homey.app.advancedNotificationManager;
        if (notificationManager) {
          await notificationManager.sendNotification({
            title: '⚡ Laddning påbörjad',
            message: `${vehicle.name} laddar nu (${vehicle.currentCharge}% → ${vehicle.targetCharge}%)`,
            priority: 'low',
            category: 'vehicle'
          });
        }
      } catch (err) {
        this.error('Failed to send charging notification:', err.message);
      }
    } catch (err) {
      this.error(`Failed to start charging: ${err.message}`);
    }
  }

  async findOptimalChargingTime(vehicle) {
    try {
      const energyForecasting = this.homey.app.energyForecastingEngine;
      if (energyForecasting) {
        const forecast = await energyForecasting.getOptimalTimeSlot();
        if (forecast?.timestamp) return forecast.timestamp;
      }
    } catch (err) {
      this.error('Energy forecast unavailable:', err.message);
    }
    return Date.now() + 3600000;
  }

  async stopCharging(vehicleId) {
    const vehicle = this.vehicles.get(vehicleId);
    if (!vehicle) return;

    const charger = Array.from(this.chargers.values()).find(c => c.assignedVehicle === vehicleId) ||
      Array.from(this.chargers.values())[0];
    if (!charger) return;

    try {
      if (charger.device.hasCapability('onoff')) {
        await charger.device.setCapabilityValue('onoff', false);
      }

      charger.charging = false;
      vehicle.charging = false;

      const activeSession = this.chargingSessions.find(s => s.chargerId === charger.id && !s.endTime);
      if (activeSession) {
        activeSession.endTime = Date.now();

        // Record cost
        this.fuelCostHistory.push({
          vehicleId: vehicle.id,
          type: 'charging',
          energyKwh: activeSession.energyDelivered,
          cost: activeSession.cost,
          timestamp: Date.now()
        });

        try {
          const notificationManager = this.homey.app.advancedNotificationManager;
          if (notificationManager) {
            await notificationManager.sendNotification({
              title: '✅ Laddning klar',
              message: `${vehicle.name} har laddats (${activeSession.energyDelivered.toFixed(1)} kWh, ${activeSession.cost.toFixed(2)} SEK)`,
              priority: 'low',
              category: 'vehicle'
            });
          }
        } catch (err) {
          this.error('Failed to send charging complete notification:', err.message);
        }
      }

      this.log(`Charging stopped for ${vehicle.name}`);
    } catch (err) {
      this.error(`Failed to stop charging: ${err.message}`);
    }
  }

  async checkGarageDoors() {
    for (const [id, door] of this.garageDoors) {
      try {
        if (door.device.hasCapability('alarm_contact')) {
          const open = await door.device.getCapabilityValue('alarm_contact');

          if (open && !door.open) {
            door.openedAt = Date.now();
          }

          door.open = open;

          if (door.open && door.openedAt && Date.now() - door.openedAt > 1800000) {
            await this.sendGarageDoorAlert(door);
          }
        }
      } catch (err) {
        this.error(`Garage door check failed for ${door.name}:`, err.message);
      }
    }
  }

  async sendGarageDoorAlert(door) {
    try {
      const notificationManager = this.homey.app.advancedNotificationManager;
      if (notificationManager) {
        await notificationManager.sendNotification({
          title: '⚠️ Garageport öppen',
          message: `${door.name} har varit öppen i över 30 minuter`,
          priority: 'normal',
          category: 'vehicle'
        });
      }
    } catch (err) {
      this.error('Failed to send garage door alert:', err.message);
    }
  }

  async openGarageDoor(doorId) {
    const door = this.garageDoors.get(doorId);
    if (!door) return;

    try {
      if (door.device.hasCapability('button')) {
        await door.device.setCapabilityValue('button', true);
      }
      door.open = true;
      door.openedAt = Date.now();
      this.log(`Garage door opened: ${door.name}`);
    } catch (err) {
      this.error(`Failed to open garage door: ${err.message}`);
    }
  }

  async closeGarageDoor(doorId) {
    const door = this.garageDoors.get(doorId);
    if (!door) return;

    try {
      if (door.device.hasCapability('button')) {
        await door.device.setCapabilityValue('button', true);
      }
      door.open = false;
      this.log(`Garage door closed: ${door.name}`);
    } catch (err) {
      this.error(`Failed to close garage door: ${err.message}`);
    }
  }

  // ── Persistence ───────────────────────────────────────────────────────

  async saveVehicleProfiles() {
    try {
      const profiles = {};
      this.vehicles.forEach((vehicle, id) => { profiles[id] = vehicle; });
      await this.homey.settings.set('vehicleProfiles', profiles);
    } catch (err) {
      this.error('Failed to save vehicle profiles:', err.message);
    }
  }

  async loadTripHistory() {
    try {
      const saved = await this.homey.settings.get('tripHistory') || [];
      this.tripHistory = saved.slice(-500);
    } catch (err) {
      this.error('Failed to load trip history:', err.message);
    }
  }

  async saveTripHistory() {
    try {
      await this.homey.settings.set('tripHistory', this.tripHistory.slice(-500));
    } catch (err) {
      this.error('Failed to save trip history:', err.message);
    }
  }

  async loadMaintenanceSchedules() {
    try {
      const saved = await this.homey.settings.get('vehicleMaintenanceSchedules') || {};
      Object.entries(saved).forEach(([key, data]) => this.maintenanceSchedules.set(key, data));
    } catch (err) {
      this.error('Failed to load maintenance schedules:', err.message);
    }
  }

  async saveMaintenanceSchedules() {
    try {
      const obj = {};
      this.maintenanceSchedules.forEach((v, k) => { obj[k] = v; });
      await this.homey.settings.set('vehicleMaintenanceSchedules', obj);
    } catch (err) {
      this.error('Failed to save maintenance schedules:', err.message);
    }
  }

  async loadDepartureLearning() {
    try {
      const saved = await this.homey.settings.get('departureLearning') || {};
      if (saved.departuresByDay) {
        this.drivingPatterns.departuresByDay = saved.departuresByDay;
      }
    } catch (err) {
      this.error('Failed to load departure learning:', err.message);
    }
  }

  // ── Statistics ────────────────────────────────────────────────────────

  getStatistics() {
    const totalEnergy = this.chargingSessions.reduce((sum, s) => sum + s.energyDelivered, 0);
    const totalCost = this.chargingSessions.reduce((sum, s) => sum + s.cost, 0);
    const drivingAnalysis = this.getDrivingAnalysis();

    return {
      vehicles: this.vehicles.size,
      chargers: this.chargers.size,
      garageDoors: this.garageDoors.size,
      chargingSessions: this.chargingSessions.length,
      totalEnergyDelivered: totalEnergy.toFixed(1),
      totalChargingCost: totalCost.toFixed(2),
      smartChargingEnabled: this.smartChargingEnabled,
      garageAutomationEnabled: this.garageAutomationEnabled,
      totalTrips: this.tripHistory.length,
      totalDrivingDistanceKm: drivingAnalysis.totalDistanceKm || 0,
      totalDrivingCostSEK: drivingAnalysis.totalCostSEK || 0,
      maintenanceReminders: this.maintenanceSchedules.size,
      plannedTrips: this.plannedTrips.size,
      locationTriggers: this.locationTriggers.size,
      speedTriggers: this.speedTriggers.length
    };
  }

  // ── Cleanup ───────────────────────────────────────────────────────────

  destroy() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    for (const [id, timer] of this.preconditioningTimers) {
      clearTimeout(timer);
    }
    this.preconditioningTimers.clear();
    this.log('Vehicle Integration System destroyed');
  }

  log(...args) {
    console.log('[VehicleIntegrationSystem]', ...args);
  }

  error(...args) {
    console.error('[VehicleIntegrationSystem]', ...args);
  }
}

module.exports = VehicleIntegrationSystem;
