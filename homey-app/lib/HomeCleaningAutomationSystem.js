const EventEmitter = require('events');

/**
 * Home Cleaning Automation System
 * 
 * Provides intelligent cleaning automation with robot vacuum/mop coordination,
 * scheduling optimization, and cleaning performance tracking.
 * 
 * Features:
 * - Multi-robot coordination (vacuum, mop)
 * - Room-by-room cleaning schedules
 * - Smart obstacle avoidance and mapping
 * - Automatic emptying and maintenance
 * - Cleaning performance analytics
 * - No-go zones and virtual walls
 * - Voice command integration
 * - Integration with presence detection
 * - Maintenance tracking and reminders
 * - Energy-efficient scheduling
 */
class HomeCleaningAutomationSystem extends EventEmitter {
  constructor(homey) {
    super();
    this.homey = homey;
    this.robots = new Map();
    this.zones = new Map();
    this.schedules = [];
    this.cleaningSessions = [];
    this.maintenanceLog = [];
    this.monitoringInterval = null;
    
    // Performance optimizations
    this._cache = new Map();
    this._cacheTimeout = 180000; // 3 minutes
  }

  async initialize() {
    this.homey.log('Initializing Home Cleaning Automation System...');
    
    try {
      await this.loadSettings();
      this.initializeDefaultRobots();
      this.initializeCleaningZones();
      this.initializeSchedules();
      
      this.startMonitoring();
      
      this.homey.log('Home Cleaning Automation System initialized successfully');
      return true;
    } catch (error) {
      this.homey.error('Failed to initialize Cleaning Automation:', error);
      throw error;
    }
  }

  async loadSettings() {
    try {
      const settings = await this.homey.settings.get('homeCleaning') || {};
      
      if (settings.robots) {
        settings.robots.forEach(robot => {
          this.robots.set(robot.id, robot);
        });
      }
      
      if (settings.zones) {
        settings.zones.forEach(zone => {
          this.zones.set(zone.id, zone);
        });
      }
      
      this.schedules = settings.schedules || [];
      this.cleaningSessions = settings.cleaningSessions || [];
      this.maintenanceLog = settings.maintenanceLog || [];
    } catch (error) {
      this.homey.error('Error loading cleaning settings:', error);
      throw error;
    }
  }

  async saveSettings() {
    try {
      const settings = {
        robots: Array.from(this.robots.values()),
        zones: Array.from(this.zones.values()),
        schedules: this.schedules,
        cleaningSessions: this.cleaningSessions.slice(-100),
        maintenanceLog: this.maintenanceLog.slice(-50)
      };
      
      await this.homey.settings.set('homeCleaning', settings);
      this._cache.clear();
    } catch (error) {
      this.homey.error('Error saving cleaning settings:', error);
      throw error;
    }
  }

  initializeDefaultRobots() {
    if (this.robots.size === 0) {
      // Vacuum Robot
      this.robots.set('robot-vacuum-001', {
        id: 'robot-vacuum-001',
        name: 'Living Room Vacuum',
        type: 'vacuum',
        brand: 'Roborock',
        model: 'S8 Pro Ultra',
        status: 'docked', // docked, cleaning, returning, paused, error
        battery: 100,
        cleaning: {
          mode: 'balanced', // quiet, balanced, turbo, max
          suction: 50,
          activeZone: null,
          progress: 0,
          area: 0 // m²
        },
        capabilities: {
          mopping: true,
          selfEmptying: true,
          mapping: true,
          obstacleAvoidance: true,
          carpetBoost: true,
          multiFloor: true
        },
        consumables: {
          mainBrush: {
            lifespan: 300, // hours
            used: 120,
            status: 'good'
          },
          sideBrush: {
            lifespan: 200,
            used: 85,
            status: 'good'
          },
          filter: {
            lifespan: 150,
            used: 60,
            status: 'good'
          },
          mopPad: {
            lifespan: 50,
            used: 15,
            status: 'good'
          }
        },
        statistics: {
          totalCleanings: 145,
          totalArea: 2800, // m²
          totalTime: 4320 // minutes
        },
        dock: {
          status: 'ready',
          waterLevel: 80,
          dustBin: 20, // % full
          autoEmptyEnabled: true
        }
      });

      // Mop Robot
      this.robots.set('robot-mop-001', {
        id: 'robot-mop-001',
        name: 'Kitchen Mop',
        type: 'mop',
        brand: 'iRobot',
        model: 'Braava Jet m6',
        status: 'docked',
        battery: 95,
        cleaning: {
          mode: 'wet', // dry, damp, wet
          activeZone: null,
          progress: 0,
          area: 0
        },
        capabilities: {
          precisionJet: true,
          mapping: true,
          multiRoom: true
        },
        consumables: {
          cleaningPad: {
            lifespan: 30,
            used: 12,
            status: 'good'
          },
          cleaningSolution: {
            level: 60 // %
          }
        },
        statistics: {
          totalCleanings: 89,
          totalArea: 680,
          totalTime: 1780
        }
      });
    }
  }

  initializeCleaningZones() {
    if (this.zones.size === 0) {
      const defaultZones = [
        { id: 'zone-living', name: 'Living Room', area: 35, floorType: 'hardwood', carpets: false, priority: 1, cleaningFrequency: 'daily', lastCleaned: null },
        { id: 'zone-kitchen', name: 'Kitchen', area: 20, floorType: 'tile', carpets: false, priority: 1, cleaningFrequency: 'daily', lastCleaned: null },
        { id: 'zone-bedroom', name: 'Bedroom', area: 25, floorType: 'carpet', carpets: true, priority: 2, cleaningFrequency: 'twice-weekly', lastCleaned: null },
        { id: 'zone-bathroom', name: 'Bathroom', area: 8, floorType: 'tile', carpets: false, priority: 1, cleaningFrequency: 'twice-weekly', lastCleaned: null },
        { id: 'zone-hallway', name: 'Hallway', area: 12, floorType: 'hardwood', carpets: false, priority: 2, cleaningFrequency: 'twice-weekly', lastCleaned: null }
      ];
      
      defaultZones.forEach(zone => {
        zone.noGoZones = [];
        zone.virtualWalls = [];
        zone.preferredRobot = zone.floorType === 'carpet' ? 'robot-vacuum-001' : null;
        this.zones.set(zone.id, zone);
      });
    }
  }

  initializeSchedules() {
    if (this.schedules.length === 0) {
      this.schedules = [
        {
          id: 'schedule-001',
          name: 'Morning Clean',
          enabled: true,
          robotId: 'robot-vacuum-001',
          zones: ['zone-living', 'zone-kitchen'],
          time: '09:00',
          days: ['mon', 'tue', 'wed', 'thu', 'fri'],
          mode: 'balanced',
          conditions: {
            onlyWhenAway: true,
            batteryMin: 50,
            skipIfRecentlyCleaned: true
          }
        },
        {
          id: 'schedule-002',
          name: 'Deep Clean Weekend',
          enabled: true,
          robotId: 'robot-vacuum-001',
          zones: ['zone-living', 'zone-kitchen', 'zone-bedroom', 'zone-hallway'],
          time: '10:00',
          days: ['sat'],
          mode: 'turbo',
          conditions: {
            onlyWhenAway: false,
            batteryMin: 80,
            skipIfRecentlyCleaned: false
          }
        }
      ];
    }
  }

  startMonitoring() {
    // Check schedules and robot status every 2 minutes
    this.monitoringInterval = setInterval(() => {
      this.checkSchedules();
      this.monitorRobots();
      this.checkMaintenance();
    }, 120000);
  }

  async checkSchedules() {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const currentDay = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][now.getDay()];
    
    for (const schedule of this.schedules) {
      if (!schedule.enabled) continue;
      if (!schedule.days.includes(currentDay)) continue;
      if (schedule.time !== currentTime) continue;
      
      // Check conditions
      if (schedule.conditions.onlyWhenAway) {
        // Would check presence detection here
        // Skip for now
      }
      
      const robot = this.robots.get(schedule.robotId);
      if (!robot) continue;
      
      if (robot.battery < schedule.conditions.batteryMin) {
        this.homey.log(`Skipping schedule ${schedule.name}: Low battery`);
        continue;
      }
      
      // Start cleaning
      await this.startCleaning(schedule.robotId, schedule.zones, schedule.mode);
    }
  }

  async monitorRobots() {
    try {
      for (const robot of this.robots.values()) {
        // Check if robot is stuck or has error
        if (robot.status === 'error') {
          this.emit('notification', {
            title: 'Robot Error',
            message: `${robot.name} has encountered an error`,
            priority: 'high',
            category: 'cleaning-robot'
          });
        }
        
        // Check battery during cleaning
        if (robot.status === 'cleaning' && robot.battery < 20) {
          this.emit('notification', {
            title: 'Low Battery',
            message: `${robot.name} battery is low, returning to dock`,
            priority: 'medium',
            category: 'cleaning-robot'
          });
          
          await this.returnToDock(robot.id);
        }
        
        // Check dust bin if full
        if (robot.dock && robot.dock.dustBin > 90) {
          this.emit('notification', {
            title: 'Dust Bin Full',
            message: `${robot.name} dust bin needs emptying`,
            priority: 'low',
            category: 'cleaning-maintenance'
          });
        }
      }
    } catch (error) {
      this.homey.error('Error monitoring robots:', error);
    }
  }

  async checkMaintenance() {
    try {
      for (const robot of this.robots.values()) {
        for (const [part, data] of Object.entries(robot.consumables)) {
          if (!data.lifespan) continue;
          
          const remainingPercent = ((data.lifespan - data.used) / data.lifespan) * 100;
          
          if (remainingPercent <= 10) {
            data.status = 'replace-soon';
            
            this.emit('notification', {
              title: 'Maintenance Required',
              message: `${robot.name}: ${part} needs replacement soon`,
              priority: 'medium',
              category: 'cleaning-maintenance'
            });
          } else if (remainingPercent <= 25) {
            data.status = 'fair';
          }
        }
      }
      
      await this.saveSettings();
    } catch (error) {
      this.homey.error('Error checking maintenance:', error);
    }
  }

  async startCleaning(robotId, zoneIds, mode = 'balanced') {
    try {
      const robot = this.robots.get(robotId);
      if (!robot) throw new Error('Robot not found');
      
      if (robot.status !== 'docked') {
        throw new Error('Robot is not available');
      }
      
      if (robot.battery < 30) {
        throw new Error('Battery too low');
      }
      
      // Create cleaning session
      const session = {
        id: `session-${Date.now()}`,
        robotId,
        zones: zoneIds,
        mode,
        startTime: new Date().toISOString(),
        endTime: null,
        duration: 0,
        areaCleaned: 0,
        status: 'in-progress'
      };
      
      this.cleaningSessions.push(session);
      
      // Update robot status
      robot.status = 'cleaning';
      robot.cleaning.mode = mode;
      robot.cleaning.progress = 0;
      robot.cleaning.area = 0;
      
      // Update zones
      zoneIds.forEach(zoneId => {
        const zone = this.zones.get(zoneId);
        if (zone) {
          zone.lastCleaned = new Date().toISOString();
        }
      });
      
      await this.saveSettings();
      
      this.emit('notification', {
        title: 'Cleaning Started',
        message: `${robot.name} started cleaning`,
        priority: 'low',
        category: 'cleaning-robot'
      });
      
      // Simulate cleaning completion after some time
      const estimatedMinutes = zoneIds.length * 15;
      setTimeout(() => {
        this.completeCleaning(robotId, session.id);
      }, estimatedMinutes * 60000);
      
      return session;
    } catch (error) {
      this.homey.error('Error starting cleaning:', error);
      throw error;
    }
  }

  async completeCleaning(robotId, sessionId) {
    try {
      const robot = this.robots.get(robotId);
      if (!robot) return;
      
      const session = this.cleaningSessions.find(s => s.id === sessionId);
      if (!session) return;
      
      session.endTime = new Date().toISOString();
      session.duration = Math.floor((new Date(session.endTime) - new Date(session.startTime)) / 60000);
      session.status = 'completed';
      
      // Calculate area cleaned
      session.zones.forEach(zoneId => {
        const zone = this.zones.get(zoneId);
        if (zone) {
          session.areaCleaned += zone.area;
        }
      });
      
      // Update robot statistics
      robot.statistics.totalCleanings++;
      robot.statistics.totalArea += session.areaCleaned;
      robot.statistics.totalTime += session.duration;
      
      // Update consumables
      Object.values(robot.consumables).forEach(part => {
        if (part.used !== undefined && part.lifespan) {
          part.used += session.duration / 60; // Convert to hours
        }
      });
      
      // Deplete battery
      robot.battery -= Math.min(30, session.duration);
      robot.battery = Math.max(0, robot.battery);
      
      // Return to dock
      robot.status = 'returning';
      setTimeout(() => {
        robot.status = 'docked';
        robot.cleaning.activeZone = null;
        robot.cleaning.progress = 0;
      }, 300000); // 5 minutes to return
      
      await this.saveSettings();
      
      this.emit('notification', {
        title: 'Cleaning Complete',
        message: `${robot.name} finished cleaning ${session.areaCleaned}m²`,
        priority: 'low',
        category: 'cleaning-robot'
      });
    } catch (error) {
      this.homey.error('Error completing cleaning:', error);
    }
  }

  async returnToDock(robotId) {
    const robot = this.robots.get(robotId);
    if (robot) {
      robot.status = 'returning';
      
      setTimeout(() => {
        robot.status = 'docked';
      }, 120000); // 2 minutes
      
      await this.saveSettings();
    }
  }

  async replacePart(robotId, partName) {
    try {
      const robot = this.robots.get(robotId);
      if (!robot) throw new Error('Robot not found');
      
      const part = robot.consumables[partName];
      if (!part) throw new Error('Part not found');
      
      part.used = 0;
      part.status = 'good';
      
      this.maintenanceLog.push({
        id: `maintenance-${Date.now()}`,
        robotId,
        part: partName,
        action: 'replaced',
        date: new Date().toISOString()
      });
      
      await this.saveSettings();
      
      return robot;
    } catch (error) {
      this.homey.error('Error replacing part:', error);
      throw error;
    }
  }

  getRobots() {
    return Array.from(this.robots.values());
  }

  getZones() {
    return Array.from(this.zones.values());
  }

  getSchedules() {
    return this.schedules;
  }

  getCleaningSessions(limit = 50) {
    return this.cleaningSessions.slice(-limit).reverse();
  }

  getMaintenanceLog(limit = 20) {
    return this.maintenanceLog.slice(-limit).reverse();
  }

  getStats() {
    const robots = Array.from(this.robots.values());
    const sessions = this.cleaningSessions.filter(s => s.status === 'completed');
    
    return {
      totalRobots: robots.length,
      activeRobots: robots.filter(r => r.status === 'cleaning').length,
      totalSessions: sessions.length,
      totalAreaCleaned: sessions.reduce((sum, s) => sum + s.areaCleaned, 0),
      totalCleaningTime: sessions.reduce((sum, s) => sum + s.duration, 0),
      avgSessionDuration: sessions.length > 0 ?
        Math.round(sessions.reduce((sum, s) => sum + s.duration, 0) / sessions.length) : 0,
      maintenanceRequired: robots.filter(r => 
        Object.values(r.consumables).some(p => p.status === 'replace-soon')
      ).length
    };
  }

  async destroy() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    this._cache.clear();
    this.removeAllListeners();
  }
}

module.exports = HomeCleaningAutomationSystem;
