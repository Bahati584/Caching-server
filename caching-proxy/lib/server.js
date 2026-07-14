'use strict';

const http = require('http');
const { getCacheKey, readCache, writeCache } = require('./cache');

// Headers that must not be blindly forwarded/replayed because they are
// connection-specific (hop-by-hop) rather than end-to-end.
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'content-encoding', // we let fetch decode the body for us, so drop this
  'content-length',   // recalculated when we send the response
]);

const CACHEABLE_METHODS = new Set(['GET', 'HEAD']);

function filterHeaders(headersObj) {
  const result = {};
  for (const [key, value] of Object.entries(headersObj)) {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase()) && value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function createProxyServer(origin) {
  const originUrl = new URL(origin);

  return http.createServer(async (req, res) => {
    const method = req.method.toUpperCase();
    const targetUrl = new URL(req.url, originUrl);
    const isCacheable = CACHEABLE_METHODS.has(method);
    const cacheKey = isCacheable ? getCacheKey(origin, method, req.url) : null;

    // Try to serve from cache first.
    if (isCacheable) {
      const cached = readCache(cacheKey);
      if (cached) {
        const headers = { ...cached.headers, 'X-Cache': 'HIT' };
        res.writeHead(cached.statusCode, headers);
        res.end(Buffer.from(cached.bodyBase64, 'base64'));
        console.log(`[HIT]  ${method} ${req.url}`);
        return;
      }
    }

    // Not cached (or not cacheable): forward the request to the origin.
    try {
      const requestBody = ['GET', 'HEAD'].includes(method)
        ? undefined
        : await readRequestBody(req);

      const forwardHeaders = filterHeaders(req.headers);
      forwardHeaders.host = originUrl.host;

      const originResponse = await fetch(targetUrl, {
        method,
        headers: forwardHeaders,
        body: requestBody && requestBody.length > 0 ? requestBody : undefined,
        redirect: 'manual',
      });

      const bodyBuffer = Buffer.from(await originResponse.arrayBuffer());
      const responseHeaders = filterHeaders(
        Object.fromEntries(originResponse.headers.entries())
      );

      if (isCacheable && originResponse.status >= 200 && originResponse.status < 400) {
        writeCache(cacheKey, {
          statusCode: originResponse.status,
          headers: responseHeaders,
          bodyBase64: bodyBuffer.toString('base64'),
        });
      }

      res.writeHead(originResponse.status, {
        ...responseHeaders,
        'X-Cache': isCacheable ? 'MISS' : 'BYPASS',
      });
      res.end(bodyBuffer);
      console.log(`[${isCacheable ? 'MISS' : 'BYPASS'}] ${method} ${req.url} -> ${originResponse.status}`);
    } catch (err) {
      console.error(`Error forwarding ${method} ${req.url}:`, err.message);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Bad Gateway', message: err.message }));
    }
  });
}

module.exports = { createProxyServer };
