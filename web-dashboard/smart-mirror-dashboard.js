'use strict';
const logger = require('./logger');

/**
 * Smart Mirror Dashboard
 * Interactive mirror display with information widgets
 */
class SmartMirrorDashboard {
  constructor(app) {
    this._intervals = [];
    this.app = app;
    this.widgets = new Map();
    this.layouts = new Map();
    this.currentUser = null;
    this.voiceCommands = new Map();
  }

  async initialize() {
    await this.setupWidgets();
    await this.setupLayouts();
    await this.setupVoiceCommands();
    
    this.startMonitoring();
  }

  // ============================================
  // WIDGETS
  // ============================================

  async setupWidgets() {
    const widgets = [
      {
        id: 'time_date',
        type: 'time',
        position: { x: 'center', y: 'top' },
        size: 'large',
        enabled: true,
        priority: 1,
        refreshInterval: 1000
      },
      {
        id: 'weather',
        type: 'weather',
        position: { x: 'left', y: 'top' },
        size: 'medium',
        enabled: true,
        priority: 2,
        refreshInterval: 600000,  // 10 min
        data: {
          temperature: 18,
          condition: 'partly_cloudy',
          humidity: 65,
          forecast: [
            { day: 'Idag', high: 20, low: 15, icon: '🌤️' },
            { day: 'Imorgon', high: 22, low: 16, icon: '☀️' },
            { day: 'Onsdag', high: 19, low: 14, icon: '🌧️' }
          ]
        }
      },
      {
        id: 'calendar',
        type: 'calendar',
        position: { x: 'right', y: 'top' },
        size: 'medium',
        enabled: true,
        priority: 3,
        refreshInterval: 300000,  // 5 min
        data: {
          upcomingEvents: [
            { time: '09:00', title: 'Morgonmöte', duration: '1h' },
            { time: '14:00', title: 'Tandläkare - Emma', duration: '45min' },
            { time: '18:30', title: 'Middag med familjen', duration: '1h' }
          ]
        }
      },
      {
        id: 'news',
        type: 'news',
        position: { x: 'left', y: 'middle' },
        size: 'small',
        enabled: true,
        priority: 4,
        refreshInterval: 1800000,  // 30 min
        data: {
          headlines: [
            'Nytt genombrott inom förnybar energi',
            'Stockholm vinner pris för smart stad',
            'Teknologiaktier stiger kraftigt'
          ]
        }
      },
      {
        id: 'commute',
        type: 'commute',
        position: { x: 'left', y: 'bottom' },
        size: 'small',
        enabled: true,
        priority: 5,
        refreshInterval: 300000,
        data: {
          toWork: { duration: '25 min', traffic: 'normal', route: 'E4' },
          publicTransport: { nextBus: '7 min', line: '4', destination: 'Cityterminalen' }
        }
      },
      {
        id: 'fitness',
        type: 'fitness',
        position: { x: 'right', y: 'middle' },
        size: 'small',
        enabled: true,
        priority: 6,
        refreshInterval: 60000,
        data: {
          steps: 6542,
          goal: 10000,
          calories: 420,
          heartRate: 72
        }
      },
      {
        id: 'home_status',
        type: 'home',
        position: { x: 'right', y: 'bottom' },
        size: 'small',
        enabled: true,
        priority: 7,
        refreshInterval: 60000,
        data: {
          temperature: 21,
          humidity: 45,
          lights: { on: 3, total: 12 },
          security: 'armed',
          energy: { current: 2.4, today: 18.5 }
        }
      },
      {
        id: 'quotes',
        type: 'inspiration',
        position: { x: 'center', y: 'bottom' },
        size: 'small',
        enabled: true,
        priority: 8,
        refreshInterval: 3600000,  // 1 hour
        data: {
          quote: 'Varje dag är en ny möjlighet',
          author: 'Okänd'
        }
      },
      {
        id: 'tasks',
        type: 'tasks',
        position: { x: 'center', y: 'middle' },
        size: 'medium',
        enabled: false,  // Shown on demand
        priority: 9,
        refreshInterval: 300000,
        data: {
          todayTasks: [
            { title: 'Handla mat', completed: false, priority: 'high' },
            { title: 'Betala räkningar', completed: false, priority: 'high' },
            { title: 'Boka frisör', completed: false, priority: 'low' }
          ]
        }
      }
    ];

    for (const widget of widgets) {
      this.widgets.set(widget.id, widget);
    }
  }

  async showWidget(widgetId) {
    const widget = this.widgets.get(widgetId);
    
    if (!widget) {
      return { success: false, error: 'Widget not found' };
    }

    widget.enabled = true;
    logger.info(`📱 Showing widget: ${widgetId}`);

    return { success: true };
  }

  async hideWidget(widgetId) {
    const widget = this.widgets.get(widgetId);
    
    if (!widget) {
      return { success: false, error: 'Widget not found' };
    }

    widget.enabled = false;
    logger.info(`📱 Hiding widget: ${widgetId}`);

    return { success: true };
  }

  async updateWidget(widgetId, data) {
    const widget = this.widgets.get(widgetId);
    
    if (!widget) {
      return { success: false, error: 'Widget not found' };
    }

    widget.data = { ...widget.data, ...data };
    widget.lastUpdate = Date.now();

    logger.info(`🔄 Widget updated: ${widgetId}`);

    return { success: true };
  }

  // ============================================
  // LAYOUTS
  // ============================================

  async setupLayouts() {
    const layouts = [
      {
        id: 'morning',
        name: 'Morgon',
        description: 'Optimerad för morgonrutiner',
        activeWidgets: ['time_date', 'weather', 'calendar', 'commute', 'news', 'tasks'],
        brightness: 80,
        autoActivate: { days: 'weekdays', startTime: '06:00', endTime: '09:00' }
      },
      {
        id: 'evening',
        name: 'Kväll',
        description: 'Avslappnad kvällsinformation',
        activeWidgets: ['time_date', 'weather', 'calendar', 'home_status', 'quotes'],
        brightness: 50,
        autoActivate: { days: 'all', startTime: '18:00', endTime: '22:00' }
      },
      {
        id: 'workout',
        name: 'Träning',
        description: 'Fokus på fitness',
        activeWidgets: ['time_date', 'fitness', 'quotes'],
        brightness: 100,
        autoActivate: null
      },
      {
        id: 'minimal',
        name: 'Minimal',
        description: 'Bara tid och väder',
        activeWidgets: ['time_date', 'weather'],
        brightness: 60,
        autoActivate: null
      }
    ];

    for (const layout of layouts) {
      this.layouts.set(layout.id, layout);
    }
  }

  async activateLayout(layoutId) {
    const layout = this.layouts.get(layoutId);
    
    if (!layout) {
      return { success: false, error: 'Layout not found' };
    }

    // Disable all widgets
    for (const [_id, widget] of this.widgets) {
      widget.enabled = false;
    }

    // Enable widgets in layout
    for (const widgetId of layout.activeWidgets) {
      const widget = this.widgets.get(widgetId);
      if (widget) {
        widget.enabled = true;
      }
    }

    logger.info(`🎨 Layout activated: ${layout.name}`);
    logger.info(`   Active widgets: ${layout.activeWidgets.length}`);
    logger.info(`   Brightness: ${layout.brightness}%`);

    return { success: true, activeWidgets: layout.activeWidgets.length };
  }

  // ============================================
  // USER RECOGNITION
  // ============================================

  async detectUser(_faceData) {
    // Simplified face recognition (would use real facial recognition)
    const users = ['anna', 'erik', 'emma', 'oscar'];
    const detectedUser = users[Math.floor(Math.random() * users.length)];

    this.currentUser = detectedUser;

    logger.info(`👤 User detected: ${detectedUser}`);

    // Load personalized layout
    await this.loadUserPreferences(detectedUser);

    return { success: true, user: detectedUser };
  }

  async loadUserPreferences(userId) {
    const preferences = {
      anna: { layout: 'morning', widgets: ['calendar', 'commute', 'fitness'] },
      erik: { layout: 'minimal', widgets: ['news', 'commute'] },
      emma: { layout: 'evening', widgets: ['tasks', 'quotes'] },
      oscar: { layout: 'minimal', widgets: ['weather', 'quotes'] }
    };

    const userPrefs = preferences[userId];
    
    if (userPrefs) {
      await this.activateLayout(userPrefs.layout);
      
      // Enable additional user-specific widgets
      for (const widgetId of userPrefs.widgets) {
        await this.showWidget(widgetId);
      }

      logger.info(`✨ Loaded preferences for ${userId}`);
    }

    return { success: true };
  }

  // ============================================
  // VOICE COMMANDS
  // ============================================

  async setupVoiceCommands() {
    const commands = [
      {
        id: 'show_calendar',
        phrases: ['visa kalendern', 'vad har jag idag', 'dagens schema'],
        action: () => this.showWidget('calendar')
      },
      {
        id: 'show_weather',
        phrases: ['hur är vädret', 'visa vädret', 'väderprognos'],
        action: () => this.showWidget('weather')
      },
      {
        id: 'show_tasks',
        phrases: ['visa uppgifter', 'vad ska jag göra', 'dagens uppgifter'],
        action: () => this.showWidget('tasks')
      },
      {
        id: 'minimal_mode',
        phrases: ['minimalt läge', 'dölj allt', 'bara tid'],
        action: () => this.activateLayout('minimal')
      },
      {
        id: 'brightness_up',
        phrases: ['ljusare', 'öka ljusstyrka'],
        action: () => this.adjustBrightness(20)
      },
      {
        id: 'brightness_down',
        phrases: ['mörkare', 'sänk ljusstyrka'],
        action: () => this.adjustBrightness(-20)
      }
    ];

    for (const command of commands) {
      this.voiceCommands.set(command.id, command);
    }
  }

  async processVoiceCommand(input) {
    const normalized = input.toLowerCase().trim();

    for (const [id, command] of this.voiceCommands) {
      for (const phrase of command.phrases) {
        if (normalized.includes(phrase)) {
          logger.info(`🎤 Voice command: ${phrase}`);
          await command.action();
          return { success: true, command: id };
        }
      }
    }

    return { success: false, error: 'Command not recognized' };
  }

  // ============================================
  // INTERACTIONS
  // ============================================

  async handleTouch(x, y) {
    // Find widget at touch position
    for (const [id, widget] of this.widgets) {
      if (widget.enabled && this.isInBounds(x, y, widget.position)) {
        logger.info(`👆 Widget touched: ${id}`);
        
        // Widget-specific actions
        switch (widget.type) {
          case 'calendar':
            logger.info('   Opening detailed calendar view');
            break;
          case 'weather':
            logger.info('   Showing extended forecast');
            break;
          case 'tasks':
            logger.info('   Opening task details');
            break;
          case 'home':
            logger.info('   Opening home controls');
            break;
        }

        return { success: true, widget: id };
      }
    }

    return { success: false, error: 'No widget at position' };
  }

  isInBounds(_x, _y, _position) {
    // Simplified bounds checking
    return true;  // Would calculate actual bounds
  }

  async handleGesture(gesture) {
    logger.info(`✋ Gesture detected: ${gesture}`);

    switch (gesture) {
      case 'swipe_left':
        logger.info('   Switching to next layout');
        break;
      case 'swipe_right':
        logger.info('   Switching to previous layout');
        break;
      case 'swipe_up':
        logger.info('   Showing more widgets');
        break;
      case 'swipe_down':
        logger.info('   Hiding widgets');
        break;
      case 'wave':
        logger.info('   Activating mirror');
        break;
    }

    return { success: true };
  }

  async adjustBrightness(delta) {
    logger.info(`💡 Adjusting brightness: ${delta > 0 ? '+' : ''}${delta}%`);
    return { success: true };
  }

  // ============================================
  // SMART FEATURES
  // ============================================

  async activateMirrorMode(mode) {
    logger.info(`🪞 Activating mirror mode: ${mode}`);

    switch (mode) {
      case 'makeup':
        logger.info('   💄 Makeup mode: Full brightness, warm light');
        logger.info('   💡 Activating ring light');
        await this.activateLayout('minimal');
        break;

      case 'outfit':
        logger.info('   👔 Outfit mode: Full-length view');
        logger.info('   📸 Camera ready for outfit photos');
        break;

      case 'fitness':
        logger.info('   💪 Fitness mode: Showing workout stats');
        await this.activateLayout('workout');
        break;

      case 'standby':
        logger.info('   💤 Standby mode: Clock only, low brightness');
        await this.activateLayout('minimal');
        await this.adjustBrightness(-40);
        break;
    }

    return { success: true };
  }

  // ============================================
  // MONITORING
  // ============================================

  startMonitoring() {
    // Update widgets according to refresh intervals
    this._intervals.push(setInterval(() => {
      this.updateActiveWidgets();
    }, 60000));  // Check every minute

    // Auto-activate layouts based on schedule
    this._intervals.push(setInterval(() => {
      this.checkAutoActivateLayouts();
    }, 60000));

    logger.info('🪞 Smart Mirror active');
  }

  async updateActiveWidgets() {
    const now = Date.now();

    for (const [_id, widget] of this.widgets) {
      if (widget.enabled) {
        const lastUpdate = widget.lastUpdate || 0;
        
        if (now - lastUpdate >= widget.refreshInterval) {
          // Simulate data refresh
          widget.lastUpdate = now;
        }
      }
    }
  }

  async checkAutoActivateLayouts() {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const currentTime = hour * 60 + minute;
    const dayOfWeek = now.getDay();
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

    for (const [id, layout] of this.layouts) {
      if (!layout.autoActivate) continue;

      const [startHour, startMin] = layout.autoActivate.startTime.split(':').map(Number);
      const [endHour, endMin] = layout.autoActivate.endTime.split(':').map(Number);
      
      const startTime = startHour * 60 + startMin;
      const endTime = endHour * 60 + endMin;

      const isInTimeRange = currentTime >= startTime && currentTime <= endTime;
      const isDayMatch = layout.autoActivate.days === 'all' || 
                        (layout.autoActivate.days === 'weekdays' && isWeekday);

      if (isInTimeRange && isDayMatch) {
        await this.activateLayout(id);
        break;
      }
    }
  }

  // ============================================
  // REPORTING
  // ============================================

  getMirrorOverview() {
    const activeWidgets = Array.from(this.widgets.values()).filter(w => w.enabled).length;

    return {
      totalWidgets: this.widgets.size,
      activeWidgets,
      layouts: this.layouts.size,
      currentUser: this.currentUser || 'None',
      voiceCommands: this.voiceCommands.size
    };
  }

  getActiveWidgets() {
    return Array.from(this.widgets.values())
      .filter(w => w.enabled)
      .map(w => ({
        id: w.id,
        type: w.type,
        position: w.position.x + ', ' + w.position.y,
        size: w.size
      }));
  }

  getLayoutsList() {
    return Array.from(this.layouts.values()).map(l => ({
      name: l.name,
      description: l.description,
      widgets: l.activeWidgets.length,
      brightness: l.brightness + '%'
    }));
  }

  destroy() {
    if (this._intervals) {
      this._intervals.forEach(id => clearInterval(id));
      this._intervals = [];
    }
  }
}

module.exports = SmartMirrorDashboard;
