'use strict';

/**
 * Room-by-Room Presence Tracking
 * Advanced presence detection with per-room tracking and behavior learning
 */
class PresenceTracker {
  constructor(app) {
    this.app = app;
    this.rooms = new Map();
    this.presenceHistory = [];
    this.behaviors = new Map();
    this.zones = new Map();
    this.maxHistorySize = 10000;
  }

  async initialize() {
    // Initialize room tracking
    await this.initializeRooms();
    
    // Start presence monitoring
    this.startPresenceMonitoring();
    
    // Load historical behavior patterns
    await this.loadBehaviorPatterns();
  }

  // ============================================
  // ROOM INITIALIZATION
  // ============================================

  async initializeRooms() {
    // Define rooms with sensors
    const roomConfigs = [
      {
        id: 'living_room',
        name: 'Vardagsrum',
        sensors: ['motion_living', 'door_living'],
        devices: ['light_living_1', 'light_living_2', 'tv'],
        timeout: 10 * 60 * 1000 // 10 minutes
      },
      {
        id: 'kitchen',
        name: 'Kök',
        sensors: ['motion_kitchen', 'door_kitchen'],
        devices: ['light_kitchen', 'fan_kitchen'],
        timeout: 5 * 60 * 1000 // 5 minutes
      },
      {
        id: 'bedroom',
        name: 'Sovrum',
        sensors: ['motion_bedroom', 'door_bedroom'],
        devices: ['light_bedroom', 'thermostat_bedroom'],
        timeout: 30 * 60 * 1000 // 30 minutes
      },
      {
        id: 'bathroom',
        name: 'Badrum',
        sensors: ['motion_bathroom', 'door_bathroom'],
        devices: ['light_bathroom', 'fan_bathroom'],
        timeout: 15 * 60 * 1000 // 15 minutes
      },
      {
        id: 'hallway',
        name: 'Hall',
        sensors: ['motion_hall', 'door_front'],
        devices: ['light_hall'],
        timeout: 3 * 60 * 1000 // 3 minutes
      },
      {
        id: 'office',
        name: 'Kontor',
        sensors: ['motion_office', 'door_office'],
        devices: ['light_office', 'desk_lamp'],
        timeout: 20 * 60 * 1000 // 20 minutes
      }
    ];

    for (const config of roomConfigs) {
      this.rooms.set(config.id, {
        ...config,
        occupied: false,
        lastMotion: 0,
        lastEntry: 0,
        lastExit: 0,
        occupancyDuration: 0,
        visitCount: 0,
        averageStayDuration: 0
      });
    }
  }

  // ============================================
  // PRESENCE MONITORING
  // ============================================

  startPresenceMonitoring() {
    // Check presence every 5 seconds
    setInterval(() => {
      this.updatePresenceStatus();
    }, 5000);

    // Analyze patterns every minute
    setInterval(() => {
      this.analyzePresencePatterns();
    }, 60000);
  }

  async updatePresenceStatus() {
    const now = Date.now();

    for (const [roomId, room] of this.rooms) {
      // Simulate motion sensor reading
      const hasMotion = this.simulateMotionDetection(roomId);
      
      if (hasMotion) {
        room.lastMotion = now;
        
        // Check if this is a new entry
        if (!room.occupied) {
          this.handleRoomEntry(roomId, now);
        }
      } else {
        // Check if timeout has passed
        if (room.occupied && (now - room.lastMotion) > room.timeout) {
          this.handleRoomExit(roomId, now);
        }
      }
    }
  }

  simulateMotionDetection(roomId) {
    const hour = new Date().getHours();
    
    // Simulate realistic motion patterns based on time and room
    const patterns = {
      living_room: hour >= 17 && hour <= 23 ? 0.8 : 0.2,
      kitchen: (hour >= 6 && hour <= 9) || (hour >= 17 && hour <= 20) ? 0.7 : 0.1,
      bedroom: (hour >= 22 || hour <= 7) ? 0.9 : 0.1,
      bathroom: hour >= 6 && hour <= 23 ? 0.15 : 0.05,
      hallway: 0.1,
      office: hour >= 9 && hour <= 17 ? 0.6 : 0.05
    };

    return Math.random() < (patterns[roomId] || 0.1);
  }

  handleRoomEntry(roomId, timestamp) {
    const room = this.rooms.get(roomId);
    
    room.occupied = true;
    room.lastEntry = timestamp;
    room.visitCount++;

    // Log entry event
    this.logPresenceEvent({
      type: 'entry',
      roomId,
      roomName: room.name,
      timestamp
    });

    // Trigger entry automations
    this.triggerRoomAutomations(roomId, 'entry');
  }

  handleRoomExit(roomId, timestamp) {
    const room = this.rooms.get(roomId);
    
    room.occupied = false;
    room.lastExit = timestamp;
    
    const duration = timestamp - room.lastEntry;
    room.occupancyDuration += duration;
    room.averageStayDuration = room.occupancyDuration / room.visitCount;

    // Log exit event
    this.logPresenceEvent({
      type: 'exit',
      roomId,
      roomName: room.name,
      timestamp,
      duration
    });

    // Trigger exit automations
    this.triggerRoomAutomations(roomId, 'exit');
  }

  logPresenceEvent(event) {
    this.presenceHistory.push(event);

    // Trim history
    if (this.presenceHistory.length > this.maxHistorySize) {
      this.presenceHistory = this.presenceHistory.slice(-this.maxHistorySize);
    }
  }

  // ============================================
  // PATTERN ANALYSIS
  // ============================================

  async analyzePresencePatterns() {
    const patterns = {
      hourly: this.analyzeHourlyPatterns(),
      transitions: this.analyzeRoomTransitions(),
      routines: this.detectRoutines(),
      anomalies: this.detectAnomalies()
    };

    // Update behavior database
    this.updateBehaviors(patterns);

    return patterns;
  }

  analyzeHourlyPatterns() {
    const hourlyData = new Array(24).fill(null).map(() => ({}));
    
    // Last 7 days of data
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentEvents = this.presenceHistory.filter(e => e.timestamp >= sevenDaysAgo);

    recentEvents.forEach(event => {
      const hour = new Date(event.timestamp).getHours();
      
      if (!hourlyData[hour][event.roomId]) {
        hourlyData[hour][event.roomId] = { entries: 0, exits: 0, totalDuration: 0 };
      }

      if (event.type === 'entry') {
        hourlyData[hour][event.roomId].entries++;
      } else if (event.type === 'exit') {
        hourlyData[hour][event.roomId].exits++;
        hourlyData[hour][event.roomId].totalDuration += event.duration || 0;
      }
    });

    return hourlyData;
  }

  analyzeRoomTransitions() {
    const transitions = new Map();
    const recentEvents = this.presenceHistory.slice(-500); // Last 500 events

    for (let i = 1; i < recentEvents.length; i++) {
      const prev = recentEvents[i - 1];
      const curr = recentEvents[i];

      if (prev.type === 'exit' && curr.type === 'entry') {
        const key = `${prev.roomId}->${curr.roomId}`;
        const timeDiff = curr.timestamp - prev.timestamp;

        // Only count quick transitions (within 2 minutes)
        if (timeDiff < 2 * 60 * 1000) {
          if (!transitions.has(key)) {
            transitions.set(key, { count: 0, avgTime: 0, times: [] });
          }

          const trans = transitions.get(key);
          trans.count++;
          trans.times.push(timeDiff);
          trans.avgTime = trans.times.reduce((a, b) => a + b, 0) / trans.times.length;
        }
      }
    }

    // Convert to array and sort by frequency
    return Array.from(transitions.entries())
      .map(([key, data]) => {
        const [from, to] = key.split('->');
        return {
          from,
          to,
          fromName: this.rooms.get(from)?.name || from,
          toName: this.rooms.get(to)?.name || to,
          count: data.count,
          avgTransitionTime: Math.round(data.avgTime / 1000) // seconds
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  detectRoutines() {
    const routines = [];
    const recentDays = this.getLastNDays(7);

    // Morning routine detection
    const morningEvents = recentDays.map(day => {
      return this.presenceHistory.filter(e => {
        const eventDate = new Date(e.timestamp);
        return eventDate.getDate() === day.getDate() &&
               eventDate.getHours() >= 6 && eventDate.getHours() <= 9 &&
               e.type === 'entry';
      });
    });

    if (morningEvents.every(day => day.length > 0)) {
      routines.push({
        name: 'Morgonrutin',
        timeRange: '06:00-09:00',
        consistency: this.calculateConsistency(morningEvents),
        rooms: this.extractCommonRooms(morningEvents),
        sequence: this.extractCommonSequence(morningEvents)
      });
    }

    // Evening routine detection
    const eveningEvents = recentDays.map(day => {
      return this.presenceHistory.filter(e => {
        const eventDate = new Date(e.timestamp);
        return eventDate.getDate() === day.getDate() &&
               eventDate.getHours() >= 18 && eventDate.getHours() <= 23 &&
               e.type === 'entry';
      });
    });

    if (eveningEvents.every(day => day.length > 0)) {
      routines.push({
        name: 'Kvällsrutin',
        timeRange: '18:00-23:00',
        consistency: this.calculateConsistency(eveningEvents),
        rooms: this.extractCommonRooms(eveningEvents),
        sequence: this.extractCommonSequence(eveningEvents)
      });
    }

    return routines;
  }

  detectAnomalies() {
    const anomalies = [];
    const now = Date.now();
    const hour = new Date().getHours();

    for (const [roomId, room] of this.rooms) {
      // Unusual nighttime activity
      if (hour >= 2 && hour <= 5 && room.occupied) {
        anomalies.push({
          type: 'unusual_time',
          severity: 'medium',
          room: room.name,
          description: `Ovanlig aktivitet i ${room.name} klockan ${hour}:00`
        });
      }

      // Extended occupancy
      if (room.occupied && room.averageStayDuration > 0) {
        const currentDuration = now - room.lastEntry;
        if (currentDuration > room.averageStayDuration * 3) {
          anomalies.push({
            type: 'extended_occupancy',
            severity: 'low',
            room: room.name,
            description: `Ovanligt lång vistelse i ${room.name}`,
            duration: Math.round(currentDuration / 60000) + ' min'
          });
        }
      }
    }

    return anomalies;
  }

  // ============================================
  // BEHAVIOR LEARNING
  // ============================================

  async loadBehaviorPatterns() {
    // Load from storage (simplified)
    this.behaviors = new Map();
  }

  updateBehaviors(patterns) {
    const timestamp = Date.now();

    this.behaviors.set('latest_patterns', {
      timestamp,
      patterns
    });

    // Learn preferences for each room
    for (const [roomId, room] of this.rooms) {
      if (!this.behaviors.has(roomId)) {
        this.behaviors.set(roomId, {
          preferredTimes: [],
          typicalDuration: 0,
          automationPreferences: {}
        });
      }

      const behavior = this.behaviors.get(roomId);
      behavior.typicalDuration = room.averageStayDuration;
    }
  }

  // ============================================
  // AUTOMATIONS
  // ============================================

  triggerRoomAutomations(roomId, eventType) {
    const room = this.rooms.get(roomId);
    
    console.log(`Room automation: ${eventType} in ${room.name}`);

    if (eventType === 'entry') {
      this.handleEntryAutomation(roomId);
    } else if (eventType === 'exit') {
      this.handleExitAutomation(roomId);
    }
  }

  handleEntryAutomation(roomId) {
    const room = this.rooms.get(roomId);
    const hour = new Date().getHours();

    // Turn on lights if dark
    if (hour < 7 || hour > 18) {
      console.log(`  → Turning on lights in ${room.name}`);
    }

    // Room-specific automations
    switch (roomId) {
      case 'kitchen':
        console.log(`  → Activating kitchen fan`);
        break;
      case 'bathroom':
        console.log(`  → Activating bathroom fan`);
        break;
      case 'office':
        console.log(`  → Setting office lighting to work mode`);
        break;
    }
  }

  handleExitAutomation(roomId) {
    const room = this.rooms.get(roomId);

    // Turn off lights after exit
    console.log(`  → Turning off lights in ${room.name}`);

    // Check if home is empty
    const anyOccupied = Array.from(this.rooms.values()).some(r => r.occupied);
    
    if (!anyOccupied) {
      console.log(`  → Home is empty - activating away mode`);
    }
  }

  // ============================================
  // PREDICTIONS
  // ============================================

  predictNextRoom(currentRoom) {
    const transitions = this.analyzeRoomTransitions();
    const relevant = transitions.filter(t => t.from === currentRoom);

    if (relevant.length > 0) {
      return {
        room: relevant[0].to,
        roomName: relevant[0].toName,
        confidence: Math.min(0.95, relevant[0].count / 100),
        avgTime: relevant[0].avgTransitionTime
      };
    }

    return null;
  }

  predictPresence(roomId, futureTime) {
    const hourlyPatterns = this.analyzeHourlyPatterns();
    const hour = new Date(futureTime).getHours();
    
    const roomData = hourlyPatterns[hour][roomId];
    
    if (roomData && roomData.entries > 0) {
      return {
        likely: true,
        confidence: Math.min(0.9, roomData.entries / 7), // Based on 7 days
        expectedDuration: roomData.totalDuration / roomData.exits || 0
      };
    }

    return { likely: false, confidence: 0 };
  }

  // ============================================
  // STATISTICS & REPORTING
  // ============================================

  async getPresenceReport(period = 24 * 60 * 60 * 1000) {
    const since = Date.now() - period;
    const events = this.presenceHistory.filter(e => e.timestamp >= since);

    const report = {
      period: {
        start: new Date(since).toISOString(),
        end: new Date().toISOString(),
        hours: period / (60 * 60 * 1000)
      },
      currentStatus: this.getCurrentStatus(),
      roomActivity: this.getRoomActivityStats(events),
      patterns: await this.analyzePresencePatterns(),
      predictions: this.getPresencePredictions()
    };

    return report;
  }

  getCurrentStatus() {
    const occupied = [];
    const vacant = [];
    
    for (const [roomId, room] of this.rooms) {
      if (room.occupied) {
        occupied.push({
          id: roomId,
          name: room.name,
          since: room.lastEntry,
          duration: Date.now() - room.lastEntry
        });
      } else {
        vacant.push({
          id: roomId,
          name: room.name,
          lastActivity: room.lastMotion
        });
      }
    }

    return {
      homeOccupied: occupied.length > 0,
      occupiedRooms: occupied,
      vacantRooms: vacant,
      totalRooms: this.rooms.size
    };
  }

  getRoomActivityStats(events) {
    const stats = {};

    for (const [roomId, room] of this.rooms) {
      const roomEvents = events.filter(e => e.roomId === roomId);
      const entries = roomEvents.filter(e => e.type === 'entry');
      const exits = roomEvents.filter(e => e.type === 'exit');

      stats[roomId] = {
        name: room.name,
        visits: entries.length,
        totalTime: exits.reduce((sum, e) => sum + (e.duration || 0), 0),
        averageStay: room.averageStayDuration,
        currentlyOccupied: room.occupied
      };
    }

    return stats;
  }

  getPresencePredictions() {
    const predictions = [];
    const now = Date.now();

    // Predict next hour
    const nextHour = now + 60 * 60 * 1000;
    
    for (const [roomId, room] of this.rooms) {
      const prediction = this.predictPresence(roomId, nextHour);
      
      if (prediction.likely && prediction.confidence > 0.5) {
        predictions.push({
          room: room.name,
          timeframe: 'within_1_hour',
          confidence: Math.round(prediction.confidence * 100),
          expectedDuration: Math.round(prediction.expectedDuration / 60000) + ' min'
        });
      }
    }

    return predictions;
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  getLastNDays(n) {
    const days = [];
    for (let i = 0; i < n; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      days.push(date);
    }
    return days;
  }

  calculateConsistency(eventSets) {
    // Calculate how consistent the pattern is
    if (eventSets.length === 0) return 0;
    
    const avgLength = eventSets.reduce((sum, set) => sum + set.length, 0) / eventSets.length;
    const variance = eventSets.reduce((sum, set) => sum + Math.pow(set.length - avgLength, 2), 0) / eventSets.length;
    
    return Math.max(0, 1 - (variance / (avgLength + 1)));
  }

  extractCommonRooms(eventSets) {
    const roomCounts = new Map();
    
    eventSets.forEach(set => {
      const rooms = new Set(set.map(e => e.roomId));
      rooms.forEach(room => {
        roomCounts.set(room, (roomCounts.get(room) || 0) + 1);
      });
    });

    return Array.from(roomCounts.entries())
      .filter(([room, count]) => count >= eventSets.length * 0.6) // Present in 60%+ of days
      .map(([room]) => this.rooms.get(room)?.name || room);
  }

  extractCommonSequence(eventSets) {
    // Simplified sequence extraction
    if (eventSets.length === 0 || eventSets[0].length === 0) return [];
    
    const firstSet = eventSets[0];
    return firstSet.slice(0, 3).map(e => this.rooms.get(e.roomId)?.name || e.roomId);
  }

  // ============================================
  // PUBLIC API
  // ============================================

  getRoomStatus(roomId) {
    return this.rooms.get(roomId);
  }

  getAllRoomsStatus() {
    return Array.from(this.rooms.entries()).map(([id, room]) => ({
      id,
      name: room.name,
      occupied: room.occupied,
      lastMotion: room.lastMotion,
      visitCount: room.visitCount,
      averageStay: Math.round(room.averageStayDuration / 60000) + ' min'
    }));
  }

  getOccupiedRooms() {
    return Array.from(this.rooms.values())
      .filter(room => room.occupied)
      .map(room => room.name);
  }

  isHomeOccupied() {
    return Array.from(this.rooms.values()).some(room => room.occupied);
  }
}

module.exports = PresenceTracker;
