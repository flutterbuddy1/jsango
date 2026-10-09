import { isProductionEnv } from '@jsango/core';
import { AsyncLocalStorage } from 'node:async_hooks';
import {
  DatabaseManager,
  type IDatabaseTransaction,
  type TransactionOptions,
} from '@jsango/database';
import type { QueryContext } from './types.js';

/**
 * The active manager lives on globalThis so that the application, the CLI and any duplicated
 * copies of this package in node_modules all see the same database configuration.
 */
const MANAGER_KEY = Symbol.for('jsango.orm.databaseManager');
const TX_STORAGE_KEY = Symbol.for('jsango.orm.transactionStorage');

interface GlobalState {
  [MANAGER_KEY]?: DatabaseManager | undefined;
  [TX_STORAGE_KEY]?: AsyncLocalStorage<AmbientTransaction> | undefined;
}

interface AmbientTransaction {
  readonly connectionName: string;
  readonly tx: IDatabaseTransaction;
  /** Nesting depth, for unique savepoint names. */
  depth: number;
  /** A nested transaction failed on a database without savepoints (MongoDB). */
  failed: boolean;
}

const globalState = globalThis as unknown as GlobalState;

function transactionStorage(): AsyncLocalStorage<AmbientTransaction> {
  let storage = globalState[TX_STORAGE_KEY];
  if (!storage) {
    storage = new AsyncLocalStorage<AmbientTransaction>();
    globalState[TX_STORAGE_KEY] = storage;
  }
  return storage;
}

/**
 * Registers the DatabaseManager used by all models that are not given an explicit connection.
 */
export function setDatabaseManager(manager: DatabaseManager): void {
  globalState[MANAGER_KEY] = manager;
}

/**
 * Returns the active DatabaseManager. When none has been configured, development and tests get an
 * in-memory database so quick experiments work; production throws. Applications should always call
 * setDatabaseManager() (the generated `src/database.ts` does this).
 */
export function getDatabaseManager(): DatabaseManager {
  let manager = globalState[MANAGER_KEY];
  if (!manager) {
    // In production a forgotten setDatabaseManager() would silently keep data in memory and lose
    // it on restart: fail loudly instead.
    if (isProductionEnv()) {
      throw new Error(
        'No database configured: call setDatabaseManager() (see src/database.ts). The in-memory fallback only runs with NODE_ENV=development or test.'
      );
    }
    manager = new DatabaseManager({
      default: 'default',
      connections: {
        default: {
          driver: 'memory',
        },
      },
    });
    globalState[MANAGER_KEY] = manager;
  }
  return manager;
}

/** Returns true when an application-provided DatabaseManager has been registered. */
export function hasDatabaseManager(): boolean {
  return globalState[MANAGER_KEY] !== undefined;
}

export function clearDatabaseManager(): void {
  globalState[MANAGER_KEY] = undefined;
}

/**
 * Runs `callback` inside a database transaction. Every model operation inside the callback —
 * including nested async calls — automatically uses the transaction, so there is no need to pass
 * the transaction object around. The transaction commits when the callback resolves and rolls
 * back when it throws.
 *
 * ```ts
 * await transaction(async () => {
 *   const user = await User.create({ email });
 *   await Profile.create({ userId: user.id });
 * });
 * ```
 *
 * Calling transaction() while one is already active on the same connection runs it in a savepoint:
 * if the inner callback throws, only its changes are undone. On MongoDB (no savepoints) the whole
 * outer transaction is rolled back instead.
 */
export async function transaction<T>(
  callback: (tx: IDatabaseTransaction) => Promise<T>,
  options?: TransactionOptions & { readonly connection?: string | undefined }
): Promise<T> {
  const manager = getDatabaseManager();
  const connectionName = manager.resolveConnectionName(options?.connection);
  const current = transactionStorage().getStore();

  if (current && current.connectionName === connectionName && !current.tx.isCompleted) {
    const name = `jsango_sp_${++current.depth}`;
    // Without a savepoint, a caught inner error would let the outer transaction commit a
    // half-applied change (Postgres even turns that COMMIT into a silent ROLLBACK).
    const hasSavepoint = await current.tx.savepoint(name).then(
      () => true,
      () => false
    );
    try {
      const result = await callback(current.tx);
      if (hasSavepoint) await current.tx.releaseSavepoint(name);
      return result;
    } catch (err) {
      if (hasSavepoint) await current.tx.rollbackTo(name);
      else current.failed = true;
      throw err;
    } finally {
      current.depth--;
    }
  }

  const conn = await manager.connection(connectionName, { timeoutMs: options?.timeoutMs });
  try {
    return await conn.transaction(async (tx) => {
      const ambient: AmbientTransaction = { connectionName, tx, depth: 0, failed: false };
      const result = await transactionStorage().run(ambient, () => callback(tx));
      if (ambient.failed) {
        throw new Error(
          'A nested transaction failed and this database has no savepoints: the whole transaction was rolled back.'
        );
      }
      return result;
    }, options);
  } finally {
    await conn.release();
  }
}

/** Returns the transaction active in the current async context, if any. */
export function getActiveTransaction(connection?: string): IDatabaseTransaction | undefined {
  const current = transactionStorage().getStore();
  if (!current || current.tx.isCompleted) return undefined;
  if (connection !== undefined) {
    const manager = getDatabaseManager();
    if (manager.resolveConnectionName(connection) !== current.connectionName) return undefined;
  }
  return current.tx;
}

/**
 * Runs `fn` with an explicit context, the ambient transaction, or a pooled connection for the
 * given connection name (released afterwards).
 */
export async function withQueryContext<T>(
  explicit: QueryContext | undefined,
  connectionName: string | undefined,
  fn: (conn: QueryContext) => Promise<T>
): Promise<T> {
  if (explicit) {
    return fn(explicit);
  }

  const ambient = getActiveTransaction(connectionName);
  if (ambient) {
    return fn(ambient);
  }

  const manager = getDatabaseManager();
  const conn = await manager.connection(connectionName);
  try {
    return await fn(conn);
  } finally {
    await conn.release();
  }
}
