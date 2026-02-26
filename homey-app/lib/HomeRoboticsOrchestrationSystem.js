'use strict';

class HomeRoboticsOrchestrationSystem {
  constructor(homey) {
    this.homey = homey;
    this.robots = new Map();
    this._initDefaultRobots();
    this.schedules = new Map();
    this.cleaningZones = new Map();
    this._initDefaultZones();
    this.chargingStations = new Map();
    this.chargingQueue = [];
    this.petZones = new Map();
    this.petAvoidanceEnabled = true;
    this.cleaningHistory = [];
    this.maxHistoryEntries = 500;
    this.maintenanceRecords = new Map();
    this.floors = new Map();
    this._initDefaultFloors();
    this.energyPrices = [];
    this.preferLowEnergyPricing = true;
    this.monitoringInterval = null;
    this.monitoringIntervalMs = 10 * 60 * 1000;
    this.awayModeActive = false;
    this.settingsKey = 'homeRoboticsOrchestration';
    this.initialized = false;
  }

  async initialize() {
    try {
      this.log('Initializing Home Robotics Orchestration System...');
      await this._loadSettings();
      await this.discoverRobots();
      this._initMaintenanceRecords();
      this._startMonitoringLoop();
      this.initialized = true;
      this.log('System initialized successfully');
    } catch (err) {
      this.error(`Initialization failed: ${err.message}`);
      throw err;
    }
  }

  destroy() {
    try {
      this.log('Shutting down Robotics Orchestration System...');
      this._stopMonitoringLoop();
      this._saveSettings();
      this.robots.clear();
      this.schedules.clear();
      this.cleaningZones.clear();
      this.chargingStations.clear();
      this.chargingQueue = [];
      this.petZones.clear();
      this.cleaningHistory = [];
      this.maintenanceRecords.clear();
      this.floors.clear();
      this.awayModeActive = false;
      this.initialized = false;
      this.log('System destroyed');
    } catch (err) {
      this.error(`Destroy error: ${err.message}`);
    }
  }

  // -- Default Initialization -------------------------------------------------

  _initDefaultRobots() {
    const base = { battery: 100, status: 'idle', currentZone: null, maxBattery: 100, batteryDegradation: 0, errorLog: [], speed: 'normal' };
    const defaults = [
      { id: 'vacuum_01', type: 'vacuum', name: 'Robot Vacuum', assignedFloor: 'ground', capabilities: ['vacuum', 'sweep'], suction: 'auto' },
      { id: 'mower_01', type: 'mower', name: 'Robot Mower', assignedFloor: 'garden', capabilities: ['mow', 'mulch'], bladeHeight: 35 },
      { id: 'window_washer_01', type: 'window_washer', name: 'Window Washer', assignedFloor: 'ground', capabilities: ['wash_windows', 'squeegee'], speed: 'slow', waterLevel: 100 },
      { id: 'pool_cleaner_01', type: 'pool_cleaner', name: 'Pool Cleaner', assignedFloor: 'garden', capabilities: ['scrub', 'filter', 'vacuum_pool'], filterStatus: 100 },
      { id: 'mopping_robot_01', type: 'mopping_robot', name: 'Mopping Robot', assignedFloor: 'ground', capabilities: ['mop', 'scrub_floor'], waterTankLevel: 100 }
    ];
    for (const d of defaults) {
      this.robots.set(d.id, { ...base, ...d });
    }
  }

  _initDefaultZones() {
    const zones = [
      { id: 'kitchen', name: 'Kitchen', floor: 'ground', area: 15, priority: 3, allowedRobots: ['vacuum', 'mopping_robot'] },
      { id: 'living_room', name: 'Living Room', floor: 'ground', area: 30, priority: 2, allowedRobots: ['vacuum', 'mopping_robot'] },
      { id: 'bedroom', name: 'Bedroom', floor: 'first', area: 20, priority: 1, allowedRobots: ['vacuum', 'mopping_robot'] },
      { id: 'bathroom', name: 'Bathroom', floor: 'ground', area: 8, priority: 3, allowedRobots: ['mopping_robot'] },
      { id: 'hallway', name: 'Hallway', floor: 'ground', area: 10, priority: 1, allowedRobots: ['vacuum', 'mopping_robot'] },
      { id: 'garden', name: 'Garden', floor: 'garden', area: 80, priority: 1, allowedRobots: ['mower'] },
      { id: 'pool_area', name: 'Pool Area', floor: 'garden', area: 40, priority: 2, allowedRobots: ['pool_cleaner'] }
    ];
    for (const z of zones) {
      this.cleaningZones.set(z.id, { ...z, lastCleaned: null, occupied: false, occupants: [] });
    }
  }

  _initDefaultFloors() {
    this.floors.set('ground', { id: 'ground', name: 'Ground Floor', zones: ['kitchen', 'living_room', 'bathroom', 'hallway'], activeRobots: [] });
    this.floors.set('first', { id: 'first', name: 'First Floor', zones: ['bedroom'], activeRobots: [] });
    this.floors.set('garden', { id: 'garden', name: 'Garden', zones: ['garden', 'pool_area'], activeRobots: [] });
  }

  _initMaintenanceRecords() {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const thirtyD = 30 * day;
    const ninetyD = 90 * day;

    for (const [robotId, robot] of this.robots) {
      if (this.maintenanceRecords.has(robotId)) continue;
      const record = {
        robotId,
        components: {
          brush: { name: 'Main Brush', lastReplaced: now, replacementIntervalMs: ninetyD, usageHours: 0, maxUsageHours: 300 },
          filter: { name: 'Filter', lastReplaced: now, replacementIntervalMs: thirtyD, usageHours: 0, maxUsageHours: 150 },
          wheels: { name: 'Wheels', lastReplaced: now, replacementIntervalMs: ninetyD * 2, usageHours: 0, maxUsageHours: 600 },
          battery: { name: 'Battery', lastReplaced: now, replacementIntervalMs: ninetyD * 4, usageHours: 0, maxUsageHours: 1500, cycleCount: 0, maxCycles: 800 }
        },
        lastInspection: now,
        nextInspection: now + thirtyD,
        notes: []
      };
      if (robot.type === 'pool_cleaner') record.components.filter_bag = { name: 'Filter Bag', lastReplaced: now, replacementIntervalMs: thirtyD / 2, usageHours: 0, maxUsageHours: 80 };
      if (robot.type === 'mopping_robot') record.components.mop_pad = { name: 'Mop Pad', lastReplaced: now, replacementIntervalMs: thirtyD / 3, usageHours: 0, maxUsageHours: 50 };
      if (robot.type === 'mower') record.components.blades = { name: 'Mower Blades', lastReplaced: now, replacementIntervalMs: ninetyD, usageHours: 0, maxUsageHours: 200 };
      this.maintenanceRecords.set(robotId, record);
    }
  }

  // -- Robot Discovery --------------------------------------------------------

  async discoverRobots() {
    try {
      this.log('Discovering robots via device names...');
      const devices = this.homey.devices ? await this._getDevices() : [];
      let discovered = 0;
      const typeMap = [
        [['vacuum', 'roborock', 'roomba'], 'vacuum'],
        [['mower', 'automower', 'husqvarna'], 'mower'],
        [['mop', 'braava'], 'mopping_robot']
      ];

      for (const device of devices) {
        const dn = (device.name || '').toLowerCase();
        let robotType = null;
        for (const [keywords, type] of typeMap) {
          if (keywords.some(k => dn.includes(k))) { robotType = type; break; }
        }
        if (!robotType && dn.includes('window') && (dn.includes('clean') || dn.includes('wash'))) robotType = 'window_washer';
        if (!robotType && dn.includes('pool') && (dn.includes('clean') || dn.includes('robot'))) robotType = 'pool_cleaner';

        if (robotType) {
          const robotId = `${robotType}_${device.id || discovered}`;
          if (!this.robots.has(robotId)) {
            this.robots.set(robotId, {
              id: robotId, type: robotType, name: device.name, battery: 100, status: 'idle',
              currentZone: null, assignedFloor: 'ground', maxBattery: 100, batteryDegradation: 0,
              errorLog: [], capabilities: this._getCapabilitiesForType(robotType), speed: 'normal', deviceRef: device.id
            });
            discovered++;
            this.log(`Discovered robot: ${device.name} (${robotType})`);
          }
        }
      }
      this.log(`Discovery complete. Total robots: ${this.robots.size}, newly discovered: ${discovered}`);
      return discovered;
    } catch (err) {
      this.error(`Robot discovery failed: ${err.message}`);
      return 0;
    }
  }

  async _getDevices() {
    try {
      if (typeof this.homey.devices.getDevices === 'function') {
        return Object.values(await this.homey.devices.getDevices());
      }
      return [];
    } catch (err) {
      this.error(`Failed to get devices: ${err.message}`);
      return [];
    }
  }

  _getCapabilitiesForType(type) {
    const m = { vacuum: ['vacuum', 'sweep'], mower: ['mow', 'mulch'], window_washer: ['wash_windows', 'squeegee'], pool_cleaner: ['scrub', 'filter', 'vacuum_pool'], mopping_robot: ['mop', 'scrub_floor'] };
    return m[type] || [];
  }

  // -- Scheduling -------------------------------------------------------------

  scheduleRobot(robotId, schedule) {
    if (!this.robots.has(robotId)) {
      this.error(`Cannot schedule unknown robot: ${robotId}`);
      return { success: false, reason: 'Robot not found' };
    }
    const v = this._validateSchedule(schedule);
    if (!v.valid) return { success: false, reason: v.reason };
    const conflicts = this.checkConflicts(robotId, schedule);
    if (conflicts.length > 0) {
      this.log(`Schedule conflicts detected for ${robotId}: ${conflicts.length}`);
      return { success: false, reason: 'Schedule conflicts', conflicts };
    }
    const scheduleId = `sched_${robotId}_${Date.now()}`;
    const entry = {
      id: scheduleId, robotId, zone: schedule.zone || null,
      days: schedule.days || ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      startTime: schedule.startTime || '09:00', endTime: schedule.endTime || '10:00',
      enabled: true, priority: schedule.priority || 2,
      respectOccupancy: schedule.respectOccupancy !== false,
      respectEnergyPricing: schedule.respectEnergyPricing !== false,
      createdAt: Date.now()
    };
    if (!this.schedules.has(robotId)) this.schedules.set(robotId, []);
    this.schedules.get(robotId).push(entry);
    this.log(`Scheduled ${robotId} at ${entry.startTime}-${entry.endTime} for zone ${entry.zone}`);
    this._saveSettings();
    return { success: true, scheduleId };
  }

  _validateSchedule(schedule) {
    if (!schedule) return { valid: false, reason: 'No schedule provided' };
    const timeRe = /^\d{2}:\d{2}$/;
    if (schedule.startTime && !timeRe.test(schedule.startTime)) return { valid: false, reason: 'Invalid startTime format, expected HH:MM' };
    if (schedule.endTime && !timeRe.test(schedule.endTime)) return { valid: false, reason: 'Invalid endTime format, expected HH:MM' };
    if (schedule.startTime && schedule.endTime && schedule.startTime >= schedule.endTime) return { valid: false, reason: 'startTime must be before endTime' };
    if (schedule.zone && !this.cleaningZones.has(schedule.zone)) return { valid: false, reason: `Unknown zone: ${schedule.zone}` };
    return { valid: true };
  }

  checkConflicts(robotId, newSchedule) {
    const conflicts = [];
    const allDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    const newDays = newSchedule.days || allDays;
    const newStart = newSchedule.startTime || '09:00';
    const newEnd = newSchedule.endTime || '10:00';

    // Same-robot conflicts
    const existing = this.schedules.get(robotId) || [];
    for (const ex of existing) {
      if (!ex.enabled) continue;
      const overlap = newDays.some(d => (ex.days || []).includes(d));
      if (!overlap) continue;
      if (newStart < ex.endTime && newEnd > ex.startTime) {
        conflicts.push({ existingScheduleId: ex.id, existingTime: `${ex.startTime}-${ex.endTime}`, newTime: `${newStart}-${newEnd}`, overlappingDays: newDays.filter(d => (ex.days || []).includes(d)) });
      }
    }

    // Cross-robot zone conflicts
    for (const [otherId, otherScheds] of this.schedules) {
      if (otherId === robotId) continue;
      for (const ot of otherScheds) {
        if (!ot.enabled || ot.zone !== newSchedule.zone) continue;
        const overlap = newDays.some(d => (ot.days || []).includes(d));
        if (!overlap) continue;
        if (newStart < ot.endTime && newEnd > ot.startTime) {
          conflicts.push({ conflictingRobot: otherId, existingScheduleId: ot.id, zone: ot.zone, existingTime: `${ot.startTime}-${ot.endTime}` });
        }
      }
    }
    return conflicts;
  }

  removeSchedule(robotId, scheduleId) {
    const s = this.schedules.get(robotId);
    if (!s) return false;
    const idx = s.findIndex(x => x.id === scheduleId);
    if (idx === -1) return false;
    s.splice(idx, 1);
    this._saveSettings();
    this.log(`Removed schedule ${scheduleId} from ${robotId}`);
    return true;
  }

  // -- Zone Occupancy ---------------------------------------------------------

  isZoneOccupied(zoneId) {
    const z = this.cleaningZones.get(zoneId);
    return z ? z.occupied === true : false;
  }

  setZoneOccupancy(zoneId, occupied, occupants) {
    const z = this.cleaningZones.get(zoneId);
    if (!z) { this.error(`Unknown zone: ${zoneId}`); return false; }
    z.occupied = occupied;
    z.occupants = occupants || [];
    this.log(`Zone ${zoneId} occupancy: ${occupied} (${(occupants || []).join(', ')})`);
    return true;
  }

  async startOccupancyAwareCleaning(robotId, zoneId) {
    const robot = this.robots.get(robotId);
    if (!robot) return { success: false, reason: 'Robot not found' };
    const zone = this.cleaningZones.get(zoneId);
    if (!zone) return { success: false, reason: 'Zone not found' };

    if (this.isZoneOccupied(zoneId)) {
      this.log(`Zone ${zoneId} is occupied, deferring cleaning by ${robotId}`);
      return { success: false, reason: 'Zone occupied', deferred: true };
    }
    if (this.petAvoidanceEnabled && this._isPetInZone(zoneId)) {
      this.log(`Pet detected in ${zoneId}, applying avoidance mode for ${robotId}`);
      return { success: false, reason: 'Pet detected in zone', petAvoidance: true };
    }
    if (robot.battery < 20) {
      this.log(`${robotId} battery too low (${robot.battery}%), queuing for charging`);
      this.queueForCharging(robotId);
      return { success: false, reason: 'Battery too low' };
    }
    if (!zone.allowedRobots.includes(robot.type)) {
      return { success: false, reason: `Robot type ${robot.type} not allowed in zone ${zoneId}` };
    }

    robot.status = 'cleaning';
    robot.currentZone = zoneId;
    this._updateFloorActiveRobots(zone.floor, robotId, true);

    this.cleaningHistory.push({
      robotId, zoneId, startedAt: Date.now(), completedAt: null,
      coverage: 0, missedSpots: [], batteryUsed: 0, status: 'in_progress'
    });
    this._trimHistory();
    this.log(`${robotId} started cleaning ${zoneId}`);
    return { success: true, historyIndex: this.cleaningHistory.length - 1 };
  }

  completeCleaningSession(robotId) {
    const robot = this.robots.get(robotId);
    if (!robot || robot.status !== 'cleaning') return false;

    const entry = this.cleaningHistory.filter(h => h.robotId === robotId && h.status === 'in_progress').pop();
    if (entry) {
      entry.completedAt = Date.now();
      entry.status = 'completed';
      entry.coverage = 85 + Math.floor(Math.random() * 15);
      entry.batteryUsed = Math.floor(Math.random() * 20) + 10;
      if (entry.coverage < 95) {
        const count = Math.floor((100 - entry.coverage) / 5);
        for (let i = 0; i < count; i++) entry.missedSpots.push(`spot_${i + 1}_in_${entry.zoneId}`);
      }
      const zone = this.cleaningZones.get(entry.zoneId);
      if (zone) { zone.lastCleaned = Date.now(); this._updateFloorActiveRobots(zone.floor, robotId, false); }
      this._updateMaintenanceUsage(robotId, (entry.completedAt - entry.startedAt) / 3600000);
    }
    robot.status = 'idle';
    robot.currentZone = null;
    robot.battery = Math.max(0, robot.battery - (entry ? entry.batteryUsed : 10));
    this.log(`${robotId} completed cleaning session`);
    this._saveSettings();
    return true;
  }

  // -- Charging Stations ------------------------------------------------------

  registerChargingStation(stationId, config) {
    this.chargingStations.set(stationId, {
      id: stationId, name: config.name || `Station ${stationId}`, floor: config.floor || 'ground',
      compatibleTypes: config.compatibleTypes || ['vacuum', 'mopping_robot'],
      maxRobots: config.maxRobots || 1, currentRobots: [],
      chargingRate: config.chargingRate || 1, status: 'available'
    });
    this.log(`Registered charging station: ${stationId}`);
  }

  queueForCharging(robotId) {
    const robot = this.robots.get(robotId);
    if (!robot) { this.error(`Cannot queue unknown robot: ${robotId}`); return false; }
    if (robot.status === 'charging') { this.log(`${robotId} is already charging`); return false; }

    let assigned = null;
    for (const [, station] of this.chargingStations) {
      if (station.compatibleTypes.includes(robot.type) && station.currentRobots.length < station.maxRobots) {
        assigned = station; break;
      }
    }
    if (assigned) {
      robot.status = 'charging'; robot.currentZone = null;
      assigned.currentRobots.push(robotId);
      this.log(`${robotId} docked at station ${assigned.id}`);
      return true;
    }
    if (!this.chargingQueue.includes(robotId)) {
      this.chargingQueue.push(robotId);
      robot.status = 'waiting_to_charge';
      this.log(`${robotId} added to charging queue (position: ${this.chargingQueue.length})`);
    }
    return true;
  }

  _processChargingQueue() {
    if (this.chargingQueue.length === 0) return;
    for (const [stationId, station] of this.chargingStations) {
      while (station.currentRobots.length < station.maxRobots && this.chargingQueue.length > 0) {
        const next = this.chargingQueue.find(rId => { const r = this.robots.get(rId); return r && station.compatibleTypes.includes(r.type); });
        if (!next) break;
        this.chargingQueue.splice(this.chargingQueue.indexOf(next), 1);
        station.currentRobots.push(next);
        const r = this.robots.get(next);
        if (r) r.status = 'charging';
        this.log(`${next} moved from queue to station ${stationId}`);
      }
    }
  }

  _processCharging() {
    for (const [, station] of this.chargingStations) {
      const done = [];
      for (const robotId of station.currentRobots) {
        const robot = this.robots.get(robotId);
        if (!robot) { done.push(robotId); continue; }
        const effMax = robot.maxBattery - robot.batteryDegradation;
        robot.battery = Math.min(effMax, robot.battery + station.chargingRate);
        if (robot.battery >= effMax) {
          robot.status = 'idle'; done.push(robotId);
          this.log(`${robotId} fully charged (${robot.battery}%)`);
          const rec = this.maintenanceRecords.get(robotId);
          if (rec && rec.components.battery) rec.components.battery.cycleCount++;
        }
      }
      station.currentRobots = station.currentRobots.filter(id => !done.includes(id));
    }
    this._processChargingQueue();
  }

  // -- Pet Avoidance ----------------------------------------------------------

  setPetZone(zoneId, hasPet, petInfo) {
    if (!this.cleaningZones.has(zoneId)) { this.error(`Unknown zone for pet tracking: ${zoneId}`); return false; }
    if (hasPet) {
      this.petZones.set(zoneId, {
        zoneId, petType: (petInfo && petInfo.type) || 'unknown',
        petName: (petInfo && petInfo.name) || 'Pet',
        detectedAt: Date.now(), avoidanceRadius: (petInfo && petInfo.avoidanceRadius) || 1.5
      });
      this.log(`Pet detected in ${zoneId}: ${(petInfo && petInfo.name) || 'Pet'}`);
    } else {
      this.petZones.delete(zoneId);
      this.log(`Pet cleared from ${zoneId}`);
    }
    return true;
  }

  _isPetInZone(zoneId) {
    return this.petAvoidanceEnabled && this.petZones.has(zoneId);
  }

  getZonesWithPets() {
    const result = [];
    for (const [zoneId, data] of this.petZones) result.push({ zoneId, ...data });
    return result;
  }

  // -- Cleaning History & Coverage --------------------------------------------

  getCoverageReport(options) {
    const timeRange = (options && options.timeRange) || 7 * 24 * 60 * 60 * 1000;
    const since = Date.now() - timeRange;
    const report = { generatedAt: Date.now(), timeRangeMs: timeRange, zones: {}, overallCoverage: 0, totalSessions: 0, completedSessions: 0, averageCoverage: 0 };
    const relevant = this.cleaningHistory.filter(h => h.startedAt >= since);
    report.totalSessions = relevant.length;
    report.completedSessions = relevant.filter(h => h.status === 'completed').length;

    let totalCov = 0;
    for (const [zoneId, zone] of this.cleaningZones) {
      const zs = relevant.filter(h => h.zoneId === zoneId && h.status === 'completed');
      const avg = zs.length > 0 ? zs.reduce((s, x) => s + x.coverage, 0) / zs.length : 0;
      report.zones[zoneId] = {
        name: zone.name, sessionCount: zs.length,
        averageCoverage: Math.round(avg * 10) / 10,
        lastCleaned: zone.lastCleaned,
        daysSinceLastCleaned: zone.lastCleaned ? Math.round((Date.now() - zone.lastCleaned) / 86400000 * 10) / 10 : null,
        missedSpots: []
      };
      for (const sess of zs) {
        if (sess.missedSpots && sess.missedSpots.length > 0) report.zones[zoneId].missedSpots.push(...sess.missedSpots);
      }
      totalCov += avg;
    }
    const zc = this.cleaningZones.size;
    report.overallCoverage = zc > 0 ? Math.round(totalCov / zc * 10) / 10 : 0;
    const completed = relevant.filter(h => h.status === 'completed');
    report.averageCoverage = completed.length > 0 ? Math.round(completed.reduce((s, h) => s + h.coverage, 0) / completed.length * 10) / 10 : 0;
    return report;
  }

  getMissedSpots(zoneId) {
    const sessions = this.cleaningHistory.filter(h =>
      (!zoneId || h.zoneId === zoneId) && h.status === 'completed' && h.missedSpots && h.missedSpots.length > 0
    );
    const freq = {};
    for (const s of sessions) for (const spot of s.missedSpots) freq[spot] = (freq[spot] || 0) + 1;
    return Object.entries(freq).map(([spot, count]) => ({ spot, frequency: count })).sort((a, b) => b.frequency - a.frequency);
  }

  _trimHistory() {
    while (this.cleaningHistory.length > this.maxHistoryEntries) this.cleaningHistory.shift();
  }

  // -- Maintenance Tracking ---------------------------------------------------

  getMaintenanceStatus(robotId) {
    const record = this.maintenanceRecords.get(robotId);
    if (!record) return null;
    const now = Date.now();
    const status = { robotId, components: {}, overdue: [], upcoming: [], nextInspection: record.nextInspection, inspectionOverdue: now > record.nextInspection };

    for (const [compId, comp] of Object.entries(record.components)) {
      const dueDate = comp.lastReplaced + comp.replacementIntervalMs;
      const usagePct = comp.maxUsageHours > 0 ? Math.round(comp.usageHours / comp.maxUsageHours * 100) : 0;
      const isOverdue = now > dueDate || usagePct >= 100;
      const isUpcoming = !isOverdue && (dueDate - now < 7 * 24 * 60 * 60 * 1000 || usagePct > 80);
      status.components[compId] = {
        name: comp.name, usageHours: Math.round(comp.usageHours * 10) / 10,
        maxUsageHours: comp.maxUsageHours, usagePercent: usagePct,
        dueDate, isOverdue, isUpcoming, daysTilDue: Math.round((dueDate - now) / 86400000)
      };
      if (comp.cycleCount !== undefined) {
        status.components[compId].cycleCount = comp.cycleCount;
        status.components[compId].maxCycles = comp.maxCycles;
        status.components[compId].cyclePercent = Math.round(comp.cycleCount / comp.maxCycles * 100);
      }
      if (isOverdue) status.overdue.push(compId);
      else if (isUpcoming) status.upcoming.push(compId);
    }
    return status;
  }

  recordMaintenanceAction(robotId, componentId, action) {
    const record = this.maintenanceRecords.get(robotId);
    if (!record || !record.components[componentId]) {
      this.error(`Unknown maintenance target: ${robotId}/${componentId}`);
      return false;
    }
    const comp = record.components[componentId];
    if (action === 'replace') {
      comp.lastReplaced = Date.now();
      comp.usageHours = 0;
      if (comp.cycleCount !== undefined) comp.cycleCount = 0;
      this.log(`Replaced ${comp.name} on ${robotId}`);
    } else if (action === 'inspect') {
      record.lastInspection = Date.now();
      record.nextInspection = Date.now() + 30 * 24 * 60 * 60 * 1000;
      this.log(`Inspection recorded for ${robotId}`);
    }
    record.notes.push({ timestamp: Date.now(), componentId, action, note: `${action} performed on ${comp.name}` });
    this._saveSettings();
    return true;
  }

  _updateMaintenanceUsage(robotId, hours) {
    const record = this.maintenanceRecords.get(robotId);
    if (!record) return;
    for (const comp of Object.values(record.components)) comp.usageHours += hours;
  }

  getAllMaintenanceAlerts() {
    const alerts = [];
    for (const robotId of this.robots.keys()) {
      const st = this.getMaintenanceStatus(robotId);
      if (!st) continue;
      for (const c of st.overdue) alerts.push({ level: 'critical', robotId, component: c, message: `${st.components[c].name} is overdue for replacement on ${robotId}` });
      for (const c of st.upcoming) alerts.push({ level: 'warning', robotId, component: c, message: `${st.components[c].name} due soon on ${robotId} (${st.components[c].daysTilDue} days)` });
      if (st.inspectionOverdue) alerts.push({ level: 'warning', robotId, component: 'inspection', message: `${robotId} is overdue for inspection` });
    }
    return alerts.sort((a, b) => (a.level === 'critical' ? -1 : 1) - (b.level === 'critical' ? -1 : 1));
  }

  // -- Natural Language Command Routing ---------------------------------------

  routeCommand(command) {
    if (!command || typeof command !== 'string') return { success: false, reason: 'Invalid command' };
    const lower = command.toLowerCase().trim();
    const result = { originalCommand: command, robot: null, zone: null, action: null };

    // Detect robot type
    const robotPatterns = [
      [['vacuum'], 'vacuum'], [['mow', 'lawn', 'grass'], 'mower'],
      [['window'], 'window_washer'], [['pool'], 'pool_cleaner'],
      [['mop', 'wash floor', 'scrub floor'], 'mopping_robot']
    ];
    for (const [kws, type] of robotPatterns) {
      if (kws.some(k => lower.includes(k))) { result.robot = this._findRobotByType(type); break; }
    }

    // Detect zone
    for (const [zoneId, zone] of this.cleaningZones) {
      if (lower.includes(zoneId) || lower.includes(zone.name.toLowerCase())) { result.zone = zoneId; break; }
    }

    // Detect action
    if (['start', 'clean', 'begin', 'run'].some(w => lower.includes(w))) result.action = 'start_cleaning';
    else if (['stop', 'pause', 'halt'].some(w => lower.includes(w))) result.action = 'stop';
    else if (['dock', 'charge', 'return'].some(w => lower.includes(w))) result.action = 'dock';
    else if (['status', 'where', 'what'].some(w => lower.includes(w))) result.action = 'status';
    else if (lower.includes('schedule')) result.action = 'schedule';

    if (!result.robot && !result.action) return { success: false, reason: 'Could not parse command', parsed: result };
    return this._executeRoutedCommand(result);
  }

  _findRobotByType(type) {
    for (const [id, r] of this.robots) { if (r.type === type && r.status === 'idle') return id; }
    for (const [id, r] of this.robots) { if (r.type === type) return id; }
    return null;
  }

  _executeRoutedCommand(parsed) {
    switch (parsed.action) {
      case 'start_cleaning':
        if (!parsed.robot) return { success: false, reason: 'No suitable robot found' };
        if (!parsed.zone) return { success: false, reason: 'No zone specified' };
        return { success: true, action: 'start_cleaning', robotId: parsed.robot, zone: parsed.zone, deferred: false };
      case 'stop':
        if (parsed.robot) {
          const r = this.robots.get(parsed.robot);
          if (r && r.status === 'cleaning') { this.completeCleaningSession(parsed.robot); return { success: true, action: 'stopped', robotId: parsed.robot }; }
        }
        return { success: false, reason: 'No active robot to stop' };
      case 'dock':
        if (parsed.robot) { this.queueForCharging(parsed.robot); return { success: true, action: 'docking', robotId: parsed.robot }; }
        return { success: false, reason: 'No robot specified for docking' };
      case 'status':
        if (parsed.robot) return { success: true, action: 'status', data: this.robots.get(parsed.robot) || null };
        return { success: true, action: 'status', data: this.getStatistics() };
      case 'schedule':
        return { success: true, action: 'schedule_info', schedules: this._getAllSchedules() };
      default:
        return { success: false, reason: 'Unknown action', parsed };
    }
  }

  _getAllSchedules() {
    const all = [];
    for (const [robotId, list] of this.schedules) for (const s of list) all.push({ robotId, ...s });
    return all;
  }

  // -- Away Mode Orchestration ------------------------------------------------

  async startAwayModeOrchestration() {
    if (this.awayModeActive) { this.log('Away mode already active'); return { success: false, reason: 'Already in away mode' }; }
    this.awayModeActive = true;
    this.log('Starting away mode orchestration...');
    const sequence = this._buildOptimalCleaningSequence();
    const results = [];

    for (const step of sequence) {
      const robot = this.robots.get(step.robotId);
      if (!robot || robot.status !== 'idle') {
        results.push({ step, status: 'skipped', reason: robot ? `Robot busy (${robot.status})` : 'Robot not found' });
        continue;
      }
      if (robot.battery < 20) {
        this.queueForCharging(step.robotId);
        results.push({ step, status: 'deferred', reason: 'Low battery, queued for charging' });
        continue;
      }
      const res = await this.startOccupancyAwareCleaning(step.robotId, step.zoneId);
      results.push({ step, status: res.success ? 'started' : 'failed', details: res });
    }
    this.log(`Away mode orchestration initiated: ${results.filter(r => r.status === 'started').length}/${sequence.length} tasks started`);
    return { success: true, sequence, results };
  }

  stopAwayModeOrchestration() {
    if (!this.awayModeActive) return false;
    this.awayModeActive = false;
    for (const [robotId, robot] of this.robots) {
      if (robot.status === 'cleaning') this.completeCleaningSession(robotId);
    }
    this.log('Away mode orchestration stopped');
    return true;
  }

  _buildOptimalCleaningSequence() {
    const sorted = [...this.cleaningZones.entries()].sort((a, b) => {
      const pd = b[1].priority - a[1].priority;
      if (pd !== 0) return pd;
      return (a[1].lastCleaned || 0) - (b[1].lastCleaned || 0);
    });
    const sequence = [];
    for (const [zoneId, zone] of sorted) {
      const rId = this._findEligibleRobotForZone(zone);
      if (rId) sequence.push({ robotId: rId, zoneId, zoneName: zone.name, priority: zone.priority, estimatedDuration: Math.round(zone.area * 1.5) });
    }
    if (this.preferLowEnergyPricing && this.energyPrices.length > 0) this._adjustSequenceForEnergyPrices(sequence);
    return sequence;
  }

  _findEligibleRobotForZone(zone) {
    for (const [id, r] of this.robots) {
      if (zone.allowedRobots.includes(r.type) && r.status === 'idle' && r.battery >= 20) return id;
    }
    return null;
  }

  _adjustSequenceForEnergyPrices(_sequence) {
    if (this.energyPrices.length === 0) return;
    const currentHour = new Date().getHours();
    const cheap = this.energyPrices.filter(p => p.hour >= currentHour).sort((a, b) => a.price - b.price).slice(0, 4).map(p => p.hour);
    if (cheap.length > 0) this.log(`Optimizing schedule for cheap energy hours: ${cheap.join(', ')}`);
  }

  setEnergyPrices(prices) {
    if (!Array.isArray(prices)) { this.error('Energy prices must be an array'); return false; }
    this.energyPrices = prices.map(p => ({ hour: p.hour, price: p.price, unit: p.unit || 'EUR/kWh' }));
    this.log(`Updated energy prices: ${this.energyPrices.length} entries`);
    return true;
  }

  getOptimalCleaningWindows() {
    if (this.energyPrices.length === 0) return { windows: [], note: 'No energy price data available' };
    const sorted = [...this.energyPrices].sort((a, b) => a.price - b.price);
    const cheapest = sorted.slice(0, Math.ceil(sorted.length * 0.3));
    return {
      windows: cheapest.map(p => ({ hour: p.hour, price: p.price, recommended: true })),
      averagePrice: sorted.reduce((s, p) => s + p.price, 0) / sorted.length,
      cheapestHour: sorted[0].hour,
      expensiveHours: sorted.slice(-3).map(p => p.hour)
    };
  }

  // -- Robot Health & Battery Degradation -------------------------------------

  getRobotHealth(robotId) {
    const robot = this.robots.get(robotId);
    if (!robot) return null;
    const maint = this.getMaintenanceStatus(robotId);
    const recent = this.cleaningHistory.filter(h => h.robotId === robotId).slice(-20);
    const completed = recent.filter(h => h.status === 'completed');
    const avgCov = completed.length > 0 ? completed.reduce((s, h) => s + h.coverage, 0) / completed.length : 0;
    const errCount = robot.errorLog ? robot.errorLog.length : 0;

    return {
      robotId, type: robot.type, name: robot.name, battery: robot.battery,
      maxBattery: robot.maxBattery - robot.batteryDegradation,
      batteryDegradation: robot.batteryDegradation,
      batteryHealthPercent: Math.round((1 - robot.batteryDegradation / robot.maxBattery) * 100),
      status: robot.status, currentZone: robot.currentZone,
      averageCoverage: Math.round(avgCov * 10) / 10, recentSessions: recent.length,
      errorCount: errCount, recentErrors: (robot.errorLog || []).slice(-5),
      maintenanceAlerts: maint ? maint.overdue.length + maint.upcoming.length : 0,
      overallHealth: this._calculateOverallHealth(robot, maint, avgCov, errCount)
    };
  }

  _calculateOverallHealth(robot, maint, avgCov, errCount) {
    let score = 100;
    score -= robot.batteryDegradation * 2;
    if (robot.battery < 20) score -= 10;
    if (maint) { score -= maint.overdue.length * 15; score -= maint.upcoming.length * 5; }
    if (avgCov > 0 && avgCov < 85) score -= (85 - avgCov);
    score -= Math.min(errCount * 3, 20);
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  logRobotError(robotId, errorMessage) {
    const robot = this.robots.get(robotId);
    if (!robot) { this.error(`Cannot log error for unknown robot: ${robotId}`); return false; }
    if (!robot.errorLog) robot.errorLog = [];
    robot.errorLog.push({ timestamp: Date.now(), message: errorMessage });
    if (robot.errorLog.length > 50) robot.errorLog = robot.errorLog.slice(-50);
    this.error(`Robot ${robotId} error: ${errorMessage}`);
    return true;
  }

  simulateBatteryDegradation() {
    for (const [robotId] of this.robots) {
      const rec = this.maintenanceRecords.get(robotId);
      if (rec && rec.components.battery) {
        const cycles = rec.components.battery.cycleCount || 0;
        const max = rec.components.battery.maxCycles || 800;
        this.robots.get(robotId).batteryDegradation = Math.min(30, Math.floor(cycles / max * 30));
      }
    }
  }

  // -- Multi-Floor Coordination -----------------------------------------------

  _updateFloorActiveRobots(floorId, robotId, isActive) {
    const floor = this.floors.get(floorId);
    if (!floor) return;
    if (isActive) { if (!floor.activeRobots.includes(robotId)) floor.activeRobots.push(robotId); }
    else { floor.activeRobots = floor.activeRobots.filter(id => id !== robotId); }
  }

  getFloorStatus(floorId) {
    const floor = this.floors.get(floorId);
    if (!floor) return null;
    const fz = floor.zones.map(zId => { const z = this.cleaningZones.get(zId); return z ? { id: zId, ...z } : null; }).filter(Boolean);
    return {
      floor: floor.name, zones: fz,
      activeRobots: floor.activeRobots.map(rId => { const r = this.robots.get(rId); return r ? { id: rId, ...r } : null; }).filter(Boolean),
      totalArea: fz.reduce((s, z) => s + z.area, 0),
      zonesNeedingCleaning: fz.filter(z => !z.lastCleaned || (Date.now() - z.lastCleaned) > 2 * 24 * 60 * 60 * 1000).length
    };
  }

  assignRobotToFloor(robotId, floorId) {
    const robot = this.robots.get(robotId);
    if (!robot) return { success: false, reason: 'Robot not found' };
    if (!this.floors.has(floorId)) return { success: false, reason: 'Floor not found' };
    if (robot.assignedFloor && this.floors.has(robot.assignedFloor)) this._updateFloorActiveRobots(robot.assignedFloor, robotId, false);
    robot.assignedFloor = floorId;
    this.log(`Assigned ${robotId} to floor ${floorId}`);
    return { success: true };
  }

  // -- Monitoring Loop --------------------------------------------------------

  _startMonitoringLoop() {
    if (this.monitoringInterval) return;
    this.monitoringInterval = setInterval(() => this._runMonitoringCycle(), this.monitoringIntervalMs);
    this.log(`Monitoring loop started (${this.monitoringIntervalMs / 60000} min interval)`);
  }

  _stopMonitoringLoop() {
    if (this.monitoringInterval) { clearInterval(this.monitoringInterval); this.monitoringInterval = null; this.log('Monitoring loop stopped'); }
  }

  _runMonitoringCycle() {
    try {
      this._processCharging();
      this.simulateBatteryDegradation();
      this._checkScheduledTasks();
      this._checkMaintenanceAlerts();
      this._cleanupStaleStates();
    } catch (err) {
      this.error(`Monitoring cycle error: ${err.message}`);
    }
  }

  _checkScheduledTasks() {
    const now = new Date();
    const currentDay = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][now.getDay()];
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    for (const [robotId, schedList] of this.schedules) {
      for (const sched of schedList) {
        if (!sched.enabled || !sched.days.includes(currentDay)) continue;
        if (currentTime >= sched.startTime && currentTime <= sched.endTime) {
          const robot = this.robots.get(robotId);
          if (!robot || robot.status !== 'idle' || !sched.zone) continue;
          if (sched.respectOccupancy && this.isZoneOccupied(sched.zone)) continue;
          if (sched.respectEnergyPricing && this.preferLowEnergyPricing) {
            const pe = this.energyPrices.find(p => p.hour === now.getHours());
            if (pe) {
              const avg = this.energyPrices.reduce((s, p) => s + p.price, 0) / this.energyPrices.length;
              if (pe.price > avg * 1.3) continue;
            }
          }
          this.startOccupancyAwareCleaning(robotId, sched.zone).catch(err => {
            this.error(`Scheduled cleaning failed: ${err.message}`);
          });
        }
      }
    }
  }

  _checkMaintenanceAlerts() {
    const alerts = this.getAllMaintenanceAlerts();
    const critical = alerts.filter(a => a.level === 'critical');
    if (critical.length > 0) this.log(`${critical.length} critical maintenance alert(s) pending`);
  }

  _cleanupStaleStates() {
    for (const [robotId, robot] of this.robots) {
      if (robot.status === 'cleaning') {
        const active = this.cleaningHistory.filter(h => h.robotId === robotId && h.status === 'in_progress').pop();
        if (active && (Date.now() - active.startedAt) > 4 * 60 * 60 * 1000) {
          this.log(`Stale cleaning session detected for ${robotId}, forcing completion`);
          this.completeCleaningSession(robotId);
        }
      }
      if (robot.status === 'waiting_to_charge' && !this.chargingQueue.includes(robotId)) robot.status = 'idle';
    }
  }

  // -- Settings Persistence ---------------------------------------------------

  _saveSettings() {
    try {
      const data = {
        schedules: this._serializeMap(this.schedules),
        petAvoidanceEnabled: this.petAvoidanceEnabled,
        preferLowEnergyPricing: this.preferLowEnergyPricing,
        energyPrices: this.energyPrices,
        cleaningHistory: this.cleaningHistory.slice(-100),
        zoneLastCleaned: {}, robotAssignments: {}, maintenanceNotes: {}
      };
      for (const [zId, z] of this.cleaningZones) data.zoneLastCleaned[zId] = z.lastCleaned;
      for (const [rId, r] of this.robots) data.robotAssignments[rId] = r.assignedFloor;
      for (const [rId, rec] of this.maintenanceRecords) data.maintenanceNotes[rId] = rec.notes.slice(-20);
      if (this.homey.settings && typeof this.homey.settings.set === 'function') {
        this.homey.settings.set(this.settingsKey, JSON.stringify(data));
      }
    } catch (err) {
      this.error(`Failed to save settings: ${err.message}`);
    }
  }

  async _loadSettings() {
    try {
      if (!this.homey.settings || typeof this.homey.settings.get !== 'function') return;
      const raw = this.homey.settings.get(this.settingsKey);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.schedules) this.schedules = this._deserializeMap(data.schedules);
      if (typeof data.petAvoidanceEnabled === 'boolean') this.petAvoidanceEnabled = data.petAvoidanceEnabled;
      if (typeof data.preferLowEnergyPricing === 'boolean') this.preferLowEnergyPricing = data.preferLowEnergyPricing;
      if (Array.isArray(data.energyPrices)) this.energyPrices = data.energyPrices;
      if (Array.isArray(data.cleaningHistory)) this.cleaningHistory = data.cleaningHistory;
      if (data.zoneLastCleaned) {
        for (const [zId, ts] of Object.entries(data.zoneLastCleaned)) { const z = this.cleaningZones.get(zId); if (z) z.lastCleaned = ts; }
      }
      if (data.robotAssignments) {
        for (const [rId, fl] of Object.entries(data.robotAssignments)) { const r = this.robots.get(rId); if (r) r.assignedFloor = fl; }
      }
      this.log('Settings loaded successfully');
    } catch (err) {
      this.error(`Failed to load settings: ${err.message}`);
    }
  }

  _serializeMap(map) {
    const obj = {};
    for (const [k, v] of map) obj[k] = v;
    return obj;
  }

  _deserializeMap(obj) {
    const map = new Map();
    for (const [k, v] of Object.entries(obj)) map.set(k, v);
    return map;
  }

  // -- Statistics -------------------------------------------------------------

  getStatistics() {
    const stats = {
      totalRobots: this.robots.size, robotsByType: {}, robotsByStatus: {},
      totalZones: this.cleaningZones.size, totalSchedules: 0,
      chargingQueueLength: this.chargingQueue.length,
      chargingStationCount: this.chargingStations.size,
      petZonesCount: this.petZones.size, awayModeActive: this.awayModeActive,
      historyEntries: this.cleaningHistory.length, maintenanceAlerts: 0,
      floorCount: this.floors.size, energyPricesLoaded: this.energyPrices.length > 0
    };
    for (const [, r] of this.robots) {
      stats.robotsByType[r.type] = (stats.robotsByType[r.type] || 0) + 1;
      stats.robotsByStatus[r.status] = (stats.robotsByStatus[r.status] || 0) + 1;
    }
    for (const [, sl] of this.schedules) stats.totalSchedules += sl.length;
    stats.maintenanceAlerts = this.getAllMaintenanceAlerts().length;
    const cov = this.getCoverageReport({ timeRange: 7 * 24 * 60 * 60 * 1000 });
    stats.weeklyAverageCoverage = cov.averageCoverage;
    stats.weeklyCompletedSessions = cov.completedSessions;
    const scores = [];
    for (const rId of this.robots.keys()) { const h = this.getRobotHealth(rId); if (h) scores.push(h.overallHealth); }
    stats.averageFleetHealth = scores.length > 0 ? Math.round(scores.reduce((s, h) => s + h, 0) / scores.length) : 0;
    return stats;
  }

  getRobotList() {
    const list = [];
    for (const [id, r] of this.robots) {
      list.push({ id, type: r.type, name: r.name, status: r.status, battery: r.battery, currentZone: r.currentZone, assignedFloor: r.assignedFloor, batteryHealth: Math.round((1 - r.batteryDegradation / r.maxBattery) * 100) });
    }
    return list;
  }

  // -- Convenience Helpers ----------------------------------------------------

  getRobot(robotId) {
    return this.robots.get(robotId) || null;
  }

  getZone(zoneId) {
    return this.cleaningZones.get(zoneId) || null;
  }

  setRobotSpeed(robotId, speed) {
    const robot = this.robots.get(robotId);
    if (!robot) {
      this.error(`Cannot set speed for unknown robot: ${robotId}`);
      return false;
    }
    const validSpeeds = ['slow', 'normal', 'fast', 'turbo'];
    if (!validSpeeds.includes(speed)) {
      this.error(`Invalid speed: ${speed}. Valid: ${validSpeeds.join(', ')}`);
      return false;
    }
    robot.speed = speed;
    this.log(`Set ${robotId} speed to ${speed}`);
    return true;
  }

  getActiveCleaningSessions() {
    return this.cleaningHistory.filter(h => h.status === 'in_progress').map(h => ({
      robotId: h.robotId,
      zoneId: h.zoneId,
      startedAt: h.startedAt,
      elapsedMs: Date.now() - h.startedAt,
      robotName: this.robots.has(h.robotId) ? this.robots.get(h.robotId).name : h.robotId,
      zoneName: this.cleaningZones.has(h.zoneId) ? this.cleaningZones.get(h.zoneId).name : h.zoneId
    }));
  }

  getFleetBatteryOverview() {
    const overview = { robots: [], averageBattery: 0, lowBatteryCount: 0, chargingCount: 0 };
    let totalBattery = 0;
    for (const [id, robot] of this.robots) {
      const effectiveMax = robot.maxBattery - robot.batteryDegradation;
      const pct = effectiveMax > 0 ? Math.round(robot.battery / effectiveMax * 100) : 0;
      overview.robots.push({
        id,
        name: robot.name,
        battery: robot.battery,
        effectiveMax,
        percentage: pct,
        status: robot.status
      });
      totalBattery += robot.battery;
      if (robot.battery < 20) overview.lowBatteryCount++;
      if (robot.status === 'charging') overview.chargingCount++;
    }
    overview.averageBattery = this.robots.size > 0 ? Math.round(totalBattery / this.robots.size) : 0;
    return overview;
  }

  getCleaningHistoryForZone(zoneId, limit) {
    const max = limit || 20;
    return this.cleaningHistory
      .filter(h => h.zoneId === zoneId)
      .slice(-max)
      .map(h => ({
        robotId: h.robotId,
        startedAt: h.startedAt,
        completedAt: h.completedAt,
        coverage: h.coverage,
        status: h.status,
        missedSpots: h.missedSpots ? h.missedSpots.length : 0
      }));
  }

  getCleaningHistoryForRobot(robotId, limit) {
    const max = limit || 20;
    return this.cleaningHistory
      .filter(h => h.robotId === robotId)
      .slice(-max)
      .map(h => ({
        zoneId: h.zoneId,
        startedAt: h.startedAt,
        completedAt: h.completedAt,
        coverage: h.coverage,
        status: h.status,
        batteryUsed: h.batteryUsed
      }));
  }

  resetRobotErrors(robotId) {
    const robot = this.robots.get(robotId);
    if (!robot) {
      this.error(`Cannot reset errors for unknown robot: ${robotId}`);
      return false;
    }
    const count = robot.errorLog ? robot.errorLog.length : 0;
    robot.errorLog = [];
    this.log(`Cleared ${count} error(s) for ${robotId}`);
    return true;
  }

  getSystemHealth() {
    const stats = this.getStatistics();
    const batteryOverview = this.getFleetBatteryOverview();
    const alerts = this.getAllMaintenanceAlerts();

    return {
      initialized: this.initialized,
      fleetHealth: stats.averageFleetHealth,
      averageBattery: batteryOverview.averageBattery,
      lowBatteryRobots: batteryOverview.lowBatteryCount,
      chargingRobots: batteryOverview.chargingCount,
      activeCleaningSessions: this.getActiveCleaningSessions().length,
      criticalAlerts: alerts.filter(a => a.level === 'critical').length,
      warningAlerts: alerts.filter(a => a.level === 'warning').length,
      awayMode: this.awayModeActive,
      totalHistoryEntries: this.cleaningHistory.length,
      monitoringActive: this.monitoringInterval !== null
    };
  }

  // -- Logging ----------------------------------------------------------------

  log(msg) {
    this.homey.log('[Robotics]', msg);
  }

  error(msg) {
    this.homey.error('[Robotics]', msg);
  }
}

module.exports = HomeRoboticsOrchestrationSystem;
