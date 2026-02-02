'use strict';

/**
 * Outdoor Lighting Scenarios
 * Advanced outdoor lighting with astronomical calculations and security integration
 */
class OutdoorLightingScenarios {
  constructor(homey) {
    this.homey = homey;
    this.outdoorLights = new Map();
    this.lightingZones = new Map();
    this.scenarios = new Map();
    this.astronomicalData = null;
    this.motionDetection = true;
    this.autoMode = true;
  }

  async initialize() {
    this.log('Initializing Outdoor Lighting Scenarios...');
    
    await this.discoverOutdoorLights();
    await this.setupLightingZones();
    await this.setupScenarios();
    await this.calculateAstronomicalTimes();
    await this.startMonitoring();
    
    this.log('Outdoor Lighting Scenarios initialized');
  }

  async discoverOutdoorLights() {
    const devices = this.homey.drivers.getDevices();
    
    for (const device of devices) {
      const name = device.name.toLowerCase();
      const zone = device.zone?.name?.toLowerCase() || '';
      
      const isOutdoor = zone.includes('outdoor') || zone.includes('garden') || 
                       zone.includes('utomhus') || zone.includes('trädgård') ||
                       zone.includes('front') || zone.includes('back') ||
                       name.includes('outdoor') || name.includes('utomhus');

      if (isOutdoor && device.hasCapability('onoff')) {
        this.outdoorLights.set(device.id, {
          id: device.id,
          name: device.name,
          device,
          zone: device.zone?.name || 'unknown',
          on: false,
          brightness: 100,
          motionControlled: name.includes('motion') || name.includes('rörelse')
        });
      }
    }

    this.log(`Discovered ${this.outdoorLights.size} outdoor lights`);
  }

  async setupLightingZones() {
    this.lightingZones.set('front', {
      id: 'front',
      name: 'Front Yard',
      lights: [],
      schedule: { on: 'sunset', off: 'sunrise' },
      motionSensitive: true
    });

    this.lightingZones.set('back', {
      id: 'back',
      name: 'Back Yard',
      lights: [],
      schedule: { on: 'sunset', off: '23:00' },
      motionSensitive: true
    });

    this.lightingZones.set('path', {
      id: 'path',
      name: 'Pathway',
      lights: [],
      schedule: { on: 'dusk', off: 'dawn' },
      motionSensitive: false
    });

    this.lightingZones.set('security', {
      id: 'security',
      name: 'Security Perimeter',
      lights: [],
      schedule: { on: 'dusk', off: 'dawn' },
      motionSensitive: true,
      alwaysOn: true
    });

    for (const [id, light] of this.outdoorLights) {
      const zoneName = light.zone.toLowerCase();
      if (zoneName.includes('front')) {
        this.lightingZones.get('front').lights.push(id);
      } else if (zoneName.includes('back')) {
        this.lightingZones.get('back').lights.push(id);
      } else if (zoneName.includes('path')) {
        this.lightingZones.get('path').lights.push(id);
      }
    }
  }

  async setupScenarios() {
    this.scenarios.set('evening', {
      id: 'evening',
      name: 'Evening Ambiance',
      brightness: 70,
      zones: ['front', 'back', 'path'],
      trigger: 'sunset'
    });

    this.scenarios.set('night', {
      id: 'night',
      name: 'Night Security',
      brightness: 50,
      zones: ['security', 'path'],
      trigger: '23:00'
    });

    this.scenarios.set('morning', {
      id: 'morning',
      name: 'Morning',
      brightness: 0,
      zones: ['all'],
      trigger: 'sunrise'
    });

    this.scenarios.set('party', {
      id: 'party',
      name: 'Outdoor Party',
      brightness: 100,
      zones: ['all'],
      trigger: 'manual',
      colorful: true
    });

    this.scenarios.set('security_alert', {
      id: 'security_alert',
      name: 'Security Alert',
      brightness: 100,
      zones: ['all'],
      trigger: 'security_event',
      flash: true
    });
  }

  async calculateAstronomicalTimes() {
    const latitude = 59.3293;
    const longitude = 18.0686;
    const now = new Date();

    this.astronomicalData = {
      date: now.toISOString().split('T')[0],
      sunrise: this.calculateSunrise(latitude, longitude, now),
      sunset: this.calculateSunset(latitude, longitude, now),
      dusk: this.calculateDusk(latitude, longitude, now),
      dawn: this.calculateDawn(latitude, longitude, now)
    };

    this.log(`Astronomical times calculated: Sunrise ${this.astronomicalData.sunrise}, Sunset ${this.astronomicalData.sunset}`);
  }

  calculateSunrise(lat, lon, date) {
    const hour = 6 + Math.sin(date.getMonth() / 12 * Math.PI * 2) * 3;
    return `${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.floor((hour % 1) * 60)).padStart(2, '0')}`;
  }

  calculateSunset(lat, lon, date) {
    const hour = 18 + Math.sin(date.getMonth() / 12 * Math.PI * 2) * 3;
    return `${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.floor((hour % 1) * 60)).padStart(2, '0')}`;
  }

  calculateDusk(lat, lon, date) {
    const sunsetHour = 18 + Math.sin(date.getMonth() / 12 * Math.PI * 2) * 3;
    const duskHour = sunsetHour + 0.5;
    return `${String(Math.floor(duskHour)).padStart(2, '0')}:${String(Math.floor((duskHour % 1) * 60)).padStart(2, '0')}`;
  }

  calculateDawn(lat, lon, date) {
    const sunriseHour = 6 + Math.sin(date.getMonth() / 12 * Math.PI * 2) * 3;
    const dawnHour = sunriseHour - 0.5;
    return `${String(Math.floor(dawnHour)).padStart(2, '0')}:${String(Math.floor((dawnHour % 1) * 60)).padStart(2, '0')}`;
  }

  async startMonitoring() {
    this.monitoringInterval = setInterval(async () => {
      await this.checkSchedules();
      await this.checkMotionDetection();
    }, 60000);

    setInterval(async () => {
      await this.calculateAstronomicalTimes();
    }, 24 * 60 * 60 * 1000);

    await this.checkSchedules();
  }

  async checkSchedules() {
    if (!this.autoMode) return;

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    for (const [id, scenario] of this.scenarios) {
      if (scenario.trigger === 'manual' || scenario.trigger === 'security_event') continue;

      let triggerTime = scenario.trigger;
      if (triggerTime === 'sunset') triggerTime = this.astronomicalData.sunset;
      if (triggerTime === 'sunrise') triggerTime = this.astronomicalData.sunrise;
      if (triggerTime === 'dusk') triggerTime = this.astronomicalData.dusk;
      if (triggerTime === 'dawn') triggerTime = this.astronomicalData.dawn;

      if (currentTime === triggerTime) {
        await this.activateScenario(id);
      }
    }
  }

  async activateScenario(scenarioId) {
    const scenario = this.scenarios.get(scenarioId);
    if (!scenario) return;

    this.log(`Activating outdoor lighting scenario: ${scenario.name}`);

    const zonesToActivate = scenario.zones.includes('all') 
      ? Array.from(this.lightingZones.keys())
      : scenario.zones;

    for (const zoneId of zonesToActivate) {
      const zone = this.lightingZones.get(zoneId);
      if (!zone) continue;

      for (const lightId of zone.lights) {
        const light = this.outdoorLights.get(lightId);
        if (!light) continue;

        try {
          const brightness = scenario.brightness / 100;
          
          if (light.device.hasCapability('onoff')) {
            await light.device.setCapabilityValue('onoff', brightness > 0);
            light.on = brightness > 0;
          }

          if (light.device.hasCapability('dim')) {
            await light.device.setCapabilityValue('dim', brightness);
            light.brightness = scenario.brightness;
          }

          if (scenario.flash) {
            await this.flashLight(lightId);
          }
        } catch {}
      }
    }
  }

  async flashLight(lightId) {
    const light = this.outdoorLights.get(lightId);
    if (!light) return;

    for (let i = 0; i < 5; i++) {
      try {
        await light.device.setCapabilityValue('onoff', true);
        await new Promise(resolve => setTimeout(resolve, 500));
        await light.device.setCapabilityValue('onoff', false);
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch {}
    }

    await light.device.setCapabilityValue('onoff', true);
  }

  async checkMotionDetection() {
    if (!this.motionDetection) return;

    const devices = this.homey.drivers.getDevices();
    
    for (const device of devices) {
      if (!device.hasCapability('alarm_motion')) continue;

      const zone = device.zone?.name?.toLowerCase() || '';
      const isOutdoor = zone.includes('outdoor') || zone.includes('garden') || zone.includes('utomhus');

      if (!isOutdoor) continue;

      try {
        const motion = await device.getCapabilityValue('alarm_motion');
        
        if (motion) {
          await this.handleMotionDetected(zone);
        }
      } catch {}
    }
  }

  async handleMotionDetected(zoneName) {
    this.log(`Motion detected in outdoor zone: ${zoneName}`);

    for (const [id, light] of this.outdoorLights) {
      if (light.motionControlled && light.zone.toLowerCase().includes(zoneName)) {
        try {
          if (light.device.hasCapability('onoff')) {
            await light.device.setCapabilityValue('onoff', true);
            light.on = true;
          }

          setTimeout(async () => {
            const hour = new Date().getHours();
            if (hour >= 23 || hour < 6) {
              await light.device.setCapabilityValue('onoff', false);
              light.on = false;
            }
          }, 300000);
        } catch {}
      }
    }
  }

  async triggerSecurityLighting() {
    await this.activateScenario('security_alert');

    try {
      const notificationManager = this.homey.app.advancedNotificationManager;
      if (notificationManager) {
        await notificationManager.sendNotification({
          title: '🚨 Säkerhetsbelysning aktiverad',
          message: 'All utomhusbelysning är nu påslagen',
          priority: 'high',
          category: 'security'
        });
      }
    } catch {}
  }

  getStatistics() {
    return {
      outdoorLights: this.outdoorLights.size,
      lightingZones: this.lightingZones.size,
      scenarios: this.scenarios.size,
      autoMode: this.autoMode,
      motionDetection: this.motionDetection,
      astronomicalData: this.astronomicalData
    };
  }

  log(...args) {
    console.log('[OutdoorLightingScenarios]', ...args);
  }

  error(...args) {
    console.error('[OutdoorLightingScenarios]', ...args);
  }
}

module.exports = OutdoorLightingScenarios;
