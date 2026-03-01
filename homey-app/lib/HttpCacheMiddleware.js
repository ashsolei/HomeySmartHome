'use strict';

const crypto = require('crypto');

/**
 * Express middleware that adds ETag and Cache-Control headers to JSON responses.
 * Returns 304 Not Modified when the client sends a matching If-None-Match header.
 */
function etagMiddleware(req, res, next) {
  const originalJson = res.json.bind(res);
  res.json = function (data) {
    const body = JSON.stringify(data);
    const etag = '"' + crypto.createHash('sha256').update(body).digest('hex').slice(0, 16) + '"';
    res.set('ETag', etag);
    res.set('Cache-Control', 'private, max-age=30');
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }
    return originalJson(data);
  };
  next();
}

module.exports = { etagMiddleware };
