'use strict';

/**
 * Lightweight assertion helpers that throw descriptive errors.
 * No external dependencies required.
 */

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertNotEqual(actual, unexpected, message) {
  if (actual === unexpected) {
    throw new Error(message || `Expected value not to equal ${JSON.stringify(unexpected)}`);
  }
}

function assertDeepEqual(actual, expected, message) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    throw new Error(message || `Deep equal failed:\n  actual:   ${a}\n  expected: ${b}`);
  }
}

function assertType(value, type, message) {
  if (typeof value !== type) {
    throw new Error(message || `Expected type ${type}, got ${typeof value}`);
  }
}

function assertInstanceOf(value, cls, message) {
  if (!(value instanceof cls)) {
    throw new Error(message || `Expected instance of ${cls.name}`);
  }
}

function assertThrows(fn, expectedMessage) {
  let threw = false;
  try {
    fn();
  } catch (err) {
    threw = true;
    if (expectedMessage && !err.message.includes(expectedMessage)) {
      throw new Error(`Expected error message to include "${expectedMessage}", got "${err.message}"`);
    }
  }
  if (!threw) throw new Error('Expected function to throw, but it did not');
}

async function assertRejects(fn, expectedMessage) {
  let threw = false;
  try {
    await fn();
  } catch (err) {
    threw = true;
    if (expectedMessage && !err.message.includes(expectedMessage)) {
      throw new Error(`Expected rejection message to include "${expectedMessage}", got "${err.message}"`);
    }
  }
  if (!threw) throw new Error('Expected async function to reject, but it did not');
}

module.exports = {
  assert,
  assertEqual,
  assertNotEqual,
  assertDeepEqual,
  assertType,
  assertInstanceOf,
  assertThrows,
  assertRejects,
};
