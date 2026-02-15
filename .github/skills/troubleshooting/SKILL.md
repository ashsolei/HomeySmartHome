---
name: troubleshooting
description: "Diagnoses and resolves issues in HomeySmartHome services including Docker container failures, Express routing errors, Socket.IO disconnections, module initialization failures, and CI/CD pipeline problems"
argument-hint: "[error-message-or-symptom]"
---

# Troubleshooting

Systematic troubleshooting guide for HomeySmartHome issues.

## Quick Diagnostics

```bash
# 1. Check service status
docker compose ps
./deploy.sh status

# 2. Health checks
curl -sf http://localhost:3000/health && echo "Backend OK" || echo "Backend FAIL"
curl -sf http://localhost:3001/health && echo "Dashboard OK" || echo "Dashboard FAIL"
curl -sf http://localhost/nginx-health && echo "Nginx OK" || echo "Nginx FAIL"

# 3. Recent logs
docker compose logs --tail 30 smarthomepro
docker compose logs --tail 30 dashboard
docker compose logs --tail 30 nginx

# 4. Resource usage
docker stats --no-stream
```

## Common Issues & Solutions

### Container Won't Start

**Symptom:** Container exits immediately or is in "restarting" state.

**Diagnosis:**
```bash
docker compose logs <service-name>
docker compose ps -a
```

**Common causes:**
| Cause | Log Indicator | Fix |
|-------|---------------|-----|
| Missing .env | `Cannot find .env` | Copy `.env.example` to `.env` |
| Port conflict | `EADDRINUSE` | Check `lsof -i :3000` |
| Syntax error | `SyntaxError` | Fix the JS file |
| Missing dependency | `Cannot find module` | Run `npm install` or rebuild image |
| Permission denied | `EACCES` | Check file ownership in Dockerfile |

### 502 Bad Gateway

**Symptom:** Nginx returns 502 for API or dashboard routes.

**Diagnosis:**
```bash
# Check if upstream services are running
docker compose exec nginx curl http://smarthomepro:3000/health
docker compose exec nginx curl http://dashboard:3001/health

# Check Nginx config
docker compose exec nginx nginx -t
```

**Fixes:**
- Service not started: Wait for health check or increase `start_period`
- Wrong port: Verify port in `docker-compose.yml` matches service
- DNS resolution: Ensure service names match `docker-compose.yml`

### WebSocket Disconnection

**Symptom:** Socket.IO clients disconnect frequently or can't connect.

**Diagnosis:**
```bash
# Check Nginx WebSocket config
docker compose exec nginx nginx -t

# Test WebSocket upgrade
curl -v -H "Upgrade: websocket" -H "Connection: Upgrade" http://localhost/socket.io/
```

**Fixes:**
- Missing upgrade headers in `nginx/nginx.conf`
- `proxy_read_timeout` too short (should be 86400 for WebSocket)
- CORS blocking WebSocket connections

### Module Initialization Failure

**Symptom:** Module shows inactive in status, logs show `❌` initialization error.

**Diagnosis:**
```bash
# Check specific module logs
docker compose logs smarthomepro 2>&1 | grep -i "modulename"

# Check module status via API
curl http://localhost:3000/api/v1/modules/status
```

**Common causes:**
- Missing configuration in `config.json` or `.env`
- Dependency module not initialized yet (load order issue)
- Invalid data in saved settings

### Rate Limiting Blocks

**Symptom:** Getting 429 responses, legitimate requests blocked.

**Diagnosis:**
```bash
# Check current rate limit settings
grep -n "rate=" nginx/nginx.conf

# Test rate limiting
for i in $(seq 1 50); do
  echo -n "$i: "
  curl -s -o /dev/null -w "%{http_code}" http://localhost/api/v1/health
  echo
done
```

**Fixes:**
- Increase `rate` or `burst` in `nginx/nginx.conf`
- Add specific rate limit zone for high-traffic endpoints
- Check if Express rate-limit is also blocking

### Out of Memory

**Symptom:** Container killed with OOMKilled status.

**Diagnosis:**
```bash
docker inspect <container-id> | grep -A 5 OOMKilled
docker stats --no-stream
curl http://localhost:3000/metrics | grep memory
```

**Fixes:**
- Increase memory limit in `docker-compose.yml`
- Check for memory leaks: circular references, event listener accumulation
- Reduce module count or implement lazy loading

### CI/CD Pipeline Failure

**Symptom:** GitHub Actions workflow fails.

**Diagnosis:**
- Check the Actions tab in GitHub for the failed job
- Read the log output for the specific step that failed

**Common causes:**
| Step | Failure | Fix |
|------|---------|-----|
| npm ci | Lock file mismatch | Run `npm install` locally, commit lock file |
| npm run lint | ESLint errors | Fix lint issues |
| npm test | Test failure | Fix failing tests |
| npm audit | Vulnerability found | Update affected dependency |
| docker build | Build error | Fix Dockerfile or dependency |
| health check | Timeout | Increase wait time or fix startup |

## Escalation Path

1. **Read logs** — 90% of issues are visible in container logs
2. **Check config** — Environment variables, ports, file paths
3. **Test in isolation** — Run the service directly with `node server.js`
4. **Check dependencies** — `npm ls`, `npm audit`
5. **Compare with working state** — `git diff`, `git log`
6. **Rebuild from scratch** — `./deploy.sh clean && ./deploy.sh start`
