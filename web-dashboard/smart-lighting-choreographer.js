'use strict';

/**
 * Smart Lighting Choreographer
 * Advanced lighting scenes and automation
 */
class SmartLightingChoreographer {
  constructor(app) {
    this.app = app;
    this.lights = new Map();
    this.lightingScenes = new Map();
    this.circadianSchedule = new Map();
    this.choreographies = new Map();
    this.musicSync = false;
  }

  async initialize() {
    await this.setupLights();
    await this.setupLightingScenes();
    await this.setupCircadianSchedule();
    await this.setupChoreographies();
    
    this.startMonitoring();
  }

  // ============================================
  // LIGHTS SETUP
  // ============================================

  async setupLights() {
    const lights = [
      // Living room
      { id: 'living_ceiling', name: 'Vardagsrum Tak', room: 'living_room', type: 'rgb', brightness: 100, color: { r: 255, g: 255, b: 255 }, temperature: 4000, on: false },
      { id: 'living_floor_1', name: 'Vardagsrum Golvlampa 1', room: 'living_room', type: 'rgb', brightness: 100, color: { r: 255, g: 255, b: 255 }, temperature: 3000, on: false },
      { id: 'living_floor_2', name: 'Vardagsrum Golvlampa 2', room: 'living_room', type: 'rgb', brightness: 100, color: { r: 255, g: 255, b: 255 }, temperature: 3000, on: false },
      { id: 'living_led_strip', name: 'Vardagsrum LED-list', room: 'living_room', type: 'rgb', brightness: 100, color: { r: 255, g: 0, b: 0 }, temperature: null, on: false },
      
      // Kitchen
      { id: 'kitchen_ceiling', name: 'Kök Tak', room: 'kitchen', type: 'white', brightness: 100, color: null, temperature: 4500, on: false },
      { id: 'kitchen_counter', name: 'Kök Bänkbelysning', room: 'kitchen', type: 'white', brightness: 100, color: null, temperature: 5000, on: false },
      
      // Bedrooms
      { id: 'master_ceiling', name: 'Sovrum Tak', room: 'master_bedroom', type: 'rgb', brightness: 100, color: { r: 255, g: 255, b: 255 }, temperature: 2700, on: false },
      { id: 'master_bedside_1', name: 'Sovrum Sänglampa 1', room: 'master_bedroom', type: 'rgb', brightness: 50, color: { r: 255, g: 200, b: 150 }, temperature: 2200, on: false },
      { id: 'master_bedside_2', name: 'Sovrum Sänglampa 2', room: 'master_bedroom', type: 'rgb', brightness: 50, color: { r: 255, g: 200, b: 150 }, temperature: 2200, on: false },
      
      { id: 'emma_ceiling', name: 'Emma Sovrum Tak', room: 'emma_bedroom', type: 'rgb', brightness: 100, color: { r: 255, g: 200, b: 255 }, temperature: 3500, on: false },
      { id: 'emma_nightlight', name: 'Emma Nattlampa', room: 'emma_bedroom', type: 'rgb', brightness: 10, color: { r: 255, g: 100, b: 200 }, temperature: 2000, on: false },
      
      { id: 'oscar_ceiling', name: 'Oscar Sovrum Tak', room: 'oscar_bedroom', type: 'rgb', brightness: 100, color: { r: 200, g: 220, b: 255 }, temperature: 3500, on: false },
      { id: 'oscar_nightlight', name: 'Oscar Nattlampa', room: 'oscar_bedroom', type: 'rgb', brightness: 10, color: { r: 100, g: 150, b: 255 }, temperature: 2000, on: false },
      
      // Bathroom
      { id: 'bathroom_ceiling', name: 'Badrum Tak', room: 'bathroom', type: 'white', brightness: 100, color: null, temperature: 5000, on: false },
      { id: 'bathroom_mirror', name: 'Badrum Spegel', room: 'bathroom', type: 'white', brightness: 100, color: null, temperature: 5500, on: false },
      
      // Office
      { id: 'office_ceiling', name: 'Kontor Tak', room: 'office', type: 'white', brightness: 100, color: null, temperature: 4500, on: false },
      { id: 'office_desk', name: 'Kontor Skrivbordslampa', room: 'office', type: 'rgb', brightness: 100, color: { r: 255, g: 255, b: 255 }, temperature: 5000, on: false },
      
      // Outdoor
      { id: 'outdoor_front', name: 'Utomhus Framsida', room: 'outdoor', type: 'white', brightness: 100, color: null, temperature: 4000, on: false },
      { id: 'outdoor_back', name: 'Utomhus Baksida', room: 'outdoor', type: 'white', brightness: 100, color: null, temperature: 4000, on: false }
    ];

    for (const light of lights) {
      this.lights.set(light.id, light);
    }
  }

  // ============================================
  // BASIC CONTROL
  // ============================================

  async turnOn(lightId, brightness = null) {
    const light = this.lights.get(lightId);
    
    if (!light) {
      return { success: false, error: 'Light not found' };
    }

    light.on = true;
    
    if (brightness !== null) {
      light.brightness = Math.min(Math.max(brightness, 0), 100);
    }

    console.log(`💡 ${light.name} ON (${light.brightness}%)`);

    return { success: true };
  }

  async turnOff(lightId) {
    const light = this.lights.get(lightId);
    
    if (!light) {
      return { success: false, error: 'Light not found' };
    }

    light.on = false;
    console.log(`💡 ${light.name} OFF`);

    return { success: true };
  }

  async setBrightness(lightId, brightness) {
    const light = this.lights.get(lightId);
    
    if (!light) {
      return { success: false, error: 'Light not found' };
    }

    light.brightness = Math.min(Math.max(brightness, 0), 100);
    
    if (light.brightness > 0 && !light.on) {
      light.on = true;
    }

    console.log(`💡 ${light.name} brightness: ${light.brightness}%`);

    return { success: true };
  }

  async setColor(lightId, r, g, b) {
    const light = this.lights.get(lightId);
    
    if (!light || light.type !== 'rgb') {
      return { success: false, error: 'Light not found or not RGB' };
    }

    light.color = { r, g, b };
    console.log(`🎨 ${light.name} color: RGB(${r}, ${g}, ${b})`);

    return { success: true };
  }

  async setTemperature(lightId, kelvin) {
    const light = this.lights.get(lightId);
    
    if (!light) {
      return { success: false, error: 'Light not found' };
    }

    light.temperature = Math.min(Math.max(kelvin, 2000), 6500);
    console.log(`🌡️ ${light.name} temperature: ${light.temperature}K`);

    return { success: true };
  }

  // ============================================
  // ROOM CONTROL
  // ============================================

  async controlRoom(room, action, value) {
    const roomLights = Array.from(this.lights.values()).filter(l => l.room === room);

    if (roomLights.length === 0) {
      return { success: false, error: 'No lights in room' };
    }

    console.log(`🏠 Controlling ${room}: ${action}`);

    for (const light of roomLights) {
      switch (action) {
        case 'on':
          await this.turnOn(light.id, value);
          break;
        case 'off':
          await this.turnOff(light.id);
          break;
        case 'brightness':
          await this.setBrightness(light.id, value);
          break;
      }
    }

    return { success: true, lights: roomLights.length };
  }

  // ============================================
  // LIGHTING SCENES
  // ============================================

  async setupLightingScenes() {
    const scenes = [
      {
        id: 'bright_work',
        name: 'Arbetsbelysning',
        description: 'Starkt vitt ljus för arbete',
        lights: [
          { id: 'living_ceiling', on: true, brightness: 100, temperature: 5000 },
          { id: 'kitchen_ceiling', on: true, brightness: 100, temperature: 5000 },
          { id: 'office_ceiling', on: true, brightness: 100, temperature: 5000 },
          { id: 'office_desk', on: true, brightness: 100, temperature: 5000 }
        ]
      },
      {
        id: 'cozy_evening',
        name: 'Mysig kväll',
        description: 'Varmt och dämpad belysning',
        lights: [
          { id: 'living_ceiling', on: false },
          { id: 'living_floor_1', on: true, brightness: 40, temperature: 2700 },
          { id: 'living_floor_2', on: true, brightness: 40, temperature: 2700 },
          { id: 'living_led_strip', on: true, brightness: 30, color: { r: 255, g: 100, b: 0 } }
        ]
      },
      {
        id: 'movie_time',
        name: 'Bioläge',
        description: 'Mörkt med accent-belysning',
        lights: [
          { id: 'living_ceiling', on: false },
          { id: 'living_floor_1', on: false },
          { id: 'living_floor_2', on: false },
          { id: 'living_led_strip', on: true, brightness: 10, color: { r: 0, g: 50, b: 150 } }
        ]
      },
      {
        id: 'party_mode',
        name: 'Festläge',
        description: 'Färgglad dynamisk belysning',
        lights: [
          { id: 'living_ceiling', on: true, brightness: 80, color: { r: 255, g: 0, b: 255 } },
          { id: 'living_floor_1', on: true, brightness: 70, color: { r: 0, g: 255, b: 255 } },
          { id: 'living_floor_2', on: true, brightness: 70, color: { r: 255, g: 255, b: 0 } },
          { id: 'living_led_strip', on: true, brightness: 100, color: { r: 255, g: 0, b: 0 } }
        ]
      },
      {
        id: 'bedtime',
        name: 'Läggdags',
        description: 'Mjukt ljus för sömn',
        lights: [
          { id: 'living_ceiling', on: false },
          { id: 'kitchen_ceiling', on: false },
          { id: 'master_ceiling', on: false },
          { id: 'master_bedside_1', on: true, brightness: 10, temperature: 2000 },
          { id: 'master_bedside_2', on: true, brightness: 10, temperature: 2000 },
          { id: 'emma_nightlight', on: true, brightness: 5, color: { r: 255, g: 100, b: 200 } },
          { id: 'oscar_nightlight', on: true, brightness: 5, color: { r: 100, g: 150, b: 255 } }
        ]
      },
      {
        id: 'morning_wakeup',
        name: 'Morgonväckning',
        description: 'Gradvis ökning av ljus',
        lights: [
          { id: 'master_ceiling', on: true, brightness: 50, temperature: 4000 },
          { id: 'kitchen_ceiling', on: true, brightness: 80, temperature: 5000 },
          { id: 'bathroom_ceiling', on: true, brightness: 100, temperature: 5500 }
        ]
      },
      {
        id: 'dinner_time',
        name: 'Middagstid',
        description: 'Behaglig matbelysning',
        lights: [
          { id: 'kitchen_ceiling', on: true, brightness: 70, temperature: 3500 },
          { id: 'living_ceiling', on: true, brightness: 60, temperature: 3200 },
          { id: 'living_floor_1', on: true, brightness: 40, temperature: 2700 }
        ]
      },
      {
        id: 'focus_mode',
        name: 'Fokusläge',
        description: 'Koncentrationsbelysning',
        lights: [
          { id: 'office_ceiling', on: true, brightness: 100, temperature: 5500 },
          { id: 'office_desk', on: true, brightness: 100, temperature: 6000 }
        ]
      }
    ];

    for (const scene of scenes) {
      this.lightingScenes.set(scene.id, scene);
    }
  }

  async activateScene(sceneId, transitionTime = 2000) {
    const scene = this.lightingScenes.get(sceneId);
    
    if (!scene) {
      return { success: false, error: 'Scene not found' };
    }

    console.log(`✨ Activating scene: ${scene.name}`);

    for (const lightConfig of scene.lights) {
      const light = this.lights.get(lightConfig.id);
      
      if (!light) continue;

      light.on = lightConfig.on;
      
      if (lightConfig.brightness !== undefined) {
        light.brightness = lightConfig.brightness;
      }
      
      if (lightConfig.color && light.type === 'rgb') {
        light.color = lightConfig.color;
      }
      
      if (lightConfig.temperature !== undefined) {
        light.temperature = lightConfig.temperature;
      }

      console.log(`  ${light.name}: ${light.on ? 'ON' : 'OFF'} ${light.on ? light.brightness + '%' : ''}`);
    }

    return { success: true, lights: scene.lights.length };
  }

  // ============================================
  // CIRCADIAN LIGHTING
  // ============================================

  async setupCircadianSchedule() {
    const schedule = [
      { hour: 6, temperature: 3000, brightness: 30, description: 'Mjuk morgon' },
      { hour: 7, temperature: 3500, brightness: 50, description: 'Vaknar' },
      { hour: 8, temperature: 4000, brightness: 70, description: 'Morgonaktivitet' },
      { hour: 9, temperature: 4500, brightness: 85, description: 'Dagsljus början' },
      { hour: 12, temperature: 5500, brightness: 100, description: 'Mitt på dagen' },
      { hour: 15, temperature: 5000, brightness: 90, description: 'Eftermiddag' },
      { hour: 18, temperature: 4000, brightness: 70, description: 'Kväll närmar sig' },
      { hour: 20, temperature: 3000, brightness: 50, description: 'Kväll' },
      { hour: 21, temperature: 2700, brightness: 30, description: 'Sen kväll' },
      { hour: 22, temperature: 2200, brightness: 15, description: 'Förberedelse för sömn' },
      { hour: 23, temperature: 2000, brightness: 10, description: 'Natt' }
    ];

    for (const entry of schedule) {
      this.circadianSchedule.set(entry.hour, entry);
    }
  }

  getCircadianSettings(time = Date.now()) {
    const hour = new Date(time).getHours();
    
    // Find closest scheduled hour
    let closest = null;
    let minDiff = 24;

    for (const [scheduleHour, settings] of this.circadianSchedule) {
      const diff = Math.abs(hour - scheduleHour);
      if (diff < minDiff) {
        minDiff = diff;
        closest = settings;
      }
    }

    return closest;
  }

  async applyCircadianLighting(rooms = null) {
    const settings = this.getCircadianSettings();
    
    if (!settings) {
      return { success: false, error: 'No circadian settings' };
    }

    console.log(`🌅 Applying circadian lighting: ${settings.description}`);

    const lightsToAdjust = rooms 
      ? Array.from(this.lights.values()).filter(l => rooms.includes(l.room))
      : Array.from(this.lights.values());

    for (const light of lightsToAdjust) {
      if (light.on && light.type !== 'rgb') {
        await this.setTemperature(light.id, settings.temperature);
        await this.setBrightness(light.id, settings.brightness);
      }
    }

    return { success: true, lights: lightsToAdjust.length };
  }

  // ============================================
  // CHOREOGRAPHIES
  // ============================================

  async setupChoreographies() {
    const choreographies = [
      {
        id: 'sunrise_simulation',
        name: 'Soluppgångssimulering',
        duration: 900000,  // 15 minutes
        steps: [
          { time: 0, brightness: 0, temperature: 2000, color: { r: 255, g: 50, b: 0 } },
          { time: 300000, brightness: 20, temperature: 2500, color: { r: 255, g: 100, b: 50 } },
          { time: 600000, brightness: 50, temperature: 3500, color: { r: 255, g: 200, b: 150 } },
          { time: 900000, brightness: 100, temperature: 5000, color: { r: 255, g: 255, b: 255 } }
        ]
      },
      {
        id: 'sunset_simulation',
        name: 'Solnedgångssimulering',
        duration: 600000,  // 10 minutes
        steps: [
          { time: 0, brightness: 100, temperature: 4000, color: { r: 255, g: 255, b: 255 } },
          { time: 300000, brightness: 50, temperature: 2700, color: { r: 255, g: 150, b: 100 } },
          { time: 600000, brightness: 10, temperature: 2000, color: { r: 255, g: 50, b: 0 } }
        ]
      },
      {
        id: 'color_wave',
        name: 'Färgvåg',
        duration: 120000,  // 2 minutes
        steps: [
          { time: 0, color: { r: 255, g: 0, b: 0 } },
          { time: 20000, color: { r: 255, g: 255, b: 0 } },
          { time: 40000, color: { r: 0, g: 255, b: 0 } },
          { time: 60000, color: { r: 0, g: 255, b: 255 } },
          { time: 80000, color: { r: 0, g: 0, b: 255 } },
          { time: 100000, color: { r: 255, g: 0, b: 255 } },
          { time: 120000, color: { r: 255, g: 0, b: 0 } }
        ]
      }
    ];

    for (const choreo of choreographies) {
      this.choreographies.set(choreo.id, choreo);
    }
  }

  async playChoreography(choreographyId, lightIds) {
    const choreography = this.choreographies.get(choreographyId);
    
    if (!choreography) {
      return { success: false, error: 'Choreography not found' };
    }

    console.log(`🎭 Playing choreography: ${choreography.name} (${choreography.duration / 1000}s)`);

    // In a real implementation, this would use timers to execute each step
    // For now, we'll just apply the final step
    const finalStep = choreography.steps[choreography.steps.length - 1];

    for (const lightId of lightIds) {
      if (finalStep.brightness !== undefined) {
        await this.setBrightness(lightId, finalStep.brightness);
      }
      if (finalStep.temperature !== undefined) {
        await this.setTemperature(lightId, finalStep.temperature);
      }
      if (finalStep.color !== undefined) {
        await this.setColor(lightId, finalStep.color.r, finalStep.color.g, finalStep.color.b);
      }
    }

    return { success: true };
  }

  // ============================================
  // MUSIC SYNC
  // ============================================

  async enableMusicSync(enabled) {
    this.musicSync = enabled;
    console.log(`🎵 Music sync: ${enabled ? 'ENABLED' : 'DISABLED'}`);
    return { success: true };
  }

  async syncToMusic(beat, intensity) {
    if (!this.musicSync) return;

    const rgbLights = Array.from(this.lights.values())
      .filter(l => l.type === 'rgb' && l.on);

    for (const light of rgbLights) {
      // Adjust brightness based on beat intensity
      const brightness = Math.min(intensity * 100, light.brightness + 20);
      await this.setBrightness(light.id, brightness);

      // Cycle through colors based on beat
      if (beat % 4 === 0) {
        await this.setColor(light.id, 255, 0, 0);
      } else if (beat % 4 === 1) {
        await this.setColor(light.id, 0, 255, 0);
      } else if (beat % 4 === 2) {
        await this.setColor(light.id, 0, 0, 255);
      } else {
        await this.setColor(light.id, 255, 0, 255);
      }
    }
  }

  // ============================================
  // MONITORING
  // ============================================

  startMonitoring() {
    // Apply circadian lighting every hour
    setInterval(() => {
      const activeRooms = Array.from(this.lights.values())
        .filter(l => l.on)
        .map(l => l.room);

      if (activeRooms.length > 0) {
        this.applyCircadianLighting([...new Set(activeRooms)]);
      }
    }, 60 * 60 * 1000);

    console.log('💡 Lighting Choreographer active');
  }

  // ============================================
  // REPORTING
  // ============================================

  getLightingOverview() {
    const onLights = Array.from(this.lights.values()).filter(l => l.on).length;

    return {
      totalLights: this.lights.size,
      onLights,
      scenes: this.lightingScenes.size,
      choreographies: this.choreographies.size,
      musicSync: this.musicSync ? 'Enabled' : 'Disabled'
    };
  }

  getLightsByRoom() {
    const rooms = {};

    for (const light of this.lights.values()) {
      if (!rooms[light.room]) {
        rooms[light.room] = [];
      }

      rooms[light.room].push({
        name: light.name,
        status: light.on ? `ON (${light.brightness}%)` : 'OFF',
        type: light.type
      });
    }

    return rooms;
  }

  getScenesList() {
    return Array.from(this.lightingScenes.values()).map(s => ({
      name: s.name,
      description: s.description,
      lights: s.lights.length + ' lights'
    }));
  }

  getCircadianStatus() {
    const current = this.getCircadianSettings();
    return current ? {
      time: new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
      temperature: current.temperature + 'K',
      brightness: current.brightness + '%',
      phase: current.description
    } : null;
  }
}

module.exports = SmartLightingChoreographer;
