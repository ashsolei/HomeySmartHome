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

const SmartHomeInsuranceRiskAssessmentSystem = require('../lib/SmartHomeInsuranceRiskAssessmentSystem');

/* ================================================================== */
/*  SmartHomeInsuranceRiskAssessmentSystem – test suite                */
/* ================================================================== */

describe('SmartHomeInsuranceRiskAssessmentSystem — constructor & init', () => {
  it('instantiates without errors', () => {
    const sys = new SmartHomeInsuranceRiskAssessmentSystem(createMockHomey());
    assert(sys, 'should create instance');
    cleanup(sys);
  });

  it('starts with initialized=false', () => {
    const sys = new SmartHomeInsuranceRiskAssessmentSystem(createMockHomey());
    assertEqual(sys.initialized, false);
    cleanup(sys);
  });

  it('has 10 risk categories', () => {
    const sys = new SmartHomeInsuranceRiskAssessmentSystem(createMockHomey());
    assertEqual(Object.keys(sys.riskCategories).length, 10);
    cleanup(sys);
  });

  it('has 3 insurance policies', () => {
    const sys = new SmartHomeInsuranceRiskAssessmentSystem(createMockHomey());
    assertEqual(Object.keys(sys.insurancePolicies).length, 3);
    cleanup(sys);
  });

  it('initialize sets initialized flag and starts intervals', () => {
    const sys = new SmartHomeInsuranceRiskAssessmentSystem(createMockHomey());
    sys.initialize();
    assertEqual(sys.initialized, true);
    assert(sys.intervals.length > 0, 'should have active intervals');
    cleanup(sys);
  });

  it('initialize computes composite risk score', () => {
    const sys = new SmartHomeInsuranceRiskAssessmentSystem(createMockHomey());
    sys.initialize();
    assertType(sys.compositeRiskScore, 'number');
    assert(sys.compositeRiskScore >= 0 && sys.compositeRiskScore <= 100, 'score should be 0-100');
    cleanup(sys);
  });

  it('destroy clears intervals', () => {
    const sys = new SmartHomeInsuranceRiskAssessmentSystem(createMockHomey());
    sys.initialize();
    sys.destroy();
    assertEqual(sys.intervals.length, 0);
    cleanup(sys);
  });
});

describe('SmartHomeInsuranceRiskAssessmentSystem — risk assessment', () => {
  it('getRiskCategory returns details for valid category', () => {
    const sys = new SmartHomeInsuranceRiskAssessmentSystem(createMockHomey());
    sys.initialize();
    const fire = sys.getRiskCategory('fire');
    assert(fire, 'should return fire risk');
    assertType(fire.probability, 'number');
    assertType(fire.potentialCostSEK, 'number');
    assert(fire.mitigationFactors.length > 0, 'should have mitigation factors');
    assertType(fire.mitigationRatio, 'number');
    cleanup(sys);
  });

  it('getRiskCategory returns null for unknown category', () => {
    const sys = new SmartHomeInsuranceRiskAssessmentSystem(createMockHomey());
    sys.initialize();
    assertEqual(sys.getRiskCategory('volcano'), null);
    cleanup(sys);
  });

  it('risk assessment sets lastAssessed on all categories', () => {
    const sys = new SmartHomeInsuranceRiskAssessmentSystem(createMockHomey());
    sys.initialize();
    for (const risk of Object.values(sys.riskCategories)) {
      assert(risk.lastAssessed !== null, 'lastAssessed should be set');
    }
    cleanup(sys);
  });

  it('risk history is populated after initialization', () => {
    const sys = new SmartHomeInsuranceRiskAssessmentSystem(createMockHomey());
    sys.initialize();
    assert(sys.riskHistory.length > 0, 'should have risk history entries');
    assert(sys.riskHistory[0].score !== undefined, 'entry should have score');
    assert(sys.riskHistory[0].breakdown, 'entry should have breakdown');
    cleanup(sys);
  });
});

describe('SmartHomeInsuranceRiskAssessmentSystem — claims management', () => {
  it('createClaim returns a claim object', () => {
    const sys = new SmartHomeInsuranceRiskAssessmentSystem(createMockHomey());
    sys.initialize();
    const claim = sys.createClaim('water-damage', 'Pipe burst in bathroom', 50000);
    assert(claim, 'should return claim');
    assert(claim.claimId.startsWith('CLM-'), 'claimId should start with CLM-');
    assertEqual(claim.status, 'draft');
    assertEqual(claim.estimatedCostSEK, 50000);
    assert(claim.requiredDocuments.length > 0, 'should have required documents');
    cleanup(sys);
  });

  it('submitClaim transitions status to submitted', () => {
    const sys = new SmartHomeInsuranceRiskAssessmentSystem(createMockHomey());
    sys.initialize();
    const claim = sys.createClaim('burglary', 'Window broken', 30000);
    const result = sys.submitClaim(claim.claimId);
    assertEqual(result, true);
    assertEqual(claim.status, 'submitted');
    cleanup(sys);
  });

  it('submitClaim fails for already submitted claim', () => {
    const sys = new SmartHomeInsuranceRiskAssessmentSystem(createMockHomey());
    sys.initialize();
    const claim = sys.createClaim('fire', 'Kitchen fire', 100000);
    sys.submitClaim(claim.claimId);
    const result = sys.submitClaim(claim.claimId);
    assertEqual(result, false);
    cleanup(sys);
  });

  it('updateClaimStatus respects valid transitions', () => {
    const sys = new SmartHomeInsuranceRiskAssessmentSystem(createMockHomey());
    sys.initialize();
    const claim = sys.createClaim('storm', 'Roof damage', 40000);
    sys.submitClaim(claim.claimId);
    assertEqual(sys.updateClaimStatus(claim.claimId, 'under-review'), true);
    assertEqual(sys.updateClaimStatus(claim.claimId, 'approved', { approvedAmount: 38000 }), true);
    assertEqual(claim.approvedAmountSEK, 38000);
    cleanup(sys);
  });

  it('updateClaimStatus rejects invalid transitions', () => {
    const sys = new SmartHomeInsuranceRiskAssessmentSystem(createMockHomey());
    sys.initialize();
    const claim = sys.createClaim('mold', 'Bathroom mold', 60000);
    assertEqual(sys.updateClaimStatus(claim.claimId, 'approved'), false);
    cleanup(sys);
  });

  it('paid claim moves to claimsHistory', () => {
    const sys = new SmartHomeInsuranceRiskAssessmentSystem(createMockHomey());
    sys.initialize();
    const initialHistoryLen = sys.claimsHistory.length;
    const claim = sys.createClaim('burglary', 'Theft', 20000);
    sys.submitClaim(claim.claimId);
    sys.updateClaimStatus(claim.claimId, 'under-review');
    sys.updateClaimStatus(claim.claimId, 'approved', { approvedAmount: 18000 });
    sys.updateClaimStatus(claim.claimId, 'paid', { paidAmount: 16500 });
    assertEqual(sys.claimsHistory.length, initialHistoryLen + 1);
    assertEqual(sys.activeClaims.length, 0);
    cleanup(sys);
  });
});

describe('SmartHomeInsuranceRiskAssessmentSystem — sensor readings', () => {
  it('updateSensorReading updates known sensor type', () => {
    const sys = new SmartHomeInsuranceRiskAssessmentSystem(createMockHomey());
    sys.initialize();
    const result = sys.updateSensorReading('smoke', { detected: true });
    assertEqual(result, true);
    assertEqual(sys.sensorReadings.smoke.detected, true);
    assert(sys.sensorReadings.smoke.lastReading !== null, 'lastReading should be set');
    cleanup(sys);
  });

  it('updateSensorReading returns false for unknown type', () => {
    const sys = new SmartHomeInsuranceRiskAssessmentSystem(createMockHomey());
    sys.initialize();
    assertEqual(sys.updateSensorReading('seismic', {}), false);
    cleanup(sys);
  });
});

describe('SmartHomeInsuranceRiskAssessmentSystem — maintenance', () => {
  it('recordMaintenance updates task and recalculates risk', () => {
    const sys = new SmartHomeInsuranceRiskAssessmentSystem(createMockHomey());
    sys.initialize();
    const result = sys.recordMaintenance('chimneySweep', '2026-02-15', 'Cleaned thoroughly');
    assertEqual(result, true);
    assertEqual(sys.maintenanceSchedule.chimneySweep.lastCompleted, '2026-02-15');
    assert(sys.maintenanceSchedule.chimneySweep.nextDue !== null, 'nextDue should be updated');
    cleanup(sys);
  });

  it('recordMaintenance returns false for unknown task', () => {
    const sys = new SmartHomeInsuranceRiskAssessmentSystem(createMockHomey());
    sys.initialize();
    assertEqual(sys.recordMaintenance('unknownTask'), false);
    cleanup(sys);
  });
});

describe('SmartHomeInsuranceRiskAssessmentSystem — documents & valuation', () => {
  it('addDocument adds to vault', () => {
    const sys = new SmartHomeInsuranceRiskAssessmentSystem(createMockHomey());
    sys.initialize();
    const initialLen = sys.documentVault.length;
    const doc = sys.addDocument({ type: 'receipt', filename: 'test.pdf', category: 'receipts', sizeMB: 1.5 });
    assert(doc, 'should return document');
    assert(doc.id.startsWith('DOC-'), 'id should start with DOC-');
    assertEqual(sys.documentVault.length, initialLen + 1);
    cleanup(sys);
  });

  it('getEmergencyCostEstimate returns valid estimate', () => {
    const sys = new SmartHomeInsuranceRiskAssessmentSystem(createMockHomey());
    sys.initialize();
    const est = sys.getEmergencyCostEstimate('fire');
    assert(est, 'should return estimate');
    assertType(est.costs.totalEstimateSEK, 'number');
    assert(est.insuranceCoverage, 'should have insurance coverage details');
    cleanup(sys);
  });

  it('getEmergencyCostEstimate returns null for unknown type', () => {
    const sys = new SmartHomeInsuranceRiskAssessmentSystem(createMockHomey());
    sys.initialize();
    assertEqual(sys.getEmergencyCostEstimate('earthquake'), null);
    cleanup(sys);
  });
});

describe('SmartHomeInsuranceRiskAssessmentSystem — reports & analytics', () => {
  it('getPolicySummary returns all policies', () => {
    const sys = new SmartHomeInsuranceRiskAssessmentSystem(createMockHomey());
    sys.initialize();
    const summary = sys.getPolicySummary();
    assertEqual(summary.policies.length, 3);
    assertType(summary.totalMonthlyPremium, 'number');
    assertType(summary.totalAnnualPremium, 'number');
    assertType(summary.totalCoverage, 'number');
    cleanup(sys);
  });

  it('getStatistics returns comprehensive stats', () => {
    const sys = new SmartHomeInsuranceRiskAssessmentSystem(createMockHomey());
    sys.initialize();
    const stats = sys.getStatistics();
    assertEqual(stats.initialized, true);
    assertType(stats.compositeRiskScore, 'number');
    assertEqual(stats.activePolicies, 3);
    assertType(stats.totalMonthlyPremiumSEK, 'number');
    assertType(stats.smartHomeDiscountPercent, 'number');
    assert(stats.riskCategories, 'should have risk categories');
    assert(stats.complianceStatus, 'should have compliance status');
    assert(stats.mitigationInvestments, 'should have mitigation investments');
    cleanup(sys);
  });

  it('generateAnnualReport produces valid report', () => {
    const sys = new SmartHomeInsuranceRiskAssessmentSystem(createMockHomey());
    sys.initialize();
    const report = sys.generateAnnualReport();
    assert(report, 'should return report');
    assert(report.reportId.startsWith('RPT-'), 'should have report ID');
    assert(report.financialSummary, 'should have financial summary');
    assert(report.riskTrends, 'should have risk trends');
    assert(report.maintenanceSummary, 'should have maintenance summary');
    assert(report.claimsSummary, 'should have claims summary');
    assert(report.recommendations, 'should have recommendations');
    cleanup(sys);
  });

  it('analyzeMitigationROI returns sorted analysis', () => {
    const sys = new SmartHomeInsuranceRiskAssessmentSystem(createMockHomey());
    sys.initialize();
    const analysis = sys.analyzeMitigationROI();
    assert(Array.isArray(analysis), 'should return array');
    assert(analysis.length > 0, 'should have investments');
    for (const item of analysis) {
      assertType(item.totalCostSEK, 'number');
      assertType(item.fiveYearROIPercent, 'number');
      assert(item.recommendation, 'should have recommendation');
    }
    cleanup(sys);
  });
});

run();
