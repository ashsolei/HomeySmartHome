# CLAUDE.md — SmartHome Pro v3.3.0

Node.js >=22 monorepo. 118 backend modules, 66 dashboard modules, AI-driven automation.

## Repository Layout

| Path | Description | Port |
|---|---|---|
| `homey-app/` | Backend Express + Homey SDK app, 118 modules in `lib/` | 3000 |
| `web-dashboard/` | Express + Socket.IO dashboard, static assets in `public/` | 3001 |
| `nginx/` | Reverse proxy — rate limiting, security headers, WS upgrade | — |
| `k8s/` | All manifests in `deployment.yaml` (namespace: `smarthome-pro`) | — |
| `monitoring/` | `prometheus.yml` + `grafana/datasources/` | — |
| `automations/` | Pre-built automation library (JSON + docs) | — |

## Common Commands

```bash
cd homey-app && npm ci && cd ../web-dashboard && npm ci   # install

cd homey-app && npm run start:dev        # nodemon, port 3000
cd web-dashboard && npm run dev          # nodemon, port 3001

docker compose up -d --build            # prod: backend + dashboard + nginx
docker compose -f docker-compose.dev.yml up -d --build   # + redis + prometheus + grafana

./deploy.sh start | stop | restart | status | logs | test | clean

npm run test:all && npm run lint:all    # from repo root
```

## Architecture

**Backend** (`homey-app/`): `app.js` (Homey SDK entry) — `server.js` (standalone HomeyShim)
— `api.js` (120+ endpoints) — `lib/*.js` (all modules as `Smart*System`/`Advanced*System`)

**Dashboard** (`web-dashboard/server.js`): Express + Socket.IO 4.x, `PredictiveAnalytics`,
`PerformanceMonitor`, `ModuleLoader`. Auth via `socket.handshake.auth.token` (required in prod).
Event naming convention: `module:action` (e.g. `energy:update`).

**Module pattern** — every file in `homey-app/lib/`:
```js
class SmartExampleSystem {
  constructor(homey) { this.homey = homey; }
  async initialize() { /* register flows, start intervals */ }
}
module.exports = SmartExampleSystem;
```
Register new modules in `app.js`, `server.js`, and `api.js`.

## Health & Observability

- `GET /health` — liveness probe (both services)
- `GET /ready` — readiness probe (both services)
- `GET /metrics` — Prometheus text format (both services)
- `GET /api/v1/stats` — system statistics JSON

## Key Environment Variables

| Variable | Default | Notes |
|---|---|---|
| `HOMEY_TOKEN` | — | Homey API auth |
| `JWT_SECRET` | — | Dashboard auth |
| `ALLOWED_ORIGINS` | `http://localhost,...` | CORS whitelist |
| `TZ` | `Europe/Stockholm` | Stockholm locale |
| `LOG_LEVEL` | `info` | |
| `ENABLE_RATE_LIMITING` | `true` | 100 req/min default |
| `REDIS_URL` | — | Redis connection URL for rate limiter store (e.g. `redis://redis:6379`); falls back to in-memory if unset |

## Conventions

- Middleware order is fixed: cors → json → helmet → compression → SecurityMiddleware → PerformanceMonitor
- ESLint v9 flat config — run `npm run lint:all` before committing
- Code and comments in English; Swedish locale context (Stockholm TZ/coordinates)
- CI/CD: GitHub Actions → GHCR; multi-stage Alpine, non-root user, dumb-init PID 1

## Specialized Agents

`.claude/agents/homey-module-dev` — module arch, Socket.IO, middleware
`.claude/agents/k8s-ops` — K8s manifests, HPA, ingress, probes
`.claude/agents/monitoring-expert` — Prometheus, Grafana, alerting
