---
mode: "agent"
description: "Update Nginx reverse proxy configuration for HomeySmartHome routing and security"
---

# Nginx Configuration

Update the Nginx reverse proxy at `nginx/nginx.conf`.

## Current Configuration
- Rate limiting: 30 req/s API, 60 req/s general
- Security headers: CSP, X-Frame-Options, X-XSS-Protection
- Gzip compression level 6
- WebSocket upgrade for Socket.IO
- Restricted `/metrics` endpoint (internal only)

## Adding a New Route
```nginx
# Proxy to backend service
location /api/v1/new-route {
    proxy_pass http://smarthomepro;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## WebSocket Route
```nginx
location /socket.io/ {
    proxy_pass http://dashboard;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
}
```

## Rate Limiting
```nginx
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=30r/s;
limit_req_zone $binary_remote_addr zone=general_limit:10m rate=60r/s;

location /api/ {
    limit_req zone=api_limit burst=20 nodelay;
    proxy_pass http://smarthomepro;
}
```

## Verification
```bash
# Test config syntax
docker compose exec nginx nginx -t

# Reload without downtime
docker compose exec nginx nginx -s reload

# Test routing
curl -v http://localhost/api/v1/health
curl -v http://localhost/health
```
