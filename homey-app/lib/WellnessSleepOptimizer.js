'use strict';

/**
 * Wellness & Sleep Optimizer
 * Optimize sleep quality and overall wellness through environmental control
 */
class WellnessSleepOptimizer {
  constructor(homey) {
    this.homey = homey;
    this.sleepSessions = [];
    this.sleepQualityData = [];
    this.wakeUpOptimization = true;
    this.bedtimeReminder = true;
    this.optimalBedtime = '22:30';
    this.optimalWakeTime = '07:00';
    this.sleepPhases = new Map();
  }

  async initialize() {
    this.log('Initializing Wellness & Sleep Optimizer...');
    
    const savedSettings = await this.homey.settings.get('sleepSettings') || {};
    this.optimalBedtime = savedSettings.bedtime || '22:30';
    this.optimalWakeTime = savedSettings.wakeTime || '07:00';
    
    await this.startMonitoring();
    
    this.log('Wellness & Sleep Optimizer initialized');
  }

  async startMonitoring() {
    this.monitoringInterval = setInterval(async () => {
      await this.checkBedtimeReminder();
      await this.optimizeSleepEnvironment();
    }, 300000);
  }

  async checkBedtimeReminder() {
    if (!this.bedtimeReminder) return;

    const now = new Date();
    const [targetHour, targetMin] = this.optimalBedtime.split(':').map(Number);
    
    if (now.getHours() === targetHour && now.getMinutes() === targetMin) {
      await this.sendBedtimeReminder();
    }
  }

  async sendBedtimeReminder() {
    try {
      const notificationManager = this.homey.app.advancedNotificationManager;
      if (notificationManager) {
        await notificationManager.sendNotification({
          title: '🌙 Dags för sömn',
          message: 'Det är din optimala sänggåendetid för bästa sömn',
          priority: 'low',
          category: 'wellness'
        });
      }
    } catch {}
  }

  async optimizeSleepEnvironment() {
    const hour = new Date().getHours();
    
    if (hour >= 22 || hour < 7) {
      const devices = this.homey.drivers.getDevices();
      
      for (const device of devices) {
        const name = device.name.toLowerCase();
        const zone = device.zone?.name?.toLowerCase() || '';
        
        if (zone.includes('bedroom')) {
          if (device.hasCapability('dim')) {
            try {
              await device.setCapabilityValue('dim', 0.1);
            } catch {}
          }
          
          if (device.hasCapability('target_temperature')) {
            try {
              await device.setCapabilityValue('target_temperature', 18);
            } catch {}
          }
        }
      }
    }
  }

  async startSleepSession() {
    const session = {
      id: `sleep_${Date.now()}`,
      start: Date.now(),
      end: null,
      quality: null,
      environment: await this.getEnvironmentData()
    };

    this.sleepSessions.push(session);
    this.log('Sleep session started');

    return session;
  }

  async endSleepSession(sessionId) {
    const session = this.sleepSessions.find(s => s.id === sessionId);
    if (!session) return;

    session.end = Date.now();
    session.duration = (session.end - session.start) / 3600000;
    session.quality = await this.calculateSleepQuality(session);

    this.sleepQualityData.push({
      date: new Date(session.start).toISOString().split('T')[0],
      duration: session.duration,
      quality: session.quality
    });

    this.log(`Sleep session ended: ${session.duration.toFixed(1)}h, quality: ${session.quality}`);

    return session;
  }

  async calculateSleepQuality(session) {
    let quality = 75;

    if (session.duration < 6) quality -= 20;
    else if (session.duration > 9) quality -= 10;

    if (session.environment.temperature > 20) quality -= 10;
    if (session.environment.temperature < 16) quality -= 10;

    return Math.max(0, Math.min(100, quality));
  }

  async getEnvironmentData() {
    return {
      temperature: 18,
      humidity: 50,
      lightLevel: 0,
      noiseLevel: 30
    };
  }

  async optimizeWakeUp(targetTime) {
    const lightSleepWindow = 30;
    const wakeTime = new Date(targetTime);
    wakeTime.setMinutes(wakeTime.getMinutes() - lightSleepWindow);

    this.log(`Optimized wake-up scheduled for light sleep phase around ${targetTime}`);

    setTimeout(async () => {
      await this.gradualWakeUp();
    }, wakeTime.getTime() - Date.now());
  }

  async gradualWakeUp() {
    this.log('Starting gradual wake-up sequence');

    const devices = this.homey.drivers.getDevices();
    
    for (const device of devices) {
      const zone = device.zone?.name?.toLowerCase() || '';
      
      if (zone.includes('bedroom') && device.hasCapability('dim')) {
        for (let i = 0; i <= 10; i++) {
          try {
            await device.setCapabilityValue('dim', i * 0.1);
            await new Promise(resolve => setTimeout(resolve, 60000));
          } catch {}
        }
      }
    }
  }

  getStatistics() {
    const last7Days = this.sleepQualityData.slice(-7);
    const avgQuality = last7Days.length > 0 
      ? last7Days.reduce((sum, d) => sum + d.quality, 0) / last7Days.length 
      : 0;
    const avgDuration = last7Days.length > 0
      ? last7Days.reduce((sum, d) => sum + d.duration, 0) / last7Days.length
      : 0;

    return {
      sleepSessions: this.sleepSessions.length,
      avgQuality: avgQuality.toFixed(1),
      avgDuration: avgDuration.toFixed(1),
      last7Days,
      optimalBedtime: this.optimalBedtime,
      optimalWakeTime: this.optimalWakeTime
    };
  }

  log(...args) {
    console.log('[WellnessSleepOptimizer]', ...args);
  }

  error(...args) {
    console.error('[WellnessSleepOptimizer]', ...args);
  }
}

module.exports = WellnessSleepOptimizer;
