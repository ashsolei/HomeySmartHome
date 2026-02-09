'use strict';
var EventEmitter = require('events');
class HomeCleaningAutomationSystem extends EventEmitter {
  constructor(homey) {
    super();
    this.homey = homey;
    this.initialized = false;
    this.intervals = [];
    this.robots = {
      'vacuum-main': { id: 'vacuum-main', model: 'Roborock S8', type: 'vacuum', zone: 'downstairs',
        status: 'docked', batteryLevel: 100, dustbinLevel: 0, waterTankLevel: 100,
        filterHealth: 100, brushHealth: 100, totalCleaningHours: 0, lastCleaned: null,
        currentRoom: null, firmware: '4.2.8', motorHours: 0, errorHistory: [],
        energyUsage: { watts: 65, totalKwh: 0, costSEK: 0 }, maintenanceLog: [],
        sensorCleanDate: null, assignedRooms: ['living-room','kitchen','hallway','dining-room','office'] },
      'vacuum-upstairs': { id: 'vacuum-upstairs', model: 'iRobot i7', type: 'vacuum', zone: 'upstairs',
        status: 'docked', batteryLevel: 100, dustbinLevel: 0, waterTankLevel: 0,
        filterHealth: 100, brushHealth: 100, totalCleaningHours: 0, lastCleaned: null,
        currentRoom: null, firmware: '3.18.6', motorHours: 0, errorHistory: [],
        energyUsage: { watts: 55, totalKwh: 0, costSEK: 0 }, maintenanceLog: [],
        sensorCleanDate: null, assignedRooms: ['master-bedroom','bedroom-2','bedroom-3','bathroom-main','bathroom-2'] },
      'mop-robot': { id: 'mop-robot', model: 'Braava M6', type: 'mop', zone: 'all-hard-floors',
        status: 'docked', batteryLevel: 100, dustbinLevel: 0, waterTankLevel: 100,
        filterHealth: 100, brushHealth: 100, totalCleaningHours: 0, lastCleaned: null,
        currentRoom: null, firmware: '2.4.12', motorHours: 0, errorHistory: [],
        energyUsage: { watts: 30, totalKwh: 0, costSEK: 0 }, maintenanceLog: [],
        sensorCleanDate: null, assignedRooms: ['kitchen','bathroom-main','bathroom-2','hallway','laundry'] },
      'window-robot': { id: 'window-robot', model: 'HOBOT-2S', type: 'window', zone: 'all-windows',
        status: 'stored', batteryLevel: 100, dustbinLevel: 0, waterTankLevel: 80,
        filterHealth: 100, brushHealth: 95, totalCleaningHours: 0, lastCleaned: null,
        currentRoom: null, firmware: '1.8.3', motorHours: 0, errorHistory: [],
        energyUsage: { watts: 80, totalKwh: 0, costSEK: 0 }, maintenanceLog: [],
        sensorCleanDate: null, assignedRooms: ['living-room','master-bedroom','kitchen','office'] }
    };
    this.rooms = this._buildRooms();
    this.supplies = this._buildSupplies();
    this.schedule = { preferredStartTime: '10:00', preferredEndTime: '16:00',
      quietHoursStart: '21:00', quietHoursEnd: '08:00', occupancyAware: true,
      currentOccupancy: true, awayCleaningEnabled: true, seasonalMode: 'normal',
      petMode: false, allergyMode: false, guestMode: false, reducedPowerMode: false };
    this.deepCleaning = {
      monthly: { lastCompleted: null, nextDue: null, tasks: [
        { id: 'deep-vacuum-all', name: 'Deep vacuum all rooms', completed: false },
        { id: 'mop-all-hard', name: 'Deep mop all hard floors', completed: false },
        { id: 'clean-baseboards', name: 'Clean baseboards (manual)', completed: false },
        { id: 'vacuum-upholstery', name: 'Vacuum upholstery', completed: false },
        { id: 'clean-under-furniture', name: 'Clean under furniture', completed: false }] },
      quarterly: { lastCompleted: null, nextDue: null, tasks: [
        { id: 'window-clean-all', name: 'Clean all windows', completed: false },
        { id: 'deep-carpet-clean', name: 'Deep carpet shampooing', completed: false },
        { id: 'grout-cleaning', name: 'Tile grout cleaning', completed: false },
        { id: 'vent-cleaning', name: 'Vent and duct cleaning', completed: false },
        { id: 'appliance-deep-clean', name: 'Appliance deep clean', completed: false }] },
      annual: { lastCompleted: null, nextDue: null, tasks: [
        { id: 'full-house-deep', name: 'Full house deep clean', completed: false },
        { id: 'carpet-condition', name: 'Carpet condition assessment', completed: false },
        { id: 'floor-polish', name: 'Hardwood floor polishing', completed: false },
        { id: 'garage-clean', name: 'Garage deep clean', completed: false },
        { id: 'exterior-windows', name: 'Exterior window cleaning', completed: false }] }
    };
    this.airQualityThresholds = { dustTrigger: 75, pollenTrigger: 60, pm25Trigger: 35, vocTrigger: 400 };
    this.noiseConfig = { normalPowerDb: 65, reducedPowerDb: 50, quietModeDb: 42, currentMode: 'normal' };
    this.weeklyReport = { totalCleaningSessions: 0, totalAreaCleaned: 0, totalEnergyUsed: 0,
      totalCostSEK: 0, averageEffectiveness: 0, robotUtilization: {}, supplyUsage: {}, generatedAt: null };
    this.coordinationQueue = [];
    this.activeCleaningJobs = [];
    this.spotCleaningTriggers = [];
    this.homey.log('[Cleaning] HomeCleaningAutomationSystem constructed');
  }
  _buildRooms() {
    var defs = [
      ['living-room','Living Room',35,'hardwood','daily',1],
      ['kitchen','Kitchen',18,'tile','daily',1],
      ['master-bedroom','Master Bedroom',22,'carpet','every-other-day',2],
      ['bedroom-2','Bedroom 2',16,'carpet','every-other-day',3],
      ['bedroom-3','Bedroom 3',14,'carpet','weekly',4],
      ['bathroom-main','Main Bathroom',10,'tile','daily',2],
      ['bathroom-2','Bathroom 2',7,'tile','every-other-day',3],
      ['hallway','Hallway',12,'hardwood','daily',2],
      ['office','Office',15,'hardwood','every-other-day',3],
      ['dining-room','Dining Room',20,'hardwood','daily',2],
      ['laundry','Laundry Room',8,'tile','weekly',4],
      ['garage','Garage',40,'concrete','monthly',5]
    ];
    var rooms = {};
    for (var i = 0; i < defs.length; i++) {
      var d = defs[i];
      rooms[d[0]] = { id: d[0], name: d[1], area: d[2], floorType: d[3], soilLevel: 0,
        lastCleaned: null, frequency: d[4], priority: d[5], cleaningHistory: [],
        effectiveness: 0, coveragePercent: 0, missedSpots: 0 };
    }
    return rooms;
  }
  _buildSupplies() {
    var defs = [
      ['hepa-filter-main','HEPA Filter (Roborock)','filter',3,1,0.033,249,90],
      ['hepa-filter-i7','HEPA Filter (iRobot)','filter',2,1,0.033,299,90],
      ['mop-pads-wet','Wet Mop Pads (Braava)','pad',8,4,0.5,149,14],
      ['mop-pads-dry','Dry Mop Pads (Braava)','pad',10,4,0.3,129,21],
      ['cleaning-solution','Floor Cleaning Solution','liquid',2,1,0.07,89,60],
      ['dust-bags','Dust Bags (Auto-Empty)','bag',5,2,0.1,199,30],
      ['main-brush-roborock','Main Brush (Roborock)','brush',2,1,0.005,179,180],
      ['side-brush-roborock','Side Brush (Roborock)','brush',4,2,0.011,79,120],
      ['main-brush-irobot','Roller Brushes (iRobot)','brush',2,1,0.005,229,180],
      ['side-brush-irobot','Side Brush (iRobot)','brush',3,1,0.011,69,120],
      ['descaler','Water Tank Descaler','liquid',2,1,0.016,119,90],
      ['window-solution','Window Cleaning Solution','liquid',3,1,0.05,99,60]
    ];
    var supplies = {};
    for (var i = 0; i < defs.length; i++) {
      var d = defs[i];
      supplies[d[0]] = { id: d[0], name: d[1], category: d[2], stock: d[3], minimum: d[4],
        usageRate: d[5], costSEK: d[6], lastReplaced: null, replacementIntervalDays: d[7],
        reorderPending: false };
    }
    return supplies;
  }
  async initialize() {
    try {
      this.homey.log('[Cleaning] Initializing cleaning automation system...');
      this._initRoomSoilLevels();
      this._initDeepCleanSchedule();
      this._startSoilMonitor();
      this._startBatteryMonitor();
      this._startSupplyMonitor();
      this._startScheduleChecker();
      this._startAirQualityMonitor();
      this._startMaintenanceMonitor();
      this._startEnergyTracker();
      this._startNoiseManager();
      this._startWeeklyReportGen();
      this._startCoordinationMgr();
      this.initialized = true;
      this.homey.log('[Cleaning] System initialized successfully');
      this.homey.emit('cleaning-system-ready', { timestamp: new Date().toISOString() });
    } catch (err) {
      this.homey.error('[Cleaning] Init failed: ' + (err.message || err));
      throw err;
    }
  }
  _initRoomSoilLevels() {
    var now = new Date().toISOString();
    var keys = Object.keys(this.rooms);
    for (var i = 0; i < keys.length; i++) {
      this.rooms[keys[i]].soilLevel = Math.floor(Math.random() * 30) + 10;
      this.rooms[keys[i]].lastCleaned = now;
    }
    this.homey.log('[Cleaning] Room soil levels initialized for ' + keys.length + ' rooms');
  }
  _initDeepCleanSchedule() {
    var now = Date.now();
    this.deepCleaning.monthly.nextDue = new Date(now + 30 * 86400000).toISOString();
    this.deepCleaning.quarterly.nextDue = new Date(now + 90 * 86400000).toISOString();
    this.deepCleaning.annual.nextDue = new Date(now + 365 * 86400000).toISOString();
    this.homey.log('[Cleaning] Deep cleaning schedule initialized');
  }
  _startSoilMonitor() {
    var self = this;
    var iv = setInterval(function() {
      try { self._updateSoilLevels(); }
      catch (e) { self.homey.error('[Cleaning] Soil monitor error: ' + (e.message || e)); }
    }, 300000);
    this.intervals.push(iv);
  }
  _updateSoilLevels() {
    var keys = Object.keys(this.rooms);
    for (var i = 0; i < keys.length; i++) {
      var room = this.rooms[keys[i]];
      var rate = 0.5;
      if (room.floorType === 'carpet') rate = 0.8;
      else if (room.floorType === 'tile') rate = 0.4;
      else if (room.floorType === 'concrete') rate = 0.3;
      if (room.id === 'kitchen' || room.id === 'hallway') rate *= 1.5;
      if (this.schedule.petMode) rate *= 1.8;
      if (this.schedule.seasonalMode === 'pollen') rate *= 1.4;
      else if (this.schedule.seasonalMode === 'winter-mud') rate *= 1.6;
      room.soilLevel = Math.min(100, room.soilLevel + rate);
      if (room.soilLevel >= 80) {
        this.homey.emit('cleaning-room-dirty', { roomId: room.id, soilLevel: room.soilLevel,
          timestamp: new Date().toISOString() });
      }
    }
  }
  _startBatteryMonitor() {
    var self = this;
    var iv = setInterval(function() {
      try { self._checkBatteries(); }
      catch (e) { self.homey.error('[Cleaning] Battery error: ' + (e.message || e)); }
    }, 120000);
    this.intervals.push(iv);
  }
  _checkBatteries() {
    var keys = Object.keys(this.robots);
    for (var i = 0; i < keys.length; i++) {
      var r = this.robots[keys[i]];
      if (r.status === 'cleaning') {
        r.batteryLevel = Math.max(0, r.batteryLevel - 1.5);
        if (r.batteryLevel <= 20) {
          this.homey.log('[Cleaning] ' + r.model + ' low battery: ' + Math.round(r.batteryLevel) + '%');
          this.homey.emit('cleaning-robot-low-battery', { robotId: r.id, batteryLevel: r.batteryLevel });
          if (r.batteryLevel <= 10) this._sendToDock(r.id);
        }
      } else if (r.status === 'docked' || r.status === 'stored') {
        r.batteryLevel = Math.min(100, r.batteryLevel + 2);
      }
    }
  }
  _startSupplyMonitor() {
    var self = this;
    var iv = setInterval(function() {
      try { self._checkSupplies(); }
      catch (e) { self.homey.error('[Cleaning] Supply error: ' + (e.message || e)); }
    }, 3600000);
    this.intervals.push(iv);
  }
  _checkSupplies() {
    var keys = Object.keys(this.supplies);
    var low = [];
    for (var i = 0; i < keys.length; i++) {
      var s = this.supplies[keys[i]];
      if (s.stock <= s.minimum && !s.reorderPending) {
        low.push(s);
        s.reorderPending = true;
        this.homey.log('[Cleaning] Low supply: ' + s.name + ' (stock: ' + s.stock + ')');
      }
    }
    if (low.length > 0) {
      var names = [];
      for (var j = 0; j < low.length; j++) names.push(low[j].name);
      this.homey.emit('cleaning-supply-low', { supplies: names, count: low.length,
        timestamp: new Date().toISOString() });
    }
    return low;
  }
  _startScheduleChecker() {
    var self = this;
    var iv = setInterval(function() {
      try { self._evaluateSchedule(); }
      catch (e) { self.homey.error('[Cleaning] Schedule error: ' + (e.message || e)); }
    }, 600000);
    this.intervals.push(iv);
  }
  _evaluateSchedule() {
    var now = new Date();
    var h = now.getHours();
    var m = now.getMinutes();
    var timeStr = (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
    if (this._isQuietHours(timeStr)) {
      if (this.activeCleaningJobs.length > 0) {
        this.schedule.reducedPowerMode = true;
        this.noiseConfig.currentMode = 'quiet';
      }
      return;
    }
    if (this.schedule.occupancyAware && this.schedule.currentOccupancy && !this.schedule.awayCleaningEnabled) return;
    var startH = parseInt(this.schedule.preferredStartTime.split(':')[0], 10);
    var endH = parseInt(this.schedule.preferredEndTime.split(':')[0], 10);
    if (h >= startH && h < endH) this._scheduleRoomsCleaning();
  }
  _isQuietHours(t) {
    var s = this.schedule.quietHoursStart;
    var e = this.schedule.quietHoursEnd;
    if (s > e) return t >= s || t < e;
    return t >= s && t < e;
  }
  _scheduleRoomsCleaning() {
    var keys = Object.keys(this.rooms);
    var needs = [];
    for (var i = 0; i < keys.length; i++) {
      var room = this.rooms[keys[i]];
      if (room.soilLevel >= 70 || (room.soilLevel >= 50 && room.priority <= 2)) needs.push(room);
    }
    needs.sort(function(a, b) { return a.priority !== b.priority ? a.priority - b.priority : b.soilLevel - a.soilLevel; });
    for (var j = 0; j < needs.length; j++) {
      var bot = this._findAvailableRobot(needs[j].id);
      if (bot) this._queueJob(needs[j].id, bot);
    }
  }
  _findAvailableRobot(roomId) {
    var keys = Object.keys(this.robots);
    for (var i = 0; i < keys.length; i++) {
      var r = this.robots[keys[i]];
      if (r.status !== 'docked') continue;
      if (r.batteryLevel < 30) continue;
      var rooms = r.assignedRooms || [];
      for (var j = 0; j < rooms.length; j++) {
        if (rooms[j] === roomId) return r.id;
      }
    }
    return null;
  }
  _queueJob(roomId, robotId) {
    for (var i = 0; i < this.coordinationQueue.length; i++) {
      if (this.coordinationQueue[i].roomId === roomId && this.coordinationQueue[i].robotId === robotId) return;
    }
    this.coordinationQueue.push({ roomId: roomId, robotId: robotId, addedAt: new Date().toISOString(),
      status: 'pending', type: 'scheduled' });
    this.homey.log('[Cleaning] Queued ' + robotId + ' for ' + roomId);
  }
  _startAirQualityMonitor() {
    var self = this;
    var iv = setInterval(function() {
      try { self._checkAirQuality(); }
      catch (e) { self.homey.error('[Cleaning] Air quality error: ' + (e.message || e)); }
    }, 180000);
    this.intervals.push(iv);
  }
  _checkAirQuality() {
    var dust = Math.floor(Math.random() * 100);
    var pollen = Math.floor(Math.random() * 80);
    var pm25 = Math.floor(Math.random() * 50);
    if (dust > this.airQualityThresholds.dustTrigger) this._triggerAirClean('dust', dust);
    if (pollen > this.airQualityThresholds.pollenTrigger) this._triggerAirClean('pollen', pollen);
    if (pm25 > this.airQualityThresholds.pm25Trigger) this._triggerAirClean('pm25', pm25);
  }
  _triggerAirClean(type, level) {
    this.homey.log('[Cleaning] Air quality trigger: ' + type + ' at ' + level);
    var priorityRooms = ['living-room', 'master-bedroom', 'kitchen'];
    for (var i = 0; i < priorityRooms.length; i++) {
      var bot = this._findAvailableRobot(priorityRooms[i]);
      if (bot) this._queueJob(priorityRooms[i], bot);
    }
    this.homey.emit('cleaning-air-quality-trigger', { type: type, level: level, timestamp: new Date().toISOString() });
  }
  _startMaintenanceMonitor() {
    var self = this;
    var iv = setInterval(function() {
      try { self._checkMaintenance(); }
      catch (e) { self.homey.error('[Cleaning] Maintenance error: ' + (e.message || e)); }
    }, 1800000);
    this.intervals.push(iv);
  }
  _checkMaintenance() {
    var keys = Object.keys(this.robots);
    var alerts = [];
    for (var i = 0; i < keys.length; i++) {
      var r = this.robots[keys[i]];
      if (r.filterHealth <= 20) alerts.push({ robotId: r.id, type: 'filter-replacement', urgency: 'high',
        message: r.model + ' filter at ' + r.filterHealth + '%' });
      if (r.brushHealth <= 25) alerts.push({ robotId: r.id, type: 'brush-replacement', urgency: 'high',
        message: r.model + ' brush at ' + r.brushHealth + '%' });
      if (r.dustbinLevel >= 90) alerts.push({ robotId: r.id, type: 'dustbin-full', urgency: 'medium',
        message: r.model + ' dustbin at ' + r.dustbinLevel + '%' });
      if (r.motorHours > 500) alerts.push({ robotId: r.id, type: 'motor-service', urgency: 'low',
        message: r.model + ' motor ' + r.motorHours + ' hrs' });
      if (r.status === 'cleaning') {
        r.filterHealth = Math.max(0, r.filterHealth - 0.02);
        r.brushHealth = Math.max(0, r.brushHealth - 0.015);
        r.dustbinLevel = Math.min(100, r.dustbinLevel + 0.5);
        r.motorHours += 0.5;
      }
    }
    if (alerts.length > 0) {
      this.homey.emit('cleaning-maintenance-alert', { alerts: alerts, count: alerts.length,
        timestamp: new Date().toISOString() });
    }
    return alerts;
  }
  _startEnergyTracker() {
    var self = this;
    var iv = setInterval(function() {
      try { self._trackEnergy(); }
      catch (e) { self.homey.error('[Cleaning] Energy error: ' + (e.message || e)); }
    }, 60000);
    this.intervals.push(iv);
  }
  _trackEnergy() {
    var priceKwh = 1.85;
    var keys = Object.keys(this.robots);
    for (var i = 0; i < keys.length; i++) {
      var r = this.robots[keys[i]];
      if (r.status === 'cleaning') {
        var kwh = r.energyUsage.watts / 60000;
        r.energyUsage.totalKwh += kwh;
        r.energyUsage.costSEK = Math.round(r.energyUsage.totalKwh * priceKwh * 100) / 100;
      }
    }
  }
  _startNoiseManager() {
    var self = this;
    var iv = setInterval(function() {
      try { self._manageNoise(); }
      catch (e) { self.homey.error('[Cleaning] Noise error: ' + (e.message || e)); }
    }, 300000);
    this.intervals.push(iv);
  }
  _manageNoise() {
    var now = new Date();
    var h = now.getHours();
    var m = now.getMinutes();
    var t = (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
    if (this._isQuietHours(t)) this.noiseConfig.currentMode = 'quiet';
    else if (this.schedule.reducedPowerMode) this.noiseConfig.currentMode = 'reduced';
    else this.noiseConfig.currentMode = 'normal';
    var maxDb = this.noiseConfig.normalPowerDb;
    if (this.noiseConfig.currentMode === 'quiet') maxDb = this.noiseConfig.quietModeDb;
    else if (this.noiseConfig.currentMode === 'reduced') maxDb = this.noiseConfig.reducedPowerDb;
    this.homey.log('[Cleaning] Noise mode: ' + this.noiseConfig.currentMode + ' (max ' + maxDb + 'dB)');
  }
  _startWeeklyReportGen() {
    var self = this;
    var iv = setInterval(function() {
      try { self._generateWeeklyReport(); }
      catch (e) { self.homey.error('[Cleaning] Report error: ' + (e.message || e)); }
    }, 604800000);
    this.intervals.push(iv);
  }
  _generateWeeklyReport() {
    var report = { totalCleaningSessions: 0, totalAreaCleaned: 0, totalEnergyUsed: 0,
      totalCostSEK: 0, averageEffectiveness: 0, robotUtilization: {}, supplyUsage: {},
      generatedAt: new Date().toISOString(), period: '7 days' };
    var rKeys = Object.keys(this.robots);
    for (var i = 0; i < rKeys.length; i++) {
      var bot = this.robots[rKeys[i]];
      report.totalEnergyUsed += bot.energyUsage.totalKwh;
      report.totalCostSEK += bot.energyUsage.costSEK;
      report.robotUtilization[bot.id] = { model: bot.model, cleaningHours: bot.totalCleaningHours,
        energyKwh: bot.energyUsage.totalKwh, costSEK: bot.energyUsage.costSEK,
        batteryLevel: bot.batteryLevel, filterHealth: bot.filterHealth, brushHealth: bot.brushHealth };
    }
    var roomKeys = Object.keys(this.rooms);
    var totalEff = 0; var effCount = 0;
    for (var j = 0; j < roomKeys.length; j++) {
      var room = this.rooms[roomKeys[j]];
      report.totalCleaningSessions += room.cleaningHistory.length;
      report.totalAreaCleaned += room.area * room.cleaningHistory.length;
      if (room.effectiveness > 0) { totalEff += room.effectiveness; effCount++; }
    }
    report.averageEffectiveness = effCount > 0 ? Math.round(totalEff / effCount) : 0;
    var sKeys = Object.keys(this.supplies);
    for (var k = 0; k < sKeys.length; k++) {
      var s = this.supplies[sKeys[k]];
      report.supplyUsage[s.id] = { name: s.name, stock: s.stock, reorderPending: s.reorderPending, costSEK: s.costSEK };
    }
    report.totalCostSEK = Math.round(report.totalCostSEK * 100) / 100;
    report.totalEnergyUsed = Math.round(report.totalEnergyUsed * 1000) / 1000;
    this.weeklyReport = report;
    this.homey.log('[Cleaning] Weekly report: ' + report.totalCleaningSessions + ' sessions, ' + report.totalAreaCleaned + ' m2');
    this.homey.emit('cleaning-weekly-report', report);
    return report;
  }
  _startCoordinationMgr() {
    var self = this;
    var iv = setInterval(function() {
      try { self._processQueue(); }
      catch (e) { self.homey.error('[Cleaning] Coordination error: ' + (e.message || e)); }
    }, 30000);
    this.intervals.push(iv);
  }
  _processQueue() {
    if (this.coordinationQueue.length === 0) return;
    var busyBots = {};
    var busyRooms = {};
    for (var a = 0; a < this.activeCleaningJobs.length; a++) {
      busyBots[this.activeCleaningJobs[a].robotId] = true;
      busyRooms[this.activeCleaningJobs[a].roomId] = true;
    }
    var processed = [];
    for (var i = 0; i < this.coordinationQueue.length; i++) {
      var job = this.coordinationQueue[i];
      if (busyBots[job.robotId] || busyRooms[job.roomId]) continue;
      var robot = this.robots[job.robotId];
      if (!robot || robot.status !== 'docked') continue;
      if (robot.batteryLevel < 30) continue;
      this._startJob(job.robotId, job.roomId, job.type);
      processed.push(i);
    }
    for (var p = processed.length - 1; p >= 0; p--) this.coordinationQueue.splice(processed[p], 1);
  }
  _startJob(robotId, roomId, type) {
    var robot = this.robots[robotId];
    var room = this.rooms[roomId];
    if (!robot || !room) return;
    robot.status = 'cleaning';
    robot.currentRoom = roomId;
    var job = { id: 'job-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      robotId: robotId, roomId: roomId, type: type || 'scheduled',
      startedAt: new Date().toISOString(), estimatedDuration: Math.ceil(room.area * 1.5), progress: 0 };
    this.activeCleaningJobs.push(job);
    this.homey.log('[Cleaning] Started: ' + robot.model + ' cleaning ' + room.name + ' (est ' + job.estimatedDuration + ' min)');
    this.homey.emit('cleaning-job-started', { robotId: robotId, roomId: roomId, model: robot.model,
      roomName: room.name, type: type, timestamp: new Date().toISOString() });
    var self = this;
    var piv = setInterval(function() {
      try { self._updateProgress(job.id, piv); }
      catch (e) { self.homey.error('[Cleaning] Progress error: ' + (e.message || e)); clearInterval(piv); }
    }, 60000);
    this.intervals.push(piv);
  }
  _updateProgress(jobId, piv) {
    var job = null; var idx = -1;
    for (var i = 0; i < this.activeCleaningJobs.length; i++) {
      if (this.activeCleaningJobs[i].id === jobId) { job = this.activeCleaningJobs[i]; idx = i; break; }
    }
    if (!job) { clearInterval(piv); return; }
    job.progress = Math.min(100, job.progress + (100 / job.estimatedDuration));
    if (job.progress >= 100) this._completeJob(idx, piv);
  }
  _completeJob(idx, piv) {
    clearInterval(piv);
    var job = this.activeCleaningJobs[idx];
    if (!job) return;
    var robot = this.robots[job.robotId];
    var room = this.rooms[job.roomId];
    if (robot) {
      robot.status = 'returning';
      robot.currentRoom = null;
      robot.totalCleaningHours += job.estimatedDuration / 60;
      robot.lastCleaned = new Date().toISOString();
    }
    if (room) {
      var eff = Math.floor(Math.random() * 20) + 80;
      var cov = Math.floor(Math.random() * 10) + 90;
      var missed = Math.floor(Math.random() * 3);
      room.soilLevel = Math.max(0, room.soilLevel * (1 - eff / 100));
      room.lastCleaned = new Date().toISOString();
      room.effectiveness = eff;
      room.coveragePercent = cov;
      room.missedSpots = missed;
      room.cleaningHistory.push({ date: new Date().toISOString(), robotUsed: job.robotId,
        duration: job.estimatedDuration, effectiveness: eff, coverage: cov, missedSpots: missed, type: job.type });
      if (room.cleaningHistory.length > 50) room.cleaningHistory = room.cleaningHistory.slice(-50);
    }
    this.activeCleaningJobs.splice(idx, 1);
    this.homey.log('[Cleaning] Completed: ' + (robot ? robot.model : 'unknown') + ' finished ' + (room ? room.name : 'unknown'));
    this.homey.emit('cleaning-job-completed', { robotId: job.robotId, roomId: job.roomId,
      duration: job.estimatedDuration, effectiveness: room ? room.effectiveness : 0,
      timestamp: new Date().toISOString() });
    var self = this;
    setTimeout(function() {
      if (robot) robot.status = 'docked';
      self.homey.log('[Cleaning] ' + (robot ? robot.model : 'Robot') + ' returned to dock');
      if (room && room.floorType !== 'carpet' && room.floorType !== 'concrete') {
        self._scheduleMopHandoff(room.id);
      }
    }, 30000);
  }
  _scheduleMopHandoff(roomId) {
    var mop = this.robots['mop-robot'];
    if (!mop || mop.status !== 'docked' || mop.batteryLevel < 30 || mop.waterTankLevel < 20) return;
    this._queueJob(roomId, 'mop-robot');
    this.homey.log('[Cleaning] Vacuum-then-mop handoff queued for ' + roomId);
  }
  _sendToDock(robotId) {
    var r = this.robots[robotId];
    if (!r) return;
    r.status = 'returning';
    r.currentRoom = null;
    this.homey.log('[Cleaning] Sending ' + r.model + ' to dock (low battery)');
    for (var i = 0; i < this.activeCleaningJobs.length; i++) {
      if (this.activeCleaningJobs[i].robotId === robotId) {
        this.activeCleaningJobs.splice(i, 1); break;
      }
    }
    var self = this;
    setTimeout(function() {
      r.status = 'docked';
      self.homey.log('[Cleaning] ' + r.model + ' docked');
    }, 15000);
  }
  startSpotCleaning(roomId, reason) {
    if (!this.rooms[roomId]) {
      this.homey.error('[Cleaning] Spot clean failed: unknown room ' + roomId);
      return { success: false, error: 'Unknown room' };
    }
    var bot = this._findAvailableRobot(roomId);
    if (!bot) return { success: false, error: 'No available robot' };
    this.spotCleaningTriggers.push({ roomId: roomId, reason: reason || 'manual',
      timestamp: new Date().toISOString(), robotAssigned: bot });
    this._queueJob(roomId, bot);
    this.homey.log('[Cleaning] Spot cleaning: ' + roomId + ' reason=' + (reason || 'manual'));
    this.homey.emit('cleaning-spot-triggered', { roomId: roomId, reason: reason, robotId: bot,
      timestamp: new Date().toISOString() });
    return { success: true, robotId: bot, roomId: roomId };
  }
  triggerPostCookingCleanup() {
    this.homey.log('[Cleaning] Post-cooking cleanup triggered');
    return this.startSpotCleaning('kitchen', 'post-cooking');
  }
  triggerMuddyShoesCleanup() {
    this.homey.log('[Cleaning] Muddy shoes cleanup triggered');
    var result = this.startSpotCleaning('hallway', 'muddy-shoes');
    if (result.success) this.rooms['hallway'].soilLevel = Math.min(100, this.rooms['hallway'].soilLevel + 30);
    return result;
  }
  triggerSpillCleanup(roomId) {
    this.homey.log('[Cleaning] Spill cleanup in ' + roomId);
    if (this.rooms[roomId]) this.rooms[roomId].soilLevel = Math.min(100, this.rooms[roomId].soilLevel + 40);
    return this.startSpotCleaning(roomId, 'spill');
  }
  enablePetMode() {
    this.schedule.petMode = true;
    this.homey.log('[Cleaning] Pet hair mode enabled');
    this.homey.emit('cleaning-mode-changed', { mode: 'pet', enabled: true });
    var rooms = ['living-room', 'hallway', 'master-bedroom'];
    for (var i = 0; i < rooms.length; i++) {
      if (this.rooms[rooms[i]]) { this.rooms[rooms[i]].frequency = 'twice-daily'; this.rooms[rooms[i]].priority = 1; }
    }
    return { success: true, mode: 'pet', affectedRooms: rooms };
  }
  disablePetMode() {
    this.schedule.petMode = false;
    this.homey.log('[Cleaning] Pet hair mode disabled');
    this.homey.emit('cleaning-mode-changed', { mode: 'pet', enabled: false });
    return { success: true };
  }
  enableAllergyMode() {
    this.schedule.allergyMode = true;
    this.schedule.seasonalMode = 'pollen';
    this.homey.log('[Cleaning] Allergy mode enabled');
    this.homey.emit('cleaning-mode-changed', { mode: 'allergy', enabled: true });
    var beds = ['master-bedroom', 'bedroom-2', 'bedroom-3'];
    for (var i = 0; i < beds.length; i++) {
      if (this.rooms[beds[i]]) { this.rooms[beds[i]].frequency = 'daily'; this.rooms[beds[i]].priority = 1; }
    }
    this.airQualityThresholds.dustTrigger = 50;
    this.airQualityThresholds.pollenTrigger = 40;
    this.airQualityThresholds.pm25Trigger = 20;
    return { success: true, mode: 'allergy' };
  }
  disableAllergyMode() {
    this.schedule.allergyMode = false;
    this.schedule.seasonalMode = 'normal';
    this.airQualityThresholds.dustTrigger = 75;
    this.airQualityThresholds.pollenTrigger = 60;
    this.airQualityThresholds.pm25Trigger = 35;
    this.homey.log('[Cleaning] Allergy mode disabled');
    this.homey.emit('cleaning-mode-changed', { mode: 'allergy', enabled: false });
    return { success: true };
  }
  enableGuestMode() {
    this.schedule.guestMode = true;
    this.homey.log('[Cleaning] Guest preparation mode enabled');
    this.homey.emit('cleaning-mode-changed', { mode: 'guest', enabled: true });
    var guestRooms = ['living-room','kitchen','dining-room','bathroom-main','hallway','bedroom-2'];
    for (var i = 0; i < guestRooms.length; i++) {
      if (this.rooms[guestRooms[i]]) this.rooms[guestRooms[i]].priority = 1;
      var bot = this._findAvailableRobot(guestRooms[i]);
      if (bot) this._queueJob(guestRooms[i], bot);
    }
    var win = this.robots['window-robot'];
    if (win && (win.status === 'stored' || win.status === 'docked')) this._queueJob('living-room', 'window-robot');
    return { success: true, mode: 'guest', roomsQueued: guestRooms.length };
  }
  disableGuestMode() {
    this.schedule.guestMode = false;
    this.homey.log('[Cleaning] Guest mode disabled');
    this.homey.emit('cleaning-mode-changed', { mode: 'guest', enabled: false });
    return { success: true };
  }
  setSeasonalMode(mode) {
    var valid = ['normal','pollen','winter-mud','summer','autumn-leaves'];
    var ok = false;
    for (var i = 0; i < valid.length; i++) { if (valid[i] === mode) { ok = true; break; } }
    if (!ok) return { success: false, error: 'Invalid mode: ' + mode };
    this.schedule.seasonalMode = mode;
    this.homey.log('[Cleaning] Seasonal mode: ' + mode);
    if (mode === 'pollen') this.airQualityThresholds.pollenTrigger = 40;
    else if (mode === 'winter-mud' && this.rooms['hallway']) {
      this.rooms['hallway'].frequency = 'twice-daily';
      this.rooms['hallway'].priority = 1;
    }
    this.homey.emit('cleaning-season-changed', { mode: mode, timestamp: new Date().toISOString() });
    return { success: true, mode: mode };
  }
  setOccupancy(isHome) {
    this.schedule.currentOccupancy = isHome;
    this.homey.log('[Cleaning] Occupancy: ' + (isHome ? 'home' : 'away'));
    if (!isHome && this.schedule.awayCleaningEnabled) {
      this.homey.log('[Cleaning] House empty - starting full cycle');
      this._scheduleRoomsCleaning();
    }
    this.homey.emit('cleaning-occupancy-changed', { isHome: isHome, timestamp: new Date().toISOString() });
  }
  replaceSupply(supplyId, qty) {
    var s = this.supplies[supplyId];
    if (!s) return { success: false, error: 'Unknown supply: ' + supplyId };
    s.stock += (qty || 1);
    s.reorderPending = false;
    s.lastReplaced = new Date().toISOString();
    this.homey.log('[Cleaning] Supply replaced: ' + s.name + ' (stock: ' + s.stock + ')');
    this.homey.emit('cleaning-supply-replaced', { supplyId: supplyId, name: s.name, stock: s.stock });
    return { success: true, supplyId: supplyId, newStock: s.stock };
  }
  performMaintenance(robotId, mType) {
    var r = this.robots[robotId];
    if (!r) return { success: false, error: 'Unknown robot: ' + robotId };
    var now = new Date().toISOString();
    var entry = { type: mType, date: now, details: '' };
    if (mType === 'filter-replacement') { r.filterHealth = 100; entry.details = 'Filter replaced'; }
    else if (mType === 'brush-replacement') { r.brushHealth = 100; entry.details = 'Brush replaced'; }
    else if (mType === 'dustbin-empty') { r.dustbinLevel = 0; entry.details = 'Dustbin emptied'; }
    else if (mType === 'water-tank-refill') { r.waterTankLevel = 100; entry.details = 'Water tank refilled'; }
    else if (mType === 'sensor-clean') { r.sensorCleanDate = now; entry.details = 'Sensors cleaned'; }
    else if (mType === 'full-service') {
      r.filterHealth = 100; r.brushHealth = 100; r.dustbinLevel = 0;
      r.waterTankLevel = 100; r.sensorCleanDate = now; entry.details = 'Full service';
    } else { return { success: false, error: 'Unknown type: ' + mType }; }
    r.maintenanceLog.push(entry);
    if (r.maintenanceLog.length > 100) r.maintenanceLog = r.maintenanceLog.slice(-100);
    this.homey.log('[Cleaning] Maintenance: ' + r.model + ' ' + mType);
    this.homey.emit('cleaning-maintenance-done', { robotId: robotId, type: mType, timestamp: now });
    return { success: true, robotId: robotId, type: mType, details: entry.details };
  }
  reportRobotError(robotId, code, msg) {
    var r = this.robots[robotId];
    if (!r) return;
    r.errorHistory.push({ code: code, message: msg || 'Unknown', date: new Date().toISOString(),
      status: r.status, room: r.currentRoom });
    if (r.errorHistory.length > 50) r.errorHistory = r.errorHistory.slice(-50);
    r.status = 'error';
    this.homey.error('[Cleaning] Robot error: ' + r.model + ' code ' + code + ' - ' + (msg || 'Unknown'));
    this.homey.emit('cleaning-robot-error', { robotId: robotId, model: r.model, errorCode: code,
      errorMessage: msg, timestamp: new Date().toISOString() });
  }
  clearRobotError(robotId) {
    var r = this.robots[robotId];
    if (!r) return { success: false, error: 'Unknown robot' };
    if (r.status === 'error') { r.status = 'docked'; this.homey.log('[Cleaning] Error cleared: ' + r.model); return { success: true }; }
    return { success: false, error: 'Not in error state' };
  }
  startDeepCleaning(type) {
    var sched = this.deepCleaning[type];
    if (!sched) return { success: false, error: 'Invalid type: ' + type };
    this.homey.log('[Cleaning] Starting ' + type + ' deep cleaning');
    for (var i = 0; i < sched.tasks.length; i++) sched.tasks[i].completed = false;
    var allRooms = Object.keys(this.rooms);
    for (var j = 0; j < allRooms.length; j++) {
      var bot = this._findAvailableRobot(allRooms[j]);
      if (bot) this._queueJob(allRooms[j], bot);
    }
    this.homey.emit('cleaning-deep-started', { type: type, taskCount: sched.tasks.length, timestamp: new Date().toISOString() });
    return { success: true, type: type, tasks: sched.tasks.length };
  }
  completeDeepTask(type, taskId) {
    var sched = this.deepCleaning[type];
    if (!sched) return { success: false, error: 'Invalid type' };
    for (var i = 0; i < sched.tasks.length; i++) {
      if (sched.tasks[i].id === taskId) {
        sched.tasks[i].completed = true;
        this.homey.log('[Cleaning] Deep task done: ' + sched.tasks[i].name);
        var allDone = true;
        for (var j = 0; j < sched.tasks.length; j++) { if (!sched.tasks[j].completed) { allDone = false; break; } }
        if (allDone) {
          sched.lastCompleted = new Date().toISOString();
          var days = type === 'monthly' ? 30 : type === 'quarterly' ? 90 : 365;
          sched.nextDue = new Date(Date.now() + days * 86400000).toISOString();
          this.homey.log('[Cleaning] All ' + type + ' deep tasks completed');
          this.homey.emit('cleaning-deep-completed', { type: type, timestamp: new Date().toISOString() });
        }
        return { success: true, taskId: taskId, allCompleted: allDone };
      }
    }
    return { success: false, error: 'Task not found' };
  }
  getRobotStatus(robotId) {
    if (robotId) {
      var r = this.robots[robotId];
      if (!r) return null;
      return { id: r.id, model: r.model, type: r.type, status: r.status,
        batteryLevel: Math.round(r.batteryLevel), dustbinLevel: Math.round(r.dustbinLevel),
        waterTankLevel: Math.round(r.waterTankLevel), filterHealth: Math.round(r.filterHealth),
        brushHealth: Math.round(r.brushHealth), currentRoom: r.currentRoom,
        totalCleaningHours: Math.round(r.totalCleaningHours * 10) / 10,
        motorHours: Math.round(r.motorHours), energyUsage: r.energyUsage,
        errorCount: r.errorHistory.length, lastCleaned: r.lastCleaned };
    }
    var result = {};
    var keys = Object.keys(this.robots);
    for (var i = 0; i < keys.length; i++) result[keys[i]] = this.getRobotStatus(keys[i]);
    return result;
  }
  getRoomStatus(roomId) {
    if (roomId) {
      var rm = this.rooms[roomId];
      if (!rm) return null;
      return { id: rm.id, name: rm.name, area: rm.area, floorType: rm.floorType,
        soilLevel: Math.round(rm.soilLevel), lastCleaned: rm.lastCleaned, frequency: rm.frequency,
        priority: rm.priority, effectiveness: rm.effectiveness, coveragePercent: rm.coveragePercent,
        missedSpots: rm.missedSpots, historyCount: rm.cleaningHistory.length };
    }
    var result = {};
    var keys = Object.keys(this.rooms);
    for (var i = 0; i < keys.length; i++) result[keys[i]] = this.getRoomStatus(keys[i]);
    return result;
  }
  getCleaningHistory(roomId, limit) {
    var max = limit || 10;
    if (roomId) {
      var rm = this.rooms[roomId];
      if (!rm) return [];
      return rm.cleaningHistory.slice(-max);
    }
    var all = [];
    var keys = Object.keys(this.rooms);
    for (var i = 0; i < keys.length; i++) {
      var r = this.rooms[keys[i]];
      var entries = r.cleaningHistory.slice(-5);
      for (var j = 0; j < entries.length; j++) {
        entries[j].roomId = keys[i];
        entries[j].roomName = r.name;
        all.push(entries[j]);
      }
    }
    all.sort(function(a, b) { return new Date(b.date).getTime() - new Date(a.date).getTime(); });
    return all.slice(0, max);
  }
  getSupplyStatus() {
    var result = [];
    var keys = Object.keys(this.supplies);
    for (var i = 0; i < keys.length; i++) {
      var s = this.supplies[keys[i]];
      result.push({ id: s.id, name: s.name, category: s.category, stock: s.stock, minimum: s.minimum,
        needsReorder: s.stock <= s.minimum, reorderPending: s.reorderPending, costSEK: s.costSEK,
        lastReplaced: s.lastReplaced });
    }
    return result;
  }
  getSupplyReorderList() {
    var list = [];
    var keys = Object.keys(this.supplies);
    for (var i = 0; i < keys.length; i++) {
      var s = this.supplies[keys[i]];
      if (s.stock <= s.minimum) {
        var qty = Math.max(1, s.minimum * 2 - s.stock);
        list.push({ id: s.id, name: s.name, currentStock: s.stock, reorderQuantity: qty,
          estimatedCostSEK: qty * s.costSEK, reorderPending: s.reorderPending });
      }
    }
    return list;
  }
  getEnergyReport() {
    var report = { robots: {}, totalKwh: 0, totalCostSEK: 0, pricePerKwh: 1.85 };
    var keys = Object.keys(this.robots);
    for (var i = 0; i < keys.length; i++) {
      var r = this.robots[keys[i]];
      report.robots[r.id] = { model: r.model, watts: r.energyUsage.watts,
        totalKwh: Math.round(r.energyUsage.totalKwh * 1000) / 1000, costSEK: r.energyUsage.costSEK };
      report.totalKwh += r.energyUsage.totalKwh;
      report.totalCostSEK += r.energyUsage.costSEK;
    }
    report.totalKwh = Math.round(report.totalKwh * 1000) / 1000;
    report.totalCostSEK = Math.round(report.totalCostSEK * 100) / 100;
    return report;
  }
  getDeepCleaningStatus() {
    var result = {};
    var types = ['monthly', 'quarterly', 'annual'];
    for (var i = 0; i < types.length; i++) {
      var s = this.deepCleaning[types[i]];
      var done = 0;
      for (var j = 0; j < s.tasks.length; j++) { if (s.tasks[j].completed) done++; }
      result[types[i]] = { lastCompleted: s.lastCompleted, nextDue: s.nextDue,
        totalTasks: s.tasks.length, completedTasks: done, tasks: s.tasks };
    }
    return result;
  }
  getMaintenanceReport() {
    var report = [];
    var keys = Object.keys(this.robots);
    for (var i = 0; i < keys.length; i++) {
      var r = this.robots[keys[i]];
      var needs = [];
      if (r.filterHealth <= 30) needs.push('Filter replacement (' + Math.round(r.filterHealth) + '%)');
      if (r.brushHealth <= 30) needs.push('Brush replacement (' + Math.round(r.brushHealth) + '%)');
      if (r.dustbinLevel >= 80) needs.push('Dustbin nearly full (' + Math.round(r.dustbinLevel) + '%)');
      if (r.motorHours > 400) needs.push('Motor service (' + Math.round(r.motorHours) + ' hrs)');
      report.push({ robotId: r.id, model: r.model, filterHealth: Math.round(r.filterHealth),
        brushHealth: Math.round(r.brushHealth), dustbinLevel: Math.round(r.dustbinLevel),
        waterTankLevel: Math.round(r.waterTankLevel), motorHours: Math.round(r.motorHours),
        sensorCleanDate: r.sensorCleanDate, errorCount: r.errorHistory.length,
        maintenanceCount: r.maintenanceLog.length, needsAttention: needs, firmware: r.firmware });
    }
    return report;
  }
  getActiveJobs() {
    var jobs = [];
    for (var i = 0; i < this.activeCleaningJobs.length; i++) {
      var j = this.activeCleaningJobs[i];
      var robot = this.robots[j.robotId];
      var room = this.rooms[j.roomId];
      jobs.push({ id: j.id, robotId: j.robotId, robotModel: robot ? robot.model : 'Unknown',
        roomId: j.roomId, roomName: room ? room.name : 'Unknown', type: j.type,
        startedAt: j.startedAt, progress: Math.round(j.progress), estimatedDuration: j.estimatedDuration });
    }
    return jobs;
  }
  getQueuedJobs() { return this.coordinationQueue.slice(); }
  getNoiseStatus() {
    return { currentMode: this.noiseConfig.currentMode, normalPowerDb: this.noiseConfig.normalPowerDb,
      reducedPowerDb: this.noiseConfig.reducedPowerDb, quietModeDb: this.noiseConfig.quietModeDb,
      quietHoursStart: this.schedule.quietHoursStart, quietHoursEnd: this.schedule.quietHoursEnd,
      reducedPowerMode: this.schedule.reducedPowerMode };
  }
  getScheduleConfig() {
    return { preferredStartTime: this.schedule.preferredStartTime, preferredEndTime: this.schedule.preferredEndTime,
      quietHoursStart: this.schedule.quietHoursStart, quietHoursEnd: this.schedule.quietHoursEnd,
      occupancyAware: this.schedule.occupancyAware, currentOccupancy: this.schedule.currentOccupancy,
      awayCleaningEnabled: this.schedule.awayCleaningEnabled, seasonalMode: this.schedule.seasonalMode,
      petMode: this.schedule.petMode, allergyMode: this.schedule.allergyMode, guestMode: this.schedule.guestMode };
  }
  updateScheduleConfig(cfg) {
    if (cfg.preferredStartTime) this.schedule.preferredStartTime = cfg.preferredStartTime;
    if (cfg.preferredEndTime) this.schedule.preferredEndTime = cfg.preferredEndTime;
    if (cfg.quietHoursStart) this.schedule.quietHoursStart = cfg.quietHoursStart;
    if (cfg.quietHoursEnd) this.schedule.quietHoursEnd = cfg.quietHoursEnd;
    if (typeof cfg.occupancyAware === 'boolean') this.schedule.occupancyAware = cfg.occupancyAware;
    if (typeof cfg.awayCleaningEnabled === 'boolean') this.schedule.awayCleaningEnabled = cfg.awayCleaningEnabled;
    this.homey.log('[Cleaning] Schedule config updated');
    this.homey.emit('cleaning-schedule-updated', { config: this.getScheduleConfig(), timestamp: new Date().toISOString() });
    return { success: true, config: this.getScheduleConfig() };
  }
  getWeeklyReport() {
    if (!this.weeklyReport.generatedAt) return this._generateWeeklyReport();
    return this.weeklyReport;
  }
  getStatistics() {
    var totalRooms = Object.keys(this.rooms).length;
    var totalRobots = Object.keys(this.robots).length;
    var totalSupplies = Object.keys(this.supplies).length;
    var avgSoil = 0;
    var rKeys = Object.keys(this.rooms);
    for (var i = 0; i < rKeys.length; i++) avgSoil += this.rooms[rKeys[i]].soilLevel;
    avgSoil = totalRooms > 0 ? Math.round(avgSoil / totalRooms) : 0;
    var active = 0; var docked = 0; var errored = 0;
    var bKeys = Object.keys(this.robots);
    for (var j = 0; j < bKeys.length; j++) {
      var st = this.robots[bKeys[j]].status;
      if (st === 'cleaning' || st === 'returning') active++;
      else if (st === 'docked' || st === 'stored') docked++;
      else if (st === 'error') errored++;
    }
    var lowSup = 0;
    var sKeys = Object.keys(this.supplies);
    for (var k = 0; k < sKeys.length; k++) {
      if (this.supplies[sKeys[k]].stock <= this.supplies[sKeys[k]].minimum) lowSup++;
    }
    var energy = this.getEnergyReport();
    return { initialized: this.initialized, totalRooms: totalRooms, totalRobots: totalRobots,
      totalSupplies: totalSupplies, averageSoilLevel: avgSoil, robotsActive: active,
      robotsDocked: docked, robotsError: errored, activeJobs: this.activeCleaningJobs.length,
      queuedJobs: this.coordinationQueue.length, lowSupplies: lowSup,
      spotCleaningTriggers: this.spotCleaningTriggers.length,
      modes: { petMode: this.schedule.petMode, allergyMode: this.schedule.allergyMode,
        guestMode: this.schedule.guestMode, seasonalMode: this.schedule.seasonalMode,
        noiseMode: this.noiseConfig.currentMode },
      deepCleaning: { monthlyNextDue: this.deepCleaning.monthly.nextDue,
        quarterlyNextDue: this.deepCleaning.quarterly.nextDue,
        annualNextDue: this.deepCleaning.annual.nextDue },
      energyTotalKwh: energy.totalKwh, energyTotalCostSEK: energy.totalCostSEK };
  }
  getCleaningEffectivenessReport() {
    var report = { rooms: {}, overallAverage: 0, bestRoom: null, worstRoom: null,
      totalSessionsAnalyzed: 0 };
    var keys = Object.keys(this.rooms);
    var totalEff = 0;
    var effCount = 0;
    var bestEff = -1;
    var worstEff = 101;
    for (var i = 0; i < keys.length; i++) {
      var room = this.rooms[keys[i]];
      var history = room.cleaningHistory;
      if (history.length === 0) {
        report.rooms[room.id] = { name: room.name, sessions: 0, avgEffectiveness: 0,
          avgCoverage: 0, totalMissedSpots: 0, trend: 'none' };
        continue;
      }
      var sumEff = 0;
      var sumCov = 0;
      var sumMissed = 0;
      for (var j = 0; j < history.length; j++) {
        sumEff += history[j].effectiveness;
        sumCov += history[j].coverage;
        sumMissed += history[j].missedSpots;
      }
      var avgEff = Math.round(sumEff / history.length);
      var avgCov = Math.round(sumCov / history.length);
      var trend = 'stable';
      if (history.length >= 3) {
        var recentAvg = 0;
        var olderAvg = 0;
        var recentCount = Math.min(3, history.length);
        var olderCount = Math.min(3, Math.max(0, history.length - 3));
        for (var r = history.length - recentCount; r < history.length; r++) {
          recentAvg += history[r].effectiveness;
        }
        recentAvg = recentAvg / recentCount;
        if (olderCount > 0) {
          for (var o = 0; o < olderCount; o++) {
            olderAvg += history[o].effectiveness;
          }
          olderAvg = olderAvg / olderCount;
          if (recentAvg > olderAvg + 5) trend = 'improving';
          else if (recentAvg < olderAvg - 5) trend = 'declining';
        }
      }
      report.rooms[room.id] = { name: room.name, sessions: history.length,
        avgEffectiveness: avgEff, avgCoverage: avgCov, totalMissedSpots: sumMissed, trend: trend };
      report.totalSessionsAnalyzed += history.length;
      totalEff += avgEff;
      effCount++;
      if (avgEff > bestEff) { bestEff = avgEff; report.bestRoom = { id: room.id, name: room.name, effectiveness: avgEff }; }
      if (avgEff < worstEff) { worstEff = avgEff; report.worstRoom = { id: room.id, name: room.name, effectiveness: avgEff }; }
    }
    report.overallAverage = effCount > 0 ? Math.round(totalEff / effCount) : 0;
    return report;
  }
  getRobotPerformanceReport() {
    var report = {};
    var keys = Object.keys(this.robots);
    for (var i = 0; i < keys.length; i++) {
      var r = this.robots[keys[i]];
      var totalSessions = 0;
      var totalDuration = 0;
      var roomsCleaned = {};
      var roomKeys = Object.keys(this.rooms);
      for (var j = 0; j < roomKeys.length; j++) {
        var room = this.rooms[roomKeys[j]];
        for (var k = 0; k < room.cleaningHistory.length; k++) {
          if (room.cleaningHistory[k].robotUsed === r.id) {
            totalSessions++;
            totalDuration += room.cleaningHistory[k].duration;
            roomsCleaned[room.id] = (roomsCleaned[room.id] || 0) + 1;
          }
        }
      }
      var healthScore = Math.round((r.filterHealth + r.brushHealth + (100 - r.dustbinLevel)) / 3);
      var reliabilityScore = 100;
      if (r.errorHistory.length > 0) {
        reliabilityScore = Math.max(0, 100 - (r.errorHistory.length * 5));
      }
      report[r.id] = {
        model: r.model,
        type: r.type,
        status: r.status,
        totalSessions: totalSessions,
        totalDurationMinutes: totalDuration,
        totalCleaningHours: Math.round(r.totalCleaningHours * 10) / 10,
        roomsCleaned: roomsCleaned,
        healthScore: healthScore,
        reliabilityScore: reliabilityScore,
        energyEfficiency: totalDuration > 0 ? Math.round((r.energyUsage.watts * totalDuration / 60) * 100) / 100 : 0,
        errorRate: totalSessions > 0 ? Math.round((r.errorHistory.length / totalSessions) * 100) / 100 : 0,
        batteryLevel: Math.round(r.batteryLevel),
        motorHours: Math.round(r.motorHours),
        firmware: r.firmware
      };
    }
    return report;
  }
  getFloorTypeAnalysis() {
    var analysis = {};
    var keys = Object.keys(this.rooms);
    for (var i = 0; i < keys.length; i++) {
      var room = this.rooms[keys[i]];
      var fType = room.floorType;
      if (!analysis[fType]) {
        analysis[fType] = { totalArea: 0, roomCount: 0, avgSoilLevel: 0,
          avgEffectiveness: 0, rooms: [], totalSessions: 0 };
      }
      analysis[fType].totalArea += room.area;
      analysis[fType].roomCount++;
      analysis[fType].avgSoilLevel += room.soilLevel;
      analysis[fType].avgEffectiveness += room.effectiveness;
      analysis[fType].totalSessions += room.cleaningHistory.length;
      analysis[fType].rooms.push(room.id);
    }
    var floorTypes = Object.keys(analysis);
    for (var j = 0; j < floorTypes.length; j++) {
      var ft = analysis[floorTypes[j]];
      ft.avgSoilLevel = ft.roomCount > 0 ? Math.round(ft.avgSoilLevel / ft.roomCount) : 0;
      ft.avgEffectiveness = ft.roomCount > 0 ? Math.round(ft.avgEffectiveness / ft.roomCount) : 0;
    }
    return analysis;
  }
  getSupplyCostForecast(days) {
    var forecastDays = days || 30;
    var forecast = { period: forecastDays + ' days', supplies: [], totalEstimatedCostSEK: 0 };
    var keys = Object.keys(this.supplies);
    for (var i = 0; i < keys.length; i++) {
      var s = this.supplies[keys[i]];
      var estimatedUsage = s.usageRate * forecastDays;
      var remainingStock = Math.max(0, s.stock - estimatedUsage);
      var reorderNeeded = remainingStock < s.minimum;
      var reorderQty = reorderNeeded ? Math.ceil(s.minimum * 2 - remainingStock) : 0;
      var cost = reorderQty * s.costSEK;
      forecast.supplies.push({
        id: s.id,
        name: s.name,
        currentStock: s.stock,
        estimatedUsage: Math.round(estimatedUsage * 100) / 100,
        remainingStock: Math.round(remainingStock * 100) / 100,
        reorderNeeded: reorderNeeded,
        reorderQuantity: reorderQty,
        estimatedCostSEK: cost
      });
      forecast.totalEstimatedCostSEK += cost;
    }
    forecast.totalEstimatedCostSEK = Math.round(forecast.totalEstimatedCostSEK * 100) / 100;
    return forecast;
  }
  getScheduleComplianceReport() {
    var report = { rooms: {}, overallCompliance: 0, overdueRooms: [], onScheduleRooms: [] };
    var keys = Object.keys(this.rooms);
    var complianceSum = 0;
    var complianceCount = 0;
    var now = Date.now();
    for (var i = 0; i < keys.length; i++) {
      var room = this.rooms[keys[i]];
      var freqMs = 86400000;
      if (room.frequency === 'twice-daily') freqMs = 43200000;
      else if (room.frequency === 'daily') freqMs = 86400000;
      else if (room.frequency === 'every-other-day') freqMs = 172800000;
      else if (room.frequency === 'weekly') freqMs = 604800000;
      else if (room.frequency === 'monthly') freqMs = 2592000000;
      var lastCleanedMs = room.lastCleaned ? new Date(room.lastCleaned).getTime() : 0;
      var timeSinceCleaning = now - lastCleanedMs;
      var isOverdue = timeSinceCleaning > freqMs;
      var compliancePercent = 100;
      if (isOverdue) {
        compliancePercent = Math.max(0, Math.round((freqMs / timeSinceCleaning) * 100));
      }
      report.rooms[room.id] = {
        name: room.name,
        frequency: room.frequency,
        lastCleaned: room.lastCleaned,
        isOverdue: isOverdue,
        compliance: compliancePercent,
        soilLevel: Math.round(room.soilLevel)
      };
      complianceSum += compliancePercent;
      complianceCount++;
      if (isOverdue) {
        report.overdueRooms.push({ id: room.id, name: room.name, compliance: compliancePercent });
      } else {
        report.onScheduleRooms.push({ id: room.id, name: room.name });
      }
    }
    report.overallCompliance = complianceCount > 0 ? Math.round(complianceSum / complianceCount) : 0;
    return report;
  }
  getSystemHealthSummary() {
    var robotKeys = Object.keys(this.robots);
    var robotHealth = [];
    var overallHealth = 0;
    for (var i = 0; i < robotKeys.length; i++) {
      var r = this.robots[robotKeys[i]];
      var score = Math.round((r.filterHealth + r.brushHealth + r.batteryLevel + (100 - r.dustbinLevel)) / 4);
      robotHealth.push({ id: r.id, model: r.model, healthScore: score, status: r.status });
      overallHealth += score;
    }
    overallHealth = robotKeys.length > 0 ? Math.round(overallHealth / robotKeys.length) : 0;
    var lowSupplies = [];
    var sKeys = Object.keys(this.supplies);
    for (var j = 0; j < sKeys.length; j++) {
      var s = this.supplies[sKeys[j]];
      if (s.stock <= s.minimum) lowSupplies.push(s.name);
    }
    var dirtyRooms = [];
    var rmKeys = Object.keys(this.rooms);
    for (var k = 0; k < rmKeys.length; k++) {
      if (this.rooms[rmKeys[k]].soilLevel >= 60) {
        dirtyRooms.push({ id: rmKeys[k], name: this.rooms[rmKeys[k]].name,
          soilLevel: Math.round(this.rooms[rmKeys[k]].soilLevel) });
      }
    }
    return {
      overallHealthScore: overallHealth,
      robotHealth: robotHealth,
      activeJobs: this.activeCleaningJobs.length,
      queuedJobs: this.coordinationQueue.length,
      lowSupplies: lowSupplies,
      dirtyRooms: dirtyRooms,
      modes: {
        pet: this.schedule.petMode,
        allergy: this.schedule.allergyMode,
        guest: this.schedule.guestMode,
        seasonal: this.schedule.seasonalMode
      },
      noiseMode: this.noiseConfig.currentMode,
      timestamp: new Date().toISOString()
    };
  }
  pauseAllRobots() {
    var paused = [];
    var keys = Object.keys(this.robots);
    for (var i = 0; i < keys.length; i++) {
      var r = this.robots[keys[i]];
      if (r.status === 'cleaning') {
        r.status = 'paused';
        paused.push(r.id);
        this.homey.log('[Cleaning] Paused ' + r.model);
      }
    }
    if (paused.length > 0) {
      this.homey.emit('cleaning-robots-paused', { robots: paused, timestamp: new Date().toISOString() });
    }
    return { success: true, pausedRobots: paused };
  }
  resumeAllRobots() {
    var resumed = [];
    var keys = Object.keys(this.robots);
    for (var i = 0; i < keys.length; i++) {
      var r = this.robots[keys[i]];
      if (r.status === 'paused') {
        r.status = 'cleaning';
        resumed.push(r.id);
        this.homey.log('[Cleaning] Resumed ' + r.model);
      }
    }
    if (resumed.length > 0) {
      this.homey.emit('cleaning-robots-resumed', { robots: resumed, timestamp: new Date().toISOString() });
    }
    return { success: true, resumedRobots: resumed };
  }
  cancelAllJobs() {
    var cancelled = this.activeCleaningJobs.length + this.coordinationQueue.length;
    var keys = Object.keys(this.robots);
    for (var i = 0; i < keys.length; i++) {
      if (this.robots[keys[i]].status === 'cleaning' || this.robots[keys[i]].status === 'paused') {
        this.robots[keys[i]].status = 'returning';
        var self = this;
        var rid = keys[i];
        setTimeout(function() {
          if (self.robots[rid]) self.robots[rid].status = 'docked';
        }, 15000);
      }
    }
    this.activeCleaningJobs = [];
    this.coordinationQueue = [];
    this.homey.log('[Cleaning] All jobs cancelled: ' + cancelled + ' jobs');
    this.homey.emit('cleaning-all-cancelled', { count: cancelled, timestamp: new Date().toISOString() });
    return { success: true, cancelledJobs: cancelled };
  }
  updateRobotFirmware(robotId, newVersion) {
    var r = this.robots[robotId];
    if (!r) return { success: false, error: 'Unknown robot' };
    if (r.status === 'cleaning') return { success: false, error: 'Cannot update while cleaning' };
    var oldVersion = r.firmware;
    r.firmware = newVersion;
    r.maintenanceLog.push({ type: 'firmware-update', date: new Date().toISOString(),
      details: 'Updated from ' + oldVersion + ' to ' + newVersion });
    this.homey.log('[Cleaning] Firmware updated: ' + r.model + ' ' + oldVersion + ' -> ' + newVersion);
    this.homey.emit('cleaning-firmware-updated', { robotId: robotId, model: r.model,
      oldVersion: oldVersion, newVersion: newVersion, timestamp: new Date().toISOString() });
    return { success: true, robotId: robotId, oldVersion: oldVersion, newVersion: newVersion };
  }
  destroy() {
    this.homey.log('[Cleaning] Destroying cleaning automation system...');
    for (var i = 0; i < this.intervals.length; i++) clearInterval(this.intervals[i]);
    this.intervals = [];
    var keys = Object.keys(this.robots);
    for (var j = 0; j < keys.length; j++) {
      if (this.robots[keys[j]].status === 'cleaning') {
        this.robots[keys[j]].status = 'docked';
        this.robots[keys[j]].currentRoom = null;
      }
    }
    this.activeCleaningJobs = [];
    this.coordinationQueue = [];
    this.initialized = false;
    this.homey.log('[Cleaning] destroyed');
  }
}
module.exports = HomeCleaningAutomationSystem;
