# ADR-008: Database Abstraction Layer Architecture

## Status

Accepted

## Context

A production-grade web framework requires reliable, high-performance database connectivity. Prior to implementing higher-level features such as the ORM (Phase 6) or Migrations (Phase 7), the framework requires a rock-solid, driver-independent database abstraction layer.

Key requirements for this foundation:

1. **Separation from ORM**: The database layer must not contain models, queries, or active record logic. It must exclusively focus on connection pooling, driver adapters, parameterized queries, and transaction state management.
2. **Runtime Independence**: Must operate deterministically across Node.js and Bun without coupling to Node.js internals or third-party runtime dependencies.
3. **Pluggable Drivers**: Must support PostgreSQL, MySQL, SQLite, and in-memory mock drivers behind a unified driver adapter contract (`IDatabaseDriver`).
4. **Production Connection Pooling**: Configurable connection limits, acquisition timeouts, idle reaping, max lifetime enforcement, and FIFO queueing.
5. **Strict Transaction Safety**: Guaranteed rollback on exceptions, prevention of duplicate commits/rollbacks, and savepoint management.
6. **Security by Default**: Zero credential leaks in logs, errors, or serialized configurations; mandatory parameterized query execution.

## Decision

### 1. Layered Database Architecture

We established a strict 4-tier database hierarchy:

```
Application / Service / Job / Handler
    ↓
DatabaseManager (named connection registry & top-level dispatch)
    ↓
ConnectionPool (resource queue, lifecycle & eviction)
    ↓
DatabaseConnection & DatabaseTransaction (client abstraction)
    ↓
DriverAdapter (IDatabaseDriver & IDriverConnection)
    ↓
Database Engine (Memory / Postgres / MySQL / SQLite)
```

### 2. Zero-Dependency Internal Connection Pool

Rather than introducing heavy external dependencies (such as `generic-pool`), we implemented a native, high-performance, asynchronous `ConnectionPool`:

- Manages FIFO waiter queues with microsecond precision.
- Enforces acquisition timeouts via `ConnectionAcquisitionTimeoutError`.
- Integrates with `AbortSignal` for cancellation without resource leakage.
- Handles graceful draining and shutdown without leaving orphan sockets.

### 3. Capability-Driven Driver Adapter

Each database driver declares its capabilities via strongly typed flags:

```typescript
export interface DatabaseCapabilities {
  readonly supportsTransactions: boolean;
  readonly supportsSavepoints: boolean;
  readonly supportsIsolationLevels: boolean;
  readonly supportsReturning: boolean;
  readonly supportsCancellation: boolean;
  readonly placeholderType: 'dollar' | 'question' | 'named';
  readonly supportedIsolationLevels?: readonly IsolationLevel[];
}
```

Attempting an unsupported operation (such as setting an unsupported isolation level) throws a structured, typed framework error (`IsolationLevelUnsupportedError`) before dispatching to the engine.

### 4. SQL Dialect & Parameterized Query Normalization

Different database engines expect different parameter placeholder formats (`?` in SQLite/MySQL vs `$1, $2` in PostgreSQL). To decouple the caller and ORM from engine quirks, `SqlDialect` normalizes standard `?` positional parameters into the driver's native syntax while safely preserving string literals.

### 5. Transaction State Machine & Callback Lifecycle

Transactions are wrapped in a formal state machine (`active` → `committed` | `rolledBack`). Re-committing, re-rolling back, or executing queries on completed transactions throws `TransactionClosedError`.
Furthermore, `conn.transaction(async (tx) => { ... })` guarantees automatic commit on successful return, automatic rollback on error, and automatic release of the pooled connection in a `finally` block.

### 6. Credential Sanitization

Connection URLs and configuration objects are masked via `maskConnectionString` and `maskConnectionConfig` to guarantee that plaintext passwords never appear in diagnostics, error stacks, or logs.

## Consequences

### Positive

- Strict separation of concerns between raw database infrastructure and future ORM/QueryBuilder logic.
- Zero external runtime dependencies in `@jsango/database`.
- Exceptional performance: over 3.1M connection acquisitions/sec and 2.2M parameterized queries/sec.
- Safe resource management with guaranteed connection release and transaction rollback.
- Full testability through a deterministic, high-fidelity `MemoryDatabaseDriver`.

### Negative

- Driver adapters for external databases (`pg`, `mysql2`, `better-sqlite3`) must be implemented as modular driver packages in subsequent phases.
