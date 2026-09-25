# Normalized Schema Model

The schema model defines an immutable, dialect-neutral representation of database structures.

## Primary Entities

- `SchemaSnapshot`: Top-level collection of tables, providing lookup, serialization, and structural checksums (`calculateChecksum()`).
- `TableSchema`: Represents a table with columns, primary keys, indexes, foreign keys, and unique constraints.
- `ColumnSchema`: Represents a normalized column with type, nullability, defaults, lengths, precisions, and constraints.
- `IndexSchema`: Defines composite indexes with uniqueness and sorting options.
- `ForeignKeySchema`: Relational integrity link with target table, referenced columns, and cascade actions.
- `UniqueConstraintSchema`: Multi-column unique constraints.

## Canonical Column Types

All database vendor types map to one of:
`string`, `text`, `integer`, `bigint`, `float`, `decimal`, `boolean`, `dateTime`, `date`, `time`, `json`, `uuid`, `binary`.
