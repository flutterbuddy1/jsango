import { AsyncLocalStorage } from 'node:async_hooks';
import { DatabaseManager, type IDatabaseTransaction, type TransactionOptions } from '@jsango/database';
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
 * Returns the active DatabaseManager. When none has been configured an in-memory database is
 * created so that quick experiments work, but applications should always call
 * setDatabaseManager() (the generated `src/database.ts` does this).
 */
export function getDatabaseManager(): DatabaseManager {
  let manager = globalState[MANAGER_KEY];
  if (!manager) {
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
 * Calling transaction() while one is already active on the same connection reuses it.
 */
export async function transaction<T>(
  callback: (tx: IDatabaseTransaction) => Promise<T>,
  options?: TransactionOptions & { readonly connection?: string | undefined }
): Promise<T> {
  const manager = getDatabaseManager();
  const connectionName = manager.resolveConnectionName(options?.connection);
  const current = transactionStorage().getStore();

  if (current && current.connectionName === connectionName && !current.tx.isCompleted) {
    return callback(current.tx);
  }

  const conn = await manager.connection(connectionName, { timeoutMs: options?.timeoutMs });
  try {
    return await conn.transaction(
      (tx) => transactionStorage().run({ connectionName, tx }, () => callback(tx)),
      options
    );
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
