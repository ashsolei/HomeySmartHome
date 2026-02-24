# BACKLOG - HomeySmartHome

> Audit Round 4 — 2026-02-24
> Rounds 1-3: All items DONE and merged
> Status: [ ] = TODO, [x] = DONE

---

## AUDIT FINDINGS (Round 4)

### HIGH — Fixed

- [x] **BUG-01**: CSRF `validateCsrfToken` crash on malformed HMAC — wrapped timingSafeEqual in try/catch
- [x] **BUG-02**: `registerInterval` doesn't exist on BaseSystem — replaced with `wrapInterval(fn, ms)`
- [x] **BUG-03**: Settings key collision between AdvancedAutomationEngine and SmartSchedulingSystem — unique keys
- [x] **BUG-04**: Unhandled async destroy in gracefulShutdown — added `await` to `sys.destroy()`
- [x] **BUG-05**: console.error in Express error handler — replaced with `logger.error`
- [x] **BUG-06**: 21 remaining console.log calls in server.js — replaced with pino logger
- [x] **INF-30**: `trivy-action@master` floating ref — pinned to `@0.28.0`
- [x] **INF-31**: `sbom-action@v0` floating major — pinned to `@v0.18.0`
- [x] **INF-32**: nginx 86400s read timeout on all `/` — moved to `/socket.io/` only
- [x] **INF-33**: TLS cipher suite uses weak `HIGH` group — replaced with Mozilla Intermediate
- [x] **INF-34**: Prometheus/Grafana ports exposed to all interfaces — bound to 127.0.0.1
- [x] **INF-35**: `.dockerignore` doesn't exclude `.env.*` variants — added `.env.*` pattern
- [x] **INF-36**: HOMEY_TOKEN empty-string fallback in docker-compose.yml — made required
- [x] **INF-37**: Alert expression uses counter as gauge — changed to `rate(...[1m])`
- [x] **MOD-01**: Duplicate BackupRestoreSystem removed — consolidated into BackupRecoverySystem

### MEDIUM — Fixed

- [x] **INF-38**: `docker-build` and `docker-compose-test` don't depend on `security-audit` — added
- [x] **INF-39**: web-dashboard lint step missing in CI — added
- [x] **INF-40**: `COSIGN_EXPERIMENTAL` deprecated — removed
- [x] **INF-41**: `/api/v1/` missing rate limit and forwarding headers — added
- [x] **INF-42**: `/socket.io/` missing X-Forwarded-Proto and X-Request-ID — added
- [x] **INF-43**: Grafana datasource `editable: true` — changed to `false`
- [x] **INF-44**: Dashboard provider `disableDeletion: false` — changed to `true`
- [x] **INF-45**: Empty node_exporter job in prometheus.yml — removed
- [x] **INF-46**: No Prometheus storage retention — added 7d / 2GB limits
- [x] **INF-47**: JWT_SECRET/HOMEY_TOKEN missing from backend docker-compose — added as required
- [x] **INF-48**: SSL session tickets enabled — disabled with `ssl_session_tickets off`
- [x] **INF-49**: ESLint config not excluded from production image — added to .dockerignore

### FEATURES — Implemented

- [x] **FEAT-06**: Dark mode toggle for web-dashboard with localStorage persistence

### MEDIUM — Remaining

- [ ] **INF-50**: nginx HTTPS port 443 not mapped in docker-compose.yml — needs cert volume mounts
- [ ] **INF-51**: K8s SealedSecret contains placeholder values — needs kubeseal or template
- [ ] **INF-52**: K8s image refs contain `your-repo` placeholder — needs Kustomize/Helm
- [ ] **INF-53**: K8s backend egress blocks outbound HTTPS — needs port 443 egress rule
- [ ] **INF-54**: Dashboard readiness probe uses /health not /ready — needs /ready endpoint
- [ ] **INF-55**: Alertmanager has no targets configured — needs alertmanager service
- [ ] **INF-56**: No custom error pages in nginx
- [ ] **COD-05**: Only 4 of 115 lib/ modules extend BaseSystem — migrate top-20

### LOW — Remaining

- [ ] **INF-57**: No PodSecurity admission label on K8s namespace
- [ ] **INF-58**: No ServiceMonitor for Prometheus Operator
- [ ] **INF-59**: No metrics endpoint authentication
- [ ] **COD-10**: 115 modules in flat lib/ directory — organize by domain
- [ ] **COD-11**: No JSDoc type annotations on public API methods
- [ ] **TST-04**: No end-to-end test framework (Playwright)

---

## FEATURE BACKLOG (World-class platform)

### HIGH — Core (Done)

- [x] **FEAT-01**: Structured Logging (pino)
- [x] **FEAT-02**: OpenAPI Documentation (swagger-jsdoc)
- [x] **FEAT-04**: Activity Audit Log
- [x] **FEAT-05**: Backup/Restore

### MEDIUM — Enhanced Features

- [x] **FEAT-06**: Dark Mode
- [ ] **FEAT-03**: Graceful Degradation — circuit breaker for module initialization (partially done)
- [ ] **FEAT-07**: Multi-user Roles — admin/user/guest JWT role system
- [ ] **FEAT-08**: Webhook Integration — IFTTT/Zapier compatible endpoints
- [ ] **FEAT-09**: Energy Dashboard Analytics — time-series charts
- [ ] **FEAT-10**: Health Check Cascade — /ready checks downstream deps
- [ ] **FEAT-11**: WebSocket Event Documentation

### LOW — Polish & DX

- [ ] **FEAT-12**: Developer Onboarding (CONTRIBUTING.md)
- [ ] **FEAT-13**: Module Generator CLI
- [ ] **FEAT-14**: Performance Metrics Dashboard
- [ ] **FEAT-15**: Docker Compose Profiles
