---
name: module-testing
description: "Creates comprehensive test suites for HomeySmartHome backend and dashboard modules using Node.js built-in test patterns with initialization, data operations, error handling, and integration tests"
argument-hint: "[module-name]"
---

# Module Testing

Creates comprehensive test suites for HomeySmartHome modules.

## Test Architecture

```
homey-app/test-suite.js          ← Backend module tests
web-dashboard/test-suite.js      ← Dashboard module tests
npm run test:all                 ← Runs both suites
```

## Test Pattern

```javascript
'use strict';

// Mock Homey SDK
const mockHomey = {
  settings: {
    _store: {},
    get(key) { return this._store[key] || null; },
    set(key, value) { this._store[key] = value; }
  },
  flow: {
    getFlowCardTrigger: () => ({ registerRunListener: () => {} }),
    getFlowCardAction: () => ({ registerRunListener: () => {} }),
    getFlowCardCondition: () => ({ registerRunListener: () => {} })
  },
  log: console.log,
  error: console.error
};

async function testModuleName() {
  const ModuleName = require('./lib/ModuleName');
  console.log('\n📋 Testing ModuleName...');
  let passed = 0;
  let failed = 0;

  // Test 1: Construction
  try {
    const mod = new ModuleName(mockHomey);
    if (!mod) throw new Error('Constructor returned falsy');
    passed++;
    console.log('  ✅ Construction');
  } catch (e) {
    failed++;
    console.error('  ❌ Construction:', e.message);
  }

  // Test 2: Initialization
  try {
    const mod = new ModuleName(mockHomey);
    await mod.initialize();
    const status = await mod.getStatus();
    if (!status.active) throw new Error('Not active after init');
    if (!status.name) throw new Error('Missing name in status');
    passed++;
    console.log('  ✅ Initialization');
  } catch (e) {
    failed++;
    console.error('  ❌ Initialization:', e.message);
  }

  // Test 3: Double initialization (idempotent)
  try {
    const mod = new ModuleName(mockHomey);
    await mod.initialize();
    await mod.initialize();
    const status = await mod.getStatus();
    if (!status.active) throw new Error('Not active after double init');
    passed++;
    console.log('  ✅ Double initialization');
  } catch (e) {
    failed++;
    console.error('  ❌ Double initialization:', e.message);
  }

  // Test 4: Data operations
  try {
    const mod = new ModuleName(mockHomey);
    await mod.initialize();
    if (mod.getData) {
      const data = await mod.getData();
      if (data === undefined) throw new Error('getData returned undefined');
    }
    passed++;
    console.log('  ✅ Data operations');
  } catch (e) {
    failed++;
    console.error('  ❌ Data operations:', e.message);
  }

  // Test 5: Error handling — null input
  try {
    const mod = new ModuleName(mockHomey);
    await mod.initialize();
    if (mod.updateData) {
      try { await mod.updateData(null, null); } catch (e) { /* expected */ }
    }
    passed++;
    console.log('  ✅ Null input handling');
  } catch (e) {
    failed++;
    console.error('  ❌ Null input handling:', e.message);
  }

  // Test 6: Shutdown
  try {
    const mod = new ModuleName(mockHomey);
    await mod.initialize();
    if (mod.shutdown) {
      await mod.shutdown();
      const status = await mod.getStatus();
      if (status.active) throw new Error('Still active after shutdown');
    }
    passed++;
    console.log('  ✅ Shutdown');
  } catch (e) {
    failed++;
    console.error('  ❌ Shutdown:', e.message);
  }

  console.log(`\n📊 ModuleName: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}
```

## What to Test

| Test Category | Priority | Description |
|---------------|----------|-------------|
| Construction | Required | Module instantiates without errors |
| Initialization | Required | Module initializes and reports active |
| Idempotency | Required | Double init doesn't corrupt state |
| Status | Required | `getStatus()` returns expected shape |
| Data read | Required | `getData()` returns valid data |
| Data write | Required | `updateData()` persists data |
| Null handling | Required | Null/undefined inputs don't crash |
| Shutdown | Required | Cleanup releases resources |
| Config loading | Important | Settings load from homey.settings |
| Error recovery | Important | Module recovers from init failure |
| API integration | Optional | REST endpoints return correct data |

## Running Tests

```bash
# All tests
npm run test:all

# Backend only
cd homey-app && npm test

# Dashboard only
cd web-dashboard && npm test

# Docker-based tests
./deploy.sh test

# With verbose output
cd homey-app && node test-suite.js 2>&1
```

## Quality Rules

1. Every module must have at least 6 test cases
2. Tests must be deterministic — no timing dependencies
3. Use mock objects for external dependencies (Homey SDK)
4. Clean up state between tests (new instance per test)
5. Log results with emoji prefixes (✅ ❌ 📊)
6. Return `{ passed, failed }` for aggregation
7. Never make network calls in unit tests
8. Test both success and failure paths
