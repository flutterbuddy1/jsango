import type { DatabaseManager, IDatabaseConnection } from '@django-js/database';
import { defaultMigrationRegistry, MigrationRegistry } from './registry.js';
import { MigrationStorage } from '../internal/storage.js';
import { MigrationLock } from './lock.js';
import { MigrationContext, type Migration } from './migration.js';
import type { MigrateOptions, MigrationStatus, ResetOptions, RollbackOptions } from './types.js';
import {
  DestructiveMigrationError,
  IrreversibleMigrationError,
  MigrationError,
  MigrationNotFoundError,
} from './errors.js';
import type { MigrationDialect } from '../internal/compiler.js';

export class MigrationRunner {
  private readonly databaseManager: DatabaseManager;
  private readonly registry: MigrationRegistry;
  private readonly dialect: MigrationDialect;

  public constructor(options: {
    databaseManager: DatabaseManager;
    registry?: MigrationRegistry | undefined;
    dialect?: MigrationDialect | undefined;
  }) {
    this.databaseManager = options.databaseManager;
    this.registry = options.registry ?? defaultMigrationRegistry;
    this.dialect = options.dialect ?? 'memory';
  }

  public async status(connectionName = 'default'): Promise<MigrationStatus> {
    const conn = await this.databaseManager.connection(connectionName);
    try {
      const applied = await MigrationStorage.getAppliedMigrations(conn);
      const appliedIds = new Set(applied.map((m) => m.id));

      const allRegistered = this.registry.getAllMigrations(connectionName);
      const pending = allRegistered.filter((m) => !appliedIds.has(m.id));
      const latestBatch = await MigrationStorage.getMaxBatch(conn);
      const currentVersion = applied.length > 0 ? applied[applied.length - 1]!.id : null;

      return {
        applied,
        pending,
        latestBatch,
        currentVersion,
        isUpToDate: pending.length === 0,
      };
    } finally {
      if ('release' in conn && typeof conn.release === 'function') {
        await conn.release();
      }
    }
  }

  public async migrate(
    options?: MigrateOptions
  ): Promise<{ applied: readonly string[]; batch: number }> {
    const connectionName = options?.connection ?? 'default';
    const conn = await this.databaseManager.connection(connectionName);

    try {
      const lock = new MigrationLock(conn);

      return await lock.withLock(async () => {
        const appliedRecords = await MigrationStorage.getAppliedMigrations(conn);
        const appliedIds = new Set(appliedRecords.map((m) => m.id));

        let pending = this.registry
          .getAllMigrations(connectionName)
          .filter((m) => !appliedIds.has(m.id));

        if (options?.target) {
          const targetIdx = pending.findIndex((m) => m.id === options.target);
          if (targetIdx === -1 && !appliedIds.has(options.target)) {
            throw new MigrationNotFoundError(options.target);
          }
          if (targetIdx !== -1) {
            pending = pending.slice(0, targetIdx + 1);
          }
        }

        if (pending.length === 0) {
          const currentBatch = await MigrationStorage.getMaxBatch(conn);
          return { applied: Object.freeze([]), batch: currentBatch };
        }

        // Check for destructive operations
        if (!options?.allowDestructive) {
          const destructiveMigrations = pending.filter((m) => m.isDestructive);
          if (destructiveMigrations.length > 0) {
            throw new DestructiveMigrationError(
              `Migration run contains destructive changes in migrations: ${destructiveMigrations.map((m) => m.id).join(', ')}. Pass allowDestructive: true to proceed.`,
              destructiveMigrations.map((m) => m.id)
            );
          }
        }

        const nextBatch = (await MigrationStorage.getMaxBatch(conn)) + 1;
        const newlyApplied: string[] = [];

        for (const migration of pending) {
          await this.executeSingleMigration(conn, migration, nextBatch);
          newlyApplied.push(migration.id);
        }

        return {
          applied: Object.freeze(newlyApplied),
          batch: nextBatch,
        };
      });
    } finally {
      if ('release' in conn && typeof conn.release === 'function') {
        await conn.release();
      }
    }
  }

  public async rollback(options?: RollbackOptions): Promise<{ rolledBack: readonly string[] }> {
    const connectionName = options?.connection ?? 'default';
    const conn = await this.databaseManager.connection(connectionName);

    try {
      const lock = new MigrationLock(conn);

      return await lock.withLock(async () => {
        const applied = await MigrationStorage.getAppliedMigrations(conn);
        if (applied.length === 0) {
          return { rolledBack: Object.freeze([]) };
        }

        let toRollback: readonly (typeof applied)[0][];

        if (options?.target) {
          const targetIdx = applied.findIndex((m) => m.id === options.target);
          if (targetIdx === -1) {
            throw new MigrationNotFoundError(options.target);
          }
          // Rollback all migrations after target
          toRollback = applied.slice(targetIdx + 1);
        } else if (options?.steps !== undefined) {
          toRollback = applied.slice(-Math.max(1, options.steps));
        } else {
          // Default: rollback latest batch
          const latestBatch = await MigrationStorage.getMaxBatch(conn);
          toRollback = applied.filter((m) => m.batch === latestBatch);
        }

        if (toRollback.length === 0) {
          return { rolledBack: Object.freeze([]) };
        }

        // Fetch migration definitions and verify reversibility
        const migrationDefs: Migration[] = [];
        for (const rec of toRollback) {
          const def = this.registry.getMigration(rec.id);
          if (!def) {
            throw new MigrationNotFoundError(
              `Migration definition for applied migration '${rec.id}' not found in registry.`
            );
          }
          if (!def.isReversible && !options?.allowDestructive) {
            throw new IrreversibleMigrationError(def.id);
          }
          migrationDefs.push(def);
        }

        const rolledBackIds: string[] = [];

        // Execute in reverse order
        for (let i = migrationDefs.length - 1; i >= 0; i--) {
          const migration = migrationDefs[i]!;
          await this.executeSingleRollback(conn, migration);
          rolledBackIds.push(migration.id);
        }

        return { rolledBack: Object.freeze(rolledBackIds) };
      });
    } finally {
      if ('release' in conn && typeof conn.release === 'function') {
        await conn.release();
      }
    }
  }

  public async reset(options: ResetOptions): Promise<{ rolledBack: readonly string[] }> {
    if (options.confirm !== 'YES_I_AM_SURE') {
      throw new MigrationError({
        message:
          "Database reset aborted. Explicit confirmation 'YES_I_AM_SURE' is required to prevent accidental data loss.",
      });
    }

    const connectionName = options.connection ?? 'default';
    const conn = await this.databaseManager.connection(connectionName);

    try {
      const lock = new MigrationLock(conn);

      return await lock.withLock(async () => {
        const applied = await MigrationStorage.getAppliedMigrations(conn);
        const rolledBackIds: string[] = [];

        // Rollback all applied migrations in reverse
        for (let i = applied.length - 1; i >= 0; i--) {
          const rec = applied[i]!;
          const def = this.registry.getMigration(rec.id);
          if (def) {
            await this.executeSingleRollback(conn, def);
          } else {
            // Remove tracking record even if definition not present during hard reset
            await MigrationStorage.removeMigration(conn, rec.id);
          }
          rolledBackIds.push(rec.id);
        }

        return { rolledBack: Object.freeze(rolledBackIds) };
      });
    } finally {
      if ('release' in conn && typeof conn.release === 'function') {
        await conn.release();
      }
    }
  }

  private async executeSingleMigration(
    conn: IDatabaseConnection,
    migration: Migration,
    batch: number
  ): Promise<void> {
    const ctx = new MigrationContext(conn, this.dialect);

    // If connection supports transactions, execute inside atomic boundary
    if ('transaction' in conn && typeof conn.transaction === 'function') {
      await conn.transaction(async (tx) => {
        const txCtx = new MigrationContext(tx, this.dialect);
        await migration.up(txCtx);
        await MigrationStorage.recordMigration(tx, migration, batch);
      });
    } else {
      await migration.up(ctx);
      await MigrationStorage.recordMigration(conn, migration, batch);
    }
  }

  private async executeSingleRollback(
    conn: IDatabaseConnection,
    migration: Migration
  ): Promise<void> {
    const ctx = new MigrationContext(conn, this.dialect);

    if ('transaction' in conn && typeof conn.transaction === 'function') {
      await conn.transaction(async (tx) => {
        const txCtx = new MigrationContext(tx, this.dialect);
        await migration.down(txCtx);
        await MigrationStorage.removeMigration(tx, migration.id);
      });
    } else {
      await migration.down(ctx);
      await MigrationStorage.removeMigration(conn, migration.id);
    }
  }
}
