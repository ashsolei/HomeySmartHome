'use strict';
const logger = require('./logger');

/**
 * Home Office Optimizer
 * Smart home office environment management
 */
class HomeOfficeOptimizer {
  constructor(app) {
    this._intervals = [];
    this.app = app;
    this.workModes = new Map();
    this.workSessions = [];
    this.focusPeriods = [];
    this.breakReminders = [];
    this.productivityStats = new Map();
  }

  async initialize() {
    await this.setupWorkModes();
    await this.setupProductivityTracking();
    
    this.startMonitoring();
  }

  // ============================================
  // WORK MODES
  // ============================================

  async setupWorkModes() {
    const modes = [
      {
        id: 'deep_focus',
        name: 'Djupt Fokus',
        description: 'Maximum koncentration',
        settings: {
          lighting: {
            brightness: 100,
            temperature: 5500,
            desk: true,
            ceiling: true
          },
          audio: {
            enabled: true,
            type: 'focus-music',
            volume: 25
          },
          temperature: 21,
          notifications: 'blocked',
          doNotDisturb: true,
          duration: 90  // minutes
        }
      },
      {
        id: 'collaborative',
        name: 'Samarbetsläge',
        description: 'För möten och samtal',
        settings: {
          lighting: {
            brightness: 100,
            temperature: 4500,
            desk: true,
            ceiling: true
          },
          audio: {
            enabled: false
          },
          temperature: 20,
          notifications: 'allowed',
          doNotDisturb: false,
          duration: 60
        }
      },
      {
        id: 'video_call',
        name: 'Videosamtal',
        description: 'Optimal belysning för kamera',
        settings: {
          lighting: {
            brightness: 100,
            temperature: 5000,
            desk: true,
            ceiling: true,
            fill: true  // Extra ljus för ansiktsbelysning
          },
          audio: {
            enabled: false
          },
          temperature: 20,
          notifications: 'blocked',
          doNotDisturb: true,
          backgroundBlur: true,
          duration: 45
        }
      },
      {
        id: 'creative',
        name: 'Kreativt Läge',
        description: 'För brainstorming och design',
        settings: {
          lighting: {
            brightness: 80,
            temperature: 4000,
            desk: true,
            ceiling: true,
            color: { r: 255, g: 200, b: 150 }
          },
          audio: {
            enabled: true,
            type: 'creative-music',
            volume: 35
          },
          temperature: 21,
          notifications: 'minimal',
          doNotDisturb: false,
          duration: 120
        }
      },
      {
        id: 'quick_task',
        name: 'Snabbuppgift',
        description: 'För korta arbetspass',
        settings: {
          lighting: {
            brightness: 90,
            temperature: 4500,
            desk: true,
            ceiling: false
          },
          audio: {
            enabled: false
          },
          temperature: 20,
          notifications: 'allowed',
          doNotDisturb: false,
          duration: 25  // Pomodoro
        }
      }
    ];

    for (const mode of modes) {
      this.workModes.set(mode.id, mode);
    }
  }

  async activateWorkMode(modeId) {
    const mode = this.workModes.get(modeId);
    
    if (!mode) {
      return { success: false, error: 'Mode not found' };
    }

    logger.info(`💼 Activating work mode: ${mode.name}`);

    // Apply lighting settings
    if (mode.settings.lighting.desk) {
      logger.info(`  💡 Desk lamp: ${mode.settings.lighting.brightness}% @ ${mode.settings.lighting.temperature}K`);
    }
    if (mode.settings.lighting.ceiling) {
      logger.info(`  💡 Ceiling light: ${mode.settings.lighting.brightness}% @ ${mode.settings.lighting.temperature}K`);
    }
    if (mode.settings.lighting.fill) {
      logger.info(`  💡 Fill light: ON (for video)`);
    }

    // Apply audio settings
    if (mode.settings.audio.enabled) {
      logger.info(`  🎵 Audio: ${mode.settings.audio.type} @ ${mode.settings.audio.volume}%`);
    } else {
      logger.info(`  🔇 Audio: OFF`);
    }

    // Apply climate settings
    logger.info(`  🌡️ Temperature: ${mode.settings.temperature}°C`);

    // Apply notification settings
    if (mode.settings.doNotDisturb) {
      logger.info(`  🔕 Do Not Disturb: ON`);
    } else {
      logger.info(`  🔔 Notifications: ${mode.settings.notifications}`);
    }

    // Start work session
    await this.startWorkSession(modeId);

    return { success: true, duration: mode.settings.duration };
  }

  // ============================================
  // WORK SESSIONS
  // ============================================

  async startWorkSession(modeId) {
    const mode = this.workModes.get(modeId);
    
    if (!mode) {
      return { success: false, error: 'Mode not found' };
    }

    const session = {
      id: 'session_' + Date.now(),
      mode: modeId,
      startTime: Date.now(),
      endTime: null,
      plannedDuration: mode.settings.duration * 60 * 1000,
      breaks: [],
      interruptions: 0,
      completed: false
    };

    this.workSessions.push(session);

    logger.info(`⏱️ Work session started: ${mode.name} (${mode.settings.duration} min)`);

    // Schedule break reminder
    if (mode.settings.duration > 30) {
      this.scheduleBreakReminder(session.id, mode.settings.duration);
    }

    return { success: true, sessionId: session.id };
  }

  async endWorkSession(sessionId) {
    const session = this.workSessions.find(s => s.id === sessionId);
    
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    session.endTime = Date.now();
    session.completed = true;

    const actualDuration = (session.endTime - session.startTime) / (60 * 1000);

    logger.info(`✅ Work session ended: ${actualDuration.toFixed(0)} minutes`);

    // Update productivity stats
    await this.updateProductivityStats(session);

    return { success: true, duration: actualDuration };
  }

  async takeBreak(sessionId, breakType = 'short') {
    const session = this.workSessions.find(s => s.id === sessionId);
    
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    const breakDuration = breakType === 'short' ? 5 : 15;  // minutes

    session.breaks.push({
      startTime: Date.now(),
      duration: breakDuration * 60 * 1000,
      type: breakType
    });

    logger.info(`☕ Break started: ${breakDuration} minutes`);

    // Adjust office environment for break
    logger.info('  💡 Dimming lights to 50%');
    logger.info('  🎵 Playing relaxing music');

    return { success: true, duration: breakDuration };
  }

  scheduleBreakReminder(sessionId, workDuration) {
    const reminder = {
      id: 'reminder_' + Date.now(),
      sessionId,
      triggerTime: Date.now() + workDuration * 60 * 1000,
      triggered: false
    };

    this.breakReminders.push(reminder);
  }

  // ============================================
  // FOCUS PERIODS
  // ============================================

  async startFocusPeriod(duration) {
    const focusPeriod = {
      id: 'focus_' + Date.now(),
      startTime: Date.now(),
      duration: duration * 60 * 1000,
      endTime: Date.now() + duration * 60 * 1000,
      interruptions: 0
    };

    this.focusPeriods.push(focusPeriod);

    logger.info(`🎯 Focus period started: ${duration} minutes`);
    logger.info('  🔕 Blocking all notifications');
    logger.info('  📵 Phone on silent');

    return { success: true, focusId: focusPeriod.id };
  }

  async endFocusPeriod(focusId) {
    const period = this.focusPeriods.find(f => f.id === focusId);
    
    if (!period) {
      return { success: false, error: 'Focus period not found' };
    }

    const actualDuration = (Date.now() - period.startTime) / (60 * 1000);

    logger.info(`✅ Focus period ended: ${actualDuration.toFixed(0)} minutes`);
    logger.info(`  Interruptions: ${period.interruptions}`);

    return { success: true, duration: actualDuration };
  }

  recordInterruption(focusId) {
    const period = this.focusPeriods.find(f => f.id === focusId);
    
    if (period) {
      period.interruptions++;
      logger.info(`⚠️ Interruption recorded (total: ${period.interruptions})`);
    }
  }

  // ============================================
  // PRODUCTIVITY TRACKING
  // ============================================

  async setupProductivityTracking() {
    const stats = {
      totalWorkTime: 0,
      focusTime: 0,
      collaborativeTime: 0,
      meetings: 0,
      breaks: 0,
      averageSessionLength: 0,
      averageInterruptions: 0,
      mostProductiveHours: []
    };

    this.productivityStats.set('overall', stats);
  }

  async updateProductivityStats(session) {
    const stats = this.productivityStats.get('overall');
    const mode = this.workModes.get(session.mode);

    const duration = (session.endTime - session.startTime) / (60 * 1000);

    stats.totalWorkTime += duration;

    if (mode.id === 'deep_focus') {
      stats.focusTime += duration;
    } else if (mode.id === 'collaborative' || mode.id === 'video_call') {
      stats.collaborativeTime += duration;
      if (mode.id === 'video_call') {
        stats.meetings++;
      }
    }

    stats.breaks += session.breaks.length;
    stats.averageInterruptions = (stats.averageInterruptions + session.interruptions) / 2;

    // Track productive hours
    const hour = new Date(session.startTime).getHours();
    const hourEntry = stats.mostProductiveHours.find(h => h.hour === hour);
    
    if (hourEntry) {
      hourEntry.sessions++;
      hourEntry.totalTime += duration;
    } else {
      stats.mostProductiveHours.push({
        hour,
        sessions: 1,
        totalTime: duration
      });
    }
  }

  getProductivitySummary(days = 7) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const recentSessions = this.workSessions.filter(s => s.startTime >= cutoff && s.completed);

    if (recentSessions.length === 0) {
      return { success: false, error: 'No data' };
    }

    const totalTime = recentSessions.reduce((sum, s) => {
      return sum + (s.endTime - s.startTime) / (60 * 1000);
    }, 0);

    const focusSessions = recentSessions.filter(s => s.mode === 'deep_focus');
    const focusTime = focusSessions.reduce((sum, s) => {
      return sum + (s.endTime - s.startTime) / (60 * 1000);
    }, 0);

    const totalBreaks = recentSessions.reduce((sum, s) => sum + s.breaks.length, 0);

    return {
      days,
      totalSessions: recentSessions.length,
      totalTime: totalTime.toFixed(0) + ' min',
      avgSessionLength: (totalTime / recentSessions.length).toFixed(0) + ' min',
      focusTime: focusTime.toFixed(0) + ' min',
      focusPercentage: ((focusTime / totalTime) * 100).toFixed(0) + '%',
      totalBreaks,
      avgBreaksPerSession: (totalBreaks / recentSessions.length).toFixed(1)
    };
  }

  getMostProductiveHours() {
    const stats = this.productivityStats.get('overall');
    
    return stats.mostProductiveHours
      .sort((a, b) => b.totalTime - a.totalTime)
      .slice(0, 5)
      .map(h => ({
        hour: h.hour + ':00',
        sessions: h.sessions,
        totalTime: h.totalTime.toFixed(0) + ' min'
      }));
  }

  // ============================================
  // ENVIRONMENTAL ADJUSTMENTS
  // ============================================

  async optimizeForVideoCall() {
    logger.info('🎥 Optimizing for video call...');
    
    logger.info('  💡 Setting key light: 100% @ 5000K');
    logger.info('  💡 Setting fill light: 60% @ 4500K');
    logger.info('  💡 Setting back light: 40%');
    logger.info('  🌡️ Temperature: 20°C (prevent overheating)');
    logger.info('  🔕 Do Not Disturb: ON');
    logger.info('  🔇 Muting other audio sources');

    return { success: true };
  }

  async optimizeForFocus() {
    logger.info('🎯 Optimizing for focus...');
    
    logger.info('  💡 Bright white light: 100% @ 5500K');
    logger.info('  🌡️ Temperature: 21°C (alertness)');
    logger.info('  🎵 Focus music: 25%');
    logger.info('  🔕 Blocking notifications');
    logger.info('  📵 Phone silent mode');

    return { success: true };
  }

  async optimizeForCreativity() {
    logger.info('🎨 Optimizing for creativity...');
    
    logger.info('  💡 Warm light: 80% @ 4000K');
    logger.info('  🌡️ Temperature: 21°C');
    logger.info('  🎵 Ambient music: 35%');
    logger.info('  🪟 Natural light preferred');

    return { success: true };
  }

  // ============================================
  // POSTURE & HEALTH
  // ============================================

  async startPostureMonitoring() {
    logger.info('🪑 Posture monitoring: ENABLED');
    
    // In real implementation, would connect to posture sensor
    // For now, just remind periodically
    this._intervals.push(setInterval(() => {
      logger.info('💺 Posture reminder: Sit up straight!');
    }, 30 * 60 * 1000));  // Every 30 minutes

    return { success: true };
  }

  async remindToStand() {
    logger.info('🚶 Stand up reminder: Time to stretch!');
    logger.info('  Target: 5 minutes of standing/walking');
    
    return { success: true };
  }

  // ============================================
  // MONITORING
  // ============================================

  startMonitoring() {
    // Check break reminders
    this._intervals.push(setInterval(() => {
      this.checkBreakReminders();
    }, 60000));  // Every minute

    // Remind to stand every 60 minutes
    this._intervals.push(setInterval(() => {
      this.remindToStand();
    }, 60 * 60 * 1000));

    logger.info('💼 Home Office Optimizer active');
  }

  async checkBreakReminders() {
    const now = Date.now();

    for (const reminder of this.breakReminders) {
      if (!reminder.triggered && reminder.triggerTime <= now) {
        reminder.triggered = true;

        const session = this.workSessions.find(s => s.id === reminder.sessionId);
        
        if (session && !session.completed) {
          logger.info('⏰ Break reminder: Time for a break!');
          logger.info('  Recommendation: 5-15 minute break');
        }
      }
    }
  }

  // ============================================
  // REPORTING
  // ============================================

  getOfficeOptimizerOverview() {
    const activeSessions = this.workSessions.filter(s => !s.completed).length;

    return {
      workModes: this.workModes.size,
      totalSessions: this.workSessions.length,
      activeSessions,
      focusPeriods: this.focusPeriods.length,
      totalBreaks: this.workSessions.reduce((sum, s) => sum + s.breaks.length, 0)
    };
  }

  getWorkModesList() {
    return Array.from(this.workModes.values()).map(m => ({
      name: m.name,
      description: m.description,
      duration: m.settings.duration + ' min',
      doNotDisturb: m.settings.doNotDisturb ? 'Yes' : 'No'
    }));
  }

  getRecentSessions(limit = 10) {
    return this.workSessions
      .filter(s => s.completed)
      .slice(-limit)
      .map(s => {
        const mode = this.workModes.get(s.mode);
        const duration = ((s.endTime - s.startTime) / (60 * 1000)).toFixed(0);
        
        return {
          mode: mode?.name || s.mode,
          date: new Date(s.startTime).toLocaleDateString('sv-SE'),
          duration: duration + ' min',
          breaks: s.breaks.length,
          interruptions: s.interruptions
        };
      });
  }

  getCurrentSession() {
    const current = this.workSessions.find(s => !s.completed);
    
    if (!current) {
      return null;
    }

    const mode = this.workModes.get(current.mode);
    const elapsed = ((Date.now() - current.startTime) / (60 * 1000)).toFixed(0);
    const remaining = ((current.plannedDuration - (Date.now() - current.startTime)) / (60 * 1000)).toFixed(0);

    return {
      mode: mode?.name || current.mode,
      elapsed: elapsed + ' min',
      remaining: remaining + ' min',
      breaks: current.breaks.length
    };
  }

  destroy() {
    if (this._intervals) {
      this._intervals.forEach(id => clearInterval(id));
      this._intervals = [];
    }
  }
}

module.exports = HomeOfficeOptimizer;
