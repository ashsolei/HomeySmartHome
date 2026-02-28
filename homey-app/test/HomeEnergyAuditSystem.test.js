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

const HomeEnergyAuditSystem = require('../lib/HomeEnergyAuditSystem');

describe('EnergyAudit — constructor & lifecycle', () => {
  it('instantiates without errors', () => {
    const sys = new HomeEnergyAuditSystem(createMockHomey());
    assert(sys, 'should create instance');
    cleanup(sys);
  });

  it('constructor sets defaults', () => {
    const sys = new HomeEnergyAuditSystem(createMockHomey());
    assertEqual(sys.initialized, false);
    assertType(sys.electricityPrice, 'number');
    assert(sys.property, 'should have property info');
    assertType(sys.property.totalArea, 'number');
    cleanup(sys);
  });

  it('initialize populates all data', async () => {
    const sys = new HomeEnergyAuditSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.initialized, true);
    assert(Object.keys(sys.rooms).length > 0, 'should have rooms');
    assert(Object.keys(sys.appliances).length > 0, 'should have appliances');
    assert(sys.recommendations.length > 0, 'should have recommendations');
    cleanup(sys);
  });

  it('destroy clears intervals', async () => {
    const sys = new HomeEnergyAuditSystem(createMockHomey());
    await sys.initialize();
    sys.destroy();
    cleanup(sys);
  });
});

describe('EnergyAudit — room analysis', () => {
  it('getRoomAnalysis returns all rooms', async () => {
    const sys = new HomeEnergyAuditSystem(createMockHomey());
    await sys.initialize();
    const analysis = sys.getRoomAnalysis();
    assert(analysis, 'should return analysis');
    assert(Object.keys(analysis).length > 0, 'should have rooms');
    cleanup(sys);
  });

  it('getRoomAnalysis returns specific room', async () => {
    const sys = new HomeEnergyAuditSystem(createMockHomey());
    await sys.initialize();
    const roomNames = Object.keys(sys.rooms);
    const room = sys.getRoomAnalysis(roomNames[0]);
    assert(room, 'should return room');
    cleanup(sys);
  });
});

describe('EnergyAudit — appliances', () => {
  it('getApplianceReport returns all appliances', async () => {
    const sys = new HomeEnergyAuditSystem(createMockHomey());
    await sys.initialize();
    const report = sys.getApplianceReport();
    assert(report, 'should return report');
    cleanup(sys);
  });

  it('getApplianceReport returns specific appliance', async () => {
    const sys = new HomeEnergyAuditSystem(createMockHomey());
    await sys.initialize();
    const appIds = Object.keys(sys.appliances);
    const app = sys.getApplianceReport(appIds[0]);
    assert(app, 'should return appliance');
    cleanup(sys);
  });
});

describe('EnergyAudit — audits', () => {
  it('getInsulationAudit returns insulation data', async () => {
    const sys = new HomeEnergyAuditSystem(createMockHomey());
    await sys.initialize();
    const audit = sys.getInsulationAudit();
    assert(audit, 'should return audit');
    cleanup(sys);
  });

  it('getHeatingAudit returns heating data', async () => {
    const sys = new HomeEnergyAuditSystem(createMockHomey());
    await sys.initialize();
    const audit = sys.getHeatingAudit();
    assert(audit, 'should return audit');
    cleanup(sys);
  });

  it('getTariffOptimization returns tariff data', async () => {
    const sys = new HomeEnergyAuditSystem(createMockHomey());
    await sys.initialize();
    const tariff = sys.getTariffOptimization();
    assert(tariff, 'should return tariff');
    cleanup(sys);
  });

  it('getWasteDetections returns array', async () => {
    const sys = new HomeEnergyAuditSystem(createMockHomey());
    await sys.initialize();
    const waste = sys.getWasteDetections();
    assert(Array.isArray(waste), 'should be array');
    cleanup(sys);
  });

  it('getSeasonalProfile returns profile', async () => {
    const sys = new HomeEnergyAuditSystem(createMockHomey());
    await sys.initialize();
    const profile = sys.getSeasonalProfile();
    assert(profile, 'should return profile');
    cleanup(sys);
  });

  it('getRenewableAssessment returns assessment', async () => {
    const sys = new HomeEnergyAuditSystem(createMockHomey());
    await sys.initialize();
    const assessment = sys.getRenewableAssessment();
    assert(assessment, 'should return assessment');
    cleanup(sys);
  });
});

describe('EnergyAudit — recommendations & carbon', () => {
  it('getRecommendations returns all recommendations', async () => {
    const sys = new HomeEnergyAuditSystem(createMockHomey());
    await sys.initialize();
    const recs = sys.getRecommendations();
    assert(Array.isArray(recs), 'should be array');
    assert(recs.length > 0, 'should have recommendations');
    cleanup(sys);
  });

  it('getRecommendations filters by category', async () => {
    const sys = new HomeEnergyAuditSystem(createMockHomey());
    await sys.initialize();
    const recs = sys.getRecommendations();
    if (recs.length > 0) {
      const cat = recs[0].category;
      const filtered = sys.getRecommendations({ category: cat });
      for (const r of filtered) {
        assertEqual(r.category, cat);
      }
    }
    cleanup(sys);
  });

  it('getCarbonFootprint returns data', async () => {
    const sys = new HomeEnergyAuditSystem(createMockHomey());
    await sys.initialize();
    const carbon = sys.getCarbonFootprint();
    assert(carbon, 'should return carbon data');
    cleanup(sys);
  });

  it('getBenchmarks returns data', async () => {
    const sys = new HomeEnergyAuditSystem(createMockHomey());
    await sys.initialize();
    const benchmarks = sys.getBenchmarks();
    assert(benchmarks, 'should return benchmarks');
    cleanup(sys);
  });
});

describe('EnergyAudit — reports & projections', () => {
  it('generateAuditReport returns comprehensive report', async () => {
    const sys = new HomeEnergyAuditSystem(createMockHomey());
    await sys.initialize();
    const report = sys.generateAuditReport();
    assert(report, 'should return report');
    assert(report.reportId, 'should have reportId');
    assert(report.executiveSummary, 'should have executiveSummary');
    assert(report.roomAnalysis, 'should have roomAnalysis');
    cleanup(sys);
  });

  it('getAuditHistory returns history', async () => {
    const sys = new HomeEnergyAuditSystem(createMockHomey());
    await sys.initialize();
    const history = sys.getAuditHistory();
    assert(Array.isArray(history), 'should be array');
    cleanup(sys);
  });

  it('getCostProjections returns projections', async () => {
    const sys = new HomeEnergyAuditSystem(createMockHomey());
    await sys.initialize();
    const projections = sys.getCostProjections();
    assert(projections, 'should return projections');
    cleanup(sys);
  });

  it('getSmartMeterData returns readings', async () => {
    const sys = new HomeEnergyAuditSystem(createMockHomey());
    await sys.initialize();
    const data = sys.getSmartMeterData();
    assert(Array.isArray(data), 'should be array');
    cleanup(sys);
  });

  it('getEPCSimulation returns simulation', async () => {
    const sys = new HomeEnergyAuditSystem(createMockHomey());
    await sys.initialize();
    const epc = sys.getEPCSimulation();
    assert(epc, 'should return EPC simulation');
    assert(epc.currentRating, 'should have current rating');
    cleanup(sys);
  });

  it('getLoadShiftingOpportunities returns opportunities', async () => {
    const sys = new HomeEnergyAuditSystem(createMockHomey());
    await sys.initialize();
    const result = sys.getLoadShiftingOpportunities();
    assert(result, 'should return load shifting data');
    assert(Array.isArray(result.opportunities), 'should have opportunities array');
    cleanup(sys);
  });
});

describe('EnergyAudit — statistics', () => {
  it('getStatistics returns comprehensive stats', async () => {
    const sys = new HomeEnergyAuditSystem(createMockHomey());
    await sys.initialize();
    const stats = sys.getStatistics();
    assert(stats, 'should return stats');
    assertEqual(stats.initialized, true);
    assert(stats.rooms, 'should have rooms');
    assert(stats.appliances, 'should have appliances');
    assert(stats.recommendations, 'should have recommendations');
    cleanup(sys);
  });
});

run();
