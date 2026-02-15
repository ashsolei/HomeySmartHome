---
mode: "agent"
description: "Generate a comprehensive test suite for a HomeySmartHome module"
---

# Test Suite Generation

Write tests for a HomeySmartHome module following the project's testing conventions.

## Test Structure

```javascript
'use strict';

async function testModuleName() {
  console.log('\n📋 Testing ModuleName...');
  let passed = 0;
  let failed = 0;

  // Test 1: Module instantiation
  try {
    const mod = new ModuleName();
    if (!mod) throw new Error('Module not created');
    passed++;
    console.log('  ✅ Module instantiation');
  } catch (e) {
    failed++;
    console.log('  ❌ Module instantiation:', e.message);
  }

  // Test 2: Initialization
  try {
    const mod = new ModuleName();
    await mod.initialize();
    const status = await mod.getStatus();
    if (!status.active) throw new Error('Module not active after init');
    passed++;
    console.log('  ✅ Initialization');
  } catch (e) {
    failed++;
    console.log('  ❌ Initialization:', e.message);
  }

  // Test 3: Error handling
  try {
    const mod = new ModuleName();
    // Test with invalid input — should not throw
    await mod.handleInput(null);
    passed++;
    console.log('  ✅ Error handling');
  } catch (e) {
    failed++;
    console.log('  ❌ Error handling:', e.message);
  }

  console.log(`\n📊 ModuleName: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}
```

## What to Test

1. **Module creation** — Constructor doesn't throw
2. **Initialization** — `initialize()` completes successfully
3. **Status** — `getStatus()` returns expected shape
4. **Core methods** — Each public method with valid input
5. **Error handling** — Invalid/null/undefined inputs don't crash
6. **Edge cases** — Empty arrays, missing config, boundary values
7. **Cleanup** — Module cleans up resources properly

## Testing Commands
```bash
cd homey-app && npm test
cd web-dashboard && npm test
npm run test:all
```
