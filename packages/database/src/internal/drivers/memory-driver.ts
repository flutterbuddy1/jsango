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
    const cleanSql = sql.replace(/;\s*$/, '').replace(/\s+/g, ' ').trim();
    const upper = cleanSql.toUpperCase();

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
      const name = cleanSql.substring(10).trim();
      this.savepoints.set(name, this.cloneTables(this.tables));
      return { rows: [], rowCount: 0 };
    }

    if (upper.startsWith('ROLLBACK TO SAVEPOINT ') || upper.startsWith('ROLLBACK TO ')) {
      const name = cleanSql.replace(/ROLLBACK\s+TO(\s+SAVEPOINT)?\s+/i, '').trim();
      const snapshot = this.savepoints.get(name);
      if (!snapshot) {
        throw new QueryError(`Savepoint "${name}" does not exist.`, sql);
      }
      this.restoreTables(snapshot);
      return { rows: [], rowCount: 0 };
    }

    if (upper.startsWith('RELEASE SAVEPOINT ') || upper.startsWith('RELEASE ')) {
      const name = cleanSql.replace(/RELEASE(\s+SAVEPOINT)?\s+/i, '').trim();
      this.savepoints.delete(name);
      return { rows: [], rowCount: 0 };
    }

    // 2. Simple SELECT queries
    if (upper === 'SELECT 1' || upper === 'SELECT 1 AS VAL' || upper === 'SELECT 1 AS "VAL"') {
      return {
        rows: [{ val: 1 } as unknown as T],
        rowCount: 1,
        fields: [{ name: 'val', type: 'INTEGER' }],
      };
    }

    // 3. SELECT COUNT(...)
    const countMatch = cleanSql.match(
      /^SELECT\s+COUNT\(([^)]*)\)(?:\s+AS\s+["`]?([a-zA-Z0-9_]+)["`]?)?\s+FROM\s+["`]?([a-zA-Z0-9_]+)["`]?(?:\s+WHERE\s+(.+))?$/i
    );
    if (countMatch) {
      const alias = countMatch[2] ?? 'count';
      const tableName = countMatch[3]!;
      const whereClause = countMatch[4];
      const rows = this.filterRows(tableName, whereClause, params);
      return {
        rows: [{ [alias]: rows.length } as unknown as T],
        rowCount: 1,
      };
    }

    // 4. SELECT MAX(...)
    const maxMatch = cleanSql.match(
      /^SELECT\s+MAX\s*\(\s*["`]?([a-zA-Z0-9_]+)["`]?\s*\)(?:\s+AS\s+["`]?([a-zA-Z0-9_]+)["`]?)?\s+FROM\s+["`]?([a-zA-Z0-9_]+)["`]?(?:\s+WHERE\s+(.+))?$/i
    );
    if (maxMatch) {
      const col = maxMatch[1]!.replace(/["`]/g, '');
      const alias = maxMatch[2] ?? 'max';
      const tableName = maxMatch[3]!;
      const whereClause = maxMatch[4];
      const rows = this.filterRows(tableName, whereClause, params);
      let maxVal: number | null = null;
      if (rows.length > 0) {
        const nums = rows
          .map((r) => r[col])
          .filter((v) => v !== null && v !== undefined)
          .map((v) => Number(v))
          .filter((v) => !isNaN(v));
        if (nums.length > 0) {
          maxVal = Math.max(...nums);
        }
      }
      return {
        rows: [{ [alias]: maxVal } as unknown as T],
        rowCount: 1,
      };
    }

    // 5. General SELECT
    const selectMatch = cleanSql.match(
      /^SELECT\s+(.+?)\s+FROM\s+["`]?([a-zA-Z0-9_]+)["`]?(?:\s+WHERE\s+(.+?))?(?:\s+ORDER\s+BY\s+(.+?))?(?:\s+LIMIT\s+(\d+))?(?:\s+OFFSET\s+(\d+))?$/i
    );
    if (selectMatch) {
      const colStr = selectMatch[1]!;
      const tableName = selectMatch[2]!;
      const whereClause = selectMatch[3];
      const orderByClause = selectMatch[4];
      const limitVal = selectMatch[5] ? parseInt(selectMatch[5], 10) : undefined;
      const offsetVal = selectMatch[6] ? parseInt(selectMatch[6], 10) : undefined;

      let rows = this.filterRows(tableName, whereClause, params);

      if (orderByClause) {
        const [colRaw, dir] = orderByClause.trim().split(/\s+/);
        const col = colRaw!.replace(/["`]/g, '');
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

      // Column projection
      let projected: TableRow[] = rows.map((r) => ({ ...r }));
      if (colStr.trim() !== '*') {
        const cols = colStr.split(',').map((c) => c.trim().replace(/["`]/g, ''));
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
        fields:
          projected.length > 0
            ? Object.keys(projected[0] ?? {}).map((k) => ({ name: k, type: 'TEXT' }))
            : [],
      };
    }

    // 6. INSERT INTO <table> (<cols>) VALUES (...)
    const insertMatch = cleanSql.match(
      /^INSERT\s+INTO\s+["`]?([a-zA-Z0-9_]+)["`]?\s*\(([^)]+)\)\s*VALUES\s*(.+)$/i
    );
    if (insertMatch) {
      const tableName = insertMatch[1]!.toLowerCase();
      const cols = insertMatch[2]!.split(',').map((c) => c.trim().replace(/["`]/g, ''));

      if (!this.tables.has(tableName)) {
        this.tables.set(tableName, []);
      }
      const table = this.tables.get(tableName)!;

      const rowsStr = insertMatch[3]!;
      const rowMatches = rowsStr.match(/\([^)]+\)/g) ?? [];
      let paramIdx = 0;
      let lastId: number | undefined;
      const insertedRows: TableRow[] = [];

      for (const rm of rowMatches) {
        const inner = rm.slice(1, -1).trim();
        const tokens = this.splitCommaSeparated(inner);
        const newRow: TableRow = {};

        for (let i = 0; i < cols.length; i++) {
          const col = cols[i]!;
          const valToken = tokens[i]?.trim();

          if (valToken === '?' || (valToken && /^\$\d+$/.test(valToken))) {
            newRow[col] = params[paramIdx++];
          } else if (valToken && valToken.startsWith("'") && valToken.endsWith("'")) {
            newRow[col] = valToken.slice(1, -1);
          } else if (valToken && !isNaN(Number(valToken))) {
            newRow[col] = Number(valToken);
          } else if (valToken) {
            newRow[col] = valToken;
          } else {
            newRow[col] = params[paramIdx++];
          }
        }

        if (newRow['id'] === undefined) {
          const nextId = table.length + 1;
          newRow['id'] = nextId;
          lastId = nextId;
        } else if (typeof newRow['id'] === 'number') {
          lastId = newRow['id'];
        }

        table.push(newRow);
        insertedRows.push({ ...newRow });
      }

      return {
        rows: insertedRows as unknown as T[],
        rowCount: insertedRows.length,
        lastInsertId: lastId,
      };
    }

    // 7. UPDATE <table> SET <assignments> [WHERE <where>]
    const updateMatch = cleanSql.match(
      /^UPDATE\s+["`]?([a-zA-Z0-9_]+)["`]?\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?$/i
    );
    if (updateMatch) {
      const tableName = updateMatch[1]!.toLowerCase();
      const setClause = updateMatch[2]!;
      const whereClause = updateMatch[3];

      const setAssignments = setClause.split(',').map((s) => s.trim());
      const setValues: Record<string, unknown> = {};
      let paramIdx = 0;

      for (const assign of setAssignments) {
        const [colRaw, valRaw] = assign.split('=').map((s) => s.trim());
        const col = colRaw!.replace(/["`]/g, '');
        if (valRaw === '?' || (valRaw && /^\$\d+$/.test(valRaw))) {
          setValues[col] = params[paramIdx++];
        } else if (valRaw && valRaw.startsWith("'") && valRaw.endsWith("'")) {
          setValues[col] = valRaw.slice(1, -1);
        } else if (valRaw && !isNaN(Number(valRaw))) {
          setValues[col] = Number(valRaw);
        } else {
          setValues[col] = valRaw;
        }
      }

      const table = this.tables.get(tableName) ?? [];
      let updatedCount = 0;

      if (whereClause) {
        const whereParams = params.slice(paramIdx);
        for (const row of table) {
          if (this.rowMatches(row, whereClause, whereParams)) {
            Object.assign(row, setValues);
            updatedCount++;
          }
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

    // 8. DELETE FROM <table> [WHERE <where>]
    const deleteMatch = cleanSql.match(
      /^DELETE\s+FROM\s+["`]?([a-zA-Z0-9_]+)["`]?(?:\s+WHERE\s+(.+))?$/i
    );
    if (deleteMatch) {
      const tableName = deleteMatch[1]!.toLowerCase();
      const whereClause = deleteMatch[2];
      const table = this.tables.get(tableName) ?? [];
      let deletedCount = 0;

      if (whereClause) {
        const remaining: TableRow[] = [];
        for (const row of table) {
          if (this.rowMatches(row, whereClause, params)) {
            deletedCount++;
          } else {
            remaining.push(row);
          }
        }
        this.tables.set(tableName, remaining);
      } else {
        deletedCount = table.length;
        this.tables.set(tableName, []);
      }

      return {
        rows: [],
        rowCount: deletedCount,
      };
    }

    // 9. CREATE TABLE [IF NOT EXISTS] <table>
    const createTableMatch = cleanSql.match(
      /^CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+["`]?([a-zA-Z0-9_]+)["`]?/i
    );
    if (createTableMatch) {
      const tableName = createTableMatch[1]!.toLowerCase();
      if (!this.tables.has(tableName)) {
        this.tables.set(tableName, []);
      }
      return { rows: [], rowCount: 0 };
    }

    // 10. DROP TABLE [IF EXISTS] <table>
    const dropTableMatch = cleanSql.match(
      /^DROP\s+TABLE(?:\s+IF\s+EXISTS)?\s+["`]?([a-zA-Z0-9_]+)["`]?/i
    );
    if (dropTableMatch) {
      const tableName = dropTableMatch[1]!.toLowerCase();
      this.tables.delete(tableName);
      return { rows: [], rowCount: 0 };
    }

    // 11. ALTER TABLE <table>
    const alterTableMatch = cleanSql.match(/^ALTER\s+TABLE\s+["`]?([a-zA-Z0-9_]+)["`]?/i);
    if (alterTableMatch) {
      const tableName = alterTableMatch[1]!.toLowerCase();
      if (!this.tables.has(tableName)) {
        this.tables.set(tableName, []);
      }
      return { rows: [], rowCount: 0 };
    }

    // 12. CREATE / DROP INDEX
    if (upper.startsWith('CREATE INDEX') || upper.startsWith('DROP INDEX')) {
      return { rows: [], rowCount: 0 };
    }

    // Generic fallback
    return {
      rows: [],
      rowCount: 1,
    };
  }

  private filterRows(
    tableName: string,
    whereClause: string | undefined,
    params: readonly unknown[]
  ): TableRow[] {
    const table = this.tables.get(tableName.toLowerCase().replace(/["`]/g, '')) ?? [];
    if (!whereClause) {
      return [...table];
    }
    return table.filter((row) => this.rowMatches(row, whereClause, params));
  }

  private rowMatches(row: TableRow, whereClause: string, params: readonly unknown[]): boolean {
    const andParts = this.splitTopLevel(whereClause.trim(), 'AND');
    let paramIndex = 0;

    for (const part of andParts) {
      const placeholders = (part.match(/\?|\$\d+/g) || []).length;
      const partParams = params.slice(paramIndex, paramIndex + placeholders);
      paramIndex += placeholders;

      if (!this.evaluateCondition(row, part.trim(), partParams)) {
        return false;
      }
    }

    return true;
  }

  private evaluateCondition(row: TableRow, condition: string, params: readonly unknown[]): boolean {
    let clean = condition.trim();

    // Check for OR conditions (both parenthesized and unparenthesized)
    if (clean.startsWith('(') && clean.endsWith(')')) {
      clean = clean.slice(1, -1).trim();
    }
    const orParts = this.splitTopLevel(clean, 'OR');
    if (orParts.length > 1) {
      let paramOffset = 0;
      for (const orPart of orParts) {
        const phCount = (orPart.match(/\?|\$\d+/g) || []).length;
        const orParams = params.slice(paramOffset, paramOffset + phCount);
        paramOffset += phCount;
        if (this.evaluateCondition(row, orPart.trim(), orParams)) {
          return true;
        }
      }
      return false;
    }

    // IN: "col" IN (?, ?)
    const inMatch = clean.match(/"?([a-zA-Z0-9_]+)"?\s+IN\s*\(([^)]+)\)/i);
    if (inMatch) {
      const col = inMatch[1]!.replace(/["`]/g, '');
      const placeholders = inMatch[2]!.split(',').map((p) => p.trim());
      const inVals = params.slice(0, placeholders.length);
      return inVals.some((v) => v === row[col] || String(v) === String(row[col]));
    }

    // IS NULL
    const nullMatch = clean.match(/"?([a-zA-Z0-9_]+)"?\s+IS\s+NULL/i);
    if (nullMatch) {
      const col = nullMatch[1]!.replace(/["`]/g, '');
      return row[col] === null || row[col] === undefined;
    }

    // IS NOT NULL
    const notNullMatch = clean.match(/"?([a-zA-Z0-9_]+)"?\s+IS\s+NOT\s+NULL/i);
    if (notNullMatch) {
      const col = notNullMatch[1]!.replace(/["`]/g, '');
      return row[col] !== null && row[col] !== undefined;
    }

    // Comparison: "col" = ? or "col" = 'literal' or "col" = 0
    const compMatch = clean.match(
      /"?([a-zA-Z0-9_]+)"?\s*(=|!=|<>|>|>=|<|<=|LIKE)\s*(\?|\$\d+|'[^']*'|-?\d+(?:\.\d+)?)/i
    );
    if (compMatch) {
      const col = compMatch[1]!.replace(/["`]/g, '');
      const op = compMatch[2]!;
      const valToken = compMatch[3]!;

      let targetVal: unknown;
      if (valToken === '?' || /^\$\d+$/.test(valToken)) {
        targetVal = params[0];
      } else if (valToken.startsWith("'") && valToken.endsWith("'")) {
        targetVal = valToken.slice(1, -1);
      } else if (!isNaN(Number(valToken))) {
        targetVal = Number(valToken);
      } else {
        targetVal = valToken;
      }

      const actualVal = row[col];

      switch (op.toUpperCase()) {
        case '=':
          if (typeof actualVal === 'boolean' || typeof targetVal === 'boolean') {
            const bActual = actualVal === true || actualVal === 1 || actualVal === 'true';
            const bTarget = targetVal === true || targetVal === 1 || targetVal === 'true';
            return bActual === bTarget;
          }
          return (
            actualVal === targetVal ||
            String(actualVal) === String(targetVal) ||
            Number(actualVal) === Number(targetVal)
          );
        case '!=':
        case '<>':
          if (typeof actualVal === 'boolean' || typeof targetVal === 'boolean') {
            const bActual = actualVal === true || actualVal === 1 || actualVal === 'true';
            const bTarget = targetVal === true || targetVal === 1 || targetVal === 'true';
            return bActual !== bTarget;
          }
          return (
            actualVal !== targetVal &&
            String(actualVal) !== String(targetVal) &&
            Number(actualVal) !== Number(targetVal)
          );
        case '>':
          return Number(actualVal) > Number(targetVal);
        case '>=':
          return Number(actualVal) >= Number(targetVal);
        case '<':
          return Number(actualVal) < Number(targetVal);
        case '<=':
          return Number(actualVal) <= Number(targetVal);
        case 'LIKE': {
          const rawTarget = String(targetVal ?? '').replace(/%/g, '').toLowerCase();
          const rawActual = String(actualVal ?? '').toLowerCase();
          return rawActual.includes(rawTarget);
        }
        default:
          return false;
      }
    }

    return true;
  }

  private splitTopLevel(str: string, delimiter: 'AND' | 'OR'): string[] {
    const parts: string[] = [];
    let depth = 0;
    let current = '';
    const upperDelim = ` ${delimiter} `;

    for (let i = 0; i < str.length; i++) {
      const char = str[i]!;
      if (char === '(') depth++;
      else if (char === ')') depth--;

      if (depth === 0) {
        const rest = str.slice(i);
        if (rest.toUpperCase().startsWith(upperDelim)) {
          parts.push(current.trim());
          current = '';
          i += upperDelim.length - 1;
          continue;
        }
      }
      current += char;
    }

    if (current.trim().length > 0) {
      parts.push(current.trim());
    }

    return parts;
  }

  private splitCommaSeparated(str: string): string[] {
    const parts: string[] = [];
    let inQuotes = false;
    let quoteChar = '';
    let current = '';

    for (let i = 0; i < str.length; i++) {
      const char = str[i]!;
      if ((char === "'" || char === '"') && (!inQuotes || quoteChar === char)) {
        inQuotes = !inQuotes;
        quoteChar = inQuotes ? char : '';
      }

      if (char === ',' && !inQuotes) {
        parts.push(current.trim());
        current = '';
        continue;
      }

      current += char;
    }

    if (current.trim().length > 0) {
      parts.push(current.trim());
    }

    return parts;
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
    supportsTransactionalDDL: true,
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

  /**
   * Helper to retrieve all table names currently stored.
   */
  public getTableNames(): string[] {
    return [...this.sharedTables.keys()];
  }
}
