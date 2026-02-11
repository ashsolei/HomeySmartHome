# ✅ Smart Home Pro - Deployment Checklist

## 🚀 Quick Start (Choose One)

### Option A: Docker Compose (Recommended) - 2 minutes
```bash
cd ~/HomeySmartHome
docker compose up -d
open http://localhost
```

### Option B: Development Mode - 3 minutes
```bash
cd ~/HomeySmartHome
docker compose -f docker-compose.dev.yml up
# Access at http://localhost:3001
```

### Option C: Local Development - 5 minutes
```bash
# Terminal 1 - Backend
cd ~/HomeySmartHome/homey-app
npm install && npm start

# Terminal 2 - Dashboard
cd ~/HomeySmartHome/web-dashboard
npm install && npm start
```

---

## 📋 Pre-Deployment Checklist

### ✅ Configuration
- [ ] Review `.env` file
- [ ] Update `HOMEY_URL` with your Homey IP (or use demo mode)
- [ ] Update `HOMEY_TOKEN` with your API token (or skip for demo)
- [ ] Set `JWT_SECRET` to a random value for production

### ✅ Security
- [ ] Change default passwords in `.env`
- [ ] Review rate limiting settings (default: 100 req/min)
- [ ] Verify CSRF protection is enabled
- [ ] Check security headers configuration

### ✅ Docker
- [ ] Docker is installed: `docker --version`
- [ ] Docker Compose is installed: `docker compose version`
- [ ] Images are built: `docker images | grep homeysmarthome`
- [ ] No port conflicts: `lsof -i :80 -i :3000 -i :3001`

### ✅ Testing
- [ ] Docker configs are valid: `docker compose config`
- [ ] Dev configs are valid: `docker compose -f docker-compose.dev.yml config`
- [ ] Tests pass (optional): `cd web-dashboard && npm test`

---

## 🎯 Production Deployment Checklist

### ☸️ Kubernetes Deployment
- [ ] Kubernetes cluster is available
- [ ] kubectl is configured: `kubectl cluster-info`
- [ ] Update `k8s/deployment.yaml` with your values:
  - [ ] Container image URLs
  - [ ] Domain name in Ingress
  - [ ] Secret values (HOMEY_TOKEN, JWT_SECRET)
- [ ] Apply configuration: `kubectl apply -f k8s/deployment.yaml`
- [ ] Verify pods: `kubectl get pods -n smarthome-pro`
- [ ] Check services: `kubectl get svc -n smarthome-pro`
- [ ] Test ingress: `kubectl get ingress -n smarthome-pro`

### 🔄 CI/CD Setup
- [ ] GitHub repository is created
- [ ] Secrets are configured in GitHub:
  - [ ] `GITHUB_TOKEN` (automatic)
  - [ ] `HOMEY_TOKEN` (if needed)
- [ ] GitHub Actions is enabled
- [ ] First workflow run is successful

### 📊 Monitoring
- [ ] Prometheus is accessible
- [ ] Grafana dashboards are configured
- [ ] Alerts are set up (optional)
- [ ] Metrics endpoints are working:
  - [ ] `curl http://localhost:3000/metrics`
  - [ ] `curl http://localhost:3001/metrics`

---

## 🧪 Post-Deployment Verification

### Health Checks
```bash
# Check all services are healthy
curl http://localhost/api/health
curl http://localhost/dashboard/health

# Expected: {"status":"ok", ...}
```

### API Endpoints
```bash
# Test dashboard API
curl http://localhost/api/dashboard

# Test metrics
curl http://localhost/api/stats

# Test Prometheus metrics
curl http://localhost:3001/metrics
```

### Security Headers
```bash
# Verify security headers
curl -I http://localhost | grep -E "X-Frame|X-Content|X-XSS"

# Expected headers:
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
# X-XSS-Protection: 1; mode=block
```

### Performance
```bash
# Check response time
time curl http://localhost/api/dashboard

# Should be < 500ms
```

---

## 📚 Documentation Review

- [ ] Read `AUTONOMOUS_WORK_SUMMARY.md` - Overview of changes
- [ ] Read `OPTIMIZATION_REPORT.md` - Detailed optimizations
- [ ] Read `QUICKSTART_DOCKER.md` - Docker quick start
- [ ] Read `k8s/README.md` - Kubernetes guide (if deploying to K8s)
- [ ] Bookmark `/api/stats` for monitoring
- [ ] Bookmark `/metrics` for Prometheus

---

## 🎉 Success Criteria

Your deployment is successful when:

✅ **Docker Compose**: All 3 containers are running and healthy
```bash
docker compose ps
# All services should show "healthy" status
```

✅ **Dashboard**: Accessible at http://localhost
```bash
curl -f http://localhost
```

✅ **API**: All endpoints respond
```bash
curl http://localhost/api/dashboard | jq
```

✅ **Metrics**: Prometheus metrics are exposed
```bash
curl http://localhost/metrics | head -10
```

✅ **Security**: Headers are present
```bash
curl -I http://localhost | grep X-Frame-Options
```

---

## 🔧 Troubleshooting

### Problem: Ports already in use
```bash
# Find what's using the port
lsof -i :80
lsof -i :3000
lsof -i :3001

# Kill the process or change ports in .env
```

### Problem: Docker containers won't start
```bash
# Check logs
docker compose logs -f

# Restart services
docker compose restart

# Clean rebuild
docker compose down -v
docker compose up -d --build
```

### Problem: Can't connect to Homey
```bash
# Verify Homey URL
echo $HOMEY_URL

# Test connection
curl http://YOUR_HOMEY_IP/api/manager/system

# Use demo mode if Homey not available (automatic)
```

---

## 📞 Support Commands

```bash
# View all logs
docker compose logs -f

# View specific service logs
docker compose logs -f dashboard

# Check container status
docker compose ps

# Restart all services
docker compose restart

# Stop all services
docker compose down

# Clean everything and restart
docker compose down -v
docker compose up -d --build
```

---

## 🎊 You're Done!

Once all checkboxes are checked, your Smart Home Pro system is:

✅ Running in Docker  
✅ Secured with middleware  
✅ Monitored with metrics  
✅ Tested and validated  
✅ Documented and ready  

**Enjoy your smart home automation!** 🏠🤖

---

*Last updated: 2026-02-11*
*Smart Home Pro v3.0.0*
