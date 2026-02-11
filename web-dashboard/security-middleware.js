/**
 * Security Middleware for Smart Home Pro
 * Implements rate limiting, request validation, and security headers
 */

'use strict';

const crypto = require('crypto');

class SecurityMiddleware {
  constructor(options = {}) {
    this.options = {
      enableRateLimiting: options.enableRateLimiting !== false,
      maxRequestsPerMinute: options.maxRequestsPerMinute || 100,
      enableRequestValidation: options.enableRequestValidation !== false,
      enableCSRFProtection: options.enableCSRFProtection !== false,
      jwtSecret: options.jwtSecret || process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex'),
      ...options
    };

    // Rate limiting store (in-memory, consider Redis for production)
    this.rateLimitStore = new Map();
    this.csrfTokens = new Map();

    // Clean up old entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Rate limiting middleware
   */
  rateLimit() {
    return (req, res, next) => {
      if (!this.options.enableRateLimiting) {
        return next();
      }

      const clientId = this.getClientIdentifier(req);
      const now = Date.now();
      const windowStart = now - 60000; // 1 minute window

      // Get or create client record
      if (!this.rateLimitStore.has(clientId)) {
        this.rateLimitStore.set(clientId, []);
      }

      const requests = this.rateLimitStore.get(clientId);
      
      // Remove old requests outside the window
      const recentRequests = requests.filter(timestamp => timestamp > windowStart);
      
      // Check rate limit
      if (recentRequests.length >= this.options.maxRequestsPerMinute) {
        return res.status(429).json({
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Maximum ${this.options.maxRequestsPerMinute} requests per minute.`,
          retryAfter: 60
        });
      }

      // Add current request
      recentRequests.push(now);
      this.rateLimitStore.set(clientId, recentRequests);

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', this.options.maxRequestsPerMinute);
      res.setHeader('X-RateLimit-Remaining', this.options.maxRequestsPerMinute - recentRequests.length);
      res.setHeader('X-RateLimit-Reset', Math.ceil((windowStart + 60000) / 1000));

      next();
    };
  }

  /**
   * Request validation middleware
   */
  validateRequest() {
    return (req, res, next) => {
      if (!this.options.enableRequestValidation) {
        return next();
      }

      // Validate content-type for POST/PUT/PATCH
      if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        const contentType = req.headers['content-type'];
        if (!contentType || !contentType.includes('application/json')) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'Content-Type must be application/json'
          });
        }
      }

      // Validate body size (prevent large payloads)
      const contentLength = parseInt(req.headers['content-length'] || '0', 10);
      if (contentLength > 10 * 1024 * 1024) { // 10MB limit
        return res.status(413).json({
          error: 'Payload Too Large',
          message: 'Request body exceeds maximum size of 10MB'
        });
      }

      next();
    };
  }

  /**
   * Security headers middleware
   */
  securityHeaders() {
    return (req, res, next) => {
      // Prevent clickjacking
      res.setHeader('X-Frame-Options', 'DENY');
      
      // Prevent MIME type sniffing
      res.setHeader('X-Content-Type-Options', 'nosniff');
      
      // Enable XSS protection
      res.setHeader('X-XSS-Protection', '1; mode=block');
      
      // Referrer policy
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      
      // Content Security Policy
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'");
      
      // Strict Transport Security (HTTPS only)
      if (req.secure) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      }

      next();
    };
  }

  /**
   * CSRF protection
   */
  csrfProtection() {
    return {
      generateToken: (req, res, next) => {
        if (!this.options.enableCSRFProtection) {
          return next();
        }

        const token = crypto.randomBytes(32).toString('hex');
        const sessionId = this.getClientIdentifier(req);
        
        this.csrfTokens.set(sessionId, {
          token,
          timestamp: Date.now()
        });

        req.csrfToken = token;
        res.setHeader('X-CSRF-Token', token);
        next();
      },

      validateToken: (req, res, next) => {
        if (!this.options.enableCSRFProtection) {
          return next();
        }

        // Skip validation for GET, HEAD, OPTIONS
        if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
          return next();
        }

        const sessionId = this.getClientIdentifier(req);
        const providedToken = req.headers['x-csrf-token'];
        const storedData = this.csrfTokens.get(sessionId);

        if (!storedData || !providedToken || storedData.token !== providedToken) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Invalid or missing CSRF token'
          });
        }

        // Token is valid - refresh it
        const newToken = crypto.randomBytes(32).toString('hex');
        this.csrfTokens.set(sessionId, {
          token: newToken,
          timestamp: Date.now()
        });

        res.setHeader('X-CSRF-Token', newToken);
        next();
      }
    };
  }

  /**
   * Get client identifier for rate limiting
   */
  getClientIdentifier(req) {
    // Use X-Forwarded-For if behind proxy, otherwise use remoteAddress
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || 
                req.connection.remoteAddress ||
                req.socket.remoteAddress;
    
    // Combine with user agent for better uniqueness
    const userAgent = req.headers['user-agent'] || 'unknown';
    return crypto.createHash('sha256').update(`${ip}-${userAgent}`).digest('hex');
  }

  /**
   * Cleanup old entries
   */
  cleanup() {
    const now = Date.now();
    const maxAge = 3600000; // 1 hour

    // Cleanup rate limit store
    for (const [clientId, requests] of this.rateLimitStore.entries()) {
      const recentRequests = requests.filter(timestamp => timestamp > now - 60000);
      if (recentRequests.length === 0) {
        this.rateLimitStore.delete(clientId);
      } else {
        this.rateLimitStore.set(clientId, recentRequests);
      }
    }

    // Cleanup CSRF tokens
    for (const [sessionId, data] of this.csrfTokens.entries()) {
      if (now - data.timestamp > maxAge) {
        this.csrfTokens.delete(sessionId);
      }
    }
  }

  /**
   * Get middleware stats
   */
  getStats() {
    return {
      rateLimitStore: {
        size: this.rateLimitStore.size,
        clients: Array.from(this.rateLimitStore.entries()).map(([id, requests]) => ({
          id: id.substring(0, 8),
          requestCount: requests.length
        }))
      },
      csrfTokens: {
        size: this.csrfTokens.size
      }
    };
  }
}

module.exports = SecurityMiddleware;
