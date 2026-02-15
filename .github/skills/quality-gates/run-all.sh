#!/usr/bin/env bash
set -euo pipefail

# Run all HomeySmartHome quality gates
# Usage: ./run-all.sh [--skip-docker]

SKIP_DOCKER=false
if [ "${1:-}" = "--skip-docker" ]; then
  SKIP_DOCKER=true
fi

PASS=0
FAIL=0

gate() {
  local name=$1
  shift
  echo "━━━ $name ━━━"
  if "$@" 2>&1; then
    echo "  ✅ $name passed"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $name FAILED"
    FAIL=$((FAIL + 1))
  fi
  echo ""
}

echo "🔒 HomeySmartHome Quality Gates"
echo "================================"
echo ""

gate "Backend Lint" bash -c "cd homey-app && npm run lint"
gate "Dashboard Lint" bash -c "cd web-dashboard && npm run lint"
gate "Backend Tests" bash -c "cd homey-app && npm test"
gate "Dashboard Tests" bash -c "cd web-dashboard && npm test"
gate "Backend Security Audit" bash -c "cd homey-app && npm audit --audit-level=moderate"
gate "Dashboard Security Audit" bash -c "cd web-dashboard && npm audit --audit-level=moderate"

if [ "$SKIP_DOCKER" = false ]; then
  gate "Docker Build" docker compose build
fi

echo "================================"
echo "Results: $PASS passed, $FAIL failed"
echo ""

if [ "$FAIL" -eq 0 ]; then
  echo "✅ All quality gates passed!"
  exit 0
else
  echo "❌ $FAIL gate(s) failed — fix before merging or deploying"
  exit 1
fi
