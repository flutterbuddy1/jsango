# Migration Runner & Execution Lifecycle

The `MigrationRunner` orchestrates the complete execution lifecycle.

## Public API

- `migrate(options)`: Executes all pending migrations under lock.
- `rollback(options)`: Reverses the latest batch or specified step count.
- `status()`: Returns applied, pending, and checksum verification status.
- `reset(options)`: Reverses all applied migrations requiring explicit confirmation (`confirm: 'YES_I_AM_SURE'`).

## Transaction Isolation & Capabilities

The runner inspects `driver.capabilities.supportsTransactionalDDL`:

- When `true`, each migration executes in its own transaction (`connection.transaction(...)`). Any failure triggers a clean rollback of both DDL and tracking records.
- When `false`, the migration executes directly, isolating any partial failure with explicit error reporting.
