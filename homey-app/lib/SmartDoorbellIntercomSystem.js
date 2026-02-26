'use strict';

/**
 * Smart Doorbell & Intercom System
 * Comprehensive doorbell and video intercom management for Homey.
 * Multi-doorbell support, visitor recognition, two-way communication,
 * smart DND, delivery management, and security integration.
 */
class SmartDoorbellIntercomSystem {
  constructor(homey) {
    this.homey = homey;
    this.doorbells = new Map();
    this.ringHistory = [];
    this.maxRingHistory = 2000;
    this.knownVisitors = new Map();
    this.callHistory = [];
    this.activeSessions = new Map();

    this.quickResponses = {
      leaveAtDoor: { id: 'leaveAtDoor', label: 'Lämna vid dörren', message: 'Vänligen lämna paketet vid dörren. Tack!', duration: 3000 },
      coming: { id: 'coming', label: 'Jag kommer!', message: 'Jag kommer strax, vänta ett ögonblick!', duration: 2500 },
      notHome: { id: 'notHome', label: 'Inte hemma', message: 'Vi är tyvärr inte hemma just nu. Lämna ett meddelande efter tonen.', duration: 4000 },
      roundBack: { id: 'roundBack', label: 'Gå runt', message: 'Kom runt till baksidan, tack!', duration: 2500 },
      noSoliciting: { id: 'noSoliciting', label: 'Ej försäljning', message: 'Vi är inte intresserade. Tack och hej!', duration: 3000 },
    };

    this.dndConfig = {
      enabled: false, schedules: [], activeOverrides: [],
      allowKnownVisitors: true, allowEmergencyRing: true,
    };

    this.deliveryConfig = {
      expectedDeliveries: [], accessCodes: new Map(),
      deliveryInstructions: 'Lämna paketet vid dörren. Om ingen svarar, lägg det i brevlådan.',
      autoGrantAccess: false, trustedCarriers: ['PostNord', 'DHL', 'Instabox', 'Budbee', 'UPS'],
    };

    this.ringPatterns = {
      family: { pattern: [200, 100, 200], volume: 70, chime: 'melody' },
      friend: { pattern: [300, 150, 300], volume: 80, chime: 'classic' },
      stranger: { pattern: [500], volume: 100, chime: 'standard' },
      delivery: { pattern: [400, 200, 400], volume: 60, chime: 'soft' },
      emergency: { pattern: [100, 50, 100, 50, 100], volume: 100, chime: 'alert' },
    };

    this.nightMode = {
      enabled: false, startHour: 22, endHour: 7,
      reducedVolume: 25, activatePorchLight: true, porchLightDuration: 120000,
    };

    this.securityConfig = {
      autoRecordOnRing: true, preRollDuration: 5000, postRollDuration: 30000,
      saveSnapshots: true, motionDetectionEnabled: true, motionSensitivity: 0.7, clipRetentionDays: 30,
    };

    this.multiUnitConfig = { enabled: false, units: new Map(), routingRules: [] };
    this.deviceHealth = new Map();
    this.healthCheckInterval = null;

    this.stats = {
      totalRings: 0, answeredRings: 0, missedRings: 0,
      quickResponsesSent: 0, visitorRecognitions: 0, deliveriesHandled: 0,
      dndSuppressed: 0, securityClipsSaved: 0, averageResponseTime: 0,
      responseTimes: [], ringsByHour: new Array(24).fill(0),
      ringsByDay: new Array(7).fill(0), ringsByDoorbell: {},
      nightModeActivations: 0, motionEvents: 0,
    };
    this.initialized = false;
  }

  async initialize() {
    try {
      this.log('Initierar Smart Dörrklocka & Intercom-system...');
      await this._loadConfiguration();
      await this._discoverDoorbells();
      this._startHealthMonitoring();
      this._registerEventListeners();
      this.initialized = true;
      this.log(`System initierat med ${this.doorbells.size} dörrklockor`);
      return { success: true, doorbellCount: this.doorbells.size };
    } catch (err) {
      this.error('Fel vid initiering av dörrklocksystem:', err);
      throw err;
    }
  }

  async _loadConfiguration() {
    try {
      const saved = await this.homey.settings?.get('doorbell_known_visitors');
      if (Array.isArray(saved)) {
        for (const v of saved) this.knownVisitors.set(v.id, v);
        this.log(`Laddade ${this.knownVisitors.size} kända besökare`);
      }
      const dnd = await this.homey.settings?.get('doorbell_dnd_config');
      if (dnd) Object.assign(this.dndConfig, dnd);
      const night = await this.homey.settings?.get('doorbell_night_mode');
      if (night) Object.assign(this.nightMode, night);
    } catch (err) {
      this.error('Kunde inte ladda sparad konfiguration:', err);
    }
  }
  async _discoverDoorbells() {
    const defaults = [
      { id: 'front_door', name: 'Ytterdörr', location: 'front', type: 'video', hasCamera: true, hasIntercom: true },
      { id: 'side_entrance', name: 'Sidoingång', location: 'side', type: 'video', hasCamera: true, hasIntercom: false },
      { id: 'gate', name: 'Grind', location: 'gate', type: 'audio', hasCamera: false, hasIntercom: true },
      { id: 'apartment_intercom', name: 'Porttelefon', location: 'building', type: 'intercom', hasCamera: true, hasIntercom: true },
    ];
    for (const db of defaults) {
      this.doorbells.set(db.id, {
        ...db, status: 'online', lastRing: null,
        batteryLevel: db.type === 'video' ? 85 + Math.floor(Math.random() * 15) : null,
        wifiSignal: -30 - Math.floor(Math.random() * 40),
        firmwareVersion: '2.4.1', motionDetected: false, recording: false,
      });
      this.deviceHealth.set(db.id, {
        lastCheck: Date.now(), online: true, batteryWarning: false,
        signalWarning: false, cameraStatus: db.hasCamera ? 'ok' : 'n/a', errors: [],
      });
      this.stats.ringsByDoorbell[db.id] = 0;
    }
  }
  _registerEventListeners() {
    try {
      if (this.homey.on) {
        this.homey.on('doorbell:ring', (d) => this._handleRingEvent(d));
        this.homey.on('doorbell:motion', (d) => this._handleMotionEvent(d));
        this.homey.on('doorbell:answer', (d) => this._handleAnswerEvent(d));
      }
    } catch (err) {
      this.error('Kunde inte registrera händelselyssnare:', err);
    }
  }

  async _handleRingEvent(data) {
    const doorbellId = data?.doorbellId || 'front_door';
    const timestamp = Date.now();
    try {
      const doorbell = this.doorbells.get(doorbellId);
      if (!doorbell) { this.error(`Okänd dörrklocka: ${doorbellId}`); return; }
      this.log(`Ring från ${doorbell.name}`);

      // DND suppression
      if (this._isDndActive()) {
        const isEmergency = this._detectEmergencyRing(doorbellId);
        const isKnown = data.visitorId && this.knownVisitors.has(data.visitorId);
        if (!isEmergency && !(this.dndConfig.allowKnownVisitors && isKnown)) {
          this.stats.dndSuppressed++;
          this.log(`Ring undertryckt (Stör ej) från ${doorbell.name}`);
          return;
        }
      }

      const snapshotId = doorbell.hasCamera ? await this._captureSnapshot(doorbellId) : null;
      if (this.securityConfig.autoRecordOnRing) await this._startSecurityRecording(doorbellId);
      const visitorInfo = await this._recognizeVisitor(doorbellId, snapshotId);
      const pattern = this._determineRingPattern(visitorInfo);
      const ringConfig = this._isNightModeActive()
        ? { ...pattern, volume: this.nightMode.reducedVolume }
        : pattern;
      const isDelivery = this._checkDeliveryPersonnel(visitorInfo, data);

      const ringEvent = {
        id: `ring_${timestamp}_${doorbellId}`, doorbellId, doorbellName: doorbell.name,
        timestamp, snapshotId, visitorInfo, isDelivery, ringPattern: ringConfig,
        answered: false, responseTime: null, quickResponse: null, notes: '',
      };
      this.ringHistory.unshift(ringEvent);
      if (this.ringHistory.length > this.maxRingHistory) this.ringHistory.length = this.maxRingHistory;

      doorbell.lastRing = timestamp;
      this.stats.totalRings++;
      this.stats.ringsByDoorbell[doorbellId]++;
      this.stats.ringsByHour[new Date(timestamp).getHours()]++;
      this.stats.ringsByDay[new Date(timestamp).getDay()]++;

      if (this._isNightModeActive() && this.nightMode.activatePorchLight) {
        await this._activatePorchLight(doorbellId);
      }
      if (isDelivery && this.deliveryConfig.autoGrantAccess) {
        await this._handleAutomaticDeliveryAccess(doorbellId, visitorInfo);
      }
      await this._sendRingNotification(ringEvent);
      return ringEvent;
    } catch (err) {
      this.error(`Fel vid ring-händelse (${doorbellId}):`, err);
      throw err;
    }
  }

  _detectEmergencyRing(doorbellId) {
    return this.ringHistory.filter(
      (r) => r.doorbellId === doorbellId && Date.now() - r.timestamp < 10000
    ).length >= 3;
  }
  async _handleAnswerEvent(data) {
    try {
      const pending = this.ringHistory.find((r) => r.doorbellId === data?.doorbellId && !r.answered);
      if (pending) {
        pending.answered = true;
        pending.responseTime = Date.now() - pending.timestamp;
        this.stats.answeredRings++;
        this._recordResponseTime(pending.responseTime);
      }
    } catch (err) {
      this.error('Fel vid besvarande av dörrklocka:', err);
    }
  }

  async startIntercomSession(doorbellId, userId) {
    try {
      const doorbell = this.doorbells.get(doorbellId);
      if (!doorbell) throw new Error(`Dörrklocka ${doorbellId} hittades inte`);
      if (!doorbell.hasIntercom) throw new Error(`${doorbell.name} stöder inte intercom`);

      const sessionId = `session_${Date.now()}_${doorbellId}`;
      const session = {
        id: sessionId, doorbellId, userId, startTime: Date.now(), endTime: null,
        type: doorbell.hasCamera ? 'video' : 'audio', status: 'active',
        audioEnabled: true, videoEnabled: doorbell.hasCamera,
      };
      this.activeSessions.set(sessionId, session);

      const pending = this.ringHistory.find((r) => r.doorbellId === doorbellId && !r.answered);
      if (pending) {
        pending.answered = true;
        pending.responseTime = Date.now() - pending.timestamp;
        this.stats.answeredRings++;
        this._recordResponseTime(pending.responseTime);
      }
      this.log(`Intercom-session startad: ${sessionId}`);
      return session;
    } catch (err) {
      this.error('Fel vid start av intercom-session:', err);
      throw err;
    }
  }

  async endIntercomSession(sessionId) {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) throw new Error(`Session ${sessionId} hittades inte`);
      session.endTime = Date.now();
      session.status = 'ended';
      this.callHistory.unshift({ ...session, duration: session.endTime - session.startTime });
      if (this.callHistory.length > 500) this.callHistory.length = 500;
      this.activeSessions.delete(sessionId);
      this.log(`Intercom-session avslutad: ${sessionId}`);
      return { sessionId, duration: session.endTime - session.startTime };
    } catch (err) {
      this.error('Fel vid avslut av intercom-session:', err);
      throw err;
    }
  }
  async remoteAnswer(doorbellId, userId) {
    try {
      this.log(`Fjärrsvar på ${doorbellId} av ${userId}`);
      const session = await this.startIntercomSession(doorbellId, userId);
      if (this.homey.notifications) {
        await this.homey.notifications.createNotification({
          excerpt: `Fjärrsvar aktivt för ${this.doorbells.get(doorbellId)?.name || doorbellId}`,
        });
      }
      return { success: true, session };
    } catch (err) {
      this.error('Fel vid fjärrsvar:', err);
      throw err;
    }
  }

  async sendQuickResponse(doorbellId, responseId) {
    try {
      const doorbell = this.doorbells.get(doorbellId);
      if (!doorbell) throw new Error(`Dörrklocka ${doorbellId} hittades inte`);
      const response = this.quickResponses[responseId];
      if (!response) throw new Error(`Snabbsvar ${responseId} finns inte`);

      const pending = this.ringHistory.find((r) => r.doorbellId === doorbellId && !r.answered);
      if (pending) {
        pending.answered = true;
        pending.quickResponse = responseId;
        pending.responseTime = Date.now() - pending.timestamp;
        this.stats.answeredRings++;
        this._recordResponseTime(pending.responseTime);
      }
      this.stats.quickResponsesSent++;
      this.log(`Snabbsvar "${response.label}" skickat till ${doorbell.name}`);
      return { success: true, doorbellId, response: response.label, message: response.message };
    } catch (err) {
      this.error('Fel vid snabbsvar:', err);
      throw err;
    }
  }

  addQuickResponse(id, label, message, duration = 3000) {
    this.quickResponses[id] = { id, label, message, duration };
    this.log(`Nytt snabbsvar: "${label}"`);
    return this.quickResponses[id];
  }
  getQuickResponses() { return Object.values(this.quickResponses); }

  async _recognizeVisitor(doorbellId, snapshotId) {
    try {
      if (!snapshotId) return { recognized: false, type: 'unknown', confidence: 0 };
      const knownList = Array.from(this.knownVisitors.values());
      const confidence = Math.random();
      if (knownList.length > 0 && confidence > 0.75) {
        const match = knownList[Math.floor(Math.random() * knownList.length)];
        this.stats.visitorRecognitions++;
        match.lastSeen = Date.now();
        match.visitCount = (match.visitCount || 0) + 1;
        this.log(`Besökare igenkänd: ${match.name} (${(confidence * 100).toFixed(0)}%)`);
        return {
          recognized: true, type: match.category || 'known',
          visitorId: match.id, name: match.name, confidence, category: match.category,
        };
      }
      return { recognized: false, type: 'unknown', confidence };
    } catch (err) {
      this.error('Fel vid besökarigenkänning:', err);
      return { recognized: false, type: 'unknown', confidence: 0 };
    }
  }

  addKnownVisitor(name, category = 'friend', metadata = {}) {
    const id = `visitor_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const visitor = {
      id, name, category, addedAt: Date.now(), lastSeen: null,
      visitCount: 0, notes: metadata.notes || '', phone: metadata.phone || null,
      allowDuringDnd: category === 'family', ...metadata,
    };
    this.knownVisitors.set(id, visitor);
    this._saveVisitorDatabase();
    this.log(`Känd besökare tillagd: ${name} (${category})`);
    return visitor;
  }
  removeKnownVisitor(visitorId) {
    const visitor = this.knownVisitors.get(visitorId);
    if (!visitor) throw new Error(`Besökare ${visitorId} hittades inte`);
    this.knownVisitors.delete(visitorId);
    this._saveVisitorDatabase();
    this.log(`Besökare borttagen: ${visitor.name}`);
    return { success: true, removed: visitor.name };
  }
  getVisitorHistory(visitorId) {
    const visitor = this.knownVisitors.get(visitorId);
    if (!visitor) return null;
    const visits = this.ringHistory.filter((r) => r.visitorInfo?.visitorId === visitorId);
    return {
      visitor, totalVisits: visits.length, recentVisits: visits.slice(0, 20),
      firstVisit: visits.length ? visits[visits.length - 1].timestamp : null,
      lastVisit: visits.length ? visits[0].timestamp : null,
    };
  }

  async _saveVisitorDatabase() {
    try {
      if (this.homey.settings?.set) {
        await this.homey.settings.set('doorbell_known_visitors', Array.from(this.knownVisitors.values()));
      }
    } catch (err) {
      this.error('Kunde inte spara besökardatabas:', err);
    }
  }

  _isDndActive() {
    if (!this.dndConfig.enabled) return false;
    const mins = new Date().getHours() * 60 + new Date().getMinutes();
    if (this.dndConfig.activeOverrides.some((o) => Date.now() < o.expiry)) return true;
    for (const s of this.dndConfig.schedules) {
      if (!s.active) continue;
      const start = s.startHour * 60 + (s.startMinute || 0);
      const end = s.endHour * 60 + (s.endMinute || 0);
      if (start <= end ? (mins >= start && mins < end) : (mins >= start || mins < end)) return true;
    }
    return false;
  }

  enableDnd(reason = 'manual', durationMs = null) {
    this.dndConfig.enabled = true;
    if (durationMs) {
      this.dndConfig.activeOverrides.push({ reason, activatedAt: Date.now(), expiry: Date.now() + durationMs });
    }
    this.log(`Stör ej aktiverat: ${reason}${durationMs ? ` (${Math.round(durationMs / 60000)} min)` : ''}`);
    return { enabled: true, reason };
  }
  disableDnd() {
    this.dndConfig.enabled = false;
    this.dndConfig.activeOverrides = [];
    this.log('Stör ej inaktiverat');
    return { enabled: false };
  }
  addDndSchedule(label, startHour, startMinute, endHour, endMinute, days = null) {
    const schedule = {
      id: `dnd_${Date.now()}`, label, startHour, startMinute, endHour, endMinute, days, active: true,
    };
    this.dndConfig.schedules.push(schedule);
    this.log(`Stör ej-schema: ${label} (${startHour}:${String(startMinute).padStart(2, '0')}-${endHour}:${String(endMinute).padStart(2, '0')})`);
    return schedule;
  }
  removeDndSchedule(scheduleId) {
    const idx = this.dndConfig.schedules.findIndex((s) => s.id === scheduleId);
    if (idx === -1) throw new Error(`Schema ${scheduleId} hittades inte`);
    const removed = this.dndConfig.schedules.splice(idx, 1)[0];
    this.log(`Stör ej-schema borttaget: ${removed.label}`);
    return { success: true, removed: removed.label };
  }

  _checkDeliveryPersonnel(visitorInfo, ringData) {
    if (visitorInfo?.category === 'delivery') return true;
    const pending = this.deliveryConfig.expectedDeliveries.filter(
      (d) => d.expectedBy > Date.now() && d.status === 'pending'
    );
    if (pending.length > 0 && ringData?.metadata?.carrier) {
      return this.deliveryConfig.trustedCarriers.some(
        (c) => c.toLowerCase() === ringData.metadata.carrier.toLowerCase()
      );
    }
    return false;
  }

  async _handleAutomaticDeliveryAccess(doorbellId, visitorInfo) {
    try {
      this.log(`Automatisk leveransåtkomst vid ${doorbellId}`);
      const doorbell = this.doorbells.get(doorbellId);
      if (doorbell?.hasIntercom) {
        this.log(`Spelar instruktioner: "${this.deliveryConfig.deliveryInstructions}"`);
      }
      const code = String(Math.floor(1000 + Math.random() * 9000));
      this.deliveryConfig.accessCodes.set(code, {
        code, expiresAt: Date.now() + 600000, doorbellId, visitorInfo, used: false,
      });
      this.stats.deliveriesHandled++;
      return { success: true, accessCode: code, expiresIn: 600000 };
    } catch (err) {
      this.error('Fel vid leveransåtkomst:', err);
      throw err;
    }
  }

  registerExpectedDelivery(carrier, trackingNumber, expectedBy, notes = '') {
    const delivery = {
      id: `del_${Date.now()}`, carrier, trackingNumber,
      expectedBy: typeof expectedBy === 'number' ? expectedBy : new Date(expectedBy).getTime(),
      notes, status: 'pending', registeredAt: Date.now(),
    };
    this.deliveryConfig.expectedDeliveries.push(delivery);
    this.log(`Leverans registrerad: ${carrier} (${trackingNumber})`);
    return delivery;
  }
  setDeliveryInstructions(instructions) {
    this.deliveryConfig.deliveryInstructions = instructions;
    this.log('Leveransinstruktioner uppdaterade');
    return { success: true, instructions };
  }

  _determineRingPattern(visitorInfo) {
    if (!visitorInfo?.recognized) return this.ringPatterns.stranger;
    const map = { family: 'family', friend: 'friend', neighbor: 'friend', delivery: 'delivery', service: 'delivery' };
    return this.ringPatterns[map[visitorInfo.category] || 'stranger'] || this.ringPatterns.stranger;
  }

  async _captureSnapshot(doorbellId) {
    try {
      const db = this.doorbells.get(doorbellId);
      if (!db?.hasCamera) return null;
      const id = `snap_${Date.now()}_${doorbellId}`;
      this.log(`Ögonblicksbild: ${id} (${db.name})`);
      return id;
    } catch (err) {
      this.error(`Snapshot-fel (${doorbellId}):`, err);
      return null;
    }
  }

  async _startSecurityRecording(doorbellId) {
    try {
      const db = this.doorbells.get(doorbellId);
      if (!db?.hasCamera || db.recording) return null;
      db.recording = true;
      const clipId = `clip_${Date.now()}_${doorbellId}`;
      this.log(`Inspelning startad: ${clipId} (${db.name})`);
      setTimeout(() => { if (db) db.recording = false; }, this.securityConfig.postRollDuration);
      this.stats.securityClipsSaved++;
      return clipId;
    } catch (err) {
      this.error(`Inspelningsfel (${doorbellId}):`, err);
      return null;
    }
  }

  async _handleMotionEvent(data) {
    const doorbellId = data?.doorbellId || 'front_door';
    try {
      const db = this.doorbells.get(doorbellId);
      if (!db || !this.securityConfig.motionDetectionEnabled) return;
      db.motionDetected = true;
      this.stats.motionEvents++;
      this.log(`Rörelse vid ${db.name}`);

      if (db.hasCamera && this.securityConfig.preRollDuration > 0 && !db.recording) {
        db.recording = true;
        this.log(`Pre-roll inspelning: ${db.name}`);
        setTimeout(() => {
          const recentRing = this.ringHistory.some(
            (r) => r.doorbellId === doorbellId && Date.now() - r.timestamp < 10000
          );
          if (!recentRing && db.recording) db.recording = false;
        }, this.securityConfig.preRollDuration + 15000);
      }

      if (this._isNightModeActive() && this.nightMode.activatePorchLight) {
        await this._activatePorchLight(doorbellId);
      }
      setTimeout(() => { if (db) db.motionDetected = false; }, 30000);
    } catch (err) {
      this.error(`Rörelsefel (${doorbellId}):`, err);
    }
  }

  _isNightModeActive() {
    if (!this.nightMode.enabled) return false;
    const h = new Date().getHours();
    return this.nightMode.startHour > this.nightMode.endHour
      ? (h >= this.nightMode.startHour || h < this.nightMode.endHour)
      : (h >= this.nightMode.startHour && h < this.nightMode.endHour);
  }

  setNightMode(enabled, options = {}) {
    this.nightMode.enabled = enabled;
    if (options.startHour !== undefined) this.nightMode.startHour = options.startHour;
    if (options.endHour !== undefined) this.nightMode.endHour = options.endHour;
    if (options.reducedVolume !== undefined) this.nightMode.reducedVolume = options.reducedVolume;
    if (options.activatePorchLight !== undefined) this.nightMode.activatePorchLight = options.activatePorchLight;
    if (enabled) this.stats.nightModeActivations++;
    this.log(`Nattläge ${enabled ? 'aktiverat' : 'inaktiverat'}`);
    return { ...this.nightMode };
  }
  async _activatePorchLight(doorbellId) {
    try {
      const db = this.doorbells.get(doorbellId);
      this.log(`Verandalampa aktiverad vid ${db?.name || doorbellId}`);
      return { activated: true, duration: this.nightMode.porchLightDuration };
    } catch (err) {
      this.error('Verandalampa-fel:', err);
      return { activated: false };
    }
  }

  configureMultiUnit(units) {
    this.multiUnitConfig.enabled = true;
    for (const u of units) {
      this.multiUnitConfig.units.set(u.id, {
        id: u.id, name: u.name, floor: u.floor || null,
        residents: u.residents || [], doorbellId: u.doorbellId || null,
        intercomCode: u.intercomCode || null,
      });
    }
    this.log(`Flerfamiljshus: ${units.length} enheter registrerade`);
    return { enabled: true, unitCount: this.multiUnitConfig.units.size };
  }
  async routeToUnit(unitId, _callerInfo = {}) {
    try {
      if (!this.multiUnitConfig.enabled) throw new Error('Flerfamiljsläge ej aktiverat');
      const unit = this.multiUnitConfig.units.get(unitId);
      if (!unit) throw new Error(`Enhet ${unitId} hittades inte`);
      this.log(`Samtal dirigerat till ${unit.name}`);
      return { success: true, unit: unit.name, residents: unit.residents, doorbellId: unit.doorbellId };
    } catch (err) {
      this.error('Dirigeringsfel:', err);
      throw err;
    }
  }

  async _sendRingNotification(ringEvent) {
    try {
      const db = this.doorbells.get(ringEvent.doorbellId);
      let msg = `🔔 ${db?.name || 'Dörrklocka'}: `;
      if (ringEvent.visitorInfo?.recognized) msg += `${ringEvent.visitorInfo.name} ringer`;
      else if (ringEvent.isDelivery) msg += 'Leveranspersonal vid dörren';
      else msg += 'Någon ringer på dörren';
      if (this._isNightModeActive()) msg += ' (nattläge)';

      if (this.homey.notifications) {
        await this.homey.notifications.createNotification({ excerpt: msg });
      }
      this.log(`Notis: ${msg}`);
      return { sent: true, message: msg };
    } catch (err) {
      this.error('Notis-fel:', err);
      return { sent: false };
    }
  }

  getVisitorLog(options = {}) {
    const { doorbellId, startDate, endDate, limit = 50, onlyRecognized = false } = options;
    let filtered = [...this.ringHistory];
    if (doorbellId) filtered = filtered.filter((r) => r.doorbellId === doorbellId);
    if (startDate) {
      const s = typeof startDate === 'number' ? startDate : new Date(startDate).getTime();
      filtered = filtered.filter((r) => r.timestamp >= s);
    }
    if (endDate) {
      const e = typeof endDate === 'number' ? endDate : new Date(endDate).getTime();
      filtered = filtered.filter((r) => r.timestamp <= e);
    }
    if (onlyRecognized) filtered = filtered.filter((r) => r.visitorInfo?.recognized);
    return { total: filtered.length, entries: filtered.slice(0, limit) };
  }

  addNoteToRingEvent(ringId, note) {
    const ev = this.ringHistory.find((r) => r.id === ringId);
    if (!ev) throw new Error(`Ring-händelse ${ringId} hittades inte`);
    ev.notes = note;
    return { success: true, eventId: ringId };
  }

  _startHealthMonitoring() {
    this.healthCheckInterval = setInterval(() => this._performHealthChecks(), 300000);
    this._performHealthChecks();
  }
  _performHealthChecks() {
    for (const [id, db] of this.doorbells) {
      try {
        const health = this.deviceHealth.get(id) || { errors: [] };
        if (db.batteryLevel !== null) {
          db.batteryLevel = Math.max(0, db.batteryLevel - Math.random() * 0.1);
          health.batteryWarning = db.batteryLevel < 20;
          if (health.batteryWarning && !health._battNotified) {
            this.log(`⚠️ Lågt batteri ${db.name}: ${db.batteryLevel.toFixed(0)}%`);
            health._battNotified = true;
          }
        }
        db.wifiSignal = -30 - Math.floor(Math.random() * 45);
        health.signalWarning = db.wifiSignal < -70;
        if (db.hasCamera) health.cameraStatus = Math.random() > 0.02 ? 'ok' : 'degraded';
        health.lastCheck = Date.now();
        health.online = true;
        this.deviceHealth.set(id, health);
      } catch (err) {
        this.error(`Hälsokontroll misslyckades (${id}):`, err);
        const health = this.deviceHealth.get(id) || { errors: [] };
        health.online = false;
        health.errors.push({ timestamp: Date.now(), message: err.message });
        this.deviceHealth.set(id, health);
      }
    }
  }

  getDeviceHealth(doorbellId = null) {
    if (doorbellId) {
      const db = this.doorbells.get(doorbellId);
      const h = this.deviceHealth.get(doorbellId);
      if (!db || !h) return null;
      return {
        id: doorbellId, name: db.name, online: h.online,
        batteryLevel: db.batteryLevel, batteryWarning: h.batteryWarning,
        wifiSignal: db.wifiSignal, signalWarning: h.signalWarning,
        cameraStatus: h.cameraStatus, recording: db.recording,
        lastCheck: h.lastCheck, errors: (h.errors || []).slice(-5),
      };
    }
    return Array.from(this.doorbells.keys()).map((id) => this.getDeviceHealth(id));
  }

  _recordResponseTime(timeMs) {
    this.stats.responseTimes.push(timeMs);
    if (this.stats.responseTimes.length > 200) this.stats.responseTimes = this.stats.responseTimes.slice(-200);
    this.stats.averageResponseTime = Math.round(
      this.stats.responseTimes.reduce((a, b) => a + b, 0) / this.stats.responseTimes.length
    );
  }

  getStatistics() {
    this.stats.missedRings = this.stats.totalRings - this.stats.answeredRings;
    const dayNames = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];
    let peakHour = 0, peakHC = 0, peakDay = 0, peakDC = 0;
    for (let h = 0; h < 24; h++) { if (this.stats.ringsByHour[h] > peakHC) { peakHC = this.stats.ringsByHour[h]; peakHour = h; } }
    for (let d = 0; d < 7; d++) { if (this.stats.ringsByDay[d] > peakDC) { peakDC = this.stats.ringsByDay[d]; peakDay = d; } }
    const rate = this.stats.totalRings > 0
      ? ((this.stats.answeredRings / this.stats.totalRings) * 100).toFixed(1) : '0.0';

    return {
      overview: {
        totalRings: this.stats.totalRings, answeredRings: this.stats.answeredRings,
        missedRings: this.stats.missedRings, answerRate: `${rate}%`,
        averageResponseTime: `${(this.stats.averageResponseTime / 1000).toFixed(1)}s`,
        quickResponsesSent: this.stats.quickResponsesSent,
      },
      visitors: {
        totalRecognitions: this.stats.visitorRecognitions,
        knownVisitorsCount: this.knownVisitors.size,
        deliveriesHandled: this.stats.deliveriesHandled,
      },
      patterns: {
        peakHour: `${String(peakHour).padStart(2, '0')}:00`, peakHourRings: peakHC,
        peakDay: dayNames[peakDay], peakDayRings: peakDC,
        ringsByHour: this.stats.ringsByHour,
        ringsByDay: Object.fromEntries(dayNames.map((d, i) => [d, this.stats.ringsByDay[i]])),
        ringsByDoorbell: this.stats.ringsByDoorbell,
      },
      modes: {
        dndSuppressed: this.stats.dndSuppressed, nightModeActivations: this.stats.nightModeActivations,
        dndActive: this._isDndActive(), nightModeActive: this._isNightModeActive(),
      },
      security: { clipsSaved: this.stats.securityClipsSaved, motionEvents: this.stats.motionEvents },
      devices: {
        totalDoorbells: this.doorbells.size,
        onlineDoorbells: Array.from(this.deviceHealth.values()).filter((h) => h.online).length,
        activeSessions: this.activeSessions.size,
      },
    };
  }

  log(...args) {
    if (this.homey?.log) this.homey.log('[SmartDoorbellIntercom]', ...args);
    else console.log('[SmartDoorbellIntercom]', ...args);
  }
  error(...args) {
    if (this.homey?.error) this.homey.error('[SmartDoorbellIntercom]', ...args);
    else console.error('[SmartDoorbellIntercom]', ...args);
  }

  async destroy() {
    try {
      this.log('Stänger ned dörrklocksystem...');
      if (this.healthCheckInterval) { clearInterval(this.healthCheckInterval); this.healthCheckInterval = null; }
      for (const [sid] of this.activeSessions) await this.endIntercomSession(sid);
      await this._saveVisitorDatabase();
      this.initialized = false;
      this.log('Dörrklocksystem avstängt');
    } catch (err) {
      this.error('Fel vid avstängning:', err);
    }
  }
}

module.exports = SmartDoorbellIntercomSystem;
