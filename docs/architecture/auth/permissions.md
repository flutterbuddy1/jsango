# Permissions Subsystem

## 1. Permission Definition

Permissions are stable namespaced string tokens representing granular capabilities (e.g. `users.create`, `billing.view`, `orders.refund`).

```typescript
export interface PermissionDefinition {
  readonly name: string;
  readonly description?: string | undefined;
  readonly category?: string | undefined;
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
}
```

## 2. PermissionRegistry

`PermissionRegistry` centralizes registered permissions across packages and plugins.

```typescript
const registry = new PermissionRegistry();
registry.register({ name: 'users.read', description: 'Read user records' });
```

## 3. Wildcard Matching

`PermissionRegistry.matches()` evaluates granted permissions against requested permissions:

- Exact match: `'users.read'` matches `'users.read'`.
- Namespace wildcard: `'users.*'` matches `'users.read'`, `'users.write'`, `'users.delete'`.
- Superuser wildcard: `'*'` matches any requested permission string.
