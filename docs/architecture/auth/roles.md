# Roles Subsystem

## 1. Role Definition

A role groups multiple permissions together:

```typescript
export interface RoleDefinition {
  readonly name: string;
  readonly permissions: readonly string[];
  readonly description?: string | undefined;
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
}
```

## 2. RoleRegistry

`RoleRegistry` registers application and domain roles:

```typescript
const roles = new RoleRegistry();
roles.register({
  name: 'editor',
  permissions: ['articles.create', 'articles.update'],
  description: 'Content editor',
});
```

## 3. Resolving Permissions from Roles

When an `Identity` has multiple roles, `RoleRegistry.getPermissionsForRoles(identity.roles)` returns a deduplicated, aggregate set of permissions granted by all assigned roles.
