'use strict';
const logger = require('./logger');
const MAX_ENTRIES = 1000;

/**
 * Community Integration Hub
 * Neighborhood & local community integration
 */
class CommunityIntegrationHub {
  constructor(app) {
    this._intervals = [];
    this.app = app;
    this.neighbors = new Map();
    this.sharedResources = new Map();
    this.communityEvents = [];
    this.localServices = new Map();
    this.recommendations = [];
    this.transactions = [];
  }

  async initialize() {
    await this.setupNeighbors();
    await this.setupSharedResources();
    await this.setupLocalServices();
    await this.loadCommunityEvents();
    
    this.startMonitoring();
  }

  // ============================================
  // NEIGHBORS
  // ============================================

  async setupNeighbors() {
    const neighborsData = [
      {
        id: 'neighbor_1',
        name: 'Familjen Andersson',
        address: 'Storgatan 42A',
        distance: 50,  // meters
        contactEmail: 'andersson@example.com',
        contactPhone: '070-123 45 67',
        relationship: 'close',
        trustLevel: 0.95,
        interactions: 28,
        lastContact: Date.now() - 3 * 24 * 60 * 60 * 1000
      },
      {
        id: 'neighbor_2',
        name: 'Familjen Bergström',
        address: 'Storgatan 42C',
        distance: 100,
        contactEmail: 'bergstrom@example.com',
        contactPhone: '070-234 56 78',
        relationship: 'friendly',
        trustLevel: 0.85,
        interactions: 15,
        lastContact: Date.now() - 7 * 24 * 60 * 60 * 1000
      },
      {
        id: 'neighbor_3',
        name: 'Familjen Carlsson',
        address: 'Storgatan 44',
        distance: 150,
        contactEmail: 'carlsson@example.com',
        contactPhone: '070-345 67 89',
        relationship: 'acquaintance',
        trustLevel: 0.70,
        interactions: 8,
        lastContact: Date.now() - 14 * 24 * 60 * 60 * 1000
      },
      {
        id: 'neighbor_4',
        name: 'Familjen Davidsson',
        address: 'Storgatan 40',
        distance: 80,
        contactEmail: 'davidsson@example.com',
        contactPhone: '070-456 78 90',
        relationship: 'friendly',
        trustLevel: 0.80,
        interactions: 12,
        lastContact: Date.now() - 5 * 24 * 60 * 60 * 1000
      }
    ];

    for (const neighbor of neighborsData) {
      this.neighbors.set(neighbor.id, {
        ...neighbor,
        sharedResources: [],
        borrowedResources: [],
        favorsDone: 0,
        favorsReceived: 0
      });
    }
  }

  async addNeighbor(data) {
    const neighbor = {
      id: `neighbor_${Date.now()}`,
      ...data,
      relationship: 'acquaintance',
      trustLevel: 0.50,
      interactions: 0,
      lastContact: Date.now(),
      sharedResources: [],
      borrowedResources: [],
      favorsDone: 0,
      favorsReceived: 0
    };

    this.neighbors.set(neighbor.id, neighbor);

    logger.info(`👋 New neighbor added: ${neighbor.name}`);

    return neighbor;
  }

  async updateTrustLevel(neighborId, interaction) {
    const neighbor = this.neighbors.get(neighborId);
    
    if (!neighbor) {
      return { success: false, error: 'Neighbor not found' };
    }

    neighbor.interactions += 1;
    neighbor.lastContact = Date.now();

    // Update trust based on interaction type
    if (interaction === 'positive') {
      neighbor.trustLevel = Math.min(1.0, neighbor.trustLevel + 0.05);
      
      if (neighbor.trustLevel > 0.80 && neighbor.relationship === 'acquaintance') {
        neighbor.relationship = 'friendly';
      } else if (neighbor.trustLevel > 0.90 && neighbor.relationship === 'friendly') {
        neighbor.relationship = 'close';
      }
    } else if (interaction === 'negative') {
      neighbor.trustLevel = Math.max(0.0, neighbor.trustLevel - 0.10);
    }

    return { success: true, neighbor };
  }

  // ============================================
  // SHARED RESOURCES
  // ============================================

  async setupSharedResources() {
    const resourcesData = [
      {
        id: 'lawnmower',
        name: 'Gräsklippare',
        category: 'garden',
        owner: 'self',
        condition: 'good',
        availableForSharing: true,
        estimatedValue: 3500,
        sharedWith: [],
        borrowedBy: null,
        totalBorrows: 5
      },
      {
        id: 'ladder',
        name: 'Stege (6m)',
        category: 'tools',
        owner: 'self',
        condition: 'excellent',
        availableForSharing: true,
        estimatedValue: 2000,
        sharedWith: [],
        borrowedBy: null,
        totalBorrows: 8
      },
      {
        id: 'power_drill',
        name: 'Borrmaskin',
        category: 'tools',
        owner: 'neighbor_1',
        condition: 'good',
        availableForSharing: true,
        estimatedValue: 1500,
        sharedWith: ['self'],
        borrowedBy: null,
        totalBorrows: 3
      },
      {
        id: 'pressure_washer',
        name: 'Högtryckstvätt',
        category: 'cleaning',
        owner: 'neighbor_2',
        condition: 'good',
        availableForSharing: true,
        estimatedValue: 4000,
        sharedWith: ['self', 'neighbor_1'],
        borrowedBy: null,
        totalBorrows: 6
      },
      {
        id: 'trailer',
        name: 'Släpvagn',
        category: 'transport',
        owner: 'neighbor_4',
        condition: 'excellent',
        availableForSharing: true,
        estimatedValue: 15000,
        sharedWith: ['self'],
        borrowedBy: null,
        totalBorrows: 4
      }
    ];

    for (const resource of resourcesData) {
      this.sharedResources.set(resource.id, {
        ...resource,
        borrowHistory: []
      });
    }
  }

  async borrowResource(resourceId, days = 1) {
    const resource = this.sharedResources.get(resourceId);
    
    if (!resource) {
      return { success: false, error: 'Resource not found' };
    }

    if (resource.borrowedBy) {
      return { success: false, error: 'Resource already borrowed' };
    }

    if (!resource.availableForSharing) {
      return { success: false, error: 'Resource not available for sharing' };
    }

    const returnDate = Date.now() + days * 24 * 60 * 60 * 1000;

    resource.borrowedBy = 'self';
    resource.totalBorrows += 1;

    const transaction = {
      id: `borrow_${Date.now()}`,
      resourceId,
      resourceName: resource.name,
      borrower: 'self',
      owner: resource.owner,
      borrowDate: Date.now(),
      returnDate,
      status: 'borrowed'
    };

    this.transactions.push(transaction);
    if (this.transactions.length > MAX_ENTRIES) this.transactions.shift();
    resource.borrowHistory.push(transaction);

    // Update neighbor relationship
    if (resource.owner !== 'self') {
      await this.updateTrustLevel(resource.owner, 'positive');
      
      const neighbor = this.neighbors.get(resource.owner);
      if (neighbor) {
        neighbor.favorsReceived += 1;
      }
    }

    logger.info(`📦 Borrowed: ${resource.name} from ${resource.owner} (Return: ${new Date(returnDate).toLocaleDateString('sv-SE')})`);

    return { success: true, transaction };
  }

  async returnResource(resourceId) {
    const resource = this.sharedResources.get(resourceId);
    
    if (!resource) {
      return { success: false, error: 'Resource not found' };
    }

    if (resource.borrowedBy !== 'self') {
      return { success: false, error: 'Resource not borrowed by you' };
    }

    resource.borrowedBy = null;

    // Find and update transaction
    const transaction = this.transactions.find(t => 
      t.resourceId === resourceId && 
      t.status === 'borrowed'
    );

    if (transaction) {
      transaction.status = 'returned';
      transaction.actualReturnDate = Date.now();

      // Check if returned on time
      const onTime = transaction.actualReturnDate <= transaction.returnDate;
      
      if (resource.owner !== 'self') {
        await this.updateTrustLevel(resource.owner, onTime ? 'positive' : 'negative');
      }

      logger.info(`✅ Returned: ${resource.name} ${onTime ? 'on time' : 'late'}`);
    }

    return { success: true };
  }

  async shareResource(resourceName, category, estimatedValue) {
    const resource = {
      id: `resource_${Date.now()}`,
      name: resourceName,
      category,
      owner: 'self',
      condition: 'good',
      availableForSharing: true,
      estimatedValue,
      sharedWith: [],
      borrowedBy: null,
      totalBorrows: 0,
      borrowHistory: []
    };

    this.sharedResources.set(resource.id, resource);

    logger.info(`🎁 Shared resource: ${resourceName}`);

    return resource;
  }

  // ============================================
  // COMMUNITY EVENTS
  // ============================================

  async loadCommunityEvents() {
    const now = Date.now();

    this.communityEvents = [
      {
        id: 'event_1',
        name: 'Kvarterstädning',
        type: 'cleanup',
        organizer: 'neighbor_1',
        date: now + 5 * 24 * 60 * 60 * 1000,
        duration: 180, // minutes
        location: 'Kvarteret',
        participants: ['self', 'neighbor_1', 'neighbor_2'],
        maxParticipants: 15,
        status: 'upcoming'
      },
      {
        id: 'event_2',
        name: 'Grannmöte',
        type: 'meeting',
        organizer: 'neighbor_4',
        date: now + 10 * 24 * 60 * 60 * 1000,
        duration: 120,
        location: 'Föreningslokalen',
        participants: ['self', 'neighbor_1', 'neighbor_2', 'neighbor_4'],
        maxParticipants: 30,
        status: 'upcoming'
      },
      {
        id: 'event_3',
        name: 'Grannfest',
        type: 'social',
        organizer: 'neighbor_2',
        date: now + 20 * 24 * 60 * 60 * 1000,
        duration: 300,
        location: 'Gården',
        participants: ['self', 'neighbor_1', 'neighbor_2', 'neighbor_3', 'neighbor_4'],
        maxParticipants: 50,
        status: 'upcoming'
      }
    ];
  }

  async joinEvent(eventId) {
    const event = this.communityEvents.find(e => e.id === eventId);
    
    if (!event) {
      return { success: false, error: 'Event not found' };
    }

    if (event.participants.includes('self')) {
      return { success: false, error: 'Already joined' };
    }

    if (event.participants.length >= event.maxParticipants) {
      return { success: false, error: 'Event full' };
    }

    event.participants.push('self');

    logger.info(`🎉 Joined event: ${event.name}`);

    // Update neighbor relationships
    for (const participantId of event.participants) {
      if (participantId !== 'self' && this.neighbors.has(participantId)) {
        await this.updateTrustLevel(participantId, 'positive');
      }
    }

    return { success: true, event };
  }

  async createEvent(data) {
    const event = {
      id: `event_${Date.now()}`,
      name: data.name,
      type: data.type,
      organizer: 'self',
      date: data.date,
      duration: data.duration,
      location: data.location,
      participants: ['self'],
      maxParticipants: data.maxParticipants || 20,
      status: 'upcoming'
    };

    this.communityEvents.push(event);
    if (this.communityEvents.length > MAX_ENTRIES) this.communityEvents.shift();

    logger.info(`📅 Created event: ${event.name}`);

    return event;
  }

  // ============================================
  // LOCAL SERVICES
  // ============================================

  async setupLocalServices() {
    const servicesData = [
      {
        id: 'plumber',
        name: 'Rörmokare Stockholm',
        category: 'plumbing',
        rating: 4.5,
        reviews: 87,
        priceLevel: 'medium',
        distance: 2.5, // km
        phone: '08-123 456 78',
        recommended: true,
        usedBy: ['neighbor_1', 'neighbor_2']
      },
      {
        id: 'electrician',
        name: 'Elservice Syd',
        category: 'electrical',
        rating: 4.8,
        reviews: 134,
        priceLevel: 'high',
        distance: 1.8,
        phone: '08-234 567 89',
        recommended: true,
        usedBy: ['neighbor_1', 'neighbor_4']
      },
      {
        id: 'handyman',
        name: 'Allround Hantverkare',
        category: 'general',
        rating: 4.3,
        reviews: 56,
        priceLevel: 'low',
        distance: 3.2,
        phone: '08-345 678 90',
        recommended: true,
        usedBy: ['neighbor_2', 'neighbor_3']
      },
      {
        id: 'gardener',
        name: 'Trädgårdsmästaren',
        category: 'garden',
        rating: 4.6,
        reviews: 92,
        priceLevel: 'medium',
        distance: 4.0,
        phone: '08-456 789 01',
        recommended: true,
        usedBy: ['neighbor_1']
      },
      {
        id: 'cleaner',
        name: 'Städfirman AB',
        category: 'cleaning',
        rating: 4.4,
        reviews: 178,
        priceLevel: 'medium',
        distance: 1.2,
        phone: '08-567 890 12',
        recommended: false,
        usedBy: []
      },
      {
        id: 'grocery',
        name: 'ICA Supermarket',
        category: 'shopping',
        rating: 4.2,
        reviews: 456,
        priceLevel: 'medium',
        distance: 0.8,
        phone: '08-678 901 23',
        recommended: true,
        usedBy: ['self', 'neighbor_1', 'neighbor_2', 'neighbor_3', 'neighbor_4']
      },
      {
        id: 'hardware',
        name: 'Bauhaus',
        category: 'hardware',
        rating: 4.1,
        reviews: 234,
        priceLevel: 'medium',
        distance: 3.5,
        phone: '08-789 012 34',
        recommended: true,
        usedBy: ['self', 'neighbor_1', 'neighbor_4']
      }
    ];

    for (const service of servicesData) {
      this.localServices.set(service.id, {
        ...service,
        timesUsed: 0,
        lastUsed: null
      });
    }
  }

  async recommendService(category) {
    const services = Array.from(this.localServices.values())
      .filter(s => s.category === category)
      .sort((a, b) => {
        // Sort by rating, then by recommendations from neighbors
        const scoreA = a.rating * 10 + a.usedBy.length * 2;
        const scoreB = b.rating * 10 + b.usedBy.length * 2;
        return scoreB - scoreA;
      });

    if (services.length > 0) {
      return {
        primary: services[0],
        alternatives: services.slice(1, 3),
        neighborsRecommendations: services[0].usedBy.length
      };
    }

    return null;
  }

  async useService(serviceId) {
    const service = this.localServices.get(serviceId);
    
    if (!service) {
      return { success: false, error: 'Service not found' };
    }

    service.timesUsed += 1;
    service.lastUsed = Date.now();
    
    if (!service.usedBy.includes('self')) {
      service.usedBy.push('self');
    }

    logger.info(`🛠️ Used service: ${service.name}`);

    return { success: true, service };
  }

  // ============================================
  // RECOMMENDATIONS
  // ============================================

  async generateRecommendations() {
    const recommendations = [];

    // Recommend connecting with nearby neighbors
    const neighbors = Array.from(this.neighbors.values());
    const lowInteractionNeighbors = neighbors.filter(n => 
      n.interactions < 5 && 
      n.distance < 200
    );

    if (lowInteractionNeighbors.length > 0) {
      recommendations.push({
        type: 'neighbor',
        priority: 'medium',
        title: 'Träffa grannar',
        description: `${lowInteractionNeighbors.length} närliggande grannar att lära känna`,
        actions: lowInteractionNeighbors.map(n => `Säg hej till ${n.name}`)
      });
    }

    // Recommend sharing resources
    const unusedResources = Array.from(this.sharedResources.values()).filter(r => 
      r.owner === 'self' && 
      r.totalBorrows < 3
    );

    if (unusedResources.length > 0) {
      recommendations.push({
        type: 'sharing',
        priority: 'low',
        title: 'Dela resurser',
        description: 'Outnyttjade verktyg och utrustning',
        actions: unusedResources.map(r => `Erbjud att dela ${r.name}`)
      });
    }

    // Recommend upcoming events
    const upcomingEvents = this.communityEvents.filter(e => 
      e.status === 'upcoming' && 
      !e.participants.includes('self') &&
      e.date > Date.now()
    );

    if (upcomingEvents.length > 0) {
      recommendations.push({
        type: 'event',
        priority: 'high',
        title: 'Gå med i evenemang',
        description: `${upcomingEvents.length} kommande grannaktiviteter`,
        actions: upcomingEvents.map(e => `Gå med i ${e.name}`)
      });
    }

    // Recommend local services
    const unusedServices = Array.from(this.localServices.values()).filter(s => 
      s.recommended && 
      s.usedBy.length > 2 &&
      !s.usedBy.includes('self')
    );

    if (unusedServices.length > 0) {
      recommendations.push({
        type: 'service',
        priority: 'low',
        title: 'Lokala tjänster',
        description: 'Högt betygsatta tjänster i området',
        actions: unusedServices.slice(0, 3).map(s => `Prova ${s.name} (${s.rating}⭐)`)
      });
    }

    this.recommendations = recommendations;

    return recommendations;
  }

  // ============================================
  // MONITORING
  // ============================================

  startMonitoring() {
    // Check borrowed resources daily
    this._intervals.push(setInterval(() => {
      this.checkBorrowedResources();
    }, 24 * 60 * 60 * 1000));

    // Check upcoming events daily
    this._intervals.push(setInterval(() => {
      this.checkUpcomingEvents();
    }, 24 * 60 * 60 * 1000));

    // Generate weekly recommendations
    this._intervals.push(setInterval(() => {
      const day = new Date().getDay();
      if (day === 0) { // Sunday
        this.generateRecommendations();
      }
    }, 24 * 60 * 60 * 1000));

    // Initial recommendations
    this.generateRecommendations();
  }

  async checkBorrowedResources() {
    logger.info('📦 Checking borrowed resources...');

    const now = Date.now();
    const oneDayWarning = 24 * 60 * 60 * 1000;

    for (const transaction of this.transactions) {
      if (transaction.status !== 'borrowed') continue;

      const timeUntilReturn = transaction.returnDate - now;

      if (timeUntilReturn <= 0) {
        logger.info(`  ⚠️ OVERDUE: ${transaction.resourceName}`);
      } else if (timeUntilReturn <= oneDayWarning) {
        logger.info(`  📅 Due tomorrow: ${transaction.resourceName}`);
      }
    }
  }

  async checkUpcomingEvents() {
    logger.info('📅 Checking upcoming events...');

    const now = Date.now();
    const threeDayWarning = 3 * 24 * 60 * 60 * 1000;

    for (const event of this.communityEvents) {
      if (event.status !== 'upcoming') continue;
      if (!event.participants.includes('self')) continue;

      const timeUntilEvent = event.date - now;

      if (timeUntilEvent <= 0) {
        event.status = 'completed';
        logger.info(`  ✅ Event completed: ${event.name}`);
      } else if (timeUntilEvent <= threeDayWarning) {
        const daysUntil = Math.ceil(timeUntilEvent / (24 * 60 * 60 * 1000));
        logger.info(`  📅 Upcoming: ${event.name} (${daysUntil} days)`);
      }
    }
  }

  // ============================================
  // REPORTING
  // ============================================

  getCommunityOverview() {
    const totalNeighbors = this.neighbors.size;
    const closeNeighbors = Array.from(this.neighbors.values()).filter(n => n.relationship === 'close').length;
    const sharedResources = Array.from(this.sharedResources.values()).filter(r => r.owner === 'self').length;
    const borrowedResources = this.transactions.filter(t => t.status === 'borrowed').length;
    const upcomingEvents = this.communityEvents.filter(e => e.status === 'upcoming' && e.participants.includes('self')).length;

    return {
      totalNeighbors,
      closeNeighbors,
      sharedResources,
      borrowedResources,
      upcomingEvents,
      recommendations: this.recommendations.length
    };
  }

  getNeighborsList() {
    return Array.from(this.neighbors.values())
      .sort((a, b) => b.trustLevel - a.trustLevel)
      .map(n => ({
        name: n.name,
        relationship: n.relationship,
        distance: n.distance + 'm',
        interactions: n.interactions,
        trustLevel: (n.trustLevel * 100).toFixed(0) + '%'
      }));
  }

  getSharedResourcesList() {
    return Array.from(this.sharedResources.values())
      .filter(r => r.availableForSharing)
      .map(r => ({
        name: r.name,
        owner: r.owner === 'self' ? 'You' : this.neighbors.get(r.owner)?.name || r.owner,
        status: r.borrowedBy ? 'Borrowed' : 'Available',
        timesShared: r.totalBorrows
      }));
  }

  getUpcomingEvents() {
    return this.communityEvents
      .filter(e => e.status === 'upcoming')
      .sort((a, b) => a.date - b.date)
      .map(e => ({
        name: e.name,
        date: new Date(e.date).toLocaleDateString('sv-SE'),
        location: e.location,
        participants: e.participants.length + '/' + e.maxParticipants,
        joined: e.participants.includes('self')
      }));
  }

  getLocalServiceRecommendations() {
    return Array.from(this.localServices.values())
      .filter(s => s.recommended)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 5)
      .map(s => ({
        name: s.name,
        category: s.category,
        rating: s.rating + '⭐',
        distance: s.distance + ' km',
        recommendedBy: s.usedBy.length + ' neighbors'
      }));
  }

  destroy() {
    if (this._intervals) {
      this._intervals.forEach(id => clearInterval(id));
      this._intervals = [];
    }
  }
}

module.exports = CommunityIntegrationHub;
