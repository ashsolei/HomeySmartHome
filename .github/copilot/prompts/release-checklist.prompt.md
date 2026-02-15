---
mode: "agent"
description: "Pre-release validation checklist ensuring all quality gates pass before deployment"
---

# Release Checklist

Complete pre-release validation for a HomeySmartHome release.

## Pre-Release Gates

### 1. Code Quality
```bash
npm run lint:all                    # ✅ Zero lint errors
npm run test:all                    # ✅ All tests pass
```

### 2. Security
```bash
cd homey-app && npm audit --audit-level=moderate      # ✅ No moderate+ issues
cd web-dashboard && npm audit --audit-level=moderate   # ✅ No moderate+ issues
```

### 3. Version Consistency
```bash
# All four files must show the same version
grep '"version"' package.json homey-app/package.json web-dashboard/package.json homey-app/app.json
```

### 4. Docker Build
```bash
docker compose build --no-cache     # ✅ Builds successfully
```

### 5. Full Stack Test
```bash
docker compose up -d
sleep 15
curl -sf http://localhost:3000/health && echo "✅ Backend"
curl -sf http://localhost:3001/health && echo "✅ Dashboard"
curl -sf http://localhost/nginx-health && echo "✅ Nginx"
docker compose down
```

### 6. Documentation
- [ ] `MODULES.md` up to date with new modules
- [ ] `API.md` up to date with new endpoints
- [ ] `README.md` reflects current version
- [ ] Changelog/commit history is clean

### 7. Git State
```bash
git status                          # ✅ Clean working tree
git log --oneline -5                # ✅ Commits follow convention
```

## Release Steps

```bash
# Tag the release
git tag -a v<version> -m "Release <version>"

# Push
git push origin main --tags

# Deploy
./deploy.sh start
./deploy.sh status
```

## Rollback Plan

```bash
docker compose down
git checkout v<previous-version>
docker compose build --no-cache
docker compose up -d
./deploy.sh status
```
