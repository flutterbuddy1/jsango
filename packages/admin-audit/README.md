# @django-js/admin-audit

> Production-grade audit logging, sensitive field redaction, and change tracking for django-js Admin.

Part of the **[django-js](https://github.com/django-js/django-js)** backend framework for TypeScript.

## Installation

```bash
pnpm add @django-js/admin-audit
```

## Usage

```typescript
import { AdminAuditLogger, InMemoryAuditStore, diffChanges } from '@django-js/admin-audit';

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

For full architecture documentation and guides, visit the [django-js documentation](https://github.com/django-js/django-js/tree/main/docs).

## License

MIT © django-js contributors
