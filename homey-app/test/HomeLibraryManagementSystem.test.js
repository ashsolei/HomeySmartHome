'use strict';

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertType } = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');

/* ── timer-leak prevention ─────────────────────────────────────────── */
const _origSetTimeout = global.setTimeout;
const _origSetInterval = global.setInterval;
const activeHandles = [];
global.setTimeout = (...a) => { const id = _origSetTimeout(...a); activeHandles.push({ type: 'timeout', id }); return id; };
global.setInterval = (...a) => { const id = _origSetInterval(...a); activeHandles.push({ type: 'interval', id }); return id; };
function cleanup(sys) {
  try { if (sys && typeof sys.destroy === 'function') sys.destroy(); } catch (_) {}
  while (activeHandles.length > 0) {
    const h = activeHandles.pop();
    if (h.type === 'timeout') clearTimeout(h.id); else clearInterval(h.id);
  }
}

const HomeLibraryManagementSystem = require('../lib/HomeLibraryManagementSystem');

/* ================================================================== */
/*  HomeLibraryManagementSystem – test suite                          */
/* ================================================================== */

describe('HomeLibraryManagementSystem — constructor & init', () => {
  it('instantiates without errors', () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    assert(sys, 'should create instance');
    cleanup(sys);
  });

  it('starts uninitialised with empty collections', () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    assertEqual(sys.initialized, false);
    assertEqual(sys.books.length, 0);
    assertEqual(sys.readingSessions.length, 0);
    assertEqual(sys.activeSession, null);
    cleanup(sys);
  });

  it('initialize sets initialized flag and loads sample books', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.initialized, true);
    assert(sys.books.length > 0, 'should have sample books');
    cleanup(sys);
  });

  it('destroy clears intervals and resets state', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    sys.destroy();
    assertEqual(sys.initialized, false);
    assertEqual(sys.intervals.length, 0);
    assertEqual(sys.activeSession, null);
    cleanup(sys);
  });
});

describe('HomeLibraryManagementSystem — book management', () => {
  it('addBook creates a book with defaults', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    const book = sys.addBook({ title: 'Test Book', author: 'Test Author' });
    assert(book, 'should return book');
    assertEqual(book.title, 'Test Book');
    assertEqual(book.author, 'Test Author');
    assertEqual(book.readStatus, 'to-read');
    cleanup(sys);
  });

  it('addBook returns null without title or author', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    const r1 = sys.addBook({ title: 'No Author' });
    assertEqual(r1, null);
    const r2 = sys.addBook({ author: 'No Title' });
    assertEqual(r2, null);
    cleanup(sys);
  });

  it('removeBook removes existing book', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    const book = sys.addBook({ title: 'Remove Me', author: 'Author' });
    const countBefore = sys.books.length;
    const result = sys.removeBook(book.id);
    assertEqual(result, true);
    assertEqual(sys.books.length, countBefore - 1);
    cleanup(sys);
  });

  it('removeBook returns false for non-existent ID', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.removeBook(99999), false);
    cleanup(sys);
  });

  it('updateBook modifies allowed fields', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    const book = sys.addBook({ title: 'Original', author: 'Author', genre: 'fiction' });
    const updated = sys.updateBook(book.id, { title: 'Updated Title', genre: 'mystery' });
    assertEqual(updated.title, 'Updated Title');
    assertEqual(updated.genre, 'mystery');
    cleanup(sys);
  });

  it('updateBook returns null for non-existent ID', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.updateBook(99999, { title: 'X' }), null);
    cleanup(sys);
  });

  it('rateBook sets rating between 1-5', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    const book = sys.addBook({ title: 'Rate Me', author: 'Author' });
    assertEqual(sys.rateBook(book.id, 4), true);
    assertEqual(sys.books.find(b => b.id === book.id).rating, 4);
    cleanup(sys);
  });

  it('rateBook rejects invalid rating', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.rateBook(1, 0), false);
    assertEqual(sys.rateBook(1, 6), false);
    cleanup(sys);
  });
});

describe('HomeLibraryManagementSystem — search', () => {
  it('searchBooks finds by title', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    const results = sys.searchBooks('Pippi');
    assert(results.length > 0, 'should find Pippi');
    cleanup(sys);
  });

  it('searchBooks returns empty for empty query', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.searchBooks('').length, 0);
    assertEqual(sys.searchBooks(null).length, 0);
    cleanup(sys);
  });

  it('searchByGenre filters by genre', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    const thrillers = sys.searchByGenre('thriller');
    assert(thrillers.length > 0, 'should find thrillers');
    assert(thrillers.every(b => b.genre === 'thriller'), 'all should be thrillers');
    cleanup(sys);
  });

  it('searchByAuthor finds by author name', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    const books = sys.searchByAuthor('Lindgren');
    assert(books.length >= 3, 'should find Lindgren books');
    cleanup(sys);
  });

  it('searchByISBN returns book or null', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    const found = sys.searchByISBN('978-91-29-68814-0');
    assert(found, 'should find book by ISBN');
    assertEqual(sys.searchByISBN('000-0-00-000000-0'), null);
    cleanup(sys);
  });

  it('searchByShelf returns books on shelf', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    const children = sys.searchByShelf('children');
    assert(children.length > 0, 'should find books on children shelf');
    cleanup(sys);
  });

  it('lookupISBN finds local and returns not-found', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    const local = sys.lookupISBN('978-91-29-68814-0');
    assertEqual(local.found, true);
    assertEqual(local.source, 'local');
    const notFound = sys.lookupISBN('999-0-00-000000-0');
    assertEqual(notFound.found, false);
    cleanup(sys);
  });
});

describe('HomeLibraryManagementSystem — reading sessions', () => {
  it('startReadingSession begins a session', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    const bookId = sys.books[0].id;
    const session = sys.startReadingSession(bookId);
    assert(session, 'should return session');
    assert(session.startTime, 'should have startTime');
    assertEqual(session.bookId, bookId);
    cleanup(sys);
  });

  it('startReadingSession blocks double start', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    sys.startReadingSession(sys.books[0].id);
    const second = sys.startReadingSession(sys.books[1].id);
    assertEqual(second, null);
    cleanup(sys);
  });

  it('endReadingSession records session', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    sys.startReadingSession(sys.books[0].id);
    const session = sys.endReadingSession(30, 'good reading');
    assert(session, 'should return ended session');
    assertEqual(session.pagesRead, 30);
    assert(sys.readingSessions.length > 0, 'should store session');
    assertEqual(sys.activeSession, null);
    cleanup(sys);
  });

  it('endReadingSession returns null if no active session', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.endReadingSession(10), null);
    cleanup(sys);
  });

  it('startReadingSession changes to-read status to reading', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    const toRead = sys.books.find(b => b.readStatus === 'to-read');
    if (toRead) {
      sys.startReadingSession(toRead.id);
      assertEqual(toRead.readStatus, 'reading');
    }
    cleanup(sys);
  });
});

describe('HomeLibraryManagementSystem — audiobooks', () => {
  it('logAudiobookListening logs for audiobook format', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    const audiobook = sys.books.find(b => b.format === 'audiobook');
    assert(audiobook, 'should have audiobook in samples');
    const result = sys.logAudiobookListening(audiobook.id, 30);
    assertEqual(result, true);
    cleanup(sys);
  });

  it('logAudiobookListening rejects non-audiobook', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    const physical = sys.books.find(b => b.format === 'physical');
    assertEqual(sys.logAudiobookListening(physical.id, 30), false);
    cleanup(sys);
  });

  it('getAudiobookStats returns correct data', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    const stats = sys.getAudiobookStats();
    assert(stats.count >= 0, 'should have count');
    assertType(stats.totalDurationMinutes, 'number');
    assertType(stats.totalDurationHours, 'number');
    assert(Array.isArray(stats.titles), 'titles should be array');
    cleanup(sys);
  });

  it('getFormatBreakdown returns counts and percentages', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    const breakdown = sys.getFormatBreakdown();
    assertType(breakdown.counts.physical, 'number');
    assertType(breakdown.counts.ebook, 'number');
    assertType(breakdown.counts.audiobook, 'number');
    assertType(breakdown.percentages.physical, 'number');
    cleanup(sys);
  });
});

describe('HomeLibraryManagementSystem — lending', () => {
  it('lendBook creates a lending record', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    const physical = sys.books.find(b => b.format === 'physical' && !b.lentTo);
    const lending = sys.lendBook(physical.id, 'Erik', 14);
    assert(lending, 'should return lending');
    assertEqual(lending.borrower, 'Erik');
    assertEqual(physical.lentTo, 'Erik');
    cleanup(sys);
  });

  it('lendBook blocks already-lent book', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    const physical = sys.books.find(b => b.format === 'physical' && !b.lentTo);
    sys.lendBook(physical.id, 'Erik', 14);
    assertEqual(sys.lendBook(physical.id, 'Anna', 14), null);
    cleanup(sys);
  });

  it('lendBook blocks non-physical book', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    const ebook = sys.books.find(b => b.format === 'ebook');
    assertEqual(sys.lendBook(ebook.id, 'Erik', 14), null);
    cleanup(sys);
  });

  it('returnBook completes lending', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    const physical = sys.books.find(b => b.format === 'physical' && !b.lentTo);
    sys.lendBook(physical.id, 'Erik', 14);
    const result = sys.returnBook(physical.id);
    assertEqual(result, true);
    assertEqual(physical.lentTo, null);
    cleanup(sys);
  });

  it('returnBook fails if not lent', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    const physical = sys.books.find(b => b.format === 'physical' && !b.lentTo);
    assertEqual(sys.returnBook(physical.id), false);
    cleanup(sys);
  });

  it('getActiveLendings returns only active', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    const physical = sys.books.find(b => b.format === 'physical' && !b.lentTo);
    sys.lendBook(physical.id, 'Erik', 14);
    const active = sys.getActiveLendings();
    assert(active.length >= 1, 'should have active lending');
    assert(active.every(l => l.status === 'active'), 'all should be active');
    cleanup(sys);
  });
});

describe('HomeLibraryManagementSystem — shelves', () => {
  it('getShelfStatus returns all shelves with utilization', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    const status = sys.getShelfStatus();
    assert(status.fiction, 'should have fiction shelf');
    assertType(status.fiction.utilization, 'number');
    assertType(status.fiction.available, 'number');
    cleanup(sys);
  });

  it('getShelfUtilization returns aggregate numbers', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    const util = sys.getShelfUtilization();
    assertType(util.totalCapacity, 'number');
    assertType(util.totalUsed, 'number');
    assertType(util.overallUtilization, 'number');
    assert(util.totalCapacity > 0, 'capacity should be positive');
    cleanup(sys);
  });

  it('moveBookToShelf moves book between shelves', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    const book = sys.books.find(b => b.shelf === 'fiction');
    const result = sys.moveBookToShelf(book.id, 'bedside');
    assertEqual(result, true);
    assertEqual(book.shelf, 'bedside');
    cleanup(sys);
  });

  it('moveBookToShelf fails for non-existent shelf', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.moveBookToShelf(sys.books[0].id, 'nonexistent'), false);
    cleanup(sys);
  });
});

describe('HomeLibraryManagementSystem — condition & value', () => {
  it('getConditionReport returns summary', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    const report = sys.getConditionReport();
    assertType(report.summary.excellent, 'number');
    assertType(report.summary.good, 'number');
    assert(Array.isArray(report.poorConditionBooks), 'should have poorConditionBooks');
    cleanup(sys);
  });

  it('updateBookCondition sets valid condition', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    const book = sys.books[0];
    assertEqual(sys.updateBookCondition(book.id, 'fair'), true);
    assertEqual(book.condition, 'fair');
    cleanup(sys);
  });

  it('updateBookCondition rejects invalid condition', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.updateBookCondition(sys.books[0].id, 'destroyed'), false);
    cleanup(sys);
  });

  it('estimateCollectionValue returns value info', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    const value = sys.estimateCollectionValue();
    assertType(value.totalValueSEK, 'number');
    assert(value.totalValueSEK > 0, 'total value should be positive');
    assertType(value.physicalBookCount, 'number');
    assert(Array.isArray(value.topValues), 'should have topValues');
    cleanup(sys);
  });
});

describe('HomeLibraryManagementSystem — goals, streaks, badges', () => {
  it('getReadingGoals returns goal progress', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    const goals = sys.getReadingGoals();
    assertType(goals.yearlyBooks.target, 'number');
    assertType(goals.yearlyBooks.current, 'number');
    assertType(goals.yearlyPages.target, 'number');
    assertType(goals.genreDiversity.target, 'number');
    cleanup(sys);
  });

  it('setReadingGoal updates goals', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.setReadingGoal('yearlyBooks', 50), true);
    assertEqual(sys.readingGoals.yearlyBooks.target, 50);
    assertEqual(sys.setReadingGoal('yearlyPages', 12000), true);
    assertEqual(sys.setReadingGoal('genreDiversity', 15), true);
    assertEqual(sys.setReadingGoal('invalid', 10), false);
    cleanup(sys);
  });

  it('getBadges returns earned badges', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    const badges = sys.getBadges();
    assert(Array.isArray(badges), 'should return array');
    cleanup(sys);
  });

  it('getAvailableBadges returns all badges', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    const badges = sys.getAvailableBadges();
    assert(badges.length > 0, 'should have badges');
    assert(badges[0].id, 'badge should have id');
    assert(badges[0].name, 'badge should have name');
    cleanup(sys);
  });
});

describe('HomeLibraryManagementSystem — recommendations & clubs', () => {
  it('getRecommendations returns recommendation data', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    const recs = sys.getRecommendations();
    assert(Array.isArray(recs.recommendations), 'should have recommendations array');
    assert(Array.isArray(recs.favoriteGenres), 'should have favoriteGenres');
    assertType(recs.unexploredGenresCount, 'number');
    cleanup(sys);
  });

  it('createBookClub creates a club', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    const club = sys.createBookClub('Test Club', ['Alice', 'Bob']);
    assert(club, 'should return club');
    assertEqual(club.name, 'Test Club');
    assertEqual(club.members.length, 2);
    cleanup(sys);
  });

  it('setClubCurrentBook sets and rotates books', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    const club = sys.createBookClub('Readers', ['A']);
    sys.setClubCurrentBook(club.id, 'First Book', ['Topic 1']);
    assertEqual(sys.bookClubs.find(c => c.id === club.id).currentBook, 'First Book');
    sys.setClubCurrentBook(club.id, 'Second Book', ['Topic 2']);
    assertEqual(sys.bookClubs.find(c => c.id === club.id).currentBook, 'Second Book');
    assert(sys.bookClubs.find(c => c.id === club.id).booksRead.includes('First Book'), 'first book should be in booksRead');
    cleanup(sys);
  });

  it('setClubCurrentBook returns false for invalid club', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.setClubCurrentBook(999, 'Book'), false);
    cleanup(sys);
  });

  it('getBookClubs returns all clubs', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    const clubs = sys.getBookClubs();
    assert(clubs.length >= 1, 'should have at least the default club');
    assert(clubs[0].memberCount !== undefined, 'should include memberCount');
    cleanup(sys);
  });
});

describe('HomeLibraryManagementSystem — reports & stats', () => {
  it('getQuarterlyReport returns report structure', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    const report = sys.getQuarterlyReport();
    assert(report.quarter, 'should have quarter label');
    assertType(report.booksRead, 'number');
    assertType(report.totalPages, 'number');
    assert(Array.isArray(report.genres), 'genres should be array');
    cleanup(sys);
  });

  it('getAuthorStats returns author info', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    const stats = sys.getAuthorStats();
    assert(stats['Astrid Lindgren'], 'should have Lindgren stats');
    assertType(stats['Astrid Lindgren'].bookCount, 'number');
    assert(stats['Astrid Lindgren'].bookCount >= 3, 'Lindgren should have 3+ books');
    cleanup(sys);
  });

  it('getFavoriteAuthors returns favorites sorted', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    const favorites = sys.getFavoriteAuthors();
    assert(Array.isArray(favorites), 'should be array');
    assert(favorites.length > 0, 'should have favorites');
    assert(favorites[0].bookCount >= favorites[favorites.length - 1].bookCount, 'should be sorted by count desc');
    cleanup(sys);
  });

  it('setReminderEnabled toggles reminders', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    sys.setReminderEnabled(false);
    assertEqual(sys.reminderEnabled, false);
    sys.setReminderEnabled(true);
    assertEqual(sys.reminderEnabled, true);
    cleanup(sys);
  });

  it('setReminderTime validates hour range', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.setReminderTime(20), true);
    assertEqual(sys.reminderTime, 20);
    assertEqual(sys.setReminderTime(-1), false);
    assertEqual(sys.setReminderTime(24), false);
    cleanup(sys);
  });

  it('getStatistics returns comprehensive stats', async () => {
    const sys = new HomeLibraryManagementSystem(createMockHomey());
    await sys.initialize();
    const stats = sys.getStatistics();
    assertEqual(stats.initialized, true);
    assertType(stats.collection.totalBooks, 'number');
    assertType(stats.collection.booksRead, 'number');
    assertType(stats.readingStats.totalPagesRead, 'number');
    assert(stats.collection.totalBooks > 0, 'should have books');
    assert(stats.badges !== undefined, 'should have badges');
    assert(stats.clubs !== undefined, 'should have clubs');
    assert(stats.lending !== undefined, 'should have lending');
    cleanup(sys);
  });
});

run();
