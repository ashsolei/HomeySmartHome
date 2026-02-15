---
name: ci-cd-update
description: "Updates the GitHub Actions CI/CD pipeline for HomeySmartHome including lint, test, security audit, Docker build, container registry push, and deployment verification jobs"
argument-hint: "[add-job|update-job|fix-pipeline]"
---

# CI/CD Pipeline Update

Updates the GitHub Actions CI/CD pipeline at `.github/workflows/ci-cd.yml`.

## Current Pipeline

```
Push/PR → lint-test → security-audit → docker-build → push (main only) → docker-compose-test → cleanup
```

## Pipeline Structure

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
      - name: Backend lint & test
        run: cd homey-app && npm ci && npm run lint && npm test
      - name: Dashboard lint & test
        run: cd web-dashboard && npm ci && npm run lint && npm test

  security-audit:
    runs-on: ubuntu-latest
    needs: lint-test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22.x
      - name: Backend audit
        run: cd homey-app && npm ci && npm audit --audit-level=moderate
      - name: Dashboard audit
        run: cd web-dashboard && npm ci && npm audit --audit-level=moderate

  docker-build:
    runs-on: ubuntu-latest
    needs: lint-test
    steps:
      - uses: actions/checkout@v4
      - name: Build backend
        run: docker build -t smarthomepro:test ./homey-app
      - name: Build dashboard
        run: docker build -t dashboard:test ./web-dashboard

  push:
    runs-on: ubuntu-latest
    needs: docker-build
    if: github.ref == 'refs/heads/main'
    permissions:
      packages: write
    steps:
      - uses: actions/checkout@v4
      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - name: Build and push
        run: |
          docker build -t ghcr.io/${{ github.repository }}/smarthomepro:latest ./homey-app
          docker build -t ghcr.io/${{ github.repository }}/dashboard:latest ./web-dashboard
          docker push ghcr.io/${{ github.repository }}/smarthomepro:latest
          docker push ghcr.io/${{ github.repository }}/dashboard:latest

  docker-compose-test:
    runs-on: ubuntu-latest
    needs: docker-build
    steps:
      - uses: actions/checkout@v4
      - name: Start services
        run: docker compose up -d --build
      - name: Wait for health
        run: |
          for i in $(seq 1 30); do
            if curl -sf http://localhost:3000/health && curl -sf http://localhost:3001/health; then
              echo "Services healthy"
              exit 0
            fi
            sleep 2
          done
          echo "Health check timeout"
          docker compose logs
          exit 1
      - name: Cleanup
        if: always()
        run: docker compose down -v
```

## Adding a New Job

### Pattern

```yaml
  new-job:
    runs-on: ubuntu-latest
    needs: [lint-test]              # Dependencies
    if: github.event_name == 'push' # Conditional execution
    steps:
      - uses: actions/checkout@v4
      - name: Step description
        run: |
          echo "Command here"
```

### Common Additions

| Job | Purpose | When |
|-----|---------|------|
| `e2e-test` | End-to-end API testing | After docker-compose-test |
| `performance` | Response time benchmarks | On main branch only |
| `coverage` | Test coverage report | After lint-test |
| `notify` | Slack/email notification | On failure |

## Environment Variables

```yaml
env:
  NODE_ENV: test
  TZ: Europe/Stockholm

# Or per-step:
- name: Run tests
  env:
    LOG_LEVEL: error
  run: npm test
```

## Caching

```yaml
- uses: actions/cache@v4
  with:
    path: ~/.npm
    key: ${{ runner.os }}-npm-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-npm-
```

## Verification

After updating the pipeline:
1. Check YAML syntax (use `yamllint` or VS Code YAML extension)
2. Push to a branch and observe the workflow run
3. Check all jobs complete successfully
4. Verify caching improves subsequent run times
