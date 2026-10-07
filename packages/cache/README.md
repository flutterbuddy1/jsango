# @jsango/cache

> Universal caching abstraction with stampede protection (remember/getOrSet), namespaces, and in-memory LRU/TTL driver.

Part of the **[jsango](https://github.com/flutterbuddy1/jsango)** backend framework for TypeScript.

## Installation

```bash
pnpm add @jsango/cache
```

## Usage

```typescript
import { CacheManager } from '@jsango/cache';

const cache = new CacheManager({
  default: 'default',
  stores: {
    default: { driver: 'memory', ttlMs: 300_000, options: { maxEntries: 10_000 } },
  },
  prefix: 'my-app',
});

// Computes once under concurrent load (stampede protection), then caches for 60s.
const user = await cache.remember('user:42', () => fetchUserFromDb(42), { ttlSeconds: 60 });

const sessions = cache.store().namespace('sessions');
await sessions.set('abc', { userId: 42 }, { ttlMs: 30_000 });
```

## Documentation

For full architecture documentation and guides, visit the [jsango documentation](https://github.com/flutterbuddy1/jsango/tree/main/docs).

## License

MIT © jsango contributors
