---
name: docker-deployment
description: "Manages Docker Compose deployment for HomeySmartHome including building images, starting/stopping services, health checks, Nginx proxy configuration, and production security hardening"
argument-hint: "[start|stop|restart|status|update]"
---

# Docker Deployment

Manages the full Docker Compose lifecycle for the HomeySmartHome platform.

## Architecture

```
docker-compose.yml (Production)
├── smarthomepro (port 3000) — Backend API + 114 modules
├── dashboard (port 3001) — Web dashboard + Socket.IO
└── nginx (port 80) — Reverse proxy + security

docker-compose.dev.yml (Development)
├── All production services +
├── redis (port 6379) — Caching
├── prometheus (port 9090) — Metrics
└── grafana (port 3002) — Dashboards
```

## Operations

### Start Production
```bash
# Using deploy script (recommended)
./deploy.sh start

# Using Docker Compose directly
docker compose build --no-cache
docker compose up -d
```

### Start Development
```bash
docker compose -f docker-compose.dev.yml up -d --build
```

### Stop
```bash
./deploy.sh stop
# or
docker compose down
```

### Health Check
```bash
./deploy.sh status
# Manual checks:
curl http://localhost:3000/health   # Backend
curl http://localhost:3001/health   # Dashboard
curl http://localhost/nginx-health  # Nginx
```

### View Logs
```bash
./deploy.sh logs
docker compose logs -f smarthomepro
docker compose logs -f dashboard
docker compose logs -f nginx
```

### Clean Everything
```bash
./deploy.sh clean
docker compose down -v --rmi all
```

## Production Docker Compose Requirements

Every service must have:

```yaml
services:
  service-name:
    build:
      context: ./service-dir
      dockerfile: Dockerfile
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:PORT/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
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
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "5"
```

## Resource Limits

| Service | Memory | CPU | Justification |
|---------|--------|-----|---------------|
| Backend | 768MB | 1.5 | 114 modules loaded in memory |
| Dashboard | 256MB | 0.5 | Lighter, serves UI + Socket.IO |
| Nginx | 64MB | 0.25 | Proxy only, minimal processing |
| Redis (dev) | 128MB | 0.25 | Caching layer |
| Prometheus (dev) | 256MB | 0.5 | Metrics storage |

## Security Checklist

1. All containers run as non-root user (`USER node` in Dockerfile)
2. Read-only filesystem enabled
3. `no-new-privileges` security option set
4. Resource limits prevent container escape via OOM
5. Log rotation configured (10MB max, 5 files)
6. Health checks enable automatic restart on failure
7. Tmpfs for temporary files (not persisted)
8. Named volumes for persistent data only

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Container exits immediately | Missing env vars | Check `.env` file exists |
| Health check failing | Service not ready | Increase `start_period` |
| 502 Bad Gateway | Backend not running | Check `docker compose logs smarthomepro` |
| WebSocket disconnect | Nginx config | Verify WebSocket upgrade headers |
| Out of memory | Resource limit too low | Increase memory limit in compose |
| Permission denied | Read-only filesystem | Add path to `tmpfs` section |
