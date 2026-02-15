---
name: nginx-routing
description: "Configures Nginx reverse proxy for HomeySmartHome including routing rules, rate limiting zones, security headers, WebSocket proxying, SSL/TLS setup, and static file caching"
argument-hint: "[route-path] [upstream-service]"
---

# Nginx Routing

Configures the Nginx reverse proxy for HomeySmartHome.

## Current Architecture

```
Internet → Nginx (port 80)
  ├── /api/*            → smarthomepro (backend:3000)
  ├── /socket.io/*      → dashboard (dashboard:3001)
  ├── /api/modules      → dashboard
  ├── /api/dashboard    → dashboard
  ├── /metrics          → smarthomepro (internal only)
  ├── /nginx-health     → local (stub_status)
  └── /*                → dashboard (default)
```

## Configuration File: `nginx/nginx.conf`

### Adding a New Route

```nginx
# Proxy to backend
location /api/v1/new-feature {
    limit_req zone=api_limit burst=20 nodelay;
    proxy_pass http://smarthomepro;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# Proxy to dashboard
location /dashboard/new-feature {
    limit_req zone=general_limit burst=40 nodelay;
    proxy_pass http://dashboard;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

### Rate Limiting

```nginx
# Define zones (in http block)
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=30r/s;
limit_req_zone $binary_remote_addr zone=general_limit:10m rate=60r/s;
limit_req_zone $binary_remote_addr zone=strict_limit:10m rate=5r/s;

# Apply to locations
location /api/ {
    limit_req zone=api_limit burst=20 nodelay;
    limit_req_status 429;
}
```

### Security Headers

```nginx
# Already configured — verify these are present
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'" always;
```

### WebSocket Proxy

```nginx
location /socket.io/ {
    proxy_pass http://dashboard;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_read_timeout 86400;  # 24h for long-lived connections
}
```

### Static File Caching

```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?)$ {
    proxy_pass http://dashboard;
    expires 7d;
    add_header Cache-Control "public, immutable";
}
```

### Restrict Internal Endpoints

```nginx
location /metrics {
    # Only allow internal access
    allow 172.16.0.0/12;    # Docker network
    allow 10.0.0.0/8;       # Private network
    allow 127.0.0.1;        # Localhost
    deny all;
    proxy_pass http://smarthomepro;
}
```

## Testing Configuration

```bash
# Syntax check
docker compose exec nginx nginx -t

# Reload without downtime
docker compose exec nginx nginx -s reload

# Test routes
curl -v http://localhost/health
curl -v http://localhost/api/v1/devices
curl -v http://localhost/nginx-health

# Test rate limiting
for i in $(seq 1 50); do curl -s -o /dev/null -w "%{http_code}\n" http://localhost/api/v1/health; done

# Check headers
curl -I http://localhost/
```

## Upstream Configuration

```nginx
upstream smarthomepro {
    server smarthomepro:3000;
    keepalive 32;
}

upstream dashboard {
    server dashboard:3001;
    keepalive 32;
}
```

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| 502 Bad Gateway | Upstream not running | Check `docker compose ps` |
| WebSocket drops | Missing upgrade headers | Add `proxy_http_version 1.1` + upgrade headers |
| 429 Too Many Requests | Rate limit hit | Increase burst or rate |
| Static files not cached | Missing cache headers | Add `expires` directive |
| CORS errors | Missing CORS headers | Add `Access-Control-*` headers or use app-level CORS |
