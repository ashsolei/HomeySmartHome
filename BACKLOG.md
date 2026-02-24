# BACKLOG - HomeySmartHome

> Audit Round 5 — 2026-02-24
> Rounds 1-4: All items DONE and merged (PRs #2-#5)
> Status: [ ] = TODO, [x] = DONE

---

## COMPLETED (Rounds 1-5)

### Security (Rounds 1-4)
- [x] eval() removal, prototype pollution fix, XSS fixes, CSRF tokens
- [x] IP spoofing fix, CSP headers, CORS validation
- [x] CSRF crash fix, registerInterval fix, settings key collision fix
- [x] Supply chain: pinned CI actions, .dockerignore hardening

### Code Quality (Rounds 1-4)
- [x] Structured logging (pino), all console.log replaced
- [x] OpenAPI/Swagger docs at /api/docs
- [x] BaseSystem consolidation, duplicate module removal
- [x] 145 unit tests (127 backend + 18 dashboard)

### Infrastructure (Rounds 1-4)
- [x] K8s hardening: SecurityContext, NetworkPolicy, RBAC, PDB
- [x] Nginx: Mozilla TLS ciphers, rate limiting, session tickets off
- [x] CI/CD: Trivy, CodeQL, cosign, SBOM, web-dashboard lint
- [x] Monitoring: fixed alert expressions, retention limits, Grafana provisioning

### Features (Rounds 1-5)
- [x] FEAT-01: Structured Logging (pino)
- [x] FEAT-02: OpenAPI Documentation
- [x] FEAT-03: Graceful Degradation (circuit breaker + getSystemHealth)
- [x] FEAT-04: Activity Audit Log
- [x] FEAT-05: Backup/Restore
- [x] FEAT-06: Dark Mode
- [x] FEAT-08: Webhook Integration (POST /api/webhook/trigger)
- [x] FEAT-10: Health Check Cascade (/ready with downstream checks)
- [x] FEAT-11: WebSocket Event Documentation
- [x] FEAT-12: CONTRIBUTING.md

---

## REMAINING

### MEDIUM

- [ ] **INF-51**: K8s SealedSecret contains placeholder values — needs kubeseal workflow
- [ ] **INF-55**: Alertmanager has no targets — needs alertmanager service + receivers
- [ ] **FEAT-07**: Multi-user Roles — admin/user/guest JWT role system
- [ ] **FEAT-09**: Energy Dashboard Analytics — time-series charts for consumption trends

### LOW

- [ ] **COD-05**: Migrate top-20 interval-heavy modules to extend BaseSystem
- [ ] **COD-10**: Organize lib/ into subdirectories by domain
- [ ] **COD-11**: JSDoc type annotations on public API methods
- [ ] **TST-04**: End-to-end test framework (Playwright)
- [ ] **FEAT-13**: Module Generator CLI
- [ ] **FEAT-14**: Performance Metrics Dashboard (event loop lag, heap, GC via /metrics)
- [ ] **FEAT-15**: Docker Compose Profiles (minimal/standard/full/dev)
