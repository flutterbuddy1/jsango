# @jsango/database

> Database connection management, FIFO connection pool, transaction state machines, and dialect abstractions.

Part of the **[jsango](https://github.com/flutterbuddy1/jsango)** backend framework for TypeScript.

## Installation

```bash
pnpm add @jsango/database
```

## Usage

```typescript
import { DatabaseManager, databaseConfigFromEnv } from '@jsango/database';

const db = new DatabaseManager({
  default: 'main',
  connections: {
    main: { driver: 'sqlite', filename: './dev.db', pool: { max: 10 } },
    // or: { url: 'postgres://user:pass@localhost:5432/app' }
  },
});
// Or build the config from DATABASE_URL / DATABASE_* variables:
// const db = new DatabaseManager(databaseConfigFromEnv());

await db.transaction(async (tx) => {
  await tx.query('INSERT INTO users (id, email) VALUES (?, ?)', ['1', 'user@test.com']);
}); // commits, or rolls back if the callback throws

const result = await db.query<{ id: string; email: string }>('SELECT id, email FROM users');
console.log(result.rows);
await db.close();
```

## Documentation

For full architecture documentation and guides, visit the [jsango documentation](https://github.com/flutterbuddy1/jsango/tree/main/docs).

## License

MIT © jsango contributors
