# @django-js/auth Architecture Overview

## 1. Core Mission & Philosophy

`@django-js/auth` establishes the security, identity, and access-control foundation for the Nexora (`django-js`) framework. It is strictly engineered around two fundamental questions:

1. **Authentication**: _"Who is this principal?"_
2. **Authorization**: _"What is this principal allowed to do?"_

These two responsibilities are kept strictly decoupled:

- Authentication establishes an authenticated principal represented by an immutable `Identity`.
- Authorization evaluates policies, roles, and permissions against that `Identity` and resource context.
- Authentication never implicitly grants authorization permissions.
- Authorization fails closed by default: any missing identity, missing policy, or unhandled decision resolves to **DENY**.

---

## 2. Request Lifecycle Pipeline

```
Incoming HttpRequest
        ↓
[Authentication Middleware]
        ↓
  AuthenticationManager
    ├── SessionAuthenticationStrategy
    ├── BearerTokenAuthenticationStrategy (JWT)
    └── ApiKeyAuthenticationStrategy (Hashed)
        ↓
  Establishes Identity (User, ServiceAccount, Anonymous, System)
        ↓
  Attached to RequestContext.state and RequestScope DI Container
        ↓
[Authorization Middleware]
        ↓
  AuthorizationManager
    ├── Centralized Superuser Audit (isSuperuser === true)
    ├── PermissionRegistry (Exact & Wildcards: users.*)
    ├── RoleRegistry (Role to Permissions Mapping)
    ├── PolicyRegistry (ModelMetadata / Object-level Policies)
    └── Composite Policies (andPolicy, orPolicy, notPolicy)
        ↓
  Decision: ALLOW or DENY (Throws 403 ForbiddenError on Deny)
        ↓
Route Handler
        ↓
HttpResponse (200 OK / 401 Unauthorized / 403 Forbidden)
```

---

## 3. Package Documentation Index

| Document                                         | Description                                                         |
| :----------------------------------------------- | :------------------------------------------------------------------ |
| [authentication.md](authentication.md)           | Multi-strategy authentication engine and manager                    |
| [identity.md](identity.md)                       | Principal types, anonymous representation, and serialization safety |
| [sessions.md](sessions.md)                       | Session lifecycle, stores, fixation defense, and cookie security    |
| [tokens.md](tokens.md)                           | JWT implementation, algorithm confusion defense, and revocation     |
| [authorization.md](authorization.md)             | Access control architecture and fail-closed evaluation              |
| [permissions.md](permissions.md)                 | Namespaced permission strings and wildcard matching                 |
| [roles.md](roles.md)                             | Role mappings and aggregated permissions                            |
| [policies.md](policies.md)                       | Resource & object-level policies and boolean combinators            |
| [middleware.md](middleware.md)                   | HTTP middleware integration and 401 vs 403 semantics                |
| [security.md](security.md)                       | Security review, cryptographic choices, and timing defenses         |
| [admin-compatibility.md](admin-compatibility.md) | Preparation for Phase 13 Admin and multi-tenancy                    |
| [testing.md](testing.md)                         | Unit, integration, security, and concurrency test suites            |
| [performance.md](performance.md)                 | Benchmarks and hot-path execution throughput                        |
