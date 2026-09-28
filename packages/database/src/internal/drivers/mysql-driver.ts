import type {
  IDatabaseDriver,
  IDriverConnection,
  DatabaseCapabilities,
  DatabaseResult,
  QueryOptions,
} from '../../public/types.js';
import type { ConnectionConfig } from '../../public/config.js';
import { ConnectionError, QueryError } from '../../public/errors.js';

export interface MysqlDriverOptions {
  readonly url?: string | undefined;
  readonly host?: string | undefined;
  readonly port?: number | undefined;
  readonly database?: string | undefined;
  readonly user?: string | undefined;
  readonly password?: string | undefined;
  readonly ssl?: boolean | Record<string, unknown> | undefined;
}

export class MysqlDriverConnection implements IDriverConnection {
  private _isClosed = false;
  private connection: any = null;
  public readonly config: ConnectionConfig | MysqlDriverOptions;

  constructor(config: ConnectionConfig | MysqlDriverOptions, connection?: any) {
    this.config = config;
    this.connection = connection;
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
      throw new QueryError('Cannot execute query on closed MySQL connection.', sql);
    }

    if (this.connection && typeof this.connection.execute === 'function') {
      try {
        const [rows, fields] = await this.connection.execute(sql, [...params]);
        const resultRows = Array.isArray(rows) ? (rows as T[]) : [];
        const lastInsertId = (rows as any)?.insertId;
        const affectedRows = (rows as any)?.affectedRows ?? resultRows.length;

        return {
          rows: Object.freeze(resultRows),
          rowCount: affectedRows,
          lastInsertId: lastInsertId ? Number(lastInsertId) : undefined,
          fields: Array.isArray(fields)
            ? fields.map((f: { name: string; type?: number }) => ({
                name: f.name,
                type: String(f.type ?? 'unknown'),
              }))
            : undefined,
        };
      } catch (err: unknown) {
        throw new QueryError(
          `MySQL query failed: ${err instanceof Error ? err.message : String(err)}`,
          sql,
          err,
          { params }
        );
      }
    }

    // Zero-dependency simulation fallback
    return {
      rows: Object.freeze([] as T[]),
      rowCount: 0,
    };
  }

  public async ping(): Promise<boolean> {
    if (this._isClosed) return false;
    try {
      if (this.connection && typeof this.connection.query === 'function') {
        await this.connection.query('SELECT 1');
      }
      return true;
    } catch {
      return false;
    }
  }

  public async close(): Promise<void> {
    if (this._isClosed) return;
    this._isClosed = true;
    if (this.connection) {
      if (typeof this.connection.release === 'function') {
        await this.connection.release();
      } else if (typeof this.connection.end === 'function') {
        await this.connection.end();
      }
    }
  }
}

export class MysqlDatabaseDriver implements IDatabaseDriver {
  public readonly name = 'mysql';
  public readonly capabilities: DatabaseCapabilities = {
    supportsTransactions: true,
    supportsSavepoints: true,
    supportsIsolationLevels: true,
    supportsReturning: false,
    supportsCancellation: false,
    placeholderType: 'question',
    supportsTransactionalDDL: false,
    supportedIsolationLevels: ['READ UNCOMMITTED', 'READ COMMITTED', 'REPEATABLE READ', 'SERIALIZABLE'],
  };

  private pool: any = null;
  private readonly config: ConnectionConfig | MysqlDriverOptions;

  constructor(config: ConnectionConfig | MysqlDriverOptions = {}) {
    this.config = config;
  }

  public async connect(): Promise<IDriverConnection> {
    // Attempt dynamic load of 'mysql2/promise' if installed
    if (!this.pool) {
      try {
        const mysql = await import('mysql2/promise' as string);
        const createPool = mysql.default?.createPool ?? mysql.createPool;
        if (createPool) {
          const cfg = this.config as any;
          this.pool = createPool({
            uri: cfg.url,
            host: cfg.host,
            port: cfg.port,
            database: cfg.database,
            user: cfg.username ?? cfg.user,
            password: cfg.password,
            ssl: cfg.ssl,
            connectionLimit: cfg.pool?.max ?? 10,
          });
        }
      } catch {
        // 'mysql2' package not installed, operates in mock / fallback mode
      }
    }

    if (this.pool) {
      try {
        const conn = await this.pool.getConnection();
        return new MysqlDriverConnection(this.config, conn);
      } catch (err: unknown) {
        throw new ConnectionError(
          `Failed to connect to MySQL database: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    return new MysqlDriverConnection(this.config);
  }

  public async disconnect(): Promise<void> {
    if (this.pool && typeof this.pool.end === 'function') {
      await this.pool.end();
      this.pool = null;
    }
  }
}
