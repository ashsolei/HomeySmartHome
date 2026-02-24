'use strict';

/**
 * E2E health endpoint tests.
 *
 * Verifies that both the backend (port 3000) and dashboard (port 3001)
 * health probes respond correctly and within the SLA budget of 500 ms.
 *
 * These tests use Playwright's built-in `request` context so they run
 * without requiring a browser page — pure HTTP assertions.
 */

const { test, expect } = require('@playwright/test');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:3001';

// Maximum acceptable response time in milliseconds (SLA)
const SLA_MS = 500;

test.describe('Backend health endpoints', () => {
  test('GET /health returns 200 with status ok', async ({ request }) => {
    const start = Date.now();
    const res = await request.get(`${BACKEND_URL}/health`);
    const elapsed = Date.now() - start;

    expect(res.status()).toBe(200);
    expect(elapsed).toBeLessThan(SLA_MS);

    const body = await res.json();
    expect(body).toMatchObject({
      status: 'ok',
    });
    expect(typeof body.uptime).toBe('number');
    expect(typeof body.version).toBe('string');
  });

  test('GET /ready returns readiness info within SLA', async ({ request }) => {
    const start = Date.now();
    const res = await request.get(`${BACKEND_URL}/ready`);
    const elapsed = Date.now() - start;

    // Ready returns 200 when healthy, 503 when not — both are valid responses.
    expect([200, 503]).toContain(res.status());
    expect(elapsed).toBeLessThan(SLA_MS);

    const body = await res.json();
    expect(typeof body.ready).toBe('boolean');
  });

  test('Backend responds within SLA of 500ms (repeated sample)', async ({ request }) => {
    // Take 3 samples to reduce flakiness from single slow measurement.
    for (let i = 0; i < 3; i++) {
      const start = Date.now();
      await request.get(`${BACKEND_URL}/health`);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(SLA_MS);
    }
  });
});

test.describe('Dashboard health endpoints', () => {
  test('GET /health returns 200 with status ok', async ({ request }) => {
    const start = Date.now();
    const res = await request.get(`${DASHBOARD_URL}/health`);
    const elapsed = Date.now() - start;

    expect(res.status()).toBe(200);
    expect(elapsed).toBeLessThan(SLA_MS);

    const body = await res.json();
    expect(body).toMatchObject({
      status: 'ok',
    });
  });

  test('Dashboard responds within SLA of 500ms (repeated sample)', async ({ request }) => {
    for (let i = 0; i < 3; i++) {
      const start = Date.now();
      await request.get(`${DASHBOARD_URL}/health`);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(SLA_MS);
    }
  });
});
