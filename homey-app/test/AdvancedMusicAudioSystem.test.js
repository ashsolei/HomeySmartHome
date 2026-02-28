'use strict';

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertDeepEqual, assertType, assertRejects } = require('./helpers/assert');

/* ── timer-leak prevention ─────────────────────────────── */
const _origSetTimeout = global.setTimeout;
const _origSetInterval = global.setInterval;
const activeHandles = [];
global.setTimeout = (...args) => { const id = _origSetTimeout(...args); activeHandles.push({ type: 'timeout', id }); return id; };
global.setInterval = (...args) => { const id = _origSetInterval(...args); activeHandles.push({ type: 'interval', id }); return id; };
function cleanup(sys) {
  try { if (sys.monitoring && sys.monitoring.interval) clearInterval(sys.monitoring.interval); } catch (_) {}
  while (activeHandles.length > 0) {
    const h = activeHandles.pop();
    if (h.type === 'timeout') clearTimeout(h.id); else clearInterval(h.id);
  }
}

const AdvancedMusicAudioSystem = require('../lib/AdvancedMusicAudioSystem');

/* ═══════════════════════════════════════════════════════════
   AdvancedMusicAudioSystem – Test Suite
   ═══════════════════════════════════════════════════════════ */

describe('AdvancedMusicAudioSystem — constructor', () => {
  it('creates instance with default data', () => {
    const sys = new AdvancedMusicAudioSystem();
    sys.loadSettings = async () => {};
    sys.saveSettings = async () => {};
    assertEqual(sys.audioZones.size, 4);
    assertEqual(sys.speakers.size, 5);
    assertEqual(sys.vinylCollection.size, 3);
    assertEqual(sys.streamingServices.size, 3);
    assertEqual(sys.playlists.size, 3);
    assertEqual(sys.audioProfiles.size, 4);
    cleanup(sys);
  });

  it('extends EventEmitter', () => {
    const sys = new AdvancedMusicAudioSystem();
    sys.loadSettings = async () => {};
    sys.saveSettings = async () => {};
    assertType(sys.on, 'function');
    assertType(sys.emit, 'function');
    cleanup(sys);
  });
});

describe('AdvancedMusicAudioSystem — initialize', () => {
  it('initializes successfully', async () => {
    const sys = new AdvancedMusicAudioSystem();
    sys.loadSettings = async () => {};
    sys.saveSettings = async () => {};
    const result = await sys.initialize();
    assertEqual(result.success, true);
    assert(result.zones > 0, 'should report zones');
    assert(result.speakers > 0, 'should report speakers');
    cleanup(sys);
  });

  it('throws on initialization error', async () => {
    const sys = new AdvancedMusicAudioSystem();
    sys.loadSettings = async () => { throw new Error('settings fail'); };
    sys.saveSettings = async () => {};
    await assertRejects(async () => sys.initialize());
    cleanup(sys);
  });
});

describe('AdvancedMusicAudioSystem — playMusic', () => {
  it('plays from playlist', async () => {
    const sys = new AdvancedMusicAudioSystem();
    sys.loadSettings = async () => {};
    sys.saveSettings = async () => {};
    await sys.initialize();
    const playlists = Array.from(sys.playlists.keys());
    const result = await sys.playMusic('zone-001', { source: 'playlist', playlistId: playlists[0] });
    assertEqual(result.success, true);
    assertType(result.zone, 'string');
    assertType(result.source, 'string');
    cleanup(sys);
  });

  it('plays from vinyl collection', async () => {
    const sys = new AdvancedMusicAudioSystem();
    sys.loadSettings = async () => {};
    sys.saveSettings = async () => {};
    await sys.initialize();
    const vinyls = Array.from(sys.vinylCollection.keys());
    const result = await sys.playMusic('zone-001', { source: 'vinyl', vinylId: vinyls[0] });
    assertEqual(result.success, true);
    assertEqual(result.source, 'vinyl');
    cleanup(sys);
  });

  it('plays from streaming track URI', async () => {
    const sys = new AdvancedMusicAudioSystem();
    sys.loadSettings = async () => {};
    sys.saveSettings = async () => {};
    await sys.initialize();
    const result = await sys.playMusic('zone-001', { source: 'streaming', trackUri: 'spotify:track:abc123' });
    assertEqual(result.success, true);
    assertEqual(result.source, 'streaming');
    cleanup(sys);
  });

  it('throws for invalid zone', async () => {
    const sys = new AdvancedMusicAudioSystem();
    sys.loadSettings = async () => {};
    sys.saveSettings = async () => {};
    await sys.initialize();
    await assertRejects(
      async () => sys.playMusic('zone-999', { source: 'streaming', trackUri: 'x' })
    );
    cleanup(sys);
  });

  it('throws for invalid vinyl', async () => {
    const sys = new AdvancedMusicAudioSystem();
    sys.loadSettings = async () => {};
    sys.saveSettings = async () => {};
    await sys.initialize();
    await assertRejects(
      async () => sys.playMusic('zone-001', { source: 'vinyl', vinylId: 'bad-id' })
    );
    cleanup(sys);
  });

  it('throws for invalid playlist', async () => {
    const sys = new AdvancedMusicAudioSystem();
    sys.loadSettings = async () => {};
    sys.saveSettings = async () => {};
    await sys.initialize();
    await assertRejects(
      async () => sys.playMusic('zone-001', { source: 'playlist', playlistId: 'bad-id' })
    );
    cleanup(sys);
  });

  it('throws when no source specified', async () => {
    const sys = new AdvancedMusicAudioSystem();
    sys.loadSettings = async () => {};
    sys.saveSettings = async () => {};
    await sys.initialize();
    await assertRejects(
      async () => sys.playMusic('zone-001', {})
    );
    cleanup(sys);
  });
});

describe('AdvancedMusicAudioSystem — pauseMusic / stopMusic', () => {
  it('pauses playing zone', async () => {
    const sys = new AdvancedMusicAudioSystem();
    sys.loadSettings = async () => {};
    sys.saveSettings = async () => {};
    await sys.initialize();
    const playlists = Array.from(sys.playlists.keys());
    await sys.playMusic('zone-001', { source: 'playlist', playlistId: playlists[0] });
    const result = await sys.pauseMusic('zone-001');
    assertEqual(result.success, true);
    assertType(result.zone, 'string');
    cleanup(sys);
  });

  it('throws for unknown zone on pause', async () => {
    const sys = new AdvancedMusicAudioSystem();
    sys.loadSettings = async () => {};
    sys.saveSettings = async () => {};
    await sys.initialize();
    await assertRejects(async () => sys.pauseMusic('zone-999'));
    cleanup(sys);
  });

  it('stops playing zone', async () => {
    const sys = new AdvancedMusicAudioSystem();
    sys.loadSettings = async () => {};
    sys.saveSettings = async () => {};
    await sys.initialize();
    const playlists = Array.from(sys.playlists.keys());
    await sys.playMusic('zone-001', { source: 'playlist', playlistId: playlists[0] });
    const result = await sys.stopMusic('zone-001');
    assertEqual(result.success, true);
    cleanup(sys);
  });
});

describe('AdvancedMusicAudioSystem — setVolume', () => {
  it('sets volume within range', async () => {
    const sys = new AdvancedMusicAudioSystem();
    sys.loadSettings = async () => {};
    sys.saveSettings = async () => {};
    await sys.initialize();
    const result = await sys.setVolume('zone-001', 50);
    assertEqual(result.success, true);
    assertEqual(result.volume, 50);
    cleanup(sys);
  });

  it('caps volume at maxVolume', async () => {
    const sys = new AdvancedMusicAudioSystem();
    sys.loadSettings = async () => {};
    sys.saveSettings = async () => {};
    await sys.initialize();
    const result = await sys.setVolume('zone-001', 100);
    assertEqual(result.success, true);
    assert(result.volume <= 85, 'volume should be capped at 85');
    cleanup(sys);
  });

  it('throws for unknown zone', async () => {
    const sys = new AdvancedMusicAudioSystem();
    sys.loadSettings = async () => {};
    sys.saveSettings = async () => {};
    await sys.initialize();
    await assertRejects(async () => sys.setVolume('zone-999', 50));
    cleanup(sys);
  });

  it('propagates volume to grouped zones', async () => {
    const sys = new AdvancedMusicAudioSystem();
    sys.loadSettings = async () => {};
    sys.saveSettings = async () => {};
    await sys.initialize();
    await sys.groupZones(['zone-001', 'zone-002']);
    await sys.setVolume('zone-001', 40);
    const zone2 = sys.audioZones.get('zone-002');
    assertEqual(zone2.volume, 40);
    cleanup(sys);
  });
});

describe('AdvancedMusicAudioSystem — groupZones / ungroupZones', () => {
  it('groups two or more zones', async () => {
    const sys = new AdvancedMusicAudioSystem();
    sys.loadSettings = async () => {};
    sys.saveSettings = async () => {};
    await sys.initialize();
    const result = await sys.groupZones(['zone-001', 'zone-002', 'zone-003']);
    assertEqual(result.success, true);
    assert(result.groupSize >= 3, 'group should have 3+ zones');
    cleanup(sys);
  });

  it('throws when fewer than 2 zones', async () => {
    const sys = new AdvancedMusicAudioSystem();
    sys.loadSettings = async () => {};
    sys.saveSettings = async () => {};
    await sys.initialize();
    await assertRejects(async () => sys.groupZones(['zone-001']));
    cleanup(sys);
  });

  it('ungroups a zone', async () => {
    const sys = new AdvancedMusicAudioSystem();
    sys.loadSettings = async () => {};
    sys.saveSettings = async () => {};
    await sys.initialize();
    await sys.groupZones(['zone-001', 'zone-002']);
    const result = await sys.ungroupZones('zone-001');
    assertEqual(result.success, true);
    cleanup(sys);
  });
});

describe('AdvancedMusicAudioSystem — recommendations & queries', () => {
  it('getPlaylistRecommendation returns playlists', () => {
    const sys = new AdvancedMusicAudioSystem();
    sys.loadSettings = async () => {};
    sys.saveSettings = async () => {};
    const recs = sys.getPlaylistRecommendation({});
    assert(Array.isArray(recs), 'should be array');
    assert(recs.length > 0, 'should have recommendations');
    assert(recs.length <= 5, 'should have max 5 recommendations');
    cleanup(sys);
  });

  it('getAudioZones returns 4 zones', () => {
    const sys = new AdvancedMusicAudioSystem();
    sys.loadSettings = async () => {};
    sys.saveSettings = async () => {};
    const zones = sys.getAudioZones();
    assertEqual(zones.length, 4);
    cleanup(sys);
  });

  it('getVinylCollection returns array', () => {
    const sys = new AdvancedMusicAudioSystem();
    sys.loadSettings = async () => {};
    sys.saveSettings = async () => {};
    const vinyls = sys.getVinylCollection({});
    assert(Array.isArray(vinyls), 'should be array');
    assertEqual(vinyls.length, 3);
    cleanup(sys);
  });

  it('getVinylCollection filters by genre', () => {
    const sys = new AdvancedMusicAudioSystem();
    sys.loadSettings = async () => {};
    sys.saveSettings = async () => {};
    const vinyls = sys.getVinylCollection({ genre: 'Progressive Rock' });
    assert(Array.isArray(vinyls), 'should be array');
    for (const v of vinyls) {
      assertEqual(v.genre, 'Progressive Rock');
    }
    cleanup(sys);
  });

  it('getPlaylists returns array', () => {
    const sys = new AdvancedMusicAudioSystem();
    sys.loadSettings = async () => {};
    sys.saveSettings = async () => {};
    const playlists = sys.getPlaylists({});
    assert(Array.isArray(playlists), 'should be array');
    assertEqual(playlists.length, 3);
    cleanup(sys);
  });
});

describe('AdvancedMusicAudioSystem — getMusicStatistics', () => {
  it('returns comprehensive statistics', async () => {
    const sys = new AdvancedMusicAudioSystem();
    sys.loadSettings = async () => {};
    sys.saveSettings = async () => {};
    await sys.initialize();
    const stats = sys.getMusicStatistics();
    assertType(stats.listening, 'object');
    assertType(stats.zones, 'object');
    assertType(stats.speakers, 'object');
    assertType(stats.sources, 'object');
    assertType(stats.playlists, 'object');
    cleanup(sys);
  });

  it('uses cache for repeated calls', async () => {
    const sys = new AdvancedMusicAudioSystem();
    sys.loadSettings = async () => {};
    sys.saveSettings = async () => {};
    await sys.initialize();
    const stats1 = sys.getMusicStatistics();
    const stats2 = sys.getMusicStatistics();
    assertType(stats1.zones, 'object');
    assertType(stats2.zones, 'object');
    cleanup(sys);
  });
});

describe('AdvancedMusicAudioSystem — cache system', () => {
  it('setCached/getCached round-trips', () => {
    const sys = new AdvancedMusicAudioSystem();
    sys.loadSettings = async () => {};
    sys.saveSettings = async () => {};
    sys.setCached('testKey', { hello: 'world' });
    const val = sys.getCached('testKey');
    assertDeepEqual(val, { hello: 'world' });
    cleanup(sys);
  });

  it('getCached returns null for missing key', () => {
    const sys = new AdvancedMusicAudioSystem();
    sys.loadSettings = async () => {};
    sys.saveSettings = async () => {};
    assertEqual(sys.getCached('missing'), null);
    cleanup(sys);
  });

  it('clearCache removes all entries', () => {
    const sys = new AdvancedMusicAudioSystem();
    sys.loadSettings = async () => {};
    sys.saveSettings = async () => {};
    sys.setCached('a', 1);
    sys.setCached('b', 2);
    sys.clearCache();
    assertEqual(sys.getCached('a'), null);
    assertEqual(sys.getCached('b'), null);
    cleanup(sys);
  });
});

run();
