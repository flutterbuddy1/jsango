# @jsango/orm

> Model definitions, dirty tracking, pure batch eager loading (.with()), AST query builder, and relationship resolvers.

Part of the **[jsango](https://github.com/flutterbuddy1/jsango)** backend framework for TypeScript.

## Installation

```bash
pnpm add @jsango/orm
```

## Usage

```typescript
import { defineModel, fields, relations, setDatabaseManager } from '@jsango/orm';
import { DatabaseManager } from '@jsango/database';

setDatabaseManager(
  new DatabaseManager({ default: 'main', connections: { main: { driver: 'sqlite', filename: './dev.db' } } })
);

export const User = defineModel({
  name: 'User',
  table: 'users',
  fields: {
    id: fields.uuid({ primaryKey: true, defaultValue: () => crypto.randomUUID() }),
    email: fields.string({ unique: true }),
    active: fields.boolean({ defaultValue: true }),
  },
  relations: {
    posts: relations.hasMany('Post', { foreignKey: 'userId' }),
  },
  timestamps: true,
});

export const Post = defineModel({
  name: 'Post',
  table: 'posts',
  fields: {
    id: fields.uuid({ primaryKey: true, defaultValue: () => crypto.randomUUID() }),
    userId: fields.uuid(),
    title: fields.string(),
  },
  relations: {
    author: relations.belongsTo('User', { foreignKey: 'userId' }),
  },
});

const user = await User.create({ email: 'ada@example.com' });
const users = await User.query().with('posts').where('active', '=', true).orderBy('email').get();
const page = await User.query().paginate({ page: 1, pageSize: 20 });
```

## Documentation

For full architecture documentation and guides, visit the [jsango documentation](https://github.com/flutterbuddy1/jsango/tree/main/docs).

## License

MIT © jsango contributors
