'use strict';

/**
 * Health & Wellness Tracker
 * Comprehensive health monitoring and wellness optimization
 */
class HealthWellnessTracker {
  constructor(app) {
    this.app = app;
    this.users = new Map();
    this.metrics = new Map();
    this.goals = new Map();
    this.activities = [];
    this.sleepSessions = [];
    this.environmentalData = [];
    this.recommendations = [];
  }

  async initialize() {
    await this.setupUsers();
    await this.setupGoals();
    await this.startTracking();
    
    this.startMonitoring();
  }

  // ============================================
  // USER SETUP
  // ============================================

  async setupUsers() {
    const userData = [
      {
        id: 'user_anna',
        name: 'Anna',
        age: 38,
        gender: 'female',
        height: 168, // cm
        weight: 65, // kg
        activityLevel: 'moderate',
        healthGoals: ['fitness', 'stress_reduction']
      },
      {
        id: 'user_erik',
        name: 'Erik',
        age: 40,
        gender: 'male',
        height: 182,
        weight: 85,
        activityLevel: 'active',
        healthGoals: ['weight_loss', 'muscle_gain']
      },
      {
        id: 'user_lisa',
        name: 'Lisa',
        age: 12,
        gender: 'female',
        height: 155,
        weight: 45,
        activityLevel: 'active',
        healthGoals: ['growth', 'fitness']
      },
      {
        id: 'user_oscar',
        name: 'Oscar',
        age: 8,
        gender: 'male',
        height: 130,
        weight: 28,
        activityLevel: 'very_active',
        healthGoals: ['growth', 'energy']
      }
    ];

    for (const user of userData) {
      this.users.set(user.id, {
        ...user,
        bmi: this.calculateBMI(user.weight, user.height),
        bmr: this.calculateBMR(user),
        dailyCalories: this.calculateDailyCalories(user),
        currentMetrics: {
          steps: 0,
          activeMinutes: 0,
          heartRate: null,
          stress: 'low',
          energy: 'high'
        },
        weeklyStats: {
          totalSteps: 0,
          totalActiveMinutes: 0,
          averageSleep: 0,
          workouts: 0
        }
      });
    }
  }

  calculateBMI(weight, height) {
    // BMI = weight (kg) / (height (m))^2
    const heightM = height / 100;
    return (weight / (heightM * heightM)).toFixed(1);
  }

  calculateBMR(user) {
    // Mifflin-St Jeor Equation
    let bmr;
    
    if (user.gender === 'male') {
      bmr = 10 * user.weight + 6.25 * user.height - 5 * user.age + 5;
    } else {
      bmr = 10 * user.weight + 6.25 * user.height - 5 * user.age - 161;
    }

    return Math.round(bmr);
  }

  calculateDailyCalories(user) {
    const activityMultipliers = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      very_active: 1.9
    };

    const multiplier = activityMultipliers[user.activityLevel] || 1.55;
    return Math.round(user.bmr * multiplier);
  }

  // ============================================
  // ACTIVITY TRACKING
  // ============================================

  async startTracking() {
    // Simulate daily activity
    setInterval(() => {
      this.simulateDailyActivity();
    }, 60 * 60 * 1000); // Every hour

    // Initial activity
    this.simulateDailyActivity();
  }

  async simulateDailyActivity() {
    const hour = new Date().getHours();

    for (const [_userId, user] of this.users) {
      // Steps per hour based on activity level and time of day
      let stepsPerHour = 0;

      if (hour >= 7 && hour <= 22) {
        const baseSteps = {
          sedentary: 200,
          light: 400,
          moderate: 600,
          active: 800,
          very_active: 1000
        }[user.activityLevel] || 400;

        // More active during morning and evening
        const timeMultiplier = (hour >= 6 && hour <= 9) || (hour >= 17 && hour <= 20) ? 1.5 : 1;
        stepsPerHour = Math.round(baseSteps * timeMultiplier * (0.8 + Math.random() * 0.4));

        user.currentMetrics.steps += stepsPerHour;
      }

      // Active minutes
      if (stepsPerHour > 300) {
        user.currentMetrics.activeMinutes += Math.round(stepsPerHour / 50);
      }

      // Heart rate (resting 60-100, active 100-160)
      const isActive = stepsPerHour > 500;
      user.currentMetrics.heartRate = isActive 
        ? 100 + Math.round(Math.random() * 40)
        : 60 + Math.round(Math.random() * 30);

      // Stress level (lower in evening)
      if (hour < 9 || hour > 20) {
        user.currentMetrics.stress = 'low';
      } else if (hour >= 9 && hour < 17) {
        user.currentMetrics.stress = Math.random() > 0.7 ? 'high' : 'medium';
      } else {
        user.currentMetrics.stress = 'medium';
      }

      // Energy level
      if (hour >= 6 && hour < 12) {
        user.currentMetrics.energy = 'high';
      } else if (hour >= 12 && hour < 18) {
        user.currentMetrics.energy = 'medium';
      } else {
        user.currentMetrics.energy = 'low';
      }
    }
  }

  async logActivity(userId, activityData) {
    const user = this.users.get(userId);
    
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const activity = {
      id: `activity_${Date.now()}`,
      userId,
      type: activityData.type, // walk, run, bike, gym, yoga, etc
      duration: activityData.duration, // minutes
      intensity: activityData.intensity, // low, medium, high
      caloriesBurned: this.calculateCaloriesBurned(user, activityData),
      distance: activityData.distance || null,
      heartRate: activityData.heartRate || null,
      timestamp: Date.now()
    };

    this.activities.push(activity);

    // Update user stats
    user.currentMetrics.activeMinutes += activity.duration;
    user.weeklyStats.workouts += 1;

    console.log(`🏃 ${user.name}: ${activity.type} for ${activity.duration} min (${activity.caloriesBurned} cal)`);

    return { success: true, activity };
  }

  calculateCaloriesBurned(user, activity) {
    // MET (Metabolic Equivalent of Task) values
    const metValues = {
      walk: { low: 2.5, medium: 3.5, high: 5.0 },
      run: { low: 6.0, medium: 8.0, high: 11.0 },
      bike: { low: 4.0, medium: 6.8, high: 10.0 },
      gym: { low: 3.0, medium: 5.0, high: 8.0 },
      yoga: { low: 2.5, medium: 3.0, high: 4.0 },
      swim: { low: 4.5, medium: 7.0, high: 10.0 }
    };

    const met = metValues[activity.type]?.[activity.intensity] || 5.0;
    
    // Calories = MET × weight (kg) × duration (hours)
    const calories = met * user.weight * (activity.duration / 60);
    
    return Math.round(calories);
  }

  // ============================================
  // SLEEP TRACKING
  // ============================================

  async logSleep(userId, sleepData) {
    const user = this.users.get(userId);
    
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const session = {
      id: `sleep_${Date.now()}`,
      userId,
      bedtime: sleepData.bedtime,
      wakeTime: sleepData.wakeTime,
      duration: (sleepData.wakeTime - sleepData.bedtime) / (1000 * 60), // minutes
      quality: sleepData.quality || this.assessSleepQuality(sleepData),
      deepSleep: sleepData.deepSleep || null,
      lightSleep: sleepData.lightSleep || null,
      awakenings: sleepData.awakenings || 0,
      heartRate: sleepData.heartRate || null,
      timestamp: sleepData.bedtime
    };

    this.sleepSessions.push(session);

    console.log(`😴 ${user.name}: Slept ${(session.duration / 60).toFixed(1)} hours (${session.quality} quality)`);

    // Update weekly average
    const recentSleep = this.sleepSessions
      .filter(s => s.userId === userId)
      .slice(-7);
    
    user.weeklyStats.averageSleep = recentSleep.length > 0
      ? recentSleep.reduce((sum, s) => sum + s.duration, 0) / recentSleep.length / 60
      : 0;

    return { success: true, session };
  }

  assessSleepQuality(data) {
    const durationHours = (data.wakeTime - data.bedtime) / (1000 * 60 * 60);
    
    if (durationHours >= 7 && durationHours <= 9 && (!data.awakenings || data.awakenings <= 1)) {
      return 'excellent';
    } else if (durationHours >= 6 && durationHours <= 10) {
      return 'good';
    } else if (durationHours >= 5) {
      return 'fair';
    }
    
    return 'poor';
  }

  async simulateSleep(userId) {
    const user = this.users.get(userId);
    
    if (!user) return;

    // Simulate last night's sleep
    const lastNight = Date.now() - 8 * 60 * 60 * 1000;
    const bedtime = lastNight - 8 * 60 * 60 * 1000; // 8 hours ago
    const _wakeTime = lastNight;

    const duration = 7 + Math.random() * 1.5; // 7-8.5 hours
    const actualWakeTime = bedtime + duration * 60 * 60 * 1000;

    await this.logSleep(userId, {
      bedtime,
      wakeTime: actualWakeTime,
      awakenings: Math.floor(Math.random() * 3),
      deepSleep: duration * 0.25,
      lightSleep: duration * 0.55,
      heartRate: 55 + Math.round(Math.random() * 15)
    });
  }

  // ============================================
  // HEALTH GOALS
  // ============================================

  async setupGoals() {
    // Default goals
    await this.createGoal({
      userId: 'user_anna',
      type: 'steps',
      target: 10000,
      period: 'daily'
    });

    await this.createGoal({
      userId: 'user_erik',
      type: 'weight',
      target: 80,
      period: 'monthly'
    });

    await this.createGoal({
      userId: 'user_anna',
      type: 'active_minutes',
      target: 150,
      period: 'weekly'
    });
  }

  async createGoal(data) {
    const id = `goal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const goal = {
      id,
      userId: data.userId,
      type: data.type, // steps, weight, active_minutes, sleep, water
      target: data.target,
      period: data.period, // daily, weekly, monthly
      startDate: Date.now(),
      progress: 0,
      status: 'active'
    };

    this.goals.set(id, goal);

    const user = this.users.get(data.userId);
    console.log(`🎯 Goal set for ${user?.name}: ${data.target} ${data.type} per ${data.period}`);

    return { success: true, goal };
  }

  async updateGoalProgress() {
    for (const [_goalId, goal] of this.goals) {
      if (goal.status !== 'active') continue;

      const user = this.users.get(goal.userId);
      if (!user) continue;

      switch (goal.type) {
        case 'steps':
          goal.progress = user.currentMetrics.steps;
          break;

        case 'active_minutes':
          goal.progress = user.weeklyStats.totalActiveMinutes;
          break;

        case 'weight':
          goal.progress = user.weight;
          break;

        case 'sleep':
          goal.progress = user.weeklyStats.averageSleep;
          break;
      }

      // Check if goal achieved
      if (goal.progress >= goal.target) {
        goal.status = 'achieved';
        goal.achievedDate = Date.now();
        
        console.log(`🎉 ${user.name} achieved goal: ${goal.target} ${goal.type}!`);
      }
    }
  }

  // ============================================
  // ENVIRONMENTAL HEALTH
  // ============================================

  async trackEnvironmentalHealth() {
    // Get data from indoor climate and air quality systems
    const environmentalSnapshot = {
      timestamp: Date.now(),
      indoorAirQuality: 'good', // From air quality manager
      temperature: 21,
      humidity: 45,
      co2Level: 450,
      vocLevel: 120,
      lightLevel: 'adequate',
      noiseLevel: 40 // dB
    };

    this.environmentalData.push(environmentalSnapshot);

    // Keep last 7 days
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    this.environmentalData = this.environmentalData.filter(d => d.timestamp >= cutoff);

    // Analyze impact on health
    await this.analyzeEnvironmentalImpact(environmentalSnapshot);
  }

  async analyzeEnvironmentalImpact(data) {
    const warnings = [];

    // High CO2 affects concentration and energy
    if (data.co2Level > 1000) {
      warnings.push({
        type: 'co2',
        severity: 'medium',
        message: 'Hög CO2-nivå kan påverka koncentration och orsaka trötthet',
        recommendation: 'Öka ventilationen'
      });
    }

    // Poor air quality
    if (data.indoorAirQuality === 'poor') {
      warnings.push({
        type: 'air_quality',
        severity: 'high',
        message: 'Dålig luftkvalitet kan irritera andningsvägar',
        recommendation: 'Lufta ut eller starta luftrenare'
      });
    }

    // Humidity issues
    if (data.humidity < 30) {
      warnings.push({
        type: 'humidity',
        severity: 'low',
        message: 'Låg luftfuktighet kan torka ut slemhinnor',
        recommendation: 'Använd luftfuktare'
      });
    } else if (data.humidity > 60) {
      warnings.push({
        type: 'humidity',
        severity: 'medium',
        message: 'Hög luftfuktighet kan främja mögelbildning',
        recommendation: 'Minska luftfuktighet'
      });
    }

    if (warnings.length > 0) {
      for (const warning of warnings) {
        console.log(`⚠️ Health warning: ${warning.message}`);
      }
    }
  }

  // ============================================
  // RECOMMENDATIONS
  // ============================================

  async generateRecommendations(userId) {
    const user = this.users.get(userId);
    
    if (!user) return [];

    const recommendations = [];

    // Activity recommendations
    if (user.currentMetrics.steps < 5000) {
      recommendations.push({
        type: 'activity',
        priority: 'high',
        title: 'Öka daglig aktivitet',
        message: `Du har gått ${user.currentMetrics.steps} steg idag. Försök nå 10,000 steg för optimal hälsa.`,
        action: 'Ta en promenad'
      });
    }

    // Sleep recommendations
    if (user.weeklyStats.averageSleep < 7) {
      recommendations.push({
        type: 'sleep',
        priority: 'high',
        title: 'Förbättra sömn',
        message: `Genomsnittlig sömn: ${user.weeklyStats.averageSleep.toFixed(1)} timmar. Sträva efter 7-9 timmar.`,
        action: 'Gå till sängs tidigare'
      });
    }

    // Stress recommendations
    if (user.currentMetrics.stress === 'high') {
      recommendations.push({
        type: 'stress',
        priority: 'medium',
        title: 'Hantera stress',
        message: 'Hög stressnivå detekterad. Ta en paus.',
        action: 'Prova andningsövningar eller meditation'
      });
    }

    // Hydration (assume 8 glasses per day)
    recommendations.push({
      type: 'hydration',
      priority: 'medium',
      title: 'Drick vatten',
      message: 'Glöm inte att dricka tillräckligt med vatten.',
      action: 'Drick ett glas vatten nu'
    });

    // Exercise variety
    if (user.weeklyStats.workouts < 3) {
      recommendations.push({
        type: 'exercise',
        priority: 'medium',
        title: 'Träna mer regelbundet',
        message: `${user.weeklyStats.workouts} träningspass denna vecka. Sikta på minst 3-5 per vecka.`,
        action: 'Boka in ett träningspass'
      });
    }

    return recommendations;
  }

  // ============================================
  // MONITORING
  // ============================================

  startMonitoring() {
    // Update metrics every hour
    setInterval(() => {
      this.simulateDailyActivity();
    }, 60 * 60 * 1000);

    // Check goals daily
    setInterval(() => {
      this.updateGoalProgress();
    }, 24 * 60 * 60 * 1000);

    // Track environmental health every 30 minutes
    setInterval(() => {
      this.trackEnvironmentalHealth();
    }, 30 * 60 * 1000);

    // Generate daily recommendations
    setInterval(() => {
      const hour = new Date().getHours();
      if (hour === 8) { // Morning recommendations
        for (const [userId] of this.users) {
          this.generateRecommendations(userId);
        }
      }
    }, 60 * 60 * 1000);

    // Initial environmental tracking
    this.trackEnvironmentalHealth();
  }

  async resetDailyMetrics() {
    // Reset daily counters at midnight
    for (const [_userId, user] of this.users) {
      user.currentMetrics.steps = 0;
      user.currentMetrics.activeMinutes = 0;
    }

    console.log('🔄 Daily metrics reset');
  }

  // ============================================
  // REPORTING & ANALYTICS
  // ============================================

  getHealthOverview(userId) {
    const user = this.users.get(userId);
    
    if (!user) return null;

    const _recentActivities = this.activities
      .filter(a => a.userId === userId)
      .slice(-7);

    const _recentSleep = this.sleepSessions
      .filter(s => s.userId === userId)
      .slice(-7);

    return {
      user: {
        name: user.name,
        age: user.age,
        bmi: user.bmi,
        bmiCategory: this.getBMICategory(user.bmi)
      },
      current: {
        steps: user.currentMetrics.steps,
        activeMinutes: user.currentMetrics.activeMinutes,
        heartRate: user.currentMetrics.heartRate,
        stress: user.currentMetrics.stress,
        energy: user.currentMetrics.energy
      },
      weekly: {
        averageSleep: user.weeklyStats.averageSleep.toFixed(1),
        workouts: user.weeklyStats.workouts,
        totalActiveMinutes: user.weeklyStats.totalActiveMinutes
      },
      goals: this.getUserGoals(userId)
    };
  }

  getBMICategory(bmi) {
    const value = parseFloat(bmi);
    
    if (value < 18.5) return 'Undervikt';
    if (value < 25) return 'Normalvikt';
    if (value < 30) return 'Övervikt';
    return 'Fetma';
  }

  getUserGoals(userId) {
    return Array.from(this.goals.values())
      .filter(g => g.userId === userId && g.status === 'active')
      .map(g => ({
        type: g.type,
        target: g.target,
        progress: g.progress,
        percentage: Math.round((g.progress / g.target) * 100)
      }));
  }

  getActivityReport(userId, days = 7) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const activities = this.activities.filter(a => 
      a.userId === userId && a.timestamp >= cutoff
    );

    const byType = {};
    let totalCalories = 0;
    let totalDuration = 0;

    for (const activity of activities) {
      if (!byType[activity.type]) {
        byType[activity.type] = {
          count: 0,
          duration: 0,
          calories: 0
        };
      }

      byType[activity.type].count += 1;
      byType[activity.type].duration += activity.duration;
      byType[activity.type].calories += activity.caloriesBurned;

      totalCalories += activity.caloriesBurned;
      totalDuration += activity.duration;
    }

    return {
      period: `${days} days`,
      totalWorkouts: activities.length,
      totalDuration: Math.round(totalDuration),
      totalCalories: Math.round(totalCalories),
      averagePerDay: (activities.length / days).toFixed(1),
      byType
    };
  }

  getSleepReport(userId, days = 7) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const sessions = this.sleepSessions.filter(s => 
      s.userId === userId && s.timestamp >= cutoff
    );

    if (sessions.length === 0) {
      return {
        period: `${days} days`,
        averageDuration: 0,
        quality: 'No data'
      };
    }

    const avgDuration = sessions.reduce((sum, s) => sum + s.duration, 0) / sessions.length / 60;
    const avgAwakenings = sessions.reduce((sum, s) => sum + (s.awakenings || 0), 0) / sessions.length;

    const qualityCount = {
      excellent: 0,
      good: 0,
      fair: 0,
      poor: 0
    };

    for (const session of sessions) {
      qualityCount[session.quality]++;
    }

    return {
      period: `${days} days`,
      totalSessions: sessions.length,
      averageDuration: avgDuration.toFixed(1),
      averageAwakenings: avgAwakenings.toFixed(1),
      qualityDistribution: qualityCount
    };
  }

  getWellnessScore(userId) {
    const user = this.users.get(userId);
    
    if (!user) return null;

    let score = 100;
    const factors = [];

    // Activity score (40 points)
    const stepGoal = 10000;
    const stepScore = Math.min(40, (user.currentMetrics.steps / stepGoal) * 40);
    score -= (40 - stepScore);
    
    if (stepScore < 20) {
      factors.push('Låg aktivitetsnivå');
    }

    // Sleep score (30 points)
    const sleepGoal = 8;
    const sleepScore = Math.min(30, (user.weeklyStats.averageSleep / sleepGoal) * 30);
    score -= (30 - sleepScore);
    
    if (sleepScore < 15) {
      factors.push('Otillräcklig sömn');
    }

    // Stress score (20 points)
    const stressImpact = {
      low: 0,
      medium: -5,
      high: -15
    };
    score += stressImpact[user.currentMetrics.stress] || 0;
    
    if (user.currentMetrics.stress === 'high') {
      factors.push('Hög stressnivå');
    }

    // BMI score (10 points)
    const bmi = parseFloat(user.bmi);
    if (bmi >= 18.5 && bmi < 25) {
      // Healthy range
    } else {
      score -= 5;
      factors.push('BMI utanför normalintervall');
    }

    score = Math.max(0, Math.min(100, score));

    return {
      score: Math.round(score),
      rating: score >= 80 ? 'Utmärkt' :
              score >= 60 ? 'Bra' :
              score >= 40 ? 'Acceptabel' : 'Behöver förbättring',
      factors
    };
  }

  getEnvironmentalHealthReport(days = 7) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const data = this.environmentalData.filter(d => d.timestamp >= cutoff);

    if (data.length === 0) {
      return { message: 'No environmental data available' };
    }

    const avgCO2 = data.reduce((sum, d) => sum + d.co2Level, 0) / data.length;
    const avgVOC = data.reduce((sum, d) => sum + d.vocLevel, 0) / data.length;
    const avgTemp = data.reduce((sum, d) => sum + d.temperature, 0) / data.length;
    const avgHumidity = data.reduce((sum, d) => sum + d.humidity, 0) / data.length;

    return {
      period: `${days} days`,
      averages: {
        co2: Math.round(avgCO2),
        voc: Math.round(avgVOC),
        temperature: avgTemp.toFixed(1),
        humidity: Math.round(avgHumidity)
      },
      quality: avgCO2 < 800 && avgVOC < 300 ? 'Excellent' :
               avgCO2 < 1000 && avgVOC < 500 ? 'Good' : 'Needs Improvement'
    };
  }
}

module.exports = HealthWellnessTracker;
