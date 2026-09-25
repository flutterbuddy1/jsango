# @jsango/orm

> Model definitions, dirty tracking, pure batch eager loading (.with()), AST query builder, and relationship resolvers.

Part of the **[jsango](https://github.com/jsango/jsango)** backend framework for TypeScript.

## Installation

```bash
pnpm add @jsango/orm
```

## Usage

```typescript
import { defineModel, fields, relations } from '@jsango/orm';

export const User = defineModel('User', {
  id: fields.uuid({ primaryKey: true }),
  email: fields.string({ unique: true }),
  posts: relations.hasMany(() => Post, { foreignKey: 'userId' }),
});

const users = await User.query().with('posts').where('active', '=', true).all();
```

## Documentation

For full architecture documentation and guides, visit the [jsango documentation](https://github.com/jsango/jsango/tree/main/docs).

## License

MIT © jsango contributors
