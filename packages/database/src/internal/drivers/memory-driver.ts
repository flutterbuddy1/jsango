import type {
  DatabaseCapabilities,
  DatabaseResult,
  IDatabaseDriver,
  IDriverConnection,
  QueryOptions,
} from '../../public/types.js';
import { DatabaseError, QueryError } from '../../public/errors.js';

interface TableRow {
  [column: string]: unknown;
}

export class MemoryDriverConnection implements IDriverConnection {
  private closed = false;
  private readonly tables: Map<string, TableRow[]>;
  private snapshotStack: Map<string, TableRow[]>[] = [];
  private savepoints = new Map<string, Map<string, TableRow[]>>();
  public simulatedQueryDelayMs = 0;
  public shouldFailQuery: Error | null = null;

  constructor(sharedTables: Map<string, TableRow[]>) {
    this.tables = sharedTables;
  }

  public get isClosed(): boolean {
    return this.closed;
  }

  public async ping(): Promise<boolean> {
    return !this.closed;
  }

  public async close(): Promise<void> {
    this.closed = true;
  }

  public async query<T = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
    options?: QueryOptions
  ): Promise<DatabaseResult<T>> {
    if (this.closed) {
      throw new DatabaseError({
        code: 'ERR_DB_CONNECTION_CLOSED',
        message: 'Cannot execute query on closed connection.',
      });
    }

    if (options?.signal?.aborted) {
      throw new DatabaseError({
        code: 'ERR_DB_OPERATION_ABORTED',
        message: 'Query execution was aborted by client signal.',
      });
    }

    if (this.shouldFailQuery) {
      throw this.shouldFailQuery;
    }

    if (this.simulatedQueryDelayMs > 0) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          if (options?.signal) {
            options.signal.removeEventListener('abort', onAbort);
          }
          resolve();
        }, this.simulatedQueryDelayMs);

        const onAbort = () => {
          clearTimeout(timer);
          reject(
            new DatabaseError({
              code: 'ERR_DB_OPERATION_ABORTED',
              message: 'Query execution was aborted during simulated delay.',
            })
          );
        };

        if (options?.signal) {
          options.signal.addEventListener('abort', onAbort, { once: true });
        }
      });
    }

    return this.executeSql<T>(sql.trim(), params ?? []);
  }

  private executeSql<T>(sql: string, params: readonly unknown[]): DatabaseResult<T> {
    const upper = sql.toUpperCase();

    // 1. Transaction statements
    if (upper === 'BEGIN' || upper.startsWith('BEGIN TRANSACTION')) {
      this.snapshotStack.push(this.cloneTables(this.tables));
      return { rows: [], rowCount: 0 };
    }

    if (upper === 'COMMIT') {
      if (this.snapshotStack.length > 0) {
        this.snapshotStack.pop();
      }
      this.savepoints.clear();
      return { rows: [], rowCount: 0 };
    }

    if (upper === 'ROLLBACK') {
      const snapshot = this.snapshotStack.pop();
      if (snapshot) {
        this.restoreTables(snapshot);
      }
      this.savepoints.clear();
      return { rows: [], rowCount: 0 };
    }

    if (upper.startsWith('SAVEPOINT ')) {
      const name = sql.substring(10).trim();
      this.savepoints.set(name, this.cloneTables(this.tables));
      return { rows: [], rowCount: 0 };
    }

    if (upper.startsWith('ROLLBACK TO SAVEPOINT ') || upper.startsWith('ROLLBACK TO ')) {
      const name = sql.replace(/ROLLBACK\s+TO(\s+SAVEPOINT)?\s+/i, '').trim();
      const snapshot = this.savepoints.get(name);
      if (!snapshot) {
        throw new QueryError(`Savepoint "${name}" does not exist.`, sql);
      }
      this.restoreTables(snapshot);
      return { rows: [], rowCount: 0 };
    }

    if (upper.startsWith('RELEASE SAVEPOINT ') || upper.startsWith('RELEASE ')) {
      const name = sql.replace(/RELEASE(\s+SAVEPOINT)?\s+/i, '').trim();
      this.savepoints.delete(name);
      return { rows: [], rowCount: 0 };
    }

    // 2. Simple SELECT queries
    if (upper === 'SELECT 1' || upper === 'SELECT 1 AS VAL') {
      return {
        rows: [{ val: 1 } as unknown as T],
        rowCount: 1,
        fields: [{ name: 'val', type: 'INTEGER' }],
      };
    }

    // 3. SELECT * FROM <table> WHERE <col> = ?
    const selectMatch = sql.match(/^SELECT\s+(.+)\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+(.+))?$/i);
    if (selectMatch) {
      const tableName = selectMatch[2]?.toLowerCase() ?? '';
      const whereClause = selectMatch[3];
      const rows = this.tables.get(tableName) ?? [];

      let filtered = rows;
      if (whereClause) {
        const colMatch = whereClause.match(/([a-zA-Z0-9_]+)\s*=\s*(?:\?|\$1)/i);
        const col = colMatch ? colMatch[1] : undefined;
        if (col && params.length > 0) {
          filtered = rows.filter((r) => r[col] === params[0]);
        }
      }

      return {
        rows: filtered.map((r) => ({ ...r })) as unknown as T[],
        rowCount: filtered.length,
        fields:
          filtered.length > 0
            ? Object.keys(filtered[0] ?? {}).map((k) => ({ name: k, type: 'TEXT' }))
            : [],
      };
    }

    // 4. INSERT INTO <table> (<cols>) VALUES (<vals>)
    const insertMatch = sql.match(/^INSERT\s+INTO\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)\s*VALUES/i);
    if (insertMatch) {
      const tableName = insertMatch[1]?.toLowerCase() ?? '';
      const cols = insertMatch[2]?.split(',').map((c) => c.trim()) ?? [];

      if (!this.tables.has(tableName)) {
        this.tables.set(tableName, []);
      }
      const table = this.tables.get(tableName)!;

      const newRow: TableRow = {};
      cols.forEach((col, idx) => {
        newRow[col] = params[idx];
      });

      const nextId = table.length + 1;
      if (!newRow['id']) {
        newRow['id'] = nextId;
      }

      table.push(newRow);

      return {
        rows: [{ ...newRow }] as unknown as T[],
        rowCount: 1,
        lastInsertId: newRow['id'] as number,
      };
    }

    // 5. UPDATE <table> SET <col> = ? WHERE id = ?
    const updateMatch = sql.match(/^UPDATE\s+([a-zA-Z0-9_]+)\s+SET\s+(.+)$/i);
    if (updateMatch) {
      const tableName = updateMatch[1]?.toLowerCase() ?? '';
      const table = this.tables.get(tableName) ?? [];
      let updatedCount = 0;

      // Mock update
      if (table.length > 0 && params.length > 0) {
        table.forEach((row) => {
          row['updated'] = true;
          updatedCount++;
        });
      }

      return {
        rows: [],
        rowCount: updatedCount,
      };
    }

    // 6. DELETE FROM <table> WHERE <col> = ?
    const deleteMatch = sql.match(/^DELETE\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+(.+))?$/i);
    if (deleteMatch) {
      const tableName = deleteMatch[1]?.toLowerCase() ?? '';
      const table = this.tables.get(tableName) ?? [];
      const count = table.length;
      this.tables.set(tableName, []);
      return {
        rows: [],
        rowCount: count,
      };
    }

    // Generic fallback for any other valid statement
    return {
      rows: [],
      rowCount: 1,
    };
  }

  private cloneTables(tables: Map<string, TableRow[]>): Map<string, TableRow[]> {
    const copy = new Map<string, TableRow[]>();
    for (const [name, rows] of tables.entries()) {
      copy.set(
        name,
        rows.map((r) => ({ ...r }))
      );
    }
    return copy;
  }

  private restoreTables(snapshot: Map<string, TableRow[]>): void {
    this.tables.clear();
    for (const [name, rows] of snapshot.entries()) {
      this.tables.set(
        name,
        rows.map((r) => ({ ...r }))
      );
    }
  }
}

export class MemoryDatabaseDriver implements IDatabaseDriver {
  public readonly name = 'memory';
  public readonly capabilities: DatabaseCapabilities = {
    supportsTransactions: true,
    supportsSavepoints: true,
    supportsIsolationLevels: true,
    supportsReturning: true,
    supportsCancellation: true,
    placeholderType: 'question',
    supportedIsolationLevels: [
      'READ UNCOMMITTED',
      'READ COMMITTED',
      'REPEATABLE READ',
      'SERIALIZABLE',
    ],
  };

  private readonly sharedTables = new Map<string, TableRow[]>();
  private readonly connections = new Set<MemoryDriverConnection>();
  private disconnected = false;

  public async connect(): Promise<IDriverConnection> {
    if (this.disconnected) {
      throw new DatabaseError({
        code: 'ERR_DB_DRIVER_DISCONNECTED',
        message: 'Memory database driver is disconnected.',
      });
    }

    const conn = new MemoryDriverConnection(this.sharedTables);
    this.connections.add(conn);
    return conn;
  }

  public async disconnect(): Promise<void> {
    this.disconnected = true;
    for (const conn of this.connections) {
      await conn.close();
    }
    this.connections.clear();
    this.sharedTables.clear();
  }

  /**
   * Helper to seed rows into the memory driver tables for testing.
   */
  public seed(table: string, rows: TableRow[]): void {
    this.sharedTables.set(
      table.toLowerCase(),
      rows.map((r) => ({ ...r }))
    );
  }

  /**
   * Helper to inspect rows from the memory driver tables.
   */
  public getTable(table: string): TableRow[] {
    return (this.sharedTables.get(table.toLowerCase()) ?? []).map((r) => ({ ...r }));
  }
}
