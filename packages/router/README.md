# @jsango/router

> High-performance Segment Radix Trie router (>7.7M ops/sec), typed constraints, route groups, and RFC 7231 compliance.

Part of the **[jsango](https://github.com/jsango/jsango)** backend framework for TypeScript.

## Installation

```bash
pnpm add @jsango/router
```

## Usage

```typescript
import { Router } from '@jsango/router';

const router = new Router();
router.get('/users/:id<number>', (ctx) => ({ id: ctx.request.params.id }));
router.compile();
```

## Documentation

For full architecture documentation and guides, visit the [jsango documentation](https://github.com/jsango/jsango/tree/main/docs).

## License

MIT © jsango contributors
