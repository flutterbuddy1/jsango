import type { IDatabaseConnection, IDatabaseTransaction } from '@jsango/database';
import {
  AddColumnOperation,
  AddForeignKeyOperation,
  AlterColumnOperation,
  DropColumnOperation,
  DropForeignKeyOperation,
  type MigrationOperation,
} from '../public/operations.js';
import { MigrationError } from '../public/errors.js';
import type { SqlMigrationCompiler } from './compiler.js';

type Executor = IDatabaseConnection | IDatabaseTransaction;

interface LiveColumn {
  name: string;
  /** Column definition SQL without PRIMARY KEY (added separately). */
  sql: string;
  pk: number;
}

interface LiveForeignKey {
  name: string | undefined;
  columns: string[];
  sql: string;
}

interface LiveIndex {
  columns: string[];
  sql: string;
}

interface LiveTable {
  columns: LiveColumn[];
  autoIncrement: boolean;
  foreignKeys: LiveForeignKey[];
  indexes: LiveIndex[];
}

function q(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

async function readLiveTable(conn: Executor, table: string): Promise<LiveTable> {
  const master = await conn.query<{ sql: string | null }>(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
    [table]
  );
  const createSql = master.rows[0]?.sql;
  if (!createSql) {
    throw new MigrationError({ message: `Cannot rebuild SQLite table '${table}': it does not exist.` });
  }

  const info = await conn.query<{
    name: string;
    type: string;
    notnull: number;
    dflt_value: string | null;
    pk: number;
  }>(`PRAGMA table_info(${q(table)})`);

  const columns: LiveColumn[] = info.rows.map((c) => {
    let sql = `${q(c.name)} ${c.type || ''}`.trim();
    if (Number(c.notnull) === 1) sql += ' NOT NULL';
    if (c.dflt_value !== null && c.dflt_value !== undefined) sql += ` DEFAULT ${c.dflt_value}`;
    return { name: c.name, sql, pk: Number(c.pk) };
  });

  // Foreign keys: PRAGMA gives the definition, the CREATE TABLE SQL gives constraint names.
  const namedFks = new Map<string, string>();
  const fkNamePattern = /CONSTRAINT\s+["`[]?(\w+)["`\]]?\s+FOREIGN\s+KEY\s*\(([^)]*)\)/gi;
  for (const match of createSql.matchAll(fkNamePattern)) {
    const cols = match[2]!.split(',').map((c) => c.trim().replace(/["`[\]]/g, ''));
    namedFks.set(cols.join(','), match[1]!);
  }

  const fkRows = await conn.query<{
    id: number;
    seq: number;
    table: string;
    from: string;
    to: string | null;
    on_update: string;
    on_delete: string;
  }>(`PRAGMA foreign_key_list(${q(table)})`);

  const fkGroups = new Map<number, typeof fkRows.rows[number][]>();
  for (const row of fkRows.rows) {
    const list = fkGroups.get(Number(row.id)) ?? [];
    list.push(row);
    fkGroups.set(Number(row.id), list);
  }

  const foreignKeys: LiveForeignKey[] = [...fkGroups.values()].map((rows) => {
    rows.sort((a, b) => Number(a.seq) - Number(b.seq));
    const cols = rows.map((r) => r.from);
    const refCols = rows.map((r) => r.to ?? 'id');
    const first = rows[0]!;
    const name = namedFks.get(cols.join(','));
    const actions =
      (first.on_delete && first.on_delete !== 'NO ACTION' ? ` ON DELETE ${first.on_delete}` : '') +
      (first.on_update && first.on_update !== 'NO ACTION' ? ` ON UPDATE ${first.on_update}` : '');
    const sql = `${name ? `CONSTRAINT ${q(name)} ` : ''}FOREIGN KEY (${cols.map(q).join(', ')}) REFERENCES ${q(first.table)} (${refCols.map(q).join(', ')})${actions}`;
    return { name, columns: cols, sql };
  });

  // Indexes: explicit ones keep their SQL; UNIQUE-constraint autoindexes are recreated as
  // unique indexes. Primary key autoindexes are recreated by the PRIMARY KEY clause.
  const indexList = await conn.query<{ name: string; unique: number; origin: string }>(
    `PRAGMA index_list(${q(table)})`
  );
  const indexSql = await conn.query<{ name: string; sql: string | null }>(
    "SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = ?",
    [table]
  );
  const sqlByName = new Map(indexSql.rows.map((r) => [r.name, r.sql]));

  const indexes: LiveIndex[] = [];
  for (const idx of indexList.rows) {
    if (idx.origin === 'pk') continue;
    const cols = await conn.query<{ name: string | null }>(`PRAGMA index_info(${q(idx.name)})`);
    const columnsOfIndex = cols.rows.map((c) => c.name ?? '').filter(Boolean);
    const stored = sqlByName.get(idx.name);
    if (stored) {
      indexes.push({ columns: columnsOfIndex, sql: stored });
    } else if (idx.origin === 'u') {
      const name = `uq_${table}_${columnsOfIndex.join('_')}`;
      indexes.push({
        columns: columnsOfIndex,
        sql: `CREATE UNIQUE INDEX ${q(name)} ON ${q(table)} (${columnsOfIndex.map(q).join(', ')})`,
      });
    }
  }

  return {
    columns,
    autoIncrement: /\bAUTOINCREMENT\b/i.test(createSql),
    foreignKeys,
    indexes,
  };
}

/**
 * Applies an operation SQLite cannot express with ALTER TABLE by rebuilding the table:
 * create a new table with the target definition, copy the rows, drop the old table and rename.
 *
 * The live definition is read from the database (not reconstructed from migrations), so columns
 * created outside of migrations are preserved. Foreign key enforcement must be off, which
 * MigrationRunner guarantees for SQLite; otherwise DROP TABLE would fire ON DELETE CASCADE.
 */
export async function rebuildSqliteTable(
  conn: Executor,
  compiler: SqlMigrationCompiler,
  operation: MigrationOperation
): Promise<void> {
  const tableName = (operation as { tableName?: string }).tableName;
  if (!tableName) {
    throw new MigrationError({ message: `Operation '${operation.type}' cannot be applied by rebuilding a table.` });
  }

  const fkState = await conn.query<Record<string, unknown>>('PRAGMA foreign_keys');
  if (Number(Object.values(fkState.rows[0] ?? {})[0] ?? 0) === 1) {
    throw new MigrationError({
      message: `Rebuilding SQLite table '${tableName}' requires foreign key enforcement to be off (otherwise dropping the old table would cascade). Run migrations through MigrationRunner / "jsango migrate", which handles this automatically.`,
    });
  }

  const live = await readLiveTable(conn, tableName);
  const pkColumns = live.columns.filter((c) => c.pk > 0).sort((a, b) => a.pk - b.pk);
  let columns = [...live.columns];
  let foreignKeys = [...live.foreignKeys];
  let indexes = [...live.indexes];
  const copyColumns = new Set(live.columns.map((c) => c.name));

  const columnSql = (col: { name: string; sql: string }, isPk: boolean): string => {
    if (!isPk || pkColumns.length > 1) return col.sql;
    // Single-column primary key stays inline so INTEGER PRIMARY KEY keeps rowid semantics.
    const [head, ...rest] = col.sql.split(' NOT NULL');
    return `${head} PRIMARY KEY${live.autoIncrement ? ' AUTOINCREMENT' : ''}${rest.length ? ' NOT NULL' + rest.join(' NOT NULL') : ''}`;
  };

  if (operation instanceof AddColumnOperation) {
    const def = compiler.compileColumnDef(operation.column, true);
    columns = columns.filter((c) => c.name !== operation.column.name);
    columns.push({ name: operation.column.name, sql: def, pk: 0 });
    copyColumns.delete(operation.column.name);
  } else if (operation instanceof DropColumnOperation) {
    const name = operation.columnName;
    if (!columns.some((c) => c.name === name)) {
      throw new MigrationError({ message: `Column '${name}' does not exist on table '${tableName}'.` });
    }
    columns = columns.filter((c) => c.name !== name);
    copyColumns.delete(name);
    foreignKeys = foreignKeys.filter((fk) => !fk.columns.includes(name));
    indexes = indexes.filter((idx) => !idx.columns.includes(name));
  } else if (operation instanceof AlterColumnOperation) {
    const target = operation.column;
    const existing = columns.find((c) => c.name === target.name);
    if (!existing) {
      throw new MigrationError({ message: `Column '${target.name}' does not exist on table '${tableName}'.` });
    }
    // Primary-key-ness is kept from the live table; the compiler emits type/null/default.
    const def = compiler.compileColumnDef({ ...target, primaryKey: false, autoIncrement: false }, false);
    columns = columns.map((c) => (c.name === target.name ? { ...c, sql: def } : c));
  } else if (operation instanceof AddForeignKeyOperation) {
    foreignKeys = foreignKeys.filter((fk) => fk.name !== operation.foreignKey.name);
    foreignKeys.push({
      name: operation.foreignKey.name,
      columns: [...operation.foreignKey.columns],
      sql: compiler.compileForeignKeyClause(operation.foreignKey),
    });
  } else if (operation instanceof DropForeignKeyOperation) {
    const byName = foreignKeys.filter((fk) => fk.name === operation.foreignKeyName);
    if (byName.length > 0) {
      foreignKeys = foreignKeys.filter((fk) => fk.name !== operation.foreignKeyName);
    } else if (operation.previousForeignKey) {
      const cols = operation.previousForeignKey.columns.join(',');
      foreignKeys = foreignKeys.filter((fk) => fk.columns.join(',') !== cols);
    } else {
      throw new MigrationError({
        message: `Foreign key '${operation.foreignKeyName}' was not found on SQLite table '${tableName}'.`,
      });
    }
  } else {
    throw new MigrationError({ message: `Operation '${operation.type}' does not require a table rebuild.` });
  }

  const pkNames = new Set(pkColumns.map((c) => c.name));
  const body = columns.map((c) => columnSql(c, pkNames.has(c.name)));
  const remainingPk = pkColumns.filter((c) => columns.some((col) => col.name === c.name));
  if (remainingPk.length > 1) {
    body.push(`PRIMARY KEY (${remainingPk.map((c) => q(c.name)).join(', ')})`);
  }
  body.push(...foreignKeys.map((fk) => fk.sql));

  const tmp = `__jsango_rebuild_${tableName}`;
  const copied = columns.map((c) => c.name).filter((n) => copyColumns.has(n));

  await conn.query(`CREATE TABLE ${q(tmp)} (\n  ${body.join(',\n  ')}\n)`);
  if (copied.length > 0) {
    const cols = copied.map(q).join(', ');
    await conn.query(`INSERT INTO ${q(tmp)} (${cols}) SELECT ${cols} FROM ${q(tableName)}`);
  }
  await conn.query(`DROP TABLE ${q(tableName)}`);
  await conn.query(`ALTER TABLE ${q(tmp)} RENAME TO ${q(tableName)}`);
  for (const idx of indexes) {
    await conn.query(idx.sql);
  }
}
