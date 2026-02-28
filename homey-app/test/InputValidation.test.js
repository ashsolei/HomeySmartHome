'use strict';

/**
 * Unit tests for the input validation library.
 * Covers: validate(), validateOrThrow(), deepSanitize(), sanitizeMiddleware(),
 * and schema-specific validation for all 18 protected API endpoints.
 */

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual } = require('./helpers/assert');

const { validate, validateOrThrow } = require('../lib/validation/validator');
const { deepSanitize, sanitizeMiddleware } = require('../lib/validation/sanitize');
const SCHEMAS = require('../lib/validation/schemas');

// ---------------------------------------------------------------------------
// validate() — string type
// ---------------------------------------------------------------------------

describe('validate() — string type', () => {
  it('accepts a valid string', () => {
    const errors = validate('hello', { type: 'string' });
    assertEqual(errors.length, 0);
  });

  it('rejects a non-string value', () => {
    const errors = validate(123, { type: 'string' });
    assertEqual(errors.length, 1);
    assert(errors[0].message.includes('string'), 'should mention string');
  });

  it('enforces minLength', () => {
    const errors = validate('ab', { type: 'string', minLength: 3 });
    assertEqual(errors.length, 1);
  });

  it('accepts string at exact minLength', () => {
    const errors = validate('abc', { type: 'string', minLength: 3 });
    assertEqual(errors.length, 0);
  });

  it('enforces maxLength', () => {
    const errors = validate('toolong', { type: 'string', maxLength: 3 });
    assertEqual(errors.length, 1);
  });

  it('enforces pattern', () => {
    const errors = validate('bad value!', { type: 'string', pattern: /^[a-z]+$/ });
    assertEqual(errors.length, 1);
  });

  it('accepts matching pattern', () => {
    const errors = validate('good', { type: 'string', pattern: /^[a-z]+$/ });
    assertEqual(errors.length, 0);
  });

  it('enforces enum', () => {
    const errors = validate('bad', { type: 'string', enum: ['a', 'b', 'c'] });
    assertEqual(errors.length, 1);
  });

  it('accepts valid enum value', () => {
    const errors = validate('b', { type: 'string', enum: ['a', 'b', 'c'] });
    assertEqual(errors.length, 0);
  });
});

// ---------------------------------------------------------------------------
// validate() — number type
// ---------------------------------------------------------------------------

describe('validate() — number type', () => {
  it('accepts a valid number', () => {
    const errors = validate(42, { type: 'number' });
    assertEqual(errors.length, 0);
  });

  it('rejects a string value', () => {
    const errors = validate('not a number', { type: 'number' });
    assertEqual(errors.length, 1);
  });

  it('rejects NaN', () => {
    const errors = validate(NaN, { type: 'number' });
    assertEqual(errors.length, 1);
  });

  it('enforces min', () => {
    const errors = validate(2, { type: 'number', min: 5 });
    assertEqual(errors.length, 1);
  });

  it('enforces max', () => {
    const errors = validate(100, { type: 'number', max: 50 });
    assertEqual(errors.length, 1);
  });

  it('accepts value within range', () => {
    const errors = validate(25, { type: 'number', min: 5, max: 50 });
    assertEqual(errors.length, 0);
  });

  it('enforces integer constraint', () => {
    const errors = validate(3.5, { type: 'number', integer: true });
    assertEqual(errors.length, 1);
  });

  it('accepts valid integer', () => {
    const errors = validate(7, { type: 'number', integer: true });
    assertEqual(errors.length, 0);
  });
});

// ---------------------------------------------------------------------------
// validate() — boolean type
// ---------------------------------------------------------------------------

describe('validate() — boolean type', () => {
  it('accepts true', () => {
    const errors = validate(true, { type: 'boolean' });
    assertEqual(errors.length, 0);
  });

  it('accepts false', () => {
    const errors = validate(false, { type: 'boolean' });
    assertEqual(errors.length, 0);
  });

  it('rejects a string', () => {
    const errors = validate('true', { type: 'boolean' });
    assertEqual(errors.length, 1);
  });
});

// ---------------------------------------------------------------------------
// validate() — array type
// ---------------------------------------------------------------------------

describe('validate() — array type', () => {
  it('accepts a valid array', () => {
    const errors = validate([1, 2], { type: 'array' });
    assertEqual(errors.length, 0);
  });

  it('rejects a non-array', () => {
    const errors = validate('notarray', { type: 'array' });
    assertEqual(errors.length, 1);
  });
});

// ---------------------------------------------------------------------------
// validate() — object type
// ---------------------------------------------------------------------------

describe('validate() — object type', () => {
  it('accepts a valid object', () => {
    const errors = validate({ key: 'val' }, { type: 'object' });
    assertEqual(errors.length, 0);
  });

  it('rejects null', () => {
    const errors = validate(null, { type: 'object' });
    assertEqual(errors.length, 1);
  });

  it('rejects an array', () => {
    const errors = validate([1, 2], { type: 'object' });
    assertEqual(errors.length, 1);
  });

  it('reports missing required fields', () => {
    const schema = { type: 'object', required: ['name', 'email'] };
    const errors = validate({}, schema);
    assertEqual(errors.length, 2);
    assert(errors[0].message.includes('name'));
    assert(errors[1].message.includes('email'));
  });

  it('validates nested properties', () => {
    const schema = {
      type: 'object',
      properties: {
        age: { type: 'number', min: 0, max: 150 },
      },
    };
    const errors = validate({ age: -1 }, schema);
    assertEqual(errors.length, 1);
    assertEqual(errors[0].field, 'age');
  });

  it('skips optional missing fields', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1 },
      },
    };
    const errors = validate({}, schema);
    assertEqual(errors.length, 0, 'missing optional field should not error');
  });
});

// ---------------------------------------------------------------------------
// validateOrThrow()
// ---------------------------------------------------------------------------

describe('validateOrThrow()', () => {
  it('does not throw on valid input', () => {
    validateOrThrow({ name: 'Alice' }, {
      type: 'object',
      required: ['name'],
      properties: { name: { type: 'string', minLength: 1 } },
    });
    // no exception = pass
    assert(true);
  });

  it('throws Error with statusCode 400 on invalid input', () => {
    let caught = null;
    try {
      validateOrThrow({}, {
        type: 'object',
        required: ['name'],
      });
    } catch (err) {
      caught = err;
    }
    assert(caught !== null, 'should throw');
    assertEqual(caught.statusCode, 400);
    assert(caught.message.includes('Invalid body'));
  });

  it('includes details array on the error', () => {
    let caught = null;
    try {
      validateOrThrow({}, {
        type: 'object',
        required: ['a', 'b'],
      });
    } catch (err) {
      caught = err;
    }
    assert(Array.isArray(caught.details));
    assertEqual(caught.details.length, 2);
  });

  it('uses custom label in error message', () => {
    let caught = null;
    try {
      validateOrThrow('bad', { type: 'number' }, 'temperature');
    } catch (err) {
      caught = err;
    }
    assert(caught.message.includes('Invalid temperature'));
  });
});

// ---------------------------------------------------------------------------
// deepSanitize()
// ---------------------------------------------------------------------------

describe('deepSanitize()', () => {
  it('strips __proto__ key', () => {
    const input = JSON.parse('{"__proto__":{"admin":true},"name":"safe"}');
    const result = deepSanitize(input);
    assertEqual(result.name, 'safe');
    assertEqual(result.__proto__.admin, undefined);
  });

  it('strips constructor key', () => {
    const result = deepSanitize({ constructor: { evil: true }, ok: 1 });
    assertEqual(result.ok, 1);
    assert(!Object.hasOwn(result, 'constructor'), 'constructor key should be stripped');
  });

  it('strips prototype key', () => {
    const result = deepSanitize({ prototype: {}, value: 42 });
    assertEqual(result.value, 42);
    assert(!('prototype' in result), 'prototype should be stripped');
  });

  it('handles nested dangerous keys', () => {
    const result = deepSanitize({
      level1: {
        __proto__: { admin: true },
        safe: 'yes',
      },
    });
    assertEqual(result.level1.safe, 'yes');
  });

  it('handles arrays', () => {
    const result = deepSanitize([{ constructor: {}, val: 1 }, { val: 2 }]);
    assert(Array.isArray(result));
    assertEqual(result[0].val, 1);
    assert(!Object.hasOwn(result[0], 'constructor'), 'constructor key should be stripped from array items');
    assertEqual(result[1].val, 2);
  });

  it('returns primitives unmodified', () => {
    assertEqual(deepSanitize(42), 42);
    assertEqual(deepSanitize('hello'), 'hello');
    assertEqual(deepSanitize(null), null);
    assertEqual(deepSanitize(true), true);
  });
});

// ---------------------------------------------------------------------------
// sanitizeMiddleware()
// ---------------------------------------------------------------------------

describe('sanitizeMiddleware()', () => {
  it('sanitizes req.body and calls next', () => {
    let nextCalled = false;
    const req = { body: { constructor: { evil: true }, name: 'ok' } };
    const res = {};
    sanitizeMiddleware(req, res, () => { nextCalled = true; });

    assert(nextCalled, 'next() should be called');
    assertEqual(req.body.name, 'ok');
    assert(!Object.hasOwn(req.body, 'constructor'), 'constructor key should be stripped');
  });

  it('handles null body gracefully', () => {
    let nextCalled = false;
    const req = { body: null };
    sanitizeMiddleware(req, {}, () => { nextCalled = true; });
    assert(nextCalled);
  });

  it('handles missing body gracefully', () => {
    let nextCalled = false;
    const req = {};
    sanitizeMiddleware(req, {}, () => { nextCalled = true; });
    assert(nextCalled);
  });
});

// ---------------------------------------------------------------------------
// Schema validation — unlockDoor
// ---------------------------------------------------------------------------

describe('SCHEMAS.unlockDoor', () => {
  it('accepts valid unlock body', () => {
    const errors = validate({ accessCode: '1234', userId: 'user1' }, SCHEMAS.unlockDoor);
    assertEqual(errors.length, 0);
  });

  it('rejects missing accessCode', () => {
    const errors = validate({ userId: 'user1' }, SCHEMAS.unlockDoor);
    assert(errors.length > 0, 'should require accessCode');
  });

  it('rejects invalid accessCode pattern', () => {
    const errors = validate({ accessCode: 'a b c', userId: 'user1' }, SCHEMAS.unlockDoor);
    assert(errors.length > 0, 'spaces not allowed in accessCode');
  });
});

// ---------------------------------------------------------------------------
// Schema validation — grantTemporaryAccess
// ---------------------------------------------------------------------------

describe('SCHEMAS.grantTemporaryAccess', () => {
  it('accepts valid body', () => {
    const errors = validate(
      { userId: 'guest1', durationHours: 24, allowedLocks: ['front'] },
      SCHEMAS.grantTemporaryAccess,
    );
    assertEqual(errors.length, 0);
  });

  it('rejects missing userId', () => {
    const errors = validate({ durationHours: 12 }, SCHEMAS.grantTemporaryAccess);
    assert(errors.length > 0);
  });

  it('rejects durationHours out of range', () => {
    const errors = validate({ userId: 'g', durationHours: 1000 }, SCHEMAS.grantTemporaryAccess);
    assert(errors.length > 0, 'durationHours > 720 should fail');
  });
});

// ---------------------------------------------------------------------------
// Schema validation — setSecurityMode
// ---------------------------------------------------------------------------

describe('SCHEMAS.setSecurityMode', () => {
  it('accepts valid mode', () => {
    const errors = validate({ mode: 'away' }, SCHEMAS.setSecurityMode);
    assertEqual(errors.length, 0);
  });

  it('rejects invalid mode', () => {
    const errors = validate({ mode: 'panic' }, SCHEMAS.setSecurityMode);
    assert(errors.length > 0);
  });

  it('rejects missing mode', () => {
    const errors = validate({}, SCHEMAS.setSecurityMode);
    assert(errors.length > 0);
  });
});

// ---------------------------------------------------------------------------
// Schema validation — setDeviceState
// ---------------------------------------------------------------------------

describe('SCHEMAS.setDeviceState', () => {
  it('accepts valid body', () => {
    const errors = validate({ capability: 'onoff', value: true }, SCHEMAS.setDeviceState);
    assertEqual(errors.length, 0);
  });

  it('rejects missing capability', () => {
    const errors = validate({ value: true }, SCHEMAS.setDeviceState);
    assert(errors.length > 0);
  });
});

// ---------------------------------------------------------------------------
// Schema validation — setZoneTemperature
// ---------------------------------------------------------------------------

describe('SCHEMAS.setZoneTemperature', () => {
  it('accepts temperature in range', () => {
    const errors = validate({ zoneId: 'living-room', temperature: 21 }, SCHEMAS.setZoneTemperature);
    assertEqual(errors.length, 0);
  });

  it('rejects temperature below min', () => {
    const errors = validate({ zoneId: 'room', temperature: 3 }, SCHEMAS.setZoneTemperature);
    assert(errors.length > 0);
  });

  it('rejects temperature above max', () => {
    const errors = validate({ zoneId: 'room', temperature: 45 }, SCHEMAS.setZoneTemperature);
    assert(errors.length > 0);
  });
});

// ---------------------------------------------------------------------------
// Schema validation — createUser
// ---------------------------------------------------------------------------

describe('SCHEMAS.createUser', () => {
  it('accepts valid user body', () => {
    const errors = validate(
      { name: 'Alice', email: 'alice@example.com', role: 'ADMIN' },
      SCHEMAS.createUser,
    );
    assertEqual(errors.length, 0);
  });

  it('rejects missing name', () => {
    const errors = validate({ email: 'a@b.com' }, SCHEMAS.createUser);
    assert(errors.length > 0);
  });

  it('rejects invalid email', () => {
    const errors = validate({ name: 'Bob', email: 'notanemail' }, SCHEMAS.createUser);
    assert(errors.length > 0);
  });

  it('rejects invalid role', () => {
    const errors = validate({ name: 'Bob', role: 'superadmin' }, SCHEMAS.createUser);
    assert(errors.length > 0);
  });
});

// ---------------------------------------------------------------------------
// Schema validation — createAuthToken
// ---------------------------------------------------------------------------

describe('SCHEMAS.createAuthToken', () => {
  it('accepts valid token request', () => {
    const errors = validate(
      { userId: 'user1', role: 'USER', ttl: 3600 },
      SCHEMAS.createAuthToken,
    );
    assertEqual(errors.length, 0);
  });

  it('rejects missing userId', () => {
    const errors = validate({ role: 'USER' }, SCHEMAS.createAuthToken);
    assert(errors.length > 0);
  });

  it('rejects ttl out of range', () => {
    const errors = validate({ userId: 'u', ttl: 100000 }, SCHEMAS.createAuthToken);
    assert(errors.length > 0);
  });
});

// ---------------------------------------------------------------------------
// Schema validation — controlGarageDoor
// ---------------------------------------------------------------------------

describe('SCHEMAS.controlGarageDoor', () => {
  it('accepts open action', () => {
    const errors = validate({ action: 'open' }, SCHEMAS.controlGarageDoor);
    assertEqual(errors.length, 0);
  });

  it('accepts close action', () => {
    const errors = validate({ action: 'close' }, SCHEMAS.controlGarageDoor);
    assertEqual(errors.length, 0);
  });

  it('rejects invalid action', () => {
    const errors = validate({ action: 'toggle' }, SCHEMAS.controlGarageDoor);
    assert(errors.length > 0);
  });
});

// ---------------------------------------------------------------------------
// Schema validation — controlPurifier
// ---------------------------------------------------------------------------

describe('SCHEMAS.controlPurifier', () => {
  it('accepts valid mode', () => {
    const errors = validate({ mode: 'auto' }, SCHEMAS.controlPurifier);
    assertEqual(errors.length, 0);
  });

  it('rejects invalid mode', () => {
    const errors = validate({ mode: 'blast' }, SCHEMAS.controlPurifier);
    assert(errors.length > 0);
  });
});

// ---------------------------------------------------------------------------
// Schema validation — triggerEmergency
// ---------------------------------------------------------------------------

describe('SCHEMAS.triggerEmergency', () => {
  it('accepts valid emergency', () => {
    const errors = validate(
      { type: 'fire', severity: 'high', location: 'kitchen' },
      SCHEMAS.triggerEmergency,
    );
    assertEqual(errors.length, 0);
  });

  it('rejects missing type', () => {
    const errors = validate({ severity: 'low' }, SCHEMAS.triggerEmergency);
    assert(errors.length > 0);
  });

  it('rejects invalid severity', () => {
    const errors = validate({ type: 'flood', severity: 'extreme' }, SCHEMAS.triggerEmergency);
    assert(errors.length > 0);
  });
});

// ---------------------------------------------------------------------------
// Schema validation — sendNotification
// ---------------------------------------------------------------------------

describe('SCHEMAS.sendNotification', () => {
  it('accepts valid notification', () => {
    const errors = validate({ message: 'Alert!' }, SCHEMAS.sendNotification);
    assertEqual(errors.length, 0);
  });

  it('rejects empty message', () => {
    const errors = validate({ message: '' }, SCHEMAS.sendNotification);
    assert(errors.length > 0);
  });

  it('rejects missing message', () => {
    const errors = validate({}, SCHEMAS.sendNotification);
    assert(errors.length > 0);
  });
});

// ---------------------------------------------------------------------------
// Schema validation — processVoiceInput
// ---------------------------------------------------------------------------

describe('SCHEMAS.processVoiceInput', () => {
  it('accepts valid voice input', () => {
    const errors = validate({ input: 'turn on lights' }, SCHEMAS.processVoiceInput);
    assertEqual(errors.length, 0);
  });

  it('rejects missing input', () => {
    const errors = validate({}, SCHEMAS.processVoiceInput);
    assert(errors.length > 0);
  });

  it('rejects empty input', () => {
    const errors = validate({ input: '' }, SCHEMAS.processVoiceInput);
    assert(errors.length > 0);
  });
});

// ---------------------------------------------------------------------------
// Schema validation — createGuestProfile
// ---------------------------------------------------------------------------

describe('SCHEMAS.createGuestProfile', () => {
  it('accepts valid guest profile', () => {
    const errors = validate({ name: 'Bob', email: 'bob@example.com' }, SCHEMAS.createGuestProfile);
    assertEqual(errors.length, 0);
  });

  it('rejects missing name', () => {
    const errors = validate({ email: 'bob@example.com' }, SCHEMAS.createGuestProfile);
    assert(errors.length > 0);
  });

  it('rejects invalid email format', () => {
    const errors = validate({ name: 'Bob', email: 'invalid' }, SCHEMAS.createGuestProfile);
    assert(errors.length > 0);
  });
});

// ---------------------------------------------------------------------------
// Schema validation — generateGuestAccessCode
// ---------------------------------------------------------------------------

describe('SCHEMAS.generateGuestAccessCode', () => {
  it('accepts valid body', () => {
    const errors = validate({ guestId: 'g1', expiresInHours: 24 }, SCHEMAS.generateGuestAccessCode);
    assertEqual(errors.length, 0);
  });

  it('rejects expiresInHours out of range', () => {
    const errors = validate({ guestId: 'g1', expiresInHours: 1000 }, SCHEMAS.generateGuestAccessCode);
    assert(errors.length > 0);
  });
});

// ---------------------------------------------------------------------------
// Schema validation — createScene and createRoutine
// ---------------------------------------------------------------------------

describe('SCHEMAS.createScene / createRoutine', () => {
  it('accepts valid scene', () => {
    const errors = validate({ id: 'my-scene', name: 'Movie Night' }, SCHEMAS.createScene);
    assertEqual(errors.length, 0);
  });

  it('rejects scene with invalid id chars', () => {
    const errors = validate({ id: 'bad scene!', name: 'Test' }, SCHEMAS.createScene);
    assert(errors.length > 0);
  });

  it('accepts valid routine', () => {
    const errors = validate({ id: 'morning', name: 'Wake Up' }, SCHEMAS.createRoutine);
    assertEqual(errors.length, 0);
  });
});

// ---------------------------------------------------------------------------
run();
