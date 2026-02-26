'use strict';

/**
 * Fitness & Home Gym Tracker
 * Comprehensive fitness tracking and home gym management
 */
class FitnessHomeGymTracker {
  constructor(app) {
    this.app = app;
    this.users = new Map();
    this.equipment = new Map();
    this.workouts = [];
    this.exercises = new Map();
  }

  async initialize() {
    await this.setupUsers();
    await this.setupEquipment();
    await this.setupExercises();
    
    this.startMonitoring();
  }

  // ============================================
  // USER PROFILES
  // ============================================

  async setupUsers() {
    const users = [
      {
        id: 'user_anna',
        name: 'Anna',
        age: 35,
        gender: 'female',
        height: 168,  // cm
        weight: 62,   // kg
        goals: {
          weightTarget: 60,
          weeklyWorkouts: 4,
          caloriesBurnGoal: 2000  // per week
        },
        stats: {
          totalWorkouts: 45,
          totalMinutes: 1350,
          caloriesBurned: 18500,
          personalRecords: {
            squat: 60,
            deadlift: 80,
            benchPress: 40
          }
        },
        preferences: {
          workoutType: 'cardio',
          reminderTime: '07:00'
        }
      },
      {
        id: 'user_erik',
        name: 'Erik',
        age: 37,
        gender: 'male',
        height: 182,
        weight: 85,
        goals: {
          weightTarget: 82,
          weeklyWorkouts: 5,
          caloriesBurnGoal: 2500
        },
        stats: {
          totalWorkouts: 68,
          totalMinutes: 2720,
          caloriesBurned: 34000,
          personalRecords: {
            squat: 120,
            deadlift: 140,
            benchPress: 90
          }
        },
        preferences: {
          workoutType: 'strength',
          reminderTime: '18:00'
        }
      }
    ];

    for (const user of users) {
      this.users.set(user.id, user);
    }
  }

  // ============================================
  // EQUIPMENT
  // ============================================

  async setupEquipment() {
    const equipment = [
      {
        id: 'equipment_treadmill',
        name: 'Treadmill',
        type: 'cardio',
        brand: 'NordicTrack',
        inUse: false,
        totalHours: 120,
        maintenanceDue: false,
        features: {
          incline: true,
          heartRateMonitor: true,
          programs: ['interval', 'hills', 'fat_burn']
        }
      },
      {
        id: 'equipment_bike',
        name: 'Exercise Bike',
        type: 'cardio',
        brand: 'Peloton',
        inUse: false,
        totalHours: 85,
        maintenanceDue: false,
        features: {
          resistance: 20,
          screen: true,
          classes: true
        }
      },
      {
        id: 'equipment_rower',
        name: 'Rowing Machine',
        type: 'cardio',
        brand: 'Concept2',
        inUse: false,
        totalHours: 45,
        maintenanceDue: false
      },
      {
        id: 'equipment_weights',
        name: 'Free Weights',
        type: 'strength',
        brand: 'Rogue',
        inUse: false,
        weights: [5, 10, 15, 20, 25, 30, 35, 40]  // kg
      },
      {
        id: 'equipment_bench',
        name: 'Weight Bench',
        type: 'strength',
        brand: 'Rep Fitness',
        inUse: false,
        adjustable: true
      },
      {
        id: 'equipment_rack',
        name: 'Power Rack',
        type: 'strength',
        brand: 'Rogue',
        inUse: false,
        safetyBars: true
      },
      {
        id: 'equipment_bands',
        name: 'Resistance Bands',
        type: 'accessories',
        brand: 'Rogue',
        resistances: ['light', 'medium', 'heavy']
      }
    ];

    for (const item of equipment) {
      this.equipment.set(item.id, item);
    }
  }

  async useEquipment(equipmentId, userId) {
    const equipment = this.equipment.get(equipmentId);
    
    if (!equipment) {
      return { success: false, error: 'Equipment not found' };
    }

    if (equipment.inUse) {
      return { success: false, error: 'Equipment in use' };
    }

    equipment.inUse = true;
    equipment.currentUser = userId;

    const user = this.users.get(userId);
    console.log(`🏋️ ${user.name} started using ${equipment.name}`);

    return { success: true };
  }

  async releaseEquipment(equipmentId) {
    const equipment = this.equipment.get(equipmentId);
    
    if (!equipment) {
      return { success: false, error: 'Equipment not found' };
    }

    equipment.inUse = false;
    equipment.currentUser = null;

    console.log(`✅ ${equipment.name} available`);

    return { success: true };
  }

  // ============================================
  // EXERCISES
  // ============================================

  async setupExercises() {
    const exercises = [
      // Cardio
      { id: 'ex_run', name: 'Running', type: 'cardio', caloriesPerMin: 10 },
      { id: 'ex_bike', name: 'Cycling', type: 'cardio', caloriesPerMin: 8 },
      { id: 'ex_row', name: 'Rowing', type: 'cardio', caloriesPerMin: 9 },
      { id: 'ex_walk', name: 'Walking', type: 'cardio', caloriesPerMin: 5 },
      
      // Strength
      { id: 'ex_squat', name: 'Squats', type: 'strength', muscleGroup: 'legs', caloriesPerRep: 0.5 },
      { id: 'ex_deadlift', name: 'Deadlifts', type: 'strength', muscleGroup: 'back', caloriesPerRep: 0.6 },
      { id: 'ex_bench', name: 'Bench Press', type: 'strength', muscleGroup: 'chest', caloriesPerRep: 0.4 },
      { id: 'ex_pullup', name: 'Pull-ups', type: 'strength', muscleGroup: 'back', caloriesPerRep: 0.3 },
      { id: 'ex_shoulder', name: 'Shoulder Press', type: 'strength', muscleGroup: 'shoulders', caloriesPerRep: 0.3 },
      { id: 'ex_curl', name: 'Bicep Curls', type: 'strength', muscleGroup: 'arms', caloriesPerRep: 0.2 },
      
      // Bodyweight
      { id: 'ex_pushup', name: 'Push-ups', type: 'bodyweight', muscleGroup: 'chest', caloriesPerRep: 0.3 },
      { id: 'ex_situp', name: 'Sit-ups', type: 'bodyweight', muscleGroup: 'core', caloriesPerRep: 0.2 },
      { id: 'ex_plank', name: 'Plank', type: 'bodyweight', muscleGroup: 'core', caloriesPerMin: 4 },
      { id: 'ex_lunge', name: 'Lunges', type: 'bodyweight', muscleGroup: 'legs', caloriesPerRep: 0.4 }
    ];

    for (const exercise of exercises) {
      this.exercises.set(exercise.id, exercise);
    }
  }

  // ============================================
  // WORKOUTS
  // ============================================

  async startWorkout(userId, type) {
    const user = this.users.get(userId);
    
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const workout = {
      id: 'workout_' + Date.now(),
      userId,
      user: user.name,
      type,  // cardio, strength, mixed, yoga
      startTime: Date.now(),
      endTime: null,
      duration: null,
      exercises: [],
      totalCalories: 0,
      heartRate: [],
      averageHeartRate: null
    };

    this.workouts.push(workout);

    console.log(`🏋️ ${user.name} started ${type} workout`);

    // Set gym environment
    console.log('   💡 Gym lights: on');
    console.log('   🎵 Workout playlist: playing');
    console.log('   🌡️  Temperature: 18°C (cool)');
    console.log('   📺 Mirror display: workout mode');

    return { success: true, workoutId: workout.id };
  }

  async logExercise(workoutId, exerciseId, data) {
    const workout = this.workouts.find(w => w.id === workoutId);
    
    if (!workout) {
      return { success: false, error: 'Workout not found' };
    }

    const exercise = this.exercises.get(exerciseId);
    
    if (!exercise) {
      return { success: false, error: 'Exercise not found' };
    }

    const exerciseLog = {
      exerciseId,
      name: exercise.name,
      type: exercise.type,
      sets: data.sets || 1,
      reps: data.reps || null,
      duration: data.duration || null,  // minutes for cardio
      weight: data.weight || null,      // kg for strength
      distance: data.distance || null,   // km for cardio
      calories: 0
    };

    // Calculate calories
    if (exercise.type === 'cardio') {
      exerciseLog.calories = exercise.caloriesPerMin * exerciseLog.duration;
    } else if (exercise.type === 'strength' || exercise.type === 'bodyweight') {
      if (exerciseLog.reps) {
        exerciseLog.calories = exercise.caloriesPerRep * exerciseLog.reps * exerciseLog.sets;
      } else if (exerciseLog.duration) {
        exerciseLog.calories = exercise.caloriesPerMin * exerciseLog.duration;
      }
    }

    workout.exercises.push(exerciseLog);
    workout.totalCalories += exerciseLog.calories;

    console.log(`   ✅ Logged: ${exercise.name}`);
    
    if (exerciseLog.sets && exerciseLog.reps) {
      console.log(`      ${exerciseLog.sets} sets × ${exerciseLog.reps} reps @ ${exerciseLog.weight || 'bodyweight'} kg`);
    } else if (exerciseLog.duration) {
      console.log(`      ${exerciseLog.duration} minutes`);
    }
    
    console.log(`      Calories: ${Math.round(exerciseLog.calories)}`);

    // Check for personal record
    if (exercise.type === 'strength' && exerciseLog.weight) {
      await this.checkPersonalRecord(workout.userId, exerciseId, exerciseLog.weight);
    }

    return { success: true, calories: exerciseLog.calories };
  }

  async endWorkout(workoutId) {
    const workout = this.workouts.find(w => w.id === workoutId);
    
    if (!workout) {
      return { success: false, error: 'Workout not found' };
    }

    workout.endTime = Date.now();
    workout.duration = (workout.endTime - workout.startTime) / (1000 * 60);  // minutes

    // Calculate average heart rate
    if (workout.heartRate.length > 0) {
      const sum = workout.heartRate.reduce((a, b) => a + b.rate, 0);
      workout.averageHeartRate = Math.round(sum / workout.heartRate.length);
    }

    console.log(`✅ ${workout.user} finished workout`);
    console.log(`   Duration: ${Math.round(workout.duration)} minutes`);
    console.log(`   Exercises: ${workout.exercises.length}`);
    console.log(`   Calories: ${Math.round(workout.totalCalories)}`);
    
    if (workout.averageHeartRate) {
      console.log(`   Avg Heart Rate: ${workout.averageHeartRate} bpm`);
    }

    // Update user stats
    const user = this.users.get(workout.userId);
    user.stats.totalWorkouts++;
    user.stats.totalMinutes += workout.duration;
    user.stats.caloriesBurned += workout.totalCalories;

    // Cool-down recommendations
    console.log('   💧 Hydration reminder');
    console.log('   🧘 Cool-down stretch recommended');

    return { success: true, workout };
  }

  // ============================================
  // HEART RATE MONITORING
  // ============================================

  async trackHeartRate(workoutId, heartRate) {
    const workout = this.workouts.find(w => w.id === workoutId);
    
    if (!workout) {
      return { success: false };
    }

    workout.heartRate.push({
      time: Date.now(),
      rate: heartRate
    });

    // Determine heart rate zone
    const zone = this.getHeartRateZone(heartRate);

    return { success: true, zone };
  }

  getHeartRateZone(heartRate) {
    // Based on typical zones (% of max HR)
    if (heartRate < 100) {
      return { zone: 1, name: 'Very Light', description: 'Warm-up' };
    } else if (heartRate < 120) {
      return { zone: 2, name: 'Light', description: 'Fat Burn' };
    } else if (heartRate < 140) {
      return { zone: 3, name: 'Moderate', description: 'Aerobic' };
    } else if (heartRate < 160) {
      return { zone: 4, name: 'Hard', description: 'Anaerobic' };
    } else {
      return { zone: 5, name: 'Maximum', description: 'Peak Effort' };
    }
  }

  // ============================================
  // PERSONAL RECORDS
  // ============================================

  async checkPersonalRecord(userId, exerciseId, weight) {
    const user = this.users.get(userId);
    const exercise = this.exercises.get(exerciseId);
    
    if (!user || !exercise) {
      return;
    }

    const exerciseName = exercise.name.toLowerCase().replace(/[- ]/g, '');
    const currentPR = user.stats.personalRecords[exerciseName];

    if (!currentPR || weight > currentPR) {
      user.stats.personalRecords[exerciseName] = weight;
      
      console.log(`   🏆 NEW PERSONAL RECORD! ${exercise.name}: ${weight} kg`);
      
      // Celebrate
      console.log('   🎉 Confetti effect!');
      console.log('   🔊 Victory sound!');
    }
  }

  // ============================================
  // WORKOUT PROGRAMS
  // ============================================

  getWorkoutProgram(type, level) {
    const programs = {
      beginner_cardio: [
        { exercise: 'ex_walk', duration: 5, note: 'Warm-up' },
        { exercise: 'ex_run', duration: 15, note: 'Easy pace' },
        { exercise: 'ex_walk', duration: 5, note: 'Cool-down' }
      ],
      intermediate_strength: [
        { exercise: 'ex_squat', sets: 3, reps: 10, weight: 60 },
        { exercise: 'ex_bench', sets: 3, reps: 8, weight: 50 },
        { exercise: 'ex_deadlift', sets: 3, reps: 8, weight: 80 },
        { exercise: 'ex_pullup', sets: 3, reps: 10 },
        { exercise: 'ex_plank', duration: 2 }
      ],
      advanced_mixed: [
        { exercise: 'ex_run', duration: 10, note: 'Warm-up' },
        { exercise: 'ex_squat', sets: 4, reps: 12, weight: 80 },
        { exercise: 'ex_bench', sets: 4, reps: 10, weight: 70 },
        { exercise: 'ex_row', duration: 15 },
        { exercise: 'ex_plank', duration: 3 }
      ]
    };

    const key = `${level}_${type}`;
    return programs[key] || programs.beginner_cardio;
  }

  // ============================================
  // SMART FEATURES
  // ============================================

  async suggestWorkout(userId) {
    const user = this.users.get(userId);
    
    if (!user) {
      return { success: false };
    }

    // Analyze recent workouts
    const recentWorkouts = this.workouts
      .filter(w => w.userId === userId && w.endTime)
      .slice(-7);

    const lastWorkoutType = recentWorkouts.length > 0 
      ? recentWorkouts[recentWorkouts.length - 1].type 
      : null;

    // Suggest alternating workout type
    let suggestedType;
    if (lastWorkoutType === 'cardio') {
      suggestedType = 'strength';
    } else if (lastWorkoutType === 'strength') {
      suggestedType = 'cardio';
    } else {
      suggestedType = user.preferences.workoutType;
    }

    console.log(`💡 Workout suggestion for ${user.name}:`);
    console.log(`   Type: ${suggestedType}`);
    console.log(`   Duration: 45 minutes`);
    console.log(`   Reason: Balance and recovery`);

    return {
      success: true,
      type: suggestedType,
      duration: 45,
      reason: 'Balance and recovery'
    };
  }

  async sendWorkoutReminder(userId) {
    const user = this.users.get(userId);
    
    if (!user) {
      return;
    }

    console.log(`⏰ Workout reminder: ${user.name}`);
    console.log(`   Time: ${user.preferences.reminderTime}`);
    console.log(`   Goal: ${user.goals.weeklyWorkouts} workouts/week`);

    return { success: true };
  }

  async analyzeProgress(userId, days = 30) {
    const user = this.users.get(userId);
    
    if (!user) {
      return { success: false };
    }

    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const recentWorkouts = this.workouts.filter(w => 
      w.userId === userId && 
      w.endTime && 
      w.startTime >= cutoff
    );

    const totalWorkouts = recentWorkouts.length;
    const totalMinutes = recentWorkouts.reduce((sum, w) => sum + w.duration, 0);
    const totalCalories = recentWorkouts.reduce((sum, w) => sum + w.totalCalories, 0);

    const weeksInPeriod = days / 7;
    const avgWorkoutsPerWeek = totalWorkouts / weeksInPeriod;

    const progress = {
      workouts: totalWorkouts,
      minutes: Math.round(totalMinutes),
      calories: Math.round(totalCalories),
      avgPerWeek: avgWorkoutsPerWeek.toFixed(1),
      goalProgress: (avgWorkoutsPerWeek / user.goals.weeklyWorkouts * 100).toFixed(0) + '%'
    };

    console.log(`📊 Progress analysis for ${user.name} (${days} days):`);
    console.log(`   Workouts: ${progress.workouts}`);
    console.log(`   Time: ${progress.minutes} minutes`);
    console.log(`   Calories: ${progress.calories}`);
    console.log(`   Avg/week: ${progress.avgPerWeek}`);
    console.log(`   Goal: ${progress.goalProgress}`);

    return progress;
  }

  // ============================================
  // MONITORING
  // ============================================

  startMonitoring() {
    // Send workout reminders
    setInterval(() => {
      const hour = new Date().getHours();
      const minute = new Date().getMinutes();

      for (const [id, user] of this.users) {
        const [remindHour, remindMinute] = user.preferences.reminderTime.split(':').map(Number);
        
        if (hour === remindHour && minute === remindMinute) {
          this.sendWorkoutReminder(id);
        }
      }
    }, 60 * 1000);

    // Check equipment maintenance
    setInterval(() => {
      for (const [_id, equipment] of this.equipment) {
        if (equipment.totalHours > 200 && !equipment.maintenanceDue) {
          equipment.maintenanceDue = true;
          console.log(`🔧 Maintenance due: ${equipment.name}`);
        }
      }
    }, 24 * 60 * 60 * 1000);

    console.log('🏋️ Fitness Tracker active');
  }

  // ============================================
  // REPORTING
  // ============================================

  getFitnessOverview() {
    const users = Array.from(this.users.values());
    const activeWorkouts = this.workouts.filter(w => !w.endTime).length;

    return {
      users: users.length,
      equipment: this.equipment.size,
      totalWorkouts: this.workouts.length,
      activeWorkouts
    };
  }

  getUserStats(userId) {
    const user = this.users.get(userId);
    
    if (!user) {
      return null;
    }

    return {
      name: user.name,
      workouts: user.stats.totalWorkouts,
      time: `${Math.round(user.stats.totalMinutes / 60)}h`,
      calories: user.stats.caloriesBurned.toLocaleString(),
      weeklyGoal: user.goals.weeklyWorkouts
    };
  }

  getRecentWorkouts(userId, limit = 5) {
    return this.workouts
      .filter(w => w.userId === userId && w.endTime)
      .slice(-limit)
      .reverse()
      .map(w => ({
        date: new Date(w.startTime).toLocaleDateString('sv-SE'),
        type: w.type,
        duration: Math.round(w.duration) + ' min',
        exercises: w.exercises.length,
        calories: Math.round(w.totalCalories)
      }));
  }

  getPersonalRecords(userId) {
    const user = this.users.get(userId);
    
    if (!user) {
      return null;
    }

    return Object.entries(user.stats.personalRecords).map(([exercise, weight]) => ({
      exercise: exercise.charAt(0).toUpperCase() + exercise.slice(1),
      weight: weight + ' kg'
    }));
  }

  getEquipmentStatus() {
    return Array.from(this.equipment.values()).map(e => ({
      name: e.name,
      type: e.type,
      inUse: e.inUse ? 'Yes' : 'No',
      maintenance: e.maintenanceDue ? 'Due' : 'OK'
    }));
  }
}

module.exports = FitnessHomeGymTracker;
