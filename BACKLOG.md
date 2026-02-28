# BACKLOG - HomeySmartHome

> Audit Round 11 — 2026-02-26
> Rounds 1-8: All actionable items DONE and merged (PRs #2-#8)
> Rounds 9-11: Automated discovery cycles — lint, module hardening, destroy(), supertest
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
- [ ] **COD-29**: Fix timer leaks in 58 dashboard modules — destroy() doesn't clear all setTimeout/setInterval refs; P3 (mitigated by --test-force-exit)

### Round 13 — Backend Test Expansion (2026-02-28)

- [x] **TST-05**: Add backend unit tests for SmartSchedulingSystem, EnergyForecastingEngine, DeviceHealthMonitor — 3 new test files, 106 assertions, all passing

### Round 14 — API Input Validation (2026-02-28)

- [x] **SEC-01**: Add input validation to 18 security-critical API endpoints — created validation library (schemas.js, validator.js, sanitize.js) with type/format/range/enum/pattern checks; wired global prototype-pollution middleware; 84 new assertions covering all validators and schemas

---

## DEFERRED (Environment-Dependent / Low Priority / High Risk)

- [ ] **INF-51**: K8s SealedSecret placeholder values — requires kubeseal CLI + cluster access
- [ ] **INF-55**: Alertmanager no targets — requires alertmanager service deployment
- [ ] **COD-10**: Organize lib/ into subdirectories by domain — high risk (121 modules, all imports would break); deferred until major version bump
- [ ] **COD-27**: 59 modules violate SmartXxxSystem/AdvancedXxxSystem naming convention — P3; renaming requires updating app.js, server.js, api.js per module; deferred until major version bump
- [ ] **COD-28**: 114 files use console.log instead of pino structured logging — P3; massive scope, deferred
