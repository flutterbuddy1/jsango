# django-js Framework Roadmap

This roadmap outlines the phased development plan for the **django-js** framework. Each phase must be fully designed, implemented, tested, and documented before subsequent phases commence.

---

### [x] PHASE 0 — Architecture Foundation

- Monorepo setup with pnpm workspaces, Turborepo, Vitest, ESLint, and Prettier.
- Package scaffolding across 12 initial packages.
- Strict TypeScript configuration (`strict: true`, NodeNext ESM).
- Explicit public/internal package boundaries.
- Foundational abstractions: structured error model (`DjangoJsError`), logging interface (`ILogger`), runtime adapter (`IRuntimeAdapter`), and configuration interface (`IConfigProvider`).
- Comprehensive architectural documentation and ADRs (ADR-001 through ADR-004).

---

### [x] PHASE 1 — Runtime + Core + Container + Config

- Complete Node.js runtime adapter implementation.
- Application lifecycle coordinator (boot, ready, shutdown hooks).
- Production-grade dependency injection container with transient, singleton, and scoped lifetimes.
- Environment variable parser, type caster, schema validator, and configuration provider.

---

### [x] PHASE 2 — HTTP Core

- High-performance, runtime-independent HTTP request and response abstractions.
- Streaming body parsers (JSON, text, urlencoded, bytes) with configurable `maxBodySize`.
- Secure cookie handling, SameSite/HttpOnly defaults, and CRLF injection protection.
- Safe, case-insensitive headers abstraction with header injection defense.
- Standardized HTTP status codes, structured error hierarchy, and safe production error serialization.
- RequestContext with correlation ID tracking and scoped DI container slot.
- Production Node.js HTTP server adapter with graceful shutdown.
- Microbenchmarks covering core hot paths (up to 10.9M ops/sec).

---

### [x] PHASE 3 — High-Performance Router

- Segment-based Radix Trie routing engine with $O(k)$ lookup time (>3.2M ops/sec).
- Deterministic route precedence: Static > Constrained Param > Generic Param > Wildcard.
- Typed parameter constraints (inline `:id<number>` and route options), optional parameters (`:slug?`), and catch-all wildcards (`*path`).
- Automatic RFC 7231 HEAD fallback to GET routes with response body stripping.
- Explicit distinction between 404 (Not Found) and 405 (Method Not Allowed with `Allow` header).
- Route groups, prefix composition, and deep metadata inheritance.
- Named routes with reverse URL generation and query parameter appending.
- Two-phase lifecycle with `router.compile()` locking for zero concurrency race conditions.
- Comprehensive unit (41), fuzz (6), integration (6), and microbenchmark (10 scenarios) suites.

---

### [x] PHASE 4 — Middleware + Application Lifecycle

- Onion-style middleware pipeline with double-call prevention (`MultipleNextCallsError`).
- Support for class-based (`IMiddleware`), function-based (`MiddlewareHandler`), and named string aliases (`registry.register()`).
- Unified `Application` integrating Runtime, Core, Container, Config, HTTP, Router, and Middleware.
- Request-scoped dependency injection container lifecycle with guaranteed cleanup in `finally`.
- Route-level and group-level middleware inheritance via array merging.
- Response normalizer supporting `HttpResponse`, strings, `Uint8Array`, streams, JSON objects, and 204 No Content.
- RFC 7231 compliant error and fallback handling (404 Not Found, 405 Method Not Allowed with `Allow` header).
- Global error boundary with custom error handler support and production masking (`ERR_INTERNAL_SERVER_ERROR`).
- Comprehensive unit (24), integration (7), reference app (3), and microbenchmark (8 scenarios) suites.
- Architecture documentation (`docs/architecture/middleware/`) and ADR-007.

---

### [x] PHASE 5 — Database Abstraction

- Unified database manager (`DatabaseManager`) managing multiple named connection pools (`default`, `analytics`, `readonly`).
- Production-grade zero-dependency connection pool (`ConnectionPool`) with FIFO waiter queue, configurable min/max bounds, acquisition timeouts, and idle reaping.
- Scoped transaction manager (`DatabaseTransaction`) with formal state machine guards, automatic commit/rollback callback runner, and nested savepoints.
- Universal driver contract (`IDatabaseDriver`, `IDriverConnection`) with capability flags (`DatabaseCapabilities`).
- Deterministic in-memory database engine (`MemoryDatabaseDriver`) for testability and local development.
- Universal SQL dialect abstraction (`SqlDialect`) with string-safe placeholder normalization (`?` to `$1`).
- Security-by-default credential masking (`maskConnectionString`, `maskConnectionConfig`).
- Comprehensive unit (31), integration (6), driver contract (5), and microbenchmark (9 scenarios) suites.
- Architecture documentation (`docs/architecture/database/`) and ADR-008.

---

### [ ] PHASE 6 — ORM

- Active record / data mapper hybrid model definitions.
- Fluent, type-safe SQL query builder.
- Relationship definitions: one-to-one, one-to-many, many-to-many with lazy and eager loading.

---

### [ ] PHASE 7 — Migrations

- Migration file generator and runner.
- Schema diffing and transactional DDL execution.
- Migration rollback and status tracking.

---

### [ ] PHASE 8 — Validation

- High-throughput schema validation engine.
- Request payload, query, and parameter validation.
- Standardized validation error formatting.

---

### [ ] PHASE 9 — CLI

- Command runner with argument/flag parsing.
- Interactive project scaffolding (`django-js new`).
- Code generators (`make:controller`, `make:model`, `make:migration`).

---

### [ ] PHASE 10 — Authentication + Authorization

- Session-based authentication with secure cookie storage.
- JWT and API token authentication.
- Role-based and permission-based authorization policies (Gates / Policies).

---

### [ ] PHASE 11 — Cache + Queue

- Cache abstraction (Memory, Redis) with tag-based invalidation.
- Background job queue abstraction with retries, delays, and worker processes.

---

### [ ] PHASE 12 — Events + WebSockets

- Synchronous and asynchronous event dispatcher.
- Real-time WebSocket connection manager and room/channel broadcasting.

---

### [ ] PHASE 13 — Admin

- Batteries-included auto-generated administrative dashboard.
- CRUD interfaces for ORM models with filtering, search, and pagination.

---

### [ ] PHASE 14 — OpenAPI + Observability

- Automatic OpenAPI / Swagger specification generation from routes and schemas.
- Structured telemetry, Prometheus metrics exporter, and OpenTelemetry tracing.

---

### [ ] PHASE 15 — Performance Optimization

- End-to-end benchmark evaluation under high concurrency.
- Zero-allocation optimizations for hot HTTP and router paths.
- Bun runtime adapter optimization.

---

### [ ] PHASE 16 — Release Candidate

- Community testing, security audit, and documentation polishing.
- API stability freeze and backward-compatibility test suites.

---

### [ ] PHASE 17 — 1.0 Production Release

- Official 1.0 general availability release.
- Production documentation portal and starter templates.
