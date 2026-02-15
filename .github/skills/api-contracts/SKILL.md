---
name: api-contracts
description: "Contract-first API design for HomeySmartHome REST endpoints including versioning strategy, request/response validation, backward compatibility checks, and documentation generation"
argument-hint: "[endpoint-path]"
---

# API Contracts

Contract-first API design for the HomeySmartHome platform (179 modules, Node.js 22,
Express 5, Socket.IO 4.8). All REST endpoints live under `/api/v1/` and are proxied
through nginx on port 80 to the backend on port 3000.

## Step 1 — Define the Contract Before Writing Code

Every new endpoint starts with a contract definition. The contract specifies the
method, path, request shape, response shape, and error cases.

```js
// Contract definition format
const contract = {
  method: 'GET',
  path: '/api/v1/climate/zones',
  description: 'Returns all climate zones with current temperature and humidity',
  request: {
    query: {
      floor: { type: 'string', required: false, description: 'Filter by floor name' },
    },
    body: null,
  },
  response: {
    200: {
      zones: [
        {
          id: 'string',
          name: 'string',
          floor: 'string',
          temperature: 'number',
          humidity: 'number',
          targetTemperature: 'number',
          mode: 'string (auto|heat|cool|off)',
        },
      ],
      count: 'number',
    },
    400: { error: 'string' },
    500: { error: 'string' },
  },
  rateLimit: { windowMs: 60000, max: 100 },
  auth: false,
};
```

## Step 2 — Versioning Strategy

All endpoints use the `/api/v1/` prefix. When a breaking change is required,
create a new version.

```js
// Version routing in server.js
const express = require('express');

// Current version routes
const v1Router = express.Router();
v1Router.get('/climate/zones', getClimateZones);
v1Router.post('/climate/zones/:id/target', setClimateTarget);

app.use('/api/v1', v1Router);

// When v2 is needed (breaking change), add alongside v1
// const v2Router = express.Router();
// v2Router.get('/climate/zones', getClimateZonesV2);
// app.use('/api/v2', v2Router);
// Keep v1 running for backward compatibility
```

### Versioning Rules

| Scenario                           | Action                              |
|------------------------------------|-------------------------------------|
| Add a new field to response        | No version bump needed              |
| Add a new optional query parameter | No version bump needed              |
| Add a new endpoint                 | No version bump needed              |
| Rename a response field            | Requires new version (v2)           |
| Remove a response field            | Requires new version (v2)           |
| Change a field type                | Requires new version (v2)           |
| Change URL path structure          | Requires new version (v2)           |
| Add a required request field       | Requires new version (v2)           |

## Step 3 — Request Validation

Validate all incoming requests against the contract using a validation middleware.

```js
// homey-app/lib/middleware/validateRequest.js
'use strict';

function validateRequest(schema) {
  return (req, res, next) => {
    const errors = [];

    // Validate query parameters
    if (schema.query) {
      for (const [key, rules] of Object.entries(schema.query)) {
        const value = req.query[key];
        if (rules.required && (value === undefined || value === '')) {
          errors.push(`Query parameter "${key}" is required`);
        }
        if (value !== undefined && rules.type === 'number' && isNaN(Number(value))) {
          errors.push(`Query parameter "${key}" must be a number`);
        }
        if (value !== undefined && rules.enum && !rules.enum.includes(value)) {
          errors.push(`Query parameter "${key}" must be one of: ${rules.enum.join(', ')}`);
        }
      }
    }

    // Validate body
    if (schema.body) {
      for (const [key, rules] of Object.entries(schema.body)) {
        const value = req.body ? req.body[key] : undefined;
        if (rules.required && (value === undefined || value === null)) {
          errors.push(`Body field "${key}" is required`);
        }
        if (value !== undefined && rules.type && typeof value !== rules.type) {
          errors.push(`Body field "${key}" must be of type ${rules.type}`);
        }
        if (value !== undefined && rules.min !== undefined && value < rules.min) {
          errors.push(`Body field "${key}" must be >= ${rules.min}`);
        }
        if (value !== undefined && rules.max !== undefined && value > rules.max) {
          errors.push(`Body field "${key}" must be <= ${rules.max}`);
        }
      }
    }

    // Validate path parameters
    if (schema.params) {
      for (const [key, rules] of Object.entries(schema.params)) {
        const value = req.params[key];
        if (rules.required && !value) {
          errors.push(`Path parameter "${key}" is required`);
        }
        if (value && rules.pattern && !rules.pattern.test(value)) {
          errors.push(`Path parameter "${key}" has invalid format`);
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    next();
  };
}

module.exports = validateRequest;
```

### Using the Validation Middleware

```js
const validateRequest = require('./lib/middleware/validateRequest');

// Define the schema for this endpoint
const setTargetSchema = {
  params: {
    id: { required: true, pattern: /^[a-zA-Z0-9_-]+$/ },
  },
  body: {
    temperature: { required: true, type: 'number', min: 10, max: 35 },
    mode: { required: false, type: 'string', enum: ['auto', 'heat', 'cool', 'off'] },
  },
};

app.post(
  '/api/v1/climate/zones/:id/target',
  express.json(),
  validateRequest(setTargetSchema),
  (req, res) => {
    const { id } = req.params;
    const { temperature, mode } = req.body;
    // Implementation here
    res.json({ id, targetTemperature: temperature, mode: mode || 'auto' });
  }
);
```

## Step 4 — Response Shape Consistency

All API responses follow a consistent shape.

```js
// Success response patterns
// Single resource:
res.json({ id: 'zone-1', name: 'Living Room', temperature: 21.5 });

// Collection:
res.json({ zones: [...], count: 5 });

// Action result:
res.json({ success: true, message: 'Target temperature set' });

// Error response pattern (always the same shape):
res.status(400).json({ error: 'Validation failed', details: ['temperature must be a number'] });
res.status(404).json({ error: 'Zone not found' });
res.status(500).json({ error: 'Internal server error' });
```

### Standard Error Handler

```js
// homey-app/lib/middleware/errorHandler.js
'use strict';

function errorHandler(err, req, res, next) {
  console.error(`[API Error] ${req.method} ${req.path}:`, err.message);

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }

  if (err.status) {
    return res.status(err.status).json({ error: err.message });
  }

  res.status(500).json({ error: 'Internal server error' });
}

module.exports = errorHandler;
```

## Step 5 — Backward Compatibility Checks

Before modifying any existing endpoint, verify backward compatibility.

```js
// Test backward compatibility by checking the response shape
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('API backward compatibility', () => {
  it('GET /api/v1/climate/zones still has all v1 fields', async () => {
    const res = await fetch('http://localhost:3000/api/v1/climate/zones');
    const data = await res.json();

    // These fields must exist in every version
    assert.ok(Array.isArray(data.zones), 'zones must be an array');
    assert.equal(typeof data.count, 'number', 'count must be a number');

    if (data.zones.length > 0) {
      const zone = data.zones[0];
      assert.equal(typeof zone.id, 'string', 'zone.id must be a string');
      assert.equal(typeof zone.name, 'string', 'zone.name must be a string');
      assert.equal(typeof zone.temperature, 'number', 'zone.temperature must be a number');
      assert.equal(typeof zone.humidity, 'number', 'zone.humidity must be a number');
    }
  });

  it('new fields do not break existing clients', async () => {
    const res = await fetch('http://localhost:3000/api/v1/climate/zones');
    const data = await res.json();

    // New fields are allowed; this test verifies the old ones still exist
    // Clients using destructuring will ignore unknown fields
    const requiredFields = ['zones', 'count'];
    for (const field of requiredFields) {
      assert.ok(field in data, `Required field "${field}" missing from response`);
    }
  });
});
```

## Step 6 — Rate Limiting

All endpoints use rate limiting configured via `express-rate-limit`.

```js
const rateLimit = require('express-rate-limit');

// Global rate limit for all API routes
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,     // 1 minute window
  max: 100,                // 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, try again later' },
});

app.use('/api/', apiLimiter);

// Per-endpoint rate limit for expensive operations
const heavyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Rate limit exceeded for this operation' },
});

app.post('/api/v1/irrigation/schedule', heavyLimiter, express.json(), scheduleHandler);
```

## Step 7 — Nginx Proxy Configuration

All `/api/v1/` requests are proxied from nginx (port 80) to the backend (port 3000).

```nginx
# nginx/nginx.conf — relevant location block
location /api/v1/ {
    proxy_pass http://smarthomepro:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 30s;
    proxy_connect_timeout 10s;
}

location /metrics {
    proxy_pass http://smarthomepro:3000;
    proxy_set_header Host $host;
}
```

When adding new endpoints under `/api/v1/`, no nginx configuration changes are
needed. The existing proxy rule covers all sub-paths.

## API Contract Checklist

Before implementation:
- [ ] Contract defined with method, path, request schema, and response schema
- [ ] Versioning rule confirmed (additive change = no version bump)
- [ ] Rate limiting requirements determined
- [ ] Error responses documented for 400, 404, 500 cases

During implementation:
- [ ] Request validation middleware applied to the endpoint
- [ ] Response shape matches the contract exactly
- [ ] Error handler middleware attached to the Express app
- [ ] Rate limiting applied (global and per-endpoint if needed)

After implementation:
- [ ] Backward compatibility test verifies all existing fields remain
- [ ] Integration test confirms correct HTTP status codes
- [ ] New endpoint accessible through nginx proxy on port 80
- [ ] `npm run lint:all` passes
- [ ] `npm run test:all` passes

## Rules

1. Define the contract before writing any handler code.
2. Never remove or rename a field in an existing API version.
3. New required request fields require a version bump.
4. All request bodies must be validated before processing.
5. All error responses must use the shape `{ error: string, details?: string[] }`.
6. Rate limiting is mandatory on all public endpoints.
7. All endpoints must be accessible through the nginx proxy without additional configuration.
8. Version deprecation must be announced at least one release before removal.
9. Every endpoint must have at least one integration test verifying its contract.
10. Query parameters for filtering are always optional; omitting them returns all results.
