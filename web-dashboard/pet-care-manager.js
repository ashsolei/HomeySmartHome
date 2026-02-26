'use strict';

/**
 * Pet Care Manager
 * Automated pet care, feeding schedules, activity tracking
 */
class PetCareManager {
  constructor(app) {
    this.app = app;
    this.pets = new Map();
    this.feedingSchedules = new Map();
    this.activities = [];
    this.healthRecords = new Map();
    this.reminders = new Map();
  }

  async initialize() {
    await this.loadPets();
    await this.loadFeedingSchedules();
    await this.loadHealthRecords();
    await this.loadReminders();
    
    this.startMonitoring();
  }

  // ============================================
  // PET PROFILES
  // ============================================

  async loadPets() {
    const petConfigs = [
      {
        id: 'pet_1',
        name: 'Charlie',
        species: 'dog',
        breed: 'Golden Retriever',
        birthdate: new Date('2020-05-15').getTime(),
        weight: 28.5, // kg
        gender: 'male',
        microchipId: 'SE123456789',
        insurance: {
          provider: 'Agria',
          policyNumber: 'AG-2020-12345',
          expiryDate: new Date('2025-05-15').getTime()
        },
        vet: {
          name: 'Djurkliniken Södermalm',
          phone: '08-123456',
          lastVisit: new Date('2024-03-10').getTime()
        }
      },
      {
        id: 'pet_2',
        name: 'Luna',
        species: 'cat',
        breed: 'Norwegian Forest Cat',
        birthdate: new Date('2021-08-20').getTime(),
        weight: 5.2,
        gender: 'female',
        microchipId: 'SE987654321',
        insurance: {
          provider: 'Agria',
          policyNumber: 'AG-2021-54321',
          expiryDate: new Date('2025-08-20').getTime()
        },
        vet: {
          name: 'Djurkliniken Södermalm',
          phone: '08-123456',
          lastVisit: new Date('2024-02-15').getTime()
        }
      }
    ];

    for (const config of petConfigs) {
      this.pets.set(config.id, {
        ...config,
        presence: 'home',
        lastSeen: Date.now(),
        activityLevel: 'normal'
      });
    }
  }

  // ============================================
  // FEEDING MANAGEMENT
  // ============================================

  async loadFeedingSchedules() {
    // Charlie (dog) - twice daily
    await this.createFeedingSchedule({
      petId: 'pet_1',
      schedules: [
        {
          time: '07:30',
          amount: 200, // grams
          type: 'dry_food',
          days: [1, 2, 3, 4, 5, 6, 0] // All days
        },
        {
          time: '17:30',
          amount: 200,
          type: 'dry_food',
          days: [1, 2, 3, 4, 5, 6, 0]
        }
      ],
      dailyAmount: 400,
      treats: {
        maxDaily: 50, // grams
        current: 0
      }
    });

    // Luna (cat) - free feeding with monitoring
    await this.createFeedingSchedule({
      petId: 'pet_2',
      schedules: [
        {
          time: '08:00',
          amount: 60, // grams
          type: 'wet_food',
          days: [1, 2, 3, 4, 5, 6, 0]
        },
        {
          time: '18:00',
          amount: 60,
          type: 'wet_food',
          days: [1, 2, 3, 4, 5, 6, 0]
        }
      ],
      dailyAmount: 120,
      dryFoodAvailable: true, // Free feeding dry food
      treats: {
        maxDaily: 20,
        current: 0
      }
    });
  }

  async createFeedingSchedule(config) {
    this.feedingSchedules.set(config.petId, {
      ...config,
      history: [],
      lastFed: null,
      missedFeedings: 0
    });

    return { success: true };
  }

  async recordFeeding(petId, data) {
    const schedule = this.feedingSchedules.get(petId);
    
    if (!schedule) {
      return { success: false, error: 'Pet not found' };
    }

    const feeding = {
      timestamp: Date.now(),
      amount: data.amount,
      type: data.type,
      notes: data.notes || '',
      fedBy: data.fedBy || 'auto'
    };

    schedule.history.push(feeding);
    schedule.lastFed = Date.now();

    // Keep last 30 days
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    schedule.history = schedule.history.filter(f => f.timestamp >= cutoff);

    console.log(`🍽️ Fed ${this.pets.get(petId).name}: ${data.amount}g ${data.type}`);

    return { success: true, feeding };
  }

  async dispenseTreat(petId, amount) {
    const schedule = this.feedingSchedules.get(petId);
    
    if (!schedule) {
      return { success: false, error: 'Pet not found' };
    }

    // Check daily limit
    if (schedule.treats.current + amount > schedule.treats.maxDaily) {
      return { 
        success: false, 
        error: `Daily treat limit reached (${schedule.treats.maxDaily}g)` 
      };
    }

    schedule.treats.current += amount;

    await this.recordFeeding(petId, {
      amount,
      type: 'treat',
      fedBy: 'manual'
    });

    console.log(`🦴 Treat dispensed to ${this.pets.get(petId).name}: ${amount}g`);

    return { success: true, remaining: schedule.treats.maxDaily - schedule.treats.current };
  }

  // ============================================
  // ACTIVITY TRACKING
  // ============================================

  startMonitoring() {
    // Check feeding schedules every minute
    setInterval(() => {
      this.checkFeedingSchedules();
    }, 60 * 1000);

    // Track activity every 5 minutes
    setInterval(() => {
      this.trackActivity();
    }, 5 * 60 * 1000);

    // Check reminders daily
    setInterval(() => {
      this.checkReminders();
    }, 60 * 60 * 1000);

    // Reset daily counters at midnight
    setInterval(() => {
      this.resetDailyCounters();
    }, 60 * 60 * 1000);

    // Initial checks
    this.checkFeedingSchedules();
    this.checkReminders();
  }

  async checkFeedingSchedules() {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const currentDay = now.getDay();

    for (const [petId, schedule] of this.feedingSchedules) {
      for (const feeding of schedule.schedules) {
        if (feeding.time !== currentTime) continue;
        if (!feeding.days.includes(currentDay)) continue;

        // Time to feed!
        const pet = this.pets.get(petId);
        console.log(`🔔 Feeding time for ${pet.name}!`);

        // Send notification
        // await this.app.notifications.send({
        //   title: 'Matningstid!',
        //   message: `Dags att mata ${pet.name} (${feeding.amount}g ${feeding.type})`,
        //   priority: 'high'
        // });

        // If auto-feeder available, dispense food
        // await this.app.devices.get('auto_feeder').dispense({
        //   petId,
        //   amount: feeding.amount
        // });

        // Record feeding
        await this.recordFeeding(petId, {
          amount: feeding.amount,
          type: feeding.type,
          fedBy: 'auto'
        });
      }
    }
  }

  async trackActivity() {
    for (const [petId, pet] of this.pets) {
      // Simulate activity detection
      const activity = this.simulateActivity(pet);
      
      this.activities.push({
        petId,
        timestamp: Date.now(),
        ...activity
      });

      // Keep last 7 days
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      this.activities = this.activities.filter(a => a.timestamp >= cutoff);

      // Update pet activity level
      pet.activityLevel = activity.level;
      pet.lastSeen = Date.now();
      pet.presence = activity.location;
    }
  }

  simulateActivity(pet) {
    const hour = new Date().getHours();

    if (pet.species === 'dog') {
      // Dogs are more active during day, especially morning and evening
      let baseActivity = 30;
      
      if (hour >= 6 && hour <= 9) baseActivity = 80; // Morning walk
      else if (hour >= 17 && hour <= 20) baseActivity = 75; // Evening activity
      else if (hour >= 22 || hour <= 5) baseActivity = 5; // Sleeping

      const activity = baseActivity + (Math.random() - 0.5) * 20;

      return {
        level: activity > 60 ? 'high' : activity > 30 ? 'normal' : 'low',
        activity: Math.round(activity),
        location: activity < 10 ? 'sleeping' : 'home',
        distance: activity > 60 ? Math.random() * 2000 : 0 // meters walked
      };
    } else {
      // Cats - more active dawn/dusk
      let baseActivity = 40;
      
      if ((hour >= 5 && hour <= 7) || (hour >= 18 && hour <= 21)) {
        baseActivity = 70; // Crepuscular activity
      } else if (hour >= 13 && hour <= 16) {
        baseActivity = 10; // Afternoon nap
      }

      const activity = baseActivity + (Math.random() - 0.5) * 30;

      return {
        level: activity > 60 ? 'high' : activity > 30 ? 'normal' : 'low',
        activity: Math.round(activity),
        location: activity < 15 ? 'sleeping' : Math.random() > 0.2 ? 'home' : 'outside'
      };
    }
  }

  // ============================================
  // HEALTH RECORDS
  // ============================================

  async loadHealthRecords() {
    // Charlie's records
    const charlieRecords = [
      {
        date: new Date('2024-03-10').getTime(),
        type: 'vaccination',
        description: 'Årlig vaccination',
        vet: 'Dr. Andersson',
        nextDue: new Date('2025-03-10').getTime()
      },
      {
        date: new Date('2024-01-15').getTime(),
        type: 'checkup',
        description: 'Årlig hälsokontroll',
        weight: 28.5,
        notes: 'God hälsa, fortsätt nuvarande diet'
      },
      {
        date: new Date('2023-09-20').getTime(),
        type: 'treatment',
        description: 'Mask/loppskur',
        nextDue: new Date('2024-09-20').getTime()
      }
    ];

    // Luna's records
    const lunaRecords = [
      {
        date: new Date('2024-02-15').getTime(),
        type: 'vaccination',
        description: 'Årlig vaccination',
        vet: 'Dr. Andersson',
        nextDue: new Date('2025-02-15').getTime()
      },
      {
        date: new Date('2023-12-01').getTime(),
        type: 'checkup',
        description: 'Hälsokontroll',
        weight: 5.2,
        notes: 'Frisk katt, rekommenderar tandvård'
      }
    ];

    this.healthRecords.set('pet_1', charlieRecords);
    this.healthRecords.set('pet_2', lunaRecords);
  }

  async addHealthRecord(petId, record) {
    if (!this.healthRecords.has(petId)) {
      this.healthRecords.set(petId, []);
    }

    const healthRecord = {
      id: `health_${Date.now()}`,
      date: Date.now(),
      ...record
    };

    this.healthRecords.get(petId).push(healthRecord);

    // Create reminder if next appointment due
    if (record.nextDue) {
      await this.createReminder({
        petId,
        type: record.type,
        description: `${record.description} - uppföljning`,
        dueDate: record.nextDue
      });
    }

    return { success: true, record: healthRecord };
  }

  // ============================================
  // REMINDERS
  // ============================================

  async loadReminders() {
    // Check all health records for upcoming appointments
    for (const [petId, records] of this.healthRecords) {
      const _pet = this.pets.get(petId);
      
      for (const record of records) {
        if (record.nextDue && record.nextDue > Date.now()) {
          await this.createReminder({
            petId,
            type: record.type,
            description: record.description,
            dueDate: record.nextDue
          });
        }
      }
    }
  }

  async createReminder(config) {
    const reminder = {
      id: config.id || `reminder_${Date.now()}`,
      petId: config.petId,
      type: config.type, // 'vaccination', 'checkup', 'medication', 'grooming', etc.
      description: config.description,
      dueDate: config.dueDate,
      recurring: config.recurring || null,
      completed: false,
      notificationSent: false
    };

    this.reminders.set(reminder.id, reminder);

    return { success: true, reminder };
  }

  async checkReminders() {
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    for (const [_reminderId, reminder] of this.reminders) {
      if (reminder.completed) continue;
      if (reminder.notificationSent) continue;

      const timeUntilDue = reminder.dueDate - now;

      // Send notification 7 days before
      if (timeUntilDue > 0 && timeUntilDue <= sevenDays) {
        const pet = this.pets.get(reminder.petId);
        const daysUntil = Math.ceil(timeUntilDue / (24 * 60 * 60 * 1000));

        console.log(`🔔 Reminder: ${pet.name} - ${reminder.description} om ${daysUntil} dag(ar)`);

        // await this.app.notifications.send({
        //   title: `Husdjurspåminnelse: ${pet.name}`,
        //   message: `${reminder.description} om ${daysUntil} dag(ar)`,
        //   priority: 'medium'
        // });

        reminder.notificationSent = true;
      }

      // Mark overdue
      if (timeUntilDue < 0) {
        console.log(`⚠️ Overdue: ${this.pets.get(reminder.petId).name} - ${reminder.description}`);
      }
    }
  }

  async completeReminder(reminderId) {
    const reminder = this.reminders.get(reminderId);
    
    if (!reminder) {
      return { success: false, error: 'Reminder not found' };
    }

    reminder.completed = true;

    // If recurring, create next reminder
    if (reminder.recurring) {
      const nextDue = this.calculateNextDueDate(reminder.dueDate, reminder.recurring);
      
      await this.createReminder({
        petId: reminder.petId,
        type: reminder.type,
        description: reminder.description,
        dueDate: nextDue,
        recurring: reminder.recurring
      });
    }

    return { success: true };
  }

  calculateNextDueDate(currentDue, recurring) {
    const date = new Date(currentDue);

    switch (recurring.interval) {
      case 'daily':
        date.setDate(date.getDate() + recurring.count);
        break;
      case 'weekly':
        date.setDate(date.getDate() + recurring.count * 7);
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + recurring.count);
        break;
      case 'yearly':
        date.setFullYear(date.getFullYear() + recurring.count);
        break;
    }

    return date.getTime();
  }

  resetDailyCounters() {
    const hour = new Date().getHours();
    
    // Reset at midnight
    if (hour === 0) {
      for (const [_petId, schedule] of this.feedingSchedules) {
        schedule.treats.current = 0;
      }
    }
  }

  // ============================================
  // ANALYTICS & REPORTING
  // ============================================

  getPetProfile(petId) {
    const pet = this.pets.get(petId);
    
    if (!pet) return null;

    const age = Math.floor((Date.now() - pet.birthdate) / (365.25 * 24 * 60 * 60 * 1000));
    const feedingSchedule = this.feedingSchedules.get(petId);
    const _healthRecords = this.healthRecords.get(petId) || [];
    const upcomingReminders = Array.from(this.reminders.values())
      .filter(r => r.petId === petId && !r.completed && r.dueDate > Date.now())
      .sort((a, b) => a.dueDate - b.dueDate);

    return {
      ...pet,
      age,
      lastFed: feedingSchedule?.lastFed,
      dailyFeedings: feedingSchedule?.schedules.length,
      recentActivity: this.getRecentActivity(petId, 24),
      upcomingReminders: upcomingReminders.slice(0, 5),
      lastVetVisit: pet.vet.lastVisit,
      insuranceValid: pet.insurance.expiryDate > Date.now()
    };
  }

  getAllPets() {
    return Array.from(this.pets.values()).map(p => ({
      id: p.id,
      name: p.name,
      species: p.species,
      breed: p.breed,
      age: Math.floor((Date.now() - p.birthdate) / (365.25 * 24 * 60 * 60 * 1000)),
      presence: p.presence,
      activityLevel: p.activityLevel
    }));
  }

  getRecentActivity(petId, hours = 24) {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    
    return this.activities
      .filter(a => a.petId === petId && a.timestamp >= cutoff)
      .map(a => ({
        timestamp: a.timestamp,
        level: a.level,
        location: a.location
      }));
  }

  getActivitySummary(petId, days = 7) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const activities = this.activities.filter(
      a => a.petId === petId && a.timestamp >= cutoff
    );

    if (activities.length === 0) {
      return { error: 'No activity data' };
    }

    const avgActivity = activities.reduce((sum, a) => sum + a.activity, 0) / activities.length;
    const totalDistance = activities.reduce((sum, a) => sum + (a.distance || 0), 0);

    return {
      period: `${days} days`,
      averageActivity: Math.round(avgActivity),
      totalDistance: Math.round(totalDistance),
      mostActiveTime: this.getMostActiveTime(activities),
      activityByDay: this.getActivityByDay(activities)
    };
  }

  getMostActiveTime(activities) {
    const hourCounts = {};
    
    for (const activity of activities) {
      const hour = new Date(activity.timestamp).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + activity.activity;
    }

    const maxHour = Object.entries(hourCounts)
      .sort((a, b) => b[1] - a[1])[0];

    return maxHour ? `${maxHour[0]}:00` : 'N/A';
  }

  getActivityByDay(activities) {
    const dayData = {};

    for (const activity of activities) {
      const date = new Date(activity.timestamp).toLocaleDateString('sv-SE');
      
      if (!dayData[date]) {
        dayData[date] = { count: 0, total: 0 };
      }

      dayData[date].count++;
      dayData[date].total += activity.activity;
    }

    return Object.entries(dayData).map(([date, data]) => ({
      date,
      average: Math.round(data.total / data.count)
    }));
  }

  getFeedingHistory(petId, days = 7) {
    const schedule = this.feedingSchedules.get(petId);
    
    if (!schedule) return null;

    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const history = schedule.history.filter(f => f.timestamp >= cutoff);

    const totalAmount = history.reduce((sum, f) => sum + f.amount, 0);
    const treats = history.filter(f => f.type === 'treat');
    const treatAmount = treats.reduce((sum, f) => sum + f.amount, 0);

    return {
      period: `${days} days`,
      totalFeedings: history.length,
      totalAmount,
      dailyAverage: Math.round(totalAmount / days),
      treatCount: treats.length,
      treatAmount,
      missedFeedings: schedule.missedFeedings
    };
  }

  getHealthRecordsSummary(petId) {
    const records = this.healthRecords.get(petId) || [];
    
    const vaccinations = records.filter(r => r.type === 'vaccination');
    const checkups = records.filter(r => r.type === 'checkup');
    
    const lastVaccination = vaccinations.sort((a, b) => b.date - a.date)[0];
    const lastCheckup = checkups.sort((a, b) => b.date - a.date)[0];

    return {
      totalRecords: records.length,
      lastVaccination: lastVaccination ? {
        date: lastVaccination.date,
        description: lastVaccination.description,
        nextDue: lastVaccination.nextDue
      } : null,
      lastCheckup: lastCheckup ? {
        date: lastCheckup.date,
        weight: lastCheckup.weight,
        notes: lastCheckup.notes
      } : null,
      upcomingAppointments: records
        .filter(r => r.nextDue && r.nextDue > Date.now())
        .length
    };
  }

  getUpcomingReminders() {
    return Array.from(this.reminders.values())
      .filter(r => !r.completed && r.dueDate > Date.now())
      .sort((a, b) => a.dueDate - b.dueDate)
      .map(r => ({
        id: r.id,
        petName: this.pets.get(r.petId)?.name,
        type: r.type,
        description: r.description,
        dueDate: r.dueDate,
        daysUntil: Math.ceil((r.dueDate - Date.now()) / (24 * 60 * 60 * 1000))
      }));
  }

  getPetCareTips(species) {
    const dogTips = [
      'Daglig motion är viktigt - minst 30-60 minuter',
      'Träna mentalt med leksaksleks och tricks',
      'Regelbunden tandvård förebygger sjukdomar',
      'Socialisera ofta med andra hundar',
      'Håll vaccination och avmaskning uppdaterad'
    ];

    const catTips = [
      'Katter behöver klösträning - ha klösbräda',
      'Lämna kattungen lugn - de sover 16-20 timmar',
      'Stimulera jaktinstinkten med leksaker',
      'Håll kattlådan ren - rengör dagligen',
      'Regelbunden pälsvård minskar hårbollar'
    ];

    return species === 'dog' ? dogTips : catTips;
  }
}

module.exports = PetCareManager;
