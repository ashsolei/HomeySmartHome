'use strict';

/**
 * Family Calendar Coordinator
 * Smart scheduling and family coordination system
 */
class FamilyCalendarCoordinator {
  constructor(app) {
    this._intervals = [];
    this.app = app;
    this.events = new Map();
    this.members = new Map();
    this.routines = new Map();
    this.conflicts = [];
    this.reminders = [];
    this.locations = new Map();
  }

  async initialize() {
    await this.setupFamilyMembers();
    await this.setupRoutines();
    await this.setupLocations();
    await this.generateSampleEvents();
    
    this.startMonitoring();
  }

  // ============================================
  // FAMILY MEMBERS
  // ============================================

  async setupFamilyMembers() {
    const memberData = [
      {
        id: 'parent1',
        name: 'Anna',
        type: 'adult',
        color: '#3498db',
        preferences: {
          wakeTime: '06:30',
          sleepTime: '22:30',
          workDays: [1, 2, 3, 4, 5],
          workStart: '08:00',
          workEnd: '17:00'
        },
        location: 'home',
        deviceId: 'phone_anna'
      },
      {
        id: 'parent2',
        name: 'Erik',
        type: 'adult',
        color: '#e74c3c',
        preferences: {
          wakeTime: '06:00',
          sleepTime: '22:00',
          workDays: [1, 2, 3, 4],
          workStart: '07:00',
          workEnd: '16:00'
        },
        location: 'home',
        deviceId: 'phone_erik'
      },
      {
        id: 'child1',
        name: 'Lisa',
        type: 'child',
        age: 12,
        color: '#9b59b6',
        preferences: {
          wakeTime: '07:00',
          sleepTime: '21:00',
          schoolDays: [1, 2, 3, 4, 5],
          schoolStart: '08:30',
          schoolEnd: '15:00'
        },
        location: 'home',
        deviceId: null
      },
      {
        id: 'child2',
        name: 'Oscar',
        type: 'child',
        age: 8,
        color: '#f39c12',
        preferences: {
          wakeTime: '07:00',
          sleepTime: '20:30',
          schoolDays: [1, 2, 3, 4, 5],
          schoolStart: '08:30',
          schoolEnd: '14:30'
        },
        location: 'home',
        deviceId: null
      }
    ];

    for (const member of memberData) {
      this.members.set(member.id, {
        ...member,
        availability: 'available',
        currentActivity: null,
        upcomingEvents: []
      });
    }
  }

  async updateMemberLocation(memberId, location) {
    const member = this.members.get(memberId);
    
    if (!member) {
      return { success: false, error: 'Member not found' };
    }

    const previousLocation = member.location;
    member.location = location;

    console.log(`📍 ${member.name}: ${previousLocation} → ${location}`);

    // Trigger location-based automations
    await this.handleLocationChange(member, location);

    return { success: true, member };
  }

  async handleLocationChange(member, location) {
    // Check if this affects any events
    const now = Date.now();
    
    for (const [_eventId, event] of this.events) {
      if (event.startTime > now && event.startTime < now + 30 * 60 * 1000) {
        // Event starting within 30 minutes
        if (event.attendees.includes(member.id)) {
          if (location === 'away' && event.location === 'home') {
            console.log(`  ⚠️ ${member.name} is away but has event "${event.title}" at home soon`);
          }
        }
      }
    }

    // Update home status
    if (location === 'home') {
      // Someone arrived home
      await this.handleArrival(member);
    } else if (location === 'away') {
      // Someone left
      await this.handleDeparture(member);
    }
  }

  async handleArrival(member) {
    console.log(`  👋 ${member.name} arrived home`);
    
    // Check for pending tasks or reminders
    const pendingReminders = this.reminders.filter(r => 
      r.memberId === member.id && 
      r.status === 'pending' &&
      r.triggerLocation === 'home'
    );

    for (const reminder of pendingReminders) {
      console.log(`  📌 Reminder for ${member.name}: ${reminder.message}`);
      reminder.status = 'delivered';
    }
  }

  async handleDeparture(member) {
    console.log(`  🚪 ${member.name} left home`);
    
    // Check if forgot anything
    const upcomingEvents = this.getUpcomingEvents(member.id, 2); // Next 2 hours
    
    if (upcomingEvents.length > 0) {
      console.log(`  📅 Upcoming: ${upcomingEvents[0].title} at ${new Date(upcomingEvents[0].startTime).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`);
    }
  }

  // ============================================
  // EVENTS
  // ============================================

  async generateSampleEvents() {
    const now = Date.now();
    
    // Work events
    await this.createEvent({
      title: 'Arbete',
      type: 'work',
      startTime: now + 24 * 60 * 60 * 1000, // Tomorrow
      duration: 540, // 9 hours
      attendees: ['parent1'],
      location: 'Kontoret',
      recurring: 'weekdays'
    });

    // School events
    await this.createEvent({
      title: 'Skola',
      type: 'school',
      startTime: now + 24 * 60 * 60 * 1000,
      duration: 390, // 6.5 hours
      attendees: ['child1', 'child2'],
      location: 'Skolan',
      recurring: 'weekdays'
    });

    // Family dinner
    await this.createEvent({
      title: 'Familje middag',
      type: 'family',
      startTime: now + 6 * 60 * 60 * 1000, // In 6 hours
      duration: 60,
      attendees: ['parent1', 'parent2', 'child1', 'child2'],
      location: 'home',
      recurring: null
    });

    // Kids activities
    await this.createEvent({
      title: 'Lisa - Fotbollsträning',
      type: 'activity',
      startTime: now + 25 * 60 * 60 * 1000,
      duration: 90,
      attendees: ['child1'],
      location: 'Idrottsplats',
      requiresTransport: true
    });

    await this.createEvent({
      title: 'Oscar - Musiklektion',
      type: 'activity',
      startTime: now + 26 * 60 * 60 * 1000,
      duration: 45,
      attendees: ['child2'],
      location: 'Musikskola',
      requiresTransport: true
    });

    // Weekend plans
    await this.createEvent({
      title: 'Helgutflykt',
      type: 'leisure',
      startTime: now + 5 * 24 * 60 * 60 * 1000, // In 5 days
      duration: 480,
      attendees: ['parent1', 'parent2', 'child1', 'child2'],
      location: 'Skogen',
      requiresTransport: true
    });
  }

  async createEvent(data) {
    const id = `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const event = {
      id,
      title: data.title,
      type: data.type,
      startTime: data.startTime,
      endTime: data.startTime + (data.duration * 60 * 1000),
      duration: data.duration,
      attendees: data.attendees || [],
      location: data.location,
      recurring: data.recurring || null,
      requiresTransport: data.requiresTransport || false,
      reminders: [],
      status: 'scheduled',
      created: Date.now()
    };

    this.events.set(id, event);

    // Check for conflicts
    await this.checkConflicts(id);

    // Create automatic reminders
    await this.createAutomaticReminders(event);

    console.log(`📅 Event created: ${event.title} (${new Date(event.startTime).toLocaleString('sv-SE')})`);

    return { success: true, event };
  }

  async updateEvent(eventId, updates) {
    const event = this.events.get(eventId);
    
    if (!event) {
      return { success: false, error: 'Event not found' };
    }

    Object.assign(event, updates);

    // Recheck conflicts
    await this.checkConflicts(eventId);

    console.log(`📝 Event updated: ${event.title}`);

    return { success: true, event };
  }

  async deleteEvent(eventId) {
    const event = this.events.get(eventId);
    
    if (!event) {
      return { success: false, error: 'Event not found' };
    }

    this.events.delete(eventId);

    // Remove associated reminders
    this.reminders = this.reminders.filter(r => r.eventId !== eventId);

    console.log(`🗑️ Event deleted: ${event.title}`);

    return { success: true };
  }

  // ============================================
  // CONFLICTS
  // ============================================

  async checkConflicts(eventId) {
    const event = this.events.get(eventId);
    
    if (!event) return;

    const conflicts = [];

    for (const [otherId, other] of this.events) {
      if (otherId === eventId) continue;

      // Check for overlapping attendees
      const sharedAttendees = event.attendees.filter(a => other.attendees.includes(a));
      
      if (sharedAttendees.length > 0) {
        // Check time overlap
        const overlap = this.checkTimeOverlap(
          event.startTime, event.endTime,
          other.startTime, other.endTime
        );

        if (overlap) {
          conflicts.push({
            id: `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            event1: event.id,
            event2: other.id,
            members: sharedAttendees,
            severity: this.calculateConflictSeverity(event, other),
            detected: Date.now()
          });
        }
      }
    }

    if (conflicts.length > 0) {
      console.log(`⚠️ Conflicts detected for "${event.title}":`);
      
      for (const conflict of conflicts) {
        const other = this.events.get(conflict.event2);
        const memberNames = conflict.members.map(m => this.members.get(m)?.name).join(', ');
        
        console.log(`  - Overlaps with "${other.title}" (${memberNames})`);
        
        this.conflicts.push(conflict);
      }
    }

    return conflicts;
  }

  checkTimeOverlap(start1, end1, start2, end2) {
    return start1 < end2 && end1 > start2;
  }

  calculateConflictSeverity(event1, event2) {
    // Critical: School/work conflicts
    if ((event1.type === 'school' || event1.type === 'work') &&
        (event2.type === 'school' || event2.type === 'work')) {
      return 'critical';
    }

    // High: One is critical, other is not
    if ((event1.type === 'school' || event1.type === 'work' || event1.type === 'medical') ||
        (event2.type === 'school' || event2.type === 'work' || event2.type === 'medical')) {
      return 'high';
    }

    // Medium: Family events
    if (event1.type === 'family' || event2.type === 'family') {
      return 'medium';
    }

    return 'low';
  }

  async resolveConflict(conflictId, resolution) {
    const conflictIndex = this.conflicts.findIndex(c => c.id === conflictId);
    
    if (conflictIndex === -1) {
      return { success: false, error: 'Conflict not found' };
    }

    const _conflict = this.conflicts[conflictIndex];
    
    switch (resolution.action) {
      case 'reschedule':
        await this.updateEvent(resolution.eventId, {
          startTime: resolution.newStartTime
        });
        break;

      case 'cancel':
        await this.deleteEvent(resolution.eventId);
        break;

      case 'ignore':
        // Mark as acknowledged
        break;
    }

    this.conflicts.splice(conflictIndex, 1);

    console.log(`✓ Conflict resolved: ${resolution.action}`);

    return { success: true };
  }

  // ============================================
  // REMINDERS
  // ============================================

  async createAutomaticReminders(event) {
    // 30 minutes before
    this.createReminder({
      eventId: event.id,
      memberId: event.attendees,
      message: `${event.title} börjar om 30 minuter`,
      triggerTime: event.startTime - 30 * 60 * 1000,
      type: 'pre_event'
    });

    // For transport-required events, reminder earlier
    if (event.requiresTransport) {
      this.createReminder({
        eventId: event.id,
        memberId: event.attendees,
        message: `Dags att åka till ${event.title}`,
        triggerTime: event.startTime - 45 * 60 * 1000,
        type: 'transport'
      });
    }
  }

  async createReminder(data) {
    const reminder = {
      id: `reminder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      eventId: data.eventId || null,
      memberId: Array.isArray(data.memberId) ? data.memberId : [data.memberId],
      message: data.message,
      triggerTime: data.triggerTime,
      triggerLocation: data.triggerLocation || null,
      type: data.type || 'general',
      status: 'pending',
      created: Date.now()
    };

    this.reminders.push(reminder);

    return { success: true, reminder };
  }

  async checkReminders() {
    const now = Date.now();

    for (const reminder of this.reminders) {
      if (reminder.status === 'pending' && reminder.triggerTime <= now) {
        // Trigger reminder
        for (const memberId of reminder.memberId) {
          const member = this.members.get(memberId);
          if (member) {
            console.log(`🔔 Reminder for ${member.name}: ${reminder.message}`);
          }
        }

        reminder.status = 'delivered';
        reminder.deliveredAt = now;
      }
    }
  }

  // ============================================
  // ROUTINES
  // ============================================

  async setupRoutines() {
    const routineData = [
      {
        id: 'morning_weekday',
        name: 'Vardagsmorgon',
        days: [1, 2, 3, 4, 5],
        startTime: '06:30',
        tasks: [
          { time: '06:30', member: 'parent1', action: 'Wake up', duration: 5 },
          { time: '06:45', member: 'parent2', action: 'Make coffee', duration: 10 },
          { time: '07:00', member: 'child1', action: 'Wake up', duration: 5 },
          { time: '07:00', member: 'child2', action: 'Wake up', duration: 5 },
          { time: '07:30', member: 'all', action: 'Breakfast', duration: 20 },
          { time: '08:00', member: 'parent1', action: 'Drive kids to school', duration: 30 }
        ],
        enabled: true
      },
      {
        id: 'evening_routine',
        name: 'Kvällsrutin',
        days: [0, 1, 2, 3, 4, 5, 6],
        startTime: '18:00',
        tasks: [
          { time: '18:00', member: 'all', action: 'Dinner preparation', duration: 30 },
          { time: '18:30', member: 'all', action: 'Family dinner', duration: 30 },
          { time: '19:00', member: 'child2', action: 'Homework', duration: 30 },
          { time: '20:00', member: 'child2', action: 'Bedtime routine', duration: 30 },
          { time: '20:30', member: 'child1', action: 'Bedtime routine', duration: 30 }
        ],
        enabled: true
      }
    ];

    for (const routine of routineData) {
      this.routines.set(routine.id, routine);
    }
  }

  // ============================================
  // LOCATIONS
  // ============================================

  async setupLocations() {
    const locationData = [
      { id: 'home', name: 'Hemma', type: 'home', lat: 59.3293, lng: 18.0686 },
      { id: 'work_anna', name: 'Annas jobb', type: 'work', lat: 59.3320, lng: 18.0640 },
      { id: 'work_erik', name: 'Eriks jobb', type: 'work', lat: 59.3280, lng: 18.0750 },
      { id: 'school', name: 'Skolan', type: 'school', lat: 59.3310, lng: 18.0720 },
      { id: 'sports_center', name: 'Idrottsplats', type: 'activity', lat: 59.3340, lng: 18.0660 },
      { id: 'music_school', name: 'Musikskola', type: 'activity', lat: 59.3270, lng: 18.0700 }
    ];

    for (const location of locationData) {
      this.locations.set(location.id, {
        ...location,
        visits: 0,
        lastVisit: null
      });
    }
  }

  calculateTravelTime(fromLocationId, toLocationId) {
    const from = this.locations.get(fromLocationId);
    const to = this.locations.get(toLocationId);
    
    if (!from || !to) return 0;

    // Simple distance calculation (Haversine formula approximation)
    const R = 6371; // Earth radius in km
    const dLat = (to.lat - from.lat) * Math.PI / 180;
    const dLng = (to.lng - from.lng) * Math.PI / 180;
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(from.lat * Math.PI / 180) * Math.cos(to.lat * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    // Assume 30 km/h average speed in city
    const travelTime = (distance / 30) * 60; // minutes

    return Math.ceil(travelTime);
  }

  // ============================================
  // SMART FEATURES
  // ============================================

  getUpcomingEvents(memberId = null, hours = 24) {
    const now = Date.now();
    const cutoff = now + hours * 60 * 60 * 1000;

    let events = Array.from(this.events.values())
      .filter(e => e.startTime >= now && e.startTime <= cutoff);

    if (memberId) {
      events = events.filter(e => e.attendees.includes(memberId));
    }

    return events.sort((a, b) => a.startTime - b.startTime);
  }

  getDaySchedule(date, memberId = null) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    let events = Array.from(this.events.values())
      .filter(e => e.startTime >= dayStart.getTime() && e.startTime <= dayEnd.getTime());

    if (memberId) {
      events = events.filter(e => e.attendees.includes(memberId));
    }

    return events.sort((a, b) => a.startTime - b.startTime);
  }

  async suggestOptimalTime(duration, attendees, preferredDays = [1, 2, 3, 4, 5]) {
    const now = Date.now();
    const searchDays = 14; // Search next 2 weeks

    const suggestions = [];

    for (let day = 0; day < searchDays; day++) {
      const date = new Date(now + day * 24 * 60 * 60 * 1000);
      
      if (!preferredDays.includes(date.getDay())) continue;

      // Check each hour of the day
      for (let hour = 8; hour < 20; hour++) {
        const startTime = new Date(date);
        startTime.setHours(hour, 0, 0, 0);
        const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

        // Check if all attendees are free
        let allFree = true;
        
        for (const memberId of attendees) {
          const memberEvents = this.getDaySchedule(startTime, memberId);
          
          for (const event of memberEvents) {
            if (this.checkTimeOverlap(startTime.getTime(), endTime.getTime(), event.startTime, event.endTime)) {
              allFree = false;
              break;
            }
          }
          
          if (!allFree) break;
        }

        if (allFree) {
          suggestions.push({
            date: startTime.toLocaleDateString('sv-SE'),
            time: startTime.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
            timestamp: startTime.getTime()
          });

          // Return first 5 suggestions
          if (suggestions.length >= 5) {
            return suggestions;
          }
        }
      }
    }

    return suggestions;
  }

  // ============================================
  // MONITORING
  // ============================================

  startMonitoring() {
    // Check reminders every minute
    this._intervals.push(setInterval(() => {
      this.checkReminders();
    }, 60 * 1000));

    // Update upcoming events every 5 minutes
    this._intervals.push(setInterval(() => {
      this.updateUpcomingEvents();
    }, 5 * 60 * 1000));

    // Daily summary at 7 AM
    this._intervals.push(setInterval(() => {
      const hour = new Date().getHours();
      if (hour === 7) {
        this.generateDailySummary();
      }
    }, 60 * 60 * 1000));
  }

  async updateUpcomingEvents() {
    for (const [memberId, member] of this.members) {
      member.upcomingEvents = this.getUpcomingEvents(memberId, 4); // Next 4 hours
    }
  }

  async generateDailySummary() {
    console.log('📅 Daily Summary:');
    
    for (const [memberId, member] of this.members) {
      const todayEvents = this.getDaySchedule(Date.now(), memberId);
      
      if (todayEvents.length > 0) {
        console.log(`  ${member.name}:`);
        
        for (const event of todayEvents) {
          const time = new Date(event.startTime).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
          console.log(`    - ${time}: ${event.title}`);
        }
      }
    }

    // Check for conflicts
    const todayConflicts = this.conflicts.filter(c => {
      const event1 = this.events.get(c.event1);
      return event1 && this.isToday(event1.startTime);
    });

    if (todayConflicts.length > 0) {
      console.log(`  ⚠️ ${todayConflicts.length} conflict(s) today`);
    }
  }

  isToday(timestamp) {
    const date = new Date(timestamp);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  // ============================================
  // REPORTING & ANALYTICS
  // ============================================

  getCalendarOverview() {
    const members = Array.from(this.members.values());
    const totalEvents = this.events.size;
    const upcomingEvents = this.getUpcomingEvents(null, 24);
    const activeConflicts = this.conflicts.length;

    return {
      familyMembers: members.length,
      totalEvents,
      upcomingToday: upcomingEvents.length,
      activeConflicts,
      pendingReminders: this.reminders.filter(r => r.status === 'pending').length
    };
  }

  getMemberSummary(memberId) {
    const member = this.members.get(memberId);
    
    if (!member) return null;

    const upcoming = this.getUpcomingEvents(memberId, 168); // Next week
    const today = this.getDaySchedule(Date.now(), memberId);

    const eventTypes = {};
    for (const event of upcoming) {
      eventTypes[event.type] = (eventTypes[event.type] || 0) + 1;
    }

    return {
      name: member.name,
      location: member.location,
      availability: member.availability,
      todayEvents: today.length,
      upcomingWeek: upcoming.length,
      eventsByType: eventTypes,
      nextEvent: upcoming[0] ? {
        title: upcoming[0].title,
        time: new Date(upcoming[0].startTime).toLocaleString('sv-SE')
      } : null
    };
  }

  getWeekView(startDate = Date.now()) {
    const week = [];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate + i * 24 * 60 * 60 * 1000);
      const events = this.getDaySchedule(date);
      
      week.push({
        date: date.toLocaleDateString('sv-SE'),
        dayName: date.toLocaleDateString('sv-SE', { weekday: 'long' }),
        events: events.map(e => ({
          time: new Date(e.startTime).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
          title: e.title,
          attendees: e.attendees.map(a => this.members.get(a)?.name).filter(Boolean)
        }))
      });
    }

    return week;
  }

  getConflictReport() {
    return {
      totalConflicts: this.conflicts.length,
      bySeverity: {
        critical: this.conflicts.filter(c => c.severity === 'critical').length,
        high: this.conflicts.filter(c => c.severity === 'high').length,
        medium: this.conflicts.filter(c => c.severity === 'medium').length,
        low: this.conflicts.filter(c => c.severity === 'low').length
      },
      conflicts: this.conflicts.map(c => {
        const event1 = this.events.get(c.event1);
        const event2 = this.events.get(c.event2);
        const memberNames = c.members.map(m => this.members.get(m)?.name).join(', ');
        
        return {
          severity: c.severity,
          members: memberNames,
          event1: event1.title,
          event2: event2.title,
          time: new Date(event1.startTime).toLocaleString('sv-SE')
        };
      })
    };
  }

  destroy() {
    if (this._intervals) {
      this._intervals.forEach(id => clearInterval(id));
      this._intervals = [];
    }
  }
}

module.exports = FamilyCalendarCoordinator;
