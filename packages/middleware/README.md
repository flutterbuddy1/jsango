# @django-js/middleware

> Onion-style middleware pipeline, response normalization, global error boundaries, and Application coordinator.

Part of the **[django-js](https://github.com/django-js/django-js)** backend framework for TypeScript.

## Installation

```bash
pnpm add @django-js/middleware
```

## Usage

```typescript
import { Application } from '@django-js/middleware';

const app = new Application();
app.use(async (ctx, next) => {
  console.log(`${ctx.request.method} ${ctx.request.url.pathname}`);
  return next();
});
app.get('/hello', () => ({ message: 'world' }));
```

## Documentation

For full architecture documentation and guides, visit the [django-js documentation](https://github.com/django-js/django-js/tree/main/docs).

## License

MIT © django-js contributors
