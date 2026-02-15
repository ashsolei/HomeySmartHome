---
name: quality-gates
description: "Defines and enforces all quality gates for HomeySmartHome: lint, test, security audit, Docker build verification, health checks, and clean repo validation before any merge or deploy"
argument-hint: "[gate: all|lint|test|audit|docker|health]"
---

# Quality Gates

Every change to the HomeySmartHome platform (179 modules, Node.js 22, Express 5,
Socket.IO 4.8, Docker Compose) must pass all quality gates before merge or deploy.

## Gate Overview

| Gate   | Command                        | Pass Criteria            | Timeout |
|--------|--------------------------------|--------------------------|---------|
| lint   | `npm run lint:all`             | Exit code 0, zero errors | 60s     |
| test   | `npm run test:all`             | Exit code 0, all pass    | 120s    |
| audit  | `npm audit --audit-level=high` | No high/critical vulns   | 30s     |
| docker | `docker compose build`         | Exit code 0              | 300s    |
| health | `./deploy.sh status`           | All services healthy     | 60s     |
| clean  | `git status --porcelain`       | Empty output             | 5s      |

## Step 1 — Lint Gate

```bash
cd /Users/macbookpro/HomeySmartHome
npm run lint:all
```

Runs backend (`cd homey-app && npm run lint`) and dashboard (`cd web-dashboard && npm run lint`). The project uses single quotes and semicolons.

```js
// BAD
const foo = "bar"
// GOOD
const foo = 'bar';
```

Fix: read lint output for file/line/rule, fix each issue, re-run. Never disable lint rules inline without a documented exception.

## Step 2 — Test Gate

```bash
npm run test:all
```

Runs `npm run test:backend` then `npm run test:dashboard`. To isolate a failure: `cd homey-app && node --test test/specific-test.js`. Common causes: changed response shape without updating assertions, missing mock, un-awaited async.

## Step 3 — Security Audit Gate

```bash
npm audit --audit-level=high
cd homey-app && npm audit --audit-level=high
cd /Users/macbookpro/HomeySmartHome/web-dashboard && npm audit --audit-level=high
```

Fix with `npm audit fix`. If a transitive dependency is vulnerable, use overrides:

```js
// package.json
{ "overrides": { "vulnerable-package": ">=2.0.0" } }
```

## Step 4 — Docker Build Gate

```bash
docker compose build
```

Builds `smarthomepro` (port 3000), `dashboard` (port 3001), `nginx` (port 80). Common failures: missing dependency in package.json, file not found in COPY, Node.js version mismatch, build context too large (check .dockerignore).

## Step 5 — Health Check Gate

```bash
./deploy.sh start
sleep 10
./deploy.sh status
curl -sf http://localhost:3000/api/v1/health || echo "Backend unhealthy"
curl -sf http://localhost:3001/ || echo "Dashboard unhealthy"
curl -sf http://localhost/ || echo "Nginx unhealthy"
curl -sf http://localhost:3000/metrics || echo "Metrics down"
```

All three containers must show "Up" and "healthy".

## Step 6 — Clean Repo Validation

```bash
git status --porcelain
```

Output must be empty. If dirty, add build artifacts to `.gitignore` and commit remaining changes.

## Step 7 — Running All Gates Together

```js
const { execSync } = require('child_process');

const gates = [
  { name: 'lint',   cmd: 'npm run lint:all' },
  { name: 'test',   cmd: 'npm run test:all' },
  { name: 'audit',  cmd: 'npm audit --audit-level=high' },
  { name: 'docker', cmd: 'docker compose build' },
  { name: 'health', cmd: './deploy.sh status' },
  { name: 'clean',  cmd: 'test -z "$(git status --porcelain)"' },
];

const cwd = '/Users/macbookpro/HomeySmartHome';

for (const gate of gates) {
  try {
    execSync(gate.cmd, { cwd, stdio: 'pipe', timeout: 300000 });
    console.log(`PASS: ${gate.name}`);
  } catch (err) {
    console.error(`FAIL: ${gate.name} — fix before proceeding`);
    process.exit(1);
  }
}
console.log('All quality gates passed.');
```

## Gate Enforcement Rules

1. No merge without all gates passing on the pull request.
2. No deploy without health gate confirmation via `./deploy.sh status`.
3. Audit gate runs on every `package.json` or `package-lock.json` change.
4. Docker gate runs on any `Dockerfile`, `docker-compose.yml`, `nginx/`, or `deploy.sh` change.
5. Clean repo gate runs last to confirm no artifacts remain.
6. Gate failures block the pipeline; no downstream gate runs until the failure is fixed.
7. Every gate run is logged with pass/fail status and duration.

## Quality Gate Checklist

Before merge:
- [ ] `npm run lint:all` exits 0 with zero errors
- [ ] `npm run test:all` exits 0 with all tests passing
- [ ] `npm audit --audit-level=high` reports no high/critical vulnerabilities
- [ ] `docker compose build` completes successfully for all services
- [ ] `git status --porcelain` shows empty output

Before deploy:
- [ ] All merge gates pass
- [ ] `./deploy.sh start` completes without errors
- [ ] `./deploy.sh status` shows all services healthy
- [ ] `curl http://localhost:3000/api/v1/health` returns 200
- [ ] `curl http://localhost:3001/` returns 200
- [ ] `curl http://localhost/` returns 200 (nginx proxy)
- [ ] `curl http://localhost:3000/metrics` returns Prometheus metrics
