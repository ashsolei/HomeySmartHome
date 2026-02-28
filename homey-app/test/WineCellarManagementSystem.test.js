'use strict';

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertType, assertRejects } = require('./helpers/assert');
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

const WineCellarManagementSystem = require('../lib/WineCellarManagementSystem');

describe('WineCellar — constructor & lifecycle', () => {
  it('instantiates without errors', () => {
    const sys = new WineCellarManagementSystem(createMockHomey());
    assert(sys, 'should create instance');
    assertEqual(sys.wines.size, 0);
    assertEqual(sys.cellars.size, 0);
    cleanup(sys);
  });

  it('initialize creates default cellars and sample wines', async () => {
    const sys = new WineCellarManagementSystem(createMockHomey());
    await sys.initialize();
    assert(sys.cellars.size > 0, 'should have cellars');
    assert(sys.wines.size > 0, 'should have wines');
    assert(sys.monitoringInterval, 'should have monitoring interval');
    cleanup(sys);
  });

  it('destroy clears interval and listeners', async () => {
    const sys = new WineCellarManagementSystem(createMockHomey());
    await sys.initialize();
    await sys.destroy();
    cleanup(sys);
  });
});

describe('WineCellar — cellar queries', () => {
  it('getCellars returns all cellars', async () => {
    const sys = new WineCellarManagementSystem(createMockHomey());
    await sys.initialize();
    const cellars = sys.getCellars();
    assert(Array.isArray(cellars), 'should be array');
    assertEqual(cellars.length, 2);
    cleanup(sys);
  });

  it('getCellar returns specific cellar', async () => {
    const sys = new WineCellarManagementSystem(createMockHomey());
    await sys.initialize();
    const cellar = sys.getCellar('main-cellar');
    assert(cellar, 'should return cellar');
    assertEqual(cellar.name, 'Huvudkällare');
    assert(cellar.climate, 'should have climate');
    assertType(cellar.climate.temperature.current, 'number');
    cleanup(sys);
  });

  it('getCellar returns undefined for unknown cellar', async () => {
    const sys = new WineCellarManagementSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.getCellar('nope'), undefined);
    cleanup(sys);
  });
});

describe('WineCellar — wine queries', () => {
  it('getWines returns all wines', async () => {
    const sys = new WineCellarManagementSystem(createMockHomey());
    await sys.initialize();
    const wines = sys.getWines();
    assert(Array.isArray(wines), 'should be array');
    assertEqual(wines.length, 3);
    cleanup(sys);
  });

  it('getWines filters by type', async () => {
    const sys = new WineCellarManagementSystem(createMockHomey());
    await sys.initialize();
    const reds = sys.getWines({ type: 'red' });
    assert(reds.length >= 1, 'should have at least 1 red');
    for (const w of reds) { assertEqual(w.type, 'red'); }
    cleanup(sys);
  });

  it('getWines filters by country', async () => {
    const sys = new WineCellarManagementSystem(createMockHomey());
    await sys.initialize();
    const french = sys.getWines({ country: 'Frankrike' });
    assert(french.length >= 1, 'should have French wines');
    cleanup(sys);
  });
});

describe('WineCellar — add & remove wine', () => {
  it('addWine adds a new wine', async () => {
    const sys = new WineCellarManagementSystem(createMockHomey());
    await sys.initialize();
    const wine = await sys.addWine({
      name: 'Test Riesling 2020',
      producer: 'Test Winery',
      country: 'Tyskland',
      region: 'Mosel',
      vintage: 2020,
      type: 'white',
      varietal: ['Riesling'],
      alcoholContent: 11.5,
      quantity: 4,
      storage: { cellarId: 'main-cellar', section: 'white-wines', rack: 'B', shelf: 1, position: 1 },
      purchase: { date: '2023-01-01', price: 150, supplier: 'Systembolaget', currency: 'SEK' },
      peakDrinkingStart: 2023,
      peakDrinkingEnd: 2028
    });
    assert(wine, 'should return wine');
    assert(wine.id, 'should have id');
    assertEqual(wine.name, 'Test Riesling 2020');
    assertEqual(wine.quantity, 4);
    cleanup(sys);
  });

  it('removeWine reduces quantity', async () => {
    const sys = new WineCellarManagementSystem(createMockHomey());
    await sys.initialize();
    const result = await sys.removeWine('wine-003', 2);
    assert(result, 'should return result');
    assertEqual(result.removedQuantity, 2);
    const wine = sys.wines.get('wine-003');
    assertEqual(wine.quantity, 4);
    cleanup(sys);
  });

  it('removeWine throws for unknown wine', async () => {
    const sys = new WineCellarManagementSystem(createMockHomey());
    await sys.initialize();
    await assertRejects(() => sys.removeWine('nope'), 'hittades inte');
    cleanup(sys);
  });

  it('removeWine throws for excessive quantity', async () => {
    const sys = new WineCellarManagementSystem(createMockHomey());
    await sys.initialize();
    await assertRejects(() => sys.removeWine('wine-001', 100), 'tillräckligt');
    cleanup(sys);
  });

  it('removeWine deletes wine when quantity reaches 0', async () => {
    const sys = new WineCellarManagementSystem(createMockHomey());
    await sys.initialize();
    const wine = sys.wines.get('wine-001');
    await sys.removeWine('wine-001', wine.quantity);
    assertEqual(sys.wines.has('wine-001'), false);
    cleanup(sys);
  });
});

describe('WineCellar — tasting notes', () => {
  it('addTastingNote adds a note', async () => {
    const sys = new WineCellarManagementSystem(createMockHomey());
    await sys.initialize();
    const note = await sys.addTastingNote('wine-001', {
      rating: 92,
      appearance: 'Deep ruby',
      nose: 'Blackcurrant and cedar',
      palate: 'Full-bodied with firm tannins',
      finish: 'Long and elegant',
      overall: 'Exceptional'
    });
    assert(note, 'should return note');
    assertEqual(note.rating, 92);
    assertEqual(note.wineId, 'wine-001');
    cleanup(sys);
  });

  it('addTastingNote updates personal rating', async () => {
    const sys = new WineCellarManagementSystem(createMockHomey());
    await sys.initialize();
    await sys.addTastingNote('wine-001', { rating: 95 });
    assertEqual(sys.wines.get('wine-001').ratings.personal, 95);
    cleanup(sys);
  });

  it('addTastingNote throws for unknown wine', async () => {
    const sys = new WineCellarManagementSystem(createMockHomey());
    await sys.initialize();
    await assertRejects(() => sys.addTastingNote('nope', { rating: 80 }), 'hittades inte');
    cleanup(sys);
  });

  it('getTastingNotes returns notes array', async () => {
    const sys = new WineCellarManagementSystem(createMockHomey());
    await sys.initialize();
    await sys.addTastingNote('wine-001', { rating: 90 });
    await sys.addTastingNote('wine-002', { rating: 93 });
    const all = sys.getTastingNotes();
    assert(all.length >= 2, 'should have notes');
    const forWine1 = sys.getTastingNotes('wine-001');
    assert(forWine1.length >= 1, 'should have notes for wine-001');
    cleanup(sys);
  });
});

describe('WineCellar — recommendations', () => {
  it('getWineRecommendation returns a wine for matching criteria', async () => {
    const sys = new WineCellarManagementSystem(createMockHomey());
    await sys.initialize();
    const rec = await sys.getWineRecommendation({ type: 'sparkling' });
    assert(rec, 'should return recommendation');
    assertEqual(rec.type, 'sparkling');
    cleanup(sys);
  });

  it('getWineRecommendation returns null for no match', async () => {
    const sys = new WineCellarManagementSystem(createMockHomey());
    await sys.initialize();
    const rec = await sys.getWineRecommendation({ type: 'rosé' });
    assertEqual(rec, null);
    cleanup(sys);
  });
});

describe('WineCellar — statistics', () => {
  it('getStats returns comprehensive stats', async () => {
    const sys = new WineCellarManagementSystem(createMockHomey());
    await sys.initialize();
    const stats = sys.getStats();
    assertEqual(stats.totalWines, 3);
    assertType(stats.totalBottles, 'number');
    assert(stats.totalBottles > 0, 'should have bottles');
    assertType(stats.totalValue, 'number');
    assert(stats.byType, 'should have byType');
    assert(stats.byStatus, 'should have byStatus');
    assertEqual(stats.cellars, 2);
    cleanup(sys);
  });
});

run();
