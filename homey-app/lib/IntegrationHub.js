'use strict';

const http = require('http');
const crypto = require('crypto');

/**
 * Integration Hub
 * External service integration with webhooks, API connectors, and OAuth
 */
class IntegrationHub {
  constructor(homey) {
    this.homey = homey;
    this.integrations = new Map();
    this.webhooks = new Map();
    this.apiConnectors = new Map();
    this.webhookServer = null;
    this.oauthSessions = new Map();
  }

  async initialize() {
    this.log('Initializing Integration Hub...');
    
    // Load integrations
    const savedIntegrations = await this.homey.settings.get('integrations') || {};
    Object.entries(savedIntegrations).forEach(([id, integration]) => {
      this.integrations.set(id, integration);
    });

    // Load webhooks
    const savedWebhooks = await this.homey.settings.get('webhooks') || {};
    Object.entries(savedWebhooks).forEach(([id, webhook]) => {
      this.webhooks.set(id, webhook);
    });

    // Load API connectors
    const savedConnectors = await this.homey.settings.get('apiConnectors') || {};
    Object.entries(savedConnectors).forEach(([id, connector]) => {
      this.apiConnectors.set(id, connector);
    });

    // Start webhook server
    await this.startWebhookServer();

    // Setup default integrations
    await this.setupDefaultIntegrations();
    
    this.log('Integration Hub initialized');
  }

  /**
   * Setup default integration templates
   */
  async setupDefaultIntegrations() {
    // IFTTT-style automation templates
    this.addIntegrationTemplate({
      id: 'ifttt_style',
      name: 'IFTTT-Style Automation',
      description: 'If This Then That style automation',
      type: 'automation',
      triggers: ['device', 'time', 'weather', 'location'],
      actions: ['device', 'notification', 'webhook']
    });

    // Weather service
    this.addIntegrationTemplate({
      id: 'weather_service',
      name: 'Weather Service',
      description: 'Integrate weather data',
      type: 'api',
      endpoints: {
        current: '/weather/current',
        forecast: '/weather/forecast'
      }
    });

    // Home Assistant
    this.addIntegrationTemplate({
      id: 'home_assistant',
      name: 'Home Assistant',
      description: 'Connect to Home Assistant',
      type: 'api',
      auth: 'bearer_token'
    });
  }

  /**
   * Start webhook server
   */
  async startWebhookServer() {
    const port = 8080;

    this.webhookServer = http.createServer(async (req, res) => {
      await this.handleWebhookRequest(req, res);
    });

    this.webhookServer.listen(port, () => {
      this.log(`Webhook server listening on port ${port}`);
    });
  }

  /**
   * Handle incoming webhook request
   */
  async handleWebhookRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

    // Parse webhook ID from path
    const match = path.match(/\/webhook\/([a-zA-Z0-9_-]+)/);
    if (!match) {
      res.writeHead(404);
      res.end('Webhook not found');
      return;
    }

    const webhookId = match[1];
    const webhook = this.webhooks.get(webhookId);

    if (!webhook || !webhook.enabled) {
      res.writeHead(404);
      res.end('Webhook not found or disabled');
      return;
    }

    // Collect request body
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        // Verify signature if configured
        if (webhook.secret) {
          const isValid = this.verifyWebhookSignature(req, body, webhook.secret);
          if (!isValid) {
            res.writeHead(401);
            res.end('Invalid signature');
            return;
          }
        }

        // Parse body
        const data = this.parseWebhookBody(body, req.headers['content-type']);

        // Process webhook
        const result = await this.processWebhook(webhook, data, req);

        // Record webhook call
        webhook.lastCalled = Date.now();
        webhook.callCount = (webhook.callCount || 0) + 1;
        await this.saveWebhooks();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));

      } catch (error) {
        this.error('Webhook processing error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: error.message }));
      }
    });
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(req, body, secret) {
    const signature = req.headers['x-webhook-signature'];
    if (!signature) return false;

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    return signature === expectedSignature;
  }

  /**
   * Parse webhook body
   */
  parseWebhookBody(body, contentType) {
    if (!body) return {};

    if (contentType && contentType.includes('application/json')) {
      try {
        return JSON.parse(body);
      } catch {
        return {};
      }
    }

    // URL encoded
    if (contentType && contentType.includes('application/x-www-form-urlencoded')) {
      const params = new URLSearchParams(body);
      const data = {};
      for (const [key, value] of params) {
        data[key] = value;
      }
      return data;
    }

    return { raw: body };
  }

  /**
   * Process webhook
   */
  async processWebhook(webhook, data, req) {
    this.log(`Processing webhook: ${webhook.name}`);

    // Apply transformations
    const transformedData = this.transformWebhookData(data, webhook.transformations);

    // Execute actions
    const results = [];
    for (const action of webhook.actions) {
      const result = await this.executeWebhookAction(action, transformedData);
      results.push(result);
    }

    // Trigger flow card
    const trigger = this.homey.flow.getTriggerCard('webhook_received');
    if (trigger) {
      await trigger.trigger({
        webhookId: webhook.id,
        webhookName: webhook.name,
        data: JSON.stringify(transformedData)
      });
    }

    return {
      success: true,
      webhook: webhook.name,
      actionsExecuted: results.length,
      results
    };
  }

  /**
   * Transform webhook data
   */
  transformWebhookData(data, transformations) {
    if (!transformations || transformations.length === 0) {
      return data;
    }

    let result = { ...data };

    for (const transform of transformations) {
      switch (transform.type) {
        case 'map':
          result[transform.to] = this.getNestedValue(result, transform.from);
          break;

        case 'filter':
          result = this.filterObject(result, transform.keys);
          break;

        case 'convert':
          const value = this.getNestedValue(result, transform.field);
          result[transform.field] = this.convertValue(value, transform.toType);
          break;

        default:
          break;
      }
    }

    return result;
  }

  /**
   * Execute webhook action
   */
  async executeWebhookAction(action, data) {
    switch (action.type) {
      case 'device':
        return await this.executeDeviceAction(action, data);

      case 'scene':
        return await this.executeSceneAction(action, data);

      case 'notification':
        return await this.executeNotificationAction(action, data);

      case 'flow':
        return await this.executeFlowAction(action, data);

      case 'api_call':
        return await this.executeApiCall(action, data);

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  async executeDeviceAction(action, data) {
    const device = await this.homey.devices.getDevice({ id: action.deviceId });
    const value = action.value || this.getNestedValue(data, action.valueFrom);
    
    await device.setCapabilityValue(action.capability, value);
    
    return { success: true, action: 'device', device: device.name };
  }

  async executeSceneAction(action, data) {
    const sceneManager = this.homey.app.sceneManager;
    await sceneManager.activateScene(action.sceneId);
    
    return { success: true, action: 'scene' };
  }

  async executeNotificationAction(action, data) {
    const message = this.interpolateString(action.message, data);
    
    await this.homey.notifications.createNotification({
      excerpt: message
    });
    
    return { success: true, action: 'notification' };
  }

  async executeFlowAction(action, data) {
    const trigger = this.homey.flow.getTriggerCard(action.flowId);
    await trigger.trigger(data);
    
    return { success: true, action: 'flow' };
  }

  async executeApiCall(action, data) {
    const connector = this.apiConnectors.get(action.connectorId);
    if (!connector) {
      throw new Error('API connector not found');
    }

    return await this.makeApiCall(connector, action.endpoint, action.method, data);
  }

  /**
   * Create webhook
   */
  async createWebhook(webhookData) {
    const webhook = {
      id: this.generateWebhookId(),
      name: webhookData.name,
      description: webhookData.description,
      enabled: webhookData.enabled !== false,
      secret: webhookData.secret || this.generateSecret(),
      actions: webhookData.actions || [],
      transformations: webhookData.transformations || [],
      created: Date.now(),
      callCount: 0,
      lastCalled: null
    };

    this.webhooks.set(webhook.id, webhook);
    await this.saveWebhooks();

    return {
      ...webhook,
      url: this.getWebhookUrl(webhook.id)
    };
  }

  /**
   * Get webhook URL
   */
  getWebhookUrl(webhookId) {
    // Would use actual Homey URL
    return `http://homey.local:8080/webhook/${webhookId}`;
  }

  /**
   * Create API connector
   */
  async createApiConnector(connectorData) {
    const connector = {
      id: this.generateConnectorId(),
      name: connectorData.name,
      baseUrl: connectorData.baseUrl,
      auth: connectorData.auth || {},
      headers: connectorData.headers || {},
      timeout: connectorData.timeout || 30000,
      retries: connectorData.retries || 3,
      created: Date.now()
    };

    this.apiConnectors.set(connector.id, connector);
    await this.saveConnectors();

    return connector;
  }

  /**
   * Make API call
   */
  async makeApiCall(connector, endpoint, method = 'GET', data = null) {
    const url = `${connector.baseUrl}${endpoint}`;
    const headers = { ...connector.headers };

    // Add authentication
    if (connector.auth.type === 'bearer') {
      headers['Authorization'] = `Bearer ${connector.auth.token}`;
    } else if (connector.auth.type === 'api_key') {
      headers[connector.auth.headerName] = connector.auth.apiKey;
    } else if (connector.auth.type === 'basic') {
      const credentials = Buffer.from(`${connector.auth.username}:${connector.auth.password}`).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
    }

    const options = {
      method,
      headers
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(data);
      headers['Content-Type'] = 'application/json';
    }

    let lastError;
    for (let attempt = 0; attempt < connector.retries; attempt++) {
      try {
        const response = await fetch(url, options);
        
        if (!response.ok) {
          throw new Error(`API call failed: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        return { success: true, data: result };

      } catch (error) {
        lastError = error;
        this.error(`API call attempt ${attempt + 1} failed:`, error);
        
        if (attempt < connector.retries - 1) {
          await this.sleep(1000 * (attempt + 1)); // Exponential backoff
        }
      }
    }

    throw lastError;
  }

  /**
   * Create IFTTT-style automation
   */
  async createAutomation(automationData) {
    const automation = {
      id: this.generateAutomationId(),
      name: automationData.name,
      enabled: automationData.enabled !== false,
      trigger: automationData.trigger,
      conditions: automationData.conditions || [],
      actions: automationData.actions || [],
      created: Date.now(),
      executionCount: 0
    };

    // Setup trigger listener
    await this.setupAutomationTrigger(automation);

    this.integrations.set(automation.id, automation);
    await this.saveIntegrations();

    return automation;
  }

  /**
   * Setup automation trigger
   */
  async setupAutomationTrigger(automation) {
    const trigger = automation.trigger;

    switch (trigger.type) {
      case 'device':
        await this.setupDeviceTrigger(automation);
        break;

      case 'time':
        await this.setupTimeTrigger(automation);
        break;

      case 'webhook':
        await this.setupWebhookTrigger(automation);
        break;

      case 'location':
        await this.setupLocationTrigger(automation);
        break;

      default:
        this.log(`Unknown trigger type: ${trigger.type}`);
    }
  }

  async setupDeviceTrigger(automation) {
    const device = await this.homey.devices.getDevice({ id: automation.trigger.deviceId });
    
    device.on('capability.value', async (capability, value) => {
      if (capability === automation.trigger.capability) {
        await this.evaluateAutomation(automation, { device, capability, value });
      }
    });
  }

  async setupTimeTrigger(automation) {
    // Would use scheduling system
    this.log('Time trigger setup:', automation.name);
  }

  async setupWebhookTrigger(automation) {
    // Webhook triggers are handled by webhook system
    this.log('Webhook trigger setup:', automation.name);
  }

  async setupLocationTrigger(automation) {
    // Would use geofencing engine
    this.log('Location trigger setup:', automation.name);
  }

  /**
   * Evaluate automation
   */
  async evaluateAutomation(automation, triggerData) {
    if (!automation.enabled) return;

    // Check conditions
    for (const condition of automation.conditions) {
      const met = await this.evaluateCondition(condition, triggerData);
      if (!met) return;
    }

    // Execute actions
    for (const action of automation.actions) {
      await this.executeWebhookAction(action, triggerData);
    }

    automation.executionCount++;
    await this.saveIntegrations();
  }

  async evaluateCondition(condition, data) {
    // Similar to scheduling system condition evaluation
    return true;
  }

  /**
   * OAuth flow initiation
   */
  async initiateOAuth(provider) {
    const sessionId = this.generateSessionId();
    const state = crypto.randomBytes(16).toString('hex');

    const session = {
      sessionId,
      provider,
      state,
      created: Date.now(),
      status: 'pending'
    };

    this.oauthSessions.set(sessionId, session);

    // Generate authorization URL
    const authUrl = this.buildOAuthUrl(provider, state);

    return {
      sessionId,
      authUrl,
      state
    };
  }

  /**
   * Build OAuth authorization URL
   */
  buildOAuthUrl(provider, state) {
    // Would build actual OAuth URL based on provider configuration
    return `https://oauth.example.com/authorize?state=${state}`;
  }

  /**
   * Handle OAuth callback
   */
  async handleOAuthCallback(code, state) {
    const session = Array.from(this.oauthSessions.values())
      .find(s => s.state === state);

    if (!session) {
      throw new Error('Invalid OAuth session');
    }

    // Exchange code for token
    const tokens = await this.exchangeOAuthCode(session.provider, code);

    session.status = 'completed';
    session.tokens = tokens;

    return session;
  }

  async exchangeOAuthCode(provider, code) {
    // Would exchange code for access token
    return {
      accessToken: 'mock_access_token',
      refreshToken: 'mock_refresh_token',
      expiresIn: 3600
    };
  }

  /**
   * Get integration statistics
   */
  getStatistics() {
    return {
      integrations: this.integrations.size,
      webhooks: this.webhooks.size,
      apiConnectors: this.apiConnectors.size,
      webhookCalls: Array.from(this.webhooks.values())
        .reduce((sum, w) => sum + (w.callCount || 0), 0),
      activeAutomations: Array.from(this.integrations.values())
        .filter(i => i.enabled).length
    };
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  filterObject(obj, keys) {
    const filtered = {};
    for (const key of keys) {
      if (obj.hasOwnProperty(key)) {
        filtered[key] = obj[key];
      }
    }
    return filtered;
  }

  convertValue(value, toType) {
    switch (toType) {
      case 'number':
        return Number(value);
      case 'string':
        return String(value);
      case 'boolean':
        return Boolean(value);
      default:
        return value;
    }
  }

  interpolateString(template, data) {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      return this.getNestedValue(data, path.trim()) || match;
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  generateWebhookId() {
    return crypto.randomBytes(16).toString('hex');
  }

  generateConnectorId() {
    return `connector_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateAutomationId() {
    return `auto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateSessionId() {
    return crypto.randomBytes(16).toString('hex');
  }

  generateSecret() {
    return crypto.randomBytes(32).toString('hex');
  }

  addIntegrationTemplate(template) {
    // Store templates for UI
    this.log('Added integration template:', template.name);
  }

  async saveIntegrations() {
    const data = {};
    this.integrations.forEach((integration, id) => {
      data[id] = integration;
    });
    await this.homey.settings.set('integrations', data);
  }

  async saveWebhooks() {
    const data = {};
    this.webhooks.forEach((webhook, id) => {
      data[id] = webhook;
    });
    await this.homey.settings.set('webhooks', data);
  }

  async saveConnectors() {
    const data = {};
    this.apiConnectors.forEach((connector, id) => {
      data[id] = connector;
    });
    await this.homey.settings.set('apiConnectors', data);
  }

  log(...args) {
    console.log('[IntegrationHub]', ...args);
  }

  error(...args) {
    console.error('[IntegrationHub]', ...args);
  }
}

module.exports = IntegrationHub;
