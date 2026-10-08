import type { DatabaseManager, IDatabaseConnection } from '@jsango/database';
import { defaultMigrationRegistry, MigrationRegistry } from './registry.js';
import { MigrationStorage } from '../internal/storage.js';
import { MigrationLock, type MigrationLockOptions } from './lock.js';
import { MigrationContext, type Migration } from './migration.js';
import type {
  MigrateOptions,
  MigrationRecord,
  MigrationStatus,
  ResetOptions,
  RollbackOptions,
} from './types.js';
import {
  DestructiveMigrationError,
  IrreversibleMigrationError,
  MigrationError,
  MigrationNotFoundError,
} from './errors.js';
import { SchemaState } from './state.js';
import { compileMongoOperation } from '../internal/mongo-compiler.js';
import {
  SqlMigrationCompiler,
  SqliteRebuildRequired,
  toMigrationDialect,
  type MigrationDialect,
} from '../internal/compiler.js';

export interface MigrationPlanStep {
  readonly id: string;
  readonly name: string;
  readonly isDestructive: boolean;
  /** SQL the migration will run. Hand-written ctx.sql() statements are not included. */
  readonly statements: readonly string[];
}

export interface MigrationRunnerOptions {
  readonly databaseManager: DatabaseManager;
  readonly registry?: MigrationRegistry | undefined;
  /** Force a dialect. By default it is detected from each connection's driver. */
  readonly dialect?: MigrationDialect | undefined;
  readonly lock?: MigrationLockOptions | undefined;
  /** Called after each migration is applied or rolled back (for CLI progress output). */
  readonly onProgress?:
    | ((event: { type: 'applied' | 'rolledBack'; id: string; durationMs: number }) => void)
    | undefined;
}

export class MigrationRunner {
  private readonly databaseManager: DatabaseManager;
  private readonly registry: MigrationRegistry;
  private readonly forcedDialect: MigrationDialect | undefined;
  private readonly lockOptions: MigrationLockOptions | undefined;
  private readonly onProgress: MigrationRunnerOptions['onProgress'];

  public constructor(options: MigrationRunnerOptions) {
    this.databaseManager = options.databaseManager;
    this.registry = options.registry ?? defaultMigrationRegistry;
    this.forcedDialect = options.dialect;
    this.lockOptions = options.lock;
    this.onProgress = options.onProgress;
  }

  /** Canonical connection name ('default' resolves to the configured default connection). */
  public resolveConnection(name?: string): string {
    const manager = this.databaseManager as Partial<DatabaseManager>;
    if (typeof manager.resolveConnectionName === 'function') {
      return manager.resolveConnectionName(name);
    }
    return name ?? 'default';
  }

  /** Migration dialect of a connection, detected from its driver unless forced. */
  public getDialect(connectionName?: string): MigrationDialect {
    if (this.forcedDialect) return this.forcedDialect;
    const manager = this.databaseManager as Partial<DatabaseManager>;
    if (typeof manager.getDriverName === 'function') {
      return toMigrationDialect(manager.getDriverName(connectionName));
    }
    return 'memory';
  }

  /** Registered migrations that target a connection, in id order. */
  public migrationsFor(connectionName: string): readonly Migration[] {
    const resolved = this.resolveConnection(connectionName);
    return this.registry.getAllMigrations().filter((m) => {
      if (!m.connection) return true;
      try {
        return this.resolveConnection(m.connection) === resolved;
      } catch {
        return false;
      }
    });
  }

  public async status(connectionName?: string): Promise<MigrationStatus> {
    const name = this.resolveConnection(connectionName);
    return this.withConnection(name, async (conn) => {
      const applied = await MigrationStorage.getAppliedMigrations(conn);
      const appliedIds = new Set(applied.map((m) => m.id));

      const pending = this.migrationsFor(name).filter((m) => !appliedIds.has(m.id));
      const latestBatch = await MigrationStorage.getMaxBatch(conn);
      const currentVersion = applied.length > 0 ? applied[applied.length - 1]!.id : null;

      return {
        applied,
        pending,
        latestBatch,
        currentVersion,
        isUpToDate: pending.length === 0,
      };
    });
  }

  /**
   * Returns the pending migrations and the SQL each will execute, without changing anything.
   */
  public async plan(options?: MigrateOptions): Promise<readonly MigrationPlanStep[]> {
    const name = this.resolveConnection(options?.connection);
    const dialect = this.getDialect(name);
    const compiler = new SqlMigrationCompiler(dialect);
    const pending = await this.pendingMigrations(name, options?.target);

    const steps: MigrationPlanStep[] = [];
    const state = dialect === 'mongodb' ? await this.stateBefore(name, pending[0]?.id) : undefined;
    for (const migration of pending) {
      const statements: string[] = [];
      for (const op of await migration.collectOperations(dialect)) {
        if (state) {
          const before = state.clone();
          state.apply(op);
          for (const command of compileMongoOperation(op, before, state)) {
            statements.push(JSON.stringify(command));
          }
          continue;
        }
        try {
          statements.push(...compiler.compileStatements(op));
        } catch (err) {
          if (err instanceof SqliteRebuildRequired) {
            statements.push(`-- rebuild table "${err.tableName}" to apply ${op.type} (SQLite)`);
          } else {
            throw err;
          }
        }
      }
      steps.push({
        id: migration.id,
        name: migration.name,
        isDestructive: migration.isDestructive,
        statements: Object.freeze(statements),
      });
    }
    return Object.freeze(steps);
  }

  public async migrate(
    options?: MigrateOptions
  ): Promise<{ applied: readonly string[]; batch: number }> {
    const connectionName = this.resolveConnection(options?.connection);

    return this.withConnection(connectionName, async (conn) => {
      const lock = new MigrationLock(conn, this.lockOptions);

      return lock.withLock(async () => {
        const pending = await this.pendingMigrationsOn(conn, connectionName, options?.target);

        if (pending.length === 0) {
          const currentBatch = await MigrationStorage.getMaxBatch(conn);
          return { applied: Object.freeze([]), batch: currentBatch };
        }

        if (!options?.allowDestructive) {
          const destructiveMigrations = pending.filter((m) => m.isDestructive);
          if (destructiveMigrations.length > 0) {
            throw new DestructiveMigrationError(
              `Migration run contains destructive changes in migrations: ${destructiveMigrations.map((m) => m.id).join(', ')}. Review them, then pass allowDestructive: true (CLI: --yes) to proceed.`,
              destructiveMigrations.map((m) => m.id)
            );
          }
        }

        const dialect = this.getDialect(connectionName);
        const nextBatch = (await MigrationStorage.getMaxBatch(conn)) + 1;
        const newlyApplied: string[] = [];
        const schemaState =
          dialect === 'mongodb'
            ? await this.stateBefore(connectionName, pending[0]!.id)
            : undefined;

        for (const migration of pending) {
          const started = Date.now();
          try {
            await this.runInMigrationScope(conn, dialect, async (executor) => {
              await migration.up(new MigrationContext(executor, dialect, { schemaState }));
              await MigrationStorage.recordMigration(executor, migration, nextBatch);
            });
          } catch (err) {
            throw this.wrapFailure('apply', migration, dialect, newlyApplied, err);
          }
          newlyApplied.push(migration.id);
          this.onProgress?.({
            type: 'applied',
            id: migration.id,
            durationMs: Date.now() - started,
          });
        }

        return {
          applied: Object.freeze(newlyApplied),
          batch: nextBatch,
        };
      });
    });
  }

  public async rollback(options?: RollbackOptions): Promise<{ rolledBack: readonly string[] }> {
    const connectionName = this.resolveConnection(options?.connection);

    return this.withConnection(connectionName, async (conn) => {
      const lock = new MigrationLock(conn, this.lockOptions);

      return lock.withLock(async () => {
        const applied = await MigrationStorage.getAppliedMigrations(conn);
        if (applied.length === 0) {
          return { rolledBack: Object.freeze([]) };
        }

        let toRollback: readonly MigrationRecord[];

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

        const dialect = this.getDialect(connectionName);
        const rolledBackIds: string[] = [];
        const schemaState =
          dialect === 'mongodb' ? await this.stateThrough(applied.map((a) => a.id)) : undefined;

        // Execute in reverse order
        for (let i = migrationDefs.length - 1; i >= 0; i--) {
          const migration = migrationDefs[i]!;
          const started = Date.now();
          try {
            await this.runInMigrationScope(conn, dialect, async (executor) => {
              await migration.down(new MigrationContext(executor, dialect, { schemaState }));
              await MigrationStorage.removeMigration(executor, migration.id);
            });
          } catch (err) {
            throw this.wrapFailure('roll back', migration, dialect, rolledBackIds, err);
          }
          rolledBackIds.push(migration.id);
          this.onProgress?.({
            type: 'rolledBack',
            id: migration.id,
            durationMs: Date.now() - started,
          });
        }

        return { rolledBack: Object.freeze(rolledBackIds) };
      });
    });
  }

  public async reset(options: ResetOptions): Promise<{ rolledBack: readonly string[] }> {
    if (options.confirm !== 'YES_I_AM_SURE') {
      throw new MigrationError({
        message:
          "Database reset aborted. Explicit confirmation 'YES_I_AM_SURE' is required to prevent accidental data loss.",
      });
    }

    const connectionName = this.resolveConnection(options.connection);

    return this.withConnection(connectionName, async (conn) => {
      const lock = new MigrationLock(conn, this.lockOptions);

      return lock.withLock(async () => {
        const applied = await MigrationStorage.getAppliedMigrations(conn);
        const dialect = this.getDialect(connectionName);
        const rolledBackIds: string[] = [];
        const schemaState =
          dialect === 'mongodb' ? await this.stateThrough(applied.map((a) => a.id)) : undefined;

        // Rollback all applied migrations in reverse
        for (let i = applied.length - 1; i >= 0; i--) {
          const rec = applied[i]!;
          const def = this.registry.getMigration(rec.id);
          await this.runInMigrationScope(conn, dialect, async (executor) => {
            if (def) {
              await def.down(new MigrationContext(executor, dialect, { schemaState }));
            }
            // Remove tracking record even if definition not present during hard reset
            await MigrationStorage.removeMigration(executor, rec.id);
          });
          rolledBackIds.push(rec.id);
        }

        return { rolledBack: Object.freeze(rolledBackIds) };
      });
    });
  }

  /** Schema produced by every registered migration that sorts before `migrationId`. */
  private async stateBefore(
    connectionName: string,
    migrationId: string | undefined
  ): Promise<SchemaState> {
    const earlier = this.migrationsFor(connectionName).filter(
      (m) => migrationId === undefined || m.id.localeCompare(migrationId) < 0
    );
    return SchemaState.fromMigrations(earlier, this.getDialect(connectionName));
  }

  /** Schema produced by the given (applied) migrations, in id order. */
  private async stateThrough(ids: readonly string[]): Promise<SchemaState> {
    const defs = [...ids]
      .sort((a, b) => a.localeCompare(b))
      .map((id) => this.registry.getMigration(id))
      .filter((m): m is Migration => m !== undefined);
    return SchemaState.fromMigrations(defs);
  }

  private async pendingMigrations(connectionName: string, target?: string): Promise<Migration[]> {
    return this.withConnection(connectionName, (conn) =>
      this.pendingMigrationsOn(conn, connectionName, target)
    );
  }

  private async pendingMigrationsOn(
    conn: IDatabaseConnection,
    connectionName: string,
    target?: string
  ): Promise<Migration[]> {
    const appliedRecords = await MigrationStorage.getAppliedMigrations(conn);
    const appliedIds = new Set(appliedRecords.map((m) => m.id));
    let pending = this.migrationsFor(connectionName).filter((m) => !appliedIds.has(m.id));

    if (target) {
      const targetIdx = pending.findIndex((m) => m.id === target);
      if (targetIdx === -1 && !appliedIds.has(target)) {
        throw new MigrationNotFoundError(target);
      }
      pending = targetIdx !== -1 ? pending.slice(0, targetIdx + 1) : [];
    }
    return pending;
  }

  /**
   * Runs one migration step atomically where the database allows it.
   *
   * - PostgreSQL / SQLite: DDL is transactional, so schema changes and the history record commit
   *   or roll back together.
   * - MySQL: DDL auto-commits, so there is no transaction; a failure part-way through a migration
   *   leaves the earlier statements applied (keep MySQL migrations small).
   * - SQLite: foreign key enforcement is switched off for the step (required for table rebuilds)
   *   and `PRAGMA foreign_key_check` verifies integrity before committing.
   */
  private async runInMigrationScope(
    conn: IDatabaseConnection,
    dialect: MigrationDialect,
    step: (
      executor: IDatabaseConnection | import('@jsango/database').IDatabaseTransaction
    ) => Promise<void>
  ): Promise<void> {
    // MySQL auto-commits DDL; MongoDB cannot create collections/indexes inside most transactions.
    const transactional =
      dialect !== 'mysql' && dialect !== 'mongodb' && typeof conn.transaction === 'function';

    if (!transactional) {
      await step(conn);
      return;
    }

    if (dialect !== 'sqlite') {
      await conn.transaction(async (tx) => step(tx));
      return;
    }

    const fkBefore = await conn.query<Record<string, unknown>>('PRAGMA foreign_keys');
    const fkWasOn = Number(Object.values(fkBefore.rows[0] ?? {})[0] ?? 0) === 1;
    if (fkWasOn) await conn.query('PRAGMA foreign_keys = OFF');
    try {
      await conn.transaction(async (tx) => {
        await step(tx);
        const violations = await tx.query<Record<string, unknown>>('PRAGMA foreign_key_check');
        if (violations.rows.length > 0) {
          const first = violations.rows[0]!;
          throw new MigrationError({
            message: `Migration left ${violations.rows.length} foreign key violation(s), e.g. table '${String(first['table'])}' row ${String(first['rowid'])} references missing '${String(first['parent'])}'. The migration was rolled back.`,
          });
        }
      });
    } finally {
      if (fkWasOn) await conn.query('PRAGMA foreign_keys = ON');
    }
  }

  private wrapFailure(
    action: 'apply' | 'roll back',
    migration: Migration,
    dialect: MigrationDialect,
    completed: readonly string[],
    err: unknown
  ): MigrationError {
    const reason = (err instanceof Error ? err.message : String(err)).replace(/\.\s*$/, '');
    const done =
      completed.length > 0 ? ` Completed before the failure: ${completed.join(', ')}.` : '';
    const partial =
      dialect === 'mysql'
        ? ' MySQL cannot roll back DDL, so statements that ran before the error remain applied; fix the schema manually or adjust the migration before retrying.'
        : dialect === 'mongodb'
          ? ' MongoDB migrations are not transactional, so commands that ran before the error remain applied; fix the data or collection manually, or adjust the migration before retrying.'
          : ' Its changes were rolled back.';
    return new MigrationError({
      message: `Failed to ${action} migration '${migration.id}': ${reason}.${partial}${done}`,
      cause: err,
    });
  }

  private async withConnection<T>(
    connectionName: string,
    fn: (conn: IDatabaseConnection) => Promise<T>
  ): Promise<T> {
    const conn = await this.databaseManager.connection(connectionName);
    try {
      return await fn(conn);
    } finally {
      await conn.release();
    }
  }
}
