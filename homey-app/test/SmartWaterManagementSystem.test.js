'use strict';

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertType } = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');

const SmartWaterManagementSystem = require('../lib/SmartWaterManagementSystem');

/* ── Helpers ─────────────────────────────────────────────────────── */

function createSystem() {
  const homey = createMockHomey();

  // SmartWaterManagementSystem accesses homey.drivers.getDevices()
  homey.drivers = {
    getDevices: () => [],
  };

  // Used by notification sending
  homey.app.advancedNotificationManager = {
    sendNotification: async () => {},
  };

  const sys = new SmartWaterManagementSystem(homey);
  return { sys, homey };
}

function createMockDevice(name, capabilities = {}, capabilityValues = {}) {
  return {
    id: `device_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    hasCapability: (cap) => cap in capabilities,
    getCapabilityValue: async (cap) => capabilityValues[cap] ?? 0,
    setCapabilityValue: async (_cap, _val) => {},
  };
}

/* ── constructor ─────────────────────────────────────────────────── */

describe('SmartWaterManagementSystem — constructor', () => {
  it('sets up initial data structures', () => {
    const { sys } = createSystem();
    assertType(sys.waterMeters, 'object'); // Map
    assertType(sys.irrigationZones, 'object');
    assertType(sys.leakDetectors, 'object');
    assert(Array.isArray(sys.consumptionHistory));
    assert(Array.isArray(sys.leakAlerts));
    assert(Array.isArray(sys.irrigationSchedule));
    assertEqual(sys.waterSavingMode, false);
  });

  it('starts with empty collections', () => {
    const { sys } = createSystem();
    assertEqual(sys.waterMeters.size, 0);
    assertEqual(sys.irrigationZones.size, 0);
    assertEqual(sys.leakDetectors.size, 0);
    assertEqual(sys.consumptionHistory.length, 0);
    assertEqual(sys.leakAlerts.length, 0);
  });
});

/* ── getZoneFromDeviceName ───────────────────────────────────────── */

describe('SmartWaterManagementSystem — getZoneFromDeviceName', () => {
  it('maps front to front_yard', () => {
    const { sys } = createSystem();
    assertEqual(sys.getZoneFromDeviceName('Front Sprinkler'), 'front_yard');
  });

  it('maps back to back_yard', () => {
    const { sys } = createSystem();
    assertEqual(sys.getZoneFromDeviceName('Back Garden Valve'), 'back_yard');
  });

  it('maps side to side_yard', () => {
    const { sys } = createSystem();
    assertEqual(sys.getZoneFromDeviceName('Side Yard Sprinkler'), 'side_yard');
  });

  it('maps garden to garden', () => {
    const { sys } = createSystem();
    assertEqual(sys.getZoneFromDeviceName('My Garden Irrigation'), 'garden');
  });

  it('maps lawn to lawn', () => {
    const { sys } = createSystem();
    assertEqual(sys.getZoneFromDeviceName('Lawn Sprinkler'), 'lawn');
  });

  it('returns general for unknown zones', () => {
    const { sys } = createSystem();
    assertEqual(sys.getZoneFromDeviceName('Some Random Device'), 'general');
  });
});

/* ── discoverWaterDevices ────────────────────────────────────────── */

describe('SmartWaterManagementSystem — discoverWaterDevices', () => {
  it('discovers water meters by name', async () => {
    const { sys, homey } = createSystem();
    const device = createMockDevice('Kitchen Water Meter', { measure_water: true }, { measure_water: 100 });
    homey.drivers.getDevices = () => [device];

    await sys.discoverWaterDevices();
    assertEqual(sys.waterMeters.size, 1);
    const meter = sys.waterMeters.get(device.id);
    assertEqual(meter.type, 'meter');
    assertEqual(meter.totalConsumption, 0); // Not read yet
  });

  it('discovers leak detectors by name', async () => {
    const { sys, homey } = createSystem();
    const device = createMockDevice('Bathroom Leak Sensor', { alarm_water: true }, { alarm_water: false });
    homey.drivers.getDevices = () => [device];

    await sys.discoverWaterDevices();
    assertEqual(sys.leakDetectors.size, 1);
    const detector = sys.leakDetectors.get(device.id);
    assertEqual(detector.type, 'leak_detector');
    assertEqual(detector.status, 'ok');
  });

  it('discovers irrigation devices by name', async () => {
    const { sys, homey } = createSystem();
    const device = createMockDevice('Front Sprinkler', { onoff: true });
    homey.drivers.getDevices = () => [device];

    await sys.discoverWaterDevices();
    assertEqual(sys.irrigationZones.size, 1);
    const zone = sys.irrigationZones.get(device.id);
    assertEqual(zone.zone, 'front_yard');
  });

  it('discovers multiple device types at once', async () => {
    const { sys, homey } = createSystem();
    const meter = createMockDevice('Water Meter Main', { meter_water: true });
    const leak = createMockDevice('Leak Detector Kitchen', { alarm_water: true });
    const sprinkler = createMockDevice('Back Sprinkler', { onoff: true });
    homey.drivers.getDevices = () => [meter, leak, sprinkler];

    await sys.discoverWaterDevices();
    assertEqual(sys.waterMeters.size, 1);
    assertEqual(sys.leakDetectors.size, 1);
    assertEqual(sys.irrigationZones.size, 1);
  });

  it('ignores unrelated devices', async () => {
    const { sys, homey } = createSystem();
    const device = createMockDevice('Living Room Light', { onoff: true });
    homey.drivers.getDevices = () => [device];

    await sys.discoverWaterDevices();
    assertEqual(sys.waterMeters.size, 0);
    assertEqual(sys.leakDetectors.size, 0);
    assertEqual(sys.irrigationZones.size, 0);
  });
});

/* ── setupDefaultIrrigationZones ─────────────────────────────────── */

describe('SmartWaterManagementSystem — setupDefaultIrrigationZones', () => {
  it('creates 3 default zones when none exist', async () => {
    const { sys } = createSystem();
    await sys.setupDefaultIrrigationZones();
    assert(sys.irrigationZones.has('zone_front_lawn'));
    assert(sys.irrigationZones.has('zone_back_garden'));
    assert(sys.irrigationZones.has('zone_vegetables'));
    assertEqual(sys.irrigationZones.size, 3);
  });

  it('does not overwrite existing zones', async () => {
    const { sys } = createSystem();
    sys.irrigationZones.set('zone_front_lawn', { id: 'zone_front_lawn', name: 'Custom' });
    await sys.setupDefaultIrrigationZones();
    assertEqual(sys.irrigationZones.get('zone_front_lawn').name, 'Custom');
  });

  it('sets correct plant types', async () => {
    const { sys } = createSystem();
    await sys.setupDefaultIrrigationZones();
    assertEqual(sys.irrigationZones.get('zone_front_lawn').plantType, 'grass');
    assertEqual(sys.irrigationZones.get('zone_back_garden').plantType, 'mixed');
    assertEqual(sys.irrigationZones.get('zone_vegetables').plantType, 'vegetables');
  });

  it('sets schedules for each zone', async () => {
    const { sys } = createSystem();
    await sys.setupDefaultIrrigationZones();
    const frontLawn = sys.irrigationZones.get('zone_front_lawn');
    assert(Array.isArray(frontLawn.schedule));
    assertEqual(frontLawn.schedule.length, 3);
    assertEqual(frontLawn.schedule[0].time, '06:00');
  });
});

/* ── isTimeToWater ───────────────────────────────────────────────── */

describe('SmartWaterManagementSystem — isTimeToWater', () => {
  it('returns true for exact match', () => {
    const { sys } = createSystem();
    assert(sys.isTimeToWater('06:00', '06:00'));
  });

  it('returns true within 10 minutes', () => {
    const { sys } = createSystem();
    assert(sys.isTimeToWater('06:05', '06:00'));
    assert(sys.isTimeToWater('05:55', '06:00'));
    assert(sys.isTimeToWater('06:10', '06:00'));
  });

  it('returns false outside 10 minutes', () => {
    const { sys } = createSystem();
    assertEqual(sys.isTimeToWater('06:15', '06:00'), false);
    assertEqual(sys.isTimeToWater('05:40', '06:00'), false);
  });

  it('returns false for very different times', () => {
    const { sys } = createSystem();
    assertEqual(sys.isTimeToWater('12:00', '06:00'), false);
    assertEqual(sys.isTimeToWater('23:00', '06:00'), false);
  });
});

/* ── shouldWaterBasedOnWeather ────────────────────────────────────── */

describe('SmartWaterManagementSystem — shouldWaterBasedOnWeather', () => {
  it('returns true when weather is good', async () => {
    const { sys } = createSystem();
    // Default getWeatherData returns no rain
    const result = await sys.shouldWaterBasedOnWeather({ soilMoisture: null });
    assert(result);
  });

  it('returns false when recent rain', async () => {
    const { sys } = createSystem();
    sys.getWeatherData = async () => ({ recentRain: true, rainExpected: false });
    const result = await sys.shouldWaterBasedOnWeather({ soilMoisture: null });
    assertEqual(result, false);
  });

  it('returns false when rain expected', async () => {
    const { sys } = createSystem();
    sys.getWeatherData = async () => ({ recentRain: false, rainExpected: true });
    const result = await sys.shouldWaterBasedOnWeather({ soilMoisture: null });
    assertEqual(result, false);
  });

  it('returns false when soil moisture is high', async () => {
    const { sys } = createSystem();
    const result = await sys.shouldWaterBasedOnWeather({ soilMoisture: 70 });
    assertEqual(result, false);
  });

  it('returns true when soil moisture is low', async () => {
    const { sys } = createSystem();
    const result = await sys.shouldWaterBasedOnWeather({ soilMoisture: 40 });
    assert(result);
  });

  it('returns true on weather data error', async () => {
    const { sys } = createSystem();
    sys.getWeatherData = async () => { throw new Error('API down'); };
    const result = await sys.shouldWaterBasedOnWeather({ soilMoisture: null });
    assert(result);
  });
});

/* ── getCurrentFlowRate ──────────────────────────────────────────── */

describe('SmartWaterManagementSystem — getCurrentFlowRate', () => {
  it('returns 0 with no meters', async () => {
    const { sys } = createSystem();
    const rate = await sys.getCurrentFlowRate();
    assertEqual(rate, 0);
  });

  it('sums flow rates from all meters', async () => {
    const { sys } = createSystem();
    sys.waterMeters.set('m1', { currentFlow: 5.5 });
    sys.waterMeters.set('m2', { currentFlow: 3.2 });
    const rate = await sys.getCurrentFlowRate();
    // Floating point tolerance
    assert(Math.abs(rate - 8.7) < 0.01);
  });

  it('handles meters with undefined flow', async () => {
    const { sys } = createSystem();
    sys.waterMeters.set('m1', { currentFlow: undefined });
    sys.waterMeters.set('m2', { currentFlow: 2 });
    const rate = await sys.getCurrentFlowRate();
    assertEqual(rate, 2);
  });
});

/* ── monitorWaterConsumption ─────────────────────────────────────── */

describe('SmartWaterManagementSystem — monitorWaterConsumption', () => {
  it('returns consumption snapshot with no meters', async () => {
    const { sys } = createSystem();
    const result = await sys.monitorWaterConsumption();
    assertEqual(result.total, 0);
    assertEqual(result.flowRate, 0);
    assertEqual(result.anomaly, false);
    assert(Array.isArray(result.meters));
  });

  it('reads measure_water capability', async () => {
    const { sys } = createSystem();
    const device = createMockDevice('Water Meter', { measure_water: true }, { measure_water: 150 });
    sys.waterMeters.set('m1', {
      id: 'm1', name: 'Water Meter', device,
      totalConsumption: 0, currentFlow: 0, lastReading: null,
    });

    const result = await sys.monitorWaterConsumption();
    assertEqual(result.total, 150);
    assertEqual(result.meters.length, 1);
    assertEqual(result.meters[0].reading, 150);
  });

  it('reads meter_water capability when measure_water missing', async () => {
    const { sys } = createSystem();
    const device = createMockDevice('Water Meter', { meter_water: true }, { meter_water: 200 });
    sys.waterMeters.set('m1', {
      id: 'm1', name: 'Water Meter', device,
      totalConsumption: 0, currentFlow: 0, lastReading: null,
    });

    const result = await sys.monitorWaterConsumption();
    assertEqual(result.total, 200);
  });

  it('calculates flow rate from previous reading', async () => {
    const { sys } = createSystem();
    const device = createMockDevice('Water Meter', { measure_water: true }, { measure_water: 110 });
    sys.waterMeters.set('m1', {
      id: 'm1', name: 'Water Meter', device,
      totalConsumption: 100, currentFlow: 0,
      lastReading: { value: 100, timestamp: Date.now() - 300000 }, // 5 min ago
    });

    const result = await sys.monitorWaterConsumption();
    // Flow = (110 - 100) / 5 = 2 L/min
    assert(result.flowRate > 1.9 && result.flowRate < 2.1);
  });

  it('flags anomaly when flow rate exceeds 50 L/min', async () => {
    const { sys } = createSystem();
    const device = createMockDevice('Water Meter', { measure_water: true }, { measure_water: 1000 });
    sys.waterMeters.set('m1', {
      id: 'm1', name: 'Water Meter', device,
      totalConsumption: 0, currentFlow: 0,
      lastReading: { value: 0, timestamp: Date.now() - 60000 }, // 1 min ago
    });

    const result = await sys.monitorWaterConsumption();
    assert(result.anomaly);
  });

  it('stores consumption in history', async () => {
    const { sys } = createSystem();
    assertEqual(sys.consumptionHistory.length, 0);
    await sys.monitorWaterConsumption();
    assertEqual(sys.consumptionHistory.length, 1);
    await sys.monitorWaterConsumption();
    assertEqual(sys.consumptionHistory.length, 2);
  });

  it('caps history at 1000 records', async () => {
    const { sys } = createSystem();
    // Pre-fill with 1000 entries
    for (let i = 0; i < 1000; i++) {
      sys.consumptionHistory.push({ timestamp: i, total: 0, flowRate: 0 });
    }
    assertEqual(sys.consumptionHistory.length, 1000);
    await sys.monitorWaterConsumption();
    assertEqual(sys.consumptionHistory.length, 1000);
  });

  it('handles device read errors gracefully', async () => {
    const { sys } = createSystem();
    const device = {
      name: 'Broken Meter',
      hasCapability: () => true,
      getCapabilityValue: async () => { throw new Error('Device offline'); },
    };
    sys.waterMeters.set('m1', {
      id: 'm1', name: 'Broken Meter', device,
      totalConsumption: 0, currentFlow: 0, lastReading: null,
    });

    // Should not throw
    const result = await sys.monitorWaterConsumption();
    assertEqual(result.total, 0);
  });
});

/* ── handleWaterAnomaly ──────────────────────────────────────────── */

describe('SmartWaterManagementSystem — handleWaterAnomaly', () => {
  it('sends notification on anomaly', async () => {
    const { sys, homey } = createSystem();
    let sentNotification = null;
    homey.app.advancedNotificationManager.sendNotification = async (n) => {
      sentNotification = n;
    };

    await sys.handleWaterAnomaly({ name: 'Kitchen Meter' }, 75.5);
    assert(sentNotification !== null);
    assertEqual(sentNotification.priority, 'high');
    assertEqual(sentNotification.category, 'water_alert');
    assert(sentNotification.message.includes('75.5'));
  });

  it('handles missing notification manager', async () => {
    const { sys, homey } = createSystem();
    homey.app.advancedNotificationManager = null;
    // Should not throw
    await sys.handleWaterAnomaly({ name: 'Meter' }, 60);
  });
});

/* ── detectLeaks ─────────────────────────────────────────────────── */

describe('SmartWaterManagementSystem — detectLeaks', () => {
  it('detects new leak from sensor', async () => {
    const { sys } = createSystem();
    const device = createMockDevice('Leak Sensor', { alarm_water: true }, { alarm_water: true });
    sys.leakDetectors.set('d1', {
      id: 'd1', name: 'Leak Sensor', device, status: 'ok', lastCheck: 0,
    });

    await sys.detectLeaks();
    assertEqual(sys.leakDetectors.get('d1').status, 'leak');
    assertEqual(sys.leakAlerts.length, 1);
  });

  it('resolves existing leak', async () => {
    const { sys } = createSystem();
    const device = createMockDevice('Leak Sensor', { alarm_water: true }, { alarm_water: false });
    sys.leakDetectors.set('d1', {
      id: 'd1', name: 'Leak Sensor', device, status: 'leak', lastCheck: 0,
    });

    await sys.detectLeaks();
    assertEqual(sys.leakDetectors.get('d1').status, 'ok');
  });

  it('does not re-alert for existing leak', async () => {
    const { sys } = createSystem();
    const device = createMockDevice('Leak Sensor', { alarm_water: true }, { alarm_water: true });
    sys.leakDetectors.set('d1', {
      id: 'd1', name: 'Leak Sensor', device, status: 'leak', lastCheck: 0,
    });

    await sys.detectLeaks();
    // Still in leak, but no new alert
    assertEqual(sys.leakAlerts.length, 0);
  });

  it('handles device errors gracefully', async () => {
    const { sys } = createSystem();
    const device = {
      name: 'Broken Sensor',
      hasCapability: () => true,
      getCapabilityValue: async () => { throw new Error('Offline'); },
    };
    sys.leakDetectors.set('d1', {
      id: 'd1', name: 'Broken Sensor', device, status: 'ok', lastCheck: 0,
    });

    // Should not throw
    await sys.detectLeaks();
    assertEqual(sys.leakDetectors.get('d1').status, 'ok');
  });
});

/* ── handleLeakDetection ─────────────────────────────────────────── */

describe('SmartWaterManagementSystem — handleLeakDetection', () => {
  it('records leak alert', async () => {
    const { sys } = createSystem();
    await sys.handleLeakDetection({ id: 'd1', name: 'Bathroom Sensor' });
    assertEqual(sys.leakAlerts.length, 1);
    assertEqual(sys.leakAlerts[0].detectorId, 'd1');
    assertEqual(sys.leakAlerts[0].resolved, false);
  });

  it('sends critical notification', async () => {
    const { sys, homey } = createSystem();
    let sentNotification = null;
    homey.app.advancedNotificationManager.sendNotification = async (n) => {
      sentNotification = n;
    };

    await sys.handleLeakDetection({ id: 'd1', name: 'Bathroom' });
    assert(sentNotification !== null);
    assertEqual(sentNotification.priority, 'critical');
    assertEqual(sentNotification.category, 'water_leak');
  });

  it('triggers emergency shutoff when water saving mode is on', async () => {
    const { sys, homey } = createSystem();
    sys.waterSavingMode = true;
    let shutoffCalled = false;
    sys.emergencyWaterShutoff = async () => { shutoffCalled = true; };
    homey.drivers.getDevices = () => [];

    await sys.handleLeakDetection({ id: 'd1', name: 'Sensor' });
    assert(shutoffCalled);
  });

  it('does not trigger emergency shutoff when saving mode is off', async () => {
    const { sys } = createSystem();
    sys.waterSavingMode = false;
    let shutoffCalled = false;
    sys.emergencyWaterShutoff = async () => { shutoffCalled = true; };

    await sys.handleLeakDetection({ id: 'd1', name: 'Sensor' });
    assertEqual(shutoffCalled, false);
  });
});

/* ── emergencyWaterShutoff ───────────────────────────────────────── */

describe('SmartWaterManagementSystem — emergencyWaterShutoff', () => {
  it('closes main water valve', async () => {
    const { sys, homey } = createSystem();
    let closedValve = false;
    const device = {
      name: 'Main Water Valve',
      hasCapability: (cap) => cap === 'onoff',
      setCapabilityValue: async (_cap, val) => { closedValve = val === false; },
    };
    homey.drivers.getDevices = () => [device];

    await sys.emergencyWaterShutoff();
    assert(closedValve);
  });

  it('ignores non-valve devices', async () => {
    const { sys, homey } = createSystem();
    let called = false;
    const device = {
      name: 'Kitchen Light',
      hasCapability: () => true,
      setCapabilityValue: async () => { called = true; },
    };
    homey.drivers.getDevices = () => [device];

    await sys.emergencyWaterShutoff();
    assertEqual(called, false);
  });

  it('handles valve close errors', async () => {
    const { sys, homey } = createSystem();
    const device = {
      name: 'Main Valve',
      hasCapability: () => true,
      setCapabilityValue: async () => { throw new Error('Stuck'); },
    };
    homey.drivers.getDevices = () => [device];

    // Should not throw
    await sys.emergencyWaterShutoff();
  });
});

/* ── analyzeWaterUsage ───────────────────────────────────────────── */

describe('SmartWaterManagementSystem — analyzeWaterUsage', () => {
  it('does nothing with insufficient history', async () => {
    const { sys } = createSystem();
    sys.consumptionHistory = Array.from({ length: 10 }, () => ({ total: 100 }));
    // Should not throw with less than 50 entries
    await sys.analyzeWaterUsage({ total: 200, flowRate: 5 });
  });

  it('logs high consumption when above 1.5x average', async () => {
    const { sys } = createSystem();
    // 50 entries at total=100 → avg=100, threshold=150
    sys.consumptionHistory = Array.from({ length: 50 }, () => ({ total: 100 }));
    // total=160 > 150 → high consumption
    await sys.analyzeWaterUsage({ total: 160, flowRate: 5 });
    // Verify no error (logging only)
  });
});

/* ── startIrrigation & stopIrrigation ────────────────────────────── */

describe('SmartWaterManagementSystem — startIrrigation', () => {
  it('activates the zone', async () => {
    const { sys } = createSystem();
    const device = createMockDevice('Sprinkler', { onoff: true });
    sys.irrigationZones.set('z1', { id: 'z1', name: 'Front', device, active: false });

    // Use very short duration to avoid timer hang  
    // Note: setTimeout still fires — we just verify activation
    await sys.startIrrigation('z1', 0.001); // ~60ms
    assertEqual(sys.irrigationZones.get('z1').active, true);
  });

  it('does nothing for unknown zone', async () => {
    const { sys } = createSystem();
    // Should not throw
    await sys.startIrrigation('nonexistent', 10);
  });

  it('handles missing device gracefully', async () => {
    const { sys } = createSystem();
    sys.irrigationZones.set('z1', { id: 'z1', name: 'Front', device: null, active: false });
    await sys.startIrrigation('z1', 0.001);
    assertEqual(sys.irrigationZones.get('z1').active, true);
  });
});

describe('SmartWaterManagementSystem — stopIrrigation', () => {
  it('deactivates the zone', async () => {
    const { sys } = createSystem();
    const device = createMockDevice('Sprinkler', { onoff: true });
    sys.irrigationZones.set('z1', { id: 'z1', name: 'Front', device, active: true });

    await sys.stopIrrigation('z1');
    assertEqual(sys.irrigationZones.get('z1').active, false);
  });

  it('does nothing for unknown zone', async () => {
    const { sys } = createSystem();
    // Should not throw
    await sys.stopIrrigation('nonexistent');
  });

  it('handles device errors', async () => {
    const { sys } = createSystem();
    const device = {
      name: 'Broken Sprinkler',
      hasCapability: () => true,
      setCapabilityValue: async () => { throw new Error('Stuck'); },
    };
    sys.irrigationZones.set('z1', { id: 'z1', name: 'Broken', device, active: true });

    // Should not throw
    await sys.stopIrrigation('z1');
  });
});

/* ── generateDailyReport ─────────────────────────────────────────── */

describe('SmartWaterManagementSystem — generateDailyReport', () => {
  it('does nothing with no history', async () => {
    const { sys } = createSystem();
    // Should not throw
    await sys.generateDailyReport();
  });

  it('generates report from last 24h data', async () => {
    const { sys, homey } = createSystem();
    let sentNotification = null;
    homey.app.advancedNotificationManager.sendNotification = async (n) => {
      sentNotification = n;
    };

    // Add recent consumption entries
    const now = Date.now();
    sys.consumptionHistory = [
      { timestamp: now - 1000, total: 100, flowRate: 5 },
      { timestamp: now - 2000, total: 200, flowRate: 10 },
      { timestamp: now - 3000, total: 150, flowRate: 8 },
    ];

    await sys.generateDailyReport();
    assert(sentNotification !== null);
    assertEqual(sentNotification.priority, 'low');
    assertEqual(sentNotification.category, 'report');
    assert(sentNotification.title.includes('vattenrapport'));
  });

  it('excludes old entries from report', async () => {
    const { sys, homey } = createSystem();
    let sentNotification = null;
    homey.app.advancedNotificationManager.sendNotification = async (n) => {
      sentNotification = n;
    };

    // Only old data 
    sys.consumptionHistory = [
      { timestamp: Date.now() - 100000000, total: 100, flowRate: 5 },
    ];

    await sys.generateDailyReport();
    // No recent data → returns early → no notification
    assertEqual(sentNotification, null);
  });
});

/* ── setWaterSavingMode ──────────────────────────────────────────── */

describe('SmartWaterManagementSystem — setWaterSavingMode', () => {
  it('enables water saving mode', async () => {
    const { sys } = createSystem();
    await sys.setWaterSavingMode(true);
    assertEqual(sys.waterSavingMode, true);
  });

  it('persists setting', async () => {
    const { sys, homey } = createSystem();
    await sys.setWaterSavingMode(true);
    assertEqual(homey.settings.get('waterSavingMode'), true);
  });

  it('reduces irrigation durations by 25%', async () => {
    const { sys } = createSystem();
    sys.irrigationZones.set('z1', {
      id: 'z1', schedule: [{ day: 1, time: '06:00', duration: 20 }],
    });

    await sys.setWaterSavingMode(true);
    assertEqual(sys.irrigationZones.get('z1').schedule[0].duration, 15); // 20 * 0.75
  });

  it('handles zones without schedule', async () => {
    const { sys } = createSystem();
    sys.irrigationZones.set('z1', { id: 'z1', schedule: null });
    // Should not throw
    await sys.setWaterSavingMode(true);
  });

  it('can be disabled', async () => {
    const { sys } = createSystem();
    sys.waterSavingMode = true;
    await sys.setWaterSavingMode(false);
    assertEqual(sys.waterSavingMode, false);
  });
});

/* ── getStatistics ───────────────────────────────────────────────── */

describe('SmartWaterManagementSystem — getStatistics', () => {
  it('returns correct structure with empty data', () => {
    const { sys } = createSystem();
    const stats = sys.getStatistics();
    assertEqual(stats.waterMeters, 0);
    assertEqual(stats.leakDetectors, 0);
    assertEqual(stats.irrigationZones, 0);
    assertEqual(stats.activeLeaks, 0);
    assertEqual(stats.totalConsumptionToday, '0.0');
    assert(Array.isArray(stats.recentAlerts));
    assert(Array.isArray(stats.consumptionHistory));
    assertEqual(stats.waterSavingMode, false);
  });

  it('counts active leaks correctly', () => {
    const { sys } = createSystem();
    sys.leakDetectors.set('d1', { status: 'ok' });
    sys.leakDetectors.set('d2', { status: 'leak' });
    sys.leakDetectors.set('d3', { status: 'leak' });

    const stats = sys.getStatistics();
    assertEqual(stats.activeLeaks, 2);
  });

  it('limits recent alerts to 10', () => {
    const { sys } = createSystem();
    for (let i = 0; i < 25; i++) {
      sys.leakAlerts.push({ id: i, timestamp: Date.now() });
    }

    const stats = sys.getStatistics();
    assertEqual(stats.recentAlerts.length, 10);
  });

  it('limits consumption history to 100', () => {
    const { sys } = createSystem();
    for (let i = 0; i < 200; i++) {
      sys.consumptionHistory.push({ timestamp: Date.now(), flowRate: 1 });
    }

    const stats = sys.getStatistics();
    assertEqual(stats.consumptionHistory.length, 100);
  });

  it('reflects water saving mode', () => {
    const { sys } = createSystem();
    sys.waterSavingMode = true;
    assertEqual(sys.getStatistics().waterSavingMode, true);
  });
});

/* ── destroy ─────────────────────────────────────────────────────── */

describe('SmartWaterManagementSystem — destroy', () => {
  it('clears all intervals', () => {
    const { sys } = createSystem();
    sys.consumptionInterval = setInterval(() => {}, 999999);
    sys.leakDetectionInterval = setInterval(() => {}, 999999);
    sys.irrigationInterval = setInterval(() => {}, 999999);
    sys.dailyReportInterval = setInterval(() => {}, 999999);

    sys.destroy();
    assertEqual(sys.consumptionInterval, null);
    assertEqual(sys.leakDetectionInterval, null);
    assertEqual(sys.irrigationInterval, null);
    assertEqual(sys.dailyReportInterval, null);
  });

  it('handles already-null intervals', () => {
    const { sys } = createSystem();
    // Should not throw
    sys.destroy();
  });
});

/* ── initialize (integration) ────────────────────────────────────── */

describe('SmartWaterManagementSystem — initialize', () => {
  it('loads saved meters and sets up defaults', async () => {
    const { sys, homey } = createSystem();
    homey.settings.set('waterMeters', { m1: { id: 'm1', name: 'Saved Meter' } });

    await sys.initialize();
    assert(sys.waterMeters.has('m1'));
    assertEqual(sys.waterMeters.get('m1').name, 'Saved Meter');
    // Default zones also created
    assert(sys.irrigationZones.size >= 3);
    sys.destroy();
  });

  it('loads saved irrigation zones', async () => {
    const { sys, homey } = createSystem();
    homey.settings.set('irrigationZones', { z1: { id: 'z1', name: 'Saved Zone' } });

    await sys.initialize();
    assert(sys.irrigationZones.has('z1'));
    sys.destroy();
  });

  it('handles initialization errors gracefully', async () => {
    const { sys, homey } = createSystem();
    homey.settings.get = () => { throw new Error('Settings corrupted'); };

    // Should not throw
    await sys.initialize();
  });

  it('starts monitoring intervals', async () => {
    const { sys } = createSystem();
    await sys.initialize();
    assert(sys.consumptionInterval !== undefined);
    assert(sys.leakDetectionInterval !== undefined);
    assert(sys.irrigationInterval !== undefined);
    assert(sys.dailyReportInterval !== undefined);
    sys.destroy();
  });
});

/* ── detectHiddenLeaks ───────────────────────────────────────────── */

describe('SmartWaterManagementSystem — detectHiddenLeaks', () => {
  it('does nothing outside night hours', async () => {
    const { sys, homey } = createSystem();
    let notified = false;
    homey.app.advancedNotificationManager.sendNotification = async () => {
      notified = true;
    };

    // Mock Date to return daytime hour
    const origDate = globalThis.Date;
    globalThis.Date = class extends origDate {
      getHours() { return 12; }
    };

    await sys.detectHiddenLeaks();
    globalThis.Date = origDate;
    assertEqual(notified, false);
  });
});

/* ── getWeatherData ──────────────────────────────────────────────── */

describe('SmartWaterManagementSystem — getWeatherData', () => {
  it('returns mock weather data', async () => {
    const { sys } = createSystem();
    const data = await sys.getWeatherData();
    assertType(data.temperature, 'number');
    assertType(data.humidity, 'number');
    assertEqual(data.recentRain, false);
    assertEqual(data.rainExpected, false);
  });
});

/* ── checkIrrigationSchedule ─────────────────────────────────────── */

describe('SmartWaterManagementSystem — checkIrrigationSchedule', () => {
  it('skips zones with no schedule', async () => {
    const { sys } = createSystem();
    sys.irrigationZones.set('z1', { id: 'z1', schedule: [], name: 'Empty' });
    // Should not throw
    await sys.checkIrrigationSchedule();
  });

  it('skips zones with null schedule', async () => {
    const { sys } = createSystem();
    sys.irrigationZones.set('z1', { id: 'z1', schedule: null, name: 'Null' });
    // Should not throw
    await sys.checkIrrigationSchedule();
  });
});

run();
