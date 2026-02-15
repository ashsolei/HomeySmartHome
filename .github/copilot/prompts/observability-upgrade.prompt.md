---
mode: "agent"
description: "Improve logging, metrics, tracing, and health checks across HomeySmartHome services"
---

# Observability Upgrade

Systematically improve observability across all HomeySmartHome services.

## Step 1: Audit Current State

### Metrics
```bash
curl http://localhost:3000/metrics    # Check what's exposed
```

### Health Checks
```bash
curl http://localhost:3000/health     # Backend
curl http://localhost:3001/health     # Dashboard
curl http://localhost/nginx-health    # Nginx
```

### Logging
- Search for `console.log` patterns in both services
- Verify emoji prefix convention is consistent

## Step 2: Add Missing Metrics

Common metrics to add to `/metrics` endpoint:
- `smarthomepro_api_requests_total{method,path,status}` — Request counter
- `smarthomepro_api_duration_seconds{method,path}` — Response time
- `smarthomepro_socketio_connections` — Active WebSocket connections
- `smarthomepro_module_init_success_total` — Module initialization counter
- `smarthomepro_module_init_failure_total` — Failed initializations

## Step 3: Improve Health Checks

```javascript
app.get('/health', (req, res) => {
  const health = {
    status: 'ok',
    uptime: process.uptime(),
    memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    timestamp: new Date().toISOString()
  };
  res.json(health);
});

app.get('/ready', (req, res) => {
  const ready = modulesInitialized && dbConnected;
  res.status(ready ? 200 : 503).json({ ready });
});
```

## Step 4: Standardize Logging

```javascript
function log(level, module, message, data = {}) {
  const prefix = { info: '✅', error: '❌', warn: '⚠️' }[level] || 'ℹ️';
  console[level === 'error' ? 'error' : 'log'](
    `${prefix} [${module}] ${message}`, data
  );
}
```

## Quality Gates
- [ ] All metrics endpoints return valid Prometheus text format
- [ ] All health endpoints return JSON with consistent schema
- [ ] Logging uses consistent emoji prefixes
- [ ] No sensitive data in logs or metrics
