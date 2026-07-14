# caching-proxy

A CLI tool that starts a caching proxy server. It forwards requests to a real
origin server and caches the responses. If the same request is made again,
the cached response is returned instead of hitting the origin server again.

## Install

```bash
cd caching-proxy
npm install
npm link          
```

(You can also just run it directly with `node bin/caching-proxy.js ...`
without `npm link`.)

## Usage

Start the proxy on port 3000, forwarding to `http://dummyjson.com`:

```bash
caching-proxy --port 3000 --origin http://dummyjson.com
```

Then make requests through the proxy instead of hitting the origin directly:

```bash
curl http://localhost:3000/products/1   # X-Cache: MISS  (forwarded + cached)
curl http://localhost:3000/products/1   # X-Cache: HIT   (served from cache)
```

Every response includes an `X-Cache` header (`HIT`, `MISS`, or `BYPASS` for
non-cacheable methods) so you can see what's happening.

Clear the cache (works even while the server is running elsewhere, since the
cache is stored on disk):

```bash
caching-proxy --clear-cache
```

### Options

| Flag              | Description                                   | Default                  |
|-------------------|------------------------------------------------|---------------------------|
| `-p, --port`      | Port the proxy listens on                     | `3000`                    |
| `-o, --origin`    | Origin server to forward requests to          | `http://dummyjson.com`    |
| `--clear-cache`   | Clear all cached responses and exit           | -                          |

## How it works

- Only `GET` and `HEAD` requests are cached (other methods, e.g. `POST`, are
  always forwarded live and marked `BYPASS`).
- The cache key is derived from the origin + method + full path (including
  query string), so different origins/queries never collide.
- Cached entries (status code, headers, and base64-encoded body) are stored as
  JSON files under `~/.caching-proxy-cache`, which is why `--clear-cache` can
  be run as a separate command/terminal and still affect a currently running
  proxy server.
- Hop-by-hop headers (`connection`, `transfer-encoding`, `content-encoding`,
  `content-length`, etc.) are stripped before caching/replaying so responses
  stay valid.

## Project structure

```
caching-proxy/
├── bin/
│   └── caching-proxy.js   # CLI entry point (arg parsing)
├── lib/
│   ├── server.js          # proxy + caching logic
│   └── cache.js           # disk-based cache read/write/clear
├── package.json
└── README.md
```
