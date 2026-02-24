# WebSocket Event Documentation

Socket.IO 4.x events used by the SmartHome Pro dashboard.

## Connection

```js
const socket = io({
  auth: { token: '<JWT_TOKEN>' }  // Required in production
});
```

## Server → Client Events

| Event | Payload | Description |
|---|---|---|
| `device-updated` | `{ deviceId: string, capability: string, value: any }` | A device state has changed |
| `scene-activated` | `{ sceneId: string }` | A scene was activated |
| `security-mode-changed` | `{ mode: string }` | Security mode changed (home/away/night) |
| `energy-update` | `{ consumption: number, solar: number, grid: number, ... }` | Periodic energy data (every 5s) |
| `error` | `{ message: string }` | Error response to a client action |

## Client → Server Events

| Event | Payload | Description |
|---|---|---|
| `subscribe-device` | `deviceId: string` | Subscribe to updates for a specific device |
| `control-device` | `{ deviceId: string, capability: string, value: any }` | Control a device capability |
| `activate-scene` | `sceneId: string` | Activate a scene by ID |

## Event Naming Convention

Events follow the `module:action` pattern (e.g., `energy:update`). System-level events use hyphenated names (e.g., `device-updated`).

## Authentication

In production (`NODE_ENV=production`), connections require a valid JWT token in `socket.handshake.auth.token`. Unauthenticated connections are rejected.
