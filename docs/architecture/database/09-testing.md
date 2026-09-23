# Database Testing Strategy

The database test suite provides high-fidelity, deterministic verification across all levels of the architecture.

## Testing Layers

1. **Driver Contract Tests (`driver-contract.test.ts`)**:
   - Universal contract test suite that every database driver adapter (PostgreSQL, MySQL, SQLite, in-memory) must pass.
   - Tests connect, disconnect, ping, parameterized query execution, transactions, rollback, and savepoints.
2. **Connection Pool Tests (`pool.test.ts`)**:
   - Tests minimum connection warmup, dynamic allocation up to max capacity, FIFO queueing, acquisition timeouts, and cancellation via `AbortSignal`.
   - Tests recovery and replacement of destroyed connections.
   - Tests graceful pool drain and shutdown.
3. **Transaction Tests (`transaction.test.ts`)**:
   - Tests manual and automatic transactions.
   - Tests state machine transitions and guards against invalid operations on closed transactions.
   - Tests nested savepoint rollback and commit.
   - Tests automatic rollback upon connection release.
4. **Query Tests (`query.test.ts`)**:
   - Tests typed `DatabaseResult<T>`, column metadata, and parameter array binding.
   - Tests SQL placeholder normalization across dialects.
   - Tests telemetry hooks (`onQueryStart`, `onQueryEnd`, `onQueryError`).
5. **DatabaseManager Tests (`manager.test.ts`)**:
   - Tests multiple named connections, default connections, health checks, and lifecycle shutdown.
6. **Error & Sanitization Tests (`errors.test.ts`)**:
   - Tests structured error properties and URL/config password masking.

## In-Memory Deterministic Driver

`MemoryDatabaseDriver` provides an in-memory SQL execution engine capable of table mutations, transaction snapshots, savepoint reverts, and simulated network delays/cancellations. This enables comprehensive testing without external database server dependencies.
