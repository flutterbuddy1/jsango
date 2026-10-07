# @jsango/admin-auth

> Staff authorization, resource-level CRUD permissions, and field-level visibility checks for jsango Admin.

Part of the **[jsango](https://github.com/flutterbuddy1/jsango)** backend framework for TypeScript.

## Installation

```bash
pnpm add @jsango/admin-auth
```

## Usage

```typescript
import { AdminPermissionChecker } from '@jsango/admin-auth';
import { AdminResource } from '@jsango/admin-core';
import { UserIdentity } from '@jsango/auth';

const checker = new AdminPermissionChecker({ staffRole: 'admin' });
const resource = new AdminResource({ modelName: 'User' });
const identity = new UserIdentity({ id: '1', roles: ['admin'] });

checker.canAccessAdmin(identity); // true: has the staff role
const allowed = await checker.canCreate(identity, resource);
const canSeeEmail = checker.canViewField(identity, resource, 'email');
```

## Documentation

For full architecture documentation and guides, visit the [jsango documentation](https://github.com/flutterbuddy1/jsango/tree/main/docs).

## License

MIT © jsango contributors
