# @jsango/admin-audit

> Production-grade audit logging, sensitive field redaction, and change tracking for jsango Admin.

Part of the **[jsango](https://github.com/jsango/jsango)** backend framework for TypeScript.

## Installation

```bash
pnpm add @jsango/admin-audit
```

## Usage

```typescript
import { AdminAuditLogger, InMemoryAuditStore, diffChanges } from '@jsango/admin-audit';

const store = new InMemoryAuditStore();
const logger = new AdminAuditLogger(store);

await logger.log({
  resourceName: 'User',
  recordId: '123',
  action: 'update',
  userId: 'admin-1',
  changes: diffChanges({ email: 'old@test.com' }, { email: 'new@test.com' }),
});
```

## Documentation

For full architecture documentation and guides, visit the [jsango documentation](https://github.com/jsango/jsango/tree/main/docs).

## License

MIT © jsango contributors
