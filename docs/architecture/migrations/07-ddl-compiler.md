# DDL SQL Compilation

The `SqlMigrationCompiler` compiles high-level `MigrationOperation` objects into dialect-specific SQL.

## Injection Defense

All table and column identifiers are validated against `/^[a-zA-Z_][a-zA-Z0-9_]*$/` before compilation. Any malicious or malformed identifier immediately raises a `MigrationError`.

## Dialect Support

- **PostgreSQL**: Standard ANSI double-quoting (`"table"`), `SERIAL`/`BIGSERIAL`, `JSONB`, `BOOLEAN`, `TIMESTAMP WITH TIME ZONE`.
- **SQLite**: Auto-increment keywords, dynamic typing, `DATETIME`, `TEXT`-based JSON.
- **Memory**: SQL standard compliant DDL statements.
