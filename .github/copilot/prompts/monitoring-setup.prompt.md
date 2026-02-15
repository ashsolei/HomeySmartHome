---
mode: "agent"
description: "Add Prometheus metrics and Grafana dashboards for HomeySmartHome monitoring"
---

# Monitoring Setup

Add monitoring capabilities to HomeySmartHome services.

## Add a Prometheus Metric

In `homey-app/server.js`, add to the `/metrics` endpoint:

```javascript
// Prometheus text format
app.get('/metrics', (req, res) => {
  const metrics = [
    '# HELP smarthomepro_custom_gauge Description',
    '# TYPE smarthomepro_custom_gauge gauge',
    `smarthomepro_custom_gauge{label="value"} ${getValue()}`,
    '',
    '# HELP smarthomepro_custom_counter Description',
    '# TYPE smarthomepro_custom_counter counter',
    `smarthomepro_custom_counter ${getCount()}`,
  ].join('\n');

  res.set('Content-Type', 'text/plain');
  res.send(metrics);
});
```

## Metric Types
- **gauge** — Value that goes up and down (temperature, memory, active connections)
- **counter** — Monotonically increasing value (requests, errors, bytes)
- **histogram** — Distribution of values (response times, payload sizes)

## Naming Convention
- Prefix: `smarthomepro_`
- Format: `smarthomepro_<subsystem>_<metric>_<unit>`
- Example: `smarthomepro_api_requests_total`, `smarthomepro_memory_usage_bytes`

## Prometheus Configuration
Add scrape target in `monitoring/prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'smarthomepro'
    static_configs:
      - targets: ['smarthomepro:3000']
```

## Verification
```bash
curl http://localhost:3000/metrics     # Check metric output
curl http://localhost:9090/api/v1/query?query=smarthomepro_custom_gauge  # Prometheus query
```
