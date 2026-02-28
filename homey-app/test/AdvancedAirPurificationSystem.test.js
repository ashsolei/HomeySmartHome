'use strict';

const { describe, it, run } = require('./helpers/runner');
const {
  assert, assertEqual, assertType, assertInstanceOf,
  assertRejects
} = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');
const EventEmitter = require('events');

const AdvancedAirPurificationSystem = require('../lib/AdvancedAirPurificationSystem');

/* ──── helpers ──── */
function createSystem() {
  const homey = createMockHomey();
  const sys = new AdvancedAirPurificationSystem(homey);
  return { homey, sys };
}

function cleanup(sys) {
  if (sys.monitoringInterval) {
    clearInterval(sys.monitoringInterval);
    sys.monitoringInterval = null;
  }
  sys.removeAllListeners();
}

/* ================================================================
   TESTS
   ================================================================ */

describe('AdvancedAirPurificationSystem — constructor', () => {
  it('creates an instance extending EventEmitter', () => {
    const { sys } = createSystem();
    assertInstanceOf(sys, EventEmitter);
    cleanup(sys);
  });

  it('initializes zones as an empty Map', () => {
    const { sys } = createSystem();
    assertInstanceOf(sys.zones, Map);
    assertEqual(sys.zones.size, 0);
    cleanup(sys);
  });

  it('initializes purifiers as an empty Map', () => {
    const { sys } = createSystem();
    assertInstanceOf(sys.purifiers, Map);
    assertEqual(sys.purifiers.size, 0);
    cleanup(sys);
  });

  it('initializes airQualityHistory as an empty array', () => {
    const { sys } = createSystem();
    assert(Array.isArray(sys.airQualityHistory));
    assertEqual(sys.airQualityHistory.length, 0);
    cleanup(sys);
  });

  it('initializes automationRules as an empty array', () => {
    const { sys } = createSystem();
    assert(Array.isArray(sys.automationRules));
    assertEqual(sys.automationRules.length, 0);
    cleanup(sys);
  });

  it('sets monitoringInterval to null', () => {
    const { sys } = createSystem();
    assertEqual(sys.monitoringInterval, null);
    cleanup(sys);
  });
});

describe('AdvancedAirPurificationSystem — initialize()', () => {
  it('returns true on success', async () => {
    const { sys } = createSystem();
    const result = await sys.initialize();
    assertEqual(result, true);
    cleanup(sys);
  });

  it('populates default zones', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assert(sys.zones.size > 0, 'zones should not be empty');
    cleanup(sys);
  });

  it('populates default purifiers', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assert(sys.purifiers.size > 0, 'purifiers should not be empty');
    cleanup(sys);
  });

  it('populates automation rules', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assert(sys.automationRules.length > 0, 'rules should not be empty');
    cleanup(sys);
  });

  it('starts monitoring interval', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assert(sys.monitoringInterval !== null);
    cleanup(sys);
  });
});

describe('AdvancedAirPurificationSystem — initializeDefaultZones()', () => {
  it('creates 3 default zones', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.zones.size, 3);
    cleanup(sys);
  });

  it('has living-room zone', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const zone = sys.zones.get('living-room');
    assert(zone !== undefined);
    assertEqual(zone.name, 'Vardagsrum');
    assertEqual(zone.size, 40);
    cleanup(sys);
  });

  it('has bedroom zone', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const zone = sys.zones.get('bedroom');
    assert(zone !== undefined);
    assertEqual(zone.name, 'Sovrum');
    assertEqual(zone.size, 20);
    cleanup(sys);
  });

  it('has kitchen zone', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const zone = sys.zones.get('kitchen');
    assert(zone !== undefined);
    assertEqual(zone.name, 'Kök');
    assertEqual(zone.size, 15);
    cleanup(sys);
  });

  it('each zone has airQuality readings', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    for (const zone of sys.zones.values()) {
      const aq = zone.airQuality;
      assert(aq !== undefined, `${zone.name} should have airQuality`);
      assertType(aq.aqi, 'number');
      assertType(aq.pm25, 'number');
      assertType(aq.co2, 'number');
      assertType(aq.voc, 'number');
      assert(aq.overall !== undefined, 'should have overall quality');
    }
    cleanup(sys);
  });

  it('each zone has thresholds', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    for (const zone of sys.zones.values()) {
      assert(zone.thresholds !== undefined, `${zone.name} should have thresholds`);
      assert(zone.thresholds.aqi !== undefined);
      assert(zone.thresholds.pm25 !== undefined);
    }
    cleanup(sys);
  });

  it('does not recreate zones if already populated', async () => {
    const { homey, sys } = createSystem();
    const savedData = {
      zones: [{ id: 'custom-zone', name: 'Custom', size: 10, airQuality: { aqi: 50 }, thresholds: {}, purifierIds: [] }],
      purifiers: [],
      airQualityHistory: [],
      automationRules: []
    };
    homey.settings.set('advancedAirPurification', savedData);
    await sys.initialize();
    assert(sys.zones.has('custom-zone'), 'should keep custom zone');
    cleanup(sys);
  });
});

describe('AdvancedAirPurificationSystem — initializeDefaultPurifiers()', () => {
  it('creates 3 default purifiers', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.purifiers.size, 3);
    cleanup(sys);
  });

  it('has purifier-living', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const p = sys.purifiers.get('purifier-living');
    assert(p !== undefined);
    assertEqual(p.model, 'AirPro 3000');
    assertEqual(p.zoneId, 'living-room');
    cleanup(sys);
  });

  it('has purifier-bedroom', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const p = sys.purifiers.get('purifier-bedroom');
    assert(p !== undefined);
    assertEqual(p.model, 'SleepAir 2000');
    assertEqual(p.zoneId, 'bedroom');
    cleanup(sys);
  });

  it('has purifier-kitchen', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const p = sys.purifiers.get('purifier-kitchen');
    assert(p !== undefined);
    assertEqual(p.model, 'KitchenPure 1500');
    assertEqual(p.zoneId, 'kitchen');
    cleanup(sys);
  });

  it('purifiers have filters with lifespan data', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    for (const purifier of sys.purifiers.values()) {
      assert(purifier.filters !== undefined, `${purifier.name} should have filters`);
      assert(purifier.filters.hepa !== undefined, 'should have HEPA filter');
      assertType(purifier.filters.hepa.lifespan, 'number');
      assertType(purifier.filters.hepa.used, 'number');
      assertType(purifier.filters.hepa.remaining, 'number');
    }
    cleanup(sys);
  });

  it('purifiers have capabilities', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    for (const purifier of sys.purifiers.values()) {
      assert(purifier.capabilities !== undefined, `${purifier.name} should have capabilities`);
      assertType(purifier.capabilities.pm25Sensor, 'boolean');
      assertType(purifier.capabilities.hepaFilter, 'boolean');
    }
    cleanup(sys);
  });

  it('purifiers have performance stats', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    for (const purifier of sys.purifiers.values()) {
      assert(purifier.performance !== undefined);
      assertType(purifier.performance.cadr, 'number');
      assertType(purifier.performance.noiseLevel, 'number');
      assertType(purifier.performance.powerConsumption, 'number');
    }
    cleanup(sys);
  });
});

describe('AdvancedAirPurificationSystem — initializeAutomationRules()', () => {
  it('creates 6 default automation rules', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.automationRules.length, 6);
    cleanup(sys);
  });

  it('rules have id, name, enabled, priority', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    for (const rule of sys.automationRules) {
      assertType(rule.id, 'string');
      assertType(rule.name, 'string');
      assertType(rule.enabled, 'boolean');
      assertType(rule.priority, 'number');
    }
    cleanup(sys);
  });

  it('rules have condition and action', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    for (const rule of sys.automationRules) {
      assert(rule.condition !== undefined, `${rule.id} should have condition`);
      assert(rule.action !== undefined, `${rule.id} should have action`);
    }
    cleanup(sys);
  });
});

describe('AdvancedAirPurificationSystem — calculateAQI()', () => {
  it('returns low AQI for low PM2.5', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const aqi = sys.calculateAQI(5);
    assert(aqi < 50, 'AQI should be good for pm25=5');
    cleanup(sys);
  });

  it('returns 0 for pm25=0', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const aqi = sys.calculateAQI(0);
    assertEqual(aqi, 0);
    cleanup(sys);
  });

  it('returns ~50 at pm25=12 breakpoint', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const aqi = sys.calculateAQI(12);
    // 12 * 4.17 ≈ 50
    assert(aqi >= 49 && aqi <= 51, `AQI at pm25=12 should be ~50, got ${aqi}`);
    cleanup(sys);
  });

  it('returns 100 at pm25=35.4', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const aqi = sys.calculateAQI(35.4);
    assert(aqi >= 99 && aqi <= 101, `AQI at pm25=35.4 should be ~100, got ${aqi}`);
    cleanup(sys);
  });

  it('increases with higher PM2.5', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const low = sys.calculateAQI(10);
    const mid = sys.calculateAQI(40);
    const high = sys.calculateAQI(100);
    assert(low < mid, 'AQI should increase with PM2.5');
    assert(mid < high, 'AQI should increase with PM2.5');
    cleanup(sys);
  });
});

describe('AdvancedAirPurificationSystem — determineOverallQuality()', () => {
  it('returns excellent for AQI <= 50', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.determineOverallQuality(30), 'excellent');
    assertEqual(sys.determineOverallQuality(50), 'excellent');
    cleanup(sys);
  });

  it('returns good for 51-100', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.determineOverallQuality(75), 'good');
    assertEqual(sys.determineOverallQuality(100), 'good');
    cleanup(sys);
  });

  it('returns moderate for 101-150', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.determineOverallQuality(120), 'moderate');
    cleanup(sys);
  });

  it('returns poor for 151-200', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.determineOverallQuality(180), 'poor');
    cleanup(sys);
  });

  it('returns very-poor for 201-300', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.determineOverallQuality(250), 'very-poor');
    cleanup(sys);
  });

  it('returns hazardous for > 300', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.determineOverallQuality(350), 'hazardous');
    cleanup(sys);
  });
});

describe('AdvancedAirPurificationSystem — compareValue()', () => {
  it('handles greater operator', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.compareValue(10, 5, 'greater'), true);
    assertEqual(sys.compareValue(5, 10, 'greater'), false);
    assertEqual(sys.compareValue(5, 5, 'greater'), false);
    cleanup(sys);
  });

  it('handles less operator', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.compareValue(3, 5, 'less'), true);
    assertEqual(sys.compareValue(10, 5, 'less'), false);
    cleanup(sys);
  });

  it('handles equal operator', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.compareValue(5, 5, 'equal'), true);
    assertEqual(sys.compareValue(4, 5, 'equal'), false);
    cleanup(sys);
  });

  it('returns false for unknown operator', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.compareValue(5, 5, 'unknown'), false);
    cleanup(sys);
  });
});

describe('AdvancedAirPurificationSystem — setPurifierMode()', () => {
  it('throws for unknown purifier', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    await assertRejects(
      () => sys.setPurifierMode('nonexistent', 'high'),
      'Luftrenare hittades inte'
    );
    cleanup(sys);
  });

  it('changes purifier mode', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    await sys.setPurifierMode('purifier-living', 'high');
    assertEqual(sys.purifiers.get('purifier-living').mode, 'high');
    cleanup(sys);
  });

  it('sets fan speed based on mode', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    await sys.setPurifierMode('purifier-living', 'sleep');
    assertEqual(sys.purifiers.get('purifier-living').fanSpeed, 25);
    await sys.setPurifierMode('purifier-living', 'high');
    assertEqual(sys.purifiers.get('purifier-living').fanSpeed, 80);
    cleanup(sys);
  });

  it('emits purifierModeChanged event', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    let emitted = false;
    sys.on('purifierModeChanged', (data) => {
      emitted = true;
      assertEqual(data.purifierId, 'purifier-living');
      assertEqual(data.mode, 'medium');
    });
    await sys.setPurifierMode('purifier-living', 'medium');
    assertEqual(emitted, true);
    cleanup(sys);
  });

  it('returns the updated purifier', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const result = await sys.setPurifierMode('purifier-living', 'low');
    assertEqual(result.mode, 'low');
    assertEqual(result.id, 'purifier-living');
    cleanup(sys);
  });
});

describe('AdvancedAirPurificationSystem — setPurifierFanSpeed()', () => {
  it('throws for unknown purifier', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    await assertRejects(
      () => sys.setPurifierFanSpeed('nonexistent', 50),
      'Luftrenare hittades inte'
    );
    cleanup(sys);
  });

  it('sets fan speed and mode to manual', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    await sys.setPurifierFanSpeed('purifier-living', 75);
    const p = sys.purifiers.get('purifier-living');
    assertEqual(p.fanSpeed, 75);
    assertEqual(p.mode, 'manual');
    cleanup(sys);
  });

  it('clamps speed to 0-100 range', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    await sys.setPurifierFanSpeed('purifier-living', 150);
    assertEqual(sys.purifiers.get('purifier-living').fanSpeed, 100);
    await sys.setPurifierFanSpeed('purifier-living', -10);
    assertEqual(sys.purifiers.get('purifier-living').fanSpeed, 0);
    cleanup(sys);
  });
});

describe('AdvancedAirPurificationSystem — replaceFilter()', () => {
  it('throws for unknown purifier', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    await assertRejects(
      () => sys.replaceFilter('nonexistent', 'hepa'),
      'Luftrenare hittades inte'
    );
    cleanup(sys);
  });

  it('throws for unknown filter type', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    await assertRejects(
      () => sys.replaceFilter('purifier-living', 'nonexistent'),
      'Filter hittades inte'
    );
    cleanup(sys);
  });

  it('resets filter used to 0 and remaining to lifespan', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const result = await sys.replaceFilter('purifier-living', 'hepa');
    const hepa = result.filters.hepa;
    assertEqual(hepa.used, 0);
    assertEqual(hepa.remaining, hepa.lifespan);
    cleanup(sys);
  });

  it('updates lastReplaced date', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const result = await sys.replaceFilter('purifier-living', 'hepa');
    const today = new Date().toISOString().split('T')[0];
    assertEqual(result.filters.hepa.lastReplaced, today);
    cleanup(sys);
  });

  it('emits notification on filter replacement', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    let notified = false;
    sys.on('notification', (data) => {
      if (data.category === 'maintenance' && data.title === 'Filter bytt') {
        notified = true;
      }
    });
    await sys.replaceFilter('purifier-living', 'hepa');
    assertEqual(notified, true);
    cleanup(sys);
  });
});

describe('AdvancedAirPurificationSystem — getZones()', () => {
  it('returns an array of zones', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const zones = sys.getZones();
    assert(Array.isArray(zones));
    assertEqual(zones.length, 3);
    cleanup(sys);
  });

  it('returns empty array before init', () => {
    const { sys } = createSystem();
    const zones = sys.getZones();
    assert(Array.isArray(zones));
    assertEqual(zones.length, 0);
    cleanup(sys);
  });
});

describe('AdvancedAirPurificationSystem — getZone()', () => {
  it('returns zone for valid id', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const zone = sys.getZone('living-room');
    assert(zone !== undefined);
    assertEqual(zone.name, 'Vardagsrum');
    cleanup(sys);
  });

  it('returns undefined for unknown id', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.getZone('unknown'), undefined);
    cleanup(sys);
  });
});

describe('AdvancedAirPurificationSystem — getPurifiers()', () => {
  it('returns an array of purifiers', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const purifiers = sys.getPurifiers();
    assert(Array.isArray(purifiers));
    assertEqual(purifiers.length, 3);
    cleanup(sys);
  });
});

describe('AdvancedAirPurificationSystem — getPurifier()', () => {
  it('returns purifier for valid id', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const p = sys.getPurifier('purifier-bedroom');
    assert(p !== undefined);
    assertEqual(p.model, 'SleepAir 2000');
    cleanup(sys);
  });

  it('returns undefined for unknown id', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assertEqual(sys.getPurifier('unknown'), undefined);
    cleanup(sys);
  });
});

describe('AdvancedAirPurificationSystem — getAirQualityHistory()', () => {
  it('returns empty array initially', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const history = sys.getAirQualityHistory();
    assert(Array.isArray(history));
    cleanup(sys);
  });

  it('filters by time window', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const now = Date.now();
    sys.airQualityHistory.push(
      { zoneId: 'living-room', timestamp: now - 1000, aqi: 40 },
      { zoneId: 'living-room', timestamp: now - 100000000, aqi: 80 } // old
    );
    const history = sys.getAirQualityHistory(null, 1); // last 1 hour
    assertEqual(history.length, 1);
    cleanup(sys);
  });

  it('filters by zoneId', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const now = Date.now();
    sys.airQualityHistory.push(
      { zoneId: 'living-room', timestamp: now - 1000, aqi: 40 },
      { zoneId: 'bedroom', timestamp: now - 1000, aqi: 35 }
    );
    const history = sys.getAirQualityHistory('living-room', 24);
    assertEqual(history.length, 1);
    assertEqual(history[0].zoneId, 'living-room');
    cleanup(sys);
  });
});

describe('AdvancedAirPurificationSystem — getStats()', () => {
  it('returns stats with expected keys', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const stats = sys.getStats();
    assert('zones' in stats);
    assert('purifiers' in stats);
    assert('activePurifiers' in stats);
    assert('averageAQI' in stats);
    assert('overallQuality' in stats);
    assert('totalAirCleaned' in stats);
    assert('filtersDueReplacement' in stats);
    assert('byZone' in stats);
    cleanup(sys);
  });

  it('counts zones and purifiers correctly', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const stats = sys.getStats();
    assertEqual(stats.zones, 3);
    assertEqual(stats.purifiers, 3);
    cleanup(sys);
  });

  it('counts active purifiers (status on)', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const stats = sys.getStats();
    assertEqual(stats.activePurifiers, 3); // all default purifiers are 'on'
    cleanup(sys);
  });

  it('calculates average AQI across zones', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const stats = sys.getStats();
    assertType(stats.averageAQI, 'number');
    assert(!isNaN(stats.averageAQI), 'AQI should not be NaN');
    cleanup(sys);
  });

  it('byZone has entries for each zone', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const stats = sys.getStats();
    assertEqual(stats.byZone.length, 3);
    for (const z of stats.byZone) {
      assertType(z.name, 'string');
      assertType(z.aqi, 'number');
      assert(z.quality !== undefined);
    }
    cleanup(sys);
  });

  it('totalAirCleaned sums all purifier stats', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const stats = sys.getStats();
    // 96000 + 80000 + 54000 = 230000
    assertEqual(stats.totalAirCleaned, 230000);
    cleanup(sys);
  });
});

describe('AdvancedAirPurificationSystem — getFiltersDueReplacement()', () => {
  it('returns array of filters with <= 20% remaining', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const filters = sys.getFiltersDueReplacement();
    assert(Array.isArray(filters));
    // Check any filters that are near replacement
    for (const f of filters) {
      assert(f.percentRemaining <= 20);
      assertType(f.purifierId, 'string');
      assertType(f.filterType, 'string');
    }
    cleanup(sys);
  });

  it('includes carbon filter of purifier-kitchen (390/2190 ≈ 17.8%)', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    const filters = sys.getFiltersDueReplacement();
    const kitchenCarbon = filters.find(f => f.purifierId === 'purifier-kitchen' && f.filterType === 'carbon');
    assert(kitchenCarbon !== undefined, 'kitchen carbon filter should be due for replacement');
    cleanup(sys);
  });
});

describe('AdvancedAirPurificationSystem — saveSettings()', () => {
  it('saves to homey settings', async () => {
    const { homey, sys } = createSystem();
    await sys.initialize();
    await sys.saveSettings();
    const saved = homey.settings.get('advancedAirPurification');
    assert(saved !== null);
    cleanup(sys);
  });

  it('limits airQualityHistory to 1000 entries', async () => {
    const { homey, sys } = createSystem();
    await sys.initialize();
    for (let i = 0; i < 1200; i++) {
      sys.airQualityHistory.push({ zoneId: 'z', timestamp: Date.now(), aqi: 50 });
    }
    await sys.saveSettings();
    const saved = homey.settings.get('advancedAirPurification');
    assert(saved.airQualityHistory.length <= 1000, 'should trim to 1000');
    cleanup(sys);
  });
});

describe('AdvancedAirPurificationSystem — destroy()', () => {
  it('clears monitoring interval', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assert(sys.monitoringInterval !== null);
    await sys.destroy();
    // interval should have been cleared (no crash)
  });

  it('removes all listeners', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    sys.on('test', () => {});
    assertEqual(sys.listenerCount('test'), 1);
    await sys.destroy();
    assertEqual(sys.listenerCount('test'), 0);
  });

  it('can be called multiple times', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    await sys.destroy();
    await sys.destroy(); // should not throw
  });
});

run();
