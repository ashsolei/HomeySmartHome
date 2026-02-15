---
mode: "agent"
description: "Create and execute a rollback plan for failed HomeySmartHome deployments"
---

# Rollback Plan

Safely revert a failed HomeySmartHome deployment.

## Immediate Actions (First 2 Minutes)

### 1. Assess Damage
```bash
./deploy.sh status
docker compose ps
docker compose logs --tail 30
```

### 2. Quick Rollback (Docker)
```bash
docker compose down
git log --oneline -10               # Find last known good commit
git checkout <good-commit>
docker compose build --no-cache
docker compose up -d
./deploy.sh status                  # Verify recovery
```

### 3. Quick Rollback (Code Only)
```bash
git revert HEAD                     # Revert last commit
npm run test:all                    # Verify tests pass
docker compose build --no-cache
docker compose up -d
```

## Rollback Strategies

| Scenario | Strategy |
|----------|----------|
| Bad code deploy | `git revert HEAD` + rebuild |
| Broken dependency | Revert `package.json` + `npm ci` |
| Docker config issue | Revert compose file + `docker compose up -d` |
| Database migration | Run down migration (if applicable) |
| Nginx misconfiguration | Revert `nginx.conf` + `docker compose restart nginx` |

## Post-Rollback

1. Verify all health endpoints
2. Check logs for residual errors
3. Document what went wrong
4. Create a fix on a separate branch
5. Re-run full quality gates before re-deploying

## Prevention

- Always run `./deploy.sh test` before `./deploy.sh start`
- Keep previous Docker images tagged for instant rollback
- Use feature flags for risky features
- Deploy during low-traffic windows
