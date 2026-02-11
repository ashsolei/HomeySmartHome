#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────
# Smart Home Pro — Autonomous Local Docker Deployment
# Usage: ./deploy.sh [command]
#
# Commands:
#   start     Build and start all services (default)
#   stop      Stop all services
#   restart   Restart all services
#   status    Show service status and health
#   logs      Follow all logs
#   test      Run test suites inside containers
#   clean     Stop and remove all containers, volumes, images
#   help      Show this help
# ──────────────────────────────────────────────────────────

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

COMPOSE_FILE="docker-compose.yml"
PROJECT_NAME="smarthomepro"

log()  { echo -e "${BLUE}[deploy]${NC} $*"; }
ok()   { echo -e "${GREEN}  ✔${NC} $*"; }
warn() { echo -e "${YELLOW}  ⚠${NC} $*"; }
err()  { echo -e "${RED}  ✗${NC} $*"; }

banner() {
  echo ""
  echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║   🏠 Smart Home Pro — Docker Deployment      ║${NC}"
  echo -e "${CYAN}║   Version: 3.2.0                             ║${NC}"
  echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
  echo ""
}

# Ensure we're in the project root
cd "$(dirname "$0")"

check_prereqs() {
  log "Checking prerequisites…"

  if ! command -v docker &>/dev/null; then
    err "Docker is not installed. Install from https://docs.docker.com/get-docker/"
    exit 1
  fi
  ok "Docker found: $(docker --version | head -1)"

  if ! docker compose version &>/dev/null; then
    err "Docker Compose V2 is required. Update Docker Desktop or install docker-compose-plugin."
    exit 1
  fi
  ok "Docker Compose found: $(docker compose version --short)"

  if ! docker info &>/dev/null 2>&1; then
    err "Docker daemon is not running. Start Docker Desktop or dockerd."
    exit 1
  fi
  ok "Docker daemon is running"
}

setup_env() {
  if [ ! -f .env ]; then
    log "Creating .env from .env.example…"
    cp .env.example .env
    ok ".env created — edit it to customize settings"
  else
    ok ".env already exists"
  fi
}

cmd_start() {
  banner
  check_prereqs
  setup_env

  log "Building and starting all services…"
  docker compose -f "$COMPOSE_FILE" up -d --build

  log "Waiting for services to become healthy…"
  local max_wait=180
  local waited=0
  local interval=5

  while [ $waited -lt $max_wait ]; do
    local healthy
    healthy=$(docker compose -f "$COMPOSE_FILE" ps --format json 2>/dev/null \
      | grep -c '"healthy"' || true)

    if [ "$healthy" -ge 3 ] 2>/dev/null; then
      echo ""
      ok "All 3 services are healthy!"
      break
    fi

    printf "\r  ⏳ Waiting… %ds / %ds (healthy: %s/3)" "$waited" "$max_wait" "$healthy"
    sleep $interval
    waited=$((waited + interval))
  done

  if [ $waited -ge $max_wait ]; then
    echo ""
    warn "Some services may not be healthy yet. Check with: ./deploy.sh status"
  fi

  echo ""
  log "Deployment complete!"
  echo ""
  echo -e "  ${GREEN}Dashboard:${NC}  http://localhost:${NGINX_PORT:-80}"
  echo -e "  ${GREEN}API:${NC}        http://localhost:${NGINX_PORT:-80}/api/dashboard"
  echo -e "  ${GREEN}Health:${NC}     http://localhost:${NGINX_PORT:-80}/api/health"
  echo -e "  ${GREEN}Logs:${NC}       ./deploy.sh logs"
  echo ""
}

cmd_stop() {
  log "Stopping all services…"
  docker compose -f "$COMPOSE_FILE" down
  ok "All services stopped"
}

cmd_restart() {
  log "Restarting all services…"
  docker compose -f "$COMPOSE_FILE" down
  cmd_start
}

cmd_status() {
  banner
  log "Service status:"
  echo ""
  docker compose -f "$COMPOSE_FILE" ps --format "table {{.Name}}\t{{.State}}\t{{.Status}}\t{{.Ports}}"
  echo ""

  # Health check via curl if services are running
  if docker compose -f "$COMPOSE_FILE" ps --format json 2>/dev/null | grep -q '"running"'; then
    log "Health checks:"

    local backend_health
    backend_health=$(docker compose exec -T smarthomepro wget -qO- http://localhost:3000/health 2>/dev/null || echo '{"status":"unreachable"}')
    local backend_systems
    backend_systems=$(echo "$backend_health" | grep -o '"systemCount":[0-9]*' | cut -d: -f2 || echo "?")
    ok "Backend: $(echo "$backend_health" | grep -o '"status":"[^"]*"' | head -1) — ${backend_systems} systems"

    local dashboard_health
    dashboard_health=$(docker compose exec -T dashboard wget -qO- http://localhost:3001/health 2>/dev/null || echo '{"status":"unreachable"}')
    local dash_modules
    dash_modules=$(echo "$dashboard_health" | grep -o '"ready":[0-9]*' | cut -d: -f2 || echo "?")
    ok "Dashboard: $(echo "$dashboard_health" | grep -o '"status":"[^"]*"' | head -1) — ${dash_modules} modules"

    local nginx_health
    nginx_health=$(docker compose exec -T nginx wget -qO- http://localhost/nginx-health 2>/dev/null || echo "unreachable")
    ok "Nginx: $nginx_health"
  fi
  echo ""
}

cmd_logs() {
  docker compose -f "$COMPOSE_FILE" logs -f --tail=100
}

cmd_test() {
  banner
  log "Running test suites…"
  echo ""

  log "Backend tests (homey-app):"
  docker compose exec -T smarthomepro node test-suite.js 2>&1 || true
  echo ""

  log "Dashboard tests (web-dashboard):"
  docker compose exec -T dashboard node test-suite.js 2>&1 || true
  echo ""
}

cmd_clean() {
  log "Stopping and removing all containers, volumes, and images…"
  docker compose -f "$COMPOSE_FILE" down -v --rmi local
  ok "Cleanup complete"
}

cmd_help() {
  banner
  echo "Usage: ./deploy.sh [command]"
  echo ""
  echo "Commands:"
  echo "  start     Build and start all services (default)"
  echo "  stop      Stop all services"
  echo "  restart   Rebuild and restart all services"
  echo "  status    Show service status and health"
  echo "  logs      Follow all logs"
  echo "  test      Run test suites inside containers"
  echo "  clean     Stop and remove everything (containers, volumes, images)"
  echo "  help      Show this help"
  echo ""
}

# Main
case "${1:-start}" in
  start)   cmd_start  ;;
  stop)    cmd_stop   ;;
  restart) cmd_restart ;;
  status)  cmd_status  ;;
  logs)    cmd_logs    ;;
  test)    cmd_test    ;;
  clean)   cmd_clean   ;;
  help|-h|--help) cmd_help ;;
  *)
    err "Unknown command: $1"
    cmd_help
    exit 1
    ;;
esac
