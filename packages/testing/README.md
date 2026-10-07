# @jsango/testing

> Test context helper for jsango apps. For HTTP tests, call `app.handle()` with an `HttpRequest` to exercise your app in-process.

Part of the **[jsango](https://github.com/flutterbuddy1/jsango)** backend framework for TypeScript.

## Installation

```bash
pnpm add @jsango/testing
```

## Usage

```typescript
import { createTestContext } from '@jsango/testing';
import { Container } from '@jsango/container';
import { createApp, HttpRequest } from 'jsango';

// A per-test context holding an isolated DI container.
const container = new Container();
const testCtx = createTestContext(container);

// HTTP tests: call the app in-process with app.handle() (no network, no port).
const app = createApp();
app.get('/api/users', () => ({ users: [] }));

const res = await app.handle(new HttpRequest({ method: 'GET', url: '/api/users' }));
console.log(res.status, res.body); // 200, JSON body

await testCtx.reset();
```

## Documentation

For full architecture documentation and guides, visit the [jsango documentation](https://github.com/flutterbuddy1/jsango/tree/main/docs).

## License

MIT © jsango contributors
