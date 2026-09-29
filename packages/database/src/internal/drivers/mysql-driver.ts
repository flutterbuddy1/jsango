/* eslint-disable @typescript-eslint/no-explicit-any -- wraps untyped optional peer clients (pg, mysql2, better-sqlite3, node:sqlite, mongodb) */
import type {
  IDatabaseDriver,
  IDriverConnection,
  DatabaseCapabilities,
  DatabaseResult,
  QueryOptions,
} from '../../public/types.js';
import type { ConnectionConfig } from '../../public/config.js';
import { ConnectionError, QueryError } from '../../public/errors.js';
import { describeTarget, formatConnectionFailure, importOptional, toSqlParam } from './shared.js';

export interface MysqlDriverOptions {
  readonly url?: string | undefined;
  readonly host?: string | undefined;
  readonly port?: number | undefined;
  readonly database?: string | undefined;
  readonly user?: string | undefined;
  readonly username?: string | undefined;
  readonly password?: string | undefined;
  readonly ssl?: boolean | Record<string, unknown> | undefined;
  readonly pool?: ConnectionConfig['pool'];
  readonly options?: Record<string, unknown> | undefined;
}

export interface MysqlDriverDependencies {
  /** Inject the `mysql2/promise` module instead of importing it. */
  readonly mysql?: unknown;
}

const CONNECTION_LOST_CODES = new Set([
  'PROTOCOL_CONNECTION_LOST',
  'ECONNRESET',
  'EPIPE',
  'ER_SERVER_SHUTDOWN',
]);

export class MysqlDriverConnection implements IDriverConnection {
  private _isClosed = false;
  private broken = false;
  private connection: any = null;
  public readonly config: ConnectionConfig | MysqlDriverOptions;

  constructor(config: ConnectionConfig | MysqlDriverOptions, connection?: any) {
    this.config = config;
    this.connection = connection ?? null;
  }

  public get isClosed(): boolean {
    return this._isClosed || this.broken;
  }

  public async query<T = Record<string, unknown>>(
    sql: string,
    params: readonly unknown[] = [],
    _options?: QueryOptions
  ): Promise<DatabaseResult<T>> {
    if (this._isClosed) {
      throw new QueryError('Cannot execute query on closed MySQL connection.', sql);
    }
    if (!this.connection) {
      throw new ConnectionError('MySQL connection has no underlying client.');
    }

    try {
      // query() (client-side parameter binding) supports every statement type, including DDL
      // and transaction control that the prepared-statement protocol (execute) rejects.
      const [result, fields] = await this.connection.query(
        sql,
        params.map((p) => toSqlParam(p, 'mysql'))
      );

      if (Array.isArray(result)) {
        return {
          rows: Object.freeze(result as T[]),
          rowCount: result.length,
          fields: Array.isArray(fields)
            ? fields.map((f: { name: string; type?: number }) => ({
                name: f.name,
                type: String(f.type ?? 'unknown'),
              }))
            : undefined,
        };
      }

      const header = (result ?? {}) as { affectedRows?: number; insertId?: number | bigint };
      const insertId = header.insertId;
      return {
        rows: Object.freeze([] as T[]),
        rowCount: header.affectedRows ?? 0,
        lastInsertId:
          insertId !== undefined && insertId !== null && Number(insertId) !== 0
            ? typeof insertId === 'bigint' && insertId > BigInt(Number.MAX_SAFE_INTEGER)
              ? insertId
              : Number(insertId)
            : undefined,
      };
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code && CONNECTION_LOST_CODES.has(code)) {
        this.broken = true;
      }
      throw new QueryError(
        `MySQL query failed: ${err instanceof Error ? err.message : String(err)}`,
        sql,
        err,
        { params, code }
      );
    }
  }

  public async ping(): Promise<boolean> {
    if (this.isClosed || !this.connection) return false;
    try {
      await this.connection.query('SELECT 1');
      return true;
    } catch {
      this.broken = true;
      return false;
    }
  }

  public async close(): Promise<void> {
    if (this._isClosed) return;
    this._isClosed = true;
    if (!this.connection) return;
    if (this.broken && typeof this.connection.destroy === 'function') {
      this.connection.destroy();
    } else if (typeof this.connection.release === 'function') {
      this.connection.release();
    } else if (typeof this.connection.end === 'function') {
      await this.connection.end();
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
  private readonly deps: MysqlDriverDependencies;

  constructor(config: ConnectionConfig | MysqlDriverOptions = {}, deps: MysqlDriverDependencies = {}) {
    this.config = config;
    this.deps = deps;
  }

  public get target(): string {
    return describeTarget(this.config, 3306);
  }

  private async createPool(): Promise<any> {
    const mysql: any = this.deps.mysql ?? (await importOptional('mysql2/promise'));
    if (!mysql) {
      throw new ConnectionError(
        "MySQL/MariaDB support requires the 'mysql2' package. Install it in your project: npm install mysql2"
      );
    }
    const createPool = mysql.createPool ?? mysql.default?.createPool;
    if (typeof createPool !== 'function') {
      throw new ConnectionError("The installed 'mysql2' package does not export createPool().");
    }

    const cfg = this.config as MysqlDriverOptions;
    const poolCfg = cfg.pool ?? {};
    const settings: Record<string, unknown> = {
      host: cfg.host,
      port: cfg.port,
      database: cfg.database,
      user: cfg.username ?? cfg.user,
      password: cfg.password,
      connectionLimit: poolCfg.max ?? 10,
      connectTimeout: poolCfg.connectionTimeoutMs ?? 10_000,
      waitForConnections: true,
      // Store and read DATETIME values as UTC so Date round-trips are timezone-independent.
      timezone: 'Z',
      charset: 'utf8mb4',
      supportBigNumbers: true,
      decimalNumbers: false,
      multipleStatements: false,
      ...(cfg.options ?? {}),
    };
    if (cfg.ssl !== undefined && cfg.ssl !== false) {
      settings['ssl'] = cfg.ssl === true ? {} : cfg.ssl;
    }
    for (const key of Object.keys(settings)) {
      if (settings[key] === undefined) delete settings[key];
    }

    // mysql2 accepts a URL string as `uri`; explicit fields override URL components.
    return cfg.url ? createPool({ uri: cfg.url, ...settings }) : createPool(settings);
  }

  public async connect(): Promise<IDriverConnection> {
    if (!this.pool) {
      this.pool = await this.createPool();
    }

    try {
      const conn = await this.pool.getConnection();
      return new MysqlDriverConnection(this.config, conn);
    } catch (err: unknown) {
      throw new ConnectionError(formatConnectionFailure('MySQL', this.target, err), err);
    }
  }

  public async disconnect(): Promise<void> {
    if (this.pool && typeof this.pool.end === 'function') {
      const pool = this.pool;
      this.pool = null;
      await pool.end();
    }
  }
}
