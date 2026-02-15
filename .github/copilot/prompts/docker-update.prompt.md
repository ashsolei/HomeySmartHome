---
mode: "agent"
description: "Update Docker configuration — Dockerfiles, Compose files, and Nginx config"
---

# Docker Configuration Update

Update HomeySmartHome Docker infrastructure.

## Key Files
- `docker-compose.yml` — Production (3 services)
- `docker-compose.dev.yml` — Development (5 services)
- `homey-app/Dockerfile` — Backend production image
- `homey-app/Dockerfile.dev` — Backend development image
- `web-dashboard/Dockerfile` — Dashboard production image
- `web-dashboard/Dockerfile.dev` — Dashboard development image
- `nginx/nginx.conf` — Reverse proxy configuration

## Production Compose Pattern
```yaml
services:
  service-name:
    build:
      context: ./service-dir
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      resources:
        limits:
          memory: 768M
          cpus: '1.5'
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp
    restart: unless-stopped
```

## Security Requirements
- Non-root user (`USER node`)
- Read-only filesystem (`read_only: true`)
- No new privileges (`no-new-privileges:true`)
- Resource limits on all services
- Health checks on all services
- Log rotation configured

## Verification
```bash
docker compose build --no-cache
docker compose up -d
docker compose ps           # All healthy
./deploy.sh status          # Full health check
docker stats --no-stream    # Resource usage
```
