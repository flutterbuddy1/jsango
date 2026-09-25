# ADR-018: Session and Token Security Strategy

## Context

Session authentication requires protection against session fixation and cookie theft, while token authentication requires defenses against algorithm confusion and replay attacks without requiring external third-party dependencies.

## Decision

1. **Session Store Abstraction**:
   - `ISessionStore` provides CRUD and TTL management, with `MemorySessionStore` for tests and Redis/Database stores ready for production.
2. **Session Fixation Defense**:
   - `SessionAuthenticationStrategy.rotate()` replaces the session identifier with a newly generated cryptographic random ID upon privilege elevation (login), while preserving user state.
3. **JWT Algorithm Confusion Defense**:
   - `JwtService` enforces an explicit whitelist (`HS256`, `HS384`, `HS512`) and strictly rejects `alg: "none"`.
4. **Token Revocation Store**:
   - `ITokenRevocationStore` enables blacklisting compromised stateless JWT IDs (`jti`) until their expiration.
5. **API Key Hashing**:
   - `ApiKeyAuthenticationStrategy` SHA-256 hashes keys prior to verification, eliminating raw key retention in database queries or logs.

## Consequences

- Full RFC 7519 and OWASP compliance with zero external dependencies.
- Pluggable session backends compatible with clustered deployments.
