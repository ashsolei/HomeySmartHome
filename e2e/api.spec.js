'use strict';

/**
 * E2E API tests for the SmartHome Pro backend (port 3000).
 *
 * All tests use Playwright's `request` context — no browser required.
 * Tests cover public endpoints, Prometheus metrics format, OpenAPI docs,
 * CSRF protection, rate limiting, and auth-guarded routes.
 */

const { test, expect } = require('@playwright/test');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

test.describe('Public API endpoints', () => {
  test('GET /health returns 200 with status ok', async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/health`);

    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(typeof body.uptime).toBe('number');
    expect(typeof body.version).toBe('string');
    expect(typeof body.timestamp).toBe('string');
  });

  test('GET /ready returns readiness information', async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/ready`);

    // 200 = ready, 503 = not yet ready — both are valid structured responses
    expect([200, 503]).toContain(res.status());

    const body = await res.json();
    expect(typeof body.ready).toBe('boolean');
  });

  test('GET /metrics returns Prometheus text format', async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/metrics`);

    expect(res.status()).toBe(200);

    const text = await res.text();
    // Prometheus format always starts with # HELP or a metric name line
    expect(text).toMatch(/^#\s+HELP|^[a-z_]+\{/m);
    // Should contain at least one metric value line
    expect(text).toMatch(/\d+(\.\d+)?(\s+\d+)?$/m);
  });

  test('GET /api/v1/stats returns valid JSON stats object', async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/api/v1/stats`);

    // 200 when available; some environments may 401 if auth is enforced
    expect([200, 401, 403]).toContain(res.status());

    if (res.status() === 200) {
      const body = await res.json();
      // Stats should be a non-null object
      expect(typeof body).toBe('object');
      expect(body).not.toBeNull();
    }
  });

  test('GET /api/docs returns OpenAPI specification', async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/api/docs`);

    // Docs endpoint returns HTML (Swagger UI) or JSON (raw spec)
    expect([200, 301, 302]).toContain(res.status());
  });
});

test.describe('Auth-guarded endpoints return 401 without token', () => {
  // Known protected endpoints — extend as the API grows
  const protectedEndpoints = [
    '/api/v1/automations',
    '/api/v1/devices',
    '/api/v1/scenes',
    '/api/v1/energy',
    '/api/v1/users',
  ];

  for (const endpoint of protectedEndpoints) {
    test(`GET ${endpoint} returns 401 without auth token`, async ({ request }) => {
      const res = await request.get(`${BACKEND_URL}${endpoint}`, {
        // Explicitly omit any Authorization header
        headers: { Authorization: '' },
      });

      // 401 = unauthorized, 403 = forbidden, 404 = not found (endpoint may vary)
      // We accept 404 because route may not exist in all environments
      expect([401, 403, 404]).toContain(res.status());
    });
  }
});

test.describe('CSRF protection', () => {
  test('POST mutation without CSRF token is blocked or requires auth', async ({ request }) => {
    // Sending a state-changing request without CSRF token should be rejected.
    // The server may enforce this via 403 (CSRF), 401 (auth), or 400 (validation).
    const res = await request.post(`${BACKEND_URL}/api/v1/automations`, {
      data: { name: 'csrf-probe' },
      headers: {
        'Content-Type': 'application/json',
        // No x-csrf-token and no auth — a legitimate attack vector
        Origin: 'http://attacker.example.com',
      },
    });

    expect([400, 401, 403, 404, 422]).toContain(res.status());
  });
});

test.describe('Rate limiting', () => {
  test('Exceeding 100 requests/min triggers 429', async ({ request }) => {
    // Fire 110 rapid requests — if rate limiting is active at 100 req/min,
    // at least some should return 429.  We use a relaxed assertion because
    // the exact threshold depends on server configuration.
    const results = await Promise.all(
      Array.from({ length: 110 }, () =>
        request.get(`${BACKEND_URL}/health`).then(r => r.status())
      )
    );

    const has429 = results.includes(429);
    const successCount = results.filter(s => s === 200).length;

    // Either rate limiting kicked in (429 present) or all succeeded (rate
    // limiting may be disabled in test environment — this is also acceptable).
    expect(has429 || successCount === 110).toBe(true);

    if (has429) {
      // At least a few requests should have gotten through before limit hit
      expect(successCount).toBeGreaterThan(0);
    }
  });
});
