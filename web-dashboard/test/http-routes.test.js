'use strict';

const { describe, it, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { app, _cleanup } = require('../server');

after(() => _cleanup());

describe('HTTP Route Input Validation', () => {
  describe('POST /api/device/:deviceId/capability/:capability', () => {
    it('rejects deviceId longer than 128 chars', async () => {
      const longId = 'a'.repeat(129);
      const res = await request(app)
        .post(`/api/device/${longId}/capability/onoff`)
        .send({ value: true });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error, 'Invalid device ID');
    });

    it('rejects capability longer than 64 chars', async () => {
      const longCap = 'x'.repeat(65);
      const res = await request(app)
        .post(`/api/device/valid-id/capability/${longCap}`)
        .send({ value: true });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error, 'Invalid capability');
    });

    it('accepts valid deviceId and capability', async () => {
      const res = await request(app)
        .post('/api/device/test-device-123/capability/onoff')
        .send({ value: true });
      // 500 is expected — no real Homey connection
      assert.ok([200, 500].includes(res.status));
    });
  });

  describe('POST /api/scene/:sceneId', () => {
    it('rejects sceneId longer than 128 chars', async () => {
      const longId = 's'.repeat(129);
      const res = await request(app)
        .post(`/api/scene/${longId}`)
        .send({});
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error, 'Invalid scene ID');
    });

    it('accepts valid sceneId', async () => {
      const res = await request(app)
        .post('/api/scene/scene-abc')
        .send({});
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.sceneId, 'scene-abc');
    });
  });

  describe('POST /api/security/mode', () => {
    it('rejects invalid security mode', async () => {
      const res = await request(app)
        .post('/api/security/mode')
        .send({ mode: 'invalid-mode' });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error, 'Invalid security mode');
    });

    it('rejects missing mode', async () => {
      const res = await request(app)
        .post('/api/security/mode')
        .send({});
      assert.strictEqual(res.status, 400);
    });

    it('accepts valid mode "home"', async () => {
      const res = await request(app)
        .post('/api/security/mode')
        .send({ mode: 'home' });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.mode, 'home');
    });

    it('accepts valid mode "away"', async () => {
      const res = await request(app)
        .post('/api/security/mode')
        .send({ mode: 'away' });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
    });

    it('accepts valid mode "night"', async () => {
      const res = await request(app)
        .post('/api/security/mode')
        .send({ mode: 'night' });
      assert.strictEqual(res.status, 200);
    });
  });

  describe('Health and basic routes', () => {
    it('GET /health returns 200 with ok status', async () => {
      const res = await request(app).get('/health');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.status, 'ok');
    });

    it('GET /metrics returns Prometheus format', async () => {
      const res = await request(app).get('/metrics');
      assert.strictEqual(res.status, 200);
      assert.ok(res.text.includes('smarthome_'));
    });
  });
});
