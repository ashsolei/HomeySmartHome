---
name: version-management
description: "Manages version bumping across all HomeySmartHome services (root, backend, dashboard, app.json) following SemVer conventions with changelog generation and git tagging"
argument-hint: "[major|minor|patch] [version-number]"
---

# Version Management

Manages version numbers across all HomeySmartHome services.

## Files to Update

| File | Field | Current |
|------|-------|---------|
| `package.json` (root) | `"version"` | 3.3.0 |
| `homey-app/package.json` | `"version"` | 3.3.0 |
| `homey-app/app.json` | `"version"` | 3.3.0 |
| `web-dashboard/package.json` | `"version"` | 3.3.0 |

All four files **must** have the same version number.

## SemVer Rules

| Bump | When | Example |
|------|------|---------|
| MAJOR (x.0.0) | Breaking API changes, architecture overhaul | 3.3.0 → 4.0.0 |
| MINOR (0.x.0) | New modules, features, or development waves | 3.3.0 → 3.4.0 |
| PATCH (0.0.x) | Bug fixes, security patches, dependency updates | 3.3.0 → 3.3.1 |

## Version Bump Process

### 1. Determine Version

Review changes since last version:
```bash
git log --oneline v3.3.0..HEAD   # If tags exist
git log --oneline -20             # Recent commits
```

### 2. Update All Files

Update version in all four files simultaneously:

```bash
# Verify current versions match
grep '"version"' package.json homey-app/package.json web-dashboard/package.json homey-app/app.json
```

### 3. Update Changelog (if exists)

```markdown
## [3.4.0] - 2025-XX-XX

### Added
- New SmartXxxSystem module (Wave 11)
- Dashboard feature-name module

### Changed
- Improved module initialization performance

### Fixed
- Socket.IO reconnection handling
```

### 4. Commit and Tag

```bash
git add package.json homey-app/package.json homey-app/app.json web-dashboard/package.json
git commit -m "chore: bump version to 3.4.0"
git tag -a v3.4.0 -m "Release 3.4.0 — description of release"
```

### 5. Verify

```bash
# All versions match
grep '"version"' package.json homey-app/package.json web-dashboard/package.json

# Docker builds with new version
docker compose build --no-cache

# Tests pass
npm run test:all
```

## Version History Pattern

Based on git history:
- v3.3.0 — Security hardening, rate limiting, Wave 16 (111 systems)
- v3.2.0 — Autonomous Docker deploy, Prometheus metrics
- v3.1.0 — Testing, graceful shutdown, automation library

## Commit Message Convention

```
chore: bump version to X.Y.Z

feat: v3.4.0 — brief description of major changes

Changes:
- New feature 1
- New feature 2
- Bug fix 1
```

## Quality Gates Before Release

1. [ ] All tests pass: `npm run test:all`
2. [ ] All lint checks pass: `npm run lint:all`
3. [ ] Docker build succeeds: `docker compose build`
4. [ ] Health checks pass: `./deploy.sh status`
5. [ ] No critical security vulnerabilities: `npm audit`
6. [ ] Version numbers match across all files
7. [ ] Documentation updated (MODULES.md, API.md if applicable)
