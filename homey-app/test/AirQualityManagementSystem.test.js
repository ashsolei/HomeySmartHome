'use strict';

const { describe, it, run } = require('./helpers/runner');
const {
  assert, assertEqual, assertInstanceOf
} = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');

const AirQualityManagementSystem = require('../lib/AirQualityManagementSystem');

/* ──── helpers ──── */
function createSystem(devices = []) {
  const homey = createMockHomey();
  // AirQualityManagementSystem uses homey.drivers.getDevices() which is not in the default mock
  homey.drivers = {
    getDevices: () => devices
  };
  const sys = new AirQualityManagementSystem(homey);
  return { homey, sys };
}

function cleanup(sys) {
  if (sys.monitoringInterval) {
    clearInterval(sys.monitoringInterval);
    sys.monitoringInterval = null;
  }
  if (sys.automationInterval) {
    clearInterval(sys.automationInterval);
    sys.automationInterval = null;
  }
  if (sys.maintenanceInterval) {
    clearInterval(sys.maintenanceInterval);
    sys.maintenanceInterval = null;
  }
}

function mockSensor(id, name, capabilities = {}) {
  return {
    id,
    name,
    capabilities: Object.keys(capabilities),
    hasCapability: (cap) => cap in capabilities,
    getCapabilityValue: async (cap) => capabilities[cap] ?? null,
    setCapabilityValue: async () => {},
    zone: { name: 'test-zone' }
  };
}

/* ================================================================
   TESTS
   ================================================================ */

describe('AirQualityManagementSystem — constructor', () => {
  it('creates an instance', () => {
    const { sys } = createSystem();
    assert(sys !== null);
    cleanup(sys);
  });

  it('initializes airQualitySensors as an empty Map', () => {
    const { sys } = createSystem();
    assertInstanceOf(sys.airQualitySensors, Map);
    assertEqual(sys.airQualitySensors.size, 0);
    cleanup(sys);
  });

  it('initializes purifiers as an empty Map', () => {
    const { sys } = createSystem();
    assertInstanceOf(sys.purifiers, Map);
    assertEqual(sys.purifiers.size, 0);
    cleanup(sys);
  });

  it('initializes ventilationSystems as an empty Map', () => {
    const { sys } = createSystem();
    assertInstanceOf(sys.ventilationSystems, Map);
    assertEqual(sys.ventilationSystems.size, 0);
    cleanup(sys);
  });

  it('initializes qualityHistory as an empty array', () => {
    const { sys } = createSystem();
    assert(Array.isArray(sys.qualityHistory));
    assertEqual(sys.qualityHistory.length, 0);
    cleanup(sys);
  });

  it('initializes alerts as an empty array', () => {
    const { sys } = createSystem();
    assert(Array.isArray(sys.alerts));
    assertEqual(sys.alerts.length, 0);
    cleanup(sys);
  });

  it('initializes automationRules as an empty Map', () => {
    const { sys } = createSystem();
    assertInstanceOf(sys.automationRules, Map);
    assertEqual(sys.automationRules.size, 0);
    cleanup(sys);
  });
});

describe('AirQualityManagementSystem — initialize()', () => {
  it('initializes without errors', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    cleanup(sys);
  });

  it('sets up default automation rules', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assert(sys.automationRules.size > 0, 'should have default rules');
    cleanup(sys);
  });

  it('starts monitoring intervals', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assert(sys.monitoringInterval !== null, 'monitoring interval should be set');
    cleanup(sys);
  });

  it('loads saved rules from settings', async () => {
    const { homey, sys } = createSystem();
    const savedRules = {
      custom_rule: { id: 'custom_rule', name: 'Custom', enabled: true, trigger: { type: 'co2', threshold: 800 }, action: { type: 'alert' } }
    };
    homey.settings.set('airQualityRules', savedRules);
    await sys.initialize();
    assert(sys.automationRules.has('custom_rule'), 'should load saved rule');
    cleanup(sys);
  });
});

describe('AirQualityManagementSystem — discoverAirQualityDevices()', () => {
  it('categorizes CO2 sensors correctly', async () => {
    const devices = [
      mockSensor('s1', 'CO2 Sensor', { measure_co2: 500 })
    ];
    const { sys } = createSystem(devices);
    await sys.initialize();
    assert(sys.airQualitySensors.size >= 1, 'should discover CO2 sensor');
    cleanup(sys);
  });

  it('categorizes PM2.5 sensors correctly', async () => {
    const devices = [
      mockSensor('s2', 'PM Sensor', { measure_pm25: 12 })
    ];
    const { sys } = createSystem(devices);
    await sys.initialize();
    assert(sys.airQualitySensors.size >= 1, 'should discover PM2.5 sensor');
    cleanup(sys);
  });

  it('categorizes purifiers by name', async () => {
    const devices = [
      mockSensor('p1', 'Air Purifier Living Room', {})
    ];
    const { sys } = createSystem(devices);
    await sys.initialize();
    assert(sys.purifiers.size >= 1, 'should discover purifier');
    cleanup(sys);
  });

  it('categorizes ventilation systems by name', async () => {
    const devices = [
      mockSensor('v1', 'Ventilation System', {})
    ];
    const { sys } = createSystem(devices);
    await sys.initialize();
    assert(sys.ventilationSystems.size >= 1, 'should discover ventilation');
    cleanup(sys);
  });

  it('handles empty device list', async () => {
    const { sys } = createSystem([]);
    await sys.initialize();
    assertEqual(sys.airQualitySensors.size, 0);
    assertEqual(sys.purifiers.size, 0);
    assertEqual(sys.ventilationSystems.size, 0);
    cleanup(sys);
  });
});

describe('AirQualityManagementSystem — setupDefaultAutomationRules()', () => {
  it('creates 5 default rules', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.automationRules.size, 5);
    cleanup(sys);
  });

  it('includes high_co2 rule', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assert(sys.automationRules.has('high_co2'), 'should have high_co2 rule');
    cleanup(sys);
  });

  it('includes poor_air_quality rule', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assert(sys.automationRules.has('poor_air_quality'), 'should have poor_air_quality rule');
    cleanup(sys);
  });

  it('includes high_voc rule', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assert(sys.automationRules.has('high_voc'));
    cleanup(sys);
  });

  it('includes night_mode rule', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assert(sys.automationRules.has('night_mode'));
    cleanup(sys);
  });

  it('includes good_outdoor_air rule', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assert(sys.automationRules.has('good_outdoor_air'));
    cleanup(sys);
  });
});

describe('AirQualityManagementSystem — calculateAirQualityScore()', () => {
  it('returns 100 for perfect readings', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const score = sys.calculateAirQualityScore({
      co2: 400, pm25: 5, pm10: 20, voc: 100, humidity: 50
    });
    assertEqual(score, 100);
    cleanup(sys);
  });

  it('penalizes high CO2 (>800)', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const score = sys.calculateAirQualityScore({
      co2: 900, pm25: 5, pm10: 20, voc: 100, humidity: 50
    });
    assert(score < 100, 'should be less than 100');
    assertEqual(score, 90); // 100 - 10 for co2>800
    cleanup(sys);
  });

  it('penalizes very high CO2 (>2000)', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const score = sys.calculateAirQualityScore({
      co2: 2100, pm25: 5, pm10: 20, voc: 100, humidity: 50
    });
    assert(score <= 60, 'very high CO2 should have heavy penalty');
    cleanup(sys);
  });

  it('penalizes high PM2.5 (>35)', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const score = sys.calculateAirQualityScore({
      co2: 400, pm25: 40, pm10: 20, voc: 100, humidity: 50
    });
    assert(score < 100);
    cleanup(sys);
  });

  it('penalizes high PM10 (>50)', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const score = sys.calculateAirQualityScore({
      co2: 400, pm25: 5, pm10: 60, voc: 100, humidity: 50
    });
    assert(score < 100);
    cleanup(sys);
  });

  it('penalizes high VOC (>500)', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const score = sys.calculateAirQualityScore({
      co2: 400, pm25: 5, pm10: 20, voc: 600, humidity: 50
    });
    assert(score < 100);
    cleanup(sys);
  });

  it('penalizes low humidity (<30)', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const score = sys.calculateAirQualityScore({
      co2: 400, pm25: 5, pm10: 20, voc: 100, humidity: 25
    });
    assert(score < 100);
    cleanup(sys);
  });

  it('penalizes high humidity (>70)', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const score = sys.calculateAirQualityScore({
      co2: 400, pm25: 5, pm10: 20, voc: 100, humidity: 75
    });
    assert(score < 100);
    cleanup(sys);
  });

  it('never returns below 0', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const score = sys.calculateAirQualityScore({
      co2: 3000, pm25: 200, pm10: 300, voc: 2000, humidity: 10
    });
    assert(score >= 0, 'score should never be negative');
    cleanup(sys);
  });

  it('stacks multiple penalties', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const score = sys.calculateAirQualityScore({
      co2: 1100, pm25: 40, pm10: 60, voc: 600, humidity: 75
    });
    assert(score < 50, 'multiple penalties should result in low score');
    cleanup(sys);
  });
});

describe('AirQualityManagementSystem — getAirQualityLevel()', () => {
  it('returns excellent for score >= 90', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.getAirQualityLevel(95), 'excellent');
    assertEqual(sys.getAirQualityLevel(90), 'excellent');
    cleanup(sys);
  });

  it('returns good for 70-89', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.getAirQualityLevel(85), 'good');
    assertEqual(sys.getAirQualityLevel(70), 'good');
    cleanup(sys);
  });

  it('returns moderate for 50-69', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.getAirQualityLevel(60), 'moderate');
    assertEqual(sys.getAirQualityLevel(50), 'moderate');
    cleanup(sys);
  });

  it('returns poor for 30-49', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.getAirQualityLevel(40), 'poor');
    assertEqual(sys.getAirQualityLevel(30), 'poor');
    cleanup(sys);
  });

  it('returns very_poor for < 30', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.getAirQualityLevel(20), 'very_poor');
    assertEqual(sys.getAirQualityLevel(0), 'very_poor');
    cleanup(sys);
  });
});

describe('AirQualityManagementSystem — identifyConcerns()', () => {
  it('returns empty array for good readings', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const concerns = sys.identifyConcerns({
      co2: 400, pm25: 5, voc: 100, humidity: 50
    });
    assert(Array.isArray(concerns));
    assertEqual(concerns.length, 0);
    cleanup(sys);
  });

  it('identifies high CO2', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const concerns = sys.identifyConcerns({ co2: 1200, pm25: 5, voc: 100, humidity: 50 });
    assert(concerns.length > 0);
    assert(concerns.some(c => c.type === 'co2'), 'should flag CO2');
    cleanup(sys);
  });

  it('identifies high PM2.5', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const concerns = sys.identifyConcerns({ co2: 400, pm25: 40, voc: 100, humidity: 50 });
    assert(concerns.length > 0);
    assert(concerns.some(c => c.type === 'pm25'), 'should flag PM2.5');
    cleanup(sys);
  });

  it('identifies high VOC', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const concerns = sys.identifyConcerns({ co2: 400, pm25: 5, voc: 600, humidity: 50 });
    assert(concerns.length > 0);
    assert(concerns.some(c => c.type === 'voc'), 'should flag VOC');
    cleanup(sys);
  });

  it('identifies low humidity', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const concerns = sys.identifyConcerns({ co2: 400, pm25: 5, voc: 100, humidity: 25 });
    assert(concerns.length > 0);
    assert(concerns.some(c => c.type === 'humidity'), 'should flag low humidity');
    cleanup(sys);
  });

  it('identifies high humidity', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const concerns = sys.identifyConcerns({ co2: 400, pm25: 5, voc: 100, humidity: 80 });
    assert(concerns.length > 0);
    assert(concerns.some(c => c.type === 'humidity'), 'should flag high humidity');
    cleanup(sys);
  });

  it('returns multiple concerns for bad readings', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const concerns = sys.identifyConcerns({ co2: 1500, pm25: 50, voc: 700, humidity: 80 });
    assert(concerns.length >= 3, 'should flag multiple concerns');
    cleanup(sys);
  });
});

describe('AirQualityManagementSystem — compareTrigger()', () => {
  it('handles > operator', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.compareTrigger(10, '>', 5), true);
    assertEqual(sys.compareTrigger(5, '>', 10), false);
    assertEqual(sys.compareTrigger(5, '>', 5), false);
    cleanup(sys);
  });

  it('handles < operator', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.compareTrigger(3, '<', 5), true);
    assertEqual(sys.compareTrigger(10, '<', 5), false);
    cleanup(sys);
  });

  it('handles >= operator', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.compareTrigger(5, '>=', 5), true);
    assertEqual(sys.compareTrigger(6, '>=', 5), true);
    assertEqual(sys.compareTrigger(4, '>=', 5), false);
    cleanup(sys);
  });

  it('handles <= operator', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.compareTrigger(5, '<=', 5), true);
    assertEqual(sys.compareTrigger(4, '<=', 5), true);
    assertEqual(sys.compareTrigger(6, '<=', 5), false);
    cleanup(sys);
  });

  it('handles == operator', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.compareTrigger(5, '==', 5), true);
    assertEqual(sys.compareTrigger(4, '==', 5), false);
    cleanup(sys);
  });
});

describe('AirQualityManagementSystem — getStatistics()', () => {
  it('returns statistics object with expected keys', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const stats = sys.getStatistics();
    assert('sensors' in stats);
    assert('purifiers' in stats);
    assert('ventilationSystems' in stats);
    assert('automationRules' in stats);
    assert('recentHistory' in stats);
    assert('alerts' in stats);
    cleanup(sys);
  });

  it('sensors count matches discovered sensors', async () => {
    const devices = [
      mockSensor('s1', 'CO2 Sensor', { measure_co2: 500 })
    ];
    const { sys } = createSystem(devices);
    await sys.initialize();
    const stats = sys.getStatistics();
    assertEqual(stats.sensors, sys.airQualitySensors.size);
    cleanup(sys);
  });

  it('recentHistory returns last 100 entries max', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    // Add 150 entries
    for (let i = 0; i < 150; i++) {
      sys.qualityHistory.push({ timestamp: Date.now(), score: 80 });
    }
    const stats = sys.getStatistics();
    assert(stats.recentHistory.length <= 100, 'should cap at 100');
    cleanup(sys);
  });

  it('alerts returns last 20 entries max', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    for (let i = 0; i < 30; i++) {
      sys.alerts.push({ id: i, message: 'test alert' });
    }
    const stats = sys.getStatistics();
    assert(stats.alerts.length <= 20, 'should cap at 20');
    cleanup(sys);
  });
});

describe('AirQualityManagementSystem — destroy()', () => {
  it('clears all intervals', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    sys.destroy();
    assertEqual(sys.monitoringInterval, null);
    assertEqual(sys.automationInterval, null);
    assertEqual(sys.maintenanceInterval, null);
  });

  it('can be called multiple times without error', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    sys.destroy();
    sys.destroy(); // should not throw
  });
});

run();
