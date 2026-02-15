---
name: secure-config
description: "Enforces secure configuration for HomeySmartHome including environment variable management, least privilege Docker settings, Helmet/CORS/rate-limit configuration, and secure defaults for all services"
argument-hint: "[config-area: env|docker|nginx|express]"
---

# Secure Configuration

## Overview

HomeySmartHome requires hardened configuration across four layers: environment variables, Docker containers, Nginx reverse proxy, and Express middleware. The backend runs on port 3000 with Express 5.1.0, Helmet 8.0, express-rate-limit 7.5, and CORS 2.8. The dashboard serves on port 3001 with Socket.IO 4.8.1. Nginx fronts everything on port 80.

## Step-by-Step Workflow

### Step 1: Environment Variable Management

Define all environment variables in `.env` files that are never committed to version control.

```js
// homey-app/config/env.js
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const requiredVars = [
  'NODE_ENV',
  'PORT',
  'SESSION_SECRET',
  'CORS_ORIGIN',
  'RATE_LIMIT_WINDOW_MS',
  'RATE_LIMIT_MAX',
];

function validateEnv() {
  const missing = requiredVars.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

function getEnv(key, defaultValue) {
  const value = process.env[key];
  if (value === undefined && defaultValue === undefined) {
    throw new Error(`Environment variable ${key} is not set and has no default`);
  }
  return value || defaultValue;
}

module.exports = { validateEnv, getEnv };
```

Create a `.env.example` template for each service:

```js
// Script to generate .env.example from current .env
const fs = require('fs');

function generateEnvExample(envPath, examplePath) {
  const content = fs.readFileSync(envPath, 'utf8');
  const sanitized = content
    .split('\n')
    .map((line) => {
      if (line.startsWith('#') || line.trim() === '') return line;
      const [key] = line.split('=');
      return `${key}=<REPLACE_ME>`;
    })
    .join('\n');
  fs.writeFileSync(examplePath, sanitized);
}
```

### Step 2: Docker Security Context

Apply least-privilege settings in `docker-compose.yml`:

```js
// Validate docker-compose.yml has security settings
const yaml = require('js-yaml');
const fs = require('fs');

function auditDockerCompose(composePath) {
  const doc = yaml.load(fs.readFileSync(composePath, 'utf8'));
  const issues = [];

  for (const [name, service] of Object.entries(doc.services || {})) {
    if (!service.read_only) {
      issues.push(`${name}: missing read_only: true`);
    }
    if (!service.security_opt || !service.security_opt.includes('no-new-privileges:true')) {
      issues.push(`${name}: missing security_opt no-new-privileges`);
    }
    if (service.privileged) {
      issues.push(`${name}: privileged mode is enabled (remove it)`);
    }
    if (!service.mem_limit) {
      issues.push(`${name}: missing mem_limit`);
    }
    if (!service.cpus) {
      issues.push(`${name}: missing cpus limit`);
    }
    if (!service.healthcheck) {
      issues.push(`${name}: missing healthcheck`);
    }
    if (!service.user || service.user === 'root') {
      issues.push(`${name}: runs as root (set user: "node" or numeric UID)`);
    }
  }
  return issues;
}
```

Required Docker Compose security directives for each service:

```js
const requiredDockerSettings = {
  backend: {
    image: 'homey-backend:latest',
    user: '1000:1000',
    read_only: true,
    security_opt: ['no-new-privileges:true'],
    mem_limit: '512m',
    cpus: '1.0',
    ports: ['3000:3000'],
    tmpfs: ['/tmp'],
    healthcheck: {
      test: ['CMD', 'curl', '-f', 'http://localhost:3000/health'],
      interval: '30s',
      timeout: '10s',
      retries: 3,
    },
  },
  dashboard: {
    image: 'homey-dashboard:latest',
    user: '1000:1000',
    read_only: true,
    security_opt: ['no-new-privileges:true'],
    mem_limit: '256m',
    cpus: '0.5',
    ports: ['3001:3001'],
    tmpfs: ['/tmp'],
  },
};
```

### Step 3: Helmet Configuration

Configure Helmet 8.0 with strict defaults for the Express 5 backend:

```js
// homey-app/middleware/security.js
const helmet = require('helmet');

function configureHelmet() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", 'ws://localhost:3001'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'none'"],
        frameSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    ieNoOpen: true,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true,
  });
}

module.exports = { configureHelmet };
```

### Step 4: CORS Configuration

Lock down CORS to known origins only:

```js
// homey-app/middleware/cors.js
const cors = require('cors');

function configureCors() {
  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3001')
    .split(',')
    .map((o) => o.trim());

  return cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 600,
  });
}

module.exports = { configureCors };
```

### Step 5: Rate Limiting

Apply rate limits to prevent abuse:

```js
// homey-app/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');

function configureRateLimit() {
  return rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
    skip: (req) => req.path === '/health' || req.path === '/metrics',
    keyGenerator: (req) => req.ip,
  });
}

function configureStrictRateLimit() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Rate limit exceeded for this endpoint.' },
  });
}

module.exports = { configureRateLimit, configureStrictRateLimit };
```

### Step 6: Nginx Hardening

Verify Nginx configuration includes security headers and restrictions:

```js
// Script to audit nginx.conf for security directives
const fs = require('fs');

function auditNginxConfig(configPath) {
  const config = fs.readFileSync(configPath, 'utf8');
  const requiredDirectives = [
    { pattern: /server_tokens\s+off/, name: 'server_tokens off' },
    { pattern: /X-Content-Type-Options/, name: 'X-Content-Type-Options header' },
    { pattern: /X-Frame-Options/, name: 'X-Frame-Options header' },
    { pattern: /X-XSS-Protection/, name: 'X-XSS-Protection header' },
    { pattern: /client_max_body_size/, name: 'client_max_body_size limit' },
    { pattern: /proxy_hide_header\s+X-Powered-By/, name: 'Hide X-Powered-By' },
    { pattern: /ssl_protocols/, name: 'SSL protocol restriction' },
    { pattern: /limit_req_zone/, name: 'Rate limiting zone' },
  ];

  const missing = requiredDirectives.filter((d) => !d.pattern.test(config));
  return missing.map((d) => d.name);
}
```

### Step 7: Apply and Verify Configuration

```js
// Full configuration verification script
const { execSync } = require('child_process');

function verifySecureConfig() {
  const results = { pass: [], fail: [] };

  // Verify .env is not committed
  try {
    const gitFiles = execSync('git ls-files').toString();
    if (gitFiles.includes('.env') && !gitFiles.includes('.env.example')) {
      results.fail.push('.env file is tracked in git');
    } else {
      results.pass.push('.env file is not tracked');
    }
  } catch (err) {
    results.fail.push(`Git check failed: ${err.message}`);
  }

  // Verify Docker build
  try {
    execSync('docker compose build', { stdio: 'pipe' });
    results.pass.push('Docker build succeeded');
  } catch (err) {
    results.fail.push('Docker build failed');
  }

  // Verify tests pass with secure config
  try {
    execSync('npm run test:all', { stdio: 'pipe' });
    results.pass.push('All tests pass');
  } catch (err) {
    results.fail.push('Tests failed with secure config');
  }

  return results;
}
```

## Rules

1. Never commit `.env` files to version control; always use `.env.example` templates.
2. All containers must run as non-root with `no-new-privileges` security option.
3. Helmet must be the first middleware registered on the Express app.
4. CORS origins must be explicitly listed; never use `origin: true` or `origin: '*'` in production.
5. Rate limiting must be applied globally and with stricter limits on sensitive endpoints.
6. Nginx must hide server version tokens and proxy headers that reveal backend technology.
7. Docker containers must have memory and CPU limits set.
8. Health check endpoints (`/health`, `/metrics`) are exempt from rate limiting.
9. All security middleware configuration must be testable and verified by `npm run test:all`.
10. Default configuration must be secure; insecure overrides require explicit opt-in.

## Checklist

- [ ] `.env.example` exists for both `homey-app/` and `dashboard/`
- [ ] `.env` is in `.gitignore` and not tracked by git
- [ ] All required environment variables are validated at startup
- [ ] Docker Compose uses non-root user, read-only filesystem, no-new-privileges
- [ ] Memory and CPU limits set on all Docker services
- [ ] Helmet 8.0 configured with strict CSP and all protections enabled
- [ ] CORS locked to specific origins with credentials support
- [ ] Rate limiting applied globally (100/15min) and strictly on sensitive routes (10/15min)
- [ ] Nginx hides server tokens and backend technology headers
- [ ] `npm run lint:all` passes
- [ ] `npm run test:all` passes
- [ ] `docker compose build` succeeds
- [ ] `./deploy.sh test` passes health checks
