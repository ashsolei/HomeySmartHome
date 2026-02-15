---
mode: "agent"
description: "Safely update npm dependencies across HomeySmartHome services"
---

# Dependency Update

Safely update npm dependencies for HomeySmartHome.

## Process

### 1. Audit Current State
```bash
cd homey-app && npm outdated && npm audit
cd web-dashboard && npm outdated && npm audit
```

### 2. Update Strategy
- **Patch updates** (1.0.x): Safe to update immediately
- **Minor updates** (1.x.0): Review changelog, update with testing
- **Major updates** (x.0.0): Review breaking changes, plan migration

### 3. Update One Service at a Time
```bash
# Backend
cd homey-app
npm update                    # Patch + minor updates
npm run lint && npm test     # Verify

# Dashboard
cd web-dashboard
npm update
npm run lint && npm test     # Verify
```

### 4. For Major Version Updates
1. Read the changelog and migration guide
2. Update `package.json` manually
3. Run `npm install`
4. Fix any breaking changes
5. Run full test suite
6. Test in Docker: `docker compose build --no-cache && docker compose up -d`

### 5. Verify
- [ ] `npm audit` shows no critical vulnerabilities
- [ ] `npm run lint:all` passes
- [ ] `npm run test:all` passes
- [ ] Health endpoints respond correctly
- [ ] Docker build succeeds
- [ ] No runtime errors in logs

### Key Dependencies to Watch
- **Express 5.x** — Major version, check for API changes
- **Socket.IO 4.x** — Check client/server version compatibility
- **Helmet 8.x** — CSP and header changes
- **Node.js 22** — Engine requirement in both package.json files
