---
mode: "agent"
description: "Perform a full security audit of HomeySmartHome code and infrastructure"
---

# Security Review

Perform a comprehensive security audit of the HomeySmartHome platform.

## Audit Areas

### 1. Input Validation
- Search for routes accepting user input (`req.body`, `req.params`, `req.query`)
- Verify all inputs are validated before use
- Check for SQL/NoSQL injection vectors
- Check for command injection via `child_process` or `exec`

### 2. Authentication & Authorization
- Verify Bearer token validation on protected routes
- Check for missing auth middleware on sensitive endpoints
- Look for hardcoded credentials or API keys

### 3. Dependencies
```bash
cd homey-app && npm audit
cd web-dashboard && npm audit
```

### 4. HTTP Security Headers
- Check Helmet configuration in `homey-app/server.js` and `web-dashboard/server.js`
- Verify CSP policy in Nginx config
- Check CORS origins are properly restricted

### 5. Rate Limiting
- Verify Nginx rate limit zones in `nginx/nginx.conf`
- Check Express rate-limit configuration
- Ensure `/api/` endpoints are rate-limited

### 6. Docker Security
- Check for non-root user in Dockerfiles (`USER node`)
- Verify read-only filesystem in `docker-compose.yml`
- Check `no-new-privileges` security option
- Verify resource limits are set

### 7. Secrets Management
- Search for hardcoded secrets: passwords, tokens, API keys
- Verify `.env` is in `.gitignore`
- Check environment variable usage in code

### 8. Error Handling
- Verify error responses don't expose stack traces
- Check for unhandled promise rejections
- Ensure sensitive data isn't logged

## Report Format
For each finding:
- **Severity:** Critical / High / Medium / Low
- **Location:** File path and line number
- **Issue:** Description of the vulnerability
- **Fix:** Recommended remediation
