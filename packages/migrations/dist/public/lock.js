import { MigrationLockedError } from './errors.js';
export class MigrationLock {
    static TABLE_NAME = 'jsango_migration_lock';
    connection;
    acquireTimeoutMs;
    lockExpiryMs;
    retryIntervalMs;
    ownerId;
    isAcquired = false;
    constructor(connection, options) {
        this.connection = connection;
        this.acquireTimeoutMs = options?.acquireTimeoutMs ?? 10_000;
        this.lockExpiryMs = options?.lockExpiryMs ?? 30_000;
        this.retryIntervalMs = options?.retryIntervalMs ?? 200;
        this.ownerId =
            options?.ownerId ??
                `pid_${process.pid}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    }
    get currentOwnerId() {
        return this.ownerId;
    }
    get isLocked() {
        return this.isAcquired;
    }
    async ensureTable() {
        await this.connection.query(`
      CREATE TABLE IF NOT EXISTS "${MigrationLock.TABLE_NAME}" (
        "id" VARCHAR(64) PRIMARY KEY,
        "is_locked" INTEGER NOT NULL,
        "owner_id" VARCHAR(255) NOT NULL,
        "acquired_at" VARCHAR(64) NOT NULL
      )
    `);
    }
    async acquire() {
        await this.ensureTable();
        const startTime = Date.now();
        while (Date.now() - startTime < this.acquireTimeoutMs) {
            const acquired = await this.tryAcquire();
            if (acquired) {
                this.isAcquired = true;
                return;
            }
            await new Promise((resolve) => setTimeout(resolve, this.retryIntervalMs));
        }
        throw new MigrationLockedError(`Could not acquire migration lock within ${this.acquireTimeoutMs}ms. Another migration process may be running.`, this.ownerId, this.acquireTimeoutMs);
    }
    async release() {
        if (!this.isAcquired) {
            return;
        }
        try {
            await this.connection.query(`
        UPDATE "${MigrationLock.TABLE_NAME}"
        SET "is_locked" = 0, "owner_id" = '', "acquired_at" = ''
        WHERE "id" = ? AND "owner_id" = ?
      `, ['lock', this.ownerId]);
        }
        finally {
            this.isAcquired = false;
        }
    }
    async withLock(fn) {
        await this.acquire();
        try {
            return await fn();
        }
        finally {
            await this.release();
        }
    }
    async tryAcquire() {
        const nowIso = new Date().toISOString();
        const nowMs = Date.now();
        // Check existing lock row
        const result = await this.connection.query(`
      SELECT "is_locked", "owner_id", "acquired_at"
      FROM "${MigrationLock.TABLE_NAME}"
      WHERE "id" = ?
    `, ['lock']);
        if (result.rows.length === 0) {
            // First time initialize row
            try {
                await this.connection.query(`
          INSERT INTO "${MigrationLock.TABLE_NAME}" ("id", "is_locked", "owner_id", "acquired_at")
          VALUES (?, ?, ?, ?)
        `, ['lock', 1, this.ownerId, nowIso]);
                return true;
            }
            catch {
                // Race condition: another process inserted first
                return false;
            }
        }
        const row = result.rows[0];
        const isLocked = Number(row['is_locked'] ?? 0) === 1;
        const lockOwner = String(row['owner_id'] ?? '');
        const acquiredAtStr = String(row['acquired_at'] ?? '');
        const acquiredAtMs = acquiredAtStr ? new Date(acquiredAtStr).getTime() : 0;
        // If locked by this same instance
        if (isLocked && lockOwner === this.ownerId) {
            return true;
        }
        // Check for stale lock recovery
        const isStale = isLocked && nowMs - acquiredAtMs > this.lockExpiryMs;
        if (!isLocked || isStale) {
            // Update lock row
            const updateResult = await this.connection.query(`
        UPDATE "${MigrationLock.TABLE_NAME}"
        SET "is_locked" = 1, "owner_id" = ?, "acquired_at" = ?
        WHERE "id" = ? AND ("is_locked" = 0 OR "acquired_at" = ?)
      `, [this.ownerId, nowIso, 'lock', acquiredAtStr]);
            return updateResult.rowCount > 0;
        }
        return false;
    }
}
//# sourceMappingURL=lock.js.map