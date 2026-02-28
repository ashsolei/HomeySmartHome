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

const SmartMirrorDashboardSystem = require('../lib/SmartMirrorDashboardSystem');

describe('SmartMirror — constructor & lifecycle', () => {
  it('instantiates with default mirrors and widgets', () => {
    const sys = new SmartMirrorDashboardSystem(createMockHomey());
    assertEqual(sys.mirrors.size, 4);
    assert(sys.widgets.size > 10, 'should have many widgets');
    assertEqual(sys.userProfiles.size, 4);
    cleanup(sys);
  });

  it('initialize sets initialized and starts intervals', async () => {
    const sys = new SmartMirrorDashboardSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.initialized, true);
    assert(sys.intervals.length > 0, 'should have intervals');
    cleanup(sys);
  });

  it('destroy clears intervals and maps', async () => {
    const sys = new SmartMirrorDashboardSystem(createMockHomey());
    await sys.initialize();
    sys.destroy();
    assertEqual(sys.intervals.length, 0);
    assertEqual(sys.mirrors.size, 0);
    cleanup(sys);
  });
});

describe('SmartMirror — mirror settings', () => {
  it('setMirrorBrightness clamps and sets value', async () => {
    const sys = new SmartMirrorDashboardSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.setMirrorBrightness('bathroom-main', 50), true);
    assertEqual(sys.mirrors.get('bathroom-main').brightness, 50);
    sys.setMirrorBrightness('bathroom-main', 150);
    assertEqual(sys.mirrors.get('bathroom-main').brightness, 100);
    cleanup(sys);
  });

  it('setMirrorBrightness returns false for unknown mirror', async () => {
    const sys = new SmartMirrorDashboardSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.setMirrorBrightness('nope', 50), false);
    cleanup(sys);
  });

  it('setMirrorTheme accepts valid themes', async () => {
    const sys = new SmartMirrorDashboardSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.setMirrorTheme('bathroom-main', 'dark'), true);
    assertEqual(sys.setMirrorTheme('bathroom-main', 'light'), true);
    assertEqual(sys.setMirrorTheme('bathroom-main', 'auto'), true);
    assertEqual(sys.setMirrorTheme('bathroom-main', 'invalid'), false);
    cleanup(sys);
  });

  it('setMirrorMode changes mode and adjusts brightness', async () => {
    const sys = new SmartMirrorDashboardSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.setMirrorMode('bedroom', 'night'), true);
    assertEqual(sys.mirrors.get('bedroom').brightness, 5);
    assertEqual(sys.mirrors.get('bedroom').activeMode, 'night');
    sys.setMirrorMode('bedroom', 'party');
    assertEqual(sys.mirrors.get('bedroom').brightness, 100);
    cleanup(sys);
  });

  it('setMirrorMode away powers off mirror', async () => {
    const sys = new SmartMirrorDashboardSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.setMirrorMode('hallway', 'away'), true);
    assertEqual(sys.mirrors.get('hallway').poweredOn, false);
    assertEqual(sys.mirrors.get('hallway').status, 'away');
    cleanup(sys);
  });

  it('setMirrorMode rejects invalid mode', async () => {
    const sys = new SmartMirrorDashboardSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.setMirrorMode('gym', 'disco'), false);
    cleanup(sys);
  });
});

describe('SmartMirror — widgets', () => {
  it('enableWidget adds widget to layout', async () => {
    const sys = new SmartMirrorDashboardSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.enableWidget('bathroom-main', 'grocery-list'), true);
    cleanup(sys);
  });

  it('enableWidget returns false for unknown mirror', async () => {
    const sys = new SmartMirrorDashboardSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.enableWidget('nope', 'clock'), false);
    cleanup(sys);
  });

  it('disableWidget removes widget from layout', async () => {
    const sys = new SmartMirrorDashboardSystem(createMockHomey());
    await sys.initialize();
    sys.enableWidget('bathroom-main', 'grocery-list');
    assertEqual(sys.disableWidget('bathroom-main', 'grocery-list'), true);
    cleanup(sys);
  });

  it('updateWidgetPosition moves an existing widget', async () => {
    const sys = new SmartMirrorDashboardSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.updateWidgetPosition('bathroom-main', 'clock', 2, 3, 1, 1), true);
    cleanup(sys);
  });
});

describe('SmartMirror — health & user profiles', () => {
  it('updateHealthMetric updates valid metric', async () => {
    const sys = new SmartMirrorDashboardSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.updateHealthMetric('user-1', 'dailySteps', 12000), true);
    cleanup(sys);
  });

  it('updateHealthMetric rejects invalid metric', async () => {
    const sys = new SmartMirrorDashboardSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.updateHealthMetric('user-1', 'bloodPressure', 120), false);
    cleanup(sys);
  });

  it('updateHealthMetric returns false for unknown user', async () => {
    const sys = new SmartMirrorDashboardSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.updateHealthMetric('user-99', 'dailySteps', 5000), false);
    cleanup(sys);
  });

  it('getUserProfile returns profile and health data', async () => {
    const sys = new SmartMirrorDashboardSystem(createMockHomey());
    await sys.initialize();
    const data = sys.getUserProfile('user-1');
    assert(data, 'should return data');
    assert(data.profile, 'should have profile');
    assert(data.health, 'should have health');
    assertEqual(data.profile.name, 'Erik');
    cleanup(sys);
  });

  it('getUserProfile returns null for unknown user', async () => {
    const sys = new SmartMirrorDashboardSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.getUserProfile('user-99'), null);
    cleanup(sys);
  });
});

describe('SmartMirror — maintenance & medication', () => {
  it('markScreenCleaned resets cleaning reminder', async () => {
    const sys = new SmartMirrorDashboardSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.markScreenCleaned('bathroom-main'), true);
    const record = sys.maintenanceLog.get('bathroom-main');
    assertEqual(record.screenCleaningReminder, false);
    cleanup(sys);
  });

  it('markScreenCleaned returns false for unknown mirror', async () => {
    const sys = new SmartMirrorDashboardSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.markScreenCleaned('nope'), false);
    cleanup(sys);
  });
});

describe('SmartMirror — status & statistics', () => {
  it('getMirrorStatus returns detailed status', async () => {
    const sys = new SmartMirrorDashboardSystem(createMockHomey());
    await sys.initialize();
    const status = sys.getMirrorStatus('bathroom-main');
    assert(status, 'should return status');
    assert(status.mirror, 'should have mirror');
    assert(status.layout, 'should have layout');
    assert(status.analytics, 'should have analytics');
    assert(status.maintenance, 'should have maintenance');
    cleanup(sys);
  });

  it('getMirrorStatus returns null for unknown mirror', async () => {
    const sys = new SmartMirrorDashboardSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.getMirrorStatus('nope'), null);
    cleanup(sys);
  });

  it('getAllMirrorStatuses returns all 4 mirrors', async () => {
    const sys = new SmartMirrorDashboardSystem(createMockHomey());
    await sys.initialize();
    const statuses = sys.getAllMirrorStatuses();
    assertEqual(Object.keys(statuses).length, 4);
    cleanup(sys);
  });

  it('getStatistics returns comprehensive stats', async () => {
    const sys = new SmartMirrorDashboardSystem(createMockHomey());
    await sys.initialize();
    const stats = sys.getStatistics();
    assertEqual(stats.initialized, true);
    assertEqual(stats.totalMirrors, 4);
    assertEqual(stats.totalUsers, 4);
    assertType(stats.totalWidgets, 'number');
    assert(stats.mirrorStats, 'should have mirror stats');
    cleanup(sys);
  });

  it('getVoiceCommandStats returns stats object', async () => {
    const sys = new SmartMirrorDashboardSystem(createMockHomey());
    await sys.initialize();
    const stats = sys.getVoiceCommandStats();
    assertType(stats.total, 'number');
    assertType(stats.successRate, 'number');
    cleanup(sys);
  });

  it('getGestureStats returns stats object', async () => {
    const sys = new SmartMirrorDashboardSystem(createMockHomey());
    await sys.initialize();
    const stats = sys.getGestureStats();
    assertType(stats.total, 'number');
    assert(stats.gestureBreakdown, 'should have breakdown');
    cleanup(sys);
  });

  it('getPhotoAlbumInfo returns album info', async () => {
    const sys = new SmartMirrorDashboardSystem(createMockHomey());
    await sys.initialize();
    const info = sys.getPhotoAlbumInfo();
    assertType(info.totalPhotos, 'number');
    assert(info.albums, 'should have albums');
    cleanup(sys);
  });

  it('getMaintenanceReport returns report for all mirrors', async () => {
    const sys = new SmartMirrorDashboardSystem(createMockHomey());
    await sys.initialize();
    const report = sys.getMaintenanceReport();
    assertEqual(Object.keys(report).length, 4);
    cleanup(sys);
  });

  it('getSmartHomeControlsList returns controls array', async () => {
    const sys = new SmartMirrorDashboardSystem(createMockHomey());
    await sys.initialize();
    const controls = sys.getSmartHomeControlsList();
    assert(Array.isArray(controls), 'should be array');
    assert(controls.length > 0, 'should have controls');
    cleanup(sys);
  });

  it('getWeatherSummary returns weather data', async () => {
    const sys = new SmartMirrorDashboardSystem(createMockHomey());
    await sys.initialize();
    const weather = sys.getWeatherSummary();
    assert(weather, 'should return weather');
    cleanup(sys);
  });

  it('getTransitSummary returns transit data', async () => {
    const sys = new SmartMirrorDashboardSystem(createMockHomey());
    await sys.initialize();
    const transit = sys.getTransitSummary();
    assert(transit, 'should return transit');
    cleanup(sys);
  });
});

run();
