---
name: dependency-remediation
description: "Safely updates npm dependencies in HomeySmartHome with CVE mitigation, lockfile management, breaking change detection, and automated verification across both backend and dashboard services"
argument-hint: "[package-name] [target-version]"
---

# Dependency Remediation

## Overview

HomeySmartHome runs two npm workspaces: `homey-app/` (backend on port 3000) and `dashboard/` (frontend on port 3001). Both share common patterns (Express 5.1.0) but maintain separate `package.json` and `package-lock.json` files. This skill covers safe dependency updates, CVE mitigation, lockfile integrity, and full verification.

## Step-by-Step Workflow

### Step 1: Audit Current State

Run audits in both service directories before making any changes.

```js
// Check outdated packages in both services
// homey-app/
const { execSync } = require('child_process');

const services = ['homey-app', 'dashboard'];
for (const svc of services) {
  console.log(`\n=== ${svc} ===`);
  try {
    const outdated = execSync(`npm outdated --json`, { cwd: svc });
    console.log(JSON.parse(outdated.toString()));
  } catch (err) {
    // npm outdated exits 1 when packages are outdated
    if (err.stdout) console.log(JSON.parse(err.stdout.toString()));
  }
}
```

Run `npm audit` to identify known CVEs:

```js
for (const svc of services) {
  console.log(`\n=== ${svc} audit ===`);
  try {
    const audit = execSync(`npm audit --json`, { cwd: svc });
    const result = JSON.parse(audit.toString());
    console.log(`Vulnerabilities: ${JSON.stringify(result.metadata.vulnerabilities)}`);
  } catch (err) {
    if (err.stdout) {
      const result = JSON.parse(err.stdout.toString());
      console.log(`Vulnerabilities: ${JSON.stringify(result.metadata.vulnerabilities)}`);
    }
  }
}
```

### Step 2: Classify the Update

Determine the update strategy based on semver range:

| Change Type | Risk   | Strategy                                    |
|-------------|--------|---------------------------------------------|
| Patch       | Low    | Update directly, run tests                  |
| Minor       | Medium | Review changelog, update, run full test suite |
| Major       | High   | Read migration guide, branch, update, test extensively |

```js
const semver = require('semver');

function classifyUpdate(currentVersion, targetVersion) {
  const diff = semver.diff(currentVersion, targetVersion);
  const strategies = {
    patch: 'Direct update with test verification',
    minor: 'Review changelog then update with full test suite',
    major: 'Create branch, read migration guide, update, run all tests',
    prepatch: 'Avoid in production',
    preminor: 'Avoid in production',
    premajor: 'Avoid in production',
    prerelease: 'Avoid in production',
  };
  return { diff, strategy: strategies[diff] || 'Unknown change type' };
}
```

### Step 3: Back Up Lockfiles

Always preserve lockfile state before modifications:

```js
const fs = require('fs');
const path = require('path');

function backupLockfile(serviceDir) {
  const lockPath = path.join(serviceDir, 'package-lock.json');
  const backupPath = path.join(serviceDir, 'package-lock.json.backup');
  if (fs.existsSync(lockPath)) {
    fs.copyFileSync(lockPath, backupPath);
    console.log(`Backed up ${lockPath} to ${backupPath}`);
  }
}

services.forEach(backupLockfile);
```

### Step 4: Perform the Update

For a targeted single-package update:

```js
function updatePackage(serviceDir, packageName, targetVersion) {
  const spec = targetVersion ? `${packageName}@${targetVersion}` : packageName;
  console.log(`Updating ${spec} in ${serviceDir}`);
  execSync(`npm install ${spec} --save-exact`, {
    cwd: serviceDir,
    stdio: 'inherit',
  });
}
```

For CVE-driven bulk remediation:

```js
function auditFix(serviceDir) {
  console.log(`Running npm audit fix in ${serviceDir}`);
  execSync('npm audit fix', { cwd: serviceDir, stdio: 'inherit' });
}
```

Never run `npm audit fix --force` without manual review. It can introduce breaking major version bumps.

### Step 5: Detect Breaking Changes

After updating, scan for breaking patterns in the codebase:

```js
const breakingPatterns = {
  'express': [
    { pattern: /app\.del\(/g, message: 'app.del() removed in Express 5, use app.delete()' },
    { pattern: /req\.param\(/g, message: 'req.param() removed in Express 5' },
    { pattern: /res\.json\(.*,\s*\d+\)/g, message: 'res.json(obj, status) signature changed' },
  ],
  'socket.io': [
    { pattern: /io\.set\(/g, message: 'io.set() removed in Socket.IO 4' },
  ],
  'helmet': [
    { pattern: /helmet\.contentSecurityPolicy\.getDefaultDirectives/g, message: 'API changed in Helmet 8' },
  ],
};

function scanForBreaking(serviceDir, packageName) {
  const patterns = breakingPatterns[packageName];
  if (!patterns) return [];
  const issues = [];
  const files = execSync(`find ${serviceDir} -name "*.js" -not -path "*/node_modules/*"`)
    .toString().trim().split('\n');
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    for (const { pattern, message } of patterns) {
      if (pattern.test(content)) {
        issues.push({ file, message });
      }
    }
  }
  return issues;
}
```

### Step 6: Verify the Update

Run the full verification pipeline:

```js
function verify() {
  // 1. Run linting
  console.log('Running lint...');
  execSync('npm run lint:all', { cwd: '.', stdio: 'inherit' });

  // 2. Run all tests
  console.log('Running tests...');
  execSync('npm run test:all', { cwd: '.', stdio: 'inherit' });

  // 3. Docker build check
  console.log('Building Docker images...');
  execSync('docker compose build', { cwd: '.', stdio: 'inherit' });

  // 4. Health check after deploy
  console.log('Running deploy test...');
  execSync('./deploy.sh test', { cwd: '.', stdio: 'inherit' });
}
```

### Step 7: Lockfile Integrity Check

Validate that the lockfile is consistent after updates:

```js
function validateLockfile(serviceDir) {
  try {
    execSync('npm ci --dry-run', { cwd: serviceDir, stdio: 'pipe' });
    console.log(`Lockfile in ${serviceDir} is consistent`);
    return true;
  } catch (err) {
    console.error(`Lockfile inconsistency in ${serviceDir}: ${err.message}`);
    return false;
  }
}
```

### Step 8: Clean Up

Remove backup lockfiles after successful verification:

```js
function cleanupBackups() {
  for (const svc of services) {
    const backupPath = path.join(svc, 'package-lock.json.backup');
    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
      console.log(`Removed backup: ${backupPath}`);
    }
  }
}
```

## Rules

1. Never update dependencies directly on the `main` branch for major version changes.
2. Always run `npm run test:all` and `npm run lint:all` after any dependency change.
3. Never use `npm audit fix --force` without manually reviewing proposed changes.
4. Pin exact versions with `--save-exact` for production dependencies.
5. Keep `homey-app/` and `dashboard/` lockfiles independent; never cross-contaminate.
6. Verify Docker builds after any dependency update with `docker compose build`.
7. Do not remove or modify `package-lock.json` manually; use npm commands only.
8. Document CVE remediation in commit messages with the CVE identifier.
9. Test all 179 modules load correctly after shared dependency updates.
10. Roll back immediately if health checks fail after `./deploy.sh start`.

## Checklist

- [ ] Ran `npm outdated` in both `homey-app/` and `dashboard/`
- [ ] Ran `npm audit` in both services and reviewed CVEs
- [ ] Classified update as patch/minor/major
- [ ] Backed up `package-lock.json` files before changes
- [ ] Updated the target package with `--save-exact`
- [ ] Scanned codebase for breaking change patterns
- [ ] Ran `npm run lint:all` with no errors
- [ ] Ran `npm run test:all` with all tests passing
- [ ] Ran `docker compose build` successfully
- [ ] Validated lockfile integrity with `npm ci --dry-run`
- [ ] Ran `./deploy.sh test` with passing health checks
- [ ] Cleaned up backup lockfiles
- [ ] Committed with descriptive message including CVE IDs if applicable
