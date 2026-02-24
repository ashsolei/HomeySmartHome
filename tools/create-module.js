#!/usr/bin/env node
'use strict';

/**
 * Module Generator CLI
 *
 * Scaffolds new SmartHome modules following the project's BaseSystem pattern.
 * Usage: node tools/create-module.js [module-name]
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ── Paths ────────────────────────────────────────────────────────────────────

const REPO_ROOT = path.resolve(__dirname, '..');
const LIB_DIR = path.join(REPO_ROOT, 'homey-app', 'lib');
const TEST_DIR = path.join(REPO_ROOT, 'homey-app', 'test');

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'energy',
  'security',
  'climate',
  'automation',
  'lifestyle',
  'monitoring',
  'infrastructure',
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Validate the module class name: must be PascalCase and end with "System".
 * Also checks it matches the expected Smart*System convention.
 */
function validateModuleName(name) {
  if (!name || typeof name !== 'string') {
    return 'Module name is required.';
  }
  if (!/^[A-Z][A-Za-z0-9]+$/.test(name)) {
    return 'Module name must be PascalCase (e.g. SmartGardenSystem).';
  }
  if (!name.startsWith('Smart')) {
    return 'Module name must start with "Smart" (e.g. SmartGardenSystem).';
  }
  if (!name.endsWith('System')) {
    return 'Module name must end with "System" (e.g. SmartGardenSystem).';
  }
  return null; // valid
}

function moduleFileExists(name) {
  return fs.existsSync(path.join(LIB_DIR, `${name}.js`));
}

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function promptCategory(rl) {
  console.log('\nCategories:');
  CATEGORIES.forEach((c, i) => console.log(`  ${i + 1}. ${c}`));

  while (true) {
    const input = await ask(rl, '\nSelect category (1-7 or name): ');
    const trimmed = input.trim().toLowerCase();

    const byIndex = parseInt(trimmed, 10);
    if (!isNaN(byIndex) && byIndex >= 1 && byIndex <= CATEGORIES.length) {
      return CATEGORIES[byIndex - 1];
    }
    if (CATEGORIES.includes(trimmed)) {
      return trimmed;
    }
    console.log(`  Invalid choice. Enter a number 1-${CATEGORIES.length} or a category name.`);
  }
}

// ── Template generators ──────────────────────────────────────────────────────

function generateModuleFile(name, category, description) {
  // Derive a human-readable label from the class name, e.g.
  // "SmartGardenSystem" -> "Garden"
  const label = name.replace(/^Smart/, '').replace(/System$/, '');
  const camelLabel = label.charAt(0).toLowerCase() + label.slice(1);

  return `'use strict';

const { BaseSystem } = require('./utils/BaseSystem');

/**
 * @fileoverview ${name}
 *
 * ${description}
 *
 * Category: ${category}
 *
 * @module lib/${name}
 */
class ${name} extends BaseSystem {
  /**
   * @param {object} homey - The Homey API instance.
   */
  constructor(homey) {
    super(homey);

    /** @type {object} Current status snapshot. */
    this.status = {
      active: false,
      lastUpdated: null,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  LIFECYCLE
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Called by BaseSystem.initialize() — perform setup here.
   *
   * @returns {Promise<void>}
   */
  async onInitialize() {
    this.log('${name} starting up…');

    // TODO: register Homey flow cards, load saved state, etc.
    // Example: start a polling interval every 5 minutes.
    this.wrapInterval(() => this._poll(), 5 * 60 * 1000);

    this.status.active = true;
    this.status.lastUpdated = Date.now();

    this.log('${name} ready.');
  }

  /**
   * Called by BaseSystem.destroy() — release resources here.
   *
   * @returns {Promise<void>}
   */
  async onDestroy() {
    this.status.active = false;
    this.log('${name} shut down.');
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  PUBLIC API
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Return a status snapshot for dashboard / API consumption.
   *
   * @returns {object}
   */
  getStatus() {
    return {
      name: this.name,
      active: this.status.active,
      lastUpdated: this.status.lastUpdated,
      uptime: this.getUptime(),
    };
  }

  /**
   * Return health information (extends BaseSystem.getHealth()).
   *
   * @returns {object}
   */
  getHealth() {
    return {
      ...super.getHealth(),
      category: '${category}',
      active: this.status.active,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  PRIVATE
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Periodic polling — called every 5 minutes by default.
   *
   * @private
   */
  async _poll() {
    await this.safeExecute(async () => {
      // TODO: implement polling logic
      this.status.lastUpdated = Date.now();
      this.log('Poll completed.');
    }, '${camelLabel}Poll');
  }
}

module.exports = ${name};
`;
}

function generateTestFile(name) {
  const camelName = name.charAt(0).toLowerCase() + name.slice(1);

  return `'use strict';

/**
 * Unit tests for ${name}.
 *
 * All tests run in-process — no live server needed.
 */

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertType } = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');
const ${name} = require('../lib/${name}');

function make${name}() {
  const homey = createMockHomey();
  const system = new ${name}(homey);

  // Suppress real intervals so tests don't linger.
  system.wrapInterval = () => null;

  return { system, homey };
}

// ── Constructor ──────────────────────────────────────────────────────────────

describe('${name} — constructor', () => {
  it('stores the homey reference', () => {
    const homey = createMockHomey();
    const system = new ${name}(homey);
    assertEqual(system.homey, homey);
  });

  it('initialises status with active=false', () => {
    const { system } = make${name}();
    assertEqual(system.status.active, false);
  });
});

// ── initialize / destroy ─────────────────────────────────────────────────────

describe('${name} — lifecycle', () => {
  it('sets active=true after initialize()', async () => {
    const { system } = make${name}();
    await system.initialize();
    assertEqual(system.status.active, true);
    await system.destroy();
  });

  it('sets active=false after destroy()', async () => {
    const { system } = make${name}();
    await system.initialize();
    await system.destroy();
    assertEqual(system.status.active, false);
  });

  it('sets isInitialized=true after initialize()', async () => {
    const { system } = make${name}();
    await system.initialize();
    assertEqual(system.isInitialized, true);
    await system.destroy();
  });
});

// ── getStatus ────────────────────────────────────────────────────────────────

describe('${name} — getStatus()', () => {
  it('returns an object with expected shape', async () => {
    const { system } = make${name}();
    await system.initialize();

    const status = system.getStatus();
    assertType(status.name, 'string');
    assertType(status.active, 'boolean');
    assertType(status.uptime, 'number');

    await system.destroy();
  });

  it('name matches the class name', async () => {
    const { system } = make${name}();
    await system.initialize();
    assertEqual(system.getStatus().name, '${name}');
    await system.destroy();
  });
});

// ── getHealth ────────────────────────────────────────────────────────────────

describe('${name} — getHealth()', () => {
  it('returns a health object with status field', async () => {
    const { system } = make${name}();
    await system.initialize();

    const health = system.getHealth();
    assert('status' in health, 'health must have status');
    assert('errors' in health, 'health must have errors');
    assertType(health.errors, 'number');

    await system.destroy();
  });

  it('includes the category field', async () => {
    const { system } = make${name}();
    await system.initialize();
    assert('category' in system.getHealth(), 'health must have category');
    await system.destroy();
  });
});

// Run
run();
`;
}

function generateRegistrationInstructions(name) {
  const varName = name.charAt(0).toLowerCase() + name.slice(1);

  return `
  1. homey-app/app.js
     ─────────────────
     Add require at the top:
       const ${name} = require('./lib/${name}');

     In the onInit() method, instantiate and initialize:
       this.${varName} = new ${name}(this);
       await this.${varName}.initialize();

  2. homey-app/server.js  (HomeyShim / standalone mode)
     ─────────────────────────────────────────────────
     Same pattern as app.js — require and initialize in the startup block.

  3. homey-app/api.js  (REST endpoints)
     ──────────────────────────────────
     Add a route group, e.g.:
       app.get('/api/v1/${varName}/status', (req, res) => {
         res.json(homey.app.${varName}.getStatus());
       });
       app.get('/api/v1/${varName}/health', (req, res) => {
         res.json(homey.app.${varName}.getHealth());
       });
`;
}

// ── Main flow ────────────────────────────────────────────────────────────────

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('');
  console.log('SmartHome Module Generator');
  console.log('==========================');

  // ── 1. Module name ──────────────────────────────────────────────────────

  let moduleName = (process.argv[2] || '').trim();

  if (moduleName) {
    const err = validateModuleName(moduleName);
    if (err) {
      console.error(`\nError: ${err}`);
      rl.close();
      process.exit(1);
    }
  } else {
    while (true) {
      moduleName = (await ask(rl, '\nModule name (e.g. SmartGardenSystem): ')).trim();
      const err = validateModuleName(moduleName);
      if (!err) break;
      console.log(`  ${err}`);
    }
  }

  // ── 2. Duplicate check ──────────────────────────────────────────────────

  if (moduleFileExists(moduleName)) {
    console.error(`\nError: ${moduleName}.js already exists in homey-app/lib/. Aborting.`);
    rl.close();
    process.exit(1);
  }

  // ── 3. Category ─────────────────────────────────────────────────────────

  const category = await promptCategory(rl);

  // ── 4. Description ──────────────────────────────────────────────────────

  let description = (await ask(rl, '\nShort description (one sentence): ')).trim();
  if (!description) {
    description = `${moduleName} for the SmartHome platform.`;
  }

  rl.close();

  // ── 5. Generate files ───────────────────────────────────────────────────

  const moduleFile = path.join(LIB_DIR, `${moduleName}.js`);
  const testFile = path.join(TEST_DIR, `${moduleName}.test.js`);

  console.log('\nGenerating files…');

  fs.writeFileSync(moduleFile, generateModuleFile(moduleName, category, description), 'utf8');
  console.log(`  Created: homey-app/lib/${moduleName}.js`);

  fs.writeFileSync(testFile, generateTestFile(moduleName), 'utf8');
  console.log(`  Created: homey-app/test/${moduleName}.test.js`);

  // ── 6. Print registration instructions ─────────────────────────────────

  console.log('\nNext steps — register the module:');
  console.log(generateRegistrationInstructions(moduleName));
  console.log('Done.');
}

main().catch((err) => {
  console.error('Unexpected error:', err.message);
  process.exit(1);
});
