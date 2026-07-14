'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// The cache lives in a fixed location on disk (not in the current working
// directory) so that running `caching-proxy --clear-cache` from any
// terminal/folder clears the same cache that a running proxy server is using.
const CACHE_DIR = path.join(os.homedir(), '.caching-proxy-cache');

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

// Build a stable cache key from the method, the target origin, and the full
// path (including query string), so caches for different origins/ports don't
// collide with each other.
function getCacheKey(origin, method, url) {
  const raw = `${method.toUpperCase()} ${origin}${url}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function getCacheFilePath(key) {
  return path.join(CACHE_DIR, `${key}.json`);
}

function readCache(key) {
  const filePath = getCacheFilePath(key);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    // Corrupted cache entry; treat as a miss.
    return null;
  }
}

function writeCache(key, entry) {
  ensureCacheDir();
  const filePath = getCacheFilePath(key);
  fs.writeFileSync(filePath, JSON.stringify(entry), 'utf8');
}

function clearCache() {
  if (!fs.existsSync(CACHE_DIR)) {
    return 0;
  }
  const files = fs.readdirSync(CACHE_DIR).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    fs.unlinkSync(path.join(CACHE_DIR, file));
  }
  return files.length;
}

module.exports = {
  CACHE_DIR,
  getCacheKey,
  readCache,
  writeCache,
  clearCache,
};
