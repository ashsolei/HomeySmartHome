'use strict';

/**
 * Scene Builder Module
 * Loads scenes from the backend and exposes them via Socket.IO.
 */
class SceneBuilderModule {
  constructor(app) {
    this.app = app;
    this.scenes = {};
    this._refreshInterval = null;
  }

  async initialize() {
    await this._loadScenes();
    // Refresh scenes every 30 seconds
    this._refreshInterval = setInterval(() => this._loadScenes(), 30000);
  }

  async _loadScenes() {
    try {
      const client = this.app.homeyClient;
      if (client) {
        const result = await client.request('/api/v1/scenes');
        if (result && result.scenes) {
          this.scenes = result.scenes;
        }
      }
    } catch (_err) {
      // Silently fall back to cached scenes
    }
  }

  getScenes() {
    return this.scenes;
  }

  registerSocketEvents(io) {
    io.on('connection', (socket) => {
      socket.on('scenes:list', () => {
        socket.emit('scenes:list', { scenes: this.scenes });
      });

      socket.on('scenes:refresh', async () => {
        await this._loadScenes();
        socket.emit('scenes:list', { scenes: this.scenes });
      });
    });
  }

  registerRoutes(_app) {
    // Routes are handled by the backend; no dashboard-specific routes needed
  }

  destroy() {
    if (this._refreshInterval) {
      clearInterval(this._refreshInterval);
      this._refreshInterval = null;
    }
  }
}

module.exports = SceneBuilderModule;
