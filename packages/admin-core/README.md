# @django-js/admin-core

> Declarative admin resource definitions, auto-generation from ORM metadata, field formatting, and registry.

Part of the **[django-js](https://github.com/django-js/django-js)** backend framework for TypeScript.

## Installation

```bash
pnpm add @django-js/admin-core
```

## Usage

```typescript
import { AdminRegistry, defineAdminResource, fields } from '@django-js/admin-core';

const registry = new AdminRegistry();
const userResource = defineAdminResource({
  name: 'User',
  listFields: ['id', 'email', 'createdAt'],
  searchFields: ['email'],
});
registry.register(userResource);
```

## Documentation

For full architecture documentation and guides, visit the [django-js documentation](https://github.com/django-js/django-js/tree/main/docs).

## License

MIT © django-js contributors
