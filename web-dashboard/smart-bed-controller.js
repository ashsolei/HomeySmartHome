'use strict';

/**
 * Smart Bed Controller
 * Advanced bed control with sleep tracking and automation
 */
class SmartBedController {
  constructor(app) {
    this._intervals = [];
    this._timeouts = [];
    this.app = app;
    this.beds = new Map();
    this.sleepSessions = [];
    this.sleepData = new Map();
  }

  async initialize() {
    await this.setupBeds();
    
    this.startMonitoring();
  }

  // ============================================
  // BED SETUP
  // ============================================

  async setupBeds() {
    const beds = [
      {
        id: 'bed_master',
        name: 'Master Bedroom',
        type: 'dual',  // dual-zone control
        sides: {
          left: {
            user: 'Anna',
            position: { head: 0, foot: 0 },  // 0-45 degrees
            temperature: 22,  // °C
            firmness: 7,  // 1-10 scale
            massage: { enabled: false, intensity: 0, program: null },
            occupied: false
          },
          right: {
            user: 'Erik',
            position: { head: 0, foot: 0 },
            temperature: 20,
            firmness: 8,
            massage: { enabled: false, intensity: 0, program: null },
            occupied: false
          }
        },
        features: {
          underBedLighting: true,
          usbCharging: true,
          snoreDetection: true,
          antiSnore: true
        }
      },
      {
        id: 'bed_guest',
        name: 'Guest Room',
        type: 'single',
        position: { head: 0, foot: 0 },
        temperature: 21,
        firmness: 6,
        occupied: false,
        features: {
          underBedLighting: false,
          usbCharging: true
        }
      }
    ];

    for (const bed of beds) {
      this.beds.set(bed.id, bed);
    }
  }

  // ============================================
  // BED CONTROL
  // ============================================

  async adjustPosition(bedId, side, part, degrees) {
    const bed = this.beds.get(bedId);
    
    if (!bed) {
      return { success: false, error: 'Bed not found' };
    }

    // Validate degrees (0-45)
    degrees = Math.max(0, Math.min(45, degrees));

    if (bed.type === 'dual') {
      bed.sides[side].position[part] = degrees;
      console.log(`🛏️ ${bed.name} (${side}): ${part} → ${degrees}°`);
    } else {
      bed.position[part] = degrees;
      console.log(`🛏️ ${bed.name}: ${part} → ${degrees}°`);
    }

    return { success: true, position: degrees };
  }

  async setTemperature(bedId, side, temperature) {
    const bed = this.beds.get(bedId);
    
    if (!bed) {
      return { success: false, error: 'Bed not found' };
    }

    // Validate temperature (15-30°C)
    temperature = Math.max(15, Math.min(30, temperature));

    if (bed.type === 'dual') {
      bed.sides[side].temperature = temperature;
      console.log(`🌡️ ${bed.name} (${side}): ${temperature}°C`);
    } else {
      bed.temperature = temperature;
      console.log(`🌡️ ${bed.name}: ${temperature}°C`);
    }

    return { success: true, temperature };
  }

  async setFirmness(bedId, side, firmness) {
    const bed = this.beds.get(bedId);
    
    if (!bed) {
      return { success: false, error: 'Bed not found' };
    }

    // Validate firmness (1-10)
    firmness = Math.max(1, Math.min(10, firmness));

    if (bed.type === 'dual') {
      bed.sides[side].firmness = firmness;
      console.log(`💪 ${bed.name} (${side}): firmness ${firmness}/10`);
    } else {
      bed.firmness = firmness;
      console.log(`💪 ${bed.name}: firmness ${firmness}/10`);
    }

    return { success: true, firmness };
  }

  async startMassage(bedId, side, program, intensity) {
    const bed = this.beds.get(bedId);
    
    if (!bed) {
      return { success: false, error: 'Bed not found' };
    }

    const programs = ['wave', 'pulse', 'full', 'legs'];
    
    if (!programs.includes(program)) {
      return { success: false, error: 'Invalid massage program' };
    }

    // Validate intensity (1-10)
    intensity = Math.max(1, Math.min(10, intensity));

    if (bed.type === 'dual') {
      bed.sides[side].massage = {
        enabled: true,
        intensity,
        program
      };
      console.log(`💆 ${bed.name} (${side}): ${program} massage @ intensity ${intensity}`);
    } else {
      bed.massage = {
        enabled: true,
        intensity,
        program
      };
      console.log(`💆 ${bed.name}: ${program} massage @ intensity ${intensity}`);
    }

    // Auto-stop after 15 minutes
    this._timeouts.push(setTimeout(() => {
      this.stopMassage(bedId, side);
    }, 15 * 60 * 1000));

    return { success: true };
  }

  async stopMassage(bedId, side) {
    const bed = this.beds.get(bedId);
    
    if (!bed) {
      return { success: false, error: 'Bed not found' };
    }

    if (bed.type === 'dual') {
      bed.sides[side].massage.enabled = false;
      console.log(`💆 ${bed.name} (${side}): massage stopped`);
    } else {
      bed.massage.enabled = false;
      console.log(`💆 ${bed.name}: massage stopped`);
    }

    return { success: true };
  }

  // ============================================
  // SLEEP TRACKING
  // ============================================

  async detectOccupancy(bedId, side = null) {
    const bed = this.beds.get(bedId);
    
    if (!bed) {
      return { occupied: false };
    }

    // Simulated pressure sensor detection
    const isOccupied = Math.random() < 0.3;

    if (bed.type === 'dual') {
      bed.sides[side].occupied = isOccupied;
      
      if (isOccupied && !this.isUserAsleep(bed.sides[side].user)) {
        console.log(`😴 ${bed.sides[side].user} got into bed (${side} side)`);
        await this.startSleepSession(bedId, side);
      } else if (!isOccupied && this.isUserAsleep(bed.sides[side].user)) {
        console.log(`☀️ ${bed.sides[side].user} left bed (${side} side)`);
        await this.endSleepSession(bedId, side);
      }
    } else {
      bed.occupied = isOccupied;
      
      if (isOccupied && !this.hasActiveSleepSession(bedId)) {
        console.log(`😴 Someone got into ${bed.name}`);
        await this.startSleepSession(bedId);
      } else if (!isOccupied && this.hasActiveSleepSession(bedId)) {
        console.log(`☀️ Someone left ${bed.name}`);
        await this.endSleepSession(bedId);
      }
    }

    return { occupied: isOccupied };
  }

  async startSleepSession(bedId, side = null) {
    const bed = this.beds.get(bedId);
    const user = bed.type === 'dual' ? bed.sides[side].user : 'Guest';

    const session = {
      id: 'session_' + Date.now(),
      bedId,
      side,
      user,
      startTime: Date.now(),
      endTime: null,
      duration: null,
      quality: null,
      movements: 0,
      snoreEvents: 0,
      heartRate: [],
      respiratoryRate: []
    };

    this.sleepSessions.push(session);

    console.log(`💤 Sleep session started: ${user}`);

    // Initialize sleep data tracking
    if (!this.sleepData.has(user)) {
      this.sleepData.set(user, {
        totalSessions: 0,
        averageDuration: 0,
        averageQuality: 0,
        sleepGoal: 8 * 60  // minutes
      });
    }

    return session;
  }

  async endSleepSession(bedId, side = null) {
    const bed = this.beds.get(bedId);
    const user = bed.type === 'dual' ? bed.sides[side].user : 'Guest';

    const session = this.sleepSessions.find(s => 
      s.bedId === bedId && 
      s.side === side && 
      !s.endTime
    );

    if (!session) {
      return { success: false, error: 'No active session' };
    }

    session.endTime = Date.now();
    session.duration = (session.endTime - session.startTime) / (1000 * 60);  // minutes

    // Calculate sleep quality (0-100)
    session.quality = this.calculateSleepQuality(session);

    console.log(`⏰ Sleep session ended: ${user}`);
    console.log(`   Duration: ${Math.floor(session.duration / 60)}h ${Math.floor(session.duration % 60)}m`);
    console.log(`   Quality: ${session.quality}/100`);
    console.log(`   Movements: ${session.movements}`);
    console.log(`   Snore events: ${session.snoreEvents}`);

    // Update user sleep data
    const userData = this.sleepData.get(user);
    userData.totalSessions++;
    userData.averageDuration = (userData.averageDuration * (userData.totalSessions - 1) + session.duration) / userData.totalSessions;
    userData.averageQuality = (userData.averageQuality * (userData.totalSessions - 1) + session.quality) / userData.totalSessions;

    // Trigger morning routine
    await this.triggerWakeUpRoutine(bedId, side);

    return { success: true, session };
  }

  calculateSleepQuality(session) {
    let quality = 100;

    // Deduct points for movements
    quality -= session.movements * 2;

    // Deduct points for snore events
    quality -= session.snoreEvents * 3;

    // Deduct points for short sleep
    if (session.duration < 360) {  // Less than 6 hours
      quality -= (360 - session.duration) * 0.5;
    }

    return Math.max(0, Math.min(100, Math.round(quality)));
  }

  isUserAsleep(user) {
    return this.sleepSessions.some(s => s.user === user && !s.endTime);
  }

  hasActiveSleepSession(bedId) {
    return this.sleepSessions.some(s => s.bedId === bedId && !s.endTime);
  }

  // ============================================
  // SLEEP STAGES
  // ============================================

  async trackSleepStages(sessionId) {
    const session = this.sleepSessions.find(s => s.id === sessionId);
    
    if (!session) {
      return { success: false };
    }

    // Simulated sleep stage tracking
    const stages = ['awake', 'light', 'deep', 'REM'];
    const currentStage = stages[Math.floor(Math.random() * stages.length)];

    session.currentStage = currentStage;

    // Track heart rate and respiratory rate
    const heartRate = 50 + Math.floor(Math.random() * 30);  // 50-80 bpm
    const respiratoryRate = 12 + Math.floor(Math.random() * 8);  // 12-20 breaths/min

    session.heartRate.push({ time: Date.now(), rate: heartRate });
    session.respiratoryRate.push({ time: Date.now(), rate: respiratoryRate });

    return { stage: currentStage, heartRate, respiratoryRate };
  }

  // ============================================
  // SNORE DETECTION
  // ============================================

  async detectSnoring(bedId, side) {
    const bed = this.beds.get(bedId);
    
    if (!bed || !bed.features.snoreDetection) {
      return { snoring: false };
    }

    // Simulated snore detection (10% chance)
    const isSnoring = Math.random() < 0.1;

    if (isSnoring) {
      const user = bed.type === 'dual' ? bed.sides[side].user : 'Guest';
      console.log(`😴 Snoring detected: ${user}`);

      // Log snore event
      const session = this.sleepSessions.find(s => 
        s.bedId === bedId && 
        s.side === side && 
        !s.endTime
      );
      
      if (session) {
        session.snoreEvents++;
      }

      // Anti-snore action
      if (bed.features.antiSnore) {
        await this.handleSnoring(bedId, side);
      }
    }

    return { snoring: isSnoring };
  }

  async handleSnoring(bedId, side) {
    console.log('   🛏️ Anti-snore action: Raising head 10°');
    
    // Gently raise head position
    const bed = this.beds.get(bedId);
    const currentHead = bed.type === 'dual' 
      ? bed.sides[side].position.head 
      : bed.position.head;

    const newPosition = Math.min(45, currentHead + 10);
    
    await this.adjustPosition(bedId, side, 'head', newPosition);

    return { success: true };
  }

  // ============================================
  // ROUTINES
  // ============================================

  async activateSleepMode(bedId, side = null) {
    console.log('😴 Activating sleep mode');

    // Set bed temperature to preferred sleep temp
    await this.setTemperature(bedId, side, 19);

    // Lower head and foot slightly for comfort
    await this.adjustPosition(bedId, side, 'head', 5);
    await this.adjustPosition(bedId, side, 'foot', 0);

    // Enable under-bed lighting (dim)
    console.log('   💡 Under-bed lighting: dim');

    // Set room conditions
    console.log('   🌡️  Room temperature: 18°C');
    console.log('   💡 Room lights: off');
    console.log('   🔇 Do not disturb: enabled');

    return { success: true };
  }

  async triggerWakeUpRoutine(bedId, side = null) {
    console.log('☀️ Wake-up routine starting');

    const bed = this.beds.get(bedId);
    const user = bed.type === 'dual' ? bed.sides[side].user : 'Guest';

    // Gradual lighting
    console.log('   💡 Gradually increasing lights');

    // Raise head position gently
    await this.adjustPosition(bedId, side, 'head', 30);
    console.log('   🛏️ Raising head position');

    // Warm up bed slightly
    await this.setTemperature(bedId, side, 24);
    console.log('   🌡️  Warming bed');

    // Optional massage
    console.log('   💆 Gentle wake-up massage available');

    // Home automation
    console.log('   ☕ Starting coffee maker');
    console.log('   🎵 Playing morning playlist');

    return { success: true, user };
  }

  async setPreset(bedId, side, preset) {
    console.log(`🛏️ Setting preset: ${preset}`);

    const presets = {
      flat: { head: 0, foot: 0 },
      lounge: { head: 35, foot: 10 },
      zero_gravity: { head: 30, foot: 25 },
      snore: { head: 15, foot: 0 },
      tv: { head: 45, foot: 5 }
    };

    const position = presets[preset];
    
    if (!position) {
      return { success: false, error: 'Unknown preset' };
    }

    await this.adjustPosition(bedId, side, 'head', position.head);
    await this.adjustPosition(bedId, side, 'foot', position.foot);

    return { success: true };
  }

  // ============================================
  // MONITORING
  // ============================================

  startMonitoring() {
    // Check bed occupancy every minute
    this._intervals.push(setInterval(() => {
      for (const [bedId, bed] of this.beds) {
        if (bed.type === 'dual') {
          this.detectOccupancy(bedId, 'left');
          this.detectOccupancy(bedId, 'right');
          
          // Check for snoring
          if (bed.sides.left.occupied) {
            this.detectSnoring(bedId, 'left');
          }
          if (bed.sides.right.occupied) {
            this.detectSnoring(bedId, 'right');
          }
        } else {
          this.detectOccupancy(bedId);
        }
      }
    }, 60 * 1000));

    // Track sleep stages every 5 minutes for active sessions
    this._intervals.push(setInterval(() => {
      for (const session of this.sleepSessions) {
        if (!session.endTime) {
          this.trackSleepStages(session.id);
          
          // Random movement detection (5% chance per check)
          if (Math.random() < 0.05) {
            session.movements++;
          }
        }
      }
    }, 5 * 60 * 1000));

    console.log('🛏️ Smart Bed Controller active');
  }

  // ============================================
  // REPORTING
  // ============================================

  getBedOverview() {
    const beds = Array.from(this.beds.values());
    const activeSessions = this.sleepSessions.filter(s => !s.endTime).length;
    const totalSessions = this.sleepSessions.length;

    return {
      totalBeds: beds.length,
      activeSleepSessions: activeSessions,
      totalSleepSessions: totalSessions,
      trackedUsers: this.sleepData.size
    };
  }

  getBedStatus() {
    return Array.from(this.beds.values()).map(b => {
      if (b.type === 'dual') {
        return {
          name: b.name,
          left: {
            user: b.sides.left.user,
            occupied: b.sides.left.occupied,
            temp: b.sides.left.temperature + '°C',
            position: `${b.sides.left.position.head}°/${b.sides.left.position.foot}°`
          },
          right: {
            user: b.sides.right.user,
            occupied: b.sides.right.occupied,
            temp: b.sides.right.temperature + '°C',
            position: `${b.sides.right.position.head}°/${b.sides.right.position.foot}°`
          }
        };
      } else {
        return {
          name: b.name,
          occupied: b.occupied,
          temp: b.temperature + '°C',
          position: `${b.position.head}°/${b.position.foot}°`
        };
      }
    });
  }

  getSleepReport(user, days = 7) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    
    const sessions = this.sleepSessions.filter(s => 
      s.user === user && 
      s.endTime && 
      s.startTime >= cutoff
    );

    const avgDuration = sessions.reduce((sum, s) => sum + s.duration, 0) / sessions.length;
    const avgQuality = sessions.reduce((sum, s) => sum + s.quality, 0) / sessions.length;

    return {
      user,
      period: `${days} days`,
      nights: sessions.length,
      avgDuration: `${Math.floor(avgDuration / 60)}h ${Math.floor(avgDuration % 60)}m`,
      avgQuality: Math.round(avgQuality) + '/100',
      totalMovements: sessions.reduce((sum, s) => sum + s.movements, 0),
      totalSnoreEvents: sessions.reduce((sum, s) => sum + s.snoreEvents, 0)
    };
  }

  getLastSleepSession(user) {
    const sessions = this.sleepSessions.filter(s => s.user === user && s.endTime);
    
    if (sessions.length === 0) {
      return null;
    }

    const lastSession = sessions[sessions.length - 1];

    return {
      user: lastSession.user,
      date: new Date(lastSession.startTime).toLocaleDateString('sv-SE'),
      duration: `${Math.floor(lastSession.duration / 60)}h ${Math.floor(lastSession.duration % 60)}m`,
      quality: lastSession.quality + '/100',
      movements: lastSession.movements,
      snoreEvents: lastSession.snoreEvents
    };
  }

  destroy() {
    if (this._intervals) {
      this._intervals.forEach(id => clearInterval(id));
      this._intervals = [];
    }
    if (this._timeouts) {
      this._timeouts.forEach(id => clearTimeout(id));
      this._timeouts = [];
    }
  }
}

module.exports = SmartBedController;
