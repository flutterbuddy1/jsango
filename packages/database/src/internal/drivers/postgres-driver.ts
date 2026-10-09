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

export interface PostgresDriverOptions {
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

export interface PostgresDriverDependencies {
  /** Inject the `pg` module (or a compatible one such as pg-mem's adapter) instead of importing it. */
  readonly pg?: unknown;
}

export class PostgresDriverConnection implements IDriverConnection {
  private _isClosed = false;
  private broken = false;
  private client: any = null;
  public readonly config: ConnectionConfig | PostgresDriverOptions;

  constructor(config: ConnectionConfig | PostgresDriverOptions, client?: any) {
    this.config = config;
    this.client = client ?? null;

    if (this.client && typeof this.client.on === 'function') {
      // A client that errors while idle (server restart, network drop) must not be reused.
      this.client.on('error', () => {
        this.broken = true;
      });
    }
  }

  public get isClosed(): boolean {
    return this._isClosed || this.broken;
  }

  public async query<T = Record<string, unknown>>(
    sql: string,
    params: readonly unknown[] = [],
    options?: QueryOptions
  ): Promise<DatabaseResult<T>> {
    if (this._isClosed) {
      throw new QueryError('Cannot execute query on closed Postgres connection.', sql);
    }
    if (!this.client) {
      throw new ConnectionError('Postgres connection has no underlying client.');
    }

    try {
      const timeout = options?.timeoutMs ?? (this.config as ConnectionConfig).queryTimeoutMs;
      const res = await this.client.query({
        text: sql,
        values: params.map((p) => toSqlParam(p, 'postgres')),
        ...(timeout ? { query_timeout: timeout } : {}),
      });
      // Multi-statement queries return an array of results; use the last one.
      const last = Array.isArray(res) ? res[res.length - 1] : res;
      // A COMMIT after an error inside the transaction is silently turned into a ROLLBACK.
      if (last?.command === 'ROLLBACK' && /^\s*COMMIT\b/i.test(sql)) {
        throw new Error('COMMIT was rolled back: a statement in this transaction had failed.');
      }
      const rows = (last?.rows ?? []) as T[];
      return {
        rows: Object.freeze(rows),
        rowCount: typeof last?.rowCount === 'number' ? last.rowCount : rows.length,
        fields: last?.fields?.map((f: { name: string; dataTypeID?: number }) => ({
          name: f.name,
          type: String(f.dataTypeID ?? 'unknown'),
        })),
      };
    } catch (err: unknown) {
      if (isConnectionLevelError(err)) {
        this.broken = true;
      }
      throw new QueryError(
        `PostgreSQL query failed: ${err instanceof Error ? err.message : String(err)}`,
        sql,
        err,
        { params, code: (err as { code?: string }).code }
      );
    }
  }

  public async ping(): Promise<boolean> {
    if (this.isClosed || !this.client) return false;
    try {
      await this.client.query('SELECT 1');
      return true;
    } catch {
      this.broken = true;
      return false;
    }
  }

  public async close(): Promise<void> {
    if (this._isClosed) return;
    this._isClosed = true;
    if (!this.client) return;
    if (typeof this.client.release === 'function') {
      // Passing true tells pg to destroy the client instead of returning a broken one to its pool.
      this.client.release(this.broken ? true : undefined);
    } else if (typeof this.client.end === 'function') {
      await this.client.end();
    }
  }
}

function isConnectionLevelError(err: unknown): boolean {
  const code = String((err as { code?: unknown } | null)?.code ?? '');
  const message = err instanceof Error ? err.message : '';
  return (
    code === 'ECONNRESET' ||
    code === 'EPIPE' ||
    code.startsWith('08') || // SQLSTATE class 08: connection exception
    code === '57P01' || // admin_shutdown
    message.includes('Connection terminated')
  );
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
  private readonly deps: PostgresDriverDependencies;

  constructor(
    config: ConnectionConfig | PostgresDriverOptions = {},
    deps: PostgresDriverDependencies = {}
  ) {
    this.config = config;
    this.deps = deps;
  }

  public get target(): string {
    return describeTarget(this.config, 5432);
  }

  private async createPool(): Promise<any> {
    const pg: any = this.deps.pg ?? (await importOptional('pg'));
    if (!pg) {
      throw new ConnectionError(
        "PostgreSQL support requires the 'pg' package. Install it in your project: npm install pg"
      );
    }
    const PoolClass = pg.Pool ?? pg.default?.Pool;
    if (typeof PoolClass !== 'function') {
      throw new ConnectionError("The installed 'pg' package does not export a Pool class.");
    }

    const cfg = this.config as PostgresDriverOptions;
    const poolCfg = cfg.pool ?? {};
    const settings: Record<string, unknown> = {
      connectionString: cfg.url,
      host: cfg.host,
      port: cfg.port,
      database: cfg.database,
      user: cfg.username ?? cfg.user,
      password: cfg.password,
      max: poolCfg.max ?? 10,
      idleTimeoutMillis: poolCfg.idleTimeoutMs ?? 30_000,
      connectionTimeoutMillis: poolCfg.connectionTimeoutMs ?? 10_000,
      // Server-side limit too, so the database stops the work (not only the client waiting).
      statement_timeout: (cfg as ConnectionConfig).queryTimeoutMs,
      ...(cfg.options ?? {}),
    };
    if (cfg.ssl !== undefined) {
      settings['ssl'] = cfg.ssl;
    }
    for (const key of Object.keys(settings)) {
      if (settings[key] === undefined) delete settings[key];
    }

    const pool = new PoolClass(settings);
    if (typeof pool.on === 'function') {
      // Without a listener, an idle client error would crash the process.
      pool.on('error', () => undefined);
    }
    return pool;
  }

  public async connect(): Promise<IDriverConnection> {
    if (!this.pool) {
      this.pool = await this.createPool();
    }

    try {
      const client = await this.pool.connect();
      return new PostgresDriverConnection(this.config, client);
    } catch (err: unknown) {
      throw new ConnectionError(formatConnectionFailure('PostgreSQL', this.target, err), err);
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
