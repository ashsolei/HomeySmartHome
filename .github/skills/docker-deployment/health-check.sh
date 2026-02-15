#!/usr/bin/env bash
set -euo pipefail

# Health check script for HomeySmartHome Docker deployment
# Usage: ./health-check.sh [timeout_seconds]

TIMEOUT=${1:-60}
INTERVAL=2
ELAPSED=0

echo "🏥 Checking HomeySmartHome service health..."

check_service() {
  local name=$1
  local url=$2
  if curl -sf "$url" > /dev/null 2>&1; then
    echo "  ✅ $name is healthy"
    return 0
  else
    echo "  ⏳ $name not ready yet"
    return 1
  fi
}

while [ $ELAPSED -lt $TIMEOUT ]; do
  BACKEND_OK=true
  DASHBOARD_OK=true
  NGINX_OK=true

  check_service "Backend" "http://localhost:3000/health" || BACKEND_OK=false
  check_service "Dashboard" "http://localhost:3001/health" || DASHBOARD_OK=false
  check_service "Nginx" "http://localhost/nginx-health" || NGINX_OK=false

  if [ "$BACKEND_OK" = true ] && [ "$DASHBOARD_OK" = true ] && [ "$NGINX_OK" = true ]; then
    echo ""
    echo "✅ All services are healthy!"
    exit 0
  fi

  sleep $INTERVAL
  ELAPSED=$((ELAPSED + INTERVAL))
done

echo ""
echo "❌ Health check timed out after ${TIMEOUT}s"
echo "Dumping recent logs:"
docker compose logs --tail 20
exit 1
