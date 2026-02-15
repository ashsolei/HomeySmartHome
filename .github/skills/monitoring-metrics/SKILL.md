---
name: monitoring-metrics
description: "Adds Prometheus metrics, Grafana dashboards, and alerting to HomeySmartHome services. Covers custom gauge/counter/histogram metrics, scrape configuration, and dashboard provisioning."
argument-hint: "[metric-name] [metric-type]"
---

# Monitoring & Metrics

Adds observability to HomeySmartHome services via Prometheus metrics and Grafana dashboards.

## Metrics Architecture

```
Backend (3000) → /metrics endpoint → Prometheus (9090) → Grafana (3002)
Dashboard (3001) → /metrics endpoint → Prometheus (9090) → Grafana (3002)
```

## Adding a Prometheus Metric

### 1. Define the Metric

In `homey-app/server.js`, add to the `/metrics` handler:

```javascript
app.get('/metrics', (req, res) => {
  const uptime = process.uptime();
  const memory = process.memoryUsage();

  const metrics = [
    // Existing metrics
    '# HELP smarthomepro_uptime_seconds Service uptime in seconds',
    '# TYPE smarthomepro_uptime_seconds gauge',
    `smarthomepro_uptime_seconds ${uptime}`,
    '',
    '# HELP smarthomepro_memory_heap_bytes Heap memory usage',
    '# TYPE smarthomepro_memory_heap_bytes gauge',
    `smarthomepro_memory_heap_bytes ${memory.heapUsed}`,
    '',
    // NEW: Add your metric here
    '# HELP smarthomepro_custom_metric Description of the metric',
    '# TYPE smarthomepro_custom_metric gauge',
    `smarthomepro_custom_metric{label="value"} ${getMetricValue()}`,
  ].join('\n');

  res.set('Content-Type', 'text/plain; version=0.0.4');
  res.send(metrics);
});
```

### 2. Metric Types

| Type | When to Use | Example |
|------|-------------|---------|
| gauge | Value goes up and down | Temperature, memory, active connections |
| counter | Monotonically increasing | Total requests, errors, bytes processed |
| histogram | Distribution of values | Response times, payload sizes |

### 3. Naming Convention

Format: `smarthomepro_<subsystem>_<metric>_<unit>`

```
smarthomepro_api_requests_total          ← counter
smarthomepro_api_request_duration_seconds ← histogram
smarthomepro_module_active_count          ← gauge
smarthomepro_memory_heap_bytes            ← gauge
smarthomepro_energy_consumption_watts     ← gauge
smarthomepro_automation_executions_total  ← counter
```

### 4. Labels

Use labels for dimensions, not separate metric names:

```
# Good: Labels for variants
smarthomepro_api_requests_total{method="GET",path="/health"} 1542
smarthomepro_api_requests_total{method="POST",path="/api/v1/devices"} 89

# Bad: Separate metrics per variant
smarthomepro_get_health_requests 1542
smarthomepro_post_devices_requests 89
```

## Prometheus Configuration

`monitoring/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'smarthomepro-backend'
    static_configs:
      - targets: ['smarthomepro:3000']
    metrics_path: /metrics
    scrape_interval: 10s

  - job_name: 'smarthomepro-dashboard'
    static_configs:
      - targets: ['dashboard:3001']
    metrics_path: /metrics
    scrape_interval: 15s
```

## Grafana Dashboard

Create a dashboard JSON in `monitoring/grafana/provisioning/dashboards/`:

```json
{
  "dashboard": {
    "title": "HomeySmartHome Overview",
    "panels": [
      {
        "title": "Service Uptime",
        "type": "stat",
        "targets": [{ "expr": "smarthomepro_uptime_seconds" }]
      },
      {
        "title": "Memory Usage",
        "type": "timeseries",
        "targets": [{ "expr": "smarthomepro_memory_heap_bytes / 1024 / 1024" }],
        "fieldConfig": { "defaults": { "unit": "decmbytes" } }
      }
    ]
  }
}
```

## Verification

```bash
# Check metrics endpoint
curl http://localhost:3000/metrics

# Query Prometheus
curl 'http://localhost:9090/api/v1/query?query=smarthomepro_uptime_seconds'

# Access Grafana
open http://localhost:3002  # admin/admin
```

## Common Metrics to Add

| Metric | Type | Description |
|--------|------|-------------|
| `_api_requests_total` | counter | Total API requests by method/path |
| `_api_errors_total` | counter | Total API errors by status code |
| `_api_duration_seconds` | histogram | Request duration |
| `_module_init_duration_seconds` | histogram | Module initialization time |
| `_socketio_connections` | gauge | Active WebSocket connections |
| `_automation_executions_total` | counter | Automation rule executions |
| `_energy_consumption_watts` | gauge | Current energy consumption |
| `_device_count` | gauge | Number of connected devices |
