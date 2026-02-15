---
mode: "agent"
description: "Refactor HomeySmartHome code following DRY, SOLID, and project conventions"
---

# Code Refactoring

Systematically refactor code while preserving functionality.

## Process

### 1. Assess Scope
- Read all files that will be affected
- Identify code duplication, tight coupling, or oversized modules
- Run tests to establish a passing baseline: `npm run test:all`

### 2. Plan Changes
- List specific refactoring operations (extract, rename, move, split)
- Identify shared patterns that can become utilities in `homey-app/lib/utils/`
- Map all import/require chains that will need updating

### 3. Execute Incrementally
- Make one refactoring change at a time
- Run lint after each change: `npm run lint:all`
- Run tests after each change: `npm run test:all`

### 4. Common Refactoring Patterns
- **Extract base class:** Multiple modules with identical `constructor`/`initialize`/`getStatus`
- **Extract utility:** Repeated helper functions → `homey-app/lib/utils/`
- **Split large file:** Module doing too many things → separate concerns
- **Standardize interface:** Ensure all modules follow the same public API shape

### 5. Verify
- All tests pass
- No lint errors
- Health endpoints respond correctly
- No orphaned imports or dead code
- Git diff shows a clean, reviewable changeset
