'use strict';

/**
 * Advanced Audio/Video Automation
 * Intelligent AV control with scene-based automation and multi-room audio
 */
class AdvancedAVAutomation {
  constructor(homey) {
    this.homey = homey;
    this.avDevices = new Map();
    this.speakers = new Map();
    this.tvs = new Map();
    this.projectors = new Map();
    this.avReceivers = new Map();
    this.avScenes = new Map();
    this.multiRoomGroups = new Map();
    this.playbackHistory = [];
  }

  async initialize() {
    this.log('Initializing Advanced AV Automation...');
    
    await this.discoverAVDevices();
    await this.setupAVScenes();
    await this.loadMultiRoomGroups();
    
    this.log('Advanced AV Automation initialized');
  }

  async discoverAVDevices() {
    const devices = this.homey.drivers.getDevices();
    
    for (const device of devices) {
      const name = device.name.toLowerCase();
      
      if (name.includes('speaker') || name.includes('högtalare')) {
        this.speakers.set(device.id, {
          id: device.id,
          name: device.name,
          device,
          zone: device.zone?.name || 'unknown',
          volume: 50,
          playing: false
        });
      }

      if (name.includes('tv') || name.includes('television')) {
        this.tvs.set(device.id, {
          id: device.id,
          name: device.name,
          device,
          zone: device.zone?.name || 'unknown',
          on: false,
          input: 'hdmi1'
        });
      }

      if (name.includes('projector') || name.includes('projektor')) {
        this.projectors.set(device.id, {
          id: device.id,
          name: device.name,
          device,
          on: false
        });
      }

      if (name.includes('receiver') || name.includes('förstärkare')) {
        this.avReceivers.set(device.id, {
          id: device.id,
          name: device.name,
          device,
          on: false,
          input: 'hdmi1',
          volume: 50
        });
      }
    }

    this.log(`AV devices: ${this.speakers.size} speakers, ${this.tvs.size} TVs, ${this.projectors.size} projectors, ${this.avReceivers.size} receivers`);
  }

  async setupAVScenes() {
    this.avScenes.set('movie', {
      id: 'movie',
      name: 'Movie Time',
      actions: [
        { type: 'lights', brightness: 10 },
        { type: 'tv', state: 'on', input: 'hdmi1' },
        { type: 'receiver', state: 'on', input: 'hdmi1', volume: 60 },
        { type: 'projector', state: 'on' }
      ]
    });

    this.avScenes.set('music', {
      id: 'music',
      name: 'Music Mode',
      actions: [
        { type: 'speakers', state: 'on', volume: 50 },
        { type: 'lights', brightness: 70 }
      ]
    });

    this.avScenes.set('party', {
      id: 'party',
      name: 'Party Mode',
      actions: [
        { type: 'speakers', state: 'on', volume: 70, sync: true },
        { type: 'lights', brightness: 100, color: 'dynamic' }
      ]
    });

    this.avScenes.set('gaming', {
      id: 'gaming',
      name: 'Gaming Mode',
      actions: [
        { type: 'tv', state: 'on', input: 'hdmi2' },
        { type: 'lights', brightness: 30 },
        { type: 'receiver', state: 'on', input: 'hdmi2', volume: 55 }
      ]
    });
  }

  async loadMultiRoomGroups() {
    const saved = await this.homey.settings.get('multiRoomGroups') || {};
    Object.entries(saved).forEach(([id, group]) => {
      this.multiRoomGroups.set(id, group);
    });

    if (this.multiRoomGroups.size === 0) {
      await this.createDefaultGroups();
    }
  }

  async createDefaultGroups() {
    const speakerIds = Array.from(this.speakers.keys());
    
    if (speakerIds.length >= 2) {
      this.multiRoomGroups.set('whole_home', {
        id: 'whole_home',
        name: 'Whole Home',
        speakers: speakerIds,
        synchronized: true
      });
    }

    await this.saveMultiRoomGroups();
  }

  async activateAVScene(sceneId) {
    const scene = this.avScenes.get(sceneId);
    if (!scene) {
      this.error(`AV scene not found: ${sceneId}`);
      return;
    }

    this.log(`Activating AV scene: ${scene.name}`);

    for (const action of scene.actions) {
      try {
        await this.executeAVAction(action);
      } catch (error) {
        this.error(`Failed to execute AV action: ${error.message}`);
      }
    }

    try {
      const notificationManager = this.homey.app.advancedNotificationManager;
      if (notificationManager) {
        await notificationManager.sendNotification({
          title: '🎬 AV-scen aktiverad',
          message: `${scene.name} är nu aktiv`,
          priority: 'low',
          category: 'av'
        });
      }
    } catch {}
  }

  async executeAVAction(action) {
    switch (action.type) {
      case 'tv':
        await this.controlTV(action);
        break;
      case 'projector':
        await this.controlProjector(action);
        break;
      case 'receiver':
        await this.controlReceiver(action);
        break;
      case 'speakers':
        await this.controlSpeakers(action);
        break;
      case 'lights':
        await this.controlLights(action);
        break;
    }
  }

  async controlTV(action) {
    for (const [id, tv] of this.tvs) {
      try {
        if (tv.device.hasCapability('onoff')) {
          await tv.device.setCapabilityValue('onoff', action.state === 'on');
          tv.on = action.state === 'on';
        }

        if (action.input && tv.device.hasCapability('input_source')) {
          await tv.device.setCapabilityValue('input_source', action.input);
          tv.input = action.input;
        }
      } catch {}
    }
  }

  async controlProjector(action) {
    for (const [id, projector] of this.projectors) {
      try {
        if (projector.device.hasCapability('onoff')) {
          await projector.device.setCapabilityValue('onoff', action.state === 'on');
          projector.on = action.state === 'on';
        }
      } catch {}
    }
  }

  async controlReceiver(action) {
    for (const [id, receiver] of this.avReceivers) {
      try {
        if (receiver.device.hasCapability('onoff')) {
          await receiver.device.setCapabilityValue('onoff', action.state === 'on');
          receiver.on = action.state === 'on';
        }

        if (action.volume !== undefined && receiver.device.hasCapability('volume_set')) {
          await receiver.device.setCapabilityValue('volume_set', action.volume / 100);
          receiver.volume = action.volume;
        }

        if (action.input && receiver.device.hasCapability('input_source')) {
          await receiver.device.setCapabilityValue('input_source', action.input);
          receiver.input = action.input;
        }
      } catch {}
    }
  }

  async controlSpeakers(action) {
    if (action.sync) {
      await this.syncAllSpeakers();
    }

    for (const [id, speaker] of this.speakers) {
      try {
        if (speaker.device.hasCapability('onoff')) {
          await speaker.device.setCapabilityValue('onoff', action.state === 'on');
          speaker.playing = action.state === 'on';
        }

        if (action.volume !== undefined && speaker.device.hasCapability('volume_set')) {
          await speaker.device.setCapabilityValue('volume_set', action.volume / 100);
          speaker.volume = action.volume;
        }
      } catch {}
    }
  }

  async controlLights(action) {
    const devices = this.homey.drivers.getDevices();
    
    for (const device of devices) {
      if (device.hasCapability('dim')) {
        try {
          await device.setCapabilityValue('dim', action.brightness / 100);
        } catch {}
      }
    }
  }

  async syncAllSpeakers() {
    this.log('Synchronizing all speakers for multi-room audio');
    
    const speakerIds = Array.from(this.speakers.keys());
    if (speakerIds.length < 2) return;

    for (const [id, speaker] of this.speakers) {
      speaker.synchronized = true;
    }
  }

  async playInMultiRoom(groupId, source) {
    const group = this.multiRoomGroups.get(groupId);
    if (!group) return;

    this.log(`Playing in multi-room group: ${group.name}`);

    for (const speakerId of group.speakers) {
      const speaker = this.speakers.get(speakerId);
      if (!speaker) continue;

      try {
        if (speaker.device.hasCapability('onoff')) {
          await speaker.device.setCapabilityValue('onoff', true);
          speaker.playing = true;
        }

        if (speaker.device.hasCapability('speaker_playing')) {
          await speaker.device.setCapabilityValue('speaker_playing', true);
        }
      } catch {}
    }

    this.playbackHistory.push({
      groupId,
      source,
      timestamp: Date.now(),
      speakers: group.speakers.length
    });
  }

  async stopMultiRoom(groupId) {
    const group = this.multiRoomGroups.get(groupId);
    if (!group) return;

    for (const speakerId of group.speakers) {
      const speaker = this.speakers.get(speakerId);
      if (!speaker) continue;

      try {
        if (speaker.device.hasCapability('onoff')) {
          await speaker.device.setCapabilityValue('onoff', false);
          speaker.playing = false;
        }
      } catch {}
    }
  }

  async setVolumeAll(volume) {
    for (const [id, speaker] of this.speakers) {
      try {
        if (speaker.device.hasCapability('volume_set')) {
          await speaker.device.setCapabilityValue('volume_set', volume / 100);
          speaker.volume = volume;
        }
      } catch {}
    }
  }

  async saveMultiRoomGroups() {
    const groups = {};
    this.multiRoomGroups.forEach((group, id) => {
      groups[id] = group;
    });
    await this.homey.settings.set('multiRoomGroups', groups);
  }

  getStatistics() {
    return {
      speakers: this.speakers.size,
      tvs: this.tvs.size,
      projectors: this.projectors.size,
      receivers: this.avReceivers.size,
      avScenes: this.avScenes.size,
      multiRoomGroups: this.multiRoomGroups.size,
      playbackSessions: this.playbackHistory.length
    };
  }

  log(...args) {
    console.log('[AdvancedAVAutomation]', ...args);
  }

  error(...args) {
    console.error('[AdvancedAVAutomation]', ...args);
  }
}

module.exports = AdvancedAVAutomation;
