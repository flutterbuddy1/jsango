# Changelog

All notable changes to the `jsango` framework will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.3.0] - 2026-09-30

### MongoDB support and advanced queries for every database

#### MongoDB: first-class support
- **Fixed:** `jsango migrate` failed on MongoDB with "Unsupported MongoDB command". The migration history, lock and schema operations were SQL-only. MongoDB now has its own path: collections, `$jsonSchema` validators (required fields and types), unique/partial indexes, default backfill on added fields, `$unset`/`$rename` for dropped/renamed fields, and history/lock collections. It works on standalone servers and replica sets.
- The ORM runs on MongoDB. Every query builder feature is translated to filters and aggregation pipelines with SQL semantics (AND/OR precedence, `LIKE` → anchored regex, `IS NULL` matches missing fields). The primary key maps to `_id`, and ObjectIds are exposed as hex strings.
- `fields.objectId()` for portable ids and references (native ObjectId on MongoDB, `VARCHAR(24)` on SQL). Table-builder equivalents: `t.objectIdKey()` / `t.objectId()`.
- Transactions through client sessions, with an actionable hint when the server isn't a replica set.
- `connection.execute({ op, collection, … })` structured commands, `ctx.execute()` in migrations, and `db.mongo<Db>()` for the native driver.

#### Advanced queries (all databases)
- Grouped conditions `where(q => …)` / `orWhere(q => …)`, `whereNot`, `whereBetween` / `whereNotBetween`, `whereLike` (case-insensitive everywhere), `whereRaw` (SQL string or Mongo filter), `orWhereIn`, `orWhereNull`, and the `BETWEEN` operator form.
- `distinct()`, `pluck()`, `value()`, `findMany()`, `firstOrFail()`, `latest()` / `oldest()`, `take()` / `skip()`, `chunk()`.
- Aggregates: `sum`, `avg`, `min`, `max`, `count(column)`, and `groupBy(columns, aggregates, { having, orderBy, limit })`.
- Atomic `increment` / `decrement` (bulk and per model), `firstOrCreate`, `updateOrCreate`, `restore()` for soft deletes, and `lockForUpdate()` / `sharedLock()`.
- `whereIn` / `whereNull` / `BETWEEN` operators are now allow-listed as well, so no operator text reaches SQL unvalidated.

#### Tests
- One advanced ORM + migrations scenario run unchanged on SQLite, PostgreSQL (pg-mem) and MongoDB (replica set), plus real servers through `JSANGO_TEST_POSTGRES_URL` / `JSANGO_TEST_MYSQL_URL` / `JSANGO_TEST_MONGO_URL`.
- The MongoDB CLI workflow (db:status → makemigrations → migrate → model change → rollback) on a standalone server.

---

## [1.2.0] - 2026-09-30

### Database, ORM & Migrations: working end to end on PostgreSQL, MySQL and SQLite

#### Fixed
- **`npx jsango new` / `npx jsango` failed with "jsango is not recognized" in 1.1.0.** The 1.1.0 packages were published without their `dist/` build output because the CLI build failed on an unescaped template literal. Every package now builds in `prepack`, so an unbuilt package can no longer be published.
- **The CLI never connected to your database.** `migrate`, `migrate:status`, `migrate:rollback`, `migrate:check` and `db:status` always reported "No database configured" because nothing loaded the project. The CLI now loads `jsango.config.ts` (or `DATABASE_URL`), `.env`, your models and your migration files.
- **`migrate:generate` generated `DROP TABLE` instead of `CREATE TABLE`.** The schema diff arguments were swapped. It now diffs your models against the schema reconstructed from existing migrations, like Django's `makemigrations`, and needs no database connection.
- **Migrations always compiled SQL for the in-memory dialect.** The dialect is now detected from the connection (PostgreSQL / MySQL / SQLite).
- **`CREATE TABLE` ignored unique constraints, indexes and foreign keys.** They are now emitted, and tables are created in foreign-key dependency order.
- **MySQL:** identifiers were quoted with `"` (a string literal in MySQL), so every query failed. Backticks are now used everywhere. MySQL-specific types (`DATETIME(3)`, `TINYINT(1)`, `JSON`, `AUTO_INCREMENT`), `START TRANSACTION`, `DROP INDEX … ON`, `DROP FOREIGN KEY` and UTC date handling were added.
- **PostgreSQL:** `Model.create()` returned no `id` (no `RETURNING`). JSON arrays were sent as Postgres array literals. `ALTER COLUMN` now handles type, nullability and default changes.
- **SQLite:** `INSERT … RETURNING` lost its rows. `Date`, `boolean` and JSON values were rejected by the drivers. With a pooled `:memory:` database, each pooled connection was a separate, empty database. `ALTER COLUMN` and adding or dropping foreign keys now use a safe, automatic table rebuild that preserves data.
- **The Postgres and MySQL drivers silently returned empty results when the client package was missing.** They now fail with an install hint. Connection errors now include the target (never the password) and an actionable hint.
- Models looked for a connection literally named `default`. The name `'default'` now resolves to the configured default connection.
- Soft-deleted rows were returned by normal queries. `orWhere()` could bypass the soft-delete scope. A soft `delete()` deadlocked on single-connection pools.
- `createdAt` / `updatedAt` / `deletedAt` were not readable as model properties and were not converted to `Date`.
- A relation target resolved during migration generation was cached as a stub, which broke `.with()` later in the same process.
- `where()` accepted arbitrary operator strings, which were interpolated into SQL.
- OFFSET without LIMIT produced invalid SQL on MySQL and SQLite.

#### Added
- `jsango.config.ts` with `defineConfig({ database, models, migrations })`. TypeScript config, model and migration files are loaded through `tsx`, so no build step is needed.
- `databaseConfigFromEnv()`: configure a database from `DATABASE_URL` or `DATABASE_DRIVER` / `DATABASE_HOST` / … / `DATABASE_SSL` / `DATABASE_POOL_MAX`.
- Connections defined by `url` alone. The driver is inferred from `postgres://`, `mysql://`, `sqlite:` and similar schemes.
- `db.verify()`, `db.getDialect()`, `db.getDriverName()`, `db.resolveConnectionName()`, and a multi-connection `db:status`.
- CLI: `makemigrations` alias, `migrate --dry-run` (prints SQL), `migrate:generate --empty` / `--dry-run`, `migrate:check` for CI (unmigrated model changes and pending migrations), and `migrate:reset --yes [--fresh]`.
- Hand-written migrations with a schema builder: `defineMigration({ up(ctx) { await ctx.createTable('users', t => { t.id(); t.string('email').unique(); t.timestamps(); }) } })`, plus `renameColumn`, `addIndex`, `addForeignKey` and more.
- Migration safety: destructive operations require `--yes`, `NOT NULL` columns without a default trigger a warning, the migration lock has a 15-minute stale timeout, per-migration transactions on PostgreSQL/SQLite, and clear partial-failure reporting on MySQL.
- ORM: `transaction(async () => …)` with automatic propagation to all model calls, `withTrashed()` / `onlyTrashed()`, `create()` / `bulkCreate()` accept `{ connection }`, and unknown attributes are ignored on insert/update.
- `jsango new` now generates a working database setup: SQLite by default, `jsango.config.ts`, `src/database.ts`, an example `User` model, a `migrations/` folder, `.env` and npm scripts (`makemigrations`, `migrate`, `db:status`).
- Documentation: a complete [database guide](docs/database/README.md), and rewritten web docs sections for connecting, models, querying, transactions, migrations, production use and troubleshooting. The old pages described APIs that did not exist, such as `migrate:diff`, `fields.enum` and `.sum()`.

#### Tests
- End-to-end CLI workflow on a real SQLite project (config → makemigrations → migrate → CRUD / relations / JSON / soft deletes / transactions → model change → rebuild migration → rollback → check).
- The same migration and ORM scenario on PostgreSQL (pg-mem, plus real servers through `JSANGO_TEST_POSTGRES_URL` / `JSANGO_TEST_MYSQL_URL`).
- A check that the `jsango new` template type-checks and migrates.

---

## [1.0.9] - 2026-09-28

### Enhancements & Simplification
- **Admin Panel Simplification**: Streamlined Admin Console navigation, removed clutter and extraneous reports views in favor of focused CRUD and model administration.
- **Accurate Live System Diagnostics**: Added real-time V8 heap memory, RSS footprint, uptime, Node runtime version, and subsystem integrity indicators fetched live from `/system/health`.
- **Configurable Super Admin Credentials**: Super admin login credentials can now be customized via `app.admin({ auth: { ... } })` or environment variables (`JSANGO_ADMIN_USER`, `JSANGO_ADMIN_PASSWORD`).
- **Clean Login UI**: Removed demo credentials helper buttons from the login page.
- **Mobile Responsive Web & Docs**: Complete responsive polish for landing page and developer documentation.

---

## [1.0.8] - 2026-09-28

### Fixes & Enhancements
- **Admin UI Mounting**: `app.admin({ path: '/admin-panel', ... })` now automatically mounts the React Admin Single-Page App (SPA) HTML handler on the configured path and subpaths, connecting seamlessly to the backend `@jsango/admin-server` API.

---

## [1.0.7] - 2026-09-28

### Phase 20: First-Class AI Platform & Agent Orchestration Runtime

#### Added
- **`@jsango/ai` Package**:
  - Universal provider abstraction supporting OpenAI, Anthropic Claude, Google Gemini, Ollama, and `FakeLlmProvider`.
  - Model Router with multi-provider prefix resolution (`openai:`, `gemini:`, `anthropic:`), automatic fallback chains, and retries.
  - Strongly-typed structured output generation integrated with `@jsango/validation`.
  - Autonomous AI Agents with reasoning loops, tool calling, memory management, and guardrails.
  - Type-safe tool definitions (`tool()`) with schema validation, permission checks, timeouts, and human-in-the-loop approvals (`requiresApproval: true`).
  - Multi-agent orchestration workflows (`workflow()`) supporting sequential steps, parallel fan-out, conditional branching, and loops.
  - Unified short-term and long-term conversation memory (`InMemoryMemoryStore`, `DatabaseMemoryStore`) with user and tenant isolation.
  - RAG & Vector Search: Ingestion, chunking, embeddings, and vector similarity retrieval (`InMemoryVectorStore`).
  - Model Context Protocol (MCP): Native `McpServer` and `McpClient` for JSON-RPC tool sharing.
  - One-line Application Transports: `app.agent('/path', agent)` (REST & SSE streaming) and `app.wsAgent('/path', agent)` (WebSocket streaming).
  - CLI generators: `jsango make:agent <Name>` and `jsango ai:doctor`.
  - Comprehensive documentation in `docs/ai/`, `docs/architecture/ai.md`, `docs/security/AI-SECURITY.md`, `docs/performance/AI-PERFORMANCE.md`, `docs/dx/AI-API-SIMPLICITY.md`.

---

## [1.0.0] - 2026-09-25

### Official 1.0.0 General Availability Release & Rebranding

#### Rebranding

- The framework is now officially named **JSango**.
- All framework package names use the `@jsango/*` namespace across all 26 packages.
- The CLI binary is now named `jsango`.
- Configuration environment variables now use the `JSANGO_*` prefix.
- Base error model is now `JsangoError`.
- For historical migration details, see [Migration Guide: Legacy to JSango](docs/MIGRATION-DJANGO-JS-TO-JSANGO.md).

#### Release Highlights

This marks the official **1.0.0 Stable Release** of `jsango`. The public API is frozen under Semantic Versioning guarantees across all 25 packages.

- **Public API Freeze**: Formally froze all public symbols and exports across `@jsango/*` packages (`docs/API-FREEZE.md`).
- **Framework Version Finalization**: Synchronized all 25 packages, root package, CLI version constant, and examples to `1.0.0`.
- **Packaging & Validation**: Verified complete clean packaging (`npm pack --dry-run`) across all 25 packages.
- **Documentation Complete**: Added comprehensive support matrix (`docs/SUPPORT.md`), API stability policy (`docs/API-STABILITY.md`), 1.0 migration guide (`docs/MIGRATION-1.0.md`), and post-1.0 roadmap (`docs/POST-1.0-ROADMAP.md`).
- **Quality Gates**: 123 test files (603 tests) passing with 100% typecheck, zero lint warnings, and high-concurrency verification.

---

## [0.1.0-rc.1] - 2026-09-25

### Release Candidate 1 — Production Readiness

This marks the official **Release Candidate 1** of `jsango`, a batteries-included, production-grade TypeScript backend framework combining convention-over-configuration design, strict type safety, and modern JavaScript runtimes.

### Added

- **Core Architecture & Runtime (`@jsango/core`, `@jsango/runtime`)**:
  - Runtime abstraction layer supporting Node.js with lifecycle coordinators (`boot`, `ready`, `shutdown`).
  - Structured error hierarchy (`JsangoError`, `HttpError`, `DatabaseError`, `AuthError`).
- **Dependency Injection (`@jsango/container`)**:
  - High-performance DI container supporting `singleton`, `transient`, and `scoped` lifetimes.
  - Direct instance resolution fast-path delivering over 24.1M ops/sec.
- **HTTP Engine & Middleware (`@jsango/http`, `@jsango/middleware`)**:
  - Runtime-independent `HttpRequest` and `HttpResponse` abstractions with streaming body parsers.
  - Secure cookie handling, CRLF injection defenses, and strict header validation.
  - Onion-style middleware pipeline with double-call prevention and RFC 7231 compliance.
- **Routing Engine (`@jsango/router`)**:
  - High-throughput Segment-based Radix Trie routing engine with $O(1)$ static route fast-paths (>7.7M ops/sec).
  - Typed route parameter constraints (`:id<number>`), route groups, prefix inheritance, and reverse routing.
- **Database & Transactions (`@jsango/database`)**:
  - Multi-connection `DatabaseManager` with FIFO connection pooling, idle reaping, and timeout protection.
  - Scoped transaction manager with state-machine safety and savepoint rollback support.
  - In-memory database driver and universal SQL dialect abstraction.
- **ORM & Relationships (`@jsango/orm`)**:
  - Declarative model definition with immutable metadata (`ModelMetadata`).
  - Pure batch eager loading via `.with()` guaranteeing zero N+1 queries.
  - Immutable AST query builder and model dirty tracking (`isDirty()`, `getDirty()`).
- **Schema Migrations (`@jsango/migrations`)**:
  - Normalized schema snapshots, live database reflection, and topological schema diffing engine.
  - Distributed migration locking (`jsango_migration_lock`) and reversible DDL compilers.
- **Validation & Serialization (`@jsango/validation`)**:
  - High-throughput schema validation engine for body, query, and parameter payloads.
- **Developer Tooling & CLI (`@jsango/cli`)**:
  - CLI runner (`jsango`, `jsango`) with project scaffolding (`create`), migration runner (`migrate:run`, `migrate:status`, `migrate:rollback`), inspection (`route:list`, `model:list`), and worker execution (`queue:work`).
- **Authentication & Authorization (`@jsango/auth`)**:
  - Pluggable authentication strategies (Session, Bearer JWT, API Key) and Scrypt password hashing.
  - Role, permission, and object-level policy engine (`BasePolicy`, `PolicyRegistry`) with fail-closed security.
- **Caching & Background Queues (`@jsango/cache`, `@jsango/queue`)**:
  - Universal cache abstraction with stampede protection (`remember`), namespaces, and in-memory LRU/TTL driver.
  - At-least-once background job processing with concurrent workers, exponential backoff, and dead-letter store.
- **Events & WebSockets (`@jsango/events`, `@jsango/websocket`)**:
  - Tri-mode event dispatching (`sync`, `async`, `queued`) with priority handlers.
  - Multi-room WebSocket management with heartbeat health monitoring and backpressure safeguards.
- **Admin Platform (`@jsango/admin-core`, `@jsango/admin-server`, `@jsango/admin-auth`, `@jsango/admin-audit`, `@jsango/admin-media`)**:
  - Model-driven Admin resource definitions, CRUD REST API endpoints, staff authorization, and immutable audit logs.
- **OpenAPI 3.1 & Observability (`@jsango/openapi`, `@jsango/observability`)**:
  - Deterministic OpenAPI 3.1.0 document generator with router, validation, ORM, and Admin adapters.
  - Structured JSON logging, bounded Prometheus metrics, monotonic distributed tracing, and health registries.
- **Performance Optimization & Hardening**:
  - Comprehensive memory leak and concurrency load test suites with zero resource leaks.
  - End-to-end Release Candidate smoke test suite (`tests/e2e/rc-smoke.test.ts`).

### Changed

- Standardized package versioning to `0.1.0-rc.1` across all 25 monorepo packages.
- Added explicit MIT license declarations and package manifests.
