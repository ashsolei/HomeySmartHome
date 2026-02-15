---
name: input-validation
description: "Implements input validation for HomeySmartHome Express routes to prevent injection attacks, prototype pollution, path traversal, and malformed data using schema-based validation patterns"
argument-hint: "[route-path]"
---

# Input Validation

## Overview

HomeySmartHome's backend runs Express 5.1.0 on port 3000 with 179 modules exposing API routes. Every route that accepts user input through `req.body`, `req.params`, `req.query`, or `req.headers` must validate and sanitize that input. This skill covers schema-based validation, injection prevention, prototype pollution defense, and path traversal protection.

## Step-by-Step Workflow

### Step 1: Define a Validation Schema Library

Create reusable validation schemas for common input types.

```js
// homey-app/lib/validation/schemas.js

const SCHEMAS = {
  id: {
    type: 'string',
    pattern: /^[a-zA-Z0-9_-]{1,64}$/,
    message: 'ID must be 1-64 alphanumeric characters, hyphens, or underscores',
  },
  moduleName: {
    type: 'string',
    pattern: /^[A-Za-z][A-Za-z0-9]{0,63}$/,
    message: 'Module name must start with a letter and be 1-64 alphanumeric characters',
  },
  email: {
    type: 'string',
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    maxLength: 254,
    message: 'Must be a valid email address',
  },
  port: {
    type: 'number',
    min: 1,
    max: 65535,
    integer: true,
    message: 'Port must be an integer between 1 and 65535',
  },
  ipAddress: {
    type: 'string',
    pattern: /^(?:\d{1,3}\.){3}\d{1,3}$/,
    message: 'Must be a valid IPv4 address',
  },
  sensorValue: {
    type: 'number',
    min: -1000,
    max: 10000,
    message: 'Sensor value must be between -1000 and 10000',
  },
  automationRule: {
    type: 'object',
    required: ['name', 'trigger', 'action'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 128 },
      trigger: { type: 'string', minLength: 1, maxLength: 256 },
      action: { type: 'string', minLength: 1, maxLength: 256 },
      enabled: { type: 'boolean' },
    },
  },
  pagination: {
    type: 'object',
    properties: {
      page: { type: 'number', min: 1, max: 10000, integer: true },
      limit: { type: 'number', min: 1, max: 100, integer: true },
      sort: { type: 'string', pattern: /^[a-zA-Z_]{1,32}$/ },
      order: { type: 'string', enum: ['asc', 'desc'] },
    },
  },
};

module.exports = SCHEMAS;
```

### Step 2: Build a Validation Engine

Create a validator that enforces schemas against incoming data.

```js
// homey-app/lib/validation/validator.js

function validate(value, schema) {
  const errors = [];

  if (schema.type === 'string') {
    if (typeof value !== 'string') {
      return [{ message: `Expected string, got ${typeof value}` }];
    }
    if (schema.minLength && value.length < schema.minLength) {
      errors.push({ message: `Must be at least ${schema.minLength} characters` });
    }
    if (schema.maxLength && value.length > schema.maxLength) {
      errors.push({ message: `Must be at most ${schema.maxLength} characters` });
    }
    if (schema.pattern && !schema.pattern.test(value)) {
      errors.push({ message: schema.message || 'Invalid format' });
    }
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push({ message: `Must be one of: ${schema.enum.join(', ')}` });
    }
  }

  if (schema.type === 'number') {
    const num = Number(value);
    if (isNaN(num)) {
      return [{ message: `Expected number, got ${typeof value}` }];
    }
    if (schema.integer && !Number.isInteger(num)) {
      errors.push({ message: 'Must be an integer' });
    }
    if (schema.min !== undefined && num < schema.min) {
      errors.push({ message: `Must be at least ${schema.min}` });
    }
    if (schema.max !== undefined && num > schema.max) {
      errors.push({ message: `Must be at most ${schema.max}` });
    }
  }

  if (schema.type === 'boolean') {
    if (typeof value !== 'boolean') {
      errors.push({ message: `Expected boolean, got ${typeof value}` });
    }
  }

  if (schema.type === 'object') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return [{ message: 'Expected an object' }];
    }
    if (schema.required) {
      for (const key of schema.required) {
        if (value[key] === undefined) {
          errors.push({ message: `Missing required field: ${key}` });
        }
      }
    }
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (value[key] !== undefined) {
          const propErrors = validate(value[key], propSchema);
          errors.push(...propErrors.map((e) => ({ field: key, ...e })));
        }
      }
    }
  }

  return errors;
}

module.exports = { validate };
```

### Step 3: Create Validation Middleware

Build Express middleware that validates requests before they reach route handlers.

```js
// homey-app/middleware/validateRequest.js
const { validate } = require('../lib/validation/validator');

function validateBody(schema) {
  return function (req, res, next) {
    const errors = validate(req.body, schema);
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    next();
  };
}

function validateParams(schemaMap) {
  return function (req, res, next) {
    const errors = [];
    for (const [param, schema] of Object.entries(schemaMap)) {
      if (req.params[param] !== undefined) {
        const paramErrors = validate(req.params[param], schema);
        errors.push(...paramErrors.map((e) => ({ param, ...e })));
      }
    }
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Invalid URL parameters', details: errors });
    }
    next();
  };
}

function validateQuery(schemaMap) {
  return function (req, res, next) {
    const errors = [];
    for (const [key, schema] of Object.entries(schemaMap)) {
      if (req.query[key] !== undefined) {
        const queryErrors = validate(req.query[key], schema);
        errors.push(...queryErrors.map((e) => ({ query: key, ...e })));
      }
    }
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Invalid query parameters', details: errors });
    }
    next();
  };
}

module.exports = { validateBody, validateParams, validateQuery };
```

### Step 4: Prevent Prototype Pollution

Strip dangerous properties from all incoming JSON payloads.

```js
// homey-app/middleware/sanitize.js

const DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'];

function deepSanitize(obj) {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(deepSanitize);

  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    if (DANGEROUS_KEYS.includes(key)) continue;
    cleaned[key] = deepSanitize(value);
  }
  return cleaned;
}

function sanitizeMiddleware(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = deepSanitize(req.body);
  }
  next();
}

module.exports = { sanitizeMiddleware, deepSanitize };
```

### Step 5: Prevent Path Traversal

Validate file paths and resource identifiers to prevent directory traversal attacks.

```js
// homey-app/lib/validation/pathSafety.js
const path = require('path');

function isPathSafe(userPath, allowedBase) {
  const resolved = path.resolve(allowedBase, userPath);
  return resolved.startsWith(path.resolve(allowedBase));
}

function sanitizePath(userPath) {
  return userPath
    .replace(/\.\./g, '')
    .replace(/\/\//g, '/')
    .replace(/[<>:"|?*\x00-\x1F]/g, '');
}

function pathValidationMiddleware(paramName, allowedBase) {
  return function (req, res, next) {
    const userPath = req.params[paramName];
    if (!userPath) return next();

    const sanitized = sanitizePath(userPath);
    if (!isPathSafe(sanitized, allowedBase)) {
      return res.status(400).json({ error: 'Invalid path: traversal detected' });
    }
    req.params[paramName] = sanitized;
    next();
  };
}

module.exports = { isPathSafe, sanitizePath, pathValidationMiddleware };
```

### Step 6: Prevent Injection in Query Construction

Sanitize values used in dynamic queries or command construction.

```js
// homey-app/lib/validation/injection.js

function sanitizeForRegex(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitizeForShell(input) {
  return input.replace(/[;&|`$(){}[\]!#~<>\\'"*?\n\r]/g, '');
}

function sanitizeForLog(input) {
  return input
    .replace(/[\n\r]/g, ' ')
    .replace(/[<>]/g, '')
    .substring(0, 1000);
}

function validateNoInjection(value) {
  const injectionPatterns = [
    /[;|&`$(){}]/,                     // Shell metacharacters
    /<script[\s>]/i,                   // XSS script tags
    /javascript:/i,                    // JavaScript protocol
    /on\w+\s*=/i,                      // Event handlers
    /\b(?:union|select|insert|drop|delete|update)\b.*\b(?:from|into|table|where)\b/i,
  ];

  for (const pattern of injectionPatterns) {
    if (pattern.test(value)) {
      return { safe: false, pattern: pattern.toString() };
    }
  }
  return { safe: true };
}

module.exports = { sanitizeForRegex, sanitizeForShell, sanitizeForLog, validateNoInjection };
```

### Step 7: Apply Validation to Routes

Wire validation middleware into Express routes.

```js
// homey-app/routes/modules.js
const express = require('express');
const router = express.Router();
const SCHEMAS = require('../lib/validation/schemas');
const { validateBody, validateParams, validateQuery } = require('../middleware/validateRequest');
const { sanitizeMiddleware } = require('../middleware/sanitize');

router.use(sanitizeMiddleware);

router.get(
  '/modules',
  validateQuery({
    page: SCHEMAS.pagination.properties.page,
    limit: SCHEMAS.pagination.properties.limit,
    sort: SCHEMAS.pagination.properties.sort,
  }),
  (req, res) => {
    // Handler receives validated and sanitized input
    res.json({ modules: [] });
  }
);

router.get(
  '/modules/:id',
  validateParams({ id: SCHEMAS.id }),
  (req, res) => {
    res.json({ module: { id: req.params.id } });
  }
);

router.post(
  '/modules/:id/rules',
  validateParams({ id: SCHEMAS.id }),
  validateBody(SCHEMAS.automationRule),
  (req, res) => {
    res.status(201).json({ rule: req.body });
  }
);

module.exports = router;
```

### Step 8: Verify Validation Coverage

Run verification to confirm all routes have validation middleware.

```js
// scripts/auditValidation.js
const { execSync } = require('child_process');

function auditRouteValidation(serviceDir) {
  const routeFiles = execSync(
    `find ${serviceDir}/routes -name "*.js" -not -path "*/node_modules/*"`
  ).toString().trim().split('\n').filter(Boolean);

  const issues = [];
  const fs = require('fs');

  for (const file of routeFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const routeMatches = content.match(/router\.(get|post|put|patch|delete)\s*\(/g) || [];
    const validationMatches = content.match(/validate(?:Body|Params|Query)\(/g) || [];

    if (routeMatches.length > 0 && validationMatches.length === 0) {
      issues.push({ file, routes: routeMatches.length, message: 'No validation middleware found' });
    }

    if (!content.includes('sanitizeMiddleware')) {
      issues.push({ file, message: 'Missing sanitizeMiddleware (prototype pollution protection)' });
    }
  }

  return issues;
}

const issues = auditRouteValidation('homey-app');
if (issues.length > 0) {
  console.log('Validation audit issues:');
  issues.forEach((i) => console.log(`  ${i.file}: ${i.message}`));
  process.exit(1);
}
console.log('All routes have validation middleware');
```

## Rules

1. Every Express route accepting input must use validation middleware before the handler.
2. Apply `sanitizeMiddleware` at the router level to strip prototype pollution keys from all requests.
3. Use schema-based validation; never rely on ad-hoc checks within route handlers.
4. Reject requests with a 400 status and descriptive error details on validation failure.
5. Never use user input directly in `require()`, `eval()`, `exec()`, `spawn()`, or file path construction.
6. Limit string inputs to explicit maximum lengths; default to 256 characters if unspecified.
7. Numeric inputs must have explicit `min` and `max` bounds; never accept unbounded numbers.
8. All file path inputs must be validated against a base directory to prevent traversal.
9. Sanitize all user input before including it in log messages to prevent log injection.
10. Validation schemas must be centralized in `lib/validation/schemas.js`; never duplicate patterns.

## Checklist

- [ ] Validation schemas defined for all input types in `lib/validation/schemas.js`
- [ ] `sanitizeMiddleware` applied at router level in every route file
- [ ] `validateBody()` used on all POST/PUT/PATCH routes
- [ ] `validateParams()` used on all routes with URL parameters
- [ ] `validateQuery()` used on all routes accepting query strings
- [ ] Prototype pollution keys (`__proto__`, `constructor`, `prototype`) are stripped
- [ ] Path traversal protection applied to routes handling file paths
- [ ] Injection patterns checked for shell, regex, and SQL-like constructs
- [ ] All input length limits explicitly defined with sensible maximums
- [ ] `npm run test:all` passes with validation middleware in place
- [ ] `npm run lint:all` passes
- [ ] Validation audit script confirms 100% route coverage
