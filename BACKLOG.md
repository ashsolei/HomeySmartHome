# BACKLOG - HomeySmartHome

> Audit Round 8 — 2026-02-24
> Rounds 1-8: All actionable items DONE and merged (PRs #2-#8)
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

## DEFERRED (Environment-Dependent / Low Priority)

- [ ] **INF-51**: K8s SealedSecret placeholder values — requires kubeseal CLI + cluster access
- [ ] **INF-55**: Alertmanager no targets — requires alertmanager service deployment
- [ ] **COD-10**: Organize lib/ into subdirectories by domain — high risk (121 modules, all imports would break); deferred until major version bump
