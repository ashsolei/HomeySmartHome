---
mode: "agent"
description: "Create a new dashboard module with UI, API routes, and Socket.IO events"
---

# New Dashboard Module

Create a new dashboard module in `web-dashboard/` with Express routes and Socket.IO support.

## Module Template

```javascript
'use strict';

const express = require('express');
const router = express.Router();

// Module state
let moduleData = {
  initialized: false,
  lastUpdate: null
};

// REST endpoint
router.get('/api/dashboard/feature-name', (req, res) => {
  try {
    res.json({
      success: true,
      data: moduleData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ feature-name error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Socket.IO setup (called from server.js)
function setupSocketEvents(io) {
  io.on('connection', (socket) => {
    socket.on('feature-name:subscribe', () => {
      socket.join('feature-name');
      socket.emit('feature-name:data', moduleData);
    });

    socket.on('feature-name:update', (data) => {
      moduleData = { ...moduleData, ...data, lastUpdate: new Date().toISOString() };
      io.to('feature-name').emit('feature-name:data', moduleData);
    });
  });
}

// Initialize
function initialize() {
  moduleData.initialized = true;
  console.log('✅ feature-name dashboard module loaded');
}

module.exports = { router, setupSocketEvents, initialize };
```

## File: `web-dashboard/feature-name.js` (kebab-case)

## Registration Steps
1. Create the module file
2. Import and mount router in `web-dashboard/server.js`
3. Call `setupSocketEvents(io)` in the Socket.IO setup section
4. Create frontend component in `web-dashboard/public/` if needed
5. Add tests
6. Document API endpoints
