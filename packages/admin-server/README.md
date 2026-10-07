# @jsango/admin-server

> REST API server for jsango Admin orchestrating CRUD operations, permissions, audit trails, and pagination.

Part of the **[jsango](https://github.com/flutterbuddy1/jsango)** backend framework for TypeScript.

## Installation

```bash
pnpm add @jsango/admin-server
```

## Usage

```typescript
import { AdminServer, type IAdminQueryAdapter } from '@jsango/admin-server';
import { AdminRegistry } from '@jsango/admin-core';
import { AdminPermissionChecker } from '@jsango/admin-auth';
import { AdminAuditLogger, InMemoryAuditStore } from '@jsango/admin-audit';
import { Router } from '@jsango/router';

// Bridges the admin to your data layer: implement list/findById/create/update/delete.
declare const queryAdapter: IAdminQueryAdapter;

const registry = new AdminRegistry();
registry.register(User); // an ORM model, or an AdminResource

const admin = new AdminServer({
  registry,
  queryAdapter,
  permissions: new AdminPermissionChecker(),
  audit: new AdminAuditLogger({ store: new InMemoryAuditStore() }),
  prefix: '/admin/api/v1',
});

const router = new Router();
admin.mount(router);
```

## Documentation

For full architecture documentation and guides, visit the [jsango documentation](https://github.com/flutterbuddy1/jsango/tree/main/docs).

## License

MIT © jsango contributors
