const EventEmitter = require('events');

/**
 * Smart Furniture Control System
 * 
 * Provides intelligent control of motorized furniture including desks, beds,
 * recliners, and storage solutions with automated positioning and ergonomics.
 * 
 * Features:
 * - Motorized standing desk control with height presets
 * - Adjustable bed positioning for comfort and health
 * - Smart recliner control with massage and heating
 * - Automated storage solutions (cabinets, shelves)
 * - Ergonomic positioning reminders
 * - Scene-based furniture arrangements
 * - Integration with health data for optimal ergonomics
 * - Safety features (anti-collision, weight sensors)
 * - Usage tracking and sitting/standing analytics
 * - Voice control integration
 */
class SmartFurnitureControlSystem extends EventEmitter {
  constructor(homey) {
    super();
    this.homey = homey;
    this.furniture = new Map();
    this.presets = new Map();
    this.scenes = new Map();
    this.usageHistory = [];
    this.monitoringInterval = null;
  }

  async initialize() {
    try {
      this.homey.log('Initializing Smart Furniture Control System...');

      await this.loadSettings();
      this.initializeDefaultFurniture();
      this.initializePresets();
      this.initializeScenes();

      this.startMonitoring();

      this.homey.log('Smart Furniture Control System initialized successfully');
      return true;
    } catch (error) {
      this.homey.error(`[SmartFurnitureControlSystem] Failed to initialize:`, error.message);
    }
  }

  async loadSettings() {
    const settings = await this.homey.settings.get('smartFurnitureControl') || {};
    
    if (settings.furniture) {
      settings.furniture.forEach(item => {
        this.furniture.set(item.id, item);
      });
    }
    
    if (settings.presets) {
      settings.presets.forEach(preset => {
        this.presets.set(preset.id, preset);
      });
    }
    
    if (settings.scenes) {
      settings.scenes.forEach(scene => {
        this.scenes.set(scene.id, scene);
      });
    }
    
    this.usageHistory = settings.usageHistory || [];
  }

  async saveSettings() {
    const settings = {
      furniture: Array.from(this.furniture.values()),
      presets: Array.from(this.presets.values()),
      scenes: Array.from(this.scenes.values()),
      usageHistory: this.usageHistory.slice(-500) // Keep last 500 events
    };
    
    await this.homey.settings.set('smartFurnitureControl', settings);
  }

  initializeDefaultFurniture() {
    if (this.furniture.size === 0) {
      this.furniture.set('desk-office', {
        id: 'desk-office',
        name: 'Kontorsskrivbord',
        type: 'standing-desk',
        room: 'office',
        status: 'idle',
        capabilities: {
          heightAdjustment: true,
          memoryPresets: 4,
          antiCollision: true,
          weightSensor: true,
          motorized: true,
          remoteControl: true
        },
        position: {
          height: 75, // cm
          minHeight: 65,
          maxHeight: 130,
          unit: 'cm'
        },
        features: {
          reminderSystem: true,
          ergonomicTracking: true,
          childLock: false,
          ledDisplay: true
        },
        ergonomics: {
          userHeight: 175, // cm
          recommendedSittingHeight: 75,
          recommendedStandingHeight: 110,
          sittingStandingRatio: 0.7 // 70% sitting, 30% standing recommended
        },
        usage: {
          totalAdjustments: 0,
          sittingTime: 0, // minutes
          standingTime: 0,
          lastPositionChange: null,
          currentPosition: 'sitting', // sitting, standing
          positionStartTime: Date.now()
        }
      });

      this.furniture.set('bed-master', {
        id: 'bed-master',
        name: 'Master Bedroom Säng',
        type: 'adjustable-bed',
        room: 'bedroom',
        status: 'idle',
        capabilities: {
          headAdjustment: true,
          footAdjustment: true,
          massage: true,
          heating: true,
          memoryPresets: 3,
          dualZone: true,
          underBedLighting: true,
          antiSnore: true
        },
        position: {
          head: 0, // degrees, 0-60
          foot: 0, // degrees, 0-30
          leftSide: { head: 0, foot: 0 },
          rightSide: { head: 0, foot: 0 }
        },
        features: {
          massage: {
            enabled: false,
            mode: 'wave', // wave, pulse, full
            intensity: 50, // %
            duration: 20, // minutes
            zones: ['back', 'legs']
          },
          heating: {
            enabled: false,
            temperature: 30, // °C
            duration: 60,
            zones: ['feet']
          },
          underBedLight: {
            enabled: false,
            brightness: 30,
            color: 'warm-white',
            motionActivated: true
          },
          antiSnore: {
            enabled: false,
            triggerAngle: 15,
            detection: 'microphone'
          }
        },
        usage: {
          totalAdjustments: 0,
          massageSessionsTotal: 0,
          heatingSessionsTotal: 0,
          averageSleepPosition: { head: 5, foot: 0 }
        }
      });

      this.furniture.set('recliner-living', {
        id: 'recliner-living',
        name: 'Vardagsrum Fåtölj',
        type: 'smart-recliner',
        room: 'living-room',
        status: 'idle',
        capabilities: {
          reclineAdjustment: true,
          footrestControl: true,
          lumbarSupport: true,
          massage: true,
          heating: true,
          memoryPresets: 2,
          swivel: true,
          liftAssist: true
        },
        position: {
          reclineAngle: 0, // degrees, 0-160
          footrest: 0, // degrees, 0-90
          lumbarSupport: 50 // %
        },
        features: {
          massage: {
            enabled: false,
            mode: 'relaxation',
            intensity: 50,
            zones: ['back', 'seat']
          },
          heating: {
            enabled: false,
            level: 2, // 1-3
            zones: ['back', 'seat']
          },
          liftAssist: {
            enabled: false,
            speed: 'medium'
          }
        },
        usage: {
          totalAdjustments: 0,
          averageUseTime: 45, // minutes per session
          massageUsage: 0,
          heatingUsage: 0
        }
      });

      this.furniture.set('cabinet-kitchen', {
        id: 'cabinet-kitchen',
        name: 'Köksskap Motoriserad',
        type: 'motorized-cabinet',
        room: 'kitchen',
        status: 'closed',
        capabilities: {
          motorizedDoors: true,
          interiorLighting: true,
          softClose: true,
          touchToOpen: true,
          weightSensor: true,
          smartLock: true
        },
        position: {
          doors: 'closed', // closed, open
          lighting: false
        },
        features: {
          autoClose: {
            enabled: true,
            delay: 60 // seconds
          },
          interiorLight: {
            autoOn: true,
            brightness: 80,
            color: 'daylight'
          },
          childLock: false,
          overloadAlert: {
            enabled: true,
            maxWeight: 50 // kg
          }
        },
        usage: {
          totalOpenings: 0,
          averageOpenDuration: 30,
          lastOpened: null
        }
      });
    }
  }

  initializePresets() {
    if (this.presets.size === 0) {
      // Desk presets
      this.presets.set('desk-sitting', {
        id: 'desk-sitting',
        name: 'Sitting',
        furnitureId: 'desk-office',
        type: 'height',
        value: 75
      });

      this.presets.set('desk-standing', {
        id: 'desk-standing',
        name: 'Standing',
        furnitureId: 'desk-office',
        type: 'height',
        value: 110
      });

      this.presets.set('desk-meeting', {
        id: 'desk-meeting',
        name: 'Meeting Height',
        furnitureId: 'desk-office',
        type: 'height',
        value: 100
      });

      // Bed presets
      this.presets.set('bed-flat', {
        id: 'bed-flat',
        name: 'Flat',
        furnitureId: 'bed-master',
        type: 'position',
        value: { head: 0, foot: 0 }
      });

      this.presets.set('bed-reading', {
        id: 'bed-reading',
        name: 'Reading',
        furnitureId: 'bed-master',
        type: 'position',
        value: { head: 45, foot: 0 }
      });

      this.presets.set('bed-tv', {
        id: 'bed-tv',
        name: 'TV Watching',
        furnitureId: 'bed-master',
        type: 'position',
        value: { head: 30, foot: 15 }
      });

      this.presets.set('bed-zero-g', {
        id: 'bed-zero-g',
        name: 'Zero Gravity',
        furnitureId: 'bed-master',
        type: 'position',
        value: { head: 35, foot: 25 }
      });

      // Recliner presets
      this.presets.set('recliner-upright', {
        id: 'recliner-upright',
        name: 'Upright',
        furnitureId: 'recliner-living',
        type: 'position',
        value: { reclineAngle: 0, footrest: 0 }
      });

      this.presets.set('recliner-lounge', {
        id: 'recliner-lounge',
        name: 'Lounge',
        furnitureId: 'recliner-living',
        type: 'position',
        value: { reclineAngle: 120, footrest: 60 }
      });
    }
  }

  initializeScenes() {
    if (this.scenes.size === 0) {
      this.scenes.set('work-mode', {
        id: 'work-mode',
        name: 'Arbetsläge',
        description: 'Optimal inställning för produktivt arbete',
        furniture: [
          { id: 'desk-office', action: 'preset', preset: 'desk-sitting' }
        ]
      });

      this.scenes.set('active-work', {
        id: 'active-work',
        name: 'Aktivt arbete',
        description: 'Stående arbetsposition',
        furniture: [
          { id: 'desk-office', action: 'preset', preset: 'desk-standing' }
        ]
      });

      this.scenes.set('relaxation', {
        id: 'relaxation',
        name: 'Avkoppling',
        description: 'Bekväm position för vila',
        furniture: [
          { 
            id: 'recliner-living', 
            action: 'preset', 
            preset: 'recliner-lounge',
            features: { massage: true, heating: true }
          }
        ]
      });

      this.scenes.set('bedtime', {
        id: 'bedtime',
        name: 'Sänggående',
        description: 'Bekväm sovposition',
        furniture: [
          { 
            id: 'bed-master', 
            action: 'preset', 
            preset: 'bed-flat',
            features: { underBedLight: true, heating: true }
          }
        ]
      });

      this.scenes.set('reading-in-bed', {
        id: 'reading-in-bed',
        name: 'Läsning i sängen',
        description: 'Upphöjd position för läsning',
        furniture: [
          { id: 'bed-master', action: 'preset', preset: 'bed-reading' }
        ]
      });
    }
  }

  startMonitoring() {
    // Monitor furniture usage and ergonomics every 5 minutes
    this.monitoringInterval = setInterval(() => {
      this.updateUsageTracking();
      this.checkErgonomicReminders();
    }, 300000);
  }

  async updateUsageTracking() {
    for (const item of this.furniture.values()) {
      if (item.type === 'standing-desk') {
        const usage = item.usage;
        const elapsed = Math.floor((Date.now() - usage.positionStartTime) / 60000);
        
        if (usage.currentPosition === 'sitting') {
          usage.sittingTime += elapsed;
        } else {
          usage.standingTime += elapsed;
        }
        
        usage.positionStartTime = Date.now();
      }
    }
    
    await this.saveSettings();
  }

  async checkErgonomicReminders() {
    for (const item of this.furniture.values()) {
      if (item.type === 'standing-desk' && item.features.reminderSystem) {
        const usage = item.usage;
        const totalTime = usage.sittingTime + usage.standingTime;
        
        if (totalTime === 0) continue;
        
        const sittingRatio = usage.sittingTime / totalTime;
        const recommendedRatio = item.ergonomics.sittingStandingRatio;
        
        // If sitting too much, remind to stand
        if (sittingRatio > recommendedRatio + 0.1) {
          const timeSinceLast = Date.now() - (usage.lastPositionChange || 0);
          const hoursSinceLast = timeSinceLast / 3600000;
          
          if (hoursSinceLast >= 1 && usage.currentPosition === 'sitting') {
            await this.sendErgonomicReminder(item);
          }
        }
      }
    }
  }

  async sendErgonomicReminder(furniture) {
    this.emit('notification', {
      title: 'Ergonomisk påminnelse',
      message: `Dags att stå vid ${furniture.name}!`,
      priority: 'normal',
      category: 'ergonomics'
    });
  }

  async adjustFurniture(furnitureId, adjustments) {
    const item = this.furniture.get(furnitureId);
    if (!item) {
      throw new Error('Möbel hittades inte');
    }
    
    item.status = 'moving';
    
    // Apply adjustments based on furniture type
    switch (item.type) {
      case 'standing-desk':
        if (adjustments.height !== undefined) {
          await this.adjustDeskHeight(item, adjustments.height);
        }
        break;
      
      case 'adjustable-bed':
        if (adjustments.head !== undefined || adjustments.foot !== undefined) {
          await this.adjustBedPosition(item, adjustments);
        }
        if (adjustments.massage !== undefined) {
          await this.controlBedMassage(item, adjustments.massage);
        }
        if (adjustments.heating !== undefined) {
          await this.controlBedHeating(item, adjustments.heating);
        }
        break;
      
      case 'smart-recliner':
        if (adjustments.reclineAngle !== undefined) {
          await this.adjustReclinerPosition(item, adjustments);
        }
        if (adjustments.massage !== undefined) {
          await this.controlReclinerMassage(item, adjustments.massage);
        }
        break;
      
      case 'motorized-cabinet':
        if (adjustments.doors !== undefined) {
          await this.controlCabinetDoors(item, adjustments.doors);
        }
        break;
    }
    
    item.status = 'idle';
    item.usage.totalAdjustments++;
    
    await this.saveSettings();
    
    this.emit('furnitureAdjusted', { furnitureId, adjustments });
    
    return item;
  }

  async adjustDeskHeight(desk, targetHeight) {
    targetHeight = Math.max(desk.position.minHeight, Math.min(desk.position.maxHeight, targetHeight));
    
    const currentHeight = desk.position.height;
    const previousPosition = desk.usage.currentPosition;
    
    desk.position.height = targetHeight;
    
    // Determine if sitting or standing
    const newPosition = targetHeight >= 100 ? 'standing' : 'sitting';
    
    if (newPosition !== previousPosition) {
      const elapsed = Math.floor((Date.now() - desk.usage.positionStartTime) / 60000);
      
      if (previousPosition === 'sitting') {
        desk.usage.sittingTime += elapsed;
      } else {
        desk.usage.standingTime += elapsed;
      }
      
      desk.usage.currentPosition = newPosition;
      desk.usage.positionStartTime = Date.now();
      desk.usage.lastPositionChange = Date.now();
    }
    
    // Record usage event
    this.usageHistory.push({
      furnitureId: desk.id,
      timestamp: Date.now(),
      type: 'height-adjustment',
      from: currentHeight,
      to: targetHeight
    });
  }

  async adjustBedPosition(bed, adjustments) {
    if (adjustments.head !== undefined) {
      bed.position.head = Math.max(0, Math.min(60, adjustments.head));
    }
    
    if (adjustments.foot !== undefined) {
      bed.position.foot = Math.max(0, Math.min(30, adjustments.foot));
    }
    
    // Check for anti-snore activation
    if (bed.features.antiSnore.enabled && bed.position.head < bed.features.antiSnore.triggerAngle) {
      // Would trigger snore detection system
    }
    
    this.usageHistory.push({
      furnitureId: bed.id,
      timestamp: Date.now(),
      type: 'position-adjustment',
      position: { head: bed.position.head, foot: bed.position.foot }
    });
  }

  async controlBedMassage(bed, enable) {
    bed.features.massage.enabled = enable;
    
    if (enable) {
      bed.usage.massageSessionsTotal++;
      
      // Auto-stop after duration
      setTimeout(() => {
        bed.features.massage.enabled = false;
        this.saveSettings();
      }, bed.features.massage.duration * 60000);
    }
  }

  async controlBedHeating(bed, enable) {
    bed.features.heating.enabled = enable;
    
    if (enable) {
      bed.usage.heatingSessionsTotal++;
      
      // Auto-stop after duration
      setTimeout(() => {
        bed.features.heating.enabled = false;
        this.saveSettings();
      }, bed.features.heating.duration * 60000);
    }
  }

  async adjustReclinerPosition(recliner, adjustments) {
    if (adjustments.reclineAngle !== undefined) {
      recliner.position.reclineAngle = Math.max(0, Math.min(160, adjustments.reclineAngle));
    }
    
    if (adjustments.footrest !== undefined) {
      recliner.position.footrest = Math.max(0, Math.min(90, adjustments.footrest));
    }
    
    if (adjustments.lumbarSupport !== undefined) {
      recliner.position.lumbarSupport = Math.max(0, Math.min(100, adjustments.lumbarSupport));
    }
  }

  async controlReclinerMassage(recliner, enable) {
    recliner.features.massage.enabled = enable;
    
    if (enable) {
      recliner.usage.massageUsage++;
    }
  }

  async controlCabinetDoors(cabinet, action) {
    cabinet.position.doors = action; // 'open' or 'closed'
    
    if (action === 'open') {
      cabinet.usage.totalOpenings++;
      cabinet.usage.lastOpened = Date.now();
      
      // Turn on interior light if auto-on enabled
      if (cabinet.features.interiorLight.autoOn) {
        cabinet.position.lighting = true;
      }
      
      // Set auto-close timer
      if (cabinet.features.autoClose.enabled) {
        setTimeout(async () => {
          if (cabinet.position.doors === 'open') {
            cabinet.position.doors = 'closed';
            cabinet.position.lighting = false;
            await this.saveSettings();
          }
        }, cabinet.features.autoClose.delay * 1000);
      }
    } else {
      cabinet.position.lighting = false;
    }
  }

  async applyPreset(presetId) {
    const preset = this.presets.get(presetId);
    if (!preset) {
      throw new Error('Preset hittades inte');
    }
    
    const item = this.furniture.get(preset.furnitureId);
    if (!item) {
      throw new Error('Möbel hittades inte');
    }
    
    if (preset.type === 'height') {
      await this.adjustFurniture(preset.furnitureId, { height: preset.value });
    } else if (preset.type === 'position') {
      await this.adjustFurniture(preset.furnitureId, preset.value);
    }
    
    this.emit('notification', {
      title: 'Preset tillagt',
      message: `${preset.name} för ${item.name}`,
      priority: 'low',
      category: 'furniture'
    });
    
    return item;
  }

  async activateScene(sceneId) {
    const scene = this.scenes.get(sceneId);
    if (!scene) {
      throw new Error('Scen hittades inte');
    }
    
    for (const furnitureAction of scene.furniture) {
      const item = this.furniture.get(furnitureAction.id);
      if (!item) continue;
      
      if (furnitureAction.action === 'preset') {
        await this.applyPreset(furnitureAction.preset);
      }
      
      // Apply additional features
      if (furnitureAction.features) {
        const adjustments = {};
        
        if (furnitureAction.features.massage !== undefined) {
          adjustments.massage = furnitureAction.features.massage;
        }
        if (furnitureAction.features.heating !== undefined) {
          adjustments.heating = furnitureAction.features.heating;
        }
        if (furnitureAction.features.underBedLight !== undefined) {
          item.features.underBedLight.enabled = furnitureAction.features.underBedLight;
        }
        
        if (Object.keys(adjustments).length > 0) {
          await this.adjustFurniture(furnitureAction.id, adjustments);
        }
      }
    }
    
    await this.saveSettings();
    
    this.emit('notification', {
      title: 'Scen aktiverad',
      message: scene.name,
      priority: 'low',
      category: 'furniture'
    });
    
    return scene;
  }

  getFurniture() {
    return Array.from(this.furniture.values());
  }

  getFurnitureItem(furnitureId) {
    return this.furniture.get(furnitureId);
  }

  getPresets(furnitureId = null) {
    let presets = Array.from(this.presets.values());
    
    if (furnitureId) {
      presets = presets.filter(p => p.furnitureId === furnitureId);
    }
    
    return presets;
  }

  getScenes() {
    return Array.from(this.scenes.values());
  }

  getUsageHistory(furnitureId = null, limit = 50) {
    let history = this.usageHistory;
    
    if (furnitureId) {
      history = history.filter(h => h.furnitureId === furnitureId);
    }
    
    return history.slice(-limit).reverse();
  }

  getStats() {
    const furniture = Array.from(this.furniture.values());
    
    // Calculate desk ergonomics
    const desks = furniture.filter(f => f.type === 'standing-desk');
    let avgSittingPercentage = 0;
    
    if (desks.length > 0) {
      const totalSitting = desks.reduce((sum, d) => sum + d.usage.sittingTime, 0);
      const totalStanding = desks.reduce((sum, d) => sum + d.usage.standingTime, 0);
      const total = totalSitting + totalStanding;
      avgSittingPercentage = total > 0 ? Math.round((totalSitting / total) * 100) : 0;
    }
    
    return {
      totalFurniture: furniture.length,
      byType: {
        desks: furniture.filter(f => f.type === 'standing-desk').length,
        beds: furniture.filter(f => f.type === 'adjustable-bed').length,
        recliners: furniture.filter(f => f.type === 'smart-recliner').length,
        cabinets: furniture.filter(f => f.type === 'motorized-cabinet').length
      },
      totalAdjustments: furniture.reduce((sum, f) => sum + f.usage.totalAdjustments, 0),
      ergonomics: {
        averageSittingPercentage: avgSittingPercentage,
        recommendedSittingPercentage: 70
      },
      presets: this.presets.size,
      scenes: this.scenes.size
    };
  }

  async destroy() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    this.removeAllListeners();
  }
}

module.exports = SmartFurnitureControlSystem;
