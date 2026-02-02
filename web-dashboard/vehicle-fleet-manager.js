'use strict';

/**
 * Vehicle Fleet Manager
 * Intelligent management for household vehicles with EV integration
 */
class VehicleFleetManager {
  constructor(app) {
    this.app = app;
    this.vehicles = new Map();
    this.trips = [];
    this.maintenanceRecords = [];
    this.fuelPrices = new Map();
    this.chargingSessions = [];
  }

  async initialize() {
    await this.loadVehicles();
    await this.loadFuelPrices();
    
    this.startMonitoring();
  }

  // ============================================
  // VEHICLE MANAGEMENT
  // ============================================

  async loadVehicles() {
    const vehiclesData = [
      {
        id: 'ev_tesla',
        type: 'electric',
        make: 'Tesla',
        model: 'Model 3',
        year: 2023,
        licensePlate: 'ABC123',
        batteryCapacity: 75, // kWh
        range: 580, // km
        efficiency: 15.5, // kWh/100km
        maxChargeRate: 11, // kW
        minChargeLevel: 20, // %
        maxChargeLevel: 80, // %
        purchaseDate: Date.now() - 365 * 24 * 60 * 60 * 1000,
        purchasePrice: 450000,
        odometer: 15000,
        currentSoC: 65,
        location: 'home',
        status: 'parked',
        insuranceExpiry: Date.now() + 180 * 24 * 60 * 60 * 1000,
        inspectionDue: Date.now() + 240 * 24 * 60 * 60 * 1000
      },
      {
        id: 'car_volvo',
        type: 'phev',
        make: 'Volvo',
        model: 'XC60 T8',
        year: 2022,
        licensePlate: 'XYZ789',
        batteryCapacity: 18.8, // kWh
        electricRange: 80, // km
        fuelTankCapacity: 71, // liters
        fuelType: 'bensin',
        efficiency: 2.1, // l/100km (electric mode)
        fuelEfficiency: 7.8, // l/100km (hybrid)
        maxChargeRate: 3.7, // kW
        purchaseDate: Date.now() - 730 * 24 * 60 * 60 * 1000,
        purchasePrice: 650000,
        odometer: 42000,
        currentSoC: 45,
        fuelLevel: 68, // %
        location: 'home',
        status: 'parked',
        insuranceExpiry: Date.now() + 90 * 24 * 60 * 60 * 1000,
        inspectionDue: Date.now() + 150 * 24 * 60 * 60 * 1000
      },
      {
        id: 'bike_electric',
        type: 'e-bike',
        make: 'Crescent',
        model: 'Elcykel Pro',
        year: 2023,
        batteryCapacity: 0.625, // kWh (625Wh)
        range: 100, // km
        efficiency: 0.625, // kWh/100km
        maxChargeRate: 0.25, // kW
        purchaseDate: Date.now() - 180 * 24 * 60 * 60 * 1000,
        purchasePrice: 25000,
        odometer: 850,
        currentSoC: 80,
        location: 'home',
        status: 'available'
      }
    ];

    for (const vehicle of vehiclesData) {
      this.vehicles.set(vehicle.id, {
        ...vehicle,
        totalCost: vehicle.purchasePrice,
        totalFuelCost: 0,
        totalElectricityCost: 0,
        totalMaintenanceCost: 0,
        co2Saved: 0
      });
    }
  }

  async addVehicle(data) {
    const id = `vehicle_${Date.now()}`;
    
    this.vehicles.set(id, {
      id,
      ...data,
      totalCost: data.purchasePrice || 0,
      totalFuelCost: 0,
      totalElectricityCost: 0,
      totalMaintenanceCost: 0,
      co2Saved: 0
    });

    console.log(`🚗 Added vehicle: ${data.make} ${data.model}`);

    return { success: true, vehicle: this.vehicles.get(id) };
  }

  async updateVehicleStatus(vehicleId, updates) {
    const vehicle = this.vehicles.get(vehicleId);
    
    if (!vehicle) {
      return { success: false, error: 'Vehicle not found' };
    }

    Object.assign(vehicle, updates);

    console.log(`📝 Updated ${vehicle.make} ${vehicle.model}: ${JSON.stringify(updates)}`);

    return { success: true, vehicle };
  }

  // ============================================
  // TRIP TRACKING
  // ============================================

  async startTrip(vehicleId, destination = null) {
    const vehicle = this.vehicles.get(vehicleId);
    
    if (!vehicle) {
      return { success: false, error: 'Vehicle not found' };
    }

    const trip = {
      id: `trip_${Date.now()}`,
      vehicleId,
      startTime: Date.now(),
      startLocation: vehicle.location,
      destination,
      startOdometer: vehicle.odometer,
      startSoC: vehicle.currentSoC,
      startFuelLevel: vehicle.fuelLevel || null,
      status: 'in-progress'
    };

    this.trips.push(trip);
    vehicle.status = 'driving';

    console.log(`🚦 Started trip with ${vehicle.make} ${vehicle.model} to ${destination || 'unknown'}`);

    return { success: true, trip };
  }

  async endTrip(tripId, data = {}) {
    const trip = this.trips.find(t => t.id === tripId);
    
    if (!trip) {
      return { success: false, error: 'Trip not found' };
    }

    const vehicle = this.vehicles.get(trip.vehicleId);

    // Calculate trip details
    const distance = data.distance || Math.random() * 50 + 10; // km
    const duration = Date.now() - trip.startTime;
    const endSoC = trip.startSoC - (distance / vehicle.range) * 100;

    trip.endTime = Date.now();
    trip.endLocation = data.endLocation || 'unknown';
    trip.endOdometer = trip.startOdometer + distance;
    trip.distance = distance;
    trip.duration = duration;
    trip.endSoC = Math.max(0, endSoC);
    trip.averageSpeed = (distance / (duration / (1000 * 60 * 60))).toFixed(1);
    trip.status = 'completed';

    // Calculate costs
    if (vehicle.type === 'electric' || vehicle.type === 'e-bike') {
      const energyUsed = (distance / 100) * vehicle.efficiency; // kWh
      const electricityPrice = 1.8; // SEK/kWh average
      trip.energyCost = energyUsed * electricityPrice;
      vehicle.totalElectricityCost += trip.energyCost;

      // CO2 savings vs gasoline
      const gasolineEquivalent = distance * 0.12; // liters
      const co2Saved = gasolineEquivalent * 2.31; // kg CO2
      trip.co2Saved = co2Saved;
      vehicle.co2Saved += co2Saved;
    } else if (vehicle.type === 'phev') {
      // Mix of electric and fuel
      const electricDistance = Math.min(distance, vehicle.electricRange * (trip.startSoC / 100));
      const fuelDistance = distance - electricDistance;

      const energyUsed = (electricDistance / 100) * vehicle.efficiency;
      const fuelUsed = (fuelDistance / 100) * vehicle.fuelEfficiency;

      trip.energyUsed = energyUsed;
      trip.fuelUsed = fuelUsed;
      trip.energyCost = energyUsed * 1.8;
      trip.fuelCost = fuelUsed * this.getFuelPrice(vehicle.fuelType);
      trip.totalCost = trip.energyCost + trip.fuelCost;

      vehicle.totalElectricityCost += trip.energyCost;
      vehicle.totalFuelCost += trip.fuelCost;

      // Update fuel level
      vehicle.fuelLevel = Math.max(0, vehicle.fuelLevel - (fuelUsed / vehicle.fuelTankCapacity) * 100);

      // CO2 savings
      const gasolineEquivalent = electricDistance * 0.08;
      trip.co2Saved = gasolineEquivalent * 2.31;
      vehicle.co2Saved += trip.co2Saved;
    }

    // Update vehicle
    vehicle.odometer = trip.endOdometer;
    vehicle.currentSoC = trip.endSoC;
    vehicle.location = trip.endLocation;
    vehicle.status = 'parked';

    console.log(`🏁 Completed trip: ${distance.toFixed(1)} km, ${(duration / 60000).toFixed(0)} min`);

    return { success: true, trip };
  }

  // ============================================
  // CHARGING MANAGEMENT
  // ============================================

  async startCharging(vehicleId, chargeType = 'home', targetSoC = null) {
    const vehicle = this.vehicles.get(vehicleId);
    
    if (!vehicle) {
      return { success: false, error: 'Vehicle not found' };
    }

    if (!['electric', 'phev', 'e-bike'].includes(vehicle.type)) {
      return { success: false, error: 'Vehicle not electric' };
    }

    const target = targetSoC || (vehicle.maxChargeLevel || 100);

    const session = {
      id: `charge_${Date.now()}`,
      vehicleId,
      startTime: Date.now(),
      startSoC: vehicle.currentSoC,
      targetSoC: target,
      chargeType, // home, public-ac, public-dc
      status: 'charging',
      power: this.getChargePower(vehicle, chargeType)
    };

    this.chargingSessions.push(session);
    vehicle.status = 'charging';

    console.log(`🔌 Started charging ${vehicle.make} ${vehicle.model} from ${vehicle.currentSoC}% to ${target}%`);

    // Simulate charging
    this.simulateCharging(session);

    return { success: true, session };
  }

  getChargePower(vehicle, chargeType) {
    const powers = {
      'home': Math.min(vehicle.maxChargeRate, 11), // Standard home charging
      'public-ac': Math.min(vehicle.maxChargeRate, 22), // Public AC
      'public-dc': Math.min(50, vehicle.maxChargeRate * 5) // DC fast charging
    };
    return powers[chargeType] || vehicle.maxChargeRate;
  }

  async simulateCharging(session) {
    const vehicle = this.vehicles.get(session.vehicleId);
    
    const interval = setInterval(() => {
      if (session.status !== 'charging') {
        clearInterval(interval);
        return;
      }

      // Calculate charge added per minute
      const chargePerMinute = (session.power / 60) / vehicle.batteryCapacity * 100;
      
      vehicle.currentSoC = Math.min(session.targetSoC, vehicle.currentSoC + chargePerMinute);

      // Check if target reached
      if (vehicle.currentSoC >= session.targetSoC - 0.5) {
        this.stopCharging(session.id);
        clearInterval(interval);
      }
    }, 60000); // Update every minute
  }

  async stopCharging(sessionId) {
    const session = this.chargingSessions.find(s => s.id === sessionId);
    
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    const vehicle = this.vehicles.get(session.vehicleId);

    session.endTime = Date.now();
    session.endSoC = vehicle.currentSoC;
    session.duration = session.endTime - session.startTime;
    session.status = 'completed';

    // Calculate energy and cost
    const socGained = session.endSoC - session.startSoC;
    session.energyAdded = (socGained / 100) * vehicle.batteryCapacity;

    const pricePerKwh = {
      'home': 1.5, // Cheap home electricity
      'public-ac': 2.5, // Public AC
      'public-dc': 4.5 // Expensive DC fast charging
    }[session.chargeType] || 2.0;

    session.cost = session.energyAdded * pricePerKwh;
    vehicle.totalElectricityCost += session.cost;

    vehicle.status = 'parked';

    console.log(`✅ Charging complete: ${socGained.toFixed(1)}% added, ${session.energyAdded.toFixed(2)} kWh, ${session.cost.toFixed(2)} SEK`);

    return { success: true, session };
  }

  // ============================================
  // MAINTENANCE TRACKING
  // ============================================

  async addMaintenanceRecord(vehicleId, data) {
    const vehicle = this.vehicles.get(vehicleId);
    
    if (!vehicle) {
      return { success: false, error: 'Vehicle not found' };
    }

    const record = {
      id: `maint_${Date.now()}`,
      vehicleId,
      timestamp: Date.now(),
      type: data.type, // service, repair, inspection, tire-change
      description: data.description,
      cost: data.cost || 0,
      odometer: vehicle.odometer,
      nextServiceDue: data.nextServiceDue || null
    };

    this.maintenanceRecords.push(record);
    vehicle.totalMaintenanceCost += record.cost;

    console.log(`🔧 Maintenance recorded for ${vehicle.make}: ${data.description} (${record.cost} SEK)`);

    return { success: true, record };
  }

  getMaintenanceSchedule(vehicleId) {
    const vehicle = this.vehicles.get(vehicleId);
    
    if (!vehicle) return null;

    const schedule = [];

    // Service intervals (km)
    const serviceIntervals = {
      'electric': 20000,
      'phev': 15000,
      'e-bike': 3000,
      'gasoline': 15000,
      'diesel': 15000
    };

    const interval = serviceIntervals[vehicle.type] || 15000;
    const lastService = this.maintenanceRecords
      .filter(r => r.vehicleId === vehicleId && r.type === 'service')
      .sort((a, b) => b.odometer - a.odometer)[0];

    const lastServiceOdometer = lastService ? lastService.odometer : 0;
    const kmUntilService = interval - (vehicle.odometer - lastServiceOdometer);

    if (kmUntilService < 2000) {
      schedule.push({
        type: 'service',
        description: 'Ordinarie service',
        dueIn: `${kmUntilService} km`,
        urgency: kmUntilService < 500 ? 'high' : 'medium'
      });
    }

    // Insurance
    const daysToInsurance = (vehicle.insuranceExpiry - Date.now()) / (24 * 60 * 60 * 1000);
    if (daysToInsurance < 60) {
      schedule.push({
        type: 'insurance',
        description: 'Förnya försäkring',
        dueIn: `${Math.ceil(daysToInsurance)} dagar`,
        urgency: daysToInsurance < 14 ? 'high' : 'medium'
      });
    }

    // Inspection
    const daysToInspection = (vehicle.inspectionDue - Date.now()) / (24 * 60 * 60 * 1000);
    if (daysToInspection < 60) {
      schedule.push({
        type: 'inspection',
        description: 'Besiktning',
        dueIn: `${Math.ceil(daysToInspection)} dagar`,
        urgency: daysToInspection < 14 ? 'high' : 'medium'
      });
    }

    // Tire change (seasonal)
    const month = new Date().getMonth();
    if (month === 9 || month === 10) { // October-November
      schedule.push({
        type: 'tires',
        description: 'Vinterdäck',
        dueIn: 'snart',
        urgency: 'medium'
      });
    } else if (month === 3 || month === 4) { // April-May
      schedule.push({
        type: 'tires',
        description: 'Sommardäck',
        dueIn: 'snart',
        urgency: 'medium'
      });
    }

    return schedule;
  }

  // ============================================
  // FUEL PRICING
  // ============================================

  async loadFuelPrices() {
    // Swedish fuel prices (SEK/liter)
    this.fuelPrices.set('bensin', 18.5);
    this.fuelPrices.set('diesel', 19.2);
    this.fuelPrices.set('etanol', 14.8);
  }

  getFuelPrice(fuelType) {
    return this.fuelPrices.get(fuelType) || 18.0;
  }

  async updateFuelPrice(fuelType, price) {
    this.fuelPrices.set(fuelType, price);
    console.log(`⛽ Updated ${fuelType} price: ${price} SEK/liter`);
    return { success: true };
  }

  // ============================================
  // SMART FEATURES
  // ============================================

  async optimizeCharging(vehicleId, departureTime = null) {
    const vehicle = this.vehicles.get(vehicleId);
    
    if (!vehicle) {
      return { success: false, error: 'Vehicle not found' };
    }

    if (!['electric', 'phev'].includes(vehicle.type)) {
      return { success: false, error: 'Vehicle not electric' };
    }

    // Get cheap electricity hours (assuming integration with energy price optimizer)
    const now = new Date();
    const currentHour = now.getHours();
    
    // Cheap hours typically 22:00-06:00
    const cheapHours = [22, 23, 0, 1, 2, 3, 4, 5, 6];
    const isCurrentlyCheap = cheapHours.includes(currentHour);

    // Calculate charging time needed
    const targetSoC = vehicle.maxChargeLevel || 80;
    const socToAdd = targetSoC - vehicle.currentSoC;
    const energyNeeded = (socToAdd / 100) * vehicle.batteryCapacity;
    const hoursNeeded = energyNeeded / vehicle.maxChargeRate;

    let recommendation;

    if (isCurrentlyCheap) {
      recommendation = {
        action: 'charge_now',
        reason: 'Billig eltid just nu',
        estimatedCost: (energyNeeded * 1.5).toFixed(2),
        estimatedTime: Math.ceil(hoursNeeded * 60)
      };
    } else if (currentHour < 22 && !departureTime) {
      recommendation = {
        action: 'wait',
        reason: 'Vänta till kl 22:00 för billigare el',
        startTime: '22:00',
        potentialSavings: ((energyNeeded * 2.5) - (energyNeeded * 1.5)).toFixed(2),
        estimatedCost: (energyNeeded * 1.5).toFixed(2)
      };
    } else {
      recommendation = {
        action: 'charge_now',
        reason: 'Ladda nu för att hinna till avresetid',
        estimatedCost: (energyNeeded * 2.5).toFixed(2),
        estimatedTime: Math.ceil(hoursNeeded * 60)
      };
    }

    return {
      success: true,
      vehicle: {
        make: vehicle.make,
        model: vehicle.model,
        currentSoC: vehicle.currentSoC,
        targetSoC
      },
      energyNeeded: energyNeeded.toFixed(2),
      hoursNeeded: hoursNeeded.toFixed(1),
      recommendation
    };
  }

  getRecommendedVehicle(tripDistance, tripType = 'normal') {
    const vehicles = Array.from(this.vehicles.values())
      .filter(v => v.status === 'parked' || v.status === 'available');

    if (vehicles.length === 0) {
      return { success: false, error: 'No vehicles available' };
    }

    const scores = vehicles.map(vehicle => {
      let score = 0;
      let reasons = [];

      // Range check
      let effectiveRange;
      if (vehicle.type === 'electric' || vehicle.type === 'e-bike') {
        effectiveRange = (vehicle.currentSoC / 100) * vehicle.range;
      } else if (vehicle.type === 'phev') {
        const electricRange = (vehicle.currentSoC / 100) * vehicle.electricRange;
        const fuelRange = (vehicle.fuelLevel / 100) * (vehicle.fuelTankCapacity / vehicle.fuelEfficiency) * 100;
        effectiveRange = electricRange + fuelRange;
      }

      if (effectiveRange < tripDistance) {
        score -= 100;
        reasons.push('Otillräcklig räckvidd');
      } else if (effectiveRange > tripDistance * 2) {
        score += 20;
        reasons.push('God marginal');
      }

      // Cost efficiency
      if (vehicle.type === 'electric' || vehicle.type === 'e-bike') {
        const cost = (tripDistance / 100) * vehicle.efficiency * 1.8;
        score += (20 - cost) * 2; // Lower cost = higher score
        reasons.push(`Låg kostnad (~${cost.toFixed(0)} SEK)`);
      }

      // Environmental
      if (vehicle.type === 'electric' || vehicle.type === 'e-bike') {
        score += 30;
        reasons.push('Miljövänlig');
      } else if (vehicle.type === 'phev' && vehicle.currentSoC > 50) {
        score += 15;
        reasons.push('Kan köra elektriskt');
      }

      // Short trips favor e-bike
      if (tripDistance < 10 && vehicle.type === 'e-bike') {
        score += 25;
        reasons.push('Perfekt för korta sträckor');
      }

      // Long trips favor cars
      if (tripDistance > 50 && vehicle.type !== 'e-bike') {
        score += 15;
        reasons.push('Lämplig för längre resa');
      }

      return {
        vehicle,
        score,
        reasons,
        estimatedCost: this.calculateTripCost(vehicle, tripDistance)
      };
    });

    scores.sort((a, b) => b.score - a.score);

    return {
      success: true,
      recommended: {
        vehicle: `${scores[0].vehicle.make} ${scores[0].vehicle.model}`,
        reasons: scores[0].reasons,
        estimatedCost: scores[0].estimatedCost.toFixed(2)
      },
      alternatives: scores.slice(1).map(s => ({
        vehicle: `${s.vehicle.make} ${s.vehicle.model}`,
        estimatedCost: s.estimatedCost.toFixed(2)
      }))
    };
  }

  calculateTripCost(vehicle, distance) {
    if (vehicle.type === 'electric' || vehicle.type === 'e-bike') {
      return (distance / 100) * vehicle.efficiency * 1.8; // SEK
    } else if (vehicle.type === 'phev') {
      const electricDistance = Math.min(distance, (vehicle.currentSoC / 100) * vehicle.electricRange);
      const fuelDistance = distance - electricDistance;
      const electricCost = (electricDistance / 100) * vehicle.efficiency * 1.8;
      const fuelCost = (fuelDistance / 100) * vehicle.fuelEfficiency * this.getFuelPrice(vehicle.fuelType);
      return electricCost + fuelCost;
    }
    return 0;
  }

  // ============================================
  // MONITORING
  // ============================================

  startMonitoring() {
    // Check for low battery/fuel
    setInterval(() => {
      this.checkVehicleStatus();
    }, 60 * 60 * 1000); // Every hour

    // Check maintenance due
    setInterval(() => {
      this.checkMaintenanceDue();
    }, 24 * 60 * 60 * 1000); // Daily

    // Initial check
    this.checkVehicleStatus();
    this.checkMaintenanceDue();
  }

  async checkVehicleStatus() {
    for (const [id, vehicle] of this.vehicles) {
      // Low battery warning
      if (['electric', 'phev', 'e-bike'].includes(vehicle.type)) {
        if (vehicle.currentSoC < 20) {
          console.log(`⚠️ ${vehicle.make} ${vehicle.model}: Låg batterinivå (${vehicle.currentSoC}%)`);
          
          // Suggest charging
          const optimization = await this.optimizeCharging(id);
          if (optimization.success) {
            console.log(`  💡 ${optimization.recommendation.reason}`);
          }
        }
      }

      // Low fuel warning
      if (vehicle.fuelLevel && vehicle.fuelLevel < 15) {
        console.log(`⚠️ ${vehicle.make} ${vehicle.model}: Låg bränslenivå (${vehicle.fuelLevel}%)`);
      }
    }
  }

  async checkMaintenanceDue() {
    for (const [id, vehicle] of this.vehicles) {
      const schedule = this.getMaintenanceSchedule(id);
      
      if (schedule && schedule.length > 0) {
        const urgent = schedule.filter(s => s.urgency === 'high');
        
        if (urgent.length > 0) {
          console.log(`🔧 ${vehicle.make} ${vehicle.model}: Underhåll krävs!`);
          urgent.forEach(item => {
            console.log(`  - ${item.description} (${item.dueIn})`);
          });
        }
      }
    }
  }

  // ============================================
  // REPORTING & ANALYTICS
  // ============================================

  getFleetOverview() {
    const vehicles = Array.from(this.vehicles.values());
    
    const overview = {
      totalVehicles: vehicles.length,
      byType: {},
      totalValue: 0,
      totalOdometer: 0,
      availableVehicles: 0
    };

    for (const vehicle of vehicles) {
      // Count by type
      overview.byType[vehicle.type] = (overview.byType[vehicle.type] || 0) + 1;

      // Totals
      overview.totalValue += vehicle.purchasePrice;
      overview.totalOdometer += vehicle.odometer;

      // Available
      if (vehicle.status === 'parked' || vehicle.status === 'available') {
        overview.availableVehicles++;
      }
    }

    return overview;
  }

  getVehicleReport(vehicleId) {
    const vehicle = this.vehicles.get(vehicleId);
    
    if (!vehicle) return null;

    const trips = this.trips.filter(t => t.vehicleId === vehicleId && t.status === 'completed');
    const chargingSessions = this.chargingSessions.filter(c => c.vehicleId === vehicleId && c.status === 'completed');
    const maintenance = this.maintenanceRecords.filter(m => m.vehicleId === vehicleId);

    const totalDistance = trips.reduce((sum, t) => sum + (t.distance || 0), 0);
    const totalTrips = trips.length;

    const report = {
      vehicle: {
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        type: vehicle.type
      },
      usage: {
        totalDistance: Math.round(totalDistance),
        totalTrips,
        averageTripDistance: totalTrips > 0 ? (totalDistance / totalTrips).toFixed(1) : 0,
        currentOdometer: vehicle.odometer
      },
      costs: {
        purchase: vehicle.purchasePrice,
        fuel: Math.round(vehicle.totalFuelCost),
        electricity: Math.round(vehicle.totalElectricityCost),
        maintenance: Math.round(vehicle.totalMaintenanceCost),
        total: Math.round(vehicle.totalCost + vehicle.totalFuelCost + vehicle.totalElectricityCost + vehicle.totalMaintenanceCost)
      },
      environmental: {
        co2Saved: Math.round(vehicle.co2Saved),
        treesEquivalent: Math.round(vehicle.co2Saved / 21) // One tree absorbs ~21 kg CO2/year
      },
      maintenance: {
        totalRecords: maintenance.length,
        lastService: maintenance.filter(m => m.type === 'service').sort((a, b) => b.timestamp - a.timestamp)[0]
      },
      charging: {
        totalSessions: chargingSessions.length,
        totalEnergyAdded: chargingSessions.reduce((sum, c) => sum + (c.energyAdded || 0), 0).toFixed(2)
      }
    };

    return report;
  }

  getCostComparison(days = 30) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const recentTrips = this.trips.filter(t => t.startTime >= cutoff && t.status === 'completed');

    const byVehicle = {};

    for (const trip of recentTrips) {
      const vehicle = this.vehicles.get(trip.vehicleId);
      if (!vehicle) continue;

      if (!byVehicle[trip.vehicleId]) {
        byVehicle[trip.vehicleId] = {
          vehicle: `${vehicle.make} ${vehicle.model}`,
          type: vehicle.type,
          distance: 0,
          cost: 0,
          trips: 0
        };
      }

      byVehicle[trip.vehicleId].distance += trip.distance || 0;
      byVehicle[trip.vehicleId].cost += (trip.energyCost || 0) + (trip.fuelCost || 0) + (trip.totalCost || 0);
      byVehicle[trip.vehicleId].trips += 1;
    }

    // Calculate cost per km
    const comparison = Object.values(byVehicle).map(v => ({
      ...v,
      costPerKm: v.distance > 0 ? (v.cost / v.distance).toFixed(2) : 0
    })).sort((a, b) => parseFloat(a.costPerKm) - parseFloat(b.costPerKm));

    return {
      period: `${days} days`,
      vehicles: comparison
    };
  }
}

module.exports = VehicleFleetManager;
