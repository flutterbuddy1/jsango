# Distributed Migration Locking

The `MigrationLock` mechanism ensures that multiple application instances in a cluster or Kubernetes pod replica set cannot execute concurrent migrations.

## Schema

```sql
CREATE TABLE IF NOT EXISTS "jsango_migration_lock" (
  "id" VARCHAR(64) PRIMARY KEY,
  "is_locked" INTEGER NOT NULL,
  "owner_id" VARCHAR(255) NOT NULL,
  "acquired_at" VARCHAR(64) NOT NULL
);
```

## Concurrency & Stale Lock Recovery

- **Optimistic Concurrency**: Atomic SQL updates prevent competing processes from double-locking.
- **Stale Lock Recovery**: If an instance crashes while holding the lock, subsequent acquire attempts examine `acquired_at`. If `now - acquired_at > lockExpiryMs` (default 30,000ms), the lock is automatically reclaimed.
- **Timeouts**: Competing processes retry at `retryIntervalMs` (default 200ms) until `acquireTimeoutMs` (default 10,000ms) expires, then throw `MigrationLockedError`.
