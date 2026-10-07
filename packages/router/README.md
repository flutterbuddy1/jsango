# @jsango/router

> High-performance Segment Radix Trie router (>7.7M ops/sec), typed constraints, route groups, and RFC 7231 compliance.

Part of the **[jsango](https://github.com/flutterbuddy1/jsango)** backend framework for TypeScript.

## Installation

```bash
pnpm add @jsango/router
```

## Usage

```typescript
import { Router, isRouteMatch } from '@jsango/router';

const router = new Router();
router.get('/users/:id<number>', (ctx) => ({ id: ctx.request.params.id }), { name: 'users.show' });
router.group('/api/v1', (api) => {
  api.get('/posts/:slug<slug>', (ctx) => ({ slug: ctx.request.params.slug }));
});
router.compile();

const match = router.match('GET', '/users/42');
if (isRouteMatch(match)) console.log(match.params.id); // '42'
console.log(router.url('users.show', { id: 7 })); // '/users/7'
```

## Documentation

For full architecture documentation and guides, visit the [jsango documentation](https://github.com/flutterbuddy1/jsango/tree/main/docs).

## License

MIT © jsango contributors
