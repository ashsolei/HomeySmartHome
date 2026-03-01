'use strict';

const crypto = require('crypto');

class MultiHomeManager {
  constructor(homey) {
    this.homey = homey;
    this.homes = new Map();
    this.activeHomeId = null;
  }

  async initialize() {
    // Create a default home entry
    const defaultHome = {
      id: 'home-default',
      name: 'Primary Home',
      ownerId: 'default-owner',
      location: { lat: 59.3293, lng: 18.0686, address: 'Stockholm, Sweden' },
      devices: [],
      automations: [],
      timezone: 'Europe/Stockholm',
      createdAt: new Date().toISOString()
    };
    this.homes.set(defaultHome.id, defaultHome);
    this.activeHomeId = defaultHome.id;
  }

  createHome(config) {
    if (!config || !config.name) {
      throw Object.assign(new Error('Home name is required'), { statusCode: 400 });
    }
    const id = `home-${crypto.randomBytes(8).toString('hex')}`;
    const home = {
      id,
      name: config.name,
      ownerId: config.ownerId || 'default-owner',
      location: config.location || null,
      devices: config.devices || [],
      automations: config.automations || [],
      timezone: config.timezone || 'Europe/Stockholm',
      createdAt: new Date().toISOString()
    };
    this.homes.set(id, home);
    return home;
  }

  getHome(id) {
    const home = this.homes.get(id);
    if (!home) {
      throw Object.assign(new Error(`Home not found: ${id}`), { statusCode: 404 });
    }
    return home;
  }

  listHomes(ownerId) {
    const all = Array.from(this.homes.values());
    if (ownerId) {
      return all.filter(h => h.ownerId === ownerId);
    }
    return all;
  }

  updateHome(id, updates) {
    const home = this.getHome(id);
    const allowed = ['name', 'location', 'devices', 'automations', 'timezone'];
    for (const key of allowed) {
      if (updates[key] !== undefined) {
        home[key] = updates[key];
      }
    }
    home.updatedAt = new Date().toISOString();
    this.homes.set(id, home);
    return home;
  }

  deleteHome(id) {
    if (!this.homes.has(id)) {
      throw Object.assign(new Error(`Home not found: ${id}`), { statusCode: 404 });
    }
    if (this.activeHomeId === id) {
      this.activeHomeId = null;
    }
    this.homes.delete(id);
    return { success: true, id };
  }

  switchActiveHome(id) {
    if (!this.homes.has(id)) {
      throw Object.assign(new Error(`Home not found: ${id}`), { statusCode: 404 });
    }
    this.activeHomeId = id;
    return this.homes.get(id);
  }

  getActiveHome() {
    if (!this.activeHomeId) {
      return null;
    }
    return this.homes.get(this.activeHomeId) || null;
  }

  getStatistics() {
    return {
      totalHomes: this.homes.size,
      activeHomeId: this.activeHomeId,
      homes: Array.from(this.homes.values()).map(h => ({
        id: h.id,
        name: h.name,
        deviceCount: h.devices.length,
        automationCount: h.automations.length
      }))
    };
  }

  destroy() {
    this.homes.clear();
    this.activeHomeId = null;
  }
}

module.exports = MultiHomeManager;
