# @django-js/admin-auth

> Staff authorization, resource-level CRUD permissions, and field-level visibility checks for django-js Admin.

Part of the **[django-js](https://github.com/django-js/django-js)** backend framework for TypeScript.

## Installation

```bash
pnpm add @django-js/admin-auth
```

## Usage

```typescript
import { AdminPermissionChecker } from '@django-js/admin-auth';

const checker = new AdminPermissionChecker();
const allowed = checker.canAccessResource(identity, resource, 'create');
```

## Documentation

For full architecture documentation and guides, visit the [django-js documentation](https://github.com/django-js/django-js/tree/main/docs).

## License

MIT © django-js contributors
