/* eslint-disable @typescript-eslint/no-explicit-any -- wraps untyped optional peer clients (pg, mysql2, better-sqlite3, node:sqlite, mongodb) */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  IDatabaseDriver,
  IDriverConnection,
  DatabaseCapabilities,
  DatabaseResult,
  QueryOptions,
} from '../../public/types.js';
import type { ConnectionConfig, PoolConfig } from '../../public/config.js';
import { parseSqliteFilename } from '../../public/config.js';
import { ConnectionError, QueryError } from '../../public/errors.js';
import { importOptional, toSqlParam } from './shared.js';

export interface SqliteDriverOptions {
  readonly filename?: string | undefined;
  readonly database?: string | undefined;
  readonly url?: string | undefined;
  readonly readonly?: boolean | undefined;
  readonly options?: Record<string, unknown> | undefined;
}

export interface SqliteDriverDependencies {
  /** Force a specific engine instead of auto-detecting better-sqlite3, then node:sqlite. */
  readonly engine?: 'better-sqlite3' | 'node:sqlite' | undefined;
}

type SqliteEngine = 'better-sqlite3' | 'node:sqlite';

const ROW_RETURNING_PATTERN = /^\s*(SELECT|PRAGMA|WITH|EXPLAIN|VALUES)\b|\bRETURNING\b/i;

export class SqliteDriverConnection implements IDriverConnection {
  private _isClosed = false;
  private db: any = null;
  private memoryFallback: IDriverConnection | null = null;
  public readonly config: ConnectionConfig | SqliteDriverOptions;
  public readonly engine: SqliteEngine | undefined;

  constructor(
    config: ConnectionConfig | SqliteDriverOptions,
    db?: any,
    memoryFallback?: IDriverConnection,
    engine?: SqliteEngine
  ) {
    this.config = config;
    this.db = db ?? null;
    this.memoryFallback = memoryFallback ?? null;
    this.engine = engine;
  }

  public get isClosed(): boolean {
    return this._isClosed;
  }

  public async query<T = Record<string, unknown>>(
    sql: string,
    params: readonly unknown[] = [],
    options?: QueryOptions
  ): Promise<DatabaseResult<T>> {
    if (this._isClosed) {
      throw new QueryError('Cannot execute query on closed SQLite connection.', sql);
    }

    if (!this.db) {
      if (this.memoryFallback) {
        return this.memoryFallback.query<T>(sql, params, options);
      }
      throw new ConnectionError('SQLite connection has no underlying database handle.');
    }

    const bound = params.map((p) => toSqlParam(p, 'sqlite'));

    try {
      const stmt = this.db.prepare(sql);
      const returnsRows = this.statementReturnsRows(stmt, sql);

      if (returnsRows) {
        const rows = stmt.all(...bound) as T[];
        return {
          rows: Object.freeze(rows),
          rowCount: rows.length,
          lastInsertId: /^\s*INSERT\b/i.test(sql) ? this.lastInsertRowId() : undefined,
        };
      }

      const info = stmt.run(...bound);
      return {
        rows: Object.freeze([] as T[]),
        rowCount: Number(info?.changes ?? 0),
        lastInsertId:
          /^\s*(INSERT|REPLACE)\b/i.test(sql) && info?.lastInsertRowid !== undefined
            ? normalizeRowId(info.lastInsertRowid)
            : undefined,
      };
    } catch (err: unknown) {
      throw new QueryError(
        `SQLite query failed: ${err instanceof Error ? err.message : String(err)}`,
        sql,
        err,
        { params, code: (err as { code?: string }).code }
      );
    }
  }

  private statementReturnsRows(stmt: any, sql: string): boolean {
    // better-sqlite3 knows exactly whether a statement yields rows.
    if (typeof stmt.reader === 'boolean') {
      return stmt.reader;
    }
    // node:sqlite >= 22.16 exposes column metadata.
    if (typeof stmt.columns === 'function') {
      try {
        return (stmt.columns() as unknown[]).length > 0;
      } catch {
        // fall through to pattern detection
      }
    }
    return ROW_RETURNING_PATTERN.test(sql);
  }

  private lastInsertRowId(): number | bigint | undefined {
    try {
      const row = this.db.prepare('SELECT last_insert_rowid() AS id').get() as { id?: unknown };
      return row?.id === undefined ? undefined : normalizeRowId(row.id);
    } catch {
      return undefined;
    }
  }

  public async ping(): Promise<boolean> {
    if (this._isClosed) return false;
    if (!this.db) return this.memoryFallback ? this.memoryFallback.ping() : false;
    try {
      this.db.prepare('SELECT 1').get();
      return true;
    } catch {
      return false;
    }
  }

  public async close(): Promise<void> {
    if (this._isClosed) return;
    this._isClosed = true;
    if (this.db && typeof this.db.close === 'function') {
      try {
        this.db.close();
      } catch {
        // Ignore close errors on shutdown
      }
    }
    if (this.memoryFallback) {
      await this.memoryFallback.close();
    }
  }
}

function normalizeRowId(value: unknown): number | bigint {
  if (typeof value === 'bigint') {
    return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value;
  }
  return Number(value);
}

export class SqliteDatabaseDriver implements IDatabaseDriver {
  public readonly name = 'sqlite';
  public readonly capabilities: DatabaseCapabilities = {
    supportsTransactions: true,
    supportsSavepoints: true,
    supportsIsolationLevels: false,
    supportsReturning: true,
    supportsCancellation: false,
    placeholderType: 'question',
    supportsTransactionalDDL: true,
  };

  /**
   * SQLite allows one writer at a time; a single pooled connection avoids SQLITE_BUSY and
   * is required for `:memory:` databases, where every connection would be a separate database.
   */
  public readonly poolDefaults: PoolConfig;
  public readonly maxConnections: number | undefined;

  private readonly config: ConnectionConfig | SqliteDriverOptions;
  private readonly deps: SqliteDriverDependencies;

  constructor(
    config: ConnectionConfig | SqliteDriverOptions = {},
    deps: SqliteDriverDependencies = {}
  ) {
    this.config = config;
    this.deps = deps;
    const inMemory = this.filename === ':memory:';
    this.poolDefaults = inMemory
      ? {
          min: 0,
          max: 1,
          idleTimeoutMs: Number.POSITIVE_INFINITY,
          maxLifetimeMs: Number.POSITIVE_INFINITY,
        }
      : { min: 0, max: 1 };
    this.maxConnections = inMemory ? 1 : undefined;
  }

  /** Resolved database file path, or ':memory:'. */
  public get filename(): string {
    const cfg = this.config as SqliteDriverOptions;
    if (cfg.filename) return cfg.filename;
    if (cfg.url) return parseSqliteFilename(cfg.url);
    if (cfg.database) return cfg.database;
    return ':memory:';
  }

  public async connect(): Promise<IDriverConnection> {
    const filename = this.filename;
    const isMemory = filename === ':memory:';
    const readonly = (this.config as SqliteDriverOptions).readonly === true;

    if (!isMemory && !readonly) {
      const dir = path.dirname(path.resolve(filename));
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    const { db, engine } = await this.open(filename, readonly);

    try {
      exec(db, 'PRAGMA foreign_keys = ON');
      exec(db, 'PRAGMA busy_timeout = 5000');
      if (!isMemory && !readonly) {
        exec(db, 'PRAGMA journal_mode = WAL');
      }
    } catch (err) {
      try {
        db.close();
      } catch {
        // ignore
      }
      throw new ConnectionError(
        `Failed to initialize SQLite database "${filename}": ${err instanceof Error ? err.message : String(err)}`,
        err
      );
    }

    return new SqliteDriverConnection(this.config, db, undefined, engine);
  }

  private async open(
    filename: string,
    readonly: boolean
  ): Promise<{ db: any; engine: SqliteEngine }> {
    const errors: string[] = [];
    const extra = (this.config as SqliteDriverOptions).options ?? {};

    if (this.deps.engine !== 'node:sqlite') {
      const mod = await importOptional('better-sqlite3');
      const DatabaseClass = mod?.default ?? mod;
      if (typeof DatabaseClass === 'function') {
        try {
          return {
            db: new DatabaseClass(filename, { readonly, fileMustExist: readonly, ...extra }),
            engine: 'better-sqlite3',
          };
        } catch (err) {
          errors.push(`better-sqlite3: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    if (this.deps.engine !== 'better-sqlite3') {
      const nodeSqlite = await importOptional('node:sqlite');
      const DatabaseSync = nodeSqlite?.DatabaseSync;
      if (typeof DatabaseSync === 'function') {
        try {
          return {
            db: new DatabaseSync(filename, readonly ? { readOnly: true } : {}),
            engine: 'node:sqlite',
          };
        } catch (err) {
          errors.push(`node:sqlite: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    if (errors.length > 0) {
      throw new ConnectionError(
        `Failed to open SQLite database "${filename}": ${errors.join('; ')}`
      );
    }

    throw new ConnectionError(
      "SQLite support requires the 'better-sqlite3' package (npm install better-sqlite3) or Node.js 22.13+ which ships the built-in node:sqlite module."
    );
  }

  public async disconnect(): Promise<void> {
    // Handles are owned by connections and closed when the pool closes them.
  }
}

function exec(db: any, sql: string): void {
  if (typeof db.exec === 'function') {
    db.exec(sql);
  } else {
    db.prepare(sql).run();
  }
}
