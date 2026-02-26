'use strict';

/**
 * Cross-Home Synchronization System
 * Synchronize settings, scenes, and automation across multiple homes
 */
class CrossHomeSynchronizationSystem {
  constructor(homey) {
    this.homey = homey;
    this.homes = new Map();
    this.syncGroups = new Map();
    this.syncHistory = [];
    this.conflictResolutions = new Map();
  }

  async initialize() {
    try {
      this.log('Initializing Cross-Home Synchronization System...');

      // Load homes
      const savedHomes = await this.homey.settings.get('homes') || {};
      Object.entries(savedHomes).forEach(([id, home]) => {
        this.homes.set(id, home);
      });

      // Load sync groups
      const savedGroups = await this.homey.settings.get('syncGroups') || {};
      Object.entries(savedGroups).forEach(([id, group]) => {
        this.syncGroups.set(id, group);
      });

      // Register current home
      await this.registerCurrentHome();

      // Setup default sync groups
      await this.setupDefaultSyncGroups();

      this.log('Cross-Home Synchronization System initialized');
    } catch (error) {
      console.error(`[CrossHomeSynchronizationSystem] Failed to initialize:`, error.message);
    }
  }

  /**
   * Register current home
   */
  async registerCurrentHome() {
    const currentHome = {
      id: 'home_primary',
      name: await this.homey.settings.get('homeName') || 'Main Home',
      type: 'primary',
      registered: Date.now(),
      lastSync: null,
      devices: await this.getDeviceCount(),
      settings: await this.collectHomeSettings()
    };

    this.homes.set(currentHome.id, currentHome);
    await this.saveHomes();
  }

  /**
   * Get device count
   */
  async getDeviceCount() {
    const devices = this.homey.drivers.getDevices();
    return devices.length;
  }

  /**
   * Collect home settings
   */
  async collectHomeSettings() {
    return {
      language: 'sv',
      timezone: 'Europe/Stockholm',
      units: {
        temperature: 'celsius',
        distance: 'metric'
      }
    };
  }

  /**
   * Setup default sync groups
   */
  async setupDefaultSyncGroups() {
    const defaultGroups = [
      {
        id: 'scenes_sync',
        name: 'Scene Synchronization',
        description: 'Sync scenes across all homes',
        type: 'scenes',
        autoSync: true,
        syncInterval: 3600000, // 1 hour
        enabled: true,
        homes: ['home_primary']
      },
      {
        id: 'settings_sync',
        name: 'Settings Synchronization',
        description: 'Sync general settings',
        type: 'settings',
        autoSync: true,
        syncInterval: 86400000, // 24 hours
        enabled: true,
        homes: ['home_primary']
      },
      {
        id: 'automations_sync',
        name: 'Automation Synchronization',
        description: 'Sync automation rules',
        type: 'automations',
        autoSync: false,
        syncInterval: 3600000,
        enabled: true,
        homes: ['home_primary']
      },
      {
        id: 'users_sync',
        name: 'User Preferences Sync',
        description: 'Sync user preferences and profiles',
        type: 'users',
        autoSync: true,
        syncInterval: 1800000, // 30 minutes
        enabled: true,
        homes: ['home_primary']
      }
    ];

    for (const group of defaultGroups) {
      if (!this.syncGroups.has(group.id)) {
        this.syncGroups.set(group.id, group);
      }
    }

    await this.saveSyncGroups();
  }

  /**
   * Add home to sync network
   */
  async addHome(homeData) {
    const homeId = `home_${Date.now()}`;
    
    const home = {
      id: homeId,
      name: homeData.name,
      type: 'secondary',
      registered: Date.now(),
      lastSync: null,
      connection: {
        url: homeData.url || null,
        token: homeData.token || null,
        status: 'pending'
      },
      devices: 0,
      settings: homeData.settings || {}
    };

    this.homes.set(homeId, home);
    await this.saveHomes();

    this.log(`Added home: ${home.name}`);

    // Test connection
    await this.testHomeConnection(homeId);

    return home;
  }

  /**
   * Test home connection
   */
  async testHomeConnection(homeId) {
    const home = this.homes.get(homeId);
    if (!home) return false;

    try {
      // Mock connection test (would implement real API call)
      home.connection.status = 'connected';
      home.connection.lastTest = Date.now();
      
      await this.saveHomes();
      
      this.log(`Connection test successful: ${home.name}`);
      return true;
    } catch (error) {
      home.connection.status = 'failed';
      this.error(`Connection test failed for ${home.name}:`, error);
      return false;
    }
  }

  /**
   * Sync specific data type
   */
  async syncData(groupId, homeIds = null) {
    const group = this.syncGroups.get(groupId);
    if (!group || !group.enabled) {
      throw new Error(`Sync group not found or disabled: ${groupId}`);
    }

    const targetHomes = homeIds || group.homes;
    
    this.log(`Starting sync: ${group.name} to ${targetHomes.length} homes`);

    const syncResults = {
      groupId,
      started: Date.now(),
      completed: null,
      results: []
    };

    // Collect data from primary home
    const data = await this.collectDataForSync(group.type);

    // Sync to each home
    for (const homeId of targetHomes) {
      const home = this.homes.get(homeId);
      if (!home) continue;

      try {
        const result = await this.syncToHome(home, group.type, data);
        syncResults.results.push({
          homeId,
          homeName: home.name,
          success: result.success,
          itemsSynced: result.itemsSynced,
          conflicts: result.conflicts
        });

        home.lastSync = Date.now();
      } catch (error) {
        this.error(`Failed to sync to ${home.name}:`, error);
        syncResults.results.push({
          homeId,
          homeName: home.name,
          success: false,
          error: error.message
        });
      }
    }

    syncResults.completed = Date.now();
    group.lastSync = Date.now();

    // Record history
    this.syncHistory.push(syncResults);
    
    // Keep only last 100 sync records
    if (this.syncHistory.length > 100) {
      this.syncHistory.shift();
    }

    await this.saveHomes();
    await this.saveSyncGroups();

    this.log(`Sync completed: ${group.name}`);

    return syncResults;
  }

  /**
   * Collect data for sync
   */
  async collectDataForSync(dataType) {
    const data = {
      type: dataType,
      timestamp: Date.now(),
      items: []
    };

    switch (dataType) {
      case 'scenes':
        data.items = await this.collectScenes();
        break;

      case 'settings':
        data.items = await this.collectSettings();
        break;

      case 'automations':
        data.items = await this.collectAutomations();
        break;

      case 'users':
        data.items = await this.collectUserPreferences();
        break;

      default:
        throw new Error(`Unknown data type: ${dataType}`);
    }

    return data;
  }

  /**
   * Collect scenes
   */
  async collectScenes() {
    const scenes = [];
    
    try {
      const sceneTemplateSystem = this.homey.app.advancedSceneTemplateSystem;
      if (sceneTemplateSystem) {
        const customScenes = await this.homey.settings.get('customScenes') || {};
        
        for (const [_id, scene] of Object.entries(customScenes)) {
          scenes.push({
            id: scene.id,
            name: scene.name,
            category: scene.category,
            description: scene.description,
            actions: scene.actions,
            templateId: scene.templateId
          });
        }
      }
    } catch (error) {
      this.error('Failed to collect scenes:', error);
    }

    return scenes;
  }

  /**
   * Collect settings
   */
  async collectSettings() {
    const settings = [];

    // Collect relevant settings
    const settingKeys = [
      'energyStrategy',
      'notificationPreferences',
      'climatePreferences',
      'voiceControlSettings',
      'securitySettings'
    ];

    for (const key of settingKeys) {
      try {
        const value = await this.homey.settings.get(key);
        if (value !== null) {
          settings.push({
            key,
            value
          });
        }
      } catch {}
    }

    return settings;
  }

  /**
   * Collect automations
   */
  async collectAutomations() {
    const automations = [];

    try {
      const automationEngine = this.homey.app.advancedAutomationEngine;
      if (automationEngine) {
        const rules = await this.homey.settings.get('automationRules') || {};
        
        for (const [_id, rule] of Object.entries(rules)) {
          automations.push({
            id: rule.id,
            name: rule.name,
            triggers: rule.triggers,
            conditions: rule.conditions,
            actions: rule.actions,
            enabled: rule.enabled
          });
        }
      }
    } catch (error) {
      this.error('Failed to collect automations:', error);
    }

    return automations;
  }

  /**
   * Collect user preferences
   */
  async collectUserPreferences() {
    const users = [];

    try {
      const multiUserSystem = this.homey.app.multiUserPreferenceSystem;
      if (multiUserSystem) {
        const preferences = await this.homey.settings.get('userPreferences') || {};
        
        for (const [userId, prefs] of Object.entries(preferences)) {
          users.push({
            userId,
            preferences: prefs
          });
        }
      }
    } catch (error) {
      this.error('Failed to collect user preferences:', error);
    }

    return users;
  }

  /**
   * Sync to specific home
   */
  async syncToHome(home, dataType, data) {
    const result = {
      success: false,
      itemsSynced: 0,
      conflicts: []
    };

    // Check connection
    if (home.connection.status !== 'connected') {
      const connected = await this.testHomeConnection(home.id);
      if (!connected) {
        throw new Error('Home not connected');
      }
    }

    // For primary home, just update local data
    if (home.id === 'home_primary') {
      result.success = await this.applyDataLocally(dataType, data);
      result.itemsSynced = data.items.length;
      return result;
    }

    // For remote homes, send via API (mock implementation)
    try {
      // Mock API call
      this.log(`Syncing ${data.items.length} ${dataType} items to ${home.name}`);
      
      result.success = true;
      result.itemsSynced = data.items.length;
      
      // Simulate some conflicts
      if (Math.random() < 0.1) {
        result.conflicts.push({
          item: data.items[0],
          reason: 'Item already exists with different data',
          resolution: 'use_source'
        });
      }
    } catch (error) {
      throw new Error(`Failed to sync to ${home.name}: ${error.message}`);
    }

    return result;
  }

  /**
   * Apply data locally
   */
  async applyDataLocally(dataType, data) {
    try {
      switch (dataType) {
        case 'scenes':
          await this.applyScenes(data.items);
          break;

        case 'settings':
          await this.applySettings(data.items);
          break;

        case 'automations':
          await this.applyAutomations(data.items);
          break;

        case 'users':
          await this.applyUserPreferences(data.items);
          break;
      }

      return true;
    } catch (error) {
      this.error(`Failed to apply ${dataType}:`, error);
      return false;
    }
  }

  /**
   * Apply scenes
   */
  async applyScenes(scenes) {
    const customScenes = {};
    
    for (const scene of scenes) {
      customScenes[scene.id] = scene;
    }

    await this.homey.settings.set('customScenes', customScenes);
  }

  /**
   * Apply settings
   */
  async applySettings(settings) {
    for (const setting of settings) {
      await this.homey.settings.set(setting.key, setting.value);
    }
  }

  /**
   * Apply automations
   */
  async applyAutomations(automations) {
    const rules = {};
    
    for (const automation of automations) {
      rules[automation.id] = automation;
    }

    await this.homey.settings.set('automationRules', rules);
  }

  /**
   * Apply user preferences
   */
  async applyUserPreferences(users) {
    const preferences = {};
    
    for (const user of users) {
      preferences[user.userId] = user.preferences;
    }

    await this.homey.settings.set('userPreferences', preferences);
  }

  /**
   * Enable auto-sync for group
   */
  async enableAutoSync(groupId) {
    const group = this.syncGroups.get(groupId);
    if (!group) {
      throw new Error(`Sync group not found: ${groupId}`);
    }

    group.autoSync = true;
    
    // Start auto-sync interval
    if (group.syncInterval) {
      group.intervalId = setInterval(async () => {
        try {
          await this.syncData(groupId);
        } catch (error) {
          this.error(`Auto-sync failed for ${group.name}:`, error);
        }
      }, group.syncInterval);
    }

    await this.saveSyncGroups();
    
    this.log(`Auto-sync enabled for: ${group.name}`);
  }

  /**
   * Disable auto-sync for group
   */
  async disableAutoSync(groupId) {
    const group = this.syncGroups.get(groupId);
    if (!group) {
      throw new Error(`Sync group not found: ${groupId}`);
    }

    group.autoSync = false;
    
    // Stop auto-sync interval
    if (group.intervalId) {
      clearInterval(group.intervalId);
      delete group.intervalId;
    }

    await this.saveSyncGroups();
    
    this.log(`Auto-sync disabled for: ${group.name}`);
  }

  /**
   * Resolve sync conflict
   */
  async resolveConflict(conflictId, resolution) {
    const validResolutions = ['use_source', 'use_target', 'merge', 'skip'];
    
    if (!validResolutions.includes(resolution)) {
      throw new Error(`Invalid resolution: ${resolution}`);
    }

    this.conflictResolutions.set(conflictId, {
      resolution,
      timestamp: Date.now()
    });

    this.log(`Conflict ${conflictId} resolved: ${resolution}`);
  }

  /**
   * Get sync status
   */
  getSyncStatus() {
    const status = {
      homes: Array.from(this.homes.values()).map(home => ({
        id: home.id,
        name: home.name,
        type: home.type,
        connected: home.connection?.status === 'connected',
        lastSync: home.lastSync,
        devices: home.devices
      })),
      syncGroups: Array.from(this.syncGroups.values()).map(group => ({
        id: group.id,
        name: group.name,
        type: group.type,
        enabled: group.enabled,
        autoSync: group.autoSync,
        lastSync: group.lastSync
      })),
      recentSyncs: this.syncHistory.slice(-10),
      pendingConflicts: this.conflictResolutions.size
    };

    return status;
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const totalSyncs = this.syncHistory.length;
    const successfulSyncs = this.syncHistory.filter(s => 
      s.results.every(r => r.success)
    ).length;

    return {
      homes: this.homes.size,
      syncGroups: this.syncGroups.size,
      totalSyncs,
      successfulSyncs,
      successRate: totalSyncs > 0 ? (successfulSyncs / totalSyncs * 100).toFixed(1) : 0,
      recentSyncs: this.syncHistory.slice(-10),
      syncStatus: this.getSyncStatus()
    };
  }

  async saveHomes() {
    const data = {};
    this.homes.forEach((home, id) => {
      data[id] = home;
    });
    await this.homey.settings.set('homes', data);
  }

  async saveSyncGroups() {
    const data = {};
    this.syncGroups.forEach((group, id) => {
      data[id] = group;
    });
    await this.homey.settings.set('syncGroups', data);
  }

  log(...args) {
    console.log('[CrossHomeSynchronizationSystem]', ...args);
  }

  error(...args) {
    console.error('[CrossHomeSynchronizationSystem]', ...args);
  }
}

module.exports = CrossHomeSynchronizationSystem;
