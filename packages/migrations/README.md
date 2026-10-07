# @jsango/migrations

> Schema diffing engine, DDL compilers, migration generator, distributed migration locking, and reversible runner.

Part of the **[jsango](https://github.com/flutterbuddy1/jsango)** backend framework for TypeScript.

## Installation

```bash
pnpm add @jsango/migrations
```

## Usage

```typescript
import { MigrationRunner, MigrationRegistry, defineMigration } from '@jsango/migrations';
import { DatabaseManager } from '@jsango/database';

const createUsers = defineMigration({
  id: '20260101000000_create_users',
  up: async (ctx) => {
    await ctx.createTable('users', (table) => {
      table.id();
      table.string('email').unique();
      table.timestamps();
    });
  },
  down: async (ctx) => {
    await ctx.dropTable('users');
  },
});

const registry = new MigrationRegistry();
registry.register(createUsers);
// Or load every file in a folder: const { registry } = await loadMigrationsFromDirectory('./migrations');

const db = new DatabaseManager({ default: 'main', connections: { main: { url: process.env.DATABASE_URL } } });
const runner = new MigrationRunner({ databaseManager: db, registry });

const { applied } = await runner.migrate(); // takes a distributed lock while running
const status = await runner.status();
await runner.rollback({ steps: 1 });
```

## Documentation

For full architecture documentation and guides, visit the [jsango documentation](https://github.com/flutterbuddy1/jsango/tree/main/docs).

## License

MIT © jsango contributors
