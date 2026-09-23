---
trigger: always_on
---

# Nexora Architecture Rules

## Project Identity

Nexora is a production-grade, batteries-included TypeScript backend framework.

The framework is inspired by:

- Django's convention-over-configuration philosophy
- Laravel's developer experience
- Modern TypeScript
- High-performance JavaScript runtimes

Nexora is NOT a copy of Django, Laravel, Express, NestJS, or any existing framework.

The implementation must use its own architecture and APIs.

---

# Core Principles

1. TypeScript-first
2. Strong type safety
3. Convention over configuration
4. Explicit over magical behavior
5. Dependency inversion
6. Modular architecture
7. High performance
8. Security by default
9. Testability
10. Backward compatibility
11. Minimal runtime overhead
12. Clear separation of concerns

---

# Architecture Layers

Nexora follows strict layering:

Runtime
↓
Core
↓
HTTP
↓
Router
↓
Middleware
↓
Controllers
↓
Services
↓
Domain
↓
ORM
↓
Database

Infrastructure concerns must never leak into domain logic.

---

# Package Rules

Each package must have one clear responsibility.

Example:

@Nexora/core
Core application lifecycle and dependency injection.

@Nexora/http
HTTP request/response abstractions.

@Nexora/router
Route matching and route registration.

@Nexora/orm
Models, queries and relationships.

@Nexora/database
Database drivers and connection management.

@Nexora/auth
Authentication and authorization.

@Nexora/validation
Request and data validation.

@Nexora/cache
Cache abstraction.

@Nexora/queue
Background jobs.

@Nexora/events
Application events.

@Nexora/websocket
Realtime functionality.

@Nexora/cli
CLI and code generation.

@Nexora/testing
Testing utilities.

---

# Dependency Rules

Lower-level packages must never import higher-level packages.

Allowed:

core → nothing
http → core
router → core/http
middleware → core/http
orm → core/database
auth → core/http
application → all required abstractions

Forbidden:

core → orm
database → controllers
orm → application
router → controllers
domain → http
domain → database implementation

Use interfaces when crossing architectural boundaries.

---

# No Circular Dependencies

Circular dependencies are strictly forbidden.

Before adding an import, verify that it does not introduce a cycle.

If a cycle appears, redesign the dependency boundary instead of suppressing the problem.

---

# Public API

Every package must clearly distinguish:

- public API
- internal API

Internal implementation details must not be exported unnecessarily.

Use index.ts or explicit package exports.

Do not expose internal classes unless required.

---

# Runtime Independence

The framework must not tightly couple its architecture to Node.js.

Create runtime abstractions.

The framework should eventually support:

- Node.js
- Bun

Runtime-specific functionality must exist behind adapters.

---

# Performance

Do not sacrifice architecture for premature micro-optimizations.

However:

- avoid unnecessary allocations
- avoid reflection-heavy hot paths
- avoid unnecessary Promise creation
- avoid repeated parsing
- avoid expensive middleware chains
- reuse connection pools
- cache compiled route structures
- optimize serialization paths

Performance-sensitive code must have benchmarks.

---

# Error Handling

Never silently swallow errors.

Framework errors must use structured error types.

Errors must contain:

- code
- message
- cause when available
- metadata when useful

Never expose internal stack traces in production responses.

---

# Configuration

Configuration must be centralized.

Do not scatter environment variable access throughout the framework.

Use a configuration abstraction.

---

# Dependency Injection

Use dependency injection for infrastructure services.

Do not use global mutable state.

Singletons must be explicit and lifecycle-managed.

---

# State

Avoid global mutable state.

Application state must belong to explicit application/container/request scopes.

---

# Async

Use async APIs for I/O.

Do not create unnecessary async boundaries.

Never block the event loop with synchronous CPU-heavy operations.

---

# API Design

Public APIs must be:

- predictable
- typed
- minimal
- composable
- backward-compatible

Do not add APIs simply because they are convenient internally.

---

# Breaking Changes

Never introduce a breaking public API change without:

1. documenting it
2. updating tests
3. updating migration/upgrade notes
4. updating documentation

---

# Tests

Every new feature requires tests.

Critical framework behavior requires:

- unit tests
- integration tests
- edge-case tests

Performance-critical components require benchmarks.

---

# Documentation

Every public API must have documentation.

Architecture decisions must be recorded in docs/decisions.

---

# Agent Behavior

Before implementing a feature:

1. Inspect existing architecture.
2. Identify the correct package.
3. Identify existing abstractions that should be reused.
4. Check dependency direction.
5. Check tests.
6. Check documentation.
7. Propose architectural changes before making large changes.

Never create duplicate abstractions when an existing abstraction can be reused.

Never rewrite working architecture unnecessarily.

Never introduce a new dependency without justification.