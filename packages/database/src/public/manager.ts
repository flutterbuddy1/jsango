import type {
  DatabaseHealthResult,
  DatabaseResult,
  IDatabaseConnection,
  IDatabaseDriver,
  IDatabaseTransaction,
  QueryOptions,
  TransactionOptions,
} from './types.js';
import type { DatabaseConfig, ConnectionConfig } from './config.js';
import { DatabaseConfigurationError, DatabaseError } from './errors.js';
import { DatabaseConnection, type QueryTelemetryHook } from './connection.js';
import { ConnectionPool } from '../internal/pool.js';
import { SqlDialect } from '../internal/dialect.js';
import { MemoryDatabaseDriver } from '../internal/drivers/memory-driver.js';

export interface DatabaseManagerOptions {
  readonly telemetry?: QueryTelemetryHook | undefined;
}

export class DatabaseManager {
  private readonly config: DatabaseConfig;
  private readonly drivers = new Map<string, IDatabaseDriver>();
  private readonly pools = new Map<string, ConnectionPool>();
  private readonly dialects = new Map<string, SqlDialect>();
  private readonly telemetry?: QueryTelemetryHook | undefined;
  private closed = false;

  constructor(config: DatabaseConfig, options?: DatabaseManagerOptions) {
    this.config = config;
    this.telemetry = options?.telemetry;

    // Register built-in memory driver by default
    this.registerDriver('memory', new MemoryDatabaseDriver());
  }

  public registerDriver(name: string, driver: IDatabaseDriver): this {
    this.drivers.set(name.toLowerCase(), driver);
    return this;
  }

  public getDriver(name: string): IDatabaseDriver {
    const driver = this.drivers.get(name.toLowerCase());
    if (!driver) {
      throw new DatabaseConfigurationError(
        `Database driver "${name}" is not registered in DatabaseManager.`
      );
    }
    return driver;
  }

  /**
   * Acquires a DatabaseConnection from the specified (or default) named pool.
   * Callers must ensure `await connection.release()` is called when finished.
   */
  public async connection(
    name?: string,
    options?: { timeoutMs?: number | undefined; signal?: AbortSignal | undefined }
  ): Promise<IDatabaseConnection> {
    this.assertNotClosed();

    const connName = name ?? this.config.default;
    const pool = this.getOrCreatePool(connName);
    const connConfig = this.getConnectionConfig(connName);
    const driver = this.getDriver(connConfig.driver);
    const dialect = this.getOrCreateDialect(connConfig.driver, driver);

    const raw = await pool.acquire(options);

    return new DatabaseConnection(
      raw,
      pool,
      dialect,
      driver.capabilities,
      driver.name,
      this.telemetry
    );
  }

  /**
   * Acquires a DatabaseConnection from the default connection pool.
   */
  public async defaultConnection(options?: {
    timeoutMs?: number | undefined;
    signal?: AbortSignal | undefined;
  }): Promise<IDatabaseConnection> {
    return this.connection(this.config.default, options);
  }

  /**
   * High-level convenience method: acquires a connection, runs the query,
   * and guarantees release back to the pool in a finally block.
   */
  public async query<T = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
    options?: QueryOptions
  ): Promise<DatabaseResult<T>> {
    const conn = await this.defaultConnection({
      timeoutMs: options?.timeoutMs,
      signal: options?.signal,
    });
    try {
      return await conn.query<T>(sql, params, options);
    } finally {
      await conn.release();
    }
  }

  /**
   * High-level convenience method: acquires a connection, runs a scoped transaction,
   * commits or rolls back, and guarantees release back to the pool in a finally block.
   */
  public async transaction<T>(
    callback: (tx: IDatabaseTransaction) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T> {
    const conn = await this.defaultConnection({
      timeoutMs: options?.timeoutMs,
    });
    try {
      return await conn.transaction<T>(callback, options);
    } finally {
      await conn.release();
    }
  }

  /**
   * Performs a health check across all configured connections (or a specific named connection).
   */
  public async health(name?: string): Promise<DatabaseHealthResult[]> {
    const namesToCheck = name ? [name] : Object.keys(this.config.connections);
    const results: DatabaseHealthResult[] = [];

    for (const connName of namesToCheck) {
      const startTime = Date.now();
      try {
        const conn = await this.connection(connName, { timeoutMs: 3000 });
        try {
          await conn.query('SELECT 1');
          results.push({
            status: 'healthy',
            connectionName: connName,
            latencyMs: Date.now() - startTime,
          });
        } finally {
          await conn.release();
        }
      } catch (err) {
        results.push({
          status: 'unhealthy',
          connectionName: connName,
          latencyMs: Date.now() - startTime,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return results;
  }

  /**
   * Drains all connection pools and disconnects drivers for graceful application shutdown.
   */
  public async close(): Promise<void> {
    if (this.closed) {
      return;
    }

    this.closed = true;

    // Close all pools
    const poolCloses = Array.from(this.pools.values()).map((p) => p.close());
    await Promise.all(poolCloses);
    this.pools.clear();

    // Disconnect all drivers
    const driverDisconnects = Array.from(this.drivers.values()).map((d) => d.disconnect());
    await Promise.all(driverDisconnects);
    this.drivers.clear();
  }

  private getOrCreatePool(name: string): ConnectionPool {
    const existing = this.pools.get(name);
    if (existing) {
      return existing;
    }

    const connConfig = this.getConnectionConfig(name);
    const driver = this.getDriver(connConfig.driver);

    const pool = new ConnectionPool(() => driver.connect(), connConfig.pool, name);

    this.pools.set(name, pool);
    return pool;
  }

  private getOrCreateDialect(driverName: string, driver: IDatabaseDriver): SqlDialect {
    const existing = this.dialects.get(driverName);
    if (existing) {
      return existing;
    }

    const dialect = new SqlDialect(driver.capabilities.placeholderType);
    this.dialects.set(driverName, dialect);
    return dialect;
  }

  private getConnectionConfig(name: string): ConnectionConfig {
    const config = this.config.connections[name];
    if (!config) {
      throw new DatabaseConfigurationError(
        `Database connection "${name}" is not configured in DatabaseConfig.`
      );
    }
    return config;
  }

  private assertNotClosed(): void {
    if (this.closed) {
      throw new DatabaseError({
        code: 'ERR_DB_MANAGER_CLOSED',
        message: 'DatabaseManager has already been closed.',
      });
    }
  }
}
