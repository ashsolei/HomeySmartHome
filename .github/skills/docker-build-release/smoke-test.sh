#!/usr/bin/env bash
set -euo pipefail

# Smoke test HomeySmartHome Docker deployment
# Usage: ./smoke-test.sh [timeout_seconds]

TIMEOUT=${1:-30}
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

echo "🔍 Docker Smoke Test"
echo ""

# Wait for services
echo "Waiting for services (max ${TIMEOUT}s)..."
for i in $(seq 1 $((TIMEOUT / 2))); do
  if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
    echo "  Services ready after $((i * 2))s"
    break
  fi
  sleep 2
done

echo ""
echo "Health:"
check "Backend" "http://localhost:3000/health"
check "Dashboard" "http://localhost:3001/health"
check "Nginx" "http://localhost/nginx-health"

echo ""
echo "Routing:"
check "API proxy" "http://localhost/api/v1/health"
check "Frontend" "http://localhost/"

echo ""
echo "Security:"
HEADERS=$(curl -sI http://localhost/ 2>/dev/null)
echo "$HEADERS" | grep -qi "x-content-type-options" && { echo "  ✅ Security headers present"; PASS=$((PASS + 1)); } || { echo "  ❌ Security headers missing"; FAIL=$((FAIL + 1)); }

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
