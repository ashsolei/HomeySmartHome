'use strict';

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual } = require('./helpers/assert');
const { etagMiddleware } = require('../lib/HttpCacheMiddleware');

// ── helpers ────────────────────────────────────────────────────────────

function mockReq(headers = {}) {
  return { headers };
}

function mockRes() {
  const res = {
    _headers: {},
    _status: 200,
    _body: undefined,
    _ended: false,
    set(key, val) { res._headers[key] = val; return res; },
    status(code) { res._status = code; return res; },
    json(data) { res._body = data; return res; },
    end() { res._ended = true; return res; },
  };
  return res;
}

// ── ETag generation ────────────────────────────────────────────────────

describe('HttpCacheMiddleware — etagMiddleware', () => {
  it('sets ETag and Cache-Control headers on json response', () => {
    const req = mockReq();
    const res = mockRes();
    let nextCalled = false;

    etagMiddleware(req, res, () => { nextCalled = true; });
    assert(nextCalled, 'next() should be called');

    // Trigger the wrapped json()
    res.json({ hello: 'world' });

    assert(res._headers['ETag'], 'ETag header should be set');
    assert(res._headers['ETag'].startsWith('"'), 'ETag should be quoted');
    assertEqual(res._headers['Cache-Control'], 'private, max-age=30');
    assert(res._body !== undefined, 'Body should be returned');
  });

  it('returns 304 when If-None-Match matches ETag', () => {
    // First call to get the ETag
    const req1 = mockReq();
    const res1 = mockRes();
    etagMiddleware(req1, res1, () => {});
    res1.json({ stable: 'data' });
    const etag = res1._headers['ETag'];

    // Second call with matching If-None-Match
    const req2 = mockReq({ 'if-none-match': etag });
    const res2 = mockRes();
    etagMiddleware(req2, res2, () => {});
    res2.json({ stable: 'data' });

    assertEqual(res2._status, 304);
    assert(res2._ended, 'Response should be ended for 304');
  });

  it('returns 200 when If-None-Match does not match', () => {
    const req = mockReq({ 'if-none-match': '"stale-etag"' });
    const res = mockRes();
    etagMiddleware(req, res, () => {});
    res.json({ fresh: 'data' });

    assertEqual(res._status, 200);
    assert(res._body !== undefined, 'Body should be returned');
  });

  it('generates consistent ETags for the same data', () => {
    const data = { key: 'value', nested: { a: 1 } };

    const req1 = mockReq();
    const res1 = mockRes();
    etagMiddleware(req1, res1, () => {});
    res1.json(data);

    const req2 = mockReq();
    const res2 = mockRes();
    etagMiddleware(req2, res2, () => {});
    res2.json(data);

    assertEqual(res1._headers['ETag'], res2._headers['ETag']);
  });

  it('generates different ETags for different data', () => {
    const req1 = mockReq();
    const res1 = mockRes();
    etagMiddleware(req1, res1, () => {});
    res1.json({ a: 1 });

    const req2 = mockReq();
    const res2 = mockRes();
    etagMiddleware(req2, res2, () => {});
    res2.json({ b: 2 });

    assert(res1._headers['ETag'] !== res2._headers['ETag'], 'ETags should differ for different data');
  });
});

run();
