# BACKLOG - HomeySmartHome

> Audit Round 19 — 2026-02-28
> Rounds 1-8: All actionable items DONE and merged (PRs #2-#8)
> Rounds 9-18: Automated discovery cycles — lint, module hardening, destroy(), supertest, validation, test expansion
> Round 19: Comprehensive audit — COD-29 fix, security/performance/infra/feature backlog refresh
> Status: [ ] = TODO, [x] = DONE

---

## COMPLETED (Rounds 1-8)

### Security
- [x] eval() removal, prototype pollution, XSS, CSRF, IP spoofing
- [x] CSRF crash fix, registerInterval fix, settings key collision
- [x] Supply chain: pinned CI actions, .dockerignore hardening
- [x] FEAT-07: Multi-user roles (admin/user/guest) with JWT claims + RBAC

### Code Quality
- [x] Structured logging (pino), all console.log replaced
- [x] OpenAPI/Swagger docs at /api/docs
- [x] BaseSystem consolidation + top-5 module migration (COD-05)
- [x] 160+ unit tests (142 backend + 18 dashboard + 3 Playwright E2E specs)
- [x] COD-11: JSDoc type annotations on public API methods (AdvancedNotificationManager, AuditLogSystem, BackupRecoverySystem, DeviceHealthMonitor, GeofencingEngine)
- [x] ESLint: 0 errors (added setImmediate global, caughtErrorsIgnorePattern)

### Infrastructure

- [x] K8s: SecurityContext, NetworkPolicy, RBAC, PDB, PodSecurity, HTTPS egress
- [x] Nginx: Mozilla TLS ciphers, rate limiting, error pages, session tickets
- [x] CI/CD: Trivy, CodeQL, cosign, SBOM, lint gating
- [x] Monitoring: alert fix, retention, Grafana hardening
- [x] FEAT-14: Performance metrics (/metrics with CPU, heap, event loop lag)
- [x] FEAT-15: Docker Compose profiles (monitoring)

### Features

- [x] FEAT-01: Structured Logging
- [x] FEAT-02: OpenAPI Documentation
- [x] FEAT-03: Graceful Degradation
- [x] FEAT-04: Activity Audit Log
- [x] FEAT-05: Backup/Restore
- [x] FEAT-06: Dark Mode
- [x] FEAT-07: Multi-user Roles (RBAC)
- [x] FEAT-08: Webhook Integration
- [x] FEAT-09: Energy Dashboard Analytics (EnergyAnalytics class + dashboard panel + E2E tests)
- [x] FEAT-10: Health Check Cascade
- [x] FEAT-11: WebSocket Event Documentation
- [x] FEAT-12: CONTRIBUTING.md
- [x] FEAT-13: Module Generator CLI (`npx create-module <name>` with BaseSystem template + test scaffold)
- [x] FEAT-14: Performance Metrics Dashboard
- [x] FEAT-15: Docker Compose Profiles
- [x] TST-04: End-to-end test framework (Playwright config + health/api/dashboard specs)

---

## Round 9 — Automated Discovery (2026-02-26)

### In Progress (this PR)

- [x] **COD-20**: Register 3 unregistered modules (SmartHomeAdaptiveLearningSystem, SmartHomeAutomatedTestingSystem, SmartHomePredictiveCleaningSystem) in app.js + server.js
- [x] **COD-21**: Add destroy() methods to 6 critical interval-leaking modules (SmartWaterManagementSystem, EnergyStorageManagementSystem, PredictiveMaintenanceScheduler, AmbientIntelligenceSystem, AirQualityManagementSystem, performance-monitor)
- [x] **COD-22**: Fix 148+ ESLint no-unused-vars warnings in web-dashboard (prefix unused params with `_`)

### Round 10 — Delivery Mode (2026-02-26)

- [x] **COD-25**: Fix 298 ESLint no-unused-vars warnings in homey-app backend → 0 errors, 0 warnings
- [x] **COD-24**: Add try-catch error handling to 20+ module initialize() methods
- [x] **COD-23** (partial): destroy() audit — confirmed BaseSystem extenders already covered; standalone modules addressed

### Round 11 — Stabilization (2026-02-26)

- [x] **COD-23**: Add destroy() methods to 58 dashboard modules with interval/timeout leaks — stores refs in `this._intervals`/`this._timeouts`, clears in `destroy()`
- [x] **COD-26**: Refactor test-suite.js to use supertest — no running server required; 11/11 tests pass; added `module.exports = { app }` to server.js with `require.main` guard

### Round 12 — Test Infrastructure (2026-02-28)

- [x] **BUG-01**: Fix dashboard test suite hanging — guard `periodicUpdateInterval` behind `require.main === module` in server.js; export `_cleanup()` function; add `after(() => _cleanup())` to http-routes.test.js; add `afterEach(() => loader.destroyAll())` to module-loader.test.js
- [x] **INF-60**: Add `--test-force-exit --test-timeout=30000` to dashboard npm test script — 58/59 modules leak 1+ timers after destroy() (systemic); force-exit ensures CI exits cleanly
- [x] **COD-29**: Fix timer leaks in 8 dashboard modules — bare setInterval/setTimeout calls not tracked in _intervals/_timeouts arrays (sustainability-carbon-tracker, vehicle-fleet-manager, mood-lighting, home-security-system, sleep-optimizer, indoor-climate-optimizer, smart-doorbell-facial-recognition, advanced-scheduler)

### Round 13 — Backend Test Expansion (2026-02-28)

- [x] **TST-05**: Add backend unit tests for SmartSchedulingSystem, EnergyForecastingEngine, DeviceHealthMonitor — 3 new test files, 106 assertions, all passing

### Round 14 — API Input Validation (2026-02-28)

- [x] **SEC-01**: Add input validation to 18 security-critical API endpoints — created validation library (schemas.js, validator.js, sanitize.js) with type/format/range/enum/pattern checks; wired global prototype-pollution middleware; 84 new assertions covering all validators and schemas

### Round 15 — Error Details & Test Expansion (2026-02-28)

- [x] **DX-01**: Add `err.details` to 400 error responses in server.js — validation errors now include structured detail array alongside error message
- [x] **TST-06a**: ErrorHandlingMiddleware test suite — 40 assertions covering classifyError severity tiers, recordError dedup/history cap/storm detection, retry/fallback/circuit-breaker/gracefulDegrade, wrapAsync/wrapSync re-throw, createHandler, getErrorReport/getErrorsBySystem/getErrorTrends/clearErrors/getSummary, destroyInstance cleanup
- [x] **TST-06b**: BackupRecoverySystem test suite — 30 assertions covering createBackup/getBackup/deleteBackup, backup integrity verification, export/import round-trip, getLatestBackup recency, detectChanges, statistics, collectSystemData, compression/encryption toggles, destroy cleanup
- [x] **TST-06c**: AdvancedSecuritySystem test suite — 43 assertions covering calculateDistance, zone arm/disarm, timeline events + evidence linking, visitor scheduling + revocation, audit trail filtering, duress codes, silent alarm, escalation config/cancel, night vision, setSecurityMode, geofence location tracking, getStatistics, getSensorHealthReport, destroy cleanup

### Round 16 — Security Hardening & Test Expansion (2025-07-13)

- [x] **SEC-02**: Restrict `/metrics` and `/api/v1/stats` (backend) + `/metrics` and `/api/stats` (dashboard) — added `metricsLimiter` (30 req/min) and `internalOnly` middleware (private IP check + optional METRICS_TOKEN bearer auth)
- [x] **SEC-03**: Remove HOMEY_TOKEN from dashboard `appContext.config` broadcast — prevents token leaking to all Socket.IO clients
- [x] **CI-01**: Tighten npm audit from `--audit-level=high` to `--audit-level=moderate` in CI/CD pipeline
- [x] **TST-07a**: SmartLockManagementSystem test suite — 77 assertions covering lock CRUD, auto-lock timer, access code management, lock/unlock operations, battery monitoring, guest code lifecycle, lockout policy, failed access logging, access log retrieval
- [x] **TST-07b**: HomeEmergencyResponseSystem test suite — 128 assertions covering constructor (17), initialize (4), sensor events (5), correlation engine (5), emergency trigger (8), resolveEmergency (9), wellbeing checks (3), panic button (3), lockdown (6), drills (6), evacuation routes (5), safe room (4), power backup (9), damage assessment (3), contacts (5), equipment (5), lighting (2+3), sensors (3), active emergencies (2), incident history (3), drill schedule (1), weather (1), statistics (7), alert formatting (3), recovery (2), generator (2), destroy (2)
- [x] **LINT-01**: Clean all ESLint warnings across 6 test files — removed unused imports and variables; 0 errors, 0 warnings with `--max-warnings 0`

### Round 19 — Comprehensive Audit (2026-02-28)

- [x] **COD-29**: Fix timer leaks in 8 dashboard modules — tracked bare setInterval/setTimeout in _intervals/_timeouts; cleared activeTimers Map in advanced-scheduler destroy(); cleared musicPulseInterval in mood-lighting destroy()

---

## ACTIVE BACKLOG

### Security — P1

- [ ] **SEC-04**: Socket.IO auth bypass in non-production — `io.use()` middleware in dashboard server.js only requires token when `NODE_ENV === 'production'`; any non-production deployment (staging, dev) has no Socket.IO auth; P1
- [ ] **SEC-05**: Dashboard API routes lack authentication — `/api/dashboard`, `/api/devices`, `/api/zones`, `/api/energy`, `/api/security`, `/api/analytics/*` all respond without JWT/session check; only Socket.IO has a (weak) auth gate; P1
- [ ] **SEC-06**: CSRF protection not wired on dashboard — `SecurityMiddleware.csrfProtection()` exists but `csrfProtection().validateToken` is never used as middleware in server.js; POST endpoints accept requests without CSRF tokens; P1
- [ ] **SEC-07**: `error.message` leaks to client in 500 responses — multiple endpoints return `res.status(500).json({ error: error.message })`, which can expose internal stack traces, file paths, or SQL errors; P2
- [ ] **SEC-08**: Rate limiter uses in-memory Map — no shared state across replicas in K8s (2+ pods); attackers can bypass by hitting different pods; needs Redis-backed store for production; P2
- [ ] **SEC-09**: Content-Security-Policy allows 'unsafe-inline' for scripts — CSP in security-middleware.js includes `'unsafe-inline'` for scripts which weakens XSS protection; should use nonces or hashes; P2

### Code Quality — P2

- [ ] **COD-30**: Dashboard HomeyClient has no timeout — `fetch()` calls in server.js HomeyClient have no `AbortController` timeout; a slow/hung backend blocks the dashboard event loop indefinitely; P2
- [ ] **COD-31**: Unbounded array growth in anomaly-detection — `this.anomalies` array is trimmed at 1000 entries but several dashboard modules (predictive-analytics-engine, health-wellness-tracker, etc.) have similar unbounded arrays with no cap; P3
- [ ] **COD-32**: Dashboard modules use `console.log` instead of structured logger — 66 modules still use console.log/console.error; should share the same pino logger instance; P3 (related to COD-28)
- [ ] **COD-33**: 40+ API handlers in api.js lack input validation — only 19 endpoints use `validateOrThrow`; remaining POST/PUT handlers (createAutomation, createWebhook, createApiConnector, recordUserAction, etc.) accept arbitrary body without validation; P2

### Infrastructure — P2

- [ ] **INF-61**: No PodDisruptionBudget for dashboard deployment — backend has implicit protection via HPA minReplicas=2 but no explicit PDB; dashboard also lacks PDB; rolling updates could cause brief downtime; P2
- [ ] **INF-62**: Ingress rewrite-target strips path context — `nginx.ingress.kubernetes.io/rewrite-target: /` will rewrite all paths to `/`, breaking nested API routes; needs path-based routing without blanket rewrite; P2
- [ ] **INF-63**: No resource quotas on namespace — `smarthome-pro` namespace has no ResourceQuota limiting total CPU/memory; a runaway pod can starve others; P3
- [ ] **INF-64**: Dashboard deployment shares PVC with ReadWriteOnce — `dashboard-data` PVC is RWO but dashboard has 2+ replicas; only one pod can mount RWO at a time on most storage backends; needs RWX or per-pod storage; P2

### Monitoring — P2

- [ ] **MON-01**: Prometheus alert rules reference metrics the app does not expose — alerts reference `http_requests_total{status=~"5.."}` and `http_request_duration_seconds_bucket` but the app exposes `smarthome_requests_errors` and `smarthome_response_time_avg`; alerts will never fire; P1
- [ ] **MON-02**: No Grafana dashboard for dashboard service — only `smarthome-dashboard.json` exists, likely for backend only; dashboard service metrics are scraped but not visualized; P2
- [ ] **MON-03**: No SLO/SLI definitions — no error budget, latency SLOs, or availability targets defined; essential for production reliability engineering; P2
- [ ] **MON-04**: Missing disk and network I/O metrics — Prometheus only scrapes custom app metrics; no node_exporter or cAdvisor for system-level metrics; P3

### Performance — P2

- [ ] **PERF-01**: `updatePerformanceStats()` sorts all response times on every request — `[...this.metrics.performance.responseTimes].sort()` runs O(n log n) on up to 1000 items per request; should use a streaming percentile algorithm (t-digest or reservoir sampling); P2
- [ ] **PERF-02**: Dashboard getDemoData() creates a new object on every call — called on every `/api/dashboard`, `/api/devices`, `/api/zones` request; should be a cached singleton refreshed periodically; P3
- [ ] **PERF-03**: No response caching on read-heavy endpoints — `/api/dashboard`, `/api/analytics/*`, `/api/energy` return dynamic data but could benefit from short-TTL ETags or Cache-Control headers for near-real-time use; P3

### Developer Experience — P2

- [ ] **DX-02**: No TypeScript type definitions — no `*.d.ts` files or JSDoc `@typedef` for module interfaces; autocomplete and refactoring safety is limited; P3
- [ ] **DX-03**: No development seed/fixture data — tests create their own fixtures but there is no `npm run seed` command to populate a dev instance with realistic data; P3
- [ ] **DX-04**: Backend test-suite.js requires running server — integration tests use raw HTTP and need `npm run start:dev` running; should be converted to supertest like the dashboard; P2
- [ ] **DX-05**: Missing pre-commit hook — no husky/lint-staged config; developers can commit unlinted code; P2

### Features — World-class platform

- [ ] **FEAT-16**: GraphQL API layer — add Apollo Server or Mercurius alongside REST; enables mobile apps and third-party integrations to query exactly the data they need; reduces over-fetching for 120+ endpoint surface; P2
- [ ] **FEAT-17**: Real-time push notifications — WebSocket events exist but no push notification channel (FCM, APNs, Web Push); critical for security alerts, emergency responses, energy anomalies when user is away; P1
- [ ] **FEAT-18**: User activity timeline — unified event feed showing device changes, automations triggered, security events, energy anomalies; currently scattered across module-specific arrays; P2
- [ ] **FEAT-19**: Cross-device scene builder UI — backend has scene learning + templates but dashboard lacks a visual scene editor with drag-and-drop device/condition/action builder; P2
- [ ] **FEAT-20**: Geofencing trigger automation — GeofencingEngine exists but no automated trigger pipeline (arrive home → disarm + lights on + HVAC boost); needs event-driven rule engine integration; P2
- [ ] **FEAT-21**: Energy spot-price integration — Swedish energy market (Nord Pool) spot prices would enable automated cost optimization (charge EV at cheapest hours, pre-heat before price spikes); P2
- [ ] **FEAT-22**: AI recommendation engine — modules generate isolated recommendations; need a unified ML-based recommendation service that cross-references energy, climate, presence, and device usage patterns; P3
- [ ] **FEAT-23**: Mobile-first API design — add pagination, sparse fieldsets, and HATEOAS links to REST responses; current API returns full objects always; P3
- [ ] **FEAT-24**: Multi-home support — current architecture assumes single home; need tenant isolation for users managing vacation homes or family member homes; P3
- [ ] **FEAT-25**: Device firmware OTA management — no firmware update tracking or push capability for Zigbee/Z-Wave/WiFi devices; P3

---

## DEFERRED (Environment-Dependent / Low Priority / High Risk)

- [ ] **INF-51**: K8s SealedSecret placeholder values — requires kubeseal CLI + cluster access
- [ ] **INF-55**: Alertmanager no targets — requires alertmanager service deployment
- [ ] **COD-10**: Organize lib/ into subdirectories by domain — high risk (121 modules, all imports would break); deferred until major version bump
- [ ] **COD-27**: 59 modules violate SmartXxxSystem/AdvancedXxxSystem naming convention — P3; renaming requires updating app.js, server.js, api.js per module; deferred until major version bump
- [ ] **COD-28**: 114 files use console.log instead of pino structured logging — P3; massive scope, deferred
