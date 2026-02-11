'use strict';

/**
 * Dashboard Module Loader
 * Dynamically loads, initializes, and manages all dashboard feature modules.
 * Exposes status, API routes, and Socket.IO events for each module.
 */

const fs = require('fs');
const path = require('path');

// Modules that are loaded separately by server.js (not managed here)
const EXCLUDED = new Set([
  'server',
  'test-suite',
  'predictive-analytics',
  'security-middleware',
  'performance-monitor',
  'module-loader'
]);

// Modules with no-arg constructors
const NO_ARG_CONSTRUCTORS = new Set([
  'energy-price-optimizer',
  'learning-visualizer',
  'weather-integration'
]);

// Module with special constructor (app, services)
const SPECIAL_CONSTRUCTORS = new Set([
  'mobile-api'
]);

// Modules without an initialize() method
const NO_INIT = new Set([
  'mobile-api'
]);

class ModuleLoader {
  constructor() {
    this.modules = new Map();
    this.statuses = new Map();
    this.loadErrors = new Map();
  }

  /**
   * Discover all .js modules in the dashboard directory
   */
  discover() {
    const dir = __dirname;
    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.js') && !EXCLUDED.has(f.replace('.js', '')))
      .map(f => f.replace('.js', ''))
      .sort();

    return files;
  }

  /**
   * Load, instantiate, and initialize all discovered modules.
   * @param {object} app - The app context object (HomeyClient, io, etc.)
   * @param {object} [services] - Optional services map for modules that need it
   * @returns {{ loaded: number, initialized: number, failed: number }}
   */
  async loadAll(app, services = {}) {
    const moduleNames = this.discover();
    console.log(`\n📦 Module Loader: Discovered ${moduleNames.length} dashboard modules`);

    const INIT_TIMEOUT = 15000; // 15s per module

    // Phase 1: Require and instantiate
    for (const name of moduleNames) {
      try {
        const ModuleClass = require(path.join(__dirname, `${name}.js`));

        let instance;
        if (NO_ARG_CONSTRUCTORS.has(name)) {
          instance = new ModuleClass();
        } else if (SPECIAL_CONSTRUCTORS.has(name)) {
          instance = new ModuleClass(app, services);
        } else {
          instance = new ModuleClass(app);
        }

        this.modules.set(name, instance);
        this.statuses.set(name, 'loaded');
      } catch (err) {
        this.statuses.set(name, 'load-error');
        this.loadErrors.set(name, err.message);
        console.error(`   ✗ ${name}: Failed to load — ${err.message}`);
      }
    }

    // Phase 2: Initialize (parallel with timeout, resilient)
    const initPromises = [];
    for (const [name, instance] of this.modules) {
      if (NO_INIT.has(name) || typeof instance.initialize !== 'function') {
        this.statuses.set(name, 'ready');
        continue;
      }

      const p = this._withTimeout(instance.initialize(), name, INIT_TIMEOUT)
        .then(() => {
          this.statuses.set(name, 'ready');
        })
        .catch((err) => {
          this.statuses.set(name, 'init-error');
          this.loadErrors.set(name, err.message);
          console.error(`   ✗ ${name}: Init failed — ${err.message}`);
        });

      initPromises.push(p);
    }

    await Promise.allSettled(initPromises);

    const loaded = [...this.statuses.values()].filter(s => s !== 'load-error').length;
    const ready = [...this.statuses.values()].filter(s => s === 'ready').length;
    const failed = [...this.statuses.values()].filter(s => s.includes('error')).length;

    console.log(`   ✅ ${ready} modules ready, ${loaded - ready} loaded, ${failed} failed`);
    console.log('');

    return { total: moduleNames.length, loaded, ready, failed };
  }

  /**
   * Get a module instance by kebab-case name.
   */
  get(name) {
    return this.modules.get(name);
  }

  /**
   * Get status of all modules.
   */
  getAllStatuses() {
    const result = {};
    for (const [name, status] of this.statuses) {
      result[name] = {
        status,
        error: this.loadErrors.get(name) || null
      };
    }
    return result;
  }

  /**
   * Get summary counts.
   */
  getSummary() {
    const statuses = [...this.statuses.values()];
    return {
      total: statuses.length,
      ready: statuses.filter(s => s === 'ready').length,
      loaded: statuses.filter(s => s === 'loaded').length,
      errors: statuses.filter(s => s.includes('error')).length
    };
  }

  /**
   * Register Express API routes for module access.
   * Creates: GET /api/modules, GET /api/modules/:name/status
   * And per-module endpoints where modules expose getStatus/getData.
   */
  registerRoutes(expressApp) {
    // Module listing
    expressApp.get('/api/modules', (req, res) => {
      res.json({
        summary: this.getSummary(),
        modules: this.getAllStatuses()
      });
    });

    // Per-module status
    expressApp.get('/api/modules/:name/status', (req, res) => {
      const name = req.params.name;
      const instance = this.modules.get(name);
      if (!instance) {
        return res.status(404).json({ error: `Module '${name}' not found` });
      }

      const moduleStatus = {
        name,
        status: this.statuses.get(name),
        error: this.loadErrors.get(name) || null
      };

      // If module has getStatus(), include it
      if (typeof instance.getStatus === 'function') {
        try {
          moduleStatus.data = instance.getStatus();
        } catch (e) {
          moduleStatus.data = { error: e.message };
        }
      }

      res.json(moduleStatus);
    });

    // Per-module data endpoint
    expressApp.get('/api/modules/:name/data', async (req, res) => {
      const name = req.params.name;
      const instance = this.modules.get(name);
      if (!instance) {
        return res.status(404).json({ error: `Module '${name}' not found` });
      }

      try {
        let data = {};
        if (typeof instance.getData === 'function') {
          data = await instance.getData();
        } else if (typeof instance.getStatus === 'function') {
          data = instance.getStatus();
        } else if (typeof instance.getSummary === 'function') {
          data = instance.getSummary();
        } else if (typeof instance.getReport === 'function') {
          data = await instance.getReport();
        } else if (typeof instance.getAnalysis === 'function') {
          data = await instance.getAnalysis();
        } else {
          data = { status: this.statuses.get(name), message: 'No data method available' };
        }
        res.json(data);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // Mobile API routes (if mobile-api module loaded)
    const mobileApi = this.modules.get('mobile-api');
    if (mobileApi && typeof mobileApi.getRouter === 'function') {
      expressApp.use('/api/mobile', mobileApi.getRouter());
    }
  }

  /**
   * Register Socket.IO events for real-time module data.
   */
  registerSocketEvents(io) {
    io.on('connection', (socket) => {
      // Client can request any module's status
      socket.on('module-status', (name) => {
        const instance = this.modules.get(name);
        if (!instance) {
          socket.emit('module-status-response', { name, error: 'not found' });
          return;
        }

        const response = {
          name,
          status: this.statuses.get(name)
        };

        if (typeof instance.getStatus === 'function') {
          try {
            response.data = instance.getStatus();
          } catch (e) {
            response.error = e.message;
          }
        }

        socket.emit('module-status-response', response);
      });

      // Client can list all modules
      socket.on('modules-list', () => {
        socket.emit('modules-list-response', {
          summary: this.getSummary(),
          modules: this.getAllStatuses()
        });
      });
    });
  }

  /**
   * @private
   */
  _withTimeout(promise, name, ms) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout after ${ms / 1000}s`));
      }, ms);
      promise
        .then((val) => { clearTimeout(timer); resolve(val); })
        .catch((err) => { clearTimeout(timer); reject(err); });
    });
  }
}

module.exports = ModuleLoader;
