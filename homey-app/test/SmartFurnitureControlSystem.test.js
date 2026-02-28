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
  try { if (sys && typeof sys.destroy === 'function') sys.destroy(); } catch (_) {}
  while (activeHandles.length > 0) {
    const h = activeHandles.pop();
    if (h.type === 'timeout') clearTimeout(h.id); else clearInterval(h.id);
  }
}

const SmartFurnitureControlSystem = require('../lib/SmartFurnitureControlSystem');

describe('SmartFurnitureControlSystem — constructor', () => {
  it('instantiates without errors', () => {
    const sys = new SmartFurnitureControlSystem(createMockHomey());
    assert(sys, 'should create instance');
    assertEqual(sys.furniture.size, 0);
    assertEqual(sys.presets.size, 0);
    assertEqual(sys.scenes.size, 0);
    cleanup(sys);
  });
});

describe('SmartFurnitureControlSystem — initialize', () => {
  it('sets up default furniture, presets, and scenes', async () => {
    const sys = new SmartFurnitureControlSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.furniture.size, 4);
    assert(sys.furniture.has('desk-office'), 'should have desk');
    assert(sys.furniture.has('bed-master'), 'should have bed');
    assert(sys.furniture.has('recliner-living'), 'should have recliner');
    assert(sys.furniture.has('cabinet-kitchen'), 'should have cabinet');
    assert(sys.presets.size > 0, 'should have presets');
    assert(sys.scenes.size > 0, 'should have scenes');
    cleanup(sys);
  });
});

describe('SmartFurnitureControlSystem — adjustFurniture', () => {
  it('adjusts desk height', async () => {
    const sys = new SmartFurnitureControlSystem(createMockHomey());
    await sys.initialize();
    const result = await sys.adjustFurniture('desk-office', { height: 110 });
    assertEqual(result.position.height, 110);
    assert(result.usage.totalAdjustments > 0, 'should increment adjustments');
    cleanup(sys);
  });

  it('clamps desk height to range', async () => {
    const sys = new SmartFurnitureControlSystem(createMockHomey());
    await sys.initialize();
    await sys.adjustFurniture('desk-office', { height: 200 });
    assertEqual(sys.furniture.get('desk-office').position.height, 130);
    cleanup(sys);
  });

  it('adjusts bed position', async () => {
    const sys = new SmartFurnitureControlSystem(createMockHomey());
    await sys.initialize();
    const result = await sys.adjustFurniture('bed-master', { head: 45, foot: 15 });
    assertEqual(result.position.head, 45);
    assertEqual(result.position.foot, 15);
    cleanup(sys);
  });

  it('enables bed massage', async () => {
    const sys = new SmartFurnitureControlSystem(createMockHomey());
    await sys.initialize();
    await sys.adjustFurniture('bed-master', { massage: true });
    assertEqual(sys.furniture.get('bed-master').features.massage.enabled, true);
    cleanup(sys);
  });

  it('adjusts recliner position', async () => {
    const sys = new SmartFurnitureControlSystem(createMockHomey());
    await sys.initialize();
    await sys.adjustFurniture('recliner-living', { reclineAngle: 120, footrest: 60 });
    const recliner = sys.furniture.get('recliner-living');
    assertEqual(recliner.position.reclineAngle, 120);
    assertEqual(recliner.position.footrest, 60);
    cleanup(sys);
  });

  it('controls cabinet doors', async () => {
    const sys = new SmartFurnitureControlSystem(createMockHomey());
    await sys.initialize();
    await sys.adjustFurniture('cabinet-kitchen', { doors: 'open' });
    const cabinet = sys.furniture.get('cabinet-kitchen');
    assertEqual(cabinet.position.doors, 'open');
    assertEqual(cabinet.position.lighting, true);
    cleanup(sys);
  });

  it('throws for unknown furniture', async () => {
    const sys = new SmartFurnitureControlSystem(createMockHomey());
    await sys.initialize();
    let threw = false;
    try { await sys.adjustFurniture('nonexistent', {}); } catch (_) { threw = true; }
    assertEqual(threw, true);
    cleanup(sys);
  });
});

describe('SmartFurnitureControlSystem — applyPreset', () => {
  it('applies desk sitting preset', async () => {
    const sys = new SmartFurnitureControlSystem(createMockHomey());
    await sys.initialize();
    const result = await sys.applyPreset('desk-sitting');
    assertEqual(result.position.height, 75);
    cleanup(sys);
  });

  it('applies desk standing preset', async () => {
    const sys = new SmartFurnitureControlSystem(createMockHomey());
    await sys.initialize();
    const result = await sys.applyPreset('desk-standing');
    assertEqual(result.position.height, 110);
    cleanup(sys);
  });

  it('throws for unknown preset', async () => {
    const sys = new SmartFurnitureControlSystem(createMockHomey());
    await sys.initialize();
    let threw = false;
    try { await sys.applyPreset('nonexistent'); } catch (_) { threw = true; }
    assertEqual(threw, true);
    cleanup(sys);
  });
});

describe('SmartFurnitureControlSystem — activateScene', () => {
  it('activates work-mode scene', async () => {
    const sys = new SmartFurnitureControlSystem(createMockHomey());
    await sys.initialize();
    const result = await sys.activateScene('work-mode');
    assertEqual(result.id, 'work-mode');
    cleanup(sys);
  });

  it('throws for unknown scene', async () => {
    const sys = new SmartFurnitureControlSystem(createMockHomey());
    await sys.initialize();
    let threw = false;
    try { await sys.activateScene('nonexistent'); } catch (_) { threw = true; }
    assertEqual(threw, true);
    cleanup(sys);
  });
});

describe('SmartFurnitureControlSystem — getters', () => {
  it('getFurniture returns all items', async () => {
    const sys = new SmartFurnitureControlSystem(createMockHomey());
    await sys.initialize();
    const items = sys.getFurniture();
    assertEqual(items.length, 4);
    cleanup(sys);
  });

  it('getFurnitureItem returns single item', async () => {
    const sys = new SmartFurnitureControlSystem(createMockHomey());
    await sys.initialize();
    const item = sys.getFurnitureItem('desk-office');
    assertEqual(item.type, 'standing-desk');
    cleanup(sys);
  });

  it('getPresets returns presets', async () => {
    const sys = new SmartFurnitureControlSystem(createMockHomey());
    await sys.initialize();
    const all = sys.getPresets();
    assert(all.length > 0, 'should have presets');
    const deskOnly = sys.getPresets('desk-office');
    assert(deskOnly.length > 0, 'should filter by furniture');
    assert(deskOnly.every(p => p.furnitureId === 'desk-office'), 'all should belong to desk');
    cleanup(sys);
  });

  it('getScenes returns scenes', async () => {
    const sys = new SmartFurnitureControlSystem(createMockHomey());
    await sys.initialize();
    const scenes = sys.getScenes();
    assert(scenes.length > 0, 'should have scenes');
    cleanup(sys);
  });

  it('getUsageHistory returns history', async () => {
    const sys = new SmartFurnitureControlSystem(createMockHomey());
    await sys.initialize();
    await sys.adjustFurniture('desk-office', { height: 100 });
    const history = sys.getUsageHistory();
    assert(history.length > 0, 'should have events');
    cleanup(sys);
  });
});

describe('SmartFurnitureControlSystem — getStats', () => {
  it('returns comprehensive statistics', async () => {
    const sys = new SmartFurnitureControlSystem(createMockHomey());
    await sys.initialize();
    const stats = sys.getStats();
    assertEqual(stats.totalFurniture, 4);
    assert(stats.byType, 'should have type breakdown');
    assertEqual(stats.byType.desks, 1);
    assertEqual(stats.byType.beds, 1);
    assertType(stats.totalAdjustments, 'number');
    assert(stats.ergonomics, 'should have ergonomics');
    cleanup(sys);
  });
});

describe('SmartFurnitureControlSystem — destroy', () => {
  it('clears monitoring interval', async () => {
    const sys = new SmartFurnitureControlSystem(createMockHomey());
    await sys.initialize();
    await sys.destroy();
    cleanup(sys);
  });
});

run();
