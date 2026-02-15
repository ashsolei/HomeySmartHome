---
mode: "agent"
description: "Identify and fix performance bottlenecks in HomeySmartHome services"
---

# Performance Optimization

Systematically identify and fix performance bottlenecks in HomeySmartHome.

## Step 1: Profile Current State
1. Check Docker resource usage: `docker stats --no-stream`
2. Check response times: `curl -w "%{time_total}s\n" http://localhost:3000/health`
3. Review Prometheus metrics: `curl http://localhost:3000/metrics`
4. Count module load time in `homey-app/app.js`

## Step 2: Identify Bottlenecks
- **Startup time:** 114 modules loading synchronously in `app.js`
- **Memory:** Large objects held in module state
- **API latency:** Middleware chain, synchronous operations in routes
- **Socket.IO:** Large broadcast payloads, too-frequent updates
- **Nginx:** Compression settings, buffer sizes, connection limits

## Step 3: Common Optimizations
1. **Lazy module loading** — Only initialize modules when first accessed
2. **Response caching** — Cache static API responses with TTL
3. **Payload optimization** — Only send changed data via Socket.IO
4. **Connection pooling** — Reuse connections for external services
5. **Compression tuning** — Optimize Nginx gzip level (currently 6)
6. **Resource right-sizing** — Adjust Docker memory/CPU limits

## Step 4: Verify Improvements
1. Measure before and after metrics
2. Run `npm run test:all` — no regressions
3. Check health endpoints respond under load
4. Verify Docker resource usage is within limits
