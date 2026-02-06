'use strict';

/**
 * VisitorGuestManagementSystem
 * 
 * Comprehensive visitor and guest management for smart homes.
 * Handles guest profiles, visit scheduling, temporary access credentials,
 * welcome automations, rental/Airbnb mode, service provider access,
 * visit history tracking, and checkout automation.
 */

const crypto = require('crypto');

class VisitorGuestManagementSystem {

  constructor(homey) {
    this.homey = homey;

    // Guest profiles keyed by guestId
    this.guestProfiles = new Map();

    // Scheduled visits keyed by visitId
    this.scheduledVisits = new Map();

    // Active temporary access codes keyed by codeId
    this.temporaryAccessCodes = new Map();

    // Visit history (completed visits)
    this.visitHistory = [];

    // Guest preferences keyed by guestId
    this.guestPreferences = new Map();

    // Active guest WiFi sessions keyed by sessionId
    this.guestWifiSessions = new Map();

    // Service provider profiles keyed by providerId
    this.serviceProviders = new Map();

    // Rental / Airbnb bookings keyed by bookingId
    this.rentalBookings = new Map();

    // Emergency contacts keyed by guestId
    this.emergencyContacts = new Map();

    // House rules configuration
    this.houseRules = {
      wifiPassword: null,
      parkingInfo: '',
      quietHours: { start: '22:00', end: '07:00' },
      trashCollection: '',
      specialInstructions: '',
      customRules: []
    };

    // Multi-zone access definitions keyed by zoneId
    this.zoneDefinitions = new Map();

    // Guest zone access grants: Map<guestId, Set<zoneId>>
    this.guestZoneAccess = new Map();

    // Welcome automations keyed by guestId
    this.welcomeAutomations = new Map();

    // Pre-arrival task templates
    this.preArrivalTasks = new Map();

    // Checkout automation settings
    this.checkoutDefaults = {
      resetTemperature: 20,
      turnOffLights: true,
      lockAllDoors: true,
      disableGuestWifi: true,
      revokeAccessCodes: true,
      runCleaningScene: false
    };

    // Analytics accumulators
    this.analytics = {
      totalVisits: 0,
      totalDurationMinutes: 0,
      visitsByHour: new Array(24).fill(0),
      visitsByDayOfWeek: new Array(7).fill(0),
      visitsPerGuest: new Map(),
      monthlyVisits: new Map()
    };

    // Timers and intervals
    this._timers = [];
    this._initialized = false;
  }

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------

  async initialize() {
    try {
      this.log('Initierar Besöks- och Gästhanteringssystem...');

      await this._loadPersistedState();
      this._startScheduleWatcher();
      this._startAccessCodeExpiryWatcher();
      this._startWifiSessionExpiryWatcher();

      this._initialized = true;
      this.log('Besöks- och Gästhanteringssystem initierat');
    } catch (err) {
      this.error('Fel vid initiering av Besöks- och Gästhanteringssystem', err);
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // 1. Guest Profiles
  // ---------------------------------------------------------------------------

  createGuestProfile({ name, photo = null, phone = null, email = null, relationship = 'other', notes = '' }) {
    try {
      if (!name || typeof name !== 'string') {
        throw new Error('Gästnamn krävs');
      }

      const guestId = this._generateId('guest');
      const profile = {
        guestId,
        name: name.trim(),
        photo,
        phone,
        email,
        relationship,
        notes,
        visitFrequency: 0,
        lastVisit: null,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      this.guestProfiles.set(guestId, profile);
      this.guestPreferences.set(guestId, {});
      this.guestZoneAccess.set(guestId, new Set());
      this.analytics.visitsPerGuest.set(guestId, 0);

      this.log(`Gästprofil skapad: ${name} (${guestId})`);
      this._emitEvent('guest_profile_created', { guestId, name });
      return profile;
    } catch (err) {
      this.error('Fel vid skapande av gästprofil', err);
      throw err;
    }
  }

  updateGuestProfile(guestId, updates) {
    try {
      const profile = this._getProfileOrThrow(guestId);
      const allowed = ['name', 'photo', 'phone', 'email', 'relationship', 'notes'];
      for (const key of allowed) {
        if (updates[key] !== undefined) {
          profile[key] = updates[key];
        }
      }
      profile.updatedAt = Date.now();
      this.log(`Gästprofil uppdaterad: ${profile.name}`);
      return profile;
    } catch (err) {
      this.error('Fel vid uppdatering av gästprofil', err);
      throw err;
    }
  }

  deleteGuestProfile(guestId) {
    try {
      const profile = this._getProfileOrThrow(guestId);
      this.guestProfiles.delete(guestId);
      this.guestPreferences.delete(guestId);
      this.guestZoneAccess.delete(guestId);
      this.welcomeAutomations.delete(guestId);
      this.emergencyContacts.delete(guestId);
      this.log(`Gästprofil borttagen: ${profile.name}`);
      this._emitEvent('guest_profile_deleted', { guestId, name: profile.name });
      return true;
    } catch (err) {
      this.error('Fel vid borttagning av gästprofil', err);
      throw err;
    }
  }

  getGuestProfile(guestId) {
    return this.guestProfiles.get(guestId) || null;
  }

  listGuestProfiles(filter = {}) {
    let guests = Array.from(this.guestProfiles.values());
    if (filter.relationship) {
      guests = guests.filter(g => g.relationship === filter.relationship);
    }
    if (filter.search) {
      const q = filter.search.toLowerCase();
      guests = guests.filter(g => g.name.toLowerCase().includes(q));
    }
    return guests.sort((a, b) => a.name.localeCompare(b.name, 'sv'));
  }

  // ---------------------------------------------------------------------------
  // 2. Visit Scheduling
  // ---------------------------------------------------------------------------

  scheduleVisit({ guestId, startTime, endTime, purpose = '', notes = '', autoWelcome = true }) {
    try {
      this._getProfileOrThrow(guestId);

      if (!startTime || !endTime) {
        throw new Error('Start- och sluttid krävs för besöksbokning');
      }

      const start = new Date(startTime).getTime();
      const end = new Date(endTime).getTime();
      if (isNaN(start) || isNaN(end) || end <= start) {
        throw new Error('Ogiltigt tidsintervall för besök');
      }

      const visitId = this._generateId('visit');
      const visit = {
        visitId,
        guestId,
        startTime: start,
        endTime: end,
        purpose,
        notes,
        autoWelcome,
        status: 'scheduled',
        arrivedAt: null,
        departedAt: null,
        createdAt: Date.now()
      };

      this.scheduledVisits.set(visitId, visit);
      const profile = this.guestProfiles.get(guestId);
      this.log(`Besök schemalagt: ${profile.name} ${new Date(start).toLocaleString('sv-SE')} – ${new Date(end).toLocaleString('sv-SE')}`);
      this._emitEvent('visit_scheduled', { visitId, guestId, startTime: start, endTime: end });
      this._notifyHomeowner('visit_scheduled', `Besök schemalagt: ${profile.name} förväntas ${new Date(start).toLocaleString('sv-SE')}`);
      return visit;
    } catch (err) {
      this.error('Fel vid schemaläggning av besök', err);
      throw err;
    }
  }

  cancelVisit(visitId) {
    try {
      const visit = this.scheduledVisits.get(visitId);
      if (!visit) throw new Error(`Besök ${visitId} hittades inte`);

      visit.status = 'cancelled';
      this.scheduledVisits.delete(visitId);
      this._revokeVisitAccessCodes(visitId);

      const profile = this.guestProfiles.get(visit.guestId);
      this.log(`Besök avbokat: ${profile ? profile.name : visit.guestId}`);
      this._emitEvent('visit_cancelled', { visitId });
      return true;
    } catch (err) {
      this.error('Fel vid avbokning av besök', err);
      throw err;
    }
  }

  registerArrival(visitId) {
    try {
      const visit = this.scheduledVisits.get(visitId);
      if (!visit) throw new Error(`Besök ${visitId} hittades inte`);

      visit.status = 'in_progress';
      visit.arrivedAt = Date.now();

      const profile = this.guestProfiles.get(visit.guestId);
      if (profile) {
        profile.visitFrequency += 1;
        profile.lastVisit = Date.now();
      }

      if (visit.autoWelcome) {
        this._triggerWelcomeAutomation(visit.guestId);
      }

      this._recordAnalyticsArrival(visit);
      this.log(`Ankomst registrerad: ${profile ? profile.name : visit.guestId}`);
      this._notifyHomeowner('guest_arrived', `${profile ? profile.name : 'Gäst'} har anlänt`);
      this._emitEvent('guest_arrived', { visitId, guestId: visit.guestId });
      return visit;
    } catch (err) {
      this.error('Fel vid registrering av ankomst', err);
      throw err;
    }
  }

  registerDeparture(visitId) {
    try {
      const visit = this.scheduledVisits.get(visitId);
      if (!visit) throw new Error(`Besök ${visitId} hittades inte`);

      visit.status = 'completed';
      visit.departedAt = Date.now();

      this._revokeVisitAccessCodes(visitId);
      this._recordAnalyticsDeparture(visit);

      this.visitHistory.push({ ...visit });
      this.scheduledVisits.delete(visitId);

      const profile = this.guestProfiles.get(visit.guestId);
      this.log(`Avresa registrerad: ${profile ? profile.name : visit.guestId}`);
      this._notifyHomeowner('guest_departed', `${profile ? profile.name : 'Gäst'} har lämnat`);
      this._emitEvent('guest_departed', { visitId, guestId: visit.guestId });
      return visit;
    } catch (err) {
      this.error('Fel vid registrering av avresa', err);
      throw err;
    }
  }

  getUpcomingVisits(hoursAhead = 24) {
    const now = Date.now();
    const cutoff = now + hoursAhead * 3600000;
    return Array.from(this.scheduledVisits.values())
      .filter(v => v.status === 'scheduled' && v.startTime >= now && v.startTime <= cutoff)
      .sort((a, b) => a.startTime - b.startTime);
  }

  // ---------------------------------------------------------------------------
  // 3. Temporary Access Codes
  // ---------------------------------------------------------------------------

  generateTemporaryAccessCode({ guestId, visitId = null, target = 'lock', validFrom = Date.now(), validUntil, label = '' }) {
    try {
      this._getProfileOrThrow(guestId);

      if (!validUntil) {
        throw new Error('Utgångstid krävs för temporär åtkomstkod');
      }

      const code = this._generateAccessCode(6);
      const codeId = this._generateId('code');

      const entry = {
        codeId,
        guestId,
        visitId,
        target,
        code,
        validFrom,
        validUntil: new Date(validUntil).getTime(),
        label,
        used: false,
        usageCount: 0,
        revoked: false,
        createdAt: Date.now()
      };

      this.temporaryAccessCodes.set(codeId, entry);
      const profile = this.guestProfiles.get(guestId);
      this.log(`Temporär åtkomstkod genererad för ${profile.name}: ${target} (giltig till ${new Date(entry.validUntil).toLocaleString('sv-SE')})`);
      this._emitEvent('access_code_created', { codeId, guestId, target });
      return entry;
    } catch (err) {
      this.error('Fel vid generering av temporär åtkomstkod', err);
      throw err;
    }
  }

  validateAccessCode(code) {
    try {
      const now = Date.now();
      for (const entry of this.temporaryAccessCodes.values()) {
        if (entry.code === code && !entry.revoked && now >= entry.validFrom && now <= entry.validUntil) {
          entry.used = true;
          entry.usageCount += 1;
          this.log(`Åtkomstkod validerad: ${entry.codeId} (${entry.target})`);
          this._emitEvent('access_code_used', { codeId: entry.codeId, guestId: entry.guestId });
          return { valid: true, entry };
        }
      }
      this.log('Ogiltig eller utgången åtkomstkod använd');
      return { valid: false, entry: null };
    } catch (err) {
      this.error('Fel vid validering av åtkomstkod', err);
      return { valid: false, entry: null };
    }
  }

  revokeAccessCode(codeId) {
    try {
      const entry = this.temporaryAccessCodes.get(codeId);
      if (!entry) throw new Error(`Åtkomstkod ${codeId} hittades inte`);

      entry.revoked = true;
      this.log(`Åtkomstkod återkallad: ${codeId}`);
      this._emitEvent('access_code_revoked', { codeId, guestId: entry.guestId });
      return true;
    } catch (err) {
      this.error('Fel vid återkallande av åtkomstkod', err);
      throw err;
    }
  }

  listAccessCodesForGuest(guestId) {
    return Array.from(this.temporaryAccessCodes.values())
      .filter(e => e.guestId === guestId && !e.revoked);
  }

  // ---------------------------------------------------------------------------
  // 4. WiFi Guest Network
  // ---------------------------------------------------------------------------

  activateGuestWifi({ guestId, durationMinutes = 480, customPassword = null, bandwidthLimitMbps = 50 }) {
    try {
      this._getProfileOrThrow(guestId);
      const password = customPassword || this._generateAccessCode(8);
      const sessionId = this._generateId('wifi');

      const session = {
        sessionId,
        guestId,
        password,
        bandwidthLimitMbps,
        activatedAt: Date.now(),
        expiresAt: Date.now() + durationMinutes * 60000,
        active: true
      };

      this.guestWifiSessions.set(sessionId, session);

      const profile = this.guestProfiles.get(guestId);
      this.log(`Gäst-WiFi aktiverat för ${profile.name}, giltigt i ${durationMinutes} min`);
      this._emitEvent('guest_wifi_activated', { sessionId, guestId });
      this._notifyHomeowner('guest_wifi', `Gäst-WiFi aktiverat för ${profile.name}`);
      return session;
    } catch (err) {
      this.error('Fel vid aktivering av gäst-WiFi', err);
      throw err;
    }
  }

  deactivateGuestWifi(sessionId) {
    try {
      const session = this.guestWifiSessions.get(sessionId);
      if (!session) throw new Error(`WiFi-session ${sessionId} hittades inte`);

      session.active = false;
      this.guestWifiSessions.delete(sessionId);

      this.log(`Gäst-WiFi avaktiverat: ${sessionId}`);
      this._emitEvent('guest_wifi_deactivated', { sessionId, guestId: session.guestId });
      return true;
    } catch (err) {
      this.error('Fel vid avaktivering av gäst-WiFi', err);
      throw err;
    }
  }

  getActiveWifiSessions() {
    return Array.from(this.guestWifiSessions.values()).filter(s => s.active);
  }

  // ---------------------------------------------------------------------------
  // 5. Welcome Automation
  // ---------------------------------------------------------------------------

  setWelcomeAutomation(guestId, { scene = 'default', lights = true, music = null, temperature = null, customActions = [] }) {
    try {
      this._getProfileOrThrow(guestId);

      const automation = {
        guestId,
        scene,
        lights,
        music,
        temperature,
        customActions,
        updatedAt: Date.now()
      };

      this.welcomeAutomations.set(guestId, automation);
      const profile = this.guestProfiles.get(guestId);
      this.log(`Välkomstautomation konfigurerad för ${profile.name}`);
      return automation;
    } catch (err) {
      this.error('Fel vid konfigurering av välkomstautomation', err);
      throw err;
    }
  }

  _triggerWelcomeAutomation(guestId) {
    try {
      const automation = this.welcomeAutomations.get(guestId);
      const preferences = this.guestPreferences.get(guestId) || {};

      const effectiveTemp = preferences.temperature || (automation ? automation.temperature : null);
      const effectiveMusic = preferences.music || (automation ? automation.music : null);

      const actions = [];

      if (automation && automation.lights) {
        actions.push({ type: 'lights', action: 'welcome_scene', scene: automation.scene });
      }
      if (effectiveTemp !== null) {
        actions.push({ type: 'thermostat', action: 'set_temperature', value: effectiveTemp });
      }
      if (effectiveMusic) {
        actions.push({ type: 'music', action: 'play', value: effectiveMusic });
      }
      if (automation && automation.customActions) {
        actions.push(...automation.customActions);
      }

      const profile = this.guestProfiles.get(guestId);
      this.log(`Välkomstautomation utlöst för ${profile ? profile.name : guestId}: ${actions.length} åtgärder`);
      this._emitEvent('welcome_automation_triggered', { guestId, actions });
      return actions;
    } catch (err) {
      this.error('Fel vid utlösning av välkomstautomation', err);
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // 6. Airbnb / Rental Mode
  // ---------------------------------------------------------------------------

  createRentalBooking({ guestId, checkIn, checkOut, listingName = '', guestCount = 1, specialRequests = '' }) {
    try {
      this._getProfileOrThrow(guestId);

      const ciTime = new Date(checkIn).getTime();
      const coTime = new Date(checkOut).getTime();
      if (isNaN(ciTime) || isNaN(coTime) || coTime <= ciTime) {
        throw new Error('Ogiltiga in-/utcheckningstider');
      }

      const bookingId = this._generateId('booking');
      const booking = {
        bookingId,
        guestId,
        listingName,
        checkIn: ciTime,
        checkOut: coTime,
        guestCount,
        specialRequests,
        status: 'confirmed',
        accessCodeId: null,
        wifiSessionId: null,
        createdAt: Date.now()
      };

      // Auto-generate access code valid for the entire stay
      const accessEntry = this.generateTemporaryAccessCode({
        guestId,
        target: 'lock',
        validFrom: ciTime,
        validUntil: coTime,
        label: `Uthyrning ${bookingId}`
      });
      booking.accessCodeId = accessEntry.codeId;

      this.rentalBookings.set(bookingId, booking);
      const profile = this.guestProfiles.get(guestId);
      this.log(`Uthyrningsbokning skapad: ${profile.name}, ${new Date(ciTime).toLocaleDateString('sv-SE')} – ${new Date(coTime).toLocaleDateString('sv-SE')}`);
      this._emitEvent('rental_booking_created', { bookingId, guestId });
      return booking;
    } catch (err) {
      this.error('Fel vid skapande av uthyrningsbokning', err);
      throw err;
    }
  }

  processCheckIn(bookingId) {
    try {
      const booking = this.rentalBookings.get(bookingId);
      if (!booking) throw new Error(`Bokning ${bookingId} hittades inte`);

      booking.status = 'checked_in';

      // Activate guest WiFi for the stay duration
      const remainingMinutes = Math.max(0, Math.floor((booking.checkOut - Date.now()) / 60000));
      const wifiSession = this.activateGuestWifi({ guestId: booking.guestId, durationMinutes: remainingMinutes });
      booking.wifiSessionId = wifiSession.sessionId;

      // Trigger welcome automation
      this._triggerWelcomeAutomation(booking.guestId);

      // Send house rules
      this._sendHouseRulesToGuest(booking.guestId);

      const profile = this.guestProfiles.get(booking.guestId);
      this.log(`Incheckning genomförd: ${profile ? profile.name : booking.guestId}`);
      this._notifyHomeowner('rental_checkin', `Gäst ${profile ? profile.name : ''} har checkat in (${booking.listingName})`);
      this._emitEvent('rental_checkin', { bookingId, guestId: booking.guestId });
      return booking;
    } catch (err) {
      this.error('Fel vid incheckning', err);
      throw err;
    }
  }

  processCheckOut(bookingId) {
    try {
      const booking = this.rentalBookings.get(bookingId);
      if (!booking) throw new Error(`Bokning ${bookingId} hittades inte`);

      booking.status = 'checked_out';

      // Run checkout automation
      this._runCheckoutAutomation(booking);

      const profile = this.guestProfiles.get(booking.guestId);
      this.log(`Utcheckning genomförd: ${profile ? profile.name : booking.guestId}`);
      this._notifyHomeowner('rental_checkout', `Gäst ${profile ? profile.name : ''} har checkat ut (${booking.listingName})`);
      this._emitEvent('rental_checkout', { bookingId, guestId: booking.guestId });
      return booking;
    } catch (err) {
      this.error('Fel vid utcheckning', err);
      throw err;
    }
  }

  listRentalBookings(status = null) {
    let bookings = Array.from(this.rentalBookings.values());
    if (status) {
      bookings = bookings.filter(b => b.status === status);
    }
    return bookings.sort((a, b) => a.checkIn - b.checkIn);
  }

  // ---------------------------------------------------------------------------
  // 7. Service Provider Access
  // ---------------------------------------------------------------------------

  addServiceProvider({ name, company = '', role = 'cleaner', phone = null, email = null, recurringSchedule = null }) {
    try {
      if (!name) throw new Error('Namn på tjänsteleverantör krävs');

      const providerId = this._generateId('provider');
      const provider = {
        providerId,
        name: name.trim(),
        company,
        role,
        phone,
        email,
        recurringSchedule,
        active: true,
        accessHistory: [],
        createdAt: Date.now()
      };

      this.serviceProviders.set(providerId, provider);
      this.log(`Tjänsteleverantör tillagd: ${name} (${role})`);
      this._emitEvent('service_provider_added', { providerId, name, role });
      return provider;
    } catch (err) {
      this.error('Fel vid tillägg av tjänsteleverantör', err);
      throw err;
    }
  }

  grantServiceProviderAccess(providerId, { date, startTime, endTime, zones = [] }) {
    try {
      const provider = this.serviceProviders.get(providerId);
      if (!provider) throw new Error(`Tjänsteleverantör ${providerId} hittades inte`);

      // Create a temporary guest profile for the provider if needed
      let guestId = null;
      const existingProfile = Array.from(this.guestProfiles.values())
        .find(g => g.notes === `service_provider:${providerId}`);

      if (existingProfile) {
        guestId = existingProfile.guestId;
      } else {
        const profile = this.createGuestProfile({
          name: provider.name,
          phone: provider.phone,
          relationship: 'service_provider',
          notes: `service_provider:${providerId}`
        });
        guestId = profile.guestId;
      }

      const start = new Date(`${date}T${startTime}`).getTime();
      const end = new Date(`${date}T${endTime}`).getTime();

      const accessCode = this.generateTemporaryAccessCode({
        guestId,
        target: 'lock',
        validFrom: start,
        validUntil: end,
        label: `Tjänst: ${provider.role} – ${provider.name}`
      });

      // Grant zone access
      if (zones.length > 0) {
        this.setGuestZoneAccess(guestId, zones);
      }

      provider.accessHistory.push({ date, startTime, endTime, codeId: accessCode.codeId });
      this.log(`Åtkomst beviljad för ${provider.name}: ${date} ${startTime}–${endTime}`);
      this._notifyHomeowner('service_access', `Åtkomst beviljad för ${provider.name} (${provider.role}) ${date}`);
      return { provider, accessCode, guestId };
    } catch (err) {
      this.error('Fel vid beviljande av åtkomst för tjänsteleverantör', err);
      throw err;
    }
  }

  listServiceProviders(role = null) {
    let providers = Array.from(this.serviceProviders.values()).filter(p => p.active);
    if (role) {
      providers = providers.filter(p => p.role === role);
    }
    return providers;
  }

  // ---------------------------------------------------------------------------
  // 8. Visit History
  // ---------------------------------------------------------------------------

  getVisitHistory({ guestId = null, from = null, to = null, limit = 50 } = {}) {
    let history = [...this.visitHistory];

    if (guestId) {
      history = history.filter(v => v.guestId === guestId);
    }
    if (from) {
      const fromTs = new Date(from).getTime();
      history = history.filter(v => v.arrivedAt >= fromTs);
    }
    if (to) {
      const toTs = new Date(to).getTime();
      history = history.filter(v => v.arrivedAt <= toTs);
    }

    return history
      .sort((a, b) => (b.arrivedAt || b.startTime) - (a.arrivedAt || a.startTime))
      .slice(0, limit);
  }

  getGuestVisitCount(guestId) {
    return this.visitHistory.filter(v => v.guestId === guestId).length;
  }

  // ---------------------------------------------------------------------------
  // 9. Pre-Arrival Preparation
  // ---------------------------------------------------------------------------

  setPreArrivalTasks(guestId, tasks) {
    try {
      this._getProfileOrThrow(guestId);

      const taskList = {
        guestId,
        tasks: tasks.map((t, idx) => ({
          taskId: `task_${idx}`,
          description: t.description || '',
          type: t.type || 'custom',
          targetTemperature: t.targetTemperature || null,
          cleaningRequired: t.cleaningRequired || false,
          stockItems: t.stockItems || [],
          completed: false
        })),
        updatedAt: Date.now()
      };

      this.preArrivalTasks.set(guestId, taskList);
      const profile = this.guestProfiles.get(guestId);
      this.log(`Förankomstuppgifter konfigurerade för ${profile.name}: ${taskList.tasks.length} uppgifter`);
      return taskList;
    } catch (err) {
      this.error('Fel vid konfigurering av förankomstuppgifter', err);
      throw err;
    }
  }

  executePreArrivalPreparation(guestId) {
    try {
      const taskList = this.preArrivalTasks.get(guestId);
      if (!taskList) {
        this.log(`Inga förankomstuppgifter för gäst ${guestId}`);
        return [];
      }

      const results = [];
      for (const task of taskList.tasks) {
        const result = this._executePreArrivalTask(task);
        task.completed = true;
        results.push(result);
      }

      const profile = this.guestProfiles.get(guestId);
      this.log(`Förankomstförberedelser slutförda för ${profile ? profile.name : guestId}: ${results.length} uppgifter`);
      this._emitEvent('pre_arrival_completed', { guestId, taskCount: results.length });
      return results;
    } catch (err) {
      this.error('Fel vid förankomstförberedelser', err);
      throw err;
    }
  }

  _executePreArrivalTask(task) {
    const actions = [];
    if (task.targetTemperature) {
      actions.push({ type: 'thermostat', action: 'set_temperature', value: task.targetTemperature });
    }
    if (task.cleaningRequired) {
      actions.push({ type: 'cleaning', action: 'start_robot_vacuum' });
    }
    if (task.stockItems && task.stockItems.length > 0) {
      actions.push({ type: 'notification', action: 'stock_check', items: task.stockItems });
    }
    if (task.type === 'custom') {
      actions.push({ type: 'custom', description: task.description });
    }
    return { taskId: task.taskId, actions, executedAt: Date.now() };
  }

  // ---------------------------------------------------------------------------
  // 10. Guest Preferences
  // ---------------------------------------------------------------------------

  setGuestPreferences(guestId, preferences) {
    try {
      this._getProfileOrThrow(guestId);

      const allowed = ['temperature', 'lighting', 'music', 'wakeUpTime', 'dietaryRestrictions', 'language', 'customPrefs'];
      const current = this.guestPreferences.get(guestId) || {};

      for (const key of allowed) {
        if (preferences[key] !== undefined) {
          current[key] = preferences[key];
        }
      }
      current.updatedAt = Date.now();
      this.guestPreferences.set(guestId, current);

      const profile = this.guestProfiles.get(guestId);
      this.log(`Gästpreferenser uppdaterade för ${profile.name}`);
      return current;
    } catch (err) {
      this.error('Fel vid uppdatering av gästpreferenser', err);
      throw err;
    }
  }

  getGuestPreferences(guestId) {
    return this.guestPreferences.get(guestId) || {};
  }

  // ---------------------------------------------------------------------------
  // 11. Notification System
  // ---------------------------------------------------------------------------

  _notifyHomeowner(type, message) {
    try {
      const notification = {
        id: this._generateId('notif'),
        type,
        message,
        timestamp: Date.now(),
        read: false
      };

      this._emitEvent('homeowner_notification', notification);
      this.log(`Notifiering skickad: [${type}] ${message}`);
      return notification;
    } catch (err) {
      this.error('Fel vid skickande av notifiering', err);
    }
  }

  notifyGuest(guestId, { title, message, method = 'push' }) {
    try {
      this._getProfileOrThrow(guestId);

      const notification = {
        id: this._generateId('gnotif'),
        guestId,
        title,
        message,
        method,
        sentAt: Date.now()
      };

      const profile = this.guestProfiles.get(guestId);
      this.log(`Gästnotifiering skickad till ${profile.name}: ${title}`);
      this._emitEvent('guest_notification_sent', notification);
      return notification;
    } catch (err) {
      this.error('Fel vid skickande av gästnotifiering', err);
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // 12. Emergency Contacts
  // ---------------------------------------------------------------------------

  setEmergencyContacts(guestId, contacts) {
    try {
      this._getProfileOrThrow(guestId);

      const validated = contacts.map(c => ({
        name: c.name || '',
        phone: c.phone || '',
        relationship: c.relationship || '',
        medicalNotes: c.medicalNotes || ''
      }));

      this.emergencyContacts.set(guestId, validated);
      const profile = this.guestProfiles.get(guestId);
      this.log(`Nödkontakter sparade för ${profile.name}: ${validated.length} kontakter`);
      return validated;
    } catch (err) {
      this.error('Fel vid sparande av nödkontakter', err);
      throw err;
    }
  }

  getEmergencyContacts(guestId) {
    return this.emergencyContacts.get(guestId) || [];
  }

  // ---------------------------------------------------------------------------
  // 13. House Rules Display
  // ---------------------------------------------------------------------------

  configureHouseRules(rules) {
    try {
      const allowed = ['wifiPassword', 'parkingInfo', 'quietHours', 'trashCollection', 'specialInstructions', 'customRules'];
      for (const key of allowed) {
        if (rules[key] !== undefined) {
          this.houseRules[key] = rules[key];
        }
      }
      this.log('Husregler uppdaterade');
      return this.houseRules;
    } catch (err) {
      this.error('Fel vid konfigurering av husregler', err);
      throw err;
    }
  }

  getHouseRules() {
    return { ...this.houseRules };
  }

  _sendHouseRulesToGuest(guestId) {
    try {
      const profile = this.guestProfiles.get(guestId);
      if (!profile) return;

      const rules = this.getHouseRules();
      const formatted = this._formatHouseRulesMessage(rules);

      this.notifyGuest(guestId, {
        title: 'Välkommen – Husregler',
        message: formatted,
        method: 'push'
      });

      this.log(`Husregler skickade till ${profile.name}`);
    } catch (err) {
      this.error('Fel vid skickande av husregler', err);
    }
  }

  _formatHouseRulesMessage(rules) {
    const parts = ['🏠 Husregler\n'];
    if (rules.wifiPassword) parts.push(`📶 WiFi-lösenord: ${rules.wifiPassword}`);
    if (rules.parkingInfo) parts.push(`🅿️ Parkering: ${rules.parkingInfo}`);
    if (rules.quietHours) parts.push(`🔇 Tysta timmar: ${rules.quietHours.start} – ${rules.quietHours.end}`);
    if (rules.trashCollection) parts.push(`🗑️ Sophantering: ${rules.trashCollection}`);
    if (rules.specialInstructions) parts.push(`📋 Övrigt: ${rules.specialInstructions}`);
    if (rules.customRules && rules.customRules.length > 0) {
      parts.push('📌 Ytterligare regler:');
      rules.customRules.forEach((r, i) => parts.push(`   ${i + 1}. ${r}`));
    }
    return parts.join('\n');
  }

  // ---------------------------------------------------------------------------
  // 14. Multi-Zone Guest Access
  // ---------------------------------------------------------------------------

  defineZone(zoneId, { name, description = '', devices = [], requiresCode = false }) {
    try {
      const zone = {
        zoneId,
        name,
        description,
        devices,
        requiresCode,
        createdAt: Date.now()
      };
      this.zoneDefinitions.set(zoneId, zone);
      this.log(`Zon definierad: ${name} (${zoneId})`);
      return zone;
    } catch (err) {
      this.error('Fel vid definiering av zon', err);
      throw err;
    }
  }

  setGuestZoneAccess(guestId, zoneIds) {
    try {
      this._getProfileOrThrow(guestId);
      const accessSet = new Set(zoneIds);
      this.guestZoneAccess.set(guestId, accessSet);

      const profile = this.guestProfiles.get(guestId);
      this.log(`Zonåtkomst uppdaterad för ${profile.name}: ${zoneIds.join(', ')}`);
      this._emitEvent('zone_access_updated', { guestId, zones: zoneIds });
      return { guestId, zones: zoneIds };
    } catch (err) {
      this.error('Fel vid uppdatering av zonåtkomst', err);
      throw err;
    }
  }

  checkGuestZoneAccess(guestId, zoneId) {
    const accessSet = this.guestZoneAccess.get(guestId);
    if (!accessSet) return false;
    return accessSet.has(zoneId);
  }

  getGuestAccessibleZones(guestId) {
    const accessSet = this.guestZoneAccess.get(guestId);
    if (!accessSet) return [];
    return Array.from(accessSet)
      .map(zoneId => this.zoneDefinitions.get(zoneId))
      .filter(Boolean);
  }

  // ---------------------------------------------------------------------------
  // 15. Checkout Automation
  // ---------------------------------------------------------------------------

  configureCheckoutDefaults(settings) {
    try {
      const allowed = ['resetTemperature', 'turnOffLights', 'lockAllDoors', 'disableGuestWifi', 'revokeAccessCodes', 'runCleaningScene'];
      for (const key of allowed) {
        if (settings[key] !== undefined) {
          this.checkoutDefaults[key] = settings[key];
        }
      }
      this.log('Utcheckningsautomation uppdaterad');
      return this.checkoutDefaults;
    } catch (err) {
      this.error('Fel vid konfigurering av utcheckningsautomation', err);
      throw err;
    }
  }

  _runCheckoutAutomation(booking) {
    try {
      const actions = [];
      const defaults = this.checkoutDefaults;

      if (defaults.revokeAccessCodes && booking.accessCodeId) {
        this.revokeAccessCode(booking.accessCodeId);
        actions.push({ type: 'access', action: 'revoke_code' });
      }

      if (defaults.disableGuestWifi && booking.wifiSessionId) {
        this.deactivateGuestWifi(booking.wifiSessionId);
        actions.push({ type: 'wifi', action: 'deactivate' });
      }

      if (defaults.resetTemperature) {
        actions.push({ type: 'thermostat', action: 'set_temperature', value: defaults.resetTemperature });
      }

      if (defaults.turnOffLights) {
        actions.push({ type: 'lights', action: 'all_off' });
      }

      if (defaults.lockAllDoors) {
        actions.push({ type: 'locks', action: 'lock_all' });
      }

      if (defaults.runCleaningScene) {
        actions.push({ type: 'cleaning', action: 'start_robot_vacuum' });
      }

      // Revoke zone access
      if (booking.guestId) {
        this.guestZoneAccess.set(booking.guestId, new Set());
        actions.push({ type: 'zones', action: 'revoke_all' });
      }

      this.log(`Utcheckningsautomation körd: ${actions.length} åtgärder`);
      this._emitEvent('checkout_automation_completed', { bookingId: booking.bookingId, actions });
      return actions;
    } catch (err) {
      this.error('Fel vid utcheckningsautomation', err);
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // 16. Guest Analytics
  // ---------------------------------------------------------------------------

  getGuestAnalytics() {
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 86400000;
    const recentVisits = this.visitHistory.filter(v => (v.arrivedAt || v.startTime) >= thirtyDaysAgo);

    const totalDuration = this.visitHistory.reduce((sum, v) => {
      if (v.arrivedAt && v.departedAt) {
        return sum + (v.departedAt - v.arrivedAt);
      }
      return sum;
    }, 0);

    const completedVisits = this.visitHistory.filter(v => v.arrivedAt && v.departedAt);
    const avgDurationMinutes = completedVisits.length > 0
      ? Math.round(totalDuration / completedVisits.length / 60000)
      : 0;

    // Most frequent guests
    const guestFrequency = new Map();
    for (const visit of this.visitHistory) {
      const count = guestFrequency.get(visit.guestId) || 0;
      guestFrequency.set(visit.guestId, count + 1);
    }

    const topGuests = Array.from(guestFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([guestId, count]) => {
        const profile = this.guestProfiles.get(guestId);
        return { guestId, name: profile ? profile.name : 'Okänd', visitCount: count };
      });

    // Popular visit hours
    const hourDistribution = [...this.analytics.visitsByHour];
    const peakHour = hourDistribution.indexOf(Math.max(...hourDistribution));

    // Day-of-week distribution
    const dayNames = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'];
    const dayDistribution = this.analytics.visitsByDayOfWeek.map((count, idx) => ({
      day: dayNames[idx],
      count
    }));
    const peakDayIdx = this.analytics.visitsByDayOfWeek.indexOf(Math.max(...this.analytics.visitsByDayOfWeek));

    return {
      totalVisits: this.visitHistory.length,
      recentVisits: recentVisits.length,
      averageDurationMinutes: avgDurationMinutes,
      topGuests,
      peakHour,
      peakDay: dayNames[peakDayIdx],
      hourDistribution,
      dayDistribution,
      totalGuestProfiles: this.guestProfiles.size,
      activeAccessCodes: Array.from(this.temporaryAccessCodes.values()).filter(c => !c.revoked).length,
      activeRentalBookings: Array.from(this.rentalBookings.values()).filter(b => b.status === 'checked_in').length
    };
  }

  // ---------------------------------------------------------------------------
  // Statistics & Logging
  // ---------------------------------------------------------------------------

  getStatistics() {
    return {
      initialized: this._initialized,
      guestProfiles: this.guestProfiles.size,
      scheduledVisits: this.scheduledVisits.size,
      activeAccessCodes: Array.from(this.temporaryAccessCodes.values()).filter(c => !c.revoked).length,
      activeWifiSessions: this.guestWifiSessions.size,
      visitHistoryCount: this.visitHistory.length,
      serviceProviders: this.serviceProviders.size,
      rentalBookings: this.rentalBookings.size,
      zonesDefined: this.zoneDefinitions.size,
      welcomeAutomations: this.welcomeAutomations.size,
      analytics: this.getGuestAnalytics()
    };
  }

  log(...args) {
    if (this.homey && typeof this.homey.log === 'function') {
      this.homey.log('[VisitorGuestMgmt]', ...args);
    } else {
      console.log('[VisitorGuestMgmt]', ...args);
    }
  }

  error(...args) {
    if (this.homey && typeof this.homey.error === 'function') {
      this.homey.error('[VisitorGuestMgmt]', ...args);
    } else {
      console.error('[VisitorGuestMgmt]', ...args);
    }
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  _generateId(prefix) {
    const rand = crypto.randomBytes(6).toString('hex');
    return `${prefix}_${Date.now()}_${rand}`;
  }

  _generateAccessCode(length) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    const bytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
      code += chars[bytes[i] % chars.length];
    }
    return code;
  }

  _getProfileOrThrow(guestId) {
    const profile = this.guestProfiles.get(guestId);
    if (!profile) {
      throw new Error(`Gästprofil ${guestId} hittades inte`);
    }
    return profile;
  }

  _emitEvent(event, data) {
    try {
      if (this.homey && typeof this.homey.emit === 'function') {
        this.homey.emit(`visitor_guest:${event}`, data);
      }
    } catch (err) {
      this.error('Fel vid emission av händelse', err);
    }
  }

  _revokeVisitAccessCodes(visitId) {
    for (const entry of this.temporaryAccessCodes.values()) {
      if (entry.visitId === visitId && !entry.revoked) {
        entry.revoked = true;
        this.log(`Åtkomstkod automatiskt återkallad: ${entry.codeId}`);
      }
    }
  }

  _recordAnalyticsArrival(visit) {
    const arrivalDate = new Date(visit.arrivedAt);
    const hour = arrivalDate.getHours();
    const day = arrivalDate.getDay();

    this.analytics.visitsByHour[hour] = (this.analytics.visitsByHour[hour] || 0) + 1;
    this.analytics.visitsByDayOfWeek[day] = (this.analytics.visitsByDayOfWeek[day] || 0) + 1;
    this.analytics.totalVisits += 1;

    const monthKey = `${arrivalDate.getFullYear()}-${String(arrivalDate.getMonth() + 1).padStart(2, '0')}`;
    this.analytics.monthlyVisits.set(monthKey, (this.analytics.monthlyVisits.get(monthKey) || 0) + 1);

    const guestCount = this.analytics.visitsPerGuest.get(visit.guestId) || 0;
    this.analytics.visitsPerGuest.set(visit.guestId, guestCount + 1);
  }

  _recordAnalyticsDeparture(visit) {
    if (visit.arrivedAt && visit.departedAt) {
      const duration = Math.round((visit.departedAt - visit.arrivedAt) / 60000);
      this.analytics.totalDurationMinutes += duration;
    }
  }

  async _loadPersistedState() {
    try {
      this.log('Laddar sparat tillstånd...');
      // Integration point for loading from Homey settings storage
      if (this.homey && typeof this.homey.settings === 'object') {
        const saved = this.homey.settings.get('visitorGuestState');
        if (saved) {
          this._restoreState(saved);
          this.log('Sparat tillstånd återställt');
        }
      }
    } catch (err) {
      this.error('Fel vid laddning av sparat tillstånd', err);
    }
  }

  _restoreState(saved) {
    try {
      if (saved.guestProfiles) {
        for (const [k, v] of Object.entries(saved.guestProfiles)) {
          this.guestProfiles.set(k, v);
        }
      }
      if (saved.guestPreferences) {
        for (const [k, v] of Object.entries(saved.guestPreferences)) {
          this.guestPreferences.set(k, v);
        }
      }
      if (saved.visitHistory) {
        this.visitHistory = saved.visitHistory;
      }
      if (saved.houseRules) {
        Object.assign(this.houseRules, saved.houseRules);
      }
      if (saved.serviceProviders) {
        for (const [k, v] of Object.entries(saved.serviceProviders)) {
          this.serviceProviders.set(k, v);
        }
      }
      if (saved.zoneDefinitions) {
        for (const [k, v] of Object.entries(saved.zoneDefinitions)) {
          this.zoneDefinitions.set(k, v);
        }
      }
    } catch (err) {
      this.error('Fel vid återställning av tillstånd', err);
    }
  }

  _startScheduleWatcher() {
    const interval = setInterval(() => {
      this._checkUpcomingVisits();
    }, 60000);
    this._timers.push(interval);
  }

  _checkUpcomingVisits() {
    try {
      const now = Date.now();
      const fifteenMinutes = 15 * 60000;

      for (const visit of this.scheduledVisits.values()) {
        if (visit.status !== 'scheduled') continue;

        const timeUntil = visit.startTime - now;

        // 15-minute pre-arrival warning
        if (timeUntil > 0 && timeUntil <= fifteenMinutes) {
          const profile = this.guestProfiles.get(visit.guestId);
          this._notifyHomeowner('visit_approaching', `${profile ? profile.name : 'Gäst'} förväntas om ${Math.round(timeUntil / 60000)} minuter`);
          this.executePreArrivalPreparation(visit.guestId);
        }

        // Overdue check — guest hasn't arrived 30 min past start
        if (timeUntil < -30 * 60000 && !visit.arrivedAt) {
          const profile = this.guestProfiles.get(visit.guestId);
          this._notifyHomeowner('visit_overdue', `${profile ? profile.name : 'Gäst'} har inte anlänt (förväntad ${new Date(visit.startTime).toLocaleTimeString('sv-SE')})`);
        }
      }
    } catch (err) {
      this.error('Fel vid kontroll av kommande besök', err);
    }
  }

  _startAccessCodeExpiryWatcher() {
    const interval = setInterval(() => {
      this._cleanExpiredAccessCodes();
    }, 300000);
    this._timers.push(interval);
  }

  _cleanExpiredAccessCodes() {
    try {
      const now = Date.now();
      for (const [codeId, entry] of this.temporaryAccessCodes.entries()) {
        if (!entry.revoked && entry.validUntil < now) {
          entry.revoked = true;
          this.log(`Åtkomstkod utgången och återkallad: ${codeId}`);
        }
      }
    } catch (err) {
      this.error('Fel vid rensning av utgångna åtkomstkoder', err);
    }
  }

  _startWifiSessionExpiryWatcher() {
    const interval = setInterval(() => {
      this._cleanExpiredWifiSessions();
    }, 300000);
    this._timers.push(interval);
  }

  _cleanExpiredWifiSessions() {
    try {
      const now = Date.now();
      for (const [sessionId, session] of this.guestWifiSessions.entries()) {
        if (session.active && session.expiresAt < now) {
          this.deactivateGuestWifi(sessionId);
          this.log(`Gäst-WiFi session utgången: ${sessionId}`);
        }
      }
    } catch (err) {
      this.error('Fel vid rensning av utgångna WiFi-sessioner', err);
    }
  }

  destroy() {
    for (const timer of this._timers) {
      clearInterval(timer);
    }
    this._timers = [];
    this._initialized = false;
    this.log('Besöks- och Gästhanteringssystem avslutat');
  }
}

module.exports = VisitorGuestManagementSystem;
