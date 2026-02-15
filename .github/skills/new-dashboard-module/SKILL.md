---
name: new-dashboard-module
description: "Creates a new dashboard module for HomeySmartHome in web-dashboard/ with Express routes, Socket.IO events, and frontend UI components following kebab-case naming conventions"
argument-hint: "[module-name]"
---

# New Dashboard Module

Creates a complete dashboard module with REST API, real-time Socket.IO events, and optional frontend components.

## Module Structure

```
web-dashboard/module-name.js              ← Module logic + routes
web-dashboard/public/module-name.html     ← Frontend UI (optional)
web-dashboard/public/js/module-name.js    ← Frontend JS (optional)
web-dashboard/server.js                   ← Module registration
```

## Step-by-Step Process

### 1. Create the Dashboard Module

Create `web-dashboard/module-name.js`:

```javascript
'use strict';

const express = require('express');

class ModuleNameDashboard {
  constructor() {
    this.router = express.Router();
    this._data = {
      initialized: false,
      lastUpdate: null,
      items: []
    };
    this._setupRoutes();
  }

  _setupRoutes() {
    // GET module data
    this.router.get('/api/dashboard/module-name', (req, res) => {
      try {
        res.json({
          success: true,
          data: this._data,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('❌ module-name GET error:', error.message);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // POST update data
    this.router.post('/api/dashboard/module-name', (req, res) => {
      try {
        const { items } = req.body;
        if (!Array.isArray(items)) {
          return res.status(400).json({ error: 'items must be an array' });
        }
        this._data.items = items;
        this._data.lastUpdate = new Date().toISOString();
        res.json({ success: true, data: this._data });
      } catch (error) {
        console.error('❌ module-name POST error:', error.message);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
  }

  setupSocketEvents(io) {
    const namespace = io.of('/module-name');

    namespace.on('connection', (socket) => {
      console.log(`✅ module-name: Client connected ${socket.id}`);

      // Send current state on connect
      socket.emit('module-name:state', this._data);

      // Handle subscription
      socket.on('module-name:subscribe', () => {
        socket.join('module-name:updates');
        socket.emit('module-name:state', this._data);
      });

      // Handle updates from clients
      socket.on('module-name:update', (data) => {
        try {
          this._data = { ...this._data, ...data, lastUpdate: new Date().toISOString() };
          namespace.to('module-name:updates').emit('module-name:state', this._data);
        } catch (error) {
          console.error('❌ module-name socket error:', error.message);
          socket.emit('module-name:error', { message: error.message });
        }
      });

      socket.on('disconnect', () => {
        console.log(`❌ module-name: Client disconnected ${socket.id}`);
      });
    });
  }

  initialize() {
    this._data.initialized = true;
    console.log('✅ module-name dashboard module loaded');
  }

  getRouter() {
    return this.router;
  }
}

module.exports = ModuleNameDashboard;
```

### 2. Register in server.js

In `web-dashboard/server.js`:

```javascript
const ModuleNameDashboard = require('./module-name');

const moduleName = new ModuleNameDashboard();
moduleName.initialize();

// Mount routes
app.use(moduleName.getRouter());

// Setup Socket.IO events
moduleName.setupSocketEvents(io);
```

### 3. Create Frontend (Optional)

`web-dashboard/public/module-name.html`:
```html
<div id="module-name-container">
  <h2>Module Name</h2>
  <div id="module-name-data"></div>
</div>
<script src="/js/module-name.js"></script>
```

`web-dashboard/public/js/module-name.js`:
```javascript
const socket = io('/module-name');

socket.on('connect', () => {
  socket.emit('module-name:subscribe');
});

socket.on('module-name:state', (data) => {
  document.getElementById('module-name-data').textContent = JSON.stringify(data, null, 2);
});
```

## Naming Conventions

- File: `kebab-case.js` (e.g., `energy-monitor.js`)
- Class: `PascalCase` + `Dashboard` suffix (e.g., `EnergyMonitorDashboard`)
- Routes: `/api/dashboard/kebab-case`
- Socket events: `kebab-case:action` (e.g., `energy-monitor:subscribe`)
- Socket namespace: `/kebab-case`

## Quality Rules

1. Use `'use strict';` at file top
2. Express router for all REST endpoints
3. Socket.IO namespace per module (avoid polluting global namespace)
4. Input validation on all POST/PUT handlers
5. Error responses: `{ error: "message" }` — never expose internals
6. Console logging with emoji prefixes
7. Self-contained — module can be enabled/disabled independently
8. Keep real-time payloads small — only send deltas when possible
9. Frontend assets in `web-dashboard/public/`
10. Test with both REST and WebSocket clients
