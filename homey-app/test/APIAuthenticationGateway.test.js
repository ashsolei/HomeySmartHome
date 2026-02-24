'use strict';

/**
 * Unit tests for APIAuthenticationGateway.
 *
 * Uses resetInstance() between test groups to guarantee isolation.
 */

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertType, assertThrows } = require('./helpers/assert');
const APIAuthenticationGateway = require('../lib/APIAuthenticationGateway');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function freshGateway() {
  APIAuthenticationGateway.resetInstance();
  return APIAuthenticationGateway.getInstance();
}

// Minimal request-like object
function mockReq({ path = '/api/data', ip = '127.0.0.1', headers = {}, method = 'GET' } = {}) {
  return { path, ip, headers, method };
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

describe('APIAuthenticationGateway — singleton', () => {
  it('getInstance returns the same instance each call', () => {
    APIAuthenticationGateway.resetInstance();
    const a = APIAuthenticationGateway.getInstance();
    const b = APIAuthenticationGateway.getInstance();
    assertEqual(a, b, 'should be the same singleton instance');
    a.destroy();
    APIAuthenticationGateway.resetInstance();
  });

  it('resetInstance clears the singleton', () => {
    APIAuthenticationGateway.resetInstance();
    const a = APIAuthenticationGateway.getInstance();
    APIAuthenticationGateway.resetInstance();
    const b = APIAuthenticationGateway.getInstance();
    assert(a !== b, 'new instance after reset should differ from old');
    b.destroy();
    APIAuthenticationGateway.resetInstance();
  });
});

// ---------------------------------------------------------------------------
// Token management
// ---------------------------------------------------------------------------

describe('APIAuthenticationGateway — createToken', () => {
  it('returns tokenId, token string, and expiresAt', () => {
    const gw = freshGateway();
    const result = gw.createToken('user-1', 'USER');
    assertType(result.tokenId, 'string');
    assertType(result.token, 'string');
    assertType(result.expiresAt, 'number');
    assert(result.expiresAt > Date.now(), 'expiresAt should be in the future');
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });

  it('token string is 64 hex characters (32 bytes)', () => {
    const gw = freshGateway();
    const { token } = gw.createToken('user-1', 'ADMIN');
    assertEqual(token.length, 64);
    assert(/^[0-9a-f]+$/.test(token), 'token should be hex');
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });

  it('throws for invalid role', () => {
    const gw = freshGateway();
    assertThrows(() => gw.createToken('user-1', 'SUPERUSER'), 'Invalid role');
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });

  it('throws for empty userId', () => {
    const gw = freshGateway();
    assertThrows(() => gw.createToken('', 'USER'), 'userId must be');
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });

  it('enforces per-user token cap (MAX_TOKENS_PER_USER = 10)', () => {
    const gw = freshGateway();
    for (let i = 0; i < 10; i++) {
      gw.createToken('capped-user', 'USER');
    }
    assertThrows(() => gw.createToken('capped-user', 'USER'), 'maximum');
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });

  it('creates distinct tokens for different users', () => {
    const gw = freshGateway();
    const a = gw.createToken('alice', 'USER');
    const b = gw.createToken('bob', 'USER');
    assert(a.tokenId !== b.tokenId, 'tokenIds must differ');
    assert(a.token !== b.token, 'raw tokens must differ');
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });
});

describe('APIAuthenticationGateway — revokeToken', () => {
  it('returns true when token existed', () => {
    const gw = freshGateway();
    const { tokenId } = gw.createToken('user-1', 'USER');
    const result = gw.revokeToken(tokenId);
    assertEqual(result, true);
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });

  it('returns false for unknown tokenId', () => {
    const gw = freshGateway();
    assertEqual(gw.revokeToken('non-existent'), false);
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });

  it('revoked token no longer appears in listActiveTokens', () => {
    const gw = freshGateway();
    const { tokenId } = gw.createToken('user-1', 'USER');
    gw.revokeToken(tokenId);
    const active = gw.listActiveTokens();
    assert(!active.find(t => t.id === tokenId), 'revoked token should not be listed');
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });
});

describe('APIAuthenticationGateway — rotateToken', () => {
  it('invalidates the old token and issues a new one', () => {
    const gw = freshGateway();
    const { tokenId: oldId } = gw.createToken('user-1', 'USER');
    const { tokenId: newId } = gw.rotateToken(oldId);
    assert(oldId !== newId, 'new tokenId should differ');
    assert(!gw.listActiveTokens().find(t => t.id === oldId), 'old token should be gone');
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });

  it('throws for non-existent token', () => {
    const gw = freshGateway();
    assertThrows(() => gw.rotateToken('bogus-id'), 'not found');
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });
});

// ---------------------------------------------------------------------------
// validateRequest
// ---------------------------------------------------------------------------

describe('APIAuthenticationGateway — validateRequest', () => {
  it('passes public paths without a token', () => {
    const gw = freshGateway();
    const result = gw.validateRequest({}, '/health');
    assertEqual(result.valid, true);
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });

  it('fails when Authorization header is missing', () => {
    const gw = freshGateway();
    const result = gw.validateRequest({}, '/api/data');
    assertEqual(result.valid, false);
    assert(result.reason.includes('Authorization'), 'reason should mention Authorization');
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });

  it('fails when Authorization format is wrong', () => {
    const gw = freshGateway();
    const result = gw.validateRequest({ authorization: 'Basic abc123' }, '/api/data');
    assertEqual(result.valid, false);
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });

  it('passes with a valid Bearer token', () => {
    const gw = freshGateway();
    const { token } = gw.createToken('user-1', 'USER');
    const result = gw.validateRequest({ authorization: `Bearer ${token}` }, '/api/data');
    assertEqual(result.valid, true);
    assert(result.tokenRecord, 'should include tokenRecord');
    assertEqual(result.tokenRecord.userId, 'user-1');
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });

  it('fails with a non-existent token', () => {
    const gw = freshGateway();
    const result = gw.validateRequest({ authorization: 'Bearer deadbeefdeadbeef' }, '/api/data');
    assertEqual(result.valid, false);
    assert(result.reason.includes('not recognised') || result.reason.includes('Token'), 'reason should mention token');
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });
});

// ---------------------------------------------------------------------------
// validateRequestSize
// ---------------------------------------------------------------------------

describe('APIAuthenticationGateway — validateRequestSize', () => {
  it('passes when content-length is within limit', () => {
    const gw = freshGateway();
    const result = gw.validateRequestSize({ 'content-length': '512' });
    assertEqual(result.valid, true);
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });

  it('fails when content-length exceeds 1 MB', () => {
    const gw = freshGateway();
    const overLimit = (1 * 1024 * 1024 + 1).toString();
    const result = gw.validateRequestSize({ 'content-length': overLimit });
    assertEqual(result.valid, false);
    assert(result.reason.includes('too large'), 'reason should mention "too large"');
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });

  it('passes when content-length header is absent', () => {
    const gw = freshGateway();
    const result = gw.validateRequestSize({});
    assertEqual(result.valid, true);
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });
});

// ---------------------------------------------------------------------------
// hasPermission (RBAC)
// ---------------------------------------------------------------------------

describe('APIAuthenticationGateway — hasPermission', () => {
  it('ADMIN has permission for any role', () => {
    const gw = freshGateway();
    assertEqual(gw.hasPermission('ADMIN', 'VIEWER'), true);
    assertEqual(gw.hasPermission('ADMIN', 'USER'), true);
    assertEqual(gw.hasPermission('ADMIN', 'ADMIN'), true);
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });

  it('USER has permission for VIEWER and USER but not ADMIN', () => {
    const gw = freshGateway();
    assertEqual(gw.hasPermission('USER', 'VIEWER'), true);
    assertEqual(gw.hasPermission('USER', 'USER'), true);
    assertEqual(gw.hasPermission('USER', 'ADMIN'), false);
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });

  it('VIEWER has permission only for VIEWER', () => {
    const gw = freshGateway();
    assertEqual(gw.hasPermission('VIEWER', 'VIEWER'), true);
    assertEqual(gw.hasPermission('VIEWER', 'USER'), false);
    assertEqual(gw.hasPermission('VIEWER', 'ADMIN'), false);
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });

  it('SYSTEM role is accepted only for SYSTEM-required routes', () => {
    const gw = freshGateway();
    assertEqual(gw.hasPermission('SYSTEM', 'SYSTEM'), true);
    assertEqual(gw.hasPermission('SYSTEM', 'VIEWER'), false);
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });
});

// ---------------------------------------------------------------------------
// getRequiredRole
// ---------------------------------------------------------------------------

describe('APIAuthenticationGateway — getRequiredRole', () => {
  it('returns ADMIN for /api/admin routes', () => {
    const gw = freshGateway();
    assertEqual(gw.getRequiredRole('/api/admin/users'), 'ADMIN');
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });

  it('returns VIEWER for /api/devices', () => {
    const gw = freshGateway();
    assertEqual(gw.getRequiredRole('/api/devices'), 'VIEWER');
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });

  it('returns VIEWER for unknown paths (default)', () => {
    const gw = freshGateway();
    assertEqual(gw.getRequiredRole('/api/unknown/path'), 'VIEWER');
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });
});

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

describe('APIAuthenticationGateway — checkTokenRateLimit', () => {
  it('allows requests under the limit', () => {
    const gw = freshGateway();
    const result = gw.checkTokenRateLimit('token-1', '/api/data');
    assertEqual(result.allowed, true);
    assert(result.remaining >= 0);
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });

  it('blocks requests over the limit', () => {
    const gw = freshGateway();
    // Default limit is 100; send 101 requests
    for (let i = 0; i < 100; i++) {
      gw.checkTokenRateLimit('rate-token', '/api/data');
    }
    const result = gw.checkTokenRateLimit('rate-token', '/api/data');
    assertEqual(result.allowed, false);
    assertEqual(result.remaining, 0);
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });
});

describe('APIAuthenticationGateway — checkIPRateLimit', () => {
  it('allows requests under the IP limit', () => {
    const gw = freshGateway();
    const result = gw.checkIPRateLimit('10.0.0.1');
    assertEqual(result.allowed, true);
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });
});

// ---------------------------------------------------------------------------
// IP lockout
// ---------------------------------------------------------------------------

describe('APIAuthenticationGateway — recordFailure / isIPLocked', () => {
  it('IP is not locked after fewer than 10 failures', () => {
    const gw = freshGateway();
    for (let i = 0; i < 9; i++) {
      gw.recordFailure('1.2.3.4', '/api/data');
    }
    assertEqual(gw.isIPLocked('1.2.3.4'), false);
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });

  it('IP is locked after 10 failures', () => {
    const gw = freshGateway();
    for (let i = 0; i < 10; i++) {
      gw.recordFailure('5.6.7.8', '/api/data');
    }
    assertEqual(gw.isIPLocked('5.6.7.8'), true);
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });

  it('recordFailure returns locked: true when threshold is met', () => {
    const gw = freshGateway();
    let result;
    for (let i = 0; i < 10; i++) {
      result = gw.recordFailure('9.9.9.9', '/api/data');
    }
    assertEqual(result.locked, true);
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });

  it('unknown IP is not locked', () => {
    const gw = freshGateway();
    assertEqual(gw.isIPLocked('255.255.255.255'), false);
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });
});

// ---------------------------------------------------------------------------
// Audit logging
// ---------------------------------------------------------------------------

describe('APIAuthenticationGateway — auditLog', () => {
  it('addAuditEntry stores entries', () => {
    const gw = freshGateway();
    gw.addAuditEntry({ event: 'test', ip: '1.2.3.4', path: '/api', userId: null, success: true, reason: 'ok' });
    const log = gw.getAuditLog(10);
    assert(log.length >= 1);
    assertEqual(log[log.length - 1].event, 'test');
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });

  it('getAuditLog returns at most count entries', () => {
    const gw = freshGateway();
    for (let i = 0; i < 20; i++) {
      gw.addAuditEntry({ event: 'e', ip: 'x', path: '/', userId: null, success: true, reason: '' });
    }
    const log = gw.getAuditLog(5);
    assert(log.length <= 5);
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });

  it('timestamp is added automatically', () => {
    const gw = freshGateway();
    gw.addAuditEntry({ event: 'ts-test', ip: '1.1.1.1', path: '/', userId: null, success: true, reason: '' });
    const entry = gw.getAuditLog(1)[0];
    assertType(entry.timestamp, 'number');
    assert(entry.timestamp > 0);
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });
});

// ---------------------------------------------------------------------------
// authenticate — integration of all checks
// ---------------------------------------------------------------------------

describe('APIAuthenticationGateway — authenticate', () => {
  it('returns authenticated: true for a public path', () => {
    const gw = freshGateway();
    const result = gw.authenticate(mockReq({ path: '/health' }));
    assertEqual(result.authenticated, true);
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });

  it('returns 401 when token is missing on a protected path', () => {
    const gw = freshGateway();
    const result = gw.authenticate(mockReq({ path: '/api/devices' }));
    assertEqual(result.authenticated, false);
    assertEqual(result.statusCode, 401);
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });

  it('returns authenticated: true with a valid token', () => {
    const gw = freshGateway();
    const { token } = gw.createToken('user-1', 'USER');
    const req = mockReq({
      path: '/api/devices',
      headers: { authorization: `Bearer ${token}` }
    });
    const result = gw.authenticate(req);
    assertEqual(result.authenticated, true);
    assert(result.tokenRecord, 'should include tokenRecord');
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });

  it('returns 429 for a locked-out IP', () => {
    const gw = freshGateway();
    const ip = '192.168.1.100';
    for (let i = 0; i < 10; i++) gw.recordFailure(ip, '/api');
    const result = gw.authenticate(mockReq({ ip, path: '/api/data' }));
    assertEqual(result.authenticated, false);
    assertEqual(result.statusCode, 429);
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });

  it('uses req.ip for the IP address', () => {
    const gw = freshGateway();
    const customIp = '172.16.0.5';
    // Lock the custom IP
    for (let i = 0; i < 10; i++) gw.recordFailure(customIp, '/api');
    const result = gw.authenticate({ path: '/api', ip: customIp, headers: {} });
    assertEqual(result.authenticated, false);
    assertEqual(result.statusCode, 429);
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });
});

// ---------------------------------------------------------------------------
// validateContentType
// ---------------------------------------------------------------------------

describe('APIAuthenticationGateway — validateContentType', () => {
  it('passes when content-type matches', () => {
    const gw = freshGateway();
    const result = gw.validateContentType({ 'content-type': 'application/json; charset=utf-8' });
    assertEqual(result.valid, true);
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });

  it('fails when content-type is wrong', () => {
    const gw = freshGateway();
    const result = gw.validateContentType({ 'content-type': 'text/plain' });
    assertEqual(result.valid, false);
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });

  it('passes when there is no content-type (GET-style, no body)', () => {
    const gw = freshGateway();
    const result = gw.validateContentType({});
    assertEqual(result.valid, true);
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });
});

// ---------------------------------------------------------------------------
// getSecurityHeaders
// ---------------------------------------------------------------------------

describe('APIAuthenticationGateway — getSecurityHeaders', () => {
  it('includes all required security headers', () => {
    const gw = freshGateway();
    const headers = gw.getSecurityHeaders();
    assertEqual(headers['X-Content-Type-Options'], 'nosniff');
    assertEqual(headers['X-Frame-Options'], 'DENY');
    assert(headers['Strict-Transport-Security'], 'HSTS header should be present');
    assert(headers['Content-Security-Policy'], 'CSP header should be present');
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });
});

// ---------------------------------------------------------------------------
// getStats
// ---------------------------------------------------------------------------

describe('APIAuthenticationGateway — getStats', () => {
  it('returns a stats object with expected shape', () => {
    const gw = freshGateway();
    gw.createToken('u1', 'USER');
    const stats = gw.getStats();
    assertType(stats.activeTokens, 'number');
    assertType(stats.totalTokensIssued, 'number');
    assertType(stats.lockedIPs, 'number');
    assertType(stats.auditLogSize, 'number');
    assert(Array.isArray(stats.publicPaths), 'publicPaths should be an array');
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });
});

// ---------------------------------------------------------------------------
// Public path management
// ---------------------------------------------------------------------------

describe('APIAuthenticationGateway — addPublicPath / removePublicPath', () => {
  it('added paths bypass authentication', () => {
    const gw = freshGateway();
    gw.addPublicPath('/api/public-status');
    const result = gw.validateRequest({}, '/api/public-status');
    assertEqual(result.valid, true);
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });

  it('removed paths no longer bypass authentication', () => {
    const gw = freshGateway();
    gw.addPublicPath('/api/temp-public');
    gw.removePublicPath('/api/temp-public');
    const result = gw.validateRequest({}, '/api/temp-public');
    assertEqual(result.valid, false);
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });
});

// ---------------------------------------------------------------------------
// FEAT-07: static ROLES config
// ---------------------------------------------------------------------------

describe('APIAuthenticationGateway — ROLES config (FEAT-07)', () => {
  it('exposes admin, user, and guest roles', () => {
    const roles = APIAuthenticationGateway.ROLES;
    assert(roles.admin, 'admin role should exist');
    assert(roles.user,  'user role should exist');
    assert(roles.guest, 'guest role should exist');
  });

  it('admin has level 3 and all permissions', () => {
    const { level, permissions } = APIAuthenticationGateway.ROLES.admin;
    assertEqual(level, 3);
    assert(permissions.includes('read'),   'admin must have read');
    assert(permissions.includes('write'),  'admin must have write');
    assert(permissions.includes('delete'), 'admin must have delete');
    assert(permissions.includes('admin'),  'admin must have admin');
  });

  it('user has level 2 and read+write permissions only', () => {
    const { level, permissions } = APIAuthenticationGateway.ROLES.user;
    assertEqual(level, 2);
    assert(permissions.includes('read'),           'user must have read');
    assert(permissions.includes('write'),          'user must have write');
    assert(!permissions.includes('delete'),        'user must NOT have delete');
    assert(!permissions.includes('admin'),         'user must NOT have admin');
  });

  it('guest has level 1 and read permission only', () => {
    const { level, permissions } = APIAuthenticationGateway.ROLES.guest;
    assertEqual(level, 1);
    assert(permissions.includes('read'),           'guest must have read');
    assert(!permissions.includes('write'),         'guest must NOT have write');
    assert(!permissions.includes('delete'),        'guest must NOT have delete');
    assert(!permissions.includes('admin'),         'guest must NOT have admin');
  });

  it('admin level is higher than user which is higher than guest', () => {
    const { ROLES } = APIAuthenticationGateway;
    assert(ROLES.admin.level > ROLES.user.level,  'admin > user');
    assert(ROLES.user.level  > ROLES.guest.level, 'user > guest');
  });
});

// ---------------------------------------------------------------------------
// FEAT-07: requireRole() middleware factory
// ---------------------------------------------------------------------------

describe('APIAuthenticationGateway — requireRole (FEAT-07)', () => {
  // Helper: build a mock Express res with a json() spy
  function mockRes() {
    const res = { _status: 200, _body: null };
    res.status = (code) => { res._status = code; return res; };
    res.json   = (body) => { res._body = body; return res; };
    return res;
  }

  it('throws for an unknown role name', () => {
    const gw = freshGateway();
    assertThrows(() => gw.requireRole('superuser'), 'unknown role');
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });

  it('allows request when token role meets minimum (user token, user required)', () => {
    const gw = freshGateway();
    const { token } = gw.createToken('u1', 'USER');
    const req = mockReq({ path: '/api/devices/control', headers: { authorization: `Bearer ${token}` } });
    // Simulate auth middleware having set tokenRecord
    const authResult = gw.authenticate(req);
    req.tokenRecord = authResult.tokenRecord;

    let nextCalled = false;
    const res = mockRes();
    gw.requireRole('user')(req, res, () => { nextCalled = true; });

    assert(nextCalled, 'next() should have been called for sufficient role');
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });

  it('allows admin token on a user-required route', () => {
    const gw = freshGateway();
    const { token } = gw.createToken('admin1', 'ADMIN');
    const req = mockReq({ path: '/api/devices/control', headers: { authorization: `Bearer ${token}` } });
    const authResult = gw.authenticate(req);
    req.tokenRecord = authResult.tokenRecord;

    let nextCalled = false;
    const res = mockRes();
    gw.requireRole('user')(req, res, () => { nextCalled = true; });

    assert(nextCalled, 'admin should pass a user-required route');
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });

  it('blocks VIEWER token on a user-required route with 403', () => {
    const gw = freshGateway();
    const { token } = gw.createToken('viewer1', 'VIEWER');
    const req = mockReq({ path: '/api/devices/control', headers: { authorization: `Bearer ${token}` } });
    const authResult = gw.authenticate(req);
    req.tokenRecord = authResult.tokenRecord;

    let nextCalled = false;
    const res = mockRes();
    gw.requireRole('user')(req, res, () => { nextCalled = true; });

    assert(!nextCalled,           'next() should NOT be called for insufficient role');
    assertEqual(res._status, 403, 'should respond 403');
    assert(res._body && res._body.error.includes('user'), '403 body should name the required role');
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });

  it('blocks USER token on an admin-required route with 403', () => {
    const gw = freshGateway();
    const { token } = gw.createToken('user1', 'USER');
    const req = mockReq({ path: '/api/settings', headers: { authorization: `Bearer ${token}` } });
    const authResult = gw.authenticate(req);
    req.tokenRecord = authResult.tokenRecord;

    let nextCalled = false;
    const res = mockRes();
    gw.requireRole('admin')(req, res, () => { nextCalled = true; });

    assert(!nextCalled,           'next() should NOT be called for insufficient role');
    assertEqual(res._status, 403, 'should respond 403 for user on admin-required route');
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });

  it('defaults to admin in non-production when no token is present', () => {
    // Ensure we are NOT in production mode for this test
    const savedEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const gw = freshGateway();
    const req = mockReq({ path: '/api/settings' });
    // No tokenRecord on req (unauthenticated in dev)

    let nextCalled = false;
    const res = mockRes();
    gw.requireRole('admin')(req, res, () => { nextCalled = true; });

    process.env.NODE_ENV = savedEnv;

    assert(nextCalled, 'dev requests without token should default to admin and pass');
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });
});

// ---------------------------------------------------------------------------
// FEAT-07: checkPermission()
// ---------------------------------------------------------------------------

describe('APIAuthenticationGateway — checkPermission (FEAT-07)', () => {
  it('ADMIN token grants all permissions', () => {
    const gw = freshGateway();
    const { token } = gw.createToken('admin1', 'ADMIN');
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const authResult = gw.authenticate(req);
    req.tokenRecord = authResult.tokenRecord;

    assert(gw.checkPermission(req, 'read'),   'admin should have read');
    assert(gw.checkPermission(req, 'write'),  'admin should have write');
    assert(gw.checkPermission(req, 'delete'), 'admin should have delete');
    assert(gw.checkPermission(req, 'admin'),  'admin should have admin');
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });

  it('USER token has read and write but not delete or admin', () => {
    const gw = freshGateway();
    const { token } = gw.createToken('user1', 'USER');
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const authResult = gw.authenticate(req);
    req.tokenRecord = authResult.tokenRecord;

    assert(gw.checkPermission(req, 'read'),             'user should have read');
    assert(gw.checkPermission(req, 'write'),            'user should have write');
    assert(!gw.checkPermission(req, 'delete'),          'user should NOT have delete');
    assert(!gw.checkPermission(req, 'admin'),           'user should NOT have admin');
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });

  it('VIEWER token has read only', () => {
    const gw = freshGateway();
    const { token } = gw.createToken('viewer1', 'VIEWER');
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const authResult = gw.authenticate(req);
    req.tokenRecord = authResult.tokenRecord;

    assert(gw.checkPermission(req, 'read'),            'viewer should have read');
    assert(!gw.checkPermission(req, 'write'),          'viewer should NOT have write');
    assert(!gw.checkPermission(req, 'delete'),         'viewer should NOT have delete');
    assert(!gw.checkPermission(req, 'admin'),          'viewer should NOT have admin');
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });

  it('defaults to admin permissions in non-production with no token', () => {
    const savedEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const gw = freshGateway();
    const req = mockReq({});
    // No tokenRecord

    assert(gw.checkPermission(req, 'delete'), 'dev mode no-token should have delete');
    assert(gw.checkPermission(req, 'admin'),  'dev mode no-token should have admin');

    process.env.NODE_ENV = savedEnv;
    gw.destroy();
    APIAuthenticationGateway.resetInstance();
  });
});

// Run
run();
