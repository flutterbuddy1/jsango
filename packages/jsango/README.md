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
import { Application } from 'jsango';
import { defineModel, fields } from 'jsango';

export const User = defineModel({
  name: 'User',
  table: 'users',
  fields: {
    id: fields.uuid({ primaryKey: true }),
    email: fields.string({ unique: true }),
  },
});

const app = new Application();

app.get('/api/users', async (ctx) => {
  const users = await User.query().get();
  return ctx.response.json(users);
});

await app.listen(3000, '0.0.0.0');
```

## Documentation

For guides and full documentation, visit [https://flutterbuddy1.github.io/jsango/](https://flutterbuddy1.github.io/jsango/).
