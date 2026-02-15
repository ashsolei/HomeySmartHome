---
name: socketio-integration
description: "Implements Socket.IO real-time WebSocket features for HomeySmartHome dashboard including namespaces, rooms, event handling, client-side integration, and Nginx WebSocket proxy configuration"
argument-hint: "[feature-name]"
---

# Socket.IO Integration

Implements real-time WebSocket functionality for the HomeySmartHome dashboard.

## Architecture

```
Client Browser
  ↓ WebSocket (wss://)
Nginx (port 80)
  ↓ proxy_pass with upgrade headers
Dashboard Server (port 3001)
  ↓ Socket.IO 4.8.1
Namespace → Rooms → Event handlers
```

## Server-Side Implementation

### Namespace Pattern (Recommended)

Each feature gets its own namespace to avoid event name collisions:

```javascript
'use strict';

class FeatureSocket {
  constructor(io) {
    this.namespace = io.of('/feature-name');
    this._state = {};
    this._setup();
  }

  _setup() {
    this.namespace.on('connection', (socket) => {
      console.log(`✅ /feature-name: ${socket.id} connected`);

      // Send initial state
      socket.emit('state', this._state);

      // Room-based subscriptions
      socket.on('subscribe', (roomId) => {
        socket.join(roomId);
        console.log(`✅ ${socket.id} joined room ${roomId}`);
      });

      socket.on('unsubscribe', (roomId) => {
        socket.leave(roomId);
      });

      // Handle client actions
      socket.on('action', async (data, ack) => {
        try {
          const result = await this._handleAction(data);
          // Broadcast to room
          if (data.roomId) {
            this.namespace.to(data.roomId).emit('update', result);
          } else {
            this.namespace.emit('update', result);
          }
          if (ack) ack({ success: true, data: result });
        } catch (error) {
          console.error('❌ /feature-name action error:', error.message);
          if (ack) ack({ success: false, error: error.message });
        }
      });

      socket.on('disconnect', (reason) => {
        console.log(`❌ /feature-name: ${socket.id} disconnected (${reason})`);
      });
    });
  }

  async _handleAction(data) {
    // Process the action and return result
    this._state = { ...this._state, ...data, updatedAt: Date.now() };
    return this._state;
  }

  // Broadcast from server-side (e.g., from backend events)
  broadcast(event, data) {
    this.namespace.emit(event, data);
  }

  broadcastToRoom(roomId, event, data) {
    this.namespace.to(roomId).emit(event, data);
  }
}

module.exports = FeatureSocket;
```

### Registration in server.js

```javascript
const { Server } = require('socket.io');
const FeatureSocket = require('./feature-socket');

const io = new Server(httpServer, {
  cors: { origin: process.env.CORS_ORIGINS || '*' },
  perMessageDeflate: true,
  maxHttpBufferSize: 1e6
});

const featureSocket = new FeatureSocket(io);
```

## Client-Side Implementation

```javascript
// Connect to namespace
const socket = io('/feature-name', {
  transports: ['websocket'],  // Skip polling, go straight to WebSocket
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 10
});

// Connection lifecycle
socket.on('connect', () => {
  console.log('Connected to /feature-name');
  socket.emit('subscribe', 'room-1');
});

socket.on('state', (data) => {
  // Initial state received
  renderState(data);
});

socket.on('update', (data) => {
  // Incremental update received
  updateUI(data);
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error.message);
});

// Send action with acknowledgment
function sendAction(actionData) {
  socket.emit('action', actionData, (response) => {
    if (response.success) {
      console.log('Action succeeded:', response.data);
    } else {
      console.error('Action failed:', response.error);
    }
  });
}
```

## Nginx WebSocket Configuration

Already configured in `nginx/nginx.conf`:

```nginx
location /socket.io/ {
    proxy_pass http://dashboard;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_read_timeout 86400;
}
```

## Event Naming Conventions

| Pattern | Usage | Example |
|---------|-------|---------|
| `state` | Full state snapshot | Initial load, reconnect |
| `update` | Incremental change | Single field change |
| `subscribe` | Join a room | Client subscribes to device updates |
| `unsubscribe` | Leave a room | Client stops watching |
| `action` | Client request with ack | Toggle device, update setting |
| `error` | Error notification | Server-side error for this client |

## Performance Rules

1. Use namespaces to isolate features (not global `io`)
2. Use rooms for targeted broadcasts (not `io.emit`)
3. Send deltas, not full state, in `update` events
4. Compress payloads: `perMessageDeflate: true`
5. Set `maxHttpBufferSize` to prevent oversized messages (1MB)
6. Use WebSocket transport directly when possible (skip polling)
7. Implement reconnection with exponential backoff on client
8. Debounce rapid-fire events (max 10 per second per client)
