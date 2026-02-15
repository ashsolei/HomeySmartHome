---
mode: "agent"
description: "Deploy HomeySmartHome to production with safety checks and verification"
---

# Production Deployment

Deploy HomeySmartHome following the safety checklist.

## Pre-Deployment
1. Verify `.env` exists with all required variables
2. Run linting: `npm run lint:all`
3. Run tests: `npm run test:all`
4. Check git status — no uncommitted changes

## Deploy
```bash
# Option A: deploy.sh
./deploy.sh start

# Option B: Docker Compose
docker compose build --no-cache
docker compose up -d
```

## Post-Deployment Verification
```bash
# Check containers are running
docker compose ps

# Health checks
curl http://localhost:3000/health    # Backend
curl http://localhost:3001/health    # Dashboard
curl http://localhost/nginx-health   # Nginx

# Check logs for errors
docker compose logs --tail 20 smarthomepro
docker compose logs --tail 20 dashboard

# Verify metrics
curl http://localhost:3000/metrics

# Full status
./deploy.sh status
```

## Rollback
```bash
# Stop current deployment
docker compose down

# Revert to previous version
git checkout HEAD~1
docker compose build --no-cache
docker compose up -d
```

## Checklist
- [ ] All health endpoints return 200
- [ ] No error messages in container logs
- [ ] Rate limiting is active
- [ ] WebSocket connections work through Nginx
- [ ] Prometheus metrics are being scraped
- [ ] Resource usage is within limits (`docker stats`)
