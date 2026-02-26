'use strict';

const EventEmitter = require('events');

class HomeLibraryManagementSystem extends EventEmitter {
  constructor(homey) {
    super();
    this.homey = homey;
    this.initialized = false;
    this.intervals = [];

    this.books = [];
    this.nextBookId = 1;

    this.genres = {
      fiction: { subgenres: ['literary', 'contemporary', 'historical', 'experimental'], description: 'General fiction works' },
      mystery: { subgenres: ['cozy', 'hardboiled', 'police-procedural', 'noir'], description: 'Mystery and detective fiction' },
      thriller: { subgenres: ['psychological', 'legal', 'political', 'techno'], description: 'Thriller and suspense' },
      sciFi: { subgenres: ['hard-sf', 'space-opera', 'cyberpunk', 'dystopian'], description: 'Science fiction' },
      fantasy: { subgenres: ['epic', 'urban', 'dark', 'mythological'], description: 'Fantasy literature' },
      romance: { subgenres: ['contemporary', 'historical', 'paranormal', 'romantic-suspense'], description: 'Romance novels' },
      horror: { subgenres: ['gothic', 'supernatural', 'psychological', 'cosmic'], description: 'Horror fiction' },
      biography: { subgenres: ['autobiography', 'memoir', 'political', 'celebrity'], description: 'Biographical works' },
      history: { subgenres: ['ancient', 'medieval', 'modern', 'military'], description: 'Historical non-fiction' },
      science: { subgenres: ['physics', 'biology', 'chemistry', 'astronomy'], description: 'Scientific literature' },
      philosophy: { subgenres: ['ethics', 'metaphysics', 'existentialism', 'logic'], description: 'Philosophical works' },
      poetry: { subgenres: ['lyric', 'narrative', 'epic', 'haiku'], description: 'Poetry collections' },
      drama: { subgenres: ['tragedy', 'comedy', 'absurdist', 'musical'], description: 'Dramatic works and plays' },
      selfHelp: { subgenres: ['productivity', 'relationships', 'mindfulness', 'financial'], description: 'Self-help and personal development' },
      travel: { subgenres: ['adventure', 'cultural', 'guidebook', 'memoir'], description: 'Travel writing' },
      cooking: { subgenres: ['baking', 'international', 'healthy', 'quick-meals'], description: 'Cookbooks and food writing' },
      art: { subgenres: ['painting', 'sculpture', 'photography', 'architecture'], description: 'Art and visual arts' },
      music: { subgenres: ['theory', 'history', 'biography', 'instruments'], description: 'Music literature' },
      technology: { subgenres: ['programming', 'AI', 'networking', 'security'], description: 'Technology and computing' },
      business: { subgenres: ['management', 'entrepreneurship', 'marketing', 'finance'], description: 'Business literature' },
      psychology: { subgenres: ['clinical', 'cognitive', 'developmental', 'social'], description: 'Psychology texts' },
      religion: { subgenres: ['christianity', 'buddhism', 'islam', 'comparative'], description: 'Religious and spiritual works' },
      children: { subgenres: ['picture-book', 'middle-grade', 'young-adult', 'educational'], description: 'Children literature' },
      comics: { subgenres: ['superhero', 'manga', 'graphic-novel', 'indie'], description: 'Comics and graphic novels' },
      crime: { subgenres: ['true-crime', 'detective', 'forensic', 'organized-crime'], description: 'Crime fiction and non-fiction' },
      nature: { subgenres: ['ecology', 'wildlife', 'gardening', 'conservation'], description: 'Nature and environment' },
      sports: { subgenres: ['football', 'running', 'olympics', 'extreme'], description: 'Sports writing' },
      linguistics: { subgenres: ['grammar', 'etymology', 'sociolinguistics', 'translation'], description: 'Language and linguistics' },
      education: { subgenres: ['pedagogy', 'curriculum', 'higher-ed', 'special-needs'], description: 'Educational theory' },
      humor: { subgenres: ['satire', 'parody', 'essays', 'cartoons'], description: 'Humorous writing' }
    };

    this.shelves = {
      fiction: { capacity: 120, location: 'living-room-wall', currentCount: 0, description: 'Main fiction collection' },
      nonFiction: { capacity: 80, location: 'study-room', currentCount: 0, description: 'Non-fiction and reference' },
      reference: { capacity: 40, location: 'study-room-desk', currentCount: 0, description: 'Quick reference materials' },
      children: { capacity: 60, location: 'kids-room', currentCount: 0, description: 'Children books' },
      cookbook: { capacity: 30, location: 'kitchen', currentCount: 0, description: 'Cookbooks and recipes' },
      academic: { capacity: 50, location: 'home-office', currentCount: 0, description: 'Academic and textbooks' },
      bedside: { capacity: 10, location: 'master-bedroom', currentCount: 0, description: 'Currently reading stack' },
      ebooks: { capacity: 9999, location: 'digital', currentCount: 0, description: 'Digital e-book collection' },
      audiobooks: { capacity: 9999, location: 'digital', currentCount: 0, description: 'Audiobook collection' },
      guestroom: { capacity: 20, location: 'guest-bedroom', currentCount: 0, description: 'Light reads for guests' }
    };

    this.readingSessions = [];
    this.activeSession = null;

    this.readingGoals = {
      yearlyBooks: { target: 24, current: 0, year: new Date().getFullYear() },
      yearlyPages: { target: 8000, current: 0, year: new Date().getFullYear() },
      genreDiversity: { target: 10, currentGenres: new Set(), year: new Date().getFullYear() }
    };

    this.lendings = [];
    this.nextLendingId = 1;

    this.streaks = { current: 0, longest: 0, lastReadDate: null };

    this.badges = [];
    this.availableBadges = {
      bookworm: { name: 'Bookworm', description: 'Read 5 books', condition: function(s) { return s.booksRead >= 5; } },
      voracious: { name: 'Voracious Reader', description: 'Read 20 books', condition: function(s) { return s.booksRead >= 20; } },
      centurion: { name: 'Centurion', description: 'Read 100 books', condition: function(s) { return s.booksRead >= 100; } },
      genreExplorer: { name: 'Genre Explorer', description: 'Read from 5 different genres', condition: function(s) { return s.genresRead >= 5; } },
      speedReader: { name: 'Speed Reader', description: 'Achieve 60+ pages per hour', condition: function(s) { return s.maxPagesPerHour >= 60; } },
      nightOwl: { name: 'Night Owl', description: 'Read after midnight', condition: function(s) { return s.nightSessions >= 1; } },
      earlyBird: { name: 'Early Bird', description: 'Read before 6 AM', condition: function(s) { return s.earlySessions >= 1; } },
      weekStreak: { name: 'Week Warrior', description: '7-day reading streak', condition: function(s) { return s.longestStreak >= 7; } },
      monthStreak: { name: 'Monthly Master', description: '30-day reading streak', condition: function(s) { return s.longestStreak >= 30; } },
      socialReader: { name: 'Social Reader', description: 'Join a book club', condition: function(s) { return s.clubCount >= 1; } },
      librarian: { name: 'Librarian', description: 'Own 50+ books', condition: function(s) { return s.totalBooks >= 50; } },
      polyglot: { name: 'Polyglot Reader', description: 'Read books in 3+ languages', condition: function(s) { return s.languagesRead >= 3; } },
      reviewer: { name: 'Critic', description: 'Rate 10+ books', condition: function(s) { return s.ratedBooks >= 10; } },
      generous: { name: 'Generous Lender', description: 'Lend 5+ books', condition: function(s) { return s.totalLendings >= 5; } },
      marathonReader: { name: 'Marathon Reader', description: 'Single session of 3+ hours', condition: function(s) { return s.longestSessionHours >= 3; } }
    };

    this.bookClubs = [];
    this.authorStats = {};

    this.analytics = {
      totalPagesRead: 0,
      totalReadingMinutes: 0,
      totalListeningMinutes: 0,
      sessionsCount: 0,
      nightSessions: 0,
      earlySessions: 0,
      maxPagesPerHour: 0,
      longestSessionMinutes: 0,
      dailyReadingLog: {},
      genreBreakdown: {},
      formatBreakdown: { physical: 0, ebook: 0, audiobook: 0 }
    };

    this.reminderEnabled = true;
    this.reminderTime = 21;

    this.homey.log('[Library] HomeLibraryManagementSystem constructed');
  }

  async initialize() {
    try {
      this.homey.log('[Library] Initializing Home Library Management System...');
      this._loadSampleBooks();
      this._updateShelfCounts();
      this._updateAuthorStats();
      this._initializeBookClubs();
      this._startMonitoringIntervals();
      this.initialized = true;
      this.homey.log('[Library] Home Library Management System initialized successfully');
      this.homey.log('[Library] Collection: ' + this.books.length + ' books across ' + Object.keys(this.shelves).length + ' shelves');
      this.homey.emit('library-initialized', { bookCount: this.books.length });
    } catch (error) {
      this.homey.error('[Library] Failed to initialize:', error.message);
      throw error;
    }
  }

  _loadSampleBooks() {
    var sampleBooks = [
      { isbn: '978-91-29-68814-0', title: 'Pippi Longstocking', author: 'Astrid Lindgren', genre: 'children', subgenre: 'middle-grade', pages: 160, year: 1945, language: 'sv', format: 'physical', condition: 'good', rating: 5, shelf: 'children', readStatus: 'read', dateAdded: '2020-01-15', dateRead: '2020-02-01', tags: ['classic', 'swedish', 'nordic'] },
      { isbn: '978-91-7001-145-2', title: 'The Brothers Lionheart', author: 'Astrid Lindgren', genre: 'children', subgenre: 'middle-grade', pages: 232, year: 1973, language: 'sv', format: 'physical', condition: 'fair', rating: 5, shelf: 'children', readStatus: 'read', dateAdded: '2020-01-15', dateRead: '2020-03-10', tags: ['classic', 'swedish', 'adventure', 'nordic'] },
      { isbn: '978-91-7001-200-8', title: 'Ronja the Robbers Daughter', author: 'Astrid Lindgren', genre: 'children', subgenre: 'middle-grade', pages: 176, year: 1981, language: 'sv', format: 'physical', condition: 'good', rating: 5, shelf: 'children', readStatus: 'read', dateAdded: '2020-02-10', dateRead: '2020-04-20', tags: ['classic', 'swedish', 'nordic'] },
      { isbn: '978-1-84724-253-5', title: 'The Girl with the Dragon Tattoo', author: 'Stieg Larsson', genre: 'thriller', subgenre: 'psychological', pages: 672, year: 2005, language: 'en', format: 'physical', condition: 'good', rating: 4, shelf: 'fiction', readStatus: 'read', dateAdded: '2021-03-01', dateRead: '2021-04-15', tags: ['millennium', 'nordic-noir', 'nordic'] },
      { isbn: '978-1-84724-254-2', title: 'The Girl Who Played with Fire', author: 'Stieg Larsson', genre: 'thriller', subgenre: 'psychological', pages: 569, year: 2006, language: 'en', format: 'physical', condition: 'good', rating: 4, shelf: 'fiction', readStatus: 'read', dateAdded: '2021-05-01', dateRead: '2021-06-20', tags: ['millennium', 'nordic-noir', 'nordic'] },
      { isbn: '978-1-84724-255-9', title: 'The Girl Who Kicked the Hornets Nest', author: 'Stieg Larsson', genre: 'thriller', subgenre: 'political', pages: 563, year: 2007, language: 'en', format: 'ebook', condition: 'excellent', rating: 4, shelf: 'ebooks', readStatus: 'read', dateAdded: '2021-07-01', dateRead: '2021-08-30', tags: ['millennium', 'nordic-noir', 'nordic'] },
      { isbn: '978-1-77089-521-8', title: 'The 100-Year-Old Man Who Climbed Out the Window and Disappeared', author: 'Jonas Jonasson', genre: 'humor', subgenre: 'satire', pages: 396, year: 2009, language: 'en', format: 'physical', condition: 'excellent', rating: 5, shelf: 'fiction', readStatus: 'read', dateAdded: '2022-01-10', dateRead: '2022-02-14', tags: ['swedish', 'humor', 'nordic'] },
      { isbn: '978-0-06-112008-4', title: 'To Kill a Mockingbird', author: 'Harper Lee', genre: 'fiction', subgenre: 'literary', pages: 281, year: 1960, language: 'en', format: 'physical', condition: 'fair', rating: 5, shelf: 'fiction', readStatus: 'read', dateAdded: '2019-06-10', dateRead: '2019-07-25', tags: ['classic', 'american'] },
      { isbn: '978-0-7432-7356-5', title: '1984', author: 'George Orwell', genre: 'sciFi', subgenre: 'dystopian', pages: 328, year: 1949, language: 'en', format: 'physical', condition: 'good', rating: 5, shelf: 'fiction', readStatus: 'read', dateAdded: '2019-08-01', dateRead: '2019-09-15', tags: ['classic', 'dystopian'] },
      { isbn: '978-0-316-76948-0', title: 'The Catcher in the Rye', author: 'J.D. Salinger', genre: 'fiction', subgenre: 'literary', pages: 234, year: 1951, language: 'en', format: 'physical', condition: 'poor', rating: 3, shelf: 'fiction', readStatus: 'read', dateAdded: '2018-11-20', dateRead: '2019-01-05', tags: ['classic', 'american'] },
      { isbn: '978-0-544-00341-5', title: 'The Lord of the Rings', author: 'J.R.R. Tolkien', genre: 'fantasy', subgenre: 'epic', pages: 1178, year: 1954, language: 'en', format: 'physical', condition: 'good', rating: 5, shelf: 'fiction', readStatus: 'read', dateAdded: '2020-06-01', dateRead: '2020-09-30', tags: ['classic', 'epic', 'fantasy'] },
      { isbn: '978-0-14-028329-7', title: 'The Hitchhikers Guide to the Galaxy', author: 'Douglas Adams', genre: 'sciFi', subgenre: 'space-opera', pages: 193, year: 1979, language: 'en', format: 'ebook', condition: 'excellent', rating: 5, shelf: 'ebooks', readStatus: 'read', dateAdded: '2021-01-05', dateRead: '2021-01-20', tags: ['humor', 'scifi', 'classic'] },
      { isbn: '978-0-525-55969-3', title: 'Becoming', author: 'Michelle Obama', genre: 'biography', subgenre: 'memoir', pages: 448, year: 2018, language: 'en', format: 'audiobook', condition: 'excellent', rating: 4, shelf: 'audiobooks', readStatus: 'read', dateAdded: '2022-03-08', dateRead: '2022-04-20', audioDurationMinutes: 1140, tags: ['memoir', 'politics'] },
      { isbn: '978-1-5011-1168-3', title: 'Sapiens', author: 'Yuval Noah Harari', genre: 'history', subgenre: 'modern', pages: 498, year: 2011, language: 'en', format: 'audiobook', condition: 'excellent', rating: 5, shelf: 'audiobooks', readStatus: 'read', dateAdded: '2022-05-01', dateRead: '2022-06-15', audioDurationMinutes: 930, tags: ['history', 'anthropology'] },
      { isbn: '978-0-13-468599-1', title: 'The Pragmatic Programmer', author: 'David Thomas', genre: 'technology', subgenre: 'programming', pages: 352, year: 2019, language: 'en', format: 'physical', condition: 'excellent', rating: 5, shelf: 'academic', readStatus: 'read', dateAdded: '2023-01-10', dateRead: '2023-03-01', tags: ['programming', 'software'] },
      { isbn: '978-0-86154-380-1', title: 'Salt Fat Acid Heat', author: 'Samin Nosrat', genre: 'cooking', subgenre: 'international', pages: 480, year: 2017, language: 'en', format: 'physical', condition: 'good', rating: 4, shelf: 'cookbook', readStatus: 'read', dateAdded: '2022-09-01', dateRead: '2022-10-15', tags: ['cooking', 'food-science'] },
      { isbn: '978-0-06-093546-7', title: 'To the Lighthouse', author: 'Virginia Woolf', genre: 'fiction', subgenre: 'literary', pages: 209, year: 1927, language: 'en', format: 'physical', condition: 'fair', rating: 4, shelf: 'fiction', readStatus: 'reading', dateAdded: '2025-11-01', tags: ['classic', 'modernist', 'british'] },
      { isbn: '978-0-399-59094-1', title: 'Educated', author: 'Tara Westover', genre: 'biography', subgenre: 'memoir', pages: 334, year: 2018, language: 'en', format: 'ebook', condition: 'excellent', rating: 5, shelf: 'ebooks', readStatus: 'to-read', dateAdded: '2025-12-25', tags: ['memoir', 'education'] },
      { isbn: '978-91-7343-123-4', title: 'The Analfabeten', author: 'Jonas Jonasson', genre: 'humor', subgenre: 'satire', pages: 356, year: 2013, language: 'sv', format: 'physical', condition: 'excellent', rating: 4, shelf: 'fiction', readStatus: 'read', dateAdded: '2023-06-01', dateRead: '2023-07-20', tags: ['swedish', 'humor', 'nordic'] },
      { isbn: '978-0-385-33348-1', title: 'Cosmos', author: 'Carl Sagan', genre: 'science', subgenre: 'astronomy', pages: 365, year: 1980, language: 'en', format: 'physical', condition: 'good', rating: 5, shelf: 'nonFiction', readStatus: 'read', dateAdded: '2021-11-01', dateRead: '2022-01-10', tags: ['science', 'astronomy', 'classic'] }
    ];

    for (var i = 0; i < sampleBooks.length; i++) {
      var bookData = sampleBooks[i];
      var book = {
        id: this.nextBookId++,
        isbn: bookData.isbn,
        title: bookData.title,
        author: bookData.author,
        genre: bookData.genre,
        subgenre: bookData.subgenre || '',
        pages: bookData.pages || 0,
        year: bookData.year,
        language: bookData.language || 'en',
        format: bookData.format || 'physical',
        condition: bookData.condition || 'good',
        rating: bookData.rating || null,
        shelf: bookData.shelf || 'fiction',
        readStatus: bookData.readStatus || 'to-read',
        dateAdded: bookData.dateAdded || new Date().toISOString().split('T')[0],
        dateRead: bookData.dateRead || null,
        audioDurationMinutes: bookData.audioDurationMinutes || null,
        tags: bookData.tags || [],
        notes: '',
        lentTo: null
      };
      this.books.push(book);
    }
    this.homey.log('[Library] Loaded ' + sampleBooks.length + ' sample books');
  }

  _updateShelfCounts() {
    var keys = Object.keys(this.shelves);
    for (var i = 0; i < keys.length; i++) {
      this.shelves[keys[i]].currentCount = 0;
    }
    for (var j = 0; j < this.books.length; j++) {
      var book = this.books[j];
      if (this.shelves[book.shelf]) {
        this.shelves[book.shelf].currentCount++;
      }
    }
  }

  _updateAuthorStats() {
    this.authorStats = {};
    for (var i = 0; i < this.books.length; i++) {
      var book = this.books[i];
      if (!this.authorStats[book.author]) {
        this.authorStats[book.author] = { bookCount: 0, totalRating: 0, genres: new Set(), isFavorite: false };
      }
      this.authorStats[book.author].bookCount++;
      if (book.rating) {
        this.authorStats[book.author].totalRating += book.rating;
      }
      this.authorStats[book.author].genres.add(book.genre);
    }
    var authors = Object.keys(this.authorStats);
    for (var k = 0; k < authors.length; k++) {
      var stats = this.authorStats[authors[k]];
      var avgRating = stats.bookCount > 0 ? stats.totalRating / stats.bookCount : 0;
      if (stats.bookCount >= 3 || avgRating >= 4.5) {
        stats.isFavorite = true;
      }
    }
  }

  _initializeBookClubs() {
    this.bookClubs.push({
      id: 1,
      name: 'Nordic Readers Circle',
      members: ['Anna', 'Erik', 'Sofia', 'Lars'],
      currentBook: 'The Girl with the Dragon Tattoo',
      meetingSchedule: 'first-saturday-monthly',
      nextMeeting: this._getNextFirstSaturday(),
      discussionTopics: ['Character development', 'Nordic noir elements', 'Plot structure', 'Cultural context'],
      booksRead: ['Pippi Longstocking', 'The 100-Year-Old Man Who Climbed Out the Window and Disappeared'],
      created: new Date().toISOString()
    });
  }

  _getNextFirstSaturday() {
    var now = new Date();
    var date = new Date(now.getFullYear(), now.getMonth(), 1);
    while (date.getDay() !== 6) {
      date.setDate(date.getDate() + 1);
    }
    if (date < now) {
      date.setMonth(date.getMonth() + 1);
      date.setDate(1);
      while (date.getDay() !== 6) {
        date.setDate(date.getDate() + 1);
      }
    }
    return date.toISOString().split('T')[0];
  }

  _startMonitoringIntervals() {
    var self = this;
    var reminderInterval = setInterval(function() { self._checkReadingReminder(); }, 30 * 60 * 1000);
    this.intervals.push(reminderInterval);
    var lendingInterval = setInterval(function() { self._checkLendingDueDates(); }, 6 * 60 * 60 * 1000);
    this.intervals.push(lendingInterval);
    var analyticsInterval = setInterval(function() { self._runDailyAnalyticsUpdate(); }, 24 * 60 * 60 * 1000);
    this.intervals.push(analyticsInterval);
    var streakInterval = setInterval(function() { self._updateStreaks(); }, 60 * 60 * 1000);
    this.intervals.push(streakInterval);
    this.homey.log('[Library] Monitoring intervals started (4 intervals)');
  }

  addBook(bookData) {
    if (!bookData.title || !bookData.author) {
      this.homey.error('[Library] Cannot add book: title and author are required');
      return null;
    }
    var book = {
      id: this.nextBookId++,
      isbn: bookData.isbn || '',
      title: bookData.title,
      author: bookData.author,
      genre: bookData.genre || 'fiction',
      subgenre: bookData.subgenre || '',
      pages: bookData.pages || 0,
      year: bookData.year || new Date().getFullYear(),
      language: bookData.language || 'en',
      format: bookData.format || 'physical',
      condition: bookData.condition || 'excellent',
      rating: bookData.rating || null,
      shelf: bookData.shelf || 'fiction',
      readStatus: bookData.readStatus || 'to-read',
      dateAdded: new Date().toISOString().split('T')[0],
      dateRead: bookData.dateRead || null,
      audioDurationMinutes: bookData.audioDurationMinutes || null,
      tags: bookData.tags || [],
      notes: bookData.notes || '',
      lentTo: null
    };
    if (this.shelves[book.shelf]) {
      var shelf = this.shelves[book.shelf];
      if (shelf.currentCount >= shelf.capacity) {
        this.homey.error('[Library] Shelf ' + book.shelf + ' is full (' + shelf.capacity + ' capacity)');
        return null;
      }
    }
    this.books.push(book);
    this._updateShelfCounts();
    this._updateAuthorStats();
    this.homey.log('[Library] Added book: "' + book.title + '" by ' + book.author + ' (ID: ' + book.id + ')');
    this.homey.emit('book-added', { id: book.id, title: book.title, author: book.author });
    return book;
  }

  removeBook(bookId) {
    var index = this.books.findIndex(function(b) { return b.id === bookId; });
    if (index === -1) {
      this.homey.error('[Library] Book ID ' + bookId + ' not found');
      return false;
    }
    var book = this.books.splice(index, 1)[0];
    this._updateShelfCounts();
    this._updateAuthorStats();
    this.homey.log('[Library] Removed book: "' + book.title + '" by ' + book.author);
    this.homey.emit('book-removed', { id: book.id, title: book.title });
    return true;
  }

  updateBook(bookId, updates) {
    var book = this.books.find(function(b) { return b.id === bookId; });
    if (!book) {
      this.homey.error('[Library] Book ID ' + bookId + ' not found for update');
      return null;
    }
    var allowedFields = ['title', 'author', 'genre', 'subgenre', 'pages', 'year', 'language', 'format', 'condition', 'rating', 'shelf', 'readStatus', 'dateRead', 'tags', 'notes', 'audioDurationMinutes'];
    var updateKeys = Object.keys(updates);
    for (var i = 0; i < updateKeys.length; i++) {
      if (allowedFields.includes(updateKeys[i])) {
        book[updateKeys[i]] = updates[updateKeys[i]];
      }
    }
    if (updates.readStatus === 'read' && !book.dateRead) {
      book.dateRead = new Date().toISOString().split('T')[0];
    }
    this._updateShelfCounts();
    this._updateAuthorStats();
    this.homey.log('[Library] Updated book: "' + book.title + '" (ID: ' + book.id + ')');
    this.homey.emit('book-updated', { id: book.id, title: book.title, updates: updateKeys });
    return book;
  }

  rateBook(bookId, rating) {
    if (rating < 1 || rating > 5) {
      this.homey.error('[Library] Rating must be between 1 and 5');
      return false;
    }
    var book = this.books.find(function(b) { return b.id === bookId; });
    if (!book) {
      this.homey.error('[Library] Book ID ' + bookId + ' not found');
      return false;
    }
    book.rating = rating;
    this._updateAuthorStats();
    this.homey.log('[Library] Rated "' + book.title + '": ' + rating + '/5');
    this.homey.emit('book-rated', { id: book.id, title: book.title, rating: rating });
    return true;
  }

  searchBooks(query) {
    if (!query || typeof query !== 'string') return [];
    var q = query.toLowerCase().trim();
    return this.books.filter(function(book) {
      return (
        book.title.toLowerCase().includes(q) ||
        book.author.toLowerCase().includes(q) ||
        book.genre.toLowerCase().includes(q) ||
        book.isbn.includes(q) ||
        (book.tags && book.tags.some(function(t) { return t.toLowerCase().includes(q); })) ||
        (book.subgenre && book.subgenre.toLowerCase().includes(q))
      );
    });
  }

  searchByGenre(genre) {
    return this.books.filter(function(b) { return b.genre === genre; });
  }

  searchByAuthor(author) {
    var a = author.toLowerCase();
    return this.books.filter(function(b) { return b.author.toLowerCase().includes(a); });
  }

  searchByISBN(isbn) {
    return this.books.find(function(b) { return b.isbn === isbn; }) || null;
  }

  searchByShelf(shelf) {
    return this.books.filter(function(b) { return b.shelf === shelf; });
  }

  lookupISBN(isbn) {
    this.homey.log('[Library] Looking up ISBN: ' + isbn);
    var localBook = this.searchByISBN(isbn);
    if (localBook) {
      this.homey.log('[Library] ISBN ' + isbn + ' found in local collection: "' + localBook.title + '"');
      return { found: true, source: 'local', book: localBook };
    }
    var simulatedResults = {
      '978-0-14-028329-7': { title: 'The Hitchhikers Guide to the Galaxy', author: 'Douglas Adams', pages: 193, year: 1979, genre: 'sciFi' },
      '978-0-06-112008-4': { title: 'To Kill a Mockingbird', author: 'Harper Lee', pages: 281, year: 1960, genre: 'fiction' }
    };
    if (simulatedResults[isbn]) {
      this.homey.log('[Library] ISBN ' + isbn + ' found via simulated lookup');
      return { found: true, source: 'external', book: simulatedResults[isbn] };
    }
    this.homey.log('[Library] ISBN ' + isbn + ' not found');
    return { found: false, source: null, book: null };
  }

  startReadingSession(bookId) {
    if (this.activeSession) {
      this.homey.error('[Library] A reading session is already active');
      return null;
    }
    var book = this.books.find(function(b) { return b.id === bookId; });
    if (!book) {
      this.homey.error('[Library] Book ID ' + bookId + ' not found');
      return null;
    }
    this.activeSession = {
      bookId: book.id,
      bookTitle: book.title,
      startTime: new Date().toISOString(),
      startPage: null,
      endPage: null,
      endTime: null,
      pagesRead: 0,
      durationMinutes: 0,
      pagesPerHour: 0,
      format: book.format
    };
    if (book.readStatus === 'to-read') {
      book.readStatus = 'reading';
    }
    this.homey.log('[Library] Reading session started: "' + book.title + '"');
    this.homey.emit('reading-session-started', { bookId: book.id, title: book.title });
    return this.activeSession;
  }

  endReadingSession(pagesRead, notes) {
    if (!this.activeSession) {
      this.homey.error('[Library] No active reading session');
      return null;
    }
    var endTime = new Date();
    var startTime = new Date(this.activeSession.startTime);
    var durationMinutes = Math.round((endTime - startTime) / (1000 * 60));
    var durationHours = durationMinutes / 60;
    var pagesPerHour = durationHours > 0 ? Math.round(pagesRead / durationHours) : 0;
    this.activeSession.endTime = endTime.toISOString();
    this.activeSession.pagesRead = pagesRead || 0;
    this.activeSession.durationMinutes = durationMinutes;
    this.activeSession.pagesPerHour = pagesPerHour;
    this.activeSession.notes = notes || '';
    this.analytics.totalPagesRead += pagesRead || 0;
    this.analytics.totalReadingMinutes += durationMinutes;
    this.analytics.sessionsCount++;
    if (pagesPerHour > this.analytics.maxPagesPerHour) {
      this.analytics.maxPagesPerHour = pagesPerHour;
    }
    if (durationMinutes > this.analytics.longestSessionMinutes) {
      this.analytics.longestSessionMinutes = durationMinutes;
    }
    var hour = startTime.getHours();
    if (hour >= 0 && hour < 6) {
      this.analytics.earlySessions++;
    }
    if (hour >= 22 || (hour >= 0 && hour < 2)) {
      this.analytics.nightSessions++;
    }
    var dateKey = endTime.toISOString().split('T')[0];
    if (!this.analytics.dailyReadingLog[dateKey]) {
      this.analytics.dailyReadingLog[dateKey] = { pages: 0, minutes: 0, sessions: 0 };
    }
    this.analytics.dailyReadingLog[dateKey].pages += pagesRead || 0;
    this.analytics.dailyReadingLog[dateKey].minutes += durationMinutes;
    this.analytics.dailyReadingLog[dateKey].sessions++;
    var book = this.books.find(function(b) { return b.id === this.activeSession.bookId; }.bind(this));
    if (book) {
      if (!this.analytics.genreBreakdown[book.genre]) {
        this.analytics.genreBreakdown[book.genre] = { pages: 0, sessions: 0, minutes: 0 };
      }
      this.analytics.genreBreakdown[book.genre].pages += pagesRead || 0;
      this.analytics.genreBreakdown[book.genre].sessions++;
      this.analytics.genreBreakdown[book.genre].minutes += durationMinutes;
      if (book.format === 'ebook') { this.analytics.formatBreakdown.ebook++; }
      else if (book.format === 'audiobook') { this.analytics.formatBreakdown.audiobook++; }
      else { this.analytics.formatBreakdown.physical++; }
      this.readingGoals.yearlyPages.current += pagesRead || 0;
      this.readingGoals.genreDiversity.currentGenres.add(book.genre);
    }
    this.streaks.lastReadDate = dateKey;
    this._updateStreaks();
    var session = Object.assign({}, this.activeSession);
    this.readingSessions.push(session);
    this.activeSession = null;
    this.homey.log('[Library] Reading session ended: ' + pagesRead + ' pages in ' + durationMinutes + ' min (' + pagesPerHour + ' p/h)');
    this.homey.emit('reading-session-ended', {
      bookId: session.bookId,
      title: session.bookTitle,
      pagesRead: pagesRead,
      durationMinutes: durationMinutes,
      pagesPerHour: pagesPerHour
    });
    this._checkBadges();
    return session;
  }

  logAudiobookListening(bookId, durationMinutes) {
    var book = this.books.find(function(b) { return b.id === bookId; });
    if (!book) {
      this.homey.error('[Library] Book ID ' + bookId + ' not found');
      return false;
    }
    if (book.format !== 'audiobook') {
      this.homey.error('[Library] Book "' + book.title + '" is not an audiobook');
      return false;
    }
    this.analytics.totalListeningMinutes += durationMinutes;
    var dateKey = new Date().toISOString().split('T')[0];
    if (!this.analytics.dailyReadingLog[dateKey]) {
      this.analytics.dailyReadingLog[dateKey] = { pages: 0, minutes: 0, sessions: 0 };
    }
    this.analytics.dailyReadingLog[dateKey].minutes += durationMinutes;
    this.analytics.dailyReadingLog[dateKey].sessions++;
    this.streaks.lastReadDate = dateKey;
    this._updateStreaks();
    this.homey.log('[Library] Audiobook listening logged: "' + book.title + '" - ' + durationMinutes + ' minutes');
    this.homey.emit('audiobook-listening', { bookId: bookId, title: book.title, durationMinutes: durationMinutes });
    return true;
  }

  getAudiobookStats() {
    var audiobooks = this.books.filter(function(b) { return b.format === 'audiobook'; });
    var totalDuration = audiobooks.reduce(function(sum, b) { return sum + (b.audioDurationMinutes || 0); }, 0);
    return {
      count: audiobooks.length,
      totalDurationMinutes: totalDuration,
      totalDurationHours: Math.round(totalDuration / 60 * 10) / 10,
      totalListeningMinutes: this.analytics.totalListeningMinutes,
      titles: audiobooks.map(function(b) { return { id: b.id, title: b.title, author: b.author, durationMinutes: b.audioDurationMinutes }; })
    };
  }

  getFormatBreakdown() {
    var counts = { physical: 0, ebook: 0, audiobook: 0 };
    for (var i = 0; i < this.books.length; i++) {
      if (counts[this.books[i].format] !== undefined) {
        counts[this.books[i].format]++;
      }
    }
    var total = this.books.length;
    return {
      counts: counts,
      percentages: {
        physical: total > 0 ? Math.round(counts.physical / total * 100) : 0,
        ebook: total > 0 ? Math.round(counts.ebook / total * 100) : 0,
        audiobook: total > 0 ? Math.round(counts.audiobook / total * 100) : 0
      },
      sessionBreakdown: Object.assign({}, this.analytics.formatBreakdown)
    };
  }

  lendBook(bookId, borrowerName, dueDays) {
    var book = this.books.find(function(b) { return b.id === bookId; });
    if (!book) {
      this.homey.error('[Library] Book ID ' + bookId + ' not found');
      return null;
    }
    if (book.lentTo) {
      this.homey.error('[Library] Book "' + book.title + '" is already lent to ' + book.lentTo);
      return null;
    }
    if (book.format !== 'physical') {
      this.homey.error('[Library] Only physical books can be lent');
      return null;
    }
    var dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (dueDays || 14));
    var lending = {
      id: this.nextLendingId++,
      bookId: book.id,
      bookTitle: book.title,
      borrower: borrowerName,
      lentDate: new Date().toISOString().split('T')[0],
      dueDate: dueDate.toISOString().split('T')[0],
      returnedDate: null,
      status: 'active'
    };
    book.lentTo = borrowerName;
    this.lendings.push(lending);
    this.homey.log('[Library] Lent "' + book.title + '" to ' + borrowerName + ', due ' + lending.dueDate);
    this.homey.emit('book-lent', { lendingId: lending.id, bookTitle: book.title, borrower: borrowerName, dueDate: lending.dueDate });
    return lending;
  }

  returnBook(bookId) {
    var book = this.books.find(function(b) { return b.id === bookId; });
    if (!book) {
      this.homey.error('[Library] Book ID ' + bookId + ' not found');
      return false;
    }
    if (!book.lentTo) {
      this.homey.error('[Library] Book "' + book.title + '" is not currently lent out');
      return false;
    }
    var lending = this.lendings.find(function(l) { return l.bookId === bookId && l.status === 'active'; });
    if (lending) {
      lending.returnedDate = new Date().toISOString().split('T')[0];
      lending.status = 'returned';
    }
    var borrower = book.lentTo;
    book.lentTo = null;
    this.homey.log('[Library] "' + book.title + '" returned by ' + borrower);
    this.homey.emit('book-returned', { bookId: book.id, title: book.title, borrower: borrower });
    return true;
  }

  getActiveLendings() {
    return this.lendings.filter(function(l) { return l.status === 'active'; });
  }

  getOverdueLendings() {
    var today = new Date().toISOString().split('T')[0];
    return this.lendings.filter(function(l) { return l.status === 'active' && l.dueDate < today; });
  }

  _checkLendingDueDates() {
    var overdue = this.getOverdueLendings();
    if (overdue.length > 0) {
      this.homey.log('[Library] ' + overdue.length + ' overdue lending(s) detected');
      for (var i = 0; i < overdue.length; i++) {
        this.homey.emit('lending-overdue', {
          lendingId: overdue[i].id,
          bookTitle: overdue[i].bookTitle,
          borrower: overdue[i].borrower,
          dueDate: overdue[i].dueDate
        });
      }
    }
  }

  getShelfStatus() {
    var status = {};
    var keys = Object.keys(this.shelves);
    for (var i = 0; i < keys.length; i++) {
      var shelf = this.shelves[keys[i]];
      status[keys[i]] = {
        capacity: shelf.capacity,
        location: shelf.location,
        currentCount: shelf.currentCount,
        description: shelf.description,
        utilization: shelf.capacity > 0 ? Math.round(shelf.currentCount / shelf.capacity * 100) : 0,
        available: shelf.capacity - shelf.currentCount
      };
    }
    return status;
  }

  getShelfUtilization() {
    var totalCapacity = 0;
    var totalUsed = 0;
    var keys = Object.keys(this.shelves);
    for (var i = 0; i < keys.length; i++) {
      var shelf = this.shelves[keys[i]];
      if (shelf.location !== 'digital') {
        totalCapacity += shelf.capacity;
        totalUsed += shelf.currentCount;
      }
    }
    return {
      totalCapacity: totalCapacity,
      totalUsed: totalUsed,
      totalAvailable: totalCapacity - totalUsed,
      overallUtilization: totalCapacity > 0 ? Math.round(totalUsed / totalCapacity * 100) : 0
    };
  }

  moveBookToShelf(bookId, newShelf) {
    var book = this.books.find(function(b) { return b.id === bookId; });
    if (!book) {
      this.homey.error('[Library] Book ID ' + bookId + ' not found');
      return false;
    }
    if (!this.shelves[newShelf]) {
      this.homey.error('[Library] Shelf ' + newShelf + ' does not exist');
      return false;
    }
    var target = this.shelves[newShelf];
    if (target.currentCount >= target.capacity) {
      this.homey.error('[Library] Shelf ' + newShelf + ' is full');
      return false;
    }
    var oldShelf = book.shelf;
    book.shelf = newShelf;
    this._updateShelfCounts();
    this.homey.log('[Library] Moved "' + book.title + '" from ' + oldShelf + ' to ' + newShelf);
    return true;
  }

  getConditionReport() {
    var conditions = { excellent: 0, good: 0, fair: 0, poor: 0 };
    for (var i = 0; i < this.books.length; i++) {
      if (conditions[this.books[i].condition] !== undefined) {
        conditions[this.books[i].condition]++;
      }
    }
    var poorBooks = this.books.filter(function(b) { return b.condition === 'poor'; });
    return {
      summary: conditions,
      poorConditionBooks: poorBooks.map(function(b) { return { id: b.id, title: b.title, author: b.author, shelf: b.shelf }; }),
      needsAttention: poorBooks.length
    };
  }

  updateBookCondition(bookId, newCondition) {
    var validConditions = ['excellent', 'good', 'fair', 'poor'];
    if (!validConditions.includes(newCondition)) {
      this.homey.error('[Library] Invalid condition: ' + newCondition);
      return false;
    }
    var book = this.books.find(function(b) { return b.id === bookId; });
    if (!book) {
      this.homey.error('[Library] Book ID ' + bookId + ' not found');
      return false;
    }
    var oldCondition = book.condition;
    book.condition = newCondition;
    this.homey.log('[Library] "' + book.title + '" condition: ' + oldCondition + ' -> ' + newCondition);
    if (newCondition === 'poor') {
      this.homey.emit('book-poor-condition', { id: book.id, title: book.title });
    }
    return true;
  }

  estimateCollectionValue() {
    var conditionMultiplier = { excellent: 1.0, good: 0.7, fair: 0.4, poor: 0.15 };
    var totalValue = 0;
    var bookValues = [];
    for (var i = 0; i < this.books.length; i++) {
      var book = this.books[i];
      if (book.format !== 'physical') continue;
      var age = new Date().getFullYear() - book.year;
      var baseValue = 150;
      if (age > 50) baseValue += 300;
      else if (age > 20) baseValue += 100;
      else if (age > 10) baseValue += 50;
      if (book.pages > 500) baseValue += 50;
      if (book.rating === 5) baseValue += 75;
      var multiplier = conditionMultiplier[book.condition] || 0.5;
      var estimatedValue = Math.round(baseValue * multiplier);
      totalValue += estimatedValue;
      bookValues.push({
        id: book.id,
        title: book.title,
        author: book.author,
        condition: book.condition,
        year: book.year,
        estimatedValueSEK: estimatedValue
      });
    }
    bookValues.sort(function(a, b) { return b.estimatedValueSEK - a.estimatedValueSEK; });
    return {
      totalValueSEK: totalValue,
      physicalBookCount: bookValues.length,
      averageValueSEK: bookValues.length > 0 ? Math.round(totalValue / bookValues.length) : 0,
      topValues: bookValues.slice(0, 5),
      allValues: bookValues
    };
  }

  getReadingGoals() {
    var yearStr = String(this.readingGoals.yearlyBooks.year);
    var booksRead = this.books.filter(function(b) {
      if (b.readStatus !== 'read' || !b.dateRead) return false;
      return b.dateRead.startsWith(yearStr);
    }).length;
    this.readingGoals.yearlyBooks.current = booksRead;
    return {
      yearlyBooks: {
        target: this.readingGoals.yearlyBooks.target,
        current: this.readingGoals.yearlyBooks.current,
        year: this.readingGoals.yearlyBooks.year,
        progress: Math.round(this.readingGoals.yearlyBooks.current / this.readingGoals.yearlyBooks.target * 100)
      },
      yearlyPages: {
        target: this.readingGoals.yearlyPages.target,
        current: this.readingGoals.yearlyPages.current,
        year: this.readingGoals.yearlyPages.year,
        progress: Math.round(this.readingGoals.yearlyPages.current / this.readingGoals.yearlyPages.target * 100)
      },
      genreDiversity: {
        target: this.readingGoals.genreDiversity.target,
        current: this.readingGoals.genreDiversity.currentGenres.size,
        genres: Array.from(this.readingGoals.genreDiversity.currentGenres),
        progress: Math.round(this.readingGoals.genreDiversity.currentGenres.size / this.readingGoals.genreDiversity.target * 100)
      }
    };
  }

  setReadingGoal(goalType, target) {
    if (goalType === 'yearlyBooks') {
      this.readingGoals.yearlyBooks.target = target;
    } else if (goalType === 'yearlyPages') {
      this.readingGoals.yearlyPages.target = target;
    } else if (goalType === 'genreDiversity') {
      this.readingGoals.genreDiversity.target = target;
    } else {
      this.homey.error('[Library] Unknown goal type: ' + goalType);
      return false;
    }
    this.homey.log('[Library] Reading goal ' + goalType + ' set to ' + target);
    this.homey.emit('reading-goal-updated', { goalType: goalType, target: target });
    return true;
  }

  _updateStreaks() {
    if (!this.streaks.lastReadDate) return;
    var today = new Date().toISOString().split('T')[0];
    var lastRead = this.streaks.lastReadDate;
    var todayDate = new Date(today);
    var lastDate = new Date(lastRead);
    var diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));
    if (diffDays <= 1) {
      if (diffDays === 0 && this.streaks.current === 0) {
        this.streaks.current = 1;
      } else if (diffDays === 1) {
        this.streaks.current++;
      }
    } else {
      this.streaks.current = 0;
    }
    if (this.streaks.current > this.streaks.longest) {
      this.streaks.longest = this.streaks.current;
      this.homey.log('[Library] New longest reading streak: ' + this.streaks.longest + ' days!');
      this.homey.emit('streak-record', { days: this.streaks.longest });
    }
  }

  _checkBadges() {
    var booksRead = this.books.filter(function(b) { return b.readStatus === 'read'; }).length;
    var readBooks = this.books.filter(function(b) { return b.readStatus === 'read'; });
    var genreSet = new Set(readBooks.map(function(b) { return b.genre; }));
    var langSet = new Set(readBooks.map(function(b) { return b.language; }));
    var ratedBooks = this.books.filter(function(b) { return b.rating !== null; }).length;
    var totalLendings = this.lendings.length;
    var stats = {
      booksRead: booksRead,
      genresRead: genreSet.size,
      maxPagesPerHour: this.analytics.maxPagesPerHour,
      nightSessions: this.analytics.nightSessions,
      earlySessions: this.analytics.earlySessions,
      longestStreak: this.streaks.longest,
      clubCount: this.bookClubs.length,
      totalBooks: this.books.length,
      languagesRead: langSet.size,
      ratedBooks: ratedBooks,
      totalLendings: totalLendings,
      longestSessionHours: this.analytics.longestSessionMinutes / 60
    };
    var badgeKeys = Object.keys(this.availableBadges);
    for (var i = 0; i < badgeKeys.length; i++) {
      var key = badgeKeys[i];
      if (this.badges.includes(key)) continue;
      try {
        var badge = this.availableBadges[key];
        if (badge.condition(stats)) {
          this.badges.push(key);
          this.homey.log('[Library] Badge earned: ' + badge.name + ' - ' + badge.description);
          this.homey.emit('badge-earned', { badge: key, name: badge.name, description: badge.description });
        }
      } catch (_err) {
        // Skip badge check errors
      }
    }
  }

  getBadges() {
    var self = this;
    return this.badges.map(function(key) {
      return {
        id: key,
        name: self.availableBadges[key].name,
        description: self.availableBadges[key].description,
        earned: true
      };
    });
  }

  getAvailableBadges() {
    var self = this;
    return Object.keys(this.availableBadges).map(function(key) {
      return {
        id: key,
        name: self.availableBadges[key].name,
        description: self.availableBadges[key].description,
        earned: self.badges.includes(key)
      };
    });
  }

  getRecommendations() {
    var readBooks = this.books.filter(function(b) { return b.readStatus === 'read'; });
    var recommendations = [];
    var genreCounts = {};
    for (var i = 0; i < readBooks.length; i++) {
      genreCounts[readBooks[i].genre] = (genreCounts[readBooks[i].genre] || 0) + 1;
    }
    var favoriteGenres = Object.entries(genreCounts)
      .sort(function(a, b) { return b[1] - a[1]; })
      .slice(0, 3)
      .map(function(e) { return e[0]; });
    var self = this;
    var favoriteAuthors = Object.keys(this.authorStats)
      .filter(function(author) { return self.authorStats[author].isFavorite; });
    var unreadBooks = this.books.filter(function(b) { return b.readStatus === 'to-read'; });
    for (var j = 0; j < unreadBooks.length; j++) {
      var book = unreadBooks[j];
      if (favoriteGenres.includes(book.genre)) {
        recommendations.push({
          type: 'genre-match',
          book: { id: book.id, title: book.title, author: book.author, genre: book.genre },
          reason: 'Matches your favorite genre: ' + book.genre
        });
      }
      if (favoriteAuthors.includes(book.author)) {
        recommendations.push({
          type: 'author-match',
          book: { id: book.id, title: book.title, author: book.author },
          reason: 'By one of your favorite authors: ' + book.author
        });
      }
    }
    var allGenres = Object.keys(this.genres);
    var readGenres = new Set(readBooks.map(function(b) { return b.genre; }));
    var unexploredGenres = allGenres.filter(function(g) { return !readGenres.has(g); });
    if (unexploredGenres.length > 0) {
      var suggested = unexploredGenres.slice(0, 3);
      for (var k = 0; k < suggested.length; k++) {
        recommendations.push({
          type: 'genre-exploration',
          genre: suggested[k],
          genreInfo: this.genres[suggested[k]],
          reason: 'Explore a new genre: ' + suggested[k]
        });
      }
    }
    var topRated = readBooks.filter(function(b) { return b.rating >= 4; }).sort(function(a, b) { return b.rating - a.rating; });
    if (topRated.length > 0) {
      var topGenres = Array.from(new Set(topRated.map(function(b) { return b.genre; })));
      for (var m = 0; m < Math.min(topGenres.length, 2); m++) {
        var genre = topGenres[m];
        var similarUnread = this.books.filter(function(b) { return b.genre === genre && b.readStatus !== 'read'; });
        if (similarUnread.length > 0) {
          recommendations.push({
            type: 'rating-based',
            book: { id: similarUnread[0].id, title: similarUnread[0].title, author: similarUnread[0].author },
            reason: 'Similar to highly rated books in ' + genre
          });
        }
      }
    }
    return {
      recommendations: recommendations.slice(0, 10),
      favoriteGenres: favoriteGenres,
      favoriteAuthors: favoriteAuthors,
      unexploredGenresCount: unexploredGenres.length
    };
  }

  createBookClub(name, members) {
    var club = {
      id: this.bookClubs.length + 1,
      name: name,
      members: members || [],
      currentBook: null,
      meetingSchedule: 'monthly',
      nextMeeting: null,
      discussionTopics: [],
      booksRead: [],
      created: new Date().toISOString()
    };
    this.bookClubs.push(club);
    this.homey.log('[Library] Book club created: "' + name + '" with ' + (members || []).length + ' members');
    this.homey.emit('book-club-created', { id: club.id, name: name });
    this._checkBadges();
    return club;
  }

  setClubCurrentBook(clubId, bookTitle, topics) {
    var club = this.bookClubs.find(function(c) { return c.id === clubId; });
    if (!club) {
      this.homey.error('[Library] Book club ID ' + clubId + ' not found');
      return false;
    }
    if (club.currentBook) {
      club.booksRead.push(club.currentBook);
    }
    club.currentBook = bookTitle;
    club.discussionTopics = topics || [];
    this.homey.log('[Library] Club "' + club.name + '" now reading: "' + bookTitle + '"');
    return true;
  }

  getBookClubs() {
    return this.bookClubs.map(function(club) {
      return {
        id: club.id,
        name: club.name,
        members: club.members,
        currentBook: club.currentBook,
        meetingSchedule: club.meetingSchedule,
        nextMeeting: club.nextMeeting,
        discussionTopics: club.discussionTopics,
        booksRead: club.booksRead,
        created: club.created,
        memberCount: club.members.length,
        booksReadCount: club.booksRead.length
      };
    });
  }

  getQuarterlyReport() {
    var now = new Date();
    var currentQuarter = Math.floor(now.getMonth() / 3) + 1;
    var quarterStart = new Date(now.getFullYear(), (currentQuarter - 1) * 3, 1);
    var quarterStartStr = quarterStart.toISOString().split('T')[0];
    var quarterBooks = this.books.filter(function(b) {
      return b.readStatus === 'read' && b.dateRead && b.dateRead >= quarterStartStr;
    });
    var quarterStartISO = quarterStart.toISOString();
    var quarterSessions = this.readingSessions.filter(function(s) {
      return s.endTime && s.endTime >= quarterStartISO;
    });
    var totalPages = quarterBooks.reduce(function(sum, b) { return sum + (b.pages || 0); }, 0);
    var totalMinutes = quarterSessions.reduce(function(sum, s) { return sum + (s.durationMinutes || 0); }, 0);
    var genres = Array.from(new Set(quarterBooks.map(function(b) { return b.genre; })));
    return {
      quarter: 'Q' + currentQuarter + ' ' + now.getFullYear(),
      booksRead: quarterBooks.length,
      totalPages: totalPages,
      totalReadingHours: Math.round(totalMinutes / 60 * 10) / 10,
      genres: genres,
      genreCount: genres.length,
      averagePagesPerBook: quarterBooks.length > 0 ? Math.round(totalPages / quarterBooks.length) : 0,
      sessionCount: quarterSessions.length,
      books: quarterBooks.map(function(b) { return { title: b.title, author: b.author, genre: b.genre, rating: b.rating, pages: b.pages }; })
    };
  }

  _checkReadingReminder() {
    if (!this.reminderEnabled) return;
    var now = new Date();
    var hour = now.getHours();
    if (hour !== this.reminderTime) return;
    var today = now.toISOString().split('T')[0];
    var todayLog = this.analytics.dailyReadingLog[today];
    if (!todayLog || todayLog.sessions === 0) {
      this.homey.log('[Library] Evening reading reminder: No reading session today');
      this.homey.emit('reading-reminder', {
        message: 'You have not read today. Time to pick up a book!',
        suggestion: this._getQuickReadingSuggestion()
      });
    }
  }

  _getQuickReadingSuggestion() {
    var currentlyReading = this.books.find(function(b) { return b.readStatus === 'reading'; });
    if (currentlyReading) {
      return { title: currentlyReading.title, author: currentlyReading.author, message: 'Continue reading' };
    }
    var bedsideBooks = this.books.filter(function(b) { return b.shelf === 'bedside' && b.readStatus !== 'read'; });
    if (bedsideBooks.length > 0) {
      return { title: bedsideBooks[0].title, author: bedsideBooks[0].author, message: 'Grab from bedside' };
    }
    return { message: 'Browse your collection for something new' };
  }

  setReminderEnabled(enabled) {
    this.reminderEnabled = enabled;
    this.homey.log('[Library] Reading reminders ' + (enabled ? 'enabled' : 'disabled'));
  }

  setReminderTime(hour) {
    if (hour < 0 || hour > 23) {
      this.homey.error('[Library] Reminder hour must be 0-23');
      return false;
    }
    this.reminderTime = hour;
    this.homey.log('[Library] Reading reminder time set to ' + hour + ':00');
    return true;
  }

  _runDailyAnalyticsUpdate() {
    this.homey.log('[Library] Running daily analytics update...');
    var currentYear = new Date().getFullYear();
    if (this.readingGoals.yearlyBooks.year !== currentYear) {
      this.readingGoals.yearlyBooks = { target: this.readingGoals.yearlyBooks.target, current: 0, year: currentYear };
      this.readingGoals.yearlyPages = { target: this.readingGoals.yearlyPages.target, current: 0, year: currentYear };
      this.readingGoals.genreDiversity = { target: this.readingGoals.genreDiversity.target, currentGenres: new Set(), year: currentYear };
      this.homey.log('[Library] Reading goals reset for new year');
    }
    var yearStr = String(currentYear);
    var yearBooks = this.books.filter(function(b) {
      return b.readStatus === 'read' && b.dateRead && b.dateRead.startsWith(yearStr);
    });
    this.readingGoals.yearlyBooks.current = yearBooks.length;
    var yearPages = yearBooks.reduce(function(sum, b) { return sum + (b.pages || 0); }, 0);
    this.readingGoals.yearlyPages.current = yearPages;
    var yearGenres = new Set(yearBooks.map(function(b) { return b.genre; }));
    this.readingGoals.genreDiversity.currentGenres = yearGenres;
    this._updateAuthorStats();
    this._updateShelfCounts();
    this._checkLendingDueDates();
    this._checkBadges();
    this.homey.log('[Library] Daily analytics update completed');
    this.homey.emit('analytics-updated', {
      booksInCollection: this.books.length,
      booksReadThisYear: yearBooks.length,
      pagesReadThisYear: yearPages
    });
  }

  getAuthorStats() {
    var result = {};
    var authors = Object.keys(this.authorStats);
    for (var i = 0; i < authors.length; i++) {
      var stats = this.authorStats[authors[i]];
      result[authors[i]] = {
        bookCount: stats.bookCount,
        averageRating: stats.bookCount > 0 ? Math.round(stats.totalRating / stats.bookCount * 10) / 10 : 0,
        genres: stats.genres instanceof Set ? Array.from(stats.genres) : [],
        isFavorite: stats.isFavorite
      };
    }
    return result;
  }

  getFavoriteAuthors() {
    var self = this;
    return Object.keys(this.authorStats)
      .filter(function(author) { return self.authorStats[author].isFavorite; })
      .map(function(author) {
        var stats = self.authorStats[author];
        return {
          author: author,
          bookCount: stats.bookCount,
          averageRating: stats.bookCount > 0 ? Math.round(stats.totalRating / stats.bookCount * 10) / 10 : 0
        };
      })
      .sort(function(a, b) { return b.bookCount - a.bookCount; });
  }

  getStatistics() {
    var totalBooks = this.books.length;
    var booksRead = this.books.filter(function(b) { return b.readStatus === 'read'; }).length;
    var currentlyReading = this.books.filter(function(b) { return b.readStatus === 'reading'; }).length;
    var toRead = this.books.filter(function(b) { return b.readStatus === 'to-read'; }).length;
    var totalPages = this.books.reduce(function(sum, b) { return sum + (b.pages || 0); }, 0);
    var pagesRead = this.books.filter(function(b) { return b.readStatus === 'read'; }).reduce(function(sum, b) { return sum + (b.pages || 0); }, 0);
    var genreSet = new Set(this.books.map(function(b) { return b.genre; }));
    var authorSet = new Set(this.books.map(function(b) { return b.author; }));
    var languageSet = new Set(this.books.map(function(b) { return b.language; }));
    var activeLendings = this.getActiveLendings();
    var overdueLendings = this.getOverdueLendings();
    var collectionValue = this.estimateCollectionValue();
    var formatBreakdown = this.getFormatBreakdown();
    var conditionReport = this.getConditionReport();
    var readingGoals = this.getReadingGoals();
    var shelfUtilization = this.getShelfUtilization();
    var audioStats = this.getAudiobookStats();
    return {
      initialized: this.initialized,
      collection: {
        totalBooks: totalBooks,
        booksRead: booksRead,
        currentlyReading: currentlyReading,
        toRead: toRead,
        totalPages: totalPages,
        pagesRead: pagesRead,
        genres: genreSet.size,
        authors: authorSet.size,
        languages: languageSet.size,
        genreList: Array.from(genreSet),
        languageList: Array.from(languageSet)
      },
      readingStats: {
        totalPagesRead: this.analytics.totalPagesRead,
        totalReadingMinutes: this.analytics.totalReadingMinutes,
        totalReadingHours: Math.round(this.analytics.totalReadingMinutes / 60 * 10) / 10,
        totalListeningMinutes: this.analytics.totalListeningMinutes,
        sessionsCount: this.analytics.sessionsCount,
        maxPagesPerHour: this.analytics.maxPagesPerHour,
        longestSessionMinutes: this.analytics.longestSessionMinutes,
        averageSessionMinutes: this.analytics.sessionsCount > 0 ? Math.round(this.analytics.totalReadingMinutes / this.analytics.sessionsCount) : 0,
        formatBreakdown: formatBreakdown.counts,
        genreBreakdown: this.analytics.genreBreakdown
      },
      streaks: {
        current: this.streaks.current,
        longest: this.streaks.longest,
        lastReadDate: this.streaks.lastReadDate
      },
      goals: readingGoals,
      badges: this.getBadges(),
      badgesEarned: this.badges.length,
      totalBadgesAvailable: Object.keys(this.availableBadges).length,
      clubs: this.getBookClubs(),
      clubCount: this.bookClubs.length,
      lending: {
        active: activeLendings.length,
        overdue: overdueLendings.length,
        totalLendings: this.lendings.length,
        activeLendings: activeLendings.map(function(l) { return { bookTitle: l.bookTitle, borrower: l.borrower, dueDate: l.dueDate }; }),
        overdueLendings: overdueLendings.map(function(l) { return { bookTitle: l.bookTitle, borrower: l.borrower, dueDate: l.dueDate }; })
      },
      collectionValue: {
        totalValueSEK: collectionValue.totalValueSEK,
        averageValueSEK: collectionValue.averageValueSEK,
        physicalBookCount: collectionValue.physicalBookCount
      },
      conditions: conditionReport.summary,
      shelves: shelfUtilization,
      audiobooks: {
        count: audioStats.count,
        totalDurationHours: audioStats.totalDurationHours,
        totalListeningMinutes: audioStats.totalListeningMinutes
      },
      sessions: {
        total: this.readingSessions.length,
        recent: this.readingSessions.slice(-5).map(function(s) {
          return {
            bookTitle: s.bookTitle,
            pagesRead: s.pagesRead,
            durationMinutes: s.durationMinutes,
            pagesPerHour: s.pagesPerHour,
            date: s.endTime
          };
        })
      },
      activeSession: this.activeSession ? {
        bookTitle: this.activeSession.bookTitle,
        startTime: this.activeSession.startTime,
        format: this.activeSession.format
      } : null
    };
  }

  destroy() {
    for (var i = 0; i < this.intervals.length; i++) {
      clearInterval(this.intervals[i]);
    }
    this.intervals = [];
    this.activeSession = null;
    this.initialized = false;
    this.homey.log('[Library] HomeLibraryManagementSystem destroyed');
  }
}

module.exports = HomeLibraryManagementSystem;
