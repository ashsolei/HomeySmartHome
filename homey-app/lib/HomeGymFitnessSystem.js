const EventEmitter = require('events');

/**
 * Home Gym & Fitness Tracking System
 * 
 * Provides comprehensive fitness tracking, workout planning, equipment control,
 * and health monitoring for home gym setups.
 * 
 * Features:
 * - Workout session tracking with exercise logging
 * - Equipment control (treadmill, bike, weights, mirrors)
 * - Heart rate monitoring and zone tracking
 * - Workout program recommendations
 * - Progress tracking and goal management
 * - Integration with smart mirrors and fitness apps
 * - Automatic climate control during workouts
 * - Music/video playlist management for workouts
 * - Form tracking with AI camera analysis
 * - Calorie tracking and nutrition integration
 */
class HomeGymFitnessSystem extends EventEmitter {
  constructor(homey) {
    super();
    this.homey = homey;
    this.workoutSessions = [];
    this.equipment = new Map();
    this.workoutPrograms = new Map();
    this.userProfiles = new Map();
    this.activeSession = null;
    this.monitoringInterval = null;
  }

  async initialize() {
    this.homey.log('Initializing Home Gym & Fitness System...');
    
    await this.loadSettings();
    this.initializeDefaultEquipment();
    this.initializeWorkoutPrograms();
    this.initializeUserProfiles();
    
    this.startMonitoring();
    
    this.homey.log('Home Gym & Fitness System initialized successfully');
    return true;
  }

  async loadSettings() {
    const settings = await this.homey.settings.get('homeGymFitness') || {};
    this.workoutSessions = settings.workoutSessions || [];
    
    if (settings.equipment) {
      settings.equipment.forEach(eq => {
        this.equipment.set(eq.id, eq);
      });
    }
    
    if (settings.workoutPrograms) {
      settings.workoutPrograms.forEach(prog => {
        this.workoutPrograms.set(prog.id, prog);
      });
    }
    
    if (settings.userProfiles) {
      settings.userProfiles.forEach(profile => {
        this.userProfiles.set(profile.userId, profile);
      });
    }
    
    this.activeSession = settings.activeSession || null;
  }

  async saveSettings() {
    const settings = {
      workoutSessions: this.workoutSessions.slice(-100), // Keep last 100 sessions
      equipment: Array.from(this.equipment.values()),
      workoutPrograms: Array.from(this.workoutPrograms.values()),
      userProfiles: Array.from(this.userProfiles.values()),
      activeSession: this.activeSession
    };
    
    await this.homey.settings.set('homeGymFitness', settings);
  }

  initializeDefaultEquipment() {
    if (this.equipment.size === 0) {
      this.equipment.set('treadmill-1', {
        id: 'treadmill-1',
        name: 'Smart Treadmill',
        type: 'treadmill',
        status: 'idle',
        capabilities: {
          speed: { min: 0, max: 20, current: 0, unit: 'km/h' },
          incline: { min: 0, max: 15, current: 0, unit: '%' },
          heartRate: true,
          programs: ['interval', 'hill', 'fat-burn', 'endurance']
        },
        lastUsed: null,
        totalDistance: 0,
        totalTime: 0
      });

      this.equipment.set('bike-1', {
        id: 'bike-1',
        name: 'Exercise Bike',
        type: 'bike',
        status: 'idle',
        capabilities: {
          resistance: { min: 1, max: 20, current: 5, unit: 'level' },
          rpm: { current: 0 },
          heartRate: true,
          programs: ['climbing', 'sprint', 'recovery']
        },
        lastUsed: null,
        totalDistance: 0,
        totalTime: 0
      });

      this.equipment.set('weights-1', {
        id: 'weights-1',
        name: 'Smart Weight Set',
        type: 'weights',
        status: 'idle',
        capabilities: {
          adjustableWeight: { min: 2, max: 50, current: 10, unit: 'kg' },
          repCounter: true,
          formAnalysis: true
        },
        lastUsed: null,
        totalReps: 0,
        totalSets: 0
      });

      this.equipment.set('mirror-1', {
        id: 'mirror-1',
        name: 'Smart Fitness Mirror',
        type: 'mirror',
        status: 'off',
        capabilities: {
          videoStreaming: true,
          formTracking: true,
          heartRateDisplay: true,
          workoutLibrary: true
        },
        lastUsed: null
      });
    }
  }

  initializeWorkoutPrograms() {
    if (this.workoutPrograms.size === 0) {
      this.workoutPrograms.set('beginner-cardio', {
        id: 'beginner-cardio',
        name: 'Beginner Cardio',
        type: 'cardio',
        difficulty: 'beginner',
        duration: 30,
        equipment: ['treadmill-1'],
        phases: [
          { name: 'Warm-up', duration: 5, intensity: 'low', speed: 5, incline: 0 },
          { name: 'Main', duration: 20, intensity: 'moderate', speed: 8, incline: 2 },
          { name: 'Cool-down', duration: 5, intensity: 'low', speed: 4, incline: 0 }
        ],
        caloriesEstimate: 250
      });

      this.workoutPrograms.set('hiit-advanced', {
        id: 'hiit-advanced',
        name: 'Advanced HIIT',
        type: 'hiit',
        difficulty: 'advanced',
        duration: 45,
        equipment: ['treadmill-1', 'weights-1'],
        phases: [
          { name: 'Warm-up', duration: 5, intensity: 'low' },
          { name: 'HIIT Round 1', duration: 10, intensity: 'high', intervals: 8 },
          { name: 'Recovery', duration: 5, intensity: 'low' },
          { name: 'Strength', duration: 15, intensity: 'moderate' },
          { name: 'HIIT Round 2', duration: 5, intensity: 'very-high', intervals: 4 },
          { name: 'Cool-down', duration: 5, intensity: 'low' }
        ],
        caloriesEstimate: 500
      });

      this.workoutPrograms.set('strength-training', {
        id: 'strength-training',
        name: 'Full Body Strength',
        type: 'strength',
        difficulty: 'intermediate',
        duration: 60,
        equipment: ['weights-1', 'mirror-1'],
        exercises: [
          { name: 'Squats', sets: 3, reps: 12, weight: 20, rest: 60 },
          { name: 'Bench Press', sets: 3, reps: 10, weight: 30, rest: 90 },
          { name: 'Deadlifts', sets: 3, reps: 8, weight: 40, rest: 120 },
          { name: 'Shoulder Press', sets: 3, reps: 12, weight: 15, rest: 60 },
          { name: 'Rows', sets: 3, reps: 12, weight: 25, rest: 60 }
        ],
        caloriesEstimate: 400
      });
    }
  }

  initializeUserProfiles() {
    if (this.userProfiles.size === 0) {
      this.userProfiles.set('default', {
        userId: 'default',
        name: 'Default User',
        age: 30,
        weight: 75,
        height: 175,
        gender: 'male',
        fitnessLevel: 'intermediate',
        goals: {
          type: 'general-fitness',
          targetWeight: 72,
          weeklyWorkouts: 4,
          caloriesPerDay: 2500
        },
        heartRateZones: {
          zone1: { min: 95, max: 114, name: 'Very Light' },
          zone2: { min: 114, max: 133, name: 'Light' },
          zone3: { min: 133, max: 152, name: 'Moderate' },
          zone4: { min: 152, max: 171, name: 'Hard' },
          zone5: { min: 171, max: 190, name: 'Maximum' }
        },
        preferences: {
          workoutTime: '07:00',
          favoritePrograms: ['hiit-advanced'],
          musicPlaylist: 'Workout Mix',
          gymTemperature: 20,
          autoFan: true
        },
        stats: {
          totalWorkouts: 0,
          totalTime: 0,
          totalCalories: 0,
          currentStreak: 0,
          longestStreak: 0
        }
      });
    }
  }

  startMonitoring() {
    // Check for scheduled workouts and active sessions every minute
    this.monitoringInterval = setInterval(() => {
      this.checkScheduledWorkouts();
      this.monitorActiveSession();
    }, 60000);
  }

  async checkScheduledWorkouts() {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    for (const profile of this.userProfiles.values()) {
      if (profile.preferences.workoutTime === currentTime) {
        await this.sendWorkoutReminder(profile);
      }
    }
  }

  async sendWorkoutReminder(profile) {
    this.emit('notification', {
      title: 'Dags för träning!',
      message: `Hej ${profile.name}, det är dags för dagens träningspass!`,
      priority: 'normal',
      category: 'fitness',
      data: { userId: profile.userId }
    });
  }

  async monitorActiveSession() {
    if (!this.activeSession) return;
    
    const session = this.activeSession;
    const elapsed = Date.now() - session.startTime;
    const duration = session.program ? session.program.duration * 60000 : 3600000;
    
    // Check heart rate if available
    if (session.currentHeartRate) {
      const profile = this.userProfiles.get(session.userId);
      if (profile) {
        const zone = this.getHeartRateZone(session.currentHeartRate, profile.heartRateZones);
        if (zone && zone !== session.currentZone) {
          session.currentZone = zone;
          this.emit('heartRateZoneChanged', { session, zone });
        }
        
        // Alert if heart rate too high
        if (session.currentHeartRate > profile.heartRateZones.zone5.max) {
          this.emit('notification', {
            title: 'Hög puls varning!',
            message: `Din puls är ${session.currentHeartRate} bpm. Överväg att sänka intensiteten.`,
            priority: 'high',
            category: 'fitness-alert'
          });
        }
      }
    }
    
    // Notify when workout is complete
    if (elapsed >= duration && !session.completionNotified) {
      session.completionNotified = true;
      await this.completeWorkout();
    }
  }

  getHeartRateZone(heartRate, zones) {
    for (const [key, zone] of Object.entries(zones)) {
      if (heartRate >= zone.min && heartRate <= zone.max) {
        return zone.name;
      }
    }
    return null;
  }

  async startWorkout(userId, programId = null) {
    if (this.activeSession) {
      throw new Error('En träning pågår redan');
    }
    
    const profile = this.userProfiles.get(userId);
    if (!profile) {
      throw new Error('Användarprofil hittades inte');
    }
    
    const program = programId ? this.workoutPrograms.get(programId) : null;
    
    this.activeSession = {
      id: `session-${Date.now()}`,
      userId,
      program,
      startTime: Date.now(),
      endTime: null,
      exercises: [],
      totalCalories: 0,
      averageHeartRate: 0,
      maxHeartRate: 0,
      currentHeartRate: null,
      currentZone: null,
      distance: 0,
      completionNotified: false
    };
    
    // Prepare gym environment
    await this.prepareGymEnvironment(profile);
    
    // Start equipment if program specified
    if (program && program.equipment) {
      for (const equipmentId of program.equipment) {
        const equipment = this.equipment.get(equipmentId);
        if (equipment) {
          equipment.status = 'active';
          equipment.lastUsed = Date.now();
        }
      }
    }
    
    await this.saveSettings();
    
    this.emit('notification', {
      title: 'Träning startad!',
      message: program ? `Påbörjade ${program.name}` : 'Påbörjade träningspass',
      priority: 'low',
      category: 'fitness'
    });
    
    this.emit('workoutStarted', { session: this.activeSession });
    
    return this.activeSession;
  }

  async prepareGymEnvironment(profile) {
    const prefs = profile.preferences;
    
    // Adjust temperature
    if (prefs.gymTemperature) {
      this.emit('setTemperature', {
        zone: 'gym',
        temperature: prefs.gymTemperature
      });
    }
    
    // Turn on fan if preferred
    if (prefs.autoFan) {
      this.emit('controlDevice', {
        device: 'gym-fan',
        action: 'turnOn',
        speed: 'medium'
      });
    }
    
    // Start music playlist
    if (prefs.musicPlaylist) {
      this.emit('playMusic', {
        zone: 'gym',
        playlist: prefs.musicPlaylist,
        shuffle: true
      });
    }
    
    // Adjust lighting
    this.emit('setLights', {
      zone: 'gym',
      brightness: 100,
      color: 'energizing'
    });
  }

  async logExercise(exerciseData) {
    if (!this.activeSession) {
      throw new Error('Ingen aktiv träning');
    }
    
    const exercise = {
      name: exerciseData.name,
      type: exerciseData.type,
      sets: exerciseData.sets || 0,
      reps: exerciseData.reps || 0,
      weight: exerciseData.weight || 0,
      duration: exerciseData.duration || 0,
      distance: exerciseData.distance || 0,
      calories: exerciseData.calories || 0,
      timestamp: Date.now()
    };
    
    this.activeSession.exercises.push(exercise);
    this.activeSession.totalCalories += exercise.calories;
    this.activeSession.distance += exercise.distance;
    
    // Update equipment stats
    if (exerciseData.equipmentId) {
      const equipment = this.equipment.get(exerciseData.equipmentId);
      if (equipment) {
        if (equipment.type === 'weights') {
          equipment.totalReps += exercise.reps;
          equipment.totalSets += exercise.sets;
        } else {
          equipment.totalDistance += exercise.distance;
          equipment.totalTime += exercise.duration;
        }
      }
    }
    
    await this.saveSettings();
    this.emit('exerciseLogged', { exercise });
    
    return exercise;
  }

  async updateHeartRate(heartRate) {
    if (!this.activeSession) return;
    
    this.activeSession.currentHeartRate = heartRate;
    
    // Update max heart rate
    if (heartRate > this.activeSession.maxHeartRate) {
      this.activeSession.maxHeartRate = heartRate;
    }
    
    // Calculate running average
    const exercises = this.activeSession.exercises;
    const totalReadings = exercises.length + 1;
    this.activeSession.averageHeartRate = 
      ((this.activeSession.averageHeartRate * exercises.length) + heartRate) / totalReadings;
  }

  async completeWorkout() {
    if (!this.activeSession) {
      throw new Error('Ingen aktiv träning');
    }
    
    const session = this.activeSession;
    session.endTime = Date.now();
    session.duration = Math.floor((session.endTime - session.startTime) / 60000); // minutes
    
    // Calculate calories if not set
    if (session.totalCalories === 0 && session.program) {
      session.totalCalories = session.program.caloriesEstimate;
    }
    
    // Update user stats
    const profile = this.userProfiles.get(session.userId);
    if (profile) {
      profile.stats.totalWorkouts++;
      profile.stats.totalTime += session.duration;
      profile.stats.totalCalories += session.totalCalories;
      profile.stats.currentStreak++;
      if (profile.stats.currentStreak > profile.stats.longestStreak) {
        profile.stats.longestStreak = profile.stats.currentStreak;
      }
    }
    
    // Stop all equipment
    for (const equipment of this.equipment.values()) {
      if (equipment.status === 'active') {
        equipment.status = 'idle';
      }
    }
    
    // Save session
    this.workoutSessions.push(session);
    this.activeSession = null;
    
    await this.saveSettings();
    
    // Reset gym environment
    await this.resetGymEnvironment();
    
    this.emit('notification', {
      title: 'Träning avslutad!',
      message: `Bra jobbat! ${session.duration} min, ${Math.round(session.totalCalories)} kcal`,
      priority: 'normal',
      category: 'fitness'
    });
    
    this.emit('workoutCompleted', { session });
    
    return session;
  }

  async resetGymEnvironment() {
    this.emit('controlDevice', {
      device: 'gym-fan',
      action: 'turnOff'
    });
    
    this.emit('stopMusic', { zone: 'gym' });
    
    this.emit('setLights', {
      zone: 'gym',
      brightness: 50
    });
  }

  async getWorkoutRecommendation(userId) {
    const profile = this.userProfiles.get(userId);
    if (!profile) {
      throw new Error('Användarprofil hittades inte');
    }
    
    // Get recent workouts
    const recentWorkouts = this.workoutSessions
      .filter(s => s.userId === userId)
      .slice(-7);
    
    // Analyze workout patterns
    const workoutTypes = {};
    recentWorkouts.forEach(session => {
      if (session.program) {
        const type = session.program.type;
        workoutTypes[type] = (workoutTypes[type] || 0) + 1;
      }
    });
    
    // Find underworked areas
    const allTypes = ['cardio', 'strength', 'hiit', 'flexibility'];
    let recommendedType = allTypes[0];
    let minCount = Infinity;
    
    allTypes.forEach(type => {
      const count = workoutTypes[type] || 0;
      if (count < minCount) {
        minCount = count;
        recommendedType = type;
      }
    });
    
    // Find suitable program
    const suitablePrograms = Array.from(this.workoutPrograms.values())
      .filter(p => p.type === recommendedType && 
                   p.difficulty === profile.fitnessLevel);
    
    const recommended = suitablePrograms[0] || Array.from(this.workoutPrograms.values())[0];
    
    return {
      program: recommended,
      reason: `Du har inte gjort ${recommendedType} på ett tag`,
      recentWorkouts: recentWorkouts.length,
      weeklyGoal: profile.goals.weeklyWorkouts,
      progress: `${recentWorkouts.length}/${profile.goals.weeklyWorkouts} träningar denna vecka`
    };
  }

  getEquipment() {
    return Array.from(this.equipment.values());
  }

  getWorkoutPrograms() {
    return Array.from(this.workoutPrograms.values());
  }

  getUserProfile(userId) {
    return this.userProfiles.get(userId);
  }

  getWorkoutHistory(userId, limit = 10) {
    return this.workoutSessions
      .filter(s => s.userId === userId)
      .slice(-limit)
      .reverse();
  }

  getActiveSession() {
    return this.activeSession;
  }

  getStats(userId) {
    const profile = this.userProfiles.get(userId);
    if (!profile) return null;
    
    const recentSessions = this.workoutSessions
      .filter(s => s.userId === userId)
      .slice(-30);
    
    return {
      user: profile.name,
      stats: profile.stats,
      goals: profile.goals,
      recentActivity: {
        last30Days: recentSessions.length,
        totalCalories: recentSessions.reduce((sum, s) => sum + s.totalCalories, 0),
        totalMinutes: recentSessions.reduce((sum, s) => sum + s.duration, 0),
        averageHeartRate: Math.round(
          recentSessions.reduce((sum, s) => sum + s.averageHeartRate, 0) / recentSessions.length
        )
      }
    };
  }

  async destroy() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    this.removeAllListeners();
  }
}

module.exports = HomeGymFitnessSystem;
