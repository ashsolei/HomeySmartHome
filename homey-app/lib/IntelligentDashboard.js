'use strict';

/**
 * @typedef {object} WidgetConfig
 * @property {string} id - Unique widget identifier
 * @property {string} type - Widget type (e.g. 'energy_chart', 'status_card')
 * @property {'small'|'medium'|'large'} size - Display size
 * @property {{x: number, y: number, w: number, h: number}} position - Grid position and span
 * @property {object} config - Widget-type-specific configuration
 */

/**
 * @typedef {object} DashboardConfig
 * @property {string} [id] - Dashboard ID (auto-generated if omitted)
 * @property {{en: string, sv?: string}|string} name - Dashboard display name
 * @property {string} [icon='dashboard'] - Dashboard icon name
 * @property {WidgetConfig[]} [widgets=[]] - List of widgets
 * @property {number} [refreshInterval=30000] - Auto-refresh interval in ms
 * @property {'light'|'dark'|'auto'} [theme='auto'] - Color theme
 * @property {'grid'|'list'} [layout='grid'] - Layout mode
 * @property {number} [columns=12] - Number of grid columns
 */

/**
 * @typedef {object} Dashboard
 * @property {string} id - Unique identifier
 * @property {{en: string, sv?: string}|string} name - Display name
 * @property {string} icon - Icon name
 * @property {WidgetConfig[]} widgets - Widget list
 * @property {{refreshInterval: number, theme: string, layout: string, columns: number}} settings - Display settings
 * @property {number} created - Creation timestamp (ms)
 * @property {number} modified - Last-modified timestamp (ms)
 */

/**
 * @typedef {object} WidgetDataResult
 * @property {string} widgetId - Widget identifier
 * @property {string} type - Widget type
 * @property {object} [data] - Widget data payload (present on success)
 * @property {string} [error] - Error message (present on failure)
 * @property {number} timestamp - Timestamp of the result (ms)
 */

/**
 * Intelligent Dashboard System.
 *
 * Manages named dashboard layouts made up of typed widgets, fetches live data
 * for each widget on demand, and maintains a lightweight real-time data cache
 * (energy, presence, security) refreshed every 5 seconds.
 */
class IntelligentDashboard {
  /**
   * @param {import('homey').Homey} homey - Homey app instance
   */
  constructor(homey) {
    this.homey = homey;
    this.widgets = new Map();
    this.dashboardLayouts = new Map();
    this.realTimeData = new Map();
    this.updateInterval = null;
  }

  /**
   * Initialize the dashboard system: restore saved layouts from settings and
   * start the real-time data update interval.
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    this.log('Initializing Intelligent Dashboard...');
    
    // Load saved layouts
    const layouts = await this.homey.settings.get('dashboardLayouts') || {};
    Object.entries(layouts).forEach(([id, layout]) => {
      this.dashboardLayouts.set(id, layout);
    });

    // Create default widgets if none exist
    if (this.dashboardLayouts.size === 0) {
      await this.createDefaultDashboards();
    }

    // Start real-time updates
    this.startRealTimeUpdates();
    
    this.log('Intelligent Dashboard initialized');
  }

  /**
   * Create default dashboard layouts
   */
  async createDefaultDashboards() {
    // Home Overview Dashboard
    await this.createDashboard({
      id: 'home_overview',
      name: { en: 'Home Overview', sv: 'Hemöversikt' },
      widgets: [
        {
          id: 'quick_status',
          type: 'status_card',
          size: 'large',
          position: { x: 0, y: 0, w: 12, h: 4 },
          config: {
            showTemperature: true,
            showEnergy: true,
            showSecurity: true,
            showPresence: true
          }
        },
        {
          id: 'energy_monitor',
          type: 'energy_chart',
          size: 'medium',
          position: { x: 0, y: 4, w: 6, h: 6 },
          config: {
            period: '24h',
            showCost: true,
            showComparison: true
          }
        },
        {
          id: 'climate_control',
          type: 'climate_panel',
          size: 'medium',
          position: { x: 6, y: 4, w: 6, h: 6 },
          config: {
            zones: 'all',
            showHumidity: true,
            quickControls: true
          }
        },
        {
          id: 'scene_controls',
          type: 'scene_grid',
          size: 'medium',
          position: { x: 0, y: 10, w: 6, h: 4 },
          config: {
            layout: 'grid',
            showStatus: true
          }
        },
        {
          id: 'devices_overview',
          type: 'device_list',
          size: 'medium',
          position: { x: 6, y: 10, w: 6, h: 4 },
          config: {
            groupBy: 'zone',
            showOffline: true,
            quickActions: true
          }
        }
      ]
    });

    // Energy Dashboard
    await this.createDashboard({
      id: 'energy',
      name: { en: 'Energy Management', sv: 'Energihantering' },
      widgets: [
        {
          id: 'energy_realtime',
          type: 'energy_realtime',
          size: 'large',
          position: { x: 0, y: 0, w: 12, h: 5 },
          config: {
            showTotal: true,
            showPerDevice: true,
            updateInterval: 5000
          }
        },
        {
          id: 'energy_history',
          type: 'energy_history_chart',
          size: 'large',
          position: { x: 0, y: 5, w: 8, h: 6 },
          config: {
            periods: ['today', 'week', 'month'],
            showPrediction: true
          }
        },
        {
          id: 'energy_insights',
          type: 'insights_card',
          size: 'medium',
          position: { x: 8, y: 5, w: 4, h: 6 },
          config: {
            showTips: true,
            showComparison: true,
            showGoals: true
          }
        },
        {
          id: 'top_consumers',
          type: 'top_consumers_list',
          size: 'medium',
          position: { x: 0, y: 11, w: 6, h: 5 },
          config: {
            limit: 10,
            showPercentage: true
          }
        },
        {
          id: 'cost_calculator',
          type: 'cost_card',
          size: 'medium',
          position: { x: 6, y: 11, w: 6, h: 5 },
          config: {
            showEstimates: true,
            showSavings: true
          }
        }
      ]
    });

    // Security Dashboard
    await this.createDashboard({
      id: 'security',
      name: { en: 'Security & Monitoring', sv: 'Säkerhet & Övervakning' },
      widgets: [
        {
          id: 'security_status',
          type: 'security_panel',
          size: 'large',
          position: { x: 0, y: 0, w: 12, h: 4 },
          config: {
            showMode: true,
            showArmed: true,
            quickActions: true
          }
        },
        {
          id: 'camera_feed',
          type: 'camera_grid',
          size: 'large',
          position: { x: 0, y: 4, w: 8, h: 8 },
          config: {
            layout: 'grid',
            showMotion: true
          }
        },
        {
          id: 'event_log',
          type: 'event_timeline',
          size: 'medium',
          position: { x: 8, y: 4, w: 4, h: 8 },
          config: {
            limit: 50,
            showFilters: true
          }
        },
        {
          id: 'presence_map',
          type: 'presence_zones',
          size: 'medium',
          position: { x: 0, y: 12, w: 6, h: 4 },
          config: {
            showHistory: true,
            showDevices: true
          }
        },
        {
          id: 'alerts',
          type: 'alerts_panel',
          size: 'medium',
          position: { x: 6, y: 12, w: 6, h: 4 },
          config: {
            showActive: true,
            showHistory: false
          }
        }
      ]
    });

    // Analytics Dashboard
    await this.createDashboard({
      id: 'analytics',
      name: { en: 'Analytics & Insights', sv: 'Analys & Insikter' },
      widgets: [
        {
          id: 'ai_insights',
          type: 'ai_insights_card',
          size: 'large',
          position: { x: 0, y: 0, w: 12, h: 5 },
          config: {
            showPredictions: true,
            showRecommendations: true,
            showPatterns: true
          }
        },
        {
          id: 'automation_analytics',
          type: 'automation_stats',
          size: 'medium',
          position: { x: 0, y: 5, w: 6, h: 6 },
          config: {
            showSuccessRate: true,
            showMostUsed: true,
            showTrends: true
          }
        },
        {
          id: 'device_analytics',
          type: 'device_stats',
          size: 'medium',
          position: { x: 6, y: 5, w: 6, h: 6 },
          config: {
            showUptime: true,
            showUsage: true,
            showHealth: true
          }
        },
        {
          id: 'trends_chart',
          type: 'trends_visualization',
          size: 'large',
          position: { x: 0, y: 11, w: 12, h: 6 },
          config: {
            metrics: ['energy', 'temperature', 'presence'],
            period: '30d'
          }
        }
      ]
    });
  }

  /**
   * Create a new dashboard from the supplied configuration, persist it to
   * Homey settings, and return the stored dashboard object.
   *
   * @param {DashboardConfig} config - Dashboard configuration
   * @returns {Promise<Dashboard>}
   */
  async createDashboard(config) {
    const dashboard = {
      id: config.id || this.generateId(),
      name: config.name,
      icon: config.icon || 'dashboard',
      widgets: config.widgets || [],
      settings: {
        refreshInterval: config.refreshInterval || 30000,
        theme: config.theme || 'auto',
        layout: config.layout || 'grid',
        columns: config.columns || 12
      },
      created: Date.now(),
      modified: Date.now()
    };

    this.dashboardLayouts.set(dashboard.id, dashboard);
    await this.saveDashboards();
    
    return dashboard;
  }

  /**
   * Fetch all widget data for the specified dashboard in parallel and return
   * the assembled result.
   *
   * @param {string} dashboardId - Dashboard identifier
   * @returns {Promise<{dashboard: Dashboard, data: WidgetDataResult[], timestamp: number}>}
   * @throws {Error} When the dashboard ID is not found
   */
  async getDashboardData(dashboardId) {
    const dashboard = this.dashboardLayouts.get(dashboardId);
    if (!dashboard) {
      throw new Error(`Dashboard ${dashboardId} not found`);
    }

    const widgetData = await Promise.all(
      dashboard.widgets.map(widget => this.getWidgetData(widget))
    );

    return {
      dashboard,
      data: widgetData,
      timestamp: Date.now()
    };
  }

  /**
   * Dispatch to the appropriate data-provider method for the given widget and
   * return a normalised result envelope.  On error the envelope contains an
   * `error` field instead of `data`.
   *
   * @param {WidgetConfig} widget - Widget descriptor
   * @returns {Promise<WidgetDataResult>}
   */
  async getWidgetData(widget) {
    const { type, config } = widget;

    try {
      let data;

      switch (type) {
        case 'status_card':
          data = await this.getStatusCardData(config);
          break;
        case 'energy_chart':
          data = await this.getEnergyChartData(config);
          break;
        case 'climate_panel':
          data = await this.getClimatePanelData(config);
          break;
        case 'scene_grid':
          data = await this.getSceneGridData(config);
          break;
        case 'device_list':
          data = await this.getDeviceListData(config);
          break;
        case 'energy_realtime':
          data = await this.getEnergyRealtimeData(config);
          break;
        case 'energy_history_chart':
          data = await this.getEnergyHistoryData(config);
          break;
        case 'insights_card':
          data = await this.getInsightsData(config);
          break;
        case 'top_consumers_list':
          data = await this.getTopConsumersData(config);
          break;
        case 'cost_card':
          data = await this.getCostData(config);
          break;
        case 'security_panel':
          data = await this.getSecurityPanelData(config);
          break;
        case 'camera_grid':
          data = await this.getCameraGridData(config);
          break;
        case 'event_timeline':
          data = await this.getEventTimelineData(config);
          break;
        case 'presence_zones':
          data = await this.getPresenceZonesData(config);
          break;
        case 'alerts_panel':
          data = await this.getAlertsPanelData(config);
          break;
        case 'ai_insights_card':
          data = await this.getAIInsightsData(config);
          break;
        case 'automation_stats':
          data = await this.getAutomationStatsData(config);
          break;
        case 'device_stats':
          data = await this.getDeviceStatsData(config);
          break;
        case 'trends_visualization':
          data = await this.getTrendsVisualizationData(config);
          break;
        default:
          data = { error: 'Unknown widget type' };
      }

      return {
        widgetId: widget.id,
        type: widget.type,
        data,
        timestamp: Date.now()
      };
    } catch (error) {
      this.error(`Error getting widget data for ${widget.id}:`, error);
      return {
        widgetId: widget.id,
        type: widget.type,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  // ============================================
  // WIDGET DATA PROVIDERS
  // ============================================

  async getStatusCardData(config) {
    const data = {};

    if (config.showTemperature) {
      data.temperature = await this.getAverageTemperature();
    }

    if (config.showEnergy) {
      data.energy = await this.getCurrentEnergyUsage();
    }

    if (config.showSecurity) {
      data.security = await this.getSecurityStatus();
    }

    if (config.showPresence) {
      data.presence = await this.getPresenceStatus();
    }

    return data;
  }

  async getEnergyChartData(config) {
    const period = config.period || '24h';
    const data = await this.homey.app.energyManager.getHistoricalData(period);
    
    return {
      period,
      data,
      cost: config.showCost ? await this.calculateEnergyCost(data) : null,
      comparison: config.showComparison ? await this.getEnergyComparison(period) : null
    };
  }

  async getClimatePanelData(config) {
    const zones = config.zones === 'all' 
      ? await this.getAllZones()
      : config.zones;

    const zoneData = await Promise.all(
      zones.map(async (zone) => ({
        zone,
        temperature: await this.getZoneTemperature(zone),
        humidity: config.showHumidity ? await this.getZoneHumidity(zone) : null,
        targetTemperature: await this.getZoneTargetTemperature(zone)
      }))
    );

    return { zones: zoneData };
  }

  async getSceneGridData(config) {
    const scenes = this.homey.app.scenes;
    const activeScene = this.homey.app.sceneManager.getActiveScene();

    return {
      scenes: Object.values(scenes),
      active: activeScene,
      layout: config.layout
    };
  }

  async getDeviceListData(config) {
    const devices = await this.homey.app.deviceManager.getAllDevices();
    
    let grouped = devices;
    if (config.groupBy === 'zone') {
      grouped = this.groupDevicesByZone(devices);
    } else if (config.groupBy === 'class') {
      grouped = this.groupDevicesByClass(devices);
    }

    return {
      devices: grouped,
      total: devices.length,
      online: devices.filter(d => d.available).length,
      offline: config.showOffline ? devices.filter(d => !d.available) : []
    };
  }

  async getEnergyRealtimeData(config) {
    const total = await this.getCurrentEnergyUsage();
    const perDevice = config.showPerDevice 
      ? await this.getEnergyPerDevice()
      : null;

    return {
      total,
      perDevice,
      updateInterval: config.updateInterval
    };
  }

  async getEnergyHistoryData(config) {
    const periods = config.periods || ['today', 'week', 'month'];
    const history = {};

    for (const period of periods) {
      history[period] = await this.homey.app.energyManager.getHistoricalData(period);
    }

    return {
      history,
      prediction: config.showPrediction ? await this.predictEnergyUsage() : null
    };
  }

  async getInsightsData(config) {
    const insights = await this.homey.app.intelligenceManager.getInsights();
    
    return {
      tips: config.showTips ? insights.tips : [],
      comparison: config.showComparison ? insights.comparison : null,
      goals: config.showGoals ? insights.goals : null
    };
  }

  async getTopConsumersData(config) {
    const consumers = await this.homey.app.energyManager.getTopConsumers(config.limit);
    
    return {
      consumers: consumers.map(c => ({
        ...c,
        percentage: config.showPercentage ? c.percentage : null
      }))
    };
  }

  async getCostData(config) {
    const current = await this.calculateCurrentCost();
    
    return {
      current,
      estimates: config.showEstimates ? await this.calculateCostEstimates() : null,
      savings: config.showSavings ? await this.calculatePotentialSavings() : null
    };
  }

  async getSecurityPanelData(config) {
    return await this.homey.app.securityManager.getDetailedStatus();
  }

  async getCameraGridData(config) {
    return {
      cameras: await this.getCameraFeeds(),
      motion: config.showMotion ? await this.getMotionEvents() : []
    };
  }

  async getEventTimelineData(config) {
    return await this.homey.app.securityManager.getEventLog(config.limit);
  }

  async getPresenceZonesData(config) {
    return await this.homey.app.presenceManager.getZonesStatus(config);
  }

  async getAlertsPanelData(config) {
    return await this.homey.app.securityManager.getAlerts(config.showActive);
  }

  async getAIInsightsData(config) {
    return await this.homey.app.intelligenceManager.getAIInsights(config);
  }

  async getAutomationStatsData(config) {
    return await this.homey.app.automationEngine.getStatistics();
  }

  async getDeviceStatsData(config) {
    return await this.homey.app.deviceManager.getStatistics();
  }

  async getTrendsVisualizationData(config) {
    const { metrics, period } = config;
    const trends = {};

    for (const metric of metrics) {
      trends[metric] = await this.getTrendData(metric, period);
    }

    return trends;
  }

  // ============================================
  // REAL-TIME UPDATES
  // ============================================

  /**
   * Start a 5-second interval that refreshes the in-memory real-time data
   * cache (energy, presence, security).
   *
   * @returns {void}
   */
  startRealTimeUpdates() {
    this.updateInterval = setInterval(async () => {
      await this.updateRealTimeData();
    }, 5000); // Update every 5 seconds
  }

  async updateRealTimeData() {
    // Update frequently changing data
    this.realTimeData.set('energy', await this.getCurrentEnergyUsage());
    this.realTimeData.set('presence', await this.getPresenceStatus());
    this.realTimeData.set('security', await this.getSecurityStatus());
  }

  /**
   * Return the most-recently cached real-time value for a given key.
   *
   * @param {'energy'|'presence'|'security'|string} key - Data key
   * @returns {*} Cached value, or `undefined` if not yet populated
   */
  getRealTimeData(key) {
    return this.realTimeData.get(key);
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  async getAverageTemperature() {
    const zones = await this.getAllZones();
    const temps = await Promise.all(
      zones.map(zone => this.getZoneTemperature(zone))
    );
    return temps.reduce((a, b) => a + b, 0) / temps.length;
  }

  async getCurrentEnergyUsage() {
    return await this.homey.app.energyManager.getCurrentConsumption('total');
  }

  async getSecurityStatus() {
    return await this.homey.app.securityManager.getStatus();
  }

  async getPresenceStatus() {
    return await this.homey.app.presenceManager.getStatus();
  }

  async getAllZones() {
    const zones = await this.homey.zones.getZones();
    return Object.values(zones);
  }

  async getZoneTemperature(zone) {
    // Implement zone temperature retrieval
    return 21; // Placeholder
  }

  async getZoneHumidity(zone) {
    // Implement zone humidity retrieval
    return 45; // Placeholder
  }

  async getZoneTargetTemperature(zone) {
    // Implement zone target temperature retrieval
    return 21; // Placeholder
  }

  groupDevicesByZone(devices) {
    const grouped = {};
    devices.forEach(device => {
      const zone = device.zone?.name || 'Unknown';
      if (!grouped[zone]) grouped[zone] = [];
      grouped[zone].push(device);
    });
    return grouped;
  }

  groupDevicesByClass(devices) {
    const grouped = {};
    devices.forEach(device => {
      const cls = device.class || 'other';
      if (!grouped[cls]) grouped[cls] = [];
      grouped[cls].push(device);
    });
    return grouped;
  }

  async getEnergyPerDevice() {
    return await this.homey.app.energyManager.getDeviceConsumption();
  }

  async predictEnergyUsage() {
    return await this.homey.app.intelligenceManager.predictEnergy();
  }

  async calculateEnergyCost(data) {
    const pricePerKwh = 1.5; // Example price
    return data.total * pricePerKwh;
  }

  async getEnergyComparison(period) {
    return await this.homey.app.energyManager.getComparison(period);
  }

  async calculateCurrentCost() {
    const usage = await this.getCurrentEnergyUsage();
    return usage * 1.5; // Example calculation
  }

  async calculateCostEstimates() {
    return {
      today: 45,
      week: 315,
      month: 1350
    };
  }

  async calculatePotentialSavings() {
    return await this.homey.app.intelligenceManager.calculateSavings();
  }

  async getCameraFeeds() {
    // Implement camera feed retrieval
    return [];
  }

  async getMotionEvents() {
    // Implement motion event retrieval
    return [];
  }

  async getTrendData(metric, period) {
    // Implement trend data retrieval
    return [];
  }

  generateId() {
    return `dash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async saveDashboards() {
    const data = {};
    this.dashboardLayouts.forEach((dashboard, id) => {
      data[id] = dashboard;
    });
    await this.homey.settings.set('dashboardLayouts', data);
  }

  log(...args) {
    console.log('[IntelligentDashboard]', ...args);
  }

  error(...args) {
    console.error('[IntelligentDashboard]', ...args);
  }
}

module.exports = IntelligentDashboard;
