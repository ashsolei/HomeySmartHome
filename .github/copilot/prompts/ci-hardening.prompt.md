---
mode: "agent"
description: "Harden the CI/CD pipeline with caching, parallelism, security scanning, and reproducible builds"
---

# CI/CD Hardening

Improve the GitHub Actions pipeline for reliability, speed, and security.

## Current Pipeline
`.github/workflows/ci-cd.yml` — lint-test → security-audit → docker-build → push → compose-test → cleanup

## Hardening Areas

### 1. Reproducible Builds
- Pin Node.js version exactly: `22.x` (not `latest`)
- Use `npm ci` (not `npm install`) for deterministic installs
- Pin GitHub Actions versions: `actions/checkout@v4`, `actions/setup-node@v4`

### 2. Caching
```yaml
- uses: actions/cache@v4
  with:
    path: ~/.npm
    key: ${{ runner.os }}-npm-${{ hashFiles('**/package-lock.json') }}
    restore-keys: ${{ runner.os }}-npm-
```

### 3. Parallel Jobs
- Run backend and dashboard lint/test in parallel matrix
- Run security audit parallel to Docker build
- Only gate push on successful build

### 4. Security Scanning
- Add `npm audit --audit-level=moderate` with `continue-on-error: false`
- Consider adding SAST scanning step
- Scan Docker images for vulnerabilities

### 5. Artifact Preservation
```yaml
- uses: actions/upload-artifact@v4
  if: failure()
  with:
    name: test-logs
    path: |
      homey-app/test-results/
      web-dashboard/test-results/
```

### 6. Fail-Fast Settings
```yaml
strategy:
  fail-fast: true
```

## Quality Gates
- [ ] Pipeline completes in under 10 minutes
- [ ] All jobs use pinned action versions
- [ ] npm cache hit rate > 90%
- [ ] Security audit fails the pipeline on moderate+ issues
- [ ] Docker build uses layer caching
