---
name: safe-changes
description: "Minimizes blast radius for HomeySmartHome changes through incremental delivery, feature flags, backward compatibility, rollback readiness, and progressive deployment strategies"
argument-hint: "[change-type]"
---

# Safe Changes

Strategies for minimizing blast radius when modifying the HomeySmartHome platform
(179 modules, Node.js 22, Express 5, Socket.IO 4.8, Docker Compose).

## Step 1 — Classify the Change

| Risk Level | Description                                 | Examples                                          |
|------------|---------------------------------------------|---------------------------------------------------|
| Low        | Additive, no existing behavior changes      | New module, new API endpoint, new dashboard panel  |
| Medium     | Modifies existing behavior, backward compat | Update response shape with new fields, refactor    |
| High       | Breaking change, infrastructure, shared code| Change API contract, modify server.js boot order   |
| Critical   | Data migration, auth changes, Docker config | Database schema change, auth flow, compose changes |

## Step 2 — Incremental Delivery: Add-Then-Wire

```js
// Commit 1: Add the new module file (no behavior change yet)
'use strict';
class SmartIrrigationSystem {
  constructor(homey) {
    this.homey = homey;
    this.initialized = false;
  }
  async initialize() {
    this.initialized = true;
    return this;
  }
  getStatus() { return { initialized: this.initialized, zones: [] }; }
}
module.exports = SmartIrrigationSystem;

// Commit 2: Register in server.js (only after Commit 1 passes quality gates)
```

## Step 3 — Shadow Mode Pattern

```js
class EnhancedClimateManager {
  constructor(homey, options = {}) {
    this.homey = homey;
    this.useLegacy = options.useLegacy !== false;
  }
  async getTemperature(zoneId) {
    const legacyResult = await this._legacyGetTemperature(zoneId);
    if (!this.useLegacy) {
      const newResult = await this._enhancedGetTemperature(zoneId);
      if (newResult.value !== legacyResult.value) {
        console.warn('[EnhancedClimateManager] Discrepancy', { zone: zoneId });
      }
    }
    return legacyResult; // Always return legacy until validated
  }
  async _legacyGetTemperature(zoneId) { return { value: 21.5, unit: 'celsius' }; }
  async _enhancedGetTemperature(zoneId) { return { value: 21.5, unit: 'celsius' }; }
}
module.exports = EnhancedClimateManager;
```

## Step 4 — Feature Flags

```js
// homey-app/lib/featureFlags.js
'use strict';
const flags = {
  ENHANCED_CLIMATE:    process.env.FF_ENHANCED_CLIMATE === 'true',
  NEW_IRRIGATION:      process.env.FF_NEW_IRRIGATION === 'true',
  SOCKET_V2_PROTOCOL:  process.env.FF_SOCKET_V2_PROTOCOL === 'true',
};
function isEnabled(flagName) {
  if (!(flagName in flags)) { console.warn(`Unknown flag: ${flagName}`); return false; }
  return flags[flagName];
}
module.exports = { isEnabled };
```

Usage in server.js:

```js
const { isEnabled } = require('./lib/featureFlags');
if (isEnabled('NEW_IRRIGATION')) {
  const SmartIrrigationSystem = require('./lib/SmartIrrigationSystem');
  const irrigation = new SmartIrrigationSystem(homey);
  await irrigation.initialize();
  app.get('/api/v1/irrigation/status', (req, res) => res.json(irrigation.getStatus()));
}
```

Add flags to docker-compose.yml:

```yaml
services:
  smarthomepro:
    environment:
      - FF_ENHANCED_CLIMATE=false
      - FF_NEW_IRRIGATION=false
```

## Step 5 — Backward Compatibility Rules

```js
// SAFE: Adding a new field
app.get('/api/v1/energy/status', (req, res) => {
  res.json({ consumption: 1200, unit: 'watts', forecast: 1150 });
});
// UNSAFE: Renaming a field breaks clients
// { power: 1200 } instead of { consumption: 1200 }

// Socket.IO: Add new events, keep old ones
io.on('connection', (socket) => {
  socket.on('device:update', (data) => handleDeviceUpdate(data));
  socket.on('device:update:v2', (data) => handleDeviceUpdateV2(data));
});

// Constructors: Use options with defaults
class SmartLockManagementSystem {
  constructor(homey, options = {}) {
    this.timeout = options.timeout || 30000;
    this.autoLockDelay = options.autoLockDelay || 300000; // new, with default
  }
}
```

## Step 6 — Rollback Checkpoints

```bash
cd /Users/macbookpro/HomeySmartHome
git tag rollback/pre-irrigation-$(date +%Y%m%d%H%M%S)
# If something goes wrong:
git revert HEAD --no-edit
docker compose build && ./deploy.sh start
```

## Step 7 — Progressive Deployment

| Phase  | Duration | Flag State | Monitoring Action                       |
|--------|----------|------------|-----------------------------------------|
| Deploy | 0 min    | OFF        | Verify build + boot with no new behavior|
| Canary | 15 min   | ON (10%)   | Watch logs, check `/metrics`            |
| Expand | 30 min   | ON (50%)   | Monitor memory, response times          |
| Full   | 60 min   | ON (100%)  | Confirm stable, remove flag next release|

## Safe Changes Checklist

Before starting:
- [ ] Change classified by risk level (low/medium/high/critical)
- [ ] Blast radius identified: all affected files and modules listed
- [ ] Rollback plan documented with specific commands
- [ ] Git tag checkpoint created for high/critical changes

During implementation:
- [ ] Changes delivered in incremental commits (add-then-wire)
- [ ] No fields removed or renamed in API responses
- [ ] Feature flag wraps new behavior, defaulting to OFF
- [ ] Constructor changes use options object with defaults

Before merge:
- [ ] All quality gates pass: `npm run lint:all && npm run test:all`
- [ ] Docker build succeeds: `docker compose build`
- [ ] Backward compatibility verified with existing client tests

## Rules

1. Never remove or rename existing API fields in the same release.
2. All new behavior must ship behind a feature flag defaulting to OFF.
3. Every commit must leave the system in a deployable state.
4. Create a git tag checkpoint before any high or critical risk change.
5. Shadow mode must run for at least one deployment cycle before activation.
6. Feature flags must be cleaned up within two releases of full activation.
7. If a change touches more than 5 files, break it into multiple PRs.
8. Never modify `server.js` module registration order without testing boot sequence.
