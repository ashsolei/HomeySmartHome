#!/usr/bin/env bash
set -euo pipefail

# Run all HomeySmartHome tests
# Usage: ./run-tests.sh [backend|dashboard|all]

TARGET=${1:-all}

echo "🧪 Running HomeySmartHome tests..."
echo ""

BACKEND_PASS=true
DASHBOARD_PASS=true

if [ "$TARGET" = "backend" ] || [ "$TARGET" = "all" ]; then
  echo "📋 Backend tests..."
  if (cd homey-app && npm test); then
    echo "  ✅ Backend tests passed"
  else
    echo "  ❌ Backend tests failed"
    BACKEND_PASS=false
  fi
  echo ""
fi

if [ "$TARGET" = "dashboard" ] || [ "$TARGET" = "all" ]; then
  echo "📋 Dashboard tests..."
  if (cd web-dashboard && npm test); then
    echo "  ✅ Dashboard tests passed"
  else
    echo "  ❌ Dashboard tests failed"
    DASHBOARD_PASS=false
  fi
  echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$BACKEND_PASS" = true ] && [ "$DASHBOARD_PASS" = true ]; then
  echo "✅ All tests passed!"
  exit 0
else
  echo "❌ Some tests failed"
  exit 1
fi
