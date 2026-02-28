'use strict';

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertType } = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');

const _origSetTimeout = global.setTimeout;
const _origSetInterval = global.setInterval;
const activeHandles = [];
global.setTimeout = (...a) => { const id = _origSetTimeout(...a); activeHandles.push({ type: 'timeout', id }); return id; };
global.setInterval = (...a) => { const id = _origSetInterval(...a); activeHandles.push({ type: 'interval', id }); return id; };
function cleanup(sys) {
  try { if (sys && sys.updateInterval) clearInterval(sys.updateInterval); } catch (_) {}
  try { if (sys && typeof sys.destroy === 'function') sys.destroy(); } catch (_) {}
  while (activeHandles.length > 0) {
    const h = activeHandles.pop();
    if (h.type === 'timeout') clearTimeout(h.id); else clearInterval(h.id);
  }
}

const IntelligentDashboard = require('../lib/IntelligentDashboard');

describe('IntelligentDashboard — constructor & init', () => {
  it('instantiates without errors', () => {
    const sys = new IntelligentDashboard(createMockHomey());
    assert(sys, 'should create instance');
    assertEqual(sys.dashboardLayouts.size, 0);
    assertEqual(sys.widgets.size, 0);
    assertEqual(sys.updateInterval, null);
    cleanup(sys);
  });

  it('initialize creates default dashboards', async () => {
    const sys = new IntelligentDashboard(createMockHomey());
    await sys.initialize();
    assert(sys.dashboardLayouts.size > 0, 'should have dashboards');
    assert(sys.updateInterval, 'should have update interval');
    cleanup(sys);
  });

  it('initialize creates home_overview dashboard', async () => {
    const sys = new IntelligentDashboard(createMockHomey());
    await sys.initialize();
    assert(sys.dashboardLayouts.has('home_overview'), 'should have home_overview');
    cleanup(sys);
  });

  it('initialize creates energy dashboard', async () => {
    const sys = new IntelligentDashboard(createMockHomey());
    await sys.initialize();
    assert(sys.dashboardLayouts.has('energy'), 'should have energy dashboard');
    cleanup(sys);
  });

  it('initialize creates security dashboard', async () => {
    const sys = new IntelligentDashboard(createMockHomey());
    await sys.initialize();
    assert(sys.dashboardLayouts.has('security'), 'should have security dashboard');
    cleanup(sys);
  });
});

describe('IntelligentDashboard — dashboard management', () => {
  it('createDashboard adds a dashboard', async () => {
    const sys = new IntelligentDashboard(createMockHomey());
    await sys.initialize();
    const dashboard = await sys.createDashboard({
      id: 'custom',
      name: { en: 'Custom Dashboard' },
      widgets: []
    });
    assert(dashboard, 'should return dashboard');
    assertEqual(dashboard.id, 'custom');
    assert(dashboard.created, 'should have created timestamp');
    assert(dashboard.modified, 'should have modified timestamp');
    assertEqual(dashboard.settings.layout, 'grid');
    assertEqual(dashboard.settings.columns, 12);
    assert(sys.dashboardLayouts.has('custom'), 'should be stored');
    cleanup(sys);
  });

  it('createDashboard generates id if not provided', async () => {
    const sys = new IntelligentDashboard(createMockHomey());
    await sys.initialize();
    const dashboard = await sys.createDashboard({ name: 'Auto ID', widgets: [] });
    assert(dashboard.id, 'should have auto-generated id');
    cleanup(sys);
  });

  it('createDashboard stores widgets', async () => {
    const sys = new IntelligentDashboard(createMockHomey());
    await sys.initialize();
    const dashboard = await sys.createDashboard({
      name: 'With Widgets',
      widgets: [
        { id: 'w1', type: 'status_card', size: 'large', position: { x: 0, y: 0, w: 12, h: 4 }, config: {} }
      ]
    });
    assertEqual(dashboard.widgets.length, 1);
    assertEqual(dashboard.widgets[0].id, 'w1');
    cleanup(sys);
  });
});

describe('IntelligentDashboard — real-time data', () => {
  it('startRealTimeUpdates sets interval', async () => {
    const sys = new IntelligentDashboard(createMockHomey());
    sys.startRealTimeUpdates();
    assert(sys.updateInterval, 'should have interval');
    cleanup(sys);
  });

  it('getRealTimeData returns undefined for unset key', () => {
    const sys = new IntelligentDashboard(createMockHomey());
    assertEqual(sys.getRealTimeData('energy'), undefined);
    cleanup(sys);
  });

  it('getRealTimeData returns value after set', () => {
    const sys = new IntelligentDashboard(createMockHomey());
    sys.realTimeData.set('energy', 42);
    assertEqual(sys.getRealTimeData('energy'), 42);
    cleanup(sys);
  });
});

describe('IntelligentDashboard — helpers', () => {
  it('generateId returns unique ids', () => {
    const sys = new IntelligentDashboard(createMockHomey());
    const id1 = sys.generateId();
    const id2 = sys.generateId();
    assert(id1 !== id2, 'ids should be unique');
    assert(id1.startsWith('dash_'), 'should start with dash_');
    cleanup(sys);
  });

  it('groupDevicesByZone groups correctly', () => {
    const sys = new IntelligentDashboard(createMockHomey());
    const devices = [
      { name: 'Lamp', zone: { name: 'Living Room' } },
      { name: 'TV', zone: { name: 'Living Room' } },
      { name: 'Fridge', zone: { name: 'Kitchen' } }
    ];
    const grouped = sys.groupDevicesByZone(devices);
    assertEqual(grouped['Living Room'].length, 2);
    assertEqual(grouped['Kitchen'].length, 1);
    cleanup(sys);
  });

  it('groupDevicesByClass groups correctly', () => {
    const sys = new IntelligentDashboard(createMockHomey());
    const devices = [
      { name: 'Lamp', class: 'light' },
      { name: 'TV', class: 'other' },
      { name: 'Fan', class: 'light' }
    ];
    const grouped = sys.groupDevicesByClass(devices);
    assertEqual(grouped['light'].length, 2);
    assertEqual(grouped['other'].length, 1);
    cleanup(sys);
  });

  it('saveDashboards persists layouts', async () => {
    const sys = new IntelligentDashboard(createMockHomey());
    await sys.initialize();
    await sys.saveDashboards();
    // No throw means success
    assert(true, 'should save without error');
    cleanup(sys);
  });
});

run();
