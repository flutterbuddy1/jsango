# ADR-017: Identity Abstraction and Request-Scoped Principals

## Context

Security principals can be human users, background worker processes, service accounts, or anonymous clients. Storing the authenticated principal in global variables or static thread-locals introduces race conditions and security vulnerabilities in asynchronous Node.js and Bun runtimes.

## Decision

1. **Identity Interface**:
   - `Identity` represents an immutable principal with `id`, `type`, `isAuthenticated`, `isSuperuser`, `roles`, `permissions`, and `tenantId`.
   - Distinct concrete implementations: `UserIdentity`, `ServiceAccountIdentity`, `SystemIdentity`, and `AnonymousIdentity`.
2. **Request-Scoped Binding**:
   - Identity is stored strictly within `RequestContext.state` (`jsango:auth`) and registered in the request-scoped dependency injection container.
   - Zero process-level or global mutable security state.
3. **Safe Serialization**:
   - `Identity.toJSON()` strips all secrets and sensitive credentials, preventing accidental leakage in log aggregation pipelines.

## Consequences

- Full concurrency safety across asynchronous request boundaries.
- Clean diagnostics and audit logging without credential exposure.
