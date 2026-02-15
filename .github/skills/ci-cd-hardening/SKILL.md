---
name: ci-cd-hardening
description: "Hardens the GitHub Actions CI/CD pipeline for HomeySmartHome with reproducible builds, npm caching, parallel job optimization, artifact preservation, and security scanning integration"
argument-hint: "[area: cache|parallel|security|artifacts]"
---

# CI/CD Hardening

## Overview

HomeySmartHome's CI/CD pipeline runs on GitHub Actions and must handle two services (backend on port 3000, dashboard on port 3001), 179 modules, Docker Compose builds, and deployment verification. This skill covers reproducible builds, npm caching, parallel job execution, artifact management, and security scanning integration to produce a fast, reliable, and secure pipeline.

## Step-by-Step Workflow

### Step 1: Reproducible Build Configuration

Ensure every build produces identical results given the same inputs.

```js
// scripts/ci/verifyReproducible.js
const { execSync } = require('child_process');
const fs = require('fs');
const crypto = require('crypto');

function verifyLockfilePresence() {
  const services = ['homey-app', 'dashboard'];
  const issues = [];

  for (const svc of services) {
    const lockPath = `${svc}/package-lock.json`;
    if (!fs.existsSync(lockPath)) {
      issues.push(`Missing lockfile: ${lockPath}`);
    }
  }
  return issues;
}

function verifyNodeVersion() {
  const nvmrcPath = '.nvmrc';
  const expected = '22';
  if (fs.existsSync(nvmrcPath)) {
    const version = fs.readFileSync(nvmrcPath, 'utf8').trim();
    if (!version.startsWith(expected)) {
      return `Node version mismatch: .nvmrc says ${version}, expected ${expected}.x`;
    }
  }
  const actual = process.version;
  if (!actual.startsWith(`v${expected}`)) {
    return `Running Node ${actual}, expected v${expected}.x`;
  }
  return null;
}

function hashDependencies(serviceDir) {
  const lockPath = `${serviceDir}/package-lock.json`;
  const content = fs.readFileSync(lockPath, 'utf8');
  return crypto.createHash('sha256').update(content).digest('hex');
}

module.exports = { verifyLockfilePresence, verifyNodeVersion, hashDependencies };
```

Workflow step for reproducible installs:

```js
// CI step: always use npm ci, never npm install
// npm ci installs exact versions from package-lock.json
// This guarantees reproducibility across environments

const ciInstallCommands = {
  'homey-app': 'cd homey-app && npm ci',
  'dashboard': 'cd dashboard && npm ci',
};
```

### Step 2: npm Cache Configuration

Configure caching to speed up dependency installation across pipeline runs.

```js
// scripts/ci/cacheConfig.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function generateCacheKey() {
  const lockfiles = ['homey-app/package-lock.json', 'dashboard/package-lock.json'];
  const hash = crypto.createHash('sha256');
  for (const lockfile of lockfiles) {
    if (fs.existsSync(lockfile)) {
      hash.update(fs.readFileSync(lockfile));
    }
  }
  return `npm-deps-${process.platform}-node22-${hash.digest('hex').substring(0, 16)}`;
}

function getCachePaths() {
  return [
    '~/.npm',
    'homey-app/node_modules',
    'dashboard/node_modules',
  ];
}

// GitHub Actions cache configuration (YAML equivalent)
const cacheStepConfig = {
  uses: 'actions/cache@v4',
  with: {
    path: getCachePaths().join('\n'),
    key: '${{ runner.os }}-node22-${{ hashFiles(\'**/package-lock.json\') }}',
    'restore-keys': '${{ runner.os }}-node22-',
  },
};

module.exports = { generateCacheKey, getCachePaths, cacheStepConfig };
```

### Step 3: Parallel Job Optimization

Structure the pipeline for maximum parallelism without sacrificing correctness.

```js
// scripts/ci/pipelineStructure.js
// Defines the dependency graph for CI jobs

const pipelineJobs = {
  install: {
    name: 'Install Dependencies',
    steps: ['checkout', 'setup-node', 'cache-restore', 'npm-ci', 'cache-save'],
    outputs: ['node_modules cached'],
  },
  lint: {
    name: 'Lint',
    needs: ['install'],
    steps: ['checkout', 'cache-restore', 'npm-run-lint-all'],
    parallel: true,
  },
  testBackend: {
    name: 'Test Backend',
    needs: ['install'],
    steps: ['checkout', 'cache-restore', 'npm-run-test-backend'],
    parallel: true,
  },
  testDashboard: {
    name: 'Test Dashboard',
    needs: ['install'],
    steps: ['checkout', 'cache-restore', 'npm-run-test-dashboard'],
    parallel: true,
  },
  securityScan: {
    name: 'Security Scan',
    needs: ['install'],
    steps: ['checkout', 'cache-restore', 'npm-audit', 'secret-scan'],
    parallel: true,
  },
  dockerBuild: {
    name: 'Docker Build',
    needs: ['lint', 'testBackend', 'testDashboard', 'securityScan'],
    steps: ['checkout', 'docker-compose-build', 'image-scan'],
  },
  deploy: {
    name: 'Deploy',
    needs: ['dockerBuild'],
    steps: ['deploy-start', 'health-check', 'smoke-test'],
    environment: 'production',
  },
};

function getParallelGroups(jobs) {
  const groups = {};
  for (const [id, job] of Object.entries(jobs)) {
    const depth = getDepth(id, jobs);
    if (!groups[depth]) groups[depth] = [];
    groups[depth].push(id);
  }
  return groups;
}

function getDepth(jobId, jobs, visited = new Set()) {
  if (visited.has(jobId)) return 0;
  visited.add(jobId);
  const needs = jobs[jobId].needs || [];
  if (needs.length === 0) return 0;
  return 1 + Math.max(...needs.map((n) => getDepth(n, jobs, visited)));
}

module.exports = { pipelineJobs, getParallelGroups };
```

### Step 4: GitHub Actions Workflow Template

Complete workflow file generation for the pipeline.

```js
// scripts/ci/generateWorkflow.js
const fs = require('fs');

function generateWorkflowYAML() {
  return `
name: HomeySmartHome CI/CD
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read
  security-events: write

env:
  NODE_VERSION: '22'

jobs:
  install:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
      - uses: actions/cache@v4
        id: cache-deps
        with:
          path: |
            ~/.npm
            homey-app/node_modules
            dashboard/node_modules
          key: deps-\${{ runner.os }}-node22-\${{ hashFiles('**/package-lock.json') }}
          restore-keys: deps-\${{ runner.os }}-node22-
      - if: steps.cache-deps.outputs.cache-hit != 'true'
        run: |
          cd homey-app && npm ci
          cd ../dashboard && npm ci

  lint:
    needs: install
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
      - uses: actions/cache@v4
        with:
          path: |
            ~/.npm
            homey-app/node_modules
            dashboard/node_modules
          key: deps-\${{ runner.os }}-node22-\${{ hashFiles('**/package-lock.json') }}
      - run: npm run lint:all

  test-backend:
    needs: install
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
      - uses: actions/cache@v4
        with:
          path: |
            ~/.npm
            homey-app/node_modules
            dashboard/node_modules
          key: deps-\${{ runner.os }}-node22-\${{ hashFiles('**/package-lock.json') }}
      - run: cd homey-app && npm test
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: backend-test-results
          path: homey-app/coverage/
          retention-days: 14

  test-dashboard:
    needs: install
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
      - uses: actions/cache@v4
        with:
          path: |
            ~/.npm
            homey-app/node_modules
            dashboard/node_modules
          key: deps-\${{ runner.os }}-node22-\${{ hashFiles('**/package-lock.json') }}
      - run: cd dashboard && npm test
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: dashboard-test-results
          path: dashboard/coverage/
          retention-days: 14

  security:
    needs: install
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
      - uses: actions/cache@v4
        with:
          path: |
            ~/.npm
            homey-app/node_modules
            dashboard/node_modules
          key: deps-\${{ runner.os }}-node22-\${{ hashFiles('**/package-lock.json') }}
      - run: cd homey-app && npm audit --audit-level=high
      - run: cd dashboard && npm audit --audit-level=high

  docker-build:
    needs: [lint, test-backend, test-dashboard, security]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker compose build
      - uses: actions/upload-artifact@v4
        with:
          name: docker-build-log
          path: /tmp/docker-build.log
          retention-days: 7
`.trim();
}

module.exports = { generateWorkflowYAML };
```

### Step 5: Artifact Preservation

Configure proper artifact handling for test results, coverage, and build logs.

```js
// scripts/ci/artifactConfig.js

const artifactDefinitions = {
  'backend-test-results': {
    path: 'homey-app/coverage/',
    retentionDays: 14,
    uploadCondition: 'always',
  },
  'dashboard-test-results': {
    path: 'dashboard/coverage/',
    retentionDays: 14,
    uploadCondition: 'always',
  },
  'lint-report': {
    path: 'reports/lint/',
    retentionDays: 7,
    uploadCondition: 'failure',
  },
  'security-report': {
    path: 'reports/security/',
    retentionDays: 30,
    uploadCondition: 'always',
  },
  'docker-build-log': {
    path: '/tmp/docker-build.log',
    retentionDays: 7,
    uploadCondition: 'always',
  },
};

function validateArtifactConfig(config) {
  const issues = [];
  for (const [name, def] of Object.entries(config)) {
    if (!def.path) issues.push(`${name}: missing path`);
    if (!def.retentionDays || def.retentionDays > 90) {
      issues.push(`${name}: retention must be 1-90 days`);
    }
    if (!['always', 'success', 'failure'].includes(def.uploadCondition)) {
      issues.push(`${name}: invalid uploadCondition`);
    }
  }
  return issues;
}

module.exports = { artifactDefinitions, validateArtifactConfig };
```

### Step 6: Security Scanning Integration

Integrate security checks into the pipeline at multiple stages.

```js
// scripts/ci/securityChecks.js
const { execSync } = require('child_process');

function runNpmAudit(serviceDir, level) {
  const validLevels = ['low', 'moderate', 'high', 'critical'];
  const auditLevel = validLevels.includes(level) ? level : 'high';

  try {
    execSync(`npm audit --audit-level=${auditLevel}`, {
      cwd: serviceDir,
      stdio: 'pipe',
    });
    return { service: serviceDir, passed: true };
  } catch (err) {
    return {
      service: serviceDir,
      passed: false,
      output: err.stdout ? err.stdout.toString() : err.message,
    };
  }
}

function runSecretScan(repoRoot) {
  const fs = require('fs');
  const secretPatterns = [
    /(?:password|secret|token|key)\s*[:=]\s*['"][^'"$]{8,}['"]/gi,
    /AKIA[0-9A-Z]{16}/g,
    /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g,
  ];

  const issues = [];
  const files = execSync(
    `find ${repoRoot} -name "*.js" -o -name "*.json" -o -name "*.yml" | grep -v node_modules`
  ).toString().trim().split('\n');

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    for (const pattern of secretPatterns) {
      pattern.lastIndex = 0;
      if (pattern.test(content)) {
        issues.push({ file, pattern: pattern.toString() });
      }
    }
  }
  return issues;
}

function runAllSecurityChecks(repoRoot) {
  const results = {
    npmAudit: [
      runNpmAudit(`${repoRoot}/homey-app`, 'high'),
      runNpmAudit(`${repoRoot}/dashboard`, 'high'),
    ],
    secretScan: runSecretScan(repoRoot),
  };

  const allPassed = results.npmAudit.every((r) => r.passed) &&
    results.secretScan.length === 0;

  return { ...results, allPassed };
}

module.exports = { runNpmAudit, runSecretScan, runAllSecurityChecks };
```

### Step 7: Pipeline Validation Script

Validate the entire pipeline configuration before committing.

```js
// scripts/ci/validatePipeline.js
const { execSync } = require('child_process');
const { verifyLockfilePresence, verifyNodeVersion } = require('./verifyReproducible');

function validatePipeline() {
  const errors = [];

  // Check lockfiles
  const lockIssues = verifyLockfilePresence();
  errors.push(...lockIssues);

  // Check Node version
  const nodeIssue = verifyNodeVersion();
  if (nodeIssue) errors.push(nodeIssue);

  // Verify npm scripts exist
  const fs = require('fs');
  const rootPkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const requiredScripts = ['test:all', 'lint:all'];
  for (const script of requiredScripts) {
    if (!rootPkg.scripts || !rootPkg.scripts[script]) {
      errors.push(`Missing npm script: ${script}`);
    }
  }

  // Verify deploy.sh exists and is executable
  try {
    execSync('test -x ./deploy.sh');
  } catch (err) {
    errors.push('deploy.sh is missing or not executable');
  }

  // Run tests
  try {
    execSync('npm run test:all', { stdio: 'pipe' });
  } catch (err) {
    errors.push('npm run test:all failed');
  }

  // Run lint
  try {
    execSync('npm run lint:all', { stdio: 'pipe' });
  } catch (err) {
    errors.push('npm run lint:all failed');
  }

  if (errors.length > 0) {
    console.log('Pipeline validation failed:');
    errors.forEach((e) => console.log(`  - ${e}`));
    process.exit(1);
  }
  console.log('Pipeline validation passed');
}

module.exports = { validatePipeline };
```

## Rules

1. Always use `npm ci` in CI; never use `npm install` in pipeline steps.
2. Cache `node_modules` and `~/.npm` keyed on `package-lock.json` hash and Node version.
3. Run lint, backend tests, dashboard tests, and security scans in parallel after install.
4. Docker build must only run after all lint, test, and security jobs pass.
5. Upload test coverage and security reports as artifacts on every run (even failures).
6. Set artifact retention to 14 days for test results, 30 days for security reports, 7 days for build logs.
7. Pin all GitHub Actions to specific versions using SHA or major version tags.
8. Use `permissions: contents: read` at the workflow level; grant additional permissions only per-job.
9. Block deployment if `npm audit --audit-level=high` fails in either service.
10. Use Node.js 22 across all pipeline jobs; verify with `.nvmrc` file.
11. Never store secrets in workflow files; always use `${{ secrets.NAME }}` references.
12. Run `./deploy.sh test` as the final pipeline step to verify deployment health.

## Checklist

- [ ] `npm ci` used for all dependency installations in CI
- [ ] Cache configured with `actions/cache@v4` keyed on lockfile hashes
- [ ] Lint, test-backend, test-dashboard, and security jobs run in parallel
- [ ] Docker build depends on all quality gates passing
- [ ] Test coverage artifacts uploaded with 14-day retention
- [ ] Security reports uploaded with 30-day retention
- [ ] All Actions pinned to specific versions
- [ ] Workflow permissions set to least privilege
- [ ] `npm audit --audit-level=high` integrated for both services
- [ ] Node.js 22 pinned in workflow and `.nvmrc`
- [ ] No hardcoded secrets in workflow files
- [ ] `npm run test:all` passes
- [ ] `npm run lint:all` passes
- [ ] `docker compose build` succeeds
- [ ] Pipeline validation script runs clean
