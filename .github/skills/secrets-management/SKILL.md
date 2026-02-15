---
name: secrets-management
description: "Prevents credential leakage in HomeySmartHome through scanning, rotation patterns, .gitignore enforcement, Docker secrets handling, and CI/CD secrets configuration"
argument-hint: "[action: scan|rotate|audit]"
---

# Secrets Management

## Overview

HomeySmartHome must prevent credential leakage across its 179 modules, two services (backend on port 3000, dashboard on port 3001), Docker Compose deployment, and GitHub Actions CI/CD pipeline. This skill covers scanning for leaked secrets, rotating credentials, enforcing `.gitignore`, managing Docker secrets, and configuring CI/CD secrets securely.

## Step-by-Step Workflow

### Step 1: Scan for Leaked Secrets

Scan the entire repository for patterns that indicate hardcoded credentials.

```js
// lib/secretScanner.js
const fs = require('fs');
const path = require('path');

const SECRET_PATTERNS = [
  { name: 'AWS Access Key', regex: /AKIA[0-9A-Z]{16}/g },
  { name: 'AWS Secret Key', regex: /(?:aws_secret_access_key|AWS_SECRET)\s*[:=]\s*['"]?([A-Za-z0-9/+=]{40})['"]?/gi },
  { name: 'Generic API Key', regex: /(?:api[_-]?key|apikey)\s*[:=]\s*['"]([A-Za-z0-9_\-]{20,})['"]?/gi },
  { name: 'Generic Secret', regex: /(?:secret|password|passwd|token)\s*[:=]\s*['"]([^'"]{8,})['"]?/gi },
  { name: 'Private Key', regex: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/g },
  { name: 'JWT Token', regex: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
  { name: 'Database URL', regex: /(?:mongodb|postgres|mysql|redis):\/\/[^\s'"]+:[^\s'"]+@[^\s'"]+/gi },
  { name: 'Bearer Token', regex: /Bearer\s+[A-Za-z0-9_\-.]{20,}/g },
];

const IGNORE_DIRS = ['node_modules', '.git', 'dist', 'build', 'coverage'];
const SCAN_EXTENSIONS = ['.js', '.json', '.yml', '.yaml', '.env', '.sh', '.md', '.txt'];

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const findings = [];
  for (const { name, regex } of SECRET_PATTERNS) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      findings.push({
        file: filePath,
        line: lineNumber,
        type: name,
        snippet: match[0].substring(0, 20) + '...',
      });
    }
  }
  return findings;
}

function scanDirectory(dir) {
  const findings = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.includes(entry.name)) {
        findings.push(...scanDirectory(fullPath));
      }
    } else if (SCAN_EXTENSIONS.includes(path.extname(entry.name))) {
      findings.push(...scanFile(fullPath));
    }
  }
  return findings;
}

module.exports = { scanDirectory, scanFile, SECRET_PATTERNS };
```

### Step 2: Verify .gitignore Coverage

Ensure all sensitive files are excluded from version control.

```js
// lib/gitignoreAudit.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SENSITIVE_PATTERNS = [
  '.env',
  '.env.local',
  '.env.production',
  '.env.staging',
  '*.pem',
  '*.key',
  '*.p12',
  '*.pfx',
  '*.jks',
  'credentials.json',
  'service-account.json',
  'secrets/',
  '.npmrc',
  'docker-compose.override.yml',
];

function auditGitignore(repoRoot) {
  const gitignorePath = path.join(repoRoot, '.gitignore');
  const issues = [];

  if (!fs.existsSync(gitignorePath)) {
    return [{ level: 'critical', message: '.gitignore file does not exist' }];
  }

  const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
  for (const pattern of SENSITIVE_PATTERNS) {
    if (!gitignoreContent.includes(pattern)) {
      issues.push({ level: 'warning', message: `Pattern "${pattern}" not in .gitignore` });
    }
  }

  // Check for tracked sensitive files
  try {
    const trackedFiles = execSync('git ls-files', { cwd: repoRoot }).toString().split('\n');
    for (const file of trackedFiles) {
      if (file.endsWith('.env') || file.endsWith('.pem') || file.endsWith('.key')) {
        issues.push({ level: 'critical', message: `Sensitive file tracked in git: ${file}` });
      }
    }
  } catch (err) {
    issues.push({ level: 'error', message: `Failed to check tracked files: ${err.message}` });
  }

  return issues;
}

module.exports = { auditGitignore, SENSITIVE_PATTERNS };
```

### Step 3: Implement Secret Rotation

Create a rotation workflow for all application secrets.

```js
// lib/secretRotation.js
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function generateSecret(length = 64) {
  return crypto.randomBytes(length).toString('hex');
}

function rotateEnvSecret(envPath, keyName) {
  if (!fs.existsSync(envPath)) {
    throw new Error(`Environment file not found: ${envPath}`);
  }

  const content = fs.readFileSync(envPath, 'utf8');
  const newSecret = generateSecret();
  const lines = content.split('\n');
  let found = false;

  const updated = lines.map((line) => {
    if (line.startsWith(`${keyName}=`)) {
      found = true;
      return `${keyName}=${newSecret}`;
    }
    return line;
  });

  if (!found) {
    updated.push(`${keyName}=${newSecret}`);
  }

  fs.writeFileSync(envPath, updated.join('\n'));
  return { key: keyName, rotated: true, timestamp: new Date().toISOString() };
}

function rotateAllSecrets(envPath) {
  const secretKeys = ['SESSION_SECRET', 'JWT_SECRET', 'API_KEY', 'ENCRYPTION_KEY'];
  const results = [];
  for (const key of secretKeys) {
    results.push(rotateEnvSecret(envPath, key));
  }
  return results;
}

module.exports = { generateSecret, rotateEnvSecret, rotateAllSecrets };
```

### Step 4: Docker Secrets Configuration

Use Docker secrets instead of environment variables for sensitive values in production.

```js
// lib/dockerSecrets.js
const fs = require('fs');
const path = require('path');

const DOCKER_SECRETS_PATH = '/run/secrets';

function readDockerSecret(secretName) {
  const secretPath = path.join(DOCKER_SECRETS_PATH, secretName);
  try {
    return fs.readFileSync(secretPath, 'utf8').trim();
  } catch (err) {
    return null;
  }
}

function getSecret(name, envFallback) {
  const dockerSecret = readDockerSecret(name.toLowerCase());
  if (dockerSecret) {
    return dockerSecret;
  }
  const envValue = process.env[envFallback || name];
  if (!envValue) {
    throw new Error(`Secret ${name} not found in Docker secrets or environment`);
  }
  return envValue;
}

function validateDockerSecretsConfig(composeContent) {
  const issues = [];
  if (!composeContent.secrets) {
    issues.push('No secrets section defined in docker-compose.yml');
    return issues;
  }

  for (const [name, config] of Object.entries(composeContent.secrets)) {
    if (!config.file && !config.external) {
      issues.push(`Secret ${name}: must specify file or external source`);
    }
    if (config.file && !fs.existsSync(config.file)) {
      issues.push(`Secret ${name}: file ${config.file} does not exist`);
    }
  }

  for (const [svcName, svc] of Object.entries(composeContent.services || {})) {
    const envVars = svc.environment || {};
    for (const [key, value] of Object.entries(envVars)) {
      if (/secret|password|token|key/i.test(key) && typeof value === 'string') {
        issues.push(`${svcName}: ${key} should use Docker secrets, not plaintext env`);
      }
    }
  }

  return issues;
}

module.exports = { readDockerSecret, getSecret, validateDockerSecretsConfig };
```

### Step 5: CI/CD Secrets Configuration

Handle secrets properly in GitHub Actions workflows.

```js
// lib/ciSecretAudit.js
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

function auditWorkflowSecrets(workflowDir) {
  const issues = [];
  const files = fs.readdirSync(workflowDir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));

  for (const file of files) {
    const filePath = path.join(workflowDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const workflow = yaml.load(content);

    // Check for hardcoded secrets in env blocks
    const rawLines = content.split('\n');
    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      if (/(?:password|secret|token|key)\s*[:=]\s*['"][^$\s{]/.test(line)) {
        issues.push({
          file,
          line: i + 1,
          message: 'Possible hardcoded secret; use ${{ secrets.NAME }} instead',
        });
      }
    }

    // Check that secrets use repository or environment secrets
    for (const [jobName, job] of Object.entries(workflow.jobs || {})) {
      for (const step of job.steps || []) {
        const env = step.env || {};
        for (const [key, value] of Object.entries(env)) {
          if (typeof value === 'string' && !value.includes('secrets.') && /secret|token|key|password/i.test(key)) {
            issues.push({
              file,
              job: jobName,
              step: step.name || 'unnamed',
              message: `${key} should reference secrets context`,
            });
          }
        }
      }
    }
  }

  return issues;
}

module.exports = { auditWorkflowSecrets };
```

### Step 6: Full Audit Execution

Run all checks in sequence and generate a report.

```js
// scripts/auditSecrets.js
const { scanDirectory } = require('../lib/secretScanner');
const { auditGitignore } = require('../lib/gitignoreAudit');
const { auditWorkflowSecrets } = require('../lib/ciSecretAudit');

function runFullAudit(repoRoot) {
  console.log('=== Secret Scan ===');
  const scanResults = scanDirectory(repoRoot);
  console.log(`Found ${scanResults.length} potential secret(s)`);
  scanResults.forEach((r) => console.log(`  [${r.type}] ${r.file}:${r.line}`));

  console.log('\n=== .gitignore Audit ===');
  const gitignoreIssues = auditGitignore(repoRoot);
  gitignoreIssues.forEach((i) => console.log(`  [${i.level}] ${i.message}`));

  console.log('\n=== CI/CD Secrets Audit ===');
  const ciIssues = auditWorkflowSecrets(`${repoRoot}/.github/workflows`);
  ciIssues.forEach((i) => console.log(`  [${i.file}] ${i.message}`));

  const criticalCount = scanResults.length +
    gitignoreIssues.filter((i) => i.level === 'critical').length;
  if (criticalCount > 0) {
    console.log(`\nAUDIT FAILED: ${criticalCount} critical finding(s)`);
    process.exit(1);
  }
  console.log('\nAUDIT PASSED');
}

runFullAudit(process.cwd());
```

## Rules

1. Never commit secrets, tokens, passwords, or private keys to the repository.
2. All sensitive values must come from environment variables or Docker secrets.
3. The `.gitignore` must include patterns for `.env`, `*.pem`, `*.key`, and `credentials.json`.
4. Rotate all secrets on a 90-day cycle or immediately after any suspected exposure.
5. Docker Compose production deployments must use the `secrets` directive, not `environment` for credentials.
6. CI/CD workflows must use `${{ secrets.NAME }}` syntax; never hardcode values in workflow files.
7. Secret scanning must run before every commit via a pre-commit hook or CI step.
8. Log output must never include secret values; redact any variable matching secret patterns.
9. Use cryptographically secure random generation (at least 64 bytes) for all generated secrets.
10. Audit results with critical findings must block deployment via `./deploy.sh start`.

## Checklist

- [ ] Ran secret scanner across all project files with zero critical findings
- [ ] Verified `.gitignore` includes all sensitive file patterns
- [ ] Confirmed no `.env` or key files are tracked by git
- [ ] Rotated any secrets older than 90 days
- [ ] Docker Compose uses `secrets` directive for production credentials
- [ ] GitHub Actions workflows use `${{ secrets.NAME }}` for all credentials
- [ ] No hardcoded secrets found in CI/CD workflow files
- [ ] Log output sanitization verified for secret patterns
- [ ] Secret generation uses `crypto.randomBytes` with 64+ byte length
- [ ] `npm run test:all` passes after rotation
- [ ] `npm run lint:all` passes
- [ ] `./deploy.sh test` passes
- [ ] Audit report generated and reviewed
