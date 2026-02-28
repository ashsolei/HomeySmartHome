'use strict';

/**
 * Validation index — re-exports all validation utilities.
 *
 * @module lib/validation
 */

const { validate, validateOrThrow } = require('./validator');
const { deepSanitize, sanitizeMiddleware } = require('./sanitize');
const SCHEMAS = require('./schemas');

module.exports = {
  validate,
  validateOrThrow,
  deepSanitize,
  sanitizeMiddleware,
  SCHEMAS,
};
