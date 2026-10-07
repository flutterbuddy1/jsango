# jsango

> Production-grade, batteries-included TypeScript backend framework for modern JavaScript runtimes.

## Installation

```bash
# Create a new application
npx jsango create my-app
cd my-app
pnpm install
```

## Quick Example

```typescript
import { createApp, defineModel, fields, DatabaseManager, databaseConfigFromEnv, setDatabaseManager } from 'jsango';

export const User = defineModel({
  name: 'User',
  table: 'users',
  fields: {
    id: fields.uuid({ primaryKey: true, defaultValue: () => crypto.randomUUID() }),
    email: fields.string({ unique: true }),
  },
});

// Reads DATABASE_URL (or DATABASE_* variables); without it models use an in-memory database.
setDatabaseManager(new DatabaseManager(databaseConfigFromEnv()));

const app = createApp();

app.get('/api/users', async () => {
  const users = await User.query().get();
  return { users }; // plain objects are sent as JSON
});

await app.listen(3000, '0.0.0.0');
```

## Documentation

For guides and full documentation, visit [https://flutterbuddy1.github.io/jsango/](https://flutterbuddy1.github.io/jsango/).
