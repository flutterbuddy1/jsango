# @jsango/admin-core

> Declarative admin resource definitions, auto-generation from ORM metadata, field formatting, and registry.

Part of the **[jsango](https://github.com/jsango/jsango)** backend framework for TypeScript.

## Installation

```bash
pnpm add @jsango/admin-core
```

## Usage

```typescript
import { AdminRegistry, defineAdminResource, fields } from '@jsango/admin-core';

const registry = new AdminRegistry();
const userResource = defineAdminResource({
  name: 'User',
  listFields: ['id', 'email', 'createdAt'],
  searchFields: ['email'],
});
registry.register(userResource);
```

## Documentation

For full architecture documentation and guides, visit the [jsango documentation](https://github.com/jsango/jsango/tree/main/docs).

## License

MIT © jsango contributors
