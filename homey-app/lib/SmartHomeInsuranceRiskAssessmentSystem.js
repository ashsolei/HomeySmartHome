'use strict';

const EventEmitter = require('events');
const Homey = require('homey');

/**
 * Smart Home Insurance & Risk Assessment System
 * 
 * Risk monitoring, insurance policy management, claims handling, and preventive maintenance tracking.
 * 
 * @extends EventEmitter
 */
class SmartHomeInsuranceRiskAssessmentSystem extends EventEmitter {
  constructor() {
    super();
    
    this.insurancePolicies = new Map();
    this.riskFactors = new Map();
    this.claims = [];
    this.maintenanceRecords = [];
    this.inspections = [];
    
    this.settings = {
      autoRiskAssessment: true,
      preventiveMaintenanceReminders: true,
      claimsDocumentation: true,
      videoEvidenceCapture: true,
      insuranceIntegration: false, // Would require API integration
      riskThreshold: 'medium' // low, medium, high
    };
    
    this.currentRiskProfile = {
      overallScore: 75, // 0-100, higher is better (lower risk)
      riskLevel: 'low', // low, medium, high, critical
      factors: {},
      lastAssessment: Date.now(),
      recommendations: []
    };
    
    this.cache = { data: new Map(), timestamps: new Map(), ttl: 5 * 60 * 1000 };
    this.monitoring = { interval: null, checkInterval: 60 * 60 * 1000, lastCheck: null };
    
    this.initializeDefaultData();
  }
  
  initializeDefaultData() {
    // Insurance policies
    this.insurancePolicies.set('policy-001', {
      id: 'policy-001',
      type: 'home-insurance',
      provider: 'Folksam',
      policyNumber: 'FH-2024-789456',
      coverageType: 'comprehensive',
      coverageAmount: 3500000, // SEK
      deductible: 1500,
      premium: 4800, // SEK/year
      startDate: Date.now() - 200 * 24 * 60 * 60 * 1000,
      endDate: Date.now() + 165 * 24 * 60 * 60 * 1000,
      status: 'active',
      coverage: {
        building: 2500000,
        contents: 800000,
        liability: 5000000,
        waterDamage: true,
        fire: true,
        theft: true,
        naturalDisasters: true
      },
      discounts: [
        { type: 'smart-home', amount: 10, reason: 'Smart security system' },
        { type: 'fire-protection', amount: 5, reason: 'Smoke detectors and sprinklers' }
      ]
    });
    
    this.insurancePolicies.set('policy-002', {
      id: 'policy-002',
      type: 'appliance-insurance',
      provider: 'If',
      policyNumber: 'IF-APP-2024-123',
      coverageType: 'extended-warranty',
      coverageAmount: 150000,
      deductible: 500,
      premium: 1200,
      startDate: Date.now() - 90 * 24 * 60 * 60 * 1000,
      endDate: Date.now() + 275 * 24 * 60 * 60 * 1000,
      status: 'active',
      coveredAppliances: [
        'HVAC System',
        'Solar Panels',
        'Heat Pump',
        'Home Battery',
        'Major Kitchen Appliances'
      ]
    });
    
    // Risk factors
    this.riskFactors.set('fire', {
      id: 'fire',
      category: 'fire',
      name: 'Fire Risk',
      currentScore: 85, // 0-100, higher is better
      riskLevel: 'low',
      factors: {
        smokeDetectors: { status: 'installed', count: 5, score: 95 },
        fireExtinguishers: { status: 'available', count: 2, score: 90 },
        electricalSafety: { status: 'good', lastInspection: Date.now() - 180 * 24 * 60 * 60 * 1000, score: 80 },
        heatingSystem: { status: 'maintained', lastService: Date.now() - 90 * 24 * 60 * 60 * 1000, score: 85 }
      },
      lastAssessment: Date.now() - 7 * 24 * 60 * 60 * 1000
    });
    
    this.riskFactors.set('water', {
      id: 'water',
      category: 'water',
      name: 'Water Damage Risk',
      currentScore: 70,
      riskLevel: 'medium',
      factors: {
        leakDetectors: { status: 'installed', count: 3, score: 85 },
        plumbing: { status: 'aging', lastInspection: Date.now() - 365 * 24 * 60 * 60 * 1000, score: 60 },
        waterHeater: { status: 'good', age: 5, score: 75 },
        basement: { status: 'prone-to-flooding', sumpPump: true, score: 65 }
      },
      lastAssessment: Date.now() - 14 * 24 * 60 * 60 * 1000
    });
    
    this.riskFactors.set('security', {
      id: 'security',
      category: 'security',
      name: 'Theft & Break-in Risk',
      currentScore: 90,
      riskLevel: 'low',
      factors: {
        alarmSystem: { status: 'active', monitored: true, score: 95 },
        smartLocks: { status: 'installed', count: 3, score: 90 },
        cameras: { status: 'active', count: 6, recording: true, score: 95 },
        lighting: { status: 'automated', motion: true, score: 85 },
        neighborhood: { crimeRate: 'low', score: 88 }
      },
      lastAssessment: Date.now() - 7 * 24 * 60 * 60 * 1000
    });
    
    this.riskFactors.set('weather', {
      id: 'weather',
      category: 'weather',
      name: 'Weather-Related Risk',
      currentScore: 75,
      riskLevel: 'low',
      factors: {
        stormDamage: { roofCondition: 'good', age: 8, score: 80 },
        windProtection: { shutters: false, reinforcement: 'standard', score: 70 },
        snowLoad: { roofDesign: 'adequate', heating: true, score: 85 },
        flooding: { elevation: 'above-flood-zone', drainage: 'good', score: 90 }
      },
      lastAssessment: Date.now() - 30 * 24 * 60 * 60 * 1000
    });
    
    // Claims history
    this.claims.push({
      id: 'claim-001',
      policyId: 'policy-001',
      type: 'water-damage',
      date: Date.now() - 180 * 24 * 60 * 60 * 1000,
      description: 'Burst pipe in bathroom',
      amount: 45000,
      status: 'settled',
      settlementAmount: 43500,
      deductible: 1500,
      dateSettled: Date.now() - 150 * 24 * 60 * 60 * 1000,
      documentation: ['photos', 'repair-invoices', 'plumber-report']
    });
    
    // Maintenance records
    this.maintenanceRecords.push(
      {
        id: 'maint-001',
        category: 'hvac',
        description: 'Annual HVAC system service',
        date: Date.now() - 90 * 24 * 60 * 60 * 1000,
        cost: 2500,
        provider: 'Climate Control AB',
        nextScheduled: Date.now() + 275 * 24 * 60 * 60 * 1000
      },
      {
        id: 'maint-002',
        category: 'electrical',
        description: 'Electrical safety inspection',
        date: Date.now() - 180 * 24 * 60 * 60 * 1000,
        cost: 1800,
        provider: 'ElSäkerhet Stockholm',
        nextScheduled: Date.now() + 185 * 24 * 60 * 60 * 1000
      },
      {
        id: 'maint-003',
        category: 'plumbing',
        description: 'Water heater inspection',
        date: Date.now() - 60 * 24 * 60 * 60 * 1000,
        cost: 800,
        provider: 'Rörjour 24',
        nextScheduled: Date.now() + 305 * 24 * 60 * 60 * 1000
      }
    );
    
    // Inspections
    this.inspections.push({
      id: 'inspect-001',
      type: 'home-insurance',
      date: Date.now() - 200 * 24 * 60 * 60 * 1000,
      inspector: 'Folksam Inspector',
      result: 'passed',
      findings: [
        'All safety equipment present and functional',
        'Property well-maintained',
        'Eligible for smart home discount'
      ],
      nextScheduled: Date.now() + 165 * 24 * 60 * 60 * 1000
    });
  }
  
  async initialize() {
    try {
      await this.loadSettings();
      this.startMonitoring();
      await this.assessRisk();
      
      this.emit('notification', {
        type: 'info',
        priority: 'low',
        title: 'Insurance & Risk System',
        message: `Monitoring ${this.insurancePolicies.size} policy(ies)`
      });
      
      return { success: true, policies: this.insurancePolicies.size };
    } catch (error) {
      this.emit('notification', {
        type: 'error',
        priority: 'high',
        title: 'Insurance System Error',
        message: `Failed to initialize: ${error.message}`
      });
      throw error;
    }
  }
  
  async assessRisk() {
    if (!this.settings.autoRiskAssessment) {
      throw new Error('Auto risk assessment is disabled');
    }
    
    const factors = Array.from(this.riskFactors.values());
    
    // Calculate overall score (weighted average)
    const weights = { fire: 0.3, water: 0.25, security: 0.25, weather: 0.2 };
    let weightedScore = 0;
    
    for (const factor of factors) {
      const weight = weights[factor.category] || 0.25;
      weightedScore += factor.currentScore * weight;
    }
    
    const overallScore = Math.round(weightedScore);
    
    // Determine risk level
    let riskLevel;
    if (overallScore >= 80) riskLevel = 'low';
    else if (overallScore >= 60) riskLevel = 'medium';
    else if (overallScore >= 40) riskLevel = 'high';
    else riskLevel = 'critical';
    
    // Generate recommendations
    const recommendations = [];
    
    for (const factor of factors) {
      if (factor.currentScore < 70) {
        // Find specific weak points
        for (const [key, value] of Object.entries(factor.factors)) {
          if (value.score < 70) {
            recommendations.push({
              category: factor.category,
              priority: value.score < 50 ? 'high' : 'medium',
              issue: `${key} needs attention`,
              suggestion: this.getRecommendation(factor.category, key, value)
            });
          }
        }
      }
    }
    
    this.currentRiskProfile = {
      overallScore,
      riskLevel,
      factors: Object.fromEntries(factors.map(f => [f.category, {
        score: f.currentScore,
        level: f.riskLevel
      }])),
      lastAssessment: Date.now(),
      recommendations
    };
    
    await this.saveSettings();
    this.clearCache();
    
    return { success: true, riskProfile: this.currentRiskProfile };
  }
  
  getRecommendation(category, issue, value) {
    const recommendations = {
      fire: {
        electricalSafety: 'Schedule electrical inspection within 30 days',
        heatingSystem: 'Service heating system before winter season'
      },
      water: {
        plumbing: 'Consider comprehensive plumbing inspection and pipe replacement',
        basement: 'Install backup sump pump and water alarm'
      },
      security: {
        lighting: 'Add motion-activated outdoor lighting',
        cameras: 'Ensure all entry points have camera coverage'
      },
      weather: {
        windProtection: 'Consider installing storm shutters for windows',
        stormDamage: 'Roof inspection recommended'
      }
    };
    
    return recommendations[category]?.[issue] || 'Consult with professional for assessment';
  }
  
  async fileClaim(policyId, type, description, estimatedAmount, documentation = []) {
    const policy = this.insurancePolicies.get(policyId);
    if (!policy) throw new Error(`Policy ${policyId} not found`);
    
    if (policy.status !== 'active') {
      throw new Error('Policy is not active');
    }
    
    const claimId = `claim-${Date.now()}`;
    
    const claim = {
      id: claimId,
      policyId,
      type,
      date: Date.now(),
      description,
      amount: estimatedAmount,
      status: 'submitted',
      deductible: policy.deductible,
      documentation,
      updates: [
        { timestamp: Date.now(), status: 'submitted', note: 'Claim filed' }
      ]
    };
    
    this.claims.unshift(claim);
    
    this.emit('notification', {
      type: 'warning',
      priority: 'high',
      title: '📋 Insurance Claim Filed',
      message: `Claim for ${type} submitted to ${policy.provider}`
    });
    
    await this.saveSettings();
    this.clearCache();
    
    return { success: true, claimId, claim };
  }
  
  async addMaintenanceRecord(category, description, cost, provider, nextScheduled = null) {
    const record = {
      id: `maint-${Date.now()}`,
      category,
      description,
      date: Date.now(),
      cost,
      provider,
      nextScheduled: nextScheduled || Date.now() + 365 * 24 * 60 * 60 * 1000
    };
    
    this.maintenanceRecords.unshift(record);
    
    // Update risk assessment based on maintenance
    const riskFactor = this.riskFactors.get(this.getCategoryRisk(category));
    if (riskFactor) {
      // Improve score slightly for proactive maintenance
      riskFactor.currentScore = Math.min(100, riskFactor.currentScore + 2);
      await this.assessRisk();
    }
    
    this.emit('notification', {
      type: 'success',
      priority: 'low',
      title: 'Maintenance Recorded',
      message: `${description} - ${cost} SEK`
    });
    
    await this.saveSettings();
    return { success: true, record };
  }
  
  getCategoryRisk(maintenanceCategory) {
    const mapping = {
      'hvac': 'fire',
      'electrical': 'fire',
      'plumbing': 'water',
      'roof': 'weather',
      'security': 'security'
    };
    return mapping[maintenanceCategory] || 'fire';
  }
  
  getInsuranceStatistics() {
    const cached = this.getCached('insurance-stats');
    if (cached) return cached;
    
    const policies = Array.from(this.insurancePolicies.values());
    const activePolicies = policies.filter(p => p.status === 'active');
    
    const totalPremium = activePolicies.reduce((sum, p) => sum + p.premium, 0);
    const totalCoverage = activePolicies.reduce((sum, p) => sum + p.coverageAmount, 0);
    
    const totalDiscounts = activePolicies.reduce((sum, p) => {
      if (!p.discounts) return sum;
      return sum + p.discounts.reduce((s, d) => s + d.amount, 0);
    }, 0);
    
    const expiringPolicies = activePolicies.filter(p => 
      p.endDate - Date.now() < 60 * 24 * 60 * 60 * 1000 // < 60 days
    );
    
    const recentClaims = this.claims.filter(c => 
      Date.now() - c.date < 365 * 24 * 60 * 60 * 1000 // Last year
    );
    
    const stats = {
      policies: {
        total: policies.length,
        active: activePolicies.length,
        expiringSoon: expiringPolicies.length
      },
      financial: {
        totalPremium,
        totalCoverage,
        averageDiscount: activePolicies.length > 0 ? totalDiscounts / activePolicies.length : 0
      },
      claims: {
        total: this.claims.length,
        lastYear: recentClaims.length,
        pending: this.claims.filter(c => c.status === 'submitted' || c.status === 'processing').length,
        settled: this.claims.filter(c => c.status === 'settled').length
      },
      risk: {
        overallScore: this.currentRiskProfile.overallScore,
        level: this.currentRiskProfile.riskLevel,
        factors: this.currentRiskProfile.factors,
        recommendations: this.currentRiskProfile.recommendations.length
      },
      maintenance: {
        recordsTotal: this.maintenanceRecords.length,
        lastYear: this.maintenanceRecords.filter(m => 
          Date.now() - m.date < 365 * 24 * 60 * 60 * 1000
        ).length,
        upcoming: this.maintenanceRecords.filter(m => 
          m.nextScheduled && m.nextScheduled < Date.now() + 30 * 24 * 60 * 60 * 1000
        ).length
      }
    };
    
    this.setCached('insurance-stats', stats);
    return stats;
  }
  
  startMonitoring() {
    if (this.monitoring.interval) clearInterval(this.monitoring.interval);
    this.monitoring.interval = setInterval(() => this.monitorInsurance(), this.monitoring.checkInterval);
  }
  
  monitorInsurance() {
    this.monitoring.lastCheck = Date.now();
    
    // Check for expiring policies
    for (const [id, policy] of this.insurancePolicies) {
      const daysUntilExpiry = (policy.endDate - Date.now()) / (24 * 60 * 60 * 1000);
      
      if (daysUntilExpiry < 30 && daysUntilExpiry > 0) {
        this.emit('notification', {
          type: 'warning',
          priority: 'high',
          title: 'Policy Expiring Soon',
          message: `${policy.type} policy expires in ${Math.floor(daysUntilExpiry)} days`
        });
      }
    }
    
    // Check for upcoming maintenance
    if (this.settings.preventiveMaintenanceReminders) {
      for (const record of this.maintenanceRecords) {
        if (record.nextScheduled) {
          const daysUntil = (record.nextScheduled - Date.now()) / (24 * 60 * 60 * 1000);
          
          if (daysUntil < 14 && daysUntil > 0) {
            this.emit('notification', {
              type: 'info',
              priority: 'medium',
              title: 'Maintenance Due',
              message: `${record.description} scheduled in ${Math.floor(daysUntil)} days`
            });
          }
        }
      }
    }
    
    // Re-assess risk periodically
    const daysSinceAssessment = (Date.now() - this.currentRiskProfile.lastAssessment) / (24 * 60 * 60 * 1000);
    if (daysSinceAssessment > 7) {
      this.assessRisk();
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
      const settings = Homey.ManagerSettings.get('smartHomeInsuranceRiskAssessmentSystem');
      if (settings) {
        this.insurancePolicies = new Map(settings.insurancePolicies || []);
        this.riskFactors = new Map(settings.riskFactors || []);
        this.claims = settings.claims || [];
        this.maintenanceRecords = settings.maintenanceRecords || [];
        this.inspections = settings.inspections || [];
        Object.assign(this.settings, settings.settings || {});
        Object.assign(this.currentRiskProfile, settings.currentRiskProfile || {});
      }
    } catch (error) {
      console.error('Failed to load insurance settings:', error);
    }
  }
  
  async saveSettings() {
    try {
      const settings = {
        insurancePolicies: Array.from(this.insurancePolicies.entries()),
        riskFactors: Array.from(this.riskFactors.entries()),
        claims: this.claims.slice(0, 50),
        maintenanceRecords: this.maintenanceRecords.slice(0, 100),
        inspections: this.inspections.slice(0, 20),
        settings: this.settings,
        currentRiskProfile: this.currentRiskProfile
      };
      Homey.ManagerSettings.set('smartHomeInsuranceRiskAssessmentSystem', settings);
    } catch (error) {
      console.error('Failed to save insurance settings:', error);
      throw error;
    }
  }
  
  getPolicies() { return Array.from(this.insurancePolicies.values()); }
  getRiskFactors() { return Array.from(this.riskFactors.values()); }
  getClaims(limit = 20) { return this.claims.slice(0, limit); }
  getMaintenanceRecords(limit = 50) { return this.maintenanceRecords.slice(0, limit); }
  getCurrentRiskProfile() { return this.currentRiskProfile; }
}

module.exports = SmartHomeInsuranceRiskAssessmentSystem;
