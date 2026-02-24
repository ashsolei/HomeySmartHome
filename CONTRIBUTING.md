# Contributing to SmartHome Pro

## Prerequisites

- Node.js >= 22
- npm >= 10
- Docker & Docker Compose
- GitHub CLI (`gh`) — authenticated

## Quick Start

```bash
# Clone and install
git clone https://github.com/ashsolei/HomeySmartHome.git
cd HomeySmartHome
cp .env.example .env  # fill in required values

# Install dependencies
cd homey-app && npm ci
cd ../web-dashboard && npm ci

# Run locally
cd homey-app && npm run start:dev        # Backend on port 3000
cd web-dashboard && npm run dev          # Dashboard on port 3001

# Or use Docker
docker compose -f docker-compose.dev.yml up -d --build
```

## Architecture

```
HomeySmartHome/
  homey-app/           # Backend — Express + Homey SDK
    server.js          # Standalone boot (HomeyShim)
    app.js             # Homey SDK entry point
    api.js             # 120+ API endpoint handlers
    lib/               # 93+ system modules
    lib/utils/         # BaseSystem, CacheManager, etc.
    test/              # Unit tests
  web-dashboard/       # Frontend — Express + Socket.IO
    server.js          # Dashboard server
    public/            # Static assets (app.js, styles.css)
    test/              # Unit tests
  nginx/               # Reverse proxy config
  k8s/                 # Kubernetes manifests
  monitoring/          # Prometheus + Grafana configs
```

## Module Development

Every backend module follows this pattern and extends `BaseSystem`:

```js
'use strict';
const BaseSystem = require('./utils/BaseSystem');

class SmartExampleSystem extends BaseSystem {
  constructor(homey) {
    super(homey, 'SmartExampleSystem');
  }

  async initialize() {
    // Use this.wrapInterval(fn, ms) — NOT raw setInterval()
    this.wrapInterval(() => this.update(), 60000);
  }
}

module.exports = SmartExampleSystem;
```

Register new modules in three files: `app.js`, `server.js`, and `api.js`.

## Testing

```bash
# Backend tests (127 tests)
cd homey-app
node test/AdvancedAutomationEngine.test.js
node test/SmartSchedulingSystem.test.js
node test/APIAuthenticationGateway.test.js

# Dashboard tests (18 tests)
cd web-dashboard
node test/security-middleware.test.js

# Lint
cd homey-app && npm run lint
cd web-dashboard && npm run lint
```

Tests use a custom runner (`test/helpers/runner.js`) with `describe/it/run` pattern. No external test framework required.

## Code Style

- ESLint v9 flat config — run lint before committing
- English for all code and comments
- Stockholm timezone (`Europe/Stockholm`) for locale context
- Use `logger` (pino) instead of `console.log` in backend code
- Prefer `BaseSystem.wrapInterval()` over raw `setInterval()`

## Git Workflow

1. Branch from `main`: `git checkout -b feature/my-change`
2. Make changes, run tests, run lint
3. Commit with descriptive message: `git commit -m "feat: add webhook support"`
4. Push and create PR: `gh pr create`
5. PR gets reviewed, CI must pass, then merge

## Environment Variables

See `.env.example` for all required and optional variables. Key ones:
- `HOMEY_TOKEN` — Homey API authentication (required)
- `JWT_SECRET` — Dashboard auth signing key (required)
- `LOG_LEVEL` — `debug`, `info`, `warn`, `error`
- `GRAFANA_PASSWORD` — Required for dev Docker stack
