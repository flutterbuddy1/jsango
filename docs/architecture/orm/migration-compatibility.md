# Migration Compatibility

## Architectural Role in Future Migrations (Phase 7)

Phase 7 will introduce automated schema migrations (`makemigrations`, `migrate`).

The migration engine will consume `ModelMetadata` as the single source of truth for the desired database schema:

```
Model Definition
      ↓
Model Metadata (ModelMetadata)
      ↓
Schema State Generator (Phase 7)
      ↓
Schema Differ (Phase 7)
      ↓
Migration Files
```

---

## Schema Information Derived from Metadata

Every `ModelMetadata` instance provides all information required to construct database DDL statements:

1. **Table Identity**:
   - `metadata.table`: Target database table name.
   - `metadata.connection`: Target connection pool.
2. **Column Definitions**:
   - `field.columnName`: Physical column name.
   - `field.type`: Field data type mapping (`string` -> `VARCHAR`, `integer` -> `INT`, `dateTime` -> `TIMESTAMP`).
   - `field.length`: Column length / precision / scale.
   - `field.nullable`: `NOT NULL` constraint.
   - `field.defaultValue`: Column default value.
   - `field.primaryKey`: Primary key constraint.
   - `field.autoIncrement`: Serial / Auto-incrementing sequences.
3. **Constraints & Indexes**:
   - `field.unique`: Unique constraints.
   - `field.indexed`: Single-column indexes.
   - `metadata.indexes`: Multi-column indexes and named composite constraints.
4. **Foreign Key Constraints**:
   - `relation.foreignKey`: Foreign key constraint referencing target table and `relation.localKey`.
5. **Special Columns**:
   - `metadata.timestamps`: `createdAt` and `updatedAt` timestamp columns.
   - `metadata.softDelete`: `deletedAt` nullable timestamp column.

By exposing this rich, deterministic metadata structure, Phase 7 Migrations can be implemented cleanly without touching `@django-js/orm` internals.
