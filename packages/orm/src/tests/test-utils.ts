import type {
  IDatabaseConnection,
  IDatabaseTransaction,
  DatabaseResult,
  DatabaseCapabilities,
  IDatabaseDriver,
  IDriverConnection,
  QueryOptions,
  TransactionOptions,
} from '@jsango/database';
import { DatabaseManager } from '@jsango/database';
import { setDatabaseManager } from '../public/connection.js';
import { defaultModelRegistry } from '../public/registry.js';

type TableRow = Record<string, unknown>;

export class MockDatabaseConnection implements IDatabaseConnection, IDriverConnection {
  public readonly tables = new Map<string, TableRow[]>();
  public readonly executedQueries: { sql: string; params: unknown[] }[] = [];
  public readonly isReleased = false;
  private transactionSnapshots: Map<string, TableRow[]>[] = [];

  public readonly capabilities: DatabaseCapabilities = {
    supportsTransactions: true,
    supportsSavepoints: true,
    supportsIsolationLevels: true,
    supportsReturning: true,
    supportsCancellation: true,
    placeholderType: 'question',
    supportedIsolationLevels: ['READ COMMITTED', 'SERIALIZABLE'],
  };

  public readonly driver: IDatabaseDriver = {
    name: 'mock',
    capabilities: this.capabilities,
    connect: async () => this,
    disconnect: async () => {},
  };

  public get isClosed(): boolean {
    return false;
  }

  public async isAlive(): Promise<boolean> {
    return true;
  }

  public async ping(): Promise<boolean> {
    return true;
  }

  public async close(): Promise<void> {}

  public async release(): Promise<void> {}

  public getTable(name: string): TableRow[] {
    const key = name.toLowerCase().replace(/"/g, '');
    if (!this.tables.has(key)) {
      this.tables.set(key, []);
    }
    return this.tables.get(key)!;
  }

  public async query<T = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
    _options?: QueryOptions
  ): Promise<DatabaseResult<T>> {
    const rawParams = params ? [...params] : [];
    this.executedQueries.push({ sql, params: rawParams });
    const cleanSql = sql.trim();
    const upper = cleanSql.toUpperCase();

    // 0. Transactions
    if (upper === 'BEGIN' || upper.startsWith('BEGIN TRANSACTION')) {
      this.transactionSnapshots.push(this.cloneTables());
      return { rows: [], rowCount: 0 };
    }
    if (upper === 'COMMIT') {
      if (this.transactionSnapshots.length > 0) {
        this.transactionSnapshots.pop();
      }
      return { rows: [], rowCount: 0 };
    }
    if (upper === 'ROLLBACK') {
      const snap = this.transactionSnapshots.pop();
      if (snap) {
        this.restoreTables(snap);
      }
      return { rows: [], rowCount: 0 };
    }

    // 1. COUNT
    const countMatch = cleanSql.match(
      /^SELECT\s+COUNT\(([^)]+)\)\s+AS\s+"?aggregate"?\s+FROM\s+"?([a-zA-Z0-9_]+)"?(?:\s+WHERE\s+(.+))?$/i
    );
    if (countMatch) {
      const tableName = countMatch[2]!;
      const rows = this.filterRows(tableName, countMatch[3], rawParams);
      return {
        rows: [{ aggregate: rows.length } as unknown as T],
        rowCount: 1,
      };
    }

    // 2. EXISTS
    const existsMatch = cleanSql.match(
      /^SELECT\s+1\s+AS\s+"?exists_flag"?\s+FROM\s+"?([a-zA-Z0-9_]+)"?(?:\s+WHERE\s+(.+))?/i
    );
    if (existsMatch) {
      const tableName = existsMatch[1]!;
      const rows = this.filterRows(tableName, existsMatch[2], rawParams);
      return {
        rows: rows.length > 0 ? ([{ exists_flag: 1 }] as unknown as T[]) : [],
        rowCount: rows.length > 0 ? 1 : 0,
      };
    }

    // 3. SELECT
    const selectMatch = cleanSql.match(
      /^SELECT\s+(.+)\s+FROM\s+"?([a-zA-Z0-9_]+)"?(?:\s+WHERE\s+(.+?))?(?:\s+ORDER\s+BY\s+(.+?))?(?:\s+LIMIT\s+(\d+))?(?:\s+OFFSET\s+(\d+))?$/i
    );
    if (selectMatch) {
      const colStr = selectMatch[1]!;
      const tableName = selectMatch[2]!;
      const whereClause = selectMatch[3];
      const orderByClause = selectMatch[4];
      const limitVal = selectMatch[5] ? parseInt(selectMatch[5], 10) : undefined;
      const offsetVal = selectMatch[6] ? parseInt(selectMatch[6], 10) : undefined;

      let rows = this.filterRows(tableName, whereClause, rawParams);

      if (orderByClause) {
        const [colRaw, dir] = orderByClause.trim().split(/\s+/);
        const col = colRaw!.replace(/"/g, '');
        const isDesc = dir?.toUpperCase() === 'DESC';
        rows.sort((a, b) => {
          const valA = a[col];
          const valB = b[col];
          if (valA === valB) return 0;
          if (valA === undefined || valA === null) return 1;
          if (valB === undefined || valB === null) return -1;
          const cmp = valA > valB ? 1 : -1;
          return isDesc ? -cmp : cmp;
        });
      }

      if (offsetVal !== undefined) {
        rows = rows.slice(offsetVal);
      }
      if (limitVal !== undefined) {
        rows = rows.slice(0, limitVal);
      }

      // Project columns if not '*'
      let projected: TableRow[] = rows.map((r) => ({ ...r }));
      if (colStr.trim() !== '*') {
        const cols = colStr.split(',').map((c) => c.trim().replace(/"/g, ''));
        projected = rows.map((r) => {
          const res: TableRow = {};
          for (const c of cols) {
            res[c] = r[c];
          }
          return res;
        });
      }

      return {
        rows: projected as unknown as T[],
        rowCount: projected.length,
      };
    }

    // 4. INSERT
    const insertMatch = cleanSql.match(
      /^INSERT\s+INTO\s+"?([a-zA-Z0-9_]+)"?\s*\(([^)]+)\)\s*VALUES\s*(.+)$/i
    );
    if (insertMatch) {
      const tableName = insertMatch[1]!;
      const cols = insertMatch[2]!.split(',').map((c) => c.trim().replace(/"/g, ''));
      const table = this.getTable(tableName);

      // Handle single or multi-row insert
      const rowsStr = insertMatch[3]!;
      const rowMatches = rowsStr.match(/\([^)]+\)/g) ?? [];
      let paramIdx = 0;
      let lastId: number | undefined;
      const insertedRows: TableRow[] = [];

      for (const _rm of rowMatches) {
        const row: TableRow = {};
        for (const col of cols) {
          row[col] = rawParams[paramIdx++];
        }
        if (row['id'] === undefined) {
          const nextId = table.length + 1;
          row['id'] = nextId;
          lastId = nextId;
        } else if (typeof row['id'] === 'number') {
          lastId = row['id'];
        }
        table.push(row);
        insertedRows.push({ ...row });
      }

      return {
        rows: insertedRows as unknown as T[],
        rowCount: insertedRows.length,
        lastInsertId: lastId,
      };
    }

    // 5. UPDATE
    const updateMatch = cleanSql.match(
      /^UPDATE\s+"?([a-zA-Z0-9_]+)"?\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?$/i
    );
    if (updateMatch) {
      const tableName = updateMatch[1]!;
      const setClause = updateMatch[2]!;
      const whereClause = updateMatch[3];

      const setAssignments = setClause.split(',').map((s) => s.trim());
      const setValues: Record<string, unknown> = {};
      let paramIdx = 0;
      for (const assign of setAssignments) {
        const col = assign.split('=')[0]!.trim().replace(/"/g, '');
        setValues[col] = rawParams[paramIdx++];
      }

      const table = this.getTable(tableName);
      let updatedCount = 0;

      // Extract where condition
      if (whereClause) {
        const whereParams = rawParams.slice(paramIdx);
        const matchingIndices = this.getMatchingIndices(tableName, whereClause, whereParams);
        for (const idx of matchingIndices) {
          Object.assign(table[idx]!, setValues);
          updatedCount++;
        }
      } else {
        for (const row of table) {
          Object.assign(row, setValues);
          updatedCount++;
        }
      }

      return {
        rows: [],
        rowCount: updatedCount,
      };
    }

    // 6. DELETE
    const deleteMatch = cleanSql.match(
      /^DELETE\s+FROM\s+"?([a-zA-Z0-9_]+)"?(?:\s+WHERE\s+(.+))?$/i
    );
    if (deleteMatch) {
      const tableName = deleteMatch[1]!;
      const whereClause = deleteMatch[2];
      const table = this.getTable(tableName);
      let deletedCount = 0;

      if (whereClause) {
        const matchingIndices = new Set(this.getMatchingIndices(tableName, whereClause, rawParams));
        const remaining = table.filter((_, idx) => !matchingIndices.has(idx));
        deletedCount = table.length - remaining.length;
        this.tables.set(tableName.toLowerCase().replace(/"/g, ''), remaining);
      } else {
        deletedCount = table.length;
        this.tables.set(tableName.toLowerCase().replace(/"/g, ''), []);
      }

      return {
        rows: [],
        rowCount: deletedCount,
      };
    }

    return { rows: [], rowCount: 0 };
  }

  public async beginTransaction(_options?: TransactionOptions): Promise<IDatabaseTransaction> {
    const snapshot = this.cloneTables();
    this.transactionSnapshots.push(snapshot);

    const tx: IDatabaseTransaction = {
      id: `tx_${Date.now()}`,
      isCompleted: false,
      query: (sql, p, opt) => this.query(sql, p, opt),
      commit: async () => {
        this.transactionSnapshots.pop();
      },
      rollback: async () => {
        const snap = this.transactionSnapshots.pop();
        if (snap) {
          this.restoreTables(snap);
        }
      },
      savepoint: async () => {},
      rollbackTo: async () => {},
      releaseSavepoint: async () => {},
    };

    return tx;
  }

  public async transaction<T>(
    callback: (tx: IDatabaseTransaction) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T> {
    const tx = await this.beginTransaction(options);
    try {
      const res = await callback(tx);
      await tx.commit();
      return res;
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  }

  private cloneTables(): Map<string, TableRow[]> {
    const copy = new Map<string, TableRow[]>();
    for (const [k, v] of this.tables.entries()) {
      copy.set(
        k,
        v.map((r) => ({ ...r }))
      );
    }
    return copy;
  }

  private restoreTables(snap: Map<string, TableRow[]>): void {
    this.tables.clear();
    for (const [k, v] of snap.entries()) {
      this.tables.set(
        k,
        v.map((r) => ({ ...r }))
      );
    }
  }

  private getMatchingIndices(
    tableName: string,
    whereClause: string,
    params: readonly unknown[]
  ): number[] {
    const table = this.getTable(tableName);
    const indices: number[] = [];
    for (let i = 0; i < table.length; i++) {
      if (this.rowMatches(table[i]!, whereClause, params)) {
        indices.push(i);
      }
    }
    return indices;
  }

  private filterRows(
    tableName: string,
    whereClause: string | undefined,
    params: readonly unknown[]
  ): TableRow[] {
    const table = this.getTable(tableName);
    if (!whereClause) {
      return [...table];
    }
    return table.filter((row) => this.rowMatches(row, whereClause, params));
  }

  private rowMatches(row: TableRow, whereClause: string, params: readonly unknown[]): boolean {
    if (whereClause.includes(' AND ')) {
      const parts = whereClause.split(' AND ');
      let paramOffset = 0;
      for (const part of parts) {
        const inMatch = part.match(/IN\s*\(([^)]+)\)/i);
        let paramCount = 1;
        if (inMatch) {
          paramCount = inMatch[1]!.split(',').length;
        } else if (part.includes('IS NULL') || part.includes('IS NOT NULL')) {
          paramCount = 0;
        }
        const slice = params.slice(paramOffset, paramOffset + paramCount);
        paramOffset += paramCount;
        if (!this.singleConditionMatches(row, part.trim(), slice)) {
          return false;
        }
      }
      return true;
    }

    return this.singleConditionMatches(row, whereClause.trim(), params);
  }

  private singleConditionMatches(
    row: TableRow,
    condition: string,
    params: readonly unknown[]
  ): boolean {
    // Check for IN: "col" IN (?, ?)
    const inMatch = condition.match(/"?([a-zA-Z0-9_]+)"?\s+IN\s*\(([^)]+)\)/i);
    if (inMatch) {
      const col = inMatch[1]!.replace(/"/g, '');
      const placeholders = inMatch[2]!.split(',').map((p) => p.trim());
      const inVals = params.slice(0, placeholders.length);
      return inVals.some((v) => v === row[col] || String(v) === String(row[col]));
    }

    // Check for IS NULL: "col" IS NULL
    const nullMatch = condition.match(/"?([a-zA-Z0-9_]+)"?\s+IS\s+NULL/i);
    if (nullMatch) {
      const col = nullMatch[1]!.replace(/"/g, '');
      return row[col] === null || row[col] === undefined;
    }

    // Check for IS NOT NULL: "col" IS NOT NULL
    const notNullMatch = condition.match(/"?([a-zA-Z0-9_]+)"?\s+IS\s+NOT\s+NULL/i);
    if (notNullMatch) {
      const col = notNullMatch[1]!.replace(/"/g, '');
      return row[col] !== null && row[col] !== undefined;
    }

    // Standard comparison: "col" = ? or "col" > ? etc.
    const compMatch = condition.match(
      /"?([a-zA-Z0-9_]+)"?\s*(=|!=|<>|>|>=|<|<=|LIKE)\s*(?:\?|\$\d+)/i
    );
    if (compMatch) {
      const col = compMatch[1]!.replace(/"/g, '');
      const op = compMatch[2]!;
      const targetVal = params[0];
      const actualVal = row[col];

      switch (op) {
        case '=':
          return actualVal === targetVal || String(actualVal) === String(targetVal);
        case '!=':
        case '<>':
          return actualVal !== targetVal;
        case '>':
          return Number(actualVal) > Number(targetVal);
        case '>=':
          return Number(actualVal) >= Number(targetVal);
        case '<':
          return Number(actualVal) < Number(targetVal);
        case '<=':
          return Number(actualVal) <= Number(targetVal);
        case 'LIKE':
          return String(actualVal).includes(String(targetVal).replace(/%/g, ''));
        default:
          return false;
      }
    }

    return true;
  }
}

export function createTestDatabase(): {
  connection: MockDatabaseConnection;
  manager: DatabaseManager;
} {
  const connection = new MockDatabaseConnection();
  const manager = new DatabaseManager({
    default: 'default',
    connections: {
      default: {
        driver: 'mock',
        pool: { min: 1, max: 20 },
      },
    },
  });
  manager.registerDriver('mock', connection.driver);

  setDatabaseManager(manager);
  return { connection, manager };
}

export function resetTestState(): void {
  defaultModelRegistry.clear();
}
