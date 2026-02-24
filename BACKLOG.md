# BACKLOG - HomeySmartHome

> Audit Round 6 — 2026-02-24
> Rounds 1-5: All items DONE and merged (PRs #2-#6)
> Status: [ ] = TODO, [x] = DONE

---

## COMPLETED (Rounds 1-6)

### Security
- [x] eval() removal, prototype pollution, XSS, CSRF, IP spoofing
- [x] CSRF crash fix, registerInterval fix, settings key collision
- [x] Supply chain: pinned CI actions, .dockerignore hardening
- [x] FEAT-07: Multi-user roles (admin/user/guest) with JWT claims + RBAC

### Code Quality
- [x] Structured logging (pino), all console.log replaced
- [x] OpenAPI/Swagger docs at /api/docs
- [x] BaseSystem consolidation + top-5 module migration (COD-05)
- [x] 160 unit tests (142 backend + 18 dashboard)

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
- [x] FEAT-10: Health Check Cascade
- [x] FEAT-11: WebSocket Event Documentation
- [x] FEAT-12: CONTRIBUTING.md
- [x] FEAT-14: Performance Metrics Dashboard
- [x] FEAT-15: Docker Compose Profiles

---

## REMAINING (Low Priority)

- [ ] **INF-51**: K8s SealedSecret placeholder values — environment-dependent, needs kubeseal
- [ ] **INF-55**: Alertmanager no targets — needs alertmanager service deployment
- [ ] **FEAT-09**: Energy Dashboard Analytics — time-series charts (frontend-heavy)
- [ ] **FEAT-13**: Module Generator CLI — `npx create-module <name>` scaffolding
- [ ] **COD-10**: Organize lib/ into subdirectories by domain
- [ ] **COD-11**: JSDoc type annotations on public API methods
- [ ] **TST-04**: End-to-end test framework (Playwright)
