'use strict';

/**
 * Multi-Zone Audio Controller
 * Advanced multi-room audio management
 */
class MultiZoneAudioController {
  constructor(app) {
    this.app = app;
    this.zones = new Map();
    this.audioSources = new Map();
    this.playlists = new Map();
    this.audioScenes = new Map();
    this.playbackHistory = [];
  }

  async initialize() {
    await this.setupZones();
    await this.setupAudioSources();
    await this.setupPlaylists();
    await this.setupAudioScenes();
    
    this.startMonitoring();
  }

  // ============================================
  // ZONES
  // ============================================

  async setupZones() {
    const zones = [
      {
        id: 'living_room',
        name: 'Vardagsrum',
        speakers: ['sonos_living_1', 'sonos_living_2'],
        type: 'stereo',
        maxVolume: 80,
        currentVolume: 0,
        playing: false,
        source: null,
        track: null
      },
      {
        id: 'kitchen',
        name: 'Kök',
        speakers: ['sonos_kitchen'],
        type: 'mono',
        maxVolume: 70,
        currentVolume: 0,
        playing: false,
        source: null,
        track: null
      },
      {
        id: 'master_bedroom',
        name: 'Sovrum',
        speakers: ['sonos_bedroom'],
        type: 'mono',
        maxVolume: 60,
        currentVolume: 0,
        playing: false,
        source: null,
        track: null
      },
      {
        id: 'emma_bedroom',
        name: 'Emma Sovrum',
        speakers: ['google_nest_emma'],
        type: 'mono',
        maxVolume: 50,
        currentVolume: 0,
        playing: false,
        source: null,
        track: null
      },
      {
        id: 'oscar_bedroom',
        name: 'Oscar Sovrum',
        speakers: ['google_nest_oscar'],
        type: 'mono',
        maxVolume: 50,
        currentVolume: 0,
        playing: false,
        source: null,
        track: null
      },
      {
        id: 'bathroom',
        name: 'Badrum',
        speakers: ['bluetooth_bathroom'],
        type: 'mono',
        maxVolume: 65,
        currentVolume: 0,
        playing: false,
        source: null,
        track: null
      },
      {
        id: 'office',
        name: 'Kontor',
        speakers: ['sonos_office'],
        type: 'mono',
        maxVolume: 70,
        currentVolume: 0,
        playing: false,
        source: null,
        track: null
      }
    ];

    for (const zone of zones) {
      this.zones.set(zone.id, zone);
    }
  }

  // ============================================
  // PLAYBACK CONTROL
  // ============================================

  async play(zoneId, sourceId, trackId, volume) {
    const zone = this.zones.get(zoneId);
    const source = this.audioSources.get(sourceId);
    
    if (!zone || !source) {
      return { success: false, error: 'Zone or source not found' };
    }

    // Get track info
    const playlist = this.playlists.get(source.playlistId);
    const track = playlist?.tracks.find(t => t.id === trackId) || playlist?.tracks[0];

    if (!track) {
      return { success: false, error: 'Track not found' };
    }

    zone.playing = true;
    zone.source = sourceId;
    zone.track = track;
    zone.currentVolume = Math.min(volume || 40, zone.maxVolume);

    console.log(`▶️ Playing in ${zone.name}: ${track.title} by ${track.artist}`);
    console.log(`   Volume: ${zone.currentVolume}%`);

    // Track playback
    this.playbackHistory.push({
      timestamp: Date.now(),
      zone: zoneId,
      source: sourceId,
      track: track.id,
      volume: zone.currentVolume
    });

    return { success: true };
  }

  async pause(zoneId) {
    const zone = this.zones.get(zoneId);
    
    if (!zone) {
      return { success: false, error: 'Zone not found' };
    }

    zone.playing = false;
    console.log(`⏸️ Paused in ${zone.name}`);

    return { success: true };
  }

  async stop(zoneId) {
    const zone = this.zones.get(zoneId);
    
    if (!zone) {
      return { success: false, error: 'Zone not found' };
    }

    zone.playing = false;
    zone.track = null;
    console.log(`⏹️ Stopped in ${zone.name}`);

    return { success: true };
  }

  async setVolume(zoneId, volume) {
    const zone = this.zones.get(zoneId);
    
    if (!zone) {
      return { success: false, error: 'Zone not found' };
    }

    const newVolume = Math.min(Math.max(volume, 0), zone.maxVolume);
    zone.currentVolume = newVolume;

    console.log(`🔊 ${zone.name} volume: ${newVolume}%`);

    return { success: true, volume: newVolume };
  }

  async adjustVolume(zoneId, delta) {
    const zone = this.zones.get(zoneId);
    
    if (!zone) {
      return { success: false, error: 'Zone not found' };
    }

    return await this.setVolume(zoneId, zone.currentVolume + delta);
  }

  async nextTrack(zoneId) {
    const zone = this.zones.get(zoneId);
    
    if (!zone || !zone.source) {
      return { success: false, error: 'No active playback' };
    }

    const source = this.audioSources.get(zone.source);
    const playlist = this.playlists.get(source.playlistId);
    
    if (!playlist) {
      return { success: false, error: 'Playlist not found' };
    }

    const currentIndex = playlist.tracks.findIndex(t => t.id === zone.track.id);
    const nextIndex = (currentIndex + 1) % playlist.tracks.length;
    const nextTrack = playlist.tracks[nextIndex];

    zone.track = nextTrack;

    console.log(`⏭️ Next track in ${zone.name}: ${nextTrack.title}`);

    return { success: true, track: nextTrack };
  }

  async previousTrack(zoneId) {
    const zone = this.zones.get(zoneId);
    
    if (!zone || !zone.source) {
      return { success: false, error: 'No active playback' };
    }

    const source = this.audioSources.get(zone.source);
    const playlist = this.playlists.get(source.playlistId);
    
    if (!playlist) {
      return { success: false, error: 'Playlist not found' };
    }

    const currentIndex = playlist.tracks.findIndex(t => t.id === zone.track.id);
    const prevIndex = currentIndex === 0 ? playlist.tracks.length - 1 : currentIndex - 1;
    const prevTrack = playlist.tracks[prevIndex];

    zone.track = prevTrack;

    console.log(`⏮️ Previous track in ${zone.name}: ${prevTrack.title}`);

    return { success: true, track: prevTrack };
  }

  // ============================================
  // MULTI-ZONE CONTROL
  // ============================================

  async groupZones(zoneIds) {
    const zones = zoneIds.map(id => this.zones.get(id)).filter(z => z);

    if (zones.length < 2) {
      return { success: false, error: 'Need at least 2 zones' };
    }

    // Use first zone as master
    const master = zones[0];

    for (let i = 1; i < zones.length; i++) {
      const slave = zones[i];
      slave.playing = master.playing;
      slave.source = master.source;
      slave.track = master.track;
      slave.currentVolume = Math.min(master.currentVolume, slave.maxVolume);
    }

    console.log(`🔗 Grouped zones: ${zones.map(z => z.name).join(', ')}`);

    return { success: true, groupSize: zones.length };
  }

  async playEverywhere(sourceId, trackId, volume) {
    console.log('🌐 Playing everywhere...');

    for (const [zoneId, zone] of this.zones) {
      await this.play(zoneId, sourceId, trackId, Math.min(volume || 40, zone.maxVolume));
    }

    return { success: true, zones: this.zones.size };
  }

  async pauseAll() {
    console.log('⏸️ Pausing all zones...');

    for (const [zoneId] of this.zones) {
      await this.pause(zoneId);
    }

    return { success: true };
  }

  async stopAll() {
    console.log('⏹️ Stopping all zones...');

    for (const [zoneId] of this.zones) {
      await this.stop(zoneId);
    }

    return { success: true };
  }

  // ============================================
  // AUDIO SOURCES
  // ============================================

  async setupAudioSources() {
    const sources = [
      {
        id: 'spotify_premium',
        name: 'Spotify Premium',
        type: 'streaming',
        connected: true,
        playlistId: 'spotify_daily_mix'
      },
      {
        id: 'apple_music',
        name: 'Apple Music',
        type: 'streaming',
        connected: true,
        playlistId: 'apple_favorites'
      },
      {
        id: 'local_library',
        name: 'Lokal Musikbibliotek',
        type: 'local',
        connected: true,
        playlistId: 'local_collection'
      },
      {
        id: 'radio_p3',
        name: 'P3',
        type: 'radio',
        connected: true,
        playlistId: 'radio_p3'
      },
      {
        id: 'podcast',
        name: 'Podcasts',
        type: 'podcast',
        connected: true,
        playlistId: 'podcast_subscriptions'
      }
    ];

    for (const source of sources) {
      this.audioSources.set(source.id, source);
    }
  }

  // ============================================
  // PLAYLISTS
  // ============================================

  async setupPlaylists() {
    const playlists = [
      {
        id: 'spotify_daily_mix',
        name: 'Daily Mix',
        source: 'spotify_premium',
        tracks: [
          { id: 'track_1', title: 'Summer of Love', artist: 'The Weeknd', duration: 223 },
          { id: 'track_2', title: 'Levitating', artist: 'Dua Lipa', duration: 203 },
          { id: 'track_3', title: 'Blinding Lights', artist: 'The Weeknd', duration: 200 },
          { id: 'track_4', title: 'Good 4 U', artist: 'Olivia Rodrigo', duration: 178 },
          { id: 'track_5', title: 'Peaches', artist: 'Justin Bieber', duration: 198 }
        ]
      },
      {
        id: 'apple_favorites',
        name: 'Favoriter',
        source: 'apple_music',
        tracks: [
          { id: 'track_6', title: 'Dancing Queen', artist: 'ABBA', duration: 230 },
          { id: 'track_7', title: 'Gimme! Gimme! Gimme!', artist: 'ABBA', duration: 285 },
          { id: 'track_8', title: 'Waterloo', artist: 'ABBA', duration: 164 },
          { id: 'track_9', title: 'Mamma Mia', artist: 'ABBA', duration: 214 }
        ]
      },
      {
        id: 'morning_energy',
        name: 'Morgonenergi',
        source: 'spotify_premium',
        tracks: [
          { id: 'track_10', title: 'Wake Me Up', artist: 'Avicii', duration: 247 },
          { id: 'track_11', title: 'Happy', artist: 'Pharrell Williams', duration: 232 },
          { id: 'track_12', title: 'Good Morning', artist: 'Kanye West', duration: 193 }
        ]
      },
      {
        id: 'relaxation',
        name: 'Avkoppling',
        source: 'spotify_premium',
        tracks: [
          { id: 'track_13', title: 'Weightless', artist: 'Marconi Union', duration: 480 },
          { id: 'track_14', title: 'Clair de Lune', artist: 'Debussy', duration: 302 },
          { id: 'track_15', title: 'Nocturne Op. 9 No. 2', artist: 'Chopin', duration: 252 }
        ]
      }
    ];

    for (const playlist of playlists) {
      this.playlists.set(playlist.id, playlist);
    }
  }

  async createPlaylist(name, sourceId, trackIds) {
    const source = this.audioSources.get(sourceId);
    
    if (!source) {
      return { success: false, error: 'Source not found' };
    }

    const playlistId = 'playlist_' + Date.now();

    this.playlists.set(playlistId, {
      id: playlistId,
      name,
      source: sourceId,
      tracks: trackIds.map(id => ({ id, title: 'Track', artist: 'Artist', duration: 200 })),
      created: Date.now()
    });

    console.log(`📝 Created playlist: ${name} (${trackIds.length} tracks)`);

    return { success: true, playlistId };
  }

  // ============================================
  // AUDIO SCENES
  // ============================================

  async setupAudioScenes() {
    const scenes = [
      {
        id: 'morning_routine',
        name: 'Morgonrutin',
        zones: [
          { id: 'kitchen', source: 'spotify_premium', playlist: 'morning_energy', volume: 50 },
          { id: 'bathroom', source: 'spotify_premium', playlist: 'morning_energy', volume: 45 }
        ]
      },
      {
        id: 'dinner_music',
        name: 'Middagsmusik',
        zones: [
          { id: 'kitchen', source: 'spotify_premium', playlist: 'relaxation', volume: 35 },
          { id: 'living_room', source: 'spotify_premium', playlist: 'relaxation', volume: 30 }
        ]
      },
      {
        id: 'party_mode',
        name: 'Festläge',
        zones: [
          { id: 'living_room', source: 'spotify_premium', playlist: 'spotify_daily_mix', volume: 70 },
          { id: 'kitchen', source: 'spotify_premium', playlist: 'spotify_daily_mix', volume: 65 }
        ]
      },
      {
        id: 'bedtime_kids',
        name: 'Läggdags Barn',
        zones: [
          { id: 'emma_bedroom', source: 'spotify_premium', playlist: 'relaxation', volume: 20 },
          { id: 'oscar_bedroom', source: 'spotify_premium', playlist: 'relaxation', volume: 20 }
        ]
      },
      {
        id: 'work_focus',
        name: 'Arbetsläge',
        zones: [
          { id: 'office', source: 'spotify_premium', playlist: 'relaxation', volume: 25 }
        ]
      }
    ];

    for (const scene of scenes) {
      this.audioScenes.set(scene.id, scene);
    }
  }

  async activateAudioScene(sceneId) {
    const scene = this.audioScenes.get(sceneId);
    
    if (!scene) {
      return { success: false, error: 'Scene not found' };
    }

    console.log(`🎵 Activating audio scene: ${scene.name}`);

    for (const zoneConfig of scene.zones) {
      const playlist = this.playlists.get(zoneConfig.playlist);
      
      if (playlist && playlist.tracks.length > 0) {
        await this.play(
          zoneConfig.id,
          zoneConfig.source,
          playlist.tracks[0].id,
          zoneConfig.volume
        );
      }
    }

    return { success: true, zones: scene.zones.length };
  }

  // ============================================
  // SMART FEATURES
  // ============================================

  async autoVolumeAdjust(zoneId, time) {
    const zone = this.zones.get(zoneId);
    
    if (!zone || !zone.playing) {
      return { success: false };
    }

    const hour = new Date(time).getHours();

    let targetVolume;

    if (hour >= 6 && hour < 9) {
      // Morning - moderate
      targetVolume = zone.maxVolume * 0.6;
    } else if (hour >= 9 && hour < 22) {
      // Day - normal
      targetVolume = zone.maxVolume * 0.7;
    } else {
      // Night - quiet
      targetVolume = zone.maxVolume * 0.3;
    }

    await this.setVolume(zoneId, Math.round(targetVolume));

    return { success: true };
  }

  async getRecommendedPlaylist(context) {
    const { time, mood, _activity } = context;

    const hour = new Date(time).getHours();

    // Time-based recommendations
    if (hour >= 6 && hour < 10) {
      return this.playlists.get('morning_energy');
    } else if (hour >= 18 && hour < 21) {
      return this.playlists.get('relaxation');
    } else if (mood === 'party') {
      return this.playlists.get('spotify_daily_mix');
    }

    return this.playlists.get('spotify_daily_mix');
  }

  // ============================================
  // MONITORING
  // ============================================

  startMonitoring() {
    // Auto-adjust volume based on time
    setInterval(() => {
      for (const [zoneId, zone] of this.zones) {
        if (zone.playing) {
          this.autoVolumeAdjust(zoneId, Date.now());
        }
      }
    }, 60 * 60 * 1000);  // Every hour

    console.log('🎵 Multi-Zone Audio active');
  }

  // ============================================
  // REPORTING
  // ============================================

  getAudioControllerOverview() {
    const activeZones = Array.from(this.zones.values()).filter(z => z.playing).length;

    return {
      zones: this.zones.size,
      activeZones,
      sources: this.audioSources.size,
      playlists: this.playlists.size,
      scenes: this.audioScenes.size
    };
  }

  getZoneStatus() {
    return Array.from(this.zones.values()).map(z => ({
      name: z.name,
      status: z.playing ? '▶️ Playing' : '⏸️ Paused',
      track: z.track ? `${z.track.title} - ${z.track.artist}` : '-',
      volume: z.currentVolume + '%'
    }));
  }

  getAudioScenes() {
    return Array.from(this.audioScenes.values()).map(s => ({
      name: s.name,
      zones: s.zones.length + ' zones'
    }));
  }

  getPlaybackHistory(limit = 10) {
    return this.playbackHistory.slice(-limit).map(h => {
      const zone = this.zones.get(h.zone);
      const source = this.audioSources.get(h.source);
      const playlist = this.playlists.get(source?.playlistId);
      const track = playlist?.tracks.find(t => t.id === h.track);

      return {
        time: new Date(h.timestamp).toLocaleTimeString('sv-SE'),
        zone: zone?.name || h.zone,
        track: track ? `${track.title} - ${track.artist}` : 'Unknown'
      };
    });
  }
}

module.exports = MultiZoneAudioController;
