# @jsango/middleware

> Onion-style middleware pipeline, response normalization, global error boundaries, and Application coordinator.

Part of the **[jsango](https://github.com/flutterbuddy1/jsango)** backend framework for TypeScript.

## Installation

```bash
pnpm add @jsango/middleware
```

## Usage

```typescript
import { Application } from '@jsango/middleware';
import { HttpRequest } from '@jsango/http';

const app = new Application({ isProduction: process.env.NODE_ENV === 'production' });

app.use(async (ctx, next) => {
  const start = Date.now();
  const response = await next();
  ctx.logger.info(`${ctx.request.method} ${ctx.request.url.pathname} ${Date.now() - start}ms`);
  return response;
});

app.get('/hello', () => ({ message: 'world' })); // normalized to a JSON response

// Handle a request in-process (no network), e.g. in tests:
const res = await app.handle(new HttpRequest({ method: 'GET', url: '/hello' }));
console.log(res.status); // 200

await app.listen(3000);
```

## Documentation

For full architecture documentation and guides, visit the [jsango documentation](https://github.com/flutterbuddy1/jsango/tree/main/docs).

## License

MIT © jsango contributors
