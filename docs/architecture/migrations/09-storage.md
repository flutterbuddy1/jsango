# Migration Tracking Table & Storage

The `MigrationStorage` component tracks applied migrations using the `jsango_migrations` metadata table.

## Schema

```sql
CREATE TABLE IF NOT EXISTS "jsango_migrations" (
  "id" VARCHAR(255) PRIMARY KEY,
  "name" VARCHAR(255) NOT NULL,
  "applied_at" VARCHAR(64) NOT NULL,
  "batch" INTEGER NOT NULL,
  "checksum" VARCHAR(64)
);
```

## Batch Management

- Each migration execution increments the global batch counter (`max_batch + 1`).
- Rollback operations target migrations by batch or step count, maintaining atomicity.
