import type { IDatabaseConnection } from '@jsango/database';
import { MigrationLockedError } from './errors.js';

export interface MigrationLockOptions {
  readonly acquireTimeoutMs?: number | undefined;
  readonly lockExpiryMs?: number | undefined;
  readonly retryIntervalMs?: number | undefined;
  readonly ownerId?: string | undefined;
}

export class MigrationLock {
  public static readonly TABLE_NAME = 'jsango_migration_lock';
  private readonly connection: IDatabaseConnection;
  private readonly acquireTimeoutMs: number;
  private readonly lockExpiryMs: number;
  private readonly retryIntervalMs: number;
  private readonly ownerId: string;
  private isAcquired = false;

  public constructor(connection: IDatabaseConnection, options?: MigrationLockOptions) {
    this.connection = connection;
    this.acquireTimeoutMs = options?.acquireTimeoutMs ?? 10_000;
    this.lockExpiryMs = options?.lockExpiryMs ?? 30_000;
    this.retryIntervalMs = options?.retryIntervalMs ?? 200;
    this.ownerId =
      options?.ownerId ??
      `pid_${process.pid}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  public get currentOwnerId(): string {
    return this.ownerId;
  }

  public get isLocked(): boolean {
    return this.isAcquired;
  }

  public async ensureTable(): Promise<void> {
    await this.connection.query(`
      CREATE TABLE IF NOT EXISTS "${MigrationLock.TABLE_NAME}" (
        "id" VARCHAR(64) PRIMARY KEY,
        "is_locked" INTEGER NOT NULL,
        "owner_id" VARCHAR(255) NOT NULL,
        "acquired_at" VARCHAR(64) NOT NULL
      )
    `);
  }

  public async acquire(): Promise<void> {
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

    throw new MigrationLockedError(
      `Could not acquire migration lock within ${this.acquireTimeoutMs}ms. Another migration process may be running.`,
      this.ownerId,
      this.acquireTimeoutMs
    );
  }

  public async release(): Promise<void> {
    if (!this.isAcquired) {
      return;
    }

    try {
      await this.connection.query(
        `
        UPDATE "${MigrationLock.TABLE_NAME}"
        SET "is_locked" = 0, "owner_id" = '', "acquired_at" = ''
        WHERE "id" = ? AND "owner_id" = ?
      `,
        ['lock', this.ownerId]
      );
    } finally {
      this.isAcquired = false;
    }
  }

  public async withLock<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      await this.release();
    }
  }

  private async tryAcquire(): Promise<boolean> {
    const nowIso = new Date().toISOString();
    const nowMs = Date.now();

    // Check existing lock row
    const result = await this.connection.query<Record<string, unknown>>(
      `
      SELECT "is_locked", "owner_id", "acquired_at"
      FROM "${MigrationLock.TABLE_NAME}"
      WHERE "id" = ?
    `,
      ['lock']
    );

    if (result.rows.length === 0) {
      // First time initialize row
      try {
        await this.connection.query(
          `
          INSERT INTO "${MigrationLock.TABLE_NAME}" ("id", "is_locked", "owner_id", "acquired_at")
          VALUES (?, ?, ?, ?)
        `,
          ['lock', 1, this.ownerId, nowIso]
        );
        return true;
      } catch {
        // Race condition: another process inserted first
        return false;
      }
    }

    const row = result.rows[0]!;
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
      const updateResult = await this.connection.query(
        `
        UPDATE "${MigrationLock.TABLE_NAME}"
        SET "is_locked" = 1, "owner_id" = ?, "acquired_at" = ?
        WHERE "id" = ? AND ("is_locked" = 0 OR "acquired_at" = ?)
      `,
        [this.ownerId, nowIso, 'lock', acquiredAtStr]
      );

      return updateResult.rowCount > 0;
    }

    return false;
  }
}
