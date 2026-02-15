---
mode: "agent"
description: "Run quick smoke tests to verify HomeySmartHome services are functional after deployment"
---

# Smoke Test

Quick functional verification of all HomeySmartHome services.

## Automated Smoke Test

```bash
#!/usr/bin/env bash
set -euo pipefail

PASS=0
FAIL=0

check() {
  local name=$1 url=$2 expected=${3:-200}
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
  if [ "$CODE" = "$expected" ]; then
    echo "  ✅ $name ($CODE)"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $name (expected $expected, got $CODE)"
    FAIL=$((FAIL + 1))
  fi
}

echo "🔍 HomeySmartHome Smoke Test"
echo ""

echo "Health Checks:"
check "Backend health" "http://localhost:3000/health"
check "Dashboard health" "http://localhost:3001/health"
check "Nginx health" "http://localhost/nginx-health"

echo ""
echo "API Routes:"
check "Backend via Nginx" "http://localhost/api/v1/health"
check "Backend readiness" "http://localhost:3000/ready"

echo ""
echo "Security:"
check "Metrics restricted" "http://localhost/metrics" "403"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] && echo "✅ All smoke tests passed" || echo "❌ Some tests failed"
```

## Manual Verification

1. Open `http://localhost` in a browser — dashboard loads
2. Open browser DevTools → Network → verify WebSocket connection
3. Check response headers for Helmet security headers
4. Verify Prometheus metrics at `http://localhost:3000/metrics`

## When to Run

- After every deployment (`./deploy.sh start`)
- After Docker Compose restarts
- After Nginx configuration changes
- Before tagging a release
