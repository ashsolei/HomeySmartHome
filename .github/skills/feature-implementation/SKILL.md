---
name: feature-implementation
description: "End-to-end feature implementation workflow for HomeySmartHome from specification through code, tests, documentation, Docker verification, and quality gate validation"
argument-hint: "[feature-name]"
---

# Feature Implementation

End-to-end workflow for implementing a new feature in the HomeySmartHome platform
(179 modules, Node.js 22, Express 5, Socket.IO 4.8, Docker Compose with backend
port 3000, dashboard port 3001, nginx port 80).

## Step 1 — Write the Feature Specification

Before writing any code, define what the feature does, its API surface, and its
integration points.

```js
// Feature specification template
const featureSpec = {
  name: 'SmartIrrigationSystem',
  description: 'Automated garden irrigation with soil moisture monitoring and weather-aware scheduling',
  category: 'outdoor',
  apiEndpoints: [
    { method: 'GET',  path: '/api/v1/irrigation/status',    response: '{ zones: Zone[], active: boolean }' },
    { method: 'POST', path: '/api/v1/irrigation/schedule',  body: '{ zoneId: string, duration: number }' },
    { method: 'GET',  path: '/api/v1/irrigation/history',   response: '{ events: Event[] }' },
  ],
  socketEvents: [
    { event: 'irrigation:status', direction: 'emit', payload: '{ zoneId, moisture, active }' },
    { event: 'irrigation:start',  direction: 'listen', payload: '{ zoneId, duration }' },
  ],
  dependencies: ['AdvancedWeatherIntegration', 'GardenPlantCareSystem'],
  configKeys: ['IRRIGATION_CHECK_INTERVAL', 'IRRIGATION_MOISTURE_THRESHOLD'],
};
```

## Step 2 — Create the Module Class

Every module follows the same CommonJS pattern used across all 179 modules.

```js
// homey-app/lib/SmartIrrigationSystem.js
'use strict';

class SmartIrrigationSystem {
  constructor(homey) {
    this.homey = homey;
    this.initialized = false;
    this.zones = new Map();
    this.checkInterval = parseInt(process.env.IRRIGATION_CHECK_INTERVAL, 10) || 300000;
    this.moistureThreshold = parseFloat(process.env.IRRIGATION_MOISTURE_THRESHOLD) || 0.3;
    this._intervalHandle = null;
  }

  async initialize() {
    this._intervalHandle = setInterval(() => this._checkMoistureLevels(), this.checkInterval);
    this.initialized = true;
    console.log('[SmartIrrigationSystem] Initialized with %d ms check interval', this.checkInterval);
    return this;
  }

  getStatus() {
    const zones = Array.from(this.zones.values());
    return {
      initialized: this.initialized,
      active: zones.some((z) => z.active),
      zones,
      threshold: this.moistureThreshold,
    };
  }

  async scheduleIrrigation(zoneId, duration) {
    if (!zoneId || typeof duration !== 'number' || duration <= 0) {
      throw new Error('Invalid zoneId or duration');
    }
    const zone = this.zones.get(zoneId) || { id: zoneId, active: false, moisture: 0 };
    zone.active = true;
    zone.scheduledDuration = duration;
    zone.startedAt = Date.now();
    this.zones.set(zoneId, zone);
    return zone;
  }

  getHistory() {
    return { events: [] };
  }

  _checkMoistureLevels() {
    for (const [id, zone] of this.zones) {
      if (zone.moisture < this.moistureThreshold && !zone.active) {
        console.log('[SmartIrrigationSystem] Zone %s below threshold, scheduling', id);
      }
    }
  }

  async destroy() {
    if (this._intervalHandle) {
      clearInterval(this._intervalHandle);
      this._intervalHandle = null;
    }
    this.initialized = false;
  }
}

module.exports = SmartIrrigationSystem;
```

### Module Class Requirements

- Must use `'use strict';` at the top.
- Must accept `homey` as the first constructor argument.
- Must have an `async initialize()` method that returns `this`.
- Must have a `getStatus()` method for the health endpoint.
- Must have an `async destroy()` method for graceful shutdown.
- Must use `console.log` with a `[ModuleName]` prefix for logging.
- Must not use ES module syntax (no `import`/`export`).

## Step 3 — Register the Module in server.js

Add the module import and registration to `homey-app/server.js`.

```js
// At the top of server.js, add the import alongside existing imports
const SmartIrrigationSystem = require('./lib/SmartIrrigationSystem');

// In the initialization section, after other modules
const smartIrrigation = new SmartIrrigationSystem(homey);
await smartIrrigation.initialize();

// Register API endpoints
app.get('/api/v1/irrigation/status', (req, res) => {
  res.json(smartIrrigation.getStatus());
});

app.post('/api/v1/irrigation/schedule', express.json(), (req, res) => {
  const { zoneId, duration } = req.body;
  if (!zoneId || !duration) {
    return res.status(400).json({ error: 'zoneId and duration are required' });
  }
  smartIrrigation.scheduleIrrigation(zoneId, duration)
    .then((zone) => res.json(zone))
    .catch((err) => res.status(500).json({ error: err.message }));
});

app.get('/api/v1/irrigation/history', (req, res) => {
  res.json(smartIrrigation.getHistory());
});
```

### Socket.IO Integration

```js
// In the Socket.IO setup section of server.js
io.on('connection', (socket) => {
  socket.on('irrigation:start', async (data) => {
    try {
      const zone = await smartIrrigation.scheduleIrrigation(data.zoneId, data.duration);
      io.emit('irrigation:status', { zoneId: zone.id, moisture: zone.moisture, active: zone.active });
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });
});
```

## Step 4 — Write Tests

### Unit Tests

```js
// homey-app/test/SmartIrrigationSystem.test.js
'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const SmartIrrigationSystem = require('../lib/SmartIrrigationSystem');

describe('SmartIrrigationSystem', () => {
  let system;
  const mockHomey = { settings: {}, api: {} };

  beforeEach(async () => {
    system = new SmartIrrigationSystem(mockHomey);
    await system.initialize();
  });

  afterEach(async () => {
    await system.destroy();
  });

  it('should initialize successfully', () => {
    assert.equal(system.initialized, true);
  });

  it('should return status with no active zones initially', () => {
    const status = system.getStatus();
    assert.equal(status.active, false);
    assert.equal(status.zones.length, 0);
    assert.equal(status.initialized, true);
  });

  it('should schedule irrigation for a zone', async () => {
    const zone = await system.scheduleIrrigation('zone-1', 600);
    assert.equal(zone.id, 'zone-1');
    assert.equal(zone.active, true);
    assert.equal(zone.scheduledDuration, 600);
  });

  it('should reject invalid schedule requests', async () => {
    await assert.rejects(
      () => system.scheduleIrrigation('', 600),
      { message: 'Invalid zoneId or duration' }
    );
    await assert.rejects(
      () => system.scheduleIrrigation('zone-1', -1),
      { message: 'Invalid zoneId or duration' }
    );
  });

  it('should return empty history initially', () => {
    const history = system.getHistory();
    assert.deepEqual(history, { events: [] });
  });

  it('should clean up on destroy', async () => {
    await system.destroy();
    assert.equal(system.initialized, false);
  });
});
```

### Integration Tests

```js
// homey-app/test/integration/irrigation-api.test.js
'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

const BASE_URL = 'http://localhost:3000';

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = { method, hostname: url.hostname, port: url.port, path: url.pathname };
    if (body) options.headers = { 'Content-Type': 'application/json' };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

describe('Irrigation API', () => {
  it('GET /api/v1/irrigation/status returns 200', async () => {
    const res = await request('GET', '/api/v1/irrigation/status');
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.active, 'boolean');
    assert.ok(Array.isArray(res.body.zones));
  });

  it('POST /api/v1/irrigation/schedule returns scheduled zone', async () => {
    const res = await request('POST', '/api/v1/irrigation/schedule', {
      zoneId: 'test-zone',
      duration: 300,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.id, 'test-zone');
    assert.equal(res.body.active, true);
  });

  it('POST /api/v1/irrigation/schedule rejects missing fields', async () => {
    const res = await request('POST', '/api/v1/irrigation/schedule', {});
    assert.equal(res.status, 400);
  });
});
```

## Step 5 — Verify Docker Build

```bash
cd /Users/macbookpro/HomeySmartHome

# Build all services to catch missing files or dependencies
docker compose build

# Start and verify the new feature works inside the container
./deploy.sh start
sleep 10

# Test the new endpoints through nginx
curl -sf http://localhost/api/v1/irrigation/status
curl -sf -X POST http://localhost/api/v1/irrigation/schedule \
  -H 'Content-Type: application/json' \
  -d '{"zoneId":"zone-1","duration":300}'
```

## Step 6 — Run All Quality Gates

```bash
cd /Users/macbookpro/HomeySmartHome

# Lint
npm run lint:all

# Test
npm run test:all

# Security audit
npm audit --audit-level=high

# Docker build
docker compose build

# Health check
./deploy.sh status

# Clean repo
git status --porcelain
```

## Feature Implementation Checklist

Specification:
- [ ] Feature name, description, and category defined
- [ ] API endpoints documented with methods, paths, and response shapes
- [ ] Socket.IO events documented with direction and payload shapes
- [ ] Dependencies on other modules identified
- [ ] Configuration keys defined with defaults

Implementation:
- [ ] Module class created in `homey-app/lib/` following CommonJS pattern
- [ ] `'use strict';` at top of file
- [ ] Constructor accepts `homey`, has `initialize()`, `getStatus()`, `destroy()`
- [ ] Module registered in `homey-app/server.js` with API routes
- [ ] Socket.IO events wired in the connection handler
- [ ] Input validation on all API endpoints

Testing:
- [ ] Unit tests created in `homey-app/test/` using `node:test`
- [ ] Tests cover initialization, status, core functionality, error cases, cleanup
- [ ] Integration tests verify API endpoints return correct status codes and shapes
- [ ] All tests pass: `npm run test:all`

Verification:
- [ ] `npm run lint:all` passes with zero errors
- [ ] `docker compose build` succeeds
- [ ] `./deploy.sh start` boots without errors
- [ ] New API endpoints respond correctly through nginx proxy
- [ ] `./deploy.sh status` shows all services healthy
- [ ] `git status --porcelain` shows clean working tree

## Rules

1. Every module must follow the established CommonJS class pattern.
2. Every API endpoint must validate its input and return proper HTTP status codes.
3. Every module must have unit tests covering at least initialization, status, core logic, errors, and cleanup.
4. Never skip quality gates; all six must pass before the feature is considered done.
5. Register modules in `server.js` in alphabetical order within their wave section.
6. Socket.IO events must follow the `namespace:action` naming convention.
7. Environment variables for configuration must have sensible defaults.
8. The `destroy()` method must clean up all intervals, timeouts, and event listeners.
