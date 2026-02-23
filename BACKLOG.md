# BACKLOG - HomeySmartHome Audit Findings

> Generated from comprehensive audit on 2026-02-22
> Updated: 2026-02-23 (Round 2 complete)
> Status: [ ] = TODO, [x] = DONE, [~] = IN PROGRESS

---

## CRITICAL (Must fix before production)

- [x] **SEC-01**: Remove `eval()` in AdvancedAutomationEngine.js — replaced with `_safeBooleanEval()`
- [x] **SEC-02**: Remove `new Function()` in SmartSchedulingSystem.js — replaced with safe switch statements
- [x] **SEC-03**: Fix XSS via `innerHTML` — added `escapeHtml()` sanitization
- [x] **INF-01**: Add Kubernetes SecurityContext (runAsNonRoot, readOnlyRootFilesystem, drop ALL)
- [x] **INF-02**: Add Kubernetes NetworkPolicy for namespace isolation

## HIGH

- [x] **SEC-04**: Fix IP spoofing in server.js — set `trust proxy` to 1
- [x] **SEC-05**: Fix IP spoofing in security-middleware.js — uses `req.ip` with trust proxy
- [x] **SEC-06**: Fix IP spoofing in APIAuthenticationGateway.js — uses `req.ip` with trust proxy
- [x] **DEP-01**: Fix npm audit vulnerabilities in homey-app — 0 vulnerabilities
- [x] **DEP-02**: Fix npm audit vulnerabilities in web-dashboard — 0 vulnerabilities
- [x] **INF-03**: Add RBAC (ServiceAccount + Role/RoleBinding) to Kubernetes
- [x] **INF-04**: Configure SSL/TLS in nginx (TLS 1.2+, proper ciphers)
- [x] **INF-05**: Remove `unsafe-inline` from CSP style-src in nginx.conf
- [x] **INF-06**: Configure Prometheus alert rules (5 rules in alerts.yml)
- [x] **INF-07**: Add Grafana dashboards (smarthome-dashboard.json)
- [x] **INF-08**: Move K8s secrets to SealedSecrets pattern

## MEDIUM

- [x] **SEC-07**: Add CSRF protection to mutating API endpoints
- [x] **SEC-08**: Add Socket.IO authentication (token-based in production)
- [x] **SEC-09**: Add input validation for `parseInt(query.*)` in api.js — `parseQueryInt()` helper
- [x] **COD-01**: Create BaseSystem class for consistent destroy/cleanup patterns
- [x] **COD-02**: Modules use modern `const/let` and class syntax
- [x] **INF-09**: npm audit fails CI pipeline (audit-level=high)
- [x] **INF-10**: Add Trivy container scanning to CI/CD
- [x] **INF-11**: Restrict metrics endpoint IP ranges in nginx
- [x] **INF-12**: Grafana default password — require explicit GRAFANA_PASSWORD env var
- [x] **INF-13**: Redis password protection in docker-compose.dev.yml
- [x] **INF-14**: Add CodeQL SAST scanning to CI/CD
- [x] **TST-01**: Expand test suite — 127 unit tests + 23 integration tests
- [x] **INF-15**: Change `imagePullPolicy` to `IfNotPresent` in K8s
- [x] **INF-16**: Add resource quotas per K8s namespace
- [x] **INF-17**: Add pod disruption budgets and anti-affinity rules

## LOW

- [x] **COD-03**: Clean up unused AUTONOMOUS_FEATURES_WAVE*.md documentation files
- [x] **COD-04**: Consolidate duplicate documentation (removed OPTIMIZATION_REPORT.md, DOCUMENTATION_AUDIT.md)
- [x] **INF-18**: Add startup probes to K8s deployments
- [x] **INF-19**: Add Docker image signing/attestation (cosign + SBOM)
- [x] **INF-20**: Archive test artifacts in CI/CD
- [x] **INF-21**: Add custom HPA metrics (request-based scaling)
- [x] **TST-02**: Add test coverage for error/edge cases (127 unit tests)
