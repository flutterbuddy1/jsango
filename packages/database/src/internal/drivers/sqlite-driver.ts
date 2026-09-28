import type {
  IDatabaseDriver,
  IDriverConnection,
  DatabaseCapabilities,
  DatabaseResult,
  QueryOptions,
} from '../../public/types.js';
import type { ConnectionConfig } from '../../public/config.js';
import { QueryError } from '../../public/errors.js';
import { MemoryDatabaseDriver } from './memory-driver.js';

export interface SqliteDriverOptions {
  readonly filename?: string | undefined;
  readonly url?: string | undefined;
  readonly readonly?: boolean | undefined;
}

export class SqliteDriverConnection implements IDriverConnection {
  private _isClosed = false;
  private db: any = null;
  private memoryFallback: IDriverConnection | null = null;
  public readonly config: ConnectionConfig | SqliteDriverOptions;

  constructor(
    config: ConnectionConfig | SqliteDriverOptions,
    db?: any,
    memoryFallback?: IDriverConnection
  ) {
    this.config = config;
    this.db = db;
    this.memoryFallback = memoryFallback ?? null;
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

    if (this.db) {
      try {
        const trimmed = sql.trim().toUpperCase();
        const isSelect = trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA') || trimmed.startsWith('EXPLAIN');

        if (isSelect) {
          const stmt = this.db.prepare(sql);
          const rows = stmt.all(...params) as T[];
          return {
            rows: Object.freeze(rows),
            rowCount: rows.length,
          };
        } else {
          const stmt = this.db.prepare(sql);
          const info = stmt.run(...params);
          return {
            rows: Object.freeze([] as T[]),
            rowCount: info.changes ?? 0,
            lastInsertId: info.lastInsertRowid !== undefined ? Number(info.lastInsertRowid) : undefined,
          };
        }
      } catch (err: unknown) {
        throw new QueryError(
          `SQLite query failed: ${err instanceof Error ? err.message : String(err)}`,
          sql,
          err,
          { params }
        );
      }
    }

    if (this.memoryFallback) {
      return this.memoryFallback.query<T>(sql, params, options);
    }

    return {
      rows: Object.freeze([] as T[]),
      rowCount: 0,
    };
  }

  public async ping(): Promise<boolean> {
    if (this._isClosed) return false;
    return true;
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

  private readonly config: ConnectionConfig | SqliteDriverOptions;

  constructor(config: ConnectionConfig | SqliteDriverOptions = {}) {
    this.config = config;
  }

  public async connect(): Promise<IDriverConnection> {
    const filename =
      (this.config as any).filename ??
      (this.config as any).database ??
      (this.config as any).url?.replace(/^sqlite:\/\//, '') ??
      ':memory:';

    // 1. Try better-sqlite3
    try {
      const betterSqlite3 = await import('better-sqlite3' as string);
      const DatabaseClass = betterSqlite3.default ?? betterSqlite3;
      if (DatabaseClass) {
        const db = new DatabaseClass(filename);
        return new SqliteDriverConnection(this.config, db);
      }
    } catch {
      // better-sqlite3 not installed
    }

    // 2. Try Node.js 22 built-in node:sqlite
    try {
      const nodeSqlite = await import('node:sqlite' as string);
      const DatabaseSync = (nodeSqlite as any).DatabaseSync;
      if (DatabaseSync) {
        const db = new DatabaseSync(filename);
        return new SqliteDriverConnection(this.config, db);
      }
    } catch {
      // node:sqlite not supported
    }

    // 3. Robust in-memory SQL engine fallback
    const memDriver = new MemoryDatabaseDriver();
    const memConn = await memDriver.connect();
    return new SqliteDriverConnection(this.config, null, memConn);
  }

  public async disconnect(): Promise<void> {
    // No-op for driver instance
  }
}
