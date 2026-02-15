#!/usr/bin/env bash
set -euo pipefail

# Build, tag, and verify HomeySmartHome Docker images locally
# Usage: ./build-and-push-local.sh [version]

VERSION=${1:-$(node -p "require('./package.json').version" 2>/dev/null || echo "latest")}

echo "🐳 HomeySmartHome Docker Build & Tag"
echo "====================================="
echo "Version: $VERSION"
echo ""

# Build images
echo "━━━ Building images ━━━"
echo "Building backend..."
docker build -t smarthomepro:${VERSION} -t smarthomepro:latest ./homey-app
echo "  ✅ Backend image built"

echo "Building dashboard..."
docker build -t smarthome-dashboard:${VERSION} -t smarthome-dashboard:latest ./web-dashboard
echo "  ✅ Dashboard image built"

echo ""

# Image sizes
echo "━━━ Image sizes ━━━"
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | grep -E "smarthomepro|smarthome-dashboard"

echo ""

# Verify images
echo "━━━ Verifying images ━━━"

echo "Backend health check..."
CONTAINER_ID=$(docker run -d --rm -p 3099:3000 smarthomepro:${VERSION})
sleep 5
if curl -sf http://localhost:3099/health > /dev/null 2>&1; then
  echo "  ✅ Backend image healthy"
else
  echo "  ❌ Backend health check failed"
fi
docker stop "$CONTAINER_ID" > /dev/null 2>&1 || true

echo "Dashboard health check..."
CONTAINER_ID=$(docker run -d --rm -p 3098:3001 smarthome-dashboard:${VERSION})
sleep 5
if curl -sf http://localhost:3098/health > /dev/null 2>&1; then
  echo "  ✅ Dashboard image healthy"
else
  echo "  ❌ Dashboard health check failed"
fi
docker stop "$CONTAINER_ID" > /dev/null 2>&1 || true

echo ""

# Security check
echo "━━━ Security check ━━━"
echo "Backend runs as:"
docker run --rm smarthomepro:${VERSION} whoami 2>/dev/null || echo "  (could not determine user)"

echo ""
echo "====================================="
echo "✅ Images tagged as smarthomepro:${VERSION} and smarthome-dashboard:${VERSION}"
echo "Run 'docker compose up -d' to deploy."
