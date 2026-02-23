'use strict';

/**
 * Minimal async test runner.
 *
 * Usage:
 *   const { describe, it, run } = require('./helpers/runner');
 *   describe('MyClass', () => {
 *     it('does something', async () => { ... });
 *   });
 *   run();   // returns exit code 0 or 1 and prints results
 */

const suites = [];
let currentSuite = null;

function describe(name, fn) {
  const suite = { name, tests: [] };
  const prev = currentSuite;
  currentSuite = suite;
  suites.push(suite);
  fn();
  currentSuite = prev;
}

function it(name, fn) {
  const suite = currentSuite;
  if (!suite) throw new Error('it() called outside of describe()');
  suite.tests.push({ name, fn });
}

async function run() {
  let passed = 0;
  let failed = 0;
  const failures = [];

  for (const suite of suites) {
    console.log(`\n  ${suite.name}`);
    for (const test of suite.tests) {
      try {
        await test.fn();
        console.log(`    PASS  ${test.name}`);
        passed++;
      } catch (err) {
        console.log(`    FAIL  ${test.name}`);
        console.log(`          ${err.message}`);
        failures.push({ suite: suite.name, test: test.name, error: err });
        failed++;
      }
    }
  }

  console.log(`\n  ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    process.exitCode = 1;
  }

  return { passed, failed };
}

module.exports = { describe, it, run };
