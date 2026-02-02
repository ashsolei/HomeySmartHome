'use strict';

const EventEmitter = require('events');
const Homey = require('homey');

/**
 * Advanced Music & Audio System
 * 
 * Comprehensive multi-room audio automation with streaming integration, vinyl collection
 * management, playlist intelligence, and immersive listening experiences.
 * 
 * Features:
 * - Multi-room audio control with synchronized playback
 * - Streaming service integration (Spotify, Apple Music, Tidal)
 * - Vinyl collection tracking and playback
 * - Intelligent playlist generation
 * - Audio profiles for different moods/activities
 * - Sound zones with independent control
 * - Volume normalization across rooms
 * - Listening history and analytics
 * 
 * @extends EventEmitter
 */
class AdvancedMusicAudioSystem extends EventEmitter {
  constructor() {
    super();
    
    this.audioZones = new Map();
    this.speakers = new Map();
    this.vinylCollection = new Map();
    this.streamingServices = new Map();
    this.playlists = new Map();
    this.audioProfiles = new Map();
    this.listeningHistory = [];
    
    this.settings = {
      defaultVolume: 40,
      maxVolume: 85,
      volumeNormalization: true,
      crossfadeEnabled: true,
      crossfadeDuration: 3, // seconds
      autoPlayEnabled: false,
      sleepTimerDefault: 60 // minutes
    };
    
    this.cache = {
      data: new Map(),
      timestamps: new Map(),
      ttl: 5 * 60 * 1000 // 5 minutes cache
    };
    
    this.monitoring = {
      interval: null,
      checkInterval: 2 * 60 * 1000, // Check every 2 minutes
      lastCheck: null
    };
    
    this.initializeDefaultData();
  }
  
  /**
   * Initialize default audio data
   */
  initializeDefaultData() {
    // Audio Zones
    this.audioZones.set('zone-001', {
      id: 'zone-001',
      name: 'Living Room',
      speakers: ['speaker-001', 'speaker-002'],
      status: 'idle',
      currentSource: null,
      currentTrack: null,
      volume: 45,
      muted: false,
      equalizerProfile: 'balanced',
      groupedWith: []
    });
    
    this.audioZones.set('zone-002', {
      id: 'zone-002',
      name: 'Kitchen',
      speakers: ['speaker-003'],
      status: 'idle',
      currentSource: null,
      currentTrack: null,
      volume: 50,
      muted: false,
      equalizerProfile: 'vocal-boost',
      groupedWith: []
    });
    
    this.audioZones.set('zone-003', {
      id: 'zone-003',
      name: 'Bedroom',
      speakers: ['speaker-004'],
      status: 'idle',
      currentSource: null,
      currentTrack: null,
      volume: 35,
      muted: false,
      equalizerProfile: 'balanced',
      groupedWith: []
    });
    
    this.audioZones.set('zone-004', {
      id: 'zone-004',
      name: 'Home Office',
      speakers: ['speaker-005'],
      status: 'idle',
      currentSource: null,
      currentTrack: null,
      volume: 40,
      muted: false,
      equalizerProfile: 'focus',
      groupedWith: []
    });
    
    // Speakers
    this.speakers.set('speaker-001', {
      id: 'speaker-001',
      name: 'Living Room Left',
      brand: 'Sonos',
      model: 'Era 300',
      type: 'smart-speaker',
      capabilities: ['stereo', 'spatial-audio', 'airplay', 'spotify-connect'],
      position: 'front-left',
      powerState: 'on',
      firmwareVersion: '15.9',
      lastSeen: Date.now()
    });
    
    this.speakers.set('speaker-002', {
      id: 'speaker-002',
      name: 'Living Room Right',
      brand: 'Sonos',
      model: 'Era 300',
      type: 'smart-speaker',
      capabilities: ['stereo', 'spatial-audio', 'airplay', 'spotify-connect'],
      position: 'front-right',
      powerState: 'on',
      firmwareVersion: '15.9',
      lastSeen: Date.now()
    });
    
    this.speakers.set('speaker-003', {
      id: 'speaker-003',
      name: 'Kitchen Speaker',
      brand: 'Sonos',
      model: 'One SL',
      type: 'smart-speaker',
      capabilities: ['airplay', 'spotify-connect'],
      position: 'ceiling-mounted',
      powerState: 'on',
      firmwareVersion: '15.9',
      lastSeen: Date.now()
    });
    
    this.speakers.set('speaker-004', {
      id: 'speaker-004',
      name: 'Bedroom Speaker',
      brand: 'Bose',
      model: 'Home Speaker 500',
      type: 'smart-speaker',
      capabilities: ['bluetooth', 'airplay', 'spotify-connect'],
      position: 'nightstand',
      powerState: 'standby',
      firmwareVersion: '3.2.1',
      lastSeen: Date.now()
    });
    
    this.speakers.set('speaker-005', {
      id: 'speaker-005',
      name: 'Office Speaker',
      brand: 'KEF',
      model: 'LSX II',
      type: 'active-speaker',
      capabilities: ['bluetooth', 'airplay', 'spotify-connect', 'wireless'],
      position: 'desk',
      powerState: 'on',
      firmwareVersion: '4.1.8',
      lastSeen: Date.now()
    });
    
    // Vinyl Collection
    this.vinylCollection.set('vinyl-001', {
      id: 'vinyl-001',
      artist: 'Pink Floyd',
      album: 'The Dark Side of the Moon',
      year: 1973,
      genre: 'Progressive Rock',
      label: 'Harvest Records',
      condition: 'Near Mint',
      pressNumber: 'UK First Press',
      purchaseDate: Date.now() - 1200 * 24 * 60 * 60 * 1000,
      lastPlayed: Date.now() - 30 * 24 * 60 * 60 * 1000,
      playCount: 47,
      storageLocation: 'Shelf A3',
      coverArt: '/vinyl/darkside.jpg',
      tracks: [
        { side: 'A', number: 1, title: 'Speak to Me', duration: 90 },
        { side: 'A', number: 2, title: 'Breathe', duration: 163 },
        { side: 'A', number: 3, title: 'On the Run', duration: 216 },
        { side: 'A', number: 4, title: 'Time', duration: 413 },
        { side: 'A', number: 5, title: 'The Great Gig in the Sky', duration: 283 },
        { side: 'B', number: 1, title: 'Money', duration: 382 },
        { side: 'B', number: 2, title: 'Us and Them', duration: 461 },
        { side: 'B', number: 3, title: 'Any Colour You Like', duration: 205 },
        { side: 'B', number: 4, title: 'Brain Damage', duration: 228 },
        { side: 'B', number: 5, title: 'Eclipse', duration: 123 }
      ]
    });
    
    this.vinylCollection.set('vinyl-002', {
      id: 'vinyl-002',
      artist: 'Miles Davis',
      album: 'Kind of Blue',
      year: 1959,
      genre: 'Jazz',
      label: 'Columbia',
      condition: 'Very Good Plus',
      pressNumber: '1959 Mono',
      purchaseDate: Date.now() - 800 * 24 * 60 * 60 * 1000,
      lastPlayed: Date.now() - 15 * 24 * 60 * 60 * 1000,
      playCount: 89,
      storageLocation: 'Shelf A1',
      coverArt: '/vinyl/kindofblue.jpg',
      tracks: [
        { side: 'A', number: 1, title: 'So What', duration: 562 },
        { side: 'A', number: 2, title: 'Freddie Freeloader', duration: 583 },
        { side: 'A', number: 3, title: 'Blue in Green', duration: 337 },
        { side: 'B', number: 1, title: 'All Blues', duration: 691 },
        { side: 'B', number: 2, title: 'Flamenco Sketches', duration: 562 }
      ]
    });
    
    this.vinylCollection.set('vinyl-003', {
      id: 'vinyl-003',
      artist: 'The Beatles',
      album: 'Abbey Road',
      year: 1969,
      genre: 'Rock',
      label: 'Apple Records',
      condition: 'Mint',
      pressNumber: '2012 Remaster',
      purchaseDate: Date.now() - 400 * 24 * 60 * 60 * 1000,
      lastPlayed: Date.now() - 60 * 24 * 60 * 60 * 1000,
      playCount: 23,
      storageLocation: 'Shelf B2',
      coverArt: '/vinyl/abbeyroad.jpg',
      tracks: [
        { side: 'A', number: 1, title: 'Come Together', duration: 259 },
        { side: 'A', number: 2, title: 'Something', duration: 182 },
        { side: 'A', number: 3, title: 'Maxwell\'s Silver Hammer', duration: 207 },
        { side: 'A', number: 4, title: 'Oh! Darling', duration: 206 },
        { side: 'A', number: 5, title: 'Octopus\'s Garden', duration: 171 },
        { side: 'A', number: 6, title: 'I Want You (She\'s So Heavy)', duration: 467 },
        { side: 'B', number: 1, title: 'Here Comes the Sun', duration: 185 },
        { side: 'B', number: 2, title: 'Because', duration: 165 },
        { side: 'B', number: 3, title: 'You Never Give Me Your Money', duration: 242 }
      ]
    });
    
    // Streaming Services
    this.streamingServices.set('spotify', {
      id: 'spotify',
      name: 'Spotify',
      status: 'connected',
      accountType: 'premium',
      username: 'user@example.com',
      apiConnected: true,
      lastSync: Date.now() - 60 * 60 * 1000
    });
    
    this.streamingServices.set('apple-music', {
      id: 'apple-music',
      name: 'Apple Music',
      status: 'connected',
      accountType: 'family',
      username: 'user@icloud.com',
      apiConnected: true,
      lastSync: Date.now() - 2 * 60 * 60 * 1000
    });
    
    this.streamingServices.set('tidal', {
      id: 'tidal',
      name: 'Tidal',
      status: 'connected',
      accountType: 'hifi-plus',
      username: 'user@example.com',
      apiConnected: true,
      lastSync: Date.now() - 30 * 60 * 1000
    });
    
    // Playlists
    this.playlists.set('playlist-001', {
      id: 'playlist-001',
      name: 'Morning Energy',
      description: 'Upbeat tracks to start your day',
      source: 'spotify',
      trackCount: 45,
      duration: 10800, // seconds
      genre: 'mixed',
      mood: 'energetic',
      createdDate: Date.now() - 90 * 24 * 60 * 60 * 1000,
      lastPlayed: Date.now() - 2 * 24 * 60 * 60 * 1000,
      playCount: 87,
      favorite: true
    });
    
    this.playlists.set('playlist-002', {
      id: 'playlist-002',
      name: 'Focus Flow',
      description: 'Instrumental music for deep work',
      source: 'apple-music',
      trackCount: 62,
      duration: 14400,
      genre: 'ambient',
      mood: 'focused',
      createdDate: Date.now() - 120 * 24 * 60 * 60 * 1000,
      lastPlayed: Date.now() - 1 * 24 * 60 * 60 * 1000,
      playCount: 134,
      favorite: true
    });
    
    this.playlists.set('playlist-003', {
      id: 'playlist-003',
      name: 'Evening Wind Down',
      description: 'Relaxing tracks for the evening',
      source: 'tidal',
      trackCount: 38,
      duration: 9000,
      genre: 'jazz',
      mood: 'relaxed',
      createdDate: Date.now() - 60 * 24 * 60 * 60 * 1000,
      lastPlayed: Date.now() - 3 * 24 * 60 * 60 * 1000,
      playCount: 56,
      favorite: true
    });
    
    // Audio Profiles
    this.audioProfiles.set('balanced', {
      id: 'balanced',
      name: 'Balanced',
      description: 'Flat response for accurate sound',
      equalizer: {
        bass: 0,
        mid: 0,
        treble: 0,
        preset: 'flat'
      }
    });
    
    this.audioProfiles.set('bass-boost', {
      id: 'bass-boost',
      name: 'Bass Boost',
      description: 'Enhanced low frequencies',
      equalizer: {
        bass: +5,
        mid: 0,
        treble: -2,
        preset: 'bass-enhanced'
      }
    });
    
    this.audioProfiles.set('vocal-boost', {
      id: 'vocal-boost',
      name: 'Vocal Boost',
      description: 'Clear vocals for podcasts',
      equalizer: {
        bass: -3,
        mid: +4,
        treble: +2,
        preset: 'voice-enhanced'
      }
    });
    
    this.audioProfiles.set('focus', {
      id: 'focus',
      name: 'Focus',
      description: 'Ambient sound for concentration',
      equalizer: {
        bass: -2,
        mid: 0,
        treble: -1,
        preset: 'soft'
      }
    });
    
    // Listening History
    this.listeningHistory.push({
      id: 'history-1234567890',
      zoneId: 'zone-001',
      source: 'spotify',
      type: 'playlist',
      playlistId: 'playlist-001',
      trackName: 'Mr. Blue Sky',
      artist: 'Electric Light Orchestra',
      album: 'Out of the Blue',
      duration: 302,
      startTime: Date.now() - 3 * 60 * 60 * 1000,
      endTime: Date.now() - 3 * 60 * 60 * 1000 + 302000,
      completed: true,
      volume: 45
    });
  }
  
  /**
   * Initialize the music & audio system
   */
  async initialize() {
    try {
      await this.loadSettings();
      this.startMonitoring();
      
      this.emit('notification', {
        type: 'info',
        priority: 'low',
        title: 'Music & Audio System',
        message: `Audio system initialized with ${this.audioZones.size} zones and ${this.speakers.size} speakers`
      });
      
      return { success: true, zones: this.audioZones.size, speakers: this.speakers.size };
    } catch (error) {
      this.emit('notification', {
        type: 'error',
        priority: 'high',
        title: 'Audio System Error',
        message: `Failed to initialize: ${error.message}`
      });
      throw error;
    }
  }
  
  /**
   * Play music in zone
   */
  async playMusic(zoneId, options = {}) {
    try {
      const zone = this.audioZones.get(zoneId);
      if (!zone) {
        throw new Error(`Zone ${zoneId} not found`);
      }
      
      const { source, playlistId, vinylId, trackUri, volume } = options;
      
      // Set volume if specified
      if (volume !== undefined) {
        zone.volume = Math.min(this.settings.maxVolume, volume);
      }
      
      // Determine source
      let currentSource = null;
      let currentTrack = null;
      
      if (vinylId) {
        const vinyl = this.vinylCollection.get(vinylId);
        if (!vinyl) {
          throw new Error(`Vinyl ${vinylId} not found`);
        }
        
        currentSource = 'vinyl';
        currentTrack = {
          type: 'vinyl',
          vinylId,
          artist: vinyl.artist,
          album: vinyl.album,
          year: vinyl.year,
          genre: vinyl.genre
        };
        
        // Update vinyl play count
        vinyl.lastPlayed = Date.now();
        vinyl.playCount++;
        
      } else if (playlistId) {
        const playlist = this.playlists.get(playlistId);
        if (!playlist) {
          throw new Error(`Playlist ${playlistId} not found`);
        }
        
        currentSource = playlist.source;
        currentTrack = {
          type: 'playlist',
          playlistId,
          name: playlist.name,
          trackCount: playlist.trackCount
        };
        
        // Update playlist play count
        playlist.lastPlayed = Date.now();
        playlist.playCount++;
        
      } else if (trackUri) {
        currentSource = source || 'spotify';
        currentTrack = {
          type: 'track',
          uri: trackUri
        };
      } else {
        throw new Error('No source specified (playlist, vinyl, or track)');
      }
      
      // Update zone status
      zone.status = 'playing';
      zone.currentSource = currentSource;
      zone.currentTrack = currentTrack;
      zone.muted = false;
      
      // Group zones if specified
      if (options.groupWith && options.groupWith.length > 0) {
        await this.groupZones([zoneId, ...options.groupWith]);
      }
      
      // Add to listening history
      this.listeningHistory.unshift({
        id: `history-${Date.now()}`,
        zoneId,
        source: currentSource,
        type: currentTrack.type,
        playlistId: currentTrack.playlistId || null,
        vinylId: currentTrack.vinylId || null,
        trackName: currentTrack.name || currentTrack.album || 'Unknown',
        artist: currentTrack.artist || 'Unknown',
        album: currentTrack.album || null,
        startTime: Date.now(),
        endTime: null,
        completed: false,
        volume: zone.volume
      });
      
      if (this.listeningHistory.length > 200) {
        this.listeningHistory = this.listeningHistory.slice(0, 200);
      }
      
      this.emit('notification', {
        type: 'info',
        priority: 'low',
        title: 'Music Playing',
        message: `${zone.name} - ${currentTrack.artist || currentTrack.name || 'Music'} (Volume ${zone.volume}%)`
      });
      
      await this.saveSettings();
      this.clearCache();
      
      return { 
        success: true, 
        zone: zone.name,
        source: currentSource,
        track: currentTrack,
        volume: zone.volume
      };
      
    } catch (error) {
      this.emit('notification', {
        type: 'error',
        priority: 'high',
        title: 'Playback Error',
        message: error.message
      });
      throw error;
    }
  }
  
  /**
   * Pause music in zone
   */
  async pauseMusic(zoneId) {
    try {
      const zone = this.audioZones.get(zoneId);
      if (!zone) {
        throw new Error(`Zone ${zoneId} not found`);
      }
      
      zone.status = 'paused';
      
      // Update listening history
      if (this.listeningHistory.length > 0 && this.listeningHistory[0].zoneId === zoneId) {
        // Don't mark as complete, just pause
      }
      
      await this.saveSettings();
      this.clearCache();
      
      return { success: true, zone: zone.name, status: 'paused' };
      
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Stop music in zone
   */
  async stopMusic(zoneId) {
    try {
      const zone = this.audioZones.get(zoneId);
      if (!zone) {
        throw new Error(`Zone ${zoneId} not found`);
      }
      
      zone.status = 'idle';
      zone.currentSource = null;
      zone.currentTrack = null;
      
      // Complete listening history entry
      if (this.listeningHistory.length > 0 && this.listeningHistory[0].zoneId === zoneId) {
        this.listeningHistory[0].endTime = Date.now();
        this.listeningHistory[0].completed = true;
      }
      
      await this.saveSettings();
      this.clearCache();
      
      return { success: true, zone: zone.name, status: 'stopped' };
      
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Set volume for zone
   */
  async setVolume(zoneId, volume) {
    try {
      const zone = this.audioZones.get(zoneId);
      if (!zone) {
        throw new Error(`Zone ${zoneId} not found`);
      }
      
      zone.volume = Math.min(this.settings.maxVolume, Math.max(0, volume));
      zone.muted = false;
      
      // Also update grouped zones if any
      if (zone.groupedWith.length > 0) {
        for (const groupedZoneId of zone.groupedWith) {
          const groupedZone = this.audioZones.get(groupedZoneId);
          if (groupedZone) {
            groupedZone.volume = zone.volume;
          }
        }
      }
      
      await this.saveSettings();
      this.clearCache();
      
      return { success: true, zone: zone.name, volume: zone.volume };
      
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Group audio zones for synchronized playback
   */
  async groupZones(zoneIds) {
    try {
      if (zoneIds.length < 2) {
        throw new Error('At least 2 zones required for grouping');
      }
      
      const primaryZoneId = zoneIds[0];
      const secondaryZoneIds = zoneIds.slice(1);
      
      const primaryZone = this.audioZones.get(primaryZoneId);
      if (!primaryZone) {
        throw new Error(`Primary zone ${primaryZoneId} not found`);
      }
      
      // Update primary zone
      primaryZone.groupedWith = secondaryZoneIds;
      
      // Update secondary zones
      for (const zoneId of secondaryZoneIds) {
        const zone = this.audioZones.get(zoneId);
        if (zone) {
          zone.status = primaryZone.status;
          zone.currentSource = primaryZone.currentSource;
          zone.currentTrack = primaryZone.currentTrack;
          zone.groupedWith = [primaryZoneId];
          
          // Volume normalization
          if (this.settings.volumeNormalization) {
            zone.volume = primaryZone.volume;
          }
        }
      }
      
      this.emit('notification', {
        type: 'info',
        priority: 'low',
        title: 'Zones Grouped',
        message: `${zoneIds.length} zones now playing synchronized audio`
      });
      
      await this.saveSettings();
      this.clearCache();
      
      return { success: true, primaryZone: primaryZone.name, groupSize: zoneIds.length };
      
    } catch (error) {
      this.emit('notification', {
        type: 'error',
        priority: 'medium',
        title: 'Grouping Error',
        message: error.message
      });
      throw error;
    }
  }
  
  /**
   * Ungroup audio zones
   */
  async ungroupZones(zoneId) {
    try {
      const zone = this.audioZones.get(zoneId);
      if (!zone) {
        throw new Error(`Zone ${zoneId} not found`);
      }
      
      // Clear grouping for this zone
      const wasGroupedWith = [...zone.groupedWith];
      zone.groupedWith = [];
      
      // Clear grouping references in other zones
      for (const otherZoneId of wasGroupedWith) {
        const otherZone = this.audioZones.get(otherZoneId);
        if (otherZone) {
          otherZone.groupedWith = otherZone.groupedWith.filter(id => id !== zoneId);
        }
      }
      
      await this.saveSettings();
      this.clearCache();
      
      return { success: true, zone: zone.name, ungrouped: true };
      
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Get playlist recommendation based on mood/activity
   */
  getPlaylistRecommendation(options = {}) {
    const { mood, genre, minDuration, maxDuration } = options;
    
    let playlists = Array.from(this.playlists.values());
    
    if (mood) {
      playlists = playlists.filter(p => p.mood === mood);
    }
    
    if (genre) {
      playlists = playlists.filter(p => p.genre === genre || p.genre === 'mixed');
    }
    
    if (minDuration) {
      playlists = playlists.filter(p => p.duration >= minDuration);
    }
    
    if (maxDuration) {
      playlists = playlists.filter(p => p.duration <= maxDuration);
    }
    
    // Sort by play count and favorites
    playlists.sort((a, b) => {
      if (a.favorite && !b.favorite) return -1;
      if (!a.favorite && b.favorite) return 1;
      return b.playCount - a.playCount;
    });
    
    return playlists.slice(0, 5);
  }
  
  /**
   * Get music statistics
   */
  getMusicStatistics() {
    const cached = this.getCached('music-stats');
    if (cached) return cached;
    
    const completedListening = this.listeningHistory.filter(h => h.completed);
    
    const totalListens = completedListening.length;
    const totalMinutes = completedListening.reduce((sum, h) => {
      return sum + ((h.endTime - h.startTime) / 60000);
    }, 0);
    
    // Most played source
    const sourceCounts = {};
    completedListening.forEach(h => {
      sourceCounts[h.source] = (sourceCounts[h.source] || 0) + 1;
    });
    const mostUsedSource = Object.entries(sourceCounts)
      .sort((a, b) => b[1] - a[1])[0];
    
    // Most active zone
    const zoneCounts = {};
    completedListening.forEach(h => {
      const zone = this.audioZones.get(h.zoneId);
      if (zone) {
        zoneCounts[zone.name] = (zoneCounts[zone.name] || 0) + 1;
      }
    });
    const mostActiveZone = Object.entries(zoneCounts)
      .sort((a, b) => b[1] - a[1])[0];
    
    const stats = {
      listening: {
        totalSessions: totalListens,
        totalMinutes: Math.round(totalMinutes),
        averageSessionMinutes: totalListens > 0 ? Math.round(totalMinutes / totalListens) : 0
      },
      zones: {
        total: this.audioZones.size,
        active: Array.from(this.audioZones.values())
          .filter(z => z.status !== 'idle').length,
        mostActive: mostActiveZone ? {
          zone: mostActiveZone[0],
          sessions: mostActiveZone[1]
        } : null
      },
      speakers: {
        total: this.speakers.size,
        online: Array.from(this.speakers.values())
          .filter(s => s.powerState === 'on').length
      },
      sources: {
        mostUsed: mostUsedSource ? {
          source: mostUsedSource[0],
          sessions: mostUsedSource[1]
        } : null,
        streaming: this.streamingServices.size,
        vinyl: this.vinylCollection.size
      },
      playlists: {
        total: this.playlists.size,
        favorites: Array.from(this.playlists.values())
          .filter(p => p.favorite).length
      }
    };
    
    this.setCached('music-stats', stats);
    return stats;
  }
  
  /**
   * Get all audio zones
   */
  getAudioZones() {
    return Array.from(this.audioZones.values());
  }
  
  /**
   * Get vinyl collection
   */
  getVinylCollection(options = {}) {
    let vinyls = Array.from(this.vinylCollection.values());
    
    if (options.genre) {
      vinyls = vinyls.filter(v => v.genre.toLowerCase().includes(options.genre.toLowerCase()));
    }
    
    if (options.artist) {
      vinyls = vinyls.filter(v => v.artist.toLowerCase().includes(options.artist.toLowerCase()));
    }
    
    if (options.sortBy === 'play-count') {
      vinyls.sort((a, b) => b.playCount - a.playCount);
    } else if (options.sortBy === 'recent') {
      vinyls.sort((a, b) => b.lastPlayed - a.lastPlayed);
    } else if (options.sortBy === 'year') {
      vinyls.sort((a, b) => b.year - a.year);
    }
    
    return vinyls;
  }
  
  /**
   * Get playlists
   */
  getPlaylists(options = {}) {
    let playlists = Array.from(this.playlists.values());
    
    if (options.source) {
      playlists = playlists.filter(p => p.source === options.source);
    }
    
    if (options.mood) {
      playlists = playlists.filter(p => p.mood === options.mood);
    }
    
    if (options.favorite) {
      playlists = playlists.filter(p => p.favorite);
    }
    
    return playlists;
  }
  
  /**
   * Start monitoring
   */
  startMonitoring() {
    if (this.monitoring.interval) {
      clearInterval(this.monitoring.interval);
    }
    
    this.monitoring.interval = setInterval(() => {
      this.monitorZones();
      this.monitorSpeakers();
    }, this.monitoring.checkInterval);
  }
  
  /**
   * Monitor zones
   */
  monitorZones() {
    this.monitoring.lastCheck = Date.now();
    
    // Update speaker connectivity
    for (const [id, speaker] of this.speakers) {
      // Simulate occasional connectivity check
      speaker.lastSeen = Date.now();
    }
  }
  
  /**
   * Monitor speakers
   */
  monitorSpeakers() {
    for (const [id, speaker] of this.speakers) {
      const minutesSinceLastSeen = (Date.now() - speaker.lastSeen) / 60000;
      
      if (minutesSinceLastSeen > 10) {
        this.emit('notification', {
          type: 'warning',
          priority: 'medium',
          title: 'Speaker Offline',
          message: `${speaker.name} has not responded in ${Math.round(minutesSinceLastSeen)} minutes`
        });
      }
    }
  }
  
  /**
   * Cache management
   */
  getCached(key) {
    const cached = this.cache.data.get(key);
    const timestamp = this.cache.timestamps.get(key);
    
    if (cached && timestamp && (Date.now() - timestamp < this.cache.ttl)) {
      return cached;
    }
    
    return null;
  }
  
  setCached(key, value) {
    this.cache.data.set(key, value);
    this.cache.timestamps.set(key, Date.now());
    
    if (this.cache.data.size > 40) {
      const oldestKey = Array.from(this.cache.timestamps.entries())
        .sort((a, b) => a[1] - b[1])[0][0];
      this.cache.data.delete(oldestKey);
      this.cache.timestamps.delete(oldestKey);
    }
  }
  
  clearCache() {
    this.cache.data.clear();
    this.cache.timestamps.clear();
  }
  
  /**
   * Load settings from Homey
   */
  async loadSettings() {
    try {
      const settings = Homey.ManagerSettings.get('advancedMusicAudioSystem');
      if (settings) {
        this.audioZones = new Map(settings.audioZones || []);
        this.speakers = new Map(settings.speakers || []);
        this.vinylCollection = new Map(settings.vinylCollection || []);
        this.streamingServices = new Map(settings.streamingServices || []);
        this.playlists = new Map(settings.playlists || []);
        this.audioProfiles = new Map(settings.audioProfiles || []);
        this.listeningHistory = settings.listeningHistory || [];
        Object.assign(this.settings, settings.settings || {});
      }
    } catch (error) {
      console.error('Failed to load music settings:', error);
    }
  }
  
  /**
   * Save settings to Homey
   */
  async saveSettings() {
    try {
      const settings = {
        audioZones: Array.from(this.audioZones.entries()),
        speakers: Array.from(this.speakers.entries()),
        vinylCollection: Array.from(this.vinylCollection.entries()),
        streamingServices: Array.from(this.streamingServices.entries()),
        playlists: Array.from(this.playlists.entries()),
        audioProfiles: Array.from(this.audioProfiles.entries()),
        listeningHistory: this.listeningHistory,
        settings: this.settings
      };
      
      Homey.ManagerSettings.set('advancedMusicAudioSystem', settings);
    } catch (error) {
      console.error('Failed to save music settings:', error);
      throw error;
    }
  }
}

module.exports = AdvancedMusicAudioSystem;
