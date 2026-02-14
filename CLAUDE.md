# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HomeySmartHome (SmartHome Pro) is a Node.js monorepo (v3.3.0) for a comprehensive smart home platform with 118+ backend system modules and 65+ dashboard modules. It runs on **Node.js >=22.0.0**.

## Repository Structure

- **homey-app/** — Backend Express.js server (port 3000) with 118 system modules in `lib/`
- **web-dashboard/** — Frontend Express.js + Socket.IO server (port 3001) with dashboard modules in `public/`
- **nginx/** — Reverse proxy config (rate limiting, security headers, WebSocket upgrade)
- **k8s/** — Kubernetes manifests (deployments, HPA, ingress)
- **monitoring/** — Prometheus + Grafana configuration
- **automations/** — Pre-built automation library (JSON + docs)

## Common Commands

### Development
```bash
# Install dependencies (run in each service directory)
cd homey-app && npm ci
cd web-dashboard && npm ci

# Start backend (standalone)
cd homey-app && npm start          # production
cd homey-app && npm run start:dev  # with nodemon hot-reload

# Start dashboard
cd web-dashboard && npm start      # production
cd web-dashboard && npm run dev    # with nodemon hot-reload
```

### Docker
```bash
# Production (3 services: backend, dashboard, nginx)
docker compose up -d --build

# Development (5 services: adds redis, prometheus, grafana + hot-reload)
docker compose -f docker-compose.dev.yml up -d --build

# Deploy script (start/stop/restart/status/logs/test/clean)
./deploy.sh start
./deploy.sh status
./deploy.sh logs
```

### Testing & Linting
```bash
# All tests and linting from root
npm run test:all
npm run lint:all

# Individual services
cd homey-app && npm test
cd homey-app && npm run lint
cd web-dashboard && npm test
cd web-dashboard && npm run lint
```

### Docker Build (individual)
```bash
cd homey-app && npm run docker:build
cd web-dashboard && npm run docker:build
```

## Architecture

### Backend (homey-app)
- **app.js** (~100KB) — Main Homey SDK app entry, initializes all system modules
- **server.js** (~865 lines) — Standalone Express server with HomeyShim emulation for running outside the Homey platform
- **api.js** (~125KB) — REST API route definitions (120+ endpoints)
- **lib/** — 118 system modules, each a self-contained class (e.g., `SmartHomeTheaterSystem.js`, `SolarEnergyOptimizationSystem.js`). Modules follow a consistent pattern: constructor with Homey reference, initialization method, and domain-specific logic.
- **test-suite.js** — Custom TestRunner with HTTP assertion helpers

### Dashboard (web-dashboard)
- **server.js** (~530 lines) — Express + Socket.IO with dynamic ModuleLoader, PredictiveAnalytics, and PerformanceMonitor
- **public/** — Static frontend assets (HTML/CSS/JS dashboard modules)

### Key Health/Monitoring Endpoints
- `/health` — Docker healthcheck (both services)
- `/ready` — Kubernetes readiness probe (backend)
- `/api/v1/stats` — System statistics
- `/metrics` — Prometheus text format metrics

### Infrastructure
- **CI/CD:** GitHub Actions (`.github/workflows/ci-cd.yml`) — lint, test, security audit, Docker build to GHCR
- **Container images:** Multi-stage Alpine builds, non-root user, dumb-init PID 1
- **Monitoring:** Prometheus scrapes `/metrics`, Grafana dashboards pre-configured

## Environment Configuration

Key env vars (see `.env.example`):
- `TZ=Europe/Stockholm`, `LATITUDE/LONGITUDE` — Stockholm defaults
- `HOMEY_TOKEN` — Homey API authentication
- `ALLOWED_ORIGINS` — CORS whitelist (comma-separated)
- `JWT_SECRET` — Dashboard auth
- `LOG_LEVEL` — Logging verbosity

## Conventions

- All system modules live in `homey-app/lib/` as `Smart*System.js` or `Advanced*System.js` classes
- Express security stack: Helmet + CORS + express-rate-limit on all services
- Both services use graceful shutdown handlers (SIGTERM/SIGINT)
- ESLint v9 for linting (flat config)
- Swedish locale context (Stockholm timezone, coordinates) but code/comments in English
