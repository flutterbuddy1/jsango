# Changelog

All notable changes to the `django-js` framework will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-09-25

### Official 1.0.0 General Availability Release

This marks the official **1.0.0 Stable Release** of `django-js`. The public API is frozen under Semantic Versioning guarantees across all 25 packages.

- **Public API Freeze**: Formally froze all public symbols and exports across `@django-js/*` packages (`docs/API-FREEZE.md`).
- **Framework Version Finalization**: Synchronized all 25 packages, root package, CLI version constant, and examples to `1.0.0`.
- **Packaging & Validation**: Verified complete clean packaging (`npm pack --dry-run`) across all 25 packages.
- **Documentation Complete**: Added comprehensive support matrix (`docs/SUPPORT.md`), API stability policy (`docs/API-STABILITY.md`), 1.0 migration guide (`docs/MIGRATION-1.0.md`), and post-1.0 roadmap (`docs/POST-1.0-ROADMAP.md`).
- **Quality Gates**: 123 test files (603 tests) passing with 100% typecheck, zero lint warnings, and high-concurrency verification.

---

## [0.1.0-rc.1] - 2026-09-25

### Release Candidate 1 — Production Readiness

This marks the official **Release Candidate 1** of `django-js`, a batteries-included, production-grade TypeScript backend framework combining convention-over-configuration design, strict type safety, and modern JavaScript runtimes.

### Added

- **Core Architecture & Runtime (`@django-js/core`, `@django-js/runtime`)**:
  - Runtime abstraction layer supporting Node.js with lifecycle coordinators (`boot`, `ready`, `shutdown`).
  - Structured error hierarchy (`DjangoJsError`, `HttpError`, `DatabaseError`, `AuthError`).
- **Dependency Injection (`@django-js/container`)**:
  - High-performance DI container supporting `singleton`, `transient`, and `scoped` lifetimes.
  - Direct instance resolution fast-path delivering over 24.1M ops/sec.
- **HTTP Engine & Middleware (`@django-js/http`, `@django-js/middleware`)**:
  - Runtime-independent `HttpRequest` and `HttpResponse` abstractions with streaming body parsers.
  - Secure cookie handling, CRLF injection defenses, and strict header validation.
  - Onion-style middleware pipeline with double-call prevention and RFC 7231 compliance.
- **Routing Engine (`@django-js/router`)**:
  - High-throughput Segment-based Radix Trie routing engine with $O(1)$ static route fast-paths (>7.7M ops/sec).
  - Typed route parameter constraints (`:id<number>`), route groups, prefix inheritance, and reverse routing.
- **Database & Transactions (`@django-js/database`)**:
  - Multi-connection `DatabaseManager` with FIFO connection pooling, idle reaping, and timeout protection.
  - Scoped transaction manager with state-machine safety and savepoint rollback support.
  - In-memory database driver and universal SQL dialect abstraction.
- **ORM & Relationships (`@django-js/orm`)**:
  - Declarative model definition with immutable metadata (`ModelMetadata`).
  - Pure batch eager loading via `.with()` guaranteeing zero N+1 queries.
  - Immutable AST query builder and model dirty tracking (`isDirty()`, `getDirty()`).
- **Schema Migrations (`@django-js/migrations`)**:
  - Normalized schema snapshots, live database reflection, and topological schema diffing engine.
  - Distributed migration locking (`django_js_migration_lock`) and reversible DDL compilers.
- **Validation & Serialization (`@django-js/validation`)**:
  - High-throughput schema validation engine for body, query, and parameter payloads.
- **Developer Tooling & CLI (`@django-js/cli`)**:
  - CLI runner (`django-js`, `nexora`) with project scaffolding (`create`), migration runner (`migrate:run`, `migrate:status`, `migrate:rollback`), inspection (`route:list`, `model:list`), and worker execution (`queue:work`).
- **Authentication & Authorization (`@django-js/auth`)**:
  - Pluggable authentication strategies (Session, Bearer JWT, API Key) and Scrypt password hashing.
  - Role, permission, and object-level policy engine (`BasePolicy`, `PolicyRegistry`) with fail-closed security.
- **Caching & Background Queues (`@django-js/cache`, `@django-js/queue`)**:
  - Universal cache abstraction with stampede protection (`remember`), namespaces, and in-memory LRU/TTL driver.
  - At-least-once background job processing with concurrent workers, exponential backoff, and dead-letter store.
- **Events & WebSockets (`@django-js/events`, `@django-js/websocket`)**:
  - Tri-mode event dispatching (`sync`, `async`, `queued`) with priority handlers.
  - Multi-room WebSocket management with heartbeat health monitoring and backpressure safeguards.
- **Admin Platform (`@django-js/admin-core`, `@django-js/admin-server`, `@django-js/admin-auth`, `@django-js/admin-audit`, `@django-js/admin-media`)**:
  - Model-driven Admin resource definitions, CRUD REST API endpoints, staff authorization, and immutable audit logs.
- **OpenAPI 3.1 & Observability (`@django-js/openapi`, `@django-js/observability`)**:
  - Deterministic OpenAPI 3.1.0 document generator with router, validation, ORM, and Admin adapters.
  - Structured JSON logging, bounded Prometheus metrics, monotonic distributed tracing, and health registries.
- **Performance Optimization & Hardening**:
  - Comprehensive memory leak and concurrency load test suites with zero resource leaks.
  - End-to-end Release Candidate smoke test suite (`tests/e2e/rc-smoke.test.ts`).

### Changed

- Standardized package versioning to `0.1.0-rc.1` across all 25 monorepo packages.
- Added explicit MIT license declarations and package manifests.
