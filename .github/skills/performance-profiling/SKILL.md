---
name: performance-profiling
description: "Profiles HomeySmartHome services using Node.js CPU/heap profiling, response time measurement, Docker resource monitoring, and Prometheus metrics analysis to identify and fix performance bottlenecks"
argument-hint: "[service: backend|dashboard|nginx|all] [area: cpu|memory|latency|startup]"
---

# Performance Profiling

Systematic performance profiling for HomeySmartHome services.

## Profiling Workflow

### 1. Establish Baseline Metrics

```bash
# Container resource usage
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"

# API response times
echo "Backend health:"
curl -w "  DNS: %{time_namelookup}s | Connect: %{time_connect}s | TTFB: %{time_starttransfer}s | Total: %{time_total}s\n" -so /dev/null http://localhost:3000/health

echo "Dashboard health:"
curl -w "  DNS: %{time_namelookup}s | Connect: %{time_connect}s | TTFB: %{time_starttransfer}s | Total: %{time_total}s\n" -so /dev/null http://localhost:3001/health

echo "Via Nginx:"
curl -w "  DNS: %{time_namelookup}s | Connect: %{time_connect}s | TTFB: %{time_starttransfer}s | Total: %{time_total}s\n" -so /dev/null http://localhost/health

# Memory from Prometheus
curl -s http://localhost:3000/metrics | grep memory
```

### 2. CPU Profiling

#### Using Node.js Built-in Profiler

```bash
# Generate a V8 CPU profile
node --prof homey-app/server.js &
# Send some traffic...
kill %1

# Process the profile
node --prof-process isolate-*.log > profile.txt
```

#### Using Chrome DevTools

```bash
# Start with inspector
node --inspect=0.0.0.0:9229 homey-app/server.js

# In Docker (dev)
docker compose -f docker-compose.dev.yml up -d
# Connect Chrome to chrome://inspect → port 9229
```

#### In-Code Timing

```javascript
// Add timing to critical paths
function withTiming(name, fn) {
  return async function (...args) {
    const start = performance.now();
    try {
      return await fn.apply(this, args);
    } finally {
      const duration = performance.now() - start;
      if (duration > 100) {
        console.log(`⚠️ ${name} took ${duration.toFixed(1)}ms`);
      }
    }
  };
}
```

### 3. Memory Profiling

#### Heap Snapshot

```javascript
// Add to server.js for development
if (process.env.NODE_ENV === 'development') {
  app.get('/debug/heap', (req, res) => {
    const used = process.memoryUsage();
    res.json({
      rss: `${Math.round(used.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)}MB`,
      external: `${Math.round(used.external / 1024 / 1024)}MB`,
      arrayBuffers: `${Math.round(used.arrayBuffers / 1024 / 1024)}MB`
    });
  });
}
```

#### Memory Leak Detection

```javascript
// Track heap growth over time
const snapshots = [];
setInterval(() => {
  const { heapUsed } = process.memoryUsage();
  snapshots.push({ time: Date.now(), heapUsed });
  if (snapshots.length > 60) snapshots.shift();

  // Alert if heap is growing steadily
  if (snapshots.length >= 10) {
    const first = snapshots[0].heapUsed;
    const last = snapshots[snapshots.length - 1].heapUsed;
    const growthMB = (last - first) / 1024 / 1024;
    if (growthMB > 50) {
      console.error(`⚠️ Possible memory leak: heap grew ${growthMB.toFixed(1)}MB`);
    }
  }
}, 60000);
```

### 4. Startup Time Profiling

```javascript
// Add to app.js to measure module load times
const moduleLoadTimes = [];

async function loadModule(ModuleClass, homey) {
  const name = ModuleClass.name;
  const start = performance.now();
  try {
    const mod = new ModuleClass(homey);
    await mod.initialize();
    const duration = performance.now() - start;
    moduleLoadTimes.push({ name, duration });
    if (duration > 1000) {
      console.log(`⚠️ ${name} took ${duration.toFixed(0)}ms to initialize`);
    }
    return mod;
  } catch (error) {
    const duration = performance.now() - start;
    moduleLoadTimes.push({ name, duration, error: error.message });
    console.error(`❌ ${name} failed after ${duration.toFixed(0)}ms`);
    return null;
  }
}

// After all modules loaded:
const totalTime = moduleLoadTimes.reduce((sum, m) => sum + m.duration, 0);
console.log(`📊 Total module load time: ${totalTime.toFixed(0)}ms`);
const slow = moduleLoadTimes.filter(m => m.duration > 500).sort((a, b) => b.duration - a.duration);
if (slow.length) {
  console.log('📊 Slow modules:', slow.map(m => `${m.name} (${m.duration.toFixed(0)}ms)`).join(', '));
}
```

### 5. Latency Profiling

```bash
# Measure multiple endpoints
ENDPOINTS=(
  "http://localhost:3000/health"
  "http://localhost:3000/ready"
  "http://localhost:3000/metrics"
  "http://localhost:3001/health"
  "http://localhost/health"
)

for url in "${ENDPOINTS[@]}"; do
  TIME=$(curl -w "%{time_total}" -so /dev/null "$url" 2>/dev/null)
  echo "$url → ${TIME}s"
done
```

### 6. Docker Resource Analysis

```bash
# Continuous monitoring (10 seconds)
docker stats --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" --no-stream

# Check resource limits vs actual
docker compose config | grep -A 5 "limits"
```

## Performance Targets

| Metric | Target | Action if Exceeded |
|--------|--------|--------------------|
| Health endpoint latency | < 50ms | Check middleware chain |
| API endpoint latency | < 200ms | Profile handler code |
| Module init (each) | < 2s | Lazy-load or optimize |
| Total startup | < 30s | Parallelize module loading |
| Heap memory (backend) | < 512MB | Profile allocations |
| Heap memory (dashboard) | < 128MB | Check Socket.IO state |

## Hard Rules

1. Never optimize without measuring first
2. Profile in conditions matching production (Docker, same resource limits)
3. Measure before AND after optimization
4. Run full test suite after any optimization
5. Document performance improvements in commit messages
6. Never sacrifice correctness for performance

## Checklist

- [ ] Baseline metrics recorded
- [ ] Bottleneck identified with evidence
- [ ] Optimization implemented minimally
- [ ] Before/after comparison shows improvement
- [ ] `npm run test:all` passes after optimization
- [ ] `docker compose build` succeeds
- [ ] No regressions in other endpoints
- [ ] Results documented
