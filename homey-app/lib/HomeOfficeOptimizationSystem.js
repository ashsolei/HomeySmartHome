const EventEmitter = require('events');

/**
 * Home Office Optimization System
 * 
 * Provides comprehensive home office management with productivity tracking,
 * environmental optimization, meeting management, and work-life balance features.
 * 
 * Features:
 * - Automated environmental adjustments (lighting, temperature, noise)
 * - Meeting room status and calendar integration
 * - Productivity tracking and focus time management
 * - Video call optimization (lighting, background, audio)
 * - Break reminders and ergonomic suggestions
 * - Do Not Disturb automation
 * - Smart lighting for video calls
 * - Background noise cancellation control
 * - Work hours tracking and analytics
 * - Integration with calendar and collaboration tools
 */
class HomeOfficeOptimizationSystem extends EventEmitter {
  constructor(homey) {
    super();
    this.homey = homey;
    this.offices = new Map();
    this.workSessions = [];
    this.meetings = [];
    this.currentStatus = 'offline';
    this.monitoringInterval = null;
  }

  async initialize() {
    this.homey.log('Initializing Home Office Optimization System...');
    
    await this.loadSettings();
    this.initializeDefaultOffices();
    
    this.startMonitoring();
    
    this.homey.log('Home Office Optimization System initialized successfully');
    return true;
  }

  async loadSettings() {
    const settings = await this.homey.settings.get('homeOfficeOptimization') || {};
    
    if (settings.offices) {
      settings.offices.forEach(office => {
        this.offices.set(office.id, office);
      });
    }
    
    this.workSessions = settings.workSessions || [];
    this.meetings = settings.meetings || [];
    this.currentStatus = settings.currentStatus || 'offline';
  }

  async saveSettings() {
    const settings = {
      offices: Array.from(this.offices.values()),
      workSessions: this.workSessions.slice(-100), // Keep last 100 sessions
      meetings: this.meetings.slice(-50), // Keep last 50 meetings
      currentStatus: this.currentStatus
    };
    
    await this.homey.settings.set('homeOfficeOptimization', settings);
  }

  initializeDefaultOffices() {
    if (this.offices.size === 0) {
      this.offices.set('main-office', {
        id: 'main-office',
        name: 'Hemkontor',
        room: 'office',
        status: 'offline', // offline, available, busy, in-meeting, focus-time, break
        environment: {
          lighting: {
            brightness: 70,
            temperature: 4000, // K
            videoCallMode: false,
            ambientLight: 500 // lux
          },
          temperature: {
            current: 21,
            target: 22,
            comfort: 'optimal'
          },
          noise: {
            level: 35, // dB
            cancellation: false,
            whiteNoise: false
          },
          airQuality: {
            co2: 450,
            quality: 'excellent'
          }
        },
        devices: {
          camera: {
            status: 'off',
            quality: '1080p',
            autoFocus: true
          },
          microphone: {
            status: 'muted',
            noiseCancellation: true
          },
          display: {
            count: 2,
            layout: 'side-by-side'
          },
          speakers: {
            volume: 50,
            mode: 'stereo'
          }
        },
        automation: {
          videoCallPrep: {
            enabled: true,
            actions: [
              'optimize-lighting',
              'adjust-camera',
              'check-background',
              'enable-dnd'
            ]
          },
          focusMode: {
            enabled: true,
            actions: [
              'dim-lights',
              'enable-dnd',
              'close-blinds',
              'white-noise'
            ],
            duration: 120 // minutes
          },
          breakReminders: {
            enabled: true,
            interval: 60, // minutes
            type: 'gentle'
          },
          endOfDay: {
            enabled: true,
            time: '17:00',
            actions: [
              'save-session',
              'turn-off-lights',
              'adjust-temperature'
            ]
          }
        },
        productivity: {
          focusTimeGoal: 240, // minutes per day
          breakInterval: 60,
          deepWorkSessions: 0,
          totalFocusTime: 0,
          distractions: 0
        },
        schedule: {
          workHours: {
            start: '08:00',
            end: '17:00',
            flexibleLunch: true
          },
          daysActive: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
        }
      });
    }
  }

  startMonitoring() {
    // Monitor office status and automation every 2 minutes
    this.monitoringInterval = setInterval(() => {
      this.checkWorkSchedule();
      this.checkBreakReminders();
      this.updateEnvironment();
    }, 120000);
  }

  async checkWorkSchedule() {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const currentDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
    
    for (const office of this.offices.values()) {
      const schedule = office.schedule;
      
      // Check if end of work day
      if (office.automation.endOfDay.enabled && 
          currentTime === office.automation.endOfDay.time &&
          schedule.daysActive.includes(currentDay)) {
        await this.endWorkDay(office.id);
      }
    }
  }

  async checkBreakReminders() {
    for (const office of this.offices.values()) {
      if (!office.automation.breakReminders.enabled) continue;
      if (office.status !== 'available' && office.status !== 'busy') continue;
      
      const currentSession = this.getCurrentWorkSession(office.id);
      if (!currentSession) continue;
      
      const elapsed = Math.floor((Date.now() - currentSession.startTime) / 60000);
      const interval = office.automation.breakReminders.interval;
      
      if (elapsed > 0 && elapsed % interval === 0) {
        await this.sendBreakReminder(office);
      }
    }
  }

  async sendBreakReminder(office) {
    this.emit('notification', {
      title: 'Dags för paus',
      message: 'Du har arbetat en stund. Ta en kort paus!',
      priority: 'normal',
      category: 'productivity'
    });
  }

  async updateEnvironment() {
    for (const office of this.offices.values()) {
      if (office.status === 'offline') continue;
      
      const env = office.environment;
      
      // Simulate environmental changes
      env.temperature.current += (Math.random() - 0.5) * 0.2;
      env.noise.level += (Math.random() - 0.5) * 5;
      env.airQuality.co2 += (Math.random() - 0.5) * 20;
      
      // Auto-adjust if needed
      if (Math.abs(env.temperature.current - env.temperature.target) > 1) {
        this.emit('setTemperature', {
          zone: office.room,
          temperature: env.temperature.target
        });
      }
      
      // Check CO2 levels
      if (env.airQuality.co2 > 800) {
        this.emit('notification', {
          title: 'Luftkvalitet',
          message: `${office.name}: Höga CO2-nivåer, öppna fönster`,
          priority: 'normal',
          category: 'environment'
        });
      }
    }
    
    await this.saveSettings();
  }

  async startWork(officeId, userId = 'default') {
    const office = this.offices.get(officeId);
    if (!office) {
      throw new Error('Kontor hittades inte');
    }
    
    office.status = 'available';
    
    const session = {
      id: `session-${Date.now()}`,
      officeId,
      userId,
      startTime: Date.now(),
      endTime: null,
      breaks: [],
      meetings: [],
      focusTime: 0,
      distractions: 0,
      productivity: 0
    };
    
    this.workSessions.push(session);
    
    // Prepare office environment
    await this.prepareOfficeEnvironment(office);
    
    await this.saveSettings();
    
    this.emit('notification', {
      title: 'Arbetsdag startad',
      message: `${office.name} är redo`,
      priority: 'low',
      category: 'work'
    });
    
    this.emit('workStarted', { office, session });
    
    return session;
  }

  async prepareOfficeEnvironment(office) {
    const env = office.environment;
    
    // Set optimal lighting
    this.emit('setLights', {
      zone: office.room,
      state: 'on',
      brightness: env.lighting.brightness,
      temperature: env.lighting.temperature
    });
    
    // Adjust temperature
    this.emit('setTemperature', {
      zone: office.room,
      temperature: env.temperature.target
    });
    
    // Open blinds for natural light (if morning/day)
    const hour = new Date().getHours();
    if (hour >= 8 && hour <= 17) {
      this.emit('openBlinds', {
        room: office.room,
        position: 70
      });
    }
  }

  async endWork(officeId) {
    const office = this.offices.get(officeId);
    if (!office) {
      throw new Error('Kontor hittades inte');
    }
    
    const session = this.getCurrentWorkSession(officeId);
    if (!session) {
      throw new Error('Ingen aktiv arbetssession');
    }
    
    session.endTime = Date.now();
    session.duration = Math.floor((session.endTime - session.startTime) / 60000);
    
    // Calculate productivity score
    session.productivity = this.calculateProductivityScore(session);
    
    office.status = 'offline';
    office.productivity.totalFocusTime += session.focusTime;
    
    await this.saveSettings();
    
    this.emit('notification', {
      title: 'Arbetsdag avslutad',
      message: `${session.duration} minuter, produktivitet: ${session.productivity}%`,
      priority: 'normal',
      category: 'work'
    });
    
    this.emit('workEnded', { office, session });
    
    return session;
  }

  async endWorkDay(officeId) {
    const office = this.offices.get(officeId);
    if (!office) return;
    
    if (office.status !== 'offline') {
      await this.endWork(officeId);
    }
    
    // Execute end of day actions
    if (office.automation.endOfDay.enabled) {
      for (const action of office.automation.endOfDay.actions) {
        switch (action) {
          case 'turn-off-lights':
            this.emit('setLights', {
              zone: office.room,
              state: 'off'
            });
            break;
          case 'adjust-temperature':
            this.emit('setTemperature', {
              zone: office.room,
              temperature: 20
            });
            break;
        }
      }
    }
  }

  getCurrentWorkSession(officeId) {
    return this.workSessions.find(s => s.officeId === officeId && !s.endTime);
  }

  calculateProductivityScore(session) {
    if (!session.duration) return 0;
    
    // Base score on focus time vs total time
    const focusRatio = session.focusTime / session.duration;
    
    // Deduct for distractions
    const distractionPenalty = Math.min(session.distractions * 5, 30);
    
    // Bonus for meetings (collaboration)
    const meetingBonus = Math.min(session.meetings.length * 5, 20);
    
    const score = Math.max(0, Math.min(100, 
      (focusRatio * 70) + meetingBonus - distractionPenalty
    ));
    
    return Math.round(score);
  }

  async startMeeting(officeId, meetingData) {
    const office = this.offices.get(officeId);
    if (!office) {
      throw new Error('Kontor hittades inte');
    }
    
    const meeting = {
      id: `meeting-${Date.now()}`,
      officeId,
      title: meetingData.title || 'Meeting',
      startTime: Date.now(),
      endTime: null,
      duration: meetingData.duration || 30,
      attendees: meetingData.attendees || 1,
      type: meetingData.type || 'video' // video, audio, in-person
    };
    
    office.status = 'in-meeting';
    this.meetings.push(meeting);
    
    // Add to current work session
    const session = this.getCurrentWorkSession(officeId);
    if (session) {
      session.meetings.push(meeting.id);
    }
    
    // Prepare for video call
    if (meeting.type === 'video' && office.automation.videoCallPrep.enabled) {
      await this.prepareForVideoCall(office);
    }
    
    // Enable Do Not Disturb
    this.emit('enableDND', { room: office.room });
    
    await this.saveSettings();
    
    this.emit('notification', {
      title: 'Möte startat',
      message: meeting.title,
      priority: 'low',
      category: 'meeting'
    });
    
    return meeting;
  }

  async prepareForVideoCall(office) {
    const actions = office.automation.videoCallPrep.actions;
    
    for (const action of actions) {
      switch (action) {
        case 'optimize-lighting':
          office.environment.lighting.videoCallMode = true;
          this.emit('setLights', {
            zone: office.room,
            brightness: 85,
            temperature: 5000, // Cooler light for video
            position: 'front' // Face lighting
          });
          break;
        
        case 'adjust-camera':
          office.devices.camera.status = 'on';
          break;
        
        case 'check-background':
          // Would trigger background blur or virtual background
          this.emit('enableVideoBackground', { type: 'blur' });
          break;
        
        case 'enable-dnd':
          this.emit('enableDND', { room: office.room });
          break;
      }
    }
    
    this.emit('notification', {
      title: 'Video call redo',
      message: 'Ljus och kamera optimerade',
      priority: 'low',
      category: 'meeting'
    });
  }

  async endMeeting(meetingId) {
    const meeting = this.meetings.find(m => m.id === meetingId && !m.endTime);
    if (!meeting) {
      throw new Error('Möte hittades inte');
    }
    
    meeting.endTime = Date.now();
    meeting.actualDuration = Math.floor((meeting.endTime - meeting.startTime) / 60000);
    
    const office = this.offices.get(meeting.officeId);
    if (office) {
      office.status = 'available';
      
      // Reset video call settings
      if (office.environment.lighting.videoCallMode) {
        office.environment.lighting.videoCallMode = false;
        this.emit('setLights', {
          zone: office.room,
          brightness: office.environment.lighting.brightness,
          temperature: office.environment.lighting.temperature
        });
      }
      
      office.devices.camera.status = 'off';
      
      // Disable Do Not Disturb
      this.emit('disableDND', { room: office.room });
    }
    
    await this.saveSettings();
    
    this.emit('notification', {
      title: 'Möte avslutat',
      message: `${meeting.title} - ${meeting.actualDuration} min`,
      priority: 'low',
      category: 'meeting'
    });
    
    return meeting;
  }

  async startFocusMode(officeId, duration = null) {
    const office = this.offices.get(officeId);
    if (!office) {
      throw new Error('Kontor hittades inte');
    }
    
    office.status = 'focus-time';
    
    const focusDuration = duration || office.automation.focusMode.duration;
    
    // Execute focus mode actions
    if (office.automation.focusMode.enabled) {
      for (const action of office.automation.focusMode.actions) {
        switch (action) {
          case 'dim-lights':
            this.emit('setLights', {
              zone: office.room,
              brightness: 60
            });
            break;
          
          case 'enable-dnd':
            this.emit('enableDND', { room: office.room, strict: true });
            break;
          
          case 'close-blinds':
            this.emit('closeBlinds', {
              room: office.room,
              position: 50
            });
            break;
          
          case 'white-noise':
            office.environment.noise.whiteNoise = true;
            this.emit('playWhiteNoise', {
              zone: office.room,
              volume: 20
            });
            break;
        }
      }
    }
    
    // Track focus time
    const session = this.getCurrentWorkSession(officeId);
    if (session) {
      const focusStartTime = Date.now();
      
      setTimeout(() => {
        const focusMinutes = Math.floor((Date.now() - focusStartTime) / 60000);
        session.focusTime += focusMinutes;
        office.productivity.deepWorkSessions++;
        office.status = 'available';
        
        this.emit('notification', {
          title: 'Fokustid avslutad',
          message: `${focusMinutes} minuter produktivt arbete`,
          priority: 'normal',
          category: 'productivity'
        });
        
        this.saveSettings();
      }, focusDuration * 60000);
    }
    
    await this.saveSettings();
    
    this.emit('notification', {
      title: 'Fokusläge aktiverat',
      message: `${focusDuration} minuter oavbruten tid`,
      priority: 'normal',
      category: 'productivity'
    });
    
    return { duration: focusDuration, office };
  }

  async takeBreak(officeId, duration = 15) {
    const office = this.offices.get(officeId);
    if (!office) {
      throw new Error('Kontor hittades inte');
    }
    
    const previousStatus = office.status;
    office.status = 'break';
    
    const breakRecord = {
      startTime: Date.now(),
      duration: duration,
      endTime: null
    };
    
    const session = this.getCurrentWorkSession(officeId);
    if (session) {
      session.breaks.push(breakRecord);
    }
    
    // Dim lights, play relaxing music
    this.emit('setLights', {
      zone: office.room,
      brightness: 40
    });
    
    this.emit('playMusic', {
      zone: office.room,
      playlist: 'Relaxation',
      volume: 20
    });
    
    // Auto-resume after break
    setTimeout(() => {
      breakRecord.endTime = Date.now();
      office.status = previousStatus;
      
      this.emit('stopMusic', { zone: office.room });
      this.emit('setLights', {
        zone: office.room,
        brightness: office.environment.lighting.brightness
      });
      
      this.saveSettings();
    }, duration * 60000);
    
    await this.saveSettings();
    
    this.emit('notification', {
      title: 'Paus',
      message: `${duration} minuters paus`,
      priority: 'low',
      category: 'break'
    });
    
    return breakRecord;
  }

  getOffices() {
    return Array.from(this.offices.values());
  }

  getOffice(officeId) {
    return this.offices.get(officeId);
  }

  getWorkSessions(officeId = null, limit = 20) {
    let sessions = this.workSessions;
    
    if (officeId) {
      sessions = sessions.filter(s => s.officeId === officeId);
    }
    
    return sessions.slice(-limit).reverse();
  }

  getMeetings(officeId = null, limit = 20) {
    let meetings = this.meetings;
    
    if (officeId) {
      meetings = meetings.filter(m => m.officeId === officeId);
    }
    
    return meetings.slice(-limit).reverse();
  }

  getStats(officeId = null) {
    let sessions = this.workSessions.filter(s => s.endTime);
    
    if (officeId) {
      sessions = sessions.filter(s => s.officeId === officeId);
    }
    
    const totalSessions = sessions.length;
    const totalMinutes = sessions.reduce((sum, s) => sum + s.duration, 0);
    const avgProductivity = sessions.length > 0 
      ? Math.round(sessions.reduce((sum, s) => sum + s.productivity, 0) / sessions.length)
      : 0;
    
    const last7Days = sessions.filter(s => 
      Date.now() - s.startTime < 7 * 24 * 60 * 60 * 1000
    );
    
    return {
      allTime: {
        sessions: totalSessions,
        totalHours: Math.round(totalMinutes / 60),
        averageProductivity: avgProductivity
      },
      last7Days: {
        sessions: last7Days.length,
        totalHours: Math.round(last7Days.reduce((sum, s) => sum + s.duration, 0) / 60),
        meetings: this.meetings.filter(m => 
          Date.now() - m.startTime < 7 * 24 * 60 * 60 * 1000
        ).length
      },
      currentStatus: this.currentStatus
    };
  }

  async destroy() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    this.removeAllListeners();
  }
}

module.exports = HomeOfficeOptimizationSystem;
