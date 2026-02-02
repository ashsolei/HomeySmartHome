'use strict';

const EventEmitter = require('events');
const Homey = require('homey');

/**
 * Home Office Productivity Hub
 * 
 * Comprehensive office automation with focus mode, meeting detection, ergonomic reminders,
 * and productivity tracking.
 * 
 * @extends EventEmitter
 */
class HomeOfficeProductivityHub extends EventEmitter {
  constructor() {
    super();
    
    this.workSessions = [];
    this.meetings = [];
    this.tasks = [];
    this.focusModes = new Map();
    this.ergonomicReminders = [];
    
    this.settings = {
      workdayStart: '09:00',
      workdayEnd: '17:00',
      focusModeDuration: 50, // minutes (Pomodoro)
      breakDuration: 10,
      ergonomicReminderInterval: 30,
      standingDeskEnabled: true,
      autoDoNotDisturb: true
    };
    
    this.officeEnvironment = {
      lightingLevel: 80,
      temperature: 21,
      deskHeight: 75, // cm
      chairPosition: 'sitting',
      monitorBrightness: 80,
      ambientNoise: 35 // dB
    };
    
    this.cache = { data: new Map(), timestamps: new Map(), ttl: 4 * 60 * 1000 };
    this.monitoring = { interval: null, checkInterval: 1 * 60 * 1000, lastCheck: null };
    
    this.initializeDefaultData();
  }
  
  initializeDefaultData() {
    this.focusModes.set('deep-work', {
      id: 'deep-work',
      name: 'Deep Work',
      description: 'Maximum focus for complex tasks',
      lighting: { level: 100, temperature: 5000 }, // K
      temperature: 21,
      doNotDisturb: true,
      notifications: false,
      musicProfile: 'focus',
      deskPosition: 'sitting'
    });
    
    this.focusModes.set('meetings', {
      id: 'meetings',
      name: 'Meeting Mode',
      description: 'Optimized for video calls',
      lighting: { level: 95, temperature: 4500, bias: true },
      temperature: 21,
      doNotDisturb: true,
      notifications: true,
      cameraLighting: 'ring-light-on',
      backgroundBlur: true,
      deskPosition: 'sitting'
    });
    
    this.focusModes.set('creative', {
      id: 'creative',
      name: 'Creative Mode',
      description: 'Inspiring environment for creativity',
      lighting: { level: 70, temperature: 3000, ambient: 'warm' },
      temperature: 22,
      doNotDisturb: false,
      notifications: true,
      musicProfile: 'ambient',
      deskPosition: 'standing'
    });
    
    this.workSessions.push({
      id: 'session-001',
      startTime: Date.now() - 2 * 60 * 60 * 1000,
      endTime: Date.now() - 10 * 60 * 1000,
      type: 'deep-work',
      duration: 110, // minutes
      breaks: 2,
      tasksCompleted: 5,
      focusScore: 85,
      interruptions: 1
    });
    
    this.meetings.push({
      id: 'meeting-001',
      title: 'Team Standup',
      startTime: '10:00',
      duration: 15,
      days: ['mon', 'tue', 'wed', 'thu', 'fri'],
      recurring: true,
      cameraRequired: true,
      prepTime: 5 // minutes before
    });
    
    this.tasks.push(
      { id: 'task-001', title: 'Complete project proposal', priority: 'high', status: 'in-progress', estimatedTime: 120 },
      { id: 'task-002', title: 'Review code PRs', priority: 'medium', status: 'pending', estimatedTime: 30 },
      { id: 'task-003', title: 'Update documentation', priority: 'low', status: 'pending', estimatedTime: 45 }
    );
  }
  
  async initialize() {
    try {
      await this.loadSettings();
      this.startMonitoring();
      
      this.emit('notification', {
        type: 'info',
        priority: 'low',
        title: 'Home Office Hub',
        message: 'Office productivity system initialized'
      });
      
      return { success: true, focusModes: this.focusModes.size };
    } catch (error) {
      this.emit('notification', {
        type: 'error',
        priority: 'high',
        title: 'Office Hub Error',
        message: `Failed to initialize: ${error.message}`
      });
      throw error;
    }
  }
  
  async startFocusMode(modeId, duration = null) {
    const mode = this.focusModes.get(modeId);
    if (!mode) throw new Error(`Focus mode ${modeId} not found`);
    
    const sessionDuration = duration || this.settings.focusModeDuration;
    
    // Apply environment settings
    this.officeEnvironment.lightingLevel = mode.lighting.level;
    this.officeEnvironment.temperature = mode.temperature;
    
    if (mode.deskPosition === 'standing' && this.settings.standingDeskEnabled) {
      await this.adjustDesk(120); // 120cm standing height
    }
    
    // Start session
    const session = {
      id: `session-${Date.now()}`,
      startTime: Date.now(),
      endTime: null,
      type: modeId,
      duration: sessionDuration,
      breaks: 0,
      tasksCompleted: 0,
      focusScore: null,
      interruptions: 0,
      status: 'active'
    };
    
    this.workSessions.unshift(session);
    if (this.workSessions.length > 100) {
      this.workSessions = this.workSessions.slice(0, 100);
    }
    
    this.emit('notification', {
      type: 'success',
      priority: 'medium',
      title: 'Focus Mode Started',
      message: `${mode.name} - ${sessionDuration} minutes`
    });
    
    // Auto-end after duration
    setTimeout(() => {
      this.endFocusMode(session.id);
    }, sessionDuration * 60 * 1000);
    
    await this.saveSettings();
    this.clearCache();
    
    return { success: true, mode: mode.name, duration: sessionDuration };
  }
  
  async endFocusMode(sessionId) {
    const session = this.workSessions.find(s => s.id === sessionId);
    if (!session) return;
    
    session.endTime = Date.now();
    session.status = 'completed';
    session.focusScore = this.calculateFocusScore(session);
    
    this.emit('notification', {
      type: 'info',
      priority: 'medium',
      title: 'Focus Session Complete',
      message: `Completed ${session.duration} minutes. Focus score: ${session.focusScore}/100`
    });
    
    // Suggest break
    if (session.breaks === 0 && session.duration >= 50) {
      this.emit('notification', {
        type: 'info',
        priority: 'low',
        title: 'Take a Break',
        message: `Consider a ${this.settings.breakDuration} minute break`
      });
    }
    
    await this.saveSettings();
    this.clearCache();
  }
  
  calculateFocusScore(session) {
    let score = 100;
    
    // Penalize interruptions
    score -= session.interruptions * 10;
    
    // Penalize if too few breaks for long session
    if (session.duration > 90 && session.breaks === 0) {
      score -= 15;
    }
    
    // Bonus for task completion
    score += session.tasksCompleted * 5;
    
    return Math.max(0, Math.min(100, score));
  }
  
  async adjustDesk(height) {
    this.officeEnvironment.deskHeight = height;
    this.officeEnvironment.chairPosition = height > 100 ? 'standing' : 'sitting';
    
    this.emit('notification', {
      type: 'info',
      priority: 'low',
      title: 'Desk Adjusted',
      message: `Desk height: ${height}cm (${this.officeEnvironment.chairPosition})`
    });
    
    await this.saveSettings();
  }
  
  async scheduleBreak(duration = null) {
    const breakDuration = duration || this.settings.breakDuration;
    
    this.emit('notification', {
      type: 'info',
      priority: 'medium',
      title: 'Break Time',
      message: `${breakDuration} minute break started. Stand up and stretch!`
    });
    
    // Dim lights slightly
    this.officeEnvironment.lightingLevel = 60;
    
    setTimeout(() => {
      this.emit('notification', {
        type: 'info',
        priority: 'medium',
        title: 'Break Over',
        message: 'Ready to get back to work?'
      });
      this.officeEnvironment.lightingLevel = 80;
    }, breakDuration * 60 * 1000);
    
    return { success: true, duration: breakDuration };
  }
  
  getProductivityStats() {
    const cached = this.getCached('productivity-stats');
    if (cached) return cached;
    
    const completedSessions = this.workSessions.filter(s => s.status === 'completed');
    const totalMinutes = completedSessions.reduce((sum, s) => sum + s.duration, 0);
    const avgFocusScore = completedSessions.length > 0
      ? Math.round(completedSessions.reduce((sum, s) => sum + s.focusScore, 0) / completedSessions.length)
      : 0;
    
    const stats = {
      sessions: {
        total: completedSessions.length,
        totalMinutes,
        totalHours: (totalMinutes / 60).toFixed(1),
        averageDuration: completedSessions.length > 0 ? Math.round(totalMinutes / completedSessions.length) : 0,
        averageFocusScore: avgFocusScore
      },
      tasks: {
        total: this.tasks.length,
        completed: this.tasks.filter(t => t.status === 'completed').length,
        inProgress: this.tasks.filter(t => t.status === 'in-progress').length,
        pending: this.tasks.filter(t => t.status === 'pending').length
      },
      meetings: {
        scheduled: this.meetings.filter(m => m.recurring).length,
        upcoming: this.getUpcomingMeetings().length
      },
      ergonomics: {
        standingTime: Math.round(totalMinutes * 0.3), // Estimate 30% standing
        breaks: completedSessions.reduce((sum, s) => sum + s.breaks, 0)
      }
    };
    
    this.setCached('productivity-stats', stats);
    return stats;
  }
  
  getUpcomingMeetings() {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const currentDay = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][now.getDay()];
    
    return this.meetings.filter(m => {
      if (!m.recurring) return false;
      if (!m.days.includes(currentDay)) return false;
      return m.startTime > currentTime;
    });
  }
  
  startMonitoring() {
    if (this.monitoring.interval) clearInterval(this.monitoring.interval);
    this.monitoring.interval = setInterval(() => this.monitorOffice(), this.monitoring.checkInterval);
  }
  
  monitorOffice() {
    this.monitoring.lastCheck = Date.now();
    
    // Check for active sessions
    const activeSession = this.workSessions.find(s => s.status === 'active');
    if (activeSession) {
      const elapsed = (Date.now() - activeSession.startTime) / (60 * 1000);
      
      // Ergonomic reminder
      if (elapsed % this.settings.ergonomicReminderInterval === 0) {
        this.emit('notification', {
          type: 'info',
          priority: 'low',
          title: 'Ergonomic Reminder',
          message: 'Time to adjust your posture or take a micro-break'
        });
      }
    }
    
    // Check upcoming meetings
    const upcomingMeetings = this.getUpcomingMeetings();
    for (const meeting of upcomingMeetings) {
      const now = new Date();
      const meetingTime = new Date();
      const [hours, minutes] = meeting.startTime.split(':');
      meetingTime.setHours(parseInt(hours), parseInt(minutes), 0);
      
      const minutesUntil = (meetingTime - now) / (60 * 1000);
      
      if (minutesUntil <= meeting.prepTime && minutesUntil > 0) {
        this.emit('notification', {
          type: 'warning',
          priority: 'high',
          title: 'Meeting Starting Soon',
          message: `${meeting.title} in ${Math.round(minutesUntil)} minutes`
        });
      }
    }
  }
  
  getCached(key) {
    const cached = this.cache.data.get(key);
    const timestamp = this.cache.timestamps.get(key);
    if (cached && timestamp && (Date.now() - timestamp < this.cache.ttl)) return cached;
    return null;
  }
  
  setCached(key, value) {
    this.cache.data.set(key, value);
    this.cache.timestamps.set(key, Date.now());
  }
  
  clearCache() {
    this.cache.data.clear();
    this.cache.timestamps.clear();
  }
  
  async loadSettings() {
    try {
      const settings = Homey.ManagerSettings.get('homeOfficeProductivityHub');
      if (settings) {
        this.workSessions = settings.workSessions || [];
        this.meetings = settings.meetings || [];
        this.tasks = settings.tasks || [];
        this.focusModes = new Map(settings.focusModes || []);
        this.ergonomicReminders = settings.ergonomicReminders || [];
        Object.assign(this.settings, settings.settings || {});
        Object.assign(this.officeEnvironment, settings.officeEnvironment || {});
      }
    } catch (error) {
      console.error('Failed to load office settings:', error);
    }
  }
  
  async saveSettings() {
    try {
      const settings = {
        workSessions: this.workSessions,
        meetings: this.meetings,
        tasks: this.tasks,
        focusModes: Array.from(this.focusModes.entries()),
        ergonomicReminders: this.ergonomicReminders,
        settings: this.settings,
        officeEnvironment: this.officeEnvironment
      };
      Homey.ManagerSettings.set('homeOfficeProductivityHub', settings);
    } catch (error) {
      console.error('Failed to save office settings:', error);
      throw error;
    }
  }
  
  getFocusModes() { return Array.from(this.focusModes.values()); }
  getWorkSessions(limit = 20) { return this.workSessions.slice(0, limit); }
  getTasks() { return this.tasks; }
  getMeetings() { return this.meetings; }
  getOfficeEnvironment() { return this.officeEnvironment; }
}

module.exports = HomeOfficeProductivityHub;
