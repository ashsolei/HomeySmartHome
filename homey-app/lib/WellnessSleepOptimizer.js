'use strict';

/**
 * Wellness & Sleep Optimizer
 * Comprehensive sleep quality optimization through environmental control,
 * sleep cycle tracking, circadian rhythm analysis, and multi-user support
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

    // Sleep cycle tracking
    this.sleepCycleData = new Map();
    this.CYCLE_DURATION_MIN = 90;
    this.PHASE_DURATIONS = {
      light: { min: 20, max: 30 },
      deep: { min: 15, max: 25 },
      rem: { min: 10, max: 25 },
      transition: { min: 5, max: 10 }
    };

    // Circadian rhythm
    this.circadianProfile = {
      chronotype: 'intermediate',
      melatoninOnset: '21:00',
      coreBodyTempMin: '04:30',
      optimalSleepWindow: { start: '22:00', end: '06:30' }
    };

    // Smart alarm
    this.smartAlarms = new Map();
    this.alarmTimers = new Map();

    // Wind-down & morning routines
    this.windDownDurationMin = 30;
    this.windDownStages = [];
    this.morningRoutineStages = [];
    this.activeRoutineTimers = [];

    // Sleep debt tracking
    this.idealSleepHours = 8;
    this.sleepDebtHistory = [];

    // Noise monitoring
    this.noiseMonitoringActive = false;
    this.noiseThreshold = 45;
    this.whiteNoiseActive = false;

    // Partner mode
    this.partnerMode = false;
    this.partnerProfiles = new Map();

    // Wearable integration
    this.wearableData = new Map();
    this.heartRateHistory = [];
  }

  async initialize() {
    this.log('Initializing Wellness & Sleep Optimizer...');

    try {
      const savedSettings = await this.homey.settings.get('sleepSettings') || {};
      this.optimalBedtime = savedSettings.bedtime || '22:30';
      this.optimalWakeTime = savedSettings.wakeTime || '07:00';
      this.idealSleepHours = savedSettings.idealHours || 8;
      this.windDownDurationMin = savedSettings.windDownDuration || 30;
      this.noiseThreshold = savedSettings.noiseThreshold || 45;
      this.partnerMode = savedSettings.partnerMode || false;

      if (savedSettings.circadianProfile) {
        Object.assign(this.circadianProfile, savedSettings.circadianProfile);
      }

      if (savedSettings.partnerProfiles) {
        Object.entries(savedSettings.partnerProfiles).forEach(([id, profile]) => {
          this.partnerProfiles.set(id, profile);
        });
      }

      const savedQuality = await this.homey.settings.get('sleepQualityData') || [];
      this.sleepQualityData = savedQuality.slice(-90);

      const savedDebt = await this.homey.settings.get('sleepDebtHistory') || [];
      this.sleepDebtHistory = savedDebt.slice(-30);

      await this.initializeWindDownStages();
      await this.initializeMorningRoutineStages();
      await this.startMonitoring();
    } catch (err) {
      this.error('Failed to initialize:', err.message);
    }

    this.log('Wellness & Sleep Optimizer initialized');
  }

  async initializeWindDownStages() {
    const totalMin = this.windDownDurationMin;
    this.windDownStages = [
      { minutesBefore: totalMin, action: 'dim_lights_warm', dimLevel: 0.5, colorTemp: 2200, label: 'Warm dim lighting' },
      { minutesBefore: totalMin - 5, action: 'start_ambient_sound', soundType: 'nature', volume: 0.3, label: 'Ambient nature sounds' },
      { minutesBefore: totalMin - 10, action: 'lower_temperature', targetTemp: 19, label: 'Cool bedroom slightly' },
      { minutesBefore: totalMin - 15, action: 'dim_lights_low', dimLevel: 0.25, label: 'Further dim lights' },
      { minutesBefore: totalMin - 20, action: 'stop_screens_reminder', label: 'Screen time reminder' },
      { minutesBefore: totalMin - 25, action: 'dim_lights_minimal', dimLevel: 0.1, label: 'Minimal lighting' },
      { minutesBefore: 2, action: 'lights_off', label: 'Lights off' }
    ];
  }

  async initializeMorningRoutineStages() {
    this.morningRoutineStages = [
      { minutesBefore: 30, action: 'raise_temperature', targetTemp: 21, label: 'Warm up bedroom' },
      { minutesBefore: 20, action: 'sunrise_simulation', dimLevel: 0.1, colorTemp: 3000, label: 'Sunrise simulation start' },
      { minutesBefore: 15, action: 'gradual_brighten', dimLevel: 0.3, colorTemp: 3500, label: 'Gradual brightening' },
      { minutesBefore: 10, action: 'brighten_more', dimLevel: 0.5, colorTemp: 4000, label: 'Morning light' },
      { minutesBefore: 5, action: 'coffee_maker_trigger', label: 'Start coffee maker' },
      { minutesBefore: 2, action: 'full_brightness', dimLevel: 0.8, colorTemp: 5000, label: 'Full morning light' },
      { minutesBefore: 0, action: 'morning_music', volume: 0.25, label: 'Gentle morning music' }
    ];
  }

  async startMonitoring() {
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkBedtimeReminder();
        await this.optimizeSleepEnvironment();
        await this.monitorNoiseLevel();
        await this.checkSmartAlarms();
        await this.processWearableData();
        await this.checkPartnerSchedules();
      } catch (err) {
        this.error('Monitoring cycle error:', err.message);
      }
    }, 300000);
  }

  // ── Sleep Cycle Tracking ──────────────────────────────────────────────

  estimateSleepPhases(sessionDurationHours) {
    const totalMinutes = sessionDurationHours * 60;
    const cycleCount = Math.floor(totalMinutes / this.CYCLE_DURATION_MIN);
    const phases = [];
    let elapsed = 0;

    for (let cycle = 0; cycle < cycleCount; cycle++) {
      const cycleNum = cycle + 1;
      const deepDuration = Math.max(5, this.PHASE_DURATIONS.deep.max - (cycle * 4));
      const remDuration = Math.min(this.PHASE_DURATIONS.rem.max, this.PHASE_DURATIONS.rem.min + (cycle * 4));
      const lightDuration = this.CYCLE_DURATION_MIN - deepDuration - remDuration - this.PHASE_DURATIONS.transition.min;

      phases.push({ cycle: cycleNum, phase: 'light', duration: lightDuration, startMin: elapsed });
      elapsed += lightDuration;
      phases.push({ cycle: cycleNum, phase: 'deep', duration: deepDuration, startMin: elapsed });
      elapsed += deepDuration;
      phases.push({ cycle: cycleNum, phase: 'transition', duration: this.PHASE_DURATIONS.transition.min, startMin: elapsed });
      elapsed += this.PHASE_DURATIONS.transition.min;
      phases.push({ cycle: cycleNum, phase: 'rem', duration: remDuration, startMin: elapsed });
      elapsed += remDuration;
    }

    const remaining = totalMinutes - elapsed;
    if (remaining > 5) {
      phases.push({ cycle: cycleCount + 1, phase: 'light', duration: remaining, startMin: elapsed });
    }

    return {
      totalCycles: cycleCount,
      phases,
      totalDeepMin: phases.filter(p => p.phase === 'deep').reduce((s, p) => s + p.duration, 0),
      totalRemMin: phases.filter(p => p.phase === 'rem').reduce((s, p) => s + p.duration, 0),
      totalLightMin: phases.filter(p => p.phase === 'light').reduce((s, p) => s + p.duration, 0)
    };
  }

  findLightSleepWindow(wakeTargetTime, toleranceMin = 20) {
    const wakeTarget = new Date(wakeTargetTime);
    const assumedSleepStart = new Date(wakeTarget.getTime() - this.idealSleepHours * 3600000);
    const durationHours = (wakeTarget - assumedSleepStart) / 3600000;
    const cycleData = this.estimateSleepPhases(durationHours);

    const lightPhases = cycleData.phases.filter(p => p.phase === 'light');
    const candidates = lightPhases.filter(p => {
      const phaseTime = assumedSleepStart.getTime() + p.startMin * 60000;
      const diff = wakeTarget.getTime() - phaseTime;
      return diff >= 0 && diff <= toleranceMin * 60000;
    });

    if (candidates.length > 0) {
      const best = candidates[candidates.length - 1];
      return {
        optimalWakeTime: new Date(assumedSleepStart.getTime() + best.startMin * 60000),
        phase: 'light',
        cycle: best.cycle
      };
    }

    return { optimalWakeTime: wakeTarget, phase: 'unknown', cycle: null };
  }

  // ── Circadian Rhythm Analysis ─────────────────────────────────────────

  analyzeCircadianRhythm() {
    const recentSessions = this.sleepQualityData.slice(-14);
    if (recentSessions.length < 3) {
      return { status: 'insufficient_data', recommendations: ['Track at least 3 nights for analysis.'] };
    }

    const avgBedtime = this.calculateAverageTime(recentSessions.map(s => s.bedtime || this.optimalBedtime));
    const avgWakeTime = this.calculateAverageTime(recentSessions.map(s => s.wakeTime || this.optimalWakeTime));
    const consistency = this.calculateTimeConsistency(recentSessions);

    let chronotype = 'intermediate';
    const [bedH] = avgBedtime.split(':').map(Number);
    if (bedH < 22) chronotype = 'early_bird';
    else if (bedH >= 0 && bedH < 2) chronotype = 'night_owl';

    const recommendations = [];
    if (consistency < 0.6) recommendations.push('Try to maintain consistent sleep and wake times, even on weekends.');
    if (chronotype === 'night_owl') recommendations.push('Expose yourself to bright light in the morning to shift your rhythm earlier.');
    if (chronotype === 'early_bird') recommendations.push('Avoid bright screens after 20:00 to maintain your natural early rhythm.');

    const avgQuality = recentSessions.reduce((s, d) => s + (d.quality || 0), 0) / recentSessions.length;
    if (avgQuality < 60) recommendations.push('Your sleep quality is below average. Consider reducing caffeine after 14:00.');

    this.circadianProfile.chronotype = chronotype;

    return {
      chronotype,
      averageBedtime: avgBedtime,
      averageWakeTime: avgWakeTime,
      consistency: Math.round(consistency * 100),
      averageQuality: Math.round(avgQuality),
      recommendations
    };
  }

  calculateAverageTime(times) {
    if (times.length === 0) return '23:00';
    let totalMinutes = 0;
    for (const t of times) {
      const [h, m] = t.split(':').map(Number);
      let mins = h * 60 + m;
      if (h < 12) mins += 1440;
      totalMinutes += mins;
    }
    const avg = Math.round(totalMinutes / times.length) % 1440;
    return `${String(Math.floor(avg / 60)).padStart(2, '0')}:${String(avg % 60).padStart(2, '0')}`;
  }

  calculateTimeConsistency(sessions) {
    if (sessions.length < 2) return 1;
    const durations = sessions.map(s => s.duration || 0);
    const mean = durations.reduce((a, b) => a + b, 0) / durations.length;
    const variance = durations.reduce((s, d) => s + Math.pow(d - mean, 2), 0) / durations.length;
    const stdDev = Math.sqrt(variance);
    return Math.max(0, 1 - (stdDev / mean));
  }

  // ── Smart Alarm ───────────────────────────────────────────────────────

  async setSmartAlarm(userId, targetWakeTime, options = {}) {
    const alarmId = `alarm_${userId}_${Date.now()}`;
    const lightSleepResult = this.findLightSleepWindow(targetWakeTime);

    const alarm = {
      id: alarmId,
      userId,
      targetWakeTime: new Date(targetWakeTime),
      optimalWakeTime: lightSleepResult.optimalWakeTime,
      phase: lightSleepResult.phase,
      cycle: lightSleepResult.cycle,
      enabled: true,
      snoozeCount: 0,
      maxSnooze: options.maxSnooze || 2,
      snoozeDurationMin: options.snoozeDurationMin || 9,
      createdAt: Date.now()
    };

    this.smartAlarms.set(alarmId, alarm);

    const msUntilAlarm = alarm.optimalWakeTime.getTime() - Date.now();
    if (msUntilAlarm > 0) {
      const morningRoutineStart = msUntilAlarm - (30 * 60000);
      if (morningRoutineStart > 0) {
        const routineTimer = setTimeout(() => this.executeMorningRoutine(userId), morningRoutineStart);
        this.activeRoutineTimers.push(routineTimer);
      }

      const alarmTimer = setTimeout(() => this.triggerSmartAlarm(alarmId), msUntilAlarm);
      this.alarmTimers.set(alarmId, alarmTimer);
    }

    this.log(`Smart alarm set for ${userId}: target ${alarm.targetWakeTime.toLocaleTimeString()}, optimal ${alarm.optimalWakeTime.toLocaleTimeString()} (${alarm.phase} sleep phase)`);
    return alarm;
  }

  async triggerSmartAlarm(alarmId) {
    const alarm = this.smartAlarms.get(alarmId);
    if (!alarm || !alarm.enabled) return;

    this.log(`Smart alarm triggered: ${alarmId}`);
    await this.gradualWakeUp(alarm.userId);

    try {
      const notificationManager = this.homey.app.advancedNotificationManager;
      if (notificationManager) {
        await notificationManager.sendNotification({
          title: '⏰ God morgon!',
          message: `Dags att vakna — du väcks under lätt sömn för optimal vakenhet.`,
          priority: 'normal',
          category: 'wellness'
        });
      }
    } catch (err) {
      this.error('Failed to send alarm notification:', err.message);
    }
  }

  async snoozeAlarm(alarmId) {
    const alarm = this.smartAlarms.get(alarmId);
    if (!alarm) return null;

    if (alarm.snoozeCount >= alarm.maxSnooze) {
      this.log(`Max snooze reached for alarm ${alarmId}`);
      return { snoozed: false, reason: 'max_snooze_reached' };
    }

    alarm.snoozeCount++;
    const newTimer = setTimeout(() => this.triggerSmartAlarm(alarmId), alarm.snoozeDurationMin * 60000);
    this.alarmTimers.set(alarmId, newTimer);

    this.log(`Alarm snoozed (${alarm.snoozeCount}/${alarm.maxSnooze})`);
    return { snoozed: true, snoozeCount: alarm.snoozeCount, nextTriggerMin: alarm.snoozeDurationMin };
  }

  async checkSmartAlarms() {
    const now = Date.now();
    for (const [id, alarm] of this.smartAlarms) {
      if (alarm.enabled && alarm.optimalWakeTime.getTime() < now - 3600000) {
        alarm.enabled = false;
        this.alarmTimers.delete(id);
      }
    }
  }

  // ── Wind-Down Routine ─────────────────────────────────────────────────

  async startWindDownRoutine(userId = 'default') {
    this.log(`Starting wind-down routine for user: ${userId}`);
    const bedtime = this.partnerMode ? (this.partnerProfiles.get(userId)?.bedtime || this.optimalBedtime) : this.optimalBedtime;

    for (const stage of this.windDownStages) {
      const delay = stage.minutesBefore * 60000;
      const timer = setTimeout(async () => {
        try {
          await this.executeWindDownStage(stage, userId);
        } catch (err) {
          this.error(`Wind-down stage '${stage.label}' failed:`, err.message);
        }
      }, Math.max(0, delay));
      this.activeRoutineTimers.push(timer);
    }

    try {
      const notificationManager = this.homey.app.advancedNotificationManager;
      if (notificationManager) {
        await notificationManager.sendNotification({
          title: '🌙 Avslappningsrutin startad',
          message: `Din ${this.windDownDurationMin}-minuters avslappningsrutin har börjat.`,
          priority: 'low',
          category: 'wellness'
        });
      }
    } catch (err) {
      this.error('Failed to send wind-down notification:', err.message);
    }
  }

  async executeWindDownStage(stage, userId) {
    this.log(`Wind-down stage: ${stage.label}`);
    const devices = this.homey.drivers.getDevices();
    const bedroomZone = this.getBedroomZoneForUser(userId);

    for (const device of devices) {
      const zone = device.zone?.name?.toLowerCase() || '';
      if (!zone.includes(bedroomZone)) continue;

      try {
        switch (stage.action) {
          case 'dim_lights_warm':
          case 'dim_lights_low':
          case 'dim_lights_minimal':
            if (device.hasCapability('dim')) {
              await device.setCapabilityValue('dim', stage.dimLevel);
            }
            if (device.hasCapability('light_temperature') && stage.colorTemp) {
              await device.setCapabilityValue('light_temperature', this.kelvinToHomey(stage.colorTemp));
            }
            break;
          case 'lower_temperature':
            if (device.hasCapability('target_temperature')) {
              await device.setCapabilityValue('target_temperature', stage.targetTemp);
            }
            break;
          case 'lights_off':
            if (device.hasCapability('dim')) {
              await device.setCapabilityValue('dim', 0);
            }
            if (device.hasCapability('onoff')) {
              await device.setCapabilityValue('onoff', false);
            }
            break;
          default:
            break;
        }
      } catch (err) {
        this.error(`Wind-down device control failed for ${device.name}:`, err.message);
      }
    }
  }

  kelvinToHomey(kelvin) {
    return Math.max(0, Math.min(1, (kelvin - 2000) / 4500));
  }

  getBedroomZoneForUser(userId) {
    if (this.partnerMode) {
      const profile = this.partnerProfiles.get(userId);
      if (profile?.bedroomZone) return profile.bedroomZone.toLowerCase();
    }
    return 'bedroom';
  }

  // ── Morning Routine ───────────────────────────────────────────────────

  async executeMorningRoutine(userId = 'default') {
    this.log(`Starting morning routine for user: ${userId}`);
    const bedroomZone = this.getBedroomZoneForUser(userId);

    for (let i = 0; i < this.morningRoutineStages.length; i++) {
      const stage = this.morningRoutineStages[i];
      const delay = i * 5 * 60000;

      const timer = setTimeout(async () => {
        try {
          await this.executeMorningStage(stage, bedroomZone);
        } catch (err) {
          this.error(`Morning stage '${stage.label}' failed:`, err.message);
        }
      }, delay);
      this.activeRoutineTimers.push(timer);
    }
  }

  async executeMorningStage(stage, bedroomZone) {
    this.log(`Morning stage: ${stage.label}`);
    const devices = this.homey.drivers.getDevices();

    for (const device of devices) {
      const zone = device.zone?.name?.toLowerCase() || '';

      try {
        if (stage.action === 'coffee_maker_trigger') {
          const name = device.name.toLowerCase();
          if ((name.includes('coffee') || name.includes('kaffe')) && device.hasCapability('onoff')) {
            await device.setCapabilityValue('onoff', true);
            this.log('Coffee maker triggered');
          }
          continue;
        }

        if (!zone.includes(bedroomZone)) continue;

        if (stage.action === 'raise_temperature' && device.hasCapability('target_temperature')) {
          await device.setCapabilityValue('target_temperature', stage.targetTemp);
        }

        if (['sunrise_simulation', 'gradual_brighten', 'brighten_more', 'full_brightness'].includes(stage.action)) {
          if (device.hasCapability('dim')) {
            await device.setCapabilityValue('dim', stage.dimLevel);
          }
          if (device.hasCapability('light_temperature') && stage.colorTemp) {
            await device.setCapabilityValue('light_temperature', this.kelvinToHomey(stage.colorTemp));
          }
        }
      } catch (err) {
        this.error(`Morning device control failed for ${device.name}:`, err.message);
      }
    }
  }

  // ── Sleep Debt Calculation ────────────────────────────────────────────

  calculateSleepDebt(days = 7) {
    const recent = this.sleepQualityData.slice(-days);
    let totalDebt = 0;
    const dailyDebts = [];

    for (const session of recent) {
      const deficit = this.idealSleepHours - (session.duration || 0);
      totalDebt += Math.max(0, deficit);
      dailyDebts.push({
        date: session.date,
        slept: (session.duration || 0).toFixed(1),
        ideal: this.idealSleepHours,
        deficit: Math.max(0, deficit).toFixed(1)
      });
    }

    const recoveryRecommendations = [];
    if (totalDebt > 10) {
      recoveryRecommendations.push('Severe sleep debt detected. Consider extending sleep by 1-2 hours per night for the next week.');
      recoveryRecommendations.push('Avoid relying on weekend catch-up sleep; spread recovery across the week.');
    } else if (totalDebt > 5) {
      recoveryRecommendations.push('Moderate sleep debt. Try going to bed 30 minutes earlier for the next few days.');
      recoveryRecommendations.push('A short 20-minute nap in the early afternoon can help.');
    } else if (totalDebt > 2) {
      recoveryRecommendations.push('Mild sleep debt. One or two early nights should restore your balance.');
    } else {
      recoveryRecommendations.push('Your sleep balance is healthy. Keep up the good routine!');
    }

    const entry = { date: new Date().toISOString().split('T')[0], totalDebt: Math.round(totalDebt * 10) / 10, days };
    this.sleepDebtHistory.push(entry);

    return { totalDebtHours: Math.round(totalDebt * 10) / 10, dailyDebts, recoveryRecommendations };
  }

  // ── Weekly/Monthly Reports ────────────────────────────────────────────

  generateSleepReport(period = 'weekly') {
    const days = period === 'monthly' ? 30 : 7;
    const data = this.sleepQualityData.slice(-days);

    if (data.length === 0) {
      return { period, status: 'no_data', message: 'No sleep data available for this period.' };
    }

    const avgQuality = data.reduce((s, d) => s + (d.quality || 0), 0) / data.length;
    const avgDuration = data.reduce((s, d) => s + (d.duration || 0), 0) / data.length;
    const bestNight = data.reduce((best, d) => (d.quality || 0) > (best.quality || 0) ? d : best, data[0]);
    const worstNight = data.reduce((worst, d) => (d.quality || 0) < (worst.quality || 0) ? d : worst, data[0]);

    const qualityTrend = this.calculateTrend(data.map(d => d.quality || 0));
    const durationTrend = this.calculateTrend(data.map(d => d.duration || 0));

    const sleepDebt = this.calculateSleepDebt(days);
    const circadian = this.analyzeCircadianRhythm();

    return {
      period,
      daysTracked: data.length,
      averageQuality: Math.round(avgQuality),
      averageDuration: Math.round(avgDuration * 10) / 10,
      bestNight: { date: bestNight.date, quality: bestNight.quality },
      worstNight: { date: worstNight.date, quality: worstNight.quality },
      qualityTrend: qualityTrend > 0.5 ? 'improving' : qualityTrend < -0.5 ? 'declining' : 'stable',
      durationTrend: durationTrend > 0.1 ? 'increasing' : durationTrend < -0.1 ? 'decreasing' : 'stable',
      sleepDebt: sleepDebt.totalDebtHours,
      chronotype: circadian.chronotype || 'unknown',
      recommendations: [...(sleepDebt.recoveryRecommendations || []), ...(circadian.recommendations || [])]
    };
  }

  calculateTrend(values) {
    if (values.length < 2) return 0;
    const n = values.length;
    const xMean = (n - 1) / 2;
    const yMean = values.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      num += (i - xMean) * (values[i] - yMean);
      den += (i - xMean) ** 2;
    }
    return den === 0 ? 0 : num / den;
  }

  // ── Noise Monitoring ──────────────────────────────────────────────────

  async monitorNoiseLevel() {
    const hour = new Date().getHours();
    if (hour < 21 && hour > 8) return;

    try {
      const devices = this.homey.drivers.getDevices();
      for (const device of devices) {
        const zone = device.zone?.name?.toLowerCase() || '';
        if (!zone.includes('bedroom')) continue;

        if (device.hasCapability('measure_noise') || device.hasCapability('measure_luminance')) {
          let noise = 30;
          if (device.hasCapability('measure_noise')) {
            noise = await device.getCapabilityValue('measure_noise') || 30;
          }

          if (noise > this.noiseThreshold && !this.whiteNoiseActive) {
            await this.activateWhiteNoise();
          } else if (noise <= this.noiseThreshold - 10 && this.whiteNoiseActive) {
            await this.deactivateWhiteNoise();
          }
        }
      }
    } catch (err) {
      this.error('Noise monitoring error:', err.message);
    }
  }

  async activateWhiteNoise() {
    this.whiteNoiseActive = true;
    this.log('White noise activated due to high ambient noise');

    try {
      const devices = this.homey.drivers.getDevices();
      for (const device of devices) {
        const name = device.name.toLowerCase();
        const zone = device.zone?.name?.toLowerCase() || '';
        if (zone.includes('bedroom') && (name.includes('speaker') || name.includes('sound'))) {
          if (device.hasCapability('speaker_playing')) {
            await device.setCapabilityValue('speaker_playing', true);
          }
          if (device.hasCapability('volume_set')) {
            await device.setCapabilityValue('volume_set', 0.2);
          }
        }
      }
    } catch (err) {
      this.error('Failed to activate white noise:', err.message);
    }
  }

  async deactivateWhiteNoise() {
    this.whiteNoiseActive = false;
    this.log('White noise deactivated — noise levels normal');

    try {
      const devices = this.homey.drivers.getDevices();
      for (const device of devices) {
        const name = device.name.toLowerCase();
        const zone = device.zone?.name?.toLowerCase() || '';
        if (zone.includes('bedroom') && (name.includes('speaker') || name.includes('sound'))) {
          if (device.hasCapability('speaker_playing')) {
            await device.setCapabilityValue('speaker_playing', false);
          }
        }
      }
    } catch (err) {
      this.error('Failed to deactivate white noise:', err.message);
    }
  }

  // ── Partner Sleep Mode ────────────────────────────────────────────────

  async configurePartnerProfile(userId, profile) {
    this.partnerProfiles.set(userId, {
      userId,
      name: profile.name || userId,
      bedtime: profile.bedtime || this.optimalBedtime,
      wakeTime: profile.wakeTime || this.optimalWakeTime,
      idealHours: profile.idealHours || 8,
      bedroomZone: profile.bedroomZone || 'bedroom',
      windDownPreferences: profile.windDownPreferences || {},
      alarmPreferences: profile.alarmPreferences || {},
      createdAt: Date.now()
    });

    this.partnerMode = this.partnerProfiles.size >= 2;
    await this.saveSettings();
    this.log(`Partner profile configured: ${profile.name || userId}`);
    return this.partnerProfiles.get(userId);
  }

  async checkPartnerSchedules() {
    if (!this.partnerMode) return;

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    for (const [userId, profile] of this.partnerProfiles) {
      try {
        const windDownStart = this.subtractMinutesFromTime(profile.bedtime, this.windDownDurationMin);
        if (currentTime === windDownStart) {
          await this.startWindDownRoutine(userId);
        }
      } catch (err) {
        this.error(`Partner schedule check failed for ${userId}:`, err.message);
      }
    }
  }

  subtractMinutesFromTime(timeStr, minutes) {
    const [h, m] = timeStr.split(':').map(Number);
    const totalMin = ((h * 60 + m) - minutes + 1440) % 1440;
    return `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
  }

  // ── Wearable / Heart Rate Integration ─────────────────────────────────

  async processWearableData() {
    try {
      const wearableIntegration = this.homey.app.wearableIntegration;
      if (wearableIntegration) {
        const data = await wearableIntegration.getLatestData();
        if (data) {
          this.heartRateHistory.push({
            timestamp: Date.now(),
            heartRate: data.heartRate,
            hrv: data.hrv || null,
            spo2: data.spo2 || null,
            movement: data.movement || null
          });
          if (this.heartRateHistory.length > 2880) {
            this.heartRateHistory = this.heartRateHistory.slice(-2880);
          }
        }
      }
    } catch (err) {
      this.error('Wearable data processing error:', err.message);
    }
  }

  simulateWearableData() {
    const baseHR = 60;
    const hour = new Date().getHours();
    let hr = baseHR;

    if (hour >= 23 || hour < 5) hr = baseHR - 8 + Math.random() * 6;
    else if (hour >= 5 && hour < 7) hr = baseHR - 3 + Math.random() * 10;
    else hr = baseHR + Math.random() * 15;

    const data = {
      timestamp: Date.now(),
      heartRate: Math.round(hr),
      hrv: Math.round(30 + Math.random() * 40),
      spo2: Math.round(95 + Math.random() * 4),
      movement: hour >= 23 || hour < 6 ? Math.random() * 2 : Math.random() * 20
    };

    this.heartRateHistory.push(data);
    this.wearableData.set('latest', data);
    return data;
  }

  getRestingHeartRate() {
    const sleepHRData = this.heartRateHistory.filter(d => {
      const h = new Date(d.timestamp).getHours();
      return h >= 0 && h < 6;
    }).slice(-60);
    if (sleepHRData.length === 0) return null;
    return Math.round(sleepHRData.reduce((s, d) => s + d.heartRate, 0) / sleepHRData.length);
  }

  // ── Core Sleep Session Methods ────────────────────────────────────────

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
        const debtInfo = this.calculateSleepDebt(7);
        const debtMsg = debtInfo.totalDebtHours > 2 ? ` Du har ${debtInfo.totalDebtHours}h sömnskuld.` : '';
        await notificationManager.sendNotification({
          title: '🌙 Dags för sömn',
          message: `Det är din optimala sänggåendetid för bästa sömn.${debtMsg}`,
          priority: 'low',
          category: 'wellness'
        });
      }
    } catch (err) {
      this.error('Failed to send bedtime reminder:', err.message);
    }
  }

  async optimizeSleepEnvironment() {
    const hour = new Date().getHours();

    if (hour >= 22 || hour < 7) {
      try {
        const devices = this.homey.drivers.getDevices();
        for (const device of devices) {
          const zone = device.zone?.name?.toLowerCase() || '';
          if (zone.includes('bedroom')) {
            if (device.hasCapability('dim')) {
              try {
                await device.setCapabilityValue('dim', 0.05);
              } catch (err) {
                this.error(`Failed to dim ${device.name}:`, err.message);
              }
            }
            if (device.hasCapability('target_temperature')) {
              try {
                await device.setCapabilityValue('target_temperature', 18);
              } catch (err) {
                this.error(`Failed to set temperature for ${device.name}:`, err.message);
              }
            }
          }
        }
      } catch (err) {
        this.error('Sleep environment optimization error:', err.message);
      }
    }
  }

  async startSleepSession(userId = 'default') {
    const session = {
      id: `sleep_${Date.now()}`,
      userId,
      start: Date.now(),
      end: null,
      quality: null,
      phases: null,
      environment: await this.getEnvironmentData(),
      wearableSnapshot: this.wearableData.get('latest') || null
    };

    this.sleepSessions.push(session);
    await this.startWindDownRoutine(userId);
    this.log(`Sleep session started for ${userId}`);

    return session;
  }

  async endSleepSession(sessionId) {
    const session = this.sleepSessions.find(s => s.id === sessionId);
    if (!session) return null;

    session.end = Date.now();
    session.duration = (session.end - session.start) / 3600000;
    session.phases = this.estimateSleepPhases(session.duration);
    session.quality = await this.calculateSleepQuality(session);

    this.sleepQualityData.push({
      date: new Date(session.start).toISOString().split('T')[0],
      duration: session.duration,
      quality: session.quality,
      bedtime: new Date(session.start).toTimeString().slice(0, 5),
      wakeTime: new Date(session.end).toTimeString().slice(0, 5),
      cycles: session.phases.totalCycles,
      deepMin: session.phases.totalDeepMin,
      remMin: session.phases.totalRemMin
    });

    await this.saveSleepData();
    this.log(`Sleep session ended: ${session.duration.toFixed(1)}h, quality: ${session.quality}, cycles: ${session.phases.totalCycles}`);

    return session;
  }

  async calculateSleepQuality(session) {
    let quality = 75;

    if (session.duration < 6) quality -= 20;
    else if (session.duration < 7) quality -= 10;
    else if (session.duration > 9) quality -= 10;
    else if (session.duration >= 7 && session.duration <= 8.5) quality += 10;

    if (session.environment.temperature > 20) quality -= 10;
    if (session.environment.temperature < 16) quality -= 10;
    if (session.environment.temperature >= 17 && session.environment.temperature <= 19) quality += 5;

    if (session.environment.humidity < 30 || session.environment.humidity > 60) quality -= 5;
    if (session.environment.noiseLevel > 50) quality -= 15;

    if (session.phases) {
      if (session.phases.totalDeepMin > 60) quality += 5;
      if (session.phases.totalRemMin > 60) quality += 5;
      if (session.phases.totalCycles >= 4 && session.phases.totalCycles <= 6) quality += 5;
    }

    const restingHR = this.getRestingHeartRate();
    if (restingHR && restingHR < 60) quality += 5;

    return Math.max(0, Math.min(100, Math.round(quality)));
  }

  async getEnvironmentData() {
    const envData = { temperature: 18, humidity: 50, lightLevel: 0, noiseLevel: 30 };
    try {
      const devices = this.homey.drivers.getDevices();
      for (const device of devices) {
        const zone = device.zone?.name?.toLowerCase() || '';
        if (!zone.includes('bedroom')) continue;
        if (device.hasCapability('measure_temperature')) {
          envData.temperature = await device.getCapabilityValue('measure_temperature') || 18;
        }
        if (device.hasCapability('measure_humidity')) {
          envData.humidity = await device.getCapabilityValue('measure_humidity') || 50;
        }
        if (device.hasCapability('measure_luminance')) {
          envData.lightLevel = await device.getCapabilityValue('measure_luminance') || 0;
        }
      }
    } catch (err) {
      this.error('Failed to get environment data:', err.message);
    }
    return envData;
  }

  async gradualWakeUp(userId = 'default') {
    this.log(`Starting gradual wake-up sequence for ${userId}`);
    const bedroomZone = this.getBedroomZoneForUser(userId);
    const devices = this.homey.drivers.getDevices();

    for (const device of devices) {
      const zone = device.zone?.name?.toLowerCase() || '';
      if (zone.includes(bedroomZone) && device.hasCapability('dim')) {
        for (let i = 1; i <= 10; i++) {
          try {
            await device.setCapabilityValue('dim', i * 0.1);
            await new Promise(resolve => setTimeout(resolve, 60000));
          } catch (err) {
            this.error(`Gradual wake-up dim step failed for ${device.name}:`, err.message);
          }
        }
      }
    }
  }

  // ── Persistence ───────────────────────────────────────────────────────

  async saveSettings() {
    try {
      const partnerObj = {};
      this.partnerProfiles.forEach((v, k) => { partnerObj[k] = v; });
      await this.homey.settings.set('sleepSettings', {
        bedtime: this.optimalBedtime,
        wakeTime: this.optimalWakeTime,
        idealHours: this.idealSleepHours,
        windDownDuration: this.windDownDurationMin,
        noiseThreshold: this.noiseThreshold,
        partnerMode: this.partnerMode,
        circadianProfile: this.circadianProfile,
        partnerProfiles: partnerObj
      });
    } catch (err) {
      this.error('Failed to save settings:', err.message);
    }
  }

  async saveSleepData() {
    try {
      await this.homey.settings.set('sleepQualityData', this.sleepQualityData.slice(-90));
      await this.homey.settings.set('sleepDebtHistory', this.sleepDebtHistory.slice(-30));
    } catch (err) {
      this.error('Failed to save sleep data:', err.message);
    }
  }

  // ── Statistics ────────────────────────────────────────────────────────

  getStatistics() {
    const last7Days = this.sleepQualityData.slice(-7);
    const avgQuality = last7Days.length > 0 ? last7Days.reduce((sum, d) => sum + (d.quality || 0), 0) / last7Days.length : 0;
    const avgDuration = last7Days.length > 0 ? last7Days.reduce((sum, d) => sum + (d.duration || 0), 0) / last7Days.length : 0;
    const sleepDebt = this.calculateSleepDebt(7);
    const circadian = this.analyzeCircadianRhythm();
    const restingHR = this.getRestingHeartRate();

    return {
      sleepSessions: this.sleepSessions.length,
      avgQuality: avgQuality.toFixed(1),
      avgDuration: avgDuration.toFixed(1),
      last7Days,
      optimalBedtime: this.optimalBedtime,
      optimalWakeTime: this.optimalWakeTime,
      sleepDebtHours: sleepDebt.totalDebtHours,
      chronotype: circadian.chronotype || 'unknown',
      partnerMode: this.partnerMode,
      partnerCount: this.partnerProfiles.size,
      smartAlarms: this.smartAlarms.size,
      whiteNoiseActive: this.whiteNoiseActive,
      restingHeartRate: restingHR
    };
  }

  // ── Cleanup ───────────────────────────────────────────────────────────

  destroy() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    for (const [id, timer] of this.alarmTimers) {
      clearTimeout(timer);
    }
    this.alarmTimers.clear();
    for (const timer of this.activeRoutineTimers) {
      clearTimeout(timer);
    }
    this.activeRoutineTimers = [];
    this.log('Wellness & Sleep Optimizer destroyed');
  }

  log(...args) {
    console.log('[WellnessSleepOptimizer]', ...args);
  }

  error(...args) {
    console.error('[WellnessSleepOptimizer]', ...args);
  }
}

module.exports = WellnessSleepOptimizer;
