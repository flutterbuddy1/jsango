# @jsango/admin-audit

> Production-grade audit logging, sensitive field redaction, and change tracking for jsango Admin.

Part of the **[jsango](https://github.com/flutterbuddy1/jsango)** backend framework for TypeScript.

## Installation

```bash
pnpm add @jsango/admin-audit
```

## Usage

```typescript
import { AdminAuditLogger, InMemoryAuditStore } from '@jsango/admin-audit';

const logger = new AdminAuditLogger({ store: new InMemoryAuditStore() });

// Sensitive fields (password, token, secret, ...) are redacted from the diff by default.
const changes = logger.diffChanges(
  { email: 'old@test.com', password: 'a' },
  { email: 'new@test.com', password: 'b' }
);

await logger.log('update', {
  resourceId: 'user',
  objectId: '123',
  actor: { id: 'admin-1', email: 'admin@test.com' },
  changes,
});

const page = await logger.query({ resourceId: 'user', limit: 20 });
console.log(page.total, page.entries);
```

## Documentation

For full architecture documentation and guides, visit the [jsango documentation](https://github.com/flutterbuddy1/jsango/tree/main/docs).

## License

MIT © jsango contributors
