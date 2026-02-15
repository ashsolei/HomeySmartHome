---
mode: "agent"
description: "Create a threat model for HomeySmartHome identifying attack surfaces, risks, and mitigations"
---

# Threat Model

Analyze attack surfaces and create a threat model for HomeySmartHome.

## STRIDE Analysis

### Spoofing
- **Surface:** Bearer token authentication
- **Risk:** Token theft or forgery
- **Mitigation:** Validate tokens on every request, rotate regularly, use HTTPS

### Tampering
- **Surface:** REST API request bodies, WebSocket messages
- **Risk:** Modified device commands, falsified sensor data
- **Mitigation:** Input validation, schema enforcement, request body size limits (1MB)

### Repudiation
- **Surface:** Automation executions, device control commands
- **Risk:** Untracked actions, deniable changes
- **Mitigation:** Structured logging with timestamps, audit trail for automation

### Information Disclosure
- **Surface:** Error responses, logs, metrics endpoint
- **Risk:** Stack traces, internal paths, system info exposed
- **Mitigation:** Helmet headers, error sanitization, restrict `/metrics` to internal network

### Denial of Service
- **Surface:** All HTTP endpoints, WebSocket connections
- **Risk:** Service overload, resource exhaustion
- **Mitigation:** Nginx rate limiting (30/60 req/s), Docker resource limits, connection limits

### Elevation of Privilege
- **Surface:** Container runtime, Nginx misconfiguration
- **Risk:** Container escape, unauthorized endpoint access
- **Mitigation:** Non-root containers, read-only filesystem, no-new-privileges, network policies

## Attack Surface Map

```
Internet → Nginx (80) → [Rate Limit] → [Security Headers]
  ├── /api/* → Backend (3000) → [Auth] → [Input Validation] → Modules
  ├── /socket.io → Dashboard (3001) → [CORS] → Socket.IO
  ├── /metrics → [Internal Only] → Prometheus text
  └── /* → Dashboard (3001) → Static Files
```

## Priority Mitigations

1. Ensure all API routes validate input
2. Verify rate limiting is active on all paths
3. Confirm `/metrics` is restricted to internal IPs
4. Verify Docker security context is enforced
5. Run `npm audit` regularly for known CVEs
