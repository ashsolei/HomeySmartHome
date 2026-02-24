# BACKLOG - HomeySmartHome

> Audit Round 3 — 2026-02-24
> All 37 items from rounds 1-2 are DONE
> Status: [ ] = TODO, [x] = DONE

---

## AUDIT FINDINGS (Round 3)

### HIGH

- [x] **SEC-10**: Prototype pollution via `Object.assign()` in api.js — `sanitizeSettings()` whitelist added.
- [x] **SEC-11**: `modalBody.innerHTML = content` in app.js — `escapeHtml()` applied to all callers.
- [ ] **COD-05**: Only 4 of 115 lib/ modules extend BaseSystem — 111 modules still lack consistent destroy/cleanup. Migrate top-20 most interval-heavy modules to extend BaseSystem.
- [x] **COD-06**: Two duplicate BaseSystem files consolidated — kept `lib/utils/BaseSystem.js`, deleted `lib/BaseSystem.js`, updated imports.
- [x] **INF-22**: `.env.example` created with all required environment variables documented.
- [ ] **INF-23**: `.dockerignore` review — ensure test files, .md files, and .git are excluded.

### MEDIUM

- [x] **COD-07**: Structured logging — pino logger created (`lib/logger.js`), integrated in server.js.
- [x] **COD-08**: OpenAPI/Swagger docs — swagger-jsdoc + swagger-ui at `/api/docs`, 13 endpoints annotated.
- [x] **COD-09**: Stale docs removed — `SECURITY_AUDIT_REPORT.md`, `AUTONOMOUS_OPTIMIZATION_REPORT.md` deleted.
- [x] **TST-03**: Dashboard tests added — 18 unit tests for security-middleware.js (rate limit, validation, headers, CSRF, cleanup).
- [ ] **TST-04**: No end-to-end test framework — add Playwright or similar for critical user flows.
- [ ] **INF-24**: nginx reverse proxy still exposes port 80 only — docker-compose.yml should also expose 443 with TLS certificates.
- [x] **INF-25**: `.env.example` template created.

### LOW

- [ ] **COD-10**: 115 modules in a flat `lib/` directory — organize into subdirectories by domain (energy/, security/, automation/, etc.)
- [ ] **COD-11**: No JSDoc type annotations on public API methods — add to BaseSystem and key modules.

---

## FEATURE BACKLOG (World-class platform)

### HIGH — Core Platform Features

- [x] **FEAT-01**: **Structured Logging** — pino logger with log levels, JSON format for production. `lib/logger.js` + server.js integration.
- [x] **FEAT-02**: **OpenAPI Documentation** — swagger-jsdoc with swagger-ui at `/api/docs`. `lib/swagger.js` + 13 annotated endpoints.
- [ ] **FEAT-03**: **Graceful Degradation** — Circuit breaker pattern for module initialization. Partially done (Promise.allSettled in server.js).
- [x] **FEAT-04**: **Activity Audit Log** — `AuditLogSystem.js` module with record/getLog/getStats methods, registered in server.js.
- [x] **FEAT-05**: **Backup/Restore** — `BackupRestoreSystem.js` module with create/restore/list backup, registered in server.js.

### MEDIUM — Enhanced Features

- [ ] **FEAT-06**: **Dark Mode** — CSS theme toggle for web-dashboard with localStorage preference.
- [ ] **FEAT-07**: **Multi-user Roles** — Admin/user/guest role system with JWT claims.
- [ ] **FEAT-08**: **Webhook Integration** — IFTTT/Zapier compatible webhook endpoints.
- [ ] **FEAT-09**: **Energy Dashboard Analytics** — Time-series charts for energy consumption.
- [ ] **FEAT-10**: **Health Check Cascade** — /ready endpoint checks downstream dependencies.
- [ ] **FEAT-11**: **WebSocket Event Documentation** — Document all Socket.IO events with payload schemas.

### LOW — Polish & DX

- [ ] **FEAT-12**: **Developer Onboarding** — CONTRIBUTING.md with setup guide and architecture overview.
- [ ] **FEAT-13**: **Module Generator CLI** — Scaffold new lib/ modules with BaseSystem, tests, and API routes.
- [ ] **FEAT-14**: **Performance Metrics Dashboard** — Node.js process metrics via /metrics + Grafana panels.
- [ ] **FEAT-15**: **Docker Compose Profiles** — minimal, standard, full, dev profiles.
