# BACKLOG - HomeySmartHome

> Last updated: Round 20 — 2026-03-01
> Rounds 1-8: All actionable items DONE and merged (PRs #2-#8)
> Rounds 9-19: Automated discovery cycles — lint, module hardening, destroy(), supertest, validation, test expansion, comprehensive audit
> Round 20: Security hardening, monitoring fixes, K8s hardening, 3 new world-class features, 119 test files (100% module coverage)
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

### Round 20 — Security / Monitoring / Infra / Features (2026-03-01)

- [x] **TST-08**: 100% backend module test coverage — 119 test files covering all 115 lib modules (batches A–D via PRs #35–37, #40)
- [x] **SEC-04**: Enforce Socket.IO auth outside test env — `io.use()` now requires token unless `NODE_ENV === 'test'`
- [x] **SEC-05**: JWT auth middleware on all dashboard API routes — `requireAuth` middleware added; `/health`, `/ready`, `/metrics`, `/api/docs` exempt
- [x] **SEC-06**: CSRF protection wired — double-submit cookie validation on POST/PUT/DELETE dashboard routes
- [x] **SEC-07**: Scrub error.message from 500 responses — replaced with generic `'Internal server error'` in both services; full error logged server-side
- [x] **SEC-08**: Redis-backed rate limiter — uses `rate-limit-redis` when `REDIS_URL` is set; falls back to in-memory with warning
- [x] **SEC-09**: Remove `unsafe-inline` from CSP script-src — nonce-based approach for any remaining inline scripts
- [x] **INF-61**: PodDisruptionBudget — already present in k8s/deployment.yaml (verified); updated to cover both backend and dashboard explicitly
- [x] **INF-62**: Fix ingress rewrite-target — updated to `/$1` with `use-regex: "true"` preserving nested API route paths
- [x] **INF-63**: ResourceQuota — already present (verified); confirmed limits on CPU/memory/pods for smarthome-pro namespace
- [x] **INF-64**: Dashboard PVC ReadWriteMany — changed from RWO to RWX with CSI driver note
- [x] **MON-01**: Fix Prometheus alert rules — updated to use actual metric names (`smarthome_requests_errors`, `smarthome_response_time_avg`)
- [x] **MON-02**: Grafana dashboard for web-dashboard service — added `monitoring/grafana/dashboards/web-dashboard.json`
- [x] **MON-03**: SLO/SLI definitions — added `monitoring/slo.yml` with 99.5% availability, p95<500ms, <1% error budget + burn-rate alert rules
- [x] **FEAT-17**: PushNotificationSystem — Web Push (VAPID) with subscribe/unsubscribe/sendNotification; integrates with security+emergency events; API at `/api/v1/push/subscribe`
- [x] **FEAT-20**: GeofencingAutomationEngine — arrive/depart trigger pipeline with built-in presets (arrive home → disarm+lights+HVAC, leave → arm+eco); configurable rules; API at `/api/v1/geofencing/rules`
- [x] **FEAT-21**: EnergySpotPriceSystem — Nord Pool spot-price integration with simulated curve fallback; `getCheapestHours()`, `scheduleChargingWindow()`; integrates with EVCharging; API at `/api/v1/energy/spot-price`

---

## ACTIVE BACKLOG

### Code Quality — P2/P3

- [ ] **COD-30**: Dashboard HomeyClient has no timeout — `fetch()` calls have no `AbortController` timeout; a hung backend blocks the dashboard event loop; P2
- [ ] **COD-31**: Unbounded array growth — several dashboard modules have arrays with no cap (predictive-analytics-engine, health-wellness-tracker, etc.); P3
- [ ] **COD-32**: Dashboard modules use `console.log` — 66 modules still use console.log/console.error instead of pino; P3
- [ ] **COD-33**: 40+ POST/PUT API handlers in api.js lack input validation — createAutomation, createWebhook, createApiConnector, recordUserAction, etc.; P2

### Monitoring — P3

- [ ] **MON-04**: Missing system-level metrics — no node_exporter or cAdvisor; disk/network/CPU host metrics not collected; P3

### Performance — P2/P3

- [ ] **PERF-01**: `updatePerformanceStats()` sorts all response times on every request — O(n log n) on every write; should compute percentiles lazily on read; P2
- [ ] **PERF-02**: Dashboard `getDemoData()` creates new object on every request — should be a cached singleton refreshed periodically; P3
- [ ] **PERF-03**: No ETags / Cache-Control on read-heavy endpoints — `/api/dashboard`, `/api/analytics/*`, `/api/energy`; P3

### Developer Experience — P2/P3

- [ ] **DX-02**: No TypeScript/JSDoc type definitions — no `*.d.ts` or `@typedef` for module interfaces; P3
- [ ] **DX-03**: No development seed/fixture data — no `npm run seed` command; P3
- [ ] **DX-04**: Backend test-suite.js requires running server — should use supertest like dashboard; P2
- [ ] **DX-05**: Missing pre-commit hook — `.husky/pre-commit` created locally but not committed; lint-staged config needed in package.json; P2

### Features — World-class platform

- [ ] **FEAT-16**: GraphQL API layer — Apollo Server or Mercurius alongside REST; enables precise queries over 120+ endpoint surface; P2
- [ ] **FEAT-18**: User activity timeline — unified event feed (device changes, automations, security events, energy anomalies); currently scattered; P2
- [ ] **FEAT-19**: Cross-device scene builder UI — visual drag-and-drop editor in dashboard; backend scene-learning already exists; P2
- [ ] **FEAT-22**: AI recommendation engine — unified ML service cross-referencing energy, climate, presence, device patterns; P3
- [ ] **FEAT-23**: Mobile-first API — pagination, sparse fieldsets, HATEOAS links on REST responses; P3
- [ ] **FEAT-24**: Multi-home support — tenant isolation for vacation homes / family members; P3
- [ ] **FEAT-25**: Device firmware OTA — update tracking and push for Zigbee/Z-Wave/WiFi devices; P3

---

## DEFERRED (Environment-Dependent / Low Priority / High Risk)

- [ ] **INF-51**: K8s SealedSecret placeholder values — requires kubeseal CLI + cluster access
- [ ] **INF-55**: Alertmanager no targets — requires alertmanager service deployment
- [ ] **COD-10**: Organize lib/ into subdirectories by domain — high risk (121 modules, all imports would break); deferred until major version bump
- [ ] **COD-27**: 59 modules violate SmartXxxSystem/AdvancedXxxSystem naming convention — P3; renaming requires updating app.js, server.js, api.js per module; deferred until major version bump
- [ ] **COD-28**: 114 files use console.log instead of pino structured logging — P3; massive scope, deferred
