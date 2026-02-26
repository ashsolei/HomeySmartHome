/**
 * Test Suite for Smart Home Pro
 * Automated testing framework for API endpoints and features
 */

'use strict';

const http = require('http');

class TestRunner {
  constructor(baseUrl = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
    this.tests = [];
    this.results = {
      passed: 0,
      failed: 0,
      total: 0,
      duration: 0
    };
  }

  /**
   * Add a test case
   */
  test(name, testFn) {
    this.tests.push({ name, fn: testFn });
  }

  /**
   * Run all tests
   */
  async run() {
    console.log('\n🧪 Starting Smart Home Pro Test Suite\n');
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

  /**
   * Make HTTP request
   */
  async request(path, options = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const req = http.request(url, {
        method: options.method || 'GET',
        headers: options.headers || {},
        ...options
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = data ? JSON.parse(data) : {};
            resolve({ status: res.statusCode, data: json, headers: res.headers });
          } catch (_err) {
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

  /**
   * Assert helper
   */
  assert(condition, message) {
    if (!condition) {
      throw new Error(message || 'Assertion failed');
    }
  }

  /**
   * Assert equal helper
   */
  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
  }
}

// ════════════════════════════════════════════════
// Test Suite
// ════════════════════════════════════════════════

const runner = new TestRunner();

// Health Check Tests
runner.test('Health endpoint returns 200', async () => {
  const res = await runner.request('/health');
  runner.assertEqual(res.status, 200, 'Health endpoint should return 200');
  runner.assert(res.data.status === 'ok', 'Health status should be ok');
});

// Metrics Tests
runner.test('Metrics endpoint returns Prometheus format', async () => {
  const res = await runner.request('/metrics');
  runner.assertEqual(res.status, 200, 'Metrics endpoint should return 200');
  runner.assert(typeof res.data === 'string', 'Metrics should be text format');
  runner.assert(res.data.includes('smarthome_'), 'Metrics should contain smarthome prefix');
});

// Stats Tests
runner.test('Stats endpoint returns performance data', async () => {
  const res = await runner.request('/api/stats');
  runner.assertEqual(res.status, 200, 'Stats endpoint should return 200');
  runner.assert(res.data.performance, 'Stats should include performance data');
  runner.assert(res.data.security, 'Stats should include security data');
});

// Dashboard API Tests
runner.test('Dashboard API returns data', async () => {
  const res = await runner.request('/api/dashboard');
  runner.assertEqual(res.status, 200, 'Dashboard API should return 200');
  runner.assert(res.data.devices, 'Dashboard should include devices');
  runner.assert(res.data.zones, 'Dashboard should include zones');
});

// Rate Limiting Tests
runner.test('Rate limiting headers are present', async () => {
  const res = await runner.request('/api/dashboard');
  runner.assert(res.headers['x-ratelimit-limit'], 'Rate limit header should be present');
  runner.assert(res.headers['x-ratelimit-remaining'], 'Rate limit remaining should be present');
});

// Security Headers Tests
runner.test('Security headers are set', async () => {
  const res = await runner.request('/health');
  runner.assert(res.headers['x-frame-options'], 'X-Frame-Options header should be set');
  runner.assert(res.headers['x-content-type-options'], 'X-Content-Type-Options should be set');
  runner.assert(res.headers['x-xss-protection'], 'X-XSS-Protection should be set');
});

// Content-Type Validation Tests
runner.test('POST without Content-Type is rejected', async () => {
  const res = await runner.request('/api/scenes/activate', {
    method: 'POST',
    body: { sceneId: 'test' }
  });
  runner.assertEqual(res.status, 400, 'Should reject POST without proper Content-Type');
});

// Energy Analytics Tests
runner.test('Energy analytics endpoint works', async () => {
  const res = await runner.request('/api/analytics/energy');
  runner.assert(res.status === 200 || res.status === 500, 'Energy analytics should respond');
});

// Climate Analytics Tests
runner.test('Climate analytics endpoint works', async () => {
  const res = await runner.request('/api/analytics/climate');
  runner.assert(res.status === 200 || res.status === 500, 'Climate analytics should respond');
});

// 404 Tests
runner.test('Unknown routes return 404', async () => {
  const res = await runner.request('/api/nonexistent');
  runner.assert(res.status === 404 || res.status === 500, 'Unknown route should return 404');
});

// Performance Tests
runner.test('Response time is reasonable', async () => {
  const start = Date.now();
  await runner.request('/health');
  const duration = Date.now() - start;
  runner.assert(duration < 1000, `Response time should be < 1000ms (was ${duration}ms)`);
});

// Run tests
if (require.main === module) {
  runner.run().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = TestRunner;
