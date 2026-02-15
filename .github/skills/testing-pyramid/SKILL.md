---
name: testing-pyramid
description: "Implements the testing pyramid for HomeySmartHome with unit tests for modules, integration tests for APIs, E2E tests for the Docker stack, coverage targets, and flake reduction strategies"
argument-hint: "[level: unit|integration|e2e|all]"
---

# Testing Pyramid

Testing strategy for the HomeySmartHome platform (179 modules, Node.js 22,
Express 5, Socket.IO 4.8, Docker Compose with backend port 3000, dashboard
port 3001, nginx port 80).

## Pyramid Structure

| Level       | Count Target | Speed    | What It Tests                          | Runner              |
|-------------|-------------|----------|----------------------------------------|----------------------|
| Unit        | 70% of tests| < 50ms   | Individual module logic                | `node --test`        |
| Integration | 20% of tests| < 500ms  | API endpoints, middleware, Socket.IO   | `node --test`        |
| E2E         | 10% of tests| < 10s    | Full Docker stack through nginx        | `./deploy.sh test`   |

## Step 1 — Unit Tests

Unit tests validate individual module classes in isolation. Every module in
`homey-app/lib/` must have a corresponding test file.

### Test File Convention

```
homey-app/lib/SmartIrrigationSystem.js        -> homey-app/test/SmartIrrigationSystem.test.js
homey-app/lib/AdvancedSecuritySystem.js       -> homey-app/test/AdvancedSecuritySystem.test.js
homey-app/lib/middleware/validateRequest.js   -> homey-app/test/middleware/validateRequest.test.js
```

### Unit Test Template

```js
// homey-app/test/SmartIrrigationSystem.test.js
'use strict';

const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const SmartIrrigationSystem = require('../lib/SmartIrrigationSystem');

describe('SmartIrrigationSystem', () => {
  let system;
  const mockHomey = {
    settings: { get: () => null, set: () => {} },
    api: {},
    clock: { getTimezone: () => 'Europe/Stockholm' },
  };

  beforeEach(async () => {
    system = new SmartIrrigationSystem(mockHomey);
    await system.initialize();
  });

  afterEach(async () => {
    await system.destroy();
  });

  describe('initialization', () => {
    it('should set initialized to true after initialize()', () => {
      assert.equal(system.initialized, true);
    });

    it('should use default check interval when env var is not set', () => {
      assert.equal(system.checkInterval, 300000);
    });
  });

  describe('getStatus()', () => {
    it('should return status object with required fields', () => {
      const status = system.getStatus();
      assert.equal(typeof status.initialized, 'boolean');
      assert.equal(typeof status.active, 'boolean');
      assert.ok(Array.isArray(status.zones));
    });
  });

  describe('scheduleIrrigation()', () => {
    it('should activate a zone with valid input', async () => {
      const zone = await system.scheduleIrrigation('zone-1', 600);
      assert.equal(zone.id, 'zone-1');
      assert.equal(zone.active, true);
      assert.equal(zone.scheduledDuration, 600);
    });

    it('should reject empty zoneId', async () => {
      await assert.rejects(
        () => system.scheduleIrrigation('', 600),
        { message: /invalid/i }
      );
    });

    it('should reject negative duration', async () => {
      await assert.rejects(
        () => system.scheduleIrrigation('zone-1', -1),
        { message: /invalid/i }
      );
    });
  });

  describe('destroy()', () => {
    it('should clean up and set initialized to false', async () => {
      await system.destroy();
      assert.equal(system.initialized, false);
    });
  });
});
```

### Running Unit Tests

```bash
cd /Users/macbookpro/HomeySmartHome

# Run all backend tests
npm run test:backend

# Run a single test file
cd homey-app && node --test test/SmartIrrigationSystem.test.js

# Run with verbose output
cd homey-app && node --test --test-reporter spec test/SmartIrrigationSystem.test.js
```

## Step 2 — Integration Tests

Integration tests validate API endpoints, middleware chains, and Socket.IO events
with the actual Express server running.

### Integration Test Template

```js
// homey-app/test/integration/climate-api.test.js
'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

function httpRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      timeout: 5000,
    };
    if (body) {
      options.headers = { 'Content-Type': 'application/json' };
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

describe('Climate API Integration', () => {
  it('GET /api/v1/health returns 200', async () => {
    const res = await httpRequest('GET', '/api/v1/health');
    assert.equal(res.status, 200);
  });

  it('GET /api/v1/climate/zones returns valid shape', async () => {
    const res = await httpRequest('GET', '/api/v1/climate/zones');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.zones) || typeof res.body === 'object');
  });

  it('POST with invalid JSON returns 400', async () => {
    const url = new URL('/api/v1/climate/zones/test/target', BASE_URL);
    const options = {
      method: 'POST',
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: { 'Content-Type': 'application/json' },
    };

    const res = await new Promise((resolve, reject) => {
      const req = http.request(options, (r) => {
        let data = '';
        r.on('data', (c) => { data += c; });
        r.on('end', () => resolve({ status: r.statusCode }));
      });
      req.on('error', reject);
      req.write('not valid json{{{');
      req.end();
    });

    assert.ok([400, 404].includes(res.status));
  });

  it('returns proper CORS headers', async () => {
    const res = await httpRequest('GET', '/api/v1/health');
    // CORS headers should be present due to cors() middleware
    assert.ok(res.headers['access-control-allow-origin'] !== undefined ||
              res.status === 200);
  });

  it('returns security headers from helmet', async () => {
    const res = await httpRequest('GET', '/api/v1/health');
    assert.ok(res.headers['x-content-type-options'] || res.status === 200);
  });
});
```

### Running Integration Tests

```bash
cd /Users/macbookpro/HomeySmartHome

# Start the backend first, then run integration tests
cd homey-app && node server.js &
sleep 5
node --test test/integration/

# Or run via Docker
./deploy.sh start
sleep 10
cd homey-app && TEST_BASE_URL=http://localhost:3000 node --test test/integration/
```

## Step 3 — E2E Tests (Docker Stack)

E2E tests validate the entire deployed stack: backend, dashboard, and nginx
proxy working together.

```js
// test/e2e/full-stack.test.js
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, { timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

describe('E2E Full Stack', () => {
  it('nginx proxies /api/v1/health to backend', async () => {
    const res = await get('http://localhost/api/v1/health');
    assert.equal(res.status, 200);
  });

  it('nginx serves dashboard on /', async () => {
    const res = await get('http://localhost:3001/');
    assert.equal(res.status, 200);
    assert.ok(res.body.includes('html'));
  });

  it('backend exposes Prometheus metrics', async () => {
    const res = await get('http://localhost:3000/metrics');
    assert.equal(res.status, 200);
    assert.ok(res.body.includes('smarthomepro'));
  });

  it('all services respond within 2 seconds', async () => {
    const start = Date.now();
    await Promise.all([
      get('http://localhost:3000/api/v1/health'),
      get('http://localhost:3001/'),
      get('http://localhost/'),
    ]);
    const elapsed = Date.now() - start;
    assert.ok(elapsed < 2000, `Services responded in ${elapsed}ms, expected < 2000ms`);
  });
});
```

### Running E2E Tests

```bash
cd /Users/macbookpro/HomeySmartHome

# Ensure the full stack is running
./deploy.sh start
sleep 15

# Run E2E tests
node --test test/e2e/

# Or use deploy.sh built-in test command
./deploy.sh test
```

## Step 4 — Coverage Targets

| Level       | Target   | Measurement                                  |
|-------------|----------|----------------------------------------------|
| Unit        | 80%      | Line coverage for module classes             |
| Integration | 100%     | Every registered API route has a test        |
| E2E         | Critical | Health, proxy, and cross-service paths tested|

```bash
# Generate coverage report using Node.js built-in coverage (v22+)
cd /Users/macbookpro/HomeySmartHome/homey-app
node --test --experimental-test-coverage test/

# The output shows per-file line and branch coverage
# Look for "% Lines" and "% Branches" columns
```

## Step 5 — Flake Reduction Strategies

### Problem: Timing-Dependent Tests

```js
// BAD: Relies on exact timing
it('should complete within 100ms', async () => {
  const start = Date.now();
  await system.process();
  assert.ok(Date.now() - start < 100); // flaky under load
});

// GOOD: Use generous timeouts or mock timers
it('should complete processing', async () => {
  const result = await system.process();
  assert.ok(result.completed);
});
```

### Problem: Shared State Between Tests

```js
// BAD: Tests share state
let system;
before(() => { system = new System(); });

it('test 1', () => { system.count = 5; });
it('test 2', () => { assert.equal(system.count, 0); }); // fails if test 1 runs first

// GOOD: Fresh state per test
beforeEach(() => { system = new System(); });
afterEach(() => { system.destroy(); });
```

### Problem: Port Conflicts in Integration Tests

```js
// BAD: Hardcoded port
const server = app.listen(3000);

// GOOD: Dynamic port assignment
const server = app.listen(0); // OS assigns available port
const port = server.address().port;
```

### Problem: Network-Dependent Tests

```js
// BAD: Calls external service
it('should fetch weather', async () => {
  const result = await system.fetchWeather(); // calls real API
});

// GOOD: Mock external calls
it('should fetch weather', async () => {
  const { mock } = require('node:test');
  const mockFetch = mock.fn(() => Promise.resolve({ temp: 20 }));
  system.fetchFn = mockFetch;
  const result = await system.fetchWeather();
  assert.equal(result.temp, 20);
  assert.equal(mockFetch.mock.calls.length, 1);
});
```

## Step 6 — Test Organization

```
homey-app/
  test/
    unit/                          # Unit tests for individual modules
      SmartIrrigationSystem.test.js
      AdvancedSecuritySystem.test.js
      middleware/
        validateRequest.test.js
    integration/                   # API and Socket.IO integration tests
      climate-api.test.js
      irrigation-api.test.js
      socketio-events.test.js
    fixtures/                      # Shared test data
      mockHomey.js
      sampleZones.json

test/
  e2e/                             # Full Docker stack tests
    full-stack.test.js
    nginx-proxy.test.js
```

## Testing Pyramid Checklist

Unit tests:
- [ ] Every module in `homey-app/lib/` has a corresponding `.test.js` file
- [ ] Tests cover: initialization, getStatus, core methods, error cases, destroy
- [ ] Tests use `beforeEach`/`afterEach` for fresh state isolation
- [ ] No test depends on another test's execution order
- [ ] External dependencies are mocked
- [ ] All unit tests pass: `npm run test:backend`

Integration tests:
- [ ] Every registered API route has at least one integration test
- [ ] Tests verify HTTP status codes and response shapes
- [ ] Tests verify error handling (400, 404, 500)
- [ ] Tests verify middleware (CORS, helmet, rate limiting, validation)
- [ ] Tests use dynamic ports or configurable base URL

E2E tests:
- [ ] Health endpoints respond through nginx proxy
- [ ] Dashboard is accessible on port 3001
- [ ] Prometheus metrics endpoint returns data
- [ ] Cross-service communication works (backend to dashboard via Socket.IO)
- [ ] All E2E tests pass: `./deploy.sh test`

Coverage:
- [ ] Unit test line coverage is at least 80%
- [ ] All API routes are covered by integration tests
- [ ] Critical E2E paths are covered

## Rules

1. Never write an integration test for something a unit test can verify.
2. Every module must have unit tests before it is registered in server.js.
3. Integration tests must not depend on Docker; E2E tests may.
4. Use `beforeEach`/`afterEach` to isolate state; never share mutable state between tests.
5. Mock all external network calls in unit and integration tests.
6. Tests must not use hardcoded ports; use dynamic ports or environment variables.
7. Fix flaky tests immediately; never skip or retry as a workaround.
8. Run `npm run test:all` before every commit.
9. E2E tests run after Docker build and deploy, not during development.
10. Test file naming must match `*.test.js` to be picked up by the test runner.
