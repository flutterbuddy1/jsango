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

### [x] PHASE 6 — ORM / Object-Relational Mapping Layer

- Rich, immutable, introspectable Model Metadata system (`ModelMetadata`, `FieldMetadata`, `RelationMetadata`, `IndexMetadata`) serving future Admin, Migrations, Validation, and OpenAPI.
- Declarative field factories (`fields.string`, `fields.integer`, `fields.boolean`, `fields.dateTime`, `fields.json`, `fields.uuid`, etc.).
- Declarative relationship definitions (`relations.belongsTo`, `relations.hasOne`, `relations.hasMany`, `relations.manyToMany`) with target/through resolvers and `WeakMap` resolution caches.
- Pure batch eager loading via `.with()` guaranteeing zero N+1 queries ($1 + R$ total queries); strict ban on implicit lazy loading via property access.
- Immutable AST-based `QueryBuilder` with parameterized SQL compiler (`SqlCompiler`), strict identifier regex validation, and ANSI double-quoting.
- `Model` base class with dirty tracking (`isDirty()`, `getDirty()`, `getOriginal()`), `save()`, `delete()`, `refresh()`, and `defineModel()` factory.
- Database connection lifecycle management with automated release via `finally` blocks, and multi-connection transaction propagation (`.using(tx)`).
- Model registry (`ModelRegistry`) for introspection and registration.
- Comprehensive unit (32), integration, example app (5), and benchmark (12 scenarios) test coverage.
- Architecture documentation (`docs/architecture/orm/`, 13 documents) and ADR-009.

---

### [x] PHASE 7 — Migrations + Database Schema Management

- Normalized, immutable, dialect-neutral schema representation (`SchemaSnapshot`, `TableSchema`, `ColumnSchema`, `IndexSchema`, `ForeignKeySchema`, `UniqueConstraintSchema`) with structural SHA-256 checksums.
- Automatic ORM Model Metadata $\to$ Schema Snapshot converter (`ModelSchemaConverter`) supporting timestamps, soft deletes, and foreign keys.
- Pluggable live database introspection (`SchemaIntrospector` with PostgreSQL, SQLite, and in-memory reflection).
- Deterministic schema diffing engine (`SchemaDiffEngine`) with topological sorting (tables $\to$ columns $\to$ alterations $\to$ unique constraints $\to$ indexes $\to$ foreign keys $\to$ drops).
- 14 concrete, typed, serializable, and reversible operation AST nodes (`CreateTable`, `DropTable`, `AddColumn`, `DropColumn`, `AlterColumn`, `CreateIndex`, `DropIndex`, `AddForeignKey`, `DropForeignKey`, `CreateUniqueConstraint`, `DropUniqueConstraint`, `RenameTable`, `RenameColumn`, `RawSql`).
- Strict safety guard policy requiring explicit approval (`allowDestructive: true`) for destructive changes and confirmation (`confirm: 'YES_I_AM_SURE'`) for database resets.
- Dialect DDL SQL compiler (`SqlMigrationCompiler`) with ANSI quoting and strict alphanumeric identifier injection defense.
- Migration file generator (`MigrationGenerator`) generating human-readable, typed TypeScript migration files (`YYYYMMDDHHmmss_name.ts`) with content checksums.
- Migration registry (`MigrationRegistry`) and tracking storage (`MigrationStorage` managing `django_js_migrations`).
- Distributed concurrency locking (`MigrationLock` managing `django_js_migration_lock`) with optimistic locking and automatic stale lock recovery.
- Transaction-aware migration runner (`MigrationRunner`) honoring `supportsTransactionalDDL` capability, batch tracking, step-based/batch rollback, and reset support.
- Programmatic drift detector (`DriftDetector`) identifying out-of-band schema discrepancies.
- Comprehensive unit (37), integration, example app (6), and microbenchmark (7 scenarios) suites.
- Architecture documentation (`docs/architecture/migrations/`, 12 documents) and ADR-010.

---

### [x] PHASE 8 — Validation + Serialization

- High-throughput schema validation engine.
- Request payload, query, and parameter validation.
- Standardized validation error formatting.

---

### [x] PHASE 9 — CLI + Developer Tooling

- Command runner with zero-dependency argument and option parsing (`ArgParser`).
- Deterministic `CommandRegistry` with colon-delimited namespacing and top-level aliases.
- CLI output abstraction (`CliOutput`) with stream separation, TTY auto-detection, tables, and pure `--json` output.
- POSIX-compliant exit codes and structured `CliError` hierarchy.
- Upward project discovery and safe project scaffolding (`create <name>`).
- Comprehensive built-in commands: `version`, `help`, `doctor`, `route:list`, `model:list`, `model:show`, `config:show`, `db:status`, `migrate:run`, `migrate:status`, `migrate:rollback`, `migrate:generate`, `migrate:check`.
- Secret masking, path traversal defenses, destructive confirmation requirements, and `AbortSignal` cancellation.
- Extensibility via `ICommandProvider` for future plugins.
- Comprehensive test suite (42 tests), process execution tests, and performance benchmarks (up to 16.9M ops/sec).
- Architecture documentation (`docs/architecture/cli/`, 11 documents) and ADR-011 through ADR-015.

---

### [x] PHASE 10 — Authentication + Authorization

- Decoupled Authentication ("Who is this?") and Authorization ("What can this identity do?").
- Multiple authentication strategies: Session, Bearer (JWT), API Key with deterministic chaining and fail-fast downgrade protection.
- Immutable principal abstraction (`Identity`, `UserIdentity`, `ServiceAccountIdentity`, `SystemIdentity`, `AnonymousIdentity`).
- Pluggable session store (`ISessionStore`, `MemorySessionStore`) and session fixation defense via identifier rotation (`rotate()`).
- RFC 7519 JWT service with strict algorithm whitelist (rejects `alg: "none"`) and revocation store (`ITokenRevocationStore`).
- Memory-hard password hashing via Scrypt (RFC 7914) with random salt, constant-time verification, and `needsRehash` upgrade strategy.
- Complete authorization engine with namespaced permissions (`PermissionRegistry`), roles (`RoleRegistry`), and object-level policies (`PolicyRegistry`, `BasePolicy`).
- Boolean policy combinators (`andPolicy`, `orPolicy`, `notPolicy`) and bulk authorization (`authorizeMany`).
- Fail-closed security default: all unhandled access or missing identity/policy evaluates strictly to DENY.
- Clean HTTP status separation: 401 Unauthorized (`UnauthenticatedError`) vs 403 Forbidden (`ForbiddenError`).
- Request-scoped identity isolation in `RequestContext.state` and DI container with zero mutable global state.
- Comprehensive tests (68 files, 362 total tests passed), security invariants, and benchmarks (up to 12.6M ops/sec).
- Architecture documentation (`docs/architecture/auth/`, 14 documents) and ADR-016 through ADR-021.

---

### [x] PHASE 11 — Cache + Queue

- **Cache Abstraction (`@django-js/cache`)**: Production-grade, driver-agnostic caching with `CacheManager` orchestrating multiple named stores, `CacheStore` providing high-level API with key normalization (`CacheKeyBuilder`), safe serialization (`SafeCacheSerializer` with Date/BigInt round-trip), Promise-based stampede protection (`remember()`/`getOrSet()`), hit/miss statistics, `namespace()` isolation, and fallback modes (`fail-fast`, `fallback-to-memory`, `bypass`).
- Universal `ICacheDriver` contract with `CacheCapabilities` — `MemoryCacheDriver` (LRU, TTL, prune sweeps) built-in; Redis adapter follows identical contract.
- **Queue & Background Jobs (`@django-js/queue`)**: AT-LEAST-ONCE delivery background job system with `QueueManager` orchestrating named queues, `Queue` handles for typed `dispatch()`/`delay()`/`schedule()`, `Worker` long-running polling with configurable concurrency/lease timeout/idle backoff/graceful shutdown, `RetryCalculator` (fixed/exponential/jitter), `JobRegistry` for type-safe handler resolution, queue-scoped `MiddlewarePipeline` (separate from HTTP middleware), and `IFailedJobStore` dead-letter storage.
- Universal `IQueueDriver` contract — `MemoryQueueDriver` (priority, delayed, visibility leases) and `DatabaseQueueDriver` (persistent via `@django-js/database`, `locked_until` distributed locking) built-in.
- CLI commands: `cache:clear`, `queue:work [--once]`, `queue:status`, `queue:failed`, `queue:retry`, `queue:clear`.
- Contract test suites for both driver types; 86 test files, 444 tests passing.
- Benchmarks: up to 62M ops/sec (RetryCalculator), 5.7M ops/sec (cache driver get), 1.6M ops/sec (queue enqueue).
- Architecture documentation (`docs/architecture/cache/`, `docs/architecture/queue/`) and ADR-022 through ADR-023.

---

### [x] PHASE 12 — Events + WebSockets

- **Event System (`@django-js/events`)**:
  - Typed `EventDefinition<Payload>` with unique UUIDv4 `eventId`, `timestamp`, `schemaVersion`, and optional `metadata`.
  - Tri-mode execution semantics: `sync` (deterministic sequential priority order), `async` (concurrent non-blocking via `Promise.allSettled`), and `queued` (delegated via `IEventQueueAdapter` to `@django-js/queue`).
  - `EventRegistry` with duplicate detection, priority sorting, and introspection (`inspect()`) for diagnostics and Admin UI.
  - Dedicated `EventMiddlewarePipeline` (onion pattern) separate from HTTP and Queue middleware.
  - Safe payload serialization rejecting functions, symbols, and circular references (`EventSerializer`).
  - Observability lifecycle hooks (`onDispatched`, `onHandlerStarted`, `onHandlerCompleted`, `onHandlerFailed`).
  - `FakeEventBus` testing utility.
- **WebSocket & Real-Time Infrastructure (`@django-js/websocket`)**:
  - Engine-independent `IWebSocketServer` and `IWebSocketConnection` abstractions isolating low-level libraries (`ws`).
  - High-performance `RoomManager` with multi-room membership, join authorization, and automated cleanup on disconnect.
  - Typed JSON message framing (`{ type, payload, requestId, metadata }`) and `WebSocketContext` matching `RequestContext` ergonomics.
  - Defensive connection limits (`maxTotalConnections`, `maxConnectionsPerIdentity`, `maxRoomsPerConnection`, `maxMessageSizeBytes`).
  - Backpressure enforcement (`maxBufferedAmountBytes`) and ping/pong health monitoring (`HeartbeatManager`).
  - Pluggable transport layer (`IRealtimeTransport`, `LocalTransport`) for single-node and multi-node pub/sub scaling.
  - HTTP upgrade integration with authentication hooks and `@django-js/auth` Identity reuse.
  - Bi-directional event bridges (`WebSocketEventBridge`, `WebSocketToEventBridge`).
  - `FakeWebSocketConnection` and `FakeWebSocketServer` testing utilities.
- **CLI Commands**: `events:list` and `ws:status`.
- **Benchmarks**: EventRegistry (23.9M ops/sec), RoomManager (26.1M ops/sec), EventBus sync dispatch (1.35M ops/sec), LocalTransport publish (7.1M ops/sec).
- **Architecture & ADRs**: `docs/architecture/events/`, `docs/architecture/websocket/`, and ADR-024 through ADR-026.

---

### [x] PHASE 13 — Admin Platform Foundation

- **Admin Core (`@django-js/admin-core`)**:
  - Model-driven `AdminResource` abstraction with convention-over-configuration defaults for `listFields`, `detailFields`, `createFields`, `editFields`, `searchFields`, `filters`, `actions`, `bulkActions`, and pagination.
  - Automatic `ModelMetadata` $\to$ `AdminResource` auto-generator (`AdminResourceAutoGenerator`).
  - Extensible field system (`textField`, `numberField`, `booleanField`, `dateField`, `emailField`, `passwordField`, `jsonField`, `uuidField`, etc.) with widget metadata.
  - Table, form, filter, dashboard, and custom page abstractions with plugin lifecycle hooks.
  - Central `AdminRegistry` for resources and dashboard pages.
- **Admin Authorization (`@django-js/admin-auth`)**:
  - `AdminPermissionChecker` enforcing staff access, resource-level CRUD permissions, row-level action execution, and field-level visibility/editability with sensitive field protection.
- **Admin Audit Trail (`@django-js/admin-audit`)**:
  - Non-blocking `AdminAuditLogger` producing immutable audit entries for all create, update, delete, restore, and custom action operations.
  - `diffChanges` utility computing field diffs with automatic regex-based sensitive field redaction (`/password|secret|token|key|hash|salt|credential/i`).
  - Pluggable `IAuditStore` with deterministic `InMemoryAuditStore`.
- **Admin Media Management (`@django-js/admin-media`)**:
  - `AdminMediaManager` with strict validation (`maxSizeBytes`, `allowedMimeTypes`, `allowedExtensions`) before storage I/O.
  - Pluggable `IMediaStorage` abstraction with `InMemoryMediaStorage`.
- **Admin Server & REST API (`@django-js/admin-server`)**:
  - Decoupled `IAdminQueryAdapter` bridging ORM and admin server without circular dependencies.
  - Production-grade `AdminCrudService` orchestrating validation, RBAC, mass-assignment sanitization, field-level filtering, and audit logging.
  - Complete REST API mounted on `IRouter`: resources, schema, CRUD endpoints, soft-delete restore, row actions, bulk actions, and audit log query.
- **Testing & Quality Gates**: 108 test files (540 total tests passing), ESLint passing, Prettier clean, strict TypeScript build passing.
- **Documentation**: `docs/architecture/admin/` architecture guide.

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
