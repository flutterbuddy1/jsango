# @jsango/admin-auth

> Staff authorization, resource-level CRUD permissions, and field-level visibility checks for jsango Admin.

Part of the **[jsango](https://github.com/jsango/jsango)** backend framework for TypeScript.

## Installation

```bash
pnpm add @jsango/admin-auth
```

## Usage

```typescript
import { AdminPermissionChecker } from '@jsango/admin-auth';

const checker = new AdminPermissionChecker();
const allowed = checker.canAccessResource(identity, resource, 'create');
```

## Documentation

For full architecture documentation and guides, visit the [jsango documentation](https://github.com/jsango/jsango/tree/main/docs).

## License

MIT © jsango contributors
