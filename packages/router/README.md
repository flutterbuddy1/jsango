# @django-js/router

> High-performance Segment Radix Trie router (>7.7M ops/sec), typed constraints, route groups, and RFC 7231 compliance.

Part of the **[django-js](https://github.com/django-js/django-js)** backend framework for TypeScript.

## Installation

```bash
pnpm add @django-js/router
```

## Usage

```typescript
import { Router } from '@django-js/router';

const router = new Router();
router.get('/users/:id<number>', (ctx) => ({ id: ctx.request.params.id }));
router.compile();
```

## Documentation

For full architecture documentation and guides, visit the [django-js documentation](https://github.com/django-js/django-js/tree/main/docs).

## License

MIT © django-js contributors
