'use strict';

/**
 * Smart Home Insurance Optimizer
 * Insurance management and risk optimization
 */
class SmartHomeInsuranceOptimizer {
  constructor(app) {
    this.app = app;
    this.insurancePolicies = new Map();
    this.riskFactors = new Map();
    this.claims = [];
    this.safetyMeasures = new Map();
    this.discounts = [];
    this.recommendations = [];
  }

  async initialize() {
    await this.setupInsurancePolicies();
    await this.setupRiskFactors();
    await this.setupSafetyMeasures();
    await this.analyzeCoverage();
    
    this.startMonitoring();
  }

  // ============================================
  // INSURANCE POLICIES
  // ============================================

  async setupInsurancePolicies() {
    const policies = [
      {
        id: 'home_insurance',
        name: 'Hemförsäkring',
        provider: 'Folksam',
        policyNumber: 'HEM-2024-12345',
        type: 'comprehensive',
        startDate: Date.now() - 365 * 24 * 60 * 60 * 1000, // 1 year ago
        renewalDate: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
        premium: 3500, // SEK per year
        deductible: 1500,
        coverage: {
          property: 2500000,
          contents: 1000000,
          liability: 5000000,
          accidentalDamage: true,
          waterDamage: true,
          fire: true,
          theft: true,
          naturalDisaster: true
        },
        discounts: ['smart_home', 'security_system']
      },
      {
        id: 'electronics_insurance',
        name: 'Elektronikförsäkring',
        provider: 'If',
        policyNumber: 'ELE-2024-67890',
        type: 'electronics',
        startDate: Date.now() - 180 * 24 * 60 * 60 * 1000,
        renewalDate: Date.now() + 185 * 24 * 60 * 60 * 1000,
        premium: 1200,
        deductible: 500,
        coverage: {
          smartphones: 25000,
          computers: 50000,
          tablets: 15000,
          cameras: 20000,
          smartHome: 30000
        },
        discounts: ['multi_device']
      },
      {
        id: 'vehicle_insurance',
        name: 'Bilförsäkring',
        provider: 'Trygg-Hansa',
        policyNumber: 'VEH-2024-11223',
        type: 'comprehensive',
        startDate: Date.now() - 270 * 24 * 60 * 60 * 1000,
        renewalDate: Date.now() + 95 * 24 * 60 * 60 * 1000,
        premium: 5400,
        deductible: 2000,
        coverage: {
          vehicle: 350000,
          liability: 10000000,
          theft: true,
          damage: true,
          roadside: true
        },
        discounts: ['low_mileage', 'ev_discount']
      }
    ];

    for (const policy of policies) {
      this.insurancePolicies.set(policy.id, {
        ...policy,
        claimsHistory: [],
        totalClaimed: 0,
        riskScore: 0
      });
    }
  }

  async calculateTotalPremiums() {
    let total = 0;
    
    for (const [policyId, policy] of this.insurancePolicies) {
      total += policy.premium;
    }

    return {
      annual: total,
      monthly: (total / 12).toFixed(0),
      policies: this.insurancePolicies.size
    };
  }

  // ============================================
  // RISK ASSESSMENT
  // ============================================

  async setupRiskFactors() {
    const factors = [
      {
        id: 'fire_risk',
        name: 'Brandrisk',
        category: 'safety',
        currentLevel: 'low',
        score: 15, // 0-100
        factors: [
          { name: 'Smoke detectors', status: 'installed', impact: -10 },
          { name: 'Fire extinguisher', status: 'present', impact: -5 },
          { name: 'Electrical inspection', status: 'current', impact: -5 },
          { name: 'Kitchen monitoring', status: 'active', impact: -10 }
        ],
        lastAssessment: Date.now() - 30 * 24 * 60 * 60 * 1000
      },
      {
        id: 'water_damage_risk',
        name: 'Vattenskaderisk',
        category: 'property',
        currentLevel: 'medium',
        score: 35,
        factors: [
          { name: 'Water sensors', status: 'installed', impact: -15 },
          { name: 'Automatic shut-off', status: 'installed', impact: -10 },
          { name: 'Regular inspection', status: 'overdue', impact: +10 },
          { name: 'Old plumbing', status: 'yes', impact: +15 }
        ],
        lastAssessment: Date.now() - 60 * 24 * 60 * 60 * 1000
      },
      {
        id: 'burglary_risk',
        name: 'Inbrottsrisk',
        category: 'security',
        currentLevel: 'low',
        score: 20,
        factors: [
          { name: 'Security system', status: 'professional', impact: -20 },
          { name: 'Cameras', status: '4 units', impact: -10 },
          { name: 'Smart locks', status: 'installed', impact: -10 },
          { name: 'Motion sensors', status: 'extensive', impact: -15 },
          { name: 'Neighborhood watch', status: 'active', impact: -5 }
        ],
        lastAssessment: Date.now() - 14 * 24 * 60 * 60 * 1000
      },
      {
        id: 'liability_risk',
        name: 'Ansvarighetsrisk',
        category: 'liability',
        currentLevel: 'low',
        score: 25,
        factors: [
          { name: 'Tripping hazards', status: 'minimal', impact: -5 },
          { name: 'Pool/spa', status: 'none', impact: 0 },
          { name: 'Dog', status: 'none', impact: 0 },
          { name: 'Regular maintenance', status: 'good', impact: -10 }
        ],
        lastAssessment: Date.now() - 90 * 24 * 60 * 60 * 1000
      },
      {
        id: 'weather_risk',
        name: 'Väderrisk',
        category: 'natural',
        currentLevel: 'medium',
        score: 40,
        factors: [
          { name: 'Storm damage history', status: 'once', impact: +10 },
          { name: 'Roof age', status: '12 years', impact: +15 },
          { name: 'Tree proximity', status: 'close', impact: +10 },
          { name: 'Weather monitoring', status: 'active', impact: -10 }
        ],
        lastAssessment: Date.now() - 45 * 24 * 60 * 60 * 1000
      }
    ];

    for (const factor of factors) {
      this.riskFactors.set(factor.id, factor);
    }
  }

  async calculateOverallRisk() {
    let totalScore = 0;
    let highRisks = [];

    for (const [factorId, factor] of this.riskFactors) {
      totalScore += factor.score;

      if (factor.score >= 60) {
        highRisks.push({
          name: factor.name,
          score: factor.score,
          level: 'high'
        });
      } else if (factor.score >= 40) {
        highRisks.push({
          name: factor.name,
          score: factor.score,
          level: 'medium'
        });
      }
    }

    const averageScore = totalScore / this.riskFactors.size;

    return {
      overallScore: averageScore.toFixed(0),
      riskLevel: averageScore < 25 ? 'low' :
                 averageScore < 50 ? 'medium' : 'high',
      highRisks,
      totalFactors: this.riskFactors.size
    };
  }

  // ============================================
  // SAFETY MEASURES
  // ============================================

  async setupSafetyMeasures() {
    const measures = [
      {
        id: 'smoke_detectors',
        name: 'Brandvarnare',
        category: 'fire',
        status: 'installed',
        count: 6,
        lastTested: Date.now() - 30 * 24 * 60 * 60 * 1000,
        testInterval: 90, // days
        insuranceDiscount: 10 // %
      },
      {
        id: 'security_system',
        name: 'Larmsystem',
        category: 'security',
        status: 'active',
        provider: 'Verisure',
        lastService: Date.now() - 60 * 24 * 60 * 60 * 1000,
        serviceInterval: 365,
        insuranceDiscount: 20
      },
      {
        id: 'water_sensors',
        name: 'Vattensensorer',
        category: 'water',
        status: 'installed',
        count: 8,
        lastTested: Date.now() - 45 * 24 * 60 * 60 * 1000,
        testInterval: 180,
        insuranceDiscount: 15
      },
      {
        id: 'fire_extinguisher',
        name: 'Brandsläckare',
        category: 'fire',
        status: 'current',
        count: 2,
        lastInspection: Date.now() - 90 * 24 * 60 * 60 * 1000,
        inspectionInterval: 365,
        insuranceDiscount: 5
      },
      {
        id: 'smart_locks',
        name: 'Smarta lås',
        category: 'security',
        status: 'installed',
        count: 3,
        lastUpdate: Date.now() - 15 * 24 * 60 * 60 * 1000,
        insuranceDiscount: 10
      },
      {
        id: 'cameras',
        name: 'Övervakningskameror',
        category: 'security',
        status: 'active',
        count: 4,
        recording: true,
        lastMaintenance: Date.now() - 120 * 24 * 60 * 60 * 1000,
        insuranceDiscount: 15
      }
    ];

    for (const measure of measures) {
      this.safetyMeasures.set(measure.id, measure);
    }
  }

  async calculatePotentialDiscounts() {
    let totalDiscount = 0;
    const activeDiscounts = [];

    for (const [measureId, measure] of this.safetyMeasures) {
      if (measure.status === 'installed' || measure.status === 'active' || measure.status === 'current') {
        totalDiscount += measure.insuranceDiscount;
        activeDiscounts.push({
          measure: measure.name,
          discount: measure.insuranceDiscount + '%'
        });
      }
    }

    // Cap discount at 30%
    totalDiscount = Math.min(totalDiscount, 30);

    const premiums = await this.calculateTotalPremiums();
    const annualSavings = (premiums.annual * totalDiscount / 100).toFixed(0);

    return {
      totalDiscount: totalDiscount + '%',
      annualSavings: annualSavings + ' SEK',
      activeDiscounts,
      appliedTo: this.insurancePolicies.size + ' policies'
    };
  }

  // ============================================
  // CLAIMS MANAGEMENT
  // ============================================

  async fileClaim(policyId, data) {
    const policy = this.insurancePolicies.get(policyId);
    
    if (!policy) {
      return { success: false, error: 'Policy not found' };
    }

    const claim = {
      id: `claim_${Date.now()}`,
      policyId,
      policyName: policy.name,
      type: data.type,
      date: Date.now(),
      incidentDate: data.incidentDate || Date.now(),
      description: data.description,
      estimatedAmount: data.estimatedAmount,
      status: 'submitted',
      documentation: data.documentation || []
    };

    this.claims.push(claim);
    policy.claimsHistory.push(claim.id);

    console.log(`📋 Claim filed: ${claim.type} (${claim.estimatedAmount} SEK)`);

    return { success: true, claim };
  }

  async updateClaimStatus(claimId, status, approvedAmount = null) {
    const claim = this.claims.find(c => c.id === claimId);
    
    if (!claim) {
      return { success: false, error: 'Claim not found' };
    }

    claim.status = status;
    
    if (status === 'approved' && approvedAmount) {
      claim.approvedAmount = approvedAmount;
      claim.payoutAmount = approvedAmount - this.insurancePolicies.get(claim.policyId).deductible;
      
      // Update policy
      const policy = this.insurancePolicies.get(claim.policyId);
      policy.totalClaimed += claim.payoutAmount;
      
      console.log(`✅ Claim approved: ${claim.payoutAmount} SEK payout`);
    }

    return { success: true, claim };
  }

  // ============================================
  // COVERAGE ANALYSIS
  // ============================================

  async analyzeCoverage() {
    console.log('🔍 Analyzing insurance coverage...');

    const gaps = [];

    // Check home coverage vs property value
    const homePolicy = this.insurancePolicies.get('home_insurance');
    const estimatedPropertyValue = 3000000; // SEK
    
    if (homePolicy && homePolicy.coverage.property < estimatedPropertyValue) {
      gaps.push({
        type: 'underinsured',
        policy: 'Hemförsäkring',
        issue: 'Fastighetsvärde underskattat',
        current: homePolicy.coverage.property,
        recommended: estimatedPropertyValue,
        priority: 'high'
      });
    }

    // Check electronics coverage
    const electronicsPolicy = this.insurancePolicies.get('electronics_insurance');
    const estimatedElectronicsValue = 150000;
    
    if (electronicsPolicy) {
      const totalCoverage = Object.values(electronicsPolicy.coverage).reduce((sum, v) => sum + v, 0);
      
      if (totalCoverage < estimatedElectronicsValue) {
        gaps.push({
          type: 'insufficient',
          policy: 'Elektronikförsäkring',
          issue: 'Otillräckligt skydd för elektronik',
          current: totalCoverage,
          recommended: estimatedElectronicsValue,
          priority: 'medium'
        });
      }
    }

    // Check for missing coverage types
    const hasCyberInsurance = false;
    if (!hasCyberInsurance) {
      gaps.push({
        type: 'missing',
        policy: 'Cyberförsäkring',
        issue: 'Ingen identitetsstöldskydd',
        current: 0,
        recommended: 'Consider adding',
        priority: 'low'
      });
    }

    console.log(`  Found ${gaps.length} coverage gaps`);

    return gaps;
  }

  // ============================================
  // RECOMMENDATIONS
  // ============================================

  async generateRecommendations() {
    console.log('💡 Generating insurance recommendations...');

    const recommendations = [];

    // Check renewal dates
    for (const [policyId, policy] of this.insurancePolicies) {
      const daysUntilRenewal = Math.ceil((policy.renewalDate - Date.now()) / (24 * 60 * 60 * 1000));
      
      if (daysUntilRenewal <= 60 && daysUntilRenewal > 0) {
        recommendations.push({
          type: 'renewal',
          priority: daysUntilRenewal <= 30 ? 'high' : 'medium',
          policy: policy.name,
          message: `Förnyelse inom ${daysUntilRenewal} dagar`,
          action: 'Jämför priser från andra försäkringsbolag'
        });
      }
    }

    // Check safety measure testing
    for (const [measureId, measure] of this.safetyMeasures) {
      if (measure.lastTested) {
        const daysSinceTest = Math.ceil((Date.now() - measure.lastTested) / (24 * 60 * 60 * 1000));
        
        if (daysSinceTest >= measure.testInterval) {
          recommendations.push({
            type: 'maintenance',
            priority: 'medium',
            policy: 'Hemförsäkring',
            message: `Testa ${measure.name}`,
            action: `Senast testad för ${daysSinceTest} dagar sedan`
          });
        }
      }
    }

    // Check risk factors
    const overallRisk = await this.calculateOverallRisk();
    
    if (overallRisk.highRisks.length > 0) {
      for (const risk of overallRisk.highRisks) {
        recommendations.push({
          type: 'risk_reduction',
          priority: risk.level === 'high' ? 'high' : 'medium',
          policy: 'Allmän',
          message: `Minska ${risk.name}`,
          action: 'Implementera säkerhetsåtgärder'
        });
      }
    }

    // Check for available discounts
    const discounts = await this.calculatePotentialDiscounts();
    const currentTotal = await this.calculateTotalPremiums();
    const potentialSavings = parseFloat(discounts.annualSavings);

    if (potentialSavings > 500) {
      recommendations.push({
        type: 'savings',
        priority: 'high',
        policy: 'Alla',
        message: `Spara ${potentialSavings} SEK/år`,
        action: 'Informera försäkringsbolag om säkerhetsåtgärder'
      });
    }

    this.recommendations = recommendations;

    return recommendations;
  }

  // ============================================
  // MONITORING
  // ============================================

  startMonitoring() {
    // Check renewals daily
    setInterval(() => {
      this.checkRenewals();
    }, 24 * 60 * 60 * 1000);

    // Update risk assessment weekly
    setInterval(() => {
      const day = new Date().getDay();
      if (day === 1) { // Monday
        this.updateRiskAssessment();
      }
    }, 24 * 60 * 60 * 1000);

    // Generate recommendations monthly
    setInterval(() => {
      const date = new Date().getDate();
      if (date === 1) {
        this.generateRecommendations();
      }
    }, 24 * 60 * 60 * 1000);

    // Initial recommendations
    this.generateRecommendations();
  }

  async checkRenewals() {
    console.log('📅 Checking policy renewals...');

    const now = Date.now();

    for (const [policyId, policy] of this.insurancePolicies) {
      const daysUntilRenewal = Math.ceil((policy.renewalDate - now) / (24 * 60 * 60 * 1000));

      if (daysUntilRenewal === 60) {
        console.log(`  📢 ${policy.name}: 60 days until renewal - Start comparing offers`);
      } else if (daysUntilRenewal === 30) {
        console.log(`  ⚠️ ${policy.name}: 30 days until renewal - Make decision soon`);
      } else if (daysUntilRenewal === 7) {
        console.log(`  🚨 ${policy.name}: 7 days until renewal - Urgent action needed`);
      }
    }
  }

  async updateRiskAssessment() {
    console.log('🔍 Updating risk assessment...');

    for (const [factorId, factor] of this.riskFactors) {
      // Recalculate score based on current factors
      let newScore = 50; // Base score

      for (const subFactor of factor.factors) {
        newScore += subFactor.impact;
      }

      factor.score = Math.max(0, Math.min(100, newScore));
      factor.lastAssessment = Date.now();

      // Update level
      if (factor.score < 30) {
        factor.currentLevel = 'low';
      } else if (factor.score < 60) {
        factor.currentLevel = 'medium';
      } else {
        factor.currentLevel = 'high';
      }

      console.log(`  ${factor.name}: ${factor.score} (${factor.currentLevel})`);
    }
  }

  // ============================================
  // REPORTING
  // ============================================

  getInsuranceOverview() {
    const premiums = this.calculateTotalPremiums();
    const discounts = this.calculatePotentialDiscounts();
    const overallRisk = this.calculateOverallRisk();

    return {
      policies: this.insurancePolicies.size,
      annualPremium: premiums.annual + ' SEK',
      monthlyPremium: premiums.monthly + ' SEK',
      totalClaims: this.claims.length,
      riskLevel: overallRisk.riskLevel,
      recommendations: this.recommendations.length
    };
  }

  getPoliciesList() {
    return Array.from(this.insurancePolicies.values()).map(p => ({
      name: p.name,
      provider: p.provider,
      premium: p.premium + ' SEK/år',
      deductible: p.deductible + ' SEK',
      renewal: new Date(p.renewalDate).toLocaleDateString('sv-SE'),
      daysUntilRenewal: Math.ceil((p.renewalDate - Date.now()) / (24 * 60 * 60 * 1000))
    }));
  }

  getRiskReport() {
    return Array.from(this.riskFactors.values()).map(r => ({
      risk: r.name,
      level: r.currentLevel,
      score: r.score,
      category: r.category
    })).sort((a, b) => b.score - a.score);
  }

  getSafetyMeasures() {
    return Array.from(this.safetyMeasures.values()).map(m => ({
      measure: m.name,
      status: m.status,
      discount: m.insuranceDiscount + '%',
      nextCheck: m.lastTested ? 
        new Date(m.lastTested + m.testInterval * 24 * 60 * 60 * 1000).toLocaleDateString('sv-SE') : 
        'N/A'
    }));
  }

  getClaimHistory() {
    return this.claims
      .sort((a, b) => b.date - a.date)
      .slice(0, 10)
      .map(c => ({
        date: new Date(c.date).toLocaleDateString('sv-SE'),
        type: c.type,
        policy: c.policyName,
        amount: c.estimatedAmount + ' SEK',
        status: c.status
      }));
  }
}

module.exports = SmartHomeInsuranceOptimizer;
