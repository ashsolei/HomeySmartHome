---
mode: "agent"
description: "Detect and safely handle breaking changes in HomeySmartHome APIs, modules, and configuration"
---

# Breaking Change Guard

Detect, document, and safely manage breaking changes.

## What Constitutes a Breaking Change

- Removing or renaming an API endpoint
- Changing response format of existing endpoints
- Removing or renaming exported module methods
- Changing environment variable names
- Modifying Docker Compose service names or ports
- Changing Socket.IO event names
- Removing automation template fields

## Detection Process

### 1. Compare API Surface
```bash
# Diff server routes
git diff HEAD~1 -- homey-app/server.js homey-app/api.js web-dashboard/server.js | grep -E "^[+-].*(app\.(get|post|put|delete)|router\.(get|post|put|delete))"
```

### 2. Check Module Exports
```bash
# Diff module.exports
git diff HEAD~1 -- homey-app/lib/ | grep -E "^[+-].*module\.exports"
```

### 3. Check Environment Variables
```bash
# Diff env usage
git diff HEAD~1 -- .env.example
```

### 4. Check Docker Configuration
```bash
git diff HEAD~1 -- docker-compose.yml docker-compose.dev.yml
```

## Mitigation Strategies

### For API Changes
1. Version the endpoint: `/api/v1/old` → `/api/v2/new`
2. Keep old endpoint as deprecated alias for one release
3. Document the change in API.md

### For Module Changes
1. Keep old method as wrapper calling new method
2. Log deprecation warning
3. Remove in next major version

### For Config Changes
1. Support both old and new env var names temporarily
2. Log warning when old name is used
3. Update `.env.example` and documentation

## Commit Convention
```
feat!: description of breaking change

BREAKING CHANGE: detailed description of what changed and migration steps
```
