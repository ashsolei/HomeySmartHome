# 🚀 Quick Start Guide - Smart Home Pro

## Prerequisites
- Node.js 20+ or Docker
- Homey Pro (optional - demo mode available)

## Option 1: Docker (Recommended) 🐳

### Production Environment
```bash
# 1. Clone and navigate
cd ~/HomeySmartHome

# 2. Configure environment
cp .env.example .env
# Edit .env with your Homey IP and token (or leave defaults for demo)

# 3. Start all services
docker compose up -d --build

# 4. Access the dashboard
open http://localhost
```

**Services Started:**
- ✅ Backend API (port 3000)
- ✅ Dashboard (port 3001)
- ✅ Nginx Proxy (port 80)

### Development Environment (with monitoring)
```bash
# Start dev environment with Redis, Prometheus, Grafana
docker compose -f docker-compose.dev.yml up

# Access services:
# - Dashboard: http://localhost:3001
# - Backend: http://localhost:3000
# - Prometheus: http://localhost:9090
# - Grafana: http://localhost:3002 (admin/admin)
# - Debugger: localhost:9229
```

## Option 2: Local Development 💻

### Backend (Homey App)
```bash
cd homey-app
npm install
npm start
# Running on http://localhost:3000
```

### Dashboard
```bash
cd web-dashboard
npm install
npm start
# Running on http://localhost:3001
```

## 🧪 Testing

### Run Tests
```bash
cd web-dashboard

# Start server in background
npm start &

# Wait a moment, then run tests
sleep 3
npm test

# Kill background server
pkill -f "node server.js"
```

### Expected Output
```
✅ Health endpoint returns 200
✅ Metrics endpoint returns Prometheus format
✅ Dashboard API returns data
Success Rate: 100%
```

## 📊 Available Endpoints

### Health & Monitoring
- `GET /health` - Health check
- `GET /metrics` - Prometheus metrics
- `GET /api/stats` - Performance statistics

### Dashboard
- `GET /api/dashboard` - Main dashboard data
- `GET /api/devices` - All devices
- `GET /api/zones` - All zones

### Analytics
- `GET /api/analytics/energy` - Energy analysis
- `GET /api/analytics/climate` - Climate analysis

### Control
- `POST /api/devices/:id/capability` - Control device
- `POST /api/scenes/activate` - Activate scene

## 🔧 Configuration

### Environment Variables (`.env`)
```bash
# Core
NODE_ENV=production
PORT=3001

# Homey (update with your values)
HOMEY_URL=http://192.168.1.100
HOMEY_TOKEN=your_token_here

# Security
ENABLE_RATE_LIMITING=true
MAX_REQUESTS_PER_MINUTE=100
JWT_SECRET=change_this_secret

# Features
ENABLE_AI_FEATURES=true
ENABLE_ENERGY_OPTIMIZATION=true
```

## 🐳 Docker Commands

```bash
# Build and start
docker compose up -d --build

# View logs
docker compose logs -f

# Check status
docker compose ps

# Stop services
docker compose down

# Clean up volumes
docker compose down -v
```

## ☸️ Kubernetes Deployment

```bash
# Apply configuration
kubectl apply -f k8s/deployment.yaml

# Check status
kubectl get pods -n smarthome-pro

# Port forward
kubectl port-forward -n smarthome-pro service/dashboard 3001:3001
```

## 📱 Demo Mode

The system works without a Homey Pro - it uses demo data automatically!

```bash
# Just start it
docker compose up -d

# Access dashboard
open http://localhost
```

Demo includes:
- 9 devices (lights, sensors, thermostats)
- 5 zones (living room, bedroom, kitchen, etc.)
- 6 scenes (morning, evening, movie, etc.)
- Energy monitoring
- Security status

## 🔍 Troubleshooting

### Port already in use
```bash
# Check what's using the port
lsof -i :3001

# Kill process
kill -9 <PID>
```

### Docker issues
```bash
# Clean up everything
docker compose down -v
docker system prune -a

# Rebuild from scratch
docker compose up -d --build --force-recreate
```

### Node modules issues
```bash
cd web-dashboard
rm -rf node_modules package-lock.json
npm install
```

## 📚 Documentation

- **README.md** - Main documentation
- **QUICKSTART.md** - This file
- **OPTIMIZATION_REPORT.md** - Latest optimizations
- **k8s/README.md** - Kubernetes guide
- **API.md** - API documentation

## 🆘 Support

If you encounter issues:
1. Check logs: `docker compose logs -f`
2. Verify health: `curl http://localhost/api/health`
3. Check configuration: `cat .env`

## 🎯 Next Steps

1. ✅ Get the system running
2. 📱 Connect your Homey Pro (or use demo mode)
3. 🎨 Customize the dashboard
4. 🤖 Explore automations
5. 📊 Monitor with Prometheus/Grafana

---

**Ready to go in 2 minutes!** 🚀
