'use strict';

/**
 * Input validation engine.
 *
 * Validates a value against a schema definition supporting types:
 * string, number, boolean, object, array.
 *
 * Returns an array of error objects. Empty array means valid.
 *
 * @module lib/validation/validator
 */

/**
 * Validate a single value against a schema.
 *
 * @param {*}      value  - The value to validate.
 * @param {object} schema - Schema definition with type, constraints.
 * @returns {Array<{message: string, field?: string}>} Validation errors (empty = valid).
 */
function validate(value, schema) {
  const errors = [];

  // ── String ──
  if (schema.type === 'string') {
    if (typeof value !== 'string') {
      return [{ message: schema.message || `Expected string, got ${typeof value}` }];
    }
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push({ message: schema.message || `Must be at least ${schema.minLength} characters` });
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push({ message: schema.message || `Must be at most ${schema.maxLength} characters` });
    }
    if (schema.pattern && !schema.pattern.test(value)) {
      errors.push({ message: schema.message || 'Invalid format' });
    }
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push({ message: schema.message || `Must be one of: ${schema.enum.join(', ')}` });
    }
    return errors;
  }

  // ── Number ──
  if (schema.type === 'number') {
    const num = typeof value === 'number' ? value : Number(value);
    if (typeof value !== 'number' || isNaN(value)) {
      return [{ message: schema.message || `Expected number, got ${typeof value}` }];
    }
    if (schema.integer && !Number.isInteger(num)) {
      errors.push({ message: schema.message || 'Must be an integer' });
    }
    if (schema.min !== undefined && num < schema.min) {
      errors.push({ message: schema.message || `Must be at least ${schema.min}` });
    }
    if (schema.max !== undefined && num > schema.max) {
      errors.push({ message: schema.message || `Must be at most ${schema.max}` });
    }
    return errors;
  }

  // ── Boolean ──
  if (schema.type === 'boolean') {
    if (typeof value !== 'boolean') {
      return [{ message: schema.message || `Expected boolean, got ${typeof value}` }];
    }
    return errors;
  }

  // ── Array ──
  if (schema.type === 'array') {
    if (!Array.isArray(value)) {
      return [{ message: schema.message || 'Expected an array' }];
    }
    return errors;
  }

  // ── Object ──
  if (schema.type === 'object') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return [{ message: 'Expected an object' }];
    }
    if (schema.required) {
      for (const key of schema.required) {
        if (value[key] === undefined || value[key] === null) {
          errors.push({ message: `Missing required field: ${key}` });
        }
      }
    }
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (value[key] !== undefined && value[key] !== null) {
          const propErrors = validate(value[key], propSchema);
          errors.push(...propErrors.map((e) => ({ field: key, ...e })));
        }
      }
    }
    return errors;
  }

  return errors;
}

/**
 * Validate and throw a 400 error if validation fails.
 * Designed to be called at the top of Homey API handlers.
 *
 * @param {*}      value  - Body or field to validate.
 * @param {object} schema - Validation schema.
 * @param {string} [label='body'] - Label for the error message.
 * @throws {Error} With statusCode 400 on validation failure.
 */
function validateOrThrow(value, schema, label = 'body') {
  const errors = validate(value, schema);
  if (errors.length > 0) {
    const detail = errors.map(e => e.field ? `${e.field}: ${e.message}` : e.message).join('; ');
    const err = new Error(`Invalid ${label}: ${detail}`);
    err.statusCode = 400;
    err.details = errors;
    throw err;
  }
}

module.exports = { validate, validateOrThrow };
