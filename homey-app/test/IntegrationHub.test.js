'use strict';

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertType } = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');

const _origSetTimeout = global.setTimeout;
const _origSetInterval = global.setInterval;
const activeHandles = [];
global.setTimeout = (...a) => { const id = _origSetTimeout(...a); activeHandles.push({ type: 'timeout', id }); return id; };
global.setInterval = (...a) => { const id = _origSetInterval(...a); activeHandles.push({ type: 'interval', id }); return id; };
function cleanup(sys) {
  try {
    if (sys && sys.webhookServer) sys.webhookServer.close();
  } catch (_) {}
  try { if (sys && typeof sys.destroy === 'function') sys.destroy(); } catch (_) {}
  while (activeHandles.length > 0) {
    const h = activeHandles.pop();
    if (h.type === 'timeout') clearTimeout(h.id); else clearInterval(h.id);
  }
}

const IntegrationHub = require('../lib/IntegrationHub');

describe('IntegrationHub — constructor & init', () => {
  it('instantiates without errors', () => {
    const sys = new IntegrationHub(createMockHomey());
    assert(sys, 'should create instance');
    assertEqual(sys.integrations.size, 0);
    assertEqual(sys.webhooks.size, 0);
    assertEqual(sys.apiConnectors.size, 0);
    cleanup(sys);
  });

  it('initialize starts webhook server', async () => {
    const sys = new IntegrationHub(createMockHomey());
    await sys.initialize();
    assert(sys.webhookServer, 'should have webhook server');
    cleanup(sys);
  });
});

describe('IntegrationHub — webhooks', () => {
  it('createWebhook adds webhook', async () => {
    const sys = new IntegrationHub(createMockHomey());
    await sys.initialize();
    const webhook = await sys.createWebhook({ name: 'Test Hook', actions: [] });
    assert(webhook, 'should return webhook');
    assert(webhook.id, 'should have id');
    assert(webhook.url, 'should have url');
    assertEqual(webhook.name, 'Test Hook');
    assertEqual(webhook.enabled, true);
    assertEqual(webhook.callCount, 0);
    assert(sys.webhooks.has(webhook.id), 'should be stored');
    cleanup(sys);
  });

  it('createWebhook generates secret', async () => {
    const sys = new IntegrationHub(createMockHomey());
    await sys.initialize();
    const webhook = await sys.createWebhook({ name: 'Secret Hook', actions: [] });
    assert(webhook.secret, 'should have a secret');
    assertType(webhook.secret, 'string');
    cleanup(sys);
  });

  it('getWebhookUrl returns valid url', async () => {
    const sys = new IntegrationHub(createMockHomey());
    await sys.initialize();
    const url = sys.getWebhookUrl('test-id');
    assert(url.includes('test-id'), 'url should contain webhook id');
    cleanup(sys);
  });
});

describe('IntegrationHub — API connectors', () => {
  it('createApiConnector adds connector', async () => {
    const sys = new IntegrationHub(createMockHomey());
    await sys.initialize();
    const connector = await sys.createApiConnector({
      name: 'Test API',
      baseUrl: 'https://api.example.com',
      headers: { 'X-Custom': 'value' },
      timeout: 5000
    });
    assert(connector, 'should return connector');
    assert(connector.id, 'should have id');
    assertEqual(connector.name, 'Test API');
    assertEqual(connector.baseUrl, 'https://api.example.com');
    assertEqual(connector.timeout, 5000);
    assert(sys.apiConnectors.has(connector.id), 'should be stored');
    cleanup(sys);
  });

  it('createApiConnector uses defaults', async () => {
    const sys = new IntegrationHub(createMockHomey());
    await sys.initialize();
    const connector = await sys.createApiConnector({ name: 'Min', baseUrl: 'http://x.com' });
    assertEqual(connector.timeout, 30000);
    assertEqual(connector.retries, 3);
    cleanup(sys);
  });
});

describe('IntegrationHub — automations', () => {
  it('createAutomation adds automation', async () => {
    const sys = new IntegrationHub(createMockHomey());
    await sys.initialize();
    const automation = await sys.createAutomation({
      name: 'Test Auto',
      trigger: { type: 'time' },
      actions: []
    });
    assert(automation, 'should return automation');
    assert(automation.id, 'should have id');
    assertEqual(automation.name, 'Test Auto');
    assertEqual(automation.enabled, true);
    assertEqual(automation.executionCount, 0);
    assert(sys.integrations.has(automation.id), 'should be stored');
    cleanup(sys);
  });

  it('createAutomation respects enabled flag', async () => {
    const sys = new IntegrationHub(createMockHomey());
    await sys.initialize();
    const automation = await sys.createAutomation({
      name: 'Disabled',
      enabled: false,
      trigger: { type: 'webhook' },
      actions: []
    });
    assertEqual(automation.enabled, false);
    cleanup(sys);
  });
});

describe('IntegrationHub — OAuth', () => {
  it('initiateOAuth returns session', async () => {
    const sys = new IntegrationHub(createMockHomey());
    await sys.initialize();
    const result = await sys.initiateOAuth('google');
    assert(result, 'should return result');
    assert(result.sessionId, 'should have sessionId');
    assert(result.authUrl, 'should have authUrl');
    assert(result.state, 'should have state');
    assert(sys.oauthSessions.has(result.sessionId), 'should store session');
    cleanup(sys);
  });

  it('handleOAuthCallback completes session', async () => {
    const sys = new IntegrationHub(createMockHomey());
    await sys.initialize();
    const { state } = await sys.initiateOAuth('github');
    const session = await sys.handleOAuthCallback('test-code', state);
    assertEqual(session.status, 'completed');
    assert(session.tokens, 'should have tokens');
    assert(session.tokens.accessToken, 'should have access token');
    cleanup(sys);
  });

  it('handleOAuthCallback rejects invalid state', async () => {
    const sys = new IntegrationHub(createMockHomey());
    await sys.initialize();
    try {
      await sys.handleOAuthCallback('code', 'invalid-state');
      assert(false, 'should have thrown');
    } catch (e) {
      assert(e.message.includes('Invalid'), 'should mention invalid');
    }
    cleanup(sys);
  });
});

describe('IntegrationHub — helpers & statistics', () => {
  it('getStatistics returns counts', async () => {
    const sys = new IntegrationHub(createMockHomey());
    await sys.initialize();
    await sys.createWebhook({ name: 'W1', actions: [] });
    await sys.createApiConnector({ name: 'C1', baseUrl: 'http://x.com' });
    await sys.createAutomation({ name: 'A1', trigger: { type: 'time' }, actions: [] });
    const stats = sys.getStatistics();
    assertType(stats.integrations, 'number');
    assertType(stats.webhooks, 'number');
    assertType(stats.apiConnectors, 'number');
    assert(stats.webhooks >= 1, 'should have at least 1 webhook');
    assert(stats.apiConnectors >= 1, 'should have at least 1 connector');
    cleanup(sys);
  });

  it('parseWebhookBody handles JSON', () => {
    const sys = new IntegrationHub(createMockHomey());
    const data = sys.parseWebhookBody('{"key":"value"}', 'application/json');
    assertEqual(data.key, 'value');
    cleanup(sys);
  });

  it('parseWebhookBody handles empty body', () => {
    const sys = new IntegrationHub(createMockHomey());
    const data = sys.parseWebhookBody('', 'application/json');
    assert(data !== null, 'should return object');
    cleanup(sys);
  });

  it('parseWebhookBody handles form-urlencoded', () => {
    const sys = new IntegrationHub(createMockHomey());
    const data = sys.parseWebhookBody('a=1&b=2', 'application/x-www-form-urlencoded');
    assertEqual(data.a, '1');
    assertEqual(data.b, '2');
    cleanup(sys);
  });

  it('transformWebhookData with no transforms returns data', () => {
    const sys = new IntegrationHub(createMockHomey());
    const data = sys.transformWebhookData({ x: 1 }, []);
    assertEqual(data.x, 1);
    cleanup(sys);
  });

  it('getNestedValue resolves paths', () => {
    const sys = new IntegrationHub(createMockHomey());
    const val = sys.getNestedValue({ a: { b: { c: 42 } } }, 'a.b.c');
    assertEqual(val, 42);
    cleanup(sys);
  });

  it('convertValue converts types', () => {
    const sys = new IntegrationHub(createMockHomey());
    assertEqual(sys.convertValue('42', 'number'), 42);
    assertEqual(sys.convertValue(42, 'string'), '42');
    assertEqual(sys.convertValue(1, 'boolean'), true);
    cleanup(sys);
  });

  it('interpolateString replaces placeholders', () => {
    const sys = new IntegrationHub(createMockHomey());
    const result = sys.interpolateString('Hello {{name}}!', { name: 'World' });
    assertEqual(result, 'Hello World!');
    cleanup(sys);
  });
});

run();
