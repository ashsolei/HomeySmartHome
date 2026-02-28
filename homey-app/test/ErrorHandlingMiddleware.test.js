'use strict';

const { describe, it, run } = require('./helpers/runner');
const {
  assert, assertEqual, assertNotEqual, assertDeepEqual,
  assertType, assertThrows, assertRejects
} = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');

// The module under test – singleton, so we must destroy between groups
const ErrorHandlingMiddleware = require('../lib/ErrorHandlingMiddleware');

// ── helpers ────────────────────────────────────────────────────────────

function freshInstance() {
  ErrorHandlingMiddleware.destroyInstance();
  const homey = createMockHomey();
  const m = ErrorHandlingMiddleware.getInstance(homey);
  // Suppress EventEmitter 'error' events so test runner doesn't see them
  m.on('error', () => {});
  return m;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── classifyError ──────────────────────────────────────────────────────
// Regex cascade: CRITICAL → HIGH → MEDIUM → INFO → default LOW

describe('ErrorHandlingMiddleware — classifyError', () => {
  it('classifies ECONNREFUSED as INFO', () => {
    const m = freshInstance();
    // /econnrefused/ is in the INFO bucket
    const result = m.classifyError(new Error('connect ECONNREFUSED 127.0.0.1:3000'));
    assertEqual(result, 'INFO');
  });

  it('classifies ETIMEDOUT as MEDIUM', () => {
    const m = freshInstance();
    // /timed?\s*out/ is in the MEDIUM bucket
    const result = m.classifyError(new Error('connect ETIMEDOUT'));
    assertEqual(result, 'MEDIUM');
  });

  it('classifies rate limit errors as INFO', () => {
    const m = freshInstance();
    // /rate.?limit/ is in the INFO bucket
    const result = m.classifyError(new Error('Rate limit exceeded'));
    assertEqual(result, 'INFO');
  });

  it('classifies validation errors as MEDIUM', () => {
    const m = freshInstance();
    const result = m.classifyError(new Error('Validation failed for field name'));
    assertEqual(result, 'MEDIUM');
  });

  it('classifies not found errors as MEDIUM', () => {
    const m = freshInstance();
    // /not found/ is in the MEDIUM bucket
    const result = m.classifyError(new Error('Resource not found'));
    assertEqual(result, 'MEDIUM');
  });

  it('defaults to LOW for unknown errors', () => {
    const m = freshInstance();
    const result = m.classifyError(new Error('something totally unknown'));
    assertEqual(result, 'LOW');
  });

  it('classifies crash errors as CRITICAL', () => {
    const m = freshInstance();
    const result = m.classifyError(new Error('Fatal crash in subsystem'));
    assertEqual(result, 'CRITICAL');
  });

  it('classifies device failures as HIGH', () => {
    const m = freshInstance();
    const result = m.classifyError(new Error('device communication failed'));
    assertEqual(result, 'HIGH');
  });

  it('respects hintSeverity when provided', () => {
    const m = freshInstance();
    const result = m.classifyError(new Error('random'), 'INFO');
    assertEqual(result, 'INFO');
  });
});

// ── recordError ────────────────────────────────────────────────────────

describe('ErrorHandlingMiddleware — recordError', () => {
  it('records an error and returns an entry object', () => {
    const m = freshInstance();
    const entry = m.recordError(new Error('test error'), 'TestSystem', { foo: 1 });
    assertType(entry, 'object');
    assertEqual(entry.system, 'TestSystem');
    assertEqual(entry.error.message, 'test error');
    assertType(entry.id, 'string');
    assertType(entry.timestamp, 'number');
  });

  it('suppresses duplicate errors within the dedup window', () => {
    const m = freshInstance();
    m.recordError(new Error('dup'), 'sys');
    const entry2 = m.recordError(new Error('dup'), 'sys');
    // Duplicate within 5 s window → null
    assertEqual(entry2, null);
  });

  it('records errors from a different system even with same message', () => {
    const m = freshInstance();
    m.recordError(new Error('same'), 'A');
    const entry2 = m.recordError(new Error('same'), 'B');
    assertNotEqual(entry2, null);
  });

  it('caps history at MAX_ERROR_HISTORY (500)', () => {
    const m = freshInstance();
    for (let i = 0; i < 520; i++) {
      m.recordError(new Error(`err-${i}`), `sys-${i}`);
    }
    const report = m.getErrorReport();
    assert(report.totalErrors <= 500, 'should cap at 500');
  });

  it('emits error-storm when threshold exceeded', () => {
    const m = freshInstance();
    let stormEmitted = false;
    m.on('error-storm', () => { stormEmitted = true; });

    // Record 11 errors from same source within storm window (60 s)
    for (let i = 0; i < 11; i++) {
      m.recordError(new Error(`storm-err-${i}`), 'StormSys');
    }

    assertEqual(stormEmitted, true);
  });
});

// ── retry ──────────────────────────────────────────────────────────────

describe('ErrorHandlingMiddleware — retry', () => {
  it('returns result on first success', async () => {
    const m = freshInstance();
    const result = await m.retry(() => 42, 3, 10);
    assertEqual(result, 42);
  });

  it('retries until success', async () => {
    const m = freshInstance();
    let attempts = 0;
    const fn = () => {
      attempts++;
      if (attempts < 3) throw new Error('not yet');
      return 'ok';
    };
    const result = await m.retry(fn, 5, 10);
    assertEqual(result, 'ok');
    assertEqual(attempts, 3);
  });

  it('throws after exhausting retries', async () => {
    const m = freshInstance();
    await assertRejects(async () => {
      await m.retry(() => { throw new Error('always fails'); }, 2, 10);
    });
  });
});

// ── fallback ───────────────────────────────────────────────────────────

describe('ErrorHandlingMiddleware — fallback', () => {
  it('returns primary result when it succeeds', async () => {
    const m = freshInstance();
    const result = await m.fallback(() => 'primary', () => 'backup');
    assertEqual(result, 'primary');
  });

  it('returns fallback result when primary fails', async () => {
    const m = freshInstance();
    const result = await m.fallback(
      () => { throw new Error('fail'); },
      () => 'backup'
    );
    assertEqual(result, 'backup');
  });

  it('throws when both primary and fallback fail', async () => {
    const m = freshInstance();
    await assertRejects(async () => {
      await m.fallback(
        () => { throw new Error('p-fail'); },
        () => { throw new Error('f-fail'); }
      );
    });
  });
});

// ── circuitBreaker ─────────────────────────────────────────────────────

describe('ErrorHandlingMiddleware — circuitBreaker', () => {
  it('passes through when circuit is closed', async () => {
    const m = freshInstance();
    const result = await m.circuitBreaker('test-op', () => 'ok', { threshold: 5, cooldownMs: 100 });
    assertEqual(result, 'ok');
  });

  it('opens circuit after threshold failures', async () => {
    const m = freshInstance();
    const opts = { threshold: 3, cooldownMs: 100 };
    for (let i = 0; i < 3; i++) {
      try { await m.circuitBreaker('fail-op', () => { throw new Error('err'); }, opts); } catch (_e) { /* */ }
    }
    // Circuit should now be open → reject immediately
    await assertRejects(async () => {
      await m.circuitBreaker('fail-op', () => 'should not run', opts);
    });
  });

  it('emits circuit-open event when circuit opens', async () => {
    const m = freshInstance();
    let openEmitted = false;
    m.on('circuit-open', () => { openEmitted = true; });

    const opts = { threshold: 2, cooldownMs: 100 };
    for (let i = 0; i < 2; i++) {
      try { await m.circuitBreaker('open-op', () => { throw new Error('err'); }, opts); } catch (_e) { /* */ }
    }
    assertEqual(openEmitted, true);
  });

  it('allows half-open probe after cooldown', async () => {
    const m = freshInstance();
    const opts = { threshold: 1, cooldownMs: 50 };
    try { await m.circuitBreaker('cooldown-op', () => { throw new Error('err'); }, opts); } catch (_e) { /* */ }

    // Wait past cooldown
    await sleep(80);

    // Half-open probe — should attempt the function
    const result = await m.circuitBreaker('cooldown-op', () => 'recovered', opts);
    assertEqual(result, 'recovered');
  });

  it('resetCircuit resets a named circuit', async () => {
    const m = freshInstance();
    const opts = { threshold: 1, cooldownMs: 60000 };
    try { await m.circuitBreaker('reset-op', () => { throw new Error('err'); }, opts); } catch (_e) { /* */ }

    m.resetCircuit('reset-op');
    const result = await m.circuitBreaker('reset-op', () => 'ok', opts);
    assertEqual(result, 'ok');
  });

  it('resetAllCircuits clears every circuit', async () => {
    const m = freshInstance();
    const opts = { threshold: 1, cooldownMs: 60000 };
    try { await m.circuitBreaker('a', () => { throw new Error('e'); }, opts); } catch (_e) { /* */ }
    try { await m.circuitBreaker('b', () => { throw new Error('e'); }, opts); } catch (_e) { /* */ }

    m.resetAllCircuits();
    const r1 = await m.circuitBreaker('a', () => 1, opts);
    const r2 = await m.circuitBreaker('b', () => 2, opts);
    assertEqual(r1, 1);
    assertEqual(r2, 2);
  });
});

// ── gracefulDegrade ────────────────────────────────────────────────────

describe('ErrorHandlingMiddleware — gracefulDegrade', () => {
  it('returns primary result on success', async () => {
    const m = freshInstance();
    const result = await m.gracefulDegrade(() => 'real', 'fallback-val');
    assertEqual(result, 'real');
  });

  it('returns degraded result on failure', async () => {
    const m = freshInstance();
    const result = await m.gracefulDegrade(() => { throw new Error('boom'); }, 'safe');
    assertEqual(result, 'safe');
  });
});

// ── wrapAsync / wrapSync ───────────────────────────────────────────────
// wrapAsync/wrapSync record the error AND re-throw it

describe('ErrorHandlingMiddleware — wrapAsync & wrapSync', () => {
  it('wrapAsync records error and re-throws', async () => {
    const m = freshInstance();
    const wrapped = m.wrapAsync(async () => { throw new Error('async-err'); }, 'WrapTest');
    let threw = false;
    try {
      await wrapped();
    } catch (_e) {
      threw = true;
    }
    assertEqual(threw, true);
    const report = m.getErrorReport();
    assert(report.totalErrors >= 1, 'should have recorded an error');
  });

  it('wrapSync records error and re-throws', () => {
    const m = freshInstance();
    const wrapped = m.wrapSync(() => { throw new Error('sync-err'); }, 'SyncTest');
    let threw = false;
    try {
      wrapped();
    } catch (_e) {
      threw = true;
    }
    assertEqual(threw, true);
    const report = m.getErrorReport();
    assert(report.totalErrors >= 1, 'should have recorded an error');
  });

  it('wrapAsync passes through return value', async () => {
    const m = freshInstance();
    const wrapped = m.wrapAsync(async () => 99, 'PassThrough');
    const result = await wrapped();
    assertEqual(result, 99);
  });

  it('wrapSync passes through return value', () => {
    const m = freshInstance();
    const wrapped = m.wrapSync(() => 'hello', 'PassThrough');
    const result = wrapped();
    assertEqual(result, 'hello');
  });
});

// ── createHandler ──────────────────────────────────────────────────────

describe('ErrorHandlingMiddleware — createHandler', () => {
  it('returns an object with bound helper methods', () => {
    const m = freshInstance();
    const handler = m.createHandler('MyModule');
    // createHandler returns: record, wrapAsync, wrapSync, retry, fallback,
    // circuitBreaker, gracefulDegrade, getErrors
    assertType(handler.record, 'function');
    assertType(handler.wrapAsync, 'function');
    assertType(handler.wrapSync, 'function');
    assertType(handler.retry, 'function');
    assertType(handler.fallback, 'function');
    assertType(handler.circuitBreaker, 'function');
    assertType(handler.gracefulDegrade, 'function');
    assertType(handler.getErrors, 'function');
  });

  it('record method uses the bound system name', () => {
    const m = freshInstance();
    const handler = m.createHandler('BoundModule');
    handler.record(new Error('bound-err'));
    const errs = handler.getErrors();
    assert(errs.length >= 1, 'should record via handler');
    assertEqual(errs[0].system, 'BoundModule');
  });
});

// ── reporting / utility ────────────────────────────────────────────────

describe('ErrorHandlingMiddleware — reporting', () => {
  it('getErrorReport returns aggregate statistics', () => {
    const m = freshInstance();
    m.recordError(new Error('a'), 'X');
    m.recordError(new Error('b'), 'X');
    m.recordError(new Error('c'), 'Y');

    const report = m.getErrorReport();
    assertType(report, 'object');
    assertEqual(report.totalErrors, 3);
    assertType(report.bySystem, 'object');
  });

  it('getErrorsBySystem scopes to a system name', () => {
    const m = freshInstance();
    m.recordError(new Error('a'), 'Alpha');
    m.recordError(new Error('b'), 'Beta');

    const alpha = m.getErrorsBySystem('Alpha');
    assertEqual(alpha.length, 1);
    assertEqual(alpha[0].system, 'Alpha');
  });

  it('getErrorTrends returns hourly buckets', () => {
    const m = freshInstance();
    m.recordError(new Error('t'), 'Sys');
    const trends = m.getErrorTrends(1);
    assertType(trends, 'object');
    assertType(trends.buckets, 'object');
  });

  it('clearErrors empties the history', () => {
    const m = freshInstance();
    m.recordError(new Error('x'), 'S');
    m.clearErrors();
    const report = m.getErrorReport();
    assertEqual(report.totalErrors, 0);
  });

  it('getSummary returns a descriptive string', () => {
    const m = freshInstance();
    m.recordError(new Error('x'), 'S');
    const summary = m.getSummary();
    assertType(summary, 'string');
    assert(summary.length > 0, 'summary should not be empty');
  });
});

// — tear down singleton after all tests
describe('ErrorHandlingMiddleware — cleanup', () => {
  it('destroyInstance cleans up singleton', () => {
    ErrorHandlingMiddleware.destroyInstance();
    assert(true, 'destroyed without error');
  });
});

run();
