# Database Schema Introspection

The `SchemaIntrospector` subsystem queries live database metadata to construct a `SchemaSnapshot`.

## Dialect Introspectors

- `PostgresSchemaIntrospector`: Queries `information_schema.tables`, `information_schema.columns`, and PostgreSQL system catalogs.
- `SqliteSchemaIntrospector`: Queries `sqlite_master`, `PRAGMA table_info`, and `PRAGMA index_list`.
- `MemorySchemaIntrospector`: Introspects driver in-memory table structures for unit and integration testing.

## Introspector Facade

`SchemaIntrospector` automatically delegates to the appropriate introspector based on the target connection or driver dialect.
