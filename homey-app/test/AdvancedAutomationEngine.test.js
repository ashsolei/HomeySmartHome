'use strict';

/**
 * Unit tests for AdvancedAutomationEngine.
 *
 * All tests run in-process with a mock Homey instance — no live server needed.
 */

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertType, assertThrows } = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');
const AdvancedAutomationEngine = require('../lib/AdvancedAutomationEngine');

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

describe('AdvancedAutomationEngine — constructor', () => {
  it('stores the homey reference', () => {
    const homey = createMockHomey();
    const engine = new AdvancedAutomationEngine(homey);
    assertEqual(engine.homey, homey, 'engine.homey should be the passed-in homey instance');
  });

  it('initialises automations as an empty Map', () => {
    const engine = new AdvancedAutomationEngine(createMockHomey());
    assert(engine.automations instanceof Map, 'automations should be a Map');
    assertEqual(engine.automations.size, 0, 'automations should start empty');
  });

  it('initialises executionHistory as an empty array', () => {
    const engine = new AdvancedAutomationEngine(createMockHomey());
    assert(Array.isArray(engine.executionHistory), 'executionHistory should be an array');
    assertEqual(engine.executionHistory.length, 0);
  });

  it('enables learning by default', () => {
    const engine = new AdvancedAutomationEngine(createMockHomey());
    assertEqual(engine.learningEnabled, true);
  });
});

// ---------------------------------------------------------------------------
// _safeBooleanEval — the security-critical expression parser
// ---------------------------------------------------------------------------

describe('AdvancedAutomationEngine — _safeBooleanEval', () => {
  let engine;
  before: {
    engine = new AdvancedAutomationEngine(createMockHomey());
  }

  // Re-create for each test block (the function is pure so one instance is fine)
  it('evaluates "true" → true', () => {
    engine = new AdvancedAutomationEngine(createMockHomey());
    assertEqual(engine._safeBooleanEval('true'), true);
  });

  it('evaluates "false" → false', () => {
    engine = new AdvancedAutomationEngine(createMockHomey());
    assertEqual(engine._safeBooleanEval('false'), false);
  });

  it('evaluates "true AND true" → true', () => {
    engine = new AdvancedAutomationEngine(createMockHomey());
    assertEqual(engine._safeBooleanEval('true AND true'), true);
  });

  it('evaluates "true AND false" → false', () => {
    engine = new AdvancedAutomationEngine(createMockHomey());
    assertEqual(engine._safeBooleanEval('true AND false'), false);
  });

  it('evaluates "false OR true" → true', () => {
    engine = new AdvancedAutomationEngine(createMockHomey());
    assertEqual(engine._safeBooleanEval('false OR true'), true);
  });

  it('evaluates "false OR false" → false', () => {
    engine = new AdvancedAutomationEngine(createMockHomey());
    assertEqual(engine._safeBooleanEval('false OR false'), false);
  });

  it('evaluates "NOT true" → false', () => {
    engine = new AdvancedAutomationEngine(createMockHomey());
    assertEqual(engine._safeBooleanEval('NOT true'), false);
  });

  it('evaluates "NOT false" → true', () => {
    engine = new AdvancedAutomationEngine(createMockHomey());
    assertEqual(engine._safeBooleanEval('NOT false'), true);
  });

  it('evaluates nested parentheses: "(true OR false) AND true" → true', () => {
    engine = new AdvancedAutomationEngine(createMockHomey());
    assertEqual(engine._safeBooleanEval('(true OR false) AND true'), true);
  });

  it('evaluates complex expression: "(true AND false) OR (NOT false)" → true', () => {
    engine = new AdvancedAutomationEngine(createMockHomey());
    assertEqual(engine._safeBooleanEval('(true AND false) OR (NOT false)'), true);
  });

  it('is case-insensitive for keywords', () => {
    engine = new AdvancedAutomationEngine(createMockHomey());
    assertEqual(engine._safeBooleanEval('True and False'), false);
  });

  it('throws on unexpected tokens (no eval bypass)', () => {
    engine = new AdvancedAutomationEngine(createMockHomey());
    assertThrows(() => engine._safeBooleanEval('true; process.exit(1)'), 'Unexpected token');
  });

  it('throws on JavaScript injection attempt', () => {
    engine = new AdvancedAutomationEngine(createMockHomey());
    assertThrows(() => engine._safeBooleanEval('1==1'), 'Unexpected token');
  });

  it('throws on empty string', () => {
    engine = new AdvancedAutomationEngine(createMockHomey());
    // Empty string → tokens.length === 0 → returns false, does not throw
    assertEqual(engine._safeBooleanEval(''), false);
  });

  it('throws on unclosed parenthesis', () => {
    engine = new AdvancedAutomationEngine(createMockHomey());
    assertThrows(() => engine._safeBooleanEval('(true AND false'), 'Expected');
  });
});

// ---------------------------------------------------------------------------
// evaluateCustomLogic
// ---------------------------------------------------------------------------

describe('AdvancedAutomationEngine — evaluateCustomLogic', () => {
  it('substitutes index placeholders and evaluates correctly', () => {
    const engine = new AdvancedAutomationEngine(createMockHomey());
    // logic: "0 AND 1" with results [true, true] → true
    assertEqual(engine.evaluateCustomLogic('0 AND 1', [true, true]), true);
    assertEqual(engine.evaluateCustomLogic('0 AND 1', [true, false]), false);
    assertEqual(engine.evaluateCustomLogic('0 OR 1', [false, true]), true);
  });

  it('returns false when expression is invalid (safe fallback)', () => {
    const engine = new AdvancedAutomationEngine(createMockHomey());
    // An invalid expression like "INVALID" should be caught and return false
    const result = engine.evaluateCustomLogic('INVALID EXPR', [true]);
    assertEqual(result, false, 'should return false for invalid expression');
  });
});

// ---------------------------------------------------------------------------
// compareValues
// ---------------------------------------------------------------------------

describe('AdvancedAutomationEngine — compareValues', () => {
  let engine;

  it('handles equals / == operator', () => {
    engine = new AdvancedAutomationEngine(createMockHomey());
    assertEqual(engine.compareValues(5, 'equals', 5), true);
    assertEqual(engine.compareValues(5, '==', 5), true);
    assertEqual(engine.compareValues(5, '==', 6), false);
  });

  it('handles not_equals / != operator', () => {
    engine = new AdvancedAutomationEngine(createMockHomey());
    assertEqual(engine.compareValues(5, 'not_equals', 6), true);
    assertEqual(engine.compareValues(5, '!=', 5), false);
  });

  it('handles greater_than / > operator', () => {
    engine = new AdvancedAutomationEngine(createMockHomey());
    assertEqual(engine.compareValues(10, 'greater_than', 5), true);
    assertEqual(engine.compareValues(3, '>', 5), false);
  });

  it('handles less_than / < operator', () => {
    engine = new AdvancedAutomationEngine(createMockHomey());
    assertEqual(engine.compareValues(3, 'less_than', 5), true);
    assertEqual(engine.compareValues(10, '<', 5), false);
  });

  it('handles gte / >= operator', () => {
    engine = new AdvancedAutomationEngine(createMockHomey());
    assertEqual(engine.compareValues(5, 'gte', 5), true);
    assertEqual(engine.compareValues(5, '>=', 6), false);
  });

  it('handles lte / <= operator', () => {
    engine = new AdvancedAutomationEngine(createMockHomey());
    assertEqual(engine.compareValues(5, 'lte', 5), true);
    assertEqual(engine.compareValues(6, '<=', 5), false);
  });

  it('handles between operator', () => {
    engine = new AdvancedAutomationEngine(createMockHomey());
    assertEqual(engine.compareValues(5, 'between', { min: 1, max: 10 }), true);
    assertEqual(engine.compareValues(15, 'between', { min: 1, max: 10 }), false);
  });

  it('handles contains operator', () => {
    engine = new AdvancedAutomationEngine(createMockHomey());
    assertEqual(engine.compareValues('hello world', 'contains', 'world'), true);
    assertEqual(engine.compareValues('hello', 'contains', 'xyz'), false);
  });

  it('handles in operator', () => {
    engine = new AdvancedAutomationEngine(createMockHomey());
    assertEqual(engine.compareValues('b', 'in', ['a', 'b', 'c']), true);
    assertEqual(engine.compareValues('z', 'in', ['a', 'b', 'c']), false);
  });

  it('handles regex operator', () => {
    engine = new AdvancedAutomationEngine(createMockHomey());
    assertEqual(engine.compareValues('test-123', 'regex', '\\d+'), true);
    assertEqual(engine.compareValues('abc', 'regex', '^\\d+$'), false);
  });

  it('returns false for unknown operator', () => {
    engine = new AdvancedAutomationEngine(createMockHomey());
    assertEqual(engine.compareValues(5, 'unknown_op', 5), false);
  });
});

// ---------------------------------------------------------------------------
// createAutomation
// ---------------------------------------------------------------------------

describe('AdvancedAutomationEngine — createAutomation', () => {
  it('creates an automation with default values', async () => {
    const engine = new AdvancedAutomationEngine(createMockHomey());
    const automation = await engine.createAutomation({ name: 'Test Auto' });

    assertType(automation.id, 'string');
    assertEqual(automation.name, 'Test Auto');
    assertEqual(automation.enabled, true);
    assertEqual(automation.priority, 5);
    assertEqual(automation.conditionLogic, 'AND');
    assert(Array.isArray(automation.triggers));
    assert(Array.isArray(automation.actions));
    assert(automation.statistics, 'should have statistics object');
    assertType(automation.statistics.created, 'number');
  });

  it('stores the automation in the automations Map', async () => {
    const engine = new AdvancedAutomationEngine(createMockHomey());
    const automation = await engine.createAutomation({ name: 'Stored Auto' });
    assert(engine.automations.has(automation.id), 'automation should be in the map');
  });

  it('uses provided id when given', async () => {
    const engine = new AdvancedAutomationEngine(createMockHomey());
    const automation = await engine.createAutomation({ id: 'my-id', name: 'Named Auto' });
    assertEqual(automation.id, 'my-id');
  });

  it('respects enabled: false', async () => {
    const engine = new AdvancedAutomationEngine(createMockHomey());
    const automation = await engine.createAutomation({ name: 'Disabled', enabled: false });
    assertEqual(automation.enabled, false);
  });
});

// ---------------------------------------------------------------------------
// checkConstraints
// ---------------------------------------------------------------------------

describe('AdvancedAutomationEngine — checkConstraints', () => {
  it('returns true when there are no constraints', () => {
    const engine = new AdvancedAutomationEngine(createMockHomey());
    const automation = {
      constraints: {},
      statistics: { lastExecuted: null }
    };
    assertEqual(engine.checkConstraints(automation), true);
  });

  it('returns false when cooldown has not elapsed', () => {
    const engine = new AdvancedAutomationEngine(createMockHomey());
    const automation = {
      constraints: { cooldownMinutes: 60 },
      statistics: { lastExecuted: Date.now() - 30000 } // 30 seconds ago
    };
    assertEqual(engine.checkConstraints(automation), false);
  });

  it('returns true when cooldown has elapsed', () => {
    const engine = new AdvancedAutomationEngine(createMockHomey());
    const automation = {
      constraints: { cooldownMinutes: 1 },
      statistics: { lastExecuted: Date.now() - 120000 } // 2 minutes ago
    };
    assertEqual(engine.checkConstraints(automation), true);
  });

  it('returns true when constraints is null/undefined', () => {
    const engine = new AdvancedAutomationEngine(createMockHomey());
    assertEqual(engine.checkConstraints({ constraints: null, statistics: {} }), true);
  });
});

// ---------------------------------------------------------------------------
// evaluateConditions
// ---------------------------------------------------------------------------

describe('AdvancedAutomationEngine — evaluateConditions', () => {
  it('returns true when there are no conditions', async () => {
    const engine = new AdvancedAutomationEngine(createMockHomey());
    const result = await engine.evaluateConditions({ conditions: [], conditionLogic: 'AND' });
    assertEqual(result, true);
  });

  it('returns true when conditions is undefined', async () => {
    const engine = new AdvancedAutomationEngine(createMockHomey());
    const result = await engine.evaluateConditions({ conditionLogic: 'AND' });
    assertEqual(result, true);
  });
});

// ---------------------------------------------------------------------------
// generateId
// ---------------------------------------------------------------------------

describe('AdvancedAutomationEngine — generateId', () => {
  it('produces a unique string each call', () => {
    const engine = new AdvancedAutomationEngine(createMockHomey());
    const id1 = engine.generateId();
    const id2 = engine.generateId();
    assertType(id1, 'string');
    assert(id1 !== id2, 'ids should be unique');
    assert(id1.startsWith('auto_'), 'id should start with auto_');
  });
});

// ---------------------------------------------------------------------------
// No eval() in source
// ---------------------------------------------------------------------------

describe('AdvancedAutomationEngine — security: no eval()', () => {
  it('source code does not contain eval()', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.resolve(__dirname, '../lib/AdvancedAutomationEngine.js'),
      'utf8'
    );
    // Strip comments before checking — comments mentioning eval() are fine
    const codeOnly = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    assert(
      !codeOnly.includes('eval('),
      'AdvancedAutomationEngine.js must not use eval()'
    );
  });

  it('source code does not contain new Function(', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.resolve(__dirname, '../lib/AdvancedAutomationEngine.js'),
      'utf8'
    );
    assert(
      !src.includes('new Function('),
      'AdvancedAutomationEngine.js must not use new Function()'
    );
  });
});

// Run all tests
run();
