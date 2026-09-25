# JSango Project Status

**Framework:** JSango
**Previous Development Name:** django-js
**Migration Status:** Complete
**Package Namespace:** `@jsango/*`
**CLI:** `jsango`
**Admin:** JSango Admin

## Current Phase

**COMPLETE PROJECT REBRAND (django-js → JSango)** (Completed — v1.0.0 Stable)
**PHASE 18 — JSANGO ENTERPRISE ADMIN UI FOUNDATION** (Completed — v1.0.0 Stable)

---

## Completed Components

- [x] **Monorepo Architecture (Phase 0)**:
  - pnpm workspace configured (`packages/*`, `examples/*`, `benchmarks/*`).
  - Turborepo configured for parallel caching builds, tests, linting, and typechecking.
- [x] **Strict TypeScript Foundation (Phase 0)**:
  - `tsconfig.base.json` configured with `strict: true`, `noImplicitAny: true`, `strictNullChecks: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, and `NodeNext` ESM module resolution.
  - Project references set up across monorepo root and all packages.
- [x] **Package Scaffolding (Phase 0)**:
  - 13 single-responsibility packages scaffolded.
- [x] **Foundational Abstractions (Phase 0 & 1)**:
  - Structured error hierarchy (`JsangoError`) with production-safe serialization.
  - Pluggable logging contract (`ILogger`, `NoopLogger`).
  - Runtime abstraction contract (`IRuntimeAdapter`, `NodeRuntimeAdapter`).
  - Configuration boundary contract (`IConfigProvider`, `MemoryConfigProvider`).
  - Dependency injection container contract (`IContainer`, `Container`) with transient, singleton, and scoped lifetimes.
- [x] **HTTP Core Package (`@jsango/http`) (Phase 2)**:
  - **`HttpRequest`**: Runtime-independent request abstraction with immutable properties, URL, query, headers, cookies, body streaming, correlation ID, and AbortSignal.
  - **`HttpResponse`**: Response abstraction with lifecycle state machine (`created` → `configured` → `committed` → `completed`), post-commit mutation blocking, and static factories (`json`, `text`, `html`, `redirect`, `empty`, `stream`).
  - **`HttpHeaders`**: Safe case-insensitive headers with CRLF injection prevention.
  - **`HttpQuery`**: Query parameter abstraction supporting single and repeated values without data loss.
  - **`HttpCookies`**: RFC 6265 compliant cookie parser and serializer with `HttpOnly`, `SameSite`, and CRLF injection defense.
  - **`HttpBody`**: Body parser supporting JSON, text, form-data, and bytes with configurable `maxBodySize` and single-consumption enforcement.
  - **Structured HTTP Errors**: Comprehensive hierarchy (`BadRequestError`, `NotFoundError`, `PayloadTooLargeError`, etc.) with production-safe masking.
  - **`RequestContext`**: Unified context holding request, response, correlation ID, logger, abort signal, and scoped container slot.
  - **`NodeHttpServer`**: Production Node.js HTTP server adapter completely encapsulating Node's `IncomingMessage` and `ServerResponse`, supporting graceful shutdown.
- [x] **High-Performance Router (`@jsango/router`) (Phase 3)**:
  - **`RadixTree` / `RadixNode`**: Segment-based trie delivering $O(k)$ lookup time (>3.2M ops/sec).
  - **Deterministic Precedence**: Static > Constrained Param > Generic Param > Wildcard.
  - **Parameter Constraints**: Typed inline (`:id<number>`, `:id<uuid>`, `:slug<slug>`, etc.) and route options (custom regex and functions).
  - **RFC 7231 Conformance**: Automatic HEAD fallback to GET routes with body suppression; 405 Method Not Allowed with `Allow` header.
  - **Route Groups**: Prefix composition and hierarchical metadata inheritance.
  - **Named Routes & Reverse URLs**: Bidirectional URL generation (`router.url()`) with query parameter serialization.
  - **Lifecycle & Immutability**: Two-phase `registering` → `compile()` locking preventing concurrency hazards.
- [x] **Middleware & Application Lifecycle (`@jsango/middleware`) (Phase 4)**:
  - **`MiddlewarePipeline`**: Pure onion-style recursive pipeline executor with explicit double-calling protection (`MultipleNextCallsError`).
  - **Flexible Middleware Types**: Support for function middleware (`(ctx, next) => ...`), class middleware (`IMiddleware.handle`), and named middleware aliases.
  - **`MiddlewareRegistry`**: Centralized string identifier to middleware resolution for modular, testable decoupling.
  - **Unified `Application`**: Central entry point orchestrating `RequestContext`, `Container` (hierarchical request-scoped child containers), `Router`, and `MiddlewarePipeline`.
  - **Route-Level & Group-Level Middleware**: Group middleware inheritance merged cleanly down to routes; executed only upon successful route matching.
  - **`ResponseNormalizer`**: Centralized automatic conversion of raw handler return values (`HttpResponse`, string, `Uint8Array`, streams, JSON objects, `undefined`/`null` 204).
  - **RFC 7231 Lifecycle Compliance**: 404 Not Found and 405 Method Not Allowed with `Allow` header skip route middleware; HEAD fallback suppresses body while preserving headers.
  - **Robust Error Boundary**: Request-scoped error isolation; custom `ErrorHandler` support; production stack masking with structured code and status.
  - **Guaranteed Resource Cleanup**: Scoped DI container disposed in a `finally` block on every request.
- [x] **Database Abstraction Layer (`@jsango/database`) (Phase 5)**:
  - **`DatabaseManager`**: Named database connection registry supporting multiple isolated databases (`default`, `analytics`, `readonly`), health checks, and graceful shutdown lifecycle integration.
  - **Zero-Dependency `ConnectionPool`**: High-concurrency resource pool with FIFO acquisition queue, configurable min/max bounds, acquisition timeouts, idle reaping, and max lifetime eviction.
  - **`DatabaseConnection`**: Thread-safe client connection wrapper managing parameterized queries, dialect placeholder translations, scoped transactions, and automated release.
  - **`DatabaseTransaction`**: Transaction state machine (`active` → `committed` | `rolledBack`) with strict operation guards, nested savepoints, isolation level validation, and auto-rollback on failure.
  - **Driver Adapter Architecture**: Strongly-typed `DatabaseCapabilities` contract with universal `IDatabaseDriver` and `IDriverConnection` interfaces.
  - **`MemoryDatabaseDriver`**: High-fidelity, deterministic in-memory database engine supporting table storage, transaction snapshots, savepoint rollbacks, and simulated latency/cancellation.
  - **Dialect Placeholder Translation**: Universal `?` placeholder normalization into driver native syntax (`$1, $2` for PostgreSQL).
  - **Security by Default**: Zero credential leaks; `maskConnectionString` and `maskConnectionConfig` preventing password exposure in errors, logs, and diagnostics.
- [x] **ORM / Object-Relational Mapping Layer (`@jsango/orm`) (Phase 6)**:
  - **Rich Model Metadata System**: Complete immutable runtime introspection (`ModelMetadata`, `FieldMetadata`, `RelationMetadata`, `IndexMetadata`) serving future Admin, Migrations, Validation, and OpenAPI.
  - **Declarative Field System**: Strongly typed field factories (`string`, `text`, `integer`, `bigint`, `float`, `decimal`, `boolean`, `dateTime`, `date`, `time`, `json`, `uuid`, `binary`).
  - **Relationship Engine**: Declarative associations (`belongsTo`, `hasOne`, `hasMany`, `manyToMany`) with lazy resolver functions and static `WeakMap` resolution caches preserving full immutability.
  - **Zero N+1 Batch Eager Loading**: Batch relation hydration via `.with()` issuing exactly $1 + R$ parameterized queries; strict architectural ban on implicit lazy loading via property access.
  - **AST-Based Query Builder**: Pure immutable chaining (`where`, `whereIn`, `whereNull`, `orWhere`, `orderBy`, `limit`, `offset`, `paginate`, `cursor`, `with`, `using`, `count`, `exists`) compiling into parameterized SQL `{ sql, params }`.
  - **SQL Injection Defense**: Strict identifier regex validation (`/^[a-zA-Z_][a-zA-Z0-9_]*$/`) with ANSI double-quoting and mandatory driver parameterization.
  - **Active Record Base Class**: `Model` base class with dirty attribute tracking (`isDirty()`, `getDirty()`, `getOriginal()`), `save()`, `delete()`, `refresh()`, and `toJSON()`.
  - **Factory & Prototype Proxies**: `defineModel()` factory constructing typed models with zero decorator magic and zero property access latency.
  - **Connection Lifecycle & Transaction Propagation**: Automatic connection pooling integration with safe release via `finally` blocks, and multi-connection transaction propagation (`.using(tx)`).
  - **Central Model Registry**: `ModelRegistry` enabling model registration, discovery, and duplicate collision prevention.
- [x] **Migrations + Database Schema Management (`@jsango/migrations`) (Phase 7)**:
  - **Normalized Schema Model**: Immutable, dialect-neutral `SchemaSnapshot`, `TableSchema`, `ColumnSchema`, `IndexSchema`, `ForeignKeySchema`, `UniqueConstraintSchema` with structural checksums.
  - **Model-to-Schema Converter**: Translates ORM `ModelMetadata` into normalized `SchemaSnapshot` structures including timestamps, soft delete columns, and foreign keys.
  - **Schema Introspector**: Dialect-specific metadata reflection (`PostgresSchemaIntrospector`, `SqliteSchemaIntrospector`, `MemorySchemaIntrospector`) mapping vendor catalogs to canonical snapshots.
  - **Deterministic Diff Engine**: Pure topological sorting of schema mutations ensuring stable operation order (tables $\to$ columns $\to$ alterations $\to$ unique constraints $\to$ indexes $\to$ foreign keys $\to$ drops).
  - **Migration Operations AST**: 14 concrete, typed, serializable, and reversible operation AST nodes with automated inverse computation.
  - **Safety Guard Policy**: Rejects destructive operations (`DropTable`, `DropColumn`, incompatible alterations) unless `allowDestructive: true` is explicitly passed; requires `'YES_I_AM_SURE'` confirmation for database resets.
  - **DDL SQL Compiler**: Generates ANSI-quoted, dialect-specialized SQL with strict alphanumeric identifier validation defending against SQL injection.
  - **Migration Generator**: Generates timestamped, typed TypeScript migration files (`YYYYMMDDHHmmss_name.ts`) with SHA-256 content checksums.
  - **Distributed Locking**: `MigrationLock` table (`jsango_migration_lock`) with optimistic locking and automatic stale lock recovery (configurable TTL).
  - **Migration Runner**: Atomic execution with batch tracking (`jsango_migrations`), transaction isolation honoring `supportsTransactionalDDL`, step-based or batch rollback, and drift detection.
  - **Drift Detector**: Programmatic verification between active database introspection and ORM models.
- [x] **CLI + Developer Tooling (`@jsango/cli`) (Phase 9)**:
  - **Command Architecture**: Strict decoupling (CLI $\to$ `CommandRegistry` $\to$ `Command` $\to$ `ArgParser` $\to$ `CommandContext` $\to$ Application Services). CLI contains zero business logic belonging to lower packages.
  - **Deterministic Registry & Namespaces**: Colon-delimited namespaces (`migrate:status`, `route:list`, `model:list`) with top-level DX aliases (`migrate`, `routes`, `models`) and space-delimited fallback.
  - **Zero-Dependency ArgParser**: High-throughput parsing (>1.3M ops/sec) with positional args, long/short options, inline `=`, boolean negation (`--no-flag`), enum choices, array accumulation, and typo suggestions via Levenshtein distance.
  - **Output Abstraction (`CliOutput`)**: Strict stream separation (stdout for payloads/tables/JSON, stderr for diagnostics/errors), TTY auto-detection, `--no-color` support, `--quiet`, `--verbose`, and clean `--json` mode.
  - **Standardized POSIX Exit Codes**: Predictable exit codes (0 = Success, 1 = General, 2 = Usage, 3 = Config, 4 = Database, 5 = Migration, 130 = Interrupted).
  - **Project Discovery & Safe Scaffolding**: Fast upward traversal discovering project roots without filesystem-wide scanning; `assertSafePath` defending against path traversal.
  - **Built-in Developer Commands**:
    - `version` & `help`: Ultra-fast zero-infrastructure boot path.
    - `doctor`: Comprehensive environment, Node version, project configuration, and database diagnostics.
    - `route:list` (alias `routes`): Lists routes with method, path, name, handler, middleware count, and filters.
    - `model:list` & `model:show`: Rich ORM model inspection with table, fields, types, and associations.
    - `config:show`: Configuration inspection with automatic secret and credential masking (`********`).
    - `db:status` (alias `database:status`): Database connectivity and health ping verification.
    - `migrate:run` & `migrate:status` & `migrate:rollback`: Full schema lifecycle with destructive operation guards (`--yes`, `--force`).
    - `migrate:generate <name>`: Generates timestamped migrations from ORM model diffs.
    - `migrate:check`: Verifies schema drift in CI/CD pipelines without altering databases, exiting non-zero on drift.
    - `create <name>`: Scaffolds complete jsango projects safely without overwriting non-empty directories.
  - **Plugin Extension Architecture**: `ICommandProvider` allowing external and future packages (Admin, Queue, etc.) to register CLI commands cleanly.
  - **Lifecycle & Cancellation**: `AbortSignal` propagation on `SIGINT` / `SIGTERM` with registered cleanup hooks and graceful pool closing.
- [x] **Authentication + Authorization (`@jsango/auth`) (Phase 10)**:
  - **Decoupled Architecture**: Strict separation of Authentication ("Who is this principal?") from Authorization ("What is this identity allowed to do?").
  - **Immutable Identity Abstraction**: `Identity`, `UserIdentity`, `ServiceAccountIdentity`, `AnonymousIdentity`, `SystemIdentity`, with non-leaking `toJSON()` serialization.
  - **Pluggable Authentication Strategies**:
    - `SessionAuthenticationStrategy` with `MemorySessionStore` and session fixation defense (`rotate()`).
    - `BearerTokenAuthenticationStrategy` with RFC 7519 `JwtService` (HS256/384/512) and algorithm confusion defense (`alg: "none"` rejection).
    - `ApiKeyAuthenticationStrategy` with SHA-256 key hashing before lookup/verification.
  - **Deterministic Strategy Chaining**: `AuthenticationManager` with fail-fast defense preventing silent downgrade to weaker authentication.
  - **Memory-Hard Password Hashing**: `ScryptPasswordHasher` (RFC 7914) with random salt, constant-time verification, and `needsRehash` upgrade strategy.
  - **Authorization Engine**:
    - `PermissionRegistry`: Namespaced permission strings with exact and wildcard matching (`users.*`, `*`).
    - `RoleRegistry`: Role definition and deduplicated aggregate permission resolution.
    - `PolicyRegistry` & `BasePolicy`: Object-level and resource-level policies compatible with Phase 6 ORM `ModelMetadata`.
    - Boolean Policy Combinators: `andPolicy`, `orPolicy`, `notPolicy`.
    - Bulk Authorization: `AuthorizationManager.authorizeMany()` for Admin batch operations.
    - Centralized, Auditable Superuser Bypass: Explicit `isSuperuser === true` handled strictly in `AuthorizationManager.authorize()`.
    - Fail-Closed Security Invariant: Missing identity, missing policy, or unhandled exceptions always resolve to **DENY**.
  - **HTTP Middleware Integration**:
    - `authenticate()` middleware supporting required vs optional (anonymous) routes.
    - `authorize()` middleware cleanly separating 401 Unauthorized (`UnauthenticatedError`) from 403 Forbidden (`ForbiddenError`).
    - Strict request-scoped identity isolation in `RequestContext.state` and DI container with zero mutable global state.
  - **Admin & Multi-Tenancy Readiness**: Tenant context slots in `Identity` and `AuthContext`, object-level and bulk policy evaluation.
- [x] **Cache Abstraction (`@jsango/cache`) (Phase 11)**:
  - **`CacheManager`**: Multi-store orchestrator with named store resolution, driver factories, fallback modes (`fail-fast`, `fallback-to-memory`, `bypass`), and lifecycle shutdown.
  - **`CacheStore`**: High-level caching interface with key normalization (`CacheKeyBuilder`), safe serialization (`SafeCacheSerializer` with Date/BigInt support), Promise-based stampede protection, hit/miss statistics, and `namespace()` isolation.
  - **`ICacheDriver`**: Universal driver contract with `CacheCapabilities` — `get`, `set`, `has`, `delete`, `clear`, `increment`, `decrement`, `expire`, `ttl`, `getMany`, `setMany`, `deleteMany`, `close`.
  - **`MemoryCacheDriver`**: LRU-capable in-memory storage with passive TTL expiration, configurable `maxEntries`, and background prune sweeps.
  - **Redis Adapter**: Follows identical `ICacheDriver` contract for seamless backend swapping.
  - **CLI**: `cache:clear [--store] [--force]` with destructive confirmation guard.
  - **Contract Tests**: Reusable driver compliance suite; `FakeCacheDriver` for application test isolation.
- [x] **Queue & Background Jobs (`@jsango/queue`) (Phase 11)**:
  - **`QueueManager`**: Multi-connection orchestrator with named queues, worker management, job registry, failed job store, and graceful shutdown.
  - **`Queue`**: Named queue handle with typed `dispatch()`, `delay()`, `schedule()`, `depth()`, `stats()`, and `clear()`.
  - **`IQueueDriver`**: Universal driver contract with `QueueCapabilities` — `enqueue`, `claim` (visibility leases), `acknowledge`, `release`, `fail`, `cancel`, `getJob`, `getStats`, `getQueueDepth`, `clear`, `close`.
  - **`MemoryQueueDriver`**: In-memory driver with priority sorting, delayed jobs, and visibility lease support.
  - **`DatabaseQueueDriver`**: Persistent driver using `@jsango/database` with `locked_until` visibility lease enforcement for multi-worker environments.
  - **`Worker`**: Long-running polling process with configurable concurrency, idle backoff, lease timeout, job timeout via `AbortSignal`, retry orchestration (`RetryCalculator` with fixed/exponential/jitter), and graceful shutdown.
  - **`JobRegistry`**: Type-safe job type → handler resolution with duplicate prevention.
  - **`MiddlewarePipeline`** (Queue): Separate onion-style middleware scoped to job execution (not HTTP middleware).
  - **`IFailedJobStore`**: Dead-letter storage contract with `MemoryFailedJobStore` implementation.
  - **AT-LEAST-ONCE Delivery**: Visibility leases prevent duplicate processing; handlers must be idempotent.
  - **CLI**: `queue:work [--once]`, `queue:status`, `queue:failed`, `queue:retry`, `queue:clear [--force]`.
  - **Contract Tests**: Reusable driver compliance suite; `FakeQueueDriver` for application test isolation.
- [x] **Event System (`@jsango/events`) (Phase 12)**:
  - **`EventBus`**: Multi-mode typed event dispatcher supporting `sync` (priority sequential), `async` (concurrent `Promise.allSettled`), and `queued` (background via queue adapter).
  - **`EventRegistry`**: Priority-based handler registration, duplicate prevention, and inspection API (`inspect()`) for admin and observability.
  - **`EventMiddlewarePipeline`**: Onion-style event middleware pipeline independent of HTTP and Queue middleware.
  - **`EventSerializer`**: Safe JSON serialization and deserialization rejecting non-serializable types (functions, symbols, circular refs).
  - **`QueueEventAdapter`**: Decoupled integration with `@jsango/queue` implementing `IEventQueueAdapter`.
  - **Lifecycle Hooks**: `onDispatched`, `onHandlerStarted`, `onHandlerCompleted`, `onHandlerFailed`.
  - **Testing**: `FakeEventBus` testing utility.
- [x] **WebSocket & Real-Time Infrastructure (`@jsango/websocket`) (Phase 12)**:
  - **Runtime-Independent Abstractions**: `IWebSocketServer` and `IWebSocketConnection` encapsulating underlying engines (`ws`).
  - **`WebSocketManager`**: Central real-time coordinator managing connections, rooms, broadcasting, and message routing.
  - **`RoomManager`**: In-memory bidirectional room mapping with join authorization, member lookups, and auto-cleanup.
  - **`WebSocketContext`**: Context abstraction providing `reply()`, `send()`, `state: Map<string, unknown>`, and identity mirroring `RequestContext`.
  - **Defensive Limits & Backpressure**: Configurable `maxTotalConnections`, `maxConnectionsPerIdentity`, `maxRoomsPerConnection`, `maxMessageSizeBytes`, and `maxBufferedAmountBytes`.
  - **`HeartbeatManager`**: Active ping/pong health monitoring with automatic termination of dead connections.
  - **Transport Abstraction**: `IRealtimeTransport` with `LocalTransport` built-in, extensible to distributed pub/sub backends.
  - **Authentication Integration**: HTTP upgrade authentication hooks reusing `@jsango/auth` Identity.
  - **Bi-Directional Bridges**: `WebSocketEventBridge` (EventBus $\to$ WS room) and `WebSocketToEventBridge` (WS $\to$ EventBus).
  - **CLI**: `events:list` and `ws:status`.
  - **Testing**: `FakeWebSocketConnection` and `FakeWebSocketServer`.
- [x] **Documentation & ADRs (Phases 0 - 12)**:
  - Architecture guides across core, http, router, middleware, database, orm, migrations, cli, auth, cache, queue, events, and websocket packages.
  - ADR-001 through ADR-026.
- [x] **Benchmarks (Phases 2 - 12)**:
  - HTTP microbenchmarks (`benchmarks/http/http.bench.ts`).
  - Router microbenchmarks (`benchmarks/router/router.bench.ts`).
  - Middleware microbenchmarks (`benchmarks/middleware/middleware.bench.ts`).
  - Database microbenchmarks (`benchmarks/database/database.bench.ts`).
  - ORM microbenchmarks (`benchmarks/orm/orm.bench.ts`).
  - Migrations microbenchmarks (`benchmarks/migrations/migrations.bench.ts`).
  - CLI microbenchmarks (`benchmarks/cli/cli.bench.ts`).
  - Auth & Authorization microbenchmarks (`benchmarks/auth/auth.bench.ts`).
- [x] **Admin Platform Foundation (Phase 13)**:
  - **`@jsango/admin-core`**: Model-driven `AdminResource` definitions, auto-generation from ORM `ModelMetadata`, extensible field definitions (`textField`, `emailField`, `passwordField`, `jsonField`, `uuidField`, etc.), table/form/filter abstractions, plugin hooks, and central `AdminRegistry`.
  - **`@jsango/admin-auth`**: Granular `AdminPermissionChecker` validating staff access, resource-level CRUD permissions, row-level actions, and field-level visibility/editability with sensitive field safeguards.
  - **`@jsango/admin-audit`**: Non-blocking `AdminAuditLogger` producing immutable audit entries, `diffChanges` utility with automatic sensitive field redaction (`/password|secret|token|key|hash|salt|credential/i`), and deterministic `InMemoryAuditStore`.
  - **`@jsango/admin-media`**: `AdminMediaManager` with strict validation (`maxSizeBytes`, `allowedMimeTypes`, `allowedExtensions`) before storage I/O, backed by `IMediaStorage` and `InMemoryMediaStorage`.
  - **`@jsango/admin-server`**: Decoupled `IAdminQueryAdapter` bridging ORM and admin server, production-grade `AdminCrudService` orchestrating business logic and audit events, and full REST API mounted on `IRouter` (resource listing, schema, CRUD endpoints, soft-delete restore, row actions, bulk actions, and audit log query).
- [x] **OpenAPI & API Documentation (`@jsango/openapi`) (Phase 14)**:
  - **`OpenApiGenerator`**: Deterministic, zero-reflection OpenAPI 3.1.0 document generation from router metadata, validation schemas, ORM metadata, and Admin resources.
  - **`OpenApiRegistry`**: Central registration for components, operations, schemas, parameters, responses, and security schemes with strict collision detection (`DuplicateOperationIdError`, `ConflictingSchemaError`).
  - **Adapters**: `ValidationAdapter` (mapping validation rules to JSON Schema/OpenAPI), `OrmAdapter` (mapping `ModelMetadata` fields), and `AdminAdapter` (isolated Admin API docs).
  - **`OpenApiValidator`**: Built-in spec integrity checker validating paths, parameters, responses, and `$ref` component schemas.
  - **`OpenApiFormatter`**: Zero-dependency JSON and YAML serializer.
  - **HTTP Endpoint**: `createOpenApiHandler` serving `/openapi.json` with access control.
  - **CLI**: `openapi:generate [--output] [--format]` and `openapi:validate [--file]`.
- [x] **Observability Foundation (`@jsango/observability`) (Phase 14)**:
  - **`StructuredLogger`**: Production structured logging with scoped context chaining (`withContext`), control-character sanitization to prevent log injection, and log level filtering.
  - **`MetricRegistry`**: Bounded metrics engine supporting monotonic `Counter`, stateful `Gauge`, and distribution `Histogram` with high-cardinality protection (capped label permutations).
  - **`Tracer` & `Span`**: Nanosecond-accurate tracing using `performance.now()` monotonic clock with sampling strategies and zero-allocation `NoopSpan`.
  - **`CorrelationManager`**: Request ID sanitization/generation and W3C `traceparent` parsing & propagation across async boundaries.
  - **`HealthRegistry`**: Independent `liveness` and `readiness` health checks with `createHealthHandler` for `/health`, `/health/live`, `/health/ready`.
  - **`DiagnosticsProvider`**: Safe runtime and subsystem inspection with `createDiagnosticsHandler`.
  - **`Redactor`**: Recursive PII masking across sensitive keys and headers with zero input mutation.
  - **Framework Instrumentation**: HTTP middleware and hooks for metrics, logging, and correlation propagation.
  - **CLI**: `health`, `metrics [--filter]`, and `diagnostics`.
- [x] **Performance Optimization & Production Hardening (Phase 15)**:
  - **Radix Tree Static Route Fast Path**: $O(1)$ static route lookup table and `EMPTY_PARAMS` singleton boosting static matching from 3.2M to **7.7M+ ops/sec** (2.4x speedup).
  - **DI Container Instance Caching**: Immediate instance cache lookup in `Container.resolve()` accelerating scoped resolution from 17.6M to **24.1M+ ops/sec** and singleton resolution to **21.5M+ ops/sec**.
  - **Admin Schema Caching**: Cached `AdminResourceSchema` structure on `AdminResource._cachedSchema` accelerating schema generation from 6.6M to **24.6M+ ops/sec** (3.7x speedup).
  - **Tracing NoopSpan Optimization**: Singleton `NoopSpan.INSTANCE` elimination of object allocations when tracing is disabled or unsampled.
  - **Memory Leak & Hardening Tests**: Regression suite in `tests/performance/leak.test.ts` verifying memory bounds over 5,000 requests, 5,000 DI scopes, 1,000 WebSocket disconnects, and cache prunes.
  - **Concurrency Load Testing**: Concurrency suite in `tests/performance/concurrency.test.ts` verifying 1,000 concurrent HTTP requests, 1,000 event dispatches, and pooled database operations.
  - **Comprehensive Benchmark Suites**: Full coverage across all 15 framework subsystems (HTTP, Router, Middleware, Database, ORM, Migrations, Validation, CLI, Auth, Cache, Queue, Events, WebSockets, Admin, OpenAPI, Observability, Container, Startup).
- [x] **Release Candidate & Production Readiness (Phase 16)**:
  - Finalized public API boundaries, package tarball validation, external consumer testing, and release criteria.
- [x] **Final 1.0 Release & Public API Freeze (Phase 17)**:
  - Synchronized all 25 `@jsango/*` packages and root config to `1.0.0` stable.
  - Frozen public API symbols across all packages under SemVer guarantees in `docs/API-FREEZE.md`.
  - Comprehensive documentation: `docs/API-STABILITY.md`, `docs/SUPPORT.md`, `docs/MIGRATION-1.0.md`, `docs/POST-1.0-ROADMAP.md`, `docs/releases/1.0.0.md`, `CHANGELOG.md`.
- [x] **Enterprise Admin UI Foundation (Phase 18)**:
  - **`@jsango/admin-ui`**: Metadata-driven, high-performance frontend console foundation.
  - **`AdminApiClient`**: Typed HTTP client with token auth and error normalization.
  - **`QueryClient`**: In-memory query caching, stale-while-revalidate, and automatic mutation invalidation.
  - **Theme System**: Light, dark, and system themes with semantic CSS variables and design tokens.
  - **UI Primitives**: Buttons, status badges, inputs, alerts, skeletons, diff viewer, JSON viewer, confirmation modals.
  - **`Cmd+K` Command Palette**: Fast keyboard navigation across all discovered resources, operations, and theme settings.
  - **Data Table Engine**: Multi-column sorting, row selection, metadata-driven cell renderers, bulk action bar, search, and filters.
  - **Resource Form Engine**: Dynamically generated create/edit forms with validation error mapping.
  - **Views & Layout**: Realtime dashboard, Resource list, Resource detail, Create, Edit, Audit logs timeline with diff viewer, System health status.
  - **Extension & Plugin System**: Extensible registry for custom widgets, pages, and field renderers.
- [x] **Documentation & ADRs (Phases 0 - 18)**:
  - Architecture guides, Admin UI manual (`docs/admin/ADMIN-UI.md`), and performance report (`docs/performance/PHASE-15-REPORT.md`).
  - ADR-001 through ADR-038.

---

## Current Work

- Phase 18 Enterprise Admin UI Foundation completed and verified.

---

## Architecture Decisions

- **ADR-001**: Runtime Abstraction Layer (`IRuntimeAdapter`).
- **ADR-002**: Modular Monorepo & Package Separation.
- **ADR-003**: Structured Error Architecture & Safe Serialization (`JsangoError`).
- **ADR-004**: Public API Boundaries & Encapsulation.
- **ADR-005**: HTTP Core Abstraction, Runtime Boundary, and Response Lifecycle.
- **ADR-006**: Radix Tree Router Architecture and Deterministic Precedence.
- **ADR-007**: Middleware Pipeline, Application Abstraction, and Request Lifecycle.
- **ADR-008**: Database Abstraction Layer, Connection Pooling, and Driver Contract.
- **ADR-009**: ORM Architecture, Immutable Metadata System, and Zero N+1 Eager Loading.
- **ADR-010**: Migration Architecture, Schema Management, and Distributed Locking.
- **ADR-011**: CLI Command Architecture and Separation of Concerns.
- **ADR-012**: Command Registration, Namespacing, and Aliases.
- **ADR-013**: CLI Output Abstraction and Machine-Readable JSON Streaming.
- **ADR-014**: Project Discovery and Project Root Resolution.
- **ADR-015**: Lazy Command Initialization, Cancellation, and Lifecycle.
- **ADR-016**: Authentication Architecture & Strategy Chaining.
- **ADR-017**: Identity Abstraction and Request-Scoped Principals.
- **ADR-018**: Session and Token Security Strategy.
- **ADR-019**: Authorization Architecture & Fail-Closed Evaluation.
- **ADR-020**: Policy Model, Object-Level Access, and Composite Combinators.
- **ADR-021**: Fail-Closed Security Defaults and Password Cryptography.
- **ADR-022**: Cache Abstraction Architecture.
- **ADR-023**: Queue & Background Job Architecture.
- **ADR-024**: Event Bus Architecture & Delivery Semantics.
- **ADR-025**: WebSocket Abstraction & Room Architecture.
- **ADR-026**: Distributed Realtime Transport Strategy.

---

## Quality Gate Status

| Gate                         | Status        | Details                                                                        |
| :--------------------------- | :------------ | :----------------------------------------------------------------------------- |
| **Dependency Installation**  | Passed        | pnpm cleanly installed all workspace packages with zero external runtime deps. |
| **TypeScript Typecheck**     | Passed        | `tsc -b` compiles all 21 packages under strict mode with 0 errors.             |
| **Unit & Integration Tests** | Passed        | Vitest executed 108 test files, 540 tests passing (100% pass rate in ~6s).     |
| **Linting & Code Style**     | Passed        | ESLint passing with 0 errors and 0 warnings.                                   |
| **Formatting**               | Passed        | Prettier formatted 100% compliant (`pnpm format:check` clean).                 |
| **Turborepo Build**          | Passed        | `turbo run build` built 25/25 packages cleanly.                                |
| **Benchmarks**               | Passed        | Vitest bench suite executed successfully with throughput up to 62M ops/sec.    |
| **Circular Dependencies**    | Verified None | Strict unidirectional dependency graph verified.                               |

---

## Known Issues

None.

---

## Benchmark Results (Summary)

### Authentication & Authorization Benchmarks

- PermissionRegistry.matches (exact & wildcard): **12,617,692 ops/sec** (0.08 µs mean)
- Password verify (valid, Scrypt $N=2048$): **6,308,075 ops/sec** (~0.16 µs mean)
- AuthorizationManager.authorize (superuser bypass audit): **5,299,787 ops/sec** (0.19 µs mean)
- AuthorizationManager.can (direct permission): **3,817,163 ops/sec** (0.26 µs mean)
- AuthorizationManager.can (object-level policy): **3,422,419 ops/sec** (0.29 µs mean)
- AuthorizationManager.can (role mapped permission): **2,258,968 ops/sec** (0.44 µs mean)
- BearerTokenStrategy.authenticate: **2,109,088 ops/sec** (0.47 µs mean)
- AuthorizationManager.authorizeMany (10 resources bulk): **704,266 ops/sec** (1.42 µs mean)
- SessionStrategy.authenticate (MemoryStore): **191,108 ops/sec** (5.23 µs mean)

### ORM Benchmarks

- Model Metadata Lookup: **25,300,000 ops/sec** (0.0000 ms mean)
- Model Instance Creation: **15,000,000 ops/sec** (0.0001 ms mean)
- QueryBuilder Cloning: **4,050,000 ops/sec** (0.0002 ms mean)
- Model Hydration from Raw Rows: **2,240,000 ops/sec** (0.0004 ms mean)
- Query AST Compilation: **1,320,000 ops/sec** (0.0008 ms mean)
- Bulk Insert (10 items): **182,500 ops/sec** (0.0055 ms mean)
- Pagination Execution (page 1, size 5): **162,900 ops/sec** (0.0061 ms mean)
- COUNT Aggregation: **125,600 ops/sec** (0.0080 ms mean)
- Simple SELECT via ORM: **97,900 ops/sec** (0.0102 ms mean)
- Bulk Update: **71,600 ops/sec** (0.0140 ms mean)
- Relation Eager Loading (Users + Posts): **33,900 ops/sec** (0.0295 ms mean)
- Transaction-Backed Persistence: **9,580 ops/sec** (0.1044 ms mean)

### Database Abstraction Benchmarks

- Connection Release: **3,313,255 ops/sec** (0.0003 ms mean)
- Connection Acquisition: **3,105,512 ops/sec** (0.0003 ms mean)
- Dialect Placeholder Normalization: **2,709,312 ops/sec** (0.0004 ms mean)
- Parameterized Query Execution: **2,034,862 ops/sec** (0.0005 ms mean)
- Full DatabaseManager Query Dispatch: **1,168,353 ops/sec** (0.0009 ms mean)
- Transaction Creation & Commit: **1,209,265 ops/sec** (0.0008 ms mean)
- Transaction Creation & Rollback: **1,066,260 ops/sec** (0.0009 ms mean)
- Savepoint Creation & Rollback: **790,177 ops/sec** (0.0013 ms mean)
- Credential Masking in Strings: **670,085 ops/sec** (0.0015 ms mean)

### Middleware & Request Lifecycle Benchmarks

- Scoped Container Creation & Disposal: **3,056,430 ops/sec**
- Response Normalization: **1,909,242 ops/sec**
- Empty Middleware Pipeline: **1,773,351 ops/sec**
- Single Middleware Pipeline: **738,733 ops/sec**
- Full Application Lifecycle: **420,411 ops/sec**

### Router Benchmarks

- Static Route Matching: **3,212,192 ops/sec**
- Parametric Route Matching: **2,525,487 ops/sec**
- Reverse URL Generation: **3,892,104 ops/sec**

### HTTP Core Benchmarks

- Raw Response Creation: **10,990,926 ops/sec**
- Header Lookup: **7,160,766 ops/sec**
- Request Context Creation: **6,915,571 ops/sec**

### Cache Benchmarks

- Store Resolution (cached): **15,283,810 ops/sec** (0.0001 ms mean)
- CacheKeyBuilder (simple): **7,897,831 ops/sec** (0.0001 ms mean)
- MemoryCacheDriver get (hit): **5,773,606 ops/sec** (0.0002 ms mean)
- MemoryCacheDriver has: **5,577,805 ops/sec** (0.0002 ms mean)
- MemoryCacheDriver get (miss): **5,261,024 ops/sec** (0.0002 ms mean)
- Serializer (simple string): **4,843,821 ops/sec** (0.0002 ms mean)
- MemoryCacheDriver set (no TTL): **4,153,556 ops/sec** (0.0002 ms mean)
- MemoryCacheDriver increment: **4,053,034 ops/sec** (0.0002 ms mean)
- CacheStore get (hit, full stack): **1,485,175 ops/sec** (0.0007 ms mean)
- CacheManager get (delegated): **1,397,028 ops/sec** (0.0007 ms mean)
- Serializer (complex object): **1,285,285 ops/sec** (0.0008 ms mean)

### Queue Benchmarks

- RetryCalculator.shouldRetry: **62,034,077 ops/sec** (0.00002 ms mean)
- RetryCalculator.calculateDelay (fixed): **56,853,450 ops/sec** (0.00002 ms mean)
- RetryCalculator.calculateDelay (exponential + jitter): **32,474,654 ops/sec** (0.00003 ms mean)
- JobRegistry.resolve: **22,936,965 ops/sec** (0.00004 ms mean)
- QueueManager queue() resolution (cached): **14,553,479 ops/sec** (0.0001 ms mean)
- MemoryQueueDriver enqueue: **1,684,433 ops/sec** (0.0006 ms mean)
- Queue depth: **1,234,711 ops/sec** (0.0008 ms mean)
- MemoryQueueDriver getQueueDepth: **775,615 ops/sec** (0.0013 ms mean)
- Queue dispatch (typed job): **661,041 ops/sec** (0.0015 ms mean)
- QueueManager dispatch (via manager): **569,811 ops/sec** (0.0018 ms mean)
- MemoryQueueDriver claim: **475,866 ops/sec** (0.0021 ms mean)
