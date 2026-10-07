# @jsango/admin-core

> Declarative admin resource definitions, auto-generation from ORM metadata, field formatting, and registry.

Part of the **[jsango](https://github.com/flutterbuddy1/jsango)** backend framework for TypeScript.

## Installation

```bash
pnpm add @jsango/admin-core
```

## Usage

```typescript
import { AdminRegistry, AdminResource } from '@jsango/admin-core';

const registry = new AdminRegistry();

const userResource = new AdminResource({
  modelName: 'User',
  fields: [
    { name: 'id', type: 'uuid', readonly: true },
    { name: 'email', type: 'email', searchable: true },
    { name: 'createdAt', type: 'datetime', readonly: true },
  ],
  listFields: ['id', 'email', 'createdAt'],
  searchFields: ['email'],
});
registry.register(userResource);

// Or derive a resource automatically from an ORM model: registry.register(User);
```

## Documentation

For full architecture documentation and guides, visit the [jsango documentation](https://github.com/flutterbuddy1/jsango/tree/main/docs).

## License

MIT © jsango contributors
