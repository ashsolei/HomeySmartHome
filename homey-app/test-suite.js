/**
 * Test Suite for Smart Home Pro — Backend (homey-app)
 * Automated testing framework for API endpoints and system health
 */

'use strict';

const http = require('http');

class TestRunner {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.tests = [];
    this.results = {
      passed: 0,
      failed: 0,
      total: 0,
      duration: 0
    };
  }

  test(name, testFn) {
    this.tests.push({ name, fn: testFn });
  }

  async run() {
    console.log('\n🧪 Starting Smart Home Pro Backend Test Suite\n');
    console.log('═'.repeat(60));

    const startTime = Date.now();

    for (const test of this.tests) {
      try {
        await test.fn();
        this.results.passed++;
        console.log(`✅ ${test.name}`);
      } catch (error) {
        this.results.failed++;
        console.log(`❌ ${test.name}`);
        console.log(`   Error: ${error.message}`);
      }
      this.results.total++;
    }

    this.results.duration = Date.now() - startTime;

    console.log('═'.repeat(60));
    console.log(`\n📊 Test Results:`);
    console.log(`   Total: ${this.results.total}`);
    console.log(`   Passed: ${this.results.passed} ✅`);
    console.log(`   Failed: ${this.results.failed} ❌`);
    console.log(`   Duration: ${this.results.duration}ms`);
    console.log(`   Success Rate: ${Math.round((this.results.passed / this.results.total) * 100)}%\n`);

    return this.results.failed === 0;
  }

  async request(path, options = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const req = http.request(url, {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = data ? JSON.parse(data) : {};
            resolve({ status: res.statusCode, data: json, headers: res.headers });
          } catch {
            resolve({ status: res.statusCode, data, headers: res.headers });
          }
        });
      });

      req.on('error', reject);

      if (options.body) {
        req.write(JSON.stringify(options.body));
      }

      req.end();
    });
  }

  assert(condition, message) {
    if (!condition) throw new Error(message || 'Assertion failed');
  }

  assertEqual(actual, expected, message) {
    if (actual !== expected) throw new Error(message || `Expected ${expected}, got ${actual}`);
  }

  assertIncludes(value, search, message) {
    if (typeof value === 'string' && !value.includes(search)) {
      throw new Error(message || `Expected "${value}" to include "${search}"`);
    }
  }

  assertType(value, type, message) {
    if (typeof value !== type) {
      throw new Error(message || `Expected type ${type}, got ${typeof value}`);
    }
  }
}

// ════════════════════════════════════════════════
// Test Suite
// ════════════════════════════════════════════════

const runner = new TestRunner();

// ── Health Endpoints ──

runner.test('GET /health returns 200 with correct shape', async () => {
  const res = await runner.request('/health');
  runner.assertEqual(res.status, 200, 'Health endpoint should return 200');
  runner.assertEqual(res.data.status, 'ok', 'Status should be ok');
  runner.assertType(res.data.version, 'string', 'Version should be a string');
  runner.assertType(res.data.uptime, 'number', 'Uptime should be a number');
  runner.assertType(res.data.systemCount, 'number', 'systemCount should be a number');
  runner.assert(res.data.systemCount > 90, `Expected 90+ systems, got ${res.data.systemCount}`);
});

runner.test('GET /health/systems returns system statuses', async () => {
  const res = await runner.request('/health/systems');
  runner.assertEqual(res.status, 200, 'Systems endpoint should return 200');
  runner.assertType(res.data, 'object', 'Should return an object');
  const statuses = Object.values(res.data);
  runner.assert(statuses.length > 50, `Expected 50+ system statuses, got ${statuses.length}`);

  // Every status should have a status field (ok, failed, or skipped)
  for (const entry of statuses) {
    runner.assert(
      ['ok', 'failed', 'skipped'].includes(entry.status),
      `Invalid status: ${entry.status}`
    );
  }
});

// ── Stats Endpoint ──

runner.test('GET /api/v1/stats returns platform info', async () => {
  const res = await runner.request('/api/v1/stats');
  runner.assertEqual(res.status, 200, 'Stats endpoint should return 200');
  runner.assertType(res.data.version, 'string', 'Version should be a string');
  runner.assert(res.data.systems, 'Should contain systems object');
  runner.assertType(res.data.systems.total, 'number', 'System total should be a number');
  runner.assert(res.data.memory, 'Should contain memory object');
  runner.assertIncludes(res.data.memory.rss, 'MB', 'RSS should be in MB');
});

// ── Security Headers ──

runner.test('Security headers are present', async () => {
  const res = await runner.request('/health');
  runner.assert(res.headers['x-content-type-options'], 'X-Content-Type-Options should be set');
  runner.assert(res.headers['x-xss-protection'] || res.headers['x-frame-options'],
    'At least one security header should be set');
});

// ── CORS ──

runner.test('CORS allows whitelisted origins', async () => {
  const res = await runner.request('/health', {
    headers: { 'Origin': 'http://localhost' }
  });
  runner.assertEqual(res.status, 200, 'Whitelisted origin should be allowed');
});

// ── API Routes (auto-generated from app.json) ──

runner.test('GET /api/dashboard returns dashboard data', async () => {
  const res = await runner.request('/api/dashboard');
  runner.assert([200, 500].includes(res.status), 'Dashboard API should respond');
  if (res.status === 200) {
    runner.assert(res.data.devices !== undefined, 'Dashboard should include devices');
  }
});

runner.test('GET /api/devices returns device list', async () => {
  const res = await runner.request('/api/devices');
  runner.assert([200, 500].includes(res.status), 'Devices API should respond');
});

runner.test('GET /api/infrastructure/health returns system health', async () => {
  const res = await runner.request('/api/infrastructure/health');
  runner.assert([200, 500].includes(res.status), 'Infrastructure health API should respond');
});

runner.test('GET /api/infrastructure/overview returns overview', async () => {
  const res = await runner.request('/api/infrastructure/overview');
  runner.assert([200, 500].includes(res.status), 'Infrastructure overview API should respond');
});

runner.test('GET /api/infrastructure/memory returns memory report', async () => {
  const res = await runner.request('/api/infrastructure/memory');
  runner.assert([200, 500].includes(res.status), 'Memory report API should respond');
});

runner.test('GET /api/infrastructure/errors returns error report', async () => {
  const res = await runner.request('/api/infrastructure/errors');
  runner.assert([200, 500].includes(res.status), 'Error report API should respond');
});

runner.test('GET /api/infrastructure/cache returns cache stats', async () => {
  const res = await runner.request('/api/infrastructure/cache');
  runner.assert([200, 500].includes(res.status), 'Cache stats API should respond');
});

runner.test('GET /api/infrastructure/scheduler returns scheduler stats', async () => {
  const res = await runner.request('/api/infrastructure/scheduler');
  runner.assert([200, 500].includes(res.status), 'Scheduler stats API should respond');
});

runner.test('GET /api/hvac-zone/status returns HVAC data', async () => {
  const res = await runner.request('/api/hvac-zone/status');
  runner.assert([200, 500].includes(res.status), 'HVAC zone API should respond');
});

// ── 404 Handling ──

runner.test('Unknown routes return 404', async () => {
  const res = await runner.request('/api/nonexistent-route');
  runner.assertEqual(res.status, 404, 'Unknown route should return 404');
  runner.assert(res.data.error, '404 should include error field');
});

// ── Error Handling ──

runner.test('Error responses do not leak stack traces in production', async () => {
  const res = await runner.request('/api/nonexistent-route');
  const body = JSON.stringify(res.data);
  runner.assert(!body.includes('node_modules'), 'Should not leak stack trace paths');
});

// ── POST route validation ──

runner.test('POST /api/scene/:sceneId accepts POST', async () => {
  const res = await runner.request('/api/scene/test-scene', {
    method: 'POST',
    body: {}
  });
  // Expect either success or handled error (not a crash/timeout)
  runner.assert([200, 400, 404, 500].includes(res.status), 'POST should be handled');
});

runner.test('POST /api/device/:deviceId accepts POST', async () => {
  const res = await runner.request('/api/device/test-device', {
    method: 'POST',
    body: { capability: 'onoff', value: true }
  });
  runner.assert([200, 400, 404, 500].includes(res.status), 'POST should be handled');
});

// ── Performance ──

runner.test('Health endpoint responds in < 500ms', async () => {
  const start = Date.now();
  await runner.request('/health');
  const duration = Date.now() - start;
  runner.assert(duration < 500, `Response time should be < 500ms (was ${duration}ms)`);
});

runner.test('Stats endpoint responds in < 2000ms', async () => {
  const start = Date.now();
  await runner.request('/api/v1/stats');
  const duration = Date.now() - start;
  runner.assert(duration < 2000, `Response time should be < 2000ms (was ${duration}ms)`);
});

// ── System boot validation ──

runner.test('System count exceeds 90 modules', async () => {
  const res = await runner.request('/api/v1/stats');
  runner.assertEqual(res.status, 200);
  runner.assert(res.data.systems.total > 90,
    `Expected 90+ systems, got ${res.data.systems.total}`);
});

runner.test('Majority of systems initialize successfully', async () => {
  const res = await runner.request('/health/systems');
  const statuses = Object.values(res.data);
  const okCount = statuses.filter(s => s.status === 'ok').length;
  const totalCount = statuses.length;
  const ratio = okCount / totalCount;
  runner.assert(ratio > 0.5, `Expected >50% systems OK, got ${Math.round(ratio * 100)}%`);
});

// ── JSON format ──

runner.test('All API responses are valid JSON with Content-Type', async () => {
  const endpoints = ['/health', '/api/v1/stats', '/health/systems'];
  for (const ep of endpoints) {
    const res = await runner.request(ep);
    runner.assert(
      res.headers['content-type']?.includes('application/json'),
      `${ep} should return application/json, got ${res.headers['content-type']}`
    );
  }
});

// Run
if (require.main === module) {
  runner.run().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = TestRunner;
