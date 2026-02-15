---
mode: "agent"
description: "Create end-to-end tests that verify the full HomeySmartHome stack from browser to backend"
---

# End-to-End Tests

Verify the complete HomeySmartHome stack works from client to backend.

## E2E Test Workflow

### 1. Stack Setup
```bash
docker compose up -d --build
# Wait for all services
for i in $(seq 1 30); do
  curl -sf http://localhost/health && break
  sleep 2
done
```

### 2. Test Scenarios

**Nginx Proxy Routing:**
```bash
# Frontend accessible
curl -sf http://localhost/ -o /dev/null && echo "✅ Frontend" || echo "❌ Frontend"

# API routing
curl -sf http://localhost/api/v1/health && echo "✅ API proxy" || echo "❌ API proxy"

# Health endpoints
curl -sf http://localhost/nginx-health && echo "✅ Nginx health" || echo "❌ Nginx health"
```

**Security Headers:**
```bash
HEADERS=$(curl -sI http://localhost/)
echo "$HEADERS" | grep -qi "x-frame-options" && echo "✅ X-Frame-Options" || echo "❌ X-Frame-Options"
echo "$HEADERS" | grep -qi "x-content-type-options" && echo "✅ X-Content-Type" || echo "❌ X-Content-Type"
echo "$HEADERS" | grep -qi "content-security-policy" && echo "✅ CSP" || echo "❌ CSP"
```

**Rate Limiting:**
```bash
# Send burst of requests
BLOCKED=false
for i in $(seq 1 50); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/api/v1/health)
  if [ "$CODE" = "429" ]; then BLOCKED=true; break; fi
done
$BLOCKED && echo "✅ Rate limiting active" || echo "⚠️ Rate limiting not triggered"
```

### 3. Cleanup
```bash
docker compose down -v
```

## Quality Gates
- [ ] All services start and become healthy
- [ ] Frontend is accessible
- [ ] API proxying works
- [ ] Security headers present
- [ ] Rate limiting triggers under load
- [ ] WebSocket connection established
