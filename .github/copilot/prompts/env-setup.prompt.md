---
mode: "agent"
description: "Configure environment variables and .env files for HomeySmartHome"
---

# Environment Configuration

Set up environment variables for HomeySmartHome development and production.

## .env Template (from .env.example)
```env
# Timezone & Location
TZ=Europe/Stockholm
LATITUDE=59.3293
LONGITUDE=18.0686

# Logging
LOG_LEVEL=info

# Authentication
HOMEY_TOKEN=

# Ports (override defaults)
# BACKEND_PORT=3000
# DASHBOARD_PORT=3001
# NGINX_PORT=80

# Monitoring
GRAFANA_PASSWORD=changeme

# CORS (comma-separated origins)
# CORS_ORIGINS=http://localhost:3001,http://localhost

# Feature Flags
# ENABLE_REDIS=false
# ENABLE_PROMETHEUS=true
```

## Usage in Code
```javascript
require('dotenv').config();
const port = process.env.BACKEND_PORT || 3000;
const logLevel = process.env.LOG_LEVEL || 'info';
```

## Environment Hierarchy
1. `.env` — Local overrides (gitignored)
2. `.env.example` — Template checked into git
3. `docker-compose.yml` → `environment:` section
4. Code defaults (fallback values)

## Rules
- NEVER commit `.env` files with real secrets
- Always provide defaults in code for non-sensitive values
- Document new variables in `.env.example`
- Use `UPPER_SNAKE_CASE` for all environment variable names
- Prefix project-specific vars where appropriate
