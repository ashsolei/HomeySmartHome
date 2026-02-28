'use strict';

/**
 * Prototype pollution sanitizer.
 *
 * Strips dangerous keys (__proto__, constructor, prototype) from any
 * nested object. Applied as Express middleware to sanitize req.body
 * before it reaches any route handler.
 *
 * @module lib/validation/sanitize
 */

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Recursively strip dangerous keys from an object.
 *
 * @param {*} obj - Value to sanitize.
 * @returns {*} Sanitized value.
 */
function deepSanitize(obj) {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(deepSanitize);

  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    if (DANGEROUS_KEYS.has(key)) continue;
    cleaned[key] = deepSanitize(value);
  }
  return cleaned;
}

/**
 * Express middleware — sanitize req.body before route handlers.
 */
function sanitizeMiddleware(req, _res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = deepSanitize(req.body);
  }
  next();
}

module.exports = { deepSanitize, sanitizeMiddleware };
