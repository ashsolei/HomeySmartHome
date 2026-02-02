'use strict';

/**
 * Smart Doorbell with Facial Recognition
 * Advanced doorbell with face recognition and smart features
 */
class SmartDoorbellFacialRecognition {
  constructor(app) {
    this.app = app;
    this.knownPeople = new Map();
    this.visitors = [];
    this.events = [];
    this.settings = {
      motionDetection: true,
      nightVision: true,
      recordingMode: 'motion',  // continuous, motion, doorbell
      resolution: '1080p',
      fieldOfView: 180,  // degrees
      audioEnabled: true
    };
  }

  async initialize() {
    await this.setupKnownPeople();
    await this.setupMotionZones();
    
    this.startMonitoring();
  }

  // ============================================
  // FACIAL RECOGNITION
  // ============================================

  async setupKnownPeople() {
    const people = [
      {
        id: 'person_anna',
        name: 'Anna',
        relation: 'family',
        faceData: 'face_data_anna_encoded',
        notifyOnArrival: false,
        autoUnlock: true,
        greeting: 'Välkommen hem Anna!'
      },
      {
        id: 'person_erik',
        name: 'Erik',
        relation: 'family',
        faceData: 'face_data_erik_encoded',
        notifyOnArrival: false,
        autoUnlock: true,
        greeting: 'Välkommen hem Erik!'
      },
      {
        id: 'person_emma',
        name: 'Emma',
        relation: 'family',
        faceData: 'face_data_emma_encoded',
        notifyOnArrival: false,
        autoUnlock: true,
        greeting: 'Hej Emma!'
      },
      {
        id: 'person_oscar',
        name: 'Oscar',
        relation: 'family',
        faceData: 'face_data_oscar_encoded',
        notifyOnArrival: false,
        autoUnlock: true,
        greeting: 'Hej Oscar!'
      },
      {
        id: 'person_mormorsa',
        name: 'Mormor Lisa',
        relation: 'extended_family',
        faceData: 'face_data_lisa_encoded',
        notifyOnArrival: true,
        autoUnlock: false,
        greeting: 'Välkommen Lisa!'
      },
      {
        id: 'person_friend_sara',
        name: 'Sara',
        relation: 'friend',
        faceData: 'face_data_sara_encoded',
        notifyOnArrival: true,
        autoUnlock: false,
        greeting: 'Hej Sara! Vänta, jag öppnar.'
      },
      {
        id: 'person_delivery_postnord',
        name: 'PostNord Driver',
        relation: 'service',
        faceData: 'face_data_postnord_encoded',
        notifyOnArrival: true,
        autoUnlock: false,
        greeting: 'Hej! Paket?'
      }
    ];

    for (const person of people) {
      this.knownPeople.set(person.id, person);
    }
  }

  async recognizeFace(imageData) {
    // Simulated facial recognition
    const knownPeople = Array.from(this.knownPeople.values());
    
    // 70% chance to recognize a known person
    if (Math.random() < 0.7) {
      const person = knownPeople[Math.floor(Math.random() * knownPeople.length)];
      
      console.log(`👤 Face recognized: ${person.name} (${person.relation})`);
      
      await this.handleKnownPerson(person);
      
      return {
        recognized: true,
        person: person.name,
        relation: person.relation,
        confidence: 0.85 + Math.random() * 0.15
      };
    } else {
      // Unknown person
      console.log('👤 Unknown person detected');
      
      await this.handleUnknownPerson(imageData);
      
      return {
        recognized: false,
        stranger: true
      };
    }
  }

  async handleKnownPerson(person) {
    console.log(`   Processing known person: ${person.name}`);

    // Greet the person
    if (person.greeting) {
      console.log(`   🔊 "${person.greeting}"`);
      await this.speak(person.greeting);
    }

    // Auto-unlock if enabled
    if (person.autoUnlock) {
      console.log('   🔓 Auto-unlocking door');
      await this.unlockDoor();
    }

    // Notify if requested
    if (person.notifyOnArrival) {
      await this.sendNotification(`${person.name} är vid dörren`);
    }

    // Log visit
    await this.logVisit({
      personId: person.id,
      name: person.name,
      relation: person.relation,
      recognized: true,
      timestamp: Date.now()
    });

    // Home automation
    if (person.relation === 'family') {
      console.log('   💡 Turning on entrance lights');
      console.log('   🌡️  Setting temperature to comfort mode');
    }
  }

  async handleUnknownPerson(imageData) {
    console.log('   Processing unknown person');

    // Record video
    console.log('   📹 Starting video recording');

    // Notify homeowners
    await this.sendNotification('⚠️ Okänd person vid dörren', 'high');

    // Take multiple photos
    console.log('   📸 Taking photos for identification');

    // Log visit
    await this.logVisit({
      personId: null,
      name: 'Unknown',
      relation: 'stranger',
      recognized: false,
      timestamp: Date.now()
    });

    // Enable two-way communication
    console.log('   🎤 Two-way audio ready');
  }

  async addKnownPerson(data) {
    const personId = 'person_' + Date.now();

    const person = {
      id: personId,
      name: data.name,
      relation: data.relation,
      faceData: data.faceData,
      notifyOnArrival: data.notifyOnArrival || false,
      autoUnlock: data.autoUnlock || false,
      greeting: data.greeting || `Hej ${data.name}!`
    };

    this.knownPeople.set(personId, person);

    console.log(`✅ Known person added: ${person.name}`);

    return { success: true, personId };
  }

  async removeKnownPerson(personId) {
    const person = this.knownPeople.get(personId);
    
    if (!person) {
      return { success: false, error: 'Person not found' };
    }

    this.knownPeople.delete(personId);

    console.log(`❌ Known person removed: ${person.name}`);

    return { success: true };
  }

  // ============================================
  // DOORBELL EVENTS
  // ============================================

  async handleDoorbellPress() {
    console.log('🔔 Doorbell pressed!');

    const event = {
      id: 'event_' + Date.now(),
      type: 'doorbell',
      timestamp: Date.now(),
      imageData: 'snapshot_data',
      videoUrl: null
    };

    // Take snapshot
    console.log('   📸 Taking snapshot');

    // Recognize face
    const recognition = await this.recognizeFace(event.imageData);
    event.recognition = recognition;

    // Start recording
    console.log('   📹 Recording video');
    event.videoUrl = `recording_${event.id}.mp4`;

    // Send notification
    if (recognition.recognized) {
      await this.sendNotification(`🔔 ${recognition.person} ringde på dörren`);
    } else {
      await this.sendNotification('🔔 Någon ringde på dörren');
    }

    // Play chime inside
    console.log('   🎵 Playing doorbell chime');

    this.events.push(event);

    return event;
  }

  // ============================================
  // MOTION DETECTION
  // ============================================

  async setupMotionZones() {
    this.motionZones = [
      {
        id: 'zone_entrance',
        name: 'Entrén',
        enabled: true,
        sensitivity: 'medium',
        area: { x: 0, y: 30, width: 100, height: 40 }
      },
      {
        id: 'zone_package',
        name: 'Paketlådor',
        enabled: true,
        sensitivity: 'high',
        area: { x: 70, y: 60, width: 30, height: 30 }
      },
      {
        id: 'zone_driveway',
        name: 'Uppfart',
        enabled: false,
        sensitivity: 'low',
        area: { x: 0, y: 0, width: 50, height: 30 }
      }
    ];
  }

  async detectMotion(zoneId) {
    const zone = this.motionZones.find(z => z.id === zoneId);
    
    if (!zone || !zone.enabled) {
      return { motionDetected: false };
    }

    console.log(`🎯 Motion detected in ${zone.name}`);

    const event = {
      id: 'motion_' + Date.now(),
      type: 'motion',
      zone: zone.name,
      timestamp: Date.now()
    };

    // Take snapshot
    console.log('   📸 Taking snapshot');

    // Try to recognize face
    const recognition = await this.recognizeFace('snapshot_data');
    event.recognition = recognition;

    // Record video if stranger
    if (!recognition.recognized) {
      console.log('   📹 Recording video (unknown person)');
      event.videoUrl = `motion_recording_${event.id}.mp4`;
      
      await this.sendNotification(`⚠️ Rörelse detekterad vid ${zone.name}`, 'medium');
    }

    this.events.push(event);

    return { motionDetected: true, event };
  }

  // ============================================
  // PACKAGE DETECTION
  // ============================================

  async detectPackage() {
    console.log('📦 Package detected on doorstep');

    const event = {
      id: 'package_' + Date.now(),
      type: 'package',
      timestamp: Date.now(),
      duration: 0  // How long package has been there
    };

    // Take photo of package
    console.log('   📸 Taking photo of package');

    // Notify
    await this.sendNotification('📦 Paket levererat till dörren');

    // Monitor package (check if removed/stolen)
    this.monitorPackage(event);

    this.events.push(event);

    return event;
  }

  async monitorPackage(packageEvent) {
    // Check every 5 minutes if package is still there
    const checkInterval = setInterval(async () => {
      packageEvent.duration += 5;

      // Alert if package left for > 30 minutes
      if (packageEvent.duration > 30) {
        await this.sendNotification('⚠️ Paket har stått vid dörren i 30 minuter', 'medium');
        clearInterval(checkInterval);
      }
    }, 5 * 60 * 1000);
  }

  // ============================================
  // TWO-WAY COMMUNICATION
  // ============================================

  async speak(message) {
    console.log(`🔊 Speaking: "${message}"`);
    return { success: true };
  }

  async enableTwoWayAudio() {
    console.log('🎤 Two-way audio enabled');
    console.log('   Microphone: active');
    console.log('   Speaker: active');
    
    return { success: true, status: 'active' };
  }

  async playPrerecordedMessage(messageId) {
    const messages = {
      msg_1: 'Hej! Lämna paketet vid dörren, tack!',
      msg_2: 'Vi är inte hemma just nu, kom tillbaka senare.',
      msg_3: 'Vänligen vänta, jag kommer om ett ögonblick.',
      msg_4: 'Ingen hemförsäljning, tack.'
    };

    const message = messages[messageId] || messages.msg_1;

    await this.speak(message);

    return { success: true, message };
  }

  // ============================================
  // DOOR CONTROL
  // ============================================

  async unlockDoor() {
    console.log('🔓 Unlocking door');
    
    // Temporary unlock (5 minutes)
    setTimeout(() => {
      console.log('🔒 Auto-locking door');
    }, 5 * 60 * 1000);

    return { success: true, duration: 300 };
  }

  async lockDoor() {
    console.log('🔒 Locking door');
    return { success: true };
  }

  // ============================================
  // VISITOR MANAGEMENT
  // ============================================

  async logVisit(data) {
    const visit = {
      id: 'visit_' + Date.now(),
      personId: data.personId,
      name: data.name,
      relation: data.relation,
      recognized: data.recognized,
      timestamp: data.timestamp,
      duration: null
    };

    this.visitors.push(visit);

    console.log(`📝 Visit logged: ${visit.name}`);

    return visit;
  }

  getVisitorHistory(days = 7) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    
    return this.visitors
      .filter(v => v.timestamp >= cutoff)
      .map(v => ({
        name: v.name,
        relation: v.relation,
        recognized: v.recognized,
        date: new Date(v.timestamp).toLocaleString('sv-SE')
      }));
  }

  getFrequentVisitors(days = 30) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    
    const visitors = this.visitors.filter(v => v.timestamp >= cutoff);
    
    const counts = {};
    visitors.forEach(v => {
      counts[v.name] = (counts[v.name] || 0) + 1;
    });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, visits: count }));
  }

  // ============================================
  // SMART FEATURES
  // ============================================

  async enableQuietMode(startTime, endTime) {
    console.log('🔕 Quiet mode enabled');
    console.log(`   Active: ${startTime} - ${endTime}`);
    console.log('   Doorbell chime: disabled');
    console.log('   Notifications: silent');
    console.log('   Recording: continues');

    return { success: true };
  }

  async setCustomGreeting(relation, greeting) {
    const people = Array.from(this.knownPeople.values())
      .filter(p => p.relation === relation);

    people.forEach(person => {
      person.greeting = greeting;
    });

    console.log(`✅ Custom greeting set for ${relation}: "${greeting}"`);

    return { success: true, count: people.length };
  }

  async analyzeVisitorPatterns() {
    const patterns = {
      peakHours: [9, 10, 11, 14, 15, 16, 17],  // Hours with most visitors
      commonRelations: {
        family: 45,
        friend: 30,
        service: 20,
        stranger: 5
      },
      averageVisitsPerDay: 3.2
    };

    console.log('📊 Visitor pattern analysis:');
    console.log(`   Peak hours: ${patterns.peakHours.join(', ')}`);
    console.log(`   Average visits/day: ${patterns.averageVisitsPerDay}`);

    return patterns;
  }

  // ============================================
  // MONITORING
  // ============================================

  startMonitoring() {
    // Simulate doorbell presses (random)
    setInterval(() => {
      if (Math.random() < 0.01) {  // 1% chance per minute
        this.handleDoorbellPress();
      }
    }, 60 * 1000);

    // Simulate motion detection
    setInterval(() => {
      if (Math.random() < 0.05) {  // 5% chance per minute
        this.detectMotion('zone_entrance');
      }
    }, 60 * 1000);

    console.log('🔔 Smart Doorbell active');
  }

  async sendNotification(message, priority = 'normal') {
    console.log(`📢 Notification [${priority}]: ${message}`);
    return { success: true };
  }

  // ============================================
  // REPORTING
  // ============================================

  getDoorbellOverview() {
    const events = this.events;
    const visitors = this.visitors;
    const recognized = visitors.filter(v => v.recognized).length;
    const unknown = visitors.filter(v => !v.recognized).length;

    return {
      knownPeople: this.knownPeople.size,
      totalEvents: events.length,
      totalVisitors: visitors.length,
      recognized,
      unknown,
      motionZones: this.motionZones.length
    };
  }

  getKnownPeopleList() {
    return Array.from(this.knownPeople.values()).map(p => ({
      name: p.name,
      relation: p.relation,
      autoUnlock: p.autoUnlock ? 'Yes' : 'No',
      notify: p.notifyOnArrival ? 'Yes' : 'No'
    }));
  }

  getRecentEvents(limit = 10) {
    return this.events
      .slice(-limit)
      .reverse()
      .map(e => ({
        type: e.type,
        time: new Date(e.timestamp).toLocaleString('sv-SE'),
        recognized: e.recognition?.recognized ? e.recognition.person : 'Unknown'
      }));
  }
}

module.exports = SmartDoorbellFacialRecognition;
