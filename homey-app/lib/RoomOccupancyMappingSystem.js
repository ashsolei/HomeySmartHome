'use strict';

/**
 * RoomOccupancyMappingSystem
 * 
 * Dedicated room presence and occupancy mapping system.
 * Fuses multiple sensor types to provide accurate per-room occupancy,
 * person counting, transition tracking, usage analytics, and
 * zone-based automation triggers.
 */
class RoomOccupancyMappingSystem {

  constructor(homey) {
    this.homey = homey;

    // ── Room definitions ──────────────────────────────────────────────
    this.rooms = new Map();
    this.floors = new Map();

    // ── Occupancy state ───────────────────────────────────────────────
    this.occupancyState = new Map();          // roomId → { occupied, personCount, since, lastMotion, … }
    this.transitionLog = [];                  // recent room-to-room transitions
    this.sensorReadings = new Map();          // roomId → { motion, door, co2, power, light }

    // ── Heatmap & history ─────────────────────────────────────────────
    this.heatmap = new Map();                 // roomId → hourly bucket counts [0‥23]
    this.historicalData = [];                 // 30-day rolling occupancy snapshots
    this.usagePatterns = new Map();           // roomId → { dayOfWeek → hourBuckets }

    // ── Configuration ─────────────────────────────────────────────────
    this.config = {
      vacancyTimeoutMs: 10 * 60 * 1000,       // 10 min phantom-occupancy timeout
      phantomGuardIntervalMs: 60 * 1000,       // check every minute
      sleepDetectionQuietMs: 20 * 60 * 1000,   // 20 min no-motion → sleeping
      co2OccupiedThreshold: 600,               // ppm indicating presence
      co2PersonIncrement: 150,                 // ppm per additional person
      powerOccupiedThresholdW: 50,             // watts hinting activity
      lightOccupiedLux: 30,                    // lux suggesting presence
      petFilterEnabled: true,
      petMotionMaxHeight: 0.5,                 // metres — sensors below this may be pets
      transitionWindowMs: 15 * 1000,           // sequential motion window for transition
      historyRetentionDays: 30,
      snapshotIntervalMs: 5 * 60 * 1000,       // 5-min history snapshots
      heatmapBucketMinutes: 60,
      capacityWarningRatio: 0.85,
      reportDayOfWeek: 1,                      // Monday
    };

    // ── Timers ────────────────────────────────────────────────────────
    this._phantomGuardTimer = null;
    this._snapshotTimer = null;
    this._patternLearnTimer = null;

    this.initialized = false;
  }

  // ════════════════════════════════════════════════════════════════════
  //  Initialise
  // ════════════════════════════════════════════════════════════════════
  async initialize() {
    try {
      this.log('Initierar RoomOccupancyMappingSystem …');

      this._defineDefaultRooms();
      this._initOccupancyState();
      this._initHeatmap();
      this._loadHistoricalData();
      this._startPhantomGuard();
      this._startSnapshotRecorder();
      this._startPatternLearning();
      this._registerEventListeners();

      this.initialized = true;
      this.log('RoomOccupancyMappingSystem initierat med', this.rooms.size, 'rum');
    } catch (err) {
      this.error('Initiering misslyckades:', err);
      throw err;
    }
  }

  // ════════════════════════════════════════════════════════════════════
  //  1 · Room definitions
  // ════════════════════════════════════════════════════════════════════
  _defineDefaultRooms() {
    const defaults = [
      { id: 'living_room',   name: 'Vardagsrum',    floor: 0, width: 6.0, length: 4.5, capacity: 8,  fn: 'living'    },
      { id: 'kitchen',       name: 'Kök',           floor: 0, width: 4.0, length: 3.5, capacity: 4,  fn: 'kitchen'   },
      { id: 'master_bed',    name: 'Sovrum',        floor: 1, width: 5.0, length: 4.0, capacity: 2,  fn: 'bedroom'   },
      { id: 'child_bed',     name: 'Barnrum',       floor: 1, width: 4.0, length: 3.5, capacity: 2,  fn: 'bedroom'   },
      { id: 'bathroom_main', name: 'Badrum',        floor: 0, width: 3.0, length: 2.5, capacity: 2,  fn: 'bathroom'  },
      { id: 'bathroom_up',   name: 'Badrum övre',   floor: 1, width: 2.5, length: 2.0, capacity: 1,  fn: 'bathroom'  },
      { id: 'office',        name: 'Kontor',        floor: 1, width: 3.5, length: 3.0, capacity: 2,  fn: 'office'    },
      { id: 'hallway',       name: 'Hall',          floor: 0, width: 5.0, length: 1.8, capacity: 4,  fn: 'hallway'   },
      { id: 'garage',        name: 'Garage',        floor: 0, width: 6.0, length: 6.0, capacity: 2,  fn: 'utility'   },
      { id: 'laundry',       name: 'Tvättstuga',    floor: 0, width: 2.5, length: 2.5, capacity: 1,  fn: 'utility'   },
      { id: 'dining',        name: 'Matsal',        floor: 0, width: 4.0, length: 3.5, capacity: 6,  fn: 'dining'    },
      { id: 'stairway',      name: 'Trappa',        floor: -1, width: 1.2, length: 4.0, capacity: 2, fn: 'transition'},
    ];

    for (const r of defaults) {
      this.rooms.set(r.id, {
        ...r,
        areaSqm: Math.round(r.width * r.length * 100) / 100,
      });
    }

    this.floors.set(0, { name: 'Bottenvåning', rooms: defaults.filter(r => r.floor === 0).map(r => r.id) });
    this.floors.set(1, { name: 'Övervåning',   rooms: defaults.filter(r => r.floor === 1).map(r => r.id) });
    this.floors.set(-1, { name: 'Mellanvåning', rooms: defaults.filter(r => r.floor === -1).map(r => r.id) });
  }

  addRoom(roomDef) {
    try {
      const id = roomDef.id || roomDef.name.toLowerCase().replace(/\s+/g, '_');
      const room = {
        id,
        name: roomDef.name,
        floor: roomDef.floor ?? 0,
        width: roomDef.width ?? 3,
        length: roomDef.length ?? 3,
        capacity: roomDef.capacity ?? 4,
        fn: roomDef.fn ?? 'general',
        areaSqm: Math.round((roomDef.width ?? 3) * (roomDef.length ?? 3) * 100) / 100,
      };
      this.rooms.set(id, room);
      this._initRoomOccupancy(id);
      this._initRoomHeatmap(id);
      this.log(`Rum tillagt: ${room.name} (${room.areaSqm} m²)`);
      return room;
    } catch (err) {
      this.error('Kunde inte lägga till rum:', err);
      return null;
    }
  }

  // ════════════════════════════════════════════════════════════════════
  //  2 · Occupancy detection — sensor fusion
  // ════════════════════════════════════════════════════════════════════
  _initOccupancyState() {
    for (const roomId of this.rooms.keys()) {
      this._initRoomOccupancy(roomId);
    }
  }

  _initRoomOccupancy(roomId) {
    this.occupancyState.set(roomId, {
      occupied: false,
      personCount: 0,
      since: null,
      lastMotion: null,
      lastDoorEvent: null,
      sleeping: false,
      confidence: 0,
      sensorVotes: { motion: false, door: false, co2: false, power: false, light: false },
    });
    this.sensorReadings.set(roomId, {
      motion: false,
      door: null,
      co2: 400,
      power: 0,
      light: 0,
      lastUpdate: null,
    });
  }

  processSensorUpdate(roomId, sensorType, value, meta = {}) {
    try {
      if (!this.rooms.has(roomId)) return;

      const readings = this.sensorReadings.get(roomId);
      const state = this.occupancyState.get(roomId);
      const now = Date.now();
      readings.lastUpdate = now;

      switch (sensorType) {
        case 'motion':
          if (this.config.petFilterEnabled && meta.sensorHeight != null && meta.sensorHeight < this.config.petMotionMaxHeight) {
            this.log(`Husdjursrörelse filtrerad i ${roomId}`);
            return;
          }
          readings.motion = !!value;
          state.sensorVotes.motion = !!value;
          if (value) state.lastMotion = now;
          break;

        case 'door':
          readings.door = value; // 'open' | 'closed'
          state.sensorVotes.door = value === 'open';
          state.lastDoorEvent = now;
          break;

        case 'co2':
          readings.co2 = Number(value) || 400;
          state.sensorVotes.co2 = readings.co2 >= this.config.co2OccupiedThreshold;
          break;

        case 'power':
          readings.power = Number(value) || 0;
          state.sensorVotes.power = readings.power >= this.config.powerOccupiedThresholdW;
          break;

        case 'light':
          readings.light = Number(value) || 0;
          state.sensorVotes.light = readings.light >= this.config.lightOccupiedLux;
          break;

        default:
          this.log(`Okänd sensortyp: ${sensorType}`);
          return;
      }

      this._evaluateOccupancy(roomId);

      if (sensorType === 'motion' && value) {
        this._recordTransition(roomId, now);
        this._recordHeatmapEvent(roomId, now);
      }
    } catch (err) {
      this.error(`Sensoruppdatering misslyckades (${roomId}/${sensorType}):`, err);
    }
  }

  _evaluateOccupancy(roomId) {
    const state = this.occupancyState.get(roomId);
    const votes = state.sensorVotes;
    const now = Date.now();

    // Weighted vote
    const weights = { motion: 0.35, door: 0.10, co2: 0.25, power: 0.15, light: 0.15 };
    let score = 0;
    for (const [sensor, active] of Object.entries(votes)) {
      if (active) score += (weights[sensor] || 0);
    }

    state.confidence = Math.round(score * 100);
    const wasOccupied = state.occupied;
    state.occupied = score >= 0.35;

    if (state.occupied && !wasOccupied) {
      state.since = now;
      this._fireEvent('room_enter', roomId);
    } else if (!state.occupied && wasOccupied) {
      state.since = null;
      state.personCount = 0;
      state.sleeping = false;
      this._fireEvent('room_leave', roomId);
    }

    if (state.occupied) {
      this._estimatePersonCount(roomId);
      this._checkCapacity(roomId);
      this._evaluateSleep(roomId);
      this._fireEvent('room_occupied', roomId);
    } else {
      this._fireEvent('room_vacant', roomId);
    }
  }

  // ════════════════════════════════════════════════════════════════════
  //  3 · Person counting
  // ════════════════════════════════════════════════════════════════════
  _estimatePersonCount(roomId) {
    const state = this.occupancyState.get(roomId);
    const readings = this.sensorReadings.get(roomId);

    if (!state.occupied) { state.personCount = 0; return; }

    // CO₂-based estimation
    const baselineCO2 = 400;
    const excessCO2 = Math.max(0, readings.co2 - baselineCO2);
    const co2Estimate = Math.max(1, Math.round(excessCO2 / this.config.co2PersonIncrement));

    // Power-based hint
    const powerHint = readings.power > 200 ? 2 : readings.power > 100 ? 1.5 : 1;

    const raw = Math.round((co2Estimate * 0.7) + (powerHint * 0.3));
    const room = this.rooms.get(roomId);
    state.personCount = Math.min(raw, room ? room.capacity : 10);
  }

  getPersonCount(roomId) {
    const state = this.occupancyState.get(roomId);
    return state ? state.personCount : 0;
  }

  getTotalOccupants() {
    let total = 0;
    for (const state of this.occupancyState.values()) {
      total += state.personCount;
    }
    return total;
  }

  // ════════════════════════════════════════════════════════════════════
  //  4 · Occupancy heatmap
  // ════════════════════════════════════════════════════════════════════
  _initHeatmap() {
    for (const roomId of this.rooms.keys()) {
      this._initRoomHeatmap(roomId);
    }
  }

  _initRoomHeatmap(roomId) {
    this.heatmap.set(roomId, new Array(24).fill(0));
  }

  _recordHeatmapEvent(roomId, timestamp) {
    const hour = new Date(timestamp).getHours();
    const buckets = this.heatmap.get(roomId);
    if (buckets) buckets[hour]++;
  }

  getHeatmap(roomId) {
    if (roomId) return this.heatmap.get(roomId) || null;
    const result = {};
    for (const [id, buckets] of this.heatmap) {
      result[id] = [...buckets];
    }
    return result;
  }

  getMostUsedRooms(topN = 5) {
    const totals = [];
    for (const [roomId, buckets] of this.heatmap) {
      const total = buckets.reduce((s, v) => s + v, 0);
      const room = this.rooms.get(roomId);
      totals.push({ roomId, name: room ? room.name : roomId, total });
    }
    totals.sort((a, b) => b.total - a.total);
    return totals.slice(0, topN);
  }

  // ════════════════════════════════════════════════════════════════════
  //  5 · Room transition detection
  // ════════════════════════════════════════════════════════════════════
  _recordTransition(roomId, timestamp) {
    const recent = this.transitionLog.filter(
      t => timestamp - t.timestamp < this.config.transitionWindowMs
    );

    if (recent.length > 0) {
      const last = recent[recent.length - 1];
      if (last.toRoom !== roomId) {
        this.transitionLog.push({
          fromRoom: last.toRoom,
          toRoom: roomId,
          timestamp,
        });
        this._detectFloorTransition(last.toRoom, roomId, timestamp);
        this.log(`Övergång: ${last.toRoom} → ${roomId}`);
      }
    } else {
      this.transitionLog.push({ fromRoom: null, toRoom: roomId, timestamp });
    }

    // Trim old transitions
    const cutoff = timestamp - 24 * 60 * 60 * 1000;
    this.transitionLog = this.transitionLog.filter(t => t.timestamp > cutoff);
  }

  getRecentTransitions(count = 20) {
    return this.transitionLog.slice(-count);
  }

  // ════════════════════════════════════════════════════════════════════
  //  6 · Vacancy detection
  // ════════════════════════════════════════════════════════════════════
  getVacantRooms() {
    const vacant = [];
    for (const [roomId, state] of this.occupancyState) {
      if (!state.occupied) {
        const room = this.rooms.get(roomId);
        vacant.push({ roomId, name: room ? room.name : roomId });
      }
    }
    return vacant;
  }

  getVacancyRecommendations() {
    const recommendations = [];
    for (const [roomId, state] of this.occupancyState) {
      if (state.occupied) continue;
      const room = this.rooms.get(roomId);
      if (!room) continue;

      const actions = [];
      if (['living', 'bedroom', 'office', 'dining'].includes(room.fn)) {
        actions.push({ type: 'lights_off', message: `Släck lampor i ${room.name}` });
      }
      if (['living', 'bedroom', 'office'].includes(room.fn)) {
        actions.push({ type: 'hvac_setback', message: `Sänk temperatur i ${room.name}` });
      }
      if (room.fn === 'bathroom') {
        actions.push({ type: 'fan_off', message: `Stäng av fläkt i ${room.name}` });
      }
      if (actions.length > 0) {
        recommendations.push({ roomId, name: room.name, actions });
      }
    }
    return recommendations;
  }

  // ════════════════════════════════════════════════════════════════════
  //  7 · Usage patterns — learn by day & hour
  // ════════════════════════════════════════════════════════════════════
  _startPatternLearning() {
    this._patternLearnTimer = setInterval(() => {
      this._learnPatterns();
    }, 30 * 60 * 1000); // every 30 min
  }

  _learnPatterns() {
    try {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const hour = now.getHours();

      for (const [roomId, state] of this.occupancyState) {
        if (!this.usagePatterns.has(roomId)) {
          this.usagePatterns.set(roomId, this._emptyPatternGrid());
        }
        const grid = this.usagePatterns.get(roomId);
        if (state.occupied) {
          grid[dayOfWeek][hour] = (grid[dayOfWeek][hour] || 0) + 1;
        }
      }
    } catch (err) {
      this.error('Mönsterinlärning misslyckades:', err);
    }
  }

  _emptyPatternGrid() {
    const grid = {};
    for (let d = 0; d < 7; d++) {
      grid[d] = new Array(24).fill(0);
    }
    return grid;
  }

  getUsagePattern(roomId) {
    return this.usagePatterns.get(roomId) || null;
  }

  predictOccupancy(roomId, dayOfWeek, hour) {
    const grid = this.usagePatterns.get(roomId);
    if (!grid) return { probability: 0, dataPoints: 0 };
    const count = grid[dayOfWeek]?.[hour] || 0;
    const maxSamples = this.config.historyRetentionDays / 7;
    return {
      probability: Math.min(1, count / Math.max(1, maxSamples)),
      dataPoints: count,
    };
  }

  // ════════════════════════════════════════════════════════════════════
  //  8 · Capacity management
  // ════════════════════════════════════════════════════════════════════
  _checkCapacity(roomId) {
    const state = this.occupancyState.get(roomId);
    const room = this.rooms.get(roomId);
    if (!state || !room) return;

    const ratio = state.personCount / room.capacity;
    if (ratio >= this.config.capacityWarningRatio) {
      this._notify(
        `⚠️ Hög beläggning i ${room.name}`,
        `Uppskattat antal: ${state.personCount} / kapacitet ${room.capacity}`
      );
      this._fireEvent('capacity_warning', roomId, {
        personCount: state.personCount,
        capacity: room.capacity,
        ratio: Math.round(ratio * 100),
      });
    }
  }

  getRoomCapacityStatus() {
    const result = [];
    for (const [roomId, room] of this.rooms) {
      const state = this.occupancyState.get(roomId);
      result.push({
        roomId,
        name: room.name,
        personCount: state ? state.personCount : 0,
        capacity: room.capacity,
        utilization: state ? Math.round((state.personCount / room.capacity) * 100) : 0,
      });
    }
    return result;
  }

  // ════════════════════════════════════════════════════════════════════
  //  9 · Zone-based automation triggers
  // ════════════════════════════════════════════════════════════════════
  _fireEvent(eventType, roomId, extra = {}) {
    try {
      const room = this.rooms.get(roomId);
      const payload = {
        event: eventType,
        roomId,
        roomName: room ? room.name : roomId,
        timestamp: Date.now(),
        ...extra,
      };

      if (this.homey && typeof this.homey.emit === 'function') {
        this.homey.emit(`room_occupancy.${eventType}`, payload);
      }

      this._handleAutomationTrigger(eventType, roomId, payload);
    } catch (err) {
      this.error(`Händelse-utskick misslyckades (${eventType}/${roomId}):`, err);
    }
  }

  _handleAutomationTrigger(eventType, roomId, payload) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    switch (eventType) {
      case 'room_enter':
        this.log(`🚶 Inträde registrerat: ${room.name}`);
        break;
      case 'room_leave':
        this.log(`🚪 Utträde registrerat: ${room.name}`);
        break;
      case 'room_vacant':
        // eligible for energy-saving actions
        break;
      case 'room_occupied':
        break;
      case 'sleep_start':
        this.log(`😴 Sömn detekterad: ${room.name}`);
        break;
      case 'sleep_end':
        this.log(`☀️ Uppvaknande detekterat: ${room.name}`);
        break;
      default:
        break;
    }
  }

  // ════════════════════════════════════════════════════════════════════
  //  10 · Sleeping detection
  // ════════════════════════════════════════════════════════════════════
  _evaluateSleep(roomId) {
    const room = this.rooms.get(roomId);
    if (!room || room.fn !== 'bedroom') return;

    const state = this.occupancyState.get(roomId);
    const readings = this.sensorReadings.get(roomId);
    if (!state || !state.occupied) return;

    const now = Date.now();
    const timeSinceMotion = state.lastMotion ? now - state.lastMotion : Infinity;
    const hour = new Date(now).getHours();
    const nightTime = hour >= 22 || hour < 7;

    const wasSleeping = state.sleeping;

    if (timeSinceMotion > this.config.sleepDetectionQuietMs && nightTime && readings.light < 10) {
      state.sleeping = true;
      if (!wasSleeping) {
        this._fireEvent('sleep_start', roomId);
        this._notify(`🌙 God natt`, `Sömn detekterad i ${room.name}`);
      }
    } else if (state.sleeping && (readings.motion || readings.light > 30)) {
      state.sleeping = false;
      this._fireEvent('sleep_end', roomId);
      this._notify(`☀️ God morgon`, `Uppvaknande i ${room.name}`);
    }
  }

  getSleepingRooms() {
    const result = [];
    for (const [roomId, state] of this.occupancyState) {
      if (state.sleeping) {
        const room = this.rooms.get(roomId);
        result.push({ roomId, name: room ? room.name : roomId, since: state.since });
      }
    }
    return result;
  }

  // ════════════════════════════════════════════════════════════════════
  //  11 · Multi-floor mapping & stairway transitions
  // ════════════════════════════════════════════════════════════════════
  _detectFloorTransition(fromRoomId, toRoomId, timestamp) {
    const fromRoom = this.rooms.get(fromRoomId);
    const toRoom = this.rooms.get(toRoomId);
    if (!fromRoom || !toRoom) return;

    if (fromRoom.floor !== toRoom.floor || fromRoom.fn === 'transition' || toRoom.fn === 'transition') {
      this.log(`🏠 Våningsbyte: ${fromRoom.name} (vån ${fromRoom.floor}) → ${toRoom.name} (vån ${toRoom.floor})`);
      this._fireEvent('floor_transition', toRoomId, {
        fromFloor: fromRoom.floor,
        toFloor: toRoom.floor,
        fromRoom: fromRoomId,
        toRoom: toRoomId,
      });
    }
  }

  getFloorMap() {
    const map = {};
    for (const [floorNum, floor] of this.floors) {
      map[floorNum] = {
        name: floor.name,
        rooms: floor.rooms.map(roomId => {
          const room = this.rooms.get(roomId);
          const state = this.occupancyState.get(roomId);
          return {
            roomId,
            name: room ? room.name : roomId,
            occupied: state ? state.occupied : false,
            personCount: state ? state.personCount : 0,
            sleeping: state ? state.sleeping : false,
          };
        }),
      };
    }
    return map;
  }

  // ════════════════════════════════════════════════════════════════════
  //  12 · Room utilization reports
  // ════════════════════════════════════════════════════════════════════
  generateWeeklyReport() {
    try {
      const report = {
        generatedAt: new Date().toISOString(),
        period: 'vecka',
        rooms: [],
        recommendations: [],
      };

      for (const [roomId, room] of this.rooms) {
        const hm = this.heatmap.get(roomId) || new Array(24).fill(0);
        const totalEvents = hm.reduce((s, v) => s + v, 0);
        const peakHour = hm.indexOf(Math.max(...hm));
        const pattern = this.usagePatterns.get(roomId);

        let avgDailyMinutes = 0;
        if (pattern) {
          let totalSlots = 0;
          for (let d = 0; d < 7; d++) {
            for (let h = 0; h < 24; h++) {
              totalSlots += pattern[d]?.[h] || 0;
            }
          }
          avgDailyMinutes = Math.round((totalSlots * 30) / 7); // 30-min learning interval
        }

        report.rooms.push({
          roomId,
          name: room.name,
          floor: room.floor,
          totalMotionEvents: totalEvents,
          peakHour,
          avgDailyOccupancyMinutes: avgDailyMinutes,
          areaSqm: room.areaSqm,
        });
      }

      // Recommendations
      const sorted = [...report.rooms].sort((a, b) => a.totalMotionEvents - b.totalMotionEvents);
      const leastUsed = sorted.slice(0, 3);
      for (const r of leastUsed) {
        if (r.totalMotionEvents < 10) {
          report.recommendations.push(
            `${r.name} används sällan — överväg att minska uppvärmning eller belysning`
          );
        }
      }

      const mostUsed = sorted.slice(-2);
      for (const r of mostUsed) {
        report.recommendations.push(
          `${r.name} är mest populärt (toppat kl ${r.peakHour}:00) — säkerställ god ventilation`
        );
      }

      this.log('Veckorapport genererad');
      return report;
    } catch (err) {
      this.error('Rapportgenerering misslyckades:', err);
      return null;
    }
  }

  generateMonthlyReport() {
    try {
      const weekly = this.generateWeeklyReport();
      if (!weekly) return null;

      const report = {
        ...weekly,
        period: 'månad',
        historicalSnapshots: this.historicalData.length,
        topRooms: this.getMostUsedRooms(5),
      };
      this.log('Månadsrapport genererad');
      return report;
    } catch (err) {
      this.error('Månadsrapport misslyckades:', err);
      return null;
    }
  }

  // ════════════════════════════════════════════════════════════════════
  //  13 · Phantom occupancy prevention
  // ════════════════════════════════════════════════════════════════════
  _startPhantomGuard() {
    this._phantomGuardTimer = setInterval(() => {
      this._runPhantomGuard();
    }, this.config.phantomGuardIntervalMs);
  }

  _runPhantomGuard() {
    const now = Date.now();
    for (const [roomId, state] of this.occupancyState) {
      if (!state.occupied) continue;

      const timeSinceMotion = state.lastMotion ? now - state.lastMotion : Infinity;
      const readings = this.sensorReadings.get(roomId);
      const timeSinceUpdate = readings?.lastUpdate ? now - readings.lastUpdate : Infinity;

      // No motion for vacancy timeout → force vacant
      if (timeSinceMotion > this.config.vacancyTimeoutMs && !state.sleeping) {
        const room = this.rooms.get(roomId);
        this.log(`👻 Fantombeläggning rensad: ${room ? room.name : roomId} (ingen rörelse på ${Math.round(timeSinceMotion / 60000)} min)`);
        state.occupied = false;
        state.personCount = 0;
        state.confidence = 0;
        state.since = null;
        state.sensorVotes = { motion: false, door: false, co2: false, power: false, light: false };
        this._fireEvent('room_leave', roomId);
        this._fireEvent('room_vacant', roomId);
      }

      // Stale sensor data guard
      if (timeSinceUpdate > 30 * 60 * 1000) {
        state.confidence = Math.max(0, state.confidence - 20);
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════
  //  14 · Pet vs human discrimination
  // ════════════════════════════════════════════════════════════════════
  setPetFilterEnabled(enabled) {
    this.config.petFilterEnabled = !!enabled;
    this.log(`Husdjursfilter: ${this.config.petFilterEnabled ? 'aktiverat' : 'avaktiverat'}`);
  }

  setPetMotionThreshold(heightMetres) {
    if (heightMetres > 0 && heightMetres < 2) {
      this.config.petMotionMaxHeight = heightMetres;
      this.log(`Husdjurs rörelsehöjd satt till ${heightMetres} m`);
    }
  }

  getPetFilterStatus() {
    return {
      enabled: this.config.petFilterEnabled,
      maxHeight: this.config.petMotionMaxHeight,
    };
  }

  // ════════════════════════════════════════════════════════════════════
  //  15 · Historical occupancy patterns — 30-day rolling
  // ════════════════════════════════════════════════════════════════════
  _startSnapshotRecorder() {
    this._snapshotTimer = setInterval(() => {
      this._recordSnapshot();
    }, this.config.snapshotIntervalMs);
  }

  _recordSnapshot() {
    try {
      const now = Date.now();
      const snapshot = { timestamp: now, rooms: {} };

      for (const [roomId, state] of this.occupancyState) {
        snapshot.rooms[roomId] = {
          occupied: state.occupied,
          personCount: state.personCount,
          sleeping: state.sleeping,
          confidence: state.confidence,
        };
      }

      this.historicalData.push(snapshot);

      // Prune beyond retention
      const cutoff = now - this.config.historyRetentionDays * 24 * 60 * 60 * 1000;
      this.historicalData = this.historicalData.filter(s => s.timestamp > cutoff);
    } catch (err) {
      this.error('Snapshot-registrering misslyckades:', err);
    }
  }

  _loadHistoricalData() {
    // In a production system this would load from persistent storage
    this.historicalData = [];
    this.log('Historisk data initierad (tom vid start)');
  }

  getHistoricalOccupancy(roomId, hoursBack = 24) {
    const cutoff = Date.now() - hoursBack * 60 * 60 * 1000;
    return this.historicalData
      .filter(s => s.timestamp > cutoff && s.rooms[roomId])
      .map(s => ({
        timestamp: s.timestamp,
        occupied: s.rooms[roomId].occupied,
        personCount: s.rooms[roomId].personCount,
      }));
  }

  // ════════════════════════════════════════════════════════════════════
  //  16 · Real-time room status
  // ════════════════════════════════════════════════════════════════════
  getRoomStatus(roomId) {
    const room = this.rooms.get(roomId);
    const state = this.occupancyState.get(roomId);
    const readings = this.sensorReadings.get(roomId);
    if (!room || !state) return null;

    return {
      roomId,
      name: room.name,
      floor: room.floor,
      function: room.fn,
      areaSqm: room.areaSqm,
      occupied: state.occupied,
      personCount: state.personCount,
      sleeping: state.sleeping,
      confidence: state.confidence,
      since: state.since ? new Date(state.since).toLocaleTimeString('sv-SE') : null,
      lastMotion: state.lastMotion ? new Date(state.lastMotion).toLocaleTimeString('sv-SE') : null,
      sensors: readings ? { ...readings } : {},
      sensorVotes: { ...state.sensorVotes },
    };
  }

  getAllRoomStatuses() {
    const statuses = [];
    for (const roomId of this.rooms.keys()) {
      statuses.push(this.getRoomStatus(roomId));
    }
    return statuses.filter(Boolean);
  }

  getOccupiedRooms() {
    return this.getAllRoomStatuses().filter(r => r.occupied);
  }

  getRoomSummary() {
    const all = this.getAllRoomStatuses();
    const occupied = all.filter(r => r.occupied);
    const sleeping = all.filter(r => r.sleeping);
    const vacant = all.filter(r => !r.occupied);

    return {
      totalRooms: all.length,
      occupiedRooms: occupied.length,
      vacantRooms: vacant.length,
      sleepingRooms: sleeping.length,
      totalOccupants: occupied.reduce((s, r) => s + r.personCount, 0),
      rooms: all.map(r => ({
        name: r.name,
        status: r.sleeping ? 'sovande' : r.occupied ? 'upptaget' : 'ledigt',
        persons: r.personCount,
      })),
    };
  }

  // ════════════════════════════════════════════════════════════════════
  //  Event listeners
  // ════════════════════════════════════════════════════════════════════
  _registerEventListeners() {
    try {
      if (this.homey && typeof this.homey.on === 'function') {
        this.homey.on('device.motion', (data) => {
          if (data && data.roomId) {
            this.processSensorUpdate(data.roomId, 'motion', data.value, data.meta || {});
          }
        });

        this.homey.on('device.door', (data) => {
          if (data && data.roomId) {
            this.processSensorUpdate(data.roomId, 'door', data.value);
          }
        });

        this.homey.on('device.co2', (data) => {
          if (data && data.roomId) {
            this.processSensorUpdate(data.roomId, 'co2', data.value);
          }
        });

        this.homey.on('device.power', (data) => {
          if (data && data.roomId) {
            this.processSensorUpdate(data.roomId, 'power', data.value);
          }
        });

        this.homey.on('device.light', (data) => {
          if (data && data.roomId) {
            this.processSensorUpdate(data.roomId, 'light', data.value);
          }
        });
      }
    } catch (err) {
      this.error('Händelselyssnare kunde inte registreras:', err);
    }
  }

  // ════════════════════════════════════════════════════════════════════
  //  Notifications
  // ════════════════════════════════════════════════════════════════════
  _notify(title, message) {
    try {
      if (this.homey && this.homey.notifications) {
        this.homey.notifications.createNotification({ excerpt: `${title} — ${message}` }).catch(() => {});
      }
    } catch (_) { /* best effort */ }
  }

  // ════════════════════════════════════════════════════════════════════
  //  Statistics
  // ════════════════════════════════════════════════════════════════════
  getStatistics() {
    const summary = this.getRoomSummary();
    const mostUsed = this.getMostUsedRooms(3);
    const vacantRecs = this.getVacancyRecommendations();

    return {
      initialized: this.initialized,
      totalRooms: this.rooms.size,
      totalFloors: this.floors.size,
      occupiedNow: summary.occupiedRooms,
      vacantNow: summary.vacantRooms,
      sleepingNow: summary.sleepingRooms,
      totalOccupants: summary.totalOccupants,
      mostUsedRooms: mostUsed,
      energySavingOpportunities: vacantRecs.length,
      historicalSnapshots: this.historicalData.length,
      transitionLogSize: this.transitionLog.length,
      config: {
        vacancyTimeoutMin: this.config.vacancyTimeoutMs / 60000,
        petFilterEnabled: this.config.petFilterEnabled,
        historyRetentionDays: this.config.historyRetentionDays,
      },
    };
  }

  // ════════════════════════════════════════════════════════════════════
  //  Cleanup
  // ════════════════════════════════════════════════════════════════════
  destroy() {
    if (this._phantomGuardTimer) clearInterval(this._phantomGuardTimer);
    if (this._snapshotTimer) clearInterval(this._snapshotTimer);
    if (this._patternLearnTimer) clearInterval(this._patternLearnTimer);
    this.log('RoomOccupancyMappingSystem stoppat');
  }

  // ════════════════════════════════════════════════════════════════════
  //  Logging
  // ════════════════════════════════════════════════════════════════════
  log(...args) {
    if (this.homey && typeof this.homey.log === 'function') {
      this.homey.log('[RoomOccupancy]', ...args);
    } else {
      console.log('[RoomOccupancy]', ...args);
    }
  }

  error(...args) {
    if (this.homey && typeof this.homey.error === 'function') {
      this.homey.error('[RoomOccupancy]', ...args);
    } else {
      console.error('[RoomOccupancy]', ...args);
    }
  }
}

module.exports = RoomOccupancyMappingSystem;
