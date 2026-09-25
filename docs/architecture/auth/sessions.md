# Session Architecture & Lifecycle

## 1. Overview

Nexora provides a pluggable session abstraction decoupling session storage from runtime execution.

```typescript
export interface ISessionStore {
  get(id: string): Promise<Session | undefined>;
  create(data: CreateSessionData): Promise<Session>;
  update(id: string, data: Partial<Session>): Promise<Session | undefined>;
  delete(id: string): Promise<boolean>;
  touch(id: string, ttlMs?: number): Promise<boolean>;
}
```

## 2. Store Implementations

- **`MemorySessionStore`**: In-memory Map implementation with automatic TTL expiration, suitable for development and test environments.
- **Production Stores**: In Phase 11, Redis and database-backed stores implementing `ISessionStore` will be added.

## 3. Session Fixation Defense

Session fixation occurs when an attacker forces a known session identifier upon a victim. When the victim authenticates, the attacker gains access.

To prevent this vulnerability:

- `SessionAuthenticationStrategy.rotate(oldSessionId)` must be invoked upon user login.
- `rotate()` invalidates the previous session record and mints a newly generated cryptographically random 256-bit identifier (`CryptoUtils.generateSecureToken(32)`), preserving user payload data under the new key.

## 4. Cookie Security Standards

Session identifiers transported via cookies MUST configure:

- `httpOnly: true` (prevents XSS access to session cookie)
- `sameSite: 'Lax'` or `'Strict'` (mitigates CSRF attacks)
- `secure: true` (enforces HTTPS in production)
