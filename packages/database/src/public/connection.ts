import type {
  DatabaseCapabilities,
  DatabaseResult,
  IDatabaseConnection,
  IDatabaseTransaction,
  IDriverConnection,
  QueryOptions,
  TransactionOptions,
} from './types.js';
import { ConnectionError, IsolationLevelUnsupportedError, QueryError } from './errors.js';
import { DatabaseTransaction } from './transaction.js';
import type { SqlDialect } from '../internal/dialect.js';
import type { ConnectionPool } from '../internal/pool.js';

export interface QueryTelemetryHook {
  onQueryStart?: (sql: string, params: readonly unknown[]) => void;
  onQueryEnd?: (sql: string, durationMs: number, rowCount: number) => void;
  onQueryError?: (sql: string, durationMs: number, error: unknown) => void;
}

export class DatabaseConnection implements IDatabaseConnection {
  private readonly rawConnection: IDriverConnection;
  private readonly pool: ConnectionPool;
  private readonly dialect: SqlDialect;
  private readonly capabilities: DatabaseCapabilities;
  private readonly driverName: string;
  private readonly telemetry?: QueryTelemetryHook | undefined;

  private released = false;
  private activeTransaction: DatabaseTransaction | null = null;

  constructor(
    rawConnection: IDriverConnection,
    pool: ConnectionPool,
    dialect: SqlDialect,
    capabilities: DatabaseCapabilities,
    driverName: string,
    telemetry?: QueryTelemetryHook
  ) {
    this.rawConnection = rawConnection;
    this.pool = pool;
    this.dialect = dialect;
    this.capabilities = capabilities;
    this.driverName = driverName;
    this.telemetry = telemetry;
  }

  public get isReleased(): boolean {
    return this.released;
  }

  public async ping(): Promise<boolean> {
    this.assertNotReleased();
    return this.rawConnection.ping();
  }

  public async query<T = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
    options?: QueryOptions
  ): Promise<DatabaseResult<T>> {
    this.assertNotReleased();

    const normalizedSql = this.dialect.normalizePlaceholders(sql);
    const startTime = Date.now();

    this.telemetry?.onQueryStart?.(normalizedSql, params ?? []);

    try {
      const result = await this.rawConnection.query<T>(normalizedSql, params, options);
      const duration = Date.now() - startTime;
      this.telemetry?.onQueryEnd?.(normalizedSql, duration, result.rowCount);
      return result;
    } catch (err) {
      const duration = Date.now() - startTime;
      this.telemetry?.onQueryError?.(normalizedSql, duration, err);

      if (err instanceof QueryError) {
        throw err;
      }

      throw new QueryError(
        `Database query failed: ${err instanceof Error ? err.message : String(err)}`,
        normalizedSql,
        err
      );
    }
  }

  public async beginTransaction(options?: TransactionOptions): Promise<IDatabaseTransaction> {
    this.assertNotReleased();

    if (this.activeTransaction && !this.activeTransaction.isCompleted) {
      throw new ConnectionError(
        'A transaction is already active on this connection. Nested transactions are not supported without savepoints.'
      );
    }

    if (options?.isolationLevel) {
      if (!this.capabilities.supportsIsolationLevels) {
        throw new IsolationLevelUnsupportedError(options.isolationLevel, this.driverName);
      }

      const supported = this.capabilities.supportedIsolationLevels ?? [];
      if (!supported.includes(options.isolationLevel)) {
        throw new IsolationLevelUnsupportedError(options.isolationLevel, this.driverName);
      }
    }

    let beginSql = 'BEGIN';
    if (options?.isolationLevel) {
      beginSql = `BEGIN TRANSACTION ISOLATION LEVEL ${options.isolationLevel}`;
    }

    await this.rawConnection.query(beginSql);

    const txId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const tx = new DatabaseTransaction(txId, this.rawConnection, this.dialect, () => {
      this.activeTransaction = null;
    });

    this.activeTransaction = tx;
    return tx;
  }

  public async transaction<T>(
    callback: (tx: IDatabaseTransaction) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T> {
    this.assertNotReleased();

    const tx = await this.beginTransaction(options);

    try {
      const result = await callback(tx);

      if (!tx.isCompleted) {
        await tx.commit();
      }

      return result;
    } catch (err) {
      if (!tx.isCompleted) {
        try {
          await tx.rollback();
        } catch {
          // Swallow rollback error in favor of throwing the original error
        }
      }
      throw err;
    }
  }

  public async release(): Promise<void> {
    if (this.released) {
      return;
    }

    this.released = true;

    // Rollback any uncommitted transaction before returning to pool
    if (this.activeTransaction && !this.activeTransaction.isCompleted) {
      try {
        await this.activeTransaction.rollback();
      } catch {
        // Ignore rollback failure during release
      }
      this.activeTransaction = null;
    }

    await this.pool.release(this.rawConnection);
  }

  private assertNotReleased(): void {
    if (this.released) {
      throw new ConnectionError('Database connection has already been released back to the pool.');
    }
  }
}
