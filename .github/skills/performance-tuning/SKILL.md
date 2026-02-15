---
name: performance-tuning
description: "Optimizes HomeySmartHome service performance including Node.js memory profiling, Express middleware optimization, Socket.IO payload tuning, Docker resource sizing, and Nginx proxy configuration"
argument-hint: "[service: backend|dashboard|nginx|all]"
---

# Performance Tuning

Systematic performance optimization for HomeySmartHome services.

## Performance Baseline

### Measure Current State

```bash
# Container resource usage
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"

# Response times
curl -w "\nDNS: %{time_namelookup}s\nConnect: %{time_connect}s\nTTFB: %{time_starttransfer}s\nTotal: %{time_total}s\n" http://localhost:3000/health
curl -w "\nTotal: %{time_total}s\n" http://localhost:3001/health
curl -w "\nTotal: %{time_total}s\n" http://localhost/health

# Prometheus metrics
curl -s http://localhost:3000/metrics
```

### Target Metrics

| Metric | Target | Current Limit |
|--------|--------|---------------|
| Backend memory | < 512MB | 768MB |
| Dashboard memory | < 128MB | 256MB |
| Health endpoint latency | < 50ms | - |
| API endpoint latency | < 200ms | - |
| Module init time | < 5s total | - |
| Socket.IO message | < 1KB | - |

## Optimization Areas

### 1. Module Loading (homey-app/app.js)

Currently loads 114 modules synchronously at startup.

**Optimizations:**
- Lazy initialization: Load modules on first access
- Parallel initialization: Use `Promise.all()` for independent modules
- Conditional loading: Skip disabled modules based on config

```javascript
// Before: Sequential loading
for (const ModuleClass of modules) {
  const mod = new ModuleClass(this.homey);
  await mod.initialize();
}

// After: Parallel loading
const initializations = modules.map(async (ModuleClass) => {
  try {
    const mod = new ModuleClass(this.homey);
    await mod.initialize();
    return mod;
  } catch (error) {
    console.error(`❌ ${ModuleClass.name} failed:`, error.message);
    return null;
  }
});
await Promise.allSettled(initializations);
```

### 2. Express Middleware (homey-app/server.js)

**Optimizations:**
- Order middleware by frequency (fast checks first)
- Use static file caching headers
- Enable response compression
- Skip unnecessary middleware for health checks

```javascript
// Health check bypasses middleware
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Then apply middleware for other routes
app.use(helmet());
app.use(compression());
app.use(rateLimit(config));
```

### 3. Socket.IO (web-dashboard/server.js)

**Optimizations:**
- Use rooms for targeted broadcasts (not global emit)
- Compress payloads: `{ perMessageDeflate: true }`
- Send deltas, not full state
- Batch rapid updates with debounce

```javascript
const io = new Server(httpServer, {
  perMessageDeflate: true,
  maxHttpBufferSize: 1e6,  // 1MB max message
  pingTimeout: 20000,
  pingInterval: 25000
});
```

### 4. Docker Resources (docker-compose.yml)

**Right-sizing process:**
1. Run services under normal load
2. Monitor with `docker stats` for 24 hours
3. Set limits at 2x average usage
4. Set requests at average usage

### 5. Nginx (nginx/nginx.conf)

**Optimizations:**
```nginx
# Connection tuning
worker_connections 1024;
keepalive_timeout 65;
keepalive_requests 100;

# Buffer tuning
proxy_buffer_size 4k;
proxy_buffers 8 4k;
proxy_busy_buffers_size 8k;

# Gzip optimization
gzip on;
gzip_comp_level 6;      # Good balance of CPU vs compression
gzip_min_length 256;    # Don't compress tiny responses
gzip_vary on;
gzip_types text/plain text/css application/json application/javascript;

# Static file caching
location ~* \.(js|css|png|jpg|svg|ico)$ {
    expires 7d;
    add_header Cache-Control "public, immutable";
}
```

## Profiling Tools

```bash
# Node.js heap snapshot
node --inspect homey-app/server.js
# Connect Chrome DevTools to chrome://inspect

# CPU profile
node --prof homey-app/server.js
# Process: node --prof-process isolate-*.log

# Memory tracking in code
const used = process.memoryUsage();
console.log(`RSS: ${Math.round(used.rss / 1024 / 1024)}MB`);
console.log(`Heap: ${Math.round(used.heapUsed / 1024 / 1024)}MB`);
```

## Verification Checklist

1. [ ] All health endpoints respond in < 50ms
2. [ ] Memory usage within resource limits
3. [ ] No memory leaks over 24-hour period
4. [ ] All tests pass: `npm run test:all`
5. [ ] Docker health checks passing
6. [ ] Prometheus metrics showing improvement
7. [ ] No increased error rates
