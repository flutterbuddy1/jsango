# @jsango/cache

> Universal caching abstraction with stampede protection (remember/getOrSet), namespaces, and in-memory LRU/TTL driver.

Part of the **[jsango](https://github.com/jsango/jsango)** backend framework for TypeScript.

## Installation

```bash
pnpm add @jsango/cache
```

## Usage

```typescript
import { CacheManager, MemoryCacheDriver } from '@jsango/cache';

const manager = new CacheManager({
  default: new MemoryCacheDriver({ defaultTtl: 300 }),
});
const store = manager.store();
const user = await store.remember('user:42', 60, () => fetchUserFromDb(42));
```

## Documentation

For full architecture documentation and guides, visit the [jsango documentation](https://github.com/jsango/jsango/tree/main/docs).

## License

MIT © jsango contributors
