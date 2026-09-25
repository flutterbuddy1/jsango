# @jsango/testing

> First-class testing utilities, HTTP client simulator, mock transports, and test assertions for jsango apps.

Part of the **[jsango](https://github.com/jsango/jsango)** backend framework for TypeScript.

## Installation

```bash
pnpm add @jsango/testing
```

## Usage

```typescript
import { TestClient } from '@jsango/testing';

const client = new TestClient(app);
const res = await client.get('/api/users');
res.assertStatus(200);
```

## Documentation

For full architecture documentation and guides, visit the [jsango documentation](https://github.com/jsango/jsango/tree/main/docs).

## License

MIT © jsango contributors
