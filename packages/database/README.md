# @jsango/database

> Database connection management, FIFO connection pool, transaction state machines, and dialect abstractions.

Part of the **[jsango](https://github.com/jsango/jsango)** backend framework for TypeScript.

## Installation

```bash
pnpm add @jsango/database
```

## Usage

```typescript
import { DatabaseManager, MemoryDatabaseDriver } from '@jsango/database';

const db = new DatabaseManager({
  default: new MemoryDatabaseDriver(),
});
await db.transaction(async (tx) => {
  await tx.execute('INSERT INTO users (id, email) VALUES (?, ?)', ['1', 'user@test.com']);
});
```

## Documentation

For full architecture documentation and guides, visit the [jsango documentation](https://github.com/jsango/jsango/tree/main/docs).

## License

MIT © jsango contributors
