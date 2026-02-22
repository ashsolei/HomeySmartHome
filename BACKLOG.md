# BACKLOG - HomeySmartHome Audit Findings

> Generated from comprehensive audit on 2026-02-22
> Status: [ ] = TODO, [x] = DONE, [~] = IN PROGRESS

---

## CRITICAL (Must fix before production)

- [ ] **SEC-01**: Remove `eval()` in AdvancedAutomationEngine.js:579 — arbitrary code execution via user-supplied boolean logic
- [ ] **SEC-02**: Remove `new Function()` in SmartSchedulingSystem.js:632 — arbitrary code execution via user-supplied scripts
- [ ] **SEC-03**: Fix XSS via `innerHTML` with unsanitized data in settings/index.html (lines 713, 740, 792, 810, 888) and web-dashboard/public/app.js (lines 178, 213, 267, 300, 314, 373, 644, 668, 698)
- [ ] **INF-01**: Add Kubernetes SecurityContext (runAsNonRoot, readOnlyRootFilesystem, drop ALL capabilities)
- [ ] **INF-02**: Add Kubernetes NetworkPolicy for namespace isolation

## HIGH

- [ ] **SEC-04**: Fix IP spoofing via `X-Forwarded-For` in server.js:592 — rate limiter can be bypassed; set `trust proxy` correctly
- [ ] **SEC-05**: Fix IP spoofing in web-dashboard/security-middleware.js:198 — same issue as SEC-04
- [ ] **SEC-06**: Fix IP spoofing in APIAuthenticationGateway.js:624 — trusts X-Forwarded-For without proxy trust
- [ ] **DEP-01**: Fix npm audit vulnerabilities — minimatch ReDoS (4 high), ajv ReDoS (1 moderate) in homey-app
- [ ] **DEP-02**: Fix npm audit vulnerabilities in web-dashboard (same pattern)
- [ ] **INF-03**: Add RBAC (ServiceAccount + Role/RoleBinding) to Kubernetes
- [ ] **INF-04**: Configure SSL/TLS in nginx (currently HTTP only on port 80)
- [ ] **INF-05**: Remove `unsafe-inline` from CSP in nginx.conf — defeats CSP protection
- [ ] **INF-06**: Configure Prometheus alert rules (currently empty)
- [ ] **INF-07**: Add Grafana dashboards (only datasource configured, no dashboards)
- [ ] **INF-08**: Move K8s secrets from plaintext YAML (stringData) to sealed-secrets

## MEDIUM

- [ ] **SEC-07**: Add CSRF protection to mutating API endpoints
- [ ] **SEC-08**: Add Socket.IO authentication (currently open connection)
- [ ] **SEC-09**: Add input validation for `parseInt(query.*)` in api.js (40+ instances with no bounds checking)
- [ ] **COD-01**: Many lib/ modules don't use BaseSystem class — inconsistent destroy/cleanup patterns
- [ ] **COD-02**: Modules use `var` and `function()` instead of modern `const/let` and arrow functions
- [ ] **INF-09**: Make npm audit fail CI pipeline (currently `npm audit || true` ignores failures)
- [ ] **INF-10**: Add container image scanning (Trivy) to CI/CD
- [ ] **INF-11**: Restrict metrics endpoint IP ranges (currently allows 10.0.0.0/8)
- [ ] **INF-12**: Grafana default password 'changeme' in docker-compose.dev.yml
- [ ] **INF-13**: Redis not password-protected in docker-compose.dev.yml
- [ ] **INF-14**: Add SAST/code scanning (CodeQL) to CI/CD
- [ ] **TST-01**: Only 23 backend tests and 11 dashboard tests — insufficient for 118+ modules and 120+ endpoints
- [ ] **INF-15**: Add `imagePullPolicy: IfNotPresent` to K8s (currently Always)
- [ ] **INF-16**: Add resource quotas per K8s namespace
- [ ] **INF-17**: Add pod disruption budgets and anti-affinity rules

## LOW

- [ ] **COD-03**: Clean up unused AUTONOMOUS_FEATURES_WAVE*.md documentation files (7 files)
- [ ] **COD-04**: Consolidate duplicate documentation (OPTIMIZATION_REPORT.md, DOCUMENTATION_AUDIT.md, etc.)
- [ ] **INF-18**: Add startup probes to K8s deployments
- [ ] **INF-19**: Add Docker image signing/attestation
- [ ] **INF-20**: Archive test artifacts in CI/CD
- [ ] **INF-21**: Add custom HPA metrics (request-based scaling)
- [ ] **TST-02**: Add test coverage for error/edge cases
