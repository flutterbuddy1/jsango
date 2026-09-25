# @django-js/admin-server

> REST API server for django-js Admin orchestrating CRUD operations, permissions, audit trails, and pagination.

Part of the **[django-js](https://github.com/django-js/django-js)** backend framework for TypeScript.

## Installation

```bash
pnpm add @django-js/admin-server
```

## Usage

```typescript
import { mountAdminApi, AdminCrudService } from '@django-js/admin-server';
import { Router } from '@django-js/router';

const router = new Router();
mountAdminApi(router, adminRegistry, crudService, { prefix: '/admin/api' });
```

## Documentation

For full architecture documentation and guides, visit the [django-js documentation](https://github.com/django-js/django-js/tree/main/docs).

## License

MIT © django-js contributors
