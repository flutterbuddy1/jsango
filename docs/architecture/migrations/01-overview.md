# Migration System Overview

The `@jsango/migrations` package provides enterprise-grade, deterministic database schema evolution for the `jsango` framework.

## Core Responsibilities

- **Model-to-Schema Mapping**: Convert ORM `ModelMetadata` into normalized `SchemaSnapshot`.
- **Introspection**: Read live database state into canonical `SchemaSnapshot` structures.
- **Diffing**: Topologically sort schema differences into reversible `MigrationOperation` ASTs.
- **Compilation**: Compile operations to ANSI-quoted dialect-specific SQL (Postgres, SQLite, Memory).
- **Generation**: Produce human-readable, typed TypeScript migration files with checksum verification.
- **Execution & Storage**: Coordinate execution, batching, tracking table (`jsango_migrations`), and distributed locking (`jsango_migration_lock`).
- **Drift Detection**: Verify that active schemas match declared models.

## Architectural Boundaries

```
@jsango/core
      ↓
@jsango/database
      ↓
@jsango/orm
      ↓
@jsango/migrations
```

`@jsango/migrations` strictly obeys unidirectional dependency flow and contains zero external runtime dependencies.
