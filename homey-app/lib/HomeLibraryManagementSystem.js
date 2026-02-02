'use strict';

const EventEmitter = require('events');
const Homey = require('homey');

/**
 * Home Library Management System
 * 
 * Digital library catalog with book tracking, reading goals, and recommendation engine.
 * 
 * @extends EventEmitter
 */
class HomeLibraryManagementSystem extends EventEmitter {
  constructor() {
    super();
    
    this.books = new Map();
    this.readingList = [];
    this.readingSessions = [];
    this.readingGoals = [];
    this.bookCategories = new Map();
    
    this.settings = {
      readingGoalAnnual: 24, // books per year
      reminderEnabled: true,
      catalogOrganization: 'genre', // genre, author, alphabetical
      loanTrackingEnabled: true
    };
    
    this.cache = { data: new Map(), timestamps: new Map(), ttl: 5 * 60 * 1000 };
    this.monitoring = { interval: null, checkInterval: 24 * 60 * 60 * 1000, lastCheck: null }; // Daily
    
    this.initializeDefaultData();
  }
  
  initializeDefaultData() {
    this.books.set('book-001', {
      id: 'book-001',
      title: 'The Pragmatic Programmer',
      author: 'Andrew Hunt, David Thomas',
      isbn: '9780135957059',
      genre: 'Technology',
      subgenre: 'Software Development',
      publishYear: 2019,
      pages: 352,
      language: 'English',
      format: 'hardcover',
      location: 'Shelf A-3',
      status: 'available',
      condition: 'excellent',
      purchaseDate: Date.now() - 400 * 24 * 60 * 60 * 1000,
      purchasePrice: 299, // SEK
      rating: 5,
      timesRead: 2,
      lastRead: Date.now() - 180 * 24 * 60 * 60 * 1000,
      notes: ['Excellent reference, re-read annually'],
      loanedTo: null
    });
    
    this.books.set('book-002', {
      id: 'book-002',
      title: 'Sapiens: A Brief History of Humankind',
      author: 'Yuval Noah Harari',
      isbn: '9780062316097',
      genre: 'Non-Fiction',
      subgenre: 'History',
      publishYear: 2015,
      pages: 443,
      language: 'English',
      format: 'paperback',
      location: 'Shelf B-1',
      status: 'reading',
      condition: 'good',
      purchaseDate: Date.now() - 90 * 24 * 60 * 60 * 1000,
      purchasePrice: 149,
      rating: null,
      timesRead: 0,
      lastRead: Date.now() - 3 * 24 * 60 * 60 * 1000,
      currentPage: 187,
      notes: [],
      loanedTo: null
    });
    
    this.books.set('book-003', {
      id: 'book-003',
      title: 'Project Hail Mary',
      author: 'Andy Weir',
      isbn: '9780593135204',
      genre: 'Fiction',
      subgenre: 'Science Fiction',
      publishYear: 2021,
      pages: 476,
      language: 'English',
      format: 'hardcover',
      location: 'Shelf C-2',
      status: 'available',
      condition: 'excellent',
      purchaseDate: Date.now() - 60 * 24 * 60 * 60 * 1000,
      purchasePrice: 279,
      rating: 5,
      timesRead: 1,
      lastRead: Date.now() - 30 * 24 * 60 * 60 * 1000,
      notes: ['Incredible read, highly recommended'],
      loanedTo: null
    });
    
    this.readingList.push(
      { id: 'wishlist-001', title: 'Atomic Habits', author: 'James Clear', priority: 'high', addedDate: Date.now() - 10 * 24 * 60 * 60 * 1000 },
      { id: 'wishlist-002', title: 'The Three-Body Problem', author: 'Liu Cixin', priority: 'medium', addedDate: Date.now() - 20 * 24 * 60 * 60 * 1000 }
    );
    
    this.readingSessions.push({
      id: 'session-001',
      bookId: 'book-002',
      startTime: Date.now() - 2 * 60 * 60 * 1000,
      endTime: Date.now() - 60 * 60 * 1000,
      pagesRead: 23,
      duration: 60, // minutes
      location: 'Living Room Couch'
    });
    
    this.readingGoals.push({
      id: 'goal-2026',
      year: 2026,
      targetBooks: 24,
      booksRead: 3,
      startDate: Date.now() - 31 * 24 * 60 * 60 * 1000,
      status: 'active'
    });
    
    this.bookCategories.set('Technology', { count: 1, shelf: 'A' });
    this.bookCategories.set('Non-Fiction', { count: 1, shelf: 'B' });
    this.bookCategories.set('Fiction', { count: 1, shelf: 'C' });
  }
  
  async initialize() {
    try {
      await this.loadSettings();
      this.startMonitoring();
      
      this.emit('notification', {
        type: 'info',
        priority: 'low',
        title: 'Library System',
        message: `Library system initialized with ${this.books.size} books`
      });
      
      return { success: true, books: this.books.size };
    } catch (error) {
      this.emit('notification', {
        type: 'error',
        priority: 'high',
        title: 'Library System Error',
        message: `Failed to initialize: ${error.message}`
      });
      throw error;
    }
  }
  
  async startReadingSession(bookId) {
    const book = this.books.get(bookId);
    if (!book) throw new Error(`Book ${bookId} not found`);
    
    if (book.status !== 'available' && book.status !== 'reading') {
      throw new Error(`Book is ${book.status}`);
    }
    
    book.status = 'reading';
    book.lastRead = Date.now();
    
    const session = {
      id: `session-${Date.now()}`,
      bookId,
      startTime: Date.now(),
      endTime: null,
      pagesRead: 0,
      duration: null,
      location: 'Home'
    };
    
    this.readingSessions.unshift(session);
    
    this.emit('notification', {
      type: 'info',
      priority: 'low',
      title: 'Reading Started',
      message: `Started reading "${book.title}"`
    });
    
    await this.saveSettings();
    return { success: true, book: book.title, session: session.id };
  }
  
  async endReadingSession(sessionId, pagesRead) {
    const session = this.readingSessions.find(s => s.id === sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    
    const book = this.books.get(session.bookId);
    if (!book) return;
    
    session.endTime = Date.now();
    session.duration = Math.round((session.endTime - session.startTime) / 60000);
    session.pagesRead = pagesRead;
    
    if (book.currentPage) {
      book.currentPage += pagesRead;
    } else {
      book.currentPage = pagesRead;
    }
    
    // Check if book finished
    if (book.currentPage >= book.pages) {
      book.status = 'available';
      book.timesRead++;
      book.currentPage = book.pages;
      
      this.emit('notification', {
        type: 'success',
        priority: 'medium',
        title: 'Book Finished!',
        message: `Completed "${book.title}". Time to rate it!`
      });
      
      // Update reading goal
      const currentYear = new Date().getFullYear();
      const goal = this.readingGoals.find(g => g.year === currentYear && g.status === 'active');
      if (goal) {
        goal.booksRead++;
      }
    } else {
      book.status = 'available';
    }
    
    this.emit('notification', {
      type: 'info',
      priority: 'low',
      title: 'Reading Session Complete',
      message: `Read ${pagesRead} pages in ${session.duration} minutes`
    });
    
    await this.saveSettings();
    this.clearCache();
    
    return { success: true, pagesRead, duration: session.duration, bookFinished: book.currentPage >= book.pages };
  }
  
  async rateBook(bookId, rating, review = null) {
    const book = this.books.get(bookId);
    if (!book) throw new Error(`Book ${bookId} not found`);
    
    book.rating = Math.max(1, Math.min(5, rating));
    if (review) {
      book.notes.push(review);
    }
    
    this.emit('notification', {
      type: 'success',
      priority: 'low',
      title: 'Book Rated',
      message: `"${book.title}" rated ${book.rating}/5 stars`
    });
    
    await this.saveSettings();
    return { success: true, book: book.title, rating: book.rating };
  }
  
  async loanBook(bookId, borrowerName) {
    const book = this.books.get(bookId);
    if (!book) throw new Error(`Book ${bookId} not found`);
    
    if (book.status !== 'available') {
      throw new Error(`Book is currently ${book.status}`);
    }
    
    book.status = 'loaned';
    book.loanedTo = {
      name: borrowerName,
      loanDate: Date.now(),
      dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days
    };
    
    this.emit('notification', {
      type: 'warning',
      priority: 'medium',
      title: 'Book Loaned',
      message: `"${book.title}" loaned to ${borrowerName} (due in 30 days)`
    });
    
    await this.saveSettings();
    return { success: true, book: book.title, borrower: borrowerName };
  }
  
  async returnBook(bookId) {
    const book = this.books.get(bookId);
    if (!book) throw new Error(`Book ${bookId} not found`);
    
    if (book.status !== 'loaned') {
      throw new Error('Book is not loaned out');
    }
    
    const borrower = book.loanedTo.name;
    book.status = 'available';
    book.loanedTo = null;
    
    this.emit('notification', {
      type: 'success',
      priority: 'low',
      title: 'Book Returned',
      message: `"${book.title}" returned by ${borrower}`
    });
    
    await this.saveSettings();
    return { success: true, book: book.title };
  }
  
  getBookRecommendations(options = {}) {
    const { genre, minRating = 4 } = options;
    
    let books = Array.from(this.books.values());
    
    // Filter by genre if specified
    if (genre) {
      books = books.filter(b => b.genre === genre);
    }
    
    // Filter by rating
    books = books.filter(b => b.rating !== null && b.rating >= minRating);
    
    // Sort by rating and times read
    books.sort((a, b) => {
      if (a.rating !== b.rating) return b.rating - a.rating;
      return a.timesRead - b.timesRead; // Prefer books read fewer times
    });
    
    return books.slice(0, 5);
  }
  
  getLibraryStatistics() {
    const cached = this.getCached('library-stats');
    if (cached) return cached;
    
    const books = Array.from(this.books.values());
    const completedSessions = this.readingSessions.filter(s => s.endTime !== null);
    const currentYear = new Date().getFullYear();
    const goal = this.readingGoals.find(g => g.year === currentYear && g.status === 'active');
    
    const totalPages = books.reduce((sum, b) => sum + b.pages, 0);
    const totalValue = books.reduce((sum, b) => sum + (b.purchasePrice || 0), 0);
    const pagesReadTotal = completedSessions.reduce((sum, s) => sum + s.pagesRead, 0);
    
    const stats = {
      collection: {
        totalBooks: this.books.size,
        totalPages,
        totalValue: Math.round(totalValue),
        averagePages: books.length > 0 ? Math.round(totalPages / books.length) : 0,
        byGenre: this.getCategoryBreakdown(),
        byFormat: this.getFormatBreakdown()
      },
      reading: {
        currentlyReading: books.filter(b => b.status === 'reading').length,
        completed: books.filter(b => b.timesRead > 0).length,
        totalSessions: completedSessions.length,
        totalPagesRead: pagesReadTotal,
        averageSessionMinutes: completedSessions.length > 0
          ? Math.round(completedSessions.reduce((sum, s) => sum + s.duration, 0) / completedSessions.length)
          : 0
      },
      goals: {
        yearlyTarget: goal ? goal.targetBooks : this.settings.readingGoalAnnual,
        booksRead: goal ? goal.booksRead : 0,
        progress: goal ? Math.round((goal.booksRead / goal.targetBooks) * 100) : 0,
        onTrack: goal ? this.isReadingOnTrack(goal) : false
      },
      loans: {
        booksLoaned: books.filter(b => b.status === 'loaned').length,
        overdueLoans: books.filter(b => b.status === 'loaned' && b.loanedTo.dueDate < Date.now()).length
      },
      wishlist: {
        books: this.readingList.length,
        highPriority: this.readingList.filter(w => w.priority === 'high').length
      }
    };
    
    this.setCached('library-stats', stats);
    return stats;
  }
  
  getCategoryBreakdown() {
    const breakdown = {};
    for (const [id, book] of this.books) {
      breakdown[book.genre] = (breakdown[book.genre] || 0) + 1;
    }
    return breakdown;
  }
  
  getFormatBreakdown() {
    const breakdown = {};
    for (const [id, book] of this.books) {
      breakdown[book.format] = (breakdown[book.format] || 0) + 1;
    }
    return breakdown;
  }
  
  isReadingOnTrack(goal) {
    const now = new Date();
    const yearStart = new Date(goal.year, 0, 1);
    const yearEnd = new Date(goal.year, 11, 31);
    const yearProgress = (now - yearStart) / (yearEnd - yearStart);
    const expectedBooks = Math.floor(goal.targetBooks * yearProgress);
    
    return goal.booksRead >= expectedBooks;
  }
  
  startMonitoring() {
    if (this.monitoring.interval) clearInterval(this.monitoring.interval);
    this.monitoring.interval = setInterval(() => this.monitorLibrary(), this.monitoring.checkInterval);
  }
  
  monitorLibrary() {
    this.monitoring.lastCheck = Date.now();
    
    // Check overdue loans
    for (const [id, book] of this.books) {
      if (book.status === 'loaned' && book.loanedTo.dueDate < Date.now()) {
        const daysOverdue = Math.floor((Date.now() - book.loanedTo.dueDate) / (24 * 60 * 60 * 1000));
        this.emit('notification', {
          type: 'warning',
          priority: 'high',
          title: 'Overdue Loan',
          message: `"${book.title}" loaned to ${book.loanedTo.name} is ${daysOverdue} days overdue`
        });
      }
    }
    
    // Check reading goal progress
    const currentYear = new Date().getFullYear();
    const goal = this.readingGoals.find(g => g.year === currentYear && g.status === 'active');
    if (goal && !this.isReadingOnTrack(goal)) {
      this.emit('notification', {
        type: 'info',
        priority: 'low',
        title: 'Reading Goal Update',
        message: `Behind on reading goal: ${goal.booksRead}/${goal.targetBooks} books this year`
      });
    }
  }
  
  getCached(key) {
    const cached = this.cache.data.get(key);
    const timestamp = this.cache.timestamps.get(key);
    if (cached && timestamp && (Date.now() - timestamp < this.cache.ttl)) return cached;
    return null;
  }
  
  setCached(key, value) {
    this.cache.data.set(key, value);
    this.cache.timestamps.set(key, Date.now());
  }
  
  clearCache() {
    this.cache.data.clear();
    this.cache.timestamps.clear();
  }
  
  async loadSettings() {
    try {
      const settings = Homey.ManagerSettings.get('homeLibraryManagementSystem');
      if (settings) {
        this.books = new Map(settings.books || []);
        this.readingList = settings.readingList || [];
        this.readingSessions = settings.readingSessions || [];
        this.readingGoals = settings.readingGoals || [];
        this.bookCategories = new Map(settings.bookCategories || []);
        Object.assign(this.settings, settings.settings || {});
      }
    } catch (error) {
      console.error('Failed to load library settings:', error);
    }
  }
  
  async saveSettings() {
    try {
      const settings = {
        books: Array.from(this.books.entries()),
        readingList: this.readingList,
        readingSessions: this.readingSessions,
        readingGoals: this.readingGoals,
        bookCategories: Array.from(this.bookCategories.entries()),
        settings: this.settings
      };
      Homey.ManagerSettings.set('homeLibraryManagementSystem', settings);
    } catch (error) {
      console.error('Failed to save library settings:', error);
      throw error;
    }
  }
  
  getBooks(options = {}) {
    let books = Array.from(this.books.values());
    
    if (options.genre) {
      books = books.filter(b => b.genre === options.genre);
    }
    
    if (options.status) {
      books = books.filter(b => b.status === options.status);
    }
    
    if (options.author) {
      books = books.filter(b => b.author.toLowerCase().includes(options.author.toLowerCase()));
    }
    
    return books;
  }
  
  getReadingList() { return this.readingList; }
  getReadingSessions(limit = 50) { return this.readingSessions.slice(0, limit); }
  getReadingGoals() { return this.readingGoals; }
}

module.exports = HomeLibraryManagementSystem;
