---
mode: "agent"
description: "Add new Socket.IO real-time events to HomeySmartHome dashboard"
---

# Socket.IO Event Implementation

Add real-time WebSocket functionality to the HomeySmartHome dashboard.

## Server-Side (web-dashboard/server.js)

```javascript
io.on('connection', (socket) => {
  // Subscribe to a room for targeted updates
  socket.on('feature:subscribe', (params) => {
    socket.join(`feature:${params.id}`);
    console.log(`✅ Client ${socket.id} subscribed to feature:${params.id}`);
  });

  // Handle client-sent events
  socket.on('feature:action', async (data, callback) => {
    try {
      const result = await processAction(data);
      // Broadcast to room
      io.to(`feature:${data.id}`).emit('feature:update', result);
      // Acknowledge to sender
      if (callback) callback({ success: true });
    } catch (error) {
      console.error('❌ feature:action error:', error.message);
      if (callback) callback({ success: false, error: error.message });
    }
  });

  // Unsubscribe
  socket.on('feature:unsubscribe', (params) => {
    socket.leave(`feature:${params.id}`);
  });
});
```

## Client-Side (web-dashboard/public/)

```javascript
const socket = io();

// Subscribe
socket.emit('feature:subscribe', { id: 'resource-1' });

// Listen for updates
socket.on('feature:update', (data) => {
  updateUI(data);
});

// Send action
socket.emit('feature:action', { id: 'resource-1', command: 'toggle' }, (response) => {
  if (!response.success) console.error('Action failed:', response.error);
});
```

## Conventions
- Event names: `namespace:action` format (e.g., `energy:update`, `climate:subscribe`)
- Always include error handling in event handlers
- Use rooms for targeted broadcasts (not global `io.emit`)
- Acknowledge events with callbacks where confirmation is needed
- Keep payloads small — only send changed data
