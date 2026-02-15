---
name: observability-basics
description: "Implements core observability for HomeySmartHome including Prometheus metric instrumentation, structured logging, health check endpoints, Grafana dashboard creation, and operational runbooks"
argument-hint: "[area: metrics|logging|health|dashboards]"
---

# Observability Basics

## Overview

HomeySmartHome runs 179 modules across two services: backend (Express 5.1.0 on port 3000) and dashboard (Socket.IO 4.8.1 on port 3001) behind Nginx on port 80. Observability requires Prometheus metrics, structured JSON logging, health check endpoints, Grafana dashboards, and runbooks for operational response. The backend already exposes a `/metrics` endpoint in Prometheus text format.

## Step-by-Step Workflow

### Step 1: Prometheus Metric Instrumentation

Define and expose application metrics from the backend service.

```js
// homey-app/lib/metrics.js
const os = require('os');

class MetricsRegistry {
  constructor() {
    this.counters = {};
    this.gauges = {};
    this.histograms = {};
    this.startTime = Date.now();
  }

  counter(name, help) {
    if (!this.counters[name]) {
      this.counters[name] = { help, value: 0, labels: {} };
    }
    return {
      inc: (labels = {}, value = 1) => {
        const key = JSON.stringify(labels);
        if (!this.counters[name].labels[key]) {
          this.counters[name].labels[key] = { labels, value: 0 };
        }
        this.counters[name].labels[key].value += value;
        this.counters[name].value += value;
      },
    };
  }

  gauge(name, help) {
    if (!this.gauges[name]) {
      this.gauges[name] = { help, value: 0 };
    }
    return {
      set: (value) => { this.gauges[name].value = value; },
      inc: (value = 1) => { this.gauges[name].value += value; },
      dec: (value = 1) => { this.gauges[name].value -= value; },
    };
  }

  histogram(name, help, buckets) {
    if (!this.histograms[name]) {
      this.histograms[name] = {
        help,
        buckets: buckets || [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
        observations: [],
      };
    }
    return {
      observe: (value) => {
        this.histograms[name].observations.push(value);
      },
    };
  }

  toPrometheusText() {
    const lines = [];
    lines.push(`# HELP homey_uptime_seconds Time since server start`);
    lines.push(`# TYPE homey_uptime_seconds gauge`);
    lines.push(`homey_uptime_seconds ${(Date.now() - this.startTime) / 1000}`);

    for (const [name, data] of Object.entries(this.counters)) {
      lines.push(`# HELP ${name} ${data.help}`);
      lines.push(`# TYPE ${name} counter`);
      for (const entry of Object.values(data.labels)) {
        const labelStr = Object.entries(entry.labels)
          .map(([k, v]) => `${k}="${v}"`).join(',');
        lines.push(`${name}{${labelStr}} ${entry.value}`);
      }
      if (Object.keys(data.labels).length === 0) {
        lines.push(`${name} ${data.value}`);
      }
    }

    for (const [name, data] of Object.entries(this.gauges)) {
      lines.push(`# HELP ${name} ${data.help}`);
      lines.push(`# TYPE ${name} gauge`);
      lines.push(`${name} ${data.value}`);
    }

    for (const [name, data] of Object.entries(this.histograms)) {
      lines.push(`# HELP ${name} ${data.help}`);
      lines.push(`# TYPE ${name} histogram`);
      const sum = data.observations.reduce((a, b) => a + b, 0);
      const count = data.observations.length;
      for (const bucket of data.buckets) {
        const le = data.observations.filter((v) => v <= bucket).length;
        lines.push(`${name}_bucket{le="${bucket}"} ${le}`);
      }
      lines.push(`${name}_bucket{le="+Inf"} ${count}`);
      lines.push(`${name}_sum ${sum}`);
      lines.push(`${name}_count ${count}`);
    }

    return lines.join('\n') + '\n';
  }
}

const registry = new MetricsRegistry();

const httpRequestsTotal = registry.counter(
  'homey_http_requests_total', 'Total HTTP requests'
);
const httpRequestDuration = registry.histogram(
  'homey_http_request_duration_seconds', 'HTTP request duration in seconds'
);
const activeConnections = registry.gauge(
  'homey_active_connections', 'Number of active connections'
);
const moduleCount = registry.gauge(
  'homey_modules_loaded', 'Number of loaded modules'
);
const memoryUsage = registry.gauge(
  'homey_memory_usage_bytes', 'Process memory usage in bytes'
);

module.exports = {
  registry,
  httpRequestsTotal,
  httpRequestDuration,
  activeConnections,
  moduleCount,
  memoryUsage,
};
```

### Step 2: Metrics Middleware

Instrument every HTTP request automatically.

```js
// homey-app/middleware/metricsMiddleware.js
const { httpRequestsTotal, httpRequestDuration } = require('../lib/metrics');

function metricsMiddleware(req, res, next) {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationNs = Number(process.hrtime.bigint() - start);
    const durationSec = durationNs / 1e9;

    httpRequestsTotal.inc({
      method: req.method,
      path: req.route ? req.route.path : req.path,
      status: res.statusCode.toString(),
    });

    httpRequestDuration.observe(durationSec);
  });

  next();
}

module.exports = { metricsMiddleware };
```

### Step 3: Metrics Endpoint

Expose the `/metrics` endpoint for Prometheus scraping.

```js
// homey-app/routes/metrics.js
const express = require('express');
const router = express.Router();
const { registry, memoryUsage } = require('../lib/metrics');

router.get('/metrics', (req, res) => {
  // Update dynamic gauges before serving
  const mem = process.memoryUsage();
  memoryUsage.set(mem.rss);

  res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(registry.toPrometheusText());
});

module.exports = router;
```

### Step 4: Structured Logging

Replace console.log with structured JSON logging.

```js
// homey-app/lib/logger.js

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL || 'info'];

function createLogger(component) {
  function formatMessage(level, message, meta = {}) {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      component,
      message,
      ...meta,
      pid: process.pid,
      hostname: require('os').hostname(),
    });
  }

  return {
    error(message, meta) {
      if (currentLevel >= LOG_LEVELS.error) {
        process.stderr.write(formatMessage('error', message, meta) + '\n');
      }
    },
    warn(message, meta) {
      if (currentLevel >= LOG_LEVELS.warn) {
        process.stderr.write(formatMessage('warn', message, meta) + '\n');
      }
    },
    info(message, meta) {
      if (currentLevel >= LOG_LEVELS.info) {
        process.stdout.write(formatMessage('info', message, meta) + '\n');
      }
    },
    debug(message, meta) {
      if (currentLevel >= LOG_LEVELS.debug) {
        process.stdout.write(formatMessage('debug', message, meta) + '\n');
      }
    },
  };
}

module.exports = { createLogger, LOG_LEVELS };
```

Request logging middleware:

```js
// homey-app/middleware/requestLogger.js
const { createLogger } = require('../lib/logger');
const logger = createLogger('http');

function requestLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('request completed', {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: duration,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      contentLength: res.get('content-length'),
    });
  });

  next();
}

module.exports = { requestLogger };
```

### Step 5: Health Check Endpoints

Implement comprehensive health checks for all services.

```js
// homey-app/routes/health.js
const express = require('express');
const router = express.Router();
const os = require('os');

function checkMemory() {
  const used = process.memoryUsage();
  const totalSystem = os.totalmem();
  const freeSystem = os.freemem();
  return {
    rssBytes: used.rss,
    heapUsedBytes: used.heapUsed,
    heapTotalBytes: used.heapTotal,
    systemFreeBytes: freeSystem,
    systemTotalBytes: totalSystem,
    healthy: used.rss < 512 * 1024 * 1024,
  };
}

function checkUptime() {
  return {
    processUptimeSeconds: process.uptime(),
    systemUptimeSeconds: os.uptime(),
    healthy: process.uptime() > 0,
  };
}

// Liveness probe: is the process running
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Readiness probe: can the service handle traffic
router.get('/health/ready', (req, res) => {
  const memory = checkMemory();
  const uptime = checkUptime();
  const ready = memory.healthy && uptime.healthy;

  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    checks: { memory, uptime },
    timestamp: new Date().toISOString(),
  });
});

// Detailed health for operators
router.get('/health/detailed', (req, res) => {
  const memory = checkMemory();
  const uptime = checkUptime();
  const nodeVersion = process.version;
  const loadAvg = os.loadavg();

  res.status(200).json({
    status: 'ok',
    version: require('../../package.json').version,
    node: nodeVersion,
    memory,
    uptime,
    loadAverage: { '1m': loadAvg[0], '5m': loadAvg[1], '15m': loadAvg[2] },
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
```

### Step 6: Prometheus Scrape Configuration

Configure Prometheus to scrape HomeySmartHome services.

```js
// scripts/generatePrometheusConfig.js
const fs = require('fs');

const prometheusConfig = `
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'homey-backend'
    static_configs:
      - targets: ['backend:3000']
    metrics_path: '/metrics'
    scrape_interval: 10s

  - job_name: 'homey-dashboard'
    static_configs:
      - targets: ['dashboard:3001']
    metrics_path: '/metrics'
    scrape_interval: 15s

  - job_name: 'nginx'
    static_configs:
      - targets: ['nginx:80']
    metrics_path: '/stub_status'
    scrape_interval: 15s
`.trim();

fs.writeFileSync('prometheus/prometheus.yml', prometheusConfig);
console.log('Prometheus config generated');
```

### Step 7: Grafana Dashboard Definition

Create a Grafana dashboard for HomeySmartHome monitoring.

```js
// scripts/generateGrafanaDashboard.js
const fs = require('fs');

const dashboard = {
  title: 'HomeySmartHome Overview',
  uid: 'homey-overview',
  panels: [
    {
      id: 1,
      title: 'Request Rate',
      type: 'timeseries',
      targets: [{ expr: 'rate(homey_http_requests_total[5m])', legendFormat: '{{method}} {{path}}' }],
      gridPos: { x: 0, y: 0, w: 12, h: 8 },
    },
    {
      id: 2,
      title: 'Request Duration (p95)',
      type: 'timeseries',
      targets: [{ expr: 'histogram_quantile(0.95, rate(homey_http_request_duration_seconds_bucket[5m]))', legendFormat: 'p95' }],
      gridPos: { x: 12, y: 0, w: 12, h: 8 },
    },
    {
      id: 3,
      title: 'Memory Usage',
      type: 'timeseries',
      targets: [{ expr: 'homey_memory_usage_bytes', legendFormat: 'RSS' }],
      gridPos: { x: 0, y: 8, w: 12, h: 8 },
    },
    {
      id: 4,
      title: 'Active Connections',
      type: 'stat',
      targets: [{ expr: 'homey_active_connections', legendFormat: 'connections' }],
      gridPos: { x: 12, y: 8, w: 6, h: 8 },
    },
    {
      id: 5,
      title: 'Loaded Modules',
      type: 'stat',
      targets: [{ expr: 'homey_modules_loaded', legendFormat: 'modules' }],
      gridPos: { x: 18, y: 8, w: 6, h: 8 },
    },
    {
      id: 6,
      title: 'Uptime',
      type: 'stat',
      targets: [{ expr: 'homey_uptime_seconds / 3600', legendFormat: 'hours' }],
      gridPos: { x: 0, y: 16, w: 6, h: 4 },
    },
    {
      id: 7,
      title: 'Error Rate',
      type: 'timeseries',
      targets: [{ expr: 'rate(homey_http_requests_total{status=~"5.."}[5m])', legendFormat: '5xx errors' }],
      gridPos: { x: 6, y: 16, w: 18, h: 4 },
    },
  ],
};

fs.writeFileSync(
  'grafana/dashboards/homey-overview.json',
  JSON.stringify(dashboard, null, 2)
);
console.log('Grafana dashboard generated');
```

### Step 8: Operational Runbook

Define response procedures for common alerts.

```js
// lib/runbook.js
const runbooks = {
  highMemory: {
    alert: 'homey_memory_usage_bytes > 400MB',
    severity: 'warning',
    steps: [
      'Check /health/detailed for current memory breakdown',
      'Review recent deployments for memory leaks',
      'Check module count: GET /metrics | grep homey_modules_loaded',
      'If above 450MB, restart the backend: ./deploy.sh stop && ./deploy.sh start',
      'If persistent after restart, investigate with Node.js heap snapshot',
    ],
  },
  highErrorRate: {
    alert: 'rate(homey_http_requests_total{status=~"5.."}[5m]) > 0.1',
    severity: 'critical',
    steps: [
      'Check structured logs: docker compose logs backend --tail=100',
      'Identify the failing endpoint from metrics labels',
      'Check /health/ready for service readiness',
      'Review recent changes in git log',
      'If widespread, roll back: ./deploy.sh stop && git checkout <prev-tag> && ./deploy.sh start',
    ],
  },
  serviceDown: {
    alert: 'up{job="homey-backend"} == 0',
    severity: 'critical',
    steps: [
      'Verify container status: ./deploy.sh status',
      'Check container logs: docker compose logs backend --tail=200',
      'Attempt restart: ./deploy.sh stop && ./deploy.sh start',
      'Run health check: ./deploy.sh test',
      'If unrecoverable, escalate and check Docker daemon health',
    ],
  },
  highLatency: {
    alert: 'histogram_quantile(0.95, rate(homey_http_request_duration_seconds_bucket[5m])) > 2',
    severity: 'warning',
    steps: [
      'Check /metrics for slow endpoints by path label',
      'Review system load: GET /health/detailed for loadAverage',
      'Check if any module is performing blocking operations',
      'Consider horizontal scaling or optimizing slow handlers',
    ],
  },
};

module.exports = { runbooks };
```

## Rules

1. Every backend route must pass through the `metricsMiddleware` to record request metrics.
2. Use structured JSON logging exclusively; never use `console.log` in production code.
3. The `/health` endpoint must return 200 with `{"status":"ok"}` for liveness probes.
4. The `/health/ready` endpoint must return 503 when the service cannot handle traffic.
5. Prometheus scrape interval must be 10-15 seconds for backend, 15 seconds for dashboard.
6. All metrics must follow the naming convention `homey_<subsystem>_<metric>_<unit>`.
7. Log output must include timestamp, level, component, message, and pid fields.
8. Never log sensitive data (passwords, tokens, PII) in structured logs.
9. Grafana dashboards must include request rate, latency p95, memory, error rate, and module count.
10. Runbooks must exist for every alert rule and be kept current with deployment changes.
11. Health endpoints must be exempt from rate limiting and authentication.
12. Run `./deploy.sh test` to verify all health endpoints respond after any observability changes.

## Checklist

- [ ] MetricsRegistry implemented with counter, gauge, and histogram support
- [ ] `metricsMiddleware` applied to all Express routes
- [ ] `/metrics` endpoint returns valid Prometheus text format
- [ ] Structured JSON logger replaces all `console.log` calls
- [ ] Request logger middleware captures method, path, status, duration, and IP
- [ ] `/health` liveness endpoint returns 200
- [ ] `/health/ready` readiness endpoint returns 200 or 503 based on checks
- [ ] `/health/detailed` endpoint returns version, memory, uptime, and load
- [ ] Prometheus configuration targets backend on port 3000 and dashboard on port 3001
- [ ] Grafana dashboard includes all seven required panels
- [ ] Runbooks defined for high memory, high error rate, service down, and high latency
- [ ] `npm run test:all` passes
- [ ] `npm run lint:all` passes
- [ ] `./deploy.sh test` verifies health endpoints
