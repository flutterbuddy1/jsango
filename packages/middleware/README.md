# @jsango/middleware

> Onion-style middleware pipeline, response normalization, global error boundaries, and Application coordinator.

Part of the **[jsango](https://github.com/jsango/jsango)** backend framework for TypeScript.

## Installation

```bash
pnpm add @jsango/middleware
```

## Usage

```typescript
import { Application } from '@jsango/middleware';

const app = new Application();
app.use(async (ctx, next) => {
  console.log(`${ctx.request.method} ${ctx.request.url.pathname}`);
  return next();
});
app.get('/hello', () => ({ message: 'world' }));
```

## Documentation

For full architecture documentation and guides, visit the [jsango documentation](https://github.com/jsango/jsango/tree/main/docs).

## License

MIT © jsango contributors
