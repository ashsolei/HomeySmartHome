'use strict';

/**
 * PowerContinuityUPSSystem
 * 
 * Manages UPS devices, monitors grid power quality, detects outages,
 * orchestrates load shedding / failover / recovery, tracks battery health,
 * integrates backup generators, and provides comprehensive power-event history.
 *
 * Swedish notifications throughout.
 */

class PowerContinuityUPSSystem {

  constructor(homey) {
    this.homey = homey;

    // ── UPS Device Registry ──────────────────────────────────────────
    this.upsDevices = new Map();          // id → UPS descriptor
    this.nextUpsId = 1;

    // ── Grid / Power State ───────────────────────────────────────────
    this.gridStatus = {
      online: true,
      voltage: 230,
      frequency: 50.0,
      lastChange: Date.now(),
    };

    // ── Outage Tracking ──────────────────────────────────────────────
    this.currentOutage = null;            // { startTime, detectedVoltage, ... }
    this.outageHistory = [];              // completed outage records
    this.maxOutageHistory = 500;

    // ── Power Event Log ──────────────────────────────────────────────
    this.powerEvents = [];                // { type, timestamp, details }
    this.maxPowerEvents = 2000;

    // ── Load-Shedding Priority Groups ────────────────────────────────
    // Lower number = shed first (non-critical first, safety last)
    this.priorityGroups = {
      'non-critical': { priority: 1, label: 'Icke-kritisk', devices: [] },
      'luxury':       { priority: 2, label: 'Lyx',          devices: [] },
      'comfort':      { priority: 3, label: 'Komfort',      devices: [] },
      'safety':       { priority: 4, label: 'Säkerhet',     devices: [] },
    };

    // ── Critical Device → UPS/Circuit Mapping ────────────────────────
    this.deviceCircuitMap = new Map();    // deviceId → { upsId, circuit, priority }

    // ── Generator Integration ────────────────────────────────────────
    this.generator = {
      available: false,
      running: false,
      autoStart: true,
      startThresholdPct: 40,
      stopDelayMs: 5 * 60 * 1000,        // keep running 5 min after grid returns
      fuelLevelPct: 100,
      lastStartTime: null,
      totalRuntime: 0,
    };

    // ── Power Quality Monitoring ─────────────────────────────────────
    this.powerQuality = {
      voltageSags: 0,
      voltageSurges: 0,
      harmonicEvents: 0,
      lastSagTimestamp: null,
      lastSurgeTimestamp: null,
      nominalVoltage: 230,
      sagThreshold: 207,       // −10 %
      surgeThreshold: 253,     // +10 %
      frequencyMin: 49.5,
      frequencyMax: 50.5,
    };

    // ── Power Consumption Baseline ───────────────────────────────────
    this.consumptionBaseline = {
      samples: [],
      maxSamples: 1440,        // ~24 h at 1-min intervals
      averageWatts: 0,
      peakWatts: 0,
      anomalyThreshold: 1.5,   // 150 % of average
    };

    // ── Scheduled Self-Tests ─────────────────────────────────────────
    this.testSchedule = {
      enabled: true,
      intervalMs: 7 * 24 * 60 * 60 * 1000,   // weekly
      lastTestTime: null,
      nextTestTime: null,
      testResults: [],
      maxResults: 100,
    };

    // ── Maintenance Scheduling ───────────────────────────────────────
    this.maintenanceRecords = [];         // { upsId, type, scheduledDate, completed }
    this.maxMaintenanceRecords = 200;

    // ── Notification Escalation ──────────────────────────────────────
    this.notificationState = {
      outageNotified: false,
      escalationIntervalMs: 5 * 60 * 1000,  // every 5 min
      lastEscalation: null,
      escalationLevel: 0,
    };

    // ── Recovery ─────────────────────────────────────────────────────
    this.recoveryQueue = [];
    this.recoveryInProgress = false;

    // ── Intervals ────────────────────────────────────────────────────
    this._intervals = [];
    this._initialized = false;

    // ── Statistics ────────────────────────────────────────────────────
    this.stats = {
      totalOutages: 0,
      totalOutageDurationMs: 0,
      longestOutageMs: 0,
      totalLoadShedEvents: 0,
      totalRecoveries: 0,
      generatorStarts: 0,
      selfTestsRun: 0,
      anomaliesDetected: 0,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Lifecycle
  // ═══════════════════════════════════════════════════════════════════

  async initialize() {
    try {
      this.log('Initierar PowerContinuityUPSSystem …');

      this._scheduleNextSelfTest();
      this._startMonitoringIntervals();
      this._initialized = true;

      this.log('PowerContinuityUPSSystem initierad');
    } catch (err) {
      this.error('Initiering misslyckades:', err);
      throw err;
    }
  }

  destroy() {
    for (const id of this._intervals) clearInterval(id);
    this._intervals = [];
    this._initialized = false;
    this.log('PowerContinuityUPSSystem förstörd');
  }

  // ═══════════════════════════════════════════════════════════════════
  //  1. UPS Device Registry
  // ═══════════════════════════════════════════════════════════════════

  registerUPS(name, options = {}) {
    try {
      const id = `ups_${this.nextUpsId++}`;
      const ups = {
        id,
        name: name || `UPS ${id}`,
        capacityWh: options.capacityWh || 1500,
        currentLoadW: 0,
        batteryPct: options.batteryPct ?? 100,
        batteryHealthPct: options.batteryHealthPct ?? 100,
        chargeCycles: options.chargeCycles || 0,
        status: 'online',          // online | on-battery | fault | offline
        inputVoltage: 230,
        outputVoltage: 230,
        temperature: 25,
        lastSelfTest: null,
        installDate: options.installDate || Date.now(),
        batteryReplaceDate: options.batteryReplaceDate || null,
        connectedDevices: [],
        runtimeEstimateSec: 0,
      };

      this.upsDevices.set(id, ups);
      this._logPowerEvent('ups_registered', { id, name: ups.name, capacityWh: ups.capacityWh });
      this.log(`UPS registrerad: ${ups.name} (${ups.capacityWh} Wh)`);
      return id;
    } catch (err) {
      this.error('Kunde inte registrera UPS:', err);
      return null;
    }
  }

  unregisterUPS(upsId) {
    if (!this.upsDevices.has(upsId)) return false;
    const ups = this.upsDevices.get(upsId);
    this.upsDevices.delete(upsId);
    this._logPowerEvent('ups_unregistered', { id: upsId, name: ups.name });
    this.log(`UPS avregistrerad: ${ups.name}`);
    return true;
  }

  getUPSStatus(upsId) {
    return this.upsDevices.get(upsId) || null;
  }

  listUPSDevices() {
    return Array.from(this.upsDevices.values());
  }

  updateUPSMetrics(upsId, metrics = {}) {
    const ups = this.upsDevices.get(upsId);
    if (!ups) return false;

    if (metrics.currentLoadW !== undefined) ups.currentLoadW = metrics.currentLoadW;
    if (metrics.batteryPct !== undefined) ups.batteryPct = Math.max(0, Math.min(100, metrics.batteryPct));
    if (metrics.batteryHealthPct !== undefined) ups.batteryHealthPct = metrics.batteryHealthPct;
    if (metrics.inputVoltage !== undefined) ups.inputVoltage = metrics.inputVoltage;
    if (metrics.outputVoltage !== undefined) ups.outputVoltage = metrics.outputVoltage;
    if (metrics.temperature !== undefined) ups.temperature = metrics.temperature;

    ups.runtimeEstimateSec = this._estimateRuntime(ups);
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  2. Power / Grid Monitoring
  // ═══════════════════════════════════════════════════════════════════

  updateGridStatus(voltage, frequency, online) {
    try {
      const _prev = { ...this.gridStatus };
      this.gridStatus.voltage = voltage;
      this.gridStatus.frequency = frequency;

      if (online !== undefined && online !== this.gridStatus.online) {
        this.gridStatus.online = online;
        this.gridStatus.lastChange = Date.now();

        if (!online) {
          this._handleOutageDetected(voltage, frequency);
        } else {
          this._handlePowerRestored();
        }
      }

      // Power quality checks (even when online)
      this._evaluatePowerQuality(voltage, frequency);

      return this.gridStatus;
    } catch (err) {
      this.error('Fel vid uppdatering av nätstatus:', err);
      return this.gridStatus;
    }
  }

  getGridStatus() {
    return { ...this.gridStatus };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  3. Outage Detection
  // ═══════════════════════════════════════════════════════════════════

  _handleOutageDetected(voltage, frequency) {
    this.log('⚡ STRÖMAVBROTT UPPTÄCKT');
    this.stats.totalOutages++;

    this.currentOutage = {
      startTime: Date.now(),
      detectedVoltage: voltage,
      detectedFrequency: frequency,
      loadShedStages: [],
      generatorStarted: false,
    };

    this._logPowerEvent('outage_start', {
      voltage,
      frequency,
      timestamp: this.currentOutage.startTime,
    });

    // Immediate notification
    this._notify('⚡ Strömavbrott upptäckt! Systemet körs på UPS-batteri.', 'critical');
    this.notificationState.outageNotified = true;
    this.notificationState.escalationLevel = 1;
    this.notificationState.lastEscalation = Date.now();

    // Switch all UPS units to battery mode
    for (const [, ups] of this.upsDevices) {
      ups.status = 'on-battery';
    }

    // Begin automatic failover
    this._executeAutomaticFailover();

    // Start escalation timer
    this._startEscalationTimer();
  }

  _handlePowerRestored() {
    this.log('✅ STRÖM ÅTERSTÄLLD');

    if (this.currentOutage) {
      const duration = Date.now() - this.currentOutage.startTime;
      this.stats.totalOutageDurationMs += duration;
      if (duration > this.stats.longestOutageMs) this.stats.longestOutageMs = duration;

      const record = {
        ...this.currentOutage,
        endTime: Date.now(),
        durationMs: duration,
        durationFormatted: this._formatDuration(duration),
      };
      this.outageHistory.push(record);
      if (this.outageHistory.length > this.maxOutageHistory) {
        this.outageHistory = this.outageHistory.slice(-this.maxOutageHistory);
      }

      this._logPowerEvent('outage_end', {
        durationMs: duration,
        formatted: record.durationFormatted,
      });

      this.currentOutage = null;
    }

    this._notify(`✅ Strömmen är tillbaka! Återställer enheter …`, 'info');
    this.notificationState.outageNotified = false;
    this.notificationState.escalationLevel = 0;

    // Transition UPS units back to online
    for (const [, ups] of this.upsDevices) {
      ups.status = 'online';
    }

    // Stop generator (with delay)
    this._scheduleGeneratorStop();

    // Begin recovery sequence
    this._executeRecoverySequence();
  }

  getOutageHistory() {
    return [...this.outageHistory];
  }

  getCurrentOutage() {
    if (!this.currentOutage) return null;
    return {
      ...this.currentOutage,
      elapsedMs: Date.now() - this.currentOutage.startTime,
      elapsedFormatted: this._formatDuration(Date.now() - this.currentOutage.startTime),
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  4. Load Shedding
  // ═══════════════════════════════════════════════════════════════════

  assignDevicePriority(deviceId, group) {
    if (!this.priorityGroups[group]) {
      this.error(`Okänd prioritetsgrupp: ${group}`);
      return false;
    }
    // Remove from any existing group
    for (const g of Object.values(this.priorityGroups)) {
      g.devices = g.devices.filter(d => d !== deviceId);
    }
    this.priorityGroups[group].devices.push(deviceId);
    return true;
  }

  getLoadSheddingPlan() {
    return Object.entries(this.priorityGroups)
      .sort(([, a], [, b]) => a.priority - b.priority)
      .map(([key, g]) => ({
        group: key,
        label: g.label,
        priority: g.priority,
        deviceCount: g.devices.length,
        devices: [...g.devices],
      }));
  }

  executeLoadShedding(stage = 1) {
    try {
      this.log(`Lastavlastning steg ${stage} initierad`);
      const plan = this.getLoadSheddingPlan();
      const devicesToShed = [];

      for (const group of plan) {
        if (group.priority <= stage) {
          devicesToShed.push(...group.devices);
        }
      }

      this.stats.totalLoadShedEvents++;

      if (this.currentOutage) {
        this.currentOutage.loadShedStages.push({ stage, timestamp: Date.now(), devices: devicesToShed.length });
      }

      this._logPowerEvent('load_shed', { stage, deviceCount: devicesToShed.length });
      this._notify(`⚠️ Lastavlastning steg ${stage}: ${devicesToShed.length} enheter stängs av.`, 'warning');

      this.log(`Lastavlastning: ${devicesToShed.length} enheter stängs av (steg ${stage})`);
      return devicesToShed;
    } catch (err) {
      this.error('Fel vid lastavlastning:', err);
      return [];
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  5. Battery Health Tracking
  // ═══════════════════════════════════════════════════════════════════

  recordChargeCycle(upsId) {
    const ups = this.upsDevices.get(upsId);
    if (!ups) return false;
    ups.chargeCycles++;
    // Simple degradation model: lose ~0.05 % health per cycle
    ups.batteryHealthPct = Math.max(0, ups.batteryHealthPct - 0.05);
    this._logPowerEvent('charge_cycle', { upsId, cycles: ups.chargeCycles, health: ups.batteryHealthPct });

    if (ups.batteryHealthPct < 60) {
      this._notify(`🔋 UPS "${ups.name}" batteriets hälsa är ${ups.batteryHealthPct.toFixed(1)} % – planera byte!`, 'warning');
    }
    return true;
  }

  getBatteryHealth(upsId) {
    const ups = this.upsDevices.get(upsId);
    if (!ups) return null;
    return {
      upsId,
      name: ups.name,
      batteryPct: ups.batteryPct,
      healthPct: ups.batteryHealthPct,
      chargeCycles: ups.chargeCycles,
      runtimeEstimateSec: ups.runtimeEstimateSec,
      installDate: ups.installDate,
      batteryReplaceDate: ups.batteryReplaceDate,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  6. Power Event History
  // ═══════════════════════════════════════════════════════════════════

  _logPowerEvent(type, details = {}) {
    const event = { type, timestamp: Date.now(), details };
    this.powerEvents.push(event);
    if (this.powerEvents.length > this.maxPowerEvents) {
      this.powerEvents = this.powerEvents.slice(-this.maxPowerEvents);
    }
  }

  getPowerEvents(filterType, limit = 50) {
    let events = filterType
      ? this.powerEvents.filter(e => e.type === filterType)
      : this.powerEvents;
    return events.slice(-limit);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  7. Automatic Failover
  // ═══════════════════════════════════════════════════════════════════

  _executeAutomaticFailover() {
    try {
      this.log('Automatisk övergång till reservkraft …');

      for (const [, ups] of this.upsDevices) {
        ups.status = 'on-battery';
        ups.runtimeEstimateSec = this._estimateRuntime(ups);
      }

      this._logPowerEvent('failover_initiated', {
        upsCount: this.upsDevices.size,
      });

      // If any UPS battery is already low, start generator immediately
      for (const [, ups] of this.upsDevices) {
        if (ups.batteryPct <= this.generator.startThresholdPct) {
          this._startGenerator();
          break;
        }
      }
    } catch (err) {
      this.error('Fel vid automatisk övergång:', err);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  8. Generator Integration
  // ═══════════════════════════════════════════════════════════════════

  configureGenerator(options = {}) {
    if (options.available !== undefined) this.generator.available = options.available;
    if (options.autoStart !== undefined) this.generator.autoStart = options.autoStart;
    if (options.startThresholdPct !== undefined) this.generator.startThresholdPct = options.startThresholdPct;
    if (options.stopDelayMs !== undefined) this.generator.stopDelayMs = options.stopDelayMs;
    if (options.fuelLevelPct !== undefined) this.generator.fuelLevelPct = options.fuelLevelPct;
    this.log('Generator konfigurerad');
    return { ...this.generator };
  }

  _startGenerator() {
    if (!this.generator.available || this.generator.running) return;
    if (!this.generator.autoStart) return;

    this.generator.running = true;
    this.generator.lastStartTime = Date.now();
    this.stats.generatorStarts++;

    this._logPowerEvent('generator_start', { fuelPct: this.generator.fuelLevelPct });
    this._notify('🔌 Reservgenerator startad.', 'info');
    this.log('Reservgenerator startad');

    if (this.currentOutage) {
      this.currentOutage.generatorStarted = true;
    }
  }

  _stopGenerator() {
    if (!this.generator.running) return;
    const runtime = Date.now() - (this.generator.lastStartTime || Date.now());
    this.generator.running = false;
    this.generator.totalRuntime += runtime;

    this._logPowerEvent('generator_stop', { runtimeMs: runtime });
    this._notify('🔌 Reservgenerator stoppad.', 'info');
    this.log(`Reservgenerator stoppad (körde i ${this._formatDuration(runtime)})`);
  }

  _scheduleGeneratorStop() {
    if (!this.generator.running) return;
    setTimeout(() => {
      if (this.gridStatus.online) {
        this._stopGenerator();
      }
    }, this.generator.stopDelayMs);
  }

  getGeneratorStatus() {
    return {
      ...this.generator,
      runtimeFormatted: this.generator.lastStartTime && this.generator.running
        ? this._formatDuration(Date.now() - this.generator.lastStartTime)
        : null,
      totalRuntimeFormatted: this._formatDuration(this.generator.totalRuntime),
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  9. Recovery Automation
  // ═══════════════════════════════════════════════════════════════════

  _executeRecoverySequence() {
    try {
      this.log('Återställningssekvens påbörjad …');
      this.recoveryInProgress = true;
      this.stats.totalRecoveries++;

      // Restore in reverse priority order (safety first → non-critical last)
      const plan = this.getLoadSheddingPlan().reverse();
      this.recoveryQueue = [];

      for (const group of plan) {
        for (const deviceId of group.devices) {
          this.recoveryQueue.push({
            deviceId,
            group: group.group,
            priority: group.priority,
            restoredAt: null,
          });
        }
      }

      this._logPowerEvent('recovery_start', { deviceCount: this.recoveryQueue.length });
      this._processRecoveryQueue();
    } catch (err) {
      this.error('Fel vid återställningssekvens:', err);
      this.recoveryInProgress = false;
    }
  }

  _processRecoveryQueue() {
    if (this.recoveryQueue.length === 0) {
      this.recoveryInProgress = false;
      this._logPowerEvent('recovery_complete', {});
      this._notify('✅ Alla enheter har återställts efter strömavbrott.', 'info');
      this.log('Återställningssekvens slutförd');
      return;
    }

    const item = this.recoveryQueue[0];
    item.restoredAt = Date.now();
    this.log(`Återställer enhet: ${item.deviceId} (${item.group})`);

    this.recoveryQueue.shift();

    // Stagger restarts by 2 s to avoid inrush current spike
    setTimeout(() => this._processRecoveryQueue(), 2000);
  }

  getRecoveryStatus() {
    return {
      inProgress: this.recoveryInProgress,
      remaining: this.recoveryQueue.length,
      queue: [...this.recoveryQueue],
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  10. Power Quality Monitoring
  // ═══════════════════════════════════════════════════════════════════

  _evaluatePowerQuality(voltage, frequency) {
    const pq = this.powerQuality;

    if (voltage < pq.sagThreshold) {
      pq.voltageSags++;
      pq.lastSagTimestamp = Date.now();
      this._logPowerEvent('voltage_sag', { voltage, threshold: pq.sagThreshold });
      this._notify(`⚠️ Spänningsfall upptäckt: ${voltage} V (gräns ${pq.sagThreshold} V).`, 'warning');
    }

    if (voltage > pq.surgeThreshold) {
      pq.voltageSurges++;
      pq.lastSurgeTimestamp = Date.now();
      this._logPowerEvent('voltage_surge', { voltage, threshold: pq.surgeThreshold });
      this._notify(`⚠️ Överspänning upptäckt: ${voltage} V (gräns ${pq.surgeThreshold} V).`, 'warning');
    }

    if (frequency < pq.frequencyMin || frequency > pq.frequencyMax) {
      this._logPowerEvent('frequency_anomaly', { frequency, min: pq.frequencyMin, max: pq.frequencyMax });
    }
  }

  reportHarmonicEvent(details = {}) {
    this.powerQuality.harmonicEvents++;
    this._logPowerEvent('harmonic_event', details);
  }

  getPowerQualitySummary() {
    return { ...this.powerQuality };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  11. Scheduled Self-Testing
  // ═══════════════════════════════════════════════════════════════════

  _scheduleNextSelfTest() {
    const now = Date.now();
    this.testSchedule.nextTestTime = now + this.testSchedule.intervalMs;
  }

  configureTestSchedule(options = {}) {
    if (options.enabled !== undefined) this.testSchedule.enabled = options.enabled;
    if (options.intervalMs !== undefined) this.testSchedule.intervalMs = options.intervalMs;
    this._scheduleNextSelfTest();
    return { ...this.testSchedule };
  }

  async runSelfTest(upsId) {
    try {
      const ups = upsId ? this.upsDevices.get(upsId) : null;
      const targets = ups ? [ups] : Array.from(this.upsDevices.values());

      if (targets.length === 0) {
        this.log('Inga UPS-enheter att testa');
        return [];
      }

      this.log(`Kör självtest på ${targets.length} UPS-enhet(er) …`);
      const results = [];

      for (const unit of targets) {
        const result = {
          upsId: unit.id,
          name: unit.name,
          timestamp: Date.now(),
          batteryPct: unit.batteryPct,
          healthPct: unit.batteryHealthPct,
          loadW: unit.currentLoadW,
          temperature: unit.temperature,
          passed: unit.batteryHealthPct > 20 && unit.batteryPct > 10,
          message: '',
        };

        if (!result.passed) {
          result.message = `UPS "${unit.name}" klarade INTE självtestet – batteribyte rekommenderas.`;
          this._notify(`❌ UPS "${unit.name}" klarade inte självtestet!`, 'critical');
        } else {
          result.message = `UPS "${unit.name}" klarade självtestet.`;
        }

        results.push(result);
        unit.lastSelfTest = Date.now();
      }

      this.testSchedule.lastTestTime = Date.now();
      this._scheduleNextSelfTest();
      this.testSchedule.testResults.push(...results);
      if (this.testSchedule.testResults.length > this.testSchedule.maxResults) {
        this.testSchedule.testResults = this.testSchedule.testResults.slice(-this.testSchedule.maxResults);
      }
      this.stats.selfTestsRun++;

      this._logPowerEvent('self_test', { count: results.length, allPassed: results.every(r => r.passed) });
      return results;
    } catch (err) {
      this.error('Fel vid självtest:', err);
      return [];
    }
  }

  getTestSchedule() {
    return {
      ...this.testSchedule,
      nextTestFormatted: this.testSchedule.nextTestTime
        ? new Date(this.testSchedule.nextTestTime).toLocaleString('sv-SE')
        : null,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  12. Notification Escalation
  // ═══════════════════════════════════════════════════════════════════

  _notify(message, level = 'info') {
    try {
      const ts = new Date().toLocaleString('sv-SE');
      this.log(`[${level.toUpperCase()}] ${message}`);
      this._logPowerEvent('notification', { message, level, ts });

      if (this.homey && typeof this.homey.notifications === 'object' && typeof this.homey.notifications.createNotification === 'function') {
        this.homey.notifications.createNotification({ excerpt: message }).catch(() => {});
      }
    } catch (err) {
      this.error('Notifieringsfel:', err);
    }
  }

  _startEscalationTimer() {
    const id = setInterval(() => {
      if (!this.currentOutage) {
        clearInterval(id);
        return;
      }

      this.notificationState.escalationLevel++;
      this.notificationState.lastEscalation = Date.now();

      const elapsed = this._formatDuration(Date.now() - this.currentOutage.startTime);
      const runtimes = this._aggregateRuntimes();

      this._notify(
        `⏱️ Strömavbrott pågår: ${elapsed}. Beräknad batteritid: ${runtimes}.`,
        this.notificationState.escalationLevel >= 3 ? 'critical' : 'warning'
      );

      // Progressive load shedding as battery drains
      this._evaluateLoadSheddingNeed();
    }, this.notificationState.escalationIntervalMs);

    this._intervals.push(id);
  }

  _evaluateLoadSheddingNeed() {
    const lowestBattery = this._getLowestBatteryPct();
    if (lowestBattery <= 60 && this.notificationState.escalationLevel >= 2) {
      this.executeLoadShedding(1);
    }
    if (lowestBattery <= 40) {
      this.executeLoadShedding(2);
      this._startGenerator();
    }
    if (lowestBattery <= 20) {
      this.executeLoadShedding(3);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  13. Critical Device ↔ UPS/Circuit Mapping
  // ═══════════════════════════════════════════════════════════════════

  mapDeviceToCircuit(deviceId, upsId, circuit, priority = 'comfort') {
    this.deviceCircuitMap.set(deviceId, { upsId, circuit, priority });

    // Also add to the UPS connectedDevices list
    const ups = this.upsDevices.get(upsId);
    if (ups && !ups.connectedDevices.includes(deviceId)) {
      ups.connectedDevices.push(deviceId);
    }

    this.assignDevicePriority(deviceId, priority);
    this._logPowerEvent('device_mapped', { deviceId, upsId, circuit, priority });
    return true;
  }

  getDeviceCircuitInfo(deviceId) {
    return this.deviceCircuitMap.get(deviceId) || null;
  }

  getDevicesOnUPS(upsId) {
    const ups = this.upsDevices.get(upsId);
    if (!ups) return [];
    return ups.connectedDevices.map(deviceId => ({
      deviceId,
      ...(this.deviceCircuitMap.get(deviceId) || {}),
    }));
  }

  // ═══════════════════════════════════════════════════════════════════
  //  14. Runtime Estimation
  // ═══════════════════════════════════════════════════════════════════

  _estimateRuntime(ups) {
    if (!ups || ups.currentLoadW <= 0) return Infinity;
    const effectiveCapacityWh = (ups.capacityWh * (ups.batteryPct / 100)) * (ups.batteryHealthPct / 100);
    const runtimeHours = effectiveCapacityWh / ups.currentLoadW;
    return Math.max(0, Math.floor(runtimeHours * 3600));
  }

  getRuntimeEstimates() {
    const estimates = [];
    for (const [, ups] of this.upsDevices) {
      ups.runtimeEstimateSec = this._estimateRuntime(ups);
      estimates.push({
        upsId: ups.id,
        name: ups.name,
        batteryPct: ups.batteryPct,
        loadW: ups.currentLoadW,
        runtimeSec: ups.runtimeEstimateSec,
        runtimeFormatted: ups.runtimeEstimateSec === Infinity
          ? 'Ingen last'
          : this._formatDuration(ups.runtimeEstimateSec * 1000),
      });
    }
    return estimates;
  }

  _aggregateRuntimes() {
    const estimates = this.getRuntimeEstimates();
    if (estimates.length === 0) return 'okänd';
    const minRuntime = Math.min(...estimates.map(e => e.runtimeSec));
    if (minRuntime === Infinity) return 'ingen last';
    return this._formatDuration(minRuntime * 1000);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  15. Power Consumption Baseline
  // ═══════════════════════════════════════════════════════════════════

  recordConsumptionSample(watts) {
    try {
      const bl = this.consumptionBaseline;
      bl.samples.push({ watts, timestamp: Date.now() });
      if (bl.samples.length > bl.maxSamples) {
        bl.samples = bl.samples.slice(-bl.maxSamples);
      }

      // Recalculate baseline
      const total = bl.samples.reduce((s, sample) => s + sample.watts, 0);
      bl.averageWatts = total / bl.samples.length;
      bl.peakWatts = Math.max(...bl.samples.map(s => s.watts));

      // Anomaly detection
      if (bl.samples.length >= 30 && watts > bl.averageWatts * bl.anomalyThreshold) {
        this.stats.anomaliesDetected++;
        this._logPowerEvent('consumption_anomaly', { watts, average: bl.averageWatts });
        this._notify(`⚡ Onormal elförbrukning: ${watts} W (genomsnitt ${bl.averageWatts.toFixed(0)} W).`, 'warning');
      }

      return { averageWatts: bl.averageWatts, peakWatts: bl.peakWatts };
    } catch (err) {
      this.error('Fel vid inspelning av förbrukningsprov:', err);
      return null;
    }
  }

  getConsumptionBaseline() {
    const bl = this.consumptionBaseline;
    return {
      sampleCount: bl.samples.length,
      averageWatts: Math.round(bl.averageWatts * 100) / 100,
      peakWatts: bl.peakWatts,
      anomalyThreshold: bl.anomalyThreshold,
      anomaliesDetected: this.stats.anomaliesDetected,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  16. Maintenance Scheduling
  // ═══════════════════════════════════════════════════════════════════

  scheduleMaintenance(upsId, type, scheduledDate) {
    const ups = this.upsDevices.get(upsId);
    if (!ups) return null;

    const record = {
      id: `maint_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      upsId,
      upsName: ups.name,
      type: type || 'battery_replacement',
      scheduledDate: scheduledDate || Date.now() + 90 * 24 * 60 * 60 * 1000, // default 90 days
      completed: false,
      completedDate: null,
      notes: '',
    };

    this.maintenanceRecords.push(record);
    if (this.maintenanceRecords.length > this.maxMaintenanceRecords) {
      this.maintenanceRecords = this.maintenanceRecords.slice(-this.maxMaintenanceRecords);
    }

    if (type === 'battery_replacement') {
      ups.batteryReplaceDate = record.scheduledDate;
    }

    this._logPowerEvent('maintenance_scheduled', { upsId, type, scheduledDate: record.scheduledDate });
    this._notify(`🔧 Underhåll schemalagt för UPS "${ups.name}": ${new Date(record.scheduledDate).toLocaleDateString('sv-SE')}.`, 'info');

    return record;
  }

  completeMaintenance(maintenanceId, notes = '') {
    const record = this.maintenanceRecords.find(r => r.id === maintenanceId);
    if (!record) return false;

    record.completed = true;
    record.completedDate = Date.now();
    record.notes = notes;

    // If battery replacement, reset health metrics
    if (record.type === 'battery_replacement') {
      const ups = this.upsDevices.get(record.upsId);
      if (ups) {
        ups.batteryHealthPct = 100;
        ups.chargeCycles = 0;
        ups.batteryPct = 100;
        this.log(`UPS "${ups.name}" batteri bytt – hälsovärden återställda`);
      }
    }

    this._logPowerEvent('maintenance_completed', { id: maintenanceId, type: record.type });
    return true;
  }

  getUpcomingMaintenance() {
    const now = Date.now();
    return this.maintenanceRecords
      .filter(r => !r.completed && r.scheduledDate > now)
      .sort((a, b) => a.scheduledDate - b.scheduledDate)
      .map(r => ({
        ...r,
        daysUntil: Math.ceil((r.scheduledDate - now) / (24 * 60 * 60 * 1000)),
        scheduledFormatted: new Date(r.scheduledDate).toLocaleDateString('sv-SE'),
      }));
  }

  getOverdueMaintenance() {
    const now = Date.now();
    return this.maintenanceRecords
      .filter(r => !r.completed && r.scheduledDate <= now)
      .map(r => ({
        ...r,
        overdueDays: Math.ceil((now - r.scheduledDate) / (24 * 60 * 60 * 1000)),
        scheduledFormatted: new Date(r.scheduledDate).toLocaleDateString('sv-SE'),
      }));
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Internal Monitoring Loop
  // ═══════════════════════════════════════════════════════════════════

  _startMonitoringIntervals() {
    // Check UPS battery levels every 30 s
    const batteryCheck = setInterval(() => {
      try {
        this._checkBatteryLevels();
      } catch (err) {
        this.error('Batteriövervakningsfel:', err);
      }
    }, 30_000);
    this._intervals.push(batteryCheck);

    // Self-test evaluation every hour
    const testCheck = setInterval(() => {
      try {
        if (this.testSchedule.enabled && this.testSchedule.nextTestTime && Date.now() >= this.testSchedule.nextTestTime) {
          this.runSelfTest().catch(e => this.error('Schemalagt självtest misslyckades:', e));
        }
      } catch (err) {
        this.error('Självtest-schemafel:', err);
      }
    }, 60 * 60 * 1000);
    this._intervals.push(testCheck);

    // Maintenance reminder daily
    const maintCheck = setInterval(() => {
      try {
        this._checkMaintenanceReminders();
      } catch (err) {
        this.error('Underhållspåminnelsefel:', err);
      }
    }, 24 * 60 * 60 * 1000);
    this._intervals.push(maintCheck);
  }

  _checkBatteryLevels() {
    for (const [, ups] of this.upsDevices) {
      if (ups.status === 'on-battery') {
        // Simulate drain if on battery
        if (ups.currentLoadW > 0) {
          const drainPerSec = ups.currentLoadW / (ups.capacityWh * (ups.batteryHealthPct / 100) * 36);
          ups.batteryPct = Math.max(0, ups.batteryPct - drainPerSec * 30); // 30-s interval
        }
        ups.runtimeEstimateSec = this._estimateRuntime(ups);

        if (ups.batteryPct <= this.generator.startThresholdPct) {
          this._startGenerator();
        }

        if (ups.batteryPct <= 5) {
          this._notify(`🔴 UPS "${ups.name}" batteri kritiskt lågt (${ups.batteryPct.toFixed(1)} %)!`, 'critical');
        }
      }
    }
  }

  _checkMaintenanceReminders() {
    const overdue = this.getOverdueMaintenance();
    for (const m of overdue) {
      this._notify(`🔧 Underhåll försenat: "${m.upsName}" – ${m.type} (${m.overdueDays} dagar försenat).`, 'warning');
    }

    const upcoming = this.getUpcomingMaintenance().filter(m => m.daysUntil <= 7);
    for (const m of upcoming) {
      this._notify(`🔧 Underhåll snart: "${m.upsName}" – ${m.type} om ${m.daysUntil} dag(ar).`, 'info');
    }
  }

  _getLowestBatteryPct() {
    let lowest = 100;
    for (const [, ups] of this.upsDevices) {
      if (ups.batteryPct < lowest) lowest = ups.batteryPct;
    }
    return lowest;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Statistics & Helpers
  // ═══════════════════════════════════════════════════════════════════

  getStatistics() {
    return {
      ...this.stats,
      upsCount: this.upsDevices.size,
      gridOnline: this.gridStatus.online,
      gridVoltage: this.gridStatus.voltage,
      gridFrequency: this.gridStatus.frequency,
      outageActive: this.currentOutage !== null,
      generatorRunning: this.generator.running,
      totalPowerEvents: this.powerEvents.length,
      totalOutageHistory: this.outageHistory.length,
      pendingMaintenance: this.maintenanceRecords.filter(m => !m.completed).length,
      averageOutageDurationMs: this.stats.totalOutages > 0
        ? Math.round(this.stats.totalOutageDurationMs / this.stats.totalOutages)
        : 0,
      longestOutageFormatted: this._formatDuration(this.stats.longestOutageMs),
      consumptionBaseline: this.getConsumptionBaseline(),
    };
  }

  _formatDuration(ms) {
    if (!ms || ms <= 0) return '0s';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  log(...args) {
    if (this.homey && typeof this.homey.log === 'function') {
      this.homey.log('[PowerContinuityUPS]', ...args);
    } else {
      console.log('[PowerContinuityUPS]', ...args);
    }
  }

  error(...args) {
    if (this.homey && typeof this.homey.error === 'function') {
      this.homey.error('[PowerContinuityUPS]', ...args);
    } else {
      console.error('[PowerContinuityUPS]', ...args);
    }
  }
}

module.exports = PowerContinuityUPSSystem;
