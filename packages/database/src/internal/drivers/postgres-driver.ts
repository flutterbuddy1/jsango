import type {
  IDatabaseDriver,
  IDriverConnection,
  DatabaseCapabilities,
  DatabaseResult,
  QueryOptions,
} from '../../public/types.js';
import type { ConnectionConfig } from '../../public/config.js';
import { ConnectionError, QueryError } from '../../public/errors.js';

export interface PostgresDriverOptions {
  readonly url?: string | undefined;
  readonly host?: string | undefined;
  readonly port?: number | undefined;
  readonly database?: string | undefined;
  readonly user?: string | undefined;
  readonly password?: string | undefined;
  readonly ssl?: boolean | Record<string, unknown> | undefined;
}

export class PostgresDriverConnection implements IDriverConnection {
  private _isClosed = false;
  private client: any = null;
  public readonly config: ConnectionConfig | PostgresDriverOptions;

  constructor(config: ConnectionConfig | PostgresDriverOptions, client?: any) {
    this.config = config;
    this.client = client;
  }

  public get isClosed(): boolean {
    return this._isClosed;
  }

  public async query<T = Record<string, unknown>>(
    sql: string,
    params: readonly unknown[] = [],
    _options?: QueryOptions
  ): Promise<DatabaseResult<T>> {
    if (this._isClosed) {
      throw new QueryError('Cannot execute query on closed Postgres connection.', sql);
    }

    if (this.client && typeof this.client.query === 'function') {
      try {
        const res = await this.client.query(sql, [...params]);
        const rows = (res.rows ?? []) as T[];
        return {
          rows: Object.freeze(rows),
          rowCount: res.rowCount ?? rows.length,
          fields: res.fields?.map((f: { name: string; dataTypeID?: number }) => ({
            name: f.name,
            type: String(f.dataTypeID ?? 'unknown'),
          })),
        };
      } catch (err: unknown) {
        throw new QueryError(
          `PostgreSQL query failed: ${err instanceof Error ? err.message : String(err)}`,
          sql,
          err,
          { params }
        );
      }
    }

    // Zero-dependency fallback simulation when running in disconnected / lightweight mock mode
    return {
      rows: Object.freeze([] as T[]),
      rowCount: 0,
    };
  }

  public async ping(): Promise<boolean> {
    if (this._isClosed) return false;
    try {
      if (this.client && typeof this.client.query === 'function') {
        await this.client.query('SELECT 1');
      }
      return true;
    } catch {
      return false;
    }
  }

  public async close(): Promise<void> {
    if (this._isClosed) return;
    this._isClosed = true;
    if (this.client) {
      if (typeof this.client.release === 'function') {
        await this.client.release();
      } else if (typeof this.client.end === 'function') {
        await this.client.end();
      }
    }
  }
}

export class PostgresDatabaseDriver implements IDatabaseDriver {
  public readonly name = 'postgres';
  public readonly capabilities: DatabaseCapabilities = {
    supportsTransactions: true,
    supportsSavepoints: true,
    supportsIsolationLevels: true,
    supportsReturning: true,
    supportsCancellation: true,
    placeholderType: 'dollar',
    supportsTransactionalDDL: true,
    supportedIsolationLevels: ['READ COMMITTED', 'REPEATABLE READ', 'SERIALIZABLE'],
  };

  private pool: any = null;
  private readonly config: ConnectionConfig | PostgresDriverOptions;

  constructor(config: ConnectionConfig | PostgresDriverOptions = {}) {
    this.config = config;
  }

  public async connect(): Promise<IDriverConnection> {
    // Attempt dynamic load of 'pg' if installed in user application
    if (!this.pool) {
      try {
        const pg = await import('pg' as string);
        const PoolClass = pg.default?.Pool ?? pg.Pool;
        if (PoolClass) {
          const cfg = this.config as any;
          this.pool = new PoolClass({
            connectionString: cfg.url,
            host: cfg.host,
            port: cfg.port,
            database: cfg.database,
            user: cfg.username ?? cfg.user,
            password: cfg.password,
            ssl: cfg.ssl,
            min: cfg.pool?.min ?? 1,
            max: cfg.pool?.max ?? 10,
          });
        }
      } catch (err) {
        throw new ConnectionError(
          "PostgreSQL driver requires the 'pg' package. Install it with `npm install pg`.",
          err
        );
      }
    }

    if (this.pool) {
      try {
        const client = await this.pool.connect();
        return new PostgresDriverConnection(this.config, client);
      } catch (err: unknown) {
        throw new ConnectionError(
          `Failed to connect to PostgreSQL database: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    throw new ConnectionError("PostgreSQL driver could not initialize the 'pg' connection pool.");
  }

  public async disconnect(): Promise<void> {
    if (this.pool && typeof this.pool.end === 'function') {
      await this.pool.end();
      this.pool = null;
    }
  }
}
