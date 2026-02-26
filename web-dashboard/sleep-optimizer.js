'use strict';

/**
 * Sleep Optimizer
 * Tracks and optimizes sleep quality through environment control
 */
class SleepOptimizer {
  constructor(app) {
    this._intervals = [];
    this._timeouts = [];
    this.app = app;
    this.sleepSessions = [];
    this.profiles = new Map();
    this.currentSession = null;
    this.wakeupRoutines = new Map();
  }

  async initialize() {
    await this.loadProfiles();
    await this.loadWakeupRoutines();
    
    this.startMonitoring();
  }

  // ============================================
  // SLEEP PROFILES
  // ============================================

  async loadProfiles() {
    // Default profiles for family members
    const profileConfigs = [
      {
        userId: 'user_1',
        userName: 'Magnus',
        preferences: {
          bedtime: '22:30',
          wakeTime: '06:30',
          sleepDuration: 8, // hours
          temperature: {
            initial: 19,
            min: 17,
            max: 20
          },
          sound: {
            whiteNoise: true,
            volume: 20
          },
          light: {
            nightLight: true,
            brightness: 5,
            colorTemp: 2000
          }
        }
      },
      {
        userId: 'user_2',
        userName: 'Anna',
        preferences: {
          bedtime: '23:00',
          wakeTime: '07:00',
          sleepDuration: 8,
          temperature: {
            initial: 18,
            min: 16,
            max: 19
          },
          sound: {
            whiteNoise: false,
            volume: 0
          },
          light: {
            nightLight: false,
            brightness: 0
          }
        }
      },
      {
        userId: 'user_3',
        userName: 'Emma',
        preferences: {
          bedtime: '21:00',
          wakeTime: '07:00',
          sleepDuration: 10, // Children need more sleep
          temperature: {
            initial: 19,
            min: 18,
            max: 20
          },
          sound: {
            whiteNoise: true,
            volume: 15
          },
          light: {
            nightLight: true,
            brightness: 10,
            colorTemp: 2000
          }
        }
      }
    ];

    for (const config of profileConfigs) {
      this.profiles.set(config.userId, {
        ...config,
        sleepDebt: 0, // Accumulated hours of sleep deficit
        averageSleepQuality: 0,
        totalNights: 0,
        optimalBedtime: config.preferences.bedtime
      });
    }
  }

  // ============================================
  // SLEEP MONITORING
  // ============================================

  startMonitoring() {
    // Check for bedtime every 5 minutes
    this._intervals.push(setInterval(() => {
      this.checkBedtime();
    }, 5 * 60 * 1000));

    // Monitor sleep environment every minute during sleep
    this._intervals.push(setInterval(() => {
      this.monitorSleepEnvironment();
    }, 60 * 1000));

    // Update sleep quality calculations
    this._intervals.push(setInterval(() => {
      this.updateSleepQuality();
    }, 10 * 60 * 1000)); // Every 10 minutes
  }

  async checkBedtime() {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    for (const [_userId, profile] of this.profiles) {
      // Check if it's 30 minutes before bedtime
      const bedtimeParts = profile.preferences.bedtime.split(':');
      const bedtimeDate = new Date();
      bedtimeDate.setHours(parseInt(bedtimeParts[0]), parseInt(bedtimeParts[1]), 0);
      
      const reminderTime = new Date(bedtimeDate.getTime() - 30 * 60 * 1000);
      const reminderTimeStr = `${reminderTime.getHours().toString().padStart(2, '0')}:${reminderTime.getMinutes().toString().padStart(2, '0')}`;

      if (currentTime === reminderTimeStr) {
        await this.sendBedtimeReminder(profile);
      }

      // Check if it's bedtime
      if (currentTime === profile.preferences.bedtime) {
        await this.initiateBedtimeRoutine(profile);
      }

      // Check if it's wake time
      if (currentTime === profile.preferences.wakeTime) {
        await this.initiateWakeupRoutine(profile);
      }
    }
  }

  async sendBedtimeReminder(profile) {
    console.log(`🌙 Bedtime reminder för ${profile.userName} om 30 minuter`);
    
    // Send notification
    // await this.app.notifications.send({
    //   title: 'Dags att börja förbereda för sömn',
    //   message: `Din optimala läggdags är om 30 minuter (${profile.preferences.bedtime})`,
    //   userId: profile.userId
    // });
  }

  async initiateBedtimeRoutine(profile) {
    console.log(`🛏️ Starting bedtime routine for ${profile.userName}`);

    // Start sleep session
    this.currentSession = {
      userId: profile.userId,
      startTime: Date.now(),
      endTime: null,
      phases: [],
      environment: {
        temperature: [],
        sound: [],
        light: [],
        movement: []
      },
      quality: null
    };

    // Adjust bedroom environment
    await this.optimizeSleepEnvironment(profile);

    // Log phase
    this.logSleepPhase('falling_asleep');
  }

  async optimizeSleepEnvironment(profile) {
    const prefs = profile.preferences;

    // Set temperature
    console.log(`  → Setting temperature to ${prefs.temperature.initial}°C`);
    // await this.app.climate.setTemperature('bedroom', prefs.temperature.initial);

    // Set lighting
    if (prefs.light.nightLight) {
      console.log(`  → Enabling night light (${prefs.light.brightness}%)`);
      // await this.app.lights.set('bedroom_nightlight', {
      //   on: true,
      //   brightness: prefs.light.brightness,
      //   colorTemp: prefs.light.colorTemp
      // });
    } else {
      console.log(`  → Turning off all lights`);
      // await this.app.lights.setRoom('bedroom', { on: false });
    }

    // Set sound
    if (prefs.sound.whiteNoise) {
      console.log(`  → Starting white noise (${prefs.sound.volume}%)`);
      // await this.app.audio.play('white_noise', { volume: prefs.sound.volume });
    }

    // Close blinds
    console.log(`  → Closing blinds`);
    // await this.app.blinds.close('bedroom');
  }

  async monitorSleepEnvironment() {
    if (!this.currentSession) return;

    // Simulate environment readings
    const environment = {
      timestamp: Date.now(),
      temperature: 18 + Math.random() * 2, // 18-20°C
      humidity: 40 + Math.random() * 20, // 40-60%
      co2: 400 + Math.random() * 400, // 400-800 ppm
      noise: Math.random() * 30, // 0-30 dB
      light: Math.random() * 10, // 0-10 lux
      movement: Math.random() < 0.1 // 10% chance of movement
    };

    this.currentSession.environment.temperature.push(environment.temperature);
    this.currentSession.environment.sound.push(environment.noise);
    this.currentSession.environment.light.push(environment.light);
    
    if (environment.movement) {
      this.currentSession.environment.movement.push(Date.now());
    }

    // Check for issues
    await this.checkEnvironmentIssues(environment);
  }

  async checkEnvironmentIssues(environment) {
    const profile = this.profiles.get(this.currentSession.userId);
    if (!profile) return;

    const prefs = profile.preferences;

    // Temperature too high or low
    if (environment.temperature < prefs.temperature.min) {
      console.log(`⚠️ Temperature too low: ${environment.temperature.toFixed(1)}°C`);
      // await this.app.climate.adjustTemperature('bedroom', +1);
    } else if (environment.temperature > prefs.temperature.max) {
      console.log(`⚠️ Temperature too high: ${environment.temperature.toFixed(1)}°C`);
      // await this.app.climate.adjustTemperature('bedroom', -1);
    }

    // CO2 too high
    if (environment.co2 > 1000) {
      console.log(`⚠️ CO2 too high: ${environment.co2.toFixed(0)} ppm`);
      // await this.app.ventilation.increase('bedroom');
    }

    // Noise too high
    if (environment.noise > 40) {
      console.log(`⚠️ Noise detected: ${environment.noise.toFixed(0)} dB`);
    }

    // Light too bright
    if (environment.light > 20) {
      console.log(`⚠️ Light too bright: ${environment.light.toFixed(0)} lux`);
    }
  }

  logSleepPhase(phase) {
    if (!this.currentSession) return;

    this.currentSession.phases.push({
      phase, // 'falling_asleep', 'light_sleep', 'deep_sleep', 'rem', 'awake'
      startTime: Date.now(),
      duration: null
    });
  }

  async updateSleepQuality() {
    if (!this.currentSession) return;

    // Estimate current sleep phase based on time and movement
    const sleepDuration = (Date.now() - this.currentSession.startTime) / (1000 * 60); // minutes
    
    if (sleepDuration < 30) {
      // Still falling asleep
      if (this.currentSession.phases[this.currentSession.phases.length - 1]?.phase !== 'falling_asleep') {
        this.logSleepPhase('falling_asleep');
      }
    } else {
      // Sleeping - estimate phase
      const recentMovement = this.currentSession.environment.movement.filter(
        t => Date.now() - t < 10 * 60 * 1000 // Last 10 minutes
      ).length;

      let phase;
      if (recentMovement > 5) {
        phase = 'awake';
      } else if (recentMovement > 2) {
        phase = 'light_sleep';
      } else {
        // Alternate between deep sleep and REM
        const cyclePosition = (sleepDuration % 90) / 90; // 90-minute sleep cycle
        phase = cyclePosition < 0.6 ? 'deep_sleep' : 'rem';
      }

      const lastPhase = this.currentSession.phases[this.currentSession.phases.length - 1];
      if (!lastPhase || lastPhase.phase !== phase) {
        if (lastPhase) {
          lastPhase.duration = Date.now() - lastPhase.startTime;
        }
        this.logSleepPhase(phase);
      }
    }
  }

  // ============================================
  // WAKE-UP ROUTINES
  // ============================================

  async loadWakeupRoutines() {
    // Gentle wake-up routine
    this.wakeupRoutines.set('gentle', {
      id: 'gentle',
      name: 'Mjuk väckning',
      duration: 30, // minutes
      steps: [
        { time: -30, action: 'light_start', brightness: 1, colorTemp: 2000 },
        { time: -25, action: 'light_increase', brightness: 5, colorTemp: 2500 },
        { time: -20, action: 'light_increase', brightness: 10, colorTemp: 3000 },
        { time: -15, action: 'light_increase', brightness: 20, colorTemp: 3500 },
        { time: -10, action: 'light_increase', brightness: 40, colorTemp: 4000 },
        { time: -5, action: 'light_increase', brightness: 60, colorTemp: 4500 },
        { time: -5, action: 'sound_start', type: 'birds', volume: 10 },
        { time: 0, action: 'light_full', brightness: 80, colorTemp: 5000 },
        { time: 0, action: 'sound_increase', volume: 30 },
        { time: 0, action: 'blinds_open' },
        { time: 0, action: 'temperature_increase', target: 21 }
      ]
    });

    // Quick wake-up
    this.wakeupRoutines.set('quick', {
      id: 'quick',
      name: 'Snabb väckning',
      duration: 10,
      steps: [
        { time: -10, action: 'light_start', brightness: 20, colorTemp: 4000 },
        { time: -5, action: 'light_increase', brightness: 60, colorTemp: 5000 },
        { time: 0, action: 'light_full', brightness: 100, colorTemp: 6000 },
        { time: 0, action: 'sound_alarm', type: 'energetic', volume: 50 },
        { time: 0, action: 'blinds_open' }
      ]
    });
  }

  async initiateWakeupRoutine(profile) {
    console.log(`☀️ Starting wake-up routine for ${profile.userName}`);

    // End sleep session
    if (this.currentSession && this.currentSession.userId === profile.userId) {
      await this.endSleepSession();
    }

    // Get preferred routine (default to gentle)
    const routine = this.wakeupRoutines.get('gentle');

    // Execute routine steps
    for (const step of routine.steps) {
      const delay = (step.time + routine.duration) * 60 * 1000; // Convert to ms
      
      setTimeout(async () => {
        await this.executeWakeupStep(step);
      }, delay);
    }
  }

  async executeWakeupStep(step) {
    switch (step.action) {
      case 'light_start':
      case 'light_increase':
      case 'light_full':
        console.log(`  → Light: ${step.brightness}%, ${step.colorTemp}K`);
        // await this.app.lights.set('bedroom', {
        //   on: true,
        //   brightness: step.brightness,
        //   colorTemp: step.colorTemp
        // });
        break;
      
      case 'sound_start':
      case 'sound_increase':
        console.log(`  → Sound: ${step.type}, ${step.volume}%`);
        // await this.app.audio.play(step.type, { volume: step.volume });
        break;
      
      case 'sound_alarm':
        console.log(`  → Alarm: ${step.type}, ${step.volume}%`);
        // await this.app.audio.playAlarm(step.type, { volume: step.volume });
        break;
      
      case 'blinds_open':
        console.log(`  → Opening blinds`);
        // await this.app.blinds.open('bedroom');
        break;
      
      case 'temperature_increase':
        console.log(`  → Temperature: ${step.target}°C`);
        // await this.app.climate.setTemperature('bedroom', step.target);
        break;
    }
  }

  // ============================================
  // SLEEP SESSION MANAGEMENT
  // ============================================

  async endSleepSession() {
    if (!this.currentSession) return;

    this.currentSession.endTime = Date.now();

    // Calculate sleep quality
    const quality = await this.calculateSleepQuality(this.currentSession);
    this.currentSession.quality = quality;

    // Save session
    this.sleepSessions.push({ ...this.currentSession });

    // Keep last 90 days
    if (this.sleepSessions.length > 90) {
      this.sleepSessions = this.sleepSessions.slice(-90);
    }

    // Update profile statistics
    await this.updateProfileStats(this.currentSession.userId, this.currentSession);

    console.log(`Sleep session ended - Quality: ${quality.overall}%`);

    this.currentSession = null;
  }

  async calculateSleepQuality(session) {
    const duration = (session.endTime - session.startTime) / (1000 * 60 * 60); // hours

    const profile = this.profiles.get(session.userId);
    const targetDuration = profile.preferences.sleepDuration;

    // Duration score (0-100)
    const durationScore = Math.min(100, (duration / targetDuration) * 100);

    // Environment quality (0-100)
    const avgTemp = session.environment.temperature.reduce((a, b) => a + b, 0) / session.environment.temperature.length;
    const avgNoise = session.environment.sound.reduce((a, b) => a + b, 0) / session.environment.sound.length;
    const avgLight = session.environment.light.reduce((a, b) => a + b, 0) / session.environment.light.length;

    const tempScore = avgTemp >= 17 && avgTemp <= 20 ? 100 : Math.max(0, 100 - Math.abs(avgTemp - 18.5) * 20);
    const noiseScore = Math.max(0, 100 - avgNoise * 2.5); // Penalty for noise
    const lightScore = Math.max(0, 100 - avgLight * 5); // Penalty for light

    const environmentScore = (tempScore + noiseScore + lightScore) / 3;

    // Movement score (less is better)
    const movementCount = session.environment.movement.length;
    const movementScore = Math.max(0, 100 - movementCount * 5);

    // Sleep phases quality
    const deepSleepTime = session.phases
      .filter(p => p.phase === 'deep_sleep')
      .reduce((sum, p) => sum + (p.duration || 0), 0) / (1000 * 60); // minutes
    
    const remTime = session.phases
      .filter(p => p.phase === 'rem')
      .reduce((sum, p) => sum + (p.duration || 0), 0) / (1000 * 60);

    const deepSleepScore = Math.min(100, (deepSleepTime / (duration * 60 * 0.2)) * 100); // Target 20% deep sleep
    const remScore = Math.min(100, (remTime / (duration * 60 * 0.25)) * 100); // Target 25% REM

    const phaseScore = (deepSleepScore + remScore) / 2;

    // Overall quality
    const overall = Math.round(
      durationScore * 0.3 +
      environmentScore * 0.25 +
      movementScore * 0.15 +
      phaseScore * 0.3
    );

    return {
      overall,
      duration: Math.round(durationScore),
      environment: Math.round(environmentScore),
      movement: Math.round(movementScore),
      phases: Math.round(phaseScore),
      details: {
        hoursSlept: duration.toFixed(1),
        deepSleepMinutes: Math.round(deepSleepTime),
        remMinutes: Math.round(remTime),
        awakenings: movementCount,
        avgTemperature: avgTemp.toFixed(1),
        avgNoise: avgNoise.toFixed(1),
        avgLight: avgLight.toFixed(1)
      }
    };
  }

  async updateProfileStats(userId, session) {
    const profile = this.profiles.get(userId);
    if (!profile) return;

    profile.totalNights++;
    
    // Update average sleep quality
    const alpha = 0.1; // Exponential moving average factor
    profile.averageSleepQuality = 
      profile.averageSleepQuality * (1 - alpha) + 
      session.quality.overall * alpha;

    // Update sleep debt
    const duration = (session.endTime - session.startTime) / (1000 * 60 * 60);
    const target = profile.preferences.sleepDuration;
    const debt = target - duration;
    
    profile.sleepDebt += debt;
    profile.sleepDebt = Math.max(-5, Math.min(10, profile.sleepDebt)); // Cap between -5 and +10 hours

    // Adjust optimal bedtime if sleep debt is accumulating
    if (profile.sleepDebt > 2) {
      // Suggest earlier bedtime
      const currentBedtime = profile.preferences.bedtime.split(':');
      const adjustedTime = new Date();
      adjustedTime.setHours(parseInt(currentBedtime[0]), parseInt(currentBedtime[1]) - 30, 0);
      profile.optimalBedtime = `${adjustedTime.getHours().toString().padStart(2, '0')}:${adjustedTime.getMinutes().toString().padStart(2, '0')}`;
    }
  }

  // ============================================
  // ANALYTICS & REPORTING
  // ============================================

  getSleepSummary(userId, days = 7) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const sessions = this.sleepSessions.filter(
      s => s.userId === userId && s.startTime >= cutoff
    );

    if (sessions.length === 0) {
      return { error: 'No sleep data available' };
    }

    const avgQuality = sessions.reduce((sum, s) => sum + s.quality.overall, 0) / sessions.length;
    const avgDuration = sessions.reduce((sum, s) => sum + (s.endTime - s.startTime), 0) / sessions.length / (1000 * 60 * 60);
    const avgDeepSleep = sessions.reduce((sum, s) => sum + s.quality.details.deepSleepMinutes, 0) / sessions.length;
    const avgREM = sessions.reduce((sum, s) => sum + s.quality.details.remMinutes, 0) / sessions.length;
    const avgAwakenings = sessions.reduce((sum, s) => sum + s.quality.details.awakenings, 0) / sessions.length;

    const profile = this.profiles.get(userId);

    return {
      period: `${days} days`,
      nightsTracked: sessions.length,
      averageQuality: Math.round(avgQuality),
      averageDuration: avgDuration.toFixed(1),
      targetDuration: profile.preferences.sleepDuration,
      sleepDebt: profile.sleepDebt.toFixed(1),
      averageDeepSleep: Math.round(avgDeepSleep),
      averageREM: Math.round(avgREM),
      averageAwakenings: avgAwakenings.toFixed(1),
      recommendation: this.getRecommendation(profile, avgQuality, avgDuration)
    };
  }

  getRecommendation(profile, avgQuality, avgDuration) {
    const recommendations = [];

    if (avgQuality < 70) {
      recommendations.push('Din sömnkvalitet kan förbättras. Följ tips nedan.');
    }

    if (avgDuration < profile.preferences.sleepDuration - 1) {
      recommendations.push(`Du sover ${(profile.preferences.sleepDuration - avgDuration).toFixed(1)} timmar mindre än rekommenderat. Försök gå till sängs tidigare.`);
    }

    if (profile.sleepDebt > 2) {
      recommendations.push(`Du har en sömnbrist på ${profile.sleepDebt.toFixed(1)} timmar. Prioritera sömn denna vecka.`);
    }

    if (recommendations.length === 0) {
      recommendations.push('Bra jobbat! Din sömn är optimal.');
    }

    return recommendations;
  }

  getLastNight(userId) {
    const lastSession = this.sleepSessions
      .filter(s => s.userId === userId)
      .sort((a, b) => b.startTime - a.startTime)[0];

    if (!lastSession) {
      return { error: 'No recent sleep data' };
    }

    return {
      date: new Date(lastSession.startTime).toLocaleDateString('sv-SE'),
      bedtime: new Date(lastSession.startTime).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
      wakeTime: new Date(lastSession.endTime).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
      duration: ((lastSession.endTime - lastSession.startTime) / (1000 * 60 * 60)).toFixed(1),
      quality: lastSession.quality
    };
  }

  getSleepTrends(userId, days = 30) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const sessions = this.sleepSessions.filter(
      s => s.userId === userId && s.startTime >= cutoff
    );

    return sessions.map(s => ({
      date: new Date(s.startTime).toLocaleDateString('sv-SE'),
      quality: s.quality.overall,
      duration: ((s.endTime - s.startTime) / (1000 * 60 * 60)).toFixed(1),
      deepSleep: s.quality.details.deepSleepMinutes,
      rem: s.quality.details.remMinutes
    }));
  }

  getAllProfiles() {
    return Array.from(this.profiles.values()).map(p => ({
      userId: p.userId,
      userName: p.userName,
      averageQuality: Math.round(p.averageSleepQuality),
      sleepDebt: p.sleepDebt.toFixed(1),
      totalNights: p.totalNights,
      optimalBedtime: p.optimalBedtime
    }));
  }

  getSleepTips() {
    return [
      {
        category: 'Miljö',
        tips: [
          'Håll sovrummet svalt (17-19°C)',
          'Använd mörkläggningsgardiner',
          'Minimera buller med white noise',
          'Använd bekväm säng och kuddar'
        ]
      },
      {
        category: 'Rutiner',
        tips: [
          'Gå till sängs samma tid varje kväll',
          'Vakna samma tid varje morgon',
          'Undvik skärmar 1 timme före sömn',
          'Skapa en avslappnande kvällsrutin'
        ]
      },
      {
        category: 'Livsstil',
        tips: [
          'Träna regelbundet (men inte sent)',
          'Begränsa koffein efter lunch',
          'Undvik alkohol före sömn',
          'Ät inte stort kvällsmål sent'
        ]
      },
      {
        category: 'Ljus',
        tips: [
          'Få mycket dagsljus på morgonen',
          'Dimma ljus 2 timmar före sömn',
          'Använd varmt ljus (2000-2700K) på kvällen',
          'Undvik blått ljus från skärmar'
        ]
      }
    ];
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

module.exports = SleepOptimizer;
