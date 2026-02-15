---
name: security-audit
description: "Performs comprehensive security audits of HomeySmartHome code and infrastructure covering OWASP Top 10, dependency vulnerabilities, Docker hardening, Nginx headers, rate limiting, and secrets management"
argument-hint: "[scope: full|backend|dashboard|docker|nginx]"
---

# Security Audit

Comprehensive security audit for the HomeySmartHome platform.

## Audit Scope

### 1. Dependency Vulnerabilities

```bash
cd homey-app && npm audit --audit-level=moderate
cd web-dashboard && npm audit --audit-level=moderate
```

Check for known CVEs in:
- Express 5.1.0
- Socket.IO 4.8.1
- Helmet 8.0.0
- express-rate-limit 7.5.0
- All transitive dependencies

### 2. Input Validation

Search for unvalidated user inputs:

```
Files to audit:
- homey-app/server.js — req.body, req.params, req.query usage
- homey-app/api.js — All route handlers
- web-dashboard/server.js — Dashboard API routes
- web-dashboard/*.js — All dashboard module routes
```

**Check for:**
- Missing input validation before database/logic operations
- Type coercion vulnerabilities (`parseInt` without radix, etc.)
- Path traversal in file operations
- Command injection in `child_process` calls
- Prototype pollution via `Object.assign` or spread

### 3. Authentication & Authorization

```
Files to audit:
- homey-app/server.js — Auth middleware configuration
- nginx/nginx.conf — Protected route configuration
```

**Check for:**
- Routes missing authentication middleware
- Hardcoded tokens or credentials
- Weak token validation
- Missing CSRF protection on state-changing endpoints

### 4. HTTP Security Headers

```
Files to audit:
- homey-app/server.js — Helmet configuration
- web-dashboard/server.js — Helmet configuration
- nginx/nginx.conf — Security headers
```

**Required headers:**
- `Content-Security-Policy: default-src 'self'`
- `X-Frame-Options: DENY` or `SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security` (when HTTPS enabled)
- `Referrer-Policy: strict-origin-when-cross-origin`

### 5. Rate Limiting

```
Files to audit:
- nginx/nginx.conf — Rate limit zones
- homey-app/server.js — express-rate-limit config
- web-dashboard/server.js — express-rate-limit config
```

**Verify:**
- `/api/` routes: 30 req/s per IP
- General routes: 60 req/s per IP
- Express-level backup rate limiting
- Burst handling configuration

### 6. Docker Security

```
Files to audit:
- homey-app/Dockerfile — Build security
- web-dashboard/Dockerfile — Build security
- docker-compose.yml — Runtime security
- docker-compose.dev.yml — Dev security
```

**Checklist:**
- [ ] Non-root user (`USER node`)
- [ ] Read-only filesystem (`read_only: true`)
- [ ] No new privileges (`no-new-privileges:true`)
- [ ] Resource limits (memory, CPU)
- [ ] No privileged mode
- [ ] Minimal base image (Alpine)
- [ ] Multi-stage build (no dev dependencies in prod)
- [ ] No secrets in image layers

### 7. Secrets Management

```
Files to audit:
- All .js files — grep for hardcoded strings
- .env.example — Template completeness
- .gitignore — Exclusion of sensitive files
- docker-compose.yml — Environment variable handling
```

**Search patterns:**
- Hardcoded passwords: `password`, `secret`, `token`, `key`
- API keys: strings matching common API key formats
- URLs with credentials: `http://user:pass@`
- Private keys: `-----BEGIN`

### 8. Error Handling

**Check that error responses never contain:**
- Stack traces
- File system paths
- Database queries
- Internal IP addresses
- Package versions
- Module names or implementation details

## Severity Levels

| Level | Description | Action |
|-------|-------------|--------|
| Critical | Exploitable, data exposure | Fix immediately |
| High | Potential exploit vector | Fix before next deploy |
| Medium | Defense-in-depth issue | Fix in next sprint |
| Low | Best practice improvement | Plan for improvement |

## Report Template

```markdown
## Security Audit Report — [Date]

### Summary
- Critical: X findings
- High: X findings
- Medium: X findings
- Low: X findings

### Findings

#### [SEV-001] Finding Title
- **Severity:** Critical
- **Location:** `file:line`
- **Issue:** Description
- **Impact:** What could happen
- **Fix:** How to remediate
- **Status:** Open/Fixed
```
