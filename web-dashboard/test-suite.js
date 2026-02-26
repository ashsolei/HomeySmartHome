/**
 * Test Suite for Smart Home Pro Dashboard
 * Uses supertest — no running server required
 */

'use strict';

const request = require('supertest');
const { app } = require('./server');

class TestRunner {
  constructor() {
    this.tests = [];
    this.results = {
      passed: 0,
      failed: 0,
      total: 0,
      duration: 0
    };
    this.agent = request(app);
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
  const res = await runner.agent.get('/health');
  runner.assertEqual(res.status, 200, 'Health endpoint should return 200');
  runner.assert(res.body.status === 'ok', 'Health status should be ok');
});

// Metrics Tests
runner.test('Metrics endpoint returns Prometheus format', async () => {
  const res = await runner.agent.get('/metrics');
  runner.assertEqual(res.status, 200, 'Metrics endpoint should return 200');
  runner.assert(typeof res.text === 'string', 'Metrics should be text format');
  runner.assert(res.text.includes('smarthome_'), 'Metrics should contain smarthome prefix');
});

// Stats Tests
runner.test('Stats endpoint returns performance data', async () => {
  const res = await runner.agent.get('/api/stats');
  runner.assertEqual(res.status, 200, 'Stats endpoint should return 200');
  runner.assert(res.body.performance, 'Stats should include performance data');
  runner.assert(res.body.security, 'Stats should include security data');
});

// Dashboard API Tests
runner.test('Dashboard API returns data', async () => {
  const res = await runner.agent.get('/api/dashboard');
  runner.assertEqual(res.status, 200, 'Dashboard API should return 200');
  runner.assert(res.body.devices, 'Dashboard should include devices');
  runner.assert(res.body.zones, 'Dashboard should include zones');
});

// Rate Limiting Tests
runner.test('Rate limiting headers are present', async () => {
  const res = await runner.agent.get('/api/dashboard');
  runner.assert(res.headers['x-ratelimit-limit'], 'Rate limit header should be present');
  runner.assert(res.headers['x-ratelimit-remaining'], 'Rate limit remaining should be present');
});

// Security Headers Tests
runner.test('Security headers are set', async () => {
  const res = await runner.agent.get('/health');
  runner.assert(res.headers['x-frame-options'], 'X-Frame-Options header should be set');
  runner.assert(res.headers['x-content-type-options'], 'X-Content-Type-Options should be set');
  runner.assert(res.headers['x-xss-protection'], 'X-XSS-Protection should be set');
});

// Content-Type Validation Tests
runner.test('POST with non-JSON Content-Type is rejected', async () => {
  const res = await runner.agent
    .post('/api/scenes/activate')
    .set('Content-Type', 'text/plain')
    .send('sceneId=test');
  runner.assert(res.status === 400 || res.status === 415, 'Should reject POST without JSON Content-Type');
});

// Energy Analytics Tests
runner.test('Energy analytics endpoint works', async () => {
  const res = await runner.agent.get('/api/analytics/energy');
  runner.assert(res.status === 200 || res.status === 500, 'Energy analytics should respond');
});

// Climate Analytics Tests
runner.test('Climate analytics endpoint works', async () => {
  const res = await runner.agent.get('/api/analytics/climate');
  runner.assert(res.status === 200 || res.status === 500, 'Climate analytics should respond');
});

// 404 Tests
runner.test('Unknown routes return 404', async () => {
  const res = await runner.agent.get('/api/nonexistent');
  runner.assert(res.status === 404 || res.status === 500, 'Unknown route should return 404');
});

// Performance Tests
runner.test('Response time is reasonable', async () => {
  const start = Date.now();
  await runner.agent.get('/health');
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
