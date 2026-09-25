# @django-js/database

> Database connection management, FIFO connection pool, transaction state machines, and dialect abstractions.

Part of the **[django-js](https://github.com/django-js/django-js)** backend framework for TypeScript.

## Installation

```bash
pnpm add @django-js/database
```

## Usage

```typescript
import { DatabaseManager, MemoryDatabaseDriver } from '@django-js/database';

const db = new DatabaseManager({
  default: new MemoryDatabaseDriver(),
});
await db.transaction(async (tx) => {
  await tx.execute('INSERT INTO users (id, email) VALUES (?, ?)', ['1', 'user@test.com']);
});
```

## Documentation

For full architecture documentation and guides, visit the [django-js documentation](https://github.com/django-js/django-js/tree/main/docs).

## License

MIT © django-js contributors
