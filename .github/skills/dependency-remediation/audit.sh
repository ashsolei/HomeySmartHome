#!/usr/bin/env bash
set -euo pipefail

# Audit and report dependency status for HomeySmartHome
# Usage: ./audit.sh [--fix]

FIX=false
if [ "${1:-}" = "--fix" ]; then
  FIX=true
fi

echo "📦 HomeySmartHome Dependency Audit"
echo "===================================="
echo ""

echo "━━━ Backend (homey-app) ━━━"
echo ""
echo "Outdated packages:"
(cd homey-app && npm outdated 2>/dev/null) || true
echo ""
echo "Security audit:"
if (cd homey-app && npm audit --audit-level=moderate 2>&1); then
  echo "  ✅ No moderate+ vulnerabilities"
else
  echo "  ⚠️ Vulnerabilities found"
  if [ "$FIX" = true ]; then
    echo "  Attempting auto-fix..."
    (cd homey-app && npm audit fix)
  fi
fi

echo ""
echo "━━━ Dashboard (web-dashboard) ━━━"
echo ""
echo "Outdated packages:"
(cd web-dashboard && npm outdated 2>/dev/null) || true
echo ""
echo "Security audit:"
if (cd web-dashboard && npm audit --audit-level=moderate 2>&1); then
  echo "  ✅ No moderate+ vulnerabilities"
else
  echo "  ⚠️ Vulnerabilities found"
  if [ "$FIX" = true ]; then
    echo "  Attempting auto-fix..."
    (cd web-dashboard && npm audit fix)
  fi
fi

echo ""
echo "===================================="
echo "Done. Run with --fix to auto-remediate safe updates."
