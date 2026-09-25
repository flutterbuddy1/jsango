# ADR-010: Migration Architecture and Database Schema Management

## Status

Accepted

## Context

As the `jsango` framework advances to production readiness, database schemas must evolve deterministically across development, testing, staging, and multi-node production clusters.

The requirements for schema management in `jsango` are:

1. **Unidirectional Layering**: Zero dependencies on higher layers (HTTP, routing, controllers, validation, auth). Depend strictly on `@jsango/core`, `@jsango/database`, and `@jsango/orm`.
2. **Normalized Schema Representation**: Dialect-independent schema representation (`SchemaSnapshot`, `TableSchema`, `ColumnSchema`, `IndexSchema`, `ForeignKeySchema`, `UniqueConstraintSchema`) with deterministic structural hashing and equality.
3. **Deterministic Diff Engine**: Pure topological schema difference calculation producing a stable sequence of operations (table creation $\to$ columns $\to$ alterations $\to$ unique constraints $\to$ indexes $\to$ foreign keys $\to$ drops).
4. **Safety & Destructive Operation Guard**: Destructive operations (`DropTable`, `DropColumn`, incompatible alterations) must be rejected by default unless explicit override (`allowDestructive: true`) is provided.
5. **Reversibility**: Migrations must be reversible by default, with automatic inverse operation computation and rollback support by batch or step count.
6. **Distributed Concurrency Lock**: Multi-replica deployments must prevent concurrent migrations using distributed locking with stale lock recovery (`MigrationLock`).
7. **Dialect-Targeted DDL Compilation**: ANSI-quoted, dialect-specific SQL generation for PostgreSQL, SQLite, and in-memory mock drivers, with SQL injection defense via strict identifier validation.
8. **Drift Detection**: Programmatic comparison between live database introspection and declared ORM models to detect out-of-band schema alterations.

## Decisions

### 1. Architectural Pipeline

The schema lifecycle is structured as an explicit pipeline:

```
ORM Model Metadata
        ↓ (ModelSchemaConverter)
Schema Snapshot (Normalized)
        ↓ (SchemaDiffEngine)
Migration Operations (Typed, Reversible AST)
        ↓ (SqlMigrationCompiler & MigrationGenerator)
TypeScript Migration Files (.ts)
        ↓ (MigrationRegistry)
Migration Runner (Lock + Batch Storage + Transactional Boundaries)
        ↓
Target Database Engine
```

### 2. Schema Snapshot & Normalized Types

Schema state is captured as immutable `SchemaSnapshot` objects containing `TableSchema` definitions.

- Column types are normalized into canonical representations: `string`, `text`, `integer`, `bigint`, `float`, `decimal`, `boolean`, `dateTime`, `date`, `time`, `json`, `uuid`, `binary`.
- Each snapshot calculates an MD5/SHA-256 structural checksum independent of key ordering or whitespace.

### 3. Topological Diff Ordering

`SchemaDiffEngine` enforces a strict dependency order to prevent foreign key or column reference errors:

1. `CreateTableOperation`
2. `AddColumnOperation`
3. `AlterColumnOperation`
4. `CreateUniqueConstraintOperation`
5. `CreateIndexOperation`
6. `AddForeignKeyOperation`
7. `DropForeignKeyOperation`
8. `DropIndexOperation`
9. `DropUniqueConstraintOperation`
10. `DropColumnOperation`
11. `DropTableOperation`

### 4. Safety Guard Policy

Any migration containing destructive operations (`isDestructive: true`) throws `DestructiveMigrationError` unless `allowDestructive: true` is supplied. Database reset operations (`runner.reset()`) require explicit confirmation string `'YES_I_AM_SURE'`.

### 5. Distributed Locking

Migration execution is coordinated via `jsango_migration_lock`:

- Contains row `id = 'lock'`.
- Uses optimistic concurrency with timestamps.
- Automatically reclaims abandoned locks when elapsed time exceeds `lockExpiryMs` (default 30 seconds).

### 6. Transactional DDL Boundaries

Each migration executes within an isolated transaction if `driver.capabilities.supportsTransactionalDDL` is `true`. If transactional DDL is unsupported, operations execute directly on the connection with explicit error capture and state tracking.

## Consequences

- **Positive**: Complete schema reproducibility, zero external dependencies, robust production safety, deterministic ordering, and multi-replica concurrency safety.
- **Positive**: Clean foundation for future CLI commands (`jsango makemigrations`, `jsango migrate`) and Admin introspection.
- **Negative**: Full column introspection in production requires driver-specific metadata queries.
