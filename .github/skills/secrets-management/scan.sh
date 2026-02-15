#!/usr/bin/env bash
set -euo pipefail

# Scan HomeySmartHome source code for potential secrets
# Usage: ./scan.sh

echo "🔐 Secrets Scan — HomeySmartHome"
echo "=================================="
echo ""

FOUND=0

scan_pattern() {
  local desc=$1 pattern=$2
  MATCHES=$(grep -rn --include="*.js" --include="*.json" --include="*.yml" --include="*.yaml" \
    -E "$pattern" \
    homey-app/ web-dashboard/ docker-compose*.yml nginx/ .github/workflows/ 2>/dev/null \
    | grep -v "node_modules" \
    | grep -v ".env.example" \
    | grep -v "package-lock.json" \
    | grep -v "SKILL.md" \
    | grep -v ".prompt.md" \
    | grep -v "copilot" || true)

  if [ -n "$MATCHES" ]; then
    echo "  ⚠️  $desc"
    echo "$MATCHES" | head -5 | sed 's/^/    /'
    FOUND=$((FOUND + 1))
  else
    echo "  ✅ $desc — clean"
  fi
}

echo "Scanning for hardcoded secrets..."
scan_pattern "Passwords/tokens" "(password|passwd|secret|token|api_key|apikey)\\s*[:=]\\s*['\"][^'\"]{8,}"
scan_pattern "Private keys" "-----BEGIN.*(PRIVATE KEY|RSA)"
scan_pattern "URLs with credentials" "https?://[^:]+:[^@]+@"
scan_pattern "Bearer tokens" "Bearer [A-Za-z0-9\-._~+/]{20,}"

echo ""
echo "Checking .gitignore..."
if grep -q "^\.env$" .gitignore 2>/dev/null; then
  echo "  ✅ .env is in .gitignore"
else
  echo "  ❌ .env is NOT in .gitignore"
  FOUND=$((FOUND + 1))
fi

echo ""
echo "=================================="
if [ "$FOUND" -eq 0 ]; then
  echo "✅ No secrets detected"
  exit 0
else
  echo "⚠️  $FOUND potential issue(s) found — review above"
  exit 1
fi
