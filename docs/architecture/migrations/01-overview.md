# Migration System Overview

The `@django-js/migrations` package provides enterprise-grade, deterministic database schema evolution for the `django-js` framework.

## Core Responsibilities

- **Model-to-Schema Mapping**: Convert ORM `ModelMetadata` into normalized `SchemaSnapshot`.
- **Introspection**: Read live database state into canonical `SchemaSnapshot` structures.
- **Diffing**: Topologically sort schema differences into reversible `MigrationOperation` ASTs.
- **Compilation**: Compile operations to ANSI-quoted dialect-specific SQL (Postgres, SQLite, Memory).
- **Generation**: Produce human-readable, typed TypeScript migration files with checksum verification.
- **Execution & Storage**: Coordinate execution, batching, tracking table (`django_js_migrations`), and distributed locking (`django_js_migration_lock`).
- **Drift Detection**: Verify that active schemas match declared models.

## Architectural Boundaries

```
@django-js/core
      ↓
@django-js/database
      ↓
@django-js/orm
      ↓
@django-js/migrations
```

`@django-js/migrations` strictly obeys unidirectional dependency flow and contains zero external runtime dependencies.
