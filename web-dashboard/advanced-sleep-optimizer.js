'use strict';

/**
 * Advanced Sleep Optimizer
 * Intelligent sleep tracking and optimization
 */
class AdvancedSleepOptimizer {
  constructor(app) {
    this._intervals = [];
    this.app = app;
    this.sleepProfiles = new Map();
    this.sleepSessions = [];
    this.smartAlarms = new Map();
    this.sleepEnvironment = new Map();
  }

  async initialize() {
    await this.setupSleepProfiles();
    await this.setupSleepEnvironment();
    await this.setupSmartAlarms();
    
    this.startMonitoring();
  }

  // ============================================
  // SLEEP PROFILES
  // ============================================

  async setupSleepProfiles() {
    const profiles = [
      {
        id: 'anna',
        name: 'Anna',
        age: 42,
        targetSleepHours: 7.5,
        targetBedtime: '22:30',
        targetWakeTime: '06:00',
        sleepStyle: 'light',  // light, medium, deep
        preferences: {
          temperature: 19,
          humidity: 55,
          darkness: 'complete',
          noise: 'white-noise',
          wakeupLight: true
        },
        circadianType: 'intermediate',  // early-bird, intermediate, night-owl
        sleepQuality: 0.78,
        avgSleepDuration: 7.2,
        avgDeepSleep: 1.8,
        avgREMSleep: 1.5
      },
      {
        id: 'erik',
        name: 'Erik',
        age: 45,
        targetSleepHours: 7,
        targetBedtime: '23:00',
        targetWakeTime: '06:00',
        sleepStyle: 'medium',
        preferences: {
          temperature: 18,
          humidity: 50,
          darkness: 'complete',
          noise: 'silent',
          wakeupLight: false
        },
        circadianType: 'night-owl',
        sleepQuality: 0.72,
        avgSleepDuration: 6.8,
        avgDeepSleep: 1.6,
        avgREMSleep: 1.4
      },
      {
        id: 'emma',
        name: 'Emma',
        age: 12,
        targetSleepHours: 9,
        targetBedtime: '21:00',
        targetWakeTime: '06:30',
        sleepStyle: 'deep',
        preferences: {
          temperature: 20,
          humidity: 55,
          darkness: 'partial',
          noise: 'soft-music',
          wakeupLight: true
        },
        circadianType: 'early-bird',
        sleepQuality: 0.88,
        avgSleepDuration: 9.2,
        avgDeepSleep: 2.8,
        avgREMSleep: 2.0
      },
      {
        id: 'oscar',
        name: 'Oscar',
        age: 8,
        targetSleepHours: 10,
        targetBedtime: '20:00',
        targetWakeTime: '06:30',
        sleepStyle: 'deep',
        preferences: {
          temperature: 20,
          humidity: 55,
          darkness: 'partial',
          noise: 'soft-music',
          wakeupLight: true
        },
        circadianType: 'early-bird',
        sleepQuality: 0.90,
        avgSleepDuration: 10.1,
        avgDeepSleep: 3.2,
        avgREMSleep: 2.2
      }
    ];

    for (const profile of profiles) {
      this.sleepProfiles.set(profile.id, profile);
    }
  }

  // ============================================
  // SLEEP TRACKING
  // ============================================

  async trackSleep(userId, bedtime, wakeTime, quality) {
    const profile = this.sleepProfiles.get(userId);
    
    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }

    const duration = (wakeTime - bedtime) / (60 * 60 * 1000);

    // Estimate sleep stages (simplified)
    const deepSleep = duration * 0.25;  // ~25% deep sleep
    const remSleep = duration * 0.20;   // ~20% REM
    const lightSleep = duration * 0.50; // ~50% light sleep
    const awake = duration * 0.05;      // ~5% awake

    const session = {
      userId,
      bedtime,
      wakeTime,
      duration,
      quality,
      stages: {
        deep: deepSleep,
        rem: remSleep,
        light: lightSleep,
        awake: awake
      },
      environment: {
        temperature: this.sleepEnvironment.get(userId)?.temperature || 19,
        humidity: this.sleepEnvironment.get(userId)?.humidity || 55,
        noise: this.sleepEnvironment.get(userId)?.noise || 'silent'
      },
      interruptions: Math.floor(Math.random() * 3),
      restfulness: quality * 100,
      timestamp: bedtime
    };

    this.sleepSessions.push(session);

    // Update profile averages
    this.updateSleepAverages(userId);

    console.log(`😴 Sleep tracked for ${profile.name}: ${duration.toFixed(1)}h (quality: ${(quality * 100).toFixed(0)}%)`);

    return { success: true, session };
  }

  updateSleepAverages(userId) {
    const profile = this.sleepProfiles.get(userId);
    const recentSessions = this.sleepSessions
      .filter(s => s.userId === userId)
      .slice(-30);  // Last 30 nights

    if (recentSessions.length === 0) return;

    profile.avgSleepDuration = recentSessions.reduce((sum, s) => sum + s.duration, 0) / recentSessions.length;
    profile.avgDeepSleep = recentSessions.reduce((sum, s) => sum + s.stages.deep, 0) / recentSessions.length;
    profile.avgREMSleep = recentSessions.reduce((sum, s) => sum + s.stages.rem, 0) / recentSessions.length;
    profile.sleepQuality = recentSessions.reduce((sum, s) => sum + s.quality, 0) / recentSessions.length;
  }

  async getSleepAnalysis(userId, days = 7) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const sessions = this.sleepSessions.filter(s => s.userId === userId && s.timestamp >= cutoff);

    if (sessions.length === 0) {
      return { success: false, error: 'No sleep data' };
    }

    const analysis = {
      totalNights: sessions.length,
      avgDuration: sessions.reduce((sum, s) => sum + s.duration, 0) / sessions.length,
      avgQuality: sessions.reduce((sum, s) => sum + s.quality, 0) / sessions.length,
      avgDeepSleep: sessions.reduce((sum, s) => sum + s.stages.deep, 0) / sessions.length,
      avgREMSleep: sessions.reduce((sum, s) => sum + s.stages.rem, 0) / sessions.length,
      avgInterruptions: sessions.reduce((sum, s) => sum + s.interruptions, 0) / sessions.length,
      sleepDebt: 0
    };

    const profile = this.sleepProfiles.get(userId);
    if (profile) {
      analysis.sleepDebt = (profile.targetSleepHours - analysis.avgDuration) * sessions.length;
    }

    return analysis;
  }

  // ============================================
  // SMART ALARMS
  // ============================================

  async setupSmartAlarms() {
    const alarms = [
      {
        id: 'alarm_anna',
        userId: 'anna',
        targetTime: '06:00',
        enabled: true,
        smartWake: true,
        wakeWindow: 30,  // minutes
        wakeupRoutine: 'gradual_light'
      },
      {
        id: 'alarm_erik',
        userId: 'erik',
        targetTime: '06:00',
        enabled: true,
        smartWake: true,
        wakeWindow: 20,
        wakeupRoutine: 'sound_only'
      },
      {
        id: 'alarm_emma',
        userId: 'emma',
        targetTime: '06:30',
        enabled: true,
        smartWake: true,
        wakeWindow: 30,
        wakeupRoutine: 'gradual_light_music'
      },
      {
        id: 'alarm_oscar',
        userId: 'oscar',
        targetTime: '06:30',
        enabled: true,
        smartWake: true,
        wakeWindow: 30,
        wakeupRoutine: 'gradual_light_music'
      }
    ];

    for (const alarm of alarms) {
      this.smartAlarms.set(alarm.id, alarm);
    }
  }

  async calculateOptimalWakeTime(userId) {
    const alarm = Array.from(this.smartAlarms.values()).find(a => a.userId === userId);
    
    if (!alarm || !alarm.smartWake) {
      return null;
    }

    // Simulate sleep cycle detection
    // In real implementation, this would use actual sleep tracking data
    const targetTime = this.parseTime(alarm.targetTime);
    const wakeWindow = alarm.wakeWindow * 60 * 1000;

    // Find optimal wake time within window (end of light sleep cycle)
    const sleepCycleDuration = 90; // minutes
    const currentCycle = Math.floor(Math.random() * sleepCycleDuration);
    
    let optimalWakeTime;
    
    if (currentCycle > 70) {
      // In light sleep, wake up now (within 20 min of end of cycle)
      optimalWakeTime = Date.now() + (sleepCycleDuration - currentCycle) * 60 * 1000;
    } else {
      // Wait for next light sleep phase
      optimalWakeTime = Date.now() + (sleepCycleDuration - currentCycle + 70) * 60 * 1000;
    }

    // Ensure within wake window
    if (optimalWakeTime > targetTime) {
      optimalWakeTime = targetTime;
    } else if (optimalWakeTime < targetTime - wakeWindow) {
      optimalWakeTime = targetTime - wakeWindow;
    }

    return optimalWakeTime;
  }

  parseTime(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    const now = new Date();
    const target = new Date(now);
    target.setHours(hours, minutes, 0, 0);
    
    if (target <= now) {
      target.setDate(target.getDate() + 1);
    }
    
    return target.getTime();
  }

  async executeWakeupRoutine(userId) {
    const alarm = Array.from(this.smartAlarms.values()).find(a => a.userId === userId);
    const profile = this.sleepProfiles.get(userId);
    
    if (!alarm || !profile) {
      return { success: false, error: 'Alarm or profile not found' };
    }

    console.log(`⏰ Executing wake-up routine for ${profile.name}...`);

    switch (alarm.wakeupRoutine) {
      case 'gradual_light':
        console.log('  ☀️ Gradually increasing bedroom light (0% → 100% over 15 min)');
        console.log('  🌡️ Adjusting temperature to 21°C');
        break;

      case 'gradual_light_music':
        console.log('  ☀️ Gradually increasing bedroom light (0% → 100% over 15 min)');
        console.log('  🎵 Playing gentle wake-up music');
        console.log('  🌡️ Adjusting temperature to 21°C');
        break;

      case 'sound_only':
        console.log('  🔔 Playing alarm sound');
        break;
    }

    return { success: true };
  }

  // ============================================
  // SLEEP ENVIRONMENT
  // ============================================

  async setupSleepEnvironment() {
    const environments = [
      {
        userId: 'anna',
        room: 'master_bedroom',
        temperature: 19,
        humidity: 55,
        lightLevel: 0,
        noiseLevel: 'white-noise',
        airQuality: 'good'
      },
      {
        userId: 'erik',
        room: 'master_bedroom',
        temperature: 18,
        humidity: 50,
        lightLevel: 0,
        noiseLevel: 'silent',
        airQuality: 'good'
      },
      {
        userId: 'emma',
        room: 'emma_bedroom',
        temperature: 20,
        humidity: 55,
        lightLevel: 5,  // nightlight
        noiseLevel: 'soft-music',
        airQuality: 'good'
      },
      {
        userId: 'oscar',
        room: 'oscar_bedroom',
        temperature: 20,
        humidity: 55,
        lightLevel: 5,  // nightlight
        noiseLevel: 'soft-music',
        airQuality: 'good'
      }
    ];

    for (const env of environments) {
      this.sleepEnvironment.set(env.userId, env);
    }
  }

  async optimizeSleepEnvironment(userId) {
    const profile = this.sleepProfiles.get(userId);
    const environment = this.sleepEnvironment.get(userId);
    
    if (!profile || !environment) {
      return { success: false, error: 'Profile or environment not found' };
    }

    console.log(`🌙 Optimizing sleep environment for ${profile.name}...`);

    // Temperature
    if (environment.temperature !== profile.preferences.temperature) {
      console.log(`  🌡️ Adjusting temperature: ${environment.temperature}°C → ${profile.preferences.temperature}°C`);
      environment.temperature = profile.preferences.temperature;
    }

    // Humidity
    if (environment.humidity !== profile.preferences.humidity) {
      console.log(`  💧 Adjusting humidity: ${environment.humidity}% → ${profile.preferences.humidity}%`);
      environment.humidity = profile.preferences.humidity;
    }

    // Lighting
    const targetLight = profile.preferences.darkness === 'complete' ? 0 : 5;
    if (environment.lightLevel !== targetLight) {
      console.log(`  💡 Adjusting lighting: ${environment.lightLevel}% → ${targetLight}%`);
      environment.lightLevel = targetLight;
    }

    // Noise
    if (environment.noiseLevel !== profile.preferences.noise) {
      console.log(`  🔊 Setting noise level: ${profile.preferences.noise}`);
      environment.noiseLevel = profile.preferences.noise;
    }

    return { success: true };
  }

  async activateBedtimeRoutine(userId) {
    const profile = this.sleepProfiles.get(userId);
    
    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }

    console.log(`🌙 Activating bedtime routine for ${profile.name}...`);

    // Optimize environment
    await this.optimizeSleepEnvironment(userId);

    // Additional bedtime actions
    console.log('  🔒 Locking doors');
    console.log('  🔦 Turning off main lights');
    console.log('  📺 Turning off TVs');
    console.log('  🔇 Setting phone to Do Not Disturb');

    return { success: true };
  }

  // ============================================
  // CIRCADIAN RHYTHM OPTIMIZATION
  // ============================================

  async analyzeCircadianRhythm(userId) {
    const profile = this.sleepProfiles.get(userId);
    const sessions = this.sleepSessions.filter(s => s.userId === userId).slice(-30);

    if (!profile || sessions.length < 7) {
      return { success: false, error: 'Insufficient data' };
    }

    // Calculate average bedtime and wake time
    const bedtimes = sessions.map(s => {
      const date = new Date(s.bedtime);
      return date.getHours() + date.getMinutes() / 60;
    });

    const wakeTimes = sessions.map(s => {
      const date = new Date(s.wakeTime);
      return date.getHours() + date.getMinutes() / 60;
    });

    const avgBedtime = bedtimes.reduce((a, b) => a + b, 0) / bedtimes.length;
    const avgWakeTime = wakeTimes.reduce((a, b) => a + b, 0) / wakeTimes.length;

    // Calculate consistency (lower is better)
    const bedtimeVariance = this.calculateVariance(bedtimes);
    const wakeTimeVariance = this.calculateVariance(wakeTimes);

    const consistency = 100 - Math.min((bedtimeVariance + wakeTimeVariance) * 10, 100);

    return {
      avgBedtime: this.formatTimeFromDecimal(avgBedtime),
      avgWakeTime: this.formatTimeFromDecimal(avgWakeTime),
      consistency: consistency.toFixed(0) + '%',
      circadianType: profile.circadianType,
      recommendation: this.getCircadianRecommendation(profile, avgBedtime, avgWakeTime)
    };
  }

  calculateVariance(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(value => Math.pow(value - mean, 2));
    return squareDiffs.reduce((a, b) => a + b, 0) / values.length;
  }

  formatTimeFromDecimal(decimal) {
    const hours = Math.floor(decimal);
    const minutes = Math.round((decimal - hours) * 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  getCircadianRecommendation(profile, avgBedtime, avgWakeTime) {
    const targetBedtime = this.parseTimeToDecimal(profile.targetBedtime);
    const targetWakeTime = this.parseTimeToDecimal(profile.targetWakeTime);

    if (Math.abs(avgBedtime - targetBedtime) > 1) {
      return `Försök gå och lägga dig närmare ${profile.targetBedtime} för bättre sömn`;
    } else if (Math.abs(avgWakeTime - targetWakeTime) > 1) {
      return `Försök vakna närmare ${profile.targetWakeTime} för bättre rytm`;
    } else {
      return 'Din sömnrytm är bra! Fortsätt så här';
    }
  }

  parseTimeToDecimal(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours + minutes / 60;
  }

  // ============================================
  // MONITORING
  // ============================================

  startMonitoring() {
    // Check for bedtime routines
    this._intervals.push(setInterval(() => {
      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes();

      for (const [_userId, profile] of this.sleepProfiles) {
        const targetBedtime = this.parseTimeToDecimal(profile.targetBedtime);
        const targetMinutes = Math.floor(targetBedtime * 60);

        // 30 minutes before bedtime
        if (Math.abs(currentTime - targetMinutes + 30) < 2) {
          console.log(`💤 Bedtime reminder for ${profile.name} in 30 minutes`);
        }
      }
    }, 60000));  // Check every minute

    console.log('😴 Sleep Optimizer active');
  }

  // ============================================
  // REPORTING
  // ============================================

  getSleepOptimizerOverview() {
    return {
      profiles: this.sleepProfiles.size,
      smartAlarms: this.smartAlarms.size,
      sleepSessions: this.sleepSessions.length,
      avgFamilySleepQuality: this.calculateAverageSleepQuality() + '%'
    };
  }

  calculateAverageSleepQuality() {
    const profiles = Array.from(this.sleepProfiles.values());
    const avgQuality = profiles.reduce((sum, p) => sum + p.sleepQuality, 0) / profiles.length;
    return (avgQuality * 100).toFixed(0);
  }

  getSleepProfiles() {
    return Array.from(this.sleepProfiles.values()).map(p => ({
      name: p.name,
      targetSleep: p.targetSleepHours + 'h',
      bedtime: p.targetBedtime,
      wakeTime: p.targetWakeTime,
      quality: (p.sleepQuality * 100).toFixed(0) + '%'
    }));
  }

  getRecentSleep(days = 7) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const recent = this.sleepSessions.filter(s => s.timestamp >= cutoff);

    return recent.map(s => {
      const profile = this.sleepProfiles.get(s.userId);
      return {
        name: profile?.name || s.userId,
        date: new Date(s.bedtime).toLocaleDateString('sv-SE'),
        duration: s.duration.toFixed(1) + 'h',
        quality: (s.quality * 100).toFixed(0) + '%',
        deepSleep: s.stages.deep.toFixed(1) + 'h'
      };
    }).slice(-10);
  }

  getSleepDebt() {
    return Array.from(this.sleepProfiles.values()).map(p => {
      const recentSessions = this.sleepSessions
        .filter(s => s.userId === p.id)
        .slice(-7);

      if (recentSessions.length === 0) {
        return {
          name: p.name,
          debt: 'N/A'
        };
      }

      const avgDuration = recentSessions.reduce((sum, s) => sum + s.duration, 0) / recentSessions.length;
      const debt = (p.targetSleepHours - avgDuration) * 7;

      return {
        name: p.name,
        debt: debt > 0 ? '+' + debt.toFixed(1) + 'h' : debt.toFixed(1) + 'h'
      };
    });
  }

  destroy() {
    if (this._intervals) {
      this._intervals.forEach(id => clearInterval(id));
      this._intervals = [];
    }
  }
}

module.exports = AdvancedSleepOptimizer;
