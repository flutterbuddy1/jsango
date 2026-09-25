# @django-js/orm

> Model definitions, dirty tracking, pure batch eager loading (.with()), AST query builder, and relationship resolvers.

Part of the **[django-js](https://github.com/django-js/django-js)** backend framework for TypeScript.

## Installation

```bash
pnpm add @django-js/orm
```

## Usage

```typescript
import { defineModel, fields, relations } from '@django-js/orm';

export const User = defineModel('User', {
  id: fields.uuid({ primaryKey: true }),
  email: fields.string({ unique: true }),
  posts: relations.hasMany(() => Post, { foreignKey: 'userId' }),
});

const users = await User.query().with('posts').where('active', '=', true).all();
```

## Documentation

For full architecture documentation and guides, visit the [django-js documentation](https://github.com/django-js/django-js/tree/main/docs).

## License

MIT © django-js contributors
