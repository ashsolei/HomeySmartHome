---
mode: "agent"
description: "Bump version numbers across all HomeySmartHome services consistently"
---

# Version Bump

Update version numbers across all HomeySmartHome services.

## Files to Update
1. `package.json` (root) — `"version": "x.y.z"`
2. `homey-app/package.json` — `"version": "x.y.z"`
3. `homey-app/app.json` — `"version": "x.y.z"`
4. `web-dashboard/package.json` — `"version": "x.y.z"`

## Versioning Strategy (SemVer)
- **MAJOR (x.0.0):** Breaking API changes, architecture overhauls
- **MINOR (0.x.0):** New modules, features, or waves
- **PATCH (0.0.x):** Bug fixes, security patches, dependency updates

## Process
1. Determine the new version based on changes since last release
2. Update all four files simultaneously
3. Update any references in documentation (README.md, etc.)
4. Commit: `git commit -m "chore: bump version to x.y.z"`
5. Tag: `git tag vx.y.z`

## Current Version: 3.3.0

## Checklist
- [ ] All four package files updated to same version
- [ ] `npm run lint:all` passes
- [ ] `npm run test:all` passes
- [ ] Docker images build with new version
- [ ] Documentation reflects new version
