---
mode: "agent"
description: "Dockerize a new service or optimize existing Docker configuration for HomeySmartHome"
---

# Dockerize

Create or improve Docker configuration for HomeySmartHome services.

## Production Dockerfile Template

```dockerfile
# Build stage
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Production stage
FROM node:22-alpine
RUN apk add --no-cache curl dumb-init
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=40s \
  CMD curl -f http://localhost:3000/health || exit 1
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
```

## Docker Compose Service Template

```yaml
service-name:
  build:
    context: ./service-dir
    dockerfile: Dockerfile
  ports:
    - "3000:3000"
  environment:
    - NODE_ENV=production
    - TZ=Europe/Stockholm
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
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
  restart: unless-stopped
  logging:
    driver: "json-file"
    options:
      max-size: "10m"
      max-file: "5"
```

## Build and Run

```bash
docker compose build --no-cache
docker compose up -d
./deploy.sh status
```

## Security Checklist
- [ ] Non-root user (USER node)
- [ ] Multi-stage build (no devDependencies)
- [ ] Read-only filesystem
- [ ] no-new-privileges
- [ ] Resource limits
- [ ] Health checks
- [ ] dumb-init for PID 1
- [ ] .dockerignore excludes .git, node_modules, .env
