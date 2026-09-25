# @django-js/testing

> First-class testing utilities, HTTP client simulator, mock transports, and test assertions for django-js apps.

Part of the **[django-js](https://github.com/django-js/django-js)** backend framework for TypeScript.

## Installation

```bash
pnpm add @django-js/testing
```

## Usage

```typescript
import { TestClient } from '@django-js/testing';

const client = new TestClient(app);
const res = await client.get('/api/users');
res.assertStatus(200);
```

## Documentation

For full architecture documentation and guides, visit the [django-js documentation](https://github.com/django-js/django-js/tree/main/docs).

## License

MIT © django-js contributors
