# @jsango/admin-server

> REST API server for jsango Admin orchestrating CRUD operations, permissions, audit trails, and pagination.

Part of the **[jsango](https://github.com/jsango/jsango)** backend framework for TypeScript.

## Installation

```bash
pnpm add @jsango/admin-server
```

## Usage

```typescript
import { mountAdminApi, AdminCrudService } from '@jsango/admin-server';
import { Router } from '@jsango/router';

const router = new Router();
mountAdminApi(router, adminRegistry, crudService, { prefix: '/admin/api' });
```

## Documentation

For full architecture documentation and guides, visit the [jsango documentation](https://github.com/jsango/jsango/tree/main/docs).

## License

MIT © jsango contributors
