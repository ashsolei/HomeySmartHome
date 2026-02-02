'use strict';

/**
 * Personal Assistant & Task Manager
 * Intelligent task and calendar management
 */
class PersonalAssistantTaskManager {
  constructor(app) {
    this.app = app;
    this.tasks = new Map();
    this.calendar = new Map();
    this.reminders = [];
    this.shoppingLists = new Map();
    this.familyMembers = new Map();
  }

  async initialize() {
    await this.setupFamilyMembers();
    await this.setupTasks();
    await this.setupCalendar();
    await this.setupShoppingLists();
    
    this.startMonitoring();
  }

  // ============================================
  // FAMILY MEMBERS
  // ============================================

  async setupFamilyMembers() {
    const members = [
      {
        id: 'anna',
        name: 'Anna',
        role: 'parent',
        preferences: {
          reminderTime: '08:00',
          notificationMethod: 'voice',
          calendarSync: true
        }
      },
      {
        id: 'erik',
        name: 'Erik',
        role: 'parent',
        preferences: {
          reminderTime: '07:30',
          notificationMethod: 'phone',
          calendarSync: true
        }
      },
      {
        id: 'emma',
        name: 'Emma',
        role: 'child',
        preferences: {
          reminderTime: '07:00',
          notificationMethod: 'voice',
          calendarSync: false
        }
      },
      {
        id: 'oscar',
        name: 'Oscar',
        role: 'child',
        preferences: {
          reminderTime: '07:00',
          notificationMethod: 'voice',
          calendarSync: false
        }
      }
    ];

    for (const member of members) {
      this.familyMembers.set(member.id, member);
    }
  }

  // ============================================
  // TASKS
  // ============================================

  async setupTasks() {
    const tasks = [
      {
        id: 'task_1',
        title: 'Handla mat',
        description: 'Veckans matinköp',
        assignedTo: 'anna',
        priority: 'high',
        status: 'pending',
        dueDate: Date.now() + 2 * 24 * 60 * 60 * 1000,
        category: 'shopping',
        recurring: 'weekly',
        subtasks: [
          { id: 'sub_1', title: 'Köp mjölk', completed: false },
          { id: 'sub_2', title: 'Köp bröd', completed: false },
          { id: 'sub_3', title: 'Köp frukt', completed: false }
        ],
        createdAt: Date.now()
      },
      {
        id: 'task_2',
        title: 'Betala räkningar',
        description: 'El och internet',
        assignedTo: 'erik',
        priority: 'high',
        status: 'pending',
        dueDate: Date.now() + 5 * 24 * 60 * 60 * 1000,
        category: 'finance',
        recurring: 'monthly',
        subtasks: [],
        createdAt: Date.now()
      },
      {
        id: 'task_3',
        title: 'Läxor',
        description: 'Matematik kapitel 5',
        assignedTo: 'emma',
        priority: 'medium',
        status: 'pending',
        dueDate: Date.now() + 1 * 24 * 60 * 60 * 1000,
        category: 'school',
        recurring: null,
        subtasks: [],
        createdAt: Date.now()
      },
      {
        id: 'task_4',
        title: 'Städa vardagsrum',
        description: 'Dammsuga och torka',
        assignedTo: 'anna',
        priority: 'low',
        status: 'pending',
        dueDate: Date.now() + 3 * 24 * 60 * 60 * 1000,
        category: 'household',
        recurring: 'weekly',
        subtasks: [],
        createdAt: Date.now()
      }
    ];

    for (const task of tasks) {
      this.tasks.set(task.id, task);
    }
  }

  async addTask(data) {
    const taskId = 'task_' + Date.now();

    const task = {
      id: taskId,
      title: data.title,
      description: data.description || '',
      assignedTo: data.assignedTo,
      priority: data.priority || 'medium',
      status: 'pending',
      dueDate: data.dueDate,
      category: data.category || 'general',
      recurring: data.recurring || null,
      subtasks: data.subtasks || [],
      createdAt: Date.now()
    };

    this.tasks.set(taskId, task);

    console.log(`✅ Added task: ${task.title} (assigned to ${task.assignedTo})`);

    return { success: true, taskId };
  }

  async completeTask(taskId) {
    const task = this.tasks.get(taskId);
    
    if (!task) {
      return { success: false, error: 'Task not found' };
    }

    task.status = 'completed';
    task.completedAt = Date.now();

    console.log(`✅ Completed task: ${task.title}`);

    // Handle recurring tasks
    if (task.recurring) {
      await this.createRecurringTask(task);
    }

    return { success: true };
  }

  async createRecurringTask(originalTask) {
    const newTaskId = 'task_' + Date.now();

    let nextDueDate;
    const now = Date.now();

    switch (originalTask.recurring) {
      case 'daily':
        nextDueDate = now + 24 * 60 * 60 * 1000;
        break;
      case 'weekly':
        nextDueDate = now + 7 * 24 * 60 * 60 * 1000;
        break;
      case 'monthly':
        nextDueDate = now + 30 * 24 * 60 * 60 * 1000;
        break;
      default:
        return;
    }

    const newTask = {
      ...originalTask,
      id: newTaskId,
      status: 'pending',
      dueDate: nextDueDate,
      createdAt: now,
      completedAt: null
    };

    this.tasks.set(newTaskId, newTask);

    console.log(`🔁 Created recurring task: ${newTask.title} (due ${new Date(nextDueDate).toLocaleDateString('sv-SE')})`);
  }

  async updateTaskPriority(taskId, priority) {
    const task = this.tasks.get(taskId);
    
    if (!task) {
      return { success: false, error: 'Task not found' };
    }

    task.priority = priority;

    console.log(`📌 Updated task priority: ${task.title} → ${priority}`);

    return { success: true };
  }

  async reassignTask(taskId, newAssignee) {
    const task = this.tasks.get(taskId);
    
    if (!task) {
      return { success: false, error: 'Task not found' };
    }

    const oldAssignee = task.assignedTo;
    task.assignedTo = newAssignee;

    console.log(`👤 Reassigned task: ${task.title} (${oldAssignee} → ${newAssignee})`);

    return { success: true };
  }

  getTasksByPerson(personId) {
    return Array.from(this.tasks.values())
      .filter(t => t.assignedTo === personId && t.status === 'pending')
      .sort((a, b) => {
        // Sort by priority then due date
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        return a.dueDate - b.dueDate;
      });
  }

  getOverdueTasks() {
    const now = Date.now();
    return Array.from(this.tasks.values())
      .filter(t => t.status === 'pending' && t.dueDate < now);
  }

  // ============================================
  // CALENDAR
  // ============================================

  async setupCalendar() {
    const events = [
      {
        id: 'event_1',
        title: 'Tandläkare - Emma',
        description: 'Årlig kontroll',
        attendees: ['anna', 'emma'],
        startTime: Date.now() + 3 * 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000,
        endTime: Date.now() + 3 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000,
        location: 'Tandvårdskliniken',
        category: 'health',
        reminder: 60  // minutes before
      },
      {
        id: 'event_2',
        title: 'Föräldramöte',
        description: 'Skolan',
        attendees: ['anna', 'erik'],
        startTime: Date.now() + 7 * 24 * 60 * 60 * 1000 + 18 * 60 * 60 * 1000,
        endTime: Date.now() + 7 * 24 * 60 * 60 * 1000 + 19 * 60 * 60 * 1000,
        location: 'Skolan',
        category: 'school',
        reminder: 120
      },
      {
        id: 'event_3',
        title: 'Fotbollsmatch - Oscar',
        description: 'Hemmamatch',
        attendees: ['erik', 'oscar'],
        startTime: Date.now() + 5 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000,
        endTime: Date.now() + 5 * 24 * 60 * 60 * 1000 + 16 * 60 * 60 * 1000,
        location: 'Fotbollsplan',
        category: 'sports',
        reminder: 30
      }
    ];

    for (const event of events) {
      this.calendar.set(event.id, event);
    }
  }

  async addCalendarEvent(data) {
    const eventId = 'event_' + Date.now();

    const event = {
      id: eventId,
      title: data.title,
      description: data.description || '',
      attendees: data.attendees || [],
      startTime: data.startTime,
      endTime: data.endTime,
      location: data.location || '',
      category: data.category || 'general',
      reminder: data.reminder || 30
    };

    this.calendar.set(eventId, event);

    console.log(`📅 Added event: ${event.title} (${new Date(event.startTime).toLocaleString('sv-SE')})`);

    // Schedule reminder
    await this.scheduleReminder(event);

    return { success: true, eventId };
  }

  async scheduleReminder(event) {
    const reminderTime = event.startTime - event.reminder * 60 * 1000;

    this.reminders.push({
      id: 'reminder_' + Date.now(),
      eventId: event.id,
      title: event.title,
      attendees: event.attendees,
      triggerTime: reminderTime,
      triggered: false
    });
  }

  getUpcomingEvents(days = 7) {
    const now = Date.now();
    const future = now + days * 24 * 60 * 60 * 1000;

    return Array.from(this.calendar.values())
      .filter(e => e.startTime >= now && e.startTime <= future)
      .sort((a, b) => a.startTime - b.startTime);
  }

  getTodaySchedule(personId) {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000;

    const events = Array.from(this.calendar.values())
      .filter(e => 
        e.attendees.includes(personId) &&
        e.startTime >= startOfDay &&
        e.startTime < endOfDay
      )
      .sort((a, b) => a.startTime - b.startTime);

    const tasks = this.getTasksByPerson(personId)
      .filter(t => t.dueDate >= startOfDay && t.dueDate < endOfDay);

    return { events, tasks };
  }

  // ============================================
  // SHOPPING LISTS
  // ============================================

  async setupShoppingLists() {
    const lists = [
      {
        id: 'list_groceries',
        name: 'Matvaror',
        category: 'groceries',
        items: [
          { id: 'item_1', name: 'Mjölk', quantity: 2, unit: 'liter', purchased: false },
          { id: 'item_2', name: 'Bröd', quantity: 1, unit: 'st', purchased: false },
          { id: 'item_3', name: 'Ägg', quantity: 12, unit: 'st', purchased: false },
          { id: 'item_4', name: 'Ost', quantity: 500, unit: 'g', purchased: false }
        ],
        createdAt: Date.now()
      },
      {
        id: 'list_household',
        name: 'Hushåll',
        category: 'household',
        items: [
          { id: 'item_5', name: 'Tvättmedel', quantity: 1, unit: 'st', purchased: false },
          { id: 'item_6', name: 'Toalettpapper', quantity: 12, unit: 'rullar', purchased: false }
        ],
        createdAt: Date.now()
      }
    ];

    for (const list of lists) {
      this.shoppingLists.set(list.id, list);
    }
  }

  async addToShoppingList(listId, itemName, quantity = 1, unit = 'st') {
    const list = this.shoppingLists.get(listId);
    
    if (!list) {
      return { success: false, error: 'List not found' };
    }

    const itemId = 'item_' + Date.now();

    list.items.push({
      id: itemId,
      name: itemName,
      quantity,
      unit,
      purchased: false
    });

    console.log(`🛒 Added to ${list.name}: ${itemName} (${quantity} ${unit})`);

    return { success: true, itemId };
  }

  async markItemPurchased(listId, itemId) {
    const list = this.shoppingLists.get(listId);
    
    if (!list) {
      return { success: false, error: 'List not found' };
    }

    const item = list.items.find(i => i.id === itemId);
    
    if (!item) {
      return { success: false, error: 'Item not found' };
    }

    item.purchased = true;

    console.log(`✅ Marked as purchased: ${item.name}`);

    return { success: true };
  }

  async removeFromShoppingList(listId, itemId) {
    const list = this.shoppingLists.get(listId);
    
    if (!list) {
      return { success: false, error: 'List not found' };
    }

    const index = list.items.findIndex(i => i.id === itemId);
    
    if (index === -1) {
      return { success: false, error: 'Item not found' };
    }

    const item = list.items[index];
    list.items.splice(index, 1);

    console.log(`🗑️ Removed from ${list.name}: ${item.name}`);

    return { success: true };
  }

  // ============================================
  // SMART SUGGESTIONS
  // ============================================

  async suggestTasks(personId, context) {
    const suggestions = [];
    const now = Date.now();
    const hour = new Date(now).getHours();

    // Morning suggestions
    if (hour >= 6 && hour < 9) {
      suggestions.push({
        title: 'Kontrollera dagens schema',
        priority: 'high',
        category: 'planning'
      });
    }

    // Evening suggestions
    if (hour >= 18 && hour < 22) {
      suggestions.push({
        title: 'Förbered imorgon',
        priority: 'medium',
        category: 'planning'
      });
    }

    // Check for overdue tasks
    const overdueTasks = this.getOverdueTasks().filter(t => t.assignedTo === personId);
    if (overdueTasks.length > 0) {
      suggestions.push({
        title: `Du har ${overdueTasks.length} försenade uppgifter`,
        priority: 'high',
        category: 'reminder'
      });
    }

    return suggestions;
  }

  async getDailySummary(personId) {
    const schedule = this.getTodaySchedule(personId);
    const tasks = this.getTasksByPerson(personId);
    const member = this.familyMembers.get(personId);

    return {
      greeting: this.getGreeting(member.name),
      events: schedule.events.length,
      tasks: tasks.length,
      upcomingEvent: schedule.events[0] || null,
      nextTask: tasks[0] || null
    };
  }

  getGreeting(name) {
    const hour = new Date().getHours();

    if (hour >= 5 && hour < 10) {
      return `God morgon ${name}!`;
    } else if (hour >= 10 && hour < 18) {
      return `Hej ${name}!`;
    } else if (hour >= 18 && hour < 22) {
      return `God kväll ${name}!`;
    } else {
      return `God natt ${name}!`;
    }
  }

  // ============================================
  // MONITORING
  // ============================================

  startMonitoring() {
    // Check reminders every minute
    setInterval(() => {
      this.checkReminders();
    }, 60000);

    // Check overdue tasks daily
    setInterval(() => {
      this.checkOverdueTasks();
    }, 24 * 60 * 60 * 1000);

    console.log('🤖 Personal Assistant active');
  }

  async checkReminders() {
    const now = Date.now();

    for (const reminder of this.reminders) {
      if (!reminder.triggered && reminder.triggerTime <= now) {
        reminder.triggered = true;

        const event = this.calendar.get(reminder.eventId);
        
        if (event) {
          console.log(`⏰ Reminder: ${event.title} starts in ${event.reminder} minutes`);
          
          // Notify attendees
          for (const attendeeId of event.attendees) {
            const member = this.familyMembers.get(attendeeId);
            if (member) {
              console.log(`  📢 Notifying ${member.name}`);
            }
          }
        }
      }
    }
  }

  async checkOverdueTasks() {
    const overdueTasks = this.getOverdueTasks();

    if (overdueTasks.length > 0) {
      console.log(`⚠️ ${overdueTasks.length} overdue tasks`);

      for (const task of overdueTasks) {
        const member = this.familyMembers.get(task.assignedTo);
        if (member) {
          console.log(`  📌 ${member.name}: ${task.title}`);
        }
      }
    }
  }

  // ============================================
  // REPORTING
  // ============================================

  getAssistantOverview() {
    const pendingTasks = Array.from(this.tasks.values()).filter(t => t.status === 'pending').length;
    const upcomingEvents = this.getUpcomingEvents(7).length;

    return {
      familyMembers: this.familyMembers.size,
      pendingTasks,
      upcomingEvents,
      shoppingLists: this.shoppingLists.size,
      activeReminders: this.reminders.filter(r => !r.triggered).length
    };
  }

  getTasksSummary() {
    const byPriority = {
      high: 0,
      medium: 0,
      low: 0
    };

    const byStatus = {
      pending: 0,
      completed: 0
    };

    for (const task of this.tasks.values()) {
      if (task.status === 'pending') {
        byPriority[task.priority]++;
      }
      byStatus[task.status]++;
    }

    return {
      total: this.tasks.size,
      pending: byStatus.pending,
      completed: byStatus.completed,
      highPriority: byPriority.high,
      mediumPriority: byPriority.medium,
      lowPriority: byPriority.low
    };
  }

  getTasksList(personId = null) {
    let tasks = Array.from(this.tasks.values());

    if (personId) {
      tasks = tasks.filter(t => t.assignedTo === personId);
    }

    return tasks
      .filter(t => t.status === 'pending')
      .map(t => {
        const member = this.familyMembers.get(t.assignedTo);
        return {
          title: t.title,
          assignedTo: member?.name || t.assignedTo,
          priority: t.priority.toUpperCase(),
          dueDate: new Date(t.dueDate).toLocaleDateString('sv-SE'),
          category: t.category
        };
      });
  }

  getUpcomingEventsList(days = 7) {
    return this.getUpcomingEvents(days).map(e => ({
      title: e.title,
      date: new Date(e.startTime).toLocaleDateString('sv-SE'),
      time: new Date(e.startTime).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
      location: e.location,
      attendees: e.attendees.map(id => this.familyMembers.get(id)?.name || id).join(', ')
    }));
  }

  getShoppingListSummary() {
    const summary = [];

    for (const list of this.shoppingLists.values()) {
      const unpurchased = list.items.filter(i => !i.purchased).length;
      summary.push({
        name: list.name,
        total: list.items.length,
        unpurchased,
        purchased: list.items.length - unpurchased
      });
    }

    return summary;
  }
}

module.exports = PersonalAssistantTaskManager;
