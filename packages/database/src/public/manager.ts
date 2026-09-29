import type {
  DatabaseHealthResult,
  DatabaseResult,
  IDatabaseConnection,
  IDatabaseDriver,
  IDatabaseTransaction,
  QueryOptions,
  TransactionOptions,
} from './types.js';
import type { DatabaseConfig, ConnectionConfig, PoolConfig } from './config.js';
import { resolveConnectionConfig } from './config.js';
import { DatabaseConfigurationError, DatabaseError } from './errors.js';
import { DatabaseConnection, type QueryTelemetryHook } from './connection.js';
import { ConnectionPool } from '../internal/pool.js';
import { MemoryDatabaseDriver } from '../internal/drivers/memory-driver.js';
import { createDialect, type SqlDialect } from './dialect.js';
import { PostgresDatabaseDriver } from '../internal/drivers/postgres-driver.js';
import { MysqlDatabaseDriver } from '../internal/drivers/mysql-driver.js';
import { SqliteDatabaseDriver } from '../internal/drivers/sqlite-driver.js';
import { MongoDatabaseDriver } from '../internal/drivers/mongo-driver.js';

export interface DatabaseManagerOptions {
  readonly telemetry?: QueryTelemetryHook | undefined;
}

type ResolvedConnectionConfig = ConnectionConfig & { driver: string };

export class DatabaseManager {
  private readonly config: DatabaseConfig & {
    readonly connections: Record<string, ResolvedConnectionConfig>;
  };
  private readonly drivers = new Map<string, IDatabaseDriver>();
  private readonly driverFactories = new Map<string, (config: ConnectionConfig) => IDatabaseDriver>();
  private readonly connectionDrivers = new Map<string, IDatabaseDriver>();
  private readonly pools = new Map<string, ConnectionPool>();
  private readonly dialects = new Map<string, SqlDialect>();
  private readonly telemetry?: QueryTelemetryHook | undefined;
  private closed = false;

  constructor(config: DatabaseConfig, options?: DatabaseManagerOptions) {
    if (!config || typeof config !== 'object' || !config.connections) {
      throw new DatabaseConfigurationError(
        'DatabaseManager requires a config of the form { default: "default", connections: { default: { driver: "sqlite", filename: "./db.sqlite3" } } }.'
      );
    }

    const connections: Record<string, ResolvedConnectionConfig> = {};
    for (const [name, conn] of Object.entries(config.connections)) {
      connections[name] = resolveConnectionConfig(name, conn);
    }

    const names = Object.keys(connections);
    const defaultName = config.default || (names.includes('default') ? 'default' : names[0]);
    if (!defaultName || !connections[defaultName]) {
      throw new DatabaseConfigurationError(
        `Default database connection "${config.default}" is not defined. Configured connections: ${names.join(', ') || '(none)'}.`
      );
    }

    this.config = { default: defaultName, connections };
    this.telemetry = options?.telemetry;

    // Register built-in drivers by default
    this.registerDriverFactory('memory', () => new MemoryDatabaseDriver());
    this.registerDriverFactory('sqlite', (config) => new SqliteDatabaseDriver(config));
    this.registerDriverFactory('sqlite3', (config) => new SqliteDatabaseDriver(config));
    this.registerDriverFactory('postgres', (config) => new PostgresDatabaseDriver(config));
    this.registerDriverFactory('postgresql', (config) => new PostgresDatabaseDriver(config));
    this.registerDriverFactory('pg', (config) => new PostgresDatabaseDriver(config));
    this.registerDriverFactory('mysql', (config) => new MysqlDatabaseDriver(config));
    this.registerDriverFactory('mariadb', (config) => new MysqlDatabaseDriver(config));
    this.registerDriverFactory('mongodb', (config) => new MongoDatabaseDriver(config));
    this.registerDriverFactory('mongo', (config) => new MongoDatabaseDriver(config));
  }

  public registerDriver(name: string, driver: IDatabaseDriver): this {
    const key = name.toLowerCase();
    this.drivers.set(key, driver);
    this.driverFactories.set(key, () => driver);
    return this;
  }

  private registerDriverFactory(name: string, factory: (config: ConnectionConfig) => IDatabaseDriver): void {
    this.driverFactories.set(name, factory);
  }

  public getDriver(name: string): IDatabaseDriver {
    const key = name.toLowerCase();
    const driver = this.drivers.get(key);
    if (!driver) {
      const configured = Object.entries(this.config.connections).find(
        ([connectionName, config]) =>
          config.driver.toLowerCase() === key && this.connectionDrivers.has(connectionName)
      );
      if (configured) return this.connectionDrivers.get(configured[0])!;
      const configuredConnection = Object.entries(this.config.connections).find(
        ([, config]) => config.driver.toLowerCase() === key
      );
      const factory = this.driverFactories.get(key);
      if (configuredConnection && factory) {
        return this.getConnectionDriver(configuredConnection[0], configuredConnection[1]);
      }
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

    const connName = this.resolveConnectionName(name);
    const pool = this.getOrCreatePool(connName);
    const connConfig = this.getNamedConfig(connName);
    const driver = this.getConnectionDriver(connName, connConfig);
    const dialect = this.getOrCreateDialect(connName, driver);

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

  /** Name of the default connection. */
  public get defaultConnectionName(): string {
    return this.config.default;
  }

  /** Names of all configured connections. */
  public get connectionNames(): readonly string[] {
    return Object.freeze(Object.keys(this.config.connections));
  }

  /** Returns true when a connection with this name is configured. */
  public hasConnection(name: string): boolean {
    return name in this.config.connections;
  }

  /**
   * Resolves a connection name, falling back to the default connection.
   * The name 'default' always resolves to the configured default connection, so models and
   * migrations that do not name a connection work regardless of what it is called.
   */
  public resolveConnectionName(name?: string): string {
    if (!name) return this.config.default;
    if (this.config.connections[name]) return name;
    if (name === 'default') return this.config.default;
    throw new DatabaseConfigurationError(
      `Database connection "${name}" is not configured. Configured connections: ${Object.keys(this.config.connections).join(', ')}.`
    );
  }

  /** Returns the (masked-at-log-time) configuration for a connection. */
  public getConnectionConfig(name?: string): ConnectionConfig & { driver: string } {
    return this.config.connections[this.resolveConnectionName(name)]!;
  }

  /** Canonical driver name for a connection: 'postgres', 'mysql', 'sqlite', 'memory', ... */
  public getDriverName(name?: string): string {
    const connName = this.resolveConnectionName(name);
    return this.getConnectionDriver(connName, this.config.connections[connName]!).name;
  }

  /** SQL dialect (quoting, placeholders, RETURNING support) for a connection. */
  public getDialect(name?: string): SqlDialect {
    const connName = this.resolveConnectionName(name);
    const config = this.config.connections[connName]!;
    const driver = this.getConnectionDriver(connName, config);
    return this.getOrCreateDialect(connName, driver);
  }

  /**
   * Opens a connection and runs `SELECT 1`, throwing a descriptive ConnectionError on failure.
   * Call it at application startup to fail fast on bad credentials or an unreachable server.
   */
  public async verify(name?: string): Promise<void> {
    const conn = await this.connection(name);
    try {
      await conn.query('SELECT 1');
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
    const driverDisconnects = Array.from(
      new Set([...this.drivers.values(), ...this.connectionDrivers.values()])
    ).map((d) => d.disconnect());
    await Promise.all(driverDisconnects);
    this.drivers.clear();
    this.connectionDrivers.clear();
  }

  private getOrCreatePool(name: string): ConnectionPool {
    const existing = this.pools.get(name);
    if (existing) {
      return existing;
    }

    const connConfig = this.getNamedConfig(name);
    const driver = this.getConnectionDriver(name, connConfig);

    const pool = new ConnectionPool(
      () => driver.connect(),
      this.resolvePoolConfig(connConfig, driver),
      name
    );

    this.pools.set(name, pool);
    return pool;
  }

  private resolvePoolConfig(config: ConnectionConfig, driver: IDatabaseDriver): PoolConfig {
    const merged: PoolConfig = { ...(driver.poolDefaults ?? {}), ...(config.pool ?? {}) };
    const limit = driver.maxConnections;
    if (limit !== undefined && (merged.max === undefined || merged.max > limit)) {
      return { ...merged, max: limit, min: Math.min(merged.min ?? 0, limit) };
    }
    return merged;
  }

  private getOrCreateDialect(connectionName: string, driver: IDatabaseDriver): SqlDialect {
    const existing = this.dialects.get(connectionName);
    if (existing) {
      return existing;
    }

    const dialect = createDialect(driver.name, driver.capabilities);
    this.dialects.set(connectionName, dialect);
    return dialect;
  }

  private getNamedConfig(name: string): ResolvedConnectionConfig {
    const config = this.config.connections[name];
    if (!config) {
      throw new DatabaseConfigurationError(
        `Database connection "${name}" is not configured in DatabaseConfig.`
      );
    }
    return config;
  }

  private getConnectionDriver(name: string, config: ResolvedConnectionConfig): IDatabaseDriver {
    const existing = this.connectionDrivers.get(name);
    if (existing) return existing;
    const factory = this.driverFactories.get(config.driver.toLowerCase());
    if (!factory) {
      if (this.drivers.has(config.driver.toLowerCase())) return this.getDriver(config.driver);
      throw new DatabaseConfigurationError(
        `Unknown database driver "${config.driver}" for connection "${name}". Supported drivers: postgres, mysql, mariadb, sqlite, mongodb, memory. Custom drivers must be registered with db.registerDriver().`
      );
    }
    const driver = factory(config);
    this.connectionDrivers.set(name, driver);
    return driver;
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
