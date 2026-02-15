---
name: refactor-safely
description: "Guides safe refactoring of HomeySmartHome code using seams, adapter patterns, tests-first approach, incremental changes, and regression verification to minimize risk while improving code quality"
argument-hint: "[module-or-file] [refactoring-type]"
---

# Refactor Safely

Safe refactoring practices for the HomeySmartHome codebase, minimizing risk of regression.

## Core Principle

**Never refactor without a green test suite first.** If no tests exist for the code you're refactoring, write them before making any changes.

## Step-by-Step Process

### 1. Establish Baseline

```bash
# Verify all tests pass before touching anything
npm run test:all
npm run lint:all

# Save the current state as reference
git stash         # If uncommitted changes exist
git log --oneline -1   # Note the baseline commit
```

### 2. Identify Seams

Seams are natural boundaries where code can be safely split or reorganized.

In HomeySmartHome, common seams are:

| Seam Type | Example | Location |
|-----------|---------|----------|
| Module boundary | `SmartEnergyManagementSystem` class | `homey-app/lib/` |
| API route | `app.get('/api/v1/energy')` | `homey-app/server.js` |
| Socket event | `socket.on('energy:subscribe')` | `web-dashboard/server.js` |
| Config section | Energy settings in `config.json` | `homey-app/config.json` |

### 3. Write Characterization Tests

Before refactoring, capture current behavior:

```javascript
'use strict';

async function characterizeModule(ModuleClass, mockHomey) {
  const mod = new ModuleClass(mockHomey);

  // Capture: Does it initialize without error?
  let initResult;
  try {
    await mod.initialize();
    initResult = 'success';
  } catch (e) {
    initResult = e.message;
  }

  // Capture: What does getStatus return?
  const status = await mod.getStatus();

  // Capture: What keys are in status?
  const statusKeys = Object.keys(status).sort();

  return { initResult, status, statusKeys };
}
```

### 4. Refactoring Patterns

#### Extract Base Class
When multiple modules share `constructor` → `initialize` → `getStatus` pattern:

```javascript
'use strict';

class BaseSmartModule {
  constructor(homey, name) {
    this.homey = homey;
    this.name = name;
    this._initialized = false;
  }

  async initialize() {
    try {
      await this._setup();
      this._initialized = true;
      console.log(`✅ ${this.name} initialized`);
    } catch (error) {
      console.error(`❌ ${this.name} init failed:`, error.message);
    }
  }

  async _setup() {
    // Override in subclass
  }

  async getStatus() {
    return { active: this._initialized, name: this.name };
  }
}

module.exports = BaseSmartModule;
```

#### Extract Utility Function
When identical logic appears in 3+ modules:

```javascript
// homey-app/lib/utils/validation.js
'use strict';

function validateNumericRange(value, min, max, label) {
  const num = Number(value);
  if (isNaN(num)) throw new Error(`${label} must be a number`);
  if (num < min || num > max) throw new Error(`${label} must be between ${min} and ${max}`);
  return num;
}

module.exports = { validateNumericRange };
```

#### Split Large Module
When a module exceeds ~500 lines, extract sub-concerns:

```
# Before
homey-app/lib/SmartEnergyManagementSystem.js (800 lines)

# After
homey-app/lib/SmartEnergyManagementSystem.js (200 lines — orchestrator)
homey-app/lib/utils/energy-calculator.js (150 lines — calculation logic)
homey-app/lib/utils/energy-scheduler.js (150 lines — scheduling logic)
```

### 5. Incremental Execution

1. Make **one** refactoring change
2. Run `npm run lint:all` — fix any issues
3. Run `npm run test:all` — verify green
4. Commit: `refactor: extract <what> from <where>`
5. Repeat for the next change

**Never batch multiple refactoring operations in one commit.**

### 6. Verify No Regressions

```bash
# After all refactoring is complete
npm run lint:all                    # No new warnings
npm run test:all                    # All tests pass
docker compose build                # Docker still builds
./deploy.sh status                  # Health checks pass (if deployed)
```

### 7. Update Imports

After moving code, search for all references:

```bash
# Find all files importing the refactored module
grep -r "require.*ModuleName" homey-app/ web-dashboard/
```

Update every `require()` path to point to the new location.

## Hard Rules

1. **Tests first** — Never refactor without passing tests
2. **One change per commit** — Isolate refactoring steps
3. **No behavior changes** — Refactoring must preserve external behavior
4. **No new features** — Refactoring and features are separate commits
5. **Update all imports** — Leave no broken `require()` calls
6. **Run gates after each step** — Catch regressions immediately
7. **Keep backward compatibility** — If a module is `require()`d externally, keep the export shape

## Checklist

- [ ] Baseline tests pass before starting
- [ ] Characterization tests written for refactored code
- [ ] Each refactoring step is a separate commit
- [ ] All `require()` paths updated
- [ ] `npm run lint:all` passes
- [ ] `npm run test:all` passes
- [ ] `docker compose build` succeeds
- [ ] No dead code left behind
- [ ] No behavior changes (verify with characterization tests)
