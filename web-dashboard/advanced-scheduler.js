'use strict';

/**
 * Advanced Scheduling System
 * Complex time-based automation with exceptions, holidays, and smart scheduling
 */
class AdvancedScheduler {
  constructor(app) {
    this._intervals = [];
    this._timeouts = [];
    this.app = app;
    this.schedules = new Map();
    this.holidays = [];
    this.exceptions = [];
    this.activeTimers = new Map();
    this.executionHistory = [];
  }

  async initialize() {
    // Load schedules
    await this.loadSchedules();
    
    // Load holidays
    await this.loadHolidays();
    
    // Start scheduler engine
    this.startSchedulerEngine();
  }

  // ============================================
  // SCHEDULE MANAGEMENT
  // ============================================

  async createSchedule(config) {
    const schedule = {
      id: config.id || `schedule_${Date.now()}`,
      name: config.name,
      description: config.description || '',
      enabled: config.enabled !== false,
      type: config.type, // 'time', 'sunrise', 'sunset', 'interval', 'cron'
      
      // Time configuration
      time: config.time,
      days: config.days || [1, 2, 3, 4, 5, 6, 7], // 1=Monday, 7=Sunday
      
      // Advanced options
      randomOffset: config.randomOffset || 0, // Random minutes +/-
      repeatEvery: config.repeatEvery, // For interval type
      
      // Conditions
      conditions: config.conditions || [],
      skipHolidays: config.skipHolidays || false,
      skipWeekends: config.skipWeekends || false,
      onlyHolidays: config.onlyHolidays || false,
      
      // Date range
      startDate: config.startDate,
      endDate: config.endDate,
      
      // Exceptions
      exceptions: config.exceptions || [],
      
      // Actions
      actions: config.actions || [],
      
      // Metadata
      created: Date.now(),
      lastRun: 0,
      nextRun: 0,
      runCount: 0
    };

    // Calculate next run time
    schedule.nextRun = this.calculateNextRun(schedule);

    this.schedules.set(schedule.id, schedule);

    // Set up timer
    this.scheduleExecution(schedule);

    return {
      success: true,
      schedule: this.getScheduleInfo(schedule.id)
    };
  }

  async updateSchedule(scheduleId, updates) {
    const schedule = this.schedules.get(scheduleId);
    
    if (!schedule) {
      return { success: false, error: 'Schedule not found' };
    }

    // Clear existing timer
    this.clearScheduleTimer(scheduleId);

    // Update schedule
    Object.assign(schedule, updates);

    // Recalculate next run
    schedule.nextRun = this.calculateNextRun(schedule);

    // Reschedule
    this.scheduleExecution(schedule);

    return {
      success: true,
      schedule: this.getScheduleInfo(scheduleId)
    };
  }

  async deleteSchedule(scheduleId) {
    const schedule = this.schedules.get(scheduleId);
    
    if (!schedule) {
      return { success: false, error: 'Schedule not found' };
    }

    // Clear timer
    this.clearScheduleTimer(scheduleId);

    // Remove schedule
    this.schedules.delete(scheduleId);

    return { success: true };
  }

  // ============================================
  // SCHEDULING ENGINE
  // ============================================

  startSchedulerEngine() {
    // Check schedules every minute
    this._intervals.push(setInterval(() => {
      this.checkSchedules();
    }, 60 * 1000));

    // Initial check
    this.checkSchedules();
  }

  checkSchedules() {
    const now = Date.now();
    
    for (const [scheduleId, schedule] of this.schedules) {
      if (!schedule.enabled) continue;
      
      // Check if schedule should run
      if (schedule.nextRun && now >= schedule.nextRun) {
        this.executeSchedule(scheduleId);
      }
    }
  }

  scheduleExecution(schedule) {
    if (!schedule.enabled || !schedule.nextRun) return;

    const delay = schedule.nextRun - Date.now();
    
    if (delay <= 0) {
      // Should run now
      this.executeSchedule(schedule.id);
      return;
    }

    // Set timer
    const timer = setTimeout(() => {
      this.executeSchedule(schedule.id);
    }, Math.min(delay, 2147483647)); // Max setTimeout value

    this.activeTimers.set(schedule.id, timer);
  }

  clearScheduleTimer(scheduleId) {
    const timer = this.activeTimers.get(scheduleId);
    
    if (timer) {
      clearTimeout(timer);
      this.activeTimers.delete(scheduleId);
    }
  }

  async executeSchedule(scheduleId) {
    const schedule = this.schedules.get(scheduleId);
    
    if (!schedule || !schedule.enabled) return;

    // Check conditions
    if (!await this.checkConditions(schedule)) {
      console.log(`Schedule ${schedule.name}: Conditions not met`);
      
      // Calculate next run
      schedule.nextRun = this.calculateNextRun(schedule);
      this.scheduleExecution(schedule);
      return;
    }

    // Execute actions
    console.log(`Executing schedule: ${schedule.name}`);
    
    const results = [];
    for (const action of schedule.actions) {
      try {
        const result = await this.executeAction(action);
        results.push({ action, result, success: true });
      } catch (error) {
        console.error(`Action failed:`, error);
        results.push({ action, error: error.message, success: false });
      }
    }

    // Update schedule
    schedule.lastRun = Date.now();
    schedule.runCount++;
    schedule.nextRun = this.calculateNextRun(schedule);

    // Log execution
    this.logExecution({
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      timestamp: Date.now(),
      results,
      success: results.every(r => r.success)
    });

    // Schedule next run
    this.scheduleExecution(schedule);
  }

  async executeAction(action) {
    console.log(`  → Action: ${action.type}`);
    
    switch (action.type) {
      case 'device_on':
        // await this.app.devices.get(action.deviceId).setCapability('onoff', true);
        break;
      
      case 'device_off':
        // await this.app.devices.get(action.deviceId).setCapability('onoff', false);
        break;
      
      case 'set_dim':
        // await this.app.devices.get(action.deviceId).setCapability('dim', action.value);
        break;
      
      case 'set_temperature':
        // await this.app.devices.get(action.deviceId).setCapability('target_temperature', action.value);
        break;
      
      case 'scene':
        // await this.app.flow.triggerScene(action.sceneId);
        break;
      
      case 'notification':
        console.log(`    Notification: ${action.message}`);
        break;
      
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }

    return { executed: true };
  }

  // ============================================
  // TIME CALCULATION
  // ============================================

  calculateNextRun(schedule) {
    if (!schedule.enabled) return null;

    const now = new Date();
    let nextRun;

    switch (schedule.type) {
      case 'time':
        nextRun = this.calculateTimeBasedRun(schedule, now);
        break;
      
      case 'sunrise':
        nextRun = this.calculateSunriseRun(schedule, now);
        break;
      
      case 'sunset':
        nextRun = this.calculateSunsetRun(schedule, now);
        break;
      
      case 'interval':
        nextRun = this.calculateIntervalRun(schedule, now);
        break;
      
      case 'cron':
        nextRun = this.calculateCronRun(schedule, now);
        break;
      
      default:
        return null;
    }

    // Apply random offset
    if (schedule.randomOffset > 0 && nextRun) {
      const offset = (Math.random() * schedule.randomOffset * 2 - schedule.randomOffset) * 60 * 1000;
      nextRun = new Date(nextRun.getTime() + offset);
    }

    // Check if within date range
    if (schedule.startDate && nextRun < new Date(schedule.startDate)) {
      nextRun = new Date(schedule.startDate);
    }
    
    if (schedule.endDate && nextRun > new Date(schedule.endDate)) {
      return null; // Schedule expired
    }

    // Check exceptions
    while (nextRun && this.isException(nextRun, schedule)) {
      nextRun = this.getNextValidDate(nextRun, schedule);
    }

    return nextRun ? nextRun.getTime() : null;
  }

  calculateTimeBasedRun(schedule, now) {
    const [hours, minutes] = schedule.time.split(':').map(Number);
    
    let next = new Date(now);
    next.setHours(hours, minutes, 0, 0);

    // If time has passed today, move to next valid day
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    // Find next valid day
    while (!this.isValidDay(next, schedule)) {
      next.setDate(next.getDate() + 1);
    }

    return next;
  }

  calculateSunriseRun(schedule, now) {
    // Simulate sunrise time (in production, use actual sunrise calculation)
    const sunrise = new Date(now);
    sunrise.setHours(6, 30, 0, 0);

    // Apply offset
    if (schedule.offset) {
      sunrise.setMinutes(sunrise.getMinutes() + schedule.offset);
    }

    if (sunrise <= now) {
      sunrise.setDate(sunrise.getDate() + 1);
    }

    while (!this.isValidDay(sunrise, schedule)) {
      sunrise.setDate(sunrise.getDate() + 1);
    }

    return sunrise;
  }

  calculateSunsetRun(schedule, now) {
    // Simulate sunset time (in production, use actual sunset calculation)
    const sunset = new Date(now);
    sunset.setHours(18, 30, 0, 0);

    // Apply offset
    if (schedule.offset) {
      sunset.setMinutes(sunset.getMinutes() + schedule.offset);
    }

    if (sunset <= now) {
      sunset.setDate(sunset.getDate() + 1);
    }

    while (!this.isValidDay(sunset, schedule)) {
      sunset.setDate(sunset.getDate() + 1);
    }

    return sunset;
  }

  calculateIntervalRun(schedule, now) {
    if (!schedule.repeatEvery) return null;

    const interval = schedule.repeatEvery * 60 * 1000; // Minutes to ms
    const lastRun = schedule.lastRun || now.getTime();
    
    return new Date(lastRun + interval);
  }

  calculateCronRun(schedule, now) {
    // Simplified cron parsing (in production, use a cron library)
    // Format: "minute hour day month dayOfWeek"
    
    // For demo, just schedule for next hour
    const next = new Date(now);
    next.setHours(next.getHours() + 1, 0, 0, 0);
    
    return next;
  }

  // ============================================
  // VALIDATION
  // ============================================

  isValidDay(date, schedule) {
    const dayOfWeek = date.getDay() || 7; // Convert Sunday (0) to 7
    
    // Check if day is in allowed days
    if (!schedule.days.includes(dayOfWeek)) {
      return false;
    }

    // Check weekend skip
    if (schedule.skipWeekends && (dayOfWeek === 6 || dayOfWeek === 7)) {
      return false;
    }

    // Check holiday conditions
    const isHoliday = this.isHoliday(date);
    
    if (schedule.skipHolidays && isHoliday) {
      return false;
    }
    
    if (schedule.onlyHolidays && !isHoliday) {
      return false;
    }

    return true;
  }

  isException(date, schedule) {
    if (!schedule.exceptions || schedule.exceptions.length === 0) {
      return false;
    }

    const dateStr = date.toISOString().split('T')[0];
    
    return schedule.exceptions.some(exception => {
      if (exception.date === dateStr) return true;
      
      if (exception.startDate && exception.endDate) {
        return dateStr >= exception.startDate && dateStr <= exception.endDate;
      }
      
      return false;
    });
  }

  getNextValidDate(date, schedule) {
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    
    let attempts = 0;
    while (!this.isValidDay(next, schedule) && attempts < 365) {
      next.setDate(next.getDate() + 1);
      attempts++;
    }
    
    return attempts < 365 ? next : null;
  }

  async checkConditions(schedule) {
    if (!schedule.conditions || schedule.conditions.length === 0) {
      return true;
    }

    for (const condition of schedule.conditions) {
      if (!await this.evaluateCondition(condition)) {
        return false;
      }
    }

    return true;
  }

  async evaluateCondition(condition) {
    switch (condition.type) {
      case 'weather':
        // Check weather condition
        return true; // Simplified
      
      case 'temperature':
        // Check temperature
        return true; // Simplified
      
      case 'device_state':
        // Check device state
        return true; // Simplified
      
      case 'presence':
        // Check presence
        return true; // Simplified
      
      default:
        return true;
    }
  }

  // ============================================
  // HOLIDAYS
  // ============================================

  async loadHolidays() {
    // Swedish holidays for 2026
    this.holidays = [
      { date: '2026-01-01', name: 'Nyårsdagen' },
      { date: '2026-01-06', name: 'Trettondedag jul' },
      { date: '2026-04-03', name: 'Långfredagen' },
      { date: '2026-04-05', name: 'Påskdagen' },
      { date: '2026-04-06', name: 'Annandag påsk' },
      { date: '2026-05-01', name: 'Första maj' },
      { date: '2026-05-14', name: 'Kristi himmelsfärdsdag' },
      { date: '2026-05-24', name: 'Pingstdagen' },
      { date: '2026-06-06', name: 'Sveriges nationaldag' },
      { date: '2026-06-19', name: 'Midsommarafton' },
      { date: '2026-06-20', name: 'Midsommardagen' },
      { date: '2026-10-31', name: 'Alla helgons dag' },
      { date: '2026-12-24', name: 'Julafton' },
      { date: '2026-12-25', name: 'Juldagen' },
      { date: '2026-12-26', name: 'Annandag jul' },
      { date: '2026-12-31', name: 'Nyårsafton' }
    ];
  }

  isHoliday(date) {
    const dateStr = date.toISOString().split('T')[0];
    return this.holidays.some(h => h.date === dateStr);
  }

  getHolidayName(date) {
    const dateStr = date.toISOString().split('T')[0];
    const holiday = this.holidays.find(h => h.date === dateStr);
    return holiday ? holiday.name : null;
  }

  // ============================================
  // TEMPLATES
  // ============================================

  async createFromTemplate(templateName, params = {}) {
    const templates = {
      'morning_routine': {
        name: 'Morgonrutin',
        type: 'time',
        time: params.time || '07:00',
        days: [1, 2, 3, 4, 5], // Weekdays
        actions: [
          { type: 'device_on', deviceId: 'bedroom_lights', description: 'Tänd sovrumslampa' },
          { type: 'set_temperature', deviceId: 'thermostat', value: 21 },
          { type: 'notification', message: 'God morgon!' }
        ]
      },
      'evening_routine': {
        name: 'Kvällsrutin',
        type: 'sunset',
        offset: 30, // 30 minutes after sunset
        actions: [
          { type: 'device_on', deviceId: 'living_room_lights' },
          { type: 'device_off', deviceId: 'outdoor_lights' }
        ]
      },
      'away_mode': {
        name: 'Bortaläge - Ljussimulering',
        type: 'time',
        time: '19:00',
        randomOffset: 30,
        actions: [
          { type: 'device_on', deviceId: 'random_lights' }
        ]
      },
      'night_mode': {
        name: 'Nattläge',
        type: 'time',
        time: '23:00',
        actions: [
          { type: 'device_off', deviceId: 'all_lights' },
          { type: 'set_temperature', deviceId: 'thermostat', value: 18 }
        ]
      }
    };

    const template = templates[templateName];
    
    if (!template) {
      return { success: false, error: 'Template not found' };
    }

    // Merge params
    const config = { ...template, ...params };

    return await this.createSchedule(config);
  }

  getTemplates() {
    return [
      { id: 'morning_routine', name: 'Morgonrutin', description: 'Daglig morgonrutin' },
      { id: 'evening_routine', name: 'Kvällsrutin', description: 'Kvällsrutin vid solnedgång' },
      { id: 'away_mode', name: 'Bortaläge', description: 'Ljussimulering när du är borta' },
      { id: 'night_mode', name: 'Nattläge', description: 'Nattinställningar' }
    ];
  }

  // ============================================
  // ANALYTICS & REPORTING
  // ============================================

  getScheduleInfo(scheduleId) {
    const schedule = this.schedules.get(scheduleId);
    
    if (!schedule) return null;

    return {
      id: schedule.id,
      name: schedule.name,
      description: schedule.description,
      type: schedule.type,
      enabled: schedule.enabled,
      nextRun: schedule.nextRun,
      lastRun: schedule.lastRun,
      runCount: schedule.runCount,
      actions: schedule.actions.length
    };
  }

  getAllSchedules() {
    return Array.from(this.schedules.values()).map(s => ({
      id: s.id,
      name: s.name,
      type: s.type,
      enabled: s.enabled,
      nextRun: s.nextRun,
      lastRun: s.lastRun
    }));
  }

  getUpcomingSchedules(limit = 10) {
    const schedules = Array.from(this.schedules.values())
      .filter(s => s.enabled && s.nextRun)
      .sort((a, b) => a.nextRun - b.nextRun)
      .slice(0, limit);

    return schedules.map(s => ({
      id: s.id,
      name: s.name,
      nextRun: s.nextRun,
      type: s.type
    }));
  }

  getScheduleStats() {
    const schedules = Array.from(this.schedules.values());
    
    return {
      total: schedules.length,
      enabled: schedules.filter(s => s.enabled).length,
      disabled: schedules.filter(s => !s.enabled).length,
      byType: {
        time: schedules.filter(s => s.type === 'time').length,
        sunrise: schedules.filter(s => s.type === 'sunrise').length,
        sunset: schedules.filter(s => s.type === 'sunset').length,
        interval: schedules.filter(s => s.type === 'interval').length,
        cron: schedules.filter(s => s.type === 'cron').length
      },
      totalExecutions: schedules.reduce((sum, s) => sum + s.runCount, 0),
      nextScheduled: this.getUpcomingSchedules(1)[0]
    };
  }

  getExecutionHistory(limit = 50) {
    return this.executionHistory.slice(-limit).reverse();
  }

  logExecution(execution) {
    this.executionHistory.push(execution);

    // Trim history
    if (this.executionHistory.length > 1000) {
      this.executionHistory = this.executionHistory.slice(-1000);
    }
  }

  // ============================================
  // UTILITIES
  // ============================================

  async loadSchedules() {
    // Load saved schedules (integrate with storage)
    // For demo, create a few example schedules
    
    await this.createSchedule({
      name: 'Morgonbelysning',
      type: 'time',
      time: '06:30',
      days: [1, 2, 3, 4, 5],
      actions: [
        { type: 'device_on', deviceId: 'bedroom_light' }
      ]
    });

    await this.createSchedule({
      name: 'Kvällsbelysning',
      type: 'sunset',
      offset: 0,
      actions: [
        { type: 'device_on', deviceId: 'outdoor_lights' }
      ]
    });
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

module.exports = AdvancedScheduler;
