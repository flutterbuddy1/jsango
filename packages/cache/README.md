# @django-js/cache

> Universal caching abstraction with stampede protection (remember/getOrSet), namespaces, and in-memory LRU/TTL driver.

Part of the **[django-js](https://github.com/django-js/django-js)** backend framework for TypeScript.

## Installation

```bash
pnpm add @django-js/cache
```

## Usage

```typescript
import { CacheManager, MemoryCacheDriver } from '@django-js/cache';

const manager = new CacheManager({
  default: new MemoryCacheDriver({ defaultTtl: 300 }),
});
const store = manager.store();
const user = await store.remember('user:42', 60, () => fetchUserFromDb(42));
```

## Documentation

For full architecture documentation and guides, visit the [django-js documentation](https://github.com/django-js/django-js/tree/main/docs).

## License

MIT © django-js contributors
