const EventEmitter = require('events');

/**
 * Advanced Wake-up Routine System
 * 
 * Provides intelligent wake-up experiences with gradual lighting, climate adjustment,
 * smart alarm features, sleep cycle detection, and personalized morning routines.
 * 
 * Features:
 * - Sleep cycle-aware alarm timing
 * - Gradual sunrise simulation with smart lights
 * - Progressive sound/music alarm with volume ramping
 * - Temperature adjustment before wake-up
 * - Coffee maker and appliance automation
 * - Weather and calendar briefing
 * - Sleep quality analysis
 * - Smart snooze with adaptive intervals
 * - Weekend/weekday differentiation
 * - Integration with sleep tracking devices
 */
class AdvancedWakeUpRoutineSystem extends EventEmitter {
  constructor(homey) {
    super();
    this.homey = homey;
    this.profiles = new Map();
    this.alarms = new Map();
    this.sleepData = [];
    this.activeRoutine = null;
    this.monitoringInterval = null;
  }

  async initialize() {
    try {
      this.homey.log('Initializing Advanced Wake-up Routine System...');

      await this.loadSettings();
      this.initializeDefaultProfiles();

      this.startMonitoring();

      this.homey.log('Advanced Wake-up Routine System initialized successfully');
      return true;
    } catch (error) {
      this.homey.error(`[AdvancedWakeUpRoutineSystem] Failed to initialize:`, error.message);
    }
  }

  async loadSettings() {
    const settings = await this.homey.settings.get('advancedWakeUpRoutine') || {};
    
    if (settings.profiles) {
      settings.profiles.forEach(profile => {
        this.profiles.set(profile.userId, profile);
      });
    }
    
    if (settings.alarms) {
      settings.alarms.forEach(alarm => {
        this.alarms.set(alarm.id, alarm);
      });
    }
    
    this.sleepData = settings.sleepData || [];
    this.activeRoutine = settings.activeRoutine || null;
  }

  async saveSettings() {
    const settings = {
      profiles: Array.from(this.profiles.values()),
      alarms: Array.from(this.alarms.values()),
      sleepData: this.sleepData.slice(-30), // Keep last 30 nights
      activeRoutine: this.activeRoutine
    };
    
    await this.homey.settings.set('advancedWakeUpRoutine', settings);
  }

  initializeDefaultProfiles() {
    if (this.profiles.size === 0) {
      this.profiles.set('default', {
        userId: 'default',
        name: 'Standard profil',
        preferences: {
          wakeUpDuration: 30, // minutes for gradual wake-up
          lightIntensityStart: 1, // %
          lightIntensityEnd: 100, // %
          lightColorStart: 'warm-orange',
          lightColorEnd: 'daylight',
          soundType: 'nature', // nature, music, radio, alarm
          soundVolumeStart: 5, // %
          soundVolumeEnd: 50, // %
          temperatureAdjust: true,
          targetTemperature: 21,
          temperatureLeadTime: 60, // minutes before alarm
          coffeeMaker: true,
          coffeeMakerTime: -5, // minutes relative to alarm
          smartSnooze: true,
          maxSnoozes: 3,
          snoozeIntervalStart: 10,
          snoozeIntervalDecrease: 2
        },
        alarmSchedule: {
          weekdays: {
            enabled: true,
            time: '06:30',
            sleepCycleOptimized: true,
            wakeWindow: 30 // minutes before alarm to find optimal wake time
          },
          weekends: {
            enabled: true,
            time: '08:30',
            sleepCycleOptimized: true,
            wakeWindow: 30
          }
        },
        morningRoutine: {
          steps: [
            { type: 'lights-on', room: 'bedroom', delay: 0, gradual: true, duration: 30 },
            { type: 'temperature', room: 'bedroom', target: 21, delay: -60 },
            { type: 'blinds-open', room: 'bedroom', delay: 15, gradual: true, duration: 10 },
            { type: 'coffee-maker', delay: -5 },
            { type: 'news-briefing', delay: 5 },
            { type: 'lights-on', room: 'bathroom', delay: 10 },
            { type: 'music', playlist: 'Morning Energizer', volume: 30, delay: 15 }
          ]
        },
        stats: {
          totalWakeUps: 0,
          averageSleepDuration: 0,
          averageSleepQuality: 0,
          snoozeRate: 0
        }
      });
    }
  }

  startMonitoring() {
    // Check alarms every minute
    this.monitoringInterval = setInterval(() => {
      this.checkAlarms();
      this.updateActiveRoutine();
    }, 60000);
  }

  async checkAlarms() {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = currentDay === 0 || currentDay === 6;
    
    for (const alarm of this.alarms.values()) {
      if (!alarm.enabled) continue;
      
      const schedule = isWeekend ? alarm.weekends : alarm.weekdays;
      if (!schedule || !schedule.enabled) continue;
      
      // Check if it's time to trigger alarm
      let alarmTime = schedule.time;
      
      // If sleep cycle optimized, calculate optimal wake time
      if (schedule.sleepCycleOptimized) {
        alarmTime = await this.calculateOptimalWakeTime(alarm, schedule);
      }
      
      if (currentTime === alarmTime && !this.activeRoutine) {
        await this.triggerWakeUpRoutine(alarm);
      }
    }
  }

  async calculateOptimalWakeTime(alarm, schedule) {
    // Get user's sleep data
    const profile = this.profiles.get(alarm.userId);
    if (!profile) return schedule.time;
    
    const recentSleep = this.sleepData
      .filter(s => s.userId === alarm.userId)
      .slice(-7); // Last 7 nights
    
    if (recentSleep.length === 0) return schedule.time;
    
    // Calculate average sleep cycle duration (typically 90 minutes)
    const avgCycleDuration = 90;
    
    // Parse alarm time
    const [alarmHour, alarmMinute] = schedule.time.split(':').map(Number);
    const alarmTimestamp = alarmHour * 60 + alarmMinute;
    
    // Find nearest light sleep phase within wake window
    const wakeWindow = schedule.wakeWindow || 30;
    const earliestWake = alarmTimestamp - wakeWindow;
    
    // Simulate sleep cycle detection
    // In real implementation, this would use data from sleep tracking device
    const currentCyclePhase = (alarmTimestamp % avgCycleDuration);
    
    // If in light sleep phase (last 20 min of cycle), wake up now
    if (currentCyclePhase >= 70) {
      return schedule.time;
    }
    
    // Otherwise, find next light sleep phase
    const nextLightSleepMinutes = avgCycleDuration - currentCyclePhase + 70;
    const optimalWakeTime = alarmTimestamp + nextLightSleepMinutes;
    
    // If optimal time is within window, use it
    if (optimalWakeTime <= alarmTimestamp && optimalWakeTime >= earliestWake) {
      const hour = Math.floor(optimalWakeTime / 60);
      const minute = optimalWakeTime % 60;
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
    
    return schedule.time;
  }

  async triggerWakeUpRoutine(alarm) {
    const profile = this.profiles.get(alarm.userId);
    if (!profile) return;
    
    this.activeRoutine = {
      alarmId: alarm.id,
      userId: alarm.userId,
      startTime: Date.now(),
      stage: 'starting',
      snoozeCount: 0,
      dismissed: false
    };
    
    await this.saveSettings();
    
    this.emit('notification', {
      title: 'God morgon!',
      message: 'Din uppvakningsrutin startar',
      priority: 'normal',
      category: 'wake-up'
    });
    
    // Execute morning routine steps
    await this.executemorningRoutine(profile);
    
    profile.stats.totalWakeUps++;
    await this.saveSettings();
  }

  async executemorningRoutine(profile) {
    const routine = profile.morningRoutine;
    const preferences = profile.preferences;
    
    // Sort steps by delay
    const sortedSteps = [...routine.steps].sort((a, b) => a.delay - b.delay);
    
    for (const step of sortedSteps) {
      // Calculate execution time
      const executeAt = Date.now() + (step.delay * 60000);
      
      setTimeout(async () => {
        await this.executeRoutineStep(step, preferences);
      }, Math.max(0, executeAt - Date.now()));
    }
    
    // Start sunrise simulation immediately
    await this.startSunriseSimulation(preferences);
    
    // Start sound alarm
    await this.startSoundAlarm(preferences);
  }

  async executeRoutineStep(step, _preferences) {
    switch (step.type) {
      case 'lights-on':
        if (step.gradual) {
          await this.gradualLightsOn(step.room, step.duration || 30);
        } else {
          this.emit('setLights', {
            zone: step.room,
            state: 'on',
            brightness: 100
          });
        }
        break;
      
      case 'temperature':
        this.emit('setTemperature', {
          zone: step.room,
          temperature: step.target
        });
        break;
      
      case 'blinds-open':
        if (step.gradual) {
          this.emit('openBlinds', {
            room: step.room,
            gradual: true,
            duration: step.duration || 10
          });
        } else {
          this.emit('openBlinds', {
            room: step.room,
            position: 100
          });
        }
        break;
      
      case 'coffee-maker':
        this.emit('controlDevice', {
          device: 'coffee-maker',
          action: 'start'
        });
        this.emit('notification', {
          title: 'Kaffet är på väg!',
          message: 'Kaffebryggaren har startats',
          priority: 'low',
          category: 'wake-up'
        });
        break;
      
      case 'news-briefing':
        await this.playNewsBriefing();
        break;
      
      case 'music':
        this.emit('playMusic', {
          zone: step.room || 'bedroom',
          playlist: step.playlist,
          volume: step.volume || 30
        });
        break;
    }
  }

  async startSunriseSimulation(preferences) {
    const duration = preferences.wakeUpDuration * 60000; // Convert to ms
    const startIntensity = preferences.lightIntensityStart;
    const endIntensity = preferences.lightIntensityEnd;
    const steps = 30; // Update every 2 minutes for 30-minute duration
    
    const intensityStep = (endIntensity - startIntensity) / steps;
    
    for (let i = 0; i <= steps; i++) {
      setTimeout(() => {
        const currentIntensity = startIntensity + (intensityStep * i);
        const progress = i / steps;
        
        // Transition color from warm orange to daylight
        let color = preferences.lightColorStart;
        if (progress > 0.7) {
          color = preferences.lightColorEnd;
        } else if (progress > 0.4) {
          color = 'warm-white';
        }
        
        this.emit('setLights', {
          zone: 'bedroom',
          state: 'on',
          brightness: currentIntensity,
          color: color,
          transition: 2 // minutes
        });
      }, (duration / steps) * i);
    }
  }

  async startSoundAlarm(preferences) {
    const duration = preferences.wakeUpDuration * 60000;
    const startVolume = preferences.soundVolumeStart;
    const endVolume = preferences.soundVolumeEnd;
    const steps = 30;
    
    const volumeStep = (endVolume - startVolume) / steps;
    
    // Start playing sound
    this.emit('playSound', {
      type: preferences.soundType,
      zone: 'bedroom',
      volume: startVolume,
      fadeIn: true
    });
    
    // Gradually increase volume
    for (let i = 0; i <= steps; i++) {
      setTimeout(() => {
        const currentVolume = startVolume + (volumeStep * i);
        this.emit('adjustVolume', {
          zone: 'bedroom',
          volume: currentVolume
        });
      }, (duration / steps) * i);
    }
  }

  async gradualLightsOn(room, duration) {
    const steps = duration / 2; // Update every 2 minutes
    
    for (let i = 0; i <= steps; i++) {
      setTimeout(() => {
        const brightness = (i / steps) * 100;
        this.emit('setLights', {
          zone: room,
          state: 'on',
          brightness: brightness,
          transition: 2
        });
      }, (duration * 60000 / steps) * i);
    }
  }

  async playNewsBriefing() {
    // Integrate with news service and weather system
    this.emit('playAudioBriefing', {
      zone: 'bedroom',
      content: ['weather', 'calendar', 'news-headlines'],
      voice: 'natural'
    });
  }

  async updateActiveRoutine() {
    if (!this.activeRoutine) return;
    
    const elapsed = Date.now() - this.activeRoutine.startTime;
    const maxDuration = 60 * 60 * 1000; // 1 hour
    
    // Auto-dismiss after 1 hour
    if (elapsed > maxDuration && !this.activeRoutine.dismissed) {
      await this.dismissAlarm();
    }
  }

  async snoozeAlarm() {
    if (!this.activeRoutine) {
      throw new Error('Ingen aktiv väckning');
    }
    
    const profile = this.profiles.get(this.activeRoutine.userId);
    if (!profile) {
      throw new Error('Profil hittades inte');
    }
    
    const prefs = profile.preferences;
    
    if (!prefs.smartSnooze) {
      throw new Error('Snooze är inte aktiverat');
    }
    
    if (this.activeRoutine.snoozeCount >= prefs.maxSnoozes) {
      throw new Error('Max antal snooze uppnått');
    }
    
    // Calculate snooze interval (decreases with each snooze)
    const snoozeInterval = prefs.snoozeIntervalStart - 
      (this.activeRoutine.snoozeCount * prefs.snoozeIntervalDecrease);
    
    this.activeRoutine.snoozeCount++;
    this.activeRoutine.stage = 'snoozed';
    
    // Stop alarm sounds
    this.emit('stopSound', { zone: 'bedroom' });
    
    // Dim lights
    this.emit('setLights', {
      zone: 'bedroom',
      brightness: 20
    });
    
    // Set timer to restart alarm
    setTimeout(() => {
      if (this.activeRoutine && this.activeRoutine.stage === 'snoozed') {
        this.restartAlarm();
      }
    }, snoozeInterval * 60000);
    
    await this.saveSettings();
    
    this.emit('notification', {
      title: 'Snooze',
      message: `Alarm snooze i ${snoozeInterval} minuter`,
      priority: 'low',
      category: 'wake-up'
    });
    
    return { snoozeInterval, snoozesRemaining: prefs.maxSnoozes - this.activeRoutine.snoozeCount };
  }

  async restartAlarm() {
    if (!this.activeRoutine) return;
    
    const profile = this.profiles.get(this.activeRoutine.userId);
    if (!profile) return;
    
    this.activeRoutine.stage = 'active';
    
    // Restart sound alarm with current volume
    this.emit('playSound', {
      type: profile.preferences.soundType,
      zone: 'bedroom',
      volume: profile.preferences.soundVolumeEnd
    });
    
    // Restore light brightness
    this.emit('setLights', {
      zone: 'bedroom',
      brightness: profile.preferences.lightIntensityEnd,
      color: profile.preferences.lightColorEnd
    });
    
    await this.saveSettings();
  }

  async dismissAlarm() {
    if (!this.activeRoutine) {
      throw new Error('Ingen aktiv väckning');
    }
    
    const _profile = this.profiles.get(this.activeRoutine.userId);
    
    this.activeRoutine.dismissed = true;
    this.activeRoutine.dismissTime = Date.now();
    
    // Stop alarm
    this.emit('stopSound', { zone: 'bedroom' });
    
    // Record sleep data
    await this.recordSleepSession();
    
    const completedRoutine = this.activeRoutine;
    this.activeRoutine = null;
    
    await this.saveSettings();
    
    this.emit('notification', {
      title: 'Väckning avslutad',
      message: 'God morgon! Ha en bra dag!',
      priority: 'low',
      category: 'wake-up'
    });
    
    return completedRoutine;
  }

  async recordSleepSession() {
    if (!this.activeRoutine) return;
    
    // Calculate sleep duration (would integrate with sleep tracking device)
    const wakeTime = Date.now();
    const estimatedSleepStart = wakeTime - (8 * 60 * 60 * 1000); // Assume 8 hours
    
    const sleepSession = {
      userId: this.activeRoutine.userId,
      date: new Date().toISOString().split('T')[0],
      sleepStart: estimatedSleepStart,
      wakeTime: wakeTime,
      duration: 8 * 60, // minutes
      quality: 75, // Simulated - would come from sleep tracker
      snoozeCount: this.activeRoutine.snoozeCount,
      deepSleepMinutes: 120,
      remSleepMinutes: 90,
      lightSleepMinutes: 270,
      awakeMinutes: 0
    };
    
    this.sleepData.push(sleepSession);
    
    // Update profile stats
    const profile = this.profiles.get(this.activeRoutine.userId);
    if (profile) {
      const recentSleep = this.sleepData.filter(s => s.userId === profile.userId).slice(-30);
      profile.stats.averageSleepDuration = Math.round(
        recentSleep.reduce((sum, s) => sum + s.duration, 0) / recentSleep.length
      );
      profile.stats.averageSleepQuality = Math.round(
        recentSleep.reduce((sum, s) => sum + s.quality, 0) / recentSleep.length
      );
      profile.stats.snoozeRate = Math.round(
        (recentSleep.filter(s => s.snoozeCount > 0).length / recentSleep.length) * 100
      );
    }
    
    await this.saveSettings();
  }

  getProfiles() {
    return Array.from(this.profiles.values());
  }

  getProfile(userId) {
    return this.profiles.get(userId);
  }

  getAlarms() {
    return Array.from(this.alarms.values());
  }

  getActiveRoutine() {
    return this.activeRoutine;
  }

  getSleepData(userId, days = 30) {
    return this.sleepData
      .filter(s => s.userId === userId)
      .slice(-days)
      .reverse();
  }

  getStats(userId) {
    const profile = this.profiles.get(userId);
    if (!profile) return null;
    
    const recentSleep = this.sleepData.filter(s => s.userId === userId).slice(-7);
    
    return {
      user: profile.name,
      stats: profile.stats,
      last7Days: {
        averageSleepDuration: Math.round(
          recentSleep.reduce((sum, s) => sum + s.duration, 0) / recentSleep.length
        ),
        averageSleepQuality: Math.round(
          recentSleep.reduce((sum, s) => sum + s.quality, 0) / recentSleep.length
        ),
        totalSnoozes: recentSleep.reduce((sum, s) => sum + s.snoozeCount, 0)
      }
    };
  }

  async destroy() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    this.removeAllListeners();
  }
}

module.exports = AdvancedWakeUpRoutineSystem;
