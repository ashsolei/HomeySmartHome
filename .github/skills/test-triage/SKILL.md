---
name: test-triage
description: "Systematic debugging of test failures in HomeySmartHome including isolation techniques, mock verification, timing issue resolution, and test stabilization patterns"
argument-hint: "[test-name-or-error]"
---

# Test Triage

Systematic debugging of test failures in the HomeySmartHome platform (179 modules,
Node.js 22, Express 5, Socket.IO 4.8). Use this workflow whenever a test fails
to identify the root cause and apply a stable fix.

## Step 1 — Reproduce the Failure

Before diagnosing, confirm the failure is reproducible.

```bash
cd /Users/macbookpro/HomeySmartHome

# Run the full test suite to see the failure
npm run test:all

# Run only the failing test file
cd homey-app && node --test test/FailingModule.test.js

# Run with verbose reporter for more detail
cd homey-app && node --test --test-reporter spec test/FailingModule.test.js

# Run the specific test by name filter
cd homey-app && node --test --test-name-pattern "should handle edge case" test/FailingModule.test.js
```

### Classify the Failure

| Failure Type       | Symptoms                                          | Likely Cause              |
|--------------------|---------------------------------------------------|---------------------------|
| Deterministic      | Fails every run, same error                       | Code bug or test bug      |
| Flaky              | Fails intermittently, passes on retry             | Timing, state leak, race  |
| Environment        | Fails in Docker but passes locally (or vice versa)| Missing env var, port     |
| Cascade            | Many tests fail after one change                  | Shared state corruption   |

## Step 2 — Isolate the Failure

### Run the Test Alone

```bash
# Run just the one failing test file with no other tests
cd /Users/macbookpro/HomeySmartHome/homey-app
node --test test/SpecificModule.test.js

# If it passes alone but fails in the suite, there is a state leak
# from another test file. Binary search to find the culprit:
node --test test/A.test.js test/SpecificModule.test.js
node --test test/B.test.js test/SpecificModule.test.js
# Continue until you find which preceding test causes the failure
```

### Check for Global State Pollution

```js
// Common sources of state pollution in HomeySmartHome modules:

// 1. Modules that modify process.env
// BAD: Test sets process.env and never resets it
it('should use custom interval', () => {
  process.env.CHECK_INTERVAL = '1000';
  const system = new System(homey);
  // ...
});

// GOOD: Save and restore env
it('should use custom interval', () => {
  const original = process.env.CHECK_INTERVAL;
  process.env.CHECK_INTERVAL = '1000';
  try {
    const system = new System(homey);
    // assertions here
  } finally {
    if (original === undefined) delete process.env.CHECK_INTERVAL;
    else process.env.CHECK_INTERVAL = original;
  }
});

// 2. Modules that register global event listeners
// BAD: Listener accumulates across tests
beforeEach(() => {
  process.on('uncaughtException', handler);
});

// GOOD: Remove listener in afterEach
afterEach(() => {
  process.removeListener('uncaughtException', handler);
});

// 3. Modules that set intervals or timeouts
// BAD: Interval leaks into next test
it('should poll', () => {
  const system = new System(homey);
  system.startPolling(); // setInterval inside
  // test ends without cleanup
});

// GOOD: Always destroy
afterEach(async () => {
  await system.destroy(); // clears intervals
});
```

## Step 3 — Diagnose Mock Issues

### Mock Not Applied

```js
// PROBLEM: The mock is not being used by the module
const { mock } = require('node:test');

// BAD: Mocking after the module already captured the reference
const System = require('../lib/System');
const system = new System(homey);
mock.method(system, 'fetchData', () => ({ temp: 20 }));
// If fetchData was already bound in constructor, this mock has no effect

// GOOD: Mock before the module uses the function
const System = require('../lib/System');
const mockFetch = mock.fn(() => Promise.resolve({ temp: 20 }));
const system = new System(homey);
system.fetchFn = mockFetch; // Replace the function reference directly
```

### Mock Returns Wrong Shape

```js
// PROBLEM: Mock returns a different shape than the real function
// The real function returns { data: { zones: [...] } }
// The mock returns { zones: [...] }

// Diagnose by logging the actual call:
const mockFn = mock.fn((...args) => {
  console.log('Mock called with:', JSON.stringify(args));
  return { data: { zones: [] } }; // match the real shape exactly
});

// Verify mock was called the expected number of times
it('should call fetchZones once', async () => {
  await system.refresh();
  assert.equal(mockFn.mock.calls.length, 1);
  // Inspect what arguments were passed
  const callArgs = mockFn.mock.calls[0].arguments;
  console.log('Called with:', callArgs);
});
```

### Mock Restoration

```js
// PROBLEM: Mock from a previous test leaks into the next test
// SOLUTION: Use mock.reset() or mock.restoreAll() in afterEach

const { mock } = require('node:test');

afterEach(() => {
  mock.restoreAll();
});
```

## Step 4 — Resolve Timing Issues

### Async Operations Not Awaited

```js
// PROBLEM: Test completes before async operation finishes
// BAD:
it('should emit event', () => {
  system.process(); // returns a Promise, not awaited
  assert.equal(system.eventCount, 1); // runs before process() completes
});

// GOOD:
it('should emit event', async () => {
  await system.process();
  assert.equal(system.eventCount, 1);
});
```

### Race Conditions with Event Emitters

```js
// PROBLEM: Listener is registered after the event fires
// BAD:
it('should receive status update', async () => {
  system.startMonitoring(); // emits 'status' immediately
  const result = await new Promise((resolve) => {
    system.on('status', resolve); // too late, event already fired
  });
});

// GOOD: Register listener before triggering the event
it('should receive status update', async () => {
  const resultPromise = new Promise((resolve) => {
    system.on('status', resolve);
  });
  system.startMonitoring();
  const result = await resultPromise;
  assert.ok(result);
});
```

### setTimeout / setInterval in Tests

```js
// PROBLEM: Tests that use real timers are slow and flaky
// BAD:
it('should retry after delay', async () => {
  system.retryDelay = 2000;
  await system.retryOperation(); // waits 2 real seconds
});

// GOOD: Use mock timers (Node.js 22)
it('should retry after delay', async () => {
  const { mock } = require('node:test');
  mock.timers.enable({ apis: ['setTimeout'] });
  const retryPromise = system.retryOperation();
  mock.timers.tick(2000);
  await retryPromise;
  mock.timers.reset();
});
```

## Step 5 — Fix Common Assertion Errors

### Object Comparison

```js
// PROBLEM: assert.equal fails on objects (compares by reference)
// BAD:
assert.equal(system.getStatus(), { initialized: true }); // always fails

// GOOD: Use deepEqual for objects
assert.deepStrictEqual(system.getStatus(), { initialized: true, zones: [] });

// Or check individual properties
const status = system.getStatus();
assert.equal(status.initialized, true);
assert.ok(Array.isArray(status.zones));
```

### Error Assertion

```js
// PROBLEM: assert.throws does not match the error correctly
// BAD:
assert.throws(() => system.validate(null), 'Invalid input');
// The second argument is treated as a message for the assertion, not an error match

// GOOD: Use an object matcher
assert.throws(
  () => system.validate(null),
  { message: /invalid/i }
);

// For async functions, use rejects
await assert.rejects(
  () => system.asyncValidate(null),
  { message: /invalid/i }
);
```

### Floating Point Comparison

```js
// PROBLEM: Floating point precision
// BAD:
assert.equal(0.1 + 0.2, 0.3); // fails

// GOOD: Use epsilon comparison
const result = 0.1 + 0.2;
assert.ok(Math.abs(result - 0.3) < Number.EPSILON * 10);
```

## Step 6 — Stabilization Patterns

### Retry Wrapper for Known Flaky External Dependencies

```js
// Only use this for integration/E2E tests that depend on service startup
async function retryTest(fn, { retries = 3, delay = 1000 } = {}) {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      await fn();
      return;
    } catch (err) {
      lastError = err;
      if (i < retries - 1) {
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

// Usage in E2E test
it('backend health check', async () => {
  await retryTest(async () => {
    const res = await fetch('http://localhost:3000/api/v1/health');
    assert.equal(res.status, 200);
  }, { retries: 5, delay: 2000 });
});
```

### Deterministic Test Data

```js
// BAD: Random test data makes failures hard to reproduce
it('should handle zone', () => {
  const zoneId = `zone-${Math.random()}`;
  system.addZone(zoneId);
});

// GOOD: Fixed test data with descriptive names
it('should handle zone', () => {
  const zoneId = 'test-zone-living-room';
  system.addZone(zoneId);
});
```

### Cleanup Discipline

```js
// Every test suite that creates resources must clean them up
describe('SystemUnderTest', () => {
  let system;
  let server;

  beforeEach(async () => {
    system = new SystemUnderTest(mockHomey);
    await system.initialize();
  });

  afterEach(async () => {
    if (system) await system.destroy();
    if (server) server.close();
    system = null;
    server = null;
  });
});
```

## Step 7 — Triage Decision Tree

```
Test fails
  |
  +-- Fails every time?
  |     +-- YES --> Code bug or test bug
  |     |     +-- Does the test pass if run alone?
  |     |           +-- YES --> State leak from another test (Step 2)
  |     |           +-- NO  --> Read error message, check assertion (Step 5)
  |     |
  |     +-- NO  --> Flaky test
  |           +-- Timing related? (different durations each run)
  |           |     +-- YES --> Fix async/timer issues (Step 4)
  |           +-- Mock related? (mock not applied sometimes)
  |           |     +-- YES --> Fix mock lifecycle (Step 3)
  |           +-- Environment related? (works locally, fails in CI)
  |                 +-- YES --> Check env vars, ports, Docker state
  |
  +-- Many tests fail at once?
        +-- YES --> Shared state corruption or breaking change in core module
        +-- NO  --> Isolated issue, fix the specific test
```

## Test Triage Checklist

Reproduce:
- [ ] Ran `npm run test:all` to confirm failure
- [ ] Ran the failing test file in isolation
- [ ] Classified the failure: deterministic, flaky, environment, or cascade

Isolate:
- [ ] Confirmed whether the test passes when run alone
- [ ] Checked for global state pollution (env vars, event listeners, intervals)
- [ ] Verified mock setup and teardown lifecycle

Diagnose:
- [ ] Read the full error message and stack trace
- [ ] Checked assertion type (equal vs deepEqual, throws vs rejects)
- [ ] Verified async operations are properly awaited
- [ ] Confirmed mock returns match the real function's shape

Fix:
- [ ] Applied the fix to the test or source code
- [ ] Ran the full test suite to confirm no regressions
- [ ] Added `afterEach` cleanup if state leak was the cause
- [ ] Replaced real timers with mock timers if timing was the issue

Verify:
- [ ] `npm run test:all` passes
- [ ] `npm run lint:all` passes
- [ ] Ran the test 5 times consecutively to confirm stability

## Rules

1. Never skip a failing test without a documented reason and a follow-up task.
2. Never add retry logic to unit tests; fix the root cause instead.
3. Retry logic is acceptable only in E2E tests that depend on service startup.
4. Every `beforeEach` must have a corresponding `afterEach` for cleanup.
5. Mock all external dependencies; tests must not make real network calls.
6. Use deterministic test data; avoid `Math.random()` or `Date.now()` in assertions.
7. Fix flaky tests within 24 hours of discovery; they erode trust in the suite.
8. Run the full suite after every fix to catch regressions.
9. Document the root cause of every test failure fix in the commit message.
10. If a test has been flaky more than 3 times, rewrite it from scratch.
