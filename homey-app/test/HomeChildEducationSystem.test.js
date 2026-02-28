'use strict';

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertType } = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');

/* ── timer-leak prevention ────────────────────────────────────────────── */
const _origSetTimeout = global.setTimeout;
const _origSetInterval = global.setInterval;
const activeHandles = [];
global.setTimeout = (...args) => { const id = _origSetTimeout(...args); activeHandles.push({ type: 'timeout', id }); return id; };
global.setInterval = (...args) => { const id = _origSetInterval(...args); activeHandles.push({ type: 'interval', id }); return id; };
function cleanup(sys) {
  try { sys.destroy(); } catch (_) { /* ignore */ }
  while (activeHandles.length > 0) {
    const h = activeHandles.pop();
    if (h.type === 'timeout') clearTimeout(h.id);
    else clearInterval(h.id);
  }
}

const HomeChildEducationSystem = require('../lib/HomeChildEducationSystem');

function makeChild(overrides = {}) {
  return Object.assign({
    name: 'Emma',
    age: 10,
    grade: '4',
    schoolName: 'Stockholm School',
    learningStyle: 'visual',
    languages: { primary: 'Swedish', secondary: 'English', third: null },
    instruments: ['piano'],
    strengths: ['reading'],
    areasForImprovement: ['mathematics'],
    specialNeeds: null
  }, overrides);
}

/* ══════════════════════════════════════════════════════════════════════ */
/*  Constructor                                                         */
/* ══════════════════════════════════════════════════════════════════════ */
describe('HomeChildEducationSystem — constructor', () => {
  it('creates instance with default values', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      assertEqual(sys.initialized, false);
      assertEqual(sys.vacationMode, false);
      assertEqual(sys.parentalPIN, null);
      assertEqual(sys.emergencyOverrideActive, false);
      assertType(sys.children, 'object'); // Map
      assertEqual(sys.children.size, 0);
      assertEqual(sys.maxChildren, 6);
      assertEqual(sys.pomodoroMinutes, 25);
      assertEqual(sys.breakMinutes, 5);
    } finally { cleanup(sys); }
  });
});

/* ══════════════════════════════════════════════════════════════════════ */
/*  Initialize                                                          */
/* ══════════════════════════════════════════════════════════════════════ */
describe('HomeChildEducationSystem — initialize', () => {
  it('sets initialized to true', async () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      await sys.initialize();
      assertEqual(sys.initialized, true);
    } finally { cleanup(sys); }
  });
});

/* ══════════════════════════════════════════════════════════════════════ */
/*  Child Management                                                    */
/* ══════════════════════════════════════════════════════════════════════ */
describe('HomeChildEducationSystem — child management', () => {
  it('addChild creates a child profile with generated id', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const child = sys.addChild(makeChild());
      assert(child !== null, 'child should not be null');
      assert(child.id.startsWith('child_'), 'id should start with child_');
      assertEqual(child.name, 'Emma');
      assertEqual(child.age, 10);
      assertEqual(child.learningStyle, 'visual');
    } finally { cleanup(sys); }
  });

  it('addChild returns null at max 6 children', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      for (let i = 0; i < 6; i++) {
        const c = sys.addChild(makeChild({ name: `Child${i}` }));
        assert(c !== null, `child ${i} should be created`);
      }
      const extra = sys.addChild(makeChild({ name: 'Overflow' }));
      assertEqual(extra, null);
    } finally { cleanup(sys); }
  });

  it('getChild returns profile or null', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const child = sys.addChild(makeChild());
      const found = sys.getChild(child.id);
      assertEqual(found.name, 'Emma');
      assertEqual(sys.getChild('nonexistent'), null);
    } finally { cleanup(sys); }
  });

  it('removeChild cleans up tracking and returns true', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const child = sys.addChild(makeChild());
      const removed = sys.removeChild(child.id);
      assertEqual(removed, true);
      assertEqual(sys.children.size, 0);
      assertEqual(sys.removeChild('nonexistent'), false);
    } finally { cleanup(sys); }
  });

  it('getAllChildren returns array of profiles', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      sys.addChild(makeChild({ name: 'A' }));
      sys.addChild(makeChild({ name: 'B' }));
      const all = sys.getAllChildren();
      assertEqual(all.length, 2);
    } finally { cleanup(sys); }
  });

  it('updateChild changes allowed fields', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const child = sys.addChild(makeChild());
      const updated = sys.updateChild(child.id, { name: 'Ella', age: 11 });
      assert(updated !== null, 'update should succeed');
      assertEqual(updated.name, 'Ella');
      assertEqual(updated.age, 11);
    } finally { cleanup(sys); }
  });
});

/* ══════════════════════════════════════════════════════════════════════ */
/*  Screen Time                                                         */
/* ══════════════════════════════════════════════════════════════════════ */
describe('HomeChildEducationSystem — screen time', () => {
  it('getScreenTimeLimit returns a positive number', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const child = sys.addChild(makeChild({ age: 10 }));
      const result = sys.getScreenTimeLimit(child.id);
      assertType(result, 'number');
      assert(result > 0, 'limit should be > 0');
    } finally { cleanup(sys); }
  });

  it('getScreenTimeLimit returns 0 for unknown child', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const result = sys.getScreenTimeLimit('nonexistent');
      assertEqual(result, 0);
    } finally { cleanup(sys); }
  });

  it('vacation mode increases screen time limit', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const child = sys.addChild(makeChild({ age: 10 }));
      const normalLimit = sys.getScreenTimeLimit(child.id);
      sys.setVacationMode(true, { screenMultiplier: 1.5 });
      const vacationLimit = sys.getScreenTimeLimit(child.id);
      assert(vacationLimit > normalLimit, 'vacation limit should be higher');
      sys.setVacationMode(false);
    } finally { cleanup(sys); }
  });

  it('startScreenSession returns session object', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const child = sys.addChild(makeChild({ age: 10 }));
      const result = sys.startScreenSession(child.id, 'educational');
      assert(result !== null, 'result should not be null');
      assert(result.session || result.blocked, 'should have session or blocked');
    } finally { cleanup(sys); }
  });

  it('addBonusScreenTime increases bonus bank', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const child = sys.addChild(makeChild());
      const baseLine = sys.getScreenTimeLimit(child.id);
      sys.addBonusScreenTime(child.id, 30, 'Good behavior');
      const after = sys.getScreenTimeLimit(child.id);
      assertEqual(after, baseLine + 30);
    } finally { cleanup(sys); }
  });

  it('getScreenTimeStatus returns comprehensive object', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const child = sys.addChild(makeChild());
      const status = sys.getScreenTimeStatus(child.id);
      assert(status !== null, 'status should not be null');
      assertType(status.usedMinutes, 'number');
      assertType(status.percentageUsed, 'number');
    } finally { cleanup(sys); }
  });
});

/* ══════════════════════════════════════════════════════════════════════ */
/*  Assignments                                                         */
/* ══════════════════════════════════════════════════════════════════════ */
describe('HomeChildEducationSystem — assignments', () => {
  it('addAssignment creates an assignment', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const child = sys.addChild(makeChild());
      const assignment = sys.addAssignment(child.id, {
        subject: 'Maths',
        title: 'Fractions',
        dueDate: '2025-12-31',
        difficultyRating: 3
      });
      assert(assignment !== null, 'assignment should not be null');
      assertEqual(assignment.subject, 'Maths');
      assertEqual(assignment.status, 'pending');
    } finally { cleanup(sys); }
  });

  it('addAssignment returns null for invalid subject', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const child = sys.addChild(makeChild());
      const result = sys.addAssignment(child.id, {
        subject: 'Alchemy',
        title: 'Turn lead to gold'
      });
      assertEqual(result, null);
    } finally { cleanup(sys); }
  });

  it('updateAssignmentStatus sets status to completed', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const child = sys.addChild(makeChild());
      const assignment = sys.addAssignment(child.id, {
        subject: 'Science',
        title: 'Experiment'
      });
      const updated = sys.updateAssignmentStatus(child.id, assignment.id, 'completed');
      assert(updated !== null, 'should return updated assignment');
      assertEqual(updated.status, 'completed');
    } finally { cleanup(sys); }
  });

  it('getAssignments returns filtered list', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const child = sys.addChild(makeChild());
      sys.addAssignment(child.id, { subject: 'Maths', title: 'A' });
      sys.addAssignment(child.id, { subject: 'Science', title: 'B' });
      const maths = sys.getAssignments(child.id, { subject: 'Maths' });
      assertEqual(maths.length, 1);
      assertEqual(maths[0].subject, 'Maths');
    } finally { cleanup(sys); }
  });
});

/* ══════════════════════════════════════════════════════════════════════ */
/*  Badges                                                              */
/* ══════════════════════════════════════════════════════════════════════ */
describe('HomeChildEducationSystem — badges', () => {
  it('awardBadge grants a badge', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const child = sys.addChild(makeChild());
      const result = sys.awardBadge(child.id, 'reader');
      assert(result !== null, 'result should not be null');
      assertEqual(result.id, 'reader');
    } finally { cleanup(sys); }
  });

  it('awardBadge returns alreadyEarned for duplicates', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const child = sys.addChild(makeChild());
      sys.awardBadge(child.id, 'reader');
      const second = sys.awardBadge(child.id, 'reader');
      assertEqual(second.alreadyEarned, true);
    } finally { cleanup(sys); }
  });

  it('getBadges returns all badges for child', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const child = sys.addChild(makeChild());
      sys.awardBadge(child.id, 'reader');
      sys.awardBadge(child.id, 'scientist');
      const badges = sys.getBadges(child.id);
      assertEqual(badges.length, 2);
    } finally { cleanup(sys); }
  });
});

/* ══════════════════════════════════════════════════════════════════════ */
/*  Streaks                                                             */
/* ══════════════════════════════════════════════════════════════════════ */
describe('HomeChildEducationSystem — streaks', () => {
  it('updateStreak sets streak to 1 on first update', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const child = sys.addChild(makeChild());
      const result = sys.updateStreak(child.id, 'learning');
      assertType(result, 'number');
      assert(result >= 1, 'streak should be at least 1');
    } finally { cleanup(sys); }
  });
});

/* ══════════════════════════════════════════════════════════════════════ */
/*  Learning Activities                                                 */
/* ══════════════════════════════════════════════════════════════════════ */
describe('HomeChildEducationSystem — learning activities', () => {
  it('getLearningActivities returns age-appropriate activities', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const child = sys.addChild(makeChild({ age: 10 }));
      const activities = sys.getLearningActivities(child.id);
      assert(activities !== null, 'activities should not be null');
      assert(Array.isArray(activities), 'should be array');
      assert(activities.length > 0, 'should have activities');
    } finally { cleanup(sys); }
  });

  it('getDailyLearningChallenge returns a challenge', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const child = sys.addChild(makeChild());
      const challenge = sys.getDailyLearningChallenge(child.id);
      assert(challenge !== null, 'challenge should not be null');
    } finally { cleanup(sys); }
  });
});

/* ══════════════════════════════════════════════════════════════════════ */
/*  Learning Blocks (Pomodoro)                                          */
/* ══════════════════════════════════════════════════════════════════════ */
describe('HomeChildEducationSystem — learning blocks', () => {
  it('scheduleLearningBlock returns pomodoro-based schedule', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const child = sys.addChild(makeChild());
      sys.addAssignment(child.id, { subject: 'Mathematics', title: 'Fractions' });
      const schedule = sys.scheduleLearningBlock(child.id, {});
      assert(schedule !== null, 'schedule should not be null');
      assert(Array.isArray(schedule.blocks), 'blocks should be array');
      assert(schedule.blocks.length > 0, 'should have at least one block');
    } finally { cleanup(sys); }
  });
});

/* ══════════════════════════════════════════════════════════════════════ */
/*  Reading                                                             */
/* ══════════════════════════════════════════════════════════════════════ */
describe('HomeChildEducationSystem — reading', () => {
  it('logReading creates a reading entry', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const child = sys.addChild(makeChild());
      const entry = sys.logReading(child.id, {
        bookTitle: 'Pippi Långstrump',
        author: 'Astrid Lindgren',
        minutesRead: 30,
        language: 'Swedish'
      });
      assert(entry !== null, 'entry should not be null');
      assertEqual(entry.bookTitle, 'Pippi Långstrump');
    } finally { cleanup(sys); }
  });

  it('getReadingStats returns stats object', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const child = sys.addChild(makeChild());
      sys.logReading(child.id, { bookTitle: 'Book 1', minutesRead: 20, language: 'Swedish', completed: true });
      const stats = sys.getReadingStats(child.id);
      assert(stats !== null, 'stats should not be null');
      assertEqual(stats.totalBooksRead, 1);
      assertType(stats.readingLevel, 'number');
    } finally { cleanup(sys); }
  });

  it('addLibraryBook adds book with due date', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const child = sys.addChild(makeChild());
      const book = sys.addLibraryBook(child.id, {
        title: 'The BFG',
        author: 'Roald Dahl'
      });
      assert(book !== null, 'book should not be null');
      assertEqual(book.title, 'The BFG');
      assertType(book.dueDate, 'string');
    } finally { cleanup(sys); }
  });

  it('getBedtimeReadingRoutine returns null for unknown child', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      assertEqual(sys.getBedtimeReadingRoutine('nonexistent'), null);
    } finally { cleanup(sys); }
  });

  it('getBedtimeReadingRoutine returns routine for child', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const child = sys.addChild(makeChild({ age: 10 }));
      const routine = sys.getBedtimeReadingRoutine(child.id);
      assert(routine !== null, 'routine should not be null');
      assertEqual(routine.lighting, 'warm');
      assertEqual(routine.lightTemperature, 2700);
      assertType(routine.durationMinutes, 'number');
      assert(Array.isArray(routine.suggestedBooks), 'suggestedBooks should be array');
    } finally { cleanup(sys); }
  });
});

/* ══════════════════════════════════════════════════════════════════════ */
/*  Music Practice                                                      */
/* ══════════════════════════════════════════════════════════════════════ */
describe('HomeChildEducationSystem — music practice', () => {
  it('logMusicPractice returns null for unsupported instrument', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const child = sys.addChild(makeChild());
      const result = sys.logMusicPractice(child.id, {
        instrument: 'theremin',
        durationMinutes: 30
      });
      assertEqual(result, null);
    } finally { cleanup(sys); }
  });

  it('logMusicPractice creates entry for supported instrument', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const child = sys.addChild(makeChild());
      const entry = sys.logMusicPractice(child.id, {
        instrument: 'piano',
        durationMinutes: 30,
        quality: 'excellent'
      });
      assert(entry !== null, 'entry should not be null');
      assertEqual(entry.instrument, 'piano');
      assertEqual(entry.durationMinutes, 30);
    } finally { cleanup(sys); }
  });

  it('getMusicPracticeStats returns stats', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const child = sys.addChild(makeChild());
      sys.logMusicPractice(child.id, { instrument: 'piano', durationMinutes: 20 });
      const stats = sys.getMusicPracticeStats(child.id);
      assert(stats !== null, 'stats should not be null');
      assertEqual(stats.todayMinutes, 20);
      assertEqual(stats.totalSessions, 1);
    } finally { cleanup(sys); }
  });

  it('getMusicPracticeStats returns null for unknown child', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      assertEqual(sys.getMusicPracticeStats('nonexistent'), null);
    } finally { cleanup(sys); }
  });

  it('getMusicPracticeEnvironment returns environment settings', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const env = sys.getMusicPracticeEnvironment();
      assertEqual(env.lighting.brightness, 80);
      assertEqual(env.soundproofing.active, true);
      assertEqual(env.metronome.available, true);
    } finally { cleanup(sys); }
  });
});

/* ══════════════════════════════════════════════════════════════════════ */
/*  Language Learning                                                   */
/* ══════════════════════════════════════════════════════════════════════ */
describe('HomeChildEducationSystem — language learning', () => {
  it('getDailyVocabulary returns word for child', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const child = sys.addChild(makeChild());
      const vocab = sys.getDailyVocabulary(child.id);
      assert(vocab !== null, 'vocab should not be null');
      assertEqual(vocab.childName, 'Emma');
      assert(vocab.word.swedish, 'word should have swedish field');
      assert(vocab.word.english, 'word should have english field');
    } finally { cleanup(sys); }
  });

  it('getDailyVocabulary returns null for unknown child', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      assertEqual(sys.getDailyVocabulary('nonexistent'), null);
    } finally { cleanup(sys); }
  });

  it('getPhraseOfTheDay returns phrase for child', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const child = sys.addChild(makeChild());
      const phrase = sys.getPhraseOfTheDay(child.id);
      assert(phrase !== null, 'phrase should not be null');
      assert(phrase.phrase.swedish, 'should have swedish phrase');
      assert(phrase.phrase.english, 'should have english phrase');
      assertType(phrase.conversationPractice, 'string');
    } finally { cleanup(sys); }
  });

  it('getLanguageProgress returns null for unknown child', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      assertEqual(sys.getLanguageProgress('nonexistent'), null);
    } finally { cleanup(sys); }
  });

  it('getLanguageProgress returns progress for child', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const child = sys.addChild(makeChild());
      const progress = sys.getLanguageProgress(child.id);
      assert(progress !== null, 'progress should not be null');
      assertEqual(progress.childName, 'Emma');
      assertEqual(progress.level, 1);
      assertEqual(progress.bilingualSupport, true);
    } finally { cleanup(sys); }
  });
});

/* ══════════════════════════════════════════════════════════════════════ */
/*  Science Experiments                                                 */
/* ══════════════════════════════════════════════════════════════════════ */
describe('HomeChildEducationSystem — science experiments', () => {
  it('getScienceExperimentSuggestion returns suggestion for child', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const child = sys.addChild(makeChild({ age: 10 }));
      const suggestion = sys.getScienceExperimentSuggestion(child.id);
      assert(suggestion !== null, 'suggestion should not be null');
      assertEqual(suggestion.childName, 'Emma');
      assert(suggestion.experiment, 'should have experiment');
    } finally { cleanup(sys); }
  });

  it('logExperiment returns null for unknown child', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      assertEqual(sys.logExperiment('nonexistent', { name: 'Test' }), null);
    } finally { cleanup(sys); }
  });

  it('logExperiment logs experiment and updates STEM skills', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const child = sys.addChild(makeChild());
      const entry = sys.logExperiment(child.id, {
        name: 'Volcano',
        category: 'science',
        hypothesis: 'It will erupt',
        result: 'It erupted'
      });
      assert(entry !== null, 'entry should not be null');
      assertEqual(entry.name, 'Volcano');
      const skills = sys.stemSkillLevels.get(child.id);
      assertEqual(skills.science, 1.5); // +0.5 from base 1
    } finally { cleanup(sys); }
  });

  it('scientist badge awarded at 10 experiments', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const child = sys.addChild(makeChild());
      for (let i = 0; i < 10; i++) {
        sys.logExperiment(child.id, { name: `Exp${i}`, category: 'science' });
      }
      const badges = sys.getBadges(child.id);
      const hasScienceBadge = badges.some(b => b.id === 'scientist');
      assert(hasScienceBadge, 'should have scientist badge');
    } finally { cleanup(sys); }
  });
});

/* ══════════════════════════════════════════════════════════════════════ */
/*  Art Projects                                                        */
/* ══════════════════════════════════════════════════════════════════════ */
describe('HomeChildEducationSystem — art projects', () => {
  it('getArtProjectSuggestion returns null for unknown child', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      assertEqual(sys.getArtProjectSuggestion('nonexistent'), null);
    } finally { cleanup(sys); }
  });

  it('logArtProject creates a project entry', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const child = sys.addChild(makeChild());
      const project = sys.logArtProject(child.id, {
        name: 'Watercolor sunset',
        durationMinutes: 45
      });
      assert(project !== null, 'project should not be null');
      assertEqual(project.name, 'Watercolor sunset');
    } finally { cleanup(sys); }
  });

  it('artist badge awarded at 15 projects', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const child = sys.addChild(makeChild());
      for (let i = 0; i < 15; i++) {
        sys.logArtProject(child.id, { name: `Art${i}` });
      }
      const badges = sys.getBadges(child.id);
      const hasArtBadge = badges.some(b => b.id === 'artist');
      assert(hasArtBadge, 'should have artist badge');
    } finally { cleanup(sys); }
  });

  it('logArtProject with photo adds to gallery', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const child = sys.addChild(makeChild());
      sys.logArtProject(child.id, { name: 'Painting', photo: 'photo.jpg' });
      const gallery = sys.projectGallery.get(child.id);
      assertEqual(gallery.length, 1);
      assertEqual(gallery[0].photo, 'photo.jpg');
    } finally { cleanup(sys); }
  });

  it('updateCraftInventory sets inventory', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const result = sys.updateCraftInventory(['paint', 'brushes', 'paper']);
      assertEqual(result.length, 3);
      assertEqual(sys.craftMaterialsInventory.length, 3);
    } finally { cleanup(sys); }
  });
});

/* ══════════════════════════════════════════════════════════════════════ */
/*  Physical Activity                                                   */
/* ══════════════════════════════════════════════════════════════════════ */
describe('HomeChildEducationSystem — physical activity', () => {
  it('logPhysicalActivity returns null for unknown child', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      assertEqual(sys.logPhysicalActivity('nonexistent', { activity: 'Running' }), null);
    } finally { cleanup(sys); }
  });

  it('logPhysicalActivity logs activity and returns result', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const child = sys.addChild(makeChild());
      const result = sys.logPhysicalActivity(child.id, {
        activity: 'Cycling',
        durationMinutes: 45,
        intensity: 'moderate'
      });
      assert(result !== null, 'result should not be null');
      assertEqual(result.entry.activity, 'Cycling');
      assertEqual(result.entry.durationMinutes, 45);
      assertType(result.todayTotal, 'number');
    } finally { cleanup(sys); }
  });

  it('getActivitySuggestions returns empty array for unknown child', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const result = sys.getActivitySuggestions('nonexistent');
      assert(Array.isArray(result), 'should be array');
      assertEqual(result.length, 0);
    } finally { cleanup(sys); }
  });

  it('getActivitySuggestions returns suggestions with weather support', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const child = sys.addChild(makeChild());
      const goodWeather = sys.getActivitySuggestions(child.id, { temperature: 20, raining: false });
      assert(goodWeather.outdoor.length > 0, 'should suggest outdoor activities');

      const badWeather = sys.getActivitySuggestions(child.id, { temperature: 20, raining: true });
      assertEqual(badWeather.outdoor.length, 0);
    } finally { cleanup(sys); }
  });
});

/* ══════════════════════════════════════════════════════════════════════ */
/*  Social Development                                                  */
/* ══════════════════════════════════════════════════════════════════════ */
describe('HomeChildEducationSystem — social development', () => {
  it('schedulePlaydate creates playdate entry', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const child = sys.addChild(makeChild());
      const play = sys.schedulePlaydate(child.id, {
        friendName: 'Alex',
        date: '2025-06-15'
      });
      assert(play !== null, 'playdate should not be null');
      assertEqual(play.friendName, 'Alex');
      assertEqual(play.duration, 120); // default
    } finally { cleanup(sys); }
  });

  it('getSocialSkillsActivity returns null for unknown child', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      assertEqual(sys.getSocialSkillsActivity('nonexistent'), null);
    } finally { cleanup(sys); }
  });

  it('planBirthday creates a birthday plan', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const child = sys.addChild(makeChild());
      const plan = sys.planBirthday(child.id, {
        date: '2025-08-15',
        theme: 'Space adventure',
        guests: ['Alex', 'Sam']
      });
      assert(plan !== null, 'plan should not be null');
      assertEqual(plan.theme, 'Space adventure');
      assertEqual(plan.guestCount, 2);
    } finally { cleanup(sys); }
  });
});

/* ══════════════════════════════════════════════════════════════════════ */
/*  Chores                                                              */
/* ══════════════════════════════════════════════════════════════════════ */
describe('HomeChildEducationSystem — chores', () => {
  it('getAvailableChores returns empty for unknown child', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const result = sys.getAvailableChores('nonexistent');
      assert(Array.isArray(result), 'should be array');
      assertEqual(result.length, 0);
    } finally { cleanup(sys); }
  });

  it('getAvailableChores filters by age', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const young = sys.addChild(makeChild({ name: 'Young', age: 6 }));
      const old = sys.addChild(makeChild({ name: 'Old', age: 15 }));
      const youngChores = sys.getAvailableChores(young.id);
      const oldChores = sys.getAvailableChores(old.id);
      assert(oldChores.length >= youngChores.length, 'older child should have more or equal chores');
    } finally { cleanup(sys); }
  });

  it('completeChore awards points and returns bonusScreenTime', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const child = sys.addChild(makeChild({ age: 10 }));
      const chores = sys.getAvailableChores(child.id);
      assert(chores.length > 0, 'should have available chores');
      const chore = chores[0];
      const result = sys.completeChore(child.id, chore.id);
      assert(result !== null, 'result should not be null');
      assertType(result.totalPoints, 'number');
      assertType(result.bonusScreenTime, 'number');
      assertEqual(result.bonusScreenTime, Math.floor(chore.points / 10) * 5);
    } finally { cleanup(sys); }
  });

  it('completeChore returns null for unknown chore', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const child = sys.addChild(makeChild());
      assertEqual(sys.completeChore(child.id, 'nonexistent_chore'), null);
    } finally { cleanup(sys); }
  });

  it('redeemChorePoints for screen_time adds bonus', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const child = sys.addChild(makeChild({ age: 10 }));
      // Add points by completing chores
      const chores = sys.getAvailableChores(child.id);
      for (let i = 0; i < 5; i++) {
        sys.completeChore(child.id, chores[0].id);
      }
      const points = sys.chorePoints.get(child.id);
      assert(points > 0, 'should have points');

      const result = sys.redeemChorePoints(child.id, 'screen_time', 10);
      assert(result.success, 'redemption should succeed');
      assertEqual(result.reward.type, 'screen_time');
    } finally { cleanup(sys); }
  });

  it('redeemChorePoints fails with insufficient points', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const child = sys.addChild(makeChild());
      const result = sys.redeemChorePoints(child.id, 'screen_time', 100);
      assertEqual(result.success, false);
      assertEqual(result.reason, 'Insufficient points');
    } finally { cleanup(sys); }
  });

  it('redeemChorePoints for allowance returns SEK', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const child = sys.addChild(makeChild({ age: 10 }));
      const chores = sys.getAvailableChores(child.id);
      for (let i = 0; i < 10; i++) {
        sys.completeChore(child.id, chores[0].id);
      }
      const points = sys.chorePoints.get(child.id);
      const result = sys.redeemChorePoints(child.id, 'allowance', Math.min(points, 50));
      assert(result.success, 'should succeed');
      assertEqual(result.reward.type, 'allowance');
      assertEqual(result.reward.currency, 'SEK');
    } finally { cleanup(sys); }
  });
});

/* ══════════════════════════════════════════════════════════════════════ */
/*  Bedtime Routine                                                     */
/* ══════════════════════════════════════════════════════════════════════ */
describe('HomeChildEducationSystem — bedtime', () => {
  it('getBedtimeRoutine returns null for unknown child', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      assertEqual(sys.getBedtimeRoutine('nonexistent'), null);
    } finally { cleanup(sys); }
  });

  it('getBedtimeRoutine returns routine with steps', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const child = sys.addChild(makeChild({ age: 10 }));
      const routine = sys.getBedtimeRoutine(child.id);
      assert(routine !== null, 'routine should not be null');
      assertEqual(routine.childName, 'Emma');
      assert(Array.isArray(routine.routine), 'routine steps should be array');
      assert(routine.routine.length >= 4, 'should have at least 4 steps');
      assertType(routine.screenCutoff, 'string');
      assertType(routine.bedtime, 'string');
    } finally { cleanup(sys); }
  });
});

/* ══════════════════════════════════════════════════════════════════════ */
/*  Vacation Mode                                                       */
/* ══════════════════════════════════════════════════════════════════════ */
describe('HomeChildEducationSystem — vacation mode', () => {
  it('setVacationMode enables with custom multiplier', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const result = sys.setVacationMode(true, { screenMultiplier: 2.0 });
      assertEqual(result.vacationMode, true);
      assertEqual(result.screenMultiplier, 2.0);
      assertEqual(sys.vacationMode, true);
    } finally { cleanup(sys); }
  });

  it('setVacationMode disables and resets multiplier to 1.0', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      sys.setVacationMode(true, { screenMultiplier: 2.0 });
      const result = sys.setVacationMode(false);
      assertEqual(result.vacationMode, false);
      assertEqual(result.screenMultiplier, 1.0);
    } finally { cleanup(sys); }
  });

  it('getHolidayActivities returns null for unknown child', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      assertEqual(sys.getHolidayActivities('nonexistent'), null);
    } finally { cleanup(sys); }
  });

  it('getHolidayActivities returns activities by type', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const child = sys.addChild(makeChild());
      const result = sys.getHolidayActivities(child.id, 'educational_trip');
      assert(result !== null, 'result should not be null');
      assert(Array.isArray(result.activities), 'activities should be array');
      assert(result.activities.length > 0, 'should have activities');
    } finally { cleanup(sys); }
  });
});

/* ══════════════════════════════════════════════════════════════════════ */
/*  Parental Controls                                                   */
/* ══════════════════════════════════════════════════════════════════════ */
describe('HomeChildEducationSystem — parental controls', () => {
  it('setupParentalPIN returns false for short PIN', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      assertEqual(sys.setupParentalPIN('12'), false);
      assertEqual(sys.setupParentalPIN(1234), false); // not a string
    } finally { cleanup(sys); }
  });

  it('setupParentalPIN returns true for valid PIN', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      assertEqual(sys.setupParentalPIN('1234'), true);
      assertEqual(sys.parentalPIN, '1234');
    } finally { cleanup(sys); }
  });

  it('verifyPIN returns true when no PIN set', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      assertEqual(sys.verifyPIN('anything'), true);
    } finally { cleanup(sys); }
  });

  it('verifyPIN validates against set PIN', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      sys.setupParentalPIN('5678');
      assertEqual(sys.verifyPIN('5678'), true);
      assertEqual(sys.verifyPIN('wrong'), false);
    } finally { cleanup(sys); }
  });

  it('setParentPermissions filters valid permissions', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const result = sys.setParentPermissions('parent1', [
        'manage_children', 'view_reports', 'invalid_perm'
      ]);
      assertEqual(result.permissions.length, 2);
      assert(result.permissions.includes('manage_children'), 'should include manage_children');
      assert(!result.permissions.includes('invalid_perm'), 'should not include invalid');
    } finally { cleanup(sys); }
  });

  it('submitApprovalRequest adds to queue', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const req = sys.submitApprovalRequest('extra_screen_time', { minutes: 30 });
      assert(req.id.startsWith('approval_'), 'id should start with approval_');
      assertEqual(req.status, 'pending');
      assertEqual(sys.getPendingApprovals().length, 1);
    } finally { cleanup(sys); }
  });

  it('resolveApprovalRequest fails with invalid PIN', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      sys.setupParentalPIN('1234');
      const req = sys.submitApprovalRequest('test', {});
      const result = sys.resolveApprovalRequest(req.id, true, 'parent1', 'wrong');
      assertEqual(result.success, false);
      assertEqual(result.reason, 'invalid_pin');
    } finally { cleanup(sys); }
  });

  it('resolveApprovalRequest approves with correct PIN', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      sys.setupParentalPIN('1234');
      const req = sys.submitApprovalRequest('test', {});
      const result = sys.resolveApprovalRequest(req.id, true, 'parent1', '1234');
      assertEqual(result.success, true);
      assertEqual(result.request.status, 'approved');
      assertEqual(sys.getPendingApprovals().length, 0);
    } finally { cleanup(sys); }
  });

  it('activateEmergencyOverride fails with wrong PIN', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      sys.setupParentalPIN('1234');
      assertEqual(sys.activateEmergencyOverride('wrong'), false);
      assertEqual(sys.emergencyOverrideActive, false);
    } finally { cleanup(sys); }
  });

  it('activateEmergencyOverride succeeds with correct PIN', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      sys.setupParentalPIN('1234');
      assertEqual(sys.activateEmergencyOverride('1234'), true);
      assertEqual(sys.emergencyOverrideActive, true);
    } finally { cleanup(sys); }
  });

  it('deactivateEmergencyOverride restores restrictions', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      sys.setupParentalPIN('1234');
      sys.activateEmergencyOverride('1234');
      assertEqual(sys.deactivateEmergencyOverride('1234'), true);
      assertEqual(sys.emergencyOverrideActive, false);
    } finally { cleanup(sys); }
  });
});

/* ══════════════════════════════════════════════════════════════════════ */
/*  Weekly Report                                                       */
/* ══════════════════════════════════════════════════════════════════════ */
describe('HomeChildEducationSystem — reporting', () => {
  it('generateWeeklyReport returns null for unknown child', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      assertEqual(sys.generateWeeklyReport('nonexistent'), null);
    } finally { cleanup(sys); }
  });

  it('generateWeeklyReport returns comprehensive report', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      const child = sys.addChild(makeChild());
      sys.addAssignment(child.id, { subject: 'Mathematics', title: 'Test' });
      const report = sys.generateWeeklyReport(child.id);
      assert(report !== null, 'report should not be null');
      assertEqual(report.childName, 'Emma');
      assertType(report.homework, 'object');
      assertType(report.screenTime, 'object');
      assertType(report.achievements, 'object');
      assertType(report.chores, 'object');
      assert(Array.isArray(report.areasNeedingAttention), 'areas should be array');
    } finally { cleanup(sys); }
  });
});

/* ══════════════════════════════════════════════════════════════════════ */
/*  Statistics                                                          */
/* ══════════════════════════════════════════════════════════════════════ */
describe('HomeChildEducationSystem — statistics', () => {
  it('getStatistics returns comprehensive system stats', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      sys.addChild(makeChild());
      const stats = sys.getStatistics();
      assertEqual(stats.system, 'HomeChildEducationSystem');
      assertEqual(stats.initialized, false);
      assertEqual(stats.vacationMode, false);
      assertEqual(stats.summary.childCount, 1);
      assertType(stats.summary.totalAssignments, 'number');
      assertType(stats.summary.totalBooksRead, 'number');
      assert(Array.isArray(stats.badgeTypes), 'badgeTypes should be array');
      assert(Array.isArray(stats.supportedSubjects), 'subjects should be array');
    } finally { cleanup(sys); }
  });
});

/* ══════════════════════════════════════════════════════════════════════ */
/*  Destroy                                                             */
/* ══════════════════════════════════════════════════════════════════════ */
describe('HomeChildEducationSystem — destroy', () => {
  it('clears all data and sets initialized to false', () => {
    const sys = new HomeChildEducationSystem(createMockHomey());
    try {
      sys.addChild(makeChild());
      assertEqual(sys.children.size, 1);
      sys.destroy();
      assertEqual(sys.children.size, 0);
      assertEqual(sys.initialized, false);
      assertEqual(sys.approvalQueue.length, 0);
    } finally { cleanup(sys); }
  });
});

run();
