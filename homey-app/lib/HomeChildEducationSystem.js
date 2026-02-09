'use strict';

/**
 * HomeChildEducationSystem
 * Wave 14 - Comprehensive child education, screen time management, and development tracking
 *
 * Features:
 * - Child profiles (up to 6) with learning styles, strengths, special needs
 * - Screen time management with per-child daily limits and categorization
 * - Homework tracking with subject-based assignments
 * - Learning activities with achievement badges and streaks
 * - Educational content scheduling with child-sized pomodoro
 * - Reading tracker with library return reminders
 * - Music practice tracking with instrument support
 * - Language learning (Swedish primary, English secondary, optional third)
 * - Science experiments with STEM progression
 * - Creative time with seasonal crafts
 * - Physical activity goals and suggestions
 * - Social development and playdate scheduling
 * - Progress reporting with weekly parent emails
 * - Chore integration with point system
 * - Bedtime routine automation
 * - Holiday/vacation mode
 * - Parental controls with PIN protection
 */

class HomeChildEducationSystem {
  constructor(homey) {
    this.homey = homey;

    // ── Child Profiles ─────────────────────────────────────────────────
    this.maxChildren = 6;
    this.children = new Map();
    this.learningStyles = ['visual', 'auditory', 'kinesthetic', 'reading'];
    this.supportedLanguages = ['Swedish', 'English', 'German', 'French', 'Spanish', 'Norwegian', 'Danish', 'Finnish', 'Mandarin', 'Arabic'];

    // ── Screen Time Management ─────────────────────────────────────────
    this.screenTimeLimits = {
      weekday: { '6-12': 120, '13-17': 180 },   // minutes
      weekend: { '6-12': 180, '13-17': 240 }
    };
    this.screenCategories = ['educational', 'entertainment', 'social', 'creative'];
    this.screenTimeSessions = new Map();
    this.screenTimeWarningMinutes = 15;
    this.gracePeriodMinutes = 5;
    this.bonusTimeBank = new Map();

    // ── Homework Tracking ──────────────────────────────────────────────
    this.subjects = [
      'Maths', 'Swedish', 'English', 'Science',
      'Social Studies', 'Art', 'Music', 'PE'
    ];
    this.assignments = new Map();
    this.difficultyScale = { min: 1, max: 5 };

    // ── Achievement Badges ─────────────────────────────────────────────
    this.badgeTypes = [
      { id: 'reader', name: 'Reader', description: 'Completed reading goals', icon: '📚' },
      { id: 'explorer', name: 'Explorer', description: 'Explored new topics', icon: '🔍' },
      { id: 'scientist', name: 'Scientist', description: 'Completed science experiments', icon: '🔬' },
      { id: 'artist', name: 'Artist', description: 'Created art projects', icon: '🎨' },
      { id: 'musician', name: 'Musician', description: 'Consistent music practice', icon: '🎵' },
      { id: 'coder', name: 'Coder', description: 'Completed coding challenges', icon: '💻' },
      { id: 'linguist', name: 'Linguist', description: 'Language learning milestones', icon: '🌍' },
      { id: 'mathematician', name: 'Mathematician', description: 'Maths achievements', icon: '🔢' },
      { id: 'helper', name: 'Helper', description: 'Completed chores consistently', icon: '🤝' },
      { id: 'athlete', name: 'Athlete', description: 'Met physical activity goals', icon: '🏅' }
    ];
    this.earnedBadges = new Map();
    this.streaks = new Map();

    // ── Educational Scheduling ─────────────────────────────────────────
    this.optimalFocusWindow = { start: 16, end: 18 }; // 16:00 - 18:00
    this.pomodoroMinutes = 25;
    this.breakMinutes = 5;
    this.learningBlocks = new Map();

    // ── Reading Tracker ────────────────────────────────────────────────
    this.readingLogs = new Map();
    this.readingLists = new Map();
    this.libraryBooks = new Map();
    this.bedtimeReadingMinutes = 30;

    // ── Music Practice ─────────────────────────────────────────────────
    this.supportedInstruments = ['piano', 'guitar', 'violin', 'drums', 'flute'];
    this.dailyPracticeGoalMinutes = 30;
    this.musicPracticeLogs = new Map();
    this.practiceStreaks = new Map();

    // ── Language Learning ──────────────────────────────────────────────
    this.languageProgress = new Map();
    this.dailyVocabulary = new Map();
    this.phraseOfTheDay = new Map();

    // ── Science Experiments ────────────────────────────────────────────
    this.experimentLog = new Map();
    this.stemSkillLevels = new Map();
    this.weeklyExperimentSuggestions = [];

    // ── Creative Time ──────────────────────────────────────────────────
    this.artProjects = new Map();
    this.craftMaterialsInventory = [];
    this.seasonalCrafts = {
      Jul: ['Paper stars', 'Gingerbread house', 'Advent calendar', 'Julbock craft', 'Candle decoration'],
      Påsk: ['Easter eggs painting', 'Påskris decoration', 'Spring flowers craft', 'Easter bunny paper craft'],
      Midsommar: ['Flower crown', 'Midsommar pole decoration', 'Strawberry crafts', 'Nature collage']
    };
    this.projectGallery = new Map();

    // ── Physical Activity ──────────────────────────────────────────────
    this.dailyMovementGoalMinutes = 60;
    this.activityLogs = new Map();
    this.sportsSchedules = new Map();

    // ── Social Development ─────────────────────────────────────────────
    this.playdates = new Map();
    this.socialSkillsActivities = [];
    this.birthdayPlans = new Map();

    // ── Chore Integration ──────────────────────────────────────────────
    this.choreDefinitions = {
      'make_bed': { name: 'Make bed', points: 5, minAge: 5 },
      'dishes': { name: 'Do the dishes', points: 10, minAge: 8 },
      'vacuum': { name: 'Vacuum', points: 15, minAge: 9 },
      'take_out_trash': { name: 'Take out trash', points: 8, minAge: 7 },
      'tidy_room': { name: 'Tidy room', points: 10, minAge: 6 },
      'set_table': { name: 'Set the table', points: 5, minAge: 5 },
      'clear_table': { name: 'Clear the table', points: 5, minAge: 6 },
      'fold_laundry': { name: 'Fold laundry', points: 10, minAge: 8 },
      'water_plants': { name: 'Water plants', points: 5, minAge: 6 },
      'feed_pets': { name: 'Feed pets', points: 8, minAge: 7 },
      'sort_recycling': { name: 'Sort recycling', points: 10, minAge: 8 },
      'help_cooking': { name: 'Help with cooking', points: 12, minAge: 10 },
      'rake_leaves': { name: 'Rake leaves', points: 15, minAge: 9 },
      'shovel_snow': { name: 'Shovel snow', points: 20, minAge: 11 }
    };
    this.choreCompletions = new Map();
    this.chorePoints = new Map();
    this.weeklyChoreChart = new Map();

    // ── Bedtime Routine ────────────────────────────────────────────────
    this.bedtimesByAge = {
      '6-8': '19:30',
      '9-11': '20:30',
      '12-14': '21:30',
      '15-17': '22:00'
    };
    this.screenCutoffBeforeBedMinutes = 60;
    this.bedtimeRoutines = new Map();

    // ── Holiday / Vacation Mode ────────────────────────────────────────
    this.vacationMode = false;
    this.vacationScreenMultiplier = 1.5;
    this.summerReadingPrograms = new Map();
    this.holidayProjects = new Map();

    // ── Progress Reporting ─────────────────────────────────────────────
    this.progressReports = new Map();
    this.teacherConferenceNotes = new Map();

    // ── Parental Controls ──────────────────────────────────────────────
    this.parentalPIN = null;
    this.parentPermissions = new Map();
    this.approvalQueue = [];
    this.emergencyOverrideActive = false;

    // ── Monitoring ─────────────────────────────────────────────────────
    this.monitoringIntervalMs = 3 * 60 * 1000; // 3 minutes
    this.monitoringTimer = null;
    this.initialized = false;
    this.lastMonitoringCycle = null;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Lifecycle
  // ═══════════════════════════════════════════════════════════════════════

  async initialize() {
    try {
      this.log('Initializing HomeChildEducationSystem...');
      await this._loadStoredData();
      this._initializeWeeklyExperiments();
      this._initializeSocialSkillsActivities();
      this._startMonitoringCycle();
      this.initialized = true;
      this.log('HomeChildEducationSystem initialized successfully');
    } catch (err) {
      this.error(`Initialization failed: ${err.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Child Profile Management
  // ═══════════════════════════════════════════════════════════════════════

  addChild(profileData) {
    if (this.children.size >= this.maxChildren) {
      this.error(`Maximum of ${this.maxChildren} children reached`);
      return null;
    }
    const id = `child_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const profile = {
      id,
      name: profileData.name || 'Unknown',
      age: profileData.age || 6,
      grade: profileData.grade || null,
      schoolYear: profileData.schoolYear || null,
      schoolName: profileData.schoolName || null,
      learningStyle: this.learningStyles.includes(profileData.learningStyle)
        ? profileData.learningStyle : 'visual',
      strengths: Array.isArray(profileData.strengths) ? profileData.strengths : [],
      areasForImprovement: Array.isArray(profileData.areasForImprovement) ? profileData.areasForImprovement : [],
      specialNeeds: {
        hasSpecialNeeds: profileData.specialNeeds?.hasSpecialNeeds || false,
        details: profileData.specialNeeds?.details || '',
        accommodations: profileData.specialNeeds?.accommodations || []
      },
      languages: {
        primary: 'Swedish',
        secondary: 'English',
        third: profileData.languages?.third || null
      },
      instruments: Array.isArray(profileData.instruments) ? profileData.instruments : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.children.set(id, profile);
    this._initializeChildTracking(id);
    this.log(`Added child profile: ${profile.name} (age ${profile.age})`);
    return profile;
  }

  updateChild(childId, updates) {
    const child = this.children.get(childId);
    if (!child) {
      this.error(`Child not found: ${childId}`);
      return null;
    }
    const allowed = ['name', 'age', 'grade', 'schoolYear', 'schoolName',
      'learningStyle', 'strengths', 'areasForImprovement', 'specialNeeds',
      'languages', 'instruments'];
    for (const key of allowed) {
      if (updates[key] !== undefined) {
        child[key] = updates[key];
      }
    }
    child.updatedAt = new Date().toISOString();
    this.children.set(childId, child);
    this.log(`Updated child profile: ${child.name}`);
    return child;
  }

  removeChild(childId) {
    const child = this.children.get(childId);
    if (!child) return false;
    this.children.delete(childId);
    this._cleanupChildTracking(childId);
    this.log(`Removed child profile: ${child.name}`);
    return true;
  }

  getChild(childId) {
    return this.children.get(childId) || null;
  }

  getAllChildren() {
    return Array.from(this.children.values());
  }

  _initializeChildTracking(childId) {
    this.screenTimeSessions.set(childId, { today: [], totalToday: 0, warnings: [] });
    this.bonusTimeBank.set(childId, 0);
    this.assignments.set(childId, []);
    this.earnedBadges.set(childId, []);
    this.streaks.set(childId, { learning: 0, reading: 0, music: 0, exercise: 0, lastDates: {} });
    this.readingLogs.set(childId, { books: [], dailyMinutes: [], weeklyMinutes: 0, level: 1 });
    this.readingLists.set(childId, []);
    this.libraryBooks.set(childId, []);
    this.musicPracticeLogs.set(childId, []);
    this.practiceStreaks.set(childId, 0);
    this.languageProgress.set(childId, { vocabularyLearned: [], phrasesLearned: [], level: 1 });
    this.experimentLog.set(childId, []);
    this.stemSkillLevels.set(childId, { science: 1, technology: 1, engineering: 1, mathematics: 1 });
    this.artProjects.set(childId, []);
    this.projectGallery.set(childId, []);
    this.activityLogs.set(childId, { daily: [], weeklyTotal: 0 });
    this.sportsSchedules.set(childId, []);
    this.playdates.set(childId, []);
    this.birthdayPlans.set(childId, null);
    this.choreCompletions.set(childId, []);
    this.chorePoints.set(childId, 0);
    this.weeklyChoreChart.set(childId, this._generateWeeklyChoreChart(childId));
    this.bedtimeRoutines.set(childId, { active: false, windDownStarted: false });
    this.progressReports.set(childId, []);
    this.teacherConferenceNotes.set(childId, []);
    this.learningBlocks.set(childId, []);
    this.dailyVocabulary.set(childId, null);
    this.phraseOfTheDay.set(childId, null);
  }

  _cleanupChildTracking(childId) {
    const maps = [
      this.screenTimeSessions, this.bonusTimeBank, this.assignments,
      this.earnedBadges, this.streaks, this.readingLogs, this.readingLists,
      this.libraryBooks, this.musicPracticeLogs, this.practiceStreaks,
      this.languageProgress, this.experimentLog, this.stemSkillLevels,
      this.artProjects, this.projectGallery, this.activityLogs,
      this.sportsSchedules, this.playdates, this.birthdayPlans,
      this.choreCompletions, this.chorePoints, this.weeklyChoreChart,
      this.bedtimeRoutines, this.progressReports, this.teacherConferenceNotes,
      this.learningBlocks, this.dailyVocabulary, this.phraseOfTheDay
    ];
    for (const map of maps) {
      map.delete(childId);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Screen Time Management
  // ═══════════════════════════════════════════════════════════════════════

  getScreenTimeLimit(childId) {
    const child = this.children.get(childId);
    if (!child) return 0;

    const ageGroup = child.age >= 13 ? '13-17' : '6-12';
    const dayType = this._isWeekend() ? 'weekend' : 'weekday';
    let limit = this.screenTimeLimits[dayType][ageGroup];

    if (this.vacationMode) {
      limit = Math.round(limit * this.vacationScreenMultiplier);
    }

    const bonus = this.bonusTimeBank.get(childId) || 0;
    return limit + bonus;
  }

  startScreenSession(childId, category) {
    if (!this.screenCategories.includes(category)) {
      this.error(`Invalid screen category: ${category}`);
      return null;
    }

    const child = this.children.get(childId);
    if (!child) return null;

    if (this._isBedtimeScreenCutoff(childId)) {
      this.log(`Screen cutoff active for ${child.name} - bedtime approaching`);
      return { blocked: true, reason: 'bedtime_cutoff' };
    }

    const session = this.screenTimeSessions.get(childId);
    const limit = this.getScreenTimeLimit(childId);
    const remaining = limit - session.totalToday;

    if (remaining <= 0) {
      this.log(`Screen time limit reached for ${child.name}`);
      return { blocked: true, reason: 'limit_reached', totalUsed: session.totalToday, limit };
    }

    const newSession = {
      id: `sess_${Date.now()}`,
      category,
      startTime: new Date().toISOString(),
      endTime: null,
      durationMinutes: 0,
      active: true
    };

    session.today.push(newSession);
    this.screenTimeSessions.set(childId, session);
    this.log(`Screen session started for ${child.name}: ${category} (${remaining}min remaining)`);

    return {
      session: newSession,
      remainingMinutes: remaining,
      limit,
      warning: remaining <= this.screenTimeWarningMinutes
    };
  }

  endScreenSession(childId, sessionId) {
    const session = this.screenTimeSessions.get(childId);
    if (!session) return null;

    const activeSession = session.today.find(s => s.id === sessionId && s.active);
    if (!activeSession) return null;

    activeSession.endTime = new Date().toISOString();
    activeSession.durationMinutes = Math.round(
      (new Date(activeSession.endTime) - new Date(activeSession.startTime)) / 60000
    );
    activeSession.active = false;

    session.totalToday += activeSession.durationMinutes;
    this.screenTimeSessions.set(childId, session);

    const child = this.children.get(childId);
    this.log(`Screen session ended for ${child?.name}: ${activeSession.durationMinutes}min ${activeSession.category}`);
    return activeSession;
  }

  getScreenTimeStatus(childId) {
    const child = this.children.get(childId);
    if (!child) return null;

    const session = this.screenTimeSessions.get(childId);
    const limit = this.getScreenTimeLimit(childId);
    const used = session.totalToday;
    const remaining = Math.max(0, limit - used);
    const activeSessions = session.today.filter(s => s.active);

    const categoryBreakdown = {};
    for (const cat of this.screenCategories) {
      categoryBreakdown[cat] = session.today
        .filter(s => s.category === cat)
        .reduce((sum, s) => sum + s.durationMinutes, 0);
    }

    return {
      childName: child.name,
      limitMinutes: limit,
      usedMinutes: used,
      remainingMinutes: remaining,
      percentageUsed: Math.round((used / limit) * 100),
      activeSessions: activeSessions.length,
      categoryBreakdown,
      warningActive: remaining <= this.screenTimeWarningMinutes && remaining > 0,
      limitReached: remaining <= 0,
      bonusMinutes: this.bonusTimeBank.get(childId) || 0,
      vacationMode: this.vacationMode
    };
  }

  addBonusScreenTime(childId, minutes, reason) {
    const current = this.bonusTimeBank.get(childId) || 0;
    this.bonusTimeBank.set(childId, current + minutes);
    const child = this.children.get(childId);
    this.log(`Bonus screen time +${minutes}min for ${child?.name}: ${reason}`);
    return current + minutes;
  }

  _checkScreenTimeLimits() {
    for (const [childId, session] of this.screenTimeSessions) {
      const child = this.children.get(childId);
      if (!child) continue;

      const limit = this.getScreenTimeLimit(childId);
      const remaining = limit - session.totalToday;
      const activeSessions = session.today.filter(s => s.active);

      if (activeSessions.length === 0) continue;

      if (remaining <= 0) {
        this.log(`Screen time LIMIT REACHED for ${child.name} - enforcing cutoff`);
        for (const s of activeSessions) {
          this.endScreenSession(childId, s.id);
        }
        session.warnings.push({
          type: 'hard_cutoff',
          timestamp: new Date().toISOString(),
          message: `Screen time limit reached (${limit}min). Grace period: ${this.gracePeriodMinutes}min.`
        });
      } else if (remaining <= this.screenTimeWarningMinutes && !session.warnings.find(w => w.type === 'fifteen_min')) {
        this.log(`Screen time warning for ${child.name}: ${remaining}min remaining`);
        session.warnings.push({
          type: 'fifteen_min',
          timestamp: new Date().toISOString(),
          message: `Only ${remaining} minutes of screen time remaining today.`
        });
      }

      // Update running duration for active sessions
      for (const s of activeSessions) {
        s.durationMinutes = Math.round(
          (Date.now() - new Date(s.startTime).getTime()) / 60000
        );
      }
      session.totalToday = session.today.reduce((sum, s) => sum + s.durationMinutes, 0);
      this.screenTimeSessions.set(childId, session);
    }
  }

  _resetDailyScreenTime() {
    for (const [childId] of this.screenTimeSessions) {
      this.screenTimeSessions.set(childId, { today: [], totalToday: 0, warnings: [] });
    }
    this.log('Daily screen time counters reset');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Homework Tracking
  // ═══════════════════════════════════════════════════════════════════════

  addAssignment(childId, assignmentData) {
    const child = this.children.get(childId);
    if (!child) return null;
    if (!this.subjects.includes(assignmentData.subject)) {
      this.error(`Invalid subject: ${assignmentData.subject}`);
      return null;
    }

    const assignment = {
      id: `hw_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      childId,
      subject: assignmentData.subject,
      title: assignmentData.title || 'Untitled Assignment',
      description: assignmentData.description || '',
      dueDate: assignmentData.dueDate || null,
      estimatedMinutes: assignmentData.estimatedMinutes || 30,
      actualMinutes: null,
      status: 'pending', // pending, in_progress, completed, overdue
      completedAt: null,
      parentVerified: false,
      parentVerifiedAt: null,
      difficultyRating: Math.min(this.difficultyScale.max,
        Math.max(this.difficultyScale.min, assignmentData.difficultyRating || 3)),
      helpNeeded: assignmentData.helpNeeded || false,
      helpDetails: assignmentData.helpDetails || '',
      notes: assignmentData.notes || '',
      createdAt: new Date().toISOString()
    };

    const assignments = this.assignments.get(childId) || [];
    assignments.push(assignment);
    this.assignments.set(childId, assignments);
    this.log(`Assignment added for ${child.name}: ${assignment.title} (${assignment.subject})`);
    return assignment;
  }

  updateAssignmentStatus(childId, assignmentId, status, details = {}) {
    const assignments = this.assignments.get(childId);
    if (!assignments) return null;

    const assignment = assignments.find(a => a.id === assignmentId);
    if (!assignment) return null;

    assignment.status = status;
    if (status === 'completed') {
      assignment.completedAt = new Date().toISOString();
      assignment.actualMinutes = details.actualMinutes || assignment.estimatedMinutes;
      this._checkHomeworkBadge(childId);
    }
    if (details.parentVerified) {
      assignment.parentVerified = true;
      assignment.parentVerifiedAt = new Date().toISOString();
    }
    if (details.helpNeeded !== undefined) {
      assignment.helpNeeded = details.helpNeeded;
      assignment.helpDetails = details.helpDetails || '';
    }

    this.assignments.set(childId, assignments);
    return assignment;
  }

  getAssignments(childId, filters = {}) {
    let assignments = this.assignments.get(childId) || [];
    if (filters.subject) {
      assignments = assignments.filter(a => a.subject === filters.subject);
    }
    if (filters.status) {
      assignments = assignments.filter(a => a.status === filters.status);
    }
    if (filters.helpNeeded) {
      assignments = assignments.filter(a => a.helpNeeded);
    }
    if (filters.dueSoon) {
      const twoDaysFromNow = new Date();
      twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
      assignments = assignments.filter(a =>
        a.dueDate && new Date(a.dueDate) <= twoDaysFromNow && a.status !== 'completed'
      );
    }
    return assignments;
  }

  _checkHomeworkDeadlines() {
    const now = new Date();
    for (const [childId, assignments] of this.assignments) {
      const child = this.children.get(childId);
      if (!child) continue;

      for (const assignment of assignments) {
        if (assignment.status === 'completed' || !assignment.dueDate) continue;
        const dueDate = new Date(assignment.dueDate);

        if (dueDate < now && assignment.status !== 'overdue') {
          assignment.status = 'overdue';
          this.log(`Assignment OVERDUE for ${child.name}: ${assignment.title}`);
        } else if (dueDate - now < 24 * 60 * 60 * 1000 && assignment.status === 'pending') {
          this.log(`Assignment due TOMORROW for ${child.name}: ${assignment.title}`);
        }
      }
      this.assignments.set(childId, assignments);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Learning Activities & Achievements
  // ═══════════════════════════════════════════════════════════════════════

  getLearningActivities(childId) {
    const child = this.children.get(childId);
    if (!child) return [];

    const age = child.age;
    const activities = [];

    if (age >= 6 && age <= 8) {
      activities.push(
        { type: 'puzzle', name: 'Jigsaw puzzle (50-100 pieces)', duration: 30, category: 'problem_solving' },
        { type: 'reading', name: 'Picture book reading', duration: 20, category: 'literacy' },
        { type: 'experiment', name: 'Colour mixing with paint', duration: 25, category: 'science' },
        { type: 'coding', name: 'Block-based coding (ScratchJr)', duration: 20, category: 'technology' },
        { type: 'language', name: 'English vocabulary flashcards', duration: 15, category: 'language' },
        { type: 'maths', name: 'Number games and counting', duration: 20, category: 'maths' },
        { type: 'art', name: 'Drawing and colouring', duration: 30, category: 'creative' }
      );
    } else if (age >= 9 && age <= 11) {
      activities.push(
        { type: 'puzzle', name: 'Logic puzzles and brain teasers', duration: 30, category: 'problem_solving' },
        { type: 'reading', name: 'Chapter book reading', duration: 30, category: 'literacy' },
        { type: 'experiment', name: 'Baking soda volcano', duration: 45, category: 'science' },
        { type: 'coding', name: 'Scratch programming', duration: 30, category: 'technology' },
        { type: 'language', name: 'English reading comprehension', duration: 25, category: 'language' },
        { type: 'maths', name: 'Multiplication and division practice', duration: 25, category: 'maths' },
        { type: 'art', name: 'Watercolour painting', duration: 40, category: 'creative' }
      );
    } else if (age >= 12 && age <= 14) {
      activities.push(
        { type: 'puzzle', name: 'Sudoku and crosswords', duration: 30, category: 'problem_solving' },
        { type: 'reading', name: 'Young adult novel reading', duration: 40, category: 'literacy' },
        { type: 'experiment', name: 'pH testing household items', duration: 40, category: 'science' },
        { type: 'coding', name: 'Python basics', duration: 40, category: 'technology' },
        { type: 'language', name: 'English essay writing', duration: 35, category: 'language' },
        { type: 'maths', name: 'Algebra practice', duration: 30, category: 'maths' },
        { type: 'art', name: 'Digital art creation', duration: 45, category: 'creative' }
      );
    } else {
      activities.push(
        { type: 'puzzle', name: 'Advanced logic and strategy games', duration: 45, category: 'problem_solving' },
        { type: 'reading', name: 'Literature and non-fiction reading', duration: 45, category: 'literacy' },
        { type: 'experiment', name: 'Electronics and circuits', duration: 60, category: 'science' },
        { type: 'coding', name: 'Web development project', duration: 60, category: 'technology' },
        { type: 'language', name: 'English debate preparation', duration: 40, category: 'language' },
        { type: 'maths', name: 'Advanced maths problems', duration: 40, category: 'maths' },
        { type: 'art', name: 'Portfolio project', duration: 60, category: 'creative' }
      );
    }

    // Personalise based on learning style
    return activities.map(a => ({
      ...a,
      adaptedFor: child.learningStyle,
      suggestion: this._adaptForLearningStyle(a, child.learningStyle)
    }));
  }

  _adaptForLearningStyle(activity, style) {
    const adaptations = {
      visual: 'Use diagrams, charts, and visual aids',
      auditory: 'Discuss concepts aloud, use audio resources',
      kinesthetic: 'Include hands-on components and movement',
      reading: 'Provide written instructions and reading materials'
    };
    return adaptations[style] || '';
  }

  getDailyLearningChallenge(childId) {
    const child = this.children.get(childId);
    if (!child) return null;

    const challenges = this._getAgeChallenges(child.age);
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    const challengeIndex = dayOfYear % challenges.length;

    return {
      challenge: challenges[challengeIndex],
      date: new Date().toISOString().split('T')[0],
      childName: child.name,
      streakDays: this.streaks.get(childId)?.learning || 0
    };
  }

  _getAgeChallenges(age) {
    if (age <= 8) {
      return [
        'Count to 100 in English', 'Draw your favourite animal',
        'Read a story to a family member', 'Build something with blocks',
        'Learn 5 new English words', 'Do 3 science observations outdoors',
        'Write your name in cursive', 'Solve 10 addition problems',
        'Make up a song', 'Find 5 shapes in your house',
        'Tell a story about a picture', 'Sort objects by colour and size',
        'Plant a seed and observe', 'Create a pattern with objects'
      ];
    } else if (age <= 11) {
      return [
        'Write a short story (100 words)', 'Research an animal and present facts',
        'Solve a maths word problem', 'Draw a map of your neighbourhood',
        'Learn 10 English vocabulary words', 'Do a kitchen science experiment',
        'Write a letter to a friend', 'Read for 30 minutes',
        'Create a comic strip', 'Memorise a poem',
        'Build a simple machine', 'Practice multiplication tables',
        'Write a diary entry in English', 'Research a country on the map'
      ];
    } else if (age <= 14) {
      return [
        'Write a persuasive essay (200 words)', 'Research a historical event',
        'Solve 5 algebra problems', 'Create a presentation about a topic',
        'Read an English article and summarise', 'Design a science experiment',
        'Write a book review', 'Learn about a coding concept',
        'Create digital artwork', 'Debate a topic with a family member',
        'Build a model or prototype', 'Solve a complex word problem',
        'Write a poem', 'Research a career you find interesting'
      ];
    }
    return [
      'Write an analytical essay (300 words)', 'Research a global issue',
      'Solve advanced maths problems', 'Create a project proposal',
      'Read English literature and analyse', 'Design and conduct an experiment',
      'Write a critical review', 'Build a small coding project',
      'Create a portfolio piece', 'Prepare debate arguments',
      'Engineer a solution to a real problem', 'Study for upcoming exams',
      'Write in a journal in English', 'Plan a community service activity'
    ];
  }

  awardBadge(childId, badgeId) {
    const child = this.children.get(childId);
    const badge = this.badgeTypes.find(b => b.id === badgeId);
    if (!child || !badge) return null;

    const badges = this.earnedBadges.get(childId) || [];
    if (badges.find(b => b.id === badgeId)) {
      return { alreadyEarned: true, badge };
    }

    const earned = {
      ...badge,
      earnedAt: new Date().toISOString()
    };
    badges.push(earned);
    this.earnedBadges.set(childId, badges);
    this.log(`Badge awarded to ${child.name}: ${badge.icon} ${badge.name}`);
    return earned;
  }

  getBadges(childId) {
    return this.earnedBadges.get(childId) || [];
  }

  updateStreak(childId, category) {
    const streaks = this.streaks.get(childId);
    if (!streaks) return null;

    const today = new Date().toISOString().split('T')[0];
    const lastDate = streaks.lastDates[category];

    if (lastDate === today) {
      return streaks[category]; // Already counted today
    }

    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (lastDate === yesterday) {
      streaks[category]++;
    } else {
      streaks[category] = 1; // Reset streak
    }

    streaks.lastDates[category] = today;
    this.streaks.set(childId, streaks);
    return streaks[category];
  }

  _checkHomeworkBadge(childId) {
    const assignments = this.assignments.get(childId) || [];
    const completed = assignments.filter(a => a.status === 'completed');
    if (completed.length >= 50) {
      this.awardBadge(childId, 'helper');
    }
    const mathCompleted = completed.filter(a => a.subject === 'Maths');
    if (mathCompleted.length >= 20) {
      this.awardBadge(childId, 'mathematician');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Educational Content Scheduling
  // ═══════════════════════════════════════════════════════════════════════

  scheduleLearningBlock(childId, options = {}) {
    const child = this.children.get(childId);
    if (!child) return null;

    const startHour = options.startHour || this.optimalFocusWindow.start;
    const endHour = options.endHour || this.optimalFocusWindow.end;
    const totalMinutes = (endHour - startHour) * 60;
    const pomodoroCount = Math.floor(totalMinutes / (this.pomodoroMinutes + this.breakMinutes));

    const subjects = this._rotateSubjects(childId);
    const blocks = [];

    let currentMinute = 0;
    for (let i = 0; i < pomodoroCount; i++) {
      const subject = subjects[i % subjects.length];
      blocks.push({
        order: i + 1,
        subject,
        startOffset: currentMinute,
        durationMinutes: this.pomodoroMinutes,
        type: 'focus',
        startTime: this._formatTime(startHour, currentMinute)
      });
      currentMinute += this.pomodoroMinutes;

      if (i < pomodoroCount - 1) {
        blocks.push({
          order: i + 1,
          subject: 'Break',
          startOffset: currentMinute,
          durationMinutes: this.breakMinutes,
          type: 'break',
          startTime: this._formatTime(startHour, currentMinute),
          suggestion: this._getBreakSuggestion(child.age)
        });
        currentMinute += this.breakMinutes;
      }
    }

    // Add reward activity after learning block
    blocks.push({
      order: pomodoroCount + 1,
      subject: 'Reward Activity',
      startOffset: currentMinute,
      durationMinutes: 15,
      type: 'reward',
      startTime: this._formatTime(startHour, currentMinute),
      suggestion: this._getRewardSuggestion(child.age)
    });

    const schedule = {
      childId,
      childName: child.name,
      date: new Date().toISOString().split('T')[0],
      startHour,
      endHour,
      blocks,
      pomodoroLength: this.pomodoroMinutes,
      breakLength: this.breakMinutes
    };

    this.learningBlocks.set(childId, schedule);
    this.log(`Learning block scheduled for ${child.name}: ${pomodoroCount} sessions`);
    return schedule;
  }

  _rotateSubjects(childId) {
    const child = this.children.get(childId);
    if (!child) return this.subjects.slice(0, 4);
    const areasForImprovement = child.areasForImprovement || [];
    const prioritized = this.subjects.filter(s => areasForImprovement.includes(s));
    const others = this.subjects.filter(s => !areasForImprovement.includes(s));
    const dayOfWeek = new Date().getDay();
    const rotated = [...prioritized, ...others];
    const offset = dayOfWeek % rotated.length;
    return [...rotated.slice(offset), ...rotated.slice(0, offset)];
  }

  _getBreakSuggestion(age) {
    const suggestions = [
      'Stretch and do jumping jacks',
      'Get a glass of water',
      'Walk around the house',
      'Do a quick dance',
      'Look out the window and describe what you see',
      'Do 10 squats',
      'Practice deep breathing',
      'Play with a pet briefly'
    ];
    return suggestions[Math.floor(Math.random() * suggestions.length)];
  }

  _getRewardSuggestion(age) {
    if (age <= 8) {
      return 'Free play time, colouring, or a favourite game';
    } else if (age <= 11) {
      return 'Gaming, drawing, or outdoor play';
    } else if (age <= 14) {
      return 'Social media time, music, or gaming';
    }
    return 'Free screen time, music, or social time';
  }

  _formatTime(baseHour, offsetMinutes) {
    const totalMinutes = baseHour * 60 + offsetMinutes;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Reading Tracker
  // ═══════════════════════════════════════════════════════════════════════

  logReading(childId, data) {
    const child = this.children.get(childId);
    if (!child) return null;

    const readingLog = this.readingLogs.get(childId);
    const entry = {
      id: `read_${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      bookTitle: data.bookTitle || 'Unknown',
      author: data.author || '',
      minutesRead: data.minutesRead || 0,
      pagesRead: data.pagesRead || 0,
      language: data.language || 'Swedish',
      completed: data.completed || false,
      rating: data.rating || null,
      notes: data.notes || ''
    };

    readingLog.dailyMinutes.push({ date: entry.date, minutes: entry.minutesRead });
    readingLog.weeklyMinutes += entry.minutesRead;

    if (entry.completed) {
      readingLog.books.push({
        title: entry.bookTitle,
        author: entry.author,
        completedAt: new Date().toISOString(),
        language: entry.language,
        rating: entry.rating
      });
      this._checkReadingBadge(childId);
    }

    this.readingLogs.set(childId, readingLog);
    this.updateStreak(childId, 'reading');
    this.log(`Reading logged for ${child.name}: ${entry.minutesRead}min "${entry.bookTitle}"`);
    return entry;
  }

  getReadingStats(childId) {
    const readingLog = this.readingLogs.get(childId);
    if (!readingLog) return null;

    const today = new Date().toISOString().split('T')[0];
    const todayMinutes = readingLog.dailyMinutes
      .filter(d => d.date === today)
      .reduce((sum, d) => sum + d.minutes, 0);

    const last7Days = readingLog.dailyMinutes
      .filter(d => {
        const diff = (new Date(today) - new Date(d.date)) / 86400000;
        return diff < 7;
      })
      .reduce((sum, d) => sum + d.minutes, 0);

    return {
      totalBooksRead: readingLog.books.length,
      readingLevel: readingLog.level,
      todayMinutes,
      weeklyMinutes: last7Days,
      readingStreak: this.streaks.get(childId)?.reading || 0,
      recentBooks: readingLog.books.slice(-5),
      swedishBooks: readingLog.books.filter(b => b.language === 'Swedish').length,
      englishBooks: readingLog.books.filter(b => b.language === 'English').length
    };
  }

  addLibraryBook(childId, bookData) {
    const books = this.libraryBooks.get(childId) || [];
    const book = {
      id: `lib_${Date.now()}`,
      title: bookData.title,
      author: bookData.author || '',
      borrowedDate: bookData.borrowedDate || new Date().toISOString().split('T')[0],
      dueDate: bookData.dueDate || this._getDefaultLibraryDueDate(),
      returned: false,
      renewals: 0
    };
    books.push(book);
    this.libraryBooks.set(childId, books);
    this.log(`Library book added for child: "${book.title}" due ${book.dueDate}`);
    return book;
  }

  _checkLibraryReturns() {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    for (const [childId, books] of this.libraryBooks) {
      const child = this.children.get(childId);
      if (!child) continue;

      for (const book of books) {
        if (book.returned) continue;
        if (book.dueDate === today) {
          this.log(`Library book due TODAY for ${child.name}: "${book.title}"`);
        } else if (book.dueDate === tomorrow) {
          this.log(`Library book due TOMORROW for ${child.name}: "${book.title}"`);
        } else if (book.dueDate < today) {
          this.log(`Library book OVERDUE for ${child.name}: "${book.title}"`);
        }
      }
    }
  }

  _getDefaultLibraryDueDate() {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 21);
    return dueDate.toISOString().split('T')[0];
  }

  getBedtimeReadingRoutine(childId) {
    const child = this.children.get(childId);
    if (!child) return null;

    const bedtime = this._getBedtimeForAge(child.age);
    const bedtimeParts = bedtime.split(':');
    const bedtimeMinutes = parseInt(bedtimeParts[0]) * 60 + parseInt(bedtimeParts[1]);
    const readingStartMinutes = bedtimeMinutes - this.bedtimeReadingMinutes;

    return {
      childName: child.name,
      readingStart: this._formatTime(0, readingStartMinutes),
      readingEnd: bedtime,
      durationMinutes: this.bedtimeReadingMinutes,
      lighting: 'warm',
      lightTemperature: 2700,
      lightBrightness: 40,
      suggestedBooks: this._getSuggestedBooks(child.age, child.languages.primary)
    };
  }

  _getSuggestedBooks(age, language) {
    const swedish = [
      { title: 'Pippi Långstrump', author: 'Astrid Lindgren', minAge: 6, maxAge: 10 },
      { title: 'Mio min Mio', author: 'Astrid Lindgren', minAge: 7, maxAge: 11 },
      { title: 'Ronja Rövardotter', author: 'Astrid Lindgren', minAge: 8, maxAge: 12 },
      { title: 'Bröderna Lejonhjärta', author: 'Astrid Lindgren', minAge: 9, maxAge: 13 },
      { title: 'Nils Holgerssons underbara resa', author: 'Selma Lagerlöf', minAge: 10, maxAge: 14 },
      { title: 'En man som heter Ove', author: 'Fredrik Backman', minAge: 14, maxAge: 17 }
    ];
    const english = [
      { title: 'Charlotte\'s Web', author: 'E.B. White', minAge: 6, maxAge: 10 },
      { title: 'The BFG', author: 'Roald Dahl', minAge: 7, maxAge: 11 },
      { title: 'Harry Potter and the Philosopher\'s Stone', author: 'J.K. Rowling', minAge: 8, maxAge: 12 },
      { title: 'Percy Jackson', author: 'Rick Riordan', minAge: 9, maxAge: 13 },
      { title: 'The Hobbit', author: 'J.R.R. Tolkien', minAge: 10, maxAge: 14 },
      { title: 'The Hunger Games', author: 'Suzanne Collins', minAge: 13, maxAge: 17 }
    ];

    const all = [...swedish, ...english];
    return all.filter(b => age >= b.minAge && age <= b.maxAge);
  }

  _checkReadingBadge(childId) {
    const readingLog = this.readingLogs.get(childId);
    if (!readingLog) return;
    if (readingLog.books.length >= 10) {
      this.awardBadge(childId, 'reader');
    }
    if (readingLog.books.length >= 5) {
      readingLog.level = Math.min(10, readingLog.level + 1);
      this.readingLogs.set(childId, readingLog);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Music Practice
  // ═══════════════════════════════════════════════════════════════════════

  logMusicPractice(childId, data) {
    const child = this.children.get(childId);
    if (!child) return null;

    if (!this.supportedInstruments.includes(data.instrument)) {
      this.error(`Unsupported instrument: ${data.instrument}`);
      return null;
    }

    const entry = {
      id: `music_${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      instrument: data.instrument,
      durationMinutes: data.durationMinutes || 0,
      pieces: data.pieces || [],
      tempo: data.tempo || null,
      notes: data.notes || '',
      quality: data.quality || 'good', // poor, fair, good, excellent
      goalMet: data.durationMinutes >= this.dailyPracticeGoalMinutes
    };

    const logs = this.musicPracticeLogs.get(childId) || [];
    logs.push(entry);
    this.musicPracticeLogs.set(childId, logs);

    this.updateStreak(childId, 'music');
    this._checkMusicBadge(childId);

    this.log(`Music practice logged for ${child.name}: ${entry.instrument} ${entry.durationMinutes}min`);
    return entry;
  }

  getMusicPracticeStats(childId) {
    const child = this.children.get(childId);
    if (!child) return null;

    const logs = this.musicPracticeLogs.get(childId) || [];
    const today = new Date().toISOString().split('T')[0];
    const todayPractice = logs.filter(l => l.date === today);
    const totalToday = todayPractice.reduce((sum, l) => sum + l.durationMinutes, 0);

    const last7 = logs.filter(l => {
      const diff = (new Date(today) - new Date(l.date)) / 86400000;
      return diff < 7;
    });
    const weeklyTotal = last7.reduce((sum, l) => sum + l.durationMinutes, 0);

    return {
      childName: child.name,
      instruments: child.instruments,
      todayMinutes: totalToday,
      dailyGoal: this.dailyPracticeGoalMinutes,
      goalMet: totalToday >= this.dailyPracticeGoalMinutes,
      weeklyMinutes: weeklyTotal,
      practiceStreak: this.streaks.get(childId)?.music || 0,
      totalSessions: logs.length
    };
  }

  getMusicPracticeEnvironment() {
    return {
      lighting: { brightness: 80, temperature: 4000, description: 'Good, bright lighting for reading music' },
      soundproofing: { active: true, description: 'Soundproofing system activated' },
      temperature: { target: 21, unit: 'celsius' },
      metronome: { available: true, defaultBPM: 80 }
    };
  }

  _checkMusicBadge(childId) {
    const streak = this.streaks.get(childId)?.music || 0;
    if (streak >= 14) {
      this.awardBadge(childId, 'musician');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Language Learning
  // ═══════════════════════════════════════════════════════════════════════

  getDailyVocabulary(childId) {
    const child = this.children.get(childId);
    if (!child) return null;

    const vocabSets = {
      'Swedish-English': [
        { swedish: 'hund', english: 'dog', category: 'animals' },
        { swedish: 'katt', english: 'cat', category: 'animals' },
        { swedish: 'bok', english: 'book', category: 'objects' },
        { swedish: 'hus', english: 'house', category: 'places' },
        { swedish: 'skola', english: 'school', category: 'places' },
        { swedish: 'vän', english: 'friend', category: 'people' },
        { swedish: 'vatten', english: 'water', category: 'nature' },
        { swedish: 'sol', english: 'sun', category: 'nature' },
        { swedish: 'stjärna', english: 'star', category: 'nature' },
        { swedish: 'blomma', english: 'flower', category: 'nature' },
        { swedish: 'familj', english: 'family', category: 'people' },
        { swedish: 'mat', english: 'food', category: 'daily' },
        { swedish: 'tid', english: 'time', category: 'concepts' },
        { swedish: 'lycka', english: 'happiness', category: 'emotions' }
      ]
    };

    const set = vocabSets['Swedish-English'];
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    const word = set[dayOfYear % set.length];

    this.dailyVocabulary.set(childId, word);
    return {
      childName: child.name,
      word,
      date: new Date().toISOString().split('T')[0],
      thirdLanguage: child.languages.third
    };
  }

  getPhraseOfTheDay(childId) {
    const child = this.children.get(childId);
    if (!child) return null;

    const phrases = [
      { swedish: 'Hur mår du?', english: 'How are you?', context: 'Greeting' },
      { swedish: 'Jag tycker om att läsa.', english: 'I like to read.', context: 'Hobbies' },
      { swedish: 'Kan du hjälpa mig?', english: 'Can you help me?', context: 'Asking for help' },
      { swedish: 'Vad heter du?', english: 'What is your name?', context: 'Introductions' },
      { swedish: 'Tack så mycket!', english: 'Thank you so much!', context: 'Gratitude' },
      { swedish: 'Vilken fin dag!', english: 'What a beautiful day!', context: 'Weather' },
      { swedish: 'Jag förstår inte.', english: 'I don\'t understand.', context: 'Communication' },
      { swedish: 'Vi ses imorgon!', english: 'See you tomorrow!', context: 'Farewell' },
      { swedish: 'Jag har gjort läxorna.', english: 'I have done my homework.', context: 'School' },
      { swedish: 'Kan jag gå ut och leka?', english: 'Can I go out and play?', context: 'Daily life' }
    ];

    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    const phrase = phrases[dayOfYear % phrases.length];

    this.phraseOfTheDay.set(childId, phrase);
    return {
      childName: child.name,
      phrase,
      date: new Date().toISOString().split('T')[0],
      conversationPractice: `Try using "${phrase.swedish}" in a conversation today!`
    };
  }

  getLanguageProgress(childId) {
    const progress = this.languageProgress.get(childId);
    const child = this.children.get(childId);
    if (!progress || !child) return null;

    return {
      childName: child.name,
      primaryLanguage: child.languages.primary,
      secondaryLanguage: child.languages.secondary,
      thirdLanguage: child.languages.third,
      vocabularyLearned: progress.vocabularyLearned.length,
      phrasesLearned: progress.phrasesLearned.length,
      level: progress.level,
      bilingualSupport: true,
      schoolAlignment: child.schoolName ? `Aligned with ${child.schoolName} curriculum` : 'General curriculum'
    };
  }

  _checkLanguageBadge(childId) {
    const progress = this.languageProgress.get(childId);
    if (!progress) return;
    if (progress.vocabularyLearned.length >= 100) {
      this.awardBadge(childId, 'linguist');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Science Experiments
  // ═══════════════════════════════════════════════════════════════════════

  getScienceExperimentSuggestion(childId) {
    const child = this.children.get(childId);
    if (!child) return null;

    const experiments = this._getAgeAppropriateExperiments(child.age);
    const weekOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / (7 * 86400000));
    const experiment = experiments[weekOfYear % experiments.length];

    return {
      childName: child.name,
      experiment,
      date: new Date().toISOString().split('T')[0],
      stemLevel: this.stemSkillLevels.get(childId)
    };
  }

  _getAgeAppropriateExperiments(age) {
    if (age <= 8) {
      return [
        { name: 'Rainbow in a jar', materials: ['honey', 'dish soap', 'water', 'oil', 'rubbing alcohol'], safetyWarning: 'Adult supervision required for pouring', category: 'chemistry', difficulty: 1 },
        { name: 'Seed germination', materials: ['seeds', 'paper towel', 'zip bag', 'water'], safetyWarning: 'None', category: 'biology', difficulty: 1 },
        { name: 'Magnet exploration', materials: ['magnets', 'various metal objects'], safetyWarning: 'Keep magnets away from electronics', category: 'physics', difficulty: 1 },
        { name: 'Colour mixing', materials: ['food colouring', 'cups', 'water'], safetyWarning: 'May stain clothing', category: 'chemistry', difficulty: 1 }
      ];
    } else if (age <= 11) {
      return [
        { name: 'Baking soda volcano', materials: ['baking soda', 'vinegar', 'dish soap', 'food colouring', 'container'], safetyWarning: 'Do outdoors or on protective surface', category: 'chemistry', difficulty: 2 },
        { name: 'Crystal growing', materials: ['borax', 'pipe cleaners', 'hot water', 'jar'], safetyWarning: 'Adult help with hot water. Do not ingest borax.', category: 'chemistry', difficulty: 2 },
        { name: 'Simple electric circuit', materials: ['battery', 'LED', 'wires', 'tape'], safetyWarning: 'Use low voltage batteries only', category: 'physics', difficulty: 2 },
        { name: 'Plant maze', materials: ['shoe box', 'cardboard', 'plant', 'tape'], safetyWarning: 'None', category: 'biology', difficulty: 2 }
      ];
    } else if (age <= 14) {
      return [
        { name: 'pH testing household items', materials: ['red cabbage', 'various liquids', 'cups'], safetyWarning: 'Do not mix chemicals. Adult supervision.', category: 'chemistry', difficulty: 3 },
        { name: 'Build a simple motor', materials: ['battery', 'magnet', 'copper wire', 'tape'], safetyWarning: 'Wire may get warm', category: 'physics', difficulty: 3 },
        { name: 'DNA extraction', materials: ['strawberry', 'dish soap', 'salt', 'rubbing alcohol', 'zip bag'], safetyWarning: 'Do not ingest rubbing alcohol', category: 'biology', difficulty: 3 },
        { name: 'Water filtration', materials: ['plastic bottle', 'sand', 'gravel', 'charcoal', 'cotton'], safetyWarning: 'Do not drink filtered water', category: 'engineering', difficulty: 3 }
      ];
    }
    return [
      { name: 'Electrolysis of water', materials: ['9V battery', 'wires', 'pencil leads', 'water', 'baking soda'], safetyWarning: 'Small amounts of hydrogen and oxygen produced. Ventilate.', category: 'chemistry', difficulty: 4 },
      { name: 'Bridge strength testing', materials: ['popsicle sticks', 'glue', 'weights', 'string'], safetyWarning: 'None', category: 'engineering', difficulty: 4 },
      { name: 'Spectroscope', materials: ['cardboard tube', 'old CD', 'tape', 'razor blade'], safetyWarning: 'Adult supervision with razor blade', category: 'physics', difficulty: 4 },
      { name: 'Microbiology - yeast experiments', materials: ['yeast', 'sugar', 'warm water', 'balloons', 'bottles'], safetyWarning: 'None', category: 'biology', difficulty: 3 }
    ];
  }

  logExperiment(childId, data) {
    const child = this.children.get(childId);
    if (!child) return null;

    const entry = {
      id: `exp_${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      name: data.name,
      hypothesis: data.hypothesis || '',
      procedure: data.procedure || '',
      result: data.result || '',
      conclusion: data.conclusion || '',
      category: data.category || 'general',
      success: data.success !== undefined ? data.success : true,
      photos: data.photos || []
    };

    const experiments = this.experimentLog.get(childId) || [];
    experiments.push(entry);
    this.experimentLog.set(childId, experiments);

    // Update STEM skills
    const skills = this.stemSkillLevels.get(childId);
    if (skills && entry.category in skills) {
      skills[entry.category] = Math.min(10, skills[entry.category] + 0.5);
      this.stemSkillLevels.set(childId, skills);
    }

    this._checkScienceBadge(childId);
    this.log(`Experiment logged for ${child.name}: "${entry.name}"`);
    return entry;
  }

  _checkScienceBadge(childId) {
    const experiments = this.experimentLog.get(childId) || [];
    if (experiments.length >= 10) {
      this.awardBadge(childId, 'scientist');
    }
  }

  _initializeWeeklyExperiments() {
    this.weeklyExperimentSuggestions = [
      'Explore static electricity with a balloon',
      'Make slime and explore non-Newtonian fluids',
      'Build a paper airplane and test different designs',
      'Observe the moon phases this week',
      'Test which materials are magnetic'
    ];
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Creative Time
  // ═══════════════════════════════════════════════════════════════════════

  getArtProjectSuggestion(childId) {
    const child = this.children.get(childId);
    if (!child) return null;

    const month = new Date().getMonth();
    const season = this._getCurrentSeason(month);
    const seasonalCrafts = this._getSeasonalCrafts(season);

    const generalProjects = [
      { name: 'Self portrait', materials: ['paper', 'pencils', 'mirror'], duration: 45, ageRange: [6, 17] },
      { name: 'Clay sculpture', materials: ['air-dry clay', 'tools', 'paint'], duration: 60, ageRange: [6, 17] },
      { name: 'Collage art', materials: ['magazines', 'scissors', 'glue', 'paper'], duration: 40, ageRange: [6, 12] },
      { name: 'Origami', materials: ['origami paper'], duration: 30, ageRange: [7, 17] },
      { name: 'Nature art', materials: ['leaves', 'sticks', 'stones', 'glue'], duration: 45, ageRange: [6, 12] },
      { name: 'Comic strip creation', materials: ['paper', 'pens', 'coloured pencils'], duration: 60, ageRange: [8, 15] }
    ];

    const ageAppropriate = generalProjects.filter(
      p => child.age >= p.ageRange[0] && child.age <= p.ageRange[1]
    );

    return {
      childName: child.name,
      seasonal: seasonalCrafts,
      general: ageAppropriate,
      creativeSpaceSetup: {
        lighting: { brightness: 85, temperature: 5000, description: 'Bright, daylight-like lighting' },
        protectiveSurface: true,
        materialsReady: this.craftMaterialsInventory.length > 0
      }
    };
  }

  _getCurrentSeason(month) {
    if (month >= 5 && month <= 7) return 'Midsommar';
    if (month >= 10 || month <= 1) return 'Jul';
    if (month >= 2 && month <= 4) return 'Påsk';
    return null;
  }

  _getSeasonalCrafts(season) {
    if (!season || !this.seasonalCrafts[season]) return [];
    return this.seasonalCrafts[season].map(name => ({
      name,
      season
    }));
  }

  logArtProject(childId, data) {
    const child = this.children.get(childId);
    if (!child) return null;

    const project = {
      id: `art_${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      name: data.name,
      description: data.description || '',
      materials: data.materials || [],
      durationMinutes: data.durationMinutes || 0,
      photo: data.photo || null,
      seasonal: data.seasonal || false
    };

    const projects = this.artProjects.get(childId) || [];
    projects.push(project);
    this.artProjects.set(childId, projects);

    if (project.photo) {
      const gallery = this.projectGallery.get(childId) || [];
      gallery.push({ projectId: project.id, photo: project.photo, date: project.date, name: project.name });
      this.projectGallery.set(childId, gallery);
    }

    if (projects.length >= 15) {
      this.awardBadge(childId, 'artist');
    }

    this.log(`Art project logged for ${child.name}: "${project.name}"`);
    return project;
  }

  updateCraftInventory(materials) {
    this.craftMaterialsInventory = Array.isArray(materials) ? materials : [];
    this.log(`Craft materials inventory updated: ${this.craftMaterialsInventory.length} items`);
    return this.craftMaterialsInventory;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Physical Activity
  // ═══════════════════════════════════════════════════════════════════════

  logPhysicalActivity(childId, data) {
    const child = this.children.get(childId);
    if (!child) return null;

    const entry = {
      id: `activity_${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      activity: data.activity || 'General exercise',
      durationMinutes: data.durationMinutes || 0,
      intensity: data.intensity || 'moderate', // light, moderate, vigorous
      indoor: data.indoor !== undefined ? data.indoor : true,
      notes: data.notes || ''
    };

    const activityLog = this.activityLogs.get(childId);
    activityLog.daily.push(entry);
    activityLog.weeklyTotal += entry.durationMinutes;
    this.activityLogs.set(childId, activityLog);

    this.updateStreak(childId, 'exercise');

    const todayTotal = activityLog.daily
      .filter(e => e.date === entry.date)
      .reduce((sum, e) => sum + e.durationMinutes, 0);

    if (todayTotal >= this.dailyMovementGoalMinutes) {
      this.log(`Daily movement goal MET for ${child.name}!`);
      this._checkAthleteBadge(childId);
    }

    this.log(`Activity logged for ${child.name}: ${entry.activity} ${entry.durationMinutes}min`);
    return { entry, todayTotal, goalMinutes: this.dailyMovementGoalMinutes, goalMet: todayTotal >= this.dailyMovementGoalMinutes };
  }

  getActivitySuggestions(childId, weather = null) {
    const child = this.children.get(childId);
    if (!child) return [];

    const indoor = [
      'Dance to music', 'Yoga for kids', 'Indoor obstacle course',
      'Stretching exercises', 'Jump rope', 'Balance games',
      'Indoor bowling', 'Pillow fort building', 'Simon says exercise'
    ];

    const outdoor = [
      'Cycling', 'Football/soccer', 'Running/jogging',
      'Nature walk', 'Playground visit', 'Swimming',
      'Badminton', 'Frisbee', 'Gardening',
      'Ice skating (winter)', 'Sledding (winter)', 'Berry picking (summer)'
    ];

    const isOutdoorWeather = !weather || (weather.temperature > 0 && !weather.raining);

    const activeBreaks = [
      '10 jumping jacks', '5 push-ups', 'Run up and down stairs',
      'Balance on one foot for 30 seconds', 'Do a silly dance',
      'Walk like an animal for 1 minute'
    ];

    return {
      childName: child.name,
      indoor,
      outdoor: isOutdoorWeather ? outdoor : [],
      weatherSuitable: isOutdoorWeather,
      activeBreaks,
      dailyGoalMinutes: this.dailyMovementGoalMinutes,
      peHomeworkSupport: this._getPEHomeworkSuggestions(child.age)
    };
  }

  _getPEHomeworkSuggestions(age) {
    if (age <= 9) {
      return ['Practice catching and throwing', 'Balance exercises', 'Simple gymnastics'];
    } else if (age <= 12) {
      return ['Sports skill drills', 'Flexibility training', 'Team game practice'];
    }
    return ['Fitness circuit', 'Sport-specific training', 'Endurance building'];
  }

  _checkAthleteBadge(childId) {
    const streak = this.streaks.get(childId)?.exercise || 0;
    if (streak >= 21) {
      this.awardBadge(childId, 'athlete');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Social Development
  // ═══════════════════════════════════════════════════════════════════════

  schedulePlaydate(childId, data) {
    const child = this.children.get(childId);
    if (!child) return null;

    const playdate = {
      id: `play_${Date.now()}`,
      childId,
      friendName: data.friendName,
      date: data.date,
      time: data.time || '15:00',
      duration: data.duration || 120,
      location: data.location || 'home',
      activities: data.activities || [],
      confirmed: data.confirmed || false,
      parentContact: data.parentContact || '',
      notes: data.notes || ''
    };

    const playdates = this.playdates.get(childId) || [];
    playdates.push(playdate);
    this.playdates.set(childId, playdates);
    this.log(`Playdate scheduled for ${child.name} with ${playdate.friendName} on ${playdate.date}`);
    return playdate;
  }

  getSocialSkillsActivity(childId) {
    const child = this.children.get(childId);
    if (!child) return null;

    const activities = this._getSocialActivitiesByAge(child.age);
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);

    return {
      childName: child.name,
      activity: activities[dayOfYear % activities.length],
      conflictResolution: this._getConflictResolutionTool(child.age),
      communityInvolvement: this._getCommunityActivities(child.age)
    };
  }

  _getSocialActivitiesByAge(age) {
    if (age <= 8) {
      return [
        'Practice saying "please" and "thank you" in different situations',
        'Role-play introducing yourself to a new friend',
        'Share a toy or game with a sibling',
        'Practice taking turns in a game',
        'Draw a picture for a friend or family member'
      ];
    } else if (age <= 12) {
      return [
        'Write a kind note to a classmate',
        'Practice active listening during a conversation',
        'Help a younger child with something',
        'Organize a group game with neighbours',
        'Practice apologising sincerely'
      ];
    }
    return [
      'Have a meaningful conversation with a family member',
      'Volunteer for a community activity',
      'Practice perspective-taking in a disagreement',
      'Mentor a younger student',
      'Organize a study group'
    ];
  }

  _getConflictResolutionTool(age) {
    return {
      steps: [
        'Stop and take a deep breath',
        'Describe what happened using "I feel..." statements',
        'Listen to the other person\'s side',
        'Think of solutions together',
        'Choose the best solution and try it'
      ],
      ageAppropriate: age <= 8 ? 'Use simple words and visual aids' : 'Encourage independent resolution'
    };
  }

  _getCommunityActivities(age) {
    if (age <= 10) {
      return ['Help at a local event', 'Participate in a clean-up day', 'Visit elderly neighbours'];
    }
    return ['Volunteer at local organisations', 'Mentor younger children', 'Join community projects', 'Participate in charity events'];
  }

  planBirthday(childId, data) {
    const child = this.children.get(childId);
    if (!child) return null;

    const plan = {
      childId,
      childName: child.name,
      date: data.date,
      theme: data.theme || 'General party',
      guestList: data.guests || [],
      guestCount: (data.guests || []).length,
      activities: data.activities || this._getBirthdayActivities(child.age),
      food: data.food || [],
      venue: data.venue || 'home',
      budget: data.budget || null,
      invitationsSent: false,
      notes: data.notes || ''
    };

    this.birthdayPlans.set(childId, plan);
    this.log(`Birthday party planned for ${child.name} on ${plan.date}`);
    return plan;
  }

  _getBirthdayActivities(age) {
    if (age <= 8) {
      return ['Musical chairs', 'Treasure hunt', 'Pin the tail', 'Craft station', 'Face painting'];
    } else if (age <= 12) {
      return ['Scavenger hunt', 'Movie watching', 'Board games', 'Outdoor sports', 'Craft competition'];
    }
    return ['Movie night', 'Gaming tournament', 'Cooking/baking party', 'Outdoor adventure', 'Escape room'];
  }

  _initializeSocialSkillsActivities() {
    this.socialSkillsActivities = [
      'Practice empathy by discussing feelings',
      'Team building exercise',
      'Communication challenge',
      'Cooperation game',
      'Gratitude journaling'
    ];
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Progress Reporting
  // ═══════════════════════════════════════════════════════════════════════

  generateWeeklyReport(childId) {
    const child = this.children.get(childId);
    if (!child) return null;

    const screenStatus = this.getScreenTimeStatus(childId);
    const readingStats = this.getReadingStats(childId);
    const musicStats = this.getMusicPracticeStats(childId);
    const assignments = this.getAssignments(childId);
    const badges = this.getBadges(childId);
    const chorePoints = this.chorePoints.get(childId) || 0;
    const activityLog = this.activityLogs.get(childId);
    const experiments = this.experimentLog.get(childId) || [];

    const completedAssignments = assignments.filter(a => a.status === 'completed');
    const overdueAssignments = assignments.filter(a => a.status === 'overdue');
    const helpNeededAssignments = assignments.filter(a => a.helpNeeded);

    const subjectPerformance = {};
    for (const subject of this.subjects) {
      const subjectAssignments = assignments.filter(a => a.subject === subject);
      const completed = subjectAssignments.filter(a => a.status === 'completed');
      subjectPerformance[subject] = {
        total: subjectAssignments.length,
        completed: completed.length,
        completionRate: subjectAssignments.length > 0
          ? Math.round((completed.length / subjectAssignments.length) * 100) : 0,
        avgDifficulty: completed.length > 0
          ? Math.round(completed.reduce((sum, a) => sum + a.difficultyRating, 0) / completed.length * 10) / 10 : 0
      };
    }

    const report = {
      childName: child.name,
      childAge: child.age,
      reportDate: new Date().toISOString().split('T')[0],
      weekOf: this._getWeekStart(),
      screenTime: {
        averageDailyMinutes: screenStatus ? screenStatus.usedMinutes : 0,
        complianceRate: screenStatus ? Math.min(100, 100 - screenStatus.percentageUsed + 100) : 100,
        categoryBreakdown: screenStatus?.categoryBreakdown || {}
      },
      homework: {
        totalAssignments: assignments.length,
        completed: completedAssignments.length,
        overdue: overdueAssignments.length,
        helpNeeded: helpNeededAssignments.length,
        subjectPerformance
      },
      reading: readingStats,
      musicPractice: musicStats,
      achievements: {
        totalBadges: badges.length,
        recentBadges: badges.slice(-3),
        streaks: this.streaks.get(childId)
      },
      physicalActivity: {
        weeklyMinutes: activityLog?.weeklyTotal || 0,
        goalMet: (activityLog?.weeklyTotal || 0) >= this.dailyMovementGoalMinutes * 7
      },
      chores: {
        totalPoints: chorePoints,
        weeklyCompletions: (this.choreCompletions.get(childId) || []).filter(c => {
          const diff = (Date.now() - new Date(c.date).getTime()) / 86400000;
          return diff < 7;
        }).length
      },
      scienceExperiments: {
        total: experiments.length,
        recentWeek: experiments.filter(e => {
          const diff = (Date.now() - new Date(e.date).getTime()) / 86400000;
          return diff < 7;
        }).length,
        stemLevels: this.stemSkillLevels.get(childId)
      },
      areasNeedingAttention: this._identifyAreasNeedingAttention(childId),
      teacherConferencePrep: this._generateConferenceNotes(childId)
    };

    const reports = this.progressReports.get(childId) || [];
    reports.push(report);
    this.progressReports.set(childId, reports);

    this.log(`Weekly report generated for ${child.name}`);
    return report;
  }

  _identifyAreasNeedingAttention(childId) {
    const areas = [];
    const child = this.children.get(childId);
    if (!child) return areas;

    const assignments = this.assignments.get(childId) || [];
    const overdue = assignments.filter(a => a.status === 'overdue');
    if (overdue.length > 0) {
      areas.push({ area: 'Overdue assignments', count: overdue.length, priority: 'high' });
    }

    const helpNeeded = assignments.filter(a => a.helpNeeded);
    if (helpNeeded.length > 0) {
      areas.push({
        area: 'Needs help with homework',
        subjects: [...new Set(helpNeeded.map(a => a.subject))],
        priority: 'medium'
      });
    }

    const streaks = this.streaks.get(childId);
    if (streaks) {
      if (streaks.reading === 0) areas.push({ area: 'No reading activity', priority: 'medium' });
      if (streaks.exercise === 0) areas.push({ area: 'No physical activity logged', priority: 'medium' });
    }

    const screenStatus = this.getScreenTimeStatus(childId);
    if (screenStatus && screenStatus.percentageUsed > 90) {
      areas.push({ area: 'Screen time consistently near limit', priority: 'low' });
    }

    return areas;
  }

  _generateConferenceNotes(childId) {
    const child = this.children.get(childId);
    if (!child) return null;

    const assignments = this.assignments.get(childId) || [];
    const subjectDifficulties = {};
    for (const a of assignments) {
      if (!subjectDifficulties[a.subject]) {
        subjectDifficulties[a.subject] = [];
      }
      subjectDifficulties[a.subject].push(a.difficultyRating);
    }

    const challengingSubjects = Object.entries(subjectDifficulties)
      .filter(([, ratings]) => {
        const avg = ratings.reduce((s, r) => s + r, 0) / ratings.length;
        return avg >= 4;
      })
      .map(([subject]) => subject);

    return {
      childName: child.name,
      schoolName: child.schoolName,
      grade: child.grade,
      strengths: child.strengths,
      areasForImprovement: child.areasForImprovement,
      challengingSubjects,
      specialNeeds: child.specialNeeds,
      learningStyle: child.learningStyle,
      readingLevel: (this.readingLogs.get(childId) || {}).level || 1,
      socialNotes: 'See playdate and social skills activity logs'
    };
  }

  _getWeekStart() {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    return new Date(now.setDate(diff)).toISOString().split('T')[0];
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Chore Integration
  // ═══════════════════════════════════════════════════════════════════════

  getAvailableChores(childId) {
    const child = this.children.get(childId);
    if (!child) return [];

    return Object.entries(this.choreDefinitions)
      .filter(([, chore]) => child.age >= chore.minAge)
      .map(([id, chore]) => ({
        id,
        ...chore
      }));
  }

  completeChore(childId, choreId, verified = false) {
    const child = this.children.get(childId);
    if (!child) return null;

    const chore = this.choreDefinitions[choreId];
    if (!chore) {
      this.error(`Unknown chore: ${choreId}`);
      return null;
    }
    if (child.age < chore.minAge) {
      this.error(`${child.name} is too young for chore: ${chore.name}`);
      return null;
    }

    const completion = {
      id: `chore_${Date.now()}`,
      choreId,
      choreName: chore.name,
      points: chore.points,
      date: new Date().toISOString(),
      verified
    };

    const completions = this.choreCompletions.get(childId) || [];
    completions.push(completion);
    this.choreCompletions.set(childId, completions);

    const currentPoints = this.chorePoints.get(childId) || 0;
    this.chorePoints.set(childId, currentPoints + chore.points);

    this.log(`Chore completed by ${child.name}: ${chore.name} (+${chore.points}pts)`);
    this._checkHelperBadge(childId);

    return {
      completion,
      totalPoints: currentPoints + chore.points,
      bonusScreenTime: Math.floor(chore.points / 10) * 5 // 5min screen time per 10 points
    };
  }

  redeemChorePoints(childId, type, amount) {
    const child = this.children.get(childId);
    if (!child) return null;

    const currentPoints = this.chorePoints.get(childId) || 0;
    if (currentPoints < amount) {
      return { success: false, reason: 'Insufficient points', currentPoints };
    }

    let reward = null;
    if (type === 'screen_time') {
      const bonusMinutes = Math.floor(amount / 10) * 5;
      this.addBonusScreenTime(childId, bonusMinutes, 'Chore points redemption');
      reward = { type: 'screen_time', minutes: bonusMinutes };
    } else if (type === 'allowance') {
      const kronor = Math.floor(amount / 5);
      reward = { type: 'allowance', amount: kronor, currency: 'SEK' };
    }

    this.chorePoints.set(childId, currentPoints - amount);
    this.log(`Points redeemed by ${child.name}: ${amount}pts for ${type}`);
    return { success: true, reward, remainingPoints: currentPoints - amount };
  }

  _generateWeeklyChoreChart(childId) {
    const child = this.children.get(childId);
    if (!child) return {};

    const availableChores = this.getAvailableChores(childId);
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const chart = {};

    for (const day of days) {
      chart[day] = availableChores.slice(0, 3).map(c => ({
        choreId: c.id,
        choreName: c.name,
        points: c.points,
        completed: false
      }));
    }

    return chart;
  }

  _checkHelperBadge(childId) {
    const completions = this.choreCompletions.get(childId) || [];
    if (completions.length >= 30) {
      this.awardBadge(childId, 'helper');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Bedtime Routine
  // ═══════════════════════════════════════════════════════════════════════

  getBedtimeRoutine(childId) {
    const child = this.children.get(childId);
    if (!child) return null;

    const bedtime = this._getBedtimeForAge(child.age);
    const bedtimeParts = bedtime.split(':');
    const bedtimeTotal = parseInt(bedtimeParts[0]) * 60 + parseInt(bedtimeParts[1]);

    const screenCutoff = this._formatTime(0, bedtimeTotal - this.screenCutoffBeforeBedMinutes);
    const windDownStart = this._formatTime(0, bedtimeTotal - 45);
    const readingStart = this._formatTime(0, bedtimeTotal - this.bedtimeReadingMinutes);

    const windDownActivities = this._getWindDownActivities(child.age);

    return {
      childName: child.name,
      childAge: child.age,
      bedtime,
      screenCutoff,
      windDownStart,
      readingStart,
      routine: [
        { time: screenCutoff, activity: 'Screens off', type: 'mandatory' },
        { time: windDownStart, activity: 'Start winding down', type: 'transition' },
        { time: this._formatTime(0, bedtimeTotal - 40), activity: 'Bath/shower or get ready', type: 'hygiene' },
        { time: readingStart, activity: 'Bedtime reading', type: 'reading' },
        { time: bedtime, activity: 'Lights out', type: 'sleep' }
      ],
      windDownActivities,
      lighting: {
        windDown: { brightness: 30, temperature: 2200, description: 'Warm, dim lighting' },
        reading: { brightness: 40, temperature: 2700, description: 'Warm reading light' },
        nightLight: { brightness: 5, temperature: 2000, description: 'Soft night light' }
      },
      music: {
        type: 'calm',
        volume: 15,
        suggestions: ['Classical lullabies', 'Nature sounds', 'Ambient music', 'Soft piano']
      }
    };
  }

  _getBedtimeForAge(age) {
    if (age >= 6 && age <= 8) return this.bedtimesByAge['6-8'];
    if (age >= 9 && age <= 11) return this.bedtimesByAge['9-11'];
    if (age >= 12 && age <= 14) return this.bedtimesByAge['12-14'];
    if (age >= 15 && age <= 17) return this.bedtimesByAge['15-17'];
    return '21:00'; // default
  }

  _getWindDownActivities(age) {
    if (age <= 8) {
      return ['Coloring', 'Gentle play', 'Story time', 'Soft music', 'Cuddle time'];
    } else if (age <= 12) {
      return ['Reading', 'Journaling', 'Gentle stretching', 'Calm board game', 'Drawing'];
    }
    return ['Reading', 'Journaling', 'Meditation', 'Gentle music', 'Light conversation'];
  }

  _isBedtimeScreenCutoff(childId) {
    const child = this.children.get(childId);
    if (!child) return false;

    const bedtime = this._getBedtimeForAge(child.age);
    const bedtimeParts = bedtime.split(':');
    const bedtimeMinutes = parseInt(bedtimeParts[0]) * 60 + parseInt(bedtimeParts[1]);
    const cutoffMinutes = bedtimeMinutes - this.screenCutoffBeforeBedMinutes;

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    return nowMinutes >= cutoffMinutes;
  }

  _checkBedtimeRoutines() {
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    for (const [childId, child] of this.children) {
      const bedtime = this._getBedtimeForAge(child.age);
      const bedtimeParts = bedtime.split(':');
      const bedtimeMinutes = parseInt(bedtimeParts[0]) * 60 + parseInt(bedtimeParts[1]);

      const windDownMinutes = bedtimeMinutes - 45;
      const screenCutoffMinutes = bedtimeMinutes - this.screenCutoffBeforeBedMinutes;

      const routine = this.bedtimeRoutines.get(childId);

      if (nowMinutes >= screenCutoffMinutes && nowMinutes < screenCutoffMinutes + 3) {
        this.log(`Screen cutoff time for ${child.name} - ${this.screenCutoffBeforeBedMinutes}min before bedtime`);
        // End any active screen sessions
        const sessions = this.screenTimeSessions.get(childId);
        if (sessions) {
          for (const s of sessions.today.filter(ss => ss.active)) {
            this.endScreenSession(childId, s.id);
          }
        }
      }

      if (nowMinutes >= windDownMinutes && nowMinutes < windDownMinutes + 3 && routine && !routine.windDownStarted) {
        routine.windDownStarted = true;
        this.bedtimeRoutines.set(childId, routine);
        this.log(`Wind-down time started for ${child.name}`);
      }

      if (nowMinutes >= bedtimeMinutes && nowMinutes < bedtimeMinutes + 3) {
        this.log(`Bedtime for ${child.name} (${bedtime})`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Holiday / Vacation Mode
  // ═══════════════════════════════════════════════════════════════════════

  setVacationMode(enabled, options = {}) {
    this.vacationMode = enabled;
    if (enabled) {
      this.vacationScreenMultiplier = options.screenMultiplier || 1.5;
      this.log('Vacation mode ENABLED - relaxed screen limits active');
    } else {
      this.vacationScreenMultiplier = 1.0;
      this.log('Vacation mode DISABLED - normal limits restored');
    }
    return { vacationMode: this.vacationMode, screenMultiplier: this.vacationScreenMultiplier };
  }

  getHolidayActivities(childId, type = 'general') {
    const child = this.children.get(childId);
    if (!child) return null;

    const activities = {
      educational_trip: [
        'Visit a local museum', 'Nature reserve exploration',
        'Historical site tour', 'Science centre visit',
        'Art gallery exploration', 'Zoo/aquarium trip',
        'Botanical garden visit', 'Farm visit'
      ],
      summer_reading: this._getSummerReadingProgram(child.age),
      holiday_projects: [
        'Create a photo journal of the holiday',
        'Learn a new recipe from the region',
        'Nature observation diary',
        'Build a model of something you visited',
        'Write postcards to friends'
      ],
      museum_visits: [
        { name: 'Tekniska museet', type: 'Science & Technology', city: 'Stockholm' },
        { name: 'Universeum', type: 'Science Centre', city: 'Gothenburg' },
        { name: 'Naturhistoriska riksmuseet', type: 'Natural History', city: 'Stockholm' },
        { name: 'Vasa Museum', type: 'Maritime History', city: 'Stockholm' }
      ],
      nature_visits: [
        'National park hiking', 'Forest exploration',
        'Lake swimming and nature observation', 'Bird watching',
        'Mushroom/berry picking (with adult guidance)', 'Stargazing'
      ]
    };

    return {
      childName: child.name,
      type,
      activities: activities[type] || activities.educational_trip,
      allCategories: Object.keys(activities)
    };
  }

  _getSummerReadingProgram(age) {
    const booksGoal = age <= 10 ? 8 : 5;
    return {
      goal: `Read ${booksGoal} books over summer`,
      booksGoal,
      categories: ['Fiction', 'Non-fiction', 'Swedish classic', 'English novel', 'Free choice'],
      reward: 'Special outing or book shopping trip'
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Parental Controls
  // ═══════════════════════════════════════════════════════════════════════

  setupParentalPIN(pin) {
    if (typeof pin !== 'string' || pin.length < 4) {
      this.error('PIN must be at least 4 characters');
      return false;
    }
    this.parentalPIN = pin;
    this.log('Parental PIN configured');
    return true;
  }

  verifyPIN(pin) {
    if (!this.parentalPIN) return true; // No PIN set
    return pin === this.parentalPIN;
  }

  setParentPermissions(parentId, permissions) {
    const validPermissions = [
      'manage_children', 'manage_screen_time', 'manage_homework',
      'manage_chores', 'view_reports', 'manage_bedtime',
      'manage_vacation_mode', 'emergency_override', 'manage_playdates'
    ];

    const filtered = (permissions || []).filter(p => validPermissions.includes(p));
    this.parentPermissions.set(parentId, {
      parentId,
      permissions: filtered,
      updatedAt: new Date().toISOString()
    });

    this.log(`Permissions updated for parent ${parentId}: ${filtered.length} permissions`);
    return this.parentPermissions.get(parentId);
  }

  submitApprovalRequest(type, details) {
    const request = {
      id: `approval_${Date.now()}`,
      type,
      details,
      status: 'pending',
      submittedAt: new Date().toISOString(),
      resolvedAt: null,
      resolvedBy: null
    };

    this.approvalQueue.push(request);
    this.log(`Approval request submitted: ${type}`);
    return request;
  }

  resolveApprovalRequest(requestId, approved, parentId, pin) {
    if (!this.verifyPIN(pin)) {
      this.error('Invalid PIN for approval');
      return { success: false, reason: 'invalid_pin' };
    }

    const request = this.approvalQueue.find(r => r.id === requestId);
    if (!request) return { success: false, reason: 'request_not_found' };

    request.status = approved ? 'approved' : 'rejected';
    request.resolvedAt = new Date().toISOString();
    request.resolvedBy = parentId;

    this.log(`Approval request ${request.status}: ${request.type} by ${parentId}`);
    return { success: true, request };
  }

  activateEmergencyOverride(pin) {
    if (!this.verifyPIN(pin)) {
      this.error('Invalid PIN for emergency override');
      return false;
    }
    this.emergencyOverrideActive = true;
    this.log('EMERGENCY OVERRIDE ACTIVATED - all restrictions temporarily lifted');
    return true;
  }

  deactivateEmergencyOverride(pin) {
    if (!this.verifyPIN(pin)) return false;
    this.emergencyOverrideActive = false;
    this.log('Emergency override deactivated - normal restrictions restored');
    return true;
  }

  getPendingApprovals() {
    return this.approvalQueue.filter(r => r.status === 'pending');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Monitoring Cycle
  // ═══════════════════════════════════════════════════════════════════════

  _startMonitoringCycle() {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
    }

    this.monitoringTimer = setInterval(() => {
      this._runMonitoringCycle();
    }, this.monitoringIntervalMs);

    this.log(`Monitoring cycle started (every ${this.monitoringIntervalMs / 60000} minutes)`);
  }

  _runMonitoringCycle() {
    try {
      this.lastMonitoringCycle = new Date().toISOString();

      // Check screen time limits
      this._checkScreenTimeLimits();

      // Check homework deadlines
      this._checkHomeworkDeadlines();

      // Check library book returns
      this._checkLibraryReturns();

      // Check bedtime routines
      this._checkBedtimeRoutines();

      // Check learning block schedules
      this._checkLearningBlockSchedules();

      // Check music practice reminders
      this._checkMusicPracticeReminders();

      // Check daily reset (midnight)
      this._checkDailyReset();

    } catch (err) {
      this.error(`Monitoring cycle error: ${err.message}`);
    }
  }

  _checkLearningBlockSchedules() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    for (const [childId, schedule] of this.learningBlocks) {
      if (!schedule || !schedule.blocks) continue;
      const child = this.children.get(childId);
      if (!child) continue;

      if (currentHour === this.optimalFocusWindow.start && currentMinute < 3) {
        this.log(`Learning block time starting for ${child.name}`);
      }

      for (const block of schedule.blocks) {
        const [blockH, blockM] = block.startTime.split(':').map(Number);
        if (currentHour === blockH && Math.abs(currentMinute - blockM) < 3) {
          if (block.type === 'focus') {
            this.log(`Focus session: ${child.name} - ${block.subject} (${this.pomodoroMinutes}min)`);
          } else if (block.type === 'break') {
            this.log(`Break time for ${child.name}: ${block.suggestion}`);
          }
        }
      }
    }
  }

  _checkMusicPracticeReminders() {
    const now = new Date();
    const currentHour = now.getHours();

    if (currentHour === 17) {
      for (const [childId, child] of this.children) {
        if (child.instruments && child.instruments.length > 0) {
          const logs = this.musicPracticeLogs.get(childId) || [];
          const today = new Date().toISOString().split('T')[0];
          const practicedToday = logs.some(l => l.date === today);
          if (!practicedToday) {
            this.log(`Music practice reminder for ${child.name}: ${child.instruments.join(', ')}`);
          }
        }
      }
    }
  }

  _checkDailyReset() {
    const now = new Date();
    if (now.getHours() === 0 && now.getMinutes() < 3) {
      this._resetDailyScreenTime();
      this._resetDailyBedtimeRoutines();
      this.log('Daily counters reset at midnight');
    }
  }

  _resetDailyBedtimeRoutines() {
    for (const [childId] of this.bedtimeRoutines) {
      this.bedtimeRoutines.set(childId, { active: false, windDownStarted: false });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Statistics
  // ═══════════════════════════════════════════════════════════════════════

  getStatistics() {
    const childCount = this.children.size;
    const totalAssignments = Array.from(this.assignments.values()).reduce((sum, a) => sum + a.length, 0);
    const completedAssignments = Array.from(this.assignments.values())
      .reduce((sum, a) => sum + a.filter(x => x.status === 'completed').length, 0);
    const totalBadges = Array.from(this.earnedBadges.values()).reduce((sum, b) => sum + b.length, 0);
    const totalBooks = Array.from(this.readingLogs.values()).reduce((sum, r) => sum + r.books.length, 0);
    const totalExperiments = Array.from(this.experimentLog.values()).reduce((sum, e) => sum + e.length, 0);
    const totalChorePoints = Array.from(this.chorePoints.values()).reduce((sum, p) => sum + p, 0);
    const totalMusicSessions = Array.from(this.musicPracticeLogs.values()).reduce((sum, l) => sum + l.length, 0);
    const totalArtProjects = Array.from(this.artProjects.values()).reduce((sum, p) => sum + p.length, 0);
    const pendingApprovals = this.getPendingApprovals().length;

    const childStats = {};
    for (const [childId, child] of this.children) {
      childStats[child.name] = {
        age: child.age,
        learningStyle: child.learningStyle,
        screenTimeUsed: (this.screenTimeSessions.get(childId) || {}).totalToday || 0,
        screenTimeLimit: this.getScreenTimeLimit(childId),
        assignmentsTotal: (this.assignments.get(childId) || []).length,
        assignmentsCompleted: (this.assignments.get(childId) || []).filter(a => a.status === 'completed').length,
        badgesEarned: (this.earnedBadges.get(childId) || []).length,
        booksRead: (this.readingLogs.get(childId) || {}).books?.length || 0,
        readingLevel: (this.readingLogs.get(childId) || {}).level || 1,
        musicPracticeSessions: (this.musicPracticeLogs.get(childId) || []).length,
        chorePoints: this.chorePoints.get(childId) || 0,
        streaks: this.streaks.get(childId) || {},
        experimentsCompleted: (this.experimentLog.get(childId) || []).length,
        artProjectsCompleted: (this.artProjects.get(childId) || []).length
      };
    }

    return {
      system: 'HomeChildEducationSystem',
      initialized: this.initialized,
      lastMonitoringCycle: this.lastMonitoringCycle,
      monitoringIntervalMinutes: this.monitoringIntervalMs / 60000,
      vacationMode: this.vacationMode,
      emergencyOverride: this.emergencyOverrideActive,
      pinConfigured: this.parentalPIN !== null,
      summary: {
        childCount,
        totalAssignments,
        completedAssignments,
        homeworkCompletionRate: totalAssignments > 0
          ? Math.round((completedAssignments / totalAssignments) * 100) : 0,
        totalBadgesEarned: totalBadges,
        totalBooksRead: totalBooks,
        totalExperiments,
        totalChorePoints,
        totalMusicSessions,
        totalArtProjects,
        pendingApprovals
      },
      children: childStats,
      badgeTypes: this.badgeTypes.map(b => `${b.icon} ${b.name}`),
      supportedSubjects: this.subjects,
      supportedInstruments: this.supportedInstruments,
      screenCategories: this.screenCategories,
      choreTypes: Object.keys(this.choreDefinitions).length,
      timestamp: new Date().toISOString()
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Utility Methods
  // ═══════════════════════════════════════════════════════════════════════

  _isWeekend() {
    const day = new Date().getDay();
    return day === 0 || day === 6;
  }

  async _loadStoredData() {
    try {
      this.log('Loading stored child education data...');
      // Integration point for persistent storage
    } catch (err) {
      this.log('No previous data found, starting fresh');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Logging
  // ═══════════════════════════════════════════════════════════════════════

  log(msg) {
    if (this.homey && typeof this.homey.log === 'function') {
      this.homey.log(`[ChildEdu] ${msg}`);
    } else {
      console.log(`[ChildEdu] ${msg}`);
    }
  }

  error(msg) {
    if (this.homey && typeof this.homey.error === 'function') {
      this.homey.error(`[ChildEdu] ${msg}`);
    } else {
      console.error(`[ChildEdu] ${msg}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Destroy / Cleanup
  // ═══════════════════════════════════════════════════════════════════════

  destroy() {
    try {
      this.log('Shutting down HomeChildEducationSystem...');

      if (this.monitoringTimer) {
        clearInterval(this.monitoringTimer);
        this.monitoringTimer = null;
      }

      // End all active screen sessions
      for (const [childId, session] of this.screenTimeSessions) {
        if (!session) continue;
        for (const s of session.today.filter(ss => ss.active)) {
          this.endScreenSession(childId, s.id);
        }
      }

      this.children.clear();
      this.screenTimeSessions.clear();
      this.bonusTimeBank.clear();
      this.assignments.clear();
      this.earnedBadges.clear();
      this.streaks.clear();
      this.readingLogs.clear();
      this.readingLists.clear();
      this.libraryBooks.clear();
      this.musicPracticeLogs.clear();
      this.practiceStreaks.clear();
      this.languageProgress.clear();
      this.experimentLog.clear();
      this.stemSkillLevels.clear();
      this.artProjects.clear();
      this.projectGallery.clear();
      this.activityLogs.clear();
      this.sportsSchedules.clear();
      this.playdates.clear();
      this.birthdayPlans.clear();
      this.choreCompletions.clear();
      this.chorePoints.clear();
      this.weeklyChoreChart.clear();
      this.bedtimeRoutines.clear();
      this.progressReports.clear();
      this.teacherConferenceNotes.clear();
      this.learningBlocks.clear();
      this.dailyVocabulary.clear();
      this.phraseOfTheDay.clear();
      this.parentPermissions.clear();
      this.summerReadingPrograms.clear();
      this.holidayProjects.clear();
      this.approvalQueue = [];
      this.craftMaterialsInventory = [];

      this.initialized = false;
      this.log('HomeChildEducationSystem shut down successfully');
    } catch (err) {
      this.error(`Error during shutdown: ${err.message}`);
    }
  }
}

module.exports = HomeChildEducationSystem;
