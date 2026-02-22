'use strict';

const EventEmitter = require('events');
const crypto = require('crypto');

/**
 * @typedef {'ADMIN'|'USER'|'VIEWER'|'SYSTEM'} Role
 */

/**
 * @typedef {Object} TokenRecord
 * @property {string} id - Unique token identifier
 * @property {string} hashedToken - SHA-256 hash of the raw token
 * @property {string} userId - Owner of the token
 * @property {Role} role - Assigned role
 * @property {number} createdAt - Creation timestamp (ms)
 * @property {number} expiresAt - Expiration timestamp (ms)
 * @property {number} lastUsedAt - Last usage timestamp (ms)
 */

/**
 * @typedef {Object} AuditEntry
 * @property {number} timestamp - Event timestamp (ms)
 * @property {string} event - Event type
 * @property {string} ip - Source IP address
 * @property {string} path - Request path
 * @property {string|null} userId - Associated user, if known
 * @property {boolean} success - Whether the action succeeded
 * @property {string} reason - Human-readable detail
 */

/**
 * @typedef {Object} RateLimitEntry
 * @property {number[]} timestamps - Request timestamps within the current window
 */

/**
 * @typedef {Object} MiddlewareOptions
 * @property {Role} [requiredRole] - Minimum role needed for the route
 * @property {number} [rateLimit] - Custom rate limit (requests/minute)
 * @property {boolean} [skipAuth] - Bypass authentication entirely
 */

/** Default time-to-live for tokens: 24 hours in milliseconds */
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

/** Maximum number of active tokens a single user may hold */
const MAX_TOKENS_PER_USER = 10;

/** Default per-token rate limit (requests per minute) */
const DEFAULT_TOKEN_RATE_LIMIT = 100;

/** Default per-IP rate limit (requests per minute) */
const DEFAULT_IP_RATE_LIMIT = 200;

/** Rate-limit sliding window size in milliseconds */
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

/** Number of failed attempts before an IP is locked out */
const LOCKOUT_THRESHOLD = 10;

/** Lockout observation window in milliseconds (15 minutes) */
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

/** Lockout duration in milliseconds (15 minutes) */
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

/** Maximum audit log entries kept in memory */
const MAX_AUDIT_ENTRIES = 1000;

/** Maximum allowed request body size in bytes (1 MB) */
const MAX_REQUEST_SIZE_BYTES = 1 * 1024 * 1024;

/**
 * Role hierarchy – higher index means more privileges.
 * @type {Role[]}
 */
const ROLE_HIERARCHY = ['VIEWER', 'USER', 'ADMIN'];

/**
 * Paths that are accessible without any authentication.
 * @type {string[]}
 */
const PUBLIC_PATHS = ['/health', '/status', '/api/health', '/api/status'];

/**
 * Default route-to-minimum-role mapping.  Patterns use simple prefix matching.
 * @type {Array<{pattern: string, role: Role}>}
 */
const DEFAULT_ROUTE_PERMISSIONS = [
  { pattern: '/api/admin', role: 'ADMIN' },
  { pattern: '/api/system', role: 'SYSTEM' },
  { pattern: '/api/settings', role: 'ADMIN' },
  { pattern: '/api/users', role: 'ADMIN' },
  { pattern: '/api/devices/control', role: 'USER' },
  { pattern: '/api/automations/edit', role: 'USER' },
  { pattern: '/api/automations', role: 'VIEWER' },
  { pattern: '/api/devices', role: 'VIEWER' },
  { pattern: '/api/scenes', role: 'VIEWER' },
  { pattern: '/api', role: 'VIEWER' },
];

/**
 * APIAuthenticationGateway – centralised authentication, authorisation and
 * audit-logging gateway for every Homey Smart Home API endpoint.
 *
 * Addresses the critical vulnerability of 560+ unauthenticated endpoints by
 * providing token-based auth, RBAC, rate-limiting, IP lockout, audit trails
 * and security-header helpers.
 *
 * @extends EventEmitter
 *
 * @example
 *   const gateway = APIAuthenticationGateway.getInstance();
 *   const { token } = gateway.createToken('user-1', 'USER');
 *   const result  = gateway.authenticate(req);
 */
class APIAuthenticationGateway extends EventEmitter {
  /**
   * @private – use {@link APIAuthenticationGateway.getInstance} instead.
   */
  constructor() {
    super();

    /** @type {Map<string, TokenRecord>} id → record */
    this._tokens = new Map();

    /** @type {Map<string, RateLimitEntry>} tokenId → entry */
    this._tokenRateLimits = new Map();

    /** @type {Map<string, RateLimitEntry>} ip → entry */
    this._ipRateLimits = new Map();

    /** @type {Map<string, number[]>} ip → failure timestamps */
    this._failedAttempts = new Map();

    /** @type {Map<string, number>} ip → lockout expiry timestamp */
    this._lockedIPs = new Map();

    /** @type {AuditEntry[]} Bounded audit log */
    this._auditLog = [];

    /** @type {Array<{pattern: string, role: Role}>} */
    this._routePermissions = [...DEFAULT_ROUTE_PERMISSIONS];

    /** @type {Map<string, number>} route pattern → custom rate limit */
    this._routeRateLimits = new Map();

    /** @type {Set<string>} */
    this._publicPaths = new Set(PUBLIC_PATHS);

    this._cleanupInterval = setInterval(() => this._cleanup(), 5 * 60 * 1000);
    if (this._cleanupInterval.unref) this._cleanupInterval.unref();
  }

  /* ------------------------------------------------------------------
   *  Singleton
   * ----------------------------------------------------------------*/

  /** @type {APIAuthenticationGateway|null} */
  static _instance = null;

  /**
   * Return the singleton gateway instance.
   * @returns {APIAuthenticationGateway}
   */
  static getInstance() {
    if (!APIAuthenticationGateway._instance) {
      APIAuthenticationGateway._instance = new APIAuthenticationGateway();
    }
    return APIAuthenticationGateway._instance;
  }

  /**
   * Reset the singleton – primarily for testing.
   */
  static resetInstance() {
    if (APIAuthenticationGateway._instance) {
      clearInterval(APIAuthenticationGateway._instance._cleanupInterval);
      APIAuthenticationGateway._instance.removeAllListeners();
      APIAuthenticationGateway._instance = null;
    }
  }

  /* ------------------------------------------------------------------
   *  Token Management API
   * ----------------------------------------------------------------*/

  /**
   * Create a new API token for the given user.
   *
   * @param {string} userId  - Unique identifier of the user.
   * @param {Role}   role    - Role to assign to the token.
   * @param {number} [ttl]   - Time-to-live in milliseconds (default 24 h).
   * @returns {{ tokenId: string, token: string, expiresAt: number }}
   * @throws {Error} If the user already holds {@link MAX_TOKENS_PER_USER} tokens.
   */
  createToken(userId, role = 'VIEWER', ttl = DEFAULT_TTL_MS) {
    if (!userId || typeof userId !== 'string') {
      throw new Error('userId must be a non-empty string');
    }
    if (!['ADMIN', 'USER', 'VIEWER', 'SYSTEM'].includes(role)) {
      throw new Error(`Invalid role: ${role}`);
    }

    // Enforce per-user token cap
    const userTokenCount = [...this._tokens.values()]
      .filter(t => t.userId === userId && t.expiresAt > Date.now()).length;
    if (userTokenCount >= MAX_TOKENS_PER_USER) {
      throw new Error(`User ${userId} has reached the maximum of ${MAX_TOKENS_PER_USER} active tokens`);
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenId = crypto.randomBytes(16).toString('hex');
    const hashedToken = this._hashToken(rawToken);
    const now = Date.now();

    /** @type {TokenRecord} */
    const record = {
      id: tokenId,
      hashedToken,
      userId,
      role,
      createdAt: now,
      expiresAt: now + ttl,
      lastUsedAt: now,
    };

    this._tokens.set(tokenId, record);
    this.emit('token-created', { tokenId, userId, role, expiresAt: record.expiresAt });

    return { tokenId, token: rawToken, expiresAt: record.expiresAt };
  }

  /**
   * Revoke (delete) an existing token by its ID.
   *
   * @param {string} tokenId - The token identifier to revoke.
   * @returns {boolean} `true` if the token existed and was removed.
   */
  revokeToken(tokenId) {
    const existed = this._tokens.delete(tokenId);
    this._tokenRateLimits.delete(tokenId);
    if (existed) {
      this.emit('token-revoked', { tokenId });
    }
    return existed;
  }

  /**
   * List all currently active (non-expired) tokens.
   * Raw token values are never exposed.
   *
   * @returns {Array<{id: string, userId: string, role: Role, createdAt: number, expiresAt: number, lastUsedAt: number}>}
   */
  listActiveTokens() {
    const now = Date.now();
    const active = [];
    for (const record of this._tokens.values()) {
      if (record.expiresAt > now) {
        active.push({
          id: record.id,
          userId: record.userId,
          role: record.role,
          createdAt: record.createdAt,
          expiresAt: record.expiresAt,
          lastUsedAt: record.lastUsedAt,
        });
      }
    }
    return active;
  }

  /**
   * Rotate a token: revoke the old one and issue a fresh token for the same
   * user and role with a new TTL.
   *
   * @param {string} oldTokenId - The token to replace.
   * @param {number} [ttl]      - TTL for the new token (default 24 h).
   * @returns {{ tokenId: string, token: string, expiresAt: number }}
   * @throws {Error} If the old token does not exist or is already expired.
   */
  rotateToken(oldTokenId, ttl = DEFAULT_TTL_MS) {
    const old = this._tokens.get(oldTokenId);
    if (!old) {
      throw new Error(`Token ${oldTokenId} not found`);
    }
    if (old.expiresAt <= Date.now()) {
      this._tokens.delete(oldTokenId);
      throw new Error(`Token ${oldTokenId} has expired`);
    }

    const { userId, role } = old;
    this.revokeToken(oldTokenId);
    return this.createToken(userId, role, ttl);
  }

  /**
   * Refresh an existing token's expiration without changing the raw value.
   *
   * @param {string} tokenId - Token to refresh.
   * @param {number} [ttl]   - New TTL from now (default 24 h).
   * @returns {{ tokenId: string, expiresAt: number }}
   * @throws {Error} If the token does not exist or is expired.
   */
  refreshToken(tokenId, ttl = DEFAULT_TTL_MS) {
    const record = this._tokens.get(tokenId);
    if (!record) {
      throw new Error(`Token ${tokenId} not found`);
    }
    if (record.expiresAt <= Date.now()) {
      this._tokens.delete(tokenId);
      throw new Error(`Token ${tokenId} has expired`);
    }
    record.expiresAt = Date.now() + ttl;
    record.lastUsedAt = Date.now();
    return { tokenId: record.id, expiresAt: record.expiresAt };
  }

  /* ------------------------------------------------------------------
   *  Request Validation
   * ----------------------------------------------------------------*/

  /**
   * Validate an incoming request's Authorization header and return the
   * associated token record.
   *
   * Expected header format: `Bearer <raw-token>`
   *
   * @param {Object} headers - HTTP request headers (lower-cased keys).
   * @param {string} path    - The request path.
   * @returns {{ valid: boolean, tokenRecord?: TokenRecord, reason?: string }}
   */
  validateRequest(headers, path) {
    // Public path bypass
    if (this._isPublicPath(path)) {
      return { valid: true, reason: 'public-endpoint' };
    }

    const authHeader = headers['authorization'] || headers['Authorization'] || '';
    if (!authHeader) {
      return { valid: false, reason: 'Missing Authorization header' };
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return { valid: false, reason: 'Invalid Authorization header format; expected "Bearer <token>"' };
    }

    const rawToken = parts[1];
    const hashed = this._hashToken(rawToken);
    const record = this._findTokenByHash(hashed);

    if (!record) {
      return { valid: false, reason: 'Token not recognised' };
    }
    if (record.expiresAt <= Date.now()) {
      this._tokens.delete(record.id);
      return { valid: false, reason: 'Token expired' };
    }

    record.lastUsedAt = Date.now();
    return { valid: true, tokenRecord: record };
  }

  /**
   * Check whether the request exceeds the allowed body size.
   *
   * @param {Object} headers - HTTP request headers.
   * @returns {{ valid: boolean, reason?: string }}
   */
  validateRequestSize(headers) {
    const contentLength = parseInt(headers['content-length'] || '0', 10);
    if (contentLength > MAX_REQUEST_SIZE_BYTES) {
      return { valid: false, reason: `Request body too large (${contentLength} bytes > ${MAX_REQUEST_SIZE_BYTES} limit)` };
    }
    return { valid: true };
  }

  /* ------------------------------------------------------------------
   *  Rate Limiting
   * ----------------------------------------------------------------*/

  /**
   * Enforce per-token rate limiting.
   *
   * @param {string} tokenId     - Token identifier.
   * @param {string} path        - Request path (used for route-specific limits).
   * @returns {{ allowed: boolean, remaining: number, resetMs: number }}
   */
  checkTokenRateLimit(tokenId, path) {
    const limit = this._getRouteLimitForPath(path) || DEFAULT_TOKEN_RATE_LIMIT;
    return this._checkRateLimit(this._tokenRateLimits, tokenId, limit);
  }

  /**
   * Enforce per-IP rate limiting as a secondary defence.
   *
   * @param {string} ip - Client IP address.
   * @returns {{ allowed: boolean, remaining: number, resetMs: number }}
   */
  checkIPRateLimit(ip) {
    return this._checkRateLimit(this._ipRateLimits, ip, DEFAULT_IP_RATE_LIMIT);
  }

  /**
   * Set a custom rate limit for a specific route pattern.
   *
   * @param {string} pattern       - Route prefix.
   * @param {number} requestsPerMin - Allowed requests per minute.
   */
  setRouteRateLimit(pattern, requestsPerMin) {
    this._routeRateLimits.set(pattern, requestsPerMin);
  }

  /* ------------------------------------------------------------------
   *  Role-Based Access Control (RBAC)
   * ----------------------------------------------------------------*/

  /**
   * Determine whether a role satisfies the minimum required role.
   *
   * SYSTEM role is treated specially: it grants access only to `/api/system`
   * prefixed routes but is otherwise equivalent to ADMIN for its own routes.
   *
   * @param {Role} actualRole   - The role attached to the token.
   * @param {Role} requiredRole - The minimum role for the resource.
   * @returns {boolean}
   */
  hasPermission(actualRole, requiredRole) {
    if (actualRole === 'ADMIN') return true;
    if (actualRole === 'SYSTEM' && requiredRole === 'SYSTEM') return true;
    if (requiredRole === 'SYSTEM') return actualRole === 'ADMIN';

    const actualIdx = ROLE_HIERARCHY.indexOf(actualRole);
    const requiredIdx = ROLE_HIERARCHY.indexOf(requiredRole);
    if (actualIdx === -1 || requiredIdx === -1) return false;
    return actualIdx >= requiredIdx;
  }

  /**
   * Resolve the minimum role required for a given path based on configured
   * route permission rules.
   *
   * @param {string} path - Request path.
   * @returns {Role} The required role, defaults to 'VIEWER'.
   */
  getRequiredRole(path) {
    for (const { pattern, role } of this._routePermissions) {
      if (path.startsWith(pattern)) {
        return role;
      }
    }
    return 'VIEWER';
  }

  /**
   * Add or update a route permission rule.
   *
   * @param {string} pattern - Route prefix pattern.
   * @param {Role}   role    - Minimum role required.
   */
  setRoutePermission(pattern, role) {
    const existing = this._routePermissions.find(r => r.pattern === pattern);
    if (existing) {
      existing.role = role;
    } else {
      this._routePermissions.push({ pattern, role });
      // Re-sort so longer (more specific) patterns match first
      this._routePermissions.sort((a, b) => b.pattern.length - a.pattern.length);
    }
  }

  /* ------------------------------------------------------------------
   *  Audit Logging
   * ----------------------------------------------------------------*/

  /**
   * Append an entry to the bounded audit log.
   *
   * @param {Omit<AuditEntry, 'timestamp'>} entry
   */
  addAuditEntry(entry) {
    /** @type {AuditEntry} */
    const full = { timestamp: Date.now(), ...entry };
    this._auditLog.push(full);
    if (this._auditLog.length > MAX_AUDIT_ENTRIES) {
      this._auditLog.splice(0, this._auditLog.length - MAX_AUDIT_ENTRIES);
    }
  }

  /**
   * Retrieve the most recent audit log entries.
   *
   * @param {number} [count=50] - Number of entries to return.
   * @returns {AuditEntry[]}
   */
  getAuditLog(count = 50) {
    return this._auditLog.slice(-count);
  }

  /**
   * Record a failed authentication attempt and check for lockout.
   *
   * @param {string} ip   - Source IP.
   * @param {string} path - Request path.
   * @returns {{ locked: boolean }}
   */
  recordFailure(ip, path) {
    const now = Date.now();
    if (!this._failedAttempts.has(ip)) {
      this._failedAttempts.set(ip, []);
    }
    const attempts = this._failedAttempts.get(ip);
    attempts.push(now);

    // Trim to observation window
    const windowStart = now - LOCKOUT_WINDOW_MS;
    while (attempts.length && attempts[0] < windowStart) {
      attempts.shift();
    }

    if (attempts.length >= LOCKOUT_THRESHOLD) {
      this._lockedIPs.set(ip, now + LOCKOUT_DURATION_MS);
      this.emit('lockout', { ip, failures: attempts.length });
      this.addAuditEntry({ event: 'lockout', ip, path, userId: null, success: false, reason: `IP locked after ${attempts.length} failures` });
      return { locked: true };
    }

    // Suspicious-activity heuristic: ≥5 failures within 2 minutes
    const recentWindow = now - 2 * 60 * 1000;
    const recentFailures = attempts.filter(t => t >= recentWindow).length;
    if (recentFailures >= 5) {
      this.emit('suspicious-activity', { ip, recentFailures, path });
    }

    return { locked: false };
  }

  /**
   * Check whether an IP is currently locked out.
   *
   * @param {string} ip
   * @returns {boolean}
   */
  isIPLocked(ip) {
    const expiry = this._lockedIPs.get(ip);
    if (!expiry) return false;
    if (Date.now() >= expiry) {
      this._lockedIPs.delete(ip);
      this._failedAttempts.delete(ip);
      return false;
    }
    return true;
  }

  /* ------------------------------------------------------------------
   *  Security Headers
   * ----------------------------------------------------------------*/

  /**
   * Generate recommended security headers for an API response.
   *
   * @param {Object} [options]
   * @param {string} [options.allowOrigin='*'] - CORS allowed origin.
   * @param {string} [options.allowMethods='GET,POST,PUT,DELETE,OPTIONS'] - Allowed methods.
   * @param {string} [options.allowHeaders='Content-Type,Authorization'] - Allowed headers.
   * @returns {Object<string,string>}
   */
  getSecurityHeaders(options = {}) {
    const {
      allowOrigin = '*',
      allowMethods = 'GET,POST,PUT,DELETE,OPTIONS',
      allowHeaders = 'Content-Type,Authorization',
    } = options;

    return {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Content-Security-Policy': "default-src 'none'",
      'Referrer-Policy': 'no-referrer',
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Methods': allowMethods,
      'Access-Control-Allow-Headers': allowHeaders,
      'Access-Control-Max-Age': '86400',
    };
  }

  /**
   * Validate the Content-Type header against an expected value.
   *
   * @param {Object} headers       - Request headers.
   * @param {string} [expected='application/json'] - Expected content type.
   * @returns {{ valid: boolean, reason?: string }}
   */
  validateContentType(headers, expected = 'application/json') {
    const ct = (headers['content-type'] || '').toLowerCase();
    if (!ct) return { valid: true }; // No body – nothing to validate
    if (!ct.startsWith(expected)) {
      return { valid: false, reason: `Unexpected Content-Type "${ct}"; expected "${expected}"` };
    }
    return { valid: true };
  }

  /* ------------------------------------------------------------------
   *  Middleware Integration
   * ----------------------------------------------------------------*/

  /**
   * Main authentication middleware.  Validates the token, enforces rate
   * limits and IP lockout, and records an audit entry.
   *
   * @param {Object} req       - Incoming request-like object.
   * @param {Object} req.headers - HTTP headers.
   * @param {string} req.path    - Request path.
   * @param {string} [req.ip]    - Client IP address.
   * @returns {{ authenticated: boolean, tokenRecord?: TokenRecord, error?: string, statusCode?: number }}
   */
  authenticate(req) {
    const ip = req.ip || 'unknown';
    const path = req.path || '/';

    // 1. IP lockout check
    if (this.isIPLocked(ip)) {
      this.addAuditEntry({ event: 'auth-attempt', ip, path, userId: null, success: false, reason: 'IP locked out' });
      return { authenticated: false, error: 'Too many failed attempts – try again later', statusCode: 429 };
    }

    // 2. Public path shortcut
    if (this._isPublicPath(path)) {
      return { authenticated: true };
    }

    // 3. IP rate limit
    const ipRL = this.checkIPRateLimit(ip);
    if (!ipRL.allowed) {
      this.addAuditEntry({ event: 'rate-limit', ip, path, userId: null, success: false, reason: 'IP rate limit exceeded' });
      return { authenticated: false, error: 'IP rate limit exceeded', statusCode: 429 };
    }

    // 4. Request size
    const sizeCheck = this.validateRequestSize(req.headers || {});
    if (!sizeCheck.valid) {
      return { authenticated: false, error: sizeCheck.reason, statusCode: 413 };
    }

    // 5. Token validation
    const validation = this.validateRequest(req.headers || {}, path);
    if (!validation.valid) {
      this.recordFailure(ip, path);
      this.addAuditEntry({ event: 'auth-failure', ip, path, userId: null, success: false, reason: validation.reason });
      this.emit('auth-failure', { ip, path, reason: validation.reason });
      return { authenticated: false, error: validation.reason, statusCode: 401 };
    }

    // 6. Per-token rate limit
    if (validation.tokenRecord) {
      const tokenRL = this.checkTokenRateLimit(validation.tokenRecord.id, path);
      if (!tokenRL.allowed) {
        this.addAuditEntry({ event: 'rate-limit', ip, path, userId: validation.tokenRecord.userId, success: false, reason: 'Token rate limit exceeded' });
        return { authenticated: false, error: 'Token rate limit exceeded', statusCode: 429 };
      }
    }

    // Success
    const userId = validation.tokenRecord?.userId || null;
    this.addAuditEntry({ event: 'auth-success', ip, path, userId, success: true, reason: 'Authenticated' });
    this.emit('auth-success', { ip, path, userId });

    return { authenticated: true, tokenRecord: validation.tokenRecord };
  }

  /**
   * Authorisation check – verifies that the token's role meets the
   * minimum requirement for the requested path.
   *
   * @param {Object}  req          - Request object (after authentication).
   * @param {Role}    [requiredRole] - Explicit minimum role; if omitted the
   *                                   role is inferred from the route table.
   * @returns {{ authorized: boolean, error?: string, statusCode?: number }}
   */
  authorize(req, requiredRole) {
    const path = req.path || '/';
    const role = requiredRole || this.getRequiredRole(path);
    const tokenRole = req.tokenRecord?.role;

    if (!tokenRole) {
      return { authorized: false, error: 'No role information available', statusCode: 403 };
    }

    if (!this.hasPermission(tokenRole, role)) {
      const ip = req.ip || 'unknown';
      this.addAuditEntry({ event: 'authz-failure', ip, path, userId: req.tokenRecord?.userId || null, success: false, reason: `Role ${tokenRole} insufficient; ${role} required` });
      return { authorized: false, error: `Insufficient permissions: ${role} role required`, statusCode: 403 };
    }

    return { authorized: true };
  }

  /**
   * Build a middleware function compatible with Homey API handlers.
   *
   * The returned function accepts a request-like object, performs
   * authentication and authorisation, and returns a result object.
   *
   * @param {MiddlewareOptions} [options={}]
   * @returns {function(Object): { success: boolean, error?: string, statusCode?: number, tokenRecord?: TokenRecord, headers: Object }}
   *
   * @example
   *   const mw = gateway.createMiddleware({ requiredRole: 'USER' });
   *   const result = mw(req);
   *   if (!result.success) return res.status(result.statusCode).json({ error: result.error });
   */
  createMiddleware(options = {}) {
    const { requiredRole, rateLimit, skipAuth = false } = options;

    return (req) => {
      const secHeaders = this.getSecurityHeaders();

      // Skip auth entirely for opted-out routes
      if (skipAuth) {
        return { success: true, headers: secHeaders };
      }

      // Content-Type validation for mutating methods
      const method = (req.method || 'GET').toUpperCase();
      if (['POST', 'PUT', 'PATCH'].includes(method)) {
        const ctCheck = this.validateContentType(req.headers || {});
        if (!ctCheck.valid) {
          return { success: false, error: ctCheck.reason, statusCode: 415, headers: secHeaders };
        }
      }

      // Authenticate
      const authResult = this.authenticate(req);
      if (!authResult.authenticated) {
        return { success: false, error: authResult.error, statusCode: authResult.statusCode, headers: secHeaders };
      }

      // Authorise
      if (authResult.tokenRecord) {
        req.tokenRecord = authResult.tokenRecord;
        const authzResult = this.authorize(req, requiredRole);
        if (!authzResult.authorized) {
          return { success: false, error: authzResult.error, statusCode: authzResult.statusCode, headers: secHeaders };
        }
      }

      return { success: true, tokenRecord: authResult.tokenRecord, headers: secHeaders };
    };
  }

  /* ------------------------------------------------------------------
   *  Public-Path Management
   * ----------------------------------------------------------------*/

  /**
   * Register an additional public (unauthenticated) path.
   *
   * @param {string} path
   */
  addPublicPath(path) {
    this._publicPaths.add(path);
  }

  /**
   * Remove a path from the public whitelist.
   *
   * @param {string} path
   * @returns {boolean}
   */
  removePublicPath(path) {
    return this._publicPaths.delete(path);
  }

  /* ------------------------------------------------------------------
   *  Statistics / Introspection
   * ----------------------------------------------------------------*/

  /**
   * Return a snapshot of gateway statistics.
   *
   * @returns {Object}
   */
  getStats() {
    const now = Date.now();
    return {
      activeTokens: [...this._tokens.values()].filter(t => t.expiresAt > now).length,
      totalTokensIssued: this._tokens.size,
      lockedIPs: this._lockedIPs.size,
      auditLogSize: this._auditLog.length,
      publicPaths: [...this._publicPaths],
    };
  }

  /* ------------------------------------------------------------------
   *  Private Helpers
   * ----------------------------------------------------------------*/

  /**
   * Hash a raw token string with SHA-256.
   *
   * @private
   * @param {string} raw
   * @returns {string} Hex-encoded hash.
   */
  _hashToken(raw) {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Find a token record by its hashed value.
   *
   * @private
   * @param {string} hashed
   * @returns {TokenRecord|undefined}
   */
  _findTokenByHash(hashed) {
    for (const record of this._tokens.values()) {
      if (record.hashedToken === hashed) return record;
    }
    return undefined;
  }

  /**
   * Determine whether a path is on the public whitelist.
   *
   * @private
   * @param {string} path
   * @returns {boolean}
   */
  _isPublicPath(path) {
    if (this._publicPaths.has(path)) return true;
    // Normalise trailing slash
    const normalised = path.endsWith('/') ? path.slice(0, -1) : path + '/';
    return this._publicPaths.has(normalised);
  }

  /**
   * Generic sliding-window rate limiter.
   *
   * @private
   * @param {Map<string, RateLimitEntry>} store
   * @param {string} key
   * @param {number} limit - Requests per minute.
   * @returns {{ allowed: boolean, remaining: number, resetMs: number }}
   */
  _checkRateLimit(store, key, limit) {
    const now = Date.now();
    if (!store.has(key)) {
      store.set(key, { timestamps: [] });
    }
    const entry = store.get(key);
    const windowStart = now - RATE_LIMIT_WINDOW_MS;

    // Prune old timestamps
    entry.timestamps = entry.timestamps.filter(t => t > windowStart);
    const remaining = Math.max(0, limit - entry.timestamps.length);

    if (entry.timestamps.length >= limit) {
      const resetMs = entry.timestamps[0] + RATE_LIMIT_WINDOW_MS - now;
      return { allowed: false, remaining: 0, resetMs };
    }

    entry.timestamps.push(now);
    return { allowed: true, remaining: remaining - 1, resetMs: RATE_LIMIT_WINDOW_MS };
  }

  /**
   * Resolve a route-specific rate limit, if one has been configured.
   *
   * @private
   * @param {string} path
   * @returns {number|null}
   */
  _getRouteLimitForPath(path) {
    for (const [pattern, limit] of this._routeRateLimits.entries()) {
      if (path.startsWith(pattern)) return limit;
    }
    return null;
  }

  /**
   * Periodic cleanup of expired tokens, stale rate-limit windows, and
   * lapsed lockout records.
   *
   * @private
   */
  _cleanup() {
    const now = Date.now();

    // Expired tokens
    for (const [id, record] of this._tokens.entries()) {
      if (record.expiresAt <= now) {
        this._tokens.delete(id);
        this._tokenRateLimits.delete(id);
      }
    }

    // Expired lockouts
    for (const [ip, expiry] of this._lockedIPs.entries()) {
      if (now >= expiry) {
        this._lockedIPs.delete(ip);
        this._failedAttempts.delete(ip);
      }
    }

    // Stale rate-limit entries (no activity in last 2 windows)
    const staleThreshold = now - RATE_LIMIT_WINDOW_MS * 2;
    for (const [key, entry] of this._ipRateLimits.entries()) {
      if (!entry.timestamps.length || entry.timestamps[entry.timestamps.length - 1] < staleThreshold) {
        this._ipRateLimits.delete(key);
      }
    }
  }

  /**
   * Gracefully shut down the gateway, clearing timers.
   */
  destroy() {
    clearInterval(this._cleanupInterval);
    this.removeAllListeners();
  }
}

module.exports = APIAuthenticationGateway;
