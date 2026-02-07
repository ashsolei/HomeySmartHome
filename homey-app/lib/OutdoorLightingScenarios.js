'use strict';

class OutdoorLightingScenarios {
  constructor(homey) {
    this.homey = homey;
    this.latitude = 59.33;
    this.longitude = 18.07;
    this.accentProfiles = new Map();
    this.holidayThemes = new Map();
    this.motionZones = new Map();
    this.energyBudget = {};
    this.lightDevices = new Map();
    this.pathwaySegments = [];
    this.partyMode = null;
    this.wildlifeMode = false;
    this.securityActive = false;
    this.presenceSimulation = false;
    this.monitoringInterval = null;
    this.partyInterval = null;
    this.presenceInterval = null;
    this.initialized = false;
  }

  async initialize() {
    this.log('Initializing Outdoor Lighting Scenarios...');
    try {
      this._initializeAccentProfiles();
      this._initializeHolidayThemes();
      this._initializeMotionZones();
      this._initializeEnergyBudget();
      this._initializePathwaySegments();
      await this._discoverDevices();
      this._startMonitoring();
      this.initialized = true;
      this.log('Outdoor Lighting Scenarios initialized successfully');
    } catch (err) {
      this.error('Failed to initialize Outdoor Lighting Scenarios: ' + err.message);
      throw err;
    }
  }

  _initializeAccentProfiles() {
    this.accentProfiles.set('garden_path', {
      id: 'garden_path',
      name: 'Garden Path',
      defaultBrightness: 40,
      defaultColorTemp: 2700,
      defaultColor: null,
      fixtureCount: 8,
      wattagePerFixture: 5,
      zone: 'garden',
      duskToMidnightBrightness: 40,
      midnightToDawnBrightness: 15,
      motionBoost: 80,
      enabled: true
    });

    this.accentProfiles.set('tree_uplighter', {
      id: 'tree_uplighter',
      name: 'Tree Uplighter',
      defaultBrightness: 60,
      defaultColorTemp: 3000,
      defaultColor: null,
      fixtureCount: 4,
      wattagePerFixture: 10,
      zone: 'garden',
      duskToMidnightBrightness: 60,
      midnightToDawnBrightness: 20,
      motionBoost: 80,
      enabled: true
    });

    this.accentProfiles.set('water_feature', {
      id: 'water_feature',
      name: 'Water Feature',
      defaultBrightness: 50,
      defaultColorTemp: 4000,
      defaultColor: '#0088FF',
      fixtureCount: 3,
      wattagePerFixture: 8,
      zone: 'garden',
      duskToMidnightBrightness: 50,
      midnightToDawnBrightness: 10,
      motionBoost: 70,
      enabled: true
    });

    this.accentProfiles.set('facade', {
      id: 'facade',
      name: 'Facade',
      defaultBrightness: 45,
      defaultColorTemp: 3000,
      defaultColor: null,
      fixtureCount: 6,
      wattagePerFixture: 12,
      zone: 'house',
      duskToMidnightBrightness: 45,
      midnightToDawnBrightness: 15,
      motionBoost: 90,
      enabled: true
    });

    this.accentProfiles.set('entrance', {
      id: 'entrance',
      name: 'Entrance',
      defaultBrightness: 70,
      defaultColorTemp: 3000,
      defaultColor: null,
      fixtureCount: 2,
      wattagePerFixture: 15,
      zone: 'entrance',
      duskToMidnightBrightness: 70,
      midnightToDawnBrightness: 30,
      motionBoost: 100,
      enabled: true
    });

    this.accentProfiles.set('statue', {
      id: 'statue',
      name: 'Statue',
      defaultBrightness: 40,
      defaultColorTemp: 2700,
      defaultColor: null,
      fixtureCount: 2,
      wattagePerFixture: 6,
      zone: 'garden',
      duskToMidnightBrightness: 40,
      midnightToDawnBrightness: 0,
      motionBoost: 60,
      enabled: true
    });

    this.accentProfiles.set('flower_bed', {
      id: 'flower_bed',
      name: 'Flower Bed',
      defaultBrightness: 35,
      defaultColorTemp: 2700,
      defaultColor: null,
      fixtureCount: 6,
      wattagePerFixture: 4,
      zone: 'garden',
      duskToMidnightBrightness: 35,
      midnightToDawnBrightness: 0,
      motionBoost: 50,
      enabled: true
    });

    this.accentProfiles.set('pergola', {
      id: 'pergola',
      name: 'Pergola',
      defaultBrightness: 55,
      defaultColorTemp: 2700,
      defaultColor: null,
      fixtureCount: 4,
      wattagePerFixture: 8,
      zone: 'patio',
      duskToMidnightBrightness: 55,
      midnightToDawnBrightness: 10,
      motionBoost: 80,
      enabled: true
    });

    this.accentProfiles.set('deck', {
      id: 'deck',
      name: 'Deck',
      defaultBrightness: 50,
      defaultColorTemp: 2700,
      defaultColor: null,
      fixtureCount: 6,
      wattagePerFixture: 6,
      zone: 'patio',
      duskToMidnightBrightness: 50,
      midnightToDawnBrightness: 10,
      motionBoost: 80,
      enabled: true
    });

    this.accentProfiles.set('driveway', {
      id: 'driveway',
      name: 'Driveway',
      defaultBrightness: 60,
      defaultColorTemp: 4000,
      defaultColor: null,
      fixtureCount: 4,
      wattagePerFixture: 20,
      zone: 'driveway',
      duskToMidnightBrightness: 60,
      midnightToDawnBrightness: 20,
      motionBoost: 100,
      enabled: true
    });

    this.log('Accent profiles initialized: ' + this.accentProfiles.size);
  }

  _initializeHolidayThemes() {
    this.holidayThemes.set('christmas', {
      id: 'christmas',
      name: 'Christmas',
      colors: ['#FF0000', '#00FF00', '#FFFFFF', '#FFD700'],
      pattern: 'twinkle',
      startDate: { month: 12, day: 1 },
      endDate: { month: 1, day: 6 },
      brightness: 70,
      enabled: true,
      description: 'Red, green, and gold with twinkling pattern'
    });

    this.holidayThemes.set('halloween', {
      id: 'halloween',
      name: 'Halloween',
      colors: ['#FF6600', '#8B00FF', '#00FF00'],
      pattern: 'pulse',
      startDate: { month: 10, day: 15 },
      endDate: { month: 11, day: 1 },
      brightness: 60,
      enabled: true,
      description: 'Orange and purple with pulsing effect'
    });

    this.holidayThemes.set('midsommar', {
      id: 'midsommar',
      name: 'Midsommar',
      colors: ['#FFFFFF', '#FFFF00', '#87CEEB', '#FFD700'],
      pattern: 'steady',
      startDate: { month: 6, day: 19 },
      endDate: { month: 6, day: 25 },
      brightness: 80,
      enabled: true,
      description: 'White and yellow for Swedish Midsommar'
    });

    this.holidayThemes.set('easter', {
      id: 'easter',
      name: 'Easter',
      colors: ['#FFB6C1', '#E6E6FA', '#98FB98', '#FFFACD'],
      pattern: 'gentle_fade',
      startDate: { month: 4, day: 1 },
      endDate: { month: 4, day: 20 },
      brightness: 50,
      enabled: true,
      description: 'Pastel colors with gentle fading'
    });

    this.holidayThemes.set('lucia', {
      id: 'lucia',
      name: 'Lucia',
      colors: ['#FFFFFF', '#FFF8DC'],
      pattern: 'candle_flicker',
      startDate: { month: 12, day: 13 },
      endDate: { month: 12, day: 13 },
      brightness: 45,
      enabled: true,
      description: 'White candlelight for Swedish Lucia'
    });

    this.holidayThemes.set('new_year', {
      id: 'new_year',
      name: 'New Year',
      colors: ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFFFFF', '#FFD700'],
      pattern: 'rainbow_chase',
      startDate: { month: 12, day: 31 },
      endDate: { month: 1, day: 1 },
      brightness: 100,
      enabled: true,
      description: 'Multicolor celebration with chasing pattern'
    });

    this.log('Holiday themes initialized: ' + this.holidayThemes.size);
  }

  _initializeMotionZones() {
    const zones = [
      { id: 'front_entrance', name: 'Front Entrance', sensitivity: 0.8, timeout: 120, boost: 100, profiles: ['entrance', 'facade'], active: true },
      { id: 'driveway_zone', name: 'Driveway', sensitivity: 0.7, timeout: 180, boost: 100, profiles: ['driveway'], active: true },
      { id: 'backyard_zone', name: 'Backyard', sensitivity: 0.6, timeout: 300, boost: 80, profiles: ['garden_path', 'deck'], active: true },
      { id: 'side_passage', name: 'Side Passage', sensitivity: 0.9, timeout: 90, boost: 100, profiles: ['facade'], active: true },
      { id: 'garden_zone', name: 'Garden', sensitivity: 0.5, timeout: 300, boost: 60, profiles: ['garden_path', 'flower_bed', 'tree_uplighter'], active: true },
      { id: 'patio_zone', name: 'Patio', sensitivity: 0.6, timeout: 600, boost: 80, profiles: ['pergola', 'deck'], active: true }
    ];

    for (const zone of zones) {
      this.motionZones.set(zone.id, {
        id: zone.id,
        name: zone.name,
        sensitivity: zone.sensitivity,
        timeoutSeconds: zone.timeout,
        boostBrightness: zone.boost,
        linkedProfiles: zone.profiles,
        active: zone.active,
        lastMotion: null,
        motionCount: 0,
        currentlyBoosted: false
      });
    }

    this.log('Motion zones initialized: ' + this.motionZones.size);
  }

  _initializeEnergyBudget() {
    this.energyBudget = {
      monthlyBudgetKWh: 50,
      currentUsageKWh: 0,
      dailyUsageKWh: 0,
      budgetResetDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime(),
      priorityOrder: ['entrance', 'driveway', 'facade', 'garden_path', 'deck', 'pergola', 'tree_uplighter', 'water_feature', 'flower_bed', 'statue'],
      dimThresholdPercent: 80,
      criticalThresholdPercent: 95,
      overBudgetAction: 'dim_non_essential',
      currentDimLevel: 0,
      history: []
    };
    this.log('Energy budget initialized: ' + this.energyBudget.monthlyBudgetKWh + ' kWh/month');
  }

  _initializePathwaySegments() {
    this.pathwaySegments = [
      { id: 'path_1', name: 'Gate to Front Door', order: 1, deviceIds: [], brightness: 40, delay: 500 },
      { id: 'path_2', name: 'Front Door to Driveway', order: 2, deviceIds: [], brightness: 50, delay: 500 },
      { id: 'path_3', name: 'Driveway to Garage', order: 3, deviceIds: [], brightness: 60, delay: 500 },
      { id: 'path_4', name: 'House to Garden', order: 4, deviceIds: [], brightness: 35, delay: 700 },
      { id: 'path_5', name: 'Garden Path North', order: 5, deviceIds: [], brightness: 30, delay: 700 },
      { id: 'path_6', name: 'Garden Path South', order: 6, deviceIds: [], brightness: 30, delay: 700 }
    ];
    this.log('Pathway segments initialized: ' + this.pathwaySegments.length);
  }

  async _discoverDevices() {
    try {
      const devices = await this.homey.devices.getDevices();
      let discovered = 0;

      for (const [deviceId, device] of Object.entries(devices)) {
        const name = (device.name || '').toLowerCase();
        if (name.includes('outdoor') || name.includes('garden') || name.includes('path') ||
            name.includes('entrance') || name.includes('driveway') || name.includes('patio') ||
            name.includes('facade') || name.includes('deck') || name.includes('exterior')) {
          this.lightDevices.set(deviceId, {
            deviceId: deviceId,
            name: device.name,
            zone: null,
            currentBrightness: 0,
            currentColorTemp: 2700,
            currentColor: null,
            isOn: false,
            wattage: 10,
            lastUpdated: null
          });
          discovered++;
        }
      }

      this.log('Device discovery complete: ' + discovered + ' outdoor lights found');
    } catch (err) {
      this.error('Device discovery failed: ' + err.message);
    }
  }

  calculateSunPosition(date) {
    const d = date instanceof Date ? date : new Date(date);
    const dayOfYear = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
    const declination = -23.45 * Math.cos((2 * Math.PI / 365) * (dayOfYear + 10));
    const hourAngle = (d.getHours() + d.getMinutes() / 60 - 12) * 15;

    const latRad = this.latitude * Math.PI / 180;
    const decRad = declination * Math.PI / 180;
    const haRad = hourAngle * Math.PI / 180;

    const altitude = Math.asin(
      Math.sin(latRad) * Math.sin(decRad) +
      Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad)
    ) * 180 / Math.PI;

    const azimuth = Math.atan2(
      Math.sin(haRad),
      Math.cos(haRad) * Math.sin(latRad) - Math.tan(decRad) * Math.cos(latRad)
    ) * 180 / Math.PI + 180;

    return {
      altitude: Math.round(altitude * 100) / 100,
      azimuth: Math.round(azimuth * 100) / 100,
      declination: Math.round(declination * 100) / 100
    };
  }

  getSunrise(date) {
    const d = date || new Date();
    const dayOfYear = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
    const declination = -23.45 * Math.cos((2 * Math.PI / 365) * (dayOfYear + 10));
    const latRad = this.latitude * Math.PI / 180;
    const decRad = declination * Math.PI / 180;
    const cosHourAngle = -Math.tan(latRad) * Math.tan(decRad);

    if (cosHourAngle < -1) return { hours: 0, minutes: 0, formatted: 'polar_day' };
    if (cosHourAngle > 1) return { hours: 0, minutes: 0, formatted: 'polar_night' };

    const hourAngle = Math.acos(cosHourAngle) * 180 / Math.PI;
    const sunriseHour = 12 - hourAngle / 15;
    const hours = Math.floor(sunriseHour);
    const minutes = Math.round((sunriseHour - hours) * 60);
    return { hours: hours, minutes: minutes, formatted: String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0') };
  }

  getSunset(date) {
    const d = date || new Date();
    const dayOfYear = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
    const declination = -23.45 * Math.cos((2 * Math.PI / 365) * (dayOfYear + 10));
    const latRad = this.latitude * Math.PI / 180;
    const decRad = declination * Math.PI / 180;
    const cosHourAngle = -Math.tan(latRad) * Math.tan(decRad);

    if (cosHourAngle < -1) return { hours: 23, minutes: 59, formatted: 'polar_day' };
    if (cosHourAngle > 1) return { hours: 0, minutes: 0, formatted: 'polar_night' };

    const hourAngle = Math.acos(cosHourAngle) * 180 / Math.PI;
    const sunsetHour = 12 + hourAngle / 15;
    const hours = Math.floor(sunsetHour);
    const minutes = Math.round((sunsetHour - hours) * 60);
    return { hours: hours, minutes: minutes, formatted: String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0') };
  }

  getCivilTwilight(date) {
    const sunrise = this.getSunrise(date);
    const sunset = this.getSunset(date);
    if (sunrise.formatted === 'polar_day' || sunrise.formatted === 'polar_night') {
      return { dawn: sunrise, dusk: sunset };
    }
    const dawnMin = Math.max(0, (sunrise.hours * 60 + sunrise.minutes) - 30);
    const duskMin = Math.min(1439, (sunset.hours * 60 + sunset.minutes) + 30);
    return {
      dawn: { hours: Math.floor(dawnMin / 60), minutes: dawnMin % 60, formatted: String(Math.floor(dawnMin / 60)).padStart(2, '0') + ':' + String(dawnMin % 60).padStart(2, '0') },
      dusk: { hours: Math.floor(duskMin / 60), minutes: duskMin % 60, formatted: String(Math.floor(duskMin / 60)).padStart(2, '0') + ':' + String(duskMin % 60).padStart(2, '0') }
    };
  }

  getNauticalTwilight(date) {
    const sunrise = this.getSunrise(date);
    const sunset = this.getSunset(date);
    if (sunrise.formatted === 'polar_day' || sunrise.formatted === 'polar_night') {
      return { dawn: sunrise, dusk: sunset };
    }
    const dawnMin = Math.max(0, (sunrise.hours * 60 + sunrise.minutes) - 60);
    const duskMin = Math.min(1439, (sunset.hours * 60 + sunset.minutes) + 60);
    return {
      dawn: { hours: Math.floor(dawnMin / 60), minutes: dawnMin % 60, formatted: String(Math.floor(dawnMin / 60)).padStart(2, '0') + ':' + String(dawnMin % 60).padStart(2, '0') },
      dusk: { hours: Math.floor(duskMin / 60), minutes: duskMin % 60, formatted: String(Math.floor(duskMin / 60)).padStart(2, '0') + ':' + String(duskMin % 60).padStart(2, '0') }
    };
  }

  getBrightnessForTime(date) {
    const d = date || new Date();
    const sunPos = this.calculateSunPosition(d);
    const hour = d.getHours() + d.getMinutes() / 60;

    if (sunPos.altitude > 0) {
      return 0;
    }

    const sunset = this.getSunset(d);
    const sunrise = this.getSunrise(d);

    if (sunset.formatted === 'polar_night') return 50;
    if (sunrise.formatted === 'polar_day') return 0;

    const sunsetDecimal = sunset.hours + sunset.minutes / 60;
    const sunriseDecimal = sunrise.hours + sunrise.minutes / 60;

    if (hour >= sunsetDecimal && hour < sunsetDecimal + 1) {
      return Math.round(((hour - sunsetDecimal) / 1) * 100);
    }

    if (hour >= sunsetDecimal + 1 || hour < 0.5) {
      return 100;
    }

    if (hour >= 0.5 && hour < 4) {
      return Math.round(100 - ((hour - 0.5) / 3.5) * 60);
    }

    if (hour >= 4 && hour < sunriseDecimal - 0.5) {
      return 30;
    }

    if (hour >= sunriseDecimal - 0.5 && hour < sunriseDecimal) {
      return Math.round(30 * ((sunriseDecimal - hour) / 0.5));
    }

    return 0;
  }

  getColorTempForTime(date) {
    const d = date || new Date();
    const hour = d.getHours() + d.getMinutes() / 60;
    const sunset = this.getSunset(d);
    const sunsetDecimal = sunset.hours + sunset.minutes / 60;

    if (hour >= sunsetDecimal && hour < sunsetDecimal + 1.5) {
      return 2700;
    }

    if (hour >= sunsetDecimal + 1.5 || hour < 0) {
      return 4000;
    }

    if (hour >= 0 && hour < 3) {
      return Math.round(4000 - ((hour / 3) * 1800));
    }

    if (hour >= 3 && hour < 6) {
      return 2200;
    }

    return 2700;
  }

  getActiveHolidayTheme() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();

    for (const [, theme] of this.holidayThemes) {
      if (!theme.enabled) continue;

      const startM = theme.startDate.month;
      const startD = theme.startDate.day;
      const endM = theme.endDate.month;
      const endD = theme.endDate.day;

      let isActive = false;
      if (startM <= endM) {
        isActive = (month > startM || (month === startM && day >= startD)) &&
                   (month < endM || (month === endM && day <= endD));
      } else {
        isActive = (month > startM || (month === startM && day >= startD)) ||
                   (month < endM || (month === endM && day <= endD));
      }

      if (isActive) {
        return theme;
      }
    }

    return null;
  }

  adjustForWeather(conditions) {
    if (!conditions) return { adjustments: [] };

    const adjustments = [];

    if (conditions.fog || (conditions.visibility && conditions.visibility < 500)) {
      adjustments.push({
        type: 'fog',
        action: 'increase_brightness',
        modifier: 1.5,
        reason: 'Low visibility fog conditions'
      });
    }

    if (conditions.rain || (conditions.precipitation && conditions.precipitation > 1)) {
      adjustments.push({
        type: 'rain',
        action: 'decrease_brightness',
        modifier: 0.7,
        reason: 'Rain reflection reduces need for full brightness'
      });
    }

    if (conditions.snow || (conditions.snowfall && conditions.snowfall > 0)) {
      adjustments.push({
        type: 'snow',
        action: 'pathways_only',
        modifier: 0.5,
        reason: 'Snow reflects light - reduce decorative, maintain pathways',
        pathwaysOnly: true
      });
    }

    if (conditions.windSpeed && conditions.windSpeed > 15) {
      adjustments.push({
        type: 'high_wind',
        action: 'security_only',
        modifier: 0.4,
        reason: 'High wind - reduce to security lighting only'
      });
    }

    return { adjustments: adjustments, timestamp: Date.now() };
  }

  activatePathwaySequence(direction) {
    const segments = direction === 'reverse'
      ? [...this.pathwaySegments].reverse()
      : [...this.pathwaySegments];

    const sequence = segments.map((seg, index) => ({
      segmentId: seg.id,
      name: seg.name,
      order: index + 1,
      delayMs: index * seg.delay,
      brightness: seg.brightness,
      action: 'turn_on'
    }));

    this.log('Pathway sequence activated: ' + direction + ' (' + segments.length + ' segments)');

    return {
      direction: direction || 'forward',
      segments: sequence,
      totalDurationMs: segments.reduce((sum, s, i) => sum + (i * s.delay), 0),
      segmentCount: segments.length
    };
  }

  boostLightsForCamera(cameraZone) {
    const linkedProfiles = [];

    for (const [, zone] of this.motionZones) {
      if (zone.id === cameraZone || zone.name.toLowerCase().includes(cameraZone.toLowerCase())) {
        for (const profileId of zone.linkedProfiles) {
          const profile = this.accentProfiles.get(profileId);
          if (profile) {
            linkedProfiles.push({
              profileId: profileId,
              name: profile.name,
              boostedBrightness: 100,
              originalBrightness: profile.defaultBrightness,
              colorTemp: 4000
            });
          }
        }
      }
    }

    this.log('Camera boost activated for zone: ' + cameraZone + ', boosted ' + linkedProfiles.length + ' profiles');

    return {
      cameraZone: cameraZone,
      boostedProfiles: linkedProfiles,
      duration: 300,
      colorTemp: 4000
    };
  }

  startPartyMode(colorScheme, pattern) {
    const colors = colorScheme || ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];
    const activePattern = pattern || 'chase';

    this.partyMode = {
      active: true,
      colors: colors,
      pattern: activePattern,
      brightness: 100,
      speed: 500,
      startedAt: Date.now(),
      affectedProfiles: Array.from(this.accentProfiles.keys())
    };

    if (this.partyInterval) {
      clearInterval(this.partyInterval);
    }

    this.partyInterval = setInterval(() => {
      this._partyModeCycle();
    }, this.partyMode.speed);

    this.log('Party mode started: ' + activePattern + ' with ' + colors.length + ' colors');

    return {
      active: true,
      pattern: activePattern,
      colors: colors,
      profilesAffected: this.partyMode.affectedProfiles.length
    };
  }

  stopPartyMode() {
    if (this.partyInterval) {
      clearInterval(this.partyInterval);
      this.partyInterval = null;
    }
    this.partyMode = null;
    this.log('Party mode stopped');
    return { active: false };
  }

  _partyModeCycle() {
    if (!this.partyMode || !this.partyMode.active) return;

    const colorIndex = Math.floor((Date.now() - this.partyMode.startedAt) / this.partyMode.speed) % this.partyMode.colors.length;
    const currentColor = this.partyMode.colors[colorIndex];

    for (const [, device] of this.lightDevices) {
      device.currentColor = currentColor;
      device.currentBrightness = this.partyMode.brightness;
    }
  }

  setWildlifeMode(enabled) {
    this.wildlifeMode = enabled;

    if (enabled) {
      for (const [, profile] of this.accentProfiles) {
        profile.savedBrightness = profile.defaultBrightness;
        profile.defaultBrightness = Math.min(profile.defaultBrightness, 25);
      }
      this.log('Wildlife-friendly mode enabled: amber-only, reduced brightness');
    } else {
      for (const [, profile] of this.accentProfiles) {
        if (profile.savedBrightness !== undefined) {
          profile.defaultBrightness = profile.savedBrightness;
          delete profile.savedBrightness;
        }
      }
      this.log('Wildlife-friendly mode disabled: normal lighting restored');
    }

    return {
      wildlifeMode: enabled,
      color: enabled ? '#FF8C00' : null,
      maxBrightness: enabled ? 25 : 100,
      reducedHours: enabled
    };
  }

  triggerSecurityLighting() {
    this.securityActive = true;

    const activatedProfiles = [];
    for (const [profileId, profile] of this.accentProfiles) {
      activatedProfiles.push({
        profileId: profileId,
        name: profile.name,
        brightness: 100,
        colorTemp: 5000
      });
    }

    this.log('Security lighting triggered: all zones at 100% brightness');

    return {
      securityActive: true,
      profilesActivated: activatedProfiles.length,
      brightness: 100,
      colorTemp: 5000,
      timestamp: Date.now()
    };
  }

  deactivateSecurityLighting() {
    this.securityActive = false;
    this.log('Security lighting deactivated');
    return { securityActive: false };
  }

  simulatePresence() {
    if (this.presenceSimulation) {
      return { active: true, reason: 'already_running' };
    }

    this.presenceSimulation = true;

    this.presenceInterval = setInterval(() => {
      this._presenceSimulationCycle();
    }, 900000);

    this.log('Presence simulation started');
    return { active: true, intervalMinutes: 15 };
  }

  stopPresenceSimulation() {
    this.presenceSimulation = false;
    if (this.presenceInterval) {
      clearInterval(this.presenceInterval);
      this.presenceInterval = null;
    }
    this.log('Presence simulation stopped');
    return { active: false };
  }

  _presenceSimulationCycle() {
    if (!this.presenceSimulation) return;

    const profiles = Array.from(this.accentProfiles.keys());
    const numToToggle = 1 + Math.floor(Math.random() * 3);

    for (let i = 0; i < numToToggle; i++) {
      const randomProfile = profiles[Math.floor(Math.random() * profiles.length)];
      const profile = this.accentProfiles.get(randomProfile);
      if (profile) {
        const shouldBeOn = Math.random() > 0.4;
        this.log('Presence sim: ' + profile.name + ' → ' + (shouldBeOn ? 'ON' : 'OFF'));
      }
    }
  }

  handleMotion(zoneId) {
    const zone = this.motionZones.get(zoneId);
    if (!zone || !zone.active) return null;

    zone.lastMotion = Date.now();
    zone.motionCount += 1;
    zone.currentlyBoosted = true;

    const boostedProfiles = [];
    for (const profileId of zone.linkedProfiles) {
      const profile = this.accentProfiles.get(profileId);
      if (profile) {
        boostedProfiles.push({
          profileId: profileId,
          name: profile.name,
          boostedBrightness: zone.boostBrightness
        });
      }
    }

    setTimeout(() => {
      zone.currentlyBoosted = false;
    }, zone.timeoutSeconds * 1000);

    this.log('Motion in ' + zone.name + ': boosted ' + boostedProfiles.length + ' profiles for ' + zone.timeoutSeconds + 's');

    return {
      zoneId: zoneId,
      zoneName: zone.name,
      boostedProfiles: boostedProfiles,
      timeoutSeconds: zone.timeoutSeconds,
      motionCount: zone.motionCount
    };
  }

  priorityDimming() {
    const usagePercent = (this.energyBudget.currentUsageKWh / this.energyBudget.monthlyBudgetKWh) * 100;

    if (usagePercent < this.energyBudget.dimThresholdPercent) {
      this.energyBudget.currentDimLevel = 0;
      return { dimming: false, usagePercent: Math.round(usagePercent) };
    }

    const overagePercent = usagePercent - this.energyBudget.dimThresholdPercent;
    const dimFactor = Math.min(70, overagePercent * 3);
    this.energyBudget.currentDimLevel = dimFactor;

    const dimmedProfiles = [];
    const priorityOrder = this.energyBudget.priorityOrder;

    for (let i = priorityOrder.length - 1; i >= 0; i--) {
      if (dimmedProfiles.length >= Math.ceil(overagePercent / 10)) break;
      const profileId = priorityOrder[i];
      const profile = this.accentProfiles.get(profileId);
      if (profile) {
        dimmedProfiles.push({
          profileId: profileId,
          name: profile.name,
          dimmedTo: Math.round(profile.defaultBrightness * (1 - dimFactor / 100))
        });
      }
    }

    this.log('Priority dimming active: ' + dimmedProfiles.length + ' profiles dimmed by ' + dimFactor.toFixed(0) + '%');

    return {
      dimming: true,
      usagePercent: Math.round(usagePercent),
      dimFactor: Math.round(dimFactor),
      dimmedProfiles: dimmedProfiles
    };
  }

  _startMonitoring() {
    this.monitoringInterval = setInterval(() => {
      this._monitoringCycle();
    }, 300000);

    this.log('Monitoring started: 5-min outdoor lighting cycle');
  }

  _monitoringCycle() {
    try {
      const now = new Date();
      const sunPos = this.calculateSunPosition(now);
      const brightness = this.getBrightnessForTime(now);
      const colorTemp = this.getColorTempForTime(now);

      const activeTheme = this.getActiveHolidayTheme();

      if (!this.partyMode && !this.securityActive) {
        for (const [, profile] of this.accentProfiles) {
          if (!profile.enabled) continue;

          let targetBrightness = brightness > 0
            ? Math.round(profile.defaultBrightness * (brightness / 100))
            : 0;

          if (this.wildlifeMode) {
            targetBrightness = Math.min(targetBrightness, 25);
          }

          if (activeTheme) {
            targetBrightness = Math.max(targetBrightness, activeTheme.brightness * 0.5);
          }
        }
      }

      let totalWatts = 0;
      for (const [, profile] of this.accentProfiles) {
        if (profile.enabled && brightness > 0) {
          totalWatts += profile.fixtureCount * profile.wattagePerFixture * (brightness / 100);
        }
      }

      const kWhThisCycle = (totalWatts / 1000) * (5 / 60);
      this.energyBudget.currentUsageKWh += kWhThisCycle;
      this.energyBudget.dailyUsageKWh += kWhThisCycle;

      this.priorityDimming();

      for (const [, zone] of this.motionZones) {
        if (zone.currentlyBoosted && zone.lastMotion) {
          if (Date.now() - zone.lastMotion > zone.timeoutSeconds * 1000) {
            zone.currentlyBoosted = false;
          }
        }
      }
    } catch (err) {
      this.error('Monitoring cycle error: ' + err.message);
    }
  }

  getStatistics() {
    const now = new Date();
    const sunPos = this.calculateSunPosition(now);
    const sunrise = this.getSunrise();
    const sunset = this.getSunset();
    const civilTwilight = this.getCivilTwilight();
    const brightness = this.getBrightnessForTime(now);
    const colorTemp = this.getColorTempForTime(now);
    const activeTheme = this.getActiveHolidayTheme();

    const profileSummary = {};
    for (const [id, profile] of this.accentProfiles) {
      profileSummary[id] = {
        name: profile.name,
        enabled: profile.enabled,
        brightness: profile.defaultBrightness,
        fixtureCount: profile.fixtureCount,
        totalWattage: profile.fixtureCount * profile.wattagePerFixture
      };
    }

    const motionSummary = {};
    let totalMotionEvents = 0;
    for (const [id, zone] of this.motionZones) {
      totalMotionEvents += zone.motionCount;
      motionSummary[id] = {
        name: zone.name,
        active: zone.active,
        motionCount: zone.motionCount,
        currentlyBoosted: zone.currentlyBoosted,
        lastMotion: zone.lastMotion
      };
    }

    return {
      sunPosition: sunPos,
      sunrise: sunrise.formatted,
      sunset: sunset.formatted,
      civilTwilight: {
        dawn: civilTwilight.dawn.formatted,
        dusk: civilTwilight.dusk.formatted
      },
      currentBrightness: brightness,
      currentColorTemp: colorTemp,
      activeHolidayTheme: activeTheme ? activeTheme.name : null,
      accentProfiles: profileSummary,
      motionZones: motionSummary,
      totalMotionEvents: totalMotionEvents,
      energyBudget: {
        monthlyBudgetKWh: this.energyBudget.monthlyBudgetKWh,
        currentUsageKWh: Math.round(this.energyBudget.currentUsageKWh * 100) / 100,
        usagePercent: Math.round((this.energyBudget.currentUsageKWh / this.energyBudget.monthlyBudgetKWh) * 100),
        currentDimLevel: this.energyBudget.currentDimLevel
      },
      partyMode: this.partyMode ? { active: true, pattern: this.partyMode.pattern } : { active: false },
      wildlifeMode: this.wildlifeMode,
      securityActive: this.securityActive,
      presenceSimulation: this.presenceSimulation,
      lightDevices: this.lightDevices.size,
      pathwaySegments: this.pathwaySegments.length,
      holidayThemes: this.holidayThemes.size,
      uptime: this.initialized ? 'active' : 'inactive'
    };
  }

  log(msg) {
    this.homey.log('[OutdoorLighting]', msg);
  }

  error(msg) {
    this.homey.error('[OutdoorLighting]', msg);
  }

  destroy() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    if (this.partyInterval) {
      clearInterval(this.partyInterval);
      this.partyInterval = null;
    }
    if (this.presenceInterval) {
      clearInterval(this.presenceInterval);
      this.presenceInterval = null;
    }
    this.log('Outdoor Lighting Scenarios destroyed');
  }
}

module.exports = OutdoorLightingScenarios;
