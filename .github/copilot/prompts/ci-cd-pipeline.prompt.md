---
mode: "agent"
description: "Create or update the GitHub Actions CI/CD pipeline for HomeySmartHome"
---

# CI/CD Pipeline

Update the GitHub Actions CI/CD pipeline at `.github/workflows/ci-cd.yml`.

## Current Pipeline Structure
1. **lint-test** — ESLint + unit tests (both services, Node 22.x)
2. **security-audit** — `npm audit` on both services
3. **docker-build** — Build Docker images for backend and dashboard
4. **push** — Push to GitHub Container Registry (main branch only)
5. **docker-compose-test** — Full stack health check
6. **cleanup** — Remove test containers

## Workflow Pattern
```yaml
name: CI/CD Pipeline
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lint-test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [22.x]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
          cache-dependency-path: |
            homey-app/package-lock.json
            web-dashboard/package-lock.json
      - run: cd homey-app && npm ci && npm run lint && npm test
      - run: cd web-dashboard && npm ci && npm run lint && npm test
```

## Checklist
- [ ] Triggers on push to main/develop and PRs to main
- [ ] Node.js version matches project requirement (22.x)
- [ ] npm cache configured for both services
- [ ] Lint runs before tests
- [ ] Security audit runs on all dependencies
- [ ] Docker images build successfully
- [ ] Health checks pass in Docker Compose test
- [ ] Cleanup removes all test resources
