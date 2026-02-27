'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const ModuleLoader = require('../module-loader');

describe('ModuleLoader', () => {
  let loader;

  beforeEach(() => {
    loader = new ModuleLoader();
  });

  afterEach(() => {
    loader.destroyAll();
  });

  describe('constructor', () => {
    it('initializes empty maps', () => {
      assert.strictEqual(loader.modules.size, 0);
      assert.strictEqual(loader.statuses.size, 0);
      assert.strictEqual(loader.loadErrors.size, 0);
    });
  });

  describe('discover', () => {
    it('returns an array of module names', () => {
      const modules = loader.discover();
      assert.ok(Array.isArray(modules));
      assert.ok(modules.length > 0);
    });

    it('excludes server, test-suite, and infrastructure modules', () => {
      const modules = loader.discover();
      assert.ok(!modules.includes('server'));
      assert.ok(!modules.includes('test-suite'));
      assert.ok(!modules.includes('module-loader'));
      assert.ok(!modules.includes('performance-monitor'));
      assert.ok(!modules.includes('security-middleware'));
    });

    it('returns sorted module names', () => {
      const modules = loader.discover();
      const sorted = [...modules].sort();
      assert.deepStrictEqual(modules, sorted);
    });

    it('discovers known dashboard modules', () => {
      const modules = loader.discover();
      assert.ok(modules.includes('air-quality-manager'));
      assert.ok(modules.includes('energy-budget-manager'));
    });
  });

  describe('getSummary', () => {
    it('returns zeroed summary when no modules loaded', () => {
      const summary = loader.getSummary();
      assert.strictEqual(summary.total, 0);
      assert.strictEqual(summary.ready, 0);
      assert.strictEqual(summary.errors, 0);
    });

    it('reflects status changes', () => {
      loader.statuses.set('mod-a', 'ready');
      loader.statuses.set('mod-b', 'load-error');
      loader.statuses.set('mod-c', 'ready');
      const summary = loader.getSummary();
      assert.strictEqual(summary.total, 3);
      assert.strictEqual(summary.ready, 2);
      assert.strictEqual(summary.errors, 1);
    });
  });

  describe('getAllStatuses', () => {
    it('returns object with status and error for each module', () => {
      loader.statuses.set('mod-a', 'ready');
      loader.loadErrors.set('mod-b', 'Some error');
      loader.statuses.set('mod-b', 'load-error');

      const statuses = loader.getAllStatuses();
      assert.strictEqual(statuses['mod-a'].status, 'ready');
      assert.strictEqual(statuses['mod-a'].error, null);
      assert.strictEqual(statuses['mod-b'].status, 'load-error');
      assert.strictEqual(statuses['mod-b'].error, 'Some error');
    });
  });

  describe('get', () => {
    it('returns undefined for unknown module', () => {
      assert.strictEqual(loader.get('nonexistent'), undefined);
    });

    it('returns stored module instance', () => {
      const fake = { name: 'test' };
      loader.modules.set('test-mod', fake);
      assert.strictEqual(loader.get('test-mod'), fake);
    });
  });

  describe('loadAll', () => {
    it('loads and initializes modules', async () => {
      const result = await loader.loadAll({});
      assert.ok(result.total > 0);
      assert.ok(result.loaded > 0);
      // Some modules may fail to initialize (no Homey connection) — that's expected
      assert.strictEqual(result.total, result.loaded + result.failed - (result.loaded - result.ready));
    });

    it('sets statuses for all discovered modules', async () => {
      await loader.loadAll({});
      assert.ok(loader.statuses.size > 0);
      for (const [_name, status] of loader.statuses) {
        assert.ok(['ready', 'loaded', 'load-error', 'init-error'].includes(status));
      }
    });
  });

  describe('destroyAll', () => {
    it('clears all maps', () => {
      loader.modules.set('mod-a', { destroy: () => {} });
      loader.modules.set('mod-b', {});
      loader.statuses.set('mod-a', 'ready');
      loader.statuses.set('mod-b', 'ready');
      loader.loadErrors.set('mod-c', 'err');

      loader.destroyAll();

      assert.strictEqual(loader.modules.size, 0);
      assert.strictEqual(loader.statuses.size, 0);
      assert.strictEqual(loader.loadErrors.size, 0);
    });

    it('calls destroy() on modules that have it', () => {
      let destroyed = false;
      loader.modules.set('mod-a', { destroy: () => { destroyed = true; } });
      loader.destroyAll();
      assert.strictEqual(destroyed, true);
    });

    it('skips modules without destroy()', () => {
      loader.modules.set('mod-b', { name: 'no-destroy' });
      assert.doesNotThrow(() => loader.destroyAll());
    });

    it('handles destroy() errors gracefully', () => {
      loader.modules.set('mod-err', {
        destroy: () => { throw new Error('boom'); }
      });
      assert.doesNotThrow(() => loader.destroyAll());
      assert.strictEqual(loader.modules.size, 0);
    });
  });
});
