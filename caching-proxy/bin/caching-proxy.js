'use strict';

const { Command } = require('commander');
const { createProxyServer } = require('../lib/server');
const { clearCache, CACHE_DIR } = require('../lib/cache');

const program = new Command();

program
  .name('caching-proxy')
  .description('Starts a caching proxy server that forwards requests to an origin server and caches responses.')
  .option('-p, --port <number>', 'port on which the caching proxy server will run', '3000')
  .option('-o, --origin <url>', 'origin server URL to forward requests to', 'https://dummyjson.com')
  .option('--clear-cache', 'clear all cached responses and exit')
  .action((options) => {
    if (options.clearCache) {
      const removed = clearCache();
      console.log(`Cleared ${removed} cached response(s) from ${CACHE_DIR}`);
      return;
    }

    const port = parseInt(options.port, 10);
    if (Number.isNaN(port) || port <= 0 || port > 65535) {
      console.error(`Invalid port: ${options.port}`);
      process.exit(1);
    }

    let origin;
    try {
      origin = new URL(options.origin).toString().replace(/\/$/, '');
    } catch (err) {
      console.error(`Invalid origin URL: ${options.origin}`);
      process.exit(1);
    }

    const server = createProxyServer(origin);
    server.listen(port, () => {
      console.log(`Caching proxy server running on https://localhost:${port}`);
      console.log(`Forwarding requests to ${origin}`);
      console.log(`Cache directory: ${CACHE_DIR}`);
    });
  });

program.parse(process.argv);
