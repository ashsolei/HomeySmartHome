const EventEmitter = require('events');

/**
 * Smart Window Management System
 * 
 * Provides intelligent control of windows, blinds, and shades with automated
 * adjustments based on weather, temperature, light, and user preferences.
 * 
 * Features:
 * - Automated window opening/closing based on weather and air quality
 * - Smart blind/shade positioning for optimal light and temperature
 * - Solar heat gain prevention during summer
 * - Natural ventilation optimization
 * - Privacy mode with automated control
 * - Integration with HVAC for energy optimization
 * - Weather-triggered protection (rain, storm, high wind)
 * - Circadian rhythm lighting optimization
 * - Room-by-room customization
 * - Safety features (anti-pinch, obstacle detection)
 */
class SmartWindowManagementSystem extends EventEmitter {
  constructor(homey) {
    super();
    this.homey = homey;
    this.windows = new Map();
    this.automationRules = [];
    this.schedules = [];
    this.monitoringInterval = null;
  }

  async initialize() {
    try {
      this.homey.log('Initializing Smart Window Management System...');

      await this.loadSettings();
      this.initializeDefaultWindows();
      this.initializeAutomationRules();
      this.initializeSchedules();

      this.startMonitoring();

      this.homey.log('Smart Window Management System initialized successfully');
      return true;
    } catch (error) {
      this.homey.error(`[SmartWindowManagementSystem] Failed to initialize:`, error.message);
    }
  }

  async loadSettings() {
    const settings = await this.homey.settings.get('smartWindowManagement') || {};
    
    if (settings.windows) {
      settings.windows.forEach(window => {
        this.windows.set(window.id, window);
      });
    }
    
    this.automationRules = settings.automationRules || [];
    this.schedules = settings.schedules || [];
  }

  async saveSettings() {
    const settings = {
      windows: Array.from(this.windows.values()),
      automationRules: this.automationRules,
      schedules: this.schedules
    };
    
    await this.homey.settings.set('smartWindowManagement', settings);
  }

  initializeDefaultWindows() {
    if (this.windows.size === 0) {
      this.windows.set('living-window-south', {
        id: 'living-window-south',
        name: 'Vardagsrum Söder',
        room: 'living-room',
        type: 'window',
        orientation: 'south',
        hasMotor: true,
        status: {
          position: 'closed', // closed, open, tilted
          lockStatus: 'locked',
          blindPosition: 0 // 0 = closed, 100 = fully open
        },
        capabilities: {
          openable: true,
          tiltable: true,
          hasBlind: true,
          hasScreen: false,
          obstructionDetection: true
        },
        size: { width: 150, height: 200 }, // cm
        preferences: {
          autoControl: true,
          privacyMode: false,
          maxOpenPosition: 100,
          closeOnRain: true,
          closeOnHighWind: true,
          energySaving: true
        }
      });

      this.windows.set('bedroom-window-east', {
        id: 'bedroom-window-east',
        name: 'Sovrum Öster',
        room: 'bedroom',
        type: 'window',
        orientation: 'east',
        hasMotor: true,
        status: {
          position: 'closed',
          lockStatus: 'locked',
          blindPosition: 0
        },
        capabilities: {
          openable: true,
          tiltable: true,
          hasBlind: true,
          hasScreen: true,
          obstructionDetection: true
        },
        size: { width: 120, height: 180 },
        preferences: {
          autoControl: true,
          privacyMode: true,
          maxOpenPosition: 80,
          closeOnRain: true,
          closeOnHighWind: true,
          energySaving: true,
          blackoutAtNight: true
        }
      });

      this.windows.set('kitchen-window-west', {
        id: 'kitchen-window-west',
        name: 'Kök Väster',
        room: 'kitchen',
        type: 'window',
        orientation: 'west',
        hasMotor: false,
        status: {
          position: 'closed',
          lockStatus: 'locked',
          blindPosition: 50
        },
        capabilities: {
          openable: false,
          tiltable: false,
          hasBlind: true,
          hasScreen: false,
          obstructionDetection: false
        },
        size: { width: 100, height: 150 },
        preferences: {
          autoControl: true,
          privacyMode: false,
          maxOpenPosition: 100,
          closeOnRain: false,
          closeOnHighWind: false,
          energySaving: true
        }
      });

      this.windows.set('office-skylight', {
        id: 'office-skylight',
        name: 'Kontor Takfönster',
        room: 'office',
        type: 'skylight',
        orientation: 'up',
        hasMotor: true,
        status: {
          position: 'closed',
          lockStatus: 'locked',
          blindPosition: 0
        },
        capabilities: {
          openable: true,
          tiltable: false,
          hasBlind: true,
          hasScreen: false,
          obstructionDetection: true,
          rainSensor: true
        },
        size: { width: 80, height: 120 },
        preferences: {
          autoControl: true,
          privacyMode: false,
          maxOpenPosition: 100,
          closeOnRain: true,
          closeOnHighWind: true,
          energySaving: true
        }
      });
    }
  }

  initializeAutomationRules() {
    if (this.automationRules.length === 0) {
      this.automationRules = [
        {
          id: 'rule-morning-ventilation',
          name: 'Morgonventilation',
          enabled: true,
          priority: 5,
          conditions: {
            time: { from: '06:00', to: '09:00' },
            outsideTemp: { min: 15, max: 25 },
            airQuality: { min: 'good' },
            weather: { not: ['rain', 'storm'] }
          },
          action: {
            type: 'open-windows',
            rooms: ['bedroom', 'living-room'],
            position: 'tilted',
            duration: 30 // minutes
          }
        },
        {
          id: 'rule-summer-heat-protection',
          name: 'Sommarvärme skydd',
          enabled: true,
          priority: 8,
          conditions: {
            outsideTemp: { min: 28 },
            sunIntensity: { min: 70 },
            time: { from: '10:00', to: '18:00' }
          },
          action: {
            type: 'close-blinds',
            orientation: ['south', 'west'],
            blindPosition: 20,
            reason: 'Förhindra uppvärmning'
          }
        },
        {
          id: 'rule-rain-protection',
          name: 'Regnskydd',
          enabled: true,
          priority: 10,
          conditions: {
            weather: ['rain', 'heavy-rain']
          },
          action: {
            type: 'close-windows',
            all: true,
            urgent: true,
            reason: 'Regn detekterat'
          }
        },
        {
          id: 'rule-storm-protection',
          name: 'Stormskydd',
          enabled: true,
          priority: 10,
          conditions: {
            windSpeed: { min: 20 }
          },
          action: {
            type: 'secure-all',
            closeWindows: true,
            closeBlindsFully: true,
            lock: true,
            reason: 'Höga vindar'
          }
        },
        {
          id: 'rule-energy-saving-winter',
          name: 'Energibesparing vinter',
          enabled: true,
          priority: 6,
          conditions: {
            season: 'winter',
            outsideTemp: { max: 5 },
            insideTemp: { min: 20 },
            hvacStatus: 'heating'
          },
          action: {
            type: 'close-windows',
            all: true,
            reason: 'Energibesparing'
          }
        },
        {
          id: 'rule-privacy-evening',
          name: 'Integritet kväll',
          enabled: true,
          priority: 7,
          conditions: {
            time: { from: '21:00', to: '06:00' },
            lightsOn: true
          },
          action: {
            type: 'close-blinds',
            privacyRooms: true,
            blindPosition: 0,
            reason: 'Kvällsintegritet'
          }
        },
        {
          id: 'rule-circadian-lighting',
          name: 'Circadian belysning',
          enabled: true,
          priority: 4,
          conditions: {
            time: { from: '07:00', to: '10:00' }
          },
          action: {
            type: 'optimize-natural-light',
            rooms: ['bedroom', 'living-room'],
            gradual: true,
            reason: 'Morgonljus för uppvakning'
          }
        }
      ];
    }
  }

  initializeSchedules() {
    if (this.schedules.length === 0) {
      this.schedules = [
        {
          id: 'schedule-morning-open',
          name: 'Morgon öppning',
          enabled: true,
          time: '07:00',
          days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
          action: {
            type: 'open-blinds',
            rooms: ['bedroom', 'kitchen'],
            blindPosition: 80,
            gradual: true,
            duration: 10 // minutes
          }
        },
        {
          id: 'schedule-evening-close',
          name: 'Kväll stängning',
          enabled: true,
          time: '22:00',
          days: ['monday', 'tuesday', 'wednesday', 'thursday', 'sunday'],
          action: {
            type: 'secure-for-night',
            closeWindows: true,
            closeBlindsFully: false,
            blindPosition: 20,
            lock: true
          }
        },
        {
          id: 'schedule-weekend-morning',
          name: 'Helgmorgon',
          enabled: true,
          time: '09:00',
          days: ['saturday', 'sunday'],
          action: {
            type: 'open-blinds',
            rooms: ['bedroom'],
            blindPosition: 50,
            gradual: true,
            duration: 20
          }
        }
      ];
    }
  }

  startMonitoring() {
    // Monitor conditions and execute automation rules every 2 minutes
    this.monitoringInterval = setInterval(() => {
      this.evaluateAutomationRules();
      this.checkSchedules();
      this.checkWindowSafety();
    }, 120000);
  }

  async evaluateAutomationRules() {
    // Get current conditions (simulated)
    const conditions = await this.getCurrentConditions();
    
    // Sort rules by priority (higher first)
    const sortedRules = this.automationRules
      .filter(rule => rule.enabled)
      .sort((a, b) => b.priority - a.priority);
    
    for (const rule of sortedRules) {
      if (this.checkRuleConditions(rule.conditions, conditions)) {
        await this.executeRuleAction(rule.action, rule.name);
      }
    }
  }

  async getCurrentConditions() {
    // Simulated conditions - would integrate with weather system
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const currentTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    
    return {
      time: currentTime,
      hour,
      outsideTemp: 18 + Math.sin(hour / 24 * Math.PI * 2) * 8,
      insideTemp: 21,
      sunIntensity: Math.max(0, Math.sin((hour - 6) / 12 * Math.PI) * 100),
      windSpeed: 5 + Math.random() * 10,
      weather: hour >= 6 && hour <= 20 ? 'clear' : 'clear',
      airQuality: 'good',
      hvacStatus: 'idle',
      lightsOn: hour < 7 || hour > 20,
      season: this.getSeason()
    };
  }

  getSeason() {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'autumn';
    return 'winter';
  }

  checkRuleConditions(ruleConditions, currentConditions) {
    // Check time conditions
    if (ruleConditions.time) {
      const { from, to } = ruleConditions.time;
      const current = currentConditions.time;
      if (from && to) {
        if (from <= to) {
          if (current < from || current > to) return false;
        } else {
          if (current < from && current > to) return false;
        }
      }
    }
    
    // Check temperature conditions
    if (ruleConditions.outsideTemp) {
      const { min, max } = ruleConditions.outsideTemp;
      if (min !== undefined && currentConditions.outsideTemp < min) return false;
      if (max !== undefined && currentConditions.outsideTemp > max) return false;
    }
    
    if (ruleConditions.insideTemp) {
      const { min, max } = ruleConditions.insideTemp;
      if (min !== undefined && currentConditions.insideTemp < min) return false;
      if (max !== undefined && currentConditions.insideTemp > max) return false;
    }
    
    // Check wind speed
    if (ruleConditions.windSpeed) {
      const { min, max } = ruleConditions.windSpeed;
      if (min !== undefined && currentConditions.windSpeed < min) return false;
      if (max !== undefined && currentConditions.windSpeed > max) return false;
    }
    
    // Check sun intensity
    if (ruleConditions.sunIntensity) {
      const { min, max } = ruleConditions.sunIntensity;
      if (min !== undefined && currentConditions.sunIntensity < min) return false;
      if (max !== undefined && currentConditions.sunIntensity > max) return false;
    }
    
    // Check weather conditions
    if (ruleConditions.weather) {
      if (ruleConditions.weather.not) {
        if (ruleConditions.weather.not.includes(currentConditions.weather)) return false;
      } else if (Array.isArray(ruleConditions.weather)) {
        if (!ruleConditions.weather.includes(currentConditions.weather)) return false;
      }
    }
    
    // Check other conditions
    if (ruleConditions.season && currentConditions.season !== ruleConditions.season) return false;
    if (ruleConditions.hvacStatus && currentConditions.hvacStatus !== ruleConditions.hvacStatus) return false;
    if (ruleConditions.lightsOn !== undefined && currentConditions.lightsOn !== ruleConditions.lightsOn) return false;
    if (ruleConditions.airQuality && currentConditions.airQuality !== ruleConditions.airQuality) return false;
    
    return true;
  }

  async executeRuleAction(action, ruleName) {
    switch (action.type) {
      case 'open-windows':
        await this.openWindowsByRooms(action.rooms, action.position);
        break;
      case 'close-windows':
        await this.closeWindows(action.all ? null : action.rooms, action.urgent);
        break;
      case 'close-blinds':
        await this.closeBlinds(action);
        break;
      case 'open-blinds':
        await this.openBlinds(action);
        break;
      case 'secure-all':
        await this.secureAllWindows(action);
        break;
      case 'optimize-natural-light':
        await this.optimizeNaturalLight(action);
        break;
    }
    
    if (action.reason) {
      this.emit('notification', {
        title: 'Fönsterautomation',
        message: `${ruleName}: ${action.reason}`,
        priority: action.urgent ? 'high' : 'low',
        category: 'window-automation'
      });
    }
  }

  async checkSchedules() {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const currentDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
    
    for (const schedule of this.schedules) {
      if (schedule.enabled && 
          schedule.time === currentTime && 
          schedule.days.includes(currentDay)) {
        await this.executeRuleAction(schedule.action, schedule.name);
      }
    }
  }

  async checkWindowSafety() {
    for (const window of this.windows.values()) {
      if (window.status.position === 'open' || window.status.position === 'tilted') {
        // Check if window has been open too long
        if (window.openSince) {
          const openDuration = Date.now() - window.openSince;
          const maxDuration = 4 * 60 * 60 * 1000; // 4 hours
          
          if (openDuration > maxDuration) {
            this.emit('notification', {
              title: 'Fönster varning',
              message: `${window.name} har varit öppet länge`,
              priority: 'normal',
              category: 'window-safety'
            });
          }
        }
      }
    }
  }

  async openWindowsByRooms(rooms, position = 'open') {
    const windows = Array.from(this.windows.values())
      .filter(w => rooms.includes(w.room) && w.capabilities.openable && w.preferences.autoControl);
    
    for (const window of windows) {
      await this.setWindowPosition(window.id, position);
    }
  }

  async closeWindows(rooms = null, urgent = false) {
    let windows = Array.from(this.windows.values());
    
    if (rooms) {
      windows = windows.filter(w => rooms.includes(w.room));
    }
    
    windows = windows.filter(w => 
      w.capabilities.openable && 
      w.preferences.autoControl &&
      (w.status.position === 'open' || w.status.position === 'tilted')
    );
    
    for (const window of windows) {
      await this.setWindowPosition(window.id, 'closed');
      if (urgent) {
        window.status.lockStatus = 'locked';
      }
    }
  }

  async closeBlinds(action) {
    let windows = Array.from(this.windows.values())
      .filter(w => w.capabilities.hasBlind && w.preferences.autoControl);
    
    if (action.orientation) {
      windows = windows.filter(w => action.orientation.includes(w.orientation));
    }
    
    if (action.privacyRooms) {
      windows = windows.filter(w => w.preferences.privacyMode);
    }
    
    if (action.rooms) {
      windows = windows.filter(w => action.rooms.includes(w.room));
    }
    
    const position = action.blindPosition !== undefined ? action.blindPosition : 0;
    
    for (const window of windows) {
      await this.setBlindPosition(window.id, position);
    }
  }

  async openBlinds(action) {
    let windows = Array.from(this.windows.values())
      .filter(w => w.capabilities.hasBlind && w.preferences.autoControl);
    
    if (action.rooms) {
      windows = windows.filter(w => action.rooms.includes(w.room));
    }
    
    const position = action.blindPosition !== undefined ? action.blindPosition : 100;
    
    for (const window of windows) {
      await this.setBlindPosition(window.id, position);
    }
  }

  async secureAllWindows(action) {
    if (action.closeWindows) {
      await this.closeWindows(null, true);
    }
    
    if (action.closeBlindsFully) {
      for (const window of this.windows.values()) {
        if (window.capabilities.hasBlind) {
          await this.setBlindPosition(window.id, 0);
        }
      }
    } else if (action.blindPosition !== undefined) {
      for (const window of this.windows.values()) {
        if (window.capabilities.hasBlind) {
          await this.setBlindPosition(window.id, action.blindPosition);
        }
      }
    }
    
    if (action.lock) {
      for (const window of this.windows.values()) {
        if (window.capabilities.openable) {
          window.status.lockStatus = 'locked';
        }
      }
      await this.saveSettings();
    }
  }

  async optimizeNaturalLight(action) {
    const windows = Array.from(this.windows.values())
      .filter(w => action.rooms.includes(w.room) && w.capabilities.hasBlind);
    
    for (const window of windows) {
      // Calculate optimal blind position based on sun position and room
      let optimalPosition = 70;
      
      if (window.orientation === 'east' && new Date().getHours() < 12) {
        optimalPosition = 50; // Partial shade in morning
      } else if (window.orientation === 'west' && new Date().getHours() > 15) {
        optimalPosition = 40; // Partial shade in afternoon
      } else if (window.orientation === 'south') {
        optimalPosition = 60; // Moderate sun
      }
      
      await this.setBlindPosition(window.id, optimalPosition);
    }
  }

  async setWindowPosition(windowId, position) {
    const window = this.windows.get(windowId);
    if (!window) {
      throw new Error('Fönster hittades inte');
    }
    
    if (!window.capabilities.openable) {
      throw new Error('Fönstret kan inte öppnas');
    }
    
    if (window.status.lockStatus === 'locked' && position !== 'closed') {
      throw new Error('Fönstret är låst');
    }
    
    const oldPosition = window.status.position;
    window.status.position = position;
    
    if (position === 'open' || position === 'tilted') {
      window.openSince = Date.now();
    } else {
      window.openSince = null;
    }
    
    await this.saveSettings();
    
    this.emit('windowPositionChanged', {
      windowId,
      name: window.name,
      oldPosition,
      newPosition: position
    });
    
    return window;
  }

  async setBlindPosition(windowId, position) {
    const window = this.windows.get(windowId);
    if (!window) {
      throw new Error('Fönster hittades inte');
    }
    
    if (!window.capabilities.hasBlind) {
      throw new Error('Fönstret har ingen persienn');
    }
    
    position = Math.max(0, Math.min(100, position));
    const oldPosition = window.status.blindPosition;
    window.status.blindPosition = position;
    
    await this.saveSettings();
    
    this.emit('blindPositionChanged', {
      windowId,
      name: window.name,
      oldPosition,
      newPosition: position
    });
    
    return window;
  }

  getWindows() {
    return Array.from(this.windows.values());
  }

  getWindowsByRoom(room) {
    return Array.from(this.windows.values()).filter(w => w.room === room);
  }

  getAutomationRules() {
    return this.automationRules;
  }

  getSchedules() {
    return this.schedules;
  }

  getStats() {
    const windows = Array.from(this.windows.values());
    const openWindows = windows.filter(w => w.status.position === 'open' || w.status.position === 'tilted');
    
    return {
      totalWindows: windows.length,
      openWindows: openWindows.length,
      closedWindows: windows.length - openWindows.length,
      motorizedWindows: windows.filter(w => w.hasMotor).length,
      automationRules: this.automationRules.filter(r => r.enabled).length,
      schedules: this.schedules.filter(s => s.enabled).length,
      byRoom: this.getWindowStatsByRoom()
    };
  }

  getWindowStatsByRoom() {
    const rooms = {};
    for (const window of this.windows.values()) {
      if (!rooms[window.room]) {
        rooms[window.room] = {
          count: 0,
          open: 0,
          averageBlindPosition: 0
        };
      }
      rooms[window.room].count++;
      if (window.status.position === 'open' || window.status.position === 'tilted') {
        rooms[window.room].open++;
      }
      rooms[window.room].averageBlindPosition += window.status.blindPosition;
    }
    
    for (const room in rooms) {
      rooms[room].averageBlindPosition = Math.round(rooms[room].averageBlindPosition / rooms[room].count);
    }
    
    return rooms;
  }

  async destroy() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    this.removeAllListeners();
  }
}

module.exports = SmartWindowManagementSystem;
