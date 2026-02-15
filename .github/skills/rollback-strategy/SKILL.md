---
name: rollback-strategy
description: "Provides rollback procedures for HomeySmartHome including Docker service rollback, git revert patterns, configuration rollback, and recovery verification steps"
argument-hint: "[scope: full|service|config|code]"
---

# Rollback Strategy

Rollback procedures for the HomeySmartHome platform (179 modules, Node.js 22,
Express 5, Socket.IO 4.8, Docker Compose with backend port 3000, dashboard port
3001, nginx port 80).

## Step 1 — Determine Rollback Scope

| Scope   | When to Use                                           | Time Estimate |
|---------|-------------------------------------------------------|---------------|
| full    | Entire deploy is broken, all services affected        | 5-10 min      |
| service | Single service (backend, dashboard, or nginx) is down | 2-5 min       |
| config  | Configuration change caused the issue (env, compose)  | 1-3 min       |
| code    | Specific code commit introduced a bug                 | 2-5 min       |

```js
// Decision helper: determine rollback scope from symptoms
function determineRollbackScope(symptoms) {
  if (symptoms.allServicesDown) return 'full';
  if (symptoms.singleServiceDown) return 'service';
  if (symptoms.configChangeRecent) return 'config';
  if (symptoms.codeChangeRecent) return 'code';
  return 'full'; // default to safest option
}
```

## Step 2 — Full Rollback (Scope: full)

Use when the entire deployment is broken.

```bash
cd /Users/macbookpro/HomeySmartHome

# Step 2a: Stop all services immediately
./deploy.sh stop

# Step 2b: Identify the last known good commit
git log --oneline -10

# Step 2c: Revert to the last known good commit
git revert HEAD --no-edit

# Step 2d: Rebuild all Docker images from the reverted code
docker compose build

# Step 2e: Restart all services
./deploy.sh start

# Step 2f: Verify health
sleep 10
./deploy.sh status
curl -sf http://localhost:3000/api/v1/health && echo "Backend OK"
curl -sf http://localhost:3001/ && echo "Dashboard OK"
curl -sf http://localhost/ && echo "Nginx OK"
```

For reverting multiple commits:

```bash
# Revert the last N commits (creates one revert commit per original)
git revert HEAD~3..HEAD --no-edit

# Or revert to a specific tag
git log --tags --oneline -5
git revert HEAD..rollback/pre-feature-20260215 --no-edit
```

## Step 3 — Service Rollback (Scope: service)

Use when a single container is failing but others are healthy.

```bash
cd /Users/macbookpro/HomeySmartHome

# Identify which service is failing
docker compose ps

# Option A: Restart just the failing service
docker compose restart smarthomepro    # backend
docker compose restart dashboard       # dashboard
docker compose restart nginx           # nginx

# Option B: Rebuild and restart a single service
docker compose build smarthomepro
docker compose up -d smarthomepro

# Option C: Roll back to a previously tagged image
docker tag smarthomepro:rollback-latest smarthomepro:latest
docker compose up -d smarthomepro
```

### Service-Specific Recovery Commands

```bash
# Backend (port 3000) — check logs first
docker compose logs smarthomepro --tail=50

# Common backend issues:
# - Module initialization failure: check the specific module in logs
# - Port conflict: ensure nothing else binds to 3000
# - Memory limit: check docker stats

# Dashboard (port 3001) — check build output
docker compose logs dashboard --tail=50

# Nginx (port 80) — check config syntax
docker compose exec nginx nginx -t
docker compose restart nginx
```

## Step 4 — Configuration Rollback (Scope: config)

Use when an environment variable or Docker Compose change caused the issue.

```bash
cd /Users/macbookpro/HomeySmartHome

# Step 4a: Check what config changed
git diff HEAD~1 -- docker-compose.yml .env deploy.sh nginx/

# Step 4b: Revert only the config file(s)
git checkout HEAD~1 -- docker-compose.yml
# or
git checkout HEAD~1 -- .env
# or
git checkout HEAD~1 -- nginx/nginx.conf

# Step 4c: Rebuild affected services
docker compose build
docker compose up -d

# Step 4d: Verify
./deploy.sh status
```

### Environment Variable Rollback

```js
// Common environment variables that can break things if misconfigured
const criticalEnvVars = {
  NODE_ENV: 'production',        // must be 'production' in deploy
  PORT: '3000',                  // backend port, must match compose expose
  TZ: 'Europe/Stockholm',       // timezone for scheduling modules
  LOG_LEVEL: 'info',            // 'debug' can cause log flooding
  LATITUDE: '59.3293',          // used by weather and solar modules
  LONGITUDE: '18.0686',         // used by weather and solar modules
};

// Verify environment inside the running container
// docker compose exec smarthomepro env | grep -E 'NODE_ENV|PORT|TZ'
```

## Step 5 — Code Rollback (Scope: code)

Use when a specific commit introduced a bug.

```bash
cd /Users/macbookpro/HomeySmartHome

# Step 5a: Find the bad commit
git log --oneline -20

# Step 5b: Revert the specific commit (creates a new revert commit)
git revert <commit-sha> --no-edit

# Step 5c: Verify the revert fixed the issue locally
npm run test:all

# Step 5d: Rebuild and deploy
docker compose build
./deploy.sh start

# Step 5e: Verify health
./deploy.sh status
```

### Reverting a Module Addition

```bash
# If a new module was added and caused issues:

# 1. Revert the server.js registration
git checkout HEAD~1 -- homey-app/server.js

# 2. Optionally remove the module file
git rm homey-app/lib/ProblematicModule.js

# 3. Commit the revert
git add -A
git commit -m "revert: remove ProblematicModule causing boot failure"

# 4. Rebuild and deploy
docker compose build && ./deploy.sh start
```

### Reverting a Dependency Change

```bash
# If a package update broke things:
cd /Users/macbookpro/HomeySmartHome/homey-app

# Restore previous lock file
git checkout HEAD~1 -- package.json package-lock.json

# Reinstall from the restored lock
npm ci

# Rebuild Docker image (which does npm ci internally)
cd /Users/macbookpro/HomeySmartHome
docker compose build smarthomepro
docker compose up -d smarthomepro
```

## Step 6 — Recovery Verification

After any rollback, run the full verification sequence:

```js
// Post-rollback verification script
const { execSync } = require('child_process');
const http = require('http');

const cwd = '/Users/macbookpro/HomeySmartHome';

const checks = [
  {
    name: 'Docker services running',
    cmd: 'docker compose ps --format json',
    validate: (output) => {
      const services = output.split('\n').filter(Boolean);
      return services.length >= 3;
    },
  },
  {
    name: 'Backend health',
    cmd: 'curl -sf http://localhost:3000/api/v1/health',
    validate: (output) => output.includes('ok') || output.includes('healthy'),
  },
  {
    name: 'Dashboard accessible',
    cmd: 'curl -sf -o /dev/null -w "%{http_code}" http://localhost:3001/',
    validate: (output) => output.trim() === '200',
  },
  {
    name: 'Nginx proxy working',
    cmd: 'curl -sf -o /dev/null -w "%{http_code}" http://localhost/',
    validate: (output) => output.trim() === '200',
  },
  {
    name: 'Metrics endpoint',
    cmd: 'curl -sf http://localhost:3000/metrics',
    validate: (output) => output.includes('smarthomepro_uptime'),
  },
  {
    name: 'No crash loops',
    cmd: 'docker compose ps --format "{{.Status}}"',
    validate: (output) => !output.includes('Restarting'),
  },
];

let allPassed = true;
for (const check of checks) {
  try {
    const result = execSync(check.cmd, { cwd, encoding: 'utf8', timeout: 15000 });
    const passed = check.validate(result);
    console.log(`${passed ? 'PASS' : 'FAIL'}: ${check.name}`);
    if (!passed) allPassed = false;
  } catch (err) {
    console.log(`FAIL: ${check.name} — ${err.message}`);
    allPassed = false;
  }
}

if (!allPassed) {
  console.error('Rollback verification FAILED — escalate immediately');
  process.exit(1);
}
console.log('Rollback verification PASSED — system is stable');
```

## Step 7 — Post-Rollback Actions

After a successful rollback:

1. **Document the incident** — Record what changed, what broke, and what was rolled back.
2. **Root cause analysis** — Determine why the change caused a failure.
3. **Fix forward** — Create a new branch with the fix, run all quality gates, then re-deploy.
4. **Update tests** — Add a test that would have caught the issue before deploy.
5. **Clean up tags** — Remove rollback tags older than 30 days.

```bash
# Clean up old rollback tags
git tag -l 'rollback/*' | while read tag; do
  tagDate=$(git log -1 --format=%ai "$tag" | cut -d' ' -f1)
  if [[ "$tagDate" < "$(date -d '-30 days' +%Y-%m-%d)" ]]; then
    git tag -d "$tag"
  fi
done
```

## Rollback Checklist

Immediate response:
- [ ] Identify the scope: full, service, config, or code
- [ ] Stop or isolate the affected service(s)
- [ ] Identify the last known good state (commit hash or tag)

Execute rollback:
- [ ] Revert to the known good state using the appropriate method
- [ ] Rebuild Docker images if code or config changed
- [ ] Restart affected services

Verify recovery:
- [ ] `./deploy.sh status` shows all services healthy
- [ ] `curl http://localhost:3000/api/v1/health` returns 200
- [ ] `curl http://localhost:3001/` returns 200
- [ ] `curl http://localhost/` returns 200
- [ ] No crash loops in `docker compose ps`
- [ ] `curl http://localhost:3000/metrics` returns Prometheus data

Post-rollback:
- [ ] Incident documented with timeline
- [ ] Root cause identified
- [ ] Fix-forward branch created with quality gates passing
- [ ] New test added to prevent recurrence

## Rules

1. Always stop before you revert: confirm the scope before executing.
2. Never force-push to main. Use `git revert` to create new commits.
3. Always rebuild Docker images after any code or config rollback.
4. Run full verification after every rollback, no exceptions.
5. Document every rollback with timestamp, scope, and root cause.
6. Create a rollback checkpoint tag before every deploy.
7. Keep rollback tags for at least 30 days.
8. If two rollbacks happen within 24 hours, freeze deploys and investigate.
