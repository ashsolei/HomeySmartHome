'use strict';
const logger = require('./logger');

/**
 * Mood Lighting System
 * Emotion-based dynamic lighting with circadian rhythm support
 */
class MoodLightingSystem {
  constructor(app) {
    this._intervals = [];
    this._timeouts = [];
    this.app = app;
    this.lights = new Map();
    this.scenes = new Map();
    this.moods = new Map();
    this.schedules = new Map();
    this.circadianMode = true;
    this.currentMood = 'neutral';
  }

  async initialize() {
    await this.loadLights();
    await this.loadScenes();
    await this.loadMoods();
    await this.loadSchedules();
    
    this.startAutomation();
  }

  // ============================================
  // LIGHT MANAGEMENT
  // ============================================

  async loadLights() {
    const lightConfigs = [
      // Living room
      {
        id: 'living_ceiling',
        name: 'Vardagsrum tak',
        room: 'living_room',
        type: 'rgb',
        capabilities: ['onoff', 'dim', 'color_temp', 'rgb'],
        maxBrightness: 100,
        minColorTemp: 2700,
        maxColorTemp: 6500
      },
      {
        id: 'living_floor',
        name: 'Vardagsrum golvlampa',
        room: 'living_room',
        type: 'warm',
        capabilities: ['onoff', 'dim', 'color_temp'],
        maxBrightness: 100,
        minColorTemp: 2200,
        maxColorTemp: 3000
      },
      // Kitchen
      {
        id: 'kitchen_main',
        name: 'Kök huvudbelysning',
        room: 'kitchen',
        type: 'white',
        capabilities: ['onoff', 'dim', 'color_temp'],
        maxBrightness: 100,
        minColorTemp: 3000,
        maxColorTemp: 5000
      },
      {
        id: 'kitchen_counter',
        name: 'Kök bänkbelysning',
        room: 'kitchen',
        type: 'rgb',
        capabilities: ['onoff', 'dim', 'rgb'],
        maxBrightness: 100
      },
      // Bedroom
      {
        id: 'bedroom_ceiling',
        name: 'Sovrum tak',
        room: 'bedroom',
        type: 'rgb',
        capabilities: ['onoff', 'dim', 'color_temp', 'rgb'],
        maxBrightness: 100,
        minColorTemp: 2200,
        maxColorTemp: 5000
      },
      {
        id: 'bedroom_bedside_1',
        name: 'Sovrum sänglampa 1',
        room: 'bedroom',
        type: 'warm',
        capabilities: ['onoff', 'dim'],
        maxBrightness: 100
      },
      {
        id: 'bedroom_bedside_2',
        name: 'Sovrum sänglampa 2',
        room: 'bedroom',
        type: 'warm',
        capabilities: ['onoff', 'dim'],
        maxBrightness: 100
      },
      // Bathroom
      {
        id: 'bathroom_mirror',
        name: 'Badrum spegel',
        room: 'bathroom',
        type: 'white',
        capabilities: ['onoff', 'dim', 'color_temp'],
        maxBrightness: 100,
        minColorTemp: 4000,
        maxColorTemp: 6500
      },
      // Office
      {
        id: 'office_desk',
        name: 'Kontor skrivbordslampa',
        room: 'office',
        type: 'white',
        capabilities: ['onoff', 'dim', 'color_temp'],
        maxBrightness: 100,
        minColorTemp: 4000,
        maxColorTemp: 6500
      },
      // Hallway
      {
        id: 'hallway_main',
        name: 'Hall huvudbelysning',
        room: 'hallway',
        type: 'white',
        capabilities: ['onoff', 'dim'],
        maxBrightness: 100
      }
    ];

    for (const config of lightConfigs) {
      this.lights.set(config.id, {
        ...config,
        state: {
          on: false,
          brightness: 0,
          colorTemp: 3000,
          rgb: { r: 255, g: 255, b: 255 }
        },
        lastUpdate: null
      });
    }
  }

  // ============================================
  // MOOD DEFINITIONS
  // ============================================

  async loadMoods() {
    // Energized - bright, cool light
    this.moods.set('energized', {
      id: 'energized',
      name: 'Energisk',
      description: 'Ljust och fokuserat ljus för produktivitet',
      color: '#00bfff',
      settings: {
        brightness: 100,
        colorTemp: 5500, // Cool white
        rgb: { r: 200, g: 230, b: 255 }
      },
      rooms: {
        living_room: { brightness: 90, colorTemp: 5000 },
        kitchen: { brightness: 100, colorTemp: 5000 },
        office: { brightness: 100, colorTemp: 6000 },
        bedroom: { brightness: 80, colorTemp: 5000 }
      }
    });

    // Focused - moderate brightness, neutral
    this.moods.set('focused', {
      id: 'focused',
      name: 'Fokuserad',
      description: 'Balanserat ljus för koncentration',
      color: '#87ceeb',
      settings: {
        brightness: 80,
        colorTemp: 4500,
        rgb: { r: 220, g: 235, b: 245 }
      },
      rooms: {
        office: { brightness: 90, colorTemp: 5000 },
        living_room: { brightness: 70, colorTemp: 4000 },
        kitchen: { brightness: 80, colorTemp: 4500 }
      }
    });

    // Relaxed - warm, dimmed
    this.moods.set('relaxed', {
      id: 'relaxed',
      name: 'Avslappnad',
      description: 'Varmt och lugnande ljus',
      color: '#ffa500',
      settings: {
        brightness: 50,
        colorTemp: 2700,
        rgb: { r: 255, g: 180, b: 100 }
      },
      rooms: {
        living_room: { brightness: 60, colorTemp: 2700 },
        bedroom: { brightness: 40, colorTemp: 2400 },
        kitchen: { brightness: 50, colorTemp: 3000 }
      }
    });

    // Romantic - soft, warm tones
    this.moods.set('romantic', {
      id: 'romantic',
      name: 'Romantisk',
      description: 'Mjukt och intimt ljus',
      color: '#ff69b4',
      settings: {
        brightness: 30,
        colorTemp: 2200,
        rgb: { r: 255, g: 100, b: 150 }
      },
      rooms: {
        living_room: { brightness: 35, colorTemp: 2200, rgb: { r: 255, g: 120, b: 150 } },
        bedroom: { brightness: 25, colorTemp: 2200, rgb: { r: 255, g: 100, b: 130 } }
      }
    });

    // Party - colorful, dynamic
    this.moods.set('party', {
      id: 'party',
      name: 'Fest',
      description: 'Färgglatt och dynamiskt ljus',
      color: '#ff00ff',
      settings: {
        brightness: 80,
        colorTemp: 4000,
        rgb: { r: 255, g: 0, b: 255 },
        dynamic: true
      },
      rooms: {
        living_room: { brightness: 90, dynamic: true },
        kitchen: { brightness: 80, rgb: { r: 0, g: 255, b: 200 } }
      }
    });

    // Reading - bright, focused light
    this.moods.set('reading', {
      id: 'reading',
      name: 'Läsning',
      description: 'Perfekt ljus för läsning',
      color: '#fffacd',
      settings: {
        brightness: 85,
        colorTemp: 4000,
        rgb: { r: 255, g: 250, b: 200 }
      },
      rooms: {
        living_room: { brightness: 90, colorTemp: 4000 },
        bedroom: { brightness: 85, colorTemp: 4000 },
        office: { brightness: 90, colorTemp: 4500 }
      }
    });

    // Movie - dim, cinematic
    this.moods.set('movie', {
      id: 'movie',
      name: 'Film',
      description: 'Dämpad biobelysning',
      color: '#4b0082',
      settings: {
        brightness: 15,
        colorTemp: 2200,
        rgb: { r: 100, g: 50, b: 150 }
      },
      rooms: {
        living_room: { brightness: 10, rgb: { r: 80, g: 40, b: 120 } }
      }
    });

    // Sleep - very dim, red tones
    this.moods.set('sleep', {
      id: 'sleep',
      name: 'Sömn',
      description: 'Minimal belysning för sömn',
      color: '#8b0000',
      settings: {
        brightness: 5,
        colorTemp: 2000,
        rgb: { r: 255, g: 50, b: 30 }
      },
      rooms: {
        bedroom: { brightness: 5, rgb: { r: 255, g: 30, b: 20 } },
        hallway: { brightness: 10, colorTemp: 2200 }
      }
    });

    // Morning - gradual bright, cool
    this.moods.set('morning', {
      id: 'morning',
      name: 'Morgon',
      description: 'Simulerar soluppgång',
      color: '#fffacd',
      settings: {
        brightness: 70,
        colorTemp: 4500,
        rgb: { r: 255, g: 240, b: 200 }
      },
      rooms: {
        bedroom: { brightness: 60, colorTemp: 4000 },
        kitchen: { brightness: 80, colorTemp: 4500 },
        bathroom: { brightness: 90, colorTemp: 5000 }
      }
    });

    // Evening - warm transition
    this.moods.set('evening', {
      id: 'evening',
      name: 'Kväll',
      description: 'Mjuk övergång till kväll',
      color: '#ff8c00',
      settings: {
        brightness: 60,
        colorTemp: 2800,
        rgb: { r: 255, g: 200, b: 120 }
      },
      rooms: {
        living_room: { brightness: 70, colorTemp: 2800 },
        kitchen: { brightness: 65, colorTemp: 3000 },
        bedroom: { brightness: 50, colorTemp: 2600 }
      }
    });
  }

  // ============================================
  // SCENE MANAGEMENT
  // ============================================

  async loadScenes() {
    // Pre-defined scenes
    await this.createScene({
      id: 'welcome_home',
      name: 'Välkommen hem',
      mood: 'relaxed',
      lights: {
        hallway_main: { on: true, brightness: 80 },
        living_ceiling: { on: true, brightness: 60, colorTemp: 2800 },
        kitchen_main: { on: true, brightness: 50, colorTemp: 3000 }
      }
    });

    await this.createScene({
      id: 'dinner',
      name: 'Middag',
      mood: 'relaxed',
      lights: {
        kitchen_main: { on: true, brightness: 70, colorTemp: 2700 },
        kitchen_counter: { on: true, brightness: 40, rgb: { r: 255, g: 180, b: 100 } },
        living_ceiling: { on: true, brightness: 40, colorTemp: 2500 }
      }
    });

    await this.createScene({
      id: 'work_from_home',
      name: 'Hemmakontor',
      mood: 'focused',
      lights: {
        office_desk: { on: true, brightness: 100, colorTemp: 5000 },
        living_ceiling: { on: false }
      }
    });

    await this.createScene({
      id: 'bedtime',
      name: 'Läggdags',
      mood: 'sleep',
      lights: {
        bedroom_ceiling: { on: false },
        bedroom_bedside_1: { on: true, brightness: 5 },
        bedroom_bedside_2: { on: true, brightness: 5 },
        hallway_main: { on: true, brightness: 10 }
      }
    });
  }

  async createScene(config) {
    const scene = {
      id: config.id || `scene_${Date.now()}`,
      name: config.name,
      mood: config.mood || null,
      lights: config.lights,
      created: Date.now(),
      lastUsed: null,
      useCount: 0
    };

    this.scenes.set(scene.id, scene);

    return { success: true, scene };
  }

  async activateScene(sceneId) {
    const scene = this.scenes.get(sceneId);
    
    if (!scene) {
      return { success: false, error: 'Scene not found' };
    }

    logger.info(`🎭 Activating scene: ${scene.name}`);

    // Apply scene settings to lights
    for (const [lightId, settings] of Object.entries(scene.lights)) {
      const light = this.lights.get(lightId);
      if (light) {
        await this.setLight(lightId, settings);
      }
    }

    // Update scene usage
    scene.lastUsed = Date.now();
    scene.useCount++;

    // Set current mood if scene has one
    if (scene.mood) {
      this.currentMood = scene.mood;
    }

    return { success: true, scene };
  }

  // ============================================
  // LIGHTING CONTROL
  // ============================================

  async setLight(lightId, settings) {
    const light = this.lights.get(lightId);
    
    if (!light) {
      return { success: false, error: 'Light not found' };
    }

    // Apply settings
    if (settings.on !== undefined) {
      light.state.on = settings.on;
    }

    if (settings.brightness !== undefined) {
      light.state.brightness = Math.max(0, Math.min(100, settings.brightness));
    }

    if (settings.colorTemp !== undefined && light.capabilities.includes('color_temp')) {
      light.state.colorTemp = Math.max(
        light.minColorTemp,
        Math.min(light.maxColorTemp, settings.colorTemp)
      );
    }

    if (settings.rgb !== undefined && light.capabilities.includes('rgb')) {
      light.state.rgb = settings.rgb;
    }

    light.lastUpdate = Date.now();

    // In production: actually control the light
    // await this.app.devices.get(lightId).setCapabilities(light.state);

    return { success: true, light: light.state };
  }

  async setMood(moodId) {
    const mood = this.moods.get(moodId);
    
    if (!mood) {
      return { success: false, error: 'Mood not found' };
    }

    logger.info(`😊 Setting mood: ${mood.name}`);

    this.currentMood = moodId;

    // Apply mood to all lights based on room settings
    for (const [lightId, light] of this.lights) {
      const roomSettings = mood.rooms[light.room];
      
      if (!roomSettings) {
        // Use default mood settings
        await this.setLight(lightId, {
          on: true,
          ...mood.settings
        });
      } else {
        // Use room-specific settings
        await this.setLight(lightId, {
          on: true,
          ...roomSettings
        });
      }
    }

    return { success: true, mood };
  }

  async setRoomMood(room, moodId) {
    const mood = this.moods.get(moodId);
    
    if (!mood) {
      return { success: false, error: 'Mood not found' };
    }

    // Apply mood only to lights in specified room
    const roomLights = Array.from(this.lights.values()).filter(l => l.room === room);
    const roomSettings = mood.rooms[room] || mood.settings;

    for (const light of roomLights) {
      await this.setLight(light.id, {
        on: true,
        ...roomSettings
      });
    }

    return { success: true, mood, room };
  }

  // ============================================
  // CIRCADIAN RHYTHM
  // ============================================

  async loadSchedules() {
    // Morning wake-up (gradual)
    this.schedules.set('morning_wakeup', {
      id: 'morning_wakeup',
      name: 'Morgonväckning',
      time: '06:30',
      days: [1, 2, 3, 4, 5], // Weekdays
      enabled: true,
      action: 'circadian',
      duration: 30 // 30 minutes gradual
    });

    // Work hours
    this.schedules.set('work_hours', {
      id: 'work_hours',
      name: 'Arbetstid',
      time: '09:00',
      days: [1, 2, 3, 4, 5],
      enabled: true,
      action: 'mood',
      mood: 'focused'
    });

    // Evening transition
    this.schedules.set('evening', {
      id: 'evening',
      name: 'Kvällsljus',
      time: '18:00',
      days: [1, 2, 3, 4, 5, 6, 0],
      enabled: true,
      action: 'mood',
      mood: 'evening'
    });

    // Night mode
    this.schedules.set('night_mode', {
      id: 'night_mode',
      name: 'Nattläge',
      time: '22:00',
      days: [1, 2, 3, 4, 5, 6, 0],
      enabled: true,
      action: 'mood',
      mood: 'sleep'
    });
  }

  startAutomation() {
    // Update circadian rhythm every 30 minutes
    this._intervals.push(setInterval(() => {
      if (this.circadianMode) {
        this.updateCircadianLighting();
      }
    }, 30 * 60 * 1000));

    // Check schedules every minute
    this._intervals.push(setInterval(() => {
      this.checkSchedules();
    }, 60 * 1000));

    // Initial update
    if (this.circadianMode) {
      this.updateCircadianLighting();
    }
  }

  async updateCircadianLighting() {
    const hour = new Date().getHours();
    const minute = new Date().getMinutes();

    // Calculate color temperature based on time of day
    let colorTemp, brightness;

    if (hour >= 6 && hour < 9) {
      // Morning: gradually increase from warm to cool
      const progress = ((hour - 6) * 60 + minute) / 180; // 0-1 over 3 hours
      colorTemp = 2500 + progress * 2500; // 2500K -> 5000K
      brightness = 40 + progress * 40; // 40% -> 80%
    } else if (hour >= 9 && hour < 17) {
      // Day: cool, bright
      colorTemp = 5000;
      brightness = 80;
    } else if (hour >= 17 && hour < 20) {
      // Evening: gradually decrease from cool to warm
      const progress = ((hour - 17) * 60 + minute) / 180;
      colorTemp = 5000 - progress * 2000; // 5000K -> 3000K
      brightness = 80 - progress * 30; // 80% -> 50%
    } else if (hour >= 20 && hour < 22) {
      // Late evening: warm, dim
      colorTemp = 2700;
      brightness = 40;
    } else {
      // Night: very warm, very dim
      colorTemp = 2200;
      brightness = 10;
    }

    // Apply to all lights that are currently on
    for (const [lightId, light] of this.lights) {
      if (light.state.on && light.capabilities.includes('color_temp')) {
        await this.setLight(lightId, {
          colorTemp,
          brightness
        });
      }
    }
  }

  async checkSchedules() {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const currentDay = now.getDay();

    for (const [_scheduleId, schedule] of this.schedules) {
      if (!schedule.enabled) continue;
      if (!schedule.days.includes(currentDay)) continue;
      if (schedule.time !== currentTime) continue;

      // Execute schedule action
      switch (schedule.action) {
        case 'mood':
          await this.setMood(schedule.mood);
          break;
        case 'scene':
          await this.activateScene(schedule.scene);
          break;
        case 'circadian':
          await this.updateCircadianLighting();
          break;
      }
    }
  }

  // ============================================
  // MUSIC SYNC (Optional)
  // ============================================

  async syncWithMusic(musicData) {
    // musicData: { tempo, energy, valence }
    
    const { tempo, energy, valence } = musicData;

    let moodId;
    
    // Map music characteristics to mood
    if (energy > 0.7 && valence > 0.6) {
      moodId = 'party'; // High energy, positive
    } else if (energy > 0.5 && valence > 0.5) {
      moodId = 'energized'; // Moderate energy, positive
    } else if (energy < 0.4 && valence > 0.5) {
      moodId = 'relaxed'; // Low energy, positive
    } else if (valence < 0.4) {
      moodId = 'movie'; // Darker mood
    } else {
      moodId = 'neutral';
    }

    await this.setMood(moodId);

    // Optional: pulse lights to beat
    if (tempo > 0) {
      this.startMusicPulse(tempo);
    }
  }

  startMusicPulse(bpm) {
    const intervalMs = (60 / bpm) * 1000;

    if (this.musicPulseInterval) {
      clearInterval(this.musicPulseInterval);
    }

    this.musicPulseInterval = setInterval(() => {
      // Subtle brightness pulse
      for (const [lightId, light] of this.lights) {
        if (light.state.on && light.capabilities.includes('dim')) {
          const currentBrightness = light.state.brightness;
          const pulse = currentBrightness * 0.1; // 10% pulse
          
          this.setLight(lightId, {
            brightness: currentBrightness + pulse
          });

          this._timeouts.push(setTimeout(() => {
            this.setLight(lightId, {
              brightness: currentBrightness
            });
          }, intervalMs / 2));
        }
      }
    }, intervalMs);
  }

  stopMusicSync() {
    if (this.musicPulseInterval) {
      clearInterval(this.musicPulseInterval);
      this.musicPulseInterval = null;
    }
  }

  // ============================================
  // ANALYTICS & REPORTING
  // ============================================

  getCurrentStatus() {
    const lights = Array.from(this.lights.values());
    
    return {
      lightsOn: lights.filter(l => l.state.on).length,
      lightsOff: lights.filter(l => !l.state.on).length,
      currentMood: this.currentMood,
      circadianMode: this.circadianMode,
      averageBrightness: Math.round(
        lights.filter(l => l.state.on)
          .reduce((sum, l) => sum + l.state.brightness, 0) / 
        lights.filter(l => l.state.on).length || 0
      )
    };
  }

  getAllLights() {
    return Array.from(this.lights.values()).map(l => ({
      id: l.id,
      name: l.name,
      room: l.room,
      on: l.state.on,
      brightness: l.state.brightness,
      colorTemp: l.state.colorTemp
    }));
  }

  getRoomLights(room) {
    return Array.from(this.lights.values())
      .filter(l => l.room === room)
      .map(l => ({
        id: l.id,
        name: l.name,
        on: l.state.on,
        brightness: l.state.brightness
      }));
  }

  getAllMoods() {
    return Array.from(this.moods.values()).map(m => ({
      id: m.id,
      name: m.name,
      description: m.description,
      color: m.color
    }));
  }

  getAllScenes() {
    return Array.from(this.scenes.values()).map(s => ({
      id: s.id,
      name: s.name,
      mood: s.mood,
      useCount: s.useCount,
      lastUsed: s.lastUsed
    }));
  }

  getCircadianSettings() {
    const hour = new Date().getHours();
    
    return {
      enabled: this.circadianMode,
      currentPhase: this.getCircadianPhase(hour),
      recommendedColorTemp: this.getRecommendedColorTemp(hour),
      recommendedBrightness: this.getRecommendedBrightness(hour)
    };
  }

  getCircadianPhase(hour) {
    if (hour >= 6 && hour < 9) return 'morning';
    if (hour >= 9 && hour < 17) return 'day';
    if (hour >= 17 && hour < 20) return 'evening';
    if (hour >= 20 && hour < 22) return 'late_evening';
    return 'night';
  }

  getRecommendedColorTemp(hour) {
    if (hour >= 6 && hour < 9) return 3500;
    if (hour >= 9 && hour < 17) return 5000;
    if (hour >= 17 && hour < 20) return 3500;
    if (hour >= 20 && hour < 22) return 2700;
    return 2200;
  }

  getRecommendedBrightness(hour) {
    if (hour >= 6 && hour < 9) return 60;
    if (hour >= 9 && hour < 17) return 80;
    if (hour >= 17 && hour < 20) return 65;
    if (hour >= 20 && hour < 22) return 40;
    return 10;
  }

  destroy() {
    if (this.musicPulseInterval) {
      clearInterval(this.musicPulseInterval);
      this.musicPulseInterval = null;
    }
    if (this._intervals) {
      this._intervals.forEach(id => clearInterval(id));
      this._intervals = [];
    }
    if (this._timeouts) {
      this._timeouts.forEach(id => clearTimeout(id));
      this._timeouts = [];
    }
  }
}

module.exports = MoodLightingSystem;
