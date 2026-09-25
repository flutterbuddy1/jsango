# Identity Abstraction

## 1. Identity Representation

An `Identity` represents an authenticated or anonymous principal within Nexora:

```typescript
export interface Identity {
  readonly id: string;
  readonly type: IdentityType;
  readonly isAuthenticated: boolean;
  readonly isSuperuser: boolean;
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
  readonly tenantId?: string | undefined;
  readonly metadata: Readonly<Record<string, unknown>>;
  hasRole(role: string): boolean;
  hasPermission(permission: string): boolean;
  toJSON(): Record<string, unknown>;
}
```

## 2. Concrete Principal Types

- **`UserIdentity`**: Represents a standard human user (`type: 'user'`, `isAuthenticated: true`).
- **`ServiceAccountIdentity`**: Represents machine-to-machine integrations or internal microservices (`type: 'service_account'`, `isAuthenticated: true`).
- **`AnonymousIdentity`**: Represents an unauthenticated request (`type: 'anonymous'`, `isAuthenticated: false`, `id: 'anonymous'`).
- **`SystemIdentity`**: Represents internal framework tasks or background workers (`type: 'system'`, `isAuthenticated: true`, `isSuperuser: true`).

## 3. Serialization & Security

The `toJSON()` method creates a safe representation of the principal suitable for diagnostics or audit logs. It guarantees that credentials, passwords, private keys, or raw authentication tokens are never serialized into logs or network payloads.
