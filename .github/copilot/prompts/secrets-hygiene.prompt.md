---
mode: "agent"
description: "Scan for leaked secrets, enforce .env practices, and harden credential handling"
---

# Secrets Hygiene

Scan and harden secrets management across HomeySmartHome.

## Step 1: Scan for Hardcoded Secrets

Search all source files for patterns:
```
password|passwd|pwd|secret|token|api_key|apikey|private_key
Bearer [A-Za-z0-9\-._~+/]+=*
-----BEGIN (RSA |EC )?PRIVATE KEY-----
http[s]?://[^:]+:[^@]+@
```

## Step 2: Verify .gitignore

Confirm these patterns are excluded:
```
.env
.env.local
.env.*.local
*.pem
*.key
credentials.json
```

## Step 3: Audit .env.example

1. Read all `process.env.` references in source code
2. Compare with `.env.example` entries
3. Add any missing variables with safe default descriptions
4. Never include real values in `.env.example`

## Step 4: Check Docker Compose

Verify `docker-compose.yml` uses environment variables, not inline secrets:
```yaml
# Good
environment:
  - HOMEY_TOKEN=${HOMEY_TOKEN}

# Bad — never do this
environment:
  - HOMEY_TOKEN=real-token-value
```

## Step 5: Check CI/CD

Verify `.github/workflows/ci-cd.yml` uses `${{ secrets.* }}` for sensitive values, never hardcoded.

## Step 6: Check Logging

Search for patterns that might log secrets:
```javascript
// Bad
console.log('Token:', process.env.HOMEY_TOKEN);

// Good
console.log('Token:', process.env.HOMEY_TOKEN ? '[SET]' : '[NOT SET]');
```

## Quality Gates
- [ ] Zero hardcoded secrets in source code
- [ ] `.env` is in `.gitignore`
- [ ] `.env.example` covers all required variables
- [ ] No secrets in Docker Compose inline
- [ ] No secrets in log output
- [ ] CI/CD uses GitHub Secrets for sensitive values
