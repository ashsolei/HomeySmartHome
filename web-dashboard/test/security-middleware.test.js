'use strict';

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertNotEqual, assertType } = require('./helpers/assert');
const SecurityMiddleware = require('../security-middleware');

// ── SecurityMiddleware — constructor ──

describe('SecurityMiddleware — constructor', () => {
  it('creates instance with default options', () => {
    const mw = new SecurityMiddleware();
    assert(mw.options.enableRateLimiting, 'rate limiting enabled by default');
    assertEqual(mw.options.maxRequestsPerMinute, 100);
    assert(mw.options.enableRequestValidation, 'request validation enabled');
    assert(mw.options.enableCSRFProtection, 'CSRF protection enabled');
    mw.destroy();
  });

  it('respects custom options', () => {
    const mw = new SecurityMiddleware({
      enableRateLimiting: false,
      maxRequestsPerMinute: 50,
    });
    assertEqual(mw.options.enableRateLimiting, false);
    assertEqual(mw.options.maxRequestsPerMinute, 50);
    mw.destroy();
  });
});

// ── SecurityMiddleware — rateLimit ──

describe('SecurityMiddleware — rateLimit', () => {
  it('returns a middleware function', () => {
    const mw = new SecurityMiddleware();
    const middleware = mw.rateLimit();
    assertEqual(typeof middleware, 'function');
    mw.destroy();
  });

  it('calls next() when under the limit', () => {
    const mw = new SecurityMiddleware({ maxRequestsPerMinute: 10 });
    const middleware = mw.rateLimit();
    let nextCalled = false;
    const req = { ip: '127.0.0.1', headers: { 'user-agent': 'test' }, connection: { remoteAddress: '127.0.0.1' } };
    const res = { setHeader: () => {}, status: () => ({ json: () => {} }) };
    middleware(req, res, () => { nextCalled = true; });
    assert(nextCalled, 'next() should be called');
    mw.destroy();
  });

  it('returns 429 when rate limit exceeded', () => {
    const mw = new SecurityMiddleware({ maxRequestsPerMinute: 2 });
    const middleware = mw.rateLimit();
    const req = { ip: '127.0.0.1', headers: { 'user-agent': 'test' }, connection: { remoteAddress: '127.0.0.1' } };
    let statusCode = null;
    const res = {
      setHeader: () => {},
      status: (code) => {
        statusCode = code;
        return { json: () => {} };
      },
    };
    // Exhaust rate limit
    middleware(req, res, () => {});
    middleware(req, res, () => {});
    // Third request should be blocked
    let nextCalled = false;
    middleware(req, res, () => { nextCalled = true; });
    assertEqual(statusCode, 429, 'should return 429');
    assertEqual(nextCalled, false, 'next() should not be called');
    mw.destroy();
  });

  it('skips rate limiting when disabled', () => {
    const mw = new SecurityMiddleware({ enableRateLimiting: false });
    const middleware = mw.rateLimit();
    let nextCalled = false;
    const req = { ip: '127.0.0.1', headers: {}, connection: { remoteAddress: '127.0.0.1' } };
    const res = { setHeader: () => {} };
    middleware(req, res, () => { nextCalled = true; });
    assert(nextCalled, 'next() should be called when disabled');
    mw.destroy();
  });
});

// ── SecurityMiddleware — validateRequest ──

describe('SecurityMiddleware — validateRequest', () => {
  it('rejects POST without application/json content-type', () => {
    const mw = new SecurityMiddleware();
    const middleware = mw.validateRequest();
    let statusCode = null;
    const req = { method: 'POST', headers: { 'content-type': 'text/plain', 'content-length': '10' } };
    const res = { status: (code) => { statusCode = code; return { json: () => {} }; } };
    middleware(req, res, () => {});
    assertEqual(statusCode, 400, 'should return 400');
    mw.destroy();
  });

  it('allows POST with application/json content-type', () => {
    const mw = new SecurityMiddleware();
    const middleware = mw.validateRequest();
    let nextCalled = false;
    const req = { method: 'POST', headers: { 'content-type': 'application/json', 'content-length': '10' } };
    const res = {};
    middleware(req, res, () => { nextCalled = true; });
    assert(nextCalled, 'should call next');
    mw.destroy();
  });

  it('allows GET requests without content-type', () => {
    const mw = new SecurityMiddleware();
    const middleware = mw.validateRequest();
    let nextCalled = false;
    const req = { method: 'GET', headers: {} };
    const res = {};
    middleware(req, res, () => { nextCalled = true; });
    assert(nextCalled, 'should call next for GET');
    mw.destroy();
  });

  it('rejects oversized payloads', () => {
    const mw = new SecurityMiddleware();
    const middleware = mw.validateRequest();
    let statusCode = null;
    const req = {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': String(20 * 1024 * 1024) },
    };
    const res = { status: (code) => { statusCode = code; return { json: () => {} }; } };
    middleware(req, res, () => {});
    assertEqual(statusCode, 413, 'should return 413');
    mw.destroy();
  });
});

// ── SecurityMiddleware — securityHeaders ──

describe('SecurityMiddleware — securityHeaders', () => {
  it('sets all required security headers', () => {
    const mw = new SecurityMiddleware();
    const middleware = mw.securityHeaders();
    const headers = {};
    let nextCalled = false;
    const req = { secure: false };
    const res = { setHeader: (k, v) => { headers[k] = v; } };
    middleware(req, res, () => { nextCalled = true; });
    assert(nextCalled, 'should call next');
    assertEqual(headers['X-Frame-Options'], 'DENY');
    assertEqual(headers['X-Content-Type-Options'], 'nosniff');
    assertEqual(headers['X-XSS-Protection'], '1; mode=block');
    assert(headers['Referrer-Policy'], 'Referrer-Policy should be set');
    assert(headers['Content-Security-Policy'], 'CSP should be set');
    mw.destroy();
  });

  it('sets HSTS when request is secure', () => {
    const mw = new SecurityMiddleware();
    const middleware = mw.securityHeaders();
    const headers = {};
    const req = { secure: true };
    const res = { setHeader: (k, v) => { headers[k] = v; } };
    middleware(req, res, () => {});
    assert(headers['Strict-Transport-Security'], 'HSTS header should be set');
    mw.destroy();
  });
});

// ── SecurityMiddleware — getClientIdentifier ──

describe('SecurityMiddleware — getClientIdentifier', () => {
  it('returns a hex string', () => {
    const mw = new SecurityMiddleware();
    const id = mw.getClientIdentifier({
      ip: '10.0.0.1',
      headers: { 'user-agent': 'Mozilla' },
      connection: { remoteAddress: '10.0.0.1' },
    });
    assert(/^[0-9a-f]{64}$/.test(id), 'should be a sha256 hex string');
    mw.destroy();
  });

  it('produces different IDs for different IPs', () => {
    const mw = new SecurityMiddleware();
    const id1 = mw.getClientIdentifier({ ip: '10.0.0.1', headers: { 'user-agent': 'A' }, connection: {} });
    const id2 = mw.getClientIdentifier({ ip: '10.0.0.2', headers: { 'user-agent': 'A' }, connection: {} });
    assertNotEqual(id1, id2, 'different IPs should produce different identifiers');
    mw.destroy();
  });
});

// ── SecurityMiddleware — cleanup ──

describe('SecurityMiddleware — cleanup', () => {
  it('removes expired rate limit entries', () => {
    const mw = new SecurityMiddleware();
    mw.rateLimitStore.set('old-client', [Date.now() - 120000]);
    mw.cleanup();
    assertEqual(mw.rateLimitStore.has('old-client'), false, 'old entry should be cleaned');
    mw.destroy();
  });

  it('preserves recent rate limit entries', () => {
    const mw = new SecurityMiddleware();
    mw.rateLimitStore.set('recent-client', [Date.now()]);
    mw.cleanup();
    assert(mw.rateLimitStore.has('recent-client'), 'recent entry should be kept');
    mw.destroy();
  });
});

// ── SecurityMiddleware — getStats ──

describe('SecurityMiddleware — getStats', () => {
  it('returns expected stats shape', () => {
    const mw = new SecurityMiddleware();
    const stats = mw.getStats();
    assertType(stats.rateLimitStore.size, 'number');
    assert(Array.isArray(stats.rateLimitStore.clients), 'clients should be an array');
    assertType(stats.csrfTokens.size, 'number');
    mw.destroy();
  });
});

// ── SecurityMiddleware — destroy ──

describe('SecurityMiddleware — destroy', () => {
  it('clears all stores and interval', () => {
    const mw = new SecurityMiddleware();
    mw.rateLimitStore.set('x', [1]);
    mw.csrfTokens.set('y', { token: 'a', timestamp: Date.now() });
    mw.destroy();
    assertEqual(mw.rateLimitStore.size, 0, 'rate limit store should be empty');
    assertEqual(mw.csrfTokens.size, 0, 'csrf store should be empty');
    assertEqual(mw._cleanupInterval, null, 'interval should be null');
  });
});

run();
