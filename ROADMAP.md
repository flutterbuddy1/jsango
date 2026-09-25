# JSango Framework Roadmap

This roadmap outlines the phased development plan for the **JSango** framework. Each phase must be fully designed, implemented, tested, and documented before subsequent phases commence.

---

### [x] PHASE 0 — Architecture Foundation

- Monorepo setup with pnpm workspaces, Turborepo, Vitest, ESLint, and Prettier.
- Package scaffolding across 12 initial packages.
- Strict TypeScript configuration (`strict: true`, NodeNext ESM).
- Explicit public/internal package boundaries.
- Foundational abstractions: structured error model (`JsangoError`), logging interface (`ILogger`), runtime adapter (`IRuntimeAdapter`), and configuration interface (`IConfigProvider`).
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
- Migration registry (`MigrationRegistry`) and tracking storage (`MigrationStorage` managing `jsango_migrations`).
- Distributed concurrency locking (`MigrationLock` managing `jsango_migration_lock`) with optimistic locking and automatic stale lock recovery.
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

- **Cache Abstraction (`@jsango/cache`)**: Production-grade, driver-agnostic caching with `CacheManager` orchestrating multiple named stores, `CacheStore` providing high-level API with key normalization (`CacheKeyBuilder`), safe serialization (`SafeCacheSerializer` with Date/BigInt round-trip), Promise-based stampede protection (`remember()`/`getOrSet()`), hit/miss statistics, `namespace()` isolation, and fallback modes (`fail-fast`, `fallback-to-memory`, `bypass`).
- Universal `ICacheDriver` contract with `CacheCapabilities` — `MemoryCacheDriver` (LRU, TTL, prune sweeps) built-in; Redis adapter follows identical contract.
- **Queue & Background Jobs (`@jsango/queue`)**: AT-LEAST-ONCE delivery background job system with `QueueManager` orchestrating named queues, `Queue` handles for typed `dispatch()`/`delay()`/`schedule()`, `Worker` long-running polling with configurable concurrency/lease timeout/idle backoff/graceful shutdown, `RetryCalculator` (fixed/exponential/jitter), `JobRegistry` for type-safe handler resolution, queue-scoped `MiddlewarePipeline` (separate from HTTP middleware), and `IFailedJobStore` dead-letter storage.
- Universal `IQueueDriver` contract — `MemoryQueueDriver` (priority, delayed, visibility leases) and `DatabaseQueueDriver` (persistent via `@jsango/database`, `locked_until` distributed locking) built-in.
- CLI commands: `cache:clear`, `queue:work [--once]`, `queue:status`, `queue:failed`, `queue:retry`, `queue:clear`.
- Contract test suites for both driver types; 86 test files, 444 tests passing.
- Benchmarks: up to 62M ops/sec (RetryCalculator), 5.7M ops/sec (cache driver get), 1.6M ops/sec (queue enqueue).
- Architecture documentation (`docs/architecture/cache/`, `docs/architecture/queue/`) and ADR-022 through ADR-023.

---

### [x] PHASE 12 — Events + WebSockets

- **Event System (`@jsango/events`)**:
  - Typed `EventDefinition<Payload>` with unique UUIDv4 `eventId`, `timestamp`, `schemaVersion`, and optional `metadata`.
  - Tri-mode execution semantics: `sync` (deterministic sequential priority order), `async` (concurrent non-blocking via `Promise.allSettled`), and `queued` (delegated via `IEventQueueAdapter` to `@jsango/queue`).
  - `EventRegistry` with duplicate detection, priority sorting, and introspection (`inspect()`) for diagnostics and Admin UI.
  - Dedicated `EventMiddlewarePipeline` (onion pattern) separate from HTTP and Queue middleware.
  - Safe payload serialization rejecting functions, symbols, and circular references (`EventSerializer`).
  - Observability lifecycle hooks (`onDispatched`, `onHandlerStarted`, `onHandlerCompleted`, `onHandlerFailed`).
  - `FakeEventBus` testing utility.
- **WebSocket & Real-Time Infrastructure (`@jsango/websocket`)**:
  - Engine-independent `IWebSocketServer` and `IWebSocketConnection` abstractions isolating low-level libraries (`ws`).
  - High-performance `RoomManager` with multi-room membership, join authorization, and automated cleanup on disconnect.
  - Typed JSON message framing (`{ type, payload, requestId, metadata }`) and `WebSocketContext` matching `RequestContext` ergonomics.
  - Defensive connection limits (`maxTotalConnections`, `maxConnectionsPerIdentity`, `maxRoomsPerConnection`, `maxMessageSizeBytes`).
  - Backpressure enforcement (`maxBufferedAmountBytes`) and ping/pong health monitoring (`HeartbeatManager`).
  - Pluggable transport layer (`IRealtimeTransport`, `LocalTransport`) for single-node and multi-node pub/sub scaling.
  - HTTP upgrade integration with authentication hooks and `@jsango/auth` Identity reuse.
  - Bi-directional event bridges (`WebSocketEventBridge`, `WebSocketToEventBridge`).
  - `FakeWebSocketConnection` and `FakeWebSocketServer` testing utilities.
- **CLI Commands**: `events:list` and `ws:status`.
- **Benchmarks**: EventRegistry (23.9M ops/sec), RoomManager (26.1M ops/sec), EventBus sync dispatch (1.35M ops/sec), LocalTransport publish (7.1M ops/sec).
- **Architecture & ADRs**: `docs/architecture/events/`, `docs/architecture/websocket/`, and ADR-024 through ADR-026.

---

### [x] PHASE 13 — Admin Platform Foundation

- **Admin Core (`@jsango/admin-core`)**:
  - Model-driven `AdminResource` abstraction with convention-over-configuration defaults for `listFields`, `detailFields`, `createFields`, `editFields`, `searchFields`, `filters`, `actions`, `bulkActions`, and pagination.
  - Automatic `ModelMetadata` $\to$ `AdminResource` auto-generator (`AdminResourceAutoGenerator`).
  - Extensible field system (`textField`, `numberField`, `booleanField`, `dateField`, `emailField`, `passwordField`, `jsonField`, `uuidField`, etc.) with widget metadata.
  - Table, form, filter, dashboard, and custom page abstractions with plugin lifecycle hooks.
  - Central `AdminRegistry` for resources and dashboard pages.
- **Admin Authorization (`@jsango/admin-auth`)**:
  - `AdminPermissionChecker` enforcing staff access, resource-level CRUD permissions, row-level action execution, and field-level visibility/editability with sensitive field protection.
- **Admin Audit Trail (`@jsango/admin-audit`)**:
  - Non-blocking `AdminAuditLogger` producing immutable audit entries for all create, update, delete, restore, and custom action operations.
  - `diffChanges` utility computing field diffs with automatic regex-based sensitive field redaction (`/password|secret|token|key|hash|salt|credential/i`).
  - Pluggable `IAuditStore` with deterministic `InMemoryAuditStore`.
- **Admin Media Management (`@jsango/admin-media`)**:
  - `AdminMediaManager` with strict validation (`maxSizeBytes`, `allowedMimeTypes`, `allowedExtensions`) before storage I/O.
  - Pluggable `IMediaStorage` abstraction with `InMemoryMediaStorage`.
- **Admin Server & REST API (`@jsango/admin-server`)**:
  - Decoupled `IAdminQueryAdapter` bridging ORM and admin server without circular dependencies.
  - Production-grade `AdminCrudService` orchestrating validation, RBAC, mass-assignment sanitization, field-level filtering, and audit logging.
  - Complete REST API mounted on `IRouter`: resources, schema, CRUD endpoints, soft-delete restore, row actions, bulk actions, and audit log query.
- **Testing & Quality Gates**: 108 test files (540 total tests passing), ESLint passing, Prettier clean, strict TypeScript build passing.
- **Documentation**: `docs/architecture/admin/` architecture guide.

---

### [x] PHASE 14 — OpenAPI + Observability

- **OpenAPI 3.1 Document Generation (`@jsango/openapi`)**:
  - Deterministic, zero-reflection OpenAPI 3.1.0 document generation from router metadata, validation schemas, ORM metadata, and Admin resources.
  - Central `OpenApiRegistry` with structured conflict detection (`DuplicateOperationIdError`, `ConflictingSchemaError`).
  - Seamless adapters: `ValidationAdapter` (schema descriptors $\to$ JSON Schema), `OrmAdapter` (`ModelMetadata` $\to$ components), and `AdminAdapter` (isolated Admin APIs).
  - Built-in spec integrity validation (`OpenApiValidator`) for paths, parameters, responses, and schema `$ref` integrity.
  - Native zero-dependency YAML and JSON formatting (`OpenApiFormatter`).
  - Secure `/openapi.json` route handler (`createOpenApiHandler`).
  - CLI: `openapi:generate` and `openapi:validate`.
- **Observability Foundation (`@jsango/observability`)**:
  - Production `StructuredLogger` with scoped context chaining (`withContext`), control-character sanitization against log injection, and log level filtering.
  - Bounded `MetricRegistry` with monotonic `Counter`, stateful `Gauge`, and distribution `Histogram` with high-cardinality protection (capped label permutations).
  - `Tracer` & `Span` using `performance.now()` monotonic clock with sampling strategies and zero-allocation `NoopSpan`.
  - `CorrelationManager` providing request ID generation/sanitization and W3C `traceparent` parsing & propagation across async boundaries.
  - `HealthRegistry` separating `liveness` and `readiness` checks with HTTP handlers for `/health`, `/health/live`, `/health/ready`.
  - `DiagnosticsProvider` for runtime and subsystem inspection (`/diagnostics`).
  - `Redactor` for recursive PII and credential masking across objects and HTTP headers.
  - Framework HTTP middleware and hooks for metrics, logging, and correlation propagation.
  - CLI: `health`, `metrics`, and `diagnostics`.
- **Quality Gates & Benchmarks**:
  - 100% typecheck passing, all tests passing (119+ test files, 590+ tests), zero lint warnings, formatted code.
  - Dedicated benchmark suites (`benchmarks/openapi/openapi.bench.ts`, `benchmarks/observability/observability.bench.ts`).
  - Architecture guides and ADR-027 through ADR-033.

---

### [x] PHASE 15 — Performance Optimization + Production Hardening

- **Performance & Profiling Methodology**:
  - Implemented systematic, evidence-driven optimization cycle: `MEASURE → PROFILE → IDENTIFY BOTTLENECK → FORM HYPOTHESIS → OPTIMIZE → BENCHMARK → COMPARE → VERIFY → DOCUMENT`.
  - Created standardized benchmark harness (`benchmarks/`) across all 15 framework layers.
  - Added dedicated Memory Leak (`tests/performance/leak.test.ts`) and Concurrency Load (`tests/performance/concurrency.test.ts`) test suites.
- **Key Optimizations & Measured Speedups**:
  - **Router Radix Tree (`@jsango/router`)**: Added $O(1)$ static route fast-path map and frozen `EMPTY_PARAMS` singleton, improving static route matching from 3.21M to **7.71M ops/sec** (2.4x speedup).
  - **DI Container (`@jsango/container`)**: Implemented direct resolution cache fast-path in `Container.resolve()`, boosting scoped resolution from 17.67M to **24.17M ops/sec** (37% improvement).
  - **Admin Schema Generation (`@jsango/admin-core`)**: Implemented immutable schema caching on `AdminResource`, boosting schema generation from 6.61M to **24.61M ops/sec** (3.7x speedup).
  - **Tracing Zero-Allocation (`@jsango/observability`)**: Introduced `NoopSpan.INSTANCE` singleton for disabled/unsampled tracing, reducing heap allocation overhead on hot paths.
  - **Metrics Serialization (`@jsango/observability`)**: Added 0-key and 1-key fast-paths in `serializeLabels()` avoiding array sort allocations on common metric operations (up to 15.2M ops/sec).
  - **Database Concurrency Hardening (`@jsango/database`)**: Fixed trailing semicolon handling in SQL regex parser for memory driver concurrency.
- **Memory & Concurrency Hardening**:
  - Verified zero memory leaks across 5,000 request contexts, 5,000 DI scopes, 1,000 WebSocket room joins/leaves, and cache TTL eviction sweeps.
  - Tested 1,000 concurrent HTTP requests, 1,000 concurrent event dispatches, and connection pool queuing with 100% determinism.
- **Security & Compatibility**:
  - Maintained 100% security invariants (no auth, validation, or redaction shortcuts taken).
  - All 120 test suites (602+ tests) pass cleanly; full TypeScript typecheck, ESLint, and Prettier verification.
- **Architecture Documentation & ADRs**:
  - Created `docs/performance/README.md` and `docs/performance/PHASE-15-REPORT.md`.
  - Created ADR-034 through ADR-038 documenting all architectural optimizations.

---

### [x] PHASE 16 — Release Candidate + Production Readiness

- **Authoritative Package Inventory & Versioning**:
  - Synchronized all 25 packages across the monorepo to `0.1.0-rc.1`.
  - Added package-level `README.md` manifests across all 25 packages.
  - Verified package pack dry-run (`npm pack --dry-run`) across all packages with 0 leaked internal or temporary files.
- **End-to-End Consumer Smoke Test**:
  - Implemented comprehensive `tests/e2e/rc-smoke.test.ts` verifying full framework stack lifecycle (Config, DI, Database, ORM, Auth, Cache, Queue, Events, WebSockets, Admin, OpenAPI, Observability, Health, and HTTP).
- **Governance & Production Documentation**:
  - Created root `LICENSE` (MIT) and `.env.example` production configuration template.
  - Created `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CHANGELOG.md`, `docs/LIMITATIONS.md`, `docs/migration/MIGRATION-GUIDE.md`, `docs/deployment/README.md`, `docs/release/RELEASE-CHECKLIST.md`, and `docs/security/RC-SECURITY-REVIEW.md`.
  - Updated root `README.md` with complete architecture guide, quick start, and package matrix.
- **Security & Quality Gates**:
  - Executed full security audit across all 15 framework layers with 0 critical or high findings.
  - 100% typecheck passing, zero lint warnings, formatted code, and all 123 test files (603 tests) passing.

---

### [x] PHASE 17 — Final 1.0 Release + Public API Freeze

- **1.0.0 Stable GA Finalization**:
  - Synchronized all 25 packages, root workspace, examples, and CLI version constants to `1.0.0`.
  - Formally froze all public API signatures and symbols under SemVer guarantees (`docs/API-FREEZE.md`).
- **Stability Policy & Governance**:
  - Published Public API Stability Policy (`docs/API-STABILITY.md`) defining four stability tiers (Stable Public, Experimental, Internal, Deprecated).
  - Published Support Matrix (`docs/SUPPORT.md`), 1.0 Migration Guide (`docs/MIGRATION-1.0.md`), and Post-1.0 Roadmap (`docs/POST-1.0-ROADMAP.md`).
  - Created 1.0 Release Notes (`docs/releases/1.0.0.md`), Readiness Checklist (`docs/releases/1.0.0-CHECKLIST.md`), and Final Release Report (`docs/releases/1.0.0-RELEASE-REPORT.md`).
- **Quality Gates & Benchmarks**:
  - 100% strict TypeScript compilation passing (`tsc -b`).
  - ESLint 9 clean with zero errors/warnings.
  - All 123 test files (603 tests) passing across unit, integration, and E2E suites.
  - Package packing verified across all 25 packages (`npm pack --dry-run`).
  - Router matching (>7.7M ops/sec) and DI container (>24.1M ops/sec) performance verified with zero memory leaks.

---

### [x] PHASE 18 — Enterprise Admin UI Foundation

- **`@jsango/admin-ui` Package**:
  - Metadata-driven frontend architecture consuming `@jsango/admin-core` & `@jsango/admin-server`.
  - Zero hardcoded resource components; dynamically discovers schemas from `/admin/api/v1/resources/:id/schema`.
- **Client & State Engine**:
  - `AdminApiClient`: Typed HTTP client with Bearer auth, custom actions, bulk mutations, and error extraction.
  - `QueryClient`: Lightweight in-memory query cache with TTL, stale-while-revalidate, deduplication, and automatic prefix-based invalidation.
- **Enterprise Design System**:
  - Semantic CSS variable design tokens supporting high-contrast Light, Dark, and System modes.
  - Reusable UI primitives: Buttons, Status Badges, Form Inputs, Skeletons, Alerts, Diff Viewer, and JSON Viewer.
- **Navigation & Shortcuts**:
  - `Cmd+K` / `Ctrl+K` Command Palette for quick search across resources, system ops, and themes.
  - Collapsible desktop sidebar with navigation groups and responsive mobile drawer navigation.
- **Resource Management & Views**:
  - `ResourceListView`: Data table with multi-column sorting, active filter chips, search input, row selection, and floating bulk action bar.
  - `ResourceDetailView`: Metadata-driven field cards, timestamps, relations, soft-delete restoration, and delete confirmation.
  - `ResourceForm`: Create and edit forms supporting client/server validation error mapping.
  - `DashboardView`: Realtime metric cards, activity feeds, and table widgets.
  - `AuditLogView`: Mutation timeline with before/after property diff viewers.
  - `SystemHealthView`: Subsystem status meters, process memory, and uptime diagnostics.
  - `LoginView`: Clean, enterprise-grade authentication interface.
- **Extensibility & Documentation**:
  - `AdminUiPluginRegistry`: Custom widget, page, and field renderer extensions.
  - Complete architecture guide & manual in `docs/admin/ADMIN-UI.md`.
  - 100% test coverage with unit, component, view, and orchestration test suites.
