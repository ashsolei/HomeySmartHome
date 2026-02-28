'use strict';

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const crypto = require('crypto');

// Import advanced modules
const PredictiveAnalytics = require('./predictive-analytics');
const SecurityMiddleware = require('./security-middleware');
const PerformanceMonitor = require('./performance-monitor');
const ModuleLoader = require('./module-loader');

// Configuration (must be before Socket.IO init)
const PORT = process.env.PORT || 3001;
const HOMEY_URL = process.env.HOMEY_URL || 'http://smarthomepro:3000';
const HOMEY_TOKEN = process.env.HOMEY_TOKEN || '';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost,http://localhost:80').split(',').map(s => s.trim());

// ── Process error handlers ──
process.on('unhandledRejection', (reason, _promise) => {
  console.error('[FATAL] Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err);
  process.exit(1);
});

const app = express();
app.set('trust proxy', 1);
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: (origin, cb) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      cb(new Error('CORS not allowed'));
    },
    methods: ['GET', 'POST']
  }
});

// Socket.IO authentication
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
  if (process.env.NODE_ENV === 'production' && !token) {
    return next(new Error('Authentication required'));
  }
  next();
});

// Initialize advanced services
const analytics = new PredictiveAnalytics();
const securityMiddleware = new SecurityMiddleware({
  enableRateLimiting: process.env.ENABLE_RATE_LIMITING !== 'false',
  maxRequestsPerMinute: parseInt(process.env.MAX_REQUESTS_PER_MINUTE || '100', 10),
  jwtSecret: process.env.JWT_SECRET
});
const performanceMonitor = new PerformanceMonitor({
  enableDetailedMetrics: true
});

// Middleware
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error('CORS not allowed'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(require('helmet')({ contentSecurityPolicy: false }));
app.use(require('compression')());
app.use(securityMiddleware.securityHeaders());
app.use(securityMiddleware.rateLimit());
app.use(securityMiddleware.validateRequest());
app.use(performanceMonitor.trackRequest());
app.use(express.static(path.join(__dirname, 'public')));

// Request ID tracking
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Health check endpoint (for Docker healthcheck and load balancers)
app.get('/health', (req, res) => {
  const moduleSummary = moduleLoader.getSummary();
  res.status(200).json({
    status: 'ok',
    service: 'web-dashboard',
    version: '3.3.0',
    uptime: process.uptime(),
    modules: moduleSummary,
    timestamp: new Date().toISOString()
  });
});

// Readiness probe endpoint — reports ready only once ModuleLoader is initialized
app.get('/ready', (req, res) => {
  const backendUrl = process.env.HOMEY_URL || 'http://localhost:3000';
  const isReady = moduleLoader && typeof moduleLoader.getSummary === 'function';
  if (isReady) {
    res.json({ status: 'ready', backend: backendUrl, timestamp: new Date().toISOString() });
  } else {
    res.status(503).json({ status: 'not_ready', reason: 'Module loader not initialized' });
  }
});

// ── Internal-only guard for operational endpoints ──
// Allows RFC-1918 / loopback IPs and Docker bridge networks.
// Nginx restricts at proxy layer; this adds defense-in-depth.
const INTERNAL_NETS = /^(::ffff:)?(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)|^::1$/;
const METRICS_TOKEN = process.env.METRICS_TOKEN || '';
function internalOnly(req, res, next) {
  const ip = req.ip || req.connection?.remoteAddress || '';
  if (INTERNAL_NETS.test(ip)) return next();
  if (METRICS_TOKEN && req.headers.authorization === `Bearer ${METRICS_TOKEN}`) return next();
  return res.status(403).json({ error: 'Forbidden — internal access only' });
}

// Metrics endpoint for Prometheus
app.get('/metrics', internalOnly, (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send(performanceMonitor.getPrometheusMetrics());
});

// Performance stats endpoint
app.get('/api/stats', internalOnly, (req, res) => {
  res.json({
    performance: performanceMonitor.getMetrics(),
    security: securityMiddleware.getStats()
  });
});

// Homey API Client
class HomeyClient {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  async request(endpoint, method = 'GET', body = null) {
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, options);
      return await response.json();
    } catch (error) {
      console.error(`Homey API error: ${error.message}`);
      return { error: error.message };
    }
  }

  async getDevices() {
    return this.request('/api/manager/devices/device');
  }

  async getZones() {
    return this.request('/api/manager/zones/zone');
  }

  async setDeviceCapability(deviceId, capability, value) {
    return this.request(`/api/manager/devices/device/${deviceId}/capability/${capability}`, 'PUT', { value });
  }

  async getInsights() {
    return this.request('/api/manager/insights/log');
  }

  async triggerFlow(flowId) {
    return this.request(`/api/manager/flow/flow/${flowId}/trigger`, 'POST');
  }
}

const homeyClient = new HomeyClient(HOMEY_URL, HOMEY_TOKEN);

// Demo data for when Homey is not connected
const getDemoData = () => ({
  devices: {
    'light-1': { id: 'light-1', name: 'Vardagsrum Taklampa', class: 'light', zone: 'living-room', capabilities: ['onoff', 'dim'], capabilitiesObj: { onoff: { value: true }, dim: { value: 0.8 } } },
    'light-2': { id: 'light-2', name: 'Sovrum Lampa', class: 'light', zone: 'bedroom', capabilities: ['onoff', 'dim', 'light_hue'], capabilitiesObj: { onoff: { value: false }, dim: { value: 0.5 } } },
    'light-3': { id: 'light-3', name: 'Kök Spottar', class: 'light', zone: 'kitchen', capabilities: ['onoff', 'dim'], capabilitiesObj: { onoff: { value: true }, dim: { value: 1 } } },
    'thermostat-1': { id: 'thermostat-1', name: 'Vardagsrum Termostat', class: 'thermostat', zone: 'living-room', capabilities: ['measure_temperature', 'target_temperature'], capabilitiesObj: { measure_temperature: { value: 21.5 }, target_temperature: { value: 22 } } },
    'sensor-1': { id: 'sensor-1', name: 'Ytterdörr Sensor', class: 'sensor', zone: 'hallway', capabilities: ['alarm_contact'], capabilitiesObj: { alarm_contact: { value: false } } },
    'sensor-2': { id: 'sensor-2', name: 'Rörelsesensor Vardagsrum', class: 'sensor', zone: 'living-room', capabilities: ['alarm_motion'], capabilitiesObj: { alarm_motion: { value: false } } },
    'plug-1': { id: 'plug-1', name: 'TV Smart Plug', class: 'socket', zone: 'living-room', capabilities: ['onoff', 'measure_power'], capabilitiesObj: { onoff: { value: true }, measure_power: { value: 85 } } },
    'plug-2': { id: 'plug-2', name: 'Dator Smart Plug', class: 'socket', zone: 'office', capabilities: ['onoff', 'measure_power'], capabilitiesObj: { onoff: { value: true }, measure_power: { value: 120 } } },
    'climate-1': { id: 'climate-1', name: 'Temperatur Sovrum', class: 'sensor', zone: 'bedroom', capabilities: ['measure_temperature', 'measure_humidity'], capabilitiesObj: { measure_temperature: { value: 19.8 }, measure_humidity: { value: 45 } } },
  },
  zones: {
    'living-room': { id: 'living-room', name: 'Vardagsrum', icon: '🛋️' },
    'bedroom': { id: 'bedroom', name: 'Sovrum', icon: '🛏️' },
    'kitchen': { id: 'kitchen', name: 'Kök', icon: '🍳' },
    'hallway': { id: 'hallway', name: 'Hall', icon: '🚪' },
    'office': { id: 'office', name: 'Kontor', icon: '💻' },
  },
  scenes: {
    'morning': { id: 'morning', name: 'God Morgon', icon: '🌅' },
    'evening': { id: 'evening', name: 'Kväll', icon: '🌆' },
    'night': { id: 'night', name: 'God Natt', icon: '🌙' },
    'away': { id: 'away', name: 'Borta', icon: '🚗' },
    'movie': { id: 'movie', name: 'Filmkväll', icon: '🎬' },
    'party': { id: 'party', name: 'Fest', icon: '🎉' },
  },
  energy: {
    current: 847,
    today: 12.4,
    thisMonth: 285,
    trend: 'down'
  },
  security: {
    mode: 'home',
    alarmsActive: 0
  },
  weather: {
    temperature: -2,
    condition: 'cloudy',
    humidity: 78
  }
});

// API Routes
app.get('/api/dashboard', async (req, res) => {
  try {
    const [devices, zones] = await Promise.all([
      homeyClient.getDevices(),
      homeyClient.getZones()
    ]);

    if (devices.error || zones.error) {
      // Return demo data if Homey is not connected
      return res.json(getDemoData());
    }

    res.json({
      devices,
      zones,
      timestamp: new Date().toISOString()
    });
  } catch (_error) {
    res.json(getDemoData());
  }
});

app.get('/api/devices', async (req, res) => {
  try {
    const devices = await homeyClient.getDevices();
    if (devices.error) {
      return res.json(getDemoData().devices);
    }
    res.json(devices);
  } catch (_error) {
    res.json(getDemoData().devices);
  }
});

app.get('/api/zones', async (req, res) => {
  try {
    const zones = await homeyClient.getZones();
    if (zones.error) {
      return res.json(getDemoData().zones);
    }
    res.json(zones);
  } catch (_error) {
    res.json(getDemoData().zones);
  }
});

app.post('/api/device/:deviceId/capability/:capability', async (req, res) => {
  const { deviceId, capability } = req.params;
  const { value } = req.body;

  if (!deviceId || typeof deviceId !== 'string' || deviceId.length > 128) {
    return res.status(400).json({ error: 'Invalid device ID' });
  }
  if (!capability || typeof capability !== 'string' || capability.length > 64) {
    return res.status(400).json({ error: 'Invalid capability' });
  }

  try {
    const result = await homeyClient.setDeviceCapability(deviceId, capability, value);
    io.emit('device-updated', { deviceId, capability, value });
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/scene/:sceneId', async (req, res) => {
  const { sceneId } = req.params;

  if (!sceneId || typeof sceneId !== 'string' || sceneId.length > 128) {
    return res.status(400).json({ error: 'Invalid scene ID' });
  }

  try {
    io.emit('scene-activated', { sceneId });
    res.json({ success: true, sceneId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/energy', async (req, res) => {
  res.json(getDemoData().energy);
});

// Energy analytics snapshot — returns current demo values with SEK cost estimate
app.get('/api/energy/analytics', (req, res) => {
  const energy = getDemoData().energy;
  const pricePerKwh = 1.5; // SEK/kWh
  const estimatedDailyCostSEK = parseFloat(
    ((energy.current * 24) / 1000 * pricePerKwh).toFixed(2)
  );
  res.json({
    current: energy.current,
    today: energy.today,
    thisMonth: energy.thisMonth,
    trend: energy.trend,
    estimatedDailyCostSEK,
    pricePerKwh,
    currency: 'SEK',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/security', async (req, res) => {
  res.json(getDemoData().security);
});

app.post('/api/security/mode', (req, res) => {
  const { mode } = req.body;
  const validModes = ['home', 'away', 'night', 'vacation', 'disarmed'];

  if (!mode || typeof mode !== 'string' || !validModes.includes(mode)) {
    return res.status(400).json({ error: 'Invalid security mode' });
  }

  try {
    io.emit('security-mode-changed', { mode });
    res.json({ success: true, mode });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ADVANCED ANALYTICS ENDPOINTS
// ============================================

app.get('/api/analytics/energy', async (req, res) => {
  try {
    const data = await getDashboardData();
    const energyAnalysis = await analytics.analyzeEnergyConsumption(data);
    res.json(energyAnalysis);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/analytics/climate', async (req, res) => {
  try {
    const data = await getDashboardData();
    const climateAnalysis = await analytics.analyzeClimate(data);
    res.json(climateAnalysis);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/analytics/devices', async (req, res) => {
  try {
    const data = await getDashboardData();
    const deviceAnalysis = await analytics.analyzeDeviceUsage(data);
    res.json(deviceAnalysis);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/analytics/insights', async (req, res) => {
  try {
    const data = await getDashboardData();
    const insights = await analytics.generateInsights(data);
    res.json(insights);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/analytics/predictions', async (req, res) => {
  try {
    const data = await getDashboardData();
    const predictions = {
      energy: await analytics.predictNextHour(data.energy || []),
      todayForecast: await analytics.predictToday(data.energy || []),
      monthForecast: await analytics.predictThisMonth(data.energy || [])
    };
    res.json(predictions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/analytics/recommendations', async (req, res) => {
  try {
    const data = await getDashboardData();
    const energyAnalysis = await analytics.analyzeEnergyConsumption(data);
    const deviceAnalysis = await analytics.analyzeDeviceUsage(data);
    
    const recommendations = {
      energy: energyAnalysis.savings || [],
      devices: deviceAnalysis.recommendations || [],
      climate: (await analytics.analyzeClimate(data)).recommendations || []
    };
    
    res.json(recommendations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Advanced dashboard data with analytics
app.get('/api/dashboard/advanced', async (req, res) => {
  try {
    const data = await getDashboardData();
    
    const [energyAnalysis, climateAnalysis, deviceAnalysis, insights] = await Promise.all([
      analytics.analyzeEnergyConsumption(data),
      analytics.analyzeClimate(data),
      analytics.analyzeDeviceUsage(data),
      analytics.generateInsights(data)
    ]);
    
    res.json({
      ...data,
      analytics: {
        energy: energyAnalysis,
        climate: climateAnalysis,
        devices: deviceAnalysis,
        insights: insights
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to get dashboard data
async function getDashboardData() {
  try {
    const [devices, zones] = await Promise.all([
      homeyClient.getDevices(),
      homeyClient.getZones()
    ]);

    if (devices.error || zones.error) {
      return getDemoData();
    }

    return { devices, zones };
  } catch (_error) {
    return getDemoData();
  }
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('subscribe-device', (deviceId) => {
    if (!deviceId || typeof deviceId !== 'string' || deviceId.length > 128) {
      return socket.emit('error', { message: 'Invalid device ID' });
    }
    socket.join(`device-${deviceId}`);
  });

  socket.on('control-device', async (data) => {
    const { deviceId, capability, value } = data || {};
    if (!deviceId || typeof deviceId !== 'string' || !capability || typeof capability !== 'string') {
      return socket.emit('error', { message: 'Invalid device control data' });
    }
    if (deviceId.length > 128 || capability.length > 64) {
      return socket.emit('error', { message: 'Invalid input length' });
    }
    try {
      await homeyClient.setDeviceCapability(deviceId, capability, value);
      io.emit('device-updated', { deviceId, capability, value });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('activate-scene', (sceneId) => {
    if (!sceneId || typeof sceneId !== 'string' || sceneId.length > 128) {
      return socket.emit('error', { message: 'Invalid scene ID' });
    }
    io.emit('scene-activated', { sceneId });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Periodic updates — only start when running as a server (not when imported for testing)
let periodicUpdateInterval = null;
if (require.main === module) {
  periodicUpdateInterval = setInterval(async () => {
    try {
      const data = getDemoData();
      // Simulate real-time changes
      data.energy.current = 800 + Math.floor(Math.random() * 100);
      // Emit on both the canonical `energy:update` and the legacy name
      io.emit('energy:update', data.energy);
      io.emit('energy-update', data.energy);
    } catch (error) {
      console.error('Update error:', error);
    }
  }, 5000);
}

// ============================================
// MODULE LOADER — Boot all 59+ feature modules
// ============================================

const moduleLoader = new ModuleLoader();

async function bootModules() {
  // Build app context for modules that need it
  const appContext = {
    homeyClient,
    io,
    getDemoData,
    getDashboardData,
    analytics,
    securityMiddleware,
    performanceMonitor,
    config: { PORT, HOMEY_URL, ALLOWED_ORIGINS }
  };

  const result = await moduleLoader.loadAll(appContext, {
    analytics,
    security: securityMiddleware,
    performance: performanceMonitor
  });

  // Register module API routes and Socket.IO events
  moduleLoader.registerRoutes(app);
  moduleLoader.registerSocketEvents(io);

  return result;
}

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received — shutting down gracefully…`);

  if (periodicUpdateInterval) clearInterval(periodicUpdateInterval);

  // Destroy all loaded dashboard modules (clear intervals/timeouts)
  moduleLoader.destroyAll();

  // Destroy standalone services
  if (typeof performanceMonitor.destroy === 'function') performanceMonitor.destroy();
  if (typeof securityMiddleware.destroy === 'function') securityMiddleware.destroy();

  // Stop accepting new connections
  httpServer.close(() => {
    console.log('HTTP server closed');
  });

  // Disconnect all Socket.IO clients
  io.close(() => {
    console.log('Socket.IO closed');
  });

  // Give ongoing requests time to complete
  setTimeout(() => {
    console.log('Cleanup complete. Exiting.');
    process.exit(0);
  }, 3000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

/**
 * Cleanup function for test teardown — stops intervals and destroys services.
 * Only needed when tests import server.js directly (e.g. supertest).
 */
function _cleanup() {
  if (periodicUpdateInterval) {
    clearInterval(periodicUpdateInterval);
    periodicUpdateInterval = null;
  }
  moduleLoader.destroyAll();
  if (typeof performanceMonitor.destroy === 'function') performanceMonitor.destroy();
  if (typeof securityMiddleware.destroy === 'function') securityMiddleware.destroy();
  io.close();
  httpServer.close();
}

// Export app for testing (supertest)
module.exports = { app, _cleanup };

// Start server only when run directly (not when imported for testing)
if (require.main === module) {
  httpServer.listen(PORT, async () => {
    console.log(`🏠 Smart Home Dashboard running at http://localhost:${PORT}`);
    console.log(`📡 Homey connection: ${HOMEY_URL}`);

    // Boot all feature modules after server is listening
    try {
      const result = await bootModules();
      console.log(`📦 ${result.ready}/${result.total} modules ready`);
    } catch (err) {
      console.error('Module boot error:', err.message);
    }
  });
}
