'use strict';

/**
 * Indoor Lighting Scene Engine
 * 
 * Comprehensive indoor lighting management with circadian rhythms,
 * activity-based scenes, zone grouping, party mode, focus mode,
 * energy tracking, and 20+ pre-built scene presets.
 */
class IndoorLightingSceneEngine {
  constructor(homey) {
    this.homey = homey;

    // Core state
    this.lights = new Map();
    this.zones = new Map();
    this.scenes = new Map();
    this.activeScenes = new Map();
    this.lightGroups = new Map();
    this.sceneHistory = [];
    this.schedules = [];

    // Circadian state
    this.circadianEnabled = true;
    this.circadianProfile = {
      '06:00': { colorTemp: 2700, brightness: 30 },
      '08:00': { colorTemp: 4000, brightness: 70 },
      '10:00': { colorTemp: 5500, brightness: 90 },
      '12:00': { colorTemp: 6500, brightness: 100 },
      '14:00': { colorTemp: 6000, brightness: 95 },
      '16:00': { colorTemp: 5000, brightness: 85 },
      '18:00': { colorTemp: 3500, brightness: 70 },
      '20:00': { colorTemp: 2700, brightness: 50 },
      '22:00': { colorTemp: 2200, brightness: 30 },
      '00:00': { colorTemp: 2000, brightness: 10 }
    };

    // Transition settings
    this.defaultTransitionDuration = 2; // seconds
    this.activeTransitions = new Map();

    // Energy tracking
    this.energyTracking = {
      perZone: new Map(),
      perScene: new Map(),
      dailyTotal: 0,
      weeklyTotal: 0,
      monthlyTotal: 0,
      lastReset: Date.now()
    };

    // Motion scene mapping
    this.motionSceneMap = new Map();

    // Mode flags
    this.partyModeActive = false;
    this.focusModeActive = false;
    this.guestModeActive = false;
    this.partyInterval = null;

    // Monitoring
    this.monitoringInterval = null;
    this.circadianInterval = null;
    this.scheduleInterval = null;
  }

  // ─── Initialization ────────────────────────────────────────────────

  async initialize() {
    try {
      this.log('Initierar Indoor Lighting Scene Engine...');

      try {
        await this.discoverIndoorLights();
        await this.setupZones();
        await this.loadPresetLibrary();
        await this.setupActivityScenes();
        await this.setupColorThemes();
        await this.startCircadianCycle();
        await this.startScheduleMonitor();
        await this.startEnergyTracking();

        this.log(`Initiering klar — ${this.lights.size} lampor, ${this.zones.size} zoner, ${this.scenes.size} scener`);
        this._notify('💡 Inomhusbelysning redo', `${this.lights.size} lampor och ${this.scenes.size} scener tillgängliga`);
      } catch (err) {
        this.error('Initiering misslyckades:', err.message);
      }
    } catch (error) {
      console.error(`[IndoorLightingSceneEngine] Failed to initialize:`, error.message);
    }
  }

  // ─── Device Discovery ──────────────────────────────────────────────

  async discoverIndoorLights() {
    try {
      const devices = this.homey.drivers?.getDevices?.() || [];

      for (const device of devices) {
        const name = (device.name || '').toLowerCase();
        const zone = (device.zone?.name || '').toLowerCase();

        const isOutdoor = zone.includes('outdoor') || zone.includes('utomhus') ||
                          zone.includes('trädgård') || zone.includes('garden');

        if (isOutdoor || !device.hasCapability('onoff')) continue;

        const isLight = device.hasCapability('dim') ||
                        device.hasCapability('light_temperature') ||
                        device.hasCapability('light_hue') ||
                        name.includes('lamp') || name.includes('ljus') ||
                        name.includes('light') || name.includes('bulb');

        if (!isLight) continue;

        this.lights.set(device.id, {
          id: device.id,
          name: device.name,
          device,
          zone: device.zone?.name || 'Okänd',
          capabilities: {
            dim: device.hasCapability('dim'),
            colorTemp: device.hasCapability('light_temperature'),
            color: device.hasCapability('light_hue'),
            onoff: true
          },
          state: { on: false, brightness: 100, colorTemp: 4000, hue: 0, saturation: 1 }
        });
      }

      this.log(`Hittade ${this.lights.size} inomhuslampor`);
    } catch (err) {
      this.error('Lampupptäckning misslyckades:', err.message);
    }
  }

  // ─── Zone Setup ────────────────────────────────────────────────────

  async setupZones() {
    const defaultZones = [
      { id: 'living_room', name: 'Vardagsrum', keywords: ['vardagsrum', 'living', 'lounge', 'stue'] },
      { id: 'kitchen', name: 'Kök', keywords: ['kök', 'kitchen', 'køkken'] },
      { id: 'bedroom', name: 'Sovrum', keywords: ['sovrum', 'bedroom', 'soveværelse'] },
      { id: 'bathroom', name: 'Badrum', keywords: ['badrum', 'bathroom', 'bad'] },
      { id: 'hallway', name: 'Hall', keywords: ['hall', 'hallway', 'entré', 'korridor'] },
      { id: 'office', name: 'Kontor', keywords: ['kontor', 'office', 'arbetsrum', 'studie'] }
    ];

    for (const z of defaultZones) {
      this.zones.set(z.id, {
        id: z.id,
        name: z.name,
        keywords: z.keywords,
        lights: [],
        activeScene: null,
        energyUsage: 0,
        motionScene: null
      });
    }

    // Assign lights to zones
    for (const [id, light] of this.lights) {
      const zoneLower = light.zone.toLowerCase();
      let assigned = false;

      for (const [_zoneId, zone] of this.zones) {
        if (zone.keywords.some(kw => zoneLower.includes(kw))) {
          zone.lights.push(id);
          assigned = true;
          break;
        }
      }

      if (!assigned) {
        if (!this.zones.has('other')) {
          this.zones.set('other', { id: 'other', name: 'Övriga', keywords: [], lights: [], activeScene: null, energyUsage: 0, motionScene: null });
        }
        this.zones.get('other').lights.push(id);
      }
    }

    this.log(`Konfigurerade ${this.zones.size} zoner`);
  }

  // ─── Preset Library (20+ presets) ──────────────────────────────────

  async loadPresetLibrary() {
    const presets = [
      { id: 'bright_daylight', name: 'Dagsljus', brightness: 100, colorTemp: 6500, description: 'Fullt dagsljus' },
      { id: 'warm_white', name: 'Varmvit', brightness: 80, colorTemp: 3000, description: 'Behagligt varmvitt' },
      { id: 'cool_office', name: 'Kontorsbelysning', brightness: 90, colorTemp: 5000, description: 'Produktiv kontorsbelysning' },
      { id: 'cozy_evening', name: 'Mysig kväll', brightness: 40, colorTemp: 2700, description: 'Lugn kvällsbelysning' },
      { id: 'romantic', name: 'Romantisk', brightness: 20, colorTemp: 2200, description: 'Dämpad romantisk stämning' },
      { id: 'movie_night', name: 'Filmkväll', brightness: 10, colorTemp: 2500, description: 'Minimal belysning för film' },
      { id: 'reading_nook', name: 'Läshörna', brightness: 75, colorTemp: 3500, description: 'Fokuserat läsljus' },
      { id: 'cooking_prep', name: 'Matlagning', brightness: 100, colorTemp: 4500, description: 'Ljust och neutralt för matlagning' },
      { id: 'dining', name: 'Middag', brightness: 50, colorTemp: 2800, description: 'Trevlig middagsbelysning' },
      { id: 'morning_wake', name: 'Morgonväckning', brightness: 60, colorTemp: 3500, description: 'Mjuk morgonstart' },
      { id: 'night_light', name: 'Nattljus', brightness: 5, colorTemp: 2000, description: 'Minimalt nattljus' },
      { id: 'energize', name: 'Energi', brightness: 100, colorTemp: 6000, description: 'Energigivande ljus' },
      { id: 'sunset_glow', name: 'Solnedgång', brightness: 45, colorTemp: 2400, description: 'Varmt solnedgångsljus' },
      { id: 'nordic_winter', name: 'Nordisk vinter', brightness: 70, colorTemp: 3200, description: 'Skandinaviskt vinterljus' },
      { id: 'meditation', name: 'Meditation', brightness: 15, colorTemp: 2300, description: 'Lugnt meditationsljus' },
      { id: 'bathroom_bright', name: 'Badrum ljust', brightness: 100, colorTemp: 5500, description: 'Klart badrumsljus' },
      { id: 'bathroom_relax', name: 'Badrum avslappning', brightness: 30, colorTemp: 2500, description: 'Avslappnande badrumsljus' },
      { id: 'hallway_welcome', name: 'Välkommen hem', brightness: 60, colorTemp: 3000, description: 'Välkomnande hallbelysning' },
      { id: 'study_focus', name: 'Studiefokus', brightness: 85, colorTemp: 5000, description: 'Fokuserat studiearbete' },
      { id: 'gaming', name: 'Gaming', brightness: 30, colorTemp: 4000, description: 'Dämpad spelbelysning' },
      { id: 'cleanup', name: 'Städning', brightness: 100, colorTemp: 6500, description: 'Max ljus för städning' },
      { id: 'lullaby', name: 'Vaggvisa', brightness: 8, colorTemp: 2000, description: 'Sömnfrämjande minimalt ljus' }
    ];

    for (const preset of presets) {
      this.scenes.set(preset.id, {
        ...preset,
        type: 'preset',
        zones: [],
        hue: null,
        saturation: null,
        transitionDuration: this.defaultTransitionDuration,
        createdAt: Date.now()
      });
    }

    this.log(`Laddade ${presets.length} förinställda scener`);
  }

  // ─── Activity-Based Scenes ─────────────────────────────────────────

  async setupActivityScenes() {
    const activityScenes = [
      { id: 'activity_work', name: 'Arbetsläge', brightness: 90, colorTemp: 5000, zones: ['office', 'living_room'], description: 'Ljust och svalt för produktivitet' },
      { id: 'activity_relax', name: 'Avslappning', brightness: 40, colorTemp: 2700, zones: ['living_room', 'bedroom'], description: 'Dämpat och varmt för vila' },
      { id: 'activity_movie', name: 'Filmläge', brightness: 8, colorTemp: 2500, zones: ['living_room'], description: 'Mycket dämpat, omgivande ljus' },
      { id: 'activity_cooking', name: 'Matlagning', brightness: 100, colorTemp: 4500, zones: ['kitchen'], description: 'Ljust och neutralt' },
      { id: 'activity_reading', name: 'Läsning', brightness: 70, colorTemp: 3500, zones: ['living_room', 'bedroom', 'office'], description: 'Fokuserat och varmt ljus' }
    ];

    for (const scene of activityScenes) {
      this.scenes.set(scene.id, {
        ...scene,
        type: 'activity',
        hue: null,
        saturation: null,
        transitionDuration: 3,
        createdAt: Date.now()
      });
    }
  }

  // ─── Color Themes (Seasonal + Holiday) ─────────────────────────────

  async setupColorThemes() {
    const colorThemes = [
      { id: 'theme_spring', name: 'Vår – Pastell', hue: 100, saturation: 0.4, brightness: 70, colorTemp: 4500, description: 'Lätta pastellfärger' },
      { id: 'theme_summer', name: 'Sommar – Sol', hue: 45, saturation: 0.7, brightness: 85, colorTemp: 5500, description: 'Varma solljustoner' },
      { id: 'theme_autumn', name: 'Höst – Värme', hue: 25, saturation: 0.6, brightness: 60, colorTemp: 2800, description: 'Varma hösttoner' },
      { id: 'theme_winter', name: 'Vinter – Kyla', hue: 210, saturation: 0.3, brightness: 65, colorTemp: 5500, description: 'Svala vintertoner' },
      { id: 'theme_christmas', name: 'Jul', hue: 0, saturation: 0.8, brightness: 60, colorTemp: 3000, description: 'Rött och grönt jultema' },
      { id: 'theme_midsummer', name: 'Midsommar', hue: 55, saturation: 0.5, brightness: 80, colorTemp: 4500, description: 'Ljust midsommartema' },
      { id: 'theme_lucia', name: 'Lucia', hue: 35, saturation: 0.4, brightness: 45, colorTemp: 2500, description: 'Varmt stearinljuslikt' },
      { id: 'theme_valentine', name: 'Alla hjärtans dag', hue: 340, saturation: 0.7, brightness: 35, colorTemp: 2500, description: 'Romantiskt rosa/rött' },
      { id: 'theme_halloween', name: 'Halloween', hue: 30, saturation: 0.9, brightness: 50, colorTemp: 2700, description: 'Orange Halloween-ljus' }
    ];

    for (const theme of colorThemes) {
      this.scenes.set(theme.id, {
        ...theme,
        type: 'theme',
        zones: [],
        transitionDuration: 5,
        createdAt: Date.now()
      });
    }
  }

  // ─── Dynamic Scene Creation ────────────────────────────────────────

  async createScene(config) {
    try {
      const id = config.id || `scene_${Date.now()}`;
      if (this.scenes.has(id) && !config.overwrite) {
        this.log(`Scen '${id}' finns redan – hoppar över`);
        return { success: false, reason: 'exists' };
      }

      const scene = {
        id,
        name: config.name || 'Namnlös scen',
        brightness: Math.max(0, Math.min(100, config.brightness ?? 80)),
        colorTemp: Math.max(2000, Math.min(6500, config.colorTemp ?? 4000)),
        hue: config.hue ?? null,
        saturation: config.saturation ?? null,
        zones: Array.isArray(config.zones) ? config.zones : [],
        type: config.type || 'custom',
        description: config.description || '',
        transitionDuration: Math.max(0, Math.min(60, config.transitionDuration ?? this.defaultTransitionDuration)),
        createdAt: Date.now()
      };

      this.scenes.set(id, scene);
      this.log(`Skapade scen: ${scene.name}`);
      return { success: true, scene };
    } catch (err) {
      this.error('Kunde inte skapa scen:', err.message);
      return { success: false, reason: err.message };
    }
  }

  // ─── Scene Activation & Conflict Resolution ───────────────────────

  async activateScene(sceneId, targetZones = null) {
    try {
      const scene = this.scenes.get(sceneId);
      if (!scene) {
        this.log(`Scen '${sceneId}' hittades inte`);
        return { success: false, reason: 'not_found' };
      }

      if (this.guestModeActive && scene.type !== 'preset') {
        this.log('Gästläge aktivt – enbart förinställda scener tillåtna');
        return { success: false, reason: 'guest_mode_restricted' };
      }

      const zones = targetZones || scene.zones;
      const resolvedZones = zones.length > 0 ? zones : [...this.zones.keys()];

      // Conflict resolution: deactivate overlapping scenes
      for (const zoneId of resolvedZones) {
        await this._resolveConflict(zoneId, sceneId);
      }

      const applied = [];
      for (const zoneId of resolvedZones) {
        const zone = this.zones.get(zoneId);
        if (!zone) continue;

        for (const lightId of zone.lights) {
          await this._applySceneToLight(lightId, scene);
        }
        zone.activeScene = sceneId;
        applied.push(zoneId);
      }

      this.activeScenes.set(sceneId, { sceneId, zones: applied, activatedAt: Date.now() });
      this._recordHistory(sceneId, applied, 'activate');
      this._trackEnergy(sceneId, applied, scene.brightness);

      this.log(`Aktiverade scen '${scene.name}' i ${applied.length} zon(er)`);
      return { success: true, applied };
    } catch (err) {
      this.error('Scenaktivering misslyckades:', err.message);
      return { success: false, reason: err.message };
    }
  }

  async deactivateScene(sceneId) {
    try {
      const active = this.activeScenes.get(sceneId);
      if (!active) return { success: false, reason: 'not_active' };

      for (const zoneId of active.zones) {
        const zone = this.zones.get(zoneId);
        if (!zone) continue;

        for (const lightId of zone.lights) {
          await this._setLight(lightId, { on: false });
        }
        zone.activeScene = null;
      }

      this.activeScenes.delete(sceneId);
      this._recordHistory(sceneId, active.zones, 'deactivate');
      this.log(`Avaktiverade scen '${sceneId}'`);
      return { success: true };
    } catch (err) {
      this.error('Scenavaktivering misslyckades:', err.message);
      return { success: false, reason: err.message };
    }
  }

  async _resolveConflict(zoneId, incomingSceneId) {
    const zone = this.zones.get(zoneId);
    if (!zone || !zone.activeScene || zone.activeScene === incomingSceneId) return;

    this.log(`Konflikt i zon '${zone.name}': byter från '${zone.activeScene}' till '${incomingSceneId}'`);
    const current = this.activeScenes.get(zone.activeScene);
    if (current) {
      current.zones = current.zones.filter(z => z !== zoneId);
      if (current.zones.length === 0) {
        this.activeScenes.delete(zone.activeScene);
      }
    }
    zone.activeScene = null;
  }

  // ─── Scene Transitions ─────────────────────────────────────────────

  async _applySceneToLight(lightId, scene) {
    const light = this.lights.get(lightId);
    if (!light) return;

    const duration = scene.transitionDuration || this.defaultTransitionDuration;

    if (duration > 0 && light.capabilities.dim) {
      await this._transitionLight(lightId, scene, duration);
    } else {
      await this._setLight(lightId, {
        on: scene.brightness > 0,
        brightness: scene.brightness,
        colorTemp: scene.colorTemp,
        hue: scene.hue,
        saturation: scene.saturation
      });
    }
  }

  async _transitionLight(lightId, scene, durationSec) {
    const light = this.lights.get(lightId);
    if (!light) return;

    // Cancel any ongoing transition for this light
    if (this.activeTransitions.has(lightId)) {
      clearInterval(this.activeTransitions.get(lightId));
      this.activeTransitions.delete(lightId);
    }

    const steps = Math.max(1, Math.round(durationSec * 4)); // 4 steps per second
    const interval = (durationSec * 1000) / steps;

    const startBrightness = light.state.brightness || 0;
    const targetBrightness = scene.brightness;
    const brightnessStep = (targetBrightness - startBrightness) / steps;

    let currentStep = 0;

    try {
      await this._setLight(lightId, { on: true });
    } catch (err) {
      this.error(`Övergång start misslyckades för ${lightId}:`, err.message);
      return;
    }

    const handle = setInterval(async () => {
      currentStep++;
      const brightness = Math.round(startBrightness + brightnessStep * currentStep);

      try {
        await this._setLight(lightId, { brightness: Math.max(0, Math.min(100, brightness)) });
      } catch { /* continue transition */ }

      if (currentStep >= steps) {
        clearInterval(handle);
        this.activeTransitions.delete(lightId);
        await this._setLight(lightId, {
          brightness: targetBrightness,
          colorTemp: scene.colorTemp,
          hue: scene.hue,
          saturation: scene.saturation
        });
      }
    }, interval);

    this.activeTransitions.set(lightId, handle);
  }

  async _setLight(lightId, settings) {
    const light = this.lights.get(lightId);
    if (!light || !light.device) return;

    try {
      if (settings.on !== undefined && light.capabilities.onoff) {
        await light.device.setCapabilityValue('onoff', settings.on);
        light.state.on = settings.on;
      }
      if (settings.brightness !== undefined && light.capabilities.dim) {
        await light.device.setCapabilityValue('dim', settings.brightness / 100);
        light.state.brightness = settings.brightness;
      }
      if (settings.colorTemp !== undefined && light.capabilities.colorTemp) {
        const normalized = 1 - ((settings.colorTemp - 2000) / 4500);
        await light.device.setCapabilityValue('light_temperature', Math.max(0, Math.min(1, normalized)));
        light.state.colorTemp = settings.colorTemp;
      }
      if (settings.hue !== undefined && settings.hue !== null && light.capabilities.color) {
        await light.device.setCapabilityValue('light_hue', settings.hue / 360);
        light.state.hue = settings.hue;
      }
      if (settings.saturation !== undefined && settings.saturation !== null && light.capabilities.color) {
        await light.device.setCapabilityValue('light_saturation', settings.saturation);
        light.state.saturation = settings.saturation;
      }
    } catch (err) {
      this.error(`Kunde inte ställa in lampa ${light.name}:`, err.message);
    }
  }

  // ─── Circadian Lighting ────────────────────────────────────────────

  async startCircadianCycle() {
    if (this.circadianInterval) clearInterval(this.circadianInterval);

    this.circadianInterval = setInterval(async () => {
      if (!this.circadianEnabled || this.partyModeActive || this.focusModeActive) return;
      await this._applyCircadianSettings();
    }, 5 * 60 * 1000); // every 5 minutes

    await this._applyCircadianSettings();
    this.log('Circadisk belysningscykel startad');
  }

  async _applyCircadianSettings() {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const { colorTemp, brightness } = this._interpolateCircadian(currentMinutes);

    for (const [_zoneId, zone] of this.zones) {
      if (zone.activeScene && zone.activeScene !== 'circadian') continue;

      for (const lightId of zone.lights) {
        try {
          await this._setLight(lightId, { on: brightness > 2, brightness, colorTemp });
        } catch { /* skip */ }
      }
    }
  }

  _interpolateCircadian(currentMinutes) {
    const entries = Object.entries(this.circadianProfile)
      .map(([time, v]) => {
        const [h, m] = time.split(':').map(Number);
        return { minutes: h * 60 + m, ...v };
      })
      .sort((a, b) => a.minutes - b.minutes);

    let before = entries[entries.length - 1];
    let after = entries[0];

    for (let i = 0; i < entries.length; i++) {
      if (entries[i].minutes <= currentMinutes) before = entries[i];
      if (entries[i].minutes > currentMinutes) { after = entries[i]; break; }
    }

    if (before.minutes === after.minutes) return { colorTemp: before.colorTemp, brightness: before.brightness };

    let range = after.minutes - before.minutes;
    let elapsed = currentMinutes - before.minutes;
    if (range <= 0) { range += 1440; if (elapsed < 0) elapsed += 1440; }

    const ratio = elapsed / range;
    return {
      colorTemp: Math.round(before.colorTemp + (after.colorTemp - before.colorTemp) * ratio),
      brightness: Math.round(before.brightness + (after.brightness - before.brightness) * ratio)
    };
  }

  // ─── Adaptive Brightness (Natural Light Sensor) ────────────────────

  async adjustBrightnessFromSensor(sensorLux) {
    try {
      const maxLux = 1000;
      const reduction = Math.min(1, sensorLux / maxLux);
      const adaptedBrightness = Math.round(100 * (1 - reduction * 0.6));

      for (const [, zone] of this.zones) {
        for (const lightId of zone.lights) {
          const light = this.lights.get(lightId);
          if (light && light.state.on) {
            await this._setLight(lightId, { brightness: Math.max(5, adaptedBrightness) });
          }
        }
      }

      this.log(`Adaptiv ljusstyrka: ${adaptedBrightness}% (sensor: ${sensorLux} lux)`);
      return { brightness: adaptedBrightness, sensorLux };
    } catch (err) {
      this.error('Adaptiv ljusjustering misslyckades:', err.message);
      return null;
    }
  }

  // ─── Sunrise / Sunset Simulation ───────────────────────────────────

  async startSunriseSimulation(zoneId, durationMinutes = 30) {
    try {
      const zone = this.zones.get(zoneId);
      if (!zone) return { success: false, reason: 'zone_not_found' };

      const steps = durationMinutes * 2; // every 30 seconds
      const interval = 30000;
      let step = 0;

      this.log(`Soluppgångssimulering startar i ${zone.name} (${durationMinutes} min)`);

      const handle = setInterval(async () => {
        step++;
        const progress = step / steps;
        const brightness = Math.round(progress * 80);
        const colorTemp = Math.round(2200 + progress * 2300); // 2200K → 4500K

        for (const lightId of zone.lights) {
          try {
            await this._setLight(lightId, { on: true, brightness: Math.max(1, brightness), colorTemp });
          } catch { /* continue */ }
        }

        if (step >= steps) {
          clearInterval(handle);
          this.log(`Soluppgångssimulering klar i ${zone.name}`);
          this._notify('🌅 Soluppgång klar', `Simulerad soluppgång i ${zone.name} avslutad`);
        }
      }, interval);

      return { success: true, zone: zone.name, duration: durationMinutes };
    } catch (err) {
      this.error('Soluppgångssimulering misslyckades:', err.message);
      return { success: false, reason: err.message };
    }
  }

  async startSunsetSimulation(zoneId, durationMinutes = 30) {
    try {
      const zone = this.zones.get(zoneId);
      if (!zone) return { success: false, reason: 'zone_not_found' };

      const steps = durationMinutes * 2;
      const interval = 30000;
      let step = 0;

      this.log(`Solnedgångssimulering startar i ${zone.name} (${durationMinutes} min)`);

      const handle = setInterval(async () => {
        step++;
        const progress = step / steps;
        const brightness = Math.round(80 * (1 - progress));
        const colorTemp = Math.round(4500 - progress * 2300); // 4500K → 2200K

        for (const lightId of zone.lights) {
          try {
            await this._setLight(lightId, { on: brightness > 1, brightness: Math.max(1, brightness), colorTemp });
          } catch { /* continue */ }
        }

        if (step >= steps) {
          clearInterval(handle);
          this.log(`Solnedgångssimulering klar i ${zone.name}`);
        }
      }, interval);

      return { success: true, zone: zone.name, duration: durationMinutes };
    } catch (err) {
      this.error('Solnedgångssimulering misslyckades:', err.message);
      return { success: false, reason: err.message };
    }
  }

  // ─── Party Mode ────────────────────────────────────────────────────

  async enablePartyMode(options = {}) {
    try {
      this.partyModeActive = true;
      this.circadianEnabled = false;
      const speed = options.speed || 2000; // ms between changes
      const zones = options.zones || [...this.zones.keys()];

      this.log('🎉 Festläge aktiverat');
      this._notify('🎉 Festläge aktiverat', 'Dynamisk belysning med färgcykling pågår');

      if (this.partyInterval) clearInterval(this.partyInterval);

      this.partyInterval = setInterval(async () => {
        for (const zoneId of zones) {
          const zone = this.zones.get(zoneId);
          if (!zone) continue;

          const hue = Math.floor(Math.random() * 360);
          const brightness = 50 + Math.floor(Math.random() * 50);
          const saturation = 0.7 + Math.random() * 0.3;

          for (const lightId of zone.lights) {
            const light = this.lights.get(lightId);
            if (light?.capabilities.color) {
              try {
                await this._setLight(lightId, { on: true, brightness, hue, saturation });
              } catch { /* continue */ }
            }
          }
        }
      }, speed);

      return { success: true, mode: 'party', speed };
    } catch (err) {
      this.error('Festläge misslyckades:', err.message);
      return { success: false, reason: err.message };
    }
  }

  async disablePartyMode() {
    this.partyModeActive = false;
    this.circadianEnabled = true;
    if (this.partyInterval) {
      clearInterval(this.partyInterval);
      this.partyInterval = null;
    }
    this.log('Festläge avaktiverat');
    this._notify('💡 Festläge avslutat', 'Normal belysning återställd');
    return { success: true };
  }

  // ─── Focus Mode ────────────────────────────────────────────────────

  async enableFocusMode(primaryZone = 'office') {
    try {
      this.focusModeActive = true;
      this.circadianEnabled = false;

      // Boost primary zone with task lighting
      const primary = this.zones.get(primaryZone);
      if (primary) {
        for (const lightId of primary.lights) {
          await this._setLight(lightId, { on: true, brightness: 85, colorTemp: 4500 });
        }
      }

      // Dim all other zones (blue-light reduction)
      for (const [zoneId, zone] of this.zones) {
        if (zoneId === primaryZone) continue;
        for (const lightId of zone.lights) {
          await this._setLight(lightId, { on: true, brightness: 15, colorTemp: 2700 });
        }
      }

      this.log(`Fokusläge aktiverat – primär zon: ${primaryZone}`);
      this._notify('🎯 Fokusläge aktiverat', `Fokusbelysning i ${primary?.name || primaryZone}, perifera zoner dämpade`);
      return { success: true, primaryZone };
    } catch (err) {
      this.error('Fokusläge misslyckades:', err.message);
      return { success: false, reason: err.message };
    }
  }

  async disableFocusMode() {
    this.focusModeActive = false;
    this.circadianEnabled = true;
    this.log('Fokusläge avaktiverat');
    this._notify('💡 Fokusläge avslutat', 'Normal belysning återställd');
    return { success: true };
  }

  // ─── Guest Mode ────────────────────────────────────────────────────

  async enableGuestMode(allowedZones = ['living_room', 'hallway', 'bathroom']) {
    this.guestModeActive = true;
    this.log(`Gästläge aktiverat – tillåtna zoner: ${allowedZones.join(', ')}`);
    this._notify('👥 Gästläge aktiverat', `Förenklad scenväxling, begränsad zonåtkomst`);
    return { success: true, allowedZones };
  }

  async disableGuestMode() {
    this.guestModeActive = false;
    this.log('Gästläge avaktiverat');
    return { success: true };
  }

  getGuestScenes() {
    const guestSafe = ['warm_white', 'cozy_evening', 'bright_daylight', 'movie_night', 'hallway_welcome'];
    return guestSafe
      .map(id => this.scenes.get(id))
      .filter(Boolean)
      .map(s => ({ id: s.id, name: s.name, description: s.description }));
  }

  // ─── Motion-Activated Scenes ───────────────────────────────────────

  async setMotionScene(zoneId, sceneId) {
    if (!this.zones.has(zoneId)) return { success: false, reason: 'zone_not_found' };
    if (!this.scenes.has(sceneId)) return { success: false, reason: 'scene_not_found' };

    this.motionSceneMap.set(zoneId, sceneId);
    const zone = this.zones.get(zoneId);
    zone.motionScene = sceneId;
    this.log(`Rörelsescen: zon '${zone.name}' → scen '${sceneId}'`);
    return { success: true, zone: zoneId, scene: sceneId };
  }

  async handleMotionDetected(zoneId) {
    try {
      const sceneId = this.motionSceneMap.get(zoneId);
      if (!sceneId) return;

      this.log(`Rörelse detekterad i zon '${zoneId}' → aktiverar scen '${sceneId}'`);
      await this.activateScene(sceneId, [zoneId]);
    } catch (err) {
      this.error('Rörelsescen misslyckades:', err.message);
    }
  }

  // ─── Scene Scheduling ──────────────────────────────────────────────

  addSchedule(config) {
    const schedule = {
      id: config.id || `sched_${Date.now()}`,
      sceneId: config.sceneId,
      time: config.time,           // "HH:MM"
      days: config.days || [0, 1, 2, 3, 4, 5, 6], // 0=Sunday
      zones: config.zones || null,
      enabled: config.enabled !== false,
      createdAt: Date.now()
    };

    this.schedules.push(schedule);
    this.log(`Schema tillagt: scen '${schedule.sceneId}' kl ${schedule.time}`);
    return { success: true, schedule };
  }

  removeSchedule(scheduleId) {
    const idx = this.schedules.findIndex(s => s.id === scheduleId);
    if (idx === -1) return { success: false, reason: 'not_found' };
    this.schedules.splice(idx, 1);
    return { success: true };
  }

  async startScheduleMonitor() {
    if (this.scheduleInterval) clearInterval(this.scheduleInterval);

    this.scheduleInterval = setInterval(async () => {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const currentDay = now.getDay();

      for (const schedule of this.schedules) {
        if (!schedule.enabled) continue;
        if (schedule.time !== currentTime) continue;
        if (!schedule.days.includes(currentDay)) continue;

        this.log(`Schemalagd aktivering: scen '${schedule.sceneId}'`);
        await this.activateScene(schedule.sceneId, schedule.zones);
      }
    }, 60 * 1000); // check every minute
  }

  // ─── Light Group Management ────────────────────────────────────────

  createLightGroup(groupId, name, lightIds) {
    const valid = lightIds.filter(id => this.lights.has(id));
    if (valid.length === 0) return { success: false, reason: 'no_valid_lights' };

    this.lightGroups.set(groupId, {
      id: groupId,
      name,
      lights: valid,
      createdAt: Date.now()
    });

    this.log(`Lampgrupp skapad: '${name}' med ${valid.length} lampor`);
    return { success: true, group: groupId, lightCount: valid.length };
  }

  removeLightGroup(groupId) {
    if (!this.lightGroups.has(groupId)) return { success: false, reason: 'not_found' };
    this.lightGroups.delete(groupId);
    return { success: true };
  }

  async applySceneToGroup(groupId, sceneId) {
    const group = this.lightGroups.get(groupId);
    const scene = this.scenes.get(sceneId);
    if (!group) return { success: false, reason: 'group_not_found' };
    if (!scene) return { success: false, reason: 'scene_not_found' };

    for (const lightId of group.lights) {
      await this._applySceneToLight(lightId, scene);
    }

    this.log(`Scen '${scene.name}' applicerad på grupp '${group.name}'`);
    return { success: true, group: group.name, scene: scene.name };
  }

  // ─── Energy Tracking ───────────────────────────────────────────────

  async startEnergyTracking() {
    for (const [zoneId] of this.zones) {
      this.energyTracking.perZone.set(zoneId, { totalWh: 0, sessions: [] });
    }

    setInterval(() => {
      for (const [zoneId, zone] of this.zones) {
        let zoneWatts = 0;
        for (const lightId of zone.lights) {
          const light = this.lights.get(lightId);
          if (light?.state.on) {
            const estimatedWatts = (light.state.brightness / 100) * 10; // ~10W per light
            zoneWatts += estimatedWatts;
          }
        }
        const tracker = this.energyTracking.perZone.get(zoneId);
        if (tracker) {
          const whIncrement = zoneWatts * (5 / 60); // 5-min interval → Wh
          tracker.totalWh += whIncrement;
          this.energyTracking.dailyTotal += whIncrement;
        }
      }
    }, 5 * 60 * 1000);

    this.log('Energispårning startad');
  }

  _trackEnergy(sceneId, _zones, _brightness) {
    if (!this.energyTracking.perScene.has(sceneId)) {
      this.energyTracking.perScene.set(sceneId, { totalActivations: 0, totalMinutes: 0 });
    }
    const tracker = this.energyTracking.perScene.get(sceneId);
    tracker.totalActivations++;
  }

  getEnergyReport() {
    const zoneReport = {};
    for (const [zoneId, data] of this.energyTracking.perZone) {
      const zone = this.zones.get(zoneId);
      zoneReport[zoneId] = {
        name: zone?.name || zoneId,
        totalWh: Math.round(data.totalWh * 100) / 100
      };
    }

    const sceneReport = {};
    for (const [sceneId, data] of this.energyTracking.perScene) {
      sceneReport[sceneId] = { activations: data.totalActivations };
    }

    return {
      daily: Math.round(this.energyTracking.dailyTotal * 100) / 100,
      weekly: Math.round(this.energyTracking.weeklyTotal * 100) / 100,
      monthly: Math.round(this.energyTracking.monthlyTotal * 100) / 100,
      perZone: zoneReport,
      perScene: sceneReport
    };
  }

  // ─── Scene History ─────────────────────────────────────────────────

  _recordHistory(sceneId, zones, action) {
    this.sceneHistory.push({
      sceneId,
      zones: [...zones],
      action,
      timestamp: Date.now()
    });

    // Keep last 500 entries
    if (this.sceneHistory.length > 500) {
      this.sceneHistory = this.sceneHistory.slice(-500);
    }
  }

  getSceneHistory(limit = 50) {
    return this.sceneHistory.slice(-limit).reverse().map(entry => ({
      ...entry,
      sceneName: this.scenes.get(entry.sceneId)?.name || entry.sceneId,
      time: new Date(entry.timestamp).toLocaleString('sv-SE')
    }));
  }

  getUsagePatterns() {
    const sceneCounts = {};
    const hourCounts = new Array(24).fill(0);

    for (const entry of this.sceneHistory) {
      if (entry.action !== 'activate') continue;
      sceneCounts[entry.sceneId] = (sceneCounts[entry.sceneId] || 0) + 1;
      hourCounts[new Date(entry.timestamp).getHours()]++;
    }

    const topScenes = Object.entries(sceneCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, count]) => ({ id, name: this.scenes.get(id)?.name || id, count }));

    return { topScenes, hourlyDistribution: hourCounts };
  }

  // ─── Queries & Utilities ───────────────────────────────────────────

  getSceneList(type = null) {
    const result = [];
    for (const [id, scene] of this.scenes) {
      if (type && scene.type !== type) continue;
      result.push({
        id,
        name: scene.name,
        type: scene.type,
        brightness: scene.brightness,
        colorTemp: scene.colorTemp,
        description: scene.description
      });
    }
    return result;
  }

  getZoneStatus() {
    const result = {};
    for (const [zoneId, zone] of this.zones) {
      const activeLights = zone.lights.filter(id => this.lights.get(id)?.state.on).length;
      result[zoneId] = {
        name: zone.name,
        totalLights: zone.lights.length,
        activeLights,
        activeScene: zone.activeScene,
        motionScene: zone.motionScene
      };
    }
    return result;
  }

  // ─── Statistics ────────────────────────────────────────────────────

  getStatistics() {
    return {
      totalLights: this.lights.size,
      totalZones: this.zones.size,
      totalScenes: this.scenes.size,
      activeScenes: this.activeScenes.size,
      lightGroups: this.lightGroups.size,
      schedules: this.schedules.length,
      historyEntries: this.sceneHistory.length,
      circadianEnabled: this.circadianEnabled,
      partyModeActive: this.partyModeActive,
      focusModeActive: this.focusModeActive,
      guestModeActive: this.guestModeActive,
      energy: {
        dailyWh: Math.round(this.energyTracking.dailyTotal * 100) / 100,
        trackedZones: this.energyTracking.perZone.size
      },
      presetCount: [...this.scenes.values()].filter(s => s.type === 'preset').length,
      themeCount: [...this.scenes.values()].filter(s => s.type === 'theme').length,
      activitySceneCount: [...this.scenes.values()].filter(s => s.type === 'activity').length
    };
  }

  // ─── Notification Helper ───────────────────────────────────────────

  async _notify(title, message, priority = 'normal') {
    try {
      const mgr = this.homey.app?.advancedNotificationManager;
      if (mgr) {
        await mgr.sendNotification({ title, message, priority, category: 'lighting' });
      }
    } catch { /* silent */ }
  }

  // ─── Logging ───────────────────────────────────────────────────────

  log(...args) {
    console.log('[IndoorLightingSceneEngine]', ...args);
  }

  error(...args) {
    console.error('[IndoorLightingSceneEngine]', ...args);
  }
}

module.exports = IndoorLightingSceneEngine;
