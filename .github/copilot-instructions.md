# Copilot Instructions — HomeySmartHome (SmartHomePro)

## Project Intelligence (Auto-Generated)

- **Tech stack:** Node.js 22+, Express 5.1.0, Socket.IO 4.8.1, Helmet 8.0, express-rate-limit 7.5, CORS 2.8, dotenv 16.4, ESLint 9.0
- **Architecture:** Monorepo with 3 Docker services (backend, dashboard, nginx) + optional dev services (Redis, Prometheus, Grafana)
- **Key modules/services:** 114 backend modules in `homey-app/lib/`, 65 dashboard modules in `web-dashboard/`, Nginx reverse proxy
- **Build/test commands:** `npm run test:all`, `npm run lint:all`, `./deploy.sh test`
- **CI/CD:** GitHub Actions (`.github/workflows/ci-cd.yml`) — lint, test, audit, Docker build, push to GHCR, compose test
- **Docker:** Multi-stage Alpine builds, docker-compose.yml (prod) + docker-compose.dev.yml (dev), `deploy.sh` lifecycle script
- **Security tooling:** Helmet (headers), express-rate-limit, Nginx rate limiting zones, `npm audit`, non-root Docker containers, read-only filesystems
- **Observability:** Prometheus metrics at `/metrics`, Grafana dashboards, health/readiness endpoints, console logging with emoji prefixes

## Project Overview

HomeySmartHome is a production-grade smart home platform built with **Node.js 22+**, **Express 5**, and **Socket.IO 4.8**. It runs as a Docker Compose stack with three core services: a backend API server (port 3000), a real-time web dashboard (port 3001), and an Nginx reverse proxy (port 80). The system contains **179 modules** across 10 development waves — from core automation to advanced AI/ML-driven intelligence.

## Architecture

```
Monorepo
├── homey-app/          Backend: Express REST API, 114 system modules, Homey SDK emulation
├── web-dashboard/      Frontend: Express + Socket.IO, 65 dashboard modules, public HTML/CSS/JS
├── nginx/              Reverse proxy, rate limiting, security headers
├── automations/        30+ pre-built automation templates
├── monitoring/         Prometheus + Grafana configs
├── k8s/                Kubernetes manifests (optional)
└── Root                Unified package.json, deploy.sh, Docker Compose files
```

**Data flow:** `Browser → Nginx (80) → /api/* → Backend (3000)` and `→ /* → Dashboard (3001)`

**Module pattern:** Each module is a self-contained class in `homey-app/lib/` or a dashboard JS file in `web-dashboard/`. Modules are dynamically loaded and initialized via the ModuleLoader.

## Code Style & Conventions

- **Language:** JavaScript (CommonJS `require()`, not ES modules)
- **Strict mode:** `'use strict';` at file tops
- **Classes:** PascalCase — `AdvancedAutomationEngine`
- **Files:** camelCase or kebab-case — `energy-price-optimizer.js`
- **Variables/Functions:** camelCase — `trackRequest()`
- **Constants:** UPPER_SNAKE_CASE — `PORT`, `HOMEY_URL`
- **Private methods:** underscore prefix — `_createSettingsManager()`
- **Logging:** `console.log()` with prefixes — `[LOG]`, `[ERROR]`, `✅`, `❌`
- **Error handling:** try/catch with graceful fallbacks, no sensitive data in responses
- **Comments:** JSDoc-style for major functions, inline for complex logic only

## Important Constraints

- **Node.js 22+** required (both services)
- **Express 5** (not Express 4 — different API in some areas)
- **Security first:** Always use Helmet, rate limiting, CORS, input validation
- **No secrets in code:** Use `.env` for all sensitive values
- **Body size limit:** 1MB max for request bodies
- **Rate limits:** 30 req/s for `/api/`, 60 req/s general
- **Docker containers run as non-root** with read-only filesystem
- **Swedish locale:** Default timezone `Europe/Stockholm`, coordinates `59.3293, 18.0686`

## Workflow

```bash
# Development
cd homey-app && npm run start:dev      # Backend with hot-reload
cd web-dashboard && npm run dev         # Dashboard with nodemon
docker compose -f docker-compose.dev.yml up -d --build  # Full dev stack

# Testing
npm run test:all                        # All tests
cd homey-app && npm test               # Backend tests
cd web-dashboard && npm test           # Dashboard tests

# Linting
npm run lint:all                        # Both services
cd homey-app && npm run lint           # Backend lint
cd web-dashboard && npm run lint       # Dashboard lint

# Deployment
./deploy.sh start                       # Build & start production
./deploy.sh status                      # Health check all services
./deploy.sh test                        # Run tests in containers
./deploy.sh logs                        # Follow logs

# Docker
npm run docker:build                    # Build images
npm run docker:up                       # Start services
npm run docker:down                     # Stop services
```

## Key Endpoints

- `GET /health` — Health check (both services)
- `GET /ready` — Readiness probe
- `GET /metrics` — Prometheus metrics (backend)
- `GET /api/v1/*` — REST API
- `WS /socket.io/` — WebSocket real-time updates

## Quality Gates (Must Pass Before Any Merge/Deploy)

| Gate | Command | Required |
|------|---------|----------|
| Build | `docker compose build` | Yes |
| Lint (Backend) | `cd homey-app && npm run lint` | Yes |
| Lint (Dashboard) | `cd web-dashboard && npm run lint` | Yes |
| Unit Tests (Backend) | `cd homey-app && npm test` | Yes |
| Unit Tests (Dashboard) | `cd web-dashboard && npm test` | Yes |
| All Tests | `npm run test:all` | Yes |
| Security Audit | `cd homey-app && npm audit --audit-level=moderate` | Yes |
| Security Audit | `cd web-dashboard && npm audit --audit-level=moderate` | Yes |
| Docker Build | `docker compose build --no-cache` | Yes |
| Health Check | `./deploy.sh status` | Post-deploy |
| Full Stack Test | `./deploy.sh test` | Post-deploy |
